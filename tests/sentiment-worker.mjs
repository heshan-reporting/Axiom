/* Sentiment harness: the entity register and its matcher, the classification
 * run with a stub Claude that judges by a few words, the sums by entity,
 * time, channel, region and issue, the evidence rows, the budget and the
 * cron. Real SQLite behind the D1 API. Run: node sentiment-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});

const kv = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })) }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async () => {}, get: async () => null, delete: async () => {} },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test',
};
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
async function drain() { for (let i = 0; i < 6 && ctx.waits.length; i++) { const w = ctx.waits.splice(0); await Promise.allSettled(w); } }

/* the stub Claude: judges each text by a few words, one JSON answer */
const claude = { calls: [], garbageFor: /GARBAGE/ , garbageLeft: 0 };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('api.anthropic.com') >= 0) {
    const body = JSON.parse(init.body); const user = body.messages[0].content;
    claude.calls.push({ model: body.model, system: body.system, user });
    if (claude.garbageLeft > 0 && claude.garbageFor.test(user)) { claude.garbageLeft--; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Sorry, here is my thinking without JSON' }] }), { status: 200 }); }
    const texts = Array.from(user.matchAll(/\[(\d+)\] ([^\n]*)\n([^\n]*)/g)).map(m => ({ n: Number(m[1]), head: m[2], text: m[3] }));
    const items = texts.map(t => {
      const ids = ((t.head.match(/mentions: (.*)$/) || [])[1] || '').split(',').map(s => s.trim()).filter(Boolean);
      const neg = /rort|disgrace|shameful|rubbish|lie|corporate welfare|hopeless|sell.?out/i.test(t.text), pos = /good on|welcome|fair enough|credit to|jobs for|well done|backs/i.test(t.text);
      const news = /^news/.test(t.head);
      const stance = news ? 0 : neg ? -1 : pos ? 1 : 0;
      return { n: t.n, tone: news ? -0.1 : neg ? -0.7 : pos ? 0.6 : 0, type: news ? 'news' : 'opinion', entities: ids.map(id => ({ id, stance: id === 'hoof' && neg ? 1 : stance, intensity: neg ? 2 : 1, sarcasm: /yeah right/i.test(t.text), why: neg ? 'calls it a rort' : pos ? 'says good on them' : 'reports it' })) };
    });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ items }) }] }), { status: 200 });
  }
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
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const row = (sql, ...a) => db.prepare(sql).get(...a);
const rows = (sql, ...a) => db.prepare(sql).all(...a);
const NOW = Date.now(), H = 3600e3;

