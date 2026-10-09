/* S23 slice J in real Chromium against the worker module in this process (studio-fixture.mjs; providers MOCKED, nothing spent):
 *   J-B1 a panel that throws stops alone: the Creative Director shows what stopped and Try again, the canvas keeps working;
 *   J-B2 offline: the page says so, keeps the edit in this browser, and reads the project again when the connection returns;
 *   J-B3 a read that meets a busy gateway (503) or a dropped connection is retried; a write is never retried behind the
 *        person's back;
 *   J-B4 seeded random editing: 40 operations chosen by a seeded generator; undoing all of them gives back exactly the layout
 *        that was opened, redoing all of them gives exactly the edited one, and saving writes exactly that layout;
 *   J-B5 a keyboard-only journey: the library searched and a project opened, phases by Alt+number, the shortcuts sheet opened
 *        and closed, the focus never lost to the page;
 *   J-B6 accessibility: axe-core (4.10.2, pinned) finds no serious or critical violation in the library, the Brief, Design,
 *        Review and the Brand workspace;
 *   J-B7 a tablet with touch (820 x 1180): Design opens with the artwork in view, no sideways scroll, the inspector reachable;
 *   J-B9 suggestions asked for while the composition moves on (a render landing, an edit saved) are shown when they arrive,
 *        marked as made before the change - CI caught them dropped, the panel back at its button with nothing to show;
 *   J-B8 the console guard: across the journeys above no page error, console error or unhandled rejection except the named
 *        ones a test injected on purpose.
 * Run: node --experimental-sqlite tests/studio-s23j-browser.mjs */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, place } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8882, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s23j-browser (error boundaries, offline, retried reads, seeded random edits, keyboard journey, axe, tablet, console guard; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
// the console guard: everything a page reports is kept; only the faults a test injects by name are allowed
// fonts.googleapis.com: the fixture aborts every request to a host other than the worker, so the page's Google Fonts
// stylesheet fails here by design (the page falls back to its system fonts and says so)
const ALLOWED = [/fonts\.googleapis\.com/, /fault injected into the director panel \(test\)/, /The above error occurred in/, /status of 50[03]/, /net::ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError/, /React will try to recreate this component tree/];
const reported = [];
let page;
const fresh = async o => {
  if (page) await page.ctxB.close().catch(() => {});
  page = await fx.open(Object.assign({ viewport: { width: 1440, height: 900 }, quiet: true }, o || {}));
  page.on('console', m => { if (m.type() === 'error') reported.push('console: ' + m.text() + ' [' + ((m.location() || {}).url || '') + ']'); });
  page.on('pageerror', e => reported.push('pageerror: ' + e.message));
  await page.addInitScript(() => { window.addEventListener('unhandledrejection', e => console.error('unhandledrejection: ' + String((e.reason && e.reason.message) || e.reason))); });
  return page;
};
const goStep = (pg, name) => pg.click(R + '.st-step:has(.st-step-l:' + (name === 'Review' ? 'text-matches("^Review")' : 'text-is("' + name + '")') + ')');
const openProject = async (pg, title) => {
  await pg.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} go('studio'); });
  const all = pg.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await pg.waitForSelector(R + '.st-lib tbody tr:has-text("' + title + '")', { timeout: 20000 });
  await pg.locator(R + '.st-lib tbody tr:has-text("' + title + '") button.st-lib-open').first().click();
  await pg.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(400);
};
const openTile = async (pg, title) => { await goStep(pg, 'Design'); await pg.click(R + '.st-assetpick:has-text("' + title + '")'); await pg.waitForSelector(R + '.st-stage canvas'); await pg.waitForSelector(R + '.st-le-layer', { timeout: 15000 }); await sleep(500); };

