/* Creative Studio Phase 3: direction by instruction. A direction on an asset, a family or the set is read by the
 * creative model and answered as a text change (versions, no render), alternatives (offered, not applied), a render
 * (proposed, run only on confirmation), an adaptation (new assets that reuse the image), a layout change or a
 * question; an ambiguous pronoun aimed at the set is asked about before any model call; a standing preference is
 * offered and saved only on an answer - as a campaign preference read by that campaign's projects alone, or a
 * lasting client rule; approvals and rejections file WIN/LOSS exemplars.
 * Run: node --experimental-sqlite tests/studio-p3-worker.mjs */
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
const ids = user => Array.from(user.matchAll(/^\[(a[a-z0-9]+)\]/gm)).map(m => m[1]);
function decide(sys, user) {
  const ins = (user.match(/TEAM LEAD[^\n]*\):\n([^\n]+)/) || [])[1] || ''; const A = ids(user);
  if (/three alternative|options/i.test(ins)) return { kind: 'alternatives', reply: 'Three openings for the caption, each within the channel limit.', alternatives: { asset: A[0], field: 'caption', options: ['Who uses the fuel tax credit? Probably someone you know. Hands Off Our Fuel.', 'Mining paid $74 billion in company tax and royalties in 2023-24. Hands Off Our Fuel.', 'Mining paid $74 million in tax. Hands Off Our Fuel.'] }, memory: { standing: false } };
  if (/restrained|calmer|new photo/i.test(ins)) return { kind: 'render', reply: 'A quieter photograph reads better under the panel.', render: { assets: [A[0]], visual: 'A quiet regional road at dusk, no machinery, soft light', steps: ['Simplify the background: fewer elements, softer light', 'Keep the teal panel, headline and logo as they are'] }, memory: { standing: /no truck/i.test(ins), rule: 'No haul trucks in Hands Off Our Fuel imagery.', scope: 'campaign', confidence: 0.9 } };
  if (/adapt/i.test(ins)) return { kind: 'adapt', reply: 'Adapted for Instagram story and X: same argument, shorter captions.', adapt: { from: A[0], pieces: [{ channel: 'instagram', format: '9:16', copy: { caption: 'Farmers, tradies and tourism operators use the credit. Hands Off Our Fuel. #HandsOffOurFuel' } }, { channel: 'x', format: '16:9', copy: { caption: 'Fuel tax credits are not a subsidy. Businesses do not pay a road fuel tax on fuel used off-road. Hands Off Our Fuel.' } }] }, memory: { standing: false } };
  if (/bigger headline|larger headline/i.test(ins)) return { kind: 'layout', reply: 'Headline one step larger.', layout: { assets: [A[0]], headlineSize: 'larger' }, memory: { standing: false } };
  if (/always|never/i.test(ins)) return { kind: 'text', reply: 'Changed the caption to write per cent in words.', changes: [{ asset: A[0], copy: { caption: 'Mining paid 30 per cent of all company tax in 2023-24. Hands Off Our Fuel.' }, note: 'per cent in words' }], memory: { standing: true, rule: 'Write per cent in words in body copy, never the % sign.', scope: 'campaign', confidence: 0.92 } };
  if (/unclear|which/i.test(ins)) return { kind: 'question', reply: '', question: 'Do you mean the headline on the tile or the first line of the caption?', memory: { standing: false } };
  return { kind: 'text', reply: 'Headline sharpened on ' + A[0] + '; layout and image kept.', changes: [{ asset: A[0], copy: { headline: /still/i.test(ins) ? 'Not a subsidy. Full stop.' : 'Not a subsidy. Never was.' }, note: 'sharper headline' }], memory: { standing: false } };
}
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gemini++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body);
    const sys = String(body.system || ''), user = String(body.messages[0].content || '');
    const answer = /decide what the instruction asks/.test(sys) ? decide(sys, user) : {};
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' }), { status: 200 });
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
const db = env.MIND_DB.db;
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };
const direct = async (P, input) => { const j = await req('POST', '/studio/job', { project: P, stage: 'revise', input, idem: 'rv:' + Math.random() }); if (!j.d.job) throw new Error(JSON.stringify(j.d)); return run(j.d.job); };
const events = async (P, kind) => (await req('GET', '/studio/get?id=' + P)).d.thread.filter(e => !kind || e.kind === kind);

