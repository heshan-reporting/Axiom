/* Concurrent edits never silently lose work. Two requests are started together while every database read is
 * delayed, so both read the same state before either writes - the real interleaving of two people (or a person
 * and a job) acting at once. With a revision, exactly one wins and the other gets 409 conflict with nothing
 * written; without one, the server re-applies the change on top of the winner so both survive.
 * Run: node --experimental-sqlite tests/concurrency-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('concurrency-worker (overlapping requests; providers MOCKED)');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
const call = (m, p, b) => w.call(m, p, b, 'full-key');
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Race', brief: { objective: 'o0', message: 'm0' }, idem: 'race-1' })).body.id;
const A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'Tile', copy: { headline: 'H0', support: 'S0', cta: 'C0' }, mode: 'composition' })).body.asset;
const get = async () => (await call('GET', '/studio/get?id=' + P)).body;
const together = async (...reqs) => { w.slowReads(12); try { return await Promise.all(reqs.map(f => f())); } finally { w.slowReads(0); } };

await T.t('two brief saves from the same revision: one wins, the other is 409 conflict and nothing of it is written', async () => {
  const rev = (await get()).revision;
  const [a, b] = await together(
    () => call('POST', '/studio/project/update', { id: P, revision: rev, patch: { brief: { objective: 'from Alice' } } }),
    () => call('POST', '/studio/project/update', { id: P, revision: rev, patch: { brief: { objective: 'from Bob' } } }));
  eq([a.status, b.status].sort(), [200, 409], 'one success, one conflict: ' + a.status + ' ' + b.status);
  const loser = a.status === 409 ? a : b; eq(loser.body.error, 'conflict');
  const winner = a.status === 200 ? 'from Alice' : 'from Bob';
  eq((await get()).brief.objective, winner, 'the stored brief is the winner, not a silent overwrite by the loser');
});
await T.t('two brief saves with no revision, each changing a different field: both changes survive', async () => {
  await together(
    () => call('POST', '/studio/project/update', { id: P, patch: { brief: { audience: 'Farmers' } } }),
    () => call('POST', '/studio/project/update', { id: P, patch: { brief: { action: 'Sign the petition' } } }));
  const b = (await get()).brief; eq([b.audience, b.action], ['Farmers', 'Sign the petition'], 'neither change was lost');
});
await T.t('two version writes from the same asset revision: one becomes current, the other is 409 and appends nothing', async () => {
  const d = await get(); const a = d.assets.find(x => x.id === A.id); const n0 = a.versions.length;
  const [x, y] = await together(
    () => call('POST', '/studio/version', { asset: A.id, revision: a.revision, copy: { headline: 'Alice headline' }, note: 'alice' }),
    () => call('POST', '/studio/version', { asset: A.id, revision: a.revision, copy: { headline: 'Bob headline' }, note: 'bob' }));
  eq([x.status, y.status].sort(), [200, 409], x.status + ' ' + y.status + ' ' + (x.body.error || '') + (y.body.error || ''));
  const a2 = (await get()).assets.find(z => z.id === A.id);
  eq(a2.versions.length, n0 + 1, 'exactly one version appended');
  const cur = a2.versions.find(v => v.id === a2.current); eq(cur.copy.headline, x.status === 200 ? 'Alice headline' : 'Bob headline');
});
await T.t('two hand edits without a revision (two tabs, different fields): both land, the second on top of the first', async () => {
  await together(
    () => call('POST', '/studio/version', { asset: A.id, copy: { support: 'Support from tab one' }, note: 'tab one' }),
    () => call('POST', '/studio/version', { asset: A.id, copy: { cta: 'CTA from tab two' }, note: 'tab two' }));
  const a2 = (await get()).assets.find(z => z.id === A.id); const cur = a2.versions.find(v => v.id === a2.current);
  eq([cur.copy.support, cur.copy.cta], ['Support from tab one', 'CTA from tab two'], 'the current version carries both edits');
  const last2 = a2.versions.slice(-2); eq(last2[1].parent, last2[0].id, 'the later version was made from the earlier one, not from the same base');
});
await T.t('two locks set at the same moment on different elements: both locks hold', async () => {
  await together(() => call('POST', '/studio/lock', { asset: A.id, element: 'headline', locked: true }), () => call('POST', '/studio/lock', { asset: A.id, element: 'cta', locked: true }));
  const a2 = (await get()).assets.find(z => z.id === A.id); eq([!!a2.locks.headline, !!a2.locks.cta], [true, true]);
});
await T.t('a restore racing an edit from the same revision: one wins, the other is a conflict, nothing silently replaced', async () => {
  const d = await get(); const a = d.assets.find(x => x.id === A.id); const first = a.versions[0].id;
  const [x, y] = await together(
    () => call('POST', '/studio/version', { asset: A.id, revision: a.revision, restoreFrom: first }),
    () => call('POST', '/studio/version', { asset: A.id, revision: a.revision, copy: { caption: 'new caption' }, unlock: true }));
  eq([x.status, y.status].sort(), [200, 409]);
});
await T.t('a stage writing the brief while a person saves it: the person\'s field survives the stage\'s write', async () => {
  const p0 = await get();
  // the strategy stage writes brief.strategy; the person writes brief.message at the same time, both from the same read
  const { stBriefPatch } = w.mod.__test;
  ok(typeof stBriefPatch === 'function', 'the stage writes through stBriefPatch');
  await together(
    () => stBriefPatch(w.env, P, b => Object.assign(b, { strategy: { idea: 'It is your tractor too', status: 'proposed' } })),
    () => call('POST', '/studio/project/update', { id: P, patch: { brief: { message: 'Not a subsidy' } } }));
  const b = (await get()).brief; eq([b.message, (b.strategy || {}).idea], ['Not a subsidy', 'It is your tractor too']);
  ok((await get()).revision >= p0.revision + 2, 'both writes bumped the revision');
});
await T.t('an approval racing a new version: it is recorded only for the version that is still current, otherwise 409 version_moved', async () => {
  // validation is not the point here: approve copy, which needs no measurement
  const d = await get(); const a = d.assets.find(z => z.id === A.id);
  const [ap, ed] = await together(
    () => call('POST', '/studio/approve', { asset: A.id, part: 'copy', decision: 'approve', reason: 'Agreed on the call' }),
    () => call('POST', '/studio/version', { asset: A.id, copy: { caption: 'changed during approval' }, note: 'edit', unlock: true }));
  ok(ed.status === 200, 'the edit landed: ' + ed.status);
  const a2 = (await get()).assets.find(z => z.id === A.id);
  if (ap.status === 200) eq((a2.approvals.copy || {}).version === a2.current || !a2.approvals.copy, true, 'an approval that stands names the current version');
  else eq(ap.body.error, 'version_moved');
  const rows = w.env.MIND_DB.db.prepare('SELECT version FROM studio_approvals WHERE asset=?').all(A.id); ok(rows.every(r => a2.versions.some(v => v.id === r.version)), 'every approval names a real version');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
