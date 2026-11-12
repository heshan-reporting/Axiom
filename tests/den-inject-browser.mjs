/* Anne's Den with its routes failing, one at a time (prompts/annes-den.md Phase 7): every read the page makes is made to
 * fail, to answer with a gateway's page, to answer with the wrong shape, to hang and then answer, and to drop the
 * connection; and every write is made to fail and to drop. For each: the page is never blank, the failure is said in
 * words, nothing a person typed is lost, and one press recovers once the route answers again. Providers are stubbed and
 * nothing is spent. Run: node --experimental-sqlite tests/den-inject-browser.mjs */
import { world, open, t, ok, eq, txt, tab, toast, finish } from './den-fixture.mjs';

console.log('den-inject-browser harness (every Den route failing, slow and malformed, one at a time)');
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); await w.F('POST', '/den/discover', { ns: 'aep' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const READS = [['the desks', /^\/den\/desks/, 'today'], ['the board', /^\/den\/board/, 'today'], ['the strip', /^\/den\/missed/, 'brief'], ['the brief', /^\/den\/brief\?/, 'brief'], ['the register', /^\/den\/watch\?/, 'watch'], ['the lexicon', /^\/den\/lexicon/, 'watch'], ['the themes', /^\/den\/themes/, 'watch'], ['collection', /^\/den\/collection/, 'collection']];
const MODES = {
  failing: async route => { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.', requestId: 'r1' }) }); return true; },
  'a gateway page': async route => { await route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>502 Bad Gateway</body></html>' }); return true; },
  'the wrong shape': async route => { await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); return true; },
  dropped: async route => { await route.abort('connectionreset'); return true; },
  slow: async () => { await sleep(1200); return false; },
};
const alive = page => page.evaluate(() => { const r = document.getElementById('den-root'); return !!r && r.textContent.replace(/\s+/g, ' ').trim().length > 40; });
const said = page => page.evaluate(() => Array.from(document.querySelectorAll('#den-root .den-state.err, #den-root .den-notice.bad, #den-root [role="alert"]')).map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' || '));
const healthy = { today: 'section.den-panel[aria-label="Traditional media"] tr.den-row', brief: '.den-sec[data-section="summary"] textarea', watch: 'section.den-panel[aria-label="Waiting for a person"]', collection: 'section.den-panel[aria-label="Channels"] tr.den-row' };

for (const [name, rx, where] of READS) for (const mode of Object.keys(MODES)) {
  await t(name + ', ' + mode + ': the page stays up, says so, and recovers', async () => {
    let on = true; w.hooks = [async (route, r, path) => (on && r.method() === 'GET' && rx.test(path) ? MODES[mode](route) : false)];
    const page = await open(w, 'full-key', { view: 'command' }); page.removeAllListeners('pageerror'); const errs = []; page.on('pageerror', e => errs.push(e.message));
    try {
      await page.evaluate(() => go('den')); await page.waitForSelector('#den-root > *', { timeout: 15000 }); if (await page.$('#den-tab-' + where)) await tab(page, where).catch(() => {});
      if (mode === 'slow') { await page.waitForSelector('#den-root ' + healthy[where] + ':visible', { timeout: 20000 }); ok(await alive(page)); eq(errs, []); return; }
      await sleep(900); ok(await alive(page), 'the page is blank'); const msg = await said(page);
      ok(/could not be loaded|could not be refreshed|stopped working|connection to AXIOM dropped|not with what this page asked for|Something failed on the worker/.test(msg), 'nothing on the page says what failed: [' + msg.slice(0, 200) + ']');
      if (name !== 'the desks') ok(await page.$('button.den-deskcard'), 'the header is gone');
      eq(errs, [], 'an uncaught error reached the page');
      on = false; const again = page.locator('#den-root button:has-text("Try again")').first();
      if (await again.count()) await again.click(); else await page.locator('#den-root button:has-text("Refresh")').click();
      if (await page.$('#den-tab-' + where)) await tab(page, where);
      await page.waitForSelector('#den-root ' + healthy[where] + ':visible', { timeout: 20000 });
    } finally { w.hooks = []; await page.context().close(); }
  });
}

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
];
for (const [name, rx, where, act, check] of WRITES) for (const mode of ['failing', 'dropped']) {
  await t(name + ', ' + mode + ': it is said, nothing is lost, and nothing pretends to have happened', async () => {
    w.hooks = [async (route, r, path) => (r.method() === 'POST' && rx.test(path) ? MODES[mode](route) : false)];
    const page = await open(w, 'full-key'); const errs = []; page.removeAllListeners('pageerror'); page.on('pageerror', e => errs.push(e.message));
    try {
      await tab(page, where); await page.waitForSelector('#den-root ' + (healthy[where] || 'section.den-panel[aria-label="The desk"]') + ':visible', { timeout: 20000 });
      await act(page); await sleep(900);
      const msg = (await toast(page)) + ' || ' + (await said(page)) + ' || ' + (await txt(page, '.den-bar[role="status"]').catch(() => ''));
      ok(/Something failed on the worker|connection to AXIOM dropped|connection dropped while the worker was writing|Not saved/.test(msg), 'nothing says it failed: [' + msg.slice(0, 240) + ']');
      await check(page); eq(errs, [], 'an uncaught error reached the page'); ok(await alive(page));
    } finally { w.hooks = []; await page.context().close(); }
  });
}
await finish();
