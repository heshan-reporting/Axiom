/* AXIOM - Signals. What Reddit, X, LinkedIn and Meta are saying about our
 * clients, and the console that shows the collection happening.
 *
 * A React island (React, ReactDOM and htm are vendored under docs/vendor, never
 * a CDN). Sweep does not run in the browser: it creates a JOB in the worker.
 * Sources the worker can reach run there; the ones that need a logged-in
 * machine - X above all - are claimed by tools/reach-agent.py on the operator's
 * Mac. Either way this view tails the same job log, so every command and its
 * answer appears here while it happens.
 *
 * The Audience view (Supermetrics ad comments and campaign performance) is a
 * different section and is untouched by any of this.
 */
(function () {
  'use strict';
  if (!window.React || !window.ReactDOM || !window.htm) {
    window.signalsInit = function () {
      const root = document.getElementById('signals-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const html = htm.bind(React.createElement);
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  /* ---- worker access, shared with the rest of the app ------------------- */
  const base = () => (typeof csBase === 'function' ? csBase() : String(window.WORKER_URL || '').replace(/\/+$/, ''));
  const hdrs = () => (typeof axHeaders === 'function' ? axHeaders() : { 'Content-Type': 'application/json' });
  const scrub = s => (typeof axScrub === 'function' ? axScrub(s) : String(s || ''));
  async function call(path, body) {
    const r = await fetch(base() + path, body ? { method: 'POST', headers: hdrs(), body: JSON.stringify(body) } : { headers: hdrs() });
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok || d.error) { const e = new Error(scrub(d.detail || d.error || ('HTTP ' + r.status))); e.code = d.error || ''; e.status = r.status; throw e; }
    return d;
  }
  const issues = () => (typeof AX_ISSUES !== 'undefined' ? AX_ISSUES : []);
  const clients = () => (typeof CC_CLIENTS !== 'undefined' && Array.isArray(CC_CLIENTS) ? CC_CLIENTS : []);
  const toastMsg = (m, bad) => { if (typeof toast === 'function') toast(m, bad); };
  const ISSUE_LABEL = id => { const i = issues().find(x => x.id === id); return i ? i.label : id; };

  /* Every platform this view collects. `desktop` means only a logged-in
     machine can read it, so the job waits for tools/reach-agent.py. */
  const PLATFORMS = [
    { id: 'reddit', label: 'Reddit', unit: 'thread', channel: 'sub', prefix: 'r/', colour: '#FF6314', desktop: false,
      about: 'The AU political subreddits plus the client keywords searched across all of Reddit.' },
    { id: 'x', label: 'X', unit: 'post', channel: '', prefix: '', colour: '#C9D2E0', desktop: true,
      about: 'The client keywords searched on X, and the replies under the posts that draw argument.' },
    { id: 'linkedin', label: 'LinkedIn', unit: 'post', channel: 'page', prefix: '', colour: '#4A9BE0', desktop: false,
      about: 'The clients\' own LinkedIn pages: posts and the comments underneath, through LinkedIn\'s API.' },
    { id: 'meta', label: 'Meta', unit: 'post', channel: 'page', prefix: '', colour: '#5A8DEE', desktop: false,
      about: 'The clients\' own Facebook and Instagram pages: organic posts and their comments, through the Graph API. Ad comments stay in Audience.' },
  ];
  const P = id => PLATFORMS.find(p => p.id === id) || PLATFORMS[0];

  /* ---- small helpers ---------------------------------------------------- */
  const fmtN = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
  const ago = ts => { const s = (Date.now() - (+ts || 0)) / 1e3; if (!ts) return ''; if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; };
  const clock = ts => { const d = new Date(+ts || Date.now()); const p = n => (n < 10 ? '0' : '') + n; return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); };
  const toneKey = t => (t < 0 ? 'h' : t > 0 ? 's' : 'n');
  const toneWord = t => (t < 0 ? 'hostile' : t > 0 ? 'supportive' : 'neutral');

  /* ---- components -------------------------------------------------------- */
  function Stat({ k, v, s, col }) {
    return html`<div class="sen-stat"><div class="k">${k}</div><div class="v" style=${col ? { color: col } : null}>${v}</div><div class="s">${s}</div></div>`;
  }
  function ToneBar({ held }) {
    if (!held || !held.n) return html`<span class="rd-chip" title="No comments collected under this post yet">no comments held</span>`;
    const h = held.hostile / held.n * 100, s = held.supportive / held.n * 100;
    return html`<span class="rd-tone" title=${held.hostile + ' hostile, ' + held.supportive + ' supportive of ' + held.n + ' comments held'}>
      <i style=${{ width: h + '%', background: '#E05A54' }}></i><i style=${{ width: (100 - h - s) + '%', background: 'rgba(255,255,255,.18)' }}></i><i style=${{ width: s + '%', background: '#22D993' }}></i></span>`;
  }
  function IssueChips({ ids }) {
    return html`${(ids || []).slice(0, 3).map(id => html`<span key=${id} class="rd-chip i">${ISSUE_LABEL(id)}</span>`)}`;
  }
  function ThreadRow({ t, plat, checked, open, onToggle, onOpen }) {
    return html`<div class=${'rd-th' + (open ? ' on' : '')} onClick=${() => onOpen(t)}>
      <input type="checkbox" checked=${checked} onClick=${e => e.stopPropagation()} onChange=${() => onToggle(t.id)} aria-label="Select post" />
      <div>
        <div class="t"><a href=${t.url} target="_blank" rel="noopener" onClick=${e => e.stopPropagation()}>${t.title}</a></div>
        <div class="m">
          ${t.channel ? html`<span class="rd-sub" style=${{ color: plat.colour }}>${plat.prefix}${t.channel}</span>` : html`<span class="rd-sub" style=${{ color: plat.colour }}>${plat.label}</span>`}
          <span>${fmtN(t.score)} reactions</span>
          <span>${fmtN(t.comments)} comments</span>
          <span>${ago(t.ts)} ago</span>
          ${t.q ? html`<span class="rd-chip" title="Found by this client keyword">${t.q}</span>` : null}
          <${IssueChips} ids=${t.issues} />
          <${ToneBar} held=${t.held} />
        </div>
      </div>
    </div>`;
  }
  function Comments({ thread, platform, canWrite }) {
    const [state, set] = useState({ rows: null, err: '', busy: false, live: false, filter: 'all' });
    const load = useCallback(async (live) => {
      if (!thread) return;
      set(s => Object.assign({}, s, { busy: true, err: '' }));
      try {
        const d = live && platform === 'reddit'
          ? await call('/reddit/comments?thread=' + encodeURIComponent(thread.id) + '&live=1')
          : await call('/signals/comments?platform=' + platform + '&thread=' + encodeURIComponent(thread.id));
        set(s => Object.assign({}, s, { rows: d.comments || [], live: !!d.live, busy: false }));
      } catch (e) { set(s => Object.assign({}, s, { err: e.message, busy: false, rows: s.rows || [] })); }
    }, [thread && thread.id, platform]);
    useEffect(() => { set({ rows: null, err: '', busy: false, live: false, filter: 'all' }); load(false); }, [load]);
    if (!thread) return html`<div class="empty">Pick a post to read its comments.</div>`;
    const rows = (state.rows || []).filter(c => state.filter === 'all' || String(c.tone) === state.filter);
    const tot = (state.rows || []).length, hos = (state.rows || []).filter(c => c.tone < 0).length, sup = (state.rows || []).filter(c => c.tone > 0).length;
    return html`<div>
      <div class="rd-ctl" style=${{ marginBottom: 8 }}>
        <select class="sel" value=${state.filter} onChange=${e => set(s => Object.assign({}, s, { filter: e.target.value }))} style=${{ padding: '6px 10px', fontSize: 11 }}>
          <option value="all">All (${tot})</option><option value="-1">Hostile (${hos})</option><option value="1">Supportive (${sup})</option><option value="0">Neutral (${tot - hos - sup})</option>
        </select>
        ${canWrite && platform === 'reddit' ? html`<button class="btn sm ghost" disabled=${state.busy} onClick=${() => load(true)} title="Fetch the current comment tree from Reddit and file it">${state.busy ? 'Fetching...' : 'Load live comments'}</button>` : null}
        ${state.live ? html`<span class="rd-chip">live</span>` : null}
        <a class="aud-src" href=${thread.url} target="_blank" rel="noopener" style=${{ marginLeft: 'auto' }}>Open on ${P(platform).label} ${'↗'}</a>
      </div>
      ${state.err ? html`<div class="rd-res err">${state.err}</div>` : null}
      <div class="rd-cm">
        ${state.rows === null ? html`<div class="empty">Loading comments...</div>`
          : !rows.length ? html`<div class="empty">${tot ? 'No comments match this filter.' : 'No comments on file for this post. A sweep will collect them.'}</div>`
          : rows.map((c, i) => html`<div key=${i} class=${'aud-c ' + toneKey(c.tone)}>
              <div class="b">${c.body}</div>
              <div class="m"><span class=${'tn ' + toneKey(c.tone)}>${toneWord(c.tone)}</span><span>${fmtN(c.score)}</span><span>${ago(c.ts)} ago</span><${IssueChips} ids=${c.issues} /></div>
            </div>`)}
      </div>
    </div>`;
  }
  function Analysis({ a, meta }) {
    if (!a) return null;
    const list = (arr, cls) => (arr || []).length ? html`<ul class=${cls} style=${{ margin: '0 0 6px 18px', fontSize: 12.5, color: 'var(--t2)' }}>${arr.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>` : null;
    return html`<div class="aud-ai">
      <div class="sum">${a.summary || ''}</div>
      <h4>Themes · from ${meta.threads} posts, ${meta.comments} comments</h4>
      ${(a.themes || []).map((th, i) => html`<div key=${i} class="aud-theme"><div class="th"><div>${th.theme}</div><span>${th.stance} · ${th.share}</span></div>${(th.quotes || []).slice(0, 2).map((q, j) => html`<div key=${j} class="q">"${q}"</div>`)}${th.read ? html`<div class="r">${th.read}</div>` : null}</div>`)}
      ${(a.attackLines || []).length ? html`<h4>Lines used against us</h4>${list(a.attackLines)}` : null}
      ${(a.supportLines || []).length ? html`<h4>Lines in our favour</h4>${list(a.supportLines)}` : null}
      ${(a.risks || []).length ? html`<h4>Risks</h4>${list(a.risks)}` : null}
      ${(a.openings || []).length ? html`<h4>Openings</h4>${list(a.openings)}` : null}
      ${(a.replies || []).length ? html`<h4>Ready replies</h4>${a.replies.map((x, i) => html`<div key=${i} class="aud-resp"><small>${x.to}</small>${x.line}</div>`)}` : null}
    </div>`;
  }

  /* The console: the job's own log, tailed. cmd lines are what was run, out
     lines are what came back, err lines are quoted exactly as the service
     said them. This is the thing that makes a sweep legible while it runs. */
  function Console({ job, onCancel, canWrite }) {
    const boxRef = useRef(null);
    useEffect(() => { const el = boxRef.current; if (el && job && job.follow) el.scrollTop = el.scrollHeight; }, [job && job.lines && job.lines.length, job && job.follow]);
    if (!job) return null;
    const running = job.status === 'running' || job.status === 'queued';
    return html`<div class="sig-con">
      <div class="sig-conhead">
        <span class=${'sig-dot ' + (running ? 'run' : job.success ? 'ok' : 'err')}></span>
        <b>${job.source ? P(job.source).label : ''} sweep</b>
        <span class="sig-where">${job.status === 'queued' ? 'waiting for a desktop collector' : job.agent ? 'running on ' + job.agent : job.status === 'running' ? 'running in the worker' : job.success ? 'finished' : 'failed'}</span>
        <span class="sig-where">${(job.lines || []).length} lines</span>
        ${running && canWrite ? html`<button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onCancel}>Stop</button>` : null}
      </div>
      <div class="sig-conbox" ref=${boxRef}>
        ${!(job.lines || []).length ? html`<div class="sig-line info">waiting for the collector to report...</div>`
          : job.lines.map(l => html`<div key=${l.id} class=${'sig-line ' + l.kind}><span class="t">${clock(l.ts)}</span><span class="k">${l.kind === 'cmd' ? '$' : l.kind === 'err' ? '!' : l.kind === 'done' ? '=' : '>'}</span><span class="x">${l.text}</span></div>`)}
      </div>
    </div>`;
  }

  function Notice({ err, have, plat, cfg, needsAgent, agentHere, canWrite, onSweep, busy }) {
    const e = String((err && err.message) || '');
    const code = (err && err.code) || '';
    let body;
    if (err && (code === 'not_found' || err.status === 404)) body = html`<b>The worker needs updating.</b> The live Cloudflare worker does not have the <code>/signals</code> and <code>/bridge</code> routes. Paste the latest <code>axiomworkerv4.js</code> into newsaus and Deploy, then reload.`;
    else if (err && (code === 'unauthorized' || err.status === 401)) body = html`<b>No access key.</b> Open Settings, paste your key, save, then reload.`;
    else if (err && code === 'mind_unbound') body = html`<b>Database not bound.</b> Cloudflare, newsaus, Settings, Bindings must include the D1 database as <code>MIND_DB</code>.`;
    else if (err) body = html`<b>The worker returned an error:</b> <code>${e}</code>`;
    else if (cfg && cfg.ready === false && cfg.detail) body = html`<b>${plat.label} is not connected yet.</b> ${cfg.detail}`;
    else if (needsAgent && !agentHere) body = html`<b>${plat.label} is collected from your Mac.</b> Nothing is connected right now. In Terminal: <code>cd ~/Axiom && python3 tools/reach-agent.py --key $AXIOM_KEY</code>. Leave it running (or install it with <code>--install-launchd</code>) and the Sweep button here will drive it, with every command shown live.`;
    else if (!have || !have.total) body = html`<b>Nothing collected yet.</b> ${plat.about} ${canWrite ? html`Press <b>Sweep</b> and watch the console.` : 'Ask a full-access user to run the first sweep.'}`;
    else body = html`<b>No posts match this scope.</b> ${fmtN(have.total)} ${plat.label} ${plat.unit}s are on file. Widen the window, clear the issue filter, or clear the search.`;
    return html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}>${body}${!err && canWrite ? html`<div class="aud-diagwrap"><button class="btn sm" disabled=${busy} onClick=${onSweep}>${busy ? 'Sweeping...' : 'Sweep ' + plat.label}</button></div>` : null}</div>`;
  }

  function SignalsApp() {
    const [tab, setTab] = useState('reddit');
    const [f, setF] = useState({ days: 7, issue: '', q: '', channel: '' });
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [status, setStatus] = useState(null);
    const [busy, setBusy] = useState({ load: false, sweep: false, analyse: false, mind: false });
    const [sel, setSel] = useState(() => new Set());
    const [open, setOpen] = useState(null);
    const [ns, setNs] = useState('cmm');
    const [analysis, setAnalysis] = useState(null);
    const [result, setResult] = useState(null);
    const [job, setJob] = useState(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const qRef = useRef(null);
    const pollRef = useRef(null);
    const plat = P(tab);

    const load = useCallback(async () => {
      setBusy(b => Object.assign({}, b, { load: true }));
      try {
        const d = await call('/signals/threads?platform=' + tab + '&days=' + f.days + '&issue=' + encodeURIComponent(f.issue) + '&channel=' + encodeURIComponent(f.channel) + '&q=' + encodeURIComponent(f.q) + '&limit=80');
        setData(d); setErr(null);
      } catch (e) { setData(null); setErr(e); }
      setBusy(b => Object.assign({}, b, { load: false }));
    }, [tab, f.days, f.issue, f.channel, f.q]);
    useEffect(() => { setOpen(null); setSel(new Set()); setAnalysis(null); load(); }, [load]);
    // a platform change is a different set of channels: never carry one across
    useEffect(() => { setF(x => (x.channel ? Object.assign({}, x, { channel: '' }) : x)); }, [tab]);

    const refreshStatus = useCallback(async () => {
      try { setStatus(await call('/signals/status')); } catch (e) { /* the threads call already reported it */ }
    }, []);
    // re-read on every tab change: whether a collector is connected is the
    // first thing you need to know before pressing Sweep
    useEffect(() => { refreshStatus(); }, [refreshStatus, tab]);

    /* Tail a job: poll its log until it finishes, appending lines. */
    const follow = useCallback((id) => {
      if (pollRef.current) clearTimeout(pollRef.current);
      let cursor = 0, lines = [], waited = 0;
      const tick = async () => {
        try {
          const d = await call('/bridge/job?id=' + encodeURIComponent(id) + '&after=' + cursor);
          cursor = d.cursor || cursor;
          if ((d.lines || []).length) lines = lines.concat(d.lines).slice(-500);
          setJob({ id: id, source: d.source, status: d.status, agent: d.agent, success: d.success, result: d.result, lines: lines, follow: true });
          if (d.status === 'running' || d.status === 'queued') {
            waited += 1.1;
            // a queued job with nobody to take it should say so rather than spin
            if (d.status === 'queued' && waited > 90) {
              setBusy(b => Object.assign({}, b, { sweep: false }));
              setResult({ ok: false, text: 'The job is still waiting for a collector. Start it on your Mac: cd ~/Axiom && python3 tools/reach-agent.py --key $AXIOM_KEY - it will pick this job up, and the console here will fill in.' });
              return;
            }
            pollRef.current = setTimeout(tick, 1100); return;
          }
          setBusy(b => Object.assign({}, b, { sweep: false }));
          const r = d.result || {};
          if (d.success) {
            const filed = (r.threadRows || 0) + ' new ' + plat.unit + 's and ' + (r.commentRows || 0) + ' new comments filed';
            setResult({ ok: true, text: 'Sweep finished: ' + (r.threads || 0) + ' ' + plat.unit + 's, ' + (r.comments || 0) + ' comments seen, ' + filed + (r.hostile ? '; ' + r.hostile + ' hostile' : '') + '.' });
            toastMsg('Sweep done');
          } else {
            setResult({ ok: false, text: 'Sweep failed: ' + scrub(r.detail || r.error || 'see the console above') });
            toastMsg('Sweep failed', true);
          }
          await load(); await refreshStatus();
        } catch (e) {
          setBusy(b => Object.assign({}, b, { sweep: false }));
          setResult({ ok: false, text: 'Lost the job: ' + e.message });
        }
      };
      tick();
    }, [load, refreshStatus, plat.unit]);
    useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

    const sweep = async () => {
      setBusy(b => Object.assign({}, b, { sweep: true })); setResult(null); setJob(null);
      try {
        const d = await call('/bridge/run', { source: tab, params: { issue: f.issue || undefined, queries: 'auto', time: f.days <= 1 ? 'day' : f.days <= 7 ? 'week' : 'month' } });
        setJob({ id: d.id, source: tab, status: d.where === 'worker' ? 'running' : 'queued', lines: [], follow: true });
        follow(d.id);
      } catch (e) {
        setBusy(b => Object.assign({}, b, { sweep: false }));
        setResult({ ok: false, text: 'Could not start the sweep: ' + e.message });
      }
    };
    const cancel = async () => {
      if (!job) return;
      try { await call('/bridge/cancel', { job: job.id }); toastMsg('Sweep stopped'); } catch (e) { toastMsg('Could not stop it', true); }
    };
    const analyse = async () => {
      setBusy(b => Object.assign({}, b, { analyse: true })); setAnalysis(null); setResult(null);
      try {
        const r = await call('/signals/analyse', { platform: tab, threads: [...sel], issue: f.issue, days: f.days, ns });
        setAnalysis(r);
        if (typeof arcLog === 'function') arcLog('signals', 'assistant', (plat.label + ' analysis ' + ns + ': ' + (r.analysis && r.analysis.summary || '')).slice(0, 2000));
      } catch (e) { setResult({ ok: false, text: 'Analysis: ' + e.message }); }
      setBusy(b => Object.assign({}, b, { analyse: false }));
    };
    const sendToMind = async () => {
      if (!sel.size) return;
      setBusy(b => Object.assign({}, b, { mind: true })); setResult(null);
      try { const r = await call('/signals/mind', { platform: tab, threads: [...sel], ns }); setResult({ ok: true, text: 'Filed in the Mind under ' + r.ns + ': "' + r.title + '" - ' + r.threads + ' posts, ' + r.comments + ' comments, ' + r.chunks + ' chunks (doc ' + r.docId + '). Briefs and the Analyst can now retrieve it.' }); toastMsg('Sent to the Mind'); setSel(new Set()); }
      catch (e) { setResult({ ok: false, text: 'Send to the Mind: ' + e.message }); toastMsg('Could not send', true); }
      setBusy(b => Object.assign({}, b, { mind: false }));
    };
    const toggle = id => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

    const threads = (data && data.threads) || [];
    const allSel = threads.length && threads.every(t => sel.has(t.id));
    const byPlat = (status && status.byPlatform) || {};
    const mine = byPlat[tab] || {};
    const hostileShare = mine.comments ? Math.round((mine.hostile || 0) / mine.comments * 100) : null;
    const chanList = (data && data.channels) || [];
    const chanTop = useMemo(() => {
      const m = {}; threads.forEach(t => { if (t.channel) m[t.channel] = (m[t.channel] || 0) + 1; });
      const top = Object.keys(m).sort((a, b) => m[b] - m[a])[0];
      return top ? { name: top, n: m[top] } : null;
    }, [threads]);
    const cfg = (status && status.configured && status.configured[tab]) || null;
    const agents = (status && status.agents) || [];
    const liveAgent = agents.filter(a => a.live);
    // Reddit is nominally worker-side, but it refuses Cloudflare's network: with
    // no app credentials it needs the Mac just as much as X does
    const wantsAgent = plat.desktop || (tab === 'reddit' && !!(cfg && cfg.detail));
    const agentFor = liveAgent.filter(a => (a.sources || []).indexOf(tab) >= 0);
    const clientOpts = useMemo(() => [{ id: 'cmm', name: 'Curious Minds (shared)' }].concat(clients().filter(c => c.id !== 'cmm').map(c => ({ id: c.id, name: c.short || c.name }))), []);

    return html`<div class="rd-wrap">
      <div class="sig-tabs" role="tablist">
        ${PLATFORMS.map(p => {
          const s = byPlat[p.id] || {};
          return html`<button key=${p.id} role="tab" aria-selected=${tab === p.id} class=${'sig-tab' + (tab === p.id ? ' on' : '')} onClick=${() => setTab(p.id)}>
            <span class="dot" style=${{ background: p.colour }}></span>${p.label}
            <span class="n">${fmtN(s.threads || 0)}</span>
            ${p.desktop ? html`<span class="rd-chip" title="Collected from a logged-in machine">desktop</span>` : null}
          </button>`;
        })}
        <span class=${'sig-agent' + (liveAgent.length ? ' on' : '')} title=${liveAgent.length ? 'Collectors connected: ' + liveAgent.map(a => a.agent + ' (' + (a.sources || []).join(', ') + ')').join('; ') : 'No desktop collector is connected. Run tools/reach-agent.py on your Mac.'}>
          ${liveAgent.length ? liveAgent.length + ' collector' + (liveAgent.length === 1 ? '' : 's') + ' connected' : 'no collector connected'}
        </span>
      </div>
      <div class="rd-ctl">
        ${(chanList.length > 1 || f.channel) ? html`<select class="sel" value=${f.channel} onChange=${e => setF(x => Object.assign({}, x, { channel: e.target.value }))} aria-label=${plat.id === 'reddit' ? 'Subreddit' : 'Page'}>
          <option value="">${plat.id === 'reddit' ? 'All subreddits' : 'All pages'}</option>${chanList.map(c => html`<option key=${c.channel} value=${c.channel}>${plat.prefix}${c.channel} (${c.n})</option>`)}
        </select>` : null}
        <select class="sel" value=${f.days} onChange=${e => setF(x => Object.assign({}, x, { days: +e.target.value }))} aria-label="Window">
          <option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
        </select>
        <select class="sel" value=${f.issue} onChange=${e => setF(x => Object.assign({}, x, { issue: e.target.value }))} aria-label="Issue">
          <option value="">All issues</option>${issues().map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}
        </select>
        <input class="fi" ref=${qRef} placeholder=${'Search ' + plat.label + ' ' + plat.unit + 's...'} defaultValue=${f.q} onKeyDown=${e => { if (e.key === 'Enter') setF(x => Object.assign({}, x, { q: e.target.value.trim() })); }} aria-label="Search" />
        ${canWrite ? html`<button class="btn sm ghost" disabled=${busy.sweep} onClick=${sweep} title=${plat.desktop ? 'Queue a sweep for the collector on your Mac and watch it run' : 'Collect from ' + plat.label + ' now and watch it run'}>${busy.sweep ? 'Sweeping...' : 'Sweep ' + plat.label}</button>` : null}
        ${wantsAgent && !agentFor.length ? html`<span class="sig-warn" title=${plat.desktop ? 'A sweep will sit in the queue until a collector connects' : 'The worker can try, but ' + plat.label + ' usually refuses it'}>no ${plat.label} collector connected - run <code>python3 tools/reach-agent.py --key $AXIOM_KEY</code> on your Mac</span>` : null}
        ${wantsAgent && agentFor.length ? html`<span class="sig-agent on" style=${{ marginLeft: 0 }} title=${'This sweep will run on ' + agentFor.map(a => a.agent).join(', ')}>runs on ${agentFor[0].agent}</span>` : null}
      </div>
      <div class="sen-strip aud-strip">
        <${Stat} k=${plat.unit === 'thread' ? 'Threads' : 'Posts'} v=${fmtN(threads.length)} s=${f.days + 'd in scope · ' + fmtN(mine.threads || 0) + ' on file'} />
        <${Stat} k="Comments held" v=${fmtN(mine.comments || 0)} s=${plat.label + ' comments on file'} />
        <${Stat} k="Hostile" v=${hostileShare === null ? '—' : hostileShare + '%'} s=${(mine.hostile || 0) + ' hostile comments'} col=${hostileShare !== null && hostileShare >= 40 ? '#F0908B' : ''} />
        <${Stat} k="Supportive" v=${mine.comments ? Math.round((mine.supportive || 0) / mine.comments * 100) + '%' : '—'} s=${(mine.supportive || 0) + ' supportive comments'} col=${mine.comments && (mine.supportive || 0) / mine.comments >= .3 ? '#7EE0AE' : ''} />
        <${Stat} k=${plat.id === 'reddit' ? 'Busiest sub' : 'Busiest page'} v=${chanTop ? plat.prefix + chanTop.name : '—'} s=${chanTop ? chanTop.n + ' in scope' : 'nothing in scope'} />
      </div>
      <${Console} job=${job} onCancel=${cancel} canWrite=${canWrite} />
      ${(err || !threads.length) && !busy.load ? html`<${Notice} err=${err} have=${data && data.have} plat=${plat} cfg=${cfg} needsAgent=${wantsAgent} agentHere=${!!agentFor.length} canWrite=${canWrite} onSweep=${sweep} busy=${busy.sweep} />` : null}
      ${result ? html`<div class=${'rd-res ' + (result.ok ? 'ok' : 'err')}>${result.text}</div>` : null}
      ${threads.length ? html`<div class="rd-grid">
        <div class="panel">
          <div class="phead"><div class="ptitle">${plat.label} ${plat.unit === 'thread' ? 'threads' : 'posts'}</div>
            <div class="rd-ctl" style=${{ margin: 0 }}>
              <label class="rd-chip" style=${{ cursor: 'pointer' }}><input type="checkbox" checked=${!!allSel} onChange=${() => setSel(allSel ? new Set() : new Set(threads.map(t => t.id)))} style=${{ marginRight: 6 }} />${sel.size ? sel.size + ' selected' : 'select all'}</label>
              ${canWrite ? html`<select class="sel" value=${ns} onChange=${e => setNs(e.target.value)} style=${{ padding: '6px 10px', fontSize: 11 }} aria-label="Client namespace">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
              <button class="btn sm" disabled=${!sel.size || busy.mind} onClick=${sendToMind} title="File the selected posts and their top comments in the Mind under this client">${busy.mind ? 'Filing...' : 'Send to the Mind'}</button>
              <button class="btn sm ghost" disabled=${busy.analyse} onClick=${analyse} title="Claude reads the selected posts, or the busiest in scope">${busy.analyse ? 'Reading...' : 'Analyse'}</button>` : null}
            </div>
          </div>
          <div class="rd-list">${threads.map(t => html`<${ThreadRow} key=${t.id} t=${t} plat=${plat} checked=${sel.has(t.id)} open=${open && open.id === t.id} onToggle=${toggle} onOpen=${setOpen} />`)}</div>
        </div>
        <div>
          <div class="panel" style=${{ marginBottom: 16 }}>
            <div class="phead"><div class="ptitle">Comments</div><span class="ptag">${open ? (open.channel ? plat.prefix + open.channel : plat.label) : 'PICK A POST'}</span></div>
            <${Comments} thread=${open} platform=${tab} canWrite=${canWrite} />
          </div>
          ${analysis ? html`<div class="panel"><div class="phead"><div class="ptitle">What ${plat.label} is arguing</div><span class="ptag">CLAUDE · ${analysis.ns.toUpperCase()}</span></div><${Analysis} a=${analysis.analysis} meta=${analysis} /></div>` : null}
        </div>
      </div>` : null}
    </div>`;
  }

  let mounted = false;
  window.signalsInit = function () {
    const root = document.getElementById('signals-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${SignalsApp} />`); }
  };
  // the view was called Reddit until it grew four platforms
  window.redditInit = window.signalsInit;
})();
