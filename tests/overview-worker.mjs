/* Overview harness: GET /overview reads what the other modules keep - open
 * Sentinel alerts, narratives that gained rows, entities whose stance moved,
 * client issues against their own fourteen-day baseline, the newest tagged
 * rows and collection health - for one window. Run: node overview-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })) }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async () => {}, get: async () => null, delete: async () => {} },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test',
};
kv.set('social_last', JSON.stringify({ bluesky: { ok: true, filed: 41, at: Date.now() - 3600e3 }, mastodon: { ok: false, error: 'aus.social 502', at: Date.now() - 3600e3 } }));
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
globalThis.fetch = async () => new Response('', { status: 404 });
const mod = await import(WORKER); const handler = mod.default;
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; try { d = await res.json(); } catch (e) { d = null; } return { status: res.status, d };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const NOW = Date.now(), H = 3600e3, D = 86400e3;

console.log('overview-worker harness');
await req('GET', '/narratives/status', null, 'read-key');   // archive, sentiment (with the seeded register) and narratives tables
await req('GET', '/sentinel/alerts', null, 'read-key');     // arc_alerts
await req('GET', '/sources', null, 'read-key');             // the registry
const ins = db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',?,?,?,?)");
const put = (kind, src, title, url, meta, ago, tone) => { ins.run(kind, src, title, title, url, tone == null ? 0 : tone, JSON.stringify(meta), NOW - ago, NOW); return db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };
// fuel tax credits: seven rows in the last 24h, one a day for the thirteen days before
const ids = [];
for (let i = 0; i < 5; i++) ids.push(put('news', ['abc', 'smh', 'afr', 'guardian', 'theage'][i], 'Fuel tax credit story ' + i, 'https://news.test/ftc' + i, { reg: 1, issues: i < 2 ? ['ftc', 'mining'] : ['ftc', 'econ'] }, (2 + i * 3) * H, i === 0 ? -0.6 : 0));
ids.push(put('reddit_thread', 'reddit', 'Is the diesel rebate a rort?', 'https://reddit.com/r/australia/comments/t1', { sub: 'australia', issues: ['ftc'], score: 300, comments: 88 }, 4 * H, -0.5));
ids.push(put('reddit_thread', 'reddit', 'Mount Isa and the fuel credit', 'https://reddit.com/r/australia/comments/t2', { sub: 'AusFinance', issues: ['ftc'], score: 20, comments: 9 }, 9 * H, 0.4));
for (let dday = 1; dday <= 13; dday++) put('news', 'abc', 'Older fuel tax credit story ' + dday, 'https://news.test/old-ftc' + dday, { reg: 1, issues: ['ftc'] }, dday * D + 3 * H);
// the economy: one recent row, six over the fortnight
put('news', 'afr', 'Chalmers on the surplus', 'https://news.test/econ1', { reg: 1, issues: ['econ'] }, 6 * H);
for (let dday = 1; dday <= 6; dday++) put('news', 'afr', 'Older surplus story ' + dday, 'https://news.test/old-econ' + dday, { reg: 1, issues: ['econ'] }, dday * 2 * D);
// a comment with an issue (counted in the baseline, not listed in latest) and an untagged story (neither)
put('reddit_comment', 'reddit', 'Comment on: fuel tax', 'x:rcmt:c1', { sub: 'australia', issues: ['ftc'] }, 3 * H, -0.7);
put('news', 'smh', 'Weather warning for Sydney', 'https://news.test/weather', { reg: 1, issues: [] }, 1 * H);
// narratives: one emerging with rows today, one steady without, one fading
const nins = db.prepare('INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
nins.run('n1a', 'Fuel tax credits are a subsidy for billionaire miners', 'sum', 'claim', 'counter', 'Reddit posters', '["ftc","mining"]', '["mca"]', 'mca', 'hostile', 6, 6, 0, 6, NOW - 20 * H, ids[0], 'news', 'smh', NOW - H, '{"news":1,"reddit":4,"bluesky":1}', '[]', '[]', '[]', '{"judged":6,"neg":5,"pos":0,"neu":1,"tone":-0.6}', 'n2b', 'emerging', 1, NOW - 19 * H, 0, 0, 0, '{}', '', 0, 6, 'm', NOW - 20 * H, NOW);
nins.run('n2b', 'Fuel tax credits keep regional towns alive', 'sum', 'claim', '', 'industry', '["ftc"]', '["mca"]', 'mca', 'supportive', 5, 0, 2, 0, NOW - 3 * D, ids[1], 'news', 'theaustralian', NOW - 30 * H, '{"news":2,"x":3}', '[]', '[]', '[]', '{"judged":5,"neg":0,"pos":4,"neu":1,"tone":0.5}', 'n1a', 'steady', 0, 0, 0, 0, 0, '{}', '', 0, 5, 'm', NOW - 3 * D, NOW);
nins.run('n3c', 'Chalmers has the budget on track for a surplus', 'sum', 'claim', '', 'press', '["econ"]', '["chalmers"]', 'cmm', 'unknown', 7, 0, 3, 0, NOW - 5 * D, ids[2], 'news', 'afr', NOW - 40 * H, '{"news":7}', '[]', '[]', '[]', '{"judged":0,"neg":0,"pos":0,"neu":0,"tone":null}', '', 'fading', 0, 0, 0, 0, 0, '{}', '', 0, 7, 'm', NOW - 5 * D, NOW);
// stances: Albanese turned critical today after a warm day before; the MCA is spoken of critically
const sent = db.prepare("INSERT INTO sent_entities(item,entity,stance,intensity,sarcasm,why,ts,platform,region,kind) VALUES(?,?,?,1,0,'',?,'reddit','au','reddit_comment')");
ids.forEach((id, i) => { sent.run(id, 'albanese', -1, NOW - (i + 1) * H); sent.run(id, 'mca', i < 5 ? -1 : 0, NOW - (i + 1) * H); });
ids.slice(0, 4).forEach((id, i) => sent.run(id, 'albanese', 1, NOW - D - (i + 1) * H));
ids.slice(0, 3).forEach((id, i) => sent.run(id, 'chalmers', 0, NOW - (i + 1) * H));
// one open alert and one acknowledged
db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,tone,evidence,angle,detected_ts,notified_ts,acked_ts,acked_by,drafted_ts) VALUES('mca','Minerals Council','ftc','Fuel tax credits','high',9,2.6,3.4,5,-0.4,'[]',NULL,?,?,NULL,NULL,NULL)").run(NOW - 2 * H, NOW - 2 * H + 60e3);
db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,tone,evidence,angle,detected_ts,notified_ts,acked_ts,acked_by,drafted_ts) VALUES('aep','AEP','gas','Gas',  'med',4,1.5,2.7,3,0,'[]',NULL,?,?,?,'Hesh',NULL)").run(NOW - 30 * H, NOW - 30 * H, NOW - 29 * H);

await t('GET /overview answers the window: open alerts, narratives that moved, who moved, issues against baseline, the latest rows, collection', async () => {
  const r = await req('GET', '/overview', null, 'read-key');
  eq(r.status, 200); eq(r.d.ok, true); eq(r.d.hours, 24); eq(r.d.errors, []);
  eq(r.d.alerts.openCount, 1); eq(r.d.alerts.open[0].label, 'Fuel tax credits'); eq(r.d.alerts.open[0].ratio, 3.4); eq(r.d.alerts.open[0].open, true); eq(r.d.alerts.recent.length, 2);
  eq(r.d.narratives.moving.map(n => n.id), ['n1a'], 'only the narrative that gained rows today moves'); eq(r.d.narratives.moving[0].client, 'Minerals Council of Australia'); eq(r.d.narratives.moving[0].issueLabels[0], 'Fuel tax credits'); eq(r.d.narratives.moving[0].platforms, ['news', 'reddit', 'bluesky']);
  eq(r.d.narratives.fading.map(n => n.id), ['n3c']); eq(r.d.narratives.live, 3); eq(r.d.narratives.emerging, 1);
  const alb = r.d.sentiment.movers.find(e => e.id === 'albanese'); ok(alb, 'Albanese moved: ' + JSON.stringify(r.d.sentiment.movers.map(e => e.id))); eq(alb.n, 7); eq(alb.score, -1); eq(alb.change, -2); eq(alb.name, 'Anthony Albanese');
  ok(!r.d.sentiment.movers.some(e => e.id === 'chalmers'), 'no previous window, no move');
  eq(r.d.sentiment.hostileTo.map(e => e.id), ['mca']); eq(r.d.sentiment.loudest[0].id, 'albanese');
  const ftc = r.d.issues.find(i => i.id === 'ftc'); eq(ftc.recent, 8, 'seven stories and threads plus one comment'); eq(ftc.news, 5); eq(ftc.base, 1); eq(ftc.ratio, 8); eq(ftc.client, 'Minerals Council of Australia');
  const econ = r.d.issues.find(i => i.id === 'econ'); eq(econ.recent, 4, 'three fuel stories also tagged econ, plus the surplus story'); eq(econ.base, 0.5); eq(econ.ratio, 8);
  eq(r.d.issues[0].id, 'ftc', 'the issue furthest above its usual comes first'); ok(r.d.issues.length >= 10);
  eq(r.d.latest.length, 8, 'stories and threads with an issue, not comments, not the untagged'); eq(r.d.latest[0].title, 'Fuel tax credit story 0'); eq(r.d.latest.find(x => /rort/.test(x.title)).channel, 'r/australia'); eq(r.d.latest.find(x => /rort/.test(x.title)).comments, 88); eq(r.d.latest[0].issues, ['ftc', 'mining']);
  eq(r.d.totals.news, 6); eq(r.d.collection.sources.total > 100, true); eq(r.d.collection.social.map(s => [s.platform, s.ok, s.filed]), [['bluesky', true, 41], ['mastodon', false, null]]);
  eq(r.d.collection.social[1].error, 'aus.social 502');
});
await t('the window is the caller\'s: six hours changes the counts and the baseline', async () => {
  const r = await req('GET', '/overview?days=0.25', null, 'read-key');
  eq(r.d.hours, 6); eq(r.d.days, 0.25);
  const ftc = r.d.issues.find(i => i.id === 'ftc'); eq(ftc.recent, 4, 'rows two, three, four and five hours old'); ok(ftc.base < 1, 'a six-hour baseline is a quarter of a day: ' + ftc.base);
  eq(r.d.latest.length, 3);
});
await t('a part that fails is reported and the rest still answers', async () => {
  const orig = env.MIND_DB.prepare.bind(env.MIND_DB);
  env.MIND_DB.prepare = sql => { if (/FROM arc_alerts/.test(sql)) throw new Error('alerts table locked'); return orig(sql); };
  const r = await req('GET', '/overview', null, 'read-key');
  env.MIND_DB.prepare = orig;
  eq(r.status, 200); eq(r.d.ok, true); eq(r.d.errors, ['alerts table locked']); eq(r.d.alerts.openCount, 0); eq(r.d.narratives.moving.length, 1);
});
await t('the overview is read-role and GET only; without the database it says so', async () => {
  eq((await req('GET', '/overview', null, null)).status, 401);
  eq((await req('POST', '/overview', {}, 'full-key')).status, 404);
  const e2 = Object.assign({}, env, { MIND_DB: undefined });
  const res = await handler.fetch(new Request('https://newsaus.test/overview', { headers: { 'X-Axiom-Key': 'read-key' } }), e2, ctx);
  eq(res.status, 501);
});

// -- the daily brief --
const claude = { calls: [], answer: null, fail: '' };
globalThis.fetch = async (url, init) => {
  if (String(url).indexOf('api.anthropic.com') >= 0) {
    const body = JSON.parse(init.body); claude.calls.push({ model: body.model, system: body.system, user: body.messages[0].content });
    if (claude.fail) return new Response(JSON.stringify({ error: { type: 'x', message: claude.fail } }), { status: 400 });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: typeof claude.answer === 'string' ? claude.answer : JSON.stringify(claude.answer) }] }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const goodBrief = { headline: 'Fuel tax credit attack line spikes; Albanese turns critical', summary: 'Coverage of fuel tax credits ran eight times its usual today and a hostile narrative gained six rows. Albanese is spoken of more critically than yesterday. The Minerals Council is the client most exposed.', changed: [{ what: 'Fuel tax credits spiked to 8x baseline.', why: 'The Minerals Council owns the issue and the alert is unanswered.', evidence: ['A:1', 'I:ftc', 'N:n1a'] }], clients: [{ ns: 'mca', client: 'MCA', read: 'A hostile narrative on the credit is emerging across Reddit and Bluesky.', watch: ['the subsidy framing'], risks: ['it reaches the metro press'], openings: ['regional jobs counter-narrative'], actions: ['acknowledge the alert and draft the angle'], evidence: ['N:n1a', 'E:mca'] }, { ns: 'aep', client: 'AEP', read: 'Nothing on gas today.', watch: [], risks: [], openings: [], actions: [], evidence: [] }], narratives: [{ id: 'n1a', why: 'Six rows in a day, all hostile.', stance: 'hostile' }, { id: 'zzz', why: 'made up', stance: 'hostile' }], sentiment: [{ id: 'albanese', direction: 'more critical', why: 'every mention today was critical.' }, { id: 'nobody', direction: 'warmer', why: 'x' }], risks: ['the attack line reaches television'], actions: ['brief the MCA by midday'], gaps: ['no X search coverage today'] };
await t('GET /brief/daily before any brief says so, with the day it would be', async () => {
  const r = await req('GET', '/brief/daily', null, 'read-key');
  eq(r.status, 404); eq(r.d.error, 'no_brief'); ok(/^\d{4}-\d{2}-\d{2}$/.test(r.d.today), r.d.today); eq(r.d.days, []);
});
await t('POST /brief/daily gathers the evidence with ids, has Claude write the brief, ties it back to the data, stores it and files it in the Mind', async () => {
  claude.answer = goodBrief;
  const r = await req('POST', '/brief/daily', { days: 1 }, 'full-key');
  eq(r.status, 200, JSON.stringify(r.d).slice(0, 300)); eq(r.d.ok, true); eq(r.d.isToday, true); eq(r.d.by, 'Hesh'); eq(r.d.model, 'claude-opus-5-5');
  eq(claude.calls.length, 1); const u = claude.calls[0].user;
  ok(/\[A:1\] Fuel tax credits \(Minerals Council\) 3\.4x baseline/.test(u), 'alerts carry ids'); ok(/\[I:ftc\] Fuel tax credits \(mca\) 8 rows, 5 of them news, usual 1, 8x/.test(u), 'issues against baseline: ' + (u.match(/\[I:ftc\][^\n]*/) || [''])[0]);
  ok(/\[N:n1a\] Fuel tax credits are a subsidy for billionaire miners - Minerals Council of Australia \[Fuel tax credits, Mining and resources\]; 6 rows, 6 in the last 24h vs 0 the day before, emerging, moving; toward the client: hostile; split 5 hostile \/ 1 neutral \/ 0 warm of 6 judged/.test(u), 'the narrative line: ' + (u.match(/\[N:n1a\][^\n]*/) || [''])[0]);
  ok(/claim: claim\n   counter-claim: counter\n   carried by: Reddit posters/.test(u), 'claim, counter and proponents are in the evidence');
  ok(/\[E:albanese\] Anthony Albanese \(person, alp, Prime Minister\) 7 mentions, net -1, 7 critical \/ 0 supportive, change -2/.test(u), 'the stance line: ' + (u.match(/\[E:albanese\][^\n]*/) || [''])[0]);
  ok(/\[L:\d+\] Fuel tax credit story 0 \(abc, /.test(u), "headlines carry ids: " + (u.match(/\[L:[^\n]*/) || [""])[0]); ok(/COLLECTION: /.test(u) && /Sydney\)/.test(u));
  ok(/strict JSON only/.test(claude.calls[0].system) && /Australian spelling/.test(claude.calls[0].system));
  const b = r.d.brief; eq(b.headline, goodBrief.headline); eq(b.changed.length, 1); eq(b.changed[0].evidence, ['A:1', 'I:ftc', 'N:n1a']);
  eq(b.clients.map(c => c.client), ['Minerals Council of Australia', 'Australian Energy Producers'], 'client names come from the lexicon, not the model');
  eq(b.narratives.map(n => n.id), ['n1a'], 'a narrative id the evidence never gave is dropped'); eq(b.narratives[0].label, 'Fuel tax credits are a subsidy for billionaire miners'); eq(b.narratives[0].n, 6); eq(b.narratives[0].stance, 'hostile');
  eq(b.sentiment.map(s => s.id), ['albanese']); eq(b.sentiment[0].name, 'Anthony Albanese'); eq(b.sentiment[0].n, 7); eq(b.sentiment[0].change, -2);
  eq(r.d.stats.alertsOpen, 1); eq(r.d.stats.narrativesLive, 3); eq(r.d.stats.moving, 1);
  ok(/^# AXIOM daily brief - /.test(r.d.md) && /## Fuel tax credit attack line spikes/.test(r.d.md) && /### Minerals Council of Australia \(mca\)/.test(r.d.md) && /\| Fuel tax credits are a subsidy for billionaire miners `N:n1a` \| Minerals Council of Australia \| 6 \(6 today\) \| hostile \|/.test(r.d.md) && /\*\*Gaps in the evidence\*\*/.test(r.d.md), r.d.md);
  ok(r.d.mind && /^cmm_/.test(r.d.mind), 'filed in the Mind: ' + r.d.mind); eq(db.prepare("SELECT kind, title, ns FROM mind_docs WHERE id=?").get(r.d.mind).kind, 'brief_daily');
  ok(kv.has('brief_' + r.d.day)); eq(r.d.lines.filter(l => l.kind === 'cmd').length, 1); ok(/brief for .* written in .*: Fuel tax credit attack line/.test(r.d.lines[r.d.lines.length - 1].text));
});
await t('GET /brief/daily serves the latest as JSON or Markdown to a read key; /brief/list names the days', async () => {
  const r = await req('GET', '/brief/daily', null, 'read-key'); eq(r.status, 200); eq(r.d.brief.headline, goodBrief.headline); eq(r.d.isToday, true);
  const l = await req('GET', '/brief/list', null, 'read-key'); eq(l.d.days, [r.d.day]);
  const res = await handler.fetch(new Request('https://newsaus.test/brief/daily?day=' + r.d.day + '&format=md', { headers: { 'X-Axiom-Key': 'read-key' } }), env, ctx);
  eq(res.status, 200); ok(/text\/markdown/.test(res.headers.get('content-type'))); ok(/^# AXIOM daily brief/.test(await res.text()));
  eq((await req('GET', '/brief/daily?day=2020-01-01', null, 'read-key')).status, 404);
  eq((await req('POST', '/brief/daily', {}, 'read-key')).status, 403, 'writing needs a full key');
  eq((await req('GET', '/brief/daily', null, null)).status, 401);
});
await t('an invalid answer is asked for once more; the account spend limit is reported and not retried', async () => {
  claude.answer = 'not json at all'; claude.calls.length = 0;
  const r = await req('POST', '/brief/daily', {}, 'full-key'); eq(r.status, 500); eq(r.d.error, 'brief_failed'); eq(claude.calls.length, 2);
  claude.answer = goodBrief; claude.fail = 'You have reached your specified API usage limits. You will regain access on 2026-10-01 at 00:00 UTC.'; claude.calls.length = 0;
  const r2 = await req('POST', '/brief/daily', {}, 'full-key'); eq(r2.status, 500); ok(/usage limits/.test(r2.d.detail), r2.d.detail); eq(claude.calls.length, 1, 'no second try against a spent account');
  claude.fail = '';
  ok((await req('GET', '/brief/daily', null, 'read-key')).d.brief.headline === goodBrief.headline, 'the stored brief survived the failed rewrites');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
