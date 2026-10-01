#!/usr/bin/env node
/* Compose a Studio project's tiles exactly as the app exports them, outside the browser tab.
 *
 * The finished tile is the imagery plus the live layers (words, shapes, the client logo or the campaign wordmark) drawn
 * by the one renderer, docs/studio-render.js. This loads that same file into headless Chromium, draws the current
 * version of every composition at native size, writes the PNGs, and (with --save) stores each one on the worker as
 * that version's export (POST /studio/render/save) - which is what the inspection reads when it judges the composed
 * tile rather than the imagery alone. Nothing is generated and no model is called.
 *
 *   node tools/studio-compose.mjs --key $AXIOM_KEY --project p123 --out showcase/mca/export --save
 *   node tools/studio-compose.mjs --key $AXIOM_KEY --project p123 --asset a456 --version v789
 *   node tools/studio-compose.mjs --key $AXIOM_KEY --project p123 --save --repair   # a failing tile gets the app's
 *     "Fix layout (no render)" first: the bounded repair that never changes a word, saved as a layout version, then measured
 *
 * Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium), or PLAYWRIGHT_MJS pointing at
 * an install. The page loads the same web fonts as the app (the stylesheet link is read from docs/index.html, so the two
 * cannot drift) and waits for them before measuring; a family that still did not load is reported as a fallback, never
 * passed off as the kit font. Each tile is measured with the renderer's own validate() at its output size; with --save
 * the measurement and the PNG go to POST /studio/validation, where the worker re-judges them with the shared rules.
 * Prints one JSON line: {ok, project, composed:[{asset, title, version, file, saved, bytes, validation, fonts}], skipped:[...]}.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; args[k] = v; } }
if (!args.key || !args.project) { console.error('usage: studio-compose.mjs --key KEY --project ID [--asset ID] [--version ID] [--out DIR] [--save] [--repair] [--worker URL]'); process.exit(2); }
const BASE = String(args.worker || 'https://newsaus.heshan-998.workers.dev').replace(/\/$/, '');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(HERE, '..', 'docs', 'studio-render.js');
const FONT_LINK = ((fs.readFileSync(path.join(HERE, '..', 'docs', 'index.html'), 'utf8').match(/<link href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/) || [])[1]) || '';
const H = { 'X-Axiom-Key': String(args.key), 'User-Agent': 'axiom-studio-compose/1.0' };

async function api(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, H), body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(method + ' ' + p + ' -> HTTP ' + r.status + ' ' + (d.error || '') + ' ' + (d.detail || ''));
  return d;
}
async function dataUrl(u) {
  if (!u) return null;
  try { const r = await fetch(BASE + u, { headers: H }); if (!r.ok) return null; const buf = Buffer.from(await r.arrayBuffer()); return 'data:' + (r.headers.get('content-type') || 'image/png') + ';base64,' + buf.toString('base64'); } catch (e) { return null; }
}
async function loadChromium() {
  const tries = [process.env.PLAYWRIGHT_MJS, 'playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
  for (const t of tries) { try { const m = await import(t); if (m.chromium) return m.chromium; } catch (e) {} }
  return null;
}

const g = await api('GET', '/studio/get?id=' + encodeURIComponent(args.project));
const chromium = await loadChromium();
if (!chromium) { console.log(JSON.stringify({ ok: false, error: 'playwright_missing', detail: 'Composing needs Playwright with Chromium: npm i -D playwright && npx playwright install chromium (or set PLAYWRIGHT_MJS).' })); process.exit(3); }
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage();
await page.setContent('<!doctype html><html><head><meta charset="utf-8">' + (FONT_LINK && !args['no-fonts'] ? '<link rel="stylesheet" href="' + FONT_LINK.replace(/&amp;/g, '&') + '">' : '') + '</head><body></body></html>', { waitUntil: 'load', timeout: 20000 }).catch(() => {});
await page.addScriptTag({ content: fs.readFileSync(RENDERER, 'utf8') });
const out = args.out ? String(args.out) : null; if (out) fs.mkdirSync(out, { recursive: true });
const composed = [], skipped = [];
for (const a of g.assets || []) {
  if (args.asset && a.id !== args.asset) continue;
  let v = args.version ? a.versions.find(x => x.id === args.version) : a.versions.find(x => x.id === a.current) || a.versions[a.versions.length - 1];
  if (!v) { skipped.push({ asset: a.id, title: a.title, why: 'no version' }); continue; }
  if (!v.layout || !Array.isArray(v.layout.layers)) { skipped.push({ asset: a.id, title: a.title, why: v.mode === 'copy' ? 'copy only, no tile' : 'no layout to draw' }); continue; }
  const imgs = { bg: await dataUrl(v.image && v.image.url), logo: await dataUrl('/brand/logo?ns=' + encodeURIComponent(g.ns)) };
  const missing = [];
  for (const l of v.layout.layers) { if (l.type === 'img' && l.src) { imgs[l.id] = await dataUrl(l.src); if (!imgs[l.id]) missing.push(l.id); } }
  const draw = (layout, version, repair) => page.evaluate(async ({ layout, copy, imgs, channel, format, version, repair, locks }) => {
    const R = window.STRender; const loaded = {};
    for (const k of Object.keys(imgs)) loaded[k] = imgs[k] ? await R.loadImage(imgs[k]).catch(() => null) : null;
    const fonts = await R.ensureFonts(layout, copy, { timeout: 8000 });
    const val = R.validate(layout, copy, loaded, { fonts, channel, format });
    // the same bounded, word-preserving repair as the app's "Fix layout (no render)"; the caller saves it as a layout version
    if (repair && !val.ok) { const r = R.repair(layout, copy, Object.assign({}, loaded), { fonts, channel, format, locks }); if (r.changed) return { repaired: { layout: r.layout, steps: r.steps, ok: r.ok, conflict: r.conflict || '' } }; }
    const blob = await R.toBlob(layout, copy, loaded);
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), report: R.report({ id: version }, val), ok: val.ok, issues: val.issues.map(i => i.severity + ' ' + i.code + (i.layers.length ? ' [' + i.layers.join(',') + ']' : '')), fonts };
  }, { layout, copy: v.copy || {}, imgs, channel: a.channel, format: a.format, version, repair: !!repair, locks: a.locks || {} });
  let res = await draw(v.layout, v.id, args.repair && args.save && !(a.locks || {}).layout);
  let repairNote = null;
  if (res.repaired) {
    // no model call, no render: the repaired geometry becomes the next version, then that version is measured and filed
    try {
      const vr = await api('POST', '/studio/version', { asset: a.id, revision: a.revision, layout: res.repaired.layout, kind: 'layout', note: 'layout repaired: ' + res.repaired.steps.join('; ').slice(0, 170) });
      const nv = (vr.version && vr.version.id) || vr.id || (vr.asset && vr.asset.current);
      const g2 = await api('GET', '/studio/get?id=' + encodeURIComponent(args.project)); const a2 = g2.assets.find(x => x.id === a.id); v = a2.versions.find(x => x.id === (nv || a2.current)) || a2.versions.find(x => x.id === a2.current); Object.assign(a, { versions: a2.versions, revision: a2.revision, current: a2.current });
      repairNote = { steps: res.repaired.steps, fixed: res.repaired.ok, conflict: res.repaired.conflict || undefined, version: v.id };
    } catch (e) { repairNote = { error: String(e.message || e).slice(0, 200) }; }
    res = await draw(v.layout, v.id, false);
  }
  const b64 = res.b64;
  const n = a.versions.findIndex(x => x.id === v.id) + 1;
  const row = { asset: a.id, title: a.title, version: v.id, n, bytes: Buffer.from(b64, 'base64').length, missing: missing.length ? missing : undefined, incomplete: (v.layout.incomplete || []).map(i => i.text), fonts: res.fonts, measured: { ok: res.ok, issues: res.issues }, repaired: repairNote || undefined };
  if (out) { row.file = path.join(out, (a.title + '-v' + n + '-composed.png').replace(/[^a-zA-Z0-9._-]+/g, '_')); fs.writeFileSync(row.file, Buffer.from(b64, 'base64')); }
  if (args.save) {
    try { const s = await api('POST', '/studio/validation', { asset: a.id, version: v.id, report: res.report, imageB64: b64, mime: 'image/png' }); row.saved = s.validation.exportKey; row.validation = { ok: s.validation.ok, technical: s.readiness && s.readiness.technical, blocking: s.validation.issues.filter(i => i.severity === 'blocking').map(i => i.code) }; }
    catch (e) { row.saveError = String(e.message || e).slice(0, 300); }
  }
  composed.push(row);
}
await browser.close();
console.log(JSON.stringify({ ok: true, project: g.id, composed, skipped }));
