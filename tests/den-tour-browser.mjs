/* The guided tour of Anne's Den (docs/den-tour.js) in a real browser, on the Den fixture: docs/ served from this
 * worktree, the worker in this process, a stub model that counts its calls (w.calls). Nothing is contacted and nothing
 * is spent. The tour is driven only the way a person drives it: the control under the ring is pressed with the mouse,
 * typed into, dragged; the coach card's own buttons are used only where the card says a step is shown, not done.
 *   first visit (nothing offered; the welcome on the first open), the ring and what covers it (step 8 at 1366x768 too),
 *   the whole walk from step 1 to step 24, the paid step, the sample path on every Sections-and-sources step, resume
 *   after a reload (and the routing micro-steps), nothing asked again after a run, started from Today's report (a visit,
 *   and back), the Keyboard sheet, a read-only key, an empty desk, reduced motion, the keyboard, and a static read of the
 *   file for the things it must never contain. p72 lane P4: UX-SPEC s.8.1, s.8.4, s.10.2.
 * Run: node --experimental-sqlite tests/den-tour-browser.mjs   (binds a local port: run it with the sandbox off) */
import fs from 'node:fs';
import { world, open, t as test, ok, eq, txt, tab, finish } from './den-fixture.mjs';

console.log('den-tour-browser harness');
const t = (name, fn) => (!process.env.ONLY || name.indexOf(process.env.ONLY) >= 0 ? test(name, fn) : Promise.resolve());   // ONLY=<part of a name> runs that case alone
const SRC = fs.readFileSync(new URL('../docs/den-tour.js', import.meta.url), 'utf8');
const CSS = fs.readFileSync(new URL('../docs/den-tour.css', import.meta.url), 'utf8');
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');

/* the editor a person can type into: on the section page the textarea lies under the reading view (opacity 0, no
 * pointer events) until the section is in edit mode, so it counts only then */
const ED = '#den-root .den-sec:not([data-mode="read"]) [data-tour="editor"]:visible';
const S = p => p.evaluate(() => (window.DenTour ? window.DenTour.state() : null));
// the tour is on step `id` (and its phase, when given), with no "Done" flash in progress
const at = (p, id, phase) => p.waitForFunction(([id, ph]) => { const s = window.DenTour && window.DenTour.state(); return !!(s && s.status === 'active' && s.step === id && s.view && !s.view.flash && (!ph || s.view.phase === ph)); }, [id, phase || ''], { timeout: 15000 })
  .catch(async () => { throw new Error('not at ' + id + (phase ? '/' + phase : '') + ': ' + JSON.stringify(await S(p)).slice(0, 500)); });
const until = (p, fn, what) => p.waitForFunction(fn, null, { timeout: 15000 }).catch(async () => { throw new Error('waited for ' + what + ': ' + JSON.stringify(await S(p)).slice(0, 600)); });
const B = (p, name) => p.locator('#den-tour').getByRole('button', { name, exact: true });
const rings = p => p.$$eval('#den-tour .dt-ring', r => r.filter(x => getComputedStyle(x).display !== 'none').map(x => { const b = x.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }));
// press what is under the middle of ring i: the control a person is shown
// release review: the day, the foot and each tab's second half are presses too; a step with nothing to press is shown
const day = async p => { await at(p, 'day'); eq((await S(p)).view.mode, 'do', 'Check the day is a press'); await press(p); await p.keyboard.press('Escape'); };
const toDo = p => p.waitForFunction(() => { const s = window.DenTour.state(); return s.view && s.view.mode === 'do'; }, null, { timeout: 4000 }).then(() => true, () => false);   // a panel still loading is shown until its controls are there
const lookAt = async (p, id) => { await at(p, id, 'look'); if (await toDo(p)) await press(p); else await B(p, 'Got it').click(); };
const foot = async p => { await at(p, 'foot'); if ((await S(p)).view.mode === 'show') await B(p, 'Got it').click(); else { await press(p); } };
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
// p72: the guide never opens by itself; the Guide button beside ? opens it (the welcome the first time)
const begin = async p => { await p.click('#den-root [data-tour="guide"]'); await B(p, 'Start the guide').click(); };
const offered = p => p.locator('#den-tour .dt-prompt, #den-tour [role="dialog"], #den-tour .dt-menu').count();
// every ring is clear of the coach card (the card covers nothing it rings)
const cardClear = async p => { await p.waitForTimeout(450); return p.evaluate(() => { const c = document.querySelector('#den-tour .dt-card'); if (!c) return ['no card']; const r = c.getBoundingClientRect();
  return Array.from(document.querySelectorAll('#den-tour .dt-ring')).map((g, i) => { const q = g.getBoundingClientRect(); return r.x < q.right && r.right > q.x && r.y < q.bottom && r.bottom > q.y ? 'the card overlaps ring ' + (i + 1) : ''; }).filter(Boolean); }); };

