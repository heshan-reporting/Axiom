/* One scene representation (S3): what the renderer draws is what it measures, hit-tests, judges and exports. Real Chromium,
 * docs/studio-render.js, synthetic imagery; no model, no network. Each case was written to fail before the change.
 *   1. local contrast: words over a ground that is dark on one side and bright on the other fail where the mean would pass
 *   2. marks are judged by their visible pixels, not their box: transparent padding is not a collision, and is reported
 *   3. a rotated mark's turned extents are what collide
 *   4. one safe-area table, read by the rules and exported for the editor and the worker
 *   5. pixel analysis that cannot run is an unresolved state, never a pass
 * Run: node --experimental-sqlite tests/studio-scene-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
import { WORDMARK_SCRIPT } from './fixtures/studio-layouts.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const ctx = await browser.newContext(); const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', async route => { const u = new URL(route.request().url()); if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }); return route.fulfill({ status: 404, body: '' }); });
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });
/* a wordmark whose ink sits in the left third of a wide transparent canvas, and a tiny one */
const PADDED = `(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 120; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.font = '900 46px sans-serif'; x.textBaseline = 'top'; x.fillText('HOOF', 8, 6); x.fillText('FUEL', 8, 60); return c.toDataURL('image/png'); })()`;
await page.addScriptTag({ content: `window.__img = { blue: ${WORDMARK_SCRIPT('#1f5fa8')}, padded: ${PADDED} };
  window.__load = async () => { const R = window.STRender; const o = {}; for (const k of Object.keys(window.__img)) o[k] = await R.loadImage(window.__img[k]); return o; };
  window.__codes = v => v.issues.filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(',')).sort();
  window.__all = v => v.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(','));` });
const BASE = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, approach: 'editable', regions: [], noImagery: true, bg: '#FFFFFF', palette: { primary: '#0E6A6E' }, marks: { policy: 'wordmark', campaign: 'hoof' }, markPlacement: { corner: 'br', basis: 'default' },
  layers: [
    { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 6, y: 50, w: 88, h: 44, fill: '#0E6A6E', opacity: 1, radius: 0 },
    { id: 'headline', type: 'text', role: 'headline', x: 10, y: 54, w: 80, h: 16, size: 6.5, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' },
    { id: 'support', type: 'text', role: 'support', x: 10, y: 74, w: 80, h: 8, size: 2.9, weight: 500, color: '#FFFFFF', align: 'left', font: 'body' },
  ] };
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.' };
const clone = o => JSON.parse(JSON.stringify(o));
const run = (L, C, imgs, o) => page.evaluate(async ({ L, C, imgs, o }) => { const R = window.STRender; const im = await window.__load(); const images = {}; Object.keys(imgs || {}).forEach(k => { images[k] = im[imgs[k]]; }); const v = R.validate(L, C, images, Object.assign({ channel: 'instagram', format: L.format }, o || {})); const rep = R.report({ layout: L, copy: C }, v); return { ok: v.ok, codes: window.__codes(v), all: window.__all(v), unresolved: v.unresolved || null, boxes: v.boxes.map(b => ({ id: b.id, contrast: b.contrast, contrastMin: b.contrastMin, markFill: b.markFill, vx: b.vx, vy: b.vy, vw: b.vw, vh: b.vh, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h), ax: Math.round(b.ax), aw: Math.round(b.aw) })), rep: rep.boxes.map(b => Object.keys(b)) }; }, { L, C, imgs, o });

section('1. local contrast: a mean can hide a bright patch under the words');
{
  // the headline spans two panels: black on the left, white on the right; white words read on one half and vanish on the other
  const L = clone(BASE); L.layers.splice(0, 1, { id: 'dark', type: 'shape', role: 'panel', shape: 'rect', x: 6, y: 50, w: 44, h: 44, fill: '#000000', radius: 0 }, { id: 'light', type: 'shape', role: 'panel', shape: 'rect', x: 50, y: 50, w: 44, h: 44, fill: '#FFFFFF', radius: 0 });
  L.layers[2].x = 8; L.layers[2].w = 84; L.layers[3].x = 8; L.layers[3].w = 84;
  const v = await run(L, COPY); const hb = v.boxes.find(b => b.id === 'headline');
  ok(typeof hb.contrastMin === 'number' && hb.contrastMin < 1.6, 'the worst local contrast is measured (' + hb.contrastMin + ':1 against the brightest patch; the mean was ' + hb.contrast + ':1)');
  ok(!v.ok && v.codes.some(c => /^patchy_contrast:headline/.test(c)), 'white words half over white fail as patchy contrast, whatever the mean (' + v.codes.join(', ') + ')');
  const v0 = await run(clone(BASE), COPY); const hb0 = v0.boxes.find(b => b.id === 'headline');
  ok(v0.ok && hb0.contrastMin >= 4.5, 'the plain teal panel is even under the words: no patchy finding (' + hb0.contrastMin + ':1 at worst)');
  ok(v.rep.find(k => k.indexOf('contrastMin') >= 0), 'the report the worker re-judges carries contrastMin');
}

