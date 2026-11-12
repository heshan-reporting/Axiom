/* Anne's Den with its routes failing, one at a time (prompts/annes-den.md Phase 7): every read the page makes is made to
 * fail, to answer with a gateway's page, to answer with the wrong shape, to hang and then answer, and to drop the
 * connection; and every write is made to fail and to drop. For each: the page is never blank, the failure is said in
 * words, nothing a person typed is lost, and one press recovers once the route answers again. Providers are stubbed and
 * nothing is spent. The cases written before the guided run (decision D10) are tests of the table; Guided, which a fresh
 * profile opens in, has its own: the board in all five modes, the strip in all five when the board comes without it, a
 * keep and a set-aside failing and dropping, the board answering without the strip, and the read after a decision
 * failing. 76 cases. Run: node --experimental-sqlite tests/den-inject-browser.mjs */
import { world, open, t, ok, eq, txt, tab, toast, finish } from './den-fixture.mjs';

console.log('den-inject-browser harness (every Den route failing, slow and malformed, one at a time)');
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); await w.F('POST', '/den/discover', { ns: 'aep' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const READS = [['the desks', /^\/den\/desks/, 'today'], ['the board', /^\/den\/board/, 'today'], ['the strip', /^\/den\/missed/, 'brief'], ['the brief', /^\/den\/brief\?/, 'brief'], ['the register', /^\/den\/watch\?/, 'watch'], ['the lexicon', /^\/den\/lexicon/, 'watch'], ['the themes', /^\/den\/themes/, 'watch'], ['collection', /^\/den\/collection/, 'collection'],
  // [3] how the page is opened, [4] what a healthy page shows: Guided has one card (or its done state) where the table has rows
  ['the board in Guided', /^\/den\/board/, 'today', { guided: true }, '#den-focus, .den-done']];
const MODES = {
  failing: async route => { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.', requestId: 'r1' }) }); return true; },
  'a gateway page': async route => { await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>502 Bad Gateway</body></html>' }); return true; },
  'the wrong shape': async route => { await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); return true; },
  dropped: async route => { await route.abort('connectionreset'); return true; },
  slow: async () => { await sleep(1200); return false; },
};
const alive = page => page.evaluate(() => { const r = document.getElementById('den-root'); return !!r && r.textContent.replace(/\s+/g, ' ').trim().length > 40; });
const said = page => page.evaluate(() => Array.from(document.querySelectorAll('#den-root .den-state.err, #den-root .den-notice.bad, #den-root [role="alert"]')).map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
// a selector, or several, inside the Den and visible
const seen = (page, sel) => page.waitForSelector(sel.split(', ').map(x => '#den-root ' + x + ':visible').join(', '), { timeout: 20000 });
const healthy = { today: 'section.den-panel[aria-label="Traditional media"] tr.den-row', brief: '.den-sec[data-section="summary"] textarea', watch: 'section.den-panel[aria-label="Waiting for a person"]', collection: 'section.den-panel[aria-label="Channels"] tr.den-row' };

for (const [name, rx, where, how, good] of READS) for (const mode of Object.keys(MODES)) {
  await t(name + ', ' + mode + ': the page stays up, says so, and recovers', async () => {
    let on = true; w.hooks = [async (route, r, path) => (on && r.method() === 'GET' && rx.test(path) ? MODES[mode](route) : false)];
    const page = await open(w, 'full-key', Object.assign({ view: 'command' }, how || {})); page.removeAllListeners('pageerror'); const errs = []; page.on('pageerror', e => errs.push(e.message));
    try {
      await page.evaluate(() => go('den')); await page.waitForSelector('#den-root > *', { timeout: 15000 }); if (await page.$('#den-tab-' + where)) await tab(page, where).catch(() => {});
      if (mode === 'slow') { await seen(page, good || healthy[where]); ok(await alive(page)); eq(errs, []); return; }
      await sleep(900); ok(await alive(page), 'the page is blank'); const msg = await said(page);
      ok(/could not be loaded|could not be refreshed|stopped working|connection to AXIOM dropped|not with what this page asked for|Something failed on the worker/.test(msg), 'nothing on the page says what failed: [' + msg.slice(0, 200) + ']');
      if (name !== 'the desks') ok(await page.$('button.den-deskcard'), 'the header is gone');
      eq(errs, [], 'an uncaught error reached the page');
      on = false; const again = page.locator('#den-root button:has-text("Try again")').first();
      if (await again.count()) await again.click(); else await page.locator('#den-root button:has-text("Refresh")').click();
      if (await page.$('#den-tab-' + where)) await tab(page, where);
      await seen(page, good || healthy[where]);
    } finally { w.hooks = []; await page.context().close(); }
  });
}
/* The board answers, but without the strip it was asked to carry (an older worker, or the checks failed inside it). The
   strip then asks for itself, and that read is the one made to misbehave. Guided keeps its card and draws no signal box
   in the tray; the strip above says what failed, in full, and one press recovers it. */
const noMissed = async (route, r, path) => { const res = await w.call('GET', path, null, r.headers()['x-axiom-key'] || null); const d = JSON.parse(res.text); delete d.missed; await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(d) }); return true; };
for (const mode of Object.keys(MODES)) {
  await t('the strip in Guided when the board comes without it, ' + mode + ': the page stays up, says so, and recovers', async () => {
    let on = true; w.hooks = [async (route, r, path) => { if (r.method() !== 'GET') return false; if (/^\/den\/board/.test(path)) return noMissed(route, r, path); return on && /^\/den\/missed/.test(path) ? MODES[mode](route) : false; }];
    const page = await open(w, 'full-key', { view: 'command', guided: true }); page.removeAllListeners('pageerror'); const errs = []; page.on('pageerror', e => errs.push(e.message));
    try {
      await page.evaluate(() => go('den')); await page.waitForSelector('#den-root > *', { timeout: 15000 }); await tab(page, 'today'); await seen(page, '#den-focus');   // the card does not wait for the strip
      if (mode === 'slow') { await seen(page, '.den-strip li'); ok(await alive(page)); eq([await page.locator('#den-tray-signals').count(), await page.locator('#den-focus').count()], [0, 1]); eq(errs, []); return; }
      await sleep(900); ok(await alive(page), 'the page is blank'); const msg = await said(page);
      ok(/The checks could not be loaded\./.test(msg) && /Something failed on the worker|connection to AXIOM dropped|not with what this page asked for/.test(msg), 'nothing on the page says what failed: [' + msg.slice(0, 200) + ']');
      eq([await page.locator('#den-focus').count(), await page.locator('#den-tray-signals').count(), await page.locator('.den-tray .den-traybox').count()], [1, 0, 1], 'the card is gone, or the tray lists signals the board never sent'); ok(await page.$('button.den-deskcard'), 'the header is gone');
      eq(errs, [], 'an uncaught error reached the page');
      on = false; await page.locator('#den-root .den-strip button:has-text("Try again")').click(); await seen(page, '.den-strip li'); eq([await page.locator('.den-strip.den-compact').count(), await page.locator('#den-focus').count()], [0, 1], 'recovered, the strip is drawn in full above the card');
    } finally { w.hooks = []; await page.context().close(); }
  });
}

const GUIDED = { open: { guided: true }, healthy: '#den-focus, .den-done' };
// what Guided shows: the card, what is next, the tray, the last decision, and the counts in the toolbar, the rail and the header
const guided = async p => { await p.waitForFunction(() => / decided/.test((document.querySelector('#den-step-triage') || { getAttribute: () => '' }).getAttribute('aria-label') || '') && document.querySelector('#den-focus').getAttribute('aria-busy') !== 'true');
  return p.evaluate(() => ['#den-focus .den-focus-t', '.den-next', '.den-traybox', '.den-last', '.den-toolbar .den-note', '#den-next'].map(s => (document.querySelector(s) || {}).textContent || '').concat([document.querySelector('#den-step-triage').getAttribute('aria-label')])); };
const WRITES = [
  ['a pin', /^\/den\/pin/, 'today', async p => { await p.locator('section.den-panel[aria-label="Traditional media"] tr.den-row').first().getByRole('button', { name: 'Pin' }).click(); }, async p => eq(await p.locator('tr.den-row.pinned').count(), 0, 'the row shows a pin that was not saved')],
  ['a set-aside', /^\/den\/aside/, 'today', async p => { const r = p.locator('section.den-panel[aria-label="Traditional media"] tr.den-row').first(); await r.getByRole('button', { name: 'Set aside' }).click(); await r.getByRole('button', { name: 'Set aside' }).click(); }, async p => ok(await p.locator('section.den-panel[aria-label="Traditional media"] tr.den-row').count() >= 7, 'the row left the board though the set-aside failed')],
  ['a save', /^\/den\/brief\/save/, 'brief', async p => { await p.locator('.den-sec[data-section="bottom"] textarea').fill('Words that must not be lost.'); await p.locator('.den-sec[data-section="summary"] textarea').focus(); }, async p => { eq(await p.inputValue('.den-sec[data-section="bottom"] textarea'), 'Words that must not be lost.'); ok(/Not saved: .* Your words are kept on this computer/.test(await txt(p, '.den-bar[role="status"]')), await txt(p, '.den-bar[role="status"]')); ok(await p.evaluate(() => Object.keys(localStorage).some(k => /^ax_den_work_/.test(k))), 'the words are not kept on this computer'); }],
  ['a section written again', /^\/den\/brief\/section/, 'brief', async p => { const s = p.locator('.den-sec[data-section="media"]'); await s.getByRole('button', { name: 'Regenerate this section' }).click(); await s.getByRole('button', { name: 'Write it again (1 model call)' }).click(); }, async p => ok(/^The story ran in three outlets/.test(await p.inputValue('.den-sec[data-section="media"] textarea')), 'the section changed though the call failed')],
  ['filing', /^\/den\/brief\/file/, 'brief', async p => { await p.getByRole('button', { name: 'Mark as filed' }).click(); }, async p => ok(/Draft/.test(await txt(p, '#den-tabpanel section.den-panel:visible header .den-chip')), 'it shows as filed')],
  ['an approval', /^\/den\/watch\/decide/, 'watch', async p => { const r = p.locator('section.den-panel[aria-label="Waiting for a person"] tr.den-row').first(); await r.getByRole('button', { name: 'Approve' }).click(); await r.getByRole('button', { name: 'Approve' }).click(); }, async p => ok(await p.locator('section.den-panel[aria-label="Waiting for a person"] tr.den-row').count() >= 1, 'the proposal left the queue')],
  ['finding keywords', /^\/den\/discover/, 'watch', async p => { await p.getByRole('button', { name: 'Find new keywords now (free)' }).click(); }, async p => ok(await p.getByRole('button', { name: 'Find new keywords now (free)' }).isEnabled(), 'the button stayed locked')],
  ['collect now', /^\/den\/collect$/, 'collection', async p => { await p.locator('section.den-panel[aria-label="Channels"] tr.den-row', { hasText: 'Bluesky' }).getByRole('button', { name: 'Collect now' }).click(); }, async p => ok(!(await p.$('#den-root .sig-con')), 'a console opened for a job that was never made')],
  ['a switch', /^\/den\/reach/, 'collection', async p => { await p.locator('section.den-panel[aria-label="Signed-in collection"] tr', { hasText: 'Facebook' }).getByRole('button', { name: 'Switch off' }).click(); }, async p => ok(/allowed/.test(await p.locator('section.den-panel[aria-label="Signed-in collection"] tr', { hasText: 'Facebook' }).textContent()), 'it shows as switched off')],
  ['the options', /^\/den\/desk\/update/, 'options', async p => { await p.locator('section.den-panel[aria-label="The desk"] input[type="number"]').fill('36'); await p.getByRole('button', { name: 'Save options' }).click(); }, async p => { eq(await p.inputValue('section.den-panel[aria-label="The desk"] input[type="number"]'), '36', 'what was typed is gone'); ok(/Not saved/.test(await txt(p, '.den-optbar .den-save'))); }],
  // [5] how the page is opened and what a healthy page shows. In Guided a decision that fails leaves the card, the queue, the tray and every count as they were.
  ['a keep in Guided', /^\/den\/pin/, 'today', async p => { p.was = await guided(p); await p.locator('#den-focus').getByRole('button', { name: 'Keep for the report', exact: true }).click(); }, async p => { eq(await guided(p), p.was, 'the card or a count moved though the keep failed'); ok(await p.locator('#den-focus').getByRole('button', { name: 'Keep for the report', exact: true }).isEnabled(), 'the card stayed locked'); }, GUIDED],
  ['a set-aside in Guided', /^\/den\/aside/, 'today', async p => { p.was = await guided(p); await p.locator('#den-focus').getByRole('button', { name: 'Set aside', exact: true }).click(); }, async p => { eq(await guided(p), p.was, 'the card or a count moved though the set-aside failed'); ok(await p.locator('#den-focus').getByRole('button', { name: 'Set aside', exact: true }).isEnabled(), 'the card stayed locked'); }, GUIDED],
];
for (const [name, rx, where, act, check, how] of WRITES) for (const mode of ['failing', 'dropped']) {
  await t(name + ', ' + mode + ': it is said, nothing is lost, and nothing pretends to have happened', async () => {
    w.hooks = [async (route, r, path) => (r.method() === 'POST' && rx.test(path) ? MODES[mode](route) : false)];
    const page = await open(w, 'full-key', how ? how.open : undefined); const errs = []; page.removeAllListeners('pageerror'); page.on('pageerror', e => errs.push(e.message));
    try {
      await tab(page, where); await seen(page, (how && how.healthy) || healthy[where] || 'section.den-panel[aria-label="The desk"]');
      await act(page); await sleep(900);
      const msg = (await toast(page)) + ' || ' + (await said(page)) + ' || ' + (await txt(page, '.den-bar[role="status"]').catch(() => ''));
      ok(/Something failed on the worker|connection to AXIOM dropped|connection dropped while the worker was writing|Not saved/.test(msg), 'nothing says it failed: [' + msg.slice(0, 240) + ']');
      await check(page); eq(errs, [], 'an uncaught error reached the page'); ok(await alive(page));
    } finally { w.hooks = []; await page.context().close(); }
  });
}
await t('Guided when the board answers without the strip: the tray has no signal box, and the strip asks for itself and is drawn in full', async () => {
  w.hooks = [async (route, r, path) => (r.method() === 'GET' && /^\/den\/board/.test(path) ? noMissed(route, r, path) : false)];
  const page = await open(w, 'full-key', { guided: true }); const errs = []; page.removeAllListeners('pageerror'); page.on('pageerror', e => errs.push(e.message));
  try {
    await seen(page, '.den-strip li'); eq([await page.locator('#den-focus').count(), await page.locator('#den-tray-signals').count(), await page.locator('.den-tray .den-traybox').count(), await page.locator('.den-strip.den-compact').count()], [1, 0, 1, 0]);
    ok(await page.locator('.den-strip').getByRole('button', { name: 'Fold', exact: true }).isVisible(), 'the strip is not the whole strip'); ok(page.served.some(s => /^GET \/den\/missed/.test(s)), 'the strip did not ask for itself');
    await page.waitForFunction(() => /\d+ of \d+ decided/.test(document.querySelector('#den-step-triage').getAttribute('aria-label')));   // the day's run rides on the strip's own answer
    eq([await said(page), errs], ['', []], 'something is said to have failed'); ok(await alive(page));
  } finally { w.hooks = []; await page.context().close(); }
});
await t('Guided when the read after a decision fails: it is said, the decision stands, and the card can still be used', async () => {
  const w2 = await world(); let on = false; w2.hooks = [async (route, r, path) => (on && r.method() === 'GET' && /^\/den\/board/.test(path) ? MODES.failing(route) : false)];   // its own world: these decisions are saved
  const page = await open(w2, 'full-key', { guided: true }); const errs = []; page.removeAllListeners('pageerror'); page.on('pageerror', e => errs.push(e.message));
  try {
    const head = () => page.locator('#den-focus .den-focus-t').textContent(); const keep = () => page.locator('#den-focus').getByRole('button', { name: 'Keep for the report', exact: true }); const rail = () => page.getAttribute('#den-step-triage', 'aria-label');
    const moved = was => page.waitForFunction(h => { const e = document.querySelector('#den-focus'); return !!e && e.getAttribute('aria-busy') !== 'true' && e.querySelector('.den-focus-t').textContent !== h; }, was);
    const h1 = await head(); on = true; await keep().click(); await moved(h1); await page.waitForSelector('#den-root .den-notice.bad[role="alert"]', { timeout: 15000 });
    ok(/The board could not be refreshed: Something failed on the worker.* What is shown is the last read\./.test(await said(page)), await said(page));
    ok(/: 1 of \d+ decided$/.test(await rail()) && (await txt(page, '.den-traybox')).indexOf(h1) >= 0 && await keep().isEnabled(), 'the decision was lost, or the card is locked: ' + await rail());
    const h2 = await head(); on = false; await keep().click(); await moved(h2); await page.waitForSelector('#den-root .den-notice.bad', { state: 'detached', timeout: 15000 }); await page.waitForFunction(() => /: 2 of \d+ decided$/.test(document.querySelector('#den-step-triage').getAttribute('aria-label')));
    await sleep(2200); eq([await said(page), (await w2.F('GET', '/den/board?desk=aep_au')).body.progress.kept, errs], ['', 2, []]); ok(await alive(page));
  } finally { w2.hooks = []; await page.context().close(); }
});
await finish();