await t('a first visit offers nothing; the first open of the guide shows the welcome, and nothing is asked of the worker or the model', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true });
  await p.waitForTimeout(3000); eq(await offered(p), 0, 'nothing is offered when the Den opens (UX-SPEC s.8.1)');
  ok(await p.evaluate(() => typeof window.DenTour.open === 'function' && !!document.querySelector('[data-tour="guide"]')), 'the Guide button is drawn beside ?');
  await p.click('#den-root [data-tour="guide"]'); await p.waitForSelector('#den-tour [role="dialog"][aria-modal="true"]', { timeout: 15000 });
  const wel = await txt(p, '#den-tour [role="dialog"]');
  ok(/Full guided tour of the tools/.test(wel) && /A tour of the tools behind the daily report: finding stories, sources and settings\. About 15 minutes\. You don't need it for the report itself\./.test(wel) && /AEP national/.test(wel) && /AI draft/.test(wel), wel);
  ok(!/6 minutes|one full day|model call/.test(wel), 'the old promise is gone: ' + wel);
  for (const n of ['Start the guide', 'I\'ll do it later']) ok(await B(p, n).isVisible(), n); eq(await B(p, 'Don\'t ask again').count(), 0, 'nothing to stop asking: it never asks');
  eq(await p.evaluate(() => document.activeElement && document.activeElement.textContent), 'Start the guide', 'the focus is on Start');
  eq(w.calls.length, 0, 'no model call'); eq(p.served.filter(s => /^POST /.test(s)), [], 'no POST at all'); eq((await S(p)).status || 'none', 'none', 'nothing is recorded before an answer');
  const bad = await axe(p, 'welcome'); await p.keyboard.press('Escape'); await p.waitForSelector('#den-tour [role="dialog"]', { state: 'detached' });
  eq((await S(p)).status, 'dismissed', 'Escape is "I\'ll do it later"'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('the ringed control is the one to press, nothing covers it, and the card names it in words', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p);
  await at(p, 'desk'); eq(await clear(p, '[data-tour="desk"]'), '', 'step 1'); ok(/Step 1 of 24/.test(await txt(p, '#den-tour .dt-card')) && /Choose your desk/.test(await txt(p, '#den-tour .dt-card h2')));
  eq(await p.getAttribute('#den-tour [role="progressbar"]', 'aria-valuenow'), '1'); eq(await p.evaluate(() => getComputedStyle(document.querySelector('#den-tour svg')).pointerEvents), 'none', 'the spotlight takes no pointer');
  await startAt(p, 'checks'); await at(p, 'checks'); eq(await clear(p, '[data-tour="check"][data-n]:not([data-n="0"])'), '', 'step 3 rings a check with findings');
  await startAt(p, 'pin'); await at(p, 'pin'); const key = await under(p, 0, '[data-tour="card"]'); ok(key, 'the pin ring sits on a card');
  eq(await clear(p, '[data-tour="card"][data-key="' + key + '"] [data-tour="card-pin"]'), '', 'step 6 rings that card\'s Pin');
  ok(/Everyone on this desk sees the mark/.test(await txt(p, '#den-tour .dt-card')) && /Must mention/.test(await txt(p, '#den-tour .dt-card')), 'a step that writes says who sees it and how to undo it, in the new words (Must mention)');
  const bad = await axe(p, 'a do-step at 1440');
  for (const wd of [1366, 1920]) { await p.setViewportSize({ width: wd, height: wd === 1366 ? 768 : 1080 }); bad.push(...await axe(p, 'a do-step at ' + wd)); eq(await clear(p, '[data-tour="card"][data-key="' + key + '"] [data-tour="card-pin"]'), '', 'at ' + wd + ' the ring still sits clear'); }
  await p.setViewportSize({ width: 1440, height: 900 });
  await startAt(p, 'drag'); await at(p, 'drag'); const r = await rings(p); eq(r.length, 2, 'two holes on the drag step');
  const src = await under(p, 0, '[data-tour="card"]'), dst = await under(p, 1, '[data-tour="col"]'); ok(src && dst, 'from a card to a column: ' + src + ' -> ' + dst);
  ok(await B(p, 'Can\'t drag? Use the card\'s menu').isVisible(), 'a drag always has a way without dragging'); eq(await cardClear(p), [], 'at 1440 the card covers neither hole of step 8');
  // UX-SPEC s.8.4: step 8 at 1366x768, where the card used to cover its drop column
  await p.setViewportSize({ width: 1366, height: 768 }); await at(p, 'drag'); eq((await rings(p)).length, 2, 'two holes at 1366'); eq(await cardClear(p), [], 'at 1366x768 the coach card covers nothing it rings on step 8');
  const src2 = await under(p, 0, '[data-tour="card"]'), dst2 = await under(p, 1, '[data-tour="col"]'); ok(src2 && dst2, 'at 1366 both holes are open: ' + src2 + ' -> ' + dst2); await p.setViewportSize({ width: 1440, height: 900 });
  eq(w.calls.length, 0); eq(denPosts(p), [], 'pointing posts nothing'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('from step 1 to step 24 each step advances only on the real action, and only the Den\'s own Draft spends', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p);
  const still = async id => { await p.waitForTimeout(350); eq((await S(p)).step, id, 'a press elsewhere does not advance ' + id); };
  await at(p, 'desk'); await p.dispatchEvent('.den-brand', 'click'); await still('desk'); await B(p, 'Keep AEP national').click();
  await day(p);
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
  await at(p, 'start'); eq(w.calls.length, 0, 'no model call up to the paid step'); ok(/1 AI draft/.test(await txt(p, '#den-tour .dt-card')) && /20 of 20 left today/.test(await txt(p, '#den-tour .dt-card')), 'the paid step states the live cost, in AI drafts');
  ok(!(await p.locator('#den-tour .dt-card button[data-paid]').count()), 'no button on the card spends'); await still('start'); eq(w.calls.length, 0);
  await p.click('#den-root [data-tour="draft"]'); await at(p, 'outline'); eq(w.calls.length, 1, 'exactly one model call, from the Den\'s own button');
  await press(p); await at(p, 'edit');
  if (!(await p.locator(ED).count())) await press(p);
  await p.locator(ED).click(); await p.keyboard.press('End'); await p.keyboard.type(' The guide was here.');
  await at(p, 'cite'); await press(p);
  // citing keeps the person in the words, unsaved (one save for many cites): Save comes next and is always a real action
  await at(p, 'save'); eq((await S(p)).view.mode, 'do', 'after citing, Save is a step the person does (release review)');
  const saves = denPosts(p).filter(s => /brief\/save/.test(s)).length; await press(p);
  await at(p, 'jump'); ok(denPosts(p).filter(s => /brief\/save/.test(s)).length > saves, 'saved by the person\'s press');
  if ((await S(p)).view.phase === 'read') { await press(p); await p.waitForFunction(() => window.DenTour.state().view.phase !== 'read'); await at(p, 'jump'); } await press(p);
  await at(p, 'regen'); await press(p); await at(p, 'regen', 'form'); await p.click('#den-root [data-tour="regen-cancel"]');
  await at(p, 'history'); await press(p); await at(p, 'history', 'close'); await press(p);
  await at(p, 'foot'); ok(await toDo(p), 'Read the foot is a press: the brief has a sentence that needs a source'); await press(p);
  await p.waitForFunction(() => { const s = window.DenTour.state(); return s.step !== 'foot' || (s.view && s.view.flash); }, null, { timeout: 5000 });
  ok(await p.waitForFunction(() => !!(document.activeElement && document.activeElement.closest('.den-flag, .den-uncheck')), null, { timeout: 3000 }).then(() => true, () => false), 'the press landed on what is left: ' + await p.evaluate(() => document.activeElement.outerHTML.slice(0, 120)));
  await at(p, 'export'); await press(p); await at(p, 'export', 'pick'); await p.click('#den-root [data-tour="export-menu"] button:has-text("Copy the Slack summary")');
  await at(p, 'file'); await press(p);
  await p.waitForFunction(() => document.querySelector('#den-root [data-tour="file-dialog"]') || document.querySelector('#den-root [data-tour="status"][data-status="filed"]'));
  if (await p.locator('#den-root [data-tour="file-dialog"]').count()) { await at(p, 'file', 'dialog');
    // step 21 (UX-SPEC s.8.4): the dialog's words, with Go back to them as the ringed button
    ok(/Go back to them, or Send anyway/.test(await txt(p, '#den-tour .dt-card')), 'step 21 uses the dialog\'s new words: ' + await txt(p, '#den-tour .dt-card'));
    const rg = (await rings(p))[0]; ok(rg, 'a ring in the dialog'); ok(/^Go back/.test(await p.evaluate(([x, y]) => { const b = document.elementFromPoint(x, y); return (b && b.closest('button') || {}).textContent || ''; }, [rg.x + rg.w / 2, rg.y + rg.h / 2])), 'the ring is on Go back to them');
    await p.locator('#den-root [data-tour="file-dialog"] button').filter({ hasText: /^(File|Send) anyway$/ }).click(); }   // Send anyway once lane P5's words land
  await at(p, 'watch'); ok(await p.$('#den-root [data-tour="status"][data-status="filed"]'), 'filed by the person'); await press(p); await at(p, 'watch', 'look'); ok(await toDo(p), 'the Watch tab\'s second half is a press'); await lookAt(p, 'watch');
  await at(p, 'collection'); await press(p); await lookAt(p, 'collection');
  await at(p, 'options'); await press(p); await at(p, 'options', 'look');
  // step 24 (UX-SPEC s.8.4): Draft each morning in Options is ringed and shown, never changed
  eq((await S(p)).view.mode, 'show', 'step 24 is shown, not done'); const r24 = (await rings(p))[0]; ok(r24, 'step 24 rings something');
  ok(/^\s*Draft each morning/.test(await p.evaluate(([x, y]) => { const b = document.elementFromPoint(x, y); const l = b && b.closest('label'); return l ? l.textContent : (b ? b.outerHTML.slice(0, 80) : ''); }, [r24.x + r24.w / 2, r24.y + r24.h / 2])), 'the ring is on Draft each morning');
  ok(/Draft each morning/.test(await txt(p, '#den-tour .dt-card')) && /AI draft/.test(await txt(p, '#den-tour .dt-card')), 'the card names it'); await B(p, 'Got it').click();
  await p.waitForSelector('#den-tour [role="dialog"]'); const fin = await txt(p, '#den-tour [role="dialog"]'); ok(/That is the whole tour/.test(fin) && /marked 1 card must mention/.test(fin), fin);
  eq(p.served.filter(x => /^POST \/den\/desk\/update/.test(x)), [], 'Options was shown, not changed');
  const s = await S(p); eq(s.done.length, 24, 'every one of the 24 steps was done, none skipped: ' + JSON.stringify(s.skipped)); eq(s.skipped, []);
  await B(p, 'Back to the Board').click(); eq((await S(p)).status, 'done'); eq(w.calls.length, 1, 'one model call in all'); eq(p.errors, []); await p.context().close();
});

await t('the paid step: the sample path spends nothing and is labelled; the Den\'s own Draft spends exactly one call', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true });
  await startAt(p, 'start'); await at(p, 'start'); if ((await S(p)).view.mode === 'route') { await press(p); await at(p, 'start'); }
  eq(await clear(p, '[data-tour="draft"]'), '', 'the Draft button is pointed at, not pressed'); ok(/Uses 1 AI draft/.test(await txt(p, '#den-tour .dt-cost')), 'a cost badge');
  const bad = await axe(p, 'the paid step');
  await B(p, 'Skip: show me with a sample').click(); await at(p, 'outline'); ok(/Sample: not your desk's data/.test(await txt(p, '#den-tour .dt-card')), 'the sample says it is a sample');
  for (const id of ['outline', 'edit', 'cite', 'save', 'jump', 'regen', 'history', 'foot', 'export', 'file']) { await at(p, id); ok(/Sample: not your desk's data/.test(await txt(p, '#den-tour .dt-card')), id + ' is a labelled sample'); await B(p, 'Got it').click(); }
  await at(p, 'watch'); eq(w.calls.length, 0, 'the sample path made no model call'); eq(denPosts(p), [], 'and posted nothing');
  await startAt(p, 'start'); await at(p, 'start'); await p.click('#den-root [data-tour="draft"]'); await p.waitForSelector('#den-tour .dt-card .dt-status:has-text("Writing")', { timeout: 8000 }).catch(() => {});
  await at(p, 'outline'); eq(w.calls.length, 1, 'one call, from the Den\'s own button'); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('a reload offers nothing; the Guide menu resumes at the same step; a wrong tab, a past day and unsaved words are each one press away', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p); await at(p, 'desk');
  await startAt(p, 'drag'); await at(p, 'drag'); await p.evaluate(() => localStorage.setItem('ax_den_tab', '"brief"')); await reopen(p);
  await p.waitForTimeout(2500); eq(await offered(p), 0, 'a reload in the middle offers nothing by itself (UX-SPEC s.8.1)');
  await p.click('#den-root [data-tour="guide"]'); await B(p, 'Resume at step 8: Add it to a section').click(); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view && s.view.mode === 'route'; }, 'the Board route');
  ok(/Go back to the Board/.test(await txt(p, '#den-tour .dt-card')), 'on another tab, the first press asked is the Board'); eq(await clear(p, '#den-tab-today'), '', 'the Board tab is ringed');
  await press(p); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'do' && !s.view.flash; }, 'drag as a do-step on the Board');
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() - 2 * 86400000));
  await p.fill('#den-root [data-tour="day"]', day); await p.waitForSelector('#den-root [data-tour="today"]');
  await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'route' && s.view.route === 'today'; }, 'the Today route'); eq(await clear(p, '[data-tour="today"]'), '', 'Today is ringed');
  await press(p); await until(p, () => { const s = window.DenTour.state(); return s.step === 'drag' && s.view.mode === 'do'; }, 'back on today, the step carries on');
  await startAt(p, 'start'); await at(p, 'start'); if ((await S(p)).view.mode === 'route') { await press(p); await at(p, 'start'); } await p.click('#den-root [data-tour="by-hand"]'); await at(p, 'outline');
  await p.locator(ED).first().click().catch(() => {}); if (!(await p.locator(ED).count())) await p.locator('#den-root [data-tour="reads"]:visible').first().click();
  await p.keyboard.type('Words not yet saved.'); await startAt(p, 'regen');
  await until(p, () => { const s = window.DenTour.state(); return s.step === 'regen' && s.view.mode === 'route' && s.view.route === 'saved'; }, 'the save route'); await press(p); await at(p, 'regen');
  eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('after the guide ends nothing asks again on any open; Guide and the ? sheet still replay', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p); await at(p, 'desk');
  await startAt(p, 'options'); await at(p, 'options'); await press(p); await lookAt(p, 'options');
  await p.waitForSelector('#den-tour [role="dialog"]'); const bad = await axe(p, 'the finish'); ok(!/Don't ask me again/.test(await txt(p, '#den-tour [role="dialog"]')), 'no ask-again box on the finish');
  await B(p, 'Back to the Board').click(); eq((await S(p)).status, 'done'); await p.waitForSelector('#den-tour [role="dialog"]', { state: 'detached' });
  for (let i = 0; i < 2; i++) { await reopen(p); await p.waitForTimeout(3500); eq(await offered(p), 0, 'open ' + (i + 1) + ' after a run: nothing asked (no "Want the guide again?")'); }
  await p.click('#den-root [data-tour="guide"]'); await p.waitForSelector('#den-tour .dt-menu'); const mt = await txt(p, '#den-tour .dt-menu');
  ok(/Full guided tour of the tools/.test(mt) && /About 15 minutes/.test(mt) && !/One day on the desk/.test(mt), 'the menu in the new words: ' + mt); eq(await p.locator('#den-tour .dt-menu input[type="checkbox"]').count(), 0, 'no "Ask me each time I open the Den"');
  await B(p, 'Start from the beginning').click(); await at(p, 'desk'); await B(p, 'I\'ll do it later').click(); eq((await S(p)).status, 'paused');
  await p.click('#den-root [data-tour="help"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]'); await p.click('#den-root [data-tour="replay"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]', { state: 'detached' });
  await B(p, 'Resume at step 1: Choose your desk').click(); await at(p, 'desk'); eq(w.calls.length, 0); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('a read-only key: every step is shown or done without a write, and the guide posts nothing', async () => {
  const w = await world(); const p = await open(w, 'read-key', { tour: true }); await p.waitForFunction(() => window.AX_ROLE === 'read');
  await p.click('#den-root [data-tour="guide"]'); await p.waitForSelector('#den-tour [role="dialog"]', { timeout: 15000 }); ok(/view-only/.test(await txt(p, '#den-tour [role="dialog"]')), 'the welcome says the key is view-only'); await B(p, 'Start the guide').click();
  await at(p, 'desk'); await B(p, 'Keep AEP national').click(); await day(p);
  await at(p, 'checks'); await press(p); await at(p, 'checks', 'close'); await p.keyboard.press('Escape');
  await at(p, 'card'); await press(p); await at(p, 'find'); await p.fill('#den-root [data-tour="search"]', 'ha'); await at(p, 'find', 'reset'); await p.fill('#den-root [data-tour="search"]', '');
  for (const id of ['pin', 'aside', 'drag', 'key']) { await at(p, id); eq((await S(p)).view.mode, 'show', id + ' is shown, not done'); ok(/view-only/.test(await txt(p, '#den-tour .dt-card')), id + ' says why'); await B(p, 'Got it').click(); }
  await at(p, 'write'); await press(p); await at(p, 'start'); eq((await S(p)).view.mode, 'show');
  await B(p, 'Got it').click(); for (const id of ['outline', 'edit', 'cite', 'save', 'jump', 'regen', 'history', 'foot', 'export', 'file']) { await at(p, id); eq((await S(p)).view.mode, 'show', id); await B(p, 'Got it').click(); }
  for (const id of ['watch', 'collection', 'options']) { await at(p, id); await press(p); await lookAt(p, id); }
  await p.waitForSelector('#den-tour [role="dialog"]'); await B(p, 'Back to the Board').click();
  eq(denPosts(p), [], 'the read-only walk posted nothing'); eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('an empty desk has no dead end: the sorting chapter says why and carries on, and every step has a way forward', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p);
  await at(p, 'desk'); await p.selectOption('#den-root [data-tour="desk"]', 'guns_au'); await at(p, 'day'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent)); await press(p); await p.keyboard.press('Escape');
  await at(p, 'checks'); await press(p); await at(p, 'checks', 'close'); await p.keyboard.press('Escape');
  await at(p, 'card'); await p.waitForSelector('#den-root [data-tour="unsorted"][data-n="0"]'); await p.waitForFunction(() => window.DenTour.state().view.mode === 'show');
  ok(/Nothing has been collected for Firearms/.test(await txt(p, '#den-tour .dt-card')) && /Collection tab/.test(await txt(p, '#den-tour .dt-card')), await txt(p, '#den-tour .dt-card'));
  ok(await B(p, 'Try another desk').isVisible()); await B(p, 'Carry on').click();
  await at(p, 'write'); await press(p); await at(p, 'start'); await p.click('#den-root [data-tour="by-hand"]');
  await at(p, 'outline'); await press(p); await at(p, 'edit'); if (!(await p.locator(ED).count())) await press(p);
  await p.locator(ED).click(); await p.keyboard.type('A quiet day for the desk.');
  await at(p, 'cite'); eq((await S(p)).view.mode, 'show', 'cite: nothing here can be cited, so it is shown'); await B(p, 'Got it').click();
  await at(p, 'save'); const v = (await S(p)).view; if (v.mode === 'show') await B(p, 'Got it').click(); else await press(p);
  await at(p, 'jump'); eq((await S(p)).view.mode, 'show', 'jump: nothing here can be cited, so it is shown'); await B(p, 'Got it').click();
  await at(p, 'regen'); await press(p); await at(p, 'regen', 'form'); await p.click('#den-root [data-tour="regen-cancel"]');
  await at(p, 'history'); await press(p); await at(p, 'history', 'close'); await press(p); await foot(p);
  await at(p, 'export'); await press(p); await at(p, 'export', 'pick'); await p.click('#den-root [data-tour="export-menu"] button:has-text("Copy the Slack summary")');
  await at(p, 'file'); await B(p, 'Not yet, show me the rest').click();
  for (const id of ['watch', 'collection', 'options']) { await at(p, id); await press(p); await lookAt(p, id); }
  await p.waitForSelector('#den-tour [role="dialog"]'); const s = await S(p); eq(s.skipped.sort(), ['aside', 'card', 'drag', 'find', 'key', 'pin'].sort(), 'only the sorting chapter was passed over, and said so');
  eq(w.calls.length, 0); eq(p.errors, []); await p.context().close();
});

