/* Automated model spend (5 October 2026: $14 of credit gone in an evening). The cron's Claude work - sentiment verdicts,
 * narrative naming, topic research, the Sentinel's drafted angles, the daily brief - runs once a day by default
 * (AI_AUTOMATION=daily: the first tick at or after 07:00 Sydney), every tick with 'always', never with 'off'. Collection,
 * Sentinel detection, narrative placement and the Creative Studio's jobs are never gated. A whole scheduled tick is run
 * against the worker module with every provider MOCKED and every outbound request recorded: a held tick reaches the
 * Anthropic API zero times. Run: node --experimental-sqlite tests/ai-automation-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('ai-automation-worker (the cron spends model credit once a day; collection and the Studio untouched)');
const anth = { n: 0 };
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async () => { anth.n++; return new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }), { status: 200 }); });
const G = w.mod.__test;
// Sydney is UTC+10 or +11; build instants from a Sydney wall-clock hour on a fixed day
const syd = (h) => { const guess = Date.UTC(2026, 9, 6, h, 30) - 11 * 3600000; return guess; };

await T.t('the default is daily: before 07:00 Sydney nothing runs; the first tick at or after 07:00 runs and remembers the day; a later tick the same day is held', async () => {
  const env = Object.assign({}, w.env); delete env.AI_AUTOMATION; await w.kv.delete && w.kv.delete('ai_cron_day');
  eq(G.aiAutomationMode(env), 'daily', 'default mode');
  const early = await G.aiAutomationGate(env, syd(5)); eq(early.run, false, 'before 07:00: ' + early.why);
  const first = await G.aiAutomationGate(env, syd(8)); eq(first.run, true, 'the first tick after 07:00 runs: ' + first.why);
  const again = await G.aiAutomationGate(env, syd(9)); eq(again.run, false, 'a later tick the same day is held: ' + again.why);
  ok(/already ran today/.test(again.why), again.why);
  const st = await G.aiAutomationStatus(env, syd(9)); ok(/once a day/.test(st.text) && /ran today/.test(st.text), st.text);
});

await T.t('always runs every tick; off never runs; an unknown value falls to daily', async () => {
  eq((await G.aiAutomationGate(Object.assign({}, w.env, { AI_AUTOMATION: 'always' }), syd(3))).run, true, 'always');
  eq((await G.aiAutomationGate(Object.assign({}, w.env, { AI_AUTOMATION: 'off' }), syd(12))).run, false, 'off');
  eq(G.aiAutomationMode({ AI_AUTOMATION: 'sometimes' }), 'daily', 'unknown -> daily');
});

await T.t('a whole scheduled tick that is held makes no call to the Anthropic API, while collection still runs (outbound requests to the news and social sources are made); the status route says why', async () => {
  // the day has already had its window
  const today = new Date(Date.now() + 10 * 3600000).toISOString().slice(0, 10);
  w.env.AI_AUTOMATION = 'daily';
  for (const d of [today, new Date(Date.now() + 11 * 3600000).toISOString().slice(0, 10)]) await w.env.AXIOM_KV.put('ai_cron_day', d);
  // fresh rows naming register entities on a client issue, and a topic waiting: an ungated tick has something to spend on
  const now = Date.now();
  const rows = Array.from({ length: 12 }, (_, i) => ({ src: 'abc', title: 'Albanese government and Chalmers face pressure over fuel tax credits for miners, report ' + i, body: 'The Minerals Council said fuel tax credits are not a subsidy; Labor and the Coalition traded blows over the diesel rebate in question time.', url: 'https://example.test/news/' + i, ts: now - i * 600000 }));
  const ad = await w.call('POST', '/archive/add', { kind: 'news', rows }, 'full-key'); ok(ad.status === 200, 'seeded rows: ' + JSON.stringify(ad.body).slice(0, 120));
  await w.call('POST', '/topics/add', { keyword: 'fuel tax credits', ns: 'mca' }, 'full-key');
  const before = anth.n; const out0 = w.outbound.length;
  let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited;
  eq(anth.n - before, 0, 'no model call in a held tick');
  ok(w.outbound.length - out0 > 5, 'collection still reached out: ' + (w.outbound.length - out0) + ' outbound requests');
  const st = (await w.call('GET', '/studio/status', null, 'read-key')).body; ok(st.aiAutomation && st.aiAutomation.mode === 'daily', JSON.stringify(st.aiAutomation));
  // the same state with the gate open: the tick does spend - so the zero above is the gate's doing, not an empty archive
  w.env.AI_AUTOMATION = 'always'; const b2 = anth.n;
  waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited;
  ok(anth.n - b2 >= 1, 'the ungated tick on the same data made ' + (anth.n - b2) + ' model call(s)');
  w.env.AI_AUTOMATION = 'daily';
});

await T.t('off holds the daily brief too; the Creative Studio still answers a person\'s command with a model call', async () => {
  w.env.AI_AUTOMATION = 'off'; const before = anth.n;
  let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited;
  eq(anth.n - before, 0, 'off: nothing automated');
  await w.call('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'n', logoPolicy: 'none' }] }, 'full-key');
  const P = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'On demand', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'copy', campaignConfirmed: true }, idem: 'aia' }, 'full-key')).body.id;
  const j = (await w.call('POST', '/studio/job', { project: P, stage: 'strategy', input: { instruction: 'x' }, idem: 'aia-s' }, 'full-key')).body.job;
  await w.call('POST', '/studio/job/step', { id: j.id }, 'full-key');
  ok(anth.n - before >= 1, 'the Studio made its call on command: ' + (anth.n - before));
  delete w.env.AI_AUTOMATION;
});

const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
