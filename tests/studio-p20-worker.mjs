/* Creative Studio P20, layouts from the same photograph and words: "Explore layouts" binds the imagery and the approved
 * copy whatever the request says; every option keeps the current image (no render), new image regions, painted lettering
 * and invented words are set aside and named; a layout that draws like the current one is a look-alike and is replanned
 * once; applying one is a layout version with the same image and copy and no job. Image framing (focal point and zoom)
 * is normalised and survives adaptation.
 * Run: node --experimental-sqlite tests/studio-p20-worker.mjs */
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
const T = (id, role, x, y, w, h, size, extra) => Object.assign({ id, type: 'text', role, x, y, w, h, size, color: '#FFFFFF' }, extra || {});
const ELS = [T('hl', 'headline', 6, 10, 60, 30, 7), T('sp', 'support', 6, 50, 60, 12, 3), T('cta', 'cta', 6, 80, 40, 6, 2.6), { id: 'bar', type: 'shape', role: 'device', shape: 'rect', x: 0, y: 0, w: 3, h: 100, fill: '#F2B134' }];
const PLAN = { medium: 'editorial', approach: 'editable', story: 'big words over a quiet field', mark: 'campaign', bg: '#123456', regions: [], elements: ELS };
const seen = []; const Q = { copy: [], concepts: [], revise: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response('{}', { status: 500 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const b = JSON.parse(init.body); const sys = String(b.system || ''); const user = typeof b.messages[0].content === 'string' ? b.messages[0].content : b.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join(''); seen.push({ sys, user });
    const a = /producing a coordinated set/.test(sys) ? (Q.copy.shift() || {}) : /EXPLORE DIFFERENT LAYOUTS/.test(user) ? (Q.concepts.shift() || {}) : /decide what the instruction asks/.test(sys) ? (Q.revise.shift() || { kind: 'question', reply: '?' }) : {};
    return new Response(JSON.stringify({ content: [{ type: 'text', text: typeof a === 'string' ? a : JSON.stringify(a) }], stop_reason: 'end_turn' }), { status: 200 });
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
const run = async (P, stage, input, asset) => { const r = await req('POST', '/studio/job', { project: P, asset, stage, input, idem: stage + ':' + Math.random() }); if (!r.d || !r.d.job) throw new Error('job not created: ' + JSON.stringify(r)); return step(r.d.job.id); };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;
const curV = (g, id) => { const a = g.assets.find(x => x.id === id); return a.versions.find(v => v.id === a.current); };
const layer = (L, id) => L.layers.find(l => l.id === id);

console.log('studio-p20-worker harness (layouts from the same image and words; framing)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] });
await req('POST', '/brand/kit', { ns: 'mca', logoB64: Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(80)]).toString('base64'), logoMime: 'image/png' });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Layouts', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'Not a subsidy.', support: 'A tax that never applied.', cta: 'Read the facts', caption: 'c', alt: 'a', plan: PLAN }] });
const j0 = await run(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: false });
let g0 = await get(P); const A = g0.assets[0].id;
r2.set('studio/fx/photo.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
await req('POST', '/studio/version', { asset: A, revision: g0.assets[0].revision, image: { key: 'studio/fx/photo.png', url: '/studio/file?key=studio/fx/photo.png', model: 'test' }, kind: 'render', note: 'a photograph' });
const opt = (name, plan, extra) => Object.assign({ name, concept: 'c', rationale: 'why ' + name, plan, needsImage: true, keeps: ['the photograph'], changes: ['placement'] }, extra || {});
const right = { medium: 'photo-documentary', approach: 'artwork', mark: 'campaign', imageFocus: { x: 70, y: 20, zoom: 2 }, regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a brand new mine at dusk' }, { id: 'ins', role: 'inset', x: 60, y: 60, w: 30, h: 30, prompt: 'a truck' }],
  elements: [T('k', 'kicker', 55, 2, 40, 4, 2.4, { text: 'NEW FACT' }), T('hl', 'headline', 55, 5, 40, 30, 6), T('sp', 'support', 55, 36, 40, 12, 2.8), T('cta', 'cta', 55, 50, 40, 6, 2.6)] };
const band = { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', imageFocus: { x: 50, y: 50, zoom: 1 }, regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }],
  elements: [{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 65, w: 100, h: 35, fill: '#0E6A6E', opacity: 0.85 }, T('hl', 'headline', 4, 67, 92, 14, 6), T('sp', 'support', 4, 82, 60, 8, 2.8), T('lb', 'label', 66, 90, 30, 5, 2.4, { text: 'Read the facts' }), T('cta', 'cta', 4, 92, 50, 5, 2.6)] };
const same = { medium: 'editorial', approach: 'editable', mark: 'campaign', bg: '#123456', regions: [], elements: ELS };
const middle = { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [T('hl', 'headline', 8, 30, 84, 22, 7, { align: 'center' }), T('sp', 'support', 8, 54, 84, 10, 3, { align: 'center' }), T('cta', 'cta', 8, 64, 84, 6, 2.6, { align: 'center' })] };
let EV;
await t('Explore layouts binds the photograph and the approved words even when asked otherwise; every option is layout only, no render', async () => {
  Q.concepts.push({ critique: 'the words fight the subject', options: [opt('Right column', right, { copy: { headline: 'Different words' } }), opt('Bottom band', band), opt('As it was', same)] }, { options: [opt('Centred', middle)] });
  const n = seen.length; const j = await run(P, 'concepts', { asset: A, mode: 'layouts', keep: { imagery: false, copy: false }, feedback: 'other arrangements' }, A); eq(j.state, 'done', j.error);
  ok(/EXPLORE DIFFERENT LAYOUTS/.test(seen[n].user) && /Keep the current photograph exactly/.test(seen[n].user) && /Give three distinct layouts/.test(seen[n].user), 'the layouts brief');
  EV = (await get(P)).thread.filter(e => e.kind === 'concepts').pop();
  eq([EV.mode, EV.keep.imagery, EV.keep.copy, EV.keep.composition, EV.keep.explicit], ['layouts', true, true, false, true]);
  EV.options.forEach(o => { eq([o.renders, o.needsImage], [0, false], o.name); eq(o.layout.regions.map(r => [r.role, r.prompt]), [['background', 'keep the current image']], o.name); ok(!o.copy || !o.copy.headline, 'no new headline on ' + o.name); eq(o.cost, 'layout only, no render'); });
  ok(/Layouts for/.test(EV.text) && /Same photograph and approved words in each; no render needed/.test(EV.text), EV.text);
});
await t('new image regions, painted lettering and words the tile does not carry are set aside and named; its own words may be rearranged', async () => {
  const r = EV.options.find(o => o.name === 'Right column'); const b = EV.options.find(o => o.name === 'Bottom band');
  eq(r.approach, 'editable'); ok(!r.layout.layers.some(l => l.id === 'k'), 'the invented kicker dropped'); ok(!r.layout.layers.some(l => l.role === 'region'), 'no inset image layer');
  ok(r.setAside.some(x => /1 new image region/.test(x)) && r.setAside.some(x => /painted lettering/.test(x)) && r.setAside.some(x => /1 text element with words the version does not carry/.test(x)), JSON.stringify(r.setAside));
  ok(layer(b.layout, 'lb') && !b.setAside, 'a label repeating the CTA words stays');
  ok(/Set aside from the answers/.test(EV.text), EV.text);
});
await t('a layout that draws like the current one is a look-alike, replanned once against the current layout; the replacement stands', async () => {
  const rp = seen.find(x => /REPLAN\./.test(x.user)); ok(rp && /"As it was" resembles "the current layout"/.test(rp.user) && /from the current layout in where the words sit/.test(rp.user), rp && rp.user.slice(rp.user.indexOf('REPLAN')));
  eq(EV.replanned, 1); eq(EV.options.map(o => o.name).sort(), ['Bottom band', 'Centred', 'Right column']); ok(EV.options.every(o => !o.similar), 'all distinct');
  ok(EV.options.every(o => o.fromCurrent >= 0.2), JSON.stringify(EV.options.map(o => o.fromCurrent)));
});
await t('applying a layout is a layout version on the same image and the same words, with no job queued even when render is asked', async () => {
  const before = curV(await get(P), A); const i = EV.options.findIndex(o => o.name === 'Bottom band');
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: i, render: true }); eq(r.status, 200, JSON.stringify(r.d));
  eq(r.d.jobs, []); const v = curV(await get(P), A);
  eq([v.kind, v.image.key, v.copy.headline, v.copy.support, v.copy.cta], ['layout', before.image.key, before.copy.headline, before.copy.support, before.copy.cta]);
  ok(layer(v.layout, 'panel') && layer(v.layout, 'panel').opacity === 0.85, 'the panel opacity carried');
});
await t('image framing: an off-centre focal point and zoom are kept, the plain centre is dropped, and an adaptation keeps the framing', async () => {
  const r = EV.options.find(o => o.name === 'Right column'); const b = EV.options.find(o => o.name === 'Bottom band');
  eq(r.layout.imageFocus, { x: 70, y: 20, zoom: 2 }); eq(b.layout.imageFocus, undefined);
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = curV(g, A);
  const L = Object.assign({}, v.layout, { imageFocus: { x: 22, y: 35, zoom: 1.4 } }); const w = await req('POST', '/studio/version', { asset: A, revision: a.revision, layout: L, kind: 'layout', note: 'framing' }); eq(w.status, 200, JSON.stringify(w.d));
  Q.revise.push({ kind: 'adapt', reply: 'Adapted.', adapt: { from: A, pieces: [{ channel: 'x', format: '16:9', copy: {} }] } });
  const j = await run(P, 'revise', { target: 'asset', asset: A, instruction: 'adapt this for X' }); eq(j.state, 'done', j.error);
  const g2 = await get(P); const ad = g2.assets[g2.assets.length - 1]; const av = curV(g2, ad.id);
  eq([ad.format, av.layout.imageFocus], ['16:9', { x: 22, y: 35, zoom: 1.4 }]);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