await t('reduced motion keeps a visible ring with a text badge and no pulse; motion on, the ring pulses', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true, reducedMotion: true }); await begin(p); await at(p, 'desk');
  const ring = () => p.$eval('#den-tour .dt-ring', r => { const c = getComputedStyle(r); const b = r.querySelector('.dt-badge'); return { anim: c.animationName, w: parseFloat(c.borderTopWidth) || parseFloat(c.outlineWidth) || 0, badge: b && getComputedStyle(b).display !== 'none' ? b.textContent.trim() : '' }; });
  const r = await ring(); eq(r.anim, 'none', 'no pulse'); ok(r.w >= 2, 'a solid ring: ' + r.w); ok(/here/i.test(r.badge), 'a text badge: ' + r.badge); await p.context().close();
  const q = await open(w, 'full-key', { tour: true }); await begin(q); await at(q, 'desk'); const m = await q.$eval('#den-tour .dt-ring', r => getComputedStyle(r).animationName); ok(m && m !== 'none', 'with motion the ring pulses: ' + m);
  eq(q.errors, []); await q.context().close();
});

await t('the keyboard: Alt+G moves between the card and the control, Escape in the card pauses, a Den dialog keeps its Escape', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true }); await begin(p); await at(p, 'desk');
  await p.keyboard.press('Alt+g'); eq(await p.evaluate(() => document.activeElement.getAttribute('data-tour')), 'desk', 'Alt+G goes to the control');
  await p.keyboard.press('Alt+g'); ok(await p.evaluate(() => !!document.activeElement.closest('#den-tour .dt-card')), 'and back to the card');
  await p.keyboard.press('Escape'); eq((await S(p)).status, 'paused', 'Escape in the card pauses the guide'); eq(await p.evaluate(() => document.activeElement.getAttribute('data-tour')), 'desk', 'and the focus goes back to the control');
  await p.click('#den-root [data-tour="guide"]'); await B(p, 'Resume at step 1: Choose your desk').click(); await at(p, 'desk');
  await p.click('#den-root [data-tour="help"]'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]'); await p.keyboard.press('Escape'); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]', { state: 'detached' });
  eq((await S(p)).status, 'active', 'the Den\'s dialog took the Escape, not the guide'); eq(p.errors, []); await p.context().close();
});

