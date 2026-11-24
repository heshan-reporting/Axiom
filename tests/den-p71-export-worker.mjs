/* Den build p71, the export lane (17 November 2026): the document a client receives, the recall measure, and feed links at
 * collection. The worker module in this process over SQLite; no provider is contacted (the model is a stub, every fetch is
 * answered here). Every outlet, account, person and address is invented. Each case fails on p70.
 *   EX1 one numbering: every [n] in the .md and the .html leads to Source List entry n with the same address; two ids with
 *       one address share a number (marks side by side print it once); the list writes its numbers as text, one count
 *       across its groups, each group in number order, never an auto-numbered list; the view's sourceList carries the same n,
 *       for a brief stored with fixed evidence and for one drafted through the model
 *   EX2 clean links: no &amp;, &#038;, utm_, ref or fbclid in either document or the view's Source List, for a brief stored
 *       before p71 (no dates, slug labels); a Google redirect with no better address stays as it is; a kept & is escaped once
 *   EX3 the header: the report's name (denTitle: by cadence, or the desk's own title), the client, "Date: <day> | Reporting
 *       window: <days with an en dash>", DRAFT on its own line until filed; the html title and the Slack summary's first line
 *   EX4 a rating prints under the section of its own id, else under the first momentum section, else after the summary
 *   EX5 the recall measure finds a story held under its feed's escape, with the feed's tracking query after it, with a
 *       trailing slash, and as a Google News row resolved to the report's link (written by fulltextSave and by the
 *       full-text pass, and by the bounded backfill for rows resolved before p71); a near miss is still not held
 *   EX6 feed and sitemap links are decoded at collection; collecting a feed again files no second copy of an item held under
 *       its escaped address from before p71; an undated item takes the day in its address (within thirty days)
 *   EX7 copy for the document as plain text (docs/den-brief.js): the body only, a blank line after each block, no tag, no
 *       entity, no title or stylesheet, the Source List's numbers kept
 *   The review fixes (draft lane, each fails on df42fb8):
 *   EX8 (EX1, EX6) the Firearms desk's three ratings all print under its momentum assessment, never "Media risk" under News
 *       environment (its id's content section), also when News environment is not written; a rating whose place was not
 *       written falls to the next place down (the momentum section, after the summary, the header) instead of being left
 *       out; a section hidden in Options is no rating's home
 *   EX9 (EX4) the Source List is headed with the desk's own title for it (escaped once in the html), else "Source List"
 *   EX10 (EX5) the view's evidence addresses are the ones a reader opens (feed escapes decoded, tracking struck), as the
 *       Source List gives them, for a brief stored before p71 too
 *   EX11 (EX3) a measure line (an issue above its usual volume, or against the window before) reads on the page as its
 *       issue, named by its measure since C5 ("Above baseline: <issue>", "Window before: <issue>"), whole words or an
 *       ellipsis, with its own icon, and its card is headed "Figure"
 *   EX12 (CK11, the page) a figure flag on a sentence with no valid citation (the worker's bare entry) says "is not in the
 *       evidence", on a cited one "is not in the row it cites"; a sentence that needs a source and holds such a figure is one
 *       flag, said once, and counted once in its section's state
 *   EX13 (CO5) a post card's count says what its evidence line says: "no interactions" for a post counted at nothing, its
 *       views when they are its only count, "engagement not recorded" (the line's words since EV5, C6) only for one with none
 *   The second review round (cron lane: the page; each fails on 3b71160):
 *   EX14 (C5) an issue's two figures cited in one sentence read apart: each chip names its measure ("Above baseline",
 *       "Window before"; a post's reach "Unusual reach"), none needs a number to tell it from the other
 *   EX15 (C6) a post card says what the worker's evidence line for the same post says: "engagement not recorded" for none
 *       counted, "no interactions" for counted at nothing, and its counts (the tooltip) for one counted; since p71 fx5 (R1)
 *       the comments read under it too, the card's whole words against the line's
 *   EX16 (C7, CK3) an upcoming card is keyed by its row (or its parliament record) as well as its day and event, so eight
 *       towns' vigils on one day are eight cards, and each is cited by the U: line of its own row
 *   EX17 (C8) a story dated by its address shows its day on its Board card in the evidence line's words, never a time;
 *       since p71 fx5 (R2) word for word ("16 nov"), the Board handing each card its window's year
 *   EX18 (C4) a draft refused with 409 brief_changed shows the brief the worker sent back at once, and its note says the
 *       report was changed while it was being written (p72's words, with no worker sentence), never that nothing here changed
 *   The third review round (page lane: the page; each fails on 2ca1637):
 *   EX19 (G1, D3) a post read in part says on its card what its evidence line says: each count it read at nought, then
 *       the main ones not recorded ("0 comments, likes not recorded": an Instagram account that hides its likes; "0 views,
 *       likes and comments not recorded"), an actor's post too, never "no interactions", and its tooltip names what was not
 *       recorded; a post whose likes and comments were both read at nought still says "no interactions"; a post's counts
 *       are listed in its line's order (EX13's order changed with it)
 *   EX20 (G2) the comments under a post or an actor's post are counted on its card as its line counts them: "3 comments
 *       read", "1 comment read", never "held" (since p71 fx5, R1, the actor's P: line counts them too)
 *   EX21 (G3) a stale story its feed gave a time is dated on its Board card by its address, in its line's words; the page
 *       dates it as its evidence record does, so its weight never says "in the last six hours"; an address-dated story's
 *       weight says it was found then; the Brief's evidence card says either one's day, never hours ago; since p71 fx5 (R2)
 *       the Board card's and the Brief card's day are the line's, word for word
 *   EX22 (G2, beside the count) the tone of the comments read under a post is said on its card in its line's words and
 *       on its line's bounds ("mostly negative" for a mean of -0.3 or -0.17, never "hostile" or "mixed"), an actor's post
 *       too, its colour by the same words, and the chip says whose tone it is (since p71 fx5, R1, each mean rests on three
 *       comments: a tone resting on fewer is not said)
 *   The fifth fix round (page lane; each fails on ecb2292):
 *   EX23 (R1) the comments that carry a tone are counted beside those read (toned), and a tone is said only when three or
 *       more carry one: "10 comments read (6 with a tone reading), mostly negative"; one of ten at -0.6, or two of two, no
 *       tone at all; the post card and the actor card say the line's words (the count, then the chip), the chip's title
 *       whose tone it is ("The tone of the 6 of the 10 comments read under it that have a tone reading"), and an actor's
 *       P: line now counts its comments too; a Board from an older worker (no toned) reads as before
 *   EX24 (R2) a story's address day on its Board card and its Brief card is the line's, word for word: the line's months
 *       ("5 sep", "5 jun", never "5 Sept" or "June"), and the year when it is not the window's ("4 mar 2019"), for twelve
 *       stories whose addresses are from 2019 and one from this week; the evidence card's figures say the same day
 *   The round-4 cron lane (the page's own toCards and citeOf over the worker's own Board and brief; each fails on 2ca1637;
 *   its K1 case is set aside with K1's fold, which the integration left out, and its K4 case with K4, which EX21 and EX24 cover):
 *   EX25 (K3) a row's date card and two inquiries' recorded hearings with one day and event are three cards, each cited by
 *       its own U: line (a recorded line carries its record); a brief stored before still finds a record by its label
 * Run: node --experimental-sqlite tests/den-p71-export-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Den p71, the export lane: the document, the Source List, the recall measure, feed links');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, D = 86400000, NOW = Date.now();
const DASH = String.fromCharCode(8211);
const syd = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const words = t => { const [y, m, d] = syd(t).split('-'); return Number(d) + ' ' + MON[Number(m) - 1] + ' ' + y; };
const dec = s => String(s).replace(/&amp;/g, '&');
const row = (w, sql, ...a) => w.env.MIND_DB.db.prepare(sql).get(...a);
const rows = (w, sql, ...a) => w.env.MIND_DB.db.prepare(sql).all(...a);
const push = async (w, kind, list) => { const r = await F(w, 'POST', '/archive/add', { kind, rows: list }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
// a brief as the database holds it, written here with fixed evidence (the way tests/den-release-worker.mjs DR3 stores one)
const store = async (w, o) => { await F(w, 'GET', '/den/desks');
  const sections = {}; Object.keys(o.sections).forEach(k => { sections[k] = { text: o.sections[k], cites: Array.from(new Set((o.sections[k].match(/\[[A-Z]:[^\]]+\]/g) || []).map(x => x.slice(1, -1)).filter(id => o.ids[id]))) }; });
  w.env.MIND_DB.db.prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES(?,?,?,?,?,?,?,1,?,?,?,'claude','Anne',?,?)")
    .run(o.id, o.desk || 'aep_au', o.day || '2026-11-17', o.hours || 24, NOW - 26 * H, NOW - 2 * H, o.status || 'draft', JSON.stringify(sections), JSON.stringify(o.ratings || {}), JSON.stringify({ ids: o.ids, label: o.label || '16-17 November 2026', missed: [] }), NOW - 2 * H, NOW - 2 * H); };
const doc = async (w, id, fmt) => (await F(w, 'GET', '/den/brief?id=' + id + (fmt ? '&format=' + fmt : ''), null, 'read-key'));
// the parse both documents get: every mark, and every Source List entry, as [number, address]
const mdMarks = md => Array.from(md.matchAll(/\[\[(\d+)\]\((https?:\/\/[^)\s]+)\)\]/g)).map(m => [+m[1], m[2]]);
const mdList = md => Array.from((md.split('## Source List')[1] || '').matchAll(/^\[(\d+)\] (.*) - (https?:\/\/\S+)$/gm)).map(m => [+m[1], m[3], m[2]]);
const htMarks = h => Array.from(h.matchAll(/<sup><a href="([^"]+)">\[(\d+)\]<\/a><\/sup>/g)).map(m => [+m[2], dec(m[1])]);
const htList = h => Array.from(h.matchAll(/<p class="src">\[(\d+)\] (.*?) - <a href="([^"]+)">/g)).map(m => [+m[1], dec(m[3]), m[2]]);
const resolves = (marks, list, what) => { const by = new Map(); list.forEach(e => { ok(!by.has(e[0]), what + ': entry ' + e[0] + ' is listed twice'); by.set(e[0], e[1]); });
  eq(Array.from(by.keys()).sort((a, b) => a - b), list.map((e, i) => i + 1), what + ': the entries are numbered 1 to ' + list.length + ' once each');
  ok(marks.length > 0, what + ': it has marks'); marks.forEach(m => eq(by.get(m[0]), m[1], what + ': mark [' + m[0] + '] leads to entry ' + m[0] + ' with its address')); return by; };

const T1 = NOW - 20 * H, T2 = NOW - 18 * H, T3 = NOW - 14 * H, T4 = NOW - 10 * H, T5 = NOW - 6 * H;
const EX1_IDS = {
  'M:101': { k: 'media', label: 'pointpost - Harbour levy divides the Senate', url: 'https://pointpost.example.com.au/a', gated: 0, item: 101, ts: T1, line: 'pointpost | Harbour levy divides the Senate' },
  'M:102': { k: 'media', label: 'The Tribune - Producers answer the levy', url: 'https://tribune.example.com.au/b?utm_source=rss', gated: 0, item: 102, ts: T2, line: 'The Tribune | Producers answer the levy' },
  'M:103': { k: 'media', label: 'coastwire - Levy vote set for Thursday', url: 'https://coastwire.example.com.au/c', gated: 0, item: 103, ts: T3, line: 'coastwire | Levy vote set for Thursday' },
  'M:104': { k: 'media', label: 'Smith & Jones Media - A story with an ampersand', url: 'https://smith.example.com.au/x?a=1&b=2', gated: 0, item: 104, ts: T3, line: 'Smith & Jones Media | A story' },
  'S:201': { k: 'social', label: 'x post', url: 'https://x.com/i/web/status/190000000000000201', gated: 0, item: 201, platform: 'x', ts: T4, line: 'x | 16 nov 09:00 | words | 5 likes' },
  'S:202': { k: 'social', label: 'bluesky post', url: 'https://bsky.app/profile/harbourwatch.example.com.au/post/3kabc12', gated: 0, item: 202, platform: 'bluesky', ts: T5, line: 'bluesky | 16 nov 13:00 | words | 3 likes' },
  'P:301': { k: 'actor', label: 'Jane Harbour on x', url: 'https://x.com/i/web/status/190000000000000301', gated: 0, item: 301, line: 'Jane Harbour (MP) on x | 16 nov | words | 9 likes' },
  'U:1': { k: 'upcoming', label: '2026-11-20 vote', url: 'https://tribune.example.com.au/b', gated: 0, item: 102, line: 'Friday 2026-11-20 | vote | The vote is on 20 November' },
  'N:n1': { k: 'narrative', label: 'Levy as a cash grab', url: '', gated: 0, item: 0, line: '"Levy as a cash grab" | claim: x' },
  'T:gastax': { k: 'tone', label: 'Gas taxation', url: '', gated: 0, item: 0, line: 'Gas taxation: 9 rows judged, mean tone -0.2, 5 negative, 2 positive' },
};
const EX1_SECTIONS = {
  summary: 'The levy led the press [M:101][S:201]. Producers answered it [M:102] and a vote is due [U:1]. A narrative grew [N:n1].\n\nThe Tribune and the vote share one page [M:102][U:1].',
  media: 'The Tribune ran the producers\' case [M:102]. Coastwire carried the vote [M:103].',
  social: 'A post on Bluesky drew attention [S:202]. A post on X led it [S:201].',
  actors: 'A registered MP spoke [P:301].',
  sentiment: 'Tone was mixed [T:gastax].',
  bottom: 'Activity is steady [M:101]. One more outlet ran it [M:104].',
};

await S.t('EX1 one numbering for the text and the Source List', async () => {
  const w = await mk(); await store(w, { id: 'bx1', ids: EX1_IDS, sections: EX1_SECTIONS });
  const view = (await doc(w, 'bx1')).body.brief; const md = (await doc(w, 'bx1', 'md')).text; const htm = (await doc(w, 'bx1', 'html')).text;
  // the view: each item carries its number; the groups keep the report's order, each in number order, numbers across groups
  const got = {}; view.sourceList.forEach(g => g.items.forEach(i => { got[i.id] = i.n; }));
  eq(got, { 'M:101': 1, 'M:102': 3, 'M:103': 4, 'M:104': 7, 'S:201': 2, 'S:202': 5, 'P:301': 6 }, 'numbered in the order each first appears in the text, sections in the desk\'s order');
  eq(view.sourceList.map(g => [g.group, g.items.map(i => i.n)]), [['Traditional media', [1, 3, 4, 7]], ['Social media', [2, 5]], ['Influencer and political', [6]]], 'grouped, one count across the groups; the date read from a story is its entry, not an Upcoming one');
  // both documents: every mark resolves to the entry with its number and the same address
  const mL = resolves(mdMarks(md), mdList(md), 'the .md'); const hL = resolves(htMarks(htm), htList(htm), 'the .html');
  view.sourceList.forEach(g => g.items.forEach(i => { eq(mL.get(i.n), i.url, 'the .md entry ' + i.n + ' is the view\'s'); eq(hL.get(i.n), i.url, 'the .html entry ' + i.n + ' is the view\'s'); }));
  // two ids with one address share a number; side by side they print it once
  ok(/Producers answered it \[\[3\]\(https:\/\/tribune\.example\.com\.au\/b\)\] and a vote is due \[\[3\]\(https:\/\/tribune\.example\.com\.au\/b\)\]\./.test(md), 'M:102 and U:1 share [3]: ' + (md.match(/Producers answered[^\n]*/) || [''])[0]);
  ok(/share one page \[\[3\]\(https:\/\/tribune\.example\.com\.au\/b\)\]\.\n/.test(md), 'marks side by side that share an address print it once: ' + (md.match(/share one page[^\n]*/) || [''])[0]);
  ok(/A narrative grew\.\n/.test(md) && /Tone was mixed\.\n/.test(md), 'a citation of a row with no address still prints nothing');
  // the list writes its numbers as text, never as an auto-numbered list
  ok(!/^\d+\. /m.test(md) && !/<ol|<li/.test(htm), 'no "1." lines and no <ol>: a paste or a Markdown reader would number them again');
  ok(/^\[1\] pointpost - Harbour levy divides the Senate, \d{1,2} [A-Z][a-z]+ 20\d\d - https:\/\/pointpost\.example\.com\.au\/a$/m.test(md), 'an entry: [n] label, date - address: ' + (md.match(/^\[1\][^\n]*/m) || [''])[0]);
  ok(md.indexOf('[1] pointpost - Harbour levy divides the Senate, ' + words(T1) + ' - ') >= 0, 'the date is the row\'s own day in Sydney');
  ok(/^\[2\] X post, [^\n]* - https:\/\/x\.com\/i\/web\/status\/190000000000000201$/m.test(md) && /^\[5\] Bluesky post, /m.test(md) && /^\[6\] Jane Harbour on X - https:/m.test(md), 'a social entry is "<Platform> post" and its date; an actor keeps the name the register gives');
  ok(/<p class="src">\[3\] The Tribune - Producers answer the levy, [^<]* - <a href="https:\/\/tribune\.example\.com\.au\/b">https:\/\/tribune\.example\.com\.au\/b<\/a><\/p>/.test(htm), 'the html entry writes its number as text too');
  const lines = md.split('## Source List')[1].split('\n'); ok(lines.filter(l => /^\[\d+\] /.test(l)).every(l => lines[lines.indexOf(l) + 1] === ''), 'each entry its own paragraph, so a Markdown reader keeps one a line');
  // a brief drafted through the model: the same rule end to end
  const w2 = await mk(); await F(w2, 'GET', '/sentiment/status');
  await push(w2, 'news', [{ src: 'pointpost', title: 'Harbour levy divides the Senate', body: 'The Senate will debate a gas export tax this week.', url: 'https://pointpost.example.com.au/a?utm_source=rss', ts: NOW - 5 * H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } },
    { src: 'tribune', title: 'Producers answer the windfall tax push', body: 'Producers set out their case.', url: 'https://tribune.example.com.au/p', ts: NOW - 3 * H, meta: { issues: ['gastax'], source: 'tribune', reg: 1 } }]);
  await push(w2, 'sig_thread', [{ src: 'x', title: 'x post', body: 'The windfall tax on gas is overdue.', url: 'https://x.com/i/web/status/190000000000000777', ts: NOW - 4 * H, meta: { platform: 'x', issues: ['gastax'], id: 'p777', eng: { likes: 40 }, score: 40, comments: 0, layers: [2] } }]);
  w2.answer(/api\.anthropic\.com/, (u, init) => { const ev = JSON.parse(init.body).messages[0].content; const ids = k => (ev.match(new RegExp('\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'g')) || []).map(x => x.slice(1, -1));
    const j = { sections: { summary: 'Producers answered [' + ids('M')[1] + ']. A post drew attention [' + ids('S')[0] + ']. The levy led [' + ids('M')[0] + '].', media: 'The levy story ran [' + ids('M')[0] + '][' + ids('M')[1] + '].', bottom: 'Steady [' + ids('M')[0] + '].' }, ratings: {} };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  const br = (await F(w2, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; ok(br && br.id, 'drafted');
  const md2 = (await doc(w2, br.id, 'md')).text, h2 = (await doc(w2, br.id, 'html')).text; resolves(mdMarks(md2), mdList(md2), 'a drafted .md'); resolves(htMarks(h2), htList(h2), 'a drafted .html');
  ok(br.sourceList.every(g => g.items.every(i => i.n > 0)), 'the drafted brief\'s view carries n');
  ok(/^Producers answered \[\[1\]\(https:\/\/[^)]+\)\]\. A post drew attention \[\[2\]\(https:\/\/x\.com\/i\/web\/status\/190000000000000777\)\]\. The levy led \[\[3\]\(https:\/\/[^)]+\)\]\.$/m.test(md2), 'numbered as the text first cites them, whatever the group: ' + (md2.match(/^Producers[^\n]*/m) || [''])[0]);
  eq(br.sourceList.map(g => [g.group, g.items.map(i => i.n)]), [['Traditional media', [1, 3]], ['Social media', [2]]], 'and listed by group, in number order');
  ok(!/utm_/.test(md2 + JSON.stringify(br.sourceList)), 'the drafted brief\'s addresses are clean too');
});

await S.t('EX2 clean links in both documents, for a brief stored before p71 too', async () => {
  const w = await mk();
  const ids = { 'M:401': { k: 'media', label: 'ninenews_pol - A story on the levy', url: 'https://www.ninenews.example.com.au/policy/a-story-20261116-p5xyz1?ref=rss&amp;utm_medium=rss&amp;utm_source=rss_feed', gated: 0, item: 401, line: 'ninenews_pol | 16 nov 08:00 | A story on the levy' },
    'M:402': { k: 'media', label: 'reneweconomy - A WordPress story', url: 'https://renew.example.com.au/b-story/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=b-story', gated: 0, item: 402, line: 'reneweconomy | A WordPress story' },
    'M:403': { k: 'media', label: 'gnews_aep - A story only Google gave', url: 'https://news.google.com/rss/articles/CBMiTESTabc?oc=5', gated: 0, item: 403, line: 'gnews_aep | A story only Google gave' },
    'S:404': { k: 'social', label: 'x post', url: 'https://x.com/i/web/status/190000000000000404?ref_src=twsrc&fbclid=abc123', gated: 0, item: 404, line: 'x | 16 nov 09:10 | words | 12 likes' },
    'M:405': { k: 'media', label: 'shirenews - A page with two parameters', url: 'https://shire.example.com.au/news/item?id=7&amp;page=2', gated: 0, item: 405, line: 'shirenews | A page with two parameters' } };
  await store(w, { id: 'bold2', ids, sections: { summary: 'Producers spoke [M:401]. A WordPress site agreed [M:402]. Google carried it [M:403]. A post took it up [S:404]. A shire page ran it [M:405].' } });
  const view = (await doc(w, 'bold2')).body.brief; const md = (await doc(w, 'bold2', 'md')).text; const htm = (await doc(w, 'bold2', 'html')).text;
  const BAD = /&amp;|&#0*38;|utm_|[?&]ref=|ref_src|fbclid/;
  ok(!BAD.test(md), 'the .md holds no escape or tracking: ' + (md.match(new RegExp('.{0,60}(' + BAD.source + ').{0,20}')) || [''])[0]);
  const hrefs = Array.from(htm.matchAll(/href="([^"]+)"/g)).map(m => dec(m[1])); ok(hrefs.length >= 10 && hrefs.every(h => !BAD.test(h)), 'nor does any link of the .html: ' + hrefs.filter(h => BAD.test(h)).join(' '));
  ok(!/&amp;amp;|&#038;/.test(htm), 'and nothing is escaped twice');
  ok(view.sourceList.every(g => g.items.every(i => !BAD.test(i.url))), 'nor the Source List the page shows');
  const want = [[1, 'https://www.ninenews.example.com.au/policy/a-story-20261116-p5xyz1'], [2, 'https://renew.example.com.au/b-story/'], [3, 'https://news.google.com/rss/articles/CBMiTESTabc?oc=5'], [5, 'https://shire.example.com.au/news/item?id=7&page=2'], [4, 'https://x.com/i/web/status/190000000000000404']];
  eq(mdList(md).map(e => [e[0], e[1]]), want, 'each address as a reader opens it; a Google redirect with no better address stays as it is');
  resolves(mdMarks(md), mdList(md), 'the stored .md'); resolves(htMarks(htm), htList(htm), 'the stored .html');
  ok(/href="https:\/\/shire\.example\.com\.au\/news\/item\?id=7&amp;page=2"/.test(htm), 'an ampersand the address keeps is escaped once in the html');
  ok(/^\[2\] reneweconomy - A WordPress story - https:\/\/renew\.example\.com\.au\/b-story\/$/m.test(md), 'a stored brief has no date: the entry is its label and its address');
});

await S.t('EX3 the header: the report, the client, the date and the window, DRAFT', async () => {
  const w = await mk(); const S1 = { summary: 'The levy led the press [M:101].', bottom: 'Steady [M:101].' };
  await store(w, { id: 'bx3', ids: { 'M:101': EX1_IDS['M:101'] }, sections: S1 });
  const md = (await doc(w, 'bx3', 'md')).text, htm = (await doc(w, 'bx3', 'html')).text, sl = (await doc(w, 'bx3', 'slack')).text; const when = 'Date: 17 November 2026 | Reporting window: 16' + DASH + '17 November 2026';
  ok(md.indexOf('# Daily Activist Activity Brief\n\nAustralian Energy Producers\n\n' + when + '\n\nDRAFT\n\n## Executive Summary') === 0, 'the .md opens with her header: ' + JSON.stringify(md.slice(0, 160)));
  ok(htm.indexOf('<title>Daily Activist Activity Brief - Australian Energy Producers - 17 November 2026 - DRAFT</title>') > 0, 'the html title follows it');
  ok(htm.indexOf('<body><h1>Daily Activist Activity Brief</h1><p class="client">Australian Energy Producers</p><p class="sub">' + when + '</p><p class="draft">DRAFT</p><h2>') > 0, 'and its body opens the same way');
  eq(sl.split('\n')[0], '*Daily Activist Activity Brief* - Australian Energy Producers | ' + when + ' (draft)', 'the Slack summary\'s first line follows it');
  ok(!/AEP national/.test(md + htm + sl), 'the internal desk name is not the report\'s');
  w.env.MIND_DB.db.prepare("UPDATE den_briefs SET status='filed', filed_by='Anne', filed_at=? WHERE id='bx3'").run(NOW);
  const fmd = (await doc(w, 'bx3', 'md')).text, fh = (await doc(w, 'bx3', 'html')).text, fsl = (await doc(w, 'bx3', 'slack')).text;
  ok(fmd.indexOf('# Daily Activist Activity Brief\n\nAustralian Energy Producers\n\n' + when + '\n\n## Executive Summary') === 0 && !/DRAFT/.test(fmd + fh) && !/\(draft\)/.test(fsl), 'a filed brief carries no DRAFT');
  // a weekly desk by its cadence, a desk with its own title, and a window across two months
  const mca = (await F(w, 'GET', '/den/desks')).body.desks.find(d => d.id === 'mca_au');
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET cadence='weekly', options=? WHERE id='mca_au'").run(JSON.stringify({ hidden: [], minEng: {}, fold: true, density: 'regular', mutes: [], title: 'Weekly Mining Sentiment Report' }));
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET cadence='weekly' WHERE id='aep_vic'").run();
  await store(w, { id: 'bx3w', desk: 'mca_au', day: '2026-11-03', hours: 168, label: '27 October-3 November 2026', ids: { 'M:101': EX1_IDS['M:101'] }, sections: S1 });
  await store(w, { id: 'bx3v', desk: 'aep_vic', day: '2026-11-03', hours: 168, label: '27 October-3 November 2026', ids: { 'M:101': EX1_IDS['M:101'] }, sections: S1 });
  const wmd = (await doc(w, 'bx3w', 'md')).text; ok(wmd.indexOf('# Weekly Mining Sentiment Report\n\n' + mca.client + '\n\nDate: 3 November 2026 | Reporting window: 27 October' + DASH + '3 November 2026\n\nDRAFT\n') === 0, 'the desk\'s own title, and an en dash across two months: ' + JSON.stringify(wmd.slice(0, 160)));
  ok((await doc(w, 'bx3v', 'md')).text.indexOf('# Weekly Activist Activity Brief\n\nAustralian Energy Producers\n\n') === 0, 'a weekly desk with no title of its own is the weekly brief');
});

await S.t('EX4 ratings print where they belong', async () => {
  const w = await mk(); await F(w, 'GET', '/den/desks');
  // the weekly MCA desk's shape: its rating is "Overall assessment" under "Overall sentiment rating"; a second item has no section of its own
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET sections=?, ratings=? WHERE id='mca_au'").run(JSON.stringify([{ id: 'summary', kind: 'summary', title: 'Executive summary' }, { id: 'sentiment', kind: 'sentiment', title: 'Overall sentiment rating' }, { id: 'drivers', kind: 'developments', title: 'Key drivers' }, { id: 'week_on_week', kind: 'momentum', title: 'Week-on-week comparison' }, { id: 'closing', kind: 'bottom', title: 'Summary' }, { id: 'sources', kind: 'sources', title: 'Sources' }]),
    JSON.stringify({ levels: ['Negative', 'Neutral to mixed', 'Positive'], trends: ['Improving', 'Stable', 'Deteriorating'], items: [{ id: 'sentiment', label: 'Overall assessment', trend: true }, { id: 'pace', label: 'Pace of activity', trend: false }] }));
  const ids = { 'M:101': EX1_IDS['M:101'] };
  await store(w, { id: 'bx4', desk: 'mca_au', ids, sections: { summary: 'The week in brief [M:101].', sentiment: 'Sentiment leaned negative [M:101].', drivers: 'The driver was the levy [M:101].', week_on_week: 'Activity rose on last week [M:101].', closing: 'Watch the vote [M:101].' }, ratings: { sentiment: { level: 'Neutral to mixed', trend: 'Stable' }, pace: { level: 'Positive', trend: '' } } });
  const md = (await doc(w, 'bx4', 'md')).text, htm = (await doc(w, 'bx4', 'html')).text; const sec = t => (md.split('## ' + t + '\n')[1] || '').split('\n## ')[0];
  ok(/^\n\*\*Overall assessment:\*\* Neutral to mixed, Stable\n/.test(sec('Overall sentiment rating')), 'the rating is under the section of its own id: ' + JSON.stringify(sec('Overall sentiment rating').slice(0, 80)));
  ok(!/Overall assessment/.test(sec('Week-on-week comparison')) && /^\n\*\*Pace of activity:\*\* Positive\n/.test(sec('Week-on-week comparison')), 'not under the momentum section; an item with no section of its own is: ' + JSON.stringify(sec('Week-on-week comparison').slice(0, 80)));
  ok(/<h2>Overall sentiment rating<\/h2><p><strong>Overall assessment:<\/strong> Neutral to mixed, Stable<\/p>/.test(htm) && /<h2>Week-on-week comparison<\/h2><p><strong>Pace of activity:<\/strong> Positive<\/p>/.test(htm), 'the html the same');
  // a desk with no momentum section: after the summary
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET sections=? WHERE id='aep_vic'").run(JSON.stringify([{ id: 'summary', kind: 'summary', title: 'Executive Summary' }, { id: 'media', kind: 'media', title: 'Traditional Media Coverage' }, { id: 'bottom', kind: 'bottom', title: 'Bottom Line' }, { id: 'sources', kind: 'sources', title: 'Source List' }]));
  await store(w, { id: 'bx4v', desk: 'aep_vic', ids, sections: { summary: 'The day in brief [M:101].', media: 'The press ran it [M:101].', bottom: 'Steady [M:101].' }, ratings: { momentum: { level: 'Moderate', trend: 'Stable' } } });
  const vmd = (await doc(w, 'bx4v', 'md')).text, vh = (await doc(w, 'bx4v', 'html')).text;
  ok(/## Executive Summary\n\nThe day in brief \[\[1\]\([^)]+\)\]\.\n\n\*\*Momentum:\*\* Moderate, Stable\n\n## Traditional Media Coverage/.test(vmd), 'after the summary: ' + JSON.stringify(vmd.slice(vmd.indexOf('## Executive'), vmd.indexOf('## Traditional') + 10)));
  ok(/<h2>Executive Summary<\/h2><p>The day in brief[^<]*<sup>.*?<\/sup>\.<\/p><p><strong>Momentum:<\/strong> Moderate, Stable<\/p><h2>Traditional Media Coverage<\/h2>/.test(vh), 'the html the same');
  // the seeded AEP desk is as before: under its Momentum Assessment
  await store(w, { id: 'bx4a', ids, sections: { summary: 'In brief [M:101].', momentum: 'Building [M:101].' }, ratings: { momentum: { level: 'Moderate to High', trend: 'Escalating' } } });
  ok(/## Momentum Assessment\n\n\*\*Momentum:\*\* Moderate to High, Escalating\n\nBuilding/.test((await doc(w, 'bx4a', 'md')).text), 'a desk whose rating has its own section: unchanged');
});

await S.t('EX5 the recall measure finds what AXIOM holds under another form of the link', async () => {
  const w = await mk(); await push(w, 'news', [{ src: 't', title: 'Opens the archive', url: 'https://open.example.com.au/x', ts: NOW - 9 * D, meta: { reg: 1 } }]);
  const ins = (url, seen, meta, body) => w.env.MIND_DB.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','t','A story',?,?,'',NULL,?,?,?)").run(body || 'short', url, JSON.stringify(meta || { reg: 1 }), seen, seen).lastInsertRowid;
  const S1 = NOW - 3 * D, S2 = NOW - 2 * D, S3 = NOW - 4 * D, S4 = NOW - 30 * H, S5 = NOW - 5 * D;
  ins('https://shire.example.com.au/news/levy?id=5&amp;page=2', S1);                                                        // (a) stored as the feed escaped it
  ins('https://ninenews.example.com.au/policy/levy-vote-20261116-p5abcd?ref=rss&amp;utm_medium=rss&amp;utm_source=rss_feed', S2); // (b) the feed's tracking query after it
  ins('https://slash.example.com.au/story/levy/', S3);                                                                          // (c) with a slash the report's link lacks
  ins('https://pointpost.example.com.au/a', NOW - D);
  const g4 = ins('https://news.google.com/rss/articles/CBMiAAA1?oc=5', S4);                                                    // (d) a Google row, resolved now
  ins('https://news.google.com/rss/articles/CBMiBBB2?oc=5', S5, { reg: 1, link: 'https://resolved.example.com.au/old-story/' }); // (d) resolved before p71
  const held = async us => (await F(w, 'GET', '/den/held?' + us.map(u => 'u=' + encodeURIComponent(u)).join('&'), null, 'read-key')).body.results;
  const sv = await F(w, 'POST', '/fulltext/save', { id: g4, text: 'The resolved story. '.repeat(20), method: 'render', link: 'https://resolved.example.com.au/levy-story?utm_source=gnews' }); eq(sv.status, 200, sv.text);
  ok(row(w, 'SELECT item FROM arc_links WHERE url=?', 'https://resolved.example.com.au/levy-story'), 'fulltextSave writes the resolved address where the measure reads it');
  const r = await held(['https://shire.example.com.au/news/levy?id=5&page=2', 'https://ninenews.example.com.au/policy/levy-vote-20261116-p5abcd', 'https://slash.example.com.au/story/levy', 'https://resolved.example.com.au/levy-story', 'https://pointpost.example.com.au/a']);
  eq(r.map(x => x.held), [true, true, true, true, true], 'escaped, tracked, slashed and resolved: all held');
  eq(r.map(x => x.seen), [S1, S2, S3, S4, NOW - D], 'each when AXIOM first saw it'); ok(r.every(x => x.kind === 'news' && x.channel === 'news'));
  const near = await held(['https://shire.example.com.au/news/levy?id=50', 'https://ninenews.example.com.au/policy/levy-vote-20261116-p5abce', 'https://slash.example.com.au/story/lev', 'https://resolved.example.com.au/levy', 'https://resolved.example.com.au/old-story']);
  eq(near.map(x => x.held), [false, false, false, false, false], 'a near miss is not held, and a row resolved before p71 is not found until the backfill has passed it');
  // the backfill: at most its limit a call, from a cursor, until it reaches the newest row
  const f1 = await w.mod.__test.arcLinksFill(w.env, { limit: 3 }); eq([f1.read, f1.done], [3, false], JSON.stringify(f1));
  let f = f1; for (let i = 0; i < 5 && !f.done; i++) f = await w.mod.__test.arcLinksFill(w.env, { limit: 3 }); ok(f.done, 'it ends');
  eq((await w.mod.__test.arcLinksFill(w.env)).read, 0, 'and once done it reads nothing');
  ok(row(w, 'SELECT item FROM arc_links WHERE url=?', 'https://resolved.example.com.au/old-story/'), 'the old row\'s link is written');
  const old = (await held(['https://resolved.example.com.au/old-story']))[0]; eq([old.held, old.seen], [true, S5], 'found after the backfill, seen when the Google row was');
  // the full-text pass resolves a Google link and writes it as it sets meta.link
  const w2 = await mk(); await push(w2, 'news', [{ src: 't', title: 'Opens the archive', url: 'https://open.example.com.au/x', ts: NOW - 9 * D, meta: { reg: 1 } }]);
  const b64 = Buffer.from('\u0008\u0013"\u001dhttps://cron.example.com.au/story/one\u0010\u0001', 'latin1').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  w2.env.MIND_DB.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','gnews_aep','A Google story','short',?,'',NULL,?,?,?)").run('https://news.google.com/rss/articles/' + b64 + '?oc=5', JSON.stringify({ issues: ['gastax'] }), NOW - 2 * H, NOW - 2 * H);
  w2.answer(/cron\.example\.com\.au/, () => new Response('<html><head><title>One</title><script type="application/ld+json">' + JSON.stringify({ '@type': 'NewsArticle', headline: 'One', articleBody: 'The story the redirect led to. '.repeat(40) }) + '</script></head><body></body></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
  const ft = await w2.mod.__test.fulltextCron(w2.env, { noFill: true }); eq([ft.tried, ft.got], [1, 1], JSON.stringify(ft));
  const c = (await (await F(w2, 'GET', '/den/held?u=' + encodeURIComponent('https://cron.example.com.au/story/one'), null, 'read-key')).body.results)[0]; eq([c.held, c.seen], [true, NOW - 2 * H], 'the full-text pass wrote the link it resolved');
});

await S.t('EX6 feed links decoded at collection, no second copy, undated items dated by their address', async () => {
  const w = await mk(); await F(w, 'GET', '/sources');
  const add = await F(w, 'POST', '/sources/add', { id: 'harbourgazette', name: 'Harbour Gazette', tier: 'regional', juris: 'au', urls: { rss: 'https://gazette.example.com.au/feed' } }); eq(add.status, 200, add.text);
  const ymd = (t, sep) => syd(t).split('-').join(sep); const d3 = NOW - 3 * D, d5 = NOW - 5 * D, d2 = NOW - 2 * D, d45 = NOW - 45 * D;
  const item = (title, link, ago) => '<item><title>' + title + '</title><link>' + link + '</link>' + (ago ? '<pubDate>' + new Date(NOW - ago).toUTCString() + '</pubDate>' : '') + '<description>About the harbour levy.</description></item>';
  const ESC = 'https://gazette.example.com.au/2026/11/levy-vote/?utm_source=rss&amp;utm_medium=rss';
  const feed = '<?xml version="1.0"?><rss><channel><title>Harbour Gazette</title>'
    + item('Levy vote set for Thursday in the Senate', ESC, H)
    + item('Producers answer the harbour levy', 'https://gazette.example.com.au/producers-answer/?utm_source=rss&#038;utm_medium=rss&#038;utm_campaign=producers', 2 * H)
    + item('An explainer on the harbour levy', 'https://gazette.example.com.au/news/levy-explainer-' + ymd(d3, '-'), 0)
    + item('A masthead story on the harbour levy', 'https://gazette.example.com.au/politics/levy-story-' + ymd(d5, '') + '-p5abcd', 0)
    + item('A dated-path story on the harbour levy', 'https://gazette.example.com.au/' + ymd(d2, '/') + '/levy-path-story/', 0)
    + item('An old story on the harbour levy again', 'https://gazette.example.com.au/news/levy-old-' + ymd(d45, '-'), 0)
    + item('An undated story on the harbour levy', 'https://gazette.example.com.au/news/levy-undated-story', 0) + '</channel></rss>';
  w.answer(/gazette\.example\.com\.au\/feed/, () => new Response(feed, { status: 200, headers: { 'content-type': 'application/rss+xml' } }));
  // as p70 filed it: the feed's escape kept in the address
  w.env.MIND_DB.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES('news','harbourgazette','Levy vote set for Thursday in the Senate','About the harbour levy.',?,'',NULL,?,?,?)").run(ESC, JSON.stringify({ reg: 1, source: 'harbourgazette' }), NOW - H, NOW - H);
  const t0 = Date.now(); const sw = await F(w, 'POST', '/sources/sweep', { ids: ['harbourgazette'] }); eq([sw.status, sw.body.succeeded], [200, 1], sw.text.slice(0, 300));
  const mine = () => rows(w, "SELECT url, ts, meta FROM arc_items WHERE kind='news' AND src='harbourgazette' ORDER BY id");
  const got = mine(); const by = s => got.find(r => r.url.indexOf(s) >= 0);
  eq(got.filter(r => /levy-vote/.test(r.url)).map(r => r.url), [ESC], 'the item held under its escaped address is not filed a second time');
  eq(by('producers-answer').url, 'https://gazette.example.com.au/producers-answer/?utm_source=rss&utm_medium=rss&utm_campaign=producers', 'a WordPress &#038; is read as &');
  eq(got.filter(r => /&amp;|&#0*38;/.test(r.url)).length, 1, 'no new row carries an escape');
  const day = r => syd(r.ts);
  eq([day(by('levy-explainer')), day(by('levy-story-')), day(by('levy-path-story'))], [syd(d3), syd(d5), syd(d2)], 'an undated item takes the day in its address');
  ok(by('levy-explainer').ts < t0 - D && JSON.parse(by('levy-explainer').meta).urldate === 1 && JSON.parse(by('levy-explainer').meta).dated === 0, 'and is no longer stamped as new');
  ok(Math.abs(by('levy-old-').ts - t0) < 120000 && Math.abs(by('levy-undated-story').ts - t0) < 120000, 'a day more than thirty days old, or none, leaves the time it was found');
  const n1 = got.length; await F(w, 'POST', '/sources/sweep', { ids: ['harbourgazette'] }); eq(mine().length, n1, 'collected again: no new row');
  // the parsers on their own, and the core feeds' path
  const T = w.mod.__test;
  eq(T.parseFeedXml('<feed><entry><title>An Atom story</title><link href="https://atom.example.com.au/x?a=1&amp;b=2"/></entry></feed>')[0].link, 'https://atom.example.com.au/x?a=1&b=2', 'an Atom link');
  eq(T.parseSitemap('<urlset><url><loc>https://map.example.com.au/y?c=1&amp;d=2</loc><news:title>A sitemap story</news:title></url></urlset>')[0].link, 'https://map.example.com.au/y?c=1&d=2', 'a sitemap location');
  const core = T.arcCoreRow({ src: 'abc_news', title: 'A core story with no date', link: 'https://core.example.com.au/news/' + ymd(d3, '/') + '/a-core-story', date: '' });
  eq([syd(core.ts), core.meta.urldate], [syd(d3), 1], 'a core feed\'s undated item too');
  eq(T.arcCoreRow({ src: 'abc_news', title: 'Dated', link: 'https://core.example.com.au/news/' + ymd(d3, '/') + '/b', date: new Date(NOW - H).toUTCString() }).ts, Math.floor((NOW - H) / 1000) * 1000, 'a feed date still wins');
});

await S.t('EX7 copy for the document as plain text: the body only, blocks apart, no tag or entity', async () => {
  const src = fs.readFileSync(new URL('../docs/den-brief.js', import.meta.url), 'utf8'); const m = src.match(/^ *function denDocPlain\(h\) \{.*\}$/m);
  ok(m, 'docs/den-brief.js has one conversion, denDocPlain'); const plain = new Function('return ' + m[0].trim())();
  // p72 P5: the copy converts once, in plain(), which both the text/plain item and the plain-text fallback call
  ok((src.match(/denDocPlain\(t\)/g) || []).length === 1 && /const plain = \(\) => denDocPlain\(t\)/.test(src) && /new Blob\(\[plain\(\)\]/.test(src) && /writeText\(rich \? plain\(\) : t\)/.test(src) && !/t\.replace\(\/<\[\^>\]\+>\/g, ' '\)/.test(src), 'both the text/plain item and the fallback use it');
  const w = await mk(); await store(w, { id: 'bx7', ids: EX1_IDS, sections: EX1_SECTIONS }); const htm = (await doc(w, 'bx7', 'html')).text; const p = plain(htm);
  ok(!/<[a-z\/!]/i.test(p) && !/&(amp|lt|gt|quot|#0*39);/.test(p), 'no tag and no entity: ' + (p.match(/.{0,30}(<[a-z\/!]|&(amp|lt|gt|quot|#0*39);).{0,30}/i) || [''])[0]);
  ok(!/font:15px|max-width|\{/.test(p) && p.indexOf('17 November 2026 - DRAFT') < 0, 'never the stylesheet or the title');
  ok(p.indexOf('Daily Activist Activity Brief\n\nAustralian Energy Producers\n\nDate: 17 November 2026 | Reporting window: 16' + DASH + '17 November 2026\n\nDRAFT\n\nExecutive Summary\n\nThe levy led the press [1][2].') === 0, 'the body, a blank line after each block: ' + JSON.stringify(p.slice(0, 200)));
  ok(/\n\n\[1\] pointpost - Harbour levy divides the Senate, [^\n]+ - https:\/\/pointpost\.example\.com\.au\/a\n\n\[3\] The Tribune/.test(p), 'the Source List keeps its numbers, an entry a paragraph');
  ok(p.indexOf('[7] Smith & Jones Media - A story with an ampersand, ') >= 0 && p.indexOf('https://smith.example.com.au/x?a=1&b=2') >= 0, 'an ampersand reads as one');
});

// ---- the review fixes (draft lane): the document and the view
await S.t('EX8 (EX1, EX6) every rating prints where her format puts it, and none is left out of the document', async () => {
  const w = await mk(); await F(w, 'GET', '/den/desks'); const ids = { 'M:101': EX1_IDS['M:101'] };
  const sec = (md, t) => (md.split('## ' + t + '\n')[1] || '').split('\n## ')[0]; const at = (md, t) => JSON.stringify(md.slice(md.indexOf('## ' + t), md.indexOf('## ' + t) + 220));
  const R = { activity: { level: 'Moderate', trend: 'Stable' }, media: { level: 'Low', trend: '' }, social: { level: 'High', trend: '' } };
  const THREE = '**Overall activity level:** Moderate, Stable  \n**Media risk:** Low  \n**Social risk:** High';
  // the Firearms desk as seeded (DEN_FORMAT_B): "Media risk" has the id of News environment, a content section
  const G = { summary: 'The week in brief [M:101].', judgement: 'Activity is building [M:101].', media: 'The press ran it [M:101].', momentum: 'Momentum is moderate [M:101].', bottom: 'Watch the vote [M:101].' };
  await store(w, { id: 'bx8', desk: 'guns_au', ids, sections: G, ratings: R });
  const md = (await doc(w, 'bx8', 'md')).text, htm = (await doc(w, 'bx8', 'html')).text;
  ok(sec(md, 'Assessment of Activist Momentum').indexOf('\n' + THREE + '\n\nMomentum is moderate') === 0, 'all three under the momentum assessment, as her format has them (DEN.md s.0.2): ' + at(md, 'Assessment'));
  ok(!/\*\*/.test(sec(md, 'News environment')), 'none under News environment: ' + at(md, 'News environment'));
  ok(htm.indexOf('<h2>Assessment of Activist Momentum</h2><p><strong>Overall activity level:</strong> Moderate, Stable<br><strong>Media risk:</strong> Low<br><strong>Social risk:</strong> High</p>') > 0 && htm.indexOf('<h2>News environment</h2><p>The press') > 0, 'the html the same');
  // a quiet news day: News environment not written, and Media risk is still in the document, where it belongs
  const G2 = Object.assign({}, G); delete G2.media; await store(w, { id: 'bx8b', desk: 'guns_au', day: '2026-11-16', ids, sections: G2, ratings: R });
  const md2 = (await doc(w, 'bx8b', 'md')).text; ok(sec(md2, 'Assessment of Activist Momentum').indexOf('\n' + THREE + '\n') === 0 && /<strong>Media risk:<\/strong> Low/.test((await doc(w, 'bx8b', 'html')).text), 'Media risk prints with News environment unwritten: ' + at(md2, 'Assessment'));
  ok(/\*Overall activity level:\* Moderate, Stable {2}\| {2}\*Media risk:\* Low {2}\| {2}\*Social risk:\* High/.test((await doc(w, 'bx8b', 'slack')).text), 'the Slack summary lists them, as before');
  // the momentum assessment not written: after the summary; neither it nor the summary: after the header
  const G3 = Object.assign({}, G); delete G3.momentum; await store(w, { id: 'bx8c', desk: 'guns_au', day: '2026-11-15', ids, sections: G3, ratings: R });
  const md3 = (await doc(w, 'bx8c', 'md')).text; ok(/## Executive Summary\n\nThe week in brief \[\[1\]\([^)]+\)\]\.\n\n\*\*Overall activity level:\*\* Moderate, Stable {2}\n\*\*Media risk:\*\* Low {2}\n\*\*Social risk:\*\* High\n\n## Today's Key Judgement/.test(md3), 'its place not written: after the summary, not left out: ' + at(md3, 'Executive'));
  await store(w, { id: 'bx8d', desk: 'guns_au', day: '2026-11-14', ids, sections: { judgement: G.judgement, bottom: G.bottom }, ratings: R });
  const md4 = (await doc(w, 'bx8d', 'md')).text; ok(md4.indexOf('\n\nDRAFT\n\n' + THREE + '\n\n## Today\'s Key Judgement') > 0, 'nor the summary: after the header: ' + JSON.stringify(md4.slice(0, 260)));
  // the weekly MCA shape: its rating's own section not written this time, so under the first momentum section
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET sections=?, ratings=? WHERE id='mca_au'").run(JSON.stringify([{ id: 'summary', kind: 'summary', title: 'Executive summary' }, { id: 'sentiment', kind: 'sentiment', title: 'Overall sentiment rating' }, { id: 'week_on_week', kind: 'momentum', title: 'Week-on-week comparison' }, { id: 'closing', kind: 'bottom', title: 'Summary' }, { id: 'sources', kind: 'sources', title: 'Sources' }]),
    JSON.stringify({ levels: ['Negative', 'Neutral to mixed', 'Positive'], trends: ['Improving', 'Stable', 'Deteriorating'], items: [{ id: 'sentiment', label: 'Overall assessment', trend: true }] }));
  await store(w, { id: 'bx8e', desk: 'mca_au', ids, sections: { summary: 'The week in brief [M:101].', week_on_week: 'Activity rose on last week [M:101].', closing: 'Watch the vote [M:101].' }, ratings: { sentiment: { level: 'Neutral to mixed', trend: 'Stable' } } });
  const md5 = (await doc(w, 'bx8e', 'md')).text; ok(sec(md5, 'Week-on-week comparison').indexOf('\n**Overall assessment:** Neutral to mixed, Stable\n') === 0, 'its own section unwritten: under the momentum section: ' + at(md5, 'Week-on-week'));
  // EX6: a section hidden in Options is no rating's home (the page shows such a rating in its top bar): after the summary
  const hide = await F(w, 'POST', '/den/desk/update', { id: 'aep_vic', patch: { options: { hidden: ['momentum'] } } }); eq(hide.status, 200, hide.text.slice(0, 200));
  await store(w, { id: 'bx8f', desk: 'aep_vic', ids, sections: { summary: 'The day in brief [M:101].', media: 'The press ran it [M:101].', bottom: 'Steady [M:101].' }, ratings: { momentum: { level: 'Moderate', trend: 'Stable' } } });
  const md6 = (await doc(w, 'bx8f', 'md')).text, h6 = (await doc(w, 'bx8f', 'html')).text;
  ok(/## Executive Summary\n\nThe day in brief \[\[1\]\([^)]+\)\]\.\n\n\*\*Momentum:\*\* Moderate, Stable\n\n## Traditional Media Coverage/.test(md6) && /<p><strong>Momentum:<\/strong> Moderate, Stable<\/p><h2>Traditional Media Coverage<\/h2>/.test(h6), 'momentum hidden: its rating after the summary, not left out: ' + at(md6, 'Executive'));
  // even when the hidden section holds words from before it was hidden (they still print), the rating is not put under it
  await store(w, { id: 'bx8g', desk: 'aep_vic', day: '2026-11-16', ids, sections: { summary: 'The day in brief [M:101].', momentum: 'Written before it was hidden [M:101].' }, ratings: { momentum: { level: 'Moderate', trend: 'Stable' } } });
  const md7 = (await doc(w, 'bx8g', 'md')).text; ok(/## Executive Summary\n\n[^\n]+\n\n\*\*Momentum:\*\* Moderate, Stable\n/.test(md7) && /## Momentum Assessment\n\nWritten before/.test(md7), 'not under the hidden section: ' + at(md7, 'Executive'));
});

await S.t('EX9 (EX4) the Source List is headed with the desk\'s own title for it', async () => {
  const w = await mk(); await F(w, 'GET', '/den/desks');
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET sections=? WHERE id='mca_au'").run(JSON.stringify([{ id: 'summary', kind: 'summary', title: 'Executive summary' }, { id: 'closing', kind: 'bottom', title: 'Summary' }, { id: 'sources', kind: 'sources', title: 'Sources & links' }]));
  await store(w, { id: 'bx9', desk: 'mca_au', ids: EX1_IDS, sections: { summary: 'The levy led the press [M:101].', closing: 'A post led it [S:201].' } });
  const md = (await doc(w, 'bx9', 'md')).text, htm = (await doc(w, 'bx9', 'html')).text, view = (await doc(w, 'bx9')).body.brief;
  ok(/\n## Sources & links\n\n### Traditional media\n\n\[1\] /.test(md) && !/Source List/.test(md), 'the .md: ' + JSON.stringify(md.slice(md.indexOf('## Sources'), md.indexOf('## Sources') + 60)));
  ok(/<h2>Sources &amp; links<\/h2><h3>Traditional media<\/h3>/.test(htm) && !/Source List/.test(htm), 'the .html, escaped once');
  eq(view.order.find(s => s.kind === 'sources').title, 'Sources & links', 'the title the page heads it with');
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET sections=? WHERE id='aep_vic'").run(JSON.stringify([{ id: 'summary', kind: 'summary', title: 'Executive Summary' }, { id: 'bottom', kind: 'bottom', title: 'Bottom Line' }]));
  await store(w, { id: 'bx9v', desk: 'aep_vic', ids: EX1_IDS, sections: { summary: 'The levy led the press [M:101].' } });
  ok(/\n## Source List\n\n### Traditional media\n\n/.test((await doc(w, 'bx9v', 'md')).text) && /<h2>Source List<\/h2>/.test((await doc(w, 'bx9v', 'html')).text), 'a desk with no sources section of its own: Source List, as before');
});

await S.t('EX10 (EX5) an evidence card\'s address is the one a reader opens, for a brief stored before p71 too', async () => {
  const w = await mk();
  const ids = { 'M:405': { k: 'media', label: 'shirenews - A page with two parameters', url: 'https://shire.example.com.au/news/item?id=7&amp;page=2&amp;utm_source=rss', gated: 0, item: 405, line: 'shirenews | A page with two parameters' },
    'S:404': { k: 'social', label: 'x post', url: 'https://x.com/i/web/status/190000000000000404?ref_src=twsrc&fbclid=abc123', gated: 0, item: 404, line: 'x | 16 nov 09:10 | words | 12 likes' },
    'U:2': { k: 'upcoming', label: '2026-11-20 vote', url: 'https://tribune.example.com.au/event?day=20&#038;utm_medium=rss', gated: 0, item: 102, line: 'Friday 2026-11-20 | vote | The vote is on 20 November' },
    'N:n1': { k: 'narrative', label: 'Levy as a cash grab', url: '', gated: 0, item: 0, line: '"Levy as a cash grab" | claim: x' } };
  await store(w, { id: 'bx10', ids, sections: { summary: 'A shire page ran it [M:405]. A post took it up [S:404]. A vote is due [U:2]. A narrative grew [N:n1].' } });
  const view = (await doc(w, 'bx10')).body.brief; const ev = view.evidence;
  eq([ev['M:405'].url, ev['S:404'].url, ev['U:2'].url, ev['N:n1'].url], ['https://shire.example.com.au/news/item?id=7&page=2', 'https://x.com/i/web/status/190000000000000404', 'https://tribune.example.com.au/event?day=20', ''], 'feed escapes decoded, tracking struck; a row with no address still has none');
  eq(new URL(ev['M:405'].url).searchParams.get('page'), '2', 'the parameter after the escaped & reaches the card\'s Open link');
  const src = {}; view.sourceList.forEach(g => g.items.forEach(i => { src[i.id] = i.url; })); eq(['M:405', 'S:404', 'U:2'].map(k => ev[k].url), ['M:405', 'S:404', 'U:2'].map(k => src[k]), 'the address the Source List on the same page gives');
  const md = (await doc(w, 'bx10', 'md')).text; resolves(mdMarks(md), mdList(md), 'the .md still numbers them');
});

// ---- the review fixes (draft lane): the page. A page function read from its file, from its head to its closing brace (none
// read here holds a brace in a string or a pattern), or a one-line const
const pageFn = (src, head) => { const i = src.indexOf(head); if (i < 0) return null; let d = 0, j = i + head.length - 1; for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
const pageLine = (src, name) => (src.match(new RegExp('^ *const ' + name + ' = (.*);$', 'm')) || [])[1];
const PAGE = fs.readFileSync(new URL('../docs/den-brief.js', import.meta.url), 'utf8'), DENJS = fs.readFileSync(new URL('../docs/den.js', import.meta.url), 'utf8');
// the comments under a post as its Card says them (p71 fx3 G2, fx5 R1): the count (the meta span) and the tone chip (its
// colour, its title, its words), each read from docs/den.js; words joins them as the line does, a comma between
const commentsOf = () => { const plural = new Function('return ' + pageLine(DENJS, 'plural'))(), toneWord = new Function('return ' + (pageLine(DENJS, 'toneWord') || 'null'))();
  const hs = pageLine(DENJS, 'heldSay'), ht = pageLine(DENJS, 'heldTip'); const heldSay = hs ? new Function('plural', 'return ' + hs)(plural) : null, heldTip = ht ? new Function('plural', 'return ' + ht)(plural) : null;
  const span = DENJS.match(/<span key="h">\$\{([^}]*)\}([^<]*)<\/span>/), chip = DENJS.match(/r\.held && r\.held\.tone != null \? html`<span class=\$\{([^}]*)\}(?: title=\$\{([^}]*)\})?>\$\{([^}]*)\}<\/span>`/);
  ok(span && chip, 'docs/den.js counts a card\'s comments in one place, and says their tone in one chip');
  const run = (x, r) => (x ? new Function('r', 'plural', 'toneWord', 'heldSay', 'heldTip', 'return ' + x)(r, plural, toneWord, heldSay, heldTip) : '');
  const say = r => (r.held ? run(span[1], r) + span[2] : ''), tone = r => (r.held && r.held.tone != null ? { cls: run(chip[1], r).trim(), title: run(chip[2], r), text: run(chip[3], r) } : null);
  return { say, tone, toneWord, words: r => [say(r), (tone(r) || {}).text].filter(Boolean).join(', ') }; };
// a story's address day as the page writes it (docs/den.js addrDay and addrDated, read from the file); since p71 fx5 (R2)
// addrDay takes the window's year beside the row, and a page before it reads no second argument
const addrFns = () => { const fk = pageLine(DENJS, 'fmtDayKey'), fs0 = pageLine(DENJS, 'fmtDayShort'), mon = pageLine(DENJS, 'MON3');
  const addrDay = new Function('fmtDayKey', 'fmtDayShort', 'MON3', 'return ' + pageLine(DENJS, 'addrDay'))(fk ? new Function('return ' + fk)() : null, fs0 ? new Function('return ' + fs0)() : null, mon ? new Function('return ' + mon)() : null);
  return { addrDay, addrDated: new Function('return ' + (pageLine(DENJS, 'addrDated') || 'null'))() }; };

await S.t('EX11 (EX3) a measure line reads on the page as a figure of its issue, in whole words, with its own icon', async () => {
  const CH = { x: 'X', bluesky: 'Bluesky' }, NAMELESS = /^A narrative not yet named$/i; const cut = new Function('return ' + pageLine(PAGE, 'cut'))();
  const citeLabel = new Function('CH', 'cut', 'NAMELESS', 'return ' + pageFn(PAGE, 'function citeLabel(id, e) {'))(CH, cut, NAMELESS);
  const srcOf = new Function('CH', 'citeLabel', 'return ' + pageFn(PAGE, 'const srcOf = (c, e) => {').replace(/^const srcOf = /, ''))(CH, citeLabel);
  const KIND = new Function('return ' + pageLine(PAGE, 'KIND'))(); const GLYPH = new Function('return ' + pageFn(PAGE, 'const GLYPH = {').replace(/^const GLYPH = /, ''))();
  const I = { k: 'measure', label: 'Gas taxation: above its usual volume', text: 'Gas taxation ran at 4.2 times its usual volume: 42 posts, stories and comments in this window against 10 usual for a window this long' };
  const C = { k: 'measure', label: 'Gas taxation: this window against the day before' };
  // p71 review C5: each is named by its measure, so the two figures of one issue read apart (EX14)
  eq([citeLabel('I:gastax', I), citeLabel('C:gastax', C)], ['Above baseline: Gas taxation', 'Window before: Gas taxation'], 'the issue, never a raw "Gas taxation: above its usual vo"');
  const long = citeLabel('C:cm', { k: 'measure', label: 'Critical minerals and rare earth processing: this window against the week before' });
  ok(/^Window before: Critical minerals and rare/.test(long) && long.endsWith('…') && long.length <= 'Window before: '.length + 29, 'a long issue ends in an ellipsis: ' + long);
  eq(srcOf(null, I), 'Figure', 'its card is headed Figure, not Evidence');
  ok(KIND.measure === 'measure' && typeof GLYPH.measure === 'string' && GLYPH.measure !== GLYPH.info && GLYPH.measure !== GLYPH.tone, 'a measure has an icon of its own');
  eq([citeLabel('T:gastax', { k: 'tone', label: 'Gas taxation' }), srcOf(null, { k: 'tone', label: 'Gas taxation' }), srcOf(null, null)], ['Tone: Gas taxation', 'Tone', 'Collected after the draft'], 'the other kinds as they were');
  // the view carries the kind to the page
  const w = await mk(); await store(w, { id: 'bx11', ids: { 'C:gastax': Object.assign({ url: '', gated: 0, item: 0, line: 'Gas taxation: 42 posts and stories in this window, 10 in the day before' }, C), 'M:101': EX1_IDS['M:101'] }, sections: { momentum: 'Activity rose [C:gastax][M:101].' } });
  eq((await doc(w, 'bx11')).body.brief.evidence['C:gastax'].k, 'measure');
});

await S.t('EX12 (CK11) a figure flag says where the figure was looked for, and a doubly flagged sentence is one flag', async () => {
  const fns = ['function figSay(u, bare) {', 'function flagOf(F, s, pl, used) {', 'function flagsLeft(F, used) {'].map(h => pageFn(PAGE, h)); ok(fns.every(Boolean), 'docs/den-brief.js words its flags in one place');
  const P = new Function(fns.join('\n') + '\nreturn { flagOf, flagsLeft };')(); const fresh = () => ({ u: new Set(), f: new Set(), t: new Set() });
  // entries as the worker writes them (the checker lane marks the entry of a sentence with no valid citation bare)
  const Fl = { uncited: ['It reached 9,999 people.', 'A campaigner is behind it.'], unverified: [{ sentence: 'It reached 9,999 people.', figures: ['9,999'] }, { sentence: 'The press ran 6 stories in the window.', figures: ['6 stories'], bare: true }, { sentence: 'Coverage grew to 12 stories and 40 posts.', figures: ['12 stories', '40 posts'] }], trimmed: [] };
  const used = fresh(); const one = s => P.flagOf(Fl, s, s.replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:])/g, '$1').trim(), used);
  eq(one('It reached 9,999 people.'), 'Needs a source (9,999 is not in the evidence):', 'needs a source and holds a figure the evidence lacks: one flag that says both');
  eq(one('A campaigner is behind it.'), 'Needs a source:', 'a sentence with no figure, as before');
  eq(one('The press ran 6 stories in the window.'), '6 stories is not in the evidence:', 'a sentence that cites nothing: never "the row it cites"');
  eq(one('Coverage grew to 12 stories and 40 posts [M:101].'), '12 stories, 40 posts are not in the row it cites:', 'a cited sentence: the row it cites');
  eq(P.flagsLeft(Fl, used), [], 'nothing is said again under the text');
  eq(P.flagsLeft(Fl, fresh()).map(x => x.w), ['Needs a source (9,999 is not in the evidence):', 'Needs a source:', '6 stories is not in the evidence:', '12 stories, 40 posts are not in the row it cites:'], 'flags whose sentence is not in the text: once each, in the same words');
  const secState = new Function('return ' + pageFn(DENJS, 'function secState(sec, text, n) {'))();
  eq(secState({ text: 'x', uncited: Fl.uncited, unverified: Fl.unverified, trimmed: [] }, 'x', 0), ['Flagged 4', 'warn'], 'the section counts four flagged sentences, not five');
  // the worker's own check of a sentence whose only id was invented: said once, whichever way the worker lists it
  const w = await mk(); const c = w.mod.__test.denCleanText('It reached 9,999 people [Z:1]. The levy led the press [M:101].', new Map([['M:101', EX1_IDS['M:101']]]));
  const u3 = fresh(); const lab = P.flagOf(c, 'It reached 9,999 people.', 'It reached 9,999 people.', u3); const dup = c.unverified.find(u => u.sentence === 'It reached 9,999 people.');
  eq([c.uncited, lab], [['It reached 9,999 people.'], dup ? 'Needs a source (' + dup.figures.join(', ') + (dup.figures.length > 1 ? ' are' : ' is') + ' not in the evidence):' : 'Needs a source:'], JSON.stringify(c)); eq(P.flagsLeft(c, u3), [], 'and not again under the text');
});

await S.t('EX13 (CO5) a post card\'s count says what its evidence line says', async () => {
  const L = n => pageLine(DENJS, n); ok(L('engSay') && L('engCounted') && L('engTip'), 'docs/den.js says a card\'s count in one place');
  ok(/title=\$\{engTip\(r\)\}>\$\{engSay\(r\)\}/.test(DENJS), 'and the social and actor cards use it');
  const fmtN = n => Number(n).toLocaleString('en-AU');
  const E = new Function('fmtN', ['engText', 'engK', 'engCounted', 'engMiss', 'engSay', 'engTip'].map(n => 'const ' + n + ' = ' + L(n) + ';').join('\n') + '\nreturn { engSay, engTip };')(fmtN);
  eq([E.engSay({ eng: { likes: 0, replies: 0 }, total: 0 }), E.engTip({ eng: { likes: 0, replies: 0 }, total: 0 })], ['no interactions', 'Its counts were read, and all are zero'], 'counted at nothing (the SR4 shape): "no interactions", as the line says');
  // p71 review C6: the line's words since EV5 renamed them (EX15 ties the two)
  eq([E.engSay({ eng: {}, total: 0 }), E.engSay({ eng: null, total: 0 }), E.engTip({ eng: {}, total: 0 })], ['engagement not recorded', 'engagement not recorded', 'Its engagement was not recorded'], 'no count at all');
  eq([E.engSay({ eng: { views: 1200 }, total: 0 }), E.engTip({ eng: { views: 1200 }, total: 0 }), E.engSay({ eng: { views: 1, likes: 0 }, total: 0 })], ['1,200 views', '1,200 views', '1 view'], 'its views when they are its only count');
  // p71 fx3 (G1): the counts in the line's order (EX19 ties it to the line); on 2ca1637 '5 likes, 2 replies, 1 quote'
  eq([E.engSay({ eng: { likes: 5, replies: 2, quotes: 1 }, total: 8 }), E.engTip({ eng: { likes: 5, replies: 2, quotes: 1 }, total: 8 })], ['8 interactions', '5 likes, 1 quote, 2 replies'], 'interactions, quotes among them, a count of one in the singular');
  eq([E.engSay({ eng: null, total: 1 }), E.engTip({ eng: null, total: 12 })], ['1 interaction', '12 interactions in all'], 'a total with no breakdown is never "engagement not recorded"');
});

// ---- the second review round (cron lane): the page
const cutFn = () => new Function('return ' + pageLine(PAGE, 'cut'))();
const citeLabelFn = () => new Function('CH', 'cut', 'NAMELESS', 'return ' + pageFn(PAGE, 'function citeLabel(id, e) {'))({ x: 'X', bluesky: 'Bluesky' }, cutFn(), /^A narrative not yet named$/i);

await S.t('EX14 (C5) an issue\'s two figures cited in one sentence read apart: each chip names its measure', async () => {
  const citeLabel = citeLabelFn(); const MARK = new Function('return ' + pageLine(PAGE, 'MARK'))();
  const citeIndex = new Function('citeLabel', 'MARK', 'return ' + pageFn(PAGE, 'function citeIndex(text, ev) {'))(citeLabel, MARK);
  const ev = { 'I:gastax': { k: 'measure', label: 'Gas taxation: above its usual volume' }, 'C:gastax': { k: 'measure', label: 'Gas taxation: this window against the day before' },
    'O:77': { k: 'measure', label: 'A post by Harbour Watch: far above its usual' }, 'C:ftc': { k: 'measure', label: 'Fuel tax credits: this window against the week before' } };
  const ix = citeIndex('Gas taxation ran at four times its usual volume, and above the day before [I:gastax][C:gastax]. One post drew far more than usual [O:77]. Credits were steady [C:ftc].', ev);
  eq(ix.ids.map(id => ix.names[id]), ['Above baseline: Gas taxation', 'Window before: Gas taxation', 'Unusual reach: A post by Harbour Watch', 'Window before: Fuel tax credits'], 'each chip names its measure, and none needs a number to tell it from the other (on 3b71160: "Figure: Gas taxation" and "Figure: Gas taxation 2")');
  eq(citeLabel('X:1', { k: 'measure', label: 'Gas taxation: a figure of another kind' }), 'Figure: Gas taxation', 'a measure of any other shape keeps the general name');
  eq([citeLabel('T:gastax', { k: 'tone', label: 'Gas taxation' }), citeLabel('U:1', { k: 'upcoming', label: '2026-11-20 vote' })], ['Tone: Gas taxation', 'Date: 2026-11-20 vote'], 'the other kinds as they were');
});

await S.t('EX15 (C6) a post card says what the worker\'s evidence line for the same post says', async () => {
  const L = n => pageLine(DENJS, n); const fmtN = n => Number(n).toLocaleString('en-AU');
  const E = new Function('fmtN', ['engText', 'engK', 'engCounted', 'engMiss', 'engSay', 'engTip'].map(n => 'const ' + n + ' = ' + L(n) + ';').join('\n') + '\nreturn { engSay, engTip };')(fmtN);
  const w = await mk(); let n = 0; const P = (text, eng) => { n++; return { src: 'bluesky', title: 'bluesky post', body: text, url: 'https://bsky.app/profile/harbourforum' + n + '.example.com.au/post/3k' + n, ts: NOW - (2 + n) * H, meta: Object.assign({ platform: 'bluesky', issues: ['gastax'], id: 'bf' + n, term: 'gas export tax' }, eng ? { eng } : {}) }; };
  await push(w, 'sig_thread', [P('Notes from the harbour forum on the gas export tax, read out on the night.', null), P('Producers say the gas export tax will be passed on to households.', { likes: 0, replies: 0 }), P('Sign the pledge for a fair gas export tax that funds the harbour towns.', { likes: 7, replies: 2 }),
    P('Harbour towns ask who pays for the gas export tax, and the replies pile up.', { likes: 3, replies: 10 }), P('A fisher asks the council to explain the gas export tax at the pier.', { likes: 2, replies: 10 })]);
  // p71 fx5 (R1): ten comments under each of the last two; six of the first ten carry a tone, one of the second ten (the review's case)
  const tn = [-0.5, -0.3, -0.1, -0.4, -0.2, -0.3]; await push(w, 'sig_comment', [].concat(Array.from({ length: 10 }, (_, i) => Object.assign({ src: 'bluesky', body: 'A reply on the levy ' + i, url: 'x:p71ex15:d' + i, ts: NOW - 2 * H, meta: { thread: 'bf4' } }, i < 6 ? { tone: tn[i] } : {})),
    Array.from({ length: 10 }, (_, i) => Object.assign({ src: 'bluesky', body: 'A reply to the fisher ' + i, url: 'x:p71ex15:e' + i, ts: NOW - 2 * H, meta: { thread: 'bf5' } }, i === 0 ? { tone: -0.6 } : {}))));
  const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true }); const ev = await T.denEvidence(w.env, desk, board, null, [], { memory: false });
  const lineOf = r => (ev.text.split('\n').find(l => l.indexOf('[S:' + r.id + '] ') === 0) || '');
  const card = re => board.social.find(s => re.test(s.text)) || {}; const A = card(/Notes from the harbour forum/), B = card(/passed on to households/), C = card(/Sign the pledge/), S6 = card(/the replies pile up/), S1 = card(/A fisher asks the council/);
  ok(A.id && B.id && C.id && S6.id && S1.id, 'the five posts are on the Board: ' + board.social.map(s => s.text).join(' // '));
  // p71 fx5 (R1): the comments under a post, the card's words whole against its line's (the count, then the chip's tone)
  const K = commentsOf(); ok(lineOf(S6).endsWith('| ' + K.words(S6)) && K.words(S6) === '10 comments read (6 with a tone reading), mostly negative', 'six of ten carry a tone: the card says what the line says, and says it rests on six (on ecb2292 "10 comments read, mostly negative"): ' + K.words(S6) + ' // ' + lineOf(S6));
  ok(lineOf(S1).endsWith('| ' + K.words(S1)) && K.words(S1) === '10 comments read' && K.tone(S1) === null, 'one of ten carries a tone: no tone is said, on the line or the card (on ecb2292 "10 comments read, strongly negative"): ' + K.words(S1) + ' // ' + lineOf(S1));
  ok(lineOf(A).endsWith('| ' + E.engSay(A)), 'none counted: the card says what the line says (on 3b71160 "no counts held" beside "engagement not recorded"): ' + E.engSay(A) + ' // ' + lineOf(A));
  ok(lineOf(B).endsWith('| ' + E.engSay(B)) && E.engSay(B) === 'no interactions', 'counted at nothing: ' + E.engSay(B) + ' // ' + lineOf(B));
  ok(lineOf(C).endsWith('| ' + E.engTip(C)) && E.engSay(C) === '9 interactions', 'counted: the card\'s counts are the line\'s: ' + E.engTip(C) + ' // ' + lineOf(C));
  ok(!/\bheld\b/.test([A, B, C].map(r => E.engSay(r) + ' ' + E.engTip(r)).join(' ')), 'and no card says "held"');
});

await S.t('EX16 (C7, CK3) an upcoming card is keyed by its row as well as its day and event, and cited by its own line', async () => {
  const toCards = new Function('fbTotal', 'return ' + pageFn(DENJS, 'function toCards(d) {'))(() => 0); const citeOf = new Function('return ' + pageFn(DENJS, 'function citeOf(c, ev) {'))();
  const towns = ['Pointville', 'Seaview', 'Harbourton', 'Ferrybank', 'Gullhaven', 'Reefside', 'Saltmarsh', 'Capetown East'];
  const up = towns.map((t, i) => ({ date: '2026-11-17', weekday: 'Tuesday', event: 'vigil', what: t + ' residents hold a vigil every Tuesday and Friday over the gas export tax', item: 101 + i, url: 'https://pointpost.example.com.au/vigil-' + i, yearWritten: false, recurring: true, schedule: 'every Tuesday and Friday' }))
    .concat([{ date: '2026-11-20', weekday: 'Friday', event: 'sitting', what: 'A gas export tax bill - second reading', item: 0, url: 'https://parliament.example.com.au/bill', yearWritten: true, recorded: true, process: 7 }]);
  const cs = toCards({ upcoming: up }); const cardBy = {}; cs.forEach(c => { cardBy[c.key] = c; });
  eq([cs.length, Object.keys(cardBy).length], [9, 9], 'nine cards, and the page keeps all nine (on 3b71160 the eight vigils shared "U:2026-11-17|vigil"): ' + cs.map(c => c.key).join(' '));
  eq([cs[0].key, cs[7].key, cs[8].key], ['U:2026-11-17|vigil|101', 'U:2026-11-17|vigil|108', 'U:2026-11-20|sitting|p7'], 'its day, its event and its row (or the record it was read from)');
  // the brief's evidence holds the same dates in another order: each card is cited by the line of its own row
  const ev = {}; up.slice().reverse().forEach((u, i) => { ev['U:' + (i + 1)] = { k: 'upcoming', label: u.date + ' ' + u.event, url: u.url, item: u.item }; });
  eq(cs.map(c => ev[citeOf(c, ev)] && ev[citeOf(c, ev)].item), up.map(u => u.item), 'each card to its own line: ' + cs.map(c => citeOf(c, ev)).join(' '));
  // a brief stored without rows on its date lines is still matched by what the line says
  eq(citeOf(cs[3], { 'U:4': { k: 'upcoming', label: '2026-11-17 vigil' } }), 'U:4', 'by its label alone when the line names no row');
});

await S.t('EX17 (C8) a story dated by its address shows its day on its Board card, in the evidence line\'s words, never a time', async () => {
  const { addrDay } = addrFns();
  // since p71 fx5 (R2) with the window's year, which the Board hands its cards from its window
  ok(/k === 'media' && addrDated\(r\) \? addrDay\(r, yr\)/.test(DENJS) && /^ *const addrDated = r => !!\(r && \(r\.urlDated \|\| r\.stale\)\);$/m.test(DENJS), 'a story card so dated is dated by addrDay (since G3 through addrDated, the line\'s test: urlDated or stale)');
  ok(/^ *const yr = String\(\(d\.window && d\.window\.day\) \|\| ''\)\.slice\(0, 4\);/m.test(DENJS) && /<\$\{Card\} [^`]* yr=\$\{yr\} \/>/.test(DENJS), 'the Board gives each card its window\'s year');
  // p71 fx5 (R2): the day in the line's words, whole (on ecb2292 "16 Nov", as Intl writes it)
  eq([addrDay({ urlDated: true, urlDate: '2026-11-16', ts: Date.parse('2026-11-16T12:59:59Z') }, '2026'), addrDay({ urlDated: true, urlDate: '2026-11-16', stale: true, ts: 0 }, '2026')], ['16 nov (the date in its address)', '16 nov (the date in its address, before this window)'], 'the day, never a clock time');
  // the worker's own line and Board item for such a story: the card's words are the line's
  const w = await mk(); const ts = NOW - H, day = syd(ts);
  await push(w, 'news', [{ src: 'pointpost', title: 'An undated story on the harbour levy and the gas export tax', body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://pointpost.example.com.au/' + day.split('-').join('/') + '/harbour-levy-story/', ts, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1, urldate: 1 } }]);
  const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true }); const m = board.media.find(x => /An undated story/.test(x.title)) || {};
  ok(m.urlDated && m.urlDate === day, 'the Board item carries urlDated and its day: ' + JSON.stringify({ urlDated: m.urlDated, urlDate: m.urlDate }));
  const ev = await T.denEvidence(w.env, desk, board, null, [], { memory: false }); const line = ev.text.split('\n').find(l => l.indexOf('[M:' + m.id + '] ') === 0) || '';
  const said = (line.match(/\| (\d{1,2} [a-z]{3}(?: \d{4})? \(the date in its address\)) \|/) || []); const card = addrDay(m, String(board.window.day).slice(0, 4));
  ok(said[1] && !/\d:\d\d|\b[ap]m\b/i.test(card), 'the line prints the day: ' + line.slice(0, 160)); eq(card, said[1], 'the card says what the line says, word for word (on ecb2292 its month as Intl writes it, "Nov" against the line\'s "nov"): ' + line.slice(0, 160));
});

await S.t('EX18 (C4) a draft refused with 409 brief_changed shows the brief the worker sent back, and says what happened', async () => {
  const src = pageFn(PAGE, 'const guard = async (name, fn) => {'); ok(src, 'the Brief\'s actions share one guard');
  const mkGuard = new Function('busy', 'setBusy', 'setT0', 'setDropped', 'setFail', 'setConflict', 'toastMsg', 'say', 'L', 'bump', 'return ' + src.replace(/^const guard = /, ''));
  const run = async err => { const o = { L: [], fail: null, conflict: null, toasts: [], dropped: false }; const L = { set: v => o.L.push(['set', v]), reload: () => o.L.push(['reload']) };
    const g = mkGuard('', () => {}, () => {}, v => { if (v) o.dropped = true; }, f => { o.fail = f; }, c => { o.conflict = c; }, m => o.toasts.push(m), e => String(e.message), L, () => {}); await g('draft', async () => { throw err; }); return o; };
  const DETAIL = 'While this draft was being written, the brief for 2026-11-17 was saved (an edit, a filing or another draft got there first). This draft was not saved over it, so nothing was lost: read the brief that is there, and draft again to replace it.';
  const B = { id: 'b1', day: '2026-11-17', revision: 2, status: 'draft', sections: { summary: { text: 'A person wrote this while the draft ran.' } } };
  const err = b => Object.assign(new Error(DETAIL), { code: 'brief_changed', status: 409, body: { ok: false, error: 'brief_changed', detail: DETAIL, brief: b } });
  const a = await run(err(B));
  eq(a.L, [['set', { ok: true, brief: B }]], 'the brief that is there is shown at once (on 3b71160 the view kept the old one until a reload)');
  eq([a.fail && a.fail.what, a.fail && a.fail.shown, a.fail && a.fail.msg, a.conflict], ['changed', true, DETAIL, null], 'said for what it is, not as a failed draft nor a save conflict: ' + JSON.stringify(a.fail));
  ok(/not saved/.test(a.toasts[0] || ''), 'the toast says the draft was not saved: ' + a.toasts[0]);
  eq((await run(err(null))).L, [['reload']], 'with no brief sent back, the brief is read again');
  eq((await run(Object.assign(new Error('No draft was written: the model failed.'), { code: 'draft_failed', status: 502, body: {} }))).fail.what, 'draft', 'another refusal is a failed draft, as before');
  // the note's words, read through a stand-in for htm: what happened, and that the brief there is shown
  const note = f => { const h = (s, ...v) => s.reduce((t, x, i) => t + x + (i < v.length && v[i] != null && typeof v[i] !== 'function' ? String(v[i]) : ''), ''); return new Function('fail', 'html', 'setFail', 'brief', 'canWrite', 'return ' + pageLine(PAGE, 'failNote'))(f, h, () => {}, {}, true).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); };
  // p72 (UX-SPEC s.6.3, P5): the page's own words; the worker's sentence ("the brief", "draft again") is not shown, in the workbench as on Today
  const said = note(a.fail); ok(said.indexOf('Someone changed this report while it was being written, so the new version wasn\'t saved. Theirs is shown.') === 0, said);
  ok(!/\bbrief\b|draft again|Nothing that was already here changed|Couldn't be written/i.test(said), 'no Den word, nor the failed-draft words: ' + said);
  ok(/^Couldn't be written: The model failed\. Nothing that was already here changed\./.test(note({ what: 'draft', msg: 'The model failed.' })), 'a failed draft is said as such: ' + note({ what: 'draft', msg: 'The model failed.' }));
});

// ---- the third review round (page lane): a card says what its evidence line says (each fails on 2ca1637)
const engFns = () => new Function('fmtN', ['engText', 'engK', 'engCounted', 'engMiss', 'engSay', 'engTip'].map(n => 'const ' + n + ' = ' + pageLine(DENJS, n) + ';').join('\n') + '\nreturn { engSay, engTip };')(n => Number(n).toLocaleString('en-AU'));
const boardAndLines = async w => { const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true }); const ev = await T.denEvidence(w.env, desk, board, null, [], { memory: false });
  return { board, ev, line: (k, id) => ev.text.split('\n').find(l => l.indexOf('[' + k + ':' + id + '] ') === 0) || '' }; };

await S.t('EX19 (G1, D3) a post read in part says on its card what its evidence line says, and is never said to have drawn nothing', async () => {
  const E = engFns(); const w = await mk();
  // the one way in, as Business Discovery sends a post whose account hides its likes (like_count absent), and as a scrape sends the counts it found
  const IG = (code, text, eng) => ({ platform: 'instagram', url: 'https://www.instagram.com/p/' + code + '/', text, ts: NOW - 2 * H, q: 'gas export tax', eng });
  // (each says something Australian beside the search term, or the one way in sets it aside as foreign)
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [IG('P71g1hid01', 'The harbour towns of Australia ask where the gas export tax money will go', { likes: null, comments: 0 }),
    IG('P71g1lik01', 'A gas export tax explainer for the pier markets of Australia this weekend', { likes: 0 }), IG('P71g1rep01', 'Fishing co-op members in Australia split over the gas export tax plan', { likes: 0, reposts: 0 }),
    IG('P71g1rpl01', 'Two questions from Australia on the gas export tax at the harbour forum', { replies: 0 }), IG('P71g1vcm01', 'Watch the gas export tax hearing in Australia from the town hall tonight', { views: 0, comments: 0 }),
    IG('P71g1all01', 'Our gas export tax submission for Australia is in, read it in full here', { likes: 0, comments: 0 }), IG('P71g1pos01', 'Thank you to all in Australia who came to the gas export tax rally at the pier', { likes: null, comments: 3 })] });
  eq([r.status, r.body.kept], [200, 7], JSON.stringify(r.body).slice(0, 300));
  // a video whose views alone were read, an MP's post read in part (the actor card and its P: line), a Bluesky post with every count
  await push(w, 'sig_thread', [{ src: 'youtube', title: 'youtube post', body: 'The gas export tax forum at the harbour hall, in full', url: 'https://www.youtube.com/watch?v=P71g1view1', ts: NOW - 3 * H, meta: { platform: 'youtube', issues: ['gastax'], id: 'g1yt1', term: 'gas export tax', eng: { views: 0 } } },
    { src: 'x', title: 'x post', body: 'My statement on the gas export tax and the harbour towns', url: 'https://x.com/rileymember/status/1999000000000000071', ts: NOW - 4 * H, meta: { platform: 'x', issues: ['gastax'], id: 'g1mp1', mp: { name: 'Riley Member', party: 'Independent' }, eng: { likes: 0 } } },
    { src: 'bluesky', title: 'bluesky post', body: 'Seven reasons the gas export tax is fair to the harbour towns', url: 'https://bsky.app/profile/harbourforum.example.com.au/post/3kg1b', ts: NOW - 5 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'g1bs1', term: 'gas export tax', eng: { likes: 5, reposts: 1, replies: 2, quotes: 1 } } }]);
  const B = await boardAndLines(w); const rows = B.board.social.map(s => ['S', s]).concat(B.board.actors.map(a => ['P', a]));
  const at = re => { const x = rows.find(p => re.test(p[1].text)) || ['S', {}]; return { r: x[1], line: B.line(x[0], x[1].id) }; };
  [[/where the gas export tax money/, '0 comments, likes not recorded'], [/explainer for the pier/, '0 likes, comments not recorded'], [/Fishing co-op members/, '0 likes, 0 reposts, comments not recorded'],
    [/Two questions from Australia/, '0 replies, likes not recorded'], [/from the town hall tonight/, '0 comments, 0 views, likes not recorded'], [/forum at the harbour hall/, '0 views, likes and comments not recorded'],
    [/My statement on the gas/, '0 likes, comments not recorded']].forEach(([re, words]) => { const p = at(re);
    ok(p.r.id && p.line.endsWith('| ' + words), 'the line, as the evidence lane wrote it (D3): ' + words + ' // ' + p.line);
    eq(E.engSay(p.r), words, 'the card says what its line says (on 2ca1637 "no interactions"): ' + p.line.slice(0, 120));
    ok(/^Its (likes|comments|likes and comments) were not recorded, and every count read is zero$/.test(E.engTip(p.r)), 'its tooltip names what was not recorded, never "Its counts were read, and all are zero": ' + E.engTip(p.r)); });
  const z = at(/submission for Australia is in/), c = at(/came to the gas export tax rally/), b = at(/Seven reasons the gas/);
  ok(z.line.endsWith('| no interactions') && c.line.endsWith('| 3 comments') && b.line.endsWith('| 5 likes, 1 repost, 1 quote, 2 replies'), [z.line, c.line, b.line].join(' // '));
  eq([E.engSay(z.r), E.engTip(z.r)], ['no interactions', 'Its counts were read, and all are zero'], 'likes and comments both read at nought: as before');
  eq([E.engSay(c.r), E.engTip(c.r)], ['3 interactions', '3 comments'], 'a count read above nought is said, a missing like count with it: as before');
  eq([E.engSay(b.r), E.engTip(b.r)], ['9 interactions', '5 likes, 1 repost, 1 quote, 2 replies'], 'its counts in its line\'s order (on 2ca1637 "5 likes, 2 replies, 1 repost, 1 quote")');
});

await S.t('EX20 (G2) the comments under a post, or an actor\'s post, are counted on its card as its evidence line counts them: read, never held', async () => {
  const said = commentsOf().say;   // p71 fx5 (R1): the count read from docs/den.js as commentsOf reads it (heldSay since then)
  const w = await mk();
  await push(w, 'sig_thread', [{ src: 'bluesky', title: 'bluesky post', body: 'The gas export tax will empty the harbour towns, the fishers say', url: 'https://bsky.app/profile/harbourforum.example.com.au/post/3kg2a', ts: NOW - 3 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'g2p1', term: 'gas export tax', eng: { likes: 4, replies: 3 } } },
    { src: 'x', title: 'x post', body: 'My answer to the harbour towns on the gas export tax', url: 'https://x.com/rileymember/status/1999000000000000072', ts: NOW - 4 * H, meta: { platform: 'x', issues: ['gastax'], id: 'g2mp1', mp: { name: 'Riley Member', party: 'Independent' }, eng: { likes: 6, replies: 1 } } }]);
  await push(w, 'sig_comment', [-0.5, -0.3, -0.1].map((t, i) => ({ src: 'bluesky', body: 'A reply from the pier ' + i, url: 'x:p71g2:' + i, ts: NOW - 2 * H, tone: t, meta: { thread: 'g2p1' } })).concat([{ src: 'x', body: 'A reply to the member', url: 'x:p71g2:mp', ts: NOW - 2 * H, tone: 0.4, meta: { thread: 'g2mp1' } }]));
  const B = await boardAndLines(w); const p = B.board.social.find(s => /empty the harbour towns/.test(s.text)) || {}, a = B.board.actors.find(s => /My answer to the harbour/.test(s.text)) || {};
  eq([p.held && p.held.n, a.held && a.held.n], [3, 1], 'the comments read under each: ' + JSON.stringify([p.held, a.held]));
  const line = B.line('S', p.id); ok(/\| 3 comments read, mostly negative$/.test(line), 'its line counts them read: ' + line);
  eq(said(p), '3 comments read', 'the post card counts them as its line does (on 2ca1637 "3 comments held")'); ok(line.indexOf('| ' + said(p) + ', ') > 0, 'in the same words: ' + said(p) + ' // ' + line);
  eq(said(a), '1 comment read', 'an actor\'s post card too, one comment in the singular');
  ok(B.line('P', a.id).endsWith('| ' + said(a)), 'since p71 fx5 (R1) its P: line counts them too, in the same words (one comment carries too little to say a tone): ' + B.line('P', a.id));
});

await S.t('EX21 (G3) a stale story with a time of its own is dated on its cards by its address, in its line\'s words, and never called recent', async () => {
  const fmtN = n => Number(n).toLocaleString('en-AU'); const { addrDay, addrDated } = addrFns(); const wyr = syd(NOW).slice(0, 4);
  // the Board card's date as the Card writes it, the card's weight, and the Brief's evidence card (docs/den-brief.js), each read
  // from its file; since p71 fx5 (R2) the card holds the window's year (yr) and the Brief its window's day (day)
  const when = (k, r) => new Function('k', 'r', 'yr', 'html', 'aest', 'since', 'addrDay', 'addrDated', 'return ' + pageLine(DENJS, 'when'))(k, r, wyr, () => 'html', t => 'time:' + t, t => 'ago:' + t, addrDay, addrDated);
  const toCards = new Function('fbTotal', 'return ' + pageFn(DENJS, 'function toCards(d) {'))(() => 0);
  const weigh = new Function('fmtN', 'sigsFor', 'SIG', 'addrDated', 'return ' + pageFn(DENJS, 'function weigh(c, signals, now) {'))(fmtN, () => [], {}, addrDated);
  const metaOf = new Function('fmtN', 'plural', 'since', 'addrDay', 'addrDated', 'day', 'return ' + pageFn(PAGE, 'const metaOf = (c, e) => {').replace(/^const metaOf = /, ''))(fmtN, (n, x) => n + ' ' + x + (n === 1 ? '' : 's'), t => 'ago:' + t, addrDay, addrDated, syd(NOW));
  const w = await mk(); const old = syd(NOW - 6 * D), today = syd(NOW - H);
  await push(w, 'news', [{ src: 'pointpost', title: 'A feed sends the old harbour levy story again', body: 'The Senate debated a gas export tax last week, campaigners said.', url: 'https://pointpost.example.com.au/' + old.split('-').join('/') + '/harbour-levy-again/', ts: NOW - H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } },
    { src: 'tribune', title: 'An undated story on the gas export tax vote', body: 'The Senate will vote on a gas export tax this week, campaigners said.', url: 'https://tribune.example.com.au/' + today.split('-').join('/') + '/gas-tax-vote-undated/', ts: NOW - H, meta: { issues: ['gastax'], source: 'tribune', tier: 'regional', juris: 'au', reg: 1, urldate: 1 } }]);
  const B = await boardAndLines(w); const s = B.board.media.find(x => /old harbour levy story/.test(x.title)) || {}, u = B.board.media.find(x => /undated story on the gas/.test(x.title)) || {};
  eq([s.stale, s.urlDated, s.urlDate, u.stale, u.urlDated], [true, false, old, false, true], 'a stale story its feed gave a time, and a story dated by its address');
  eq(String(B.board.window.day).slice(0, 4), wyr, 'the window\'s year, as the card is handed it');
  const line = B.line('M', s.id), d = line.match(/\| (\d{1,2} [a-z]{3}(?: \d{4})? \(the date in its address, before this window\)) \|/) || []; ok(d[1], 'its line prints the day in its address: ' + line.slice(0, 160));
  const card = when('media', s); eq(card, addrDay(s, wyr), 'its Board card is dated by its address (on 2ca1637 by its feed\'s time)');
  // p71 fx5 (R2): the whole words, as the line writes them (on ecb2292 the day number and the bracket matched, the month did not: "Nov" against "nov")
  ok(!/time:|\d:\d\d|\b[ap]m\b/i.test(card), 'never a time: ' + card); eq(card, d[1], 'in its line\'s words, word for word: ' + line.slice(0, 120)); eq(when('media', u), addrDay(u, wyr), 'an address-dated story as before (C8)');
  const lu = B.line('M', u.id), du = lu.match(/\| (\d{1,2} [a-z]{3}(?: \d{4})? \(the date in its address\)) \|/) || []; eq(when('media', u), du[1], 'and in its line\'s words: ' + lu.slice(0, 120));
  // the page dates it as its evidence record does, so its weight never calls it recent; an address-dated story was found then, its time is not known
  const cs = toCards(B.board), cS = cs.find(c => c.id === s.id), cU = cs.find(c => c.id === u.id); const wS = weigh(cS, [], NOW).why, wU = weigh(cU, [], NOW).why;
  eq(cS.ts, (B.ev.ids.get('M:' + s.id) || {}).ts, 'the stale card\'s time is its evidence record\'s, midday of its address day (on 2ca1637 the feed\'s)');
  ok(!wS.some(x => /six hours/.test(x)), 'its weight never says "in the last six hours" (on 2ca1637 it did): ' + wS.join(', '));
  ok(wU.indexOf('found in the last six hours') >= 0 && wU.indexOf('in the last six hours') < 0, 'an address-dated story was found in the last six hours, not published then: ' + wU.join(', '));
  [[cS, s, d[1]], [cU, u, du[1]]].forEach(([c, r, said]) => { const m = metaOf(c, null); ok(m.indexOf(addrDay(r, wyr)) >= 0 && !/ago:/.test(m), 'the Brief\'s evidence card says its day, never hours ago (on 2ca1637 "ago"): ' + m);
    ok(m.split(' · ').indexOf(said) >= 0, 'in its line\'s words, word for word: ' + m + ' // ' + said); });
});

await S.t('EX22 (G2, beside the count) the tone of the comments read under a post is said on its card in its evidence line\'s words, on the line\'s bounds', async () => {
  // the chip as the Card writes it (its colour, whose tone it is, its words), each read from docs/den.js (commentsOf)
  const K = commentsOf(), toneWord = K.toneWord; const said = r => K.tone(r) || {};
  const w = await mk(); const P = (id, body) => ({ src: 'bluesky', title: 'bluesky post', body, url: 'https://bsky.app/profile/harbourforum.example.com.au/post/3kg22' + id, ts: NOW - 3 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'g22' + id, term: 'gas export tax', eng: { likes: 4, replies: 2 } } });
  // the means the line's bounds part: -0.6 and -0.3 were "hostile" on the card, -0.17 "mixed", 0.3 and 0.8 "warm". Since p71
  // fx5 (R1) a tone is said only when three comments or more carry one, so each mean rests on three (it rested on one or two)
  const tones = { a: [-0.6, -0.6, -0.6], b: [-0.5, -0.3, -0.1], c: [-0.17, -0.17, -0.17], d: [0.1, 0, 0.05], e: [0.3, 0.3, 0.3], f: [0.7, 0.9, 0.8] };
  await push(w, 'sig_thread', [P('a', 'The gas export tax will ruin the pier markets, the stallholders say'), P('b', 'Fishers at the harbour forum argue the gas export tax is a cash grab'),
    P('c', 'A long thread on what the gas export tax means for the harbour towns'), P('d', 'Questions and answers on the gas export tax from the town hall meeting'),
    P('e', 'The gas export tax could fund the new harbour wall, the council says'), P('f', 'Good news for the harbour towns as the gas export tax funds the new jetty'),
    { src: 'x', title: 'x post', body: 'My reply to the harbour towns on the gas export tax vote', url: 'https://x.com/rileymember/status/1999000000000000222', ts: NOW - 4 * H, meta: { platform: 'x', issues: ['gastax'], id: 'g22mp', mp: { name: 'Riley Member', party: 'Independent' }, eng: { likes: 6, replies: 1 } } }]);
  await push(w, 'sig_comment', [].concat(...Object.keys(tones).map(k => tones[k].map((t, i) => ({ src: 'bluesky', body: 'A reply from the pier ' + k + i, url: 'x:p71g22:' + k + i, ts: NOW - 2 * H, tone: t, meta: { thread: 'g22' + k } }))))
    .concat([0, 1, 2].map(i => ({ src: 'x', body: 'A reply to the member ' + i, url: 'x:p71g22:mp' + i, ts: NOW - 2 * H, tone: -0.3, meta: { thread: 'g22mp' } }))));
  const B = await boardAndLines(w); const want = { a: 'strongly negative', b: 'mostly negative', c: 'mostly negative', d: 'mixed', e: 'mostly positive', f: 'strongly positive' };
  Object.keys(tones).forEach(k => { const p = B.board.social.find(s => s.url && s.url.endsWith('/3kg22' + k)) || {}; const line = B.line('S', p.id), m = line.match(/\| (\d+) comments? read, ([a-z ]+)$/) || [];
    eq(m[2], want[k], 'the line says the tone of the comments read under it in words: ' + line.slice(0, 160));
    const c = said(p); eq(c.text, m[2], 'its card says the line\'s words (on 2ca1637 "hostile", "mixed" or "warm" on bounds of its own): ' + JSON.stringify(p.held));
    eq(c.cls, 'den-chip' + (/negative/.test(m[2]) ? ' neg' : /positive/.test(m[2]) ? ' pos' : ''), 'coloured by the same words');
    eq(c.title, 'The tone of the ' + m[1] + ' comment' + (m[1] === '1' ? '' : 's') + ' read under it', 'and the chip says whose tone it is, as the line counts them'); });
  const a = B.board.actors.find(x => /My reply to the harbour/.test(x.text)) || {}; eq([a.held && a.held.n, said(a).text, said(a).cls, said(a).title], [3, 'mostly negative', 'den-chip neg', 'The tone of the 3 comments read under it'], 'an actor\'s post card too');
  // the words on every mean, against the worker's own denToneWord: the bounds are the line's
  const off = []; for (let i = -100; i <= 100; i++) { const m = i / 100; if (toneWord(m) !== w.mod.__test.denToneWord(m, 1)) off.push(m + ': ' + toneWord(m) + ' / ' + w.mod.__test.denToneWord(m, 1)); }
  eq(off, [], 'the card\'s tone words are the line\'s on every mean from -1 to 1');
});

// ---- the fifth fix round (page lane): what the comments' tone rests on, and the address day's words (each fails on ecb2292)
await S.t('EX23 (R1) a tone of the comments under a post rests on those that carry one, three at least, and the card says it as the line does', async () => {
  const K = commentsOf(); const w = await mk();
  const P = (id, body, extra) => Object.assign({ src: 'bluesky', title: 'bluesky post', body, url: 'https://bsky.app/profile/harbourforum.example.com.au/post/3kr1' + id, ts: NOW - 3 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'r1' + id, term: 'gas export tax', eng: { likes: 5, replies: 10 } } }, extra || {});
  await push(w, 'sig_thread', [P('a', 'Ten replies argue over the gas export tax and the harbour wall'), P('b', 'A long thread on the gas export tax and the pier markets'), P('c', 'Two replies on the gas export tax at the fish market'),
    P('d', 'Three replies on the gas export tax and the new jetty'),
    { src: 'x', title: 'x post', body: 'My view on the gas export tax and the ferry terminal', url: 'https://x.com/rileymember/status/1999000000000000501', ts: NOW - 4 * H, meta: { platform: 'x', issues: ['gastax'], id: 'r1mp', mp: { name: 'Riley Member', party: 'Independent' }, eng: { likes: 6, replies: 4 } } }]);
  // a: ten read, six carry a tone (mean -0.3); b: ten read, one carries -0.6 (the review's case); c: two read, both carry
  // one; d: three read, all carry one; the member's post: four read, three carry one (mean 0.3)
  const C = (th, n, tones) => Array.from({ length: n }, (_, i) => Object.assign({ src: 'bluesky', body: 'A reply ' + th + ' ' + i, url: 'x:p71r1:' + th + i, ts: NOW - 2 * H, meta: { thread: th } }, i < tones.length ? { tone: tones[i] } : {}));
  await push(w, 'sig_comment', [].concat(C('r1a', 10, [-0.5, -0.3, -0.1, -0.4, -0.2, -0.3]), C('r1b', 10, [-0.6]), C('r1c', 2, [-0.6, -0.6]), C('r1d', 3, [0.3, 0.2, 0.4]), C('r1mp', 4, [0.3, 0.3, 0.3])));
  const B = await boardAndLines(w); const at = id => B.board.social.find(s => s.url && s.url.endsWith('/3kr1' + id)) || {}; const a = at('a'), b = at('b'), c = at('c'), d = at('d');
  const m = B.board.actors.find(x => /My view on the gas export tax/.test(x.text)) || {};
  // the read counts the comments that carry a tone beside those read, and gives no tone resting on fewer than three
  eq([a, b, c, d, m].map(r => r.held), [{ n: 10, toned: 6, tone: -0.3 }, { n: 10, toned: 1, tone: null }, { n: 2, toned: 2, tone: null }, { n: 3, toned: 3, tone: 0.3 }, { n: 4, toned: 3, tone: 0.3 }], 'what each post\'s comments hold (on ecb2292 no toned, and b "-0.6" of ten read)');
  const want = [[a, 'S', '10 comments read (6 with a tone reading), mostly negative'], [b, 'S', '10 comments read'], [c, 'S', '2 comments read'], [d, 'S', '3 comments read, mostly positive'], [m, 'P', '4 comments read (3 with a tone reading), mostly positive']];
  want.forEach(([r, k, words]) => { const line = B.line(k, r.id); ok(line.endsWith(' | ' + words), 'the line: ' + words + ' // ' + line);
    eq(K.words(r), words, 'the card says the line\'s words, the count and the chip in the line\'s order: ' + line.slice(-90)); ok(!/\b(judged|held)\b/.test(line + ' ' + K.words(r)), 'in the reader rule\'s words'); });
  eq([K.tone(b), K.tone(c)], [null, null], 'no chip where the line says no tone (on ecb2292 b showed "strongly negative" on one comment of ten)');
  eq(K.tone(a), { cls: 'den-chip neg', title: 'The tone of the 6 of the 10 comments read under it that have a tone reading', text: 'mostly negative' }, 'the chip\'s title says whose tone it is: six of the ten (on ecb2292 "The tone of the 10 comments read under it")');
  eq([K.tone(d).title, K.tone(m).title], ['The tone of the 3 comments read under it', 'The tone of the 3 of the 4 comments read under it that have a tone reading'], 'all of them, or how many');
  // a Board from a worker before p71 fx5 (no toned): its card says what that worker's line said
  eq([K.words({ held: { n: 3, tone: -0.3 } }), K.tone({ held: { n: 3, tone: -0.3 } }).title], ['3 comments read, mostly negative', 'The tone of the 3 comments read under it'], 'an older Board reads as before');
});

await S.t('EX24 (R2) a story\'s address day is written on its cards as its line writes it, with its year when that is not the window\'s', async () => {
  const { addrDay } = addrFns(); const M3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  // the line's months, every one (Intl wrote "Sept", "June" and "July", and capitals); a year only when it is not the window's
  eq(M3.map((x, i) => addrDay({ stale: true, urlDate: '2026-' + String(i + 1).padStart(2, '0') + '-05' }, '2026')), M3.map(x => '5 ' + x + ' (the date in its address, before this window)'), 'each month as the line writes it');
  eq([addrDay({ stale: true, urlDate: '2019-03-04', ts: NOW }, '2026'), addrDay({ urlDated: true, urlDate: '2026-12-31', ts: NOW }, '2027'), addrDay({ urlDated: true, urlDate: '2027-01-02', ts: NOW }, '2027')],
    ['4 mar 2019 (the date in its address, before this window)', '31 dec 2026 (the date in its address)', '2 jan (the date in its address)'], 'its year when it is not the window\'s (on ecb2292 "4 Mar" for a 2019 address)');
  // the worker's line and the page's cards for twelve stories whose addresses are from 2019, one a month, and one from six days ago
  const nouns = ['pier', 'jetty', 'wharf', 'marina', 'seawall', 'boat ramp', 'fish market', 'sea baths', 'lighthouse', 'breakwater', 'slipway', 'ferry terminal'];
  const w = await mk(); const recent = syd(NOW - 6 * D), wyr = syd(NOW).slice(0, 4);
  const mk1 = (i, day, noun) => ({ src: 'coast' + i, title: 'The ' + noun + ' plan and the gas export tax, from the archive', body: 'The council weighed the ' + noun + ' and a gas export tax, campaigners said.', url: 'https://coast' + i + '.example.com.au/' + day.split('-').join('/') + '/' + noun.replace(/ /g, '-') + '-plan/', ts: NOW - H, meta: { issues: ['gastax'], source: 'coast' + i, tier: 'regional', juris: 'au', reg: 1 } });
  await push(w, 'news', nouns.map((n, i) => mk1(i, '2019-' + String(i + 1).padStart(2, '0') + '-04', n)).concat([mk1(12, recent, 'harbour pool')]));
  const B = await boardAndLines(w); const yr = String(B.board.window.day).slice(0, 4); eq(yr, wyr, 'the window\'s year');
  const metaOf = new Function('fmtN', 'plural', 'since', 'addrDay', 'addrDated', 'day', 'return ' + pageFn(PAGE, 'const metaOf = (c, e) => {').replace(/^const metaOf = /, ''))(n => String(n), (n, x) => n + ' ' + x, t => 'ago:' + t, addrDay, addrFns().addrDated, B.board.window.day);
  const cs = new Function('fbTotal', 'return ' + pageFn(DENJS, 'function toCards(d) {'))(() => 0)(B.board);
  nouns.concat(['harbour pool']).forEach((n, i) => { const s = B.board.media.find(x => x.title.indexOf('The ' + n + ' plan') === 0) || {}; const line = B.line('M', s.id); const said = (line.match(/^\[M:\d+\] [^|]*\| ([^|]*?) \| /) || [])[1];
    const ud = i < 12 ? '2019-' + String(i + 1).padStart(2, '0') + '-04' : recent; const want = +ud.slice(8) + ' ' + M3[+ud.slice(5, 7) - 1] + (ud.slice(0, 4) !== yr ? ' ' + ud.slice(0, 4) : '') + ' (the date in its address, before this window)';
    ok(s.id && s.stale, 'on the Board, stale: ' + n); eq(said, want, 'the line writes the day, with its year when not the window\'s (on ecb2292 no year): ' + line.slice(0, 140));
    eq(addrDay(s, yr), said, 'the Board card writes it as the line does, word for word: ' + n);
    const c = cs.find(x => x.id === s.id); ok(c && metaOf(c, null).split(' \u00b7 ').indexOf(said) >= 0, 'and the Brief\'s card: ' + (c ? metaOf(c, null) : n)); });
  // the evidence card (the line's sub) says the same day
  const s0 = B.board.media.find(x => x.title.indexOf('The pier plan') === 0) || {}; ok(String((B.ev.ids.get('M:' + s0.id) || {}).sub || '').indexOf(', 4 jan 2019') > 0, 'the evidence card\'s figures too: ' + (B.ev.ids.get('M:' + s0.id) || {}).sub);

});

// ---- the third review round (cron lane): the page's own toCards and citeOf over the worker's own Board and brief
const pageCards = () => ({ toCards: new Function('fbTotal', 'return ' + pageFn(DENJS, 'function toCards(d) {'))(() => 0), citeOf: new Function('return ' + pageFn(DENJS, 'function citeOf(c, ev) {'))() });
const stubDraft = w => w.answer(/api\.anthropic\.com/, (u, init) => { const m = (String(JSON.parse(init.body).messages[0].content).match(/\[M:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0];
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'Coverage of the levy continued ' + m + '.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
const tell = (src, slug, title, body, ago) => ({ src, title, body, url: 'https://' + src + '.example.com.au/' + slug, ts: NOW - ago * H, meta: { issues: ['gastax'], source: src, tier: 'regional', juris: 'au', reg: 1 } });
const LEVY = tell('tribune', 'story-levy', 'Crossbench renews its call for a windfall levy', 'Campaigners and producers set out their positions on the levy this week.', 4);
const boardOf = async w => (await F(w, 'GET', '/den/board?desk=aep_au', null, 'read-key')).body;
const draftEv = async w => { const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); if (r.status !== 200) throw new Error('draft failed: ' + r.text.slice(0, 200)); return (await F(w, 'GET', '/den/brief?desk=aep_au', null, 'read-key')).body.brief.evidence; };
const upCards = (P, b) => P.toCards(b).filter(c => c.kind === 'upcoming');

await S.t('EX25 (K3) a row\'s date card and two recorded dates with one label are each cited by their own U: line', async () => {
  const P = pageCards(); const at = n => new Date(NOW + n * D + 11 * H); const day = at(7).toISOString().slice(0, 10), words7 = at(7).getUTCDate() + ' ' + MON[at(7).getUTCMonth()];
  const w = await mk(); stubDraft(w);
  await push(w, 'news', [tell('pointpost', 'hearing-1', 'Senate inquiry sets a public hearing on the gas export tax', 'A public hearing on the gas export tax will be held on ' + words7 + ' in Canberra, its chair said.', 2), LEVY]);
  await boardOf(w);   // the first read makes the parliament calendar's table
  const put = w.env.MIND_DB.db.prepare('INSERT INTO den_process(id, type, title, stage, url, issues, next_date, next_what, seen, updated) VALUES(?,?,?,?,?,?,?,?,?,?)');
  put.run('proc_ex20_gas', 'inquiry', 'Gas export tax inquiry', 'hearings', 'https://parliament.example.com.au/inquiry-gas', '["gastax"]', day, 'hearing', NOW, NOW);
  put.run('proc_ex20_levy', 'inquiry', 'Harbour levy inquiry', 'hearings', 'https://parliament.example.com.au/inquiry-levy', '["gastax"]', day, 'hearing', NOW, NOW);
  const cs = upCards(P, await boardOf(w)).filter(c => c.label === day + ' hearing'); const row = cs.find(c => +c.r.item > 0), gas = cs.find(c => c.r.process === 'proc_ex20_gas'), levy = cs.find(c => c.r.process === 'proc_ex20_levy');
  ok(cs.length === 3 && row && gas && levy && new Set(cs.map(c => c.key)).size === 3, 'one day, one event: a row\'s date and two inquiries\' recorded hearings, three cards: ' + cs.map(c => c.key).join(' '));
  const ev = await draftEv(w); const U = Object.keys(ev).filter(k => /^U:/.test(k) && ev[k].label === day + ' hearing'); const cite = c => P.citeOf(c, ev);
  const txt = id => (ev[id] ? String(ev[id].text || '') : '(none)');   // what the line says: the row's sentence, or the inquiry's title
  ok(/^A public hearing on the gas export tax/.test(txt(cite(row))), 'the row\'s card is cited by its own row\'s line, never a recorded one listed first (on 2ca1637 the first recorded line): ' + txt(cite(row)));
  ok(/^Gas export tax inquiry/.test(txt(cite(gas))) && /^Harbour levy inquiry/.test(txt(cite(levy))), 'each inquiry\'s hearing by its own record\'s line, so Cite on the second never inserts the first (on 2ca1637 both took the first): ' + txt(cite(gas)) + ' // ' + txt(cite(levy)));
  eq(new Set([cite(row), cite(gas), cite(levy)]).size, 3, 'three cards, three lines');
  eq(U.map(k => ev[k].process || '').filter(Boolean).sort(), ['proc_ex20_gas', 'proc_ex20_levy'], 'each recorded date\'s U: line carries its record');
  eq([ev[cite(row)].item, ev[cite(row)].process], [row.r.item, undefined], 'and the row\'s line its row, no record');
  // a brief stored before the lines kept a record: a recorded date is still found by its label, and a row's card never takes it
  const old = {}; U.forEach(k => { old[k] = { k: 'upcoming', label: ev[k].label, item: ev[k].item }; });
  eq([ev[P.citeOf(gas, old)] && ev[P.citeOf(gas, old)].process ? 'recorded' : '', P.citeOf(row, old) === cite(row)], ['recorded', true], 'older lines: by label for a record, by its own row for a row');
});


const r = S.done(); process.exit(r.fail ? 1 : 0);
