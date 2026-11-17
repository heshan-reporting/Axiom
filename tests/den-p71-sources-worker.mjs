/* Den build p71, the sources lane (the real-data check of 17 November 2026): what is collected directly, and how rows are
 * tagged to a client's issues, against the worker module in this process. No site is contacted: every feed, listing page and
 * directory answer is an invented stand-in served by the recording fetch, and every story, post and account is invented (the
 * outlets' own addresses are the registry's). Functions are called directly through __test where no route reaches them; the
 * cron entry is never run. Each case fails on p70.
 *   SR1 the registry gains the analyst's non-subscriber outlets it lacked (ABC's environment section, ABC Listen's news
 *       bulletin, Region's own feed, the AEP and MCA newsrooms), each with its tier, jurisdiction, issues and routes and no
 *       subscriber flag; the entries it already held for those outlets are as they were; the sync that adds them changes no
 *       other row, an operator's edit included; and each new route reads what its stand-in serves
 *   SR2 an "MCA mentions" issue: a row naming the Minerals Council (of Australia), its newsroom's address or its chief
 *       executive (the register's person) is tagged; "MCA" alone, the state minerals councils and Minerals Council South
 *       Africa are not. MCA's desks list it last, its search terms are asked, the page's and the Mac collector's copies of the
 *       lexicon carry it, and a collected story naming the council is a card on the MCA desk
 *   SR3 the mining matcher: a state MP's debts to a miner, a heritage listing on an old Pilbara stock route and a Resources
 *       Minister story about a gas scheme are not mining; a Pilbara iron ore expansion, a BHP royalty dispute, a mine approval,
 *       critical-minerals mining, gold miners and the fuel tax credit's "billionaire miners" are
 *   SR4 engRow keeps a count the collector did not give absent: "counted, none" ({ likes: 0 }) is not "no counts held" ({});
 *       a collector's row carries only the counts it read; the Board reads every shape as before
 *   SR5 the back-fill: a core-feed row tagged under the old lexicon is tagged again with the new matcher and leaves the MCA
 *       desk; a registry row keeps the tags it was collected with (tagging is collection-side)
 *   SR6 the gas issue's tight trigger knows the forms a headline on the reservation bill uses ("gas reform", "gas reserves",
 *       "gas plan", "gas vote", "gas scheme", a reservation bill), "gas" beside each: the Reserve Bank, petrol and a gas plant
 *       are not caught, and the bill's headline is tight for the rank (denRel)
 *   SR7 a deal post for lithium batteries (a price, "(S&S)", "+ Delivery", an "@ store" suffix) is not critical minerals;
 *       lithium, nickel, cobalt and graphite mining, refining and market news still is, a deal or a sale included
 * The review's fixes (collect lane, 17 November 2026), each failing on df42fb8:
 *   SR8 (CO2) the one way in (POST /signals/ingest) keeps a count the collector did not give absent: no seven zeros, score and
 *       comments never NaN, and the evidence never says "no interactions" of a post whose counts were never read; a later read
 *       replaces the counts it gives and keeps the rest
 *   SR9 (CO3) a listing page read for the first time (or afresh) is a baseline: its links are filed before every window with
 *       meta.baseline and none is on the Board; a later read stamps only a new link as found; a newsroom whose feed delivered
 *       and then failed reads its listing as a baseline too; html and render are one page, a public page another
 *   SR10 (CO6) an item held before p71 under any escape its feed wrote (&amp;, &#038;, &#38;, &#x26;, doubled) is not filed again
 *   SR11 (CO7, B1) an undated item dated by its address and found on a later day is stamped at the end of that Sydney day
 *        (across a clock change too), and the evidence prints that day and never the stamp's time
 *   SR12 (CO8) the gas trigger counts a reservation bill, scheme or policy only with gas in the sentence
 *   SR13 (CO9) a Resources Minister story with gas, LNG, petroleum or offshore beside its mining word is not mining
 *   SR14 (CO10) a deal post with an "@ store" suffix is not critical minerals, priced or not; a handle is not a store
 *   SR15 (CO11) the state minerals councils are not MCA mentions as "NSW's", "N.S.W.", "of NSW" or "Queensland's"
 * The skeptics' problems with those fixes (collect lane, second round, 17 November 2026), each failing on 3b71160:
 *   SR16 (B1) an item found on its own address day keeps the moment it was found, after noon too, and one found the next
 *        morning takes its day's end: each stays in a 24-hour window as long as on p70; the evidence prints the day alone
 *   SR17 (B2) a commodity price written with "@" (a figure, "US$", "A$", "USD") is critical minerals; a deal's "@ store" is not
 *   SR18 (B3) a Resources Minister mining story keeps mining when its description, or the headline over it, mentions gas
 *   SR19 (B4) an ellipsis before "Minerals Council" counts; the NSW body written "N.S.W", "(NSW)" or ", NSW" does not, and
 *        the council in a list ("the Minerals Council, NSW Farmers and ...") still does
 *   SR20 (B5) an item held under &#0038;, &#x026; or &#X26; is not filed a second time, by a feed sweep either
 *   SR21 (B6) a sitemap that dates nothing is read as a listing: its first read is a baseline, a later read stamps what is new
 *   SR22 (B6) a listing the Mac rendered is filed by the worker (POST /sources/listing): a first read is a baseline there too
 * The skeptic's problems with the second round (collect lane, third round, 17 November 2026), each failing on 2ca1637:
 *   SR23 (H1) a probe a person asks for through the Mac files what is new as found, four days or forty after the last read;
 *        its first read is still a baseline, and so is a page another route delivered last; the answer says which it was;
 *        a sweep a schedule runs keeps the three-day window
 *   SR24 (H1) the worker's own render job, which the same button reaches, files by the same rule, and its log says when a
 *        read was a baseline instead of counting old links as new rows
 *   SR25 (H2) gas joined to a mining word beside the Resources Minister in other wording ("natural gas", "liquefied natural
 *        gas", "Gas and critical minerals", "Gas/minerals", "as well as", lists, "nor") is not mining; a contrast, a gas word
 *        with no coordinator after it, a separate clause and a run-on title still leave the mining story mining
 *   SR26 (H3) the council counts after a full stop with no space (a page's paragraphs joined) and an ellipsis that runs on,
 *        and before a comma, a state and a possessive or a joined hyphen; the NSW body as "N.S.W", "(NSW)" or ", NSW," does
 *        not; a long run of dots is read in linear time
 *   SR27 (H4) a deal whose store name is short or starts with a digit ("@ IGA $12", "@ 7-Eleven", "@ 99 Bikes") is not
 *        critical minerals; a price with a currency mark or code, decimals, a unit, three digits or a word a quote runs on
 *        with still is; any other word after the @ is a store, as before
 *   SR28 (integration, after the round-4 review) a long list joined with ", and" or ", or" beside the Resources Minister
 *        is tagged in linear time: H2's join read each such comma two ways, so 22 items took 577 ms and each item doubled it
 *   SR29 (integration, after the round-4 review) a person's Sweep of one source files what is new as found, as Probe
 *        does; a sweep a schedule runs keeps the 72-hour window
 * Run: node --experimental-sqlite tests/den-p71-sources-worker.mjs */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Den p71, sources: outlets read directly, the MCA mentions issue, the mining matcher, unknown counts');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const H = 3600000, D = 86400000, NOW = Date.now();
const mk = async env => { const w = await workerEnv({ env: Object.assign({}, env || {}), keys: KEYS }); w.t = w.mod.__test; w.db = w.env.MIND_DB.db; await w.call('GET', '/den/desks', null, 'read-key'); await w.t.archiveIndexEnsure(w.env, { force: true }); return w; };
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const T = (body, status, type) => new Response(body, { status: status || 200, headers: { 'Content-Type': type || 'application/rss+xml' } });
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
const rss = items => '<?xml version="1.0"?><rss><channel><title>t</title>' + items.map(i => '<item><title>' + i.t + '</title><link>' + i.l + '</link><pubDate>' + new Date(NOW - (i.ago || H)).toUTCString() + '</pubDate><description>' + (i.d || '') + '</description></item>').join('') + '</channel></rss>';
const page = links => '<html><body><nav><a href="/">Home</a></nav><main>' + links.map(l => '<a href="' + l[0] + '">' + l[1] + '</a>').join('') + '</main></body></html>';
const arc = (w, where) => w.db.prepare('SELECT * FROM arc_items WHERE ' + where + ' ORDER BY id').all().map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const board = async (w, desk) => (await F(w, 'GET', '/den/board?desk=' + desk, null, 'read-key')).body;
const tagged = (w, t, id) => w.t.issueTag(t).indexOf(id) >= 0;
let seq = 0;
const put = (w, kind, src, title, body, meta, ago) => { const url = 'https://p71.example.com.au/' + kind + '/' + (++seq); w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)").run(kind, src, title, body, url, meta == null ? null : JSON.stringify(meta), NOW - ago, NOW - ago); return w.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };

// what the registry held for these outlets on p70, as GET /sources gives it
const HELD = {
  region_au: { name: 'Region', tier: 'regional', juris: 'act', issues: ['gov'], methods: ['sitemap', 'html', 'gnews', 'render'], urls: { home: 'https://region.com.au/', site: 'region.com.au' } },
  reneweconomy: { name: 'RenewEconomy', tier: 'sector', juris: 'au', issues: ['energy'], methods: ['rss', 'wp', 'sitemap', 'gnews'], urls: { rss: 'https://reneweconomy.com.au/feed/', wp: 'https://reneweconomy.com.au', site: 'reneweconomy.com.au' } },
  aep_org: { name: 'Australian Energy Producers', tier: 'sector', juris: 'au', issues: ['gas', 'energy'], methods: ['rss', 'wp', 'sitemap', 'gnews'], urls: { rss: 'https://energyproducers.au/feed/', wp: 'https://energyproducers.au', site: 'energyproducers.au' } },
  mca_org: { name: 'Minerals Council of Australia', tier: 'sector', juris: 'au', issues: ['mining', 'ftc', 'cm'], methods: ['rss', 'wp', 'sitemap', 'gnews'], urls: { rss: 'https://minerals.org.au/feed/', wp: 'https://minerals.org.au', site: 'minerals.org.au' } },
  abc: { name: 'ABC News', tier: 'broadcaster', juris: 'au', issues: [], methods: ['rss'], urls: { rss: 'https://www.abc.net.au/news/feed/51120/rss.xml' } },
  abc_business: { name: 'ABC Business', tier: 'broadcaster', juris: 'au', issues: [], methods: ['rss'], urls: { rss: 'https://www.abc.net.au/news/feed/51892/rss.xml' } },
};
// what p71 adds
const ADDED = {
  p71_abc_environment: { tier: 'broadcaster', juris: 'au', issues: ['energy', 'gasprojects', 'mining'], methods: ['html', 'gnews', 'render'] },
  p71_abc_topstories: { tier: 'podcast', juris: 'au', issues: ['gov'], methods: ['podcast'] },
  p71_region: { tier: 'regional', juris: 'act', issues: ['gov'], methods: ['rss', 'wp', 'gnews'] },
  p71_aep_newsroom: { tier: 'sector', juris: 'au', issues: ['gas', 'energy'], methods: ['html', 'render'] },
  p71_mca_newsroom: { tier: 'sector', juris: 'au', issues: ['mining', 'ftc', 'cm'], methods: ['rss', 'html', 'render'] },
};

