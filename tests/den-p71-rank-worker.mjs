/* Anne's Den build p71, the rank lane: which rows reach the model, and how their lines read (the real-data check of 17
 * November 2026: combined M1; AEP M1, M5, M8, m5; MCA 2, 11, 13, 15, 16), against the worker module in this process. No
 * provider is contacted and no model is called: the evidence a draft is written from is built directly. Every outlet,
 * account, address, person and post here is invented. Each case fails on the p71 base (a2222eb, p70 behaviour).
 *   RK1 relevance before syndication and time: a single-outlet early story with its issue's own trigger in the title
 *       reaches the model ahead of newer stories; a home feature that mentions gas once in its body is not sent unless it
 *       is pinned; every board row and story carries how it bears on the desk (rel)
 *   RK2 the shares within the cap: one outlet's sixteen stories take at most the outlet cap (four of thirty), under its
 *       registry name; an issue with two stories is not starved by one with thirty-seven; the window's first quarter
 *       keeps its story
 *   RK3 no paywall notice is sent as a summary (the line says headline only, and ranks below a story with text);
 *       boilerplate before real text is struck and the text kept; a stale row (its address dated ten days before the
 *       window) ranks after every fresh one and is dated by its address; a Special Report says so
 *   RK4 links and labels: a Google News redirect gives way to the publisher's address; &amp; and tracking are gone; the
 *       outlet prints its registry name, never its key; one masthead under two keys counts once; a link on another site
 *       says so; one story under two headlines on two mastheads folds by its address
 *   RK5 social: a video watched 6,120 times with no likes reaches the model and every channel with posts gets a place;
 *       a YouTube ?v= survives the link cleaner, its tracking does not
 *   RK6 nineteen templated posts from nineteen accounts are one line with their count, span and interactions, under the
 *       first post's id, taking one place; the other eighteen ride on it and are stored with the brief
 *   RK7 the cap grows with the window (thirty stories at 24 hours, sixty at 168); over its budget the evidence drops its
 *       lowest-ranked stories (and their ids), never the tone or the last filed bottom line; a long evidence text of rows
 *       that must be sent keeps its tail
 *   RK8 a row the model must see is sent though it ranks last; summaries cut at a word, with "..."; engagement counts
 *       quotes, says "no interactions" for a post counted at nothing and "engagement not recorded" only for one with no count;
 *       comments read, in words; media, social and actor records carry ts, and denIdsJson keeps it
 * The review of build p71 (lane evidence); each of these fails on df42fb8, the p71 build before the review's fixes:
 *   RK9 a check's row past the Board's lists reaches the model (EV1, ST5): a first post naming an organisation that drew
 *       nothing, past the Board's 90 posts, and an MP's post naming another, past its 140 picked, are sent, and the strip's
 *       lines point at them by their ids; a story past the Board's 150, pinned or named by a check, is sent too
 *   RK10 one outlet's daily pages are not folded across days (EV3): a live page whose slug carries its day after the month,
 *       and one whose slug is the same each day but whose address carries another date, are two stories in a week's
 *       window; one story under two addresses of one date, or one dated and one not, still folds
 *   RK11 engagement in words the reader rule allows (EV5, CO4): a post with no count reads "engagement not recorded";
 *       a templated group with none recorded says so, never "0 interactions in all"; one with some recorded gives its
 *       total and on how many posts; one with views only gives its views
 *   RK12 the line carries the card's figures (CK10): "carried by 7 outlets" and "Facebook 362 interactions", written from
 *       the card, are found in the line they cite and are not flagged
 *   RK13 a "Special Report" is sponsored only where the outlet's label means so (ST4): that outlet's piece says the label
 *       and what it marks, and that its disclosure was not read; a wire's investigation headed "Special Report:", and a
 *       summary quoting another body's special report, are not labelled; the rule says the company's own material only
 *       where the line says made with the company
 *   RK14 a story dated by its address prints its day, never a time (CO7), in its line and on its card
 * The second review of build p71 (lane evidence); each of these fails on 3b71160, the merge of the first review's fixes,
 * except RK15, which that merge already holds (the strip lane's evId) and which is pinned here:
 *   RK15 a check on a post that a back-filled post folds into a templated line points at that line, as does the check on
 *        the back-filled post (D1)
 *   RK16 the SOCIAL header counts the posts the evidence chose from, a check's post past the Board's lists included, so it
 *        never reads "0 posts; 1 shown" (D2)
 *   RK17 a post whose counts were read in part is never said to have drawn nothing: a hidden like count beside no comments
 *        reads "0 comments, likes not recorded", a like count alone "0 likes, comments not recorded", views alone "0 views,
 *        likes and comments not recorded", and a templated line of such posts "engagement not recorded"; a post whose
 *        likes and comments were both read at nought still reads "no interactions" (D3)
 *   RK18 the sponsored outlet's label is read as it writes it: another body's special report quoted in its summary, in
 *        lower case or after a possessive, is not its label; its own label, and a headline led by it in capitals, are (D4b)
 * The third review of build p71 (lane evidence) added RK19 (F1), the sponsored outlet's label in every form its feed writes
 * and never a report another body names; the fourth review folds it into RK20's table, and RK20 fails on ecb2292:
 *   RK20 one table of every form of the sponsored label any review has listed (ST4, D4, D4b, F1, Q1, and F1's own nearest
 *        cases), each with its flag, on the Board, in the evidence line and in the rule alone. Where the rounds disagreed
 *        the outlet's own label wins (a miss counts its piece as press tone; a false label moves one story out of it): a
 *        report is another body's only where it is named so on the label's line, a possessive or "the <name>" right
 *        before it and a report's title after it, never a company and its verb ("... on the PSX Special Report: Pier
 *        Point Energy has", a standfirst ending in an article and a name, is the label), and never across a line break
 *        (Q1)
 * Run: node --experimental-sqlite tests/den-p71-rank-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p71, rank: which rows reach the model, and how their lines read');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async () => workerEnv({ env: {}, keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, D = 86400000, NOW = Date.now();
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const auDay = t => new Date(t + 11 * H).toISOString().slice(0, 10);   // the Sydney date, near enough for days well away from midnight
let seq = 0;
const add = async (w, kind, rows) => { for (let i = 0; i < rows.length; i += 150) { const r = await F(w, 'POST', '/archive/add', { kind, rows: rows.slice(i, i + 150) }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); } };
// a story from an invented outlet (its feed key is src) and a post on an invented account
const story = (src, title, o) => { seq++; o = o || {}; const meta = Object.assign({ source: src, tier: 'regional', juris: 'au', reg: 1, issues: ['gas'] }, o.meta || {});
  return Object.assign({ src, title, body: 'Campaigners and producers set out their positions this week.', url: 'https://' + src + '.example.com.au/news/story-' + seq, ts: NOW - 2 * H }, o, { meta }); };
const post = (platform, text, o) => { seq++; o = o || {}; const meta = Object.assign({ platform, issues: ['gastax'], id: 'p' + seq, term: 'gas export tax', eng: { likes: 3, reposts: 0, replies: 0, quotes: 0, views: 0 } }, o.meta || {});
  return Object.assign({ src: platform, title: platform + ' post', body: text, url: 'https://bsky.app/profile/did:plc:acct' + seq + '/post/3k' + seq, ts: NOW - 3 * H }, o, { meta }); };
const idOf = (w, url) => w.env.MIND_DB.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id;
const idIn = l => ((l || '').match(/^\[([A-Z]:\d+)\]/) || [])[1];
// the evidence a draft of this desk would be given now: the board, then the evidence built from it (no strip, no memory)
const evidence = async (w, deskId, o) => { o = o || {}; const T = w.mod.__test; const desk = await T.deskGet(w.env, deskId); const board = await T.denBoard(w.env, desk, { keepRows: true });
  const ev = await T.denEvidence(w.env, desk, board, null, o.pins || [], Object.assign({ memory: false }, o.eo || {}));
  const lines = k => ev.text.split('\n').filter(l => l.indexOf('[' + k + ':') === 0); return { desk, board, text: ev.text, ids: ev.ids, M: lines('M'), S: lines('S'), P: lines('P') }; };
// invented sources in the registry (the table is made and seeded by reading it once)
const register = async (w, rows) => { await F(w, 'GET', '/sources');
  const st = w.env.MIND_DB.db.prepare('INSERT OR REPLACE INTO sources(id,name,tier,juris,issues,methods,urls,schedule,enabled,core,edited,created,updated) VALUES(?,?,?,?,?,?,?,60,1,0,1,?,?)');
  rows.forEach(r => st.run(r[0], r[1], r[2], 'au', '[]', '["sitemap","gnews"]', JSON.stringify(r[3]), NOW, NOW)); };

await S.t('RK1 relevance before syndication and time; a passing mention is not sent unless pinned', async () => {
  const w = await mk();
  const early = story('harbourgazette', 'Senate to vote on the gas reservation bill this week', { ts: NOW - 22 * H, body: 'The government will bring the bill on in the last sitting fortnight of the year.' });
  const inBody = [1, 2, 3].map(i => story('cityrecord' + i, 'Industry groups meet in Canberra ' + i, { ts: NOW - (1 + i) * H, body: 'They discussed the domestic gas market and what it means for prices.' }));
  const passing = Array.from({ length: 35 }, (_, i) => story('lifestyle' + i, 'A seaside suburb with a starry sky ' + (i + 1), { ts: NOW - (0.5 + i * 0.3) * H, body: 'Locals love the quiet beach and the dunes. The old gas heater still warms the cottage on cold nights.', meta: { tier: 'metro' } }));
  await add(w, 'news', [early].concat(inBody, passing));
  const a = await evidence(w, 'aep_au'); const at = re => a.M.findIndex(l => re.test(l));
  eq(at(/Senate to vote on the gas reservation bill/), 0, 'the early single-outlet story with its issue\'s trigger in the title leads: ' + a.M.slice(0, 3).map(l => l.slice(0, 70)).join(' // '));
  ok(at(/Industry groups meet in Canberra/) > 0, 'newer stories with the trigger only in the body follow it');
  ok(!a.M.some(l => /seaside suburb/.test(l)), 'a story that mentions gas once in its body never reaches the model: ' + a.M.filter(l => /seaside/.test(l)).length + ' did');
  eq(a.M.length, 4, 'four stories bear on the desk');
  const pid = idOf(w, passing[5].url); eq((await F(w, 'POST', '/den/pin', { desk: 'aep_au', item: pid })).status, 200);
  const b = await evidence(w, 'aep_au'); ok(b.M.some(l => l.indexOf('[M:' + pid + '] PINNED | ') === 0), 'pinned, the same feature is sent, marked: ' + b.M.map(l => l.slice(0, 50)).join(' // '));
  ok(b.board._rows.length >= 39 && b.board._rows.every(r => r.rel && typeof r.rel.passing === 'boolean' && typeof r.rel.tight === 'boolean'), 'every board row carries how it bears on the desk');
  const bm = id => b.board.media.find(m => m.id === id) || {}; ok(bm(pid).rel && bm(pid).rel.passing === true && bm(idOf(w, early.url)).rel.tight === true, 'and so does every story on the board');
});

await S.t('RK2 the shares: an outlet cap, every issue, every quarter', async () => {
  const w = await mk(); await register(w, [['quarryweekly', 'Quarry Weekly', 'sector', { site: 'quarryweekly.example.com.au' }]]);
  const trade = Array.from({ length: 16 }, (_, i) => story('quarryweekly', 'Critical minerals deal ' + (i + 1) + ' signed for a northern project', { ts: NOW - (1 + i * 0.1) * H, url: 'https://quarryweekly.example.com.au/article/deal-' + (i + 1), meta: { issues: ['cm'], tier: 'sector' } }));
  const others = Array.from({ length: 20 }, (_, i) => story('minesite' + i, 'Rare earths processing plan number ' + (i + 1), { ts: NOW - (3 + i * 0.25) * H, meta: { issues: ['cm'], tier: 'sector' } }));
  const ftc = [1, 2].map(i => story('roadnews' + i, 'Fuel tax credit changes flagged for review ' + i, { ts: NOW - (9 + i) * H, meta: { issues: ['ftc'], tier: 'sector' } }));
  const first = story('earlybird', 'Critical minerals reserve opens to bids', { ts: NOW - 21 * H, meta: { issues: ['cm'], tier: 'sector' } });
  await add(w, 'news', trade.concat(others, ftc, [first]));
  const a = await evidence(w, 'mca_au');
  const qw = a.M.filter(l => /\] Quarry Weekly \(/.test(l)); ok(qw.length >= 1 && qw.length <= 4, 'one outlet takes at most max(3, ceil(30/8)) = 4 of 30 places, under its name: ' + qw.length);
  ok(!a.M.some(l => /quarryweekly/.test(l.split(' | ')[0])), 'never under its key');
  eq(a.M.filter(l => /Fuel tax credit changes flagged/.test(l)).length, 2, 'an issue with two stories keeps them beside one with thirty-seven');
  ok(a.M.some(l => /Critical minerals reserve opens to bids/.test(l)), 'the window\'s first quarter keeps its story');
  ok(a.M.length <= 30, 'within the cap: ' + a.M.length);
});

await S.t('RK3 no paywall notice as a summary; a stale row ranks last, dated by its address; a Special Report is labelled', async () => {
  const w = await mk(); const old = auDay(NOW - 10 * D); const dd = String(Number(old.slice(8, 10))) + ' ' + MON[Number(old.slice(5, 7)) - 1];
  const notice = story('diggerdaily', 'Critical minerals export rules tighten', { ts: NOW - 3 * H, meta: { issues: ['cm'] }, body: 'Keep this story for later: saved articles are a subscriber benefit. Already a subscriber? Log in to save it. Not a subscriber yet? See our subscription options.\n\nThe full story is available only to subscribers.' });
  const mixed = story('coastpaper', 'Antimony miners eye a new coastal plant', { ts: NOW - 4 * H, meta: { issues: ['cm'] }, body: 'Your saved items folder is full.\n\nClear your saved list to keep more stories.\n\nYou have used all your gift articles for now. Another batch will become available on the first of next month.\n\nThe antimony project near the coast is set to double its output next year, the company told shareholders on Monday.' });
  const teaser = story('finpaper', 'Government warns over rare earths buying tactics', { ts: NOW - 5 * H, meta: { issues: ['cm'], paywall: 1, ft: 'none' }, body: 'Analysts say centralised buying will save the importer billions over the next decade on rare earths purchases.' });
  const special = story('stockpick', 'Antimony producer forecasts strong returns', { ts: NOW - 6 * H, meta: { issues: ['cm'] }, body: 'Post-tax returns are forecast in the study. Special Report: The producer could be mining antimony early next year, the company said.' });
  const stale = story('tradewire', 'Critical minerals tender reopened for bids', { ts: NOW - 1 * H, url: 'https://tradewire.example.com.au/article/critical-minerals-tender-reopened-for-bids-' + old, meta: { issues: ['cm'], dated: 0 } });
  await add(w, 'news', [notice, mixed, teaser, special, stale]); (w.mod.__test.DEN_SPONSORED_HOSTS || []).push('stockpick.example.com.au');   // p71 review (ST4): an outlet whose "Special Report" marks a piece made with the company
  const a = await evidence(w, 'mca_au'); const line = re => a.M.find(l => re.test(l)) || '';
  const n = line(/Critical minerals export rules tighten/); ok(n && !/subscriber benefit|saved articles|log in|subscription options|only to subscribers/i.test(n) && /\| headline only$/.test(n), 'a paywall notice is never sent as a summary: ' + n);
  const mx = line(/Antimony miners eye/); ok(/double its output next year/.test(mx) && !/saved items|gift articles|saved list|become available/.test(mx) && !/headline only/.test(mx), 'boilerplate struck, the text kept: ' + mx);
  ok(a.M.indexOf(n) > a.M.indexOf(mx), 'a headline alone ranks below a story with text at the same relevance');
  ok(/centralised buying will save the importer billions/.test(line(/buying tactics/)), 'a feed\'s own teaser on a walled story is kept: ' + line(/buying tactics/));
  ok(/\| labelled 'Special Report', the outlet's label for a piece made with the company it is about \(its own disclosure was not read\)/.test(line(/Antimony producer forecasts/)), 'a Special Report says so: ' + line(/Antimony producer/));
  const st = a.M[a.M.length - 1] || ''; ok(/Critical minerals tender reopened/.test(st), 'the stale row ranks after every fresh one: ' + a.M.map(l => l.slice(0, 60)).join(' // '));
  ok(st.split(' | ')[1].indexOf(dd) === 0 && /date in its address/.test(st) && !/\d\d:\d\d/.test(st.split(' | ')[1]), 'and is dated by its address, not by when it was fetched: ' + st);
  const bm = re => a.board.media.find(m => re.test(m.title)) || {};
  eq([bm(/tender reopened/).stale, bm(/tender reopened/).urlDate, bm(/export rules/).paywalled, bm(/export rules/).summary, bm(/producer forecasts/).special], [true, old, true, '', true], 'the board says so too');
});

await S.t('RK4 links and labels: the publisher\'s address, clean, under the registry\'s name', async () => {
  const w = await mk(); const tok = auDay(NOW - 2 * H).replace(/-/g, '');
  await register(w, [['harbourpost', 'Harbour Post', 'metro', { site: 'harbourpost.example.com.au' }], ['harbourpost_pol', 'Harbour Post Politics', 'national', { site: 'harbourpost.example.com.au' }], ['skyline', 'Skyline News', 'broadcaster', { site: 'skyline.example.com.au' }]]);
  const g = story('gnews_energy', 'Gas reservation bill clears the Senate', { url: 'https://news.google.com/rss/articles/CBMiQWh0dHBzOi8vaGFyYm91cnBvc3Q?oc=5', ts: NOW - 2 * H, meta: { source: 'gnews_energy', tier: 'sweep', reg: undefined, outlet: 'Harbour Post', link: 'https://harbourpost.example.com.au/politics/gas-reservation-bill-clears-the-senate-' + tok + '-p5abcd.html?utm_source=google&id=42' } });
  const k1 = story('harbourpost_pol', 'Coalition demands changes to the gas reservation plan', { ts: NOW - 5 * H, url: 'https://harbourpost.example.com.au/politics/coalition-demands-changes-to-the-gas-plan.html?ref=rss&amp;utm_medium=rss&amp;utm_source=rss_feed' });
  const k2 = story('harbourpost', 'Coalition demands changes to the gas reservation plan', { ts: NOW - 4 * H, url: 'https://harbourpost.example.com.au/national/coalition-demands-changes-to-the-gas-plan-2.html' });
  const sky = story('skyline', 'Gas market slump drags the index lower', { ts: NOW - 6 * H, url: 'https://news24.example.com.au/latest/gas-market-slump-drags-the-index-lower/news-story/9f8e7d6c5b4a3f2e' });
  const sky2 = story('skyline', 'Gas market slump drags the index lower', { ts: NOW - 5.5 * H, url: 'https://skyline.example.com.au/business/gas-market-slump-drags-the-index-lower' });
  const w1 = story('westpaper', 'Higher prices loom as the gas plan bites', { ts: NOW - 8 * H, url: 'https://westpaper.example.com.au/business/higher-prices-loom-as-the-gas-plan-bites-c-1234567' });
  const w2 = story('eastpaper', 'Gas plan will push up prices, producers warn', { ts: NOW - 7 * H, url: 'https://eastpaper.example.com.au/news/higher-prices-loom-as-the-gas-plan-bites/news-story/0a1b2c3d4e5f' });
  await add(w, 'news', [g, k1, k2, sky, sky2, w1, w2]);
  const a = await evidence(w, 'aep_au'); const rec = re => { const l = a.M.find(x => re.test(x)) || ''; return { l, r: a.ids.get(idIn(l)) || {} }; };
  const G = rec(/Gas reservation bill clears the Senate/); eq(G.r.url, 'https://harbourpost.example.com.au/politics/gas-reservation-bill-clears-the-senate-' + tok + '-p5abcd.html?id=42', 'a Google News redirect gives way to the publisher\'s address, its tracking struck');
  ok(/^\[M:\d+\] Harbour Post /.test(G.l), 'named by its publisher: ' + G.l.slice(0, 80));
  const K = rec(/Coalition demands changes/); eq(K.r.url, 'https://harbourpost.example.com.au/politics/coalition-demands-changes-to-the-gas-plan.html', '&amp; decoded and the feed\'s tracking struck');
  ok(/^\[M:\d+\] Harbour Post Politics \(national\) \| /.test(K.l) && !/harbourpost_pol|gnews_energy/.test(a.M.join('\n')), 'the registry\'s name, never its key: ' + K.l.slice(0, 80));
  ok(!/also carried by/.test(K.l) && /^Harbour Post Politics - Coalition/.test(K.r.label), 'one masthead under two keys is one outlet: ' + K.l);
  const Sk = rec(/Gas market slump/); ok(/^\[M:\d+\] Skyline News \(broadcaster\)/.test(Sk.l) && /\| link on news24\.example\.com\.au/.test(Sk.l), 'a link on another site says so: ' + Sk.l);
  ok(!/also carried by/.test(Sk.l), 'one outlet under one name on two sites is one outlet: ' + Sk.l);
  const W = a.M.filter(l => /Higher prices loom|Gas plan will push up prices/.test(l)); eq(W.length, 1, 'one story under two headlines on two mastheads folds by its address: ' + W.join(' // '));
  ok(/also carried by 1 other outlet/.test(W[0]), W[0]);
  const bm = a.board.media.find(m => /Gas market slump/.test(m.title)) || {}; eq([bm.outlet, bm.linkHost], ['Skyline News', 'news24.example.com.au'], 'the board says it too');
});

await S.t('RK5 social: a video\'s views count, and every channel gets a place', async () => {
  const w = await mk();
  const blue = Array.from({ length: 35 }, (_, i) => post('bluesky', 'The gas export tax would fund schools and hospitals, point ' + (i + 1), { ts: NOW - (1 + i * 0.2) * H, meta: { eng: { likes: 5 + i, reposts: 1, replies: 0, quotes: 0, views: 0 } } }));
  const yt = post('youtube', 'Factory owners rally behind gas reservation, says a weekly business show', { url: 'https://www.youtube.com/watch?v=Zx9Yw8Vu7Ts&utm_source=feed&utm_medium=social', ts: NOW - 9 * H, meta: { issues: ['gas'], term: '', eng: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 6120 } } });
  const masto = post('mastodon', 'Tax the gas now, say the locals at the meeting', { url: 'https://social.example.org/@harbourlocal/112233', ts: NOW - 10 * H, meta: { eng: { likes: 1, reposts: 0, replies: 0, quotes: 0, views: 0 } } });
  await add(w, 'sig_thread', blue.concat([yt, masto]));
  const a = await evidence(w, 'aep_au'); const yl = a.S.find(l => /Factory owners rally/.test(l)) || '';
  ok(/\| 6120 views/.test(yl), 'a video watched 6,120 times with no likes reaches the model: ' + (yl || a.S.length + ' posts sent'));
  ok(a.S.some(l => /Tax the gas now/.test(l)), 'every channel with posts gets a place: ' + Array.from(new Set(a.S.map(l => l.split(' | ')[0].replace(/^\[S:\d+\] /, '')))).join(', '));
  eq((a.ids.get(idIn(yl)) || {}).url, 'https://www.youtube.com/watch?v=Zx9Yw8Vu7Ts', 'the video\'s ?v= survives the link cleaner, its tracking does not');
  ok(a.S.length <= 30, 'within the cap: ' + a.S.length);
  ok(((a.board.social.find(s => /Factory owners/.test(s.text)) || {}).score || 0) > 100, 'scored by its views as well as its interactions');
});

await S.t('RK6 nineteen templated posts are one line, with their count', async () => {
  const w = await mk(); const t0 = NOW - 6 * H;
  const letter = Array.from({ length: 19 }, (_, i) => post('bluesky', 'Count me in: my name is now on the harbour petition for a fair energy transition before COP31. Add yours at https://act.example.org/letter/' + i + ' #HarbourVoices', { url: 'https://bsky.app/profile/did:plc:signer' + i + '/post/3l' + i, ts: t0 + i * 11 * 60000, meta: { issues: ['energy'], term: 'cop31 australia', eng: { likes: i < 6 ? 1 : 0, reposts: 0, replies: 0, quotes: 0, views: 0 } } }));
  const other = [1, 2, 3].map(i => post('bluesky', 'A different view on the gas export tax, number ' + i, { ts: NOW - i * H }));
  await add(w, 'sig_thread', letter.concat(other));
  const a = await evidence(w, 'aep_au'); const L = a.S.filter(l => /harbour petition/.test(l));
  eq(L.length, 1, 'nineteen near-identical posts are one line: ' + L.length + ' lines');
  ok(/19 near-identical posts from 19 accounts, [^|]*\d\d:\d\d to [^|]*\d\d:\d\d, 6 interactions in all: Count me in: my name is now on the harbour petition/.test(L[0]), L[0]);
  const first = idOf(w, letter[0].url); eq(idIn(L[0]), 'S:' + first, 'under the first post\'s id');
  eq(((a.ids.get('S:' + first) || {}).also || []).slice().sort((x, y) => x - y), letter.slice(1).map(p => idOf(w, p.url)).sort((x, y) => x - y), 'the other eighteen ride on it');
  eq(a.S.length, 4, 'and it takes one place');
  eq((w.mod.__test.denIdsJson(a.ids)['S:' + first].also || []).length, 18, 'stored with the brief');
});

await S.t('RK7 the cap grows with the window; over budget the lowest-ranked go, never the tone or the last bottom line', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  // each headline its own from its first words (a fold key is the first ninety letters), and long, so a hundred lines run past 60,000 characters
  const title = i => 'Senate day ' + (i + 1) + ' of the gas export tax debate: crossbenchers weigh the government\'s offer to share the revenue with the states, producers warn that investment in new supply will fall, unions say manufacturers need relief now, and economists say the design of the tax will matter more than its rate';
  const body = 'Senators argued over the gas export tax for a second day as the vote neared, with crossbenchers holding the balance and the government offering the states a share of the revenue. Producers warned that investment would fall, unions said manufacturers needed relief, and economists said the design of the tax would matter more than its headline rate. The committee will report on Thursday, and the minister said the bill would pass before the year ends.';
  const rows = Array.from({ length: 110 }, (_, i) => story('paper' + i, title(i), { ts: NOW - (1 + i * 0.18) * H, meta: { issues: ['gastax'] }, body }));
  await add(w, 'news', rows);
  w.env.MIND_DB.db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)').run(idOf(w, rows[0].url), 'news', 'news', 'paper0', NOW - 2 * H, -1, JSON.stringify(['gastax']), 'claude');
  await w.mod.__test.deskGet(w.env, 'aep_au');
  w.env.MIND_DB.db.prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES('bfiled1','aep_au',?,24,?,?,'filed',2,?,'{}','{}','claude','Anne',?,?)")
    .run(auDay(NOW - 9 * D), NOW - 10 * D, NOW - 9 * D, JSON.stringify({ bottom: { text: 'The gas tax push was quiet [M:1].' } }), NOW - 9 * D, NOW - 9 * D);
  const a = await evidence(w, 'aep_au'); eq(a.M.length, 30, 'thirty stories at 24 hours');
  eq((await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { window_h: 168 } })).status, 200);
  const b = await evidence(w, 'aep_au'); eq(b.M.length, 60, 'sixty at 168 hours');
  ok(/^\[T:gastax\] /m.test(b.text) && /THE LAST FILED BRIEF'S BOTTOM LINE \([^)]*\): The gas tax push was quiet/.test(b.text), 'the tone and the last bottom line are there');
  const c = await evidence(w, 'aep_au', { eo: { max: 9000 } });
  ok(c.text.length <= 9000, 'over its budget the evidence is cut to it: ' + c.text.length);
  ok(/^\[T:gastax\] /m.test(c.text) && /THE LAST FILED BRIEF'S BOTTOM LINE \([^)]*\): The gas tax push was quiet/.test(c.text), 'never the tone or the last filed bottom line');
  ok(c.M.length > 0 && c.M.length < 60, 'stories were dropped: ' + c.M.length + ' kept');
  eq(c.M.map(idIn), b.M.slice(0, c.M.length).map(idIn), 'the lowest-ranked went first');
  ok(b.M.slice(c.M.length).every(l => !c.ids.has(idIn(l))), 'a dropped line takes its id with it');
  ok(c.text.indexOf('; ' + c.M.length + (c.M.length === 1 ? ' story' : ' stories') + ' shown') > 0, 'the header counts what is shown: ' + (c.text.match(/^TRADITIONAL MEDIA[^\n]*/m) || [''])[0]);
  // a hundred stories the model must see: well over the old 60,000-character cut, which lost the tail
  const must = rows.slice(0, 100).map(r => idOf(w, r.url)); const d = await evidence(w, 'aep_au', { pins: must });
  ok(d.text.length > 60000 && d.M.length === 100, 'every row in must is sent: ' + d.M.length + ' lines, ' + d.text.length + ' characters');
  ok(/^\[T:gastax\] /m.test(d.text) && /THE LAST FILED BRIEF'S BOTTOM LINE/.test(d.text), 'and a long evidence text keeps its tail');
});

