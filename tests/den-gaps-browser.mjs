/* Anne's Den: a collection gap is said on the Collection tab only (the owner's item (a), 16 November 2026), and the Board
 * raises no false alarm. Served from docs/ with the worker module in this process (den-fixture.mjs); nothing is contacted
 * and nothing is spent. Every outlet, account and post here is invented.
 *   no element outside Collection names a gap, at three widths and for both keys; the rail holds five checks; a failed
 *   read still says so with Try again; nothing is "uncovered" before a brief, a check the brief misses is a quiet to-do,
 *   and after File anyway it reads as acknowledged; the Collection tab's mark carries no text; Refresh off the Board still
 *   asks for the checks; icons sit beside the words; the board says when a card is being dragged; a narrative with a
 *   computed name carries a quiet "working title" tag, and nothing when the worker sends no such field.
 * Run: node --experimental-sqlite tests/den-gaps-browser.mjs */
import { world, open, t, ok, eq, txt, tab, finish, CARD, cards, checks } from './den-fixture.mjs';

console.log('den-gaps-browser harness (collection gaps on Collection only; no false alarms on the Board)');
const w = await world();
const gapsOf = async desk => ((await w.F('GET', '/den/missed?desk=' + desk)).body.signals || []).filter(s => s.sig === 'gap');
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const settle = p => p.waitForFunction(() => !/Loading/.test((document.querySelector('#den-tabpanel') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
const READY = { today: CARD(), brief: '.den-briefhost .den-brief, .den-briefhost .den-state', watch: '#den-tabpanel section.den-panel:visible', collection: 'section.den-panel[aria-label="Channels"]', options: 'section.den-panel[aria-label="The desk"]' };
/* Every element outside the Collection tab's panel whose own words, title or label name a gap (its title, its reason, or
   the generic words a gap is said in). The Collection tab's own panel is the one place they belong. */
const leaks = (p, gaps) => p.evaluate(words => {
  const rx = new RegExp(words.concat(['delivered nothing', 'Not collected', 'Not delivering']).join('|'), 'i'); const out = [];
  document.querySelectorAll('#den-root *').forEach(el => { if (el.closest('#den-tabpanel.tab-collection')) return;
    const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent).join(' '); const at = ['title', 'aria-label', 'data-what'].map(a => el.getAttribute(a) || '').join(' ');
    if (rx.test(own) || rx.test(at)) out.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] + ': ' + (own + ' ' + at).replace(/\s+/g, ' ').trim().slice(0, 120)); });
  return out; }, gaps.flatMap(g => [g.title, g.detail]).filter(Boolean).map(esc));

