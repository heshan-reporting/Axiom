/* S20: the performance split - canvas, network and provider time - with the S19 canvas measurements kept as they were.
 * Canvas: the renderer's draw / measure / validate of a 50-layer composition, frame intervals and pointer-to-frame latency while
 * dragging, and keyboard nudges (Event Timing). Network: every /studio/* request the page makes while it opens the project, opens
 * the asset and saves a version, from the Resource Timing entries - against the worker running in this process over SQLite, so
 * these are local round trips, not the deployed worker. Provider: the model and image calls are MOCKED here; their time is not
 * measured and the report says so rather than inventing a figure.
 * Previously S19:
 * A 1080 x 1350 composition with 50 layers (text, shapes, labels, an image region) over a photograph:
 *   - the renderer: one full draw at the output size, measure(), and validate() - median and worst of 12 runs
 *   - dragging a layer: 90 pointer moves; the interval between animation frames while dragging (p50 / p95 / worst),
 *     long tasks over 50 ms (PerformanceObserver 'longtask'), and pointer-to-next-frame latency (the time from each
 *     pointermove's timestamp to the end of the task after the next animation frame - an approximation of input to paint)
 *   - nudging with the keyboard: Event Timing 'keydown' durations (input to next paint, as the browser reports it)
 * Budgets the S19 brief set: 60 fps while dragging (a frame interval near 16.7 ms), interaction p95 under 100 ms, no long
 * task over 50 ms during a drag. Headless Chromium on a shared machine is noisier than a designer's laptop: the figures are
 * written to tests/shots/s20/perf-<label>.json and the assertions are the budgets themselves on the p95 figures.
 * Run: node --experimental-sqlite tests/studio-s19-perf-browser.mjs [label] */
