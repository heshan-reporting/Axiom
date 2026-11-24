/* Anne's Den build p72, the worker fixes after the p72 review (W1-W7), against the worker module in this process. No
 * provider is contacted: the model is a stub. Every outlet, person, address and sentence here is invented. Each case
 * fails on 87c0df6 (claude/den-p72 before the fixes).
 *   PF1 (W1) a guest or open-access reader is given no person's name in the Board, desk and brief answers: pins, set-asides,
 *       the desks (their last change, their mutes, the day's brief), a brief's writer, filer, sections and added sources
 *       (the JSON view, prev=1, the list of briefs, its history); "morning draft" stays; a staff key reads every name
 *   PF2 (W2) filing is guarded on review_rev: a check taken back while the filing read the strip is asked about again
 *       (the usual 409), never filed as left; a correction that leaves the answer as it was files with the fresh review;
 *       a review that keeps moving gives up after three tries with review_busy in words
 *   PF3 (W3) a tied upcoming entry's id rests on its earliest telling (first), which a fuller, newer story never moves and
 *       the order the stories come in never changes; a replace draft's remap follows a U: pick the new evidence does not
 *       hold to the one entry with its date, record, row or address, and names the rest in review_dropped
 *   PF4 (W4) the 200-mark limit counts the marks shown (a flag there, or a page kind's); hidden marks are kept, never
 *       counted, and past 400 stored the oldest hidden ones of a worker kind go
 *   PF5 (W5) a save that only keeps sentences without their citation changes no words, so the section keeps its edited,
 *       by and at, and Rewrite this section is not refused in that person's name
 *   PF6 (W6) a section id of __proto__, constructor or prototype is refused; a stored review's __proto__ key is read as
 *       nothing; a correction never writes onto Object or its prototype
 *   PF7 (W7) a kept sentence, a note and her line are cut to 2,000 characters before any pattern runs
 * Run: node --experimental-sqlite tests/den-p72-fix-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p72, the worker fixes after review (W1-W7)');
const KEYS = { 'full-key': { n: 'Wilhelmina', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'other-key': { n: 'Bartholomew', r: 'full' } };
const GUEST = { AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-key-1234': { n: 'Tester', r: 'read' } }) };
const mk = async env => { const w = await workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, GUEST, env || {}), keys: KEYS }); const d = await w.call('GET', '/den/desks', null, 'full-key'); if (d.status !== 200) throw new Error('desks: ' + d.text.slice(0, 200)); return w; };
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const db = w => w.env.MIND_DB.db;
const H = 3600000, NOW = Date.now();
let seq = 0, dn = 0;
const NAMES = /Wilhelmina|Bartholomew/;
const marksIn = t => Array.from(new Set((String(t || '').match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).map(x => x.slice(1, -1))));
const sec = (T, text, o) => Object.assign({ text, cites: marksIn(text), uncited: [], unverified: [], trimmed: [], edited: false, by: 'model', model: T.denSentences(text).flat().map(s => String(s).trim()).filter(Boolean).map(x => T.denFnv32(T.denPlain(x))) }, o || {});
const put = (w, o) => { o = o || {}; const id = 'bfix' + (++dn); const day = '2026-10-' + String(dn).padStart(2, '0');
  db(w).prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,'',?,?,?)")
    .run(id, o.desk || 'aep_au', day, 24, NOW - 24 * H, NOW, o.status || 'draft', o.revision || 1, JSON.stringify(o.sections || {}), JSON.stringify(o.ratings || {}), JSON.stringify(o.evidence || { ids: {} }), o.by || 'Wilhelmina', NOW, NOW); return id; };
const rowOf = (w, id) => db(w).prepare('SELECT * FROM den_briefs WHERE id=?').get(id);
const review = (w, id, ops, k) => F(w, 'POST', '/den/brief/review', { id, ops }, k);
const ev = ids => ({ ids, label: '24 hours to 9am' });
const media = (item, line, o) => Object.assign({ k: 'media', label: 'Bay Herald - Harbour story ' + item, url: 'https://bayherald.example.com.au/story-' + item, gated: 0, item, line }, o || {});
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const story = o => Object.assign({ src: 'bayherald', title: 'Crowd at the quay as the gas export tax vote nears ' + (++seq), body: 'Residents gathered at the quay as the Senate vote on the gas export tax neared, organisers said.', url: 'https://bayherald.example.com.au/news/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'bayherald', tier: 'regional', juris: 'au', reg: 1 } }, o || {});
const model = w => { w.answer(/api\.anthropic\.com/, () => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'Residents of the bay gathered at the quay as the harbour levy vote neared, and the press followed it.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } })); };
const spike = (w, ratio, hot, ago) => db(w).prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,detected_ts) VALUES('aep','AEP','gastax','Gas taxation','high',?,2.9,?,5,?)").run(hot, ratio, NOW - ago * H).lastInsertRowid;
// a statement hook: fn runs just before the first statement whose SQL matches re is prepared (a write landing mid-request)
const before = (w, re, fn) => { const d1 = w.env.MIND_DB; const orig = d1.prepare.bind(d1); d1.prepare = sql => { if (re.test(sql)) fn(); return orig(sql); }; return () => { d1.prepare = orig; }; };
const LONG = 'Residents of the bay gathered at the quay through the afternoon as the vote on the harbour levy neared, and the regional press followed each step of the campaign closely. Organisers asked the council for a public meeting before the vote, and local traders put posters in their windows along the foreshore. ';

await S.t('PF1 (W1) a guest reads no person\'s name in the Board, desk and brief answers; a staff key reads them all', async () => {
  const w = await mk(); const T = w.mod.__test;
  // the desk's last change and a mute, by a person
  eq((await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { options: { title: 'Harbour levy daily' } } })).status, 200);
  eq((await F(w, 'POST', '/den/mute', { desk: 'aep_au', kind: 'domain', value: 'noisy.example.com' })).status, 200);
  // a Board row pinned and one set aside, by two people
  await push(w, 'news', [story(), story({ src: 'coastledger', url: 'https://coastledger.example.com.au/news/' + (++seq), title: 'Fishers weigh the windfall tax on gas exports', meta: { issues: ['gastax'], source: 'coastledger' } })]);
  const b0 = (await F(w, 'GET', '/den/board?desk=aep_au')).body; ok(b0.media.length >= 2, 'two stories on the Board: ' + JSON.stringify(b0.counts));
  eq((await F(w, 'POST', '/den/pin', { desk: 'aep_au', item: b0.media[0].id })).status, 200);
  eq((await F(w, 'POST', '/den/aside', { desk: 'aep_au', item: b0.media[1].id, reason: 'not about the levy' }, 'other-key')).status, 200);
  // a brief written by a person, a section edited by another, a source added, filed by the second; and a morning draft's
  const ids = { 'M:101': media(101, 'Bay Herald | quay story'), 'H:1': { k: 'added', label: 'bayherald.example.com.au', url: 'https://bayherald.example.com.au/added', gated: 0, item: 0, line: 'Her own line about the quay', by: 'Wilhelmina', at: NOW } };
  const id = put(w, { status: 'filed', evidence: ev(ids), sections: { summary: sec(T, LONG + 'The quay stayed calm into the evening [M:101].', { edited: true, by: 'Bartholomew', at: NOW }), bottom: sec(T, LONG + 'Her own source said the same [H:1].') } });
  db(w).prepare('UPDATE den_briefs SET filed_by=?, filed_at=? WHERE id=?').run('Bartholomew', NOW, id);
  db(w).prepare('INSERT INTO den_brief_revisions(brief,revision,sections,ratings,by,note,at) VALUES(?,?,?,?,?,?,?)').run(id, 1, rowOf(w, id).sections, '{}', 'Wilhelmina', 'edited: summary', NOW);
  const auto = put(w, { by: 'morning draft', sections: { summary: sec(T, LONG) } });
  const today = put(w, { desk: 'aep_vic', by: 'Bartholomew', sections: { summary: sec(T, LONG) } }); db(w).prepare('UPDATE den_briefs SET day=? WHERE id=?').run(new Date(NOW + 10 * H).toISOString().slice(0, 10), today);
  const day = rowOf(w, today).day;
  const reads = ['/den/board?desk=aep_au', '/den/board?desk=aep_au&missed=1', '/den/desks', '/den/desks?day=' + day, '/den/brief?id=' + id, '/den/brief?desk=aep_au&prev=1&day=2999-01-01', '/den/briefs?desk=aep_au', '/den/brief/history?id=' + id, '/den/brief/history?id=' + id + '&rev=1'];
  for (const p of reads) {
    const s = await F(w, 'GET', p); eq(s.status, 200, p + ': ' + s.text.slice(0, 160)); ok(NAMES.test(s.text), 'a staff key reads the names on ' + p);
    for (const k of ['guest-key-1234']) { const g = await F(w, 'GET', p, null, k); eq(g.status, 200, p + ' (' + k + '): ' + g.text.slice(0, 160)); ok(!NAMES.test(g.text), 'no name on ' + p + ' for a guest: ' + (g.text.match(new RegExp('.{0,60}(' + NAMES.source + ').{0,20}')) || [''])[0]); }
  }
  const g = (await F(w, 'GET', '/den/brief?id=' + id, null, 'guest-key-1234')).body.brief;
  eq([g.by, g.filed_by, g.sections.summary.by, g.evidence['H:1'].by, g.evidence['H:1'].line], ['', '', '', '', 'Her own line about the quay'], 'blanked, never dropped; what is not a name stays');
  const gb = (await F(w, 'GET', '/den/board?desk=aep_au', null, 'guest-key-1234')).body; const pin = gb.media.find(m => m.pinned);
  eq([pin.pinned_by, typeof pin.pinned_at, gb.aside[0].by, gb.aside[0].reason], ['', 'number', '', 'not about the levy']);
  const gd = (await F(w, 'GET', '/den/desks?day=' + day, null, 'guest-key-1234')).body.desks; const da = gd.find(d => d.id === 'aep_au'), dv = gd.find(d => d.id === 'aep_vic');
  eq([da.updated_by, da.options.mutes[0].by, da.options.mutes[0].value, dv.today.by], ['', '', 'noisy.example.com', '']);
  eq((await F(w, 'GET', '/den/brief?id=' + auto, null, 'guest-key-1234')).body.brief.by, 'morning draft', 'the morning run\'s own name stays');
  // open access, where it reads the Den at all (STUDIO_PUBLIC_READ=1 with AXIOM_PUBLIC), is held to the same rule
  const wp = await mk({ AXIOM_PUBLIC: JSON.stringify({ role: 'read' }), STUDIO_PUBLIC_READ: '1' }); const idp = put(wp, { sections: { summary: sec(T, LONG, { edited: true, by: 'Bartholomew' }) } });
  const pb = await wp.call('GET', '/den/brief?id=' + idp, null, null); if (pb.status === 200) ok(!NAMES.test(pb.text), 'open access reads no name: ' + pb.text.slice(0, 120));
  ok(T.denNoNames({ a: [{ by: 'X', pinned_by: 'Y', n: 1 }], by: 'morning draft', who: 'Senator Example' }).who === 'Senator Example', 'a public actor\'s name (who) is not a team member\'s and stays');
});

await S.t('PF2 (W2) filing is guarded on review_rev: a check taken back meanwhile is asked about again', async () => {
  const w = await mk(); const T = w.mod.__test; await F(w, 'GET', '/sentinel/alerts');
  const a1 = 'A:' + spike(w, 3.1, 9, 3);
  const body = () => ({ summary: sec(T, LONG + 'Coverage stayed regional and calm through the window.') });
  // taken back between the filing's read and its write: the usual 409, the brief not filed
  const id = put(w, { sections: body() });
  eq((await review(w, id, [{ op: 'leave', key: a1, kind: 'check', sec: '', note: 'Too small to report' }])).status, 200);
  let off = before(w, /SET status='filed'/, () => { off(); db(w).prepare("UPDATE den_briefs SET review='{\"picks\":{},\"marks\":{}}', review_rev=review_rev+1 WHERE id=?").run(id); });
  const r = await F(w, 'POST', '/den/brief/file', { id, revision: 1, acknowledge: 'left' }); off();
  eq([r.status, r.body.error, (r.body.signals || []).map(s => s.key), (r.body.left || []).length], [409, 'uncited_signals', [a1], 0], r.text.slice(0, 300));
  eq([rowOf(w, id).status, rowOf(w, id).acknowledged == null || rowOf(w, id).acknowledged === '' || rowOf(w, id).acknowledged === '[]'], ['draft', true], 'nothing filed');
  // a correction meanwhile that leaves the answer as it was: filed, with the fresh review
  const id2 = put(w, { desk: 'aep_vic', sections: body() });
  eq((await review(w, id2, [{ op: 'leave', key: a1, kind: 'check', sec: '', note: 'Too small to report' }])).status, 200);
  off = before(w, /SET status='filed'/, () => { off(); const rv = JSON.parse(rowOf(w, id2).review); rv.marks['empty:media'] = { kind: 'empty', sec: 'media', by: 'Bartholomew', at: NOW }; db(w).prepare('UPDATE den_briefs SET review=?, review_rev=review_rev+1 WHERE id=?').run(JSON.stringify(rv), id2); });
  const f = await F(w, 'POST', '/den/brief/file', { id: id2, revision: 1, acknowledge: 'left' }); off();
  eq([f.status, (f.body.acknowledged || []).map(x => [x.key, x.how])], [200, [[a1, 'marked']]], f.text.slice(0, 300)); eq(rowOf(w, id2).status, 'filed');
  // the review keeps moving: three tries, then review_busy in words, nothing filed
  const id3 = put(w, { desk: 'mca_au', sections: body() }); let n = 0;
  const d1 = w.env.MIND_DB, orig = d1.prepare.bind(d1); d1.prepare = sql => { if (/SET status='filed'/.test(sql)) { n++; db(w).prepare('UPDATE den_briefs SET review_rev=review_rev+1 WHERE id=?').run(id3); } return orig(sql); };
  const busy = await F(w, 'POST', '/den/brief/file', { id: id3, revision: 1, acknowledge: true }); d1.prepare = orig;
  eq([busy.status, busy.body.error, n, rowOf(w, id3).status], [409, 'review_busy', 3, 'draft'], busy.text.slice(0, 200)); ok(/Nothing was saved/.test(busy.body.detail), busy.body.detail);
});

await S.t('PF3 (W3) a tied upcoming entry keeps its id when a fuller story arrives; the remap follows or names a U: pick', async () => {
  const w = await mk(); const T = w.mod.__test; const MON16 = Date.parse('2026-11-16T01:00:00Z');
  const row = (id, title) => ({ id, kind: 'news', title, body: '', url: 'https://harbourwire.example.com.au/' + id, meta: {} });
  const sea = row(80, 'Seaview farmers hold a vigil every Tuesday and Friday.'), pt = row(81, 'Pointville farmers hold a vigil every Tuesday and Friday.');
  const fuller = row(88, 'Pointville farmers and Harbour Watch hold a vigil every Tuesday and Friday outside the Point office in Pointville.');
  const dupOf = list => { const c = {}; list.forEach(u => { const b = u.date + '|' + u.event; c[b] = (c[b] || 0) + 1; }); return new Set(Object.keys(c).filter(b => c[b] > 1)); };   // as denUpDup
  const idsOf = list => { const seen = new Set(), dup = dupOf(list); return list.map(u => [u.item, T.denUpId(u, seen, dup)]).sort((a, b) => a[0] - b[0]).map(x => x[1]); };
  const before2 = T.denUpcoming([sea, pt], MON16), after3 = T.denUpcoming([fuller, sea, pt], MON16), other = T.denUpcoming([pt, sea, fuller], MON16);
  eq(after3.map(u => [u.item, u.first]).sort((a, b) => a[0] - b[0]), [[80, 80], [88, 81]], 'the fuller story speaks for Pointville (item); its earliest telling stays (first)');
  eq(other.map(u => [u.item, u.first]).sort((a, b) => a[0] - b[0]), [[80, 80], [88, 81]], 'in any order');
  const pid = idsOf(before2)[1]; eq(idsOf(after3).sort(), idsOf(before2).sort(), 'both ids unchanged by the fuller story'); eq(pid, 'U:' + T.denFnv32('2026-11-17|vigil|i81'));
  // the remap: a pick the new evidence does not hold follows its date when the new draft tells it once, else is named
  const L = '2026-12-03 vote', up = (item, o) => Object.assign({ k: 'upcoming', label: L, url: 'https://harbourwire.example.com.au/' + item, item }, o || {});
  const oldIds = { 'U:0000aaaa': up(70), 'U:0000bbbb': up(0, { label: '2026-12-09 hearing', url: '', process: 'proc_x' }), 'U:0000cccc': up(75, { label: '2026-12-01 rally' }), 'U:0000dddd': up(77, { label: '2026-12-05 forum', url: 'https://harbourwire.example.com.au/forum' }), 'U:0000eeee': up(79, { label: '2026-12-07 picket', url: '' }) };
  const newIds = { 'U:1111aaaa': up(70), 'U:1111abab': up(71), 'U:1111bbbb': up(0, { label: '2026-12-09 hearing', url: '', process: 'proc_x' }), 'U:1111dddd': up(78, { label: '2026-12-05 forum', url: 'https://harbourwire.example.com.au/forum' }), 'U:1111eee1': up(90, { label: '2026-12-07 picket', url: '' }), 'U:1111eee2': up(91, { label: '2026-12-07 picket', url: '' }), 'U:1111ffff': up(99, { label: '2026-12-11 march' }) };
  const pk = { by: 'Wilhelmina', at: 5 }; const rv = { picks: { summary: { add: { 'U:0000aaaa': pk, 'U:0000bbbb': pk, 'U:0000cccc': pk, 'U:0000dddd': pk, 'U:0000eeee': pk, 'U:1111ffff': pk, 'U:9999abcd': pk } } }, marks: {} };
  const x = T.denReviewRemap(rv, oldIds, newIds, new Set(['summary']));
  eq(Object.keys(x.review.picks.summary.add).sort(), ['U:1111aaaa', 'U:1111bbbb', 'U:1111dddd', 'U:1111ffff'], 'by row, by record, by address; one the new evidence holds stays');
  eq(x.dropped.map(d => d.item).sort(), ['U:0000cccc', 'U:0000eeee', 'U:9999abcd'], 'gone, told twice now, never held: each named');
  ok(x.dropped.every(d => d.sec === 'summary' && /date/.test(d.why)), JSON.stringify(x.dropped)); ok(/more than one entry/.test(x.dropped.find(d => d.item === 'U:0000eeee').why));
});

await S.t('PF4 (W4) the mark limit counts the marks shown; hidden marks are kept, then bounded', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG) } });
  const hidden = (from, n) => Array.from({ length: n }, (_, i) => ({ op: 'leave', key: 'words:' + (from + i).toString(16).padStart(8, '0'), kind: 'denwords', sec: 'summary' }));
  eq((await review(w, id, hidden(0, 200))).status, 200);
  const r = await review(w, id, [{ op: 'leave', key: 'empty:media', kind: 'empty', sec: 'media' }]); eq(r.status, 200, '200 hidden marks fill nothing: ' + r.text.slice(0, 200));
  eq(Object.keys(JSON.parse(rowOf(w, id).review).marks).length, 201, 'the hidden ones are kept');
  const page = Array.from({ length: 199 }, (_, i) => ({ op: 'leave', key: 'pin:' + (1000 + i), kind: 'pinned', sec: 'summary' }));
  eq((await review(w, id, page)).status, 200, '200 shown');
  const over = await review(w, id, [{ op: 'leave', key: 'pin:5000', kind: 'pinned', sec: 'summary' }]); eq([over.status, over.body.error], [413, 'review_limit'], over.text.slice(0, 200)); ok(/this would make 201/.test(over.body.detail), over.body.detail);
  eq((await review(w, id, hidden(500, 150))).status, 200);
  const st = JSON.parse(rowOf(w, id).review).marks; eq(Object.keys(st).length, 400, 'past 400 stored, the oldest hidden ones go');
  eq(Object.keys(st).filter(k => /^pin:|^empty:/.test(k)).length, 200, 'never a shown one');
});

await S.t('PF5 (W5) keeping a sentence without its citation leaves the section as it was', async () => {
  const w = await mk(); const T = w.mod.__test; model(w);
  const said = 'The council has not said when it will decide on the levy.';
  const id = put(w, { sections: { summary: sec(T, LONG + said, { at: 1234 }) } });
  const r = await F(w, 'POST', '/den/brief/save', { id, revision: 1, nosource: { summary: [said] } }); eq(r.status, 200, r.text.slice(0, 200));
  const s = JSON.parse(rowOf(w, id).sections).summary; eq([s.edited, s.by, s.at, s.uncited], [false, 'model', 1234, [said]]);
  ok(Array.isArray(s.model) && s.model.length > 0, 'the model keys stay');
  const re = await F(w, 'POST', '/den/brief/section', { id, revision: rowOf(w, id).revision, section: 'summary' }); ok(re.body.error !== 'edited_section', 'Rewrite this section is not refused: ' + re.text.slice(0, 200));
  // a save that changes the words still marks it edited, by that person
  const id2 = put(w, { desk: 'aep_vic', sections: { summary: sec(T, LONG + said) } });
  eq((await F(w, 'POST', '/den/brief/save', { id: id2, revision: 1, sections: { summary: LONG + 'The council will decide next month.' } })).status, 200);
  const s2 = JSON.parse(rowOf(w, id2).sections).summary; eq([s2.edited, s2.by], [true, 'Wilhelmina']);
});

await S.t('PF6 (W6) prototype names are never a section, a review key or a write onto Object', async () => {
  const w = await mk(); const T = w.mod.__test;
  const desk = (await F(w, 'GET', '/den/desks')).body.desks.find(d => d.id === 'aep_au');
  const secs = desk.sections.concat([{ id: '__proto__', kind: 'summary', title: 'Proto' }, { id: 'constructor', kind: 'summary', title: 'Builder' }, { id: 'prototype', kind: 'summary', title: 'Model' }]);
  const u = await F(w, 'POST', '/den/desk/update', { id: 'aep_au', revision: desk.revision, patch: { sections: secs } }); eq(u.status, 200, u.text.slice(0, 200));
  eq(u.body.desk.sections.filter(s => ['__proto__', 'constructor', 'prototype'].indexOf(s.id) >= 0), [], 'refused as section ids');
  const id = put(w, { sections: { summary: sec(T, LONG) } });
  const r = await review(w, id, [{ op: 'add', sec: 'constructor', item: 'M:1' }]); eq(r.status, 400, r.text.slice(0, 200));
  ok(Object.add === undefined && Object.prototype.add === undefined && Object.remove === undefined, 'nothing written onto Object');
  const j = T.denReviewJ('{"picks":{"__proto__":{"add":{"M:1":{"by":"x","at":1}}},"summary":{"add":{"__proto__":{"by":"x","at":1},"M:2":{"by":"x","at":1}}}},"marks":{"__proto__":{"kind":"empty"}}}');
  eq([Object.getPrototypeOf(j.picks) === Object.prototype, Object.getPrototypeOf(j.marks) === Object.prototype, Object.keys(j.picks), Object.keys(j.picks.summary.add), Object.getPrototypeOf(j.picks.summary.add) === Object.prototype], [true, true, ['summary'], ['M:2'], true]);
});

await S.t('PF7 (W7) long input is cut before the patterns run', async () => {
  const w = await mk(); const T = w.mod.__test;
  const id = put(w, { sections: { summary: sec(T, LONG) } });
  const long = ' '.repeat(90000) + 'x';   // about two seconds of denPlain on 87c0df6
  let t = Date.now(); const r = await F(w, 'POST', '/den/brief/save', { id, revision: 1, nosource: { summary: [long] } }); const ms = Date.now() - t;
  eq(r.status, 200, r.text.slice(0, 200)); ok(ms < 600, 'a 90,000-character sentence is cut before denPlain runs: ' + ms + ' ms');
  eq(JSON.parse(rowOf(w, id).sections).summary.uncited, [], 'nothing kept from it');
  t = Date.now(); const n = T.denReviewNote('Too small @' + 'a'.repeat(5000) + ' to report'); ok(Date.now() - t < 200, 'a note'); eq(n.length <= 200, true);
  eq(T.denReviewNote('x'.repeat(2100) + ' @handle'), 'x'.repeat(200), 'what lies past the first 2,000 characters is never read');
  const s = T.denSourceIn({ url: 'https://bayherald.example.com.au/a', line: 'Her line ' + 'y'.repeat(2100) + ' https://elsewhere.example.com/x' }); eq(s.line, ('Her line ' + 'y'.repeat(2100)).slice(0, 200), 'her line likewise');
});

S.done();
