/* S19 matched screenshots (MOCKED providers; nothing is spent): the same seeded projects before and after, at four sizes, for
 * every step plus the states the S19 brief names - a layer selected on the canvas, the photograph being reframed, a validation
 * failure, generation in progress, and the Creative Director in Design and outside it (Copy). The same script runs against the
 * S18 baseline checkout for the "before" set.
 *   node --experimental-sqlite tests/studio-s19-shots.mjs <label> [sizes]  -> tests/shots/s19/<label>-<state>-<size>.png
 * sizes: comma list of 1440,1920,1024,390 (default all); per-shot measurements go to tests/shots/s19/<label>-report.json */
import fs from 'node:fs';
import { makeStudio } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const label = process.argv[2] || 'after';
const SZ = { 1440: { width: 1440, height: 900 }, 1920: { width: 1920, height: 1080 }, 1024: { width: 1024, height: 768 }, 390: { width: 390, height: 844 } };
const sizes = (process.argv[3] || '1440,1920,1024,390').split(',').filter(s => SZ[s]);
const OUT = new URL('./shots/s19/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const fx = await makeStudio({ port: 8873 });
await seedStages(fx, { prefix: 'S19 shot' });
const R = '#studio-root ';
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = { label, at: new Date().toISOString(), shots: [] };
async function settle(page) {
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await page.waitForFunction(() => Array.from(document.images).every(i => i.complete), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity), null, { timeout: 5000 }).catch(() => {});
  await wait(300);
}
async function measure(page) {
  return page.evaluate(() => {
    const vh = innerHeight, vw = innerWidth; const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); if (!r.width && !r.height) return null; return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const art = box(document.querySelector('#studio-root .st-stage canvas, #studio-root .st-artboard canvas'));
    const comp = box(document.querySelector('#studio-root .st-composer textarea'));
    const inView = b => !!b && b.y >= 0 && b.y + b.h <= vh + 1 && b.x >= 0 && b.x + b.w <= vw + 1;
    const prim = box(document.querySelector('#studio-root .st-stage-head .btn:not(.ghost), #studio-root .st-stagehead .btn:not(.ghost)'));
    return { vw, vh, docHeight: document.scrollingElement.scrollHeight, artboard: art, artboardInView: inView(art), artArea: art ? Math.round(art.w * art.h / (vw * vh) * 1000) / 10 : 0, composer: comp, composerInView: inView(comp), primary: prim, primaryInView: inView(prim), sideScroll: document.scrollingElement.scrollWidth > vw + 1 };
  });
}
async function shot(page, name, sz) {
  await settle(page); await page.evaluate(() => window.scrollTo(0, 0)); await wait(150);
  const m = await measure(page);
  await page.screenshot({ path: OUT + label + '-' + name + '-' + sz + '.png' });
  report.shots.push(Object.assign({ name, size: sz }, m));
  console.log(name.padEnd(14), sz, 'doc', m.docHeight, 'art', m.artboard ? m.artboard.h + 'px ' + m.artArea + '%' + (m.artboardInView ? '' : ' OUT') : '-', 'composer', m.composer ? (m.composerInView ? 'in view' : 'OUT') : '-', 'primary', m.primary ? (m.primaryInView ? 'in view' : 'OUT') : '-');
}
const openProject = async (page, title) => {
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} });
  await page.evaluate(() => go('studio')); await wait(300);
  const allp = page.locator(R + 'button:has-text("All projects"), ' + R + 'a:has-text("All projects")'); if (await allp.count()) { await allp.first().click().catch(() => {}); await wait(300); }
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 });
  await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click(); await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await wait(800);
};
const stepBtn = l => R + '.st-step:has(.st-step-l:text-matches("^' + l + '", "i"))';
const openDesign = async page => {
  await openProject(page, 'S19 shot at design'); await page.click(stepBtn('Design')).catch(() => {}); await wait(600);
  const asset = page.locator(R + '.st-assetpick, ' + R + '.st-pagechip').first(); if (await asset.count()) await asset.click().catch(() => {});
  await page.waitForSelector(R + '.st-stage canvas, ' + R + '.st-artboard canvas', { timeout: 15000 }).catch(() => {}); await wait(1200);
};
const cdOpen = async page => { const cd = page.locator(R + '#st-tabbtn-director, ' + R + '.st-insp-mode:has-text("Creative Director")'); if (!(await cd.count()) && await page.locator(R + '#st-inspector .st-cd').count() && await page.locator(R + '#st-inspector .st-cd').first().isVisible()) return true; if (await cd.count()) { const t = page.locator(R + '.st-insp-toggle'); if (await t.count() && await t.first().isVisible()) await t.first().click().catch(() => {}); await cd.first().click().catch(() => {}); await wait(600); return true; } return false; };
for (const sz of sizes) {
  const page = await fx.open({ viewport: SZ[sz], quiet: true }); page.on('dialog', d => d.accept().catch(() => {}));
  await page.waitForSelector(R + '.st-lib, ' + R + '.st-libgrid', { timeout: 15000 }).catch(() => {});
  await shot(page, 'library', sz);
  for (const [k, l] of [['brief', 'Brief'], ['objectives', 'Objectives'], ['strategy', 'Strategy'], ['directions', 'Directions'], ['copy', 'Copy']]) {
    await openProject(page, 'S19 shot at ' + (k === 'brief' ? 'the brief' : k)); await page.click(stepBtn(l)).catch(() => {}); await wait(700);
    await shot(page, k, sz);
    if (k === 'copy' && await cdOpen(page)) await shot(page, 'copy-director', sz);
  }
  await openDesign(page); await shot(page, 'design', sz);
  // a layer selected on the canvas
  const hl = page.locator(R + '.st-le-layer[aria-label="Layer headline"]'); if (await hl.count()) { await hl.first().click().catch(() => {}); await wait(500); await shot(page, 'select', sz); }
  // reframing the photograph
  await page.keyboard.press('Escape').catch(() => {});
  const fr = page.locator(R + 'button:has-text("Frame by dragging"), ' + R + 'button:has-text("Crop and position")'); if (await fr.count()) { await fr.first().scrollIntoViewIfNeeded().catch(() => {}); await fr.first().click().catch(() => {}); await wait(600); await shot(page, 'crop', sz); await page.keyboard.press('Escape').catch(() => {}); const done = page.locator(R + 'button:has-text("Done framing"), ' + R + 'button:has-text("Cancel crop"), ' + R + 'button:has-text("Frame by dragging")'); if (await done.count()) await done.first().click().catch(() => {}); await wait(300); }
  // a validation failure: the headline pushed off the stage (an unsaved edit, never saved)
  if (await hl.count()) { await hl.first().click().catch(() => {}); for (let i = 0; i < 14; i++) await page.keyboard.press('Shift+ArrowRight'); await wait(1500); await shot(page, 'invalid', sz); const dz = page.locator(R + '.st-le-foot .btn:has-text("Discard changes"), ' + R + 'button:has-text("Discard changes")'); if (await dz.count()) { await dz.first().click().catch(() => {}); await wait(500); } }
  // the Creative Director in Design
  if (await cdOpen(page)) await shot(page, 'director', sz);
  // generation in progress: a review is asked for and held at the worker while the screenshot is taken
  const release = fx.hold(/^\/studio\/job\/step$/);
  const rv = page.locator(R + 'button:has-text("Review v")'); if (await rv.count()) { await rv.first().click().catch(() => {}); await wait(2200); await shot(page, 'progress', sz); }
  release(); await wait(1500);
  { const c = page.locator(R + '.st-insp-close'); if (await c.count() && await c.first().isVisible()) await c.first().click().catch(() => {}); await page.keyboard.press('Escape').catch(() => {}); await wait(300); }   // the drawer covers the navigator on narrow windows
  await page.click(stepBtn('Review')).catch(() => {}); await wait(900); await shot(page, 'review', sz);
  const ex = page.locator(R + '.st-subtab:has-text("Delivery")'); if (await ex.count()) { await ex.first().click().catch(() => {}); await wait(700); await shot(page, 'delivery', sz); }
  if (page.errors && page.errors.length) report.shots.push({ size: sz, pageErrors: page.errors.slice(0, 10) });
  await page.ctxB.close();
}
fs.writeFileSync(OUT + label + '-report.json', JSON.stringify(report, null, 1));
await fx.close(); process.exit(0);
