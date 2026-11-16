/* A wider collection net for Anne's Den (release build p67, 16 November 2026), against the worker module in this process.
 * No site is contacted: every feed, index and AppView answer below is an invented stand-in served by the recording fetch,
 * and every outlet, account and post is invented. Functions are called directly through __test; the cron entry
 * (handler.scheduled) is never run. Each case fails on p66.
 *   DW1 a core-feed headline on a client issue becomes a Board card: the issues, the feed and the outlet ride on the row
 *       (a Google News sweep's outlet moves off the headline); it is never marked as a registry row
 *   DW2 a core-feed headline on no client issue is archived with no issue and is no desk's card
 *   DW3 the core feeds are archived before the snapshot's cut: registry rows crowding the newest 120 no longer push the
 *       core items out of the archive
 *   DW4 the back-fill: untagged news of the last week is tagged once, newest first, a bounded number a tick; nothing is
 *       written twice; a term a person approves on a desk re-tags what the worker tagged before
 *   DW5 Bluesky search asks api.bsky.app first and falls back to the public host on 403, and the run records which host
 *       answered; threads stay on the public host
 *   DW6 the tick's Bluesky terms: every desk-owned term first, then ten of the rest in turn
 *   DW7 the tick is measured: per-stage milliseconds land in KV tick_last, and /den/collection returns it with the
 *       analysis pipeline's counts (additive: every field the page already reads is unchanged)
 *   DW8 a desk's registered X accounts are read every run; only the rest of the list rotates
 *   DW9 Google News by issue: one OR-query an issue, the desks' issues first, inside the lexicon run (the per-term
 *       rotation stays as the deep pass)
 *   DW10 the seed gains the addresses that answered when probed (a Lemmy community, two publishers' own feeds); no id
 *        twice, and an outlet held only through Google News gains its own feed ahead of it
 * Run: node --experimental-sqlite tests/den-widen-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('A wider net for the Den: core news on the Board, Bluesky search, desk terms first, the tick measured');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const H = 3600000, D = 86400000, NOW = Date.now();
const mk = async env => { const w = await workerEnv({ env: Object.assign({}, env || {}), keys: KEYS }); w.t = w.mod.__test; w.db = w.env.MIND_DB.db; await w.call('GET', '/den/desks', null, 'read-key'); await w.t.archiveIndexEnsure(w.env, { force: true }); return w; };
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
const T = (body, status, type) => new Response(body, { status: status || 200, headers: { 'Content-Type': type || 'application/rss+xml' } });
const arc = (w, where, ...a) => w.db.prepare('SELECT * FROM arc_items WHERE ' + where + ' ORDER BY id').all(...a).map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const board = async (w, desk) => (await F(w, 'GET', '/den/board?desk=' + desk, null, 'read-key')).body;
const iso = ago => new Date(NOW - ago).toISOString();
const rss = items => '<?xml version="1.0"?><rss><channel><title>t</title>' + items.map(i => '<item><title>' + i.t + '</title><link>' + i.l + '</link><pubDate>' + new Date(NOW - (i.ago || H)).toUTCString() + '</pubDate><description>' + (i.d || '') + '</description></item>').join('') + '</channel></rss>';
let seq = 0;
const put = (w, kind, src, title, body, meta, ago) => { const url = 'https://example.test/' + kind + '/' + (++seq); w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)").run(kind, src, title, body, url, meta == null ? null : JSON.stringify(meta), NOW - ago, NOW - ago); return w.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };
const snap = items => JSON.stringify({ items: items.map(i => Object.assign({ date: iso(i.ago || 2 * H), desc: '' }, i)) });

await S.t('DW1 a core-feed headline on a client issue becomes a Board card', async () => {
  const w = await mk();
  const n = await w.t.arcNewsSnap(w.env, snap([
    { src: 'abc', title: 'Crossbench forces a vote on a gas export tax', link: 'https://www.abc.net.au/news/gas-export-tax-vote', desc: 'The Senate will vote this week.', parties: ['Greens'] },
    { src: 'gnews_fueltax', title: 'Fuel tax credit fight returns to the Senate - The Regional Daily', link: 'https://news.google.com/rss/articles/ftc1', desc: '' },
  ]));
  eq(n, 2, 'both archived');
  const [a, g] = arc(w, "kind='news'");
  ok(a.meta.issues.indexOf('gastax') >= 0, 'the issue is on the row: ' + JSON.stringify(a.meta)); eq([a.meta.source, a.meta.outlet, a.meta.reg], ['abc', 'ABC News', undefined], 'the feed and its name; never a registry row');
  eq(a.meta.parties, ['Greens'], 'what the row carried before stays');
  eq([g.title, g.meta.outlet, g.meta.source], ['Fuel tax credit fight returns to the Senate', 'The Regional Daily', 'gnews_fueltax'], 'a Google News sweep: the outlet moves off the headline'); ok(g.meta.issues.indexOf('ftc') >= 0);
  const b = await board(w, 'aep_au'); const card = b.media.find(m => /gas export tax/.test(m.title)); ok(card, 'a card on the gas desk: ' + JSON.stringify(b.media.map(m => m.title)));
  eq(card.outlet, 'ABC News', 'the card names the outlet, not the feed key');
  const m = await board(w, 'mca_au'); const fc = m.media.find(x => /Fuel tax credit/.test(x.title)); ok(fc && fc.outlet === 'The Regional Daily', 'the fuel tax desk carries the sweep row, under its outlet: ' + JSON.stringify(m.media));
  // the registry merge in buildAllNews reads only reg=1 rows back: a core row must never be read back as one
  eq(w.db.prepare("SELECT COUNT(*) n FROM arc_items WHERE kind='news' AND json_extract(meta,'$.reg')=1").get().n, 0);
});

await S.t('DW2 a core-feed headline on no client issue is no desk\'s card', async () => {
  const w = await mk();
  await w.t.arcNewsSnap(w.env, snap([{ src: 'abc', title: 'Local bakery wins a ribbon at the show', link: 'https://www.abc.net.au/news/bakery' }]));
  const [r] = arc(w, "kind='news'"); eq(r.meta.issues, [], 'tagged, with nothing: the back-fill will not ask again'); eq(r.meta.source, 'abc');
  for (const d of ['aep_au', 'mca_au', 'guns_au']) { const b = await board(w, d); ok(!b.media.some(m => /bakery/.test(m.title)), d + ' does not carry it'); }
});

await S.t('DW3 the core feeds are archived before the snapshot\'s cut', async () => {
  const w = await mk();
  // the registry has 200 newer rows: in the 120-item snapshot they push every core item out
  for (let i = 0; i < 200; i++) put(w, 'news', 'reg_src_' + (i % 7), 'Registry headline number ' + i + ' on the gas export tax', '', { reg: 1, issues: ['gastax'], source: 'reg_src_' + (i % 7) }, 10 * 60000 + i * 1000);
  const items = Array.from({ length: 30 }, (_, i) => ({ t: 'Minister answers on the gas export tax, part ' + i, l: 'https://www.pm.gov.au/media/gas-' + i, ago: 3 * H + i * 60000, d: 'Statement.' }));
  w.answer(/^https:\/\/www\.pm\.gov\.au\/rss\.xml$/, () => T(rss(items)));
  const r = await w.t.coreNewsTick(w.env);
  ok(r && r.archived >= 30, 'every core item of the window offered to the archive: ' + JSON.stringify(r));
  const s = JSON.parse(r.snap); ok(!s.items.some(i => i.src === 'pmo'), 'the snapshot itself is still the newest 120 (the registry rows won)');
  const held = arc(w, "kind='news' AND src='pmo'"); eq(held.length, 30, 'yet all thirty core items are held');
  ok(held.every(h => h.meta.issues.indexOf('gastax') >= 0 && h.meta.source === 'pmo' && !h.meta.reg), JSON.stringify(held[0].meta));
  const again = await w.t.coreNewsTick(w.env); eq(arc(w, "kind='news' AND src='pmo'").length, 30, 'the next tick adds no copy'); ok(again.archived >= 0);
});

await S.t('DW4 the back-fill tags untagged news once, newest first, and re-tags after a term is approved', async () => {
  const w = await mk();
  const old = put(w, 'news', 'abc', 'Crossbench forces a vote on a gas export tax', 'The Senate will vote.', { parties: ['Greens'] }, 2 * D);
  const off = put(w, 'news', 'abc', 'Harbour levy splits the council', 'A local fight over a levy.', null, 3 * D);
  const stale = put(w, 'news', 'abc', 'Fuel tax credit debate in the Senate', '', { parties: [] }, 10 * D);
  const reg = put(w, 'news', 'reg1', 'Registry row on the gas export tax', '', { reg: 1, issues: ['gasprojects'] }, 2 * H);
  const first = await w.t.arcTagFill(w.env, { limit: 300 });
  ok(first.tagged >= 2, JSON.stringify(first));
  const meta = id => JSON.parse(w.db.prepare('SELECT meta FROM arc_items WHERE id=?').get(id).meta || '{}');
  ok(meta(old).issues.indexOf('gastax') >= 0, 'the old core row now carries its issue'); eq(meta(old).parties, ['Greens'], 'and keeps what it had');
  eq(meta(off).issues, [], 'a row on no issue is written [] so it is not asked again');
  ok(!('issues' in meta(stale)), 'older than the week: left alone'); eq(meta(reg).issues, ['gasprojects'], 'a row tagged at collection is not re-tagged');
  const b = await board(w, 'aep_au'); ok(b.window && b.media, 'the board reads');
  const second = await w.t.arcTagFill(w.env, { limit: 300 }); eq(second.tagged, 0, 'nothing is written twice: ' + JSON.stringify(second));
  // a person approves a desk term under the gas tax issue: what the worker tagged is read again with it
  const p = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', platform: 'any', value: 'harbour levy', issue: 'gastax' })).body; ok(p.ok, JSON.stringify(p).slice(0, 200));
  await w.t.deskLexiconLoad(w.env, true);
  const third = await w.t.arcTagFill(w.env, { limit: 300 }); ok(third.tagged >= 1, JSON.stringify(third));
  ok(meta(off).issues.indexOf('gastax') >= 0, 'the approved term re-tagged the row: ' + JSON.stringify(meta(off)));
  // bounded: a small limit takes the newest first
  const w2 = await mk(); const ids = Array.from({ length: 5 }, (_, i) => put(w2, 'news', 'abc', 'Gas export tax story ' + i, '', null, (5 - i) * H));   // filed as they were published
  const lim = await w2.t.arcTagFill(w2.env, { limit: 2 }); eq(lim.tagged, 2);
  const m2 = id => JSON.parse(w2.db.prepare('SELECT meta FROM arc_items WHERE id=?').get(id).meta || '{}');
  ok(m2(ids[4]).issues && m2(ids[3]).issues && !m2(ids[0]).issues, 'the two newest first');
  await w2.t.arcTagFill(w2.env, { limit: 2 }); await w2.t.arcTagFill(w2.env, { limit: 2 }); ok(ids.every(id => Array.isArray(m2(id).issues)), 'and the rest on the next ticks');
});

const bpost = (n, text) => ({ uri: 'at://did:plc:a' + n + '/app.bsky.feed.post/3k' + n, cid: 'c', author: { did: 'did:plc:a' + n, handle: 'someone.bsky.social' }, record: { text, createdAt: iso(H), langs: ['en'] }, likeCount: 3, repostCount: 1, replyCount: 0, indexedAt: iso(H) });
await S.t('DW5 Bluesky search asks api.bsky.app first and falls back to the public host on 403', async () => {
  const w = await mk();
  w.answer(/^https:\/\/api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts/, () => J({ error: 'Forbidden', message: 'Forbidden' }, 403));
  w.answer(/^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts/, () => J({ posts: [bpost(1, 'The fuel tax credit fight is on in Canberra #auspol')] }));
  const r = await w.t.bskySweep(w.env, { queries: ['fuel tax credit', 'diesel rebate'], threads: 0 });
  const hosts = w.outbound.filter(o => /searchPosts/.test(o.url)).map(o => new URL(o.url).host);
  eq(hosts[0], 'api.bsky.app', 'the search host is asked first'); ok(hosts.indexOf('public.api.bsky.app') > 0, 'then the public host: ' + hosts.join(','));
  ok(hosts.filter(h => h === 'api.bsky.app').length === 1, 'once refused, the rest of the run asks the public host straight away: ' + hosts.join(','));
  eq([r.ok, r.host, r.fallback > 0], [true, 'public.api.bsky.app', true], JSON.stringify(r).slice(0, 300)); ok(r.threadRows >= 1, 'the posts were filed');
  const sum = w.t.socialSummary(r); eq([sum.host, sum.fallback > 0], ['public.api.bsky.app', true], 'the summary the coverage table shows keeps it');
  // the search host answering: nothing asked of the public host's search
  const w2 = await mk(); w2.answer(/^https:\/\/api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts/, () => J({ posts: [bpost(2, 'The fuel tax credit fight is on in Canberra #auspol')] }));
  const r2 = await w2.t.bskySweep(w2.env, { queries: ['fuel tax credit'], threads: 0 });
  eq([r2.host, !!r2.fallback], ['api.bsky.app', false]); eq(w2.outbound.filter(o => /public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts/.test(o.url)).length, 0);
  const one = await w2.t.bskySearch('auspol', 3); eq([one.ok, one.host], [true, 'api.bsky.app'], 'the coverage probe\'s search uses the same order');
  // threads stay on the public host
  w2.answer(/getPostThread/, () => J({ thread: { post: bpost(3, 'root'), replies: [] } }));
  w2.answer(/^https:\/\/api\.bsky\.app\/xrpc\/app\.bsky\.feed\.searchPosts/, () => J({ posts: [Object.assign(bpost(4, 'The fuel tax credit is a rort says the Senate #auspol'), { replyCount: 5 })] }));
  await w2.t.bskySweep(w2.env, { queries: ['fuel tax credit'], threads: 5 });
  ok(w2.outbound.some(o => /^https:\/\/public\.api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getPostThread/.test(o.url)) && !w2.outbound.some(o => /^https:\/\/api\.bsky\.app\/xrpc\/app\.bsky\.feed\.getPostThread/.test(o.url)), 'threads on the public host');
  // both refused: a failure by name, not a quiet run
  const w3 = await mk(); w3.answer(/searchPosts/, () => J({ error: 'Forbidden' }, 403));
  const r3 = await w3.t.bskySweep(w3.env, { queries: ['fuel tax credit', 'diesel rebate', 'fuel excise', 'critical minerals', 'iron ore', 'gas prices'], threads: 0 }); eq(r3.ok, false); ok(/403/.test(r3.detail), r3.detail);
  ok(r3.stoppedEarly && /three terms running were refused/.test(r3.stoppedEarly) && /other 3 were not asked/.test(r3.stoppedEarly), 'a host that refuses outright is not asked every term: ' + r3.stoppedEarly);
  eq(w3.outbound.filter(o => /searchPosts/.test(o.url)).length, 4, 'the search host once, then the public host for three terms');
});

await S.t('DW6 the tick\'s Bluesky terms: every desk-owned term first, then ten of the rest in turn', async () => {
  const w = await mk(); const t = w.t;
  const deskIds = t.CLIENT_ISSUES.filter(ci => ['mca', 'aep', 'guns'].indexOf(ci.ns) >= 0).map(ci => ci.id);
  const deskTerms = t.issueQueries(deskIds); const rest = t.issueQueries().filter(q => deskTerms.indexOf(q) < 0);
  ok(deskTerms.length > 20 && rest.length > 20, deskTerms.length + ' desk terms, ' + rest.length + ' others');
  const a = await t.bskyCronQueries(w.env);
  eq(a.slice(0, deskTerms.length).slice().sort(), deskTerms.slice().sort(), 'every desk term, first'); eq(a.length, deskTerms.length + 10, 'then ten more');
  ok(a.slice(deskTerms.length).every(q => rest.indexOf(q) >= 0), 'the ten are from the rest');
  const b = await t.bskyCronQueries(w.env); const ra = a.slice(deskTerms.length), rb = b.slice(deskTerms.length);
  ok(rb.every(q => ra.indexOf(q) < 0), 'the next tick takes the next ten: ' + rb[0] + ' after ' + ra[0]);
  const seen = new Set(); for (let i = 0; i < Math.ceil(rest.length / 10) + 1; i++) (await t.bskyCronQueries(w.env)).slice(deskTerms.length).forEach(q => seen.add(q));
  ok(rest.every(q => seen.has(q)), 'every other term comes round');
  // a term a person approves on a desk joins the desk terms at once
  await F(w, 'POST', '/den/watch/add', { ns: 'mca', kind: 'term', platform: 'any', value: 'diesel rebate rort', issue: 'ftc' }); await t.deskLexiconLoad(w.env, true);
  const c = await t.bskyCronQueries(w.env); ok(c.indexOf('diesel rebate rort') >= 0 && c.indexOf('diesel rebate rort') < deskTerms.length + 1, 'an approved desk term goes first');
});

await S.t('DW7 the tick is measured, and /den/collection returns it with the pipeline counts', async () => {
  const w = await mk();
  const before = (await F(w, 'GET', '/den/collection?desk=aep_au', null, 'read-key')).body; ok(before.ok && Array.isArray(before.channels), 'reads before any tick');
  eq(before.tick, null, 'no tick yet: said as null, never invented');
  const clk = w.t.tickClock();
  clk.mark('core'); clk.mark('sources'); clk.mark('social');
  await w.t.tickSave(w.env, clk, { mode: 'daily', run: false, why: 'held' }, true);
  const mid = JSON.parse(w.kv.get('tick_last')); eq([mid.partial, mid.stages.map(s => s[0])], [true, ['core', 'sources', 'social']], 'a partial record after the collectors: a tick cut short still says how far it got');
  clk.mark('narratives');
  await w.t.tickSave(w.env, clk, { mode: 'daily', run: false, why: 'held' });
  const kv = JSON.parse(w.kv.get('tick_last'));
  eq(kv.stages.map(s => s[0]), ['core', 'sources', 'social', 'narratives']); ok(kv.stages.every(s => typeof s[1] === 'number' && s[1] >= 0)); ok(kv.at > 0 && typeof kv.total === 'number' && !kv.partial);
  eq(kv.ai, { mode: 'daily', run: false });
  // rows waiting for the narrative pass, and narratives with a working title
  put(w, 'sig_thread', 'bluesky', 'Fuel tax credit post one', 'The fuel tax credit is a rort for miners, critics say.', { platform: 'bluesky', issues: ['ftc'] }, 2 * H);
  put(w, 'sig_thread', 'bluesky', 'Fuel tax credit post two', 'The fuel tax credit keeps regional jobs, farmers say.', { platform: 'bluesky', issues: ['ftc'] }, 3 * H);
  const c = (await F(w, 'GET', '/den/collection?desk=aep_au', null, 'read-key')).body;
  eq(c.tick.stages.length, 4, 'the tick as recorded'); ok(c.tick.total >= 0 && c.tick.at === kv.at);
  ok(c.pipeline && c.pipeline.unplaced >= 2, 'rows waiting to be grouped: ' + JSON.stringify(c.pipeline)); ok(c.pipeline.oldestUnplacedMin >= 0, 'how long the oldest has waited');
  ok(typeof c.pipeline.titled === 'number' && typeof c.pipeline.awaitingModel === 'number', JSON.stringify(c.pipeline));
  ok(c.pipeline.window && c.pipeline.window.hours > 0, 'the window the counts name');
  eq(Object.keys(before).filter(k => !(k in c)), [], 'every field the page already reads is still sent');
});

await S.t('DW8 a desk\'s registered X accounts are read every run; only the rest rotates', async () => {
  const w = await mk();
  for (const h of ['harbourwatch', 'gasfacts']) { const r = await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'x', value: h, name: h, actor_kind: 'org' }); eq(r.status, 200, r.text.slice(0, 200)); }
  w.kv.set('x_watch', JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ handle: 'watched' + i }))));
  w.answer(/syndication\.twitter\.com/, () => T('', 404, 'text/html'));
  const asked = () => w.outbound.filter(o => /timeline-profile\/screen-name\//.test(o.url)).map(o => o.url.split('/').pop().toLowerCase());
  await w.t.xSyndSweep(w.env, { max: 10, mps: false, days: 3 }); const a = asked(); w.outbound.length = 0;
  await w.t.xSyndSweep(w.env, { max: 10, mps: false, days: 3 }); const b = asked();
  eq([a.length, b.length], [10, 10], 'the run size holds');
  ok(['harbourwatch', 'gasfacts'].every(h => a.indexOf(h) >= 0 && b.indexOf(h) >= 0), 'the registered accounts in both runs: ' + a.join(',') + ' | ' + b.join(','));
  const ra = a.filter(h => /^watched/.test(h)), rb = b.filter(h => /^watched/.test(h)); eq([ra.length, rb.length], [8, 8]); ok(rb.every(h => ra.indexOf(h) < 0), 'the rest rotates');
});

await S.t('DW9 Google News by issue: one OR-query an issue, the desks\' issues first', async () => {
  const w = await mk(); const asked = [];
  w.answer(/news\.google\.com\/rss\/search/, u => { const q = decodeURIComponent((String(u).match(/[?&]q=([^&]+)/) || [])[1] || '').replace(/\+/g, ' '); asked.push(q);
    return T(rss([{ t: 'Senate to debate the fuel tax credit scheme again - Regional Daily', l: 'https://news.google.com/rss/articles/x' + asked.length }, { t: 'Local bakery wins a ribbon - Town Crier', l: 'https://news.google.com/rss/articles/y' + asked.length }])); });
  const r = await F(w, 'POST', '/sources/add', { id: 'lex_test', name: 'Lexicon sweep (test)', tier: 'sweep', urls: { lexicon: 'gnews' } }); eq(r.status, 200, r.text.slice(0, 200));
  const sw = (await F(w, 'POST', '/sources/sweep', { ids: ['lex_test'] })).body.results[0]; eq(sw.ok, true, JSON.stringify(sw).slice(0, 300));
  const per = w.t.LEX_PER_RUN.gnews; const issueQs = asked.filter(q => / OR /.test(q)); const termQs = asked.filter(q => !/ OR /.test(q));
  eq(termQs.length, per, 'the per-term rotation is unchanged (the deep pass)');
  const n = w.t.LEX_PER_RUN.issues; ok(n >= 3 && issueQs.length === n, n + ' issue queries a run: ' + issueQs.length);
  ok(issueQs.every(q => / when:1d$/.test(q) && (q.match(/"/g) || []).length >= 4 && (q.match(/"/g) || []).length <= 16), 'quoted terms joined by OR, at most eight, the last day: ' + issueQs[0]);
  const deskTerms = w.t.issueQueries(w.t.CLIENT_ISSUES.filter(ci => ['mca', 'aep', 'guns'].indexOf(ci.ns) >= 0).map(ci => ci.id));
  const isDesk = q => deskTerms.indexOf((q.match(/"([^"]+)"/) || [])[1]) >= 0;   // an issue's query, by its first term (two issues may share a term)
  const k = issueQs.findIndex(q => !isDesk(q)); ok(k >= 3 && issueQs.slice(k).every(q => !isDesk(q)), 'the desks\' issues first, then the rest: ' + issueQs.join(' | '));
  ok(deskTerms.every(t => issueQs.slice(0, k).some(q => q.indexOf('"' + t + '"') >= 0)), 'every desk term is asked in every run');
  const rows = arc(w, "kind='news' AND src='lex_test'"); ok(rows.length >= 1 && rows.every(x => /fuel tax credit/.test(x.title)), 'only headlines on a client issue are kept');
  ok(rows.some(x => / OR /.test(x.meta.q || '')), 'the issue query that found a row rides on it');
  // the rest rotate; the desks' issues are asked again
  asked.length = 0; await F(w, 'POST', '/sources/sweep', { ids: ['lex_test'] }); const next = asked.filter(q => / OR /.test(q));
  eq(next.slice(0, k), issueQs.slice(0, k), 'the desks\' issues again'); ok(next.slice(k).every(q => issueQs.slice(k).indexOf(q) < 0), 'the next of the rest: ' + next.slice(k).join(' | '));
});

await S.t('DW10 the seed gains the probed addresses', async () => {
  const w = await mk(); const d = (await F(w, 'GET', '/sources?status=', null, 'read-key')).body; const by = {}; d.sources.forEach(x => { by[x.id] = x; });
  eq(d.sources.length, new Set(d.sources.map(x => x.id)).size, 'no id twice');
  eq([by.v67_lemmy_world_au.methods, by.v67_lemmy_world_au.urls.lemmy, by.v67_lemmy_world_au.tier], [['lemmy'], 'lemmy.world/c/australia', 'community']);
  ok(by.v67_guardian_energy.methods[0] === 'rss' && /theguardian\.com\/australia-news\/energy-australia\/rss$/.test(by.v67_guardian_energy.urls.rss), JSON.stringify(by.v67_guardian_energy));
  ok(by.v67_treasury_ministers.methods[0] === 'rss' && by.v67_treasury_ministers.tier === 'official');
  ok(by.wn_aemc.methods[0] === 'rss' && by.wn_aemc.methods.indexOf('gnews') > 0, 'the feed first, Google News kept behind it: ' + JSON.stringify(by.wn_aemc.methods));
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
