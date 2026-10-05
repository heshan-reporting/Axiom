/* Mark readability per pixel (S11), in real Chromium with docs/studio-render.js: a white wordmark that straddles a cream panel
 * and a dark green footer, at several boundary positions; dark and multicolour marks on mixed grounds; transparent padding,
 * rotation and scale; strokes painted over by a later layer; clear space, a placement region and the intentional-layering
 * exception; a repair that fixes the geometry but cannot fix a locked unreadable text; the repair that moves the mark into the
 * footer; the panel extension when a rule holds the mark; the quality states; and double styling. Every expected figure is
 * computed from the fixture's GEOMETRY (where the bars of the synthetic mark fall against the boundary), not from the validator,
 * and the rendered pixels are read back where the claim is about pixels. Everything drawn is SYNTHETIC. No model is called.
 * Run: node --experimental-sqlite tests/studio-marks-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
import { HOOF_STRADDLE, HOOF_STRADDLE_COPY, BARS_SCRIPT, BARS_INK, PHOTO_FOOTER_SCRIPT } from './fixtures/studio-layouts.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const ctx = await browser.newContext(); const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });
await page.addScriptTag({ content: `window.__img = { white: ${BARS_SCRIPT('#FFFFFF')}, black: ${BARS_SCRIPT('#111111')}, redwhite: ${BARS_SCRIPT(['#D7263D', '#FFFFFF'])}, blue: ${BARS_SCRIPT('#1F5FA8')}, photo: ${PHOTO_FOOTER_SCRIPT}, flat: (() => { const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d'); x.fillStyle = '#F2EBDD'; x.fillRect(0, 0, 1080, 1350); return c.toDataURL('image/png'); })() };
  window.__load = async () => { const R = window.STRender; const o = {}; for (const k of Object.keys(window.__img)) o[k] = await R.loadImage(window.__img[k]); return o; };
  window.__codes = v => v.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(','));` });

const W = 1080, H = 1350; const FOOTER_Y = 0.86 * H;   // the live footer shape starts at 86% of the stage
/* the ink of the BARS mark as drawn by contain() inside a layer box (per cent of the stage): the drawn rectangle, then the bar rows
   in stage pixels; from those the share of ink above a horizontal boundary is plain arithmetic */
function barsInk(l) {
  const bx = l.x / 100 * W, by = l.y / 100 * H, bw = l.w / 100 * W, bh = l.h / 100 * H;
  const s = Math.min(bw / BARS_INK.w, bh / BARS_INK.h); const dw = BARS_INK.w * s, dh = BARS_INK.h * s; const dx = bx + (bw - dw) / 2, dy = by + (bh - dh) / 2;
  const rows = BARS_INK.rows.map(([a, b]) => [dy + a * s, dy + b * s]); const x0 = dx + BARS_INK.x0 * s, x1 = dx + BARS_INK.x1 * s;
  return { rows, x0, x1, s, dx, dy, dw, dh };
}
const shareAbove = (l, yB) => { const ink = barsInk(l); let above = 0, all = 0; ink.rows.forEach(([a, b]) => { all += b - a; above += Math.max(0, Math.min(b, yB) - a); }); return above / all; };
const L0 = JSON.parse(JSON.stringify(HOOF_STRADDLE)); const C0 = HOOF_STRADDLE_COPY;
const withMark = (patch, extra) => { const L = JSON.parse(JSON.stringify(L0)); const mk = L.layers.find(l => l.id === 'wordmark'); Object.assign(mk, patch || {}); if (extra) extra(L); return L; };
const measureMark = async (L, C, imgKey, opts) => page.evaluate(async ({ L, C, imgKey, opts }) => {
  const R = window.STRender; const im = await window.__load(); const images = Object.assign({ wordmark: im[imgKey] }, opts && opts.photo ? { bg: im.photo } : {});
  const v = R.validate(L, C, images, Object.assign({ format: '4:5', channel: 'instagram' }, (opts && opts.v) || {}));
  const b = v.boxes.find(x => x.id === 'wordmark');
  return { ok: v.ok, codes: window.__codes(v), unresolved: v.unresolved || null, b: b ? { inkLost: b.inkLost, inkWeak: b.inkWeak, inkLocal: b.inkLocal, inkRun: b.inkRun, inkWhere: b.inkWhere, inkBoundary: b.inkBoundary, inkCovered: b.inkCovered, inkN: b.inkN, multicolour: b.multicolour, contrast: b.contrast, x: b.x, y: b.y, w: b.w, h: b.h, clearWant: b.clearWant } : null, quality: R.qualityOf(v) };
}, { L, C, imgKey, opts: opts || {} });

