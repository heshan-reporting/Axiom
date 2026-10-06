/* A shared fixture for the Creative Studio browser journeys: the worker module in this process (SQLite behind the
 * D1 API, stub KV and R2), stub Claude and Gemini that answer by what the prompt asks and can be switched to fail,
 * hang or be missing, a real photograph-sized gradient PNG (so the renderer has imagery worth measuring), the docs
 * served by Python, and a page opener that routes the page's worker calls into the module.
 * Everything here is MOCKED: no provider is reached and nothing is spent. A journey that passes here proves the
 * page and the worker agree; it does not prove what a live model would answer. */
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { chromium, DOCS } from './pw.mjs';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
export const W = 'https://newsaus.heshan-998.workers.dev';

/* ------------------------------------------------------------ a real PNG: a dusk-sky gradient over a darker ground */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }
export function pngGradient(w, h, top = [232, 138, 74], bottom = [28, 46, 58], flat) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; const t = h > 1 ? y / (h - 1) : 0; const hz = !flat && y > h * 0.62;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3; const k = hz ? 0.55 : 1;
      raw[o] = Math.round((top[0] + (bottom[0] - top[0]) * t) * k); raw[o + 1] = Math.round((top[1] + (bottom[1] - top[1]) * t) * k); raw[o + 2] = Math.round((top[2] + (bottom[2] - top[2]) * t) * k);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
/** a solid block of one colour: a mark whose every pixel is ink and reads as one tone (the gradient's darker lower band is not wanted on a mark) */
export const pngSolid = (w, h, rgb) => pngGradient(w, h, rgb, rgb, true);
/** width and height read from a PNG's header, and whether the signature is right */
export function pngSize(buf) { const b = Buffer.from(buf); const sig = b.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); return { ok: sig && b.slice(12, 16).toString('ascii') === 'IHDR', w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }
/** the entries of a stored (uncompressed) zip as the renderer writes it: name and bytes */
export function unzipStored(buf) {
  const b = Buffer.from(buf); const out = []; let o = 0;
  while (o + 30 <= b.length && b.readUInt32LE(o) === 0x04034b50) {
    const method = b.readUInt16LE(o + 8); const size = b.readUInt32LE(o + 18); const nl = b.readUInt16LE(o + 26); const xl = b.readUInt16LE(o + 28);
    const name = b.slice(o + 30, o + 30 + nl).toString('utf8'); const start = o + 30 + nl + xl;
    out.push({ name, method, data: b.slice(start, start + size) }); o = start + size;
  }
  return out;
}
export const PHOTO = pngGradient(320, 320).toString('base64');
const LOGO = pngGradient(40, 16, [255, 255, 255], [240, 240, 240]).toString('base64');

