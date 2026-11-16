/* The guided tour of Anne's Den (docs/den-tour.js) in a real browser, on the Den fixture: docs/ served from this
 * worktree, the worker in this process, a stub model that counts its calls (w.calls). Nothing is contacted and nothing
 * is spent. The tour is driven only the way a person drives it: the control under the ring is pressed with the mouse,
 * typed into, dragged; the coach card's own buttons are used only where the card says a step is shown, not done.
 *   first visit, the ring and what covers it, the whole walk from step 1 to step 24, the paid step, resume after a
 *   reload (and the routing micro-steps), "Want the guide again?", a read-only key, an empty desk, reduced motion,
 *   the keyboard, and a static read of the file for the four things it must never contain.
 * Run: node --experimental-sqlite tests/den-tour-browser.mjs   (binds a local port: run it with the sandbox off) */
import fs from 'node:fs';
import { world, open, t as test, ok, eq, txt, finish } from './den-fixture.mjs';

console.log('den-tour-browser harness');
const t = (name, fn) => (!process.env.ONLY || name.indexOf(process.env.ONLY) >= 0 ? test(name, fn) : Promise.resolve());   // ONLY=<part of a name> runs that case alone
const SRC = fs.readFileSync(new URL('../docs/den-tour.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../docs/den-tour.css', import.meta.url), 'utf8');
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

const S = p => p.evaluate(() => (window.DenTour ? window.DenTour.state() : null));
// the tour is on step `id` (and its phase, when given), with no "Done" flash in progress
const at = (p, id, phase) => p.waitForFunction(([id, ph]) => { const s = window.DenTour && window.DenTour.state(); return !!(s && s.status === 'active' && s.step === id && s.view && !s.view.flash && (!ph || s.view.phase === ph)); }, [id, phase || ''], { timeout: 15000 })
  .catch(async () => { throw new Error('not at ' + id + (phase ? '/' + phase : '') + ': ' + JSON.stringify(await S(p)).slice(0, 500)); });