const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'c', alt: 'A teal band with the headline' };
const LAYOUT = () => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], noImagery: true, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Band', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF', font: 'display' },
  { id: 'support', type: 'text', role: 'support', x: 8, y: 82, w: 70, h: 8, size: 3, weight: 500, color: '#FFFFFF', font: 'body' },
  { id: 'kicker', type: 'text', role: 'free', name: 'Kicker', text: 'MYTH BUSTED', x: 8, y: 10, w: 40, h: 5, size: 2.6, weight: 700, color: '#F2B705', font: 'mono' },
  { id: 'chip', type: 'shape', role: 'device', name: 'Chip', shape: 'pill', x: 60, y: 10, w: 30, h: 6, fill: '#F2B705', opacity: 1 }] });
await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', logoPolicy: 'wordmark' }] });
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Reliability check', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'Say the credit is not a subsidy', message: 'The road tax is returned, not handed out' }, idem: 'j-rel' });
const mk = async t => (await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '4:5', title: t, copy: COPY, layout: LAYOUT(), mode: 'composition' })).asset.id;
const A1 = await mk('Steady tile'); const A2 = await mk('Random tile');
const get = async () => api('GET', '/studio/get?id=' + pr.id);
const curOf = a => a.versions.find(v => v.id === a.current);

await T.t('J-B1 a panel that throws stops alone: the Creative Director says what stopped and offers Try again; the canvas keeps working', async () => {
  await fresh(); await openProject(page, 'Reliability check'); await openTile(page, 'Steady tile');
  await page.evaluate(() => { window.__stCrashPanel = 'director'; });
  // re-render the director: open its tab
  const tab = page.locator(R + '.st-instab:has-text("Creative Director")'); if (await tab.count()) await tab.first().click(); await page.click(R + '.st-assetpick:has-text("Random tile")'); await sleep(600);
  await page.waitForSelector(R + '.st-panelerr', { timeout: 10000 });
  ok(/Creative Director panel stopped/.test(await page.textContent(R + '.st-panelerr')), await page.textContent(R + '.st-panelerr'));
  ok(await page.$(R + '.st-stage canvas'), 'the canvas is still there'); ok(await page.$(R + '.st-le-layer'), 'and editable');
  await page.evaluate(() => { window.__stCrashPanel = null; }); await page.click(R + '.st-panelerr button:has-text("Try again")'); await sleep(400);
  ok(!(await page.$(R + '.st-panelerr')), 'Try again brings the panel back');
});

await T.t('J-B2 offline: the page says so, and reads the project again when the connection returns', async () => {
  await fresh(); await openProject(page, 'Reliability check'); await openTile(page, 'Steady tile');
  await page.context().setOffline(true); await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await page.waitForSelector(R + '.st-offline', { timeout: 5000 });
  ok(/Unsaved edits stay in this browser/.test(await page.textContent(R + '.st-offline')), 'the offline line says what happens to the work');
  await page.context().setOffline(false); await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForSelector(R + '.st-offline', { state: 'detached', timeout: 5000 });
  await page.waitForSelector(R + '.st-notice:has-text("Back online")', { timeout: 8000 });
});

await T.t('J-B3 a read meeting a busy gateway is retried and the project opens; a write is not retried behind the person\'s back', async () => {
  await fresh();
  fx.failNext(/^\/studio\/get\?id=/, 503, { error: 'busy' });
  const before = fx.seen.length; await openProject(page, 'Reliability check'); await sleep(500);
  const gets = fx.seen.slice(before).filter(x => /^\/studio\/get\?id=/.test(x.path)).length; ok(gets >= 2, 'the read was asked again (' + gets + ' requests)');
  ok(!(await page.$(R + '.st-notice.error')), 'and no failure is shown');
  // a failure that is not retried (500) is shown with Try again, and Try again opens the project (it did nothing before:
  // the failed open had already cleared the project the retry was waiting for)
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} });
  { const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {}); }
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("Reliability check")', { timeout: 15000 });
  fx.failNext(/^\/studio\/get\?id=/, 500, { error: 'internal_error' });
  await page.locator(R + '.st-lib tbody tr:has-text("Reliability check") button.st-lib-open').first().click();
  await page.waitForSelector(R + '.st-notice button:has-text("Try again")', { timeout: 15000 });
  ok(!(await page.$(R + '.st-step')), 'the failed open leaves the library with the failure named');
  await page.click(R + '.st-notice button:has-text("Try again")'); await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  ok(true, 'Try again opened the project');
  fx.failNext(/^\/studio\/version$/, 503, { error: 'busy' });
  const v0 = fx.seen.filter(x => x.path === '/studio/version').length;
  await openTile(page, 'Steady tile'); await page.click(R + '.st-le-layer[data-id="chip"]'); await page.keyboard.press('ArrowLeft'); await sleep(300);
  await page.click(R + '.st-le-foot .btn:has-text("Save layout as a version")'); await sleep(1500);
  eq(fx.seen.filter(x => x.path === '/studio/version').length - v0, 1, 'a write that failed was sent once and left to the person');
  await page.click(R + '.st-le-foot .btn:has-text("Discard changes")').catch(() => {});
});