await S.t('SR1 the registry gains the non-subscriber outlets it lacked, and nothing it held changes', async () => {
  const w = await mk();
  const list = (await F(w, 'GET', '/sources', null, 'read-key')).body.sources; const by = Object.fromEntries(list.map(s => [s.id, s]));
  eq(list.length, new Set(list.map(s => s.id)).size, 'no id twice');
  for (const id of Object.keys(ADDED)) {
    const s = by[id]; ok(s, id + ' is in the registry after the sync'); const want = ADDED[id];
    eq([s.tier, s.juris, s.issues, s.methods], [want.tier, want.juris, want.issues, want.methods], id);
    eq([s.access, s.cleared, s.core, s.enabled], ['open', false, false, true], id + ': read openly, no subscriber flag, a registry source, on');
  }
  ok(/region\.com\.au\/feed\/$/.test(by.p71_region.urls.rss) && by.p71_region.urls.gnews === 'site:region.com.au' && !by.p71_region.urls.site, 'Region: its own feed first, Google News behind it, and not the sitemap that files category pages');
  ok(/^https:\/\/energyproducers\.au\/news\/$/.test(by.p71_aep_newsroom.urls.home), 'the AEP newsroom\'s listing page');
  ok(/^https:\/\/minerals\.org\.au\/resources\/feed\/$/.test(by.p71_mca_newsroom.urls.rss) && /^https:\/\/minerals\.org\.au\/resources\/$/.test(by.p71_mca_newsroom.urls.home), 'MCA\'s releases: their feed, then their listing page');
  eq(by.p71_abc_topstories.urls.podcast, 'ABC News Top Stories');
  ok(Object.keys(ADDED).every(id => !/theaustralian|heraldsun|couriermail|dailytelegraph|afr\.com/.test(JSON.stringify(by[id].urls))), 'no subscriber outlet is among them (D8)');
  eq([by.theaustralian.access, by.afr.access], ['subscriber', 'subscriber'], 'and the subscriber outlets stay as they were');
  for (const id of Object.keys(HELD)) { const s = by[id]; eq({ name: s.name, tier: s.tier, juris: s.juris, issues: s.issues, methods: s.methods, urls: s.urls }, HELD[id], id + ' is as it was'); }
  // the sync on a registry seeded before p71: the new rows are inserted and no other row changes, an operator's edit included
  w.db.prepare("DELETE FROM sources WHERE substr(id,1,4)='p71_'").run();
  w.db.prepare("UPDATE sources SET name='Region (as a person named it)', edited=1 WHERE id='region_au'").run();
  w.kv.set('sources_seed_v', 'p70');
  const strip = r => { const o = Object.assign({}, r); delete o.updated; return JSON.stringify(o); };
  const before = new Map(w.db.prepare('SELECT * FROM sources').all().map(r => [r.id, strip(r)]));
  await w.t.sourcesSeed(w.env);
  const after = w.db.prepare('SELECT * FROM sources').all();
  eq(after.length, before.size + Object.keys(ADDED).length, 'the five new sources, nothing else');
  const changed = after.filter(r => !/^p71_/.test(r.id) && strip(r) !== before.get(r.id)).map(r => r.id); eq(changed, [], 'no other row changed');
  eq(w.db.prepare("SELECT name FROM sources WHERE id='region_au'").get().name, 'Region (as a person named it)', 'an operator\'s edit stands');
  // each new route reads what its stand-in serves
  w.answer(/^https:\/\/region\.com\.au\/feed\/$/, () => T(rss([{ t: 'Senators weigh the gas reservation scheme before the vote', l: 'https://region.com.au/senators-weigh-gas-reservation-scheme/1000001/', ago: 2 * H }, { t: 'Lake Burley Griffin fun run draws a record field', l: 'https://region.com.au/fun-run-record-field/1000002/', ago: 3 * H }])));
  w.answer(/^https:\/\/energyproducers\.au\/news\/$/, () => T(page([['/news/producers-respond-to-the-senate-vote-on-gas-reservation', 'Producers respond to the Senate vote on gas reservation'], ['/about', 'About us']]), 200, 'text/html'));
  w.answer(/^https:\/\/minerals\.org\.au\/resources\/feed\/$/, () => T('not found', 404, 'text/html'));
  w.answer(/^https:\/\/minerals\.org\.au\/resources\/$/, () => T(page([['/resources/council-says-the-diesel-rebate-is-not-a-subsidy-for-miners/', 'Council says the diesel rebate is not a subsidy for miners']]), 200, 'text/html'));
  w.answer(/^https:\/\/www\.abc\.net\.au\/news\/topic\/environment$/, () => T(page([['/news/2026-11-16/regulator-delays-its-reef-gas-decision-again/107000001', 'Regulator delays its decision on the reef gas project again']]), 200, 'text/html'));
  w.answer(/^https:\/\/itunes\.apple\.com\/search\?term=ABC%20News%20Top%20Stories/, () => J({ results: [{ collectionName: 'ABC News Top Stories', feedUrl: 'https://feeds.example.com.au/top-stories.xml' }] }));
  w.answer(/^https:\/\/feeds\.example\.com\.au\/top-stories\.xml$/, () => T(rss([{ t: 'Does the government have the numbers in the upper house this week?', l: 'https://feeds.example.com.au/ep/1', ago: 2 * H }])));
  const sw = (await F(w, 'POST', '/sources/sweep', { ids: Object.keys(ADDED) })).body; const res = Object.fromEntries(sw.results.map(r => [r.id, r]));
  eq([res.p71_region.method, res.p71_aep_newsroom.method, res.p71_mca_newsroom.method, res.p71_abc_environment.method, res.p71_abc_topstories.method], ['rss', 'html', 'html', 'html', 'podcast'], JSON.stringify(sw.results).slice(0, 600));
  const reg = arc(w, "kind='news' AND src='p71_region'"); const gas = reg.find(r => /gas reservation/.test(r.title));
  ok(gas && gas.meta.issues.indexOf('gas') >= 0 && gas.meta.source === 'p71_region' && gas.meta.dated === 1, 'a Region story arrives dated, from its own feed, on its issue: ' + JSON.stringify(gas && gas.meta));
  ok(arc(w, "kind='news' AND src='p71_mca_newsroom'").some(r => r.meta.issues.indexOf('ftc') >= 0), 'MCA\'s release, read from its listing page when the feed did not answer');
});

await S.t('SR2 an MCA mentions issue: the council, its newsroom and its chief executive by name, never MCA alone', async () => {
  const w = await mk(); const t = w.t;
  // the chief executive is the register's own person (her name is read from the register here, never written in the harness)
  const reg = (await F(w, 'GET', '/entities?active=1', null, 'read-key')).body.entities.find(e => e.id === 'constable'); ok(reg && reg.ns === 'mca' && reg.kind === 'person' && /chief|ceo/i.test(reg.role || ''), 'the chief executive is in the register: ' + JSON.stringify(reg && { ns: reg.ns, kind: reg.kind, role: reg.role }));
  const ceo = String(reg.name);
  ['The Minerals Council of Australia said the credit is not a subsidy', 'A minerals council chief warns on diesel costs', 'Figures from the Minerals Council show a record year',
    'Australia\'s Minerals Council says the tax would cost jobs', ceo + ' told the committee the rebate refunds a road tax', 'Read the release at minerals.org.au/resources/one']
    .forEach(s => ok(tagged(w, s, 'mcamentions'), JSON.stringify(s) + ' should be an MCA mention (got ' + t.issueTag(s).join(',') + ')'));
  ['MCA', 'Crowds queue for the MCA exhibition in Sydney', 'The NSW Minerals Council backed the Premier', 'Minerals Council South Africa warns of power cuts', 'The Minerals Council of South Africa met the minister',
    'Tasmanian Minerals Council names a new chief', 'A police constable gave evidence', 'MCA chief welcomes the new exhibition wing']
    .forEach(s => ok(!tagged(w, s, 'mcamentions'), JSON.stringify(s) + ' should NOT be an MCA mention'));
  const lex = (await F(w, 'GET', '/reddit/issues', null, 'read-key')).body.issues; const i = lex.find(x => x.id === 'mcamentions');
  ok(i && i.ns === 'mca' && i.label === 'MCA mentions' && i.rx && i.wide, 'published with the lexicon'); ok(['minerals council of australia', ceo.toLowerCase()].every(q => i.q.indexOf(q) >= 0 && t.issueQueries(['mcamentions']).indexOf(q) >= 0), 'its search terms are asked');
  const desks = (await F(w, 'GET', '/den/desks', null, 'read-key')).body.desks; const mca = desks.find(d => d.id === 'mca_au'), aep = desks.find(d => d.id === 'aep_au');
  eq(mca.issues.map(x => x.id), ['ftc', 'cm', 'mining', 'mcamentions'], 'the MCA desk lists it last'); eq(mca.issues[3].label, 'MCA mentions'); ok(!aep.issues.some(x => x.id === 'mcamentions'), 'it is MCA\'s alone');
  eq(t.denNsIssues('mca')[0], 'ftc', 'the desk\'s first issue is still fuel tax credits');
  const sync = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/lexicon-sync.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  eq(sync.status, 0, 'the page and the Mac collector carry the same lexicon: ' + (sync.stderr || sync.stdout));
  // collected through a registry feed, tagged at collection, a card on the MCA desk
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_wire', name: 'Example Wire', tier: 'independent', urls: { rss: 'https://wire.example.com.au/feed/' } })).status, 200);
  w.answer(/^https:\/\/wire\.example\.com\.au\/feed\/$/, () => T(rss([{ t: 'Minerals Council of Australia says the payroll rule hurts regional towns', l: 'https://wire.example.com.au/news/council-payroll', ago: 2 * H },
    { t: 'Harbour gallery: the MCA exhibition opens this weekend', l: 'https://wire.example.com.au/news/gallery', ago: 2 * H }, { t: 'NSW Minerals Council names a new chair', l: 'https://wire.example.com.au/news/nsw-chair', ago: 2 * H }])));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['srtest_wire'] })).body.succeeded, 1);
  const rows = arc(w, "kind='news' AND src='srtest_wire'"); const by = re => rows.find(r => re.test(r.title));
  ok(by(/payroll/).meta.issues.indexOf('mcamentions') >= 0, JSON.stringify(by(/payroll/).meta.issues)); eq(by(/gallery/).meta.issues, [], 'the museum is nobody\'s');
  ok(by(/NSW Minerals/).meta.issues.indexOf('mcamentions') < 0 && by(/NSW Minerals/).meta.issues.indexOf('mining') >= 0, 'the NSW council is mining, not an MCA mention');
  const b = await board(w, 'mca_au'); const card = b.media.find(m => /payroll/.test(m.title));
  ok(card && card.issues.indexOf('mcamentions') >= 0, 'a card on the MCA desk under its mentions: ' + JSON.stringify(b.media.map(m => [m.title, m.issues]))); ok(!b.media.some(m => /gallery/.test(m.title)));
});

