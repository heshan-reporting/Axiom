/* The monitoring desk, release 7: public-record routes, against the worker module in this process. No site is contacted:
 * every page below is an invented stand-in served by the recording fetch (the sandbox has no egress, so no fixture could
 * be saved from the real page; DEN.md s.8 lists what a first live sweep must prove). Each case fails on the p58 commit.
 *   PF1 the public reader: robots.txt is obeyed, the user agent says what it is, ten seconds between requests to one host
 *   PF2 a refusal (403, 429, a challenge page) is named, recorded for the host and not asked again that day
 *   SP1 the `public` source method files a headline and a link, never a body; a refusal is the source's health and it backs off
 *   PC1 the process calendar: an inquiry page becomes one record with its dates; a stage change files exactly one row;
 *       a private submitter's name is never stored
 *   PC2 Upcoming shows the recorded date with its link, marked as recorded
 *   PC3 a notice paper: the notice on a desk's issue is kept, the rest are not
 *   HS1 Hansard as a standing sweep: without the key it says what to set; with it, an MP in the register is named and
 *       nobody else is; once a sitting day
 *   CT1 a campaign's own petition counter: stored as self-reported with a daily snapshot; a count that cannot be
 *       parsed is an error by name, never a zero
 *   CL1 who paid for a poll or an estimate, by rules; "sponsor not stated" when the page does not say
 *   BS1 a registered public actor's own Bluesky posts are filed through the one way in, named from the register;
 *       a repost and an unregistered account are not
 *   AD1 campaign names wait as proposed terms: the Ad Library does not search them until a person approves
 *   CV1 the collection view lists the new routes and what each delivered
 * Run: node --experimental-sqlite tests/den-public-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 7: public-record routes');
const FX = n => fs.readFileSync(new URL('./fixtures/public/' + n, import.meta.url), 'utf8');
const mk = async env => { const sleeps = []; const w = await workerEnv({ env: Object.assign({ __pubSleep: async ms => { sleeps.push(ms); } }, env || {}), keys: { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } }); w.sleeps = sleeps; return w; };
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const html = (body, status) => new Response(body, { status: status || 200, headers: { 'Content-Type': 'text/html' } });
const page = (w, re, body, status) => w.answer(re, () => html(body, status));
const noRobots = w => w.answer(/\/robots\.txt$/, () => html('', 404));
const arc = (w, kind) => w.env.MIND_DB.db.prepare('SELECT * FROM arc_items WHERE kind=? ORDER BY id').all(kind).map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const hits = (w, re) => w.outbound.filter(o => re.test(o.url)).length;

await S.t('PF1 robots, an honest user agent, ten seconds a host', async () => {
  const w = await mk(); const T = w.mod.__test; let ua = '';
  w.answer(/records\.example\.org\/robots\.txt$/, () => html('User-agent: *\nDisallow: /private/\nAllow: /private/open\n'));
  w.answer(/records\.example\.org\/(open|private)/, (u, init) => { ua = (init && init.headers && init.headers['User-Agent']) || ''; return html('<html><title>Open</title><p>ok</p></html>'); });
  const a = await T.pubFetch(w.env, 'https://records.example.org/open/list');
  eq([a.ok, a.status], [true, 200]); ok(/robots\.txt/.test(ua) && !/Mozilla|Chrome|Safari/.test(ua), 'the user agent says what it is: ' + ua);
  const b = await T.pubFetch(w.env, 'https://records.example.org/private/members');
  eq([b.ok, b.code], [false, 'robots_disallowed']); ok(/robots\.txt/.test(b.error)); eq(hits(w, /private\/members/), 0, 'a disallowed page is never requested');
  eq((await T.pubFetch(w.env, 'https://records.example.org/private/open')).ok, true, 'the longer Allow wins');
  eq(hits(w, /robots\.txt$/), 1, 'robots.txt is read once and kept');
  ok(w.sleeps.length >= 2 && w.sleeps.every(ms => ms >= 9000), 'each later request to the host waited ten seconds: ' + JSON.stringify(w.sleeps));
  eq(T.robotsAllows('User-agent: axiompublicrecord\nDisallow: /\n\nUser-agent: *\nDisallow:\n', '/x', 'AxiomPublicRecord/1.0'), false, 'a group naming this reader is the one that applies');
});

await S.t('PF2 a refusal is named, recorded and not retried', async () => {
  const w = await mk(); const T = w.mod.__test; noRobots(w);
  page(w, /walled\.example\.org\/news/, 'Forbidden', 403);
  const a = await T.pubFetch(w.env, 'https://walled.example.org/news');
  eq([a.ok, a.refused, a.code, a.status], [false, true, 'refused', 403]); ok(/HTTP 403/.test(a.error) && /not (asked|retried)/.test(a.error), a.error);
  const b = await T.pubFetch(w.env, 'https://walled.example.org/news/other');
  eq([b.ok, b.code], [false, 'refused_backoff']); eq(hits(w, /walled\.example\.org\/news/), 1, 'no second request to a host that refused');
  page(w, /busy\.example\.org/, 'slow down', 429); eq((await T.pubFetch(w.env, 'https://busy.example.org/a')).code, 'refused');
  page(w, /shield\.example\.org/, '<html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget"></div></body></html>');
  const c = await T.pubFetch(w.env, 'https://shield.example.org/a'); eq([c.ok, c.code], [false, 'refused']); ok(/challenge/.test(c.error));
  page(w, /members\.example\.org/, '<html><title>Sign in</title><form><input type="password" name="p"></form></html>');
  const d = await T.pubFetch(w.env, 'https://members.example.org/updates'); eq([d.ok, d.code], [false, 'login_required']); ok(/sign-in|login/.test(d.error));
});

await S.t('SP1 the public method: a headline and a link, never a body', async () => {
  const w = await mk(); noRobots(w);
  page(w, /wire\.example\.org\/releases$/, FX('listing-paywalled.html'));
  let r = await F(w, 'POST', '/sources/add', { id: 'wire_test', name: 'Example release wire', tier: 'wire', issues: ['gastax'], urls: { public: 'https://wire.example.org/releases' } });
  eq([r.status, r.body.source.methods], [200, ['public']]);
  r = await F(w, 'POST', '/sources/sweep', { ids: ['wire_test'] }); eq(r.body.succeeded, 1, JSON.stringify(r.body).slice(0, 300));
  const rows = arc(w, 'news').filter(x => x.src === 'wire_test'); ok(rows.length >= 2, 'the listing\'s headlines are filed');
  ok(rows.every(x => !x.body), 'no body is stored from a public listing, paywalled or not'); ok(rows.every(x => /^https:\/\/wire\.example\.org\//.test(x.url)));
  eq(rows[0].meta.method, 'public');
  page(w, /shut\.example\.org/, 'no', 403);
  await F(w, 'POST', '/sources/add', { id: 'shut_test', name: 'Shut site', tier: 'sector', urls: { public: 'https://shut.example.org/news' } });
  r = await F(w, 'POST', '/sources/sweep', { ids: ['shut_test'] }); eq(r.body.failed, 1);
  const s = w.env.MIND_DB.db.prepare('SELECT * FROM sources WHERE id=?').get('shut_test');
  ok(/refused/.test(s.last_error) && /403/.test(s.last_error), 'the refusal is the source\'s health, in words: ' + s.last_error);
  ok(s.next_due - Date.now() > 20 * 3600000, 'a refused source is not due again for about a day');
});

const INQ = 'https://parliament.example.gov.au/committees/gas-reservation-bill';
const addProc = (w, o) => F(w, 'POST', '/den/process/add', Object.assign({ url: INQ, type: 'inquiry', juris: 'au', house: 'senate', title: 'Domestic Gas Reservation Bill 2026 inquiry', issues: ['gas'] }, o || {}));

await S.t('PC1 the process calendar: dates recorded, one row a stage change, no private names', async () => {
  const w = await mk(); noRobots(w); const future = new Date(Date.now() + 20 * 86400000); const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fd = future.getUTCDate() + ' ' + M[future.getUTCMonth()] + ' ' + future.getUTCFullYear(); const iso = future.toISOString().slice(0, 10);
  let body = FX('inquiry.html').replace(/__REPORT__/g, fd).replace(/__STATUS__/g, 'Accepting submissions');
  w.answer(/parliament\.example\.gov\.au\/committees\/gas-reservation-bill/, () => html(body));
  const a = await addProc(w); eq(a.status, 200, JSON.stringify(a.body)); const sid = a.body.source.id;
  const pr = await F(w, 'GET', '/sources/probe?id=' + sid); eq(pr.status, 200); eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) n FROM den_process').get().n, 0, 'the Probe reads the page and records nothing');
  let r = await F(w, 'POST', '/sources/sweep', { ids: [sid] }); eq(r.body.succeeded, 1, JSON.stringify(r.body).slice(0, 400));
  let list = (await w.call('GET', '/den/process?ns=aep', null, 'read-key')).body; eq(list.process.length, 1);
  const p = list.process[0]; eq([p.type, p.house, p.juris, p.stage, p.next_date, p.submissions], ['inquiry', 'senate', 'au', 'Accepting submissions', iso, 88]);
  ok(/report/i.test(p.next_what), p.next_what); ok(p.issues.indexOf('gas') >= 0);
  const stage = () => arc(w, 'news').filter(x => x.meta.process);
  eq(stage().length, 1, 'first sight files one row'); ok(/Domestic Gas Reservation Bill 2026 inquiry: Accepting submissions/.test(stage()[0].title));
  r = await F(w, 'POST', '/sources/sweep', { ids: [sid] }); eq(r.body.succeeded, 1, 'an unchanged page is a success, not a failure'); eq(stage().length, 1, 'no change, no row');
  body = body.replace(/Accepting submissions/g, 'Report tabled');
  await F(w, 'POST', '/sources/sweep', { ids: [sid] }); eq(stage().length, 2, 'a stage change files exactly one row');
  await F(w, 'POST', '/sources/sweep', { ids: [sid] }); eq(stage().length, 2);
  ok(/Report tabled/.test(stage()[1].title));
  const all = JSON.stringify(w.env.MIND_DB.db.prepare('SELECT * FROM den_process').all()) + JSON.stringify(arc(w, 'news'));
  ok(!/Jo Citizen|Sam Private/.test(all), 'a private submitter is never stored'); ok(/88/.test(all), 'the number of submissions is');
  eq((await w.call('GET', '/den/process?ns=guns', null, 'read-key')).body.process.length, 0, 'another desk does not see it');
  eq((await w.call('POST', '/den/process/add', { url: INQ, type: 'inquiry' }, 'read-key')).status, 403);
  const bad = await addProc(w, { url: 'http://10.0.0.8/x' }); eq(bad.status, 400); ok(bad.body.detail.length > 20);
});

await S.t('PC2 Upcoming shows the recorded date with its link', async () => {
  const w = await mk(); noRobots(w); const future = new Date(Date.now() + 9 * 86400000); const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const fd = future.getUTCDate() + ' ' + M[future.getUTCMonth()] + ' ' + future.getUTCFullYear();
  page(w, /parliament\.example\.gov\.au\/committees\/gas-reservation-bill/, FX('inquiry.html').replace(/__REPORT__/g, fd).replace(/__STATUS__/g, 'Accepting submissions'));
  const a = await addProc(w); await F(w, 'POST', '/sources/sweep', { ids: [a.body.source.id] });
  const b = (await w.call('GET', '/den/board?desk=aep_au', null, 'read-key')).body; eq(b.ok, true, JSON.stringify(b).slice(0, 200));
  const rec = b.upcoming.filter(u => u.recorded); eq(rec.length, 1, JSON.stringify(b.upcoming));
  eq([rec[0].date, rec[0].url, rec[0].yearWritten], [future.toISOString().slice(0, 10), INQ, true]); ok(/Domestic Gas Reservation/.test(rec[0].what));
  eq(b.upcoming.filter(u => u.date === rec[0].date).length, 1, 'the stage row does not repeat the recorded date as a guess');
  eq(((await w.call('GET', '/den/board?desk=guns_au', null, 'read-key')).body.upcoming || []).filter(u => u.recorded).length, 0);
});

await S.t('PC3 a notice paper: the notice on a desk\'s issue is kept', async () => {
  const w = await mk(); noRobots(w);
  page(w, /parliament\.example\.gov\.au\/notice-paper/, FX('notice-paper.html'));
  const a = await addProc(w, { url: 'https://parliament.example.gov.au/notice-paper', type: 'motion', title: 'Senate notice paper', issues: [] });
  await F(w, 'POST', '/sources/sweep', { ids: [a.body.source.id] });
  const rows = w.env.MIND_DB.db.prepare("SELECT * FROM den_process WHERE type='motion'").all();
  eq(rows.length, 1, JSON.stringify(rows.map(r => r.title))); ok(/fuel tax credits?/i.test(rows[0].title)); ok(JSON.parse(rows[0].issues).indexOf('ftc') >= 0);
  eq((await w.call('GET', '/den/process?ns=mca', null, 'read-key')).body.process.length, 1);
});

await S.t('HS1 Hansard as a standing sweep', async () => {
  let w = await mk(); let r = await F(w, 'POST', '/social/sweep', { platform: 'hansard' });
  ok(/OPENAUSTRALIA_KEY/.test(JSON.stringify(r.body)), 'without the key it says what to set: ' + JSON.stringify(r.body).slice(0, 200));
  w = await mk({ OPENAUSTRALIA_KEY: 'k' }); const T = w.mod.__test;
  await w.call('GET', '/mps', null, 'read-key');
  w.env.MIND_DB.db.prepare("INSERT INTO mps(id, name, party, house, electorate, x, facebook, instagram, updated) VALUES('Q1','Dana Harbour','Example Party','senate','','','','',1)").run();
  const today = new Date().toISOString().slice(0, 10);
  w.answer(/openaustralia\.org\.au\/api\/getHansard/, () => new Response(JSON.stringify({ rows: [
    { gid: '2026-11-10.1.1', hdate: today, major: 101, body: 'The gas export tax would raise billions and the windfall tax on gas is overdue.', listurl: '/senate/?id=2026-11-10.1.1', speaker: { first_name: 'Dana', last_name: 'Harbour', party: 'Example Party' }, parent: { body: 'Gas Industry: Taxation' } },
    { gid: '2026-11-10.1.2', hdate: today, major: 101, body: 'A gas export tax is the wrong answer for Australian gas producers.', listurl: '/senate/?id=2026-11-10.1.2', speaker: { first_name: 'Sam', last_name: 'Private', party: '' }, parent: { body: 'Gas Industry: Taxation' } },
    { gid: '2026-11-10.1.3', hdate: today, major: 1, body: 'The weather in the electorate has been fine this week.', listurl: '/debates/?id=2026-11-10.1.3', speaker: { first_name: 'Dana', last_name: 'Harbour' } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const out = await T.hansardSweep(w.env, { ns: 'aep', terms: 2 }); eq(out.ok, true, JSON.stringify(out)); const rows = arc(w, 'hansard');
  eq(rows.length, 2, 'the off-topic speech is not kept: ' + JSON.stringify(rows.map(x => x.title)));
  const named = rows.find(x => x.meta.mp); eq([named.meta.mp.name, named.meta.house, named.meta.debate], ['Dana Harbour', 'senate', 'Gas Industry: Taxation']); ok(named.meta.issues.indexOf('gastax') >= 0);
  ok(!/Sam Private/.test(JSON.stringify(rows)), 'a speaker outside the MP register is not named'); ok(rows.every(x => !x.author));
  const n = hits(w, /getHansard/); const again = await T.hansardSweep(w.env, { ns: 'aep', terms: 2 }); eq(again.skipped, true); eq(hits(w, /getHansard/), n, 'once a day a desk');
  const cov = (await w.call('GET', '/social/coverage', null, 'read-key')).body.platforms.find(p => p.id === 'hansard'); eq(cov.configured, true);
});

await S.t('CT1 a campaign\'s own counter: self-reported, snapshotted, never a silent zero', async () => {
  const w = await mk(); noRobots(w); const T = w.mod.__test;
  page(w, /campaign\.example\.org\/petition/, FX('counter.html'));
  page(w, /broken\.example\.org\/petition/, '<html><title>Sign now</title><p>Add your name to the petition today.</p></html>');
  await F(w, 'POST', '/social/petitions/counters', { add: { url: 'https://campaign.example.org/petition', name: 'Keep the Night Boat', ns: 'guns' } });
  await F(w, 'POST', '/social/petitions/counters', { add: { url: 'https://broken.example.org/petition', name: 'Broken counter', ns: 'guns' } });
  eq((await w.call('POST', '/social/petitions/counters', { add: { url: 'https://x.example.org/p', name: 'x' } }, 'read-key')).status, 403);
  const out = await T.petitionCountersSweep(w.env, { only: ['campaign.example.org', 'broken.example.org'] });
  const rows = arc(w, 'petition'); const canon = rows.filter(x => !/^x:pet:/.test(x.url)); const snaps = rows.filter(x => /^x:pet:/.test(x.url));
  eq(canon.length, 1, JSON.stringify(canon.map(x => x.url))); eq([canon[0].meta.signatures, canon[0].meta.self_reported, canon[0].meta.site], [17204, true, 'counter']); eq(snaps.length, 1); eq(snaps[0].meta.self_reported, true);
  ok(out.errors.some(e => /_parse_failed/.test(e)), 'the unreadable counter is an error by name: ' + JSON.stringify(out.errors));
  ok(!rows.some(x => /broken\.example/.test(x.url + (x.meta.petition || ''))), 'and files nothing, not a zero');
  ok(!/Jo Citizen/.test(JSON.stringify(rows)), 'a signatory shown on the page is not stored');
  const list = (await w.call('GET', '/social/petitions?days=7', null, 'read-key')).body.petitions; eq([list.length, list[0].self_reported, list[0].signatures], [1, true, 17204]);
});

await S.t('CL1 who paid for the number', async () => {
  const w = await mk(); const c = w.mod.__test.claimOf;
  eq(c('A YouGov poll of 1,289 NSW voters, commissioned by Lock the Gate and the Sunrise Project, found 54% say accept the ruling.'), { kind: 'poll', sponsor: 'Lock the Gate and the Sunrise Project', pollster: 'YouGov', n: 1289 });
  eq(c('New polling shows 73 per cent of people support a cap on firearms.'), { kind: 'poll', sponsor: 'sponsor not stated', pollster: '', n: 0 });
  const e = c('Economic modelling commissioned by the Shooting Industry Foundation puts the cost at $950.6 million.'); eq([e.kind, e.sponsor], ['estimate', 'the Shooting Industry Foundation']);
  eq(c('The minister said the bill will pass this week.'), null);
  noRobots(w); page(w, /wire\.example\.org\/releases$/, FX('listing-paywalled.html'));
  await F(w, 'POST', '/sources/add', { id: 'wire_c', name: 'Example wire', tier: 'wire', urls: { public: 'https://wire.example.org/releases' } }); await F(w, 'POST', '/sources/sweep', { ids: ['wire_c'] });
  const row = arc(w, 'news').find(x => /poll/i.test(x.title)); eq(row.meta.claim.kind, 'poll'); eq(row.meta.claim.sponsor, 'sponsor not stated');
});

await S.t('BS1 a registered public actor\'s own Bluesky posts', async () => {
  const w = await mk(); const T = w.mod.__test;
  eq(T.canonPermalink('bluesky', 'https://bsky.app/profile/HarbourWatch.example.org/post/3mabc123xyz?ref=x'), 'https://bsky.app/profile/harbourwatch.example.org/post/3mabc123xyz');
  eq(T.canonPermalink('bluesky', 'https://bsky.app/profile/harbourwatch.example.org'), '');
  const add = await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'bluesky', value: 'harbourwatch.example.org', name: 'Harbour Watch', actor_kind: 'org' }); eq(add.status, 200, JSON.stringify(add.body));
  await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'bluesky', value: 'someone.example.org' });
  const post = (did, rkey, text, extra) => Object.assign({ post: { uri: 'at://' + did + '/app.bsky.feed.post/' + rkey, author: { did, handle: 'harbourwatch.example.org', displayName: 'Jo Citizen' }, record: { text, createdAt: new Date(Date.now() - 3600000).toISOString() }, likeCount: 12, repostCount: 3, replyCount: 2 } }, extra || {});
  w.answer(/getAuthorFeed\?actor=harbourwatch/, () => new Response(JSON.stringify({ feed: [post('did:plc:hw', '3lown1aaaaaaa', 'Our submission on the gas export tax is in. Australia should tax gas exports.'),
    post('did:plc:other', '3lrp1aaaaaaaa', 'A gas export tax would be a disaster for Australia.', { reason: { $type: 'app.bsky.feed.defs#reasonRepost' } }), post('did:plc:hw', '3lown2aaaaaaa', 'Lovely morning on the harbour.')] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  const out = await T.bskyActorSweep(w.env, {}); eq([out.ok, out.accounts], [true, 1], JSON.stringify(out));
  const rows = arc(w, 'sig_thread'); eq(rows.length, 1, JSON.stringify(rows.map(x => x.title)));
  eq([rows[0].meta.platform, rows[0].meta.actor.name, rows[0].meta.layer, rows[0].meta.via, rows[0].meta.eng.likes], ['bluesky', 'Harbour Watch', 3, 'bsky_actor', 12]);
  ok(!/Jo Citizen/.test(JSON.stringify(rows)), 'the name comes from the register, never from the feed'); eq(hits(w, /actor=someone/), 0, 'an account not marked as a public actor is not read');
});

await S.t('AD1 campaign names wait for a person', async () => {
  const w = await mk({ META_USER_TOKEN: 't' }); let asked = [];
  w.answer(/ads_archive/, u => { asked.push(decodeURIComponent((u.match(/search_terms=([^&]+)/) || [])[1] || '')); return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  eq((await F(w, 'GET', '/den/watch?ns=mca')).body.watch, [], 'nothing is in a register unasked'); eq((await w.call('POST', '/den/watch/seed', {}, 'read-key')).status, 403);
  const sd = await F(w, 'POST', '/den/watch/seed', {}); eq([sd.body.proposed, sd.body.known], [3, 0]); eq((await F(w, 'POST', '/den/watch/seed', {})).body.proposed, 0, 'pressing it twice proposes nothing twice');
  const prop = (await F(w, 'GET', '/den/watch?ns=mca&status=proposed')).body.watch; const t = prop.find(x => x.kind === 'term' && x.value === 'hands off our fuel');
  ok(t, 'the campaign name is proposed: ' + JSON.stringify(prop.map(x => x.value))); eq([t.source, t.issue], ['seed', 'ftc']); ok((t.evidence || []).length >= 1);
  ok((await F(w, 'GET', '/den/watch?ns=guns&status=proposed')).body.watch.some(x => x.value === 'stop the buyback'));
  await w.mod.__test.metaAdLibrary(w.env); ok(asked.length > 0 && asked.indexOf('hands off our fuel') < 0, 'a proposal is searched by nothing');
  await F(w, 'POST', '/den/watch/decide', { id: t.id, decision: 'approve', issue: 'ftc' }); asked = [];
  await w.mod.__test.metaAdLibrary(w.env); ok(asked.indexOf('hands off our fuel') >= 0, 'once approved it is: ' + JSON.stringify(asked.slice(-5)));
});

await S.t('CV1 the collection view lists the new routes', async () => {
  const w = await mk(); const c = (await w.call('GET', '/den/collection?desk=aep_au', null, 'read-key')).body; eq(c.ok, true);
  const ids = c.channels.map(x => x.id); for (const id of ['parliament', 'hansard', 'counters']) ok(ids.indexOf(id) >= 0, id + ' is listed: ' + ids.join(','));
  const h = c.channels.find(x => x.id === 'hansard'); ok(/OPENAUSTRALIA_KEY/.test(h.how), 'what Hansard needs is said'); ok(c.channels.every(x => x.delivered && typeof x.delivered.d7 === 'number'));
  ok(/registered accounts/.test(c.channels.find(x => x.id === 'bluesky').how));
  const cov = (await w.call('GET', '/social/coverage', null, 'read-key')).body.platforms; ok(cov.some(p => p.id === 'parliament') && cov.some(p => p.id === 'hansard'));
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
