/* Den build p71, the signals lane (the real-data check of 17 November 2026): the strip's checks, tone, narratives and
 * momentum as the model reads them, against the worker module in this process. No provider is contacted: the model is a
 * stub that writes from the evidence it is sent, and agency memory is a stub index. Every outlet, account, organisation,
 * address and post here is invented. Each case fails on p70 (a2222eb's worker before this lane).
 *   SG1 the channels her reports rest on (DEN_RELIED) are named as not read when they delivered nothing: a Bluesky-only
 *       window on an AEP desk tells the model "not read: X, Facebook, Instagram, YouTube, Reddit", an MCA desk leaves
 *       Reddit out, the strip lists them in one order, and a desk's options.channels replaces its client's list
 *   SG2 a burst is a citable I: line carrying its figures; citing the tone line (T:) or writing the issue's name no longer
 *       clears it at filing, and a sentence stating its figures with [I:] does, with no figure flagged
 *   SG3 a first-seen entity's cover is the row that named it (a syndicated copy by its fold's head), that row reaches the
 *       model even when the board would rank it past the cap, citing it clears the check, and an entity named only in a
 *       passing mention raises nothing
 *   SG4 tone is one judgement per story: four syndicated copies count once, two posts of one text count once, a passing
 *       mention is left out, the ids behind the negative and the positive counts are listed, and no score is in the line
 *       (the card keeps the figures)
 *   SG5 a narrative line says when it was first seen and whether it is new in this window or building, what its posts and
 *       stories in the window are (one templated text from many accounts; one story and its syndicated copies), "toward
 *       AEP", a working title as a working title and a missing claim as missing; the block holds ten narratives at 24
 *       hours and fifteen at 168, an emerging one always in
 *   SG6 the window before: each issue's posts and stories in this window and in the window of the same length before it,
 *       as citable C: lines, counted the same way (the board's kinds and the issue's own tag, never a term that merely
 *       contains it), "the day before" or "the week before" by the window, and bounded
 *   SG7 a memory line carries its title, source and words, so a reviewer can read it back; no line this lane writes says
 *       "rows", "held", "judged" or "the client"
 * The review of build p71 (the strip lane's fixes; each of these fails on df42fb8, the integration before them):
 *   SG8 a burst for a window that closed before now counts that window's rows alone (overviewIssues is bounded by the
 *       window's end), and a brief's earlier window neither reads nor writes the live strip's cached figures (ST1)
 *   SG9 an issue tagged as it is now for less than the fortnight (MCA mentions; mining, narrowed) raises no burst and no
 *       rise or fall against the day before: the burst check and THE WINDOW BEFORE say it is not compared and why; an
 *       issue p71 left alone is checked as before; the record of when tagging began is written once, lifts after the
 *       fortnight, and marks the next issue added or changed from now (CO1)
 *   SG10 the window before is counted as the Board counts both windows: a muted site, set-asides, the minimum engagement
 *       and a state desk's region (EV2)
 *   SG11 a first-seen check and a tone count resting on the third of three templated posts point at the line the three
 *       share, under the first post's id (EV4, ST6)
 *   SG12 a Sentinel spike on a state desk says, in its line, its card and the strip, that it is counted across Australia (EV6)
 *   SG13 a busy database in the tone, window-before or narratives read is said (the evidence is not built), never an
 *       evidence text quietly missing a block (EV7)
 *   SG14 three thousand judged comments do not push a week's older judged stories out of the tone line (EV8)
 *   SG15 a narrative's comments are counted as comments, its count is "posts, stories and comments", and four identical
 *       short posts are not called a templated push (EV9)
 *   SG16 a story its outlet labels "Special Report" (an outlet whose label marks a piece made with the company, as
 *       DEN_SPONSORED_HOSTS lists them: an invented one is added here) is left out of the tone counts and its ids, and the
 *       line says so (ST7)
 *   SG17 an outlier's total and usual are a citable O: line pointing at the post: a sentence stating them is verified and
 *       covers the check at filing (ST8)
 * The second review of build p71 (lane evidence; each fails on 3b71160, the merge of the first review's fixes):
 *   SG18 tone reads one flag, the Board's: a wire's own investigation headed "Special Report:" is press tone, counted and
 *       cited like any story (D4)
 *   SG19 the first record of when tagging began is seeded from p70's own matchers, not a list of ids: an issue a later build
 *       re-tags or adds is marked from now even when no record was written before it (D5). Changed in the third review
 *       (F3, failing on 2ca1637): the fingerprint is the matcher alone, so approving, switching off or re-filing a desk's
 *       term leaves its issue compared, and the record is kept without reading the desk's terms at all, busy or not
 *   SG20 the Overview sets no issue tagged as it is now for less than the fortnight against its usual (no usual, no
 *       ratio, and since when), and the AXIOM brief's evidence says it is not compared; the burst check still reads the
 *       figures as they are, since it says why itself (D5)
 * Run: node --experimental-sqlite tests/den-p71-signals-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Den p71 signals: the strip, tone, narratives and momentum as the model reads them');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, D = 86400000, NOW = Date.now();
let seq = 0;
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const news = o => { seq++; return Object.assign({ src: 'pointpost', title: 'Crossbench renews call for a gas export tax, part ' + seq, body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://pointpost.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }, o); };
const post = o => { seq++; return Object.assign({ src: 'bluesky', title: 'bluesky post', body: 'A gas export tax is overdue, post ' + seq + '.', url: 'https://social.example.com.au/post/' + seq, ts: NOW - 3 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'b' + seq, eng: { likes: 4 }, score: 4, comments: 0 } }, o); };
const itemBy = (w, url) => w.env.MIND_DB.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id;
const judge = (w, item, tone, issues, kind, ts) => w.env.MIND_DB.db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)').run(item, kind || 'news', kind === 'sig_thread' ? 'bluesky' : 'news', 'pointpost', ts || NOW - 2 * H, tone, JSON.stringify(issues || ['gastax']), 'claude');
const names = (w, item, entity, ts) => w.env.MIND_DB.db.prepare('INSERT INTO sent_entities(item,entity,stance,intensity,ts,platform,kind) VALUES(?,?,?,?,?,?,?)').run(item, entity, 0, 1, ts || NOW - 2 * H, 'news', 'org');
const entity = (w, id, name) => w.env.MIND_DB.db.prepare("INSERT OR REPLACE INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,'org',?,?,'','Invented','neutral','aep',1,1,'test','',?,?)").run(id, name, JSON.stringify([name]), NOW, NOW);
// the stub model: make(evidence, ids) answers the sections; the default cites the first story and post it was given
const model = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content; const ids = k => Array.from(new Set((ev.match(new RegExp('^\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'gm')) || []).map(x => x.slice(1, -1))));
  const j = make ? make(ev, ids) : { sections: { summary: 'Coverage of the gas taxation debate continued [' + (ids('M')[0] || 'M:0') + '].', bottom: 'Activity is steady [' + (ids('M')[0] || 'M:0') + '].' }, ratings: {} };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const lineOf = (ev, id) => (ev.match(new RegExp('^\\[' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\][^\\n]*', 'm')) || [''])[0];
const block = (ev, head) => { const at = ev.split('\n').findIndex(l => l.indexOf(head) === 0); if (at < 0) return []; const out = []; for (const l of ev.split('\n').slice(at)) { if (!l.trim()) break; out.push(l); } return out; };
const LONG = ' The window held a steady run of coverage across regional outlets, with the Senate debate as its centre and the posts that followed it repeating the same arguments in shorter form.';

await S.t('SG1 the channels her reports rest on are named as not read; options.channels replaces the list', async () => {
  const w = await mk(); const T = w.mod.__test; const calls = model(w);
  await push(w, 'news', [news({ title: 'Senate weighs a gas export tax', url: 'https://pointpost.example.com.au/sg1' })]);
  await push(w, 'sig_thread', [post({}), post({}), post({ meta: { platform: 'bluesky', issues: ['ftc'], id: 'bftc', eng: { likes: 2 }, score: 2 }, body: 'The fuel tax credit for miners again.' })]);
  const gaps = async desk => (await F(w, 'GET', '/den/missed?desk=' + desk + '&fresh=1', null, 'read-key')).body.signals.filter(s => s.sig === 'gap').map(s => s.key);
  eq(await gaps('aep_au'), ['G:x', 'G:facebook', 'G:instagram', 'G:youtube', 'G:reddit'], 'AEP: every channel her reports rest on that delivered nothing, in one order, though the register holds no account there');
  eq(await gaps('mca_au'), ['G:news', 'G:x', 'G:facebook', 'G:instagram', 'G:youtube'], 'MCA: its own list (no Reddit)');
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const ev = calls[0].messages[0].content;
  const ch = (ev.match(/^CHANNELS READ IN THIS WINDOW: [^\n]*$/m) || [''])[0];
  eq(ch, 'CHANNELS READ IN THIS WINDOW: News (1 story), Bluesky (2 posts); not read: X, Facebook, Instagram, YouTube, Reddit.', 'the one line the model reads');
  ok(!/delivered nothing|collector|signed-in|G:x/i.test(ev), 'and nothing else about collection reaches it');
  // a desk's own list replaces its client's (deskUpdate checks the ids; the stored option is read as it stands)
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET options=json_set(options,'$.channels',json(?)) WHERE id='aep_au'").run(JSON.stringify(['x', 'reddit']));
  eq(await gaps('aep_au'), ['G:x', 'G:reddit'], 'options.channels replaces the seed');
  const r2 = await F(w, 'POST', '/den/brief', { desk: 'aep_au', replace: true }); eq(r2.status, 200, r2.text.slice(0, 200));
  ok(/; not read: X, Reddit\.$/m.test(calls[1].messages[0].content), 'and the model is told so: ' + (calls[1].messages[0].content.match(/^CHANNELS[^\n]*/m) || [''])[0]);
  eq(T.denRelied({ ns: 'aep', options: { channels: ['MySpace', 'X', 'news', 'reddit'] } }), ['x', 'reddit'], 'an unknown channel and News are never a desk\'s relied-on channel');
  eq(T.denRelied({ ns: 'guns', options: { channels: [] } }), ['x', 'facebook', 'instagram', 'youtube'], 'an empty list keeps the client\'s');
});

