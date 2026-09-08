/* AXIOM - Reddit signal. The first React island.
 *
 * New sections are built this way from here on: a component file under docs/,
 * mounted into a <section class="view"> in index.html, talking to the worker
 * through the same csBase()/axHeaders() the rest of the app uses. React, ReactDOM
 * and htm are vendored under docs/vendor so no CDN can take a view down.
 *
 * htm gives JSX-shaped templates without a build step:  html`<div class=...>`.
 */
(function () {
  'use strict';
  if (!window.React || !window.ReactDOM || !window.htm) {
    window.redditInit = function () {
      const root = document.getElementById('reddit-root');
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
  const SUBS = ['AustralianPolitics', 'australia', 'AusPol', 'AusFinance', 'AusEcon'];
  const ISSUE_LABEL = id => { const i = issues().find(x => x.id === id); return i ? i.label : id; };

  /* ---- small helpers ---------------------------------------------------- */
  const fmtN = n => { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n)); };
  const ago = ts => { const s = (Date.now() - (+ts || 0)) / 1e3; if (!ts) return ''; if (s < 3600) return Math.max(1, Math.round(s / 60)) + 'm'; if (s < 86400) return Math.round(s / 3600) + 'h'; return Math.round(s / 86400) + 'd'; };
  const toneKey = t => (t < 0 ? 'h' : t > 0 ? 's' : 'n');
  const toneWord = t => (t < 0 ? 'hostile' : t > 0 ? 'supportive' : 'neutral');

  /* ---- components -------------------------------------------------------- */
  function Stat({ k, v, s, col }) {
    return html`<div class="sen-stat"><div class="k">${k}</div><div class="v" style=${col ? { color: col } : null}>${v}</div><div class="s">${s}</div></div>`;
  }
  function ToneBar({ held }) {
    if (!held || !held.n) return html`<span class="rd-chip" title="No comments collected for this thread yet">no comments held</span>`;
    const h = held.hostile / held.n * 100, s = held.supportive / held.n * 100;
    return html`<span class="rd-tone" title=${held.hostile + ' hostile, ' + held.supportive + ' supportive of ' + held.n + ' comments held'}>
      <i style=${{ width: h + '%', background: '#E05A54' }}></i><i style=${{ width: (100 - h - s) + '%', background: 'rgba(255,255,255,.18)' }}></i><i style=${{ width: s + '%', background: '#22D993' }}></i></span>`;
  }
  function IssueChips({ ids }) {
    return html`${(ids || []).slice(0, 3).map(id => html`<span key=${id} class="rd-chip i">${ISSUE_LABEL(id)}</span>`)}`;
  }
  function ThreadRow({ t, checked, open, onToggle, onOpen }) {
    return html`<div class=${'rd-th' + (open ? ' on' : '')} onClick=${() => onOpen(t)}>
      <input type="checkbox" checked=${checked} onClick=${e => e.stopPropagation()} onChange=${() => onToggle(t.id)} aria-label="Select thread" />
      <div>
        <div class="t"><a href=${t.url} target="_blank" rel="noopener" onClick=${e => e.stopPropagation()}>${t.title}</a></div>
        <div class="m">
          <span class="rd-sub">r/${t.sub}</span>
          <span>${fmtN(t.score)} pts</span>
          <span>${fmtN(t.comments)} comments</span>
          <span>${ago(t.ts)} ago</span>
          ${t.flair ? html`<span class="rd-chip">${t.flair}</span>` : null}
          <${IssueChips} ids=${t.issues} />
          <${ToneBar} held=${t.held} />
        </div>
      </div>
    </div>`;
  }
  function Comments({ thread, canWrite }) {
    const [state, set] = useState({ rows: null, err: '', busy: false, live: false, filter: 'all' });
    const load = useCallback(async (live) => {
      if (!thread) return;
      set(s => Object.assign({}, s, { busy: true, err: '' }));
      try { const d = await call('/reddit/comments?thread=' + encodeURIComponent(thread.id) + (live ? '&live=1' : '')); set(s => Object.assign({}, s, { rows: d.comments || [], live: !!d.live, busy: false })); }
      catch (e) { set(s => Object.assign({}, s, { err: e.message, busy: false, rows: s.rows || [] })); }
    }, [thread && thread.id]);
    useEffect(() => { set({ rows: null, err: '', busy: false, live: false, filter: 'all' }); load(false); }, [load]);
    if (!thread) return html`<div class="empty">Pick a thread to read its comments.</div>`;
    const rows = (state.rows || []).filter(c => state.filter === 'all' || String(c.tone) === state.filter);
    const tot = (state.rows || []).length, hos = (state.rows || []).filter(c => c.tone < 0).length, sup = (state.rows || []).filter(c => c.tone > 0).length;
    return html`<div>
      <div class="rd-ctl" style=${{ marginBottom: 8 }}>
        <select class="sel" value=${state.filter} onChange=${e => set(s => Object.assign({}, s, { filter: e.target.value }))} style=${{ padding: '6px 10px', fontSize: 11 }}>
          <option value="all">All (${tot})</option><option value="-1">Hostile (${hos})</option><option value="1">Supportive (${sup})</option><option value="0">Neutral (${tot - hos - sup})</option>
        </select>
        ${canWrite ? html`<button class="btn sm ghost" disabled=${state.busy} onClick=${() => load(true)} title="Fetch the current comment tree from Reddit and file it">${state.busy ? 'Fetching...' : 'Load live comments'}</button>` : null}
        ${state.live ? html`<span class="rd-chip">live</span>` : null}
        <a class="aud-src" href=${thread.url} target="_blank" rel="noopener" style=${{ marginLeft: 'auto' }}>Open thread on Reddit &#8599;</a>
      </div>
      ${state.err ? html`<div class="rd-res err">${state.err}</div>` : null}
      <div class="rd-cm">
        ${state.rows === null ? html`<div class="empty">Loading comments...</div>`
          : !rows.length ? html`<div class="empty">${tot ? 'No comments match this filter.' : 'No comments on file for this thread. ' + (canWrite ? 'Load live comments to fetch them now.' : 'A sweep will collect them.')}</div>`
          : rows.map((c, i) => html`<div key=${i} class=${'aud-c ' + toneKey(c.tone)}>
              <div class="b">${c.body}</div>
              <div class="m"><span class=${'tn ' + toneKey(c.tone)}>${toneWord(c.tone)}</span><span>${fmtN(c.score)} pts</span>${c.depth ? html`<span>reply depth ${c.depth}</span>` : null}<span>${ago(c.ts)} ago</span><${IssueChips} ids=${c.issues} /></div>
            </div>`)}
      </div>
    </div>`;
  }
  function Analysis({ a, meta }) {
    if (!a) return null;
    const list = (arr, cls) => (arr || []).length ? html`<ul class=${cls} style=${{ margin: '0 0 6px 18px', fontSize: 12.5, color: 'var(--t2)' }}>${arr.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>` : null;
    return html`<div class="aud-ai">
      <div class="sum">${a.summary || ''}</div>
      <h4>Themes · from ${meta.threads} threads, ${meta.comments} comments</h4>
      ${(a.themes || []).map((th, i) => html`<div key=${i} class="aud-theme"><div class="th"><div>${th.theme}</div><span>${th.stance} · ${th.share}</span></div>${(th.quotes || []).slice(0, 2).map((q, j) => html`<div key=${j} class="q">"${q}"</div>`)}${th.read ? html`<div class="r">${th.read}</div>` : null}</div>`)}
      ${(a.attackLines || []).length ? html`<h4>Lines used against us</h4>${list(a.attackLines)}` : null}
      ${(a.supportLines || []).length ? html`<h4>Lines in our favour</h4>${list(a.supportLines)}` : null}
      ${(a.risks || []).length ? html`<h4>Risks</h4>${list(a.risks)}` : null}
      ${(a.openings || []).length ? html`<h4>Openings</h4>${list(a.openings)}` : null}
      ${(a.replies || []).length ? html`<h4>Ready replies</h4>${a.replies.map((x, i) => html`<div key=${i} class="aud-resp"><small>${x.to}</small>${x.line}</div>`)}` : null}
    </div>`;
  }
  function Notice({ err, have, canWrite, onSweep, busy }) {
    const e = String((err && err.message) || '');
    const code = (err && err.code) || '';
    let body;
    if (err && (code === 'not_found' || err.status === 404)) body = html`<b>The worker needs updating.</b> The live Cloudflare worker does not have the <code>/reddit</code> routes. Paste the latest <code>axiomworkerv4.js</code> into newsaus and Deploy, then reload.`;
    else if (err && (code === 'unauthorized' || err.status === 401)) body = html`<b>No access key.</b> Open Settings, paste your key, save, then reload.`;
    else if (err && code === 'mind_unbound') body = html`<b>Database not bound.</b> Cloudflare, newsaus, Settings, Bindings must include the D1 database as <code>MIND_DB</code>.`;
    else if (err) body = html`<b>The worker returned an error:</b> <code>${e}</code>`;
    else if (!have || !have.total) body = html`<b>Nothing collected yet.</b> The worker sweeps r/AustralianPolitics, r/australia, r/AusPol, r/AusFinance and r/AusEcon every three hours once deployed. ${canWrite ? html`Press <b>Sweep now</b> to collect the first threads and comments.` : 'Ask a full-access user to run the first sweep.'}`;
    else body = html`<b>No threads match this scope.</b> The archive holds ${fmtN(have.total)} Reddit threads. Widen the window, clear the issue filter, or clear the search.`;
    return html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}>${body}${!err && canWrite ? html`<div class="aud-diagwrap"><button class="btn sm" disabled=${busy} onClick=${onSweep}>${busy ? 'Sweeping...' : 'Sweep now'}</button></div>` : null}</div>`;
  }

  function RedditApp() {
    const [f, setF] = useState({ sub: '', days: 7, issue: '', q: '' });
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState({ load: false, sweep: false, analyse: false, mind: false });
    const [sel, setSel] = useState(() => new Set());
    const [open, setOpen] = useState(null);
    const [ns, setNs] = useState('cmm');
    const [analysis, setAnalysis] = useState(null);
    const [result, setResult] = useState(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const qRef = useRef(null);

    const load = useCallback(async () => {
      setBusy(b => Object.assign({}, b, { load: true }));
      try {
        const d = await call('/reddit/threads?sub=' + encodeURIComponent(f.sub) + '&days=' + f.days + '&issue=' + encodeURIComponent(f.issue) + '&q=' + encodeURIComponent(f.q) + '&limit=80');
        setData(d); setErr(null);
      } catch (e) { setData(null); setErr(e); }
      setBusy(b => Object.assign({}, b, { load: false }));
    }, [f.sub, f.days, f.issue, f.q]);
    useEffect(() => { load(); }, [load]);

    const sweep = async () => {
      setBusy(b => Object.assign({}, b, { sweep: true })); setResult(null);
      try { const r = await call('/reddit/sweep', { subs: f.sub ? [f.sub] : undefined }); setResult({ ok: true, text: 'Swept ' + r.threads + ' threads and ' + r.comments + ' comments across ' + (r.subs || []).map(s => 'r/' + s).join(', ') + '. ' + r.threadRows + ' new threads and ' + r.commentRows + ' new comments filed.' + (r.errors && r.errors.length ? ' ' + r.errors.length + ' fetches failed.' : '') }); toastMsg('Reddit sweep done'); await load(); }
      catch (e) { setResult({ ok: false, text: e.message }); toastMsg('Sweep failed', true); }
      setBusy(b => Object.assign({}, b, { sweep: false }));
    };
    const analyse = async () => {
      setBusy(b => Object.assign({}, b, { analyse: true })); setAnalysis(null); setResult(null);
      try { const r = await call('/reddit/analyse', { threads: [...sel], sub: f.sub, issue: f.issue, days: f.days, ns }); setAnalysis(r); if (typeof arcLog === 'function') arcLog('reddit', 'assistant', ('Reddit analysis ' + ns + ': ' + (r.analysis && r.analysis.summary || '')).slice(0, 2000)); }
      catch (e) { setResult({ ok: false, text: 'Analysis: ' + e.message }); }
      setBusy(b => Object.assign({}, b, { analyse: false }));
    };
    const sendToMind = async () => {
      if (!sel.size) return;
      setBusy(b => Object.assign({}, b, { mind: true })); setResult(null);
      try { const r = await call('/reddit/mind', { threads: [...sel], ns }); setResult({ ok: true, text: 'Filed in the Mind under ' + r.ns + ': "' + r.title + '" - ' + r.threads + ' threads, ' + r.comments + ' comments, ' + r.chunks + ' chunks (doc ' + r.docId + '). Briefs and the Analyst can now retrieve it.' }); toastMsg('Sent to the Mind'); setSel(new Set()); }
      catch (e) { setResult({ ok: false, text: 'Send to the Mind: ' + e.message }); toastMsg('Could not send', true); }
      setBusy(b => Object.assign({}, b, { mind: false }));
    };
    const toggle = id => setSel(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    const threads = (data && data.threads) || [];
    const allSel = threads.length && threads.every(t => sel.has(t.id));
    const ct = (data && data.commentTone) || {};
    const hostileShare = ct.n ? Math.round((ct.hostile || 0) / ct.n * 100) : null;
    const topSub = (data && data.bySub && data.bySub[0]) || null;
    const clientOpts = useMemo(() => [{ id: 'cmm', name: 'Curious Minds (shared)' }].concat(clients().filter(c => c.id !== 'cmm').map(c => ({ id: c.id, name: c.short || c.name }))), []);

    return html`<div class="rd-wrap">
      <div class="rd-ctl">
        <select class="sel" value=${f.sub} onChange=${e => setF(x => Object.assign({}, x, { sub: e.target.value }))} aria-label="Subreddit">
          <option value="">All subreddits</option>${SUBS.map(s => html`<option key=${s} value=${s}>r/${s}</option>`)}
        </select>
        <select class="sel" value=${f.days} onChange=${e => setF(x => Object.assign({}, x, { days: +e.target.value }))} aria-label="Window">
          <option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
        </select>
        <select class="sel" value=${f.issue} onChange=${e => setF(x => Object.assign({}, x, { issue: e.target.value }))} aria-label="Issue">
          <option value="">All issues</option>${issues().filter(i => i.id !== 'econ').map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}
        </select>
        <input class="fi" ref=${qRef} placeholder="Search threads..." defaultValue=${f.q} onKeyDown=${e => { if (e.key === 'Enter') setF(x => Object.assign({}, x, { q: e.target.value.trim() })); }} aria-label="Search" />
        ${canWrite ? html`<button class="btn sm ghost" disabled=${busy.sweep} onClick=${sweep} title="Collect threads and comments from Reddit now">${busy.sweep ? 'Sweeping...' : 'Sweep now'}</button>` : null}
      </div>
      <div class="sen-strip aud-strip">
        <${Stat} k="Threads" v=${fmtN(threads.length)} s=${f.days + 'd' + (f.sub ? ' · r/' + f.sub : ' · all subs')} />
        <${Stat} k="Comments held" v=${fmtN(ct.n || 0)} s=${'in scope · ' + (data && data.have ? fmtN(data.have.total) + ' threads on file' : '')} />
        <${Stat} k="Hostile" v=${hostileShare === null ? '—' : hostileShare + '%'} s=${(ct.hostile || 0) + ' hostile comments'} col=${hostileShare !== null && hostileShare >= 40 ? '#F0908B' : ''} />
        <${Stat} k="Supportive" v=${ct.n ? Math.round((ct.supportive || 0) / ct.n * 100) + '%' : '—'} s=${(ct.supportive || 0) + ' supportive comments'} col=${ct.n && (ct.supportive || 0) / ct.n >= .3 ? '#7EE0AE' : ''} />
        <${Stat} k="Busiest sub" v=${topSub ? 'r/' + topSub.sub : '—'} s=${topSub ? topSub.n + ' threads' : 'no threads in scope'} />
      </div>
      ${(err || !threads.length) && !busy.load ? html`<${Notice} err=${err} have=${data && data.have} canWrite=${canWrite} onSweep=${sweep} busy=${busy.sweep} />` : null}
      ${result ? html`<div class=${'rd-res ' + (result.ok ? 'ok' : 'err')}>${result.text}</div>` : null}
      ${threads.length ? html`<div class="rd-grid">
        <div class="panel">
          <div class="phead"><div class="ptitle">Threads</div>
            <div class="rd-ctl" style=${{ margin: 0 }}>
              <label class="rd-chip" style=${{ cursor: 'pointer' }}><input type="checkbox" checked=${!!allSel} onChange=${() => setSel(allSel ? new Set() : new Set(threads.map(t => t.id)))} style=${{ marginRight: 6 }} />${sel.size ? sel.size + ' selected' : 'select all'}</label>
              ${canWrite ? html`<select class="sel" value=${ns} onChange=${e => setNs(e.target.value)} style=${{ padding: '6px 10px', fontSize: 11 }} aria-label="Client namespace">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
              <button class="btn sm" disabled=${!sel.size || busy.mind} onClick=${sendToMind} title="File the selected threads and their top comments in the Mind under this client">${busy.mind ? 'Filing...' : 'Send to the Mind'}</button>
              <button class="btn sm ghost" disabled=${busy.analyse} onClick=${analyse} title="Claude reads the selected threads, or the top threads in scope">${busy.analyse ? 'Reading...' : 'Analyse'}</button>` : null}
            </div>
          </div>
          <div class="rd-list">${threads.map(t => html`<${ThreadRow} key=${t.id} t=${t} checked=${sel.has(t.id)} open=${open && open.id === t.id} onToggle=${toggle} onOpen=${setOpen} />`)}</div>
        </div>
        <div>
          <div class="panel" style=${{ marginBottom: 16 }}>
            <div class="phead"><div class="ptitle">${open ? 'Comments' : 'Comments'}</div><span class="ptag">${open ? 'r/' + open.sub : 'PICK A THREAD'}</span></div>
            <${Comments} thread=${open} canWrite=${canWrite} />
          </div>
          ${analysis ? html`<div class="panel"><div class="phead"><div class="ptitle">What Reddit is arguing</div><span class="ptag">CLAUDE · ${analysis.ns.toUpperCase()}</span></div><${Analysis} a=${analysis.analysis} meta=${analysis} /></div>` : null}
        </div>
      </div>` : null}
    </div>`;
  }

  let mounted = false;
  window.redditInit = function () {
    const root = document.getElementById('reddit-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${RedditApp} />`); }
  };
})();
