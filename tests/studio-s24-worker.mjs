/* S24 engine defects, each reproduced here before its fix (providers MOCKED; the assertions count the requests that actually
 * left the worker and read the rows it stored, not its own account of them):
 *   01 cancelling a render did not stop it: the image chain kept retrying and falling back after the job was cancelled (a held
 *      first request, a cancel, a 503 released: eight more requests). Cancelled during preparation, during an active request,
 *      during a retry delay and while choosing a fallback, a job now sends nothing more, and the cancel says what was already
 *      sent and cannot be recalled.
 *   02 nested retries spent more than anyone reserved (three models x three tries x three job attempts = 27 requests) while
 *      /studio/budget counted no image use at all. One end-to-end attempt policy, a separate image ledger with retries,
 *      fallbacks and unknown outcomes, and a server-side allowance that a live test cannot exceed, child jobs and concurrent
 *      runners included.
 *   03 the suggestion fingerprint left the reference record out: a reference rejected, disliked or corrected kept its old advice
 *      fresh, and so did an edited artwork description or a re-classified example.
 *   04 a reference's purpose was taken for its approval: a reference marked "approved" but rejected by the client still stood
 *      under Approved designs and voted on the mark's placement; a person's correction of where the mark sits did not outrank
 *      the vision pass.
 *   05 the observation-to-rule lifecycle contradicted itself: retire, restore, correct and promote again left two active rules
 *      saying opposite things; two edits at once lost one.
 *   06 a mark's source was judged by its path and query only, so https://untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof
 *      passed, as did a variant or revision that is not in storage.
 * Run: node --experimental-sqlite tests/studio-s24-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s24-worker (cancellation, attempt policy and accounting, suggestion fingerprint, reference authority, observation lifecycle, mark sources)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (fn, ms, what) => { const t0 = Date.now(); while (!(await fn())) { if (Date.now() - t0 > (ms || 6000)) throw new Error('timed out waiting for ' + (what || 'a condition')); await sleep(5); } };
const png = byte => Buffer.from('89504e470d0a1a0a' + byte.repeat(100), 'hex').toString('base64');
const PNG = png('00'); const PNG_MARK = png('22'); const PNG_LOGO = png('11');

const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0', STUDIO_IMAGE_BACKOFF_MS: '20', STUDIO_CANCEL_POLL_MS: '25' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const getJob = async id => (await call('GET', '/studio/job?id=' + id, null, 'read-key')).body.job;

/* Gemini: every request is kept with the model it named. Each request takes the next entry of gem.script (else gem.dflt):
   {status} answers that error, {hold, then} waits for gem.release() (a fetch aborted by the worker rejects as a real one does),
   {throw} fails the fetch itself, {malformed} answers 200 with a body that is not JSON, anything else answers an image. */
const gem = { calls: [], script: [], dflt: { ok: true }, release: null, aborted: 0 };
const answerGem = entry => {
  if (entry.throw) throw new TypeError(entry.throw);
  if (entry.malformed) return new Response('<html>gateway</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
  if (entry.status) return new Response(JSON.stringify({ error: { code: entry.status, message: 'mock ' + entry.status } }), { status: entry.status });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1200, totalTokenCount: 1210 } }), { status: 200 });
};
w.answer(/generativelanguage/, async (u, init) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [] }), { status: 200 });
  const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || '');
  const entry = gem.script.length ? gem.script.shift() : gem.dflt; gem.calls.push({ model, at: Date.now() });
  if (entry.hold) {
    await new Promise((res, rej) => { gem.release = res; const s = init && init.signal; if (s) { if (s.aborted) { gem.aborted++; rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); } else s.addEventListener('abort', () => { gem.aborted++; rej(Object.assign(new Error('aborted'), { name: 'AbortError' })); }); } });
    return answerGem(entry.then || {});
  }
  return answerGem(entry);
});
const resetGem = () => { gem.calls = []; gem.script = []; gem.dflt = { ok: true }; gem.release = null; gem.aborted = 0; };

/* Claude: answers by what the system prompt asks; every request is kept (system and user text) */
const anth = { calls: [], fail: null };
const ANALYSIS = o => Object.assign({ summary: 'A tile with the wordmark in a corner.', typography: 'Condensed sans', colour: { palette: ['#F2B705'], relationships: 'yellow on teal' }, hierarchy: 'headline first', composition: 'band at the foot', imageTreatment: 'documentary', panels: 'one band', spacing: 'generous', logo: 'Wordmark bottom right, a fifth of the width', url: 'none', mark: { present: true, kind: 'wordmark', corner: 'br', size: 'a fifth of the width', clearSpace: 'half its height' }, text: ['WORDS'], takeaways: ['Keep the band'] }, o || {});
let analysisNext = null;
w.answer(/api\.anthropic\.com/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const user = JSON.stringify(body.messages || []);
  anth.calls.push({ sys, user });
  if (anth.fail) return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529, headers: { 'Content-Type': 'application/json' } });
  let out = {};
  if (/describing one reference image/.test(sys)) { out = analysisNext || ANALYSIS(); analysisNext = null; }
  else if (/suggesting the next things/.test(sys)) out = { design: [{ text: 'Move the band up', why: 'room', refs: [], basis: 'inferred' }], image: [], typography: [], copy: [], concept: [] };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