// a gas-tax burst: six posts and stories in the window, two in the fortnight before (base 0.2, 30 times)
const burstWorld = async w => {
  await F(w, 'GET', '/sentiment/status');
  await push(w, 'news', [1, 2, 3, 4].map(i => news({ title: 'Gas export tax story number ' + i + ' of the day', url: 'https://pointpost.example.com.au/burst' + i, ts: NOW - (i + 1) * H })).concat([news({ title: 'An older gas export tax story', url: 'https://pointpost.example.com.au/old1', ts: NOW - 5 * D }), news({ title: 'A much older gas export tax story', url: 'https://pointpost.example.com.au/old2', ts: NOW - 9 * D })]));
  await push(w, 'sig_thread', [post({ url: 'https://social.example.com.au/burst-a' }), post({ url: 'https://social.example.com.au/burst-b' })]);
  [1, 2].forEach(i => judge(w, itemBy(w, 'https://pointpost.example.com.au/burst' + i), i === 1 ? -1 : 1));
};
await S.t('SG2 a burst is a citable I: line; only stating it clears it at filing', async () => {
  const w = await mk(); await burstWorld(w);
  const sig = (await F(w, 'GET', '/den/missed?desk=aep_au')).body.signals.find(s => s.key === 'I:gastax');
  ok(sig && /running above its baseline/.test(sig.title), 'the strip holds the burst: ' + JSON.stringify(sig)); eq([sig.cover, sig.words], [['I:gastax'], []], 'covered by its own id alone');
  const calls = model(w, (ev, ids) => ({ sections: { summary: 'Gas taxation was mixed in tone across the window [T:gastax]. The Senate debate led the press [' + ids('M')[0] + '].' + LONG, bottom: 'Gas taxation stayed on the agenda [' + ids('M')[0] + '].' }, ratings: {} }));
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const ev = calls[0].messages[0].content; const line = lineOf(ev, 'I:gastax');
  const m = line.match(/^\[I:gastax\] Gas taxation ran at ([\d.]+) times its usual volume: (\d+) posts, stories and comments in this window against ([\d.]+) usual for a window this long$/);
  ok(m && m[1] === '30' && m[2] === '6' && m[3] === '0.2', 'a citable line with its figures, written for a reader: ' + line);
  ok(br.evidence['I:gastax'] && /Gas taxation ran at 30 times/.test(br.evidence['I:gastax'].text), 'and the brief holds it: ' + JSON.stringify(br.evidence['I:gastax']));
  ok(block(ev, 'SIGNALS NOT TO MISS').indexOf(line) > 0, 'in the signals block');
  const ask = await F(w, 'POST', '/den/brief/file', { id: br.id, revision: br.revision }); eq([ask.status, ask.body.error], [409, 'uncited_signals'], ask.text.slice(0, 200));
  ok(ask.body.signals.some(s => s.key === 'I:gastax'), 'citing the tone line and writing "Gas taxation" no longer covers the burst: ' + JSON.stringify(ask.body.signals.map(s => s.key)));
  const said = 'Gas taxation ran at ' + m[1] + ' times its usual volume, ' + m[2] + ' posts, stories and comments against ' + m[3] + ' usual [I:gastax].';
  const s = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: said + LONG } }); eq(s.status, 200, s.text.slice(0, 200));
  eq([s.body.brief.sections.summary.cites, s.body.brief.sections.summary.unverified], [['I:gastax'], []], 'cited, and every figure is on its line');
  const f = await F(w, 'POST', '/den/brief/file', { id: br.id, revision: s.body.brief.revision }); eq([f.status, f.body.brief && f.body.brief.status], [200, 'filed'], 'stating the burst clears it: ' + f.text.slice(0, 300));
});

await S.t('SG3 a first-seen entity is covered by the row that named it, which reaches the model past the cap; a passing mention raises nothing', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  entity(w, 'harbourco', 'Harbour Gas Company'); entity(w, 'quaygroup', 'Quay Holdings Group'); entity(w, 'pierfirm', 'Pier Energy Partners');
  await push(w, 'news', Array.from({ length: 34 }, (_, i) => news({ title: 'Gas export tax filler story ' + (i + 1) + ' from the press gallery', url: 'https://pointpost.example.com.au/fill' + i, ts: NOW - (1 + i * 0.5) * H })));
  await push(w, 'news', [news({ title: 'Harbour Gas Company backs a gas export tax', url: 'https://pointpost.example.com.au/named', ts: NOW - 20 * H }),
    news({ title: 'Quay Holdings Group enters the gas export tax fight', url: 'https://pointpost.example.com.au/quay', ts: NOW - 19 * H }), news({ src: 'tribune', title: 'Quay Holdings Group enters the gas export tax fight - The Tribune', url: 'https://tribune.example.com.au/quay', ts: NOW - 18.5 * H, meta: { issues: ['gastax'], source: 'tribune', outlet: 'The Tribune' } }),
    news({ title: 'Weekend guide: markets, cafes and a new playground', body: 'Pier Energy Partners sponsor the stall beside the old gas works, where the markets run on Saturday.', url: 'https://pointpost.example.com.au/suburb', ts: NOW - 6 * H, meta: { issues: ['gas'], source: 'pointpost' } })]);
  const named = itemBy(w, 'https://pointpost.example.com.au/named'), quayHead = itemBy(w, 'https://pointpost.example.com.au/quay'), quayCopy = itemBy(w, 'https://tribune.example.com.au/quay'), suburb = itemBy(w, 'https://pointpost.example.com.au/suburb');
  judge(w, named, 0, ['gastax'], 'news', NOW - 20 * H); names(w, named, 'harbourco', NOW - 20 * H);
  judge(w, quayCopy, 0, ['gastax'], 'news', NOW - 18.5 * H); names(w, quayCopy, 'quaygroup', NOW - 18.5 * H);
  judge(w, suburb, 1, ['gas'], 'news', NOW - 6 * H); names(w, suburb, 'pierfirm', NOW - 6 * H);
  const b = (await F(w, 'GET', '/den/board?desk=aep_au')).body; ok(b.media.findIndex(m => m.id === named) >= 30, 'the board ranks the naming story past the cap of thirty: ' + b.media.findIndex(m => m.id === named));
  const sigs = (await F(w, 'GET', '/den/missed?desk=aep_au')).body.signals; const by = k => sigs.find(s => s.key === k);
  ok(by('E:harbourco') && by('E:quaygroup'), 'both first-seen: ' + JSON.stringify(sigs.map(s => s.key)));
  eq([by('E:harbourco').cover, by('E:harbourco').words, by('E:harbourco').items], [['M:' + named], ['Harbour Gas Company'], [named]], 'its cover is the row that named it');
  eq(by('E:quaygroup').cover, ['M:' + quayHead], 'a syndicated copy is cited by its fold\'s head');
  ok(!by('E:pierfirm'), 'named only in a passing mention (a suburb guide tagged by "gas works"), so it raises nothing');
  const calls = model(w, (ev, ids) => ({ sections: { summary: 'A gas producer backed the export tax [M:' + named + ']. A holding group joined the fight [M:' + quayHead + '].' + (ids('I').length ? ' Gas taxation ran well above its usual volume [' + ids('I')[0] + '].' : '') + LONG, bottom: 'The tax push widened [M:' + named + '].' }, ratings: {} }));
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const ev = calls[0].messages[0].content;
  ok(lineOf(ev, 'M:' + named), 'the naming story reaches the model past the cap');
  ok(block(ev, 'SIGNALS NOT TO MISS').some(l => l === '- Harbour Gas Company is named on these issues for the first time in fourteen days ([M:' + named + ']).'), 'and the check points at it: ' + block(ev, 'SIGNALS NOT TO MISS').join(' // '));
  eq(br.sections.summary.cites.indexOf('M:' + named) >= 0, true, 'cited');
  const f = await F(w, 'POST', '/den/brief/file', { id: br.id, revision: br.revision });
  ok(f.status === 200 || !(f.body.signals || []).some(s => /^E:(harbourco|quaygroup)$/.test(s.key)), 'citing the rows clears both checks without naming them: ' + f.text.slice(0, 300)); eq(f.status, 200, f.text.slice(0, 300));
});

