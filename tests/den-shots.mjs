/* Screenshots of every tab of Anne's Den at 1366 x 768 and 1920 x 1080, into the ignored tests/shots/den/. An evidence
 * tool, not a harness: it asserts nothing. Everything shown is invented and the model is a stub. The file names are the
 * ones the captures of the earlier layout carry (tests/shots/den-before/), so the two sets compare one to one; in the
 * Storyboard "today-<w>-body" is the Board scrolled to its section columns and "brief-<w>-body" a later section open.
 * Run: node --experimental-sqlite tests/den-shots.mjs */
import fs from 'node:fs';
import { world, open, tab, browser, SHOTS, cards, sec } from './den-fixture.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); await w.F('POST', '/den/discover', { ns: 'aep' });
for (const [wd, ht] of [[1366, 768], [1920, 1080]]) {
  const page = await open(w, 'full-key', { width: wd, height: ht });
  if (wd === 1366) { await cards(page, 'media').first().focus(); await page.keyboard.press('3'); await page.waitForSelector('.den-col[data-sec="media"] .den-row'); await cards(page, 'actors').first().focus(); await page.keyboard.press('5'); await page.waitForSelector('.den-col[data-sec="actors"] .den-row'); }   // two cards filed, kept for the wider pass too
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) {
    await tab(page, name); await page.waitForTimeout(700);
    await page.evaluate(() => { const t = document.querySelector('.toast, #toast'); if (t) t.textContent = ''; });
    await page.screenshot({ path: SHOTS + name + '-' + wd + '.png', scale: 'css' });
    if (name === 'today') { await page.evaluate(() => { const e = document.querySelector('.den-board'); if (e) e.scrollLeft = 620; }); await page.waitForTimeout(200); await page.screenshot({ path: SHOTS + name + '-' + wd + '-body.png', scale: 'css' }); await page.evaluate(() => { const e = document.querySelector('.den-board'); if (e) e.scrollLeft = 0; }); }
    if (name === 'brief') { await sec(page, 'media'); await page.waitForTimeout(200); await page.screenshot({ path: SHOTS + name + '-' + wd + '-body.png', scale: 'css' }); await sec(page, 'summary'); }
  }
  await page.context().close();
}
await browser.close(); console.log('saved to ' + SHOTS); process.exit(0);
