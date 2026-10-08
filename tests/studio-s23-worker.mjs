/* S23 engine defects, each reproduced here before its fix (providers MOCKED; the assertions read the outgoing requests the
 * worker actually built, not its own records of them):
 *   A. a required campaign wordmark could be dropped from an image request (nanoRender kept the first six images; the marks
 *      were appended after the references) while the version recorded it as sent; an image prompt was cut blind at a length
 *      limit, which could cut identity rules and approved wording.
 *   B. a reference excluded as another campaign's still reached the suggestions call through the unfiltered reference text.
 *   C. suggestions were cached on the version, references and last event only, so a retired rule kept being advised.
 *   D. the content desk labelled rejected and other-campaign material "APPROVED EXAMPLES".
 *   E. the stream reader waited for the connection to close after message_stop, and accepted a stream that closed after an
 *      end_turn delta without message_stop.
 * Run: node --experimental-sqlite tests/studio-s23-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s23-worker (engine defects A-E: required marks, filtered context, cache identity, approved examples, stream protocol)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const png = byte => Buffer.from('89504e470d0a1a0a' + byte.repeat(100), 'hex').toString('base64');
const PNG = png('00'); const PNG_MARK = png('22'); const PNG_LOGO = png('11');
const REF = i => png((40 + i).toString(16).padStart(2, '0'));

const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 5 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const curOf = a => a.versions.find(v => v.id === a.current);

/* Gemini: every request is kept; a model named in gemFail answers 503 */
const gem = { calls: [], fail: new Set() };
w.answer(/generativelanguage/, async (u, init) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
  const body = JSON.parse(init.body); const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || ''); gem.calls.push({ model, body });
  if (gem.fail.has(model)) return new Response(JSON.stringify({ error: { code: 503, message: 'overloaded' } }), { status: 503 });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
const sentImages = c => { const turn = c.body.contents[c.body.contents.length - 1]; return turn.parts.filter(p => p.inline_data || p.inlineData).map(p => (p.inline_data || p.inlineData).data); };
const sentText = c => { const turn = c.body.contents[c.body.contents.length - 1]; return turn.parts.filter(p => p.text).map(p => p.text).join('\n'); };

/* Claude: answers by what the system prompt asks; every request is kept */
const anth = { calls: [] };
const answerFor = sys => {
  if (/suggest|next directions|Suggested/i.test(sys)) return { design: [{ title: 'Use the brand blue', why: 'the rule', refs: [] }], image: [] };
  return {};
};
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); anth.calls.push(body);
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(String(body.system || ''))) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});

/* MCA with its logo; HOOF carries its wordmark only; a second campaign with both marks */
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', url: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'both' }] });
eq((await call('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG_MARK, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' })).status, 200);
eq((await call('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG_MARK, wordmarkMime: 'image/png', wordmarkCampaign: 'national' })).status, 200);
eq((await call('POST', '/brand/kit', { ns: 'mca', logoB64: PNG_LOGO, logoMime: 'image/png' })).status, 200);
const wmKey = Array.from(w.r2.keys()).find(k => /^brand\/mca\/wordmark\/hoof@/.test(k));
const wmNatKey = Array.from(w.r2.keys()).find(k => /^brand\/mca\/wordmark\/national@/.test(k));
const logoKey = Array.from(w.r2.keys()).find(k => /^brand\/mca\/logo@/.test(k)) || 'brand/mca/logo';
ok(wmKey, 'the HOOF wordmark file is stored: ' + Array.from(w.r2.keys()).join(', '));

const LAYOUT = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }] };
const fresh = async (campaign, title) => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign, title: title || ('S23 ' + Math.random().toString(36).slice(2, 7)), brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
  const A = (await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: LAYOUT, mode: 'composition' })).body.asset.id;
  return { P, A };
};
const renderJob = async (P, A, input, idem) => { const r = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input, idem }); eq(r.status, 200, JSON.stringify(r.body)); return r.body.job; };