await t('the sample path is offered on every Sections-and-sources step while a report exists, and following it writes nothing', async () => {
  const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); const calls = w.calls.length; const p = await open(w, 'full-key', { tour: true }); await tab(p, 'brief'); await p.waitForSelector('#den-root [data-tour="panes"]');
  const IDS = ['outline', 'edit', 'cite', 'save', 'jump', 'regen', 'history', 'foot', 'export', 'file'];
  for (const id of IDS) { await startAt(p, id); await at(p, id); ok(await B(p, 'Show me with a sample').isVisible(), id + ' offers the sample path while the report exists'); }
  const posts = denPosts(p).length; await startAt(p, 'outline'); await at(p, 'outline'); await B(p, 'Show me with a sample').click();
  for (const id of IDS) { await at(p, id, 'sample'); const c = await txt(p, '#den-tour .dt-card'); ok(/Sample: not your desk's data/.test(c) && /nothing was written into your report/.test(c), id + ' is a labelled sample: ' + c.slice(0, 160)); await B(p, 'Got it').click(); }
  await at(p, 'watch'); eq(denPosts(p).length, posts, 'the sample path posted nothing'); eq(w.calls.length, calls, 'and spent nothing'); eq(p.errors, []); await p.context().close();
});

await t('started from Today\'s report: the workbench opens as a visit, the finish reads "Back to Today\'s report" and goes back there', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true, room: 'today' }); await p.waitForSelector('.dt-room');
  const tabNow = () => p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab') || 'null'));
  // closed without starting: back on Today
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'Full guided tour of the tools' }).click();
  await p.waitForSelector('#den-tab-today[aria-selected="true"]'); await p.waitForSelector('#den-tour [role="dialog"]'); eq((await S(p)).from, 'report', 'the guide knows it came from Today'); eq(await tabNow(), 'report', 'the Board was a visit');
  await B(p, 'I\'ll do it later').click(); await p.waitForSelector('.dt-room'); eq(await tabNow(), 'report');
  // a step asked for on Today routes through More tools
  await startAt(p, 'card'); await until(p, () => { const s = window.DenTour.state(); return s.step === 'card' && s.view && s.view.mode === 'route'; }, 'the route from Today');
  ok(/Open More tools, then Find a story the report missed \(or press Alt\+1\)/.test(await txt(p, '#den-tour .dt-card')), await txt(p, '#den-tour .dt-card')); eq(await clear(p, '#dt-btn-more'), '', 'More tools is ringed');
  await press(p); await until(p, () => !!document.querySelector('#dt-list-more'), 'the menu'); await p.waitForTimeout(500); await press(p);
  await until(p, () => { const s = window.DenTour.state(); return s.step === 'card' && s.view && s.view.mode === 'do'; }, 'on the Board, the step carries on'); ok(await p.$('#den-tab-today[aria-selected="true"]'), 'on the Board'); eq(await tabNow(), 'report', 'More tools opened the Board as a visit'); await p.evaluate(() => window.DenTour.stop()); await p.keyboard.press('Alt+0'); await p.waitForSelector('.dt-room');
  // the whole way: Help, the tour, its last step, the finish
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'Full guided tour of the tools' }).click(); await p.waitForSelector('#den-tab-today[aria-selected="true"]');
  await p.waitForSelector('#den-tour .dt-menu, #den-tour [role="dialog"]'); if (await B(p, 'Start the guide').count()) await B(p, 'Start the guide').click(); else await B(p, 'Start from the beginning').click(); await at(p, 'desk');
  await startAt(p, 'options'); await at(p, 'options'); await press(p); await lookAt(p, 'options');
  await p.waitForSelector('#den-tour [role="dialog"]'); ok(await B(p, 'Back to Today\'s report').isVisible(), 'the finish button reads Back to Today\'s report'); eq(await B(p, 'Back to the Board').count(), 0);
  const bad = await axe(p, 'the finish from Today'); await B(p, 'Back to Today\'s report').click(); await p.waitForSelector('.dt-room'); eq(await tabNow(), 'report', 'ax_den_tab = report');
  await p.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'H1', null, { timeout: 3000 }).catch(() => {}); eq(await p.evaluate(() => document.activeElement.tagName), 'H1', 'the focus is on the report\'s heading');
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function', null, { timeout: 20000 }); await p.evaluate(() => go('den'));
  await p.waitForSelector('.dt-room', { timeout: 20000 }); await p.waitForTimeout(2500); eq(await offered(p), 0, 'the next open is Today, with nothing offered');
  eq(w.calls.length, 0); eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

