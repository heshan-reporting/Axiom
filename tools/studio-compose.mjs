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
 *
 * Needs Playwright with Chromium (npm i -D playwright && npx playwright install chromium), or PLAYWRIGHT_MJS pointing at
 * an install. Kit fonts that are not installed on this machine fall back to the app families, as they would in a browser
 * without them; the summary says which families were asked for.
 * Prints one JSON line: {ok, project, composed:[{asset, title, version, file, saved, bytes}], skipped:[...]}.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = {}; const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; args[k] = v; } }
if (!args.key || !args.project) { console.error('usage: studio-compose.mjs --key KEY --project ID [--asset ID] [--version ID] [--out DIR] [--save] [--worker URL]'); process.exit(2); }
const BASE = String(args.worker || 'https://newsaus.heshan-998.workers.dev').replace(/\/$/, '');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const RENDERER = path.join(HERE, '..', 'docs', 'studio-render.js');
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
await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
await page.addScriptTag({ content: fs.readFileSync(RENDERER, 'utf8') });
const out = args.out ? String(args.out) : null; if (out) fs.mkdirSync(out, { recursive: true });
const composed = [], skipped = [];
for (const a of g.assets || []) {
  if (args.asset && a.id !== args.asset) continue;
  const v = args.version ? a.versions.find(x => x.id === args.version) : a.versions.find(x => x.id === a.current) || a.versions[a.versions.length - 1];
  if (!v) { skipped.push({ asset: a.id, title: a.title, why: 'no version' }); continue; }
  if (!v.layout || !Array.isArray(v.layout.layers)) { skipped.push({ asset: a.id, title: a.title, why: v.mode === 'copy' ? 'copy only, no tile' : 'no layout to draw' }); continue; }
  const imgs = { bg: await dataUrl(v.image && v.image.url), logo: await dataUrl('/brand/logo?ns=' + encodeURIComponent(g.ns)) };
  const missing = [];
  for (const l of v.layout.layers) { if (l.type === 'img' && l.src) { imgs[l.id] = await dataUrl(l.src); if (!imgs[l.id]) missing.push(l.id); } }
  const b64 = await page.evaluate(async ({ layout, copy, imgs }) => {
    const R = window.STRender; const loaded = {};
    for (const k of Object.keys(imgs)) loaded[k] = imgs[k] ? await R.loadImage(imgs[k]).catch(() => null) : null;
    const blob = await R.toBlob(layout, copy, loaded);
    const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, { layout: v.layout, copy: v.copy || {}, imgs });
  const n = a.versions.findIndex(x => x.id === v.id) + 1;
  const row = { asset: a.id, title: a.title, version: v.id, n, bytes: Buffer.from(b64, 'base64').length, missing: missing.length ? missing : undefined, incomplete: (v.layout.incomplete || []).map(i => i.text), fonts: v.layout.fonts ? [v.layout.fonts.display, v.layout.fonts.body] : undefined };
  if (out) { row.file = path.join(out, (a.title + '-v' + n + '-composed.png').replace(/[^a-zA-Z0-9._-]+/g, '_')); fs.writeFileSync(row.file, Buffer.from(b64, 'base64')); }
  if (args.save) { const s = await api('POST', '/studio/render/save', { asset: a.id, version: v.id, imageB64: b64, mime: 'image/png' }); row.saved = s.key; }
  composed.push(row);
}
await browser.close();
console.log(JSON.stringify({ ok: true, project: g.id, composed, skipped }));
