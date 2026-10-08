/* S23 engine defects, each reproduced here before its fix (providers MOCKED; the assertions read the outgoing requests the
 * worker actually built, not its own records of them):
 *   A. a required campaign wordmark could be dropped from an image request (nanoRender kept the first six images; the marks
 *      were appended after the references) while the version recorded it as sent; an image prompt was cut blind at a length
 *      limit, which could cut identity rules and approved wording.
 *   B. a reference excluded as another campaign's still reached the suggestions call (and directions and revise) through the
 *      unfiltered reference text, could be cited as a basis, and could be attached to a render.
 *   C. suggestions were cached on the version, references and last event only, so a retired rule kept being advised.
 *   D. the content desk labelled rejected and other-campaign material "APPROVED EXAMPLES".
 *   E. the stream reader waited for the connection to close after message_stop, and accepted a stream that closed after an
 *      end_turn delta without message_stop; a data frame that did not parse was skipped, so an answer could arrive shorter
 *      than the model wrote it.
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

/* Claude: answers by what the system prompt asks; every request is kept. When `stream.plan` is set the answer is a server-sent
   event stream built byte for byte from the plan (chunks with pauses; `open` keeps the connection open after the last chunk) */
const anth = { calls: [] };
const stream = { plan: null, open: false, aborted: 0 };
const answerForOverride = { fn: null };
const answerFor = sys => {
  const o = answerForOverride.fn && answerForOverride.fn(sys); if (o) return o;
  if (/suggest|next directions|Suggested/i.test(sys)) return { design: [{ text: 'Use the brand blue', why: 'the rule', refs: [] }], image: [] };
  return {};
};
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); anth.calls.push(body);
  if (stream.plan) {
    const plan = stream.plan, keepOpen = stream.open; const signal = init && init.signal; let stopped = false;
    if (signal) signal.addEventListener('abort', () => { stopped = true; stream.aborted++; });
    return new Response(new ReadableStream({ async start(c) {
      for (const step of plan) { if (stopped) return; if (step.wait) await sleep(step.wait); if (stopped) return; try { c.enqueue(typeof step.bytes === 'string' ? new TextEncoder().encode(step.bytes) : step.bytes); } catch (e) { return; } }
      if (!keepOpen) { try { c.close(); } catch (e) {} }
    }, cancel() { stopped = true; } }), { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
  }
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(String(body.system || ''))) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
const frame = (type, data, eol) => { eol = eol || '\n'; return 'event: ' + type + eol + 'data: ' + JSON.stringify(Object.assign({ type }, data || {})) + eol + eol; };
const START = frame('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 120, output_tokens: 1 } } });
const textBlock = (i, pieces) => [frame('content_block_start', { index: i, content_block: { type: 'text', text: '' } })].concat(pieces.map(t => frame('content_block_delta', { index: i, delta: { type: 'text_delta', text: t } })), [frame('content_block_stop', { index: i })]);
const END = (out) => [frame('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: out || 42 } }), frame('message_stop', {})];
const steps = (frames, wait) => frames.map(f => ({ bytes: f, wait: wait == null ? 5 : wait }));
const mkLog = over => { const lines = []; const f = async (lvl, t) => { lines.push([lvl, t]); }; f.lines = lines; f.phase = async () => true; f.lease = async () => true; f.fence = async () => {}; f.compiled = []; return Object.assign(f, over || {}); };
const claude = o => w.mod.__test.stClaude(w.env, Object.assign({ role: 'extract', system: 'Answer in JSON.', user: 'Say hello.', maxTok: 1000 }, o || {}));

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

// ---------------------------------------------------------------------------------------------------- B. one filtered context package
// A HOOF project holds two analysed references: its own, and an approved tile of the national campaign. In the recommended
// pack (every stage's default) the national one is excluded; neither its analysis, its name nor its image may reach a model.
const payloadText = b => String(b.system || '') + '\n' + (typeof b.messages[0].content === 'string' ? b.messages[0].content : b.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('\n'));
const payloadImages = b => (typeof b.messages[0].content === 'string' ? [] : b.messages[0].content.filter(x => x.type === 'image').map(x => x.source.data));
const REF_NAT = REF(30), REF_HOOF = REF(31);
const seedRefs = async P => {
  const nat = (await call('POST', '/studio/reference', { project: P, name: 'National gold tile', purpose: 'approved', campaign: 'national', imageB64: REF_NAT, mime: 'image/png', analyse: false })).body.id;
  const own = (await call('POST', '/studio/reference', { project: P, name: 'HOOF myth tile', purpose: 'approved', campaign: 'hoof', imageB64: REF_HOOF, mime: 'image/png', analyse: false })).body.id;
  await w.env.MIND_DB.prepare('UPDATE studio_references SET analysis=? WHERE id=?').bind(JSON.stringify({ summary: 'NATIONAL-ONLY gold panel carrying the MCA logo bottom right', at: Date.now() }), nat).run();
  await w.env.MIND_DB.prepare('UPDATE studio_references SET analysis=? WHERE id=?').bind(JSON.stringify({ summary: 'HOOF-OWN red and teal myth / fact panels with the wordmark', at: Date.now() }), own).run();
  return { nat, own };
};
const leakCheck = (b, label, refsIds) => {
  const t = payloadText(b);
  ok(!/NATIONAL-ONLY|National gold tile/.test(t), label + ': the other campaign\'s reference is not in the text sent');
  ok(!refsIds || t.indexOf(refsIds.nat) < 0, label + ': its id is not in the text sent');
  ok(payloadImages(b).indexOf(REF_NAT) < 0, label + ': its image is not attached');
};
await T.t('B1 reproduced: suggestions never see a reference excluded as another campaign\'s (text, id or image)', async () => {
  const { P, A } = await fresh('hoof'); const ids = await seedRefs(P); anth.calls = [];
  const r = await call('POST', '/studio/suggest', { asset: A, refresh: true }); eq(r.status, 200, JSON.stringify(r.body));
  const b = anth.calls[anth.calls.length - 1]; ok(b, 'a model call was made');
  ok(/HOOF-OWN/.test(payloadText(b)), 'the campaign\'s own reference is read');
  leakCheck(b, 'suggest', ids);
});
await T.t('B2 directions, copy, revise and concepts receive the same filtered package', async () => {
  const { P, A } = await fresh('hoof'); const ids = await seedRefs(P);
  for (const [stage, input] of [['direct', { n: 2 }], ['copy', { channels: ['instagram'], deliverable: 'visual' }], ['revise', { target: 'asset', asset: A, instruction: 'make the headline bolder' }], ['concepts', { asset: A, mode: 'explore' }]]) {
    anth.calls = [];
    const jr = await call('POST', '/studio/job', { project: P, asset: stage === 'concepts' ? A : undefined, stage, input, idem: 'b2:' + stage + ':' + P });
    eq(jr.status, 200, stage + ': ' + JSON.stringify(jr.body)); await run(jr.body.job);
    ok(anth.calls.length, stage + ': a model call was made');
    anth.calls.forEach(b => leakCheck(b, stage, ids));
  }
});
await T.t('B3 a model citing an excluded reference id gets nothing for it: the id is not accepted as a reference', async () => {
  const { P, A } = await fresh('hoof'); const ids = await seedRefs(P);
  const prev = answerForOverride.fn; answerForOverride.fn = sys => /suggest|Suggested/i.test(sys) ? { design: [{ text: 'Use the national gold panel', why: 'reference', refs: [ids.nat, ids.own] }], image: [] } : null;
  try {
    const r = await call('POST', '/studio/suggest', { asset: A, refresh: true }); eq(r.status, 200, JSON.stringify(r.body));
    const d = (r.body.design || [])[0] || {}; eq((d.refs || []).map(x => x.id), [ids.own], 'only the campaign\'s own reference is kept as a basis');
  } finally { answerForOverride.fn = prev; }
});
await T.t('B4 a render never attaches a reference from another campaign unless the team chose it; the exclusion is recorded', async () => {
  const { P, A } = await fresh('hoof'); const ids = await seedRefs(P); gem.calls = [];
  const j = await run(await renderJob(P, A, { prompt: 'a road at dusk', region: 'bg', referenceIds: [{ id: ids.nat, role: 'mood' }, { id: ids.own, role: 'mood' }], aspect: '1:1' }, 'b4'));
  eq(j.state, 'done', j.error);
  const imgs = sentImages(gem.calls[0]); ok(imgs.indexOf(REF_NAT) < 0, 'the national reference image was not sent'); ok(imgs.indexOf(REF_HOOF) >= 0, 'the campaign\'s own was');
  const v = curOf((await get(P)).assets.find(x => x.id === A));
  ok((v.image.meta.excludedRefs || []).some(x => /National gold tile/.test(x.name) && /campaign/.test(x.reason)), 'recorded: ' + JSON.stringify(v.image.meta.excludedRefs));
});
await T.t('B5 the manifest names the excluded reference as left out, so "What informed this creative?" is honest', async () => {
  const { P, A } = await fresh('hoof'); await seedRefs(P);
  const r = await call('POST', '/studio/suggest', { asset: A, refresh: true });
  const inf = r.body.informed || {}; ok(inf.references && inf.references.excluded >= 1, JSON.stringify(inf.references));
  ok((inf.omitted || []).some(o => o.what === 'reference' && /National gold tile/.test(o.text) && /campaign/.test(o.why)), JSON.stringify(inf.omitted));
});

// ---------------------------------------------------------------------------------------------------- E. the stream protocol
const usageNow = async () => (await w.mod.__test.aiUsage(w.env, 'studio'));
await T.t('E1 reproduced: an answer whose message_stop has arrived is finished at once, even when the connection stays open', async () => {
  w.env.STUDIO_STREAM_IDLE_MS = '1500';
  stream.plan = steps([START].concat(textBlock(0, ['{"hello":', '"world"}']), END())); stream.open = true;
  try {
    const t0 = Date.now(); let res = null, err = null;
    try { res = await claude({ log: mkLog() }); } catch (e) { err = e; }
    const ms = Date.now() - t0;
    ok(!err, 'no error: ' + (err && err.message));
    eq(res && res.text, '{"hello":"world"}', 'the whole answer');
    ok(ms < 1000, 'finished on message_stop, not when the idle limit ran out: ' + ms + ' ms');
  } finally { stream.plan = null; stream.open = false; delete w.env.STUDIO_STREAM_IDLE_MS; }
});
await T.t('E2 reproduced: a stream that ends after the end_turn delta but before message_stop is cut: retried, never parsed', async () => {
  stream.plan = steps([START].concat(textBlock(0, ['{"partial":', 'true}']), [frame('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 9 } })]));
  try {
    let res = null, err = null; try { res = await claude({ log: mkLog() }); } catch (e) { err = e; }
    ok(err && /stream_cut/.test(err.message), 'stream_cut, not an answer: ' + (err ? err.message : JSON.stringify(res)));
    ok(w.mod.__test.stTransient(err && err.message), 'and it is retried (transient)');
  } finally { stream.plan = null; }
});
await T.t('E3 split UTF-8 and CRLF: a character split across chunks and CRLF line ends assemble exactly', async () => {
  const text = '{"t":"Hands Off Our Fuel \u2014 not a subsidy \ud83d\udee2\ufe0f, caf\u00e9"}';
  const all = new TextEncoder().encode([START].concat(textBlock(0, [text]), END()).join('').replace(/\n/g, '\r\n'));
  // cut the bytes every 7, so multi-byte characters and CR / LF pairs fall across chunk edges
  const plan = []; for (let i = 0; i < all.length; i += 7) plan.push({ bytes: all.slice(i, i + 7), wait: 0 });
  stream.plan = plan;
  try { const res = await claude({ log: mkLog() }); eq(res.text, text, 'byte-exact'); }
  finally { stream.plan = null; }
});
await T.t('E4 reproduced: a data frame that does not parse is a broken stream, never a silently shorter answer', async () => {
  const bad = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"not "\n\n';
  stream.plan = steps([START, frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '{"claim":"' } }), bad, frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'a subsidy"}' } }), frame('content_block_stop', { index: 0 })].concat(END()));
  try {
    let res = null, err = null; try { res = await claude({ log: mkLog() }); } catch (e) { err = e; }
    ok(err && /stream_protocol/.test(err.message), 'the answer is refused: ' + (err ? err.message : 'answered ' + JSON.stringify(res && res.text)));
    ok(w.mod.__test.stTransient(err && err.message), 'and retried');
  } finally { stream.plan = null; }
});
await T.t('E5 pings, SSE comments and event types the reader does not know are ignored; the answer is whole', async () => {
  stream.plan = steps([': keep-alive comment\n\n', frame('ping', {}), START, frame('ping', {}), frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '{"a":' } }), frame('content_block_annotation', { index: 0, note: 'new event type' }), frame('content_block_delta', { index: 0, delta: { type: 'citations_delta', citation: {} } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '1}' } }), frame('content_block_stop', { index: 0 })].concat(END()));
  try { const res = await claude({ log: mkLog() }); eq(res.text, '{"a":1}'); }
  finally { stream.plan = null; }
});
await T.t('E6 events out of order are refused: a delta for a block that never started, and content before message_start', async () => {
  stream.plan = steps([START, frame('content_block_delta', { index: 3, delta: { type: 'text_delta', text: '{"x":1}' } }), frame('content_block_stop', { index: 3 })].concat(END()));
  try { let err = null; try { await claude({ log: mkLog() }); } catch (e) { err = e; } ok(err && /stream_protocol/.test(err.message) && /never started|not started|without its start/i.test(err.message), err && err.message); }
  finally { stream.plan = null; }
  stream.plan = steps(textBlock(0, ['{"x":1}']).concat(END()));
  try { let err = null; try { await claude({ log: mkLog() }); } catch (e) { err = e; } ok(err && /stream_protocol/.test(err.message) && /message_start/.test(err.message), err && err.message); }
  finally { stream.plan = null; }
});
await T.t('E7 an error event ends the call as the provider\'s overload, retried, with nothing parsed', async () => {
  stream.plan = steps([START, frame('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }), frame('content_block_delta', { index: 0, delta: { type: 'text_delta', text: '{"half":' } }), frame('error', { error: { type: 'overloaded_error', message: 'Overloaded' } })]);
  try { let err = null; try { await claude({ log: mkLog() }); } catch (e) { err = e; } ok(err && /overloaded/i.test(err.message) && w.mod.__test.stTransient(err.message), err && err.message); }
  finally { stream.plan = null; }
});
await T.t('E8 a cancel while the answer streams stops the call (the request is aborted) and nothing is returned', async () => {
  let n = 0; w.env.STUDIO_LEASE_BEAT_MS = '30';
  const pieces = Array.from({ length: 40 }, () => 'abcde');
  stream.plan = steps([START].concat(textBlock(0, pieces), END()), 20); stream.aborted = 0;
  try {
    let err = null; const t0 = Date.now();
    try { await claude({ log: mkLog({ lease: async () => (++n < 3), fence: async () => { throw Object.assign(new Error('fenced: the job was cancelled'), { fenced: true }); } }) }); } catch (e) { err = e; }
    ok(err && (err.fenced || /fenced/.test(err.message)), 'the call ends as fenced: ' + (err && err.message));
    ok(stream.aborted >= 1, 'the provider request was aborted');
    ok(Date.now() - t0 < 700, 'promptly: ' + (Date.now() - t0) + ' ms');
  } finally { stream.plan = null; delete w.env.STUDIO_LEASE_BEAT_MS; }
});
await T.t('E9 usage: a finished stream is settled once as confirmed with the final cumulative tokens; a cut one as failed', async () => {
  const u0 = await usageNow();
  stream.plan = steps([START].concat(textBlock(0, ['{"ok":true}']), END(77)));
  try { await claude({ log: mkLog() }); } finally { stream.plan = null; }
  const u1 = await usageNow();
  eq([u1.confirmed - u0.confirmed, u1.failed - u0.failed], [1, 0], 'one confirmed');
  eq([u1.in_tok - u0.in_tok, u1.out_tok - u0.out_tok], [120, 77], 'the input tokens from message_start, the final output tokens from message_delta');
  stream.plan = steps([START].concat(textBlock(0, ['{"ok":'])));
  try { try { await claude({ log: mkLog() }); } catch (e) {} } finally { stream.plan = null; }
  const u2 = await usageNow();
  eq([u2.confirmed - u1.confirmed, u2.failed - u1.failed], [0, 1], 'one failed');
});

T.done(); w.restore();
