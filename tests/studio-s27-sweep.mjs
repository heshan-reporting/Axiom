/* S27 audit sweep (not a harness: an evidence tool). Every main Studio view at 390, 834, 1024, 1366, 1440 and 1920 px, with a
 * full key and a read-only key, providers MOCKED: whether the page scrolls sideways (and which elements stick out), what axe
 * reports as serious or critical, and any page error. Writes tests/shots/s27/<label>-sweep.json (ignored by git).
 *   node --experimental-sqlite tests/studio-s27-sweep.mjs before|after */
import fs from 'node:fs';
import { makeStudio } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const label = process.argv[2] || 'after';
const OUT = new URL('./shots/s27/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: Number(process.env.SWEEP_PORT) || 8862, inspect: false });
const seeded = await seedStages(fx, { only: ['directions', 'copy', 'design'], prefix: 'S27 sweep' });
const WIDTHS = [[390, 844], [834, 1194], [1024, 768], [1366, 768], [1440, 900], [1920, 1080]];
const report = { label, at: new Date().toISOString(), rows: [] };
async function open(role, vp) {
  const page = await fx.open({ viewport: { width: vp[0], height: vp[1] }, quiet: true, role });
  page.on('dialog', d => d.dismiss()); page.errs = []; page.on('pageerror', e => page.errs.push(String(e.message).slice(0, 160)));
  await page.addScriptTag({ content: AXE }); return page;
}
async function openProject(page, title) {
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(700);
}
async function phase(page, name) { const s = page.locator(R + '.st-step:has(.st-step-l:text-matches("^' + name + '"))').first(); if (await s.count()) { await s.click(); await sleep(900); return true; } return false; }
async function check(page, view) {
  await sleep(500);
  const m = await page.evaluate(() => {
    const W = innerWidth; const doc = document.scrollingElement.scrollWidth;
    const out = []; if (doc > W + 1) document.querySelectorAll('#studio-root *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('.st-stage')) out.push((el.className && el.className.toString ? el.className.toString() : el.tagName).slice(0, 50) + ' ' + Math.round(r.right)); });
    return { doc, W, offenders: out.slice(0, 6) };
  });
  const ax = await page.evaluate(async () => { const res = await window.axe.run(document.querySelector('#studio-root') || document, { resultTypes: ['violations'] }); return res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, where: v.nodes.slice(0, 3).map(n => n.target.join(' ')) })); }).catch(e => [{ id: 'axe-failed', impact: String(e.message).slice(0, 80) }]);
  return Object.assign({ view, overflow: m.doc > m.W + 1, docW: m.doc, offenders: m.offenders, axe: ax }, {});
}
for (const role of ['full', 'read']) {
  for (const vp of WIDTHS) {
    const page = await open(role === 'read' ? 'read' : undefined, vp); const rows = [];
    try {
      rows.push(await check(page, 'library'));
      await openProject(page, 'S27 sweep at design');
      for (const ph of ['Brief', 'Message', 'Direction', 'Copy', 'Design', 'Review', 'Deliver']) { if (await phase(page, ph)) { if (ph === 'Design') { const a = page.locator(R + '.st-pagechip, ' + R + '.st-assetpick').first(); if (await a.count()) { await a.click(); await sleep(1200); } } rows.push(await check(page, ph)); } }
      const brand = page.locator(R + 'button:has-text("Brand")').first(); if (await brand.count() && await brand.isVisible()) { await brand.click().catch(() => {}); await sleep(900); rows.push(await check(page, 'Brand')); }
    } catch (e) { rows.push({ view: 'error', error: String(e.message).slice(0, 200) }); }
    rows.forEach(r => report.rows.push(Object.assign({ role, width: vp[0], errors: page.errs.slice() }, r)));
    console.log(role, vp[0], rows.map(r => r.view + (r.overflow ? ' OVERFLOW(' + r.docW + ')' : '') + (r.axe && r.axe.length ? ' AXE:' + r.axe.map(a => a.id + 'x' + a.n).join(',') : '') + (r.error ? ' ERR ' + r.error : '')).join(' | '), page.errs.length ? 'PAGEERR ' + page.errs.join(' / ') : '');
    await page.ctxB.close();
  }
}
fs.writeFileSync(OUT + label + '-sweep.json', JSON.stringify(report, null, 1));
await fx.close();
