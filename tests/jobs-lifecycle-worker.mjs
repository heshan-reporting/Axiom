/* The job lifecycle: one claim per job, a cancelled job stays cancelled, and an attempt that lost ownership (cancelled,
 * or its lease expired and another attempt took over) cannot file results, requeue itself or overwrite newer work.
 * A provider call is held open on purpose (a gate in the mocked Gemini) so the cancel or the takeover happens while
 * it is in flight - the case that matters. Providers MOCKED.
 * Run: node --experimental-sqlite tests/jobs-lifecycle-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngGradientB64 } from './worker-png.mjs';
const T = suite('jobs-lifecycle-worker (claims, cancellation, fencing; providers MOCKED)');
const w = await workerEnv({ env: { GEMINI_KEY: 'g', ANTHROPIC_API_KEY: 'a', STUDIO_INSPECT: '0' } });
const db = w.env.MIND_DB.db; const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const PNG = pngGradientB64(64, 64);
// the image provider: each call waits on the next gate in the queue (or answers at once), then answers with mode
let gates = []; let geminiMode = 'ok';
w.answer(/generativelanguage/, async () => {
  const g = gates.shift(); if (g) await g.wait;
  if (geminiMode === 'down') return new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded.' } }), { status: 503 });
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
const gate = () => { let open; const wait = new Promise(r => { open = r; }); const g = { wait, open }; gates.push(g); return g; };
const tick = () => new Promise(r => setTimeout(r, 30));
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Jobs', brief: { objective: 'o', message: 'm' }, idem: 'jobs-1' })).body.id;
const asset = async t => (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: t, copy: { headline: 'H', support: 'S', cta: 'C' }, mode: 'composition' })).body.asset;
const versions = id => db.prepare('SELECT COUNT(*) AS n FROM studio_versions WHERE asset=?').get(id).n;
const job = id => db.prepare('SELECT state, attempts, error FROM studio_jobs WHERE id=?').get(id);
const renderJob = async (a, idem) => (await call('POST', '/studio/job', { project: P, asset: a.id, stage: 'render', input: { prompt: 'a regional road at dusk', size: '1K' }, idem })).body.job.id;

/* bridge jobs */
await T.t('two collectors asking for work at the same moment: exactly one claims the job', async () => {
  const r = await call('POST', '/bridge/run', { source: 'x', params: { q: 'x' } }); const id = r.body.id; ok(id, r.text.slice(0, 200));
  w.slowReads(15); const [a, b] = await Promise.all([call('GET', '/bridge/next?agent=mac-a&sources=x'), call('GET', '/bridge/next?agent=mac-b&sources=x')]); w.slowReads(0);
  const got = [a, b].filter(x => x.body.job && x.body.job.id === id);
  eq(got.length, 1, 'claimed by ' + [a, b].map(x => x.body.job ? x.body.job.id : 'nothing').join(' and '));
  eq(db.prepare('SELECT status FROM bridge_jobs WHERE id=?').get(id).status, 'running');
});
await T.t('a bridge job cancelled while a collector runs it stays cancelled when the collector reports done', async () => {
  const r = await call('POST', '/bridge/run', { source: 'x', params: { q: 'y' } }); const id = r.body.id;
  const n = await call('GET', '/bridge/next?agent=mac-a&sources=x'); eq(n.body.job.id, id);
  await call('POST', '/bridge/cancel', { job: id });
  const d = await call('POST', '/bridge/done', { job: id, ok: true, result: { summary: 'swept 40 threads' } });
  eq(db.prepare('SELECT status FROM bridge_jobs WHERE id=?').get(id).status, 'cancelled', 'cancellation is terminal');
  ok(d.status === 409 || (d.body && d.body.ignored), 'the late report is refused or marked ignored: ' + d.text.slice(0, 120));
});

