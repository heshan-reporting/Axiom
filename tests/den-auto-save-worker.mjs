/* Anne's Den build p72, lane text (BRIEF-P72 "Text paths"), against the worker module in this process. No provider is
 * contacted: the model is a stub that writes from the evidence it is sent. Every outlet, account, address, person and
 * sentence here is invented. Each case fails on 2bf7f17 (the final p71 merged into p72, before this lane).
 *   AS1  Add a source: a save's sources become H:<n> evidence records (kind added, who, when; a social host labelled
 *        "<Platform> post", any other by its host; the address cleaned, her line plain text with handles and addresses
 *        struck); the same address twice keeps its id; a bad address or date, and more than forty, are refused in words
 *        and nothing is saved
 *   AS2  sources_remove: an H: source goes only while no section cites it (409 naming the sections, nothing saved); a
 *        save that drops the citation may remove it; n is never used again
 *   AS3  the H: figure rule: a figure in a sentence citing an H: source is checked against her line only when her line
 *        carries a figure; otherwise the citation stands for it
 *   AS4  the Source List and the documents print an H: source as "<Platform> post" or "<host> - <her line>", dated by
 *        her date, numbered with the rest; a redraft keeps her sources and the next n
 *   AS5  nosource (Keep without the citation): the sentence joins the section's uncited list and is carried by the
 *        existing rule; a bad shape is refused in words
 *   AS6  the exact merge of cited new rows: only the ids cited, through denWindowIds with their items in must and no
 *        PINNED prefix (a passing mention the evidence never sends is merged); a templated post rides on its line; an
 *        id that cannot be merged is refused in words (409 cannot_cite, the ids named, nothing saved), never struck
 *   AS7  a section written again reads review.picks: a removed id leaves its evidence and is struck if cited; an added
 *        id is a line it must cover (MUST COVER, never PINNED), a stored-only one (H:) given from the stored map; only
 *        the fresh ids its text cites, plus pinned rows, are merged into the stored map
 *   AS8  the section write is guarded: a save of another section during its model call does not lose it (one re-read,
 *        then the write); a change to its own section during the call is a 409 in words, nothing written
 *   AS9  stable upcoming ids: U: + FNV-1a 32 of date|event, the same across a redraft that adds an earlier date; two
 *        recorded dates with one label stay apart and keep their process
 *   AS10 Board rows carry pinned_by and pinned_at (the pin's den_marks by and at): stories, posts and actor posts
 *   AS11 a draft stores evidence.prev (the filed bottom line's day, or ''), evidence.unread (the CHANNELS line's not-read
 *        channels) and each section's model keys; a save keeps them; a section write refreshes its own; a brief started
 *        by hand has none (absent, never empty)
 *   AS12 the copy without DRAFT: format=html or md with nodraft=1 leaves the DRAFT line and the title's DRAFT out; without
 *        it the documents are as before
 * Run: node --experimental-sqlite tests/den-auto-save-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p72, lane text: sources, corrections and the section write');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, NOW = Date.now();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
let seq = 0;
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const news = o => Object.assign({ src: 'harbourgazette', title: 'Crossbench renews its call for a gas export tax ' + (++seq), body: 'The Senate will debate the gas export tax this week, campaigners said.', url: 'https://harbourgazette.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'harbourgazette', tier: 'regional', juris: 'au', reg: 1 } }, o);
const post = o => Object.assign({ src: 'x', title: 'x post', body: 'The gas export tax is overdue, residents of the quay say.', url: 'https://x.com/i/web/status/19' + String(++seq).padStart(12, '0'), ts: NOW - 3 * H, meta: { platform: 'x', issues: ['gastax'], id: 'p' + seq, eng: { likes: 40, replies: 6, reposts: 9 }, eng_at: NOW - H, score: 49, comments: 6, layers: [2] } }, o);
// a suburb feature tagged with the issue by a passing word in its body: the evidence never sends it unless it is in must
const passing = o => news(Object.assign({ title: 'A seaside suburb with a starry sky ' + (++seq), body: 'Locals love the quiet beach and the dunes. The old gas heater still warms the cottage on cold nights.', url: 'https://harbourgazette.example.com.au/suburb/' + seq }, o));
const idOf = (w, url) => w.env.MIND_DB.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id;
const rowOf = (w, id) => w.env.MIND_DB.db.prepare('SELECT * FROM den_briefs WHERE id=?').get(id);
const evOf = (w, id) => JSON.parse(rowOf(w, id).evidence || '{}');
const lineOf = (ev, id) => ev.split('\n').find(l => l.indexOf('[' + id + '] ') === 0) || '';
const isSection = b => !/"ratings":\{/.test(b.system);
const model = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, async (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content;
  const ids = k => (ev.match(new RegExp('^\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'gm')) || []).map(x => x.slice(1, -1));
  const j = await make(ev, ids, b, calls.length);
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const A = 'https://harbourgazette.example.com.au/a', B = 'https://harbourgazette.example.com.au/b';
const seedDay = async w => {
  await push(w, 'news', [news({ title: 'Harbour levy divides the Senate over the gas export tax', url: A, ts: NOW - 5 * H }), news({ title: 'Producers answer the gas export tax push', url: B, ts: NOW - 3 * H })]);
  await push(w, 'sig_thread', [post({ url: 'https://x.com/i/web/status/190000000000000001' })]);
};
const draft = async (w, make) => { const calls = model(w, make || ((ev, ids) => ({ sections: { summary: 'The harbour levy divided the Senate [M:' + idOf(w, A) + ']. Producers answered the push [M:' + idOf(w, B) + '].', bottom: 'Activity on the gas export tax is steady [M:' + idOf(w, A) + '].' }, ratings: {} })));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 300)); return { br: r.body.brief, calls }; };
const reviewOn = (w, id, review) => { try { w.env.MIND_DB.db.prepare("ALTER TABLE den_briefs ADD COLUMN review TEXT DEFAULT '{}'").run(); } catch (e) { if (!/duplicate column/i.test(String(e.message))) throw e; }
  w.env.MIND_DB.db.prepare('UPDATE den_briefs SET review=? WHERE id=?').run(JSON.stringify(review), id); };
const keysOf = (T, text) => Array.from(new Set([].concat(...T.denSentences(text)).map(T.denPlain).filter(Boolean).map(T.denFnv32)));
const FB = 'https://www.facebook.com/harbourwatchpage/posts/1234567890';
const QN = 'https://quaynews.example.com.au/story/rally';

await S.t('AS1 Add a source: H ids, their records, and the refusals', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: '' }); await seedDay(w);
  const h = (await F(w, 'POST', '/den/brief/save', { desk: 'aep_au' })).body.brief;
  const r = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: h.revision, sources: [
    { url: FB + '?fbclid=abc123', line: 'Harbour Watch called a rally at the quay, said @quayjo at https://quay.example.com.au/x and jo@quay.example.com.au', date: '2026-11-17' },
    { url: QN + '?utm_source=share&utm_medium=x', line: 'About 300 people marched to the quay' }] });
  eq(r.status, 200, r.text.slice(0, 300)); const ev = r.body.brief.evidence;
  eq([r.body.changed, r.body.added, r.body.brief.revision], [['sources'], [{ url: FB, id: 'H:1' }, { url: QN, id: 'H:2' }], h.revision + 1], 'two ids, in order, and a new revision');
  const h1 = ev['H:1'], h2 = ev['H:2'];
  eq([h1.k, h1.label, h1.url, h1.date, h1.by, h1.platform], ['added', 'Facebook post', FB, '2026-11-17', 'Analyst', 'facebook'], 'a social host is "<Platform> post": ' + JSON.stringify(h1));
  ok(Number(h1.at) >= NOW - 60000, 'when it was added');
  ok(/^Harbour Watch called a rally at the quay, said/.test(h1.line) && !/@|https?:|quay\.example/.test(h1.line), 'her line is plain text, handles and addresses struck: ' + h1.line);
  eq([h2.label, h2.url, h2.line], ['quaynews.example.com.au', QN, 'About 300 people marched to the quay'], 'any other host by its host, tracking struck');
  const st = evOf(w, h.id); eq([st.hnext, st.ids['H:1'].k, st.ids['H:1'].by, st.ids['H:2'].line], [3, 'added', 'Analyst', 'About 300 people marched to the quay'], 'stored with the next n');
  // the same address again keeps its id; a long line is cut at 200
  const again = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: h.revision + 1, sources: [{ url: QN + '?utm_campaign=y' }] }); eq([again.status, again.body.added, again.body.unchanged], [200, [{ url: QN, id: 'H:2' }], true], again.text.slice(0, 200));
  const long = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: h.revision + 1, sources: [{ url: 'https://quaynews.example.com.au/long', line: 'word '.repeat(80) }] }); eq(long.status, 200); ok(long.body.brief.evidence['H:3'].line.length <= 200, 'a line is at most 200 characters');
  const rev = long.body.brief.revision;
  const bad = [[{ url: 'javascript:alert(1)' }, /web address/], [{ url: 'https://quaynews.example.com.au/' + 'a'.repeat(520) }, /500 characters/], [{ url: QN + '/x', date: 'yesterday' }, /date/], [{ line: 'no address' }, /web address/], ['not a list', /list/]];
  for (const [s, rx] of bad) { const x = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: rev, sources: typeof s === 'string' ? s : [s], sections: { summary: 'Never saved.' } });
    eq([x.status, x.body.error], [400, 'bad_source'], JSON.stringify(s).slice(0, 60) + ': ' + x.text.slice(0, 200)); ok(rx.test(x.body.detail) && /Nothing was saved/.test(x.body.detail), 'in words: ' + x.body.detail); }
  const many = Array.from({ length: 38 }, (_, i) => ({ url: 'https://quaynews.example.com.au/many/' + i }));
  const over = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: rev, sources: many }); eq([over.status, over.body.error], [413, 'too_many_sources'], over.text.slice(0, 200)); ok(/40/.test(over.body.detail) && /Nothing was saved/.test(over.body.detail), over.body.detail);
  const fit = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: rev, sources: many.slice(0, 37) }); eq(fit.status, 200, 'forty in all is allowed'); eq(Object.keys(fit.body.brief.evidence).filter(k => /^H:/.test(k)).length, 40);
  eq(rowOf(w, h.id).revision, rev + 1, 'each refusal saved nothing');
});

await S.t('AS2 an H: source is removed only while no section cites it; n is never used again', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: '' }); await seedDay(w);
  const h = (await F(w, 'POST', '/den/brief/save', { desk: 'aep_au' })).body.brief;
  let r = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: h.revision, sources: [{ url: FB }, { url: QN, line: 'About 300 people marched to the quay' }] }); eq(r.status, 200);
  r = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: r.body.brief.revision, sections: { summary: 'About 300 people marched to the quay [H:2].', bottom: 'The march was the day\'s main event [H:2].' } }); eq([r.status, r.body.brief.sections.summary.cites], [200, ['H:2']], r.text.slice(0, 200));
  const rev = r.body.brief.revision;
  const no = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: rev, sources_remove: ['H:2'] });
  eq([no.status, no.body.error], [409, 'source_cited'], no.text.slice(0, 200)); ok(/"Executive Summary"/.test(no.body.detail) && /"Bottom Line"/.test(no.body.detail) && /Nothing was saved/.test(no.body.detail), 'names the sections: ' + no.body.detail);
  eq([rowOf(w, h.id).revision, !!evOf(w, h.id).ids['H:2']], [rev, true], 'nothing saved');
  const yes = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: rev, sections: { summary: 'People marched to the quay.', bottom: 'The march was the day\'s main event.' }, sources_remove: ['H:2', 'H:1'] });
  eq(yes.status, 200, yes.text.slice(0, 200)); ok(!yes.body.brief.evidence['H:2'] && !yes.body.brief.evidence['H:1'] && yes.body.changed.indexOf('sources') >= 0, 'the save that drops the citation removes it: ' + JSON.stringify(yes.body.changed));
  const next = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: yes.body.brief.revision, sources: [{ url: FB }] }); eq(next.body.added, [{ url: FB, id: 'H:3' }], 'n is never used again');
  const gone = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: next.body.brief.revision, sources_remove: ['H:2'] }); eq([gone.status, gone.body.unchanged], [200, true], 'a source already gone: nothing to do');
  const bad = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: next.body.brief.revision, sources_remove: ['M:5'] }); eq([bad.status, bad.body.error], [400, 'bad_source'], 'only H: sources are removed this way');
});

await S.t('AS3 a figure citing an H: source is checked against her line only when it carries one', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['H:1', { k: 'added', line: 'Harbour Watch called a rally at the quay' }], ['H:2', { k: 'added', line: 'About 300 people marched to the quay' }],
    ['M:7', { k: 'media', line: 'Harbour Gazette | 17 Nov 09:00 | A rally at the quay | Organisers said 250 people came' }]]);
  const c = T.denCleanText('Some 400 people rallied at the quay [H:1]. About 300 people marched [H:2]. About 500 people marched [H:2]. Organisers counted 400 at the quay [M:7][H:1]. Organisers counted 400 at the quay [M:7].', ids, [], 24);
  eq(c.unverified.map(u => u.sentence), ['About 500 people marched.', 'Organisers counted 400 at the quay.'], 'her line with no figure stands for the figure; with one, it is checked: ' + JSON.stringify(c.unverified));
  eq(c.cites.sort(), ['H:1', 'H:2', 'M:7']);
});

await S.t('AS4 the Source List and the documents print an H: source', async () => {
  const w = await mk(); await seedDay(w); const { br } = await draft(w); const a = 'M:' + idOf(w, A);
  let r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sources: [{ url: FB, date: '2026-11-17', line: 'Harbour Watch called the rally' }, { url: QN, line: 'About 300 people marched to the quay' }] });
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, sections: { summary: 'The harbour levy divided the Senate [' + a + ']. Harbour Watch called a rally at the quay [H:1]. About 300 people marched to the quay [H:2].' } });
  eq(r.status, 200, r.text.slice(0, 200)); const sl = r.body.brief.sourceList; const all = [].concat(...sl.map(g => g.items.map(i => Object.assign({ group: g.group }, i))));
  const by = id => all.find(i => i.id === id) || {};
  eq([by(a).n, by('H:1').n, by('H:2').n], [1, 2, 3], 'numbered in the order the text cites them, with the rest');
  eq([by('H:1').group, by('H:1').label, by('H:1').date, by('H:1').url], ['Social media', 'Facebook post', '17 November 2026', FB], 'a social host: its platform\'s post, never her words');
  eq([by('H:2').group, by('H:2').label, by('H:2').url], ['Traditional media', 'quaynews.example.com.au - About 300 people marched to the quay', QN], 'any other host: the host and her line');
  const md = (await F(w, 'GET', '/den/brief?id=' + br.id + '&format=md', null, 'read-key')).text, htm = (await F(w, 'GET', '/den/brief?id=' + br.id + '&format=html', null, 'read-key')).text;
  ok(md.indexOf('Harbour Watch called a rally at the quay [[2](' + FB + ')].') >= 0 && md.indexOf('marched to the quay [[3](' + QN + ')].') >= 0, 'the marks print their numbers: ' + md.slice(md.indexOf('## Executive'), md.indexOf('## Executive') + 400));
  ok(md.indexOf('[2] Facebook post, 17 November 2026 - ' + FB) >= 0 && md.indexOf('[3] quaynews.example.com.au - About 300 people marched to the quay - ' + QN) >= 0, 'and the list its entries: ' + md.slice(md.indexOf('## Source List')));
  ok(htm.indexOf('[3] quaynews.example.com.au - About 300 people marched to the quay - ') >= 0 && htm.indexOf('>[2]</a></sup>') >= 0, 'the html document too');
  ok(!/Harbour Watch called the rally/.test(md) && !/Harbour Watch called the rally/.test(htm), 'a social source\'s line is never printed');
  // a redraft keeps the sources she added, and an n is never given twice
  const re = await F(w, 'POST', '/den/brief', { desk: 'aep_au', replace: true }); eq(re.status, 200, re.text.slice(0, 200));
  ok(re.body.brief.evidence['H:1'] && re.body.brief.evidence['H:2'] && evOf(w, br.id).hnext === 3, 'kept through a redraft: ' + Object.keys(re.body.brief.evidence).filter(k => /^H:/.test(k)).join(','));
  const more = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: re.body.brief.revision, sources: [{ url: 'https://quaynews.example.com.au/more' }] }); eq(more.body.added, [{ url: 'https://quaynews.example.com.au/more', id: 'H:3' }]);
});

await S.t('AS5 nosource: a sentence kept without its citation joins uncited and is carried', async () => {
  const w = await mk(); await seedDay(w); const { br } = await draft(w); const a = 'M:' + idOf(w, A), b = 'M:' + idOf(w, B);
  const t1 = 'The harbour levy divided the Senate. Producers answered the push [' + b + '].';
  let r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: t1 }, nosource: { summary: ['The harbour levy divided the Senate.'] } });
  eq(r.status, 200, r.text.slice(0, 200)); eq(r.body.brief.sections.summary.uncited, ['The harbour levy divided the Senate.'], 'kept without its citation: flagged as needing a source');
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, sections: { summary: t1 + ' One more sentence.' } });
  eq(r.body.brief.sections.summary.uncited, ['The harbour levy divided the Senate.'], 'carried while it stands, word for word');
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, sections: { summary: 'The harbour levy divided the Senate [' + a + ']. One more sentence.' } });
  eq(r.body.brief.sections.summary.uncited, [], 'cleared once it is cited again');
  // a correction sent with no change to the words still lands, once
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, sections: { bottom: 'Activity is steady.' } });
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, nosource: { bottom: ['Activity is steady.', 'A sentence that is not there.'] } });
  eq([r.status, r.body.brief.sections.bottom.uncited, r.body.changed], [200, ['Activity is steady.'], ['bottom']], r.text.slice(0, 200));
  eq(r.body.not_kept, [{ section: 'bottom', sentence: 'A sentence that is not there.' }], 'a sentence that is not in the text is said, never dropped in silence (p72 integration)');
  // a sentence over 240 characters is kept too (p72 integration: it was cut before matching, so it never matched)
  const long = 'The harbour levy divided the Senate, with crossbench senators weighing the offer to share export revenue with the states while producers warned of falling supply and unions pressed for relief for manufacturers and the families who work in them across the regions this week.';
  ok(long.length > 240, 'the sentence runs to ' + long.length);
  r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: r.body.brief.revision, sections: { summary: long + ' Producers answered the push [' + b + '].' }, nosource: { summary: [long] } });
  eq(r.status, 200, r.text.slice(0, 200)); ok(r.body.brief.sections.summary.uncited.length === 1 && long.indexOf(r.body.brief.sections.summary.uncited[0]) === 0 && !r.body.not_kept, 'the long sentence is kept, stored cut: ' + JSON.stringify(r.body.brief.sections.summary.uncited));
  const rev = r.body.brief.revision;
  for (const n of [{ summary: 'one sentence' }, { nope: ['A sentence.'] }, ['summary'], { sources: ['A sentence.'] }]) { const x = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: rev, nosource: n });
    eq([x.status, x.body.error], [400, 'bad_nosource'], JSON.stringify(n)); ok(/Nothing was saved/.test(x.body.detail), x.body.detail); }
});

await S.t('AS6 the exact merge of cited new rows, and the refusal in words', async () => {
  const w = await mk(); await seedDay(w); const { br } = await draft(w); const a = 'M:' + idOf(w, A);
  const L1 = 'https://harbourgazette.example.com.au/late1', L2 = 'https://harbourgazette.example.com.au/late2', P1 = 'https://harbourgazette.example.com.au/suburb-p1';
  await push(w, 'news', [news({ title: 'A late story on the gas export tax', url: L1, ts: NOW - 0.5 * H }), news({ title: 'Another late story on the gas export tax', url: L2, ts: NOW - 0.4 * H }), passing({ url: P1, ts: NOW - 0.3 * H })]);
  const tp = [0, 1, 2].map(i => post({ body: 'I just signed the open letter asking the minister to stop the harbour gas export plan now', url: 'https://x.com/i/web/status/1977000000000' + i, ts: NOW - (0.9 - i * 0.1) * H }));
  await push(w, 'sig_thread', tp);
  const l1 = 'M:' + idOf(w, L1), l2 = 'M:' + idOf(w, L2), p1 = 'M:' + idOf(w, P1), t2 = 'S:' + idOf(w, tp[1].url);
  const before = Object.keys(evOf(w, br.id).ids).length;
  const r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: 'The harbour levy divided the Senate [' + a + ']. A late story followed [' + l1 + ']. A suburb piece mentioned the tax [' + p1 + ']. An open letter circulated [' + t2 + '].' } });
  eq(r.status, 200, r.text.slice(0, 300)); eq(r.body.brief.sections.summary.cites.slice().sort(), [a, l1, p1, t2].sort(), 'every id cited is merged, a passing mention included');
  const st = evOf(w, br.id).ids; eq(Object.keys(st).length, before + 3, 'only the ids cited: ' + Object.keys(st).filter(k => !evOf(w, br.id).ids[k]).join(','));
  ok(!st[l2], 'a new row nobody cited is not merged');
  ok(st[p1] && !/^PINNED/.test(st[p1].line) && /seaside suburb/.test(st[p1].line), 'the passing row reached the evidence through must, with no PINNED prefix: ' + (st[p1] || {}).line);
  ok(st[t2] && /3 near-identical posts/.test(st[t2].line) && st[t2].item === idOf(w, tp[1].url), 'a templated post is cited by its own id, riding on its line: ' + JSON.stringify(st[t2] || {}).slice(0, 200));
  const rev = r.body.brief.revision; const text = r.body.brief.sections.summary.text;
  const no = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: rev, sections: { summary: text + ' And an invented one [M:31337]. And another [S:42424242].' } });
  eq([no.status, no.body.error, no.body.ids], [409, 'cannot_cite', ['M:31337', 'S:42424242']], no.text.slice(0, 300)); ok(/\[M:31337\]/.test(no.body.detail) && /\[S:42424242\]/.test(no.body.detail) && /Nothing was saved/.test(no.body.detail), 'refused in words: ' + no.body.detail);
  eq([rowOf(w, br.id).revision, JSON.parse(rowOf(w, br.id).sections).summary.text], [rev, text], 'nothing saved, nothing struck');
});

await S.t('AS7 a section written again reads the picks; it merges only what it cites, and pinned rows', async () => {
  const w = await mk(); await seedDay(w); const P1 = 'https://harbourgazette.example.com.au/suburb-p7'; await push(w, 'news', [passing({ url: P1, ts: NOW - 4 * H })]);
  const { br, calls } = await draft(w); const a = 'M:' + idOf(w, A), b = 'M:' + idOf(w, B), p1 = 'M:' + idOf(w, P1);
  ok(!lineOf(calls[0].messages[0].content, p1), 'the passing row is not in the draft\'s evidence');
  let r = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sources: [{ url: QN, line: 'About 300 people marched to the quay' }] }); eq(r.status, 200);
  const LT = 'https://harbourgazette.example.com.au/late7', PN = 'https://harbourgazette.example.com.au/pinned7';
  await push(w, 'news', [news({ title: 'A late story on the gas export tax', url: LT, ts: NOW - 0.5 * H }), news({ title: 'A pinned late story on the gas export tax', url: PN, ts: NOW - 0.4 * H })]);
  const lt = 'M:' + idOf(w, LT), pn = 'M:' + idOf(w, PN); eq((await F(w, 'POST', '/den/pin', { desk: 'aep_au', item: idOf(w, PN) })).status, 200);
  const at = NOW - 60000; reviewOn(w, br.id, { picks: { bottom: { add: { [p1]: { by: 'Analyst', at }, 'H:1': { by: 'Analyst', at } }, remove: { [a]: { by: 'Analyst', at } } }, summary: { remove: { [b]: { by: 'Analyst', at } } } }, marks: {} });
  const c2 = model(w, () => ({ sections: { bottom: 'The harbour levy divided the Senate [' + a + ']. A suburb piece mentioned the tax [' + p1 + ']. About 300 people marched to the quay [H:1].' } }));
  const s = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: r.body.brief.revision }); eq(s.status, 200, s.text.slice(0, 300));
  const ev = c2[0].messages[0].content;
  ok(ev.indexOf('[' + a + ']') < 0, 'a removed id is left out of the section\'s evidence, wherever it stood');
  ok(/^MUST COVER \| /.test(lineOf(ev, p1).slice(p1.length + 3)) && !/PINNED/.test(lineOf(ev, p1)) && /seaside suburb/.test(lineOf(ev, p1)), 'an added row is a line it must cover, sent through must, never PINNED: ' + lineOf(ev, p1).slice(0, 120));
  ok(/^\[H:1\] MUST COVER \| quaynews\.example\.com\.au \| About 300 people marched to the quay/.test(lineOf(ev, 'H:1')), 'an added source the window does not hold is given from the stored map: ' + lineOf(ev, 'H:1'));
  ok(!!lineOf(ev, b) && !/MUST COVER/.test(lineOf(ev, b)), 'another section\'s removal does not touch this one');
  ok(/PINNED \| /.test(lineOf(ev, pn)) && !/MUST COVER/.test(lineOf(ev, lt)), 'pins keep their word');
  ok(/MUST COVER must be covered/.test(c2[0].system), 'the rule names the new mark: ' + (c2[0].system.match(/^- A line marked[^\n]*/m) || [''])[0]);
  const bt = s.body.brief.sections.bottom; eq([bt.cites.slice().sort(), bt.uncited, bt.unverified], [['H:1', p1].sort(), ['The harbour levy divided the Senate.'], []], 'a removed id the model still cites is struck through the uncited path');
  const st = evOf(w, br.id).ids; ok(st[p1] && st[pn] && !st[lt], 'merged: the fresh ids it cites and the pinned row, never the rest: ' + JSON.stringify([!!st[p1], !!st[pn], !!st[lt]]));
  ok(st['H:1'] && st[a], 'the stored map keeps what it held');
  eq(s.body.brief.sections.bottom.model, keysOf(w.mod.__test, bt.text), 'its own model keys');
});

