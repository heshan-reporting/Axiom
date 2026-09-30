/* Creative Studio Phase 2: the production journey on the Phase 1 ground - client context, the
 * claim ledger, directions for open briefs, copy adapted per channel with deterministic checks,
 * editable layouts with the exact logo, renders as jobs, export of approved versions only,
 * Opus 5.5 / Sonnet 5.5 by role with adaptive thinking, and the daily budget. Claude and Gemini
 * are stubs that answer by what the prompt asks for and record every request.
 * Run: node --experimental-sqlite tests/studio-p2-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const mkEnv = (over) => Object.assign({
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => (typeof r2.get(k).v === 'string' ? new TextEncoder().encode(r2.get(k).v).buffer : r2.get(k).v), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
}, over || {});
const env = mkEnv();
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const anth = { calls: [], mode: 'ok' }; const calls = { gemini: 0, other: [] };
const RELEASE = 'MEDIA RELEASE - 30 September 2026\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.\n\nMCA Chief Executive Officer Tania Constable said fuel tax credits were not a subsidy. "Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.\n\nThe analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators. Removing it would add costs that pass on to consumers through the prices of goods and services.\n\nENDS';
const LEDGER_ANSWER = { headline: 'Fuel tax credits keep regional Australia moving', spokesperson: { name: 'Tania Constable', title: 'Chief Executive Officer' }, claims: [
  { text: 'mining paid $74 billion in company tax and royalties in 2023-24', value: 74, unit: 'billion', subject: 'company tax and royalties', period: '2023-24', quote: false, passage: 'p3' },
  { text: 'more than any other industry', value: null, unit: '', subject: 'tax ranking', period: '2023-24', quote: false, passage: 'p3' },
  { text: 'Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply', value: null, unit: '', subject: 'fuel tax credit', quote: true, who: 'Tania Constable', passage: 'p4' },
  { text: 'the credit is used by more than 150,000 businesses of all sizes', value: 150000, unit: 'businesses', subject: 'credit users', period: '', quote: false, passage: 'p5' },
  { text: 'the credit is worth $9 billion a year', value: 9, unit: 'billion', subject: 'credit value', period: '', quote: false, passage: 'p5' },
  { text: 'We will fight this to the end', value: null, unit: '', quote: true, who: 'Tania Constable', passage: 'p4' },
], brief: { objective: 'Answer the subsidy framing while the credit is in the news', audience: 'Members, MPs and staffers; the public on Instagram and Facebook', message: 'The credit is not a subsidy: businesses do not pay a road fuel tax on fuel used off-road', deliverables: 'Organic posts for the chosen channels' } };
const DIRECTIONS_ANSWER = { directions: [
  { title: 'The plain ask', message: 'The credit is not a subsidy; it returns a tax that never applied.', insight: 'People who hear subsidy assume a handout.', headline: 'Not a subsidy. A tax that never applied.', opening: 'Fuel tax credits are not a subsidy. Here is why.', visual: 'Restrained documentary photography, no machinery close-ups', rationale: 'Plain language, the correct actor', claims: ['c3', 'c4'], uncertainty: 'The release gives no figure for the credit itself' },
  { title: 'Who it really is', message: 'The credit is used by 150,000 businesses of all sizes.', insight: 'Naming farmers and tradies moves the frame from miners to neighbours.', headline: 'Farmers. Tradies. Tourism operators.', opening: 'Who uses the fuel tax credit? Probably someone you know.', visual: 'A tradie at a rural bowser, early light', rationale: 'Approved usage wording', claims: ['c4', 'c99'], uncertainty: 'Portraits need releases' },
] };
const piecesFor = (sys, user) => {
  const chans = ['linkedin', 'facebook', 'instagram', 'x'].filter(c => new RegExp('- ' + c + ' \\(').test(user));
  return { pieces: chans.map(c => c === 'x' ? { channel: 'x', headline: 'Mining paid $74 million in tax. Fact, not busted.', support: '', cta: '', caption: 'Mining paid $74 million in company tax and royalties in 2023-24, and 250,000 businesses use the credit. It is not a subsidy. Source: ATO. #HandsOffOurFuel #Mining', alt: 'Text tile', visual: 'plain', claims: ['c1'], hashtags: [] }
    : c === 'instagram' ? { channel: 'instagram', headline: 'Fuel tax credits are not a subsidy and never were one, whatever anyone says about it this week', support: 'More than 150,000 businesses use the credit.', cta: 'Hands Off Our Fuel', caption: 'Farmers, tradies and tourism operators: more than 150,000 businesses use the fuel tax credit. Hands Off Our Fuel.', alt: 'Teal panel over a rural bowser', visual: 'A tradie at a rural bowser, early light, no machinery', claims: ['c4'], hashtags: ['HandsOffOurFuel'] }
    : { channel: c, headline: 'Not a subsidy. A tax that never applied.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry. "Businesses do not pay a road fuel tax on fuel used off-road," Ms Constable said. Hands Off Our Fuel.', alt: 'Teal fact panel over a harvester at dusk', visual: 'Harvester at dusk, restrained, no machinery close-ups', claims: ['c1', 'c3'], hashtags: [] }) };
};
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    calls.gemini++;
    if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/models') >= 0) return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body);
    if (anth.mode === '400once' && body.thinking) { anth.mode = 'ok'; return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'thinking: Extra inputs are not permitted' } }), { status: 400 }); }
    if (anth.mode === 'spend') return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'Your credit balance is too low to access the Anthropic API.' } }), { status: 400 });
    const sys = String(body.system || ''); const user = String(body.messages[0].content || '');
    let answer = {};
    if (/build a claim ledger/.test(sys)) answer = LEDGER_ANSWER;
    else if (/genuinely different directions/.test(sys)) answer = DIRECTIONS_ANSWER;
    else if (/producing a coordinated set/.test(sys)) answer = piecesFor(sys, user);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' }), { status: 200 });
  }
  calls.other.push(u);
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key', e = env) {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, e, ctx); let d = null; try { d = await res.json(); } catch (x) { d = null; } return { status: res.status, d, res };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };

console.log('studio-p2-worker harness (Phase 2: the production journey)');
let P = '', S = '';
await t('the client context: kit, approved facts, banned terms and learned rules for this client only, the models by role, the logo on file', async () => {
  const k = await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E', secondary: '#C9A227' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, voice: 'Plain, confident, sourced.', rules: 'Label the answer Fact, never Busted.\nBusinesses buy fuel and claim credits; vehicles never do.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', tone: 'plain and warm' }], facts: [{ text: 'Mining directly employs more than 300,000 Australians', source: 'ABS Labour Force 2025' }], banned: [{ term: 'subsidy', allowNegated: true, use: 'credit', why: 'the opponents word' }, { term: 'busted', use: 'Fact' }], logoB64: PNG, logoMime: 'image/png' });
  eq(k.status, 200, JSON.stringify(k.d).slice(0, 200)); eq(k.d.hasLogo, true);
  await req('GET', '/engine/status?ns=mca');
  db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f_mca','mca','copy','client','more than all other industries combined','more than any other industry','the ATO wording','Write MCA-RULE-ANY-OTHER-INDUSTRY: say more than any other industry, never more than all other industries combined','','pack','Dee',1000,1,0)").run();
  db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f_mca_t','mca','tiles','client','trucks','no machinery','client feedback','MCA-TILE-RULE-NO-TRUCKS: no haul trucks on Hands Off Our Fuel organic tiles','','pack','Dee',1000,1,0)").run();
  db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f_aep','aep','copy','client','fossil gas','natural gas','client wording','AEP-RULE-NATURAL-GAS: say natural gas, never fossil gas','','pack','x',1000,1,0)").run();
  const a = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fuel tax credit spike', brief: {}, idem: 'p2-1' }); P = a.d.id;
  const c = await req('GET', '/studio/context?project=' + P, null, 'read-key'); eq(c.status, 200);
  eq(c.d.client, 'Minerals Council of Australia'); eq(c.d.campaign.id, 'hoof'); eq(c.d.facts.length, 1); eq(c.d.banned.map(b => b.term), ['subsidy', 'busted']); eq(c.d.kit.rules.length, 2); eq(c.d.kit.hasLogo, true);
  eq(c.d.learned.map(f => f.id).sort(), ['f_mca', 'f_mca_t'], 'only this client\'s rules'); eq(c.d.models, { creative: 'claude-opus-5-5', extract: 'claude-sonnet-5-5', image: 'gemini-3-pro-image at 2K' });
  const m = await req('GET', '/studio/models', null, 'read-key'); eq(m.d.configured.creative, 'claude-opus-5-5'); eq(m.d.configured.extract, 'claude-sonnet-5-5'); eq(m.d.configured.creativeSet, false);
});
await t('extract: the ledger ties every figure and quotation to its passage, marks what the source does not carry, keeps the rule pass figures, and proposes a brief with its assumptions marked', async () => {
  const s = await req('POST', '/studio/source', { project: P, kind: 'release', name: 'MCA release.txt', text: RELEASE }); S = s.d.id; eq(s.d.passages, 6);
  eq((await req('POST', '/studio/job', { project: P, stage: 'extract', input: {} })).d.error, 'source_required');
  const j = await req('POST', '/studio/job', { project: P, stage: 'extract', input: { source: S }, idem: 'x1' }); eq(j.status, 200);
  const done = await run(j.d.job); eq(done.state, 'done', done.error); eq(done.result.model, 'claude-sonnet-5-5'); eq(done.result.unverified, 2); ok(done.result.figures >= 2);
  const body = anth.calls[anth.calls.length - 1]; eq(body.model, 'claude-sonnet-5-5'); eq(body.thinking, { type: 'adaptive' }); eq(body.output_config, { effort: 'low' });
  const g = await req('GET', '/studio/get?id=' + P); const cl = g.d.sources[0].claims;
  const bn = cl.find(c => c.value === 74); ok(bn && bn.unit === 'billion' && bn.period === '2023-24' && bn.passage === 'p3' && bn.verified === true, JSON.stringify(bn));
  const q = cl.find(c => c.quote && /road fuel tax/.test(c.text)); ok(q && q.verbatim === true && q.passage === 'p4' && q.who === 'Tania Constable', JSON.stringify(q));
  const bad = cl.find(c => c.value === 9); ok(bad && bad.verified === false && /not in the source/.test(bad.note), JSON.stringify(bad));
  const fake = cl.find(c => /fight this to the end/.test(c.text)); ok(fake && fake.verbatim === false, 'a quotation the source does not carry is marked');
  ok(cl.find(c => c.value === 150000 && c.unit === 'businesses' && c.verified), '150,000 businesses');
  ok(cl.every((c, i) => c.id === 'c' + (i + 1)), 'ids renumbered');
  eq(g.d.brief.objective, 'Answer the subsidy framing while the credit is in the news'); ok(g.d.brief.assumptions.some(a => /proposed from the source by the Studio/.test(a)), JSON.stringify(g.d.brief.assumptions)); eq(g.d.brief.proposed, ['objective', 'audience', 'message', 'deliverables']);
  ok(g.d.thread.some(e => /Read MCA release\.txt: .* figures, .* quotations/.test(e.text) && /marked unverified/.test(e.text)), JSON.stringify(g.d.thread.slice(-1)));
  ok(done.progress.lines.some(l => l.kind === 'cmd' && /claude claude-sonnet-5-5/.test(l.text)), 'the job log names the model');
});
await t('directions: an open brief gets two distinct directions on the creative model with adaptive thinking; claims outside the ledger are dropped; the client\'s rules are in the prompt and no other client\'s', async () => {
  const j = await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 2, channels: ['linkedin'] }, idem: 'd1' });
  const done = await run(j.d.job); eq(done.state, 'done', done.error); eq(done.result.titles, ['The plain ask', 'Who it really is']); eq(done.result.similar, 0); eq(done.result.model, 'claude-opus-5-5');
  const body = anth.calls[anth.calls.length - 1]; eq(body.model, 'claude-opus-5-5'); eq(body.thinking, { type: 'adaptive' }); eq(body.output_config, { effort: 'medium' });
  ok(/MCA-RULE-ANY-OTHER-INDUSTRY/.test(body.system) && /Label the answer Fact/.test(body.system) && /NEVER USE these words/.test(body.system) && /"busted"/.test(body.system), 'the kit rules, banned terms and learned corrections are in the prompt');
  ok(!/AEP-RULE/.test(body.system), 'another client\'s rule is absent');
  ok(/\[c1\]/.test(body.messages[0].content) && /\[UNVERIFIED\]/.test(body.messages[0].content), 'the ledger goes in with unverified rows marked');
  const g = await req('GET', '/studio/get?id=' + P); eq(g.d.status, 'directions'); eq(g.d.directions.length, 2); eq(g.d.directions.map(d => d.chosen), [false, false]);
  eq(g.d.directions[1].claims, ['c4'], 'c99 is not in the ledger and was dropped'); eq(g.d.assets, [], 'nothing produced before a choice');
  eq((await req('POST', '/studio/direction/choose', { id: g.d.directions[0].id })).status, 200);
});
let SET = null;
await t('copy-only work from a clear instruction: no direction step needed, assets are usable copy, no render is queued or spent, and the checks read figures, units, quotations, banned terms and hashtags against the ledger and the kit', async () => {
  const before = calls.gemini;
  eq((await req('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['tiktok'] } })).d.error, 'channels_required');
  const j = await req('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['linkedin', 'x'], deliverable: 'copy', instruction: 'Two posts on the $74 billion figure in the HOOF voice' }, idem: 'c1' });
  const done = await run(j.d.job); eq(done.state, 'done', done.error); eq(done.result.assets.length, 2); eq(done.result.renders, []); eq(done.result.deliverable, 'copy'); eq(done.result.template, '');
  eq(calls.gemini, before, 'no image model call');
  const body = anth.calls[anth.calls.length - 1]; ok(/copy-only work/.test(body.system)); ok(/CHOSEN DIRECTION: The plain ask/.test(body.messages[0].content)); ok(/INSTRUCTION: Two posts/.test(body.messages[0].content));
  const g = await req('GET', '/studio/get?id=' + P); eq(g.d.status, 'production'); eq(g.d.assets.length, 2);
  const li = g.d.assets.find(a => a.channel === 'linkedin'); const x = g.d.assets.find(a => a.channel === 'x');
  eq(li.versions[0].mode, 'copy'); eq(li.versions[0].layout, {}); eq(li.versions[0].image, null); eq(li.family, 'Copy'); eq(li.title, 'LinkedIn copy');
  const lc = li.versions[0].checks; ok(lc.some(c => c.state === 'matches' && /\$74 billion/.test(c.text) && /p3/.test(c.note)), JSON.stringify(lc)); ok(lc.some(c => c.state === 'matches' && /Businesses do not pay/.test(c.text) && /exact quotation/.test(c.note)), 'the quotation matches'); ok(!lc.some(c => c.state === 'banned'), '"not a subsidy" is a negation, allowed');
  const xc = x.versions[0].checks;
  ok(xc.some(c => c.state === 'differs' && /\$74 million/.test(c.text) && /unit differs: the source says 74 billion/.test(c.note)), JSON.stringify(xc));
  ok(xc.some(c => c.state === 'differs' && /250,000 businesses/.test(c.text) && /value differs: the source says 150,000 businesses/.test(c.note)), JSON.stringify(xc));
  ok(xc.some(c => c.state === 'banned' && c.text === 'busted' && /say "Fact"/.test(c.note)), JSON.stringify(xc));
  ok(xc.some(c => c.state === 'too_many_hashtags'), JSON.stringify(xc));
  ok(li.versions[0].context.rules.copy.indexOf('f_mca') >= 0 && li.versions[0].context.model === 'claude-opus-5-5' && li.versions[0].context.facts === 1, 'the context snapshot is on the version: ' + JSON.stringify(li.versions[0].context));
  ok(g.d.thread.some(e => /Produced 2 assets: LinkedIn 1:1, X 16:9/.test(e.text) && /Copy only: no render spent/.test(e.text)), JSON.stringify(g.d.thread.slice(-1)));
});
await t('a campaign set: editable compositions in the campaign template with the exact kit logo, the overflow check at 9:16, one render job per asset queued by idempotent key', async () => {
  const j = await req('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram', 'facebook'], deliverable: 'set', formats: { instagram: '9:16' } }, idem: 'c2' });
  const done = await run(j.d.job); eq(done.state, 'done', done.error); eq(done.result.assets.length, 2); eq(done.result.renders.length, 2); eq(done.result.template, 'teal');
  const g = await req('GET', '/studio/get?id=' + P); SET = g.d.assets.filter(a => a.family === 'Campaign set'); eq(SET.length, 2);
  const ig = SET.find(a => a.channel === 'instagram'), fb = SET.find(a => a.channel === 'facebook'); eq(ig.format, '9:16'); eq(ig.title, 'Instagram story'); eq(fb.format, '1:1');
  const v = ig.versions[0]; eq(v.mode, 'composition'); eq(v.layout.template, 'teal'); eq(v.layout.stage, { w: 1080, h: 1920 }); eq(v.layout.fonts.display, 'Bricolage Grotesque');
  const logo = v.layout.layers.find(l => l.role === 'logo'); ok(logo && logo.exact === true && logo.src === '/brand/logo?ns=mca' && logo.type === 'img', 'the logo is an exact image layer from the kit: ' + JSON.stringify(logo));
  ok(v.layout.layers.find(l => l.role === 'panel').fill === '#0E6A6E', 'teal panel');
  ok(v.layout.layers.find(l => l.role === 'headline').text === v.copy.headline, 'the headline layer carries the copy');
  ok(v.checks.some(c => c.state === 'overflow' && /needs \d+ lines/.test(c.note) && /9:16/.test(c.note)), 'the long headline overflows at 9:16: ' + JSON.stringify(v.checks));
  ok(!fb.versions[0].checks.some(c => c.state === 'overflow'), 'the short headline fits at 1:1');
  const jobs = (await req('GET', '/studio/jobs?project=' + P)).d.jobs.filter(x => x.stage === 'render'); eq(jobs.length, 2); ok(jobs.every(x => x.state === 'queued' && /^render:a/.test(x.idem) && /no text, letters, numbers, logos/i.test(x.input.prompt) && /MCA-TILE-RULE-NO-TRUCKS/.test(x.input.prompt)), JSON.stringify(jobs.map(x => [x.state, x.idem])));
  eq(jobs.find(x => x.asset === ig.id).input.aspect, '9:16');
  ok(g.d.thread.some(e => /editable teal fact panels with the kit logo placed exactly; 2 background renders queued as jobs/.test(e.text)), JSON.stringify(g.d.thread.slice(-1)));
});
await t('a render fills the background as a version; a headline edit then changes the preview and export text without an image-model call, keeps the image, recomputes the checks', async () => {
  const fb = SET.find(a => a.channel === 'facebook');
  const job = (await req('GET', '/studio/jobs?project=' + P)).d.jobs.find(x => x.stage === 'render' && x.asset === fb.id);
  const before = calls.gemini; const done = await run(job); eq(done.state, 'done', done.error); eq(calls.gemini, before + 1);
  let g = await req('GET', '/studio/get?id=' + P); let a = g.d.assets.find(x => x.id === fb.id); eq(a.versions.length, 2); const img = a.versions[1].image; ok(img && /^studio\//.test(img.key) && img.model === 'gemini-3-pro-image');
  eq(a.versions[1].checks.length, a.versions[0].checks.length, 'a render carries the checks forward'); eq(a.versions[1].layout.template, 'teal', 'and the layout');
  const e = await req('POST', '/studio/version', { asset: fb.id, revision: a.revision, copy: { headline: 'Fuel tax credits are not a subsidy and never were one, whatever anyone says about it' }, note: 'sharper' }); eq(e.status, 200, JSON.stringify(e.d).slice(0, 200));
  eq(calls.gemini, before + 1, 'no render spent on a text change'); eq(e.d.version.image.key, img.key, 'same image'); eq(e.d.version.kind, 'text');
  ok(e.d.version.checks.some(c => c.state === 'overflow'), 'the checks were recomputed for the new headline: ' + JSON.stringify(e.d.version.checks));
  ok(!e.d.version.checks.some(c => c.state === 'banned'), '"not a subsidy" stays allowed');
  g = await req('GET', '/studio/get?id=' + P); a = g.d.assets.find(x => x.id === fb.id); eq(a.versions.length, 3); eq(a.current, e.d.version.id);
  ok(g.d.thread.some(x => /Text change on Facebook post: sharper \(no render\)/.test(x.text)));
});
await t('namespaces stay walls in the prompt: an AEP project sees AEP\'s rule and none of MCA\'s facts, banned terms or corrections', async () => {
  const a = await req('POST', '/studio/project', { ns: 'aep', title: 'Gas supply', brief: { objective: 'east coast supply' } });
  const j = await req('POST', '/studio/job', { project: a.d.id, stage: 'copy', input: { channels: ['linkedin'], deliverable: 'copy' } }); const done = await run(j.d.job); eq(done.state, 'done', done.error);
  const body = anth.calls[anth.calls.length - 1]; ok(/AEP-RULE-NATURAL-GAS/.test(body.system)); ok(!/MCA-RULE|Label the answer Fact|"busted"|300,000 Australians|Hands Off Our Fuel/.test(body.system), 'nothing of MCA in the AEP prompt');
  const g = await req('GET', '/studio/get?id=' + a.d.id); eq(g.d.assets[0].versions[0].context.facts, 0);
  ok(g.d.assets[0].versions[0].checks.some(c => c.state === 'unsupported' && /\$74 billion/.test(c.text)), 'the MCA figure is unsupported in the AEP project: ' + JSON.stringify(g.d.assets[0].versions[0].checks));
});
await t('the daily budget stops a stage with the reason and no retry; an account spend limit is reported, not retried; the count is on /studio/status', async () => {
  const st = await req('GET', '/studio/status', null, 'read-key'); ok(st.d.budget.used >= 5 && st.d.budget.cap === 200, JSON.stringify(st.d.budget)); eq(st.d.phase, 2);
  const e2 = mkEnv({ STUDIO_DAILY_CALLS: '2', MIND_DB: env.MIND_DB });
  const j = await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 2 }, idem: 'budget' }, 'full-key', e2);
  const s = (await req('POST', '/studio/job/step', { id: j.d.job.id }, 'full-key', e2)).d.job; eq(s.state, 'failed', s.error); eq(s.attempts, 1); ok(/budget_exhausted: \d+ of 2 Studio model calls used today/.test(s.error) && !/will retry/.test(s.error), s.error);
  anth.mode = 'spend';
  const k = await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 2 }, idem: 'spend' });
  const s2 = (await req('POST', '/studio/job/step', { id: k.d.job.id })).d.job; eq(s2.state, 'failed'); ok(/account_limit: Your credit balance/.test(s2.error) && !/will retry/.test(s2.error), s2.error);
  anth.mode = 'ok';
});
await t('a deployment that refuses the thinking fields gets the same call again plain, and the stage completes', async () => {
  anth.mode = '400once'; const n0 = anth.calls.length;
  const j = await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 2 }, idem: 'plain' }); const done = await run(j.d.job); eq(done.state, 'done', done.error);
  eq(anth.calls.length, n0 + 2); ok(anth.calls[n0].thinking && !anth.calls[n0 + 1].thinking && !anth.calls[n0 + 1].output_config, 'second request is plain');
  ok(done.progress.lines.some(l => /refused the thinking\/effort fields/.test(l.text)), 'the log says so');
});
await t('export takes exactly the approved versions: an unapproved asset is left out with the reason, the manifest and copy sheet land in R2, the browser\'s composition PNG is referenced, and nothing is sent anywhere', async () => {
  const fb = SET.find(a => a.channel === 'facebook'); const ig = SET.find(a => a.channel === 'instagram');
  const other = calls.other.length;
  await req('POST', '/studio/approve', { asset: fb.id, part: 'copy', decision: 'approve', reason: 'client asked for the plain ask' });
  await req('POST', '/studio/approve', { asset: fb.id, part: 'design', decision: 'approve', reason: 'fine' });
  let g = await req('GET', '/studio/get?id=' + P); const cur = g.d.assets.find(x => x.id === fb.id).current;
  const sv = await req('POST', '/studio/render/save', { asset: fb.id, version: cur, imageB64: PNG, mime: 'image/png' }); eq(sv.status, 200, JSON.stringify(sv.d)); ok(/-export\.png$/.test(sv.d.key)); ok(r2.has(sv.d.key));
  eq((await req('POST', '/studio/render/save', { asset: fb.id, version: 'v_nope', imageB64: PNG })).status, 404);
  const j = await req('POST', '/studio/job', { project: P, stage: 'export', input: {}, idem: 'e1' }); const done = await run(j.d.job); eq(done.state, 'done', done.error);
  eq(done.result.included.length, 1); eq(done.result.included[0].asset, fb.id); eq(done.result.included[0].version, cur); eq(done.result.included[0].exportKey, sv.d.key);
  ok(done.result.excluded.some(x => x.asset === ig.id && /copy and design not approved/.test(x.why)), JSON.stringify(done.result.excluded));
  ok(done.result.excluded.some(x => /LinkedIn copy/.test(x.title) && /copy not approved/.test(x.why)), 'copy-only assets need copy approval only');
  ok(r2.has(done.result.files.manifest) && r2.has(done.result.files.copySheet));
  const man = JSON.parse(r2.get(done.result.files.manifest).v); eq(man.assets.length, 1); eq(man.assets[0].approvals.copy.reason, 'client asked for the plain ask'); ok(/created no task and sent nothing/.test(man.note));
  ok(/COPY SHEET - Fuel tax credit spike/.test(done.result.sheet) && /HEADLINE: Fuel tax credits are not a subsidy/.test(done.result.sheet) && /CHECKS: .*overflow/.test(done.result.sheet), done.result.sheet.slice(0, 400));
  const f = await req('GET', '/studio/file?key=' + encodeURIComponent(done.result.files.copySheet), null, 'read-key'); eq(f.status, 200); ok(/text\/plain/.test(f.res.headers.get('content-type')));
  eq(calls.other.length, other, 'no call left the worker (no ClickUp, no Slack)');
  g = await req('GET', '/studio/get?id=' + P); ok(g.d.thread.some(e => /Export e.*: 1 approved asset, 3 not approved and left out/.test(e.text) && /Nothing was sent/.test(e.text)), JSON.stringify(g.d.thread.slice(-1)));
  eq((await req('POST', '/studio/job', { project: P, stage: 'export' }, 'read-key')).status, 403, 'export is a write');
});
await t('without a Claude key the ledger is still built by rule, the job says so, and the copy stage names the missing key without retrying', async () => {
  const e3 = mkEnv({ ANTHROPIC_API_KEY: undefined, MIND_DB: env.MIND_DB });
  const a = await req('POST', '/studio/project', { ns: 'mca', title: 'No key' }, 'full-key', e3); const s = await req('POST', '/studio/source', { project: a.d.id, text: RELEASE }, 'full-key', e3);
  const j = await req('POST', '/studio/job', { project: a.d.id, stage: 'extract', input: { source: s.d.id } }, 'full-key', e3);
  const d = (await req('POST', '/studio/job/step', { id: j.d.job.id }, 'full-key', e3)).d.job; eq(d.state, 'done', d.error); eq(d.result.model, 'rules'); ok(d.result.figures >= 2 && d.result.quotes >= 1); eq(d.result.proposed, []);
  ok(d.progress.lines.some(l => /ANTHROPIC_API_KEY is not set/.test(l.text)));
  const k = await req('POST', '/studio/job', { project: a.d.id, stage: 'copy', input: { channels: ['linkedin'] } }, 'full-key', e3);
  const d2 = (await req('POST', '/studio/job/step', { id: k.d.job.id }, 'full-key', e3)).d.job; eq(d2.state, 'failed'); ok(/claude_not_configured/.test(d2.error) && !/will retry/.test(d2.error), d2.error);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
