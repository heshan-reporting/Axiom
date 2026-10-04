/* One context compiler for every generation path (S7). stCompileContext builds the client context, the references and
 * their pack, the artwork memory, the placement evidence and the campaign identity line once, and returns a MANIFEST of
 * what informed the call - facts by id, banned terms, corrections by id, references attached / read / excluded, artwork
 * memory, placement, marks, models - and what was held but left out, with the reason. Strategy, directions, production,
 * sequence, revise, concepts and suggestions all record it (`informed`) on the versions and events they write, the same
 * identity line reaches every path, and GET /studio/used answers "What informed this creative?" from the record, through
 * later hand edits. Namespaces stay walls. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s7-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor, RELEASE } from './studio-answers.mjs';
const T = suite('studio-s7-worker (one context compiler; what informed this creative, recorded on every generation path)');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const PNG_LOGO = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const PNG_MARK = Buffer.from('89504e470d0a1a0a' + '22'.repeat(100), 'hex').toString('base64');
const anth = { calls: [] };
const w = await workerEnv({ env: { STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/generativelanguage/, async (u) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); anth.calls.push(body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  const a = /describing one reference image/.test(sys) ? { summary: 'A teal HOOF tile, wordmark bottom left.', logo: 'wordmark bottom left', mark: { present: true, kind: 'wordmark', corner: 'bl' }, text: [], takeaways: [] }
    : /planning a campaign sequence/.test(sys) ? { name: 'The credit, in order', arc: 'myth, then fact', cadence: 'two days', items: [{ order: 1, role: 'opener', channel: 'instagram', format: '1:1', day: 0, purpose: 'open', relation: 'the myth', headline: 'Not a subsidy.', support: 'A tax that never applied.', cta: 'Read on', caption: 'c', alt: 'a', claims: [] }, { order: 2, role: 'proof', channel: 'facebook', format: '1:1', day: 2, purpose: 'prove', relation: 'the fact', headline: 'The fuel excise is 50.8 cents per litre', support: 's', cta: 'Get the facts', caption: 'c', alt: 'a', claims: [] }] }
    : answerFor(sys, user);
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 5 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input, asset) => { const r = await call('POST', '/studio/job', { project: P, asset, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const curOf = a => a.versions.find(v => v.id === a.current);

// MCA: the HOOF campaign with its wordmark, an approved HOOF fact, a pending one, a national fact, a banned term, two corrections (one switched off)
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain, confident.', rules: 'Label the answer Fact, never Busted.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', identity: 'MYTH in red, FACT in teal', url: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining' }],
  facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'Mining employs 290,000 Australians', source: 'ABS', status: 'approved', campaign: 'national' }, { text: 'Farmers claimed 1.2 billion litres', source: 'draft', status: 'pending', campaign: 'hoof' }],
  banned: [{ term: 'subsidy', use: 'tax credit', allowNegated: true }], logoB64: PNG_LOGO, logoMime: 'image/png' });
await call('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG_MARK, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light' });
await call('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', palette: { primary: '#2F7FD6' }, campaigns: [{ id: 'gas', name: 'Gas' }], facts: [{ text: 'Gas supplies 27 per cent of energy', source: 'AEMO', status: 'approved' }], banned: [{ term: 'fossil' }] });
await call('GET', '/engine/status?ns=mca');
const fixOn = await call('POST', '/engine/fix', { ns: 'mca', task: 'copy', scope: 'client', wrong: 'rebate', right: 'fuel tax credit', why: 'the term', rule: 'Say fuel tax credit, never rebate' });
const fixOff = await call('POST', '/engine/fix', { ns: 'mca', task: 'tiles', scope: 'client', wrong: 'x', right: 'y', why: 'z', rule: 'Never crop the wordmark' });
await call('POST', '/engine/fix/update', { id: fixOff.body.fix.id, active: false });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Informed', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', audience: 'regional voters', channels: ['instagram'], campaignConfirmed: true } })).body.id;
await call('POST', '/studio/source', { project: P, text: RELEASE, name: 'release' });
const R1 = (await call('POST', '/studio/reference', { project: P, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof' })).body.id;
const PN = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National' })).body.id;
await call('POST', '/studio/reference', { project: PN, name: 'National brand sheet', purpose: 'brand', imageB64: PNG, mime: 'image/png', campaign: 'national' });
let A = '', V0 = null;

await T.t('production records what informed it: the approved facts of its campaign by id (not the pending one, not another campaign\'s), the banned terms, the corrections in force by id (not the switched-off one), the references read, the placement, the marks, the sections - and what was left out, with the reason', async () => {
  const j = await stage(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: false }); eq(j.state, 'done', j.error);
  const g = await get(P); const a = g.assets[0]; A = a.id; V0 = curOf(a); const m = V0.context.informed;
  ok(m && m.v === 1 && m.stage === 'copy' && m.ns === 'mca' && m.campaign === 'hoof', JSON.stringify(m && { v: m.v, stage: m.stage, ns: m.ns, campaign: m.campaign }));
  eq(m.kit.facts.map(f => f.text), ['The fuel excise is 50.8 cents per litre'], 'the HOOF fact only'); ok(m.kit.facts[0].id && m.kit.facts[0].source === 'ATO');
  eq(m.kit.banned, ['subsidy']); eq([m.kit.voice, m.kit.standingRules, m.kit.identity, m.kit.policy], [true, 1, 'MYTH in red, FACT in teal', 'wordmark']);
  eq(m.corrections.map(c => c.id), [fixOn.body.fix.id], 'the active correction only: ' + JSON.stringify(m.corrections)); ok(/fuel tax credit/.test(m.corrections[0].rule));
  ok(m.references && m.references.mode === 'recommended' && [].concat(m.references.attached, m.references.read).some(r => r.id === R1 && r.purpose === 'approved'), JSON.stringify(m.references));
  ok(m.placement && m.placement.basis === 'observed' && m.placement.corner === 'bl' && m.placement.evidence === 1, JSON.stringify(m.placement));
  eq([m.marks.policy, m.marks.logoOnFile, m.marks.wordmarkOnFile], ['wordmark', true, true]);
  const om = m.omitted.map(o => o.what + ':' + (o.text || '')); ok(om.some(x => /^fact:Farmers claimed/.test(x)) && om.some(x => /^fact:Mining employs/.test(x)), 'pending and other-campaign facts named as left out: ' + JSON.stringify(m.omitted));
  ok(m.omitted.find(o => /Farmers/.test(o.text)).why.indexOf('pending') >= 0 && /national/.test(m.omitted.find(o => /Mining employs/.test(o.text)).why), JSON.stringify(m.omitted));
  ok(m.sections.some(s => s.id === 'kit') && m.sections.some(s => s.id === 'identity') && m.sections.some(s => s.id === 'references') && m.sections.every(s => s.chars > 0), JSON.stringify(m.sections));
  ok(m.models && m.models.creative && m.models.extract, JSON.stringify(m.models));
  ok(!/Gas supplies|fossil|aep/i.test(JSON.stringify(m)), 'nothing from another client');
});

await T.t('every generation path records the manifest with its own stage name: strategy and directions (events), sequence (versions), revise (event and version), concepts (event), suggestions (the answer)', async () => {
  const js = await stage(P, 'strategy', {}); eq(js.state, 'done', js.error);
  const jd = await stage(P, 'direct', { n: 2 }); eq(jd.state, 'done', jd.error);
  const jq = await stage(P, 'sequence', { count: 2, channels: ['instagram', 'facebook'], deliverable: 'copy' }); eq(jq.state, 'done', jq.error);
  const jr = await stage(P, 'revise', { target: 'asset', asset: A, instruction: 'Sharpen the headline' }); eq(jr.state, 'done', jr.error);
  const jc = await stage(P, 'concepts', { asset: A, mode: 'explore', feedback: 'Come up with a better creative' }, A); eq(jc.state, 'done', jc.error);
  const sg = await call('POST', '/studio/suggest', { asset: A, refresh: true }); eq(sg.status, 200, JSON.stringify(sg.body));
  const g = await get(P); const ev = kind => g.thread.filter(e => e.kind === kind).map(e => e.informed).filter(Boolean);
  eq(ev('strategy').map(m => m.stage), ['strategy']); eq(ev('directions').map(m => m.stage), ['direct']); eq(ev('revise').map(m => m.stage), ['revise']); eq(ev('concepts').map(m => m.stage), ['concepts']);
  const seq = g.assets.filter(x => /^Sequence/.test(x.family)); eq(seq.length, 2); ok(seq.every(x => curOf(x).context.informed && curOf(x).context.informed.stage === 'sequence'), 'sequence versions carry it');
  const a = g.assets.find(x => x.id === A); const rv = a.versions.find(v => /directed/.test(v.note)); ok(rv && rv.context.informed && rv.context.informed.stage === 'revise', 'the revised version carries the revise manifest: ' + JSON.stringify(rv && rv.context.informed && rv.context.informed.stage));
  ok(sg.body.informed && sg.body.informed.stage === 'suggest', JSON.stringify(sg.body.informed && sg.body.informed.stage));
  // the directions and concepts manifests say what they read: the directions saw no reference images (text only), the concepts attached the approved tile
  const dm = ev('directions')[0], cm = ev('concepts')[0];
  eq(dm.references.attached, [], 'directions read references by analysis only'); ok(dm.references.read.some(r => r.id === R1));
  ok(cm.references.attached.some(r => r.id === R1) || cm.references.read.some(r => r.id === R1), JSON.stringify(cm.references));
  ok(cm.artMemory && typeof cm.artMemory.count === 'number', 'the artwork memory is recorded');
});

await T.t('one compiler, one identity: the compiled instructions of production, the directions and the concepts carry the same CAMPAIGN IDENTITY and PALETTE lines, and the directions now see the campaign identity at all', async () => {
  const g = await get(P); const jobOf = st => g.jobs.filter(j => j.stage === st && j.state === 'done').map(j => j.id);
  const line = async id => { const d = (await call('GET', '/studio/compiled?job=' + id, null, 'read-key')).body; const txt = (d.calls || []).map(c => (c.user || '') + (c.system || '')).join('\n'); const m = txt.match(/CAMPAIGN IDENTITY: [^\n]+\nPALETTE: [^\n]+/); return m ? m[0] : ''; };
  const copyL = await line(jobOf('copy')[0]), dirL = await line(jobOf('direct')[0]), conL = await line(jobOf('concepts')[0]), revL = await line(jobOf('revise')[0]);
  ok(copyL && /Hands Off Our Fuel - MYTH in red, FACT in teal; mark policy: wordmark \(wordmark on file\) \(client logo on file\)/.test(copyL), copyL);
  eq(dirL, copyL, 'directions'); eq(conL, copyL, 'concepts'); eq(revL, copyL, 'revise');
});

await T.t('GET /studio/used answers "what informed this creative" from the record: the manifest of the generating version, unchanged through a later hand edit; a copy-only version carries the manifest with no references', async () => {
  const u = (await call('GET', '/studio/used?asset=' + A, null, 'read-key')).body; ok(u.informed, 'informed on the current version'); eq(u.informed.stage, 'revise', 'the latest generation of the words was the revision');
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = curOf(a);
  const hand = await call('POST', '/studio/version', { asset: A, copy: Object.assign({}, v.copy, { caption: 'A hand-written caption.' }), layout: v.layout, note: 'hand edit' }); eq(hand.status, 200, JSON.stringify(hand.body));
  const u2 = (await call('GET', '/studio/used?asset=' + A, null, 'read-key')).body; eq(u2.informed.at, u.informed.at, 'the same manifest, found through the hand edit'); eq(u2.editsSince.length, 1);
  const u0 = (await call('GET', '/studio/used?asset=' + A + '&version=' + V0.id, null, 'read-key')).body; eq(u0.informed.stage, 'copy', 'the first version answers with the production manifest');
  const seq = g.assets.find(x => /^Sequence/.test(x.family)); const us = (await call('GET', '/studio/used?asset=' + seq.id, null, 'read-key')).body;
  ok(us.informed && us.informed.stage === 'sequence' && us.informed.references === null && us.informed.kit.facts.length === 1, 'a copy-only sequence item: the kit knowledge, no reference pack: ' + JSON.stringify(us.informed && us.informed.references));
});

await T.t('namespaces are walls: an AEP production is informed by AEP\'s facts and banned terms only, with nothing of MCA\'s left in or named as left out', async () => {
  const PA = (await call('POST', '/studio/project', { ns: 'aep', campaign: 'gas', title: 'Gas', brief: { objective: 'o', message: 'm', channels: ['linkedin'], campaignConfirmed: true } })).body.id;
  const j = await stage(PA, 'copy', { channels: ['linkedin'], deliverable: 'copy', acknowledge: true }); eq(j.state, 'done', j.error);
  const m = curOf((await get(PA)).assets[0]).context.informed;
  eq(m.kit.facts.map(f => f.text), ['Gas supplies 27 per cent of energy']); eq(m.kit.banned, ['fossil']); eq(m.corrections, []);
  ok(!/fuel|hoof|subsidy|Minerals/i.test(JSON.stringify(m)), JSON.stringify(m).slice(0, 300));
});

const res = T.done(); process.exit(res.fail ? 1 : 0);
