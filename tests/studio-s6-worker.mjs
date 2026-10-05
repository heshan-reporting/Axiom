/* Creative Studio S6, client knowledge: what the Studio holds for a client, what it is missing, what it holds but
 * never reaches the models, and the recommendations that follow (GET /brand/inventory); mark placement as structured,
 * per-reference evidence with confidence, exceptions and the rule layer above it (stPlacementEvidence replaces corner
 * voting; stMarkPlacement keeps its shape); the reference analysis asks the vision pass for the mark as data; "Teach
 * this brand" (GET /brand/teach/inspect proposes from evidence and gaps, POST /brand/teach previews and, on confirm,
 * writes a versioned rule the production path then holds: a mark layer carries the rule and /studio/version refuses to
 * move it); namespaces stay walls.
 * Run: node --experimental-sqlite tests/studio-s6-worker.mjs */
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
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const png = fill => { const b = Buffer.alloc(160, fill || 0); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b[24] = 8; b[25] = 6; return b.toString('base64'); };
const anth = { calls: [], refMark: { present: true, kind: 'wordmark', corner: 'bl', size: 'about a fifth of the width', clearSpace: 'a margin the height of the mark' } };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png(9) } }] } }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body); const sys = String(body.system || '');
    const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    let text = '{}';
    if (/producing a coordinated set/.test(sys)) text = JSON.stringify({ pieces: ['instagram', 'facebook'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'Not a subsidy.', alt: 'tile', visual: 'a farmer at a tank', claims: [] })) });
    else if (/describing one reference image/.test(sys)) text = JSON.stringify({ summary: 'A teal tile with a red MYTH band and the wordmark low on the left.', typography: 'heavy grotesque caps', colour: { palette: ['#0E6A6E', '#C8102E'], relationships: 'teal ground, red accent, white type' }, hierarchy: 'MYTH first, then the fact', composition: 'band at the top, words centre, mark bottom left', imageTreatment: 'none', panels: 'full-width bands', spacing: 'tight', logo: 'the Hands Off Our Fuel wordmark sits bottom left, about a fifth of the width', text: ['MYTH', 'Fuel tax credits are a subsidy'], takeaways: ['bands carry the argument'], mark: anth.refMark });
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
const ws = async (ns, campaign, key) => (await req('GET', '/brand/workspace?ns=' + ns + (campaign ? '&campaign=' + campaign : ''), null, key || 'read-key')).d;
const inv = async (ns, campaign, key) => (await req('GET', '/brand/inventory?ns=' + ns + (campaign ? '&campaign=' + campaign : ''), null, key || 'read-key')).d;
const codes = list => (list || []).map(x => x.code);
const setAnalysis = (id, an) => env.MIND_DB.db.prepare('UPDATE studio_references SET analysis=? WHERE id=?').run(JSON.stringify(an), id);

console.log('studio-s6-worker harness (client knowledge: inventory and gaps, structured placement evidence, Teach this brand, the rule held in production)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, voice: 'Plain, confident, never shrill.', rules: 'Label the answer Fact, never Busted.',
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', identity: 'MYTH in red, FACT in teal', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }],
  facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'Mining employs 290,000 Australians', source: 'ABS', status: 'approved', campaign: 'national' }, { text: 'Farmers claimed 1.2 billion litres', source: 'draft', status: 'pending', campaign: 'hoof' }],
  banned: [{ term: 'subsidy', use: 'tax credit', why: 'it concedes the framing', allowNegated: true }] });