/* ------------------------------------------------------------------ 1. the straddling wordmark at several boundary positions */
section('1. a white wordmark across a cream panel and a dark green footer: the share of ink lost equals the share of ink above the boundary');
{
  // the reconstruction as reported: box y 81.5-90.5%, the upper bar on cream, the lower on green
  const rep = await measureMark(L0, C0, 'white'); const want = shareAbove(L0.layers.find(l => l.id === 'wordmark'), FOOTER_Y);
  ok(rep.b && near(rep.b.inkLost, want, 0.05), 'as reported: ' + Math.round(want * 100) + '% of the ink lies on the cream by geometry; measured lost ' + Math.round((rep.b.inkLost || 0) * 100) + '% (' + rep.b.inkN + ' stroke samples)');
  ok(rep.codes.some(c => c.startsWith('mark_unreadable/blocking:wordmark')), 'and the rule blocks it: ' + rep.codes.filter(c => /mark/.test(c)).join('; '));
  ok(rep.b.inkBoundary === true && rep.b.inkWhere === 'upper part', 'the finding names the split ground and the part that is lost (' + rep.b.inkWhere + ', boundary ' + rep.b.inkBoundary + ')');
  ok(!rep.ok && rep.quality.state === 'blocked' && rep.quality.word === 'Blocked', 'the quality state is Blocked, not a reassuring pass');
  // the average that used to decide: the ground under the box is half cream, half green, which a mean contrast passes
  ok(typeof rep.b.contrast === 'number' && rep.b.contrast > 1.6, 'the mean contrast alone would not have blocked it (' + rep.b.contrast + ':1): the per-pixel share is what decides');
  // several positions: the lost share follows the geometry; wholly in the footer it reads; wholly on cream it is all lost
  const results = [];
  for (const y of [78, 80, 81.5, 83, 84.5, 86.5, 89]) { const L = withMark({ y }); const r = await measureMark(L, C0, 'white'); const want2 = shareAbove(L.layers.find(l => l.id === 'wordmark'), FOOTER_Y); results.push({ y, want: want2, got: r.b.inkLost, codes: r.codes.filter(c => /^mark_(unreadable|low_contrast)/.test(c)).map(c => c.split('/')[1].split(':')[0]) }); }
  ok(results.every(r => near(r.got, r.want, 0.05)), 'every position matches its geometric share within 5 points: ' + results.map(r => 'y' + r.y + ' want ' + Math.round(r.want * 100) + ' got ' + Math.round(r.got * 100)).join(', '));
  ok(results.filter(r => r.want >= 0.12).every(r => r.codes[0] === 'blocking') && results.filter(r => r.want === 0).every(r => !r.codes.length), 'blocking wherever 12% or more of the ink is lost; silent where every stroke sits on the footer');
  const ten = withMark({ y: 83.75 }); const r10 = await measureMark(ten, C0, 'white'); const w10 = shareAbove(ten.layers.find(l => l.id === 'wordmark'), FOOTER_Y);
  ok(w10 > 0.04 && w10 < 0.3 && r10.codes.some(c => /^mark_(unreadable\/blocking|low_contrast\/warning)/.test(c)), 'a mark with ' + Math.round(w10 * 100) + '% of its ink over the cream is not passed in silence: ' + r10.codes.filter(c => /mark/.test(c)).join('; ') + ' (the old average passed 10% at 6.06:1 with no issue)');
}

