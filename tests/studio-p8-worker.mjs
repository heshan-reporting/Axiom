/* Creative Studio P8, a production-quality client-aware workflow: the first production runs through the plan engine (with a
 * house fallback that says so) and forwards the chosen resolution; the brief is checked before anything is spent and its
 * fields have sourced suggestions; the campaign's mark policy is enforced server-side (a plan cannot override it, a missing
 * mandatory mark makes the composition incomplete and blocks design approval, never a substitute), and placement is learned
 * only from approved references; the reference pack is chosen by campaign and purpose in three modes and a large original is
 * represented by a prepared copy; retain controls hold in planning and in application; look-alike concepts get one replanning
 * round; the size chosen on Generate reaches the render; regions rendered from the same version merge instead of branching;
 * an edit history is never replayed to another model; the final image is not a thought image; a cutout is checked for
 * transparency; the inspection reads the composed export with the whole text inventory; a stale correction is refused; a ship
 * verdict never approves; the identity audit reports exactly what is on file.
 * Run: node --experimental-sqlite tests/studio-p8-worker.mjs */
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
// a PNG header whose IHDR colour type (byte 25) says whether it carries alpha: 6 = RGBA, 2 = RGB
const png = (colourType, fill) => { const b = Buffer.alloc(120, fill || 0); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b[24] = 8; b[25] = colourType; return b; };
const PNG = png(6).toString('base64');
const anth = { calls: [] }; const gem = { calls: [], queue: [], fail404Once: false };
const textOf = body => typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
const imagesOf = body => typeof body.messages[0].content === 'string' ? 0 : body.messages[0].content.filter(x => x.type === 'image').length;
const refIds = user => Array.from(user.matchAll(/^\[(r[a-z0-9]+)\]/gm)).map(m => m[1]);
const REF = { summary: 'An approved HOOF tile: MYTH in red, FACT in teal, the wordmark small.', typography: 'Condensed caps', colour: { palette: ['#C8102E', '#0E6A6E'], relationships: 'Red myth, teal fact' }, hierarchy: 'MYTH, claim, FACT', composition: 'Two bands', imageTreatment: 'Industry photograph', panels: 'Two bands', spacing: 'Tight', logo: 'Wordmark bottom left, small', text: ['MYTH', 'FACT'], takeaways: ['Red and teal bands', 'Wordmark, not the client logo'] };
const T = (role, t, x, y, w, h, size, extra) => Object.assign({ type: 'text', role, text: t, x, y, w, h, size, weight: 750, color: '#FFFFFF', align: 'left', font: 'display' }, extra || {});
// first production: one channel planned (asks for the client logo, which the HOOF policy overrules), one with no plan (the house fallback)
const PIECES = user => { const R = refIds(user); return { pieces: [
  { channel: 'instagram', headline: 'Fuel tax credits are not a subsidy', support: 'Farmers, fishers and tradies use them.', cta: 'handsoffourfuel.com.au', caption: 'Not a subsidy.', alt: 'tile', visual: 'a header harvester at dusk', claims: [],
    plan: { medium: 'photo-cinematic', approach: 'editable', story: 'the myth answered over a dramatic paddock', mark: 'logo', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A wide cinematic photograph of a header harvester at dusk, sky left quiet', refs: R.length ? [{ id: R[0], role: 'the red and teal' }] : [] }],
      elements: [T('kicker', 'MYTH BUSTED', 6, 8, 40, 6, 3, { emphasis: 'caps', bg: '#C8102E' }), T('headline', '', 6, 16, 60, 26, 8), T('support', '', 6, 46, 56, 12, 3, { weight: 500, font: 'body' }), T('cta', '', 6, 84, 36, 6, 2.5, { bg: '#FFFFFF', color: '#0F1420', font: 'body' })] } },
  { channel: 'facebook', headline: 'Not a subsidy', support: 'A tax that never applied.', cta: 'Learn more', caption: 'Not a subsidy.', alt: 'tile', visual: 'a regional road', claims: [] }] }; };
