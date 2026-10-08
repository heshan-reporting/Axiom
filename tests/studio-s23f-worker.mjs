/* S23 slice F on the worker (providers MOCKED, streams built byte for byte): every long operation is visible and recoverable.
 *   F1 while the model writes, the job's activity carries a "Drafting" preview built only from values that have finished
 *      arriving - never a value still being written, never the reasoning - and the preview is gone when the job ends;
 *   F2 suggestions run as a job (phase, stream, retry, cancel like every stage); asking twice for one version is one job;
 *   F3 a reference upload can queue its vision pass as a job instead of holding the upload request open;
 *   F4 a render says what it is making while it runs: the direction, the references offered, the marks, the size;
 *   F5 a runner that dies mid-call is recovered by the tick with no tab open: the lease runs out, the cron claims the job as
 *      attempt 2 and finishes it, and the dead attempt's late answer files nothing.
 * Run: node --experimental-sqlite tests/studio-s23f-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s23f-worker (long operations: drafting preview, jobs for every model call, render details, recovery without a tab)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const png = byte => Buffer.from('89504e470d0a1a0a' + byte.repeat(100), 'hex').toString('base64');
const PNG = png('00'), PNG_REF = png('33');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const job = async id => (await call('GET', '/studio/job?id=' + id)).body.job;

/* Claude: a scripted stream (frames with pauses), or a plain JSON answer */
const frame = (type, data) => 'event: ' + type + '\ndata: ' + JSON.stringify(Object.assign({ type }, data || {})) + '\n\n';
const anth = { plan: null, calls: 0, json: null };
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  anth.calls++;
  if (anth.plan) { const plan = anth.plan; let stopped = false; if (init && init.signal) init.signal.addEventListener('abort', () => { stopped = true; });
    return new Response(new ReadableStream({ async start(c) { for (const st of plan) { if (stopped) return; if (st.wait) await sleep(st.wait); if (stopped) return; try { c.enqueue(new TextEncoder().encode(st.bytes)); } catch (e) { return; } } try { c.close(); } catch (e) {} } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } }); }
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(anth.json || { summary: 'A tidy reference', typography: 'sans' }) }], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 5, output_tokens: 5 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
/* Gemini: answers an image; `gem.hold` keeps every request waiting until released; `gem.holdFirst` only the next one */
const gem = { calls: 0, hold: null, holdFirst: null };
w.answer(/generativelanguage/, async () => { gem.calls++; if (gem.holdFirst) { const h = gem.holdFirst; gem.holdFirst = null; await h.p; } if (gem.hold) await gem.hold.p; return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 }); });
const holdGem = () => { let r; gem.hold = { p: new Promise(x => { r = x; }) }; return () => { const h = gem.hold; gem.hold = null; r(); return h; }; };
const holdFirstGem = () => { let r; gem.holdFirst = { p: new Promise(x => { r = x; }) }; return () => { gem.holdFirst = null; r(); }; };

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
await call('POST', '/brand/kit', { ns: 'mca', wordmarkB64: png('22'), wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const wmKey = Array.from(w.r2.keys()).find(k => /^brand\/mca\/wordmark\/hoof@/.test(k));
const LAYOUT = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }] };
const fresh = async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'F ' + Math.random().toString(36).slice(2, 7), brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
  const A = (await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: LAYOUT, mode: 'composition' })).body.asset.id;
  return { P, A };
};

