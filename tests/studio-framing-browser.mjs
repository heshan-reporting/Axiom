/* Background positioning (S4): one documented image-to-canvas transform, the pan that inverts it, framing that survives a
 * change of aspect ratio, crops that never show an empty edge, and subject awareness as uncertain evidence with a confidence.
 * Real Chromium, docs/studio-render.js, synthetic imagery; no model, no network.
 * Run: node --experimental-sqlite tests/studio-framing-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch(); const ctx = await browser.newContext(); const page = await ctx.newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', async route => { const u = new URL(route.request().url()); if (u.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }); return route.fulfill({ status: 404, body: '' }); });
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });
/* a 1600 x 900 "photograph": a flat dark field with one bright warm blob (the subject) in the right third, and a grey one nobody should care about */
await page.addScriptTag({ content: `window.__photo = (() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 900; const x = c.getContext('2d'); x.fillStyle = '#2b3a42'; x.fillRect(0, 0, 1600, 900); x.fillStyle = '#34434b'; x.fillRect(0, 600, 1600, 300); x.fillStyle = '#e8a23a'; x.beginPath(); x.ellipse(1200, 420, 170, 220, 0, 0, 7); x.fill(); x.fillStyle = '#3a4951'; x.fillRect(200, 300, 120, 80); return c.toDataURL('image/png'); })();
  window.__load = async () => window.STRender.loadImage(window.__photo);` });

section('1. the transform is documented and the pan inverts it');
{
  const r = await page.evaluate(() => { const R = window.STRender; const t1 = R.coverTransform(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, { x: 50, y: 50, zoom: 1 }); const t0 = R.coverTransform(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, { x: 0, y: 0, zoom: 1 }); const t2 = R.coverTransform(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, { x: 100, y: 100, zoom: 1 });
    const p = R.imageToCanvas(t1, 75, 50); const back = R.canvasToImage(t1, p.x, p.y);
    const panned = R.panFocus(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, { x: 50, y: 50, zoom: 1 }, -200, 40); const t3 = R.coverTransform(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, panned);
    return { t0, t1, t2, p, back, panned, t3 }; });
  ok(Math.abs(r.t1.s - 1.2) < 1e-9 && Math.abs(r.t1.w - 1920) < 1e-6 && Math.abs(r.t1.h - 1080) < 1e-6, 'cover: a 1600x900 image fills a 1080 square at scale 1.2 (1920 x 1080 drawn)');
  ok(Math.abs(r.t1.x + 420) < 1e-6 && Math.abs(r.t1.y) < 1e-6, 'focus 50,50 centres the crop (origin ' + r.t1.x.toFixed(1) + ', ' + r.t1.y.toFixed(1) + ')');
  ok(Math.abs(r.t0.x) < 1e-6 && Math.abs(r.t2.x + 840) < 1e-6, 'focus 0 pins the left edge, focus 100 the right edge: no empty edge either way');
  ok(Math.abs(r.p.x - 1020) < 1e-6 && Math.abs(r.back.x - 75) < 1e-6 && Math.abs(r.back.y - 50) < 1e-6, 'the image point (75%, 50%) lands at x 1020 of the 1080 stage and maps back exactly');
  ok(Math.abs(r.t3.x - (r.t1.x - 200)) < 0.6 && Math.abs(r.t3.y - r.t1.y) < 1e-6, 'dragging the photograph 200 px left moves its origin 200 px left (focus ' + r.panned.x + '); a drag along the axis with no overflow changes nothing (y stays ' + r.panned.y + ')');
}

section('2. the same focus keeps the subject in the same relative place in every aspect ratio, and the box is always covered');
{
  const r = await page.evaluate(() => { const R = window.STRender; const f = { x: 75, y: 47, zoom: 1 }; const out = {};
    [['1:1', 1080, 1080], ['4:5', 1080, 1350], ['9:16', 1080, 1920], ['16:9', 1920, 1080]].forEach(([k, w, h]) => { const t = R.coverTransform(1600, 900, { x: 0, y: 0, w, h }, f); const p = R.imageToCanvas(t, 75, 47); out[k] = { fx: p.x / w, fy: p.y / h, gapL: t.x > 0.001, gapT: t.y > 0.001, gapR: t.x + t.w < w - 0.001, gapB: t.y + t.h < h - 0.001 }; });
    const z = R.coverTransform(1600, 900, { x: 0, y: 0, w: 1080, h: 1080 }, { x: 100, y: 100, zoom: 2.5 }); out.zoomGap = z.x > 0.001 || z.y > 0.001 || z.x + z.w < 1079.999 || z.y + z.h < 1079.999;
    return out; });
  const keys = ['1:1', '4:5', '9:16', '16:9'];
  ok(keys.every(k => Math.abs(r[k].fx - 0.75) < 1e-6 && Math.abs(r[k].fy - 0.47) < 1e-6), 'the subject at image (75%, 47%) sits at (75%, 47%) of the box in 1:1, 4:5, 9:16 and 16:9 alike');
  ok(keys.every(k => !r[k].gapL && !r[k].gapT && !r[k].gapR && !r[k].gapB) && !r.zoomGap, 'no framing shows an empty edge, zoomed to 2.5 and pinned to a corner included');
}

