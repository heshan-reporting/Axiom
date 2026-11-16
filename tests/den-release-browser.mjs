/* Anne's Den release (p67, r52), what the four release reviews found on the page, against the worker module in this
 * process behind a real Chromium. Every outlet, account and person is invented. Each case failed before the fixes of
 * 16 November 2026.
 *   RB1 a rating changed, then a section written again: the rating survives, and no conflict names someone else
 *   RB2 a save that failed, then a section written again: no false "someone else saved" banner
 *   RB3 leaving the editor while the previous save is in flight: the later words are saved too
 *   RB4 Regenerate pressed where the button takes no focus (Safari and Firefox on macOS): one press opens its choices
 *   RB5 the editor's Escape lands on the section's Edit button; the rewrite form takes the focus and Cancel gives it back;
 *       the history drawer takes the focus, closes on Escape and gives it back to History
 *   RB6 the guide: Back from "Start the brief" stays on "Open the brief"; the Keyboard sheet's tour keeps the focus in the
 *       guide menu; the menu's Escape gives the focus back to Guide; the welcome modal holds the Den's own keys; somebody
 *       who never started the guide is not asked "again"
 *   RB7 Watch: Enter pressed twice in the Add box sends one add
 * Run: node --experimental-sqlite tests/den-release-browser.mjs (binds a local port: sandbox off) */
import { world, open, t, ok, eq, txt, tab, finish, sec } from './den-fixture.mjs';

console.log('Anne\'s Den release: what the reviews found on the page');
const S = '.den-sec[data-section="summary"]', B = '.den-sec[data-section="bottom"]';
const saves = p => p.served.filter(x => x === 'POST /den/brief/save').length;
const status = p => txt(p, '.den-bar[role="status"]');
const who = p => p.evaluate(() => { const a = document.activeElement; if (!a) return 'null'; return a === document.body ? 'BODY' : a.tagName + '[' + (a.getAttribute('data-tour') || '') + '] ' + (a.getAttribute('aria-label') || a.textContent || '').trim().slice(0, 40); });
const editAt = async (p, q) => { await p.locator(q + ' .den-modes button', { hasText: 'Edit' }).click(); await p.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA'); await p.locator(q + ' textarea').evaluate(e => e.setSelectionRange(e.value.length, e.value.length)); };
const notices = p => p.evaluate(() => Array.from(document.querySelectorAll('.den-notice')).map(n => n.textContent.replace(/\s+/g, ' ').trim()));
const brief = async () => { const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); const p = await open(w); await tab(p, 'brief'); await p.waitForSelector(S + ' textarea'); return { w, p }; };

await t('RB1 a rating changed, then a section written again: the rating survives', async () => {
  const { p } = await brief(); await sec(p, 'momentum'); const sel = p.locator('.den-sec[data-section="momentum"] .den-bar select').first();
  const before = await sel.inputValue(); const pick = (await sel.locator('option').evaluateAll(o => o.map(x => x.value).filter(Boolean))).find(v => v !== before);
  await sel.selectOption(pick); ok(/Unsaved changes/.test(await status(p)), await status(p));
  await sec(p, 'bottom'); await p.locator(B + ' [data-tour="regen"]').click(); await p.locator(B + ' [data-tour="regen-go"]').click();
  await p.waitForFunction(() => !document.querySelector('[data-tour="progress"]'), null, { timeout: 15000 }); await p.waitForTimeout(500);
  await sec(p, 'momentum'); eq(await p.locator('.den-sec[data-section="momentum"] .den-bar select').first().inputValue(), pick, 'the rating the person picked is kept');
  ok(!(await notices(p)).some(n => /saved this brief after you opened it/.test(n)), 'no conflict for the person\'s own rewrite'); eq(p.errors, []); await p.context().close();
});

