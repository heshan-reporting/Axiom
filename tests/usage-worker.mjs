/* AI usage accounting: concurrent calls never lose a count, the daily cap holds when calls race (a reservation is
 * taken before each provider call), and every attempt is recorded for what it was - confirmed, failed, or a retry -
 * with the tokens the provider reported. Anthropic MOCKED.
 * Run: node --experimental-sqlite tests/usage-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('usage-worker (concurrency-safe budgets and honest attempt accounting; provider MOCKED)');
const mk = async (env, mode) => {
  const w = await workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'a' }, env || {}) });
  let n = 0; w.calls = () => n;
  w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
    n++; await new Promise(r => setTimeout(r, 5));
    const m = typeof mode === 'function' ? mode(n, JSON.parse(init.body)) : mode;
    if (m === 'overloaded') return new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 });
    if (m === 'no-thinking') return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'thinking: unknown field' } }), { status: 400 });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '{"ok":true}' }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20 } }), { status: 200 });
  });
  return w;
};
await T.t('twenty Studio calls at once are twenty counted calls (no lost increments)', async () => {
  const w = await mk({ STUDIO_DAILY_CALLS: '1000' }); const { stClaude } = w.mod.__test;
  await Promise.all(Array.from({ length: 20 }, () => stClaude(w.env, { role: 'creative', system: 's', user: 'u' })));
  const b = (await w.call('GET', '/studio/budget', null, 'full-key')).body;
  eq([w.calls(), b.used, b.confirmed, b.failed], [20, 20, 20, 0]); eq([b.tokens.in, b.tokens.out], [2000, 400]); w.restore();
});
await T.t('the cap holds when calls race: with 5 left, 12 simultaneous calls reach the provider 5 times and the rest are refused before sending', async () => {
  const w = await mk({ STUDIO_DAILY_CALLS: '5' }); const { stClaude } = w.mod.__test;
  const rs = await Promise.allSettled(Array.from({ length: 12 }, () => stClaude(w.env, { role: 'creative', system: 's', user: 'u' })));
  eq(w.calls(), 5, 'provider calls'); eq(rs.filter(r => r.status === 'fulfilled').length, 5);
  ok(rs.filter(r => r.status === 'rejected').every(r => /budget_exhausted/.test(r.reason.message)), 'the others are budget_exhausted');
  eq((await w.call('GET', '/studio/budget', null, 'full-key')).body.used, 5); w.restore();
});
await T.t('a retry is a second counted call, marked as a retry; a failed attempt is counted as failed, not confirmed', async () => {
  const w = await mk({ STUDIO_DAILY_CALLS: '100' }, n => n === 1 ? 'no-thinking' : 'ok'); const { stClaude } = w.mod.__test;
  await stClaude(w.env, { role: 'creative', system: 's', user: 'u' });             // refused fields, then repeated plain
  let b = (await w.call('GET', '/studio/budget', null, 'full-key')).body;
  eq([w.calls(), b.used, b.retries, b.failed, b.confirmed], [2, 2, 1, 1, 1]);
  const w2 = await mk({ STUDIO_DAILY_CALLS: '100' }, 'overloaded'); const s2 = w2.mod.__test.stClaude;
  await s2(w2.env, { role: 'creative', system: 's', user: 'u' }).catch(() => {});
  b = (await w2.call('GET', '/studio/budget', null, 'full-key')).body; eq([b.used, b.failed, b.confirmed], [1, 1, 0]); w.restore(); w2.restore();
});
await T.t('sentiment and narrative calls reserve before they send: a JSON retry is counted, and concurrent runs cannot pass the cap', async () => {
  const w = await mk({ SENTIMENT_DAILY_CALLS: '3' }, 'ok'); const { claudeMsg, aiUsage } = w.mod.__test;
  const rs = await Promise.allSettled(Array.from({ length: 6 }, (_, i) => claudeMsg(w.env, 's', 'u', 100, 5000, 'claude-sonnet-5-5', { scope: 'sentiment', retry: i % 2 === 1 })));
  eq(w.calls(), 3, 'three reached the provider'); ok(rs.filter(r => r.status === 'rejected').every(r => /budget_exhausted/.test(r.reason.message)));
  const u = await aiUsage(w.env, 'sentiment'); eq([u.reserved, u.confirmed], [3, 3]); ok(u.retries >= 1, 'retries recorded: ' + u.retries); w.restore();
});
const res = T.done(); process.exit(res.fail ? 1 : 0);
