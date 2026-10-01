/* tools/studio-brand-gaps.py against the worker module served over HTTP in this process, stub models: the brand gaps of
 * the client and of each campaign become a request for approved material (a missing wordmark and logo are NEEDED BEFORE
 * PRODUCTION, a banned term inside an approved fact is a PLEASE CONFIRM), nothing is filled in; --analyse without a call
 * budget spends nothing and says how many references wait; with --approve-calls 1 exactly one analysis runs.
 * Run: node --experimental-sqlite tests/studio-brand-gaps-test.mjs */
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}), upsert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const realFetch = globalThis.fetch; const seen = { claude: 0 }; let analysable = false;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response('{}', { status: 500 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    seen.claude++; const sys = String(JSON.parse(init.body).system || '');
    const a = /describing one reference image/.test(sys) ? (analysable ? JSON.stringify({ summary: 'A teal panel with a bold headline', typography: 'bold' }) : 'no json here') : '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text: a }], stop_reason: 'end_turn' }), { status: 200 });
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
const runPy = args => new Promise(res => { const c = spawn('python3', [new URL('../tools/studio-brand-gaps.py', import.meta.url).pathname, '--key', 'full-key', '--worker', BASE, '--ns', 'mca'].concat(args)); let o = ''; c.stdout.on('data', d => { o += d; }); c.stderr.on('data', d => { o += d; }); c.on('close', code => res({ code, out: o })); });
console.log('studio-brand-gaps-test (tools/studio-brand-gaps.py)');
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, banned: [{ term: 'subsidy', allowNegated: false }], facts: [{ text: 'The subsidy is worth 9 billion', status: 'approved', source: 'ATO', campaign: 'hoof' }],
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] });
const P = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Gaps', brief: { objective: 'o', message: 'm' } });
await api('POST', '/studio/reference', { project: P.id, name: 'Old HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gaps-'));
const r1 = await runPy(['--out', tmp]);
ok(r1.code === 0, 'runs read-only (exit ' + r1.code + ')' + (r1.code ? ': ' + r1.out.slice(0, 300) : ''));
ok(/## Campaign: Hands Off Our Fuel/.test(r1.out) && /NEEDED BEFORE PRODUCTION: The approved Hands Off Our Fuel wordmark files/.test(r1.out), 'the missing HOOF wordmark is asked for before production');
ok(/## Campaign: Australian mining/.test(r1.out) && /NEEDED BEFORE PRODUCTION: The approved client logo/.test(r1.out), 'the missing logo is asked for on the campaign that carries it');
ok(/PLEASE CONFIRM: The banned term "subsidy" is used in approved fact/.test(r1.out), 'a banned term inside an approved fact is a question for the client');
ok(/mark placement rule for Hands Off Our Fuel/.test(r1.out) && !/bottom right is the rule/i.test(r1.out), 'placement is asked for, not assumed');
ok(/1 reference not analysed: Old HOOF tile/.test(r1.out), 'the unanalysed reference is named');
ok(fs.existsSync(path.join(tmp, 'brand-requests-mca.md')) && /# Brand information requested from Minerals Council of Australia/.test(fs.readFileSync(path.join(tmp, 'brand-requests-mca.md'), 'utf8')), 'the request is written as a document');
const c0 = seen.claude; const r2r = await runPy(['--analyse']);
ok(seen.claude === c0 && /1 reference waiting for analysis; nothing spent\. Re-run with --approve-calls 1/.test(r2r.out), 'without a call budget nothing is spent');
analysable = true; const c1 = seen.claude; const r3 = await runPy(['--analyse', '--approve-calls', '1']);
ok(seen.claude - c1 === 1 && /analysed Old HOOF tile: A teal panel/.test(r3.out), 'with a budget of one, exactly one analysis runs (' + (seen.claude - c1) + ' calls)');
const r4 = await runPy([]); ok(/Every reference is analysed/.test(r4.out), 'and the request no longer lists it');
server.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