import { RELEASE, answerFor } from './studio-answers.mjs';
export { RELEASE, answerFor };
/* ------------------------------------------------------------ the fixture */
export async function makeStudio(opts) {
  opts = opts || {};
  const PORT = opts.port || 8790;
  const kv = new Map(); const r2 = new Map();
  /* calls: what the stub providers were asked, by kind. providers: switch each one to 'ok', 'down' (a 503 from the
     provider), 'slow' (answers after slowMs) or 'missing' (the key removed from the worker's environment). */
  const calls = { gemini: 0, anthropic: 0, bySys: [] };
  const providers = { claude: 'ok', gemini: 'ok', slowMs: 1500 };
  const env = {
    MIND_DB: new D1Lite(),
    AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
    AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
    MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
    MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: typeof v === 'string' ? v : Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, text: async () => String(r2.get(k).v), arrayBuffer: async () => { const x = r2.get(k).v; return typeof x === 'string' ? new TextEncoder().encode(x).buffer : x.buffer.slice(x.byteOffset, x.byteOffset + x.byteLength); }, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); }, head: async k => (r2.has(k) ? { size: 1 } : null) },
    AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
    ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: opts.inspect === false ? '0' : undefined,
  };
  const keys = { claude: env.ANTHROPIC_API_KEY, gemini: env.GEMINI_KEY };
  const setProvider = (name, state) => { providers[name] = state; if (name === 'claude') { if (state === 'missing') delete env.ANTHROPIC_API_KEY; else env.ANTHROPIC_API_KEY = keys.claude; } if (name === 'gemini') { if (state === 'missing') delete env.GEMINI_KEY; else env.GEMINI_KEY = keys.gemini; } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    if (u.indexOf('generativelanguage') >= 0) {
      if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
      calls.gemini++;
      if (providers.gemini === 'down') return new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded. Please try again later.' } }), { status: 503 });
      if (providers.gemini === 'slow') await new Promise(r => setTimeout(r, providers.slowMs));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PHOTO } }] } }] }), { status: 200 });
    }
    if (u.indexOf('api.anthropic.com/v1/models') >= 0) return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }), { status: 200 });
    if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
      calls.anthropic++;
      const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
      calls.bySys.push(sys.slice(0, 80));
      if (providers.claude === 'down') return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 });
      if (providers.claude === 'slow') await new Promise(r => setTimeout(r, providers.slowMs));
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
    }
    if (u.startsWith('http://127.0.0.1')) return realFetch(url, init);
    return new Response('', { status: 404 });
  };
  const mod = await import(WORKER + '?fixture=' + Date.now()); const handler = mod.default; const ctx = { waitUntil() {} };
  async function api(method, path, body, key = 'full-key') {
    const r = new Request(W + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
    const res = await handler.fetch(r, env, ctx); const t = await res.text(); try { return Object.assign(JSON.parse(t), { _status: res.status }); } catch (e) { return { _status: res.status, _text: t }; }
  }
  // two clients with their own kits: MCA with the HOOF campaign and its logo, AEP with nothing in common
  await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, rules: 'Label the answer Fact, never Busted.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }], facts: [{ text: 'Mining directly employs more than 300,000 Australians', source: 'ABS', status: 'approved' }], banned: [{ term: 'subsidy', allowNegated: true, use: 'credit' }], logoB64: LOGO, logoMime: 'image/png' });
  await api('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', palette: { primary: '#2F7FD6' }, campaigns: [{ id: 'gas', name: 'Gas for the transition' }], facts: [{ text: 'Gas supplies a quarter of Australia\'s energy', source: 'DCCEEW', status: 'approved' }] });
  await api('GET', '/studio/status');

  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const browser = await chromium.launch();
  /* hold: a path pattern whose requests wait until released, to make a request "still running" on purpose */
  const holds = []; const seen = []; const fails = [];
  async function open(o) {
    o = o || {};
    const ctxB = await browser.newContext({ viewport: o.viewport || { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: o.reducedMotion || 'no-preference' });
    const page = await ctxB.newPage();
    page.errors = [];
    page.on('pageerror', e => { page.errors.push(String(e.message)); if (!o.quiet) console.log('  [pageerror] ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)); });
    if (!o.keepStorage) await page.addInitScript(({ W, role, store }) => { if (!sessionStorage.getItem('__fx')) { sessionStorage.setItem('__fx', '1'); Object.keys(localStorage).filter(k => k.indexOf('ax_studio') === 0).forEach(k => localStorage.removeItem(k)); Object.keys(store || {}).forEach(k => localStorage.setItem(k, store[k])); } localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', role === 'read' ? 'read-key' : 'full-key'); if (role) window.AX_ROLE = role; }, { W, role: o.role, store: o.store });
    await page.route(/^https:\/\/(?!127\.0\.0\.1)[^/]+\//, async route => {
      const rq = route.request(); const u = rq.url();
      if (!u.startsWith(W)) return route.abort();
      const path = u.slice(W.length); seen.push({ method: rq.method(), path, body: rq.postData() });
      for (const h of holds) if (h.re.test(path)) await h.wait;
      // a request made to fail on purpose (once): the page must cope and retry, never pretend it succeeded
      const fi = fails.findIndex(f => f.re.test(path)); if (fi >= 0) { const f = fails.splice(fi, 1)[0]; f.hit++; return route.fulfill({ status: f.status || 500, headers: { 'content-type': 'application/json' }, body: JSON.stringify(f.body || { error: 'internal_error', detail: 'made to fail by the harness' }) }); }
      const headers = rq.headers(); const body = rq.postDataBuffer();
      const res = await handler.fetch(new Request(u, { method: rq.method(), headers, body: body && rq.method() !== 'GET' ? body : undefined }), env, ctx);
      const hh = {}; res.headers.forEach((v, k) => { hh[k] = v; });
      return route.fulfill({ status: res.status, headers: hh, body: Buffer.from(await res.arrayBuffer()) });
    });
    await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof go === 'function' && window.AXUI && window.STRender && typeof studioInit === 'function');
    if (o.go !== false) { await page.evaluate(() => go('studio')); await page.waitForSelector('#studio-root .st-head'); }
    page.ctxB = ctxB; return page;
  }
  function failNext(re, status, body) { const f = { re, status, body, hit: 0 }; fails.push(f); return f; }
  function hold(re) { let release; const wait = new Promise(r => { release = r; }); const h = { re, wait }; holds.push(h); return () => { release(); holds.splice(holds.indexOf(h), 1); }; }
  async function close() { await browser.close(); server.kill(); globalThis.fetch = realFetch; }
  return { env, handler, api, calls, providers, setProvider, open, close, hold, failNext, seen, r2, kv, PORT };
}

/* ------------------------------------------------------------ a tiny test runner */
export function runner(title) {
  let pass = 0, fail = 0; const results = [];
  console.log(title);
  return {
    async t(name, fn) { const t0 = Date.now(); try { await fn(); pass++; results.push({ name, ok: true, ms: Date.now() - t0 }); console.log('  ok   ' + name); } catch (e) { fail++; results.push({ name, ok: false, err: String(e && e.message || e) }); console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 4).join('\n       ')); } },
    done() { console.log('\n' + pass + ' passed, ' + fail + ' failed'); return { pass, fail, results }; },
  };
}
export const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
export const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

/* ------------------------------------------------------------ S18: the Design workspace's places, by name
   The inspector has two modes (Properties, Creative Director) and two controls (Checks, History); the words and the brand are
   tools in the dock (Text, Brand), as are Design, Images and Layers. place(page, name) opens the place an older harness called
   by its S17 name: Copy -> the Text tool, Quality -> Checks, Versions -> History, Art Director / Partner -> Creative Director. */
const RT = '#studio-root ';
const PLACE = { copy: ['tool', 'Text'], text: ['tool', 'Text'], brand: ['tool', 'Brand'], design: ['tool', 'Design'], images: ['tool', 'Images'], layers: ['tool', 'Layers'],
  quality: ['tab', 'checks'], checks: ['tab', 'checks'], versions: ['tab', 'history'], history: ['tab', 'history'], properties: ['tab', 'properties'],
  'art director': ['tab', 'director'], partner: ['tab', 'director'], 'creative director': ['tab', 'director'] };
export async function tool(page, name) {
  const b = page.locator(RT + '.st-dock-btn:has-text("' + name + '")').first();
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  await page.waitForSelector(RT + '.st-library[data-tool="' + name.toLowerCase() + '"]');
}
export async function place(page, name) {
  const p = PLACE[String(name).toLowerCase()]; if (!p) throw new Error('no Studio place called ' + name);
  if (p[0] === 'tool') return tool(page, p[1]);
  const tab = await page.$(RT + '#st-tabbtn-' + p[1]);
  if (tab) { await tab.click(); await page.waitForSelector(RT + '#st-tabbtn-' + p[1] + '[aria-selected="true"]'); }
  // the S17 Art Director tab showed the thread: its S18 place is the Creative Director's Conversation
  if (/^(art director|partner)$/i.test(name)) { const c = await page.$(RT + '.st-cd-tab:has-text("Conversation")'); if (c) await c.click(); await page.waitForSelector(RT + '.st-cd-conv'); const w = await page.$(RT + '.st-cd-convhead button:has-text("Whole project")'); if (w) await w.click(); }
}
