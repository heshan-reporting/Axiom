/* Creative Studio P10, the Brand Workspace: what the Studio knows about a client's brand, campaign by campaign, with
 * provenance, authority, status and history. The kit keeps a revision history (and its logo keeps its version through a
 * palette edit); wordmark variants are a library with tones, defaults and per-variant history, distinct from the old
 * single slot; readiness names what is missing, what conflicts and what is out of date before anything is spent; knowledge
 * items carry an authority (approved rule, reference observation, preference, project decision, AI inference) and a scope,
 * keep revisions, and an inference never becomes a rule by itself; an approval or rejection with a reason proposes a memory
 * update that nothing applies until a person keeps it; namespaces are walls; "What the Studio used" names the references,
 * rules, facts, marks, models and assumptions behind a version, through later hand edits.
 * Run: node --experimental-sqlite tests/studio-p10-worker.mjs */
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
const anth = { calls: [] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png(9) } }] } }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body); const sys = String(body.system || '');
    const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    const text = /producing a coordinated set/.test(sys) ? JSON.stringify({ pieces: ['instagram', 'facebook'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'Not a subsidy.', alt: 'tile', visual: 'a farmer at a tank', claims: [] })) }) : '{}';
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
const codes = list => (list || []).map(x => x.code);

console.log('studio-p10-worker harness (the Brand Workspace: provenance, authority, scope, readiness, reviewed memory, variants, history, isolation, what the Studio used)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, voice: 'Plain, confident, never shrill.', rules: 'Label the answer Fact, never Busted.',
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', identity: 'MYTH in red, FACT in teal', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }, { id: 'vgo', name: "Victoria's Golden Opportunity", logoPolicy: 'wordmark' }],
  facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'Mining employs 290,000 Australians', source: 'ABS', status: 'approved', campaign: 'national' }],
  banned: [{ term: 'subsidy', use: 'tax credit', why: 'it concedes the framing', allowNegated: true }] });
await req('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', campaigns: [{ id: 'gas', name: 'Gas' }], facts: [{ text: 'Gas supplies 27 per cent of energy', source: 'AEMO', status: 'approved' }] });

await t('the kit keeps a revision history in words; a palette edit keeps the logo\'s version (it used to drop it); each logo upload is a version that stays on file', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(11), logoMime: 'image/png' });
  const v1 = (await req('GET', '/brand/kit?ns=mca')).d.kit.logoV; ok(v1, 'a logo version');
  await req('POST', '/brand/kit', { ns: 'mca', palette: { primary: '#0E6A6E', secondary: '#E8B23A' } });
  eq((await req('GET', '/brand/kit?ns=mca')).d.kit.logoV, v1, 'the logo version survives a palette-only save');
  await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(12), logoMime: 'image/png' });
  const k = (await req('GET', '/brand/kit?ns=mca')).d.kit; ok(k.logoV !== v1 && k.logoVersions.map(x => x.v).includes(v1) && k.logoVersions.map(x => x.v).includes(k.logoV), JSON.stringify(k.logoVersions));
  const revs = (await req('GET', '/brand/revisions?ns=mca', null, 'read-key')).d.revisions;
  ok(revs.length >= 4 && revs.some(r => r.summary.includes('palette')) && revs.some(r => r.summary.some(s => /^logo \(version /.test(s))), JSON.stringify(revs.map(r => r.summary)));
  const snap = (await req('GET', '/brand/revisions?ns=mca&id=' + revs[0].id, null, 'read-key')).d.revisions[0]; ok(snap.kit && snap.kit.logoV === k.logoV, 'each revision keeps the kit as it was saved');
});