/* Studio jobs */
await T.t('a Studio job cancelled during its provider call, which then fails transiently, stays cancelled (it is not requeued)', async () => {
  const a = await asset('Cancel then fail'); const id = await renderJob(a, 'r-cancel-fail'); const v0 = versions(a.id);
  const g = gate(); geminiMode = 'down';
  const run = call('POST', '/studio/job/step', { id }); await tick(); await tick();
  eq(job(id).state, 'running', 'in flight');
  await call('POST', '/studio/job/cancel', { id }); eq(job(id).state, 'cancelled');
  g.open(); await run; geminiMode = 'ok';
  eq(job(id).state, 'cancelled', 'still cancelled after the provider failed: ' + JSON.stringify(job(id)));
  eq(versions(a.id), v0, 'nothing filed');
  const again = await call('POST', '/studio/job/step', { id }); eq(again.body.job.state, 'cancelled', 'stepping a cancelled job does not revive it');
});
await T.t('a Studio job cancelled during its provider call, which then succeeds, files nothing', async () => {
  const a = await asset('Cancel then succeed'); const id = await renderJob(a, 'r-cancel-ok'); const v0 = versions(a.id);
  const g = gate(); const run = call('POST', '/studio/job/step', { id }); await tick(); await tick();
  await call('POST', '/studio/job/cancel', { id }); g.open(); await run;
  eq(job(id).state, 'cancelled'); eq(versions(a.id), v0, 'the finished render was not filed');
  eq(db.prepare("SELECT COUNT(*) AS n FROM studio_events WHERE project=? AND data LIKE ? AND kind='version'").get(P, '%' + a.id + '%').n, 0, 'no version event');
});
await T.t('an attempt whose lease expired and was taken over cannot file its result or overwrite the newer attempt', async () => {
  const a = await asset('Takeover'); const id = await renderJob(a, 'r-takeover'); const v0 = versions(a.id);
  const g = gate();                                   // attempt 1 waits here
  const first = call('POST', '/studio/job/step', { id }); await tick(); await tick();
  eq(job(id).attempts, 1);
  db.prepare('UPDATE studio_jobs SET lease_until=1 WHERE id=?').run(id);              // its lease runs out (time passes)
  const second = await call('POST', '/studio/job/step', { id });                       // attempt 2 takes over and finishes
  eq([second.body.job.state, job(id).attempts], ['done', 2], JSON.stringify(second.body.job).slice(0, 200));
  const afterSecond = versions(a.id); eq(afterSecond, v0 + 1, 'attempt 2 filed one version');
  g.open(); await first;                                                               // attempt 1's provider call returns late
  eq(versions(a.id), afterSecond, 'attempt 1 filed nothing');
  eq(job(id).state, 'done', 'attempt 1 did not overwrite the finished job: ' + JSON.stringify(job(id)));
});
await T.t('two runners stepping the same queued job at once: it runs once', async () => {
  const a = await asset('Double step'); const id = await renderJob(a, 'r-double'); const v0 = versions(a.id);
  w.slowReads(10); const [x, y] = await Promise.all([call('POST', '/studio/job/step', { id }), call('POST', '/studio/job/step', { id })]); w.slowReads(0);
  eq(versions(a.id), v0 + 1, 'one version'); eq(job(id).attempts, 1, 'one attempt');
});
await T.t('a provider call longer than the default lease does not let a second attempt start: the lease is extended before the call', async () => {
  const a = await asset('Long call'); const id = await renderJob(a, 'r-long');
  const g = gate(); const run = call('POST', '/studio/job/step', { id }); await tick(); await tick();
  const lease = db.prepare('SELECT lease_until FROM studio_jobs WHERE id=?').get(id).lease_until;
  ok(lease - Date.now() > 150000, 'the lease covers the provider timeout: ' + Math.round((lease - Date.now()) / 1000) + 's');
  const other = await call('POST', '/studio/job/step', { id }); ok(/another runner/.test(other.body.job.note || ''), 'a second runner waits: ' + JSON.stringify(other.body.job.note));
  g.open(); await run; eq(job(id).state, 'done');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
