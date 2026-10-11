/* S24 slice 4: the visible workflow, measured in real Chromium against the worker module in this process (providers MOCKED;
 * nothing is spent). Each case states a defect found in the S23 build (2e382a7, page r18) and fails there:
 *   U1  Design had two tool rows (the canvas bar, then the editor's tools that wrapped to a third line) and two Fit controls
 *   U2  model identifiers and "fallback fonts" in the working views (the composition facts under the canvas)
 *   U3  internal layer ids and saliency jargon ("hl, sp, cta", "s1, confidence 30%") in the readiness line
 *   U4  essential labels cut off with no way to read them (the asset name in the bar, the measurement line, the project name)
 *   U5  stage heads did not say whether the step's actions call a model
 *   U6  on a phone, Copy's status cards filled the first screen and pushed the words below it
 *   U7  Checks did not say which judge is a measurement, which an AI opinion and which a person
 *   U8  the arrangement tools still work from the one row (Arrange menu): align moves the layer; a click elsewhere closes it
 *   U9  the step labels in the header were cut to "B..", "Ex.." at tablet width
 * Run: node --experimental-sqlite tests/studio-s24-browser.mjs */
import { makeStudio, runner, eq, ok, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.S24_PORT) || 8896, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s24-browser (one toolbar, plain words, nothing cut off, stage heads, phone Copy; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const seeded = await seedStages(fx, { only: ['copy', 'design'], prefix: 'S24 U' });
let page;
async function openProject(title, viewport) {
  page = await fx.open({ viewport: viewport || { width: 1440, height: 900 }, quiet: true, onPage: pg => { pg.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text() + ' [' + ((m.location() || {}).url || '') + ']'); }); } }); page.on('dialog', d => d.accept());
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
}
async function openDesign(viewport) {
  await openProject('S24 U at design', viewport);
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  const asset = page.locator(R + '.st-assetpick, ' + R + '.st-pagechip').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(900);
}
// every page's uncaught errors are kept and checked at the end (G1): a journey that throws is a failure even when its assertions pass
const pageErrors = [];
// console errors from the moment each page starts loading; the faults these cases inject on purpose and the front page's empty
// state are named by route, everything else fails G1
const consoleErrors = [];
// the AXIOM page around the Studio loads its own feeds (trends, GDELT, news) as it starts; the sandbox cannot reach their upstreams,
// so the worker answers 502 - those are named by route (not /studio/, /brand/ or /review/), never a Studio request
const EXPECTED = [/status of 50[234] \([^)]*\) \[https?:\/\/[^/]+\/(?!studio\/|brand\/|review\/)/, /fonts\.googleapis\.com/, /status of 404 \(Not Found\) \[[^\]]*\/brief\/daily\]/, /net::ERR_|Failed to fetch|connection/i, /status of 409 \(Conflict\)/];
const close = async () => { if (page) { pageErrors.push(...(page.errors || []).map(e => e.slice(0, 200))); await page.ctxB.close(); page = null; } };
// every control in the canvas toolbar: its box, whether it is drawn, and the bar's own box and row count
const bar = () => page.evaluate(() => {
  const b = document.querySelector('#studio-root .st-canvasbar'); const r = b.getBoundingClientRect();
  const ctl = Array.from(b.querySelectorAll('button, select, summary')).filter(e => !e.closest('.st-le-arrpop, .st-le-viewpop, .st-more-pop, .st-hist-pop, .st-dstep-pop'));
  const shown = ctl.filter(e => { const s = getComputedStyle(e); const q = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && q.width > 0 && q.height > 0; });
  const tops = Array.from(new Set(shown.map(e => Math.round(e.getBoundingClientRect().top / 8)))).length;
  const out = shown.filter(e => { const q = e.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }).map(e => e.textContent.trim() || e.getAttribute('aria-label'));
  return { h: Math.round(r.height), w: Math.round(r.width), rows: tops, out, names: shown.map(e => (e.textContent.trim() || e.getAttribute('aria-label') || '').slice(0, 24)),
    toolRowsOutside: Array.from(document.querySelectorAll('#studio-root .st-le-tools')).filter(t => !t.closest('.st-canvasbar')).length };
});
// visible text of the working view, without the History tab and the diagnostics disclosures (they name models on purpose)
const workingText = () => page.evaluate(() => {
  const root = document.querySelector('#studio-root .st'); const clone = root.cloneNode(true);
  clone.querySelectorAll('#st-tab-history, .st-cd-diag, [hidden], .st-vh, option').forEach(e => e.remove());
  return clone.textContent.replace(/\s+/g, ' ');
});
const cut = sel => page.$$eval(R + sel, els => els.filter(e => { const s = getComputedStyle(e); return s.display !== 'none' && e.getBoundingClientRect().width > 2 && (e.scrollWidth > e.clientWidth + 1) && (s.overflow === 'hidden' || s.overflowX === 'hidden') && s.textOverflow === 'ellipsis'; }).map(e => e.className + ': ' + e.textContent.trim().slice(0, 40)));

