/* The Studio's layout validation and repair in a real browser: docs/studio-render.js loaded into headless Chromium and
 * driven with the layouts the worker really produces (stLayout through POST /studio/asset, the worker module in this
 * process over a SQLite-backed D1) and with the reconstruction of the HOOF tile reported on 1 October 2026.
 *
 * Everything drawn here is SYNTHETIC: the photograph and the wordmark are painted in the page (tests/fixtures), the
 * HOOF layout is a reconstruction read off the screenshot, and no model is called. The fonts are the app's own families
 * (Bricolage Grotesque, Instrument Sans, OFL) served from FONT_DIR when it holds them; without them the font cases are
 * skipped and say so, and the rest runs on the browser's fallback and reports it.
 *
 * Section 11 (P24) offers the layout variations of every case and checks each against the same validation.
 *
 * Writes tests/shot-layout-repair.png: the HOOF reconstruction before and after repair (issue boxes outlined) and the
 * four formats with long copy after repair, labelled as synthetic.
 *
 * Run: node --experimental-sqlite tests/studio-layout-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
import { D1Lite } from './d1lite.mjs';
import { HOOF_REPRO, HOOF_COPY, WORDMARK_SCRIPT, PHOTO_SCRIPT } from './fixtures/studio-layouts.mjs';
process.on('warning', () => {});
const HERE = path.dirname(new URL(import.meta.url).pathname);
const FONT_DIR = process.env.FONT_DIR || '/mnt/skills/examples/canvas-design/canvas-fonts';
const FONTS = { 'bricolage-bold.ttf': 'BricolageGrotesque-Bold.ttf', 'bricolage.ttf': 'BricolageGrotesque-Regular.ttf', 'instrument-bold.ttf': 'InstrumentSans-Bold.ttf', 'instrument.ttf': 'InstrumentSans-Regular.ttf' };
const HAVE_FONTS = Object.values(FONTS).every(f => fs.existsSync(path.join(FONT_DIR, f)));
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);

/* ------------------------------------------------------------------ the real house layouts, from the worker module */
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v.buffer.slice(r2.get(k).v.byteOffset, r2.get(k).v.byteOffset + r2.get(k).v.byteLength), text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }) };
const mod = await import(new URL('../axiomworkerv4.js', import.meta.url).href); const handler = mod.default;
const api = async (m, p, b) => { const r = await handler.fetch(new Request('http://w' + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: b ? JSON.stringify(b) : undefined }), env, { waitUntil() {} }); return r.json(); };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
await api('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const proj = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Layout regression', brief: { objective: 'o', message: 'm' } });
const SHORT = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition' };
const LONG = { headline: 'A new tax on the people who grow our food, dig our minerals and keep the trucks moving', support: 'Fuel tax credits return a road tax that was never meant to apply to fuel used off-road, on farms and at mine sites.', cta: 'Sign the petition to keep fuel tax credits where they belong' };
const CHANNEL = { '1:1': 'instagram', '4:5': 'facebook', '9:16': 'instagram', '16:9': 'linkedin' };
const house = {};
for (const format of ['1:1', '4:5', '9:16', '16:9']) for (const [name, copy] of [['short', SHORT], ['long', LONG]]) {
  const a = await api('POST', '/studio/asset', { project: proj.id, family: 'Adaptations', channel: CHANNEL[format], format, title: format + ' ' + name, copy, mode: 'composition' });
  const v = a.asset.versions.find(x => x.id === a.asset.current);
  house[format + ' ' + name] = { layout: v.layout, copy: v.copy, channel: CHANNEL[format], format };
}

