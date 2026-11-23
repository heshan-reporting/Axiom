/* Anne's Den build p71, where its lanes meet (the integration of 17 November 2026), against the worker module in this
 * process. No provider is contacted: the model is a stub. Every outlet, account, address, person and post here is
 * invented. MG2 and MG3 fail on b1e9a30 (the rank lane merged, before the integration commit); MG1 guards that merge's
 * own resolution: put the signals block in place before the budget runs, as each lane alone would, and it fails with six
 * dangling ids.
 *   MG1 the budget and the strip's block agree: an evidence text cut to its budget points only at ids it still holds (a
 *       story a signal or a tone line names is never dropped), the signals block sits between the CHANNELS line and the
 *       stories, and the stories' and posts' headers are their own lines, not overwritten by a dropped story's place
 *   MG2 a line that stands for other rows covers a check resting on any of them: a name first seen in the second of three
 *       templated posts is covered at filing by citing the templated line, which carries the first post's id
 *   MG3 a story's stored line keeps its summary (900 characters, not 420), so a figure late in it is not flagged when the
 *       analyst saves the section again
 *   MG4 a narrative is said to be taken up only on channels this window read: its whole life's spread named a channel
 *       the CHANNELS line lists as not read, and a draft wrote it as fact (found by the p72 acceptance run)
 * Run: node --experimental-sqlite tests/den-p71-merge-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p71, where the lanes meet');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const H = 3600000, NOW = Date.now();
let seq = 0;
const add = async (w, kind, rows) => { for (let i = 0; i < rows.length; i += 150) { const r = await F(w, 'POST', '/archive/add', { kind, rows: rows.slice(i, i + 150) }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); } };
const story = (src, title, o) => { seq++; o = o || {}; const meta = Object.assign({ source: src, tier: 'regional', juris: 'au', reg: 1, issues: ['gastax'] }, o.meta || {});
  return Object.assign({ src, title, body: 'Campaigners and producers set out their positions on the gas export tax this week.', url: 'https://' + src + '.example.com.au/news/story-' + seq, ts: NOW - 2 * H }, o, { meta }); };
const post = (text, o) => { seq++; o = o || {}; const meta = Object.assign({ platform: 'bluesky', issues: ['gastax'], id: 'p' + seq, term: 'gas export tax', eng: { likes: 2, reposts: 0, replies: 0, quotes: 0 } }, o.meta || {});
  return Object.assign({ src: 'bluesky', title: 'bluesky post', body: text, url: 'https://bsky.app/profile/did:plc:acct' + seq + '/post/3k' + seq, ts: NOW - 3 * H }, o, { meta }); };
const idOf = (w, url) => w.env.MIND_DB.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id;
const judge = (w, item, tone, kind) => w.env.MIND_DB.db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)').run(item, kind || 'news', kind === 'sig_thread' ? 'bluesky' : 'news', 'x', NOW - 2 * H, tone, JSON.stringify(['gastax']), 'claude');
const entity = (w, id, name) => w.env.MIND_DB.db.prepare("INSERT OR REPLACE INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,'org',?,?,'','Invented','neutral','aep',1,1,'test','',?,?)").run(id, name, JSON.stringify([name]), NOW, NOW);
const names = (w, item, ent, kind) => w.env.MIND_DB.db.prepare('INSERT INTO sent_entities(item,entity,stance,intensity,ts,platform,kind) VALUES(?,?,?,?,?,?,?)').run(item, ent, 0, 1, NOW - 2 * H, kind === 'sig_thread' ? 'bluesky' : 'news', 'org');
const refsIn = t => Array.from(new Set((t.match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).map(x => x.slice(1, -1))));
const model = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content;
  const j = make(ev); return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };

await S.t('MG1 an evidence text cut to its budget points only at ids it holds; the signals block and the headers stand', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  const title = i => 'Senate day ' + (i + 1) + ' of the gas export tax debate: crossbenchers weigh the offer to share revenue with the states, producers warn that new supply will fall, and unions say manufacturers need relief now';
  const body = 'Senators argued over the gas export tax for another day as the vote neared, with crossbenchers holding the balance and the government offering the states a share of the revenue, while producers warned about investment and unions about manufacturing.';
  const rows = Array.from({ length: 110 }, (_, i) => story('paper' + i, title(i), { ts: NOW - (1 + i * 0.18) * H, body }));
  await add(w, 'news', rows); const ids = rows.map(r => idOf(w, r.url));
  // a name first seen in three of the oldest stories (past the cap: its strongest row is sent because the check rests on
  // it), and tone on six stories inside the cap but low in it, which the budget would drop first if a line did not name them
  entity(w, 'harbourquay', 'Harbour Quay Group'); [107, 108, 109].forEach(i => names(w, ids[i], 'harbourquay'));
  [22, 23, 24, 25, 26, 27].forEach((i, k) => judge(w, ids[i], k % 2 ? 0.6 : -0.7));
  ids.forEach(id => { try { judge(w, id, 0); } catch (e) {} });   // the rest judged neutral, once each
  const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true });
  const missed = await T.denMissed(w.env, desk, { board, fresh: true }); ok(missed.signals.some(s => s.key === 'E:harbourquay'), 'the name is first seen: ' + JSON.stringify(missed.signals.map(s => s.key)));
  const ev = await T.denEvidence(w.env, desk, board, missed, [], { memory: false, max: 9000 });
  ok(ev.text.length <= 9000 + 4000, 'cut toward its budget (the protected lines may hold it over): ' + ev.text.length);
  const dangling = refsIn(ev.text).filter(k => !ev.ids.has(k)); eq(dangling, [], 'every id the text names is one it holds');
  const iCh = ev.text.indexOf('CHANNELS READ IN THIS WINDOW'), iSig = ev.text.indexOf('SIGNALS NOT TO MISS'), iMed = ev.text.indexOf('TRADITIONAL MEDIA (');
  ok(iCh >= 0 && iSig > iCh && iMed > iSig, 'channels, then signals, then stories: ' + [iCh, iSig, iMed].join(' < '));
  const lines = ev.text.split('\n'); eq(lines.filter(l => /^TRADITIONAL MEDIA \(/.test(l)).length, 1, 'one stories header');
  ok(/; \d+ stor(?:y|ies) shown, the most relevant first/.test(lines.find(l => /^TRADITIONAL MEDIA \(/.test(l)) || ''), 'the header counts what is shown');
  ok(lines.every(l => l !== 'null' && l !== 'undefined'), 'no empty place left in the text');
  const sig = lines.find(l => /Harbour Quay Group is named on these issues/.test(l)) || ''; ok(/\[M:\d+\]/.test(sig), 'the first-seen line points at a story it holds: ' + sig);
  const tone = lines.find(l => /^\[T:gastax\] /.test(l)) || ''; ok(/Negative: \[M:\d+\]/.test(tone) && /Positive: \[M:\d+\]/.test(tone), 'the tone line names its stories: ' + tone.slice(0, 220));
  // the sixth judged story ranks just past the cap (the window's older quarters each keep a story), so five are named
  const named = refsIn(tone.replace(/^\[T:gastax\] /, '')); ok(named.length === 5 && [22, 23, 24, 25, 26].every(i => named.indexOf('M:' + ids[i]) >= 0), 'the five judged stories inside the cap are named: ' + named.join(' '));
  ok([22, 23, 24, 25, 26].every(i => ev.ids.has('M:' + ids[i])), 'the budget kept every story the tone line names, low as they rank');
  ok(!ev.ids.has('M:' + ids[21]) && !ev.ids.has('M:' + ids[20]), 'while it dropped the unnamed stories ranked above them');
});

await S.t('MG2 citing a templated line covers a check resting on any of its posts', async () => {
  const w = await mk(); await F(w, 'GET', '/sentiment/status');
  const text = 'I just signed the open letter asking the minister to stop the harbour gas export plan before the vote';
  const ps = [0, 1, 2].map(i => post(text, { ts: NOW - (5 - i) * H }));
  await add(w, 'news', [story('harbourgazette', 'Harbour gas export plan heads to a Senate vote', { ts: NOW - 4 * H })]); await add(w, 'sig_thread', ps);
  const pid = ps.map(p => idOf(w, p.url)); pid.forEach(id => judge(w, id, -0.4, 'sig_thread'));
  entity(w, 'quaywatch', 'Quay Watch Alliance'); names(w, pid[1], 'quaywatch', 'sig_thread');   // named in the second post only
  const calls = model(w, ev => { const all = (ev.match(/^\[[A-Z]:[^\]]+\]/gm) || []).map(x => x.slice(1, -1)); const rep = all.find(k => /^S:/.test(k)) || 'S:0';
    const extra = all.filter(k => /^[AI]:/.test(k)).map(k => '[' + k + ']').join('');
    const m = all.find(k => /^M:/.test(k)) || 'M:0';   // long enough to file (200 characters), and never naming the entity
    return { sections: { summary: 'Templated posts urged the minister to stop the export plan before the Senate votes on it, each one the same letter signed by a different account [' + rep + ']' + extra + '. The vote on the harbour gas export plan is near, and the regional press is following it day by day [' + m + '].' }, ratings: {} }; });
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const br = r.body.brief;
  const sent = calls[0].messages[0].content; ok(sent.indexOf('[S:' + pid[0] + '] ') >= 0 && /3 near-identical posts/.test(sent), 'one templated line under the first post: ' + (sent.match(/^\[S:[^\n]*/m) || [''])[0].slice(0, 160));
  ok(br.sections.summary.cites.indexOf('S:' + pid[0]) >= 0, 'the draft cites the templated line');
  const strip = (await F(w, 'GET', '/den/missed?desk=aep_au&fresh=1')).body.signals; const e = strip.find(s => s.key === 'E:quaywatch');
  ok(e && e.cover.indexOf('S:' + pid[1]) >= 0 && e.cover.indexOf('S:' + pid[0]) < 0, 'the check rests on the second post alone: ' + JSON.stringify(e && e.cover));
  const f = await F(w, 'POST', '/den/brief/file', { id: br.id, revision: br.revision });
  ok(f.status === 200 || f.body.error === 'uncited_signals', 'the filing reached the check of the strip: ' + f.status + ' ' + JSON.stringify(f.body.error));
  const open = (f.body.signals || []).map(s => s.key); ok(open.indexOf('E:quaywatch') < 0, 'the name is covered by the line its post rides on: ' + JSON.stringify(open));
});