await S.t('RK8 must ranked last, summaries cut at a word, engagement read right, records dated', async () => {
  const w = await mk();
  const long = 'The committee heard that the gas export tax would raise revenue for the states while producers warned of lost investment and the unions argued for a reservation scheme that would keep prices down for manufacturers across the eastern states, and economists said the design of the tax would matter more than its headline rate when the modelling is released next month by the department.';
  const fill = Array.from({ length: 40 }, (_, i) => story('desk' + i, 'Gas export tax modelling released, part ' + (i + 1), { ts: NOW - (1 + i * 0.3) * H, meta: { issues: ['gastax'] } }));
  const longRow = story('longform', 'Gas export tax hearing runs late', { ts: NOW - 0.5 * H, meta: { issues: ['gastax'] }, body: long });
  const last = story('backpage', 'A garden show draws a crowd', { ts: NOW - 20 * H, meta: { issues: ['gas'] }, body: 'Visitors admired the roses. A gas barbecue fed the volunteers.' });
  await add(w, 'news', fill.concat([longRow, last]));
  const quoted = post('bluesky', 'Tax the gas exporters, the hearing was told', { ts: NOW - 2 * H, meta: { id: 'tq1', eng: { likes: 7, reposts: 1, replies: 0, quotes: 2, views: 0 } } });
  const zero = post('bluesky', 'The gas export tax hearing in one picture', { ts: NOW - 3 * H, meta: { id: 'tz1', eng: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 } } });
  const none = post('bluesky', 'Notes from the gas export tax hearing', { ts: NOW - 4 * H, meta: { id: 'tn1', eng: undefined, score: 0, comments: 0 } });
  const mp = post('x', 'My statement on the gas export tax', { url: 'https://x.com/alexmember/status/1999000000000000001', ts: NOW - 5 * H, meta: { platform: 'x', id: 'mp1', mp: { name: 'Alex Member', party: 'Independent' }, eng: { likes: 12, reposts: 2, replies: 1, quotes: 0, views: 0 } } });
  await add(w, 'sig_thread', [quoted, zero, none, mp]);
  await add(w, 'sig_comment', [-0.5, -0.3, -0.1].map((t, i) => ({ src: 'bluesky', body: 'A reply ' + i, url: 'x:p71cm:' + i, ts: NOW - H, tone: t, meta: { thread: 'tq1' } })));
  const lastId = idOf(w, last.url); const a = await evidence(w, 'aep_au', { pins: [lastId] });
  ok(a.M.some(l => l.indexOf('[M:' + lastId + '] PINNED | ') === 0), 'a row the model must see is sent though it ranks last: ' + a.M.length + ' stories');
  ok(a.M.length <= 30, 'within the cap: ' + a.M.length);
  const sm = ((a.M.find(l => /hearing runs late/.test(l)) || '').split(' | ').pop()) || ''; const cut = sm.slice(0, -3);
  ok(/\.\.\.$/.test(sm) && sm.length <= 303 && sm.length > 200 && long.indexOf(cut) === 0 && /[\s,;:.]/.test(long.charAt(cut.length)), 'a summary is cut at a word, up to 300 characters, with "...": ' + sm);
  const q = a.S.find(l => /Tax the gas exporters/.test(l)) || ''; ok(/\| 7 likes, 1 repost, 2 quotes( \||$)/.test(q), 'quotes are counted: ' + q);
  ok(/\| 3 comments read, mostly negative$/.test(q) && !/comments held|tone -/.test(q), 'comments read, in words: ' + q);
  ok(/\| no interactions$/.test(a.S.find(l => /in one picture/.test(l)) || ''), 'a post counted at nothing: ' + a.S.find(l => /in one picture/.test(l)));
  ok(/\| engagement not recorded$/.test(a.S.find(l => /Notes from the gas/.test(l)) || ''), '"engagement not recorded" only for a post with no count: ' + a.S.find(l => /Notes from the gas/.test(l)));
  const lid = 'M:' + idOf(w, longRow.url), sid = idIn(q), pid = idIn(a.P[0]);
  eq([(a.ids.get(lid) || {}).ts, (a.ids.get(sid) || {}).ts, (a.ids.get(pid) || {}).ts], [longRow.ts, quoted.ts, mp.ts], 'media, social and actor records carry ts');
  const j = w.mod.__test.denIdsJson(a.ids); eq([j[lid].ts, j[sid].ts, j[pid].ts], [longRow.ts, quoted.ts, mp.ts], 'and denIdsJson keeps it');
});

