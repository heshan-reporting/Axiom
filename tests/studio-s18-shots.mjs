/* Matched screenshots of every Studio step (MOCKED providers; nothing is spent), the same seeded states before and after a
 * change, at four sizes, with a measurement per shot: how tall the document is against the window, where the artboard and
 * the Creative Director's composer sit, and whether they are inside the window.
 *   node --experimental-sqlite tests/studio-s18-shots.mjs <label> [sizes]   -> tests/shots/s18/<label>-<step>-<size>.png
 *   sizes: comma list of 1440,1920,1024,390 (default all); the report goes to tests/shots/s18/<label>-report.json */
import fs from 'node:fs';
import { makeStudio } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const label = process.argv[2] || 'after';
const SZ = { 1440: { width: 1440, height: 900 }, 1920: { width: 1920, height: 1080 }, 1024: { width: 1024, height: 768 }, 390: { width: 390, height: 844 } };
const sizes = (process.argv[3] || '1440,1920,1024,390').split(',').filter(s => SZ[s]);
const OUT = new URL('./shots/s18/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const fx = await makeStudio({ port: 8861 });
const P = await seedStages(fx);
const R = '#studio-root ';
const wait = ms => new Promise(r => setTimeout(r, ms));
const report = { label, at: new Date().toISOString(), shots: [] };
// a shot is taken once the fonts are in, the images have decoded and nothing is animating
async function settle(page) {
  await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} });
  await page.waitForFunction(() => Array.from(document.images).every(i => i.complete), null, { timeout: 8000 }).catch(() => {});
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations !== Infinity), null, { timeout: 5000 }).catch(() => {});
  await wait(300);
}
async function measure(page) {
  return page.evaluate(() => {
    const vh = window.innerHeight, vw = window.innerWidth; const box = el => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y + window.scrollY), w: Math.round(r.width), h: Math.round(r.height) }; };
    const root = document.querySelector('#studio-root');
    const art = document.querySelector('#studio-root .st-stage canvas, #studio-root .st-le canvas, #studio-root .st-artboard canvas');
    const comp = document.querySelector('#studio-root .st-composer textarea, #studio-root .st-cd-composer textarea');
    const studioTop = root ? Math.round(root.getBoundingClientRect().top + window.scrollY) : null;
    const inView = b => !!b && b.y >= 0 && b.y + b.h <= vh + 1 && b.x >= 0 && b.x + b.w <= vw + 1;
    const a = box(art), c = box(comp);
    return { vw, vh, docHeight: document.scrollingElement.scrollHeight, studioTop, artboard: a, artboardInView: inView(a), composer: c, composerInView: inView(c), horizontalScroll: document.scrollingElement.scrollWidth > vw + 1 };
  });
}
async function shot(page, name, sz) {
  await settle(page);
  await page.evaluate(() => window.scrollTo(0, 0)); await wait(150);
  const m = await measure(page);
  await page.screenshot({ path: OUT + label + '-' + name + '-' + sz + '.png' });
  report.shots.push(Object.assign({ name, size: sz }, m));
  console.log(name.padEnd(12), sz, 'doc', m.docHeight, 'art', m.artboard ? m.artboard.y + '+' + m.artboard.h + (m.artboardInView ? ' in view' : ' OUT') : '-', 'composer', m.composer ? m.composer.y + (m.composerInView ? ' in view' : ' OUT') : '-');
}
const openProject = async (page, title) => {
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} });
  await page.evaluate(() => go('studio')); await wait(300);
  const allp = page.locator(R + 'button:has-text("All projects"), ' + R + 'a:has-text("All projects")'); if (await allp.count()) { await allp.first().click().catch(() => {}); await wait(300); }
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 });
  const btn = page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")');
  await btn.first().click(); await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await wait(800);
};
const stepBtn = l => R + '.st-step:has(.st-step-l:text-matches("^' + l + '", "i"))';
for (const sz of sizes) {
  const page = await fx.open({ viewport: SZ[sz], quiet: true }); page.on('dialog', d => d.dismiss());
  await page.waitForSelector(R + '.st-lib, ' + R + '.st-libgrid', { timeout: 15000 }).catch(() => {});
  await shot(page, 'library', sz);
  const plan = [['brief', 'Brief'], ['objectives', 'Objectives'], ['strategy', 'Strategy'], ['directions', 'Directions'], ['copy', 'Copy']];
  for (const [k, l] of plan) {
    await openProject(page, 'S18 at ' + (k === 'brief' ? 'the brief' : k));
    await page.click(stepBtn(l)).catch(() => {}); await wait(700);
    await shot(page, k, sz);
  }
  await openProject(page, 'S18 at design');
  await page.click(stepBtn('Design')).catch(() => {}); await wait(600);
  const asset = page.locator(R + '.st-railbtn.asset, ' + R + '.st-pagechip, ' + R + '.st-board-tile button').first();
  if (await asset.count()) { await asset.click().catch(() => {}); }
  await page.waitForSelector(R + '.st-stage canvas, ' + R + '.st-artboard canvas', { timeout: 15000 }).catch(() => {}); await wait(1200);
  await shot(page, 'design', sz);
  const cd = page.locator(R + '.st-instab:has-text("Art Director"), ' + R + '.st-instab:has-text("Creative Director"), ' + R + '.st-insp-mode:has-text("Creative Director")');
  if (await cd.count()) { await cd.first().click().catch(() => {}); await wait(600); await shot(page, 'director', sz); }
  await page.click(stepBtn('Review')).catch(() => {}); await wait(900);
  await shot(page, 'review', sz);
  const ex = page.locator(R + '.st-subtab:has-text("Export"), ' + R + '.st-delivery');
  if (await ex.count()) { await ex.first().scrollIntoViewIfNeeded().catch(() => {}); if (/st-subtab/.test(await ex.first().getAttribute('class') || '')) await ex.first().click().catch(() => {}); await wait(700); await shot(page, 'delivery', sz); }
  if (page.errors && page.errors.length) report.shots.push({ size: sz, pageErrors: page.errors.slice(0, 10) });
  await page.ctxB.close();
}
fs.writeFileSync(OUT + label + '-report.json', JSON.stringify(report, null, 1));
await fx.close(); process.exit(0);