const suggestCalls = () => anth.calls.filter(c => /suggesting the next things/.test(c.sys));

/* the MCA kit: HOOF carries its own wordmark (white and black variants on file), the national campaign the client logo */
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] });
for (const [variant, tone] of [['white', 'light'], ['black', 'dark']]) eq((await call('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: variant, wordmarkTone: tone, wordmarkB64: PNG_MARK, wordmarkMime: 'image/png', wordmarkDefault: variant === 'white' })).status, 200);
eq((await call('POST', '/brand/kit', { ns: 'mca', logoB64: PNG_LOGO, logoMime: 'image/png' })).status, 200);
const kitNow = async ns => { const r = await call('GET', '/brand/kit?ns=' + (ns || 'mca')); return r.body.kit || r.body; };
const wmKey = Array.from(w.r2.keys()).find(k => /^brand\/mca\/wordmark\/hoof\/white\//.test(k)) || Array.from(w.r2.keys()).find(k => /^brand\/mca\/wordmark\/hoof/.test(k));
ok(wmKey, 'the HOOF wordmark is stored: ' + Array.from(w.r2.keys()).join(', '));

const LAYOUT = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }] };
const fresh = async (campaign, extra, ns) => {
  const P = (await call('POST', '/studio/project', Object.assign({ ns: ns || 'mca', campaign, title: 'S24 ' + Math.random().toString(36).slice(2, 7), brief: { objective: 'o', message: 'm', channels: ['instagram'] } }, extra || {}))).body.id;
  const r = await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: LAYOUT, mode: 'composition' });
  return { P, A: r.body.asset && r.body.asset.id };
};
const renderJob = async (P, A, input, idem) => { const r = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: Object.assign({ prompt: 'a road at dusk', region: 'bg', aspect: '1:1' }, input || {}), idem: idem || ('r' + Math.random().toString(36).slice(2, 9)) }); eq(r.status, 200, JSON.stringify(r.body)); return r.body.job; };
const runOut = async id => { let j = await getJob(id); for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id })).body.job; return j; };

// ------------------------------------------------------------------------------------------------ S24-01 cancellation
await T.t('01a cancelled during an active request: the 503 that comes back starts nothing more, and the cancel names the request it could not recall', async () => {
  const { P, A } = await fresh('national'); resetGem();
  gem.script = [{ hold: true, then: { status: 503 } }]; gem.dflt = { status: 503 };
  const job = await renderJob(P, A);
  const stepP = call('POST', '/studio/job/step', { id: job.id });
  await until(() => gem.calls.length === 1, 6000, 'the first image request');
  const c = await call('POST', '/studio/job/cancel', { id: job.id }); eq(c.status, 200);
  eq(c.body.job.state, 'cancelled');
  if (gem.release) gem.release();
  await stepP; await sleep(250);
  // a later tick has nothing to run either
  if (w.mod.__test.studioCron) await w.mod.__test.studioCron(w.env, 20000); else await call('POST', '/studio/job/step', { id: job.id });
  eq(gem.calls.length, 1, 'no request after the cancel (was ' + gem.calls.length + ': ' + gem.calls.map(c => c.model).join(', ') + ')');
  const cn = c.body.job.cancel || {};
  eq([cn.requested > 0, cn.further, cn.inFlight], [true, 'none', 1], 'the cancel says: requested, no further attempts, one request already sent that cannot be recalled: ' + JSON.stringify(cn));
  const j = await getJob(job.id); eq(j.state, 'cancelled');
});
await T.t('01b cancelled during the retry delay: the delay ends promptly and the next request is never sent', async () => {
  const { P, A } = await fresh('national'); resetGem(); gem.dflt = { status: 503 };
  w.env.STUDIO_IMAGE_BACKOFF_MS = '900';
  try {
    const job = await renderJob(P, A);
    const stepP = call('POST', '/studio/job/step', { id: job.id });
    await until(() => gem.calls.length === 1, 6000, 'the first image request');
    await sleep(30);
    const t0 = Date.now(); eq((await call('POST', '/studio/job/cancel', { id: job.id })).body.job.state, 'cancelled');
    await stepP; const took = Date.now() - t0;
    ok(took < 700, 'the step ended within the delay, not after it (' + took + ' ms)');
    await sleep(1000);
    eq(gem.calls.length, 1, 'no request after the cancel (was ' + gem.calls.length + ')');
  } finally { w.env.STUDIO_IMAGE_BACKOFF_MS = '20'; }
});
await T.t('01c cancelled while the chain chooses a fallback: the fallback model is never asked', async () => {
  const { P, A } = await fresh('national'); resetGem();
  gem.script = [{ hold: true, then: { status: 404 } }]; gem.dflt = { ok: true };
  const job = await renderJob(P, A);
  const stepP = call('POST', '/studio/job/step', { id: job.id });
  await until(() => gem.calls.length === 1, 6000, 'the first image request');
  eq((await call('POST', '/studio/job/cancel', { id: job.id })).body.job.state, 'cancelled');
  if (gem.release) gem.release();
  await stepP; await sleep(200);
  eq(gem.calls.map(c => c.model), [gem.calls[0].model], 'only the first model was asked');
});
await T.t('01d cancelled during preparation (the mark file still being read): no image request is sent at all', async () => {
  const { P, A } = await fresh('hoof'); resetGem();
  const get0 = w.env.MIND_DOCS.get; let reading = false, released = null;
  w.env.MIND_DOCS.get = async k => { if (k === wmKey) { reading = true; await new Promise(r => { released = r; }); } return get0(k); };
  try {
    const job = await renderJob(P, A, { finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }] });
    const stepP = call('POST', '/studio/job/step', { id: job.id });
    await until(() => reading, 6000, 'the mark file read');
    eq((await call('POST', '/studio/job/cancel', { id: job.id })).body.job.state, 'cancelled');
    released(); await stepP; await sleep(100);
    eq(gem.calls.length, 0, 'nothing was sent to the image model (was ' + gem.calls.length + ')');
    const j = await getJob(job.id); eq(j.state, 'cancelled'); eq((j.cancel || {}).inFlight || 0, 0, 'nothing in flight to recall');
  } finally { w.env.MIND_DOCS.get = get0; }
});

