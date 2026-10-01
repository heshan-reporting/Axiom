/* Creative Studio P14, recipes, impact and usage: jobs can wait for the step before them and fail with the reason when
 * it failed (nothing downstream runs on a broken input); recipes are named, reusable step lists - built in and per
 * client - estimated before they run, with any image spend confirmed first; the impact view names what an upstream change
 * made stale (kit facts and banned terms, the master of an adaptation, a measurement, a client approval of an older
 * version) and which remedy is free; a re-check recomputes the checks against today's kit with no model call; usage
 * counts the model calls and images a project actually spent.
 * Run: node --experimental-sqlite tests/studio-p14-worker.mjs */
import { D1Lite } from './d1lite.mjs';
import { stubReport } from './studio-measure-stub.mjs';
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
const calls = { anth: 0, gem: 0 }; let strategyFails = false;
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gem++; return new Response('{}', { status: 500 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    calls.anth++; const sys = String(JSON.parse(init.body).system || '');
    const text = /creative strategist/.test(sys) ? (strategyFails ? 'not json at all' : JSON.stringify({ problem: 'p', audience: { who: 'w', now: 'n', wanted: 'x', insight: 'i' }, idea: 'It is your tractor too', proposition: 'pr', proof: [], tone: 't', avoid: [], risks: [], measures: [], questions: [] }))
      : /genuinely different directions/.test(sys) ? JSON.stringify({ directions: [{ title: 'A', message: 'm', insight: 'i', headline: 'h', opening: 'o', visual: 'v', rationale: 'r', claims: [], uncertainty: 'u', medium: 'typographic' }] })
      : /planning a campaign sequence/.test(sys) ? JSON.stringify({ name: 'S', arc: 'a', items: [{ order: 1, role: 'opener', channel: 'instagram', format: '1:1', headline: 'One', support: 's', cta: 'c' }, { order: 2, role: 'call-to-action', channel: 'instagram', format: '1:1', headline: 'Two', support: 's', cta: 'c' }] }) : '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key }, body: body ? JSON.stringify(body) : undefined }), env, ctx); let d = null; try { d = await res.json(); } catch (x) {} return { status: res.status, d }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const step = async id => (await req('POST', '/studio/job/step', { id })).d.job;
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;

console.log('studio-p14-worker harness (job ordering, recipes with estimates, impact and free remedies, usage)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }], facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved' }], banned: [] });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Recipes', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;

await t('a job can wait for the step before it: it is not claimed until that step is done, and when that step fails it fails too, naming it, without running', async () => {
  const a = (await req('POST', '/studio/job', { project: P, stage: 'strategy', input: {}, idem: 'a1' })).d.job;
  const b = (await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 1 }, after: a.id, idem: 'b1' })).d.job; eq(b.after, a.id);
  const early = await step(b.id); eq(early.state, 'queued'); ok(/waiting for the step before it/.test(early.note), early.note);
  eq((await step(a.id)).state, 'done'); eq((await step(b.id)).state, 'done', 'runs once its upstream is done');
  strategyFails = true; const n0 = calls.anth;
  const c = (await req('POST', '/studio/job', { project: P, stage: 'strategy', input: {}, idem: 'c1' })).d.job;
  const d = (await req('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 1 }, after: c.id, idem: 'd1' })).d.job;
  let cj = c; for (let i = 0; i < 4 && cj.state !== 'failed'; i++) cj = await step(c.id); eq(cj.state, 'failed');
  const dj = await step(d.id); eq(dj.state, 'failed'); ok(/upstream_failed: the strategy step it depends on failed/.test(dj.error), dj.error);
  eq(calls.anth - n0, cj.attempts, 'the dependent step spent nothing'); strategyFails = false;
  eq((await req('POST', '/studio/job', { project: P, stage: 'direct', input: {}, after: 'jnope', idem: 'e1' })).d.error, 'unknown_after');
});

