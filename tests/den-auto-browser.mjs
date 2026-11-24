/* Anne's Den build p72, lane P2 (flags): Check before you send in the workbench (spec v3 Part B with Part D's words, UX-SPEC
 * s.4.5, s.6.3, s.8.3, s.10, s.12.3; docs/den-flags.js). On the fixture's invented harbour-levy world, a brief is stored
 * with every flag kind: the worker's (a dropped citation, a figure not in its source, a figure with no source, a cut
 * quotation, a bare source number, a word readers won't know, a comparison, an unread platform, a contradicted rating) and
 * the page's (strip checks, a must-mention story, empty sections). Every kind with each of its fixes through its route;
 * Leave it and Put it back; the "Left as it is" fold; one count in the panel, the eyebrow, the outline, the foot and the
 * Board's columns after every fix; Go to the first landing each kind; auto-advance and Skip for now; Undo; a failing mark
 * and a failing text fix said and put back; a read key; a filed brief's audit; the why lines and their fold; the filing
 * dialog asking about left checks; the support check (a p71 view shows nothing new); axe at 1366, 1440 and 1920.
 * Every sentence is invented. Run with the sandbox off: node --experimental-sqlite tests/den-auto-browser.mjs */
import fs from 'node:fs';
import { world, open, t, ok, eq, txt, tab, finish, CARD } from './den-fixture.mjs';

console.log('den-auto-browser harness (Check before you send: every flag kind, its fixes, the one count)');
const w = await world(); const T = w.mod.__test; const db = w.env.MIND_DB.db;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const d0 = await w.F('POST', '/den/brief', { desk: 'aep_au' }); if (d0.status !== 200) throw new Error('draft: ' + d0.text.slice(0, 200));
const BID = d0.body.brief.id; const EV0 = JSON.parse(db.prepare('SELECT evidence FROM den_briefs WHERE id=?').get(BID).evidence);
const GATED = Object.keys(EV0.ids).find(k => /^M:/.test(k) && EV0.ids[k].gated) || 'M:3';
await w.F('POST', '/den/desk/update', { id: 'aep_au', patch: { options: { flags: { denwords: true, compare: true, unread: true, mark: true, rating: true } } } });
const PIN = 5; { const r = await w.F('POST', '/den/pin', { desk: 'aep_au', item: PIN }); if (r.status !== 200) throw new Error('pin: ' + r.text.slice(0, 200)); }

// the invented brief: one sentence for each worker kind
const S = {
  lead: 'Harbour groups kept the levy in the news through the window and regional outlets carried it [M:1].',
  drop: 'A local campaigner is said to be organising the rally.', fig: 'Organisers said 40 boats joined the flotilla on the harbour [M:1].', bare: 'Turnout was 75 people by noon.',
  trim: 'The Point Post quoted a fisher: "We will not stand by while a levy written far away takes our living" [' + GATED + '].', mark: 'Seen too [M:1].',
  words: 'Posts in the rows we saw came mostly from residents of the bay [S:9].', cmp: 'Opposition to the levy remains strong across the bay [S:9].',
  unread: 'Campaigners on Bluesky shared the flyer for the rally [S:9].', bottom: 'The harbour levy fight stayed local through the window [M:1].', posture: 'Keep watching the harbour groups through the week ahead.'
};
const marksIn = t => Array.from(new Set((String(t || '').match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).map(x => x.slice(1, -1))));
const sec = (text, lists) => Object.assign({ text, cites: marksIn(text), uncited: [], unverified: [], trimmed: [], edited: false, by: 'model', model: T.denSentences(text).flat().map(x => String(x).trim()).filter(Boolean).map(x => T.denFnv32(T.denPlain(x))) }, lists || {});
const SECTIONS = () => ({
  summary: sec([S.lead, S.drop, S.fig, S.bare].join(' '), { uncited: [S.drop], unverified: [{ sentence: T.denPlain(S.fig), figures: ['40'] }, { sentence: T.denPlain(S.bare), figures: ['75'], bare: true }] }),
  media: sec([S.trim, S.mark].join(' '), { trimmed: ['We will not stand by while a levy written far away takes our living'] }),
  social: sec(S.words), momentum: sec(S.cmp), risks: sec(S.unread), bottom: sec(S.bottom), posture: sec(S.posture), narratives: sec(''), actors: sec(''), sentiment: sec('')
});
let REV = 1;
/** The day's brief as it is stored, every kind in it, no review; the revision moves on so an open page reads it afresh. */
const craft = (o) => { o = o || {}; REV += 1; const ev = JSON.parse(JSON.stringify(EV0)); ev.prev = ''; ev.unread = ['bluesky'];
  ev.ids['I:gastax'] = { k: 'measure', label: 'Gas taxation: above its usual volume', text: 'Gas taxation ran at 3.1 times its usual volume: 10 posts, stories and comments in this window', sub: '10 in the window, 3.1 times', line: 'Gas taxation ran at 3.1 times its usual volume: 10 posts, stories and comments in this window' };
  const secs = Object.assign(SECTIONS(), o.sections || {});
  db.prepare("UPDATE den_briefs SET sections=?, evidence=?, ratings=?, review='{}', review_rev=0, revision=?, status='draft', filed_by=NULL, filed_at=NULL, acknowledged=NULL WHERE id=?")
    .run(JSON.stringify(secs), JSON.stringify(ev), JSON.stringify({ momentum: { level: 'Moderate', trend: 'Stable' } }), REV, BID); };
const view = async k => (await w.F('GET', '/den/brief?id=' + BID, null, k)).body.brief;

