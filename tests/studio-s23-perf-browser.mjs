/* S23 slice J: the browser-side budgets the S23 brief set, measured in headless Chromium against the worker running in this
 * process (local round trips, providers MOCKED - provider latency is not measured here and is never folded into these figures):
 *   - cold interactive: from navigation to the Studio library listing its projects (Navigation Timing + performance.now);
 *   - stage transitions: a click on a phase to the new phase drawn (the step marked current and the next animation frame),
 *     Brief / Copy / Design / Review and back, twelve times;
 *   - growth across 200 actions (opening tiles, nudging, undoing, switching phases): JS heap after a forced collection, DOM
 *     nodes, event listeners on window and document, and object URLs created but not revoked.
 * Editing input-to-paint, 50-layer drag frame intervals and long tasks are measured by studio-s20-perf-browser.mjs (kept).
 * Targets from the brief: cold interactive 2.5 s, transitions 150 ms, no unexplained growth. Headless Chromium on a shared
 * machine is noisier than a laptop: the figures go to tests/shots/s23/perf.json with the machine, and the assertions are
 * the targets with a stated allowance where the sandbox is slower (cold 2.5 s x 2, transitions p95 150 ms x 2).
 * Run: node --experimental-sqlite tests/studio-s23-perf-browser.mjs */
import fs from 'node:fs'; import os from 'node:os';
import { makeStudio, runner, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8883, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s23-perf-browser (cold interactive, stage transitions, growth across 200 actions; providers MOCKED)');
const OUT = new URL('./shots/s23/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const rep = { at: new Date().toISOString(), machine: { cpus: os.cpus().length, model: (os.cpus()[0] || {}).model, mem: Math.round(os.totalmem() / 1e9) + ' GB', node: process.version, headless: true }, targets: { coldMs: 2500, transitionMs: 150 } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))]); };
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'c', alt: 'a' };
const LAYOUT = () => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], noImagery: true, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Band', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF' },
  { id: 'support', type: 'text', role: 'support', x: 8, y: 82, w: 70, h: 8, size: 3, weight: 500, color: '#FFFFFF' },
  { id: 'chip', type: 'shape', role: 'device', name: 'Chip', shape: 'pill', x: 60, y: 10, w: 30, h: 6, fill: '#F2B705', opacity: 1 }] });
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Perf check', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'perf-23' });
for (const t of ['Tile one', 'Tile two']) await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '4:5', title: t, copy: COPY, layout: LAYOUT(), mode: 'composition' });
let page;

await T.t('cold interactive: navigation to the library listing its projects', async () => {
  const runs = [];
  for (let i = 0; i < 3; i++) {
    if (page) await page.ctxB.close(); page = await fx.open({ go: false, quiet: true });
    const t = await page.evaluate(async () => { const t0 = performance.now(); go('studio'); const all = () => document.querySelector('#studio-root .st-lib tbody tr');
      for (let k = 0; k < 400 && !all(); k++) { const b = Array.from(document.querySelectorAll('#studio-root button')).find(x => /All projects/.test(x.textContent)); if (b && !all()) b.click(); await new Promise(r => setTimeout(r, 25)); }
      await new Promise(r => requestAnimationFrame(() => r())); const nav = performance.getEntriesByType('navigation')[0] || {}; return { boot: Math.round(nav.domInteractive || 0), studio: Math.round(performance.now() - t0), total: Math.round(performance.now()) }; });
    runs.push(t);
  }
  rep.cold = { runs, medianTotalMs: pct(runs.map(r => r.total), 0.5), medianStudioMs: pct(runs.map(r => r.studio), 0.5) };
  ok(rep.cold.medianTotalMs < 2500 * 2, 'cold interactive ' + rep.cold.medianTotalMs + ' ms (target 2,500; allowance x2 here): ' + JSON.stringify(runs));
});

await T.t('stage transitions: a click on a phase to the phase drawn', async () => {
  await page.locator(R + '.st-lib tbody tr:has-text("Perf check") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step'); await sleep(500);
  const seq = ['Copy', 'Design', 'Review', 'Brief'];
  const times = [];
  for (let i = 0; i < 12; i++) {
    const name = seq[i % seq.length];
    times.push(await page.evaluate(async n => { const btn = Array.from(document.querySelectorAll('#studio-root .st-step')).find(b => new RegExp('^' + n).test((b.querySelector('.st-step-l') || {}).textContent || '')); const t0 = performance.now(); btn.click();
      for (let k = 0; k < 200; k++) { const on = document.querySelector('#studio-root .st-step.on .st-step-l'); if (on && new RegExp('^' + n).test(on.textContent)) break; await new Promise(r => setTimeout(r, 2)); }
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))); return Math.round(performance.now() - t0); }, name));
    await sleep(150);
  }
  rep.transitions = { times, p50: pct(times, 0.5), p95: pct(times, 0.95) };
  ok(rep.transitions.p95 < 150 * 2, 'transitions p50 ' + rep.transitions.p50 + ' ms, p95 ' + rep.transitions.p95 + ' ms (target 150; allowance x2 here)');
});