await S.t('AS8 the section write is guarded: another section saved meanwhile is kept; its own changed is a 409 in words', async () => {
  const w = await mk(); await seedDay(w); const { br } = await draft(w); const a = 'M:' + idOf(w, A);
  model(w, async () => { const cur = rowOf(w, br.id); const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: cur.revision, sections: { summary: 'A person wrote the summary while the section was written [' + a + '].' } }); eq(sv.status, 200, sv.text.slice(0, 200));
    return { sections: { bottom: 'Written again, shorter [' + a + '].' } }; });
  const s = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: br.revision }); eq(s.status, 200, s.text.slice(0, 300));
  eq([s.body.brief.revision, s.body.brief.sections.summary.text, s.body.brief.sections.bottom.text, s.body.brief.sections.summary.edited], [br.revision + 2, 'A person wrote the summary while the section was written [' + a + '].', 'Written again, shorter [' + a + '].', true], 'both kept');
  const rev = s.body.brief.revision;
  model(w, async () => { const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: rowOf(w, br.id).revision, sections: { bottom: 'Her own bottom line [' + a + '].' } }); eq(sv.status, 200, sv.text.slice(0, 200));
    return { sections: { bottom: 'The model\'s bottom line [' + a + '].' } }; });
  const x = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: rev });
  eq([x.status, x.body.error], [409, 'section_changed'], x.text.slice(0, 300)); ok(/while it was being written/.test(x.body.detail) && /Nothing was saved/.test(x.body.detail), 'in words: ' + x.body.detail);
  const now = rowOf(w, br.id); eq([now.revision, JSON.parse(now.sections).bottom.text], [rev + 1, 'Her own bottom line [' + a + '].'], 'her words stand');
  ok(x.body.brief && x.body.brief.revision === rev + 1, 'the brief as it stands comes back with the refusal');
});