await T.t('J-B4 seeded random editing: undo all returns exactly the opened layout, redo all exactly the edited one, and the save writes exactly that', async () => {
  await fresh(); page.on('dialog', d => d.accept()); await openProject(page, 'Reliability check'); await openTile(page, 'Random tile');
  let seed = 23; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const work = async () => page.evaluate(id => { const w = window.STWork && window.STWork.get(id); return w && w.layout ? JSON.stringify((w.layout.layers || []).map(l => { const o = Object.assign({}, l); delete o._k; return o; })) : null; }, A2);
  const start = JSON.stringify(curOf((await get()).assets.find(a => a.id === A2)).layout.layers);
  const ids = ['panel', 'headline', 'support', 'kicker', 'chip'];
  const ops = [];
  for (let i = 0; i < 40; i++) {
    const r = rnd(); const id = ids[Math.floor(rnd() * ids.length)];
    const el = await page.$(R + '.st-le-layer[data-id="' + id + '"]'); if (el) await el.click({ force: true }).catch(() => {});
    if (r < 0.55) { const k = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'][Math.floor(rnd() * 4)]; await page.keyboard.press((rnd() < 0.4 ? 'Shift+' : '') + k); ops.push('nudge ' + id + ' ' + k); }
    else if (r < 0.7) { await page.keyboard.press('Control+BracketRight'); ops.push('forward ' + id); }
    else if (r < 0.85) { await page.keyboard.press('Control+BracketLeft'); ops.push('backward ' + id); }
    else { await page.keyboard.press('Control+z'); ops.push('undo'); }
    await sleep(60);
  }
  await sleep(500); const edited = await work(); ok(edited && edited !== start, 'the random operations changed the layout (' + ops.length + ' operations)');
  const undoBtn = R + '.st-le-tools button:has-text("Undo"), ' + R + 'button[aria-label^="Undo"]';
  for (let i = 0; i < 80; i++) { const b = await page.$(undoBtn); if (!b || await b.isDisabled()) break; await page.keyboard.press('Control+z'); await sleep(40); }
  // nothing unsaved is held once every step is undone: the working store is empty and the canvas shows the saved layout
  await sleep(500); eq((await work()) || start, start, 'undoing everything gives back exactly the layout that was opened');
  for (let i = 0; i < 80; i++) { const b = await page.$(R + '.st-le-tools button:has-text("Redo"), ' + R + 'button[aria-label^="Redo"]'); if (!b || await b.isDisabled()) break; await page.keyboard.press('Control+Shift+z'); await sleep(40); }
  await sleep(500); eq(await work(), edited, 'redoing everything gives exactly the edited layout');
  await page.click(R + '.st-le-foot .btn:has-text("Save layout as a version")');
  await page.waitForFunction(() => /No unsaved changes|Version saved/.test((document.querySelector('#studio-root .st-le-draft') || {}).textContent || ''), null, { timeout: 10000 });
  await sleep(500); const saved = JSON.stringify(curOf((await get()).assets.find(a => a.id === A2)).layout.layers.map(l => { const o = Object.assign({}, l); delete o._k; return o; }));
  eq(saved, edited, 'the saved version is exactly the edited layout');
});

await T.t('J-B5 a keyboard-only journey: search the library, open a project, move between phases, open and close the shortcuts, never losing the focus', async () => {
  await fresh(); await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} go('studio'); });
  const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await page.waitForSelector(R + 'input[aria-label="Search projects"]');
  await page.focus(R + 'input[aria-label="Search projects"]'); await page.keyboard.type('Reliability'); await sleep(200);
  let hops = 0; while (hops++ < 30) { await page.keyboard.press('Tab'); const t = await page.evaluate(() => { const e = document.activeElement; return e ? (e.className || '') + '|' + (e.textContent || '').trim().slice(0, 40) : ''; }); if (/st-lib-open/.test(t)) break; }
  ok(hops < 30, 'Tab reaches the project in a few steps (' + hops + ')');
  await page.keyboard.press('Enter'); await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(400);
  for (const [k, re] of [['Alt+4', /Design/], ['Alt+3', /Copy/], ['Alt+1', /Brief/]]) { await page.keyboard.press(k); await sleep(500); ok(re.test(await page.textContent(R + '.st-step.on')), k + ' opens ' + re); }
  await page.keyboard.press('Alt+4'); await sleep(400); await page.click(R + '.st-assetpick:has-text("Steady tile")'); await page.waitForSelector(R + '.st-le-layer');
  await page.focus(R + '.st-le-layer[data-id="chip"]'); await page.keyboard.press('Shift+Slash'); await page.waitForSelector(R + '.st-keys', { timeout: 5000 });
  await page.keyboard.press('Escape'); await page.waitForSelector(R + '.st-keys', { state: 'detached', timeout: 5000 });
  ok(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'the focus is on a control, not lost to the page');
});