// ------------------------------------------------------------------------------------------------ S24-02 attempts and accounting
const budget = async () => (await call('GET', '/studio/budget', null, 'read-key')).body;
await T.t('02a one end-to-end policy: a render refused with 503 every time sends at most the published number of image requests, across every job attempt', async () => {
  const b0 = await budget(); const pol = b0.policy && b0.policy.image;
  ok(pol && pol.requestsPerJob >= 1 && pol.requestsPerJob <= 4, '/studio/budget publishes the image policy: ' + JSON.stringify(b0.policy));
  const { P, A } = await fresh('national'); resetGem(); gem.dflt = { status: 503 };
  const job = await renderJob(P, A); const j = await runOut(job.id);
  eq(j.state, 'failed', 'the job ends failed, with the reason: ' + j.error);
  ok(gem.calls.length <= pol.requestsPerJob, gem.calls.length + ' image requests for one job (policy ' + pol.requestsPerJob + '): ' + gem.calls.map(c => c.model).join(', '));
  const b1 = await budget(); const im1 = b1.image || {}, im0 = b0.image || {};
  eq((im1.requests || 0) - (im0.requests || 0), gem.calls.length, 'the image ledger counts every request sent: ' + JSON.stringify(b1.image));
  ok((im1.retries || 0) - (im0.retries || 0) >= 1, 'retries are counted');
  ok(Array.isArray(j.requests) && j.requests.length === gem.calls.length && j.requests.every(x => x.kind === 'image' && x.outcome === 'http_503'), 'the job records each request with its outcome: ' + JSON.stringify(j.requests));
});
await T.t('02b a request whose answer never came is recorded as unknown, not as failed or free; a malformed answer is named', async () => {
  const { P, A } = await fresh('national'); resetGem(); gem.script = [{ throw: 'fetch failed' }, { malformed: true }]; gem.dflt = { ok: true };
  const b0 = await budget();
  const j = await runOut((await renderJob(P, A)).id);
  eq(j.state, 'done', j.error);
  const outs = (j.requests || []).map(x => x.outcome); eq(outs, ['unknown', 'malformed', 'ok'], 'outcomes in order: ' + JSON.stringify(j.requests));
  const b1 = await budget(); eq((b1.image.unknown || 0) - ((b0.image || {}).unknown || 0), 1, 'the ledger keeps the unknown outcome: ' + JSON.stringify(b1.image));
  eq((b1.image.confirmed || 0) - ((b0.image || {}).confirmed || 0), 1, 'one image confirmed');
});
await T.t('02c progress names the request in flight and the model: "request 2 of N", the fallback when it is one', async () => {
  const { P, A } = await fresh('national'); resetGem(); gem.script = [{ status: 404 }, { hold: true, then: { ok: true } }];
  const job = await renderJob(P, A);
  const stepP = call('POST', '/studio/job/step', { id: job.id });
  await until(() => gem.calls.length === 2, 6000, 'the second request');
  await sleep(80);
  const act = ((await getJob(job.id)).progress || {}).activity || {};
  eq([act.request, act.model, !!act.fallback], [2, gem.calls[1].model, true], 'the activity names request 2, its model, and that it is a fallback: ' + JSON.stringify(act));
  ok(/request 2 of \d/.test(act.label || ''), 'the label says it: ' + act.label);
  gem.release(); const r = await stepP; eq(r.body.job.state, 'done');
});
await T.t('02d a live-test allowance is enforced on the server before every dispatch: the render, its retries and a second job in the project stop at it', async () => {
  const al = await call('POST', '/studio/allowance', { label: 'S24 smoke', calls: 2, images: 1, hours: 2 });
  eq(al.status, 200, JSON.stringify(al.body)); const AL = al.body.allowance && al.body.allowance.id; ok(AL, 'an allowance id');
  eq((await call('POST', '/studio/allowance', { label: 'x', calls: 1, images: 1 }, 'read-key')).status, 403, 'a read key cannot grant spend');
  const { P, A } = await fresh('national', { allowance: AL }); resetGem(); gem.dflt = { status: 503 };
  const j1 = await runOut((await renderJob(P, A)).id);
  eq(gem.calls.length, 1, 'one image request, the allowance');
  ok(j1.state === 'failed' && /allowance_exhausted/.test(j1.error) && /not retried/.test(j1.error), 'the job stops at the allowance, not retried: ' + j1.error);
  const j2 = await runOut((await renderJob(P, A)).id);
  eq(gem.calls.length, 1, 'a second job in the project sends nothing'); ok(/allowance_exhausted/.test(j2.error), j2.error);
  const v = (await call('GET', '/studio/allowance?id=' + AL, null, 'read-key')).body.allowance;
  eq([v.images.used, v.images.cap], [1, 1], 'the allowance reads back what was spent: ' + JSON.stringify(v));
});
await T.t('02e concurrent runners on two projects that share an allowance of one image send one request between them', async () => {
  const AL = (await call('POST', '/studio/allowance', { label: 'S24 concurrent', calls: 0, images: 1, hours: 1 })).body.allowance.id;
  const a = await fresh('national', { allowance: AL }), b = await fresh('national', { allowance: AL }); resetGem();
  gem.script = [{ hold: true, then: { ok: true } }, { hold: true, then: { ok: true } }];
  const ja = await renderJob(a.P, a.A), jb = await renderJob(b.P, b.A);
  w.slowReads(15);
  const both = Promise.all([call('POST', '/studio/job/step', { id: ja.id }), call('POST', '/studio/job/step', { id: jb.id })]);
  await sleep(600); w.slowReads(0);
  if (gem.release) gem.release();
  await both; await sleep(50);
  eq(gem.calls.length, 1, 'one image request between the two runners (was ' + gem.calls.length + ')');
});
await T.t('02f text dispatches charge the allowance too, and a child job inherits its project\'s allowance', async () => {
  const AL = (await call('POST', '/studio/allowance', { label: 'S24 text', calls: 1, images: 0, hours: 1 })).body.allowance.id;
  const { P, A } = await fresh('national', { allowance: AL }); const n0 = suggestCalls().length;
  const s1 = (await call('POST', '/studio/suggest', { asset: A, job: true })).body.job; const r1 = await runOut(s1.id); eq(r1.state, 'done', r1.error);
  const s2 = (await call('POST', '/studio/suggest', { asset: A, job: true, refresh: true })).body.job; const r2 = await runOut(s2.id);
  eq(suggestCalls().length - n0, 1, 'one text call reached the model');
  ok(r2.state === 'failed' && /allowance_exhausted/.test(r2.error), 'the second stops at the allowance: ' + r2.error);
});

