/* S23 slice H on the worker (providers MOCKED): what the canvas reads and writes besides a version.
 *   H-W1 a page is duplicated as a new asset placed right after it in its family, with the same composition; no model call, no
 *        render; the original is untouched; the project lists the family in page order;
 *   H-W2 a page is added after another: the same layout and imagery with new words to write; it is placed after the one asked;
 *   H-W3 pages are reordered without a version: moving one rewrites the family's order and nothing else;
 *   H-W4 a deleted page is archived (recoverable), leaves the project's assets, the workflow counts and the export, and comes
 *        back in its place when restored; a read key cannot change pages; a page of another project is refused;
 *   H-W5 user guides persist on the asset without a version: the composition signature, the validation and the approvals stand;
 *        bounds are enforced; a read key cannot write them;
 *   H-W6 the project's uploaded images are listed for the Elements panel (this project's only), read role.
 * Run: node --experimental-sqlite tests/studio-s23h-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s23h-worker (pages as ordered assets, user guides, uploads)');
const png = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
let gemini = 0, claude = 0;
w.answer(/generativelanguage/, async () => { gemini++; return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png } }] } }] }), { status: 200 }); });
w.answer(/api\.anthropic\.com/, async () => { claude++; return new Response(JSON.stringify({ error: { type: 'not_expected' } }), { status: 500 }); });
const LAYOUT = (hl) => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }], frame: { index: 0, of: 3 }, note: hl });
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Carousel pages', brief: { channels: ['instagram'] } })).body.id;
const mk = async (title, hl) => (await call('POST', '/studio/asset', { project: P, family: 'Carousel', channel: 'instagram', format: '4:5', title, copy: { headline: hl }, layout: LAYOUT(hl), mode: 'composition' })).body.asset.id;
const A1 = await mk('Frame 1', 'Myth: it is a subsidy');
const A2 = await mk('Frame 2', 'Fact: it is a credit');
const A3 = await mk('Frame 3', 'Read the facts');
const get = async () => (await call('GET', '/studio/get?id=' + P, null, 'read-key')).body;
const order = g => g.assets.filter(a => a.family === 'Carousel').map(a => a.title);
const page = (body, k) => call('POST', '/studio/page', body, k);

await T.t('H-W1 a page is duplicated right after itself with the same composition; nothing generated; the original untouched', async () => {
  const before = (await get()).assets.find(a => a.id === A2); const g0 = gemini, c0 = claude;
  const r = await page({ asset: A2, action: 'duplicate' });
  eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const made = r.body.made; ok(made && made.asset && made.asset !== A2, 'a new asset: ' + JSON.stringify(made));
  const g = await get();
  eq(order(g), ['Frame 1', 'Frame 2', 'Frame 2 (copy)', 'Frame 3'], 'placed right after the page it copies');
  const na = g.assets.find(a => a.id === made.asset); const nv = na.versions.find(v => v.id === na.current); const ov = before.versions.find(v => v.id === before.current);
  eq([nv.copy.headline, JSON.stringify(nv.layout.layers)], [ov.copy.headline, JSON.stringify(ov.layout.layers)], 'the same words and layers');
  ok(/duplicated from Frame 2/.test(nv.note), 'the version says where it came from: ' + nv.note);
  const after = g.assets.find(a => a.id === A2); eq([after.current, after.versions.length], [before.current, before.versions.length], 'the original is untouched');
  eq([gemini - g0, claude - c0], [0, 0], 'no model call, no render');
});

await T.t('H-W2 a page is added after another: same layout and imagery, new words to write, placed after the one asked', async () => {
  const r = await page({ asset: A1, action: 'add' });
  eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  const g = await get(); const na = g.assets.find(a => a.id === r.body.made.asset); const nv = na.versions.find(v => v.id === na.current);
  eq(order(g).slice(0, 2), ['Frame 1', na.title], 'right after Frame 1: ' + order(g).join(' | '));
  eq(nv.copy.headline, 'New page', 'new words to write');
  eq(JSON.stringify(nv.layout.layers.map(l => l.id)), JSON.stringify(['hl']), 'the same layout');
});

await T.t('H-W3 moving a page rewrites the family order and writes no version', async () => {
  const g0 = await get(); const v0 = g0.assets.map(a => a.id + ':' + a.versions.length).join(',');
  const r = await page({ asset: A3, action: 'move', to: 0 }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const g = await get(); eq(order(g)[0], 'Frame 3', 'Frame 3 is first: ' + order(g).join(' | '));
  eq(g.assets.map(a => a.id + ':' + a.versions.length).sort().join(','), v0.split(',').sort().join(','), 'no version written by a move');
  const bad = await page({ asset: A3, action: 'move', to: 99 }); eq(bad.status, 200, 'a position past the end puts it last');
  eq(order(await get()).slice(-1)[0], 'Frame 3');
});

await T.t('H-W4 a deleted page is archived, leaves the assets, workflow and export, and returns in its place; read keys and other projects refused', async () => {
  const pos = order(await get()).indexOf('Frame 2');
  eq((await page({ asset: A2, action: 'delete' }, 'read-key')).status, 403, 'a read key cannot delete a page');
  const r = await page({ asset: A2, action: 'delete' }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  let g = await get();
  ok(!g.assets.some(a => a.id === A2), 'gone from the assets');
  ok((g.archivedAssets || []).some(a => a.id === A2), 'listed as archived, to restore');
  const ex = (await call('POST', '/studio/job', { project: P, stage: 'export', input: {}, idem: 'h-export' })).body.job;
  const done = (await call('POST', '/studio/job/step', { id: ex.id })).body.job;
  ok(!JSON.stringify(done.result || {}).includes(A2), 'the export does not consider an archived page');
  const back = await page({ asset: A2, action: 'restore' }); eq(back.status, 200);
  g = await get(); eq(order(g).indexOf('Frame 2'), pos, 'restored in its place');
  const Q = (await call('POST', '/studio/project', { ns: 'mca', title: 'Other project', brief: {} })).body.id;
  const other = await page({ asset: A2, action: 'move', to: 0, project: Q }); eq(other.status, 403, 'a page of another project is refused: ' + JSON.stringify(other.body));
  const nope = await page({ asset: A2, action: 'explode' }); eq(nope.status, 400, 'an unknown action is refused');
});

await T.t('H-W5 user guides persist on the asset without a version; the signature, validation and approvals stand; bounded', async () => {
  const a0 = (await get()).assets.find(a => a.id === A1);
  await call('POST', '/studio/approve', { asset: A1, part: 'copy', decision: 'approve', reason: 'copy ready' });
  const sig0 = (await call('GET', '/studio/readiness?asset=' + A1, null, 'read-key')).body;
  eq((await call('POST', '/studio/guides', { asset: A1, guides: [{ a: 'x', at: 50 }] }, 'read-key')).status, 403, 'a read key cannot write guides');
  const r = await call('POST', '/studio/guides', { asset: A1, guides: [{ a: 'x', at: 50 }, { a: 'y', at: 33.3 }, { a: 'q', at: 5 }, { a: 'x', at: 500 }] });
  eq(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const g = await get(); const a1 = g.assets.find(a => a.id === A1);
  eq(a1.guides, [{ a: 'x', at: 50 }, { a: 'y', at: 33.3 }, { a: 'x', at: 110 }], 'kept, a bad axis dropped, a value clamped');
  eq([a1.current, a1.versions.length], [a0.current, a0.versions.length], 'no version written');
  ok(a1.approvals && a1.approvals.copy, 'the copy approval still stands');
  const sig1 = (await call('GET', '/studio/readiness?asset=' + A1, null, 'read-key')).body;
  eq(sig1.sig, sig0.sig, 'the composition signature is unchanged');
  const many = await call('POST', '/studio/guides', { asset: A1, guides: Array.from({ length: 60 }, (_, i) => ({ a: 'x', at: i })) });
  eq((await get()).assets.find(a => a.id === A1).guides.length, 40, 'at most 40 guides: ' + many.status);
});

await T.t('H-W6 the project\'s uploads are listed for the Elements panel, this project only, read role', async () => {
  const up = (await call('POST', '/studio/image/upload', { project: P, imageB64: png, mime: 'image/png', name: 'mine.png' })).body;
  const Q = (await call('POST', '/studio/project', { ns: 'mca', title: 'Elsewhere', brief: {} })).body.id;
  await call('POST', '/studio/image/upload', { project: Q, imageB64: png, mime: 'image/png', name: 'theirs.png' });
  const l = (await call('GET', '/studio/uploads?project=' + P, null, 'read-key'));
  eq(l.status, 200, JSON.stringify(l.body).slice(0, 200));
  eq(l.body.uploads.map(u => u.name), ['mine.png'], 'only this project\'s uploads');
  eq(l.body.uploads[0].key, up.key); ok(/^\/studio\/file\?key=/.test(l.body.uploads[0].url), 'by the keyed file route');
});

await T.t('H-W7 a project nobody reordered lists its assets as they were made; a page move re-fills only its own family\'s places', async () => {
  const Q = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Two families', brief: {} })).body.id;
  const mk2 = async (fam, title) => (await call('POST', '/studio/asset', { project: Q, family: fam, channel: 'instagram', format: '4:5', title, copy: { headline: title }, layout: LAYOUT(title), mode: 'composition' })).body.asset.id;
  const x1 = await mk2('Set', 'Set 1'); await mk2('Single', 'Single'); const x3 = await mk2('Set', 'Set 2');
  const list = async () => (await call('GET', '/studio/get?id=' + Q, null, 'read-key')).body.assets.map(a => a.title);
  eq(await list(), ['Set 1', 'Single', 'Set 2'], 'creation order, newest last');
  eq((await page({ asset: x3, action: 'move', to: 0 })).status, 200);
  eq(await list(), ['Set 2', 'Single', 'Set 1'], 'the family\'s two places re-filled in its new order; the other family stays where it was');
  ok(x1, 'made');
});

T.done(); w.restore();
