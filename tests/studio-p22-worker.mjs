/* Creative Studio P22, the art director's inspection as a record a person can weigh: every score carries the model's
 * reason; a score the model did not give is "not scored" (null), never a quiet 3; the inspection is bound to the
 * version it saw (id, number, signature) and becomes stale when the asset moves on; "round N of 2" counts the applied
 * corrections and a third look is refused as bounded; the card says whether it saw the composed tile or the imagery.
 * Run: node --experimental-sqlite tests/studio-p22-worker.mjs */
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
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0',
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
let INSPECT = { fidelity: 4, hierarchy: 2, readability: 5, relevance: 4, reasons: { fidelity: 'The paddock at dusk carries the farming idea', hierarchy: 'The support line competes with the headline at the same weight', readability: 'White type on the dark sky reads cleanly', relevance: 'Farm imagery matches the message' }, words: { present: ['Not a subsidy.'], wrong: [], missing: [] }, issues: [{ text: 'Support competes with headline', severity: 'material' }], verdict: 'fix', fix: { kind: 'design', instruction: 'Make the support line lighter and smaller' }, note: 'n' };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response('{}', { status: 500 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) { const sys = String(JSON.parse(init.body).system || ''); const a = /art director inspecting a rendered social tile/.test(sys) ? INSPECT : {}; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn' }), { status: 200 }); }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body) { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }), env, ctx); return { status: res.status, d: await res.json().catch(() => null) }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await req('POST', '/studio/job/step', { id })).d.job; if (['done', 'failed'].indexOf(j.state) >= 0) return j; } return j; };
const inspect = async (P, A) => { const r = await req('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: {}, idem: 'ins:' + Math.random() }); return step(r.d.job.id); };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;
const last = async P => (await get(P)).thread.filter(e => e.kind === 'inspection').pop();

console.log('studio-p22-worker harness (inspection reasons, unscored, version binding, stale, rounds)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Inspect', brief: { objective: 'o', message: 'm' } })).d.id;
r2.set('studio/fx/photo.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, medium: 'photo-documentary', approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 20, size: 7, color: '#fff' }] };
const A = (await req('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy.', support: 'A tax refund.' }, layout: L, mode: 'composition', image: { key: 'studio/fx/photo.png', url: '/studio/file?key=studio/fx/photo.png' } })).d.asset.id;

await t('each score keeps its reason; the score the model left out is "not scored" (null), not a default', async () => {
  const j = await inspect(P, A); eq(j.state, 'done', j.error);
  const ev = await last(P);
  eq(ev.scores, { fidelity: 4, hierarchy: 2, readability: 5, relevance: 4, identity: null }); eq(ev.unscored, ['identity']);
  eq(ev.reasons.hierarchy, 'The support line competes with the headline at the same weight'); ok(!ev.reasons.identity, 'no reason invented');
  ok(/identity not scored/.test(ev.text) && /hierarchy 2/.test(ev.text), ev.text);
});
await t('the inspection is bound to the version it saw - id, number and signature - and says it saw the imagery only when no export was composed', async () => {
  const g = await get(P); const a = g.assets.find(x => x.id === A); const ev = await last(P);
  eq([ev.version, ev.versionNumber, !!ev.sig, ev.round, ev.of], [a.current, a.versions.length, true, 1, 2]);
  eq([ev.composed, ev.imageryOnly], [false, true]);
});
await t('when the asset moves on, readiness calls the inspection stale; a ship verdict still approves nothing', async () => {
  INSPECT = Object.assign({}, INSPECT, { identity: 5, reasons: Object.assign({}, INSPECT.reasons, { identity: 'Teal panel and logo as the kit asks' }), verdict: 'ship', issues: [], fix: null });
  await inspect(P, A); const ev = await last(P); eq(ev.verdict, 'ship'); eq(ev.scores.identity, 5);
  const g = await get(P); const a = g.assets.find(x => x.id === A); ok(!a.approvals || !(a.approvals.design && a.approvals.design.decision === 'approve'), 'no approval from a verdict');
  const r0 = (await req('GET', '/studio/readiness?asset=' + A)).d; ok(r0.inspection.state !== 'stale', 'current: ' + r0.inspection.state);
  await req('POST', '/studio/version', { asset: A, revision: a.revision, copy: { headline: 'Never a subsidy.' }, note: 'hand edit' });
  const r1 = (await req('GET', '/studio/readiness?asset=' + A)).d; eq(r1.inspection.state, 'stale');
});
await t('rounds count the corrections applied on this line; after two the next look is refused as bounded, not run', async () => {
  for (let i = 0; i < 2; i++) env.MIND_DB.db.prepare("INSERT INTO studio_events(project,kind,data,who,created) VALUES(?,?,?,?,?)").run(P, 'inspection_applied', JSON.stringify({ asset: A, eid: 'e' + i, fixKind: 'design' }), 'studio', Date.now());
  let calls = 0; const f0 = globalThis.fetch; globalThis.fetch = async (u, i) => { if (String(u).indexOf('anthropic') >= 0) calls++; return f0(u, i); };
  const j = await inspect(P, A); globalThis.fetch = f0; eq(j.state, 'done', j.error); eq(calls, 0, 'no model call for a bounded line');
  const ev = await last(P); eq([ev.verdict, ev.round, ev.bounded], ['stop', 2, true]); ok(/designer's eye/.test(ev.text), ev.text);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
