/* Source Registry + full-text harness: drives axiomworkerv4.js through its fetch
 * and scheduled handlers with a real SQLite behind the D1 API (d1lite), a fake
 * KV, and a fetch stub that serves fixtures for a small estate of sources.
 * Run: node sources-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});

/* ---------- env ---------- */
const kv = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })) }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async () => {}, get: async () => null, delete: async () => {} },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
};
kv.set('slack_webhooks', JSON.stringify({ _default: 'https://hooks.slack.test/T/B/x' }));
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
async function drain() { for (let i = 0; i < 5 && ctx.waits.length; i++) { const w = ctx.waits.splice(0); await Promise.allSettled(w); } }

/* ---------- fixtures ---------- */
const NOW = Date.now();
const iso = (msAgo) => new Date(NOW - msAgo).toISOString();
const rfc = (msAgo) => new Date(NOW - msAgo).toUTCString();
const LONG = 'The Nationals today set out a plan for regional rail that returns the V/Line network to hourly services on every line by 2030. '.repeat(8);
const rss = (items) => '<?xml version="1.0"?><rss><channel><title>t</title>' + items.map(i => '<item><title><![CDATA[' + i.title + ']]></title>' + (i.link ? '<link>' + i.link + '</link>' : '') + (i.enc ? '<enclosure url="' + i.enc + '" type="audio/mpeg"/>' : '') + '<pubDate>' + rfc(i.ago || 3600000) + '</pubDate><description><![CDATA[' + (i.desc || 'A description of the story.') + ']]></description></item>').join('') + '</channel></rss>';
const sitemap = (urls) => '<?xml version="1.0"?><urlset xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' + urls.map(u => '<url><loc>' + u.loc + '</loc><news:news><news:publication_date>' + iso(u.ago || 3600000) + '</news:publication_date><news:title>' + u.title + '</news:title></news:news></url>').join('') + '</urlset>';
const article = (title, body) => '<html><head><title>' + title + '</title><meta property="og:title" content="' + title + '"><script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'NewsArticle', headline: title, datePublished: iso(7200000), author: { '@type': 'Person', name: 'A Reporter' }, articleBody: body }) + '</script></head><body><article><p>' + body.slice(0, 200) + '</p></article></body></html>';
const ampPage = (title) => '<html><body><article>' + Array.from({ length: 8 }, (_, i) => '<p>Paragraph ' + i + ' of the article behind the paywall, served on the AMP route which the publisher makes public for search. It runs long enough to count as body text.</p>').join('') + '</article></body></html>';
const listing = (host) => '<html><body><nav><a href="/">Home</a><a href="/news">News</a></nav><main>' + Array.from({ length: 6 }, (_, i) => '<a href="' + host + '/news/2026/09/guild-welcomes-pharmacist-prescribing-expansion-' + i + '">Guild welcomes the expansion of pharmacist prescribing in every state number ' + i + '</a>').join('') + '<a href="' + host + '/about">About us</a></main></body></html>';
const b64id = Buffer.from('\u0008\u0013"\u001dhttps://www.example-news.com.au/story/one\u0010\u0001', 'latin1').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const calls = [];
const R = (body, status = 200, type = 'text/html') => new Response(body, { status, headers: { 'content-type': type } });
globalThis.fetch = async (url, init) => {
  const u = String(url); const method = (init && init.method) || 'GET';
  calls.push({ u, method, body: init && init.body ? String(init.body) : '' });
  // -- the Nationals: feed dead, WordPress API alive, sitemap alive, Google News alive
  if (u === 'https://nationals.org.au/feed/') return R('not found', 404);
  if (u.startsWith('https://nationals.org.au/wp-json/wp/v2/posts')) return R(JSON.stringify([
    { link: 'https://nationals.org.au/news/regional-rail-plan/', title: { rendered: 'Nationals unveil regional rail plan' }, date_gmt: iso(3600000).replace('Z', ''), excerpt: { rendered: '<p>A plan for regional rail.</p>' }, content: { rendered: '<p>' + LONG + '</p>' } },
    { link: 'https://nationals.org.au/news/duck-season/', title: { rendered: 'Duck season decision welcomed' }, date_gmt: iso(7200000).replace('Z', ''), excerpt: { rendered: '<p>Short.</p>' }, content: { rendered: '<p>' + LONG + '</p>' } },
  ]), 200, 'application/json');
  if (u === 'https://nationals.org.au/robots.txt') return R('User-agent: *\nSitemap: https://nationals.org.au/news-sitemap.xml\n', 200, 'text/plain');
  if (u === 'https://nationals.org.au/news-sitemap.xml') return R(sitemap([{ loc: 'https://nationals.org.au/news/regional-rail-plan/', title: 'Nationals unveil regional rail plan' }]), 200, 'application/xml');
  if (u.startsWith('https://news.google.com/rss/search?q=site%3Anationals.org.au')) return R(rss([{ title: 'Nationals unveil regional rail plan - The Nationals', link: 'https://news.google.com/rss/articles/' + b64id + '?oc=5' }]), 200, 'application/rss+xml');
  // -- Courier-Mail: /rss is an HTML page; robots -> news sitemap works
  if (u === 'https://www.couriermail.com.au/rss') return R('<html><body><h1>RSS feeds</h1><a href="/rss/politics">Politics</a></body></html>');
  if (u === 'https://couriermail.com.au/robots.txt') return R('Sitemap: https://www.couriermail.com.au/sitemap.xml\nSitemap: https://www.couriermail.com.au/news-sitemap.xml\n', 200, 'text/plain');
  if (u === 'https://www.couriermail.com.au/news-sitemap.xml') return R(sitemap([{ loc: 'https://www.couriermail.com.au/news/queensland/premier-announces-mining-royalty-review/news-story/abc123', title: 'Premier announces mining royalty review' }, { loc: 'https://www.couriermail.com.au/news/queensland/old-story/news-story/x', title: 'An old story', ago: 5 * 86400000 }]), 200, 'application/xml');
  // -- Capital Brief: nothing but Google News
  if (u === 'https://capitalbrief.com/robots.txt') return R('', 404);
  if (u.startsWith('https://news.google.com/rss/search?q=site%3Acapitalbrief.com')) return R(rss([{ title: 'Treasury eyes fuel tax credit changes in budget update - Capital Brief', link: 'https://news.google.com/rss/articles/CBMiZZZ?oc=5' }]), 200, 'application/rss+xml');
  // -- MiningNews: everything fails
  if (u === 'https://miningnews.net/robots.txt') return R('', 403);
  if (u.startsWith('https://news.google.com/rss/search?q=site%3Aminingnews.net')) return R(rss([]), 200, 'application/rss+xml');
  // -- 7am: the Apple directory then a feed whose items carry only enclosures
  if (u.startsWith('https://itunes.apple.com/search?term=7am')) return R(JSON.stringify({ results: [{ collectionName: '7am', feedUrl: 'https://feeds.test/7am.xml' }] }), 200, 'application/json');
  if (u === 'https://feeds.test/7am.xml') return R(rss([{ title: 'The fuel tax fight, explained', enc: 'https://feeds.test/ep/101.mp3', desc: 'Why the miners are spending.' }, { title: 'Spring Street in spring', enc: 'https://feeds.test/ep/102.mp3' }]), 200, 'application/rss+xml');
  // -- the Guild: a listing page
  if (u === 'https://www.guild.org.au/news-events/news') return R(listing('https://www.guild.org.au'));
  // -- articles for the full-text chain
  if (u === 'https://www.example-news.com.au/story/one') return R(article('Story one', LONG));
  if (u === 'https://www.paywalled.com.au/story/two') return R('<html><head><link rel="amphtml" href="https://www.paywalled.com.au/story/two/amp"><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false,"headline":"Story two"}</script></head><body><p>Subscribe to continue reading this story.</p></body></html>');
  if (u === 'https://www.paywalled.com.au/story/two/amp') return R(ampPage('Story two'));
  if (u === 'https://www.gone.com.au/story/three') return R('', 404);
  if (u === 'https://archive.org/wayback/available?url=' + encodeURIComponent('https://www.gone.com.au/story/three')) return R(JSON.stringify({ archived_snapshots: { closest: { available: true, url: 'http://web.archive.org/web/20250101000000/https://www.gone.com.au/story/three', timestamp: '20250101000000' } } }), 200, 'application/json');
  if (u === 'https://web.archive.org/web/20250101000000id_/https://www.gone.com.au/story/three') return R(article('Story three', LONG));
  if (u.startsWith('https://archive.org/wayback/available')) return R(JSON.stringify({ archived_snapshots: {} }), 200, 'application/json');
  if (u === 'https://news.google.com/rss/articles/CBMiZZZ?oc=5') return R('<html><body><c-wiz data-n-a-sg="SIG" data-n-a-ts="1700000000"></c-wiz></body></html>');
  if (u === 'https://news.google.com/_/DotsSplashUi/data/batchexecute') return R(")]}'\n\n123\n" + JSON.stringify([['wrb.fr', 'Fbv4je', JSON.stringify(['garturlres', 'https://www.example-news.com.au/story/one', 1]), null, null, null, 'generic']]) + '\n', 200, 'application/json');
  if (u === 'https://render.test/') return R(JSON.stringify({ html: listing('https://www.guild.org.au') }), 200, 'application/json');
  if (u.startsWith('https://hooks.slack.test/')) return R('ok');
  return R('', 404);
};