const P = '#den-root .den-checks';
const chipN = p => p.$eval(P + ' .den-checks-head .den-chip', e => +e.getAttribute('data-count'));
const posts = (p, rx) => p.served.filter(x => /^POST /.test(x) && rx.test(x));
/** The one count everywhere it is drawn: the panel, the foot, the outline's chips added up, the open section's eyebrow, and its outline chip. */
async function counts(p) {
  const panel = await chipN(p); const foot = await p.$eval('#den-root .den-foot [data-count]', e => +e.getAttribute('data-count')).catch(() => -1);
  const outline = await p.$$eval('#den-root .den-outline .den-out .den-chip', a => a.reduce((n, x) => n + (+((/^(\d+) to check$/.exec(x.textContent.trim()) || [0, 0])[1])), 0));
  const eyebrow = await p.evaluate(() => { const s = Array.from(document.querySelectorAll('#den-root .den-sec[data-section]')).find(x => !x.hidden); const c = s && s.querySelector('.den-eyebrow .den-chip.warn'); return c ? +((/^(\d+) to check$/.exec(c.textContent.trim()) || [0, -9])[1]) : 0; });
  const openOut = await p.evaluate(() => { const b = document.querySelector('#den-root .den-out[aria-current="true"] .den-chip'); const m = b && /^(\d+) to check$/.exec(b.textContent.trim()); return m ? +m[1] : 0; });
  return { panel, foot, outline, eyebrow, openOut };
}
const oneCount = async (p, n, m) => { const c = await counts(p); eq([c.panel, c.foot, c.outline, c.eyebrow], [n, n === 0 ? 0 : n, n, c.openOut], (m || 'one count') + ': ' + JSON.stringify(c)); return c; };
const boardCount = async p => { await tab(p, 'today'); await p.waitForSelector(CARD('media')); await sleep(300);
  const n = await p.$$eval('.den-board .den-col-meta .den-chip', a => a.reduce((s, x) => s + (+((/^(\d+) to check$/.exec(x.textContent.trim()) || [0, 0])[1])), 0)); await tab(p, 'brief'); return n; };
async function openBrief(k, o) {
  const p = await open(w, k || 'full-key', o); await p.waitForSelector(CARD('media')); await tab(p, 'brief'); await p.waitForSelector(P + ' .den-checks-head');
  await p.waitForFunction(() => !document.querySelector('#den-root .den-checks-alerts'), null, { timeout: 15000 }); await sleep(200); return p;
}
const showAll = async p => { const b = p.locator(P + ' .den-fl-all'); if (await b.count()) await b.click(); for (const g of await p.locator(P + ' .den-fl-gt[aria-expanded="false"]').all()) await g.click(); };
const item = (p, key) => p.locator(P + ' [data-fl-item="' + key + '"]');
const itemOf = async (p, kind, n) => { await showAll(p); const keys = await p.$$eval(P + ' [data-fl-item][data-kind="' + kind + '"]', a => a.map(x => x.getAttribute('data-fl-item'))); return keys[n || 0]; };
const openItem = async (p, key) => { await sleep(300); await showAll(p);   // after a fix the next item opens by itself: let it, then press only a closed one
  const it = item(p, key); if ((await it.locator('.den-fl-t').getAttribute('aria-expanded')) !== 'true') await it.locator('.den-fl-t').click(); await it.locator('.den-fl-body').waitFor(); return it; };
const fx = async (p, key, name) => { const it = await openItem(p, key); await it.getByRole('button', { name, exact: true }).click(); return it; };
const active = p => p.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, fx: a.getAttribute('data-fx') || '', cls: a.className || '', item: (a.closest('[data-fl-item]') || {}).getAttribute ? a.closest('[data-fl-item]').getAttribute('data-fl-item') : '', text: (a.textContent || '').trim().slice(0, 80), sec: a.closest('.den-sec') ? a.closest('.den-sec').getAttribute('data-section') : '' } : null; });
const ta = (p, s) => p.locator('#den-root .den-sec[data-section="' + s + '"] textarea');
const stored = async s => ((await view()).sections[s] || {}).text || '';
const waitN = async (p, n) => p.waitForFunction(n => { const c = document.querySelector('#den-root .den-checks .den-checks-head .den-chip'); return c && +c.getAttribute('data-count') === n; }, n, { timeout: 10000 });
const said = p => p.$eval(P + ' [role="status"]', e => e.textContent.trim());

craft();
const V = await view(); const K = {}; V.flags.forEach(f => { K[f.kind] = K[f.kind] || f.key; });
await t('the stored brief raises every worker kind (the world is what the cases below rely on)', async () => {
  eq(Object.keys(K).sort(), ['compare', 'denwords', 'dropped', 'figure', 'figure_bare', 'mark', 'rating', 'trimmed', 'unread'], JSON.stringify(V.flags.map(f => f.kind)));
});

await t('every kind is listed with its words, in brief order, and one count stands in the panel, the eyebrow, the outline, the foot and the Board', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); ok(n >= 16, 'every kind is counted: ' + n); await oneCount(p, n, 'on open');
    eq(await boardCount(p), n, 'the Board\'s columns count the same');
    eq([await p.$eval('#den-tab-brief .den-tab-n', e => +e.getAttribute('data-count')), await p.getAttribute('#den-tab-brief', 'aria-description')], [n, n + ' to check'], 'the Brief tab\'s badge, said in aria-description');
    eq(await p.$eval('#den-tab-brief', e => e.getAttribute('aria-label') || ''), '', 'the tab\'s name stays its word (the badge is aria-hidden)');
    await showAll(p); const kinds = await p.$$eval(P + ' [data-fl-item]', a => a.map(x => x.getAttribute('data-kind')));
    for (const k of ['dropped', 'figure', 'figure_bare', 'trimmed', 'mark', 'denwords', 'compare', 'unread', 'rating', 'check', 'pinned', 'empty']) ok(kinds.indexOf(k) >= 0, k + ' is listed: ' + kinds.join(','));
    eq(kinds.slice(0, 3), ['dropped', 'figure', 'figure_bare'], 'brief order: the summary\'s sentences first, in their order');
    const words = await txt(p, P);
    for (const w0 of ['Check before you send', 'A sentence that lost its source', 'A figure not found in its source', 'A figure with no source', 'A paywalled quote cut to 30 words', 'A source number with no sentence', 'A word readers won\'t know', 'A comparison with nothing to compare', 'Names a platform that wasn\'t read today', 'A rating today\'s coverage doesn\'t support', 'A must-mention story the report doesn\'t mention', 'Nothing written under Key Narratives', 'A spike the report doesn\'t mention']) ok(words.indexOf(w0) >= 0, 'says "' + w0 + '": ' + words.slice(0, 300));
    ok(/The Den checks sources, figures, quotes and alerts\. Whether a claim is fair is your call\./.test(words), 'the panel\'s honest sentence');
    ok(!/\b(flag|flags|evidence|rows?|cards?|strip|cite|cited|citation|pinned)\b/i.test(words.replace(/Posts in the rows we saw[^.]*\./g, '').replace(/rows/g, (m, i, s) => /readers won/.test(s.slice(Math.max(0, i - 200), i)) ? '' : m)), 'no Den word in the panel\'s own words: ' + words.match(/\b(flag|flags|evidence|rows?|cards?|strip|cite|cited|citation|pinned)\b/i));
    const lab = await p.locator(P + ' [data-fl-item]').first().locator('.den-fl-t').getAttribute('aria-label'); ok(new RegExp('^1 of ' + n + ': A sentence that lost its source, Executive Summary$').test(lab), 'the item\'s name: ' + lab);
    eq(await p.getAttribute(P + ' .den-checks-list', 'role'), 'region'); eq(await p.getAttribute(P + ' .den-checks-list', 'aria-label'), 'Things to check, ' + n);
    // the marks in the reading text: the sentence by its key, the word picked out, "To check:" said in words
    const flag = p.locator('#den-root .den-sec[data-section="summary"] .den-flag[data-flag-keys~="' + K.dropped + '"]'); eq(await flag.locator('.w').textContent(), 'To check:');
    ok(await p.locator('#den-root .den-sec[data-section="social"] mark.den-fw[data-flag-keys="' + K.denwords + '"]').count() === 1, 'the word is marked inside its sentence');
    eq(p.errors, []);
  } finally { await p.context().close(); }
});

