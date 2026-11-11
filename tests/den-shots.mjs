/* Screenshots of every tab of Anne's Den at 1366 x 768 and 1920 x 1080, into the ignored tests/shots/den/. An evidence
 * tool, not a harness: it asserts nothing. Everything shown is invented and the model is a stub.
 * Run: node --experimental-sqlite tests/den-shots.mjs */
import fs from 'node:fs';
import { world, open, tab, browser, SHOTS } from './den-fixture.mjs';
fs.mkdirSync(SHOTS, { recursive: true });
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); await w.F('POST', '/den/discover', { ns: 'aep' });
for (const [wd, ht] of [[1366, 768], [1920, 1080]]) {
  const page = await open(w, 'full-key', { width: wd, height: ht });
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) {
    await tab(page, name); await page.waitForTimeout(700);
    await page.evaluate(() => { const t = document.querySelector('.toast, #toast'); if (t) t.textContent = ''; });
    await page.screenshot({ path: SHOTS + name + '-' + wd + '.png', scale: 'css' });
    if (name === 'brief' || name === 'today') { await page.evaluate(() => { const e = document.querySelector('#den-tabpanel'); if (e) e.scrollIntoView({ block: 'start' }); }); await page.waitForTimeout(200); await page.screenshot({ path: SHOTS + name + '-' + wd + '-body.png', scale: 'css' }); await page.evaluate(() => window.scrollTo(0, 0)); }
  }
  await page.context().close();
}
await browser.close(); console.log('saved to ' + SHOTS); process.exit(0);