/* ---------- runner ---------- */
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

console.log('sources-worker harness');
let list;
await t('GET /sources seeds the registry from AU_FEEDS plus the extension list, every source unverified', async () => {
  const r = await req('GET', '/sources', null, 'read-key');
  eq(r.status, 200); list = r.d;
  ok(list.summary.core >= 78 && list.sources.filter(s => s.core).length === list.summary.core, 'core feeds mirrored: ' + list.summary.core);
  ok(list.summary.total > 250, 'a wide net: ' + list.summary.total);
  eq(list.summary.unverified, list.summary.total, 'nothing has been tried yet');
  ok(list.sources.every(s => s.methods.length), 'every source has at least one method');
  const nat = list.sources.find(s => s.id === 'nationals');
  eq(nat.methods, ['rss', 'wp', 'sitemap', 'gnews'], 'methods derive from the urls, in chain order');
  ok(list.tiers.indexOf('podcast') >= 0 && list.juris.indexOf('vic') >= 0);
});
await t('filters narrow by tier, jurisdiction and issue', async () => {
  const a = await req('GET', '/sources?tier=podcast', null, 'read-key'); ok(a.d.sources.length >= 10 && a.d.sources.every(s => s.tier === 'podcast'));
  const b = await req('GET', '/sources?juris=vic', null, 'read-key'); ok(b.d.sources.length >= 15 && b.d.sources.every(s => s.juris === 'vic'), 'vic: ' + b.d.sources.length);
  const c = await req('GET', '/sources?issue=pharmacy', null, 'read-key'); ok(c.d.sources.length >= 8 && c.d.sources.every(s => s.issues.indexOf('pharmacy') >= 0));
  const d = await req('GET', '/sources?q=courier', null, 'read-key'); ok(d.d.sources.some(s => s.id === 'couriermail'));
});
await t('GET /sources/probe runs every method and says which deliver', async () => {
  eq((await req('GET', '/sources/probe?id=nationals', null, 'read-key')).status, 403, 'a live probe that writes health rows needs a full key');
  const r = await req('GET', '/sources/probe?id=nationals');
  eq(r.status, 200); eq(r.d.best, 'wp'); eq(r.d.delivering, ['wp', 'sitemap', 'gnews']);
  const by = {}; r.d.results.forEach(x => { by[x.method] = x; });
  eq(by.rss.ok, false); eq(by.rss.status, 404); ok(/HTTP 404/.test(by.rss.detail));
  ok(by.wp.full === true && by.wp.n === 2 && by.wp.sample[0].title === 'Nationals unveil regional rail plan');
  eq(by.sitemap.n, 1); ok(by.gnews.sample[0].title === 'Nationals unveil regional rail plan', 'outlet suffix stripped');
  const s = row('SELECT method_ok, fails, last_ok FROM sources WHERE id=?', 'nationals');
  eq(s.method_ok, 'wp'); eq(s.fails, 0); ok(s.last_ok > 0);
  const h = row('SELECT ok, method, detail FROM source_health WHERE src=? ORDER BY id DESC', 'nationals');
  eq(h.ok, 1); eq(h.method, 'wp'); ok(/rss:x404 wp:2 sitemap:1 gnews:1/.test(h.detail), h.detail);
});
await t('a read-only key can look but not change', async () => {
  const a = await req('POST', '/sources/add', { name: 'X', urls: { rss: 'https://x.test/feed' } }, 'read-key'); eq(a.status, 403);
  const b = await req('POST', '/sources/sweep', { ids: ['nationals'] }, 'read-key'); eq(b.status, 403);
  const c = await req('GET', '/sources/health?id=nationals', null, 'read-key'); eq(c.status, 200); ok(c.d.rows.length === 1);
});
await t('POST /sources/sweep with a few ids runs inline and files rows with the method, tier and full text', async () => {
  const r = await req('POST', '/sources/sweep', { ids: ['nationals', 'couriermail', 'capitalbrief', 'pod_7am', 'guild_org'] });
  eq(r.status, 200); eq(r.d.ran, 5); eq(r.d.succeeded, 5);
  const by = {}; r.d.results.forEach(x => { by[x.id] = x; });
  eq(by.nationals.method, 'wp'); eq(by.nationals.items, 2);
  eq(by.couriermail.method, 'sitemap'); eq(by.couriermail.items, 1, 'the five-day-old sitemap entry is dropped');
  eq(by.capitalbrief.method, 'gnews'); eq(by.pod_7am.method, 'podcast'); eq(by.pod_7am.items, 2);
  eq(by.guild_org.method, 'html'); eq(by.guild_org.items, 6, 'nav and about links are not articles');
  const nat = row("SELECT src, body, meta, ts FROM arc_items WHERE kind='news' AND url='https://nationals.org.au/news/regional-rail-plan/'");
  const m = JSON.parse(nat.meta);
  eq(m.reg, 1); eq(m.method, 'wp'); eq(m.tier, 'party'); eq(m.juris, 'au'); eq(m.ft, 'wp'); eq(m.dated, 1);
  ok(nat.body.length > 600, 'WordPress content is the full text'); ok(m.issues.indexOf('regional') >= 0, 'issue tags from the wide lexicon: ' + m.issues);
  const cb = row("SELECT meta FROM arc_items WHERE kind='news' AND src='capitalbrief'"); const cm = JSON.parse(cb.meta);
  eq(cm.outlet, 'Capital Brief'); ok(cm.issues.indexOf('ftc') >= 0);
  const pod = row("SELECT url, title FROM arc_items WHERE kind='news' AND src='pod_7am' ORDER BY id"); eq(pod.url, 'https://feeds.test/ep/101.mp3', 'episode filed under its enclosure when there is no link');
  const g = row("SELECT meta, ts FROM arc_items WHERE kind='news' AND src='guild_org' ORDER BY id"); eq(JSON.parse(g.meta).dated, 0); ok(Math.abs(g.ts - Date.now()) < 60000, 'undated listing items are stamped at first sight');
  ok(kv.get('pod_feed_pod_7am') === 'https://feeds.test/7am.xml', 'the podcast feed url is remembered');
});
await t('a source with no working route records the failure with reasons, and stays failing', async () => {
  const r = await req('POST', '/sources/sweep', { ids: ['miningnews'] });
  eq(r.d.failed, 1); ok(/sitemap: HTTP 403/.test(r.d.results[0].tried.map(x => x.method + ': ' + x.detail).join('; ')), JSON.stringify(r.d.results[0].tried));
  ok(/gnews: Google News has nothing/.test(r.d.results[0].tried.map(x => x.method + ': ' + x.detail).join('; ')));
  const s = row('SELECT fails, last_error, method_ok FROM sources WHERE id=?', 'miningnews');
  eq(s.fails, 1); ok(/sitemap:x403 gnews:x200/.test(s.last_error), s.last_error); eq(s.method_ok, '');
  const l = await req('GET', '/sources?status=failing', null, 'read-key'); ok(l.d.sources.some(x => x.id === 'miningnews'));
});
await t('six failures in a row report the source dead to Slack once', async () => {
  for (let i = 0; i < 5; i++) await req('POST', '/sources/sweep', { ids: ['miningnews'] });
  const slack = calls.filter(c => c.u.startsWith('https://hooks.slack.test/'));
  eq(slack.length, 1, 'one Slack post');
  ok(/MiningNews\.net/.test(slack[0].body) && /stopped delivering/.test(slack[0].body), slack[0].body.slice(0, 200));
  const s = row('SELECT fails, alerted FROM sources WHERE id=?', 'miningnews'); eq(s.fails, 6); eq(s.alerted, 1);
  await req('POST', '/sources/sweep', { ids: ['miningnews'] });
  eq(calls.filter(c => c.u.startsWith('https://hooks.slack.test/')).length, 1, 'not reported twice');
  const l = await req('GET', '/sources?status=dead', null, 'read-key'); eq(l.d.sources.map(x => x.id), ['miningnews']); eq(l.d.summary.dead, 1);
});
let added;
await t('POST /sources/add validates, derives methods, and marks the row as the operator\'s', async () => {
  const a = await req('POST', '/sources/add', { name: 'Nowhere' }); eq(a.status, 400); eq(a.d.error, 'missing_urls');
  const b = await req('POST', '/sources/add', { name: 'Riverine Herald', tier: 'regional', juris: 'vic', issues: 'regional,bogus', urls: { wp: 'https://riverineherald.com.au', site: 'riverineherald.com.au' }, schedule: 5 });
  eq(b.status, 200); added = b.d.source;
  eq(added.id, 'riverine_herald'); eq(added.methods, ['wp', 'sitemap', 'gnews']); eq(added.issues, ['regional']); eq(added.schedule, 15, 'schedule floor'); eq(added.edited, true);
  const c = await req('POST', '/sources/add', { id: 'smh', name: 'Hijack', urls: { rss: 'https://evil.test/feed' } }); eq(c.status, 400); eq(c.d.error, 'core_source');
});
await t('POST /sources/update switches a source off, and a core feed off drops it from /allnews', async () => {
  const a = await req('POST', '/sources/update', { id: 'riverine_herald', enabled: false, note: 'paused' });
  eq(a.d.source.enabled, false); eq(a.d.source.note, 'paused');
  const l = await req('GET', '/sources?status=off', null, 'read-key'); ok(l.d.sources.some(s => s.id === 'riverine_herald'));
  const before = await req('GET', '/allnews?debug=1', null, 'read-key'); eq(before.d.feeds, list.summary.core, 'every core feed is fetched');
  const b = await req('POST', '/sources/update', { id: 'abc', enabled: false }); eq(b.d.source.enabled, false); eq(b.d.source.core, true);
  eq(JSON.parse(kv.get('sources_core_off')), ['abc']);
  const after = await req('GET', '/allnews?debug=1', null, 'read-key'); eq(after.d.feeds, list.summary.core - 1, 'the switched-off core feed is not fetched');
  await req('POST', '/sources/update', { id: 'abc', enabled: true });
});
await t('/allnews merges the registry rows from the archive and marks them', async () => {
  const r = await req('GET', '/allnews?debug=1&hours=72', null, 'read-key');
  ok(r.d.registry >= 10, 'registry rows merged: ' + r.d.registry);
  const it = r.d.items.find(i => i.src === 'nationals');
  ok(it && it.reg === 1 && it.tier === 'party' && it.method === 'wp', JSON.stringify(it));
});
await t('export and import round-trip; import updates, adds, and refuses core feeds', async () => {
  const e = await req('GET', '/sources/export', null, 'read-key'); ok(e.d.count > 250); ok(e.d.sources[0].urls);
  const i = await req('POST', '/sources/import', { sources: [{ id: 'riverine_herald', name: 'Riverine Herald (Echuca)', urls: { rss: 'https://riverineherald.com.au/feed/' } }, { name: 'Colac Herald', tier: 'regional', juris: 'vic', urls: { site: 'colacherald.com.au' } }, { id: 'smh', name: 'x', urls: { rss: 'https://x/feed' } }, { name: 'No urls' }] });
  eq(i.d.added, 1); eq(i.d.updated, 1); eq(i.d.skipped.map(s => s.reason), ['core feed', 'no urls']);
  const rh = await req('GET', '/sources?q=riverine', null, 'read-key'); eq(rh.d.sources[0].name, 'Riverine Herald (Echuca)'); eq(rh.d.sources[0].methods, ['rss']);
});
await t('delete removes an operator source and refuses a core feed', async () => {
  const a = await req('POST', '/sources/delete', { id: 'smh' }); eq(a.status, 400); eq(a.d.error, 'core_source');
  const b = await req('POST', '/sources/delete', { id: 'colac_herald' }); eq(b.d.deleted, 'colac_herald');
  eq((await req('GET', '/sources?q=colac', null, 'read-key')).d.sources.length, 0);
});
await t('a big sweep becomes a job the console tails, running in the worker', async () => {
  const r = await req('POST', '/bridge/run', { source: 'sources', params: { ids: ['nationals', 'couriermail', 'capitalbrief', 'pod_7am', 'guild_org', 'miningnews'] } });
  eq(r.status, 200); eq(r.d.where, 'worker');
  await drain();
  const j = await req('GET', '/bridge/job?id=' + r.d.id, null, 'read-key');
  eq(j.d.status, 'done'); ok(j.d.lines.some(l => /sweeping 6 sources/.test(l.text))); ok(j.d.lines.some(l => l.kind === 'cmd' && /nationals: wp/.test(l.text)));
  ok(j.d.lines.some(l => l.kind === 'err' && /miningnews: sitemap/.test(l.text)), 'failures are red in the console');
  eq(j.d.result.ran, 6); eq(j.d.result.succeeded, 5);
  const s = await req('POST', '/sources/sweep', { all: true }); ok(s.d.job, 'sweep all is a job'); await drain();
});
await t('POST /sources/report lets a desktop collector record a render probe', async () => {
  const r = await req('POST', '/sources/report', { id: 'guild_org', ok: true, method: 'render', n: 9, ms: 1200, added: 3 });
  eq(r.d.source.method_ok, 'render');
  const h = row('SELECT method, n, ok FROM source_health WHERE src=? ORDER BY id DESC', 'guild_org'); eq(h.method, 'render'); eq(h.n, 3); eq(h.ok, 1);
});
await t('GET /fulltext reads an article from the page itself (JSON-LD articleBody)', async () => {
  const r = await req('GET', '/fulltext?url=' + encodeURIComponent('https://www.example-news.com.au/story/one'), null, 'read-key');
  eq(r.status, 200); eq(r.d.ok, true); eq(r.d.method, 'direct'); eq(r.d.extract, 'jsonld'); ok(r.d.chars > 600); eq(r.d.title, 'Story one'); eq(r.d.author, 'A Reporter');
  eq(r.d.attempts.length, 1);
});
await t('a paywalled page falls through to its AMP version, and says the paywall was there', async () => {
  const r = await req('GET', '/fulltext?url=' + encodeURIComponent('https://www.paywalled.com.au/story/two'), null, 'read-key');
  eq(r.d.ok, true); eq(r.d.method, 'amp'); eq(r.d.paywall, true); eq(r.d.final, 'https://www.paywalled.com.au/story/two/amp');
  eq(r.d.attempts[0].method, 'direct'); ok(/paywall signalled/.test(r.d.attempts[0].detail), r.d.attempts[0].detail);
  eq(r.d.attempts[1].method, 'amp'); eq(r.d.attempts[1].ok, true);
});
await t('a dead page comes back from the Wayback Machine; the failed routes are listed', async () => {
  const r = await req('GET', '/fulltext?url=' + encodeURIComponent('https://www.gone.com.au/story/three'), null, 'read-key');
  eq(r.d.ok, true); eq(r.d.method, 'wayback');
  const ms = r.d.attempts.map(a => a.method + ':' + (a.ok ? 'ok' : a.status));
  eq(ms, ['direct:404', 'amp:404', 'amp:404', 'amp:404', 'ampcache:404', 'wayback:ok']);
  ok(/web\.archive\.org\/web\/20250101000000id_/.test(r.d.final));
});
await t('Google News links are decoded first: base64 ids on the spot, newer ids through the interstitial', async () => {
  const a = await req('GET', '/fulltext?url=' + encodeURIComponent('https://news.google.com/rss/articles/' + b64id + '?oc=5'), null, 'read-key');
  eq(a.d.ok, true); eq(a.d.attempts[0].method, 'gnews'); eq(a.d.attempts[0].detail, 'decoded via base64'); eq(a.d.decoded, 'https://www.example-news.com.au/story/one');
  const b = await req('GET', '/fulltext?url=' + encodeURIComponent('https://news.google.com/rss/articles/CBMiZZZ?oc=5'), null, 'read-key');
  eq(b.d.ok, true); eq(b.d.attempts[0].detail, 'decoded via batchexecute'); eq(b.d.final, 'https://www.example-news.com.au/story/one');
  const be = calls.find(c => c.u.endsWith('/batchexecute')); ok(/garturlreq/.test(decodeURIComponent(be.body)) && /SIG/.test(decodeURIComponent(be.body)), 'signature and timestamp travel in the request');
});
await t('/fulltext?id= files the text on the archive row for a full key, and only reads for a read key', async () => {
  db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','capitalbrief','Story one','blurb','https://www.example-news.com.au/story/one','',0,'{\"reg\":1}',?,?)").run(NOW - 3600000, NOW);
  const id = row("SELECT id FROM arc_items WHERE url='https://www.example-news.com.au/story/one'").id;
  const a = await req('GET', '/fulltext?id=' + id, null, 'read-key'); eq(a.d.ok, true); ok(!a.d.filed);
  eq(row('SELECT body FROM arc_items WHERE id=?', id).body, 'blurb');
  const b = await req('GET', '/fulltext?id=' + id); eq(b.d.filed, true);
  const r2 = row('SELECT body, meta FROM arc_items WHERE id=?', id); ok(r2.body.length > 600); const m = JSON.parse(r2.meta); eq(m.ft, 'direct'); eq(m.reg, 1); ok(m.published);
});
await t('POST /fulltext/save is how a desktop collector writes an article back', async () => {
  const a = await req('POST', '/fulltext/save', { url: 'https://nationals.org.au/news/duck-season/', text: 'short' }); eq(a.status, 400); eq(a.d.error, 'too_short');
  const b = await req('POST', '/fulltext/save', { url: 'https://nationals.org.au/news/duck-season/', text: LONG, method: 'desktop' }); eq(b.d.ok, true); eq(b.d.method, 'desktop');
  const c = await req('POST', '/fulltext/save', { id: 999999, text: LONG }); eq(c.status, 404);
  const d = await req('POST', '/fulltext/save', { url: 'https://nationals.org.au/news/duck-season/', text: LONG }, 'read-key'); eq(d.status, 403);
});
await t('a render job without a browser goes to the desktop; with RENDER_URL it runs here and files the listing', async () => {
  const a = await req('POST', '/bridge/run', { source: 'render', params: { source: 'guild_org' } }); eq(a.d.where, 'desktop');
  const st = await req('GET', '/bridge/status', null, 'read-key'); eq(st.d.sources.find(s => s.source === 'render').ready, false);
  env.RENDER_URL = 'https://render.test/';
  const b = await req('POST', '/bridge/run', { source: 'render', params: { source: 'guild_org' } }); eq(b.d.where, 'worker');
  await drain();
  const j = await req('GET', '/bridge/job?id=' + b.d.id, null, 'read-key'); eq(j.d.status, 'done'); eq(j.d.result.items, 6); eq(j.d.result.method, 'render');
  ok(j.d.lines.some(l => /6 article-shaped links/.test(l.text)));
  const c = await req('POST', '/bridge/run', { source: 'render', params: { url: 'https://www.example-news.com.au/story/one' } }); await drain();
  const jc = await req('GET', '/bridge/job?id=' + c.d.id, null, 'read-key'); eq(jc.d.result.ok, false, 'the render service returned a listing, not an article: honest failure');
  delete env.RENDER_URL;
});
await t('the cron mirrors core health, sweeps due sources and fills in full text', async () => {
  db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','smh','Story three','blurb only','https://www.gone.com.au/story/three','',0,NULL,?,?)").run(NOW - 3600000, NOW);
  db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','smh','Story four','blurb only','https://www.nowhere.com.au/story/four','',0,NULL,?,?)").run(NOW - 3600000, NOW);
  await handler.scheduled({}, env, ctx); await drain();
  const core = row("SELECT last_try, fails, last_error FROM sources WHERE id='smh'"); ok(core.last_try > 0); eq(core.fails, 1); eq(core.last_error, 'HTTP 404');
  const hs = row("SELECT COUNT(*) n FROM source_health WHERE src='smh'"); eq(hs.n, 1, 'a core failure is logged');
  const swept = row('SELECT COUNT(*) n FROM sources WHERE core=0 AND last_try>0'); ok(swept.n >= 50, 'registry sources swept this tick: ' + swept.n);
  const three = row("SELECT body, meta FROM arc_items WHERE url='https://www.gone.com.au/story/three'"); ok(three.body.length > 600); eq(JSON.parse(three.meta).ft, 'wayback');
  const four = row("SELECT body, meta FROM arc_items WHERE url='https://www.nowhere.com.au/story/four'"); eq(four.body, 'blurb only'); const m4 = JSON.parse(four.meta); eq(m4.ft, 'retry'); eq(m4.ft_try, 1); ok(m4.ft_err);
  ok(kv.get('sources_last_sweep') && kv.get('fulltext_last'), 'the tick leaves its summary for the view');
});
await t('GET /sources/health lists recent attempts with the day\'s totals', async () => {
  const r = await req('GET', '/sources/health?limit=20', null, 'read-key');
  eq(r.d.rows.length, 20); ok(r.d.last24.runs > 50 && r.d.last24.failed > 0 && r.d.last24.ok > 0, JSON.stringify(r.d.last24));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
