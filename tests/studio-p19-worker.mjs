/* Creative Studio P19, freeform everywhere: the Creative Partner edits named layers by id and leaves every other layer
 * alone (locks, the copy and a mandatory mark placement are refused and named); a redesign answers with a whole plan and
 * stays freeform (the current photograph kept, locked layers carried); an adaptation starts from the master as it stands,
 * hand edits included, with type rescaled for the new stage; each sequence item has its own planned composition; first
 * production asks once for a missing plan before any house layout, and labels the house layout as not bespoke; the plan
 * places the mark where it says unless an approved rule holds it; approved words split across layers must reproduce the
 * copy exactly or the split is undone; another campaign's artwork never reaches the prompt as identity guidance.
 * Run: node --experimental-sqlite tests/studio-p19-worker.mjs */
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
const PLAN = { medium: 'editorial', approach: 'editable', story: 'big words over a quiet field', mark: 'campaign', bg: '#123456', regions: [], elements: [T('hl', 'headline', 6, 10, 60, 30, 7), T('sp', 'support', 6, 50, 60, 12, 3), T('cta', 'cta', 6, 80, 40, 6, 2.6), { id: 'bar', type: 'shape', role: 'device', shape: 'rect', x: 0, y: 0, w: 3, h: 100, fill: '#F2B134' }] };
const seen = []; const Q = { copy: [], revise: [], seq: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response('{}', { status: 500 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const b = JSON.parse(init.body); const sys = String(b.system || ''); const user = typeof b.messages[0].content === 'string' ? b.messages[0].content : b.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join(''); seen.push({ sys, user });
    const a = /producing a coordinated set/.test(sys) ? (Q.copy.shift() || {}) : /decide what the instruction asks/.test(sys) ? (Q.revise.shift() || { kind: 'question', reply: '?' }) : /planning a campaign sequence/.test(sys) ? (Q.seq.shift() || {}) : {};
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

console.log('studio-p19-worker harness (freeform everywhere)');
const k1 = await req('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }, { id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
const k2 = await req('POST', '/brand/kit', { ns: 'mca', logoB64: Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(80)]).toString('base64'), logoMime: 'image/png' });
if (k1.status !== 200 || k2.status !== 200) console.log('kit setup:', JSON.stringify(k1.d).slice(0, 200), JSON.stringify(k2.d).slice(0, 200));
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Freeform', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
let A;
await t('first production: a piece with no usable plan gets one correction call, and the recovered plan is used, not the house layout', async () => {
  Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'Not a subsidy.', support: 'A tax that never applied.', cta: 'Read the facts', caption: 'c', alt: 'a' }] }, { pieces: [{ channel: 'instagram', plan: PLAN }] });
  const n = seen.length; const j = await run(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  ok(seen.slice(n).some(x => /REPLAN\. Your answer gave no usable composition for: instagram/.test(x.user)), 'one correction asked'); eq(j.result.replanned, 1);
  const g = await get(P); A = g.assets[0].id; const v = curV(g, A);
  eq([v.layout.v, v.context.how, v.context.bespoke], [5, 'plan', true]); ok(layer(v.layout, 'cta') && layer(v.layout, 'bar'), 'the plan\'s own ids');
});
await t('first production: when the correction also fails the house layout is used and labelled as not bespoke, with the reason', async () => {
  const P2 = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Fallback', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
  Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'h', support: 's', cta: 'c', caption: 'c', alt: 'a' }] }, 'not json');
  const j = await run(P2, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const g = await get(P2); const v = curV(g, g.assets[0].id);
  eq([v.context.how, v.context.bespoke], ['house', false]); ok(/no plan came back/.test(v.context.fallbackReason || ''), v.context.fallbackReason);
  ok(/not a bespoke design/.test(g.thread.filter(e => e.kind === 'produced').pop().text), 'the thread says so');
});
await t('the Partner moves only the named layer: the CTA moves left, every other layer and the photograph stay, no render', async () => {
  const before = curV(await get(P), A);
  Q.revise.push({ kind: 'layers', reply: 'Moved the CTA.', layers: { asset: A, ops: [{ id: 'cta', x: 30, y: 82 }], keeps: ['headline', 'support', 'panel'] } });
  const n = seen.length; const j = await run(P, 'revise', { target: 'asset', asset: A, instruction: 'move only the CTA to the left' }); eq(j.state, 'done', j.error);
  ok(/layers \(per cent of the stage; address them by id\):[\s\S]*cta: text\/cta at x 6/.test(seen[n].user), 'the model saw the layers by id');
  const after = curV(await get(P), A);
  eq([layer(after.layout, 'cta').x, layer(after.layout, 'cta').y], [30, 82]);
  before.layout.layers.filter(l => l.id !== 'cta').forEach(l => eq(layer(after.layout, l.id), l, 'unchanged: ' + l.id));
  eq(after.kind, 'layout'); const ev = (await get(P)).thread.filter(e => e.kind === 'revise').pop(); ok(/Changed only cta \(x, y\)/.test(ev.text) && /no render spent/.test(ev.text), ev.text);
});
await t('a locked layer, the words of a copy role and a mark held by an approved placement rule are refused and named; the rest applies', async () => {
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = curV(g, A);
  const L = JSON.parse(JSON.stringify(v.layout)); layer(L, 'sp').locked = true;
  await req('POST', '/studio/version', { asset: A, revision: a.revision, layout: L, kind: 'layout', note: 'lock support' });
  await req('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo', markRule: { corner: 'br', mandatory: true, note: 'brand guide p.4' } }, { id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
  Q.revise.push({ kind: 'layers', reply: 'Tried.', layers: { asset: A, ops: [{ id: 'sp', y: 40 }, { id: 'hl', text: 'Something else' }, { id: 'logo', x: 5, y: 5 }, { id: 'bar', fill: '#FFFFFF', w: 5 }] } });
  const j = await run(P, 'revise', { target: 'asset', asset: A, instruction: 'tidy up' }); eq(j.state, 'done', j.error);
  const ev = (await get(P)).thread.filter(e => e.kind === 'revise').pop(); const why = ev.refused.map(r => r.id + ':' + r.why).join(' | ');
  ok(/sp:the layer is locked/.test(why) && /hl:the words of the headline change through a text edit/.test(why) && /logo:the approved placement rule .* keeps the mark br \(brand guide p.4\)/.test(why), why);
  const after = curV(await get(P), A); eq([layer(after.layout, 'bar').fill, layer(after.layout, 'bar').w], ['#FFFFFF', 5]); eq(after.copy.headline, 'Not a subsidy.');
});
await t('a redesign answers with a whole plan and stays freeform: the current photograph kept, ids reused, the locked layer carried in place', async () => {
  const g = await get(P); const a = g.assets.find(x => x.id === A);
  r2.set('studio/fx/photo.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
  const v0 = curV(g, A); await req('POST', '/studio/version', { asset: A, revision: a.revision, image: { key: 'studio/fx/photo.png', url: '/studio/file?key=studio/fx/photo.png', model: 'test' }, kind: 'render', note: 'a photograph' });
  Q.revise.push({ kind: 'design', reply: 'Words top right over the negative space.', design: { assets: [A], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a new photo please' }], elements: [T('hl', 'headline', 46, 8, 48, 30, 7.5, { align: 'right' }), T('cta', 'cta', 60, 84, 34, 6, 2.6, { align: 'right' })], markPlace: { corner: 'tl' } }, image: null, why: 'the subject sits left' } });
  const j = await run(P, 'revise', { target: 'asset', asset: A, instruction: 'put the headline in the upper-right negative space' }); eq(j.state, 'done', j.error);
  const v = curV(await get(P), A);
  eq([v.layout.v, layer(v.layout, 'hl').x, layer(v.layout, 'hl').align], [5, 46, 'right']); eq(v.layout.regions[0].prompt, 'keep the current image', 'the photograph is kept: no render');
  eq(v.image.key, 'studio/fx/photo.png'); ok(layer(v.layout, 'sp') && layer(v.layout, 'sp').locked && layer(v.layout, 'sp').y === v0.layout.layers.find(l => l.id === 'sp').y, 'the locked support carried in place');
  eq(v.layout.markPlacement.basis, 'rule', 'the mandatory rule kept the mark bottom right'); ok(v.layout.unsupported.some(n => /placement rule keeps it bottom right/.test(n)), JSON.stringify(v.layout.unsupported));
  eq(v.context.how, 'plan'); ok(!v.layout.design, 'not a preset spec');
});
await t('an adaptation starts from the master as it stands - a hand edit carries across - with type rescaled for the wider stage', async () => {
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = curV(g, A);
  const L = JSON.parse(JSON.stringify(v.layout)); layer(L, 'cta').x = 12; await req('POST', '/studio/version', { asset: A, revision: a.revision, layout: L, kind: 'layout', note: 'hand edit' });
  Q.revise.push({ kind: 'adapt', reply: 'Adapted.', adapt: { from: A, pieces: [{ channel: 'x', format: '16:9', copy: {} }] } });
  const j = await run(P, 'revise', { target: 'asset', asset: A, instruction: 'adapt this for X' }); eq(j.state, 'done', j.error);
  const g2 = await get(P); const ad = g2.assets[g2.assets.length - 1]; const av = curV(g2, ad.id);
  eq([ad.format, av.layout.v, layer(av.layout, 'cta').x], ['16:9', 5, 12], 'the hand-moved CTA'); ok(/the master as it stands, re-composed for 16:9/.test(av.note), av.note);
  const k = Math.round(7.5 * (1080 / 1080) * (1080 / 1920) * 10) / 10; eq(layer(av.layout, 'hl').size, k, 'headline type keeps its size relative to the short side');
  eq(av.image.key, 'studio/fx/photo.png'); eq(av.context.planIn.elements.find(e => e.id === 'cta').x, 12, 'the adapted plan is what the next adaptation starts from');
});
await t('each sequence item has its own planned composition; one without a usable plan is a labelled house layout', async () => {
  const P3 = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Seq', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
  Q.seq.push({ name: 'S', arc: 'a', items: [{ order: 1, role: 'opener', channel: 'instagram', format: '4:5', headline: 'One', support: 's', cta: 'c', plan: Object.assign({}, PLAN, { medium: 'typographic' }) }, { order: 2, role: 'proof', channel: 'instagram', format: '1:1', headline: 'Two', support: 's', cta: 'c', plan: Object.assign({}, PLAN, { medium: 'infographic', elements: PLAN.elements.map(e => Object.assign({}, e, { y: (e.y + 40) % 90 })) }) }, { order: 3, role: 'call-to-action', channel: 'instagram', format: '1:1', headline: 'Three', support: 's', cta: 'c' }] });
  const j = await run(P3, 'sequence', { count: 3, channels: ['instagram'] }); eq(j.state, 'done', j.error);
  const g = await get(P3); const vs = g.assets.map(a => curV(g, a.id));
  eq(vs.map(v => [v.context.how, v.layout.medium || 'house']), [['plan', 'typographic'], ['plan', 'infographic'], ['house', 'house']]);
  eq(vs[2].context.bespoke, false); ok(/not a bespoke design/.test(vs[2].note) && /not bespoke designs/.test(g.thread.filter(e => e.kind === 'sequence').pop().text), vs[2].note);
});
await t('the plan places the mark where it says when no rule binds it, at its width, from its file', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo', markRule: null }, { id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
  const P4 = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Mark', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).d.id;
  Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'h', support: 's', cta: 'c', caption: 'c', alt: 'a', plan: Object.assign({}, PLAN, { markPlace: { corner: 'tl', w: 22 } }) }] });
  const j = await run(P4, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const g = await get(P4); const v = curV(g, g.assets[0].id); const lg = layer(v.layout, 'logo');
  ok(lg && lg.x < 10 && lg.y < 12 && lg.w === 22 && /\/brand\/logo\?ns=mca/.test(lg.src), JSON.stringify(lg)); eq(v.layout.markPlacement.basis, 'plan');
});
await t('approved words split across layers stay only while they reproduce the copy exactly; a mismatch or a later copy edit undoes the split', async () => {
  const P5 = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Split', brief: { objective: 'o', message: 'm', channels: ['instagram', 'facebook'], campaignConfirmed: true } })).d.id;
  const split = Object.assign({}, PLAN, { elements: [T('h1', 'headline', 6, 10, 80, 12, 7, { part: 0, text: 'Not a' }), T('h2', 'headline', 6, 24, 80, 12, 9, { part: 1, text: 'subsidy.' }), T('sp', 'support', 6, 50, 60, 12, 3)] });
  const wrong = Object.assign({}, PLAN, { elements: [T('h1', 'headline', 6, 10, 80, 12, 7, { part: 0, text: 'Not a' }), T('h2', 'headline', 6, 24, 80, 12, 9, { part: 1, text: 'handout.' }), T('sp', 'support', 6, 50, 60, 12, 3)] });
  Q.copy.push({ pieces: [{ channel: 'instagram', headline: 'Not a subsidy.', support: 's', cta: 'c', caption: 'c', alt: 'a', plan: split }, { channel: 'facebook', headline: 'Not a subsidy.', support: 's', cta: 'c', caption: 'c', alt: 'a', plan: wrong }] });
  const j = await run(P5, 'copy', { channels: ['instagram', 'facebook'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const g = await get(P5); const ig = g.assets.find(a => a.channel === 'instagram'), fb = g.assets.find(a => a.channel === 'facebook');
  const vi = curV(g, ig.id), vf = curV(g, fb.id);
  eq(vi.layout.layers.filter(l => l.role === 'headline').map(l => [l.part, l.text]), [[0, 'Not a'], [1, 'subsidy.']]);
  eq(vf.layout.layers.filter(l => l.role === 'headline').map(l => [l.part, l.text]), [[undefined, '']], 'the wrong split became one block reading the copy');
  ok(vf.layout.unsupported.some(n => /split across layers in words that do not reproduce the approved headline exactly/.test(n)));
  await req('POST', '/studio/version', { asset: ig.id, revision: ig.revision, copy: { headline: 'Never a subsidy.' }, note: 'hand edit' });
  const v2 = curV(await get(P5), ig.id); eq(v2.layout.layers.filter(l => l.role === 'headline').length, 1); ok(/no longer matched the words; kept as one block/.test(v2.note), v2.note);
});
await t('another campaign\'s artwork is left out of the prompt: only this campaign\'s and client-wide work is offered, and the others are counted', async () => {
  await req('GET', '/engine/status?ns=mca');
  const ins = (id, camp) => env.MIND_DB.db.prepare("INSERT INTO engine_art(id,ns,title,description,meta,created) VALUES(?,?,?,?,?,?)").run(id, 'mca', id, 'description of ' + id, JSON.stringify(camp ? { campaign: camp } : {}), Date.now());
  try { ins('HOOF tile', 'hoof'); ins('National tile', 'national'); ins('Client-wide tile', ''); } catch (e) { throw new Error('engine_art table: ' + e.message); }
  Q.revise.push({ kind: 'question', reply: '?', question: 'which?' });
  const n = seen.length; await run(P, 'revise', { target: 'asset', asset: A, instruction: 'make it sharper' });
  const u = seen[n].user; ok(/National tile \[national\]/.test(u) && /Client-wide tile \[client-wide\]/.test(u) && !/HOOF tile/.test(u) && /1 from other campaigns left out/.test(u), u.slice(u.indexOf('PAST ARTWORK'), u.indexOf('PAST ARTWORK') + 400));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