/* ------------------------------------------------------------------ the page: the renderer, the app's fonts, synthetic images */
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const browser = await chromium.launch();
const requests = [];
async function openPage(o) {
  o = o || {};
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  page.on('pageerror', e => console.log('  pageerror', e.message));
  page.on('request', r => requests.push(r.url()));
  await page.route('http://studio.test/**', async route => {
    const u = new URL(route.request().url());
    if (u.pathname === '/') {
      const faces = HAVE_FONTS && !o.noFonts ? `@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-bold.ttf);font-weight:600 900}@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage.ttf);font-weight:100 599}@font-face{font-family:'Instrument Sans';src:url(/fonts/instrument-bold.ttf);font-weight:600 900}@font-face{font-family:'Instrument Sans';src:url(/fonts/instrument.ttf);font-weight:100 599}` : '';
      return route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"><style>' + faces + '</style></head><body></body></html>' });
    }
    if (u.pathname.startsWith('/fonts/')) { if (o.fontDelay) await new Promise(r => setTimeout(r, o.fontDelay)); return route.fulfill({ contentType: 'font/ttf', body: fs.readFileSync(path.join(FONT_DIR, FONTS[u.pathname.slice(7)])) }); }
    if (u.pathname.startsWith('/mark/')) {   // a mark served over the network, optionally late, optionally failing
      if (o.markDelay) await new Promise(r => setTimeout(r, o.markDelay));
      if (u.searchParams.get('fail')) return route.fulfill({ status: 404, body: 'not found' });
      return route.fulfill({ contentType: 'image/png', body: Buffer.from(o.markPng || '', 'base64') });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto('http://studio.test/');
  await page.addScriptTag({ content: RENDERER });
  await page.addScriptTag({ content: `window.__img = { photo: ${PHOTO_SCRIPT}, blue: ${WORDMARK_SCRIPT('#1f5fa8')}, white: ${WORDMARK_SCRIPT('#ffffff')}, black: ${WORDMARK_SCRIPT('#111111')} };
    window.__load = async () => { const R = window.STRender; const o = {}; for (const k of Object.keys(window.__img)) o[k] = await R.loadImage(window.__img[k]); return o; };
    window.__displayed = (L, C) => (L.layers || []).map(l => [String(l.id), window.STRender.displayedText(L, l, C)]);
    window.__codes = v => v.issues.filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(',')).sort();` });
  return { ctx, page };
}

const { page } = await openPage();

/* ------------------------------------------------------------------ 1. one rule set */
section('1. one rule set: the renderer and the worker judge with the same code');
{
  const block = s => (s.split('/* RULES:BEGIN */')[1] || '').split('/* RULES:END */')[0].split('\n').map(x => x.trim()).filter(Boolean).join('\n');
  const a = block(RENDERER), b = block(fs.readFileSync(path.join(HERE, '..', 'axiomworkerv4.js'), 'utf8'));
  ok(a.length > 1000 && a === b, 'layoutRules is identical in docs/studio-render.js and axiomworkerv4.js (' + a.length + ' chars)');
}

/* ------------------------------------------------------------------ 2. fonts */
section('2. fonts: wait for them, say which were used');
{
  const f = await page.evaluate(async ({ L, C }) => window.STRender.ensureFonts(L, C, { timeout: 6000 }), { L: HOOF_REPRO, C: HOOF_COPY });
  if (HAVE_FONTS) ok(f.ok && f.roles.display.used === 'Bricolage Grotesque' && f.roles.body.used === 'Instrument Sans', 'the app fonts load and are reported as used: ' + JSON.stringify(f.roles));
  else ok(!f.ok && f.fallback.length, 'no app fonts on this machine: the fallback is reported, not hidden: ' + f.fallback.join('; '));
  const g = await page.evaluate(async ({ L, C }) => window.STRender.ensureFonts(Object.assign({}, L, { fonts: { display: 'Kit Face Not Installed', body: 'Instrument Sans' } }), C, { timeout: 1500 }), { L: HOOF_REPRO, C: HOOF_COPY });
  ok(g.roles.display.fallback && g.roles.display.requested === 'Kit Face Not Installed' && g.fallback.some(x => x.indexOf('display: asked "Kit Face Not Installed"') === 0), 'a kit font that is not available is disclosed with what drew instead: ' + g.fallback.join('; '));
  const v = await page.evaluate(async ({ L, C, g }) => { const im = await window.__load(); return window.STRender.validate(L, C, { bg: im.photo, wordmark: im.white }, { fonts: g, channel: 'instagram' }).issues.map(i => i.code + '/' + i.severity); }, { L: HOOF_REPRO, C: HOOF_COPY, g });
  ok(v.includes('font_fallback/warning'), 'the fallback rides on the validation as a warning');
}
if (HAVE_FONTS) {
  // the face arrives 1.5 s late: measuring before it lands gives other line breaks; ensureFonts waits for it
  const slow = await openPage({ fontDelay: 1500 });
  const r = await slow.page.evaluate(async ({ L, C }) => {
    const R = window.STRender; const W = 1080, H = 1350; const c = document.createElement('canvas').getContext('2d'); const hl = L.layers.find(l => l.id === 'headline');
    const early = R.layoutText(c, L, hl, C, W, H); const earlyAvail = R.familyAvailable('Bricolage Grotesque');
    const t0 = performance.now(); const f = await R.ensureFonts(L, C, { timeout: 6000 }); const waited = performance.now() - t0;
    const late = R.layoutText(c, L, hl, C, W, H);
    return { earlyW: Math.round(Math.max.apply(null, early.widths)), lateW: Math.round(Math.max.apply(null, late.widths)), earlyAvail, waited: Math.round(waited), f };
  }, { L: HOOF_REPRO, C: HOOF_COPY });
  ok(!r.earlyAvail && r.f.roles.display.used === 'Bricolage Grotesque' && r.waited >= 900, 'a late font is waited for (' + r.waited + ' ms) and then reported as used');
  ok(r.earlyW !== r.lateW, 'measuring before it arrived would have been wrong: widest headline line ' + r.earlyW + ' px on the fallback, ' + r.lateW + ' px in the real face');
  await slow.ctx.close();
  const never = await openPage({ fontDelay: 4000 });
  const n = await never.page.evaluate(async ({ L, C }) => window.STRender.ensureFonts(L, C, { timeout: 400 }), { L: HOOF_REPRO, C: HOOF_COPY });
  ok(!n.ok && n.roles.display.fallback && n.roles.display.used === 'sans-serif', 'a font that does not arrive within the wait is reported as a fallback, never as the kit font: ' + n.fallback.join('; '));
  await never.ctx.close();
} else console.log('  skip delayed-font cases: the app fonts are not in FONT_DIR (' + FONT_DIR + ')');

/* ------------------------------------------------------------------ 3. the HOOF defect */
section('3. the HOOF tile (reconstruction): detected, then repaired without touching words, identity or imagery');
const hoof = await page.evaluate(async ({ L, C }) => {
  const R = window.STRender; const im = await window.__load(); const fonts = await R.ensureFonts(L, C, { timeout: 6000 });
  const images = { bg: im.photo, wordmark: im.blue };
  const before = R.validate(L, C, images, { fonts, channel: 'instagram', format: '4:5' });
  const variants = { wordmark: L.layers.find(l => l.id === 'wordmark').variants.map(v => ({ variant: v.variant, src: v.src, img: im[v.variant] })) };
  const copyBefore = JSON.stringify(C); const fetches = []; const realFetch = window.fetch; window.fetch = function () { fetches.push(String(arguments[0])); return realFetch.apply(this, arguments); };
  const rep = R.repair(L, C, Object.assign({}, images), { fonts, channel: 'instagram', format: '4:5', variants });
  window.fetch = realFetch;
  const after = R.validate(rep.layout, C, { bg: im.photo, wordmark: im[rep.layout.layers.find(l => l.id === 'wordmark').variant || 'blue'] }, { fonts, channel: 'instagram', format: '4:5' });
  const hl = before.boxes.find(b => b.id === 'headline');
  return { before: window.__codes(before), beforeAll: before.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(',')), detail: before.issues.filter(i => i.code === 'text_overflow' || i.code === 'collision').map(i => i.detail), hl: { lines: hl.lines, contentH: Math.round(hl.contentH), ah: Math.round(hl.ah) },
    after: window.__codes(after), afterAll: after.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(',')), steps: rep.steps, conflict: rep.conflict, copySame: JSON.stringify(C) === copyBefore,
    words: [JSON.stringify(window.__displayed(L, C)), JSON.stringify(window.__displayed(rep.layout, C))], ids: [L.layers.map(l => l.id).join(), rep.layout.layers.map(l => l.id).join()],
    regions: [JSON.stringify(L.regions), JSON.stringify(rep.layout.regions)], mark: rep.layout.layers.find(l => l.id === 'wordmark'), fetches, layout: rep.layout,
    markContrast: [before.boxes.find(b => b.id === 'wordmark').contrast, after.boxes.find(b => b.id === 'wordmark').contrast], W: before.W, H: before.H };
}, { L: HOOF_REPRO, C: HOOF_COPY });
ok(hoof.W === 1080 && hoof.H === 1350, 'measured at the output size, 1080 x 1350, not the preview size');
ok(hoof.before.includes('text_overflow:headline'), 'before: the headline overflows its box (' + hoof.hl.lines + ' lines need ' + hoof.hl.contentH + ' px, the box is ' + hoof.hl.ah + ' px)');
ok(hoof.before.some(c => c.startsWith('collision:') && c.includes('headline') && c.includes('support')), 'before: the headline and the support line collide - ' + hoof.detail.filter(d => d.includes('overlap')).join('; '));
ok(hoof.beforeAll.some(c => c.startsWith('mark_low_contrast/warning:wordmark')), 'before: the blue wordmark reads poorly on the dark scrim (' + hoof.markContrast[0] + ':1, 4.5:1 wanted for a mark made of words)');
ok(hoof.after.length === 0 && !hoof.conflict, 'after: no blocking issue (' + hoof.afterAll.join(', ') + ')');
ok(!hoof.afterAll.some(c => c.startsWith('collision')), 'after: no collision of any kind');
ok(hoof.copySame && hoof.words[0] === hoof.words[1], 'the words are untouched, every layer shows exactly what it showed');
ok(hoof.ids[0] === hoof.ids[1] && hoof.regions[0] === hoof.regions[1], 'the same layers and the same imagery regions: nothing added, removed or re-rendered');
ok(hoof.mark.variant === 'white' && hoof.mark.src === HOOF_REPRO.layers[6].variants[1].src && hoof.markContrast[1] > hoof.markContrast[0] + 2, 'the wordmark switched to its approved white variant (' + hoof.markContrast[0] + ' to ' + hoof.markContrast[1] + ':1), never redrawn');
ok(hoof.fetches.length === 0, 'the repair made no request: no render, no model, no network');
console.log('  steps: ' + hoof.steps.join(' | '));

/* ------------------------------------------------------------------ 4. preview, export and inspection agree */
section('4. one drawing: the preview, the export and the inspected PNG are the same pixels');
{
  const r = await page.evaluate(async ({ L, C }) => {
    const R = window.STRender; const im = await window.__load(); const images = { bg: im.photo, wordmark: im.white };
    const blob = await R.toBlob(L, C, images); const bmp = await createImageBitmap(blob);
    const a = document.createElement('canvas'); a.width = bmp.width; a.height = bmp.height; a.getContext('2d').drawImage(bmp, 0, 0);
    const preview = R.render(L, C, images, null).canvas;       // what the asset view draws at full width
    const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = preview.getContext('2d').getImageData(0, 0, preview.width, preview.height).data;
    let diff = 0; for (let i = 0; i < da.length; i++) diff = Math.max(diff, Math.abs(da[i] - db[i]));
    const small = R.render(L, C, images, 540).canvas; const down = document.createElement('canvas'); down.width = 540; down.height = 675; down.getContext('2d').drawImage(a, 0, 0, 540, 675);
    const s1 = small.getContext('2d').getImageData(0, 0, 540, 675).data, s2 = down.getContext('2d').getImageData(0, 0, 540, 675).data; let sum = 0; for (let i = 0; i < s1.length; i += 4) sum += Math.abs(s1[i] - s2[i]) + Math.abs(s1[i + 1] - s2[i + 1]) + Math.abs(s1[i + 2] - s2[i + 2]);
    const vNative = R.validate(L, C, images, { channel: 'instagram' }); const vPreview = R.validate(L, C, images, { channel: 'instagram', width: 540 });
    return { w: bmp.width, h: bmp.height, diff, meanSmall: sum / (540 * 675 * 3), nativeOk: vNative.ok, previewOk: vPreview.ok, nativeW: vNative.W };
  }, { L: hoof.layout, C: HOOF_COPY });
  ok(r.w === 1080 && r.h === 1350 && r.diff === 0, 'the exported PNG (the file the inspection reads) is pixel-identical to the canvas the asset view draws at full size');
  ok(r.meanSmall < 6, 'the half-size preview is the same drawing scaled (mean channel difference ' + r.meanSmall.toFixed(2) + ')');
  ok(r.nativeOk && r.previewOk && r.nativeW === 1080, 'the repaired tile passes at the export size and at the preview size; the verdict that counts is taken at 1080');
}

/* ------------------------------------------------------------------ 5. the worker's real layouts in four formats */
section('5. the house layouts the worker produces, four formats, short and long copy (an adaptation is this: one message laid out per format)');
const sheetAfter = {};
for (const key of Object.keys(house)) {
  const h = house[key];
  const r = await page.evaluate(async ({ L, C, ch, fmt }) => {
    const R = window.STRender; const im = await window.__load(); const images = { bg: im.photo };
    (L.layers || []).forEach(l => { if (l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')) images[l.id] = im.white; });
    const fonts = await R.ensureFonts(L, C, { timeout: 4000 });
    const before = R.validate(L, C, images, { fonts, channel: ch, format: fmt });
    const rep = R.repair(L, C, Object.assign({}, images), { fonts, channel: ch, format: fmt });
    const after = R.validate(rep.layout, C, images, { fonts, channel: ch, format: fmt });
    return { W: before.W, H: before.H, before: window.__codes(before), after: window.__codes(after), conflict: rep.conflict, steps: rep.steps, same: JSON.stringify(window.__displayed(L, C)) === JSON.stringify(window.__displayed(rep.layout, C)), layout: rep.layout,
      hl: rep.layout.layers.filter(l => l.type === 'text').map(l => l.role + ' ' + l.size).join(', ') };
  }, { L: h.layout, C: h.copy, ch: h.channel, fmt: h.format });
  sheetAfter[key] = r.layout;
  const verdict = !r.after.length ? 'passes' : 'refused with a reason: ' + r.conflict;
  ok(r.same && (r.after.length === 0 || (r.conflict && r.conflict.length > 20)), key + ' (' + r.W + ' x ' + r.H + '): before [' + (r.before.join(', ') || 'clean') + '] -> ' + verdict + (r.steps.length ? ' (' + r.steps.length + ' step' + (r.steps.length === 1 ? '' : 's') + ')' : ''));
  if (key.endsWith('short')) ok(r.after.length === 0, key + ': short copy fits after repair, never refused');
}

/* ------------------------------------------------------------------ 6. what the rules see */
section('6. the cases the old estimate could not see');
const cases = await page.evaluate(async () => {
  const R = window.STRender; const im = await window.__load(); const W = 1080, H = 1080; const c = document.createElement('canvas').getContext('2d');
  const base = (layers, extra) => Object.assign({ v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#14242c', regions: [], fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, layers }, extra || {});
  const T = (id, role, o) => Object.assign({ id, type: 'text', role, x: 6, y: 10, w: 80, h: 10, size: 5, weight: 700, color: '#ffffff' }, o);
  const v = (L, C, o) => R.validate(L, C || {}, Object.assign({ wordmark: im.white }, o && o.images), Object.assign({ format: L.format }, o));
  const codes = x => x.issues.map(i => i.code + '/' + i.severity + (i.layers.length ? ':' + i.layers.join(',') : ''));
  const out = {};
  // explicit line breaks are kept
  const br = R.layoutText(c, base([]), T('h', 'headline', {}), { headline: 'One\nTwo\nThree' }, W, H); out.breaks = br.lines;
  // a long address breaks, never runs past the box, every character drawn
  const url = 'wearecuriousminds.com.au/hands-off-our-fuel/sign-the-petition-before-the-budget';
  const u = R.layoutText(c, base([]), T('s', 'support', { w: 40, size: 3 }), { support: 'Sign at ' + url }, W, H);
  out.url = { broken: u.broken, overflowW: u.overflowW, joined: u.lines.join('').replace(/\s/g, '') === ('Sign at ' + url).replace(/\s/g, ''), lines: u.lines.length };
  out.urlCodes = codes(v(base([T('s', 'support', { w: 40, size: 3, h: 30 })]), { support: 'Sign at ' + url }));
  // a CTA button that wraps to two lines: its box grows with its padding
  const ctaL = base([T('h', 'headline', { y: 10, h: 12 }), T('cta', 'cta', { x: 6, y: 70, w: 32, h: 5, size: 2.6, bg: '#E8B23A', color: '#141414', align: 'center' })]);
  const ctaC = { headline: 'Keep it fair', cta: 'Sign the petition to keep fuel tax credits where they belong' };
  out.cta = codes(v(ctaL, ctaC)); const ctaR = R.repair(ctaL, ctaC, { wordmark: im.white }, {}); out.ctaAfter = codes(R.validate(ctaR.layout, ctaC, {}, {})); out.ctaLines = R.measure(ctaR.layout, ctaC, {}, W, H).find(b => b.id === 'cta').lines;
  // free text is checked like any other words; an intended overlap is an exception for that pair only
  const free = base([T('h', 'headline', { y: 30, h: 16 }), T('s', 'support', { y: 50, h: 8, size: 3 }), T('tag', 'free', { text: 'MYTH', x: 8, y: 32, w: 30, h: 8, size: 4.5, overlaps: ['h'] }), T('tag2', 'label', { text: 'FACT', x: 8, y: 52, w: 30, h: 6, size: 3 })]);
  out.free = codes(v(free, { headline: 'Fuel tax credits are a subsidy', support: 'They are a rebate of a road tax' }));
  // rotation: the turned box is what is checked
  const rot = base([T('st', 'free', { text: 'NOT A SUBSIDY', x: 56, y: 1, w: 42, h: 8, size: 4, rotate: 14, bg: '#E8B23A', color: '#111' })]);
  out.rot = codes(v(rot, {})); out.unrot = codes(v(base([Object.assign({}, rot.layers[0], { rotate: 0 })]), {}));
  // emphasis: a highlight reaches past the glyphs; a mark set just beyond the words collides with the highlight only
  const hlL = T('h', 'headline', { x: 6, y: 40, w: 60, h: 10, size: 5 }); const hlT = R.layoutText(c, base([]), hlL, { headline: 'Not a subsidy' }, W, H);
  // the mark is judged by its ink, which starts a few pixels inside its box: set the box so the ink sits just past the glyphs
  const markX = (hlT.tx + Math.max.apply(null, hlT.widths) + 1) / W * 100;
  const em = e => base([Object.assign({}, hlL, { emphasis: e, emphasisColor: '#E8B23A', color: '#111' }), { id: 'wordmark', type: 'img', role: 'wordmark', x: markX, y: 40, w: 20, h: 6, src: '/brand/wordmark' }]);
  out.emNone = codes(v(em(''), { headline: 'Not a subsidy' })).filter(x => x.startsWith('collision')); out.emHigh = codes(v(em('highlight'), { headline: 'Not a subsidy' })).filter(x => x.startsWith('collision'));
  // hidden layers are not drawn and not checked; duplicate ids and impossible geometry are refused
  out.hidden = codes(v(base([T('h', 'headline', {}), T('ghost', 'free', { text: 'OLD LINE', hidden: true })]), { headline: 'Hands off our fuel' }));
  out.dup = codes(v(base([T('h', 'headline', {}), T('h', 'support', { y: 40, size: 3 })]), { headline: 'Hands off', support: 'Our fuel' }));
  out.bad = codes(v(base([T('h', 'headline', { w: -5 }), T('s', 'support', { y: 40, size: NaN })]), { headline: 'Hands off', support: 'Our fuel' }));
  out.off = codes(v(base([T('h', 'headline', { y: 97, h: 10 })]), { headline: 'Hands off our fuel' }));
  // the story safe area: hard on Instagram 9:16, and the repair lifts the column clear of it
  const story = base([T('h', 'headline', { y: 62, h: 9, size: 7 }), T('s', 'support', { y: 72, h: 6, size: 3.2 }), T('cta', 'cta', { y: 82, w: 40, h: 5, size: 3, bg: '#E8B23A', color: '#111' })], { format: '9:16', stage: { w: 1080, h: 1920 } });
  const sc = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition' };
  out.story = codes(v(story, sc, { channel: 'instagram' })); out.storyLi = codes(v(story, sc, { channel: 'linkedin' }));
  const sr = R.repair(story, sc, {}, { channel: 'instagram' }); out.storyAfter = codes(R.validate(sr.layout, sc, {}, { channel: 'instagram' }));
  // tiny type is refused, small type warned
  out.tiny = codes(v(base([T('h', 'headline', { size: 1.4 })]), { headline: 'Too small to read in a feed' }));
  return out;
});
ok(JSON.stringify(cases.breaks) === '["One","Two","Three"]', 'explicit line breaks are kept: ' + JSON.stringify(cases.breaks));
ok(cases.url.broken && !cases.url.overflowW && cases.url.joined, 'a long web address is broken inside its box (' + cases.url.lines + ' lines), every character still drawn');
ok(cases.urlCodes.includes('word_broken/warning:s') && !cases.urlCodes.some(x => x.startsWith('text_too_wide')), 'and it is reported as a broken word, a warning, not passed off as clean');
ok(cases.cta.some(x => x.startsWith('text_overflow/blocking:cta')), 'a CTA button that wraps to two lines is caught overflowing its button');
ok(cases.ctaAfter.filter(x => x.includes('blocking')).length === 0 && cases.ctaLines >= 2, 'the repair grows the button to its ' + cases.ctaLines + ' lines and padding; nothing cut');
ok(cases.free.some(x => x === 'collision/blocking:s,tag2'), 'free text (a FACT label) is checked against the support line it lands on');
ok(!cases.free.some(x => x.startsWith('collision') && x.includes('tag:') || x === 'collision/blocking:h,tag'), 'the declared MYTH-over-headline overlap is an exception for that pair only (' + cases.free.filter(x => x.startsWith('collision')).join(', ') + ')');
ok(cases.rot.some(x => x.startsWith('off_canvas/blocking')) && !cases.unrot.some(x => x.startsWith('off_canvas')), 'a rotated sticker is checked by its turned box: ' + cases.rot.join(', ') + ' (unturned: ' + (cases.unrot.join(', ') || 'clean') + ')');
ok(!cases.emNone.length && cases.emHigh.length === 1, 'a highlight that reaches a mark the bare words clear is a collision (' + cases.emHigh.join(', ') + ')');
ok(!cases.hidden.some(x => x.includes('ghost')), 'a hidden layer is neither drawn nor checked');
ok(cases.dup.includes('duplicate_id/blocking:h'), 'two layers with one id are refused');
ok(cases.bad.filter(x => x.startsWith('invalid_geometry/blocking')).length === 2, 'impossible geometry (negative width, no size) is refused');
ok(cases.off.some(x => x.startsWith('off_canvas/blocking:h')), 'words running off the stage are blocking');
ok(cases.story.some(x => x.startsWith('safe_area/blocking')) && !cases.storyLi.some(x => x.startsWith('safe_area/blocking')), 'the story safe area is hard on Instagram 9:16 and advisory elsewhere');
ok(!cases.storyAfter.some(x => x.includes('blocking')), 'the repair lifts the story column clear of the interface: ' + (cases.storyAfter.join(', ') || 'clean'));
ok(cases.tiny.includes('unreadable_type/blocking:h'), 'type under 1.8% of the width is refused, not shrunk into it');

/* ------------------------------------------------------------------ 7. marks: missing, late, failed */
section('7. marks: missing, late and failed loads');
{
  const markPng = (await page.evaluate(() => window.__img.white)).split(',')[1];
  const late = await openPage({ markDelay: 1200, markPng, noFonts: true });
  const r = await late.page.evaluate(async ({ L, C }) => {
    const R = window.STRender; const im = await window.__load(); const L2 = JSON.parse(JSON.stringify(L)); const wm = L2.layers.find(l => l.id === 'wordmark'); wm.src = '/mark/hoof-white.png';
    const images = { bg: im.photo };   // the mark has not arrived
    const early = R.validate(L2, C, images, { channel: 'instagram' }); const draft = R.validate(L2, C, images, { channel: 'instagram', production: false });
    const c1 = R.render(L2, C, images, null).canvas; const px1 = Array.from(c1.getContext('2d').getImageData(Math.round((wm.x + 2) / 100 * 1080), Math.round((wm.y + 1) / 100 * 1350), 1, 1).data);
    const t0 = performance.now(); images.wordmark = await R.loadImage(wm.src); const ms = performance.now() - t0;
    const lateV = R.validate(L2, C, images, { channel: 'instagram' });
    const c2 = R.render(L2, C, images, null).canvas; const px2 = Array.from(c2.getContext('2d').getImageData(Math.round((wm.x + 2) / 100 * 1080), Math.round((wm.y + 1) / 100 * 1350), 1, 1).data);
    let failed = null; try { await R.loadImage('/mark/hoof-white.png?fail=1'); } catch (e) { failed = e.message; }
    const code = x => x.issues.filter(i => i.code === 'mark_unloaded').map(i => i.severity);
    return { early: code(early), draft: code(draft), late: code(lateV), ms: Math.round(ms), px1, px2, failed };
  }, { L: hoof.layout, C: HOOF_COPY });
  ok(r.early[0] === 'blocking' && r.draft[0] === 'warning', 'a mark that has not loaded blocks production and only warns a draft');
  ok(r.px1[0] > 200 && r.px1[1] > 200 && r.px1[2] > 200, 'until it loads the tile shows a labelled placeholder, never a blank');
  ok(r.ms >= 900 && !r.late.length, 'when the late mark lands (' + r.ms + ' ms) the same layout validates clean');
  ok(JSON.stringify(r.px1) !== JSON.stringify(r.px2), 'and the drawing changes: the island redraws on the load, it does not keep the placeholder');
  ok(r.failed && /image failed/.test(r.failed), 'a failed load is an error the caller sees (' + r.failed + '), not a silent null');
  await late.ctx.close();
}

/* ------------------------------------------------------------------ 8. artwork mode, manual moves, locks, carousel */
section('8. baked artwork, manual moves, locked layers, carousel frames');
const more = await page.evaluate(async ({ L, C }) => {
  const R = window.STRender; const im = await window.__load(); const out = {};
  const pix = cv => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  // artwork mode: the words are in the painting; the live layers for them are not drawn again or measured
  const art = Object.assign(JSON.parse(JSON.stringify(L)), { approach: 'artwork', baked: ['headline', 'support', 'kicker'] });
  const hid = JSON.parse(JSON.stringify(art)); hid.layers.forEach(l => { if (['headline', 'support', 'kicker'].indexOf(l.role) >= 0) l.hidden = true; });
  const images = { bg: im.photo, wordmark: im.white };
  out.bakedSame = same(pix(R.render(art, C, images, null).canvas), pix(R.render(hid, C, images, null).canvas));
  const av = R.validate(art, C, images, { channel: 'instagram' }); out.bakedBoxes = av.boxes.filter(b => b.empty).map(b => b.id).sort(); out.bakedCodes = window.__codes(av);
  // a manual move: the support line dragged up onto the headline
  const moved = JSON.parse(JSON.stringify(L)); const s = moved.layers.find(l => l.id === 'support'); s.y = moved.layers.find(l => l.id === 'headline').y + 2;
  out.moved = window.__codes(R.validate(moved, C, images, { channel: 'instagram' }));
  const mr = R.repair(moved, C, Object.assign({}, images), { channel: 'instagram' }); out.movedAfter = window.__codes(R.validate(mr.layout, C, images, { channel: 'instagram' }));
  // the same drag with the headline and the support line locked: no fix is invented, the conflict is named
  const locked = JSON.parse(JSON.stringify(moved)); locked.layers.forEach(l => { if (l.id === 'headline' || l.id === 'support') l.locked = true; });
  const lr = R.repair(locked, C, Object.assign({}, images), { channel: 'instagram' });
  out.locked = { conflict: lr.conflict, ok: lr.ok, kept: ['headline', 'support'].every(id => JSON.stringify(lr.layout.layers.find(l => l.id === id)) === JSON.stringify(locked.layers.find(l => l.id === id))) };
  // a locked layout refuses outright
  const ll = R.repair(moved, C, Object.assign({}, images), { channel: 'instagram', locks: { layout: true } }); out.layoutLocked = { conflict: ll.conflict, changed: ll.changed };
  // a carousel: three frames, the second overfull; each frame is validated alone and only the bad one changes
  const frame = (i, head) => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, bg: { from: '#0E6A6E', to: '#06262a' }, regions: [], frame: { index: i, of: 3 }, fonts: L.fonts, layers: [
    { id: 'k', type: 'text', role: 'kicker', text: i === 0 ? 'MYTH' : 'FACT', x: 8, y: 14, w: 40, h: 4, size: 3, weight: 800, color: '#E8B23A' },
    { id: 'h', type: 'text', role: 'free', text: head, x: 8, y: 20, w: 84, h: 14, size: 6.4, weight: 800, color: '#fff' },
    { id: 's', type: 'text', role: 'free', text: 'Source: Australian Taxation Office, 2024-25.', x: 8, y: 36, w: 84, h: 4, size: 2.6, weight: 500, color: '#fff' }] });
  const frames = [frame(0, 'Fuel tax credits are a subsidy.'), frame(1, 'They return a road tax that was never meant to apply to fuel burnt off-road, on farms and at mine sites.'), frame(2, 'Hands off our fuel.')];
  out.frames = frames.map(f => window.__codes(R.validate(f, {}, {}, {})));
  const fixed = frames.map(f => R.repair(f, {}, {}, {})); out.framesAfter = fixed.map(r => window.__codes(R.validate(r.layout, {}, {}, {}))); out.framesChanged = fixed.map(r => r.changed);
  const fc = R.render(frames[0], {}, {}, null).canvas; const d = fc.getContext('2d').getImageData(1000, 22, 50, 20).data; let bright = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150) bright++; out.counter = bright;
  return out;
}, { L: hoof.layout, C: HOOF_COPY });
ok(more.bakedSame, 'artwork mode: the words baked into the painting are not drawn a second time (pixel-identical to those layers hidden)');
ok(JSON.stringify(more.bakedBoxes) === '["headline","kicker","support"]' && !more.bakedCodes.some(x => /headline|support|kicker/.test(x)), 'and they are not measured as live text; the painted words are the inspection\'s to read');
ok(more.moved.some(x => x.startsWith('collision') && x.includes('headline') && x.includes('support')), 'a manual drag of the support line onto the headline is caught');
ok(!more.movedAfter.length, 'and the repair puts it back below the headline with spacing');
ok(!more.locked.ok && /Locked layers stop the fix: .*(headline|support)/.test(more.locked.conflict) && more.locked.kept, 'with both locked, nothing locked is moved and the conflict is named: "' + more.locked.conflict + '"');
ok(!more.layoutLocked.changed && /locked/i.test(more.layoutLocked.conflict), 'a locked layout is not touched at all');
ok(!more.frames[0].length && more.frames[1].some(x => x.startsWith('text_overflow')) && !more.frames[2].length, 'carousel: each frame is validated alone; frame 2 overflows (' + more.frames[1].join(', ') + ')');
ok(more.framesAfter.every(x => !x.length) && JSON.stringify(more.framesChanged) === '[false,true,false]', 'only the overfull frame changes, and every frame passes');
ok(more.counter > 10, 'the frame counter is drawn on every carousel frame');

/* ------------------------------------------------------------------ P20: framing, line height, box versus type */
section('9. framing the photograph, line height, and a text box resized without its type');
const p20 = await page.evaluate(async ({ L, C }) => {
  const R = window.STRender; const im = await window.__load(); const out = {}; const images = { bg: im.photo, wordmark: im.white };
  const pix = cv => cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n / (a.length / 4); };
  const plain = JSON.parse(JSON.stringify(L)); delete plain.imageFocus;
  const centre = Object.assign(JSON.parse(JSON.stringify(L)), { imageFocus: { x: 50, y: 50, zoom: 1 } });
  const framed = Object.assign(JSON.parse(JSON.stringify(L)), { imageFocus: { x: 0, y: 0, zoom: 2 } });
  const a = pix(R.render(plain, C, images, null).canvas), b = pix(R.render(centre, C, images, null).canvas), c = pix(R.render(framed, C, images, null).canvas);
  out.centreSame = diff(a, b); out.framedMoved = diff(a, c);
  // the preview and the export are the same drawing at two widths: the framed preview, scaled up, matches the export far better than the unframed one does
  const small = R.render(framed, C, images, 360).canvas; const up = document.createElement('canvas'); up.width = small.width * 3; up.height = small.height * 3; up.getContext('2d').drawImage(small, 0, 0, up.width, up.height);
  const big = R.render(framed, C, images, up.width).canvas; const bigPlain = R.render(plain, C, images, up.width).canvas;
  out.parityFramed = diff(pix(up), pix(big)); out.parityPlain = diff(pix(up), pix(bigPlain));
  const ctx = document.createElement('canvas').getContext('2d'); const W = 1080, H = 1350; const hl = L.layers.find(l => l.id === 'headline');
  const t1 = R.layoutText(ctx, L, Object.assign({}, hl, { lineHeight: 1.12 }), C, W, H), t2 = R.layoutText(ctx, L, Object.assign({}, hl, { lineHeight: 1.5 }), C, W, H);
  out.lh = [t1.lh, t2.lh, t1.contentH, t2.contentH, t1.lines.length];
  const narrow = R.layoutText(ctx, L, Object.assign({}, hl, { w: hl.w * 0.6 }), C, W, H);
  out.box = [t1.px, narrow.px, t1.lines.length, narrow.lines.length];
  return out;
}, { L: hoof.layout, C: HOOF_COPY });
ok(p20.centreSame === 0, 'framing at the centre and zoom 1 draws exactly the plain cover crop');
ok(p20.framedMoved > 0.05, 'a focal point at the top left and zoom 2 moves the crop (' + Math.round(p20.framedMoved * 100) + '% of pixels changed)');
ok(p20.parityFramed < p20.parityPlain, 'the preview and the export draw the same framing (preview vs export ' + Math.round(p20.parityFramed * 100) + '% apart, vs ' + Math.round(p20.parityPlain * 100) + '% against the unframed export)');
ok(Math.abs(p20.lh[1] / p20.lh[0] - 1.5 / 1.12) < 0.01 && (p20.lh[4] < 2 || p20.lh[3] > p20.lh[2]), 'line height sets the line pitch the renderer measures (' + p20.lh.slice(0, 2).map(x => Math.round(x)).join(' -> ') + ' px)');
ok(p20.box[0] === p20.box[1] && p20.box[3] >= p20.box[2], 'a narrower text box keeps the type size and rewraps (' + p20.box[2] + ' -> ' + p20.box[3] + ' lines at ' + Math.round(p20.box[0]) + ' px)');

/* ------------------------------------------------------------------ p22b: the mark variant on its own, and words that do not read */
section('10. an unreadable mark takes its approved variant on its own; words that do not read get a colour, then a plate - never new words');
const p22b = await page.evaluate(async ({ L, C, F }) => {
  const R = window.STRender; const im = await window.__load(); const fonts = await R.ensureFonts(L, C, { timeout: 6000 }); const out = {};
  const variants = { wordmark: L.layers.find(l => l.id === 'wordmark').variants.map(v => ({ variant: v.variant, src: v.src, img: im[v.variant] })) };
  const images = { bg: im.photo, wordmark: im.blue }; const o = { fonts, channel: 'instagram', format: '4:5', variants };
  const mv = R.markVariants(L, C, Object.assign({}, images), o);
  const others = l => JSON.stringify(l.layers.filter(x => x.id !== 'wordmark'));
  const mark = mv.layout.layers.find(l => l.id === 'wordmark');
  const after = R.validate(mv.layout, C, Object.assign({}, images, { wordmark: im[mark.variant] }), o);
  out.mark = { changed: mv.changed, variant: mark.variant, steps: mv.steps, othersSame: others(mv.layout) === others(L), readable: !after.issues.some(i => /^mark_(unreadable|low_contrast|unloaded)$/.test(i.code)) };
  const lockedL = JSON.parse(JSON.stringify(L)); lockedL.layers.find(l => l.id === 'wordmark').locked = true;
  out.lockedChanged = R.markVariants(lockedL, C, Object.assign({}, images), o).changed;
  // a pale label over the pale sky of the photograph
  const T = JSON.parse(JSON.stringify(F)); T.layers.push({ id: 'pale', type: 'text', role: 'label', text: 'PUBLIC ROAD ENDS HERE', x: 50, y: 6, w: 44, h: 4, size: 2.6, weight: 600, color: '#F4E3C0', font: 'mono' });
  const tImages = Object.assign({}, images, { wordmark: im.white }); const o2 = { fonts, channel: 'instagram', format: '4:5' }; const o3 = Object.assign({ fixContrast: true }, o2);
  out.untouchedByDefault = !R.repair(T, C, Object.assign({}, tImages), o2).changed;
  const before = R.validate(T, C, tImages, o2); out.textBefore = before.issues.filter(i => i.layers.indexOf('pale') >= 0).map(i => i.code);
  const rep = R.repair(T, C, Object.assign({}, tImages), o3); const pl = rep.layout.layers.find(l => l.id === 'pale');
  const aft = R.validate(rep.layout, C, tImages, o2);
  out.text = { steps: rep.steps.filter(x => /pale/.test(x)), after: aft.issues.filter(i => i.layers.indexOf('pale') >= 0).map(i => i.code), sameWords: pl.text === 'PUBLIC ROAD ENDS HERE', samePlace: pl.x === 50 && pl.y === 6 && pl.size === 2.6, color: pl.color, bg: pl.bg || '' };
  return out;
}, { L: HOOF_REPRO, C: HOOF_COPY, F: hoof.layout });
ok(p22b.mark.changed && p22b.mark.variant !== 'blue' && p22b.mark.othersSame && p22b.mark.readable, 'markVariants: the blue wordmark that does not read becomes the approved ' + p22b.mark.variant + ' variant, and nothing else on the tile moves (' + p22b.mark.steps.join('; ') + ')');
ok(p22b.lockedChanged === false, 'a locked mark is left as it is');
ok(p22b.textBefore.some(c => /contrast/.test(c)), 'the pale label over the sky is caught: ' + p22b.textBefore.join(', '));
ok(p22b.untouchedByDefault, 'a merely low contrast is left alone unless the person asks (a deliberate brand colour may sit there): the Fix button asks');
ok(!p22b.text.after.some(c => /contrast/.test(c)) && p22b.text.sameWords && p22b.text.samePlace && p22b.text.steps.length === 1, 'the repair makes it read with ' + (p22b.text.bg ? 'a backing plate' : 'a colour change') + ' (' + p22b.text.color + (p22b.text.bg ? ' on ' + p22b.text.bg : '') + '), same words, same place and size');

/* ------------------------------------------------------------------ P24: layout variations */
section('11. layout variations: nine arrangements of the same words, each laid out by measurement and validated at the output size; the words never change');
const p24 = await page.evaluate(async ({ house, HOOF, HC }) => {
  const R = window.STRender; const im = await window.__load(); const out = [];
  const cases = Object.keys(house).map(k => ({ name: k, L: house[k].layout, C: house[k].copy, ch: house[k].channel, fmt: house[k].format })).concat([{ name: 'HOOF reported tile', L: HOOF, C: HC, ch: 'instagram', fmt: '4:5' }]);
  for (const c of cases) for (const photo of [true, false]) {
    const imgs = photo ? { bg: im.photo } : {}; (c.L.layers || []).forEach(l => { if (l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')) imgs[l.id] = im.white; });
    const fonts = await R.ensureFonts(c.L, c.C, { timeout: 6000 }); const o = { fonts, channel: c.ch, format: c.fmt };
    const words0 = JSON.stringify(window.__displayed(c.L, c.C).filter(([id]) => (c.L.layers.find(l => String(l.id) === id) || {}).type === 'text').sort());
    const vs = R.variants(c.L, c.C, imgs, o);
    const res = vs.map(x => {
      const v = R.validate(x.layout, c.C, imgs, Object.assign({ production: true }, o)); const blocking = v.issues.filter(i => i.severity === 'blocking' && !/imagery_missing|mark_unloaded|imagery_sketch/.test(i.code)).map(i => i.code + ':' + i.layers.join(','));
      const words = JSON.stringify(window.__displayed(x.layout, c.C).filter(([id]) => (x.layout.layers.find(l => String(l.id) === id) || {}).type === 'text').sort());
      const texts = v.boxes.filter(b => b.type === 'text' && !b.hidden && !b.empty); const marks = v.boxes.filter(b => b.mark && !b.hidden);
      const clash = marks.some(m => texts.some(t => Math.min(m.x + m.w, t.x + t.w) - Math.max(m.x, t.x) > 1 && Math.min(m.y + m.h, t.y + t.h) - Math.max(m.y, t.y) > 1));
      const chipsW = x.id === 'centre' ? v.boxes.filter(b => b.type === 'text' && b.bg && b.lines === 1).every(b => { const l = x.layout.layers.find(q => String(q.id) === b.id); return l && Math.abs(l.x + l.w / 2 - 50) < 0.6 && l.w < 79.9; }) : true;
      return { id: x.id, ok: x.ok, reportedOk: x.ok === !blocking.length, blocking, sameWords: words === words0, clash, chipsW, typeOnly: x.typeOnly, noImg: !!x.layout.noImagery, imgMissing: v.imageryMissing, pending: x.pending };
    });
    out.push({ name: c.name + (photo ? ' with photo' : ' no photo'), n: vs.length, res, distinct: new Set(vs.map(x => JSON.stringify(x.layout.layers.filter(l => l.type === 'text').map(l => [l.x, l.y, l.w, l.size])))).size });
  }
  const locked = R.variants(Object.assign({}, HOOF), HC, { bg: im.photo }, { channel: 'instagram', format: '4:5', locks: { layout: true } }).length;
  const LL = JSON.parse(JSON.stringify(HOOF)); const lt = LL.layers.find(l => l.type === 'text'); lt.locked = true;
  const lv = R.variants(LL, HC, { bg: im.photo, wordmark: im.white }, { channel: 'instagram', format: '4:5' });
  const kept = lv.every(x => { const y = x.layout.layers.find(l => l.id === lt.id); return y && y.x === lt.x && y.y === lt.y && y.w === lt.w && y.size === lt.size; });
  return { out, locked, kept, lockedId: lt.id };
}, { house, HOOF: HOOF_REPRO, HC: HOOF_COPY });
for (const c of p24.out) {
  const bad = c.res.filter(r => !r.ok);
  ok(c.n >= 8 && c.distinct === c.n, c.name + ': ' + c.n + ' distinct arrangements offered');
  ok(c.res.every(r => r.sameWords), c.name + ': every arrangement shows exactly the words of the original');
  ok(c.res.every(r => r.reportedOk), c.name + ': each one\'s pass or fail is what the validation measures');
  ok(/long/.test(c.name) && !HAVE_FONTS ? c.res.filter(r => r.ok).length >= 5 : !bad.length, c.name + ': ' + c.res.filter(r => r.ok).length + ' of ' + c.n + ' pass' + (bad.length ? ' (' + bad.map(r => r.id + ' ' + r.blocking.join(' ')).join('; ') + ')' : ''));
  ok(c.res.every(r => !r.ok || !r.clash), c.name + ': no mark sits on the words in a passing arrangement');
  ok(c.res.every(r => r.chipsW), c.name + ': a one-line label or CTA keeps its natural width when the words are centred');
  const to = c.res.find(r => r.typeOnly); ok(to && to.noImg && !to.imgMissing, c.name + ': the type-only arrangement needs no imagery');
  if (/no photo/.test(c.name)) ok(c.res.filter(r => !r.typeOnly).every(r => r.pending.indexOf('imagery_missing') >= 0), c.name + ': without a photograph, the others say the imagery is still to be made (not a layout failure)');
}
ok(p24.locked === 0, 'a locked layout offers no variations');
ok(p24.kept, 'a locked text layer (' + p24.lockedId + ') keeps its place and size in every variation');

/* ------------------------------------------------------------------ the evidence sheet */
section('evidence: tests/shot-layout-repair.png (synthetic fixture, real renderer)');
{
  const b64 = await page.evaluate(async ({ before, after, C, formats }) => {
    const R = window.STRender; const im = await window.__load();
    const S = document.createElement('canvas'); S.width = 2280; S.height = 1140; const x = S.getContext('2d'); x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, S.width, S.height);
    x.fillStyle = '#111'; x.font = '700 30px sans-serif'; x.fillText('Creative Studio layout repair - SYNTHETIC FIXTURE drawn by docs/studio-render.js (not client artwork, not model output)', 40, 52);
    x.font = '400 22px sans-serif'; x.fillText('HOOF tile reconstructed from the 1 October 2026 screenshot; photograph and wordmark painted in the page. Red: blocking issues measured at 1080 x 1350.', 40, 86);
    const tile = (L, imgs, dx, dy, w, label, issues) => {
      const cv = R.render(L, C, imgs, null).canvas; const h = Math.round(w * cv.height / cv.width); x.drawImage(cv, dx, dy, w, h);
      const k = w / cv.width; x.strokeStyle = '#e0242a'; x.lineWidth = 3; (issues || []).forEach(b => x.strokeRect(dx + b.x * k, dy + b.y * k, b.w * k, b.h * k));
      x.fillStyle = '#111'; x.font = '600 22px sans-serif'; x.fillText(label, dx, dy + h + 30); return h;
    };
    const vb = R.validate(before, C, { bg: im.photo, wordmark: im.blue }, { channel: 'instagram' });
    const bad = new Set(); vb.issues.filter(i => i.severity === 'blocking').forEach(i => i.layers.forEach(id => bad.add(id)));
    tile(before, { bg: im.photo, wordmark: im.blue }, 40, 110, 640, 'Before: ' + vb.issues.filter(i => i.severity === 'blocking').map(i => i.code).join(', '), vb.boxes.filter(b => bad.has(b.id)));
    const va = R.validate(after, C, { bg: im.photo, wordmark: im.white }, { channel: 'instagram' });
    tile(after, { bg: im.photo, wordmark: im.white }, 720, 110, 640, 'After repair: ' + (va.ok ? 'no blocking issue' : 'still blocking') + ', same words, white variant', []);
    x.font = '600 24px sans-serif'; x.fillText('Worker house layouts, long copy, after repair', 1420, 140);
    let yy = 170; formats.forEach((f, i) => {
      const imgs = { bg: im.photo }; (f.L.layers || []).forEach(l => { if (l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')) imgs[l.id] = im.white; });
      const v = R.validate(f.L, f.C, imgs, { channel: f.ch, format: f.fmt }); const w = f.fmt === '16:9' ? 400 : f.fmt === '9:16' ? 200 : 300;
      const col = i % 2, dx = 1420 + col * 430, dy = i < 2 ? 170 : 700;
      const cv = R.render(f.L, f.C, imgs, null).canvas; const h = Math.round(w * cv.height / cv.width); x.drawImage(cv, dx, dy, w, h);
      x.fillStyle = '#111'; x.font = '500 20px sans-serif'; x.fillText(f.fmt + ': ' + (v.ok ? 'passes' : 'blocking: ' + v.issues.filter(q => q.severity === 'blocking').map(q => q.code).join(',')), dx, dy + h + 26); yy = Math.max(yy, dy + h + 40);
    });
    const blob = await new Promise(r => S.toBlob(r, 'image/png')); const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s);
  }, { before: HOOF_REPRO, after: hoof.layout, C: HOOF_COPY, formats: ['1:1', '4:5', '9:16', '16:9'].map(f => ({ L: sheetAfter[f + ' long'], C: house[f + ' long'].copy, ch: house[f + ' long'].channel, fmt: f })) });
  const file = path.join(HERE, 'shot-layout-repair.png'); fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  ok(fs.statSync(file).size > 50000, 'written ' + path.relative(path.join(HERE, '..'), file) + ' (' + Math.round(fs.statSync(file).size / 1024) + ' KB)');
}

ok(!requests.some(u => /anthropic|googleapis|generativelanguage|workers\.dev/.test(u)), 'no request left the page for a model, a font CDN or the live worker (' + requests.length + ' requests, all to the local fixture origin)');
await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed' + (HAVE_FONTS ? '' : ' (font cases skipped)'));
process.exit(fail ? 1 : 0);