await S.t('SR3 the mining matcher wants mining beside "Pilbara", "miners" and "resources minister"', async () => {
  const w = await mk();
  const off = ['A state MP\'s undeclared debts to a Perth miner are before the integrity commission',
    'Heritage listing sought for an old drovers\' rest stop on a Pilbara stock route',
    'The Resources Minister brushed off a push to exempt one state from the national gas reservation scheme'];
  off.forEach(s => ok(!tagged(w, s, 'mining'), JSON.stringify(s) + ' should NOT be mining (got ' + w.t.issueTag(s).join(',') + ')'));
  ok(tagged(w, off[2], 'gas'), 'the gas scheme story is still the gas desk\'s');
  ['Pilbara iron ore expansion wins state approval', 'BHP faces a royalty dispute with the state government', 'Mine approval granted for a coal project near the river',
    'Critical-minerals mining boom draws investors', 'Gold miners rally as prices surge', 'A new Pilbara lithium mine wins approval', 'The Resources Minister backs a critical minerals reserve',
    'Billionaire miners rort the fuel tax credit, critics say', 'Miners weigh on the ASX as metal prices fall', 'Fortescue cuts jobs at a Pilbara operation']
    .forEach(s => ok(tagged(w, s, 'mining'), JSON.stringify(s) + ' should be mining (got ' + w.t.issueTag(s).join(',') + ')'));
  ok(!tagged(w, 'Bitcoin miners chase cheap power overseas', 'mining'), 'a crypto miner is not a mining story');
});

await S.t('SR4 engRow keeps a count it was not given absent', async () => {
  const w = await mk(); const E = (e) => w.t.engRow({ meta: {} }, e).meta.eng;
  eq(E({ likes: 3 }), { likes: 3 }, 'only what was given'); eq(E({ likes: 0, replies: 2 }), { likes: 0, replies: 2 }, 'counted, and none, is kept');
  eq(E({}), {}, 'no counts held'); eq(E(undefined), {}); eq(E({ views: undefined, quotes: null, reposts: 'n/a', likes: '12' }), { likes: 12 }, 'an absent or unreadable count stays absent; a numeral is a number');
  // a collector's row: Lemmy gives votes and comments, nothing else
  w.answer(/^https:\/\/aussie\.zone\/robots\.txt$/, () => T('', 404, 'text/plain'));
  w.answer(/^https:\/\/aussie\.zone\/api\/v3\/post\/list/, () => J({ posts: [{ post: { id: 71, name: 'Fuel tax credit debate returns to the Senate', body: 'A long thread on the diesel rebate.', published: new Date(NOW - H).toISOString() }, counts: { score: 0, upvotes: 0, comments: 4 }, community: { name: 'australia', title: 'Australia' } }] }));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['lemmy_aussiezone'] })).body.succeeded, 1);
  const lm = arc(w, "kind='sig_thread' AND src='lemmy'")[0]; eq(lm.meta.eng, { likes: 0, replies: 4 }, 'the counts Lemmy gave, and no reposts, quotes or views it never reported');
  // the Board reads every shape as before
  const post = (n, eng) => ({ src: 'bluesky', title: 'bluesky post', body: 'The gas export tax is overdue, post ' + n, url: 'https://bsky.app/profile/did:plc:p71/post/' + n, ts: NOW - 2 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'p71e' + n, eng } });
  eq((await F(w, 'POST', '/archive/add', { kind: 'sig_thread', rows: [post(1, {}), post(2, { likes: 0 }), post(3, { likes: 5, reposts: 2 })] })).status, 200);
  const soc = (await board(w, 'aep_au')).social; const tot = n => (soc.find(s => String(s.text).endsWith('post ' + n)) || {}).total;
  eq([tot(1), tot(2), tot(3)], [0, 0, 7], 'no count is NaN: ' + JSON.stringify(soc.map(s => [s.text, s.eng, s.total])));
});

await S.t('SR5 the back-fill tags core-feed rows again; a registry row keeps its collection tags', async () => {
  const w = await mk(); const meta = id => JSON.parse(w.db.prepare('SELECT meta FROM arc_items WHERE id=?').get(id).meta || '{}');
  const old = 'p70-lexicon'; ok(w.t.arcLexVersion() !== old);
  const core = put(w, 'news', 'guardian', 'Old photographs of Pilbara drovers go on show at the town museum', 'The drovers moved cattle along the coast road for decades.', { source: 'guardian', outlet: 'Guardian Australia', issues: ['mining'], tagv: old }, 3 * H);
  const reg = put(w, 'news', 'heritage_wire', 'Descendants gather at an old Pilbara drovers\' camp', 'A ceremony at the camp.', { reg: 1, source: 'heritage_wire', issues: ['mining'] }, 3 * H);
  const r = await w.t.arcTagFill(w.env, { limit: 300 }); ok(r.tagged >= 1, JSON.stringify(r));
  eq([meta(core).issues, meta(core).tagv], [[], w.t.arcLexVersion()], 'the core row is tagged again under the new matcher');
  eq(meta(reg).issues, ['mining'], 'a registry row keeps the tags it was collected with');
  const b = await board(w, 'mca_au'); ok(!b.media.some(m => /photographs/.test(m.title)), 'the feature leaves the MCA desk'); ok(b.media.some(m => /Descendants/.test(m.title)), 'the registry row stays until it ages out');
});

await S.t('SR6 the gas issue\'s tight trigger knows the bill\'s headline forms, with "gas" beside each', async () => {
  const w = await mk(); const rx = w.t.CLIENT_ISSUES.find(c => c.id === 'gas').rx;
  ['Crossbench threatens to stall gas reform', 'Upper house to weigh the gas reserves plan', 'Factories seek a bigger share of the gas reserve', 'Unions urge MPs to back the gas plan',
    'Last-minute talks before the gas vote', 'Manufacturers rally behind the national gas scheme', 'A reservation bill for east coast gas heads to the Senate', 'Government defends its gas reservation scheme']
    .forEach(s => ok(rx.test(s), JSON.stringify(s) + ' should start the gas count'));
  ['Reserve Bank holds rates', 'Petrol and gas station prices rise over Easter', 'Kurri Kurri gas plant delayed again', 'A reservation for dinner at the harbour', 'Nature reserve reopens after the fire']
    .forEach(s => ok(!rx.test(s), JSON.stringify(s) + ' should NOT start the gas count'));
  const r = w.t.denRel('Crossbench move to stall gas reform draws an industry backlash', '', ['gas'], {}); eq([r.tight, r.passing], [true, false], 'the bill\'s headline is tight for the rank');
});

await S.t('SR7 a deal post for lithium batteries is not critical minerals; lithium mining and refining news still is', async () => {
  const w = await mk();
  ['Twin pack Voltmate lithium button cells $3.15 ($2.84 S&S) + Delivery @ Example Store', 'Cordless 18V lithium drill kit $99 @ Hardware Barn', 'Cobalt drill bit set $19.95 @ Tool Shed', 'Lithium torch twin pack, free shipping']
    .forEach(s => ok(!tagged(w, s, 'cm'), JSON.stringify(s) + ' should NOT be critical minerals'));
  ['Lithium prices slump as battery demand cools', 'Pilbara lithium refinery mothballed after the price fall', 'A miner weighs the sale of its lithium assets', 'Producer strikes a lithium offtake deal with a carmaker',
    'Nickel miners cut jobs as prices fall', 'Cobalt supply squeeze hits battery makers', 'Lithium stocks fall 20% after the price update', 'Graphite processing plant wins approval']
    .forEach(s => ok(tagged(w, s, 'cm'), JSON.stringify(s) + ' should be critical minerals (got ' + w.t.issueTag(s).join(',') + ')'));
});

// ---- the review's fixes (collect lane, 17 November 2026): CO2, CO3, CO6, CO7, CO8, CO9, CO10, CO11 ----
const sydDay = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const sydHm = t => new Intl.DateTimeFormat('en-GB', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t));
const evS = async (w, desk) => { const T0 = w.mod.__test; const d = await T0.deskGet(w.env, desk); const b = await T0.denBoard(w.env, d, { keepRows: true }); const ev = await T0.denEvidence(w.env, d, b, null, [], { memory: false }); return { board: b, S: ev.text.split('\n').filter(l => l.indexOf('[S:') === 0) }; };