await T.t('U1. Design has one toolbar row with one zoom control: no second tool row, no separate Fit button, nothing past the bar', async () => {
  await openDesign();
  let m = await bar();
  eq(m.toolRowsOutside, 0, 'the editor tools sit inside the canvas toolbar, not in a row of their own');
  ok(m.rows === 1 && m.h <= 48, 'one row of controls (' + m.rows + ' rows, ' + m.h + 'px): ' + m.names.join(' | '));
  eq(m.out, [], 'no control runs past the bar');
  eq(await page.$$eval(R + '.st-canvasbar button', b => b.filter(x => x.textContent.trim() === 'Fit').length), 0, 'no separate Fit button');
  eq(await page.$$eval(R + '.st-canvasbar select[aria-label="Zoom"]', s => s.length), 1, 'one zoom control');
  ok(await page.$eval(R + '.st-canvasbar select[aria-label="Zoom"]', s => Array.from(s.options).some(o => o.value === 'fit')), 'Fit is a level of the zoom control');
  // a layer selected: still one row (arrangement is one menu, not a second row)
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(250);
  m = await bar(); ok(m.rows === 1 && m.h <= 48, 'still one row with a selection (' + m.rows + ' rows, ' + m.h + 'px): ' + m.names.join(' | ')); eq(m.out, [], 'nothing past the bar with a selection');
  for (const sz of [{ width: 1920, height: 1080 }, { width: 1024, height: 768 }]) {
    await close(); await openDesign(sz); await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(250);
    const k = await bar(); ok(k.rows === 1, 'one row at ' + sz.width + ' (' + k.rows + '): ' + k.names.join(' | ')); eq(k.out, [], 'nothing past the bar at ' + sz.width);
  }
});

await T.t('U2. no model identifiers and no "fallback fonts" in the working views; History still names the model', async () => {
  await close(); await openDesign();
  const t = await workingText();
  ok(!/gemini-|claude-|\bopus\b|\bsonnet\b|nano-banana/i.test(t), 'no model id in the working view: ' + (t.match(/.{40}(gemini-|claude-|opus|sonnet).{40}/i) || [''])[0]);
  ok(!/fallback fonts/i.test(t), 'no "fallback fonts"');
  ok(/imagery 2K/i.test(await page.textContent(R + '.st-comp-info .st-comp-tag')), 'the facts say the imagery and its resolution');
  await place(page, 'history'); await page.waitForSelector(R + '#st-tab-history');
  const used = page.locator(R + '#st-tab-history button:has-text("What the Studio used"), ' + R + '#st-tab-history summary:has-text("What the Studio used")'); if (await used.count()) { await used.first().click(); await sleep(600); }
  ok(/gemini-3-pro-image/.test(await page.textContent(R + '#st-tab-history')), 'History (what the Studio used) names the image model');
});

await T.t('U3. the readiness line names layers as people read them and says a subject estimate plainly: no "hl, sp, cta", no "s1, confidence 30%"', async () => {
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll('#studio-root .st-le-layer')).map(e => e.getAttribute('data-id') || '').filter(Boolean));
  await page.waitForSelector(R + '.st-readystrip .st-qtop', { timeout: 15000 });
  const t = await page.textContent(R + '.st-readystrip');
  ok(!/confidence \d+%/.test(t) && !/\bs\d+,/.test(t), 'no saliency jargon: ' + t.replace(/\s+/g, ' ').slice(0, 300));
  const L = (await api('GET', '/studio/get?id=' + seeded.design)).assets[0]; const v = L.versions.find(x => x.id === L.current); const lids = (v.layout.layers || []).map(l => l.id).filter(x => !/^(headline|panel|logo|wordmark)$/.test(x));
  const leaked = lids.concat(ids).filter(id => id && new RegExp('\\b' + id + '\\b').test(t.replace(/show on the tile/g, '')) && !/^(headline|panel|logo|wordmark|support|cta)$/.test(id));
  eq(leaked, [], 'no internal layer id in the readiness line: ' + t.replace(/\s+/g, ' ').slice(0, 300));
  ok(!/\bcta\b/.test(t), 'a role is said in full ("call to action")');
  if (/subject/.test(t)) ok(/estimate/.test(t), 'a subject is said to be an estimate');
});

