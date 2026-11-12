/* The archive's indexes (build p64). The collector's poll, Anne's Den and the tick all met "the database is busy" on
 * 12 November 2026 with 136,564 news rows held. D1 runs one statement at a time, and nearly every read of the archive
 * says "this kind, since this time" - which, with only the (kind, url) and (ts) indexes, SQLite answers by walking
 * every row of that kind ever held, article text included. Each case fails on the p63 commit.
 *   AI1 the index is made on request, said plainly, and listed; reading the list is read role, making it is full
 *   AI2 a windowed read of one kind walks the window, not the whole kind (the planner's own account, before and after)
 *   AI3 the tick makes it once and remembers; a database that refuses leaves the archive working and is tried again
 *   AI4 the public stats answer is counted once in ten minutes, in fewer passes, and never from every row
 * Run: node --experimental-sqlite tests/archive-index-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const S = suite('The archive\'s indexes: a windowed read walks the window');
const mk = env => workerEnv({ env: Object.assign({ AI_AUTOMATION: 'off', __pubSleep: async () => {} }, env || {}), keys: { 'full-key': { n: 'Heshan', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } });
const F = (w, m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
const plan = (w, sql) => w.env.MIND_DB.db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map(r => r.detail).join(' | ');
const NEWS = "SELECT id,title,url,src,ts,meta FROM arc_items WHERE kind='news' AND ts>? ORDER BY ts DESC LIMIT 400";
const MANY = "SELECT kind, ts, meta FROM arc_items WHERE ts>? AND kind IN (?,?,?,?,?) ORDER BY ts DESC LIMIT 6000";
const seed = (w, n) => { const db = w.env.MIND_DB.db; const ins = db.prepare('INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,?,?,?,?,?)'); const now = Date.now();
  for (let i = 0; i < n; i++) ins.run(i % 3 ? 'news' : 'sig_thread', i % 2 ? 'abc' : 'sbs', (i % 5 ? 'Budget day' : 'Fuel tax credit debate') + ' ' + i, 'body', 'https://e.example/' + i, '', 0, '{}', now - i * 3600000, now); };

await S.t('AI1 the index is made on request and listed', async () => {
  const w = await mk(); await F(w, 'GET', '/archive/stats', null, null);
  const before = (await F(w, 'GET', '/archive/index', null, 'read-key')); eq(before.status, 200, before.text.slice(0, 200)); ok(before.body.indexes.indexOf('arc_items_kind_ts') < 0 && before.body.missing.indexOf('arc_items_kind_ts') >= 0, 'not there yet, and said so: ' + before.text.slice(0, 200));
  eq((await F(w, 'POST', '/archive/index', {}, 'read-key')).status, 403, 'making an index is not a read'); eq((await F(w, 'POST', '/archive/index', {}, null)).status, 401);
  const made = await F(w, 'POST', '/archive/index', {}); eq([made.status, made.body.ok], [200, true], made.text.slice(0, 200)); ok(made.body.made.indexOf('arc_items_kind_ts') >= 0 && typeof made.body.ms === 'number', made.text.slice(0, 200));
  const again = await F(w, 'POST', '/archive/index', {}); eq([again.body.ok, again.body.made.length], [true, 0], 'nothing to make the second time: ' + again.text.slice(0, 200));
  const after = (await F(w, 'GET', '/archive/index', null, 'read-key')).body; ok(after.indexes.indexOf('arc_items_kind_ts') >= 0 && !after.missing.length, JSON.stringify(after).slice(0, 200));
});

await S.t('AI2 a windowed read of one kind walks the window, not the whole kind', async () => {
  const w = await mk(); await F(w, 'GET', '/archive/stats', null, null);
  ok(/arc_items_kurl \(kind=\?\)/.test(plan(w, NEWS)) && !/ts>\?/.test(plan(w, NEWS)), 'the defect: every news row ever held is walked: ' + plan(w, NEWS));
  await F(w, 'POST', '/archive/index', {});
  ok(/arc_items_kind_ts \(kind=\? AND ts>\?\)/.test(plan(w, NEWS)), 'one kind since a time: ' + plan(w, NEWS));
  ok(/arc_items_kind_ts \(kind=\? AND ts>\?\)/.test(plan(w, MANY)), 'several kinds since a time: ' + plan(w, MANY));
  // and the answer is the same rows
  seed(w, 60); const since = Date.now() - 10 * 3600000 - 1000; const rows = w.env.MIND_DB.db.prepare(NEWS).all(since); eq(rows.length, 7, 'news rows of the last ten hours'); ok(rows.every(r => r.ts > since));
});

await S.t('AI3 the tick makes it once and remembers; a refusal is soft', async () => {
  const w = await mk(); const T_ = w.mod.__test; ok(typeof T_.archiveIndexEnsure === 'function', 'archiveIndexEnsure is exported'); await F(w, 'GET', '/archive/stats', null, null);
  const db = w.env.MIND_DB.db; const orig = db.prepare.bind(db); let boom = true; let tries = 0;
  db.prepare = sql => { if (/CREATE INDEX IF NOT EXISTS arc_items_kind_ts/.test(String(sql))) { tries++; if (boom) throw new Error('D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window. Try again'); } return orig(sql); };
  const r1 = await T_.archiveIndexEnsure(w.env); eq([r1.ok, r1.made.length], [false, 0], JSON.stringify(r1).slice(0, 200)); ok(/busy|overloaded/i.test(r1.detail), r1.detail);
  eq((await F(w, 'GET', '/archive/stats', null, null)).status, 200, 'the archive still answers');
  ok(!(await w.env.AXIOM_KV.get('arc_idx_v2')), 'a failure is not remembered as done');
  boom = false; const r2 = await T_.archiveIndexEnsure(w.env); eq(r2.ok, true); ok(r2.made.indexOf('arc_items_kind_ts') >= 0); ok(await w.env.AXIOM_KV.get('arc_idx_v2'), 'done is remembered');
  const n = tries; const r3 = await T_.archiveIndexEnsure(w.env); eq([r3.ok, r3.known, tries], [true, true, n], 'and the database is not asked again');
  db.prepare = orig;
  // the tick is where it happens by itself
  const w2 = await mk(); let waited = null; await w2.mod.default.scheduled({}, w2.env, { waitUntil: p => { waited = p; } }); await waited;
  ok(/arc_items_kind_ts/.test(plan(w2, NEWS)), 'after one tick: ' + plan(w2, NEWS));
});

await S.t('AI4 the public stats answer is counted once in ten minutes, never from every row', async () => {
  const w = await mk(); await F(w, 'GET', '/archive/stats', null, null); seed(w, 60); await w.env.AXIOM_KV.delete('arc_stats_v1');
  const db = w.env.MIND_DB.db; const orig = db.prepare.bind(db); const seen = []; db.prepare = sql => { if (/arc_items/.test(String(sql))) seen.push(String(sql)); return orig(sql); };
  const a = await F(w, 'GET', '/archive/stats', null, null); eq(a.status, 200); eq([a.body.byKind.news, a.body.byKind.sig_thread], [40, 20]); ok(a.body.bySrc7d.abc > 0 && a.body.byDay.length >= 1, a.text.slice(0, 200));
  eq(a.body.issues.ftc, 12, 'the issue counts are the same figures as before, from one pass');
  const first = seen.length; ok(first >= 1 && first <= 4, 'four statements at most on the archive, not eight: ' + first);
  ok(seen.every(q => !/GROUP BY src/.test(q) || /INDEXED BY arc_items_ts/.test(q)), 'the by-source count reads the week, not the table');
  const b = await F(w, 'GET', '/archive/stats', null, null); eq(seen.length, first, 'the second reader in ten minutes costs the database nothing'); eq(b.body.byKind, a.body.byKind); ok(b.body.cached === true && a.body.cached !== true);
  db.prepare = orig; ok(/USING (COVERING )?INDEX arc_items_ts \(ts>\?\)/.test(plan(w, 'SELECT src, COUNT(*) c FROM arc_items INDEXED BY arc_items_ts WHERE ts>? GROUP BY src ORDER BY c DESC LIMIT 200')));
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