await S.t('SG4 tone is one judgement per story, passing mentions out, the ids behind each count, no score', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const P = { issues: ['gasprojects'], source: 'pointpost' };
  await push(w, 'news', [['pointpost', 'Scott Reef decision delayed again', 'reef'], ['tribune', 'Scott Reef decision delayed again - The Tribune', 'reef-t'], ['coastwire', 'Scott Reef decision delayed again - Coast Wire', 'reef-c'], ['harbourtimes', 'Scott Reef decision delayed again - Harbour Times', 'reef-h']]
    .map(([src, title, slug], i) => news({ src, title, body: 'The decision on Scott Reef was pushed back again, the minister said.', url: 'https://' + src + '.example.com.au/' + slug, ts: NOW - (5 - i * 0.5) * H, meta: Object.assign({}, P, { source: src }) }))
    .concat([news({ title: 'Burrup hub approval draws a legal challenge', body: 'A legal challenge to the Burrup hub approval was lodged.', url: 'https://pointpost.example.com.au/burrup', ts: NOW - 3 * H, meta: P }),
      news({ title: 'Weekend guide: markets and music', body: 'A stall near the gas projects office sells honey on Saturday.', url: 'https://pointpost.example.com.au/guide', ts: NOW - 4 * H, meta: P })]));
  await push(w, 'sig_thread', ['a', 'b'].map(k => post({ body: 'Stop the Scott Reef gas project now and sign the open letter.', url: 'https://social.example.com.au/reef-' + k, meta: { platform: 'bluesky', issues: ['gasprojects'], id: 'reef' + k, eng: { likes: 3 }, score: 3 } })));
  const copies = ['https://pointpost.example.com.au/reef', 'https://tribune.example.com.au/reef-t', 'https://coastwire.example.com.au/reef-c', 'https://harbourtimes.example.com.au/reef-h'].map(u => itemBy(w, u));
  copies.forEach(id => judge(w, id, 1, ['gasprojects'])); const burrup = itemBy(w, 'https://pointpost.example.com.au/burrup'), guide = itemBy(w, 'https://pointpost.example.com.au/guide');
  judge(w, burrup, -1, ['gasprojects']); judge(w, guide, 1, ['gasprojects']); const pa = itemBy(w, 'https://social.example.com.au/reef-a'), pb = itemBy(w, 'https://social.example.com.au/reef-b'); [pa, pb].forEach(id => judge(w, id, -1, ['gasprojects'], 'sig_thread'));
  const calls = model(w); const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const ev = calls[0].messages[0].content; const line = lineOf(ev, 'T:gasprojects');
  ok(/^\[T:gasprojects\] Gas projects and approvals: mostly negative, across 2 stories and 1 post with a tone reading \(syndicated copies and repeated posts counted once\): 2 negative, 1 positive, 0 neutral\. /.test(line), 'four copies are one story, two posts of one text are one post, and the guide is left out: ' + line);
  const neg = ((line.match(/Negative: ((?:\[[A-Z]:\d+\] ?)+)/) || [])[1] || '').match(/[A-Z]:\d+/g) || [], pos = ((line.match(/Positive: ((?:\[[A-Z]:\d+\] ?)+)/) || [])[1] || '').match(/[A-Z]:\d+/g) || [];
  eq([neg.length, neg.indexOf('M:' + burrup) >= 0, neg.some(x => x === 'S:' + pa || x === 'S:' + pb), pos], [2, true, true, ['M:' + copies[0]]], 'the ids behind the negative and the positive counts, the copies by their fold\'s head');
  ok(neg.concat(pos).every(id => ev.indexOf('\n[' + id + '] ') >= 0), 'each one an id the model was given');
  ok(!/mean|score|-?\d\.\d/.test(line) && !/M:' + guide + '/.test(line), 'no score in the line');
  ok(/^7 rows judged, 3 once copies are folded; mean tone -0\.33; 2 negative, 1 positive$/.test(br.evidence['T:gasprojects'].sub), 'the card keeps the figures for the analyst: ' + br.evidence['T:gasprojects'].sub);
  ok(!/^KEY NARRATIVES/m.test(ev), 'and a window with no narrative carries no empty narratives header');
  await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { options: { fold: false } } }); const c2 = model(w); await F(w, 'POST', '/den/brief', { desk: 'aep_au', replace: true });
  const l2 = lineOf(c2[0].messages[0].content, 'T:gasprojects'); ok(/across 2 stories and 1 post with a tone reading [^:]*: 2 negative, 1 positive, 0 neutral\./.test(l2), 'a desk that shows copies apart on its Board still has one story in four copies: ' + l2);
});

