/* AXIOM - Anne's Den. The monitoring analyst's workspace: one desk at a time (a client, a region, a report format).
 * Today is the window's evidence sorted into the report's sections; the strip above it lists what should not be missed;
 * Brief is the report, drafted from that evidence by one stated model call or written by hand, checked against the rows
 * it cites; Watch is the register and the proposals that wait for a person; Collection says which channels read and why
 * not; Options are the desk's own. A React island (React, ReactDOM and htm vendored under docs/vendor; shared pieces from
 * docs/ax-ui.js) mounted into #den-root on first open. Nothing here spends without a button that states the cost. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.denInit = function () {
      const root = document.getElementById('den-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the docs folder.</div>';
    };
    return;
  }
  const { html, call, own, hdrs, toastMsg, fmtN, Console, tailJob, useGoto } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const canWriteNow = () => window.AX_ROLE !== 'read';

  const TABS = [['today', 'Today'], ['brief', 'Brief'], ['watch', 'Watch'], ['collection', 'Collection'], ['options', 'Options']];
  const CH = { news: 'News', x: 'X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit', bluesky: 'Bluesky', mastodon: 'Mastodon', substack: 'Substack', petitions: 'Petitions', forum: 'Forum', linkedin: 'LinkedIn', tiktok: 'TikTok', threads: 'Threads', meta: 'Facebook / Instagram' };
  const SIG = { gap: ['Not collected', 'warn'], spike: ['Spike', 'neg'], emerging: ['Emerging', 'acc'], outlier: ['Unusual reach', 'acc'], first_seen: ['First seen', ''], burst: ['Above baseline', 'warn'] };
  const ASIDE = ['not relevant', 'duplicate', 'foreign', 'old news'];
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const fmtDay = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'long' });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const since = ts => { if (!ts) return 'never'; const m = Math.max(0, Math.round((Date.now() - ts) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
  const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
  /* What went wrong, in words a person can act on. The worker sends its own words with every refusal; what it cannot
     send is a connection that never reached it. */
  const say = e => { const m = String((e && e.message) || e || ''); if (!e || e.status === 0 || /Failed to fetch|NetworkError|Load failed|network/i.test(m) && !e.code) return 'The connection to AXIOM dropped before an answer came back. Nothing on this computer was lost.'; return m; };
  /* Only an http(s) address is ever a link, whatever a row, a proposal or a brief carries. */
  const web = u => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
  const q = o => Object.keys(o).filter(k => o[k] != null && o[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  /* A read that came back, but not as an answer: a gateway's page with a 200, or a worker older than this page. The
     shared caller reads that as an empty object; here it is an error with words, so a panel says so instead of drawing nothing. */
  /* A busy database answers 503 db_busy: a read is asked again by itself, twice, a few seconds apart, and says so once.
     Found live on 11 November 2026, when the first open of this page met a database that was being read too hard. */
  const BUSY_WAITS = [2500, 6000]; let busySaid = 0;
  async function get(path, need) { let d;
    for (let i = 0; ; i++) { try { d = await call(path); break; } catch (e) {
      if (!e || e.code !== 'db_busy' || i >= BUSY_WAITS.length) throw e;
      if (Date.now() - busySaid > 10000) { busySaid = Date.now(); toastMsg('The database is busy. Trying again in a few seconds.'); }
      await new Promise(r => setTimeout(r, BUSY_WAITS[i])); } }
    if (!d || d.ok !== true || (need && !(need in d)) || (need && need !== 'brief' && need !== 'counts' && !Array.isArray(d[need]))) { const e = new Error('AXIOM answered, but not with what this page asked for (a gateway\'s page, or a worker older than this page). Nothing was changed.'); e.code = 'bad_answer'; e.status = 502; throw e; } return d; }
  async function getText(path) { const r = await fetch(own(path), { headers: hdrs() }); if (!r.ok) { let d = {}; try { d = await r.json(); } catch (e) {} const er = new Error(d.detail || d.error || ('HTTP ' + r.status)); er.status = r.status; throw er; } return r.text(); }
  /* One loader for every panel: data, the error in words, and a reload. A reply that arrives after a newer request was
     sent is dropped, so a slow answer for the last desk never lands on this one. */
  function useLoad(fn, deps, key) {
    const [st, setSt] = useState({ data: null, err: '', loading: true }); const seq = useRef(0); const last = useRef(key);
    const load = useCallback(() => { const n = ++seq.current; setSt(s => ({ data: s.data, err: '', loading: true }));
      Promise.resolve().then(fn).then(d => { if (n === seq.current) setSt({ data: d, err: '', loading: false }); }, e => { if (n === seq.current) setSt(s => ({ data: s.data, err: say(e), loading: false })); }); }, deps);   // eslint-disable-line
    // another desk clears what is shown; a refresh of the same desk keeps it on screen until the new read lands
    useEffect(() => { if (last.current !== key) { last.current = key; setSt({ data: null, err: '', loading: true }); } load(); }, deps);   // eslint-disable-line
    return Object.assign({ reload: load, set: d => setSt({ data: d, err: '', loading: false }) }, st);
  }
  const Loading = ({ what }) => html`<div class="den-state den-load" role="status"><span class="den-sk" aria-hidden="true"></span><span class="den-sk" aria-hidden="true"></span><span class="den-sk" aria-hidden="true"></span>Loading ${what || ''}...</div>`;
  const Failed = ({ what, err, onRetry }) => html`<div class="den-state err" role="alert"><b>${what} could not be loaded.</b> ${err} ${onRetry ? html`<button class="den-mini" onClick=${onRetry}>Try again</button>` : null}</div>`;
  const Empty = ({ children }) => html`<div class="den-state">${children}</div>`;
  /* A failure in one panel never blanks the page. */
  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
    render() { return this.state.err ? html`<div class="den-state err" role="alert"><b>${this.props.name} stopped working.</b> The rest of the page is unaffected. ${String(this.state.err.message || this.state.err).slice(0, 160)} <button class="den-mini" onClick=${() => this.setState({ err: null })}>Try again</button></div>` : this.props.children; }
  }
  function Panel({ title, note, actions, flush, children, id }) {
    return html`<section class="den-panel" id=${id} aria-label=${title}><header><h3>${title}</h3>${note ? html`<span class="den-note">${note}</span>` : null}<span class="den-spacer"></span>${actions || null}</header><div class=${'den-body' + (flush ? ' flush' : '')}>${children}</div></section>`;
  }
  function Dialog({ title, onClose, children }) {
    const ref = useRef(null);
    useEffect(() => { const prev = document.activeElement; const el = ref.current; if (el) { const f = el.querySelector('button, input, select, textarea, a[href]'); (f || el).focus(); }
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } if (e.key === 'Tab' && el) { const fs = Array.from(el.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]')); if (!fs.length) return; const a = fs[0], z = fs[fs.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } };
      document.addEventListener('keydown', key, true); return () => { document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); }; }, []);   // eslint-disable-line
    return html`<div class="den-dialog" onMouseDown=${e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label=${title} ref=${ref} tabIndex="-1"><h3>${title}</h3>${children}</div></div>`;
  }
  function Sheet({ title, onClose, children }) {
    useEffect(() => { const k = e => { if (e.key === 'Escape' && !document.querySelector('.den-dialog')) onClose(); }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k); }, []);   // eslint-disable-line
    const top = Math.max(0, Math.round(((document.getElementById('content') || { getBoundingClientRect: () => ({ top: 0 }) }).getBoundingClientRect().top) || 0));
    return html`<aside class="den-sheet" style=${{ top: top + 'px' }} aria-label=${title}><header><h3>${title}</h3><span class="den-spacer"></span><button class="den-mini" aria-label="Close this panel" onClick=${onClose}>Close</button></header><div class="den-sheet-b">${children}</div></aside>`;
  }
  const engText = e => (e ? [['likes', 'likes'], ['comments', 'comments'], ['replies', 'replies'], ['shares', 'shares'], ['reposts', 'reposts'], ['views', 'views']].filter(k => +e[k[0]] > 0).map(k => fmtN(e[k[0]]) + ' ' + k[1]).join(', ') : '');
  /* Where a signal's or a row's evidence opens: a view of AXIOM, a tab of the Den, or the post itself. */
  function openEvidence(o, setTab) { if (!o) return; if (o.tab) return setTab(o.tab); if (o.view && window.AXUI.goto) return window.AXUI.goto(o.view, o.params || {}); if (o.url && /^https?:/.test(o.url)) window.open(o.url, '_blank', 'noopener'); }

  /* ---- Nothing critical missed ---- */
  const STRIP_PENDING = { data: null, loading: true, err: '', reload() {} };
  /* On Today the board's own answer carries the strip (one read of the window, not two). The strip asks for itself on the
     other tabs, and on Today only when the board came back without it: the board failed, or took too long to say. */
  function Strip({ deskId, setTab, tick, handed }) {
    const [late, setLate] = useState(false); const waiting = !!(handed && handed.loading && !handed.data);
    useEffect(() => { setLate(false); if (!waiting) return; const t = setTimeout(() => setLate(true), 20000); return () => clearTimeout(t); }, [waiting, deskId, tick]);
    const need = !handed || late || (!handed.loading && !handed.data);
    const self = useLoad(() => (need ? get('/den/missed?' + q({ desk: deskId }), 'signals') : Promise.resolve(null)), [deskId, tick, need], deskId);
    const m = need ? self : handed; const [open, setOpen] = useState(() => ls.get('ax_den_strip', true) !== false);
    const fold = () => { ls.set('ax_den_strip', !open); setOpen(!open); };
    if (!m.data && !m.err) return html`<section class="den-strip" aria-label="Nothing critical missed"><header><h3>Nothing critical missed</h3></header><${Loading} what="the checks" /></section>`;
    if (m.err && !m.data) return html`<section class="den-strip" aria-label="Nothing critical missed"><header><h3>Nothing critical missed</h3></header><${Failed} what="The checks" err=${m.err} onRetry=${m.reload} /></section>`;
    const s = m.data.signals || [];
    const five = m.data.checks === 5;   // decision D10: the sixth check, collection gaps, runs only when the desk's showGaps is on; a worker that does not say ran all six
    return html`<section class="den-strip" aria-label="Nothing critical missed">
      <header><h3>Nothing critical missed</h3><span class="den-mono">${s.length ? s.length + ' to read' : five ? 'five checks, nothing found' : 'six checks, nothing found'}</span>${!open && s.some(x => x.sig === 'gap') ? html`<span class="den-chip warn">${s.filter(x => x.sig === 'gap').length} not collected</span>` : null}<span class="den-spacer"></span><span class="den-mono" title="Computed from the archive. No model is asked.">computed, no model</span>
        <button class="den-mini" aria-expanded=${open ? 'true' : 'false'} aria-controls="den-strip-list" onClick=${fold}>${open ? 'Fold' : 'Show'}</button></header>
      ${!open ? null : s.length ? html`<ul id="den-strip-list">${s.map(x => html`<li key=${x.key}><span><span class=${'den-chip ' + (SIG[x.sig] || ['', ''])[1]}>${(SIG[x.sig] || [x.sig])[0]}</span></span><span><span class="den-t">${x.title}</span><span class="d">${x.detail}</span></span>
        <span>${x.open && (x.open.tab || x.open.view || x.open.url) ? html`<button class="den-link" onClick=${() => openEvidence(x.open, setTab)} aria-label=${'Open the evidence for: ' + x.title}>${x.open.tab ? 'Open Collection' : x.open.view ? 'Open in ' + x.open.view.charAt(0).toUpperCase() + x.open.view.slice(1) : 'Open the post'}</button>` : null}</span></li>`)}</ul>`
        : html`<${Empty}>${five ? "None of the five checks found anything in this window: no spike, no emerging narrative, no first-seen actor, no issue above its baseline, and no post far above its account's usual." : "None of the six checks found anything in this window: no spike, no emerging narrative, no first-seen actor, no issue above its baseline, no post far above its account's usual, and every channel this desk relies on delivered."}<//>`}
    </section>`;
  }

  /* ---- The day in figures (DEN.md s.10). Everything here is counted from the board's own rows: no route, no model, and
     no figure the tables below do not hold. A channel keeps its colour whatever else is on the board. ---- */
  const ICON = { today: 'M3 11.5 12 4l9 7.5M5.5 10v10h13V10', brief: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6', watch: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', collection: 'M4 19v-5M9 19V8M14 19v-8M19 19V5', options: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4' };
  const Ico = ({ n }) => html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d=${ICON[n]} /></svg>`;
  const MENU = [['Workspace', ['today', 'brief']], ['Desk', ['watch', 'collection']], ['Settings', ['options']]];
  const SER = { news: 1, x: 2, facebook: 3, instagram: 4, youtube: 5, reddit: 6, bluesky: 7 };
  const serKey = ch => (SER[ch] ? ch : 'other'); const serCol = k => 'var(--den-s' + (SER[k] || 0) + ')'; const serName = k => (k === 'other' ? 'Other channels' : CH[k] || k);
  const fmtHour = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: true });
  const fmtDate = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short' });
  function Overview({ d, desk, jump, setTab }) {
    const [hot, setHot] = useState(-1); const c = d.counts;
    const m = useMemo(() => {
      const pts = d.media.map(x => ({ ts: +x.ts, ch: 'news' })).concat(d.social.map(x => ({ ts: +x.ts, ch: x.platform })), d.actors.map(x => ({ ts: +x.ts, ch: x.platform }))).filter(x => x.ts > 0);
      const win = d.window || {}; const to = +win.to || Date.now(); const hours = +win.hours || desk.window_h || 24; const from = +win.from || to - hours * 3600000; const N = 12, step = (to - from) / N;
      const lab = t => (hours <= 48 ? fmtHour.format(new Date(t)).replace(/\s/g, '') : fmtDate.format(new Date(t)));
      const cols = Array.from({ length: N }, (_, i) => ({ at: from + i * step, label: lab(from + i * step), range: lab(from + i * step) + ' to ' + lab(from + (i + 1) * step), by: {}, n: 0 }));
      const byCh = {}; pts.forEach(x => { const col = cols[Math.min(N - 1, Math.max(0, Math.floor((x.ts - from) / step)))]; const k = serKey(x.ch); col.by[k] = (col.by[k] || 0) + 1; col.n++; byCh[x.ch] = (byCh[x.ch] || 0) + 1; });
      const keys = Object.keys(SER).concat(['other']).filter(k => cols.some(col => col.by[k])); const top = Math.max(4, Math.ceil(Math.max.apply(null, cols.map(col => col.n)) / 4) * 4);
      const eng = d.social.concat(d.actors); const total = eng.reduce((a, x) => a + (+x.total || 0), 0); const held = eng.some(x => +x.total > 0); const gs = d.social.filter(x => x.growth != null); const growth = gs.reduce((a, x) => a + (+x.growth || 0), 0);
      const tone = { neg: 0, mix: 0, pos: 0, n: 0 }; d.social.forEach(x => { if (!x.held) return; tone.n += +x.held.n || 0; tone[x.held.tone < -0.2 ? 'neg' : x.held.tone > 0.2 ? 'pos' : 'mix']++; });
      return { pts, cols, keys, top, total, held, growth, hasGrowth: gs.length > 0, tone, byCh: Object.keys(byCh).map(k => [k, byCh[k]]).sort((a, b) => b[1] - a[1]).slice(0, 6), carried: d.media.slice().sort((a, b) => (b.n || 1) - (a.n || 1)).slice(0, 5), hostile: d.narratives.filter(x => x.side === 'hostile').length };
    }, [d, desk.window_h]);
    const tile = (n, label, value, foot, to, delta) => html`<button type="button" class="den-kpi" onClick=${() => jump(to)} aria-label=${label + ': ' + value + (delta ? ', ' + delta.text : '') + '. ' + foot + '. Go to ' + to + '.'}>
      <span class="k"><i style=${{ background: 'var(--den-s' + n + ')' }}></i>${label}</span><span class="v">${value}${delta ? html`<small class=${delta.up ? 'up' : 'down'}>${delta.text}</small>` : null}</span><span class="f">${foot}</span></button>`;
    const tones = m.tone.neg + m.tone.mix + m.tone.pos; const mostCh = m.byCh.length ? m.byCh[0][1] : 1; const mostN = m.carried.length ? m.carried[0].n || 1 : 1;
    return html`<div>
      <div class="den-kpis" role="group" aria-label="The window in figures">
        ${tile(1, 'Stories', fmtN(c.media), c.news === c.media ? 'none carried by a second outlet' : fmtN(c.news) + ' filed, counting syndicated copies', 'Traditional media')}
        ${tile(2, 'Social posts', fmtN(c.social), c.underMinimum ? fmtN(c.underMinimum) + ' more under the desk minimum' : 'on this desk\'s terms and accounts', 'Social')}
        ${tile(3, 'Interactions', m.held ? fmtN(m.total) : '-', !m.held ? 'no counts are held for these posts' : m.hasGrowth ? 'against yesterday\'s read' : 'no read from yesterday to compare', 'Social', m.held && m.hasGrowth && m.growth ? { up: m.growth > 0, text: (m.growth > 0 ? '+' : '-') + fmtN(Math.abs(m.growth)) } : null)}
        ${tile(7, 'Narratives moving', fmtN(c.narratives), m.hostile ? m.hostile + ' read as hostile to the client' : 'none read as hostile', 'Key narratives')}
        ${tile(5, 'In the report', fmtN((d.pinned || []).length), fmtN(c.aside) + ' set aside' + (c.muted ? ', ' + fmtN(c.muted) + ' muted' : ''), 'Traditional media')}
      </div>
      <div class="den-card" role="group" aria-label="Volume through the window">
        <header><h3>Volume through the window</h3><span class="den-note">${(d.window && d.window.label) || ''} - stories and posts by channel</span><span class="den-spacer"></span>
          <span class="den-legend">${m.keys.map(k => html`<span key=${k}><i style=${{ background: serCol(k) }}></i>${serName(k)}</span>`)}</span></header>
        <div class="den-body">${m.pts.length ? html`<div class="den-chart">
          <div class="den-yax" aria-hidden="true">${[1, 0.75, 0.5, 0.25, 0].map(f => html`<span key=${f} style=${{ bottom: 'calc(22px + ' + f + ' * (100% - 22px))' }}>${Math.round(m.top * f)}</span>`)}</div>
          <div class=${'den-plot' + (hot >= 0 ? ' hot' : '')}>${[1, 0.75, 0.5, 0.25].map(f => html`<span key=${f} class="g" style=${{ bottom: f * 100 + '%' }}></span>`)}
            ${m.cols.map((col, i) => html`<div key=${i} class=${'den-col' + (hot === i ? ' on' : '')} tabIndex="0" role="img" aria-label=${col.range + ': ' + (col.n ? m.keys.filter(k => col.by[k]).map(k => col.by[k] + ' ' + serName(k)).join(', ') : 'nothing collected')}
              onMouseEnter=${() => setHot(i)} onMouseLeave=${() => setHot(-1)} onFocus=${() => setHot(i)} onBlur=${() => setHot(-1)}>
              ${m.keys.slice().reverse().filter(k => col.by[k]).map(k => html`<span key=${k} class="s" style=${{ height: (col.by[k] / m.top) * 100 + '%', backgroundColor: serCol(k) }}></span>`)}
              <span class="x" aria-hidden="true">${i % 2 ? '' : col.label}</span>
              ${hot === i && col.n ? html`<div class="den-tip" style=${i > 7 ? { right: 0 } : { left: 0 }}><b>${col.range}</b>${m.keys.filter(k => col.by[k]).map(k => html`<div key=${k}><i style=${{ background: serCol(k) }}></i>${serName(k)}<em>${col.by[k]}</em></div>`)}</div>` : null}</div>`)}</div></div>`
          : html`<p class="den-quiet">Nothing on this desk was collected in this window, so there is nothing to chart. That is not the same as a quiet day. <button class="den-link" onClick=${() => setTab('collection')}>See what was collected, and why not</button></p>`}</div>
      </div>
      <div class="den-grid3">
        <div class="den-card" role="group" aria-label="By channel"><header><h3>By channel</h3><span class="den-note">stories and posts</span></header><div class="den-body">
          ${m.byCh.length ? html`<ul class="den-bars">${m.byCh.map(x => html`<li key=${x[0]}><span>${CH[x[0]] || x[0]}</span><b>${fmtN(x[1])}</b><span class="t"><i style=${{ width: (x[1] / mostCh) * 100 + '%', backgroundColor: serCol(serKey(x[0])) }}></i></span></li>`)}</ul>` : html`<p class="den-quiet">No channel delivered a row for this desk in this window.</p>`}</div></div>
        <div class="den-card" role="group" aria-label="Most carried stories"><header><h3>Most carried stories</h3><span class="den-note">outlets that ran it</span></header><div class="den-body">
          ${m.carried.length ? html`<ul class="den-bars">${m.carried.map(x => html`<li key=${x.id}><span title=${x.title}>${x.title}</span><b>${fmtN(x.n || 1)}</b><span class="t"><i style=${{ width: ((x.n || 1) / mostN) * 100 + '%' }}></i></span></li>`)}</ul>` : html`<p class="den-quiet">No story on this desk's issues was filed in this window.</p>`}</div></div>
        <div class="den-card" role="group" aria-label="Tone under the posts"><header><h3>Tone under the posts</h3><span class="den-note">${tones ? fmtN(m.tone.n) + ' comments held' : ''}</span></header><div class="den-body">
          ${tones ? html`<div class="den-split" aria-hidden="true">${['neg', 'mix', 'pos'].filter(k => m.tone[k]).map(k => html`<i key=${k} class=${k} style=${{ flex: m.tone[k] }}></i>`)}</div>
            <ul class="den-keys">${[['neg', 'Hostile'], ['mix', 'Mixed'], ['pos', 'Warm']].map(k => html`<li key=${k[0]}><b>${m.tone[k[0]]}</b><i class=${'den-key ' + k[0]}></i>${k[1]}</li>`)}</ul><p class="den-quiet">Posts, by the tone of the comments held under them. A post with no comment held is not counted.</p>`
          : html`<p class="den-quiet">No comment under this window's posts is held, so there is no tone to show. Comment text on Facebook and Instagram is collected by no layer.</p>`}</div></div>
      </div>
    </div>`;
  }

  /* ---- Today: the evidence board ---- */
  function RowActions({ r, kind, desk, canWrite, onDone }) {
    const [ask, setAsk] = useState(false); const [why, setWhy] = useState(ASIDE[0]); const [own_, setOwn] = useState(''); const [busy, setBusy] = useState(false);
    const send = async (path, body) => { setBusy(true); try { const d = await call(path, Object.assign({ desk: desk.id, item: r.id }, body)); onDone(d); } catch (e) { toastMsg(say(e), true); } setBusy(false); setAsk(false); };
    if (!canWrite) return web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label="Open the source">Open</a>` : null;
    if (ask) return html`<span class="den-form" style=${{ justifyContent: 'flex-end' }}>
      <select class="den-in" value=${why} aria-label="Why it is set aside" onChange=${e => setWhy(e.target.value)}>${ASIDE.map(a => html`<option key=${a} value=${a}>${a}</option>`)}<option value="other">other (say why)</option></select>
      ${why === 'other' ? html`<input class="den-in" value=${own_} maxlength="200" placeholder="Why" aria-label="Your reason" onInput=${e => setOwn(e.target.value)} />` : null}
      <button class="den-mini" disabled=${busy || (why === 'other' && own_.trim().length < 3)} onClick=${() => send('/den/aside', { reason: why === 'other' ? own_ : why })}>Set aside</button><button class="den-mini" onClick=${() => setAsk(false)}>Cancel</button></span>`;
    return html`<span>
      <button class=${'den-mini' + (r.pinned ? ' on' : '')} disabled=${busy} aria-pressed=${r.pinned ? 'true' : 'false'} title=${r.pinned ? 'Pinned to the report: a draft must cover it. Press to unpin.' : 'Pin to the report: a draft must cover it'} onClick=${() => send('/den/pin', r.pinned ? { clear: true } : {})}>${r.pinned ? 'Pinned' : 'Pin'}</button>${' '}
      <button class="den-mini" disabled=${busy} title="Take it off this desk's board, with a reason" onClick=${() => setAsk(true)}>Set aside</button>${' '}
      ${web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label=${'Open the source of this ' + kind}>Open</a>` : null}</span>`;
  }
  function Board({ desk, tick, bump, setTab, canWrite, onStrip }) {
    const b = useLoad(() => get('/den/board?' + q({ desk: desk.id, missed: 1 }), 'counts'), [desk.id, tick], desk.id);
    useEffect(() => { if (!onStrip) return; const ms = b.data ? b.data.missed : null; const good = !!(ms && ms.ok === true && Array.isArray(ms.signals));
      onStrip({ data: good ? ms : null, loading: b.loading, err: b.err, reload: b.reload }); }, [b.data, b.loading, b.err]);   // eslint-disable-line
    const [offer, setOffer] = useState(null); const [showAside, setShowAside] = useState(false); const root = useRef(null); const [view, setViewRaw] = useState(() => (ls.get('ax_den_view', 'table') === 'cards' ? 'cards' : 'table')); const setView = v => { setViewRaw(v); ls.set('ax_den_view', v); };
    const done = d => { if (d && d.offer) setOffer(d.offer); b.reload(); };
    const mute = async on => { if (on) { try { await call('/den/mute', { desk: desk.id, kind: offer.kind, value: offer.value }); toastMsg('Muted on this desk'); b.reload(); bump('desk'); } catch (e) { toastMsg(say(e), true); } } setOffer(null); };
    // keyboard: j and k move between rows, p pins, x sets aside, o opens, 1 to 5 jump to a section
    const onKey = e => { if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return; if (e.metaKey || e.ctrlKey || e.altKey) return; const rows = root.current ? Array.from(root.current.querySelectorAll('.den-row')) : []; const i = rows.indexOf(document.activeElement.closest ? document.activeElement.closest('.den-row') : null);
      const go = n => { if (rows[n]) { rows[n].focus(); e.preventDefault(); } };
      if (e.key === 'j') return go(i < 0 ? 0 : Math.min(rows.length - 1, i + 1)); if (e.key === 'k') return go(i < 0 ? 0 : Math.max(0, i - 1));
      if (/^[1-5]$/.test(e.key)) { const p = root.current.querySelectorAll('section.den-panel')[+e.key - 1]; if (p) { const r = p.querySelector('.den-row') || p; if (r.focus) r.focus(); p.scrollIntoView({ block: 'start' }); e.preventDefault(); } return; }
      if (i < 0) return; const btn = t => Array.from(rows[i].querySelectorAll('button')).find(x => t.test(x.textContent));
      if (e.key === 'p') { const x = btn(/^Pin/); if (x) { x.click(); e.preventDefault(); } } if (e.key === 'x') { const x = btn(/^Set aside$/); if (x) { x.click(); e.preventDefault(); } } if (e.key === 'o' || e.key === 'Enter') { const a = rows[i].querySelector('a[href]'); if (a && e.target === rows[i]) { a.click(); e.preventDefault(); } } };
    if (b.loading && !b.data) return html`<${Loading} what="today's evidence" />`;
    if (b.err && !b.data) return html`<${Failed} what="Today's evidence" err=${b.err} onRetry=${b.reload} />`;
    const d = b.data, c = d.counts; const none = why => html`<${Empty}>${why} <button class="den-link" onClick=${() => setTab('collection')}>See what was collected, and why not</button><//>`;
    const act = (r, kind) => html`<td class="act"><${RowActions} r=${r} kind=${kind} desk=${desk} canWrite=${canWrite} onDone=${done} /></td>`;
    const row = (r, cells, kind) => html`<tr key=${r.id} class=${'den-row' + (r.pinned ? ' pinned' : '')} tabIndex="0" aria-label=${(r.pinned ? 'Pinned. ' : '') + kind + ': ' + String(r.title || r.text || r.label || '').slice(0, 120)}>${cells}${act(r, kind)}</tr>`;
    /* The same rows as cards: nothing a table row does not show, and the same actions. */
    const card = (r, kind, mark, col, meta, title, sub, figs) => html`<article key=${r.id} class=${'den-row den-mcard' + (r.pinned ? ' pinned' : '')} tabIndex="0" aria-label=${(r.pinned ? 'Pinned. ' : '') + kind + ': ' + String(r.title || r.text || '').slice(0, 120)}>
      <span class="den-mc-av" aria-hidden="true" style=${{ background: col }}>${mark}</span>
      <div class="den-mc-b"><div class="den-mc-m">${meta}</div><div class="den-t">${title}</div>${sub || null}<div class="den-mc-f">${figs}</div></div>
      <div class="den-mc-a"><${RowActions} r=${r} kind=${kind} desk=${desk} canWrite=${canWrite} onDone=${done} /></div></article>`;
    const ini = v => String(v || '?').replace(/^the\s+/i, '').charAt(0).toUpperCase(); const fig = (label, value) => html`<span><b>${value}</b> ${label}</span>`;
    const layers = r => (r.layers || []).map(l => html`<span key=${l} class="den-chip" title=${l === 1 ? 'Layer 1: an official route' : l === 2 ? 'Layer 2: a signed-in collector on the Mac' : 'Layer 3: a keyless read from the worker'}>L${l}</span>`);
    const mediaCards = () => html`<div class="den-feed">${d.media.map(m => card(m, 'story', ini(m.outlet), serCol('news'), html`<b>${m.outlet}</b>${m.tier ? ' - ' + m.tier + (m.juris && m.juris !== 'au' ? ', ' + m.juris.toUpperCase() : '') : ''} - ${aest(m.ts)}`, m.title,
      m.n > 1 ? html`<span class="den-sub">also in ${m.outlets.slice(1, 6).join(', ')}${m.n > 6 ? ' and ' + (m.n - 6) + ' more' : ''}</span>` : null,
      html`${fig(m.n === 1 ? 'outlet' : 'outlets', m.n)}${m.fb ? fig('on Facebook', fmtN((+m.fb.reactions || 0) + (+m.fb.comments || 0) + (+m.fb.shares || 0))) : html`<span>no Facebook reach held</span>`}${m.gated ? html`<span class="den-chip warn" title="Read through the agency's subscription. A brief quotes at most thirty words.">subscriber</span>` : m.full ? html`<span class="den-chip" title="The full text is held">full text</span>` : null}`))}</div>`;
    const socialCards = () => html`<div class="den-feed">${d.social.map(x => card(x, 'post', ini(CH[x.platform] || x.platform), serCol(serKey(x.platform)), html`<b>${CH[x.platform] || x.platform}</b>${x.sub ? ' - r/' + x.sub : ''} - ${x.eng_at ? 'read ' + since(x.eng_at) : aest(x.ts)}`, x.text,
      x.term || x.hashtag ? html`<span class="den-sub">found by ${x.hashtag ? '#' + x.hashtag : '"' + x.term + '"'}</span>` : x.registered ? html`<span class="den-sub">a registered account</span>` : null,
      html`${x.total ? fig('interactions', fmtN(x.total)) : html`<span>no counts held</span>`}${x.growth == null ? null : fig('since yesterday', (x.growth > 0 ? '+' : '') + fmtN(x.growth))}${x.held ? html`<span><b>${x.held.n}</b> comments held <span class=${'den-chip ' + (x.held.tone < -0.2 ? 'neg' : x.held.tone > 0.2 ? 'pos' : '')}>${x.held.tone < -0.2 ? 'hostile' : x.held.tone > 0.2 ? 'warm' : 'mixed'}</span></span>` : null}${layers(x)}`))}</div>`;
    const actorCards = () => html`<div class="den-feed">${d.actors.map(x => card(x, 'post by ' + x.who, ini(x.who), serCol(serKey(x.platform)), html`<b>${x.who}</b> - ${x.role === 'mp' ? 'MP' + (x.party ? ', ' + x.party : '') : x.role === 'org' ? 'organisation' : x.role} - ${CH[x.platform] || x.platform} - ${aest(x.ts)}`, x.text, null,
      x.total ? fig('interactions', fmtN(x.total)) : html`<span>no counts held</span>`))}</div>`;
    return html`<div ref=${root} onKeyDown=${onKey}>
      ${b.err ? html`<div class="den-notice bad" role="alert">The board could not be refreshed: ${b.err} What is shown is the last read. <button class="den-mini" onClick=${b.reload}>Try again</button></div>` : null}
      ${d.capped ? html`<div class="den-notice">This window holds more rows than one board reads (${fmtN(4000)}). The newest are shown; shorten the window in Options to see all of a busy day.</div>` : null}
      ${offer ? html`<div class="den-notice" role="alert">${offer.text} A mute hides its rows on this desk only, and can be removed in Options. <div><button class="den-mini primary" onClick=${() => mute(true)}>Mute it on this desk</button><button class="den-mini" onClick=${() => mute(false)}>Not now</button></div></div>` : null}
      <${Overview} d=${d} desk=${desk} setTab=${setTab} jump=${name => { const p = root.current && root.current.querySelector('section.den-panel[aria-label="' + name + '"]'); if (p) { p.scrollIntoView({ block: 'start', behavior: 'auto' }); const r = p.querySelector('.den-row'); if (r) r.focus({ preventScroll: true }); } }} />
      <div class="den-toolbar"><h3>The evidence, in the report's sections</h3><span class="den-note">${fmtN(c.rows)} rows in the window</span><span class="den-spacer"></span>
        <div class="den-seg" role="group" aria-label="Show stories and posts as">${[['table', 'Table'], ['cards', 'Cards']].map(v => html`<button key=${v[0]} type="button" class="den-tab" aria-pressed=${view === v[0] ? 'true' : 'false'} onClick=${() => setView(v[0])}>${v[1]}</button>`)}</div></div>
      <${Panel} title="Key narratives" note=${c.narratives ? c.narratives + ' moving on this desk\'s issues' : ''} flush=${true}>
        ${d.narratives.length ? html`<table class="den-table"><thead><tr><th>Narrative</th><th>Toward the client</th><th class="num">Rows</th><th class="num">Last day</th><th>Taken up by</th><th></th></tr></thead><tbody>
          ${d.narratives.map(n => html`<tr key=${n.id} class="den-row" tabIndex="0" aria-label=${'Narrative: ' + n.label}><td><span class="den-t">${n.label}</span>${n.claim ? html`<span class="den-sub">${n.claim}</span>` : null}</td><td><span class=${'den-chip ' + (n.side === 'hostile' ? 'neg' : n.side === 'supportive' ? 'pos' : '')}>${n.side || 'not read yet'}</span> ${n.status ? html`<span class="den-chip">${n.status}</span>` : null}</td>
            <td class="num">${fmtN(n.n)}</td><td class="num">${fmtN(n.n24)}</td><td class="den-mono">${n.spread.map(s => CH[s] || s).join(' > ') || '-'}</td><td class="act"><button class="den-link" onClick=${() => window.AXUI.goto('narratives', { id: n.id })} aria-label=${'Open the narrative: ' + n.label}>Open</button></td></tr>`)}</tbody></table>`
          : none('No narrative on this desk\'s issues gained rows in this window.')}
      <//>
      <${Panel} title="Traditional media" note=${c.news ? c.news + ' stories, ' + c.media + ' after folding copies' : ''} flush=${true}>
        ${d.media.length && view === 'cards' ? mediaCards() : d.media.length ? html`<table class="den-table"><thead><tr><th>Story</th><th>Outlet</th><th class="num">Outlets</th><th class="num">Facebook</th><th>When</th><th></th></tr></thead><tbody>
          ${d.media.map(m => row(m, html`<td><span class="den-t">${m.title}</span>${m.gated ? html` <span class="den-chip warn" title="Read through the agency's subscription. A brief quotes at most thirty words.">subscriber</span>` : m.full ? html` <span class="den-chip" title="The full text is held">full text</span>` : null}${m.n > 1 ? html`<span class="den-sub">also in ${m.outlets.slice(1, 6).join(', ')}${m.n > 6 ? ' and ' + (m.n - 6) + ' more' : ''}</span>` : null}</td>
            <td>${m.outlet}${m.tier ? html`<span class="den-sub">${m.tier}${m.juris && m.juris !== 'au' ? ', ' + m.juris.toUpperCase() : ''}</span>` : null}</td><td class="num">${m.n}</td><td class="num" title=${m.fb ? (m.fb.reactions || 0) + ' reactions, ' + (m.fb.comments || 0) + ' comments, ' + (m.fb.shares || 0) + ' shares' : 'No Facebook reach is held for this story'}>${m.fb ? fmtN((+m.fb.reactions || 0) + (+m.fb.comments || 0) + (+m.fb.shares || 0)) : '-'}</td><td class="den-mono">${aest(m.ts)}</td>`, 'story'))}</tbody></table>`
          : none('No story on this desk\'s issues' + (desk.region !== 'au' ? ' in ' + desk.region.toUpperCase() : '') + ' was filed in this window.')}
      <//>
      <${Panel} title="Social" note=${c.social ? c.social + ' posts' + (c.underMinimum ? ', ' + c.underMinimum + ' under this desk\'s minimum' : '') : ''} flush=${true}>
        ${d.social.length && view === 'cards' ? socialCards() : d.social.length ? html`<table class="den-table"><thead><tr><th>Post</th><th>Channel</th><th class="num">Interactions</th><th class="num">Since yesterday</th><th>Comments held</th><th>Read</th><th></th></tr></thead><tbody>
          ${d.social.map(s => row(s, html`<td><span class="den-t">${s.text}</span>${s.term || s.hashtag ? html`<span class="den-sub">found by ${s.hashtag ? '#' + s.hashtag : '"' + s.term + '"'}</span>` : s.registered ? html`<span class="den-sub">a registered account</span>` : null}</td>
            <td>${CH[s.platform] || s.platform}${s.sub ? html`<span class="den-sub">r/${s.sub}</span>` : null} ${(s.layers || []).map(l => html`<span key=${l} class="den-chip" title=${l === 1 ? 'Layer 1: an official route' : l === 2 ? 'Layer 2: a signed-in collector on the Mac' : 'Layer 3: a keyless read from the worker'}>L${l}</span>`)}</td>
            <td class="num" title=${engText(s.eng) || 'No counts are held for this post'}>${s.total ? fmtN(s.total) : '-'}</td><td class="num">${s.growth == null ? html`<span title="No read from yesterday to compare with">-</span>` : (s.growth > 0 ? '+' : '') + fmtN(s.growth)}</td>
            <td>${s.held ? html`${s.held.n} <span class=${'den-chip ' + (s.held.tone < -0.2 ? 'neg' : s.held.tone > 0.2 ? 'pos' : '')}>${s.held.tone < -0.2 ? 'hostile' : s.held.tone > 0.2 ? 'warm' : 'mixed'}</span>` : html`<span class="den-mono" title="No comment under this post is held">-</span>`}</td><td class="den-mono">${s.eng_at ? since(s.eng_at) : aest(s.ts)}</td>`, 'post'))}</tbody></table>`
          : none('No post on this desk\'s terms or from its registered accounts was collected in this window.')}
      <//>
      <${Panel} title="Influencer and political" note="Registered public actors and MPs, on their own posts" flush=${true}>
        ${d.actors.length && view === 'cards' ? actorCards() : d.actors.length ? html`<table class="den-table"><thead><tr><th>Who</th><th>Post</th><th>Channel</th><th class="num">Interactions</th><th>When</th><th></th></tr></thead><tbody>
          ${d.actors.map(a => row(a, html`<td><span class="den-t">${a.who}</span><span class="den-sub">${a.role === 'mp' ? 'MP' + (a.party ? ', ' + a.party : '') : a.role === 'org' ? 'organisation' : a.role}</span></td><td>${a.text}</td><td>${CH[a.platform] || a.platform}</td><td class="num">${a.total ? fmtN(a.total) : '-'}</td><td class="den-mono">${aest(a.ts)}</td>`, 'post by ' + a.who))}</tbody></table>`
          : none('No registered organisation, official or MP posted on this desk in this window.')}
      <//>
      <${Panel} title="Upcoming" note="Dates as written in the rows, and dates recorded on a parliament's own page; never a guess" flush=${true}>
        ${d.upcoming.length ? html`<table class="den-table"><thead><tr><th>Date</th><th>What</th><th>As written</th><th></th></tr></thead><tbody>
          ${d.upcoming.map((u, i) => html`<tr key=${i} class="den-row" tabIndex="0" aria-label=${'Upcoming: ' + u.event + ' on ' + u.date}><td class="den-mono">${u.weekday.slice(0, 3)} ${u.date}${u.yearWritten ? '' : html` <span title="The source wrote no year: this is the next time that day comes">*</span>`}</td><td>${u.event}${u.recorded ? html` <span class="den-chip" title="Read from the parliament's own page for this bill or inquiry, not worked out from a sentence">recorded</span>` : null}</td><td>${u.what}</td><td class="act">${web(u.url) ? html`<a class="den-link" href=${web(u.url)} target="_blank" rel="noopener" aria-label="Open the source of this date">Open</a>` : null}</td></tr>`)}</tbody></table>`
          : html`<${Empty}>No row in this window names a day and a month beside an action that has not yet passed, and no watched bill or inquiry has a date ahead.<//>`}
      <//>
      ${c.aside || c.muted || c.otherRegions ? html`<p class="den-mono">${[c.aside ? c.aside + ' set aside' : '', c.muted ? c.muted + ' muted' : '', c.otherRegions ? c.otherRegions + ' in other regions' : ''].filter(Boolean).join(', ')} and not shown. ${c.aside ? html`<button class="den-link" aria-expanded=${showAside ? 'true' : 'false'} onClick=${() => setShowAside(!showAside)}>${showAside ? 'Hide' : 'Show'} what was set aside</button>` : null}</p>` : null}
      ${showAside && d.aside.length ? html`<${Panel} title="Set aside" flush=${true}><table class="den-table"><thead><tr><th>Row</th><th>Reason</th><th>By</th><th></th></tr></thead><tbody>${d.aside.map(a => html`<tr key=${a.id}><td>${a.title || CH[a.channel] || a.channel}</td><td>${a.reason}</td><td class="den-mono">${a.by} ${since(a.at)}</td><td class="act">${canWrite ? html`<button class="den-mini" onClick=${async () => { try { await call('/den/aside', { desk: desk.id, item: a.id, clear: true }); b.reload(); } catch (e) { toastMsg(say(e), true); } }}>Put it back</button>` : null}</td></tr>`)}</tbody></table><//>` : null}
    </div>`;
  }

  /* ---- Brief ---- */
  /* Words added and removed between two texts (longest common run of words). Long texts compare by paragraph. */
  function diffWords(a, b) {
    const A = String(a || '').replace(/\[[A-Z]:[^\]]+\]/g, '').split(/(\s+)/).filter(Boolean), B = String(b || '').replace(/\[[A-Z]:[^\]]+\]/g, '').split(/(\s+)/).filter(Boolean);
    if (A.length * B.length > 4e6) return [{ t: 'same', s: 'These two are too long to compare word by word.' }];
    const n = A.length, m = B.length; const L = []; for (let i = 0; i <= n; i++) L.push(new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; const push = (t, s) => { const l = out[out.length - 1]; if (l && l.t === t) l.s += s; else out.push({ t, s }); }; let i = 0, j = 0;
    while (i < n && j < m) { if (A[i] === B[j]) { push('same', A[i]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) { push('del', A[i]); i++; } else { push('ins', B[j]); j++; } }
    while (i < n) push('del', A[i++]); while (j < m) push('ins', B[j++]);
    return out;
  }
  function Section({ s, sec, text, evidence, readOnly, onChange, onBlur, onRegen, busy, left, onCite }) {
    const [ask, setAsk] = useState(false); const [note, setNote] = useState(''); const dirty = sec && text !== sec.text;
    const cites = sec ? sec.cites || [] : [];
    return html`<div class="den-sec" data-section=${s.id}>
      <h4>${s.title}${sec && sec.edited ? html`<span class="den-chip acc" title="A person has edited this section; a model will not write over it unless asked">edited by ${sec.by}</span>` : sec && sec.by === 'model' ? html`<span class="den-chip">drafted</span>` : null}${dirty ? html`<span class="den-chip warn">not saved</span>` : null}</h4>
      <textarea class="den-ta" aria-label=${s.title} readOnly=${readOnly} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section, or draft the brief. Keep the [M:123] marks: they are the citations.'} onInput=${e => onChange(s.id, e.target.value)} onBlur=${onBlur}></textarea>
      ${cites.length ? html`<div class="den-cites" role="group" aria-label="What this section cites">${cites.map(id => { const e = evidence[id] || {}; return web(e.url) ? html`<a key=${id} class="den-chip den-cite" href=${web(e.url)} target="_blank" rel="noopener" data-tip=${String(e.label || id).slice(0, 160)} aria-label=${id + ': ' + String(e.label || 'the cited row').slice(0, 120) + '. Opens the source'}>${id}${e.gated ? ' (subscriber)' : ''}</a>` : html`<span key=${id} class="den-chip den-cite" tabIndex="0" data-tip=${String(e.label || id).slice(0, 160)}>${id}</span>`; })}
        <button type="button" class="den-link" aria-label=${'Show the evidence ' + s.title + ' cites, beside the page'} onClick=${() => onCite && onCite(cites[0])}>Show beside the page</button></div>` : null}
      ${sec && !dirty && ((sec.uncited || []).length || (sec.unverified || []).length || (sec.trimmed || []).length) ? html`<ul class="den-flags">
        ${(sec.uncited || []).map((u, i) => html`<li key=${'u' + i}><span class="w">No evidence behind:</span> ${u}</li>`)}
        ${(sec.unverified || []).map((u, i) => html`<li key=${'f' + i}><span class="w">${u.figures.join(', ')}</span> is not in the row it cites: ${u.sentence}</li>`)}
        ${(sec.trimmed || []).map((u, i) => html`<li key=${'t' + i}><span class="w">A subscriber quotation was cut at thirty words:</span> ${u}...</li>`)}</ul>` : null}
      ${!readOnly && onRegen ? (ask ? html`<div class="den-form" style=${{ marginTop: '8px' }}><label class="den-lab" style=${{ flex: '1 1 260px' }}>What to change (optional)<input value=${note} maxlength="400" placeholder="Shorter. Lead with the Senate vote." onInput=${e => setNote(e.target.value)} /></label>
          <button class="den-mini primary" disabled=${busy || !left} title=${left ? '' : 'Today\'s Den model calls are used'} onClick=${() => { onRegen(s.id, note, sec && sec.edited); setAsk(false); }}>Write it again (1 model call)</button><button class="den-mini" onClick=${() => setAsk(false)}>Cancel</button>
          ${sec && sec.edited ? html`<span class="den-save dirty">This replaces ${sec.by}'s edit.</span>` : null}</div>`
        : html`<div style=${{ marginTop: '8px' }}><button class="den-mini" disabled=${busy || dirty} title=${dirty ? 'Save your edit first' : 'One model call, counted against today\'s Den budget'} onClick=${() => setAsk(true)}>Regenerate this section</button></div>`) : null}
    </div>`;
  }
  function BriefPanel({ desk, tick, bump, budget, canWrite, setTab }) {
    const [evSel, setEvSel] = useState(null); useEffect(() => { if (evSel) { const e = document.getElementById('den-ev-' + evSel); if (e && e.scrollIntoView) e.scrollIntoView({ block: 'nearest' }); } }, [evSel]);
    const wk = b => 'ax_den_work_' + b.id;
    const L = useLoad(() => get('/den/brief?' + q({ desk: desk.id }), 'brief'), [desk.id, tick], desk.id);
    const [work, setWork] = useState(null);        // { id, revision, sections: {id: text}, ratings } - this person's unsaved words
    const [save, setSave] = useState({ s: 'idle', msg: '' }); const [busy, setBusy] = useState(''); const [conflict, setConflict] = useState(null); const [ask, setAsk] = useState(null); const [restored, setRestored] = useState(false);
    const [hist, setHist] = useState(null); const [cmp, setCmp] = useState(null); const [dropped, setDropped] = useState(false); const saving = useRef(false); const mine = useRef(0); const workRef = useRef(null);
    const brief = L.data ? L.data.brief : null; const left = budget ? budget.left : 1;
    const texts = b => { const o = {}; desk.sections.forEach(s => { if (s.kind !== 'sources') o[s.id] = (b.sections[s.id] && b.sections[s.id].text) || ''; }); return o; };
    // open the brief: this person's unsaved words, if any were kept on this computer, come back over it
    useEffect(() => { workRef.current = work; }, [work]);
    useEffect(() => { if (!brief) { setWork(null); return; } if (mine.current === brief.revision) { mine.current = 0; return; }   // my own save: the editor was already brought up to it, words typed meanwhile included
      const kept = ls.get(wk(brief), null);
      if (kept && kept.sections && (kept.revision === brief.revision || Object.keys(kept.sections).some(k => kept.sections[k] !== ((brief.sections[k] || {}).text || '')))) { setWork({ id: brief.id, revision: kept.revision, sections: Object.assign(texts(brief), kept.sections), ratings: kept.ratings || brief.ratings }); setRestored(true); if (kept.revision !== brief.revision) setConflict({ theirs: brief }); }
      else { setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); } setHist(null); setCmp(null); }, [brief && brief.id, brief && brief.revision]);   // eslint-disable-line
    const dirtyIds = brief && work ? Object.keys(work.sections).filter(k => work.sections[k] !== ((brief.sections[k] || {}).text || '')) : []; const ratingsDirty = brief && work ? JSON.stringify(work.ratings || {}) !== JSON.stringify(brief.ratings || {}) : false; const dirty = dirtyIds.length > 0 || ratingsDirty;
    useEffect(() => { if (!brief || !work) return; if (dirty) ls.set(wk(brief), { revision: work.revision, sections: dirtyIds.reduce((a, k) => { a[k] = work.sections[k]; return a; }, {}), ratings: work.ratings, at: Date.now() }); else ls.del(wk(brief)); }, [work, brief && brief.revision]);   // eslint-disable-line
    useEffect(() => { const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    const change = (id, v) => { setWork(w => Object.assign({}, w, { sections: Object.assign({}, w.sections, { [id]: v }) })); setSave({ s: 'dirty', msg: '' }); };
    const doSave = useCallback(async (over) => { if (!brief || !work || saving.current) return false; if (!dirty && !over) return true; saving.current = true; setSave({ s: 'saving', msg: '' });
      const sent = dirtyIds.reduce((a, k) => { a[k] = work.sections[k]; return a; }, {}); const sentRatings = JSON.stringify(work.ratings || {});
      try { const d = await call('/den/brief/save', { id: brief.id, revision: over ? over.revision : work.revision, sections: sent, ratings: ratingsDirty ? work.ratings : undefined });
        // what was saved takes the server's words; what was typed in another section while this save was in flight stays in the editor, unsaved
        const now = workRef.current || work; const base = texts(d.brief); const next = Object.assign({}, base); let more = false;
        Object.keys(now.sections).forEach(k => { const was = (brief.sections[k] || {}).text || ''; if (now.sections[k] !== (k in sent ? sent[k] : was)) { next[k] = now.sections[k]; more = true; } });
        const ratings = JSON.stringify(now.ratings || {}) !== sentRatings ? now.ratings : d.brief.ratings; if (ratings !== d.brief.ratings) more = true;
        mine.current = d.brief.revision; setWork({ id: d.brief.id, revision: d.brief.revision, sections: next, ratings }); if (!more) ls.del(wk(brief));
        setConflict(null); setRestored(false); L.set({ ok: true, brief: d.brief }); setSave(more ? { s: 'dirty', msg: '' } : { s: 'saved', msg: 'revision ' + d.brief.revision }); saving.current = false; return true; }
      catch (e) { saving.current = false; if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); setSave({ s: 'bad', msg: 'Someone else saved this brief first.' }); } else setSave({ s: 'bad', msg: say(e) }); return false; } }, [brief, work, dirty, ratingsDirty, dirtyIds.join('|')]);   // eslint-disable-line
    useEffect(() => { const key = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && brief && work) { e.preventDefault(); doSave(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [doSave]);   // eslint-disable-line
    const keepMine = () => { const t = conflict.theirs; const kept = ls.get(wk(t), null); if (kept) ls.set(wk(t), Object.assign({}, kept, { revision: t.revision })); setWork(w => Object.assign({}, w, { revision: t.revision })); L.set({ ok: true, brief: t }); setConflict(null); setSave({ s: 'dirty', msg: 'Your words are kept. Save to put them over theirs.' }); };
    const takeTheirs = () => { const t = conflict.theirs; ls.del(wk(t)); L.set({ ok: true, brief: t }); setWork({ id: t.id, revision: t.revision, sections: texts(t), ratings: t.ratings }); setConflict(null); setRestored(false); setSave({ s: 'idle', msg: '' }); };
    const guard = async (name, fn) => { if (busy) return; setBusy(name); setDropped(false); try { await fn(); } catch (e) { if (!e.code && !e.status) setDropped(true); else if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); toastMsg('Someone else changed this brief first.', true); } else toastMsg(say(e), true); } setBusy(''); bump('budget'); };
    const draft = replace => guard('draft', async () => { const d = await call('/den/brief', { desk: desk.id, replace: !!replace }); L.set({ ok: true, brief: d.brief }); toastMsg('Drafted from ' + Object.keys(d.brief.evidence).length + ' rows of evidence' + ((d.dropped || []).length ? '; ' + d.dropped.length + ' citation' + (d.dropped.length === 1 ? ' the evidence never gave was removed' : 's the evidence never gave were removed') : '')); });
    const regen = (section, instruction, force) => guard('section', async () => { const d = await call('/den/brief/section', { id: brief.id, section, revision: brief.revision, instruction, force: !!force }); L.set({ ok: true, brief: d.brief }); toastMsg('Section written again'); });
    const file = ack => guard('file', async () => { try { const d = await call('/den/brief/file', { id: brief.id, revision: brief.revision, acknowledge: !!ack }); setAsk(null); L.set({ ok: true, brief: d.brief }); toastMsg('Marked as filed'); bump('filed'); } catch (e) { if (e.code === 'uncited_signals') { setAsk(e.body); return; } throw e; } });
    const reopen = () => guard('file', async () => { const d = await call('/den/brief/file', { id: brief.id, reopen: true }); L.set({ ok: true, brief: d.brief }); });
    const start = () => guard('hand', async () => { const d = await call('/den/brief/save', { desk: desk.id }); L.set({ ok: true, brief: d.brief }); });
    const fname = ext => (desk.id + '-' + brief.day + (brief.status === 'filed' ? '' : '-draft') + '.' + ext);
    const download = async fmt => { try { const t = await getText('/den/brief?' + q({ id: brief.id, format: fmt })); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: fmt === 'html' ? 'text/html' : 'text/markdown' })); a.download = fname(fmt); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (e) { toastMsg(say(e), true); } };
    const copy = async fmt => { try { const t = await getText('/den/brief?' + q({ id: brief.id, format: fmt === 'rich' ? 'html' : 'slack' }));
        if (fmt === 'rich' && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { const body = (/<body>([\s\S]*)<\/body>/.exec(t) || [0, t])[1]; const plain = body.replace(/<\/(p|h1|h2|h3|li)>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); toastMsg('Copied with its headings and links: paste into the document'); }
        else { await navigator.clipboard.writeText(fmt === 'rich' ? t.replace(/<[^>]+>/g, ' ') : t); toastMsg(fmt === 'rich' ? 'Copied as plain text (this browser cannot copy formatted text)' : 'Slack summary copied'); } } catch (e) { toastMsg('Could not copy: ' + say(e), true); } };
    const loadHist = async () => { if (hist) return setHist(null); try { setHist((await call('/den/brief/history?' + q({ id: brief.id }))).revisions || []); } catch (e) { toastMsg(say(e), true); } };
    const compare = async () => { if (cmp) return setCmp(null); try { const d = await call('/den/brief?' + q({ desk: desk.id, prev: 1, day: brief.day })); setCmp(d.brief ? d.brief : { none: true }); } catch (e) { toastMsg(say(e), true); } };

    if (L.loading && !L.data) return html`<${Loading} what="the brief" />`;
    if (L.err && !L.data) return html`<${Failed} what="The brief" err=${L.err} onRetry=${L.reload} />`;
    const cost = 'One model call (a second only if the first answer cannot be read). ' + (budget ? budget.left + ' of ' + budget.cap + ' left today.' : '');
    const droppedNote = dropped ? html`<div class="den-notice bad" role="alert">The connection dropped while the worker was writing. The worker may still finish and save it: nothing here was lost. <div><button class="den-mini primary" onClick=${() => { setDropped(false); L.reload(); }}>Check for the draft</button></div></div>` : null;
    if (!brief) return html`<div>${droppedNote}<${Panel} title=${'Today\'s brief - ' + desk.name}>
      <${Empty}><b>No brief has been started for this window.</b> A draft is written from the rows on the Today tab, every sentence tied to the row it rests on; pin the rows it must cover first.
        ${canWrite ? html`<div style=${{ marginTop: '10px' }}><button class="den-mini primary" disabled=${!!busy || !left} onClick=${() => draft(false)}>${busy === 'draft' ? 'Drafting (a minute or two)...' : 'Draft the brief (1 model call)'}</button> <button class="den-mini" disabled=${!!busy} onClick=${start}>Write it by hand</button><span class="den-sub">${left ? cost : 'Today\'s Den model calls are used. A brief can still be written by hand.'}</span></div>` : html`<div style=${{ marginTop: '8px' }}>Your key is read-only: drafting and writing need a full key.</div>`}<//><//></div>`;
    const filed = brief.status === 'filed'; const ro = !canWrite || filed; const ev = brief.evidence || {}; const evIds = Object.keys(ev);
    const src = desk.sections.find(s => s.kind === 'sources'); const others = desk.sections.filter(s => s.kind !== 'sources' && desk.options.hidden.indexOf(s.id) < 0);
    const flags = others.reduce((n, s) => n + (((brief.sections[s.id] || {}).uncited || []).length), 0);
    return html`<div>
      ${droppedNote}
      ${restored && !conflict ? html`<div class="den-notice" role="status">Your unsaved words from ${since((ls.get(wk(brief), {}) || {}).at)} were kept on this computer and are back in the editor. <div><button class="den-mini primary" disabled=${ro} onClick=${() => doSave()}>Save them</button><button class="den-mini" onClick=${() => { ls.del(wk(brief)); setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); setSave({ s: 'idle', msg: '' }); }}>Discard them</button></div></div>` : null}
      ${conflict ? html`<div class="den-notice bad" role="alert"><b>${conflict.theirs.sections && Object.keys(conflict.theirs.sections).map(k => conflict.theirs.sections[k].by).filter(x => x && x !== 'model').pop() || 'Someone else'} saved this brief after you opened it</b> (it is now revision ${conflict.theirs.revision}). Your words are still here and nothing was overwritten.
        <div><button class="den-mini primary" onClick=${keepMine}>Keep mine</button><button class="den-mini" onClick=${takeTheirs}>Take theirs</button></div><span class="den-sub">Keep mine keeps what you typed in the sections you changed; you then save it over theirs. Take theirs discards what you typed.</span></div>` : null}
      <${Panel} title=${desk.client + ' - ' + desk.name} note=${'Reporting window: ' + (brief.window.label || brief.day)} flush=${true}
        actions=${html`<span class=${'den-chip ' + (filed ? 'pos' : 'warn')}>${filed ? 'Filed by ' + brief.filed_by + ', ' + aest(brief.filed_at) : 'Draft'}</span><span class="den-mono">revision ${brief.revision}</span>`}>
        ${desk.ratings.items.length ? html`<div class="den-bar" style=${{ borderTop: 0, borderBottom: '1px solid var(--line)' }}>${desk.ratings.items.map(i => { const r = (work && work.ratings && work.ratings[i.id]) || {}; const set = (k, v) => { setWork(w => Object.assign({}, w, { ratings: Object.assign({}, w.ratings, { [i.id]: Object.assign({}, r, { [k]: v }) }) })); setSave({ s: 'dirty', msg: '' }); };
          const seg = (label, k, words) => html`<span class="den-lab">${k === 'trend' ? 'Trend' : label}<span class="den-seg" role="radiogroup" aria-label=${k === 'trend' ? label + ' trend' : label}>${words.map(l => html`<button key=${l} type="button" role="radio" class="den-tab" aria-checked=${r[k] === l ? 'true' : 'false'} disabled=${ro} title=${r[k] === l ? 'Press again to leave it unrated' : ''} onClick=${() => set(k, r[k] === l ? '' : l)}>${l}</button>`)}</span></span>`;
          return html`<span key=${i.id} class="den-form">${seg(i.label, 'level', desk.ratings.levels)}${i.trend ? seg(i.label, 'trend', desk.ratings.trends) : null}</span>`; })}</div>` : null}
        ${others.map(s => html`<${Section} key=${s.id} s=${s} sec=${brief.sections[s.id]} text=${work ? (work.sections[s.id] || '') : ''} evidence=${ev} readOnly=${ro} onChange=${change} onBlur=${() => { if (dirty && !conflict) doSave(); }} onRegen=${canWrite && !filed ? regen : null} busy=${!!busy} left=${left} onCite=${setEvSel} />`)}
        ${src ? html`<div class="den-sec"><h4>${src.title}<span class="den-chip" title="Built from the rows the brief cites. It is never written by a model and cannot be edited: change what is cited instead.">built from the citations</span></h4>
          ${brief.sourceList.length ? brief.sourceList.map(g => html`<div key=${g.group}><div class="den-mono" style=${{ margin: '6px 0 2px' }}>${g.group}</div><ol class="den-ev">${g.items.map(i => html`<li key=${i.id}>${i.label}${web(i.url) ? html` - <a class="den-link" href=${web(i.url)} target="_blank" rel="noopener">${i.url}</a>` : null}</li>`)}</ol></div>`) : html`<span class="den-mono">Nothing is cited yet, so there is nothing to list.</span>`}</div>` : null}
        <div class="den-bar" role="status" aria-live="polite">
          <span class=${'den-save ' + (save.s === 'bad' ? 'bad' : dirty ? 'dirty' : save.s === 'saved' ? 'ok' : '')}>${save.s === 'saving' ? 'Saving...' : save.s === 'bad' ? 'Not saved: ' + save.msg + ' Your words are kept on this computer.' : dirty ? 'Unsaved changes (kept on this computer)' + (save.msg ? '. ' + save.msg : '') : save.s === 'saved' ? 'Saved, ' + save.msg : filed ? 'Filed: reopen it to change it' : 'Saved'}</span>
          ${flags ? html`<span class="den-chip warn" title="Sentences that rest on no evidence row. They are marked under each section.">${flags} without evidence</span>` : null}
          <span class="den-spacer"></span>
          ${canWrite && !filed ? html`<button class="den-mini" disabled=${!dirty || save.s === 'saving' || !!conflict} onClick=${() => doSave()}>Save changes</button>
            <button class="den-mini" disabled=${!!busy || !left || dirty} title=${dirty ? 'Save your edits first' : cost} onClick=${() => { if (Object.keys(brief.sections).some(k => brief.sections[k].edited)) setAsk({ redraft: true }); else draft(true); }}>${busy === 'draft' ? 'Drafting...' : 'Draft again (1 model call)'}</button>
            <button class="den-mini primary" disabled=${!!busy || dirty} title=${dirty ? 'Save your edits first' : 'A person files a brief: nothing files by itself'} onClick=${() => file(false)}>${busy === 'file' ? 'Checking...' : 'Mark as filed'}</button>` : null}
          ${canWrite && filed ? html`<button class="den-mini" disabled=${!!busy} onClick=${reopen}>Reopen</button>` : null}
        </div>
        <div class="den-bar"><button class="den-mini" aria-expanded=${hist ? 'true' : 'false'} onClick=${loadHist}>History</button><button class="den-mini" aria-expanded=${cmp ? 'true' : 'false'} onClick=${compare}>Compare with the last filed brief</button><span class="den-spacer"></span><span class="den-mono">Get it out${dirty ? ' (of the saved brief: save first to include your edits)' : ''}:</span><button class="den-mini" onClick=${() => copy('rich')}>Copy for the document</button><button class="den-mini" onClick=${() => download('md')}>Download .md</button><button class="den-mini" onClick=${() => download('html')}>Download .html</button><button class="den-mini" onClick=${() => copy('slack')}>Copy the Slack summary</button>
          </div>
      <//>
      ${evSel ? html`<${Sheet} title="Evidence behind this brief" onClose=${() => setEvSel(null)}><p class="den-quiet">Every row the draft was given, by its mark. A sentence may cite only these.</p>
        ${evIds.length ? evIds.map(id => html`<div key=${id} id=${'den-ev-' + id} class=${'den-evrow' + (id === evSel ? ' on' : '')}><span class="den-chip acc">${id}</span><div><span class="den-t">${ev[id].label || 'A row of evidence'}</span>${ev[id].gated ? html`<span class="den-sub">A subscriber outlet: a brief quotes at most thirty words.</span>` : null}${web(ev[id].url) ? html`<a class="den-link" href=${web(ev[id].url)} target="_blank" rel="noopener" aria-label=${'Open the source of ' + id}>Open the source</a>` : null}</div></div>`) : html`<${Empty}>This brief holds no evidence rows: it was started by hand.<//>`}<//>` : null}
      ${hist ? html`<${Sheet} title="Every save of this brief" onClose=${() => setHist(null)}><${Panel} title="History" note="The last sixty saves" flush=${true}>${hist.length ? html`<table class="den-table"><thead><tr><th class="num">Revision</th><th>What</th><th>By</th><th>When</th></tr></thead><tbody>${hist.map((h, i) => html`<tr key=${i}><td class="num">${h.revision}</td><td>${h.note}</td><td>${h.by}</td><td class="den-mono">${aest(h.at)}</td></tr>`)}</tbody></table>` : html`<${Empty}>No save is recorded yet.<//>`}<//><//>` : null}
      ${cmp ? html`<${Sheet} title="What changed since the last filed brief" onClose=${() => setCmp(null)}><${Panel} title="Against the last filed brief" note=${cmp.none ? '' : cmp.day + ', filed by ' + cmp.filed_by}>${cmp.none ? html`<${Empty}>No brief was filed on this desk before this one, so there is nothing to compare with.<//>`
        : others.map(s => html`<div key=${s.id} class="den-sec den-diff"><h4>${s.title}</h4><p>${diffWords((cmp.sections[s.id] || {}).text, (brief.sections[s.id] || {}).text).map((p, i) => p.t === 'ins' ? html`<ins key=${i}>${p.s}</ins>` : p.t === 'del' ? html`<del key=${i}>${p.s}</del>` : p.s)}</p></div>`)}<//><//>` : null}
      ${ask && ask.redraft ? html`<${Dialog} title="Draft again?" onClose=${() => setAsk(null)}><p>Some sections were edited by a person. Drafting again replaces the whole brief, their words included. To keep them, regenerate single sections instead.</p><p class="den-mono">${cost}</p><div class="den-form"><button class="den-mini danger" onClick=${() => { setAsk(null); draft(true); }}>Replace it all (1 model call)</button><button class="den-mini" onClick=${() => setAsk(null)}>Go back</button></div><//>` : null}
      ${ask && ask.signals ? html`<${Dialog} title="Before it is filed" onClose=${() => setAsk(null)}><p>${ask.signals.length === 1 ? 'One thing' : ask.signals.length + ' things'} on the strip ${ask.signals.length === 1 ? 'is' : 'are'} not in this brief:</p>
        <ul class="den-ev">${ask.signals.map(s => html`<li key=${s.key}><b>${s.title}</b><br />${s.detail}</li>`)}</ul><p class="den-mono">Filing anyway records that these were seen and left out.</p>
        <div class="den-form"><button class="den-mini" onClick=${() => setAsk(null)}>Go back and cover them</button><button class="den-mini primary" disabled=${!!busy} onClick=${() => file(true)}>File anyway</button></div><//>` : null}
    </div>`;
  }

  /* ---- Watch: the register and the proposals that wait for a person ---- */
  const KINDS = [['proposed', 'Proposals'], ['term', 'Terms'], ['hashtag', 'Hashtags'], ['account', 'Accounts'], ['group', 'Groups'], ['source', 'Outlets'], ['dismissed', 'Dismissed']];
  function Proposal({ p, desk, canWrite, onDone }) {
    const [mode, setMode] = useState(''); const [issue, setIssue] = useState(p.issue || (desk.issues[0] || {}).id || ''); const [why, setWhy] = useState(''); const [prev, setPrev] = useState(null); const [busy, setBusy] = useState(false);
    const decide = async body => { setBusy(true); try { const d = await call('/den/watch/decide', Object.assign({ id: p.id }, body)); if (d.note) toastMsg(d.note); onDone(); } catch (e) { toastMsg(say(e), true); } setBusy(false); };
    const preview = async () => { if (prev) return setPrev(null); setBusy(true); try { setPrev(await call('/den/preview?' + q({ ns: desk.ns, term: p.value }))); } catch (e) { toastMsg(say(e), true); } setBusy(false); };
    return html`<tr class="den-row"><td><span class="den-chip">${p.kind}${p.kind === 'account' || p.kind === 'group' ? ' on ' + (CH[p.platform] || p.platform) : ''}</span></td>
      <td><span class="den-t">${p.kind === 'hashtag' ? '#' : ''}${p.value}</span><span class="den-sub">${p.reason || (p.source === 'reports' ? 'From the reports.' : '')}</span>
        ${(p.evidence || []).length ? html`<ul class="den-ev">${p.evidence.slice(0, 5).map((e, i) => html`<li key=${i}>${e.label ? html`<b>${e.label}</b> (${e.rows} rows)` : e.text} ${web(e.url) ? html`<a class="den-link" href=${web(e.url)} target="_blank" rel="noopener" aria-label="Open this evidence row">open</a>` : null}</li>`)}</ul>` : null}
        ${prev ? html`<div class="den-notice" style=${{ marginTop: '8px' }}><b>In the last ${prev.days} days:</b> ${prev.matched} row${prev.matched === 1 ? '' : 's'} carry it; ${prev.already} already on this desk; it would add ${prev.new}${prev.new ? ' (' + Object.keys(prev.byChannel).map(k => prev.byChannel[k] + ' ' + (CH[k] || k)).join(', ') + '), of which ' + prev.australian + ' say something Australian' : ''}. ${prev.note}
          ${prev.new && Object.keys(prev.byChannel).length ? html`<ul class="den-bars" style=${{ margin: '8px 0', maxWidth: '360px' }}>${Object.keys(prev.byChannel).map(k => html`<li key=${k}><span>${CH[k] || k}</span><b>${prev.byChannel[k]}</b><span class="t"><i style=${{ width: (prev.byChannel[k] / Math.max.apply(null, Object.keys(prev.byChannel).map(x => prev.byChannel[x]))) * 100 + '%', backgroundColor: serCol(serKey(k)) }}></i></span></li>`)}</ul>` : null}
          ${prev.sample.length ? html`<ul class="den-ev">${prev.sample.slice(0, 8).map(x => html`<li key=${x.id}>${x.australian ? '' : html`<span class="den-chip warn">not Australian</span> `}${x.text}</li>`)}</ul>` : null}</div>` : null}
        ${mode === 'approve' ? html`<div class="den-form" style=${{ marginTop: '8px' }}>${p.kind === 'term' ? html`<label class="den-lab">Files under<select value=${issue} onChange=${e => setIssue(e.target.value)}>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}<option value="">no issue (searched for only)</option></select></label>` : null}
          <button class="den-mini primary" disabled=${busy} onClick=${() => decide(Object.assign({ decision: 'approve' }, p.kind === 'term' ? { issue } : {}))}>Approve</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button><span class="den-sub">${p.kind === 'term' ? 'It joins what every collector searches for and how new rows are filed. It never changes what counts as a spike.' : 'Collectors read it from the next sweep.'}</span></div>` : null}
        ${mode === 'dismiss' ? html`<div class="den-form" style=${{ marginTop: '8px' }}><label class="den-lab" style=${{ flex: '1 1 240px' }}>Why (it is never proposed again)<input value=${why} maxlength="300" onInput=${e => setWhy(e.target.value)} /></label><button class="den-mini danger" disabled=${busy || why.trim().length < 3} onClick=${() => decide({ decision: 'dismiss', reason: why })}>Dismiss</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button></div>` : null}</td>
      <td class="num">${p.score ? html`${Math.round(p.score)}<span class="den-meter sm" aria-hidden="true"><i style=${{ width: Math.min(100, Math.round(p.score) * 10) + '%' }}></i></span>` : '-'}</td>
      <td class="act">${p.kind === 'term' ? html`<button class="den-mini" disabled=${busy} aria-expanded=${prev ? 'true' : 'false'} title="What it would have caught in what is already held. Free." onClick=${preview}>Preview</button> ` : null}${canWrite && !mode ? html`<button class="den-mini" onClick=${() => setMode('approve')}>Approve</button> <button class="den-mini" onClick=${() => setMode('dismiss')}>Dismiss</button>` : null}</td></tr>`;
  }
  function WatchPanel({ desk, tick, bump, canWrite }) {
    const [kind, setKind] = useState('proposed'); const [busy, setBusy] = useState(''); const [found, setFound] = useState(null); const [add, setAdd] = useState({ kind: 'term', platform: 'x', value: '', name: '', actor_kind: '', issue: '' });
    const W = useLoad(() => get('/den/watch?' + q({ ns: desk.ns }), 'watch'), [desk.ns, tick], desk.ns);
    const X = useLoad(() => get('/den/lexicon?' + q({ ns: desk.ns, review: 1 }), 'terms'), [desk.ns, tick], desk.ns);
    const T = useLoad(() => get('/den/themes?' + q({ ns: desk.ns }), 'themes'), [desk.ns, tick], desk.ns);
    const act = async (name, fn) => { setBusy(name); try { await fn(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const discover = () => act('discover', async () => { const d = await call('/den/discover', { ns: desk.ns }); setFound(d); W.reload(); });
    const themes = () => act('themes', async () => { await call('/den/themes', { ns: desk.ns }); T.reload(); bump('budget'); });
    const decide = (id, decision) => act('row', async () => { await call('/den/watch/decide', { id, decision }); W.reload(); X.reload(); });
    const remove = id => act('row', async () => { await call('/den/watch/delete', { id }); W.reload(); X.reload(); });
    const setIssue = (id, issue) => act('row', async () => { await call('/den/watch/update', { id, issue }); W.reload(); X.reload(); });
    const submit = () => act('add', async () => { const b = Object.assign({ ns: desk.ns }, add); if (b.kind !== 'account') { delete b.actor_kind; delete b.name; } if (b.kind === 'term' || b.kind === 'source' || b.kind === 'group') delete b.platform; await call('/den/watch/add', b); setAdd(Object.assign({}, add, { value: '', name: '' })); toastMsg('Added to the register'); W.reload(); X.reload(); });
    if (W.loading && !W.data) return html`<${Loading} what="the register" />`;
    if (W.err && !W.data) return html`<${Failed} what="The register" err=${W.err} onRetry=${W.reload} />`;
    const all = W.data.watch || []; const props = all.filter(r => r.status === 'proposed'); const gone = all.filter(r => r.status === 'dismissed'); const rows = kind === 'proposed' ? props : kind === 'dismissed' ? gone : all.filter(r => r.kind === kind && r.status !== 'proposed' && r.status !== 'dismissed'); const lex = X.data; const th = T.data && T.data.themes && T.data.themes.length ? T.data : null;
    const term = id => (lex && lex.terms || []).find(t => t.id === id) || {};
    return html`<div>
      ${X.err ? html`<div class="den-notice bad" role="alert">The desk's lexicon could not be loaded: ${X.err} The register below is complete, but the notes on each term (review, generic, the cap) are missing. <button class="den-mini" onClick=${X.reload}>Try again</button></div>` : null}
      ${T.err ? html`<div class="den-notice bad" role="alert">The last grouping of the proposals could not be loaded: ${T.err} The proposals themselves are all below. <button class="den-mini" onClick=${T.reload}>Try again</button></div>` : null}
      <div class="den-tabs" role="tablist" aria-label="Register">${KINDS.map(k => { const n = k[0] === 'proposed' ? props.length : k[0] === 'dismissed' ? gone.length : all.filter(r => r.kind === k[0] && r.status === 'active').length; return html`<button key=${k[0]} role="tab" class="den-tab" aria-selected=${kind === k[0] ? 'true' : 'false'} onClick=${() => setKind(k[0])}>${k[1]}<span class="n">${n}</span></button>`; })}</div>
      ${kind === 'proposed' ? html`<${Panel} title="Waiting for a person" note="Nothing proposed is read by any collector until it is approved" flush=${true}
          actions=${canWrite ? html`<button class="den-mini" disabled=${!!busy} title="Reads what the archive already holds. No model call, nothing collected." onClick=${discover}>${busy === 'discover' ? 'Looking...' : 'Find new keywords now (free)'}</button><button class="den-mini" disabled=${!!busy || props.length < 4} title=${props.length < 4 ? 'With fewer than four waiting, read them as they are' : 'One model call. It changes no status.'} onClick=${themes}>${busy === 'themes' ? 'Grouping...' : 'Group into themes (1 model call)'}</button>` : null}>
          ${found ? html`<div class="den-notice ${found.filed.proposed ? 'good' : ''}" role="status">Read ${fmtN(found.rows.scanned)} rows of the last ${found.days} days (${fmtN(found.rows.desk)} on this desk). ${found.filed.proposed} new proposal${found.filed.proposed === 1 ? '' : 's'}; ${found.filed.known} already decided or waiting. ${(found.thin || []).join(' ')}</div>` : null}
          ${th ? html`<div class="den-notice" role="status"><b>Grouped ${since(th.at)}</b> by one model call; it changed nothing.<ul class="den-ev">${th.themes.map((t, i) => html`<li key=${i}><b>${t.name}</b>: ${t.why} <span class="den-mono">(${t.ids.map(id => (all.find(r => r.id === id) || {}).value).filter(Boolean).join(', ')})</span></li>`)}</ul></div>` : null}
          ${props.length ? html`<table class="den-table den-review"><thead><tr><th>Kind</th><th>Candidate, and why</th><th class="num">Score</th><th></th></tr></thead><tbody>${props.map(p => html`<${Proposal} key=${p.id} p=${p} desk=${desk} canWrite=${canWrite} onDone=${() => { W.reload(); X.reload(); }} />`)}</tbody></table>`
            : html`<${Empty}><b>Nothing is waiting.</b> Proposals arrive once a day from what was collected, and from the reports with <code>tools/den-mine-reports.py</code>. ${canWrite ? 'Press Find new keywords now to look straight away.' : ''}<//>`}
        <//>`
      : kind === 'dismissed' ? html`<${Panel} title="Dismissed" note="Never proposed again. Each can be brought back." flush=${true}>
          ${gone.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>What</th><th>Why it was dismissed</th><th>By</th><th></th></tr></thead><tbody>${gone.map(r => html`<tr key=${r.id} class="den-row"><td><span class="den-chip">${r.kind}</span></td><td><span class="den-t">${r.kind === 'hashtag' ? '#' : ''}${r.value}</span></td><td>${r.reason}</td><td class="den-mono">${r.decided_by} ${since(r.decided_at)}</td>
            <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} aria-label=${'Approve ' + r.value + ' after all'} onClick=${() => decide(r.id, 'approve')}>Approve after all</button>` : null}</td></tr>`)}</tbody></table>` : html`<${Empty}>Nothing has been dismissed on this desk.<//>`}
        <//>`
      : html`<${Panel} title=${KINDS.find(k => k[0] === kind)[1]} note=${kind === 'term' && lex ? lex.cap.active + ' of ' + lex.cap.max + ' active terms' : ''} flush=${true}>
          ${kind === 'term' && lex ? html`<div class="den-state">${lex.rule} The lexicon's own terms for this desk: ${lex.issues.map(i => html`<span key=${i.id} class="den-chip" title=${i.own.join(', ')}>${i.label}: ${i.own.length}${i.added.length ? ' + ' + i.added.length : ''}</span> `)}</div>` : null}
          ${rows.length ? html`<table class="den-table"><thead><tr><th>${kind === 'term' ? 'Term' : kind === 'source' ? 'Site' : 'Name'}</th><th>${kind === 'term' ? 'Files under' : 'Channel'}</th><th>State</th><th>Last read</th><th></th></tr></thead><tbody>
            ${rows.map(r => { const t = kind === 'term' ? term(r.id) : {}; return html`<tr key=${r.id} class="den-row"><td><span class="den-t">${kind === 'hashtag' ? '#' : ''}${r.value}</span>${r.name ? html`<span class="den-sub">${r.name}${r.actor_kind ? ' - a public actor (' + r.actor_kind + '), named on its own posts' : ''}</span>` : null}${t.note ? html`<span class="den-sub">${t.note}</span>` : null}</td>
              <td>${kind !== 'term' ? (CH[r.platform] || r.platform) : canWrite ? html`<select class="den-in" value=${r.issue || ''} disabled=${!!busy} aria-label=${'The issue "' + r.value + '" files under'} onChange=${e => setIssue(r.id, e.target.value)}><option value="">no issue (searched for only)</option>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}</select>` : ((desk.issues.find(i => i.id === r.issue) || {}).label || html`<span class="den-chip warn">no issue</span>`)}</td>
              <td><span class=${'den-chip ' + (r.status === 'active' ? 'pos' : '')}>${r.status === 'active' ? 'active' : 'off'}</span>${t.review ? html` <span class="den-chip warn" title="Approved a month ago or more and matched nothing since: keep it or switch it off">review</span>` : null}${t.generic ? html` <span class="den-chip" title="It does not name Australia: what it finds outside the watched places must say something Australian to be kept">generic</span>` : null}</td>
              <td class="den-mono">${r.last_ok ? since(r.last_ok) + (r.last_layer ? ', layer ' + r.last_layer : '') : kind === 'term' || kind === 'source' ? '-' : 'not yet'}${r.last_error ? html`<span class="den-sub" style=${{ color: 'var(--x-neg)' }}>${r.last_error}</span>` : null}</td>
              <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} onClick=${() => decide(r.id, r.status === 'active' ? 'off' : 'on')}>${r.status === 'active' ? 'Switch off' : 'Switch on'}</button> <button class="den-mini danger" disabled=${!!busy} aria-label=${'Delete ' + r.value} onClick=${() => { if (window.confirm('Delete "' + r.value + '" from this desk\'s register? It can be proposed again later.')) remove(r.id); }}>Delete</button>` : null}</td></tr>`; })}</tbody></table>`
            : html`<${Empty}>This desk's register holds no ${KINDS.find(k => k[0] === kind)[1].toLowerCase()} yet.${kind === 'account' ? ' A registered account is read on its own posts; mark it as a public actor only if it is an organisation, an official or a media outlet.' : ''}<//>`}
        <//>`}
      ${canWrite ? html`<${Panel} title="Add to the register"><div class="den-form">
        <label class="den-lab">Kind<select value=${add.kind} onChange=${e => setAdd(Object.assign({}, add, { kind: e.target.value }))}><option value="term">a term</option><option value="hashtag">a hashtag</option><option value="account">an account</option><option value="group">a public Facebook group</option><option value="source">an outlet</option></select></label>
        ${add.kind === 'account' || add.kind === 'hashtag' ? html`<label class="den-lab">Channel<select value=${add.platform} onChange=${e => setAdd(Object.assign({}, add, { platform: e.target.value }))}>${(add.kind === 'hashtag' ? ['instagram', 'any'] : ['x', 'facebook', 'instagram', 'youtube', 'tiktok', 'threads', 'linkedin']).map(p => html`<option key=${p} value=${p}>${CH[p] || 'any channel'}</option>`)}</select></label>` : null}
        <label class="den-lab" style=${{ flex: '1 1 220px' }}>${add.kind === 'term' ? 'Word or phrase' : add.kind === 'source' ? 'Site address' : add.kind === 'hashtag' ? 'Hashtag' : 'Handle or address'}<input value=${add.value} maxlength="200" onInput=${e => setAdd(Object.assign({}, add, { value: e.target.value }))} onKeyDown=${e => { if (e.key === 'Enter' && add.value.trim().length > 1) submit(); }} /></label>
        ${add.kind === 'account' ? html`<label class="den-lab">Its name<input value=${add.name} maxlength="120" onInput=${e => setAdd(Object.assign({}, add, { name: e.target.value }))} /></label><label class="den-lab">A public actor?<select value=${add.actor_kind} onChange=${e => setAdd(Object.assign({}, add, { actor_kind: e.target.value }))}><option value="">no: never named</option><option value="org">an organisation</option><option value="official">an official</option><option value="media">a media outlet</option></select></label>` : null}
        ${add.kind === 'term' ? html`<label class="den-lab">Files under<select value=${add.issue} onChange=${e => setAdd(Object.assign({}, add, { issue: e.target.value }))}><option value="">no issue (searched for only)</option>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}</select></label>` : null}
        <button class="den-mini primary" disabled=${!!busy || add.value.trim().length < 2} onClick=${submit}>Add</button></div>
        ${add.kind === 'account' && /tiktok|threads|linkedin/.test(add.platform) ? html`<p class="den-mono">No collector reads ${CH[add.platform]}: an account on it is kept as a note and collects nothing.</p>` : null}<//>` : null}
    </div>`;
  }

  /* ---- Collection ---- */
  function CollectionPanel({ desk, tick, bump, canWrite, setJob }) {
    const C = useLoad(() => get('/den/collection?' + q({ desk: desk.id }), 'channels'), [desk.id, tick], desk.id); const [busy, setBusy] = useState('');
    const collect = async ch => { setBusy(ch.id); try { const d = await call('/den/collect', { desk: desk.id, channel: ch.collect }); setJob({ id: d.id, status: d.where === 'desktop' ? 'queued' : 'running', lines: [], title: ch.label + (d.where === 'desktop' ? ' (waiting for the Mac collector)' : '') }); tailJob(d.id, j => setJob(o => (o && o.id === d.id ? Object.assign({}, o, j) : o)), () => { C.reload(); bump('collected'); }); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const toggle = async src => { const off = (C.data.reach.off || []).slice(); const i = off.indexOf(src); if (i >= 0) off.splice(i, 1); else off.push(src); setBusy('sw'); try { await call('/den/reach', { off }); C.reload(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    if (C.loading && !C.data) return html`<${Loading} what="collection" />`;
    if (C.err && !C.data) return html`<${Failed} what="Collection" err=${C.err} onRetry=${C.reload} />`;
    const d = C.data; const live = (d.reach.agents || []).filter(a => a.live); const bt = d.backtest;
    const state = c => { const k = c.collector; if (!k) return html`<span class="den-chip pos">from the worker</span>`; if (k.off) return html`<span class="den-chip warn">switched off</span>`; if (k.challenge) return html`<span class="den-chip neg" title=${'Stopped at a verification ' + since(k.challenge.at) + '. Nothing is retried: a person signs in again on the Mac.'}>paused: verification</span>`; if (k.offered) return html`<span class="den-chip pos">a collector is connected</span>`;
      return c.worker ? html`<span class="den-chip" title="The worker's own read of this channel runs. Its signed-in read waits: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there).">from the worker only</span>` : html`<span class="den-chip warn" title="Nothing reads this channel now: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there), and the worker has no route of its own.">no collector</span>`; };
    return html`<div>
      <div class="den-notice ${live.length ? 'good' : ''}" role="status">${live.length ? live.length + ' collector' + (live.length === 1 ? ' is' : 's are') + ' connected (' + live.map(a => a.agent).join(', ') + ').' : 'No Mac collector is connected. Channels read from the worker still run; signed-in reads wait.'} ${canWrite ? '' : 'Your key is read-only: collecting and the switches need a full key.'}</div>
      <div class="den-health" role="group" aria-label="Channels at a glance">${d.channels.map(c => { const k = c.collector; const st = !c.delivered.d1 ? (k && k.off ? ['off', 'switched off'] : k && k.challenge ? ['bad', 'paused at a verification'] : ['bad', 'nothing in the last day']) : ['ok', 'delivering']; return html`<div key=${c.id} class=${'den-hc ' + st[0]}>
        <span class="k"><i aria-hidden="true"></i>${c.label}</span><span class="v">${fmtN(c.delivered.d1 || 0)}<small>last day</small>${Array.isArray(c.delivered.days) && c.delivered.d7 ? html`<span class="den-spark" role="img" aria-label=${'The last seven days, oldest first: ' + c.delivered.days.join(', ')}>${c.delivered.days.map((n, i) => html`<i key=${i} style=${{ height: Math.max(8, (n / Math.max.apply(null, c.delivered.days.concat([1]))) * 100) + '%' }} class=${n ? '' : 'z'}></i>`)}</span>` : null}</span><span class="f">${st[1]} - ${fmtN(c.delivered.d7)} in 7 days</span></div>`; })}</div>
      <${Panel} title="Channels" note=${'What each delivered for ' + desk.name} flush=${true}>
        <table class="den-table"><thead><tr><th>Channel</th><th>How it is read</th><th>Now</th><th class="num">Last day</th><th class="num">7 days</th><th>Last delivered</th><th></th></tr></thead><tbody>
        ${d.channels.map(c => html`<tr key=${c.id} class="den-row"><td><span class="den-t">${c.label}</span>${c.accounts != null ? html`<span class="den-sub">${c.accounts} registered account${c.accounts === 1 ? '' : 's'}</span>` : null}</td><td>${c.how}${c.cannot ? html`<span class="den-sub">Cannot reach: ${c.cannot}</span>` : null}</td><td>${state(c)}</td>
          <td class="num">${c.delivered.d1 || html`<span class="den-chip warn" title="Nothing for this desk in the last day. That is a collection fact, not a quiet day.">0</span>`}</td><td class="num">${fmtN(c.delivered.d7)}</td><td class="den-mono">${c.delivered.last ? since(c.delivered.last) : 'never'}${c.delivered.layers.length ? ' (L' + c.delivered.layers.join(', L') + ')' : ''}</td>
          <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy || (c.collector && c.collector.off)} title=${c.collector && c.collector.off ? 'Switched off below' : 'Starts one collection job. No model call.'} onClick=${() => collect(c)}>${busy === c.id ? 'Starting...' : 'Collect now'}</button>` : null}</td></tr>`)}</tbody></table>
      <//>
      <div class="den-grid2">
        <${Panel} title="Signed-in collection" note="Off stops every collector at once" flush=${true}>
          <table class="den-table"><thead><tr><th>Platform</th><th>State</th><th></th></tr></thead><tbody>${['x', 'facebook', 'instagram', 'ytsearch', 'reddit', 'gated'].map(src => { const off = (d.reach.off || []).indexOf(src) >= 0; const chal = (d.reach.challenges || {})[src]; return html`<tr key=${src}><td>${{ ytsearch: 'YouTube search', gated: 'Subscriber news' }[src] || CH[src]}</td><td>${off ? html`<span class="den-chip warn">off</span>` : html`<span class="den-chip pos">allowed</span>`}${chal ? html` <span class="den-chip neg">verification ${since(chal.at)}</span>` : null}</td>
            <td class="act">${canWrite ? html`<button class="den-mini" disabled=${busy === 'sw'} aria-pressed=${off ? 'true' : 'false'} onClick=${() => toggle(src)}>${off ? 'Switch on' : 'Switch off'}</button>` : null}</td></tr>`; })}</tbody></table>
          <div class="den-state">A platform collects only after a person has signed in to it on the Mac. Instagram hashtags: ${d.hashtags.used} of ${d.hashtags.limit} used in the last ${d.hashtags.windowDays} days.</div>
        <//>
        <${Panel} title="Subscriber outlets" note="Read through the agency's own subscription, once cleared" flush=${true}>
          ${d.gated.length ? html`<table class="den-table"><thead><tr><th>Outlet</th><th>Access</th><th>Cleared</th></tr></thead><tbody>${d.gated.slice(0, 30).map(g => html`<tr key=${g.id}><td>${g.name}</td><td>${g.access}</td><td>${g.cleared ? html`<span class="den-chip pos">by ${g.cleared_by}</span>` : html`<span class="den-chip">headlines only</span>`}</td></tr>`)}</tbody></table>` : html`<${Empty}>No paid outlet is in the Source Registry.<//>`}
          <div class="den-state">Clearance is recorded on the source: <button class="den-link" onClick=${() => window.AXUI.goto('sources', {})}>open Sources</button>.</div>
        <//>
      </div>
      <${PublicRecord} desk=${desk} tick=${tick} canWrite=${canWrite} />
      <${Panel} title="Recall against the reports" note="Of the links in filed reports, how many AXIOM held at the time">
        ${bt ? html`<div><p><b class="den-t">${bt.share}%</b> - ${fmtN(bt.held)} of ${fmtN(bt.links)} links in ${bt.reports} reports${bt.period ? ' (' + bt.period + ')' : ''}; measured ${since(bt.at)} by ${bt.by}.</p>
            <table class="den-table"><thead><tr><th>Channel</th><th class="num">Links</th><th class="num">Held</th><th class="num">Share</th></tr></thead><tbody>${Object.keys(bt.byChannel).map(k => html`<tr key=${k}><td>${CH[k] || k}</td><td class="num">${bt.byChannel[k].links}</td><td class="num">${bt.byChannel[k].held}</td><td class="num">${bt.byChannel[k].links ? Math.round(bt.byChannel[k].held / bt.byChannel[k].links * 100) + '%' : '-'}</td></tr>`)}</tbody></table>
            ${bt.misses.length ? html`<details><summary class="den-link">${bt.misses.length} of the links it did not hold</summary><ul class="den-ev">${bt.misses.map((m, i) => html`<li key=${i}>${CH[m.channel] || m.channel}: ${m.url}</li>`)}</ul></details>` : null}</div>`
          : html`<${Empty}><b>Not measured yet.</b> This is the number that says whether collection is good enough. It is measured on the Mac, against a folder of exported reports kept outside the repository: <code>python3 tools/den-backtest.py ~/Documents/briefs --desk ${desk.id} --key $AXIOM_KEY --save</code><//>`}
      <//>
      <p class="den-mono">${(d.notBuilt || []).join(' ')}</p>
    </div>`;
  }

  /* ---- public record: the parliament pages a desk watches and the campaign counters read for it (release 7) ---- */
  function PublicRecord({ desk, tick, canWrite }) {
    const P = useLoad(() => get('/den/process?' + q({ desk: desk.id }), 'process'), [desk.id, tick], desk.id);
    const K = useLoad(() => get('/social/petitions/counters', 'counters'), [desk.id, tick], desk.id);
    const [f, setF] = useState({ url: '', title: '', type: 'inquiry', house: '' }); const [c, setC] = useState({ url: '', name: '' }); const [busy, setBusy] = useState('');
    const run = async (key, path, body, after) => { setBusy(key); try { const r = await call(path, body); if (after) after(r); P.reload(); K.reload(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const addPage = () => run('page', '/den/process/add', { url: f.url.trim(), title: f.title.trim(), type: f.type, house: f.house, juris: desk.region && desk.region !== 'au' ? desk.region : 'au', issues: desk.issues.map(i => i.id).slice(0, 1) }, () => { setF({ url: '', title: '', type: f.type, house: f.house }); toastMsg('Watched. It is read at the next sweep, under robots.txt.'); });
    const addCounter = () => run('counter', '/social/petitions/counters', { add: { url: c.url.trim(), name: c.name.trim(), ns: desk.ns } }, () => { setC({ url: '', name: '' }); toastMsg('Added. Its count is read once a day.'); });
    const pages = (P.data && P.data.pages) || []; const recs = (P.data && P.data.process) || []; const byPage = id => recs.filter(r => r.source === id);
    const counters = ((K.data && K.data.counters) || []).filter(x => !x.ns || x.ns === desk.ns);
    return html`<div class="den-grid2">
      <${Panel} title="Watched parliament pages" note="Stage and dates read from the parliament's own page" flush=${true}>
        ${P.err && !P.data ? html`<${Failed} what="The process calendar" err=${P.err} onRetry=${P.reload} />` : P.loading && !P.data ? html`<${Loading} what="the process calendar" />`
          : pages.length ? html`<table class="den-table"><thead><tr><th>Bill, inquiry or notice page</th><th>Stage</th><th>Next date</th><th>Read</th><th></th></tr></thead><tbody>
            ${pages.map(p => { const r = byPage(p.id); const first = r[0]; return html`<tr key=${p.id} class="den-row"><td><span class="den-t">${p.name}</span><span class="den-sub">${p.type}${p.juris && p.juris !== 'au' ? ', ' + String(p.juris).toUpperCase() : ''}${r.length > 1 ? ', ' + r.length + ' notices kept' : ''}${first && first.submissions ? ', ' + fmtN(first.submissions) + ' submissions' : ''}</span></td>
              <td>${!p.enabled ? html`<span class="den-chip warn">switched off</span>` : first ? first.stage : html`<span class="den-chip" title="Nothing has been recorded from this page yet">not read yet</span>`}</td>
              <td class="den-mono">${first && first.next_date ? first.next_date + ' ' + first.next_what : '-'}</td>
              <td>${p.error ? html`<span class="den-chip neg" title=${p.error}>failed</span><span class="den-sub">${p.error.slice(0, 110)}</span>` : p.last_ok ? since(p.last_ok) : 'not yet'}</td>
              <td class="act">${web(p.url) ? html`<a class="den-link" href=${web(p.url)} target="_blank" rel="noopener" aria-label=${'Open ' + p.name}>Open</a>` : null}${canWrite && p.enabled ? html` <button class="den-mini" disabled=${!!busy} title="Its source is switched off and its records leave the calendar" onClick=${() => run('rm' + p.id, '/den/process/remove', { source: p.id })}>Stop</button>` : null}</td></tr>`; })}</tbody></table>`
          : html`<${Empty}><b>No parliament page is watched for this desk.</b> ${canWrite ? 'Add a bill or an inquiry below by its address on the parliament\'s own site.' : 'A full-access user can add one.'}<//>`}
        ${canWrite ? html`<div class="den-form" style=${{ padding: '10px 12px' }}>
          <label class="den-lab" style=${{ flex: '2 1 240px' }}>Address of the page<input class="den-in" value=${f.url} maxlength="400" placeholder="https://www.aph.gov.au/..." onInput=${e => setF(Object.assign({}, f, { url: e.target.value }))} /></label>
          <label class="den-lab" style=${{ flex: '2 1 200px' }}>Its name, as the parliament writes it<input class="den-in" value=${f.title} maxlength="120" onInput=${e => setF(Object.assign({}, f, { title: e.target.value }))} /></label>
          <label class="den-lab">Kind<select class="den-in" value=${f.type} onChange=${e => setF(Object.assign({}, f, { type: e.target.value }))}>${[['inquiry', 'Inquiry'], ['bill', 'Bill'], ['motion', 'Notice paper'], ['disallowance', 'Disallowance list'], ['regulation', 'Regulation'], ['decision', 'Decision']].map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>
          <label class="den-lab">House<select class="den-in" value=${f.house} onChange=${e => setF(Object.assign({}, f, { house: e.target.value }))}>${[['', 'Not said'], ['senate', 'Senate'], ['reps', 'House of Representatives'], ['upper', 'Upper house'], ['lower', 'Lower house'], ['joint', 'Joint']].map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>
          <button class="den-mini primary" disabled=${!!busy || f.url.trim().length < 12 || f.title.trim().length < 4} title="No model call. The page is read at one request every ten seconds a host." onClick=${addPage}>${busy === 'page' ? 'Adding...' : 'Watch this page'}</button></div>` : null}
        <div class="den-state">Submitters' names are never read. A page that refuses the reader is left alone for a day and says so here.</div>
      <//>
      <${Panel} title="Campaign petition counters" note="Self-reported by each campaign, read once a day" flush=${true}>
        ${K.err && !K.data ? html`<${Failed} what="The petition counters" err=${K.err} onRetry=${K.reload} />` : K.loading && !K.data ? html`<${Loading} what="the petition counters" />`
          : counters.length ? html`<table class="den-table"><thead><tr><th>Petition</th><th>Page</th><th></th></tr></thead><tbody>${counters.map(x => html`<tr key=${x.url} class="den-row"><td><span class="den-t">${x.name}</span>${x.seed ? html`<span class="den-sub">seeded; its address is unproven until it is read</span>` : x.by ? html`<span class="den-sub">added by ${x.by}</span>` : null}</td>
              <td>${web(x.url) ? html`<a class="den-link" href=${web(x.url)} target="_blank" rel="noopener">${String(x.url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}</a>` : x.url}</td>
              <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} onClick=${() => run('rc' + x.url, '/social/petitions/counters', { remove: x.url })}>Remove</button>` : null}</td></tr>`)}</tbody></table>`
          : html`<${Empty}><b>No campaign counter is read for this desk.</b> ${canWrite ? 'Add the campaign page that prints its signature count.' : ''}<//>`}
        ${canWrite ? html`<div class="den-form" style=${{ padding: '10px 12px' }}>
          <label class="den-lab" style=${{ flex: '2 1 220px' }}>Address of the campaign page<input class="den-in" value=${c.url} maxlength="400" placeholder="https://..." onInput=${e => setC(Object.assign({}, c, { url: e.target.value }))} /></label>
          <label class="den-lab" style=${{ flex: '2 1 180px' }}>The petition's name<input class="den-in" value=${c.name} maxlength="120" onInput=${e => setC(Object.assign({}, c, { name: e.target.value }))} /></label>
          <button class="den-mini primary" disabled=${!!busy || c.url.trim().length < 12 || c.name.trim().length < 3} onClick=${addCounter}>${busy === 'counter' ? 'Adding...' : 'Add counter'}</button>
          <button class="den-mini" disabled=${!!busy} title="Proposes the campaign names found in paid advertising as terms. Nothing searches one until it is approved in Watch." onClick=${() => run('seed', '/den/watch/seed', {}, r => toastMsg(r.proposed ? r.proposed + ' campaign name' + (r.proposed === 1 ? '' : 's') + ' proposed. Approve them in Watch.' : 'Already proposed. See Watch.'))}>${busy === 'seed' ? 'Proposing...' : 'Propose campaign names'}</button></div>` : null}
        <div class="den-state">The count is the campaign's own claim and nobody has audited it. The numbers and their daily growth are in Signals, Petitions. change.org is not read: it refuses automated readers.</div>
      <//>
    </div>`;
  }

  /* ---- Options ---- */
  function OptionsPanel({ desk, canWrite, onSaved, onCreated }) {
    const init = () => ({ name: desk.name, region: desk.region, cadence: desk.cadence, window_h: desk.window_h, auto_draft: desk.auto_draft, sections: desk.sections.map(s => Object.assign({}, s)), hidden: desk.options.hidden.slice(), levels: desk.ratings.levels.join(', '), trends: desk.ratings.trends.join(', '),
      minEng: Object.assign({}, desk.options.minEng), fold: desk.options.fold !== false, density: desk.options.density || 'regular' });
    const [f, setF] = useState(init); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [nd, setNd] = useState({ name: '', region: 'au' });
    const create = async () => { setBusy(true); setMsg(null); try { const d = await call('/den/desk/update', { ns: desk.ns, name: nd.name, region: nd.region, like: desk.id }); setNd({ name: '', region: 'au' }); onCreated(d.desk); } catch (e) { setMsg({ ok: false, text: say(e) }); } setBusy(false); };
    useEffect(() => { setF(init()); setMsg(null); }, [desk.id, desk.revision]);   // eslint-disable-line
    const set = (k, v) => setF(o => Object.assign({}, o, { [k]: v })); const dirty = JSON.stringify(f) !== JSON.stringify(init());
    const move = (i, d) => { const s = f.sections.slice(); const j = i + d; if (j < 0 || j >= s.length) return; const t = s[i]; s[i] = s[j]; s[j] = t; set('sections', s); };
    const save = async () => { setBusy(true); setMsg(null); try { const list = v => v.split(',').map(x => x.trim()).filter(Boolean);
        const d = await call('/den/desk/update', { id: desk.id, revision: desk.revision, patch: { name: f.name, region: f.region, cadence: f.cadence, window_h: f.window_h, auto_draft: f.auto_draft, sections: f.sections, ratings: { levels: list(f.levels), trends: list(f.trends), items: desk.ratings.items }, options: { hidden: f.hidden, minEng: f.minEng, fold: f.fold, density: f.density } } });
        setMsg({ ok: true, text: 'Saved.' }); onSaved(d.desk); } catch (e) { setMsg({ ok: false, text: say(e), theirs: e.code === 'conflict' && e.body ? e.body.desk : null }); } setBusy(false); };
    const unmute = async m => { try { const d = await call('/den/mute', { desk: desk.id, kind: m.kind, value: m.value, on: false }); onSaved(d.desk); } catch (e) { toastMsg(say(e), true); } };
    const ro = !canWrite;
    return html`<div>
      ${msg ? html`<div class=${'den-notice ' + (msg.ok ? 'good' : 'bad')} role=${msg.ok ? 'status' : 'alert'}>${msg.text}${msg.theirs ? html`<div><button class="den-mini" onClick=${() => onSaved(msg.theirs)}>Load theirs</button></div>` : null}</div>` : null}
      ${ro ? html`<div class="den-notice">Your key is read-only: these are the desk's options as they stand.</div>` : null}
      <nav class="den-optnav" aria-label="Sections of the options">${['The desk', 'Sections of the report', 'Ratings', 'Least interactions to show a post', 'Mutes'].concat(ro ? [] : ['Another desk for this client']).map(n => html`<button key=${n} type="button" class="den-link" onClick=${() => { const e = document.querySelector('#den-tabpanel section.den-panel[aria-label="' + n + '"]'); if (e) { e.scrollIntoView({ block: 'start' }); const f = e.querySelector('input, select, button'); if (f) f.focus({ preventScroll: true }); } }}>${n}</button>`)}</nav>
      <${Panel} title="The desk"><div class="den-form">
        <label class="den-lab">Name<input value=${f.name} maxlength="60" disabled=${ro} onInput=${e => set('name', e.target.value)} /></label>
        <label class="den-lab">Region<select value=${f.region} disabled=${ro} onChange=${e => set('region', e.target.value)}>${['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'].map(r => html`<option key=${r} value=${r}>${r === 'au' ? 'National' : r.toUpperCase()}</option>`)}</select></label>
        <label class="den-lab">Cadence<select value=${f.cadence} disabled=${ro} onChange=${e => set('cadence', e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
        <label class="den-lab">Reporting window (hours)<input type="number" min="1" max="336" value=${f.window_h} disabled=${ro} onInput=${e => set('window_h', Math.max(1, Math.min(336, parseInt(e.target.value, 10) || 24)))} /></label>
        <label class="den-lab">Table density<select value=${f.density} disabled=${ro} onChange=${e => set('density', e.target.value)}><option value="compact">Compact</option><option value="regular">Regular</option><option value="roomy">Roomy</option></select></label>
        <label class="den-lab">Syndicated copies<select value=${f.fold ? '1' : '0'} disabled=${ro} onChange=${e => set('fold', e.target.value === '1')}><option value="1">Fold into one row</option><option value="0">Show each copy</option></select></label>
        <label class="den-lab">Draft each morning<select value=${f.auto_draft ? '1' : '0'} disabled=${ro} onChange=${e => set('auto_draft', e.target.value === '1')}><option value="0">No: a person starts each draft</option><option value="1">Yes: one model call a morning</option></select></label></div>
        <p class="den-mono">Times are Australian Eastern. A morning draft is one model call a day for this desk, inside the day's one window for automated model work; it is a draft and files nothing.</p><//>
      <${Panel} title="Sections of the report" note="Their order, their titles and which show" flush=${true}>
        <table class="den-table"><thead><tr><th>Title</th><th>What it is</th><th>Shown</th><th></th></tr></thead><tbody>${f.sections.map((s, i) => html`<tr key=${s.id}><td><input class="den-in" value=${s.title} maxlength="80" disabled=${ro} aria-label=${'Title of section ' + (i + 1)} onInput=${e => set('sections', f.sections.map((x, j) => (j === i ? Object.assign({}, x, { title: e.target.value }) : x)))} /></td><td class="den-mono">${s.kind}${s.kind === 'sources' ? ' (built from the citations)' : ''}</td>
          <td><input type="checkbox" checked=${f.hidden.indexOf(s.id) < 0} disabled=${ro} aria-label=${'Show ' + s.title} onChange=${e => set('hidden', e.target.checked ? f.hidden.filter(h => h !== s.id) : f.hidden.concat([s.id]))} /></td>
          <td class="act">${ro ? null : html`<button class="den-mini" disabled=${i === 0} aria-label=${'Move ' + s.title + ' up'} onClick=${() => move(i, -1)}>Up</button> <button class="den-mini" disabled=${i === f.sections.length - 1} aria-label=${'Move ' + s.title + ' down'} onClick=${() => move(i, 1)}>Down</button>`}</td></tr>`)}</tbody></table><//>
      <div class="den-grid2">
        <${Panel} title="Ratings" note=${desk.ratings.items.map(i => i.label).join(', ')}><div class="den-form"><label class="den-lab" style=${{ flex: '1 1 100%' }}>Levels, lowest first<input value=${f.levels} disabled=${ro} onInput=${e => set('levels', e.target.value)} /></label><label class="den-lab" style=${{ flex: '1 1 100%' }}>Trends<input value=${f.trends} disabled=${ro} onInput=${e => set('trends', e.target.value)} /></label></div><p class="den-mono">A draft may only rate in these words; anything else is left blank for a person.</p><//>
        <${Panel} title="Least interactions to show a post" note="Registered accounts and MPs always show"><div class="den-form">${['x', 'facebook', 'instagram', 'youtube', 'reddit'].map(p => html`<label key=${p} class="den-lab">${CH[p]}<input type="number" min="0" max="100000" value=${f.minEng[p] || 0} disabled=${ro} onInput=${e => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const m = Object.assign({}, f.minEng); if (v) m[p] = v; else delete m[p]; set('minEng', m); }} /></label>`)}</div><//>
      </div>
      <${Panel} title="Mutes" note="Hidden on this desk only" flush=${true}>${desk.options.mutes.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>What</th><th>By</th><th></th></tr></thead><tbody>${desk.options.mutes.map((m, i) => html`<tr key=${i}><td>${m.kind}</td><td>${m.value}</td><td class="den-mono">${m.by} ${since(m.at)}</td><td class="act">${ro ? null : html`<button class="den-mini" aria-label=${'Remove the mute on ' + m.value} onClick=${() => unmute(m)}>Remove</button>`}</td></tr>`)}</tbody></table>` : html`<${Empty}>Nothing is muted. After three set-asides of the same account, site or term, the board offers a mute.<//>`}<//>
      ${ro ? null : html`<${Panel} title="Another desk for this client" note="A second region, or a second analyst's own desk, with this desk's sections and rating words"><div class="den-form">
        <label class="den-lab" style=${{ flex: '1 1 220px' }}>Its name<input value=${nd.name} maxlength="60" placeholder=${desk.client + ' Queensland'} aria-label="The new desk's name" onInput=${e => setNd(Object.assign({}, nd, { name: e.target.value }))} /></label>
        <label class="den-lab">Region<select value=${nd.region} aria-label="The new desk's region" onChange=${e => setNd(Object.assign({}, nd, { region: e.target.value }))}>${['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'].map(r => html`<option key=${r} value=${r}>${r === 'au' ? 'National' : r.toUpperCase()}</option>`)}</select></label>
        <button class="den-mini" disabled=${busy || nd.name.trim().length < 3} onClick=${create}>Add the desk</button></div><//>`}
      ${ro ? null : html`<div class="den-bar den-optbar" style=${{ borderTop: 0, paddingLeft: 0 }}><button class="den-mini primary" disabled=${busy || !dirty} onClick=${save}>${busy ? 'Saving...' : 'Save options'}</button><button class="den-mini" disabled=${busy || !dirty} onClick=${() => setF(init())}>Undo changes</button><span class=${'den-save' + (dirty ? ' dirty' : '')}>${dirty ? 'Not saved' : 'Saved, revision ' + desk.revision}</span></div>`}
    </div>`;
  }

  function Shortcuts({ onClose }) {
    const K = [['j / k', 'Next and previous row on Today'], ['p', 'Pin the row to the report'], ['x', 'Set the row aside'], ['o or Enter', 'Open the row\'s source'], ['1 to 5', 'Jump to a section of Today'], ['Alt + 1 to 5', 'Today, Brief, Watch, Collection, Options'], ['Ctrl or Cmd + S', 'Save the brief'], ['?', 'This sheet'], ['Esc', 'Close a dialog']];
    return html`<${Dialog} title="Keyboard" onClose=${onClose}><table class="den-table"><tbody>${K.map(k => html`<tr key=${k[0]}><td><span class="den-kbd">${k[0]}</span></td><td>${k[1]}</td></tr>`)}</tbody></table><div class="den-form" style=${{ marginTop: '12px' }}><button class="den-mini" onClick=${onClose}>Close</button></div><//>`;
  }

  function DenApp() {
    const D = useLoad(() => get('/den/desks', 'desks'), [], 'desks'); const [deskId, setDeskId] = useState(() => ls.get('ax_den_desk', '')); const [tab, setTabRaw] = useState(() => ls.get('ax_den_tab', 'today')); const [tick, setTick] = useState(0); const [keys, setKeys] = useState(false); const [job, setJob] = useState(null); const [dm, setDm] = useState(false);
    const [budget, setBudget] = useState(null); const [, setRole] = useState(window.AX_ROLE); const [theme, setThemeRaw] = useState(() => (ls.get('ax_den_theme', 'light') === 'dark' ? 'dark' : 'light')); const setTheme = v => { setThemeRaw(v); ls.set('ax_den_theme', v); const r = document.getElementById('den-root'); if (r) r.dataset.theme = v; }; const [briefSeen, setBriefSeen] = useState(false); const [boardStrip, setBoardStrip] = useState(null);
    // the worker says what this key may do a moment after the page opens: the controls follow it
    useEffect(() => { const f = () => setRole(window.AX_ROLE); window.addEventListener('ax:role', f); return () => window.removeEventListener('ax:role', f); }, []);
    const canWrite = canWriteNow();
    const setTab = t => { if (TABS.some(x => x[0] === t)) { setTabRaw(t); ls.set('ax_den_tab', t); } };
    const desks = (D.data && D.data.desks) || []; const desk = desks.find(d => d.id === deskId) || desks[0] || null;
    useEffect(() => { if (D.data) setBudget(D.data.budget); }, [D.data]);
    useEffect(() => { if (tab === 'brief') setBriefSeen(true); }, [tab]);
    useEffect(() => { if (desk && desk.id !== deskId) setDeskId(desk.id); }, [desk && desk.id]);   // eslint-disable-line
    useGoto('den', p => { if (p && p.desk) { setDeskId(String(p.desk)); ls.set('ax_den_desk', String(p.desk)); } if (p && p.tab) setTab(String(p.tab)); });
    const bump = what => { if (what === 'budget' || what === 'desk') call('/den/desks').then(d => { setBudget(d.budget); if (what === 'desk') D.set(d); }, () => {}); if (what === 'collected' || what === 'marks' || what === 'filed') setTick(t => t + 1); };
    useEffect(() => { const key = e => { const root = document.getElementById('v-den'); if (!root || !root.classList.contains('on') && getComputedStyle(root).display === 'none') return; if (e.altKey && /^Digit[1-5]$/.test(e.code)) { e.preventDefault(); setTab(TABS[+e.code.slice(5) - 1][0]); } if (e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) setKeys(true); };
      window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);   // eslint-disable-line
    useEffect(() => { if (!dm) return undefined; const out = e => { if (!(e.target.closest && e.target.closest('.den-deskwrap'))) setDm(false); }; document.addEventListener('mousedown', out); return () => document.removeEventListener('mousedown', out); }, [dm]);
    if (D.loading && !D.data) return html`<${Loading} what="the desks" />`;
    if (D.err && !D.data) return html`<${Failed} what="The desks" err=${D.err} onRetry=${D.reload} />`;
    if (!desk) return html`<${Empty}><b>No desk is set up.</b> A desk is a client, a region and a report format. Ask an admin to add one.<//>`;
    const pickDesk = id => { setDeskId(id); ls.set('ax_den_desk', id); setTick(t => t + 1); };
    return html`<div data-density=${desk.options.density || 'regular'} id="den-app">
      <aside class="den-side" aria-label="Desk and sections">
        <div class="den-deskwrap" onKeyDown=${e => { if (e.key === 'Escape' && dm) { e.stopPropagation(); setDm(false); } }}>
          <button type="button" class="den-deskcard" aria-haspopup="menu" aria-expanded=${dm ? 'true' : 'false'} aria-label=${'Desk: ' + desk.name + '. Change the desk'} onClick=${() => setDm(!dm)}><span class="den-av" aria-hidden="true">${String(desk.client || desk.name || 'A').charAt(0).toUpperCase()}</span><span><b>${desk.client}</b><span>${desk.name}</span></span><svg class="den-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 10l4-4 4 4M8 14l4 4 4-4" /></svg></button>
          <div class="den-deskmenu" role="menu" aria-label="Desks" hidden=${!dm}>${desks.map(d => html`<button key=${d.id} type="button" role="menuitemradio" class="den-deskitem" data-desk=${d.id} aria-checked=${d.id === desk.id ? 'true' : 'false'} onClick=${() => { pickDesk(d.id); setDm(false); }}><b>${d.name}</b><span>${d.client}${d.region !== 'au' ? ' - ' + d.region.toUpperCase() : ''}, ${d.cadence}</span></button>`)}</div>
        </div>
        <div class="den-tabs den-menu" role="tablist" aria-orientation="vertical" aria-label="Anne's Den">${MENU.map(g => [html`<span key=${g[0]} class="den-menu-h" aria-hidden="true">${g[0]}</span>`].concat(g[1].map(id => html`<button key=${id} role="tab" id=${'den-tab-' + id} class="den-tab" aria-selected=${tab === id ? 'true' : 'false'} aria-controls="den-tabpanel" onClick=${() => setTab(id)}><${Ico} n=${id} />${TABS.find(t => t[0] === id)[1]}</button>`)))}</div>
        ${budget ? html`<div class="den-sidefoot"><b>Model calls today</b><div class="den-meter" aria-hidden="true"><i style=${{ width: Math.min(100, (budget.used / Math.max(1, budget.cap)) * 100) + '%' }}></i></div>${budget.used} of ${budget.cap} used. Only a draft spends one.</div>` : null}
        <div class="den-seg den-theme" role="group" aria-label="Theme">${[['light', 'Light'], ['dark', 'Dark']].map(v => html`<button key=${v[0]} type="button" class="den-tab" aria-pressed=${theme === v[0] ? 'true' : 'false'} onClick=${() => setTheme(v[0])}>${v[1]}</button>`)}</div>
      </aside>
      <div class="den-main">
      <div class="den-head">
        <div><h2>${desk.client}</h2><span class="den-win">${desk.name} - ${desk.cadence}, the last ${desk.window_h} hours${desk.region !== 'au' ? ', ' + desk.region.toUpperCase() + ' only' : ''} - Australian Eastern time</span></div>
        <span class="den-spacer"></span>
        ${budget ? html`<span class="den-chip" title="A brief draft or one section written again is one model call, started by a person. Nothing else on this page spends.">model calls today: ${budget.used} of ${budget.cap}</span>` : null}
        ${canWrite ? null : html`<span class="den-chip warn">read-only key</span>`}
        <button class="den-mini" onClick=${() => setTick(t => t + 1)} title="Read the archive again">Refresh</button><button class="den-mini" aria-label="Keyboard shortcuts" onClick=${() => setKeys(true)}>?</button>
      </div>
      <${Boundary} name="The strip" resetKey=${desk.id + tick}><${Strip} deskId=${desk.id} setTab=${setTab} tick=${tick} handed=${tab === 'today' ? (boardStrip || STRIP_PENDING) : undefined} /><//>
      <div role="tabpanel" id="den-tabpanel" aria-labelledby=${'den-tab-' + tab}>
        <${Boundary} name=${TABS.find(t => t[0] === tab)[1]} resetKey=${desk.id + tab}>
          ${tab === 'today' ? html`<${Board} desk=${desk} tick=${tick} bump=${bump} setTab=${setTab} canWrite=${canWrite} onStrip=${setBoardStrip} />` : null}
          ${briefSeen || tab === 'brief' ? html`<div hidden=${tab !== 'brief'}><${BriefPanel} key=${desk.id} desk=${desk} tick=${tick} bump=${bump} budget=${budget} canWrite=${canWrite} setTab=${setTab} /></div>` : null}
          ${tab === 'watch' ? html`<${WatchPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} />` : null}
          ${tab === 'collection' ? html`<${CollectionPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} setJob=${setJob} />` : null}
          ${tab === 'options' ? html`<${OptionsPanel} desk=${desk} canWrite=${canWrite} onSaved=${d => D.set(Object.assign({}, D.data, { desks: desks.map(x => (x.id === d.id ? d : x)) }))} onCreated=${d => { D.set(Object.assign({}, D.data, { desks: desks.concat([d]) })); pickDesk(d.id); toastMsg(d.name + ' is ready') ; }} />` : null}
        <//>
      </div>
      ${job ? html`<div class="den-dock" role="region" aria-label="Collection job"><${Console} job=${job} title=${job.title} canWrite=${canWrite} /><button class="den-mini" onClick=${() => setJob(null)}>Hide the console</button></div>` : null}
      </div>
      ${keys ? html`<${Shortcuts} onClose=${() => setKeys(false)} />` : null}
    </div>`;
  }

  let mounted = false;
  window.denInit = function () {
    const root = document.getElementById('den-root');
    if (!root) return;
    if (!mounted) { mounted = true; root.dataset.theme = ls.get('ax_den_theme', 'light') === 'dark' ? 'dark' : 'light'; ReactDOM.createRoot(root).render(html`<${DenApp} />`); }
  };
})();