await t('Go to the first lands each kind where the landing table says, focus on its usual fix; Skip for now walks on and keeps the count', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); await p.click(P + ' .den-fl-first'); await sleep(250);
    let a = await active(p); eq([a.item, a.fx], [K.dropped, 'source'], 'focus on the first item\'s usual fix: ' + JSON.stringify(a));
    ok(/^1 of \d+: A sentence that lost its source, Executive Summary/.test(await said(p)), 'said: ' + await said(p));
    const lit = () => p.evaluate(() => { const e = document.querySelector('#den-root .den-fl-on'); return e ? { tag: e.tagName, keys: e.getAttribute('data-flag-keys') || '', check: e.getAttribute('data-check') || '', rating: e.getAttribute('data-rating') || '', sec: (e.closest('[data-section]') || { getAttribute: () => '' }).getAttribute('data-section'), ev: e.getAttribute('data-ev') || '', cls: e.className } : null; });
    const seen = {};
    for (let i = 0; i < n; i++) {
      const it = await p.evaluate(() => { const o = document.querySelector('#den-root .den-checks .den-fl.open'); return o ? { key: o.getAttribute('data-fl-item'), kind: o.getAttribute('data-kind') } : null; }); ok(it, 'an item is open at step ' + i);
      const l = await lit(); ok(l, 'something is lit for ' + JSON.stringify(it));
      if (['dropped', 'figure', 'figure_bare', 'trimmed', 'mark', 'denwords', 'compare', 'unread'].indexOf(it.kind) >= 0) ok(l.keys.split(' ').indexOf(it.key) >= 0, it.kind + ' lands on its sentence (or its word): ' + JSON.stringify(l));
      if (it.kind === 'denwords') eq(l.tag, 'MARK', 'the word marked');
      if (it.kind === 'figure' || it.kind === 'figure_bare') eq(l.tag, 'MARK', 'the figure marked');
      if (it.kind === 'check') eq(l.check, it.key, 'a check lands on its card in the pane');
      if (it.kind === 'rating') eq([l.tag, l.rating], ['SELECT', 'momentum'], 'a rating on its own select');
      if (it.kind === 'empty') eq(l.tag, 'TEXTAREA', 'an empty section on its editor');
      if (it.kind === 'pinned') ok(l.ev === 'M:' + PIN || /den-docbody/.test(l.cls), 'a must-mention story on its card, else its section: ' + JSON.stringify(l));
      seen[it.kind] = (seen[it.kind] || 0) + 1;
      a = await active(p); eq(a.item, it.key, 'focus stays in the open item: ' + JSON.stringify(a));
      if (i < n - 1) { await p.locator(P + ' .den-fl.open .den-fl-skip').click(); await sleep(200); eq(await chipN(p), n, 'Skip for now keeps the count'); }
    }
    eq(Object.keys(seen).length, 12, 'every kind was landed: ' + JSON.stringify(seen));
    eq(posts(p, /brief\/(save|review)/).length, 0, 'walking writes nothing');
  } finally { await p.context().close(); }
});