/* ------------------------------------------------------------------ 2. dark and multicolour marks; padding, rotation, scale */
section('2. dark and multicolour marks on mixed grounds; transparent padding, rotation and scale');
{
  // a black wordmark in the same place over a near-black footer (#14281C: 1.19:1 by WCAG arithmetic; on the #1E5B3A green it would
  // be 2.35:1, weak rather than lost): the part on the footer is lost, the part on cream reads
  const L = withMark({ y: 81.5 }, L2 => { L2.layers.find(l => l.id === 'footer').fill = '#14281C'; }); const r = await measureMark(L, C0, 'black'); const below = 1 - shareAbove(L.layers.find(l => l.id === 'wordmark'), FOOTER_Y);
  ok(near(r.b.inkLost, below, 0.05) && r.b.inkWhere === 'lower part', 'black mark: ' + Math.round(below * 100) + '% of its ink is on the footer by geometry, measured lost ' + Math.round(r.b.inkLost * 100) + '%, named as the ' + r.b.inkWhere);
  // a red-and-white mark on a red panel: the red half vanishes, the white half reads; an average of the two colours would call it pink on red
  const Lr = withMark({ y: 50, x: 30, w: 40, h: 10 }, L2 => { L2.layers.find(l => l.id === 'panel').fill = '#D7263D'; L2.layers.filter(l => l.type === 'text' && l.id !== 'url').forEach(l => { l.hidden = true; }); });
  const rr = await measureMark(Lr, C0, 'redwhite');
  ok(rr.b.multicolour === true && near(rr.b.inkLost, 0.5, 0.06) && rr.b.inkWhere === 'left part', 'multicolour mark: half its ink (the red half, on red) is lost - ' + Math.round(rr.b.inkLost * 100) + '%, the ' + rr.b.inkWhere + '; the mark is read colour by colour, never averaged');
  ok(rr.codes.some(c => c.startsWith('mark_unreadable/blocking')), 'and that blocks: ' + rr.codes.filter(c => /mark/.test(c)).join('; '));
  // padding: the ink of the bars mark sits inside a box whose top crosses the cream, but the strokes themselves are all on the footer
  const Lp = withMark({ y: 85, h: 12, w: 20 }); const ip = barsInk(Lp.layers.find(l => l.id === 'wordmark'));
  const rp = await measureMark(Lp, C0, 'white');
  ok(ip.rows[0][0] >= FOOTER_Y && rp.b.inkLost < 0.02 && !rp.codes.some(c => /^mark_(unreadable|low_contrast)/.test(c)), 'transparent padding is not ink: a box that crosses the boundary with every stroke on the footer reads (lost ' + Math.round(rp.b.inkLost * 100) + '%)');
  // rotation: the mark turned a quarter turn, its bars become columns; the lost share still follows the turned geometry
  const Lrot = withMark({ x: 70, y: 74, w: 24, h: 24, rotate: 90 }); const rrot = await measureMark(Lrot, C0, 'white');
  // turned 90 degrees about the box centre, the bars run top to bottom; the boundary at 86% cuts both bars at the same height
  const cy = (74 + 12) / 100 * H; const half = (barsInk(Lrot.layers.find(l => l.id === 'wordmark')).x1 - barsInk(Lrot.layers.find(l => l.id === 'wordmark')).x0) / 2; const wantRot = Math.max(0, Math.min(1, (FOOTER_Y - (cy - half)) / (2 * half)));
  ok(near(rrot.b.inkLost, wantRot, 0.06) && /left|right|upper/.test(rrot.b.inkWhere || ''), 'rotated mark: ' + Math.round(wantRot * 100) + '% of the turned ink is above the boundary by geometry, measured lost ' + Math.round(rrot.b.inkLost * 100) + '%');
  // scale: the same relative placement at half the size gives the same share
  const Ls = withMark({ x: 70, y: 83.75, w: 16, h: 4.5 }); const rs = await measureMark(Ls, C0, 'white'); const ws = shareAbove(Ls.layers.find(l => l.id === 'wordmark'), FOOTER_Y);
  ok(near(rs.b.inkLost, ws, 0.06), 'a half-size mark in the same relative place: want ' + Math.round(ws * 100) + '%, got ' + Math.round(rs.b.inkLost * 100) + '%');
}

