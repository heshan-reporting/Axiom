/* AXIOM - shared pieces for the React islands.
 *
 * Every island (Signals, the Release Desk, whatever comes next) needs the same
 * things: a worker call that sends the access key and turns the worker's error
 * shape into a thrown Error, number and time formatting, and the live console
 * that tails a job. They live here once. Islands read this as window.AXUI and
 * fail soft with a plain notice if the React runtime did not load.
 */
(function () {
  'use strict';
  if (!window.React || !window.ReactDOM || !window.htm) { window.AXUI = null; return; }
  const html = htm.bind(React.createElement);
  const { useEffect, useRef } = React;

  const base = () => (typeof csBase === 'function' ? csBase() : String(window.WORKER_URL || '').replace(/\/+$/, ''));
  const hdrs = () => (typeof axHeaders === 'function' ? axHeaders() : { 'Content-Type': 'application/json' });
  const scrub = s => (typeof axScrub === 'function' ? axScrub(s) : String(s || ''));
  async function call(path, body) {
    const r = await fetch(base() + path, body ? { method: 'POST', headers: hdrs(), body: JSON.stringify(body) } : { headers: hdrs() });
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok || d.error) { const e = new Error(scrub(d.detail || d.error || ('HTTP ' + r.status))); e.code = d.error || ''; e.status = r.status; throw e; }
    return d;
  }
  /* Private images (rendered tiles, logos) sit behind the access key, so an
     <img src> cannot fetch them. Pull the bytes with the key and hand back an
     object URL; callers revoke it when they are done. */
  async function blobUrl(path) {
    const r = await fetch(base() + path, { headers: hdrs() });
    if (!r.ok) { const e = new Error('HTTP ' + r.status); e.status = r.status; throw e; }
    return URL.createObjectURL(await r.blob());
  }
  const toastMsg = (m, bad) => { if (typeof toast === 'function') toast(m, bad); };
  const fmtN = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
  const ago = ts => { const s = (Date.now() - (+ts || 0)) / 1e3; if (!ts) return ''; if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; };
  const clock = ts => { const d = new Date(+ts || Date.now()); const p = n => (n < 10 ? '0' : '') + n; return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };
  const toneKey = t => (t < 0 ? 'h' : t > 0 ? 's' : 'n');
  const toneWord = t => (t < 0 ? 'hostile' : t > 0 ? 'supportive' : 'neutral');

  function Stat({ k, v, s, col }) {
    return html`<div class="sen-stat"><div class="k">${k}</div><div class="v" style=${col ? { color: col } : null}>${v}</div><div class="s">${s}</div></div>`;
  }
  /* The console: a job's own log, tailed. cmd lines are what was run, out lines
     what came back, err lines quoted exactly as the service said them. */
  function Console({ job, title, onCancel, canWrite }) {
    const boxRef = useRef(null);
    useEffect(() => { const el = boxRef.current; if (el && job && job.follow !== false) el.scrollTop = el.scrollHeight; }, [job && job.lines && job.lines.length, job && job.follow]);
    if (!job) return null;
    const running = job.status === 'running' || job.status === 'queued';
    return html`<div class="sig-con">
      <div class="sig-conhead">
        <span class=${'sig-dot ' + (running ? 'run' : job.success ? 'ok' : 'err')}></span>
        <b>${title || job.title || 'job'}</b>
        <span class="sig-where">${job.status === 'queued' ? 'waiting for a desktop collector' : job.agent ? 'running on ' + job.agent : job.status === 'running' ? 'running in the worker' : job.success ? 'finished' : 'failed'}</span>
        <span class="sig-where">${(job.lines || []).length} lines</span>
        ${running && canWrite && onCancel ? html`<button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onCancel}>Stop</button>` : null}
      </div>
      <div class="sig-conbox" ref=${boxRef}>
        ${!(job.lines || []).length ? html`<div class="sig-line info">waiting for the first line...</div>`
          : job.lines.map(l => html`<div key=${l.id} class=${'sig-line ' + l.kind}><span class="t">${clock(l.ts)}</span><span class="k">${l.kind === 'cmd' ? '$' : l.kind === 'err' ? '!' : l.kind === 'done' ? '=' : '>'}</span><span class="x">${l.text}</span></div>`)}
      </div>
    </div>`;
  }
  /* Tail a job until it stops. onLine gets the growing line list; onDone gets
     the final job. Returns a stop() function. */
  function tailJob(id, onUpdate, onDone, opts) {
    opts = opts || {};
    let cursor = 0, lines = [], timer = null, stopped = false, waited = 0;
    const tick = async () => {
      if (stopped) return;
      try {
        const d = await call('/bridge/job?id=' + encodeURIComponent(id) + '&after=' + cursor);
        cursor = d.cursor || cursor;
        if ((d.lines || []).length) lines = lines.concat(d.lines).slice(-500);
        const snap = { id, source: d.source, status: d.status, agent: d.agent, success: d.success, result: d.result, lines, follow: true };
        onUpdate(snap);
        if (d.status === 'running' || d.status === 'queued') {
          waited += 1.1;
          if (d.status === 'queued' && waited > (opts.queueLimit || 90)) { onDone(Object.assign({}, snap, { timedOut: true })); return; }
          timer = setTimeout(tick, opts.interval || 1100); return;
        }
        onDone(snap);
      } catch (e) { onDone({ id, status: 'lost', success: false, lines, error: e }); }
    };
    tick();
    return () => { stopped = true; if (timer) clearTimeout(timer); };
  }
  window.AXUI = { html, call, blobUrl, base, hdrs, scrub, toastMsg, fmtN, ago, clock, toneKey, toneWord, Stat, Console, tailJob };
})();
