/* Presentation-only progress. Never use elapsed time to invent a model completion percentage. */
(function (root) {
  'use strict';
  const names = { render: 'Image generation', copy: 'Copy & composition', direct: 'Creative directions', strategy: 'Creative strategy', concepts: 'Design exploration', extract: 'Source analysis', inspect: 'Art Director review', revise: 'Design revision', sequence: 'Campaign planning', export: 'Export package', echo: 'Connection check' };
  const active = j => j && (j.state === 'queued' || j.state === 'running');
  const percent = (done, total) => total > 0 ? Math.min(100, Math.max(0, Math.floor(done / total * 100))) : null;
  function job(j, now) {
    const a = (j.progress || {}).activity || {};
    const running = j.state === 'running', queued = j.state === 'queued', terminal = !active(j);
    const total = Number(a.total) || 0;
    const completed = j.state === 'done' ? total : Math.min(Math.max(0, total - 1), Math.max(0, Number(a.completed) || 0));
    const end = (terminal ? j.updated || a.at || j.created : now) || Date.now();
    const elapsed = Math.max(0, Math.floor((end - (a.startedAt || j.created || end)) / 1000));
    const label = j.state === 'done' ? 'Completed' : j.state === 'cancelled' ? 'Cancelled' : j.state === 'failed' ? 'Needs attention' : queued ? (j.after ? 'Waiting for the previous step' : j.error ? 'Waiting to retry' : 'Queued; waiting to start') : a.label || 'Working; waiting for the next update';
    const pct = j.state === 'done' ? 100 : total && running ? percent(completed, total) : null;
    return { title: names[j.stage] || j.stage, label, running, queued, terminal, completed, total, percent: pct, elapsed,
      time: elapsed < 60 ? elapsed + 's' : Math.floor(elapsed / 60) + 'm ' + elapsed % 60 + 's',
      attempt: Number(j.attempts) || 0,
      waiting: running && /generate|work/.test(a.phase || ''),
      slow: running && (now || Date.now()) - (a.at || j.updated || j.created || now) > 90000 };
  }
  function jobsForDisplay(jobs) {
    const all = Array.isArray(jobs) ? jobs : [];
    // A retried failure remains in history, not as a second actionable failure next to its replacement.
    return all.filter(j => !(j.state === 'failed' && all.some(n => n.id !== j.id && (n.idem || '').indexOf('retry:' + j.id + ':') === 0 && n.state !== 'failed')))
      .sort((a, b) => Number(active(b)) - Number(active(a)) || Number(b.state === 'failed') - Number(a.state === 'failed') || (b.updated || b.created || 0) - (a.updated || a.created || 0));
  }
  root.STProgress = { job, active, percent, jobsForDisplay };
})(typeof window !== 'undefined' ? window : globalThis);
