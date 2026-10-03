/* tools/studio-showcase.py end to end against the worker module served over HTTP in this process, with stub models:
 * without --approve-budget it prints the estimate and spends nothing; with a budget it produces, composes the tiles with
 * the app renderer before the art director inspects them, holds renders past the cap, and writes an index that compares
 * composed tiles and discloses model, resolution, references and whether the inspection saw the composed tile.
 * Run: node --experimental-sqlite tests/studio-showcase-test.mjs */
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v.buffer.slice(r2.get(k).v.byteOffset, r2.get(k).v.byteOffset + r2.get(k).v.byteLength), text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const realFetch = globalThis.fetch; const seen = { gemini: 0, inspect: [] };
const T = (role, t, x, y, w, h, size) => ({ type: 'text', role, text: t, x, y, w, h, size, weight: 750, color: '#FFFFFF' });
const PLAN = { medium: 'photo-cinematic', approach: 'editable', story: 'a dusk paddock', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a paddock at dusk', refs: [] }], elements: [T('kicker', 'MYTH', 6, 8, 30, 6, 3.2), T('headline', '', 6, 18, 80, 30, 8), T('support', '', 6, 52, 70, 10, 3)] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { seen.gemini++; return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); const sys = String(body.system || ''); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    let a = {};
    if (/build a claim ledger/.test(sys)) a = { headline: 'Fuel tax credits', claims: [], brief: {} };
    else if (/art director inspecting a rendered social tile/.test(sys)) { seen.inspect.push(/COMPOSED TILE/.test(user)); a = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 4, words: { present: [], wrong: [] }, issues: ['ok'], verdict: 'fix', fix: { kind: 'design', instruction: 'Tighten.' } }; }
    else if (/producing a coordinated set/.test(sys)) a = { pieces: [{ channel: 'instagram', headline: 'Fuel tax credits are not a subsidy', support: 'Businesses of all sizes use them.', cta: 'Learn more', caption: 'Not a subsidy.', alt: 'tile', plan: PLAN }] };
    else if (/briefing/.test(sys)) a = { critique: 'c', options: [{ name: 'Dusk', concept: 'c', rationale: 'r', imagery: 'i', plan: Object.assign({}, PLAN, { regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a new road at dawn', refs: [] }] }), needsImage: true, basis: [], refs: [], missing: [] }, { name: 'Type', concept: 'c', rationale: 'r', imagery: 'none', plan: { medium: 'typographic', approach: 'editable', story: 't', mark: 'campaign', bg: '#0E6A6E', regions: [], elements: [T('headline', '', 6, 10, 88, 50, 10)] }, needsImage: false, basis: [], refs: [], missing: [] }] };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return realFetch(url, init);
};
const mod = await import(new URL('../axiomworkerv4.js', import.meta.url).href); const handler = mod.default;
const server = http.createServer(async (rq, rs) => { const chunks = []; for await (const c of rq) chunks.push(c); const body = Buffer.concat(chunks);
  const res = await handler.fetch(new Request('http://127.0.0.1' + rq.url, { method: rq.method, headers: rq.headers, body: rq.method === 'GET' ? undefined : body }), env, { waitUntil() {} });
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); rs.writeHead(res.status, h); rs.end(Buffer.from(await res.arrayBuffer())); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
const api = async (m, p, b) => (await realFetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: b ? JSON.stringify(b) : undefined })).json();
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
await api('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian mining' }] });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const runPy = (extra) => new Promise(res => { const out = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-')); const c = spawn('python3', [new URL('../tools/studio-showcase.py', import.meta.url).pathname, '--key', 'full-key', '--worker', BASE, '--only', 'hoof', '--out', out, '--keep'].concat(extra), { env: Object.assign({}, process.env) }); let so = '', se = ''; c.stdout.on('data', x => { so += x; }); c.stderr.on('data', x => { se += x; }); c.on('close', code => res({ code, so, se, out })); });
const dry = await runPy([]);
ok(dry.code === 0 && /Estimate for 1 case/.test(dry.so) && /Nothing was run\. Approve a render budget/.test(dry.so), 'without approval: the estimate and nothing else - ' + dry.so.slice(-200) + dry.se.slice(-300));
ok(seen.gemini === 0 && (await api('GET', '/studio/list?ns=mca')).projects.length === 0, 'no project, no render');
const run = await runPy(['--approve-budget', '1']);
ok(run.code === 0, 'the approved run finished: ' + run.se.slice(-400));
ok(/Approved: at most 1 renders/.test(run.so) && /held: the approved budget of 1 renders is spent/.test(run.so), 'the second render is held, not run');
ok(seen.gemini === 1, 'exactly the approved number of renders: ' + seen.gemini);
ok(/composed 1 tile with the app renderer/.test(run.so), 'tiles composed with the app renderer');
ok(seen.inspect.length >= 1 && seen.inspect.every(Boolean), 'every inspection saw the composed tile: ' + JSON.stringify(seen.inspect));
const idx = fs.readFileSync(path.join(run.out, 'index.html'), 'utf8');
ok(/Composed tiles \(the app renderer/.test(idx) && /-composed\.png/.test(idx) && /the composed tile/.test(idx) && /approves nothing/.test(idx), 'the index compares composed tiles and says the inspection approves nothing');
const sj = JSON.parse(fs.readFileSync(path.join(run.out, 'showcase.json'), 'utf8'))[0];
ok(sj.composedBefore.length === 1 && fs.existsSync(path.join(run.out, sj.composedBefore[0].file)), 'the first production tile was composed too');
ok(/renders spent: 1 of 1 approved; held: j/.test(run.so), 'the summary names what was spent and held');
server.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