/* ------------------------------------------------------------------ 3. cover by a later layer, clear space, region, the exception */
section('3. strokes painted over by a later layer, clear space, a placement region and the intentional-layering exception');
{
  // a later opaque panel over the lower bar: those strokes are lost (covered), and the finding says so
  const Lc = withMark({ y: 87, h: 9 }, L2 => { L2.layers.push({ id: 'badge', type: 'shape', role: 'device', shape: 'rect', x: 60, y: 92, w: 40, h: 8, fill: '#000000', opacity: 1, radius: 0 }); });
  const rc = await measureMark(Lc, C0, 'white'); const ink = barsInk(Lc.layers.find(l => l.id === 'wordmark')); const covered = ink.rows.reduce((s, [a, b]) => s + Math.max(0, b - Math.max(a, 0.92 * H)), 0) / ink.rows.reduce((s, [a, b]) => s + (b - a), 0);
  ok(near(rc.b.inkCovered, covered, 0.06) && rc.b.inkLost >= rc.b.inkCovered - 0.01, 'covered strokes count as lost: ' + Math.round(covered * 100) + '% under the later badge by geometry, measured covered ' + Math.round(rc.b.inkCovered * 100) + '%, lost ' + Math.round(rc.b.inkLost * 100) + '%');
  ok(rc.codes.some(c => c.startsWith('mark_unreadable/blocking')) && rc.codes.some(c => c.startsWith('occluded/')), 'blocked, and the occlusion is named too: ' + rc.codes.filter(c => /mark|occl/.test(c)).join('; '));
  // the named exception: the layering is intentional, so the covering layer is left out of the readability and the occlusion
  const Le = JSON.parse(JSON.stringify(Lc)); Le.layers.find(l => l.id === 'wordmark').overlaps = ['badge']; const re = await measureMark(Le, C0, 'white');
  ok((re.b.inkCovered || 0) < 0.02 && !re.codes.some(c => c.startsWith('occluded/')), 'with the badge named as an intentional overlap, its cover is not counted (covered ' + Math.round((re.b.inkCovered || 0) * 100) + '%)');
  // clear space: the URL moved to within 8 px of the mark's ink; the house default asks for half the mark's height
  // (the URL is right-aligned so its measured words, not its box, end about 11 px from the mark's first stroke at 546 px)
  const Lcs = withMark({ y: 88, x: 50, w: 32, h: 9 }, L2 => { const u = L2.layers.find(l => l.id === 'url'); u.x = 6; u.w = 43.5; u.y = 91.5; u.align = 'right'; });
  const rcs = await measureMark(Lcs, C0, 'white');
  ok(rcs.codes.some(c => c.startsWith('mark_clear_space/warning')), 'words too close to the mark are a clear-space warning by default: ' + rcs.codes.filter(c => /clear/.test(c)).join('; '));
  const Lcm = JSON.parse(JSON.stringify(Lcs)); Lcm.layers.find(l => l.id === 'wordmark').rule = { corner: 'br', mandatory: true, clearSpace: 0.5, basis: 'rule', note: 'HOOF clear space' }; const rcm = await measureMark(Lcm, C0, 'white');
  ok(rcm.codes.some(c => c.startsWith('mark_clear_space/blocking')), 'and blocking when the campaign rule makes the clear space mandatory');
  const Lex = JSON.parse(JSON.stringify(Lcm)); Lex.layers.find(l => l.id === 'wordmark').overlaps = ['url']; const rex = await measureMark(Lex, C0, 'white');
  ok(!rex.codes.some(c => c.startsWith('mark_clear_space')), 'a named exception (intentional layering with the URL) suppresses the clear-space finding for that pair only');
  // a placement region: the rule allows the footer band only; a mark above it is outside the region
  const Lreg = withMark({ y: 81.5, rule: { region: { x: 0, y: 86, w: 100, h: 14 }, mandatory: true, basis: 'rule', note: 'the footer band' } }); const rreg = await measureMark(Lreg, C0, 'white');
  ok(rreg.codes.some(c => c.startsWith('mark_outside_region/blocking')), 'a mark outside the rule\'s region is named: ' + rreg.codes.filter(c => /region/.test(c)).join('; '));
  const Lin = withMark({ y: 88.5, h: 9, rule: { region: { x: 0, y: 86, w: 100, h: 14 }, mandatory: true, basis: 'rule' } }); const rin = await measureMark(Lin, C0, 'white');
  ok(!rin.codes.some(c => c.startsWith('mark_outside_region')) && !rin.codes.some(c => c.startsWith('mark_unreadable')), 'inside the region, on the footer, nothing about the mark is raised');
}

