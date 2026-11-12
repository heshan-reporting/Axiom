/* A wider net (build p62): term-driven news search, community threads and the comments under them, against the worker
 * module in this process. No site is contacted: every answer below is an invented stand-in served by the recording
 * fetch, so the shapes are the ones the public documentation of each service describes, not ones seen live. A first
 * sweep on the deployed worker is what proves each (DEN.md s.9). Each case fails on the p61 commit.
 *   WN1 the lexicon sweep through Google News: the next terms in turn, only rows on a client issue, the term and the outlet kept
 *   WN2 the lexicon sweep through GDELT: under the public rules, Australian sources only, a headline and a link, an answer
 *       that is not JSON is a failure by name
 *   WN3 a Lemmy instance: local posts on an issue or from a politics community, nobody named, removed posts left out
 *   WN4 Hacker News: stories that say Australia and carry an issue; the rest are not kept
 *   WN5 a forum's feed: threads as community rows (a general forum: only those on a client issue; a board declared for
 *       an issue: all of them), the poster's name not stored
 *   WN6 the comments underneath: Lemmy, Hacker News and a WordPress site's own comments, each thread once, nobody named
 *   WN7 the seed: the new sources with their methods, no id twice, more subreddits published to the Mac
 *   WN8 a refusal backs the host off; robots.txt is obeyed for every new route
 *   WN9 the coverage table and the Signals routes know the new channels
 *   WN10 the community job reads the community sources first, then the comments, and can be started from Signals
 *   WN11 a source that keeps failing waits longer each time (a day at most), a success restores its schedule, and the
 *        number of sources a tick reads is a var
 *   WN12 the comment pass reads a bounded number of WordPress sites a run, in turn
 * Run: node --experimental-sqlite tests/widenet-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('A wider net: lexicon sweeps, community threads and comments');
const mk = async env => { const sleeps = []; const w = await workerEnv({ env: Object.assign({ __pubSleep: async ms => { sleeps.push(ms); } }, env || {}), keys: { 'full-key': { n: 'Heshan', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } }); w.sleeps = sleeps; return w; };
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const NOW = Date.now(), H = 3600000;
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
const T = (body, status, type) => new Response(body, { status: status || 200, headers: { 'Content-Type': type || 'text/html' } });
const noRobots = w => w.answer(/\/robots\.txt$/, () => T('', 404));
const arc = (w, kind, where) => w.env.MIND_DB.db.prepare('SELECT * FROM arc_items WHERE kind=?' + (where ? ' AND ' + where : '') + ' ORDER BY id').all(kind).map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const hits = (w, re) => w.outbound.filter(o => re.test(o.url));
const sweep = async (w, id) => { const r = await F(w, 'POST', '/sources/sweep', { ids: [id] }); if (r.status !== 200) throw new Error('sweep ' + id + ': ' + r.text.slice(0, 200)); return r.body.results[0]; };
const add = async (w, b) => { const r = await F(w, 'POST', '/sources/add', b); if (r.status !== 200) throw new Error('add ' + b.id + ': ' + r.text.slice(0, 200)); return r.body; };
const rfc = ms => new Date(NOW - ms).toUTCString();
const gnews = items => '<?xml version="1.0"?><rss><channel><title>g</title>' + items.map(i => '<item><title>' + i.t + ' - ' + i.o + '</title><link>https://news.google.com/rss/articles/' + i.id + '</link><pubDate>' + rfc(i.ago || H) + '</pubDate></item>').join('') + '</channel></rss>';

await S.t('WN1 the lexicon sweep through Google News', async () => {
  const w = await mk(); const asked = []; const auq = w.mod.__test.AU_QUERY_RX;
  w.answer(/news\.google\.com\/rss\/search/, u => { const q = decodeURIComponent((String(u).match(/[?&]q=([^&]+)/) || [])[1] || '').replace(/\+/g, ' '); asked.push(q);
    return T(gnews([{ id: 'a' + asked.length, t: 'Senate to debate the fuel tax credit scheme again', o: 'Regional Daily' }, { id: 'b' + asked.length, t: 'Local bakery wins a ribbon at the show', o: 'Town Crier' }]), 200, 'application/rss+xml'); });
  await add(w, { id: 'lex_test', name: 'Lexicon sweep (test)', tier: 'sweep', urls: { lexicon: 'gnews' } });
  const a = await sweep(w, 'lex_test'); eq([a.ok, a.method], [true, 'lexicon'], JSON.stringify(a).slice(0, 300));
  const per = w.mod.__test.LEX_PER_RUN.gnews; ok(per >= 8, 'a useful number of terms a run: ' + per); eq(asked.length, per, 'one question a term');
  ok(asked.every(q => / when:2d$/.test(q)), 'each asks for the last two days'); ok(asked.some(q => / australia when:2d$/.test(q)) && asked.every(q => auq.test(q)), 'a term that does not name Australia is asked with it: ' + asked.slice(0, 4).join(' | '));
  const rows = arc(w, 'news', "src='lex_test'"); ok(rows.length >= 1 && rows.every(r => /fuel tax credit/.test(r.title)), 'only rows on a client issue are kept: ' + rows.map(r => r.title).join(' | '));
  const r0 = rows[0]; ok(r0.meta.issues.indexOf('ftc') >= 0 && r0.meta.outlet === 'Regional Daily' && r0.meta.q && r0.meta.method === 'lexicon' && r0.meta.reg === 1, 'the issue, the outlet and the term that found it: ' + JSON.stringify(r0.meta)); eq(r0.title, 'Senate to debate the fuel tax credit scheme again', 'the outlet is not left on the headline');
  const first = asked.slice(); asked.length = 0; await sweep(w, 'lex_test'); ok(asked.length === per && asked[0] !== first[0] && first.indexOf(asked[0]) < 0, 'the next run takes the next terms: ' + asked[0] + ' after ' + first[0]);
  const all = w.mod.__test.issueQueries().length; ok(all > per, 'the lexicon is longer than one run (' + all + ')');
  // a term a person approved on a desk, under one of that client's issues, joins the rotation
  const p = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', platform: 'any', value: 'harbour gas levy', issue: 'gastax' })).body; ok(p.ok, JSON.stringify(p).slice(0, 200));
  let seen = false; for (let i = 0; i < Math.ceil((all + 2) / per) + 1 && !seen; i++) { asked.length = 0; await sweep(w, 'lex_test'); seen = asked.some(q => /harbour gas levy/.test(q)); } ok(seen, 'an approved desk term is searched for in its turn');
  w.answer(/news\.google\.com\/rss\/search/, () => T('busy', 503)); const bad = await sweep(w, 'lex_test'); eq(bad.ok, false, 'every term failing is a failure, not a quiet run'); ok(/HTTP 503|503/.test(JSON.stringify(bad.tried)), JSON.stringify(bad.tried).slice(0, 200));
});

await S.t('WN2 the lexicon sweep through GDELT', async () => {
  const w = await mk(); const asked = []; let ua = '';
  w.answer(/api\.gdeltproject\.org\/robots\.txt$/, () => T('', 404));
  w.answer(/api\.gdeltproject\.org\/api\/v2\/doc\/doc/, (u, init) => { asked.push(decodeURIComponent(String(u)).replace(/\+/g, ' ')); ua = (init && init.headers && init.headers['User-Agent']) || '';
    return J({ articles: [{ url: 'https://coastwire.example.com.au/story/gas-export-tax-vote-' + asked.length, title: 'Crossbench forces a vote on a gas export tax', seendate: new Date(NOW - 2 * H).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), domain: 'coastwire.example.com.au', language: 'English', sourcecountry: 'Australia' },
      { url: 'https://coastwire.example.com.au/story/footy-' + asked.length, title: 'Finals fever grips the coast', seendate: '20260101T000000Z', domain: 'coastwire.example.com.au', language: 'English', sourcecountry: 'Australia' }] }); });
  await add(w, { id: 'gd_test', name: 'GDELT sweep (test)', tier: 'sweep', urls: { lexicon: 'gdelt' } });
  const a = await sweep(w, 'gd_test'); eq([a.ok, a.method], [true, 'lexicon'], JSON.stringify(a).slice(0, 300));
  const per = w.mod.__test.LEX_PER_RUN.gdelt; eq(asked.length, per); ok(per >= 2 && per <= 4, 'few terms a run: the service asks for patience');
  ok(asked.every(q => /sourcecountry:australia/.test(q) && /mode=artlist/.test(q) && /format=json/.test(q) && /timespan=2d/.test(q)), 'Australian sources, as a list, two days: ' + asked[0].slice(0, 200));
  ok(/AxiomPublicRecord|robots/i.test(ua) && !/Mozilla|Chrome/.test(ua), 'through the public reader, with its honest user agent: ' + ua); ok(w.sleeps.length >= per - 1 && w.sleeps[0] >= 9000 && w.sleeps[0] <= 10000 && w.sleeps.every((ms, i) => !i || Math.abs(ms - w.sleeps[i - 1] - 10000) < 500), 'ten seconds between questions to one host: ' + w.sleeps.join(','));
  const rows = arc(w, 'news', "src='gd_test'"); ok(rows.length >= 1 && rows.every(r => /gas export tax/.test(r.title)), rows.map(r => r.title).join(' | '));
  ok(rows[0].meta.issues.indexOf('gastax') >= 0 && rows[0].meta.outlet === 'coastwire.example.com.au' && rows[0].meta.q && !rows[0].meta.full, 'a headline and a link, the outlet its domain: ' + JSON.stringify(rows[0].meta)); ok(!/Finals fever/.test(JSON.stringify(arc(w, 'news'))), 'nothing off the issues');
  w.answer(/api\.gdeltproject\.org\/api\/v2\/doc\/doc/, () => T('Your query was too short or too long.', 200, 'text/plain')); const bad = await sweep(w, 'gd_test');
  eq(bad.ok, false); ok(/not JSON|did not answer with a list/i.test(JSON.stringify(bad.tried)), 'an answer in words is a failure by name: ' + JSON.stringify(bad.tried).slice(0, 240));
});

const lemmyPosts = [
  { post: { id: 501, name: 'Gas export tax: the Senate vote is this week', body: 'The crossbench says a windfall tax on gas is overdue.', published: new Date(NOW - 3 * H).toISOString(), ap_id: 'https://reef.example/post/501' }, creator: { name: 'jo_citizen', display_name: 'Jo Citizen' }, community: { name: 'australia', title: 'Australia' }, counts: { score: 41, comments: 3 } },
  { post: { id: 502, name: 'What is everyone cooking this weekend', body: 'Lamb, probably.', published: new Date(NOW - 2 * H).toISOString() }, creator: { name: 'cook' }, community: { name: 'food', title: 'Food' }, counts: { score: 9, comments: 4 } },
  { post: { id: 503, name: 'Question time was a shambles again', body: 'Nothing about any client here.', published: new Date(NOW - 2 * H).toISOString() }, creator: { name: 'pollie_watcher' }, community: { name: 'australianpolitics', title: 'Australian Politics' }, counts: { score: 12, comments: 0 } },
  { post: { id: 504, name: 'Fuel tax credits are a rort', body: 'removed', published: new Date(NOW - H).toISOString(), removed: true }, creator: { name: 'x' }, community: { name: 'australia' }, counts: { score: 1, comments: 0 } },
  { post: { id: 505, name: 'An old thread about a fuel tax credit', body: '', published: new Date(NOW - 30 * 24 * H).toISOString() }, creator: { name: 'y' }, community: { name: 'australia' }, counts: { score: 1, comments: 0 } },
];
await S.t('WN3 a Lemmy instance', async () => {
  const w = await mk(); noRobots(w); let asked = '';
  w.answer(/reef\.example\/api\/v3\/post\/list/, u => { asked = String(u); return J({ posts: lemmyPosts }); });
  await add(w, { id: 'lemmy_test', name: 'Lemmy: reef.example', tier: 'community', urls: { lemmy: 'reef.example' } });
  const a = await sweep(w, 'lemmy_test'); eq([a.ok, a.method, a.items], [true, 'lemmy', 2], JSON.stringify(a).slice(0, 300));
  ok(/type_=Local/.test(asked) && /sort=New/.test(asked), 'the instance\'s own posts, newest first: ' + asked);
  const rows = arc(w, 'sig_thread'); eq(rows.map(r => r.title).sort(), ['Gas export tax: the Senate vote is this week', 'Question time was a shambles again'], 'a post on an issue, and a politics community\'s post; not the recipe, the removed post or the old one');
  const g = rows.find(r => /Gas export/.test(r.title)); eq([g.meta.platform, g.url, g.meta.page, g.meta.score, g.meta.comments, g.meta.source], ['lemmy', 'https://reef.example/post/501', 'australia', 41, 3, 'lemmy_test']); ok(g.meta.issues.indexOf('gastax') >= 0);
  ok(!/jo_citizen|Jo Citizen|pollie_watcher/.test(JSON.stringify(rows)) && rows.every(r => r.author === ''), 'nobody is named');
  await add(w, { id: 'lemmy_c', name: 'Lemmy: one community', tier: 'community', urls: { lemmy: 'reef.example/c/australia' } }); await sweep(w, 'lemmy_c'); ok(/community_name=australia/.test(asked) && !/type_=Local/.test(asked), 'one community when one is named: ' + asked);
  w.answer(/reef\.example\/api\/v3\/post\/list/, () => J({ error: 'rate_limit_error' })); const bad = await sweep(w, 'lemmy_test'); eq(bad.ok, false); ok(/no list of posts/i.test(JSON.stringify(bad.tried)), JSON.stringify(bad.tried).slice(0, 200));
  const refused = await F(w, 'POST', '/sources/add', { id: 'lemmy_bad', name: 'x', tier: 'community', urls: { lemmy: 'http://10.0.0.1/c/x' } }); ok(refused.status === 400 || !(refused.body.source && refused.body.source.urls && refused.body.source.urls.lemmy), 'only a host name is taken as an instance: ' + refused.text.slice(0, 160));
});

await S.t('WN4 Hacker News', async () => {
  const w = await mk(); noRobots(w); const asked = [];
  w.answer(/hn\.algolia\.com\/api\/v1\/search_by_date/, u => { asked.push(String(u)); return J({ hits: [
    { objectID: '9001', title: 'Australia\'s under-16 social media ban and the gas reservation fight', url: 'https://example.com/a', points: 120, num_comments: 80, created_at_i: Math.floor((NOW - 5 * H) / 1000), author: 'pg_fan' },
    { objectID: '9002', title: 'Australian startup ships a database', url: 'https://example.com/b', points: 300, num_comments: 200, created_at_i: Math.floor((NOW - 5 * H) / 1000), author: 'dbguy' },
    { objectID: '9003', title: 'Texas gas export tax debated', story_text: 'Nothing here says where else.', points: 50, num_comments: 10, created_at_i: Math.floor((NOW - 5 * H) / 1000), author: 'tx' }] }); });
  await add(w, { id: 'hn_test', name: 'Hacker News (test)', tier: 'community', urls: { hn: 'australia,australian' } });
  const a = await sweep(w, 'hn_test'); eq([a.ok, a.method, a.items], [true, 'hn', 1], JSON.stringify(a).slice(0, 300)); eq(asked.length, 2, 'one question a word'); ok(asked.every(u => /tags=story/.test(u) && /numericFilters=created_at_i%3E\d+|numericFilters=created_at_i>\d+/.test(u)), asked[0]);
  const rows = arc(w, 'sig_thread'); eq(rows.length, 1); const r = rows[0]; eq([r.meta.platform, r.url, r.meta.score, r.meta.comments], ['hn', 'https://news.ycombinator.com/item?id=9001', 120, 80]); ok(r.meta.issues.indexOf('gas') >= 0 && r.meta.link === 'https://example.com/a', JSON.stringify(r.meta));
  ok(!/pg_fan|dbguy/.test(JSON.stringify(rows)), 'nobody is named');
});

await S.t('WN5 a forum\'s feed', async () => {
  const w = await mk(); noRobots(w);
  w.answer(/forum\.example\.net\/index\.rss/, () => T('<?xml version="1.0"?><rss xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Forum</title>' +
    '<item><title>Negative gearing and the housing affordability mess</title><link>https://forum.example.net/threads/negative-gearing.123/</link><pubDate>' + rfc(2 * H) + '</pubDate><dc:creator>BigKev77</dc:creator><description>Rents are up again.</description></item>' +
    '<item><title>Best meat pie this winter</title><link>https://forum.example.net/threads/pie.124/</link><pubDate>' + rfc(3 * H) + '</pubDate><dc:creator>PieGuy</dc:creator></item></channel></rss>', 200, 'application/rss+xml'));
  await add(w, { id: 'forum_test', name: 'Example Forum', tier: 'community', urls: { forum: 'https://forum.example.net/index.rss' } });
  const a = await sweep(w, 'forum_test'); eq([a.ok, a.method, a.items], [true, 'forum', 1], 'a general forum: only the thread on a client issue. ' + JSON.stringify(a).slice(0, 300));
  const rows = arc(w, 'sig_thread'); eq(rows.map(r => r.title), ['Negative gearing and the housing affordability mess']); const h = rows.find(r => /Negative gearing/.test(r.title)); eq([h.meta.platform, h.url, h.meta.page_name, h.meta.source], ['forum', 'https://forum.example.net/threads/negative-gearing.123/', 'Example Forum', 'forum_test']); ok(h.meta.issues.indexOf('housing') >= 0, JSON.stringify(h.meta.issues));
  ok(!/BigKev77|PieGuy/.test(JSON.stringify(rows)), 'the poster is not stored'); eq(arc(w, 'news').length, 0, 'a forum thread is not filed as news');
  // a board the registry says is about an issue is on topic as a whole
  await add(w, { id: 'forum_board', name: 'A politics board', tier: 'community', issues: ['gov'], urls: { forum: 'https://forum.example.net/index.rss?board=politics' } }); w.answer(/forum\.example\.net\/index\.rss\?board=politics/, () => T('<?xml version="1.0"?><rss><channel><title>B</title><item><title>Who wins the next preference deal</title><link>https://forum.example.net/threads/deal.200/</link><pubDate>' + rfc(H) + '</pubDate></item><item><title>Senate numbers after the by-election</title><link>https://forum.example.net/threads/senate.201/</link><pubDate>' + rfc(H) + '</pubDate></item></channel></rss>', 200, 'application/rss+xml'));
  const b = await sweep(w, 'forum_board'); eq([b.ok, b.items], [true, 2], 'a board declared for an issue keeps its threads: ' + JSON.stringify(b).slice(0, 200));
});

await S.t('WN6 the comments underneath', async () => {
  const w = await mk(); noRobots(w); const T_ = w.mod.__test;
  w.answer(/reef\.example\/api\/v3\/post\/list/, () => J({ posts: lemmyPosts }));
  w.answer(/reef\.example\/api\/v3\/comment\/list/, u => (/post_id=501/.test(String(u)) ? J({ comments: [
    { comment: { id: 71, content: 'The gas companies pay **nothing** and everyone knows it. Disgraceful.', published: new Date(NOW - 2 * H).toISOString(), path: '0.71' }, creator: { name: 'angry_anne' }, counts: { score: 14 } },
    { comment: { id: 72, content: 'A windfall tax would fund a lot.', published: new Date(NOW - H).toISOString(), path: '0.71.72' }, creator: { name: 'calm_carl' }, counts: { score: 3 } },
    { comment: { id: 73, content: 'gone', published: new Date(NOW - H).toISOString(), path: '0.73', deleted: true }, creator: { name: 'z' }, counts: { score: 0 } }] }) : J({ comments: [] })));
  w.answer(/hn\.algolia\.com\/api\/v1\/search_by_date/, () => J({ hits: [{ objectID: '9001', title: 'Australia and the gas reservation fight', url: 'https://example.com/a', points: 120, num_comments: 2, created_at_i: Math.floor((NOW - 5 * H) / 1000), author: 'pg_fan' }] }));
  w.answer(/hn\.algolia\.com\/api\/v1\/items\/9001/, () => J({ id: 9001, children: [{ id: 1, author: 'hn_harry', text: '<p>Reservation policy worked in Western Australia.</p>', created_at_i: Math.floor((NOW - 4 * H) / 1000), children: [{ id: 2, author: 'hn_sal', text: '<p>It did not, prices rose anyway.</p>', created_at_i: Math.floor((NOW - 3 * H) / 1000), children: [] }] }, { id: 3, author: 'ghost', text: null, children: [] }] }));
  w.answer(/outlet\.example\.com\.au\/wp-json\/wp\/v2\/posts/, () => J([
    { id: 4401, link: 'https://outlet.example.com.au/2026/11/pharmacy-60-day-dispensing/', title: { rendered: 'Community pharmacy and 60-day dispensing: what changed' }, date_gmt: new Date(NOW - 8 * H).toISOString().replace(/\.\d+Z$/, ''), excerpt: { rendered: '<p>Pharmacists respond.</p>' }, content: { rendered: '<p>' + 'Community pharmacy owners say 60-day dispensing has cut their income. '.repeat(12) + '</p>' } },
    { id: 4402, link: 'https://outlet.example.com.au/2026/11/garden-show/', title: { rendered: 'The garden show returns to town' }, date_gmt: new Date(NOW - 8 * H).toISOString().replace(/\.\d+Z$/, ''), excerpt: { rendered: '' }, content: { rendered: '<p>Roses.</p>' } }]));
  w.answer(/outlet\.example\.com\.au\/wp-json\/wp\/v2\/comments/, u => (/post=4401/.test(String(u)) ? J([{ id: 9, post: 4401, parent: 0, author_name: 'Margaret Reader', date_gmt: new Date(NOW - 6 * H).toISOString().replace(/\.\d+Z$/, ''), content: { rendered: '<p>My local pharmacy has cut its hours since this came in.</p>' } }, { id: 10, post: 4401, parent: 9, author_name: 'Tom', date_gmt: new Date(NOW - 5 * H).toISOString().replace(/\.\d+Z$/, ''), content: { rendered: '<p>Rubbish, they are doing fine.</p>' } }]) : J([])));
  await add(w, { id: 'lemmy_test', name: 'Lemmy: reef.example', tier: 'community', urls: { lemmy: 'reef.example' } }); await add(w, { id: 'hn_test', name: 'HN', tier: 'community', urls: { hn: 'australia' } });
  await add(w, { id: 'wp_test', name: 'Example Outlet', tier: 'independent', urls: { wp: 'https://outlet.example.com.au' } });
  for (const id of ['lemmy_test', 'hn_test', 'wp_test']) { const s = await sweep(w, id); ok(s.ok, id + ': ' + JSON.stringify(s).slice(0, 200)); }
  const art = arc(w, 'news', "src='wp_test'"); ok(art.find(r => /pharmacy/.test(r.title)).meta.wp === 4401, 'a WordPress article keeps its post number for the comments: ' + JSON.stringify(art.map(r => r.meta.wp)));
  const r = await T_.communityEnrich(w.env, {}); ok(r.ok && r.by && r.by.lemmy.threads === 1 && r.by.hn.threads === 1 && r.by.web.threads === 1, JSON.stringify(r).slice(0, 400));
  const cs = arc(w, 'sig_comment'); const by = p => cs.filter(c => c.meta.platform === p);
  eq(by('lemmy').map(c => c.body).sort(), ['A windfall tax would fund a lot.', 'The gas companies pay nothing and everyone knows it. Disgraceful.'], 'Lemmy comments as text, the deleted one left out'); ok(by('lemmy').every(c => c.meta.thread && c.meta.permalink === 'https://reef.example/post/501' && c.meta.issues.indexOf('gastax') >= 0), 'each carries its thread and the thread\'s issues'); eq(by('lemmy').find(c => /windfall/.test(c.body)).meta.depth, 1, 'a reply is a reply');
  eq(by('hn').map(c => c.body).sort(), ['It did not, prices rose anyway.', 'Reservation policy worked in Western Australia.']); eq(by('web').length, 2); ok(by('web').every(c => c.meta.permalink === 'https://outlet.example.com.au/2026/11/pharmacy-60-day-dispensing/' && c.meta.issues.indexOf('pharmacy') >= 0), JSON.stringify(by('web')[0].meta));
  ok(!/angry_anne|calm_carl|hn_harry|hn_sal|Margaret Reader|"Tom"/.test(JSON.stringify(cs)) && cs.every(c => c.author === ''), 'no commenter is named, anywhere');
  const webThread = arc(w, 'sig_thread').find(t => t.meta.platform === 'web'); ok(webThread && webThread.meta.comments === 2 && /pharmacy/.test(webThread.title) && webThread.meta.page_name === 'Example Outlet', 'the article is the thread its comments hang from: ' + JSON.stringify(webThread && webThread.meta));
  eq(hits(w, /wp-json\/wp\/v2\/comments\?post=4402/).length, 0, 'an article on no issue is not asked for its comments');
  const n = w.outbound.length; const again = await T_.communityEnrich(w.env, {}); eq([again.by.lemmy.threads, again.by.hn.threads, again.by.web.threads], [0, 0, 0], 'each thread once'); eq(w.outbound.length, n, 'and nothing is asked twice');
  const job = await F(w, 'POST', '/social/sweep', { platform: 'community' }); ok(job.status === 200 && job.body.ok, 'it can be run on demand: ' + job.text.slice(0, 160)); eq((await F(w, 'POST', '/social/sweep', { platform: 'community' }, 'read-key')).status, 403);
});

await S.t('WN7 the seed', async () => {
  const w = await mk(); const d = (await F(w, 'GET', '/sources?status=', null, 'read-key')).body; const by = {}; d.sources.forEach(s => { by[s.id] = s; });
  eq(d.sources.length, new Set(d.sources.map(s => s.id)).size, 'no id twice');
  eq([by.lex_gnews.methods, by.lex_gnews.urls.lexicon, by.lex_gnews.tier], [['lexicon'], 'gnews', 'sweep']); eq([by.lex_gdelt.methods, by.lex_gdelt.urls.lexicon], [['lexicon'], 'gdelt']);
  eq([by.lemmy_aussiezone.methods, by.lemmy_aussiezone.urls.lemmy, by.lemmy_aussiezone.tier], [['lemmy'], 'aussie.zone', 'community']); eq(by.hn_australia.methods, ['hn']);
  const forums = d.sources.filter(s => (s.methods || []).indexOf('forum') >= 0); ok(forums.length >= 3 && forums.every(s => /^https:\/\//.test(s.urls.forum)), forums.map(s => s.id).join(','));
  const before = 385; ok(d.sources.length >= before + 30, 'at least thirty more sources than before: ' + d.sources.length);
  const fresh = d.sources.filter(s => /^(wn_)/.test(s.id)); ok(fresh.length >= 25 && fresh.every(s => s.urls.site && (s.methods || []).indexOf('gnews') >= 0), 'each new outlet has Google News as its sure route: ' + fresh.length);
  const hosts = d.sources.map(s => String((s.urls || {}).site || '').toLowerCase()).filter(Boolean); const dup = hosts.filter((h, i) => hosts.indexOf(h) !== i && fresh.some(s => s.urls.site === h)); eq(dup, [], 'no new outlet repeats a site already held');
  const li = (await F(w, 'GET', '/reddit/issues', null, 'read-key')).body; ok(li.subs.length >= 26 && ['Adelaide', 'canberra', 'AusLegal', 'AusProperty'].every(s => li.subs.indexOf(s) >= 0) && li.subs.indexOf('AustralianPolitics') >= 0, 'more subreddits, published to the Mac: ' + li.subs.length); eq(li.subs.length, new Set(li.subs.map(s => s.toLowerCase())).size);
  ok(w.mod.__test.MASTO_TAGS.indexOf('vicpol') >= 0 && w.mod.__test.MASTO_TAGS.indexOf('auspol') >= 0);
});

await S.t('WN8 a refusal backs the host off; robots.txt is obeyed', async () => {
  const w = await mk();
  w.answer(/closed\.example\/robots\.txt$/, () => T('User-agent: *\nDisallow: /api/\n')); w.answer(/closed\.example\/api/, () => J({ posts: lemmyPosts }));
  await add(w, { id: 'lemmy_closed', name: 'Closed', tier: 'community', urls: { lemmy: 'closed.example' } }); const a = await sweep(w, 'lemmy_closed'); eq(a.ok, false); ok(/robots\.txt/.test(JSON.stringify(a.tried)), JSON.stringify(a.tried).slice(0, 200)); eq(hits(w, /closed\.example\/api/).length, 0, 'a page robots.txt disallows is never requested');
  w.answer(/angry\.example\/robots\.txt$/, () => T('', 404)); w.answer(/angry\.example\/index\.rss/, () => T('slow down', 429));
  await add(w, { id: 'forum_angry', name: 'Angry', tier: 'community', urls: { forum: 'https://angry.example/index.rss' } }); const b = await sweep(w, 'forum_angry'); eq(b.ok, false); ok(/refused/.test(JSON.stringify(b.tried)), JSON.stringify(b.tried).slice(0, 200));
  const n = hits(w, /angry\.example\/index\.rss/).length; await sweep(w, 'forum_angry'); eq(hits(w, /angry\.example\/index\.rss/).length, n, 'and it is not asked again that day');
});

await S.t('WN9 the coverage table and the Signals routes', async () => {
  const w = await mk(); noRobots(w); w.answer(/reef\.example\/api\/v3\/post\/list/, () => J({ posts: lemmyPosts }));
  await add(w, { id: 'lemmy_test', name: 'Lemmy: reef.example', tier: 'community', urls: { lemmy: 'reef.example' } }); await sweep(w, 'lemmy_test');
  const cov = (await F(w, 'GET', '/social/coverage', null, 'read-key')).body; const ids = cov.platforms.map(p => p.id); ok(['lemmy', 'hn', 'forums', 'web'].every(p => ids.indexOf(p) >= 0), 'the table names the new channels: ' + ids.join(','));
  const lm = cov.platforms.find(p => p.id === 'lemmy'); ok(lm.counts.threads7 >= 2 && /none/i.test(String(lm.keys)) && /robots/i.test(lm.method + ' ' + lm.unreachable), JSON.stringify(lm).slice(0, 300));
  const th = (await F(w, 'GET', '/signals/threads?platform=lemmy&days=3&all=1', null, 'read-key')).body; ok(th.ok && th.threads.length >= 1 && th.threads.every(t => !t.author), JSON.stringify(th).slice(0, 200));
});

await S.t('WN10 the community job: the community sources, then the comments under what they found', async () => {
  const w = await mk(); noRobots(w); const T_ = w.mod.__test; ok(typeof T_.communitySweep === 'function', 'communitySweep is exported');
  // only the test source is switched on, so the seeded community sources are not asked for anything here
  await F(w, 'GET', '/sources', null, 'read-key'); w.env.MIND_DB.db.prepare("UPDATE sources SET enabled=0 WHERE tier='community'").run();
  w.answer(/reef\.example\/api\/v3\/post\/list/, () => J({ posts: lemmyPosts }));
  w.answer(/reef\.example\/api\/v3\/comment\/list/, () => J({ comments: [{ comment: { id: 9, content: 'Tax the exports, not the households.', path: '0.9', published: new Date(NOW - H).toISOString() }, creator: { name: 'someone' }, counts: { score: 3 } }] }));
  await add(w, { id: 'lemmy_test', name: 'Lemmy: reef.example', tier: 'community', urls: { lemmy: 'reef.example' } });
  const lines = []; const r = await T_.communitySweep(w.env, {}, async (k, m) => { lines.push(k + ' ' + m); });
  ok(r.ok && r.sources && r.sources.ran === 1 && r.sources.succeeded === 1, 'the community sources are read first: ' + JSON.stringify(r.sources));
  eq([r.threadRows >= 2, r.by.lemmy.threads, r.by.lemmy.comments], [true, 1, 1], JSON.stringify(r).slice(0, 300));
  const order = w.outbound.map(o => o.url).filter(u => /reef\.example\/api/.test(u)); ok(/post\/list/.test(order[0]) && /comment\/list/.test(order[order.length - 1]), 'threads, then comments: ' + order.join(' | '));
  ok(lines.some(l => /community source/.test(l)), 'the job says what it is doing: ' + lines.slice(0, 3).join(' / ')); ok(!/someone/.test(JSON.stringify(arc(w, 'sig_comment'))));
  // a registry with no community source is said in words, and the comments are still read
  w.env.MIND_DB.db.prepare("UPDATE sources SET enabled=0 WHERE tier='community'").run(); const none = await T_.communitySweep(w.env, {}); ok(none.ok && none.sources.ran === 0 && /no community source/i.test(String(none.note)), JSON.stringify(none).slice(0, 240));
  // the Signals tabs start it as a job
  const run = await F(w, 'POST', '/bridge/run', { source: 'community', params: {} }); ok(run.status === 200 && run.body.where === 'worker', run.text.slice(0, 200));
});

await S.t('WN11 room for the wider registry: a source that keeps failing waits longer, a tick can be widened', async () => {
  const w = await mk(); noRobots(w); const db = w.env.MIND_DB.db; const due = id => { const r = db.prepare('SELECT next_due, fails, schedule FROM sources WHERE id=?').get(id); return { mins: Math.round((r.next_due - Date.now()) / 60000), fails: r.fails, schedule: r.schedule }; };
  w.answer(/down\.example\/index\.rss/, () => T('oops', 500));
  await add(w, { id: 'forum_down', name: 'Down', tier: 'community', schedule: 60, urls: { forum: 'https://down.example/index.rss' } });
  const waits = []; for (let i = 0; i < 7; i++) { await sweep(w, 'forum_down'); waits.push(due('forum_down').mins); }
  eq(waits.slice(0, 5), [60, 120, 240, 480, 960], 'one failure is a blip; after that the wait doubles: ' + waits.join(','));
  ok(waits[5] === 1440 && waits[6] === 1440, 'and a dead source is asked once a day, no more: ' + waits.join(','));
  w.answer(/down\.example\/index\.rss/, () => T('<?xml version="1.0"?><rss><channel><title>f</title><item><title>Gas export tax: what the forum thinks</title><link>https://down.example/t/1</link><pubDate>' + rfc(H) + '</pubDate></item></channel></rss>', 200, 'application/rss+xml'));
  const good = await sweep(w, 'forum_down'); eq(good.ok, true, JSON.stringify(good).slice(0, 200)); eq([due('forum_down').mins, due('forum_down').fails], [60, 0], 'a source that delivers is back on its schedule');
  // the number of sources a tick reads is the owner's to raise (var SOURCES_PER_TICK), within bounds
  const T_ = w.mod.__test; eq([T_.sourcesPerTick({}), T_.sourcesPerTick({ SOURCES_PER_TICK: '80' }), T_.sourcesPerTick({ SOURCES_PER_TICK: '9999' }), T_.sourcesPerTick({ SOURCES_PER_TICK: 'lots' })], [50, 80, 150, 50]);
  const st = (await F(w, 'GET', '/sources', null, 'read-key')).body; eq(st.perTick, 50);
});

await S.t('WN12 the comment pass looks through a few WordPress sites a run, in turn, never all at once', async () => {
  const w = await mk(); noRobots(w); const T_ = w.mod.__test; const N = T_.WP_COMMENT_SOURCES; ok(N >= 4 && N <= 20, 'a bounded number: ' + N);
  await F(w, 'GET', '/sources', null, 'read-key'); const db = w.env.MIND_DB.db; db.prepare("UPDATE sources SET method_ok=''").run();
  for (let i = 0; i < N + 5; i++) { await add(w, { id: 'wpx' + String(i).padStart(2, '0'), name: 'WP ' + i, tier: 'sector', urls: { wp: 'https://wp' + i + '.example.com.au' } }); }
  db.prepare("UPDATE sources SET method_ok='wp' WHERE id LIKE 'wpx%'").run();
  const orig = db.prepare.bind(db); const asked = []; db.prepare = sql => { const q = String(sql); const m = /kind='news' AND src IN \(([?,]+)\)/.exec(q); if (m) asked.push(m[1].split(',').length); return orig(sql); };
  try { await T_.communityEnrich(w.env, {}); await T_.communityEnrich(w.env, {}); } finally { db.prepare = orig; }
  eq(asked, [N, N], 'each run asks about ' + N + ' sites, not all ' + (N + 5));
  eq(Number(await w.env.AXIOM_KV.get('wpc_cur')), (2 * N) % (N + 5), 'and the next run starts where this one stopped');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