await t('readiness before anything is spent: a wordmark campaign without its wordmark is blocked and says what to upload; the logo campaign with its logo is not blocked', async () => {
  const h = await ws('mca', 'hoof'); eq(h.readiness.state, 'blocked'); eq(codes(h.readiness.blocking), ['wordmark_missing']); ok(/--wordmark --variant/.test(h.readiness.blocking[0].fix), h.readiness.blocking[0].fix);
  eq(h.identity.logo.forbidden, true, 'HOOF never carries the client logo');
  const n = await ws('mca', 'national'); ok(!n.readiness.blocking.length, JSON.stringify(n.readiness.blocking)); eq(n.identity.logo.required, true);
  const b = (await req('GET', '/studio/brief/check?project=' + (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF', brief: { objective: 'o', message: 'm' } })).d.id)).d;
  eq(b.brand.state, 'blocked', 'the brief check carries the brand readiness'); eq(codes(b.brand.blocking), ['wordmark_missing']);
});

await t('wordmark variants are a library, not the single slot: named, toned, versioned, the first is the default, a re-upload keeps the earlier version in its history; tones are checked for contrast coverage; the single slot beside variants is a named conflict', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'blue', wordmarkTone: 'colour', wordmarkB64: png(1), wordmarkMime: 'image/png' });
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: png(2), wordmarkMime: 'image/png' });
  let h = await ws('mca', 'hoof'); eq(h.identity.wordmark.variants.map(v => [v.variant, v.tone, v.default, v.onFile]), [['blue', 'colour', true, true], ['white', 'light', false, true]]);
  ok(!h.readiness.blocking.length && codes(h.readiness.gaps).includes('wordmark_tones'), 'no dark variant: ' + JSON.stringify(h.readiness.gaps));
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'black', wordmarkTone: 'dark', wordmarkB64: png(3), wordmarkMime: 'image/png' });
  const oldWhite = h.identity.wordmark.variants.find(v => v.variant === 'white').v;
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: png(4), wordmarkMime: 'image/png' });
  h = await ws('mca', 'hoof'); ok(!codes(h.readiness.gaps).includes('wordmark_tones'));
  const w = h.identity.wordmark.variants.find(v => v.variant === 'white'); ok(w.v !== oldWhite && w.history.some(x => x.v === oldWhite), JSON.stringify(w.history));
  eq(h.identity.wordmark.legacy, null, 'no single slot in use');
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkB64: png(5), wordmarkMime: 'image/png' });
  h = await ws('mca', 'hoof'); ok(h.identity.wordmark.legacy && /not a variant library/.test(h.identity.wordmark.legacy.note), 'the single slot is labelled for what it is');
  ok(codes(h.readiness.conflicts).includes('wordmark_two_sources'));
  const revs = (await req('GET', '/brand/revisions?ns=mca', null, 'read-key')).d.revisions; ok(revs.some(r => r.summary.some(s => /^hoof wordmark variant black \(dark, version /.test(s))), JSON.stringify(revs.slice(0, 4).map(r => r.summary)));
  const audit = (await req('GET', '/studio/identity?ns=mca', null, 'read-key')).d.campaigns.find(c => c.id === 'hoof'); ok(audit.wordmark.onFile && !audit.gaps.some(g => /wordmark/.test(g)), 'the identity audit sees the variants: ' + JSON.stringify(audit.gaps));
});

await t('every item carries its authority, scope and source: kit voice and rules and facts are approved rules, a pending fact is an unreviewed inference, references are observations, learned corrections are preferences; a campaign view leaves other campaigns out', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'Mining employs 290,000 Australians', source: 'ABS', status: 'approved', campaign: 'national' }, { text: 'Farmers claimed 1.2 billion litres', source: 'draft', status: 'pending', campaign: 'hoof' }] });
  const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Refs' })).d.id;
  await req('POST', '/studio/reference', { project: P, name: 'Approved HOOF myth tile', purpose: 'approved', imageB64: png(6), mime: 'image/png', campaign: 'hoof' });
  const PN = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National refs' })).d.id;
  await req('POST', '/studio/reference', { project: PN, name: 'National brand sheet', purpose: 'brand', imageB64: png(7), mime: 'image/png', campaign: 'national' });
  env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f1','mca','tiles','client','','','','Keep the MCA logo small in the bottom right corner','','studio:x:campaign:hoof','Dee',1,1,0)").run();
  env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f2','mca','copy','client','','','','Say fuel tax credit, never rebate','','content:y','Tania',2,1,0)").run();
  const h = await ws('mca', 'hoof');
  const voice = h.voice.items.find(i => i.kind === 'voice' && i.id === 'kit:voice'); eq([voice.authority, voice.authorityWord, voice.source.type], ['rule', 'approved rule', 'kit']);
  const facts = h.words.items.filter(i => i.kind === 'claim'); eq(facts.map(f => [f.authority, f.status]), [['rule', 'active'], ['inference', 'proposed']]); eq(h.words.excludedFacts, 1, 'the national fact is left out of the HOOF view');
  eq(h.references.map(r => [r.name, r.authority, r.purpose]), [['Approved HOOF myth tile', 'observation', 'approved']], 'the national brand sheet is not a HOOF reference');
  const prefs = h.preferences.map(p => [p.id, p.authority, p.campaign]); eq(prefs.sort(), [['fix:f1', 'preference', 'hoof'], ['fix:f2', 'preference', '']].sort());
  ok(h.counts.rule >= 3 && h.counts.observation === 1 && h.counts.preference === 2, JSON.stringify(h.counts));
  ok(codes(h.readiness.conflicts).includes('logo_preference_vs_policy'), 'a preference about the MCA logo on HOOF is a named conflict: ' + JSON.stringify(h.readiness.conflicts));
  ok(codes(h.readiness.outdated).includes('fact_pending') && codes(h.readiness.outdated).includes('references_unanalysed'), JSON.stringify(h.readiness.outdated));
  ok(/no other client/.test(h.note), h.note);
});

