/* Fix layout that does the work (the 24 November report: on an Instagram portrait the call to action and the source line collide
 * in the lower band; Fix layout answered "Geometry alone cannot fit the words ... Shorter copy for the headline (about 27
 * characters instead of 36)" and saved nothing, while 9 of the 9 layout variations of the same tile passed). In real Chromium
 * with docs/studio-render.js; everything drawn is SYNTHETIC and no model is called.
 *   FX1 the reported tile: Fix layout clears it by moving the CTA, whole, to the nearest free place; nothing shrinks,
 *       no word changes, and the result passes the complete validation (it used to stop at "Geometry alone cannot fit")
 *   FX2 when words still cannot be fitted, the copy it suggests shortening is one of the layers that still block, never a
 *       headline the collision is not about
 *   FX3 nearestVariant picks the passing arrangement closest to the current one, keeps the photograph (never type-only unless the
 *       tile already has none) and says how far it moved; with nothing passing it answers null
 *   FX4 a locked layer is never moved by the fallback: with the headline locked no arrangement is offered
 * Run: node --experimental-sqlite tests/studio-fixlayout-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });

const SRC = 'Natural gas supports around 215,000 jobs across Australia.\nBehind every major industry are the people who keep Australia moving.\nLearn more at australiarunsongas.com.au\nSource: KPMG, The Australian Gas Industry\'s Economic Contribution, 2025.\nAuthorised by S McCulloch, Australian Energy Producers Ltd, Canberra.';
const COPY = { headline: 'The people who keep Australia moving', support: 'Natural gas supports around 215,000 jobs across Australia.', cta: 'Learn more' };
// the reported tile, reconstructed: a big headline over the photograph, the support line, a light band at the foot holding the
// source paragraphs and a button that runs into them
const tile = over => { const L = { v: 5, stage: { w: 1080, h: 1350 }, bg: '#3a3430', layers: [
  { id: 'band', type: 'shape', shape: 'rect', role: 'panel', x: 0, y: 72, w: 100, h: 28, fill: '#EDEAE4' },
  { id: 'headline', type: 'text', role: 'headline', x: 6, y: 2, w: 60, h: 25, size: 10, weight: 800, color: '#FFFFFF' },
  { id: 'support', type: 'text', role: 'support', x: 6, y: 47, w: 60, h: 8, size: 5, weight: 700, color: '#FFFFFF' },
  { id: 'source', type: 'text', role: 'caption', text: SRC, x: 6, y: 74, w: 88, h: 22, size: 3, lineHeight: 1.5, color: '#333333' },
  { id: 'cta', type: 'text', role: 'cta', x: 6, y: 88, w: 14, h: 5, size: 2.4, weight: 700, color: '#FFFFFF', bg: '#0B5C6B' }] };
  (over || []).forEach(([id, p]) => Object.assign(L.layers.find(l => l.id === id), p)); return L; };
const run = L => page.evaluate(({ L, C }) => {
  const S = window.STRender, o = { format: '4:5', channel: 'instagram' };
  const r = S.repair(L, C, {}, Object.assign({ fixContrast: true }, o)); const vs = S.variants(L, C, {}, Object.assign({ locks: {} }, o));
  const near = S.nearestVariant ? S.nearestVariant(L, vs) : undefined;
  const after = near && near.variant ? S.validate(near.variant.layout, C, {}, o) : null;
  const pick = id => { const l = r.layout.layers.find(x => x.id === id); return l && { x: l.x, y: l.y, w: l.w, size: l.size }; };
  return { outcome: r.outcome, conflict: r.conflict || '', steps: r.steps, cta: pick('cta'), source: pick('source'), blocking: r.after.issues.filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(',')),
    vars: vs.map(x => ({ id: x.id, ok: x.ok, typeOnly: x.typeOnly })), near: near === undefined ? 'missing' : near && { id: near.variant.id, name: near.variant.name, typeOnly: near.variant.typeOnly, distance: near.distance, moved: near.moved },
    afterOk: after ? after.ok : null, words: near && near.variant ? near.variant.layout.layers.filter(l => l.type === 'text').map(l => l.text || '') : null };
}, { L, C: COPY });

section('FX1 the reported tile: Fix layout moves the CTA to free space; the source stays in the band; nothing else changes its words');
const base = await run(tile());
ok(base.outcome === 'complete' && !base.blocking.length, 'Fix layout clears the tile: ' + base.outcome + ' ' + base.blocking.join(' | ') + ' ' + base.conflict);
ok(base.steps.some(t => /moved the cta out of the way of the caption, to the nearest free place/.test(t)), 'and says what it moved: ' + base.steps.join(' | '));
ok(base.cta && base.source && base.source.size >= 3 && (base.cta.x >= base.source.x + base.source.w || base.cta.y + 6.3 <= base.source.y || base.cta.y >= base.source.y + 15), 'the CTA sits clear of the source, and the source kept its size (cta at ' + JSON.stringify(base.cta) + ', source at ' + JSON.stringify(base.source) + ')');
ok(base.cta && base.cta.w === 14 && base.cta.size === 2.4, 'the CTA kept its width and size');
ok(base.vars.filter(x => x.ok).length >= 2, 'arrangements of the same words also pass, for the cases a move cannot clear (' + base.vars.filter(x => x.ok).length + ' of ' + base.vars.length + ')');

section('FX2 when words still cannot be fitted, the copy to shorten is one of the layers that still block');
for (const [hs, ss, sz] of [[14, 8, 4.5], [16, 9, 5]]) {
  const dense = await page.evaluate(({ L, C }) => { const r = window.STRender.repair(L, C, {}, { format: '16:9', channel: 'x', fixContrast: true }); return { conflict: r.conflict || '', ids: r.after.issues.filter(i => i.severity === 'blocking').reduce((a, i) => a.concat(i.layers), []), roles: r.layout.layers.reduce((m, l) => (m[l.id] = l.role, m), {}) }; },
    { L: Object.assign(tile([['headline', { size: hs, w: 88 }], ['support', { size: ss, w: 88 }], ['source', { size: sz }], ['cta', { w: 88 }]]), { stage: { w: 1200, h: 675 } }), C: COPY });
  const m = dense.conflict.match(/Shorter copy for the (\w+)/);
  ok(!m || dense.ids.some(id => dense.roles[id] === m[1]), 'a ' + hs + '% headline on 16:9: ' + (m ? 'it suggests shortening the ' + m[1] + ', one of the blocking layers (' + dense.ids.join(', ') + ')' : 'no copy to shorten is named') + ': ' + dense.conflict.slice(0, 160));
}
const base2 = await page.evaluate(({ L, C }) => { const S = window.STRender; const r = S.repair(L, C, {}, { format: '4:5', channel: 'instagram', fixContrast: true }); return { conflict: r.conflict || '' }; }, { L: tile(), C: COPY });
ok(!/Shorter copy for the headline/.test(base2.conflict), 'the reported tile is never told to shorten its headline: ' + (base2.conflict || 'no conflict'));

section('FX3 the nearest passing arrangement: closest to the current one, the photograph kept, the distance said');
ok(base.near !== 'missing', 'STRender.nearestVariant exists');
ok(base.near && base.afterOk === true, 'it is an arrangement that passes the full validation: ' + JSON.stringify(base.near));
ok(base.near && !base.near.typeOnly, 'it keeps the photograph (not the type-only arrangement) on a tile that has one');
ok(base.near && typeof base.near.distance === 'number' && base.near.moved >= 1, 'and says how far it moved and how many layers (' + JSON.stringify(base.near) + ')');
const pick = await page.evaluate(() => {
  const L = { layers: [{ id: 'a', x: 10, y: 10, w: 20, h: 10 }] };
  const list = [{ id: 'far', ok: true, layout: { layers: [{ id: 'a', x: 60, y: 70, w: 20, h: 10 }] } }, { id: 'near', ok: true, layout: { layers: [{ id: 'a', x: 12, y: 10, w: 20, h: 10 }] } },
    { id: 'nearest-but-failing', ok: false, layout: { layers: [{ id: 'a', x: 10, y: 10, w: 20, h: 10 }] } }, { id: 'type', ok: true, typeOnly: true, layout: { layers: [{ id: 'a', x: 10, y: 10, w: 20, h: 10 }] } }];
  const S = window.STRender; const r = S.nearestVariant(L, list); const none = S.nearestVariant(L, [list[2]]); const typeOk = S.nearestVariant(Object.assign({ noImagery: true }, L), [list[3], list[0]]);
  return { r: r && r.variant.id, none, typeOk: typeOk && typeOk.variant.id };
});
ok(pick.r === 'near', 'of two passing arrangements the closer is chosen, a failing one never (' + pick.r + ')');
ok(pick.none === null, 'nothing passing answers null');
ok(pick.typeOk === 'type', 'type-only is allowed when the tile already has no photograph (' + pick.typeOk + ')');
ok(base.words && base.words.some(t => /Authorised by S McCulloch/.test(t)), 'the words are the same words');

section('FX4 a locked layer is never moved: no arrangement is offered that moves it');
const locked = await page.evaluate(({ L, C }) => { const S = window.STRender; const vs = S.variants(L, C, {}, { format: '4:5', channel: 'instagram', locks: {} });
  const n = S.nearestVariant(L, vs); if (!n) return { none: true };
  const h0 = L.layers.find(l => l.id === 'headline'), h1 = n.variant.layout.layers.find(l => l.id === 'headline');
  return { none: false, same: h1 && h0.x === h1.x && h0.y === h1.y && h0.w === h1.w && h0.h === h1.h }; }, { L: tile([['headline', { locked: true }]]), C: COPY });
ok(locked.none || locked.same, 'with the headline locked, nothing offered moves it: ' + JSON.stringify(locked));

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