await S.t('SR8 the one way in keeps a count the collector did not give absent, and a later read never erases one', async () => {
  const w = await mk(); const TXT = n => 'A gas export tax would fund every school in Australia, post ' + n;
  const P = (code, n, eng, o) => Object.assign({ platform: 'instagram', url: 'https://www.instagram.com/p/' + code + '/', text: TXT(n), ts: NOW - 2 * H, q: 'gas export tax', eng }, o || {});
  // a scrape that read no counts (no eng; reach_social's {}), a post counted at nothing, a hidden like count with comments read, numerals and unreadable values
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [P('P71none001', 'one'), P('P71empty01', 'two', {}), P('P71zero001', 'three', { likes: 0, comments: 0 }),
    P('P71hide001', 'four', { likes: null, comments: 3 }), P('P71react01', 'five', { likes: '12', views: 'n/a', reactions: { like: 4, angry: 'x', love: null } })] });
  eq([r.status, r.body.kept, r.body.inserted], [200, 5, 5], JSON.stringify(r.body).slice(0, 300));
  const meta = n => (arc(w, "kind='sig_thread' AND src='instagram'").find(x => x.body === TXT(n)) || {}).meta || {};
  eq(['one', 'two', 'three', 'four'].map(n => meta(n).eng), [{}, {}, { likes: 0, comments: 0 }, { comments: 3 }], 'only the counts the collector read');
  eq(meta('five').eng, { likes: 12, reactions: { like: 4 } }, 'a numeral is a number; an unreadable count or reaction stays absent');
  eq([meta('one').score, meta('one').comments, meta('four').score, meta('four').comments, meta('five').score], [0, 0, 0, 3, 12], 'score and comments are numbers, never NaN');
  const { board: b, S: lines } = await evS(w, 'aep_au'); const line = n => lines.find(l => l.indexOf(TXT(n) + ' | ') >= 0) || '';
  ok(line('one') && line('two') && !/no interactions/.test(line('one') + line('two')), 'a post whose counts were never read is not said to have drawn none: ' + line('one'));
  ok(/\| no interactions$/.test(line('three')), 'a post counted at nothing is: ' + line('three')); ok(/\| 3 comments$/.test(line('four')), line('four'));
  ok(b.social.every(s => typeof s.total === 'number' && s.total === s.total), 'no total on the Board is NaN: ' + JSON.stringify(b.social.map(s => s.total)));
  // a later read that gives fewer counts never erases what an earlier read gave; a later count replaces only its own
  const u = 'https://www.instagram.com/p/P71merge01/', t1 = NOW - 30 * 60000; const again = (layer, eng, at) => F(w, 'POST', '/signals/ingest', { ns: 'aep', layer, via: layer === 1 ? 'graph' : 'reach', rows: [P('P71merge01', 'six', eng, { eng_at: at })] });
  await again(1, { likes: 40, comments: 6 }, t1 - 60000); await again(3, {}, t1);
  let m6 = arc(w, "kind='sig_thread' AND url='" + u + "'")[0].meta; eq([m6.eng, m6.score, m6.comments], [{ likes: 40, comments: 6 }, 40, 6], 'a later read with no counts keeps the counts read before');
  await again(3, { likes: 52 }, t1 + 60000);
  m6 = arc(w, "kind='sig_thread' AND url='" + u + "'")[0].meta; eq([m6.eng, m6.score, m6.comments, m6.eng_at], [{ likes: 52, comments: 6 }, 52, 6, t1 + 60000], 'a later count replaces its own and keeps the rest');
});

await S.t('SR9 a listing page read for the first time is a baseline, filed before every window; a later read stamps only what is new', async () => {
  const w = await mk(); const t0 = Date.now(); const mine = src => arc(w, "kind='news' AND src='" + src + "'");
  let links = Array.from({ length: 12 }, (_, i) => ['/news/producers-statement-on-east-coast-gas-supply-number-' + (i + 1) + '/', 'Producers set out their view on east coast gas supply, statement ' + (i + 1)]);
  w.answer(/^https:\/\/energyproducers\.au\/news\/$/, () => T(page(links), 200, 'text/html'));
  const s1 = (await F(w, 'POST', '/sources/sweep', { ids: ['p71_aep_newsroom'] })).body; eq([s1.succeeded, s1.added], [1, 12], JSON.stringify(s1.results));
  ok(mine('p71_aep_newsroom').every(r => r.meta.baseline === 1 && r.meta.dated === 0 && r.ts <= t0 - 28 * D && r.meta.issues.indexOf('gas') >= 0),
    'the first read is a baseline, before any window a desk reads and the window before it: ' + JSON.stringify(mine('p71_aep_newsroom').map(r => [Math.round((r.ts - t0) / D), r.meta.baseline])));
  ok(!(await board(w, 'aep_au')).media.some(m => /east coast gas supply, statement/.test(m.title)), 'none of the old releases is on the Board as the day\'s news');
  links = [['/news/producers-welcome-the-senate-result-on-gas-supply/', 'Producers welcome the Senate result on gas supply']].concat(links);
  const s2 = (await F(w, 'POST', '/sources/sweep', { ids: ['p71_aep_newsroom'] })).body; eq([s2.succeeded, s2.added], [1, 1], 'read again, only the new link is filed: ' + JSON.stringify(s2.results));
  const fresh = mine('p71_aep_newsroom').find(r => /Senate result/.test(r.title));
  ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'a link new since the last read is stamped as found: ' + JSON.stringify(fresh && fresh.meta));
  ok((await board(w, 'aep_au')).media.some(m => /Senate result/.test(m.title)), 'and is on the Board');
  // a newsroom whose feed delivered and then failed: its listing page, read for the first time, is a baseline too
  let feedUp = true; const mrel = n => '/resources/council-statement-on-fuel-tax-credits-number-' + n + '/';
  w.answer(/^https:\/\/minerals\.org\.au\/resources\/feed\/$/, () => feedUp ? T(rss([{ t: 'Minerals Council statement on fuel tax credits, number 1', l: 'https://minerals.org.au' + mrel(1), ago: 2 * H }])) : T('gone', 404, 'text/html'));
  let mlinks = Array.from({ length: 8 }, (_, i) => [mrel(i + 1), 'Minerals Council statement on fuel tax credits, number ' + (i + 1)]);
  w.answer(/^https:\/\/minerals\.org\.au\/resources\/$/, () => T(page(mlinks), 200, 'text/html'));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['p71_mca_newsroom'] })).body.results[0].method, 'rss');
  feedUp = false; const m2 = (await F(w, 'POST', '/sources/sweep', { ids: ['p71_mca_newsroom'] })).body.results[0]; eq([m2.method, m2.added], ['html', 7], JSON.stringify(m2));
  const mr = mine('p71_mca_newsroom'); ok(mr.filter(r => r.meta.method === 'html').every(r => r.meta.baseline === 1 && r.ts <= t0 - 28 * D), 'the seven releases the feed never carried are a baseline: ' + JSON.stringify(mr.map(r => [r.meta.method, r.meta.baseline])));
  ok(mr.some(r => r.meta.method === 'rss' && !r.meta.baseline && r.meta.dated === 1), 'the feed\'s own dated item is as it was');
  mlinks = [['/resources/council-welcomes-the-review-of-fuel-tax-credits/', 'Minerals Council welcomes the review of fuel tax credits']].concat(mlinks);
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['p71_mca_newsroom'] })).body.results[0].added, 1, 'read again through the same page, one new release');
  const mb = (await board(w, 'mca_au')).media; ok(mb.some(m => /welcomes the review/.test(m.title)) && !mb.some(m => /number [2-8]$/.test(m.title)), 'the MCA desk shows the new release and none of the baseline: ' + JSON.stringify(mb.map(m => m.title)));
  // the shape a render job files, straight through sourceRows: html and render read one page, a public page is another
  const items = [{ title: 'A listing link with no date on east coast gas supply', link: 'https://list.example.com.au/news/a-listing-link-with-no-date/', date: '' }];
  const R = (o, method) => w.t.sourceRows(Object.assign({ id: 'srtest', tier: 'sector', juris: 'au', last_ok: 0, method_ok: '' }, o), { items, method }, NOW)[0];
  ok(R({}, 'render').meta.baseline === 1 && R({}, 'render').ts <= NOW - 28 * D, 'a render job\'s first read is a baseline');
  eq([R({ last_ok: NOW - H, method_ok: 'html' }, 'render').ts, R({ last_ok: NOW - H, method_ok: 'render' }, 'html').meta.baseline], [NOW, undefined], 'html and render read one page');
  eq([R({ last_ok: NOW - H, method_ok: 'html' }, 'public').meta.baseline, R({ last_ok: NOW - 4 * D, method_ok: 'html' }, 'html').meta.baseline], [1, 1], 'a public page is another page; one last read more than three days ago is read afresh');
  eq([R({}, 'rss').ts, R({}, 'rss').meta.baseline], [NOW, undefined], 'an undated feed item is stamped as found, as before');
});

