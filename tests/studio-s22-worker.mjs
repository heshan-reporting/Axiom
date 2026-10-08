/* S22 on the worker: a long model call that looked stuck. The 8 October report: "Understanding your brief" sat on
 * "Checking campaign relevance, topics, issues, facts and risks ... 1 of 4" with only a clock moving. That step is one
 * model call (the creative model at high effort, up to 16,000 tokens) which used to be one non-streamed request: nothing
 * came back until the whole answer was written, a gateway could time it out on the way, the browser's request had to
 * stay open and silent for minutes, and the runner's lease was set once for five minutes, so a runner that died was not
 * noticed for five minutes and then only by the next tick (twice an hour). Reproduced here with a streamed mock answer:
 *   1. the call streams, the answer is assembled from its pieces, and the job files the reading as before;
 *   2. while it streams, the job reports what has been written (thinking, then the answer, in characters) and the lease is
 *      renewed beat by beat instead of once;
 *   3. a stream that falls silent is abandoned after the idle limit and retried; an error event and a cut-off stream are
 *      retried, never parsed as an answer;
 *   4. cancelling while the answer streams stops the call itself, and nothing is filed;
 *   5. the step request keeps the browser's connection alive with whitespace while it waits, and still answers JSON;
 *   6. the reading counts the steps it has finished (2 of 4 while the model writes), not 1 of 4.
 * Providers MOCKED; the timings are shortened through env knobs (STUDIO_STREAM_IDLE_MS, STUDIO_LEASE_BEAT_MS,
 * STUDIO_HEARTBEAT_MS). Run: node --experimental-sqlite tests/studio-s22-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-s22-worker (long model calls: streamed, visible, renewed, recoverable)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_STREAM_IDLE_MS: '400', STUDIO_LEASE_BEAT_MS: '60', STUDIO_HEARTBEAT_MS: '40' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');

/* the Anthropic Messages API as a server-sent event stream: thinking first, then the answer in pieces; `mode` makes it
   fall silent, send an error event, or stop before message_stop */
let mode = 'ok', gap = 25, aborted = 0, bodies = [];
function sse(text, init) {
  const enc = new TextEncoder(); const ev = (type, data) => enc.encode('event: ' + type + '\ndata: ' + JSON.stringify(Object.assign({ type }, data)) + '\n\n');
  const pieces = []; for (let i = 0; i < text.length; i += 400) pieces.push(text.slice(i, i + 400));
  const signal = init && init.signal; let stopped = false;
  if (signal) signal.addEventListener('abort', () => { stopped = true; aborted++; });
  return new Response(new ReadableStream({ async start(c) {
    const put = async (type, data) => { if (stopped) return false; try { c.enqueue(ev(type, data)); } catch (e) { return false; } await sleep(gap); return !stopped; };
    if (!(await put('message_start', { message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [], usage: { input_tokens: 900, output_tokens: 1 } } }))) return;
    await put('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } });
    for (let i = 0; i < 3; i++) if (!(await put('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: 'Weighing the paragraphs against the client. '.repeat(4) } }))) return;
    await put('content_block_stop', { index: 0 });
    if (mode === 'silent') { await sleep(1500); try { c.close(); } catch (e) {} return; }
    if (mode === 'error') { await put('error', { error: { type: 'overloaded_error', message: 'Overloaded' } }); try { c.close(); } catch (e) {} return; }
    await put('content_block_start', { index: 1, content_block: { type: 'text', text: '' } });
    for (const p of pieces) if (!(await put('content_block_delta', { index: 1, delta: { type: 'text_delta', text: p } }))) return;
    if (mode === 'cut') { try { c.close(); } catch (e) {} return; }
    await put('content_block_stop', { index: 1 });
    await put('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1800 } });
    await put('message_stop', {});
    try { c.close(); } catch (e) {}
  }, cancel() { stopped = true; } }), { status: 200, headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });
}
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); bodies.push(body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  const text = JSON.stringify(answerFor(sys, user));
  if (mode === 'json' || !body.stream) return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  return sse(text, init);
});

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }],
  facts: [{ text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'MCA analysis', status: 'approved', campaign: 'national' }] });
const MATERIAL = ['Fuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy for miners.', 'The MCA analysis showing mining paid $74 billion in company tax and royalties is being quoted by regional MPs.', 'Housing approvals fell for the third month.'].join('\n\n');
const fresh = async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', title: 'Long call ' + Math.random().toString(36).slice(2, 6), brief: { channels: ['instagram'] } })).body.id;
  const S = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Brief', text: MATERIAL })).body.id;
  const J = (await call('POST', '/studio/job', { project: P, stage: 'analyse', input: { source: S, kind: 'brief' }, idem: 'an:' + P })).body.job;
  return { P, S, J };
};
const job = async id => (await call('GET', '/studio/job?id=' + id)).body.job;