/* ------------------------------------------------------------------ 4. the repair: the smallest local move, the panel extension, and honest completion */
section('4. repair: the mark moves into the footer; a held mark has its panel extended; completion is judged on everything, so a locked unreadable text is never "fixed"');
const rep = await page.evaluate(async ({ L0, C0 }) => {
  const R = window.STRender; const im = await window.__load(); const o = { format: '4:5', channel: 'instagram', fixContrast: true };
  const out = {};
  // (a) the reported tile: the wordmark is moved down into the footer, nothing else about it changes
  const IM = { wordmark: im.white, bg: im.photo }; const a = R.repair(L0, C0, IM, o); const mkA = a.layout.layers.find(l => l.id === 'wordmark'); const mk0 = L0.layers.find(l => l.id === 'wordmark');
  const aAfter = a.after.boxes.find(b => b.id === 'wordmark');
  out.a = { outcome: a.outcome, ok: a.ok, steps: a.steps, moved: mkA.y > mk0.y, sameX: mkA.x === mk0.x, sameSize: mkA.w === mk0.w && mkA.h === mk0.h, src: mkA.src === mk0.src, lostAfter: aAfter && aAfter.inkLost, markCodes: a.after.issues.filter(i => /mark/.test(i.code)).map(i => i.code + '/' + i.severity), kinds: a.kinds, counts: a.counts, remaining: a.remaining.blocking.map(i => i.code) };
  // (b) the same tile with the mark held bottom-right by a mandatory corner rule: the footer panel is extended to carry it instead
  const Lb = JSON.parse(JSON.stringify(L0)); const mb = Lb.layers.find(l => l.id === 'wordmark'); mb.rule = { corner: 'br', mandatory: true, note: 'held by the rule' };
  const b = R.repair(Lb, C0, IM, o); const fb = b.layout.layers.find(l => l.id === 'footer'); const mkB = b.layout.layers.find(l => l.id === 'wordmark');
  out.b = { outcome: b.outcome, steps: b.steps, markSame: mkB.x === mb.x && mkB.y === mb.y, footerY: fb.y, footerWas: Lb.layers.find(l => l.id === 'footer').y, lostAfter: (b.after.boxes.find(x => x.id === 'wordmark') || {}).inkLost, conflict: b.conflict };
  // (c) the mark fixable, but a locked text that does not read: the outcome must not be "complete"
  const Lc = JSON.parse(JSON.stringify(L0)); const u = Lc.layers.find(l => l.id === 'url'); u.y = 83; u.color = '#F2EBDD'; u.locked = true;   // cream words on the cream panel, clear of the CTA, locked
  const c = R.repair(Lc, C0, IM, o);
  out.c = { outcome: c.outcome, ok: c.ok, changed: c.changed, kinds: c.kinds, counts: c.counts, remaining: c.remaining.blocking.map(i => i.code + ':' + i.layers.join(',')), conflict: c.conflict, steps: c.steps };
  // (d) nothing to fix is said only when nothing is wrong
  const Ld = JSON.parse(JSON.stringify(L0)); Ld.layers.find(l => l.id === 'wordmark').y = 88.5; Ld.layers.find(l => l.id === 'wordmark').h = 9;
  const d = R.repair(Ld, C0, IM, o); out.d = { outcome: d.outcome, ok: d.ok, changed: d.changed, before: d.before.ok };
  // (e) an off-canvas mark that can be repositioned plus the locked unreadable text: geometry corrected, readability not
  const Le = JSON.parse(JSON.stringify(Lc)); Le.layers.find(l => l.id === 'wordmark').y = 96;
  const e = R.repair(Le, C0, IM, o); out.e = { outcome: e.outcome, ok: e.ok, before: e.counts.before, after: e.counts.after, kinds: e.kinds, steps: e.steps, remaining: e.remaining.blocking.map(i => i.code) };
  return out;
}, { L0, C0 });
ok(rep.a.outcome === 'complete' && rep.a.ok && rep.a.moved && rep.a.sameX && rep.a.sameSize && rep.a.src, '(a) the wordmark is moved down into the footer, same x, same size, same file: ' + rep.a.steps.join('; '));
ok(rep.a.lostAfter < 0.04 && !rep.a.markCodes.length, '(a) after the move every stroke reads (lost ' + Math.round(rep.a.lostAfter * 100) + '%) and no mark finding remains');
ok(rep.b.markSame && rep.b.footerY < rep.b.footerWas && rep.b.lostAfter < 0.04 && /extended the footer/.test(rep.b.steps.join(' ')), '(b) a mark held by the campaign rule stays; the footer is extended up to carry it (' + rep.b.footerWas + '% to ' + rep.b.footerY + '%): ' + rep.b.steps.join('; '));
ok(rep.c.outcome !== 'complete' && !rep.c.ok && rep.c.kinds.readability >= 1 && rep.c.remaining.some(x => /contrast.*url|url/.test(x)), '(c) a locked unreadable text keeps the outcome at "' + rep.c.outcome + '", never fixed; readability remaining: ' + rep.c.remaining.join(', '));
ok(/Locked layers stop the fix/.test(rep.c.conflict), '(c) and the conflict names the lock: ' + rep.c.conflict.slice(0, 120));
ok(rep.d.outcome === 'nothing' && rep.d.before && !rep.d.changed, '(d) "nothing to fix" only when the tile already passes');
ok(rep.e.outcome === 'partial' && !rep.e.ok && rep.e.kinds.geometry === 0 && rep.e.kinds.readability >= 1 && rep.e.after < rep.e.before, '(e) off-canvas mark fixed, locked unreadable text not: "' + rep.e.outcome + '" (' + rep.e.before + ' blocking before, ' + rep.e.after + ' after; geometry ' + rep.e.kinds.geometry + ', readability ' + rep.e.kinds.readability + ')');