// ---- the review of build p71 (lane evidence) ----
const FULLM = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
// the evidence a draft would be given now, with the strip's checks (denMissed, its cache skipped)
const strip = async (w, deskId) => { const T = w.mod.__test; const desk = await T.deskGet(w.env, deskId); const board = await T.denBoard(w.env, desk, { keepRows: true });
  const missed = await T.denMissed(w.env, desk, { board, fresh: true }); const ev = await T.denEvidence(w.env, desk, board, missed, [], { memory: false });
  const lines = k => ev.text.split('\n').filter(l => l.indexOf('[' + k + ':') === 0); return { desk, board, missed, text: ev.text, ids: ev.ids, M: lines('M'), S: lines('S'), P: lines('P') }; };
// an invented organisation, named by one row (its sentiment reading and its mention); platform 'news' for a story
const names = (w, item, id, name, platform) => { const db = w.env.MIND_DB.db;
  db.prepare("INSERT OR REPLACE INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,'org',?,?,'','Invented','neutral','aep',1,1,'test','',?,?)").run(id, name, JSON.stringify([name]), NOW, NOW);
  db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)').run(item, platform === 'news' ? 'news' : 'sig_thread', platform, platform, NOW - 2 * H, -0.2, JSON.stringify(['gastax']), 'claude');
  db.prepare('INSERT INTO sent_entities(item,entity,stance,intensity,ts,platform,kind) VALUES(?,?,?,?,?,?,?)').run(item, id, 0, 1, NOW - 2 * H, platform, 'org'); };