await S.t('MG3 a figure late in a story\'s summary holds when the section is saved again', async () => {
  const w = await mk();
  const title = 'Producers and unions set out what the gas export tax would mean for jobs in the regions, for prices in the cities and for the investment pipeline over the next decade, as the Senate nears its vote on the bill';
  const body = 'The producers\' submission runs through the modelling region by region and sets out the assumptions behind each estimate, from prices and contract terms to the pace of new supply, and it closes with the figure it says matters most: 4,321 jobs would be at risk in the regions.';
  const s1 = story('harbourgazette', title, { body }); await add(w, 'news', [s1]); const id = idOf(w, s1.url);
  model(w, () => ({ sections: { summary: 'Producers said 4,321 jobs would be at risk in the regions [M:' + id + '].' }, ratings: {} }));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const br = r.body.brief;
  eq(br.sections.summary.unverified, [], 'the figure is in the line the model was given');
  const line = w.env.MIND_DB.db.prepare('SELECT evidence FROM den_briefs WHERE id=?').get(br.id).evidence; const stored = JSON.parse(line).ids['M:' + id].line;
  ok(stored.length > 420 && stored.indexOf('4,321') > 0, 'the stored line keeps its summary: ' + stored.length + ' characters');
  const s = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: 'Producers said 4,321 jobs would be at risk in the regions, in their submission [M:' + id + '].' } });
  eq(s.status, 200, s.text.slice(0, 200)); eq(s.body.brief.sections.summary.unverified, [], 'saved again, the figure still holds');
});

