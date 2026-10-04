/* The renderer's validation against the defects a visual review found (S1, October 2026): a check must fail when the
 * pixels fail, whatever the layer list says. Real Chromium, docs/studio-render.js, synthetic imagery (tests/fixtures);
 * no model, no network. Each case was written to fail on build studio-p24-r2 and pass after the fix.
 *   1. required words at zero opacity are invisible: not a pass
 *   2. a transparent plate or panel is not a dark ground: white words on it over a white stage do not read
 *   3. an opaque shape drawn after the words covers them: not a pass
 *   4. a mark held by a mandatory campaign rule is not moved by the repair (observed placement and rule alike)
 *   plus: a mark that failed to load is unresolved, never passed; a faint layer is a warning; a rotated layer's
 *   occupied box is judged, not its unrotated one.
 * Run: node --experimental-sqlite tests/studio-quality-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
import { HOOF_REPRO, HOOF_COPY, WORDMARK_SCRIPT, PHOTO_SCRIPT } from './fixtures/studio-layouts.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const ctx = await browser.newContext(); const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', async route => {
  const u = new URL(route.request().url());
  if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' });
  if (u.pathname.startsWith('/mark/')) { if (u.searchParams.get('fail')) return route.fulfill({ status: 404, body: 'not found' }); return route.fulfill({ status: 404, body: '' }); }
  return route.fulfill({ status: 404, body: '' });
});
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });
await page.addScriptTag({ content: `window.__img = { photo: ${PHOTO_SCRIPT}, blue: ${WORDMARK_SCRIPT('#1f5fa8')}, white: ${WORDMARK_SCRIPT('#ffffff')}, black: ${WORDMARK_SCRIPT('#111111')} };
  window.__load = async () => { const R = window.STRender; const o = {}; for (const k of Object.keys(window.__img)) o[k] = await R.loadImage(window.__img[k]); return o; };
  window.__codes = v => v.issues.filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(',')).sort();
  window.__all = v => v.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(','));` });

/* a plain typographic tile: a dark panel with white words, no photograph, so every pixel is known */
const BASE = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, approach: 'editable', regions: [], noImagery: true, bg: '#FFFFFF', palette: { primary: '#0E6A6E' }, marks: { policy: 'wordmark', campaign: 'hoof' }, markPlacement: { corner: 'br', basis: 'default' },
  layers: [
    { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 6, y: 50, w: 88, h: 44, fill: '#0E6A6E', opacity: 1, radius: 0 },
    { id: 'headline', type: 'text', role: 'headline', x: 10, y: 54, w: 80, h: 16, size: 6.5, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' },
    { id: 'support', type: 'text', role: 'support', x: 10, y: 74, w: 80, h: 8, size: 2.9, weight: 500, color: '#FFFFFF', align: 'left', font: 'body' },
  ] };
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.' };
const clone = o => JSON.parse(JSON.stringify(o));
const run = (L, C, imgs, o) => page.evaluate(async ({ L, C, imgs, o }) => { const R = window.STRender; const im = await window.__load(); const images = {}; Object.keys(imgs || {}).forEach(k => { images[k] = im[imgs[k]]; }); const v = R.validate(L, C, images, Object.assign({ channel: 'instagram', format: L.format }, o || {})); return { ok: v.ok, codes: window.__codes(v), all: window.__all(v), boxes: v.boxes.map(b => ({ id: b.id, contrast: b.contrast, opacity: b.opacity, occluded: b.occluded, asset: b.asset, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) })) }; }, { L, C, imgs, o });