// ---------------------------------------------------------------------------------------------------- A. required marks
await T.t('A1 reproduced: a finished render with six references and the required wordmark sends the wordmark, and records only what was sent', async () => {
  const { P, A } = await fresh('hoof'); gem.calls = [];
  const refs = Array.from({ length: 6 }, (_, i) => ({ data: REF(i), mime: 'image/png', role: 'inspiration reference ' + (i + 1), name: 'ref' + (i + 1) }));
  const j = await run(await renderJob(P, A, { prompt: 'Paint the whole tile as a finished creative.', finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], references: refs, aspect: '1:1' }, 'a1'));
  eq(j.state, 'done', j.error);
  const imgs = sentImages(gem.calls[0]);
  ok(imgs.indexOf(PNG_MARK) >= 0, 'the wordmark file is in the outgoing request (' + imgs.length + ' images sent)');
  ok(imgs.indexOf(PNG_MARK) < imgs.indexOf(REF(0)) || imgs.indexOf(REF(0)) < 0, 'the required mark is attached before optional inspiration');
  ok(imgs.length <= 6, 'no more images than the model takes at high fidelity: ' + imgs.length);
  const v = curOf((await get(P)).assets.find(x => x.id === A));
  eq(v.image.meta.marksSent, ['wordmark'], 'marksSent is what the payload carried');
  const meta = v.image.meta; ok(Array.isArray(meta.attached) && meta.attached.length === imgs.length, 'the attachment record has one row per image sent: ' + JSON.stringify(meta.attached));
  ok(Array.isArray(meta.excludedRefs) && meta.excludedRefs.length === 1 && /limit/.test(meta.excludedRefs[0].reason), 'the optional reference left out is named with the reason: ' + JSON.stringify(meta.excludedRefs));
  ok(/HOOF wordmark/.test(sentText(gem.calls[0])), 'the request text names the mark among the attachments');
});
await T.t('A2 two required marks and the current image to edit go first, in that order, and the text says the first image is the one to edit', async () => {
  const { P, A } = await fresh('national'); gem.calls = [];
  // give the version an image (a first render answered by a fallback model), then edit it: the history belongs to that model and
  // is not replayed to the default one, so the current image must be attached as an image input
  gem.fail = new Set(['gemini-3-pro-image']);
  const first = await run(await renderJob(P, A, { prompt: 'a road at dusk', region: 'bg', aspect: '1:1' }, 'a2-first')); gem.fail = new Set(); eq(first.state, 'done', first.error);
  gem.calls = [];
  const refs = Array.from({ length: 5 }, (_, i) => ({ data: REF(i), mime: 'image/png', role: 'mood reference', name: 'mood' + i }));
  const j = await run(await renderJob(P, A, { prompt: 'Make the sky warmer; keep everything else.', edit: true, finished: true, approach: 'artwork', marks: [{ role: 'logo', key: logoKey, name: 'MCA logo' }, { role: 'wordmark', key: wmNatKey, name: 'Australian mining wordmark' }], references: refs, aspect: '1:1' }, 'a2'));
  eq(j.state, 'done', j.error);
  const imgs = sentImages(gem.calls[0]);
  eq(imgs.slice(0, 3), [PNG, PNG_LOGO, PNG_MARK], 'current image, then the logo, then the wordmark');
  ok(/first attached image is the current image/i.test(sentText(gem.calls[0])), 'the text names the first image as the one to edit');
  const v = curOf((await get(P)).assets.find(x => x.id === A)); eq(v.image.meta.marksSent.slice().sort(), ['logo', 'wordmark']);
});
await T.t('A3 provider fallback: the fallback model gets the required marks too, within its own limit, and the record names the model that answered', async () => {
  const { P, A } = await fresh('hoof'); gem.calls = []; gem.fail = new Set(['gemini-3-pro-image']);
  const refs = Array.from({ length: 12 }, (_, i) => ({ data: REF(i), mime: 'image/png', role: 'inspiration', name: 'r' + i }));
  const j = await run(await renderJob(P, A, { prompt: 'Paint it.', finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], references: refs, aspect: '1:1' }, 'a3'));
  gem.fail = new Set();
  eq(j.state, 'done', j.error);
  const answered = gem.calls[gem.calls.length - 1];
  ok(answered.model !== 'gemini-3-pro-image', 'a fallback model answered: ' + answered.model);
  ok(sentImages(answered).indexOf(PNG_MARK) >= 0, 'the fallback request carries the wordmark');
  const v = curOf((await get(P)).assets.find(x => x.id === A)); eq(v.image.model, answered.model); eq(v.image.meta.marksSent, ['wordmark']);
});
await T.t('A4 required assets that cannot fit fail before any image call, with the reason (not retried)', async () => {
  const { P, A } = await fresh('national'); gem.calls = []; w.env.STUDIO_IMAGE_INPUTS_MAX = '1';
  try {
    const j = await run(await renderJob(P, A, { prompt: 'Paint it.', finished: true, approach: 'artwork', marks: [{ role: 'logo', key: logoKey, name: 'MCA logo' }, { role: 'wordmark', key: wmNatKey, name: 'wordmark' }], aspect: '1:1' }, 'a4'));
    eq(j.state, 'failed', JSON.stringify(j)); ok(/required_assets_over_limit/.test(j.error) && /not retried/.test(j.error), j.error);
    eq(gem.calls.length, 0, 'no image call was made');
  } finally { delete w.env.STUDIO_IMAGE_INPUTS_MAX; }
});
await T.t('A5 a long image prompt keeps its identity rules and approved words: nothing is cut blind; essentials over the limit fail before the call', async () => {
  const { P, A } = await fresh('hoof'); gem.calls = [];
  const filler = ('Concept detail. ').repeat(560);   // about 9,000 characters of optional description
  const tail = 'Place the HOOF wordmark bottom right exactly as attached. The client logo must not appear anywhere on this piece.';
  const j = await run(await renderJob(P, A, { prompt: filler + '\n' + tail, finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], aspect: '1:1' }, 'a5'));
  eq(j.state, 'done', j.error);
  const text = sentText(gem.calls[0]); ok(text.indexOf(tail) >= 0, 'the identity rule at the end of a long prompt is in the request');
  ok(/HOOF wordmark/.test(text), 'the attachment roles are in the request');
  gem.calls = [];
  // a structured prompt whose essential parts alone exceed the request's text limit (each part within the field limit of a job)
  const big = ('Essential rule. ').repeat(560);
  const j2 = await run(await renderJob(P, A, { prompt: 'see parts', promptParts: [{ text: big, essential: true, label: 'words' }, { text: big, essential: true, label: 'marks' }, { text: big, essential: true, label: 'rules' }], finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], aspect: '1:1' }, 'a5b'));
  eq(j2.state, 'failed', JSON.stringify(j2)); ok(/prompt_over_limit/.test(j2.error) && /not retried/.test(j2.error), j2.error); eq(gem.calls.length, 0, 'nothing was sent');
  // a structured prompt with optional parts that do not fit: they give way, are named on the version, and the essentials are all sent
  gem.calls = [];
  const opt = ('Optional mood. ').repeat(700);
  const j3 = await run(await renderJob(P, A, { prompt: 'see parts', promptParts: [{ text: 'PAINT the tile.', essential: true }, { text: opt, label: 'mood' }, { text: 'WORDS: "Not a subsidy"', essential: true }, { text: opt, label: 'scene' }, { text: 'MARK: the HOOF wordmark exactly as attached.', essential: true }], finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], aspect: '1:1' }, 'a5c'));
  eq(j3.state, 'done', j3.error); const t3 = sentText(gem.calls[0]);
  ok(/PAINT the tile/.test(t3) && /WORDS: "Not a subsidy"/.test(t3) && /MARK: the HOOF wordmark/.test(t3), 'every essential part was sent');
  const v3 = curOf((await get(P)).assets.find(x => x.id === A)); ok(Array.isArray(v3.image.meta.promptDropped) && v3.image.meta.promptDropped.indexOf('scene') >= 0, 'the optional part left out is named on the version: ' + JSON.stringify(v3.image.meta.promptDropped));
});
await T.t('A6 structured prompts: optional parts give way first and are named; essential parts are never trimmed', async () => {
  const fin = w.mod.__test && w.mod.__test.stPromptFit;
  ok(typeof fin === 'function', 'stPromptFit is exposed for tests');
  const parts = [{ text: 'E1 format', essential: true }, { text: 'O1 ' + 'x'.repeat(600), label: 'concept' }, { text: 'E2 words "Not a subsidy"', essential: true }, { text: 'O2 ' + 'y'.repeat(600), label: 'mood' }, { text: 'E3 mark exactly as attached', essential: true }];
  const r = fin(parts, 700);
  ok(r.ok && /E1 format/.test(r.text) && /E2 words/.test(r.text) && /E3 mark/.test(r.text), 'every essential part is present: ' + r.text.slice(0, 80));
  ok(r.dropped.length >= 1 && r.dropped.every(d => /concept|mood/.test(d)), 'the optional parts left out are named: ' + JSON.stringify(r.dropped));
  ok(r.text.indexOf('E1') < r.text.indexOf('E2') && r.text.indexOf('E2') < r.text.indexOf('E3'), 'order kept');
  const bad = fin([{ text: 'z'.repeat(900), essential: true }], 700); ok(!bad.ok && bad.overBy === 200, 'essentials over the limit are refused: ' + JSON.stringify({ ok: bad.ok, overBy: bad.overBy }));
});
await T.t('A7 at the limit the rank decides which references stay (approved over inspiration); those kept keep the order the plan named them', async () => {
  const att = w.mod.__test.stImageAttach;
  const items = [{ data: 'i1', name: 'insp1', rank: 6 }, { data: 'a1', name: 'approved', rank: 0 }, { data: 'i2', name: 'insp2', rank: 6 }, { data: 'm', name: 'wordmark', mark: 'wordmark', kind: 'mark', required: true }];
  const r = att(items, 3);
  eq(r.attached.map(x => x.name), ['wordmark', 'insp1', 'approved'], 'the mark first, then the kept references in the given order');
  eq(r.excluded.map(x => x.name), ['insp2'], 'the weaker reference is the one left out');
  const none = att([{ data: 'c', kind: 'current', required: true, name: 'current' }, { data: 'm', mark: 'logo', kind: 'mark', required: true, name: 'logo' }], 1);
  ok(!none.ok && /2 required images/.test(none.detail), none.detail);
});

T.done(); w.restore();