await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(11), logoMime: 'image/png' });
await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: png(2), wordmarkMime: 'image/png' });
await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'black', wordmarkTone: 'dark', wordmarkB64: png(3), wordmarkMime: 'image/png' });
await req('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', campaigns: [{ id: 'gas', name: 'Gas' }], facts: [{ text: 'Gas supplies 27 per cent of energy', source: 'AEMO', status: 'approved' }] });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF refs' })).d.id;
const R1 = (await req('POST', '/studio/reference', { project: P, name: 'Approved HOOF myth tile', purpose: 'approved', imageB64: png(6), mime: 'image/png', campaign: 'hoof' })).d.id;
const R2 = (await req('POST', '/studio/reference', { project: P, name: 'Older HOOF poster', purpose: 'approved', imageB64: png(7), mime: 'image/png', campaign: 'hoof' })).d.id;
const R3 = (await req('POST', '/studio/reference', { project: P, name: 'Rural mood board', purpose: 'mood', imageB64: png(8), mime: 'image/png', campaign: 'hoof' })).d.id;
const PN = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National refs' })).d.id;
const RN = (await req('POST', '/studio/reference', { project: PN, name: 'National brand sheet', purpose: 'brand', imageB64: png(5), mime: 'image/png', campaign: 'national' })).d.id;
setAnalysis(RN, { summary: 'A brand sheet: palette and type, no mark placed.', logo: 'none', mark: { present: false, kind: 'none', corner: 'none' }, text: [], takeaways: [], at: 1 });   // references are analysed at upload; the mock answered the HOOF tile for every one
await req('GET', '/brand/workspace?ns=mca', null, 'read-key');   // creates the engine and brand tables
env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f-off','mca','tiles','client','','','','Never crop the wordmark','','studio:x:campaign:hoof','Dee',1,0,0)").run();
env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f-on','mca','copy','client','','','','Say fuel tax credit, never rebate','','content:y','Tania',2,1,0)").run();
env.MIND_DB.db.prepare("INSERT INTO engine_art(id,ns,title,key,mime,description,meta,docId,who,created) VALUES('art1','mca','Old tile','art/mca/art1','image/png','[not yet described] Old tile (hoof). Describer: quota','{\"campaign\":\"hoof\"}','','Dee',1)").run();
env.MIND_DB.db.prepare("INSERT INTO engine_art(id,ns,title,key,mime,description,meta,docId,who,created) VALUES('art2','mca','Described tile','art/mca/art2','image/png','A teal tile with a red MYTH band.','{\"campaign\":\"hoof\"}','','Dee',2)").run();