await S.t('MG4 a narrative is said to be taken up only on channels this window read', async () => {
  const w = await mk();
  await add(w, 'news', [story('harbourgazette', 'Harbour gas export plan heads to a Senate vote', { ts: NOW - 4 * H })]);
  await add(w, 'sig_thread', [post('The harbour gas export plan should be stopped before the vote, say residents at the quay')]);
  const T = w.mod.__test; const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true });
  ok(board.byChannel.news > 0 && board.byChannel.bluesky > 0 && !(board.byChannel.x > 0), 'the window read news and Bluesky, no X: ' + JSON.stringify(board.byChannel));
  // a narrative whose life began on X (read in an earlier window) and spread to Bluesky and the news
  board.narratives = [{ id: 'nmtestquay1', label: 'Residents want the harbour export plan stopped', claim: 'The plan puts the harbour at risk', first: NOW - 30 * 24 * H, status: 'growing', n: 40, n24: 3, side: 'hostile', named: 'model', spread: ['x', 'bluesky', 'news'] }];
  const ev = await T.denEvidence(w.env, desk, board, null, [], { memory: false });
  const line = ev.text.split('\n').find(l => /^\[N:nmtestquay1\] /.test(l)) || '';
  ok(/taken up on: Bluesky, then News/.test(line), 'the channels read in this window, in the order it reached them: ' + line.slice(-120));
  ok(!/\bX\b/.test(line.replace(/^\[N:[^\]]+\] /, '')), 'X, not read in this window, is not named: ' + line.slice(-120));
  board.byChannel = { news: 1 }; const ev2 = await T.denEvidence(w.env, desk, board, null, [], { memory: false });
  ok(/taken up on: News \|/.test(ev2.text.split('\n').find(l => /^\[N:nmtestquay1\] /.test(l)) || '') || /taken up on: News$/.test(ev2.text.split('\n').find(l => /^\[N:nmtestquay1\] /.test(l)) || ''), 'with only the news read, only News is named');
});

S.done();