await S.t('AS9 stable upcoming ids across a redraft', async () => {
  const w = await mk(); const T = w.mod.__test; await seedDay(w);
  const d = n => { const t = new Date(NOW + n * 86400000 + 11 * H); return t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()]; };
  await push(w, 'news', [news({ title: 'Campaigners plan a rally on ' + d(20) + ' against the gas export tax', url: 'https://harbourgazette.example.com.au/rally' })]);
  const { br, calls } = await draft(w); const up = (await F(w, 'GET', '/den/board?desk=aep_au')).body.upcoming; const rally = up.find(u => u.event === 'rally'); ok(rally, JSON.stringify(up));
  const rid = 'U:' + T.denFnv32(rally.date + '|' + rally.event); ok(/^U:[0-9a-f]{8}$/.test(rid));
  ok(br.evidence[rid] && br.evidence[rid].label === rally.date + ' rally', 'the id is the date and the event: ' + Object.keys(br.evidence).filter(k => /^U:/.test(k)).join(','));
  ok(lineOf(calls[0].messages[0].content, rid), 'and the model reads it');
  await push(w, 'news', [news({ title: 'Harbour Watch will hold a vote on ' + d(10) + ' on the gas export tax campaign', url: 'https://harbourgazette.example.com.au/vote' })]);
  const re = await F(w, 'POST', '/den/brief', { desk: 'aep_au', replace: true }); eq(re.status, 200, re.text.slice(0, 200));
  const us = Object.keys(re.body.brief.evidence).filter(k => /^U:/.test(k)); ok(us.length === 2 && us.indexOf(rid) >= 0, 'an earlier date does not move it: ' + us.join(','));
  // two recorded dates with one label stay apart, each keeping its process (p71 K3)
  const desk = await T.deskGet(w.env, 'aep_au'); const board = await T.denBoard(w.env, desk, { keepRows: true });
  board.upcoming = ['p1', 'p2'].map(p => ({ date: '2026-12-01', weekday: 'Tuesday', event: 'hearing', what: 'Inquiry into the gas export tax - ' + p, item: 0, url: 'https://parliament.example.com.au/' + p, yearWritten: true, recorded: true, process: p }));
  const ev = await T.denEvidence(w.env, desk, board, null, [], { memory: false }); const two = Array.from(ev.ids.keys()).filter(k => /^U:/.test(k));
  eq(two, ['U:' + T.denFnv32('2026-12-01|hearing|pp1'), 'U:' + T.denFnv32('2026-12-01|hearing|pp2')], 'apart, each by its own record'); eq(two.map(k => ev.ids.get(k).process), ['p1', 'p2']);
  // p72 integration (the worker review): whatever order the board gives them, each keeps its id
  board.upcoming = board.upcoming.slice().reverse(); const ev2 = await T.denEvidence(w.env, desk, board, null, [], { memory: false });
  const byP = m => Array.from(m.ids.entries()).filter(([k]) => /^U:/.test(k)).map(([k, v]) => v.process + '=' + k).sort();
  eq(byP(ev2), byP(ev), 'the same id for the same hearing in either order');
});