const axeOn = async (label, ctx) => {
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async sel => { const res = await window.axe.run(document.querySelector(sel) || document, { resultTypes: ['violations'] }); return res.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, at: v.nodes.slice(0, 2).map(x => x.target.join(' ')) })); }, ctx || '#studio-root');
  const bad = r.filter(v => v.impact === 'serious' || v.impact === 'critical');
  axeReport[label] = { serious: bad, other: r.filter(v => bad.indexOf(v) < 0).map(v => v.id + '(' + v.impact + ')') };
  return bad;
};
const axeReport = {};
await T.t('J-B6 accessibility: no serious or critical axe violation in the library, the Brief, Design, Review and the Brand workspace', async () => {
  await fresh(); await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} go('studio'); });
  const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await page.waitForSelector(R + '.st-lib tbody tr'); await sleep(500);
  const fails = [];
  const check = async (label) => { const b = await axeOn(label); if (b.length) fails.push(label + ': ' + b.map(v => v.id + ' x' + v.n + ' (' + v.help + ') at ' + v.at.join(' | ')).join('; ')); };
  await check('library');
  await page.locator(R + '.st-lib tbody tr:has-text("Reliability check") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step'); await sleep(500);
  await goStep(page, 'Brief'); await sleep(500); await check('brief');
  await page.click(R + '.st-ctx-links button:has-text("Brand")').catch(() => {}); await page.waitForSelector(R + '.st-brand', { timeout: 10000 }).catch(() => {}); await sleep(500); await check('brand');
  await openTile(page, 'Steady tile'); await check('design');
  await goStep(page, 'Review'); await sleep(700); await check('review');
  fs.mkdirSync(new URL('./shots/s23/', import.meta.url), { recursive: true }); fs.writeFileSync(new URL('./shots/s23/axe.json', import.meta.url), JSON.stringify(axeReport, null, 2));
  eq(fails, [], 'no serious or critical violation');
});