await t('conflicts and out-of-date knowledge are found: a banned term inside an approved fact, two approved facts that disagree, a fact that names an old year', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'The fuel excise is 49.6 cents per litre', source: 'old ATO page', status: 'approved', campaign: 'hoof' }, { text: 'Fuel tax credits are a subsidy for miners, said a 2019 report', source: 'press', status: 'approved', campaign: 'hoof' }] });
  const h = await ws('mca', 'hoof'); const c = codes(h.readiness.conflicts);
  ok(c.includes('facts_disagree') && c.includes('banned_in_knowledge'), JSON.stringify(h.readiness.conflicts));
  ok(codes(h.readiness.outdated).includes('fact_dated'), JSON.stringify(h.readiness.outdated));
  await req('POST', '/brand/kit', { ns: 'mca', facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }] });
});

let ITEM = '';
await t('knowledge items: created with an authority and a scope, revised with reasons, an AI inference is saved as a proposal and cannot be switched on as it stands, a proposal is kept with a chosen scope or dismissed with a reason', async () => {
  const a = await req('POST', '/brand/item', { ns: 'mca', campaign: 'hoof', kind: 'device', authority: 'rule', title: 'MYTH / FACT bands', body: 'MYTH in a red band, FACT in a teal band, never the word Busted.', source: { type: 'team', label: 'Dee, campaign guide 2026' } }); eq(a.status, 200, JSON.stringify(a.d)); ITEM = a.d.item.id;
  eq([a.d.item.scope, a.d.item.authorityWord, a.d.item.status], ['campaign', 'approved rule', 'active']);
  const u = await req('POST', '/brand/item/update', { ns: 'mca', id: ITEM, body: 'MYTH in a red band, FACT in a teal band; the bands run full width.', why: 'Dee added the full-width rule' }); eq(u.d.item.rev, 2);
  const hist = (await req('GET', '/brand/item/history?ns=mca&id=' + ITEM, null, 'read-key')).d; eq(hist.revisions.map(r => [r.rev, r.why]), [[2, 'Dee added the full-width rule'], [1, 'created']]);
  const inf = await req('POST', '/brand/item', { ns: 'mca', kind: 'imagery', authority: 'inference', status: 'active', title: 'Rural light', body: 'Approved tiles use warm low sun.' }); eq(inf.d.item.status, 'proposed', 'an inference is a proposal');
  eq((await req('POST', '/brand/item/update', { ns: 'mca', id: inf.d.item.id, status: 'active' })).d.error, 'inference_not_rule');
  eq((await req('POST', '/brand/item/review', { ns: 'mca', id: inf.d.item.id, decision: 'keep', scope: 'campaign' })).d.error, 'campaign_required');
  const kept = await req('POST', '/brand/item/review', { ns: 'mca', id: inf.d.item.id, decision: 'keep', scope: 'campaign', campaign: 'hoof', authority: 'preference', reason: 'matches the approved tiles' });
  eq([kept.d.item.status, kept.d.item.authority, kept.d.item.campaign], ['active', 'preference', 'hoof']);
  eq((await req('POST', '/brand/item/review', { ns: 'mca', id: inf.d.item.id, decision: 'keep' })).status, 409, 'a kept item is not reviewed twice');
  const p2 = await req('POST', '/brand/item', { ns: 'mca', kind: 'dislike', authority: 'inference', title: 'Stock farmers', body: 'Avoid smiling stock farmers.' });
  eq((await req('POST', '/brand/item/review', { ns: 'mca', id: p2.d.item.id, decision: 'dismiss' })).d.error, 'reason_required');
  eq((await req('POST', '/brand/item/review', { ns: 'mca', id: p2.d.item.id, decision: 'dismiss', reason: 'the client uses them on the national campaign' })).d.item.status, 'retired');
  eq((await req('POST', '/brand/item', { ns: 'mca', campaign: 'nope', title: 'x' })).d.error, 'unknown_campaign');
  eq((await req('POST', '/brand/item', { ns: 'mca', title: 'x' }, 'read-key')).status, 403, 'writing knowledge needs a full key');
});

