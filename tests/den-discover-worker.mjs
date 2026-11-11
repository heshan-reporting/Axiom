/* The monitoring desk, release 5 (prompts/annes-den.md Phase 5): keyword discovery, against the worker module in this
 * process. No provider is contacted and no model is called except the one stubbed call in DC11. Every post, outlet,
 * account and phrase here is invented ("harbour levy" is nobody's policy). Each case fails on the p56 commit.
 *   DC1 terms: a phrase the desk's rows keep using and the rest of the archive does not is proposed, with its evidence,
 *       its issue and its measure; what the lexicon already matches is not; a dry run files nothing
 *   DC2 hashtags, the accounts and groups a registered account points at, and outlets not in the Source Registry
 *   DC3 the words of a live narrative on the desk's issues
 *   DC4 the words of the comments under the desk's posts
 *   DC5 Preview: what a term would have caught, by channel, with what is already filed and what says nothing Australian
 *   DC6 an approved term changes the published lexicon and how a new row is tagged, never a Sentinel trigger; off undoes it
 *   DC7 a dismissed proposal is never proposed again
 *   DC8 one desk's proposals and terms are no other desk's
 *   DC9 the cap on active terms
 *   DC10 the review line: approved a month ago, matched nothing since
 *   DC11 the one model step groups what waits and changes no status; without the key it says what to set
 *   DC12 the daily run: one desk a tick, once a day, only a desk somebody uses, no outbound request
 * Run: node --experimental-sqlite tests/den-discover-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 5: keyword discovery');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({}, env || {}), keys: KEYS });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const H = 3600000, NOW = Date.now();
let seq = 0;
const push = async (w, kind, rows) => { for (let i = 0; i < rows.length; i += 100) { const r = await F(w, 'POST', '/archive/add', { kind, rows: rows.slice(i, i + 100) }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); } };
const row = (o) => Object.assign({ src: 'outlet' + (seq % 7), url: 'https://news' + (seq % 9) + '.example.com.au/story/' + (++seq), ts: NOW - (seq % 90) * H, meta: { issues: [] } }, o);
// everything else the archive holds: ordinary invented news that no desk owns
const TOWNS = ['Ferntree', 'Wattle Creek', 'Kingsbay', 'Marlow', 'Dunmore', 'Ashgrove', 'Tarwin', 'Coral Point'];
const TOPICS = ['library hours', 'the netball final', 'a bridge repair', 'school enrolments', 'the flower show', 'a bus timetable', 'the swimming carnival', 'hospital parking', 'a bakery reopening', 'the council budget'];
const background = n => Array.from({ length: n }, (_, i) => row({ title: TOWNS[i % 8] + ' residents weigh in on ' + TOPICS[i % 10], body: 'Locals in ' + TOWNS[(i + 3) % 8] + ' gathered to discuss ' + TOPICS[(i + 4) % 10] + ' and ' + TOPICS[(i + 7) % 10] + ' at a meeting chaired by a volunteer.' }));
// the desk's rows: gas taxation stories that keep saying "harbour levy", which the lexicon has never heard of
const LEAD = ['Crossbench renews its call for a windfall tax on gas while a harbour levy splits', 'A harbour levy joins the gas export tax fight in', 'Greens senator ties the harbour levy to the PRRT review, angering', 'Why the harbour levy has become the test of the windfall tax on gas for',
  'Producers warn the harbour levy and a gas export tax would cost jobs in', 'Unions back a harbour levy as the gas export tax inquiry reaches', 'Treasury modelling on the harbour levy lands before the windfall tax vote, says', 'Three premiers oppose the harbour levy; the gas export tax still has friends in', 'Harbour levy: what a windfall tax on gas would mean for'];
const TAIL = ['Campaigners describe it as overdue.', 'Industry groups called it reckless.', 'The committee reports in March.', 'Economists are divided on the detail.', 'A vote is expected within weeks.', 'Regional mayors want a carve-out.', 'The opposition has not said how it will vote.', 'Exporters say contracts are at risk.', 'Polling on it is thin.'];
const desk = n => Array.from({ length: n }, (_, i) => row({ src: ['pointpost', 'tribune', 'coastwire'][i % 3], title: LEAD[i % 9] + ' ' + TOWNS[i % 8], body: TAIL[i % 9] + ' ' + TAIL[(i + 4) % 9], meta: { issues: ['gastax'], tier: 'regional' } }));
const seedCorpus = async w => { await push(w, 'news', background(70)); await push(w, 'news', desk(9)); };
const find = (list, kind, value) => list.find(p => p.kind === kind && p.value === value);

await S.t('DC1 terms the desk keeps using and nothing else does', async () => {
  const w = await mk(); await seedCorpus(w);
  const dry = (await F(w, 'POST', '/den/discover', { ns: 'aep', days: 14, dry: true })).body;
  eq([dry.ok, dry.rows.desk, dry.rows.background], [true, 9, 70]);
  const t = find(dry.proposals, 'term', 'harbour levy'); ok(t, 'the phrase is proposed: ' + JSON.stringify(dry.proposals.map(p => p.value)));
  eq(t.issue, 'gastax', 'filed under the issue its rows carry'); ok(/In 9 of 9 rows on this desk in 14 days, from 3 sources/.test(t.reason) && /times as common/.test(t.reason), t.reason);
  ok(t.evidence.length >= 1 && t.evidence.length <= 5 && t.evidence.every(e => /harbour levy/i.test(e.text) && /^https:/.test(e.url) && e.id > 0), 'evidence is rows that carry it, at most five');
  ok(!dry.proposals.some(p => /windfall tax|gas export tax/.test(p.value)), 'what the lexicon already matches is not proposed');
  ok(!dry.proposals.some(p => p.kind === 'term' && /^(residents|locals|meeting|council budget)$/.test(p.value)), 'what everything else also says is not distinctive');
  eq(dry.filed, { proposed: 0, known: 0 }, 'a dry run files nothing'); eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) n FROM den_watch').get().n, 0);
  const run = (await F(w, 'POST', '/den/discover', { ns: 'aep', days: 14 })).body; ok(run.filed.proposed >= 1, JSON.stringify(run.filed));
  const reg = (await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch; const r = reg.find(x => x.value === 'harbour levy');
  eq([r.status, r.source, r.kind, r.issue], ['proposed', 'discovery', 'term', 'gastax']); ok(r.evidence.length >= 1 && /9 of 9/.test(r.reason));
  // proposed is read by nothing: it tags nothing and is searched for by nobody
  ok(w.mod.__test.issueTag('The harbour levy is back').indexOf('gastax') < 0, 'a proposal tags nothing');
  ok((await F(w, 'GET', '/den/plan?ns=aep')).body.queries.indexOf('harbour levy') < 0, 'and is in no search plan');
  eq((await w.call('POST', '/den/discover', { ns: 'aep' }, 'read-key')).status, 403, 'a read key cannot run it');
  eq((await F(w, 'POST', '/den/discover', { ns: 'nobody' })).body.error, 'unknown_ns');
  ok(w.outbound.length === 0, 'no provider and no model was contacted: ' + JSON.stringify(w.outbound));
});

await S.t('DC2 hashtags, the accounts a registered account points at, and unknown outlets', async () => {
  const w = await mk(); await seedCorpus(w);
  const acct = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'x', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' })).body.watch;
  const posts = Array.from({ length: 4 }, (_, i) => ({ src: 'x', title: 'Harbour Watch post ' + i, url: 'https://x.com/i/web/status/90000000000' + i, ts: NOW - (i + 1) * H,
    body: 'Join @baykeepers_au and sign today #SaveTheStrait. Details at https://straitwatch.example.org/brief/' + i + ' and our group https://www.facebook.com/groups/straitfriends ' + (i < 3 ? 'with @baykeepers_au again' : ''),
    meta: { platform: 'x', watch: acct.id, issues: ['gastax'] } }));
  await push(w, 'sig_thread', posts);
  // an unregistered account's post that names somebody: never a source of account proposals
  await push(w, 'sig_thread', Array.from({ length: 4 }, (_, i) => ({ src: 'x', title: 'someone', url: 'https://x.com/i/web/status/9111111111' + i, ts: NOW - i * H, body: 'windfall tax now says @private_person_' + 0 + ' #SaveTheStrait', meta: { platform: 'x', issues: ['gastax'] } })));
  const d = (await F(w, 'POST', '/den/discover', { ns: 'aep', dry: true })).body;
  const tag = find(d.proposals, 'hashtag', 'savethestrait'); ok(tag && /On 8 posts/.test(tag.reason), 'the hashtag, counted across the desk\'s posts: ' + JSON.stringify(tag));
  const a = find(d.proposals, 'account', 'baykeepers_au'); ok(a && a.platform === 'x' && /registered accounts/.test(a.reason), 'the account a registered account keeps naming');
  ok(!d.proposals.some(p => /private_person/.test(p.value)), 'a name in somebody else\'s post is never proposed');
  ok(find(d.proposals, 'group', 'straitfriends'), 'the public group it links to: ' + JSON.stringify(d.proposals.filter(p => p.kind !== 'term').map(p => p.kind + ':' + p.value)));
  const src = find(d.proposals, 'source', 'straitwatch.example.org'); ok(src && /not in the Source Registry/.test(src.reason));
  ok(!d.proposals.some(p => p.kind === 'source' && /x\.com|facebook\.com/.test(p.value)), 'a platform is not an outlet');
  ok(d.notBuilt.some(x => /unregistered account is never recorded/.test(x)), 'what is not built is said');
});

await S.t('DC3 the words of a live narrative on the desk\'s issues', async () => {
  const w = await mk(); await seedCorpus(w); await F(w, 'GET', '/narratives/status');
  const ins = w.env.MIND_DB.db.prepare("INSERT INTO narratives(id,label,issues,n,first_ts,last_ts,status,muted,terms) VALUES(?,?,?,?,?,?,?,0,?)");
  ins.run('n1', 'Gas giants are dodging the tide tax', JSON.stringify(['gastax']), 12, NOW - 40 * H, NOW - H, 'growing', JSON.stringify({ tidetax: 9, giants: 7, gas: 12, said: 11, tax: 12 }));
  ins.run('n2', 'A netball final nobody saw', JSON.stringify(['housing']), 20, NOW - 40 * H, NOW - H, 'growing', JSON.stringify({ netballers: 15 }));
  const d = (await F(w, 'POST', '/den/discover', { ns: 'aep', dry: true })).body;
  const t = find(d.proposals, 'term', 'tidetax'); ok(t && t.issue === 'gastax' && /From narratives/.test(t.reason) && t.evidence[0].label === 'Gas giants are dodging the tide tax', JSON.stringify(t));
  ok(!find(d.proposals, 'term', 'netballers'), 'another client\'s narrative lends nothing');
  ok(!d.proposals.some(p => p.how === 'narratives' && /^(gas|tax|said)$/.test(p.value)), 'short, stop and lexicon words are left out');
});

await S.t('DC4 the words the audience uses in the comments', async () => {
  const w = await mk(); await seedCorpus(w);
  const cm = (i, text, iss) => ({ src: 'reddit', title: '', body: text, url: 'x:rcmt:c' + (++seq), ts: NOW - i * H, meta: { thread: 't' + (i % 4), issues: iss } });
  await push(w, 'reddit_comment', Array.from({ length: 8 }, (_, i) => cm(i, 'Honestly this is just a bill shock tax on anyone with a heater, ' + TOPICS[i % 10] + ' aside.', ['gastax'])));
  await push(w, 'reddit_comment', Array.from({ length: 50 }, (_, i) => cm(i, 'I went to ' + TOWNS[i % 8] + ' for ' + TOPICS[i % 10] + ' and it was fine, the ' + TOPICS[(i + 2) % 10] + ' was better.', [])));
  const d = (await F(w, 'POST', '/den/discover', { ns: 'aep', dry: true })).body;
  eq([d.rows.deskComments, d.rows.backgroundComments], [8, 50]);
  const t = d.proposals.find(p => p.how === 'comments' && /bill shock/.test(p.value)); ok(t, 'the phrase from the comments: ' + JSON.stringify(d.proposals.filter(p => p.how === 'comments').map(p => p.value)));
  ok(/From the comments: in 8 of 8 comments/.test(t.reason) && /across 4 threads/.test(t.reason), t.reason); ok(t.evidence.every(e => e.url === '' && /bill shock/.test(e.text)), 'a comment is quoted without an address or an author');
});

await S.t('DC5 Preview says what a term would have caught', async () => {
  const w = await mk(); await seedCorpus(w);
  await push(w, 'reddit_thread', [
    { src: 'reddit', title: 'Is the harbour levy coming to Texas?', body: 'Asking from Houston about the harbour levy.', url: 'https://www.reddit.com/r/texas/comments/aa1/', ts: NOW - H, meta: { sub: 'texas', issues: [] } },
    { src: 'reddit', title: 'Harbour levy and the Senate', body: 'Canberra is debating the harbour levy this week.', url: 'https://www.reddit.com/r/AustralianPolitics/comments/aa2/', ts: NOW - 2 * H, meta: { sub: 'AustralianPolitics', issues: [] } }]);
  const p = (await w.call('GET', '/den/preview?ns=aep&term=' + encodeURIComponent('Harbour  Levy') + '&days=7', null, 'read-key')).body;
  eq([p.ok, p.term, p.days], [true, 'harbour levy', 7]); eq([p.matched, p.already, p.new], [11, 9, 2], 'nine rows already on the desk, two it would add');
  eq(p.byChannel, { reddit: 2 }); eq(p.australian, 1, 'one of the two says something Australian'); eq(p.sample.length, 2); ok(p.sample.every(s => /harbour levy/i.test(s.text)) && p.sample.some(s => s.australian === false));
  ok(p.generic === true, 'the term does not name Australia');
  const none = (await F(w, 'GET', '/den/preview?ns=aep&term=zzyzx+quux')).body; eq([none.matched, none.new], [0, 0]); ok(/what was collected, not what was said/.test(none.note));
  eq((await F(w, 'GET', '/den/preview?ns=aep&term=x')).body.error, 'bad_value'); eq((await F(w, 'GET', '/den/preview?ns=zz&term=harbour')).body.error, 'unknown_ns');
  eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) n FROM den_watch').get().n, 0, 'a preview writes nothing');
});

await S.t('DC6 an approved term widens collection and tagging, never a trigger', async () => {
  const w = await mk(); await seedCorpus(w); const T = w.mod.__test;
  await F(w, 'POST', '/den/discover', { ns: 'aep' });
  const r = (await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch.find(x => x.value === 'harbour levy');
  const before = (await F(w, 'GET', '/reddit/issues')).body.issues.find(i => i.id === 'gastax'); ok(before.q.indexOf('harbour levy') < 0 && !new RegExp(before.wide, 'i').test('the harbour levy'));
  const d = (await F(w, 'POST', '/den/watch/decide', { id: r.id, decision: 'approve' })).body;
  eq([d.ok, d.watch.status, d.watch.issue, d.tags, d.generic], [true, 'active', 'gastax', true, true]); ok(/does not name Australia/.test(d.note) && /9 of 9/.test(d.watch.reason), 'why it was proposed stays on the row');
  const pub = (await F(w, 'GET', '/reddit/issues')).body.issues.find(i => i.id === 'gastax');
  ok(pub.q.indexOf('harbour levy') >= 0 && pub.added.indexOf('harbour levy') >= 0, 'it is a search term every collector reads');
  const wide = new RegExp(pub.wide, 'i'); ok(wide.test('Why the Harbour  Levy matters') && wide.test('windfall tax on gas') && !wide.test('harbourlevying'), 'and in the wide matcher, on word boundaries');
  eq(pub.rx, before.rx, 'the tight trigger is untouched'); ok(!new RegExp(pub.rx, 'i').test('the harbour levy'));
  ok(T.issueTag('The harbour levy is back').indexOf('gastax') >= 0 && T.issueQueries(['gastax']).indexOf('harbour levy') >= 0);
  ok((await F(w, 'GET', '/den/plan?ns=aep')).body.queries.indexOf('harbour levy') >= 0);
  // a new post found by nothing but the approved term is filed under its issue
  const ing = (await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 3, via: 'test', rows: [{ platform: 'x', url: 'https://x.com/someone/status/1890000000000000001', text: 'Canberra should drop the harbour levy before the election.', ts: NOW - H, q: 'harbour levy' }] })).body;
  eq(ing.inserted, 1, JSON.stringify(ing)); const filed = JSON.parse(w.env.MIND_DB.db.prepare("SELECT meta FROM arc_items WHERE url LIKE '%1890000000000000001'").get().meta); ok(filed.issues.indexOf('gastax') >= 0, JSON.stringify(filed.issues));
  const lex = (await w.call('GET', '/den/lexicon?ns=aep', null, 'read-key')).body; const li = lex.issues.find(i => i.id === 'gastax');
  ok(li.added.indexOf('harbour levy') >= 0 && li.own.indexOf('harbour levy') < 0 && li.own.length > 0); eq([lex.cap.max, lex.cap.active], [60, 1]); ok(/never changes what counts as a spike/.test(lex.rule));
  // off undoes it; a term with no issue is searched for and tags nothing
  await F(w, 'POST', '/den/watch/decide', { id: r.id, decision: 'off' });
  ok(T.issueTag('The harbour levy is back').indexOf('gastax') < 0 && (await F(w, 'GET', '/reddit/issues')).body.issues.find(i => i.id === 'gastax').q.indexOf('harbour levy') < 0, 'switched off, it is gone from both');
  const bare = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'tide tax australia' })).body.watch;
  ok(T.issueTag('a tide tax australia story').length === 0); const l2 = (await F(w, 'GET', '/den/lexicon?ns=aep')).body.terms.find(t => t.id === bare.id); eq([l2.tags, l2.generic], [false, false]); ok(/files under no issue/.test(l2.note));
  const set = (await F(w, 'POST', '/den/watch/decide', { id: bare.id, decision: 'approve', issue: 'gastax' })).body; eq([set.watch.issue, set.tags], ['gastax', true]);
  await T.deskLexiconLoad(w.env, true); ok(T.issueTag('a tide tax australia story').indexOf('gastax') >= 0);
  ok((await F(w, 'POST', '/den/watch/decide', { id: bare.id, decision: 'approve', issue: 'housing' })).body.watch.issue === '', 'another client\'s issue is not one it can file under');
});

await S.t('DC7 a dismissed proposal is never proposed again', async () => {
  const w = await mk(); await seedCorpus(w); await F(w, 'POST', '/den/discover', { ns: 'aep' });
  const r = (await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch.find(x => x.value === 'harbour levy');
  eq((await F(w, 'POST', '/den/watch/decide', { id: r.id, decision: 'dismiss' })).body.error, 'reason_required');
  await F(w, 'POST', '/den/watch/decide', { id: r.id, decision: 'dismiss', reason: 'A local council matter, not ours.' });
  const again = (await F(w, 'POST', '/den/discover', { ns: 'aep' })).body;
  ok(!find(again.proposals, 'term', 'harbour levy'), 'it is not even offered'); eq(again.filed.proposed, 0, 'nothing new is filed on a second run');
  const kept = (await F(w, 'GET', '/den/watch?ns=aep&status=dismissed')).body.watch.find(x => x.value === 'harbour levy'); eq([kept.status, kept.reason], ['dismissed', 'A local council matter, not ours.']);
});

await S.t('DC8 one desk\'s proposals and terms are no other desk\'s', async () => {
  const w = await mk(); await seedCorpus(w); await F(w, 'POST', '/den/discover', { ns: 'aep' });
  const r = (await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch.find(x => x.value === 'harbour levy'); await F(w, 'POST', '/den/watch/decide', { id: r.id, decision: 'approve' });
  eq((await F(w, 'GET', '/den/watch?ns=mca')).body.watch.length, 0); eq((await F(w, 'GET', '/den/lexicon?ns=mca')).body.terms.length, 0);
  ok((await F(w, 'GET', '/den/lexicon?ns=mca')).body.issues.every(i => i.added.length === 0)); ok((await F(w, 'GET', '/den/plan?ns=mca')).body.queries.indexOf('harbour levy') < 0);
  const m = (await F(w, 'POST', '/den/discover', { ns: 'mca', dry: true })).body; ok(!find(m.proposals, 'term', 'harbour levy') && m.rows.desk === 0, 'another desk measures its own rows');
  eq((await F(w, 'GET', '/den/watch')).body.error, 'unknown_ns', 'a register is never listed without its client');
  // a term row that names an issue of another client (written past the routes) tags nothing
  w.env.MIND_DB.db.prepare("INSERT INTO den_watch(id,ns,kind,platform,value,issue,status,created,updated,decided_at) VALUES('wx','mca','term','any','harbour pilots','gastax','active',1,1,1)").run();
  await w.mod.__test.deskLexiconLoad(w.env, true); ok(w.mod.__test.issueTag('the harbour pilots strike').length === 0);
});

await S.t('DC9 the cap on active terms', async () => {
  const w = await mk();
  const ins = w.env.MIND_DB.db; await F(w, 'GET', '/den/watch?ns=aep');
  const st = ins.prepare("INSERT INTO den_watch(id,ns,kind,platform,value,issue,status,created,updated,decided_at) VALUES(?,?,'term','any',?,'gastax',?,1,1,1)");
  for (let i = 0; i < 60; i++) st.run('c' + i, 'aep', 'capterm number ' + i, 'active'); st.run('p1', 'aep', 'one too many', 'proposed');
  const d = await F(w, 'POST', '/den/watch/decide', { id: 'p1', decision: 'approve' }); eq([d.status, d.body.error], [409, 'term_cap']); ok(/60 active terms/.test(d.body.detail));
  eq((await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'and another' })).body.error, 'term_cap');
  await F(w, 'POST', '/den/watch/decide', { id: 'c0', decision: 'off' }); eq((await F(w, 'POST', '/den/watch/decide', { id: 'p1', decision: 'approve' })).status, 200, 'room again once one is switched off');
  eq((await F(w, 'POST', '/den/watch/add', { ns: 'mca', kind: 'term', value: 'ours is separate' })).status, 200, 'the cap is each desk\'s own');
});

await S.t('DC10 the review line', async () => {
  const w = await mk(); await seedCorpus(w); await F(w, 'GET', '/den/watch?ns=aep');
  const st = w.env.MIND_DB.db.prepare("INSERT INTO den_watch(id,ns,kind,platform,value,issue,status,created,updated,decided_at) VALUES(?,?,'term','any',?,'gastax','active',1,1,?)");
  st.run('old1', 'aep', 'quokka subsidy', NOW - 31 * 86400000); st.run('old2', 'aep', 'harbour levy', NOW - 45 * 86400000); st.run('new1', 'aep', 'wombat rebate', NOW - 2 * 86400000);
  const plain = (await F(w, 'GET', '/den/lexicon?ns=aep')).body; ok(plain.reviewed === false && plain.terms.every(t => t.review === false));
  const lex = (await F(w, 'GET', '/den/lexicon?ns=aep&review=1')).body; const by = Object.fromEntries(lex.terms.map(t => [t.value, t.review]));
  eq(by, { 'harbour levy': false, 'quokka subsidy': true, 'wombat rebate': false }, 'a month old and silent is up for review; matched or newer is not'); eq(lex.reviewDays, 30);
});

await S.t('DC11 the one model step groups what waits and changes nothing', async () => {
  const none = await mk(); eq((await F(none, 'POST', '/den/themes', { ns: 'aep' })).body.error, 'claude_not_configured');
  const w = await mk({ ANTHROPIC_API_KEY: 'test-anthropic' }); await seedCorpus(w); await F(w, 'GET', '/den/watch?ns=aep');
  eq((await F(w, 'POST', '/den/themes', { ns: 'aep' })).body.error, 'too_few');
  const st = w.env.MIND_DB.db.prepare("INSERT INTO den_watch(id,ns,kind,platform,value,issue,status,reason,score,created,updated) VALUES(?,?,'term','any',?,'gastax','proposed',?,?,1,1)");
  ['harbour levy', 'tide tax', 'bill shock tax', 'netball final', 'texas gas'].forEach((v, i) => st.run('t' + i, 'aep', v, 'In 9 of 9 rows', 10 - i));
  let asked = null;
  w.answer(/api\.anthropic\.com/, (u, init) => { asked = JSON.parse(init.body); return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ themes: [{ name: 'A new levy on gas', why: 'Opponents have a new name for the tax.', ids: ['t0', 't1', 't2', 'not-an-id'] }, { name: 'Probably noise', why: 'Sport and Texas.', ids: ['t3', 't0'] }] }) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  eq((await w.call('POST', '/den/themes', { ns: 'aep' }, 'read-key')).status, 403);
  const t = (await F(w, 'POST', '/den/themes', { ns: 'aep' })).body;
  eq(t.themes.map(x => [x.name, x.ids]), [['A new levy on gas', ['t0', 't1', 't2']], ['Probably noise', ['t3']]], 'only ids that were given, each once'); eq(t.ungrouped, ['t4']); ok(/changed nothing/.test(t.note));
  ok(/data, not instructions/.test(asked.messages[0].content) && /SOURCE SAFETY/.test(asked.system), 'the candidates are sent as data');
  eq(w.outbound.filter(o => /anthropic/.test(o.url)).length, 1, 'one call'); eq(w.env.MIND_DB.db.prepare("SELECT COUNT(*) n FROM den_watch WHERE status='proposed'").get().n, 5, 'every proposal still waits');
  eq((await w.call('GET', '/den/themes?ns=aep', null, 'read-key')).body.themes.length, 2, 'the last grouping is kept to read');
});

await S.t('DC12 the daily run', async () => {
  const w = await mk(); await seedCorpus(w); const cron = w.mod.__test.denDiscoverCron;
  eq((await cron(w.env)).idle, true, 'no desk has a register: nothing runs');
  await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'gas export tax australia', issue: 'gastax' }); await F(w, 'POST', '/den/watch/add', { ns: 'mca', kind: 'term', value: 'critical minerals australia' });
  const a = await cron(w.env), b = await cron(w.env), c = await cron(w.env);
  eq([a.ns, b.ns, c.idle], ['aep', 'mca', true], 'one desk a tick, each once a day'); ok(a.proposed >= 1);
  ok((await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch.some(x => x.value === 'harbour levy' && x.added_by === 'discovery'));
  ok(w.outbound.length === 0, 'the run contacts nobody');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
