/* A backend-only fixture for the reliability harnesses: the worker module in this process over SQLite behind the D1
 * API (d1lite.mjs), in-memory KV, R2, Vectorize and Workers AI, and a recording fetch in place of every outbound
 * provider. No browser, no Playwright, no network: every "provider" answer is MOCKED and every outbound request is
 * recorded so a test can prove a rejected request never reached one.
 *
 *   const w = await workerEnv({ keys: {...}, env: {...} });
 *   const r = await w.call('POST', '/studio/project', body, 'full-key');   // -> { status, body }
 *   w.outbound                                                            // every outbound request [{ url, method }]
 *   w.answer(re, fn)                                                      // a canned answer for matching URLs
 */
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;

export async function workerEnv(o) {
  o = o || {};
  const kv = new Map(); const r2 = new Map(); const vectors = new Map();
  const env = Object.assign({
    MIND_DB: new D1Lite(),
    AXIOM_KV: {
      get: async k => (kv.has(k) ? kv.get(k) : null),
      put: async (k, v) => { kv.set(k, String(v)); },
      delete: async k => { kv.delete(k); },
      list: async ({ prefix, limit } = {}) => ({ keys: Array.from(kv.keys()).filter(k => !prefix || k.indexOf(prefix) === 0).slice(0, limit || 1000).map(name => ({ name })), list_complete: true }),
    },
    MIND_DOCS: {
      put: async (k, v, opt) => { const b = typeof v === 'string' ? Buffer.from(v) : Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v); r2.set(k, { v: b, o: opt }); },
      get: async k => { if (!r2.has(k)) return null; const x = r2.get(k); return { body: x.v, text: async () => x.v.toString(), json: async () => JSON.parse(x.v.toString()), arrayBuffer: async () => x.v.buffer.slice(x.v.byteOffset, x.v.byteOffset + x.v.byteLength), httpMetadata: (x.o || {}).httpMetadata }; },
      delete: async k => { r2.delete(k); },
      list: async ({ prefix } = {}) => ({ objects: Array.from(r2.keys()).filter(k => !prefix || k.indexOf(prefix) === 0).map(key => ({ key })), truncated: false }),
    },
    MIND_VECTORS: {
      upsert: async vs => { vs.forEach(v => vectors.set(v.id, v)); return { count: vs.length }; },
      insert: async vs => { vs.forEach(v => vectors.set(v.id, v)); return { count: vs.length }; },
      query: async () => ({ matches: [] }),
      deleteByIds: async ids => { ids.forEach(id => vectors.delete(id)); return {}; },
    },
    AI: { run: async (m, { text }) => ({ data: (Array.isArray(text) ? text : [text]).map(() => new Array(8).fill(0.1)) }) },
  }, o.env || {});
  if (o.keys !== null) env.AXIOM_KEYS = JSON.stringify(o.keys || { 'full-key': { n: 'Full', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } });

  const outbound = []; const answers = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const u = String(url && url.url ? url.url : url); const method = (init && init.method) || (url && url.method) || 'GET';
    outbound.push({ url: u, method });
    for (const a of answers) if (a.re.test(u)) return a.fn(u, init);
    return new Response(JSON.stringify({ ok: true, stub: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  const mod = await import(WORKER + '?env=' + Date.now() + Math.random());
  const handler = mod.default; const waits = [];
  const ctx = { waitUntil(p) { waits.push(Promise.resolve(p).catch(() => {})); }, passThroughOnException() {} };
  async function call(method, path, body, key, extraHeaders) {
    const headers = Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.' + (o.ip || 9) }, key ? { 'X-Axiom-Key': key } : {}, extraHeaders || {});
    const req = new Request((o.origin || 'https://newsaus.example.workers.dev') + path, { method, headers, body: body == null ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const res = await handler.fetch(req, env, ctx); const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    return { status: res.status, body: json, text, headers: res.headers };
  }
  return {
    env, kv, r2, vectors, mod, handler, ctx, call, outbound,
    answer(re, fn) { answers.unshift({ re, fn }); },
    settle: () => Promise.all(waits.splice(0)),
    slowReads(ms) { env.MIND_DB.delay = ms || 0; },   // every read waits: two requests started together both read before either writes
    restore() { globalThis.fetch = realFetch; },
  };
}

/* a tiny runner shared by the reliability harnesses */
export function suite(title) {
  let pass = 0, fail = 0; const failures = [];
  console.log(title);
  return {
    async t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n       ' + String(e && e.stack || e).split('\n').slice(0, 3).join('\n       ')); } },
    done() { console.log('\n' + pass + ' passed, ' + fail + ' failed'); return { pass, fail, failures }; },
  };
}
export const eq = (a, b, m) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) throw new Error((m || 'not equal') + ': ' + A + ' !== ' + B); };
export const ok = (v, m) => { if (!v) throw new Error(m || 'expected true'); };
