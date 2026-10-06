/* The editor's vocabulary in the one renderer (S17). Real Chromium, docs/studio-render.js, synthetic imagery; no model, no
 * network (a Google Fonts request fails here, which is itself a case: the fallback is reported, never hidden).
 *   1. type: a layer's own family, italic, case and paragraph spacing are drawn and measured by the same layout
 *   2. effects: an outline is ink and makes words legible on any ground; a drop shadow falls outside the shape; a glow; blend
 *   3. shapes: icons from the catalogue, a triangle, a two-colour fill
 *   4. image treatment: brightness, flip, a circle mask, corner radius; a mark is drawn exactly as its file whatever it carries
 *   5. style variations: ten named styles, words, marks and locked layers untouched, each measured
 * Run: node --experimental-sqlite tests/studio-s17-render-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const ctx = await browser.newContext(); const page = await ctx.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', async route => { const u = new URL(route.request().url()); if (u.host === 'studio.test' && u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }); return route.fulfill({ status: 404, body: '' }); });
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });
await page.addScriptTag({ content: `
  window.__img = {
    halves: (() => { const c = document.createElement('canvas'); c.width = 200; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 100, 100); x.fillStyle = '#0000ff'; x.fillRect(100, 0, 100, 100); return c.toDataURL('image/png'); })(),
    grey: (() => { const c = document.createElement('canvas'); c.width = 100; c.height = 100; const x = c.getContext('2d'); x.fillStyle = '#808080'; x.fillRect(0, 0, 100, 100); return c.toDataURL('image/png'); })(),
    mark: (() => { const c = document.createElement('canvas'); c.width = 200; c.height = 60; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.font = '900 44px sans-serif'; x.textBaseline = 'top'; x.fillText('MARK', 4, 6); return c.toDataURL('image/png'); })(),
  };
  window.__load = async () => { const R = window.STRender; const o = {}; for (const k of Object.keys(window.__img)) o[k] = await R.loadImage(window.__img[k]); return o; };
  window.__px = (L, C, imgs, pts, W) => { const R = window.STRender; const H = Math.round(W * L.stage.h / L.stage.w); const c = document.createElement('canvas'); c.width = W; c.height = H; R.draw(c.getContext('2d'), W, H, L, C || {}, imgs || {}); const x = c.getContext('2d'); return pts.map(p => Array.from(x.getImageData(Math.round(p[0] / 100 * W), Math.round(p[1] / 100 * H), 1, 1).data)); };
` });
const STAGE = { w: 1000, h: 1000 };
const base = layers => ({ v: 5, format: '1:1', stage: STAGE, noImagery: true, bg: '#ffffff', palette: { primary: '#0E6A6E', secondary: '#F2B705' }, layers });
const px = (L, C, imgs, pts) => page.evaluate(async ({ L, C, imgs, pts }) => { const im = await window.__load(); const images = {}; Object.keys(imgs || {}).forEach(k => { images[k] = im[imgs[k]]; }); return window.__px(L, C, images, pts, 1000); }, { L, C, imgs, pts });

section('1. type: family, italic, case and paragraph spacing');
{
  const r = await page.evaluate(() => {
    const R = window.STRender; const c = document.createElement('canvas').getContext('2d');
    const L = { stage: { w: 1000, h: 1000 }, fonts: { display: 'Kit Display' }, layers: [] };
    const l0 = { id: 'h', type: 'text', role: 'headline', x: 10, y: 10, w: 80, h: 40, size: 5, weight: 700 };
    const plain = R.layoutText(c, L, l0, { headline: 'first line\nsecond paragraph' }, 1000, 1000);
    const spaced = R.layoutText(c, L, Object.assign({}, l0, { paraSpacing: 1 }), { headline: 'first line\nsecond paragraph' }, 1000, 1000);
    const fam = R.layoutText(c, L, Object.assign({}, l0, { family: 'Playfair Display', italic: true }), { headline: 'x' }, 1000, 1000);
    const bad = R.layoutText(c, L, Object.assign({}, l0, { family: 'x"; font: 9px a' }), { headline: 'x' }, 1000, 1000);
    const cases = ['upper', 'lower', 'title'].map(k => R.layoutText(c, L, Object.assign({}, l0, { case: k }), { headline: "the fuel TAX credit's case" }, 1000, 1000).text);
    return { plainH: plain.contentH, spacedH: spaced.contentH, gap: spaced.lineY[1] - plain.lineY[1], px: plain.px, font: fam.font, badFont: bad.font, cases };
  });
  ok(Math.abs(r.spacedH - r.plainH - r.px) < 0.6 && Math.abs(r.gap - r.px) < 0.6, 'paragraph spacing of 1 opens one type size between paragraphs and nowhere else (' + Math.round(r.plainH) + ' -> ' + Math.round(r.spacedH) + ' px)');
  ok(/^italic 700 50px "Playfair Display", "Kit Display", /.test(r.font), 'a layer\'s own family comes first, then the kit\'s, in italic: ' + r.font);
  ok(!/font: 9px/.test(r.badFont) && /^700 50px "Kit Display"/.test(r.badFont), 'a family name that could be read as CSS is ignored: ' + r.badFont);
  ok(r.cases[0] === "THE FUEL TAX CREDIT'S CASE" && r.cases[1] === "the fuel tax credit's case" && r.cases[2] === "The Fuel Tax Credit's Case", 'case is presentation only, computed from the words: ' + r.cases.join(' | '));
  const f = await page.evaluate(async () => { const R = window.STRender; const L = { stage: { w: 1000, h: 1000 }, layers: [{ id: 'h', type: 'text', role: 'headline', x: 10, y: 10, w: 80, h: 30, size: 5, weight: 700, family: 'Playfair Display' }, { id: 's', type: 'text', role: 'support', x: 10, y: 50, w: 80, h: 10, size: 3, weight: 400, font: 'body' }] }; return R.ensureFonts(L, { headline: 'Words', support: 'More words' }, { timeout: 1500 }); });
  ok(!f.ok && f.fallback.some(x => /^headline: asked "Playfair Display"/.test(x)) && f.roles['layer:h'] && f.roles['layer:h'].requested === 'Playfair Display', 'a family that could not be fetched here is reported as a fallback for that layer, never hidden: ' + f.fallback.join('; '));
  ok(await page.evaluate(() => document.querySelectorAll('link[href*="fonts.googleapis.com/css2?family=Playfair+Display:wght@700"]').length === 1), 'the face is asked for as one family, one weight (a missing weight cannot break other faces)');
  ok(await page.evaluate(() => window.STRender.fontWeight('Bebas Neue', 800) === 400 && window.STRender.fontWeight('Inter', 650) === 600 && window.STRender.FONT_CATALOGUE.length >= 35), 'weights snap to what a family has (Bebas Neue draws everything at 400)');
}

section('2. effects: outline, shadow, glow, blend');
{
  const L = base([{ id: 'h', type: 'text', role: 'headline', x: 10, y: 40, w: 80, h: 20, size: 8, weight: 800, color: '#ffffff' }]);
  const v0 = await page.evaluate(L => { const R = window.STRender; const v = R.validate(L, { headline: 'White on white' }, {}, { format: '1:1' }); return v.boxes.find(b => b.id === 'h'); }, L);
  const L2 = JSON.parse(JSON.stringify(L)); L2.layers[0].stroke = { width: 0.6, color: '#000000' };
  const v1 = await page.evaluate(L => { const R = window.STRender; const v = R.validate(L, { headline: 'White on white' }, {}, { format: '1:1' }); return { b: v.boxes.find(b => b.id === 'h'), codes: v.issues.map(i => i.code) }; }, L2);
  ok(v0.contrastMin < 1.2 && v1.b.contrastMin >= 15 && v1.b.contrastVia === 'outline', 'white words on white fail; a black outline makes them read, and the record says why (' + v0.contrastMin + ' -> ' + v1.b.contrastMin + ':1 via ' + v1.b.contrastVia + ')');
  ok(v1.b.w > v0.w && v1.b.h > v0.h, 'the outline is ink: the words occupy it (' + Math.round(v0.w) + ' -> ' + Math.round(v1.b.w) + ' px wide)');
  const S = base([{ id: 'p', type: 'shape', role: 'panel', shape: 'rect', x: 30, y: 30, w: 40, h: 40, fill: '#0E6A6E', radius: 0, shadow: { x: 3, y: 3, blur: 0, color: 'rgba(0,0,0,1)' } }]);
  const sp = await px(S, {}, {}, [[71, 71], [72, 72], [25, 25]]);
  ok(sp[1][0] < 40 && sp[1][1] < 40 && sp[2][0] > 240, 'a drop shadow falls outside the shape, offset as set (outside pixel ' + sp[1].slice(0, 3).join(',') + '), and nowhere else');
  const G = base([{ id: 'bgp', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '#000000', radius: 0 }, { id: 'h', type: 'text', role: 'headline', x: 10, y: 40, w: 80, h: 20, size: 8, weight: 800, color: '#ffffff', glow: { blur: 3, color: '#ff0000' } }]);
  const gp = await page.evaluate(async L => { const R = window.STRender; const c = document.createElement('canvas'); c.width = 1000; c.height = 1000; R.draw(c.getContext('2d'), 1000, 1000, L, { headline: 'GLOW' }, {}); const d = c.getContext('2d').getImageData(0, 380, 1000, 260).data; let red = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 60 && d[i + 1] < 40 && d[i + 2] < 40) red++; return red; }, G);
  ok(gp > 200, 'a glow lights the ground around the words in its colour (' + gp + ' red pixels)');
  const B = base([{ id: 'w', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 0, w: 50, h: 100, fill: '#ffffff', radius: 0 }, { id: 'k', type: 'shape', role: 'panel', shape: 'rect', x: 50, y: 0, w: 50, h: 100, fill: '#000000', radius: 0 }, { id: 'm', type: 'shape', role: 'deco', shape: 'rect', x: 25, y: 40, w: 50, h: 20, fill: '#ff0000', radius: 0, blend: 'multiply' }]);
  const bp = await px(B, {}, {}, [[30, 50], [70, 50]]);
  ok(bp[0][0] > 240 && bp[0][1] < 15 && bp[1][0] < 15, 'multiply: red over white stays red, red over black stays black (' + bp[0].slice(0, 3) + ' / ' + bp[1].slice(0, 3) + ')');
}

section('3. shapes: icons, a triangle, a two-colour fill');
{
  const L = base([{ id: 'i', type: 'shape', role: 'icon', shape: 'icon', icon: 'check-circle', x: 10, y: 10, w: 30, h: 30, fill: '#0E6A6E' }, { id: 'n', type: 'shape', role: 'icon', shape: 'icon', icon: 'not-an-icon', x: 60, y: 10, w: 30, h: 30, fill: '#ff0000' }, { id: 't', type: 'shape', role: 'deco', shape: 'triangle', x: 10, y: 60, w: 30, h: 30, fill: '#000000' }, { id: 'g', type: 'shape', role: 'deco', shape: 'rect', x: 60, y: 60, w: 30, h: 30, fill: '#ff0000', fill2: '#0000ff', dir: 'down', radius: 0 }]);
  const r = await page.evaluate(L => { const R = window.STRender; const c = document.createElement('canvas'); c.width = 1000; c.height = 1000; const x = c.getContext('2d'); R.draw(x, 1000, 1000, L, {}, {}); const ink = (x0, y0, w, h) => { const d = x.getImageData(x0, y0, w, h).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200) n++; return n; }; const at = (px, py) => Array.from(x.getImageData(px, py, 1, 1).data); return { icon: ink(100, 100, 300, 300), unknown: ink(600, 100, 300, 300), triTop: at(250, 610), triCorner: at(105, 610), triBase: at(250, 890), gTop: at(750, 605), gBottom: at(750, 895), names: Object.keys(R.ICONS).length }; }, L);
  ok(r.icon > 1500 && r.unknown === 0, 'an icon from the catalogue is drawn in its box; an unknown icon draws nothing (' + r.icon + ' / ' + r.unknown + ' ink pixels; ' + r.names + ' icons)');
  ok(r.triTop[0] < 30 && r.triCorner[0] > 240 && r.triBase[0] < 30, 'a triangle: the apex column and the base are filled, the top corner is not');
  ok(r.gTop[0] > 200 && r.gTop[2] < 60 && r.gBottom[2] > 200 && r.gBottom[0] < 60, 'a two-colour fill runs from fill to fill2 along its direction (' + r.gTop.slice(0, 3) + ' -> ' + r.gBottom.slice(0, 3) + ')');
}

section('4. image treatment, and a mark untouched by it');
{
  const L = base([{ id: 'im', type: 'img', role: 'image', x: 0, y: 0, w: 100, h: 50, fit: 'cover', src: 'x' }]);
  const plain = await px(L, {}, { im: 'halves' }, [[10, 25], [90, 25]]);
  const Lf = JSON.parse(JSON.stringify(L)); Lf.layers[0].flipX = true; const flip = await px(Lf, {}, { im: 'halves' }, [[10, 25], [90, 25]]);
  ok(plain[0][0] > 240 && plain[1][2] > 240 && flip[0][2] > 240 && flip[1][0] > 240, 'flip mirrors the image in its box (red|blue becomes blue|red)');
  const Lb = JSON.parse(JSON.stringify(L)); Lb.layers[0].adjust = { brightness: -100 }; const dark = await px(Lb, {}, { im: 'halves' }, [[10, 25]]);
  ok(dark[0][0] < 10 && dark[0][1] < 10 && dark[0][2] < 10, 'brightness -100 takes the image to black');
  const Lw = base([{ id: 'im', type: 'img', role: 'image', x: 0, y: 0, w: 100, h: 100, fit: 'cover', src: 'x', adjust: { warmth: 100 } }]); const warm = await px(Lw, {}, { im: 'grey' }, [[50, 50]]);
  ok(warm[0][0] > warm[0][2] + 30, 'warmth lays an orange light over the image (' + warm[0].slice(0, 3) + ')');
  const Lc = base([{ id: 'im', type: 'img', role: 'image', x: 20, y: 20, w: 60, h: 60, fit: 'cover', src: 'x', mask: 'circle' }]); const circ = await px(Lc, {}, { im: 'halves' }, [[21, 21], [30, 50]]);
  ok(circ[0][0] > 240 && circ[0][1] > 240 && circ[1][0] > 240 && circ[1][1] < 30, 'a circle mask leaves the corners of the box clear and keeps the image inside');
  const Ls = base([{ id: 'sh', type: 'img', role: 'image', x: 20, y: 20, w: 60, h: 60, fit: 'cover', src: 'x', adjust: { sharpness: 80 } }]); const sharp = await px(Ls, {}, { sh: 'halves' }, [[45, 50], [50, 50]]);
  ok(sharp.every(p => p[3] === 255), 'sharpening runs on the pixels and keeps the image whole');
  const Lm = base([{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '#000000', radius: 0 }, { id: 'wordmark', type: 'img', role: 'wordmark', x: 10, y: 10, w: 40, h: 12, src: 'x', adjust: { brightness: -100 }, flipX: true, mask: 'circle', shadow: { x: 2, y: 2, blur: 1 } }]);
  const Lm0 = JSON.parse(JSON.stringify(Lm)); delete Lm0.layers[1].adjust; delete Lm0.layers[1].flipX; delete Lm0.layers[1].mask; delete Lm0.layers[1].shadow;
  const same = await page.evaluate(async ({ a, b }) => { const R = window.STRender; const im = await window.__load(); const draw = L => { const c = document.createElement('canvas'); c.width = 500; c.height = 500; R.draw(c.getContext('2d'), 500, 500, L, {}, { wordmark: im.mark }); return c.toDataURL(); }; return draw(a) === draw(b); }, { a: Lm, b: Lm0 });
  ok(same, 'a mark carrying adjustments, a flip, a mask and a shadow is drawn exactly as its file: none of them reach it');
}

section('5. style variations: the same words, marks and imagery in ten named styles');
{
  const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', palette: { primary: '#0E6A6E', secondary: '#F2B705' }, fonts: { display: 'Bricolage Grotesque' },
    layers: [
      { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 6, y: 46, w: 88, h: 48, fill: '#0b3d40', radius: 0 },
      { id: 'kicker', type: 'text', role: 'kicker', text: 'FACT CHECK', x: 10, y: 50, w: 60, h: 5, size: 2.4, weight: 700, color: '#ffffff' },
      { id: 'headline', type: 'text', role: 'headline', x: 10, y: 56, w: 80, h: 18, size: 6, weight: 800, color: '#ffffff' },
      { id: 'support', type: 'text', role: 'support', x: 10, y: 76, w: 80, h: 8, size: 2.8, weight: 500, color: '#ffffff', font: 'body' },
      { id: 'cta', type: 'text', role: 'cta', x: 10, y: 86, w: 40, h: 5, size: 2.6, weight: 700, color: '#ffffff' },
      { id: 'rule', type: 'shape', role: 'rule', shape: 'rule', x: 10, y: 48, w: 10, h: 0.6, fill: '#ffffff' },
      { id: 'locked', type: 'text', role: 'label', text: 'Authorised by A. Person', x: 60, y: 92, w: 34, h: 3, size: 1.6, weight: 500, color: '#ffffff', locked: true },
      { id: 'wordmark', type: 'img', role: 'wordmark', x: 70, y: 6, w: 24, h: 8, src: 'x' },
    ] };
  const C = { headline: 'Miners paid $74 billion in tax and royalties', support: 'That pays for hospitals, schools and roads.', cta: 'See the figures' };
  const r = await page.evaluate(async ({ L, C }) => { const R = window.STRender; const im = await window.__load(); const out = R.styles(L, C, { wordmark: im.mark }, { format: '1:1', channel: 'instagram' });
    const words = X => X.layers.filter(l => l.type === 'text').map(l => l.id + '=' + R.displayedText(X, l, C)).join('|');
    const sig = X => X.layers.filter(l => l.type === 'text').map(l => [l.family || '', l.weight, l.size, l.case || '', l.color, l.italic ? 'i' : ''].join(',')).join('|') + X.layers.filter(l => l.type === 'shape').map(l => l.fill + (l.hidden ? 'h' : '')).join('|');
    const mark = X => JSON.stringify(X.layers.find(l => l.id === 'wordmark')); const locked = X => JSON.stringify(X.layers.find(l => l.id === 'locked'));
    return { n: out.length, names: out.map(o => o.name), words: out.every(o => words(o.layout) === words(L)), marks: out.every(o => mark(o.layout) === mark(L)), locked: out.every(o => locked(o.layout) === locked(L)), distinct: new Set(out.map(o => sig(o.layout))).size, differ: out.every(o => sig(o.layout) !== sig(L)), measured: out.every(o => typeof o.ok === 'boolean' && Array.isArray(o.blocking)), editorial: (out.find(o => o.id === 'editorial').layout.layers.find(l => l.id === 'headline') || {}).family, data: out.find(o => o.id === 'data').layout.layers.find(l => l.id === 'headline').emphasis, impact: out.find(o => o.id === 'impact').layout.layers.find(l => l.id === 'headline').weight, styleName: out.every(o => o.layout.styleName === o.id) }; }, { L, C });
  ok(r.n === 10 && r.names.join(',') === 'Minimal,Bold,Editorial,Data-led,Social-first,Corporate,Premium,High-impact,Clean,Campaign-style', 'ten named styles: ' + r.names.join(', '));
  ok(r.words, 'every style shows exactly the same words');
  ok(r.marks && r.locked, 'no style touches the mark or a locked layer');
  ok(r.distinct === 10 && r.differ, 'each style is its own treatment, and none is the original');
  ok(r.measured && r.styleName, 'each style is measured (pass or the blocking findings) and names itself on the layout');
  ok(r.editorial === 'Playfair Display' && r.data === 'highlight' && r.impact === 400, 'the treatments are what they say: an editorial serif, the data-led figures picked out, the impact face at the weight it has');
}

ok(!errors.length, 'no page error (' + errors.join(' | ') + ')');
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