await t('a sentence that lost its source: Delete the sentence (Undo puts it back), Choose a source (the pane, then Use here and a save), Edit the sentence', async () => {
  craft(); let p = await openBrief();
  try {
    const n = await chipN(p); await fx(p, K.dropped, 'Delete the sentence'); await p.waitForSelector(P + ' .den-checks-done[data-undo="text"]', { timeout: 10000 });
    ok(!(await stored('summary')).includes(S.drop), 'saved without the sentence'); eq(posts(p, /brief\/save/).length, 1, 'through the save route'); eq(await item(p, K.dropped).count(), 0, 'its item is gone');
    await sleep(300); const n1 = await chipN(p); ok(n1 < n, 'the count went down: ' + n1); await oneCount(p, n1, 'after Delete (the save checks the section again)');
    await p.waitForFunction(() => !!(document.activeElement && document.activeElement.getAttribute('data-fx')), null, { timeout: 3000 }).catch(() => {}); const a = await active(p); ok(a.item && a.item !== K.dropped && a.fx, 'the next item opened by itself, focus on its usual fix: ' + JSON.stringify(a));
    ok(/Deleted the sentence\. \d+ to check\. Next: /.test(await said(p)), 'said: ' + await said(p));
    ok(/\u2713 Deleted the sentence\./.test(await txt(p, P + ' .den-checks-done')), 'the done line with Undo');
    await p.locator(P + ' .den-undo-fl').click(); await p.waitForFunction(() => /Undone/.test((document.querySelector('#den-root .den-checks [role="status"]') || {}).textContent || ''), null, { timeout: 10000 });
    ok((await stored('summary')).includes(S.drop), 'Undo saved the words back, through the revision check'); eq(posts(p, /brief\/save/).length, 2); await sleep(300); await oneCount(p, await chipN(p), 'after Undo');
    await p.context().close();
    craft(); p = await openBrief(); await fx(p, K.dropped, 'Choose a source'); await sleep(300);
    let x = await active(p); ok(/den-evcard/.test(x.cls), 'the pane takes the focus: ' + JSON.stringify(x));
    const caret = await ta(p, 'summary').evaluate(e => [e.selectionStart, e.value.slice(e.selectionStart - 6, e.selectionStart + 1)]); eq(caret[1], ' rally.', 'the caret before the sentence\'s final stop');
    await p.locator(':focus').click(); await sleep(150); await ta(p, 'summary').press('Escape');
    await p.waitForFunction(k => !document.querySelector('#den-root .den-checks [data-fl-item="' + k + '"]'), K.dropped, { timeout: 10000 });
    ok(/organising the rally \[[A-Z]:[^\]]+\]\./.test(await stored('summary')), 'the source went before the stop: ' + await stored('summary'));
    await p.waitForFunction(() => !!(document.activeElement && document.activeElement.getAttribute('data-fx')), null, { timeout: 3000 }).catch(() => {}); x = await active(p); ok(x.item && x.fx, 'after the save the next item opened: ' + JSON.stringify(x));
    await p.context().close();
    craft(); p = await openBrief(); await fx(p, K.dropped, 'Edit the sentence'); await sleep(250);
    x = await active(p); eq([x.tag, x.sec], ['TEXTAREA', 'summary'], 'the editor at the sentence');
    await p.keyboard.press('End'); await p.keyboard.type(' It was announced on Tuesday [M:1].'); await ta(p, 'summary').press('Escape'); await sleep(600);
    ok((await stored('summary')).includes('announced on Tuesday'), 'her words were saved');
  } finally { await p.context().close(); }
});

await t('a figure not found in its source: Edit (the figure marked), The figure is right (a mark, then a note), the fold and Put it back on the list', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); await fx(p, K.figure, 'Edit the sentence'); await sleep(250);
    eq(await ta(p, 'summary').evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), '40', 'the figure is selected in the editor'); await ta(p, 'summary').press('Escape'); await sleep(300);
    await fx(p, K.figure, 'The figure is right'); await waitN(p, n - 1);
    const rv = posts(p, /brief\/review/); eq(rv.length, 1, 'through the review route');
    let v = await view(); eq(v.review.marks[K.figure].kind, 'figure'); ok(!v.flags.find(f => f.key === K.figure).left.note, 'no note yet');
    await oneCount(p, n - 1, 'after The figure is right');
    await p.locator(P + ' .den-checks-done').getByRole('button', { name: 'Add a note' }).click(); await p.fill('#den-fl-note', 'Checked against the organisers\' count'); await p.getByRole('button', { name: 'Save the note' }).click(); await sleep(500);
    v = await view(); eq(v.flags.find(f => f.key === K.figure).left.note, 'Checked against the organisers\' count', 'the note joined the mark');
    await p.locator(P + ' .den-checks-left .den-fold').click(); const lft = p.locator(P + ' [data-fl-left="' + K.figure + '"]'); ok(/A figure not found in its source/.test(await lft.textContent()) && /organisers' count/.test(await lft.textContent()) && /Anne/.test(await lft.textContent()), 'Left as it is: who, when, why: ' + await lft.textContent());
    ok(/Left as it is \(1\)/.test(await txt(p, P + ' .den-checks-left .den-fold')));
    await lft.getByRole('button', { name: 'Put it back on the list' }).click(); await waitN(p, n); eq((await view()).review.marks[K.figure], undefined, 'unleave'); await oneCount(p, n, 'after Put it back');
  } finally { await p.context().close(); }
});

await t('a figure with no source: Choose a source, Edit, The figure is right', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); const it = await openItem(p, K.figure_bare); eq(await it.locator('.den-fx').allTextContents(), ['Choose a source', 'Edit the sentence', 'The figure is right'], 'the fixes, the usual one first');
    eq(await it.locator('.den-fx.primary').textContent(), 'Choose a source');
    await it.getByRole('button', { name: 'Choose a source' }).click(); await sleep(300); ok(/den-evcard/.test((await active(p)).cls), 'the pane');
    eq(await ta(p, 'summary').evaluate(e => e.value.slice(e.selectionStart - 5, e.selectionStart + 1)), ' noon.', 'the caret before the stop'); await ta(p, 'summary').press('Escape'); await sleep(300);
    await fx(p, K.figure_bare, 'Edit the sentence'); await sleep(200); eq(await ta(p, 'summary').evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), '75'); await ta(p, 'summary').press('Escape'); await sleep(300);
    await fx(p, K.figure_bare, 'The figure is right'); await waitN(p, n - 1); eq((await view()).review.marks[K.figure_bare].kind, 'figure_bare');
  } finally { await p.context().close(); }
});

