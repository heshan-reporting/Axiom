/* S19 on the worker: a canvas edit's version write is idempotent on its op id (a save that committed but timed out in the
 * browser is answered with the version it wrote, never written twice), and the recovery draft is discarded after a save only
 * when it is the draft that edit came from - a draft written later, or on another base, survives a late acknowledgement.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-s19-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s19-worker (idempotent version writes, the guarded draft discard)');
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' }, 'other-key': { n: 'Steve', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } }, env: { STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S19', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
const L = y => ({ stage: { w: 1080, h: 1080 }, layers: [{ id: 'hl', role: 'headline', type: 'text', x: 8, y, w: 80, h: 20, size: 7 }] });
const a0 = (await call('POST', '/studio/asset', { project: P, channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Base' }, layout: L(50), mode: 'composition' })).body.asset;
const A = a0.id;
const fresh = async () => (await get(P)).assets.find(a => a.id === A);

await T.t('the same op twice writes one version; the repeat is answered with that version (duplicate:true) even with a stale revision', async () => {
  const a = await fresh(); const n0 = a.versions.length;
  const b = { asset: A, revision: a.revision, layout: L(40), copy: { headline: 'Mine' }, kind: 'layout', note: 'edit', op: 'eTEST1' };
  const r1 = await call('POST', '/studio/version', b); eq(r1.status, 200, r1.text);
  const r2 = await call('POST', '/studio/version', b); eq(r2.status, 200, 'the retry carries the old revision and still answers 200: ' + r2.text); eq(r2.body.duplicate, true); eq(r2.body.version.id, r1.body.version.id);
  eq((await fresh()).versions.length, n0 + 1, 'one version');
  eq(r1.body.version.context.op, 'eTEST1', 'the op is recorded on the version');
});
await T.t('a different op with a stale revision is still a conflict: idempotency never bypasses the revision check', async () => {
  const a = await fresh();
  const r = await call('POST', '/studio/version', { asset: A, revision: a.revision - 1, layout: L(30), kind: 'layout', note: 'stale', op: 'eOTHER' }); eq([r.status, r.body.error], [409, 'conflict']);
});
await T.t('an op is matched per asset: the same op on another asset is a new write', async () => {
  const b0 = (await call('POST', '/studio/asset', { project: P, channel: 'facebook', format: '1:1', title: 'Other', copy: { headline: 'B' }, layout: L(50), mode: 'composition' })).body.asset;
  const r = await call('POST', '/studio/version', { asset: b0.id, revision: b0.revision, layout: L(41), kind: 'layout', note: 'x', op: 'eTEST1' }); eq(r.status, 200); ok(!r.body.duplicate, 'not a duplicate');
});
await T.t('the guarded discard removes the draft the saved edit came from, and keeps a draft written after the version or on another base', async () => {
  let a = await fresh(); const base = a.current;
  eq((await call('POST', '/studio/draft', { asset: A, version: base, layout: L(33), copy: { headline: 'Draft' } })).status, 200);
  const v = await call('POST', '/studio/version', { asset: A, revision: a.revision, layout: L(33), copy: { headline: 'Draft' }, kind: 'layout', note: 'saved', op: 'eSAVE2' }); eq(v.status, 200);
  // the draft written before the version, on its base: gone
  const d1 = await call('POST', '/studio/draft/discard', { asset: A, version: base, savedVersion: v.body.version.id }); eq(d1.body.discarded, true);
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft, null);
  // a newer draft on the same base written after the version (the user kept typing): a late acknowledgement keeps it
  await new Promise(r => setTimeout(r, 5));
  eq((await call('POST', '/studio/draft', { asset: A, version: base, layout: L(31), copy: { headline: 'Newer' } })).status, 200);
  const d2 = await call('POST', '/studio/draft/discard', { asset: A, version: base, savedVersion: v.body.version.id }); eq(d2.body.discarded, false); eq(d2.body.kept, true);
  ok((await call('GET', '/studio/draft?asset=' + A)).body.draft, 'the newer draft is still there');
  // a draft on the new version is not touched by a discard naming the old base
  a = await fresh(); eq((await call('POST', '/studio/draft', { asset: A, version: a.current, layout: L(29) })).status, 200);
  const d3 = await call('POST', '/studio/draft/discard', { asset: A, version: base, savedVersion: v.body.version.id }); eq(d3.body.discarded, false);
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft.version, a.current);
});
await T.t('drafts are per person: one person\'s discard never removes another\'s draft', async () => {
  const a = await fresh();
  eq((await call('POST', '/studio/draft', { asset: A, version: a.current, layout: L(27) }, 'other-key')).status, 200);
  await call('POST', '/studio/draft/discard', { asset: A });
  ok((await call('GET', '/studio/draft?asset=' + A, null, 'other-key')).body.draft, 'Steve\'s draft is still there');
});
await T.t('a read-only key can neither write a version nor discard a draft', async () => {
  const a = await fresh();
  eq((await call('POST', '/studio/version', { asset: A, revision: a.revision, layout: L(20), kind: 'layout', op: 'eRO' }, 'read-key')).status, 403);
  eq((await call('POST', '/studio/draft/discard', { asset: A }, 'read-key')).status, 403);
});
const res = T.done(); process.exit(res.fail ? 1 : 0);
