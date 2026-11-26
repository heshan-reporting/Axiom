/* Images always from Nano Banana Pro (the owner, 26 November 2026: "let's always use pro"). The Studio used to fall back to
 * gemini-3.1-flash-image and then gemini-2.5-flash-image when Pro was busy or refused, quietly, so a tile could be painted by a
 * weaker model. Providers MOCKED; the assertions count the requests that actually left the worker.
 *   PO1 Pro answering 503 every time: every request of the job goes to Pro, all of the job's image requests are Pro's (it is not
 *       held to a per-model share of them), and the failure says Pro was busy and no other model was used
 *   PO2 Pro refusing a request (400/404) is not passed to another model either: the job fails with the reason
 *   PO3 a render that lands after a busy answer is Pro's, with no fallback recorded
 *   PO4 Ad Lab's /nano asks Pro only, and a body naming another model gets Pro (the refused name is said)
 *   PO5 the published policy and the capability registry name Pro alone and no fallbacks
 * Run: node --experimental-sqlite tests/studio-pro-only-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngB64 } from './png.mjs';
const T = suite('studio-pro-only-worker (every image is painted by Nano Banana Pro; no fallback to another model)');
const PRO = 'gemini-3-pro-image';
const PNG = pngB64(16, 16, { fill: 0 });
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0', STUDIO_IMAGE_BACKOFF_MS: '5' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const getJob = async id => (await call('GET', '/studio/job?id=' + id, null, 'read-key')).body.job;
const gem = { calls: [], script: [], dflt: { ok: true } };
w.answer(/generativelanguage/, async u => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [] }), { status: 200 });
  const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || '');
  const e = gem.script.length ? gem.script.shift() : gem.dflt; gem.calls.push(model);
  if (e.status) return new Response(JSON.stringify({ error: { code: e.status, message: 'mock ' + e.status } }), { status: e.status });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 1200, totalTokenCount: 1210 } }), { status: 200 });
});
w.answer(/api\.anthropic\.com/, async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 }));
const reset = () => { gem.calls = []; gem.script = []; gem.dflt = { ok: true }; };
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const LAYOUT = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }] };
const fresh = async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Pro ' + Math.random().toString(36).slice(2, 7), brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
  const r = await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: LAYOUT, mode: 'composition' });
  return { P, A: r.body.asset.id };
};
const renderJob = async (P, A) => (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road at dusk', region: 'bg', aspect: '1:1' }, idem: 'r' + Math.random().toString(36).slice(2, 9) })).body.job;
const runOut = async id => { let j = await getJob(id); for (let i = 0; i < 8 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id })).body.job; return j; };
const pol = (await call('GET', '/studio/budget', null, 'read-key')).body.policy.image;

await T.t('PO1 Pro busy every time: every request goes to Pro, the job may use all its requests on Pro, and the failure says so', async () => {
  const { P, A } = await fresh(); reset(); gem.dflt = { status: 503 };
  const j = await runOut((await renderJob(P, A)).id);
  eq(j.state, 'failed', 'the job ends failed');
  ok(gem.calls.length > 0 && gem.calls.every(m => m === PRO), 'every request asked Pro: ' + gem.calls.join(', '));
  eq(gem.calls.length, pol.requestsPerJob, 'Pro was given all ' + pol.requestsPerJob + ' of the job\'s image requests');
  ok(/Nano Banana Pro|gemini-3-pro-image/.test(j.error) && /no other model/i.test(j.error), 'the failure names Pro and says no other model was used: ' + j.error);
});
await T.t('PO2 Pro refusing the request is not passed to another model', async () => {
  const { P, A } = await fresh(); reset(); gem.dflt = { status: 404 };
  const j = await runOut((await renderJob(P, A)).id);
  eq(j.state, 'failed'); ok(gem.calls.length >= 1 && gem.calls.every(m => m === PRO), 'only Pro was asked: ' + gem.calls.join(', '));
});
await T.t('PO3 a render that lands after a busy answer is Pro\'s, with no fallback recorded', async () => {
  const { P, A } = await fresh(); reset(); gem.script = [{ status: 503 }];
  const j = await runOut((await renderJob(P, A)).id);
  eq(j.state, 'done', j.error); eq(gem.calls, [PRO, PRO]);
  eq([j.result.model, !!j.result.fallback], [PRO, false]);
  ok((j.requests || []).every(x => !x.fallback), 'no request was a fallback: ' + JSON.stringify(j.requests));
});
await T.t('PO4 Ad Lab asks Pro only, and a body naming another model gets Pro', async () => {
  reset(); gem.dflt = { status: 503 };
  let r = await call('POST', '/nano', { prompt: 'a road' }); eq(r.status, 502);
  ok(gem.calls.length && gem.calls.every(m => m === PRO), 'busy Pro is retried, never another model: ' + gem.calls.join(', '));
  reset();
  r = await call('POST', '/nano', { prompt: 'a road', model: 'gemini-2.5-flash-image' }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  eq([r.body.model, gem.calls], [PRO, [PRO]], 'the other model was not asked');
});
await T.t('PO5 the published policy and the capabilities name Pro alone and no fallbacks', async () => {
  eq(pol.chain, [PRO], 'the image chain is Pro alone');
  const c = (await call('GET', '/studio/capabilities', null, 'read-key')).body;
  for (const op of ['render', 'finished']) { const o = c.operations.find(x => x.op === op); eq([o.model, o.fallbacks], [PRO, []], op + ' says Pro, no fallbacks'); }
});
const r = T.done(); w.restore(); process.exit(r.fail ? 1 : 0);