// narratives written straight into the engine's tables, with their rows in the window
const narr = (w, o) => w.env.MIND_DB.db.prepare("INSERT INTO narratives(id,label,claim,issues,n,n24,first_ts,last_ts,status,muted,side,spread,auto_label,edited,scope) VALUES(?,?,?,?,?,?,?,?,?,0,?,?,?,0,'')").run(o.id, o.label || '', o.claim || '', JSON.stringify(o.issues || ['gastax']), o.n, o.n24, o.first, o.last || NOW - H, o.status, o.side || '', JSON.stringify(o.spread || ['news']), o.auto || '');
const place = (w, item, nid, ts, platform) => w.env.MIND_DB.db.prepare('INSERT OR REPLACE INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,?,?,0.9)').run(item, nid, ts, platform || 'news', platform || 'news');
await S.t('SG5 a narrative line: first seen, new or building, what its rows are made of, toward AEP; ten at 24 hours, fifteen at 168, emerging always in', async () => {
  const w = await mk(); await F(w, 'GET', '/narratives/status'); const T = w.mod.__test;
  const letter = 'I just signed the open letter for a gas export tax, add your name';
  // four accounts post the letter (a post's account is read from its address and only ever counted); one account posts its own guide three times
  await push(w, 'sig_thread', [1, 2, 3, 4].map(i => post({ body: letter, url: 'https://social.example.com.au/profile/did:plc:signer' + i + '/post/letter' + i, ts: NOW - (2 + i) * H })).concat([post({ body: 'Why a gas export tax would fund schools and hospitals.', url: 'https://social.example.com.au/profile/did:plc:writer/post/why', ts: NOW - 7 * H })],
    [1, 2, 3].map(i => post({ body: 'Read and share our compact guide to the gas export tax debate', url: 'https://social.example.com.au/profile/did:plc:guidebot/post/guide' + i, ts: NOW - (3 + i) * H }))));
  await push(w, 'news', [news({ title: 'Senate sets a date for the gas export tax vote', url: 'https://pointpost.example.com.au/vote', ts: NOW - 6 * H }), news({ src: 'tribune', title: 'Senate sets a date for the gas export tax vote - The Tribune', url: 'https://tribune.example.com.au/vote', ts: NOW - 5 * H, meta: { issues: ['gastax'], source: 'tribune' } }), news({ title: 'Gas export tax first floated in the Senate', url: 'https://pointpost.example.com.au/vote-old', ts: NOW - 30 * H })]);
  narr(w, { id: 'ntempl', label: 'Open letter for a gas export tax', claim: 'Australia should tax its gas exports', n: 5, n24: 5, first: NOW - 7 * H, status: 'emerging', side: 'hostile', spread: ['bluesky'] });
  ['signer1/post/letter1', 'signer2/post/letter2', 'signer3/post/letter3', 'signer4/post/letter4', 'writer/post/why'].forEach((k, i) => place(w, itemBy(w, 'https://social.example.com.au/profile/did:plc:' + k), 'ntempl', NOW - (3 + i) * H, 'bluesky'));
  narr(w, { id: 'nguide', label: 'A compact guide to the gas export tax debate', claim: 'Readers should share the guide', n: 3, n24: 3, first: NOW - 6 * H, status: 'new', spread: ['bluesky'] });
  [1, 2, 3].forEach(i => place(w, itemBy(w, 'https://social.example.com.au/profile/did:plc:guidebot/post/guide' + i), 'nguide', NOW - (3 + i) * H, 'bluesky'));
  narr(w, { id: 'nstory', auto: 'Senate sets a date for the gas export tax vote', n: 3, n24: 2, first: NOW - 30 * H, status: 'new', spread: ['news'] });
  place(w, itemBy(w, 'https://pointpost.example.com.au/vote'), 'nstory', NOW - 6 * H); place(w, itemBy(w, 'https://tribune.example.com.au/vote'), 'nstory', NOW - 5 * H); place(w, itemBy(w, 'https://pointpost.example.com.au/vote-old'), 'nstory', NOW - 30 * H);
  narr(w, { id: 'nwords', auto: 'Gas taxation: levy, giants, profits', n: 2, n24: 1, first: NOW - 40 * H, status: 'fading', spread: ['news', 'bluesky'] });
  const evOf = async (desk, hours) => { const d = await T.deskGet(w.env, desk); const b = await T.denBoard(w.env, d, { hours, keepRows: true }); const m = await T.denMissed(w.env, d, { board: b, to: b.window.to }); return (await T.denEvidence(w.env, d, b, m, [], { memory: false })).text; };
  const ev = await evOf('aep_au', 24); const t = lineOf(ev, 'N:ntempl'), s = lineOf(ev, 'N:nstory'), x = lineOf(ev, 'N:nwords');
  const DAY = /first seen \d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December), /;
  ok(new RegExp(DAY.source + 'new in this window \\| 5 posts, stories and comments in all, 5 in the last day \\| in this window: 5 posts \\(2 distinct texts\\); most of its posts are one templated text from many accounts \\(4 of 5\\) \\| toward AEP: hostile \\| taken up on: Bluesky$').test(t) && /^\[N:ntempl\] "Open letter for a gas export tax" \| claim: Australia should tax its gas exports \| /.test(t), 'a templated push from many accounts says so: ' + t);
  ok(/^\[N:nstory\] "Senate sets a date for the gas export tax vote" \| working title, not yet reviewed: taken from one of its headlines \| no claim written yet \| /.test(s) && new RegExp(DAY.source + 'building \\| 3 posts, stories and comments in all, 2 in the last day \\| in this window: 2 stories, one story and its syndicated copies \\| toward AEP: not yet assessed \\| taken up on: News$').test(s), 'one story and its copy is not a groundswell: ' + s);
  ok(/working title, not yet reviewed: built from words its posts and stories share/.test(x) && /, fading \|/.test(x) && /taken up on: News, then Bluesky$/.test(x), 'a title built from shared words says so: ' + x);
  ok(/ \| in this window: 3 posts \(1 distinct text\); most of its posts are one text posted again and again by one account \(3 of 3\) \| /.test(lineOf(ev, 'N:nguide')), 'one account repeating its own guide is not many accounts: ' + lineOf(ev, 'N:nguide'));
  ok(!/toward the client|\brows?\b/.test(block(ev, 'KEY NARRATIVES').join('\n')), 'written for a reader');
  // the cap: twelve steady narratives that outrank the emerging one
  for (let i = 0; i < 12; i++) narr(w, { id: 'nfill' + i, label: 'A steady narrative on the gas export tax, number ' + i, claim: 'Claim ' + i, n: 40 + i, n24: 20 + i, first: NOW - 10 * D, status: 'steady' });
  w.env.MIND_DB.db.prepare("UPDATE narratives SET n24=0 WHERE id='ntempl'").run();
  const day = block(await evOf('aep_au', 24), 'KEY NARRATIVES'), week = block(await evOf('aep_au', 168), 'KEY NARRATIVES');
  eq([day.length - 1, day.some(l => /^\[N:ntempl\]/.test(l)), /^KEY NARRATIVES \(10 shown of 16 on this desk's issues/.test(day[0])], [10, true, true], 'ten at 24 hours, the emerging one among them though it ranks last: ' + day[0]);
  eq([week.length - 1, week.some(l => /^\[N:ntempl\]/.test(l)), /^KEY NARRATIVES \(15 shown of 16 on this desk's issues/.test(week[0])], [15, true, true], 'fifteen at 168 hours: ' + week[0]);
});

await S.t('SG6 the window before: each issue in this window and the one before it, counted the same way, bounded', async () => {
  const w = await mk(); const T = w.mod.__test;
  await push(w, 'news', [news({ url: 'https://pointpost.example.com.au/now1', ts: NOW - 2 * H }), news({ url: 'https://pointpost.example.com.au/now2', ts: NOW - 5 * H }), news({ url: 'https://pointpost.example.com.au/prev1', ts: NOW - 30 * H }),
    news({ url: 'https://pointpost.example.com.au/old', ts: NOW - 50 * H }), news({ url: 'https://pointpost.example.com.au/week-before', ts: NOW - 8 * D }),
    news({ title: 'Energy ministers meet on power bills', url: 'https://pointpost.example.com.au/term', ts: NOW - 3 * H, meta: { issues: ['energy'], source: 'pointpost', term: 'gastax' } })]);
  await push(w, 'sig_thread', [post({ url: 'https://social.example.com.au/now3', ts: NOW - 4 * H }), post({ url: 'https://social.example.com.au/prev2', ts: NOW - 40 * H })]);
  await push(w, 'sig_comment', [{ src: 'bluesky', body: 'A comment on the gas export tax.', url: 'x:cmt:sg6', ts: NOW - 2 * H, meta: { platform: 'bluesky', issues: ['gastax'], thread: 'b1' } }]);
  const db = w.env.MIND_DB; const orig = db.prepare.bind(db); const seen = []; db.prepare = sql => { seen.push(String(sql)); return orig(sql); };
  const evOf = async (desk, hours) => { const d = await T.deskGet(w.env, desk); const b = await T.denBoard(w.env, d, { hours, keepRows: true }); return (await T.denEvidence(w.env, d, b, null, [], { memory: false })).text; };
  const day = await evOf('aep_au', 24);
  eq(lineOf(day, 'C:gastax'), '[C:gastax] Gas taxation: 3 posts and stories in this window, 2 in the day before', 'a comment is not a post or a story, and a row whose search term only contains the tag is not tagged');
  eq(lineOf(day, 'C:energy'), '[C:energy] Energy and climate policy: 1 post or story in this window, 0 in the day before', 'every issue with a count');
  ok(!lineOf(day, 'C:electrify') && /^THE WINDOW BEFORE \(/m.test(day), 'an issue with nothing in either window is left out');
  eq(lineOf(await evOf('aep_au', 168), 'C:gastax'), '[C:gastax] Gas taxation: 6 posts and stories in this window, 1 in the week before', 'a week against the week before');
  // p71 review (EV2): the count is the board's, so a state desk counts its own region's posts and stories (none of these is
  // Victorian) and needs no national note; before, it counted the nation's and said so
  const vic = await evOf('aep_vic', 24); ok(!lineOf(vic, 'C:gastax') && !/^\[C:[^\n]*counted across Australia/m.test(vic), 'a state desk counts its own region, as its board does: ' + lineOf(vic, 'C:gastax'));
  const reads = seen.filter(q => /^SELECT id, kind, src, url, title, substr\(body,1,600\) body/.test(q)); ok(reads.length && reads.every(q => /LIMIT 4000$/.test(q) && /kind IN \(/.test(q) && /ts>\? AND ts<=\?/.test(q)), 'each count is bounded: the board\'s own read, its kinds, its window and its cap: ' + (reads[0] || '').slice(0, 200));
  ok(seen.some(q => /FROM den_marks d JOIN arc_items a/.test(q)), 'and the window before reads its set-asides');
});

await S.t('SG7 a memory line carries its title and source; no line of this lane says rows, held, judged or the client', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); await F(w, 'GET', '/narratives/status'); await F(w, 'GET', '/sentinel/alerts');
  w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: o && o.namespace === 'aep' ? [{ score: 0.9, metadata: { title: 'Gas tax campaign playbook', source: 'Agency notes: gas campaigns 2025', kind: 'doc', snippet: 'Campaigns on a gas export tax peak in budget week and fade after the vote.' } }] : [] });
  await burstWorld(w); entity(w, 'harbourco', 'Harbour Gas Company');
  const acct = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'bluesky', value: 'harbourwatch.example.com.au', name: 'Harbour Watch', actor_kind: 'org' })).body.watch;
  await push(w, 'sig_thread', [post({ body: 'Our statement on the gas export tax.', url: 'https://social.example.com.au/actor', meta: { platform: 'bluesky', issues: ['gastax'], id: 'act1', watch: acct.id, actor: { id: acct.id, name: 'Harbour Watch', kind: 'org' }, eng: { likes: 30 }, score: 30 } })]);
  const n1 = itemBy(w, 'https://pointpost.example.com.au/burst1'); names(w, n1, 'harbourco');
  w.env.MIND_DB.db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,detected_ts) VALUES('aep','AEP','gastax','Gas taxation','high',9,2.9,3.1,5,?)").run(NOW - 2 * H);
  narr(w, { id: 'nsg7', label: 'Gas giants should pay their share', claim: '', n: 4, n24: 3, first: NOW - 20 * H, status: 'emerging', side: '', spread: ['news', 'bluesky'] }); place(w, n1, 'nsg7', NOW - 2 * H);
  const calls = model(w); const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const ev = calls[0].messages[0].content;
  eq(lineOf(ev, 'K:1'), '[K:1] Gas tax campaign playbook | from Agency notes: gas campaigns 2025 | Campaigns on a gas export tax peak in budget week and fade after the vote.', 'the model reads what the memory says and where it came from');
  const k = br.evidence['K:1']; eq([k.label, /^Gas tax campaign playbook: Campaigns on a gas export tax/.test(k.text), /from Agency notes: gas campaigns 2025/.test(k.sub)], ['Gas tax campaign playbook', true, true], 'and a reviewer can read it back: ' + JSON.stringify(k));
  const mine = [(ev.match(/^CHANNELS READ[^\n]*/m) || [''])[0]].concat(block(ev, 'SIGNALS NOT TO MISS'), block(ev, 'KEY NARRATIVES'), (ev.match(/^INFLUENCER AND POLITICAL[^\n]*/m) || [''])[0], block(ev, 'TONE BY ISSUE'), block(ev, 'THE WINDOW BEFORE'), block(ev, 'BACKGROUND FROM THE AGENCY'));
  ok(mine.every(Boolean) && block(ev, 'SIGNALS NOT TO MISS').length >= 4 && block(ev, 'TONE BY ISSUE').length >= 2 && block(ev, 'THE WINDOW BEFORE').length >= 2, 'every block of this lane is there to be read: ' + mine.map(l => l.slice(0, 40)).join(' // '));
  const bad = mine.filter(l => /\brows?\b|\bheld\b|\bjudged\b|the client/i.test(l)); eq(bad, [], 'written for a reader');
});

