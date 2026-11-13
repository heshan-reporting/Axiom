/* AXIOM - Anne's Den. The monitoring analyst's workspace: one desk at a time (a client, a region, a report format).
 * The Storyboard (13 November 2026): opening the Den sets body.in-den and it takes the whole window, with its own top bar
 * and a rail of tabs and the six checks. The Board is the window's evidence as cards, Unsorted and one column for each
 * section of the report; Brief is the report, drafted from that evidence by one stated model call or written by hand,
 * one section open at a time between its outline and the evidence filed under it, checked against the rows it cites;
 * Watch is the register and the proposals that wait for a person; Collection says which channels read and why not;
 * Options are the desk's own. Which section a card is filed under is this browser's own note (localStorage); the pin
 * behind it is the worker's. A React island (React, ReactDOM and htm vendored under docs/vendor; shared pieces from
 * docs/ax-ui.js) mounted into #den-root on first open. Nothing here spends without a button that states the cost. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.denInit = function () {
      const root = document.getElementById('den-root');
      if (root) root.innerHTML = '<div class="aud-notice"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the docs folder.</div>';
    };
    return;
  }
  const { html, call, own, hdrs, toastMsg, fmtN, Console, tailJob, useGoto } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;
  const canWriteNow = () => window.AX_ROLE !== 'read';

  const TABS = [['today', 'Board'], ['brief', 'Brief'], ['watch', 'Watch'], ['collection', 'Collection'], ['options', 'Options']];
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
  /* Loading is a skeleton with its words, so a slow read looks like the thing it will become, not like nothing. */
  const Loading = ({ what, board }) => html`<div class=${'den-state den-loading' + (board ? ' board' : '')} role="status"><span class="den-loadtxt">Loading ${what || ''}...</span><span class="den-skel" aria-hidden="true"></span><span class="den-skel s2" aria-hidden="true"></span><span class="den-skel s3" aria-hidden="true"></span></div>`;
  const Failed = ({ what, err, onRetry }) => html`<div class="den-state err" role="alert"><span class="den-errtext"><b>${what} could not be loaded.</b> ${err}</span> ${onRetry ? html`<button class="den-mini" onClick=${onRetry}>Try again</button>` : null}</div>`;
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
  const engText = e => (e ? [['likes', 'likes'], ['comments', 'comments'], ['replies', 'replies'], ['shares', 'shares'], ['reposts', 'reposts'], ['views', 'views']].filter(k => +e[k[0]] > 0).map(k => fmtN(e[k[0]]) + ' ' + k[1]).join(', ') : '');
  /* Where a signal's or a row's evidence opens: a view of AXIOM, a tab of the Den, or the post itself. */
  function openEvidence(o, setTab) { if (!o) return; if (o.tab) return setTab(o.tab); if (o.view && window.AXUI.goto) return window.AXUI.goto(o.view, o.params || {}); if (o.url && /^https?:/.test(o.url)) window.open(o.url, '_blank', 'noopener'); }


  /* ---- The window's rows as cards (the Storyboard) ----
     Everything here is worked out in the page from what GET /den/board already answers: no route was added. */
  const KINDS_ROW = [['media', 'News'], ['social', 'Posts'], ['actors', 'Actors'], ['narratives', 'Narratives'], ['upcoming', 'Upcoming']];
  const fbTotal = fb => (fb ? (+fb.reactions || 0) + (+fb.comments || 0) + (+fb.shares || 0) : 0);
  const sydDay = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  const wc = t => (String(t || '').replace(/\[[A-Z]:[^\]]+\]/g, ' ').match(/\S+/g) || []).length;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  /* One card for each row of the board's five lists. `key` is how the page knows the card (and what a filing is kept
     under); `cite` is the id a brief cites it by; `pin` says whether the worker can pin it (an archive row can, a
     narrative or a date cannot). */
  function toCards(d) {
    const out = []; if (!d) return out;
    (d.media || []).forEach(m => out.push({ key: 'M:' + m.id, cite: 'M:' + m.id, id: m.id, kind: 'media', pin: true, title: m.title, url: m.url, ts: m.ts, pinned: !!m.pinned, reach: fbTotal(m.fb), outlets: m.n || 1, growth: 0, r: m }));
    (d.social || []).forEach(s => out.push({ key: 'S:' + s.id, cite: 'S:' + s.id, id: s.id, kind: 'social', pin: true, title: s.text, url: s.url, ts: s.ts, pinned: !!s.pinned, reach: +s.total || 0, outlets: 1, growth: +s.growth || 0, r: s }));
    (d.actors || []).forEach(a => out.push({ key: 'P:' + a.id, cite: 'P:' + a.id, id: a.id, kind: 'actors', pin: true, title: a.text, url: a.url, ts: a.ts, pinned: !!a.pinned, reach: +a.total || 0, outlets: 1, growth: +a.growth || 0, r: a }));
    (d.narratives || []).forEach(n => out.push({ key: 'N:' + n.id, cite: 'N:' + n.id, id: n.id, kind: 'narratives', pin: false, title: n.label, url: '', ts: n.last, pinned: false, reach: 0, outlets: 1, growth: 0, r: n }));
    (d.upcoming || []).forEach((u, i) => out.push({ key: 'U:' + u.date + '|' + String(u.event || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), cite: 'U:' + (i + 1), label: u.date + ' ' + u.event, id: 0, kind: 'upcoming', pin: false, title: u.event, url: u.url, ts: 0, pinned: false, reach: 0, outlets: 1, growth: 0, r: u }));
    return out;
  }
  /* The strip signals that name a card: by the ids a signal says cover it, or by the row it opens. */
  const sigsFor = (c, signals) => (signals || []).filter(s => s.key === c.key || (s.cover || []).indexOf(c.cite) >= 0 || (c.pin && s.open && +s.open.item === +c.id));
  /* How much a card should weigh on the board, 1 to 99, with the reasons. Pure: the board's own figures in, a number out.
     A base for the kind (a story, a registered actor's post and a moving narrative start above a found post), then
     reach on a log scale, the outlets that carried it, growth since yesterday, a check that names it, and how recent. */
  function weigh(c, signals, now) {
    const why = []; let w = { media: 12, actors: 14, narratives: 12, upcoming: 10, social: 4 }[c.kind] || 0;
    if (c.reach > 0) { w += Math.min(40, Math.log10(1 + c.reach) * 11); why.push(fmtN(c.reach) + (c.kind === 'media' ? ' on Facebook' : ' interactions')); }
    if (c.outlets > 1) { w += Math.min(18, c.outlets * 3); why.push(c.outlets + ' outlets'); }
    if (c.growth > 0) { w += Math.min(14, Math.log10(1 + c.growth) * 4.5); why.push('+' + fmtN(c.growth) + ' since yesterday'); }
    if (c.kind === 'narratives' && c.r.n24 > 0) { w += Math.min(20, Math.log10(1 + c.r.n24) * 10); why.push(c.r.n24 + ' rows in the last day'); }
    const named = sigsFor(c, signals); if (named.length) { w += 16; why.push(((SIG[named[0].sig] || [named[0].sig])[0] + '').toLowerCase()); }
    if (c.ts) { const fresh = Math.max(0, 8 - (now - c.ts) / 3600000 / 3); w += fresh; if (fresh >= 6) why.push('in the last six hours'); }
    return { score: Math.max(1, Math.min(99, Math.round(w))), why };
  }
  const LOW = 10;   // under this a card folds into Low weight
  const deck = (d, signals) => { const now = Date.now(); return toCards(d).map(c => Object.assign(c, { w: weigh(c, signals, now), sigs: sigsFor(c, signals) })); };
  const byWeight = (a, b) => (b.pinned - a.pinned) || (b.w.score - a.w.score) || ((b.ts || 0) - (a.ts || 0));
  /* Is a check in the brief? The rule the worker applies when a brief is filed, on the words now in the editor: the brief
     cites a row the check names, or names it in words, or says plainly that a channel was not read. */
  function covered(s, brief, texts) {
    if (!brief) return false; const cites = new Set(); const T = texts || {};
    const body = Object.keys(brief.sections || {}).map(k => (T[k] != null ? T[k] : (brief.sections[k] || {}).text) || '').join('\n'); (body.match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).forEach(x => cites.add(x.slice(1, -1)));
    const low = body.toLowerCase(); const first = String(s.title || '').split(' ')[0].replace(/[^A-Za-z0-9]/g, '');
    return (s.cover || []).some(c => cites.has(c)) || (s.words || []).some(w => w && low.indexOf(String(w).toLowerCase()) >= 0) || (s.sig === 'gap' && !!first && new RegExp('\\b' + first + '\\b[^.]{0,80}\\b(not (read|collected|available)|delivered nothing|no collector|was not)', 'i').test(body));
  }
  const secOfKind = (secs, kinds) => { for (const k of kinds) { const s = secs.find(x => x.kind === k || x.id === k); if (s) return s.id; } return (secs[0] || {}).id || ''; };
  const KIND_SEC = { media: ['media'], social: ['social', 'developments'], actors: ['actors'], narratives: ['narratives', 'developments'], upcoming: ['developments', 'summary'] };
  /* The section a check belongs under: where the row it names is filed, else the section of that kind of row. */
  function sigSec(s, cards, filing, secs) {
    if (s.sig === 'gap') return secOfKind(secs, ['risks', 'implications', 'momentum', 'summary']);
    const c = (cards || []).find(x => x.sigs && x.sigs.indexOf(s) >= 0); if (c) return (filing[c.key] && secs.some(x => x.id === filing[c.key]) ? filing[c.key] : secOfKind(secs, KIND_SEC[c.kind] || []));
    return secOfKind(secs, s.sig === 'emerging' ? ['narratives', 'developments'] : s.sig === 'first_seen' || s.sig === 'outlier' ? ['actors', 'social'] : ['momentum', 'summary']);
  }
  function secState(sec, text, n) {
    const f = sec ? (sec.uncited || []).length + (sec.unverified || []).length + (sec.trimmed || []).length : 0;
    if (f && sec.text === text) return ['Flagged ' + f, 'warn']; if (String(text || '').trim()) return sec && sec.edited ? ['Edited', 'pos'] : ['Drafted', 'acc']; if (n) return ['Has evidence', 'info']; return ['Empty', ''];
  }
  const secKey = i => (i < 9 ? String(i + 1) : i === 9 ? '0' : '');
  /* The id a brief cites a card by, when that brief's evidence holds it. A date's id is its place in the list the draft
     was written from, so it is matched by what it says. */
  function citeOf(c, ev) { if (!ev) return ''; if (c.kind !== 'upcoming') return ev[c.cite] ? c.cite : ''; return Object.keys(ev).find(k => /^U:/.test(k) && ev[k].label === c.label) || ''; }

  /* ---- Nothing critical missed: the six checks, as a rail of pills ---- */
  const STRIP_PENDING = { data: null, loading: true, err: '', reload() {} };
  const CHECKS = [['gap', 'Not collected', 'Every channel this desk relies on delivered something in this window.'], ['spike', 'Spike', 'No Sentinel spike on this desk\'s issues in this window.'], ['emerging', 'Emerging', 'No narrative on this desk\'s issues became emerging in this window.'],
    ['outlier', 'Unusual reach', 'No registered account\'s post drew far more than its posts usually do.'], ['first_seen', 'First seen', 'No actor appeared on this desk for the first time in fourteen days.'], ['burst', 'Above baseline', 'No issue is running above its own fourteen-day baseline.']];
  /* On the Board the board's own answer carries the checks (one read of the window, not two). The rail asks for itself on
     the other tabs, and on the Board only when the board came back without them: the board failed, or took too long to say. */
  function Strip({ deskId, setTab, tick, handed, onSignals, cov }) {
    const [late, setLate] = useState(false); const waiting = !!(handed && handed.loading && !handed.data);
    useEffect(() => { setLate(false); if (!waiting) return; const t = setTimeout(() => setLate(true), 20000); return () => clearTimeout(t); }, [waiting, deskId, tick]);
    const need = !handed || late || (!handed.loading && !handed.data);
    const self = useLoad(() => (need ? get('/den/missed?' + q({ desk: deskId }), 'signals') : Promise.resolve(null)), [deskId, tick, need], deskId);
    const m = need ? self : handed; const [open, setOpen] = useState(''); const box = useRef(null);
    useEffect(() => { if (onSignals) onSignals(m.data ? (m.data.signals || []) : null); }, [m.data]);   // eslint-disable-line
    useEffect(() => { if (!open) return; const out = e => { if (box.current && !box.current.contains(e.target)) setOpen(''); };
      const key = e => { if (e.key === 'Escape') { const b = box.current && box.current.querySelector('.den-check.open'); setOpen(''); if (b) b.focus(); } };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [open]);
    useEffect(() => { setOpen(''); }, [deskId]);
    const head = html`<h3 class="den-sr">Nothing critical missed</h3>`;
    if (!m.data && !m.err) return html`<section class="den-strip" aria-label="Nothing critical missed">${head}<${Loading} what="the checks" /></section>`;
    if (m.err && !m.data) return html`<section class="den-strip" aria-label="Nothing critical missed">${head}<${Failed} what="The checks" err=${m.err} onRetry=${m.reload} /></section>`;
    const s = m.data.signals || []; const hasBrief = !!(cov && cov.brief); const isCov = x => hasBrief && covered(x, cov.brief, cov.texts);
    const kinds = CHECKS.concat(Array.from(new Set(s.map(x => x.sig))).filter(k => !CHECKS.some(c => c[0] === k)).map(k => [k, (SIG[k] || [k])[0], '']));
    const cur = kinds.find(k => k[0] === open); const list = cur ? s.filter(x => x.sig === cur[0]) : []; const un = s.filter(x => !isCov(x)).length;
    return html`<section class="den-strip" aria-label="Nothing critical missed" ref=${box}>${head}
      <span class="den-strip-h" title="Six checks computed from the archive. No model is asked.">${s.length ? s.length + ' to read' : 'six checks, nothing found'}${hasBrief && s.length ? html`<span class=${un ? 'un' : 'ok'}>${un ? un + ' not in the brief' : 'all in the brief'}</span>` : null}</span>
      <ul id="den-strip-list">${kinds.map(k => { const l = s.filter(x => x.sig === k[0]); const u = l.filter(x => !isCov(x)).length; const on = open === k[0];
        const words = l.length ? plural(l.length, 'finding') + (hasBrief ? (u ? ', ' + u + ' not yet in the brief' : ', covered in the brief') : '') : 'nothing found';
        return html`<li key=${k[0]} data-sig=${k[0]}><button class=${'den-check ' + (l.length ? 'has ' + k[0] : 'clear') + (on ? ' open' : '')} data-n=${l.length} aria-expanded=${on ? 'true' : 'false'} title=${k[1] + ': ' + words} onClick=${() => setOpen(on ? '' : k[0])}>
          <span class="den-check-l">${k[1]}</span>${l.length ? html`<b>${l.length}</b>` : null}<i class=${!l.length ? 'ok' : hasBrief && !u ? 'cov' : 'un'} aria-hidden="true"></i><span class="den-sr">${words}</span></button></li>`; })}</ul>
      ${cur ? html`<div class="den-pop" role="region" aria-label=${cur[1]}>
        <header><span class=${'den-chip ' + (list.length ? (SIG[cur[0]] || ['', ''])[1] : 'pos')}>${cur[1]}</span><span class="den-mono" title="Computed from the archive. No model is asked.">computed, no model</span><span class="den-spacer"></span><button class="den-mini quiet" onClick=${() => setOpen('')}>Close</button></header>
        ${list.length ? html`<ul>${list.map(x => html`<li key=${x.key}><span class="den-t">${x.title}</span><span class="d">${x.detail}</span>
            <span class="den-pop-act">${hasBrief ? html`<span class=${'den-chip ' + (isCov(x) ? 'pos' : 'warn')}>${isCov(x) ? 'in the brief' : 'not yet in the brief'}</span>` : html`<span class="den-chip">no brief yet</span>`}
              ${x.open && (x.open.tab || x.open.view || x.open.url) ? html`<button class="den-link" onClick=${() => { setOpen(''); openEvidence(x.open, setTab); }} aria-label=${'Open the evidence for: ' + x.title}>${x.open.tab ? 'Open Collection' : x.open.view ? 'Open in ' + x.open.view.charAt(0).toUpperCase() + x.open.view.slice(1) : 'Open the post'}</button>` : null}</span></li>`)}</ul>`
          : html`<p class="den-pop-none">${cur[2] || 'Nothing found in this window.'}</p>`}
      </div>` : null}
    </section>`;
  }

  /* ---- The Board: the window's evidence as cards, Unsorted and one column for each section of the report ---- */
  function RowActions({ r, kind, desk, canWrite, onDone }) {
    const [ask, setAsk] = useState(false); const [why, setWhy] = useState(ASIDE[0]); const [own_, setOwn] = useState(''); const [busy, setBusy] = useState(false);
    const send = async (path, body) => { setBusy(true); try { const d = await call(path, Object.assign({ desk: desk.id, item: r.id }, body)); onDone(d, r); } catch (e) { toastMsg(say(e), true); } setBusy(false); setAsk(false); };
    const link = web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label=${'Open the source of this ' + kind}>Open</a>` : null;
    if (!canWrite) return link;
    if (ask) return html`<span class="den-form den-asideform">
      <select class="den-in" value=${why} aria-label="Why it is set aside" onChange=${e => setWhy(e.target.value)}>${ASIDE.map(a => html`<option key=${a} value=${a}>${a}</option>`)}<option value="other">other (say why)</option></select>
      ${why === 'other' ? html`<input class="den-in" value=${own_} maxlength="200" placeholder="Why" aria-label="Your reason" onInput=${e => setOwn(e.target.value)} />` : null}
      <button class="den-mini" disabled=${busy || (why === 'other' && own_.trim().length < 3)} onClick=${() => send('/den/aside', { reason: why === 'other' ? own_ : why })}>Set aside</button><button class="den-mini quiet" onClick=${() => setAsk(false)}>Cancel</button></span>`;
    return html`<span class="den-acts">
      <button class=${'den-mini row' + (r.pinned ? ' on' : '')} disabled=${busy} aria-pressed=${r.pinned ? 'true' : 'false'} title=${r.pinned ? 'Pinned to the report: a draft must cover it. Press to unpin.' : 'Pin to the report: a draft must cover it'} onClick=${() => send('/den/pin', r.pinned ? { clear: true } : {})}>${r.pinned ? 'Pinned' : 'Pin'}</button>
      <button class="den-mini row" disabled=${busy} title="Take it off this desk's board, with a reason" onClick=${() => setAsk(true)}>Set aside</button>
      ${link}</span>`;
  }
  const layerTitle = l => (l === 1 ? 'Layer 1: an official route' : l === 2 ? 'Layer 2: a signed-in collector on the Mac' : 'Layer 3: a keyless read from the worker');
  /* One evidence card. The same card in Unsorted and under a section; what differs by kind is what the row carries. */
  function Card({ c, desk, canWrite, onDone, onFile, secs, cited, onDrag }) {
    const r = c.r, k = c.kind; const lvl = c.w.score >= 60 ? 3 : c.w.score >= 30 ? 2 : 1;
    const kindWord = k === 'media' ? 'story' : k === 'social' ? 'post' : k === 'actors' ? 'post by ' + r.who : k === 'narratives' ? 'Narrative' : 'Upcoming';
    const name = (c.pinned ? 'Pinned. ' : '') + (k === 'upcoming' ? 'Upcoming: ' + r.event + ' on ' + r.date : kindWord + ': ' + String(c.title || '').slice(0, 120));
    const src = k === 'media' ? html`<span class="den-src"><b>${r.outlet}</b> ${r.tier ? html`<span>${r.tier}${r.juris && r.juris !== 'au' ? ', ' + r.juris.toUpperCase() : ''}</span>` : null}</span>`
      : k === 'narratives' ? html`<span class="den-src"><b>Narrative</b></span>` : k === 'upcoming' ? html`<span class="den-src"><b>Upcoming</b></span>`
      : html`<span class="den-src"><b>${CH[r.platform] || r.platform}</b> ${r.sub ? html`<span>r/${r.sub} </span>` : null}${k === 'social' && r.registered ? html`<span>registered </span>` : null}${(r.layers || []).map(l => html`<span key=${l} class="den-chip" title=${layerTitle(l)}>L${l}</span>`)}</span>`;
    const when = k === 'upcoming' ? html`<span>${String(r.weekday || '').slice(0, 3)} ${r.date}${r.yearWritten ? '' : html` <span title="The source wrote no year: this is the next time that day comes">*</span>`}</span>` : k === 'narratives' ? (r.last ? aest(r.last) : '') : (k !== 'media' && r.eng_at ? 'read ' + since(r.eng_at) : aest(r.ts));
    const meta = [];
    if (k === 'media') { if (r.fb) meta.push(html`<span key="fb" title=${(r.fb.reactions || 0) + ' reactions, ' + (r.fb.comments || 0) + ' comments, ' + (r.fb.shares || 0) + ' shares'}>${fmtN(c.reach)} on Facebook</span>`); if (r.n > 1) meta.push(html`<span key="n">${r.n} outlets</span>`); }
    if (k === 'social' || k === 'actors') { meta.push(html`<span key="e" title=${engText(r.eng) || 'No counts are held for this post'}>${r.total ? fmtN(r.total) + ' interactions' : 'no counts held'}</span>`); if (r.growth != null && r.growth !== 0) meta.push(html`<span key="g">${(r.growth > 0 ? '+' : '') + fmtN(r.growth)} since yesterday</span>`); if (r.held) meta.push(html`<span key="h">${plural(r.held.n, 'comment')} held</span>`); }
    if (k === 'narratives') { meta.push(html`<span key="n">${fmtN(r.n)} rows, ${fmtN(r.n24)} in the last day</span>`); if ((r.spread || []).length) meta.push(html`<span key="s">${r.spread.map(s => CH[s] || s).join(' > ')}</span>`); }
    return html`<article class=${'den-row den-card w' + lvl + (c.pinned ? ' pinned' : '')} data-kind=${k} data-key=${c.key} tabIndex="0" aria-label=${name} draggable=${canWrite && onDrag ? 'true' : 'false'}
        onDragStart=${e => { if (!canWrite || !onDrag) return; try { e.dataTransfer.setData('text/plain', c.key); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} onDrag(c.key); }} onDragEnd=${() => onDrag && onDrag('')}>
      <div class="den-card-top"><span class="den-w" title=${'Weight ' + c.w.score + ' of 99' + (c.w.why.length ? ': ' + c.w.why.join(', ') : '') + '. Worked out on this page from the row\'s own figures.'}><span class="den-sr">Weight </span>${c.w.score}</span>${src}<span class="den-when">${when}</span></div>
      ${k === 'actors' ? html`<div class="den-who"><span class="den-t">${r.who}</span> <span class="den-role">${r.role === 'mp' ? 'MP' + (r.party ? ', ' + r.party : '') : r.role === 'org' ? 'organisation' : r.role}</span></div>` : null}
      <div class=${'den-card-title' + (k === 'actors' ? ' body' : ' den-t')}>${c.pinned ? html`<span class="den-pinmark" title="Pinned to the report: a draft must cover it">Pinned</span>` : null}${c.title}</div>
      ${k === 'media' && r.n > 1 ? html`<span class="den-sub">also in ${r.outlets.slice(1, 6).join(', ')}${r.n > 6 ? ' and ' + (r.n - 6) + ' more' : ''}</span>` : null}
      ${k === 'social' && (r.term || r.hashtag) ? html`<span class="den-sub">found by ${r.hashtag ? '#' + r.hashtag : '"' + r.term + '"'}</span>` : null}
      ${k === 'narratives' && r.claim ? html`<span class="den-sub">${r.claim}</span>` : null}
      ${k === 'upcoming' ? html`<span class="den-sub">${r.what}</span>` : null}
      ${meta.length ? html`<div class="den-card-meta">${meta}</div>` : null}
      <div class="den-chips">
        ${k === 'media' && r.gated ? html`<span class="den-chip warn" title="Read through the agency's subscription. A brief quotes at most thirty words.">subscriber</span>` : k === 'media' && r.full ? html`<span class="den-chip" title="The full text is held">full text</span>` : null}
        ${k === 'narratives' ? html`<span class=${'den-chip ' + (r.side === 'hostile' ? 'neg' : r.side === 'supportive' ? 'pos' : '')}>${r.side || 'not read yet'}</span>` : null}${k === 'narratives' && r.status ? html`<span class="den-chip">${r.status}</span>` : null}
        ${k === 'upcoming' && r.recorded ? html`<span class="den-chip info" title="Read from the parliament's own page for this bill or inquiry, not worked out from a sentence">recorded</span>` : null}
        ${(k === 'social' || k === 'actors') && r.held && r.held.tone != null ? html`<span class=${'den-chip ' + (r.held.tone < -0.2 ? 'neg' : r.held.tone > 0.2 ? 'pos' : '')}>${r.held.tone < -0.2 ? 'hostile' : r.held.tone > 0.2 ? 'warm' : 'mixed'}</span>` : null}
        ${c.sigs.map(s => html`<span key=${s.key} class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]} title=${s.title}>${(SIG[s.sig] || [s.sig])[0]}</span>`)}
        ${cited ? html`<span class="den-chip pos" title="The brief cites this row">Cited${cited > 1 ? ' x' + cited : ''}</span>` : null}
      </div>
      <div class="den-card-act">
        ${c.pin ? html`<${RowActions} r=${Object.assign({}, r, { pinned: c.pinned })} kind=${kindWord} desk=${desk} canWrite=${canWrite} onDone=${onDone} />`
          : k === 'narratives' ? html`<button class="den-link" onClick=${() => window.AXUI.goto('narratives', { id: r.id })} aria-label=${'Open the narrative: ' + r.label}>Open</button>`
          : web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label="Open the source of this date">Open</a>` : null}
        ${canWrite && onFile ? html`<select class="den-in den-file" aria-label="File under a section" title="Where this card is filed is kept on this computer" value=${c.sec || ''} onChange=${e => onFile(c, e.target.value)}><option value="">${c.sec ? 'Back to Unsorted' : 'File under...'}</option>${secs.map((s, i) => html`<option key=${s.id} value=${s.id}>${secKey(i) ? secKey(i) + '  ' : ''}${s.title}</option>`)}</select>` : null}
      </div>
    </article>`;
  }
  function Board({ desk, tick, bump, setTab, canWrite, onStrip, onBoard, bst, filing, setFiling, onWrite }) {
    const b = useLoad(() => get('/den/board?' + q({ desk: desk.id, missed: 1 }), 'counts'), [desk.id, tick], desk.id);
    useEffect(() => { if (!onStrip) return; const ms = b.data ? b.data.missed : null; const good = !!(ms && ms.ok === true && Array.isArray(ms.signals));
      onStrip({ data: good ? ms : null, loading: b.loading, err: b.err, reload: b.reload }); }, [b.data, b.loading, b.err]);   // eslint-disable-line
    useEffect(() => { if (onBoard) onBoard(b.data || null); }, [b.data]);   // eslint-disable-line
    const [offer, setOffer] = useState(null); const [showAside, setShowAside] = useState(false); const [showLow, setShowLow] = useState(false); const [kind, setKind] = useState('all'); const [find, setFind] = useState('');
    const [undo, setUndo] = useState(null); const [drag, setDrag] = useState(''); const [over, setOver] = useState('');
    const root = useRef(null); const last = useRef(''); const fref = useRef(filing); fref.current = filing;
    // a card that was moved or redrawn under the keyboard keeps the focus: the card itself, or the one that took its place
    useEffect(() => { if (!last.current || !root.current || document.activeElement !== document.body) return; const el = Array.from(root.current.querySelectorAll('.den-row')).find(x => x.dataset.key === last.current); if (el) el.focus({ preventScroll: true }); });
    const sigs = b.data && b.data.missed && Array.isArray(b.data.missed.signals) ? b.data.missed.signals : [];
    const secs = useMemo(() => desk.sections.filter(s => s.kind !== 'sources' && desk.options.hidden.indexOf(s.id) < 0), [desk]);
    const cards = useMemo(() => deck(b.data, sigs).map(c => Object.assign(c, { sec: filing[c.key] && secs.some(s => s.id === filing[c.key]) ? filing[c.key] : '' })), [b.data, filing, secs]);   // eslint-disable-line
    const unfile = keys => { const m = Object.assign({}, fref.current); let ch = false; keys.forEach(k => { if (m[k]) { delete m[k]; ch = true; } }); if (ch) setFiling(m); };
    const done = (d, r) => { if (d && d.offer) setOffer(d.offer); const keys = ['M:' + d.item, 'S:' + d.item, 'P:' + d.item];
      if (d && (d.mark === '' || d.mark === 'aside')) unfile(keys);
      const title = String((r && (r.title || r.text)) || 'the row').slice(0, 60); const back = async (path, body) => { try { await call(path, Object.assign({ desk: desk.id, item: d.item }, body)); b.reload(); } catch (e) { toastMsg(say(e), true); } };
      if (d) setUndo(d.mark === 'pin' ? { text: 'Pinned: ' + title, run: () => back('/den/pin', { clear: true }) } : d.mark === 'aside' ? { text: 'Set aside: ' + title, run: () => back('/den/aside', { clear: true }) } : { text: 'Unpinned: ' + title, run: () => back('/den/pin', {}) });
      b.reload(); };
    const mute = async on => { if (on) { try { await call('/den/mute', { desk: desk.id, kind: offer.kind, value: offer.value }); toastMsg('Muted on this desk'); b.reload(); bump('desk'); } catch (e) { toastMsg(say(e), true); } } setOffer(null); };
    /* File a card under a section. A row the worker can pin is pinned first, exactly as the Pin button does, so a draft
       must cover it; which section it sits under is this browser's own note. */
    const fileCard = async (c, sec) => { if (!canWrite || !c || (c.sec || '') === (sec || '')) return; const was = c.sec || ''; let pinnedNow = false;
      if (sec && c.pin && !c.pinned) { try { await call('/den/pin', { desk: desk.id, item: c.id }); pinnedNow = true; } catch (e) { toastMsg(say(e), true); return; } }
      const m = Object.assign({}, fref.current); if (sec) m[c.key] = sec; else delete m[c.key]; setFiling(m);
      const t = (secs.find(s => s.id === sec) || {}).title;
      setUndo({ text: (sec ? 'Filed under ' + t : 'Back to Unsorted') + ': ' + String(c.title || '').slice(0, 50), run: async () => { const n = Object.assign({}, fref.current); if (was) n[c.key] = was; else delete n[c.key]; setFiling(n); if (pinnedNow) { try { await call('/den/pin', { desk: desk.id, item: c.id, clear: true }); } catch (e) { toastMsg(say(e), true); } b.reload(); } } });
      if (pinnedNow) b.reload(); };
    const drop = sec => e => { e.preventDefault(); let k = drag; try { k = e.dataTransfer.getData('text/plain') || drag; } catch (x) {} setOver(''); setDrag(''); const c = cards.find(x => x.key === k); if (c) fileCard(c, sec); };
    const dragOver = sec => e => { if (!drag) return; e.preventDefault(); if (over !== (sec || 'unsorted')) setOver(sec || 'unsorted'); };
    // keyboard: j and k move between cards, p pins, x sets aside, o opens, a section's number files the focused card, / searches
    const onKey = e => { const tg = e.target; if (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) return; if (e.metaKey || e.ctrlKey || e.altKey || !root.current) return;
      if (e.key === '/') { const f = root.current.querySelector('.den-search input'); if (f) { f.focus(); e.preventDefault(); } return; }
      const rows = Array.from(root.current.querySelectorAll('.den-row')); const here = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.den-row') : null; const i = rows.indexOf(here);
      const go = n => { if (rows[n]) { rows[n].focus(); if (rows[n].scrollIntoView) rows[n].scrollIntoView({ block: 'nearest', inline: 'nearest' }); e.preventDefault(); } };
      if (e.key === 'j') return go(i < 0 ? 0 : Math.min(rows.length - 1, i + 1)); if (e.key === 'k') return go(i < 0 ? 0 : Math.max(0, i - 1));
      if (/^[0-9]$/.test(e.key)) { const s = secs[e.key === '0' ? 9 : +e.key - 1]; if (!s) return; e.preventDefault();
        if (i >= 0 && canWrite) { const c = cards.find(x => x.key === here.dataset.key); const nx = rows[i + 1] && rows[i + 1].closest('.den-col') === here.closest('.den-col') ? rows[i + 1] : rows[i - 1] && rows[i - 1].closest('.den-col') === here.closest('.den-col') ? rows[i - 1] : null; if (c && c.sec !== s.id) { last.current = nx ? nx.dataset.key : c.key; fileCard(c, s.id); } }
        else { const col = Array.from(root.current.querySelectorAll('.den-col[data-sec]')).find(x => x.dataset.sec === s.id); if (col) { col.scrollIntoView({ block: 'nearest', inline: 'center' }); const f = col.querySelector('.den-row'); if (f) f.focus(); } } return; }
      if (i < 0) return; const btn = t => Array.from(rows[i].querySelectorAll('button')).find(x => t.test(x.textContent));
      if (e.key === 'p') { const x = btn(/^Pin/); if (x) { x.click(); e.preventDefault(); } } if (e.key === 'x') { const x = btn(/^Set aside$/); if (x) { x.click(); e.preventDefault(); } }
      if ((e.key === 'o' || e.key === 'Enter') && e.target === rows[i]) { const a = rows[i].querySelector('.den-card-act a[href], .den-card-act button.den-link'); if (a) { a.click(); e.preventDefault(); } } };
    if (b.loading && !b.data) return html`<${Loading} what="today's evidence" board=${true} />`;
    if (b.err && !b.data) return html`<${Failed} what="Today's evidence" err=${b.err} onRetry=${b.reload} />`;
    const d = b.data, c = d.counts; const brief = bst && bst.brief; const texts = (bst && bst.texts) || {}; const ev = brief ? brief.evidence || {} : null;
    const allText = brief ? Object.keys(texts).map(k => texts[k] || '') : []; const citedN = x => { const id = citeOf(x, ev); if (!id) return 0; const mk = '[' + id + ']'; return allText.filter(t => t.indexOf(mk) >= 0).length; };
    const uns = cards.filter(x => !x.sec); const counts = uns.reduce((a, x) => { a[x.kind] = (a[x.kind] || 0) + 1; return a; }, {}); const needle = find.trim().toLowerCase();
    const shown = uns.filter(x => (kind === 'all' || x.kind === kind) && (!needle || (String(x.title || '') + ' ' + (x.r.outlet || '') + ' ' + (x.r.who || '') + ' ' + (x.r.what || '') + ' ' + (x.r.claim || '')).toLowerCase().indexOf(needle) >= 0)).sort(byWeight);
    const main = shown.filter(x => x.pinned || x.w.score >= LOW), low = shown.filter(x => !x.pinned && x.w.score < LOW);
    const gaps = sigs.filter(s => s.sig === 'gap'); const unc = sigs.filter(s => !covered(s, brief, texts));
    const card = x => html`<${Card} key=${x.key} c=${x} desk=${desk} canWrite=${canWrite} onDone=${done} onFile=${fileCard} secs=${secs} cited=${citedN(x)} onDrag=${setDrag} />`;
    const total = { media: (d.media || []).length, social: (d.social || []).length, actors: (d.actors || []).length, narratives: (d.narratives || []).length, upcoming: (d.upcoming || []).length };
    const WHY = { narratives: 'No narrative on this desk\'s issues gained rows in this window.', media: 'No story on this desk\'s issues' + (desk.region !== 'au' ? ' in ' + desk.region.toUpperCase() : '') + ' was filed in this window.', social: 'No post on this desk\'s terms or from its registered accounts was collected in this window.',
      actors: 'No registered organisation, official or MP posted on this desk in this window.', upcoming: 'No row in this window names a day and a month beside an action that has not yet passed, and no watched bill or inquiry has a date ahead.' };
    const none = KINDS_ROW.filter(k => !total[k[0]]);
    return html`<div class="den-boardwrap" ref=${root} onKeyDown=${onKey} onFocus=${e => { const r = e.target.closest ? e.target.closest('.den-row') : null; last.current = r ? r.dataset.key : ''; }}>
      ${b.err ? html`<div class="den-notice bad" role="alert">The board could not be refreshed: ${b.err} What is shown is the last read. <button class="den-mini" onClick=${b.reload}>Try again</button></div>` : null}
      ${d.capped ? html`<div class="den-notice">This window holds more rows than one board reads (${fmtN(4000)}). The newest are shown; shorten the window in Options to see all of a busy day.</div>` : null}
      ${offer ? html`<div class="den-notice" role="alert">${offer.text} A mute hides its rows on this desk only, and can be removed in Options. <div><button class="den-mini primary" onClick=${() => mute(true)}>Mute it on this desk</button><button class="den-mini" onClick=${() => mute(false)}>Not now</button></div></div>` : null}
      <div class="den-board">
        <section class=${'den-col den-unsorted' + (over === 'unsorted' ? ' over' : '')} aria-label="Unsorted" onDragOver=${dragOver('')} onDrop=${drop('')} onDragLeave=${() => setOver('')}>
          <header class="den-col-h"><h3>Unsorted</h3><span class="den-count" title="Cards not yet filed under a section">${uns.length}</span>
            <p class="den-colsub">${canWrite ? 'The window\'s triage queue. Drag a card to a section, or focus it and press the section\'s number. Where a card is filed is kept on this computer.' : 'The window\'s rows, by weight. Your key is read-only: filing, pinning and setting aside need a full key.'}</p></header>
          <div class="den-col-tools">
            ${gaps.map(g => html`<button key=${g.key} class="den-gapline" onClick=${() => setTab('collection')} title=${g.detail}><b>${g.title}.</b> <span>Not a quiet day: see why</span></button>`)}
            <label class="den-search"><span class="den-sr">Search the unsorted cards</span><input class="den-in" type="search" value=${find} placeholder="Search rows ( / )" onInput=${e => setFind(e.target.value)} /></label>
            <div class="den-filter" role="group" aria-label="Kind of row">${[['all', 'All']].concat(KINDS_ROW).map(k => html`<button key=${k[0]} class="den-seg" aria-pressed=${kind === k[0] ? 'true' : 'false'} onClick=${() => setKind(k[0])}>${k[1]} <span class="n">${k[0] === 'all' ? uns.length : counts[k[0]] || 0}</span></button>`)}</div>
            ${canWrite ? html`<button class="den-mini quiet den-undo" disabled=${!undo} title=${undo ? undo.text : 'Nothing to undo'} onClick=${() => { const u = undo; setUndo(null); if (u) u.run(); }}>Undo${undo ? html`<span class="den-undo-t">: ${undo.text}</span>` : null}</button>` : null}
          </div>
          <div class="den-col-body">
            ${main.map(card)}
            ${!shown.length && uns.length ? html`<${Empty}>No unsorted card matches${needle ? ' "' + find.trim() + '"' : ''}${kind !== 'all' ? ' under ' + (KINDS_ROW.find(k => k[0] === kind) || [0, kind])[1] : ''}. <button class="den-link" onClick=${() => { setFind(''); setKind('all'); }}>Show all</button><//>` : null}
            ${!uns.length && cards.length ? html`<${Empty}><b>Every card is filed.</b> Each is under the section it was filed to.<//>` : null}
            ${low.length ? html`<div class="den-group"><button class="den-fold" aria-expanded=${showLow ? 'true' : 'false'} onClick=${() => setShowLow(!showLow)}>Low weight <span class="den-count">${low.length}</span> <span class="den-mono">under ${LOW}: old, with little reach</span></button>${showLow ? low.map(card) : null}</div>` : null}
            ${none.length ? html`<div class="den-none">${none.map(k => html`<div key=${k[0]} class="den-state" data-none=${k[0]}><b>${k[1]}: none.</b> ${WHY[k[0]]} ${k[0] === 'upcoming' ? null : html`<button class="den-link" onClick=${() => setTab('collection')}>See what was collected, and why not</button>`}</div>`)}</div>` : null}
            ${c.news > c.media ? html`<p class="den-mono den-hidden-n">${c.news} stories, ${c.media} after folding copies.</p>` : null}
            ${c.aside || c.muted || c.otherRegions || c.underMinimum ? html`<p class="den-mono den-hidden-n">${[c.aside ? c.aside + ' set aside' : '', c.muted ? c.muted + ' muted' : '', c.otherRegions ? c.otherRegions + ' in other regions' : '', c.underMinimum ? c.underMinimum + ' under this desk\'s minimum' : ''].filter(Boolean).join(', ')} and not shown. ${c.aside ? html`<button class="den-link" aria-expanded=${showAside ? 'true' : 'false'} onClick=${() => setShowAside(!showAside)}>${showAside ? 'Hide' : 'Show'} what was set aside</button>` : null}</p>` : null}
            ${showAside && d.aside.length ? html`<ul class="den-asidelist" aria-label="Set aside">${d.aside.map(a => html`<li key=${a.id} class="den-aside-row"><span class="den-t">${a.title || CH[a.channel] || a.channel}</span><span class="den-sub"><span class="den-chip">${a.reason}</span> by ${a.by} ${since(a.at)}</span>
              ${canWrite ? html`<button class="den-mini row" onClick=${async () => { try { await call('/den/aside', { desk: desk.id, item: a.id, clear: true }); b.reload(); } catch (e) { toastMsg(say(e), true); } }}>Put it back</button>` : null}</li>`)}</ul>` : null}
          </div>
        </section>
        ${desk.sections.filter(s => desk.options.hidden.indexOf(s.id) < 0).map(s => { if (s.kind === 'sources') { const n = brief ? (brief.sourceList || []).reduce((a, g) => a + g.items.length, 0) : 0;
            return html`<section key=${s.id} class="den-col den-built" aria-label=${s.title}><header class="den-col-h"><h3>${s.title}</h3><span class="den-count">${n}</span></header><div class="den-col-meta"><span class="den-chip" title="Built from the rows the brief cites. It is never written by a model and cannot be edited: change what is cited instead.">built from the citations</span></div>
              <div class="den-col-body"><p class="den-drop">${n ? plural(n, 'source') + ' cited so far. The list is on the Brief tab.' : 'Nothing is cited yet, so there is nothing to list. It is not a place to file a card: cite the card in a section.'}</p></div></section>`; }
          const i = secs.indexOf(s); const mine = cards.filter(x => x.sec === s.id).sort(byWeight); const sec = brief ? brief.sections[s.id] : null; const text = texts[s.id] != null ? texts[s.id] : (sec ? sec.text : ''); const st = secState(sec, text, mine.length);
          const un = unc.filter(x => sigSec(x, cards, filing, secs) === s.id); const key = secKey(i);
          return html`<section key=${s.id} class=${'den-col sp' + (i % 11) + (over === s.id ? ' over' : '')} data-sec=${s.id} aria-label=${s.title} onDragOver=${dragOver(s.id)} onDrop=${drop(s.id)} onDragLeave=${() => setOver('')}>
            <header class="den-col-h">${key ? html`<span class="den-kbd" title=${'Press ' + key + ' to file the focused card here'}>${key}</span>` : null}<h3>${s.title}</h3><span class="den-count" title="Cards filed here">${mine.length}</span></header>
            <div class="den-col-meta"><span class=${'den-chip ' + st[1]}>${st[0]}</span>${un.length ? html`<span class="den-chip neg" title=${un.map(x => x.title).join('; ')}>${plural(un.length, 'check')} uncovered</span>` : null}<span class="den-spacer"></span>
              <button class="den-mini" aria-label=${'Write ' + s.title} onClick=${() => onWrite(s.id)}>${canWrite ? 'Write' : 'Read'}</button></div>
            <div class="den-col-body">${mine.length ? mine.map(card) : html`<p class="den-drop">${canWrite ? html`<span>Drop evidence here${key ? html`<span>, or focus a card and press <span class="den-kbd">${key}</span></span>` : null}.</span>` : 'No card is filed here on this computer.'}</p>`}</div>
            ${String(text || '').trim() ? html`<div class="den-excerpt"><span class="den-mono">${wc(text)} words</span><p>${String(text).replace(/\s*\[[A-Z]:[^\]]+\]/g, '').slice(0, 170)}${String(text).length > 170 ? '...' : ''}</p></div>` : null}
          </section>`; })}
      </div>
    </div>`;
  }

  /* ---- Brief ---- */
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
  /* A citation as a person reads it: the outlet, the channel or the actor, never the bare id. */
  function citeLabel(id, e) {
    if (!e) return id; const l = String(e.label || '');
    if (e.k === 'media') return l.split(' - ')[0].slice(0, 32) || id; if (e.k === 'social') { const p = l.split(' ')[0]; return (CH[p] || p) + ' post'; }
    if (e.k === 'actor') return l.replace(/ on ([a-z]+)$/, (m, p) => ' on ' + (CH[p] || p)).slice(0, 36); if (e.k === 'alert') return 'Sentinel alert'; if (e.k === 'tone') return 'Tone: ' + l.slice(0, 24); if (e.k === 'memory') return 'Memory'; if (e.k === 'narrative') return 'Narrative'; return l.slice(0, 32) || id;
  }
  /* The text as it reads: sentences cut the way the worker's check cuts them, every citation a chip that carries the row's
     outlet, and each flag at the sentence it concerns. `F` is the saved section's flags, or null while the words differ. */
  function sentences(par) { const out = []; const rx = /([.!?\]])(\s+)(?=[A-Z"'\[])/g; let at = 0, m; while ((m = rx.exec(par))) { out.push(par.slice(at, m.index + 1)); at = m.index + m[0].length; } if (at < par.length) out.push(par.slice(at)); return out; }
  function Reads({ text, F, evidence }) {
    const used = { u: new Set(), f: new Set(), t: new Set() }; const plain = s => s.replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:])/g, '$1').replace(/ {2,}/g, ' ').trim();
    const chip = (id, k) => { const e = evidence[id]; const t = id + (e ? ' - ' + (e.label || '') : ': this brief\'s evidence holds no row with this id, so saving removes it'); const body = citeLabel(id, e) + (e && e.gated ? ' (subscriber)' : '');
      return e && web(e.url) ? html`<a key=${k} class="den-cite" href=${web(e.url)} target="_blank" rel="noopener" title=${t}>${body}</a>` : html`<span key=${k} class=${'den-cite' + (e ? '' : ' bad')} title=${t}>${body}</span>`; };
    const parts = (s, k) => s.split(/(\[[A-Z]:[A-Za-z0-9_.-]{1,40}\])/).filter(Boolean).map((p, i) => (/^\[[A-Z]:/.test(p) ? chip(p.slice(1, -1), k + '-' + i) : p));
    const paras = String(text || '').replace(/\r/g, '').split(/\n\n+/).filter(p => p.trim());
    const body = paras.map((p, pi) => html`<p key=${pi}>${sentences(p).map((s, si) => { const k = pi + '-' + si; const pl = plain(s); let lab = null;
      if (F && pl) { const u = (F.uncited || []).findIndex((x, i) => !used.u.has(i) && x === pl.slice(0, 240)); if (u >= 0) { used.u.add(u); lab = html`<span class="w">No evidence behind:</span>`; }
        else { const f = (F.unverified || []).findIndex((x, i) => !used.f.has(i) && x.sentence === pl.slice(0, 200)); if (f >= 0) { used.f.add(f); lab = html`<span class="w">${F.unverified[f].figures.join(', ')} is not in the row it cites:</span>`; }
          else { const t = (F.trimmed || []).findIndex((x, i) => !used.t.has(i) && s.indexOf(String(x).split(/\s+/).slice(0, 6).join(' ')) >= 0); if (t >= 0) { used.t.add(t); lab = html`<span class="w">A subscriber quotation was cut at thirty words:</span>`; } } } }
      return lab ? html`<span key=${k} class="den-flag">${lab} <mark>${parts(s, k)}</mark> </span>` : html`<span key=${k}>${parts(s, k)} </span>`; })}</p>`);
    // a flag whose sentence could not be found in the text is still said, under it
    const rest = F ? (F.uncited || []).filter((x, i) => !used.u.has(i)).map((u, i) => html`<li key=${'u' + i}><span class="w">No evidence behind:</span> ${u}</li>`)
      .concat((F.unverified || []).filter((x, i) => !used.f.has(i)).map((u, i) => html`<li key=${'f' + i}><span class="w">${u.figures.join(', ')}</span> is not in the row it cites: ${u.sentence}</li>`))
      .concat((F.trimmed || []).filter((x, i) => !used.t.has(i)).map((u, i) => html`<li key=${'t' + i}><span class="w">A subscriber quotation was cut at thirty words:</span> ${u}...</li>`)) : [];
    return html`<div class="den-reads"><div class="den-reads-h"><b>As it reads</b> <span>citations resolved${F ? ', flags at the sentence they concern' : '; flags return when the words are saved'}</span></div>
      <div class="den-cites" aria-label="As it reads">${body.length ? body : html`<p class="den-quiet">Nothing written yet.</p>`}</div>${rest.length ? html`<ul class="den-flags">${rest}</ul>` : null}</div>`;
  }
  function Section({ s, n, of, sec, text, evidence, readOnly, onChange, onBlur, onRegen, busy, left, hidden, rate, carets, state, onStep }) {
    const [ask, setAsk] = useState(false); const [note, setNote] = useState(''); const dirty = sec && text !== sec.text;
    const caret = e => { carets.current[s.id] = e.target.selectionStart; };
    return html`<div class="den-sec" data-section=${s.id} hidden=${hidden}>
      <div class="den-eyebrow"><span>Section ${n} of ${of}</span><span class=${'den-chip ' + state[1]}>${state[0]}</span><span class="den-spacer"></span>
        <button class="den-mini quiet" disabled=${n <= 1} onClick=${() => onStep(-1)}>Previous</button><button class="den-mini quiet" disabled=${n >= of} onClick=${() => onStep(1)}>Next</button></div>
      <h4>${s.title}${sec && sec.edited ? html`<span class="den-chip pos" title="A person has edited this section; a model will not write over it unless asked">edited by ${sec.by}</span>` : sec && sec.by === 'model' ? html`<span class="den-chip acc">drafted</span>` : null}${dirty ? html`<span class="den-chip warn">not saved</span>` : null}</h4>
      <div class="den-secmeta"><span class="den-mono">${wc(text)} words</span><span class="den-spacer"></span>
        ${!readOnly && onRegen && !ask ? html`<button class="den-mini" disabled=${busy || dirty} title=${dirty ? 'Save your edit first' : 'One model call, counted against today\'s Den budget'} onClick=${() => setAsk(true)}>Regenerate this section</button>` : null}</div>
      ${!readOnly && onRegen && ask ? html`<div class="den-form den-regen"><label class="den-lab den-grow">What to change (optional)<input value=${note} maxlength="400" placeholder="Shorter. Lead with the Senate vote." onInput=${e => setNote(e.target.value)} /></label>
          <button class="den-mini primary" disabled=${busy || !left} title=${left ? '' : 'Today\'s Den model calls are used'} onClick=${() => { onRegen(s.id, note, sec && sec.edited); setAsk(false); }}>Write it again (1 model call)</button><button class="den-mini quiet" onClick=${() => setAsk(false)}>Cancel</button>
          ${sec && sec.edited ? html`<span class="den-save dirty">This replaces ${sec.by}'s edit.</span>` : null}</div>` : null}
      ${rate || null}
      <div class="den-write-h"><b>Write</b> <span>citations are typed as [M:123]; a card on the right inserts one where the cursor was</span></div>
      <textarea class="den-ta" aria-label=${s.title} readOnly=${readOnly} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section, or draft the brief. Keep the [M:123] marks: they are the citations.'} onInput=${e => { caret(e); onChange(s.id, e.target.value); }} onSelect=${caret} onKeyUp=${caret} onClick=${caret} onBlur=${e => { caret(e); onBlur(); }}></textarea>
      <${Reads} text=${text} F=${sec && !dirty ? sec : null} evidence=${evidence} />
    </div>`;
  }
  /* Time since a model call began. A count of seconds, never a share of the work: nothing here knows how far it is. */
  function Elapsed({ from }) { const [, f] = useState(0); useEffect(() => { const t = setInterval(() => f(x => x + 1), 1000); return () => clearInterval(t); }, []); const s = Math.max(0, Math.round((Date.now() - from) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function BriefPanel({ desk, tick, bump, budget, canWrite, setTab, cards, signals, filing, setFiling, openSec, setOpenSec, onState }) {
    const wk = b => 'ax_den_work_' + b.id;
    const L = useLoad(() => get('/den/brief?' + q({ desk: desk.id }), 'brief'), [desk.id, tick], desk.id);
    const [work, setWork] = useState(null);        // { id, revision, sections: {id: text}, ratings } - this person's unsaved words
    const [save, setSave] = useState({ s: 'idle', msg: '' }); const [busy, setBusy] = useState(''); const [t0, setT0] = useState(0); const [conflict, setConflict] = useState(null); const [ask, setAsk] = useState(null); const [restored, setRestored] = useState(false);
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
    const guard = async (name, fn) => { if (busy) return; setBusy(name); setT0(Date.now()); setDropped(false); try { await fn(); } catch (e) { if (!e.code && !e.status) setDropped(true); else if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); toastMsg('Someone else changed this brief first.', true); } else toastMsg(say(e), true); } setBusy(''); bump('budget'); };
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

    const carets = useRef({}); const wrap = useRef(null); const [menu, setMenu] = useState(false); const [pull, setPull] = useState(false);
    // the Board's columns and the rail read the brief as it stands in the editor
    useEffect(() => { if (onState) onState({ brief: brief || null, texts: work && brief && work.id === brief.id ? work.sections : null }); }, [brief, work]);   // eslint-disable-line
    useEffect(() => { if (!menu) return; const out = e => { if (!e.target.closest || !e.target.closest('.den-menu')) setMenu(false); }; const key = e => { if (e.key === 'Escape') setMenu(false); };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [menu]);

    if (L.loading && !L.data) return html`<${Loading} what="the brief" />`;
    if (L.err && !L.data) return html`<${Failed} what="The brief" err=${L.err} onRetry=${L.reload} />`;
    const cost = 'One model call (a second only if the first answer cannot be read). ' + (budget ? budget.left + ' of ' + budget.cap + ' left today.' : '');
    const droppedNote = dropped ? html`<div class="den-notice bad" role="alert">The connection dropped while the worker was writing. The worker may still finish and save it: nothing here was lost. <div><button class="den-mini primary" onClick=${() => { setDropped(false); L.reload(); }}>Check for the draft</button></div></div>` : null;
    const progress = busy === 'draft' || busy === 'section' ? html`<div class="den-progress" role="status"><span class="den-spin" aria-hidden="true"></span><span><b>${busy === 'draft' ? 'Writing the brief from the evidence.' : 'Writing the section again.'}</b> One model call, usually a minute or two; <${Elapsed} from=${t0} /> so far. Nothing else is locked: the Board and the other tabs stay usable.</span></div>` : null;
    if (!brief) return html`<div class="den-briefwrap den-page">${droppedNote}<${Panel} title=${'Today\'s brief - ' + desk.name}>
      <${Empty}><b>No brief has been started for this window.</b> A draft is written from the rows on the Board, every sentence tied to the row it rests on; pin the rows it must cover first.${cards ? ' The Board holds ' + plural(cards.length, 'card') + ' now, ' + cards.filter(c => c.pinned).length + ' pinned.' : ''}
        ${canWrite ? html`<div class="den-mt"><button class="den-mini primary" disabled=${!!busy || !left} onClick=${() => draft(false)}>${busy === 'draft' ? 'Drafting (a minute or two)...' : 'Draft the brief (1 model call)'}</button> <button class="den-mini" disabled=${!!busy} onClick=${start}>Write it by hand</button><span class="den-sub">${left ? cost : 'Today\'s Den model calls are used. A brief can still be written by hand.'}</span></div>` : html`<div class="den-mt">Your key is read-only: drafting and writing need a full key.</div>`}<//>
      ${progress}<//></div>`;
    const filed = brief.status === 'filed'; const ro = !canWrite || filed; const ev = brief.evidence || {};
    const src = desk.sections.find(s => s.kind === 'sources' && desk.options.hidden.indexOf(s.id) < 0); const others = desk.sections.filter(s => s.kind !== 'sources' && desk.options.hidden.indexOf(s.id) < 0);
    const flags = others.reduce((n, s) => n + (((brief.sections[s.id] || {}).uncited || []).length), 0);
    const openS = others.find(s => s.id === openSec) || (src && src.id === openSec ? src : null) || others[0] || src; const onSrc = !!(src && openS === src);
    const T = id => (work ? work.sections[id] || '' : ''); const total = others.reduce((n, s) => n + wc(T(s.id)), 0);
    const cardBy = {}; (cards || []).forEach(c => { cardBy[c.key] = c; });
    const uncAll = signals ? signals.filter(s => !covered(s, brief, work ? work.sections : null)) : null; const secOfSig = s => sigSec(s, cards, filing, others);
    const filedHere = id => Object.keys(filing).filter(k => filing[k] === id && (cardBy[k] || ev[k]));
    const citedIn = cid => others.filter(s => T(s.id).indexOf('[' + cid + ']') >= 0).length;
    const step = d => { const all = others.concat(src ? [src] : []); const i = all.indexOf(openS) + d; if (all[i]) setOpenSec(all[i].id); };
    /* A card's citation goes in where the cursor last was in the open section, and the words are then this person's
       unsaved edit like any other. Only an id this brief's evidence holds is offered: the worker removes any other. */
    const cite = cid => { if (ro || !cid || onSrc) return; const sid = openS.id; const t = T(sid); let pos = carets.current[sid]; if (pos == null || pos > t.length) pos = t.length; const pre = t.slice(0, pos); const lead = pre && !/[\s(]$/.test(pre) ? ' ' : ''; const at = (pre + lead + '[' + cid + ']').length;
      carets.current[sid] = at; change(sid, pre + lead + '[' + cid + ']' + t.slice(pos)); setTimeout(() => { const ta = wrap.current && Array.from(wrap.current.querySelectorAll('.den-sec textarea')).find(x => x.closest('.den-sec').dataset.section === sid); if (ta) { ta.focus(); try { ta.setSelectionRange(at, at); } catch (e) {} } }, 0); };
    const fileHere = async c => { if (!canWrite || onSrc) return; if (c.pin && !c.pinned) { try { await call('/den/pin', { desk: desk.id, item: c.id }); c.pinned = true; } catch (e) { toastMsg(say(e), true); return; } } setFiling(Object.assign({}, filing, { [c.key]: openS.id })); };
    const unfileKey = k => { const m = Object.assign({}, filing); delete m[k]; setFiling(m); };
    const cardSub = c => (c.kind === 'media' ? c.r.outlet + (c.r.n > 1 ? ', ' + c.r.n + ' outlets' : '') + (c.reach ? ', ' + fmtN(c.reach) + ' on Facebook' : '') : c.kind === 'social' ? (CH[c.r.platform] || c.r.platform) + (c.reach ? ', ' + fmtN(c.reach) + ' interactions' : '') : c.kind === 'actors' ? c.r.who + ' on ' + (CH[c.r.platform] || c.r.platform) : c.kind === 'narratives' ? 'Narrative, ' + fmtN(c.r.n) + ' rows' : 'Upcoming, ' + c.r.date);
    const evItem = (key, extra) => { const c = cardBy[key]; const cid = c ? citeOf(c, ev) : (ev[key] ? key : ''); const e = cid ? ev[cid] : null; const title = c ? String(c.title || '') : e ? String(e.label || key) : key; const url = c ? c.url : e ? e.url : ''; const n = cid ? citedIn(cid) : 0;
      return html`<li key=${key} class="den-evitem"><button class=${'den-evcard' + (n ? ' cited' : '')} disabled=${ro || !cid} aria-label=${(cid ? 'Cite ' + cid + ': ' : 'Cannot be cited in this brief: ') + title.slice(0, 100)} title=${cid ? 'Insert [' + cid + '] where the cursor was' : 'This brief\'s evidence does not hold this row: it was collected after the draft, or the brief was started by hand. Draft again to cite it.'} onClick=${() => cite(cid)}>
          <span class="den-evtop">${c ? html`<span class="den-w">${c.w.score}</span>` : null}<span class="den-evid">${cid || 'not in this brief\'s evidence'}</span>${n ? html`<span class="den-chip pos">Cited${n > 1 ? ' x' + n : ''}</span>` : null}</span>
          <span class="den-t">${title}</span><span class="den-sub">${c ? cardSub(c) : e ? (e.gated ? 'subscriber row' : e.k || '') : ''}</span></button>
        <span class="den-evact">${web(url) ? html`<a class="den-link" href=${web(url)} target="_blank" rel="noopener" aria-label=${'Open the source: ' + title.slice(0, 80)}>Open</a>` : null}${extra || null}</span></li>`; };
    const here = onSrc ? [] : filedHere(openS.id); const hereIds = new Set(here.map(k => { const c = cardBy[k]; return c ? citeOf(c, ev) : k; }));
    const elsewhere = onSrc ? [] : Array.from(new Set((T(openS.id).match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).map(x => x.slice(1, -1)))).filter(id => ev[id] && !hereIds.has(id));
    const keyOfCite = id => { const c = (cards || []).find(x => citeOf(x, ev) === id); return c ? c.key : id; };
    const pullList = cards ? cards.filter(c => !filing[c.key]).sort(byWeight) : null; const unHere = uncAll && !onSrc ? uncAll.filter(s => secOfSig(s) === openS.id) : [];
    const matched = s => desk.ratings.items.filter(i => i.id === s.id || i.id === s.kind); const loose = desk.ratings.items.filter(i => !others.some(s => i.id === s.id || i.id === s.kind));
    const rateBar = items => (items.length ? html`<div class="den-bar den-rate">${items.map(i => { const r = (work && work.ratings && work.ratings[i.id]) || {}; const set = (k, v) => { setWork(w => Object.assign({}, w, { ratings: Object.assign({}, w.ratings, { [i.id]: Object.assign({}, r, { [k]: v }) }) })); setSave({ s: 'dirty', msg: '' }); };
      return html`<span key=${i.id} class="den-form"><label class="den-lab">${i.label}<select value=${r.level || ''} disabled=${ro} onChange=${e => set('level', e.target.value)}><option value="">Not rated</option>${desk.ratings.levels.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>
        ${i.trend ? html`<label class="den-lab">Trend<select value=${r.trend || ''} disabled=${ro} aria-label=${i.label + ' trend'} onChange=${e => set('trend', e.target.value)}><option value="">-</option>${desk.ratings.trends.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>` : null}</span>`; })}</div>` : null);
    const nSources = brief.sourceList.reduce((a, g) => a + g.items.length, 0);
    return html`<div class="den-briefwrap" ref=${wrap}>
      ${droppedNote}
      ${restored && !conflict ? html`<div class="den-notice" role="status">Your unsaved words from ${since((ls.get(wk(brief), {}) || {}).at)} were kept on this computer and are back in the editor. <div><button class="den-mini primary" disabled=${ro} onClick=${() => doSave()}>Save them</button><button class="den-mini" onClick=${() => { ls.del(wk(brief)); setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); setSave({ s: 'idle', msg: '' }); }}>Discard them</button></div></div>` : null}
      ${conflict ? html`<div class="den-notice bad" role="alert"><b>${conflict.theirs.sections && Object.keys(conflict.theirs.sections).map(k => conflict.theirs.sections[k].by).filter(x => x && x !== 'model').pop() || 'Someone else'} saved this brief after you opened it</b> (it is now revision ${conflict.theirs.revision}). Your words are still here and nothing was overwritten.
        <div><button class="den-mini primary" onClick=${keepMine}>Keep mine</button><button class="den-mini" onClick=${takeTheirs}>Take theirs</button></div><span class="den-sub">Keep mine keeps what you typed in the sections you changed; you then save it over theirs. Take theirs discards what you typed.</span></div>` : null}
      <section class="den-panel den-brief" aria-label=${desk.client + ' - ' + desk.name}>
        <header><h3>${desk.client + ' - ' + desk.name}</h3><span class="den-note">${'Reporting window: ' + (brief.window.label || brief.day)}</span><span class="den-spacer"></span><span class=${'den-chip ' + (filed ? 'pos' : 'warn')}>${filed ? 'Filed by ' + brief.filed_by + ', ' + aest(brief.filed_at) : 'Draft'}</span><span class="den-mono">revision ${brief.revision}</span></header>
        ${rateBar(loose)}
        <div class="den-panes">
          <nav class="den-outline" aria-label="Sections of the brief"><div class="den-outline-h"><b>Sections</b><span class="den-mono">${fmtN(total)} words</span></div>
            <ol>${others.map((s, i) => { const st = secState(brief.sections[s.id], T(s.id), filedHere(s.id).length); const un = uncAll ? uncAll.filter(x => secOfSig(x) === s.id).length : 0;
              return html`<li key=${s.id}><button class=${'den-out sp' + (i % 11)} data-goto=${s.id} aria-current=${openS === s ? 'true' : null} onClick=${() => setOpenSec(s.id)}>${secKey(i) ? html`<span class="den-kbd">${secKey(i)}</span>` : null}
                <span class="den-out-t"><b>${s.title}</b><span class="den-mono">${wc(T(s.id))} words, ${plural(filedHere(s.id).length, 'card')}</span></span>${un ? html`<span class="den-dot" title=${plural(un, 'check') + ' uncovered'}><span class="den-sr">${plural(un, 'check')} uncovered</span></span>` : null}<span class=${'den-chip ' + st[1]}>${st[0]}</span></button></li>`; })}
              ${src ? html`<li><button class="den-out den-out-src" data-goto=${src.id} aria-current=${onSrc ? 'true' : null} onClick=${() => setOpenSec(src.id)}><span class="den-out-t"><b>${src.title}</b><span class="den-mono">${plural(nSources, 'source')}, built</span></span></button></li>` : null}</ol></nav>
          <div class="den-write"><div class="den-measure">
            ${progress}
            ${others.map((s, i) => html`<${Section} key=${s.id} s=${s} n=${i + 1} of=${others.length} sec=${brief.sections[s.id]} text=${T(s.id)} evidence=${ev} readOnly=${ro} onChange=${change} onBlur=${() => { if (dirty && !conflict) doSave(); }} onRegen=${canWrite && !filed ? regen : null} busy=${!!busy} left=${left}
              hidden=${openS !== s} rate=${rateBar(matched(s))} carets=${carets} state=${secState(brief.sections[s.id], T(s.id), filedHere(s.id).length)} onStep=${step} />`)}
            ${src ? html`<div class="den-sec" data-section=${src.id} hidden=${!onSrc}><div class="den-eyebrow"><span>Built, not written</span><span class="den-spacer"></span><button class="den-mini quiet" onClick=${() => step(-1)}>Previous</button></div>
              <h4>${src.title}<span class="den-chip" title="Built from the rows the brief cites. It is never written by a model and cannot be edited: change what is cited instead.">built from the citations</span></h4>
              ${brief.sourceList.length ? brief.sourceList.map(g => html`<div key=${g.group}><div class="den-mono den-grouph">${g.group}</div><ol class="den-ev">${g.items.map(i => html`<li key=${i.id}>${i.label}${web(i.url) ? html` - <a class="den-link" href=${web(i.url)} target="_blank" rel="noopener">${i.url}</a>` : null}</li>`)}</ol></div>`) : html`<span class="den-mono">Nothing is cited yet, so there is nothing to list.</span>`}</div>` : null}
          </div></div>
          <aside class="den-evpane" aria-label="Evidence for this section">
            ${onSrc ? html`<div class="den-evhead"><b>Source List</b><p>Built from every row the brief cites, in the report's own groups. Cite a row in a section and it appears here; nothing is typed into it.</p></div>` : html`<div class="den-evin">
            <div class="den-evhead"><b>Evidence for this section</b><span class="den-count">${here.length}</span><p>${ro ? (filed ? 'The brief is filed: reopen it to change it.' : 'Your key is read-only.') : 'Click a card to insert its citation where the cursor was. Which cards are filed here is kept on this computer.'}</p></div>
            ${here.length ? html`<ul class="den-evlist">${here.map(k => evItem(k, canWrite ? html`<button class="den-link" aria-label=${'Take it out of this section: ' + String((cardBy[k] || {}).title || k).slice(0, 80)} onClick=${() => unfileKey(k)}>Unfile</button>` : null))}</ul>`
              : html`<p class="den-quiet">No card is filed under this section on this computer. File one on the Board, or pull one from the window below.</p>`}
            ${elsewhere.length ? html`<div class="den-evsub">Cited here, filed elsewhere</div><ul class="den-evlist">${elsewhere.map(id => { const k = keyOfCite(id); const f = filing[k]; return evItem(k, html`<span class="den-mono">${f ? 'filed under ' + ((others.find(s => s.id === f) || {}).title || f) : 'not filed'}</span>`); })}</ul>` : null}
            ${unHere.length ? html`<div class="den-evsub warn">Checks this section does not cover</div><ul class="den-evlist">${unHere.map(s => html`<li key=${s.key} class="den-uncheck"><span class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]}>${(SIG[s.sig] || [s.sig])[0]}</span><span class="den-t">${s.title}</span><span class="den-sub">${s.detail}</span></li>`)}</ul>` : null}
            <div class="den-pull"><button class="den-fold" aria-expanded=${pull ? 'true' : 'false'} onClick=${() => setPull(!pull)}>Pull from the rest of the window${pullList ? html` <span class="den-count">${pullList.length}</span>` : null}</button>
              ${!pull ? null : !pullList ? html`<p class="den-quiet">The window's rows are read with the Board. <button class="den-link" onClick=${() => setTab('today')}>Open the Board</button></p>`
                : pullList.length ? html`<ul class="den-pulllist">${pullList.slice(0, 80).map(c => html`<li key=${c.key}><span class="den-w">${c.w.score}</span><span class="den-pull-t"><span class="den-t">${c.title}</span><span class="den-sub">${cardSub(c)}</span></span>
                  <button class="den-mini row" disabled=${!canWrite} aria-label=${'File here: ' + String(c.title || '').slice(0, 80)} title=${c.pin ? 'Pins it to the report and files it under this section' : 'Files it under this section on this computer'} onClick=${() => fileHere(c)}>File here</button></li>`)}</ul>`
                : html`<p class="den-quiet">Every card of the window is filed under a section.</p>`}</div></div>`}
          </aside>
          ${hist || cmp ? html`<aside class="den-drawer" aria-label="History and comparison">
        ${hist ? html`<${Panel} title="History" note="The last sixty saves" flush=${true} actions=${html`<button class="den-mini quiet" aria-label="Close the history" onClick=${() => setHist(null)}>Close</button>`}>${hist.length ? html`<table class="den-table"><thead><tr><th class="num">Revision</th><th>What</th><th>By</th><th>When</th></tr></thead><tbody>${hist.map((h, i) => html`<tr key=${i}><td class="num">${h.revision}</td><td>${h.note}</td><td>${h.by}</td><td class="den-mono">${aest(h.at)}</td></tr>`)}</tbody></table>` : html`<${Empty}>No save is recorded yet.<//>`}<//>` : null}
        ${cmp ? html`<${Panel} title="Against the last filed brief" note=${cmp.none ? '' : cmp.day + ', filed by ' + cmp.filed_by} actions=${html`<button class="den-mini quiet" aria-label="Close the comparison" onClick=${() => setCmp(null)}>Close</button>`}>${cmp.none ? html`<${Empty}>No brief was filed on this desk before this one, so there is nothing to compare with.<//>`
          : others.map(s => html`<div key=${s.id} class="den-cmp den-diff"><h4>${s.title}</h4><p>${diffWords((cmp.sections[s.id] || {}).text, (brief.sections[s.id] || {}).text).map((p, i) => p.t === 'ins' ? html`<ins key=${i}>${p.s}</ins>` : p.t === 'del' ? html`<del key=${i}>${p.s}</del>` : p.s)}</p></div>`)}<//>` : null}
      </aside>` : null}
        </div>
        <div class="den-foot">
          <div class="den-bar" role="status" aria-live="polite">
            <span class=${'den-save ' + (save.s === 'bad' ? 'bad' : dirty ? 'dirty' : save.s === 'saved' ? 'ok' : '')}>${save.s === 'saving' ? 'Saving...' : save.s === 'bad' ? 'Not saved: ' + save.msg + ' Your words are kept on this computer.' : dirty ? 'Unsaved changes (kept on this computer)' + (save.msg ? '. ' + save.msg : '') : save.s === 'saved' ? 'Saved, ' + save.msg : filed ? 'Filed: reopen it to change it' : 'Saved'}</span>
            <span class="den-mono">${fmtN(total)} words</span>
            ${flags ? html`<span class="den-chip warn" title="Sentences that rest on no evidence row. Each is marked where it stands, under As it reads.">${flags} without evidence</span>` : null}
            ${uncAll ? html`<span class=${'den-chip ' + (uncAll.length ? 'neg' : 'pos')} title=${uncAll.map(s => s.title).join('; ')}>${uncAll.length ? plural(uncAll.length, 'check') + ' uncovered' : 'all checks covered'}</span>` : null}
          </div>
          <div class="den-foot-act">
            <button class="den-mini quiet" aria-expanded=${hist ? 'true' : 'false'} onClick=${loadHist}>History</button><button class="den-mini quiet" aria-expanded=${cmp ? 'true' : 'false'} aria-label="Compare with the last filed brief" title="Compare with the last filed brief" onClick=${compare}>Compare</button>
            <span class="den-menu"><button class="den-mini" aria-expanded=${menu ? 'true' : 'false'} onClick=${() => setMenu(!menu)}>Export</button>
              ${menu ? html`<div class="den-menu-list" role="group" aria-label="Take it out"><span class="den-mono">Take it out${dirty ? ' (of the saved brief: save first to include your edits)' : ''}</span><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('rich'); }}>Copy for the document</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('md'); }}>Download .md</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('html'); }}>Download .html</button><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('slack'); }}>Copy the Slack summary</button></div>` : null}</span>
            ${canWrite && !filed ? html`<button class="den-mini" disabled=${!!busy || !left || dirty} title=${dirty ? 'Save your edits first' : cost} onClick=${() => { if (Object.keys(brief.sections).some(k => brief.sections[k].edited)) setAsk({ redraft: true }); else draft(true); }}>${busy === 'draft' ? 'Drafting...' : 'Draft again (1 model call)'}</button>
              <button class="den-mini" disabled=${!dirty || save.s === 'saving' || !!conflict} onClick=${() => doSave()}>Save changes</button>
              <button class="den-mini primary" disabled=${!!busy || dirty} title=${dirty ? 'Save your edits first' : 'A person files a brief: nothing files by itself'} onClick=${() => file(false)}>${busy === 'file' ? 'Checking...' : 'Mark as filed'}</button>` : null}
            ${canWrite && filed ? html`<button class="den-mini" disabled=${!!busy} onClick=${reopen}>Reopen</button>` : null}
          </div>
        </div>
      </section>
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
        ${prev ? html`<div class="den-notice den-mt"><b>In the last ${prev.days} days:</b> ${prev.matched} row${prev.matched === 1 ? '' : 's'} carry it; ${prev.already} already on this desk; it would add ${prev.new}${prev.new ? ' (' + Object.keys(prev.byChannel).map(k => prev.byChannel[k] + ' ' + (CH[k] || k)).join(', ') + '), of which ' + prev.australian + ' say something Australian' : ''}. ${prev.note}
          ${prev.sample.length ? html`<ul class="den-ev">${prev.sample.slice(0, 8).map(x => html`<li key=${x.id}>${x.australian ? '' : html`<span class="den-chip warn">not Australian</span> `}${x.text}</li>`)}</ul>` : null}</div>` : null}
        ${mode === 'approve' ? html`<div class="den-form den-mt">${p.kind === 'term' ? html`<label class="den-lab">Files under<select value=${issue} onChange=${e => setIssue(e.target.value)}>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}<option value="">no issue (searched for only)</option></select></label>` : null}
          <button class="den-mini primary" disabled=${busy} onClick=${() => decide(Object.assign({ decision: 'approve' }, p.kind === 'term' ? { issue } : {}))}>Approve</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button><span class="den-sub">${p.kind === 'term' ? 'It joins what every collector searches for and how new rows are filed. It never changes what counts as a spike.' : 'Collectors read it from the next sweep.'}</span></div>` : null}
        ${mode === 'dismiss' ? html`<div class="den-form den-mt"><label class="den-lab den-grow">Why (it is never proposed again)<input value=${why} maxlength="300" onInput=${e => setWhy(e.target.value)} /></label><button class="den-mini danger" disabled=${busy || why.trim().length < 3} onClick=${() => decide({ decision: 'dismiss', reason: why })}>Dismiss</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button></div>` : null}</td>
      <td class="num">${p.score ? Math.round(p.score) : '-'}</td>
      <td class="act">${p.kind === 'term' ? html`<button class="den-mini" disabled=${busy} aria-expanded=${prev ? 'true' : 'false'} title="What it would have caught in what is already held. Free." onClick=${preview}>Preview</button> ` : null}${canWrite && !mode ? html`<button class="den-mini" onClick=${() => setMode('approve')}>Approve</button> <button class="den-mini" onClick=${() => setMode('dismiss')}>Dismiss</button>` : null}</td></tr>`;
  }
  function WatchPanel({ desk, tick, bump, canWrite }) {
    const [kind, setKind] = useState('proposed'); const [busy, setBusy] = useState(''); const [found, setFound] = useState(null); const [del, setDel] = useState(null); const [add, setAdd] = useState({ kind: 'term', platform: 'x', value: '', name: '', actor_kind: '', issue: '' });
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
          actions=${canWrite ? html`<button class="den-mini" disabled=${busy === 'discover'} title="Reads what the archive already holds. No model call, nothing collected." onClick=${discover}>${busy === 'discover' ? 'Looking...' : 'Find new keywords now (free)'}</button><button class="den-mini" disabled=${busy === 'themes' || props.length < 4} title=${props.length < 4 ? 'With fewer than four waiting, read them as they are' : 'One model call. It changes no status.'} onClick=${themes}>${busy === 'themes' ? 'Grouping...' : 'Group into themes (1 model call)'}</button>` : null}>
          ${found ? html`<div class="den-notice ${found.filed.proposed ? 'good' : ''}" role="status">Read ${fmtN(found.rows.scanned)} rows of the last ${found.days} days (${fmtN(found.rows.desk)} on this desk). ${found.filed.proposed} new proposal${found.filed.proposed === 1 ? '' : 's'}; ${found.filed.known} already decided or waiting. ${(found.thin || []).join(' ')}</div>` : null}
          ${th ? html`<div class="den-notice" role="status"><b>Grouped ${since(th.at)}</b> by one model call; it changed nothing.<ul class="den-ev">${th.themes.map((t, i) => html`<li key=${i}><b>${t.name}</b>: ${t.why} <span class="den-mono">(${t.ids.map(id => (all.find(r => r.id === id) || {}).value).filter(Boolean).join(', ')})</span></li>`)}</ul></div>` : null}
          ${props.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>Candidate, and why</th><th class="num">Score</th><th></th></tr></thead><tbody>${props.map(p => html`<${Proposal} key=${p.id} p=${p} desk=${desk} canWrite=${canWrite} onDone=${() => { W.reload(); X.reload(); }} />`)}</tbody></table>`
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
              <td class="den-mono">${r.last_ok ? since(r.last_ok) + (r.last_layer ? ', layer ' + r.last_layer : '') : kind === 'term' || kind === 'source' ? '-' : 'not yet'}${r.last_error ? html`<span class="den-sub den-neg">${r.last_error}</span>` : null}</td>
              <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} onClick=${() => decide(r.id, r.status === 'active' ? 'off' : 'on')}>${r.status === 'active' ? 'Switch off' : 'Switch on'}</button> <button class="den-mini danger" disabled=${!!busy} aria-label=${'Delete ' + r.value} onClick=${() => setDel(r)}>Delete</button>` : null}</td></tr>`; })}</tbody></table>`
            : html`<${Empty}>This desk's register holds no ${KINDS.find(k => k[0] === kind)[1].toLowerCase()} yet.${kind === 'account' ? ' A registered account is read on its own posts; mark it as a public actor only if it is an organisation, an official or a media outlet.' : ''}<//>`}
        <//>`}
      ${canWrite ? html`<${Panel} title="Add to the register"><div class="den-form">
        <label class="den-lab">Kind<select value=${add.kind} onChange=${e => setAdd(Object.assign({}, add, { kind: e.target.value }))}><option value="term">a term</option><option value="hashtag">a hashtag</option><option value="account">an account</option><option value="group">a public Facebook group</option><option value="source">an outlet</option></select></label>
        ${add.kind === 'account' || add.kind === 'hashtag' ? html`<label class="den-lab">Channel<select value=${add.platform} onChange=${e => setAdd(Object.assign({}, add, { platform: e.target.value }))}>${(add.kind === 'hashtag' ? ['instagram', 'any'] : ['x', 'facebook', 'instagram', 'youtube', 'tiktok', 'threads', 'linkedin']).map(p => html`<option key=${p} value=${p}>${CH[p] || 'any channel'}</option>`)}</select></label>` : null}
        <label class="den-lab den-grow">${add.kind === 'term' ? 'Word or phrase' : add.kind === 'source' ? 'Site address' : add.kind === 'hashtag' ? 'Hashtag' : 'Handle or address'}<input value=${add.value} maxlength="200" onInput=${e => setAdd(Object.assign({}, add, { value: e.target.value }))} onKeyDown=${e => { if (e.key === 'Enter' && add.value.trim().length > 1) submit(); }} /></label>
        ${add.kind === 'account' ? html`<label class="den-lab">Its name<input value=${add.name} maxlength="120" onInput=${e => setAdd(Object.assign({}, add, { name: e.target.value }))} /></label><label class="den-lab">A public actor?<select value=${add.actor_kind} onChange=${e => setAdd(Object.assign({}, add, { actor_kind: e.target.value }))}><option value="">no: never named</option><option value="org">an organisation</option><option value="official">an official</option><option value="media">a media outlet</option></select></label>` : null}
        ${add.kind === 'term' ? html`<label class="den-lab">Files under<select value=${add.issue} onChange=${e => setAdd(Object.assign({}, add, { issue: e.target.value }))}><option value="">no issue (searched for only)</option>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}</select></label>` : null}
        <button class="den-mini primary" disabled=${busy === 'add' || add.value.trim().length < 2} onClick=${submit}>Add</button></div>
        ${add.kind === 'account' && /tiktok|threads|linkedin/.test(add.platform) ? html`<p class="den-mono">No collector reads ${CH[add.platform]}: an account on it is kept as a note and collects nothing.</p>` : null}<//>` : null}
      ${del ? html`<${Dialog} title="Delete from the register?" onClose=${() => setDel(null)}><p>Delete <b>${(del.kind === 'hashtag' ? '#' : '') + del.value}</b> from this desk's register? Collectors stop reading it. It can be proposed again later.</p>
        <div class="den-form"><button class="den-mini" onClick=${() => setDel(null)}>Keep it</button><button class="den-mini danger" onClick=${() => { const id = del.id; setDel(null); remove(id); }}>Delete it</button></div><//>` : null}
    </div>`;
  }

  /* ---- Collection ---- */
  function CollectionPanel({ desk, tick, bump, canWrite }) {
    const C = useLoad(() => get('/den/collection?' + q({ desk: desk.id }), 'channels'), [desk.id, tick], desk.id); const [job, setJob] = useState(null); const [busy, setBusy] = useState('');
    const collect = async ch => { setBusy(ch.id); try { const d = await call('/den/collect', { desk: desk.id, channel: ch.collect }); setJob({ ch: ch.id, id: d.id, status: d.where === 'desktop' ? 'queued' : 'running', lines: [], title: ch.label + (d.where === 'desktop' ? ' (waiting for the Mac collector)' : '') }); tailJob(d.id, j => setJob(o => Object.assign({}, o, j)), () => { C.reload(); bump('collected'); }); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const toggle = async src => { const off = (C.data.reach.off || []).slice(); const i = off.indexOf(src); if (i >= 0) off.splice(i, 1); else off.push(src); setBusy('sw'); try { await call('/den/reach', { off }); C.reload(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    if (C.loading && !C.data) return html`<${Loading} what="collection" />`;
    if (C.err && !C.data) return html`<${Failed} what="Collection" err=${C.err} onRetry=${C.reload} />`;
    const d = C.data; const live = (d.reach.agents || []).filter(a => a.live); const bt = d.backtest;
    const state = c => { const k = c.collector; if (!k) return html`<span class="den-chip pos">from the worker</span>`; if (k.off) return html`<span class="den-chip warn">switched off</span>`; if (k.challenge) return html`<span class="den-chip neg" title=${'Stopped at a verification ' + since(k.challenge.at) + '. Nothing is retried: a person signs in again on the Mac.'}>paused: verification</span>`; if (k.offered) return html`<span class="den-chip pos">a collector is connected</span>`;
      return c.worker ? html`<span class="den-chip" title="The worker's own read of this channel runs. Its signed-in read waits: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there).">from the worker only</span>` : html`<span class="den-chip warn" title="Nothing reads this channel now: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there), and the worker has no route of its own.">no collector</span>`; };
    return html`<div>
      <div class="den-notice ${live.length ? 'good' : ''}" role="status">${live.length ? live.length + ' collector' + (live.length === 1 ? ' is' : 's are') + ' connected (' + live.map(a => a.agent).join(', ') + ').' : 'No Mac collector is connected. Channels read from the worker still run; signed-in reads wait.'} ${canWrite ? '' : 'Your key is read-only: collecting and the switches need a full key.'}</div>
      <${Panel} title="Channels" note=${'What each delivered for ' + desk.name} flush=${true}>
        <table class="den-table"><thead><tr><th>Channel</th><th>How it is read</th><th>Now</th><th class="num">Last day</th><th class="num">7 days</th><th>Last delivered</th><th></th></tr></thead><tbody>
        ${d.channels.map(c => html`<${React.Fragment} key=${c.id}><tr class="den-row"><td><span class="den-t">${c.label}</span>${c.accounts != null ? html`<span class="den-sub">${c.accounts} registered account${c.accounts === 1 ? '' : 's'}</span>` : null}</td><td>${c.how}${c.cannot ? html`<span class="den-sub">Cannot reach: ${c.cannot}</span>` : null}</td><td>${state(c)}</td>
          <td class="num">${c.delivered.d1 || html`<span class="den-chip warn" title="Nothing for this desk in the last day. That is a collection fact, not a quiet day.">0</span>`}</td><td class="num">${fmtN(c.delivered.d7)}</td><td class="den-mono">${c.delivered.last ? since(c.delivered.last) : 'never'}${c.delivered.layers.length ? ' (L' + c.delivered.layers.join(', L') + ')' : ''}</td>
          <td class="act">${canWrite ? html`<button class="den-mini" disabled=${busy === c.id || (c.collector && c.collector.off)} title=${c.collector && c.collector.off ? 'Switched off below' : 'Starts one collection job. No model call.'} onClick=${() => collect(c)}>${busy === c.id ? 'Starting...' : 'Collect now'}</button>` : null}</td></tr>
          ${job && job.ch === c.id ? html`<tr class="den-jobrow"><td colSpan="7"><${Console} job=${job} title=${job.title} canWrite=${canWrite} /></td></tr>` : null}<//>`)}</tbody></table>
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
        ${canWrite ? html`<div class="den-form den-padform">
          <label class="den-lab den-grow2">Address of the page<input class="den-in" value=${f.url} maxlength="400" placeholder="https://www.aph.gov.au/..." onInput=${e => setF(Object.assign({}, f, { url: e.target.value }))} /></label>
          <label class="den-lab den-grow2">Its name, as the parliament writes it<input class="den-in" value=${f.title} maxlength="120" onInput=${e => setF(Object.assign({}, f, { title: e.target.value }))} /></label>
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
        ${canWrite ? html`<div class="den-form den-padform">
          <label class="den-lab den-grow2">Address of the campaign page<input class="den-in" value=${c.url} maxlength="400" placeholder="https://..." onInput=${e => setC(Object.assign({}, c, { url: e.target.value }))} /></label>
          <label class="den-lab den-grow2">The petition's name<input class="den-in" value=${c.name} maxlength="120" onInput=${e => setC(Object.assign({}, c, { name: e.target.value }))} /></label>
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
        <${Panel} title="Ratings" note=${desk.ratings.items.map(i => i.label).join(', ')}><div class="den-form"><label class="den-lab den-full">Levels, lowest first<input value=${f.levels} disabled=${ro} onInput=${e => set('levels', e.target.value)} /></label><label class="den-lab den-full">Trends<input value=${f.trends} disabled=${ro} onInput=${e => set('trends', e.target.value)} /></label></div><p class="den-mono">A draft may only rate in these words; anything else is left blank for a person.</p><//>
        <${Panel} title="Least interactions to show a post" note="Registered accounts and MPs always show"><div class="den-form">${['x', 'facebook', 'instagram', 'youtube', 'reddit'].map(p => html`<label key=${p} class="den-lab">${CH[p]}<input type="number" min="0" max="100000" value=${f.minEng[p] || 0} disabled=${ro} onInput=${e => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const m = Object.assign({}, f.minEng); if (v) m[p] = v; else delete m[p]; set('minEng', m); }} /></label>`)}</div><//>
      </div>
      <${Panel} title="Mutes" note="Hidden on this desk only" flush=${true}>${desk.options.mutes.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>What</th><th>By</th><th></th></tr></thead><tbody>${desk.options.mutes.map((m, i) => html`<tr key=${i}><td>${m.kind}</td><td>${m.value}</td><td class="den-mono">${m.by} ${since(m.at)}</td><td class="act">${ro ? null : html`<button class="den-mini" aria-label=${'Remove the mute on ' + m.value} onClick=${() => unmute(m)}>Remove</button>`}</td></tr>`)}</tbody></table>` : html`<${Empty}>Nothing is muted. After three set-asides of the same account, site or term, the board offers a mute.<//>`}<//>
      ${ro ? null : html`<${Panel} title="Another desk for this client" note="A second region, or a second analyst's own desk, with this desk's sections and rating words"><div class="den-form">
        <label class="den-lab den-grow">Its name<input value=${nd.name} maxlength="60" placeholder=${desk.client + ' Queensland'} aria-label="The new desk's name" onInput=${e => setNd(Object.assign({}, nd, { name: e.target.value }))} /></label>
        <label class="den-lab">Region<select value=${nd.region} aria-label="The new desk's region" onChange=${e => setNd(Object.assign({}, nd, { region: e.target.value }))}>${['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'].map(r => html`<option key=${r} value=${r}>${r === 'au' ? 'National' : r.toUpperCase()}</option>`)}</select></label>
        <button class="den-mini" disabled=${busy || nd.name.trim().length < 3} onClick=${create}>Add the desk</button></div><//>`}
      ${ro ? null : html`<div class="den-bar den-optbar"><button class="den-mini primary" disabled=${busy || !dirty} onClick=${save}>${busy ? 'Saving...' : 'Save options'}</button><button class="den-mini" disabled=${busy || !dirty} onClick=${() => setF(init())}>Undo changes</button><span class=${'den-save' + (dirty ? ' dirty' : '')}>${dirty ? 'Not saved' : 'Saved, revision ' + desk.revision}</span></div>`}
    </div>`;
  }

  function Shortcuts({ onClose }) {
    const K = [['j / k', 'Next and previous card on the Board'], ['p', 'Pin the row to the report'], ['x', 'Set the row aside'], ['o or Enter', 'Open the row\'s source'], ['1 to 9, 0', 'File the focused card under that section'], ['/', 'Search the unsorted cards'], ['Alt + 1 to 5', 'Board, Brief, Watch, Collection, Options'], ['Ctrl or Cmd + S', 'Save the brief'], ['?', 'This sheet'], ['Esc', 'Close a dialog or a check']];
    return html`<${Dialog} title="Keyboard" onClose=${onClose}><table class="den-table"><tbody>${K.map(k => html`<tr key=${k[0]}><td><span class="den-kbd">${k[0]}</span></td><td>${k[1]}</td></tr>`)}</tbody></table><div class="den-form den-mt"><button class="den-mini" onClick=${onClose}>Close</button></div><//>`;
  }
  const backToAxiom = () => { if (typeof window.go === 'function') window.go('command'); else if (window.AXUI.goto) window.AXUI.goto('command', {}); };
  /* The Den's own top bar. It is drawn even when no desk could be read, so the way back is never lost. */
  function TopBar({ children }) { return html`<header class="den-top den-head"><button class="den-back" onClick=${backToAxiom}><span aria-hidden="true">${'\u2039'}</span> Back to AXIOM</button><span class="den-brand">Anne's Den</span>${children || null}</header>`; }

  function DenApp() {
    const D = useLoad(() => get('/den/desks', 'desks'), [], 'desks'); const [deskId, setDeskId] = useState(() => ls.get('ax_den_desk', '')); const [tab, setTabRaw] = useState(() => ls.get('ax_den_tab', 'today')); const [tick, setTick] = useState(0); const [keys, setKeys] = useState(false);
    const [budget, setBudget] = useState(null); const [, setRole] = useState(window.AX_ROLE); const [boardStrip, setBoardStrip] = useState(null);
    // what the Board read, the checks and the brief as it stands are held here, so the Brief tab shows the same evidence
    // without a second read of the window and the Board's columns show the brief
    const [board, setBoard] = useState(null); const [sigs, setSigs] = useState(null); const [bst, setBst] = useState({ id: '', brief: null, texts: null }); const [secs, setSecs] = useState({}); const [fst, setFst] = useState({ k: '', m: {} });
    // the worker says what this key may do a moment after the page opens: the controls follow it
    useEffect(() => { const f = () => setRole(window.AX_ROLE); window.addEventListener('ax:role', f); return () => window.removeEventListener('ax:role', f); }, []);
    const canWrite = canWriteNow();
    const setTab = t => { if (TABS.some(x => x[0] === t)) { setTabRaw(t); ls.set('ax_den_tab', t); } };
    const desks = (D.data && D.data.desks) || []; const desk = desks.find(d => d.id === deskId) || desks[0] || null;
    useEffect(() => { if (D.data) setBudget(D.data.budget); }, [D.data]);
    useEffect(() => { if (desk && desk.id !== deskId) setDeskId(desk.id); }, [desk && desk.id]);   // eslint-disable-line
    useGoto('den', p => { if (p && p.desk) { setDeskId(String(p.desk)); ls.set('ax_den_desk', String(p.desk)); } if (p && p.tab) setTab(String(p.tab)); });
    const bump = what => { if (what === 'budget' || what === 'desk') call('/den/desks').then(d => { setBudget(d.budget); if (what === 'desk') D.set(d); }, () => {}); if (what === 'collected' || what === 'marks' || what === 'filed') setTick(t => t + 1); };
    useEffect(() => { const key = e => { const root = document.getElementById('v-den'); if (!root || !root.classList.contains('on') && getComputedStyle(root).display === 'none') return; if (e.altKey && /^Digit[1-5]$/.test(e.code)) { e.preventDefault(); setTab(TABS[+e.code.slice(5) - 1][0]); } if (e.key === '?' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target || {}).tagName || '')) setKeys(true); };
      window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);   // eslint-disable-line
    const did = desk ? desk.id : ''; const mine = board && board.id === did ? board.d : null; const mySigs = mine && mine.missed && Array.isArray(mine.missed.signals) ? mine.missed.signals : (sigs && sigs.id === did ? sigs.s : null);
    const cards = useMemo(() => (mine ? deck(mine, mySigs || []) : null), [mine, mySigs]);
    if (D.loading && !D.data) return html`<div id="den-shell"><${TopBar} /><${Loading} what="the desks" /></div>`;
    if (D.err && !D.data) return html`<div id="den-shell"><${TopBar} /><${Failed} what="The desks" err=${D.err} onRetry=${D.reload} /></div>`;
    if (!desk) return html`<div id="den-shell"><${TopBar} /><${Empty}><b>No desk is set up.</b> A desk is a client, a region and a report format. Ask an admin to add one.<//></div>`;
    const pickDesk = id => { setDeskId(id); ls.set('ax_den_desk', id); setTick(t => t + 1); };
    /* Which section a card is filed under: this browser's own note for this desk and this Sydney day. The worker holds
       the pin (so a draft covers the row); it is not asked to hold where the card sits. */
    const fkey = 'ax_den_file_' + desk.id + '_' + sydDay(); const filing = fst.k === fkey ? fst.m : (ls.get(fkey, {}) || {});
    const setFiling = m => { setFst({ k: fkey, m }); if (Object.keys(m).length) ls.set(fkey, m); else ls.del(fkey); };
    const openSec = secs[desk.id] !== undefined ? secs[desk.id] : ls.get('ax_den_sec_' + desk.id, ''); const setOpenSec = id => { setSecs(o => Object.assign({}, o, { [desk.id]: id })); ls.set('ax_den_sec_' + desk.id, id); };
    const cov = bst.id === desk.id ? bst : { brief: null, texts: null };
    return html`<div data-density=${desk.options.density || 'regular'} id="den-app">
      <${TopBar}>
        <label class="den-desk"><span class="den-sr">Desk</span><select value=${desk.id} aria-label="Desk" onChange=${e => pickDesk(e.target.value)}>${desks.map(d => html`<option key=${d.id} value=${d.id}>${d.name}</option>`)}</select></label>
        <span class="den-where"><b class="den-day">${fmtDay.format(new Date())}</b><span class="den-win">${desk.name} - ${desk.cadence}, the last ${desk.window_h} hours${desk.region !== 'au' ? ', ' + desk.region.toUpperCase() + ' only' : ''} - Australian Eastern time</span></span>
        <span class="den-spacer"></span>
        ${budget ? html`<span class="den-budget" title="A brief draft or one section written again is one model call, started by a person. Nothing else on this page spends.">model calls today: <b>${budget.used} of ${budget.cap}</b></span>` : null}
        ${canWrite ? null : html`<span class="den-chip warn">read-only key</span>`}
        <button class="den-mini quiet" onClick=${() => setTick(t => t + 1)} title="Read the archive again">Refresh</button><button class="den-mini quiet den-keys" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick=${() => setKeys(true)}>?</button>
      <//>
      <div class="den-rail">
        <div class="den-tabs" role="tablist" aria-label="Anne's Den">${TABS.map(t => html`<button key=${t[0]} role="tab" id=${'den-tab-' + t[0]} class="den-tab" aria-selected=${tab === t[0] ? 'true' : 'false'} aria-controls="den-tabpanel" onClick=${() => setTab(t[0])}>${t[1]}</button>`)}</div>
        <${Boundary} name="The checks" resetKey=${desk.id + tick}><${Strip} deskId=${desk.id} setTab=${setTab} tick=${tick} handed=${tab === 'today' ? (boardStrip || STRIP_PENDING) : undefined} onSignals=${s => setSigs(s ? { id: desk.id, s } : null)} cov=${cov} /><//>
      </div>
      <div role="tabpanel" id="den-tabpanel" class=${'tab-' + tab} aria-labelledby=${'den-tab-' + tab} tabIndex=${tab === 'today' || tab === 'brief' ? null : '0'}>
        <${Boundary} name=${TABS.find(t => t[0] === tab)[1]} resetKey=${desk.id + tab}>
          ${tab === 'today' ? html`<${Board} desk=${desk} tick=${tick} bump=${bump} setTab=${setTab} canWrite=${canWrite} onStrip=${setBoardStrip} onBoard=${d => setBoard(d ? { id: desk.id, d } : null)} bst=${cov} filing=${filing} setFiling=${setFiling} onWrite=${id => { setOpenSec(id); setTab('brief'); }} />` : null}
          <div class="den-briefhost" hidden=${tab !== 'brief'}><${Boundary} name="Brief" resetKey=${desk.id}><${BriefPanel} key=${desk.id} desk=${desk} tick=${tick} bump=${bump} budget=${budget} canWrite=${canWrite} setTab=${setTab} cards=${cards} signals=${mySigs} filing=${filing} setFiling=${setFiling} openSec=${openSec} setOpenSec=${setOpenSec} onState=${s => setBst(Object.assign({ id: desk.id }, s))} /><//></div>
          ${tab === 'watch' ? html`<div class="den-page"><${WatchPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} /></div>` : null}
          ${tab === 'collection' ? html`<div class="den-page"><${CollectionPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} /></div>` : null}
          ${tab === 'options' ? html`<div class="den-page"><${OptionsPanel} desk=${desk} canWrite=${canWrite} onSaved=${d => D.set(Object.assign({}, D.data, { desks: desks.map(x => (x.id === d.id ? d : x)) }))} onCreated=${d => { D.set(Object.assign({}, D.data, { desks: desks.concat([d]) })); pickDesk(d.id); toastMsg(d.name + ' is ready'); }} /></div>` : null}
        <//>
      </div>
      ${keys ? html`<${Shortcuts} onClose=${() => setKeys(false)} />` : null}
    </div>`;
  }

  let mounted = false;
  window.denInit = function () {
    const root = document.getElementById('den-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${DenApp} />`); }
  };
})();