section('2. a mark is its visible pixels, not its box');
{
  // the padded wordmark's box reaches far into the headline's line, but its ink stays in the left third
  const L = clone(BASE); L.layers[1].x = 40; L.layers[1].w = 54;
  L.layers.push({ id: 'wordmark', type: 'img', role: 'wordmark', x: 8, y: 56, w: 60, h: 8, src: 'padded' });
  const v = await run(L, COPY, { wordmark: 'padded' }); const mb = v.boxes.find(b => b.id === 'wordmark');
  ok(typeof mb.markFill === 'number' && mb.markFill < 0.3 && mb.vw > 0 && mb.vw < mb.aw * 0.5, 'the visible bounds are measured: ink ' + Math.round(mb.vw) + ' px wide inside a ' + mb.aw + ' px box (fill ' + mb.markFill + ')');
  ok(!v.codes.some(c => /^collision:/.test(c)), 'the transparent padding over the headline is not a collision (' + v.codes.join(', ') + ')');
  ok(v.all.some(c => /^mark_padding\/warning:wordmark/.test(c)), 'the padding is reported: the box is not the mark (' + v.all.join(', ') + ')');
  // the same box with ink across it does collide
  const L2 = clone(L); L2.layers[3].src = 'blue';
  const v2 = await run(L2, COPY, { wordmark: 'blue' }); ok(v2.codes.some(c => /^collision:headline,wordmark|^collision:wordmark,headline/.test(c)), 'a mark whose ink reaches the words collides (' + v2.codes.join(', ') + ')');
  // a mark drawn tiny is too small to read in a feed, whatever its box says
  const L3 = clone(BASE); L3.layers.push({ id: 'wordmark', type: 'img', role: 'wordmark', x: 70, y: 8, w: 24, h: 6, src: 'padded' });
  const v3 = await run(L3, COPY, { wordmark: 'padded' }); const mb3 = v3.boxes.find(b => b.id === 'wordmark');
  ok(v3.all.some(c => /^mark_small\/warning:wordmark/.test(c)), 'ink ' + Math.round(mb3.vw) + ' px wide on a 1080 stage is reported as too small to read (' + v3.all.join(', ') + ')');
}

section('3. a rotated mark collides with what its turned extents reach');
{
  const L = clone(BASE); L.layers.push({ id: 'wordmark', type: 'img', role: 'wordmark', x: 56, y: 42, w: 34, h: 9, rotate: -60, src: 'blue' });
  const v = await run(L, COPY, { wordmark: 'blue' }); const mb = v.boxes.find(b => b.id === 'wordmark');
  ok(mb.h > mb.w * 0.8, 'the turned mark is taller than it is wide (' + mb.w + ' x ' + mb.h + ' px)');
  const hb = v.boxes.find(b => b.id === 'headline');
  ok(v.codes.some(c => /collision:.*wordmark/.test(c)), 'turned 60 degrees it reaches down into the headline: a collision (' + v.codes.join(', ') + '; mark ' + JSON.stringify([mb.x, mb.y, mb.w, mb.h]) + ', headline ' + JSON.stringify([hb.x, hb.y, hb.w, hb.h]) + ')');
  const L0 = clone(L); L0.layers[3].rotate = 0; const v0 = await run(L0, COPY, { wordmark: 'blue' });
  ok(!v0.codes.some(c => /collision:.*wordmark/.test(c)), 'unturned it clears the headline (' + v0.codes.join(', ') + ')');
}

section('4. one safe-area table');
{
  const sa = await page.evaluate(() => { const R = window.STRender; return { story: R.safeArea('9:16', 'instagram'), feed: R.safeArea('1:1', 'instagram'), li: R.safeArea('9:16', 'linkedin') }; });
  ok(sa.story && sa.story.top === 0.14 && sa.story.bottom === 0.2 && sa.story.side === 0.06 && sa.story.hard === true, 'the Instagram story interface: ' + JSON.stringify(sa.story));
  ok(sa.feed && sa.feed.top === 0.03 && sa.feed.hard === false, 'the feed margin: ' + JSON.stringify(sa.feed));
  ok(sa.li && sa.li.hard === false, 'a 9:16 on another channel is not under the story interface');
  const L = clone(BASE); L.layers[1].y = 1; const v = await run(L, COPY); ok(v.all.some(c => /^safe_area\/warning:headline/.test(c)), 'a headline at 1% is inside the margin the table names (' + v.all.join(', ') + ')');
}

section('5. pixel analysis that cannot run is unresolved, never passed');
{
  await page.evaluate(() => { window.__gid = CanvasRenderingContext2D.prototype.getImageData; CanvasRenderingContext2D.prototype.getImageData = function () { throw new DOMException('tainted', 'SecurityError'); }; });
  // a later shape over the headline, so the occlusion pass has pixels to read as well
  const LU = clone(BASE); LU.layers.push({ id: 'badge', type: 'shape', role: 'device', shape: 'rect', x: 12, y: 56, w: 20, h: 6, fill: 'rgba(0,0,0,0.2)' });
  const v = await run(LU, COPY);
  ok(!v.ok && v.codes.some(c => /^pixels_unmeasured/.test(c)), 'a composition whose pixels cannot be read does not pass (' + v.codes.join(', ') + ')');
  ok(v.unresolved && v.unresolved.indexOf('contrast') >= 0 && v.unresolved.indexOf('occlusion') >= 0, 'the unresolved analyses are named: ' + JSON.stringify(v.unresolved));
  ok(v.boxes.find(b => b.id === 'headline').contrast === undefined, 'no contrast figure is invented');
  await page.evaluate(() => { CanvasRenderingContext2D.prototype.getImageData = window.__gid; });
  const v2 = await run(clone(BASE), COPY); ok(v2.ok && !v2.unresolved, 'with the pixels readable again the same tile passes');
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