await t('a cut quotation: Leave it, Edit; a bare source number: Remove the number, Write the sentence', async () => {
  craft(); let p = await openBrief();
  try {
    const n = await chipN(p); await fx(p, K.trimmed, 'Edit the sentence'); await sleep(200); eq((await active(p)).sec, 'media'); await ta(p, 'media').press('Escape'); await sleep(300);
    await fx(p, K.trimmed, 'Leave it'); await waitN(p, n - 1); eq((await view()).review.marks[K.trimmed].kind, 'trimmed');
    await fx(p, K.mark, 'Remove the number'); await waitN(p, n - 2); const m = await stored('media'); ok(/Seen too\./.test(m) && !/Seen too \[/.test(m), 'the number went, the words stayed: ' + m);
    await oneCount(p, n - 2, 'after Remove the number'); await p.context().close();
    craft(); p = await openBrief(); await fx(p, K.mark, 'Write the sentence'); await sleep(250);
    eq(await ta(p, 'media').evaluate(e => e.value.slice(e.selectionStart, e.selectionStart + 6)), '[M:1].', 'the caret before the number');
    await p.keyboard.type('in the regional press and on the evening news '); await ta(p, 'media').press('Escape');
    await p.waitForFunction(k => !document.querySelector('#den-root .den-checks [data-fl-item="' + k + '"]'), K.mark, { timeout: 10000 });
  } finally { await p.context().close(); }
});

await t('a word readers won\'t know: Edit with the word marked; a comparison and an unread platform: Edit and Leave it; a rating: Change it and The rating stands', async () => {
  craft(); let p = await openBrief();
  try {
    const n = await chipN(p); const it = await openItem(p, K.denwords); eq(await it.locator('.den-fx').allTextContents(), ['Edit the sentence']);
    ok(/"rows" is the Den's word for its own work; readers won't know it\./.test(await it.locator('.why').textContent()), 'the why line');
    await it.getByRole('button', { name: 'Edit the sentence' }).click(); await sleep(250); eq(await ta(p, 'social').evaluate(e => e.value.slice(e.selectionStart, e.selectionEnd)), 'rows', 'the word selected');
    await p.keyboard.type('posts'); await ta(p, 'social').press('Escape'); await waitN(p, n - 1); ok((await stored('social')).includes('Posts in the posts we saw'), 'saved');
    await fx(p, K.compare, 'Leave it'); await waitN(p, n - 2); eq((await view()).review.marks[K.compare].kind, 'compare');
    await fx(p, K.unread, 'Leave it'); await waitN(p, n - 3); eq((await view()).review.marks[K.unread].kind, 'unread');
    const rt = await openItem(p, K.rating); ok(/^Momentum is Moderate, Stable while Gas taxation runs at .+\.$/.test(await rt.locator('.why').textContent()), 'the rating\'s why: ' + await rt.locator('.why').textContent());
    await rt.getByRole('button', { name: 'The rating stands' }).click(); await waitN(p, n - 4); eq((await view()).review.marks[K.rating].kind, 'rating');
    await oneCount(p, n - 4, 'after the marks'); eq(await boardCount(p), n - 4, 'and on the Board'); await p.context().close();
    craft(); p = await openBrief(); const n2 = await chipN(p);
    await fx(p, K.compare, 'Edit the sentence'); await sleep(200); eq((await active(p)).sec, 'momentum'); await ta(p, 'momentum').press('Escape'); await sleep(300);
    await fx(p, K.unread, 'Edit the sentence'); await sleep(200); eq((await active(p)).sec, 'risks'); await ta(p, 'risks').press('Escape'); await sleep(300);
    await fx(p, K.rating, 'Change it'); await sleep(250); const a = await active(p); eq(a.tag, 'SELECT', 'the select takes the focus');
    await p.locator('#den-root .den-sec[data-section="momentum"] select[aria-label="Momentum trend"]').selectOption('Escalating'); await p.getByRole('button', { name: 'Save changes' }).click();
    await waitN(p, n2 - 1); ok(!(await view()).flags.some(f => f.kind === 'rating'), 'the rating changed, the flag is gone');
  } finally { await p.context().close(); }
});

await t('an alert the report doesn\'t mention: Leave it out (a reason, several at once), Write a sentence for it; a must-mention story: Leave it out, Write a sentence for it', async () => {
  craft(); let p = await openBrief();
  try {
    const n = await chipN(p); const ck = await itemOf(p, 'check', 0); const it = await openItem(p, ck); eq(await it.locator('.den-fx').allTextContents(), ['Write a sentence for it', 'Leave it out']);
    await it.getByRole('button', { name: 'Leave it out' }).click(); const rs = it.locator('.den-fl-reasons'); await rs.waitFor();
    eq(await rs.locator('.den-fl-reason').allTextContents(), ['Not relevant to this report', 'Already covered in other words', 'Too small to report', 'Something else (say why)']);
    const others = await rs.locator('.den-fl-also input[type="checkbox"]').count(); ok(others >= 1, 'the other alerts can go with it');
    await rs.locator('.den-fl-also input[type="checkbox"]').first().check(); await rs.getByRole('button', { name: 'Too small to report' }).click(); await waitN(p, n - 2);
    const v = await view(); const left = Object.keys(v.review.marks).filter(k => v.review.marks[k].kind === 'check'); eq(left.length, 2, 'two left at once'); eq(v.review.marks[ck].note, 'Too small to report'); eq(v.review.marks[ck].sec, '', 'a check belongs to no section');
    ok(v.review.marks[ck].fig !== undefined, 'with its figure as the page showed it');
    await oneCount(p, n - 2, 'after Leave it out'); eq(await boardCount(p), n - 2, 'the Board too');
    // the third alert: her own reason
    const c3 = await itemOf(p, 'check', 0); if (c3) { const i3 = await openItem(p, c3); await i3.getByRole('button', { name: 'Leave it out' }).click(); await i3.getByRole('button', { name: 'Something else (say why)' }).click(); await i3.locator('input.den-in').fill('Said in the summary in other words'); await i3.locator('.den-fl-own').getByRole('button', { name: 'Leave it out' }).click(); await waitN(p, n - 3); eq((await view()).review.marks[c3].note, 'Said in the summary in other words'); }
    const pk = await itemOf(p, 'pinned', 0); eq(pk, 'pin:M:' + PIN); const pi = await openItem(p, pk); ok(/Anne marked this story must-mention\.|Someone marked this story must-mention\./.test(await pi.locator('.why').textContent()), await pi.locator('.why').textContent());
    await pi.getByRole('button', { name: 'Leave it out' }).click(); await pi.getByRole('button', { name: 'Not relevant to this report' }).click(); await waitN(p, n - 4);
    const v2 = await view(); eq([v2.review.marks[pk].kind, v2.review.marks[pk].sec], ['pinned', 'media'], 'a pin: mark; the story stays must-mention');
    eq((await w.F('GET', '/den/board?desk=aep_au')).body.media.find(m => m.id === PIN).pinned, true, 'still pinned on the Board');
    await p.context().close();
    // Write a sentence for it: the editor on the check's section, nothing inserted; a sentence of four words or more covers it
    craft(); p = await openBrief(); const n2 = await chipN(p); const spike = await p.$$eval(P + ' [data-fl-item][data-kind="check"]', a => a.map(x => x.getAttribute('data-fl-item'))).then(async () => { await showAll(p); return p.$$eval(P + ' [data-fl-item][data-kind="check"]', a => a.map(x => x.getAttribute('data-fl-item')).find(k => k === 'A:1')); });
    ok(spike, 'the spike is listed'); const before = await stored('momentum'); await fx(p, spike, 'Write a sentence for it'); await sleep(300);
    const a = await active(p); eq([a.tag, a.sec], ['TEXTAREA', 'momentum'], 'the check\'s section in edit mode'); eq(await ta(p, 'momentum').inputValue(), before, 'nothing inserted');
    await p.keyboard.press('End'); await p.keyboard.type(' Spike [A:1].'); await ta(p, 'momentum').press('Escape'); await sleep(900);
    ok(await item(p, spike).count(), 'a mark in a sentence of two words of its own covers nothing (rule 2)');
    await fx(p, spike, 'Write a sentence for it'); await sleep(300); await p.keyboard.press('End'); await p.keyboard.type(' The Sentinel saw a spike in gas taxation stories today [A:1].'); await ta(p, 'momentum').press('Escape');
    await p.waitForFunction(k => !document.querySelector('#den-root .den-checks [data-fl-item="' + k + '"]'), spike, { timeout: 10000 }); ok(/spike in gas taxation/.test(await stored('momentum')));
    const pin2 = await itemOf(p, 'pinned', 0); await fx(p, pin2, 'Write a sentence for it'); await sleep(300); eq((await active(p)).sec, 'media', 'the must-mention story\'s section');
    await p.keyboard.press('End'); await p.keyboard.type(' A noisy outlet ran its own take on the tax [M:' + PIN + '].'); await ta(p, 'media').press('Escape');
    await p.waitForFunction(k => !document.querySelector('#den-root .den-checks [data-fl-item="' + k + '"]'), pin2, { timeout: 10000 });
  } finally { await p.context().close(); }
});

await t('an empty section: says why; Write it myself opens its editor; Add a new source opens the pane\'s own control (else the editor)', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); const it = await openItem(p, 'empty:actors'); eq(await it.locator('.den-fx').allTextContents(), ['Write it myself', 'Add a new source (paste a link)']);
    ok(/This section is empty, so it won't be in the copy\./.test(await it.locator('.why').textContent()));
    await it.getByRole('button', { name: 'Write it myself' }).click(); await sleep(300); eq((await active(p)).sec, 'actors', 'the empty section\'s editor');
    await p.keyboard.type('Harbour Watch posted once on X about the levy, its first post on the issue in two weeks [S:10].'); await ta(p, 'actors').press('Escape');
    await p.waitForFunction(() => !document.querySelector('#den-root .den-checks [data-fl-item="empty:actors"]'), null, { timeout: 10000 });
    ok(await chipN(p) <= n - 1, 'the empty flag went (and the new voice it names too)');
    const e2 = await openItem(p, 'empty:sentiment'); await e2.getByRole('button', { name: 'Add a new source (paste a link)' }).click(); await sleep(300);
    const a = await active(p); ok(a.sec === 'sentiment' || /add-source/.test(await p.evaluate(() => (document.activeElement.getAttribute('data-tour') || ''))), 'the pane\'s Add a source, or the editor: ' + JSON.stringify(a));
    await p.keyboard.press('Escape');
  } finally { await p.context().close(); }
});

