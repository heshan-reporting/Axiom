/* Captures every concept at 1366 x 768 and 1920 x 1080 from file://, and reports page errors and horizontal overflow.
 *   node design/prototypes/annes-den-concepts/shots.mjs [a,b,c,d] [--quick]
 * Needs Playwright's Chromium (see tests/pw.mjs). Writes shots/<concept>-<route>-<width>.png and shots/report.json. */
import { chromium } from '../../../tests/pw.mjs';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2); const quick = args.includes('--quick');
const which = (args.find(a => !a.startsWith('--')) || 'a,b,c,d').split(',');
const ROUTES = quick ? ['today', 'brief'] : ['today', 'brief', 'watch', 'collection', 'options', 'system'];
const STATES = quick ? [] : ['loading&hold=1', 'empty', 'error', 'readonly', 'filed'];
const SIZES = [[1366, 768], [1920, 1080]];
fs.mkdirSync(path.join(here, 'shots'), { recursive: true });
const browser = await chromium.launch(); const report = [];
for (const c of which) {
  const file = path.join(here, 'concept-' + c + '.html'); if (!fs.existsSync(file)) { report.push({ concept: c, missing: true }); continue; }
  for (const [w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message.slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
    const shoot = async (name, url) => {
      await page.goto(url); await page.waitForTimeout(450);
      const m = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, text: document.body.innerText.length,
        unnamed: [...document.querySelectorAll('button,a[href],input,select,textarea')].filter(e => e.offsetParent && !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby') && !e.getAttribute('title') && !(e.id && document.querySelector('label[for="' + e.id + '"]')) && !e.closest('label')).length }));
      await page.screenshot({ path: path.join(here, 'shots', c + '-' + name + '-' + w + '.png') });
      report.push({ concept: c, view: name, width: w, overflow: m.overflow, text: m.text, unnamed: m.unnamed, errors: errors.splice(0) });
    };
    for (const r of ROUTES) await shoot(r, 'file://' + file + '#' + r);
    if (w === 1366) for (const s of STATES) await shoot('state-' + s.split('&')[0], 'file://' + file + '?state=' + s + '#today');
    await ctx.close();
  }
}
await browser.close();
fs.writeFileSync(path.join(here, 'shots', 'report.json'), JSON.stringify(report, null, 1));
const bad = report.filter(r => r.missing || r.overflow > 0 || r.text < 200 || r.unnamed || (r.errors || []).length);
console.log(report.length + ' captures, ' + bad.length + ' with a finding');
for (const r of bad) console.log(' ', r.concept, r.view || '', r.width || '', r.missing ? 'MISSING' : '', r.overflow > 0 ? 'overflow ' + r.overflow + 'px' : '', r.text < 200 ? 'nearly blank' : '', r.unnamed ? r.unnamed + ' unnamed controls' : '', (r.errors || []).join(' | '));
