/* P49: the 4 November production-readiness audit of the worker behind the Creative Studio (prompts/studio-production-ready.md),
 * against the worker module in this process with every provider MOCKED. Each case fails on 0e1590f and passes with its fix.
 *   F2  a copy approval made while copy checks stand (a banned term, a figure that differs, an address that is not the
 *       campaign's) is recorded with those checks named in its reason: approval stays a person's decision, and the record
 *       says what they approved over
 *   F6  the brief's channels and formats are stored as known channels and formats only (they were stored as sent)
 *   F7  the library gives every recent project its lead composition and true piece counts on a busy client (the current
 *       versions were read in one capped query of 90)
 *   F8  a source sweep of more than 100 sources does not exceed D1's limit of 100 bound variables
 *   F9  opening a project builds its assets' views concurrently and in the same order (each was built after the one before)
 * Run: node --experimental-sqlite tests/studio-p49-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('P49: copy approvals record their checks; brief channels; library counts; D1 variable limits; concurrent asset views');
const env0 = { ANTHROPIC_API_KEY: 'test', STUDIO_INSPECT: '0' };
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');

await S.t('F2: a copy approval over a banned term records the unresolved check in its reason; a clean one records none', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', { ns: 'mca', name: 'MCA', banned: [{ term: 'subsidy', why: 'the credit is not a subsidy', allowNegated: false }] });
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', title: 'Checks', brief: { objective: 'o' } })).body.id;
    const bad = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'linkedin', format: '1:1', title: 'Banned', mode: 'copy', copy: { headline: 'A subsidy for miners', caption: 'A subsidy for miners' } })).body.asset;
    ok(((bad.versions.find(v => v.id === bad.current) || {}).checks || []).some(c => c.state === 'banned'), 'the banned check stands on the version');
    const r = await F(w, 'POST', '/studio/approve', { asset: bad.id, part: 'copy', decision: 'approve', reason: 'Client signed off the wording' });
    eq(r.status, 200, 'approval stays possible: ' + JSON.stringify(r.body).slice(0, 200));
    const row = w.env.MIND_DB.db.prepare("SELECT reason FROM studio_approvals WHERE asset=? AND decision='approve'").get(bad.id);
    ok(/unresolved copy checks/.test(row.reason) && /banned/.test(row.reason), 'the reason names the check: ' + row.reason);
    const good = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'linkedin', format: '1:1', title: 'Clean', mode: 'copy', copy: { headline: 'Fuel used off-road is not taxed', caption: 'Fuel used off-road is not taxed' } })).body.asset;
    await F(w, 'POST', '/studio/approve', { asset: good.id, part: 'copy', decision: 'approve', reason: 'Client signed off the wording' });
    const row2 = w.env.MIND_DB.db.prepare("SELECT reason FROM studio_approvals WHERE asset=? AND decision='approve'").get(good.id);
    ok(!/unresolved copy checks/.test(row2.reason), 'a clean piece records nothing extra: ' + row2.reason);
  } finally { w.restore(); }
});

await S.t('F6: channels are known channels, once each; formats are known formats for those channels; on create and on update', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', title: 'Channels', brief: { objective: 'o', channels: ['instagram', 'bogus', 'instagram', { x: 1 }, 'linkedin'], formats: { instagram: '4:5', bogus: '1:1', linkedin: '7:7', facebook: '1:1' } } })).body;
    eq(P.brief.channels, ['instagram', 'linkedin'], 'channels on create');
    eq(P.brief.formats, { instagram: '4:5' }, 'formats on create (linkedin 7:7 is not a format; facebook is not a chosen channel)');
    const U = (await F(w, 'POST', '/studio/project/update', { id: P.id, revision: P.revision, patch: { brief: { channels: 'instagram', formats: ['x'] } } })).body;
    eq(U.brief.channels, [], 'a channel list that is not a list is none');
    eq(U.brief.formats, {}, 'formats that are not a map are none');
  } finally { w.restore(); }
});

await S.t('F7: on a client with 24 recent projects of 5 visual pieces each, every project has its lead and 5 visual pieces', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    w.env.MIND_DB.maxVars = 100;
    const ids = [];
    for (let i = 0; i < 24; i++) {
      const P = (await F(w, 'POST', '/studio/project', { ns: 'aep', title: 'Busy ' + i, brief: { objective: 'o' } })).body.id; ids.push(P);
      for (let j = 0; j < 5; j++) await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile ' + j, mode: 'composition', copy: { headline: 'Gas ' + i + '.' + j }, layout: LAYOUT });
    }
    const L = (await F(w, 'GET', '/studio/list?ns=aep')).body;
    const mine = (L.projects || []).filter(p => ids.indexOf(p.id) >= 0);
    eq(mine.length, 24, 'all 24 listed');
    const missing = mine.filter(p => !p.lead || !p.pieces || p.pieces.visual !== 5).map(p => p.title + ':' + JSON.stringify(p.pieces || null));
    eq(missing, [], 'every project has a lead and 5 visual pieces');
  } finally { w.restore(); }
});

await S.t('F8: sweeping 120 named sources stays under D1\'s 100 bound variables', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    w.env.MIND_DB.maxVars = 100;
    const ids = Array.from({ length: 120 }, (_, i) => 'src-' + i);
    let err = null; let out = null;
    try { out = await w.mod.__test.sourceSweep(w.env, { ids }); } catch (e) { err = e; }
    ok(!err, 'no D1 error: ' + (err && err.message));
    ok(out && out.ok !== false, 'the sweep answers: ' + JSON.stringify(out).slice(0, 200));
  } finally { w.restore(); }
});

await S.t('F9: a project of 12 assets opens with its asset views built concurrently, in the same order', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', title: 'Wide', brief: { objective: 'o' } })).body.id;
    const titles = []; for (let j = 0; j < 12; j++) { titles.push('Piece ' + String(j).padStart(2, '0')); await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: titles[j], mode: 'composition', copy: { headline: 'H' + j }, layout: LAYOUT }); }
    const fast = (await F(w, 'GET', '/studio/get?id=' + P)).body;
    const DELAY = 15; w.slowReads(DELAY); const log0 = w.env.MIND_DB.log.length; const t0 = Date.now();
    const slow = (await F(w, 'GET', '/studio/get?id=' + P)).body; const ms = Date.now() - t0; const reads = w.env.MIND_DB.log.length - log0; w.slowReads(0);
    eq(slow.assets.map(a => a.title), titles, 'the assets in their order');
    eq(JSON.stringify(slow.assets), JSON.stringify(fast.assets), 'the same views as without the delay');
    // built one after another, every read waits its turn: about reads x delay. Concurrently, well under half of that.
    ok(ms < reads * DELAY * 0.5, 'opened in ' + ms + ' ms for ' + reads + ' reads at ' + DELAY + ' ms (serial would be about ' + reads * DELAY + ' ms)');
  } finally { w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