console.log('sentiment-worker harness');
await t('GET /entities seeds the register: parties, people, organisations and topics with aliases', async () => {
  const r = await req('GET', '/entities', null, 'read-key');
  eq(r.status, 200); ok(r.d.total >= 90, 'seed size ' + r.d.total);
  const by = {}; r.d.entities.forEach(e => { by[e.id] = e; });
  eq(by.albanese.kind, 'person'); ok(by.albanese.aliases.indexOf('Albo') >= 0, 'albanese aliases: ' + JSON.stringify(by.albanese)); eq(by.albanese.party, 'alp');
  eq(by.mca.side, 'client'); eq(by.mca.ns, 'mca'); eq(by.lockthegate.side, 'opponent'); eq(by.t_ftc.kind, 'topic');
  ok(r.d.kinds.length === 4 && r.d.sides.length === 3, 'kinds and sides: ' + JSON.stringify([r.d.kinds, r.d.sides]));
  const people = await req('GET', '/entities?kind=person&q=premier', null, 'read-key'); ok(people.d.entities.length >= 6 && people.d.entities.every(e => e.kind === 'person'), 'premiers found: ' + people.d.entities.length);
});
await t('GET /entities/test shows which entities a text mentions, whole words only, and its region', async () => {
  const a = await req('GET', '/entities/test?text=' + encodeURIComponent('Albo and the Treasurer met Rio Tinto in Perth; the Greens want a fuel tax credit cut. Watt-hours are irrelevant.'), null, 'read-key');
  const ids = a.d.entities.map(e => e.id).sort();
  eq(ids, ['albanese', 'chalmers', 'grn', 'riotinto', 't_ftc']); eq(a.d.region, 'wa');
  const b = await req('GET', '/entities/test?text=' + encodeURIComponent('Eat your greens. The constable arrived at Bowen Basin.'), null, 'read-key');
  eq(b.d.entities.map(e => e.id), [], 'no bare-word false positives: ' + JSON.stringify(b.d.entities));
  const c = await req('GET', '/entities/test?text=' + encodeURIComponent('Fuel tax credits are a subsidy, Labor says.'), null, 'read-key');
  eq(c.d.entities.map(e => e.id).sort(), ['alp', 't_ftc'], 'plurals are implied');
});
await t('the register is edited by the operator and protected from the seed', async () => {
  const a = await req('POST', '/entities/add', { name: 'Kos Samaras', kind: 'person', aliases: 'Kos Samaras, Samaras', role: 'RedBridge director', side: 'neutral' });
  eq(a.status, 200); eq(a.d.added, true); eq(a.d.entity.id, 'kos_samaras'); eq(a.d.entity.aliases, ['Kos Samaras', 'Samaras']); eq(a.d.entity.edited, true);
  const u = await req('POST', '/entities/update', { id: 'chalmers', aliases: ['Chalmers', 'the Treasurer', 'Treasurer Chalmers', 'Jim'], role: 'Treasurer (edited)' });
  eq(u.d.entity.role, 'Treasurer (edited)'); eq(u.d.entity.edited, true); ok(u.d.entity.aliases.indexOf('Jim') >= 0);
  const ro = await req('POST', '/entities/add', { name: 'X' }, 'read-key'); eq(ro.status, 403);
  const bad = await req('POST', '/entities/add', { aliases: 'x' }); eq(bad.status, 400);
  const d = await req('POST', '/entities/delete', { id: 'kos_samaras' }); eq(d.d.deleted, 'kos_samaras');
  eq((await req('GET', '/entities?q=samaras', null, 'read-key')).d.entities.length, 0);
});
await t('POST /entities/sync-mps turns the MP register into person entities without touching edits', async () => {
  const none = await req('POST', '/entities/sync-mps', {}); eq(none.status, 400); eq(none.d.error, 'no_mps');
  db.prepare("INSERT OR REPLACE INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES('Q1','Anthony Albanese','Australian Labor Party','representatives','Grayndler','AlboMP','','',?)").run(NOW);
  db.prepare("INSERT OR REPLACE INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES('Q2','Barnaby Joyce','National Party of Australia','representatives','New England','Barnaby_Joyce','','',?)").run(NOW);
  db.prepare("INSERT OR REPLACE INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES('Q3','Larissa Waters','Australian Greens','senate','Queensland','larissawaters','','',?)").run(NOW);
  const r = await req('POST', '/entities/sync-mps', {}); eq(r.d.synced, 3);
  const e = (await req('GET', '/entities?q=barnaby', null, 'read-key')).d.entities[0];
  eq(e.id, 'mp_q2'); eq(e.party, 'nat'); eq(e.role, 'Member for New England (National Party of Australia)'); eq(e.source, 'mps'); eq(e.aliases, ['Barnaby Joyce']);
  await req('POST', '/entities/update', { id: 'mp_q2', aliases: ['Barnaby Joyce', 'Barnaby'], role: 'Member for New England, edited' });
  await req('POST', '/entities/sync-mps', {});
  eq((await req('GET', '/entities?q=barnaby', null, 'read-key')).d.entities[0].role, 'Member for New England, edited', 'an edit survives a re-sync');
});
/* rows to judge */
const ins = db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',?,?,?,?)");
const put = (kind, src, title, body, url, meta, ago, tone) => ins.run(kind, src, title, body, url, tone == null ? 0 : tone, JSON.stringify(meta), NOW - ago, NOW);
put('news', 'smh', 'Albanese defends fuel tax credit as Minerals Council launches campaign', 'The Prime Minister said the diesel rebate stays. The Minerals Council welcomed it.', 'https://smh.test/1', { reg: 1, juris: 'nsw', issues: ['ftc', 'mining'] }, 2 * H);
put('reddit_comment', 'reddit', 'Comment on: fuel tax thread', 'The fuel tax credit is a rort and Albanese is a sell-out. Disgrace.', 'x:rcmt:c1', { sub: 'australia', thread: 't1', issues: ['ftc'], score: 40 }, 3 * H, 0);
put('reddit_comment', 'reddit', 'Comment on: fuel tax thread', 'Good on the Minerals Council, it funds regional towns. Credit to Hands Off Our Fuel.', 'x:rcmt:c2', { sub: 'melbourne', thread: 't1', issues: ['ftc'], score: 3 }, 4 * H, 0);
put('sig_thread', 'bluesky', 'Chalmers says the budget is on track', 'Chalmers says the budget is on track. Yeah right, hopeless.', 'https://bsky.app/profile/did:plc:x/post/1', { platform: 'bluesky', issues: ['econ'], score: 12, comments: 2 }, 5 * H);
put('comments', 'meta', 'Comment on: MCA ad', 'Rubbish, the Minerals Council lie about everything', 'x:mc:1', { platform: 'meta', ns: 'mca', issues: ['mining'] }, 6 * H, -1);
put('sig_comment', 'youtube', 'Comment on: video', 'Great weather today, no politics here at all', 'x:sigc:youtube:z', { platform: 'youtube', thread: 'v', issues: [] }, 7 * H);
put('news', 'theage', 'Jacinta Allan backs V/Line upgrade for Gippsland', 'The Premier announced hourly trains.', 'https://age.test/2', { reg: 1, juris: 'vic', issues: ['regional', 'vicelection'] }, 8 * H);
put('sig_thread', 'x', 'GARBAGE test post about Chalmers', 'GARBAGE Chalmers said things', 'https://x.com/i/web/status/9', { platform: 'x', issues: [] }, 9 * H);
put('news', 'old', 'Old story about Albanese', 'Very old.', 'https://old.test/3', { issues: [] }, 100 * H);
let jobId = '';
await t('POST /sentiment/run judges the rows that mention an entity, marks the rest, and updates the archive tone', async () => {
  claude.garbageLeft = 0;   // every row is judged in this first run; the retry path has its own test below
  const r = await req('POST', '/sentiment/run', { limit: 100 }); eq(r.status, 200); jobId = r.d.job; await drain();
  const j = (await req('GET', '/bridge/job?id=' + jobId, null, 'read-key')).d;
  if (j.status !== 'done') console.log('       run result:', JSON.stringify(j.result), '\n       lines:', j.lines.map(l => l.kind + ' ' + l.text).join(' | ').slice(0, 900));
  eq(j.status, 'done'); ok(j.result.scanned >= 8 && j.result.scanned < 9, 'the 100-hour-old row is outside the window: ' + j.result.scanned);
  eq(j.result.skipped, 1, 'the weather comment mentions nothing'); eq(j.result.matched, 7); eq(j.result.classified, 7); eq(j.result.calls, 1);
  ok(j.lines.some(l => l.kind === 'cmd' && /claude claude-opus-5-5 batch 1: 7 texts/.test(l.text)), j.lines.map(l => l.text).join(' | '));
  ok(j.lines.some(l => /critical, .* neutral, .* supportive mentions/.test(l.text)));
  eq(claude.calls[0].model, 'claude-opus-5-5'); ok(/ENTITIES\n/.test(claude.calls[0].user) && /albanese: Anthony Albanese \(person, Prime Minister\)/.test(claude.calls[0].user), 'the glossary travels with the batch');
  const c1 = row("SELECT s.tone, s.texttype, s.region, s.platform, a.tone atone FROM sent_items s JOIN arc_items a ON a.id=s.item WHERE a.url='x:rcmt:c1'");
  eq(c1.tone, -0.7); eq(c1.texttype, 'opinion'); eq(c1.platform, 'reddit'); eq(c1.atone, -1, 'the model tone replaced the lexicon tone on the archive row');
  const c1e = rows("SELECT e.entity, e.stance, e.intensity, e.why FROM sent_entities e JOIN arc_items a ON a.id=e.item WHERE a.url='x:rcmt:c1' ORDER BY e.entity");
  eq(c1e.map(e => e.entity + ':' + e.stance), ['albanese:-1', 't_ftc:-1']); eq(c1e[0].why, 'calls it a rort');
  const news = row("SELECT s.texttype, s.region FROM sent_items s JOIN arc_items a ON a.id=s.item WHERE a.url='https://smh.test/1'"); eq(news.texttype, 'news'); eq(news.region, 'nsw', 'region from the source registry juris');
  const melb = row("SELECT s.region FROM sent_items s JOIN arc_items a ON a.id=s.item WHERE a.url='x:rcmt:c2'"); eq(melb.region, 'vic', 'region from the subreddit');
  const sk = row("SELECT model, entities FROM sent_items s JOIN arc_items a ON a.id=s.item WHERE a.url='x:sigc:youtube:z'"); eq(sk.model, 'none'); eq(sk.entities, '[]');
  // one provider call, reserved and settled in the D1 usage ledger (it replaced the KV counter in r6)
  const u = env.MIND_DB.db.prepare("SELECT reserved, confirmed FROM ai_usage WHERE scope='sentiment'").get(); eq([u.reserved, u.confirmed], [1, 1]);
});
await t('a classifier that answers without JSON is retried once, then the failure is recorded and the run goes on', async () => {
  // the GARBAGE row was in the single batch above and was judged with the rest; run it alone to see the retry path
  db.prepare("DELETE FROM sent_entities WHERE item IN (SELECT id FROM arc_items WHERE url='https://x.com/i/web/status/9')").run();
  db.prepare("DELETE FROM sent_items WHERE item IN (SELECT id FROM arc_items WHERE url='https://x.com/i/web/status/9')").run();
  claude.garbageLeft = 2; const before = claude.calls.length;
  const r = await req('POST', '/sentiment/run', { limit: 100 }); await drain();
  const j = (await req('GET', '/bridge/job?id=' + r.d.job, null, 'read-key')).d;
  eq(j.result.classified, 0); eq(j.result.ok, false); ok(/without valid JSON/.test(j.result.detail), j.result.detail); eq(claude.calls.length - before, 2, 'one retry');
  claude.garbageLeft = 0;
});
await t('GET /sentiment/entities is the leaderboard: mentions, net stance, shares, channels, regions', async () => {
  const r = await req('GET', '/sentiment/entities?days=7', null, 'read-key');
  const by = {}; r.d.entities.forEach(e => { by[e.id] = e; });
  eq(by.albanese.n, 2); eq(by.albanese.neg, 1); eq(by.albanese.pos, 0); eq(by.albanese.score, -0.5); eq(by.albanese.name, 'Anthony Albanese'); eq(by.albanese.kind, 'person');
  eq(by.mca.n, 3); eq(by.mca.side, 'client'); eq(by.mca.neg, 1); eq(by.mca.pos, 1);
  ok(by.mca.platforms.some(p => p.platform === 'reddit') && by.mca.platforms.some(p => p.platform === 'meta') && by.mca.platforms.some(p => p.platform === 'news'), JSON.stringify(by.mca.platforms));
  ok(by.mca.regions.some(x => x.region === 'vic'), JSON.stringify(by.mca.regions));
  eq(by.chalmers.sarcasm, 1, 'yeah right is sarcasm');
  eq(by.hoof.pos, 1, 'the campaign is credited');
  const red = await req('GET', '/sentiment/entities?days=7&platform=reddit', null, 'read-key'); ok(red.d.entities.every(e => e.platforms.every(p => p.platform === 'reddit')) && red.d.entities.find(e => e.id === 'albanese').n === 1);
  const vic = await req('GET', '/sentiment/entities?days=7&region=vic', null, 'read-key'); ok(vic.d.entities.some(e => e.id === 'allan') && vic.d.entities.some(e => e.id === 't_vline'));
  const ftc = await req('GET', '/sentiment/entities?days=7&issue=ftc', null, 'read-key'); ok(ftc.d.entities.some(e => e.id === 'albanese') && !ftc.d.entities.some(e => e.id === 'chalmers'), 'issue filter through the row\'s tags');
  const topics = await req('GET', '/sentiment/entities?days=7&kind=topic', null, 'read-key'); ok(topics.d.entities.length >= 2 && topics.d.entities.every(e => e.kind === 'topic'));
  ok(by.albanese.change === null, 'no previous window yet');
});
await t('GET /sentiment/series gives points over time, for an entity and for the whole conversation', async () => {
  const a = await req('GET', '/sentiment/series?entity=mca&days=30', null, 'read-key'); eq(a.d.bucket, 'day');
  // the rows are hours old, so they fall on one Sydney day or, run near midnight there, on two: the total is what is fixed
  ok(a.d.points.length >= 1 && a.d.points.length <= 2, JSON.stringify(a.d.points)); eq(a.d.points.reduce((x, p) => x + p.n, 0), 3);
  const b = await req('GET', '/sentiment/series?days=30&bucket=hour', null, 'read-key'); ok(b.d.points.length >= 3 && b.d.points.every(p => typeof p.score === 'number'), JSON.stringify(b.d.points));
  const c = await req('GET', '/sentiment/series?days=30&issue=ftc', null, 'read-key'); eq(c.d.points.reduce((x, p) => x + p.n, 0), 3);
});
await t('GET /sentiment/topics is tone by client issue with the entities named inside', async () => {
  const r = await req('GET', '/sentiment/topics?days=7', null, 'read-key');
  const ftc = r.d.topics.find(x => x.id === 'ftc'); eq(ftc.n, 3); eq(ftc.label, 'Fuel tax credits'); eq(ftc.client, 'Minerals Council of Australia'); eq(ftc.neg, 1); eq(ftc.pos, 1); eq(ftc.news, 1);
  ok(ftc.entities.some(e => e.id === 'mca' && e.n === 2), JSON.stringify(ftc.entities));
  ok(r.d.topics.some(x => x.id === 'vicelection'));
});
await t('GET /sentiment/items is the evidence: stance, the deciding phrase, the row and its link', async () => {
  const a = await req('GET', '/sentiment/items?entity=albanese&stance=-1&days=7', null, 'read-key');
  eq(a.d.items.length, 1); eq(a.d.items[0].why, 'calls it a rort'); eq(a.d.items[0].platform, 'reddit'); ok(/sell-out/.test(a.d.items[0].excerpt)); eq(a.d.items[0].intensity, 2);
  const b = await req('GET', '/sentiment/items?issue=ftc&stance=1&days=7', null, 'read-key'); eq(b.d.items.length, 1); ok(/Good on/.test(b.d.items[0].excerpt)); eq(b.d.items[0].stance, null); eq(b.d.items[0].tone, 0.6);
  const c = await req('GET', '/sentiment/items?entity=mca&platform=meta&days=7', null, 'read-key'); eq(c.d.items.length, 1); eq(c.d.items[0].stance, -1);
});
await t('GET /sentiment/status: counts, backlog, budget and the register size', async () => {
  const r = await req('GET', '/sentiment/status', null, 'read-key');
  eq(r.d.configured, true); eq(r.d.classified24, 6, 'seven judged, one undone by the garbage test'); eq(r.d.skipped24, 1); eq(r.d.mentions7, 11); ok(r.d.budget.used >= 2 && r.d.budget.cap === 300, JSON.stringify(r.d.budget)); eq(r.d.budget.model, 'claude-opus-5-5');
  ok(r.d.entities.active >= 90 && r.d.entities.people >= 40 && r.d.entities.topics >= 10, JSON.stringify(r.d.entities));
  eq(r.d.backlog, 1, 'the GARBAGE row still mentions Chalmers and waits'); ok(r.d.last && r.d.last.at);
});
await t('the daily budget stops a run and says so', async () => {
  env.SENTIMENT_DAILY_CALLS = '2';   // two calls have been spent already
  put('reddit_comment', 'reddit', 'Comment on: x', 'Chalmers is hopeless, what a disgrace', 'x:rcmt:c9', { sub: 'australia', thread: 't2', issues: ['econ'] }, 1 * H, 0);
  const r = await req('POST', '/sentiment/run', { limit: 100 }); await drain();
  const j = (await req('GET', '/bridge/job?id=' + r.d.job, null, 'read-key')).d;
  delete env.SENTIMENT_DAILY_CALLS;
  eq(j.result.classified, 0); ok(/daily budget of 2 Claude calls reached/.test(j.result.detail || (j.result.errors || [])[0]), JSON.stringify(j.result));
});
await t('a custom model is honoured', async () => {
  env.SENTIMENT_MODEL = 'claude-haiku-4-5-20251001';
  put('reddit_comment', 'reddit', 'Comment on: z', 'Good on Pauline Hanson, well done', 'x:rcmt:c11', { sub: 'australia', thread: 't2', issues: [] }, 1 * H, 0);
  const r = await req('POST', '/sentiment/run', { limit: 100 }); await drain();
  const j = (await req('GET', '/bridge/job?id=' + r.d.job, null, 'read-key')).d;
  delete env.SENTIMENT_MODEL;
  ok(j.result.classified >= 1, JSON.stringify(j.result)); eq(claude.calls[claude.calls.length - 1].model, 'claude-haiku-4-5-20251001');
});
await t('the cron judges within the budget and skips when the key is missing', async () => {
  put('reddit_comment', 'reddit', 'Comment on: y', 'Good on Chris Bowen for the battery scheme, well done', 'x:rcmt:c10', { sub: 'australia', thread: 't3', issues: ['energy'] }, 1 * H, 0);
  // automated model work is gated (AI_AUTOMATION; daily by default since 5 October 2026): held, the tick makes no call
  env.AI_AUTOMATION = 'off'; const held = claude.calls.length;
  await handler.scheduled({}, env, ctx); await drain();
  eq(claude.calls.length, held, 'held (AI_AUTOMATION=off): the cron made no classifier call');
  env.AI_AUTOMATION = 'always';
  const before = claude.calls.length;
  await handler.scheduled({}, env, ctx); await drain();
  delete env.AI_AUTOMATION;
  ok(claude.calls.length > before, 'the cron called the classifier (AI_AUTOMATION=always)');
  const c = row("SELECT e.stance FROM sent_entities e JOIN arc_items a ON a.id=e.item WHERE a.url='x:rcmt:c10'"); eq(c && c.stance, 1, 'the cron judged the new row');
  delete env.ANTHROPIC_API_KEY;
  const st = await req('GET', '/sentiment/status', null, 'read-key'); eq(st.d.configured, false);
  const run = await req('POST', '/sentiment/run', {}); eq(run.status, 501);
  env.ANTHROPIC_API_KEY = 'test';
});
await t('a read-only key reads everything and changes nothing', async () => {
  eq((await req('GET', '/sentiment/entities', null, 'read-key')).status, 200);
  eq((await req('POST', '/sentiment/run', {}, 'read-key')).status, 403);
  eq((await req('POST', '/entities/sync-mps', {}, 'read-key')).status, 403);
  eq((await req('POST', '/entities/update', { id: 'alp', active: false }, 'read-key')).status, 403);
});
await t('POST /sentiment/step does one Claude call inside the request and reports the backlog', async () => {
  const s = await req('POST', '/sentiment/step', { limit: 50 });
  eq(s.status, 200); eq(s.d.ok, true); ok(s.d.calls <= 1, 'at most one call: ' + s.d.calls); ok(Array.isArray(s.d.lines) && s.d.lines.length >= 1 && s.d.lines[0].kind === 'info', JSON.stringify(s.d.lines)); ok(typeof s.d.backlog === 'number');
  eq((await req('POST', '/sentiment/step', {}, 'read-key')).status, 403);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