/* ------------------------------------------------------------------ 5. the bitmap footer: evidence, not knowledge */
section('5. when the footer is painted into the bitmap, the region is pixel evidence with a confidence, offered and never applied');
{
  const Lbm = JSON.parse(JSON.stringify(L0)); Lbm.layers = Lbm.layers.filter(l => l.id !== 'footer' && l.id !== 'panel'); Lbm.layers.filter(l => l.type === 'text' && l.id !== 'url').forEach(l => { l.color = '#14281C'; });
  const r = await page.evaluate(async ({ L, C }) => { const R = window.STRender; const im = await window.__load(); const v = R.validate(L, C, { bg: im.photo, wordmark: im.white }, { format: '4:5' }); const reg = R.markRegion(L, C, { bg: im.photo, wordmark: im.white }, 'wordmark'); return { codes: window.__codes(v), lost: v.boxes.find(b => b.id === 'wordmark').inkLost, reg }; }, { L: Lbm, C: C0 });
  ok(r.codes.some(c => c.startsWith('mark_unreadable/blocking')) && r.lost > 0.3, 'over the bitmap the same straddle is caught (lost ' + Math.round(r.lost * 100) + '%)');
  ok(r.reg && near(r.reg.y, 86, 1) && r.reg.h >= 13 && r.reg.confidence > 0 && r.reg.confidence < 1 && /pixel evidence|confidence/.test(r.reg.note), 'the flat dark band under the mark is found from the pixels: y ' + r.reg.y + '%, h ' + r.reg.h + '%, confidence ' + r.reg.confidence + ' - ' + r.reg.note);
}

