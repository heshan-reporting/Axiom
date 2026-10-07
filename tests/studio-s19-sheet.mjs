/* S19: before | after contact sheets from tests/shots/s19/ (written by studio-s19-shots.mjs before / after), one per window
 * size, every state side by side with the figures each capture measured (artboard height and share of the window, whether the
 * composer and the main action are in the window). A state with no "before" capture says so: it did not exist then.
 *   node tests/studio-s19-sheet.mjs   -> tests/shots/s19/compare-<size>.png and compare.html (ignored by git) */
import fs from 'node:fs';
import { chromium } from './pw.mjs';
const DIR = new URL('./shots/s19/', import.meta.url).pathname;
const rep = l => { try { return JSON.parse(fs.readFileSync(DIR + l + '-report.json', 'utf8')).shots; } catch (e) { return []; } };
const B = rep('before'), A = rep('after');
const STATES = ['library', 'brief', 'objectives', 'strategy', 'directions', 'copy', 'copy-director', 'design', 'select', 'crop', 'invalid', 'director', 'progress', 'review', 'delivery'];
const SIZES = ['1440', '1920', '1024', '390'];
const fig = (r) => !r ? '' : [r.artboard ? 'artboard ' + r.artboard.h + 'px, ' + r.artArea + '% of the window' + (r.artboardInView ? '' : ' (not all in view)') : '', r.composer ? 'composer ' + (r.composerInView ? 'in view' : 'out of view') : '', r.primary ? 'main action ' + (r.primaryInView ? 'in view' : 'out of view') : '', 'page ' + r.docHeight + 'px'].filter(Boolean).join(' - ');
const img = f => fs.existsSync(DIR + f) ? 'data:image/png;base64,' + fs.readFileSync(DIR + f).toString('base64') : '';
let all = '';
const browser = await chromium.launch();
for (const sz of SIZES) {
  const rows = STATES.map(st => {
    const b = img('before-' + st + '-' + sz + '.png'), a = img('after-' + st + '-' + sz + '.png'); if (!a && !b) return '';
    const rb = B.find(x => x.name === st && x.size === sz), ra = A.find(x => x.name === st && x.size === sz);
    return `<tr><th>${st}</th><td>${b ? `<img src="${b}"><div>${fig(rb)}</div>` : '<div class="none">no capture: this state did not exist in S18</div>'}</td><td>${a ? `<img src="${a}"><div>${fig(ra)}</div>` : '<div class="none">not captured</div>'}</td></tr>`;
  }).join('');
  const html = `<!doctype html><meta charset="utf-8"><style>body{font:13px system-ui;background:#fff;color:#111;margin:16px}table{border-collapse:collapse}th{text-align:left;vertical-align:top;padding:8px;width:90px}td{vertical-align:top;padding:8px;width:${sz === '390' ? 260 : 620}px}img{width:100%;border:1px solid #ccc}td div{font-size:11px;color:#444;margin-top:4px}.none{padding:30px;border:1px dashed #bbb;color:#777}h1{font-size:16px}</style><h1>Creative Studio - S18 (before, 225aa54) | S19 (after) - ${sz} px wide</h1><table><tr><th></th><th>before</th><th>after</th></tr>${rows}</table>`;
  all += html;
  const page = await browser.newPage({ viewport: { width: sz === '390' ? 700 : 1400, height: 900 } });
  await page.setContent(html); await page.screenshot({ path: DIR + 'compare-' + sz + '.png', fullPage: true }); await page.close();
  console.log('compare-' + sz + '.png');
}
fs.writeFileSync(DIR + 'compare.html', all);
await browser.close();