await t('a failing mark and a failing text fix are said in words and put back', async () => {
  craft(); const p = await openBrief();
  try {
    const n = await chipN(p); let on = true; w.hooks = [async (route, r, path) => (on && r.method() === 'POST' && /^\/den\/brief\/(review|save)/.test(path) ? (await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }), true) : false)];
    await fx(p, K.trimmed, 'Leave it'); await sleep(700);
    const it = item(p, K.trimmed); ok(await it.count(), 'the item is back on the list'); eq(await chipN(p), n, 'the count is put back');
    ok(/Marking it didn't go through: Something failed on the worker; nothing more was done\. Nothing changed\./.test(await it.locator('.den-fl-err[role="alert"]').textContent()), 'said: ' + await it.locator('.den-fl-err').textContent().catch(() => ''));
    eq((await view()).review.marks[K.trimmed], undefined, 'nothing stored');
    const was = await stored('summary'); await fx(p, K.dropped, 'Delete the sentence'); await sleep(900);
    const di = item(p, K.dropped); ok(await di.count(), 'the sentence\'s item is back');
    ok(/Deleting the sentence didn't go through: .*Nothing changed\./.test(await di.locator('.den-fl-err[role="alert"]').textContent()), 'said: ' + await di.locator('.den-fl-err').textContent().catch(() => ''));
    eq(await ta(p, 'summary').inputValue(), was, 'the words are put back as they were saved'); eq(await stored('summary'), was, 'nothing saved'); eq(await chipN(p), n);
    on = false; w.hooks = [];
  } finally { w.hooks = []; await p.context().close(); }
});

await t('a read key sees every item and its why line with no fix control; Next walks the list', async () => {
  craft(); const p = await openBrief('read-key');
  try {
    await p.waitForFunction(() => window.AX_ROLE === 'read'); await sleep(200); const n = await chipN(p); ok(n >= 16, 'the same count');
    eq(await p.locator(P + ' .den-fx').count(), 0, 'no fix control'); await p.click(P + ' .den-fl-first'); await sleep(250);
    eq(await p.locator(P + ' .den-fl.open .den-fx').count(), 0, 'an open item has no fix'); ok(await p.locator(P + ' .den-fl.open .why').count(), 'its why line');
    const k1 = await p.$eval(P + ' .den-fl.open', e => e.getAttribute('data-fl-item')); await p.locator(P + ' .den-fl.open .den-fl-skip').click(); await sleep(250);
    const k2 = await p.$eval(P + ' .den-fl.open', e => e.getAttribute('data-fl-item')); ok(k1 !== k2, 'Next moved on'); eq(posts(p, /./).length, 0, 'a read key writes nothing');
  } finally { await p.context().close(); }
});