// ---- the review of build p71 (SG8 on fail on df42fb8, the integration before the review's fixes) ----

await S.t('SG8 a window that closed before now counts only its own rows for a burst, and never reads or writes the live strip\'s cache (ST1)', async () => {
  const w = await mk(); const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const T0 = NOW - D;
  // one gas-tax story a day for a fortnight before a window that closed a day ago, two stories in that window, thirty filed since
  await push(w, 'news', Array.from({ length: 13 }, (_, i) => news({ title: 'Gas export tax baseline story ' + (i + 1), url: 'https://pointpost.example.com.au/base' + i, ts: T0 - (i + 1.5) * D })));
  await push(w, 'news', [news({ title: 'Gas export tax story in the closed window, the first', url: 'https://pointpost.example.com.au/in1', ts: T0 - 3 * H }), news({ title: 'Gas export tax story in the closed window, the second', url: 'https://pointpost.example.com.au/in2', ts: T0 - 6 * H })]);
  await push(w, 'news', Array.from({ length: 30 }, (_, i) => news({ title: 'Gas export tax story filed after the window closed, ' + (i + 1), url: 'https://pointpost.example.com.au/late' + i, ts: NOW - (0.2 + i * 0.25) * H })));
  const ov = (await T.overviewIssues(w.env, T0, 24)).find(i => i.id === 'gastax'); eq([ov.recent, ov.n14], [2, 15], 'the count stops at the window\'s end');
  const past = await T.denBoard(w.env, desk, { to: T0, keepRows: true }); const m1 = await T.denMissed(w.env, desk, { board: past, to: T0 });
  ok(!m1.signals.some(s => s.key === 'I:gastax'), 'two stories against one a day is no burst: ' + JSON.stringify(m1.signals.filter(s => s.sig === 'burst').map(s => s.detail)));
  ok(!lineOf((await T.denEvidence(w.env, desk, past, m1, [], { memory: false })).text, 'I:gastax'), 'and the evidence holds no burst line');
  // the live strip counts the thirty as a burst and caches it
  const live = (await F(w, 'GET', '/den/missed?desk=aep_au')).body; ok(live.signals.some(s => s.key === 'I:gastax'), 'the live window holds the thirty: a burst');
  const key = 'den_slow2_aep_au_24'; const entry = w.kv.get(key); ok(entry, 'cached for the live strip');
  // a brief of today whose window closed earlier (a section written again, a filing) passes no end of its own: denPastTo gives none today
  const early = await T.denBoard(w.env, desk, { to: NOW - 10 * H, keepRows: true }); const m2 = await T.denMissed(w.env, desk, { board: early });
  ok(!m2.signals.some(s => s.key === 'I:gastax') && !m2.slow.cached, 'it counts its own window, not the live strip\'s burst: ' + JSON.stringify(m2.signals.filter(s => s.sig === 'burst').map(s => s.detail)));
  eq(w.kv.get(key), entry, 'and leaves the live entry as it was');
  w.kv.delete(key); await T.denMissed(w.env, desk, { board: early }); ok(!w.kv.has(key), 'a window that closed earlier writes no live entry');
  const again = (await F(w, 'GET', '/den/missed?desk=aep_au')).body; ok(again.signals.some(s => s.key === 'I:gastax') && !again.slow.cached, 'so the live strip counts its own burst');
});

await S.t('SG9 an issue tagged as it is now for less than the fortnight is not compared: no false burst or rise, and the evidence says why (CO1)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const mca = o => news(Object.assign({ src: 'minewire', body: 'The Minerals Council of Australia said royalties must stay as they are.' }, o));
  // six stories naming the council in the window, tagged as p71 tags them; the same in the day before and through the fortnight, tagged as p70 did (mining alone)
  await push(w, 'news', [1, 2, 3, 4, 5, 6].map(i => mca({ title: 'Minerals Council of Australia on royalties, story ' + i, url: 'https://minewire.example.com.au/now' + i, ts: NOW - i * H, meta: { issues: ['mining', 'mcamentions'], source: 'minewire' } }))
    .concat([1, 2, 3, 4, 5, 6].map(i => mca({ title: 'Minerals Council of Australia on royalties, earlier story ' + i, url: 'https://minewire.example.com.au/prev' + i, ts: NOW - (24 + i) * H, meta: { issues: ['mining'], source: 'minewire' } })),
      Array.from({ length: 12 }, (_, i) => mca({ title: 'Minerals Council of Australia on royalties, old story ' + i, url: 'https://minewire.example.com.au/old' + i, ts: NOW - (2.5 + i) * D, meta: { issues: ['mining'], source: 'minewire' } }))));
  // fuel tax credits, whose tags p71 left alone: a real burst (five in the window, one in the fortnight)
  await push(w, 'news', [1, 2, 3, 4, 5].map(i => news({ src: 'minewire', title: 'Fuel tax credit cut floated again, report ' + i, body: 'The fuel tax credit scheme is under review.', url: 'https://minewire.example.com.au/ftc' + i, ts: NOW - (i + 0.5) * H, meta: { issues: ['ftc'], source: 'minewire' } }))
    .concat([news({ src: 'minewire', title: 'Fuel tax credit review opens', body: 'The fuel tax credit scheme is under review.', url: 'https://minewire.example.com.au/ftc-old', ts: NOW - 6 * D, meta: { issues: ['ftc'], source: 'minewire' } })]));
  const d = await T.deskGet(w.env, 'mca_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); const m = await T.denMissed(w.env, d, { board: b, fresh: true });
  ok(!m.signals.some(s => s.key === 'I:mcamentions' || s.key === 'I:mining'), 'no burst from new tags against old: ' + JSON.stringify(m.signals.filter(s => s.sig === 'burst').map(s => s.key)));
  ok(m.signals.some(s => s.key === 'I:ftc'), 'an issue whose tags p71 left alone is still checked: ' + JSON.stringify(m.signals.map(s => s.key)));
  eq((m.newTags || []).map(t => t.id).sort(), ['mcamentions', 'mining'], 'the issues it does not compare, each with posts or stories in the window');
  const rec = JSON.parse(w.kv.get('den_tagsince') || '{}'); const by = rec.by || {};
  ok(['mcamentions', 'mining', 'cm'].every(k => by[k] && by[k].at > NOW - H) && by.ftc.at === 0 && by.gas.at === 0 && by.gastax.at === 0, 'a record begun now: what p71 added or re-tagged from now, every other issue (gas\'s tags included) with its full history: ' + JSON.stringify(by));
  const ev = (await T.denEvidence(w.env, d, b, m, [], { memory: false })).text; const sig = block(ev, 'SIGNALS NOT TO MISS'); const SINCE = 'this issue has been tagged as it is now only since \\d{1,2} [a-z]{3} \\d\\d:\\d\\d';
  ok(sig.some(l => new RegExp('^- MCA mentions is not set against its usual volume: the fortnight before was not counted the same way \\(' + SINCE + '\\)\\.$').test(l)), 'the burst check says it does not compare it: ' + sig.join(' // '));
  ok(new RegExp('^\\[C:mcamentions\\] MCA mentions: 6 posts and stories in this window; the day before was not counted the same way \\(' + SINCE + '\\), so the two are not compared$').test(lineOf(ev, 'C:mcamentions')), 'no false rise against the day before: ' + lineOf(ev, 'C:mcamentions'));
  ok(/^\[C:mining\] Mining and resources: 6 posts and stories in this window; the day before was not counted the same way/.test(lineOf(ev, 'C:mining')), 'nor a false fall for a narrowed matcher: ' + lineOf(ev, 'C:mining'));
  eq(lineOf(ev, 'C:ftc'), '[C:ftc] Fuel tax credits: 5 posts and stories in this window, 0 in the day before', 'an unchanged issue is compared as before');
  const at1 = by.mcamentions.at; await T.denMissed(w.env, d, { board: b, fresh: true }); eq(JSON.parse(w.kv.get('den_tagsince')).by.mcamentions.at, at1, 'written once: a later run keeps when it began');
  // a fortnight on (every row by then carries the present tags), the comparisons stand again
  const r2 = JSON.parse(w.kv.get('den_tagsince')); ['mcamentions', 'mining', 'cm'].forEach(k => { r2.by[k].at = NOW - 15 * D; }); w.kv.set('den_tagsince', JSON.stringify(r2));
  w.env.MIND_DB.db.prepare("UPDATE arc_items SET meta=json_set(meta,'$.issues',json(?)) WHERE url LIKE 'https://minewire.example.com.au/prev%' OR url LIKE 'https://minewire.example.com.au/old%'").run(JSON.stringify(['mining', 'mcamentions']));
  const m3 = await T.denMissed(w.env, d, { board: b, fresh: true }); const e3 = (await T.denEvidence(w.env, d, b, m3, [], { memory: false })).text;
  eq(m3.newTags, [], 'every issue is compared'); eq(lineOf(e3, 'C:mcamentions'), '[C:mcamentions] MCA mentions: 6 posts and stories in this window, 6 in the day before', 'like for like');
  // the next issue added, or one whose matcher or search terms move, is covered too
  const r4 = JSON.parse(w.kv.get('den_tagsince')); delete r4.by.ftc; r4.by.gas.v = 'an older matcher'; w.kv.set('den_tagsince', JSON.stringify(r4));
  const since = await T.denTagSince(w.env); ok(since.ftc > NOW - H && since.gas > NOW - H && since.gastax === 0, 'an issue new to the record and a changed one from now, an unchanged one keeps its history: ' + JSON.stringify(since));
  const m4 = await T.denMissed(w.env, d, { board: b, fresh: true }); ok(!m4.signals.some(s => s.key === 'I:ftc') && m4.newTags.some(t => t.id === 'ftc'), 'and the burst check waits for it: ' + JSON.stringify(m4.signals.map(s => s.key)));
});

