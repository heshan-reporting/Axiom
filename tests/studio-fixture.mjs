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
export function pngGradient(w, h, top = [232, 138, 74], bottom = [28, 46, 58]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0; const t = y / (h - 1); const hz = y > h * 0.62;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 3 + 1) + 1 + x * 3; const k = hz ? 0.55 : 1;
      raw[o] = Math.round((top[0] + (bottom[0] - top[0]) * t) * k); raw[o + 1] = Math.round((top[1] + (bottom[1] - top[1]) * t) * k); raw[o + 2] = Math.round((top[2] + (bottom[2] - top[2]) * t) * k);
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
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

/* ------------------------------------------------------------ what the stub models answer */
export const RELEASE = 'MEDIA RELEASE - 30 September 2026\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.\n\nMCA Chief Executive Officer Tania Constable said fuel tax credits were not a subsidy. "Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.\n\nThe analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators.\n\nENDS';
const LEDGER = { headline: 'Fuel tax credits keep regional Australia moving', claims: [
  { text: 'mining paid $74 billion in company tax and royalties in 2023-24', value: 74, unit: 'billion', subject: 'tax and royalties', period: '2023-24', passage: 'p3' },
  { text: 'the credit is used by more than 150,000 businesses of all sizes', value: 150000, unit: 'businesses', passage: 'p5' }],
  brief: { objective: 'Answer the subsidy framing while the credit is in the news', audience: 'Regional voters and MPs', message: 'The credit is not a subsidy', action: 'Read the facts', deliverables: 'Organic posts' } };
const DIRS = { directions: [
  { title: 'The plain ask', message: 'The credit is not a subsidy; it returns a tax that never applied.', insight: 'Subsidy sounds like a handout.', headline: 'Not a subsidy. A tax that never applied.', opening: 'Fuel tax credits are not a subsidy.', visual: 'Restrained documentary photography of a regional road', rationale: 'Plain language', claims: ['c1'], uncertainty: 'No figure for the credit itself' },
  { title: 'Who it really is', message: 'The credit is used by 150,000 businesses of all sizes.', insight: 'Naming tradies moves the frame.', headline: 'Farmers. Tradies. Tourism operators.', opening: 'Who uses the fuel tax credit?', visual: 'A tradie at a rural bowser', rationale: 'Approved usage wording', claims: ['c2'], uncertainty: 'Portraits need releases' }] };
const T = (id, role, x, y, w, h, size, extra) => Object.assign({ id, type: 'text', role, x, y, w, h, size, color: '#FFFFFF' }, extra || {});
/* a photographic plan (a background region the image model fills) and a typographic one (no imagery at all) */
const PHOTO_PLAN = { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A quiet regional road at dusk, no machinery, open sky in the upper third' }],
  elements: [{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 5, y: 56, w: 70, h: 36, fill: '#0E6A6E', opacity: 0.92 }, T('hl', 'headline', 8, 59, 64, 16, 5.2), T('sp', 'support', 8, 76, 64, 8, 2.6), T('cta', 'cta', 8, 85, 40, 5, 2.4)] };
const TYPE_PLAN = { medium: 'typographic', approach: 'editable', mark: 'campaign', bg: '#0E6A6E', regions: [],
  elements: [{ id: 'rule', type: 'shape', role: 'rule', shape: 'rect', x: 8, y: 14, w: 18, h: 1.2, fill: '#F4F1EA' }, T('hl', 'headline', 8, 20, 84, 30, 6.4), T('sp', 'support', 8, 56, 70, 12, 2.8), T('cta', 'cta', 8, 74, 50, 6, 2.6)] };