await S.t('RK9 a check\'s row past the Board\'s lists reaches the model, and the strip points at it', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  const loud = Array.from({ length: 100 }, (_, i) => post('bluesky', 'Opinion ' + (i + 1) + ' on the gas export tax: the levy should fund the harbour towns before the Senate votes', { ts: NOW - (1 + (i % 20)) * H, meta: { eng: { likes: 25 + i, reposts: 0, replies: 0, quotes: 0, views: 0 } } }));
  const mps = Array.from({ length: 50 }, (_, i) => post('x', 'Statement ' + (i + 1) + ' on the gas export tax from my office', { url: 'https://x.com/member' + i + '/status/19990000000000' + (10 + i), ts: NOW - (2 + (i % 15)) * H, meta: { platform: 'x', mp: { name: 'Alex Member ' + (i + 1), party: 'Independent' }, eng: { likes: 30 + i, reposts: 0, replies: 0, quotes: 0, views: 0 } } }));
  const quiet = post('bluesky', 'Harbour Quay Group joins the campaign for a gas export tax at the harbour', { ts: NOW - 2 * H, meta: { eng: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 } } });
  const quietMp = post('x', 'Met the Pier Street Alliance today about the gas export tax', { url: 'https://x.com/membernew/status/1999000000000000999', ts: NOW - 2 * H, meta: { platform: 'x', mp: { name: 'Sam Newmember', party: 'Independent' }, eng: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 } } });
  await add(w, 'sig_thread', loud.concat(mps, [quiet, quietMp]));
  const qid = idOf(w, quiet.url), mid = idOf(w, quietMp.url); names(w, qid, 'hqgroup', 'Harbour Quay Group', 'bluesky'); names(w, mid, 'psalliance', 'Pier Street Alliance', 'x');
  const a = await strip(w, 'aep_au');
  eq([a.board.social.length, a.board.social.some(s => s.id === qid), a.board.actors.some(x => x.id === mid)], [90, false, false], 'the Board\'s lists stop at 90 posts (and 140 picked) without either row');
  const e1 = a.missed.signals.find(s => s.key === 'E:hqgroup') || {}, e2 = a.missed.signals.find(s => s.key === 'E:psalliance') || {};
  eq([e1.items, e1.cover, e2.items, e2.cover], [[qid], ['S:' + qid], [mid], ['P:' + mid]], 'the strip rests each check on the row that named it');
  ok(a.ids.has('S:' + qid) && a.S.some(l => l.indexOf('[S:' + qid + '] ') === 0 && /Harbour Quay Group joins the campaign/.test(l) && /\| no interactions$/.test(l)), 'the post past the Board\'s 90 reaches the model: ' + (a.S.find(l => l.indexOf('[S:' + qid + ']') === 0) || 'absent'));
  ok(a.ids.has('P:' + mid) && a.P.some(l => l.indexOf('[P:' + mid + '] ') === 0 && /Sam Newmember \(MP, Independent\) on x/.test(l) && /Pier Street Alliance/.test(l)), 'and so does the MP\'s post past the 140 picked: ' + (a.P.find(l => l.indexOf('[P:' + mid + ']') === 0) || 'absent'));
  ok(a.text.indexOf('- Harbour Quay Group is named on these issues for the first time in fourteen days ([S:' + qid + ']).') >= 0, 'the strip\'s line points at its id: ' + (a.text.match(/^- Harbour Quay Group[^\n]*/m) || ['absent'])[0]);
  ok(a.text.indexOf('- Pier Street Alliance is named on these issues for the first time in fourteen days ([P:' + mid + ']).') >= 0, 'and the actor\'s: ' + (a.text.match(/^- Pier Street Alliance[^\n]*/m) || ['absent'])[0]);
  eq([(a.ids.get('S:' + qid) || {}).ts, (a.ids.get('P:' + mid) || {}).ts], [quiet.ts, quietMp.ts], 'their records are built as the lists build theirs');
  ok(a.S.length <= 30, 'within the cap: ' + a.S.length);
  // a story in must past the Board's 150 (a pin the draft is given, or the row a check rests on) is sent too, under its
  // fold's head, and the strip's line points at it
  const w2 = await mk(); await F(w2, 'GET', '/sentiment/status'); const many = Array.from({ length: 160 }, (_, i) => story('paper' + i, 'Gas export tax brief number ' + (i + 1) + ' from the regions', { ts: NOW - (0.5 + i * 0.12) * H, meta: { issues: ['gastax'] } }));
  await add(w2, 'news', many); const oldest = idOf(w2, many[159].url), older = idOf(w2, many[155].url); const b0 = await evidence(w2, 'aep_au');
  eq([b0.board.media.length, b0.board.media.some(m => m.id === oldest || m.id === older)], [150, false], 'the Board keeps 150 stories, not the oldest');
  const b = await evidence(w2, 'aep_au', { pins: [oldest] }); ok(b.M.some(l => l.indexOf('[M:' + oldest + '] PINNED | ') === 0 && /brief number 160 from the regions/.test(l)), 'a story in must past the Board\'s 150 reaches the model: ' + (b.M.find(l => l.indexOf('[M:' + oldest + ']') === 0) || 'absent'));
  names(w2, older, 'tqtrust', 'Tidewater Quay Trust', 'news'); const c = await strip(w2, 'aep_au'); const e3 = c.missed.signals.find(s => s.key === 'E:tqtrust') || {};
  eq([e3.items, e3.cover], [[older], ['M:' + older]], 'a check on a story past the Board\'s 150 rests on it');
  ok(c.ids.has('M:' + older) && c.text.indexOf('- Tidewater Quay Trust is named on these issues for the first time in fourteen days ([M:' + older + ']).') >= 0, 'which reaches the model, and the strip points at it: ' + (c.text.match(/^- Tidewater Quay Trust[^\n]*/m) || ['absent'])[0]);
});

