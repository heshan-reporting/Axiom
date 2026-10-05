/* Durable progress is observable while providers wait; no real model calls. */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngGradientB64 } from './worker-png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const T = suite('studio-progress-worker (providers MOCKED)');
const w = await workerEnv({ env: { GEMINI_KEY: 'test', STUDIO_INSPECT: '0' } });
const api = async (method, path, body, key) => (await w.call(method, path, body, key || 'full-key')).body;
const P = (await api('POST', '/studio/project', { ns: 'mca', title: 'Progress regression', brief: { objective: 'Test', message: 'A clear message' } })).id;
const layout = { v: 5, stage: { w: 1080, h: 1350 }, format: '4:5', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100 }], layers: [] };
const asset = async title => (await api('POST', '/studio/asset', { project: P, title, channel: 'instagram', format: '4:5', mode: 'composition', layout, copy: { headline: 'Original' } })).asset;
const queue = async a => (await api('POST', '/studio/job', { project: P, asset: a.id, stage: 'render', input: { prompt: 'A landscape', size: '1K' } })).job;
const getJob = async id => (await api('GET', '/studio/get?id=' + P, null, 'read-key')).jobs.find(j => j.id === id);
const getAsset = async id => (await api('GET', '/studio/get?id=' + P)).assets.find(a => a.id === id);
const gates = []; let calls = 0;
w.answer(/generativelanguage/, async () => { calls++; const g = gates.shift(); if (g) { g.enter(); await g.wait; } return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: pngGradientB64(64, 80) } }] } }] }), { status: 200 }); });
function gate() { let release, enter; const wait = new Promise(r => { release = r; }), entered = new Promise(r => { enter = r; }); const g = { wait, entered, release, enter }; gates.push(g); return g; }
await T.t('a read-only request sees the generation milestone before the provider responds', async () => {
  const a = await asset('Slow render'), j = await queue(a), g = gate();
  const pending = api('POST', '/studio/job/step', { id: j.id }); await g.entered;
  const running = await getJob(j.id); eq(running.state, 'running'); eq(running.progress.activity.phase, 'generate'); eq(running.progress.activity.completed, 1); eq(running.progress.activity.total, 4); eq(running.attempts, 1);
  g.release(); const result = await pending; eq(result.job.state, 'done'); eq(result.job.progress.activity.completed, 4); ok(result.job.progress.compiled, 'compiled provenance preserved');
});
await T.t('an error after generation is caught and terminal, never a running job waiting out its lease', async () => {
  const a = await asset('Storage error'), j = await queue(a), old = w.env.MIND_DOCS.put;
  w.env.MIND_DOCS.put = async (key, ...rest) => { if (key.includes('/' + a.id + '/') && key.endsWith('.png')) throw new Error('storage refused this image'); return old(key, ...rest); };
  try { const result = await api('POST', '/studio/job/step', { id: j.id }); eq(result.job.state, 'failed'); ok(/storage refused/.test(result.job.error)); eq(result.job.progress.activity.phase, 'failed'); }
  finally { w.env.MIND_DOCS.put = old; }
});
await T.t('missing image storage is detected before spending a model call', async () => {
  const a = await asset('No storage'), j = await queue(a), old = w.env.MIND_DOCS, before = calls; delete w.env.MIND_DOCS;
  try { const r = await api('POST', '/studio/job/step', { id: j.id }); eq(r.job.state, 'failed'); ok(/storage_not_configured/.test(r.job.error)); eq(calls, before); }
  finally { w.env.MIND_DOCS = old; }
});
await T.t('cancellation fences progress and results from the late provider answer', async () => {
  const a = await asset('Cancel'), j = await queue(a), g = gate(); const pending = api('POST', '/studio/job/step', { id: j.id }); await g.entered;
  await api('POST', '/studio/job/cancel', { id: j.id }); const before = await getJob(j.id); g.release(); await pending;
  const after = await getJob(j.id); eq(after.state, 'cancelled'); eq(after.progress, before.progress); eq((await getAsset(a.id)).versions.length, 1);
});
await T.t('editing the composition during generation preserves the edit and files the image as an alternate', async () => {
  const a = await asset('Concurrent edit'), j = await queue(a), g = gate(); const pending = api('POST', '/studio/job/step', { id: j.id }); await g.entered;
  await api('POST', '/studio/version', { asset: a.id, copy: { headline: 'Newer words' }, note: 'Designer edit' });
  const edited = await getAsset(a.id); g.release(); const result = await pending;
  eq(result.job.state, 'done'); eq(result.job.result.branch, true); const latest = await getAsset(a.id); eq(latest.current, edited.current); eq(latest.versions.length, 3);
});
await T.t('an image record with missing browser pixels cannot pass server validation', async () => {
  const a = await asset('Broken background'); await api('POST', '/studio/version', { asset: a.id, image: { key: 'missing.png', url: '/studio/file?key=missing.png' } });
  const current = await getAsset(a.id), v = current.versions.find(v => v.id === current.current);
  const report = { ...stubReport(v, current), imageryMissing: true };
  const r = await api('POST', '/studio/validation', { asset: a.id, version: v.id, report });
  ok(r.validation && r.validation.issues.some(i => i.code === 'imagery_missing' && i.severity === 'blocking'), JSON.stringify(r)); eq(r.validation.ok, false);
});
w.restore(); process.exitCode = T.done().fail ? 1 : 0;
