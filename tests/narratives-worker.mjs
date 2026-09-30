/* Narratives harness: rows are placed into clusters with a stub embedding that
 * is deliberately semantic (a marker word picks the direction), Claude is a
 * stub that names clusters from their samples, Slack is a recorder. Origin,
 * spread order, pace, sentiment split, stance toward the client, counter
 * pairing, alerts, the list and drawer routes, edits, merges, the term
 * fallback and the cron. Run: node narratives-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});

const kv = new Map();
function hashVec(text) {
  // a 64-dimensional direction per marker, plus a little text-dependent noise
  const v = new Array(64).fill(0);
  const t = String(text).toLowerCase();
  const axis = /rort|billionaire/.test(t) ? 0 : /regional towns/.test(t) ? 8 : /surplus/.test(t) ? 16 : /duck/.test(t) ? 24 : /migration intake/.test(t) ? 28 : 32 + (t.length % 20);
  v[axis] = 1;
  let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  for (let k = 0; k < 6; k++) { v[40 + ((h >> (k * 4)) % 24)] += 0.12; }
  return v;
}
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })) }) },
  AI: { run: async (m, { text }) => ({ shape: [text.length, 64], data: text.map(hashVec) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async () => {}, get: async () => null, delete: async () => {} },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test',
  NARRATIVE_MAX_ROWS: '200',   // the default is 600; the broad-cluster fixture is 200 rows
};
kv.set('slack_webhooks', JSON.stringify({ mca: 'https://hooks.slack.test/mca', _default: 'https://hooks.slack.test/d' }));
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
async function drain() { for (let i = 0; i < 6 && ctx.waits.length; i++) { const w = ctx.waits.splice(0); await Promise.allSettled(w); } }
const claude = { calls: [] }; const slack = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('api.anthropic.com') >= 0) {
    const body = JSON.parse(init.body); const user = body.messages[0].content; claude.calls.push({ model: body.model, system: body.system, user });
    const clusters = Array.from(user.matchAll(/\[(\d+)\] shared terms: ([^\n]*)\n([\s\S]*?)(?=\n\[\d+\] |$)/g)).map(m => {
      const n = Number(m[1]); const samples = m[3];
      if (/rort|billionaire/i.test(samples)) return { n, label: 'Fuel tax credits are a subsidy for billionaire miners', summary: 'Posters and some outlets say the diesel rebate is welfare for big miners. Reddit and Bluesky carry most of it.', claim: 'The fuel tax credit is a subsidy for mining companies.', counter: 'The credit refunds a road tax on fuel used off public roads.', proponents: 'Reddit posters and climate groups', issues: ['ftc', 'mining'], scope: 'client', relevance: 3, why: 'a client issue head on' };
      if (/regional towns/i.test(samples)) return { n, label: 'Fuel tax credits keep regional towns alive', summary: 'Industry and regional voices say the rebate underwrites regional jobs. Mostly news and the Minerals Council.', claim: 'Fuel tax credits sustain regional employment.', counter: 'The money would do more in regional services.', proponents: 'mining industry and Coalition MPs', issues: ['ftc'], scope: 'client', relevance: 3, why: 'the client issue itself' };
      if (/surplus/i.test(samples)) return { n, label: 'Chalmers has the budget on track for a surplus', summary: 'Reporting and posts credit the Treasurer with a surplus path. Mostly news.', claim: 'The budget is on track.', counter: '', proponents: 'Labor and business press', issues: ['econ'], scope: 'politics', relevance: 2, why: 'federal budget politics' };
      if (/kidnap/i.test(samples)) return { n, label: 'Actor kidnapping saga grips fans', summary: 'Entertainment coverage of an actor abducted abroad.', claim: '', counter: '', proponents: 'entertainment press', issues: [], scope: 'off', relevance: 0, why: 'celebrity crime, no policy stake' };
      return { n, label: 'Unlabelled cluster', summary: '', claim: '', counter: '', proponents: '', issues: [] };
    });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ clusters }) }] }), { status: 200 });
  }
  if (u.startsWith('https://hooks.slack.test/')) { slack.push({ u, text: JSON.parse(init.body).text }); return new Response('ok', { status: 200 }); }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER);
const handler = mod.default;
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx);
  let d = null; try { d = await res.json(); } catch (e) { d = null; }
  return { status: res.status, d };
}
async function run(body) { const r = await req('POST', '/narratives/run', body || {}); await drain(); return (await req('GET', '/bridge/job?id=' + r.d.job, null, 'read-key')).d; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const row = (sql, ...a) => db.prepare(sql).get(...a);
const rows = (sql, ...a) => db.prepare(sql).all(...a);
const NOW = Date.now(), H = 3600e3;

console.log('narratives-worker harness');
await req('GET', '/sentiment/status', null, 'read-key');   // creates the sentiment tables the split and the stance read
const ins = db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)");
const put = (kind, src, title, body, url, meta, ago) => { ins.run(kind, src, title, body, url, JSON.stringify(meta), NOW - ago, NOW); return row('SELECT id FROM arc_items WHERE url=?', url).id; };
const judge = (id, tone, ents) => { db.prepare("INSERT OR REPLACE INTO sent_items(item,kind,platform,src,ts,tone,texttype,region,issues,entities,model,created) VALUES(?, 'x','x','x',?,?,'opinion','au','[]','[]','m',?)").run(id, NOW - H, tone, NOW); (ents || []).forEach(([e, st]) => db.prepare("INSERT INTO sent_entities(item,entity,stance,intensity,sarcasm,why,ts,platform,region,kind) VALUES(?,?,?,1,0,'',?, 'x','au','x')").run(id, e, st, NOW - H)); };
// cluster A: hostile, six rows across four channels, news first
const a1 = put('news', 'smh', 'Fuel tax credit a rort for billionaire miners, say critics', 'The diesel rebate hands billions to big miners.', 'https://smh.test/a1', { reg: 1, juris: 'nsw', issues: ['ftc', 'mining'] }, 20 * H);
const a2 = put('reddit_comment', 'reddit', 'Comment on: fuel tax', 'It is a rort. Billionaire miners pocket the fuel tax credit while we pay.', 'x:rcmt:a2', { sub: 'australia', thread: 't1', issues: ['ftc'], score: 120 }, 15 * H);
const a3 = put('sig_thread', 'bluesky', 'the fuel tax credit rort', 'the fuel tax credit rort for billionaire miners has to end', 'https://bsky.app/profile/did:plc:1/post/a3', { platform: 'bluesky', issues: ['ftc'], score: 40, comments: 9 }, 10 * H);
const a4 = put('comments', 'meta', 'Comment on: MCA ad', 'A rort. Billionaire miners do not need our fuel money.', 'x:mc:a4', { platform: 'meta', ns: 'mca', issues: ['ftc'] }, 8 * H);
const a5 = put('reddit_comment', 'reddit', 'Comment on: fuel tax', 'Another rort for the billionaire miners lobby, honestly.', 'x:rcmt:a5', { sub: 'AusFinance', thread: 't2', issues: ['ftc'], score: 15 }, 5 * H);
const a6 = put('sig_comment', 'youtube', 'Comment on: video', 'billionaire miners and their rort, the fuel tax credit', 'x:sigc:youtube:a6', { platform: 'youtube', thread: 'v1', issues: ['ftc'] }, 2 * H);
[a1, a2, a3, a4, a5, a6].forEach((id, i) => judge(id, i === 0 ? -0.1 : -0.7, [['mca', i === 0 ? 0 : -1], ['t_ftc', -1]]));
// cluster B: supportive, same issue, three rows
const b1 = put('news', 'theaustralian', 'Fuel tax credits keep regional towns alive, Minerals Council says', 'The Minerals Council said the rebate underwrites regional jobs.', 'https://ta.test/b1', { reg: 1, juris: 'au', issues: ['ftc', 'mining'] }, 18 * H);
const b2 = put('sig_thread', 'x', 'Fuel tax credits keep regional towns alive', 'Fuel tax credits keep regional towns alive. Hands Off Our Fuel.', 'https://x.com/i/web/status/b2', { platform: 'x', page: 'MineralsCouncil', page_name: 'Minerals Council of Australia', issues: ['ftc'], score: 300, comments: 40 }, 12 * H);
const b3 = put('reddit_comment', 'reddit', 'Comment on: fuel tax', 'Truth is fuel tax credits keep regional towns alive, ask anyone in Mount Isa.', 'x:rcmt:b3', { sub: 'australia', thread: 't1', issues: ['ftc'], score: 8 }, 6 * H);
[b1, b2, b3].forEach(id => judge(id, 0.5, [['mca', 1], ['t_ftc', 1]]));
// cluster C: another issue, three rows
const c1 = put('news', 'afr', 'Chalmers says budget on track for surplus', 'The Treasurer said the surplus is within reach.', 'https://afr.test/c1', { reg: 1, issues: ['econ'] }, 16 * H);
const c2 = put('news', 'abc', 'Budget surplus on track, Treasurer tells caucus', 'Chalmers briefed colleagues on the surplus.', 'https://abc.test/c2', { reg: 1, issues: ['econ'] }, 9 * H);
const c3 = put('reddit_comment', 'reddit', 'Comment on: budget', 'Surplus on track again, Chalmers gets no credit for it.', 'x:rcmt:c3', { sub: 'AusFinance', thread: 't3', issues: ['econ'], score: 30 }, 3 * H);
// a singleton and a row too short to place
put('news', 'age', 'Duck season decision looms for Victoria', 'The duck hunting call comes next week.', 'https://age.test/d1', { reg: 1, juris: 'vic', issues: ['regional'] }, 7 * H);
put('sig_comment', 'bluesky', 'Comment on: x', 'lol yes', 'x:sigc:bluesky:short', { platform: 'bluesky', thread: 'q', issues: [] }, 1 * H);

let A = '', B = '', C = '';
await t('GET /narratives/status before any run says what is bound and what waits', async () => {
  const r = await req('GET', '/narratives/status', null, 'read-key');
  eq(r.status, 200); eq(r.d.live, 0); eq(r.d.embeddings, true); eq(r.d.naming, true); eq(r.d.backlog, 14); eq(r.d.budget.cap, 120); eq(r.d.budget.model, 'claude-opus-5-5');
});
await t('a run places the rows: three narratives of several rows, one singleton, one row too short', async () => {
  const j = await run();
  eq(j.status, 'done'); eq(j.result.scanned, 14); eq(j.result.placed, 13); eq(j.result.skipped, 1); eq(j.result.started, 4); eq(j.result.joined, 9); eq(j.result.mode, 'embeddings');
  ok(/13 rows placed \(9 joined a live narrative, 4 started one\)/.test(j.result.summary), j.result.summary); ok(j.lines.some(l => l.kind === 'done' && /^finished: 13 rows placed/.test(l.text)), 'the finish line is the sentence');
  eq(j.result.touched.length, 4); eq(j.result.touched[0].added, 6); eq(j.result.touched[0].started, true);
  ok(!(await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives[0].terms && (await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives[0].termsTop.indexOf('rort') >= 0, 'the list carries the leading terms, not the vector');
  ok(j.lines.some(l => /13 rows placed: 9 joined a live narrative, 4 started one/.test(l.text)), j.lines.map(l => l.text).join(' | '));
  const ns = rows('SELECT id, n, first_platform, first_channel, status, side, issues, label FROM narratives ORDER BY n DESC');
  eq(ns.map(x => x.n), [6, 3, 3, 1]);
  A = ns[0].id; B = ns.find(x => x.n === 3 && /keep regional/.test(x.label)).id; C = ns.find(x => x.n === 3 && /surplus/i.test(x.label)).id;
  eq(ns[0].first_platform, 'news'); eq(ns[0].first_channel, 'smh'); eq(ns[0].status, 'emerging', 'six rows within 48h of first sight'); eq(ns[0].side, 'hostile');
  eq(JSON.parse(ns[0].issues).sort(), ['ftc', 'mining']);
  const sk = row("SELECT narrative FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url='x:sigc:bluesky:short')"); eq(sk.narrative, '', 'too short: marked so it is not looked at again');
});
await t('the narratives are named by Claude, five to a call, with issues and the client namespace', async () => {
  const a = row('SELECT label, summary, claim, counter_claim, proponents, issues, ns, labelled_n, model, scope, relevance FROM narratives WHERE id=?', A);
  eq(a.label, 'Fuel tax credits are a subsidy for billionaire miners'); ok(/Reddit and Bluesky/.test(a.summary)); ok(/refunds a road tax/.test(a.counter_claim)); eq(JSON.parse(a.issues), ['ftc', 'mining']); eq(a.ns, 'mca'); eq(a.labelled_n, 6); eq(a.scope, 'client'); eq(a.relevance, 3); eq(a.model, 'claude-opus-5-5');
  eq(claude.calls.length, 1, 'one call named all three'); ok(/ISSUES: ftc = Fuel tax credits/.test(claude.calls[0].user) && /shared terms: /.test(claude.calls[0].user));
  const d = row("SELECT label FROM narratives WHERE n=1"); eq(d.label, '', 'a singleton is not named');
});
await t('spread order, pace, split and amplifiers are counts over the rows', async () => {
  const r = await req('GET', '/narratives/one?id=' + A, null, 'read-key');
  eq(r.d.n, 6); eq(r.d.spread.map(s => s.platform), ['news', 'reddit', 'bluesky', 'meta', 'youtube'], 'the order the channels took it up');
  eq(r.d.platforms, { news: 1, reddit: 2, bluesky: 1, meta: 1, youtube: 1 });
  eq(r.d.n24, 6); eq(r.d.nprev, 0); eq(r.d.velocity, 6);
  eq(r.d.sentiment, { judged: 6, neg: 5, pos: 0, neu: 1, tone: -0.6 });
  eq(r.d.amplifiers[0].channel, 'r/australia'); eq(r.d.amplifiers[0].score, 120);
  eq(r.d.origin.url, 'https://smh.test/a1'); eq(r.d.items.length, 6); ok(r.d.termsTop.indexOf('rort') >= 0 && r.d.termsTop.indexOf('miners') >= 0, r.d.termsTop.join(','));
  ok(r.d.series.length >= 1 && r.d.series.length <= 2, 'rows 2h to 20h old fall in one or two Sydney days'); eq(r.d.series.reduce((s, x) => s + x.n, 0), 6); eq(r.d.client, 'Minerals Council of Australia'); eq(r.d.issueLabels[0], 'Fuel tax credits');
});
await t('two narratives on the same issue facing opposite ways are each other\'s counter', async () => {
  const a = row('SELECT counter, side FROM narratives WHERE id=?', A); const b = row('SELECT counter, side FROM narratives WHERE id=?', B); const c = row('SELECT counter FROM narratives WHERE id=?', C);
  eq(a.side, 'hostile'); eq(b.side, 'supportive'); eq(a.counter, B); eq(b.counter, A); eq(c.counter, '');
  const r = await req('GET', '/narratives/one?id=' + A, null, 'read-key'); eq(r.d.counterNarrative.label, 'Fuel tax credits keep regional towns alive');
});
await t('the emerging narrative on a client issue is reported to that client\'s Slack, once', async () => {
  eq(slack.length, 1); eq(slack[0].u, 'https://hooks.slack.test/mca');
  ok(/Emerging narrative\* for \*Minerals Council of Australia\*/.test(slack[0].text) && /subsidy for billionaire miners/.test(slack[0].text) && /first seen news/.test(slack[0].text) && /6 rows across 5 channels/.test(slack[0].text) && /hostile toward the client/.test(slack[0].text) && /news > reddit > bluesky > meta > youtube/.test(slack[0].text) && /smh\.test\/a1|bsky\.app/.test(slack[0].text), slack[0].text);
  eq(row('SELECT alerted FROM narratives WHERE id=?', A).alerted, 1);
  const j = await run(); eq(j.result.alerts, 0); eq(slack.length, 1);
  const st = await req('GET', '/narratives/status', null, 'read-key'); eq(st.d.alerted, 1); eq(st.d.emerging, 1); eq(st.d.named, 3); eq(st.d.backlog, 0);
});
await t('GET /narratives lists by pace with filters for issue, status, side, channel and words', async () => {
  const all = await req('GET', '/narratives?days=7', null, 'read-key');
  eq(all.d.narratives.length, 3, 'singletons are hidden by default'); eq(all.d.narratives[0].id, A); ok(!all.d.narratives[0].terms, 'the term vector stays server-side'); eq(all.d.narratives[0].client, 'Minerals Council of Australia');
  eq((await req('GET', '/narratives?issue=ftc', null, 'read-key')).d.narratives.length, 2);
  eq((await req('GET', '/narratives?status=emerging', null, 'read-key')).d.narratives.map(n => n.id), [A]);
  eq((await req('GET', '/narratives?side=supportive', null, 'read-key')).d.narratives.map(n => n.id), [B]);
  eq((await req('GET', '/narratives?platform=x', null, 'read-key')).d.narratives.map(n => n.id), [B]);
  eq((await req('GET', '/narratives?q=surplus', null, 'read-key')).d.narratives.map(n => n.id), [C]);
  eq((await req('GET', '/narratives?all=1', null, 'read-key')).d.narratives.length, 4);
  eq((await req('GET', '/narratives?sort=n&ns=mca', null, 'read-key')).d.narratives.map(n => n.n), [6, 3]);
});
await t('a new row close to a live narrative joins it, even without a shared tag when it is very close', async () => {
  put('sig_thread', 'mastodon', 'billionaire miners rort', 'what a rort these billionaire miners run', 'https://aus.social/@x/z1', { platform: 'mastodon', issues: [] }, 0.5 * H);
  const j = await run(); eq(j.result.joined, 1); eq(j.result.started, 0);
  eq(row('SELECT n FROM narratives WHERE id=?', A).n, 7);
  eq(row('SELECT narrative, platform FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url=?)', 'https://aus.social/@x/z1').platform, 'mastodon');
  const r = await req('GET', '/narratives/one?id=' + A, null, 'read-key'); eq(r.d.spread.length, 6);
});
await t('an operator edits a label, mutes, pins and merges; a muted narrative leaves the list; a read key cannot', async () => {
  const u = await req('POST', '/narratives/update', { id: C, label: 'Budget surplus narrative (edited)', pinned: true }); eq(u.d.narrative.label, 'Budget surplus narrative (edited)'); eq(u.d.narrative.edited, true); eq(u.d.narrative.pinned, true);
  eq((await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives[0].id, C, 'pinned first');
  await req('POST', '/narratives/update', { id: C, muted: true });
  eq((await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives.length, 2);
  eq((await req('GET', '/narratives?muted=1', null, 'read-key')).d.narratives.map(n => n.id), [C]);
  await req('POST', '/narratives/update', { id: C, muted: false });
  const m = await req('POST', '/narratives/merge', { into: B, from: C }); eq(m.d.ok, true); eq(m.d.narrative.n, 6);
  eq(row('SELECT COUNT(*) k FROM narratives WHERE id=?', C).k, 0); eq(row('SELECT COUNT(*) k FROM narrative_items WHERE narrative=?', B).k, 6);
  eq((await req('POST', '/narratives/update', { id: A, muted: true }, 'read-key')).status, 403); eq((await req('POST', '/narratives/run', {}, 'read-key')).status, 403);
  eq((await req('POST', '/narratives/merge', { into: A, from: A })).status, 400);
});
await t('without Workers AI the run falls back to term vectors and still joins near-copies', async () => {
  const AI = env.AI; delete env.AI;
  put('reddit_comment', 'reddit', 'Comment on: fuel tax', 'Billionaire miners pocket the fuel tax credit rort while we pay, again.', 'x:rcmt:a9', { sub: 'australia', thread: 't1', issues: ['ftc'] }, 0.2 * H);
  const j = await run(); eq(j.result.mode, 'terms'); eq(j.result.joined, 1);
  eq(row('SELECT narrative FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url=?)', 'x:rcmt:a9').narrative, A);
  env.AI = AI;
});
await t('the naming budget stops naming and says so; without the key narratives stay unnamed but placed', async () => {
  env.NARRATIVE_DAILY_CALLS = '1';
  put('news', 'smh', 'Migration intake debate reignites', 'The migration intake is back on the agenda with three new reports.', 'https://smh.test/m1', { reg: 1, issues: ['gov'] }, 0.3 * H);
  put('news', 'age', 'Migration intake: a second report', 'The migration intake debate has a second report today.', 'https://age.test/m2', { reg: 1, issues: ['gov'] }, 0.2 * H);
  put('news', 'abc', 'Third migration intake report lands', 'Yet another migration intake report.', 'https://abc.test/m3', { reg: 1, issues: ['gov'] }, 0.1 * H);
  let j = await run(); delete env.NARRATIVE_DAILY_CALLS;
  ok(j.result.errors.some(e => /naming budget of 1 calls reached/.test(e)), JSON.stringify(j.result.errors));
  delete env.ANTHROPIC_API_KEY;
  j = await run(); env.ANTHROPIC_API_KEY = 'test';
  ok(j.lines.some(l => /ANTHROPIC_API_KEY is not set: narratives stay unnamed/.test(l.text)));
});
await t('the cron runs the whole pass and leaves its summary', async () => {
  kv.delete('narr_last');
  await handler.scheduled({}, env, ctx); await drain();
  const last = JSON.parse(kv.get('narr_last')); ok(last && last.at && typeof last.placed === 'number', JSON.stringify(last));
  const st = await req('GET', '/narratives/status', null, 'read-key'); ok(st.d.last && st.d.live >= 2);
});
await t('a worker-side job that stopped logging is reported as stopped, not left running; a fresh one is untouched', async () => {
  db.prepare("INSERT INTO bridge_jobs(id,source,params,status,agent,who,created,claimed,finished,ok,result) VALUES('stalejob1','narratives','{}','running','','Hesh',?,?,0,0,'')").run(NOW - 4 * 60e3, NOW - 4 * 60e3);
  db.prepare("INSERT INTO bridge_jobs(id,source,params,status,agent,who,created,claimed,finished,ok,result) VALUES('freshjob1','narratives','{}','running','','Hesh',?,?,0,0,'')").run(NOW - 20e3, NOW - 20e3);
  const st = await req('GET', '/bridge/job?id=stalejob1', null, 'read-key');
  eq(st.d.status, 'failed'); eq(st.d.success, false); eq(st.d.result.error, 'worker_stopped'); ok(st.d.lines.some(l => l.kind === 'err' && /worker stopped before this job finished/.test(l.text)), JSON.stringify(st.d.lines));
  eq((await req('GET', '/bridge/job?id=freshjob1', null, 'read-key')).d.status, 'running');
  const j = await run({ budgetMs: 5000 }); eq(j.status, 'done'); ok(typeof j.result.deferred === 'number', 'the run reports what it deferred');
});
await t('a cluster past NARR_MAX rows is a topic: it takes no rows, is hidden, and Dissolve frees its rows', async () => {
  // a broad cluster whose centroid is the rort axis, with 200 rows on file
  const nins2 = db.prepare('INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,issue_counts,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  const vec = new Float32Array(64); vec[0] = 1;
  const b64 = Buffer.from(vec.buffer).toString('base64');
  nins2.run('broad1', '', '', '', '', '', '["ftc","mining","econ"]', '{"ftc":120,"mining":50,"econ":30}', '["mca"]', 'mca', 'unknown', 200, 40, 30, 1.3, NOW - 2 * 86400e3, 0, 'news', 'abc', NOW - H, '{"news":200}', '[]', '[]', '[]', '{}', '', 'growing', 0, 0, 0, 0, 0, '{}', b64, 64, 0, '', NOW - 2 * 86400e3, NOW);
  for (let i = 0; i < 200; i++) db.prepare("INSERT OR IGNORE INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','abc',?,?,?,'',0,'{\"issues\":[\"ftc\"]}',?,?)").run('broad story ' + i, 'x', 'https://broad.test/' + i, NOW - 30 * H, NOW);
  const bids = rows("SELECT id FROM arc_items WHERE url LIKE 'https://broad.test/%'").map(r => r.id);
  const iins = db.prepare("INSERT OR REPLACE INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,'broad1',?,'news','abc',0.9)");
  bids.forEach(id => iins.run(id, NOW - 30 * H));
  put('news', 'smh', 'Another rort for billionaire miners', 'The rort continues for billionaire miners, critics say.', 'https://smh.test/a9', { reg: 1, issues: ['ftc'] }, 0.4 * H);
  const j = await run();
  const placed = row('SELECT narrative FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url=?)', 'https://smh.test/a9');
  ok(placed.narrative !== 'broad1' && placed.narrative !== '', 'the row went to the fuel tax narrative, not the broad cluster: ' + placed.narrative);
  eq(row("SELECT status FROM narratives WHERE id='broad1'").status, 'broad', 'recounted as broad');
  ok(!(await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives.some(n => n.id === 'broad1'), 'hidden from the list');
  ok((await req('GET', '/narratives?days=7&all=1', null, 'read-key')).d.narratives.some(n => n.id === 'broad1'), 'shown with all=1');
  const st = await req('GET', '/narratives/status', null, 'read-key'); eq(st.d.broad, 1); eq(st.d.sim, 0.84); eq(st.d.simStrict, 0.91); eq(st.d.maxRows, 200);
  eq((await req('POST', '/narratives/reset', { broad: true }, 'read-key')).status, 403);
  const r = await req('POST', '/narratives/reset', { broad: true }); eq(r.d.ok, true); eq(r.d.narratives, 1); eq(r.d.items, 200);
  eq(row("SELECT COUNT(*) k FROM narratives WHERE id='broad1'").k, 0); eq(row("SELECT COUNT(*) k FROM narrative_items WHERE narrative='broad1'").k, 0);
  eq((await req('GET', '/narratives/status', null, 'read-key')).d.broad, 0);
});
await t('the anchor is a leading issue: a row sharing only a rarely-named issue must be near-duplicate to join', async () => {
  const a = row('SELECT issues, issue_counts FROM narratives WHERE id=?', A);
  eq(JSON.parse(a.issues).slice(0, 1), ['ftc']); ok(JSON.parse(a.issue_counts).ftc >= 6, a.issue_counts);
});
await t('POST /narratives/step recounts stale narratives and names one call of them, each answering what remains', async () => {
  const rc = await req('POST', '/narratives/step', { what: 'recount' }); eq(rc.status, 200); eq(rc.d.what, 'recount'); ok(typeof rc.d.remaining === 'number' && typeof rc.d.recounted === 'number', JSON.stringify(rc.d));
  db.prepare("UPDATE narratives SET label='', labelled_n=0 WHERE id=?").run(A);
  const nm = await req('POST', '/narratives/step', { what: 'name' }); eq(nm.status, 200); eq(nm.d.what, 'name'); ok(nm.d.named >= 1 && nm.d.named <= 5, 'one call names up to five: ' + nm.d.named); eq(nm.d.calls, 1); ok(nm.d.lines.some(l => l.kind === 'out' && /billionaire miners/.test(l.text)), JSON.stringify(nm.d.lines)); eq(typeof nm.d.remaining, 'number');
  eq((await req('POST', '/narratives/step', { what: 'name' }, 'read-key')).status, 403);
});
await t('a story that only brushes an issue and names no one cannot seed a narrative; one that names a politician can, and is then judged off-topic and hidden', async () => {
  // wide tag only ("government" in the text), no entity, no tight trigger: set aside
  put('news', 'news.com.au', 'Australian allegedly kidnapped by a foreign government', 'A Sydney man is being held abroad, his family says.', 'https://news.test/kidnap0', { reg: 1, issues: ['gov'] }, 0.5 * H);
  // the same kind of story but naming the Prime Minister: it may start, and the namer decides it is off-topic
  for (let i = 1; i <= 3; i++) put('news', ['smh', 'theage', 'abc'][i - 1], 'Actor kidnapping saga: Albanese says thoughts with family ' + i, 'The kidnapped actor remains missing; Albanese said his thoughts were with the family.', 'https://news.test/kidnap' + i, { reg: 1, issues: ['gov'] }, (0.4 - i * 0.05) * H);
  const j = await run();
  eq(row("SELECT narrative FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url='https://news.test/kidnap0')").narrative, '', 'set aside, not seeded');
  ok(j.result.unanchored >= 1, 'counted as set aside: ' + j.result.unanchored);
  const k = row("SELECT n.id, n.scope, n.relevance, n.label FROM narratives n JOIN narrative_items ni ON ni.narrative=n.id WHERE ni.item=(SELECT id FROM arc_items WHERE url='https://news.test/kidnap1')");
  ok(k && k.id, 'the Albanese story seeded a narrative'); eq(k.scope, 'off'); eq(k.relevance, 0); eq(k.label, 'Actor kidnapping saga grips fans');
  ok(!(await req('GET', '/narratives?days=7', null, 'read-key')).d.narratives.some(n => n.id === k.id), 'off-topic is hidden by default');
  ok((await req('GET', '/narratives?days=7&scope=off', null, 'read-key')).d.narratives.some(n => n.id === k.id), 'shown when asked for');
  ok((await req('GET', '/narratives?days=7&scope=client', null, 'read-key')).d.narratives.every(n => n.scope === 'client'), 'client scope narrows to client issues');
  eq((await req('GET', '/narratives/status', null, 'read-key')).d.off, 1);
  ok(j.lines.some(l => /kidnapping saga.*- off, hidden/.test(l.text)), 'the console says it was hidden and why');
});
await t('POST /narratives/step {what:place} places waiting rows synchronously, recounts, and leaves naming to the name steps', async () => {
  put('news', 'couriermail', 'Fuel tax credits keep regional towns alive, mayor says', 'The mayor said fuel tax credits keep regional towns alive and warned against cuts.', 'https://cm.test/b9', { reg: 1, juris: 'qld', issues: ['ftc'] }, 1 * H);
  const before = claude.calls.length;
  const r = await req('POST', '/narratives/step', { what: 'place', scan: 50 });
  eq(r.status, 200); eq(r.d.what, 'place'); ok(r.d.scanned >= 1, 'scanned ' + r.d.scanned); ok(r.d.placed >= 1, 'placed ' + r.d.placed); eq(typeof r.d.remaining, 'number'); eq(r.d.namingDeferred, true);
  eq(claude.calls.length, before, 'a place step never spends a naming call');
  ok(r.d.lines.some(l => /naming left to the name steps/.test(l.text)), JSON.stringify(r.d.lines.map(l => l.text)));
  const placed = row("SELECT narrative FROM narrative_items WHERE item=(SELECT id FROM arc_items WHERE url='https://cm.test/b9')");
  ok(placed && placed.narrative, 'the new row was placed: ' + JSON.stringify(placed));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
