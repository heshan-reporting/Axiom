/* S23 slice J: the core journey in Firefox and WebKit as well as Chromium, against the worker module in this process (providers
 * MOCKED): the library lists the project, it opens, Design draws the composition on the canvas, a layer is nudged and saved as a
 * version the worker holds, Review opens, and the page reported no error. An engine that is not installed on this machine is
 * skipped with the reason (CI installs Firefox and WebKit; this sandbox ships Chromium only), never counted as a pass.
 * Run: node --experimental-sqlite tests/studio-xbrowser-browser.mjs */
import fs from 'node:fs';
import { chromium, firefox, webkit } from './pw.mjs';
import { makeStudio } from './studio-fixture.mjs';
const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0, skipped = [];
console.log('studio-xbrowser-browser (the core journey in Chromium, Firefox and WebKit; providers MOCKED)');
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'c', alt: 'a' };
const LAYOUT = () => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], noImagery: true, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Band', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF' },
  { id: 'chip', type: 'shape', role: 'device', name: 'Chip', shape: 'pill', x: 60, y: 10, w: 30, h: 6, fill: '#F2B705', opacity: 1 }] });
const ENGINES = [['chromium', chromium, 8884], ['firefox', firefox, 8885], ['webkit', webkit, 8886]];
for (const [name, type, port] of ENGINES) {
  let exe = ''; try { exe = type.executablePath(); } catch (e) {}
  if (!exe || !fs.existsSync(exe)) { skipped.push(name); console.log('  skip ' + name + ': not installed here (npx playwright install ' + name + ')'); continue; }
  let fx = null;
  try {
    fx = await makeStudio({ port, inspect: false, browser: name });
    const pr = await fx.api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Engines ' + name, brief: { channels: ['instagram'], objective: 'x', message: 'y' }, idem: 'xb-' + name });
    const A = (await fx.api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '4:5', title: 'Engine tile', copy: COPY, layout: LAYOUT(), mode: 'composition' })).asset.id;
    const page = await fx.open({ quiet: true }); const errors = []; page.on('pageerror', e => errors.push(e.message));
    const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
    await page.waitForSelector(R + '.st-lib tbody tr:has-text("Engines ' + name + '")', { timeout: 30000 });
    await page.locator(R + '.st-lib tbody tr:has-text("Engines ' + name + '") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step', { timeout: 20000 });
    await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await page.click(R + '.st-assetpick:has-text("Engine tile")');
    await page.waitForSelector(R + '.st-stage canvas', { timeout: 20000 }); await page.waitForSelector(R + '.st-le-layer[data-id="chip"]', { timeout: 20000 }); await sleep(800);
    const drawn = await page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 61) if (d[i] > 0) n++; return n; });
    if (!(drawn > 50)) throw new Error('the composition is not drawn on the canvas (' + drawn + ')');
    await page.click(R + '.st-le-layer[data-id="chip"]', { force: true }); await page.keyboard.press('ArrowLeft'); await sleep(300);
    await page.click(R + '.st-le-foot .btn:has-text("Save layout as a version")');
    await page.waitForFunction(() => /No unsaved changes|Version saved/.test((document.querySelector('#studio-root .st-le-draft') || {}).textContent || ''), null, { timeout: 15000 });
    const g = await fx.api('GET', '/studio/get?id=' + pr.id); const a = g.assets.find(x => x.id === A); const chip = a.versions.find(v => v.id === a.current).layout.layers.find(l => l.id === 'chip');
    if (!(chip.x < 60)) throw new Error('the nudge was not saved: x = ' + chip.x);
    await page.click(R + '.st-step:has(.st-step-l:text-matches("^Review"))'); await sleep(800);
    if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
    pass++; console.log('  ok   ' + name + ': library, open, the canvas drawn, a nudge saved as a version, Review');
  } catch (e) { fail++; console.log('  FAIL ' + name + ': ' + String(e && e.message || e).slice(0, 400)); }
  finally { if (fx) await fx.close().catch(() => {}); }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped.length ? ' (skipped, not installed: ' + skipped.join(', ') + ')' : ''));
process.exit(fail ? 1 : 0);