await t('the reference analysis asks the vision pass for the mark as data and stores it sanitised: kind, corner, size, clear space; an invalid corner is dropped, the prose stays', async () => {
  const a = (await req('POST', '/studio/reference/analyse', { id: R1 })).d; eq(a.ok, true, JSON.stringify(a));
  ok(/"mark":\{/.test(anth.calls[anth.calls.length - 1].system), 'the system prompt asks for a mark object');
  eq(a.analysis.mark, { present: true, kind: 'wordmark', corner: 'bl', size: 'about a fifth of the width', clearSpace: 'a margin the height of the mark' });
  anth.refMark = { present: true, kind: 'sticker', corner: 'somewhere', size: '' };
  const b = (await req('POST', '/studio/reference/analyse', { id: R3 })).d; eq(b.analysis.mark, { present: true, kind: 'unsure', corner: 'none' }, JSON.stringify(b.analysis.mark)); ok(/bottom left/.test(b.analysis.logo));
  anth.refMark = { present: true, kind: 'wordmark', corner: 'bl', size: 'about a fifth of the width', clearSpace: 'a margin the height of the mark' };
});

await t('placement is evidence, not a vote: each approved or brand reference contributes a corner with a basis (structured, text) and a confidence; the result names the agreement, the exceptions and keeps the old shape; the mood board counts for nothing', async () => {
  setAnalysis(R2, { summary: 'An older poster.', logo: 'The wordmark sits top right, small.', text: [], takeaways: [], at: 1 });
  setAnalysis(R3, { summary: 'A mood board.', logo: 'A logo bottom right.', mark: { present: true, kind: 'logo', corner: 'br' }, at: 1 });
  const h = await ws('mca', 'hoof'); const pl = h.placement;
  eq([pl.basis, pl.corner], ['observed', 'bl'], JSON.stringify(pl));
  eq(pl.evidence.map(e => [e.ref, e.corner, e.basis]).sort(), [[R1, 'bl', 'structured'], [R2, 'tr', 'text']].sort(), 'two approved references, no mood board: ' + JSON.stringify(pl.evidence));
  const e1 = pl.evidence.find(e => e.ref === R1), e2 = pl.evidence.find(e => e.ref === R2);
  ok(e1.confidence > e2.confidence && e1.confidence >= 0.8 && e2.confidence <= 0.6, 'a structured reading is trusted more than a prose mention: ' + e1.confidence + ' vs ' + e2.confidence);
  ok(e1.kind === 'wordmark' && e1.url && e1.approval === 'approved' && e1.name === 'Approved HOOF myth tile', JSON.stringify(e1));
  eq(pl.exceptions.map(e => e.ref), [R2], 'the poster disagrees and is named'); ok(pl.confidence > 0.5 && pl.confidence < 1, 'agreement under one: ' + pl.confidence);
  ok(/bottom left/.test(pl.text) && /top right/.test(pl.text), pl.text); ok(!pl.mandatory, 'no rule yet');
  ok(codes(h.readiness.gaps).includes('placement_contested') && !codes(h.readiness.gaps).includes('placement_unobserved'), JSON.stringify(h.readiness.gaps));
  const n = await ws('mca', 'national'); eq(n.placement.basis, 'default', 'the national campaign has no placement evidence of its own: ' + JSON.stringify(n.placement.evidence));
  eq(n.placement.evidence, []);
  const audit = (await req('GET', '/studio/identity?ns=mca', null, 'read-key')).d.campaigns.find(c => c.id === 'hoof'); eq(audit.placement.corner, 'bl'); eq(audit.placement.evidence.length, 2);
});

await t('the inventory: what is usable, what is missing, what is not analysed, what conflicts, and what is stored but never reaches the models (a pending fact, another campaign\'s fact and reference, a switched-off correction, an undescribed artwork) - each with the recommendation that follows', async () => {
  const i = await inv('mca', 'hoof'); eq(i.ok, true, JSON.stringify(i)); eq([i.ns, i.campaign.id], ['mca', 'hoof']);
  const by = {}; i.usable.forEach(u => { by[u.kind] = u; });
  ok(by.marks && by.marks.n === 2 && /white|black/.test(by.marks.text), 'two wordmark variants usable: ' + JSON.stringify(by.marks));
  ok(by.facts && by.facts.n === 1, 'one approved HOOF fact: ' + JSON.stringify(by.facts));
  ok(by.references && by.references.n === 3 && by.references.analysed === 3, JSON.stringify(by.references));
  ok(by.corrections && by.corrections.n === 1, 'one correction in force (the client-wide copy rule): ' + JSON.stringify(by.corrections));
  ok(by.artwork && by.artwork.n === 1, 'one described artwork: ' + JSON.stringify(by.artwork));
  const nr = {}; i.notRetrieved.forEach(x => { nr[x.code] = x; });
  ok(nr.fact_pending && nr.fact_pending.n === 1 && /1.2 billion/.test(nr.fact_pending.items[0].text), JSON.stringify(nr.fact_pending));
  ok(nr.facts_other_campaign && nr.facts_other_campaign.n === 1, JSON.stringify(nr.facts_other_campaign));
  ok(nr.references_other_campaign && nr.references_other_campaign.n === 1 && nr.references_other_campaign.items[0].name === 'National brand sheet', JSON.stringify(nr.references_other_campaign));
  ok(nr.corrections_off && nr.corrections_off.n === 1 && /crop/.test(nr.corrections_off.items[0].text), JSON.stringify(nr.corrections_off));
  ok(nr.artwork_undescribed && nr.artwork_undescribed.n === 1 && nr.artwork_undescribed.items[0].id === 'art1', JSON.stringify(nr.artwork_undescribed));
  ok(Array.isArray(i.unanalysed) && i.unanalysed.length === 0, 'everything analysed here: ' + JSON.stringify(i.unanalysed));
  ok(i.missing.length && codes(i.missing).includes('no_approved_facts') === false, 'HOOF has a fact; missing is the readiness list: ' + JSON.stringify(codes(i.missing)));
  const rec = codes(i.recommendations);
  ok(rec.includes('teach_placement') && rec.includes('review_fact') && rec.includes('describe_artwork'), JSON.stringify(rec));
  const tp = i.recommendations.find(r => r.code === 'teach_placement'); ok(tp.action && tp.action.route === '/brand/teach' && tp.action.body.kind === 'placement' && tp.action.body.proposal.corner === 'bl', JSON.stringify(tp));
  const da = i.recommendations.find(r => r.code === 'describe_artwork'); ok(da.action && da.action.route === '/engine/artwork/describe' && da.action.body.ns === 'mca', JSON.stringify(da));
  ok(i.examples && i.examples.some(x => x.purpose === 'typography') && i.examples.some(x => x.purpose === 'imagery') && !i.examples.some(x => x.purpose === 'approved'), 'curated examples still wanted: ' + JSON.stringify(i.examples));
  ok(i.counts && typeof i.counts.usable === 'number' && typeof i.counts.notRetrieved === 'number' && i.counts.notRetrieved === 5, JSON.stringify(i.counts));
  // the whole-client view has nothing excluded by campaign but still names the pending fact and the undescribed artwork
  const c = await inv('mca', ''); ok(!c.notRetrieved.some(x => /other_campaign/.test(x.code)) && c.notRetrieved.some(x => x.code === 'fact_pending'), JSON.stringify(codes(c.notRetrieved)));
  eq((await req('GET', '/brand/inventory?ns=mca&campaign=gas', null, 'read-key')).status, 404, 'a campaign of another client is unknown');
  const a = await inv('aep', ''); ok(!a.usable.some(u => /hoof|fuel|mining/i.test(u.text)) && a.notRetrieved.every(x => !x.items.some(it => /fuel|hoof|National/i.test(it.text || it.name || ''))), 'aep sees none of mca');
});

await t('Teach this brand, inspect: proposals come from the evidence and the gaps - a placement rule with its corner, confidence and the references behind it, and the pending fact to review - nothing is written by looking', async () => {
  const before = JSON.stringify(await req('GET', '/brand/kit?ns=mca'));
  const d = (await req('GET', '/brand/teach/inspect?ns=mca&campaign=hoof', null, 'read-key')).d; eq(d.ok, true, JSON.stringify(d));
  const pl = d.proposals.find(x => x.kind === 'placement'); ok(pl, JSON.stringify(d.proposals.map(x => x.kind)));
  eq([pl.proposal.corner, pl.proposal.mandatory], ['bl', true]); ok(pl.confidence > 0.5 && pl.evidence.length === 2 && pl.exceptions.length === 1, JSON.stringify(pl));
  ok(/Approved HOOF myth tile/.test(pl.why) && /Older HOOF poster/.test(pl.why), pl.why);
  const f = d.proposals.find(x => x.kind === 'fact'); ok(f && /1.2 billion/.test(f.proposal.text) && f.proposal.id, JSON.stringify(f));
  eq(JSON.stringify(await req('GET', '/brand/kit?ns=mca')), before, 'inspecting writes nothing');
  const n = (await req('GET', '/brand/teach/inspect?ns=mca&campaign=national', null, 'read-key')).d; ok(!n.proposals.some(x => x.kind === 'placement'), 'no evidence, no placement proposal: ' + JSON.stringify(n.proposals));
});

let ITEM = '';
await t('Teach this brand, confirm a placement rule: a preview writes nothing; the confirmation needs a reason and a full key, writes the campaign rule into the kit as a revision, files an approved-rule item with the evidence, and the workspace, readiness and identity audit now say "rule"', async () => {
  const kitBefore = JSON.stringify((await req('GET', '/brand/kit?ns=mca')).d.kit);
  const pv = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile' } })).d;
  eq(pv.ok, true, JSON.stringify(pv)); eq(pv.written, false); ok(pv.preview && pv.preview.rule.corner === 'bl' && /bottom left/.test(pv.preview.text) && pv.preview.evidence.length === 2, JSON.stringify(pv.preview));
  ok(pv.preview.affects && typeof pv.preview.affects.assets === 'number', 'the preview counts the compositions the rule will hold: ' + JSON.stringify(pv.preview.affects));
  eq(JSON.stringify((await req('GET', '/brand/kit?ns=mca')).d.kit), kitBefore, 'a preview writes nothing');
  eq((await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true }, confirm: true })).d.error, 'reason_required');
  eq((await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true }, confirm: true, reason: 'x' }, 'read-key')).status, 403);
  eq((await req('POST', '/brand/teach', { ns: 'mca', campaign: 'gas', kind: 'placement', proposal: { corner: 'bl' }, confirm: true, reason: 'Dee confirmed it' })).d.error, 'unknown_campaign');
  eq((await req('POST', '/brand/teach', { ns: 'mca', kind: 'placement', proposal: { corner: 'bl' }, confirm: true, reason: 'Dee confirmed it' })).d.error, 'campaign_required', 'a placement rule is a campaign rule');
  const w = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile' }, confirm: true, reason: 'Dee confirmed the approved tiles' })).d;
  eq(w.ok, true, JSON.stringify(w)); eq(w.written, true); ok(w.item && w.item.kind === 'placement' && w.item.authority === 'rule' && w.item.status === 'active' && w.item.campaign === 'hoof', JSON.stringify(w.item)); ITEM = w.item.id;
  ok(w.item.data && w.item.data.corner === 'bl' && w.item.data.evidence.length === 2 && /Dee confirmed/.test(w.item.source.label), JSON.stringify(w.item.data));
  const kit = (await req('GET', '/brand/kit?ns=mca')).d.kit; eq(kit.campaigns.find(c => c.id === 'hoof').markRule, { corner: 'bl', mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile' });
  ok(kit.campaigns.find(c => c.id === 'hoof').wordmarks.length === 2, 'the wordmark library survives the save');
  const revs = (await req('GET', '/brand/revisions?ns=mca', null, 'read-key')).d.revisions; ok(revs[0].summary.some(s => /hoof mark placement rule/.test(s)), JSON.stringify(revs[0].summary));
  const h = await ws('mca', 'hoof'); eq([h.placement.basis, h.placement.corner, h.placement.mandatory], ['rule', 'bl', true]); ok(/rule/.test(h.placement.text) && h.placement.evidence.length === 2, JSON.stringify(h.placement));
  ok(!codes(h.readiness.gaps).some(c => /^placement_/.test(c)), JSON.stringify(h.readiness.gaps));
  ok(h.items.some(i => i.id === ITEM && i.kind === 'placement'), 'the item is in the workspace');
  const audit = (await req('GET', '/studio/identity?ns=mca', null, 'read-key')).d.campaigns.find(c => c.id === 'hoof'); eq(audit.placement.basis, 'rule'); ok(!audit.gaps.some(g => /placement/.test(g)), JSON.stringify(audit.gaps));
  const i = await inv('mca', 'hoof'); ok(!codes(i.recommendations).includes('teach_placement'), 'the recommendation is gone once the rule stands');
  eq((await req('GET', '/brand/teach/inspect?ns=mca&campaign=hoof', null, 'read-key')).d.proposals.some(x => x.kind === 'placement'), false, 'no placement proposal while a rule stands');
});

