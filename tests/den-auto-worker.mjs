/* Anne's Den build p72, lane W-A (review): the corrections a person makes beside the text, the flags the worker raises
 * with their keys, and what a replace draft and a filing do with both (BRIEF-P72 "POST /den/brief/review", "Flags", "The
 * replace draft and filing"; spec v3 Parts A and B, worker items 1-3, 6, 9 and 10; owner decision D2), against the worker
 * module in this process. No provider is contacted: the model is a stub. Every outlet, account, person, address and
 * sentence here is invented. Until the text lane (W-B) merges, a section's model list (sections[sec].model) is set on the
 * stored row directly, as the draft will store it. Each case fails on 2bf7f17 (the p72 base).
 *   AW1 the schema and the view: den_briefs gains review and review_rev, den_brief_review_log exists, AX_JSON_COLUMNS lists
 *       the review; the JSON view and the save, section and draft answers carry review, review_rev, covers and flags;
 *       md, html, Slack and prev=1 carry none of it
 *   AW2 POST /den/brief/review: add, remove, unremove, leave and unleave, each idempotent and logged; the answer is
 *       {ok, review, review_rev} only; no op moves the brief's revision, sections, evidence or text history
 *   AW3 refusals in words: a read key, an unknown brief, a filed brief, a bad op (named, nothing written), the limits (60
 *       ids in a list, 200 marks; 413, nothing written); a note is plain text of 200 characters, handles and addresses struck
 *   AW4 review_rev: two corrections sent together both land; a write that keeps losing its compare-and-swap gives up after
 *       three retries with review_busy in words
 *   AW5 the review log keeps the newest 500 rows of a brief
 *   AW6 a guest key reads the corrections without who made them or why; a staff key reads both
 *   AW7 the stored-list kinds (figure, figure_bare, dropped, trimmed): one flag each, keyed by the brief's formula, and every
 *       key unchanged by a save that leaves its sentence alone
 *   AW8 the wording kinds read only the model's sentences, never one citing an added source, never a section with no model
 *       list: Den words on by default (whole words, "the evidence", no hyphenated compound); comparisons, unread channels,
 *       bare marks and contradicted ratings off until a desk switches them on, each by its own rule
 *   AW9 a flag left as it is carries who, when and why; a mark whose flag is gone is not returned (and stays stored); the
 *       page's kinds (a strip check by its signal's key, pin:, empty:) are always returned; a wording key survives a save
 *       that keeps the model's list
 *   AW10 covers: a line's copies, an S: line's P: twin, and a narrative a person merged into another; an automatic merge
 *        covers nothing
 *   AW11 a replace draft remaps the corrections: M/S/P by item to the new id, N kept, a stable U kept while the new
 *        evidence holds it (p72 fix W3: else followed to its date or named, tests/den-p72-fix-worker.mjs PF3), positional U and
 *        K/T/C/I/A dropped, the marks of every section drafted again dropped; each drop logged and named in review_dropped
 *   AW12 filing: a check left out with a reason is still open and comes back in its own left group; acknowledge 'left'
 *        files at once when every open check is a left one (D2) and asks otherwise; acknowledged is a list of objects
 *        (marked or at filing); an old list of keys reads as objects; each section's list is copied into the log
 *   AW13 one cover rule at filing: a citation mark covers a check only in a sentence of four words or more of its own
 * Run: node --experimental-sqlite tests/den-auto-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p72, lane W-A: corrections, flags, the replace draft and filing');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'other-key': { n: 'Kai', r: 'full' } };
const GUEST = { AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-key-1234': { n: 'Tester', r: 'read' } }) };
const mk = async env => { const w = await workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, GUEST, env || {}), keys: KEYS }); const d = await w.call('GET', '/den/desks', null, 'full-key'); if (d.status !== 200) throw new Error('desks: ' + d.text.slice(0, 200)); return w; };
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const db = w => w.env.MIND_DB.db;
const H = 3600000, NOW = Date.now();
let seq = 0, dn = 0;
const marksIn = t => Array.from(new Set((String(t || '').match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).map(x => x.slice(1, -1))));
const sents = (T, t) => T.denSentences(t).flat().map(s => String(s).trim()).filter(Boolean);
// a stored section as a draft writes it; model: the keys of the sentences the model wrote (W-B's field), person: sentences a person wrote
const sec = (T, text, o) => { o = o || {}; const s = Object.assign({ text, cites: marksIn(text), uncited: [], unverified: [], trimmed: [], edited: false, by: 'model' }, o.lists || {});
  if (o.model !== false) s.model = sents(T, text).filter(x => (o.person || []).indexOf(x) < 0).map(x => T.denFnv32(T.denPlain(x))); return s; };
// a brief stored directly, as a draft leaves it (each on its own day: one brief a desk a day)
const put = (w, o) => { o = o || {}; const id = 'btest' + (++dn); const day = '2026-10-' + String(dn).padStart(2, '0');
  db(w).prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,'',?,?,?)")
    .run(id, o.desk || 'aep_au', day, 24, NOW - 24 * H, NOW, o.status || 'draft', o.revision || 1, JSON.stringify(o.sections || {}), JSON.stringify(o.ratings || {}), JSON.stringify(o.evidence || { ids: {} }), 'Anne', NOW, NOW); return id; };
const rowOf = (w, id) => db(w).prepare('SELECT * FROM den_briefs WHERE id=?').get(id);
const view = async (w, id, k) => { const r = await F(w, 'GET', '/den/brief?id=' + id, null, k); if (r.status !== 200) throw new Error('view: ' + r.text.slice(0, 200)); return r.body.brief; };
const review = (w, id, ops, k) => F(w, 'POST', '/den/brief/review', { id, ops }, k);
const fkey = (T, short, kind, secId, plain, cited, fw, occ) => short + ':' + T.denFnv32([kind, secId, plain, cited.slice().sort().join(','), fw || '', occ || 0].join('\n'));
const flagsOf = (v, s) => (v.flags || []).filter(f => !s || f.section === s);
const ev = ids => ({ ids, label: '24 hours to 9am' });
const media = (item, line, o) => Object.assign({ k: 'media', label: 'Bay Herald - Harbour story ' + item, url: 'https://bayherald.example.com.au/story-' + item, gated: 0, item, line }, o || {});
const social = (item, line, o) => Object.assign({ k: 'social', label: 'bluesky post', url: 'https://bsky.app/profile/did:plc:acct' + item + '/post/3k' + item, gated: 0, item, platform: 'bluesky', line }, o || {});
// the archive and the stub model, for the cases that draft
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const story = o => Object.assign({ src: 'bayherald', title: 'Crowd at the quay as the gas export tax vote nears ' + (++seq), body: 'Residents gathered at the quay as the Senate vote on the gas export tax neared, organisers said.', url: 'https://bayherald.example.com.au/news/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'bayherald', tier: 'regional', juris: 'au', reg: 1 } }, o || {});
const post = o => { ++seq; return Object.assign({ src: 'bluesky', title: 'bluesky post', body: 'The gas export tax vote is close: come down to the quay on Saturday ' + seq + '.', url: 'https://bsky.app/profile/did:plc:acct' + seq + '/post/3k' + seq, ts: NOW - 3 * H, meta: { platform: 'bluesky', issues: ['gastax'], id: 'p' + seq, term: 'gas export tax', eng: { likes: 3, reposts: 1, replies: 0 } } }, o || {}); };
const seedDay = async w => { await push(w, 'news', [story(), story({ src: 'coastledger', url: 'https://coastledger.example.com.au/news/' + (++seq), title: 'Fishers weigh the windfall tax on gas exports', meta: { issues: ['gastax'], source: 'coastledger' } })]); await push(w, 'sig_thread', [post(), post()]); };
const model = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const evt = b.messages[0].content; const ids = k => (evt.match(new RegExp('\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'g')) || []).map(x => x.slice(1, -1));
  const j = make ? make(evt, ids) : { sections: { summary: 'Residents gathered at the quay as the harbour levy vote neared, and the regional press followed every step of it [' + (ids('M')[0] || 'M:0') + ']. Posts urged people to come down to the quay on the weekend [' + (ids('S')[0] || 'S:0') + '].', bottom: 'The harbour levy fight stayed local through the window [' + (ids('M')[0] || 'M:0') + '].' }, ratings: { momentum: { level: 'Moderate', trend: 'Stable' } } };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const logOf = (w, id) => db(w).prepare('SELECT * FROM den_brief_review_log WHERE brief=? ORDER BY id').all(id);
const LONG = 'Residents of the bay gathered at the quay through the afternoon as the vote on the harbour levy neared, and the regional press followed each step of the campaign closely. Organisers asked the council for a public meeting before the vote, and local traders put posters in their windows along the foreshore. ';

await S.t('AW1 the schema, the view and the answers that carry the review', async () => {
  const w = await mk(); const T = w.mod.__test;
  const cols = db(w).prepare('PRAGMA table_info(den_briefs)').all().map(c => [c.name, c.dflt_value]); ok(cols.some(c => c[0] === 'review' && c[1] === "'{}'") && cols.some(c => c[0] === 'review_rev' && String(c[1]) === '0'), 'the guarded columns: ' + JSON.stringify(cols.slice(-3)));
  eq(db(w).prepare('PRAGMA table_info(den_brief_review_log)').all().map(c => c.name), ['id', 'brief', 'at', 'by', 'op', 'sec', 'item', 'key', 'note']);
  ok(db(w).prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='den_brief_review_log'").all().length >= 1, 'an index on (brief, id)');
  const integ = await F(w, 'GET', '/integrity'); eq(integ.status, 200, integ.text.slice(0, 160)); ok((integ.body.checked || []).indexOf('den_briefs.review') >= 0, 'the integrity report reads the review column: ' + JSON.stringify(integ.body.checked));
  // a brief stored before p72 (no review written): an empty review at 0, and the view carries the four fields
  const id = put(w, { sections: { summary: sec(T, LONG + 'The quay stayed calm into the evening [M:101].') }, evidence: ev({ 'M:101': media(101, 'Bay Herald | quay story', { also: [102] }) }) });
  const v = await view(w, id); eq([v.review, v.review_rev], [{ picks: {}, marks: {} }, 0]); eq(v.covers, { 'M:101': ['M:102'] }); ok(Array.isArray(v.flags), 'flags: ' + JSON.stringify(v.flags));
  const rv = await view(w, id, 'read-key'); ok(Array.isArray(rv.flags) && rv.review, 'a read key reads them too');
  for (const fmt of ['md', 'html', 'slack']) { const r = await F(w, 'GET', '/den/brief?id=' + id + '&format=' + fmt); ok(r.status === 200 && !/review_rev|"flags"|covers/.test(r.text), fmt + ' carries none of it'); }
  db(w).prepare("UPDATE den_briefs SET status='filed' WHERE id=?").run(id);
  const prev = (await F(w, 'GET', '/den/brief?desk=aep_au&prev=1&day=2999-01-01')).body.brief; eq([prev.id, 'flags' in prev, 'review' in prev], [id, false, false], 'prev=1 carries none of it');
  // the save, section and draft answers
  await seedDay(w); model(w);
  const d = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(d.status, 200, d.text.slice(0, 300)); const b = d.body.brief;
  ok(Array.isArray(b.flags) && b.review && b.review_rev === 0 && b.covers && typeof b.covers === 'object' && Array.isArray(d.body.review_dropped), 'the draft answer: ' + JSON.stringify(Object.keys(b)));
  const s = await F(w, 'POST', '/den/brief/save', { id: b.id, revision: b.revision, sections: { bottom: 'The harbour levy fight stayed local and small through the whole window [' + b.sections.bottom.cites[0] + '].' } }); eq(s.status, 200, s.text.slice(0, 200)); ok(Array.isArray(s.body.brief.flags) && s.body.brief.review, 'the save answer');
  const stale = await F(w, 'POST', '/den/brief/save', { id: b.id, revision: b.revision, sections: { bottom: 'x' } }); eq([stale.status, 'flags' in stale.body.brief], [409, false], 'a conflict answer is the plain view');
  const x = await F(w, 'POST', '/den/brief/section', { id: b.id, section: 'summary', revision: s.body.brief.revision }); eq(x.status, 200, x.text.slice(0, 200)); ok(Array.isArray(x.body.brief.flags) && x.body.brief.review, 'the section answer');
});

await S.t('AW2 the review route: five ops, idempotent, logged, and never the text', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG + 'The quay stayed calm into the evening [M:101].') }, evidence: ev({ 'M:101': media(101, 'Bay Herald | quay story') }) });
  const before = rowOf(w, id); const revs = db(w).prepare('SELECT COUNT(*) n FROM den_brief_revisions').get().n;
  const a = await review(w, id, [{ op: 'add', sec: 'summary', item: 'S:201' }, { op: 'add', sec: 'summary', item: 'S:201' }, { op: 'remove', sec: 'media', item: 'M:101' }]);
  eq(a.status, 200, a.text.slice(0, 200)); eq(Object.keys(a.body).sort(), ['ok', 'review', 'review_rev'], 'the answer is the review alone');
  eq([Object.keys(a.body.review.picks.summary.add), Object.keys(a.body.review.picks.media.remove), a.body.review_rev], [['S:201'], ['M:101'], 1]);
  eq([a.body.review.picks.summary.add['S:201'].by, typeof a.body.review.picks.summary.add['S:201'].at], ['Anne', 'number']);
  // remove takes an id out of add, add takes it out of remove, unremove clears a removal
  const b = await review(w, id, [{ op: 'remove', sec: 'summary', item: 'S:201' }, { op: 'add', sec: 'media', item: 'M:101' }, { op: 'remove', sec: 'social', item: 'S:202' }, { op: 'unremove', sec: 'social', item: 'S:202' }, { op: 'unremove', sec: 'social', item: 'S:202' }], 'other-key');
  eq(b.status, 200); const p = b.body.review.picks; eq([Object.keys((p.summary || {}).add || {}), Object.keys((p.summary || {}).remove || {}), Object.keys((p.media || {}).add || {}), Object.keys((p.media || {}).remove || {}), (p.social && Object.keys(p.social.remove || {}).length) || 0], [[], ['S:201'], ['M:101'], [], 0]);
  eq(p.summary.remove['S:201'].by, 'Kai', 'the last op wins, with who sent it');
  const c = await review(w, id, [{ op: 'leave', key: 'A:7', kind: 'check', sec: '', note: 'Too small to report', fig: '9 stories in six hours, 3.1 times' }, { op: 'leave', key: 'pin:M:101', kind: 'pinned', sec: 'media', note: 'Covered in other words' }, { op: 'unleave', key: 'pin:M:101' }, { op: 'unleave', key: 'pin:M:101' }]);
  eq(c.status, 200, c.text.slice(0, 200)); eq(Object.keys(c.body.review.marks), ['A:7']); const m = c.body.review.marks['A:7']; eq([m.kind, m.sec, m.by, m.note, m.fig], ['check', '', 'Anne', 'Too small to report', '9 stories in six hours, 3.1 times']);
  eq(c.body.review_rev, 3);
  const log = logOf(w, id); eq(log.map(l => l.op), ['add', 'add', 'remove', 'remove', 'add', 'remove', 'unremove', 'unremove', 'leave', 'leave', 'unleave', 'unleave'], 'every op a row');
  eq([log[0].sec, log[0].item, log[0].by, log[8].key, log[8].note, log[4].by], ['summary', 'S:201', 'Anne', 'A:7', 'Too small to report', 'Kai']);
  const after = rowOf(w, id); eq([after.revision, after.sections, after.evidence, after.updated, after.status], [before.revision, before.sections, before.evidence, before.updated, before.status], 'no op touches the text, the evidence or the revision');
  eq(db(w).prepare('SELECT COUNT(*) n FROM den_brief_revisions').get().n, revs, 'no op writes a text revision');
  eq(JSON.parse(after.review).marks['A:7'].kind, 'check'); eq(after.review_rev, 3);
});

await S.t('AW3 refusals in words; the limits; a note is plain text', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG) } });
  const rd = await review(w, id, [{ op: 'add', sec: 'summary', item: 'S:1' }], 'read-key'); eq([rd.status, rd.body.error], [403, 'read_only']);
  const un = await review(w, 'nope', [{ op: 'add', sec: 'summary', item: 'S:1' }]); eq([un.status, un.body.error], [404, 'unknown_brief']);
  const bad = async (ops, re) => { const r = await review(w, id, ops); eq(r.status, 400, JSON.stringify(ops) + ' ' + r.text.slice(0, 200)); ok(re.test(r.body.detail) && /Nothing was saved/.test(r.body.detail), r.body.detail); eq(rowOf(w, id).review_rev, 0, 'nothing written'); };
  await bad([], /correction/i);
  await bad([{ op: 'add', sec: 'summary', item: 'S:1' }, { op: 'add', sec: 'sources', item: 'S:1' }], /^Correction 2 \(add\)/);
  await bad([{ op: 'add', sec: 'nowhere', item: 'S:1' }], /section/);
  await bad([{ op: 'remove', sec: 'summary', item: 'not an id' }], /^Correction 1 \(remove\)/);
  await bad([{ op: 'pin', sec: 'summary', item: 'S:1' }], /^Correction 1 \(pin\)/);
  await bad([{ op: 'leave', key: 'Bad Key', kind: 'denwords', sec: 'summary' }], /key/);
  await bad([{ op: 'leave', key: 'words:1a2b3c4d', kind: 'nonsense', sec: 'summary' }], /kind/);
  await bad([{ op: 'leave', key: 'fig:1a2b3c4d', kind: 'denwords', sec: 'summary' }], /key/);
  await bad([{ op: 'unleave' }], /key/);
  const filed = put(w, { status: 'filed', sections: { summary: sec(T, LONG) } }); const fr = await review(w, filed, [{ op: 'add', sec: 'summary', item: 'S:1' }]); eq([fr.status, fr.body.error], [409, 'brief_filed']); ok(/filed/.test(fr.body.detail));
  // 60 ids in any one list; 200 marks: over a limit nothing is written
  const sixty = Array.from({ length: 60 }, (_, i) => ({ op: 'add', sec: 'summary', item: 'S:' + (1000 + i) }));
  eq((await review(w, id, sixty)).status, 200);
  const over = await review(w, id, [{ op: 'add', sec: 'social', item: 'S:5' }, { op: 'add', sec: 'summary', item: 'S:2000' }]); eq([over.status, over.body.error], [413, 'review_limit']); ok(/60/.test(over.body.detail) && /Nothing was saved/.test(over.body.detail), over.body.detail);
  const r1 = JSON.parse(rowOf(w, id).review); eq([Object.keys(r1.picks.summary.add).length, !!r1.picks.social, rowOf(w, id).review_rev], [60, false, 1]);
  eq((await review(w, id, [{ op: 'add', sec: 'summary', item: 'S:1000' }, { op: 'remove', sec: 'summary', item: 'S:1001' }])).status, 200, 'a list at its limit takes an id it already holds, and moves one out');
  const leave = n => Array.from({ length: n }, (_, i) => ({ op: 'leave', key: 'empty:s' + i, kind: 'empty', sec: '' }));
  eq((await review(w, id, leave(200))).status, 200); const m201 = await review(w, id, [{ op: 'leave', key: 'pin:S:9', kind: 'pinned', sec: 'summary' }]); eq([m201.status, m201.body.error], [413, 'review_limit']); ok(/200/.test(m201.body.detail));
  eq((await review(w, id, [{ op: 'unleave', key: 'empty:s0' }, { op: 'leave', key: 'pin:S:9', kind: 'pinned', sec: 'summary' }])).status, 200, 'one out, one in');
  // a note: plain text, at most 200 characters, @handles and web addresses struck; fig only on a strip check
  const note = 'Reads fine @harbourwatch see https://bayherald.example.com.au/a?x=1 and www.example.com.au or bayherald.example.com.au/b \u0007' + ' because'.repeat(40);
  const n = await review(w, id, [{ op: 'unleave', key: 'empty:s1' }, { op: 'leave', key: 'words:1a2b3c4d', kind: 'denwords', sec: 'summary', note, fig: 'nine' }]); eq(n.status, 200, n.text.slice(0, 200));
  const st = JSON.parse(rowOf(w, id).review).marks['words:1a2b3c4d']; ok(st.note.length <= 200 && /^Reads fine see and or because because/.test(st.note) && !/@|https?:|www\.|example\.com/.test(st.note), st.note); ok(!('fig' in st) || st.fig == null, 'a figure only on a strip check');
});

await S.t('AW4 two corrections at once both land; a lost compare-and-swap is retried, then said', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG) } }); w.slowReads(25);
  const [a, b] = await Promise.all([review(w, id, [{ op: 'add', sec: 'summary', item: 'S:301' }]), review(w, id, [{ op: 'remove', sec: 'media', item: 'M:302' }], 'other-key')]);
  w.slowReads(0); eq([a.status, b.status], [200, 200], a.text.slice(0, 120) + ' ' + b.text.slice(0, 120));
  const r = JSON.parse(rowOf(w, id).review); eq([Object.keys(r.picks.summary.add), Object.keys(r.picks.media.remove), rowOf(w, id).review_rev], [['S:301'], ['M:302'], 2], 'neither lost');
  let tries = 0; const busy = await T.denReviewApply(w.env, id, rv => { tries++; db(w).prepare('UPDATE den_briefs SET review_rev=review_rev+1 WHERE id=?').run(id); rv.marks['empty:x'] = { kind: 'empty', sec: '', by: 'Anne', at: 1 }; }, 'Anne');
  eq([busy.ok, busy.status, busy.error, tries], [false, 409, 'review_busy', 4], JSON.stringify(busy)); ok(/try again/i.test(busy.detail) && /Nothing was saved/.test(busy.detail), busy.detail);
  ok(!JSON.parse(rowOf(w, id).review).marks['empty:x'], 'nothing written');
});

await S.t('AW5 the review log keeps the newest 500 rows of a brief', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG) } }); const other = put(w, { sections: { summary: sec(T, LONG) } });
  eq((await review(w, other, [{ op: 'add', sec: 'summary', item: 'S:9' }])).status, 200);
  const ops = i => Array.from({ length: 200 }, (_, k) => ({ op: (i * 200 + k) % 2 ? 'remove' : 'add', sec: 'summary', item: 'S:' + (i * 200 + k) % 7 }));
  for (let i = 0; i < 3; i++) { const r = await review(w, id, ops(i)); eq(r.status, 200, r.text.slice(0, 160)); }
  const log = logOf(w, id); eq(log.length, 500); const all = db(w).prepare('SELECT MAX(id) mx FROM den_brief_review_log WHERE brief=?').get(id).mx; eq(log[0].id, all - 499, 'the newest kept');
  eq(logOf(w, other).length, 1, 'another brief\'s rows stay');
});

await S.t('AW6 a guest reads corrections without who or why', async () => {
  const w = await mk(); const T = w.mod.__test;
  const text = LONG + 'The evidence shows a small and local push against the levy [S:201].';
  const id = put(w, { sections: { social: sec(T, text) }, evidence: ev({ 'S:201': social(201, 'bluesky | a post') }) });
  const staff = await view(w, id); const f = flagsOf(staff, 'social').find(x => x.kind === 'denwords'); ok(f, 'a Den-words flag: ' + JSON.stringify(staff.flags));
  eq((await review(w, id, [{ op: 'add', sec: 'social', item: 'S:202' }, { op: 'leave', key: f.key, kind: 'denwords', sec: 'social', note: 'She asked for this wording' }, { op: 'leave', key: 'A:4', kind: 'check', sec: '', note: 'Too small to report', fig: '3 times' }])).status, 200);
  const s = await view(w, id, 'read-key'); const sf = flagsOf(s, 'social').find(x => x.key === f.key);
  eq([s.review.picks.social.add['S:202'].by, s.review.marks[f.key].note, s.review.marks['A:4'].by, sf.left.by, sf.left.note], ['Anne', 'She asked for this wording', 'Anne', 'Anne', 'She asked for this wording'], 'a staff key reads who and why');
  const g = await view(w, id, 'guest-key-1234'); const gf = flagsOf(g, 'social').find(x => x.key === f.key);
  ok(g.review.picks.social.add['S:202'] && !('by' in g.review.picks.social.add['S:202']), 'a pick without who: ' + JSON.stringify(g.review.picks));
  ok(Object.keys(g.review.marks).every(k => !('by' in g.review.marks[k]) && !('note' in g.review.marks[k])) && g.review.marks['A:4'].kind === 'check' && g.review.marks['A:4'].fig === '3 times', 'marks without who or why: ' + JSON.stringify(g.review.marks));
  ok(gf.left && typeof gf.left.at === 'number' && !('by' in gf.left) && !('note' in gf.left), 'a left flag without who or why: ' + JSON.stringify(gf.left));
  ok(!/She asked|Too small|Anne/.test(JSON.stringify(g.review) + JSON.stringify(g.flags)), 'no name or note anywhere in the guest\'s review or flags');
});

await S.t('AW7 the stored-list kinds, keyed by the formula, unchanged by a save elsewhere in the section', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = { 'M:101': media(101, 'Bay Herald | Flotilla on the harbour | Organisers counted 30 boats on the water at the quay.'), 'M:102': media(102, 'Coast Ledger | Levy fight | a subscriber story about the harbour levy and the fishers', { gated: 1, label: 'Coast Ledger - Levy fight' }) };
  const id = put(w, { revision: 1, evidence: ev(ids) });
  const quote = 'We have fished this harbour all our lives and we will not stand by while a levy written far away takes away the living our families built over many hard years of work';
  const t0 = 'Organisers said 40 boats joined the flotilla on the harbour [M:101]. Turnout was 75 people by noon. A local group is behind the push. The Coast Ledger quoted a skipper: "' + quote + '" [M:102]. The quay stayed calm through the afternoon [M:101].';
  const s0 = await F(w, 'POST', '/den/brief/save', { id, revision: 1, sections: { summary: t0 } }); eq(s0.status, 200, s0.text.slice(0, 200));
  // a dropped citation comes from a draft (the model cited an id the evidence never held, and the draft struck it); since
  // p72 a save refuses such an id in words instead (lane text), so the draft's list is written on the stored row here
  { const r = rowOf(w, id); const sc = JSON.parse(r.sections); sc.summary.uncited = ['A local group is behind the push.']; db(w).prepare('UPDATE den_briefs SET sections=? WHERE id=?').run(JSON.stringify(sc), id); }
  const s1 = { body: { brief: await view(w, id) } };
  const st = JSON.parse(rowOf(w, id).sections).summary; ok(st.unverified.length === 2 && st.uncited.length === 1 && st.trimmed.length === 1, 'the stored lists: ' + JSON.stringify([st.unverified, st.uncited, st.trimmed]));
  const v1 = s1.body.brief; const fl = flagsOf(v1, 'summary'); eq(fl.map(f => f.kind), ['figure', 'figure_bare', 'dropped', 'trimmed'], 'one flag each, in sentence order');
  eq(fl.map(f => f.key.split(':')[0]), ['fig', 'bare', 'drop', 'trim']); ok(fl.every(f => /^[a-z]{2,12}:[0-9a-f]{8}$/.test(f.key)), 'keys pass the review route\'s pattern');
  const [fg, bare, drop, trim] = fl;
  eq([fg.sentence, fg.figures, bare.sentence, bare.figures.length, drop.sentence], ['Organisers said 40 boats joined the flotilla on the harbour.', st.unverified[0].figures, 'Turnout was 75 people by noon.', 1, 'A local group is behind the push.']);
  eq(fg.key, fkey(T, 'fig', 'figure', 'summary', fg.sentence, ['M:101'], st.unverified[0].figures.join(','), 0), 'kind, section, plain sentence, sorted cited ids, figures, occurrence');
  eq(bare.key, fkey(T, 'bare', 'figure_bare', 'summary', bare.sentence, [], st.unverified[1].figures.join(','), 0));
  eq(drop.key, fkey(T, 'drop', 'dropped', 'summary', drop.sentence, [], '', 0));
  ok(/^The Coast Ledger quoted a skipper:/.test(trim.sentence) && trim.quote === st.trimmed[0], 'the trimmed flag names its sentence and the quotation: ' + JSON.stringify(trim));
  eq(trim.key, fkey(T, 'trim', 'trimmed', 'summary', trim.sentence, ['M:102'], st.trimmed[0], 0));
  // a save that changes only the last sentence keeps every key
  const t1 = rowOf(w, id) && JSON.parse(rowOf(w, id).sections).summary.text.replace('The quay stayed calm through the afternoon', 'The quay stayed calm into the evening');
  const s2 = await F(w, 'POST', '/den/brief/save', { id, revision: s1.body.brief.revision, sections: { summary: t1 } }); eq(s2.status, 200, s2.text.slice(0, 200));
  eq(flagsOf(s2.body.brief, 'summary').map(f => f.key), fl.map(f => f.key), 'the same keys after the save');
  // a second identical sentence is its own flag, by its occurrence
  const t2 = JSON.parse(rowOf(w, id).sections).summary.text + ' Turnout was 75 people by noon.';
  const s3 = await F(w, 'POST', '/den/brief/save', { id, revision: s2.body.brief.revision, sections: { summary: t2 } }); const bares = flagsOf(s3.body.brief, 'summary').filter(f => f.kind === 'figure_bare');
  ok(bares.length >= 1 && bares[0].key === bare.key, 'the first keeps its key: ' + JSON.stringify(bares));
});

// the wording sentences (every one invented)
const SOC = ['Posts in the rows we were supplied came mostly from residents of the bay [S:201].', 'The evidence points to a small, local push against the harbour levy [S:201].', 'The pinned-down figures were judged fair by the organisers [S:201].',
  'Evidence of support was thin on the ground [S:201].', 'Several accounts replied to the client in long threads [S:202].', 'Our team held a briefing with the rows of organisers [S:201].', 'Organisers held a vigil at the quay that evening [H:1].'];
const MOM = ['Opposition to the levy remains strong across the bay [S:201].', 'Campaigners may remain active through the week [S:201].', 'Organisers said "we will be back again" at the rally [S:201].', 'The count of posts rose again against the day before [C:gastax].',
  'The group is no longer posting each day [S:201].', 'Support still runs high along the foreshore [S:201].', 'Locals say the levy continues to hurt fishers [N:nq1].', 'Turnout continues to grow at the quay [S:201].'];
const RISK = ['Activity on X was quiet beside Bluesky [S:201].', 'Generation X voters were not polled about the levy [S:201].', 'Facebook groups shared the flyer for the rally [S:201].', 'Reddit threads asked about the levy all week [S:201].'];
const BOT = ['See the story [M:101].', 'Turnout at the quay grew through the day [M:101].', 'The rally [M:101][S:201].'];
const WORDS_EV = () => ev({ 'S:201': social(201, 'bluesky | a post about the levy'), 'S:202': social(202, 'bluesky | a reply'), 'S:203': social(203, 'bluesky | another post'), 'H:1': { k: 'added', label: 'Bay Herald', url: 'https://bayherald.example.com.au/vigil', item: 0, line: 'A vigil at the quay' },
  'C:gastax': { k: 'measure', label: 'Gas taxation: this window against the day before', text: 'Gas taxation: 9 posts and stories in this window, 8 in the day before', sub: '9 in this window, 8 in the day before; posts and stories as the Board counts them', line: 'Gas taxation: 9 posts and stories in this window, 8 in the day before' },
  'N:nq1': { k: 'narrative', label: 'Harbour levy hurts fishers', url: '', item: 0, line: 'Harbour levy hurts fishers | claim: the levy continues to hurt fishers | 6 rows' }, 'M:101': media(101, 'Bay Herald | quay story'),
  'I:gastax': { k: 'measure', label: 'Gas taxation: above its usual volume', text: 'Gas taxation ran at 3 times its usual volume: 12 posts, stories and comments in this window against 4 usual for a window this long', sub: '12 in the window against 4 usual, 3 times', line: 'Gas taxation ran at 3 times its usual volume: 12 posts, stories and comments in this window against 4 usual for a window this long' } });
const wordsBrief = (w, T, o) => { o = o || {}; const e = WORDS_EV(); if (o.prev !== undefined) e.prev = o.prev; if (o.unread) e.unread = o.unread;
  return put(w, { evidence: e, ratings: { momentum: { level: 'Moderate', trend: o.trend || 'Stable' } }, sections: { social: sec(T, SOC.join(' '), { person: [SOC[5]] }), momentum: sec(T, MOM.join(' ')), risks: sec(T, RISK.join(' ')), bottom: sec(T, BOT.join(' ')), actors: sec(T, 'The rows show nothing new from the actors this desk watches [S:203].', { model: false }) } }); };
const flagsSet = async (w, flags) => { const r = await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { options: { flags } } }); eq(r.status, 200, r.text.slice(0, 200)); };

await S.t('AW8 the wording kinds: the model\'s sentences only, each kind by its own rule and switch', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = wordsBrief(w, T, { prev: '', unread: ['X', 'facebook'] }); let v = await view(w, id);
  // by default only Den words, on the model's sentences, whole words, "the evidence", never a hyphenated compound
  eq(v.flags.map(f => f.kind).filter((k, i, a) => a.indexOf(k) === i), ['denwords'], 'only Den words by default: ' + JSON.stringify(v.flags.map(f => f.kind)));
  const dw = flagsOf(v, 'social'); eq(dw.map(f => f.word), ['rows', 'supplied', 'the evidence', 'judged', 'the client']);
  eq(dw.map(f => f.sentence), [SOC[0], SOC[0], SOC[1], SOC[2], SOC[4]].map(T.denPlain));
  eq(dw[0].key, fkey(T, 'words', 'denwords', 'social', T.denPlain(SOC[0]), ['S:201'], 'rows', 0)); ok(dw[1].key !== dw[0].key, 'one flag per word per sentence');
  eq(flagsOf(v, 'actors'), [], 'a section with no model list runs no wording kind');
  await flagsSet(w, { denwords: false }); eq((await view(w, id)).flags, [], 'switched off');
  // every switchable kind on
  await flagsSet(w, { denwords: true, compare: true, unread: true, mark: true, rating: true }); v = await view(w, id);
  const cmp = flagsOf(v, 'momentum').filter(f => f.kind === 'compare'); eq(cmp.map(f => [f.word, f.sentence]), [['remains', T.denPlain(MOM[0])], ['no longer', T.denPlain(MOM[4])], ['continues', T.denPlain(MOM[7])]], 'modal, quoted, a C: line and a narrative\'s own claim are skipped; "still" is not on the list');
  ok(cmp.every(f => /^cmp:[0-9a-f]{8}$/.test(f.key)));
  const un = flagsOf(v, 'risks').filter(f => f.kind === 'unread'); eq(un.map(f => [f.word, f.sentence]), [['X', T.denPlain(RISK[0])], ['Facebook', T.denPlain(RISK[2])]], 'X only as the platform');
  const mk2 = flagsOf(v, 'bottom').filter(f => f.kind === 'mark'); eq(mk2.map(f => [f.word, f.sentence]), [['[M:101]', 'See the story.'], ['[M:101][S:201]', 'The rally.']]);
  const rt = v.flags.filter(f => f.kind === 'rating'); eq(rt.map(f => [f.section, f.item, f.sentence, f.figures, f.word]), [['momentum', 'momentum', 'Momentum: Moderate, Stable', ['3 times its usual'], 'Gas taxation']]);
  ok(/^rating:[0-9a-f]{8}$/.test(rt[0].key));
  // their inputs: prev set or absent turns the comparison off; no unread list turns unread off; a trend that moved, the rating
  const p2 = wordsBrief(w, T, { prev: '2026-10-01' }); const v2 = await view(w, p2); eq(v2.flags.filter(f => f.kind === 'compare' || f.kind === 'unread'), [], 'a filed bottom line in the evidence, no unread list');
  const p3 = wordsBrief(w, T, { trend: 'Escalating' }); const v3 = await view(w, p3); eq(v3.flags.filter(f => ['compare', 'unread', 'rating'].indexOf(f.kind) >= 0), [], 'prev absent is never read as empty; a rising trend is not contradicted');
  eq(v3.flags.filter(f => f.kind === 'denwords').length, 5); eq(v3.flags.filter(f => f.kind === 'mark').length, 2, 'a bare mark is any author\'s');
});

await S.t('AW9 marks: left with who and why, hidden when their flag is gone, page kinds always returned', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = wordsBrief(w, T, {}); const v = await view(w, id); const ev0 = flagsOf(v, 'social').find(f => f.word === 'the evidence');
  const r = await review(w, id, [{ op: 'leave', key: ev0.key, kind: 'denwords', sec: 'social', note: 'Her own phrase' }, { op: 'leave', key: 'A:7', kind: 'check', sec: '', note: 'Already covered in other words', fig: '9 stories' }, { op: 'leave', key: 'pin:M:101', kind: 'pinned', sec: 'bottom' }, { op: 'leave', key: 'empty:actors', kind: 'empty', sec: 'actors' }, { op: 'leave', key: 'words:00000000', kind: 'denwords', sec: 'social' }]);
  eq(r.status, 200, r.text.slice(0, 200)); eq(Object.keys(r.body.review.marks).sort(), ['A:7', 'empty:actors', ev0.key, 'pin:M:101'].sort(), 'a mark matching no flag is not returned');
  const v1 = await view(w, id); const f1 = flagsOf(v1, 'social').find(f => f.key === ev0.key); eq([f1.left.by, f1.left.note, typeof f1.left.at], ['Anne', 'Her own phrase', 'number']);
  ok(flagsOf(v1, 'social').filter(f => f.key !== ev0.key).every(f => !f.left), 'only the flag left carries left');
  // the sentence is rewritten (the model's list kept, as W-B's save keeps it): the flag and its mark go from the view, the mark stays stored
  const row = rowOf(w, id); const secs = JSON.parse(row.sections); const keep = secs.social.model;
  const s = await F(w, 'POST', '/den/brief/save', { id, revision: row.revision, sections: { social: secs.social.text.replace(SOC[1], 'Support for the push was small and local [S:201].') } }); eq(s.status, 200, s.text.slice(0, 200));
  const after = JSON.parse(rowOf(w, id).sections); after.social.model = keep; db(w).prepare('UPDATE den_briefs SET sections=? WHERE id=?').run(JSON.stringify(after), id);
  const v2 = await view(w, id); ok(!flagsOf(v2, 'social').some(f => f.key === ev0.key) && !(ev0.key in v2.review.marks), 'gone from the view');
  ok(JSON.parse(rowOf(w, id).review).marks[ev0.key], 'never deleted');
  eq(Object.keys(v2.review.marks).sort(), ['A:7', 'empty:actors', 'pin:M:101'], 'the page\'s kinds stay');
  // the other Den-words keys survive that save
  eq(flagsOf(v2, 'social').map(f => f.key), flagsOf(v, 'social').filter(f => f.key !== ev0.key).map(f => f.key), 'unchanged sentences keep their keys');
  // a desk that switches the kind off hides its marks too
  eq((await review(w, id, [{ op: 'leave', key: flagsOf(v2, 'social')[0].key, kind: 'denwords', sec: 'social' }])).status, 200);
  await flagsSet(w, { denwords: false }); const v3 = await view(w, id); eq(Object.keys(v3.review.marks).sort(), ['A:7', 'empty:actors', 'pin:M:101']);
});

await S.t('AW10 covers: copies, an S: line\'s P: twin, a narrative a person merged', async () => {
  const w = await mk(); const T = w.mod.__test; eq((await F(w, 'GET', '/narratives?ns=aep')).status, 200);
  const N = db(w).prepare("INSERT INTO narratives(id,label,issues,n,first_ts,last_ts,status,muted) VALUES(?,?,?,3,?,?,'steady',0)"); N.run('nq9', 'Harbour levy hurts fishers', '["gastax"]', NOW - 20 * H, NOW - H); N.run('nq8', 'Levy is a city tax', '["gastax"]', NOW - 20 * H, NOW - H);
  const M = db(w).prepare("INSERT INTO narrative_merges(id,into_id,from_id,how,who,rule,clause,score,at,from_row,into_before) VALUES(?,?,?,?,?,'','','{}',?,'{}','{}')"); M.run('mg1', 'nq9', 'nq1', 'person', 'Anne', NOW - 2 * H); M.run('mg2', 'nq8', 'nq2', 'auto', 'auto', NOW - 2 * H);
  const ids = { 'M:101': media(101, 'Bay Herald | quay story', { also: [102, 103] }), 'S:201': social(201, 'bluesky | templated post', { also: [202] }), 'P:301': { k: 'actor', label: 'Harbour Watch on bluesky', url: 'https://bsky.app/profile/hw/post/1', item: 301, line: 'Harbour Watch | a post' },
    'N:nq1': { k: 'narrative', label: 'Fishers', item: 0, line: 'Fishers | claim: x' }, 'N:nq2': { k: 'narrative', label: 'City tax', item: 0, line: 'City tax | claim: y' } };
  const id = put(w, { evidence: ev(ids), sections: { summary: sec(T, LONG + 'Coverage folded copies of one quay story [M:101]. A templated post went round the bay [S:201]. Harbour Watch posted about it [P:301]. Fishers said the levy hurts them [N:nq1]. Others call it a city tax [N:nq2].') } });
  const c = (await view(w, id)).covers; const sorted = o => Object.keys(o).sort().reduce((a, k) => { a[k] = o[k].slice().sort(); return a; }, {});
  eq(sorted(c), { 'M:101': ['M:102', 'M:103'], 'N:nq1': ['N:nq9'], 'S:201': ['P:201', 'P:202', 'S:202'] }, 'an automatic merge covers nothing; a line with no copies is not listed');
});

await S.t('AW11 a replace draft remaps the corrections and says what it dropped', async () => {
  const w = await mk(); const T = w.mod.__test;
  // the remap itself, over two evidence maps
  const oldIds = { 'M:101': media(101, 'a', { also: [104] }), 'S:201': social(201, 'b'), 'P:301': { k: 'actor', item: 301 }, 'M:401': media(401, 'c', { also: [402] }), 'U:1': { k: 'upcoming', item: 9 } };
  const newIds = { 'M:105': media(105, 'a2', { also: [101] }), 'P:201': { k: 'actor', item: 201 }, 'P:301': { k: 'actor', item: 301 }, 'M:402': media(402, 'c2') };
  const at = 5; const pk = x => ({ by: 'Anne', at: x || at });
  const rv = { picks: { summary: { add: { 'M:101': pk(), 'S:201': pk(), 'P:301': pk(), 'M:401': pk(), 'N:nq1': pk(), 'U:1a2b3c4d': pk(), 'U:1': pk(), 'K:1': pk(), 'T:gastax': pk(), 'C:gastax': pk(), 'I:gastax': pk(), 'A:7': pk(), 'M:777': pk(), 'O:301': pk(), 'H:2': pk() }, remove: { 'S:999': pk() } } },
    marks: { 'words:0a0b0c0d': { kind: 'denwords', sec: 'summary', by: 'Anne', at }, 'A:7': { kind: 'check', sec: '', by: 'Anne', at }, 'empty:actors': { kind: 'empty', sec: 'actors', by: 'Anne', at }, 'empty:sources': { kind: 'empty', sec: 'sources', by: 'Anne', at } } };
  const x = T.denReviewRemap(rv, oldIds, newIds, new Set(['summary', 'actors', 'bottom']));
  // p72 fix (the review's W3): a stable U: id stays only while the new evidence holds it (else it follows its date, or is
  // named: tests/den-p72-fix-worker.mjs PF3); U:1a2b3c4d is in neither map, so it is named, not kept unchecked
  eq(Object.keys(x.review.picks.summary.add).sort(), ['M:105', 'M:402', 'M:777', 'N:nq1', 'P:201', 'P:301'].sort(), 'by item to the new id (a story now a copy in another fold, an S: row now its P: twin), N kept, a row not in either map waits');
  eq(Object.keys(x.review.picks.summary.remove), ['S:999']); eq(Object.keys(x.review.marks).sort(), ['A:7', 'empty:sources']);
  eq(x.dropped.map(d => (d.item || d.key)).sort(), ['A:7', 'C:gastax', 'H:2', 'I:gastax', 'K:1', 'O:301', 'T:gastax', 'U:1', 'U:1a2b3c4d', 'empty:actors', 'words:0a0b0c0d'].sort());
  ok(x.dropped.every(d => d.sec && typeof d.why === 'string' && d.why.length > 8), JSON.stringify(x.dropped));
  eq(x.dropped.find(d => d.key === 'A:7'), undefined, 'a strip check left out is kept'); ok(x.dropped.find(d => d.item === 'A:7'), 'an A: pick is dropped');
  // end to end: a draft, corrections, a replace draft
  await seedDay(w); model(w);
  const d1 = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(d1.status, 200, d1.text.slice(0, 300)); const b = d1.body.brief; eq(d1.body.review_dropped, [], 'a first draft drops nothing');
  const m = b.sections.summary.cites.find(c => /^M:/.test(c)), s = b.sections.summary.cites.find(c => /^S:/.test(c)); ok(m && s, JSON.stringify(b.sections.summary.cites));
  const r = await review(w, b.id, [{ op: 'add', sec: 'summary', item: m }, { op: 'add', sec: 'summary', item: 'T:gastax' }, { op: 'add', sec: 'summary', item: 'U:1' }, { op: 'add', sec: 'social', item: 'U:0a1b2c3d' }, { op: 'add', sec: 'summary', item: 'N:nq1' }, { op: 'remove', sec: 'social', item: s },
    { op: 'leave', key: 'words:0a0b0c0d', kind: 'denwords', sec: 'summary', note: 'kept' }, { op: 'leave', key: 'A:77', kind: 'check', sec: '', note: 'Too small to report' }]); eq(r.status, 200, r.text.slice(0, 200)); const rr = r.body.review_rev;
  const d2 = await F(w, 'POST', '/den/brief', { desk: 'aep_au', replace: true }); eq(d2.status, 200, d2.text.slice(0, 300));
  // p72 fix (W3): U:0a1b2c3d, a date neither draft's evidence holds, is named in review_dropped, no longer kept unchecked
  eq(d2.body.review_dropped.map(z => [z.sec, z.item || z.key]).sort(), [['social', 'U:0a1b2c3d'], ['summary', 'T:gastax'], ['summary', 'U:1'], ['summary', 'words:0a0b0c0d']].sort(), JSON.stringify(d2.body.review_dropped));
  const st = JSON.parse(rowOf(w, b.id).review); eq([Object.keys(st.picks.summary.add).sort(), Object.keys(st.picks.social.add || {}), Object.keys(st.picks.social.remove), Object.keys(st.marks)], [[m, 'N:nq1'].sort(), [], [s], ['A:77']]);
  eq(rowOf(w, b.id).review_rev, rr + 1, 'one compare-and-swap write after the draft\'s own');
  eq(logOf(w, b.id).filter(l => l.op === 'drop').map(l => [l.sec, l.item || l.key]).sort(), [['social', 'U:0a1b2c3d'], ['summary', 'T:gastax'], ['summary', 'U:1'], ['summary', 'words:0a0b0c0d']].sort(), 'each drop logged');
  eq(d2.body.brief.review.marks['A:77'].note, 'Too small to report', 'the answer carries the review as remapped');
});

const spike = (w, ratio, hot, ago) => db(w).prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,detected_ts) VALUES('aep','AEP','gastax','Gas taxation','high',?,2.9,?,5,?)").run(hot, ratio, NOW - ago * H).lastInsertRowid;

await S.t('AW12 filing: the left group, acknowledge left, acknowledged objects, each section\'s list in the log', async () => {
  const w = await mk(); const T = w.mod.__test; await F(w, 'GET', '/sentinel/alerts');
  const a1 = 'A:' + spike(w, 3.1, 9, 3), a2 = 'A:' + spike(w, 4.2, 12, 2);
  const ids = { 'M:501': media(501, 'Bay Herald | quay story'), 'S:601': social(601, 'bluesky | a post') };
  db(w).prepare("INSERT INTO den_marks(desk,item,mark,reason,mkey,by,at,section) VALUES('aep_au',501,'pin','','','Anne',?,'media')").run(NOW);
  const id = put(w, { evidence: ev(ids), sections: { summary: sec(T, LONG + 'Coverage stayed regional and calm through the window [M:501].'), media: sec(T, LONG) } });
  const m = await review(w, id, [{ op: 'leave', key: a1, kind: 'check', sec: '', note: 'Too small to report', fig: '9 stories in six hours, 3.1 times' }, { op: 'add', sec: 'summary', item: 'S:601' }, { op: 'remove', sec: 'summary', item: 'M:501' }]); eq(m.status, 200, m.text.slice(0, 200)); const markAt = m.body.review.marks[a1].at;
  const ask = await F(w, 'POST', '/den/brief/file', { id, revision: 1 }); eq([ask.status, ask.body.error], [409, 'uncited_signals'], ask.text.slice(0, 200));
  eq(ask.body.signals.map(s => s.key), [a2], 'the check not left is asked about'); eq(ask.body.left.length, 1); const L = ask.body.left[0];
  eq([L.key, L.title, L.by, L.at, L.note, L.fig_then], [a1, 'Sentinel spike: Gas taxation', 'Anne', markAt, 'Too small to report', '9 stories in six hours, 3.1 times']); eq([L.fig_now.hot, L.fig_now.ratio], [9, 3.1], 'the figure now beside the figure then');
  ok(/file anyway or go back/.test(ask.body.detail) && /left out with a reason/.test(ask.body.detail), ask.body.detail);
  const al = await F(w, 'POST', '/den/brief/file', { id, revision: 1, acknowledge: 'left' }); eq([al.status, al.body.signals.map(s => s.key), al.body.left.map(s => s.key)], [409, [a2], [a1]], 'acknowledge left files only when every open check is a left one');
  const f = await F(w, 'POST', '/den/brief/file', { id, revision: 1, acknowledge: true }); eq([f.status, f.body.brief.status], [200, 'filed'], f.text.slice(0, 200));
  const ack = f.body.acknowledged.slice().sort((x, y) => (x.key < y.key ? -1 : 1)); eq(ack.map(x => [x.key, x.how]), [[a1, 'marked'], [a2, 'at_filing']]);
  eq([ack[0].at, ack[0].fig], [markAt, '9 stories in six hours, 3.1 times']); ok(ack[1].at >= NOW && ack[1].fig && ack[1].fig.ratio === 4.2, JSON.stringify(ack[1]));
  ok(ack.every(x => !('by' in x) && !('note' in x)), 'who and the note stay in the review and the log');
  eq((await view(w, id)).acknowledged.map(x => x.key).sort(), [a1, a2].sort(), 'the view reads them');
  const lists = logOf(w, id).filter(l => l.op === 'filed'); eq(lists.map(l => [l.sec, l.item]), [['summary', 'S:601'], ['media', 'M:501']], 'cited, filed under it, added, minus removed, copied at filing');
  eq((await review(w, id, [{ op: 'add', sec: 'summary', item: 'S:9' }])).body.error, 'brief_filed', 'a filed brief takes no correction');
  // D2: every open check left out with a reason: acknowledge left files at once
  const id2 = put(w, { desk: 'aep_vic', evidence: ev(ids), sections: { summary: sec(T, LONG + 'A second and larger spike in gas taxation coverage was noted by several outlets [' + a2 + '].') } });
  eq((await review(w, id2, [{ op: 'leave', key: a1, kind: 'check', sec: '', note: 'Too small to report' }])).status, 200);
  const f2 = await F(w, 'POST', '/den/brief/file', { id: id2, revision: 1, acknowledge: 'left' }); eq([f2.status, f2.body.acknowledged.map(x => [x.key, x.how])], [200, [[a1, 'marked']]], f2.text.slice(0, 300));
  // an old list of keys reads as objects
  const id3 = put(w, { status: 'filed', sections: { summary: sec(T, LONG) } }); db(w).prepare('UPDATE den_briefs SET acknowledged=? WHERE id=?').run('["A:5","N:x"]', id3);
  eq((await view(w, id3)).acknowledged, [{ key: 'A:5', how: 'at_filing' }, { key: 'N:x', how: 'at_filing' }]);
});

await S.t('AW13 at filing a citation mark covers a check only in a sentence of four words of its own', async () => {
  const w = await mk(); const T = w.mod.__test; await F(w, 'GET', '/sentinel/alerts'); const a1 = 'A:' + spike(w, 3.1, 9, 3);
  const bare = put(w, { sections: { summary: sec(T, LONG + 'Spike noted [' + a1 + ']. The quay stayed calm.') } });
  const r = await F(w, 'POST', '/den/brief/file', { id: bare, revision: 1 }); eq([r.status, (r.body.signals || []).map(s => s.key)], [409, [a1]], 'a bare mark covers nothing: ' + r.text.slice(0, 200));
  const full = put(w, { desk: 'aep_vic', sections: { summary: sec(T, LONG + 'A spike in gas taxation coverage was noted [' + a1 + '].') } });
  const g = await F(w, 'POST', '/den/brief/file', { id: full, revision: 1 }); eq([g.status, g.body.acknowledged], [200, []], g.text.slice(0, 200));
});

S.done();