/* ------------------------------------------------------------------ 6. double styling and the quality states */
section('6. the CTA: a filled chip with a box emphasis is one device drawn around the plate, and named; the quality states');
{
  const r = await page.evaluate(async ({ L, C }) => {
    const R = window.STRender; const im = await window.__load(); const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); R.draw(x, W, H, L, C, { wordmark: im.white, bg: im.photo });
    const boxes = R.measure(L, C, { wordmark: im.white, bg: im.photo }, W, H); const cta = boxes.find(b => b.id === 'cta'); const l = L.layers.find(z => z.id === 'cta');
    // the plate's right edge from the measured box; any green stroke to the right of it inside the layer box would be the wider outline
    const d = x.getImageData(0, 0, W, H).data; const lx = l.x / 100 * W, lw = l.w / 100 * W; const plateRight = cta.x + cta.w; let strokeBeyond = 0;
    for (let yy = Math.floor(cta.y + 2); yy < Math.floor(cta.y + cta.h - 2); yy += 2) for (let xx = Math.ceil(plateRight + 6); xx < lx + lw - 2; xx += 2) { const k = (yy * W + xx) * 4; if (Math.abs(d[k] - 0x1E) < 12 && Math.abs(d[k + 1] - 0x5B) < 12 && Math.abs(d[k + 2] - 0x3A) < 12) strokeBeyond++; }
    const v = R.validate(L, C, { wordmark: im.white, bg: im.photo }, { format: '4:5' });
    const Lq = JSON.parse(JSON.stringify(L)); Lq.layers.find(z => z.id === 'wordmark').y = 88.5; Lq.layers.find(z => z.id === 'wordmark').h = 9; const vq = R.validate(Lq, C, { wordmark: im.white, bg: im.photo }, { format: '4:5' });
    const Lw = JSON.parse(JSON.stringify(Lq)); Lw.layers.find(z => z.id === 'cta').emphasis = undefined; Lw.layers.find(z => z.id === 'url').size = 2.4; Lw.layers.find(z => z.id === 'label').size = 2.4; Lw.layers.find(z => z.id === 'headline').y = 54; const vw = R.validate(Lw, C, { wordmark: im.white, bg: im.flat }, { format: '4:5' });   // a flat ground: the synthetic photograph's gradient reads as a covered subject, a true warning about that fixture
    return { plateW: cta.w, boxW: lw, strokeBeyond, codes: window.__codes(v).filter(cc => /double/.test(cc)), q: R.qualityOf(v), q2: R.qualityOf(vq), q2codes: window.__codes(vq), q3: R.qualityOf(vw), q3codes: window.__codes(vw) };
  }, { L: L0, C: C0 });
  ok(r.plateW < r.boxW - 10 && r.strokeBeyond === 0, 'the CTA plate is narrower than its layer box (' + Math.round(r.plateW) + ' vs ' + Math.round(r.boxW) + ' px) and no outline is painted beyond the plate: the wide outline is not in the artwork');
  ok(r.codes.length === 1 && /double_styling\/warning/.test(r.codes[0]), 'plate plus box emphasis is named as double styling: ' + r.codes.join(', '));
  ok(r.q.state === 'blocked' && r.q2.state === 'review' && r.q2.warnings >= 1 && r.q2.blocking === 0, 'quality: Blocked while the mark fails; Needs review once only warnings remain (' + r.q2codes.join(', ') + ')');
  ok(r.q3.state === 'passed' && r.q3.word === 'Checks passed', 'and Checks passed when every applicable check passes (' + (r.q3codes.join(', ') || 'no issues') + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
await browser.close();
process.exit(fail ? 1 : 0);
