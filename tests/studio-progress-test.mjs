import '../docs/studio-progress.js';
import { suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-progress (honest percentages and recovery states)');
const P = globalThis.STProgress;
const j = { id: 'a', state: 'running', stage: 'render', attempts: 1, created: 1000, updated: 2000, progress: { activity: { phase: 'generate', completed: 1, total: 4, startedAt: 1000, at: 2000, label: 'Waiting for the model' } } };
await T.t('a slow provider never advances its percentage just because time passes', () => {
  eq(P.job(j, 5000).percent, 25); eq(P.job(j, 200000).percent, 25); ok(P.job(j, 200000).slow); eq(P.job(j, 5000).attempt, 1);
});
await T.t('queued and old-worker jobs are indeterminate; never invent percentages', () => {
  eq(P.job({ ...j, state: 'queued' }).percent, null);
  eq(P.job({ ...j, progress: {} }).percent, null);
});
await T.t('only success reaches 100%; failure and cancellation are not success', () => {
  eq(P.job({ ...j, state: 'done' }).percent, 100);
  eq(P.job({ ...j, state: 'failed' }).percent, null);
  eq(P.job({ ...j, state: 'cancelled' }).percent, null);
  eq(P.job({ ...j, progress: { activity: { completed: 4, total: 4 } } }).percent, 75);
});
await T.t('elapsed durations use whole seconds and stop when a job ends', () => {
  eq(P.job(j, 4999).time, '3s');
  eq(P.job({ ...j, state: 'done', updated: 63000 }, 999999).time, '1m 2s');
});
await T.t('a replacement retry removes the original failure from actionable cards, not from history', () => {
  const old = { id: 'failed', state: 'failed' }, retry = { id: 'retry', state: 'running', idem: 'retry:failed:0' };
  eq(P.jobsForDisplay([old, retry]).map(x => x.id), ['retry']); eq(old.state, 'failed');
});
await T.t('empty work is not shown as 100%; counts are bounded', () => {
  eq(P.percent(0, 0), null); eq(P.percent(2, 3), 66); eq(P.percent(5, 3), 100);
});
process.exitCode = T.done().fail ? 1 : 0;