await S.t('SG10 the window before is counted as the Board counts: mutes, set-asides, minimum engagement and region, in both windows (EV2)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const st = (slug, ts, o) => news(Object.assign({ title: 'Gas export tax story ' + slug, url: 'https://pointpost.example.com.au/' + slug, ts }, o));
  const deal = (slug, ts) => news({ src: 'dealsbin', title: 'Gas export tax deal alert ' + slug, url: 'https://dealsbin.example.com.au/' + slug, ts, meta: { issues: ['gastax'], source: 'dealsbin' } });
  await push(w, 'news', [1, 2, 3, 4, 5].map(i => st('now' + i, NOW - i * H)).concat([1, 2, 3, 4, 5].map(i => st('prev' + i, NOW - (24 + i) * H)), [1, 2, 3, 4, 5, 6].map(i => deal('now' + i, NOW - (i + 0.5) * H)), [1, 2, 3].map(i => deal('prev' + i, NOW - (24.5 + i) * H))));
  const bp = (slug, ts, likes) => post({ url: 'https://social.example.com.au/' + slug, ts, meta: { platform: 'bluesky', issues: ['gastax'], id: slug, eng: { likes }, score: likes } });
  await push(w, 'sig_thread', [bp('loud', NOW - 2 * H, 20), bp('quiet1', NOW - 3 * H, 2), bp('quiet2', NOW - 27 * H, 2)]);
  eq((await F(w, 'POST', '/den/mute', { desk: 'aep_au', kind: 'domain', value: 'dealsbin.example.com.au' })).status, 200, 'the site is muted');
  for (const slug of ['now1', 'prev1', 'prev2']) eq((await F(w, 'POST', '/den/aside', { desk: 'aep_au', item: itemBy(w, 'https://pointpost.example.com.au/' + slug), reason: 'duplicate' })).status, 200, 'set aside');
  w.env.MIND_DB.db.prepare("UPDATE den_desks SET options=json_set(options,'$.minEng',json(?)) WHERE id='aep_au'").run(JSON.stringify({ bluesky: 10 }));
  const evOf = async desk => { const d = await T.deskGet(w.env, desk); const b = await T.denBoard(w.env, d, { keepRows: true }); return { b, ev: (await T.denEvidence(w.env, d, b, null, [], { memory: false })).text }; };
  const { b, ev } = await evOf('aep_au');
  eq([b.counts.rows, b.counts.muted, b.counts.aside, b.counts.underMinimum], [5, 6, 1, 1], 'the Board: four stories and the post that cleared the minimum');
  eq(lineOf(ev, 'C:gastax'), '[C:gastax] Gas taxation: 5 posts and stories in this window, 3 in the day before', 'the window before counts what the Board would: ' + lineOf(ev, 'C:gastax'));
  ok(/^CHANNELS READ IN THIS WINDOW: News \(4 stories\), Bluesky \(1 post\)/m.test(ev) && /^THE WINDOW BEFORE \([^\n]*without what this desk has muted or set aside\)$/m.test(ev), 'and agrees with the channels line, saying what it leaves out');
  // a state desk: its own region's posts and stories in both windows
  await push(w, 'news', [st('vic-now', NOW - 4 * H, { title: 'Melbourne rally backs a gas export tax', body: 'Victorians rallied in Melbourne for a gas export tax.' }), st('vic-prev', NOW - 30 * H, { title: 'Victorian crossbench weighs a gas export tax', body: 'The Victorian crossbench met in Melbourne on the gas export tax.' })]);
  const vic = await evOf('aep_vic'); eq(lineOf(vic.ev, 'C:gastax'), '[C:gastax] Gas taxation: 1 post or story in this window, 1 in the day before', 'a state desk counts its own region: ' + lineOf(vic.ev, 'C:gastax'));
  ok(/^THE WINDOW BEFORE \(this region's posts and stories/m.test(vic.ev), 'and says so');
});

await S.t('SG11 a check and a tone count resting on a later post of a templated action point at that action\'s line (EV4, ST6)', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const T = w.mod.__test;
  const text = 'I just signed the open letter asking the minister to put a gas export tax to the vote this week';
  const url = i => 'https://social.example.com.au/profile/did:plc:signer' + i + '/post/l' + i;
  await push(w, 'sig_thread', [0, 1, 2].map(i => post({ body: text, url: url(i), ts: NOW - (5 - i) * H }))); const pid = [0, 1, 2].map(i => itemBy(w, url(i)));
  entity(w, 'quaywatch', 'Quay Watch Alliance'); judge(w, pid[2], -0.6, ['gastax'], 'sig_thread', NOW - 3 * H); names(w, pid[2], 'quaywatch', NOW - 3 * H);   // named, and judged, in the third post only
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); const m = await T.denMissed(w.env, d, { board: b, fresh: true });
  const e = m.signals.find(s => s.key === 'E:quaywatch'); ok(e && e.cover.indexOf('S:' + pid[2]) >= 0, 'the check rests on the third post: ' + JSON.stringify(e && e.cover));
  const ev = (await T.denEvidence(w.env, d, b, m, [], { memory: false })).text;
  ok(/ \| 3 near-identical posts/.test(lineOf(ev, 'S:' + pid[0])) && !lineOf(ev, 'S:' + pid[2]), 'the three are one line under the first post: ' + lineOf(ev, 'S:' + pid[0]).slice(0, 120));
  ok(block(ev, 'SIGNALS NOT TO MISS').indexOf('- Quay Watch Alliance is named on these issues for the first time in fourteen days ([S:' + pid[0] + ']).') > 0, 'the check points at the line its post rides on: ' + block(ev, 'SIGNALS NOT TO MISS').join(' // '));
  ok(/\. Negative: \[S:\d+\]$/.test(lineOf(ev, 'T:gastax')) && lineOf(ev, 'T:gastax').indexOf('Negative: [S:' + pid[0] + ']') >= 0, 'and so does the tone count resting on it: ' + lineOf(ev, 'T:gastax'));
});

await S.t('SG12 a spike on a region desk says it is counted across Australia (EV6)', async () => {
  const w = await mk(); const T = w.mod.__test; await F(w, 'GET', '/sentinel/alerts');
  await push(w, 'news', [news({ title: 'Melbourne crossbench backs a gas export tax', body: 'Victorian MPs met in Melbourne on a gas export tax.', url: 'https://pointpost.example.com.au/vic-spike' })]);
  w.env.MIND_DB.db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,detected_ts) VALUES('aep','AEP','gastax','Gas taxation','high',12,2.9,4.1,5,?)").run(NOW - 2 * H);
  const run = async desk => { const d = await T.deskGet(w.env, desk); const b = await T.denBoard(w.env, d, { keepRows: true }); const m = await T.denMissed(w.env, d, { board: b, fresh: true }); return { m, e: await T.denEvidence(w.env, d, b, m, [], { memory: false }) }; };
  const vic = await run('aep_vic'), nat = await run('aep_au'); const s = vic.m.signals.find(x => x.sig === 'spike'); ok(s, 'the spike is on the state desk\'s strip');
  eq(lineOf(vic.e.text, s.key), '[' + s.key + '] A spike in news on Gas taxation: 12 stories in six hours, 4.1 times its usual volume for six hours, counted across Australia, not this region alone', 'the state desk is told the spike is national');
  ok(/counted across Australia/.test(vic.e.ids.get(s.key).sub) && /counted across Australia/.test(s.detail), 'so are its card and the strip: ' + vic.e.ids.get(s.key).sub);
  eq(lineOf(nat.e.text, s.key), '[' + s.key + '] A spike in news on Gas taxation: 12 stories in six hours, 4.1 times its usual volume for six hours', 'a national desk needs no note');
});