const until = (p, fn, what) => p.waitForFunction(fn, null, { timeout: 15000 }).catch(async () => { throw new Error('waited for ' + what + ': ' + JSON.stringify(await S(p)).slice(0, 600)); });
const B = (p, name) => p.locator('#den-tour').getByRole('button', { name, exact: true });
const rings = p => p.$$eval('#den-tour .dt-ring', r => r.filter(x => getComputedStyle(x).display !== 'none').map(x => { const b = x.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }));
// press what is under the middle of ring i: the control a person is shown
const press = async (p, i) => { await p.waitForTimeout(120); const r = (await rings(p))[i || 0]; ok(r, 'a ring is drawn'); await p.mouse.click(r.x + r.w / 2, r.y + r.h / 2); };
const under = async (p, i, sel) => { const r = (await rings(p))[i || 0]; ok(r, 'a ring is drawn'); return p.evaluate(([x, y, sel]) => { const el = document.elementFromPoint(x, y); const h = el && el.closest(sel); return h ? (h.dataset.key || h.dataset.sec || h.dataset.goto || h.id || h.getAttribute('data-tour')) : ''; }, [r.x + r.w / 2, r.y + r.h / 2, sel]); };
// the ringed control is the hook asked for, it is not covered (what is hit at its middle is it), the ring is around it
// and the coach card does not overlap it
const clear = async (p, sel) => { await p.waitForTimeout(450); return p.evaluate(sel => {
  const el = Array.from(document.querySelectorAll('#den-root ' + sel)).find(e => e.getClientRects().length && !e.closest('[hidden]')); if (!el) return 'no ' + sel;
  const b = el.getBoundingClientRect(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2; const hit = document.elementFromPoint(cx, cy);
  if (!hit || !(el === hit || el.contains(hit))) return sel + ' is covered by ' + (hit ? hit.outerHTML.slice(0, 90) : 'nothing');
  const c = document.querySelector('#den-tour .dt-card'); if (c) { const r = c.getBoundingClientRect(); if (r.x < b.right && r.right > b.x && r.y < b.bottom && r.bottom > b.y) return 'the coach card overlaps ' + sel; }
  const g = document.querySelector('#den-tour .dt-ring'); if (!g) return 'no ring'; const q = g.getBoundingClientRect();
  if (!(q.x <= b.x + 1 && q.y <= b.y + 1 && q.right >= b.right - 1 && q.bottom >= b.bottom - 1)) return 'the ring is not around ' + sel; return ''; }, sel); };   // one tick of the guide (400 ms) to settle after the page moves
const denPosts = p => p.served.filter(s => /^POST \/den\//.test(s));
const axe = async (p, where) => { await p.waitForTimeout(400); if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  const v = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#den-tour'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' ' + x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')); });
  const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  return v.map(x => where + ': ' + x).concat(over ? [where + ': the page scrolls sideways'] : []); };
const reopen = async p => { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function', null, { timeout: 20000 });
  await p.evaluate(() => go('den')); await p.waitForSelector('#den-app', { timeout: 20000 }); await p.waitForSelector('.den-strip ul, .den-strip .den-state', { timeout: 20000 }); };
const startAt = async (p, id) => { await p.evaluate(id => window.DenTour.start(id), id); };

await t('a first visit opens the welcome, and nothing is asked of the worker or the model', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true });
  await p.waitForSelector('#den-tour [role="dialog"][aria-modal="true"]', { timeout: 15000 });
  const wel = await txt(p, '#den-tour [role="dialog"]'); ok(/Welcome to Anne's Den/.test(wel) && /AEP national/.test(wel) && /1 model call/.test(wel) && /About 6 minutes/.test(wel), wel);
  for (const n of ['Start the guide', 'I\'ll do it later', 'Don\'t ask again']) ok(await B(p, n).isVisible(), n);
  eq(await p.evaluate(() => document.activeElement && document.activeElement.textContent), 'Start the guide', 'the focus is on Start');
  eq(w.calls.length, 0, 'no model call'); eq(p.served.filter(s => /^POST /.test(s)), [], 'no POST at all'); eq((await S(p)).status || 'none', 'none', 'nothing is recorded before an answer');
  ok(await p.evaluate(() => typeof window.DenTour.open === 'function' && !!document.querySelector('[data-tour="guide"]')), 'the Guide button is drawn beside ?');
  const bad = await axe(p, 'welcome'); await p.keyboard.press('Escape'); await p.waitForSelector('#den-tour [role="dialog"]', { state: 'detached' });
  eq((await S(p)).status, 'dismissed', 'Escape is "I\'ll do it later"'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('the ringed control is the one to press, nothing covers it, and the card names it in words', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click();
  await at(p, 'desk'); eq(await clear(p, '[data-tour="desk"]'), '', 'step 1'); ok(/Step 1 of 24/.test(await txt(p, '#den-tour .dt-card')) && /Choose your desk/.test(await txt(p, '#den-tour .dt-card h2')));
  eq(await p.getAttribute('#den-tour [role="progressbar"]', 'aria-valuenow'), '1'); eq(await p.evaluate(() => getComputedStyle(document.querySelector('#den-tour svg')).pointerEvents), 'none', 'the spotlight takes no pointer');
  await startAt(p, 'checks'); await at(p, 'checks'); eq(await clear(p, '[data-tour="check"][data-n]:not([data-n="0"])'), '', 'step 3 rings a check with findings');
  await startAt(p, 'pin'); await at(p, 'pin'); const key = await under(p, 0, '[data-tour="card"]'); ok(key, 'the pin ring sits on a card');
  eq(await clear(p, '[data-tour="card"][data-key="' + key + '"] [data-tour="card-pin"]'), '', 'step 6 rings that card\'s Pin');
  ok(/Everyone on this desk sees the pin/.test(await txt(p, '#den-tour .dt-card')), 'a step that writes says who sees it and how to undo it');
  const bad = await axe(p, 'a do-step');
  await startAt(p, 'drag'); await at(p, 'drag'); const r = await rings(p); eq(r.length, 2, 'two holes on the drag step');
  const src = await under(p, 0, '[data-tour="card"]'), dst = await under(p, 1, '[data-tour="col"]'); ok(src && dst, 'from a card to a column: ' + src + ' -> ' + dst);
  ok(await B(p, 'Can\'t drag? Use the card\'s menu').isVisible(), 'a drag always has a way without dragging');
  eq(w.calls.length, 0); eq(denPosts(p), [], 'pointing posts nothing'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('from step 1 to step 24 each step advances only on the real action, and only the Den\'s own Draft spends', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click();
  const still = async id => { await p.waitForTimeout(350); eq((await S(p)).step, id, 'a press elsewhere does not advance ' + id); };
  await at(p, 'desk'); await p.dispatchEvent('.den-brand', 'click'); await still('desk'); await B(p, 'Keep AEP national').click();
  await at(p, 'day'); await B(p, 'Got it').click();
  await at(p, 'checks'); await press(p); await at(p, 'checks', 'close'); await p.keyboard.press('Escape');
  await at(p, 'card'); await press(p);
  await at(p, 'find'); await p.fill('#den-root [data-tour="search"]', 'ha'); await at(p, 'find', 'reset'); await p.fill('#den-root [data-tour="search"]', '');
  await at(p, 'pin'); eq(denPosts(p), [], 'nothing was posted before the person\'s first write'); await p.dispatchEvent('#den-root [data-tour="filter"] [data-kind="all"]', 'click'); await still('pin');
  const pinKey = await under(p, 0, '[data-tour="card"]'); await press(p);
  await at(p, 'aside'); ok(denPosts(p).some(s => /^POST \/den\/pin/.test(s)), 'the pin was the person\'s press'); await p.waitForSelector('[data-tour="card"][data-key="' + pinKey + '"][data-pinned="1"]');
  await press(p); await at(p, 'aside', 'form'); await p.click('#den-root [data-tour="aside-form"] [data-tour="aside-cancel"]');
  await at(p, 'drag'); const from = await under(p, 0, '[data-tour="card"]'), to = await under(p, 1, '[data-tour="col"]'); eq(from, pinKey, 'the card pinned is the one to drag');
  await p.locator('#den-root [data-tour="card"][data-key="' + from + '"]').dragTo(p.locator('#den-root [data-tour="col"][data-sec="' + to + '"]'));
  await at(p, 'key'); await p.waitForSelector('#den-root [data-tour="col"][data-sec="' + to + '"] [data-key="' + from + '"]');
  const k = (await S(p)).view.key; ok(/^[0-9]$/.test(k), 'the card says which number to press: ' + k); await press(p); await p.keyboard.press(k);
  await at(p, 'write'); await press(p);
  await at(p, 'start'); eq(w.calls.length, 0, 'no model call up to the paid step'); ok(/1 model call/.test(await txt(p, '#den-tour .dt-card')) && /20 of 20 left today/.test(await txt(p, '#den-tour .dt-card')), 'the paid step states the live cost');
  ok(!(await p.locator('#den-tour .dt-card button[data-paid]').count()), 'no button on the card spends'); await still('start'); eq(w.calls.length, 0);
  await p.click('#den-root [data-tour="draft"]'); await at(p, 'outline'); eq(w.calls.length, 1, 'exactly one model call, from the Den\'s own button');
  await press(p); await at(p, 'edit');
  if (!(await p.locator('#den-root [data-tour="editor"]:visible').count())) await press(p);
  await p.locator('#den-root [data-tour="editor"]:visible').click(); await p.keyboard.press('End'); await p.keyboard.type(' The guide was here.');
  await at(p, 'cite'); await press(p);
  await at(p, 'jump'); await press(p);
  // leaving the text to press the chip saved it; new words make the save step one the person does
  await at(p, 'save'); if ((await S(p)).view.mode === 'show') { await p.locator('#den-root [data-tour="editor"]:visible').click(); await p.keyboard.press('End'); await p.keyboard.type(' Saved by hand.'); await p.waitForFunction(() => window.DenTour.state().view.mode === 'do'); }
  const saves = denPosts(p).filter(s => /brief\/save/.test(s)).length; await press(p);
  await at(p, 'regen'); ok(denPosts(p).filter(s => /brief\/save/.test(s)).length > saves, 'saved by the person\'s press'); await press(p); await at(p, 'regen', 'form'); await p.click('#den-root [data-tour="regen-cancel"]');
  await at(p, 'history'); await press(p); await at(p, 'history', 'close'); await press(p);
  await at(p, 'foot'); await B(p, 'Got it').click();
  await at(p, 'export'); await press(p); await at(p, 'export', 'pick'); await p.click('#den-root [data-tour="export-menu"] button:has-text("Copy the Slack summary")');
  await at(p, 'file'); await press(p);
  await p.waitForFunction(() => document.querySelector('#den-root [data-tour="file-dialog"]') || document.querySelector('#den-root [data-tour="status"][data-status="filed"]'));
  if (await p.locator('#den-root [data-tour="file-dialog"]').count()) { await at(p, 'file', 'dialog'); await p.locator('#den-root [data-tour="file-dialog"]').getByRole('button', { name: 'File anyway' }).click(); }
  await at(p, 'watch'); ok(await p.$('#den-root [data-tour="status"][data-status="filed"]'), 'filed by the person'); await press(p); await at(p, 'watch', 'look'); await B(p, 'Got it').click();
  await at(p, 'collection'); await press(p); await at(p, 'collection', 'look'); await B(p, 'Got it').click();
  await at(p, 'options'); await press(p); await at(p, 'options', 'look'); await B(p, 'Got it').click();
  await p.waitForSelector('#den-tour [role="dialog"]'); const fin = await txt(p, '#den-tour [role="dialog"]'); ok(/That is a full day on AEP national/.test(fin) && /pinned 1 card/.test(fin), fin);
  const s = await S(p); eq(s.done.length, 24, 'every one of the 24 steps was done, none skipped: ' + JSON.stringify(s.skipped)); eq(s.skipped, []);
  await B(p, 'Back to the Board').click(); eq((await S(p)).status, 'done'); eq(w.calls.length, 1, 'one model call in all'); eq(p.errors, []); await p.context().close();
});

await t('the paid step: the sample path spends nothing and is labelled; the Den\'s own Draft spends exactly one call', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'I\'ll do it later').click();
  await startAt(p, 'start'); await at(p, 'start'); if ((await S(p)).view.mode === 'route') { await press(p); await at(p, 'start'); }
  eq(await clear(p, '[data-tour="draft"]'), '', 'the Draft button is pointed at, not pressed'); ok(/Costs 1 model call/.test(await txt(p, '#den-tour .dt-cost')), 'a cost badge');
  const bad = await axe(p, 'the paid step');
  await B(p, 'Skip: show me with a sample').click(); await at(p, 'outline'); ok(/Sample: not your desk's data/.test(await txt(p, '#den-tour .dt-card')), 'the sample says it is a sample');
  for (const id of ['outline', 'edit', 'cite', 'jump', 'save', 'regen', 'history', 'foot', 'export', 'file']) { await at(p, id); ok(/Sample: not your desk's data/.test(await txt(p, '#den-tour .dt-card')), id + ' is a labelled sample'); await B(p, 'Got it').click(); }
  await at(p, 'watch'); eq(w.calls.length, 0, 'the sample path made no model call'); eq(denPosts(p), [], 'and posted nothing');
  await startAt(p, 'start'); await at(p, 'start'); await p.click('#den-root [data-tour="draft"]'); await p.waitForSelector('#den-tour .dt-card .dt-status:has-text("Writing")', { timeout: 8000 }).catch(() => {});
  await at(p, 'outline'); eq(w.calls.length, 1, 'one call, from the Den\'s own button'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('a reload resumes at the same step; a wrong tab, a past day and unsaved words are each one press away', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click(); await at(p, 'desk');
  await startAt(p, 'drag'); await at(p, 'drag'); await p.evaluate(() => localStorage.setItem('ax_den_tab', '"brief"')); await reopen(p);
  await p.waitForSelector('#den-tour .dt-prompt', { timeout: 15000 }); const pr = await txt(p, '#den-tour .dt-prompt'); ok(/Carry on with the guide\?/.test(pr) && /step 8 of 24: Add it to a section/.test(pr), pr);
  await B(p, 'Carry on').click(); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view && s.view.mode === 'route'; }, 'the Board route');
  ok(/Go back to the Board/.test(await txt(p, '#den-tour .dt-card')), 'on another tab, the first press asked is the Board'); eq(await clear(p, '#den-tab-today'), '', 'the Board tab is ringed');
  await press(p); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'do' && !s.view.flash; }, 'drag as a do-step on the Board');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 2 * 86400000));
  await p.fill('#den-root [data-tour="day"]', day); await p.waitForSelector('#den-root [data-tour="today"]');
  await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'route' && s.view.route === 'today'; }, 'the Today route'); eq(await clear(p, '[data-tour="today"]'), '', 'Today is ringed');
  await press(p); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'do'; }, 'back on today, the step carries on');
  await startAt(p, 'start'); await at(p, 'start'); if ((await S(p)).view.mode === 'route') { await press(p); await at(p, 'start'); } await p.click('#den-root [data-tour="by-hand"]'); await at(p, 'outline');
  await p.locator('#den-root [data-tour="editor"]:visible').first().click().catch(() => {}); if (!(await p.locator('#den-root [data-tour="editor"]:visible').count())) await p.locator('#den-root [data-tour="reads"]:visible').first().click();
  await p.keyboard.type('Words not yet saved.'); await startAt(p, 'regen');
  await until(p, () => { const s = window.DenTour.state(); return s.step === 'regen' && s.view.mode === 'route' && s.view.route === 'saved'; }, 'the save route'); await press(p); await at(p, 'regen');
  eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('after the guide ends, each open asks "Want the guide again?" once; Don\'t ask again holds; Guide and the ? sheet still replay', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click(); await at(p, 'desk');
  await startAt(p, 'options'); await at(p, 'options'); await press(p); await at(p, 'options', 'look'); await B(p, 'Got it').click();
  await p.waitForSelector('#den-tour [role="dialog"]'); const bad = await axe(p, 'the finish'); await B(p, 'Back to the Board').click(); eq((await S(p)).status, 'done'); await p.waitForSelector('#den-tour [role="dialog"]', { state: 'detached' });
  await reopen(p); await p.waitForSelector('#den-tour .dt-prompt', { timeout: 15000 }); ok(/Want the guide again\?/.test(await txt(p, '#den-tour .dt-prompt')));
  eq(await p.evaluate(() => !!document.activeElement.closest('#den-tour')), false, 'the question does not take the focus'); for (const n of ['Yes, guide me', 'Not now', 'Don\'t ask again']) ok(await B(p, n).isVisible(), n);
  await B(p, 'Not now').click(); await p.waitForSelector('#den-tour .dt-prompt', { state: 'detached' }); await p.waitForTimeout(1500); eq(await p.locator('#den-tour .dt-prompt').count(), 0, 'asked once on this open');
  await reopen(p); await p.waitForSelector('#den-tour .dt-prompt', { timeout: 15000 }); await B(p, 'Don\'t ask again').click(); ok(/The Guide button beside \? brings it back/.test(await txt(p, '#den-tour')), 'said in one line'); eq((await S(p)).ask, 'never');
  await reopen(p); await p.waitForTimeout(3500); eq(await p.locator('#den-tour .dt-prompt, #den-tour [role="dialog"]').count(), 0, 'never asked again');
  await p.click('#den-root [data-tour="guide"]'); await B(p, 'Start from the beginning').click(); await at(p, 'desk'); await B(p, 'I\'ll do it later').click(); eq((await S(p)).status, 'paused');
  await p.click('#den-root [data-tour="help"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]'); await p.click('#den-root [data-tour="replay"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]', { state: 'detached' });
  await B(p, 'Resume at step 1: Choose your desk').click(); await at(p, 'desk'); eq(w.calls.length, 0); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('a read-only key: every step is shown or done without a write, and the guide posts nothing', async () => {
  const w = await world(); const p = await open(w, 'read-key', { tour: true }); await p.waitForFunction(() => window.AX_ROLE === 'read');
  await p.waitForSelector('#den-tour [role="dialog"]', { timeout: 15000 }); ok(/view-only/.test(await txt(p, '#den-tour [role="dialog"]')), 'the welcome says the key is view-only'); await B(p, 'Start the guide').click();
  await at(p, 'desk'); await B(p, 'Keep AEP national').click(); await at(p, 'day'); await B(p, 'Got it').click();
  await at(p, 'checks'); await press(p); await at(p, 'checks', 'close'); await p.keyboard.press('Escape');
  await at(p, 'card'); await press(p); await at(p, 'find'); await p.fill('#den-root [data-tour="search"]', 'ha'); await at(p, 'find', 'reset'); await p.fill('#den-root [data-tour="search"]', '');
  for (const id of ['pin', 'aside', 'drag', 'key']) { await at(p, id); eq((await S(p)).view.mode, 'show', id + ' is shown, not done'); ok(/view-only/.test(await txt(p, '#den-tour .dt-card')), id + ' says why'); await B(p, 'Got it').click(); }
  await at(p, 'write'); await press(p); await at(p, 'start'); eq((await S(p)).view.mode, 'show');
  await B(p, 'Got it').click(); for (const id of ['outline', 'edit', 'cite', 'jump', 'save', 'regen', 'history', 'foot', 'export', 'file']) { await at(p, id); eq((await S(p)).view.mode, 'show', id); await B(p, 'Got it').click(); }
  for (const id of ['watch', 'collection', 'options']) { await at(p, id); await press(p); await at(p, id, 'look'); await B(p, 'Got it').click(); }
  await p.waitForSelector('#den-tour [role="dialog"]'); await B(p, 'Back to the Board').click();
  eq(denPosts(p), [], 'the read-only walk posted nothing'); eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('an empty desk has no dead end: the sorting chapter says why and carries on, and every step has a way forward', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click();
  await at(p, 'desk'); await p.selectOption('#den-root [data-tour="desk"]', 'guns_au'); await at(p, 'day'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent)); await B(p, 'Got it').click();
  await at(p, 'checks'); await press(p); await at(p, 'checks', 'close'); await p.keyboard.press('Escape');
  await at(p, 'card'); await p.waitForSelector('#den-root [data-tour="unsorted"][data-n="0"]'); await p.waitForFunction(() => window.DenTour.state().view.mode === 'show');
  ok(/Nothing has been collected for Firearms/.test(await txt(p, '#den-tour .dt-card')) && /Collection tab/.test(await txt(p, '#den-tour .dt-card')), await txt(p, '#den-tour .dt-card'));
  ok(await B(p, 'Try another desk').isVisible()); await B(p, 'Carry on').click();
  await at(p, 'write'); await press(p); await at(p, 'start'); await p.click('#den-root [data-tour="by-hand"]');
  await at(p, 'outline'); await press(p); await at(p, 'edit'); if (!(await p.locator('#den-root [data-tour="editor"]:visible').count())) await press(p);
  await p.locator('#den-root [data-tour="editor"]:visible').click(); await p.keyboard.type('A quiet day for the desk.');
  for (const id of ['cite', 'jump']) { await at(p, id); eq((await S(p)).view.mode, 'show', id + ': nothing here can be cited, so it is shown'); await B(p, 'Got it').click(); }
  await at(p, 'save'); const v = (await S(p)).view; if (v.mode === 'show') await B(p, 'Got it').click(); else await press(p);
  await at(p, 'regen'); await press(p); await at(p, 'regen', 'form'); await p.click('#den-root [data-tour="regen-cancel"]');
  await at(p, 'history'); await press(p); await at(p, 'history', 'close'); await press(p); await at(p, 'foot'); await B(p, 'Got it').click();
  await at(p, 'export'); await press(p); await at(p, 'export', 'pick'); await p.click('#den-root [data-tour="export-menu"] button:has-text("Copy the Slack summary")');
  await at(p, 'file'); await B(p, 'Not yet, show me the rest').click();
  for (const id of ['watch', 'collection', 'options']) { await at(p, id); await press(p); await at(p, id, 'look'); await B(p, 'Got it').click(); }
  await p.waitForSelector('#den-tour [role="dialog"]'); const s = await S(p); eq(s.skipped.sort(), ['aside', 'card', 'drag', 'find', 'key', 'pin'].sort(), 'only the sorting chapter was passed over, and said so');
  eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('reduced motion keeps a visible ring with a text badge and no pulse; motion on, the ring pulses', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true, reducedMotion: true }); await B(p, 'Start the guide').click(); await at(p, 'desk');
  const ring = () => p.$eval('#den-tour .dt-ring', r => { const c = getComputedStyle(r); const b = r.querySelector('.dt-badge'); return { anim: c.animationName, w: parseFloat(c.borderTopWidth) || parseFloat(c.outlineWidth) || 0, badge: b && getComputedStyle(b).display !== 'none' ? b.textContent.trim() : '' }; });
  const r = await ring(); eq(r.anim, 'none', 'no pulse'); ok(r.w >= 2, 'a solid ring: ' + r.w); ok(/here/i.test(r.badge), 'a text badge: ' + r.badge); await p.context().close();
  const q = await open(w, 'full-key', { tour: true }); await B(q, 'Start the guide').click(); await at(q, 'desk'); const m = await q.$eval('#den-tour .dt-ring', r => getComputedStyle(r).animationName); ok(m && m !== 'none', 'with motion the ring pulses: ' + m);
  eq(q.errors, []); await q.context().close();
});