await T.t('U4. nothing essential is cut off: the composition facts, the measurement line and the step label wrap or fit; the project name opens its facts in full', async () => {
  const bad = await cut('.st-comp-facts, .st-comp-tag, .st-le-val, .st-qtop, .st-step.on .st-step-l, .st-pagechip-t, .st-canvasbar *');
  eq(bad, [], 'no ellipsis on an essential label');
  ok(/1080 x 1080 px/.test(await page.textContent(R + '.st-comp-facts')), 'the asset, its format, size and version are said in full under the canvas');
  await page.click(R + '.st-head button.st-ptitle'); await page.waitForSelector(R + '#st-projinfo');
  const info = await page.textContent(R + '#st-projinfo');
  ok(/S24 U at design/.test(info) && /Minerals Council/.test(info) && /Campaign/.test(info) && /Content/.test(info), 'the facts in full: ' + info);
  eq(await page.getAttribute(R + '.st-head button.st-ptitle', 'aria-expanded'), 'true', 'the name says it is expanded');
  await page.keyboard.press('Escape'); await page.waitForSelector(R + '#st-projinfo', { state: 'detached' });
});

await T.t('U5. every stage head says whether its actions call a model (and how many), or that they call none', async () => {
  for (const [step, re] of [['Brief', /AI\s+Analyse: 1 model call/], ['Explore', /AI\s+Selecting: none/], ['Copy', /AI\s+Writing the copy: 1 model call, no render/], ['Review', /AI\s+None/]]) {
    await page.click(R + '.st-step:has(.st-step-l:text-matches("^' + step + '"))'); await sleep(600);
    const t = await page.textContent(R + '.st-stagehead .st-phase-line'); ok(re.test(t), step + ': ' + t.replace(/\s+/g, ' '));
  }
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await sleep(600);
  await page.click(R + '.st-dstep > summary'); ok(/AI\s*Canvas, layout variations and Fix layout: none/.test(await page.textContent(R + '.st-dstep-pop')), 'Design says it in its step popover');
});

await T.t('U7. Checks names its three judges: a measurement, an AI opinion and a person', async () => {
  await place(page, 'checks'); await page.waitForSelector(R + '.st-readydetail');
  const t = (await page.textContent(R + '.st-readydetail')).replace(/\s+/g, ' ');
  ok(/Measured\s*Technical validation/.test(t) && /AI opinion\s*Creative Director/.test(t) && /Person\s*Approval/.test(t), t.slice(0, 400));
});

await T.t('U8. arranging from the one row: Arrange opens a menu, Align left moves the layer, a click elsewhere closes the menu', async () => {
  await page.click(R + '.st-le-layer[aria-label="Layer support"]'); await sleep(200);
  const x0 = await page.$eval(R + '.st-le-layer[aria-label="Layer support"]', e => e.style.left);
  await page.click(R + '.st-le-arrange > summary'); ok(await page.isVisible(R + '.st-le-arrpop button:has-text("Align left")'), 'the menu shows align');
  ok(await page.isVisible(R + '.st-le-arrpop button:has-text("To front")') && await page.isVisible(R + '.st-le-arrpop button:has-text("Group")'), 'order and group are in it');
  await page.click(R + '.st-le-arrpop button:has-text("Align right")'); await sleep(250);
  ok((await page.$eval(R + '.st-le-layer[aria-label="Layer support"]', e => e.style.left)) !== x0, 'align moved the layer');
  await page.mouse.click(5, 450); await sleep(200);
  ok(!(await page.$(R + '.st-le-arrange[open]')), 'a click elsewhere closes the menu');
  await page.click(R + '.st-le-viewopts > summary');
  for (const n of ['Guides', 'Safe-area guides', 'Rulers and guides', 'Grid', 'Resize scales type', 'Checkerboard']) ok(await page.isVisible(R + '.st-le-viewpop input[aria-label="' + n + '"]'), 'View holds ' + n);
  await page.click(R + '.st-le-viewopts > summary');
});