await S.t('RK10 one outlet\'s daily pages are two stories, never one under the first day\'s headline', async () => {
  const w = await mk(); const T = w.mod.__test; await T.deskGet(w.env, 'aep_au'); eq((await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { window_h: 168 } })).status, 200);
  const d1 = auDay(NOW - 100 * H), d2 = auDay(NOW - 30 * H); const md = d => FULLM[Number(d.slice(5, 7)) - 1] + '-' + Number(d.slice(8, 10));
  const g = { meta: { issues: ['gastax'] } };
  const live1 = story('pointpost', 'Senate opens debate on the gas export tax', Object.assign({ ts: NOW - 100 * H, url: 'https://pointpost.example.com.au/news/federal-parliament-live-blog-' + md(d1) + '/105123456' }, g));
  const live2 = story('pointpost', 'Crossbench deal passes the gas export tax', Object.assign({ ts: NOW - 30 * H, url: 'https://pointpost.example.com.au/news/federal-parliament-live-blog-' + md(d2) + '/105129999' }, g));
  const day1 = story('harbourpost', 'The gas export tax debate opens in the Senate chamber', Object.assign({ ts: NOW - 99 * H, url: 'https://harbourpost.example.com.au/politics/federal-politics-live-gas-export-tax-' + d1.replace(/-/g, '') + '-p61aaa.html' }, g));
  const day2 = story('harbourpost', 'The gas export tax is won on the floor of the Senate', Object.assign({ ts: NOW - 29 * H, url: 'https://harbourpost.example.com.au/politics/federal-politics-live-gas-export-tax-' + d2.replace(/-/g, '') + '-p61bbb.html' }, g));
  const west = story('westpaper', 'Ferry towns count the cost of the gas export tax', Object.assign({ ts: NOW - 28 * H, url: 'https://westpaper.example.com.au/news/' + d2.replace(/-/g, '/') + '/ferry-towns-count-the-cost-of-the-gas-export-tax' }, g));
  const east = story('eastpaper', 'Gas export tax leaves ferry towns weighing the bill', Object.assign({ ts: NOW - 27 * H, url: 'https://eastpaper.example.com.au/business/ferry-towns-count-the-cost-of-the-gas-export-tax/news-story/0a1b2c3d' }, g));
  const north = story('northpaper', 'What the gas export tax means for the ferry towns', Object.assign({ ts: NOW - 26 * H, url: 'https://northpaper.example.com.au/' + d2 + '/ferry-towns-count-the-cost-of-the-gas-export-tax' }, g));
  await add(w, 'news', [live1, live2, day1, day2, west, east, north]);
  eq(T.denSlugKey(live1.url), 'federal-parliament-live-blog-' + md(d1), 'the day after the month stays in the slug');
  ok(T.denSlugKey(live1.url) !== T.denSlugKey(live2.url) && T.denSlugKey(day1.url) === T.denSlugKey(day2.url), 'two days, two slugs; the dated page keeps one slug a day');
  const a = await evidence(w, 'aep_au'); const one = re => a.M.filter(l => re.test(l));
  eq([one(/Senate opens debate/).length, one(/Crossbench deal passes/).length, one(/debate opens in the Senate chamber/).length, one(/won on the floor of the Senate/).length], [1, 1, 1, 1], 'each day\'s page reaches the model under its own headline: ' + a.M.map(l => l.slice(0, 80)).join(' // '));
  ok(!one(/Senate opens debate|Crossbench deal passes|debate opens in the Senate|won on the floor/).some(l => /also carried by/.test(l)), 'and none is another day\'s copy');
  const bm = re => a.board.media.find(m => re.test(m.title)) || {}; eq([bm(/Senate opens/).copies, bm(/Crossbench deal/).copies], [[idOf(w, live1.url)], [idOf(w, live2.url)]], 'the Board holds two stories');
  const W = one(/ferry towns/i); eq(W.length, 1, 'one story under addresses of one date, or one dated and one not, still folds: ' + W.join(' // '));
  ok(/also carried by 2 other outlets/.test(W[0] || ''), W[0]);
});

await S.t('RK11 engagement in words the reader rule allows: never "held", never "0 interactions in all"', async () => {
  const w = await mk(); const none = { eng: undefined, score: 0, comments: 0 }; const t0 = NOW - 8 * H;
  const lone = post('bluesky', 'Notes from the harbour forum on the gas export tax', { ts: NOW - 2 * H, meta: none });
  const ga = [0, 1, 2].map(i => post('bluesky', 'I just joined the harbour forum on the gas export tax, come along on the night', { url: 'https://bsky.app/profile/did:plc:forum' + i + '/post/3m' + i, ts: t0 + i * 600000, meta: none }));
  const gb = [0, 1, 2, 3].map(i => post('bluesky', 'Sign the pledge for a fair gas export tax that funds the harbour towns', { url: 'https://bsky.app/profile/did:plc:pledge' + i + '/post/3n' + i, ts: t0 + H + i * 600000, meta: i < 2 ? { eng: { likes: 5, reposts: 0, replies: 0, quotes: 0, views: 0 } } : none }));
  const gc = [0, 1, 2].map(i => post('youtube', 'Watch the harbour forum on the gas export tax in full on our channel', { url: 'https://www.youtube.com/watch?v=Hf0rum' + i, ts: t0 + 2 * H + i * 600000, meta: { eng: { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 400 } } }));
  await add(w, 'sig_thread', [lone].concat(ga, gb, gc));
  const a = await evidence(w, 'aep_au'); const line = re => a.S.find(l => re.test(l)) || ''; const sub = l => (a.ids.get(idIn(l)) || {}).sub || '';
  ok(/\| engagement not recorded$/.test(line(/Notes from the harbour forum/)), 'a post with no count: ' + line(/Notes from the harbour forum/));
  const A = line(/I just joined the harbour forum/); ok(/3 near-identical posts from 3 accounts, [^|]*, engagement not recorded: I just joined/.test(A) && /engagement not recorded$/.test(sub(A)), 'a group with none recorded says so: ' + A + ' // ' + sub(A));
  const B = line(/Sign the pledge/); ok(/4 near-identical posts from 4 accounts, [^|]*, 10 interactions in all \(recorded on 2 of the 4 posts\): Sign the pledge/.test(B), 'some recorded: the total, and on how many posts: ' + B);
  const C = line(/Watch the harbour forum/); ok(/3 near-identical posts, [^|]*, 1200 views in all: Watch the harbour forum/.test(C), 'views only: its views: ' + C);
  ok(!/\bheld\b|\b0 interactions\b/.test(a.S.join('\n') + a.S.map(sub).join('\n')), 'no line or card says "held" or "0 interactions": ' + a.S.filter(l => /\bheld\b|\b0 interactions\b/.test(l)).join(' // '));
});

await S.t('RK12 the line carries the card\'s figures, so a sentence written from the card is not flagged', async () => {
  const w = await mk(); const T = w.mod.__test; const title = 'Harbour levy divides the Senate as the gas export tax vote nears';
  const rows = Array.from({ length: 7 }, (_, i) => story('paper' + (i + 1), title, { ts: NOW - (2 + i * 0.2) * H, meta: Object.assign({ issues: ['gastax'] }, i === 0 ? { fb: { reactions: 300, comments: 40, shares: 22 } } : {}) }));
  await add(w, 'news', rows); const a = await evidence(w, 'aep_au'); const l = a.M.find(x => /Harbour levy divides/.test(x)) || ''; const id = idIn(l); const rec = a.ids.get(id) || {};
  ok(/\| also carried by 6 other outlets \(7 outlets in all\)/.test(l) && /\| Facebook: 300 reactions, 40 comments, 22 shares \(362 interactions in all\)/.test(l), 'the line: ' + l);
  ok(/carried by 7 outlets/.test(rec.sub) && /Facebook 362 interactions/.test(rec.sub), 'the card: ' + rec.sub);
  const c = T.denCleanText('The story was carried by 7 outlets [' + id + ']. It drew 362 interactions on Facebook [' + id + ']. Another 6 other outlets ran it [' + id + '].', a.ids);
  eq(c.unverified, [], 'nothing written from the card or the line is flagged');
  const bad = T.denCleanText('The story was carried by 9 outlets [' + id + '].', a.ids); eq(bad.unverified.map(u => u.figures), [['9 outlets']], 'a wrong count still is');
});

await S.t('RK13 a "Special Report" is sponsored only where the outlet\'s label means so', async () => {
  const w = await mk(); const T = w.mod.__test; (T.DEN_SPONSORED_HOSTS || []).push('pitchsheet.example.com.au');   // an invented outlet whose label marks a piece made with the company
  const own = story('pitchsheet', 'Harbour producer sets out its gas export tax plan', { ts: NOW - 2 * H, meta: { issues: ['gastax'] }, body: 'Three wells flowed strongly in testing at the harbour site Special Report: Pier Point Energy says the find could feed an export plan under the gas export tax.' });
  const wire = story('wirepaper', 'Special Report: Inside the fight over the gas export tax and who pays for it', { ts: NOW - 3 * H, meta: { issues: ['gastax'] }, body: 'An investigation into how the gas export tax was fought over in Canberra, drawing on documents and interviews.' });
  const quote = story('harbourgazette', 'Senate debates the gas export tax as the vote nears', { ts: NOW - 4 * H, meta: { issues: ['gastax'] }, body: 'Senators cited the energy agency\'s special report: demand for gas will fall within a decade, they said.' });
  await add(w, 'news', [own, wire, quote]); const a = await evidence(w, 'aep_au'); const line = re => a.M.find(l => re.test(l)) || '';
  ok(!/labelled 'Special Report'|made with the company/.test(line(/Inside the fight/)), 'a wire\'s investigation headed so is its own reporting: ' + line(/Inside the fight/));
  ok(!/labelled 'Special Report'|made with the company/.test(line(/Senate debates the gas/)), 'a summary quoting another body\'s special report is not a label: ' + line(/Senate debates the gas/));
  ok(/\| labelled 'Special Report', the outlet's label for a piece made with the company it is about \(its own disclosure was not read\)/.test(line(/Harbour producer sets out/)), 'that outlet\'s piece says the label and what it marks: ' + line(/Harbour producer sets out/));
  const bm = re => (a.board.media.find(m => re.test(m.title)) || {}).special; eq([bm(/Harbour producer/), bm(/Inside the fight/), bm(/Senate debates/)], [true, false, false], 'the Board says so too');
  const sys = T.denSys(a.desk); ok(/where a story's line calls "Special Report" the outlet's label for a piece made with the company it is about, that "Special Report" is the company's own material/.test(sys) && /never call it sponsored or paid for/.test(sys) && /A story whose headline merely says "Special Report" is the outlet's own reporting/.test(sys), 'the rule applies only where the line says made with the company');
});

