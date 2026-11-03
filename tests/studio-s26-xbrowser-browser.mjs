/* S26 in Chromium, Firefox and WebKit (4 November 2026), against the worker module in this process, providers MOCKED:
 *   - a classic project's direction change asks in the Studio's own dialog (no browser confirm in any engine): Cancel changes
 *     nothing, "keep them as written" chooses the direction;
 *   - a Creative Director suggestion dismissed in the page is kept by the worker (one write) and the page says so;
 *   - at 1440 x 900 the fitted 4:5 artboard is at least 560 px tall with the inspector open, and the page does not scroll.
 * An engine that is not installed is skipped with the reason (CI installs all three; this sandbox ships Chromium only), never
 * counted as a pass. Run: node --experimental-sqlite tests/studio-s26-xbrowser-browser.mjs */
import fs from 'node:fs';
import { chromium, firefox, webkit } from './pw.mjs';
import { makeStudio } from './studio-fixture.mjs';
const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const skipped = [];
console.log('studio-s26-xbrowser-browser (the S26 flows in Chromium, Firefox and WebKit; providers MOCKED)');
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'c', alt: 'a' };
const LAYOUT = () => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], noImagery: true, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Band', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF' }] });
const ENGINES = [['chromium', chromium, 8874], ['firefox', firefox, 8875], ['webkit', webkit, 8876]];
for (const [name, type, port] of ENGINES) {
  let exe = ''; try { exe = type.executablePath(); } catch (e) {}
  if (!exe || !fs.existsSync(exe)) { skipped.push(name); console.log('  skip ' + name + ': not installed here (npx playwright install ' + name + ')'); continue; }
  let fx = null;
  try {
    fx = await makeStudio({ port, inspect: false, browser: name });
    const { api } = fx;
    const step = async id => { let j; for (let i = 0; i < 12; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
    const job = async (P, stage, input) => { const r = await api('POST', '/studio/job', { project: P, stage, input, idem: stage + ':' + Math.random() }); return step(r.job.id); };
    const open = async (title, o) => {
      const page = await fx.open(Object.assign({ quiet: true, viewport: { width: 1440, height: 900 } }, o || {})); const errors = []; page.on('pageerror', e => errors.push(e.message));
      page.on('dialog', d => { errors.push('browser dialog: ' + d.message().slice(0, 100)); d.dismiss(); });
      const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
      await page.waitForSelector(R + '.st-lib tbody tr:has-text("' + title + '")', { timeout: 30000 });
      await page.locator(R + '.st-lib tbody tr:has-text("' + title + '") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step', { timeout: 20000 });
      page.errs = errors; return page;
    };
    // 1. the classic direction dialog
    const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Engines classic ' + name, brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits refund a road tax', audience: 'Regional voters', action: 'Read the facts', channels: ['facebook'], deliverable: 'set', campaignConfirmed: true, imageryTiming: 'after_copy' } })).id;
    if ((await job(P, 'direct', { n: 2 })).state !== 'done') throw new Error('directions were not made');
    let g = await api('GET', '/studio/get?id=' + P); await api('POST', '/studio/direction/choose', { id: g.directions[0].id });
    if ((await job(P, 'copy', { channels: ['facebook'], deliverable: 'set', formats: { facebook: '1:1' } })).state !== 'done') throw new Error('copy was not written');
    g = await api('GET', '/studio/get?id=' + P); const other = g.directions[1];
    const page = await open('Engines classic ' + name);
    await page.click(R + '.st-step:has(.st-step-l:text-is("Direction"))'); await sleep(600);
    const card = page.locator(R + '.st-dir:has(.st-dir-title:has-text("' + other.title.replace(/"/g, '') + '"))').first();
    await card.locator('button:has-text("Choose this direction")').click();
    await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 15000 });
    await page.click(R + '.st-impact button:has-text("Cancel")'); await sleep(300);
    if ((await api('GET', '/studio/get?id=' + P)).directions.find(d => d.chosen).id !== g.directions[0].id) throw new Error('Cancel changed the choice');
    await card.locator('button:has-text("Choose this direction")').click();
    await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 15000 });
    await page.click(R + '.st-impact button:has-text("keep them as written")');
    let chosen = ''; for (let i = 0; i < 40 && chosen !== other.id; i++) { await sleep(250); chosen = (await api('GET', '/studio/get?id=' + P)).directions.find(d => d.chosen).id; }
    if (chosen !== other.id) throw new Error('keep did not choose the direction');
    await page.ctxB.close();
    // 2 and 3. a composition at 1440 x 900: the artboard, then a suggestion dismissed
    const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Engines design ' + name, brief: { channels: ['instagram'], objective: 'x', message: 'y' } });
    const A = (await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '4:5', title: 'Engine tile', copy: COPY, layout: LAYOUT(), mode: 'composition' })).asset;
    const sg = await api('POST', '/studio/suggest', { project: pr.id, asset: A.id }); if (!sg.ok || !(sg.design || []).length) throw new Error('no suggestions made: ' + JSON.stringify(sg).slice(0, 160));
    const p2 = await open('Engines design ' + name);
    await p2.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await p2.click(R + '.st-assetpick:has-text("Engine tile"), ' + R + '.st-pagechip:has-text("Engine tile")');
    await p2.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 20000 }); await sleep(1500);
    const m = await p2.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas').getBoundingClientRect(); const ins = document.querySelector('#studio-root .st-inspector').getBoundingClientRect(); return { h: Math.round(c.height), w: Math.round(c.width), insW: Math.round(ins.width), scroll: document.scrollingElement.scrollHeight <= innerHeight + 1 }; });
    if (!(m.insW >= 280 && m.h >= 560 && Math.abs(m.w / m.h - 0.8) < 0.02 && m.scroll)) throw new Error('the 4:5 artboard with the inspector open: ' + JSON.stringify(m));
    for (let i = 0; i < 10; i++) {
      if (!(await p2.locator(R + '.st-cd-tabs:visible').count())) { const tab = p2.locator(R + '.st-instab:has-text("Creative Director"), ' + R + 'button:has-text("Creative Director")').first(); if (await tab.count()) await tab.click(); await sleep(300); }
      const ex = p2.locator(R + '.st-cd-tabs:visible button:has-text("Explore")').first(); if (await ex.count() && (await ex.getAttribute('aria-selected')) !== 'true') await ex.click();
      if (await p2.locator(R + '.st-sugg-item, ' + R + 'button:has-text("Suggest for this version")').count()) break; await sleep(700);
    }
    const ask = p2.locator(R + 'button:has-text("Suggest for this version")').first(); if (await ask.count() && !(await p2.locator(R + '.st-sugg-item').count())) await ask.click();
    await p2.waitForSelector(R + '.st-sugg-item .st-sugg-dismiss', { timeout: 15000 });
    const before = fx.seen.length;
    await p2.locator(R + '.st-sugg-item .st-sugg-dismiss').first().click();
    await p2.waitForSelector(R + '.st-sugg-dismissed', { timeout: 10000 });
    const writes = fx.seen.slice(before).filter(x => x.method !== 'GET').map(x => x.path);
    if (writes.length !== 1 || writes[0] !== '/studio/suggest/dismiss') throw new Error('one write, the dismissal: ' + JSON.stringify(writes));
    const pk = await api('GET', '/studio/suggest?asset=' + A.id); if ((pk.dismissed || []).length !== 1) throw new Error('the worker holds it: ' + JSON.stringify(pk.dismissed));
    const errs = page.errs.concat(p2.errs); if (errs.length) throw new Error('page errors or browser dialogs: ' + errs.join(' | '));
    pass++; console.log('  ok   ' + name + ': the classic direction dialog (Cancel, keep), a 4:5 artboard of ' + m.h + ' px with the inspector open, a dismissal kept by the worker');
  } catch (e) { fail++; console.log('  FAIL ' + name + ': ' + String(e && e.message || e).slice(0, 400)); }
  finally { if (fx) await fx.close().catch(() => {}); }
}
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (skipped.length ? ' (skipped, not installed: ' + skipped.join(', ') + ')' : ''));
process.exit(fail ? 1 : 0);