section('3. subjects are an estimate with a confidence; a covered subject is a warning that says so');
{
  const r = await page.evaluate(async () => { const R = window.STRender; const img = await window.__load(); const sj = R.subjects(img);
    const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100 }], palette: { primary: '#0E6A6E' }, layers: [
      { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 54, y: 20, w: 42, h: 60, fill: '#0E6A6E', opacity: 1 },
      { id: 'headline', type: 'text', role: 'headline', x: 57, y: 24, w: 36, h: 30, size: 5, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' }] };
    const C = { headline: 'Hands off our fuel' };
    const v = R.validate(L, C, { bg: img }, { channel: 'instagram', format: '1:1' });
    const sug = R.frameSuggest(L, C, { bg: img }, { format: '1:1' });
    const L2 = Object.assign({}, L, { imageFocus: sug && sug.focus ? sug.focus : L.imageFocus }); const v2 = R.validate(L2, C, { bg: img }, { channel: 'instagram', format: '1:1' });
    const clear = Object.assign({}, L, { layers: L.layers.map(l => Object.assign({}, l, { x: l.x - 50 })) }); const v3 = R.validate(clear, C, { bg: img }, { channel: 'instagram', format: '1:1' });
    return { sj, subj: v.subjects, codes: v.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(',')), sug: sug && { focus: sug.focus, before: sug.before, after: sug.after, note: sug.note }, codes2: v2.issues.map(i => i.code + '/' + i.severity), subj2: v2.subjects, codes3: v3.issues.map(i => i.code + '/' + i.severity), rep: R.report({ layout: L, copy: C }, v).subjects }; });
  const s1 = r.sj.regions[0];
  ok(r.sj.regions.length >= 1 && s1 && s1.x > 55 && s1.x + s1.w < 95 && s1.y > 15 && s1.y + s1.h < 80, 'the warm blob in the right third is found as a likely subject (' + (s1 ? [s1.x, s1.y, s1.w, s1.h].join(', ') : 'none') + ' % of the image)');
  ok(r.sj.confidence > 0 && r.sj.confidence <= 0.6 && /saliency/.test(r.sj.method) && /no face or object model/.test(r.sj.method), 'the estimate carries a bounded confidence (' + r.sj.confidence + ') and says what it is not');
  ok(!r.sj.regions.some(x => x.x < 30 && x.y < 50 && x.w < 12), 'the faint grey rectangle is not mistaken for a subject');
  ok(r.subj && r.subj[0] && r.subj[0].covered >= 0.35 && r.subj[0].by.indexOf('panel') >= 0, 'under the centred crop the teal panel covers the subject (' + (r.subj && r.subj[0] ? Math.round(r.subj[0].covered * 100) + '%, by ' + r.subj[0].by.join(', ') : 'none') + ')');
  ok(r.codes.some(c => /^subject_covered\/warning:.*panel/.test(c)), 'and the rules say so as a warning, never a blocker (' + r.codes.join(', ') + ')');
  ok(r.rep && r.rep[0] && typeof r.rep[0].confidence === 'number', 'the report the worker re-judges carries the subjects with their confidence');
  ok(r.sug && r.sug.focus && r.sug.after < r.sug.before, 'a framing is suggested that keeps the subject clearer (' + (r.sug ? r.sug.note : 'none') + ')');
  const s2 = r.subj2 && r.subj2[0];
  ok(s2 && s2.cropped < 0.5 && s2.covered < r.subj[0].covered, 'applied, the suggested framing keeps at least half the subject in view (cropped ' + (s2 ? Math.round(s2.cropped * 100) : '?') + '%) and less of it is covered (' + (s2 ? Math.round(s2.covered * 100) : '?') + '% from ' + Math.round(r.subj[0].covered * 100) + '%); it never hides the subject outside the crop to "clear" it');
  ok(!r.codes3.some(c => /^subject_covered/.test(c)), 'with the panel moved off the subject nothing is reported (' + r.codes3.join(', ') + ')');
}

section('4. no subject, no claim');
{
  const r = await page.evaluate(() => { const R = window.STRender; const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#556'; x.fillRect(0, 0, 400, 300); return new Promise(res => { const im = new Image(); im.onload = () => res(R.subjects(im)); im.src = c.toDataURL(); }); });
  ok(r.regions.length === 0 && r.confidence <= 0.2, 'a flat field has no subject and the estimate says so (' + (r.note || '') + ')');
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
