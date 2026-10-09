/* S23 slice I on the worker (providers MOCKED): validation that follows the drawing, and a brand memory that keeps what it
 * learns from references honest about where it came from.
 *   I-W1 the render fingerprint: a change to a typeface, the crop, a turn, an opacity, the paint order or the mark file's revision
 *        leaves the composition unvalidated and drops its design approval; a caption change leaves both standing;
 *   I-W2 a reference carries its record: paid or organic, format and channel, approval state and date, likes and dislikes with
 *        their evidence; bounded and sanitised; a read key cannot write it, another project cannot reach it;
 *   I-W3 observations: the vision pass seeds what it saw (observed) and what it concluded (inferred), never a mandatory rule; a
 *        person corrects one (the original kept), retires and restores one, adds their own; a re-analysis refreshes the vision
 *        pass's items and keeps the team's;
 *   I-W4 promotion to a standing rule: an inferred observation is refused until a person confirms it; references of the same
 *        campaign that disagree in that area are named and must be resolved; a confirmed promotion writes the rule with its
 *        provenance and marks the observation promoted;
 *   I-W5 the knowledge-gap report names uncertain campaign scope, rules for a campaign the kit no longer has, and exactly which
 *        references would help (campaign, format, purpose);
 *   I-W6 the identity audit reads storage, not the kit's record: each HOOF wordmark variant on file is listed with its tone and
 *        bytes, a variant the kit names whose file is gone is reported missing, and the client logo is named as not carried.
 * Run: node --experimental-sqlite tests/studio-s23i-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const T = suite('studio-s23i-worker (render fingerprint, reference records and observations, promotion guard, gap report, identity audit)');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000100000001008020000009091683600000013494441547801636060f8cfc0c0c03003000016001101a3cf2b0000000049454e44ae426082', 'hex').toString('base64');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
let analysisCalls = 0; let analysis = null; const sent = [];
const ANALYSIS = (o) => Object.assign({ summary: 'A bold yellow band over a dusk road with the wordmark bottom right.', typography: 'Condensed sans, heavy weight, all caps headline, light body', colour: { palette: ['#F2B705', '#0E3A44'], relationships: 'Yellow band on deep teal, white type' }, hierarchy: 'Headline, then figure, then URL', composition: 'Band across the lower third, photograph above', imageTreatment: 'Documentary photograph, warm grade', panels: 'One solid band, square corners', spacing: 'Generous margins, 6% sides', logo: 'Wordmark bottom right, about a fifth of the width', url: 'URL small, bottom left, white', mark: { present: true, kind: 'wordmark', corner: 'br', size: 'a fifth of the width', clearSpace: 'half its height' }, text: ['HANDS OFF OUR FUEL'], takeaways: ['Lead with the yellow band', 'Keep the URL small and white'] }, o || {});
w.answer(/api\.anthropic\.com/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || '');
  if (/describing one reference image/.test(sys)) { analysisCalls++; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(analysis || ANALYSIS()) }], stop_reason: 'end_turn' }), { status: 200 }); }
  sent.push(sys + '\n' + JSON.stringify(body.messages || []));
  return new Response(JSON.stringify({ error: { type: 'not_expected' } }), { status: 500 });
});
w.answer(/generativelanguage/, async () => new Response(JSON.stringify({ error: { message: 'not expected' } }), { status: 500 }));
// two campaigns: HOOF carries its own wordmark (three variants), the national campaign the client logo
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian Mining', logoPolicy: 'logo' }] });
for (const [variant, tone] of [['blue', 'colour'], ['white', 'light'], ['black', 'dark']]) await call('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: variant, wordmarkTone: tone, wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkDefault: variant === 'white', logoPolicy: 'wordmark' });
const kitNow = async () => { const r = await call('GET', '/brand/kit?ns=mca'); return r.body.kit || r.body; };
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fingerprint and memory', brief: { channels: ['instagram'] } })).body.id;
const get = async (pid) => (await call('GET', '/studio/get?id=' + (pid || P), null, 'read-key')).body;
const curOf = a => a.versions.find(v => v.id === a.current);
let TILE = null;

await T.t('I-W1 the render fingerprint: typeface, crop, turn, opacity, paint order and the mark file\'s revision unvalidate the composition and drop its design approval; a caption change does not', async () => {
  const wm = (await kitNow()).campaigns.find(c => c.id === 'hoof').wordmarks.find(x => x.variant === 'white');
  const base = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], layers: [
    { id: 'band', type: 'shape', role: 'device', shape: 'rect', x: 0, y: 70, w: 100, h: 30, fill: '#F2B705', opacity: 1 },
    { id: 'headline', type: 'text', role: 'headline', x: 8, y: 74, w: 84, h: 12, size: 6, weight: 800, color: '#111418' },
    { id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + wm.v, x: 70, y: 90, w: 24, h: 7, fit: 'contain', exact: true }] };
  const A = TILE = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Tile', copy: { headline: 'Hands off our fuel', caption: 'First caption' }, layout: base, mode: 'composition' })).body.asset.id;
  const pass = async () => { const g = await get(); const a = g.assets.find(x => x.id === A); const v = curOf(a); const r = await call('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a) }); return r; };
  const tech = async () => (await call('GET', '/studio/readiness?asset=' + A, null, 'read-key')).body.technical;
  const v1 = await pass(); eq(v1.status, 200, JSON.stringify(v1.body).slice(0, 300)); eq(await tech(), 'passed', 'the first composition passes');
  await call('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'copy ready' });
  const ap = await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'design ready' }); eq(ap.status, 200, JSON.stringify(ap.body).slice(0, 200));
  const change = async (label, fn, keep) => {
    await pass(); const g = await get(); const a = g.assets.find(x => x.id === A); const v = curOf(a);
    if (!keep) { await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'design ready again' }); }
    const L = JSON.parse(JSON.stringify(v.layout)); const copy = Object.assign({}, v.copy); fn(L, copy);
    const r = await call('POST', '/studio/version', { asset: A, project: P, layout: L, copy, note: label }); eq(r.status, 200, label + ': ' + JSON.stringify(r.body).slice(0, 200));
    const t = await tech(); const a2 = (await get()).assets.find(x => x.id === A);
    return { t, design: !!(a2.approvals && a2.approvals.design) };
  };
  for (const [label, fn] of [
    ['typeface', (L) => { L.layers.find(l => l.id === 'headline').family = 'Archivo Black'; }],
    ['crop', (L) => { L.imageFocus = { x: 30, y: 50, zoom: 1.4 }; }],
    ['turn', (L) => { L.layers.find(l => l.id === 'band').rotate = 4; }],
    ['opacity', (L) => { L.layers.find(l => l.id === 'band').opacity = 0.6; }],
    ['paint order', (L) => { L.layers = [L.layers[1], L.layers[0], L.layers[2]]; }],
    ['mark revision', (L) => { const m = L.layers.find(l => l.id === 'wordmark'); m.src = m.src.replace(/&v=.*/, '&v=' + (Number(wm.v) + 1)); }],
  ]) { const r = await change(label, fn); ok(r.t !== 'passed', label + ': the old measurement does not stand (' + r.t + ')'); ok(!r.design, label + ': the design approval of the old tile does not stand'); }
  const c = await change('caption', (L, copy) => { copy.caption = 'A second caption'; });
  eq([c.t, c.design], ['passed', true], 'a caption is not drawn: the measurement and the design approval stand');
});

