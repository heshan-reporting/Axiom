/* S13a: the sound parts of the parallel ChatGPT branch (chatgpt/local-work), kept with a test each. The composition stays
 * editable while an image is generated (the app says so), so an edit made during the image call must survive the render:
 * the image lands on the version current when it comes back, and a layout the render has to change (the imagery reopened
 * on a type-only ground) is built from that version, never from the row read before the call. A region render merges into
 * the version current now. The judge treats a type-only ground as expecting no photograph (as the renderer does), and keeps
 * a browser's "the imagery did not load" instead of passing it. A worker with no image storage refuses before paying.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-s13-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const T = suite('studio-s13-worker (renders keep edits made meanwhile; the judge agrees with the renderer on imagery)');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0', GEMINI_KEY: 'g' } });
let during = null;   // run inside the image call: the edit a person makes while the model works
w.answer(/generativelanguage/, async (u) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [] }), { status: 200 });
  if (during) { const f = during; during = null; await f(); }
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const curV = async (P, A) => { const a = (await get(P)).assets.find(x => x.id === A); return { a, v: a.versions.find(x => x.id === a.current) }; };
const run = async (P, A, input, idem) => { const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input, idem })).body.job; return (await call('POST', '/studio/job/step', { id: j.id })).body.job; };
const P = (await call('POST', '/studio/project', { ns: 'mca', title: 'S13', brief: { objective: 'o', message: 'm', channels: ['instagram'] }, idem: 's13-p' })).body.id;
const head = (x) => ({ id: 'headline', type: 'text', role: 'headline', x, y: 60, w: 80, h: 14, size: 6, weight: 800, color: '#FFFFFF', align: 'left' });
const typeOnly = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, noImagery: true, bg: '#0E6A6E', regions: [], layers: [head(6)] };

await T.t('a type-only ground, an image asked for on purpose, and a layout move made while the model works: the render lands on the moved layout (the move is kept) with the imagery shown, and is current', async () => {
  const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: typeOnly, mode: 'composition' })).body.asset.id;
  during = async () => { const { a, v } = await curV(P, A); const L = JSON.parse(JSON.stringify(v.layout)); L.layers[0].x = 14; const r = await call('POST', '/studio/version', { asset: A, revision: a.revision, kind: 'layout', layout: L, note: 'moved by hand during the render' }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200)); };
  const j = await run(P, A, { prompt: 'a road at dusk', size: '1K' }, 's13-r1'); eq(j.state, 'done', j.error);
  const { a, v } = await curV(P, A);
  ok(v.image && v.image.key, 'the image is on the current version');
  eq(v.layout.layers.find(l => l.id === 'headline').x, 14, 'the hand move made during the render is kept (it used to be reverted to 6 by a layout built before the call)');
  ok(!v.layout.noImagery && (v.layout.regions || []).some(r => r.role === 'background'), 'the imagery is reopened on that version');
  eq(a.versions.length, 3, 'first, the hand edit, the render');
  ok(!j.result.branch, 'not a branch: the edit was made with the render in flight, as the app allows');
});

await T.t('a region render merges into the version current when the image comes back: a word edit and a layout move made meanwhile are kept and the region layer gets the image', async () => {
  const L = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100 }, { id: 'inset', role: 'inset', x: 60, y: 8, w: 32, h: 24 }], layers: [head(6), { id: 'inset', type: 'img', role: 'image', region: 'inset', x: 60, y: 8, w: 32, h: 24 }] };
  const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Inset', copy: { headline: 'First words' }, layout: L, mode: 'composition' })).body.asset.id;
  during = async () => { const { a, v } = await curV(P, A); const L2 = JSON.parse(JSON.stringify(v.layout)); L2.layers[0].x = 12; const r = await call('POST', '/studio/version', { asset: A, revision: a.revision, kind: 'layout', layout: L2, copy: { headline: 'Words changed during the render' } }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200)); };
  const j = await run(P, A, { prompt: 'a small inset photograph', region: 'inset', regionRole: 'inset' }, 's13-r2'); eq(j.state, 'done', j.error);
  const { v } = await curV(P, A);
  eq(v.copy.headline, 'Words changed during the render', 'the word edit is kept');
  eq(v.layout.layers.find(l => l.id === 'headline').x, 12, 'and the layout move (it used to be merged into the layout read before the call)');
  ok(v.layout.layers.find(l => l.id === 'inset').src, 'the region layer carries the image');
});

await T.t('a render for a version the asset had moved past before the job ran is still a branch, current left alone (the stale guard is unchanged)', async () => {
  const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Stale', copy: { headline: 'One' }, layout: { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100 }], layers: [head(6)] }, mode: 'composition' })).body.asset.id;
  const jq = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'x' }, idem: 's13-r3' })).body.job;
  const { a } = await curV(P, A); await call('POST', '/studio/version', { asset: A, revision: a.revision, kind: 'text', copy: { headline: 'Two' } });
  const before = (await curV(P, A)).v.id;
  const j = (await call('POST', '/studio/job/step', { id: jq.id })).body.job; eq(j.state, 'done', j.error);
  ok(j.result.branch, 'filed as a branch'); eq((await curV(P, A)).v.id, before, 'current left as it was');
});

await T.t('the judge: a type-only ground with no photograph is not "imagery missing" (as the renderer says); a report saying the imagery did not load keeps that finding even with an image on record', async () => {
  const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Ground', copy: { headline: 'Not a subsidy' }, layout: typeOnly, mode: 'composition' })).body.asset.id;
  let { a, v } = await curV(P, A);
  let r = await call('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a) });
  eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  ok(!(r.body.issues || r.body.validation && r.body.validation.issues || []).some(i => i.code === 'imagery_missing'), 'no imagery_missing on a type-only ground: ' + JSON.stringify(r.body).slice(0, 300));
  // the same tile with imagery: on record, but the browser could not load it
  const j = await run(P, A, { prompt: 'a road', size: '1K' }, 's13-r4'); eq(j.state, 'done', j.error);
  ({ a, v } = await curV(P, A)); const rep = stubReport(v, a); rep.imageryMissing = true;
  r = await call('POST', '/studio/validation', { asset: A, version: v.id, report: rep });
  const issues = r.body.issues || (r.body.validation || {}).issues || [];
  ok(issues.some(i => i.code === 'imagery_missing'), 'the browser\'s finding stands: ' + JSON.stringify(r.body).slice(0, 300));
});

await T.t('a worker with no image storage refuses a render before calling the image model', async () => {
  const docs = w.env.MIND_DOCS; delete w.env.MIND_DOCS; let calls = 0; const prev = during; during = async () => { calls++; };
  try {
    const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'NoStore', copy: { headline: 'x' }, layout: typeOnly, mode: 'composition' })).body.asset.id;
    const j = await run(P, A, { prompt: 'x' }, 's13-r5');
    eq(j.state, 'failed'); ok(/storage_not_configured/.test(j.error), j.error); eq(calls, 0, 'no image call');
  } finally { w.env.MIND_DOCS = docs; during = prev; }
});

const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