await S.t('SR10 an item held before p71 under any escape its feed wrote is not filed a second time', async () => {
  const w = await mk(); const base = 'https://gazette.example.com.au/news/levy-story-', q = '/?utm_source=rss{A}utm_medium=rss{A}utm_campaign=levy';
  const FORMS = ['&amp;', '&#38;', '&#038;', '&#x26;', '&amp;amp;', '&amp;#038;']; const at = (i, a) => base + i + q.replace(/\{A\}/g, a);
  FORMS.forEach((f, i) => w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','srtest_gazette',?,'',?,'',NULL,?,?,?)").run('Levy story ' + i, at(i, f), JSON.stringify({ reg: 1 }), NOW - H, NOW - H));
  ok(FORMS.every((f, i) => w.t.feedLink(at(i, f)) === at(i, '&')), 'each form is one the collector reads back to the plain address');
  const rows = FORMS.map((f, i) => ({ src: 'srtest_gazette', title: 'Levy story ' + i, url: at(i, '&'), ts: NOW - H, meta: { reg: 1 } }));
  const left = await w.t.arcEscUnheld(w.env, 'news', rows.concat([{ url: at('new', '&') }])); eq(left.map(x => x.url), [at('new', '&')], 'only the address never held is left to file');
  eq((await F(w, 'POST', '/archive/add', { kind: 'news', rows })).status, 200);
  eq(arc(w, "kind='news' AND src='srtest_gazette'").map(r => r.url), FORMS.map((f, i) => at(i, f)), 'collected again, no second copy under any form');
});

// review B1 changed what SR11 pins: noon (CO7's stamp) is a time an evening story may not have had, and it took a story out of
// a 24-hour window early. CO7's intent stands: the model is never told a time the story did not have, as the line shows
await S.t('SR11 an undated item dated by its address and found on a later day is stamped at the end of that Sydney day, printed as the day alone', async () => {
  const w = await mk(); const d2 = NOW - 2 * D; const link = 'https://gazette.example.com.au/news/' + sydDay(d2).split('-').join('/') + '/a-story-with-no-date-on-the-gas-reservation-bill/';
  const ts = w.t.feedUrlDate(link, NOW); eq([sydDay(ts), sydHm(ts)], [sydDay(d2), '23:59'], 'the end of the day in its address');
  eq([sydHm(w.t.feedUrlDate('https://g.example.com.au/2026/10/04/a', Date.UTC(2026, 9, 20))), sydHm(w.t.feedUrlDate('https://g.example.com.au/2026/04/05/b', Date.UTC(2026, 3, 20)))], ['23:59', '23:59'], 'on the days daylight saving starts and ends');
  const morning = Date.UTC(2026, 10, 17, 22); eq(w.t.feedUrlDate('https://g.example.com.au/news/2026/11/18/c', morning), morning, 'found on its own day: the moment it was found');
  const r = w.t.sourceRows({ id: 'srtest', tier: 'regional', juris: 'au', last_ok: NOW - H, method_ok: 'rss' }, { method: 'rss', items: [{ title: 'Senators weigh the gas reservation bill again', link, date: '' }] }, NOW)[0];
  eq([r.ts, r.meta.urldate, r.meta.dated], [ts, 1, 0], 'filed at that day\'s end, the day marked as read from its address');
  eq(sydHm(w.t.arcCoreRow({ src: 'abc', title: 'A core story with no date', link, date: '' }).ts), '23:59', 'a core feed\'s undated item too');
  eq((await F(w, 'POST', '/archive/add', { kind: 'news', rows: [r] })).status, 200);
  const d = await w.t.deskGet(w.env, 'aep_au'); const b = await w.t.denBoard(w.env, d, { keepRows: true, hours: 72 }); const m = b.media.find(x => /gas reservation bill/.test(x.title));
  ok(m && m.urlDated && !m.stale, 'on a 72-hour Board, dated by its address: ' + JSON.stringify(b.media.map(x => [x.title, x.urlDated, x.stale])));
  const ev = await w.t.denEvidence(w.env, d, b, null, [], { memory: false }); const line = ev.text.split('\n').find(l => l.indexOf('[M:' + m.id + ']') === 0) || '';
  ok(/\| \d{1,2} [a-z]{3} \(the date in its address\) \|/i.test(line) && !/\d{1,2}:\d{2}/.test(line), 'the evidence prints the day alone, never 23:59: ' + line);
});

await S.t('SR12 the gas trigger counts a reservation bill, scheme or policy only with gas in the sentence', async () => {
  const w = await mk(); const gas = w.t.CLIENT_ISSUES.find(c => c.id === 'gas');
  ['Campsite reservation scheme opens for the summer holidays', 'Airline seat reservation policy changes next month', 'Council passes a land reservation bill for the foreshore']
    .forEach(s => ok(!gas.rx.test(s) && !tagged(w, s, 'gas'), JSON.stringify(s) + ' is not a gas story'));
  ['A reservation bill for east coast gas heads to the Senate', 'Gas users back the reservation scheme', 'Government defends its gas reservation scheme']
    .forEach(s => ok(gas.rx.test(s), JSON.stringify(s) + ' should start the gas count'));
});

await S.t('SR13 a Resources Minister story with gas in the sentence is not mining', async () => {
  const w = await mk();
  ['The Resources Minister approves new offshore gas exploration permits', 'The Resources Minister backs gas exploration in the Northern Territory', 'The Resources Minister said gas and minerals exports rose',
    'Gas and minerals exports rose, the Resources Minister said'].forEach(s => { ok(!tagged(w, s, 'mining'), JSON.stringify(s) + ' should NOT be mining (got ' + w.t.issueTag(s).join(',') + ')'); ok(tagged(w, s, 'gas'), JSON.stringify(s) + ' is the gas desk\'s'); });
  ['The Resources Minister backs a critical minerals reserve', 'Gold and copper exports rose, the Resources Minister said', 'The Resources Minister opened a copper mine. Gas prices rose as well.']
    .forEach(s => ok(tagged(w, s, 'mining'), JSON.stringify(s) + ' should be mining (got ' + w.t.issueTag(s).join(',') + ')'));
});

await S.t('SR14 a deal post with an "@ store" suffix is not critical minerals, priced or not', async () => {
  const w = await mk();
  ['Free Brightzap lithium batteries with any purchase @ Stationery Plus', '50% off lithium batteries @ Megamart AU', 'Lithium battery recycling day @ Shire depot']
    .forEach(s => ok(!tagged(w, s, 'cm'), JSON.stringify(s) + ' should NOT be critical minerals'));
  ['Lithium refinery wins approval, says @harbourwatch', 'Lithium prices slump as battery demand cools', 'Nickel miners cut jobs as prices fall']
    .forEach(s => ok(tagged(w, s, 'cm'), JSON.stringify(s) + ' should be critical minerals (a handle is not a store suffix)'));
});

await S.t('SR15 the state minerals councils are not MCA mentions in a possessive, dotted or reversed form', async () => {
  const w = await mk(); const mention = w.t.CLIENT_ISSUES.find(c => c.id === 'mcamentions'); const RQ = String.fromCharCode(8217);   // a typeset apostrophe
  ['NSW\'s Minerals Council chief said the rules hurt', 'NSW' + RQ + 's Minerals Council chief said the rules hurt','The N.S.W. Minerals Council backed the plan', 'The Minerals Council of NSW backed the plan',
    'Queensland\'s minerals council wants a review', 'Tasmania\'s Minerals Council names a chair', 'Minerals Council of New South Wales responds']
    .forEach(s => ok(!tagged(w, s, 'mcamentions') && !mention.rx.test(s), JSON.stringify(s) + ' should NOT be an MCA mention'));
  ['Australia\'s Minerals Council says the tax would cost jobs', 'Australia' + RQ + 's Minerals Council says the tax would cost jobs','The tax will cost jobs. Minerals Council figures show it',
    'The rebate stays, the Minerals Council says', '"Minerals Council" figures show a record year']
    .forEach(s => ok(tagged(w, s, 'mcamentions') && mention.rx.test(s), JSON.stringify(s) + ' should be an MCA mention (got ' + w.t.issueTag(s).join(',') + ')'));
});

// ---- the skeptics' problems with those fixes (collect lane, second round, 17 November 2026): B1-B6 ----
const syd = (mo, d, h, mi) => Date.UTC(2026, mo - 1, d, h - 11, mi);   // a Sydney time in November 2026 (summer time, UTC+11)
const lineOf = (ev, id) => ev.text.split('\n').find(l => l.indexOf('[M:' + id + ']') === 0) || '';
const sync = () => spawnSync(process.execPath, [fileURLToPath(new URL('../tools/lexicon-sync.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });

await S.t('SR16 an item found on its own address day keeps the moment it was found, after noon too, and stays in a 24-hour window as on p70', async () => {
  const w = await mk(); const src = { id: 'srtest_env', tier: 'broadcaster', juris: 'au', last_ok: 0, method_ok: '' };
  const found = syd(11, 16, 18, 30), link = 'https://harbournews.example.com.au/news/2026-11-16/regulator-delays-its-reef-gas-decision-again/107000001';
  eq(w.t.feedUrlDate(link, found), found, 'found at 18:30 on the day in its address: 18:30, not noon');
  const rows = w.t.sourceRows(src, { method: 'html', undated: true, items: [{ title: 'Regulator delays its decision on the reef gas project again', link, date: '' }] }, found);
  eq([rows[0].ts, rows[0].meta.urldate, rows[0].meta.baseline], [found, 1, undefined], 'filed at the moment it was found, its day read from its address');
  // dated the day before and found the next morning: the end of its own day
  const late = 'https://harbournews.example.com.au/news/2026-11-16/coal-seam-gas-field-wins-approval/107000002', end = syd(11, 16, 23, 59) + 59000;
  const lrow = w.t.sourceRows(Object.assign({}, src, { last_ok: found, method_ok: 'html' }), { method: 'html', undated: true, items: [{ title: 'Coal seam gas field wins approval', link: late, date: '' }] }, syd(11, 17, 9, 0))[0];
  eq([lrow.ts, lrow.meta.urldate], [end, 1], 'found the next morning: the end of the day in its address');
  eq((await F(w, 'POST', '/archive/add', { kind: 'news', rows: rows.concat([lrow]) })).status, 200);
  const d = await w.t.deskGet(w.env, 'aep_au'); const on = async (to, re) => (await w.t.denBoard(w.env, d, { to, keepRows: true })).media.some(m => re.test(m.title));
  ok(await on(syd(11, 17, 16, 58), /reef gas project/), 'at 16:58 the next day it is still on the AEP Board, as on p70');
  ok(!(await on(syd(11, 17, 18, 31), /reef gas project/)), 'it leaves 24 hours after it was found');
  ok(await on(syd(11, 17, 23, 30), /Coal seam gas field/), 'one dated the day before stays until the next midnight, as on p70');
  ok(!(await on(syd(11, 18, 0, 30), /Coal seam gas field/)), 'and not after it');
  const b = await w.t.denBoard(w.env, d, { to: syd(11, 17, 16, 58), keepRows: true }); const m = b.media.find(x => /reef gas project/.test(x.title));
  const line = lineOf(await w.t.denEvidence(w.env, d, b, null, [], { memory: false }), m.id);
  ok(/\| 16 nov \(the date in its address\) \|/i.test(line) && !/\d{1,2}:\d{2}/.test(line), 'the evidence prints its day, never a time it did not have: ' + line);
});

await S.t('SR17 a commodity price written with "@" is critical minerals; a deal\'s "@ store" still is not', async () => {
  const w = await mk();
  ['Lithium carbonate @ US$10,500/t as demand in China slows', 'Spodumene price update: lithium @ 850 a tonne', 'ZZL @ 2.50 as lithium rallies', 'Nickel @ A$22,000 a tonne as the smelter closes', 'Cobalt hydroxide @ USD 33,000/t']
    .forEach(s => ok(tagged(w, s, 'cm'), JSON.stringify(s) + ' should be critical minerals (got ' + w.t.issueTag(s).join(',') + ')'));
  ['Lithium AA batteries 4-pack @ Example Mart', 'Free Brightzap lithium batteries with any purchase @ Stationery Plus', 'Cordless 18V lithium drill kit $99 @ Hardware Barn']
    .forEach(s => ok(!tagged(w, s, 'cm'), JSON.stringify(s) + ' should NOT be critical minerals'));
  const row = w.t.arcCoreRow({ src: 'abc', title: 'Lithium carbonate @ US$10,500/t as demand in China slows', desc: 'Prices fell for a third week.', link: 'https://harbournews.example.com.au/markets/lithium-price-falls', date: new Date(NOW - H).toUTCString() });
  ok(row.meta.issues.indexOf('cm') >= 0, 'a feed\'s market story is tagged at collection: ' + JSON.stringify(row.meta.issues));
  const s = sync(); eq(s.status, 0, 'the page and the Mac collector carry the same matcher: ' + (s.stderr || s.stdout));
});

await S.t('SR18 a Resources Minister mining story keeps mining when its description, or the headline over it, mentions gas', async () => {
  const w = await mk(); const both = (t, d) => w.t.issueTag(t + ' ' + d);   // a title and its description, as collection reads them
  [['Resources Minister approves copper mine expansion', 'The approval came as the minister also signed off on offshore gas permits.'],
    ['Resources Minister backs critical minerals reserve', 'Offshore acreage was also released to petroleum explorers.'],
    ['Gas prices climb again', 'The Resources Minister opened a copper mine in the north.']]
    .forEach(([t, d]) => ok(both(t, d).indexOf('mining') >= 0, JSON.stringify(t + ' ' + d) + ' should be mining (got ' + both(t, d).join(',') + ')'));
  const row = w.t.arcCoreRow({ src: 'abc', title: 'Resources Minister approves copper mine expansion', desc: 'The approval came as the minister also signed off on offshore gas permits.', link: 'https://harbournews.example.com.au/news/copper-mine-expansion', date: new Date(NOW - H).toUTCString() });
  ok(row.meta.issues.indexOf('mining') >= 0 && row.meta.issues.indexOf('gas') >= 0, 'a feed\'s row is mining and gas: ' + JSON.stringify(row.meta.issues));
  ['The Resources Minister said minerals and gas exports rose', 'Minerals, oil and gas exports rose, the Resources Minister said', 'The Resources Minister said gas and minerals exports rose']
    .forEach(s => ok(!tagged(w, s, 'mining'), JSON.stringify(s) + ' should NOT be mining: gas is joined to its mining word'));
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

await S.t('SR19 an ellipsis before the council counts; the NSW body as "N.S.W", "(NSW)" or ", NSW" does not', async () => {
  const w = await mk(); const mention = w.t.CLIENT_ISSUES.find(c => c.id === 'mcamentions'); const EL = String.fromCharCode(8230);   // a typeset ellipsis
  ['Costs rose... Minerals Council data show', 'Costs rose' + EL + ' Minerals Council data show', 'Business groups including the Minerals Council, NSW Farmers and the retailers backed it']
    .forEach(s => ok(tagged(w, s, 'mcamentions') && mention.rx.test(s), JSON.stringify(s) + ' should be an MCA mention (got ' + w.t.issueTag(s).join(',') + ')'));
  ['The N.S.W Minerals Council backed the plan', 'The Minerals Council (NSW) backed the plan', 'Jo Example, Minerals Council, NSW', 'Jo Example, Minerals Council, NSW, said the plan was sound', 'The Minerals Council (Queensland) wants a review']
    .forEach(s => ok(!tagged(w, s, 'mcamentions') && !mention.rx.test(s), JSON.stringify(s) + ' should NOT be an MCA mention'));
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

await S.t('SR20 an item held under &#0038;, &#x026; or &#X26; is not filed a second time, by a feed sweep either', async () => {
  const w = await mk(); const base = 'https://levy.example.com.au/news/levy-update-', q = '/?utm_source=rss{A}utm_medium=rss';
  const FORMS = ['&#0038;', '&#x026;', '&#X26;']; const at = (i, a) => base + i + q.replace(/\{A\}/g, a);
  FORMS.forEach((f, i) => w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','srtest_levy',?,'',?,'',NULL,?,?,?)").run('Gas levy update number ' + i, at(i, f), JSON.stringify({ reg: 1 }), NOW - H, NOW - H));
  ok(FORMS.every((f, i) => w.t.feedLink(at(i, f)) === at(i, '&')), 'each is a form the collector reads back to the plain address');
  w.env.MIND_DB.maxVars = 100;   // as D1: no statement binds more than 100 values (nine forms of fourteen addresses are 126 keys)
  const fresh = Array.from({ length: 11 }, (_, i) => ({ url: at('new' + i, '&') }));
  const left = await w.t.arcEscUnheld(w.env, 'news', FORMS.map((f, i) => ({ url: at(i, '&') })).concat(fresh)); eq(left.map(x => x.url), fresh.map(x => x.url), 'only the addresses never held are left to file');
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_levy', name: 'Example Levy Gazette', tier: 'regional', urls: { rss: 'https://levy.example.com.au/feed/' } })).status, 200);
  w.answer(/^https:\/\/levy\.example\.com\.au\/feed\/$/, () => T(rss(FORMS.map((f, i) => ({ t: 'Gas levy update number ' + i, l: at(i, f), ago: 2 * H })))));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['srtest_levy'] })).body.succeeded, 1);
  eq(arc(w, "kind='news' AND url LIKE 'https://levy.example.com.au/news/%'").map(r => r.url), FORMS.map((f, i) => at(i, f)), 'swept again, no second copy under any of them');
});

await S.t('SR21 a sitemap that dates nothing is read as a listing: its first read is a baseline, a later read stamps only what is new', async () => {
  const w = await mk(); const t0 = Date.now(); const mine = () => arc(w, "kind='news' AND src='srtest_maps'");
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_maps', name: 'Example Maps Gazette', tier: 'regional', urls: { sitemap: 'https://maps.example.com.au/news-sitemap.xml' } })).status, 200);
  let locs = Array.from({ length: 8 }, (_, i) => ['https://maps.example.com.au/news/producers-statement-on-gas-supply-number-' + (i + 1) + '/', 'Producers set out their view on gas supply, statement ' + (i + 1)]);
  w.answer(/^https:\/\/maps\.example\.com\.au\/news-sitemap\.xml$/, () => T('<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' + locs.map(l => '<url><loc>' + l[0] + '</loc><news:news><news:title>' + l[1] + '</news:title></news:news></url>').join('') + '</urlset>', 200, 'application/xml'));
  const s1 = (await F(w, 'POST', '/sources/sweep', { ids: ['srtest_maps'] })).body; eq([s1.succeeded, s1.added, s1.results[0].method], [1, 8, 'sitemap'], JSON.stringify(s1.results));
  ok(mine().every(r => r.meta.baseline === 1 && r.meta.dated === 0 && r.ts <= t0 - 28 * D), 'the first read is a baseline: ' + JSON.stringify(mine().map(r => [Math.round((r.ts - t0) / D), r.meta.baseline])));
  ok(!(await board(w, 'aep_au')).media.some(m => /gas supply, statement/.test(m.title)), 'none of them is on the Board as the day\'s news');
  locs = [['https://maps.example.com.au/news/producers-welcome-the-gas-supply-deal/', 'Producers welcome the gas supply deal']].concat(locs);
  const s2 = (await F(w, 'POST', '/sources/sweep', { ids: ['srtest_maps'] })).body; eq([s2.succeeded, s2.added], [1, 1], JSON.stringify(s2.results));
  const fresh = mine().find(r => /supply deal/.test(r.title)); ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'a new entry is stamped as found: ' + JSON.stringify(fresh && fresh.meta));
  ok((await board(w, 'aep_au')).media.some(m => /supply deal/.test(m.title)), 'and is on the Board');
});

await S.t('SR22 a listing the Mac rendered is filed by the worker: its first read is a baseline, a later read stamps only what is new', async () => {
  const w = await mk(); const t0 = Date.now(); const mine = () => arc(w, "kind='news' AND src='p71_aep_newsroom'");
  let items = Array.from({ length: 12 }, (_, i) => ({ title: 'Producers set out their view on east coast gas supply, statement ' + (i + 1), link: 'https://energyproducers.au/news/producers-statement-on-east-coast-gas-supply-number-' + (i + 1) + '/' }));
  const send = key => F(w, 'POST', '/sources/listing', { id: 'p71_aep_newsroom', ok: true, method: 'render', ms: 900, items }, key);
  eq((await send('read-key')).status, 403, 'a read key files nothing');
  const r1 = await send(); eq([r1.status, r1.body.added, r1.body.rows], [200, 12, 12], JSON.stringify(r1.body).slice(0, 300));
  ok(mine().length === 12 && mine().every(r => r.meta.baseline === 1 && r.meta.method === 'render' && r.meta.via === 'reach' && r.ts <= t0 - 28 * D && r.meta.issues.indexOf('gas') >= 0),
    'the first render is a baseline, filed and tagged by the worker: ' + JSON.stringify(mine().map(r => [Math.round((r.ts - t0) / D), r.meta.baseline, r.meta.via])));
  const h = w.db.prepare("SELECT method, n, ok FROM source_health WHERE src='p71_aep_newsroom' ORDER BY id DESC").get();
  eq([r1.body.source.method_ok, r1.body.source.last_ok >= t0, h.method, h.n, h.ok], ['render', true, 'render', 12, 1], 'the probe is recorded as /sources/report records it');
  ok(!(await board(w, 'aep_au')).media.some(m => /east coast gas supply, statement/.test(m.title)), 'none of the old releases is on the Board as the day\'s news');
  items = [{ title: 'Producers welcome the Senate result on gas supply', link: 'https://energyproducers.au/news/producers-welcome-the-senate-result-on-gas-supply/' }].concat(items);
  const r2 = await send(); eq([r2.status, r2.body.added], [200, 1], 'rendered again, only the new link is filed');
  const fresh = mine().find(r => /Senate result/.test(r.title)); ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'a link new since the last read is stamped as found: ' + JSON.stringify(fresh && fresh.meta));
  ok((await board(w, 'aep_au')).media.some(m => /Senate result/.test(m.title)), 'and is on the Board');
});

// ---- the skeptic's problems with the second round (collect lane, third round, 17 November 2026): H1-H4 ----
await S.t('SR23 a probe a person asks for files what is new as found, however long since the last read; its first read is still a baseline', async () => {
  const w = await mk(); const t0 = Date.now(); const mine = () => arc(w, "kind='news' AND src='srtest_probe'");
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_probe', name: 'Example Producers Newsroom', tier: 'sector', urls: { home: 'https://producers.example.com.au/news/' } })).status, 200);
  let items = Array.from({ length: 10 }, (_, i) => ({ title: 'Producers set out their view on east coast gas supply, statement ' + (i + 1), link: 'https://producers.example.com.au/news/statement-on-east-coast-gas-supply-' + (i + 1) + '/' }));
  const send = () => F(w, 'POST', '/sources/listing', { id: 'srtest_probe', ok: true, method: 'render', ms: 900, items });
  const r1 = await send(); eq([r1.status, r1.body.added, r1.body.baseline], [200, 10, true], JSON.stringify(r1.body).slice(0, 300));
  ok(mine().every(r => r.meta.baseline === 1 && r.ts <= t0 - 28 * D), 'the first probe is a baseline, as CO3 and B6 have it');
  // the next probe comes four days later (a source that needs a browser is read only when a person asks), with one new release
  w.db.prepare("UPDATE sources SET last_ok=? WHERE id='srtest_probe'").run(Date.now() - 4 * D);
  items = [{ title: 'Producers welcome the Senate vote on east coast gas supply', link: 'https://producers.example.com.au/news/producers-welcome-the-senate-vote/' }].concat(items);
  const r2 = await send(); eq([r2.status, r2.body.added, r2.body.baseline], [200, 1, false], JSON.stringify(r2.body).slice(0, 300));
  const fresh = mine().find(r => /Senate vote/.test(r.title)); ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'the new release is filed as found: ' + JSON.stringify(fresh && [fresh.ts - Date.now(), fresh.meta]));
  ok((await board(w, 'aep_au')).media.some(m => /Senate vote/.test(m.title)), 'and is on the Board');
  // forty days later, the same
  w.db.prepare("UPDATE sources SET last_ok=? WHERE id='srtest_probe'").run(Date.now() - 40 * D);
  items = [{ title: 'Producers respond to the review of east coast gas supply', link: 'https://producers.example.com.au/news/producers-respond-to-the-gas-supply-review/' }].concat(items);
  const r3 = await send(); eq([r3.body.added, r3.body.baseline], [1, false]); ok((await board(w, 'aep_au')).media.some(m => /respond to the review/.test(m.title)), 'forty days on too');
  // a page another route delivered last (a newsroom's feed) is still read as a first read: CO3 keeps its older links out of the day's news
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_feedfirst', name: 'Example Council Newsroom', tier: 'sector', urls: { rss: 'https://councilnews.example.com.au/feed/', home: 'https://councilnews.example.com.au/news/' } })).status, 200);
  const rel = n => 'https://councilnews.example.com.au/news/statement-on-the-diesel-rebate-' + n + '/';
  w.answer(/^https:\/\/councilnews\.example\.com\.au\/feed\/$/, () => T(rss([{ t: 'Statement on the diesel rebate, number 1', l: rel(1), ago: 2 * H }])));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['srtest_feedfirst'] })).body.results[0].method, 'rss');
  const r4 = await F(w, 'POST', '/sources/listing', { id: 'srtest_feedfirst', ok: true, method: 'render', ms: 900, items: Array.from({ length: 6 }, (_, i) => ({ title: 'Statement on the diesel rebate, number ' + (i + 1), link: rel(i + 1) })) });
  eq([r4.body.added, r4.body.baseline], [5, true], JSON.stringify(r4.body).slice(0, 300));
  ok(arc(w, "kind='news' AND src='srtest_feedfirst'").filter(r => r.meta.method === 'render').every(r => r.meta.baseline === 1), 'the five the feed never carried are a baseline');
  // what changes is a person's read only: a sweep a schedule runs keeps the window (a page last read four days ago is read afresh)
  const one = [{ title: 'A listing link with no date on east coast gas supply', link: 'https://producers.example.com.au/news/a-listing-link-with-no-date/', date: '' }];
  const R = (o, asked) => w.t.sourceRows(Object.assign({ id: 'srtest', tier: 'sector', juris: 'au', last_ok: 0, method_ok: '' }, o), { items: one, method: 'render', undated: true, asked }, NOW)[0];
  eq([R({ last_ok: NOW - 4 * D, method_ok: 'render' }).meta.baseline, R({ last_ok: NOW - 4 * D, method_ok: 'html' }, true).ts, R({ last_ok: NOW - 4 * D, method_ok: 'html' }, true).meta.baseline], [1, NOW, undefined], 'a schedule keeps the window; a person\'s probe does not');
  eq([R({}, true).meta.baseline, R({ last_ok: NOW - H, method_ok: 'rss' }, true).meta.baseline], [1, 1], 'a page that never delivered, or that another route delivered last, is a baseline when a person asks too');
});

