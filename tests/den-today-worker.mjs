/* Anne's Den build p72, the today lane (W-C, UX-SPEC s.13): GET /den/desks?day= gives each desk what Today's report needs
 * before it draws (head, today, drafting, morning), against the worker module in this process. No provider is contacted
 * (the model is a stub). Every outlet, account, person and sentence here is invented. Each case fails on 2bf7f17.
 *   TW1 a desk with no brief: head is the three header lines the documents print for the day (the report's name, the
 *       client, "Date: <day> | Reporting window: <days with an en dash>"), and they are the lines the html export prints
 *       once a brief is started by hand on it; today and drafting null; morning off, due (a daily desk), no state; the
 *       answer names its day (today, Sydney); the desk's own fields are as they were
 *   TW2 a draft: today is that day's brief (id, draft, who wrote it, when it was first written, its revision, no filer);
 *       a person's save moves its revision, never its time; head equals the html export's lines; nothing is drafting and
 *       the morning draft has nothing left to do
 *   TW3 a filed brief: filed, who filed it and when; head equals the filed html export's lines (no DRAFT line in them)
 *   TW4 a live hold: drafting {since, by} from the hold that answers 409 draft_in_progress, for a desk with no brief; a
 *       hold past its end, or one from before p71 past its five minutes, is none; a desk with a brief shows none
 *   TW5 the morning run: a desk it left for a later tick (den_cron_left_<day>, as denBriefCron writes it) is 'left', one on
 *       and still to come is 'due', one off has no state; no reason is invented (the record holds none)
 *   TW6 a weekly desk off its report day is not due and has no state; on its day it is due
 *   TW7 names: a guest link sees no person's name, a staff view-only key does (one rule with the review, p72 integration) (who wrote it, who filed it, who is drafting); "morning
 *       draft", the run's own name, stays; a full key sees them all
 *   TW8 the cost: one statement over the day's briefs, none over the archive, the marks or the narratives (no board read);
 *       a hold read only for a desk with no brief; den_cron_left_<day> read at most once; no provider reached; within
 *       D1's 100 bound variables
 *   TW9 another day: ?day= reads that day's briefs; a desk with no brief that day has the window that ends with the day (as
 *       the page reads a past day's Board); nothing is due for the morning on a past day; a day that is not one reads today
 *   TW10 the export's own helper: denDocHead gives the lines the md, html and Slack documents print, for a desk with its own
 *       title and a weekly desk whose window crosses a month; /den/desks's head for such a brief equals its html export
 * Run: node --experimental-sqlite tests/den-today-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p72, the today lane: each desk\'s day on GET /den/desks');
const KEYS = { 'full-key': { n: 'Wren', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'other-key': { n: 'Tamsin', r: 'full' } };
const GUESTS = { 'guest-key-5678': { n: 'Visitor', r: 'full' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS) }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, D = 86400000, NOW = Date.now();
const DASH = String.fromCharCode(8211);
const syd = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const TODAY = syd(NOW), YDAY = syd(NOW - D);
// how far Sydney is ahead of UTC at an instant (the page's sydOffset), worked out here rather than taken from the worker
const sydOff = t => { const p = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t));
  const g = k => Number(p.find(x => x.type === k).value); return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(t / 1000) * 1000; };
let seq = 0;
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const story = o => Object.assign({ src: 'quaygazette', title: 'Harbour levy talks stall in the Senate ' + (++seq), body: 'Campaigners pressed the Senate on the gas export tax again this week.', url: 'https://quaygazette.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'quaygazette', tier: 'regional', juris: 'au', reg: 1 } }, o);
const seedDay = async w => push(w, 'news', [story({ ts: NOW - 5 * H }), story({ src: 'tidewire', url: 'https://tidewire.example.com.au/a', ts: NOW - 3 * H, meta: { issues: ['gastax'], source: 'tidewire' } }), story({ ts: NOW - 2 * H })]);
// the stub model: a brief long enough to file, citing the first story it was given
const model = w => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content; const m = (ev.match(/\[M:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0];
  const j = { sections: { summary: 'The harbour levy talks stalled in the Senate this week, with campaigners pressing senators at the quay ' + m + '. Coverage stayed regional and steady across the window.', bottom: 'Expect the levy debate to return when the Senate sits again next week ' + m + '.' }, ratings: { momentum: { level: 'moderate', trend: 'Stable' } } };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const desks = async (w, q, k) => { const r = await F(w, 'GET', '/den/desks' + (q || ''), null, k || 'read-key'); eq(r.status, 200, r.text.slice(0, 200)); return r.body; };
const deskOf = async (w, id, q, k) => (await desks(w, q, k)).desks.find(d => d.id === id);
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
// the html export's three header lines, as a reader sees them
const htHead = async (w, id) => { const h = (await F(w, 'GET', '/den/brief?id=' + id + '&format=html', null, 'read-key')).text;
  const m = /<body><h1>(.*?)<\/h1><p class="client">(.*?)<\/p><p class="sub">(.*?)<\/p>/.exec(h); ok(m, 'the html export has its header: ' + h.slice(0, 300)); return [unesc(m[1]), unesc(m[2]), unesc(m[3])]; };
const lines = hd => [hd.title, hd.client, 'Date: ' + hd.date + ' | Reporting window: ' + hd.window];
const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const words = day => { const [y, m, d] = day.split('-'); return Number(d) + ' ' + M[Number(m) - 1] + ' ' + y; };
const row = (w, sql, ...a) => w.env.MIND_DB.db.prepare(sql).get(...a);
// a brief as the database holds it, its window and label made by the worker's own denWindow (as a draft stores them)
const store = async (w, o) => { const T = w.mod.__test; const desk = await T.deskGet(w.env, o.desk); const win = T.denWindow(desk, { hours: o.hours || desk.window_h, to: o.to });
  w.env.MIND_DB.db.prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,filed_by,filed_at,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,'claude',?,?,?,?,?)")
    .run(o.id, o.desk, win.day, win.hours, win.from, win.to, o.status || 'draft', o.revision || 1, JSON.stringify({ summary: { text: 'A quiet window on the harbour levy.', cites: [] } }), '{}', JSON.stringify({ ids: {}, label: win.label, missed: [] }), o.by || 'Wren', o.filed_by || '', o.filed_at || 0, o.created || NOW - 3 * H, o.updated || NOW - H);
  return win; };
const hold = (w, desk, day, v) => w.kv.set('den_drafting_' + desk + '_' + day, JSON.stringify(v));
const NEW = ['head', 'today', 'drafting', 'morning'];

await S.t('TW1 a desk with no brief: its header lines, no brief, nothing drafting, the morning off', async () => {
  const w = await mk(); const T = w.mod.__test; await seedDay(w);
  const all = await desks(w); eq(all.day, TODAY, 'the answer names the day it describes (today, Sydney)');
  const d = all.desks.find(x => x.id === 'aep_vic'); ok(d, 'the desk is listed'); NEW.forEach(k => ok(k in d, 'each desk carries ' + k + ': ' + Object.keys(d).join(',')));
  const desk = await T.deskGet(w.env, 'aep_vic'); const win = T.denWindow(desk, {}, Date.now());
  eq(d.head, { title: 'Daily Activist Activity Brief', client: desk.client, date: words(TODAY), window: win.label.replace(/([0-9a-z])-([0-9])/gi, '$1' + DASH + '$2'), line: 'Date: ' + words(TODAY) + ' | Reporting window: ' + win.label.replace(/([0-9a-z])-([0-9])/gi, '$1' + DASH + '$2') }, 'the three header lines for today');
  eq([d.today, d.drafting, d.morning], [null, null, { on: false, due: true, state: null }]);
  eq([d.id, d.ns, d.cadence, d.sections.length > 0, typeof d.revision], ['aep_vic', 'aep', 'daily', true, 'number'], 'the desk\'s own fields are as they were');
  // the lines are the ones the html export prints once a brief is started by hand on the desk today
  const st = await F(w, 'POST', '/den/brief/save', { desk: 'aep_vic', sections: { summary: 'Started by hand: a quiet morning on the harbour levy.' } }); eq(st.status, 200, st.text.slice(0, 200));
  eq(lines(d.head), await htHead(w, st.body.brief.id), 'the header before the brief is the header of the brief');
  const d2 = await deskOf(w, 'aep_vic'); eq(lines(d2.head), await htHead(w, st.body.brief.id), 'and after it'); eq(d2.head.line, lines(d2.head)[2], 'line is the third line as printed');
});

await S.t('TW2 a draft: that day\'s brief, its writer, its first time and its revision', async () => {
  const w = await mk(); await seedDay(w); model(w); await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { auto_draft: true } });
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const b = JSON.parse(r.text).brief;
  const created = row(w, 'SELECT created FROM den_briefs WHERE id=?', b.id).created;
  let d = await deskOf(w, 'aep_au', '', 'full-key');
  eq(d.today, { id: b.id, status: 'draft', by: 'Wren', at: created, revision: b.revision, filed_by: '', filed_at: 0 }, 'today is the brief of the day');
  eq([d.drafting, d.morning], [null, { on: true, due: true, state: null }], 'a desk with its brief is drafting nothing and the morning has nothing left to do');
  eq(lines(d.head), await htHead(w, b.id), 'the header lines are the html export\'s');
  const sv = await F(w, 'POST', '/den/brief/save', { id: b.id, revision: b.revision, sections: { summary: 'Rewritten by a person: the harbour levy talks stalled again on Tuesday afternoon in the Senate chamber.' } }, 'other-key'); eq(sv.status, 200, sv.text.slice(0, 200));
  d = await deskOf(w, 'aep_au', '', 'full-key'); eq([d.today.revision, d.today.at, d.today.by], [sv.body.brief.revision, created, 'Wren'], 'a person\'s save moves the revision, never when it was first written or by whom');
  eq((await deskOf(w, 'aep_vic', '', 'full-key')).today, null, 'a sister desk has none');
});

await S.t('TW3 a filed brief: who filed it and when', async () => {
  const w = await mk(); await seedDay(w); model(w);
  const b = JSON.parse((await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).text).brief; const at = NOW - 20 * 60000;
  w.env.MIND_DB.db.prepare("UPDATE den_briefs SET status='filed', filed_by='Tamsin', filed_at=?, revision=revision+1 WHERE id=?").run(at, b.id);
  const d = await deskOf(w, 'aep_au', '', 'full-key');
  eq([d.today.status, d.today.filed_by, d.today.filed_at, d.today.revision, d.today.by], ['filed', 'Tamsin', at, b.revision + 1, 'Wren']);
  const hl = await htHead(w, b.id); eq(lines(d.head), hl, 'the filed html export\'s header'); ok(!/DRAFT/.test(hl.join(' ')), 'no DRAFT among the header lines');
});

await S.t('TW4 a draft being written: the hold, for a desk with no brief', async () => {
  const w = await mk(); await seedDay(w); model(w); const dr = async () => (await deskOf(w, 'aep_au', '', 'full-key')).drafting;
  hold(w, 'aep_au', TODAY, { at: NOW - 40000, by: 'Tamsin', until: NOW + 10 * 60000 });
  eq(await dr(), { since: NOW - 40000, by: 'Tamsin' }, 'a live hold');
  eq((await deskOf(w, 'mca_au', '', 'full-key')).drafting, null, 'a desk with none');
  // the same hold the draft route answers 409 draft_in_progress from
  const busy = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq([busy.status, JSON.parse(busy.text).error], [409, 'draft_in_progress'], 'the route refuses on the same hold: ' + busy.text.slice(0, 160));
  hold(w, 'aep_au', TODAY, { at: NOW - 20 * 60000, by: 'Tamsin', until: NOW - 60000 }); eq(await dr(), null, 'a hold past its end is none');
  hold(w, 'aep_au', TODAY, { at: NOW - 2 * 60000, by: 'morning draft' }); eq(await dr(), { since: NOW - 2 * 60000, by: 'morning draft' }, 'a hold from before p71 lasts five minutes');
  hold(w, 'aep_au', TODAY, { at: NOW - 6 * 60000, by: 'morning draft' }); eq(await dr(), null, 'and not six');
  const b = JSON.parse((await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).text).brief; ok(b && b.id, 'aep_au drafted');
  hold(w, 'aep_au', TODAY, { at: NOW - 30000, by: 'Tamsin', until: NOW + 10 * 60000 }); eq(await dr(), null, 'a desk with a brief shows its brief, not a hold');
});

await S.t('TW5 the morning run: left, due, off', async () => {
  const w = await mk(); await seedDay(w); const calls = model(w); const T = w.mod.__test;
  for (const id of ['aep_au', 'aep_vic']) eq((await F(w, 'POST', '/den/desk/update', { id, patch: { auto_draft: true } })).status, 200);
  eq((await deskOf(w, 'aep_vic')).morning, { on: true, due: true, state: 'due' }, 'on, due, still to come');
  // a tick with too little of its time left starts no draft: both desks are left for a later tick, as the cron records it
  const r = await T.denBriefCron(w.env, { t0: Date.now() - 14 * 60000 }); eq([r.drafted, r.left.sort()], [[], ['aep_au', 'aep_vic']], JSON.stringify(r)); eq(calls.length, 0);
  ok(w.kv.has('den_cron_left_' + TODAY), 'the run\'s own record of what it left');
  const a = await desks(w); const m = id => a.desks.find(d => d.id === id).morning;
  eq([m('aep_au'), m('aep_vic'), m('mca_au')], [{ on: true, due: true, state: 'left' }, { on: true, due: true, state: 'left' }, { on: false, due: true, state: null }]);
  ok(!('why' in m('aep_au')), 'no reason is made up: the record holds try counts only');
  // a later tick drafts one; it leaves the record, and its desk has nothing left to do
  const r2 = await T.denBriefCron(w.env, { window: false }); ok(r2.drafted.length >= 1, JSON.stringify(r2));
  const b = await desks(w); r2.drafted.forEach(id => { const d = b.desks.find(x => x.id === id); eq([d.morning.state, d.today.by], [null, 'morning draft'], id); });
});

await S.t('TW6 a weekly desk off its report day', async () => {
  const w = await mk(); const wd = new Date(TODAY + 'T00:00:00Z').getUTCDay();
  eq((await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { cadence: 'weekly', auto_draft: true, options: { weekday: (wd + 1) % 7 } } })).status, 200);
  eq((await deskOf(w, 'mca_au')).morning, { on: true, due: false, state: null }, 'not its day: not due, nothing to come');
  eq((await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { options: { weekday: wd } } })).status, 200);
  eq((await deskOf(w, 'mca_au')).morning, { on: true, due: true, state: 'due' }, 'its day');
  eq((await deskOf(w, 'mca_vic')).morning, { on: false, due: true, state: null }, 'a daily desk is due every day');
});

await S.t('TW7 names: stripped for a guest link, shown to a staff view-only key; the morning draft\'s own name stays', async () => {
  const w = await mk(); await seedDay(w); model(w);
  const b = JSON.parse((await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).text).brief; w.env.MIND_DB.db.prepare("UPDATE den_briefs SET status='filed', filed_by='Tamsin', filed_at=? WHERE id=?").run(NOW - 60000, b.id);
  hold(w, 'aep_vic', TODAY, { at: NOW - 30000, by: 'Tamsin', until: NOW + 10 * 60000 });
  await store(w, { id: 'bmorn', desk: 'mca_au', by: 'morning draft' });
  const seen = async k => { const a = await desks(w, '', k); const g = id => a.desks.find(d => d.id === id); return [g('aep_au').today.by, g('aep_au').today.filed_by, g('aep_vic').drafting.by, g('mca_au').today.by, g('aep_au').today.id, g('aep_au').today.filed_at > 0]; };
  eq(await seen('full-key'), ['Wren', 'Tamsin', 'Tamsin', 'morning draft', b.id, true], 'a full key sees who');
  eq(await seen('read-key'), ['Wren', 'Tamsin', 'Tamsin', 'morning draft', b.id, true], 'a staff view-only key sees who, as the brief view shows it (one rule with the review, p72 integration)');
  eq(await seen('guest-key-5678'), ['', '', '', 'morning draft', b.id, true], 'a guest link: the same');
  const T = w.mod.__test; eq([T.denNamesHidden({ ok: true, role: 'full', name: 'Wren' }), T.denNamesHidden({ ok: true, role: 'read', name: 'Reader' }), T.denNamesHidden({ ok: true, role: 'full', guest: true }), T.denNamesHidden({ ok: true, role: 'read', public: true }), T.denNamesHidden(null)], [false, false, true, true, false]);
});

await S.t('TW8 the cost: no model call, no window read, no board read', async () => {
  const w = await mk(); await seedDay(w); model(w);
  const b = JSON.parse((await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).text).brief; ok(b && b.id);
  for (const id of ['aep_vic', 'mca_au']) await F(w, 'POST', '/den/desk/update', { id, patch: { auto_draft: true } });
  w.kv.set('den_cron_left_' + TODAY, JSON.stringify({ mca_au: 1 }));
  await desks(w);   // the tables exist; what follows is one open of the page
  const db = w.env.MIND_DB; const orig = db.prepare.bind(db); const seen = []; db.prepare = sql => { seen.push(String(sql)); return orig(sql); };
  const kv = w.env.AXIOM_KV; const g0 = kv.get; const keys = []; kv.get = async k => { keys.push(String(k)); return g0(k); };
  db.maxVars = 100; w.outbound.length = 0;
  const a = await desks(w); db.prepare = orig; kv.get = g0;
  const briefs = seen.filter(q => /den_briefs/.test(q)); eq(briefs.length, 1, 'one statement over the briefs: ' + briefs.join(' | ')); ok(/day=\?/.test(briefs[0]) && /^\s*SELECT/i.test(briefs[0]), briefs[0]);
  eq(seen.filter(q => /arc_items|den_marks|narratives|sent_|arc_alerts/.test(q)), [], 'no window, board or strip read');
  const none = a.desks.filter(d => !d.today).map(d => 'den_drafting_' + d.id + '_' + TODAY).sort();
  eq(keys.filter(k => /^den_drafting_/.test(k)).sort(), none, 'a hold is read for each desk with no brief, and only for those');
  ok(keys.filter(k => /^den_cron_left_/.test(k)).length <= 1, 'the morning run\'s record at most once: ' + keys.join(','));
  eq(a.desks.find(d => d.id === 'mca_au').morning.state, 'left'); eq(w.outbound.length, 0, 'no provider reached');
});

await S.t('TW9 another day', async () => {
  const w = await mk(); const T = w.mod.__test;
  const yWin = await store(w, { id: 'byday', desk: 'aep_au', to: NOW - D, by: 'Tamsin', status: 'filed', filed_by: 'Tamsin', filed_at: NOW - 20 * H, created: NOW - 26 * H });
  eq(yWin.day, YDAY, 'the stored brief is yesterday\'s');
  await F(w, 'POST', '/den/desk/update', { id: 'aep_vic', patch: { auto_draft: true } });
  const a = await desks(w, '?day=' + YDAY, 'full-key'); eq(a.day, YDAY); const g = id => a.desks.find(d => d.id === id);
  eq([g('aep_au').today.id, g('aep_au').today.status, g('aep_au').today.filed_by], ['byday', 'filed', 'Tamsin'], 'that day\'s brief');
  eq(lines(g('aep_au').head), await htHead(w, 'byday'), 'its header is its export\'s');
  // the last moment of that Sydney day, as the page's dayEnd gives it for a past day's Board (docs/den.js)
  const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(YDAY); const end = Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) - sydOff(Date.UTC(+m[1], +m[2] - 1, +m[3], 12));
  const vic = await T.deskGet(w.env, 'aep_vic'); const want = T.denWindow(vic, { to: end });
  eq(want.day, YDAY, 'the window ending with the day is the day\'s'); eq(g('aep_vic').head.window, want.label.replace(/([0-9a-z])-([0-9])/gi, '$1' + DASH + '$2'), 'a desk with no brief that day: the window that ends with the day');
  eq([g('aep_vic').today, g('aep_vic').morning], [null, { on: true, due: true, state: null }], 'nothing is to come for a past morning');
  eq((await desks(w, '', 'full-key')).desks.find(d => d.id === 'aep_vic').morning.state, 'due', 'today it is');
  for (const bad of ['2026-13-40', 'yesterday', '2026-11-1', '']) eq((await desks(w, '?day=' + encodeURIComponent(bad))).day, TODAY, 'a day that is not one reads today: ' + bad);
});

await S.t('TW10 the export\'s own helper gives every document\'s header', async () => {
  const w = await mk(); const T = w.mod.__test;
  await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { cadence: 'weekly', window_h: 168, options: { title: 'Weekly Quarry Watch' } } });
  const to = Date.UTC(2026, 10, 3, 1);   // 3 November 2026, midday in Sydney: a week back crosses into October
  await store(w, { id: 'bweek', desk: 'mca_au', to, hours: 168 });
  const desk = await T.deskGet(w.env, 'mca_au'); const v = (await F(w, 'GET', '/den/brief?id=bweek', null, 'read-key')).body.brief;
  const hd = T.denDocHead(desk, v.day, v.window.label);
  eq([hd.title, hd.date, hd.window], ['Weekly Quarry Watch', '3 November 2026', '27 October' + DASH + '3 November 2026'], 'the desk\'s own title, an en dash across two months');
  const md = (await F(w, 'GET', '/den/brief?id=bweek&format=md', null, 'read-key')).text; ok(md.indexOf('# ' + hd.title + '\n\n' + hd.client + '\n\n' + hd.line + '\n') === 0, 'the md opens with its lines: ' + JSON.stringify(md.slice(0, 160)));
  const sl = (await F(w, 'GET', '/den/brief?id=bweek&format=slack', null, 'read-key')).text; ok(sl.indexOf('*' + hd.title + '* - ' + hd.client + ' | ' + hd.line) === 0, 'the Slack summary too: ' + JSON.stringify(sl.slice(0, 160)));
  eq(await htHead(w, 'bweek'), lines(hd), 'and the html');
  eq(lines((await deskOf(w, 'mca_au', '?day=2026-11-03')).head), lines(hd), '/den/desks?day= gives the same lines for that brief');
  eq(T.denDocHead(desk, '2026-11-03', '').window, '3 November 2026', 'no window label: the day, as the export prints it');
});

S.done();