const plan = (name, medium, regions, elements, extra) => Object.assign({ name, concept: name, rationale: 'r', imagery: 'i', composition: 'c', typography: 't', colour: 'c', devices: 'd', mark: 'campaign', plan: { medium, approach: 'editable', story: name, mark: 'campaign', regions, elements }, keeps: [], changes: [], needsImage: true, basis: [{ claim: 'inferred', kind: 'inferred' }], refs: [], missing: [] }, extra || {});
const BG = (prompt) => ({ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt, refs: [] });
const SAME = [T('headline', '', 6, 60, 70, 20, 7), T('support', '', 6, 82, 60, 8, 3)];
let conceptMode = 'lookalike';
const CONCEPTS = user => {
  if (/REPLAN\./.test(user)) return { critique: 'replanned', options: [plan('Typography leads', 'typographic', [], [T('headline', '', 6, 10, 88, 40, 10), T('support', '', 6, 56, 88, 10, 3)], { needsImage: false })] };
  if (conceptMode === 'lookalike') return { critique: 'c', options: [plan('Dusk paddock', 'photo-cinematic', [BG('a paddock at dusk')], SAME), plan('Dawn paddock', 'photo-cinematic', [BG('a paddock at dawn')], SAME), plan('Split field', 'editorial', [{ id: 'bg', role: 'background', x: 50, y: 0, w: 50, h: 100, prompt: 'a harvester', refs: [] }], [T('headline', '', 4, 20, 42, 40, 6), T('support', '', 4, 64, 42, 10, 3)])] };
  if (conceptMode === 'retain') return { critique: 'c', options: [Object.assign(plan('New sky', 'photo-cinematic', [BG('a brand new stormy sky over a road')], SAME), { copy: { headline: 'A different headline the team did not ask for' } })] };
  if (conceptMode === 'regions') return { critique: 'c', options: [plan('Two cutouts', 'composite', [BG('keep the current image'), { id: 'c1', role: 'cutout', x: 5, y: 40, w: 30, h: 40, prompt: 'a cutout harvester', refs: [] }, { id: 'c2', role: 'cutout', x: 60, y: 40, w: 30, h: 40, prompt: 'a cutout truck', refs: [] }], SAME)] };
  return { critique: 'c', options: [plan('One', 'photo-cinematic', [BG('a road')], SAME)] };
};
let inspectVerdict = 'fix';
const INSPECT = () => ({ fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 5, words: { present: ['MYTH BUSTED'], wrong: [] }, issues: ['Tighten the kicker'], verdict: inspectVerdict, fix: inspectVerdict === 'ship' ? { kind: 'none', instruction: '' } : { kind: 'design', instruction: 'Move the kicker up one per cent.' }, note: 'ok' });
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    const body = JSON.parse(init.body); const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || ''); gem.calls.push({ model, body });
    if (gem.fail404Once && model === 'gemini-3-pro-image') { gem.fail404Once = false; return new Response(JSON.stringify({ error: { code: 404, message: 'model not found' } }), { status: 404 }); }
    const parts = gem.queue.length ? gem.queue.shift() : [{ text: 'Here.', thoughtSignature: 's' }, { inlineData: { mimeType: 'image/png', data: PNG }, thoughtSignature: 'si' }];
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts } }], usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 1290, totalTokenCount: 1390 } }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body);
    const sys = String(body.system || ''), user = textOf(body);
    let text;
    if (/describing one reference image/.test(sys)) text = JSON.stringify(REF);
    else if (/art director inspecting a rendered social tile/.test(sys)) text = JSON.stringify(INSPECT());
    else if (/filling gaps in a creative brief/.test(sys)) text = JSON.stringify({ objective: ['Reframe the credit as a tax never meant to apply'], audience: ['Regional voters'], message: ['Not a subsidy'], action: ['Visit the site'], deliverables: ['Two tiles'], requirements: ['Keep the red myth label'] });
    else if (/producing a coordinated set/.test(sys)) text = JSON.stringify(PIECES(user));
    else if (/art director of an Australian political communications agency, briefing/.test(sys)) text = JSON.stringify(CONCEPTS(user));
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
const cur = (g, id) => { const a = g.assets.find(x => x.id === id); return a.versions.find(v => v.id === a.current); };
const layerOf = (L, role) => (L.layers || []).find(l => l.role === role);
const queued = async (P, stage) => (await req('GET', '/studio/jobs?project=' + P)).d.jobs.filter(j => j.stage === stage && j.state === 'queued');

console.log('studio-p8-worker harness (production-quality workflow: plan-engine production, brief check, identity enforcement, reference packs, retain, replanning, Gemini gaps, composed inspection)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', cta: 'handsoffourfuel.com.au', identity: 'MYTH in red, FACT in teal, the HANDS OFF OUR FUEL wordmark', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian mining', cta: 'Learn more' }], segments: [{ id: 'regional', name: 'Regional', who: 'Regional voters and farmers' }], facts: [{ text: 'The credit is used by more than 150,000 businesses', source: 'ATO', status: 'approved' }] });
await req('POST', '/brand/kit', { ns: 'mca', logoB64: PNG, logoMime: 'image/png' });
await req('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', campaigns: [{ id: 'gas', name: 'Gas' }] });
let P = '', IG = '', FB = '', R1 = '', RX = '';

