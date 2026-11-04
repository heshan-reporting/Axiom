/* Concept C in production (page r28), in real Chromium against the worker module in this process (providers MOCKED; nothing is
 * spent). The owner chose concept C and asked for the editing interface to look like their reference editor:
 *   C1  seven stages in the header (Brief, Message, Direction, Copy, Design, Review, Deliver); Deliver opens the package view
 *   C2  the rail: Add first, in the accent, opening the "Add item" flyout whose sections fold; the Design views at its foot
 *   C3  the top bar: the family's formats (the one on the canvas pressed; another opens that piece), the output width, and one
 *       zoom control that names the measured zoom
 *   C4  the Style panel: the selected layer as a chip; Spacing typed in output pixels moves the layer once (one undo step); Size
 *       in pixels resizes it
 *   C5  the colour field and picker: the contrast against the ground the renderer measured, a saved client colour applied
 *   C6  the version strip: the versions drawn small, the current one marked; a click compares and changes nothing
 *   C7  every wait shows a percentage: a slow render's line over the canvas carries "~N%" named as an estimate
 * Run: node --experimental-sqlite tests/studio-c-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.SC_PORT) || 8893, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-c-browser (concept C: seven stages, the reference editor, the Style panel, estimates; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const seeded = await seedStages(fx, { only: ['design'], prefix: 'SC' });
const pageErrors = [];
let page;
async function openDesign(viewport) {
  if (page) { pageErrors.push(...(page.errors || [])); await page.ctxB.close(); }
  page = await fx.open({ viewport: viewport || { width: 1440, height: 900 }, quiet: true }); page.on('dialog', d => { if (!d.studio) d.dismiss().catch(() => {}); });
  const row = R + '.st-lib tbody tr:has-text("SC at design"), ' + R + '.st-libcard:has-text("SC at design")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Create"))');
  const asset = page.locator(R + '.st-pagechip').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(900);
}
const layerOf = async id => { const g = await api('GET', '/studio/get?id=' + seeded.design); const a = g.assets.find(x => x.title === 'Facebook post') || g.assets[0]; const v = a.versions.find(x => x.id === a.current); return { a, v, l: (v.layout.layers || []).find(l => l.id === id || l.role === id) }; };

await T.t('C1. seven stages in the header; Deliver opens the package view', async () => {
  await openDesign();
  eq(await page.$$eval(R + '.st-head .st-step .st-step-l', x => x.map(e => e.textContent)), ['Brief', 'Plan', 'Direction', 'Copy', 'Create', 'Review', 'Deliver'], 'the seven stages, in order');
  eq(await page.$eval(R + '.st-step.on .st-step-n', e => e.textContent.trim()), '05', 'Design is stage 05');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Deliver"))'); await page.waitForSelector(R + '.st-step.on:has(.st-step-l:text-is("Deliver"))');
  ok(/Deliver exactly what was approved/.test(await page.textContent(R + '.st-stage-title')), 'Deliver has its own head');
  ok(!(await page.$(R + '.st-subtab:has-text("Delivery")')), 'no Delivery tab inside Review any more');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Plan"))'); await sleep(500);
  const subs = await page.$$eval(R + '.st-phasesteps .st-substep', x => x.map(e => e.textContent));
  ok(subs.some(t => /Objectives/.test(t)) && subs.some(t => /Strategy/.test(t)), 'Message holds Objectives and Strategy: ' + subs.join(' | '));
});

await T.t('C2. the rail: Add first in the accent, its "Add item" flyout folds by section; the Design views sit at the rail\'s foot', async () => {
  await openDesign();
  const first = await page.$eval(R + '.st-dock .st-dock-btn', b => ({ add: b.classList.contains('add'), text: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor }));
  ok(first.add && /Add/.test(first.text), 'Add is the first tool: ' + JSON.stringify(first));
  const accent = await page.$eval(R + '.st', e => getComputedStyle(e).getPropertyValue('--sk-accent').trim());
  ok(first.bg !== 'rgba(0, 0, 0, 0)', 'and it is filled (the accent ' + accent + '): ' + first.bg);
  await page.click(R + '.st-dock-btn.add'); await page.waitForSelector(R + '.st-library[data-tool="elements"]');
  eq((await page.textContent(R + '.st-library-head b')).trim(), 'Add item', 'the flyout is titled Add item');
  const secs = await page.$$eval(R + '.st-el-sec', x => x.map(e => e.getAttribute('aria-label')));
  ok(['Layouts', 'Typography', 'Basic elements', 'Brand assets', 'Media'].every(n => secs.indexOf(n) >= 0), 'its sections: ' + secs.join(', '));
  const typo = R + '.st-el-sec[aria-label="Typography"]';
  ok(await page.$(typo + ' .st-el-item'), 'Typography shows its tiles');
  await page.click(typo + ' .st-el-h'); await sleep(150);
  ok(!(await page.$(typo + ' .st-el-item')) && (await page.getAttribute(typo + ' .st-el-h', 'aria-expanded')) === 'false', 'and folds');
  await page.click(typo + ' .st-el-h'); await sleep(150); ok(await page.$(typo + ' .st-el-item'), 'and opens again');
  const views = await page.$$eval(R + '.st-dock .st-dock-views .st-subtab', x => x.map(e => e.textContent.replace(/\d+/g, '').trim()));
  eq(views, ['Canvas', 'Board', 'Recipes', 'Jobs'], 'the Design views at the foot of the rail');
});

await T.t('C3. the top bar: the family\'s formats, the output width and one zoom control that names the measured zoom', async () => {
  await openDesign();
  const f = await page.$$eval(R + '.st-canvasbar .st-fmt', x => x.map(e => ({ t: e.textContent.trim(), on: e.getAttribute('aria-pressed') })));
  ok(f.length >= 2 && f.filter(x => x.on === 'true').length === 1, 'one button per format, the one on the canvas pressed: ' + JSON.stringify(f));
  ok(/1080\s*px/.test(await page.textContent(R + '.st-canvasbar .st-canvas-meta')), 'the output width in pixels');
  const fit = await page.$eval(R + '.st-canvasbar select[aria-label="Zoom"]', s => s.options[s.selectedIndex].textContent);
  const shown = await page.$eval(R + '.st-stage .st-stage-inner', e => Math.round(e.getBoundingClientRect().width / 1080 * 100));
  const said = +(/(\d+)\s*%/.exec(fit) || [])[1];
  ok(/^Fit/.test(fit) && Math.abs(said - shown) <= 1, 'Fit names the zoom measured on screen: "' + fit + '" vs ' + shown + '%');
  const other = (await page.$$(R + '.st-canvasbar .st-fmt[aria-pressed="false"]'))[0]; await other.click();
  await page.waitForFunction(() => { const b = document.querySelectorAll('#studio-root .st-canvasbar .st-fmt'); return b.length && b[0].getAttribute('aria-pressed') !== 'true' || /4:5/.test((document.querySelector('#studio-root .st-pagechip.on') || {}).textContent || ''); }, null, { timeout: 10000 });
  ok(/4:5|Instagram/.test(await page.textContent(R + '.st-pagechip.on')), 'another format opens that piece on the same canvas');
});

await T.t('C4. the Style panel: the layer as a chip; Spacing in output pixels moves it once; Size in pixels resizes it', async () => {
  await openDesign();
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(400);
  ok(/Style/.test(await page.textContent(R + '.st-sty-title')), 'the panel is headed Style');
  eq(await page.$eval(R + '.st-sty-chip select', s => s.options[s.selectedIndex].textContent), 'Headline', 'the selected layer is the chip');
  const before = (await layerOf('headline')).l;
  const top0 = +(await page.inputValue(R + 'input[aria-label="Distance to the top edge, px"]'));
  eq(top0, Math.round(before.y / 100 * 1080), 'Spacing shows the distance to the top in output pixels');
  await page.fill(R + 'input[aria-label="Distance to the top edge, px"]', String(top0 + 54)); await page.press(R + 'input[aria-label="Distance to the top edge, px"]', 'Enter'); await sleep(300);
  const y1 = await page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', e => parseFloat(e.style.top));
  ok(Math.abs(y1 - (before.y + 5)) < 0.3, 'typing 54 px more moves the headline 5% of the height: ' + before.y + ' -> ' + y1);
  const steps = await page.$eval(R + 'button[aria-label^="Undo"], ' + R + 'button[title^="Undo"]', b => b.getAttribute('title') || b.getAttribute('aria-label'));
  ok(/Move headline to \d+ px from the top/i.test(steps), 'one named undo step: ' + steps);
  await page.fill(R + 'input[aria-label="Width, px at the output size"]', '540'); await page.press(R + 'input[aria-label="Width, px at the output size"]', 'Enter'); await sleep(300);
  eq(await page.inputValue(R + 'input[aria-label="Width, per cent of the stage"]'), '50', 'Size in pixels sets the width (540 of 1080 = 50%)');
});

await T.t('C5. the colour field: contrast against the measured ground; the picker applies a saved client colour', async () => {
  await openDesign();
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(1200);
  await page.waitForFunction(() => /Contrast with the ground/.test((document.querySelector('#studio-root .st-sty-contrast') || {}).textContent || ''), null, { timeout: 10000 });
  const c = await page.textContent(R + '.st-sty-contrast'); ok(/(AAA|AA|AA large|Fails)\s*\d+\.\d\d/.test(c), 'a WCAG grade and ratio: ' + c.replace(/\s+/g, ' '));
  await page.click(R + '.st-sty-colour'); await page.waitForSelector(R + '.st-pk[role="dialog"]');
  ok(/Contrast ratio/.test(await page.textContent(R + '.st-pk')), 'the picker states the contrast too');
  const sw = await page.$$eval(R + '.st-pk-sw button', x => x.map(e => e.getAttribute('aria-label')));
  ok(sw.length >= 1, 'saved client colours: ' + sw.join(', '));
  const pick = sw[0].split(' ').pop();
  await page.click(R + '.st-pk-sw button >> nth=0'); await sleep(400);
  eq((await page.textContent(R + '.st-sty-colour span')).trim(), pick.toUpperCase(), 'the headline takes the saved colour');
  await page.keyboard.press('Escape'); await sleep(200); ok(!(await page.$(R + '.st-pk')), 'Escape closes the picker');
});

await T.t('C6. the version strip: versions drawn small, the current one marked; a click compares and changes nothing', async () => {
  await openDesign();
  const cards = await page.$$eval(R + '.st-vstrip .st-vcard', x => x.map(e => ({ t: e.textContent.trim(), on: e.classList.contains('on') })));
  ok(cards.length >= 2 && cards.filter(x => x.on).length === 1, 'versions with the current one marked: ' + JSON.stringify(cards));
  const { a } = await layerOf('headline'); const cur0 = a.current;
  await page.click(R + '.st-vstrip .st-vcard:not(.on) >> nth=0'); await page.waitForSelector(R + '.st-vcmp', { timeout: 10000 });
  eq((await layerOf('headline')).a.current, cur0, 'comparing changes nothing: the current version is the same');
});

await T.t('C7. every wait shows a percentage: a slow render carries "~N%" named as an estimate on the line over the canvas', async () => {
  fx.setProvider('gemini', 'slow'); fx.providers.slowMs = 9000;
  const { a } = await layerOf('headline');
  await api('POST', '/studio/job', { project: seeded.design, asset: a.id, stage: 'render', input: { prompt: 'a road at dusk', size: '1K' }, idem: 'sc-r1' });
  await openDesign();
  await page.waitForFunction(() => /~\d+% \((rough estimate|estimate from the last)/.test((document.querySelector('#studio-root .st-work-line, #studio-root .st-work-now') || {}).textContent || ''), null, { timeout: 20000 });
  const t = await page.textContent(R + '.st-work-line, ' + R + '.st-work-now'); ok(/~\d+%/.test(t) && /estimate/.test(t), 'the line names the estimate: ' + t.replace(/\s+/g, ' ').slice(0, 200));
  const n = +(/~(\d+)%/.exec(t) || [])[1]; ok(n >= 1 && n <= 95, 'held under 95% while it runs: ' + n);
  ok(await page.$(R + '.st-work-line .st-minibar.estimated, ' + R + '.st-work-est .st-minibar.estimated'), 'drawn as an estimate (striped), not a counted share');
  fx.setProvider('gemini', 'ok');
});

await T.t('G. no page threw an uncaught error', async () => {
  if (page) pageErrors.push(...(page.errors || []));
  eq(pageErrors.filter(e => !/fonts\.googleapis|ERR_|Failed to fetch/.test(e)), [], 'no uncaught page errors');
});
if (page) await page.ctxB.close();
const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