await S.t('AS10 Board rows carry pinned_by and pinned_at', async () => {
  const w = await mk(); await seedDay(w);
  const acct = (await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'x', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' })).body.watch;
  await push(w, 'sig_thread', [post({ url: 'https://x.com/i/web/status/190000000000000077', body: 'Our position on the gas export tax, in full.', meta: { platform: 'x', issues: ['gastax'], id: 'pa', watch: acct.id, actor: { id: acct.id, name: 'Harbour Watch', kind: 'org' }, eng: { likes: 90 }, score: 90 } })]);
  const ids = [idOf(w, A), idOf(w, 'https://x.com/i/web/status/190000000000000001'), idOf(w, 'https://x.com/i/web/status/190000000000000077')]; const t0 = Date.now();
  for (const item of ids) eq((await F(w, 'POST', '/den/pin', { desk: 'aep_au', item })).status, 200);
  const bd = (await F(w, 'GET', '/den/board?desk=aep_au', null, 'read-key')).body; const m = bd.media.find(x => x.id === ids[0]), s = bd.social.find(x => x.id === ids[1]), p = bd.actors.find(x => x.id === ids[2]);
  ok(m && s && p, 'all three on the board');
  [m, s, p].forEach(x => { eq(x.pinned_by, 'Analyst', JSON.stringify(x).slice(0, 120)); ok(x.pinned_at >= t0 - 1000 && x.pinned_at <= Date.now(), 'when: ' + x.pinned_at); });
  ok(bd.media.filter(x => !x.pinned).every(x => !('pinned_by' in x)), 'a row nobody pinned carries neither');
});

await S.t('AS11 evidence.prev, evidence.unread and the model keys', async () => {
  const w = await mk(); const T = w.mod.__test; await seedDay(w); await F(w, 'GET', '/den/desks');
  const day = (await F(w, 'GET', '/den/board?desk=aep_au')).body.window.day; const yday = new Date(Date.parse(day + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10);
  w.env.MIND_DB.db.prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES('bprev','aep_au',?,24,?,?,'filed',2,?,'{}','{}','','Analyst',?,?)")
    .run(yday, NOW - 48 * H, NOW - 24 * H, JSON.stringify({ bottom: { text: 'Activity on the levy was moderate.' } }), NOW - 24 * H, NOW - 24 * H);
  const { br, calls } = await draft(w); const st = evOf(w, br.id); const sent = calls[0].messages[0].content;
  ok(/^THE LAST FILED BRIEF'S BOTTOM LINE \(/m.test(sent), 'the evidence carried it'); eq(st.prev, yday, 'prev: the day of the filed bottom line');
  const notRead = ((sent.match(/^CHANNELS READ IN THIS WINDOW: [^\n]*; not read: ([^\n]*)\.$/m) || [])[1] || '').split(', ').filter(Boolean);
  ok(notRead.indexOf('Facebook') >= 0, sent.match(/^CHANNELS[^\n]*/m)[0]); eq(st.unread, notRead, 'unread: the CHANNELS line\'s not-read channels');
  const secs = JSON.parse(rowOf(w, br.id).sections); eq([secs.summary.model, secs.bottom.model], [keysOf(T, secs.summary.text), keysOf(T, secs.bottom.text)], 'each section\'s model keys');
  eq(br.sections.summary.model.length, 2);
  const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: secs.summary.text + ' Anne added a sentence.' } }); eq(sv.status, 200);
  eq(sv.body.brief.sections.summary.model, secs.summary.model, 'a save keeps model as it is');
  model(w, () => ({ sections: { bottom: 'Written again, in one sentence [M:' + idOf(w, A) + '].' } }));
  const sw = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: sv.body.brief.revision }); eq(sw.status, 200, sw.text.slice(0, 200));
  eq([sw.body.brief.sections.bottom.model, sw.body.brief.sections.summary.model], [keysOf(T, 'Written again, in one sentence [M:' + idOf(w, A) + '].'), secs.summary.model], 'a section write refreshes its own, only');
  eq([evOf(w, br.id).prev, evOf(w, br.id).unread], [yday, notRead], 'and leaves the brief\'s');
  const w2 = await mk(); await seedDay(w2); const d2 = await draft(w2); eq(evOf(w2, d2.br.id).prev, '', 'no filed bottom line: empty, and stored');
  const w3 = await mk({ ANTHROPIC_API_KEY: '' }); await seedDay(w3); const h = (await F(w3, 'POST', '/den/brief/save', { desk: 'aep_au' })).body.brief; const e3 = evOf(w3, h.id);
  ok(!('prev' in e3) && !('unread' in e3), 'a brief started by hand has neither: absent, never empty');
  const h2 = await F(w3, 'POST', '/den/brief/save', { id: h.id, revision: h.revision, sections: { summary: 'Written by hand.' } }); ok(!('model' in h2.body.brief.sections.summary), 'and no sentence of it is the model\'s');
});

await S.t('AS12 the copy without DRAFT', async () => {
  const w = await mk(); await seedDay(w); const { br } = await draft(w);
  const get = async q => (await F(w, 'GET', '/den/brief?id=' + br.id + q, null, 'read-key')).text;
  const [h0, h1, m0, m1] = [await get('&format=html'), await get('&format=html&nodraft=1'), await get('&format=md'), await get('&format=md&nodraft=1')];
  ok(/<p class="draft">DRAFT<\/p>/.test(h0) && / - DRAFT<\/title>/.test(h0) && /^DRAFT$/m.test(m0), 'without the option, as before');
  ok(!/DRAFT/.test(h1) && !/class="draft"/.test(h1) && !/^DRAFT$/m.test(m1), 'with it, no DRAFT anywhere');
  eq([h1, m1], [h0.replace(' - DRAFT</title>', '</title>').replace('<p class="draft">DRAFT</p>', ''), m0.replace('\nDRAFT\n', '')], 'and nothing else changes');
  const sl = await get('&format=slack&nodraft=1'); ok(/\(draft\)/.test(sl), 'Slack keeps its own marker');
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