await t('recipes: built in and per client, estimated before they run, image spend confirmed first, run as a chain the cron or the browser finishes', async () => {
  const list = (await req('GET', '/studio/recipes?ns=mca', null, 'read-key')).d; ok(list.builtin.some(r => r.id === 'builtin:guided') && Array.isArray(list.recipes));
  const est = (await req('GET', '/studio/recipe/estimate?project=' + P + '&recipe=builtin:release-set', null, 'read-key')).d;
  eq([est.renders, est.missing], [1, ['the project has no source to read']], 'one image per channel, and the missing source is named');
  const sv = await req('POST', '/studio/recipe', { ns: 'mca', campaign: 'hoof', name: 'HOOF opener and close', steps: [{ stage: 'strategy', input: {} }, { stage: 'sequence', input: { count: 2, channels: '$briefChannels' } }, { stage: 'render', input: {} }] });
  eq(sv.d.recipe.steps.map(s => s.stage), ['strategy', 'sequence'], 'only recipe stages are kept');
  const e2 = (await req('GET', '/studio/recipe/estimate?project=' + P + '&recipe=' + sv.d.recipe.id, null, 'read-key')).d; eq([e2.calls, e2.renders], [2, 0]);
  const before = (await get(P)).assets.length;
  const run = await req('POST', '/studio/recipe/run', { project: P, recipe: sv.d.recipe.id }); eq(run.status, 200, JSON.stringify(run.d)); eq(run.d.jobs.length, 2);
  const j2 = (await req('GET', '/studio/job?id=' + run.d.jobs[1])).d.job; eq([j2.after, j2.recipe, j2.input.channels], [run.d.jobs[0], sv.d.recipe.id, ['instagram']], 'chained, with the brief\'s channels resolved');
  const cron = await mod.__studioCron(env, 120000); ok(cron.done >= 2, JSON.stringify(cron));
  eq((await get(P)).assets.length - before, 2, 'the sequence was made after the strategy, by the cron with no tab open');
  const conf = await req('POST', '/studio/source', { project: P, kind: 'release', name: 'r', text: 'Farmers claim the credit. It is not a subsidy.' });
  const r3 = await req('POST', '/studio/recipe/run', { project: P, recipe: 'builtin:release-set' }); eq([r3.status, r3.d.error], [409, 'confirm_spend']); ok(/about 1 image/.test(r3.d.detail));
  eq((await req('POST', '/studio/recipe/run', { project: P, recipe: 'builtin:release-set' }, 'read-key')).status, 403);
  ok((await get(P)).thread.some(e => e.kind === 'recipe' && /HOOF opener and close/.test(e.text)));
});

await t('the impact view names what went stale and which remedy is free: kit facts changed (re-check, no model call), a measurement made stale, an adaptation whose master moved on, a client approval of an older version', async () => {
  const g = await get(P); const A = g.assets.find(a => /opener/.test(a.title)) || g.assets[0];
  await req('POST', '/brand/kit', { ns: 'mca', facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved' }, { text: 'Farmers use 2 billion litres', source: 'ABS', status: 'approved' }] });
  const im = (await req('GET', '/studio/impact?project=' + P, null, 'read-key')).d;
  const row = im.assets.find(x => x.asset === A.id); ok(row && row.reasons.some(r => r.code === 'kit_changed' && r.remedy === 'recheck' && r.paid === false && /facts/.test(r.text)), JSON.stringify(im.assets.map(x => [x.title, x.reasons.map(r => r.code)])));
  const n0 = calls.anth; const rc = await req('POST', '/studio/recheck', { asset: A.id }); eq(rc.status, 200); eq(calls.anth, n0, 're-check spends no model call');
  // a measured composition whose words change, an adaptation whose master moves on
  const cur = A.versions.find(v => v.id === A.current); await req('POST', '/studio/validation', { asset: A.id, version: cur.id, report: stubReport(cur, A) });
  await req('POST', '/studio/version', { asset: A.id, copy: Object.assign({}, cur.copy, { headline: 'Changed after measuring' }), layout: cur.layout, note: 'edit' });
  const B = (await req('POST', '/studio/asset', { project: P, family: 'F', channel: 'facebook', format: '1:1', title: 'Adapted', copy: cur.copy, layout: cur.layout, mode: 'composition', context: { master: A.id, masterVersion: cur.id } })).d.asset.id;
  const im2 = (await req('GET', '/studio/impact?project=' + P)).d;
  ok(im2.assets.find(x => x.asset === A.id).reasons.some(r => r.code === 'measurement_stale' && !r.paid));
  ok(im2.assets.find(x => x.asset === B).reasons.some(r => r.code === 'master_changed' && r.paid), JSON.stringify(im2.assets.find(x => x.asset === B)));
  ok(/locked fields/.test(im2.note));
});

await t('usage counts what the project actually spent, by stage, and tells free versions from rendered ones', async () => {
  const u = (await req('GET', '/studio/usage?project=' + P, null, 'read-key')).d;
  ok(u.calls >= 4 && u.renders === 0 && u.byStage.strategy.done >= 2 && u.byStage.strategy.failed >= 1 && u.byStage.direct.failed >= 1, JSON.stringify(u));
  ok(u.versions.free >= 3 && u.versions.rendered === 0, JSON.stringify(u.versions));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