await t('the keyboard: Alt+G moves between the card and the control, Escape in the card pauses, a Den dialog keeps its Escape', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await B(p, 'Start the guide').click(); await at(p, 'desk');
  await p.keyboard.press('Alt+g'); eq(await p.evaluate(() => document.activeElement.getAttribute('data-tour')), 'desk', 'Alt+G goes to the control');
  await p.keyboard.press('Alt+g'); ok(await p.evaluate(() => !!document.activeElement.closest('#den-tour .dt-card')), 'and back to the card');
  await p.keyboard.press('Escape'); eq((await S(p)).status, 'paused', 'Escape in the card pauses the guide'); eq(await p.evaluate(() => document.activeElement.getAttribute('data-tour')), 'desk', 'and the focus goes back to the control');
  await p.click('#den-root [data-tour="guide"]'); await B(p, 'Resume at step 1: Choose your desk').click(); await at(p, 'desk');
  await p.click('#den-root [data-tour="help"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]'); await p.keyboard.press('Escape'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]', { state: 'detached' });
  eq((await S(p)).status, 'active', 'the Den\'s dialog took the Escape, not the guide'); eq(p.errors, []); await p.context().close();
});

await t('static: den-tour.js holds no fetch, XMLHttpRequest, AXUI or .click(), and its colours live in its own tokens', async () => {
  for (const bad of ['fetch(', 'XMLHttpRequest', 'AXUI', '.click(']) ok(SRC.indexOf(bad) < 0, 'den-tour.js contains ' + bad);
  ok(/data-paid/.test(SRC), 'it reads data-paid, to know what it must never press');
  const hex = CSS.split('\n').filter(l => /#[0-9a-fA-F]{3,8}\b/.test(l.replace(/#den-tour/g, ''))); ok(hex.length && hex.every(l => /--dt-[a-z0-9-]+\s*:/.test(l)), 'a hex only in a --dt- token: ' + hex.filter(l => !/--dt-/.test(l)).join(' | '));
  ok(/prefers-reduced-motion/.test(CSS), 'the stylesheet honours reduced motion');
});

await finish();