await t('RB2 a save that failed, then a section written again: no false conflict, and the words are saved first', async () => {
  const { w, p } = await brief(); let failSave = true;
  w.hooks.push(async (route, r, path) => { if (failSave && r.method() === 'POST' && path === '/den/brief/save') { failSave = false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'boom', detail: 'Temporary failure.' }) }); return true; } return false; });
  await editAt(p, S); await p.keyboard.type(' Kept words.'); await p.keyboard.press('Escape'); await p.waitForTimeout(400); ok(/Not saved/.test(await status(p)), await status(p));
  await sec(p, 'bottom'); await p.locator(B + ' [data-tour="regen"]').click(); await p.waitForSelector(B + ' [data-tour="regen-form"]');
  await p.locator(B + ' [data-tour="regen-go"]').click(); await p.waitForFunction(() => !document.querySelector('[data-tour="progress"]'), null, { timeout: 15000 }); await p.waitForTimeout(500);
  ok(!(await notices(p)).some(n => /saved this brief after you opened it/.test(n)), JSON.stringify(await notices(p)));
  ok(/Kept words\.$/.test((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.summary.text), 'the kept words reached the worker before the rewrite'); await p.context().close();
});

await t('RB3 leaving the editor while the previous save is in flight: the later words are saved too', async () => {
  const { w, p } = await brief(); let slow = 1500;
  w.hooks.push(async (route, r, path) => { if (r.method() === 'POST' && path === '/den/brief/save' && slow) await new Promise(x => setTimeout(x, slow)); return false; });
  await editAt(p, S); await p.keyboard.type(' First words.'); await p.keyboard.press('Escape'); await p.waitForSelector(S + '[data-mode="read"]');
  await p.waitForTimeout(150); await editAt(p, S); await p.keyboard.type(' Second words.'); await p.keyboard.press('Escape');
  await p.waitForTimeout(4000); slow = 0;
  ok(/First words\. Second words\.$/.test((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.summary.text), 'both leaves were saved: ' + saves(p) + ' saves, ' + await status(p));
  ok(/^Saved/.test(await status(p)), await status(p)); await p.context().close();
});

await t('RB4 Regenerate pressed where the button takes no focus: one press opens its choices', async () => {
  const { w, p } = await brief(); await sec(p, 'bottom'); let slow = 400;
  w.hooks.push(async (route, r, path) => { if (slow && r.method() === 'POST' && path === '/den/brief/save') await new Promise(x => setTimeout(x, slow)); return false; });
  await editAt(p, B); await p.keyboard.type(' x');
  await p.locator(B + ' textarea').evaluate(e => e.blur()); await p.locator(B + ' [data-tour="regen"]').evaluate(b => b.click());
  await p.waitForTimeout(1200); eq(await p.locator(B + ' [data-tour="regen-form"]').count(), 1, 'one press'); await p.context().close();
});

await t('RB5 focus after Escape, around the rewrite form and the history drawer', async () => {
  const { p } = await brief();
  await editAt(p, S); await p.keyboard.press('Escape'); await p.waitForSelector(S + '[data-mode="read"]'); ok(/^BUTTON\[edit\]/.test(await who(p)), 'Escape lands on Edit: ' + await who(p));
  eq(await p.locator(S + ' textarea').getAttribute('aria-hidden'), 'true', 'reading, the raw text is out of the accessibility tree'); eq(await p.locator(S + ' textarea').getAttribute('tabindex'), '-1');
  await p.focus(S + ' [data-tour="regen"]'); await p.keyboard.press('Enter'); await p.waitForSelector(S + ' [data-tour="regen-form"]'); await p.waitForTimeout(150);
  ok(/^INPUT/.test(await who(p)), 'the form takes the focus: ' + await who(p));
  await p.focus(S + ' [data-tour="regen-cancel"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(150); ok(/^BUTTON\[regen\]/.test(await who(p)), 'Cancel gives it back to Regenerate: ' + await who(p));
  await p.focus('[data-tour="history"]'); await p.keyboard.press('Enter'); await p.waitForSelector('.den-drawer'); await p.waitForTimeout(200);
  ok(/Close the history/.test(await who(p)), 'the drawer takes the focus: ' + await who(p));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); eq(await p.locator('.den-drawer').count(), 0, 'Escape closes it'); ok(/^BUTTON\[history\]/.test(await who(p)), 'and the focus is back on History: ' + await who(p));
  eq(p.errors, []); await p.context().close();
});

await t('RB6 the guide: Back stays, the sheet\'s tour and the menu keep the focus, the welcome holds the keys, "again" only after a run', async () => {
  const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' });
  const p = await open(w, null, { tour: true }); await p.evaluate(() => localStorage.setItem('ax_den_tour', JSON.stringify({ v: 1, status: 'done', ask: 'never' })));
  await tab(p, 'brief'); await p.waitForSelector(S + ' textarea');
  await p.evaluate(() => window.DenTour.start('start')); await p.waitForTimeout(600);
  await p.locator('#den-tour').getByRole('button', { name: 'Back', exact: true }).click();
  const seen = []; for (let i = 0; i < 10; i++) { await p.waitForTimeout(150); seen.push((await p.evaluate(() => window.DenTour.state())).step); }
  ok(seen.every(s => s === 'write'), 'Back landed on "Open the brief" and stayed: ' + seen.join(' '));
  await p.evaluate(() => window.DenTour.stop());
  await p.locator('[data-tour="help"]').click(); await p.locator('[data-tour="replay"]').click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !!document.activeElement.closest('#den-tour')), 'the Keyboard sheet\'s tour leaves the focus in the guide menu: ' + await who(p));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200); ok(/^BUTTON\[(guide|help)\]/.test(await who(p)), 'the menu\'s Escape gives the focus back where it was (the ? button it was opened from), never the body: ' + await who(p));
  await p.context().close();
  const q = await open(w, null, { tour: true }); await q.waitForSelector('#den-tour [role="dialog"]', { timeout: 20000 });
  const before = await q.evaluate(() => document.querySelector('#den-tab-brief').getAttribute('aria-selected')); await q.keyboard.press('Alt+2'); await q.keyboard.press('?'); await q.waitForTimeout(300);
  eq(await q.evaluate(() => document.querySelector('#den-tab-brief').getAttribute('aria-selected')), before, 'Alt+2 does not switch the tab behind the welcome');
  eq(await q.locator('#den-root [role="dialog"]').count(), 0, '? opens no Den dialog behind it'); ok(await q.evaluate(() => !!document.activeElement.closest('#den-tour')), 'the focus stays in the welcome');
  await q.locator('#den-tour').getByRole('button', { name: 'I\'ll do it later' }).click();
  await q.reload(); await q.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function'); await q.evaluate(() => go('den'));
  await q.waitForSelector('#den-tour .dt-prompt', { timeout: 20000 }); ok(/Want a guided tour of the Den\?/.test(await txt(q, '#den-tour .dt-prompt')) && !/again/.test(await txt(q, '#den-tour .dt-prompt h2')), 'never started: ' + await txt(q, '#den-tour .dt-prompt h2'));
  await q.context().close();
});

await t('RB7 Watch: Enter pressed twice in the Add box sends one add', async () => {
  const w = await world(); const p = await open(w); await tab(p, 'watch');
  await p.waitForSelector('section.den-panel[aria-label="Add to the register"] input');
  let slow = 600; w.hooks.push(async (route, r, path) => { if (r.method() === 'POST' && path === '/den/watch/add' && slow) await new Promise(x => setTimeout(x, slow)); return false; });
  const inp = p.locator('section.den-panel[aria-label="Add to the register"] input').first(); await inp.fill('coal seam levy');
  await inp.press('Enter'); await inp.press('Enter'); await p.waitForTimeout(1500); slow = 0;
  eq(p.served.filter(x => x === 'POST /den/watch/add').length, 1, 'one add'); await p.context().close();
});

await finish();