// ------------------------------------------------------------------------------------------------ S24-03 suggestion fingerprint
await T.t('03 the suggestion fingerprint covers what the prompt is made from: each reference record change, an artwork description edit and an example classification outdate advice and name what changed; an irrelevant change does not', async () => {
  const { P, A } = await fresh('hoof');
  analysisNext = ANALYSIS();
  const R = (await call('POST', '/studio/reference', { project: P, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof', meta: { approval: { state: 'approved', date: '2026-09-30', by: 'Dee' } } })).body.id;
  await call('GET', '/engine/status?ns=mca', null, 'read-key');   // creates engine_art
  await w.env.MIND_DB.prepare("INSERT INTO engine_art(id, ns, title, key, mime, description, meta, docId, who, created) VALUES('art1','mca','March tile','','image/png','A teal band over a dusk road','{\"campaign\":\"hoof\"}','','t',?)").bind(Date.now()).run();
  await call('GET', '/mind/unclassified?namespace=mca');   // creates mind_docs with its classification columns
  await w.env.MIND_DB.prepare("INSERT INTO mind_docs(id, ns, title, kind, source, dt, chunks, created, campaign, approval, scope) VALUES('doc1','mca','Approved caption','copy','pack:mca:hoof:fb:x','',1,?,'hoof','approved','campaign')").bind(Date.now()).run();
  const fresh0 = async () => { const r = await call('POST', '/studio/suggest', { asset: A }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200)); return r.body; };
  const peek = async () => (await call('GET', '/studio/suggest?asset=' + A, null, 'read-key')).body;
  let n = suggestCalls().length; await fresh0(); eq(suggestCalls().length, n + 1, 'the first ask makes a call');
  await fresh0(); eq(suggestCalls().length, n + 1, 'asked again in the same context: the cached advice, no call');
  const obsOf = async () => ((await w.env.MIND_DB.prepare('SELECT meta FROM studio_references WHERE id=?').bind(R).first()) ? JSON.parse((await w.env.MIND_DB.prepare('SELECT meta FROM studio_references WHERE id=?').bind(R).first()).meta || '{}').observations || [] : []);
  const cases = [
    ['approval rejected', /reference record/, () => call('POST', '/studio/reference/meta', { id: R, approval: { state: 'rejected', date: '2026-10-01', by: 'Dee' } })],
    ['a dislike', /reference record/, () => call('POST', '/studio/reference/meta', { id: R, dislikes: [{ text: 'The URL too small', evidence: 'client round 2' }] })],
    ['a like', /reference record/, () => call('POST', '/studio/reference/meta', { id: R, likes: [{ text: 'The bold band', evidence: 'Dee' }] })],
    ['an observation corrected', /reference record/, async () => { const o = (await obsOf()).find(x => x.area === 'typography'); return call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'correct', text: 'Extra bold condensed sans', why: 'the pass called it light' }); }],
    ['an observation retired', /reference record/, async () => { const o = (await obsOf()).find(x => x.area === 'composition'); return call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'retire', why: 'a one-off' }); }],
    ['an artwork description edited', /artwork/, () => w.env.MIND_DB.prepare("UPDATE engine_art SET description='A gold band over a harbour' WHERE id='art1'").run()],
    ['an example re-classified', /example/, () => call('POST', '/mind/classify', { docId: 'doc1', campaign: 'hoof', approval: 'rejected', scope: 'campaign' })],
  ];
  for (const [label, part, fn] of cases) {
    const r = await fn(); if (r && r.status) eq(r.status, 200, label + ': ' + JSON.stringify(r.body).slice(0, 160));
    const pk = await peek();
    ok(pk.outdated === true, label + ': the cached advice reads as outdated (' + JSON.stringify({ outdated: pk.outdated, changed: pk.changed }) + ')');
    ok((pk.changed || []).some(x => part.test(x)), label + ': it says what changed: ' + JSON.stringify(pk.changed));
    n = suggestCalls().length; const again = await fresh0(); eq([again.cached, suggestCalls().length], [false, n + 1], label + ': asking again makes a new call');
  }
  // the same record saved again (only the time and the person differ): the advice stands
  await call('POST', '/studio/reference/meta', { id: R, likes: [{ text: 'The bold band', evidence: 'Dee' }] }, 'full-key');
  const pk = await peek(); eq(pk.outdated, false, 'an unchanged record re-saved does not outdate advice: ' + JSON.stringify(pk.changed));
});

