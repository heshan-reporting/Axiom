/* STProgress: the job model behind the Studio's activity panel (docs/studio.js, WorkspaceActivity). Presentation only.
   A job's progress is what the worker reports while the attempt runs (progress.activity: phase, label, counts, times) and
   its log lines; a share is shown only where the work is countable (the copy stage's channels, a run's finished steps).
   Elapsed time is never turned into a completion percentage: a model call shows no share until it answers.
   Started as a ChatGPT draft (5 October 2026), rewritten here with the worker's real progress shape, the run grouping and
   the typical-duration reading. Loads before studio.js; also usable in Node for its tests. */
(function (root) {
  'use strict';
  const names = { render: 'Image generation', copy: 'Words and composition', direct: 'Creative directions', strategy: 'Creative strategy', concepts: 'Design exploration', extract: 'Source analysis', analyse: 'Brief analysis', kit: 'Message kit', inspect: 'Creative Director review', revise: 'Design revision', sequence: 'Campaign sequence', export: 'Export', echo: 'Connection check' };
  const active = j => !!j && (j.state === 'queued' || j.state === 'running');
  const percent = (done, total) => total > 0 ? Math.min(100, Math.max(0, Math.floor(done / total * 100))) : null;
  const fmt = s => { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60 ? (s % 60) + ' s' : ''); };
  /** A stage's typical duration from the worker's history ({n, median, p80} in ms): "about 40 s", or '' without history. */
  const typical = d => d && d.n >= 2 && d.median > 0 ? 'about ' + fmt(d.median / 1000).trim() + (d.p80 > d.median * 1.6 ? ', up to ' + fmt(d.p80 / 1000).trim() : '') : '';
  /** One job as the panel shows it. `dur` is the stage's duration history, if any. */
  function job(j, now, dur) {
    now = now || Date.now(); j = j || {};
    const a = (j.progress || {}).activity || {}; const lines = (j.progress || {}).lines || [];
    const running = j.state === 'running', queued = j.state === 'queued', terminal = !active(j);
    const total = Number(a.total) || 0;
    const completed = j.state === 'done' && total ? total : Math.min(total || 0, Math.max(0, Number(a.completed) || 0));
    const started = a.startedAt || j.created || now;
    const end = terminal ? (a.endedAt || j.updated || now) : now;
    const elapsed = Math.max(0, (end - started) / 1000);
    const lastAt = a.at || j.updated || j.created || now;
    const last = lines.length ? lines[lines.length - 1].text : '';
    const label = j.state === 'done' ? 'Completed' : j.state === 'cancelled' ? 'Cancelled' : j.state === 'failed' ? 'Needs attention'
      : queued ? (j.after ? 'Waiting for the step before it' : j.attempts ? 'Waiting to try again' : 'Queued, waiting to start') : 'Working';
    // the phase text is what the worker said it was doing, else its latest log line, else the state
    const phaseText = running && a.label ? a.label : running && last ? last : terminal && a.phase && a.phase !== 'done' && a.label && j.state !== 'done' ? a.label : label;
    const pct = j.state === 'done' ? 100 : running && total ? percent(completed, total) : null;
    return { title: names[j.stage] || j.stage || 'Job', label, phaseText, phase: a.phase || (running ? 'working' : j.state), running, queued, terminal, completed, total, percent: pct,
      elapsed, time: fmt(elapsed), typical: running || queued ? typical(dur) : '', lastAt, attempt: Math.max(1, (Number(j.attempts) || 0) + (running ? 0 : 0)),
      slow: running && now - lastAt > 90000, model: a.model || '' };
  }
  /** The jobs worth showing: a failure that has a live or finished retry is history, not a second thing to act on. */
  function jobsForDisplay(jobs) {
    const all = Array.isArray(jobs) ? jobs : [];
    return all.filter(j => !(j.state === 'failed' && all.some(n => n.id !== j.id && String(n.idem || '').indexOf('retry:' + j.id + ':') === 0 && n.state !== 'failed')))
      .sort((a, b) => Number(active(b)) - Number(active(a)) || Number(b.state === 'failed') - Number(a.state === 'failed') || (b.updated || b.created || 0) - (a.updated || a.created || 0));
  }
  /** The current run: the jobs created in one burst around whatever is live now (within ten minutes of it, the newest
      first; a project's old history is not a run). Counts finished steps - an honest share for a production of several
      compositions, renders and reviews. Null when nothing is live and nothing finished in the last two minutes. */
  function run(jobs, now) {
    now = now || Date.now(); const all = (Array.isArray(jobs) ? jobs : []).filter(j => j && j.created);
    const live = all.filter(active); const anchor = live.length ? Math.max.apply(null, live.map(j => j.created)) : Math.max.apply(null, all.filter(j => j.state === 'done' && now - (j.updated || 0) < 120000).map(j => j.created).concat([0]));
    if (!anchor) return null;
    const set = all.filter(j => Math.abs(j.created - anchor) < 600000);
    const done = set.filter(j => j.state === 'done').length, failed = set.filter(j => j.state === 'failed').length, cancelled = set.filter(j => j.state === 'cancelled').length;
    const total = set.length; const stages = {}; set.forEach(j => { stages[j.stage] = (stages[j.stage] || 0) + 1; });
    const text = Object.keys(stages).map(s => stages[s] + ' ' + (names[s] || s).toLowerCase()).join(', ');
    return { total, done, failed, cancelled, active: live.length, percent: percent(done + cancelled, total), stages, text: done + ' of ' + total + ' steps finished (' + text + ')' + (failed ? '; ' + failed + ' failed' : '') };
  }
  root.STProgress = { names, job, active, percent, jobsForDisplay, run, typical, fmt };
})(typeof window !== 'undefined' ? window : globalThis);
