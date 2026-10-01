/* The plan engine's mechanics, drawn - NOT finished creative quality. The sandbox cannot reach the image model, so the
 * imagery here is synthetic (a drawn "photograph", a drawn "cutout"); what this sheet proves is that an expressive plan
 * from the art director - free text groups with emphasis, devices, image regions, a gradient field, a carousel, a
 * campaign wordmark by policy, a typography-led new design, a full-artwork version with its words marked as baked - comes
 * out of the worker as a layout the one renderer draws for preview and export. The finished renders with the real
 * models come from tools/studio-showcase.py against the live worker.
 * Run: node --experimental-sqlite tests/studio-plan-demo.mjs   -> tests/shot-plans.png */
import { chromium, DOCS } from './pw.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
const PORT = 8866 + Math.floor(Math.random() * 100); const W = 'https://newsaus.demo';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const v = r2.get(k).v; return typeof v === 'string' ? Buffer.from(v) : v; }, text: async () => { const v = r2.get(k).v; return typeof v === 'string' ? v : Buffer.from(v).toString(); }, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0',
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const text = (role, t, x, y, w, h, size, extra) => Object.assign({ type: 'text', role, text: t, x, y, w, h, size, weight: 750, color: '#FFFFFF', align: 'left', font: 'display' }, extra || {});
const PLANS = { critique: 'mechanics demo', options: [
  { name: 'Cinematic myth opener', concept: 'MYTH kicker, claim large, teal rule, the fact beneath', rationale: '', imagery: '', composition: '', typography: '', colour: '', devices: '', mark: 'wordmark', plan: { medium: 'photo-cinematic', approach: 'editable', story: 'the myth stated large over a dramatic road', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image', refs: [] }], elements: [text('kicker', 'MYTH', 6, 7, 20, 6, 3.2, { emphasis: 'caps', bg: '#C8102E', weight: 800 }), text('headline', '', 6, 15, 62, 30, 8.6), { type: 'rule', role: 'device', x: 6, y: 47, w: 30, h: 0.6, fill: '#0E6A6E' }, text('support', '', 6, 50, 56, 16, 3.1, { weight: 500, font: 'body' }), text('cta', '', 6, 84, 36, 6, 2.5, { bg: '#FFFFFF', color: '#0F1420', align: 'center', weight: 650, font: 'body' })] }, keeps: [], changes: [], needsImage: false, basis: [], refs: [], missing: [] },
  { name: 'Myth / fact carousel', concept: 'red myth field, teal fact field with a cutout', rationale: '', imagery: '', composition: '', typography: '', colour: '', devices: '', mark: 'wordmark', plan: { medium: 'carousel', approach: 'editable', story: 'myth then fact', mark: 'campaign', frames: [
    { name: 'Frame 1: the myth', copy: { headline: 'Myth: fuel tax credits are a subsidy for miners', support: '', cta: '' }, bg: { from: '#C8102E', to: '#7A0A1C', dir: 'down' }, regions: [], elements: [text('kicker', 'MYTH', 6, 10, 24, 7, 3.6, { emphasis: 'caps', weight: 800 }), text('headline', '', 6, 22, 88, 40, 9.5), text('caption', 'Swipe for the fact', 6, 88, 60, 5, 2.4, { weight: 500, font: 'body' })] },
    { name: 'Frame 2: the fact', copy: { headline: 'Fact: businesses do not pay a road fuel tax on fuel used off-road', support: 'Farmers, fishers, builders and tradies use fuel tax credits.', cta: 'handsoffourfuel.com.au' }, bg: '#0E6A6E', regions: [{ id: 'cut', role: 'cutout', x: 52, y: 48, w: 44, h: 40, fit: 'contain', prompt: 'A cutout of a header harvester', refs: [] }], elements: [text('kicker', 'FACT', 6, 10, 24, 7, 3.6, { emphasis: 'caps', weight: 800, bg: '#F4F1EA', color: '#0E6A6E' }), text('headline', '', 6, 22, 88, 26, 6.6), text('support', '', 6, 50, 44, 18, 3, { weight: 500, font: 'body' }), text('cta', '', 6, 84, 40, 6, 2.5, { bg: '#FFFFFF', color: '#0F1420', align: 'center', weight: 650, font: 'body' })] }] }, keeps: [], changes: [], needsImage: true, basis: [], refs: [], missing: [] },
  { name: 'The number does the work', concept: 'typography-led', rationale: '', imagery: '', composition: '', typography: '', colour: '', devices: '', mark: 'wordmark', plan: { medium: 'typographic', approach: 'editable', story: 'the figure fills the frame', mark: 'campaign', bg: { from: '#0E6A6E', to: '#083F42', dir: 'down' }, regions: [], elements: [{ type: 'text', role: 'free', text: '150,000', x: 4, y: 18, w: 92, h: 30, size: 15.5, weight: 800, color: '#F4F1EA', align: 'center', font: 'display', letterSpacing: -0.04 }, { type: 'text', role: 'free', text: 'businesses use fuel tax credits', x: 8, y: 50, w: 84, h: 10, size: 3.4, weight: 600, color: '#F4F1EA', align: 'center', font: 'body', emphasis: 'underline' }, { type: 'text', role: 'headline', x: 8, y: 62, w: 84, h: 16, size: 4.2, color: '#FFFFFF', align: 'center' }, { type: 'text', role: 'cta', x: 30, y: 84, w: 40, h: 6, size: 2.5, bg: '#FFFFFF', color: '#0F1420', align: 'center', font: 'body' }] }, keeps: [], changes: [], needsImage: false, basis: [], refs: [], missing: [] },
  { name: 'Painted poster (full artwork)', concept: 'the image model paints the whole piece', rationale: '', imagery: '', composition: '', typography: '', colour: '', devices: '', mark: 'wordmark', plan: { medium: 'illustration', approach: 'artwork', story: 'a screen-printed poster', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'poster', refs: [] }], elements: [text('headline', '', 8, 10, 84, 30, 8.5, { align: 'center' }), text('support', '', 8, 44, 84, 14, 3, { align: 'center' })] }, keeps: [], changes: [], needsImage: true, basis: [], refs: [], missing: [] }] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) { const body = JSON.parse(init.body); const sys = String(body.system || ''); const answer = /art director of an Australian political communications agency, briefing/.test(sys) ? PLANS : {}; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' }), { status: 200 }); }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function api(method, path, body) { const r = new Request(W + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }); return (await handler.fetch(r, env, ctx)).json(); }
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', identity: 'MYTH in red, FACT in teal' }], logoB64: PNG, logoMime: 'image/png' });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const p = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Plan mechanics', brief: { objective: 'answer the subsidy framing', message: 'small businesses use them' } });
r2.set('studio/demo/fisher.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const a = await api('POST', '/studio/asset', { project: p.id, family: 'Campaign set', channel: 'instagram', format: '4:5', title: 'Instagram portrait', copy: { headline: 'Fuel tax credits are not a subsidy for miners', support: 'Farmers, fishers, builders, wineries, tourism operators and tradies use Fuel Tax Credits.', cta: 'handsoffourfuel.com.au', alt: 'tile' }, image: { key: 'studio/demo/fisher.png', url: '', model: 'demo', size: '2K' }, mode: 'composition' });
const A = a.asset.id; const house = a.asset.versions[0];
let j = (await api('POST', '/studio/job', { project: p.id, asset: A, stage: 'concepts', input: { asset: A, feedback: 'variations', mode: 'explore' }, idem: 'demo' })).job;
for (let i = 0; i < 4 && j.state !== 'done' && j.state !== 'failed'; i++) j = (await api('POST', '/studio/job/step', { id: j.id })).job;
if (j.state !== 'done') throw new Error('concepts failed: ' + j.error);
const ev = (await api('GET', '/studio/get?id=' + p.id)).thread.filter(e => e.kind === 'concepts').pop();
// the artwork option goes through the render path so the version carries its baked marks
await api('POST', '/studio/concept/apply', { project: p.id, eid: ev.eid, index: 3, render: true });
for (const jb of (await api('GET', '/studio/jobs?project=' + p.id)).jobs.filter(x => x.state === 'queued')) { let jj = jb; for (let i = 0; i < 4 && jj.state !== 'done' && jj.state !== 'failed'; i++) jj = (await api('POST', '/studio/job/step', { id: jj.id })).job; }
const art = (await api('GET', '/studio/get?id=' + p.id)).assets.find(x => x.id === A); const artV = art.versions[art.versions.length - 1];
const boards = [{ name: 'House default (before)', layout: house.layout, copy: house.copy, bg: 'photo' }]
  .concat([{ name: ev.options[0].name + ' (same photograph)', layout: ev.options[0].layout, copy: house.copy, bg: 'photo' },
    { name: 'Carousel frame 1 (no imagery)', layout: Object.assign({}, ev.options[1].layout.frames[0].layout, { frame: { index: 0, of: 2 } }), copy: Object.assign({}, house.copy, ev.options[1].layout.frames[0].copy), bg: null },
    { name: 'Carousel frame 2 (cutout region)', layout: Object.assign({}, ev.options[1].layout.frames[1].layout, { frame: { index: 1, of: 2 } }), copy: Object.assign({}, house.copy, ev.options[1].layout.frames[1].copy), bg: null, cut: true },
    { name: 'New design: typography-led', layout: ev.options[2].layout, copy: house.copy, bg: null },
    { name: 'Full artwork (words baked: ' + (artV.layout.baked || []).join(', ') + ')', layout: artV.layout, copy: artV.copy, bg: 'poster' }]);
boards.forEach(b => console.log('  ' + b.name + ': ' + (b.layout.mediumName || b.layout.templateName) + ', ' + (b.layout.layers || []).length + ' layers' + ((b.layout.unsupported || []).length ? ' [cannot draw: ' + b.layout.unsupported.join('; ') + ']' : '')));

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1800, height: 900 } });
await page.setContent('<!doctype html><html><body style="margin:0;background:#0f141a"></body></html>');
await page.addScriptTag({ url: 'http://127.0.0.1:' + PORT + '/studio-render.js' });
await page.waitForFunction(() => window.STRender);
const png = await page.evaluate(async ({ boards }) => {
  const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const im = new Image(); im.src = c.toDataURL(); return new Promise(r => { im.onload = () => r(im); }); };
  const photo = await mk(1080, 1350, (c) => { const sky = c.createLinearGradient(0, 0, 0, 760); sky.addColorStop(0, '#3a3f4a'); sky.addColorStop(1, '#c98a4b'); c.fillStyle = sky; c.fillRect(0, 0, 1080, 760); c.fillStyle = '#5a4634'; c.fillRect(0, 760, 1080, 590); c.fillStyle = '#2a2520'; c.fillRect(700, 620, 300, 180); c.fillRect(760, 540, 180, 90); c.fillStyle = '#1a1510'; [740, 960].forEach(x => { c.beginPath(); c.arc(x, 810, 60, 0, Math.PI * 2); c.fill(); }); c.fillStyle = 'rgba(255,200,140,.25)'; c.fillRect(0, 700, 1080, 60); });
  const poster = await mk(1080, 1350, (c) => { c.fillStyle = '#0E6A6E'; c.fillRect(0, 0, 1080, 1350); c.fillStyle = '#F4F1EA'; for (let i = 0; i < 14; i++) c.fillRect(0, 700 + i * 44, 1080, 10 - i * 0.6); c.font = '800 96px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#F4F1EA'; c.fillText('NOT A SUBSIDY', 540, 300); c.font = '600 44px sans-serif'; c.fillText('(words painted by the image model)', 540, 400); });
  const cut = await mk(800, 600, (c) => { c.fillStyle = '#2f7d32'; c.fillRect(100, 250, 600, 200); c.fillStyle = '#1b4d1d'; c.fillRect(140, 150, 300, 120); c.fillStyle = '#111'; [200, 600].forEach(x => { c.beginPath(); c.arc(x, 470, 90, 0, Math.PI * 2); c.fill(); }); });
  const logo = await mk(380, 190, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 380, 190); c.fillStyle = '#0E6A6E'; c.font = '700 60px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('MCA', 190, 95); });
  const mark = await mk(520, 190, (c) => { c.fillStyle = '#F4F1EA'; c.fillRect(0, 0, 520, 190); c.fillStyle = '#C8102E'; c.font = '800 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('HANDS OFF OUR FUEL', 260, 95); });
  const w = 280, gap = 14, labelH = 56; const sheet = document.createElement('canvas'); sheet.width = boards.length * (w + gap) + gap; sheet.height = Math.round(w * 1350 / 1080) + labelH + gap * 2;
  const s = sheet.getContext('2d'); s.fillStyle = '#0f141a'; s.fillRect(0, 0, sheet.width, sheet.height);
  boards.forEach((b, i) => {
    const images = { bg: b.bg === 'photo' ? photo : b.bg === 'poster' ? poster : null, logo, wordmark: mark }; if (b.cut) images.cut = cut;
    const r = window.STRender.render(b.layout, b.copy, images, w); const x = gap + i * (w + gap);
    s.drawImage(r.canvas, x, gap);
    s.fillStyle = '#e6e9ee'; s.font = '600 12px sans-serif'; s.textBaseline = 'top'; s.textAlign = 'left'; s.fillText(b.name.slice(0, 44), x, gap + r.h + 10);
    s.fillStyle = '#8a94a3'; s.font = '11px sans-serif'; s.fillText(((b.layout.mediumName || b.layout.templateName || '') + (b.layout.approach ? ', ' + b.layout.approach : '')).slice(0, 48), x, gap + r.h + 28);
    s.fillText('mechanics sheet, synthetic imagery', x, gap + r.h + 42);
  });
  return sheet.toDataURL('image/png');
}, { boards });
const out = new URL('./shot-plans.png', import.meta.url).pathname;
fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
console.log('wrote ' + out + ' (' + boards.length + ' boards; the imagery is synthetic - run tools/studio-showcase.py against the live worker for finished renders)');
await browser.close(); server.kill();