console.log('studio-p3-worker harness (Phase 3: direction by instruction)');
let P = '', A = '', B = '';
await t('setup: a kit with a campaign, a project with two compositions', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }], facts: [{ text: 'Mining paid 30 per cent of all company tax in 2023-24', source: 'ATO' }, { text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'ATO' }], banned: [{ term: 'subsidy', allowNegated: true }], logoB64: PNG, logoMime: 'image/png' });
  const p = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Direction test', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy' } }); P = p.d.id;
  const a = await req('POST', '/studio/asset', { project: P, family: 'Campaign set', channel: 'linkedin', format: '1:1', title: 'LinkedIn post', copy: { headline: 'Fuel tax credits are not a subsidy.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24. Hands Off Our Fuel.', alt: 'tile' }, image: { key: 'studio/x/y/bg1.png', url: '/studio/file?key=studio%2Fx%2Fy%2Fbg1.png', model: 'gemini-3-pro-image', size: '2K' }, mode: 'composition' }); A = a.d.asset.id;
  const b = await req('POST', '/studio/asset', { project: P, family: 'Campaign set', channel: 'facebook', format: '1:1', title: 'Facebook post', copy: { headline: 'Hands off our fuel.', caption: 'Businesses of all sizes use the credit.' }, image: { key: 'studio/x/y/bg2.png', url: '', model: 'gemini-3-pro-image', size: '2K' }, mode: 'composition' }); B = b.d.asset.id;
  ok(a.d.asset.versions[0].layout.layers.some(l => l.role === 'logo'), 'the asset route lays the composition out with the kit logo');
});
await t('"keep this layout but sharpen the headline" is a text change: new version, same image, no render spent; the reply says so; a locked headline is kept and named', async () => {
  const g0 = calls.gemini; const n0 = anth.calls.length;
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Keep this layout but make the headline sharper' });
  eq(j.state, 'done', j.error); eq(j.result.kind, 'text'); eq(j.result.changed, [A]); eq(calls.gemini, g0); eq(anth.calls.length, n0 + 1);
  const body = anth.calls[anth.calls.length - 1]; eq(body.model, 'claude-opus-5-5'); ok(/\[' + A + '\]/.test(body.messages[0].content) || body.messages[0].content.indexOf('[' + A + ']') >= 0, 'the asset is described to the model'); ok(!(body.messages[0].content.indexOf('[' + B + ']') >= 0), 'the other asset is not in scope');
  const g = await req('GET', '/studio/get?id=' + P); const a = g.d.assets.find(x => x.id === A); eq(a.versions.length, 2); eq(a.versions[1].copy.headline, 'Not a subsidy. Never was.'); eq(a.versions[1].image.key, 'studio/x/y/bg1.png'); eq(a.versions[1].kind, 'text'); eq(a.versions[1].copy.caption, a.versions[0].copy.caption, 'unchanged fields carry over');
  const ev = (await events(P, 'revise')).pop(); ok(/Text change only: 1 asset at a new version, image kept, no render spent/.test(ev.text), ev.text); eq(ev.render, false); eq(ev.changed, [A]);
  await req('POST', '/studio/lock', { asset: A, element: 'headline' });
  const j2 = await direct(P, { target: 'asset', asset: A, instruction: 'Make the headline sharper still' }); eq(j2.state, 'done', j2.error); eq(j2.result.changed, []); eq(j2.result.kept, ['LinkedIn post/headline']);
  const ev2 = (await events(P, 'revise')).pop(); ok(/Kept locked: LinkedIn post\/headline/.test(ev2.text), ev2.text);
  eq((await req('GET', '/studio/get?id=' + P)).d.assets.find(x => x.id === A).versions.length, 2, 'no version written for a locked field');
  await req('POST', '/studio/lock', { asset: A, element: 'headline', locked: false });
});
await t('alternatives are offered beside the field with their checks, not applied; choosing one is an ordinary text version', async () => {
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Give me three alternative opening lines' }); eq(j.state, 'done', j.error); eq(j.result.kind, 'alternatives'); eq(j.result.field, 'caption'); eq(j.result.options.length, 3);
  const ev = (await events(P, 'alternatives')).pop(); eq(ev.asset, A); eq(ev.checks[2], ['differs'], 'the $74 million option is flagged as differing from the source: ' + JSON.stringify(ev.checks)); eq(ev.checks[1], []);
  const before = (await req('GET', '/studio/get?id=' + P)).d.assets.find(x => x.id === A); eq(before.versions.length, 2, 'nothing applied');
  const v = await req('POST', '/studio/version', { asset: A, revision: before.revision, copy: { caption: ev.options[0] }, note: 'chose an alternative caption' }); eq(v.status, 200); eq(v.d.version.copy.caption, ev.options[0]);
});
await t('"more restrained visual" is proposed, not run; confirming queues one render per asset by idempotent key; a second answer is refused; the render then lands as a version', async () => {
  const g0 = calls.gemini;
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Make the visual more restrained' }); eq(j.state, 'done', j.error); eq(j.result.kind, 'render'); eq(j.result.assets, [A]);
  const ev = (await events(P, 'proposal')).pop(); ok(/needs a new image, not a text change/.test(ev.text) && /Confirm and it runs as one render per asset/.test(ev.text), ev.text); eq(ev.steps.length, 2); eq(ev.render, true);
  eq(calls.gemini, g0, 'nothing spent'); eq((await req('GET', '/studio/jobs?project=' + P)).d.jobs.filter(x => x.stage === 'render').length, 0);
  eq((await req('POST', '/studio/proposal', { project: P, eid: ev.eid, decision: 'do' }, 'read-key')).status, 403);
  const d = await req('POST', '/studio/proposal', { project: P, eid: ev.eid, decision: 'do' }); eq(d.status, 200, JSON.stringify(d.d)); eq(d.d.jobs.length, 1);
  const job = (await req('GET', '/studio/job?id=' + d.d.jobs[0])).d.job; eq(job.stage, 'render'); eq(job.idem, 'render:' + ev.eid + ':' + A); ok(/quiet regional road at dusk/.test(job.input.prompt) && /no text, letters, numbers, logos/i.test(job.input.prompt), job.input.prompt);
  eq((await req('POST', '/studio/proposal', { project: P, eid: ev.eid, decision: 'do' })).status, 409, 'answered once');
  ok((await events(P, 'decided')).pop().text.indexOf('1 render queued') >= 0);
  const done = await run(job); eq(done.state, 'done', done.error); eq(calls.gemini, g0 + 1);
  const a = (await req('GET', '/studio/get?id=' + P)).d.assets.find(x => x.id === A); ok(a.versions[a.versions.length - 1].image.key !== 'studio/x/y/bg1.png', 'a new background'); eq(a.versions[a.versions.length - 1].copy.headline, 'Not a subsidy. Never was.', 'text kept');
  const dj = await req('POST', '/studio/proposal', { project: P, eid: 'e_nope', decision: 'do' }); eq(dj.status, 404);
});
await t('adapt to other channels makes new assets in the family that reuse the image and carry the locks; no render spent', async () => {
  await req('POST', '/studio/lock', { asset: A, element: 'cta' });
  const g0 = calls.gemini; const n = (await req('GET', '/studio/get?id=' + P)).d.assets.length;
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Adapt this for an Instagram story and X' }); eq(j.state, 'done', j.error); eq(j.result.kind, 'adapt'); eq(j.result.changed.length, 2); eq(calls.gemini, g0);
  const g = await req('GET', '/studio/get?id=' + P); eq(g.d.assets.length, n + 2);
  const ig = g.d.assets.find(x => x.channel === 'instagram'), x = g.d.assets.find(x => x.channel === 'x');
  eq([ig.family, ig.format, ig.title], ['Campaign set', '9:16', 'Instagram story']); eq([x.format, x.title], ['16:9', 'X landscape']);
  const src = g.d.assets.find(a => a.id === A); const sv = src.versions[src.versions.length - 1];
  eq(ig.versions[0].image.key, sv.image.key, 'the image is reused'); eq(ig.versions[0].copy.headline, sv.copy.headline, 'the headline carries'); ok(/#HandsOffOurFuel/.test(ig.versions[0].copy.caption)); eq(ig.versions[0].layout.stage, { w: 1080, h: 1920 }); eq(ig.locks, { cta: true }, 'locks carried');
  ok(ig.versions[0].context.adaptedFrom.indexOf(A) === 0);
  ok((await events(P, 'adapted')).pop().text.indexOf('image reused, so no render was spent') >= 0);
  await req('POST', '/studio/lock', { asset: A, element: 'cta', locked: false });
});
await t('a layout direction changes the headline size as a layout version; a question comes back as a question; an ambiguous "this" aimed at the set is asked about before any model call', async () => {
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Bigger headline please' }); eq(j.state, 'done', j.error); eq(j.result.kind, 'layout'); eq(j.result.changed, [A]);
  const a = (await req('GET', '/studio/get?id=' + P)).d.assets.find(x => x.id === A); const last = a.versions[a.versions.length - 1]; eq(last.kind, 'layout'); ok(last.layout.layers.find(l => l.role === 'headline').size > a.versions[a.versions.length - 2].layout.layers.find(l => l.role === 'headline').size);
  const q = await direct(P, { target: 'asset', asset: A, instruction: 'It is unclear which line you mean' }); eq(q.state, 'done'); eq(q.result.kind, 'question'); ok(/headline on the tile or the first line/.test((await events(P, 'question')).pop().text));
  const n0 = anth.calls.length;
  const s = await direct(P, { target: 'set', instruction: 'Make this shorter' }); eq(s.state, 'done'); eq(s.result.kind, 'question'); eq(anth.calls.length, n0, 'no model call for an ambiguous pronoun');
  ok(/Which asset do you mean\?/.test((await events(P, 'question')).pop().text));
  const all = await direct(P, { target: 'set', instruction: 'Sharpen all the headlines' }); eq(all.state, 'done', all.error); ok(all.result.kind === 'text');
});
await t('a standing preference is offered, never saved on its own; "campaign" saves a rule only that campaign\'s projects read; "none" records the decline; a lasting rule reaches every project of the client', async () => {
  const j = await direct(P, { target: 'asset', asset: A, instruction: 'Always write per cent in words, never the % sign' }); eq(j.state, 'done', j.error); eq(j.result.offer, true);
  const ev = (await events(P, 'revise')).pop(); ok(ev.offer && /per cent in words/.test(ev.offer.rule) && ev.offer.scope === 'campaign' && ev.offer.campaign === 'hoof' && ev.offer.task === 'copy', JSON.stringify(ev.offer));
  eq(db.prepare("SELECT COUNT(*) n FROM engine_fixes WHERE ns='mca'").get().n, 0, 'nothing saved yet');
  const r = await req('POST', '/studio/remember', { project: P, eid: ev.eid, scope: 'campaign', rule: 'Write per cent in words in body copy, never the % sign.', task: 'copy' }); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.saved, true); eq(r.d.campaign, 'hoof');
  const fx = db.prepare("SELECT * FROM engine_fixes WHERE id=?").get(r.d.fix); eq(fx.source, 'studio:' + P + ':campaign:hoof'); eq(fx.task, 'copy'); eq(fx.active, 1);
  ok(/Saved as a campaign preference for hoof/.test((await events(P, 'remembered')).pop().text));
  const c1 = await req('GET', '/studio/context?project=' + P); ok(c1.d.learned.some(f => f.id === r.d.fix && f.scope === 'campaign' && f.campaign === 'hoof'), JSON.stringify(c1.d.learned));
  const other = await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National' }); const c2 = await req('GET', '/studio/context?project=' + other.d.id); ok(!c2.d.learned.some(f => f.id === r.d.fix), 'another campaign does not read it');
  const noc = await req('POST', '/studio/project', { ns: 'mca', title: 'No campaign' }); ok(!(await req('GET', '/studio/context?project=' + noc.d.id)).d.learned.some(f => f.id === r.d.fix), 'a project without a campaign does not read it');
  // the prompt itself: a direction on the national project must not carry the HOOF rule; on the HOOF project it must
  const na = await req('POST', '/studio/asset', { project: other.d.id, title: 'x', copy: { headline: 'h' } }); await direct(other.d.id, { target: 'asset', asset: na.d.asset.id, instruction: 'sharper' });
  ok(!/per cent in words in body copy/.test(anth.calls[anth.calls.length - 1].system), 'national prompt has no HOOF rule');
  await direct(P, { target: 'asset', asset: A, instruction: 'sharper again' }); ok(/per cent in words in body copy/.test(anth.calls[anth.calls.length - 1].system), 'HOOF prompt carries it');
  const r2x = await direct(P, { target: 'asset', asset: A, instruction: 'Never use the word rort' }); const ev2 = (await events(P, 'revise')).pop();
  const dec = await req('POST', '/studio/remember', { project: P, eid: ev2.eid, scope: 'none' }); eq(dec.d.saved, false); ok((await events(P, 'offer_declined')).pop().eid === ev2.eid);
  eq(db.prepare("SELECT COUNT(*) n FROM engine_fixes WHERE ns='mca'").get().n, 1, 'declining saves nothing');
  const last = await req('POST', '/studio/remember', { project: P, eid: ev2.eid, scope: 'client', rule: 'Never use the word rort.', task: 'copy' }); eq(last.d.scope, 'client');
  ok((await req('GET', '/studio/context?project=' + noc.d.id)).d.learned.some(f => f.id === last.d.fix), 'a lasting rule reaches the campaign-less project');
  eq((await req('POST', '/studio/remember', { project: P, eid: 'e_x', scope: 'campaign', rule: 'short' })).status, 400);
  eq((await req('POST', '/studio/remember', { project: noc.d.id, eid: 'e_y', scope: 'campaign', rule: 'A rule for a campaign the project lacks.' })).d.error, 'no_campaign');
});
await t('approve and reject file WIN and LOSS exemplars with the reason; withdraw files nothing', async () => {
  const n0 = db.prepare("SELECT COUNT(*) n FROM engine_outcomes").get().n;
  await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'client asked for the plain ask' });
  await req('POST', '/studio/approve', { asset: B, part: 'design', decision: 'reject', reason: 'truck again' });
  await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'withdraw' });
  const rows = db.prepare("SELECT surface, ref, verdict, why, headline FROM engine_outcomes ORDER BY created").all().slice(n0);
  eq(rows.length, 2); eq(rows[0].surface, 'studio'); eq(rows[0].verdict, 'approved'); eq(rows[0].ref, A); ok(/copy: client asked/.test(rows[0].why)); eq(rows[0].headline, 'Not a subsidy. Never was.'); eq(rows[1].verdict, 'killed'); ok(/design: truck again/.test(rows[1].why));
  ok((await events(P, 'approval')).some(e => /filed in the Mind as a WIN exemplar/.test(e.text)));
});
await t('a direction needs a full key and a target: read keys are refused, an empty instruction and a missing asset fail without retry', async () => {
  eq((await req('POST', '/studio/job', { project: P, stage: 'revise', input: { instruction: 'x' } }, 'read-key')).status, 403);
  const j = await direct(P, { target: 'asset', asset: A, instruction: '' }); eq(j.state, 'failed'); ok(/instruction_required/.test(j.error) && !/will retry/.test(j.error), j.error);
  const k = await direct(P, { target: 'asset', asset: 'a_nope', instruction: 'sharper' }); eq(k.state, 'failed'); ok(/asset_required/.test(k.error));
});
await t('a saved Ad Lab or Studio session in KV lists as a legacy row for its client, opens read-only with its artwork flattened, and imports once with the images copied into R2', async () => {
  kv.set('imgsess_al7x1', JSON.stringify({ client: 'mca', thread: [{ r: 'user', t: 'something for HOOF' }, { r: 'art', ver: 1, note: 'first render', mime: 'image/png' }, { r: 'art', ver: 2, note: 'warmer', mime: 'image/png' }], stage: 'confirmed', chosen: { headline: 'Hands off our fuel.', support: 'The credit is not a subsidy.', cta: 'Learn more' }, brief: { format: 'square', headline: 'Hands off our fuel.', notes: 'rapid response on the fuel tax credit', audience: 'regional Victoria' }, artVer: 2, ts: 1700000000000 }));
  kv.set('imgsess_al7x1_v1', JSON.stringify({ b64: PNG, mime: 'image/png' })); kv.set('imgsess_al7x1_v2', JSON.stringify({ b64: PNG, mime: 'image/png' }));
  kv.set('imgsess_zz9', JSON.stringify({ client: 'aep', brief: { headline: 'gas' }, artVer: 1, ts: 1 })); kv.set('imgsess_zz9_v1', JSON.stringify({ b64: PNG }));
  kv.set('imgsess_noclient', JSON.stringify({ brief: 'no client recorded', artVer: 1 }));
  const l = await req('GET', '/studio/list?ns=mca', null, 'read-key'); const row = l.d.legacy.find(x => x.id === 'ks:al7x1');
  ok(row && row.kind === 'legacy_session' && row.assets === 2 && row.readOnly && /Session: Hands off our fuel/.test(row.title) && row.source === 'Ad Lab', JSON.stringify(row));
  ok(!l.d.legacy.some(x => x.id === 'ks:zz9' || x.id === 'ks:noclient'), 'another client\'s session and an unattributed one are not listed under MCA');
  const v = await req('GET', '/studio/get?id=ks:al7x1', null, 'read-key'); eq(v.status, 200); eq(v.d.readOnly, true); eq(v.d.ns, 'mca'); eq(v.d.assets.length, 2); eq(v.d.assets[0].versions[0].mode, 'generated'); eq(v.d.assets[0].versions[0].image.url, '/session/img?id=al7x1&ver=1&raw=1'); eq(v.d.assets[1].versions[0].note, 'warmer'); eq(v.d.brief.objective, 'rapid response on the fuel tax credit'); eq(v.d.brief.notRecorded, []); eq(v.d.assets[0].format, '1:1'); ok(v.d._versions === undefined, 'internals are not served');
  const raw = await handler.fetch(new Request('https://newsaus.test/session/img?id=al7x1&ver=1&raw=1', { headers: { 'X-Axiom-Key': 'read-key' } }), env, ctx); eq(raw.status, 200); ok(/image\/png/.test(raw.headers.get('content-type')));
  const i1 = await req('POST', '/studio/import', { legacy: 'ks:al7x1' }); eq(i1.status, 200, JSON.stringify(i1.d)); eq(i1.d.existing, false); eq(i1.d.ns, 'mca');
  const g = await req('GET', '/studio/get?id=' + i1.d.id); eq(g.d.assets.length, 2); const im = g.d.assets[0].versions[0].image; ok(/^studio\/p/.test(im.key) && r2.has(im.key), 'the session image was copied into R2: ' + JSON.stringify(im)); eq(g.d.assets[0].versions[0].mode, 'generated'); eq(g.d.assets[0].versions[0].copy.headline, 'Hands off our fuel.');
  eq((await req('POST', '/studio/import', { legacy: 'ks:al7x1' })).d.id, i1.d.id, 'idempotent');
  eq((await req('GET', '/studio/list?ns=mca')).d.legacy.find(x => x.id === 'ks:al7x1').imported, i1.d.id);
  kv.set('imgsess_empty1', JSON.stringify({ client: 'mca', brief: {}, artVer: 0 }));
  const e = await req('POST', '/studio/import', { legacy: 'ks:empty1' }); eq(e.status, 400); eq(e.d.error, 'no_images');
  eq((await req('GET', '/studio/get?id=ks:nothere')).status, 404);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
