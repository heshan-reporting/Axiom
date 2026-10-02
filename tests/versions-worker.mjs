/* The current version is always the one shown, numbered and judged: past 60 versions, with equal timestamps, and with
 * history paged separately in a stable order. Providers MOCKED.
 * Run: node --experimental-sqlite tests/versions-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('versions-worker (current version past 60, equal timestamps, paged history)');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
const db = w.env.MIND_DB.db; const call = (m, p, b) => w.call(m, p, b, 'full-key');
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Many versions', brief: { objective: 'o', message: 'm' }, idem: 'v-1' })).body.id;
const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'Busy tile', copy: { headline: 'edit 0' }, mode: 'composition' })).body.asset;
for (let i = 1; i <= 74; i++) { const r = await call('POST', '/studio/version', { asset: A.id, copy: { headline: 'edit ' + i }, note: 'edit ' + i }); if (r.status !== 200) throw new Error('setup ' + i + ': ' + r.text.slice(0, 120)); }
const asset = async () => (await call('GET', '/studio/get?id=' + P)).body.assets.find(a => a.id === A.id);
const realCurrent = () => db.prepare('SELECT current FROM studio_assets WHERE id=?').get(A.id).current;

await T.t('75 versions: the project view carries the actual current version (the newest), not an older one from the first 60', async () => {
  const a = await asset(); const cur = a.versions.find(v => v.id === a.current);
  ok(cur, 'the current version is in the view (current ' + a.current + ', ' + a.versions.length + ' versions sent)');
  eq([a.current, cur.copy.headline], [realCurrent(), 'edit 74']);
  eq(a.versionsTotal, 75, 'the total is stated'); eq(cur.n, 75, 'numbered as the 75th');
  ok(a.versions.length <= 60, 'the history sent is bounded: ' + a.versions.length);
});
await T.t('equal timestamps: the order is stable (insertion order), every read numbers each version the same, and the current stays current', async () => {
  db.prepare('UPDATE studio_versions SET created=1700000000000 WHERE asset=?').run(A.id);
  const a1 = await asset(); const a2 = await asset();
  eq(a1.versions.map(v => v.id + ':' + v.n), a2.versions.map(v => v.id + ':' + v.n), 'two reads agree');
  const ns = a1.versions.map(v => v.n); eq(ns, ns.slice().sort((x, y) => x - y), 'ascending'); eq(new Set(ns).size, ns.length, 'no duplicate numbers');
  eq(a1.versions.find(v => v.id === a1.current).copy.headline, 'edit 74'); eq(a1.versions[a1.versions.length - 1].n, 75);
});
await T.t('older history is paged separately in the same stable order, with no gap or overlap', async () => {
  const a = await asset(); const first = a.versions[0].n;
  const r = await call('GET', '/studio/versions?asset=' + A.id + '&before=' + first + '&limit=40'); eq(r.status, 200, r.text.slice(0, 120));
  const older = r.body.versions; ok(older.length === first - 1 || older.length === 40, 'page size ' + older.length);
  eq(older[older.length - 1].n, first - 1, 'the page ends right before the first version shown');
  const all = older.map(v => v.n).concat(a.versions.map(v => v.n)); eq(new Set(all).size, all.length, 'no overlap');
  eq(older.map(v => v.copy.headline)[0], 'edit ' + (older[0].n - 1), 'number n carries edit n-1');
});
await T.t('restoring an early version (outside the window) makes a new current version numbered 76', async () => {
  const early = db.prepare('SELECT id FROM studio_versions WHERE asset=? ORDER BY created, rowid LIMIT 1 OFFSET 2').get(A.id).id;
  const r = await call('POST', '/studio/version', { asset: A.id, restoreFrom: early }); eq(r.status, 200, r.text.slice(0, 120));
  const a = await asset(); const cur = a.versions.find(v => v.id === a.current); eq([cur.copy.headline, cur.n, a.versionsTotal], ['edit 2', 76, 76]);
});
await T.t('readiness and the review link judge the current version, not a stale one', async () => {
  const a = await asset(); ok(a.readiness && (a.readiness.version === a.current || a.readiness.version === undefined), 'readiness of ' + (a.readiness || {}).version);
  const r = await call('GET', '/studio/used?asset=' + A.id); ok(r.status === 200 && (r.body.version === a.current || (r.body.version || {}).id === a.current || r.body.versionId === a.current || JSON.stringify(r.body).indexOf(a.current) >= 0), 'what the Studio used names the current version');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