await t('the brief is checked before anything is spent: with two campaigns the first is never assumed, a project with nothing to write from is refused with the reason, acknowledging proceeds on stated assumptions; a missing mandatory mark is named as blocking approval', async () => {
  const p0 = await req('POST', '/studio/project', { ns: 'mca', title: 'Empty', brief: { channels: ['facebook'] } });
  const c0 = await req('GET', '/studio/brief/check?project=' + p0.d.id, null, 'read-key'); eq(c0.status, 200);
  ok(c0.d.gaps.some(g => g.code === 'campaign_unconfirmed' && g.level === 'mandatory' && /The first is not assumed/.test(g.text) && g.options.length === 2), JSON.stringify(c0.d.gaps));
  ok(c0.d.gaps.some(g => g.code === 'message_missing' && g.level === 'mandatory'), 'nothing to write from'); eq(c0.d.ok, false);
  const j0 = await jobRun(p0.d.id, 'copy', { channels: ['facebook'], deliverable: 'set' }); eq(j0.state, 'failed'); ok(/brief_incomplete/.test(j0.error) && !/will retry/.test(j0.error), j0.error);
  eq(anth.calls.filter(b => /producing a coordinated set/.test(String(b.system))).length, 0, 'no model call was spent on a brief with nothing in it');
  const p = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF production', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram', 'facebook'], requirements: { mandatory: ['Red MYTH label', { text: 'Wordmark, never the MCA logo', source: 'approved', from: 'campaign hoof mark policy' }], preferred: [], open: [] } } }); P = p.d.id;
  eq(p.d.brief.requirements.mandatory, [{ text: 'Red MYTH label', source: 'team', from: '' }, { text: 'Wordmark, never the MCA logo', source: 'approved', from: 'campaign hoof mark policy' }], 'requirements are normalised with their sources');
  const c = await req('GET', '/studio/brief/check?project=' + P); eq(c.d.ok, true, 'a campaign, an objective and a message are enough to produce');
  ok(c.d.gaps.some(g => g.code === 'mark_missing' && g.level === 'blocking' && /wordmark/.test(g.text) && /client logo is not substituted/.test(g.text)), JSON.stringify(c.d.gaps));
  ok(c.d.assumptions.some(a => /audience assumed/.test(a.text)) && c.d.assumptions.some(a => /action assumed from the campaign: handsoffourfuel.com.au/.test(a.text)), JSON.stringify(c.d.assumptions));
  eq(c.d.campaign, { id: 'hoof', name: 'Hands Off Our Fuel', policy: 'wordmark', identity: 'MYTH in red, FACT in teal, the HANDS OFF OUR FUEL wordmark', logoOnFile: true, wordmarkOnFile: false });
});