await T.t('growth across 200 actions: heap after collection, DOM nodes, listeners, unrevoked object URLs', async () => {
  if (page) await page.ctxB.close();
  page = await fx.open({ quiet: true });
  await page.addInitScript(() => {});
  await page.evaluate(() => { const live = new Set(); const c = URL.createObjectURL.bind(URL), rv = URL.revokeObjectURL.bind(URL); URL.createObjectURL = o => { const u = c(o); live.add(u); return u; }; URL.revokeObjectURL = u => { live.delete(u); return rv(u); }; window.__liveUrls = () => live.size; });
  const cdp = await page.context().newCDPSession(page); await cdp.send('Performance.enable');
  const sample = async () => { await cdp.send('HeapProfiler.collectGarbage'); await sleep(200); const m = (await cdp.send('Performance.getMetrics')).metrics; const g = k => (m.find(x => x.name === k) || {}).value;
    const lis = async expr => { const o = await cdp.send('Runtime.evaluate', { expression: expr }); const r = await cdp.send('DOMDebugger.getEventListeners', { objectId: o.result.objectId }); return r.listeners.length; };
    return { heapMB: Math.round(g('JSHeapUsedSize') / 1e5) / 10, nodes: g('Nodes'), attached: await page.evaluate(() => document.getElementsByTagName('*').length), docs: g('Documents'), frames: g('Frames'), listeners: (await lis('window')) + (await lis('document')), urls: await page.evaluate(() => window.__liveUrls()) }; };
  const all = page.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("Perf check")'); await page.locator(R + '.st-lib tbody tr:has-text("Perf check") button.st-lib-open').first().click(); await page.waitForSelector(R + '.st-step'); await sleep(400);
  const step = async n => page.click(R + '.st-step:has(.st-step-l:' + (n === 'Review' ? 'text-matches("^Review")' : 'text-is("' + n + '")') + ')');
  await step('Design'); await page.click(R + '.st-assetpick:has-text("Tile one")'); await page.waitForSelector(R + '.st-le-layer'); await sleep(800);
  // warm up once so first-use caches (fonts, images, compiled code) are not counted as growth
  for (let i = 0; i < 20; i++) { await page.click(R + '.st-pagechip:has-text(' + (i % 2 ? '"Tile one"' : '"Tile two"') + ')'); await sleep(80); }
  const before = await sample(); let n = 0;
  while (n < 200) {
    const k = n % 10;
    // no element handles in the measured loop: a Playwright handle keeps its element (and the detached tree around it) alive,
    // which reads as a leak of the page (it was: 311 nodes per switch with waitForSelector, none without)
    if (k < 4) { await page.click(R + '.st-pagechip:has-text(' + (n % 2 ? '"Tile one"' : '"Tile two"') + ')'); await page.waitForFunction(() => !!document.querySelector('#studio-root .st-le-layer')); }
    else if (k < 7) { await page.click(R + '.st-le-layer[data-id="chip"]', { force: true }).catch(() => {}); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Control+z'); }
    else if (k < 9) { await step(k === 7 ? 'Review' : 'Design'); if (k === 8) await page.waitForFunction(() => !!document.querySelector('#studio-root .st-stage canvas')); }
    else await page.keyboard.press('Escape');
    n++; await sleep(40);
  }
  await sleep(1000); const after = await sample();
  rep.growth = { actions: n, before, after, delta: { heapMB: Math.round((after.heapMB - before.heapMB) * 10) / 10, nodes: after.nodes - before.nodes, listeners: after.listeners - before.listeners, urls: after.urls - before.urls } };
  ok(rep.growth.delta.heapMB < 15, 'heap after collection grew ' + rep.growth.delta.heapMB + ' MB over 200 actions');
  ok(rep.growth.delta.listeners <= 10, 'listeners on window and document grew by ' + rep.growth.delta.listeners);
  ok(rep.growth.delta.urls <= 8, 'unrevoked object URLs grew by ' + rep.growth.delta.urls);
  ok(rep.growth.delta.nodes < 1500, 'DOM nodes (attached and detached) grew by ' + rep.growth.delta.nodes + '; attached ' + before.attached + ' to ' + after.attached);
});

fs.writeFileSync(OUT + 'perf.json', JSON.stringify(rep, null, 2));
console.log(JSON.stringify({ cold: rep.cold && rep.cold.medianTotalMs, transitions: rep.transitions && [rep.transitions.p50, rep.transitions.p95], growth: rep.growth && rep.growth.delta }));
T.done(); await fx.close();
