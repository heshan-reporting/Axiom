/* Screenshots of Anne's Den as it opens by default (decision D10: showGaps off, a fresh profile in Guided), at 1366 x 768 and
 * 1920 x 1080, into the ignored tests/shots/den/. An evidence tool, not a harness: it asserts nothing. Everything shown is
 * invented and the model is a stub.
 *   today-guided (the card), today-guided-dark, today-guided-done (triage finished, with a draft), today (the table),
 *   brief (with -file: the File region), watch, collection (the disclosure closed), collection-open (opened, the whole
 *   page in one tall picture), options (with -channels: the "Channels on screen" switch). A name ending -body is the same state scrolled to
 *   the work area.
 * These carry the plain names. The same screens with the desk's showGaps on are the main journey's, from
 * SHOT=1 node --experimental-sqlite tests/den-browser.mjs, as 01-today-gaps-on and 02-collection-gaps-on.
 * Run: node --experimental-sqlite tests/den-shots.mjs */
import fs from 'node:fs';
import { world, open, tab, browser, SHOTS } from './den-fixture.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
const rowsOf = async wd => { const b = (await wd.F('GET', '/den/board?desk=aep_au')).body; return b.media.concat(b.social, b.actors); };
const mark = (wd, route, r, more) => wd.F('POST', route, Object.assign({ desk: 'aep_au', item: r.id }, r.copies ? { copies: r.copies } : {}, more || {}));
// the morning: one row kept and one set aside, no brief yet, and proposals waiting in Watch
const w = await world(); await w.F('POST', '/den/discover', { ns: 'aep' });
{ const rows = await rowsOf(w); await mark(w, '/den/pin', rows.find(r => /Producers answer/.test(r.title || ''))); await mark(w, '/den/aside', rows.find(r => /Noisy outlet on the gas export tax 4/.test(r.title || '')), { reason: 'not relevant' }); }
// later the same day: every row decided, four of them kept, and a draft written from them
const wDone = await world();
{ const rows = await rowsOf(wDone); const keep = rows.filter(r => /Harbour levy|Producers answer|Our position|sign the petition/.test(r.title || r.text || '')); for (const r of rows) await mark(wDone, keep.indexOf(r) >= 0 ? '/den/pin' : '/den/aside', r, keep.indexOf(r) >= 0 ? null : { reason: 'not relevant' }); await wDone.F('POST', '/den/brief', { desk: 'aep_au' }); }

const saved = [];
// back to the top, whichever element scrolls (the app's shell, not always the window), and no toast left over from the last press
const quiet = page => page.evaluate(() => { const t = document.querySelector('.toast, #toast'); if (t) t.textContent = ''; for (let e = document.querySelector('#den-root'); e; e = e.parentElement) e.scrollTop = 0; window.scrollTo(0, 0); });
const idle = async page => { await page.waitForFunction(() => !Array.from(document.querySelectorAll('#v-den .den-load')).some(e => !e.closest('[hidden]'))); await page.waitForTimeout(500); };
const snap = async (page, name, o) => { await page.screenshot(Object.assign({ path: SHOTS + name + '.png', scale: 'css' }, o || {})); saved.push(name + '.png'); };
// the state as it opens, then scrolled so the work area starts at the top of the window
const pair = async (page, name) => { await quiet(page); await snap(page, name); await page.evaluate(() => { const e = document.querySelector('#den-tabpanel'); if (e) e.scrollIntoView({ block: 'start' }); }); await page.waitForTimeout(200); await snap(page, name + '-body'); await quiet(page); };
// the whole of a long state in one picture: the window is made as tall as the page for the shot (the app's shell scrolls, not the document, so fullPage would stop at the fold)
const tall = async (page, name, wd, ht) => { const h = await page.evaluate(() => { let m = 0; for (let e = document.querySelector('#den-root'); e; e = e.parentElement) m = Math.max(m, e.scrollHeight + e.getBoundingClientRect().top); return Math.ceil(m); }); await page.setViewportSize({ width: wd, height: Math.max(ht, Math.min(7000, h + 40)) }); await page.waitForTimeout(300); await quiet(page); await snap(page, name); await page.setViewportSize({ width: wd, height: ht }); await page.waitForTimeout(200); };
const to = async (page, sel) => { await page.evaluate(s => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'center' }); }, sel); await page.waitForTimeout(200); };
const theme = async (page, name) => { await page.getByRole('button', { name, exact: true }).click(); await page.waitForFunction(v => document.getElementById('den-root').dataset.theme === v, name.toLowerCase()); };

for (const [wd, ht] of [[1366, 768], [1920, 1080]]) {
  // a fresh profile: Today in Guided, the card
  let page = await open(w, 'full-key', { width: wd, height: ht, guided: true }); await idle(page);
  await pair(page, 'today-guided-' + wd);
  await theme(page, 'Dark'); await idle(page); await pair(page, 'today-guided-dark-' + wd); await theme(page, 'Light');
  // the same day as a table
  await page.getByRole('button', { name: 'Table', exact: true }).click(); await page.waitForSelector('#den-tabpanel .den-kpis'); await idle(page); await pair(page, 'today-' + wd);
  await tab(page, 'watch'); await idle(page); await quiet(page); await snap(page, 'watch-' + wd);
  // Collection: what delivers, with the one disclosure closed; then opened, the whole page
  await tab(page, 'collection'); await page.waitForSelector('details.den-more'); await idle(page); await pair(page, 'collection-' + wd);
  await page.locator('details.den-more > summary').click(); await page.waitForSelector('details.den-more[open] section.den-panel[aria-label="Signed-in collection"]'); await idle(page); await tall(page, 'collection-open-' + wd, wd, ht);
  await tab(page, 'options'); await idle(page); await quiet(page); await snap(page, 'options-' + wd); await to(page, 'section.den-panel[aria-label="Channels on screen"]'); await snap(page, 'options-' + wd + '-channels');
  await page.context().close();
  // triage finished and a draft written: the done state, and the brief with its File region
  page = await open(wDone, 'full-key', { width: wd, height: ht, guided: true }); await idle(page); await pair(page, 'today-guided-done-' + wd);
  await tab(page, 'brief'); await page.waitForSelector('.den-sec textarea'); await idle(page); await pair(page, 'brief-' + wd); await to(page, '#den-file'); await snap(page, 'brief-' + wd + '-file');
  await page.context().close();
}
await browser.close(); console.log('saved to ' + SHOTS + '\n' + saved.join('\n')); process.exit(0);