await S.t('SR24 the worker\'s own render job, which the same button reaches, files by the same rule and says when a read was a baseline', async () => {
  const w = await mk({ RENDER_URL: 'https://render.example.com.au/render' }); const t0 = Date.now(); const mine = () => arc(w, "kind='news' AND src='srtest_rendered'");
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_rendered', name: 'Example Rendered Newsroom', tier: 'sector', urls: { home: 'https://rendered.example.com.au/news/' } })).status, 200);
  let links = Array.from({ length: 8 }, (_, i) => ['/news/producers-statement-on-gas-reservation-number-' + (i + 1) + '/', 'Producers set out their view on gas reservation, statement ' + (i + 1)]);
  w.answer(/^https:\/\/render\.example\.com\.au\/render$/, () => J({ html: page(links) }));
  const press = async () => { const r = await F(w, 'POST', '/bridge/run', { source: 'render', params: { source: 'srtest_rendered' } }); eq([r.status, r.body.where], [200, 'worker'], JSON.stringify(r.body)); await w.settle(); return (await F(w, 'GET', '/bridge/job?id=' + r.body.id, null, 'read-key')).body; };
  const filed = j => ((j.lines || []).find(l => /^filed /.test(l.text)) || {}).text || '';
  const j1 = await press(); eq([j1.success, j1.result.added, j1.result.baseline], [true, 8, true], JSON.stringify(j1).slice(0, 400));
  ok(/^filed 8 new rows for srtest_rendered \(the first read of this page: filed as a baseline, before every window/.test(filed(j1)), 'the log says the first read is a baseline: ' + filed(j1));
  ok(mine().length === 8 && mine().every(r => r.meta.baseline === 1 && r.ts <= t0 - 28 * D), 'and files it before every window');
  w.db.prepare("UPDATE sources SET last_ok=? WHERE id='srtest_rendered'").run(Date.now() - 4 * D);
  links = [['/news/producers-welcome-the-gas-reservation-vote/', 'Producers welcome the gas reservation vote in the Senate']].concat(links);
  const j2 = await press(); eq([j2.result.added, j2.result.baseline, filed(j2)], [1, false, 'filed 1 new rows for srtest_rendered'], JSON.stringify(j2.result));
  const fresh = mine().find(r => /reservation vote/.test(r.title)); ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'pressed four days later, the new release is filed as found: ' + JSON.stringify(fresh && fresh.meta));
  ok((await board(w, 'aep_au')).media.some(m => /reservation vote/.test(m.title)), 'and is on the Board');
});