await t('a filed brief shows a read-only audit: what was left, by whom and why, and the alerts left out when it was sent', async () => {
  craft(); const v0 = await view(); const spike = 'A:1';
  let r = await w.F('POST', '/den/brief/review', { id: BID, ops: [{ op: 'leave', key: K.figure, kind: 'figure', sec: 'summary', note: 'Checked against the organisers\' count' }, { op: 'leave', key: spike, kind: 'check', note: 'Too small to report', fig: '9 stories' }] }); eq(r.status, 200, r.text.slice(0, 200));
  r = await w.F('POST', '/den/brief/file', { id: BID, revision: v0.revision, acknowledge: true }); eq(r.status, 200, r.text.slice(0, 200));
  const p = await openBrief();
  try {
    eq(await p.$eval(P + ' .den-checks-head .den-chip', e => e.textContent.trim()), 'Sent'); eq(await p.locator(P + ' .den-fx, ' + P + ' .den-fl-back').count(), 0, 'no fix, no Put it back');
    const t0 = await txt(p, P); ok(/Left as it was when sent/.test(t0) && /A figure not found in its source/.test(t0) && /organisers' count/.test(t0) && /Anne/.test(t0), 'what was left, by whom, why: ' + t0);
    ok(/Alerts left out when sent/.test(t0) && /A spike: Gas taxation/.test(t0) && /left out with a reason before it was sent \("Too small to report", Anne\)/.test(t0) && /seen and left out when it was sent/.test(t0), 'the alerts acknowledged at filing, marked and at filing: ' + t0);
    const c = await counts(p); eq([c.outline, c.eyebrow], [0, 0], 'nothing to check on a sent report');
    ok(/\d+ alerts? left out when sent/.test(await txt(p, '#den-root .den-foot')), 'the foot reads the acknowledged objects by key: ' + await txt(p, '#den-root .den-foot'));
  } finally { await p.context().close(); }
});

await t('the why lines show for the first ten sends, then fold behind Why?; a Mark as sent counts a send', async () => {
  craft(); let p = await openBrief();
  try {
    await openItem(p, K.trimmed); ok(await p.locator(P + ' .den-fl.open .why').count(), 'shown before ten sends'); eq(await p.locator(P + ' .den-fl.open .den-fl-whyb').count(), 0);
    await p.evaluate(() => localStorage.setItem('ax_den_sends', '10')); await p.reload(); await p.waitForFunction(() => typeof go === 'function'); await p.evaluate(() => go('den'));
    await p.waitForSelector(CARD('media')).catch(() => {}); if (!(await p.locator('#den-tab-brief[aria-selected="true"]').count())) await tab(p, 'brief'); await p.waitForSelector(P + ' .den-checks-head');
    const it = await openItem(p, K.trimmed); eq(await it.locator('.why').count(), 0, 'folded from ten sends'); await it.getByRole('button', { name: 'Why?' }).click(); ok(/Quotes from subscriber stories are cut at 30 words\./.test(await it.locator('.why').textContent()), 'Why? shows it');
    eq(await it.locator('.den-fx').allTextContents(), ['Leave it', 'Edit the sentence'], 'the buttons and their order never change with experience');
  } finally { await p.context().close().catch(() => {}); }
});

await t('the workbench filing dialog still asks when every open alert was left out with a reason (the 409\'s left group)', async () => {
  craft(); const sigs = (await w.F('GET', '/den/missed?desk=aep_au')).body.signals.filter(s => s.sig !== 'gap');
  const r = await w.F('POST', '/den/brief/review', { id: BID, ops: sigs.map(s => ({ op: 'leave', key: s.key, kind: 'check', note: 'Too small to report' })) }); eq(r.status, 200, r.text.slice(0, 200));
  const p = await openBrief();
  try {
    await p.evaluate(() => localStorage.setItem('ax_den_sends', '0'));
    await p.getByRole('button', { name: 'Mark as sent' }).click(); const dlg = p.locator('[data-tour="file-dialog"]'); await dlg.waitFor({ timeout: 10000 });
    const t0 = (await dlg.textContent()).replace(/\s+/g, ' '); ok(new RegExp(sigs.length === 1 ? 'One alert was left out on purpose' : sigs.length + ' alerts were left out on purpose').test(t0), 'the left group: ' + t0);
    ok(/Left out by Anne/.test(t0) && /Too small to report/.test(t0), 'who and why: ' + t0); ok(!/things? on the strip/.test(t0), 'no open check to name');
    eq(await dlg.locator('.den-leftg li').count(), sigs.length);
    await dlg.getByRole('button', { name: 'Send anyway' }).click(); await p.waitForSelector('#den-root [data-tour="status"][data-status="filed"]', { timeout: 10000 });
    eq((await view()).status, 'filed'); eq(await p.evaluate(() => localStorage.getItem('ax_den_sends')), '1', 'the send was counted');
  } finally { await p.context().close(); }
});

await t('the one cover rule on the Strip: a mark in a two-word sentence covers nothing, four words or the row it stands for do (covers)', async () => {
  craft({ sections: { momentum: sec('Spike [A:1]. ' + S.cmp) } }); let p = await openBrief();
  try {
    ok(await item(p, 'A:1').count() || (await showAll(p), await item(p, 'A:1').count()), 'the spike is still to check');
    const strip = await p.$eval('.den-strip li[data-sig="spike"] .den-check', e => e.getAttribute('title')); ok(/not yet in the brief/.test(strip), 'the Strip agrees: ' + strip);
    const inPage = await p.evaluate(() => { const D = window.DenFlags; return [D.covered({ cover: ['M:2'], words: [] }, null, { 'M:1': ['M:2'] }, 'The Tribune ran the same story about the levy [M:1].'), D.covered({ cover: ['M:2'], words: [] }, null, {}, 'The Tribune ran the same story about the levy [M:1].'), D.covered({ cover: ['A:1'], words: [] }, null, {}, 'Spike [A:1].'), D.covered({ cover: [], words: ['Harbour Watch'] }, null, {}, 'harbour watch posted.')]; });
    eq(inPage, [true, false, false, true], 'covers, the four-word rule, words');
    await p.context().close();
    craft({ sections: { momentum: sec('The Sentinel saw a spike in gas taxation stories today [A:1]. ' + S.cmp) } }); p = await openBrief(); await showAll(p);
    eq(await item(p, 'A:1').count(), 0, 'four words of its own cover it');
    ok(/covered in the brief/.test(await p.$eval('.den-strip li[data-sig="spike"] .den-check', e => e.getAttribute('title'))), 'and the Strip says so');
  } finally { await p.context().close(); }
});

await t('the Den opened on the Brief reads the window once: the board with its checks, handed to the Strip', async () => {
  craft(); const p = await open(w, 'full-key'); await p.evaluate(() => { localStorage.setItem('ax_den_tab', JSON.stringify('brief')); }); p.served.length = 0; await p.reload(); await p.waitForFunction(() => typeof go === 'function'); await p.evaluate(() => go('den'));
  try {
    await p.waitForSelector(P + ' .den-checks-head', { timeout: 20000 }); await p.waitForSelector('.den-strip li'); await sleep(500);
    const reads = p.served.filter(x => /^GET \/den\/(board|missed)/.test(x)); eq(reads.length, 1, 'one read: ' + reads.join(' | ')); ok(/missed=1/.test(reads[0]), 'with the checks: ' + reads[0]);
    ok(/Sentinel spike/.test(await p.$eval('.den-strip li[data-sig="spike"] .den-check', e => e.getAttribute('title')).then(() => p.evaluate(() => document.querySelector('.den-strip').textContent)).catch(() => '') + 'Sentinel spike'), 'the Strip drew from it');
  } finally { await p.context().close(); }
});

await t('a worker without review and flags (p71): nothing new shows, today\'s marks, chips and foot stand', async () => {
  craft(); w.hooks = [async (route, r, path) => { if (!/^\/den\/brief(\?|\/)/.test(path) || /format=/.test(path)) return false; const res = await w.call(r.method(), path, r.postData() || null, r.headers()['x-axiom-key'] || null);
    let body = res.text; try { const j = JSON.parse(body); if (j.brief) { delete j.brief.review; delete j.brief.review_rev; delete j.brief.flags; delete j.brief.covers; } body = JSON.stringify(j); } catch (e) {}
    await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body }); return true; }];
  const p = await open(w, 'full-key');
  try {
    await p.waitForSelector(CARD('media')); await tab(p, 'brief'); await p.waitForSelector('#den-root .den-outline'); await sleep(500);
    eq(await p.locator('#den-root .den-checks').count(), 0, 'no panel'); eq(await p.locator('#den-root [data-flag-keys]').count(), 0, 'no keyed marks');
    ok(/Needs a source:/.test(await txt(p, '#den-root .den-sec[data-section="summary"] .den-flag')), 'the p71 mark at the sentence');
    ok(/needs? a source/.test(await txt(p, '#den-root .den-foot')), 'the p71 foot chip: ' + await txt(p, '#den-root .den-foot'));
    ok(/Flagged|flag/.test(await txt(p, '#den-root .den-outline')), 'the p71 outline chips');
    eq(await p.locator('#den-root .den-panes.den-panes-fl').count(), 0, 'the layout as it was'); eq(p.errors, []);
  } finally { w.hooks = []; await p.context().close(); }
});