// ------------------------------------------------------------------------------------------------ S24-04 approval is not purpose
await call('POST', '/brand/kit', { ns: 'pca', name: 'Property Council', palette: { primary: '#223344' }, campaigns: [{ id: 'homes', name: 'Homes', logoPolicy: 'logo' }, { id: 'towns', name: 'Towns', logoPolicy: 'logo' }] });
await call('POST', '/brand/kit', { ns: 'pca', logoB64: PNG_LOGO, logoMime: 'image/png' });
const addRef = async (P, name, corner, approval, campaign, purpose) => { analysisNext = ANALYSIS({ logo: 'Logo ' + ({ br: 'bottom right', tl: 'top left', bl: 'bottom left', tr: 'top right' })[corner], mark: { present: true, kind: 'logo', corner, size: 'a fifth', clearSpace: 'half' } }); const r = await call('POST', '/studio/reference', { project: P, name, purpose: purpose || 'approved', imageB64: PNG, mime: 'image/png', campaign, meta: approval ? { approval: { state: approval, date: '2026-09-30', by: 'client' } } : undefined }); eq(r.status, 200); return r.body.id; };
await T.t('04a a reference rejected by the client is not an approved design: it never votes on placement, sits under AVOID in the prompt and is not sent to the image model as a constraint', async () => {
  const { P, A } = await fresh('homes', null, 'pca');
  const R1 = await addRef(P, 'Rejected tile one', 'br', 'rejected', 'homes'), R1b = await addRef(P, 'Rejected tile two', 'br', 'rejected', 'homes'), R2 = await addRef(P, 'Approved tile', 'tl', 'approved', 'homes');
  const ws = (await call('GET', '/brand/workspace?ns=pca&campaign=homes', null, 'read-key')).body;
  eq(ws.placement.corner, 'tl', 'the approved reference decides the corner: ' + ws.placement.text);
  ok(!ws.placement.evidence.some(e => e.ref === R1 || e.ref === R1b), 'rejected references are not evidence: ' + JSON.stringify(ws.placement.evidence.map(e => [e.name, e.corner, e.approval])));
  ok((ws.placement.avoid || []).some(e => e.ref === R1), 'they are named as what to avoid: ' + JSON.stringify(ws.placement.avoid));
  const before = anth.calls.length; await call('POST', '/studio/suggest', { asset: A, refresh: true });
  const u = anth.calls.slice(before).find(c => /suggesting the next things/.test(c.sys)).user;
  const seg = (s, head) => { const i = s.indexOf(head); if (i < 0) return ''; const rest = s.slice(i + head.length); const j = rest.search(/\\n[A-Z][A-Z ,()]+[:-]/); return j < 0 ? rest : rest.slice(0, j); };
  ok(seg(u, 'APPROVED DESIGNS').indexOf(R2) >= 0 && seg(u, 'APPROVED DESIGNS').indexOf(R1) < 0, 'only the approved tile is under Approved designs');
  ok(/AVOID/.test(u) && seg(u, 'AVOID').indexOf(R1) >= 0, 'the rejected tiles are under AVOID');
  resetGem(); const j = await runOut((await renderJob(P, A, { referenceIds: [{ id: R1, role: 'composition' }, { id: R2, role: 'composition' }] })).id); eq(j.state, 'done', j.error);
  const v = (await call('GET', '/studio/get?id=' + P, null, 'read-key')).body.assets.find(x => x.id === A); const cur = v.versions.find(x => x.id === v.current);
  ok(!(cur.image.meta.attached || []).some(x => /Rejected/.test(x.name || '')), 'the rejected reference was not attached: ' + JSON.stringify(cur.image.meta.attached));
  ok((cur.image.meta.excludedRefs || []).some(x => x.id === R1 && /rejected/i.test(x.reason)), 'its exclusion is recorded with the reason: ' + JSON.stringify(cur.image.meta.excludedRefs));
});
await T.t('04b a person\'s correction of where the mark sits outranks the vision pass: placement, the recommendation and the prompt follow it, the original kept as superseded', async () => {
  const { P, A } = await fresh('towns', null, 'pca');
  const R3 = await addRef(P, 'Approved towns tile', 'br', 'approved', 'towns');
  const meta = JSON.parse((await w.env.MIND_DB.prepare('SELECT meta FROM studio_references WHERE id=?').bind(R3).first()).meta);
  const lo = meta.observations.find(o => o.area === 'logo'); ok(lo, 'the vision pass seeded the mark observation');
  eq((await call('POST', '/studio/reference/observation', { id: R3, obs: lo.id, action: 'correct', text: 'Logo top left, a fifth of the width', why: 'the client confirmed: the tile ran with the logo top left' })).status, 200);
  const ws = (await call('GET', '/brand/workspace?ns=pca&campaign=towns', null, 'read-key')).body;
  eq(ws.placement.corner, 'tl', 'placement follows the correction: ' + ws.placement.text);
  const ev = ws.placement.evidence.find(e => e.ref === R3); eq([ev && ev.corner, ev && ev.basis], ['tl', 'team'], 'the evidence row is the team\'s: ' + JSON.stringify(ev));
  const inv = (await call('GET', '/brand/teach/inspect?ns=pca&campaign=towns', null, 'read-key')).body; const pl = (inv.proposals || []).find(x => x.kind === 'placement');
  ok(!pl || pl.proposal.corner === 'tl', 'Teach this brand proposes the corrected corner: ' + JSON.stringify(pl));
  const before = anth.calls.length; await call('POST', '/studio/suggest', { asset: A, refresh: true });
  const u = anth.calls.slice(before).find(c => /suggesting the next things/.test(c.sys)).user; const line = (u.split('\\n').find(l => l.indexOf('[' + R3 + ']') >= 0) || '');
  ok(/top left/.test(line), 'the reference line carries the correction: ' + line.slice(0, 400));
  ok(!/bottom right/.test(line) || /superseded/i.test(line), 'the vision pass\'s corner is not presented as current: ' + line.slice(0, 400));
});