await T.t('U6. on a phone, Copy opens on the words: the step status folds to one line that says what is missing', async () => {
  await close(); await openProject('S24 U at copy', { width: 390, height: 844 });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))').catch(() => {}); await sleep(900);
  await page.waitForSelector(R + '.st-five-wrap');
  eq(await page.$eval(R + '.st-five-wrap', d => d.open), false, 'the status is folded');
  ok(/Missing/.test(await page.textContent(R + '.st-five-sum')), 'its one line says what is missing: ' + await page.textContent(R + '.st-five-sum'));
  const firstPiece = await page.$eval(R + '.st-copy-list', e => e.getBoundingClientRect().top).catch(() => null);
  const firstField = await page.$eval(R + '.st-copy-field', e => e.getBoundingClientRect().top).catch(() => null);
  ok(firstPiece != null && firstPiece < 600, 'the pieces start on the first screen, not under the status (list at ' + firstPiece + 'px, first field at ' + firstField + 'px)');
  await page.click(R + '.st-five-sum'); ok(await page.isVisible(R + '.st-five'), 'it opens to the full status');
});

await T.t('U9. at tablet width no step label is cut to an ellipsis; the other steps keep their names for screen readers', async () => {
  await close(); await openDesign({ width: 834, height: 1194 });
  const bad = await cut('.st-step .st-step-l, .st-ptitle');
  eq(bad, [], 'no cut-off step label');
  eq(await page.$$eval(R + '.st-head .st-step .st-step-l', x => x.map(e => e.textContent)), ['Brief', 'Explore', 'Copy', 'Design', 'Review & Deliver'], 'every step keeps its name in the page');
  const m = await bar(); eq(m.out, [], 'the toolbar keeps every control inside its box at 834: ' + m.names.join(' | '));
  for (const n of ['Undo', 'Redo', 'Add', 'View']) ok(m.names.some(x => x.indexOf(n) >= 0), n + ' is reachable at 834: ' + m.names.join(' | '));
  // and on a wide laptop the step names and the current step's note are whole (the other notes fold into the step's name for screen readers)
  await close(); await openDesign({ width: 1600, height: 1000 });
  eq(await cut('.st-step .st-step-l, .st-step.on .st-step-note'), [], 'no cut-off step label or current note at 1600');
});

// ---------------------------------------------------------------- slice 5: Fix layout is measured, never believed
async function collide() {
  const g = await api('GET', '/studio/get?id=' + seeded.design); const A = g.assets.find(x => /facebook/i.test(x.channel || x.title)) || g.assets[0];
  const v = A.versions.find(x => x.id === A.current); const L = JSON.parse(JSON.stringify(v.layout));
  const hl = L.layers.find(l => l.role === 'headline'), sp = L.layers.find(l => l.role === 'support');
  sp.y = hl.y + 1; sp.x = hl.x;   // the supporting line laid over the headline: a blocking collision Fix layout can clear
  const r = await api('POST', '/studio/version', { asset: A.id, revision: A.revision, layout: L, note: 'S24 test: words laid over each other' });
  ok(r && (r.version || r.id || r.ok !== false), 'the colliding version was written: ' + JSON.stringify(r).slice(0, 200));
  return A.id;
}
await T.t('D1. a repair that says it fixed everything is not believed: the saved version is measured again, and a version that still blocks reads "Partly fixed", never "Fixed"', async () => {
  await close(); await collide(); await openDesign();
  await page.waitForSelector(R + '.st-readystrip .st-qact:has-text("Fix layout")', { timeout: 20000 });
  // the renderer's repair is replaced by one that claims a complete fix while it pushes the headline off the stage
  await page.evaluate(() => { const real = window.STRender.repair; window.__realRepair = real; window.STRender.repair = (layout, copy, imgs, o) => { const r = real(layout, copy, imgs, o); const L = JSON.parse(JSON.stringify(r.layout || layout)); const h = L.layers.find(l => l.role === 'headline'); h.x = 130; return Object.assign({}, r, { changed: true, layout: L, outcome: 'complete', ok: true, steps: ['moved the headline (claimed)'], counts: { before: 1, after: 0 }, remaining: { blocking: [] }, after: { issues: [] } }); }; });
  await page.click(R + '.st-readystrip .st-qact:has-text("Fix layout")');
  await page.waitForFunction(() => /Partly fixed|Fixed|Checking the fix/.test((document.querySelector('#studio-root .st-repair-note') || {}).textContent || ''), null, { timeout: 15000 });
  await page.waitForFunction(() => !/Checking the fix/.test(document.querySelector('#studio-root .st-repair-note').textContent), null, { timeout: 20000 });
  const t = (await page.textContent(R + '.st-repair-note')).replace(/\s+/g, ' ');
  ok(/^Partly fixed/.test(t.trim()), 'the outcome is the measurement of the saved version: ' + t.slice(0, 300));
  ok(/measured again with its images and fonts loaded/.test(t) && /off canvas/.test(t), 'it names what the saved version still has: ' + t.slice(0, 300));
  ok(/Undo fix/.test(t), 'and offers Undo fix');
  await page.evaluate(() => { window.STRender.repair = window.__realRepair; });
});
await T.t('D2. a real fix reads "Fixed" only once the saved version has been measured again; while it is checked it says so', async () => {
  await close(); await collide(); await openDesign();
  await page.waitForSelector(R + '.st-readystrip .st-qact:has-text("Fix layout")', { timeout: 20000 });
  await page.click(R + '.st-readystrip .st-qact:has-text("Fix layout")');
  await page.waitForFunction(() => /Fixed|Partly fixed|Blocked/.test((document.querySelector('#studio-root .st-repair-note') || {}).textContent || '') && !/Checking the fix/.test(document.querySelector('#studio-root .st-repair-note').textContent), null, { timeout: 20000 });
  const t = (await page.textContent(R + '.st-repair-note')).replace(/\s+/g, ' ').trim();
  if (/^Fixed/.test(t)) ok(/Measured again on v\d+ with its images and fonts loaded: nothing blocks/.test(t), 'Fixed is said by the second measurement: ' + t.slice(0, 260));
  else ok(/measured again/.test(t) || /^Blocked/.test(t), 'whatever the outcome, it comes from a measurement: ' + t.slice(0, 260));
});