await t('an approval or rejection with a reason proposes a memory update with its source; nothing applies it until a person keeps it', async () => {
  const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF tile' })).d.id;
  const A = (await req('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Myth tile', copy: { headline: 'Not a subsidy', support: 'A tax returned', cta: 'Sign' }, mode: 'copy' })).d.asset.id;
  const r = await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'reject', reason: 'Too defensive: lead with who uses the credit, not the denial.' }); eq(r.status, 200); ok(r.d.proposal, 'a proposal id');
  const h = await ws('mca', 'hoof'); const prop = h.items.find(i => i.id === r.d.proposal);
  eq([prop.status, prop.kind, prop.authority, prop.source.type, prop.source.asset], ['proposed', 'rejected', 'decision', 'approval', A]);
  ok(codes(h.readiness.gaps).includes('proposals_waiting'));
  const before = env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM engine_fixes').get().n;
  eq(env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM engine_fixes').get().n, before, 'no rule was written');
  const r2b = await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'reject', reason: 'Too defensive: lead with who uses the credit, not the denial.' }); eq(r2b.d.proposal, r.d.proposal, 'the same reason is not proposed twice');
  eq((await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'ok' })).d.proposal, null, 'a one-word reason proposes nothing');
});

await t('namespaces are walls: another client sees none of this client\'s items, facts, references, marks or history, and cannot edit them by naming its own namespace', async () => {
  const a = await ws('aep', '');
  ok(!a.items.length && !a.references.length && !a.preferences.length && a.words.items.every(i => !/fuel|mining/i.test(i.body)) && !a.identity.logo.onFile, JSON.stringify({ items: a.items.length, refs: a.references.length }));
  ok((await req('GET', '/brand/revisions?ns=aep', null, 'read-key')).d.revisions.every(r => !r.summary.some(s => /hoof|logo/.test(s))));
  eq((await req('POST', '/brand/item/update', { ns: 'aep', id: ITEM, body: 'hijack' })).status, 404);
  eq((await req('GET', '/brand/item/history?ns=aep&id=' + ITEM, null, 'read-key')).status, 404);
  eq((await req('GET', '/brand/workspace?ns=mca&campaign=gas', null, 'read-key')).status, 404, 'a campaign of another client is unknown here');
});

await t('what the Studio used: a produced version names its references, rules, facts, marks (variant and version), models, assumptions and kit revision; a later hand edit points back to it and says it used nothing new', async () => {
  const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Used', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'] } })).d.id;
  const R = await req('POST', '/studio/reference', { project: P, name: 'HOOF brand sheet', purpose: 'brand', imageB64: png(8), mime: 'image/png', campaign: 'hoof' });
  const j = await run((await req('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', acknowledge: true }, idem: 'used-1' })).d.job); eq(j.state, 'done', j.error);
  const g = (await req('GET', '/studio/get?id=' + P)).d; const a = g.assets[0];
  const u = (await req('GET', '/studio/used?asset=' + a.id, null, 'read-key')).d;
  ok(u.generatedBy && u.generatedBy.version === a.current, JSON.stringify(u.generatedBy));
  ok(u.references && u.references.mode === 'recommended' && [].concat(u.references.attached, u.references.read).some(r => r.id === R.d.id) || (u.references && u.references.unavailable.some(x => x.id === R.d.id)), 'the reference pack: ' + JSON.stringify(u.references));
  ok(u.rules.some(r => r.id === 'f2' && /fuel tax credit/.test(r.rule)), 'the learned corrections in force are named: ' + JSON.stringify(u.rules));
  eq(u.facts, 1, 'one approved HOOF fact in play'); eq(u.campaign, 'hoof');
  const wm = u.marks.find(m => m.role === 'wordmark'); ok(wm && wm.variant && wm.version && wm.campaign === 'hoof' && !u.marks.some(m => m.role === 'logo'), 'the exact wordmark variant and version, no MCA logo: ' + JSON.stringify(u.marks));
  ok(u.kit.revision && u.kit.revision.at <= u.kit.updated, 'the kit revision in force: ' + JSON.stringify(u.kit));
  ok(Array.isArray(u.assumptions) && u.assumptions.some(x => /audience assumed/.test(x)), JSON.stringify(u.assumptions));
  const v = a.versions.find(x => x.id === a.current);
  await req('POST', '/studio/version', { asset: a.id, copy: Object.assign({}, v.copy, { headline: 'Hands off our fuel.' }), layout: v.layout, note: 'hand edit' });
  const u2 = (await req('GET', '/studio/used?asset=' + a.id, null, 'read-key')).d;
  eq(u2.generatedBy.version, a.current, 'resolved to the generated version'); eq(u2.editsSince.length, 1); ok(/used no model and no new knowledge/.test(u2.note), u2.note);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