await T.t('04c placement evidence speaks for the format being made: a story-format reference outweighs a square one for a story tile, and the other way round', async () => {
  const an = c => ({ summary: 's', logo: 'x', mark: { present: true, kind: 'logo', corner: c } });
  const rows = [{ id: 'rs', name: 'Story tile', purpose: 'approved', analysis: an('tl'), meta: { format: '9:16', approval: { state: 'approved' } } }, { id: 'rq', name: 'Square tile', purpose: 'approved', analysis: an('br'), meta: { format: '1:1', approval: { state: 'approved' } } }];
  const pe = w.mod.__test.stPlacementEvidence;
  eq(pe(rows, {}, '', { format: '9:16' }).corner, 'tl', 'for a story, the story reference');
  eq(pe(rows, {}, '', { format: '1:1' }).corner, 'br', 'for a square, the square reference');
  ok(pe(rows, {}, '', { format: '9:16' }).evidence.find(e => e.ref === 'rs').sameFormat, 'the evidence says which row matched the format');
});

// ------------------------------------------------------------------------------------------------ S24-05 observation lifecycle
const fixesFor = async (ns, campaign) => (await w.env.MIND_DB.prepare("SELECT id, rule, active, source, why FROM engine_fixes WHERE ns=? AND source LIKE ? ORDER BY created").bind(ns, '%:campaign:' + campaign).all()).results || [];
await T.t('05a retire, restore, correct and promote again cannot leave two active rules: each step that touches a rule asks, and supersession is explicit with its provenance', async () => {
  await call('POST', '/brand/kit', { ns: 'pca', campaigns: [{ id: 'homes', name: 'Homes', logoPolicy: 'logo' }, { id: 'towns', name: 'Towns', logoPolicy: 'logo' }, { id: 'life', name: 'Life', logoPolicy: 'logo' }] });
  const { P } = await fresh('life', null, 'pca');
  const R = await addRef(P, 'Approved life tile', 'br', 'approved', 'life');
  const add = await call('POST', '/studio/reference/observation', { id: R, action: 'add', area: 'logo', text: 'Logo top left', authority: 'observed', why: 'seen on the tile' }); eq(add.status, 200);
  const o = add.body.item;
  const teach = b => call('POST', '/brand/teach', Object.assign({ ns: 'pca', campaign: 'life', kind: 'rule', confirm: true, reason: 'confirmed by the client' }, b));
  const t1 = await teach({ proposal: { observation: { ref: R, obs: o.id } } }); eq(t1.status, 200, JSON.stringify(t1.body).slice(0, 300)); const F1 = t1.body.fix.id;
  const t1b = await teach({ proposal: { observation: { ref: R, obs: o.id } } });
  eq([t1b.status, t1b.body.fix && t1b.body.fix.id, !!t1b.body.existing], [200, F1, true], 'promoting the same observation again returns the same rule: ' + JSON.stringify(t1b.body).slice(0, 200));
  eq((await fixesFor('pca', 'life')).filter(f => f.active).length, 1, 'no duplicate rule');
  const r0 = await call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'retire', why: 'one-off' });
  eq([r0.status, r0.body.error], [409, 'rule_choice'], 'retiring promoted evidence asks what happens to its rule: ' + JSON.stringify(r0.body).slice(0, 300));
  ok(/rule/.test(r0.body.detail || '') && Array.isArray(r0.body.options), 'the consequence is said, with the choices');
  eq((await call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'retire', why: 'one-off', rule: 'keep' })).status, 200);
  ok((await fixesFor('pca', 'life')).find(f => f.id === F1).active, 'keep: the rule stands without this evidence');
  const rs = await call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'restore' }); eq(rs.status, 200);
  eq(rs.body.item.status, 'promoted', 'restored while its rule still stands, it is the rule\'s evidence again (promoted), not a free observation');
  const c0 = await call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'correct', text: 'Logo bottom left', why: 'the client moved it' });
  eq([c0.status, c0.body.error], [409, 'promoted'], 'a correction cannot rewrite the evidence under a standing rule silently');
  const c1 = await call('POST', '/studio/reference/observation', { id: R, obs: o.id, action: 'correct', text: 'Logo bottom left', why: 'the client moved it', rule: 'supersede' });
  eq(c1.status, 200, JSON.stringify(c1.body).slice(0, 300));
  const fx = await fixesFor('pca', 'life'); const act = fx.filter(f => f.active);
  eq(act.length, 1, 'exactly one active rule: ' + JSON.stringify(fx.map(f => [f.id, f.active, f.rule])));
  ok(/bottom left/.test(act[0].rule) && act[0].id !== F1, 'the active rule is the corrected one');
  const old = await w.env.MIND_DB.prepare('SELECT origin FROM engine_fixes WHERE id=?').bind(F1).first(); ok(/superseded/.test(String(old && old.origin)), 'the old rule records its supersession: ' + (old && old.origin));
});
await T.t('05b existing contradictory rules are detected and named, never deleted', async () => {
  await call('POST', '/brand/kit', { ns: 'pca', campaigns: [{ id: 'homes', name: 'Homes', logoPolicy: 'logo' }, { id: 'towns', name: 'Towns', logoPolicy: 'logo' }, { id: 'life', name: 'Life', logoPolicy: 'logo' }, { id: 'old', name: 'Old', logoPolicy: 'logo' }] });
  const now = Date.now();
  for (const [id, rule, obs] of [['fx_old_a', 'Mark on Old: Logo top left', 'oa'], ['fx_old_b', 'Mark on Old: Logo bottom left', 'ob']]) await w.env.MIND_DB.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES(?,'pca','tiles','client','',?,?,?,'','teach:brand:campaign:old','t',?,1,0)").bind(id, rule, 'confirmed (taught from the reference "X" [rx], observation ' + obs + ', observed)', rule, now).run();
  const ws = (await call('GET', '/brand/workspace?ns=pca&campaign=old', null, 'read-key')).body;
  const cf = (ws.readiness.conflicts || []).find(c => c.code === 'rule_conflict');
  ok(cf && /fx_old_a/.test(JSON.stringify(cf)) && /fx_old_b/.test(JSON.stringify(cf)), 'the contradiction is named with both rules: ' + JSON.stringify(ws.readiness.conflicts));
  eq((await fixesFor('pca', 'old')).filter(f => f.active).length, 2, 'nothing was deleted or switched off by itself');
});
await T.t('05c two edits to one reference at the same moment both survive', async () => {
  const { P } = await fresh('life', null, 'pca'); const R = await addRef(P, 'Concurrent tile', 'br', 'approved', 'life');
  const meta = JSON.parse((await w.env.MIND_DB.prepare('SELECT meta FROM studio_references WHERE id=?').bind(R).first()).meta);
  const ty = meta.observations.find(o => o.area === 'typography');
  w.slowReads(30);
  const [a, b] = await Promise.all([
    call('POST', '/studio/reference/observation', { id: R, obs: ty.id, action: 'correct', text: 'Heavy grotesque', why: 'checked' }),
    call('POST', '/studio/reference/observation', { id: R, action: 'add', area: 'url', text: 'URL bottom left in white', authority: 'observed', why: 'seen' }),
  ]);
  w.slowReads(0);
  ok(a.status === 200 || a.status === 409, 'first answered: ' + a.status); ok(b.status === 200 || b.status === 409, 'second answered: ' + b.status);
  const m2 = JSON.parse((await w.env.MIND_DB.prepare('SELECT meta FROM studio_references WHERE id=?').bind(R).first()).meta);
  const okA = a.status !== 200 || m2.observations.some(o => o.id === ty.id && o.text === 'Heavy grotesque');
  const okB = b.status !== 200 || m2.observations.some(o => o.area === 'url' && o.text === 'URL bottom left in white');
  ok(okA && okB, 'every edit that answered 200 is in the stored record (a refused one said so): ' + JSON.stringify([a.status, b.status]));
  ok(a.status === 200 || b.status === 200, 'at least one went through');
});

