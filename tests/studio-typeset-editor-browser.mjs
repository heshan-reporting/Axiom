/* Typesetting on the canvas (the 24 November report), in real Chromium against the worker module in this process, every
 * provider MOCKED.
 *   TE1 the frame of a selected text layer and its handles sit outside its words: no handle covers a letter
 *   TE2 widening the tracking of the words grows their box to fit them, so the edit does not end in "text overflow"
 *   TE3 while a layer is selected the photograph's "subject?" tags are not drawn over it
 * Run: node --experimental-sqlite tests/studio-typeset-editor-browser.mjs   (TYPESET_PORT picks the port, default 8897) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.TYPESET_PORT || 8897), inspect: false });
const T = runner('Typesetting on the canvas: the frame off the words, boxes that grow to them');
await seedStages(fx, { prefix: 'TS', only: ['design'] });
const openDesign = async page => { await openProject(page, 'TS at design'); await sleep(800); await goStep(page, 'Design'); await sleep(2500); await page.waitForSelector(R + '.st-le-layer'); };
const HL = R + '.st-le-layer[aria-label="Layer headline"]';

await T.t('TE1: the frame of a selected text layer and its handles sit outside its words', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.click(HL); await sleep(300);
    const g = await page.evaluate(sel => { const l = document.querySelector(sel); const r = l.getBoundingClientRect(); const c = getComputedStyle(l);
      const hs = [...l.querySelectorAll('.st-le-hh, .st-le-h')].map(h => ({ k: h.dataset.h, r: h.getBoundingClientRect() }));
      return { box: { l: r.left, t: r.top, r: r.right, b: r.bottom }, outline: c.outlineStyle + ' ' + c.outlineOffset, hs: hs.map(h => ({ k: h.k, l: h.r.left, t: h.r.top, r: h.r.right, b: h.r.bottom })) }; }, HL);
    ok(/solid 5px/.test(g.outline), 'the frame is drawn 5 px outside the words (' + g.outline + ')');
    const inside = g.hs.filter(h => { const ix = Math.min(h.r, g.box.r) - Math.max(h.l, g.box.l), iy = Math.min(h.b, g.box.b) - Math.max(h.t, g.box.t); return ix > 1 && iy > 1; });
    eq(inside.map(h => h.k), [], 'no handle overlaps the box of the words (' + g.hs.length + ' handles)');
  } finally { await page.context().close(); }
});

await T.t('TE2: widening the tracking grows the box to the words, so the edit does not end in text overflow', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.click(HL); await sleep(300);
    const h0 = await page.$eval(HL, el => el.getBoundingClientRect().height);
    const field = page.locator(R + 'input[aria-label="Letter spacing, thousandths of an em"]').first();
    if (!(await field.isVisible().catch(() => false))) { const sec = page.locator(R + 'button:has-text("Typography")').first(); if (await sec.count()) await sec.click(); await sleep(200); }
    await field.fill('200'); await field.press('Tab'); await sleep(900);
    const h1 = await page.$eval(HL, el => el.getBoundingClientRect().height);
    const val = await page.$eval(R + '.st-le-val', el => el.textContent);
    ok(h1 > h0 + 4, 'the headline box grew with its words (' + Math.round(h0) + ' -> ' + Math.round(h1) + ' px on screen)');
    ok(!/text overflow \(headline/.test(val), 'and the measurement does not report the headline spilling out of its box: ' + val);
  } finally { await page.context().close(); }
});

await T.t('TE3: while a layer is selected the photograph\'s subject tags are not drawn over it', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.click(HL); await sleep(300);
    const cls = await page.$eval(R + '.st-le', el => el.className); ok(/\bhas-sel\b/.test(cls), 'the canvas knows something is selected (' + cls + ')');
    const shown = await page.evaluate(() => { const probe = document.createElement('div'); probe.className = 'st-le-subject'; probe.innerHTML = '<span>subject?</span>'; const le = document.querySelector('#studio-root .st-le'); le.appendChild(probe); const d = getComputedStyle(probe.firstChild).display; probe.remove(); return d; });
    eq(shown, 'none', 'a subject tag on the canvas is not displayed while a layer is selected');
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