await t('the Keyboard sheet: Alt+0, the keys everywhere, then "On the Board" with the renamed keys; from Today its tour row opens the workbench as a visit', async () => {
  const w = await world(); const p = await open(w, 'full-key', { tour: true, room: 'today' }); await p.waitForSelector('.dt-room');
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'Keyboard shortcuts' }).click(); await p.waitForSelector('[role="dialog"][aria-label="Keyboard"]');
  const rows = await p.$$eval('[role="dialog"][aria-label="Keyboard"] tr', r => r.map(x => Array.from(x.children).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' ')));
  const at_ = t => rows.findIndex(r => r.indexOf(t) === 0);
  ok(at_('Full guided tour of the tools') === 0, 'the tour is the first row: ' + rows[0]); ok(at_('Alt + 0') > 0 && /Today's report, from anywhere/.test(rows[at_('Alt + 0')]), 'Alt+0');
  ok(/Board, Sections and sources, Watch, Collection, Options/.test(rows[at_('Alt + 1 to 5')]), 'Alt+1 to 5 in the new tab name'); ok(at_('On the Board') > at_('Esc'), 'the Board\'s keys under "On the Board", after the keys everywhere');
  eq(rows[at_('p')], 'p Mark as must mention'); eq(rows[at_('1 to 9, 0')], '1 to 9, 0 Add to that section'); ok(!rows.some(r => /Pin the row|File the focused card|guided tour of the Den|One day on the desk/.test(r)), 'no old words: ' + rows.join(' | '));
  await p.click('#den-root [data-tour="replay"]'); await p.waitForSelector('#den-tab-today[aria-selected="true"]'); await p.waitForSelector('#den-tour [role="dialog"], #den-tour .dt-menu');
  eq((await S(p)).from, 'report', 'from Today'); eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report', 'a visit'); eq(p.errors, []); await p.context().close();
});

await t('static: den-tour.js holds no fetch, XMLHttpRequest, AXUI or .click(), no daily question or old promise, and its colours live in its own tokens', async () => {
  for (const bad of ['fetch(', 'XMLHttpRequest', 'AXUI', '.click(']) ok(SRC.indexOf(bad) < 0, 'den-tour.js contains ' + bad);
  for (const bad of ['Want a guided tour', 'Want the guide again', 'model call', 'About 6 minutes', 'Ask me each time I open the Den']) ok(SRC.indexOf(bad) < 0, 'den-tour.js still says ' + bad);
  ok(/data-paid/.test(SRC), 'it reads data-paid, to know what it must never press');
  const hex = CSS.split('\n').filter(l => /#[0-9a-fA-F]{3,8}\b/.test(l.replace(/#den-tour/g, ''))); ok(hex.length && hex.every(l => /--dt-[a-z0-9-]+\s*:/.test(l)), 'a hex only in a --dt- token: ' + hex.filter(l => !/--dt-/.test(l)).join(' | '));
  ok(/prefers-reduced-motion/.test(CSS), 'the stylesheet honours reduced motion');
});

await finish();
