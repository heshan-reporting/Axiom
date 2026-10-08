/* STProgress (docs/studio-progress.js), the job model behind the Studio's activity panel, in Node: a running job shows the
 * phase the worker reported and never a share invented from elapsed time; a countable stage shows its count; a finished
 * job is 100 and a queued one says why it waits; a failure with a live retry is history; the run groups one burst of
 * jobs and counts finished steps; the typical duration reads the worker's history. Run: node tests/studio-progress-test.mjs */
import '../docs/studio-progress.js';
const S = globalThis.STProgress;
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + ': ' + JSON.stringify(a) + (JSON.stringify(a) === JSON.stringify(b) ? '' : ' !== ' + JSON.stringify(b)));
console.log('studio-progress-test (the job model: phases, counts, no clock-invented shares, runs, typical durations)');
const now = 1_000_000_000;
// a render in flight for 42 s: the phase and label the worker wrote mid-call, no percentage
const render = { id: 'r1', stage: 'render', state: 'running', created: now - 50000, updated: now - 2000, attempts: 0, progress: { activity: { phase: 'generating', label: 'the image model is making the background image at 2K; one call, no progress until it answers', startedAt: now - 42000, at: now - 2000, size: '2K' }, lines: [] } };
const r = S.job(render, now, { n: 5, median: 38000, p80: 70000 });
eq(r.title, 'Image generation', 'the stage in plain words');
eq(r.phase, 'generating', 'the phase the worker reported');
ok(/image model is making the background image/.test(r.phaseText), 'the phase text is the worker\'s label: ' + r.phaseText);
eq(r.percent, null, 'no share for a model call in flight, whatever the clock says');
eq(r.time, '42 s', 'elapsed from the attempt\'s start');
eq(r.typical, 'about 38 s, up to 1 min 10 s', 'the typical duration from history, with the long tail when it is long');
eq(r.slow, false, 'updated 2 s ago is not slow');
const stale = S.job(Object.assign({}, render, { progress: { activity: Object.assign({}, render.progress.activity, { at: now - 95000 }) } }), now);
eq(stale.slow, true, 'no update for 95 s is slow'); eq(stale.typical, '', 'no history, no typical');
// the copy stage: countable by channel
const copy = { id: 'c1', stage: 'copy', state: 'running', created: now - 20000, attempts: 0, progress: { activity: { phase: 'composing', label: 'laying out facebook (2 of 2)', completed: 1, total: 2, startedAt: now - 20000, at: now } } };
const c = S.job(copy, now); eq([c.completed, c.total, c.percent], [1, 2, 50], 'one of two channels laid out is 50%');
// finished, queued, waiting on an upstream step, and failed
eq(S.job({ id: 'd', stage: 'copy', state: 'done', created: now - 30000, updated: now - 1000, progress: { activity: { startedAt: now - 30000, endedAt: now - 1000, phase: 'done', label: 'finished' } } }, now).percent, 100, 'done is 100');
eq(S.job({ id: 'd', stage: 'copy', state: 'done', created: now - 30000, updated: now - 1000, progress: { activity: { startedAt: now - 30000, endedAt: now - 1000 } } }, now).time, '29 s', 'elapsed of a finished job runs to its end, not to now');
eq(S.job({ id: 'q', stage: 'inspect', state: 'queued', created: now, attempts: 0, after: 'r1' }, now).label, 'Waiting for the step before it', 'a gated step says it waits for its upstream');
eq(S.job({ id: 'q2', stage: 'render', state: 'queued', created: now, attempts: 1, error: 'overloaded (will retry)' }, now).label, 'Waiting to try again', 'a requeued attempt says it will try again');
eq(S.job({ id: 'f', stage: 'render', state: 'failed', created: now, attempts: 3, error: 'gemini_not_configured' }, now).label, 'Needs attention', 'a failure needs attention');
eq(S.job({ id: 'l', stage: 'direct', state: 'running', created: now - 5000, progress: { lines: [{ id: 1, kind: 'info', text: 'brief check: complete' }] } }, now).phaseText, 'brief check: complete', 'without a phase the latest log line stands in');
// a failed job with a live retry is history
const jobs = [{ id: 'f1', stage: 'render', state: 'failed', created: now - 9000, updated: now - 8000 }, { id: 'f1r', stage: 'render', state: 'queued', created: now - 7000, idem: 'retry:f1:1' }, { id: 'f2', stage: 'render', state: 'failed', created: now - 6000, updated: now - 6000 }, { id: 'd1', stage: 'copy', state: 'done', created: now - 60000, updated: now - 59000 }];
const shown = S.jobsForDisplay(jobs); eq(shown.map(j => j.id), ['f1r', 'f2', 'd1'], 'the retried failure is left out; live first, then failed, then the rest');
// the run: one burst of jobs around what is live now, counted by finished steps; old history is not part of it
const burst = [{ id: 'a', stage: 'copy', state: 'done', created: now - 100000, updated: now - 80000 }, { id: 'b', stage: 'render', state: 'done', created: now - 79000, updated: now - 40000 }, { id: 'c', stage: 'render', state: 'running', created: now - 79000 }, { id: 'd', stage: 'inspect', state: 'queued', created: now - 39000, after: 'b' }, { id: 'old', stage: 'copy', state: 'done', created: now - 3600000, updated: now - 3500000 }];
const run = S.run(burst, now); eq([run.total, run.done, run.active, run.percent], [4, 2, 2, 50], 'four steps in the burst, two finished: 50%; the hour-old job is not counted');
ok(/2 of 4 steps finished \(1 words and composition, 2 image generation, 1 creative director review\)/.test(run.text), 'the run text names the stages: ' + run.text);
eq(S.run([{ id: 'old', stage: 'copy', state: 'done', created: now - 3600000, updated: now - 3500000 }], now), null, 'nothing live and nothing recent: no run');
eq(S.typical({ n: 1, median: 5000 }), '', 'one sample is not a typical duration');
eq(S.typical({ n: 3, median: 125000, p80: 130000 }), 'about 2 min 5 s', 'minutes and seconds, no tail when it is short');
// S22: a streamed model call shows what has arrived - characters, never a share of an answer whose length is unknown
const reading = { id: 'a1', stage: 'analyse', state: 'running', created: now - 70000, attempts: 1, progress: { activity: { phase: 'model', step: 'model', completed: 2, total: 4, label: 'writing the answer: 12,345 characters so far', thinking: 2345, written: 12345, streamAt: now - 1000, startedAt: now - 70000, at: now - 1000 } } };
const a1 = S.job(reading, now);
eq([a1.streaming, a1.written, a1.thinking], [true, 12345, 2345], 'the counts the worker reported while the model writes');
eq(a1.streamText, '12,345 characters of the answer written', 'in words, with thousands marked');
eq([a1.completed, a1.total], [2, 4], 'the steps finished are counted apart from the characters');
const think = S.job({ id: 'a2', stage: 'analyse', state: 'running', created: now - 30000, attempts: 1, progress: { activity: { phase: 'model', thinking: 900, written: 0, streamAt: now - 25000, startedAt: now - 30000, at: now - 25000 } } }, now);
eq(think.streamText, 'thinking, 900 characters of reasoning so far', 'before the answer begins, the reasoning is counted');
eq(Math.round(think.quiet), 25, 'and how long since the model last sent anything');
eq(S.job({ id: 'a3', stage: 'analyse', state: 'running', created: now, attempts: 1, progress: { activity: { phase: 'knowledge', thinking: 50, written: 9 } } }, now).streaming, false, 'counts left from a model call do not show in a later phase');
eq(S.job(Object.assign({}, reading, { state: 'done' }), now).streaming, false, 'a finished job is not streaming');
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
