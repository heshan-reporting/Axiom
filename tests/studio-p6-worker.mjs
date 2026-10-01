/* Creative Studio, art direction as design: references and the client's artwork memory reach the models (a vision pass
 * per reference, stored, shown as a limitation when it fails); a direction is a whole design spec the layout engine turns
 * into layers for any format (gradient, split, typographic, panel zones, type alignment, logo corner, CTA treatment);
 * three or four distinct compositions for one message, one keeping the photograph; the layout of one card with the
 * photograph of another; a combined "split layout and a wider photograph" direction applied as a layout version with the
 * photograph proposed for confirmation; photograph prompts that follow the composition's quiet zone; cached suggestions.
 * Run: node --experimental-sqlite tests/studio-p6-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const anth = { calls: [] }; const calls = { gemini: 0 };
const textOf = body => typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
const imagesOf = body => typeof body.messages[0].content === 'string' ? 0 : body.messages[0].content.filter(x => x.type === 'image').length;
const ids = user => Array.from(user.matchAll(/^\[(a[a-z0-9]+)\]/gm)).map(m => m[1]);
const refIds = user => Array.from(user.matchAll(/^\[(r[a-z0-9]+)\]/gm)).map(m => m[1]);
let refProse = false;
const REF = { summary: 'A restrained editorial tile: large serif headline top left, photograph bleeding right, thin rule, logo small bottom left.', typography: 'Bold grotesque headline in sentence case, light body; headline four times the body', colour: { palette: ['#0E6A6E', '#F4F1EA', '#141414'], relationships: 'Teal ground, cream type, black for the logo' }, hierarchy: 'Headline, then the photograph, then the sign-off', composition: 'Words in the left half, photograph on the right, generous negative space top', imageTreatment: 'Documentary photograph, warm grade, no overlay', panels: 'None: the words sit on a flat colour field', spacing: 'Wide margins, airy', logo: 'Bottom left, small', text: ['Hands Off Our Fuel'], takeaways: ['Flat colour field, no box', 'Headline far larger than the body', 'Logo small, bottom left'] };
const CONCEPTS = (user) => {
  const R = refIds(user);
  return { critique: 'The house panel sits on a fisherman nobody asked about; the words hold, the composition is the default again and ignores the approved tile.', options: [
    { name: 'Words over the sky', concept: 'Drop the panel; the headline sits top over a darkened sky, the fisher stays visible below', rationale: 'The approved reference shows the client likes type on a flat ground; here the sky is that ground', imagery: 'keep the current photograph', composition: 'Headline top, gradient from the top edge', typography: 'Larger', colour: 'Dark gradient, white type', textPlacement: 'top', design: { concept: 'words over the sky', image: { keep: true }, composition: { style: 'gradient', zone: 'top', coverage: 'standard' }, type: { align: 'left', scale: 'larger' }, panel: { fill: 'teal' }, logo: { corner: 'br' }, cta: { style: 'button' } }, keeps: ['photograph', 'copy'], changes: ['panel removed', 'gradient from the top'], needsImage: false, prompt: '', basis: [{ claim: 'Flat ground for the type, as in the approved tile', kind: 'reference', ref: R[0] }, { claim: 'White type on a dark ground reads', kind: 'inferred' }], refs: [R[0]], missing: [] },
    { name: 'Split, words left', concept: 'A teal field on the left carries the words; the photograph fills the right half', rationale: 'The approved reference is a split; this keeps the fisher whole', imagery: 'keep the current photograph', composition: 'Split left and right', typography: 'Same size, left aligned', colour: 'Teal field', textPlacement: 'left half', design: { concept: 'split, words left', image: { keep: true }, composition: { style: 'split', zone: 'left', coverage: 'standard' }, type: { align: 'left', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'panel' }, cta: { style: 'button' } }, keeps: ['photograph', 'copy', 'teal'], changes: ['split field', 'logo in the field'], needsImage: false, prompt: '', basis: [{ claim: 'Teal is the campaign colour', kind: 'rule' }, { claim: 'Split composition as in the approved tile', kind: 'reference', ref: R[0] }], refs: [R[0]], missing: [] },
    { name: 'Type-led', concept: 'The brand colour fills the tile, the headline leads, a small photograph bottom right', rationale: 'Typography-led, like the approved tile, for a message that is an argument not a scene', imagery: 'keep the current photograph, shown small', composition: 'Headline top, small image bottom right', typography: 'Headline larger, centred', colour: 'Teal field, cream type', textPlacement: 'top', design: { concept: 'type-led', image: { keep: true }, composition: { style: 'typographic', zone: 'top', coverage: 'standard' }, type: { align: 'centre', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'tl' }, cta: { style: 'text' } }, keeps: ['copy'], changes: ['brand colour field', 'photograph small', 'CTA as text', 'logo top left'], needsImage: false, prompt: '', basis: [{ claim: 'Flat colour field, no box', kind: 'reference', ref: R[0] }], refs: [R[0]], missing: ['Whether the logo may sit top left'] },
    { name: 'Wider harbour', concept: 'A wider documentary photograph of the fisher on the right with open water left, a compact panel right', rationale: 'Gives the words room without covering the subject', imagery: 'A trawler deckhand coiling rope at dawn, subject right, open grey water left', composition: 'Compact panel right', typography: 'Same', colour: 'Teal panel', textPlacement: 'right', design: { concept: 'wider harbour', image: { keep: false, subject: 'a trawler deckhand coiling rope', setting: 'a fishing harbour at dawn, Tasmania', framing: 'wide, subject on the right third', lighting: 'soft dawn light', mood: 'quiet, working', focal: 'right' }, composition: { style: 'panel', zone: 'right', coverage: 'compact' }, type: { align: 'left', scale: 'same' }, panel: { fill: 'teal' }, logo: { corner: 'br' }, cta: { style: 'button' } }, keeps: ['teal panel', 'copy'], changes: ['photograph', 'panel compact right'], needsImage: true, prompt: 'A trawler deckhand coiling rope on deck at dawn in a Tasmanian fishing harbour, wide frame, subject on the right third, open grey water on the left', basis: [{ claim: 'Restrained imagery preferred', kind: 'preference' }], refs: [], missing: [] }] };
};
function decide(user) {
  const ins = (user.match(/TEAM LEAD[^\n]*\):\n([^\n]+)/) || [])[1] || ''; const A = ids(user); const R = refIds(user);
  if (/split layout and create a wider photograph/i.test(ins)) return { kind: 'design', reply: 'A split with the words left and a wider photograph on the right.', design: { assets: [A[0]], spec: { concept: 'split with a wider photograph', composition: { style: 'split', zone: 'left', coverage: 'standard' }, type: { align: 'left' }, panel: { fill: 'teal' }, logo: { corner: 'panel' }, cta: { style: 'button' } }, image: { subject: 'a wide harbour at first light with a trawler', setting: 'Hobart waterfront', framing: 'wide, horizon low', lighting: 'first light', mood: 'calm', focal: 'right' }, steps: ['Split field left, words in it', 'Wider photograph on the right'], refs: [R[0]] }, memory: { standing: false } };
  if (/translucent/i.test(ins)) return { kind: 'design', reply: 'A compact translucent panel, upper left, keeping the fisher visible.', design: { assets: [A[0]], spec: { concept: 'compact translucent panel upper left', composition: { style: 'translucent', zone: 'top', coverage: 'compact' }, type: { align: 'left' }, panel: { fill: 'teal', opacity: 0.55 }, logo: { corner: 'br' }, cta: { style: 'button' } }, image: null, steps: ['Panel compact and translucent', 'Nothing else moves'], refs: [] }, memory: { standing: false } };
  return { kind: 'text', reply: 'Headline sharpened.', changes: [{ asset: A[0], copy: { headline: 'Not a subsidy. Never was.' }, note: 'sharper' }], memory: { standing: false } };
}
const SUGGEST = (user) => { const R = refIds(user); return { design: [{ text: 'Keep the fisher visible. Replace the large teal panel with a compact translucent panel in the upper left and move the CTA below the headline.', why: 'The subject is covered now', refs: [] }, { text: 'Use the flat colour field and the large headline from the approved tile, adapted to this portrait format.', why: 'Matches the approved reference', refs: [R[0]] }, { text: 'Set the words on a split teal field to the left and let the photograph fill the right half.', why: 'Clean separation', refs: [R[0]] }], image: [{ text: 'A wider documentary photograph with the fisher on the right and open water on the left for the headline.', why: 'Room for the words' }, { text: 'The same deck at dawn, closer on the hands and the rope, sky quiet above.', why: 'Human consequence' }, { text: 'A regional fuel bowser at a boat ramp, early light, empty lower third.', why: 'Where the credit is used' }] }; };
const pieces = user => ({ pieces: ['linkedin', 'facebook', 'instagram', 'x'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: 'Not a subsidy. A tax that never applied.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24. Hands Off Our Fuel.', alt: 'tile', visual: 'Harvester at dusk', design: c === 'facebook' ? { concept: 'split for Facebook', image: { keep: false, subject: 'a harvester at dusk', setting: 'the Wimmera', framing: 'wide', lighting: 'dusk', mood: 'calm', focal: 'right' }, composition: { style: 'split', zone: 'bottom', coverage: 'standard' }, type: { align: 'left' }, panel: { fill: 'teal' }, logo: { corner: 'panel' }, cta: { style: 'button' } } : undefined, claims: [], hashtags: [] })) });
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gemini++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body);
    const sys = String(body.system || ''), user = textOf(body);
    let text;
    if (/describing one reference image/.test(sys)) text = refProse ? 'It is a lovely teal tile with a big headline.' : JSON.stringify(REF);
    else if (/suggesting the next things the team might ask for/.test(sys)) text = JSON.stringify(SUGGEST(user));
    else if (/art director of an Australian political communications agency\. You are shown one social tile/.test(sys)) text = JSON.stringify(CONCEPTS(user));
    else if (/decide what the instruction asks/.test(sys)) text = JSON.stringify(decide(user));
    else if (/producing a coordinated set/.test(sys)) text = JSON.stringify(pieces(user));
    else text = '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; try { d = await res.json(); } catch (x) { d = null; } return { status: res.status, d };
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
const geoOf = L => { const pn = layerOf(L, 'panel'); return pn ? [pn.x, pn.y, pn.w, pn.h] : null; };

console.log('studio-p6-worker harness (art direction as design: references, specs, combinations, suggestions)');
let P = '', A = '', R1 = '', R2 = '', R3 = '';
await t('setup: the house default is unchanged - a composition laid out by the asset route is the teal panel in the lower third with the logo bottom right', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }], facts: [{ text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'ATO' }], banned: [{ term: 'subsidy', allowNegated: true }], logoB64: PNG, logoMime: 'image/png' });
  await req('GET', '/engine/status?ns=mca');
  env.MIND_DB.db.prepare("INSERT INTO engine_art(id,ns,title,key,mime,description,meta,docId,who,created) VALUES('art1','mca','HOOF harvester tile','art/mca/art1','image/png','Square tile: a harvester at dusk under a teal fact panel in the lower third, white Bricolage headline, logo bottom right. Text: Fuel tax credits are not a subsidy.','{}','','Dee',1000)").run();
  env.MIND_DB.db.prepare("INSERT INTO engine_art(id,ns,title,key,mime,description,meta,docId,who,created) VALUES('art2','aep','AEP gas tile','art/aep/art2','image/png','Another client’s tile: must never appear for MCA.','{}','','Dee',1000)").run();
  const p = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Design test', brief: { objective: 'answer the subsidy framing', message: 'small businesses use them', channels: ['linkedin', 'facebook'] } }); P = p.d.id;
  r2.set('studio/x/y/fisher.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
  const a = await req('POST', '/studio/asset', { project: P, family: 'Campaign set', channel: 'instagram', format: '4:5', title: 'Instagram portrait', copy: { headline: 'Fact: They\'re used by small businesses too', support: 'Farmers, fishers, builders, wineries, tourism operators and tradies use Fuel Tax Credits.', cta: 'handsoffourfuel.com.au', caption: 'Who uses the credit? Hands Off Our Fuel.', alt: 'tile' }, image: { key: 'studio/x/y/fisher.png', url: '/studio/file?key=studio%2Fx%2Fy%2Ffisher.png', model: 'gemini-3-pro-image', size: '2K' }, mode: 'composition' }); A = a.d.asset.id;
  const L = a.d.asset.versions[0].layout;
  eq(L.v, 4); eq(geoOf(L), [6, 54, 74, 34]); eq(L.style, 'same'); eq(L.placement, 'bottom'); eq(L.image, null); eq(L.design.composition, { style: 'panel', zone: 'bottom', coverage: 'standard' }); eq(L.design.image.keep, true);
  const logo = layerOf(L, 'logo'); eq([logo.x, logo.w], [78, 17]); ok(logo.y > 85, 'logo bottom right');
  ok(!layerOf(L, 'overlay')); ok(layerOf(L, 'cta').bg, 'the CTA is a button');
});
await t('references are read by a vision pass at upload and stored; a reference the model cannot describe is recorded as not analysed and retried on request; one without an image is known by name only', async () => {
  const n0 = anth.calls.length;
  const r1 = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Approved HOOF tile', purpose: 'approved', note: 'the client signed this off', imageB64: PNG, mime: 'image/png' }); eq(r1.status, 200, JSON.stringify(r1.d)); R1 = r1.d.id;
  eq(anth.calls.length, n0 + 1, 'one vision call'); eq(imagesOf(anth.calls[n0]), 1, 'the reference image went to the model'); eq(anth.calls[n0].model, 'claude-sonnet-5-5', 'the extraction model reads references');
  eq(r1.d.analysis.summary, REF.summary); eq(r1.d.analysis.colour.palette, ['#0E6A6E', '#F4F1EA', '#141414']); eq(r1.d.analysis.takeaways.length, 3);
  refProse = true;
  const r2x = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Competitor farm ad', purpose: 'inspiration', imageB64: PNG, mime: 'image/png' }); R2 = r2x.d.id; refProse = false;
  ok(r2x.d.analysis && r2x.d.analysis.error && /did not describe/.test(r2x.d.analysis.error), JSON.stringify(r2x.d.analysis));
  const r3 = await req('POST', '/studio/reference', { project: P, kind: 'note', name: 'Mood: quiet dawn', purpose: 'mood', note: 'early light, no machinery' }); R3 = r3.d.id; eq(r3.d.analysis, null, 'no image, no vision pass');
  const g = await get(P); eq(g.references.length, 3); eq(g.references[0].analysis.summary, REF.summary); ok(g.references[1].analysis.error); eq(g.references[2].analysis, null);
  const ev = (await events(P, 'reference')); ok(/Read: A restrained editorial tile/.test(ev[0].text), ev[0].text); ok(/Not analysed/.test(ev[1].text), ev[1].text);
  const again = await req('POST', '/studio/reference/analyse', { id: R2 }); eq(again.status, 200); eq(again.d.ok, true); eq(again.d.analysis.summary, REF.summary, 'the retry stored the analysis');
  eq((await req('POST', '/studio/reference/analyse', { id: R2 }, 'read-key')).status, 403);
});
let EV = null;
await t('"Give me different variations": the art director sees the artwork and the reference images, reads the analyses, the purposes and the client\'s own past artwork (never another client\'s), and proposes four distinct compositions - three on the current photograph - each a full design spec laid out for the format', async () => {
  const n0 = anth.calls.length;
  const j = await jobRun(P, 'concepts', { asset: A, feedback: 'Give me different variations' }, A); eq(j.state, 'done', j.error);
  const body = anth.calls[anth.calls.length - 1]; eq(anth.calls.length, n0 + 1); eq(body.model, 'claude-opus-5-5');
  eq(imagesOf(body), 3, 'the artwork and two reference images are attached'); const user = textOf(body);
  ok(/REFERENCES ON THE PROJECT \(3\)/.test(user), 'the references block'); ok(user.indexOf(REF.summary) >= 0 && /Typography: Bold grotesque/.test(user) && /Take: Flat colour field/.test(user), 'the analysis reaches the model');
  ok(new RegExp('\\[' + R3 + '\\] Mood: quiet dawn \\(mood; early light, no machinery\\) - not analysed').test(user), 'the unanalysed reference is a limitation, not a silent gap: ' + user.slice(user.indexOf('REFERENCES'), user.indexOf('REFERENCES') + 900));
  ok(/brand and approved references carry the client's requirements[^.]*constraints/.test(user), 'purpose semantics'); ok(/\[attached as an image\]/.test(user));
  ok(/PAST ARTWORK ON FILE FOR THIS CLIENT \(1/.test(user) && /HOOF harvester tile/.test(user) && user.indexOf('AEP gas tile') < 0, 'artwork memory for this client only');
  ok(/Composition now: the panel as it is, words bottom \(standard\)/.test(user), 'the current composition is described structurally: ' + (user.match(/Composition now:[^\n]*/) || [''])[0]);
  ok(/DESIGN SPEC\./.test(body.system) && /typographic = the brand colour fills the stage/.test(body.system), 'the spec vocabulary is taught');
  EV = (await events(P, 'concepts')).pop(); eq(EV.asset, A); eq(EV.imageSeen, true); eq(EV.options.length, 4); eq(EV.refsUsed.length, 3); eq(EV.unanalysed.length, 1); eq(EV.memory, 1);
  const [o1, o2, o3, o4] = EV.options;
  eq(o1.summary, 'a gradient overlay behind the words, no box, words top (standard), headline larger, fill teal, logo br, current photograph');
  const ov = layerOf(o1.layout, 'overlay'); ok(ov && ov.gradient && ov.dir === 'down' && ov.y === 0, 'gradient from the top edge: ' + JSON.stringify(ov)); ok(!layerOf(o1.layout, 'panel'), 'no panel'); eq(layerOf(o1.layout, 'headline').y, layerOf(o1.layout, 'headline').y); ok(layerOf(o1.layout, 'headline').y < 15, 'headline top');
  eq(o1.refs, [{ id: R1, name: 'Approved HOOF tile' }]); eq(o1.basis[0], { claim: 'Flat ground for the type, as in the approved tile', kind: 'reference', ref: 'Approved HOOF tile' });
  eq(geoOf(o2.layout), [0, 0, 50, 100]); eq(o2.layout.image, { x: 50, y: 0, w: 50, h: 100 }, 'split left: the photograph fills the right half'); eq(layerOf(o2.layout, 'panel').radius, 0); const lg2 = layerOf(o2.layout, 'logo'); ok(lg2.x < 50 && lg2.y > 80, 'logo inside the field: ' + JSON.stringify(lg2));
  eq(o3.design.composition.style, 'typographic'); eq(o3.layout.bg, '#0E6A6E', 'the brand colour fills the stage'); eq(o3.layout.image, { x: 56, y: 66, w: 38, h: 26 }, 'a small photograph bottom right'); ok(!layerOf(o3.layout, 'panel')); eq(layerOf(o3.layout, 'headline').align, 'center'); ok(layerOf(o3.layout, 'headline').size > layerOf(o1.layout, 'headline').size - 0.9, 'type leads'); ok(!layerOf(o3.layout, 'cta').bg, 'CTA as text'); eq([layerOf(o3.layout, 'logo').x, layerOf(o3.layout, 'logo').y], [5, 4], 'logo top left'); eq(o3.missing, ['Whether the logo may sit top left']);
  eq(o4.needsImage, true); eq(o4.design.image.keep, false); eq(o4.design.image.subject, 'a trawler deckhand coiling rope'); const g4 = geoOf(o4.layout); eq([g4[0], g4[2]], [40, 54], 'compact panel on the right: ' + JSON.stringify(g4)); eq(o4.cost, '1 render at 2K plus a layout version');
  ok(!EV.options.some(o => o.similar), 'four distinct compositions');
  const sigs = EV.options.map(o => JSON.stringify(o.layout.layers.map(l => [l.role, l.x, l.y, l.w, l.h, l.hidden])) + JSON.stringify(o.layout.image)); eq(new Set(sigs).size, 4, 'every card lays out differently');
  eq(EV.options.filter(o => o.design.image.keep).length, 3, 'three reuse the photograph');
  ok(/Read 3 references \(1 by name only\)/.test(EV.text), EV.text);
});
await t('a card applies as a layout version on the same photograph; the layout of one card can take the photograph of another, and that render prompt follows the composition\'s quiet zone, not the lower third', async () => {
  const g0 = calls.gemini;
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: 1, render: false }); eq(r.status, 200, JSON.stringify(r.d));
  let a = (await get(P)).assets.find(x => x.id === A); let v = a.versions[a.versions.length - 1]; eq(v.kind, 'layout'); eq(v.layout.image, { x: 50, y: 0, w: 50, h: 100 }); eq(v.image.key, 'studio/x/y/fisher.png', 'photograph kept'); eq(calls.gemini, g0); eq(v.note, 'art direction: Split, words left'); eq(v.context.design, EV.options[1].summary);
  const c = await req('POST', '/studio/concept/apply', { project: P, eid: EV.eid, index: 0, imageFrom: 3, render: true }); eq(c.status, 200, JSON.stringify(c.d)); ok(c.d.job, 'a render was queued'); eq(c.d.imageFrom, 3);
  a = (await get(P)).assets.find(x => x.id === A); v = a.versions[a.versions.length - 1]; eq(v.note, 'art direction: Words over the sky with the photograph from Wider harbour'); ok(layerOf(v.layout, 'overlay') && layerOf(v.layout, 'overlay').dir === 'down'); eq(v.layout.design.image.keep, false); eq(v.layout.design.image.subject, 'a trawler deckhand coiling rope');
  const job = (await req('GET', '/studio/job?id=' + c.d.job)).d.job; eq(job.idem, 'render:' + EV.eid + ':0+3:' + A);
  ok(/trawler deckhand coiling rope/.test(job.input.prompt), job.input.prompt); ok(/keep the upper third of the frame quiet/.test(job.input.prompt) && /sit directly over it/.test(job.input.prompt) && /place the subject toward the lower part/.test(job.input.prompt), 'the quiet zone follows the gradient-top composition: ' + job.input.prompt);
  ok(!/lower third/.test(job.input.prompt), 'no automatic lower third');
  const ap = (await events(P, 'applied')).pop(); eq(ap.imageFrom, 3); ok(/with the photograph from "Wider harbour"/.test(ap.text), ap.text);
  await run(job); eq(calls.gemini, g0 + 1);
});
await t('a combined direction - "use a split layout and create a wider photograph" - is one coherent answer: the composition is applied now as a layout version on the current image, the photograph is proposed for confirmation, and its prompt describes the photograph\'s own region', async () => {
  const g0 = calls.gemini; const a0 = (await get(P)).assets.find(x => x.id === A); const n = a0.versions.length;
  const j = await jobRun(P, 'revise', { target: 'asset', asset: A, instruction: 'Use a split layout and create a wider photograph' }); eq(j.state, 'done', j.error); eq(j.result.kind, 'design'); eq(j.result.changed, [A]); eq(j.result.proposed, true);
  const body = anth.calls[anth.calls.length - 1]; ok(/design: the lead wants a different composition/.test(body.system), 'the design kind is taught'); ok(imagesOf(body) >= 1, 'the artwork is attached to the revise call'); ok(/REFERENCES ON THE PROJECT/.test(textOf(body)) && /COMPOSITION OF Instagram portrait NOW/.test(textOf(body)));
  const a = (await get(P)).assets.find(x => x.id === A); eq(a.versions.length, n + 1); const v = a.versions[a.versions.length - 1]; eq(v.kind, 'layout'); eq(v.layout.image, { x: 50, y: 0, w: 50, h: 100 }); eq(v.image.key, a0.versions[a0.versions.length - 1].image.key, 'the current photograph is reused until the new one lands'); eq(calls.gemini, g0, 'nothing spent');
  const prop = (await events(P, 'proposal')).pop(); eq(prop.design, true); eq(prop.assets, [A]); ok(/The composition is applied now \(1 asset at a new layout version on the current photograph: a split composition/.test(prop.text), prop.text); ok(/confirm and it runs as one render per asset \(1 at 2K\)/.test(prop.text)); eq(prop.spec.image.subject, 'a wide harbour at first light with a trawler'); eq(prop.refs, [{ id: R1, name: 'Approved HOOF tile' }]);
  const d = await req('POST', '/studio/proposal', { project: P, eid: prop.eid, decision: 'do' }); eq(d.status, 200, JSON.stringify(d.d)); eq(d.d.jobs.length, 1);
  const job = (await req('GET', '/studio/job?id=' + d.d.jobs[0])).d.job; ok(/wide harbour at first light/.test(job.input.prompt), job.input.prompt); ok(/its own region beside the words, cropped to fill the right half/.test(job.input.prompt) && /no text zone is laid over the photograph/.test(job.input.prompt), job.input.prompt); ok(!/lower third/.test(job.input.prompt));
  await run(job); eq(calls.gemini, g0 + 1);
  const j2 = await jobRun(P, 'revise', { target: 'asset', asset: A, instruction: 'Make it a compact translucent panel upper left' }); eq(j2.state, 'done', j2.error); eq(j2.result.kind, 'design'); eq(j2.result.proposed, undefined);
  const a2 = (await get(P)).assets.find(x => x.id === A); const v2 = a2.versions[a2.versions.length - 1]; const pn = layerOf(v2.layout, 'panel'); eq(pn.opacity, 0.55); eq([pn.x, pn.y, pn.w], [6, 6, 56]); eq(v2.layout.image, null, 'the photograph covers the stage again'); eq(calls.gemini, g0 + 1, 'a layout-only design spends nothing');
  const ev = (await events(P, 'revise')).pop(); ok(/Design change: 1 asset at a new layout version \(a translucent panel over the photograph, words top \(compact\)/.test(ev.text), ev.text); eq(ev.render, false);
});
await t('suggested next directions: three design and three photograph suggestions from the tile, the references and the recent feedback; cached on the version until something changes; refresh asks again; a read key cannot spend the call; copy-only assets have none', async () => {
  const n0 = anth.calls.length;
  const s = await req('POST', '/studio/suggest', { project: P, asset: A }); eq(s.status, 200, JSON.stringify(s.d)); eq(s.d.ok, true); eq(s.d.cached, false); eq(anth.calls.length, n0 + 1);
  const body = anth.calls[n0]; eq(body.model, 'claude-sonnet-5-5', 'the cheaper model suggests'); ok(/suggesting the next things/.test(body.system)); ok(/RECENT FEEDBACK ON THIS ASSET/.test(textOf(body)) && /compact translucent panel upper left/.test(textOf(body)), 'recent feedback is in the prompt'); ok(/REFERENCES ON THE PROJECT/.test(textOf(body)));
  eq(s.d.design.length, 3); eq(s.d.image.length, 3); eq(s.d.design[1].refs, [{ id: R1, name: 'Approved HOOF tile' }]); ok(/compact translucent panel in the upper left/.test(s.d.design[0].text)); ok(/fisher on the right and open water on the left/.test(s.d.image[0].text)); eq(s.d.imageSeen, true);
  const s2 = await req('POST', '/studio/suggest', { project: P, asset: A }); eq(s2.d.cached, true); eq(anth.calls.length, n0 + 1, 'no second call for the same version');
  const s3 = await req('POST', '/studio/suggest', { project: P, asset: A, refresh: true }); eq(s3.d.cached, false); eq(anth.calls.length, n0 + 2);
  eq((await req('POST', '/studio/suggest', { project: P, asset: A }, 'read-key')).status, 403);
  const c = await req('POST', '/studio/asset', { project: P, family: 'Copy', channel: 'x', format: '16:9', title: 'X copy', copy: { headline: 'Hook', caption: 'A post.' }, mode: 'copy' });
  const s4 = await req('POST', '/studio/suggest', { project: P, asset: c.d.asset.id }); eq(s4.status, 400); eq(s4.d.error, 'copy_only');
});
await t('first production: the creative team may choose a composition per channel (a design spec on the piece), and the photograph prompt follows it; a piece without one gets the house panel', async () => {
  const p = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Production design', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['linkedin', 'facebook'] } }); const P2 = p.d.id;
  const j = await jobRun(P2, 'copy', { channels: ['linkedin', 'facebook'], deliverable: 'set', render: true }); eq(j.state, 'done', j.error);
  const body = anth.calls[anth.calls.length - 1]; ok(/DESIGN\. For each composition choose the composition/.test(body.system), 'production is taught the spec'); ok(/REFERENCES: none on the project/.test(textOf(body)) && /PAST ARTWORK ON FILE/.test(textOf(body)));
  const g = await get(P2); const li = g.assets.find(x => x.channel === 'linkedin'), fb = g.assets.find(x => x.channel === 'facebook');
  eq(li.versions[0].layout.style, 'same'); eq(li.versions[0].layout.image, null);
  eq(fb.versions[0].layout.design.composition.style, 'split'); eq(fb.versions[0].layout.image, { x: 0, y: 0, w: 100, h: 54 }, 'split bottom on a square: the photograph above');
  const rj = g.jobs.filter(x => x.stage === 'render'); eq(rj.length, 2);
  const fbJob = rj.find(x => x.asset === fb.id), liJob = rj.find(x => x.asset === li.id);
  ok(/its own region beside the words, cropped to fill the upper part/.test(fbJob.input.prompt) && /Subject: a harvester at dusk/.test(fbJob.input.prompt), fbJob.input.prompt);
  ok(/keep the lower third of the frame quiet/.test(liJob.input.prompt) && /sit in a panel laid over it/.test(liJob.input.prompt), liJob.input.prompt);
});
await t('the spec engine covers every format: zones and styles place the words and the photograph consistently, locked and hidden layers carry through, and the house default for each format is what it was', async () => {
  const mk = async (format, channel) => (await req('POST', '/studio/asset', { project: P, family: 'F', channel, format, title: 'T ' + format, copy: { headline: 'H', support: 'S', cta: 'C' }, image: { key: 'studio/x/y/fisher.png', url: '', model: 'm', size: '2K' }, mode: 'composition' })).d.asset;
  const sq = await mk('1:1', 'linkedin'), wide = await mk('16:9', 'x'), tall = await mk('9:16', 'instagram');
  eq(geoOf(sq.versions[0].layout), [6, 50, 74, 38]); eq(geoOf(wide.versions[0].layout), [6, 34, 52, 54]); eq(geoOf(tall.versions[0].layout), [7, 58, 74, 30]);
  // a direction on the landscape: split keeps the words left and the photograph right whatever the zone word, a gradient on the left darkens from the left
  const wj = await jobRun(P, 'revise', { target: 'asset', asset: wide.id, instruction: 'Use a split layout and create a wider photograph' }); eq(wj.state, 'done', wj.error);
  const w = (await get(P)).assets.find(x => x.id === wide.id); const wl = w.versions[w.versions.length - 1].layout; eq(geoOf(wl), [0, 0, 48, 100]); eq(wl.image, { x: 48, y: 0, w: 52, h: 100 });
  // locks: a hand-placed, locked logo keeps its place through a direction; a hidden support stays hidden
  const cur = w.versions[w.versions.length - 1]; const L = JSON.parse(JSON.stringify(cur.layout)); const lg = layerOf(L, 'logo'); lg.x = 40; lg.y = 80; lg.locked = true; layerOf(L, 'support').hidden = true;
  await req('POST', '/studio/version', { asset: wide.id, revision: w.revision, layout: L, kind: 'layout', note: 'hand placed' });
  const wj2 = await jobRun(P, 'revise', { target: 'asset', asset: wide.id, instruction: 'Make it a compact translucent panel upper left' }); eq(wj2.state, 'done', wj2.error);
  const w2 = (await get(P)).assets.find(x => x.id === wide.id); const l2 = w2.versions[w2.versions.length - 1].layout; eq([layerOf(l2, 'logo').x, layerOf(l2, 'logo').y, !!layerOf(l2, 'logo').locked], [40, 80, true]); eq(layerOf(l2, 'support').hidden, true); eq(layerOf(l2, 'panel').opacity, 0.55);
  // a locked layout refuses a design but keeps the text change path open
  await req('POST', '/studio/lock', { asset: wide.id, element: 'layout' });
  const wj3 = await jobRun(P, 'revise', { target: 'asset', asset: wide.id, instruction: 'Use a split layout and create a wider photograph' }); eq(wj3.state, 'done', wj3.error); eq(wj3.result.changed, []); eq(wj3.result.kept, ['T 16:9/layout']);
  await req('POST', '/studio/lock', { asset: wide.id, element: 'layout', locked: false });
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