let R1 = null, R2 = null;
await T.t('I-W2 a reference carries its record: context, format, channel, approval with its date, likes and dislikes with evidence; bounded; read keys and other projects refused', async () => {
  const r = await call('POST', '/studio/reference', { project: P, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof' });
  eq(r.status, 200, JSON.stringify(r.body).slice(0, 200)); R1 = r.body.id;
  const bad = await call('POST', '/studio/reference/meta', { id: R1, approval: { state: 'approved', date: '2026-13-40' } }); eq(bad.status, 400, 'a date that is not a date is refused: ' + JSON.stringify(bad.body));
  const m = await call('POST', '/studio/reference/meta', { id: R1, context: 'paid', format: '4:5', channel: 'instagram', approval: { state: 'approved', date: '2026-09-30', by: 'Dee' }, likes: [{ text: 'The bold yellow band', evidence: 'Dee in Slack, 30 Sept' }], dislikes: [{ text: 'The URL too small to read', evidence: 'client feedback round 2' }], junk: 'x' });
  eq(m.status, 200, JSON.stringify(m.body).slice(0, 300));
  const ref = (await get()).references.find(x => x.id === R1); const meta = ref.meta || {};
  eq([meta.context, meta.format, meta.channel, meta.approval.state, meta.approval.date, meta.approval.by], ['paid', '4:5', 'instagram', 'approved', '2026-09-30', 'Dee']);
  eq([meta.likes[0].text, meta.likes[0].evidence, meta.dislikes[0].text], ['The bold yellow band', 'Dee in Slack, 30 Sept', 'The URL too small to read']); ok(!('junk' in meta), 'unknown fields dropped');
  eq((await call('POST', '/studio/reference/meta', { id: R1, context: 'organic' }, 'read-key')).status, 403, 'a read key cannot write it');
  const Q = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Elsewhere', brief: {} })).body.id;
  eq((await call('POST', '/studio/reference/meta', { id: R1, project: Q, context: 'organic' })).status, 403, 'another project cannot reach it');
});

await T.t('I-W3 observations: the vision pass seeds observed and inferred items, never a mandatory one; a person corrects, retires, restores and adds; re-analysis keeps the team\'s', async () => {
  let ref = (await get()).references.find(x => x.id === R1); const obs = (ref.meta || {}).observations || [];
  ok(obs.length >= 6, 'seeded from the vision pass: ' + obs.map(o => o.area + '/' + o.authority).join(', '));
  ok(obs.filter(o => o.source === 'analysis').every(o => o.authority === 'observed' || o.authority === 'inferred'), 'the vision pass never writes a mandatory or preferred item');
  ok(obs.some(o => o.area === 'url' && o.authority === 'observed') && obs.some(o => o.area === 'logo') && obs.some(o => o.area === 'takeaway' && o.authority === 'inferred'), 'the URL and the logo are observed; the takeaways inferred');
  const typ = obs.find(o => o.area === 'typography'); const comp = obs.find(o => o.area === 'composition');
  const c = await call('POST', '/studio/reference/observation', { id: R1, obs: typ.id, action: 'correct', text: 'Condensed sans, extra bold, all caps; body in the same family, regular', why: 'the vision pass called the body light' });
  eq(c.status, 200, JSON.stringify(c.body).slice(0, 200));
  const rt = await call('POST', '/studio/reference/observation', { id: R1, obs: comp.id, action: 'retire', why: 'the band was a one-off for this execution' }); eq(rt.status, 200);
  const add = await call('POST', '/studio/reference/observation', { id: R1, action: 'add', area: 'url', text: 'The URL always sits bottom left in white', authority: 'mandatory', why: 'agreed with Dee' }); eq(add.status, 200, JSON.stringify(add.body).slice(0, 200));
  ref = (await get()).references.find(x => x.id === R1); let o2 = ref.meta.observations;
  const t2 = o2.find(o => o.id === typ.id); ok(t2.text.indexOf('extra bold') >= 0 && t2.was && t2.was.text === typ.text && t2.source === 'team', 'corrected, the original kept: ' + JSON.stringify(t2));
  eq(o2.find(o => o.id === comp.id).status, 'retired', 'retired');
  ok(o2.some(o => o.source === 'team' && o.authority === 'mandatory' && o.area === 'url'), 'a person may state a mandatory item');
  eq((await call('POST', '/studio/reference/observation', { id: R1, obs: comp.id, action: 'restore' })).status, 200);
  eq(((await get()).references.find(x => x.id === R1).meta.observations.find(o => o.id === comp.id) || {}).status, 'active', 'restored');
  analysis = ANALYSIS({ typography: 'Grotesque sans, bold', takeaways: ['A new takeaway'] });
  eq((await call('POST', '/studio/reference/analyse', { id: R1 })).status, 200);
  o2 = (await get()).references.find(x => x.id === R1).meta.observations;
  ok(o2.find(o => o.id === typ.id && o.source === 'team' && /extra bold/.test(o.text)), 'the corrected item survives the re-analysis');
  ok(o2.some(o => o.source === 'team' && o.area === 'url' && o.authority === 'mandatory'), 'the team\'s own item survives');
  ok(o2.some(o => o.source === 'analysis' && o.area === 'takeaway' && /A new takeaway/.test(o.text)) && !o2.some(o => o.source === 'analysis' && /Lead with the yellow band/.test(o.text)), 'the vision pass\'s items are refreshed');
  analysis = null;
});

await T.t('I-W4 promotion: an inferred item waits for a person; disagreeing references of the campaign are named and resolved first; the rule keeps its provenance', async () => {
  const take = (await get()).references.find(x => x.id === R1).meta.observations.find(o => o.area === 'takeaway' && o.status === 'active');
  const p0 = await call('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'rule', proposal: { observation: { ref: R1, obs: take.id } } });
  eq([p0.status, p0.body.error], [409, 'unconfirmed'], 'an inference is not promoted as it stands: ' + JSON.stringify(p0.body).slice(0, 200));
  eq((await call('POST', '/studio/reference/observation', { id: R1, obs: take.id, action: 'authority', authority: 'observed', why: 'Dee confirmed it on the call' })).status, 200);
  // a second approved HOOF reference that says something else about the same thing
  analysis = ANALYSIS({ takeaways: ['Lead with the photograph, no band'] }); R2 = (await call('POST', '/studio/reference', { project: P, name: 'Another HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof' })).body.id; analysis = null;
  const p1 = await call('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'rule', proposal: { observation: { ref: R1, obs: take.id } } });
  eq([p1.status, p1.body.error], [409, 'ambiguous'], 'the references disagree: ' + JSON.stringify(p1.body).slice(0, 300));
  ok((p1.body.others || []).some(o => o.ref === R2), 'the disagreeing reference is named');
  const p2 = await call('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'rule', proposal: { observation: { ref: R1, obs: take.id }, resolve: 'this' } });
  eq(p2.status, 200, JSON.stringify(p2.body).slice(0, 300)); eq(p2.body.written, false, 'a preview first'); ok(/takes precedence/.test(JSON.stringify(p2.body.preview)), 'the preview says the others are set aside');
  const p3 = await call('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'rule', proposal: { observation: { ref: R1, obs: take.id }, resolve: 'this' }, confirm: true, reason: 'Dee confirmed the band leads on HOOF' });
  eq([p3.status, p3.body.written], [200, true], JSON.stringify(p3.body).slice(0, 300));
  const fixes = (await call('GET', '/engine/fixes?ns=mca', null, 'read-key')).body; const list = fixes.fixes || fixes.rules || fixes;
  ok(JSON.stringify(list).indexOf('teach:brand:campaign:hoof') >= 0, 'the rule is scoped to HOOF with its provenance');
  const g = await get(); const t = g.references.find(x => x.id === R1).meta.observations.find(o => o.id === take.id);
  eq(t.status, 'promoted', 'the observation is marked promoted'); ok(t.promoted && t.promoted.fix, 'with the rule it became');
  const other = g.references.find(x => x.id === R2).meta.observations.filter(o => o.area === 'takeaway');
  ok(other.every(o => o.status === 'retired' && /superseded/.test((o.retired || {}).why || '')), 'the disagreeing items are retired, saying why');
});

await T.t('I-W5 the gap report names uncertain campaign scope, rules for a campaign the kit no longer has, and the references that would help', async () => {
  await call('POST', '/studio/reference', { project: P, name: 'Unscoped approved tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: '' });
  await call('POST', '/engine/fix', { ns: 'mca', task: 'tiles', scope: 'client', wrong: 'x', right: 'Always teal panels', why: 'old campaign', source: 'teach:brand:campaign:retired-campaign' });
  await call('POST', '/studio/asset', { project: P, family: 'Stories', channel: 'instagram', format: '9:16', title: 'Story', copy: { headline: 'x' }, mode: 'composition' });
  const ws = (await call('GET', '/brand/workspace?ns=mca&campaign=hoof', null, 'read-key')).body; const rd = ws.readiness || {};
  const all = [].concat(rd.blocking || [], rd.gaps || [], rd.conflicts || [], rd.outdated || []);
  ok(all.some(g => g.code === 'scope_uncertain' && /Unscoped approved tile/.test(g.text)), 'uncertain scope named: ' + all.map(g => g.code).join(', '));
  ok(all.some(g => g.code === 'rule_outdated' && /retired-campaign/.test(g.text)), 'a rule for a campaign the kit no longer has');
  const want = rd.wanted || []; ok(want.some(x => /Hands Off Our Fuel/.test(x.text) && /9:16/.test(x.text)), 'a 9:16 reference for HOOF is asked for: ' + JSON.stringify(want).slice(0, 400));
  ok(want.every(x => x.why && x.purpose), 'each request says why and for what purpose');
  ok(!/fine-tun/i.test(JSON.stringify(ws)), 'never described as fine-tuning');
});

await T.t('I-W6 the identity audit reads storage: each HOOF wordmark variant with its tone and bytes, a variant whose file is gone reported missing, the client logo named as not carried', async () => {
  const kit = await kitNow(); const black = kit.campaigns.find(c => c.id === 'hoof').wordmarks.find(x => x.variant === 'black');
  await w.env.MIND_DOCS.delete(black.key);
  const au = (await call('GET', '/studio/identity?ns=mca', null, 'read-key')).body; const hoof = (au.campaigns || []).find(c => c.id === 'hoof');
  ok(hoof, 'the HOOF campaign is audited'); eq(hoof.policy, 'wordmark');
  const vs = (hoof.wordmark && hoof.wordmark.variants) || []; const by = n => vs.find(v => v.variant === n) || {};
  eq([by('blue').onFile, by('white').onFile, by('black').onFile], [true, true, false], 'blue and white on file, black recorded but gone: ' + JSON.stringify(vs));
  eq([by('white').tone, by('blue').tone], ['light', 'colour']);
  ok(hoof.wordmark.onFile && hoof.wordmark.bytes > 0, 'the default variant read from storage with its bytes');
  ok(/not carried|never/.test(JSON.stringify(hoof.logo || {}) + JSON.stringify(hoof)) || hoof.logo.carried === false, 'the client logo is named as not carried by HOOF: ' + JSON.stringify(hoof.logo));
});

await T.t('I-W7 what the team recorded reaches the models: the outgoing request carries the record, the dislikes as things to avoid, the corrected reading, the mandatory item, and what was set aside', async () => {
  sent.length = 0;
  await call('POST', '/studio/suggest', { asset: TILE, refresh: true });
  const req = sent.join('\n'); ok(req.length > 0, 'a model request was made');
  ok(/TEAM ON THIS REFERENCE/.test(req), 'the team block is in the request');
  ok(/Record: ran paid, 4:5, on instagram, approved 2026-09-30 by Dee/.test(req), 'the record: ' + (req.match(/Record:[^.]*/) || [''])[0]);
  ok(/disliked \(avoid\): The URL too small to read/.test(req), 'the dislike as something to avoid');
  ok(/corrected by the team\]: Condensed sans, extra bold/.test(req), 'the corrected reading, marked as the team\'s');
  ok(/URL \[mandatory, the team\]: The URL always sits bottom left in white/.test(req), 'the mandatory item with its authority');
  ok(/Set aside by the team \(do not take\): Lead with the photograph, no band/.test(req), 'the superseded observation is named as set aside');
});

T.done(); w.restore();