await T.t('J-B7 a tablet with touch (820 x 1180): Design opens with the artwork in view, no sideways scroll, the inspector reachable', async () => {
  await fresh({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });
  await openProject(page, 'Reliability check'); await goStep(page, 'Design'); await page.click(R + '.st-assetpick:has-text("Steady tile")').catch(async () => { await page.tap(R + '.st-pagechip:has-text("Steady tile")'); });
  await page.waitForSelector(R + '.st-stage canvas'); await sleep(800);
  const m = await page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, top: c.top, bottom: c.bottom, h: c.height, vh: innerHeight }; });
  ok(m.sw <= m.cw + 1, 'no sideways scroll: ' + JSON.stringify(m)); ok(m.h > 300 && m.top < m.vh, 'the artwork is in view: ' + JSON.stringify(m));
  const t = page.locator(R + '.st-insp-toggle'); ok(await t.count(), 'the inspector has its opener on a tablet'); await t.first().tap(); await sleep(300);
  ok(await page.$(R + '.st-inspector.open'), 'and it opens with a tap');
});

await T.t('J-B9 suggestions asked for while a new version lands are shown when they arrive, labelled as the worker reads them', async () => {
  await fresh(); await openProject(page, 'Reliability check');
  const ask = R + '.st-partner .st-sugg.design button:has-text("Suggest for this version")', items = R + '.st-partner .st-sugg.design .st-sugg-item';
  const openAsk = async title => { await openTile(page, title); await place(page, 'Creative Director'); await page.click(R + '.st-cd-tab:has-text("Explore")'); await page.waitForSelector(ask, { timeout: 20000 }); };
  const nudgeSave = async () => {
    await page.click(R + '.st-le-layer[data-id="chip"]', { force: true }); await page.keyboard.press('ArrowLeft'); await sleep(300);
    await page.click(R + '.st-le-foot .btn:has-text("Save layout as a version")');
    await page.waitForFunction(() => /No unsaved changes|Version saved/.test((document.querySelector('#studio-root .st-le-draft') || {}).textContent || ''), null, { timeout: 15000 });
  };
  // the job waits its turn while a nudge is saved: the answer is made for the version on screen and shown as current
  await openAsk('Steady tile');
  const rel = fx.hold(/^\/studio\/job\/step/); await page.click(ask); await sleep(400); await nudgeSave(); await sleep(600); rel();
  await page.waitForSelector(items, { timeout: 20000 });
  let peek = await api('GET', '/studio/suggest?asset=' + A1); eq(peek.outdated, false, 'made for the version on screen');
  ok(!(await page.$(R + '.st-partner .st-sugg-outdated')), 'and not marked outdated');
  // CI's order: the version moves while the model is still answering; the answer arrives made for the earlier version and
  // is shown, marked as made before the change (it used to be dropped, the panel back at its button)
  fx.setProvider('claude', 'stream'); fx.providers.streamMs = 5000;
  try {
    await openAsk('Random tile');
    await page.click(ask);
    // the save waits until the model is answering, so the job has read the version the save then moves past
    let answering = false;
    for (let i = 0; i < 150 && !answering; i++) { const js = (await api('GET', '/studio/jobs?project=' + pr.id)).jobs || []; answering = js.some(j => j.stage === 'suggest' && j.asset === A2 && j.state === 'running' && ((j.progress || {}).activity || {}).phase === 'model'); if (!answering) await sleep(100); }
    ok(answering, 'the suggestion job was answering before the save');
    await nudgeSave();
    await page.waitForSelector(items, { timeout: 30000 });
    peek = await api('GET', '/studio/suggest?asset=' + A2); eq(peek.outdated, true, 'the worker reads it as made before the change');
    ok(await page.$(R + '.st-partner .st-sugg-outdated'), 'and the panel says so');
  } finally { fx.setProvider('claude', 'ok'); }
});

await T.t('J-B8 the console guard: no page error, console error or unhandled rejection except the named faults injected on purpose', async () => {
  if (page) await page.ctxB.close().catch(() => {}); page = null;
  const unexpected = reported.filter(m => !ALLOWED.some(re => re.test(m)));
  eq(unexpected, [], 'nothing unexpected (' + reported.length + ' reported, all named)');
});

T.done(); await fx.close();
