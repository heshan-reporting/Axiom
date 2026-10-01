/* Creative Studio P12, strategy and sequence: the creative strategy is drafted as a proposal on the brief, edited and
 * confirmed by the team, and read by every later stage; directions take an exploration budget (one to five, three by
 * default), carry the idea, copy approach, medium, composition, type, colour, references, plan and the images they would
 * need, and are measured for diversity (a look-alike is flagged); a campaign set is planned as an ordered sequence with
 * a role, channel, format, day, purpose and relation to the idea for every asset, made as editable compositions with
 * no image spent; the brief keeps all of it without truncation.
 * Run: node --experimental-sqlite tests/studio-p12-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v, text: async () => String(r2.get(k).v), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const calls = { anth: [], gem: 0 };
const STRATEGY = { problem: 'Voters hear "subsidy" and assume miners get a handout.', audience: { who: 'Regional voters and farmers', now: 'They think the credit is a subsidy for big miners', wanted: 'They see it as a road tax never meant for off-road fuel', insight: 'Farmers pay the same credit; it is their tractor too' }, idea: 'It is your tractor too', proposition: 'Fuel tax credits return a road tax, they are not a subsidy', proof: ['c1', 'c99'], tone: 'plain, regional, unhurried', avoid: ['the word subsidy unless denied'], risks: ['Greens call it a handout'], measures: ['regional comment sentiment turns from handout to tax'], questions: ['Lead with farmers or miners?'] };
const DIR = (t, medium, idea, msg) => ({ title: t, message: msg, insight: 'i', headline: t, opening: 'o', visual: 'v', rationale: 'r', claims: ['c1'], uncertainty: 'u', idea, copyApproach: 'question then answer', medium, composition: 'words left, image right', typography: 'condensed caps', colour: 'teal and gold', references: ['HOOF myth tile'], plan: ['shoot the farmer', 'set the type'], renders: medium === 'typographic' ? 0 : 1 });
let dirMode = 'distinct';
const DIRS = () => ({ directions: dirMode === 'distinct'
  ? [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the credit'), DIR('Road tax returned', 'typographic', 'A tax for roads, returned', 'The tax pays for roads'), DIR('Who pays the bill', 'infographic', 'Follow the litre', 'Each litre carries road tax'), DIR('Paddock voices', 'editorial', 'Farmers say it plainly', 'Farmers explain it'), DIR('Not a cheque', 'collage', 'No cheque in the mail', 'Nobody gets a cheque')]
  : [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the fuel tax credit too'), DIR('Your tractor as well', 'photo-documentary', 'It is your tractor as well', 'Farmers use the fuel tax credit as well'), DIR('Road tax returned', 'typographic', 'A tax for roads, returned', 'The tax pays for roads')] });
const SEQ = { name: 'It is your tractor too', arc: 'From the myth to the farmer to the ask', cadence: 'over five days', items: [
  { order: 2, role: 'proof', channel: 'facebook', format: '1:1', day: 2, purpose: 'show who uses it', relation: 'the farmer as proof', headline: 'Farmers use it too', support: 'The credit covers fuel used off-road.', cta: 'Learn more', caption: 'Who uses it?', alt: 'a farmer', claims: ['c1'] },
  { order: 1, role: 'opener', channel: 'instagram', format: '4:5', day: 0, purpose: 'name the myth', relation: 'sets up the idea', headline: 'Is it a subsidy?', support: 'Let us look at who uses it.', cta: 'See why', caption: 'A myth.', alt: 'a question', claims: [] },
  { order: 3, role: 'call-to-action', channel: 'linkedin', format: '1:1', day: 4, purpose: 'ask for the signature', relation: 'closes the argument', headline: 'Hands off our fuel', support: 'Sign the petition.', cta: 'Sign', caption: 'Sign now.', alt: 'the ask', claims: [] }] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gem++; return new Response('{}', { status: 500 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); const sys = String(body.system || ''); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join(''); calls.anth.push({ sys, user, body });
    const text = /creative strategist/.test(sys) ? JSON.stringify(STRATEGY) : /genuinely different directions/.test(sys) ? JSON.stringify(DIRS()) : /planning a campaign sequence/.test(sys) ? JSON.stringify(SEQ) : /build a claim ledger/.test(sys) ? JSON.stringify({ claims: [{ text: 'Farmers claim the fuel tax credit', passage: 'p1' }] }) : '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body) { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }), env, ctx); let d = null; try { d = await res.json(); } catch (x) {} return { status: res.status, d }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };
const job = async (P, stage, input) => run((await req('POST', '/studio/job', { project: P, stage, input, idem: stage + ':' + Math.random() })).d.job);
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;

console.log('studio-p12-worker harness (strategy, the exploration budget and diversity, the campaign sequence)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Guided HOOF', brief: { objective: 'Answer the subsidy framing', message: 'Not a subsidy', channels: ['instagram', 'facebook', 'linkedin'] } })).d.id;
const S = (await req('POST', '/studio/source', { project: P, kind: 'release', name: 'r', text: 'Farmers claim the fuel tax credit on fuel used off-road. It is not a subsidy, said the council.' })).d.id;
await job(P, 'extract', { source: S });

await t('the strategy is drafted as a proposal on the brief: problem, audience now and wanted, insight, idea, proposition, proof limited to known claims, tone, what to avoid, risks, qualitative measures and open questions', async () => {
  const j = await job(P, 'strategy', { instruction: 'Lead with regional voters' }); eq(j.state, 'done', j.error);
  const s = (await get(P)).brief.strategy;
  eq([s.status, s.source, s.idea], ['proposed', 'ai', 'It is your tractor too']); eq(s.audience.wanted, 'They see it as a road tax never meant for off-road fuel');
  eq(s.proof, ['c1'], 'a claim id the ledger does not hold is dropped'); eq(s.questions, ['Lead with farmers or miners?']);
  ok(/creative strategist/.test(calls.anth[calls.anth.length - 1].sys) && /Lead with regional voters/.test(calls.anth[calls.anth.length - 1].user));
  ok((await get(P)).thread.some(e => e.kind === 'strategy' && /Strategy proposed: It is your tractor too/.test(e.text)));
});

await t('the team edits and confirms the strategy; later stages read the confirmed version as the frame to work within', async () => {
  const g = await get(P); const s = Object.assign({}, g.brief.strategy, { idea: 'It is your tractor too, and your truck', status: 'confirmed', confirmedBy: 'Hesh', source: 'team' });
  const u = await req('POST', '/studio/project/update', { id: P, revision: g.revision, patch: { brief: { strategy: s } } }); eq(u.status, 200, JSON.stringify(u.d));
  const s2 = (await get(P)).brief.strategy; eq([s2.status, s2.idea, s2.source, s2.confirmedBy], ['confirmed', 'It is your tractor too, and your truck', 'team', 'Hesh']);
  await job(P, 'direct', { n: 3 });
  const last = calls.anth.filter(c => /genuinely different directions/.test(c.sys)).pop();
  ok(/CREATIVE STRATEGY \(confirmed by the team - work within it\)/.test(last.user) && /campaign idea: It is your tractor too, and your truck/.test(last.user), 'the directions read the confirmed strategy');
});

await t('directions take an exploration budget of one to five (three by default) and carry the idea, copy approach, medium, composition, type, colour, references, plan and the images they would need; the set is measured for diversity', async () => {
  const before = (await get(P)).directions.length;
  const j = await job(P, 'direct', { n: 5 }); eq(j.state, 'done', j.error);
  const g = await get(P); const fresh = g.directions.slice(before); eq(fresh.length, 5, 'five asked, five kept');
  const d = fresh.find(x => x.title === 'Road tax returned') || fresh[1];
  eq([d.medium, d.renders, d.plan.length > 0, d.references[0]], ['typographic', 0, true, 'HOOF myth tile']);
  ok(typeof j.result.diversity === 'number' && j.result.diversity > 0.6, 'distinct set scores high: ' + j.result.diversity);
  ok(/genuinely different directions/.test(calls.anth[calls.anth.length - 1].sys) && /never only the photograph behind the same panel/.test(calls.anth[calls.anth.length - 1].sys));
  const j3 = await job(P, 'direct', {}); eq((await get(P)).directions.length - before - 5, 3, 'three by default');
  dirMode = 'lookalike'; const jl = await job(P, 'direct', { n: 3 });
  ok(jl.result.similar >= 1 && jl.result.diversity < j.result.diversity, 'a look-alike is flagged and the score drops: ' + JSON.stringify(jl.result));
  ok((await get(P)).thread.some(e => e.kind === 'directions' && /^Diversity 0\.\d+/.test(e.text)));
});

await t('a campaign set is planned as an ordered sequence - role, channel, format, day, purpose, relation to the idea - and made as editable compositions with no image spent', async () => {
  const g0 = await get(P); const dir = g0.directions[0].id; await req('POST', '/studio/direction/choose', { id: dir });
  const gem0 = calls.gem; const before = g0.assets.length;
  const j = await job(P, 'sequence', { channels: ['instagram', 'facebook', 'linkedin'], count: 3, direction: dir }); eq(j.state, 'done', j.error);
  const g = await get(P); const seqAssets = g.assets.slice(before);
  eq(seqAssets.map(a => [a.title, a.channel, a.format, a.family]), [['1. opener - Instagram 4:5', 'instagram', '4:5', 'Sequence: It is your tractor too'], ['2. proof - Facebook 1:1', 'facebook', '1:1', 'Sequence: It is your tractor too'], ['3. call-to-action - LinkedIn 1:1', 'linkedin', '1:1', 'Sequence: It is your tractor too']], 'ordered by the plan, not the order the model wrote them');
  const v = seqAssets[1].versions[0]; eq([v.mode, v.context.role, v.context.order, v.context.of, v.context.day, v.context.relation], ['composition', 'proof', 2, 3, 2, 'the farmer as proof']);
  ok(v.layout && v.layout.layers && v.layout.layers.some(l => l.role === 'headline'), 'an editable composition'); ok(v.checks.length >= 0);
  eq(calls.gem, gem0, 'no image was generated'); eq((await req('GET', '/studio/jobs?project=' + P)).d.jobs.filter(x => x.stage === 'render').length, 0, 'no render queued');
  const seq = g.brief.sequences[0]; eq([seq.name, seq.items.length, seq.direction], ['It is your tractor too', 3, dir]);
  const used = (await req('GET', '/studio/used?asset=' + seqAssets[0].id)).d; ok(used.generatedBy && used.campaign === 'hoof', 'what the Studio used resolves for sequence assets');
  const sq = calls.anth.filter(c => /planning a campaign sequence/.test(c.sys)).pop(); ok(/CHOSEN DIRECTION: /.test(sq.user) && /CREATIVE STRATEGY/.test(sq.user), 'the sequence reads the direction and the strategy');
});

await t('the brief keeps the strategy and the sequences whole (it used to be cut at 12,000 characters)', async () => {
  const g = await get(P); const long = 'x'.repeat(3000);
  const u = await req('POST', '/studio/project/update', { id: P, revision: g.revision, patch: { brief: { objective: long, audience: long, message: long, action: long } } }); eq(u.status, 200);
  const b = (await get(P)).brief; ok(b.strategy && b.strategy.idea && b.sequences.length === 1 && b.objective.length === 1200, 'whole after a long edit');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