await t('first production runs through the plan engine: the creative team plans each channel at high effort with the reference pack attached, the plan is laid out by stPlanNormalise, its regions are rendered with their references at the size the team chose; a piece without a plan falls back to the house composition and says so', async () => {
  const r = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Approved HOOF tile', purpose: 'approved', note: 'current identity', imageB64: PNG, mime: 'image/png' }); R1 = r.d.id;
  eq(r.d.analysis.logo, 'Wordmark bottom left, small');
  const j = await jobRun(P, 'copy', { channels: ['instagram', 'facebook'], deliverable: 'set', size: '4K', instruction: 'One tile per channel' }); eq(j.state, 'done', j.error);
  const body = anth.calls.filter(b => /producing a coordinated set/.test(String(b.system))).pop();
  eq(body.output_config.effort, 'high'); eq(imagesOf(body), 1, 'the approved reference is attached'); ok(/THE DESIGN\. For each channel the plan is the whole composition/.test(body.system) && /"plan":\{"medium"/.test(body.system), 'the plan schema is taught');
  const user = textOf(body); ok(/CAMPAIGN IDENTITY: Hands Off Our Fuel - MYTH in red/.test(user) && /mark policy: wordmark/.test(user), 'the identity');
  ok(/REFERENCE PACK - 1 reference in the pack \(recommended\): approved 1; 1 attached as images/.test(user), user.slice(user.indexOf('REFERENCE PACK'), user.indexOf('REFERENCE PACK') + 160));
  ok(/MARK PLACEMENT OBSERVED IN THE APPROVED REFERENCES: bottom left as in 1 reference \(Approved HOOF tile\)/.test(user), 'placement learned from the approved reference');
  ok(/design requirements, mandatory: Red MYTH label \[team\]; Wordmark, never the MCA logo \[approved: campaign hoof mark policy\]/.test(user), 'the requirements reach the model with their sources');
  ok(/ASSUMPTIONS \(the brief leaves these open/.test(user), 'the assumptions are stated to the model');
  const g = await get(P); IG = g.assets.find(a => a.channel === 'instagram').id; FB = g.assets.find(a => a.channel === 'facebook').id;
  const v = cur(g, IG); eq([v.layout.v, v.layout.medium, v.context.how, v.context.size], [5, 'photo-cinematic', 'plan', '4K']); ok(v.context.planIn && v.context.planIn.medium === 'photo-cinematic', 'the plan is kept on the version for adaptation');
  eq(layerOf(v.layout, 'kicker').text, 'MYTH BUSTED'); ok(!layerOf(v.layout, 'logo'), 'the plan asked for the MCA logo: the HOOF policy overruled it');
  ok(v.layout.unsupported.some(u => /the plan asked for the mark "logo"; the Hands Off Our Fuel policy \(wordmark\) is mandatory/.test(u)), JSON.stringify(v.layout.unsupported));
  eq(v.layout.incomplete.map(i => [i.code, i.mark]), [['mark_missing', 'wordmark']], 'the wordmark is not on file: incomplete, nothing substituted'); ok(v.checks.some(c => c.state === 'mark_missing'), 'a check names it');
  const fb = cur(g, FB); eq([fb.context.how, fb.layout.v], ['house', 4]); ok(/house composition: no plan came back/.test(fb.note), fb.note); ok(!layerOf(fb.layout, 'logo'), 'the house fallback obeys the same policy');
  const renders = (await req('GET', '/studio/jobs?project=' + P)).d.jobs.filter(x => x.stage === 'render');
  eq(renders.length, 2); const ri = renders.find(x => x.asset === IG); eq([ri.input.size, ri.input.region, ri.input.referenceIds.map(x => x.id)], ['4K', 'bg', [R1]]); ok(/A wide cinematic photograph of a header harvester/.test(ri.input.prompt) && !/documentary realism, natural light/.test(ri.input.prompt), 'the region brief, not the legacy prompt');
  eq(renders.find(x => x.asset === FB).input.size, '4K');
  const ev = (await events(P, 'produced')).pop(); ok(/Planned by the creative team: instagram cinematic photography/.test(ev.text) && /house composition for facebook/.test(ev.text) && /incomplete until the campaign mark is uploaded/.test(ev.text), ev.text);
});

await t('a missing mandatory mark blocks design approval with the reason; copy approval still works; uploading the wordmark and laying out again completes the composition, placed where the approved reference shows it', async () => {
  const d = await req('POST', '/studio/approve', { asset: IG, part: 'design', decision: 'approve', reason: 'looks right' }); eq(d.status, 409); eq(d.d.error, 'incomplete'); ok(/wordmark the policy requires is not on file/.test(d.d.detail), d.d.detail);
  eq((await req('POST', '/studio/approve', { asset: IG, part: 'copy', decision: 'approve', reason: 'client ok' })).status, 200);
  const w = await req('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' }); eq(w.status, 200);
  const j = await jobRun(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const g = await get(P); const a = g.assets[g.assets.length - 1]; const v = cur(g, a.id);
  eq(v.layout.incomplete, []); const wm = layerOf(v.layout, 'wordmark'); ok(wm && /^\/brand\/wordmark\?ns=mca&campaign=hoof&v=[a-f0-9]+$/.test(wm.src) && wm.exact, 'the exact wordmark'); eq(wm.x, 5, 'bottom left, as observed'); eq(v.layout.markPlacement.basis, 'observed'); ok(!layerOf(v.layout, 'logo'), 'never the MCA logo on HOOF');
});

await t('the campaigns stay apart: a national project carries the client logo and no wordmark; an AEP project sees none of MCA\'s references, marks or facts; another campaign\'s reference is excluded from a recommended pack and named', async () => {
  const pn = await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National', brief: { objective: 'o', message: 'm', channels: ['instagram'] } });
  const rn = await req('POST', '/studio/reference', { project: pn.d.id, kind: 'image', name: 'A HOOF tile on a national project', purpose: 'approved', campaign: 'hoof', imageB64: PNG, mime: 'image/png' }); eq(rn.status, 200);
  const j = await jobRun(pn.d.id, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const user = textOf(anth.calls.filter(b => /producing a coordinated set/.test(String(b.system))).pop());
  ok(/0 references in the pack \(recommended\)/.test(user) && /EXCLUDED FROM THIS PACK: A HOOF tile on a national project \(belongs to the campaign hoof, not national\)/.test(user), user.slice(user.indexOf('REFERENCE PACK'), user.indexOf('REFERENCE PACK') + 300));
  const g = await get(pn.d.id); const v = cur(g, g.assets[0].id); ok(layerOf(v.layout, 'logo') && !layerOf(v.layout, 'wordmark'), 'national: client logo, no wordmark'); eq(v.layout.incomplete, []);
  const pa = await req('POST', '/studio/project', { ns: 'aep', campaign: 'gas', title: 'AEP', brief: { objective: 'o', message: 'm', channels: ['linkedin'] } });
  const ja = await jobRun(pa.d.id, 'copy', { channels: ['linkedin'], deliverable: 'set', render: false }); eq(ja.state, 'done', ja.error);
  const b = anth.calls.filter(x => /producing a coordinated set/.test(String(x.system))).pop(); const ua = textOf(b);
  ok(!/HOOF|Hands Off Our Fuel|150,000|Approved HOOF tile/.test(ua + b.system), 'nothing of MCA reaches AEP'); eq(imagesOf(b), 0);
  const ga = await get(pa.d.id); const va = cur(ga, ga.assets[0].id); ok(!layerOf(va.layout, 'wordmark') && !(layerOf(va.layout, 'logo') || {}).src, 'AEP has no logo on file and gets no other client\'s mark');
});

await t('the identity audit reports exactly what is on file per campaign: policy, logo and wordmark in R2, references by purpose, observed placement, recorded preferences, gaps', async () => {
  const a = await req('GET', '/studio/identity?ns=mca', null, 'read-key'); eq(a.status, 200);
  const h = a.d.campaigns.find(c => c.id === 'hoof'), n = a.d.campaigns.find(c => c.id === 'national');
  eq([h.policy, h.wordmark.onFile, h.logo.onFile], ['wordmark', true, true]); eq(h.references.byPurpose, { approved: 2 }, 'the HOOF tile filed on the national project counts for HOOF'); eq(h.placement.basis, 'observed'); ok(/bottom left/.test(h.placement.text));
  eq(n.policy, 'logo'); ok(n.gaps.some(g => /no identity note/.test(g)) && n.gaps.some(g => /not observed in any approved reference/.test(g)), JSON.stringify(n.gaps));
  eq(a.d.kit.logo.onFile, true); ok(/Every count is what the kit, R2/.test(a.d.note));
  eq((await req('GET', '/studio/identity')).status, 400);
});

await t('brief suggestions come with their source: approved kit records first, previous briefs, references, recorded preferences; a model is asked only on request, by a full key, and its answers are marked ai', async () => {
  await req('POST', '/engine/fix', { ns: 'mca', task: 'tiles', scope: 'client', wrong: 'haul trucks', right: 'No haul trucks on HOOF tiles', why: 'the campaign is about small business' });
  const s = await req('GET', '/studio/brief/suggest?project=' + P, null, 'read-key'); eq(s.status, 200);
  ok(s.d.fields.action.some(x => x.text === 'handsoffourfuel.com.au' && x.source === 'approved'), JSON.stringify(s.d.fields.action));
  ok(s.d.fields.audience.some(x => x.text === 'Regional voters and farmers' && x.source === 'approved'), 'kit segment');
  ok(s.d.fields.requirements.some(x => x.source === 'approved' && x.band === 'mandatory' && /wordmark, never the client logo/.test(x.text)), 'mark policy as a mandatory requirement');
  ok(s.d.fields.requirements.some(x => x.source === 'reference' && /Approved design: Approved HOOF tile/.test(x.text)), 'the approved reference');
  ok(s.d.fields.requirements.some(x => x.source === 'preference' && /haul trucks/i.test(x.text)), 'the learned correction');
  ok(s.d.fields.objective.some(x => x.source === 'previous' && /Empty|National/.test(x.from) === false || x.source === 'previous'), 'a previous brief');
  eq(s.d.sources.ai, 0, 'no model call unless asked');
  eq((await req('GET', '/studio/brief/suggest?project=' + P + '&ai=1', null, 'read-key')).status, 403);
  const ai = await req('GET', '/studio/brief/suggest?project=' + P + '&ai=1'); ok(ai.d.fields.objective.some(x => x.source === 'ai' && /never meant to apply/.test(x.text)), JSON.stringify(ai.d.fields.objective));
  ok(/ai = a model's suggestion, requested, not a requirement/.test(ai.d.note));
});

let BASE = '';
await t('explore: two concepts that would look alike are sent back once with the measure; the replacement differs; the event says one round was spent', async () => {
  const g = await get(P); BASE = g.assets.find(a => a.channel === 'instagram').id;
  r2.set('studio/x/y/base.png', { v: png(2), o: { httpMetadata: { contentType: 'image/png' } } });
  await req('POST', '/studio/version', { asset: BASE, image: { key: 'studio/x/y/base.png', url: '/studio/file?key=studio%2Fx%2Fy%2Fbase.png', model: 'gemini-3-pro-image', size: '2K' }, kind: 'render', note: 'a base image' });
  conceptMode = 'lookalike'; const n0 = anth.calls.length;
  const j = await jobRun(P, 'concepts', { asset: BASE, mode: 'explore', feedback: 'Give me variations' }, BASE); eq(j.state, 'done', j.error);
  const calls = anth.calls.slice(n0).filter(b => /briefing/.test(String(b.system))); eq(calls.length, 2, 'one replanning round');
  ok(/REPLAN\. Of the concepts you proposed, these would look alike on the stage/.test(textOf(calls[1])) && /"Dawn paddock" resembles "Dusk paddock"/.test(textOf(calls[1])), textOf(calls[1]).slice(-400));
  const ev = (await events(P, 'concepts')).pop(); eq(ev.replanned, 1); eq(ev.options.map(o => o.name), ['Dusk paddock', 'Split field', 'Typography leads']); ok(!ev.options.some(o => o.similar), 'all distinct now'); eq(j.result.distinct, 3);
  ok(/1 look-alike concept was replanned once/.test(ev.text) && /two calls/.test(ev.text), ev.text);
  eq(ev.refPack.mode, 'recommended'); eq(ev.refPack.attached, [R1]);
});

await t('retain controls hold in planning and in application: kept imagery stays behind the plan whatever the model wrote, kept copy is never rewritten, and applying the card keeps the image', async () => {
  conceptMode = 'retain';
  const j = await jobRun(P, 'concepts', { asset: BASE, mode: 'new', instruction: 'A new design', keep: { imagery: true, copy: true, composition: false }, refMode: 'none' }, BASE); eq(j.state, 'done', j.error);
  const body = anth.calls.filter(b => /briefing/.test(String(b.system))).pop(); eq(imagesOf(body), 1, 'the current artwork only: references none by choice'); ok(/no references by the team's choice/.test(textOf(body)), 'pack mode none');
  const ev = (await events(P, 'concepts')).pop(); const o = ev.options[0];
  eq(o.layout.regions.find(r => r.role === 'background').prompt, 'keep the current image'); eq(o.kept, ['imagery']); eq(o.copy, {}, 'the headline the model offered is not taken'); eq(o.renders, 0); eq(ev.refPack.mode, 'none');
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: ev.eid, index: 0, render: true }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.jobs.length, 0, 'nothing to render: the image is kept');
  const g = await get(P); const v = cur(g, r.d.asset); eq(v.image.key, 'studio/x/y/base.png'); ok(v.copy.headline !== 'A different headline the team did not ask for', 'copy kept');
});

await t('the size chosen on Generate reaches the render; two regions rendered from the same version merge into the current version instead of branching; a cutout is checked for transparency; the production record names model, size, references, time and usage', async () => {
  conceptMode = 'regions';
  const j = await jobRun(P, 'concepts', { asset: BASE, mode: 'explore', feedback: 'cutouts' }, BASE); eq(j.state, 'done', j.error);
  const ev = (await events(P, 'concepts')).pop();
  const r = await req('POST', '/studio/concept/apply', { project: P, eid: ev.eid, index: 0, render: true, size: '4K' }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.jobs.length, 2);
  const jobs = await Promise.all(r.d.jobs.map(async id => (await req('GET', '/studio/job?id=' + id)).d.job)); eq(jobs.map(x => x.input.size), ['4K', '4K'], 'the size is forwarded'); eq(jobs[0].inputVersion, jobs[1].inputVersion, 'both asked for the same version');
  gem.queue.push([{ inlineData: { mimeType: 'image/png', data: png(6, 1).toString('base64') } }]);
  gem.queue.push([{ inlineData: { mimeType: 'image/png', data: png(2, 2).toString('base64') } }]);
  const d1 = await run(jobs[0]); eq(d1.state, 'done', d1.error); const d2 = await run(jobs[1]); eq(d2.state, 'done', d2.error);
  eq([d1.result.branch, d2.result.branch], [false, false], 'neither is a branch'); eq([d1.result.alpha, d2.result.alpha], [true, false]);
  const g = await get(P); const a = g.assets.find(x => x.id === BASE); const v = cur(g, BASE);
  const c1 = v.layout.layers.find(l => l.region === 'c1'), c2 = v.layout.layers.find(l => l.region === 'c2'); ok(c1.src && c2.src, 'both regions landed on the current version: ' + JSON.stringify([c1.src, c2.src]));
  eq(Object.keys(v.context.regions).sort(), ['c1', 'c2']); eq([v.context.regions.c1.alpha, v.context.regions.c2.alpha], [true, false]); eq(c2.opaque, true); ok(/came back opaque/.test(v.note), v.note);
  eq(v.image.key, 'studio/x/y/base.png', 'the background is untouched');
  ok(a.versions.every(x => x.id === a.current || !x.parent || a.versions.some(y => y.id === x.parent)), 'a single line of versions');
  const lastJob = (await events(P, 'job')).filter(e => e.render).pop(); ok(/region c2 - opaque, no transparency/.test(lastJob.text), lastJob.text);
});

await t('the final image is never a thought image; the record keeps usage and time; an edit replays the conversation only to the model that made it - a fallback model gets the current image attached instead', async () => {
  const A = BASE; const thought = png(6, 7).toString('base64'), final = png(6, 9).toString('base64');
  gem.queue.push([{ text: 'thinking', thought: true }, { inlineData: { mimeType: 'image/png', data: thought }, thought: true }, { inlineData: { mimeType: 'image/png', data: final }, thoughtSignature: 'sx' }]);
  const j = await jobRun(P, 'render', { prompt: 'A full background', aspect: '4:5', size: '2K' }, A); eq(j.state, 'done', j.error);
  const v = cur(await get(P), A); eq(Buffer.from(r2.get(v.image.key).v)[50], 9, 'the final image, not the thought image'); eq(v.image.meta.usage, { prompt: 100, output: 1290, total: 1390 }); ok(v.image.meta.ms >= 0); eq(v.image.meta.model, 'gemini-3-pro-image');
  ok(/-conv\.json$/.test(v.image.conv)); eq(JSON.parse(r2.get(v.image.conv).v).model, 'gemini-3-pro-image');
  // the edit: the primary model refuses, the fallback answers - it must not receive the other model's turns and signatures
  gem.fail404Once = true; const g0 = gem.calls.length;
  const e = await jobRun(P, 'render', { prompt: 'Darken the sky', edit: true, aspect: '4:5', size: '2K' }, A); eq(e.state, 'done', e.error);
  const fbCall = gem.calls.slice(g0).find(c => c.model === 'gemini-3.1-flash-image'); eq(fbCall.body.contents.length, 1, 'no history to another model'); ok(fbCall.body.contents[0].parts.some(p => p.inline_data), 'the current image is attached'); ok(/first attached image is the current image to edit/.test(fbCall.body.contents[0].parts[0].text));
  const first = gem.calls.slice(g0).find(c => c.model === 'gemini-3-pro-image'); eq(first.body.contents.length, 3, 'the model that made it would have had the conversation');
  const v2 = cur(await get(P), A); eq([v2.image.fallback, v2.image.meta.historyReplayed], [true, false]); ok(/the edit history belonged to gemini-3-pro-image and was not replayed/.test(v2.note), v2.note);
});

await t('the inspection reads the composed export when one is saved - with the whole text inventory, free text included - and says so; without one it is imagery only; a ship verdict never approves; a correction aimed at an earlier version is refused unless forced', async () => {
  const g0 = await get(P); IG = g0.assets.filter(x => { const xv = cur(g0, x.id); return xv && xv.layout && layerOf(xv.layout, 'kicker') && layerOf(xv.layout, 'wordmark'); }).pop().id;
  await req('POST', '/studio/version', { asset: IG, image: { key: 'studio/x/y/base.png', url: '/studio/file?key=studio%2Fx%2Fy%2Fbase.png', model: 'gemini-3-pro-image', size: '2K' }, kind: 'render', note: 'image' });
  const vv = cur(await get(P), IG);
  const s = await req('POST', '/studio/render/save', { asset: IG, version: vv.id, imageB64: png(6, 5).toString('base64'), mime: 'image/png' }); eq(s.status, 200);
  inspectVerdict = 'fix';
  const j = await jobRun(P, 'inspect', { version: vv.id }, IG); eq(j.state, 'done', j.error); eq(j.result.composed, true);
  const body = anth.calls.filter(b => /inspecting a rendered social tile/.test(String(b.system))).pop(); const user = textOf(body);
  ok(/You see the COMPOSED TILE exactly as it will be exported/.test(user), 'composed'); ok(/kicker "MYTH BUSTED"/.test(user) && /headline "Fuel tax credits are not a subsidy"/.test(user), 'the whole inventory: ' + user.slice(0, 500));
  ok(/MARKS THAT SHOULD APPEAR: the campaign wordmark \(exact file\)/.test(user) && /The client logo must not appear on this campaign/.test(user), 'the marks it should see');
  const ins = (await events(P, 'inspection')).pop(); eq([ins.composed, ins.imageryOnly], [true, false]); ok(/the composed export/.test(ins.text));
  // the asset moves on: the correction is now stale
  await req('POST', '/studio/version', { asset: IG, copy: { support: 'A tax that never applied.' }, note: 'text' });
  const st = await req('POST', '/studio/inspection/apply', { project: P, eid: ins.eid }); eq(st.status, 409); eq(st.d.error, 'stale'); ok(/judged version/.test(st.d.detail));
  const fo = await req('POST', '/studio/inspection/apply', { project: P, eid: ins.eid, force: true }); eq(fo.status, 200, JSON.stringify(fo.d));
  // imagery only when nothing composed is on file, and a ship verdict is not an approval
  inspectVerdict = 'ship'; const v3 = cur(await get(P), IG);
  const j2 = await jobRun(P, 'inspect', { version: v3.id }, IG); eq(j2.state, 'done', j2.error); eq(j2.result.composed, false);
  const ins2 = (await events(P, 'inspection')).pop(); eq(ins2.imageryOnly, true); ok(/imagery only - no composed export saved yet/.test(ins2.text) && /not an approval/.test(ins2.text), ins2.text);
  const ap = (await get(P)).assets.find(x => x.id === IG).approvals; ok(!ap.design, 'no design approval came from the verdict');
});

await t('a reference over the models\' limit keeps its original and is shown to the models through a prepared copy; without one it is named as unavailable', async () => {
  const big = Buffer.alloc(4600000, 1); Buffer.from('89504e470d0a1a0a', 'hex').copy(big, 0);
  const r = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Huge approved tile', purpose: 'approved', imageB64: big.toString('base64'), mime: 'image/png', prepB64: png(6, 3).toString('base64'), prepMime: 'image/jpeg' }); eq(r.status, 200, JSON.stringify(r.d));
  eq([r.d.prepared, r.d.overLimit], [true, true]); ok(r2.get(r.d.key).v.byteLength === 4600000, 'the original is kept exactly'); ok(!r.d.analysis.error, 'analysed through the prepared copy: ' + JSON.stringify(r.d.analysis));
  const r0 = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Huge, no copy', purpose: 'composition', imageB64: big.toString('base64'), mime: 'image/png' }); RX = r0.d.id; ok(/over 4.5 MB/.test(r0.d.note), r0.d.note);
  conceptMode = 'other';
  const j = await jobRun(P, 'concepts', { asset: BASE, mode: 'explore', feedback: 'x', refMode: 'chosen', refs: [r.d.id, RX] }, BASE); eq(j.state, 'done', j.error);
  const ev = (await events(P, 'concepts')).pop(); eq(ev.refPack.mode, 'chosen'); ok(ev.refPack.attached.indexOf(r.d.id) >= 0, 'the prepared copy is attached'); ok(ev.refPack.unavailable.some(x => x.id === RX && /over 4.5 MB with no prepared copy/.test(x.why)), JSON.stringify(ev.refPack.unavailable));
  ok(ev.refPack.excluded.some(x => x.id === R1 && /not among the references the team chose/.test(x.why)), 'the others are excluded and named');
  const g = await get(P); const ref = g.references.find(x => x.id === r.d.id); ok(ref.prepKey && ref.prepUrl && ref.campaign === 'hoof', JSON.stringify(ref));
});

await t('adaptation recomposes: an asset made from a plan is re-planned for the new format from its own plan, not reduced to the house panel', async () => {
  const g = await get(P); const src = g.assets.find(a => { const v = cur(g, a.id); return v && v.context && v.context.planIn && v.layout.v === 5 && layerOf(v.layout, 'kicker'); });
  ok(src, 'a plan-built asset');
  // the revise stub answers adapt only through its own call; drive it directly
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url).indexOf('api.anthropic.com/v1/messages') >= 0 && /decide what the instruction asks/.test(String(JSON.parse(init.body).system || ''))) return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ kind: 'adapt', reply: 'Adapted.', adapt: { from: src.id, pieces: [{ channel: 'x', format: '16:9', copy: { caption: 'For X' } }] }, memory: { standing: false } }) }], stop_reason: 'end_turn' }), { status: 200 }); return orig(url, init); };
  const j = await jobRun(P, 'revise', { target: 'asset', asset: src.id, instruction: 'adapt this for X' }); globalThis.fetch = orig; eq(j.state, 'done', j.error);
  const g2 = await get(P); const ad = g2.assets[g2.assets.length - 1]; const v = cur(g2, ad.id);
  eq([ad.format, v.layout.v, v.layout.stage.w], ['16:9', 5, 1920]); ok(/plan re-composed for 16:9/.test(v.note), v.note); eq(v.context.master, src.id); eq(layerOf(v.layout, 'kicker').text, 'MYTH BUSTED', 'the plan\'s own elements carry across');
});

await t('a read key can check the brief, read the sourced suggestions and the identity audit, but not produce, upload references or apply corrections', async () => {
  eq((await req('GET', '/studio/brief/check?project=' + P, null, 'read-key')).status, 200);
  eq((await req('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['x'] } }, 'read-key')).status, 403);
  eq((await req('POST', '/studio/reference', { project: P, name: 'x', imageB64: PNG }, 'read-key')).status, 403);
  eq((await req('POST', '/studio/inspection/apply', { project: P, eid: 'e1' }, 'read-key')).status, 403);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