await T.t('F1 while the answer streams the activity carries a Drafting preview of finished values only, never the reasoning; it is gone when the job ends', async () => {
  const { A } = await fresh();
  const start = frame('message_start', { message: { model: 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 1 } } });
  anth.plan = [{ bytes: start }, { bytes: frame('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } }) }, { bytes: frame('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'SECRET-REASONING about the tile' } }) }, { bytes: frame('content_block_stop', { index: 0 }) },
    { bytes: frame('content_block_start', { index: 1, content_block: { type: 'text', text: '' } }) },
    { bytes: frame('content_block_delta', { index: 1, delta: { type: 'text_delta', text: '{"design":[{"text":"DRAFT-ONE make the headline larger","why":"w"},{"text":"DRAFT-TW' } }), wait: 50 },
    { bytes: frame('ping', {}), wait: 1300 }, { bytes: frame('ping', {}), wait: 900 },
    { bytes: frame('content_block_delta', { index: 1, delta: { type: 'text_delta', text: 'O tighten the support","why":"w"}],"image":[]}' } }), wait: 1200 },
    { bytes: frame('content_block_stop', { index: 1 }) }, { bytes: frame('message_delta', { delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 40 } }) }, { bytes: frame('message_stop', {}) }];
  try {
    const q = await call('POST', '/studio/suggest', { asset: A, job: true }); eq(q.status, 200, JSON.stringify(q.body)); const J = q.body.job;
    const stepping = call('POST', '/studio/job/step', { id: J.id });
    let seen = null;
    for (let i = 0; i < 60 && !seen; i++) { await sleep(100); const j = await job(J.id); const d = ((j.progress || {}).activity || {}).draft; if (d && d.lists && d.lists.length) seen = d; }
    ok(seen, 'a drafting preview appeared while the model wrote');
    const items = (seen.lists.find(l => l.key === 'design') || {}).items || [];
    eq(items, ['DRAFT-ONE make the headline larger'], 'only the finished item; the one still being written is not shown');
    ok(!/SECRET-REASONING/.test(JSON.stringify(seen)), 'the reasoning never reaches the preview');
    ok(JSON.stringify(seen).length <= 8192, 'within 8 KB');
    const r = await stepping; eq(r.body.job.state, 'done', r.body.job.error);
    const end = await job(J.id); ok(!((end.progress || {}).activity || {}).draft, 'the preview is not kept with the finished job');
    const pk = (await call('GET', '/studio/suggest?asset=' + A)).body; eq(pk.design.map(d => d.text), ['DRAFT-ONE make the headline larger', 'DRAFT-TWO tighten the support'], 'the filed answer is the whole answer');
  } finally { anth.plan = null; }
});
await T.t('F2 suggestions are a job: the same version asked twice is one job; the result says what was filed', async () => {
  const { A } = await fresh(); anth.json = { design: [{ text: 'Use the teal panel', why: 'rule' }], image: [] };
  try {
    const a = await call('POST', '/studio/suggest', { asset: A, job: true }), b = await call('POST', '/studio/suggest', { asset: A, job: true });
    eq(a.body.job.id, b.body.job.id, 'one job for one version'); eq(b.body.existing, true);
    const r = await call('POST', '/studio/job/step', { id: a.body.job.id }); eq(r.body.job.state, 'done', r.body.job.error); eq(r.body.job.result.counts.design, 1);
    eq((await call('POST', '/studio/suggest', { asset: A, job: true }, 'read-key')).status, 403, 'a read key cannot queue a model call');
  } finally { anth.json = null; }
});
await T.t('F3 an upload queues its reference analysis as a job; the upload answers at once', async () => {
  const { P } = await fresh(); const n0 = anth.calls;
  const up = await call('POST', '/studio/reference', { project: P, name: 'Approved tile', purpose: 'approved', imageB64: PNG_REF, mime: 'image/png', analyse: 'job' });
  eq(up.status, 200, JSON.stringify(up.body)); ok(up.body.job && up.body.job.stage === 'refanalyse', 'the analysis is a job: ' + JSON.stringify(up.body.job)); eq(anth.calls, n0, 'no model call inside the upload');
  const r = await call('POST', '/studio/job/step', { id: up.body.job.id }); eq(r.body.job.state, 'done', r.body.job.error); eq(r.body.job.result.ok, true);
  const row = await w.env.MIND_DB.prepare('SELECT analysis FROM studio_references WHERE id=?').bind(up.body.id).first(); ok(/tidy reference/.test(row.analysis), 'the analysis is filed');
});
await T.t('F4 a render reports what it is making while the image model works: direction, references offered, marks, size', async () => {
  const { P, A } = await fresh(); const release = holdGem();
  try {
    const q = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'Paint the HOOF myth tile: a fuel bowser at dusk, the headline in the quiet sky', finished: true, approach: 'artwork', marks: [{ role: 'wordmark', key: wmKey, name: 'HOOF wordmark' }], references: [{ data: PNG_REF, mime: 'image/png', role: 'mood', name: 'Dusk mood' }], aspect: '1:1', size: '2K' }, idem: 'f4' });
    const stepping = call('POST', '/studio/job/step', { id: q.body.job.id });
    let a = null; for (let i = 0; i < 40 && !a; i++) { await sleep(60); const j = await job(q.body.job.id); const x = (j.progress || {}).activity || {}; if (x.phase === 'generating' && x.render) a = x.render; }
    ok(a, 'the render details were reported while generating');
    ok(/fuel bowser at dusk/.test(a.direction) && a.direction.length <= 240, 'the direction: ' + a.direction);
    eq(a.references, ['Dusk mood']); eq(a.marks, ['wordmark']); eq(a.size, '2K');
    release(); const r = await stepping; eq(r.body.job.state, 'done', r.body.job.error);
  } finally { if (gem.hold) release(); }
});
await T.t('F5 a runner that dies mid-call is recovered by the tick with no tab open; the dead attempt files nothing', async () => {
  const { P, A } = await fresh(); const g0 = gem.calls; const releaseDead = holdFirstGem();
  const q = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road at dusk', region: 'bg', aspect: '1:1' }, idem: 'f5' }); const id = q.body.job.id;
  const dead = call('POST', '/studio/job/step', { id });   // the runner that will "die": its provider call never answers in time
  for (let i = 0; i < 40; i++) { await sleep(40); if ((await job(id)).state === 'running' && gem.calls > g0) break; }
  eq((await job(id)).attempts, 1);
  // the runner is gone: its lease runs out (simulated by moving it into the past); the provider answers new requests at once
  await w.env.MIND_DB.prepare('UPDATE studio_jobs SET lease_until=? WHERE id=?').bind(Date.now() - 1000, id).run();
  await w.handler.scheduled({ cron: '7,37 * * * *', scheduledTime: Date.now() }, w.env, w.ctx); await w.settle();
  const j = await job(id); eq([j.state, j.attempts], ['done', 2], 'the tick finished it as attempt 2');
  const vers0 = (await call('GET', '/studio/get?id=' + P)).body.assets.find(x => x.id === A).versions.length;
  releaseDead(); await dead.catch(() => null); await sleep(50);
  const vers1 = (await call('GET', '/studio/get?id=' + P)).body.assets.find(x => x.id === A).versions.length;
  eq(vers1, vers0, 'the dead attempt\'s late answer filed no version');
});

T.done(); w.restore();