await S.t('RK14 a story dated by its address prints its day, never a time', async () => {
  const w = await mk(); const T = w.mod.__test; const d = auDay(NOW - 24 * H); const day = Number(d.slice(8, 10)) + ' ' + MON[Number(d.slice(5, 7)) - 1];
  const url = 'https://harbourabc.example.com.au/news/' + d + '/gas-export-tax-hearing-told-of-delays/105000111'; const ts = T.feedUrlDate(url, NOW);
  ok(ts > NOW - 24 * H && ts <= NOW, 'an undated story under yesterday\'s address is stamped at the end of that day, inside the window: ' + new Date(ts).toISOString());
  const undated = story('harbourabc', 'Gas export tax hearing told of delays', { ts, url, meta: { issues: ['gastax'], urldate: 1 } });
  const dated = story('pointpost', 'Gas export tax vote set for the last sitting week', { ts: NOW - 3 * H, meta: { issues: ['gastax'] } });
  await add(w, 'news', [undated, dated]); const a = await evidence(w, 'aep_au'); const line = re => a.M.find(l => re.test(l)) || '';
  const u = line(/hearing told of delays/); eq(u.split(' | ')[1], day + ' (the date in its address)', 'its line gives the day and no time: ' + u);
  const sub = (a.ids.get(idIn(u)) || {}).sub || ''; ok(sub.indexOf('harbourabc.example.com.au, ' + day + ',') === 0 || sub === 'harbourabc.example.com.au, ' + day, 'and so does its card: ' + sub);
  ok(!/\d\d:\d\d/.test(u) && !/\d\d:\d\d/.test(sub), 'no time anywhere: ' + u + ' // ' + sub);
  eq((a.board.media.find(m => /hearing told of delays/.test(m.title)) || {}).urlDated, true, 'the Board marks it dated by its address');
  ok(/\| \d+ [a-z]{3} \d\d:\d\d \|/.test(line(/vote set for the last sitting week/)), 'a dated story keeps its time: ' + line(/vote set for the last/));
});

// ---- the second review of build p71 (lane evidence) ----
const zero = { likes: 0, reposts: 0, replies: 0, quotes: 0, views: 0 };

await S.t('RK15 a check on a post a back-filled post folds into a templated line points at that line', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const text = 'Harbour towns deserve their fair share of the gas export tax, sign the harbour pledge';
  const loud = Array.from({ length: 100 }, (_, i) => post('bluesky', 'Opinion ' + (i + 1) + ' on the gas export tax: the levy should fund the harbour towns before the Senate votes', { ts: NOW - (1 + (i % 20)) * H, meta: { eng: Object.assign({}, zero, { likes: 25 + i }) } }));
  // two copies of one text on the Board's list, and a third that drew nothing, past its 90 posts
  const copy = (k, h, likes) => post('bluesky', text, { url: 'https://bsky.app/profile/did:plc:pledge' + k + '/post/3p' + k, ts: NOW - h * H, meta: { eng: Object.assign({}, zero, { likes }) } });
  const a = copy('a', 6, 300), b = copy('b', 5, 300), c = copy('c', 4, 0); await add(w, 'sig_thread', loud.concat([a, b, c]));
  const [ia, ib, ic] = [a, b, c].map(p => idOf(w, p.url)); names(w, ib, 'psalliance', 'Pier Street Alliance', 'bluesky'); names(w, ic, 'hqgroup', 'Harbour Quay Group', 'bluesky');
  const s = await strip(w, 'aep_au'); const on = id => s.board.social.some(x => x.id === id);
  eq([on(ia), on(ib), on(ic)], [true, true, false], 'two copies on the Board\'s list, the third past its 90');
  const e1 = s.missed.signals.find(x => x.key === 'E:psalliance') || {}, e2 = s.missed.signals.find(x => x.key === 'E:hqgroup') || {};
  eq([e1.cover, e2.cover], [['S:' + ib], ['S:' + ic]], 'each check rests on the post that named it');
  const g = s.S.find(l => l.indexOf('[S:' + ia + '] ') === 0) || ''; ok(/^\[S:\d+\] bluesky \| 3 near-identical posts from 3 accounts, /.test(g), 'the back-filled post completes one templated line, under the first post: ' + g);
  ok(!s.ids.has('S:' + ib) && !s.ids.has('S:' + ic), 'the other two have no line of their own');
  ok(s.text.indexOf('- Pier Street Alliance is named on these issues for the first time in fourteen days ([S:' + ia + ']).') >= 0, 'the check on a listed copy points at the line: ' + (s.text.match(/^- Pier Street Alliance[^\n]*/m) || ['absent'])[0]);
  ok(s.text.indexOf('- Harbour Quay Group is named on these issues for the first time in fourteen days ([S:' + ia + ']).') >= 0, 'and so does the check on the back-filled post: ' + (s.text.match(/^- Harbour Quay Group[^\n]*/m) || ['absent'])[0]);
});

await S.t('RK16 the SOCIAL header counts the posts sent, a check\'s post past the Board\'s lists included', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  const mps = Array.from({ length: 145 }, (_, i) => post('x', 'Statement ' + (i + 1) + ' on the gas export tax from my office', { url: 'https://x.com/member' + i + '/status/1999000000000' + (100 + i), ts: NOW - (2 + (i % 15)) * H, meta: { platform: 'x', mp: { name: 'Alex Member ' + (i + 1), party: 'Independent' }, eng: Object.assign({}, zero, { likes: 30 + i }) } }));
  const quiet = post('bluesky', 'Harbour Quay Group joins the campaign for a gas export tax at the harbour', { ts: NOW - 2 * H, meta: { eng: zero } });
  await add(w, 'sig_thread', mps.concat([quiet])); const qid = idOf(w, quiet.url); names(w, qid, 'hqgroup', 'Harbour Quay Group', 'bluesky');
  const a = await strip(w, 'aep_au');
  eq([a.board.social.length, a.board.actors.length], [0, 60], 'the Board\'s 140 picked posts are all MPs\' posts: its list of other posts is empty');
  ok(a.S.some(l => l.indexOf('[S:' + qid + '] ') === 0), 'the post the check rests on reaches the model');
  const head = (a.text.match(/^SOCIAL \([^\n]*$/m) || [''])[0]; ok(/^SOCIAL \(1 post; 1 post shown, the most relevant first; /.test(head), 'the header counts the post it shows: ' + head);
});

await S.t('RK17 a post whose counts were read in part is never said to have drawn nothing', async () => {
  const w = await mk(); const TXT = n => 'A gas export tax would fund the harbour schools of Australia, post ' + n;
  const P = (code, n, eng) => ({ platform: 'instagram', url: 'https://www.instagram.com/p/' + code + '/', text: TXT(n), ts: NOW - 2 * H, q: 'gas export tax', eng });
  const GT = 'Every harbour town in Australia deserves its fair share of the gas export tax';
  const G = i => ({ platform: 'instagram', url: 'https://www.instagram.com/p/P71grp00' + i + '/', text: GT, ts: NOW - (4 + i) * H, q: 'gas export tax', eng: { likes: null, comments: 0 } });
  // the one way in, as Business Discovery sends a post whose account hides its likes (like_count absent), and a scrape that read one count
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [P('P71hidec01', 'hidden', { likes: null, comments: 0 }), P('P71likes01', 'liked', { likes: 0 }),
    P('P71zero002', 'zero', { likes: 0, comments: 0 }), P('P71hide002', 'commented', { likes: null, comments: 3 }), G(1), G(2), G(3)] });
  eq([r.status, r.body.kept], [200, 7], JSON.stringify(r.body).slice(0, 300));
  await add(w, 'sig_thread', [post('youtube', 'Watch the harbour forum on the gas export tax in full', { url: 'https://www.youtube.com/watch?v=Hv0view01', ts: NOW - 3 * H, meta: { platform: 'youtube', eng: { views: 0 } } })]);
  const a = await evidence(w, 'aep_au'); const line = re => a.S.find(l => re.test(l)) || ''; const sub = l => (a.ids.get(idIn(l)) || {}).sub || '';
  const hid = line(/post hidden \|/); ok(/\| 0 comments, likes not recorded$/.test(hid) && /, 0 comments, likes not recorded$/.test(sub(hid)), 'a hidden like count beside no comments: ' + hid + ' // ' + sub(hid));
  ok(/\| 0 likes, comments not recorded$/.test(line(/post liked \|/)), 'a like count alone: ' + line(/post liked \|/));
  ok(/\| 0 views, likes and comments not recorded$/.test(line(/harbour forum on the gas export tax in full/)), 'views alone: ' + line(/harbour forum on the gas export tax in full/));
  ok(/\| no interactions$/.test(line(/post zero \|/)), 'likes and comments both read at nought: ' + line(/post zero \|/));
  ok(/\| 3 comments$/.test(line(/post commented \|/)), 'what was read is said: ' + line(/post commented \|/));
  const grp = line(/near-identical posts/); ok(/ \| 3 near-identical posts, [^|]*, engagement not recorded: Every harbour town/.test(grp) && /, engagement not recorded$/.test(sub(grp)), 'a templated line of such posts: ' + grp + ' // ' + sub(grp));
  ok(!/no interactions/.test([hid, line(/post liked \|/), line(/harbour forum/), grp].join('\n')), 'none of them is said to have drawn nothing');
});

await S.t('RK18 the sponsored outlet\'s label is read as it writes it, never another body\'s special report it quotes', async () => {
  const w = await mk(); const T = w.mod.__test; (T.DEN_SPONSORED_HOSTS || []).push('pitchsheet.example.com.au');   // an invented outlet whose label marks a piece made with the company
  const own = story('pitchsheet', 'Harbour producer sets out a second drilling stage', { ts: NOW - 2 * H, meta: { issues: ['gastax'] }, body: 'Three wells flowed strongly in testing at the harbour site Special Report: Pier Point Energy says the find could feed an export plan under the gas export tax.' });
  const lower = story('pitchsheet', 'Gas demand to fall within a decade, energy agency says', { ts: NOW - 3 * H, meta: { issues: ['gastax'] }, body: 'Producers face a slower market under the gas export tax. The energy agency\'s special report: gas demand will fall within a decade as homes electrify.' });
  const cited = story('pitchsheet', 'Analysts weigh the energy agency outlook for gas', { ts: NOW - 4 * H, meta: { issues: ['gastax'] }, body: 'Analysts pointed to the energy agency\'s Special Report: Gas Demand to 2035, released overnight, in their notes on the gas export tax.' });
  const caps = story('pitchsheet', 'SPECIAL REPORT: Harbour producer maps its gas export tax exposure', { ts: NOW - 5 * H, meta: { issues: ['gastax'] }, body: 'The company set out its exposure to the gas export tax for investors.' });
  await add(w, 'news', [own, lower, cited, caps]); const a = await evidence(w, 'aep_au'); const line = re => a.M.find(l => re.test(l)) || '';
  const bm = re => (a.board.media.find(m => re.test(m.title)) || {}).special;
  eq([bm(/second drilling stage/), bm(/Gas demand to fall/), bm(/energy agency outlook/), bm(/^SPECIAL REPORT/)], [true, false, false, true], 'labelled only where the outlet writes its own label');
  ok(!/labelled 'Special Report'/.test(line(/Gas demand to fall/) + line(/energy agency outlook/)), 'a quoted report is not the label: ' + line(/Gas demand to fall/));
  ok(/labelled 'Special Report'/.test(line(/second drilling stage/)) && /labelled 'Special Report'/.test(line(/maps its gas export tax exposure/)), 'its own label is: ' + line(/second drilling stage/));
});

