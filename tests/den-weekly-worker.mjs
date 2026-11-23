/* Weekly desks and their morning draft (build p70, DEN.md s.10.12), against the worker module in this process. No
 * provider is contacted: the model is a stub that writes from the evidence it is sent. Every outlet and story here is
 * invented. The clock is set to a named morning in Sydney and runs on from there; the worker and the seeds read the same
 * Date.now(), and it is put back however a case ends. Each case fails on p69 (26d3753).
 *   DW1 by cadence: a weekly desk with no report day set waits on the Tuesday and the Wednesday and is drafted on the
 *       Monday, once, over its own window; a daily desk is drafted on every one of those mornings, as before
 *   DW2 a report day of its own, on the Sydney calendar: set to Wednesday, a weekly desk waits on the Monday and at 23:59
 *       on the Tuesday in Sydney, and is drafted on the Wednesday morning (still Tuesday in UTC); a report day on a daily
 *       desk changes nothing
 *   DW3 the report day is saved by POST /den/desk/update as options.weekday (0 = Sunday ... 6 = Saturday); a value out of
 *       range or not a whole number is dropped and the saved day stands; the Options editor's own save keeps it
 * Run: node --experimental-sqlite tests/den-weekly-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('The Den: a weekly desk is drafted on its report day, a daily desk every day');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({}, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000;
// the clock at an instant, running on from there
const realNow = Date.now.bind(Date);
const at = async (iso, fn) => { const t = Date.parse(iso), off = t - realNow(); Date.now = () => realNow() + off; try { return await fn(t); } finally { Date.now = realNow; } };
let seq = 0;
// one story on each desk's issue, two hours before the clock: gas taxation (the AEP desk) and fuel tax credits (the MCA desk)
const seed = async (w, now) => {
  const rows = [['gastax', 'The Senate debates a gas export tax'], ['ftc', 'Fuel tax credit changes reach the Senate']].map(([issue, title]) => { seq++;
    return { src: 'pointpost', title: title + ' (' + seq + ')', body: 'Campaigners and producers set out their positions this week.', url: 'https://pointpost.example.com.au/weekly/' + seq, ts: now - 2 * H, meta: { issues: [issue], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }; });
  const r = await F(w, 'POST', '/archive/add', { kind: 'news', rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200));
};
// the stub model: a two-section brief citing the first story it was given; of(name) counts the calls for one desk
const model = w => { const calls = [];
  w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const m = (String(b.messages[0].content).match(/\[M:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0];
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'Coverage of the debate continued ' + m + '.', bottom: 'Activity is steady ' + m + '.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  return { calls, of: name => calls.filter(c => JSON.stringify(c.system).indexOf('(' + name + ')') >= 0).length }; };
const desk = async (w, id, patch) => { const r = await F(w, 'POST', '/den/desk/update', { id, patch }); if (r.status !== 200) throw new Error('desk update failed: ' + r.text.slice(0, 200)); return r.body.desk; };

await S.t('DW1 the morning draft by cadence: weekly on its report day (Monday unless set), daily every day', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: 'test-anthropic' }); const m = model(w); const cron = w.mod.__test.denBriefCron;
  const daily = await desk(w, 'aep_au', { auto_draft: true });
  const weekly = await desk(w, 'mca_au', { auto_draft: true, cadence: 'weekly', window_h: 168 });
  eq([daily.cadence, weekly.cadence, weekly.window_h, 'weekday' in weekly.options], ['daily', 'weekly', 168, false], 'a daily desk, and a weekly desk with no report day set');
  // Tuesday 17 November 2026, 8am in Sydney (Monday 21:00 in UTC)
  await at('2026-11-16T21:00:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted, ['aep_au'], 'Tuesday: the daily desk only'); ok(Array.isArray(r.waiting) && r.waiting.indexOf('mca_au: Monday') >= 0, 'the weekly desk waits for Monday: ' + JSON.stringify(r));
    eq([m.of('AEP national'), m.of('MCA national')], [1, 0], 'no model call for the weekly desk'); eq((await F(w, 'GET', '/den/brief?desk=mca_au')).body.brief, null, 'and no brief'); });
  // Wednesday 18 November, 8am in Sydney
  await at('2026-11-17T21:00:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted, ['aep_au'], 'Wednesday: the daily desk again'); ok(r.waiting.indexOf('mca_au: Monday') >= 0); eq(m.of('MCA national'), 0, 'still no call for the weekly desk'); });
  // Monday 23 November, 8am in Sydney (Sunday 21:00 in UTC): the report day
  await at('2026-11-22T21:00:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted.slice().sort(), ['aep_au', 'mca_au'], 'Monday: both'); eq(r.waiting, [], 'nothing waits on its report day');
    const br = (await F(w, 'GET', '/den/brief?desk=mca_au&day=2026-11-23')).body.brief; ok(br, 'Monday\'s weekly brief exists');
    eq([br.day, br.by, br.status, br.window.hours], ['2026-11-23', 'morning draft', 'draft', 168], 'Monday\'s brief, over the desk\'s own week');
    eq((await cron(w.env)).drafted, [], 'once on its day'); });
  eq([m.of('AEP national'), m.of('MCA national'), m.calls.length], [3, 1, 4], 'the daily desk every morning, the weekly desk on Monday');
  eq((await F(w, 'GET', '/den/briefs?desk=aep_au')).body.briefs.map(b => [b.day, b.by]), [['2026-11-23', 'morning draft'], ['2026-11-18', 'morning draft'], ['2026-11-17', 'morning draft']], 'a daily brief for each morning');
  eq((await F(w, 'GET', '/den/briefs?desk=mca_au')).body.briefs.map(b => b.day), ['2026-11-23'], 'one weekly brief');
});

await S.t('DW2 a report day of its own, on the Sydney calendar; a report day on a daily desk changes nothing', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: 'test-anthropic' }); const m = model(w); const cron = w.mod.__test.denBriefCron;
  const daily = await desk(w, 'aep_au', { auto_draft: true, options: { weekday: 3 } });
  const weekly = await desk(w, 'mca_au', { auto_draft: true, cadence: 'weekly', window_h: 168, options: { weekday: 3 } });
  eq([daily.cadence, daily.options.weekday, weekly.cadence, weekly.options.weekday], ['daily', 3, 'weekly', 3], 'both desks say Wednesday');
  // Monday 23 November, 8am in Sydney: not its day
  await at('2026-11-22T21:00:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted, ['aep_au'], 'Monday: the daily desk'); ok(r.waiting.indexOf('mca_au: Wednesday') >= 0, 'the weekly desk waits for Wednesday: ' + JSON.stringify(r)); });
  // 23:59 on Tuesday 24 November in Sydney: still not
  await at('2026-11-24T12:59:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted, ['aep_au'], 'Tuesday night: the daily desk'); ok(r.waiting.indexOf('mca_au: Wednesday') >= 0, 'a minute before Sydney\'s midnight is still Tuesday'); });
  // Wednesday 25 November, 8am in Sydney, while it is still Tuesday in UTC
  await at('2026-11-24T21:00:00Z', async now => { await seed(w, now); const r = await cron(w.env);
    eq(r.drafted.slice().sort(), ['aep_au', 'mca_au'], 'Wednesday in Sydney: both');
    eq((await F(w, 'GET', '/den/brief?desk=mca_au&day=2026-11-25')).body.brief.by, 'morning draft', 'Wednesday\'s weekly brief'); });
  eq([m.of('AEP national'), m.of('MCA national')], [3, 1], 'the daily desk with a stray report day is drafted every day; the weekly desk once');
});

await S.t('DW3 the report day is saved by /den/desk/update; a day out of range is dropped', async () => {
  const w = await mk(); const stored = id => JSON.parse(w.env.MIND_DB.db.prepare('SELECT options FROM den_desks WHERE id=?').get(id).options);
  const up = await F(w, 'POST', '/den/desk/update', { id: 'mca_au', revision: 1, patch: { cadence: 'weekly', window_h: 168, options: { weekday: 5 } } });
  eq([up.status, up.body.desk.cadence, up.body.desk.window_h, up.body.desk.options.weekday, up.body.desk.revision], [200, 'weekly', 168, 5, 2], 'Friday, saved with the cadence');
  eq(stored('mca_au').weekday, 5, 'kept in the desk\'s options in D1');
  for (const bad of [7, -1, 2.5, 10, '9', 'Friday', '', true, [], {}, null]) {
    const r = await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { options: { weekday: bad } } });
    eq([r.status, r.body.desk && r.body.desk.options.weekday], [200, 5], 'dropped, the saved day stands: ' + JSON.stringify(bad)); }
  eq((await desk(w, 'mca_au', { options: { weekday: 0 } })).options.weekday, 0, 'Sunday is 0');
  eq((await desk(w, 'mca_au', { options: { weekday: '6' } })).options.weekday, 6, 'a select\'s value as text is the same day, stored as a number');
  eq(stored('mca_au').weekday, 6);
  // the Options editor sends hidden, minEng, fold and density: the report day stays
  const ed = await desk(w, 'mca_au', { cadence: 'weekly', window_h: 168, auto_draft: true, options: { hidden: [], minEng: { x: 5 }, fold: false, density: 'compact' } });
  eq([ed.options.weekday, ed.options.density, ed.options.fold, ed.auto_draft], [6, 'compact', false, true], 'the editor\'s save keeps the report day');
  // out of range on a desk that has none: nothing is saved, so the default (Monday) holds
  const none = await desk(w, 'aep_au', { options: { weekday: 9 } }); ok(!('weekday' in none.options) && !('weekday' in stored('aep_au')), 'no report day saved: ' + JSON.stringify(none.options));
  ok(!('weekday' in (await F(w, 'GET', '/den/desks', null, 'read-key')).body.desks.find(d => d.id === 'mca_vic').options), 'another desk is untouched');
  const ro = await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { options: { weekday: 2 } } }, 'read-key'); eq([ro.status, stored('mca_au').weekday], [403, 6], 'a read key sets nothing');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
