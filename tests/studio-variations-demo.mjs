/* The creative outcome, shown: one message, one client, one photograph - five compositions the design spec engine lays
 * out (the house panel the Studio used to produce every time, then four directions an art-direction pass proposed:
 * words over a gradient from the top, a split with the words left, a typography-led tile on the brand colour, and a
 * compact panel on the right with a new photograph). Each is drawn by the one renderer (docs/studio-render.js) at
 * preview size onto a contact sheet, with a synthetic documentary photograph whose subject stands on the right, so the
 * question "is the subject still visible, are the words readable" can be answered by looking.
 * The layouts come from the worker module itself (a concepts job with a stub model), never from a copy of its geometry.
 * Run: node --experimental-sqlite tests/studio-variations-demo.mjs   -> tests/shot-variations.png */
import { chromium, DOCS } from './pw.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
const PORT = 8766 + Math.floor(Math.random() * 100); const W = 'https://newsaus.demo';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const CONCEPTS = { critique: 'The house panel again; the subject is half covered.', options: [
  { name: 'Words over the sky', concept: 'No panel; the headline over a gradient from the top, the subject clear below', rationale: 'Editorial', imagery: 'keep the current photograph', composition: 'Top', typography: 'Larger', colour: 'Dark gradient', textPlacement: 'top', design: { image: { keep: true }, composition: { style: 'gradient', zone: 'top', coverage: 'standard' }, type: { align: 'left', scale: 'larger' }, panel: { fill: 'teal' }, logo: { corner: 'br' }, cta: { style: 'button' } }, keeps: ['photograph'], changes: ['panel removed'], needsImage: false, basis: [], refs: [], missing: [] },
  { name: 'Split, words left', concept: 'Teal field left, photograph right', rationale: 'Clean separation', imagery: 'keep the current photograph', composition: 'Split', typography: 'Same', colour: 'Teal', textPlacement: 'left', design: { image: { keep: true }, composition: { style: 'split', zone: 'left', coverage: 'standard' }, type: { align: 'left', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'panel' }, cta: { style: 'button' } }, keeps: ['photograph'], changes: ['split'], needsImage: false, basis: [], refs: [], missing: [] },
  { name: 'Type-led', concept: 'Brand colour fills the tile, type leads, small photograph', rationale: 'An argument, not a scene', imagery: 'keep the current photograph, small', composition: 'Top', typography: 'Larger, centred', colour: 'Teal field', textPlacement: 'top', design: { image: { keep: true }, composition: { style: 'typographic', zone: 'top', coverage: 'standard' }, type: { align: 'centre', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'tl' }, cta: { style: 'text' } }, keeps: ['copy'], changes: ['field', 'small image'], needsImage: false, basis: [], refs: [], missing: [] },
  { name: 'Compact panel right', concept: 'A compact translucent panel right over a wider photograph', rationale: 'Room for the subject', imagery: 'A wider photograph, subject left', composition: 'Right', typography: 'Same', colour: 'Teal', textPlacement: 'right', design: { image: { keep: false, subject: 'the same deckhand, wider', setting: 'harbour', framing: 'wide', lighting: 'dawn', mood: 'quiet', focal: 'left' }, composition: { style: 'translucent', zone: 'right', coverage: 'compact' }, type: { align: 'left', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'br' }, cta: { style: 'button' } }, keeps: ['copy'], changes: ['photograph', 'panel'], needsImage: true, prompt: 'wide', basis: [], refs: [], missing: [] }] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) { const body = JSON.parse(init.body); const sys = String(body.system || ''); const answer = /art director of an Australian political communications agency, briefing/.test(sys) ? CONCEPTS : {}; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' }), { status: 200 }); }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function api(method, path, body) { const r = new Request(W + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }); return (await handler.fetch(r, env, ctx)).json(); }
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel' }], logoB64: PNG, logoMime: 'image/png' });
const p = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Variations demo', brief: { objective: 'answer the subsidy framing', message: 'small businesses use them' } });
r2.set('studio/demo/fisher.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const a = await api('POST', '/studio/asset', { project: p.id, family: 'Campaign set', channel: 'instagram', format: '4:5', title: 'Instagram portrait', copy: { headline: 'Fact: They\'re used by small businesses too', support: 'Farmers, fishers, builders, wineries, tourism operators and tradies use Fuel Tax Credits.', cta: 'handsoffourfuel.com.au', alt: 'tile' }, image: { key: 'studio/demo/fisher.png', url: '', model: 'demo', size: '2K' }, mode: 'composition' });
const A = a.asset.id; const house = a.asset.versions[0].layout; const copy = a.asset.versions[0].copy;
let j = (await api('POST', '/studio/job', { project: p.id, asset: A, stage: 'concepts', input: { asset: A, feedback: 'Give me different variations' }, idem: 'demo' })).job;
for (let i = 0; i < 4 && j.state !== 'done' && j.state !== 'failed'; i++) j = (await api('POST', '/studio/job/step', { id: j.id })).job;
if (j.state !== 'done') throw new Error('concepts failed: ' + j.error);
const ev = (await api('GET', '/studio/get?id=' + p.id)).thread.filter(e => e.kind === 'concepts').pop();
const boards = [{ name: 'House default (before)', layout: house }].concat(ev.options.map(o => ({ name: o.name + (o.needsImage ? ' (new photograph)' : ' (same photograph)'), layout: o.layout, summary: o.summary })));
boards.forEach(b => console.log('  ' + b.name + (b.summary ? ': ' + b.summary : '')));

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await page.setContent('<!doctype html><html><body style="margin:0;background:#0f141a"></body></html>');
await page.addScriptTag({ url: 'http://127.0.0.1:' + PORT + '/studio-render.js' });
await page.waitForFunction(() => window.STRender);
const png = await page.evaluate(async ({ boards, copy }) => {
  // a synthetic documentary photograph: sky, sea, a dark figure standing on the right third, warm light from the left
  const photo = document.createElement('canvas'); photo.width = 1080; photo.height = 1350; const c = photo.getContext('2d');
  const sky = c.createLinearGradient(0, 0, 0, 700); sky.addColorStop(0, '#7f93a6'); sky.addColorStop(1, '#c9b89a'); c.fillStyle = sky; c.fillRect(0, 0, 1080, 700);
  const sea = c.createLinearGradient(0, 700, 0, 1350); sea.addColorStop(0, '#3e5b6c'); sea.addColorStop(1, '#1d2d38'); c.fillStyle = sea; c.fillRect(0, 700, 1080, 650);
  c.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 40; i++) { c.fillRect(Math.random() * 1080, 700 + Math.random() * 650, 60 + Math.random() * 160, 3); }
  c.fillStyle = '#2a2520'; c.beginPath(); c.ellipse(760, 560, 55, 60, 0, 0, Math.PI * 2); c.fill(); c.fillRect(690, 610, 140, 380); c.fillRect(640, 640, 60, 220); c.fillRect(820, 640, 60, 220); c.fillRect(700, 980, 50, 260); c.fillRect(770, 980, 50, 260);
  c.fillStyle = '#6b5a3e'; c.fillRect(560, 1180, 520, 170); c.fillStyle = '#3b3128'; c.fillRect(520, 1160, 560, 30);
  const bg = new Image(); bg.src = photo.toDataURL(); await new Promise(r => { bg.onload = r; });
  const logo = document.createElement('canvas'); logo.width = 380; logo.height = 190; const lc = logo.getContext('2d'); lc.fillStyle = '#fff'; lc.fillRect(0, 0, 380, 190); lc.fillStyle = '#0E6A6E'; lc.font = '700 72px sans-serif'; lc.textBaseline = 'middle'; lc.textAlign = 'center'; lc.fillText('MCA', 190, 95);
  const lg = new Image(); lg.src = logo.toDataURL(); await new Promise(r => { lg.onload = r; });
  const w = 300, gap = 16, labelH = 52; const sheet = document.createElement('canvas'); sheet.width = boards.length * (w + gap) + gap; sheet.height = Math.round(w * 1350 / 1080) + labelH + gap * 2;
  const s = sheet.getContext('2d'); s.fillStyle = '#0f141a'; s.fillRect(0, 0, sheet.width, sheet.height);
  boards.forEach((b, i) => {
    const r = window.STRender.render(b.layout, copy, { bg, logo: lg }, w); const x = gap + i * (w + gap);
    s.drawImage(r.canvas, x, gap);
    s.fillStyle = '#e6e9ee'; s.font = '600 13px sans-serif'; s.textBaseline = 'top'; s.textAlign = 'left'; s.fillText(b.name, x, gap + r.h + 10);
    s.fillStyle = '#8a94a3'; s.font = '11px sans-serif'; const words = (b.summary || 'teal panel in the lower third, words bottom, logo br, same photograph').split(', '); s.fillText(words.slice(0, 3).join(', ').slice(0, 52), x, gap + r.h + 28);
  });
  return sheet.toDataURL('image/png');
}, { boards, copy });
const out = new URL('./shot-variations.png', import.meta.url).pathname;
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote ' + out + ' (' + boards.length + ' compositions of one message; ' + boards.filter(b => /same photograph|before/.test(b.name)).length + ' on the original photograph)');
await browser.close(); server.kill();
