/* Creative Studio, design beyond the preset: a campaign wordmark with a logo policy (HOOF carries its wordmark, never the client
 * logo); concepts as expressive plans (medium, approach, regions with their own image instructions and references, free text
 * groups with emphasis, devices, carousel frames) normalised without silently reducing what cannot be drawn; distinctness measured
 * on the drawn result; a carousel applied as one asset per frame; the image model given the reference images with their roles;
 * a full-artwork approach whose words are marked as part of the bitmap; multi-turn edits replaying the model's parts and thought
 * signatures; 4K honoured and a model fallback made visible; an inspection after every render with one bounded correction;
 * "Create a new design" that starts from the brief, uses the chosen references and does not inherit the panel.
 * Run: node --experimental-sqlite tests/studio-p7-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const v = r2.get(k).v; return typeof v === 'string' ? Buffer.from(v) : v; }, text: async () => { const v = r2.get(k).v; return typeof v === 'string' ? v : Buffer.from(v).toString(); }, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const anth = { calls: [] }; const gem = { calls: [], fail404Once: false };
const textOf = body => typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
const imagesOf = body => typeof body.messages[0].content === 'string' ? 0 : body.messages[0].content.filter(x => x.type === 'image').length;
const refIds = user => Array.from(user.matchAll(/^\[(r[a-z0-9]+)\]/gm)).map(m => m[1]);
const REF = { summary: 'An approved HOOF tile: MYTH in red, FACT in teal, a wrench symbol, the wordmark bottom left.', typography: 'Condensed caps for MYTH/FACT, grotesque body', colour: { palette: ['#C8102E', '#0E6A6E', '#F4F1EA'], relationships: 'Red for the myth, teal for the fact, cream type' }, hierarchy: 'MYTH label, then the claim, then FACT', composition: 'Two stacked bands', imageTreatment: 'Industry photograph, warm', panels: 'Two full-width bands', spacing: 'Tight', logo: 'Wordmark bottom left', text: ['MYTH', 'FACT', 'HANDS OFF OUR FUEL'], takeaways: ['Red and teal bands', 'Caps labels', 'Wordmark, not the client logo'] };
const PLANS = (user) => {
  const R = refIds(user);
  const text = (role, t, x, y, w, h, size, extra) => Object.assign({ type: 'text', role, text: t, x, y, w, h, size, weight: 750, color: '#FFFFFF', align: 'left', font: 'display' }, extra || {});
  return { critique: 'The house panel again over a half-covered subject; the HOOF identity (red myth, teal fact, the wordmark) is missing.', options: [
    { name: 'Cinematic myth opener', concept: 'A low, dramatic haul road at dusk; MYTH as a red kicker, the claim large, a thin rule, the fact as the second line', rationale: 'Scale and atmosphere like the quality reference; the HOOF red and teal from the approved tile', imagery: 'cinematic photography, wide, dusk, dust catching light', composition: 'Subject right third, words left, negative space in the sky', typography: 'Condensed caps kicker, headline 9 per cent, support 3', colour: 'Red kicker, cream type, teal rule', devices: 'A thin teal rule, a red kicker block', mark: 'HOOF wordmark bottom left, no client logo',
      plan: { medium: 'photo-cinematic', approach: 'editable', story: 'the myth stated large over a dramatic road, answered beneath', focal: 'subject right, sky left open', typography: 'kicker caps, headline leads', devices: 'rule and kicker block', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A wide cinematic photograph of a Pilbara haul road at dusk, a yellow haul truck small on the right third, dust in low golden light, vast sky on the left kept quiet, 35mm, documentary grade', refs: [{ id: R[1], role: 'the drama, scale and atmosphere' }, { id: R[0], role: 'the red and teal of the campaign' }] }],
        elements: [text('kicker', 'MYTH', 6, 8, 20, 6, 3.2, { emphasis: 'caps', bg: '#C8102E', color: '#FFFFFF', weight: 800 }), text('headline', '', 6, 16, 60, 30, 9), { type: 'rule', role: 'device', x: 6, y: 48, w: 30, h: 0.6, fill: '#0E6A6E' }, text('support', '', 6, 51, 56, 16, 3.2, { weight: 500, font: 'body' }), text('cta', '', 6, 84, 36, 6, 2.5, { bg: '#FFFFFF', color: '#0F1420', align: 'center', weight: 650, font: 'body' })] },
      keeps: ['copy'], changes: ['medium', 'composition', 'mark'], needsImage: true, basis: [{ claim: 'Red myth, teal fact from the approved tile', kind: 'reference', ref: R[0] }, { claim: 'Dramatic scale from the quality reference, not a brand rule', kind: 'reference', ref: R[1] }], refs: [R[0], R[1]], missing: [] },
    { name: 'Myth / fact carousel', concept: 'Frame one states the myth in red on a flat field; frame two answers in teal with a cutout of the machine', rationale: 'The approved HOOF format: a myth opener and a fact response', imagery: 'typography-led, a cutout harvester on the fact frame', composition: 'Two frames, same grid', typography: 'Caps labels, big claim', colour: 'Red field, teal field', devices: 'Full-bleed colour fields, a cutout', mark: 'Wordmark on both frames',
      plan: { medium: 'carousel', approach: 'editable', story: 'myth then fact', mark: 'campaign', frames: [
        { name: 'Frame 1: the myth', copy: { headline: 'Myth: fuel tax credits are a subsidy for miners', support: '', cta: '' }, bg: { from: '#C8102E', to: '#7A0A1C', dir: 'down' }, regions: [], elements: [text('kicker', 'MYTH', 6, 10, 24, 7, 3.6, { emphasis: 'caps', weight: 800 }), text('headline', '', 6, 22, 88, 40, 9.5), text('caption', 'Swipe for the fact', 6, 88, 60, 5, 2.4, { weight: 500, font: 'body' })] },
        { name: 'Frame 2: the fact', copy: { headline: 'Fact: businesses do not pay a road fuel tax on fuel used off-road', support: 'Farmers, fishers, builders and tradies use fuel tax credits.', cta: 'handsoffourfuel.com.au' }, bg: '#0E6A6E', regions: [{ id: 'cut', role: 'cutout', x: 52, y: 50, w: 44, h: 40, fit: 'contain', prompt: 'A cutout photograph of a green header harvester on a plain background, three-quarter view, clean edges', refs: [] }], elements: [text('kicker', 'FACT', 6, 10, 24, 7, 3.6, { emphasis: 'caps', weight: 800, bg: '#F4F1EA', color: '#0E6A6E' }), text('headline', '', 6, 22, 88, 26, 7), text('support', '', 6, 52, 44, 16, 3, { weight: 500, font: 'body' }), text('cta', '', 6, 84, 40, 6, 2.5, { bg: '#FFFFFF', color: '#0F1420', align: 'center', weight: 650, font: 'body' })] }] },
      keeps: ['message'], changes: ['two frames', 'no photograph on the opener'], needsImage: true, basis: [{ claim: 'Myth opener and fact response as approved', kind: 'reference', ref: R[0] }], refs: [R[0]], missing: ['Whether the fact frame may carry a machine'] },
    { name: 'Painted poster', concept: 'The image model paints the whole piece: a stylised poster with the words as lettering', rationale: 'A finish only lettering can give', imagery: 'illustration, screen-print feel', composition: 'Centred lettering over an illustrated harbour', typography: 'Hand lettering', colour: 'Teal and cream', devices: 'Printed texture', mark: 'Wordmark placed afterwards',
      plan: { medium: 'illustration', approach: 'artwork', story: 'a screen-printed poster', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A screen-print style poster of a fishing harbour at dawn in teal and cream, two-colour, textured', refs: [{ id: R[0], role: 'the teal and cream' }] }], elements: [text('headline', '', 8, 10, 84, 30, 8.5, { align: 'center' }), text('support', '', 8, 44, 84, 14, 3, { align: 'center' }), { type: 'video', role: 'free', text: 'a loop' }] },
      keeps: ['copy'], changes: ['everything else'], needsImage: true, basis: [{ claim: 'Lettering as part of the picture', kind: 'inferred' }], refs: [R[0]], missing: [] }] };
};
const NEWPLAN = (user) => ({ critique: 'Starting from the brief.', options: [{ name: 'The number does the work', concept: 'Typography-led: 150,000 fills the frame', rationale: 'An argument, not a scene', imagery: 'no photograph', composition: 'Centred', typography: 'One huge figure', colour: 'Teal field', devices: 'none', mark: 'wordmark', plan: { medium: 'typographic', approach: 'editable', story: 'the figure fills the frame', mark: 'campaign', bg: '#0E6A6E', regions: [], elements: [{ type: 'text', role: 'free', text: '150,000', x: 4, y: 20, w: 92, h: 30, size: 16, weight: 800, color: '#F4F1EA', align: 'center', font: 'display' }, { type: 'text', role: 'headline', x: 8, y: 56, w: 84, h: 20, size: 5, color: '#FFFFFF', align: 'center' }, { type: 'text', role: 'cta', x: 30, y: 84, w: 40, h: 6, size: 2.5, bg: '#FFFFFF', color: '#0F1420', align: 'center', font: 'body' }] }, keeps: ['copy'], changes: ['everything'], needsImage: false, basis: [{ claim: 'Flat colour field as in the approved tile', kind: 'reference', ref: refIds(user)[0] }], refs: [refIds(user)[0]], missing: [] }] });
const INSPECT = { fidelity: 4, hierarchy: 3, readability: 4, relevance: 5, identity: 5, words: { present: ['MYTH'], wrong: [] }, issues: ['The headline sits too close to the kicker'], verdict: 'fix', fix: { kind: 'design', instruction: 'Move the headline down two per cent; keep everything else.' }, note: 'Close.' };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    const body = JSON.parse(init.body); const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || ''); gem.calls.push({ model, body });
    if (gem.fail404Once && model === 'gemini-3-pro-image') { gem.fail404Once = false; return new Response(JSON.stringify({ error: { code: 404, message: 'model not found' } }), { status: 404 }); }
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'Here is the image.', thoughtSignature: 'sig-' + gem.calls.length }, { inlineData: { mimeType: 'image/png', data: PNG }, thoughtSignature: 'sig-img-' + gem.calls.length }] } }] }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body);
    const sys = String(body.system || ''), user = textOf(body);
    let text;
    if (/describing one reference image/.test(sys)) text = JSON.stringify(REF);
    else if (/art director inspecting a rendered social tile/.test(sys)) text = JSON.stringify(INSPECT);
    else if (/art director of an Australian political communications agency, briefing/.test(sys)) text = JSON.stringify(/CREATE A NEW DESIGN/.test(user) ? NEWPLAN(user) : PLANS(user));
    else if (/decide what the instruction asks/.test(sys)) text = JSON.stringify({ kind: 'layout', reply: 'Moved.', layout: { assets: Array.from(user.matchAll(/^\[(a[a-z0-9]+)\]/gm)).map(m => m[1]).slice(0, 1), headlineSize: 'same' }, memory: { standing: false } });
    else text = '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; try { d = await res.json(); } catch (x) { d = null; } return { status: res.status, d, res };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };
const jobRun = async (P, stage, input, asset) => { const j = await req('POST', '/studio/job', { project: P, stage, input, asset, idem: stage + ':' + Math.random() }); if (!j.d.job) throw new Error(JSON.stringify(j.d)); return run(j.d.job); };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;
const events = async (P, kind) => (await get(P)).thread.filter(e => !kind || e.kind === kind);
const layerOf = (L, role) => (L.layers || []).find(l => l.role === role);

console.log('studio-p7-worker harness (design beyond the preset: wordmarks, plans, carousels, references to the image model, artwork mode, edits, inspection, new designs)');
let P = '', A = '', R1 = '', R2 = '';
await t('a campaign wordmark is stored exactly and served; its logo policy puts the wordmark on that campaign\'s tiles and never the client logo, while another campaign keeps the client logo', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', identity: 'MYTH in red, FACT in teal, industry imagery, the HANDS OFF OUR FUEL wordmark' }, { id: 'national', name: 'Australian mining' }], facts: [{ text: 'The credit is used by more than 150,000 businesses', source: 'ATO' }], logoB64: PNG, logoMime: 'image/png' });
  await req('GET', '/engine/status?ns=mca');
  const w = await req('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' }); eq(w.status, 200, JSON.stringify(w.d));
  const hoof = w.d.kit.campaigns.find(c => c.id === 'hoof'); eq([hoof.hasWordmark, hoof.logoPolicy, hoof.identity.slice(0, 12)], [true, 'wordmark', 'MYTH in red,']); eq(w.d.kit.campaigns.find(c => c.id === 'national').logoPolicy, 'logo');
  const g = await req('GET', '/brand/wordmark?ns=mca&campaign=hoof'); eq(g.status, 200); eq(g.res.headers.get('Content-Type'), 'image/png');
  eq((await req('GET', '/brand/wordmark?ns=mca&campaign=national')).status, 404);
  const p = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF design', brief: { objective: 'answer the subsidy framing', message: 'small businesses use them', channels: ['instagram'] } }); P = p.d.id;
  r2.set('studio/x/y/fisher.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
  const a = await req('POST', '/studio/asset', { project: P, family: 'Campaign set', channel: 'instagram', format: '4:5', title: 'Instagram portrait', copy: { headline: 'Fact: They\'re used by small businesses too', support: 'Farmers, fishers, builders, wineries, tourism operators and tradies use Fuel Tax Credits.', cta: 'handsoffourfuel.com.au', alt: 'tile' }, image: { key: 'studio/x/y/fisher.png', url: '/studio/file?key=studio%2Fx%2Fy%2Ffisher.png', model: 'gemini-3-pro-image', size: '2K' }, mode: 'composition' }); A = a.d.asset.id;
  const L = a.d.asset.versions[0].layout; ok(layerOf(L, 'wordmark'), 'the HOOF wordmark is placed'); ok(!layerOf(L, 'logo'), 'no client logo on a HOOF tile'); eq(layerOf(L, 'wordmark').src, '/brand/wordmark?ns=mca&campaign=hoof'); eq(L.marks, { policy: 'wordmark', campaign: 'hoof' });
  const p2 = await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National', brief: {} });
  const a2 = await req('POST', '/studio/asset', { project: p2.d.id, family: 'F', channel: 'linkedin', format: '1:1', title: 'LI', copy: { headline: 'H' }, mode: 'composition' });
  ok(layerOf(a2.d.asset.versions[0].layout, 'logo') && !layerOf(a2.d.asset.versions[0].layout, 'wordmark'), 'the national campaign keeps the client logo');
  const r1 = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Approved HOOF myth/fact tile', purpose: 'approved', note: 'current identity', imageB64: PNG, mime: 'image/png' }); R1 = r1.d.id;
  const r2x = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Cinematic truck (quality reference)', purpose: 'inspiration', note: 'hierarchy, scale, atmosphere - not a brand specification', imageB64: PNG, mime: 'image/png' }); R2 = r2x.d.id;
});
let EV = null;
await t('explore: three concepts as expressive plans - cinematic editable, a two-frame carousel, a full artwork - laid out from their elements and regions, the wordmark placed by policy, what cannot be drawn named, distinctness measured on the drawn result', async () => {
  const j = await jobRun(P, 'concepts', { asset: A, feedback: 'Give me different variations', mode: 'explore' }, A); eq(j.state, 'done', j.error);
  const body = anth.calls[anth.calls.length - 1]; eq(body.output_config.effort, 'high', 'concept development runs at high effort'); eq(imagesOf(body), 3, 'artwork plus two references'); ok(/PLAN\. Coordinates are per cent/.test(body.system) && /approach "editable" means/.test(body.system), 'the plan vocabulary is taught');
  ok(/CAMPAIGN IDENTITY: Hands Off Our Fuel - MYTH in red/.test(textOf(body)) && /mark policy: wordmark \(wordmark on file\)/.test(textOf(body)), textOf(body).match(/CAMPAIGN IDENTITY[^\n]*/)[0]);
  EV = (await events(P, 'concepts')).pop(); eq(EV.mode, 'explore'); eq(EV.options.length, 3); eq(j.result.distinct, 3);
  const [c1, c2, c3] = EV.options;
  eq([c1.kind, c1.medium, c1.approach, c1.layout.v], ['plan', 'photo-cinematic', 'editable', 5]);
  const kicker = c1.layout.layers.find(l => l.role === 'kicker'); eq([kicker.text, kicker.emphasis, kicker.bg], ['MYTH', 'caps', '#C8102E']); ok(c1.layout.layers.some(l => l.type === 'shape' && l.shape === 'rule' && l.fill === '#0E6A6E'), 'the teal rule'); eq(layerOf(c1.layout, 'headline').size, 9);
  ok(layerOf(c1.layout, 'wordmark') && !layerOf(c1.layout, 'logo'), 'the wordmark by policy'); eq(c1.layout.regions.length, 1); eq(c1.layout.regions[0].refs.map(r => r.id), [R2, R1]); eq(c1.renders, 1); ok(/1 render at 2K plus a layout version/.test(c1.cost), c1.cost); eq(c1.basis[1].kind, 'reference'); eq(c1.basis[1].ref, 'Cinematic truck (quality reference)');
  eq([c2.kind, c2.medium, c2.frames], ['plan', 'carousel', 2]); eq(c2.layout.frames[0].layout.bg, { from: '#C8102E', to: '#7A0A1C', dir: 'down' }); eq(c2.layout.frames[1].layout.bg, '#0E6A6E'); ok(c2.layout.frames[1].layout.layers.some(l => l.type === 'img' && l.region === 'cut'), 'the cutout region is a layer'); eq(c2.layout.frames[0].copy.headline, 'Myth: fuel tax credits are a subsidy for miners'); eq(c2.renders, 1, 'one cutout to make; the opener needs no image');
  eq([c3.kind, c3.approach], ['plan', 'artwork']); ok(c3.unsupported.some(u => /type "video" cannot be drawn/.test(u)), JSON.stringify(c3.unsupported)); ok(/words in the bitmap/.test(c3.cost));
  ok(!EV.options.some(o => o.similar), 'three distinct signatures: ' + EV.options.map(o => o.sig).join(' / '));
  ok(/3 concepts/.test(EV.text) && /Proposed as sketches/.test(EV.text), EV.text);
});
let FRAMES = [];
await t('the carousel applies as one asset per frame; Generate queues the image work each frame needs; the image model receives the reference images with their roles; the result records model, size and conversation; an inspection follows and offers one bounded correction', async () => {
  const n = (await get(P)).assets.length; const g0 = gem.calls.length;
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: 1, render: true }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.frames, 2); eq(r.d.assets.length, 2); FRAMES = r.d.assets;
  const g = await get(P); eq(g.assets.length, n + 2); const f1 = g.assets.find(x => x.id === FRAMES[0]), f2 = g.assets.find(x => x.id === FRAMES[1]);
  eq([f1.family, f1.title, f2.title], ['Myth / fact carousel carousel', 'Frame 1: the myth', 'Frame 2: the fact']); eq(f1.versions[0].layout.frame, { index: 0, of: 2, name: 'Frame 1: the myth' }); eq(f1.versions[0].image, null, 'the opener has no photograph'); eq(f1.versions[0].copy.headline, 'Myth: fuel tax credits are a subsidy for miners');
  eq(r.d.jobs.length, 1, 'one render: the cutout on frame two'); const job = (await req('GET', '/studio/job?id=' + r.d.jobs[0])).d.job; eq([job.asset, job.input.region, job.input.regionRole, job.input.aspect], [FRAMES[1], 'cut', 'cutout', '1:1']); ok(/cutout image for carousel/.test(job.input.note) || /cutout/.test(job.input.note), job.input.note); ok(/cutout photograph of a green header harvester/.test(job.input.prompt) && /clean subject for a cutout/.test(job.input.prompt), job.input.prompt);
  const done = await run(job); eq(done.state, 'done', done.error); eq(gem.calls.length, g0 + 1);
  const gb = gem.calls[gem.calls.length - 1]; eq(gb.model, 'gemini-3-pro-image'); eq(gb.body.contents.length, 1); eq(gb.body.contents[0].role, 'user'); eq(gb.body.generationConfig.imageConfig, { aspectRatio: '1:1', imageSize: '2K' });
  const f2b = (await get(P)).assets.find(x => x.id === FRAMES[1]); const v = f2b.versions[f2b.versions.length - 1]; eq(v.kind, 'render'); const cut = v.layout.layers.find(l => l.region === 'cut'); ok(/^\/studio\/file\?key=/.test(cut.src), 'the cutout layer now points at its image'); eq(v.image, null, 'no background was made'); ok(v.context.regions && v.context.regions.cut && v.context.regions.cut.model === 'gemini-3-pro-image');
  // the opener's first concept render goes with references: apply concept 1 on the original asset and run it
  const r1 = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: 0, render: true }); eq(r1.status, 200, JSON.stringify(r1.d)); eq(r1.d.jobs.length, 1);
  const j1 = (await req('GET', '/studio/job?id=' + r1.d.jobs[0])).d.job; eq(j1.input.referenceIds.map(x => x.id), [R2, R1]); ok(/wide cinematic photograph of a Pilbara haul road/.test(j1.input.prompt) && !/documentary realism, natural light/.test(j1.input.prompt), 'concept-specific brief, not the universal one: ' + j1.input.prompt.slice(0, 200));
  const d1 = await run(j1); eq(d1.state, 'done', d1.error);
  const gb1 = gem.calls[gem.calls.length - 1]; const parts = gb1.body.contents[0].parts; eq(parts.filter(x => x.inline_data).length, 2, 'both reference images went to the image model'); ok(/REFERENCE IMAGES, attached in this order:\n1\. the drama, scale and atmosphere \(inspiration reference: Cinematic truck/.test(parts[0].text) && /2\. the red and teal of the campaign \(approved reference: Approved HOOF myth\/fact tile; the client's requirements, follow them\)/.test(parts[0].text), parts[0].text.slice(-400));
  const a1 = (await get(P)).assets.find(x => x.id === A); const v1 = a1.versions[a1.versions.length - 1]; eq([v1.image.model, v1.image.requested, v1.image.fallback, v1.image.size], ['gemini-3-pro-image', 'gemini-3-pro-image', false, '2K']); ok(/-conv\.json$/.test(v1.image.conv), 'the conversation is kept for edits'); const conv = JSON.parse(r2.get(v1.image.conv).v); eq(conv.contents.length, 2); eq(conv.contents[1].role, 'model'); ok(conv.contents[1].parts.some(x => x.thoughtSignature), 'thought signatures kept');
  const ins = (await get(P)).jobs.find(x => x.stage === 'inspect' && x.asset === A); ok(ins, 'an inspection was queued after the render'); eq(ins.idem, 'inspect:' + v1.id);
  const di = await run(ins); eq(di.state, 'done', di.error); eq(di.result.verdict, 'fix'); const ib = anth.calls[anth.calls.length - 1]; eq(imagesOf(ib), 1, 'the inspector sees the rendered image'); eq(ib.output_config.effort, 'high');
  const ie = (await events(P, 'inspection')).pop(); eq(ie.asset, A); eq(ie.scores.identity, 5); eq(ie.fix.kind, 'design'); ok(/Inspection of Instagram portrait/.test(ie.text) && /Correction offered \(design\)/.test(ie.text), ie.text);
  const ap = await req('POST', '/studio/inspection/apply', { project: P, eid: ie.eid }); eq(ap.status, 200, JSON.stringify(ap.d)); eq(ap.d.kind, 'design'); ok(ap.d.job); eq((await req('POST', '/studio/inspection/apply', { project: P, eid: ie.eid })).status, 409, 'a correction applies once');
  const apd = await events(P, 'inspection_applied'); eq(apd.length, 1, 'the applied correction is on the thread'); eq(apd[0].eid, ie.eid); ok(/Correction applied \(design, round 1 of 2\)/.test(apd[0].text), apd[0].text);
  const fj = await run((await req('GET', '/studio/job?id=' + ap.d.job)).d.job); eq(fj.state, 'done', fj.error);
  // bounded: a second inspection and correction are allowed, a third inspection stops
  const i2 = await jobRun(P, 'inspect', { asset: A }, A); eq(i2.state, 'done', i2.error); eq(i2.result.round, 2);
  const ie2 = (await events(P, 'inspection')).pop(); await req('POST', '/studio/inspection/apply', { project: P, eid: ie2.eid });
  const i3 = await jobRun(P, 'inspect', { asset: A }, A); eq(i3.state, 'done', i3.error); eq(i3.result.verdict, 'stop'); ok(/designer's eye/.test((await events(P, 'inspection')).pop().text));
});
await t('full artwork: the image model paints the whole piece from the exact words; the version is marked artwork with its baked roles and only the mark stays a live layer; an edit replays the conversation with the model\'s parts; 4K is honoured; a fallback is recorded and visible', async () => {
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: 2, render: true, size: '4K' }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.jobs.length, 1);
  const job = (await req('GET', '/studio/job?id=' + r.d.jobs[0])).d.job; eq(job.input.approach, 'artwork'); eq(job.input.baked, ['headline', 'support']); ok(/Set the words exactly as given/.test(job.input.prompt) && /headline "Fact: They're used by small businesses too"/.test(job.input.prompt) && /do not paint a logo or a wordmark/.test(job.input.prompt), job.input.prompt);
  eq(job.input.size, '2K', 'the concept render keeps the house size unless the input says otherwise');
  const done = await run(job); eq(done.state, 'done', done.error);
  let a = (await get(P)).assets.find(x => x.id === A); let v = a.versions[a.versions.length - 1]; eq(v.mode, 'artwork'); eq(v.layout.baked, ['headline', 'support']); eq(v.layout.layers.map(l => l.role), ['wordmark'], 'only the mark is a live layer'); eq(v.layout.approach, 'artwork');
  ok(/full artwork - the words are part of the bitmap/.test((await events(P, 'job')).filter(e => e.render).pop().text));
  // an edit: the earlier user and model turns are replayed, signatures and all
  const g0 = gem.calls.length;
  const ej = await jobRun(P, 'render', { prompt: 'Make the sky darker and keep every word as it is', edit: true, approach: 'artwork', baked: v.layout.baked, aspect: a.format, size: '4K' }, A); eq(ej.state, 'done', ej.error); eq(gem.calls.length, g0 + 1);
  const gb = gem.calls[gem.calls.length - 1]; eq(gb.body.contents.length, 3, 'user, model, user'); eq(gb.body.contents[1].role, 'model'); ok(gb.body.contents[1].parts.some(x => x.thoughtSignature), 'the model\'s thought signatures are replayed'); eq(gb.body.contents[2].parts[0].text.slice(0, 20), 'Make the sky darker '); eq(gb.body.generationConfig.imageConfig.imageSize, '4K');
  a = (await get(P)).assets.find(x => x.id === A); v = a.versions[a.versions.length - 1]; eq(v.image.size, '4K'); eq(v.image.editOf, a.versions[a.versions.length - 2].id); eq(v.mode, 'artwork');
  // a fallback is not hidden
  gem.fail404Once = true;
  const fj = await jobRun(P, 'render', { prompt: 'Again', edit: false, aspect: a.format, size: '2K' }, A); eq(fj.state, 'done', fj.error); eq(fj.result.fallback, true); eq(fj.result.model, 'gemini-3.1-flash-image');
  a = (await get(P)).assets.find(x => x.id === A); v = a.versions[a.versions.length - 1]; eq([v.image.fallback, v.image.requested, v.image.model], [true, 'gemini-3-pro-image', 'gemini-3.1-flash-image']); ok(/fell back from gemini-3-pro-image/.test((await events(P, 'job')).filter(e => e.render).pop().text)); ok(/fell back to gemini-3.1-flash-image/.test(v.note));
});
await t('"Create a new design" starts from the brief with the chosen references and what the team said to retain, and lands as a new asset that inherits neither the panel nor the layout', async () => {
  const n = (await get(P)).assets.length;
  const j = await jobRun(P, 'concepts', { asset: A, mode: 'new', instruction: 'Typography-led: let the 150,000 figure do the work, no photograph', refs: [R1], keep: { imagery: false, copy: true, composition: false } }, A); eq(j.state, 'done', j.error); eq(j.result.mode, 'new');
  const body = anth.calls[anth.calls.length - 1]; const user = textOf(body);
  ok(/CREATE A NEW DESIGN\. FEEDBACK FROM THE TEAM: Typography-led/.test(user) && /not the imagery, the current copy, not the composition - start fresh/.test(user), user.slice(0, 300)); ok(/THE TEAM CHOSE THESE REFERENCES FOR THE NEW DESIGN: \[" + R1 + "\]/.test(user) || user.indexOf('THE TEAM CHOSE THESE REFERENCES FOR THE NEW DESIGN: [' + R1 + ']') >= 0, 'chosen references named');
  eq(imagesOf(body), 1, 'only the chosen reference is attached; the current imagery was not retained');
  const ev = (await events(P, 'concepts')).pop(); eq(ev.mode, 'new'); eq(ev.options.length, 1); const o = ev.options[0]; eq(o.fresh, true); eq([o.medium, o.renders], ['typographic', 0]); eq(o.layout.bg, '#0E6A6E'); ok(!layerOf(o.layout, 'panel'), 'no panel inherited'); eq(o.layout.layers.find(l => l.role === 'free').text, '150,000');
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: ev.eid, index: 0, render: false }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.fresh, true);
  const g = await get(P); eq(g.assets.length, n + 1); const na = g.assets.find(x => x.id === r.d.asset); eq(na.family, 'New designs'); ok(/The number does the work/.test(na.title)); eq(na.versions.length, 1); eq(na.versions[0].image, null, 'imagery not kept'); eq(na.versions[0].layout.v, 5); eq(na.versions[0].copy.headline, 'Fact: They\'re used by small businesses too', 'copy kept'); ok(layerOf(na.versions[0].layout, 'wordmark'), 'the mark still follows the campaign');
  ok(/Created "The number does the work" as a new design/.test((await events(P, 'applied')).pop().text));
});
await t('a read key can look but not design, generate, edit or correct', async () => {
  eq((await req('POST', '/studio/job', { project: P, asset: A, stage: 'concepts', input: { asset: A, mode: 'new', instruction: 'x' } }, 'read-key')).status, 403);
  eq((await req('POST', '/studio/inspection/apply', { project: P, eid: 'e1' }, 'read-key')).status, 403);
  eq((await req('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkCampaign: 'hoof' }, 'read-key')).status, 403);
  eq((await req('GET', '/brand/wordmark?ns=mca&campaign=hoof', null, 'read-key')).status, 200, 'reading a wordmark is read-role');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