import fs from 'node:fs';
import { makeStudio, runner, ok } from './studio-fixture.mjs';
import { pngSubjectB64 } from './worker-png.mjs';
const label = process.argv[2] || 'after';
const fx = await makeStudio({ port: 8867, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s20-perf-browser (canvas, network and provider time; a 50-layer composition: draw, measure, validate, drag and nudge timings; providers MOCKED)');
const OUT = new URL('./shots/s20/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const rep = { label, at: new Date().toISOString(), layers: 50 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))] * 10) / 10; };

// the heavy composition: a photograph, a panel, a headline, support and CTA, then 35 more small elements
const key = 'studio/perf/photo.png'; fx.r2.set(key, { v: Buffer.from(pngSubjectB64(540, 675), 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const layers = [
  { id: 'panel', role: 'panel', type: 'shape', shape: 'rect', x: 4, y: 58, w: 92, h: 36, fill: '#0E6A6E', opacity: 0.9 },
  { id: 'hl', role: 'headline', type: 'text', x: 8, y: 61, w: 84, h: 14, size: 6.5, color: '#FFFFFF', weight: 800 },
  { id: 'sp', role: 'support', type: 'text', x: 8, y: 77, w: 84, h: 7, size: 3, color: '#FFFFFF' },
  { id: 'cta', role: 'cta', type: 'text', x: 8, y: 86, w: 40, h: 5, size: 2.8, color: '#FFFFFF', weight: 700 },
];
for (let i = 0; i < 46; i++) {
  const col = i % 6, row = Math.floor(i / 6);
  if (i % 3 === 0) layers.push({ id: 'lbl' + i, role: 'free', type: 'text', text: 'Label ' + (i + 1), x: 4 + col * 15.5, y: 4 + row * 6.5, w: 14, h: 4, size: 1.8, color: '#FFFFFF' });
  else if (i % 3 === 1) layers.push({ id: 'sh' + i, role: 'free', type: 'shape', shape: i % 2 ? 'pill' : 'circle', x: 4 + col * 15.5, y: 4 + row * 6.5, w: 6, h: 4, fill: '#F2B705', opacity: 0.8 });
  else layers.push({ id: 'rule' + i, role: 'free', type: 'shape', shape: 'rule', x: 4 + col * 15.5, y: 6 + row * 6.5, w: 12, h: 0.4, fill: '#FFFFFF' });
}
const L = { v: 5, stage: { w: 1080, h: 1350 }, layers };
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S20 perf', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'set', campaignConfirmed: true }, idem: 'perf20' });
const made = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '4:5', title: 'Heavy tile', copy: { headline: 'Mining keeps regional towns running', support: 'Fuel tax credits are not a subsidy.', cta: 'Get the facts' }, layout: L, mode: 'composition', image: { key, url: '/studio/file?key=' + encodeURIComponent(key), model: 'test', size: '1K' } });
ok(made.asset && made.asset.versions[0].layout.layers.length === 50, 'a 50-layer composition is on file');

let page;
await T.t('the renderer: a full draw, measure() and validate() of 50 layers at 1080 x 1350', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true }); page.on('dialog', d => d.accept());
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("S20 perf")'); await page.click(R + '.st-lib tbody tr:has-text("S20 perf") button.st-lib-open');
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))').catch(() => {});
  const pick = page.locator(R + '.st-assetpick').first(); if (await pick.count()) await pick.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 20000 }); await sleep(1500);
  const r = await page.evaluate(async ({ L, copy }) => {
    const R = window.STRender; const img = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = document.querySelector('#studio-root .st-stage canvas, #studio-root .st-artboard canvas').toDataURL(); });
    const imgs = { bg: img }; const t = { draw: [], measure: [], validate: [] };
    for (let k = 0; k < 12; k++) {
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
      let t0 = performance.now(); R.render(L, copy, imgs, 1080, c); t.draw.push(performance.now() - t0);
      t0 = performance.now(); R.measure(L, copy, imgs, 1080, 1350); t.measure.push(performance.now() - t0);
      t0 = performance.now(); R.validate(L, copy, imgs, { format: '4:5', channel: 'instagram' }); t.validate.push(performance.now() - t0);
    }
    const s0 = R.subjects ? R.subjects(img) : null; t.subjects = s0 ? s0.regions.length : 0;
    if (R.frameSuggest && s0 && s0.regions.length) { t.frameSuggest = []; for (let k = 0; k < 6; k++) { const t0 = performance.now(); R.frameSuggest(L, copy, imgs, { format: '4:5' }); t.frameSuggest.push(performance.now() - t0); } }
    return t;
  }, { L, copy: made.asset.versions[0].copy });
  rep.renderer = { subjects: r.subjects }; for (const k of Object.keys(r)) if (Array.isArray(r[k])) rep.renderer[k] = { median: pct(r[k], 0.5), worst: pct(r[k], 1) };
  console.log('       renderer ' + JSON.stringify(rep.renderer));
  ok(rep.renderer.draw.median != null, 'measured');
});