await S.t('SR25 gas joined to the mining word in other wording is not mining beside the Resources Minister; a contrast or a separate clause still is', async () => {
  const w = await mk();
  ['The Resources Minister said minerals and natural gas exports rose', 'The Resources Minister said copper and liquefied natural gas exports rose', 'Gas and critical minerals exports rose, the Resources Minister said',
    'Gas/minerals exports rose, the Resources Minister said', 'The Resources Minister said minerals as well as gas exports rose', 'The Resources Minister said coal, minerals, and gas exports rose',
    'The Resources Minister said minerals, and gas, exports rose', 'Gas, oil and minerals exports rose, the Resources Minister said', 'LNG, coal and gold exports rose, the Resources Minister said',
    'Figures show gas and critical minerals exports rose, the Resources Minister said', 'Gas as well as minerals exports rose, the Resources Minister said',
    'The Resources Minister said neither minerals nor gas exports fell', 'The Resources Minister said gold, copper, nickel and LNG exports rose']
    .forEach(s => { ok(!tagged(w, s, 'mining'), JSON.stringify(s) + ' should NOT be mining (got ' + w.t.issueTag(s).join(',') + ')'); ok(tagged(w, s, 'gas'), JSON.stringify(s) + ' is the gas desk\'s'); });
  ['The Resources Minister said gold, not gas, drove exports', 'Gas prices fell and gold rose, the Resources Minister said', 'Gas and oil fell but gold rose, the Resources Minister said',
    'Resources Minister approves copper mine expansion and gas permits', 'The Resources Minister approved a copper mine and a gas hub', '"Copper exports rose," the Resources Minister said',
    'Prices of gas and oil eased. Gold exports rose, the Resources Minister said']
    .forEach(s => ok(tagged(w, s, 'mining'), JSON.stringify(s) + ' should be mining (got ' + w.t.issueTag(s).join(',') + ')'));
  const row = (t, d) => w.t.arcCoreRow({ src: 'abc', title: t, desc: d, link: 'https://harbournews.example.com.au/news/minister-' + (++seq), date: new Date(NOW - H).toUTCString() }).meta.issues;
  ok(row('Gas and critical minerals exports rose', 'The Resources Minister said the figures were a record.').indexOf('mining') < 0, 'a feed\'s row with the pair joined in its title is not mining');
  ok(row('Gas and copper prices fall', 'Gold exports rose, the Resources Minister said.').indexOf('mining') >= 0, 'a gas headline over a minister\'s gold figure in the description is still mining (B3)');
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

await S.t('SR26 the council counts after a paragraph join, an ellipsis that runs on, and a comma before a state\'s possessive; the NSW body still does not', async () => {
  const w = await mk(); const mention = w.t.CLIENT_ISSUES.find(c => c.id === 'mcamentions'); const RQ = String.fromCharCode(8217), EL = String.fromCharCode(8230);
  ['Costs rose.The Minerals Council said the rebate refunds a road tax', 'Costs rose...the Minerals Council said the rebate is not a subsidy', 'The Minerals Council, Queensland\'s biggest employer group, backed it',
    'Groups including the Minerals Council, NSW\'s farmers and the unions backed it', 'Costs rose.Minerals Council data show a record year', 'Costs rose.Australia\'s Minerals Council says the tax would cost jobs',
    'Costs rose' + EL + 'the Minerals Council said', 'The Minerals Council, NSW-based unions and farmers backed it', 'The Minerals Council, Queensland' + RQ + 's biggest employer group, backed it']
    .forEach(s => ok(tagged(w, s, 'mcamentions') && mention.rx.test(s), JSON.stringify(s) + ' should be an MCA mention (got ' + w.t.issueTag(s).join(',') + ')'));
  ['The N.S.W Minerals Council backed the plan', 'The N.S.W.Minerals Council backed the plan', 'Costs rose.The NSW Minerals Council said', 'Costs rose.NSW\'s Minerals Council said', 'Costs rose...NSW Minerals Council said',
    'Jo Example, Minerals Council, NSW, said the plan was sound', 'Jo Example (Minerals Council, NSW) said', 'Jo Example, Minerals Council, NSW - statement', 'Jo Example, Minerals Council, Queensland, said']
    .forEach(s => ok(!tagged(w, s, 'mcamentions') && !mention.rx.test(s), JSON.stringify(s) + ' should NOT be an MCA mention'));
  // a WordPress article: stripHtml joins "rose.</p><p>The Minerals Council" as "rose.The Minerals Council", and the row is tagged so
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_wp', name: 'Example WordPress Gazette', tier: 'regional', urls: { wp: 'https://wpgazette.example.com.au' } })).status, 200);
  w.answer(/^https:\/\/wpgazette\.example\.com\.au\/wp-json\/wp\/v2\/posts/, () => J([{ id: 7101, link: 'https://wpgazette.example.com.au/2026/11/diesel-costs-and-the-rebate/', title: { rendered: 'Diesel costs and the rebate' },
    date_gmt: new Date(NOW - H).toISOString().slice(0, 19), excerpt: { rendered: '<p>Diesel costs rose again this quarter.</p>' }, content: { rendered: '<p>Diesel costs rose again this quarter.</p><p>The Minerals Council said the rebate refunds a road tax, not a subsidy.</p>' } }]));
  eq((await F(w, 'POST', '/sources/sweep', { ids: ['srtest_wp'] })).body.succeeded, 1);
  const row = arc(w, "kind='news' AND src='srtest_wp'")[0]; ok(row && row.meta.issues.indexOf('mcamentions') >= 0, 'the article is an MCA mention, read as the worker reads it: ' + JSON.stringify(row && row.meta.issues));
  // a long run of dots is read in linear time (the ellipsis alternative tried every length from every dot)
  const t1 = Date.now(); for (let i = 0; i < 5; i++) w.t.issueTag('.'.repeat(6000)); const ms = Date.now() - t1; ok(ms < 60, 'five texts of 6,000 dots took ' + ms + 'ms');
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

await S.t('SR27 a deal whose store name is short or starts with a digit is not critical minerals; a price written with "@" still is', async () => {
  const w = await mk();
  ['Energizer Lithium AA 8-pack @ IGA $12', 'Lithium coin cells 4-pack @ BCF $15', 'Lithium batteries @ JB $99', 'Lithium coin batteries $2 @ 7-Eleven', 'Lithium e-bike battery $499 @ 99 Bikes',
    'Lithium e-bike batteries @ 99 Bikes', 'Lithium batteries @ 7-Eleven for $2', 'Lithium jump starter $89 @ 4WD Supacentre', 'Lithium batteries 4-pack @ BIG W $12', 'Lithium batteries @ 50% off',
    'Lithium batteries @ 3 for $10', 'Lithium @ record lows as demand slumps', 'Nickel @ a four-year low as smelters close', 'Lithium juniors gather @ Diggers and Dealers', 'Lithium explorer shares @ ASX open',
    'Lithium carbonate @ approx US$10,500/t']
    .forEach(s => ok(!tagged(w, s, 'cm'), JSON.stringify(s) + ' should NOT be critical minerals'));
  ['Lithium @ 850 as demand slows', 'MIN @ 45 as lithium rallies', 'Nickel @ 7.50 a pound', 'PLS @ 85c as lithium slumps', 'Lithium price @ AU$1,100 a tonne', 'Lithium hydroxide @ NZ$5 a kg',
    'Lithium @ 850-900 a tonne', 'Nickel @ 16,500 USD/t', 'Lithium @ 1,200/t.', 'Lithium @ USD10,500', 'Lithium forum @ 3pm today']
    .forEach(s => ok(tagged(w, s, 'cm'), JSON.stringify(s) + ' should be critical minerals (got ' + w.t.issueTag(s).join(',') + ')'));
  const row = (t, d) => w.t.arcCoreRow({ src: 'abc', title: t, desc: d, link: 'https://harbournews.example.com.au/markets/at-' + (++seq), date: new Date(NOW - H).toUTCString() }).meta.issues;
  ok(row('Lithium coin batteries $2 @ 7-Eleven', 'A pack of two.').indexOf('cm') < 0, 'a deal is not tagged critical minerals at collection');
  ok(row('Lithium @ 850', 'Prices fell for a third week as demand in China slowed.').indexOf('cm') >= 0, 'a forum price over its description still is');
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

await S.t('SR29 a person\'s Sweep of one source files what is new as found, as Probe does; a sweep a schedule runs keeps the window', async () => {
  const w = await mk(); const mine = () => arc(w, "kind='news' AND src='srtest_swept'");
  eq((await F(w, 'POST', '/sources/add', { id: 'srtest_swept', name: 'Example Growers Newsroom', tier: 'sector', urls: { home: 'https://growersnews.example.com.au/news/' } })).status, 200);
  let links = Array.from({ length: 6 }, (_, i) => ['/news/growers-statement-on-the-water-levy-' + (i + 1) + '/', 'Growers set out their view on the water levy, statement ' + (i + 1)]);
  w.answer(/^https:\/\/growersnews\.example\.com\.au\/news\/$/, () => T(page(links)));
  const sweep = async () => { const r = await F(w, 'POST', '/sources/sweep', { ids: ['srtest_swept'] }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 300)); return r.body.results[0]; };
  const r1 = await sweep(); ok(r1.ok && r1.added === 6, 'the first sweep files six: ' + JSON.stringify(r1).slice(0, 300));
  ok(mine().every(r => r.meta.baseline === 1), 'as a baseline, its first read (CO3)');
  w.db.prepare("UPDATE sources SET last_ok=?, next_due=0 WHERE id='srtest_swept'").run(Date.now() - 4 * D);
  links = [['/news/growers-welcome-the-water-levy-review/', 'Growers welcome the review of the water levy']].concat(links);
  const r2 = await sweep(); eq(r2.added, 1, JSON.stringify(r2).slice(0, 300));
  const fresh = mine().find(r => /levy review|review of the water levy/.test(r.title)); ok(fresh && !fresh.meta.baseline && Math.abs(fresh.ts - Date.now()) < 120000, 'pressed four days later, the new release is filed as found: ' + JSON.stringify(fresh && fresh.meta));
  // the same page swept by the schedule four days on keeps the window: its new link is a baseline
  w.db.prepare("UPDATE sources SET last_ok=?, next_due=0 WHERE id='srtest_swept'").run(Date.now() - 4 * D);
  links = [['/news/growers-react-to-the-levy-decision/', 'Growers react to the decision on the water levy']].concat(links);
  const due = await w.t.sourceSweep(w.env, { ids: ['srtest_swept'] }); ok(due.ok, JSON.stringify(due).slice(0, 200));
  const late = mine().find(r => /react to the decision/.test(r.title)); ok(late && late.meta.baseline === 1, 'a sweep nobody asked for still reads a page four days unread afresh: ' + JSON.stringify(late && late.meta));
});

await S.t('SR28 a long list joined with ", and" or ", or" beside the Resources Minister is tagged in linear time (the H2 join read each such comma two ways)', async () => {
  const w = await mk();
  // the round-4 reviewer's text: 22 units took 577 ms and each unit doubled it; a 300-character post would run for minutes
  for (const j of [', and ', ', or ']) for (const n of [22, 30, 60]) {
    const t = 'The Resources Minister said gold' + (j + 'silver').repeat(n) + ' rose.'; const t0 = performance.now(); const got = w.t.issueTag(t); const ms = performance.now() - t0;
    ok(ms < 50, n + ' units joined by "' + j.trim() + '" tag in ' + ms.toFixed(1) + ' ms'); ok(got.indexOf('mining') >= 0, 'and the list is still mining: ' + got.join(','));
  }
  // the joined forms H2 fixed still read as joined
  ['The Resources Minister said coal, minerals, and gas exports rose', 'The Resources Minister said minerals, and gas, exports rose', 'The Resources Minister said minerals and natural gas exports rose']
    .forEach(s => ok(!tagged(w, s, 'mining'), JSON.stringify(s) + ' should NOT be mining (got ' + w.t.issueTag(s).join(',') + ')'));
  const s = sync(); eq(s.status, 0, (s.stderr || s.stdout));
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
