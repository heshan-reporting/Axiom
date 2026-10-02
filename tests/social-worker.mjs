/* Social capture harness: drives axiomworkerv4.js through its handlers with a
 * real SQLite behind the D1 API, a fake KV, and a fetch stub serving fixtures
 * for Bluesky, Mastodon, X's embed service, YouTube (channel page, feed, web
 * comments endpoint, watch page, captions, Data API), the parliaments'
 * e-petition pages, Substack and TikTok. Run: node social-worker.mjs */
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
};
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
async function drain() { for (let i = 0; i < 6 && ctx.waits.length; i++) { const w = ctx.waits.splice(0); await Promise.allSettled(w); } }

/* ---------- fixtures ---------- */
const NOW = Date.now();
const iso = ago => new Date(NOW - ago).toISOString();
const bpost = (uri, did, text, eng, ago) => ({ uri, cid: 'c', author: { did, handle: 'someone.bsky.social', displayName: 'Someone' }, record: { text, createdAt: iso(ago || 3600e3), langs: ['en'] }, likeCount: eng[0], repostCount: eng[1], replyCount: eng[2], quoteCount: eng[3] || 0, indexedAt: iso(ago || 3600e3) });
const AU1 = 'at://did:plc:aaa/app.bsky.feed.post/3kaaa', AU2 = 'at://did:plc:bbb/app.bsky.feed.post/3kbbb', US1 = 'at://did:plc:ccc/app.bsky.feed.post/3kccc';
const masto = (id, text, eng, ago, inReply) => ({ id: String(id), created_at: iso(ago || 3600e3), url: 'https://aus.social/@x/' + id, content: '<p>' + text + '</p>', favourites_count: eng[0], reblogs_count: eng[1], replies_count: eng[2], account: { acct: 'x@aus.social', display_name: 'X' }, tags: [{ name: 'auspol' }], in_reply_to_id: inReply || null, language: 'en' });
const nextData = tweets => '<html><body><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { headerProps: { screenName: 'AlboMP' }, timeline: { entries: tweets.map(t => ({ type: 'tweet', content: { tweet: t } })) } } } }) + '</script></body></html>';
const tw = (id, text, likes, rts, replies, ago, extra) => Object.assign({ id_str: id, full_text: text, created_at: new Date(NOW - (ago || 3600e3)).toUTCString(), favorite_count: likes, retweet_count: rts, reply_count: replies, user: { screen_name: 'AlboMP', name: 'Anthony Albanese' } }, extra || {});
const ytFeed = '<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/"><title>ABC News (Australia)</title>'
  + '<entry><yt:videoId>vid00000001</yt:videoId><yt:channelId>UCVgO39Bk5sMo66-6o6Spn6Q</yt:channelId><title>Fuel tax credit fight heats up as miners launch campaign</title><link rel="alternate" href="https://www.youtube.com/watch?v=vid00000001"/><author><name>ABC News (Australia)</name></author><published>' + iso(7200e3) + '</published><media:group><media:description>The Minerals Council says the diesel rebate is not a subsidy.</media:description><media:statistics views="12345"/></media:group></entry>'
  + '<entry><yt:videoId>vid00000002</yt:videoId><yt:channelId>UCVgO39Bk5sMo66-6o6Spn6Q</yt:channelId><title>Weather: a wet week ahead for the east coast</title><link rel="alternate" href="https://www.youtube.com/watch?v=vid00000002"/><author><name>ABC News (Australia)</name></author><published>' + iso(3600e3) + '</published><media:group><media:description>Rain.</media:description><media:statistics views="500"/></media:group></entry></feed>';