await T.t('1. the reading is asked for as a stream and the answer is assembled from its pieces; the job files the analysis', async () => {
  mode = 'ok'; bodies = []; const { P, J } = await fresh();
  const r = await call('POST', '/studio/job/step', { id: J.id }); eq(r.body.job.state, 'done', r.body.job.error);
  ok(bodies.some(b => b.stream === true), 'the request asked for a stream');
  const g = (await call('GET', '/studio/get?id=' + P)).body; ok(g.brief.analysis && Array.isArray(g.brief.analysis.relevant), 'the analysis is filed: ' + JSON.stringify(Object.keys(g.brief.analysis || {})));
});
await T.t('2. while the answer streams, the job says what has been written (thinking, then characters of the answer) and the lease is renewed beat by beat', async () => {
  mode = 'ok'; gap = 60; const { J } = await fresh();
  const stepping = call('POST', '/studio/job/step', { id: J.id });
  const seen = []; let lease0 = 0, leaseMax = 0;
  for (let i = 0; i < 60; i++) { await sleep(50); const j = await job(J.id); const a = (j.progress || {}).activity || {}; if (j.state === 'running') { seen.push(a); const lu = Number(j.leaseUntil || j.lease_until || 0); if (!lease0 && lu) lease0 = lu; leaseMax = Math.max(leaseMax, lu); } if (j.state !== 'running' && j.state !== 'queued') break; }
  const done = await stepping; eq(done.body.job.state, 'done', done.body.job.error);
  ok(seen.some(a => a.phase === 'model' && Number(a.thinking) > 0), 'the thinking is counted while it streams: ' + JSON.stringify(seen.map(a => [a.phase, a.thinking, a.written])));
  ok(seen.some(a => a.phase === 'model' && Number(a.written) > 0 && /characters/.test(a.label || '')), 'the answer is counted in characters as it arrives, and the label says so: ' + JSON.stringify(seen.filter(a => a.written).map(a => a.label).slice(0, 2)));
  ok(leaseMax > lease0, 'the lease moved forward while the call ran (' + lease0 + ' -> ' + leaseMax + ')');
  gap = 25;
});
await T.t('3a. a stream that falls silent is abandoned after the idle limit and the job is queued to retry (never left running)', async () => {
  mode = 'silent'; const { J } = await fresh();
  const t0 = Date.now(); const r = await call('POST', '/studio/job/step', { id: J.id }); const ms = Date.now() - t0;
  eq(r.body.job.state, 'queued', JSON.stringify(r.body.job));
  ok(/nothing for|silent|idle/i.test(r.body.job.error) && /will retry/.test(r.body.job.error), 'said and retried: ' + r.body.job.error);
  ok(ms < 1400, 'abandoned at the idle limit, not after the stream ends (' + ms + ' ms)');
});
await T.t('3b. an error event in the stream is retried, never parsed as an answer', async () => {
  mode = 'error'; const { J } = await fresh();
  const r = await call('POST', '/studio/job/step', { id: J.id });
  eq(r.body.job.state, 'queued', JSON.stringify(r.body.job)); ok(/overloaded/i.test(r.body.job.error), r.body.job.error);
});
await T.t('3c. a stream cut off before it finished is retried, never parsed as a partial answer', async () => {
  mode = 'cut'; const { J } = await fresh();
  const r = await call('POST', '/studio/job/step', { id: J.id });
  eq(r.body.job.state, 'queued', JSON.stringify(r.body.job)); ok(/cut off|ended before/i.test(r.body.job.error), r.body.job.error);
});
await T.t('4. cancelling while the answer streams stops the call itself, and nothing is filed', async () => {
  mode = 'ok'; gap = 80; aborted = 0; const { P, J } = await fresh();
  const stepping = call('POST', '/studio/job/step', { id: J.id });
  for (let i = 0; i < 40; i++) { await sleep(40); const a = ((await job(J.id)).progress || {}).activity || {}; if (a.phase === 'model' && Number(a.thinking) > 0) break; }
  const c = await call('POST', '/studio/job/cancel', { id: J.id }); eq(c.body.job.state, 'cancelled');
  const r = await stepping; eq(r.body.job.state, 'cancelled', JSON.stringify(r.body.job));
  ok(aborted >= 1, 'the model call was stopped, not left running to be billed');
  const g = (await call('GET', '/studio/get?id=' + P)).body; ok(!(g.brief && g.brief.analysis), 'nothing filed');
  gap = 25;
});
await T.t('5. the step request keeps the connection alive while it waits (whitespace), then answers JSON', async () => {
  mode = 'ok'; gap = 40; const { J } = await fresh();
  const r = await call('POST', '/studio/job/step', { id: J.id });
  ok(/^\s+\{/.test(r.text), 'whitespace came first: ' + JSON.stringify(r.text.slice(0, 12)));
  eq(r.body && r.body.job && r.body.job.state, 'done', r.text.slice(0, 200));
  const unknown = await call('POST', '/studio/job/step', { id: 'nope' }); eq(unknown.status, 404, 'an unknown job is still a plain 404');
  gap = 25;
});
await T.t('6. while the model writes, the reading counts 2 of its 4 steps finished (it said 1 of 4)', async () => {
  mode = 'ok'; gap = 60; const { J } = await fresh();
  const stepping = call('POST', '/studio/job/step', { id: J.id }); let a2 = null;
  for (let i = 0; i < 40; i++) { await sleep(40); const a = ((await job(J.id)).progress || {}).activity || {}; if (a.phase === 'model') { a2 = a; break; } }
  await stepping; ok(a2 && a2.completed === 2 && a2.total === 4, 'model phase: ' + JSON.stringify(a2 && [a2.completed, a2.total]));
  gap = 25;
});
await T.t('7. a plain JSON answer (a proxy that does not stream) is still accepted', async () => {
  mode = 'json'; const { J } = await fresh();
  const r = await call('POST', '/studio/job/step', { id: J.id }); eq(r.body.job.state, 'done', r.body.job.error);
});

T.done(); w.restore();