await S.t('SG13 a busy database in the tone, window-before or narratives read is said, never an evidence text without them (EV7)', async () => {
  const w = await mk(); await F(w, 'GET', '/narratives/status'); const T = w.mod.__test; await burstWorld(w);
  narr(w, { id: 'nbusy', label: 'Gas giants should pay their share', claim: 'Tax the gas giants', n: 3, n24: 3, first: NOW - 20 * H, status: 'steady' }); place(w, itemBy(w, 'https://pointpost.example.com.au/burst1'), 'nbusy', NOW - 2 * H);
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); const m = await T.denMissed(w.env, d, { board: b, fresh: true });
  const whole = (await T.denEvidence(w.env, d, b, m, [], { memory: false })).text; ok(/^TONE BY ISSUE/m.test(whole) && /^THE WINDOW BEFORE/m.test(whole) && / \| in this window: /.test(lineOf(whole, 'N:nbusy')), 'the three are there while the database answers');
  const db = w.env.MIND_DB; const orig = db.prepare.bind(db);
  for (const [what, rx] of [['tone', /FROM sent_items WHERE ts>\? AND ts<=\?/], ['window-before', /^SELECT id, kind, src, url, title, substr\(body,1,600\) body/], ['narratives', /FROM narrative_items ni JOIN arc_items a/]]) {
    db.prepare = sql => { if (rx.test(String(sql))) throw new Error('D1_ERROR: D1 DB is overloaded. Too many requests queued.'); return orig(sql); };
    let err = null; try { await T.denEvidence(w.env, d, b, m, [], { memory: false }); } catch (e) { err = e; } db.prepare = orig;
    ok(err && /overloaded/.test(String(err.message)), 'a busy ' + what + ' read is said, before any model call: ' + (err ? err.message : 'the evidence was built without it'));
  }
});

await S.t('SG14 judged comments never push a week\'s older stories out of the tone line (EV8)', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const T = w.mod.__test;
  const titles = ['Senate debates a gas export tax', 'Crossbench presses for a gas export tax', 'Unions weigh in on a gas export tax', 'Producers warn about a gas export tax', 'Treasurer rules out a gas export tax'];
  await push(w, 'news', titles.map((t, i) => news({ title: t, url: 'https://pointpost.example.com.au/early' + i, ts: NOW - (101 + i) * H })));
  titles.forEach((t, i) => judge(w, itemBy(w, 'https://pointpost.example.com.au/early' + i), -0.3, ['gastax'], 'news', NOW - (101 + i) * H));
  // three thousand judged comments on one thread over the last two days; the board holds no comments
  const db = w.env.MIND_DB.db; const ins = db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)');
  db.exec('BEGIN'); for (let i = 0; i < 3000; i++) ins.run(9000000 + i, 'sig_comment', 'bluesky', 'bluesky', NOW - (1 + i * 0.015) * H, 0.4, JSON.stringify(['gastax']), 'claude'); db.exec('COMMIT');
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { hours: 168, keepRows: true }); const line = lineOf((await T.denEvidence(w.env, d, b, null, [], { memory: false })).text, 'T:gastax');
  ok(/^\[T:gastax\] Gas taxation: mostly negative, across 5 stories with a tone reading [^:]*: 5 negative, 0 positive, 0 neutral\./.test(line), 'the week\'s stories are counted, whatever the comments: ' + line);
});

await S.t('SG15 a narrative\'s comments are counted apart, and identical short texts are not a templated push (EV9)', async () => {
  const w = await mk(); await F(w, 'GET', '/narratives/status'); const T = w.mod.__test;
  await push(w, 'news', [news({ title: 'Senate opens its inquiry into a gas export tax', url: 'https://pointpost.example.com.au/inq' }), news({ title: 'Producers make their case against a gas export tax', url: 'https://pointpost.example.com.au/case' })]);
  await push(w, 'sig_comment', ['Agreed, tax the gas exporters now', 'Agreed, tax the gas exporters now', 'Agreed, tax the gas exporters now', 'Agreed, tax the gas exporters now', 'The export tax would fund the schools', 'Not sure the tax survives the Senate']
    .map((body, i) => ({ src: 'bluesky', body, url: 'x:sigc:thread' + i, ts: NOW - (2 + i * 0.5) * H, meta: { platform: 'bluesky', issues: ['gastax'], thread: 'bthread' } })));
  await push(w, 'sig_thread', [1, 2, 3, 4].map(i => post({ body: 'Tax the gas now, please!', url: 'https://social.example.com.au/profile/did:plc:short' + i + '/post/s' + i, ts: NOW - (3 + i) * H })).concat([post({ body: 'A long explainer on how a gas export tax would be collected and spent', url: 'https://social.example.com.au/profile/did:plc:explainer/post/e1', ts: NOW - 8 * H })]));
  narr(w, { id: 'nthread', label: 'Tax the gas exporters', claim: 'Exporters should pay more tax', n: 8, n24: 8, first: NOW - 10 * H, status: 'steady', side: 'hostile', spread: ['news', 'bluesky'] });
  ['https://pointpost.example.com.au/inq', 'https://pointpost.example.com.au/case'].concat([0, 1, 2, 3, 4, 5].map(i => 'x:sigc:thread' + i)).forEach((u, i) => place(w, itemBy(w, u), 'nthread', NOW - (2 + i * 0.5) * H, /^x:/.test(u) ? 'bluesky' : 'news'));
  narr(w, { id: 'nshort', label: 'Tax the gas now', claim: 'The gas should be taxed now', n: 5, n24: 5, first: NOW - 9 * H, status: 'steady', side: 'hostile', spread: ['bluesky'] });
  [1, 2, 3, 4].map(i => 'https://social.example.com.au/profile/did:plc:short' + i + '/post/s' + i).concat(['https://social.example.com.au/profile/did:plc:explainer/post/e1']).forEach((u, i) => place(w, itemBy(w, u), 'nshort', NOW - (3 + i) * H, 'bluesky'));
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); const ev = (await T.denEvidence(w.env, d, b, null, [], { memory: false })).text;
  const th = lineOf(ev, 'N:nthread'), sh = lineOf(ev, 'N:nshort');
  ok(/ \| 8 posts, stories and comments in all, 8 in the last day \| in this window: 2 stories and 6 comments \| toward AEP: hostile \| /.test(th) && !/templated|\bposts\b \(/.test(th), 'a live thread under two stories is comments, not a templated push of posts: ' + th);
  ok(/ \| in this window: 5 posts \(2 distinct texts\) \| toward AEP: hostile \| /.test(sh), 'four identical short posts are not called templated: ' + sh);
  ok(/that gained posts, stories or comments in the window\)$/m.test(ev), 'and the block says what its narratives gained');
});

await S.t('SG16 a story its outlet labels Special Report is left out of the tone counts, and the line says so (ST7)', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const T = w.mod.__test;
  await push(w, 'news', [news({ src: 'stockpick', title: 'Gas producer forecasts strong returns under the new regime', body: 'Returns are forecast in the study. Special Report: The producer paid for this report on the gas export tax.', url: 'https://stockpick.example.com.au/sr', ts: NOW - 4 * H, meta: { issues: ['gastax'], source: 'stockpick' } }),
    news({ title: 'Crossbench warns the gas export tax will hit jobs', url: 'https://pointpost.example.com.au/jobs', ts: NOW - 3 * H })]);
  const sr = itemBy(w, 'https://stockpick.example.com.au/sr'), jobs = itemBy(w, 'https://pointpost.example.com.au/jobs'); judge(w, sr, 0.6); judge(w, jobs, -0.3);
  (T.DEN_SPONSORED_HOSTS || []).push('stockpick.example.com.au');   // p71 review (ST4, D4): an invented outlet whose "Special Report" marks a piece made with the company
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); ok((b.media.find(x => x.id === sr) || {}).special, 'the Board labels it');
  const e = await T.denEvidence(w.env, d, b, null, [], { memory: false }); const line = lineOf(e.text, 'T:gastax');
  eq(line, '[T:gastax] Gas taxation: mostly negative, across 1 story with a tone reading (syndicated copies and repeated posts counted once; 1 story labelled \'Special Report\' by its outlet is left out): 1 negative, 0 positive, 0 neutral. Negative: [M:' + jobs + ']', 'the company\'s own piece is not press tone');
  ok(/; 1 Special Report left out$/.test(e.ids.get('T:gastax').sub), 'and the card says so: ' + e.ids.get('T:gastax').sub);
});