const HEAD = { linkedin: 'Not a subsidy. A tax that never applied.', facebook: 'Not a subsidy. A tax that never applied.', instagram: 'Farmers, tradies and tourism operators use it', x: 'Not a subsidy.' };
const pieces = user => { const none = /NO IMAGERY/.test(user); return { pieces: ['linkedin', 'facebook', 'instagram', 'x'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: HEAD[c], support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.', alt: 'Teal fact panel over a regional road at dusk', visual: 'Regional road at dusk', claims: ['c1'], hashtags: [], plan: JSON.parse(JSON.stringify(none ? TYPE_PLAN : PHOTO_PLAN)) })) }; };
const decide = user => { const A = Array.from(user.matchAll(/^\[(a[a-z0-9]+)\]/gm)).map(m => m[1]); const ins = (user.match(/TEAM LEAD[^\n]*\):\n([^\n]+)/) || [])[1] || '';
  if (/adapt/i.test(ins)) { const want = /story|9:16/i.test(ins) ? { channel: 'instagram', format: '9:16' } : { channel: 'x', format: '16:9' }; return { kind: 'adapt', reply: 'Adapted the master for ' + want.format + ', the words kept.', adapt: { from: A[0], pieces: [Object.assign({}, want, { copy: { caption: 'Not a subsidy. A road tax that never applied.', alt: 'the same tile, re-composed for ' + want.format } })] }, memory: { standing: false } }; }
  return { kind: 'text', reply: 'Headline sharpened; layout and image kept.', changes: [{ asset: A[0], copy: { headline: 'Not a subsidy. Never was.' }, note: 'sharper' }], memory: { standing: false } }; };
const CONCEPTS = { critique: 'The words sit low; the sky is unused.', options: [
  { name: 'Right column', concept: 'Words in the quiet right third', rationale: 'The eye lands on the road first', composition: 'right column', keeps: ['photograph', 'words'], changes: ['placement'], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [{ id: 'col', type: 'shape', role: 'panel', shape: 'rect', x: 58, y: 0, w: 42, h: 100, fill: '#0E6A6E', opacity: 0.85 }, T('hl', 'headline', 61, 8, 36, 40, 4.6), T('sp', 'support', 61, 52, 36, 20, 2.6), T('cta', 'cta', 61, 80, 36, 6, 2.4)] } },
  { name: 'Top band', concept: 'A band across the sky', rationale: 'The road keeps the lower two thirds', composition: 'top band', keeps: ['photograph', 'words'], changes: ['panel'], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [{ id: 'band', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 0, w: 100, h: 36, fill: '#0E6A6E' }, T('hl', 'headline', 5, 4, 90, 16, 4.6), T('sp', 'support', 5, 21, 62, 8, 2.4), T('cta', 'cta', 70, 24, 26, 6, 2.4)] } }] };
const INSPECT = { fidelity: 4, hierarchy: 3, readability: 4, relevance: 4, identity: 4, reasons: { fidelity: 'The road carries the regional idea', hierarchy: 'The support line competes with the headline', readability: 'White on teal reads', relevance: 'Regional fuel use is the subject', identity: 'Teal and the mark are the campaign' }, words: { present: [], wrong: [] }, issues: [{ text: 'The support line sits close to the headline', severity: 'minor' }], verdict: 'fix', fix: { kind: 'design', instruction: 'Add a line of space between the headline and the support line; keep everything else.' }, note: 'Close; one spacing fix.' };
const SUGGEST = { design: [{ text: 'Move the panel to the right third and let the road lead.', why: 'The subject is covered', refs: [] }], image: [{ text: 'The same road a little later, the sky quieter.', why: 'Room for the words' }] };
const STRATEGY = { problem: 'Voters hear subsidy and assume a handout.', audience: { who: 'Regional voters', now: 'It is a handout', wanted: 'It is a road tax never meant for off-road fuel', insight: 'Farmers claim the same credit' }, idea: 'It is your tractor too', proposition: 'Not a subsidy: a road tax returned', proof: [], tone: 'plain, regional', avoid: [], risks: [], measures: [], questions: [] };
export function answerFor(sys, user) {
  return /creative strategist/.test(sys) ? STRATEGY : /build a claim ledger/.test(sys) ? LEDGER : /genuinely different directions/.test(sys) ? DIRS : /producing a coordinated set/.test(sys) ? pieces(user) : /decide what the instruction asks/.test(sys) ? decide(user) : /suggesting the next things the team might ask for/.test(sys) ? SUGGEST : /art director inspecting a rendered social tile/.test(sys) ? INSPECT : /art director of an Australian political communications agency/.test(sys) ? CONCEPTS : {};
}

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
  const holds = []; const seen = [];
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
  function hold(re) { let release; const wait = new Promise(r => { release = r; }); const h = { re, wait }; holds.push(h); return () => { release(); holds.splice(holds.indexOf(h), 1); }; }
  async function close() { await browser.close(); server.kill(); globalThis.fetch = realFetch; }
  return { env, handler, api, calls, providers, setProvider, open, close, hold, seen, r2, kv, PORT };
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