// ------------------------------------------------------------------------------------------------ S24-06 mark sources
await T.t('06 a mark comes only from this client\'s own stored file: an outside origin, a protocol-relative look-alike, a repeated parameter, a variant or revision not in storage are refused; the canonical source passes', async () => {
  const { P, A } = await fresh('hoof');
  const k = await kitNow(); const wm = k.campaigns.find(c => c.id === 'hoof').wordmarks.find(x => x.variant === 'white');
  const layerWith = src => Object.assign({}, LAYOUT, { layers: LAYOUT.layers.concat([{ id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', src, x: 70, y: 88, w: 24, h: 7, fit: 'contain', exact: true }]) });
  const save = src => call('POST', '/studio/version', { asset: A, project: P, layout: layerWith(src), note: 'mark' });
  for (const bad of ['https://untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof', '//untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof', 'https://untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + wm.v, '/brand/wordmark?ns=mca&campaign=hoof&ns=pca', '/brand/wordmark?ns=mca&campaign=hoof&variant=blue', '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=999999', 'data:image/png;base64,' + PNG_MARK, '/studio/file?key=' + encodeURIComponent(wmKey)]) {
    const r = await save(bad); eq([r.status, r.body.error], [409, 'mark_policy'], bad + ': ' + JSON.stringify(r.body).slice(0, 200));
  }
  const good = await save('/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + wm.v); eq(good.status, 200, 'the canonical source passes: ' + JSON.stringify(good.body).slice(0, 200));
  // creation is held to the same rule as editing
  const c = await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Bad mark', copy: { headline: 'x' }, layout: layerWith('https://untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof'), mode: 'composition' });
  eq([c.status, c.body.error], [409, 'mark_policy'], 'a new asset with an outside mark is refused: ' + JSON.stringify(c.body).slice(0, 200));
});
await T.t('06b an old version with an invalid mark source stays recoverable: restored with the mark hidden and the reason, and readiness explains it', async () => {
  const { P, A } = await fresh('hoof');
  const a = (await call('GET', '/studio/get?id=' + P, null, 'read-key')).body.assets.find(x => x.id === A); const v0 = a.versions.find(x => x.id === a.current);
  const legacy = Object.assign({}, LAYOUT, { layers: LAYOUT.layers.concat([{ id: 'wordmark', type: 'img', role: 'wordmark', src: 'https://untrusted.invalid/brand/wordmark?ns=mca&campaign=hoof', x: 70, y: 88, w: 24, h: 7 }]) });
  await w.env.MIND_DB.prepare('UPDATE studio_versions SET layout=? WHERE id=?').bind(JSON.stringify(legacy), v0.id).run();
  const rd = (await call('GET', '/studio/readiness?asset=' + A, null, 'read-key')).body;
  ok(JSON.stringify(rd).indexOf('mark_source_invalid') >= 0, 'readiness names the invalid source: ' + JSON.stringify(rd).slice(0, 400));
  await call('POST', '/studio/version', { asset: A, project: P, copy: { headline: 'Moved on' }, note: 'text' });
  const r = await call('POST', '/studio/version', { asset: A, project: P, restoreFrom: v0.id }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const m = r.body.version.layout.layers.find(l => l.role === 'wordmark');
  eq([!!m.hidden, !!m.invalidSource], [true, true], 'the restored mark is hidden and flagged: ' + JSON.stringify(m));
  ok(/mark/.test(r.body.version.note || ''), 'the note says why: ' + r.body.version.note);
});

T.done(); w.restore();
