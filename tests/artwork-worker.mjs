/* Artwork memory: an image is kept even when the describer fails, the reason is
 * reported, and POST /engine/artwork/describe fills the description in later;
 * the Mind document can go to the creative shelf. Run: node --experimental-sqlite artwork-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map(); const vecNs = [];
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [] }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async rows => { rows.forEach(r => vecNs.push(r.namespace)); return {}; } },
  MIND_DOCS: { put: async (k, v) => { r2.set(k, v); }, get: async k => (r2.has(k) ? { arrayBuffer: async () => r2.get(k) } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
let gemini = 'fail'; const models = [];
globalThis.fetch = async (url, init) => {
  if (String(url).indexOf('generativelanguage') >= 0) {
    models.push((String(url).match(/models\/([^:]+):/) || [])[1]);
    if (gemini === 'fail') return new Response(JSON.stringify({ error: { code: 429, message: 'Resource has been exhausted (e.g. check quota).' } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Square tile, gold haul truck carrying a Medicare card in a green park; headline in gold; MCA logo bottom right.' }] } }] }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; try { d = await res.json(); } catch (e) { d = null; } return { status: res.status, d };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const png = Buffer.from('89504e470d0a1a0a' + '00'.repeat(120), 'hex').toString('base64');

console.log('artwork-worker harness');
let id = '';
await t('an artwork is stored even when the describer fails; the answer says why and how to retry', async () => {
  const r = await req('POST', '/engine/artwork', { ns: 'mca', title: 's1 artwork 01', imageB64: png, mime: 'image/png', mindNs: 'mca_creative', meta: { path: 'artwork/myth-busting/s1-artwork-01.jpg', campaign: 'myth-busting' } });
  eq(r.status, 200, JSON.stringify(r.d).slice(0, 200)); eq(r.d.ok, true); eq(r.d.artwork.described, false);
  ok(/stored, but not described: Resource has been exhausted/.test(r.d.warning) && /\/engine\/artwork\/describe/.test(r.d.warning), r.d.warning);
  ok(/^\[not yet described\] s1 artwork 01 \(myth-busting\) - artwork\/myth-busting/.test(r.d.artwork.description), r.d.artwork.description);
  id = r.d.artwork.id; ok(r2.has('art/mca/' + id), 'the image is in R2 under the client namespace'); eq(r.d.artwork.docId, '', 'no Mind document yet'); eq(vecNs.length, 0);
  const list = await req('GET', '/engine/artworks?ns=mca'); eq(list.d.artworks.length, 1); ok(/not yet described/.test(list.d.artworks[0].description));
});
await t('a bad image is still a 400 with the reason; another client\'s shelf is refused quietly (the document goes to the client namespace)', async () => {
  const r = await req('POST', '/engine/artwork', { ns: 'mca', title: 'x', imageB64: 'AAAA', mime: 'image/png' }); eq(r.status, 400); ok(/empty/.test(r.d.detail), r.d.detail);
  gemini = 'ok';
  const r2b = await req('POST', '/engine/artwork', { ns: 'mca', title: 'shelf test', imageB64: png, mime: 'image/png', mindNs: 'aep_creative' });
  eq(r2b.status, 200); eq(r2b.d.artwork.described, true); eq(vecNs[vecNs.length - 1], 'mca', 'a foreign shelf falls back to the client namespace');
});
await t('POST /engine/artwork/describe {id} describes it from the image in R2 and files the document on the shelf it was meant for', async () => {
  gemini = 'ok'; vecNs.length = 0;
  const r = await req('POST', '/engine/artwork/describe', { id });
  eq(r.status, 200, JSON.stringify(r.d).slice(0, 200)); eq(r.d.artwork.described, true); ok(/Medicare card/.test(r.d.artwork.description)); ok(r.d.artwork.docId);
  eq(vecNs, ['mca_creative'], 'the Mind document went to the creative shelf');
  const list = await req('GET', '/engine/artworks?ns=mca'); ok(list.d.artworks.every(a => !/not yet described/.test(a.description)));
  eq((await req('POST', '/engine/artwork/describe', { id: 'nope' })).status, 404);
});
await t('the describer asks the current Flash first, never the retired 2.0 chain', async () => {
  ok(models.length > 0); eq(models[0], 'gemini-3.6-flash', models[0]); ok(!models.includes('gemini-2.0-flash'), JSON.stringify(Array.from(new Set(models))));
  ok(models.filter(m => m === 'gemini-2.5-flash').length > 0, 'the older Flash is still tried after the current one fails');
});
await t('POST /engine/artwork/describe {ns, limit} sweeps the undescribed ones and reports what is left', async () => {
  gemini = 'fail';
  await req('POST', '/engine/artwork', { ns: 'mca', title: 'later 1', imageB64: png, mime: 'image/png' });
  await req('POST', '/engine/artwork', { ns: 'mca', title: 'later 2', imageB64: png, mime: 'image/png' });
  gemini = 'ok';
  const r = await req('POST', '/engine/artwork/describe', { ns: 'mca', limit: 1 }); eq(r.d.described, 1); eq(r.d.remaining, 1);
  const r2b = await req('POST', '/engine/artwork/describe', { ns: 'mca', limit: 5 }); eq(r2b.d.described, 1); eq(r2b.d.remaining, 0);
  gemini = 'fail';
  await req('POST', '/engine/artwork', { ns: 'mca', title: 'later 3', imageB64: png, mime: 'image/png' });
  const r3 = await req('POST', '/engine/artwork/describe', { ns: 'mca' }); eq(r3.d.described, 0); eq(r3.d.errors.length, 1); ok(/exhausted/.test(r3.d.errors[0])); eq(r3.d.remaining, 1);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