// ---- the third and fourth reviews of build p71 (lane evidence): the third's RK19 (F1) is a part of RK20's table ----

await S.t('RK20 the sponsored label: one table of every form any review has listed, the outlet\'s own label winning where the rounds disagreed', async () => {
  const w = await mk(); const T = w.mod.__test; (T.DEN_SPONSORED_HOSTS || []).push('pitchsheet.example.com.au');   // an invented outlet whose label marks a piece made with the company
  // [where it was listed, what it is, the text, its flag, where it sits, why, where the merges gave it other flags]. It sits in
  // the listed outlet's summary unless 'h' (that outlet's headline), 'x' (the headline of an outlet not listed) or 'xb' (that
  // outlet's summary); quillmine styles its name in lower case. The merges: fx1 3b71160, fx2 2ca1637, fx3 ecb2292.
  const Y = true, N = false;
  const W1 = 'fx1 labelled every "special report:" of the outlet, fx2 and fx3 did not (ST4, D4b): another body\'s report, named so on the label\'s line, or the words in lower case';
  const W2 = 'fx2 missed it, wanting a capital after the label; fx1 and fx3 labelled it (F1): the outlet\'s own label wins';
  const W3 = 'fx1 and fx2 labelled it, fx3 did not: named so on the label\'s line, a possessive or "the <name>" right before it and a report\'s title after it';
  const W4 = 'fx3 read a name heading the text, a sentence or a paragraph as a report\'s (so did fx2 before a lower-case word): the label, no possessive or "the <name>" stands right before it';
  const W5 = 'fx1 and fx2 labelled it, fx3 did not (an article or a possessive and a name before it): the label, a company and its verb follow it, not a report\'s title (Q1)';
  const W6 = 'fx1 and fx2 labelled it, fx3 did not: the label, a title and then a verb read as a company and its verb';
  const W7 = 'fx1 and fx2 labelled it, fx3 did not (it read the name across the line break): the label, a report is named so only on the label\'s own line (Q1)';
  const LABELS = [
    // ST4, the review of p71
    ['ST4', 'MCA 15: the label mid-summary, then the company and its verb', 'Three wells flowed strongly in testing at the harbour site Special Report: Pier Point Energy says the find could feed an export plan.', Y],
    ['ST4', 'the label opening the headline', 'Special Report: Harbour producer sets out its drilling plan', Y, 'h'],
    ['ST4', 'a wire\'s own investigation headed so', 'Special Report: Inside the fight over the gas export tax and who pays for it', N, 'x'],
    ['ST4', 'another outlet\'s summary quoting a body\'s special report', 'Senators cited the energy agency\'s special report: demand for gas will fall within a decade, they said.', N, 'xb'],
    ['ST4', 'a body\'s special report in lower case after a possessive', 'Producers face a slower market. The PEA\'s special report: gas demand falls within a decade as homes electrify.', N, '', W1],
    // D4 and D4b, the second review
    ['D4', 'the label after a full stop, then The and a common noun', 'Returns are forecast in the study. Special Report: The producer paid for this report on the gas export tax.', Y],
    ['D4b', 'a body\'s special report in lower case after a possessive', 'Producers face a slower market. The energy agency\'s special report: gas demand will fall within a decade.', N, '', W1],
    ['D4b', 'a body\'s special report in lower case after a curly possessive', 'Producers face a slower market under the gas export tax. The energy agency’s special report: gas demand will fall within a decade.', N, '', W1],
    ['D4b', 'a possessive and the report\'s title, then released', 'Analysts pointed to the energy agency\'s Special Report: Gas Demand to 2035, released overnight, in their notes on the gas export tax.', N, '', W1],
    ['D4b', 'a possessive and the report\'s title, then in', 'Analysts pointed to the energy agency\'s Special Report: Gas Demand to 2035 in their notes on the gas export tax.', N, '', W1],
    ['D4b', 'the real form: a standfirst, then the company and its verb', 'Drilling is under way as the program advances Special Report: Quill Mining has hit thick lithium at its northern project.', Y],
    ['D4b', 'the label opening the summary, then the company and its verb', 'Special Report: Pier Point Energy has begun drilling at the harbour under the gas export tax.', Y],
    ['D4b', 'a headline led by the label in capitals', 'SPECIAL REPORT: Harbour producer maps its gas export tax exposure', Y, 'h'],
    ['D4b', 'a headline quoting a body\'s report after a possessive', 'Gas outlook: the agency\'s Special Report: Gas Demand to 2035', N, 'h', W1],
    // F1, the third review
    ['F1', 'a company in lower case after the standfirst', 'Ore sorting trials are complete and drilling is under way Special Report: quillmine says its first holes hit lithium.', Y, '', W2],
    ['F1', 'a company in lower case opening the summary', 'Special Report: quillmine has lodged a mining lease application for its northern project.', Y, '', W2],
    ['F1', 'a quote mark', 'Assays are next as drilling advances Special Report: "We are ready to build," the managing director said.', Y, '', W2],
    ['F1', 'a curly quote mark', 'Assays are next as drilling advances Special Report: “We are ready to build,” the managing director said.', Y, '', W2],
    ['F1', 'a dollar figure', 'A placement closed oversubscribed as drilling advances Special Report: $12m will fund the next drilling stage.', Y, '', W2],
    ['F1', 'capitals in a summary', 'Assays are next as drilling advances SPECIAL REPORT: Pier Point Minerals has lodged its lease application.', Y, '', W2],
    ['F1', '"Special report:" in a summary', 'Assays are next as drilling advances Special report: quillmine says the find is its largest.', Y, '', W2],
    ['F1', 'a standfirst ending in a quoted word in s, curly', 'Drill results are ‘the best in years’ Special Report: Pier Point Minerals says the hits extend the zone.', Y, '', W2],
    ['F1', 'the PEA and a report\'s title, then in', 'Analysts pointed to the PEA Special Report: Gas Demand to 2035 in their notes on the gas export tax.', N, '', W3],
    ['F1', 'a possessive, a series and a report\'s title, then in', 'Analysts cited the PEA’s Regional Energy Outlook Special Report: The Role of Critical Minerals in their notes on the gas export tax.', N, '', W3],
    ['F1', 'the NSRO, a series and a report\'s title, then in', 'Producers cited the NSRO CostWatch Special Report: Costs Fall Again in their submissions on the gas export tax.', N, '', W3],
    ['F1', 'according to the NSRO and a series', 'Costs fell, according to the NSRO CostWatch Special Report: Hydrogen and Storage, released today.', N, '', W3],
    // F1's nearest cases, as the third round wrote them (its RK19): the outlet's label
    ['F1 lane', 'the real form, a standfirst and the company', 'First production is targeted for mid-2027, with early works under way Special Report: Pier Point Minerals could be producing lithium next year.', Y],
    ['F1 lane', 'a capital A that is a name, not an article', 'High-grade hits continue at Zone A Special Report: Pier Point Minerals has released its study.', Y, '', W2],
    ['F1 lane', 'a headline in capitals', 'SPECIAL REPORT: Pier Point Minerals maps its lithium exposure', Y, 'h'],
    ['F1 lane', 'a single curly quote mark', 'Assays are next as drilling advances Special Report: ‘We are ready to build,’ the managing director said.', Y, '', W2],
    ['F1 lane', 'a standfirst ending in a quoted word in s, straight', 'Drill results are \'the best in years\' Special Report: Pier Point Minerals says the hits extend the zone.', Y, '', W2],
    ['F1 lane', 'a standfirst and the company', 'Drill results are due as the resource estimate takes shape Special Report: Harbour Rare Earths has backed up its discovery.', Y],
    ['F1 lane', 'after a full stop, The and a common noun', 'Post-tax returns are forecast in the study. Special Report: The producer could be mining antimony early next year.', Y],
    ['F1 lane', 'a name after at', 'Drilling extends the zone at Quill Creek Special Report: Pier Point Minerals says the hits are its widest.', Y],
    ['F1 lane', 'a bare name after in', 'Drilling extends the zone in PX Special Report: Pier Point Minerals says the hits are its widest.', Y],
    ['F1 lane', 'a standfirst ending in a common word', 'The drilling is under way Special Report: Pier Point Minerals says the hits are its widest.', Y],
    ['F1 lane', 'a quoted phrase after an article', 'Results were called ‘a turning point’ Special Report: Pier Point Minerals says.', Y],
    ['F1 lane', 'the label opening its own paragraph', 'Drilling extends the zone\n\nSpecial Report: Pier Point Minerals says the hits are its widest.', Y],
    ['F1 lane', 'a body\'s report quoted first, then the label', 'The PEA\'s special report: demand will fall. Special Report: quillmine says it can supply the market.', Y, '', W2],
    ['F1 lane', 'Stage A', 'The explorer completes Stage A Special Report: Pier Point Minerals has released its study.', Y, '', W2],
    ['F1 lane', 'a possessive with no name after it', 'Pier Point’s shares jumped Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'an article and a word in -ed', 'The study is complete and the outlook improved Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a bare name after for', 'Drilling planned for PX Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a figure after an article', 'Pier Point is set for a 2027 start Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a sentence ending in a quote', 'Drill results were “the best in years.” Special Report: Pier Point Minerals says.', Y],
    ['F1 lane', 'an apostrophe inside a quote', 'Pier Point says ‘it’s the best in years’ Special Report: Pier Point Minerals says.', Y, '', W2],
    ['F1 lane', 'the anomaly', 'Pier Point drills the anomaly Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'the seabed', 'Pier Point maps minerals on the seabed Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a watershed', 'Pier Point calls the result a watershed Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'the supply needed', 'Pier Point signs an offtake to secure the supply needed Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'the rally', 'Lithium stocks surge ahead of the rally Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'the need', 'Pier Point ramps up output to meet the need Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a new breed', 'Pier Point is part of a new breed Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'as expected', 'Drilling results came in as expected Special Report: Pier Point Minerals has released its study.', Y],
    ['F1 lane', 'a lower-case body after an article', 'Analysts cited the energy agency Special Report: Gas Demand to 2035.', Y],
    // F1's nearest cases, as the third round wrote them: a report another body names
    ['F1 lane', 'the PEA and a report\'s title, then released', 'Analysts pointed to the PEA Special Report: Gas Demand to 2035, released overnight.', N, '', W3],
    ['F1 lane', 'a possessive, a series and a title, then released', 'Analysts pointed to the PEA’s Regional Energy Outlook Special Report: The Role of Critical Minerals, released overnight.', N, '', W3],
    ['F1 lane', 'a possessive, a series and a title, then a stop', 'Analysts pointed to the PEA\'s Regional Energy Outlook Special Report: The Role of Critical Minerals.', N, '', W3],
    ['F1 lane', 'a plural possessive, curly', 'Analysts pointed to the agencies’ Special Report: Gas Demand to 2035.', N, '', W1],
    ['F1 lane', 'a plural possessive, straight', 'Analysts pointed to the agencies\' Special Report: Gas Demand to 2035.', N, '', W1],
    ['F1 lane', 'a possessive and a title in capitals', 'Analysts pointed to the energy agency\'s Special Report: Gas Demand to 2035, released overnight.', N, '', W1],
    ['F1 lane', 'two bodies joined by and', 'Analysts cited a joint PEA and NSRO Special Report: Gas Demand to 2035, released overnight.', N, '', W3],
    ['F1 lane', 'two bodies joined by &', 'Analysts cited the PEA & NSRO Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'two bodies joined by /', 'Analysts cited the PEA/NSRO Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a body joined by of', 'Analysts cited the Bank of Pacifica Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a body joined by for', 'Analysts cited the Centre for Grid Policy Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a body joined by of the', 'Analysts cited the University of the Southern Coast Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a body named in brackets', 'Analysts cited the Pacific Energy Agency (PEA) Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a possessive and a name in brackets', 'Analysts cited the Pacific Energy Agency’s (PEA) Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'an acronym with points', 'Analysts cited the P.E.A. Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a year and a series', 'Analysts cited the 2025 CostWatch Special Report: Hydrogen Costs.', N, '', W3],
    ['F1 lane', 'a hyphened name', 'Analysts cited the PEA-led Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'an article alone', 'The agency released a Special Report: Gas Demand to 2035.', N, '', W1],
    ['F1 lane', 'its and latest', 'The agency released its latest Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a possessive, new and a series', 'Analysts cited the PEA’s new Regional Outlook Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'long-awaited', 'Analysts pointed to the agency’s long-awaited Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'much-anticipated', 'Analysts cited the agency’s much-anticipated Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'second', 'Analysts cited the agency’s second Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'updated', 'Analysts cited the agency’s updated Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'upcoming', 'Analysts cited the PEA’s upcoming Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'next', 'Analysts cited the PEA’s next Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'recently released', 'Analysts cited the agency’s recently released Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'its first-ever', 'Analysts cited its first-ever Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'weekly', 'Analysts cited the PEA’s weekly Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'eagerly awaited', 'Analysts cited the agency’s eagerly awaited Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'much anticipated', 'Analysts cited the agency’s much anticipated Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'revised', 'Analysts cited the agency’s revised Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'delayed', 'Analysts cited the agency’s delayed Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'government-commissioned', 'Analysts cited the government-commissioned Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'all in capitals', 'ANALYSTS CITED THE PEA SPECIAL REPORT: GAS DEMAND TO 2035.', N, '', W1],
    ['F1 lane', 'a possessive in capitals', 'Analysts cited the PEA’S SPECIAL REPORT: Gas Demand to 2035.', N, '', W1],
    ['F1 lane', 'according to and a name', 'Gas demand will fall, according to PEA Special Report: Gas Demand to 2035.', N, '', W3],
    ['F1 lane', 'a body\'s special report in lower case after an article', 'Analysts cited the energy agency special report: demand will fall within a decade.', N, '', W1],
    // F1's nearest cases that the third round read as a report's name, and the outlet's label wins (Q1's rule)
    ['F1 lane', 'a name heading a sentence', 'Gas use rose last year. PEA Special Report: demand will fall within a decade.', Y, '', W4],
    ['F1 lane', 'a name heading a headline', 'PEA Special Report: Gas demand to fall within a decade', Y, 'h', W4],
    ['F1 lane', 'a name heading a paragraph', 'Drilling extends the zone\n\nPEA Special Report: demand will fall within a decade.', Y, '', W4],
    ['F1 lane', 'a name after a sentence ending in a quote', 'Gas use rose last year." PEA Special Report: demand will fall within a decade.', Y, '', W4],
    ['F1 lane', 'a name heading the summary, then the company', 'Lithium Special Report: Pier Point Minerals has released its study.', Y, '', W4],
    ['F1 lane', 'an article and a name, then the company', 'Drilling extends the zone at the Quill Creek Special Report: Pier Point Minerals says the hits are its widest.', Y, '', W5],
    // Q1, the fourth review: a standfirst ending in an article, its or a possessive and a name, then the company and its verb
    ['Q1', 'in the <basin>', 'Drilling to start in the Quill Basin Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'in the <other basin>', 'Gas flows are due in the Harbour Basin Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'on the <exchange>', 'Pier Point is to list on the PSX Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'through to the DFS', 'Pier Point is fully funded through to the DFS Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'at the <name> Project', 'Drilling resumes at the Quill Hill Project Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'from the Government of <country>', 'Pier Point wins a licence from the Government of Pacifica Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'across the <name> Fold Belt', 'Pier Point holds ground across the Harbour Fold Belt Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'from the <state> Government', 'Pier Point wins approval from the NP Government Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'in the <region>', 'Pier Point pegs new ground in the Quillvale Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'in the <country\'s initials>', 'Pier Point eyes a second listing in the QX Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'in the <territory\'s initials>', 'Pier Point drills its first hole in the ST Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'in the <basin\'s name>', 'Pier Point drills its first hole in the Quillaroo Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'deliver its PFS', 'Pier Point is on track to deliver its PFS Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'to its <code> Resource', 'Pier Point adds tonnes to its QORC Resource Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'its Mt <name> Project', 'Pier Point steps up drilling at its Mt Quill Project Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'a company\'s DFS', 'Returns beat those forecast in Quill Tungsten\'s DFS Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'lodges a PFS', 'Company lodges a PFS Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'signs a MoU', 'Pier Point signs a MoU Special Report: Pier Point Energy has started its first well.', Y, '', W5],
    ['Q1', 'the label opening its own paragraph after a name', 'Drilling to start in the Quill Basin\n\nSpecial Report: Pier Point Energy has started its first well.', Y, '', W7],
    ['Q1', 'a full stop before the label', 'Drilling to start in the Quill Basin. Special Report: Pier Point Energy has started its first well.', Y],
    ['Q1', 'a dash before the label', 'Drilling to start in the Quill Basin – Special Report: Pier Point Energy has started its first well.', Y],
    // the rule's nearest cases on both sides (fx5): what follows the label, and the line it is on
    ['fx5', 'the company\'s ticker in brackets', 'Pier Point is to list on the PSX Special Report: Pier Point Energy (PSX:PPE) has started its first well.', Y, '', W5],
    ['fx5', 'the company\'s possessive', 'Pier Point is to list on the PSX Special Report: Pier Point Energy’s first well is under way.', Y, '', W5],
    ['fx5', 'a summary cut after the company', 'Pier Point is to list on the PSX Special Report: Pier Point Energy...', Y, '', W5],
    ['fx5', 'a title and then a verb, read as a company and its verb', 'Analysts cited the PEA Special Report: Gas Demand to 2035 shows demand will fall.', Y, '', W6],
    ['fx5', 'the name on the line before the label', 'Analysts cited the PEA\nSpecial Report: Gas Demand to 2035.', Y, '', W7],
    ['fx5', 'the title on the line after the label', 'Analysts cited the PEA Special Report:\nGas Demand to 2035.', Y, '', W7],
    ['fx5', 'the PEA and a report\'s title, then a stop', 'Analysts cited the PEA Special Report: Gas Demand to 2035.', N, '', W3],
    ['fx5', 'the PEA and a report\'s title, ending the text', 'Analysts cited the PEA Special Report: Gas Demand to 2035', N, '', W3],
    ['fx5', 'a possessive and a title, then which', 'Analysts cited the agency\'s Special Report: Gas Demand to 2035, which forecasts a fall.', N, '', W1],
  ]; // the table ends
  const rows = LABELS.map(([from, k, s, flag, at], i) => { const x = at === 'x' || at === 'xb', head = at === 'h' || at === 'x';
    return story(x ? 'coastwire' : 'pitchsheet', head ? s : (x ? 'Coast wire' : 'Pitch sheet') + ' piece ' + (i + 1) + ' on the gas export tax', { ts: NOW - (0.5 + i * 0.1) * H, meta: { issues: ['gastax'] }, body: head ? 'The company set out its position on the gas export tax for investors.' : s }); });
  await add(w, 'news', rows); const a = await evidence(w, 'aep_au'); const item = r => a.board.media.find(m => m.title === r.title);
  const name = x => x[0] + ', ' + x[1] + ': ' + x[2].slice(0, 90);
  eq(rows.filter(r => !item(r)).map(r => r.title), [], 'every row is a story of its own on the Board');
  eq(LABELS.filter((x, i) => !!(item(rows[i]) || {}).special !== x[3]).map(name), [], 'the Board flags each row as the table says');
  const RX = T.DEN_SPONSORED_RX; ok(RX instanceof RegExp, 'the rule is a test export');
  eq(LABELS.filter(x => x[4] !== 'x' && x[4] !== 'xb' && ((x[4] === 'h' && /^\s*special report\s*:/i.test(x[2])) || RX.test(x[2])) !== x[3]).map(name), [], 'and so does the rule alone');
  const sent = rows.map(r => [a.M.find(l => l.indexOf(r.title) >= 0), !!(item(r) || {}).special]).filter(x => x[0]); ok(sent.some(x => x[1]) && sent.some(x => !x[1]), 'pieces of both kinds reach the model: ' + sent.length);
  ok(sent.every(([l, sp]) => /labelled 'Special Report'/.test(l) === sp), 'each line says what its flag says: ' + sent.map(x => x[0].slice(0, 90)).join(' // '));
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
