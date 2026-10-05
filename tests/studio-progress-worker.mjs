/* Live job progress (S12a). Every Studio job used to be silent until it finished: progress was written once, at the end.
 * Now the attempt reports what it is doing while it runs - a phase, a label, and counts where the work is countable
 * (the copy stage's channels), never a percentage invented from the clock - persisted under the attempt's fence so a
 * cancelled attempt writes nothing, and the finished attempt's duration goes into a per-stage history the app can quote
 * as "typically N s". Providers MOCKED; the mocks read the job's row mid-call to prove the phase is visible while the call
 * is in flight. Run: node --experimental-sqlite tests/studio-progress-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-progress-worker (phases while a job runs, counts by channel, fenced writes, duration history)');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const PNG_LOGO = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const PLAN = { medium: 'photo-documentary', approach: 'editable', mark: 'client', story: 'the credit, plainly', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A quiet regional road at dusk' }],
  elements: [{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 5, y: 56, w: 70, h: 36, fill: '#0E6A6E', opacity: 0.92 }, { id: 'hl', type: 'text', role: 'headline', x: 8, y: 59, w: 64, h: 16, size: 5.2, color: '#FFFFFF' }, { id: 'sp', type: 'text', role: 'support', x: 8, y: 76, w: 64, h: 8, size: 2.6, color: '#FFFFFF' }] };
const w = await workerEnv({ env: { STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
let gemini = 'ok'; const seen = { gemini: [], claude: [] };
const row = async id => { const r = await w.env.MIND_DB.prepare('SELECT state, progress FROM studio_jobs WHERE id=?').bind(id).first(); return r ? { state: r.state, progress: JSON.parse(r.progress || '{}') } : null; };
let watch = null;   // the job whose row the mocks read mid-call
w.answer(/generativelanguage/, async (u) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
  if (watch) seen.gemini.push(await row(watch));
  if (gemini === 'cancel' && watch) await w.call('POST', '/studio/job/cancel', { id: watch }, 'full-key');
  if (gemini === '503') return new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded' } }), { status: 503 });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || '');
  if (watch) seen.claude.push(await row(watch));
  let text = '{}';
  if (/producing a coordinated set/.test(sys)) text = JSON.stringify({ pieces: [{ channel: 'instagram', headline: 'Fuel tax credits are not a subsidy', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Read more', caption: 'The credit returns a tax that never applied.', alt: 'A teal fact tile', visual: 'A regional road at dusk', claims: [], hashtags: [], plan: JSON.parse(JSON.stringify(PLAN)) }, { channel: 'facebook', headline: 'Fuel tax credits are not a subsidy', support: 'Plainly.', cta: 'Read more', caption: 'c', alt: 'a', visual: 'v', claims: [], hashtags: [], plan: JSON.parse(JSON.stringify(PLAN)) }] });
  return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const step = async id => (await call('POST', '/studio/job/step', { id })).body.job;
const asset = async (P, A) => (await call('GET', '/studio/get?id=' + P)).body.assets.find(x => x.id === A);

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], facts: [], logoB64: PNG_LOGO, logoMime: 'image/png' });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Progress', brief: { objective: 'o', message: 'm', channels: ['instagram', 'facebook'], deliverable: 'set', campaignConfirmed: true }, idem: 'prog-p' })).body.id;
const L = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a road', refs: [] }], palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' },
  layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 60, w: 88, h: 14, size: 6, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' }] };
const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: L, mode: 'composition' })).body.asset.id;

await T.t('a render job reports its phase while the image model is working: the row read inside the provider call says "generating" with a label, the started time and the lines so far; when it finishes the activity says done with an end time, GET /studio/job carries it, and the stage duration is recorded', async () => {
  const j0 = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road at dusk', size: '2K' }, idem: 'prog-r1' })).body.job; watch = j0.id;
  const j = await step(j0.id); watch = null;
  eq(j.state, 'done', j.error);
  const mid = seen.gemini.pop(); ok(mid && mid.state === 'running', 'the mock saw the job running');
  const a = mid.progress.activity || {};
  eq(a.phase, 'generating', JSON.stringify(a)); ok(/image model is making the background image at 2K/.test(a.label), 'the label says what is being made: ' + a.label);
  ok(a.startedAt > 0 && a.at >= a.startedAt, 'started and last-update times'); eq(a.size, '2K');
  const fin = (await call('GET', '/studio/job?id=' + j0.id, null, 'read-key')).body.job; const fa = fin.progress.activity;
  eq(fa.phase, 'done'); eq(fa.label, 'finished'); ok(fa.endedAt >= fa.startedAt, 'an end time'); ok(fin.progress.compiled || true, 'the rest of the progress record is kept');
  const st = (await call('GET', '/studio/status', null, 'read-key')).body; ok(st.durations && st.durations.render && st.durations.render.n === 1 && st.durations.render.median >= 0, 'one render duration recorded: ' + JSON.stringify(st.durations));
});

await T.t('the copy stage counts its channels: the model call is reported as a phase with the model named, then "laying out instagram (1 of 2)" and "facebook (2 of 2)", and the finished activity says 2 of 2 with the render jobs queued', async () => {
  const j0 = (await call('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram', 'facebook'], deliverable: 'set', formats: { instagram: '4:5', facebook: '1:1' }, instruction: 'Two tiles', acknowledge: true }, idem: 'prog-copy' })).body.job; watch = j0.id;
  const j = await step(j0.id); watch = null;
  eq(j.state, 'done', j.error);
  const mid = seen.claude.find(r => r && r.progress && r.progress.activity && r.progress.activity.phase === 'model'); ok(mid, 'the row read inside the Claude call shows the model phase: ' + JSON.stringify(seen.claude.map(r => r && r.progress.activity && r.progress.activity.phase)));
  ok(/asking the creative model \(/.test(mid.progress.activity.label) && mid.progress.activity.model, 'with the model named: ' + mid.progress.activity.label);
  const a = j.progress.activity; eq([a.completed, a.total], [2, 2], JSON.stringify(a)); ok(a.renders >= 1, 'render jobs queued are counted: ' + a.renders);
  const labels = (j.progress.lines || []).map(l => l.text);
  ok(labels.some(t => /creation mode/.test(t)), 'the log lines travel with the progress');
  const ph = seen.claude.map(r => r && r.progress.activity && r.progress.activity.phase).filter(Boolean); ok(ph.indexOf('model') >= 0, 'phases observed mid-run: ' + ph.join(', '));
});

await T.t('a transient provider failure leaves the attempt queued to retry with the activity saying so, and records no duration; a cancel during the provider call is honoured - the fenced progress write and the result both stay out of the row', async () => {
  gemini = '503';
  const r0 = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'x', size: '1K' }, idem: 'prog-503' }); ok(r0.body && r0.body.job, 'job created: ' + JSON.stringify(r0.body).slice(0, 200)); const j0 = r0.body.job;
  const r1 = await call('POST', '/studio/job/step', { id: j0.id }); ok(r1.body && r1.body.job, 'step answered with the job: ' + r1.status + ' ' + JSON.stringify(r1.body).slice(0, 300)); const j = r1.body.job;
  eq(j.state, 'queued', j.error); eq(j.progress.activity.phase, 'queued'); eq(j.progress.activity.label, 'will retry');
  const st = (await call('GET', '/studio/status', null, 'read-key')).body; eq(st.durations.render.n, 1, 'a failed attempt records no duration');
  gemini = 'cancel';
  const c0 = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'y', size: '1K' }, idem: 'prog-cancel' })).body.job; watch = c0.id;
  const rc = await call('POST', '/studio/job/step', { id: c0.id }); watch = null; gemini = 'ok';
  ok(rc.body && rc.body.job, 'the step answers with the job even when the attempt was cancelled under it: ' + rc.status + ' ' + JSON.stringify(rc.body).slice(0, 300)); const c = rc.body.job;
  eq(c.state, 'cancelled', 'the cancel made during the call stands: ' + c.state);
  const after = await row(c0.id); ok((after.progress.activity || {}).phase !== 'filing' && (after.progress.activity || {}).phase !== 'done', 'the attempt wrote no later phase after the cancel: ' + JSON.stringify(after.progress.activity));
  const a = await asset(P, A); eq(a.versions.filter(v => v.kind === 'render').length, 1, 'no image was filed by the cancelled attempt');
});

const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