const gq = await gapsOf('aep_au');
await t('the fixture desk has a collection gap to keep off the Board (otherwise these cases prove nothing)', async () => {
  ok(gq.length >= 1 && gq.some(g => /Facebook delivered nothing in this window/.test(g.title)), 'gaps: ' + JSON.stringify(gq).slice(0, 300));
});
await t('no element outside Collection names a collection gap, at 1366, 1440 and 1920, for a full and a read-only key', async () => {
  for (const key of ['full-key', 'read-key']) for (const width of [1366, 1440, 1920]) {
    const p = await open(w, key, { width, height: 900 }); await p.waitForSelector(CARD('media'));
    for (const name of ['today', 'brief', 'watch', 'options', 'collection']) {
      if (name !== 'today') await tab(p, name); await p.waitForSelector(READY[name], { state: 'attached', timeout: 15000 }); await settle(p);
      const l = await leaks(p, gq); eq(l, [], key + ' at ' + width + ' on ' + name + ': a gap is named outside Collection');
      if (name !== 'collection') ok(!/delivered nothing|Not collected/i.test(await txt(p, '#den-root')), key + ' at ' + width + ' on ' + name + ': the page text names a gap');
    }
    eq(p.errors, [], 'no page error'); await p.context().close();
  }
});
await t('the rail holds five checks and says five: a desk whose only finding is a gap reads as nothing found', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media'));
  eq(await p.$$eval('.den-strip li', e => e.map(x => x.dataset.sig)), ['spike', 'emerging', 'outlier', 'first_seen', 'burst'], 'five pills');
  ok(/3 to read/.test(await txt(p, '.den-strip-h')) && !/six/i.test(await p.getAttribute('.den-strip-h', 'title')), 'the count leaves the gap out and the rail says five: ' + await txt(p, '.den-strip-h'));
  ok(!(await checks(p)).some(l => /delivered nothing|Not collected/.test(l)), 'no popover speaks of collection');
  ok((await gapsOf('guns_au')).length >= 1, 'the firearms desk has a gap'); await p.selectOption('.den-head select[aria-label="Desk"]', 'guns_au'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent));
  await p.waitForFunction(() => /five checks, nothing found/.test((document.querySelector('.den-strip-h') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/five checks, nothing found/.test(await txt(p, '.den-strip-h')), 'a gap is not a finding: ' + await txt(p, '.den-strip-h'));
  eq(await p.locator('.den-strip li button[data-n]:not([data-n="0"])').count(), 0, 'and no pill has a finding'); eq(p.errors, []); await p.context().close();
});
await t('a failed read still says so, with Try again, on the Board and on the rail', async () => {
  let failBoard = 1, failMissed = 0; w.hooks.push(async (route, r, path) => { const fail = (/^\/den\/board/.test(path) && failBoard > 0 && failBoard--) || (/^\/den\/missed/.test(path) && failMissed > 0 && failMissed--);
    if (!fail) return false; await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; });
  try {
    const p = await open(w); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Today's evidence could not be loaded\. Something failed on the worker/.test(await txt(p, '#den-tabpanel .den-state.err')));
    await p.locator('#den-tabpanel .den-state.err button', { hasText: 'Try again' }).click(); await p.waitForSelector(CARD('media'));
    // off the Board the rail reads the checks for itself: that first read fails
    failMissed = 1; await tab(p, 'watch'); await p.waitForSelector('.den-strip .den-state.err', { timeout: 15000 });
    ok(/The checks could not be loaded\. Something failed on the worker/.test(await txt(p, '.den-strip .den-state.err')), 'the rail says its read failed');
    await p.locator('.den-strip .den-state.err button', { hasText: 'Try again' }).click(); await p.waitForSelector('.den-strip li'); eq(p.errors, []); await p.context().close();
  } finally { w.hooks.length = 0; }
});
await t('nothing is uncovered before a brief; a check the brief misses is a quiet to-do; after File anyway it reads as acknowledged', async () => {
  const w2 = await world(); const quiet = p => p.$$eval('.den-board .den-col-meta .den-chip', a => a.map(x => [x.className, x.textContent.trim()]));
  let p = await open(w2); await p.waitForSelector(CARD('media')); await p.waitForSelector('.den-briefhost .den-brief, .den-briefhost .den-state', { state: 'attached' }); await settle(p);
  ok(!/uncovered|not in the brief|acknowledged/.test(await txt(p, '.den-board')), 'no brief, no alarm: ' + JSON.stringify(await quiet(p)));
  ok(!/not in the brief/.test(await txt(p, '.den-strip-h')), 'and the rail does not say "not in the brief" either'); await p.context().close();
  const words = 'The window held a steady run of coverage on the gas export tax across regional outlets, with several stories carried by more than one masthead and a modest response on social channels. ';
  const s0 = (await w2.F('POST', '/den/brief/save', { desk: 'aep_au' })).body.brief;
  const s1 = await w2.F('POST', '/den/brief/save', { id: s0.id, revision: s0.revision, sections: { summary: words + words, media: words + words, bottom: words, posture: words } }); eq(s1.status, 200, 'a hand brief is saved: ' + s1.text.slice(0, 200));
  p = await open(w2); await p.waitForSelector(CARD('media')); await p.waitForFunction(() => /not in the brief/.test((document.querySelector('.den-strip-h') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/not in the brief/.test(await txt(p, '.den-strip-h')), 'the rail counts what the brief does not hold: ' + await txt(p, '.den-strip-h'));
  let q = await quiet(p); const todo = q.filter(x => /not in the brief yet/.test(x[1])); ok(todo.length >= 1, 'a column says a check is not in the brief yet: ' + JSON.stringify(q));
  ok(todo.every(x => !/\b(neg|warn)\b/.test(x[0])), 'and says it quietly, not in red: ' + JSON.stringify(todo)); ok(!q.some(x => /uncovered/.test(x[1])), 'the word "uncovered" is gone'); await p.context().close();
  const f = await w2.F('POST', '/den/brief/file', { id: s0.id, revision: s1.body.brief.revision, acknowledge: true }); eq([f.status, f.body.brief && f.body.brief.status], [200, 'filed'], 'filed with the checks acknowledged: ' + f.text.slice(0, 200));
  p = await open(w2); await p.waitForSelector(CARD('media')); await p.waitForFunction(() => /acknowledged/.test((document.querySelector('.den-strip-h') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  ok(/acknowledged/.test(await txt(p, '.den-strip-h')) && !/not in the brief/.test(await txt(p, '.den-strip-h')), 'filed, the rail reads acknowledged: ' + await txt(p, '.den-strip-h'));
  ok(!(await p.$('.den-strip-h .un')), 'and not in the warning colour'); q = await quiet(p);
  const ack = q.filter(x => /acknowledged/.test(x[1])); ok(ack.length >= 1 && ack.every(x => !/\b(neg|warn|pos)\b/.test(x[0])), 'a column reads acknowledged, neutral: ' + JSON.stringify(q)); ok(!q.some(x => /not in the brief yet/.test(x[1])), 'nothing is a to-do once filed');
  eq(p.errors, []); await p.context().close();
});
await t('the Collection tab carries a quiet mark when a channel delivered nothing, with no text, and none when every channel delivered', async () => {
  let p = await open(w); await p.waitForSelector(CARD('media')); await p.waitForSelector('#den-tab-collection[data-attn="1"]');
  eq(await txt(p, '#den-tab-collection'), 'Collection', 'the tab text is exactly the word'); eq([await p.getAttribute('#den-tab-collection', 'title'), await p.getAttribute('#den-tab-collection', 'aria-label')], [null, null], 'and the mark adds no words');
  await tab(p, 'watch'); ok(await p.$('#den-tab-collection[data-attn="1"]'), 'the mark stays on another tab'); await p.context().close();
  const strip = d => { const m = d && d.missed; if (m && Array.isArray(m.signals)) m.signals = m.signals.filter(s => s.sig !== 'gap'); if (d && Array.isArray(d.signals)) d.signals = d.signals.filter(s => s.sig !== 'gap'); return d; };
  w.hooks.push(async (route, r, path) => { if (!/^\/den\/(board|missed)/.test(path)) return false; const res = await w.call('GET', path, null, r.headers()['x-axiom-key'] || null);
    await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(strip(JSON.parse(res.text))) }); return true; });
  try { p = await open(w); await p.waitForSelector(CARD('media')); await p.waitForSelector('.den-strip li'); eq(await p.getAttribute('#den-tab-collection', 'data-attn'), null, 'no gap, no mark'); eq(p.errors, []); await p.context().close(); }
  finally { w.hooks.length = 0; }
});
await t('Refresh on a tab other than the Board still asks for the checks', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media'));
  for (const name of ['watch', 'brief', 'options']) {
    await tab(p, name); await p.waitForSelector('.den-strip li'); p.served.length = 0; await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click();
    for (let i = 0; i < 50 && !p.served.some(x => /^GET \/den\/missed/.test(x)); i++) await new Promise(r => setTimeout(r, 100));
    ok(p.served.some(x => /^GET \/den\/missed/.test(x)), name + ': Refresh asked for the checks: ' + p.served.join(' | ')); await p.waitForSelector('.den-strip li');
  }
  eq(p.errors, []); await p.context().close();
});
await t('icons sit beside the words, hidden from a screen reader: Back, Refresh, the shortcuts, Pin, Set aside, Open, Write; a pinned card says so with an icon and words for a screen reader', async () => {
  const w3 = await world(); const p = await open(w3); await p.waitForSelector(CARD('media'));
  const ic = async (loc, what) => { ok(await loc.locator('svg.den-ic[aria-hidden="true"]').count() >= 1, what + ' has an icon'); };
  await ic(p.getByRole('button', { name: 'Back to AXIOM', exact: true }), 'Back'); await ic(p.getByRole('button', { name: 'Refresh', exact: true }), 'Refresh'); await ic(p.getByRole('button', { name: 'Keyboard shortcuts', exact: true }), 'the shortcuts button');
  const row = cards(p, 'media').filter({ hasText: 'Producers answer' }); await ic(row.getByRole('button', { name: 'Pin', exact: true }), 'Pin'); await ic(row.getByRole('button', { name: 'Set aside', exact: true }), 'Set aside'); await ic(row.locator('.den-card-act a.den-link'), 'Open');
  await ic(p.locator('.den-col[data-sec="summary"] button[data-tour="col-write"]'), 'Write'); eq(await p.locator('.den-col[data-sec="summary"] button[data-tour="col-write"]').textContent().then(s => s.trim()), 'Write', 'and the word is unchanged');
  await row.getByRole('button', { name: 'Pin', exact: true }).click(); await p.waitForSelector(CARD('media') + '.pinned');
  const mark = p.locator(CARD('media') + '.pinned .den-pinmark'); ok(await mark.locator('svg.den-ic').count() === 1 && /^Pinned$/.test((await mark.locator('.den-sr').textContent()).trim()), 'the mark is an icon with the word for a screen reader');
  ok(/^Pinned\. /.test(await p.getAttribute(CARD('media') + '.pinned', 'aria-label')), 'and the card still says it is pinned');
  ok((await p.$$eval('#den-root svg.den-ic', a => a.every(s => s.getAttribute('aria-hidden') === 'true' && s.getAttribute('focusable') === 'false'))), 'no icon is read out or takes the focus');
  eq(p.errors, []); await p.context().close();
});
await t('while a card is being dragged the board says so (the drop zones light), and stops when it is dropped', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media')); ok(!(await p.$('.den-board.dragging')), 'not dragging at rest');
  const card = cards(p, 'media').first(); const dt = await p.evaluateHandle(() => new DataTransfer());
  await card.dispatchEvent('dragstart', { dataTransfer: dt }); await p.waitForSelector('.den-board.dragging', { timeout: 5000 });
  await card.dispatchEvent('dragend', { dataTransfer: dt }); await p.waitForSelector('.den-board.dragging', { state: 'detached', timeout: 5000 });
  eq(p.errors, []); await p.context().close();
});
await t('a narrative the worker named by itself carries a quiet "working title" tag that says what it is; a narrative without the field carries none', async () => {
  const nar = (id, label, named) => Object.assign({ id, label, last: Date.now() - 3600000, n: 14, n24: 6, spread: ['news', 'x'], side: 'hostile', status: 'emerging', claim: 'The levy will cost regional jobs' }, named ? { named } : {});
  w.hooks.push(async (route, r, path) => { if (!/^\/den\/board/.test(path)) return false; const res = await w.call('GET', path, null, r.headers()['x-axiom-key'] || null); const d = JSON.parse(res.text);
    d.narratives = [nar(901, 'Harbour levy and regional jobs', 'auto'), nar(902, 'Export tax as a broken promise', 'model'), nar(903, 'Gas royalties and the budget')];
    await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }); return true; });
  try {
    const p = await open(w); await p.waitForSelector(CARD('narratives')); const tag = id => p.locator(CARD('narratives') + '[data-key="N:' + id + '"] .den-worktitle');
    eq(await tag(901).count(), 1, 'the computed name is tagged'); eq((await tag(901).textContent()).trim(), 'working title'); ok(/not yet reviewed|computed/i.test(await tag(901).getAttribute('title')), 'and its title says what it is: ' + await tag(901).getAttribute('title'));
    eq([await tag(902).count(), await tag(903).count()], [0, 0], 'a model name, or no field at all, carries no tag');
    ok(/Harbour levy and regional jobs/.test(await txt(p, CARD('narratives') + '[data-key="N:901"] .den-card-title')), 'the working title is the card\'s title'); eq(p.errors, []); await p.context().close();
  } finally { w.hooks.length = 0; }
});
await t('the Board loads as column ghosts; a write is said in a live line beside its Undo; a filed card\'s menu reads "Move..." and still goes back to Unsorted', async () => {
  const w4 = await world(); let slow = true; w4.hooks = [async (route, r, path) => { if (slow && /^\/den\/board/.test(path)) await new Promise(res => setTimeout(res, 1500)); return false; }];
  const p = await open(w4); await p.waitForSelector('.den-loading.board', { timeout: 5000 }); eq(await p.locator('.den-loading.board .den-skelcol').count(), 5, 'the skeleton is shaped like the columns'); slow = false;
  await p.waitForSelector(CARD('media')); const story = cards(p, 'media').filter({ hasText: 'Harbour levy' });
  await story.getByRole('button', { name: 'Pin', exact: true }).click(); await p.waitForFunction(() => /^Pinned: Harbour levy/.test((document.querySelector('.den-col-tools [role="status"]') || {}).textContent || ''));
  const key = await story.getAttribute('data-key'); await story.focus(); await p.keyboard.press('3'); const filed = p.locator('.den-col[data-sec="media"] .den-row[data-key="' + key + '"]'); await filed.waitFor();
  eq(await filed.locator('select.den-file').evaluate(s => s.options[s.selectedIndex].textContent), 'Move...', 'a filed card offers to move, not the name of where it is');
  ok(await filed.locator('select.den-file option[value="media"]').evaluate(o => o.disabled && /filed here/.test(o.textContent)), 'the column it sits in is marked, and not offered again');
  await filed.locator('select.den-file').selectOption(''); await p.waitForSelector(CARD('media') + '[data-key="' + key + '"]'); eq(p.errors, []); await p.context().close();
});
await t('Refresh on the Brief tab reads the window again for its evidence; on Watch it reads only the checks', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media')); await tab(p, 'brief'); await p.waitForSelector('.den-briefhost .den-brief, .den-briefhost .den-state', { state: 'attached' });
  const wait = async rx => { for (let i = 0; i < 50 && !p.served.some(x => rx.test(x)); i++) await new Promise(r => setTimeout(r, 100)); };
  p.served.length = 0; await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await wait(/^GET \/den\/board/); await wait(/^GET \/den\/missed/);
  ok(p.served.some(x => /^GET \/den\/board\?/.test(x)) && p.served.some(x => /^GET \/den\/missed/.test(x)), 'on Brief both are read: ' + p.served.join(' | '));
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); p.served.length = 0; await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await wait(/^GET \/den\/missed/); await new Promise(r => setTimeout(r, 400));
  ok(p.served.some(x => /^GET \/den\/missed/.test(x)) && !p.served.some(x => /^GET \/den\/board/.test(x)), 'on Watch only the checks: ' + p.served.join(' | ')); eq(p.errors, []); await p.context().close();
});

await finish();
