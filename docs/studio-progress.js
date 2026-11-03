/* STProgress: the job model behind the Studio's activity panel (docs/studio.js, WorkspaceActivity). Presentation only.
   A job's progress is what the worker reports while the attempt runs (progress.activity: phase, label, counts, times) and
   its log lines. A measured share (percent) exists only where the work is countable (the copy stage's channels, a run's
   finished steps). Since concept C (3 November 2026) every wait also carries an estimate (est): the time so far against the
   stage's own median from the worker's history, or a stated rough guess when there is no history yet - always labelled as an
   estimate, never shown as measured, held under 95% until the worker reports the job done, and saying so when a job runs
   past its usual time. Since S22 a model call streams: while it runs the worker
   reports how many characters of reasoning and of the answer have arrived (thinking, written, streamAt) - counts, never a
   share, since the length of an answer is not known before it is written.
   Started as a ChatGPT draft (5 October 2026), rewritten here with the worker's real progress shape, the run grouping and
   the typical-duration reading. Loads before studio.js; also usable in Node for its tests. */
(function (root) {
  'use strict';
  const names = { render: 'Image generation', copy: 'Words and composition', direct: 'Creative directions', strategy: 'Creative strategy', concepts: 'Design exploration', extract: 'Source analysis', analyse: 'Brief analysis', kit: 'Message kit', inspect: 'Creative Director review', revise: 'Design revision', sequence: 'Campaign sequence', export: 'Export', echo: 'Connection check' };
  const active = j => !!j && (j.state === 'queued' || j.state === 'running');
  const percent = (done, total) => total > 0 ? Math.min(100, Math.max(0, Math.floor(done / total * 100))) : null;
  const thou = n => String(Math.max(0, Math.round(Number(n) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fmt = s => { s = Math.max(0, Math.round(s)); return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60 ? (s % 60) + ' s' : ''); };
  /** A stage's typical duration from the worker's history ({n, median, p80} in ms): "about 40 s", or '' without history. */
  const typical = d => d && d.n >= 2 && d.median > 0 ? 'about ' + fmt(d.median / 1000).trim() + (d.p80 > d.median * 1.6 ? ', up to ' + fmt(d.p80 / 1000).trim() : '') : '';
  /* a rough expected duration per stage, in seconds, used only until the worker has a history for that stage (two runs) */
  const GUESS = { analyse: 90, direct: 75, strategy: 60, copy: 90, concepts: 90, render: 45, inspect: 40, revise: 45, sequence: 75, kit: 60, extract: 30, export: 10, echo: 3 };
  /** The estimate for a waiting job: a measured share when the work is countable, else the time so far against the stage's
      median (or the rough guess), capped at 95% while it runs. { percent, measured, basis count|history|guess, expected, left,
      over, text }. */
  function estimate(j, elapsed, dur, measured) {
    if (j.state === 'done') return { percent: 100, measured: true, basis: 'count', text: 'done' };
    if (j.state !== 'running' && j.state !== 'queued') return null;
    if (j.state === 'queued') return { percent: 0, measured: false, basis: 'queue', text: 'not started yet' };
    if (measured != null) return { percent: measured, measured: true, basis: 'count', text: measured + '% (counted)' };
    const hist = dur && dur.n >= 2 && dur.median > 0; const expected = hist ? dur.median / 1000 : (GUESS[j.stage] || 60);
    const raw = elapsed / Math.max(1, expected); const over = raw > 1;
    // past the usual time the estimate creeps towards 95% rather than stopping, so a long job still shows it is alive
    const pct = Math.max(1, Math.min(95, Math.floor(over ? 90 + Math.min(5, (raw - 1) * 5) : raw * 90)));
    const left = Math.max(0, expected - elapsed);
    const basis = hist ? 'history' : 'guess';
    const why = hist ? 'estimate from the last ' + dur.n + ' runs' : 'rough estimate: no history for this step yet';
    const text = '~' + pct + '% (' + why + ')' + (over ? ', taking longer than the usual ' + fmt(expected).trim() : left >= 1 ? ', about ' + fmt(left).trim() + ' left' : ', nearly done');
    return { percent: pct, measured: false, basis, expected: Math.round(expected), left: Math.round(left), over, text };
  }
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
    // a streamed model call: what has arrived so far, and how long since the model last sent anything
    const thinking = Number(a.thinking) || 0, written = Number(a.written) || 0;
    const streaming = running && a.phase === 'model' && (thinking > 0 || written > 0 || Number(a.streamAt) > 0);
    const streamText = !streaming ? '' : written ? thou(written) + ' characters of the answer written' : thinking ? 'thinking, ' + thou(thinking) + ' characters of reasoning so far' : 'the model has started';
    const quiet = streaming && Number(a.streamAt) > 0 ? Math.max(0, (now - Number(a.streamAt)) / 1000) : 0;
    // S24: what the job has sent, from the worker's own record of each request (an image job counts against its policy cap), and a
    // cancel said as its three facts: asked for; no further request will start; what was already sent and cannot be recalled
    const reqs = Array.isArray(j.requests) ? j.requests : []; const capImg = j.caps && j.caps.image ? j.caps.image : 0;
    const unknown = reqs.filter(r => r.outcome === 'unknown' || r.outcome === 'abandoned').length;
    const requestText = running && a.request ? 'request ' + a.request + (a.of ? ' of ' + a.of : '') + ' to the image model' + (a.fallback ? ' (a fallback model)' : '') + (a.retry ? ', trying again' : '')
      : reqs.length ? reqs.length + ' request' + (reqs.length === 1 ? '' : 's') + ' sent' + (capImg && j.stage === 'render' ? ' of the ' + capImg + ' the policy allows' : '') + (unknown ? '; ' + unknown + ' with no answer (may still have been processed and billed)' : '') : '';
    const c = j.cancel || null;
    const cancelText = j.state === 'cancelled' && c ? 'Cancel requested' + (c.by ? ' by ' + c.by : '') + '. No further request will start.' + (c.inFlight ? ' ' + c.inFlight + ' request' + (c.inFlight === 1 ? '' : 's') + ' already sent could not be recalled' + (c.models && c.models.length ? ' (' + c.models.join(', ') + ')' : '') + ': it may still complete and be billed; nothing from it is filed.' : c.wasRunning ? ' Nothing was in flight.' : ' Nothing had been sent.') : '';
    const est = estimate(j, elapsed, dur, j.state === 'done' ? 100 : running && total ? pct : null);
    return { title: names[j.stage] || j.stage || 'Job', label, phaseText, phase: a.phase || (running ? 'working' : j.state), running, queued, terminal, completed, total, percent: pct, est,
      elapsed, time: fmt(elapsed), typical: running || queued ? typical(dur) : '', lastAt, attempt: Math.max(1, (Number(j.attempts) || 0) + (running ? 0 : 0)),
      slow: running && now - lastAt > 90000, model: a.model || '', streaming, thinking, written, streamText, quiet, requestText, cancelText, requests: reqs.length, unknown };
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
  /** S27: two snapshots of one job, from answers that can arrive out of order (a poll every 2.5 s, a step answer, a whole-project
      reload that was asked for before a poll): keep the newer, so a count, a phase or a finished state never goes backwards. The
      worker stamps `updated` on every progress write and state change, and counts attempts up; an older attempt never wins, a
      later stamp wins, and on a tie a finished state wins over a running one. */
  const stampOf = j => { const a = (j && j.progress && j.progress.activity) || {}; return Math.max(Number(j && j.updated) || 0, Number(a.at) || 0, Number(a.endedAt) || 0); };
  function fresher(a, b) {
    if (!a) return b; if (!b) return a;
    const na = Number(a.attempts) || 0, nb = Number(b.attempts) || 0; if (na !== nb) return nb > na ? b : a;
    const ta = stampOf(a), tb = stampOf(b); if (ta !== tb) return tb > ta ? b : a;
    if (!active(a) && active(b)) return a;
    return b;
  }
  /** A list of jobs answered by the worker, laid over the list already shown: each job keeps whichever snapshot is newer. */
  function mergeJobs(held, incoming) { const by = {}; (held || []).forEach(j => { if (j && j.id) by[j.id] = j; }); return (incoming || []).map(j => { const h = j && by[j.id]; return h && fresher(h, j) === h ? h : j; }); }
  root.STProgress = { names, job, active, percent, estimate, GUESS, jobsForDisplay, run, typical, fmt, thou, fresher, mergeJobs };
})(typeof window !== 'undefined' ? window : globalThis);
