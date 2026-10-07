/* S21 in real Chromium with docs/studio-render.js: what the 7 October live demonstration (HOOF and MCA, real Claude, no images)
 * failed on, each reproduced against the renderer as it was and then fixed.
 *   1. the strike is the words' own emphasis, drawn through the letters (pixels read back);
 *   2. an overlap recorded as intended (what the normaliser now writes for a strike or a declared device) is not "occluded";
 *      the same device without the record still is;
 *   3. a long stacked list (the MCA "who uses the credit" tile) is no longer spaced off the foot of the stage by repair: the
 *      support and the call to action (text13, text14) stay on it, and the repair completes;
 *   4. words an adaptation shrank under the readable size are raised to the feed minimum when the layout allows;
 *   5. a tile Fix layout cannot clear (words painted over by an opaque block) has a measured layout variation that passes.
 * Everything drawn is SYNTHETIC. No model is called. Run: node --experimental-sqlite tests/studio-s21-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch(); const page = await browser.newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', r => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
await page.goto('http://studio.test/'); await page.addScriptTag({ content: RENDERER });
await page.addScriptTag({ content: 'window.__blocking = v => v.issues.filter(i => i.severity === "blocking").map(i => i.code + ":" + i.layers.join(","));' });
console.log('studio-s21-browser (strike, intended overlaps, lists kept on the stage, readable adaptation, variations)');

const strike = await page.evaluate(async () => {
  const R = window.STRender; const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#000000', layers: [{ id: 'm', type: 'text', role: 'myth', text: 'SUBSIDY', x: 10, y: 40, w: 80, h: 14, size: 9, weight: 800, color: '#FFFFFF', emphasis: 'strike', emphasisColor: '#FF0000' }] };
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; R.draw(c.getContext('2d'), 1080, 1080, L, {}, {});
  const d = c.getContext('2d').getImageData(0, 0, 1080, 1080).data;
  // the red band runs through the middle of the line: count red pixels in the text box's rows
  let red = 0, rows = new Set(); for (let y = Math.round(0.40 * 1080); y < Math.round(0.54 * 1080); y++) for (let x = 120; x < 960; x += 2) { const i = (y * 1080 + x) * 4; if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) { red++; rows.add(y); } }
  const ys = Array.from(rows).sort((a, b) => a - b);
  return { red, top: ys[0], bottom: ys[ys.length - 1] };
});
ok(strike.red > 1000, '1. the strike is drawn in its colour across the words (' + strike.red + ' red pixels)');
ok(strike.top > 0.40 * 1080 + 20 && strike.bottom < 0.54 * 1080 - 10, '1. through the middle of the line, not above or below it (rows ' + strike.top + '-' + strike.bottom + ')');

const ov = await page.evaluate(() => {
  const R = window.STRender;
  const mk = rec => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, bg: '#0B1E33', layers: [
    Object.assign({ id: 'myth', type: 'text', role: 'myth', text: 'A subsidy for miners', x: 8, y: 30, w: 80, h: 12, size: 6, weight: 800, color: '#FFFFFF' }, rec ? { overlaps: ['bar'] } : {}),
    Object.assign({ id: 'bar', type: 'shape', role: 'device', shape: 'rect', fill: '#E4572E', x: 6, y: 33, w: 84, h: 4.5 }, rec ? { overlaps: ['myth'] } : {}) ] });
  const a = R.validate(mk(false), {}, {}, { format: '4:5', channel: 'instagram' }), b = R.validate(mk(true), {}, {}, { format: '4:5', channel: 'instagram' });
  return { without: window.__blocking(a), with: window.__blocking(b) };
});
ok(ov.without.some(x => /^occluded/.test(x)), '2. a crossing-out bar with no record is occluded, as before: ' + JSON.stringify(ov.without));
ok(!ov.with.some(x => /^occluded|^collision/.test(x)), '2. the same bar recorded as intended on both layers is not: ' + JSON.stringify(ov.with));

const list = await page.evaluate(() => {
  const R = window.STRender;
  const layers = [{ id: 'bg', type: 'shape', role: 'panel', x: 0, y: 0, w: 100, h: 100, fill: '#0B1E33' }];
  const words = ['NOT A SUBSIDY', 'A refund of road tax on fuel used off road', 'Farmers', 'Miners', 'Fishers', 'Builders', 'Truck yards', 'Rail', 'Hospitals', 'Councils', 'Forestry'];
  layers.push({ id: 'text1', type: 'text', role: 'kicker', text: words[0], x: 8, y: 8, w: 84, h: 6, size: 4, color: '#fff' });
  layers.push({ id: 'text2', type: 'text', role: 'headline', x: 8, y: 16, w: 84, h: 22, size: 7.5, color: '#fff' });
  for (let i = 1; i < 11; i++) layers.push({ id: 'text' + (i + 2), type: 'text', role: 'label', text: words[i], x: 8, y: 40 + (i - 1) * 4.6, w: 60, h: 4.4, size: 3.2, color: '#fff' });
  layers.push({ id: 'text13', type: 'text', role: 'support', x: 8, y: 84, w: 84, h: 6, size: 3, color: '#fff' });
  layers.push({ id: 'text14', type: 'text', role: 'cta', x: 8, y: 91, w: 50, h: 5, size: 2.8, color: '#fff' });
  const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, layers };
  const copy = { headline: 'The fuel tax credit is not a subsidy for mining', support: 'Every off-road user gets the same credit: it refunds a road tax on fuel never used on a road.', cta: 'Learn more: thatsmining.com.au' };
  const r = R.repair(L, copy, {}, { format: '1:1', channel: 'linkedin' });
  return { after: window.__blocking(r.after), outcome: r.outcome, onStage: r.layout.layers.filter(l => l.type === 'text').every(l => l.y >= 0 && l.y + l.h <= 100.05), order: r.layout.layers.filter(l => /^text/.test(l.id)).map(l => l.y).every((y, i, a) => !i || y >= a[i - 1]) };
});
ok(!list.after.some(x => /^off_canvas/.test(x)), '3. no block is pushed off the stage by spacing: ' + JSON.stringify(list.after));
ok(list.outcome === 'complete' && list.onStage, '3. the repair of the long list completes with every text box on the stage (' + list.outcome + ')');
ok(list.order, '3. the reading order is kept');

const small = await page.evaluate(() => {
  const R = window.STRender;
  const L = { v: 5, format: '16:9', stage: { w: 1920, h: 1080 }, bg: '#0B1E33', layers: [
    { id: 'k', type: 'text', role: 'kicker', text: 'MYTH', x: 6, y: 10, w: 30, h: 5, size: 1.6, weight: 800, color: '#FFFFFF' },
    { id: 'h', type: 'text', role: 'headline', x: 6, y: 20, w: 60, h: 24, size: 4, weight: 800, color: '#FFFFFF' },
    { id: 's', type: 'text', role: 'support', x: 6, y: 52, w: 60, h: 12, size: 1.7, color: '#FFFFFF' } ] };
  const copy = { headline: 'Not a subsidy', support: 'A refund of road tax on fuel used off road.' };
  const before = window.__blocking(R.validate(L, copy, {}, { format: '16:9', channel: 'linkedin' }));
  const r = R.repair(L, copy, {}, { format: '16:9', channel: 'linkedin' });
  return { before, after: window.__blocking(r.after), sizes: r.layout.layers.map(l => l.id + ':' + l.size), steps: r.steps };
});
ok(small.before.some(x => /^unreadable_type/.test(x)), '4. reproduced: type under the readable size blocks: ' + JSON.stringify(small.before));
ok(!small.after.some(x => /^unreadable_type/.test(x)), '4. raised to the feed minimum: ' + JSON.stringify(small.sizes) + ' ' + JSON.stringify(small.after));
ok(small.steps.some(s => /feed minimum/.test(s)), '4. and the step says so');

const vari = await page.evaluate(() => {
  const R = window.STRender;
  const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#0B1E33', noImagery: true, layers: [
    { id: 'h', type: 'text', role: 'headline', x: 8, y: 30, w: 84, h: 20, size: 7, weight: 800, color: '#FFFFFF' },
    { id: 'slab', type: 'shape', role: 'device', shape: 'rect', fill: '#E4572E', x: 6, y: 28, w: 88, h: 14, locked: true },
    { id: 's', type: 'text', role: 'support', x: 8, y: 62, w: 84, h: 10, size: 3, color: '#FFFFFF' } ] };
  const copy = { headline: 'Not a subsidy', support: 'A refund of road tax on fuel used off road.' };
  const r = R.repair(L, copy, {}, { format: '1:1', channel: 'linkedin' });
  const vs = R.variants(r.changed ? r.layout : L, copy, {}, { format: '1:1', channel: 'linkedin', allowNoImagery: true });
  return { repaired: r.ok, after: window.__blocking(r.after), passing: vs.filter(x => x.ok && !x.pending.length).map(x => x.name) };
});
ok(!vari.repaired, '5. reproduced: Fix layout cannot clear words painted over by a locked opaque block: ' + JSON.stringify(vari.after));
ok(vari.passing.length > 0, '5. a measured layout variation passes (what the demonstration now takes before giving up): ' + JSON.stringify(vari.passing));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