await t('the taught rule holds in production: a composition made for HOOF carries the wordmark bottom left with the rule on the layer, /studio/version refuses to move it (mark_held) and records a deliberate override; the national campaign is untouched', async () => {
  const PP = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Held', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'] } })).d.id;
  const j = await run((await req('POST', '/studio/job', { project: PP, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', acknowledge: true }, idem: 'held-1' })).d.job); eq(j.state, 'done', j.error);
  const g = (await req('GET', '/studio/get?id=' + PP)).d; const a = g.assets[0]; const v = a.versions.find(x => x.id === a.current);
  const wm = (v.layout.layers || []).find(l => l.role === 'wordmark'); ok(wm, 'a wordmark layer: ' + JSON.stringify((v.layout.layers || []).map(l => l.role)));
  ok(!(v.layout.layers || []).some(l => l.role === 'logo'), 'never the MCA logo on HOOF');
  eq(wm.rule, { mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile', basis: 'rule', corner: 'bl' }, 'the rule rides on the layer, with its provenance (a taught rule, not an observation)');
  ok(wm.x < 20 && wm.y > 60, 'bottom left: ' + JSON.stringify({ x: wm.x, y: wm.y }));
  ok(v.layout.markPlacement && v.layout.markPlacement.basis === 'rule', 'the layout says why: ' + JSON.stringify(v.layout.markPlacement));
  const moved = JSON.parse(JSON.stringify(v.layout)); moved.layers.find(l => l.role === 'wordmark').x = 70;
  const r = await req('POST', '/studio/version', { asset: a.id, copy: v.copy, layout: moved, note: 'move the mark' }); eq(r.status, 409, JSON.stringify(r.d)); eq(r.d.error, 'mark_held'); ok(/bl/.test(r.d.detail) && /bottom left|every HOOF tile/.test(r.d.detail), r.d.detail);
  const r2 = await req('POST', '/studio/version', { asset: a.id, copy: v.copy, layout: moved, note: 'move the mark', unlock: true }); eq(r2.status, 200, JSON.stringify(r2.d)); ok(/deliberately/.test(r2.d.version.note), r2.d.version.note);
  const PN2 = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;
  const j2 = await run((await req('POST', '/studio/job', { project: PN2, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', acknowledge: true }, idem: 'nat-1' })).d.job); eq(j2.state, 'done', j2.error);
  const g2 = (await req('GET', '/studio/get?id=' + PN2)).d; const v2 = g2.assets[0].versions.find(x => x.id === g2.assets[0].current);
  const lg = (v2.layout.layers || []).find(l => l.role === 'logo'); ok(lg && !lg.rule, 'the national logo carries no HOOF rule: ' + JSON.stringify(lg && lg.rule));
});

await t('Teach this brand, the other kinds: a pending fact is approved in place, a banned term is added, a correction becomes a learned rule scoped to the campaign - each confirmed with a reason, each a kit revision or an engine_fixes row the workspace then shows', async () => {
  const insp = (await req('GET', '/brand/teach/inspect?ns=mca&campaign=hoof', null, 'read-key')).d; const f = insp.proposals.find(x => x.kind === 'fact');
  const fw = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'fact', proposal: { id: f.proposal.id, source: 'ATO fuel tax credit statistics 2026' }, confirm: true, reason: 'Steve checked the ATO table' })).d; eq(fw.ok, true, JSON.stringify(fw));
  const kit = (await req('GET', '/brand/kit?ns=mca')).d.kit; const fact = kit.facts.find(x => /1.2 billion/.test(x.text)); eq([fact.status, fact.source, fact.campaign], ['approved', 'ATO fuel tax credit statistics 2026', 'hoof']);
  eq(kit.facts.length, 3, 'nothing else changed');
  const bw = (await req('POST', '/brand/teach', { ns: 'mca', kind: 'banned', proposal: { term: 'handout', use: 'tax credit', why: 'it concedes the framing' }, confirm: true, reason: 'Dee, campaign guide' })).d; eq(bw.ok, true, JSON.stringify(bw));
  ok((await req('GET', '/brand/kit?ns=mca')).d.kit.banned.some(b => b.term === 'handout' && b.use === 'tax credit'));
  const rw = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'rule', proposal: { task: 'tiles', rule: 'The MYTH band is always red, the FACT band always teal' }, confirm: true, reason: 'Dee, campaign guide' })).d; eq(rw.ok, true, JSON.stringify(rw)); ok(rw.fix && rw.fix.id, JSON.stringify(rw));
  const fx = env.MIND_DB.db.prepare('SELECT * FROM engine_fixes WHERE id=?').get(rw.fix.id); ok(fx && fx.task === 'tiles' && /:campaign:hoof$/.test(fx.source) && /^teach:/.test(fx.source) && fx.active === 1, JSON.stringify(fx));
  const h = await ws('mca', 'hoof'); ok(h.preferences.some(p => p.id === 'fix:' + rw.fix.id && p.campaign === 'hoof'), 'the rule shows as a campaign preference');
  const n = await ws('mca', 'national'); ok(!n.preferences.some(p => p.id === 'fix:' + rw.fix.id), 'the national campaign does not see it');
  eq((await req('POST', '/brand/teach', { ns: 'mca', kind: 'colour', proposal: {}, confirm: true, reason: 'x' })).d.error, 'unknown_kind');
  eq((await req('POST', '/brand/teach', { ns: 'aep', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl' }, confirm: true, reason: 'hijack' })).d.error, 'unknown_campaign', 'another client cannot teach this one');
  eq((await req('GET', '/brand/kit?ns=aep')).d.kit.facts.length, 1, 'aep untouched');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