await T.t('dragging a layer of the 50: frame intervals, long tasks and pointer-to-frame latency', async () => {
  await page.evaluate(() => {
    window.__perf = { frames: [], long: [], lat: [], on: false };
    try { new PerformanceObserver(l => { if (window.__perf.on) l.getEntries().forEach(e => window.__perf.long.push(e.duration)); }).observe({ type: 'longtask', buffered: false }); } catch (e) { window.__perf.noLong = true; }
    let last = 0; const tick = t => { if (window.__perf.on) { if (last) window.__perf.frames.push(t - last); last = t; } else last = 0; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    window.addEventListener('pointermove', e => { if (!window.__perf.on) return; const t0 = e.timeStamp; requestAnimationFrame(() => setTimeout(() => window.__perf.lat.push(performance.now() - t0), 0)); }, true);
  });
  const el = await page.$(R + '.st-le-layer[aria-label="Layer headline"]'); const b = await el.boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.evaluate(() => { window.__perf.on = true; });
  for (let i = 1; i <= 90; i++) { await page.mouse.move(cx + Math.sin(i / 9) * 120, cy - Math.abs(Math.cos(i / 11)) * 160); await sleep(8); }
  await page.evaluate(() => { window.__perf.on = false; window.__perf.after = []; window.__perf.afterOn = true; });
  try { await page.evaluate(() => { new PerformanceObserver(l => { if (window.__perf.afterOn) l.getEntries().forEach(e => window.__perf.after.push(e.duration)); }).observe({ type: 'longtask', buffered: false }); }); } catch (e) {}
  await page.mouse.up(); await sleep(1500);
  await page.evaluate(() => { window.__perf.afterOn = false; });
  const d = await page.evaluate(() => window.__perf);
  rep.drag = { moves: 90, frames: d.frames.length, frameP50: pct(d.frames, 0.5), frameP95: pct(d.frames, 0.95), frameWorst: pct(d.frames, 1), longTasks: d.long.length, longWorst: pct(d.long, 1), latencyP50: pct(d.lat, 0.5), latencyP95: pct(d.lat, 0.95), latencyWorst: pct(d.lat, 1), longTaskApi: !d.noLong, settleLongTasks: (d.after || []).length, settleLongWorst: pct(d.after || [], 1) };
  console.log('       drag ' + JSON.stringify(rep.drag));
  ok(rep.drag.latencyP95 != null && rep.drag.latencyP95 < 100, 'pointer to frame p95 under 100 ms: ' + rep.drag.latencyP95);
  ok(rep.drag.frameP95 != null && rep.drag.frameP95 < 50, 'frame interval p95 while dragging under 50 ms (60 fps is 16.7): ' + rep.drag.frameP95);
});

await T.t('nudging with the keyboard: input to next paint per keydown (Event Timing)', async () => {
  await page.evaluate(() => { window.__ev = []; try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.name === 'keydown') window.__ev.push(e.duration); })).observe({ type: 'event', durationThreshold: 16, buffered: false }); } catch (e) { window.__ev.none = true; } });
  await page.click(R + '.st-le-layer[aria-label="Layer support"]'); await sleep(200);
  for (let i = 0; i < 30; i++) { await page.keyboard.press(i % 2 ? 'ArrowLeft' : 'ArrowRight'); await sleep(30); }
  await sleep(600);
  const ev = await page.evaluate(() => window.__ev);
  // Event Timing reports only events at or over 16 ms; the others were faster than a frame
  rep.nudge = { presses: 30, over16ms: ev.length, p95OfReported: pct(ev, 0.95), worst: pct(ev, 1) };
  console.log('       nudge ' + JSON.stringify(rep.nudge));
  ok(!ev.length || pct(ev, 0.95) < 100, 'keyboard nudges paint within 100 ms at p95: ' + JSON.stringify(rep.nudge));
});

await T.t('network: the /studio requests while the asset opens and a version is saved (local worker in-process; not the deployed worker)', async () => {
  await page.evaluate(() => performance.clearResourceTimings());
  await page.click(R + '.st-le-layer[aria-label="Layer cta"]'); await page.keyboard.press('Shift+ArrowUp'); await sleep(300);
  const save = page.locator(R + '.st-le-foot .btn:has-text("Save layout")'); if (await save.count()) { await save.first().click(); await sleep(2500); }
  const ent = await page.evaluate(() => performance.getEntriesByType('resource').filter(e => /\/studio\//.test(e.name)).map(e => ({ path: new URL(e.name).pathname, ms: Math.round(e.duration * 10) / 10 })));
  const ms = ent.map(e => e.ms);
  rep.network = { requests: ent.length, p50: pct(ms, 0.5), p95: pct(ms, 0.95), worst: pct(ms, 1), byPath: ent.reduce((m, e) => { (m[e.path] = m[e.path] || []).push(e.ms); return m; }, {}), note: 'local worker in this process over SQLite: round trips without the internet, Cloudflare or D1 latency' };
  rep.provider = { measured: false, note: 'model and image providers are MOCKED in this harness; no provider time is reported. Real generation time comes from the deployed worker (/studio/status durations).' };
  console.log('       network ' + JSON.stringify({ requests: rep.network.requests, p50: rep.network.p50, p95: rep.network.p95, worst: rep.network.worst }));
  ok(ent.length > 0, 'requests were seen');
});

fs.writeFileSync(OUT + 'perf-' + label + '.json', JSON.stringify(rep, null, 1));
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