section('1. required words at zero opacity are invisible, not a pass');
{
  const L = clone(BASE); L.layers[1].opacity = 0;
  const v = await run(L, COPY);
  ok(!v.ok && v.codes.some(c => /^invisible:headline/.test(c)), 'a headline at opacity 0 is a blocking issue (' + v.codes.join(', ') + ')');
  const L2 = clone(BASE); L2.layers[1].opacity = 0.04;
  const v2 = await run(L2, COPY); ok(!v2.ok && v2.codes.some(c => /^invisible:headline/.test(c)), 'opacity 0.04 is invisible too (' + v2.codes.join(', ') + ')');
  const L3 = clone(BASE); L3.layers[1].opacity = 0.35;
  const v3 = await run(L3, COPY); ok(v3.all.some(c => /^faint\/warning:headline/.test(c)) && (v3.boxes.find(b => b.id === 'headline').contrast || 99) < 4.5, 'opacity 0.35 is a warning and the measured contrast is the blended one, not the colour\'s (' + v3.boxes.find(b => b.id === 'headline').contrast + ':1)');
  const L4 = clone(BASE); L4.layers.push({ id: 'wordmark', type: 'img', role: 'wordmark', x: 70, y: 8, w: 24, h: 6, opacity: 0, src: 'x' });
  const v4 = await run(L4, COPY, { wordmark: 'blue' }); ok(v4.codes.some(c => /^invisible:wordmark/.test(c)), 'an invisible mark is caught as well');
  const v0 = await run(clone(BASE), COPY); ok(v0.ok, 'the plain tile itself passes (' + v0.all.join(', ') + ')');
}

section('2. a transparent plate or panel is not a dark ground');
{
  // white words on a transparent black backing plate, over the white stage
  const L = clone(BASE); L.layers.splice(0, 1); L.layers[0].bg = 'rgba(0,0,0,0)'; L.layers[1].bg = 'rgba(0,0,0,0)';
  const v = await run(L, COPY);
  ok(!v.ok && v.codes.some(c => /^unreadable_contrast:headline/.test(c)), 'white on a fully transparent black plate over white is unreadable (' + v.boxes.find(b => b.id === 'headline').contrast + ':1; before: 21:1 from the plate colour alone)');
  // the same panel as a shape layer at opacity 0
  const L2 = clone(BASE); L2.layers[0].fill = '#000000'; L2.layers[0].opacity = 0;
  const v2 = await run(L2, COPY); ok(!v2.ok && v2.codes.some(c => /^unreadable_contrast:headline/.test(c)), 'a black panel at opacity 0 gives no ground: unreadable (' + v2.boxes.find(b => b.id === 'headline').contrast + ':1)');
  // a half-transparent plate is a half-dark ground: the contrast is the composited one
  const L3 = clone(BASE); L3.layers.splice(0, 1); L3.layers[0].bg = 'rgba(0,0,0,0.5)';
  const v3 = await run(L3, COPY); const c3 = v3.boxes.find(b => b.id === 'headline').contrast; ok(c3 > 2 && c3 < 6, 'a 50% plate reads as a mid grey ground (' + c3 + ':1), not as black');
  // a text colour with alpha: white at 20% over the teal panel is faint
  const L4 = clone(BASE); L4.layers[1].color = 'rgba(255,255,255,0.2)';
  const v4 = await run(L4, COPY); ok(v4.all.some(c => /contrast.*:headline|faint.*:headline|invisible.*:headline/.test(c)), 'a 20% white colour over the panel is caught (' + v4.all.filter(c => /headline/.test(c)).join(', ') + ')');
}