// ---------------------------------------------------------------- slice 5: a long request that is not a job is shown while it runs
await T.t('O1. asking the model for brief suggestions is acknowledged at once: a line says what runs, how long, that a model call is charged once sent, and Cancel stops waiting (saying the call may still finish)', async () => {
  await close();
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S24 ops one', brief: { channels: ['facebook'], deliverable: 'set', campaignConfirmed: true }, idem: 's24ops1' });
  await openProject('S24 ops one');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Brief"))').catch(() => {});
  const ask = R + 'button:has-text("ask the model for suggestions")';
  await page.waitForSelector(ask, { timeout: 15000 });
  const release = fx.hold(/^\/studio\/brief\/suggest\?.*ai=1/);
  await page.click(ask);
  await page.waitForSelector(R + '.st-op[data-state="running"]', { timeout: 5000 });
  const t0 = await page.textContent(R + '.st-op'); ok(/Suggesting brief fields/.test(t0) && /charged once it is sent/.test(t0), t0);
  await sleep(2200); const t1 = await page.textContent(R + '.st-op'); ok(/[2-9] s/.test(t1), 'the elapsed time moves while it waits: ' + t1);
  await page.click(R + '.st-op button:has-text("Cancel")');
  await page.waitForSelector(R + '.st-op[data-state="cancelled"]', { timeout: 5000 });
  ok(/stopped waiting/.test(await page.textContent(R + '.st-op')) && /may still finish on the worker and be charged/.test(await page.textContent(R + '.st-op')), 'Cancel says what it did and did not stop');
  release();
});
await T.t('O2. a long request that loses its connection is reported as dropped (it may have finished on the worker), never as done', async () => {
  fx.failNext(/^\/studio\/brief\/suggest\?.*ai=1/, 0, null, { abort: true });
  await page.waitForSelector(R + '.st-op', { state: 'detached', timeout: 10000 }).catch(() => {});
  await page.click(R + 'button:has-text("ask the model for suggestions")');
  await page.waitForSelector(R + '.st-op[data-state="dropped"], ' + R + '.st-op[data-state="failed"]', { timeout: 10000 });
  ok(/connection dropped|failed/.test(await page.textContent(R + '.st-op')), await page.textContent(R + '.st-op'));
});

await close();
await T.t('G1. no page in any of these journeys threw an uncaught error or logged an unexpected console error', async () => { eq(pageErrors, [], 'uncaught page errors'); eq(consoleErrors.filter(m => !EXPECTED.some(re => re.test(m))), [], 'unexpected console errors'); });
const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
