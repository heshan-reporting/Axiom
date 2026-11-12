/* Collection hardening (build p65): the one collector fetch and what goes through it, against the worker module in this
 * process. No service is contacted: every answer is an invented stand-in served by the recording fetch, in the shapes
 * each service's public documentation describes, not ones seen live.
 *   CH1  a 5xx is asked once more, after a backoff
 *   CH2  once only: two 5xx answers come back as the failure; two dropped connections throw after two tries
 *   CH3  a POST is never asked twice
 *   CH4  every request has a timeout; a timeout is not asked again where the caller says so
 *   CH5  Retry-After: a short one is waited once; a long one is recorded and the service is not asked again
 *   CH6  the rate headers of Reddit (seconds), Bluesky (an epoch) and Mastodon (a date) are all read
 *   CH7  Meta's usage headers: the app near its allowance pauses the host; one throttled object holds only its own requests
 *   CH8  the Graph reader: a gateway page is a failure by name, an expired token and a throttle are said in words
 *   CH9  Reddit on a 401: one new token, one more ask
 *   CH10 pagination says when it stopped short (Meta insights, ad comments, Bluesky)
 *   CH11 our own Pages: counts by type, comments followed across pages, counts refreshed on a later run with a daily
 *        snapshot, the linked Instagram account, and nobody named
 *   CH12 LinkedIn: a current API version, a refused token said in words or renewed, counts, paging caps
 *   CH13 the public reader: a 5xx is asked once more after the host's pace; a 429 is a refusal and is not
 *   CH14 the Source Registry: a source that answers 500 then 200 delivers
 *   CH15 no collector calls fetch() directly
 *   CH16 the Federal Register of Legislation through its API: titles on a client issue, the cap said
 *   CH18 a source held by a rate limit is not a failed source; a public site is held fifteen minutes at most; holds are counted
 *   CH19 a registry sweep spends a fixed number of second asks and says how many
 *   CH17 AusTender's contract notices: on a client issue, nobody named, the next page followed, the cap said
 * Run: node --experimental-sqlite tests/collect-hardening-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Collection hardening: retry, rate limits, timeouts, pagination caps, Meta and LinkedIn engagement');
const J = (o, status, headers) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}) });
const T = (body, status, headers) => new Response(body, { status: status || 200, headers: Object.assign({ 'Content-Type': 'text/html' }, headers || {}) });
const mk = async env => {
  const sleeps = [];
  const w = await workerEnv({ env: Object.assign({ __collectSleep: async ms => { sleeps.push(ms); }, __pubSleep: async ms => { sleeps.push('pace:' + ms); } }, env || {}) });
  w.sleeps = sleeps; w.t = w.mod.__test;
  await w.call('GET', '/social/limits', null, 'read-key');     // a first request hands the limiter its environment
  w.outbound.length = 0;
  return w;
};
const hits = (w, re) => w.outbound.filter(o => re.test(o.url));
const arc = (w, kind, where) => w.env.MIND_DB.db.prepare('SELECT * FROM arc_items WHERE kind=?' + (where ? ' AND ' + where : '') + ' ORDER BY id').all(kind).map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const thrown = async fn => { try { await fn(); return null; } catch (e) { return e; } };
/** answers in order, the last one repeated */
const seq = (w, re, list) => { let i = 0; w.answer(re, (u, init) => { const f = list[Math.min(i, list.length - 1)]; i++; return f(u, init); }); };

await S.t('CH1 a 5xx is asked once more, after a backoff', async () => {
  const w = await mk(); seq(w, /one\.example/, [() => T('bad gateway', 502), () => J({ fine: 1 })]);
  const r = await w.t.cfetch('https://one.example/a'); eq([r.status, r.cfTries], [200, 2]);
  eq(hits(w, /one\.example/).length, 2); ok(w.sleeps.length === 1 && w.sleeps[0] >= 500 && w.sleeps[0] <= 750, 'a backoff with jitter: ' + w.sleeps);
  w.restore();
});

await S.t('CH2 once only', async () => {
  const w = await mk(); w.answer(/two\.example/, () => T('down', 503));
  const r = await w.t.cfetch('https://two.example/a'); eq([r.status, r.cfTries], [503, 2]); eq(hits(w, /two\.example/).length, 2);
  w.answer(/drop\.example/, () => { throw new TypeError('fetch failed'); });
  const e = await thrown(() => w.t.cfetch('https://drop.example/a')); ok(e && /fetch failed/.test(e.message) && e.tries === 2, 'thrown after two tries: ' + (e && e.message));
  eq(hits(w, /drop\.example/).length, 2);
  w.restore();
});