section('3. an opaque shape drawn after the words covers them');
{
  const L = clone(BASE); L.layers.push({ id: 'cover', type: 'shape', role: 'device', shape: 'rect', x: 6, y: 50, w: 88, h: 44, fill: '#0E6A6E', opacity: 1, radius: 0 });
  const v = await run(L, COPY);
  ok(!v.ok && v.codes.some(c => /^occluded:headline/.test(c)) && v.codes.some(c => /^occluded:support/.test(c)), 'words fully under a later opaque panel are occluded (' + v.codes.join(', ') + ')');
  ok(v.all.some(c => /^occluded\/blocking:headline,cover/.test(c)), 'the issue names the covering layer');
  const L2 = clone(BASE); L2.layers.push({ id: 'half', type: 'shape', role: 'device', shape: 'rect', x: 6, y: 50, w: 50, h: 44, fill: '#111111', opacity: 1, radius: 0 });
  const v2 = await run(L2, COPY); ok(v2.codes.some(c => /^occluded:headline/.test(c)), 'a shape covering the left half of the words is blocking too (' + Math.round((v2.boxes.find(b => b.id === 'headline').occluded || 0) * 100) + '% covered)');
  const L3 = clone(BASE); L3.layers.push({ id: 'circle', type: 'shape', role: 'device', shape: 'circle', x: 86, y: 52, w: 6, h: 6, fill: '#E8B23A', opacity: 1 });
  const v3 = await run(L3, COPY); ok(v3.ok || !v3.codes.some(c => /^occluded/.test(c)), 'a small dot in the corner of the box does not block (' + Math.round((v3.boxes.find(b => b.id === 'headline').occluded || 0) * 100) + '% covered; ' + v3.all.join(', ') + ')');
  const L4 = clone(BASE); L4.layers.push({ id: 'ghost', type: 'shape', role: 'device', shape: 'rect', x: 6, y: 50, w: 88, h: 44, fill: '#0E6A6E', opacity: 0.08, radius: 0 });
  const v4 = await run(L4, COPY); ok(!v4.codes.some(c => /^occluded/.test(c)), 'a nearly transparent shape over the words is not an occlusion');
  const L5 = clone(BASE); L5.layers.push({ id: 'cover', type: 'shape', role: 'device', shape: 'rect', x: 6, y: 50, w: 88, h: 44, fill: '#0E6A6E', opacity: 1, radius: 0 }); L5.layers[1].overlaps = ['cover']; L5.layers[2].overlaps = ['cover'];
  const v5 = await run(L5, COPY); ok(!v5.codes.some(c => /^occluded/.test(c)), 'an explicit overlaps exception on the covered layer allows the layering (deliberate design, named pair)');
  const L6 = clone(BASE); L6.layers.push({ id: 'photo', type: 'img', role: 'region', region: 'inset', fit: 'cover', x: 6, y: 50, w: 88, h: 44 });
  const v6 = await run(L6, COPY, { photo: 'photo' }); ok(v6.codes.some(c => /^occluded:headline/.test(c)), 'an image region drawn after the words covers them as well (' + v6.codes.join(', ') + ')');
}

section('4. the repair never moves a mark held by a mandatory campaign rule');
{
  const mk = async basis => page.evaluate(async ({ L, C, basis }) => {
    const R = window.STRender; const im = await window.__load(); const images = { bg: im.photo, wordmark: im.white };
    const T = JSON.parse(JSON.stringify(L)); const w = T.layers.find(l => l.id === 'wordmark'); w.src = w.variants[1].src;
    if (basis === 'rule') { T.markPlacement = { corner: 'br', basis: 'rule', text: 'the approved placement rule: the wordmark sits bottom right on every HOOF tile' }; w.rule = { corner: 'br', mandatory: true }; }
    else if (basis === 'observed') T.markPlacement = { corner: 'br', basis: 'observed', text: 'bottom right as in 3 references' };
    else T.markPlacement = { corner: 'br', basis: 'default' };
    // the CTA runs into the wordmark's corner
    const cta = T.layers.find(l => l.id === 'cta'); cta.x = 60; cta.w = 36; cta.y = 88.6;
    const o = { channel: 'instagram', format: '4:5' };
    const before = R.validate(T, C, images, o); const rep = R.repair(T, C, Object.assign({}, images), o); const after = R.validate(rep.layout, C, images, o);
    const w2 = rep.layout.layers.find(l => l.id === 'wordmark'); const cta2 = rep.layout.layers.find(l => l.id === 'cta');
    return { before: window.__codes(before), after: window.__codes(after), steps: rep.steps, conflict: rep.conflict, mark: { x: w2.x, y: w2.y }, mark0: { x: w.x, y: w.y }, cta: { x: cta2.x, y: cta2.y }, cta0: { x: cta.x, y: cta.y } };
  }, { L: HOOF_REPRO, C: HOOF_COPY, basis });
  const rule = await mk('rule');
  ok(rule.before.some(c => /^collision:.*(cta|wordmark)/.test(c)), 'before: the CTA collides with the wordmark (' + rule.before.join(', ') + ')');
  ok(rule.mark.x === rule.mark0.x && rule.mark.y === rule.mark0.y, 'rule: the wordmark stays where the mandatory rule puts it (' + rule.mark.x + ',' + rule.mark.y + ')' + (rule.steps.some(s => /moved the wordmark/.test(s)) ? ' - FAILED: ' + rule.steps.filter(s => /wordmark/.test(s)).join('; ') : ''));
  ok(rule.steps.some(s => /rule/.test(s)) || rule.conflict || (!rule.after.some(c => /wordmark/.test(c)) && (rule.cta.x !== rule.cta0.x || rule.cta.y !== rule.cta0.y)), 'rule: the words moved off the mark, or the repair says it left the mark for the rule, or reports the conflict (' + (rule.steps.join('; ') || rule.conflict) + '; cta ' + rule.cta0.x + ',' + rule.cta0.y + ' -> ' + rule.cta.x + ',' + rule.cta.y + ')');
  ok(!rule.after.some(c => /^collision:.*wordmark/.test(c)) || rule.conflict, 'rule: either the words moved off the mark or the conflict is reported, never a silent pass (' + rule.after.join(', ') + ')');
  const obs = await mk('observed');
  ok(obs.mark.x === obs.mark0.x && obs.mark.y === obs.mark0.y, 'observed: the wordmark stays as the references place it');
  const dflt = await mk('default');
  ok(!(dflt.mark.x === dflt.mark0.x && dflt.mark.y === dflt.mark0.y) || !dflt.after.some(c => /^collision/.test(c)), 'default: with no rule and nothing observed the repair may move the mark to a free corner (' + dflt.steps.filter(s => /wordmark/.test(s)).join('; ') + ')');
  // the layout variations keep a mandatory mark in its corner too
  const vars = await page.evaluate(async ({ L, C }) => {
    const R = window.STRender; const im = await window.__load(); const images = { bg: im.photo, wordmark: im.white };
    const T = JSON.parse(JSON.stringify(L)); const w = T.layers.find(l => l.id === 'wordmark'); w.src = w.variants[1].src; T.markPlacement = { corner: 'br', basis: 'rule', text: 'rule' }; w.rule = { corner: 'br', mandatory: true };
    return R.variants(T, C, images, { channel: 'instagram', format: '4:5' }).map(x => { const m = x.layout.layers.find(l => l.id === 'wordmark'); return { id: x.id, x: m.x, y: m.y, ok: x.ok }; });
  }, { L: HOOF_REPRO, C: HOOF_COPY });
  const moved = vars.filter(x => !(Math.abs(x.x - 71) < 6 && Math.abs(x.y - 88) < 6));
  ok(vars.length && !moved.length, 'every variation keeps the mandatory mark bottom right (' + vars.length + ' variations' + (moved.length ? '; moved: ' + moved.map(x => x.id + '@' + x.x + ',' + x.y).join(' ') : '') + ')');
}

