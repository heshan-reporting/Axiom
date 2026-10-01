/* Creative Studio P17, editing the imagery by area: Gemini edits by described area (semantic masking), never a pixel
 * mask, so the worker says the area in words, attaches the current image, asks for everything outside it to stay, and
 * records the edit with its limits; the words and marks are layers and are not touched. The browser then measures the
 * change outside and inside the area against the version it came from (POST /studio/preservation), and the worker files
 * a held / drifted / changed verdict on the thread. An edit with nothing to edit, or no instruction, spends nothing.
 * Run: node --experimental-sqlite tests/studio-p17-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0',
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const sent = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com') >= 0) return new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }), { status: 200 });
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key }, body: body ? JSON.stringify(body) : undefined }), env, ctx); let d = null; try { d = await res.json(); } catch (x) {} return { status: res.status, d }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await req('POST', '/studio/job/step', { id })).d.job; if (['done', 'failed', 'cancelled'].indexOf(j.state) >= 0) return j; } return j; };
const cur = async (P, A) => { const g = (await req('GET', '/studio/get?id=' + P)).d; const a = g.assets.find(x => x.id === A); return { g, a, v: a.versions.find(x => x.id === a.current) }; };
const promptOf = b => b.contents[b.contents.length - 1].parts.filter(x => x.text).map(x => x.text).join(' ');

console.log('studio-p17-worker harness (area edits by description, recorded limits, preservation measured and judged)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
r2.set('studio/fixture/photo.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Edits', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;
const LAYOUT = { v: 3, stage: { w: 1080, h: 1350 }, layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 70, w: 88, h: 14, size: 6, color: '#fff' }] };
const A = (await req('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Tile', copy: { headline: 'Who uses the credit' }, layout: LAYOUT, mode: 'composition', image: { key: 'studio/fixture/photo.png', url: '/studio/file?key=studio/fixture/photo.png' } })).d.asset.id;
const B = (await req('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'No image yet', copy: { headline: 'x' }, layout: LAYOUT, mode: 'composition' })).d.asset.id;
let v0, v1;

await t('an area edit says the area in words, attaches the current image, asks for everything outside it to stay, and records the edit with its limits; the words and layout are untouched', async () => {
  v0 = (await cur(P, A)).v;
  const j = (await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'area', area: { x: 60, y: 5, w: 35, h: 25 }, instruction: 'remove the sign on the fence', aspect: '4:5', size: '1K' }, idem: 'e1' })).d.job;
  const done = await step(j.id); eq(done.state, 'done', JSON.stringify(done.error));
  const pr = promptOf(sent[sent.length - 1]);
  ok(/EDIT ONLY ONE AREA OF THE CURRENT IMAGE: the upper right of the image \(the rectangle from 60% to 95% across from the left edge and 5% to 30% down from the top/.test(pr), pr.slice(0, 300));
  ok(/In that area: remove the sign on the fence\. Everything outside it/.test(pr) && /Add no text, lettering, logos or watermarks/.test(pr), 'the instruction and the guard');
  ok(JSON.stringify(sent[sent.length - 1]).indexOf(PNG.slice(0, 20)) >= 0, 'the current image went with the request');
  v1 = (await cur(P, A)).v; const ed = v1.image.meta.edit;
  eq([ed.kind, ed.area, ed.instruction, ed.of, ed.preservation], ['area', { x: 60, y: 5, w: 35, h: 25 }, 'remove the sign on the fence', v0.id, 'pending']); ok(/no pixel mask/.test(ed.limits), ed.limits);
  eq(v1.image.editOf, v0.id); eq([v1.copy, v1.layout], [v0.copy, v0.layout], 'the words and the layout are layers and do not change');
});
await t('a background swap and a restyle carry their own instruction; an area is clamped to the frame', async () => {
  const j = (await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'background', instruction: 'a regional street at dusk', aspect: '4:5', size: '1K' }, idem: 'e2' })).d.job; eq((await step(j.id)).state, 'done');
  const pr = promptOf(sent[sent.length - 1]); ok(/keep the main subject exactly as it is/.test(pr) && /Replace only what is behind it: a regional street at dusk/.test(pr), pr.slice(0, 200));
  const j2 = (await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'area', area: { x: 90, y: -5, w: 50, h: 1 }, instruction: 'warmer', aspect: '4:5' }, idem: 'e3' })).d.job; eq((await step(j2.id)).state, 'done');
  eq((await cur(P, A)).v.image.meta.edit.area, { x: 90, y: 0, w: 10, h: 2 });
});
await t('an edit with nothing to edit, or nothing to say, fails without calling the image model', async () => {
  const n = sent.length;
  const j = (await req('POST', '/studio/job', { project: P, asset: B, stage: 'render', input: { edit: true, editKind: 'area', area: { x: 0, y: 0, w: 50, h: 50 }, instruction: 'x', aspect: '1:1' }, idem: 'e4' })).d.job;
  const d = await step(j.id); eq(d.state, 'failed'); ok(/nothing_to_edit/.test(d.error), d.error);
  const j2 = (await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'restyle', instruction: '  ', aspect: '4:5' }, idem: 'e5' })).d.job;
  const d2 = await step(j2.id); eq(d2.state, 'failed'); ok(/instruction_required/.test(d2.error), d2.error); eq(sent.length, n, 'no image call');
});
await t('the preservation measurement is judged against the version the edit came from: held, drifted, changed, with a warning when nothing changed inside', async () => {
  const send = (b, key) => req('POST', '/studio/preservation', Object.assign({ asset: A, version: v1.id, against: v0.id }, b), key);
  eq((await send({ against: 'vnope', outside: 0.01, changedOutside: 0.01 })).d.error, 'wrong_baseline');
  eq((await send({ outside: 2, changedOutside: 0 })).status, 400);
  eq((await send({ outside: 0.01, changedOutside: 0.01 }, 'read-key')).status, 403, 'filing is a write');
  const h = (await send({ outside: 0.012, inside: 0.004, changedOutside: 0.02, size: '160x200' })).d; eq(h.verdict, 'held'); ok(/Held: the rest of the image is essentially as it was/.test(h.text) && /the edit may not have taken/.test(h.text), h.text);
  eq((await send({ outside: 0.04, inside: 0.2, changedOutside: 0.1 })).d.verdict, 'drifted');
  eq((await send({ outside: 0.2, inside: 0.3, changedOutside: 0.6 })).d.verdict, 'changed');
  const ev = (await cur(P, A)).g.thread.filter(e => e.kind === 'preservation'); eq(ev.length, 3); ok(/mean change outside the marked area 1\.2%, inside 0\.4%, 2\.0% of pixels moved visibly/.test(ev[0].text), ev[0].text);
  eq((await req('POST', '/studio/preservation', { asset: A, version: v0.id, against: 'x', outside: 0, changedOutside: 0 })).d.error, 'not_an_area_edit');
});
await t('a background swap is measured, not judged: the whole frame is meant to change around the subject', async () => {
  const { a } = await cur(P, A); const bg = a.versions.find(x => x.image && x.image.meta && x.image.meta.edit && x.image.meta.edit.kind === 'background');
  const r = (await req('POST', '/studio/preservation', { asset: A, version: bg.id, against: bg.image.meta.edit.of, outside: 0.3, changedOutside: 0.7 })).d;
  eq(r.verdict, 'measured'); ok(/a person judges whether the subject held/.test(r.text), r.text);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