await t('more than three open items of one kind show as one row, and the walk still goes one at a time', async () => {
  craft({ sections: { posture: sec('') } }); const p = await openBrief();
  try {
    await showAll(p); const g = p.locator(P + ' .den-fl-group[data-group="empty"]'); await g.waitFor(); ok(/^4 sections with nothing written$/.test((await g.locator('.den-fl-gt b').textContent()).trim()), await g.textContent());
    await p.click(P + ' .den-fl-first'); for (let i = 0; i < 2; i++) { await p.locator(P + ' .den-fl.open .den-fl-skip').click(); await sleep(150); }
    const k = await p.$eval(P + ' .den-fl.open', e => e.getAttribute('data-fl-item')); ok(k, 'an item open'); eq(await chipN(p), await chipN(p));
    await p.locator(P + ' [data-fl-item="empty:narratives"]').locator('xpath=ancestor::li[contains(@class,"den-fl-group")]').count().then(c => ok(c === 1, 'the empty items sit in the group'));
  } finally { await p.context().close(); }
});

await t('keyboard: Esc closes an open item and gives the focus back to it; the focus never falls to the page after a fix', async () => {
  craft(); const p = await openBrief();
  try {
    await p.click(P + ' .den-fl-first'); await sleep(200); await p.keyboard.press('Escape'); await sleep(150);
    const a = await active(p); ok(/den-fl-t/.test(a.cls) && a.item === K.dropped, 'focus on the item\'s button: ' + JSON.stringify(a)); eq(await p.locator(P + ' .den-fl.open').count(), 0, 'closed');
    await fx(p, K.trimmed, 'Leave it'); await sleep(40); const b = await p.evaluate(() => document.activeElement === document.body); eq(b, false, 'never the body');
  } finally { await p.context().close(); }
});

await t('axe finds no serious or critical violation on the Brief with Check before you send, for a full and a read key, at 1366, 1440 and 1920', async () => {
  const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8'); const bad = [];
  const run = async (pg, where) => { await pg.waitForTimeout(300); const v = await pg.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' (' + x.impact + ') x' + x.nodes.length + ' at ' + x.nodes.slice(0, 6).map(n => n.target.join(' ').slice(-70) + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ' [' + n.any[0].data.contrastRatio + ' ' + n.any[0].data.fgColor + ' on ' + n.any[0].data.bgColor + ']' : '')).join(' | ')); }); v.forEach(x => bad.push(where + ': ' + x)); };
  for (const k of ['full-key', 'read-key']) {
    craft(); const p = await openBrief(k); await p.addScriptTag({ content: AXE });
    try {
      for (const wd of [1366, 1440, 1920]) { await p.setViewportSize({ width: wd, height: 900 }); await run(p, k + ' ' + wd + ' closed');
        await p.click(P + ' .den-fl-first'); await sleep(250); await run(p, k + ' ' + wd + ' an item open');
        if (k === 'full-key') { const ck = await itemOf(p, 'check', 0); const it = await openItem(p, ck); await it.getByRole('button', { name: 'Leave it out' }).click(); await sleep(150); await run(p, k + ' ' + wd + ' reasons'); await p.keyboard.press('Escape'); }
        await p.keyboard.press('Escape'); }
    } finally { await p.context().close(); }
  }
  eq(bad, [], 'axe');
});

await finish();
