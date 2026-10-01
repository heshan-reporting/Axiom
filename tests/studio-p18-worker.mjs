/* Creative Studio P18, work with no image budget: production with input.imagery 'none' tells the planner NO IMAGERY and
 * holds the plan to it - image regions are left out (an empty image box is a sketch that can never pass technical
 * validation), a photographic medium becomes typographic, the artwork approach becomes editable, the ground is the kit
 * colour - queues no render, and records context.imagery so a later refinement keeps to it; the adaptation re-composes
 * the same region-free plan. With an image budget nothing changes.
 * Run: node --experimental-sqlite tests/studio-p18-worker.mjs */
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
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const T = (role, x, y, w, h, size) => ({ type: 'text', role, text: '', x, y, w, h, size, weight: 750, color: '#FFFFFF' });
const PHOTO_PLAN = { medium: 'photo-documentary', approach: 'artwork', story: 'a farmer at a bowser', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a farmer at a bowser' }, { id: 'ic', role: 'inset', x: 70, y: 10, w: 20, h: 20, prompt: 'a fuel icon' }], elements: [T('headline', 6, 60, 88, 20, 6), T('support', 6, 82, 70, 8, 3)] };
const seen = []; let gem = 0;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { gem++; return new Response('{}', { status: 500 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const b = JSON.parse(init.body); const sys = String(b.system || ''); const user = typeof b.messages[0].content === 'string' ? b.messages[0].content : b.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join(''); seen.push(sys + '\n' + user);
    const a = /producing a coordinated set/.test(sys) ? { pieces: ['instagram', 'facebook'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: 'Not a subsidy.', support: 'A tax that never applied.', cta: 'Read the facts', caption: 'c', alt: 'a', plan: PHOTO_PLAN })) }
      : /briefing a designer and an image model/.test(sys) ? { critique: 'c', options: [{ name: 'Sharper', concept: 'c', rationale: 'r', imagery: 'i', plan: PHOTO_PLAN, needsImage: true, basis: [], refs: [], missing: [] }] } : {};
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body) { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }), env, ctx); return { status: res.status, d: await res.json().catch(() => null) }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await req('POST', '/studio/job/step', { id })).d.job; if (['done', 'failed'].indexOf(j.state) >= 0) return j; } return j; };
const project = async () => (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'No imagery', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
const run = async (P, stage, input, asset) => { const r = await req('POST', '/studio/job', { project: P, asset, stage, input, idem: stage + ':' + Math.random() }); if (!r.d || !r.d.job) throw new Error('job not created: ' + JSON.stringify(r)); return step(r.d.job.id); };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;

console.log('studio-p18-worker harness (no imagery: told, enforced, carried through refinement and adaptation)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
let P1, A1;
await t('production with imagery none tells the planner, drops every image region, makes the medium typographic and editable on the kit colour, and queues no render', async () => {
  P1 = await project(); const n = seen.length;
  const j = await run(P1, 'copy', { channels: ['instagram'], deliverable: 'set', imagery: 'none', render: false }); eq(j.state, 'done', j.error);
  ok(seen.slice(n).some(x => /producing a coordinated set/.test(x) && /NO IMAGERY: no image will be generated/.test(x)), 'the planner was told: ' + seen.slice(n).map(x => x.slice(0, 60)).join(' | '));
  const g = await get(P1); const a = g.assets[0]; A1 = a.id; const v = a.versions[a.versions.length - 1];
  eq([v.layout.regions || [], v.layout.medium, v.layout.approach, v.mode, v.context.imagery], [[], 'typographic', 'editable', 'composition', 'none']);
  ok(!(v.layout.layers || []).some(l => l.type === 'img' && l.role !== 'logo' && l.role !== 'wordmark'), 'no image layer but the marks');
  eq((v.context.planIn.regions || []).length, 0, 'the stored plan is the region-free one, so an adaptation re-composes it');
  eq(g.jobs.filter(x => x.stage === 'render').length, 0, 'no render queued'); eq(gem, 0);
});
await t('a refinement of that asset is held to it too: the art director is told and the card needs no image', async () => {
  const n = seen.length; const j = await run(P1, 'concepts', { asset: A1, mode: 'refine', feedback: 'sharper' }, A1); eq(j.state, 'done', j.error);
  ok(seen.slice(n).some(x => /briefing a designer/.test(x) && /NO IMAGERY/.test(x)), 'the art director was told');
  const ev = (await get(P1)).thread.filter(e => e.kind === 'concepts').pop(); const o = ev.options[0];
  ok(!o.needsImage && !(o.planIn && (o.planIn.regions || []).length), 'the card needs no image: ' + JSON.stringify([o.needsImage, o.planIn && o.planIn.regions]));
});
await t('with an image budget nothing changes: the photograph and inset stay in the plan and renders are queued', async () => {
  const P2 = await project(); const n = seen.length;
  const j = await run(P2, 'copy', { channels: ['instagram'], deliverable: 'set', render: true, size: '1K' }); eq(j.state, 'done', j.error);
  ok(!seen.slice(n).some(x => /NO IMAGERY/.test(x)), 'not told');
  const g = await get(P2); const v = g.assets[0].versions.slice(-1)[0];
  ok((v.layout.regions || []).length === 2 && v.context.imagery === undefined, 'regions kept: ' + JSON.stringify(v.layout.regions && v.layout.regions.length));
  ok(g.jobs.filter(x => x.stage === 'render').length >= 1, 'renders queued');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
