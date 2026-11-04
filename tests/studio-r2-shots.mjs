/* R2 (the production redesign): matched screenshots of every stage, the library and the wizard at desktop (1440 x 900) and phone
 * (390 x 844) sizes, providers MOCKED and nothing spent. It finds its way through either navigator (Message or Plan, Design or
 * Create), so the "before" set can be taken from a worktree of the commit before the redesign.
 *   node --experimental-sqlite tests/studio-r2-shots.mjs <label> [1440,390]  -> tests/shots/r2/<label>-<state>-<size>.png
 * The folder is ignored by git: the captures are evidence for the owner, not repository content. */
import fs from 'node:fs';
import { makeStudio } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const label = process.argv[2] || 'after';
const SZ = { 1440: { width: 1440, height: 900 }, 390: { width: 390, height: 844 } };
const sizes = (process.argv[3] || '1440,390').split(',').filter(s => SZ[s]);
const OUT = process.env.SHOTS_OUT || new URL('./shots/r2/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const fx = await makeStudio({ port: Number(process.env.SHOTS_PORT) || 8911, inspect: false });
await seedStages(fx, { prefix: 'R2 shot' });
const R = '#studio-root '; const wait = ms => new Promise(r => setTimeout(r, ms));
async function settle(page) { await page.evaluate(async () => { try { await document.fonts.ready; } catch (e) {} }); await wait(700); }
async function shot(page, name, sz) { await settle(page); await page.screenshot({ path: OUT + label + '-' + name + '-' + sz + '.png' }); console.log('  ' + name + ' ' + sz); }
const step = (page, names) => page.locator(R + '.st-step').filter({ has: page.locator('.st-step-l', { hasText: new RegExp('^(' + names.join('|') + ')$') }) }).first();
async function open(page, title) {
  await page.waitForSelector(R + '.st-lib tbody tr, ' + R + '.st-libcard', { timeout: 20000 });
  const row = R + '.st-lib tbody tr:has-text("' + title + '")'; await page.waitForSelector(row, { timeout: 15000 });
  await page.locator(row).first().locator('button.st-lib-open, .ov-link').first().click(); await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await wait(900);
}
for (const s of sizes) {
  const page = await fx.open({ viewport: SZ[s], quiet: true });
  try {
    await page.waitForSelector(R + '.st-lib, ' + R + '.st-libcard', { timeout: 20000 }).catch(() => {}); await shot(page, '00-library', s);
    const nb = page.locator(R + 'button:visible', { hasText: /^New project|^\+ New|^Start a project/ }).first();
    if (await nb.count()) { await nb.click().catch(() => {}); await wait(800); await shot(page, '01-wizard', s); await page.keyboard.press('Escape'); await wait(500); }
    await open(page, 'R2 shot at design');
    const stages = [['02-brief', ['Brief']], ['03-plan', ['Message', 'Plan']], ['04-direction', ['Direction']], ['05-copy', ['Copy']], ['06-create', ['Design', 'Create']], ['07-review', ['Review']], ['08-deliver', ['Deliver']]];
    for (const [n, names] of stages) {
      const b = step(page, names);
      if (await b.count() && await b.isVisible()) { await b.click().catch(() => {}); }
      else { const any = page.locator(R + '.st-step', { hasText: new RegExp(names.join('|')) }).first(); if (await any.count()) await any.click({ force: true }).catch(() => {}); }
      await wait(1100); await shot(page, n, s);
      // the brief form (R2) and the Creative Partner panel in Create, where they exist
      if (n === '02-brief' && await page.$(R + '.st-bf')) { await page.$eval(R + '.st-bf', e => e.scrollIntoView({ block: 'start' })); await wait(400); await shot(page, '02b-brief-form', s); }
      if (n === '06-create') {
        const tg = page.locator(R + '.st-insp-toggle').first(); if (await tg.count() && await tg.isVisible()) { await tg.click().catch(() => {}); await wait(600); }
        const t = page.locator(R + '#st-tabbtn-director').first();
        if (await t.count() && await t.isVisible()) { await t.click({ timeout: 5000 }).catch(() => {}); await wait(800); await shot(page, '06b-partner', s); await page.keyboard.press('Escape'); await wait(400); }
      }
    }
  } catch (e) { console.log('  stopped: ' + String(e.message).split('\n')[0]); }
  await page.context().close();
}
await fx.close(); process.exit(0);
