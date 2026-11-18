/* Anne's Den build p72, the base every p72 lane builds on (BRIEF-P72 "Shared helpers"), against the worker module in this
 * process. No provider is contacted. Every sentence here is invented.
 *   PB1 denSentences splits as denCleanText always split (paragraphs on a blank line, sentences after a stop or a closing
 *       mark before a capital, a quote or a mark), but never after a title or a common abbreviation ("Dr.", "Mt.", "No.");
 *       denCleanText gives the same text, cites and flags it gave before
 *   PB2 denPlain strips citation marks and collapses white space; denFnv32 gives FNV-1a 32 bit as 8 hex digits
 *   PB3 a desk's flag switches: POST /den/desk/update keeps a boolean for each switchable kind, drops any other key or
 *       value, keeps them through a save that leaves them out, and a null puts a kind back to its default; denFlagOn reads
 *       them, else the acceptance run's defaults (Den words on; comparisons, unread channels, bare marks, ratings off)
 * Run: node --experimental-sqlite tests/den-p72-base-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p72, the base');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' } };
const mk = async () => workerEnv({ env: {}, keys: KEYS });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');

await S.t('PB1 one splitter for the check, the flags and the sentence keys', async () => {
  const w = await mk(); const T = w.mod.__test;
  const text = 'Harbour Watch rallied at the quay [M:1]. Residents said "Stop the export plan" [S:2]. The vote is due on 3 December [U:1].\n\nA second paragraph. It has two sentences [M:1].';
  eq(T.denSentences(text), [['Harbour Watch rallied at the quay [M:1].', 'Residents said "Stop the export plan" [S:2].', 'The vote is due on 3 December [U:1].'], ['A second paragraph.', 'It has two sentences [M:1].']]);
  const old = t => t.split(/\n\n+/).map(p => p.split(/(?<=[.!?\]])\s+(?=[A-Z"'\[])/));
  ['', 'One.', 'One. two. Three!', 'A [M:1]. "Quoted" next. (Aside) after.', 'x\n\n\n\ny. Z.'].forEach(t => eq(T.denSentences(t), old(t), JSON.stringify(t)));
  // p72 integration: a title or an abbreviation before a capital does not end a sentence, so a mark keeps its four words
  eq(T.denSentences('Coverage rose after a speech by Dr. Chalmers at the quay [A:1]. Mt. Isa voted. It ended at No. 5. Next.'), [['Coverage rose after a speech by Dr. Chalmers at the quay [A:1].', 'Mt. Isa voted.', 'It ended at No. 5.', 'Next.']]);
  const ids = new Map([['M:1', { line: 'Harbour Watch drew 40 people to the quay' }], ['S:2', { line: 'a post' }]]);
  const c = T.denCleanText('Harbour Watch drew 40 people [M:1]. Residents posted [S:2]. A third with no source.\n\nAnd 41 people came [M:1].', ids, [], 24);
  eq(c.text, 'Harbour Watch drew 40 people [M:1]. Residents posted [S:2]. A third with no source.\n\nAnd 41 people came [M:1].');
  eq([c.cites, c.uncited, c.unverified.map(u => u.figures)], [['M:1', 'S:2'], [], [['41']]]);   // a sentence with no mark is checked, not listed as a dropped citation
});

await S.t('PB2 a sentence\'s plain form and its key', async () => {
  const w = await mk(); const T = w.mod.__test;
  eq(T.denPlain('Harbour Watch rallied  at the quay [M:1][S:2] .'), 'Harbour Watch rallied at the quay.');
  eq([T.denFnv32(''), T.denFnv32('a'), T.denFnv32('foobar')], ['811c9dc5', 'e40c292c', 'bf9cf968']);
  ok(/^[0-9a-f]{8}$/.test(T.denFnv32('A sentence with an apostrophe’s mark')), 'any text gives 8 hex digits');
});

await S.t('PB3 a desk switches flag kinds on and off; unset kinds take the acceptance run\'s defaults', async () => {
  const w = await mk(); const T = w.mod.__test;
  const up = async options => { const r = await F(w, 'POST', '/den/desk/update', { id: 'aep_au', patch: { options } }); eq(r.status, 200, r.text.slice(0, 200)); return r.body.desk.options; };
  eq(Object.keys(T.DEN_FLAG_DEFAULTS).sort(), ['compare', 'denwords', 'mark', 'rating', 'unread']);
  const d0 = await T.deskGet(w.env, 'aep_au'); eq(['denwords', 'compare', 'unread', 'mark', 'rating'].map(k => T.denFlagOn(d0, k)), [true, false, false, false, false]);
  let o = await up({ flags: { compare: true, denwords: false, bogus: true, rating: 'yes' } }); eq(o.flags, { denwords: false, compare: true });
  o = await up({ title: 'AEP Daily Activist Activity Brief' }); eq(o.flags, { denwords: false, compare: true }, 'kept through a save that leaves them out');
  const d1 = await T.deskGet(w.env, 'aep_au'); eq([T.denFlagOn(d1, 'compare'), T.denFlagOn(d1, 'denwords'), T.denFlagOn(d1, 'unread')], [true, false, false]);
  o = await up({ flags: { denwords: null } }); eq(o.flags, { compare: true }, 'null puts a kind back to its default');
  o = await up({ flags: { compare: null } }); ok(!('flags' in o), 'nothing left, nothing stored: ' + JSON.stringify(o.flags));
  o = await up({ flags: ['compare'] }); ok(!('flags' in o), 'a list is not a set of switches');
});

S.done();
