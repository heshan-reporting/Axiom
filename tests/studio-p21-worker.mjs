/* Creative Studio P21, what the models were told and what they can do: a reference recipe says per component what to
 * borrow and what to leave (an exclusion beats a borrow; leaving something out of a brand reference is recorded as a
 * conflict, not a licence); the recipe reaches the prompt; each concept names which reference shaped which component and
 * an influence outside the recipe is marked; every model call of a job is filed as its compiled instruction (system, user,
 * images by name, model asked and answered, effort) with no key in it, a render's record names the prompt, the reference
 * roles, the size and that no pixel mask exists; the capability registry states what each operation cannot do.
 * Run: node --experimental-sqlite tests/studio-p21-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const SECRET = 'sk-ant-SECRET-never-filed'; const GSECRET = 'AIza-SECRET-never-filed';
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: SECRET, GEMINI_KEY: GSECRET, STUDIO_INSPECT: '0', IMAGE_SIZE_MAX: '2K',
};
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const T = (id, role, x, y, w, h, size) => ({ id, type: 'text', role, x, y, w, h, size, color: '#FFFFFF' });
const PLAN = { medium: 'editorial', approach: 'editable', mark: 'campaign', bg: '#123456', regions: [], elements: [T('hl', 'headline', 6, 10, 60, 30, 7), T('sp', 'support', 6, 50, 60, 12, 3), T('cta', 'cta', 6, 80, 40, 6, 2.6)] };
const Q = { copy: [], concepts: [] }; let gemini = 'ok';
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    if (gemini !== 'ok') return new Response(JSON.stringify({ error: { code: 400, message: 'bad request' } }), { status: 400 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] }, finishReason: 'STOP' }] }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const b = JSON.parse(init.body); const sys = String(b.system || ''); const user = typeof b.messages[0].content === 'string' ? b.messages[0].content : b.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    const a = /producing a coordinated set/.test(sys) ? (Q.copy.shift() || {}) : /describing one reference image/.test(sys) ? { summary: 'A restrained editorial tile', typography: 'bold grotesque', colour: { palette: ['#0E6A6E'], relationships: 'teal' }, composition: 'top left' } : /art director of an Australian political communications agency/.test(sys) ? (Q.concepts.shift() || {}) : {};
    return new Response(JSON.stringify({ model: b.model, content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key) { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key || 'full-key' }, body: body ? JSON.stringify(body) : undefined }), env, ctx); return { status: res.status, d: await res.json().catch(() => null) }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await req('POST', '/studio/job/step', { id })).d.job; if (['done', 'failed'].indexOf(j.state) >= 0) return j; } return j; };
const run = async (P, stage, input, asset) => { const r = await req('POST', '/studio/job', { project: P, asset, stage, input, idem: stage + ':' + Math.random() }); if (!r.d || !r.d.job) throw new Error('job not created: ' + JSON.stringify(r)); return step(r.d.job.id); };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;

console.log('studio-p21-worker harness (recipes, compiled instructions, capabilities)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] });
await req('POST', '/brand/kit', { ns: 'mca', logoB64: Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(80)]).toString('base64'), logoMime: 'image/png' });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Recipes', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'Not a subsidy.', support: 'A tax that never applied.', cta: 'Read the facts', caption: 'c', alt: 'a', plan: PLAN }] });
const j0 = await run(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: false });
const A = (await get(P)).assets[0].id;
const R1 = (await req('POST', '/studio/reference', { project: P, name: 'Editorial example', purpose: 'composition', imageB64: PNG, mime: 'image/png' })).d.id;
const R2 = (await req('POST', '/studio/reference', { project: P, name: 'MCA brand sheet', purpose: 'brand', imageB64: PNG, mime: 'image/png' })).d.id;
let CJ;
await t('a recipe borrows and leaves by component; an exclusion beats a borrow; leaving something out of a brand reference is a recorded conflict; a read key cannot set one', async () => {
  const r = await req('POST', '/studio/reference/recipe', { id: R1, project: P, borrow: ['typography', 'colour', 'Hierarchy', 'nonsense'], exclude: ['colour'], note: 'the type only' });
  eq(r.status, 200, JSON.stringify(r.d)); eq([r.d.recipe.borrow, r.d.recipe.exclude, r.d.recipe.overlap], [['typography', 'hierarchy'], ['colour'], ['colour']]);
  const b = await req('POST', '/studio/reference/recipe', { id: R2, project: P, borrow: ['mark placement'], exclude: ['colour'] }); ok(/does not lift what the kit and the campaign require/.test(b.d.recipe.conflict), JSON.stringify(b.d.recipe));
  eq((await req('POST', '/studio/reference/recipe', { id: R1, borrow: ['imagery'] }, 'read-key')).status, 403);
  const g = await get(P); eq(g.references.find(x => x.id === R1).recipe.borrow, ['typography', 'hierarchy']);
  ok(g.thread.some(e => e.kind === 'reference_recipe' && /BORROW ONLY: typography, hierarchy\. DO NOT TAKE: colour\./.test(e.text)), 'on the thread');
});
await t('the recipe reaches the prompt and the concept names its influences; one outside the recipe is marked, an unknown reference dropped', async () => {
  Q.concepts.push({ critique: 'c', options: [{ name: 'Type-led', concept: 'c', rationale: 'r', plan: PLAN, refs: [R1], influence: [{ ref: R1, component: 'typography' }, { ref: R1, component: 'colour' }, { ref: 'r_nope', component: 'spacing' }, { ref: R2, component: 'mark placement' }] }] });
  const j = await run(P, 'concepts', { asset: A, mode: 'refine', feedback: 'sharper type' }, A); eq(j.state, 'done', j.error); CJ = j.id;
  const ev = (await get(P)).thread.filter(e => e.kind === 'concepts').pop(); const inf = ev.options[0].influence;
  eq(inf.map(x => [x.name, x.component, !!x.outsideRecipe]), [['Editorial example', 'typography', false], ['Editorial example', 'colour', true], ['MCA brand sheet', 'mark placement', false]]);
  ok(/the recipe says not to take colour/.test(inf[1].outsideRecipe), inf[1].outsideRecipe);
});
await t('the concepts job filed its compiled instruction: system and user as sent (recipe included), the images by name, model and effort - and no key', async () => {
  eq(j0.progress.compiled ? j0.progress.compiled.calls : 0, 1, 'the copy job recorded one call');
  const c = await req('GET', '/studio/compiled?job=' + CJ, null, 'read-key'); eq(c.status, 200);
  const call = c.d.calls[0]; eq([c.d.stage, call.provider, call.model, call.answered, call.effort, call.thinking], ['concepts', 'anthropic', 'claude-opus-5-5', 'claude-opus-5-5', 'high', 'adaptive']);
  ok(/You are the art director/.test(call.system) && /REFINE THIS DESIGN/.test(call.user) && /\[[^\]]+\] Editorial example \(composition\) BORROW ONLY: typography, hierarchy\. DO NOT TAKE: colour\. Team note: the type only/.test(call.user), call.user.slice(call.user.indexOf('REFERENCE'), call.user.indexOf('REFERENCE') + 400));
  ok(call.images.some(im => im.name === 'Editorial example' && im.kb >= 0), JSON.stringify(call.images));
  const raw = JSON.stringify(c.d); ok(raw.indexOf(SECRET) < 0 && raw.indexOf(GSECRET) < 0, 'no key in the record');
  const none = await req('GET', '/studio/compiled?job=nope'); eq(none.status, 404);
});
await t('a render files what the image model was sent: the prompt, the reference roles, the size (capped), no pixel mask; the version points at it and "what the Studio used" lists it', async () => {
  const j = await run(P, 'render', { prompt: 'a regional road at dawn, no text', referenceIds: [{ id: R1, role: 'the type rhythm only' }], size: '4K', aspect: '4:5' }, A); eq(j.state, 'done', j.error);
  const c = (await req('GET', '/studio/compiled?job=' + j.id)).d; const call = c.calls[0];
  eq([call.provider, call.model, call.answered, call.imageConfig.imageSize, call.capped, call.masks], ['google', 'gemini-3-pro-image', 'gemini-3-pro-image', '2K', '4K', false]);
  ok(/a regional road at dawn/.test(call.text) && /REFERENCE IMAGES, attached in this order:\n1\. the type rhythm only/.test(call.text), call.text);
  ok(call.images.length === 1 && /the type rhythm only/.test(call.images[0].role), JSON.stringify(call.images));
  ok(JSON.stringify(c).indexOf(GSECRET) < 0, 'no key');
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current);
  eq(v.image.meta.compiled.job, j.id);
  const used = (await req('GET', '/studio/used?asset=' + A)).d; ok(used.compiled.some(x => x.job === j.id && x.why === 'the imagery' && x.calls === 1), JSON.stringify(used.compiled));
});
await t('a failed render still files what was sent, with the error', async () => {
  gemini = 'bad'; const j = await run(P, 'render', { prompt: 'something', size: '1K' }, A); gemini = 'ok';
  eq(j.state, 'failed'); const c = (await req('GET', '/studio/compiled?job=' + j.id)).d; ok(c.calls.length === 1 && /gemini_400/.test(c.calls[0].error), JSON.stringify(c.calls));
});
await t('the capability registry says what each operation cannot do: no pixel masks, sizes within the cap, fallbacks disclosed, nothing claimed as verified on real output', async () => {
  const c = (await req('GET', '/studio/capabilities', null, 'read-key')).d; eq(c.masks, false);
  const render = c.operations.find(o => o.op === 'render'); eq(render.accepts.sizes, ['1K', '2K']); eq(render.accepts.capped, '2K');
  ok(render.cannot.some(x => /pixel masks: there is no mask input/.test(x)) && /disclosed/.test(render.fallback), JSON.stringify(render));
  ok(c.operations.filter(o => o.provider !== 'browser (docs/studio-render.js)').every(o => /real output not reviewed/.test(o.verified)), 'no claim of verified real output');
  eq(c.operations.map(o => o.op), ['plan', 'extract', 'inspect', 'render', 'compose']);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