section('5. a mark that failed to load is unresolved; a rotated layer is judged where it is drawn');
{
  const L = clone(BASE); L.layers.push({ id: 'wordmark', type: 'img', role: 'wordmark', x: 70, y: 8, w: 24, h: 6, src: 'http://studio.test/mark/x.png?fail=1' });
  const v = await page.evaluate(async ({ L, C }) => { const R = window.STRender; let err = ''; let im = null; try { im = await R.loadImage(L.layers[3].src); } catch (e) { err = e.message; } const val = R.validate(L, C, { wordmark: im }, { channel: 'instagram', format: '1:1' }); return { err, codes: window.__codes(val), asset: val.boxes.find(b => b.id === 'wordmark').asset }; }, { L, C: COPY });
  ok(/image failed/.test(v.err) && v.asset === 'missing' && v.codes.some(c => /^mark_unloaded:wordmark/.test(c)), 'a failed mark load is an unresolved, blocking state (' + v.asset + '; ' + v.codes.join(', ') + ')');
  // a label rotated 90 degrees near the right edge: upright it fits, rotated it runs off the stage
  const L2 = clone(BASE); L2.layers.push({ id: 'side', type: 'text', role: 'label', text: 'PUBLIC ROAD ENDS HERE AT THE GATE', x: 84, y: 10, w: 14, h: 30, size: 2.6, weight: 700, color: '#111111', rotate: 90 });
  const v2 = await run(L2, COPY); const b2 = v2.boxes.find(b => b.id === 'side');
  ok(b2.w > b2.h || v2.all.some(c => /:side/.test(c)), 'the rotated label\'s occupied box follows the rotation (' + b2.w + ' x ' + b2.h + ' px) or it is flagged (' + v2.all.filter(c => /side/.test(c)).join(', ') + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
