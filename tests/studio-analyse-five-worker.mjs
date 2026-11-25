/* The brief analysis proposes five creative directions (25 November 2026, the team: "we need more than 4 options ... 5"), as
 * the Direction step does: the reading asks for five, keeps up to five, drops a sixth, and has room in its answer for them.
 * Providers MOCKED; nothing is spent.
 *   AF1 the reading asks for five directions, not three or four
 *   AF2 five returned are five kept; a sixth is dropped
 * Run: node --experimental-sqlite tests/studio-analyse-five-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-analyse-five-worker (the brief analysis proposes five directions)');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
const seen = [];
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  let ans = answerFor(sys, user);
  if (/strategy lead of an Australian/.test(sys)) {
    seen.push({ sys, maxTok: body.max_tokens });
    const d0 = (ans.directions || [])[0];
    ans = Object.assign({}, ans, { directions: Array.from({ length: 6 }, (_, i) => Object.assign({}, d0, { name: 'Direction ' + (i + 1), title: 'Direction ' + (i + 1) })) });
  }
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ans) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b) => w.call(m, p, b, 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Five', brief: { channels: ['facebook'], campaignConfirmed: true } })).body.id;
const S = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Brief', text: 'Fuel tax credits are under attack: a crossbencher called the credit a subsidy for miners. Please respond on social this week.' })).body.id;
const j = await run((await call('POST', '/studio/job', { project: P, stage: 'analyse', input: { sources: [S], kind: 'brief' }, idem: 'af' })).body.job);
eq(j.state, 'done', JSON.stringify(j.error || '').slice(0, 300));

await T.t('AF1 the reading asks for five creative directions and has room for them', async () => {
  const s = (seen[seen.length - 1] || {}).sys || '';
  ok(/CREATIVE DIRECTIONS: five genuinely different/.test(s), 'the prompt asks for five');
  ok(!/three or four genuinely different/.test(s), 'not three or four');
  ok((seen[seen.length - 1] || {}).maxTok >= 20000, 'the answer has room for five: ' + (seen[seen.length - 1] || {}).maxTok);
});

await T.t('AF2 five directions are kept and a sixth is dropped', async () => {
  const g = (await call('GET', '/studio/get?id=' + P)).body;
  eq(g.directions.length, 5, 'five directions on the project');
});

const r = T.done(); w.restore(); process.exit(r.fail ? 1 : 0);