await S.t('CH3 a POST is never asked twice', async () => {
  const w = await mk(); w.answer(/post\.example/, () => T('down', 500));
  const r = await w.t.cfetch('https://post.example/a', { method: 'POST', body: 'x' }); eq(r.status, 500); eq(hits(w, /post\.example/).length, 1); eq(w.sleeps.length, 0);
  w.restore();
});

await S.t('CH4 every request has a timeout', async () => {
  const w = await mk(); let sig = null; const keep = setInterval(() => {}, 20);   // AbortSignal.timeout's own timer does not hold a Node process open
  w.answer(/plain\.example/, (u, init) => { sig = init && init.signal; return J({}); });
  await w.t.cfetch('https://plain.example/a', { headers: { 'User-Agent': 'x' } }); ok(sig && typeof sig.aborted === 'boolean', 'a request sent with no signal is given one');
  const hang = (u, init) => new Promise((res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }))));
  w.answer(/hang\.example/, hang);
  const t0 = Date.now(); const e = await thrown(() => w.t.cfetch('https://hang.example/a', {}, { ms: 40, retryTimeout: false }));
  ok(e && /timeout/i.test(e.name + e.message), 'it timed out'); ok(Date.now() - t0 < 2000, 'and soon'); eq(hits(w, /hang\.example/).length, 1, 'a timeout is not asked again when the caller says so');
  const f = await w.t.srcFetch('https://hang.example/feed', null, 40); eq([f.ok, f.status], [false, 0]); ok(/timed out/.test(f.error), f.error);
  clearInterval(keep); w.restore();
});

await S.t('CH5 Retry-After', async () => {
  const w = await mk(); seq(w, /short\.example/, [() => T('slow down', 429, { 'Retry-After': '2' }), () => J({ fine: 1 })]);
  const r = await w.t.cfetch('https://short.example/a'); eq(r.status, 200); ok(w.sleeps.length === 1 && w.sleeps[0] >= 2000 && w.sleeps[0] < 2300, 'waited what it was told: ' + w.sleeps);
  w.answer(/long\.example/, () => T('slow down', 429, { 'Retry-After': '600' }));
  const r2 = await w.t.cfetch('https://long.example/a'); eq(r2.status, 429); eq(hits(w, /long\.example/).length, 1, 'ten minutes is not waited inside a request');
  const e = await thrown(() => w.t.cfetch('https://long.example/b')); ok(e && e.code === 'rate_limited' && /not asked again until/.test(e.message), 'the next ask is refused here: ' + (e && e.message));
  eq(hits(w, /long\.example/).length, 1, 'and reaches nobody');
  const lim = await w.call('GET', '/social/limits', null, 'read-key'); eq(lim.status, 200);
  const row = lim.body.limits.find(l => l.key === 'long.example'); ok(row && row.secondsLeft > 590 && /Retry-After 600s/.test(row.why), JSON.stringify(lim.body.limits));
  const date = new Date(Date.now() + 90000).toUTCString(); ok(Math.abs(w.t.cfRetryAfter(date, Date.now()) - 90) < 2, 'an HTTP date is read too');
  w.restore();
});

