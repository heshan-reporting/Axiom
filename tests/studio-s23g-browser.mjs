/* S23 slice G in real Chromium against the worker module, providers MOCKED (nothing spent): the redesigned workspace as a
 * person meets it, and the defects the captures showed, each measured rather than looked at.
 *   G-B1 the library draws each project's lead composition through the keyed file route (never a public address), searches,
 *        filters, sorts, remembers what was opened, shows skeletons while it loads and a failure with a working Try again;
 *   G-B2 the appearance (dark, light, system) is this browser's choice, survives a reload, and never changes the artwork's pixels;
 *   G-B3 every stage head answers missing / accepted / main action / next from the record, and an earlier stage says what a change
 *        there would leave behind - then, once a choice changed, what is now built on the earlier one;
 *   G-B4 Explore is one set of direction cards side by side, each with its own sketch, and no strip of the same previews above;
 *   G-B5 the Creative Director offers Review / Explore / Conversation wherever an asset is in scope (Explore says where it works
 *        outside Design), starts a new part or asset at its beginning, and keeps ids and model names behind a disclosure;
 *   G-B6 at 1440 x 900 the fitted 4:5 artboard is at least 560 px tall with the inspector open; reframing says so in the tool row,
 *        never over the artwork; the readiness line is not cut off and names layers by name, not by id;
 *   G-B7 on a phone the inspector opener never covers the readiness line once it is scrolled into view;
 *   G-B8 Copy adapts a piece for another channel as one stated model call, no render.
 * Run: node --experimental-sqlite tests/studio-s23g-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: 8874, inspect: false });
const R = '#studio-root ';
const T = runner('studio-s23g-browser (the redesigned workspace: library, appearance, stage questions, Explore, Creative Director, Design geometry)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PFX = 'G23';
const S = await seedStages(fx, { prefix: PFX, only: ['objectives', 'directions', 'copy', 'design'] });
const box = (page, sel) => page.$eval(sel, e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, b: r.bottom, r: r.right }; });
const meet = (a, b) => a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
const openLib = async page => {
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} go('studio'); });
  const all = page.locator(R + 'button:has-text("All projects"), ' + R + 'a:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await page.waitForSelector(R + '.st-lib tbody tr', { timeout: 20000 });
};
// the lead composition's canvas in the row of a project, found by its title (a plain DOM query: no Playwright pseudo-classes)
const thumbOf = title => { const tr = Array.from(document.querySelectorAll('#studio-root .st-lib tbody tr')).find(r => (r.textContent || '').indexOf(title) >= 0); return tr ? tr.querySelector('.st-lib-thumb canvas') : null; };
const openProject = async (page, title) => {
  await openLib(page);
  await page.locator(R + '.st-lib tbody tr:has-text("' + title + '") button.st-lib-open').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(500);
};
const phase = async (page, label, sub) => { await page.click(R + '.st-step:has(.st-step-l:text-matches("^' + label + '", "i"))'); await sleep(400); if (sub) { await page.click(R + '.st-substep:has-text("' + sub + '")'); await sleep(400); } };
const openDesign = async (page, title, asset) => {
  await openProject(page, title); await phase(page, 'Design');
  const chip = page.locator(R + '.st-pagechip:has-text("' + asset + '"), ' + R + '.st-assetpick:has-text("' + asset + '")'); if (await chip.count()) await chip.first().click();
  await page.waitForSelector(R + '.st-stage canvas', { timeout: 20000 }); await sleep(1500);
};

await T.t('G-B1 the library: lead compositions through the keyed file route, search, filter, sort, recent, skeletons, failure with Try again', async () => {
  // loading: the list request is held, so the page shows skeleton cards (never an empty page or a spinner alone)
  const release = fx.hold(/^\/studio\/list/);
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  const files = []; page.on('request', r => { const u = r.url(); if (/\/studio\/file\?key=/.test(u)) files.push({ u, key: r.headers()['x-axiom-key'] || '' }); else if (/r2\.dev|\/docs\/.*\.png|cloudflarestorage/.test(u)) files.push({ u, publicPath: true }); });
  await page.waitForSelector(R + '.st-lib-skel', { timeout: 15000 });
  eq(await page.$$eval(R + '.st-lib-skel', x => x.length) >= 3, true, 'skeleton cards while the projects load');
  ok(await page.$(R + '[role="status"][aria-label^="Loading the projects"]'), 'the loading state is announced');
  release();
  await page.waitForSelector(R + '.st-lib tbody tr', { timeout: 15000 });
  // the lead composition is drawn by the renderer on a canvas, with its imagery fetched through /studio/file with the key
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#studio-root .st-lib-thumb canvas')).some(c => { try { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 97) if (d[i] > 0) n++; return n > 20; } catch (e) { return false; } }), null, { timeout: 20000 });
  const design = page.locator(R + '.st-lib tbody tr:has-text("' + PFX + ' at design")');
  ok(await design.locator('.st-lib-thumb canvas').count(), 'the project with compositions shows its lead composition');
  ok(await page.locator(R + '.st-lib tbody tr:has-text("' + PFX + ' at objectives") .st-lib-thumb.none').count(), 'a project with no composition says so instead of an empty box');
  ok(/no composition yet/.test(await page.locator(R + '.st-lib tbody tr:has-text("' + PFX + ' at objectives") .st-lib-thumb').textContent()), 'in words');
  ok(files.length && files.every(f => !f.publicPath && f.key), 'every thumbnail image came through the keyed file route: ' + JSON.stringify(files.slice(0, 3)));
  // search, filter, sort
  const rows = async () => page.$$eval(R + '.st-lib tbody tr', t => t.map(r => (r.querySelector('.st-lib-open') || r.querySelector('b') || {}).textContent || ''));
  await page.fill(R + 'input[aria-label="Search projects"]', 'at copy');
  await sleep(200); let names = await rows(); ok(names.length >= 1 && names.every(n => /at copy/.test(n)), 'search narrows to the matches: ' + names.join(' | '));
  await page.fill(R + 'input[aria-label="Search projects"]', 'zzzz nothing');
  await page.waitForSelector(R + '.st-lib-nomatch'); ok(/No project matches "zzzz nothing"/.test(await page.textContent(R + '.st-lib-nomatch')), 'an empty search says so');
  await page.click(R + '.st-lib-nomatch button:has-text("Clear the search and filters")'); await sleep(200);
  ok((await rows()).length >= 4, 'clearing brings every project back');
  await page.selectOption(R + 'select[aria-label="Sort projects"]', 'name'); await sleep(200);
  names = (await rows()).filter(n => n.startsWith(PFX)); eq(names.slice().sort((a, b) => a.localeCompare(b)), names, 'sorted by name');
  if (await page.$(R + 'select[aria-label="Filter by stage"]')) { const opts = await page.$$eval(R + 'select[aria-label="Filter by stage"] option', o => o.map(x => x.value).filter(Boolean)); await page.selectOption(R + 'select[aria-label="Filter by stage"]', opts[0]); await sleep(200); const st = await page.$$eval(R + '.st-lib tbody tr:not(.st-legacy) .st-status', s => s.map(x => x.textContent.trim())); ok(st.length && st.every(x => x === opts[0]), 'the stage filter keeps that stage only: ' + st.join(',')); await page.selectOption(R + 'select[aria-label="Filter by stage"]', ''); }
  // recent: opened projects are remembered for this browser and offered first
  for (const t of [PFX + ' at copy', PFX + ' at design']) { await page.locator(R + '.st-lib tbody tr:has-text("' + t + '") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await openLib(page); }
  await page.waitForSelector(R + '.st-lib-recent', { timeout: 5000 });
  const rec = await page.$$eval(R + '.st-lib-recent button', b => b.map(x => x.textContent)); eq(rec.slice(0, 2), [PFX + ' at design', PFX + ' at copy'], 'opened recently, newest first');
  // failure: the list request fails once; the page says what happened and Try again loads it
  fx.failNext(/^\/studio\/list/, 500, { error: 'boom' });
  await page.evaluate(() => { go('command'); }); await sleep(200); await page.evaluate(() => { go('studio'); });
  await page.waitForSelector(R + '.st-lib-fail', { timeout: 15000 });
  ok(/did not load/.test(await page.textContent(R + '.st-lib-fail')) && /nothing was changed/.test(await page.textContent(R + '.st-lib-fail')), 'the failure says what happened and that nothing changed');
  await page.click(R + '.st-lib-fail button:has-text("Try again")');
  await page.waitForSelector(R + '.st-lib tbody tr', { timeout: 15000 });
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B2 the appearance is this browser\'s (dark, light, system), survives a reload and never changes the artwork', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openLib(page);
  const tokens = () => page.$eval(R + '.st', e => ({ theme: e.getAttribute('data-st-theme'), bg: getComputedStyle(e).getPropertyValue('--sk-bg').trim(), panel: getComputedStyle(e).getPropertyValue('--sk-panel').trim(), accent: getComputedStyle(e).getPropertyValue('--sk-accent').trim() }));
  const dark = await tokens(); eq([dark.theme, dark.bg], ['dark', '#101318'], 'dark by default');
  const find = '(' + thumbOf.toString() + ')(' + JSON.stringify(PFX + ' at design') + ')';
  const art = async () => page.evaluate(f => { const c = eval(f); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 41) h = (h * 31 + d[i]) >>> 0; return c.width + 'x' + c.height + ':' + h; }, find);
  await page.waitForFunction(f => { const c = eval(f); if (!c) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 400) if (d[i]) return true; return false; }, find, { timeout: 20000 });
  await sleep(600); const artDark = await art();
  await page.click(R + '.st-theme button:has-text("Light")'); await sleep(300);
  const light = await tokens(); eq([light.theme, light.bg, light.panel], ['light', '#f4f6f9', '#ffffff'], 'light tokens');
  ok(light.accent && light.accent !== dark.accent, 'the light accent is its own (darkened to read on white): ' + light.accent);
  const contrast = await page.evaluate(a => { const hex = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null; }; const L = c => { const t = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; }; const c = hex(a); if (!c) return null; return (1.05) / (L(c) + 0.05); }, light.accent);
  ok(contrast == null || contrast >= 4.5, 'the light accent reads at 4.5:1 or better on white: ' + contrast);
  eq(await art(), artDark, 'the artwork is drawn the same in either appearance');
  await page.reload(); await page.evaluate(() => go('studio')); await page.waitForSelector(R + '.st-lib tbody tr', { timeout: 20000 });
  eq((await tokens()).theme, 'light', 'the choice survives a reload');
  // system follows the device
  await page.click(R + '.st-theme button:has-text("System")'); await page.emulateMedia({ colorScheme: 'light' }); await sleep(200);
  eq((await tokens()).bg, '#f4f6f9', 'system + a light device = light');
  await page.emulateMedia({ colorScheme: 'dark' }); await sleep(200);
  eq((await tokens()).bg, '#101318', 'system + a dark device = dark');
  await page.click(R + '.st-theme button:has-text("Dark")');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B3 the stage heads answer missing / accepted / main action / next, and an earlier stage says what a change would leave behind', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openProject(page, PFX + ' at directions');
  await phase(page, 'Explore');
  const five = async () => page.$$eval(R + '.st-stagehead .st-five > div', d => Object.fromEntries(d.map(x => [x.querySelector('dt').textContent.trim(), x.querySelector('dd').textContent.trim()])));
  let f = await five();
  eq(Object.keys(f), ['Missing', 'Accepted', 'Main action', 'Next'], 'the four answers beside "Working on"');
  ok(/direction selected/.test(f.Missing), 'missing: a direction is still to be selected: ' + f.Missing);
  ok(/objective "Correct the subsidy claim/.test(f.Accepted) && /strategy: Evidence-led/.test(f.Accepted), 'accepted names what was confirmed: ' + f.Accepted);
  ok(/Copy/.test(f.Next), 'next names the step after: ' + f.Next);
  // upstream: the objectives step says what a change there would leave on the earlier choice, before anything changes
  await phase(page, 'Brief', 'Objectives');
  await page.waitForSelector(R + '.st-downstream', { timeout: 10000 });
  ok(/Changing a choice here would leave 3 directions on the earlier choice/.test(await page.textContent(R + '.st-downstream')), await page.textContent(R + '.st-downstream'));
  // the key message changes (the team chose to update); the directions are now on an earlier choice and every head says so
  const r = await fx.api('POST', '/studio/workflow/confirm', { project: S.directions, step: 'objectives', objective: 'O1', message: 'M1.2', acknowledge: 'update' });
  ok(!r.error, JSON.stringify(r).slice(0, 200));
  await page.reload(); await page.evaluate(() => go('studio')); await page.waitForSelector(R + '.st-step', { timeout: 20000 });
  await phase(page, 'Brief', 'Strategy');
  await page.waitForSelector(R + '.st-downstream', { timeout: 10000 });
  const ds = await page.textContent(R + '.st-downstream');
  ok(/Built on an earlier choice: 3 directions/.test(ds) && /never deleted/.test(ds), ds);
  await page.click(R + '.st-downstream button:has-text("Review the directions")'); await sleep(500);
  ok(await page.$(R + '.st-step.on[data-phase="explore"]'), 'Review the directions opens Explore');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B4 Explore is one set of direction cards side by side, each with its own sketch and words', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openProject(page, PFX + ' at copy'); await phase(page, 'Explore');
  await page.waitForSelector(R + '.st-dcard', { timeout: 15000 });
  eq(await page.$(R + '.st-dstrip'), null, 'no strip of the same previews above the cards');
  // the cards rise in one after another (sk-pop, 60 ms apart): measured mid-entrance a card still carries part of its
  // translateY (CI caught 312,312,313), so the row is read once every entrance has finished
  await page.evaluate(async () => { const els = Array.from(document.querySelectorAll('#studio-root .st-dgrid[role="list"] > .st-dcard')); await Promise.all(els.flatMap(e => e.getAnimations()).map(a => a.finished.catch(() => {}))); });
  const cards = await page.$$eval(R + '.st-dgrid[role="list"] > .st-dcard', c => c.map(x => ({ top: Math.round(x.getBoundingClientRect().top), art: !!x.querySelector('.st-dcard-art canvas'), title: (x.querySelector('h4') || {}).textContent })));
  ok(cards.length >= 2, 'cards: ' + cards.length);
  ok(cards.every(c => c.art && c.title), 'every card carries its own sketch and title');
  eq(new Set(cards.slice(0, 3).map(c => c.top)).size, 1, 'the first three sit side by side in one row: ' + cards.map(c => c.top).join(','));
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B5 the Creative Director: three parts wherever an asset is in scope, a new part or asset starts at its beginning, diagnostics behind a disclosure', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openDesign(page, PFX + ' at design', 'Instagram');
  // a review exists to read: ask for one (mocked; the inspect stage answers)
  await page.click(R + '#st-tabbtn-director'); await page.click(R + '.st-cd-tab:has-text("Review")');
  await page.click(R + '.st-cd-review button:has-text("Review v")');
  await page.waitForSelector(R + '.st-cd-review .st-cd-scores', { timeout: 30000 });
  const vis = await page.$eval(R + '.st-cd-review', e => { const c = e.cloneNode(true); c.querySelectorAll('details').forEach(d => d.remove()); return c.textContent; });
  ok(!/gemini|claude|opus|sonnet/i.test(vis), 'no model name outside the disclosure: ' + vis.slice(0, 200));
  ok(/fidelity/i.test(vis) && /\/ 5|not scored/.test(vis), 'the design scores stay in view');
  ok(await page.$(R + '.st-cd-review details.st-cd-diag:not([open])'), 'diagnostics are a closed disclosure');
  await page.click(R + '.st-cd-review details.st-cd-diag summary');
  ok(/Review event/.test(await page.textContent(R + '.st-cd-review details.st-cd-diag')), 'and hold the review\'s record when opened');
  // a part that is scrolled, then another part, then back: each starts at its beginning
  const body = R + '.st-cd-body';
  await page.$eval(body, e => { e.scrollTop = 99999; }); const deep = await page.$eval(body, e => e.scrollTop);
  await page.click(R + '.st-cd-tab:has-text("Explore")'); await sleep(250);
  eq(await page.$eval(body, e => e.scrollTop), 0, 'Explore opens at its top (it was ' + deep + ' px down in Review)');
  await page.click(R + '.st-cd-tab:has-text("Review")'); await sleep(250);
  eq(await page.$eval(body, e => e.scrollTop), 0, 'Review opens at its top');
  // someone reading an unchanged review keeps their place while the page refreshes around it
  await page.$eval(body, e => { e.scrollTop = 40; }); const kept = await page.$eval(body, e => e.scrollTop);
  await sleep(3200);   // the island's job poll and clock tick re-render the panel
  eq(await page.$eval(body, e => e.scrollTop), kept, 'an unchanged review keeps its scroll position');
  // another asset: back to the top of its review
  await page.locator(R + '.st-pagechip:has-text("Facebook")').first().click(); await sleep(900);
  eq(await page.$eval(body, e => e.scrollTop), 0, 'another asset starts at the top of its review');
  // outside Design the same three parts; Explore says where its work happens and opens it
  await phase(page, 'Copy'); await sleep(500);
  const tabs = await page.$$eval(R + '.st-cd-tab', t => t.map(x => x.textContent.trim()));
  eq(tabs, ['Review', 'Explore', 'Conversation'], 'the same three parts in Copy');
  await page.click(R + '.st-cd-tab:has-text("Explore")');
  ok(/works on the composition/.test(await page.textContent(R + '.st-cd-elsewhere')), 'Explore says it works on the composition');
  await page.click(R + '.st-cd-elsewhere button:has-text("in Design")'); await sleep(800);
  ok(await page.$(R + '.st-step.on[data-phase="design"]') && await page.$(R + '.st-stage canvas'), 'and opens the piece in Design');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B6 Design at 1440 x 900: a 4:5 artboard of 560 px or more with the inspector open, reframing never over the artwork, nothing in the readiness line cut off, layers named', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openDesign(page, PFX + ' at design', 'Instagram');
  const insp = await box(page, R + '#st-inspector'); ok(insp.w > 280 && insp.r <= 1441, 'the inspector is open: ' + JSON.stringify(insp));
  const art = await box(page, R + '.st-stage canvas');
  ok(art.h >= 560, 'the fitted 4:5 artboard is ' + Math.round(art.h) + ' px tall');
  ok(Math.abs(art.w / art.h - 0.8) < 0.02, 'and 4:5: ' + (art.w / art.h).toFixed(3));
  // the readiness line: no element that clips its text (ellipsis or hidden overflow with more content than room)
  await page.waitForSelector(R + '.st-readystrip', { timeout: 10000 });
  const clipped = await page.$$eval(R + '.st-readystrip *', els => els.filter(e => { const s = getComputedStyle(e); return e.scrollWidth > e.clientWidth + 1 && (s.textOverflow === 'ellipsis' || s.overflow === 'hidden' || s.overflowX === 'hidden') && e.textContent.trim(); }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 60)));
  eq(clipped, [], 'nothing in the readiness line is cut off');
  const sb = await box(page, R + '.st-readystrip'); ok(sb.b <= 900, 'the readiness line is in view');
  const top = await page.$(R + '.st-qtop b');
  if (top) { const t = await top.textContent(); ok(!/\b(hl|sp|cta|panel_\w+)\b/.test(t) || /call to action|headline|supporting/.test(t), 'layers are named, not given by id: ' + t); }
  // reframing: the hint is in the tool row, never over the artwork; the artwork does not shrink under 560 for it
  const fr = page.locator(R + 'button:has-text("Frame by dragging")');
  if (await fr.count()) {
    await fr.first().click(); await page.waitForSelector(R + '.st-cropbar', { timeout: 5000 });
    const cb = await box(page, R + '.st-cropbar'); const st = await box(page, R + '.st-stage');
    ok(!meet(cb, st), 'the reframing bar sits outside the stage');
    const hints = await page.$$eval(R + '.st-le-frame-hint', h => h.filter(x => x.getBoundingClientRect().width > 0).length); eq(hints, 0, 'no hint drawn over the artwork');
    ok((await box(page, R + '.st-stage canvas')).h >= 560, 'reframing keeps the artboard at 560 px or more');
    await page.click(R + '.st-cropbar button:has-text("Cancel")');
  }
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B7 on a phone the inspector opener never covers the readiness line once it is scrolled into view', async () => {
  const page = await fx.open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await openDesign(page, PFX + ' at design', 'Facebook');
  await page.waitForSelector(R + '.st-readystrip', { timeout: 10000 });
  await page.$eval(R + '.st-readystrip', e => e.scrollIntoView({ block: 'center' })); await sleep(300);
  const strip = await box(page, R + '.st-readystrip'); const tog = await box(page, R + '.st-insp-toggle');
  ok(!meet(strip, tog), 'the opener and the readiness line do not overlap: ' + JSON.stringify({ strip, tog }));
  // and the end of the column can be reached above the opener
  await page.evaluate(() => { let el = document.querySelector('#studio-root .st-readystrip'); while (el && el !== document.body) { if (el.scrollHeight > el.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight; el = el.parentElement; } window.scrollTo(0, document.body.scrollHeight); }); await sleep(300);
  const s2 = await box(page, R + '.st-readystrip'); const t2 = await box(page, R + '.st-insp-toggle');
  ok(!meet(s2, t2), 'scrolled to its end, still clear: ' + JSON.stringify({ s2, t2 }));
  ok((await box(page, R + '.st-stage canvas')).w >= 250, 'the artwork keeps a usable size on a phone');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('G-B8 Copy adapts a piece for another channel as one stated model call, no render', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await openProject(page, PFX + ' at copy'); await phase(page, 'Copy');
  await page.waitForSelector(R + '.st-copy-adapt', { timeout: 10000 });
  ok(/no render/.test(await page.textContent(R + '.st-copy-adapt')) && /1 model call/.test(await page.textContent(R + '.st-copy-adapt')), 'the cost is stated before anything runs');
  const opts = await page.$$eval(R + '#st-adapt-to option', o => o.map(x => x.value).filter(Boolean)); ok(opts.indexOf('linkedin') >= 0, 'another channel is offered: ' + opts.join(','));
  const sent = []; page.on('request', r => { if (/\/studio\/job$/.test(r.url()) && r.method() === 'POST') { try { sent.push(JSON.parse(r.postData())); } catch (e) {} } });
  await page.selectOption(R + '#st-adapt-to', 'linkedin');
  await page.click(R + '.st-copy-adapt button:has-text("Adapt")');
  await page.waitForFunction(() => true); await sleep(1500);
  const j = sent.find(x => x.stage === 'revise'); ok(j, 'a revise job was sent: ' + JSON.stringify(sent).slice(0, 300));
  ok(/Adapt this piece for LinkedIn/.test(j.input.instruction) && !j.input.render, 'naming the channel, with no render: ' + JSON.stringify(j.input).slice(0, 200));
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