const ytNextFirst = { contents: { twoColumnWatchNextResults: { results: { results: { contents: [{ videoPrimaryInfoRenderer: {} }, { itemSectionRenderer: { sectionIdentifier: 'comment-item-section', contents: [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'CONT123', request: 'CONTINUATION_REQUEST_TYPE_WATCH_NEXT' } } } }] } }] } } } } };
const ytNextSecond = { onResponseReceivedEndpoints: [{ reloadContinuationItemsCommand: { continuationItems: [{ commentThreadRenderer: {} }] } }], frameworkUpdates: { entityBatchUpdate: { mutations: [
  { payload: { commentEntityPayload: { properties: { commentId: 'Ugx1', content: { content: 'The diesel rebate is a rort and everyone knows it. Shameful.' }, publishedTime: '2 days ago', replyLevel: 0 }, toolbar: { likeCountNotliked: '41', replyCount: '3' } } } },
  { payload: { commentEntityPayload: { properties: { commentId: 'Ugx2', content: { content: 'Good on the miners for standing up, it funds regional towns.' }, publishedTime: '1 day ago', replyLevel: 1 }, toolbar: { likeCountNotliked: '7' } } } },
] } } };
const playerResponse = { videoDetails: { videoId: 'vid00000001' }, captions: { playerCaptionsTracklistRenderer: { captionTracks: [{ baseUrl: 'https://www.youtube.com/api/timedtext?v=vid00000001&lang=en', languageCode: 'en', kind: 'asr' }] } } };
const watchPage = '<html><body><script>var ytInitialPlayerResponse = ' + JSON.stringify(playerResponse) + ';var other = {"a":1};</script></body></html>';
const captions = { events: Array.from({ length: 30 }, (_, i) => ({ segs: [{ utf8: 'the minerals council says the fuel tax credit is a refund of road tax segment ' + i }] })) };
const aphList = '<html><body><ul><li><a href="/e-petitions/petition/EN7001">Reverse the changes to fuel tax credits for regional businesses</a></li><li><a href="/e-petitions/petition/EN7002">Ban duck hunting in Victoria</a></li><li><a href="/about">About petitions</a></li></ul></body></html>';
const aphDetail = (n, sigs, body) => '<html><body><nav>x</nav><h1>Petition EN' + n + '</h1><p>Signatures: ' + sigs + '</p><p>Closing date: 12 November 2026</p><p>' + (body || 'We the undersigned call on the House to reverse the changes to fuel tax credits which will hurt regional businesses across the country and cost jobs in mining towns.') + '</p></body></html>';
const subFeed = '<?xml version="1.0"?><rss><channel><item><title>Why the fuel tax credit matters</title><link>https://example.substack.com/p/why-the-fuel-tax-credit-matters</link><pubDate>' + new Date(NOW - 5 * 3600e3).toUTCString() + '</pubDate><description><![CDATA[A long read on the diesel rebate.]]></description></item></channel></rss>';
const calls = [];
const R = (body, status = 200, type = 'application/json') => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type } });
globalThis.fetch = async (url, init) => {
  const u = String(url); const method = (init && init.method) || 'GET';
  calls.push({ u, method, body: init && init.body ? String(init.body) : '', headers: (init && init.headers) || {} });
  // Bluesky
  if (u.startsWith('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts')) {
    const q = decodeURIComponent((u.match(/q=([^&]+)/) || [])[1] || '');
    if (/fuel tax credit/.test(q)) return R({ posts: [bpost(AU1, 'did:plc:aaa', 'The fuel tax credit fight is on: the Minerals Council says it is not a subsidy #auspol', [12, 3, 4]), bpost(US1, 'did:plc:ccc', 'Our fuel tax credit in Texas is a joke, Congress should act', [2, 0, 0]), bpost(AU2, 'did:plc:bbb', 'Albanese hedges on the diesel rebate in Perth today', [30, 8, 1])] });
    if (/auspol/.test(q)) return R({ posts: [bpost(AU1, 'did:plc:aaa', 'auspol post', [1, 0, 0])] });
    return R({ posts: [] });
  }
  if (u.startsWith('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread')) return R({ thread: { post: bpost(AU1, 'did:plc:aaa', 'root', [12, 3, 4]), replies: [{ post: bpost('at://did:plc:ddd/app.bsky.feed.post/3kr1', 'did:plc:ddd', 'Rubbish. It is a subsidy for billionaires, a disgrace.', [5, 0, 1]), replies: [{ post: bpost('at://did:plc:eee/app.bsky.feed.post/3kr2', 'did:plc:eee', 'It refunds road tax on fuel used off road. Farmers get it too.', [9, 1, 0]), replies: [] }] }] } });
  // Mastodon
  if (/^https:\/\/aus\.social\/api\/v1\/timelines\/tag\/auspol/.test(u)) return R([masto(101, 'Spring Street is a mess: the Allan government cannot land the budget #auspol #springst', [4, 2, 2]), masto(102, 'Nothing to see here', [0, 0, 0])]);
  if (/^https:\/\/aus\.social\/api\/v1\/timelines\/tag\//.test(u)) return R([]);
  if (u === 'https://aus.social/api/v1/statuses/101/context') return R({ ancestors: [], descendants: [masto(201, 'Agree, the budget is a shambles and regional Victoria pays', [1, 0, 0], 1800e3, 101)] });
  if (/^https:\/\/(mastodon\.au|theblower\.au|mastodon\.social)\//.test(u)) return R('', 503);
  // X embed service
  if (u === 'https://syndication.twitter.com/srv/timeline-profile/screen-name/AlboMP') return R(nextData([tw('1001', 'Today we announced a $1 billion critical minerals reserve. Jobs for the Pilbara.', 900, 200, 340), tw('1002', 'RT old', 1, 1, 1, 3600e3, { retweeted_status: {} }), tw('1003', 'Old post', 5, 1, 0, 30 * 86400e3)]), 200, 'text/html');
  if (u === 'https://syndication.twitter.com/srv/timeline-profile/screen-name/MineralsCouncil') return R(nextData([tw('2001', 'Hands Off Our Fuel: 20,000 signatures and counting.', 120, 40, 12)]), 200, 'text/html');
  if (u === 'https://syndication.twitter.com/srv/timeline-profile/screen-name/gone_account') return R('', 404, 'text/html');
  if (u.startsWith('https://cdn.syndication.twimg.com/tweet-result?id=1001')) return R({ id_str: '1001', text: 'Today we announced a $1 billion critical minerals reserve.', created_at: new Date(NOW - 3600e3).toUTCString(), favorite_count: 900, conversation_count: 340, user: { screen_name: 'AlboMP' } });
  // YouTube
  if (u === 'https://www.youtube.com/@abcnewsaustralia') return R('<html><script>var ytInitialData = {"metadata":{"channelMetadataRenderer":{"externalId":"UCVgO39Bk5sMo66-6o6Spn6Q"}}}</script></html>', 200, 'text/html');
  if (u === 'https://www.youtube.com/feeds/videos.xml?channel_id=UCVgO39Bk5sMo66-6o6Spn6Q') return R(ytFeed, 200, 'application/atom+xml');
  if (u.startsWith('https://www.youtube.com/youtubei/v1/next')) { const b = JSON.parse(init.body); if (b.videoId === 'vid00000002') return R({ contents: {} }); return R(b.continuation ? ytNextSecond : ytNextFirst); }
  if (u.startsWith('https://www.youtube.com/watch?v=vid00000001')) return R(watchPage, 200, 'text/html');
  if (u.startsWith('https://www.youtube.com/watch?v=')) return R('<html>no player</html>', 200, 'text/html');
  if (u.startsWith('https://www.youtube.com/youtubei/v1/player')) return R({ playabilityStatus: { status: 'ERROR', reason: 'Video unavailable' } });
  if (u.startsWith('https://www.youtube.com/api/timedtext?v=vid00000001')) return R(captions);
  if (u.startsWith('https://www.googleapis.com/youtube/v3/commentThreads')) return R({ items: [{ id: 'T1', snippet: { topLevelComment: { id: 'T1', snippet: { textDisplay: 'Data API comment: this rebate is fair enough', likeCount: 3, publishedAt: iso(3600e3) } } }, replies: { comments: [{ id: 'T1.r', snippet: { textDisplay: 'Reply via the API, hostile and angry rubbish', likeCount: 0, publishedAt: iso(1800e3) } }] } }] });
  // petitions
  if (u === 'https://www.aph.gov.au/e-petitions') return R(aphList, 200, 'text/html');
  if (u === 'https://www.aph.gov.au/e-petitions/petition/EN7001') return R(aphDetail(7001, '4,212'), 200, 'text/html');
  if (u === 'https://www.aph.gov.au/e-petitions/petition/EN7002') return R(aphDetail(7002, '910', 'We the undersigned ask the House to end recreational duck hunting in Victoria for good, as other states have done.'), 200, 'text/html');
  if (/parliament\.(vic|qld|nsw)\.gov\.au/.test(u)) return R('', 403, 'text/html');
  // Substack
  if (u === 'https://example.substack.com/feed') return R(subFeed, 200, 'application/rss+xml');
  if (u === 'https://example.substack.com/api/v1/posts/why-the-fuel-tax-credit-matters') return R({ id: 555, title: 'Why the fuel tax credit matters' });
  if (u.startsWith('https://example.substack.com/api/v1/post/555/comments')) return R({ comments: [{ id: 1, body: 'Great piece, the subsidy line is a lie.', date: iso(3000e3), reactions: { '❤': 4 }, children: [{ id: 2, body: 'Disagree entirely, it is corporate welfare and a disgrace', date: iso(2000e3), reactions: {}, children: [] }] }] });
  if (u.startsWith('https://substack.com/api/v1/publication/search')) return R({ results: [{ name: 'Nervous Laughter', subdomain: 'nervouslaughter', hero_text: 'Australian politics, weekly', subscriber_count_string: 'Thousands of subscribers' }, { name: 'No url pub' }] });
  if (u.startsWith('https://www.tiktok.com/oembed')) return R({ title: 'Mining pays for your hospital #auspol', author_name: 'someone', thumbnail_url: 'https://p16.tiktokcdn.com/x.jpg' });
  if (u.startsWith('https://hooks.slack.test/')) return R('ok', 200, 'text/plain');
  return R('', 404, 'text/html');
};

const mod = await import(WORKER);
const handler = mod.default;
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx);
  let d = null; try { d = await res.json(); } catch (e) { d = null; }
  return { status: res.status, d };
}
async function job(source, params) { const r = await req('POST', '/bridge/run', { source, params: params || {}, where: 'worker' }); await drain(); const j = await req('GET', '/bridge/job?id=' + r.d.id, null, 'read-key'); return j.d; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const rows = (sql, ...a) => db.prepare(sql).all(...a);
const row = (sql, ...a) => db.prepare(sql).get(...a);

console.log('social-worker harness');
await t('GET /social/coverage lists every platform with method, keys and what it cannot reach', async () => {
  const r = await req('GET', '/social/coverage', null, 'read-key');
  eq(r.status, 200); const ids = r.d.platforms.map(p => p.id);
  ok(['reddit', 'bluesky', 'mastodon', 'x', 'youtube', 'linkedin', 'meta', 'adlibrary', 'facebook_public', 'threads', 'tiktok', 'forums', 'petitions', 'substack'].every(i => ids.indexOf(i) >= 0), ids.join(','));
  const fb = r.d.platforms.find(p => p.id === 'facebook_public'); eq(fb.configured, false); ok(/Page Public Content Access/.test(fb.keys) && /refuses other pages/.test(fb.unreachable));
  const yt = r.d.platforms.find(p => p.id === 'youtube'); eq(yt.apiKey, false); ok(/YOUTUBE_KEY optional/.test(yt.keys));
  ok(r.d.platforms.every(p => p.counts && typeof p.counts.threads24 === 'number'));
});
await t('GET /social/coverage?probe=1 asks each keyless platform one small question', async () => {
  eq((await req('GET', '/social/coverage?probe=1', null, 'read-key')).status, 403, 'a live probe of every platform needs a full key');
  const r = await req('GET', '/social/coverage?probe=1');
  const by = {}; r.d.platforms.forEach(p => { by[p.id] = p; });
  eq(by.bluesky.probe.ok, true); ok(/1 posts for auspol/.test(by.bluesky.probe.detail));
  eq(by.mastodon.probe.ok, true); eq(by.x.probe.ok, true); ok(/3 posts in the embed timeline/.test(by.x.probe.detail));
  eq(by.youtube.probe.ok, true); ok(/UCVgO39Bk5sMo66-6o6Spn6Q/.test(by.youtube.probe.detail));
  eq(by.petitions.probe.ok, true); ok(/2 petitions listed/.test(by.petitions.probe.detail));
  eq(by.substack.probe.ok, true);
});
await t('a Bluesky sweep keeps the Australian posts, drops the Texan one, and files replies with engagement', async () => {
  const j = await job('bluesky', { queries: ['fuel tax credit'] });
  eq(j.status, 'done'); eq(j.result.found, 3); eq(j.result.kept, 2); eq(j.result.threads, 2); eq(j.result.comments, 2);
  ok(j.lines.some(l => /3 hits, 2 Australian kept/.test(l.text)));
  const th = rows("SELECT url, meta, author FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='bluesky' ORDER BY id");
  eq(th.length, 2); ok(th.every(x => x.author === ''), 'no author names');
  const m = JSON.parse(th[0].meta); eq(m.eng, { likes: 12, reposts: 3, replies: 4, quotes: 0, views: 0 }); ok(m.issues.indexOf('ftc') >= 0); eq(m.uri, AU1); ok(/bsky\.app\/profile\/did:plc:aaa\/post\/3kaaa/.test(th[0].url), 'permalink by DID, not handle');
  const cm = rows("SELECT body, tone, meta FROM arc_items WHERE kind='sig_comment' AND json_extract(meta,'$.platform')='bluesky' ORDER BY id");
  eq(cm.length, 2); eq(cm[0].tone, -1, 'the hostile reply reads hostile'); eq(JSON.parse(cm[1].meta).depth, 2); eq(JSON.parse(cm[0].meta).thread, m.id);
});
await t('a Mastodon sweep reads the Australian tags, skips instances that are down, files replies', async () => {
  const j = await job('mastodon', {});
  eq(j.status, 'done'); ok(j.result.threads === 2, 'threads: ' + j.result.threads); eq(j.result.comments, 1);
  ok(j.lines.some(l => l.kind === 'err' && /mastodon\.au/.test(l.text)), 'a dead instance is reported');
  const th = row("SELECT title, meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='mastodon' AND url LIKE '%/101'");
  const m = JSON.parse(th.meta); eq(m.page, 'aus.social'); eq(m.eng.likes, 4); ok(m.issues.indexOf('vicelection') >= 0); eq(m.tags, ['auspol']);
  const c = row("SELECT body, meta FROM arc_items WHERE kind='sig_comment' AND json_extract(meta,'$.platform')='mastodon'"); eq(JSON.parse(c.meta).thread, m.id);
});
await t('the X watch list is edited by POST and read back beside the MP register', async () => {
  await req('POST', '/mps/sync', {}); // no network fixture: the register stays as inserted below
  db.prepare("INSERT OR REPLACE INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES('Q1','Anthony Albanese','Australian Labor Party','representatives','Grayndler','AlboMP','','',?)").run(NOW);
  const a = await req('POST', '/social/x/watch', { handles: [{ handle: '@MineralsCouncil', ns: 'mca', name: 'Minerals Council of Australia' }, 'gone_account', { handle: 'bad handle!' }] });
  eq(a.d.handles.map(h => h.handle), ['MineralsCouncil', 'gone_account']);
  const g = await req('GET', '/social/x/watch', null, 'read-key'); eq(g.d.handles.length, 2); eq(g.d.mps, 1);
  const ro = await req('POST', '/social/x/watch', { handles: [] }, 'read-key'); eq(ro.status, 403);
});
await t('an X timeline sweep reads the watch list and the MPs through the embed service, names only the MP', async () => {
  const r = await req('POST', '/social/sweep', { platform: 'x', params: { days: 7 } }); eq(r.d.where, 'worker'); await drain();
  const j = (await req('GET', '/bridge/job?id=' + r.d.job, null, 'read-key')).d;
  eq(j.status, 'done'); eq(j.result.accounts, 3); eq(j.result.threads, 2, 'the retweet and the month-old post are left out');
  ok(j.lines.some(l => l.kind === 'err' && /gone_account: HTTP 404/.test(l.text)));
  const pm = row("SELECT url, author, meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='x' AND json_extract(meta,'$.id')='1001'");
  const m = JSON.parse(pm.meta); eq(pm.url, 'https://x.com/i/web/status/1001'); eq(pm.author, ''); eq(m.mp, { name: 'Anthony Albanese', party: 'Australian Labor Party', house: 'representatives' }); eq(m.eng.likes, 900); eq(m.synd, 1); ok(m.issues.indexOf('cm') >= 0);
  const mca = row("SELECT meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.id')='2001'"); const mm = JSON.parse(mca.meta); eq(mm.page, 'MineralsCouncil'); eq(mm.ns, 'mca'); ok(!mm.mp);
});
await t('a YouTube channel is a Source Registry source: the handle resolves, videos file as Signals threads', async () => {
  const r = await req('POST', '/sources/sweep', { ids: ['yt_abcnews'] });
  const res = r.d.results[0]; eq(res.ok, true); eq(res.method, 'youtube'); eq(res.items, 2);
  eq(kv.get('yt_ch_abcnewsaustralia'), 'UCVgO39Bk5sMo66-6o6Spn6Q');
  const v = row("SELECT title, url, meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='youtube' AND json_extract(meta,'$.video')='vid00000001'");
  const m = JSON.parse(v.meta); eq(v.url, 'https://www.youtube.com/watch?v=vid00000001'); eq(m.eng.views, 12345); eq(m.source, 'yt_abcnews'); eq(m.page_name, 'ABC News (Australia)'); ok(m.issues.indexOf('ftc') >= 0);
  const l = await req('GET', '/sources?q=yt_abcnews', null, 'read-key'); eq(l.d.sources[0].method_ok, 'youtube'); eq(l.d.sources[0].items24, 2, 'video rows count for the source');
});
await t('YouTube comments come through the web endpoint without a key, captions become a transcript, issue videos first', async () => {
  const j = await job('youtube', {});
  eq(j.status, 'done'); eq(j.result.videos, 2); eq(j.result.comments, 2); eq(j.result.transcripts, 1); eq(j.result.via, 'web');
  ok(j.lines.some(l => /POST youtubei\/v1\/next videoId=vid00000001/.test(l.text)));
  const cm = rows("SELECT body, tone, meta FROM arc_items WHERE kind='sig_comment' AND json_extract(meta,'$.platform')='youtube' ORDER BY id");
  eq(cm.length, 2); eq(cm[0].tone, -1); eq(JSON.parse(cm[0].meta).eng.likes, 41); eq(JSON.parse(cm[0].meta).thread, 'vid00000001'); eq(JSON.parse(cm[1].meta).depth, 1);
  const tr = row("SELECT body, meta FROM arc_items WHERE kind='transcript' AND url='x:yt:tr:vid00000001'");
  ok(tr && tr.body.length > 600, 'transcript filed'); const tm = JSON.parse(tr.meta); eq(tm.asr, 1); eq(tm.lang, 'en'); ok(tm.issues.indexOf('ftc') >= 0);
  const v = row("SELECT meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.video')='vid00000001'"); const vm = JSON.parse(v.meta); eq(vm.enriched, 1); eq(vm.comments_held, 2); ok(vm.transcript > 600);
  ok(j.lines.some(l => l.kind === 'err' && /vid00000002.*no comments section/.test(l.text)), 'the video with comments off says so');
  ok(j.lines.some(l => l.kind === 'err' && /vid00000002: (Video unavailable|no captions|no player)/.test(l.text)), 'the video with no captions says so');
  const again = await job('youtube', {}); eq(again.result.videos, 0, 'each video is enriched once');
});
await t('with YOUTUBE_KEY the Data API is used for comments', async () => {
  env.YOUTUBE_KEY = 'k';
  db.prepare("UPDATE arc_items SET meta=json_remove(meta,'$.enriched') WHERE kind='sig_thread' AND json_extract(meta,'$.video')='vid00000001'").run();
  const j = await job('youtube', { video: 'vid00000001' });
  eq(j.result.via, 'data api'); ok(j.lines.some(l => /GET youtube\/v3\/commentThreads/.test(l.text)));
  const c = row("SELECT body FROM arc_items WHERE kind='sig_comment' AND url='x:sigc:youtube:T1'"); ok(c && /Data API comment/.test(c.body), 'the Data API comment is on file');
  delete env.YOUTUBE_KEY;
});
await t('GET /social/youtube/transcript reads captions on demand', async () => {
  const r = await req('GET', '/social/youtube/transcript?v=vid00000001', null, 'read-key'); eq(r.d.ok, true); ok(r.d.chars > 600); eq(r.d.asr, true);
  const n = await req('GET', '/social/youtube/transcript?v=vid00000002', null, 'read-key'); eq(n.d.ok, false); ok(/Video unavailable|no captions|no player/.test(n.d.detail), n.d.detail);
});
await t('a petitions sweep reads the parliament pages, keeps signatures and a daily snapshot, ranks growth', async () => {
  const day0 = new Date(NOW - 86400e3).toISOString().slice(0, 10);
  db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('petition','aph','Reverse the changes to fuel tax credits for regional businesses','','x:pet:seed:' || ?,'',0,?,?,?)").run(day0, JSON.stringify({ platform: 'petitions', site: 'aph', juris: 'au', petition: 'https://www.aph.gov.au/e-petitions/petition/EN7001', signatures: 3800, day: day0 }), NOW - 86400e3, NOW);
  const j = await job('petitions', {});
  eq(j.status, 'done'); if (j.result.listed !== 2) console.log('       petitions result:', JSON.stringify(j.result), j.lines.map(l => l.text).join(' | ').slice(0, 600)); eq(j.result.listed, 2); eq(j.result.read, 2); eq(j.result.rows, 2); eq(j.result.snapshots, 2);
  ok(j.lines.some(l => l.kind === 'err' && /vic: HTTP 403/.test(l.text)), 'a refused parliament is named');
  const p = row("SELECT title, body, meta FROM arc_items WHERE kind='petition' AND url='https://www.aph.gov.au/e-petitions/petition/EN7001'");
  const m = JSON.parse(p.meta); eq(m.signatures, 4212); eq(m.closes, '12 November 2026'); ok(m.issues.indexOf('ftc') >= 0); ok(p.body.length > 50);
  const l = await req('GET', '/social/petitions?issue=ftc', null, 'read-key');
  eq(l.d.petitions.length, 1); eq(l.d.petitions[0].signatures, 4212); eq(l.d.petitions[0].growth24, 412, 'growth against yesterday\'s snapshot'); ok(l.d.sites.length === 4);
  const all = await req('GET', '/social/petitions', null, 'read-key'); eq(all.d.petitions.length, 2); eq(all.d.petitions[0].url, 'https://www.aph.gov.au/e-petitions/petition/EN7001', 'fastest growing first');
});
await t('a Substack publication is a source: posts file as threads, their comment threads beside them', async () => {
  const a = await req('POST', '/sources/add', { name: 'Example Substack', tier: 'newsletter', urls: { substack: 'https://example.substack.com' }, issues: ['ftc'] });
  eq(a.d.source.methods, ['substack']); eq(a.d.source.tier, 'newsletter');
  const r = await req('POST', '/sources/sweep', { ids: ['example_substack'] }); const res = r.d.results[0]; eq(res.ok, true); eq(res.method, 'substack'); eq(res.items, 1); eq(res.added, 3, 'one post and two comments');
  const th = row("SELECT meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='substack'"); const m = JSON.parse(th.meta); eq(m.page, 'example.substack.com'); eq(m.comments, 2); eq(m.source, 'example_substack');
  const cm = rows("SELECT body, tone, meta FROM arc_items WHERE kind='sig_comment' AND json_extract(meta,'$.platform')='substack' ORDER BY id"); eq(cm.length, 2); eq(JSON.parse(cm[0].meta).eng.likes, 4); eq(JSON.parse(cm[1].meta).depth, 1); eq(cm[1].tone, -1);
  const s = await req('GET', '/social/substack/search?q=australian%20politics', null, 'read-key'); eq(s.d.results.length, 1); eq(s.d.results[0].url, 'https://nervouslaughter.substack.com');
});
await t('GET /social/tiktok reads one post through oEmbed and refuses other hosts', async () => {
  const a = await req('GET', '/social/tiktok?url=' + encodeURIComponent('https://www.tiktok.com/@x/video/123'), null, 'read-key'); eq(a.d.ok, true); ok(/Mining pays/.test(a.d.title)); ok(!JSON.stringify(a.d).includes('author'), 'no author kept');
  const b = await req('GET', '/social/tiktok?url=https://evil.test/x', null, 'read-key'); eq(b.d.ok, false);
});
await t('POST /social/sweep validates the platform and is full-role', async () => {
  const a = await req('POST', '/social/sweep', { platform: 'threads' }); eq(a.status, 400); eq(a.d.error, 'unknown_platform');
  const b = await req('POST', '/social/sweep', { platform: 'bluesky' }, 'read-key'); eq(b.status, 403);
  const st = await req('GET', '/bridge/status', null, 'read-key'); ok(['bluesky', 'mastodon', 'youtube', 'petitions'].every(s => st.d.sources.some(x => x.source === s && x.ready && !x.desktopOnly)));
});
await t('/signals/threads and /signals/status see the new platforms in the same shape', async () => {
  const b = await req('GET', '/signals/threads?platform=bluesky&days=7', null, 'read-key'); eq(b.d.threads.length, 2); ok(b.d.threads[0].issues.length >= 1); ok(b.d.threads.every(x => x.platform === 'bluesky'));
  const c = await req('GET', '/signals/comments?platform=bluesky&thread=' + b.d.threads.find(x => x.comments === 4).id, null, 'read-key'); eq(c.d.comments.length, 2);
  const y = await req('GET', '/signals/threads?platform=youtube&days=7', null, 'read-key'); eq(y.d.threads.length, 2); eq(y.d.threads[0].channel, 'ABC News (Australia)');
  const s = await req('GET', '/signals/status', null, 'read-key'); ok(s.d.byPlatform.bluesky.threads === 2 && s.d.byPlatform.mastodon.comments === 1 && s.d.byPlatform.x.threads === 2 && s.d.byPlatform.youtube.comments >= 2);
});
await t('the cron runs the social capture two-hourly and leaves a summary the coverage table shows', async () => {
  kv.delete('social_last_run'); kv.set('petitions_last', String(NOW));
  await handler.scheduled({}, env, ctx); await drain();
  const last = JSON.parse(kv.get('social_last'));
  ok(last.bluesky && last.mastodon && last.x && last.youtube, Object.keys(last).join(','));
  ok(!last.petitions, 'petitions ran today already');
  const cov = await req('GET', '/social/coverage', null, 'read-key');
  const x = cov.d.platforms.find(p => p.id === 'x'); ok(x.last && x.last.at, 'last run recorded for X'); ok(cov.d.platforms.find(p => p.id === 'bluesky').counts.threads7 >= 2);
  const before = kv.get('social_last_run'); await handler.scheduled({}, env, ctx); await drain(); eq(kv.get('social_last_run'), before, 'a second tick within two hours does not run again');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