await S.t('CH6 the rate headers of Reddit, Bluesky and Mastodon', async () => {
  const w = await mk(); const now = Date.now();
  w.answer(/r\.example/, () => J({}, 200, { 'x-ratelimit-remaining': '0.0', 'x-ratelimit-reset': '120' }));
  w.answer(/b\.example/, () => J({}, 200, { 'ratelimit-remaining': '0', 'ratelimit-reset': String(Math.round(now / 1000) + 200) }));
  w.answer(/m\.example/, () => J({}, 200, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': new Date(now + 300000).toISOString() }));
  w.answer(/fine\.example/, () => J({}, 200, { 'x-ratelimit-remaining': '55', 'x-ratelimit-reset': '120' }));
  for (const h of ['r', 'b', 'm', 'fine']) eq((await w.t.cfetch('https://' + h + '.example/a')).status, 200);
  const L = w.t.cfLimits().limits; const left = k => (L.find(l => l.key === k) || {}).secondsLeft || 0;
  ok(left('r.example') > 110 && left('r.example') <= 120, 'seconds: ' + left('r.example')); ok(left('b.example') > 190 && left('b.example') <= 201, 'an epoch: ' + left('b.example')); ok(left('m.example') > 290 && left('m.example') <= 300, 'a date: ' + left('m.example'));
  ok(!L.some(l => l.key === 'fine.example'), 'an allowance with room is not a limit');
  ok(await thrown(() => w.t.cfetch('https://r.example/b')), 'a used-up allowance is not asked again before it is back'); eq(hits(w, /r\.example/).length, 1);
  w.restore();
});

await S.t('CH7 Meta usage headers', async () => {
  const w = await mk();
  w.answer(/graph\.facebook\.com\/v21\.0\/111\//, () => J({ data: [] }, 200, { 'X-Business-Use-Case-Usage': JSON.stringify({ 111: [{ type: 'pages', call_count: 100, total_cputime: 20, total_time: 20, estimated_time_to_regain_access: 12 }] }) }));
  w.answer(/graph\.facebook\.com\/v21\.0\/222\//, () => J({ data: [] }, 200, { 'X-App-Usage': JSON.stringify({ call_count: 40, total_cputime: 10, total_time: 10 }) }));
  await w.t.metaGet('https://graph.facebook.com/v21.0/111/posts?access_token=SECRET');
  const e = await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/111/posts?limit=5&access_token=SECRET'));
  ok(e && e.code === 'rate_limited' && /about 12 min/.test(e.message), 'the throttled object is not asked again: ' + (e && e.message)); ok(!/SECRET/.test(e.message), 'and the token is not in the message');
  eq(hits(w, /\/111\//).length, 1);
  await w.t.metaGet('https://graph.facebook.com/v21.0/222/posts?access_token=SECRET'); eq(hits(w, /\/222\//).length, 1, 'another object is still read');
  ok(w.kv.has('rl_graph.facebook.com'), 'the limit is shared through KV');
  const w2 = await mk(); w2.answer(/graph\.facebook\.com/, () => J({ data: [] }, 200, { 'X-App-Usage': JSON.stringify({ call_count: 96, total_cputime: 10, total_time: 10 }) }));
  await w2.t.metaGet('https://graph.facebook.com/v21.0/333/posts?access_token=S'); const e2 = await thrown(() => w2.t.metaGet('https://graph.facebook.com/v21.0/444/posts?access_token=S'));
  ok(e2 && /96% of its Graph API allowance/.test(e2.message), 'the whole app pauses before Meta stops it: ' + (e2 && e2.message)); eq(w2.outbound.length, 1);
  w.restore();
});

await S.t('CH8 the Graph reader', async () => {
  const w = await mk(); w.answer(/graph\.facebook\.com\/v21\.0\/gw/, () => T('<html>502 Bad Gateway</html>', 502));
  const e = await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/gw?access_token=S')); ok(e && /^meta_http_502/.test(e.message) && /asked 2 times/.test(e.message), 'a gateway page is a failure, not an empty success: ' + (e && e.message));
  w.answer(/\/v21\.0\/tok/, () => J({ error: { message: 'Error validating access token: Session has expired', type: 'OAuthException', code: 190 } }, 400));
  const e2 = await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/tok?access_token=S')); ok(e2 && e2.code === 'meta_token_invalid' && /issue a new one/.test(e2.message), e2 && e2.message); eq(hits(w, /\/tok/).length, 1, 'a refused token is not asked again');
  w.answer(/\/v21\.0\/98765\//, () => J({ error: { message: '(#32) Page request limit reached', code: 32 } }, 400));
  const e3 = await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/98765/posts?access_token=S')); ok(e3 && /^meta_rate_limited/.test(e3.message), e3 && e3.message);
  ok(await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/98765/posts?access_token=S'))); eq(hits(w, /\/98765\//).length, 1, 'a throttle named in the body is recorded like one named in a header');
  w.answer(/\/v21\.0\/perm/, () => J({ error: { message: '(#10) This endpoint requires the Page Public Content Access feature', code: 10 } }, 400));
  const e4 = await thrown(() => w.t.metaGet('https://graph.facebook.com/v21.0/perm?access_token=S')); ok(e4 && /Page Public Content Access/.test(e4.message) && /\(code 10\)/.test(e4.message), 'Meta\'s own words are kept for the permission reader: ' + (e4 && e4.message));
  w.restore();
});

await S.t('CH9 Reddit on a 401', async () => {
  const w = await mk({ REDDIT_CLIENT_ID: 'id', REDDIT_CLIENT_SECRET: 'sec' }); let n = 0;
  w.answer(/reddit\.com\/api\/v1\/access_token/, () => { n++; return J({ access_token: 'tok' + n, expires_in: 3600 }); });
  const seen = []; w.answer(/oauth\.reddit\.com/, (u, init) => { const a = init.headers.Authorization; seen.push(a); return a === 'Bearer tok1' ? T('', 401) : J({ data: { children: [] } }); });
  const d = await w.t.redditGet(w.env, '/r/australia/hot?limit=5'); ok(d && d.data, 'the listing came back'); eq(seen, ['Bearer tok1', 'Bearer tok2']); eq(n, 2);
  eq(w.kv.get('reddit_token'), 'tok2', 'the new token is the one kept');
  const w2 = await mk({ REDDIT_CLIENT_ID: 'id', REDDIT_CLIENT_SECRET: 'sec' });
  w2.answer(/access_token/, () => J({ access_token: 't', expires_in: 3600 })); w2.answer(/oauth\.reddit\.com/, () => T('', 401));
  const e = await thrown(() => w2.t.redditGet(w2.env, '/r/australia/hot')); ok(e && /^reddit_oauth_401/.test(e.message), e && e.message); eq(hits(w2, /oauth\.reddit\.com/).length, 2, 'two asks, never a third');
  w.restore();
});

await S.t('CH10 pagination says when it stopped short', async () => {
  const w = await mk({ META_TOKEN: 'S', META_AD_ACCOUNTS: 'act_555:mca' }); let page = 0;
  w.answer(/act_555\/insights|insights-next/, () => { page++; return J({ data: [{ campaign_id: 'c' + page, campaign_name: 'C', date_start: '2026-11-0' + (1 + page % 9), spend: '1' }], paging: { next: 'https://graph.facebook.com/v21.0/insights-next?p=' + page + '&access_token=S' } }); });
  const r = await w.t.metaInsights(w.env); eq(page, 20); ok(r.capped && /stopped after 20 pages/.test(r.capped[0]), JSON.stringify(r.capped));
  w.answer(/act_555\/ads/, () => J({ data: [{ id: 'a1', name: 'Ad one', creative: { effective_object_story_id: '9_1' } }] }));
  w.answer(/\/9_1\/comments/, () => J({ data: [{ id: 'k1', message: 'well said', created_time: '2026-11-10T00:00:00+0000' }], paging: { next: 'https://graph.facebook.com/v21.0/more?access_token=S' } }));
  const c = await w.t.metaComments(w.env); ok(c.capped && /newest 100 comments were read and the post has more/.test(c.capped.join(' ')), JSON.stringify(c));
  const w2 = await mk(); w2.answer(/searchPosts/, () => J({ posts: [], cursor: 'abc' }));
  const b = await w2.t.bskySweep(w2.env, { queries: ['fuel tax credit'], threads: 0 }); ok(b.capped && /Bluesky had more/.test(b.capped[0]), JSON.stringify(b));
  w.restore();
});

await S.t('CH11 our own Pages: counts, comments, the daily snapshot, Instagram, nobody named', async () => {
  const w = await mk({ META_TOKEN: 'S', META_PAGES: '700:mca' }); let likes = 10;
  const post = () => ({ id: '700_1', message: 'The fuel tax credit keeps regional jobs', created_time: '2026-11-10T01:00:00+0000', permalink_url: 'https://www.facebook.com/700/posts/1', shares: { count: 4 },
    reactions: { summary: { total_count: likes + 3 } }, r_like: { summary: { total_count: likes } }, r_angry: { summary: { total_count: 3 } },
    comments: { summary: { total_count: 5 }, data: [{ id: 'c1', message: 'spot on', created_time: '2026-11-10T02:00:00+0000', like_count: 2, from: { name: 'A Person' } }], paging: { next: 'https://graph.facebook.com/v21.0/700_1/comments?after=x&access_token=S' } } });
  w.answer(/\/v21\.0\/700\/posts/, () => J({ data: [post()], paging: { next: 'https://graph.facebook.com/v21.0/700/posts?after=p2&access_token=S' } }));
  w.answer(/\/700\/posts\?after=p2/, () => J({ data: [], paging: { next: 'https://graph.facebook.com/v21.0/700/posts?after=p3&access_token=S' } }));
  w.answer(/\/700_1\/comments\?after=x/, () => J({ data: [{ id: 'c2', message: 'what a rort', created_time: '2026-11-10T03:00:00+0000' }] }));
  w.answer(/\/v21\.0\/700\?fields=instagram_business_account/, () => J({ instagram_business_account: { id: '900' }, id: '700' }));
  w.answer(/\/v21\.0\/900\/media/, () => J({ data: [{ id: 'm1', caption: 'Critical minerals week', media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/abc/', timestamp: '2026-11-09T01:00:00+0000', like_count: 21, comments_count: 1, comments: { data: [{ id: 'ic1', text: 'great', timestamp: '2026-11-09T02:00:00+0000', username: 'someone' }] } }] }));
  const r = await w.t.metaOrganicSweep(w.env, {}); eq([r.ok, r.threads, r.comments, r.instagram.threads, r.instagram.comments], [true, 1, 2, 1, 1], JSON.stringify(r).slice(0, 400));
  ok(r.capped && r.capped.some(c => /700_1: 2 of 5 comments read/.test(c)) && r.capped.some(c => /page 700: 1 posts read and the Page had more/.test(c)), 'the caps are said: ' + JSON.stringify(r.capped));
  const asked = hits(w, /\/700\/posts/)[0].url; ok(!/from|username/.test(decodeURIComponent(asked).split('access_token')[0]), 'no name is asked for');
  let t = arc(w, 'sig_thread'); const fb = t.find(x => x.src === 'meta'), ig = t.find(x => x.src === 'instagram');
  eq(fb.meta.eng, { likes: 13, reposts: 4, replies: 5, quotes: 0, views: 0 }); eq([fb.meta.reactions.like, fb.meta.reactions.angry, fb.meta.ns], [10, 3, 'mca']);
  eq([ig.meta.eng.likes, ig.meta.eng.replies, ig.url], [21, 1, 'https://www.instagram.com/p/abc/']);
  const cm = arc(w, 'sig_comment'); eq(cm.length, 3); ok(cm.every(c => !c.author) && !/A Person|someone/.test(JSON.stringify(cm)), 'nobody is named');
  eq(arc(w, 'sig_eng').length, 2, 'a snapshot for each post');
  likes = 50; const r2 = await w.t.metaOrganicSweep(w.env, {}); eq([r2.threadRows, r2.updated], [0, 2]);
  t = arc(w, 'sig_thread'); eq(t.length, 2, 'no second row'); eq(t.find(x => x.src === 'meta').meta.eng.likes, 53, 'a later run refreshes the counts');
  eq(arc(w, 'sig_eng').length, 2, 'one snapshot a post a day'); eq(arc(w, 'sig_eng').find(x => x.src === 'meta').meta.eng.likes, 53);
  w.restore();
});

await S.t('CH12 LinkedIn', async () => {
  eq((await mk()).t.liVersion({}, Date.UTC(2026, 10, 12)), '202608'); eq((await mk()).t.liVersion({}, Date.UTC(2027, 0, 5)), '202610'); eq((await mk()).t.liVersion({ LINKEDIN_VERSION: '202611' }), '202611');
  const org = 'urn:li:organization:42'; const w = await mk({ LINKEDIN_TOKEN: 'old', LINKEDIN_ORGS: org + ':mca' }); let ver = '';
  w.answer(/api\.linkedin\.com\/rest\/posts/, (u, init) => { ver = init.headers['LinkedIn-Version']; return J({ elements: [{ id: 'urn:li:ugcPost:1', commentary: 'Mining and resources: a statement', createdAt: 1762900000000 }, { id: 'urn:li:share:2', commentary: 'Second', createdAt: 1762900000001 }], paging: { start: 0, count: 2, total: 9 } }); });
  w.answer(/organizationalEntityShareStatistics/, u => /ugcPosts=List/.test(u) ? J({ elements: [{ ugcPost: 'urn:li:ugcPost:1', totalShareStatistics: { likeCount: 7, commentCount: 3, shareCount: 2, impressionCount: 900, clickCount: 40 } }] }) : J({ elements: [] }));
  w.answer(/socialActions/, u => /ugcPost/.test(decodeURIComponent(u)) ? J({ elements: [{ id: 'c1', message: { text: 'Agree' }, actor: 'urn:li:person:zzz', created: { time: 1762900001000 } }], paging: { total: 80 } }) : J({ elements: [] }));
  const r = await w.t.linkedinSweep(w.env, { posts: 2, commentsPer: 5 }); eq([r.ok, r.threads, r.withCounts, r.comments], [true, 2, 1, 1], JSON.stringify(r).slice(0, 400));
  ok(/^20\d{4}$/.test(ver) && ver !== '202409', 'a version that is still served: ' + ver);
  ok(r.capped && r.capped.some(c => /2 posts read and LinkedIn had more/.test(c)) && r.capped.some(c => /1 of 80 comments read/.test(c)), JSON.stringify(r.capped));
  const t = arc(w, 'sig_thread').find(x => /ugcPost:1/.test(x.url)); eq(t.meta.eng, { likes: 7, reposts: 2, replies: 3, quotes: 0, views: 900 }); eq(t.meta.stats.clicks, 40);
  ok(!/urn:li:person/.test(JSON.stringify(arc(w, 'sig_comment'))), 'the commenter is not kept');
  const w2 = await mk({ LINKEDIN_TOKEN: 'old', LINKEDIN_ORGS: org + ':mca' }); w2.answer(/api\.linkedin\.com/, () => J({ message: 'expired' }, 401));
  const r2 = await w2.t.linkedinSweep(w2.env, {}); ok(!r2.ok && /linkedin_token_invalid/.test(r2.detail) && /LINKEDIN_REFRESH_TOKEN/.test(r2.detail), r2.detail); eq(hits(w2, /api\.linkedin\.com/).length, 1);
  const w3 = await mk({ LINKEDIN_TOKEN: 'old', LINKEDIN_ORGS: org + ':mca', LINKEDIN_REFRESH_TOKEN: 'rt', LINKEDIN_CLIENT_ID: 'id', LINKEDIN_CLIENT_SECRET: 'cs' });
  w3.answer(/linkedin\.com\/oauth\/v2\/accessToken/, () => J({ access_token: 'new', expires_in: 5000 }));
  w3.answer(/api\.linkedin\.com/, (u, init) => init.headers.Authorization === 'Bearer new' ? J({ elements: [] }) : J({ message: 'expired' }, 401));
  const r3 = await w3.t.linkedinSweep(w3.env, {}); eq([r3.ok, r3.errors.length], [true, 0], JSON.stringify(r3)); eq(w3.kv.get('li_token'), 'new'); eq(hits(w3, /accessToken/).length, 1);
  const w4 = await mk({ LINKEDIN_TOKEN: 't', LINKEDIN_ORGS: org + ':mca' }); w4.answer(/api\.linkedin\.com/, () => J({ code: 'NONEXISTENT_VERSION', message: 'Requested version 202608 is not active' }, 426));
  const r4 = await w4.t.linkedinSweep(w4.env, {}); ok(/linkedin_version/.test(r4.detail) && /LINKEDIN_VERSION/.test(r4.detail), r4.detail);
  w.restore();
});

await S.t('CH13 the public reader', async () => {
  const w = await mk(); w.answer(/pub\.example\/robots\.txt/, () => T('', 404)); seq(w, /pub\.example\/page/, [() => T('oops', 503), () => T('<html><title>Notices</title><p>fine</p></html>')]);
  const f = await w.t.pubFetch(w.env, 'https://pub.example/page'); eq([f.ok, f.status], [true, 200], JSON.stringify(f).slice(0, 200)); eq(hits(w, /pub\.example\/page/).length, 2);
  ok(w.sleeps.filter(s => /^pace:/.test(String(s))).length >= 1, 'the second ask waited the host\'s pace: ' + w.sleeps);
  w.answer(/no\.example\/robots\.txt/, () => T('', 404)); w.answer(/no\.example\/page/, () => T('', 429, { 'Retry-After': '1' }));
  const g = await w.t.pubFetch(w.env, 'https://no.example/page'); eq([g.ok, g.code], [false, 'refused']); eq(hits(w, /no\.example\/page/).length, 1, 'a refusal is never asked again, even with a short Retry-After');
  eq((await w.t.pubFetch(w.env, 'https://no.example/page')).code, 'refused_backoff');
  w.restore();
});

await S.t('CH14 the Source Registry: 500 then 200 delivers', async () => {
  const w = await mk(); const now = new Date().toUTCString();
  seq(w, /feed\.example\/rss/, [() => T('err', 500), () => T('<?xml version="1.0"?><rss><channel><title>f</title><item><title>Senate inquiry into the fuel tax credit scheme reports</title><link>https://feed.example/a1</link><pubDate>' + now + '</pubDate></item></channel></rss>', 200, { 'Content-Type': 'application/rss+xml' })]);
  const a = await w.call('POST', '/sources/add', { id: 'ch_feed', name: 'CH feed', tier: 'sector', urls: { rss: 'https://feed.example/rss' } }, 'full-key'); eq(a.status, 200, a.text.slice(0, 200));
  const s = await w.call('POST', '/sources/sweep', { ids: ['ch_feed'] }, 'full-key'); eq(s.status, 200, s.text.slice(0, 200));
  eq([s.body.results[0].ok, s.body.results[0].method], [true, 'rss'], JSON.stringify(s.body.results[0]).slice(0, 300)); eq(hits(w, /feed\.example\/rss/).length, 2);
  w.restore();
});

await S.t('CH15 no collector calls fetch() directly', async () => {
  const src = fs.readFileSync(new URL('../axiomworkerv4.js', import.meta.url), 'utf8').split('\n');
  // model providers, messaging and task writes, the render service, the redirect-checking reader and the limiter itself
  const allowed = /anthropic|generativelanguage|clickup|twilio|WA_PHONE_ID|RENDER_URL|api\.cloudflare\.com|batchexecute|reddit\.com\/api\/v1\/access_token|Object\.assign\(\{\}, init|method: 'POST'|try \{ r = await fetch\(url, opts\); \}/;
  const bare = []; src.forEach((l, i) => { if (/await fetch\(/.test(l) && !/^\s*\/\//.test(l) && !allowed.test(l) && !/method: 'POST'/.test((src[i + 1] || ''))) bare.push((i + 1) + ': ' + l.trim().slice(0, 90)); });
  eq(bare, [], 'these should go through cfetch()');
});

await S.t('CH16 the Federal Register of Legislation: titles on a client issue, the cap said', async () => {
  // the field names are the ones the live API answered with on 12 November 2026; the titles are invented
  const w = await mk(); const at = new Date(Date.now() - 3600000).toISOString().slice(0, 19);
  w.answer(/legislation\.gov\.au\/robots\.txt/, () => T('', 404));
  let asked = '';
  w.answer(/api\.prod\.legislation\.gov\.au\/v1\/titles/, u => { asked = u; return J({ value: [
    { id: 'F2026L09001', name: 'Fuel Tax Credit (Heavy Vehicles) Amendment Determination 2026', makingDate: at, asMadeRegisteredAt: at, collection: 'LegislativeInstrument', status: 'InForce' },
    { id: 'F2026N09002', name: 'Notice of Disqualification - A Person - 12 November 2026', makingDate: at, asMadeRegisteredAt: at, collection: 'NotifiableInstrument', status: 'InForce' }] }); });
  const a = await w.call('POST', '/sources/add', { id: 'ch_frl', name: 'FRL (test)', tier: 'official', urls: { official: 'frl' } }, 'full-key'); eq(a.status, 200, a.text.slice(0, 200));
  const s = await w.call('POST', '/sources/sweep', { ids: ['ch_frl'] }, 'full-key'); eq([s.body.results[0].ok, s.body.results[0].method], [true, 'official'], JSON.stringify(s.body.results[0]).slice(0, 300));
  ok(/orderby=asMadeRegisteredAt%20desc/.test(asked) && /top=200/.test(asked), asked);
  const rows = arc(w, 'news', "src='ch_frl'"); eq(rows.map(r => r.url), ['https://www.legislation.gov.au/F2026L09001'], 'only the title on a client issue is kept');
  eq([rows[0].meta.method, rows[0].meta.outlet, rows[0].meta.issues.indexOf('ftc') >= 0], ['official', 'Federal Register of Legislation', true]);
  const full = []; for (let i = 0; i < 200; i++) full.push({ id: 'F2026L1' + String(i).padStart(4, '0'), name: 'Instrument ' + i, asMadeRegisteredAt: at, collection: 'LegislativeInstrument', status: 'InForce' });
  w.answer(/api\.prod\.legislation\.gov\.au\/v1\/titles/, () => J({ value: full }));
  const r = await w.t.srcOfficial(w.env, { id: 'ch_frl', urls: { official: 'frl' }, schedule: 180 }); ok(r.ok && r.quiet && /newest 200 titles were read and more were registered/.test(r.capped), JSON.stringify(r).slice(0, 300));
  w.answer(/api\.prod\.legislation\.gov\.au\/v1\/titles/, () => T('<html>maintenance</html>'));
  const bad = await w.t.srcOfficial(w.env, { id: 'ch_frl', urls: { official: 'frl' } }); ok(!bad.ok && /did not answer with a list of titles/.test(bad.detail), 'a page in place of the list is a failure by name: ' + bad.detail);
  const no = await w.call('POST', '/sources/add', { id: 'ch_bad', name: 'x', tier: 'official', urls: { official: 'https://evil.example/' } }, 'full-key'); ok(no.status !== 200 || !((no.body.source || {}).urls || {}).official, 'only a named dataset is accepted');
  w.restore();
});

await S.t('CH17 AusTender: contract notices on a client issue, nobody named, the next page followed and the cap said', async () => {
  // the record shape is the one the live feed answered with on 12 November 2026; the contracts are invented
  const w = await mk(); const at = new Date(Date.now() - 7200000).toISOString().slice(0, 19) + 'Z';
  const rel = (cn, what) => ({ ocid: 'prod-' + cn, date: at, parties: [{ name: 'ACME CONSULTING PTY LTD', roles: ['supplier'], contactPoint: { name: 'Jo Citizen', email: 'jo@agency.example' } }, { name: 'Department of Example', roles: ['procuringEntity'], contactPoint: { name: 'Sam Officer' } }],
    awards: [{ suppliers: [{ name: 'ACME CONSULTING PTY LTD' }] }], contracts: [{ id: cn, description: what, dateSigned: at, value: { currency: 'AUD', amount: 120000.4 } }] });
  w.answer(/api\.tenders\.gov\.au\/robots\.txt/, () => J({ message: 'Missing Authentication Token' }, 403));
  const urls = [];
  w.answer(/api\.tenders\.gov\.au\/ocds\//, u => { urls.push(u); return /page=2/.test(u)
    ? J({ releases: [rel('CN9000003', 'Office furniture')], links: { next: 'https://api.tenders.gov.au/ocds/findByDates/contractPublished/x/y?page=3' } })
    : J({ releases: [rel('CN9000001', 'Research into community pharmacy dispensing fees'), rel('CN9000002', 'Stationery')], links: { next: 'https://api.tenders.gov.au/ocds/findByDates/contractPublished/x/y?page=2' } }); });
  const r = await w.t.srcOfficial(w.env, { id: 'ch_cn', urls: { official: 'austender' } });
  eq([r.ok, r.read, r.items.length], [true, 3, 1], JSON.stringify(r).slice(0, 400)); ok(/3 notices were read \(2 pages\) and AusTender had more/.test(r.capped), r.capped);
  ok(/contractPublished\/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(urls[0]), 'the last day, in the form the feed takes: ' + urls[0]); eq(urls.length, 2, 'two pages and no more');
  const it = r.items[0]; ok(/community pharmacy/.test(it.title) && / - Department of Example$/.test(it.title) && /CN9000001/.test(it.link) && /supplier ACME CONSULTING/.test(it.desc) && /AUD 120,000/.test(it.desc), JSON.stringify(it));
  ok(!/Jo Citizen|Sam Officer|agency\.example/.test(JSON.stringify(r)), 'a contact person is never read');
  ok(w.sleeps.some(x => /^pace:/.test(String(x))), 'the second page waited the host\'s pace');
  w.restore();
});

await S.t('CH18 a source held by a rate limit is not a failed source, and a public site is held fifteen minutes at most', async () => {
  const w = await mk(); const src = id => w.env.MIND_DB.db.prepare('SELECT * FROM sources WHERE id=?').get(id);
  w.answer(/busy\.example/, () => T('slow down', 429, { 'Retry-After': '86400' }));
  for (const id of ['ch_h1', 'ch_h2', 'ch_h3']) eq((await w.call('POST', '/sources/add', { id, name: id, tier: 'sector', urls: { rss: 'https://busy.example/' + id + '.xml' } }, 'full-key')).status, 200);
  const a = await w.t.sourceSweep(w.env, { ids: ['ch_h1'] }); eq([a.failed, a.held], [1, 0], 'the one that met the 429 failed: ' + JSON.stringify(a.results));
  const lim = w.t.cfLimits().limits.find(l => l.key === 'busy.example'); ok(lim && lim.secondsLeft <= w.t.CF_LIMIT_PUBLIC_MAX_S && lim.secondsLeft > 800, 'a day asked for, fifteen minutes held: ' + JSON.stringify(lim));
  const before = w.outbound.length; const b = await w.t.sourceSweep(w.env, { ids: ['ch_h2', 'ch_h3'] });
  eq([b.failed, b.held, b.succeeded], [0, 2, 0], JSON.stringify(b.results)); eq(w.outbound.length, before, 'nothing was sent to the host while it is held');
  const h2 = src('ch_h2'); eq(h2.fails || 0, 0, 'no failure is counted, so a held source never walks toward dead'); ok(/^held: /.test(h2.last_error) && /rate_limited/.test(h2.last_error), h2.last_error);
  ok(h2.next_due - Date.now() <= w.t.CF_LIMIT_PUBLIC_MAX_S * 1000 + 1000 && h2.next_due > Date.now(), 'and it comes round again when the hold has passed');
  eq(src('ch_h1').fails, 1, 'the source that was really refused does count');
  const c = (await w.call('GET', '/social/limits', null, 'read-key')).body.counts.find(x => x.key === 'busy.example'); eq([c.hits, c.held], [1, 2], 'how often a limit bites is counted: ' + JSON.stringify(c));
  w.restore();
});

await S.t('CH19 a registry sweep spends a fixed number of second asks, and says how many', async () => {
  const w = await mk(); const n = w.t.SOURCE_RETRY_BUDGET + 6; const ids = [];
  w.answer(/down\d+\.example/, () => T('err', 500));
  for (let i = 0; i < n; i++) { ids.push('ch_d' + i); eq((await w.call('POST', '/sources/add', { id: 'ch_d' + i, name: 'd' + i, tier: 'sector', urls: { rss: 'https://down' + i + '.example/feed.xml' } }, 'full-key')).status, 200); }
  w.outbound.length = 0; const r = await w.t.sourceSweep(w.env, { ids });
  eq([r.ran, r.failed, r.retries], [n, n, w.t.SOURCE_RETRY_BUDGET], 'every source failed; the budget was spent and no more');
  eq(hits(w, /down\d+\.example\/feed/).length, n + w.t.SOURCE_RETRY_BUDGET, 'one ask a source, plus the budget of second asks');
  w.answer(/later\.example/, (() => { let i = 0; return () => (i++ ? T('<?xml version="1.0"?><rss><channel><title>f</title></channel></rss>', 200, { 'Content-Type': 'application/rss+xml' }) : T('err', 502)); })());
  const f = await w.t.srcFetch('https://later.example/feed.xml'); eq([f.ok, hits(w, /later\.example/).length], [true, 2], 'outside a sweep the one retry is back');
  w.restore();
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