await S.t('SG17 an outlier\'s figures are a citable line: a sentence stating them is verified, and covers the check (ST8)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const acct = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'bluesky', value: 'harbourwatch.example.com.au', name: 'Harbour Watch', actor_kind: 'org' })).body.watch;
  const own = (i, ts, eng, score) => post({ body: 'Our view on the gas export tax, note ' + i + '.', url: 'https://social.example.com.au/hw/' + i, ts, meta: { platform: 'bluesky', issues: ['gastax'], id: 'hw' + i, watch: acct.id, actor: { id: acct.id, name: 'Harbour Watch', kind: 'org' }, score, comments: 0, eng } });
  await push(w, 'sig_thread', [3, 6, 9, 12, 15].map(i => own(i, NOW - i * D, { likes: 12 }, 12)).concat([own(99, NOW - 2 * H, { likes: 200, reposts: 30, replies: 20 }, 200)])); const pid = itemBy(w, 'https://social.example.com.au/hw/99');
  const sig = (await F(w, 'GET', '/den/missed?desk=aep_au&fresh=1')).body.signals.find(s => s.sig === 'outlier'); ok(sig && sig.cover.indexOf('O:' + pid) >= 0, 'the check is covered by its own line: ' + JSON.stringify(sig && sig.cover));
  const said = 'A post by Harbour Watch drew 250 interactions, against a usual 12 for that account\'s posts [O:' + pid + '].';
  const calls = model(w, () => ({ sections: { summary: said + LONG, bottom: 'One organisation\'s post drew far more than its usual [O:' + pid + '].' }, ratings: {} }));
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const ev = calls[0].messages[0].content;
  eq(lineOf(ev, 'O:' + pid), '[O:' + pid + '] A post by Harbour Watch drew 250 interactions, against a usual 12 for that account\'s posts (the middle of its last 5) ([P:' + pid + '])', 'a citable line with its figures, pointing at the post');
  eq([br.sections.summary.cites, br.sections.summary.unverified], [['O:' + pid], []], 'cited, and both figures are on its line');
  const f = await F(w, 'POST', '/den/brief/file', { id: br.id, revision: br.revision }); eq([f.status, f.body.brief && f.body.brief.status], [200, 'filed'], 'stating it covers the check: ' + f.text.slice(0, 300));
});

// ---- the second review of build p71 (lane evidence) ----

await S.t('SG18 tone reads the Board\'s flag alone: a wire\'s own investigation headed "Special Report:" is press tone (D4)', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status'); const T = w.mod.__test;
  await push(w, 'news', [news({ src: 'coastwire', title: 'Special Report: Inside the fight over the gas export tax and who pays for it', body: 'An investigation into how the gas export tax was fought over in Canberra, drawing on documents and interviews.', url: 'https://coastwire.example.com.au/sr-inside', ts: NOW - 4 * H, meta: { issues: ['gastax'], source: 'coastwire' } }),
    news({ title: 'Crossbench warns the gas export tax will hit jobs', url: 'https://pointpost.example.com.au/jobs18', ts: NOW - 3 * H })]);
  const inv = itemBy(w, 'https://coastwire.example.com.au/sr-inside'), jobs = itemBy(w, 'https://pointpost.example.com.au/jobs18'); judge(w, inv, -0.6); judge(w, jobs, -0.3);
  const d = await T.deskGet(w.env, 'aep_au'); const b = await T.denBoard(w.env, d, { keepRows: true }); ok(!(b.media.find(x => x.id === inv) || {}).special, 'the Board does not label an outlet\'s own investigation');
  const e = await T.denEvidence(w.env, d, b, null, [], { memory: false }); const line = lineOf(e.text, 'T:gastax');
  ok(/: mostly negative, across 2 stories with a tone reading \(syndicated copies and repeated posts counted once\): 2 negative, 0 positive, 0 neutral\. Negative: \[M:\d+\] \[M:\d+\]$/.test(line) && line.indexOf('[M:' + inv + ']') > 0 && !/Special Report/.test(line), 'and the tone counts and cites it: ' + line);
  ok(!/Special Report/.test(e.ids.get('T:gastax').sub), 'as its card does: ' + e.ids.get('T:gastax').sub);
});

await S.t('SG19 the first record of when tagging began is seeded from p70\'s matchers; a desk\'s term leaves its issue compared (D5, F3)', async () => {
  // a later build re-tags gas taxation and adds an issue, and runs before any record was written (or after the record was lost)
  const w = await mk(); const T = w.mod.__test; const C = T.CLIENT_ISSUES; const gt = C.find(c => c.id === 'gastax'); gt.wide = new RegExp(gt.wide.source + '|harbour levy', 'i');
  C.push({ ns: 'aep', client: 'Australian Energy Producers', id: 'harbourlevy', label: 'Harbour levy', rx: /harbour levy/i, wide: /harbour (levy|toll)/i, q: ['harbour levy'] });
  const s1 = await T.denTagSince(w.env);
  ok(s1.gastax > NOW - H && s1.harbourlevy > NOW - H, 'an issue re-tagged or added after p70 is marked from now, whichever build brings it: ' + JSON.stringify(s1));
  ok(s1.mcamentions > NOW - H && s1.mining > NOW - H && s1.cm > NOW - H, 'and so are p71\'s own');
  ok(['ftc', 'gas', 'gasprojects', 'electrify', 'energy', 'firearms', 'col'].every(k => s1[k] === 0), 'an issue as p70 tagged it keeps its full history');
  // p71 fx3 (F3): the desk's approved terms tag rows too (issueTag reads them), but approving, switching off or re-filing one
  // does not mark its issue from now: that turned off its burst check, its Overview ratio and its window before for a
  // fortnight, while it moved. Whether a term change should restart the comparison is the owner's call
  const w2 = await mk(); const T2 = w2.mod.__test; const at = async () => { const s = await T2.denTagSince(w2.env); return [s.energy, s.gas]; };
  eq(await at(), [0, 0], 'energy and gas as p70 tagged them');
  const term = await F(w2, 'POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'harbour grid levy', issue: 'energy' }); eq([term.status, term.body.watch && term.body.watch.issue], [200, 'energy'], JSON.stringify(term.body).slice(0, 200));
  eq(await at(), [0, 0], 'an approved term leaves its issue compared');
  eq((await F(w2, 'POST', '/den/watch/decide', { id: term.body.watch.id, decision: 'off' })).status, 200); eq(await at(), [0, 0], 'and so does switching it off');
  eq((await F(w2, 'POST', '/den/watch/decide', { id: term.body.watch.id, decision: 'on', issue: 'gas' })).status, 200); eq(await at(), [0, 0], 'or filing it under another issue');
  // the desk's terms are not read here at all: not on every call, not in a busy spell, and the record stays as it is
  const rec = w2.kv.get('den_tagsince'); const db = w2.env.MIND_DB; const orig = db.prepare.bind(db); let reads = 0;
  db.prepare = sql => { if (/den_watch/.test(String(sql))) { reads++; throw new Error('D1_ERROR: D1 DB is overloaded. Too many requests queued.'); } return orig(sql); };
  const busy = []; try { for (let i = 0; i < 3; i++) busy.push(await at()); } finally { db.prepare = orig; }
  eq([reads, busy, w2.kv.get('den_tagsince') === rec], [0, [[0, 0], [0, 0], [0, 0]], true], 'no read of the desk\'s terms');
});

await S.t('SG20 the Overview sets no issue tagged as it is now for less than the fortnight against its usual (D5)', async () => {
  const w = await mk(); const T = w.mod.__test;
  // mining (its matcher narrowed by p71) and fuel tax credits (left alone): four stories in the day and thirteen in the fortnight before, each
  const st = (id, k, ts) => news({ src: 'minewire', title: (id === 'ftc' ? 'Fuel tax credit' : 'Iron ore royalties') + ' story ' + k, body: 'A story on the sector.', url: 'https://minewire.example.com.au/' + id + '-' + k, ts, meta: { issues: [id], source: 'minewire' } });
  await push(w, 'news', [].concat(...['mining', 'ftc'].map(id => [1, 2, 3, 4].map(i => st(id, 'now' + i, NOW - i * H)).concat(Array.from({ length: 13 }, (_, i) => st(id, 'old' + i, NOW - (1.5 + i) * D))))));
  const ov = (await F(w, 'GET', '/overview?days=1', null, 'read-key')).body; const row = id => (ov.issues || []).find(i => i.id === id) || {};
  eq([row('mining').recent, row('mining').base, row('mining').ratio], [4, null, null], 'mining is not set against a fortnight tagged by its older matcher: ' + JSON.stringify(row('mining')));
  ok(row('mining').since > NOW - H, 'and the row says since when it is tagged as it is now: ' + row('mining').since);
  eq([row('ftc').recent, row('ftc').base, row('ftc').ratio, row('ftc').since], [4, 1, 4, undefined], 'fuel tax credits is compared as before');
  const calls = model(w, () => ({ headline: 'Iron ore and fuel tax credits held steady', summary: 'Fuel tax credits ran four times their usual today.', changed: [{ what: 'Fuel tax credits ran four times their usual.', why: 'The Minerals Council owns the issue.', evidence: ['I:ftc'] }], clients: [], narratives: [], sentiment: [], risks: [], actions: [], gaps: [] }));
  const bd = await F(w, 'POST', '/brief/daily', { days: 1 }); eq(bd.status, 200, bd.text.slice(0, 200)); const u = calls.length ? JSON.stringify(calls[0]) : '';
  ok(/\[I:mining\] Mining and resources \(mca\) 4 rows, 4 of them news, not compared with its usual \(tagged as it is now only since 20\d\d-\d\d-\d\d \d\d:\d\d UTC\)/.test(u) && /\[I:ftc\] Fuel tax credits \(mca\) 4 rows, 4 of them news, usual 1, 4x/.test(u), 'the AXIOM brief is told so: ' + ((u.match(/\[I:mining\][^\\]*/) || [''])[0]));
  const raw = (await T.overviewIssues(w.env, Date.now(), 24)).find(i => i.id === 'mining'); eq([raw.base, raw.ratio], [1, 4], 'the strip\'s burst check reads the figures as they are, and says why itself');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
