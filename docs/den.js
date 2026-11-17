/* AXIOM - Anne's Den. The monitoring analyst's workspace: one desk at a time (a client, a region, a report format).
 * The Storyboard (13 November 2026): opening the Den sets body.in-den and it takes the whole window, with its own top bar
 * and a rail of tabs and the six checks. The Board is the window's evidence as cards, Unsorted and one column for each
 * section of the report; Brief is the report, drafted from that evidence by one stated model call or written by hand,
 * one section open at a time between its outline and the evidence filed under it, checked against the rows it cites;
 * Watch is the register and the proposals that wait for a person; Collection says which channels read and why not;
 * Options are the desk's own. Which section a story or post is filed under rides on its pin in the worker (build p66), so
 * every browser on the desk shows the same columns; a narrative or a date, which the worker does not pin, is filed on
 * this computer only (localStorage). The top bar carries a day picker (today unless another day is picked; the Board and
 * the Brief then read that day, and nothing drafts for it) and a meter of the day's model calls. A React island (React,
 * ReactDOM and htm vendored under docs/vendor; shared pieces from docs/ax-ui.js) mounted into #den-root on first open.
 * Nothing here spends without a button that states the cost. */
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
  // a collection gap ('gap') is the Collection tab's alone (owner, 16 November 2026): only Collection names one, and in its own words
  const SIG = { gap: ['Not delivering', 'warn'], spike: ['Spike', 'neg'], emerging: ['Emerging', 'acc'], outlier: ['Unusual reach', 'acc'], first_seen: ['First seen', ''], burst: ['Above baseline', 'warn'] };
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
  /* On the Board the skeleton is shaped like the columns that will arrive (Unsorted, then sections), so nothing jumps. */
  const Loading = ({ what, board }) => html`<div class=${'den-state den-loading' + (board ? ' board' : '')} role="status"><span class="den-loadtxt">Loading ${what || ''}...</span><span class="den-skel" aria-hidden="true"></span><span class="den-skel s2" aria-hidden="true"></span><span class="den-skel s3" aria-hidden="true"></span>${board ? html`<span class="den-skelcols" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => html`<span key=${i} class=${'den-skelcol' + (i ? '' : ' wide')}><i></i><i></i><i></i></span>`)}</span>` : null}</div>`;
  const Failed = ({ what, err, onRetry }) => html`<div class="den-state err" role="alert"><span class="den-errtext"><b>${what} could not be loaded.</b> ${err}</span> ${onRetry ? html`<button class="den-mini" onClick=${onRetry}>Try again</button>` : null}</div>`;
  const Empty = ({ children, tour }) => html`<div class="den-state" data-tour=${tour || null}>${children}</div>`;
  /* A failure in one panel never blanks the page. */
  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { err: null }; }
    static getDerivedStateFromError(err) { return { err }; }
    componentDidUpdate(prev) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
    render() { return this.state.err ? html`<div class="den-state err" role="alert"><b>${this.props.name} stopped working.</b> The rest of the page is unaffected. ${String(this.state.err.message || this.state.err).slice(0, 160)} <button class="den-mini" onClick=${() => this.setState({ err: null })}>Try again</button></div>` : this.props.children; }
  }
  function Panel({ title, note, actions, flush, children, id, tour }) {
    return html`<section class="den-panel" id=${id} aria-label=${title} data-tour=${tour || null}><header><h3>${title}</h3>${note ? html`<span class="den-note">${note}</span>` : null}<span class="den-spacer"></span>${actions || null}</header><div class=${'den-body' + (flush ? ' flush' : '')}>${children}</div></section>`;
  }
  function Dialog({ title, onClose, children, tour }) {
    const ref = useRef(null);
    useEffect(() => { const prev = document.activeElement; const el = ref.current; if (el) { const f = el.querySelector('button, input, select, textarea, a[href]'); (f || el).focus(); }
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } if (e.key === 'Tab' && el) { const fs = Array.from(el.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]')); if (!fs.length) return; const a = fs[0], z = fs[fs.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } } };
      document.addEventListener('keydown', key, true); return () => { document.removeEventListener('keydown', key, true); if (prev && prev.focus) prev.focus(); }; }, []);   // eslint-disable-line
    return html`<div class="den-dialog" onMouseDown=${e => { if (e.target === e.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label=${title} data-tour=${tour || null} ref=${ref} tabIndex="-1"><h3>${title}</h3>${children}</div></div>`;
  }
  const engText = e => (e ? [['likes', 'like'], ['comments', 'comment'], ['shares', 'share'], ['reposts', 'repost'], ['quotes', 'quote'], ['replies', 'reply'], ['views', 'view']].filter(k => +e[k[0]] > 0).map(k => fmtN(e[k[0]]) + ' ' + (+e[k[0]] === 1 ? k[1] : k[0])).join(', ') : '');
  /* A post card's count, said as the evidence line the draft is written from says it (worker p71): its interactions; its
     views when they are its only count; "no interactions" for a post counted at nothing ({ likes: 0 }); "engagement not
     recorded" only for one with no count at all, the line's own words since its rename (EV5; review C6: the card still
     said "no counts held"). The card said "no counts held" for the first two while the line said otherwise.
     p71 fx3 (G1, the line's rule since D3): "no interactions" only when a like count and a comment (or reply) count were
     both read. A read lacking one says each count it read at nought, then the main ones not recorded ("0 comments, likes
     not recorded": an Instagram account that hides its likes), as the line does; the card said "no interactions" for it.
     The counts go in the line's order (engK), in the tooltip too, so a card never lists a post's counts another way. */
  const engK = ['likes', 'comments', 'shares', 'reposts', 'quotes', 'replies', 'views'];
  const engCounted = (e, ks) => !!e && typeof e === 'object' && (ks || engK).some(k => e[k] != null && e[k] !== '' && isFinite(+e[k]));
  const engMiss = e => [['likes'], ['comments', 'replies']].filter(ks => !engCounted(e, ks)).map(ks => ks[0]);
  const engSay = r => { const t = +r.total || 0, e = r.eng && typeof r.eng === 'object' ? r.eng : null, v = e ? +e.views || 0 : 0, m = engMiss(e); return t ? fmtN(t) + (t === 1 ? ' interaction' : ' interactions') : v > 0 ? fmtN(v) + (v === 1 ? ' view' : ' views') : !engCounted(e) ? 'engagement not recorded' : m.length ? engK.filter(k => engCounted(e, [k])).map(k => '0 ' + k).concat(m.join(' and ') + ' not recorded').join(', ') : 'no interactions'; };
  const engTip = r => { const m = engMiss(r.eng); return engText(r.eng) || (+r.total ? engSay(r) + ' in all' : !engCounted(r.eng) ? 'Its engagement was not recorded' : m.length ? 'Its ' + m.join(' and ') + ' were not recorded, and every count read is zero' : 'Its counts were read, and all are zero'); };
  /* p71 fx3 (G2, beside the count): the tone of the comments read under a post in its line's words and on its line's
     bounds (the worker's denToneWord). The chip said "hostile", "warm" or "mixed" on bounds of its own, so comments the
     line called "mostly negative" read "hostile" on their card (a mean of -0.3), or "mixed" (-0.17) */
  const toneWord = m => { m = +m || 0; return m <= -0.5 ? 'strongly negative' : m <= -0.15 ? 'mostly negative' : m < 0.15 ? 'mixed' : m < 0.5 ? 'mostly positive' : 'strongly positive'; };
  /* p71 fx5 (R1): a tone rests only on the comments that carry one (toned), and the worker gives none resting on fewer than
     three. The count says how many carry one when not all do, and the chip's title whose tone it is, so the count and the
     chip read as the line does ("10 comments read (6 with a tone reading), mostly negative"); the title said "the 10
     comments read" of a tone one comment of the ten carried. A worker before p71 fx5 sends no toned: all of them, as then */
  const heldSay = h => plural(h.n, 'comment') + ' read' + (h.tone != null && h.toned < h.n ? ' (' + h.toned + ' with a tone reading)' : '');
  const heldTip = h => 'The tone of the ' + (h.toned < h.n ? h.toned + ' of the ' : '') + plural(h.n, 'comment') + ' read under it' + (h.toned < h.n ? ' that have a tone reading' : '');
  /* A story dated by the day in its address (worker p71, CO7: urlDated, it came with no date) has no time of its own: its
     card says the day, in the evidence line's words (review C8: the card printed a clock time it never had). p71 fx3
     (G3): so does a stale one, its address dated more than a day before the window opened: its line prints that day,
     before this window, whatever time its feed gave it, and its card printed the feed's time. addrDated is the line's
     test (stale or urlDated), for every place the page dates a story.
     p71 fx5 (R2): the day as the line writes it (the worker's urlDay: "12 nov", "5 sep"; Intl wrote "12 Nov", "5 Sept",
     "June"), with its year when that is not the window's (yr, the window's year: "4 mar 2019"); neither showed a year */
  const fmtDayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' });
  const MON3 = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const addrDated = r => !!(r && (r.urlDated || r.stale));
  const addrDay = (r, yr) => { const d = /^\d{4}-\d\d-\d\d$/.test(String(r.urlDate || '')) ? r.urlDate : fmtDayKey.format(new Date(+r.ts || Date.now())); const y = /^\d{4}$/.test(String(yr || '')) ? String(yr) : fmtDayKey.format(new Date()).slice(0, 4); return +d.slice(8, 10) + ' ' + MON3[+d.slice(5, 7) - 1] + (d.slice(0, 4) !== y ? ' ' + d.slice(0, 4) : '') + (r.stale ? ' (the date in its address, before this window)' : ' (the date in its address)'); };
  /* Where a signal's or a row's evidence opens: a view of AXIOM, a tab of the Den, or the post itself. */
  /* What a person just did, said to anything listening (the guided tour, docs/den-tour.js): window event 'den:did' with
     { what, ... } after a write or a step succeeds. Nothing in the Den listens to it; it changes nothing by itself. */
  const tell = (what, d) => { try { window.dispatchEvent(new CustomEvent('den:did', { detail: Object.assign({ what }, d || {}) })); } catch (e) {} };
  /* Icons sit beside the words, never instead of them: a control's name is its words (the tests find buttons by name).
     The glyphs are the ones the owner chose in design/prototypes/annes-den-concepts/concept-a.js. Each is hidden from a
     screen reader and never takes the focus; its size and stroke are attributes, so it draws right before den.css styles
     .den-ic, and den.css can override them. */
  const ICONS = {
    back: 'M15 6l-6 6 6 6', chev: 'M6 9l6 6 6-6', right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6',
    pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v5', x: 'M6 6l12 12M18 6L6 18',
    aside: 'M4 7h16M6 7v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M9 4h6M10 11l4 4M14 11l-4 4',
    open: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5',
    check: 'M5 12.5l4.5 4.5L19 7.5', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.3',
    spike: 'M3 17l5-5 4 3 8-9M15 6h5v5', emerging: 'M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
    first_seen: 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M18 7v6M15 10h6',
    outlier: 'M13 3L5 14h6l-1 7 8-11h-6l1-7z', burst: 'M5 20V10M12 20V4M19 20v-7',
    search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.9-3.9', undo: 'M9 6L4 11l5 5M4 11h10a5 5 0 0 1 0 10h-3',
    pen: 'M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14 7l3 3',
    refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5',
    file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 14.5l2.2 2.2L15.5 12',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14', copy: 'M9 9h10v11H9zM5 15V4h10',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5V12l3 2',
    media: 'M5 5h11v14H6a1 1 0 0 1-1-1V5zM16 9h3v8a2 2 0 0 1-2 2M8 9h5M8 12.5h5M8 16h3',
    social: 'M5 5h14v10H10l-4 4v-4H5z', actor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6',
    narrative: 'M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0', upcoming: 'M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7',
    lock: 'M7 11h10v9H7zM9 11V8a3 3 0 0 1 6 0v3', plus: 'M12 5v14M5 12h14',
    history: 'M4 12a8 8 0 1 0 2.6-5.9L4 8.5M4 4v4.5h4.5M12 8v4.5l3 1.5',
    keys: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    play: 'M7 5l12 7-12 7z', quote: 'M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6',
    info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.01',
    mute: 'M4 10v4h3l5 4V6L7 10H4zM16 9.5l5 5M21 9.5l-5 5', send: 'M4 12l16-8-6 16-3-7-7-1z',
    board: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v12h-4z', sliders: 'M5 7h9M18 7h1M5 17h3M12 17h7M14 5v4M8 15v4',
    radar: 'M12 3a9 9 0 1 0 9 9M12 8a4 4 0 1 0 4 4M12 12l7-7', swatch: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
    guide: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15.5 8.5l-2 5-5 2 2-5 5-2z'
  };
  const Ic = (n, cls) => html`<svg class=${'den-ic' + (cls ? ' ' + cls : '')} viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d=${ICONS[n] || ICONS.info} /></svg>`;
  function openEvidence(o, setTab) { if (!o) return; if (o.tab) return setTab(o.tab); if (o.view && window.AXUI.goto) return window.AXUI.goto(o.view, o.params || {}); if (o.url && /^https?:/.test(o.url)) window.open(o.url, '_blank', 'noopener'); }


  /* ---- The window's rows as cards (the Storyboard) ----
     Everything here is worked out in the page from what GET /den/board already answers: no route was added. */
  const KINDS_ROW = [['media', 'News'], ['social', 'Posts'], ['actors', 'Actors'], ['narratives', 'Narratives'], ['upcoming', 'Upcoming']];
  const fbTotal = fb => (fb ? (+fb.reactions || 0) + (+fb.comments || 0) + (+fb.shares || 0) : 0);
  const sydDay = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (e) { return new Date().toISOString().slice(0, 10); } };
  /* The last moment of a Sydney day, as the worker's `to`: what the day picker sends so the Board and the Brief read the
     window that ended with that day. The offset is read at noon of the day, so a clock change at 2 or 3 am cannot move it. */
  const sydOffset = ms => { try { const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'Australia/Sydney', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; }); return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000; } catch (e) { return 10 * 3600000; } };
  const dayEnd = day => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(day || '')); if (!m) return 0; const noon = Date.UTC(+m[1], +m[2] - 1, +m[3], 12); return Date.UTC(+m[1], +m[2] - 1, +m[3], 23, 59, 59, 999) - sydOffset(noon); };
  const dayWords = day => { try { return fmtDay.format(new Date(day + 'T12:00:00Z')); } catch (e) { return day; } };
  const BUDGET_T = 'A brief draft or one section written again is one model call, started by a person. Nothing else on this page spends.';
  const wc = t => (String(t || '').replace(/\[[A-Z]:[^\]]+\]/g, ' ').match(/\S+/g) || []).length;
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  /* One card for each row of the board's five lists. `key` is how the page knows the card (and what a filing is kept
     under); `cite` is the id a brief cites it by; `pin` says whether the worker can pin it (an archive row can, a
     narrative or a date cannot). A date's key names its row (or the parliament's record it was read from) beside its day
     and event (review C7, CK3): eight towns' vigils on one day were one key, so the page kept one card of eight. Since the
     third review (K1) it names the worker's fold instead of the row where the worker gives one: the row that speaks for a
     standing vigil changes when a newer story tells it, and the key with it, so a date filed on this computer fell back to
     Unsorted. The fold (the entry's days and the names of its earliest telling) stays; a board from before it keys by row. */
  function toCards(d) {
    const out = []; if (!d) return out;
    // p71 fx3 (G3): a stale story is dated by its address here, at midday of that day as its evidence record is, not by the
    // time its feed gave it: its weight never calls it recent, and the Brief's card never says it came hours ago
    (d.media || []).forEach(m => out.push({ key: 'M:' + m.id, cite: 'M:' + m.id, id: m.id, kind: 'media', pin: true, title: m.title, url: m.url, ts: m.stale && /^\d{4}-\d\d-\d\d$/.test(String(m.urlDate || '')) ? Date.parse(m.urlDate + 'T02:00:00Z') : m.ts, pinned: !!m.pinned, wsec: m.section || '', reach: fbTotal(m.fb), outlets: m.n || 1, growth: 0, r: m }));
    (d.social || []).forEach(s => out.push({ key: 'S:' + s.id, cite: 'S:' + s.id, id: s.id, kind: 'social', pin: true, title: s.text, url: s.url, ts: s.ts, pinned: !!s.pinned, wsec: s.section || '', reach: +s.total || 0, outlets: 1, growth: +s.growth || 0, r: s }));
    (d.actors || []).forEach(a => out.push({ key: 'P:' + a.id, cite: 'P:' + a.id, id: a.id, kind: 'actors', pin: true, title: a.text, url: a.url, ts: a.ts, pinned: !!a.pinned, wsec: a.section || '', reach: +a.total || 0, outlets: 1, growth: +a.growth || 0, r: a }));
    (d.narratives || []).forEach(n => out.push({ key: 'N:' + n.id, cite: 'N:' + n.id, id: n.id, kind: 'narratives', pin: false, title: n.label, url: '', ts: n.last, pinned: false, reach: 0, outlets: 1, growth: 0, r: n }));
    (d.upcoming || []).forEach((u, i) => out.push({ key: 'U:' + u.date + '|' + String(u.event || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '|' + (u.process ? 'p' + u.process : u.fold ? String(u.fold) : +u.item || ''), cite: 'U:' + (i + 1), label: u.date + ' ' + u.event, id: 0, kind: 'upcoming', pin: false, title: u.event, url: u.url, ts: 0, pinned: false, reach: 0, outlets: 1, growth: 0, r: u }));
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
    // p71 fx3 (G3): a story dated by its address has no time of its own; its stamp is the moment it was found or earlier,
    // so a recent stamp says only that it was found in the last six hours
    if (c.ts) { const fresh = Math.max(0, 8 - (now - c.ts) / 3600000 / 3); w += fresh; if (fresh >= 6) why.push(c.kind === 'media' && addrDated(c.r) ? 'found in the last six hours' : 'in the last six hours'); }
    return { score: Math.max(1, Math.min(99, Math.round(w))), why };
  }
  const LOW = 10;   // under this a card folds into Low weight
  const deck = (d, signals) => { const now = Date.now(); return toCards(d).map(c => Object.assign(c, { w: weigh(c, signals, now), sigs: sigsFor(c, signals) })); };
  const byWeight = (a, b) => (b.pinned - a.pinned) || (b.w.score - a.w.score) || ((b.ts || 0) - (a.ts || 0));
  /* Is a check in the brief? The rule the worker applies when a brief is filed, on the words now in the editor: the brief
     cites a row the check names, or names it in words. A collection gap is never a check (it is said on Collection only). */
  function covered(s, brief, texts) {
    if (!brief) return false; const cites = new Set(); const T = texts || {};
    const body = Object.keys(brief.sections || {}).map(k => (T[k] != null ? T[k] : (brief.sections[k] || {}).text) || '').join('\n'); (body.match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).forEach(x => cites.add(x.slice(1, -1)));
    const low = body.toLowerCase();
    return (s.cover || []).some(c => cites.has(c)) || (s.words || []).some(w => w && low.indexOf(String(w).toLowerCase()) >= 0);
  }
  const secOfKind = (secs, kinds) => { for (const k of kinds) { const s = secs.find(x => x.kind === k || x.id === k); if (s) return s.id; } return (secs[0] || {}).id || ''; };
  const KIND_SEC = { media: ['media'], social: ['social', 'developments'], actors: ['actors'], narratives: ['narratives', 'developments'], upcoming: ['developments', 'summary'] };
  /* The section a check belongs under: where the row it names is filed, else the section of that kind of row. */
  function sigSec(s, cards, filing, secs) {
    const c = (cards || []).find(x => x.sigs && x.sigs.indexOf(s) >= 0); if (c) return (filing[c.key] && secs.some(x => x.id === filing[c.key]) ? filing[c.key] : secOfKind(secs, KIND_SEC[c.kind] || []));
    return secOfKind(secs, s.sig === 'emerging' ? ['narratives', 'developments'] : s.sig === 'first_seen' || s.sig === 'outlier' ? ['actors', 'social'] : ['momentum', 'summary']);
  }
  function secState(sec, text, n) {
    // a sentence that needs a source and also holds a figure the evidence lacks is one flag, as the Brief marks it (worker p71)
    const un = sec ? (sec.uncited || []).map(u => String(u).slice(0, 200)) : []; const f = sec ? un.length + (sec.unverified || []).filter(x => un.indexOf(x && x.sentence) < 0).length + (sec.trimmed || []).length : 0;
    if (f && sec.text === text) return ['Flagged ' + f, 'warn']; if (String(text || '').trim()) return sec && sec.edited ? ['Edited', 'pos'] : ['Drafted', 'acc']; if (n) return ['Has evidence', 'info']; return ['Empty', ''];
  }
  const secKey = i => (i < 9 ? String(i + 1) : i === 9 ? '0' : '');
  /* The id a brief cites a card by, when that brief's evidence holds it. A date's id is its place in the list the draft
     was written from, so it is matched among the lines that say its day and event (review C7: every vigil of one day was
     matched to the first U: line with its label). Since the third review (K1, K3): a row's card takes the line of its own
     row when there is one (and, where both carry a fold, of its own fold: one story can tell two towns' vigils); else the
     line of its fold, the same schedule now told by a newer story (its item moved and the card read as new since the
     draft); never a recorded date's line, nor another row's. A recorded date's card takes the line of its own record, so
     two inquiries' hearings on one day stay apart. A line that names no row, fold or record (a brief stored before them)
     is matched by its label alone. */
  function citeOf(c, ev) {
    if (!ev) return ''; if (c.kind !== 'upcoming') return ev[c.cite] ? c.cite : '';
    const u = c.r || {}, it = +u.item || 0, fo = String(u.fold || ''), pr = u.process != null && u.process !== '' ? String(u.process) : '';
    const ks = Object.keys(ev).filter(k => /^U:/.test(k) && ev[k] && ev[k].label === c.label), has = (k, f) => ev[k][f] != null && ev[k][f] !== '';
    const bare = k => !(+ev[k].item) && !has(k, 'fold') && !has(k, 'process');
    if (pr) return ks.find(k => has(k, 'process') && String(ev[k].process) === pr) || ks.find(bare) || '';
    return ks.find(k => it && +ev[k].item === it && !(fo && has(k, 'fold') && String(ev[k].fold) !== fo)) || (fo && ks.find(k => String(ev[k].fold || '') === fo)) || ks.find(k => !has(k, 'item') && bare(k)) || '';
  }

  /* ---- Nothing critical missed: the five checks, as a rail of pills. A channel that delivered nothing is not a check: it
     is a collection fact, said on the Collection tab only (owner's item (a), 16 November 2026). ---- */
  const STRIP_PENDING = { data: null, loading: true, err: '', reload() {} };
  const CHECKS = [['spike', 'Spike', 'No Sentinel spike on this desk\'s issues in this window.'], ['emerging', 'Emerging', 'No narrative on this desk\'s issues became emerging in this window.'],
    ['outlier', 'Unusual reach', 'No registered account\'s post drew far more than its posts usually do.'], ['first_seen', 'First seen', 'No actor appeared on this desk for the first time in fourteen days.'], ['burst', 'Above baseline', 'No issue is running above its own fourteen-day baseline.']];
  /* On the Board the board's own answer carries the checks (one read of the window, not two). The rail asks for itself on
     the other tabs, and on the Board only when the board came back without them: the board failed, or took too long to say. */
  function Strip({ deskId, to, setTab, tick, handed, onSignals, cov }) {
    const [late, setLate] = useState(false); const waiting = !!(handed && handed.loading && !handed.data);
    useEffect(() => { setLate(false); if (!waiting) return; const t = setTimeout(() => setLate(true), 20000); return () => clearTimeout(t); }, [waiting, deskId, tick, to]);
    const need = !handed || late || (!handed.loading && !handed.data);
    const self = useLoad(() => (need ? get('/den/missed?' + q({ desk: deskId, to }), 'signals') : Promise.resolve(null)), [deskId, tick, need, to], deskId + '|' + to);
    const m = need ? self : handed; const [open, setOpen] = useState(''); const box = useRef(null);
    useEffect(() => { if (onSignals) onSignals(m.data ? (m.data.signals || []) : (m.err && !m.loading ? false : null)); }, [m.data, m.err, m.loading]);   // eslint-disable-line
    useEffect(() => { if (!open) return; const out = e => { if (box.current && !box.current.contains(e.target)) setOpen(''); };
      const key = e => { if (e.key === 'Escape') { const b = box.current && box.current.querySelector('.den-check.open'); setOpen(''); if (b) b.focus(); } };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [open]);
    useEffect(() => { setOpen(''); }, [deskId]);
    const head = html`<h3 class="den-sr">Nothing critical missed</h3>`;
    if (!m.data && !m.err) return html`<section class="den-strip" data-tour="strip" aria-label="Nothing critical missed">${head}<${Loading} what="the checks" /></section>`;
    if (m.err && !m.data) return html`<section class="den-strip" data-tour="strip" aria-label="Nothing critical missed">${head}<${Failed} what="The checks" err=${m.err} onRetry=${m.reload} /></section>`;
    // the raw list went up to the Den above (the Collection tab reads its gaps from it); the rail shows the checks only
    const s = (m.data.signals || []).filter(x => x && x.sig !== 'gap'); const hasBrief = !!(cov && cov.brief); const isCov = x => hasBrief && covered(x, cov.brief, cov.texts);
    // once the brief is filed, a check it does not hold was acknowledged at filing (or arrived after it): said plainly, never as a warning
    const filed = hasBrief && cov.brief.status === 'filed'; const ackd = new Set(filed ? (cov.brief.acknowledged || []).map(a => (a && typeof a === 'object' ? a.key : a)) : []);
    const unWords = (n, l) => { if (!filed) return n + ' not in the brief'; const a = l.filter(x => !isCov(x) && ackd.has(x.key)).length; return [a ? a + ' acknowledged at filing' : '', n - a ? (n - a) + ' not in the filed brief' : ''].filter(Boolean).join(', '); };
    const kinds = CHECKS.concat(Array.from(new Set(s.map(x => x.sig))).filter(k => !CHECKS.some(c => c[0] === k)).map(k => [k, (SIG[k] || [k])[0], '']));
    const cur = kinds.find(k => k[0] === open); const list = cur ? s.filter(x => x.sig === cur[0]) : []; const un = s.filter(x => !isCov(x)).length;
    return html`<section class="den-strip" data-tour="strip" aria-label="Nothing critical missed" ref=${box}>${head}
      <span class="den-strip-h" title="Five checks computed from the archive. No model is asked.">${s.length ? s.length + ' to read' : 'five checks, nothing found'}${hasBrief && s.length ? html`<span class=${un ? (filed ? 'ack' : 'un') : 'ok'}>${un ? unWords(un, s) : 'all in the brief'}</span>` : null}</span>
      <ul id="den-strip-list">${kinds.map(k => { const l = s.filter(x => x.sig === k[0]); const u = l.filter(x => !isCov(x)).length; const on = open === k[0];
        const words = l.length ? plural(l.length, 'finding') + (hasBrief ? (u ? ', ' + (filed ? unWords(u, l) : u + ' not yet in the brief') : ', covered in the brief') : '') : 'nothing found';
        return html`<li key=${k[0]} data-sig=${k[0]}><button data-tour="check" class=${'den-check ' + (l.length ? 'has ' + k[0] : 'clear') + (on ? ' open' : '')} data-n=${l.length} aria-expanded=${on ? 'true' : 'false'} title=${k[1] + ': ' + words} onClick=${() => setOpen(on ? '' : k[0])}>
          ${Ic(k[0])}<span class="den-check-l">${k[1]}</span>${l.length ? html`<b>${l.length}</b>` : null}<i class=${!l.length ? 'ok' : hasBrief && !u ? 'cov' : filed ? 'ack' : 'un'} aria-hidden="true"></i><span class="den-sr">${words}</span></button></li>`; })}</ul>
      ${cur ? html`<div class="den-pop" data-tour="check-pop" role="region" aria-label=${cur[1]}>
        <header><span class=${'den-chip ' + (list.length ? (SIG[cur[0]] || ['', ''])[1] : 'pos')}>${cur[1]}</span><span class="den-mono" title="Computed from the archive. No model is asked.">computed, no model</span><span class="den-spacer"></span><button class="den-mini quiet" onClick=${() => setOpen('')}>Close</button></header>
        ${list.length ? html`<ul>${list.map(x => html`<li key=${x.key}><span class="den-t">${x.title}</span><span class="d">${x.detail}</span>
            <span class="den-pop-act">${hasBrief ? html`<span class=${'den-chip ' + (isCov(x) ? 'pos' : filed ? '' : 'warn')}>${isCov(x) ? 'in the brief' : filed ? (ackd.has(x.key) ? 'acknowledged at filing' : 'not in the filed brief') : 'not yet in the brief'}</span>` : html`<span class="den-chip">no brief yet</span>`}
              ${x.open && (x.open.tab || x.open.view || x.open.url) ? html`<button class="den-link" onClick=${() => { setOpen(''); openEvidence(x.open, setTab); }} aria-label=${'Open the evidence for: ' + x.title}>${x.open.tab ? 'Open Collection' : x.open.view ? 'Open in ' + x.open.view.charAt(0).toUpperCase() + x.open.view.slice(1) : 'Open the post'}</button>` : null}</span></li>`)}</ul>`
          : html`<p class="den-pop-none">${cur[2] || 'Nothing found in this window.'}</p>`}
      </div>` : null}
    </section>`;
  }

  /* ---- The Board: the window's evidence as cards, Unsorted and one column for each section of the report ---- */
  function RowActions({ r, kind, desk, canWrite, onDone }) {
    const [ask, setAsk] = useState(false); const [why, setWhy] = useState(ASIDE[0]); const [own_, setOwn] = useState(''); const [busy, setBusy] = useState(false);
    const send = async (path, body) => { setBusy(true); try { const d = await call(path, Object.assign({ desk: desk.id, item: r.id }, body)); onDone(d, r); } catch (e) { toastMsg(say(e), true); } setBusy(false); setAsk(false); };
    const link = web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label=${'Open the source of this ' + kind}>${Ic('open')}Open</a>` : null;
    if (!canWrite) return link;
    if (ask) return html`<span class="den-form den-asideform" data-tour="aside-form">
      <select class="den-in" data-tour="aside-why" value=${why} aria-label="Why it is set aside" onChange=${e => setWhy(e.target.value)}>${ASIDE.map(a => html`<option key=${a} value=${a}>${a}</option>`)}<option value="other">other (say why)</option></select>
      ${why === 'other' ? html`<input class="den-in" value=${own_} maxlength="200" placeholder="Why" aria-label="Your reason" onInput=${e => setOwn(e.target.value)} />` : null}
      <button class="den-mini" data-tour="aside-go" disabled=${busy || (why === 'other' && own_.trim().length < 3)} onClick=${() => send('/den/aside', { reason: why === 'other' ? own_ : why })}>Set aside</button><button class="den-mini quiet" data-tour="aside-cancel" onClick=${() => setAsk(false)}>Cancel</button></span>`;
    return html`<span class="den-acts">
      <button data-tour="card-pin" class=${'den-mini row' + (r.pinned ? ' on' : '')} disabled=${busy} aria-pressed=${r.pinned ? 'true' : 'false'} title=${r.pinned ? 'Pinned to the report: a draft must cover it. Press to unpin.' : 'Pin to the report: a draft must cover it'} onClick=${() => send('/den/pin', r.pinned ? { clear: true } : {})}>${Ic('pin')}${r.pinned ? 'Pinned' : 'Pin'}</button>
      <button class="den-mini row" data-tour="card-aside" disabled=${busy} title="Take it off this desk's board, with a reason" onClick=${() => setAsk(true)}>${Ic('aside')}Set aside</button>
      ${link}</span>`;
  }
  /* A narrative the worker named by itself (build p67 sends named: 'auto') carries its computed name as a working title
     until a person or the model names it. Under an older worker the field is absent and nothing is shown. */
  const WORKTITLE_T = 'A working title computed from the narrative\'s own rows, not yet reviewed by a person. It changes when a person or the model names it.';
  // a filed card's menu reads "Move...", not the clipped name of the column it already sits in
  const MOVE = '__move';
  const layerTitle = l => (l === 1 ? 'Layer 1: an official route' : l === 2 ? 'Layer 2: a signed-in collector on the Mac' : 'Layer 3: a keyless read from the worker');
  /* One evidence card. The same card in Unsorted and under a section; what differs by kind is what the row carries. */
  function Card({ c, desk, canWrite, onDone, onFile, secs, cited, onDrag, picked, onPick, yr }) {
    const r = c.r, k = c.kind; const lvl = c.w.score >= 60 ? 3 : c.w.score >= 30 ? 2 : 1; const pick = !!(canWrite && onPick && c.pin);
    const kindWord = k === 'media' ? 'story' : k === 'social' ? 'post' : k === 'actors' ? 'post by ' + r.who : k === 'narratives' ? (r.named === 'auto' ? 'Narrative, working title' : 'Narrative') : 'Upcoming';
    const name = (c.pinned ? 'Pinned. ' : '') + (k === 'upcoming' ? 'Upcoming: ' + r.event + ' on ' + r.date : kindWord + ': ' + String(c.title || '').slice(0, 120));
    const src = k === 'media' ? html`<span class="den-src"><b>${r.outlet}</b> ${r.tier ? html`<span>${r.tier}${r.juris && r.juris !== 'au' ? ', ' + r.juris.toUpperCase() : ''}</span>` : null}</span>`
      : k === 'narratives' ? html`<span class="den-src"><b>Narrative</b>${r.named === 'auto' ? html` <span class="den-chip den-worktitle" title=${WORKTITLE_T}>working title</span>` : null}</span>` : k === 'upcoming' ? html`<span class="den-src"><b>Upcoming</b></span>`
      : html`<span class="den-src"><b>${CH[r.platform] || r.platform}</b> ${r.sub ? html`<span>r/${r.sub} </span>` : null}${k === 'social' && r.registered ? html`<span>registered </span>` : null}</span>`;   // which collector layer read it (L1-L3) is collection detail: the Collection tab's, not the card's
    const when = k === 'upcoming' ? html`<span>${String(r.weekday || '').slice(0, 3)} ${r.date}${r.yearWritten ? '' : html` <span title="The source wrote no year: this is the next time that day comes">*</span>`}</span>` : k === 'narratives' ? (r.last ? aest(r.last) : '') : (k === 'media' && addrDated(r) ? addrDay(r, yr) : k !== 'media' && r.eng_at ? 'read ' + since(r.eng_at) : aest(r.ts));
    const meta = [];
    if (k === 'media') { if (r.fb) meta.push(html`<span key="fb" title=${(r.fb.reactions || 0) + ' reactions, ' + (r.fb.comments || 0) + ' comments, ' + (r.fb.shares || 0) + ' shares'}>${fmtN(c.reach)} on Facebook</span>`); if (r.n > 1) meta.push(html`<span key="n">${r.n} outlets</span>`); }
    // p71 fx3 (G2): the comments under a post are counted as its evidence line counts them, "read" (the card said "held",
    // a word the reader rule keeps out of the line)
    if (k === 'social' || k === 'actors') { meta.push(html`<span key="e" title=${engTip(r)}>${engSay(r)}</span>`); if (r.growth != null && r.growth !== 0) meta.push(html`<span key="g">${(r.growth > 0 ? '+' : '') + fmtN(r.growth)} since yesterday</span>`); if (r.held) meta.push(html`<span key="h">${heldSay(r.held)}</span>`); }
    if (k === 'narratives') { meta.push(html`<span key="n">${fmtN(r.n)} rows, ${fmtN(r.n24)} in the last day</span>`); if ((r.spread || []).length) meta.push(html`<span key="s">${r.spread.map(s => CH[s] || s).join(' > ')}</span>`); }
    return html`<article class=${'den-row den-card w' + lvl + (c.pinned ? ' pinned' : '') + (picked ? ' picked' : '')} data-kind=${k} data-key=${c.key} data-tour="card" data-pin=${c.pin ? '1' : '0'} data-pinned=${c.pinned ? '1' : '0'} tabIndex="0" aria-label=${name} draggable=${canWrite && onDrag ? 'true' : 'false'}
        onDragStart=${e => { if (!canWrite || !onDrag) return; try { e.dataTransfer.setData('text/plain', c.key); e.dataTransfer.effectAllowed = 'move'; } catch (x) {} onDrag(c.key); }} onDragEnd=${() => onDrag && onDrag('')}
        onClick=${e => { if (!pick || !e.shiftKey || (e.target.closest && e.target.closest('button, a, select, input, textarea'))) return; e.preventDefault(); onPick(c.key, !picked); }}>
      <div class="den-card-top">${pick ? html`<input type="checkbox" class="den-pick" data-tour="card-pick" checked=${!!picked} aria-label=${'Select: ' + String(c.title || '').slice(0, 80)} title="Select it, to set several aside at once (shift-click selects too)" onChange=${e => onPick(c.key, e.target.checked)} />` : null}<span class="den-w" title=${'Weight ' + c.w.score + ' of 99' + (c.w.why.length ? ': ' + c.w.why.join(', ') : '') + '. Worked out on this page from the row\'s own figures.'}><span class="den-sr">Weight </span>${c.w.score}</span>${src}<span class="den-when">${when}</span></div>
      ${k === 'actors' ? html`<div class="den-who"><span class="den-t">${r.who}</span> <span class="den-role">${r.role === 'mp' ? 'MP' + (r.party ? ', ' + r.party : '') : r.role === 'org' ? 'organisation' : r.role}</span></div>` : null}
      <div class=${'den-card-title' + (k === 'actors' ? ' body' : ' den-t')}>${c.pinned ? html`<span class="den-pinmark" title="Pinned to the report: a draft must cover it">${Ic('pin')}<span class="den-sr">Pinned</span></span>` : null}${c.title}</div>
      ${k === 'media' && r.n > 1 ? html`<span class="den-sub">also in ${r.outlets.slice(1, 6).join(', ')}${r.n > 6 ? ' and ' + (r.n - 6) + ' more' : ''}</span>` : null}
      ${k === 'social' && (r.term || r.hashtag) ? html`<span class="den-sub">found by ${r.hashtag ? '#' + r.hashtag : '"' + r.term + '"'}</span>` : null}
      ${k === 'narratives' && r.claim ? html`<span class="den-sub">${r.claim}</span>` : null}
      ${k === 'upcoming' ? html`<span class="den-sub">${r.what}</span>` : null}
      ${meta.length ? html`<div class="den-card-meta">${meta}</div>` : null}
      <div class="den-chips">
        ${k === 'media' && r.gated ? html`<span class="den-chip warn" title="Read through the agency's subscription. A brief quotes at most thirty words.">subscriber</span>` : k === 'media' && r.full ? html`<span class="den-chip" title="The full text is held">full text</span>` : null}
        ${k === 'narratives' ? html`<span class=${'den-chip ' + (r.side === 'hostile' ? 'neg' : r.side === 'supportive' ? 'pos' : '')}>${r.side || 'not read yet'}</span>` : null}${k === 'narratives' && r.status ? html`<span class="den-chip">${r.status}</span>` : null}
        ${k === 'upcoming' && r.recorded ? html`<span class="den-chip info" title="Read from the parliament's own page for this bill or inquiry, not worked out from a sentence">recorded</span>` : null}
        ${(k === 'social' || k === 'actors') && r.held && r.held.tone != null ? html`<span class=${'den-chip ' + (r.held.tone <= -0.15 ? 'neg' : r.held.tone >= 0.15 ? 'pos' : '')} title=${heldTip(r.held)}>${toneWord(r.held.tone)}</span>` : null}
        ${c.sigs.map(s => html`<span key=${s.key} class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]} title=${s.title}>${(SIG[s.sig] || [s.sig])[0]}</span>`)}
        ${cited ? html`<span class="den-chip pos" title="The brief cites this row">Cited${cited > 1 ? ' x' + cited : ''}</span>` : null}
      </div>
      <div class="den-card-act">
        ${c.pin ? html`<${RowActions} r=${Object.assign({}, r, { pinned: c.pinned })} kind=${kindWord} desk=${desk} canWrite=${canWrite} onDone=${onDone} />`
          : k === 'narratives' ? html`<button class="den-link" onClick=${() => window.AXUI.goto('narratives', { id: r.id })} aria-label=${'Open the narrative: ' + r.label}>${Ic('open')}Open</button>`
          : web(r.url) ? html`<a class="den-link" href=${web(r.url)} target="_blank" rel="noopener" aria-label="Open the source of this date">${Ic('open')}Open</a>` : null}
        ${canWrite && onFile ? html`<select class="den-in den-file" data-tour="card-file" aria-label="File under a section" title=${c.pin ? 'Where this card is filed is kept with the desk, for everyone on it' : 'Where this card is filed is kept on this computer'} value=${c.sec ? MOVE : ''} onChange=${e => { if (e.target.value !== MOVE) onFile(c, e.target.value); }}>${c.sec ? html`<option value=${MOVE} disabled hidden>Move...</option>` : null}<option value="">${c.sec ? 'Back to Unsorted' : 'File under...'}</option>${secs.map((s, i) => html`<option key=${s.id} value=${s.id} disabled=${s.id === c.sec}>${secKey(i) ? secKey(i) + '  ' : ''}${s.title}${s.id === c.sec ? ' (filed here)' : ''}</option>`)}</select>` : null}
      </div>
    </article>`;
  }
  function Board({ desk, to, tick, bump, setTab, canWrite, onStrip, onBoard, bst, filing, setFiling, onWrite }) {
    const b = useLoad(() => get('/den/board?' + q({ desk: desk.id, missed: 1, to }), 'counts'), [desk.id, tick, to], desk.id + '|' + to);
    useEffect(() => { if (!onStrip) return; const ms = b.data ? b.data.missed : null; const good = !!(ms && ms.ok === true && Array.isArray(ms.signals));
      onStrip({ data: good ? ms : null, loading: b.loading, err: b.err, reload: b.reload }); }, [b.data, b.loading, b.err]);   // eslint-disable-line
    useEffect(() => { if (onBoard) onBoard(b.data || null); }, [b.data]);   // eslint-disable-line
    const [offer, setOffer] = useState(null); const [showAside, setShowAside] = useState(false); const [showLow, setShowLow] = useState(false); const [kind, setKind] = useState('all'); const [find, setFind] = useState('');
    const [undo, setUndo] = useState(null); const [drag, setDrag] = useState(''); const [over, setOver] = useState('');
    // several unsorted cards selected at once, to be set aside with one reason; the selection is this render's, never kept
    const [sel, setSel] = useState([]); const [bulkWhy, setBulkWhy] = useState(ASIDE[0]); const [bulkOwn, setBulkOwn] = useState(''); const [bulkBusy, setBulkBusy] = useState(false);
    useEffect(() => { setSel([]); }, [desk.id, to]);
    const root = useRef(null); const last = useRef(''); const fref = useRef(filing); fref.current = filing;
    // a card that was moved or redrawn under the keyboard keeps the focus: the card itself, or the one that took its place
    useEffect(() => { if (!last.current || !root.current || document.activeElement !== document.body) return; const el = Array.from(root.current.querySelectorAll('.den-row')).find(x => x.dataset.key === last.current); if (el) el.focus({ preventScroll: true }); });
    // the checks that weigh a card and sit under a column; a collection gap is none of them (it is said on Collection only)
    const sigs = useMemo(() => (b.data && b.data.missed && Array.isArray(b.data.missed.signals) ? b.data.missed.signals.filter(s => s && s.sig !== 'gap') : []), [b.data]);
    const secs = useMemo(() => desk.sections.filter(s => s.kind !== 'sources' && desk.options.hidden.indexOf(s.id) < 0), [desk]);
    const cards = useMemo(() => deck(b.data, sigs).map(c => Object.assign(c, { sec: filing[c.key] && secs.some(s => s.id === filing[c.key]) ? filing[c.key] : '' })), [b.data, filing, secs]);   // eslint-disable-line
    const unfile = keys => { const m = Object.assign({}, fref.current); let ch = false; keys.forEach(k => { if (m[k]) { delete m[k]; ch = true; } }); if (ch) setFiling(m); };
    const done = (d, r) => { if (d && d.offer) setOffer(d.offer); const keys = ['M:' + d.item, 'S:' + d.item, 'P:' + d.item];
      if (d && (d.mark === '' || d.mark === 'aside')) unfile(keys);
      const title = String((r && (r.title || r.text)) || 'the row').slice(0, 60); const back = async (path, body) => { try { await call(path, Object.assign({ desk: desk.id, item: d.item }, body)); b.reload(); } catch (e) { toastMsg(say(e), true); } };
      if (d) tell(d.mark === 'pin' ? 'pin' : d.mark === 'aside' ? 'aside' : 'unpin', { item: d.item, desk: desk.id });
      if (d) setUndo(d.mark === 'pin' ? { text: 'Pinned: ' + title, run: () => back('/den/pin', { clear: true }) } : d.mark === 'aside' ? { text: 'Set aside: ' + title, run: () => back('/den/aside', { clear: true }) } : { text: 'Unpinned: ' + title, run: () => back('/den/pin', {}) });
      b.reload(); };
    const mute = async on => { if (on) { try { await call('/den/mute', { desk: desk.id, kind: offer.kind, value: offer.value }); toastMsg('Muted on this desk'); b.reload(); bump('desk'); } catch (e) { toastMsg(say(e), true); } } setOffer(null); };
    /* The selected cards set aside with one reason: each row goes through POST /den/aside exactly as a single set-aside
       does, one after the other, so the worker's count and its mute offer are what they would be by hand. One Undo puts
       them all back. A failure part way says how many went before it, and the rest stay on the board. */
    const pickCard = (key, on) => setSel(s => (on ? (s.indexOf(key) < 0 ? s.concat([key]) : s) : s.filter(k => k !== key)));
    const bulkAside = async items => { if (!canWrite || !items.length || bulkBusy) return; setBulkBusy(true); const reason = bulkWhy === 'other' ? bulkOwn.trim() : bulkWhy; const went = []; let off = null, err = '';
      for (const c of items) { try { const d = await call('/den/aside', { desk: desk.id, item: c.id, reason }); went.push(c); if (d && d.offer) off = d.offer; } catch (e) { err = say(e); break; } }
      setBulkBusy(false); setSel([]);
      if (err) toastMsg((went.length ? plural(went.length, 'card') + ' of ' + items.length + ' set aside before it failed. ' : '') + err, true);
      if (went.length) { unfile(went.map(c => c.key)); if (off) setOffer(off); tell('aside', { items: went.map(c => c.id), bulk: true, desk: desk.id });
        setUndo({ text: 'Set aside ' + plural(went.length, 'card'), run: async () => { for (const c of went) { try { await call('/den/aside', { desk: desk.id, item: c.id, clear: true }); } catch (e) { toastMsg(say(e), true); } } b.reload(); } }); }
      b.reload(); };
    /* File a card under a section. A row the worker can pin is pinned, exactly as the Pin button does, so a draft must
       cover it, and the pin carries the section (build p66): where the card sits is the desk's record, seen by everyone
       on it. Taking it back to Unsorted leaves it pinned. A narrative or a date is filed on this computer only. The note
       kept here mirrors the worker's answer, and stands on its own when the worker is older than this page. */
    const fileCard = async (c, sec) => { if (!canWrite || !c || (c.sec || '') === (sec || '')) return; const was = c.sec || ''; let pinnedNow = false, posted = false;
      if (c.pin && (sec || c.pinned)) { try { await call('/den/pin', { desk: desk.id, item: c.id, section: sec || '' }); pinnedNow = !c.pinned; posted = true; } catch (e) { toastMsg(say(e), true); return; } }
      const m = Object.assign({}, fref.current); if (sec) m[c.key] = sec; else delete m[c.key]; setFiling(m);
      const t = (secs.find(s => s.id === sec) || {}).title;
      setUndo({ text: (sec ? 'Filed under ' + t : 'Back to Unsorted') + ': ' + String(c.title || '').slice(0, 50), run: async () => { const n = Object.assign({}, fref.current); if (was) n[c.key] = was; else delete n[c.key]; setFiling(n);
        if (posted) { try { await call('/den/pin', pinnedNow ? { desk: desk.id, item: c.id, clear: true } : { desk: desk.id, item: c.id, section: was }); } catch (e) { toastMsg(say(e), true); } b.reload(); } } });
      // the board is read again after every write, so a read that was in flight when the pin went out cannot bring the old section back over it
      // the card settles where it lands with a fading ring (den.css den-settle, a shadow only), so the eye finds it
      setTimeout(() => { const el = root.current && Array.from(root.current.querySelectorAll('.den-card[data-key]')).find(x => x.dataset.key === c.key); if (el) { el.setAttribute('data-settle', '1'); setTimeout(() => el.removeAttribute('data-settle'), 450); } }, 30);
      tell('file', { key: c.key, sec: sec || '', desk: desk.id }); if (posted) b.reload(); };
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
    // a check is "not in the brief" only once there is a brief to be in; once filed, what it left out was acknowledged at filing
    const unc = brief ? sigs.filter(s => !covered(s, brief, texts)) : []; const filedB = !!(brief && brief.status === 'filed'); const ackd = new Set(filedB ? (brief.acknowledged || []).map(a => (a && typeof a === 'object' ? a.key : a)) : []);
    const selected = sel.map(k => uns.find(x => x.key === k)).filter(x => x && x.pin);   // a card that left Unsorted leaves the selection
    const yr = String((d.window && d.window.day) || '').slice(0, 4);   // p71 fx5 (R2): the window's year, beside which a card's address day says its own
    const card = x => html`<${Card} key=${x.key} c=${x} desk=${desk} canWrite=${canWrite} onDone=${done} onFile=${fileCard} secs=${secs} cited=${citedN(x)} onDrag=${setDrag} picked=${!x.sec && sel.indexOf(x.key) >= 0} onPick=${!x.sec ? pickCard : null} yr=${yr} />`;
    const total = { media: (d.media || []).length, social: (d.social || []).length, actors: (d.actors || []).length, narratives: (d.narratives || []).length, upcoming: (d.upcoming || []).length };
    const WHY = { narratives: 'No narrative on this desk\'s issues gained rows in this window.', media: 'No story on this desk\'s issues' + (desk.region !== 'au' ? ' in ' + desk.region.toUpperCase() : '') + ' was collected in this window.', social: 'No post on this desk\'s terms or from its registered accounts was collected in this window.',
      actors: 'No registered organisation, official or MP posted on this desk in this window.', upcoming: 'No row in this window names a day and a month beside an action that has not yet passed, and no watched bill or inquiry has a date ahead.' };
    const none = KINDS_ROW.filter(k => !total[k[0]]);
    return html`<div class="den-boardwrap" ref=${root} onKeyDown=${onKey} onFocus=${e => { const r = e.target.closest ? e.target.closest('.den-row') : null; last.current = r ? r.dataset.key : ''; }}>
      ${b.err ? html`<div class="den-notice bad" role="alert">The board could not be refreshed: ${b.err} What is shown is the last read. <button class="den-mini" onClick=${b.reload}>Try again</button></div>` : null}
      ${d.capped ? html`<div class="den-notice">This window holds more rows than one board reads (${fmtN(4000)}). The newest are shown; shorten the window in Options to see all of a busy day.</div>` : null}
      ${offer ? html`<div class="den-notice" data-tour="mute-offer" role="alert">${offer.text} A mute hides its rows on this desk only, and can be removed in Options. <div><button class="den-mini primary" onClick=${() => mute(true)}>Mute it on this desk</button><button class="den-mini" onClick=${() => mute(false)}>Not now</button></div></div>` : null}
      <div class=${'den-board' + (drag ? ' dragging' : '')}>
        <section class=${'den-col den-unsorted' + (over === 'unsorted' ? ' over' : '')} aria-label="Unsorted" data-tour="unsorted" data-n=${uns.length} onDragOver=${dragOver('')} onDrop=${drop('')} onDragLeave=${() => setOver('')}>
          <header class="den-col-h"><h3>Unsorted</h3><span class="den-count" title="Cards not yet filed under a section">${uns.length}</span>
            <p class="den-colsub">${canWrite ? 'The window\'s triage queue. Drag a card to a section, or focus it and press the section\'s number. Where a story or post is filed is kept with the desk, for everyone on it; a narrative or a date is filed on this computer only.' :'The window\'s rows, by weight. Your key is read-only: filing, pinning and setting aside need a full key.'}</p></header>
          <div class="den-col-tools">
            <label class="den-search"><span class="den-sr">Search the unsorted cards</span><input class="den-in" type="search" data-tour="search" value=${find} placeholder="Search cards ( / )" onInput=${e => setFind(e.target.value)} /></label>
            <div class="den-filter" data-tour="filter" role="group" aria-label="Kind of row">${[['all', 'All']].concat(KINDS_ROW).map(k => html`<button key=${k[0]} class="den-seg" data-kind=${k[0]} aria-pressed=${kind === k[0] ? 'true' : 'false'} onClick=${() => setKind(k[0])}>${k[1]} <span class="n">${k[0] === 'all' ? uns.length : counts[k[0]] || 0}</span></button>`)}</div>
            ${canWrite ? html`<button class="den-mini quiet den-undo" data-tour="undo" data-what=${undo ? undo.text : ''} disabled=${!undo} title=${undo ? undo.text : 'Nothing to undo'} onClick=${() => { const u = undo; setUndo(null); if (u) u.run(); }}>${Ic('undo')}Undo${undo ? html`<span class="den-undo-t">: ${undo.text}</span>` : null}</button>` : null}
            ${canWrite ? html`<span class="den-sr" role="status" aria-live="polite">${undo ? undo.text + '. Undo is beside it.' : ''}</span>` : null}
            ${canWrite && selected.length ? html`<div class="den-bulk" data-tour="bulk" role="group" aria-label="Selected cards"><b>${selected.length} selected</b>
              <select class="den-in" data-tour="bulk-why" value=${bulkWhy} aria-label="Why they are set aside" onChange=${e => setBulkWhy(e.target.value)}>${ASIDE.map(a => html`<option key=${a} value=${a}>${a}</option>`)}<option value="other">other (say why)</option></select>
              ${bulkWhy === 'other' ? html`<input class="den-in" value=${bulkOwn} maxlength="200" placeholder="Why" aria-label="Your reason for them all" onInput=${e => setBulkOwn(e.target.value)} />` : null}
              <button class="den-mini" data-tour="bulk-go" disabled=${bulkBusy || (bulkWhy === 'other' && bulkOwn.trim().length < 3)} title="Takes every selected card off this desk's board, with this one reason" onClick=${() => bulkAside(selected)}>${bulkBusy ? 'Setting aside...' : 'Set aside ' + plural(selected.length, 'card')}</button>
              <button class="den-mini quiet" disabled=${bulkBusy} onClick=${() => setSel([])}>Clear</button></div>` : null}
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
          // a column with no card is compact (den.css .den-col.empty): it keeps its place, its key, its state and Write, and takes a drop, so a quiet desk is not a row of wide empty boxes
          return html`<section key=${s.id} class=${'den-col sp' + (i % 11) + (over === s.id ? ' over' : '') + (mine.length ? '' : ' empty')} data-sec=${s.id} data-tour="col" aria-label=${s.title} onDragOver=${dragOver(s.id)} onDrop=${drop(s.id)} onDragLeave=${() => setOver('')}>
            <header class="den-col-h">${key ? html`<span class="den-kbd" title=${'Press ' + key + ' to file the focused card here'}>${key}</span>` : null}<h3>${s.title}</h3><span class="den-count" title="Cards filed here">${mine.length}</span></header>
            <div class="den-col-meta"><span class=${'den-chip ' + st[1]}>${st[0]}</span>${un.length ? html`<span class="den-chip den-unc" title=${un.map(x => x.title).join('; ')}>${filedB ? (un.every(x => ackd.has(x.key)) ? un.length + ' acknowledged at filing' : plural(un.length, 'check') + ' not in the filed brief') : plural(un.length, 'check') + ' not in the brief yet'}</span>` : null}<span class="den-spacer"></span>
              <button class="den-mini" data-tour="col-write" aria-label=${'Write ' + s.title} onClick=${() => onWrite(s.id)}>${Ic(canWrite ? 'pen' : 'eye')}${canWrite ? 'Write' : 'Read'}</button></div>
            <div class="den-col-body">${mine.length ? mine.map(card) : html`<p class="den-drop">${canWrite ? html`<span>Drop here${key ? html`<span>, or press <span class="den-kbd">${key}</span> on a card</span>` : null}.</span>` : 'No card is filed here.'}</p>`}</div>
            ${String(text || '').trim() ? html`<div class="den-excerpt"><span class="den-mono">${wc(text)} words</span><p>${String(text).replace(/\s*\[[A-Z]:[^\]]+\]/g, '').slice(0, 170)}${String(text).length > 170 ? '...' : ''}</p></div>` : null}
          </section>`; })}
      </div>
    </div>`;
  }

  /* ---- The Brief (docs/den-brief.js) and Watch, Collection and Options (docs/den-desk.js) ----
     Each part is a factory loaded before this file. It is handed every shared name above as D and returns its
     components. The list is generated from the declarations above (one name each); a part asks for a new one here. */
  const PARTS = window.__DEN_PARTS || {};
  if (typeof PARTS.brief !== 'function' || typeof PARTS.desk !== 'function') {
    window.denInit = function () {
      const root = document.getElementById('den-root');
      if (root) root.innerHTML = '<div class="aud-notice"><b>Part of Anne\'s Den did not load.</b> <code>docs/den-brief.js</code> or <code>docs/den-desk.js</code> is missing from this deployment. Redeploy the docs folder, then reload.</div>';
    };
    return;
  }
  const D = {
    html, call, own, hdrs, toastMsg, fmtN, Console, tailJob, useGoto, canWriteNow, TABS, CH, SIG, ASIDE, fmtAest,
    fmtDay, aest, since, ls, say, web, q, BUSY_WAITS, get, getText, useLoad, Loading, Failed, Empty, Boundary, Panel,
    Dialog, engText, tell, openEvidence, KINDS_ROW, fbTotal, sydDay, sydOffset, dayEnd, dayWords, BUDGET_T, wc, plural,
    toCards, sigsFor, weigh, LOW, deck, byWeight, covered, secOfKind, KIND_SEC, sigSec, secState, secKey, citeOf,
    STRIP_PENDING, CHECKS, Strip, RowActions, layerTitle, Card, Board, ICONS, Ic, WORKTITLE_T, addrDated, addrDay
  };
  const { BriefPanel } = PARTS.brief(D);
  const { WatchPanel, CollectionPanel, OptionsPanel } = PARTS.desk(D);

  function Shortcuts({ onClose }) {
    const K = [['j / k', 'Next and previous card on the Board'], ['p', 'Pin the row to the report'], ['x', 'Set the row aside'], ['o or Enter', 'Open the row\'s source'], ['1 to 9, 0', 'File the focused card under that section'], ['/', 'Search the unsorted cards'], ['Alt + 1 to 5', 'Board, Brief, Watch, Collection, Options'], ['Ctrl or Cmd + S', 'Save the brief'], ['?', 'This sheet'], ['Esc', 'Close a dialog or a check']];
    const tour = window.DenTour && typeof window.DenTour.open === 'function' ? window.DenTour : null;
    return html`<${Dialog} title="Keyboard" onClose=${onClose}><table class="den-table"><tbody>${tour ? html`<tr key="tour"><td><button class="den-mini" data-tour="replay" onClick=${() => { onClose(); setTimeout(() => tour.open({ via: 'sheet' }), 0); }}>Take the guided tour</button></td><td>One day on the desk, step by step: you press each control yourself</td></tr>` : null}${K.map(k => html`<tr key=${k[0]}><td><span class="den-kbd">${k[0]}</span></td><td>${k[1]}</td></tr>`)}</tbody></table><div class="den-form den-mt"><button class="den-mini" onClick=${onClose}>Close</button></div><//>`;
  }
  const backToAxiom = () => { if (typeof window.go === 'function') window.go('command'); else if (window.AXUI.goto) window.AXUI.goto('command', {}); };
  /* The Den's own top bar. It is drawn even when no desk could be read, so the way back is never lost. */
  function TopBar({ children }) { return html`<header class="den-top den-head"><button class="den-back" onClick=${backToAxiom}>${Ic('back')} Back to AXIOM</button><span class="den-brand">Anne's Den</span>${children || null}</header>`; }

  function DenApp() {
    const D = useLoad(() => get('/den/desks', 'desks'), [], 'desks'); const [deskId, setDeskId] = useState(() => ls.get('ax_den_desk', '')); const [tab, setTabRaw] = useState(() => ls.get('ax_den_tab', 'today')); const [tick, setTick] = useState(0); const [keys, setKeys] = useState(false);
    // the day the Board and the Brief read: today unless the picker says another; never kept, so a new open is today's
    const today = sydDay(); const [dayPick, setDayPick] = useState(''); const day = /^\d{4}-\d\d-\d\d$/.test(dayPick) && dayPick < today ? dayPick : today; const past = day !== today; const to = past ? dayEnd(day) : '';
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
    const did = desk ? desk.id : ''; const bid = did + '|' + to; const mine = board && board.id === bid ? board.d : null; const rawSigs = mine && mine.missed && Array.isArray(mine.missed.signals) ? mine.missed.signals : (sigs && sigs.id === bid && sigs.s ? sigs.s : null);
    // a channel that delivered nothing (sig 'gap') is said on Collection only (owner, 16 November 2026); the Board and the Brief read the rest
    const gaps = useMemo(() => (rawSigs ? rawSigs.filter(s => s.sig === 'gap').map(s => Object.assign({}, s, { channel: s.channel || String(s.key || '').replace(/^G:/, '') })) : (sigs && sigs.id === bid && sigs.failed ? null : undefined)), [rawSigs, sigs, bid]);
    const mySigs = useMemo(() => (rawSigs ? rawSigs.filter(s => s.sig !== 'gap') : null), [rawSigs]);
    const cards = useMemo(() => (mine ? deck(mine, mySigs || []) : null), [mine, mySigs]);
    // opened on another tab than the Board (the last tab used is kept): the window is read once here too, so the Brief's
    // evidence and where the desk's cards are filed are the desk's record, not this computer's note; the Board's own
    // read, when it opens, carries the checks. On the Brief tab, where that evidence is shown, Refresh reads it again
    // (readAt is the Refresh the window was last read at)
    const adoptRef = useRef(null); const readAt = useRef(-1);
    useEffect(() => { if (!desk || tab === 'today' || (mine && (tab !== 'brief' || readAt.current === tick))) return; let on = true; const at = tick; get('/den/board?' + q({ desk: desk.id, to }), 'counts').then(d => { if (on) { readAt.current = at; setBoard({ id: bid, d }); if (adoptRef.current) adoptRef.current(d); } }, () => {}); return () => { on = false; }; }, [did, tab, !!mine, to, tick]);   // eslint-disable-line
    if (D.loading && !D.data) return html`<div id="den-shell"><${TopBar} /><${Loading} what="the desks" /></div>`;
    if (D.err && !D.data) return html`<div id="den-shell"><${TopBar} /><${Failed} what="The desks" err=${D.err} onRetry=${D.reload} /></div>`;
    if (!desk) return html`<div id="den-shell"><${TopBar} /><${Empty}><b>No desk is set up.</b> A desk is a client, a region and a report format. Ask an admin to add one.<//></div>`;
    const pickDesk = id => { setDeskId(id); ls.set('ax_den_desk', id); setTick(t => t + 1); };
    /* Which section a card is filed under, for this desk and this Sydney day. A story or post carries its section on its
       pin, the desk's record (build p66): when the board arrives, what it says replaces this computer's note for every
       row it names, so a filing made by someone else, or on another computer, shows here. A narrative or a date is not a
       row the worker pins, so where it sits stays this computer's note. A worker older than this page says nothing about
       sections, and the note then stands as it did before. */
    const fkey = 'ax_den_file_' + desk.id + '_' + day; const filing = fst.k === fkey ? fst.m : (ls.get(fkey, {}) || {});
    const setFiling = m => { setFst({ k: fkey, m }); if (Object.keys(m).length) ls.set(fkey, m); else ls.del(fkey); };
    const adopt = d => { if (!d) return; const rows = [['M:', d.media], ['S:', d.social], ['P:', d.actors]]; if (!rows.some(x => (x[1] || []).some(r => 'section' in r))) return;
      const m = Object.assign({}, filing); let ch = false; const known = s => !!s && desk.sections.some(x => x.id === s && x.kind !== 'sources' && desk.options.hidden.indexOf(x.id) < 0);
      // the first board with sections this desk has seen on this computer: a note made here before the worker kept sections
      // (a pinned row it reports under no section) is sent to it once, instead of being dropped; after that, a pinned row
      // under no section is someone's "back to Unsorted" and the note follows it
      const sentKey = 'ax_den_sec_sent_' + desk.id; const first = !ls.get(sentKey, false); const send = [];
      rows.forEach(x => (x[1] || []).forEach(r => { const k = x[0] + r.id, s = r.pinned && known(r.section) ? r.section : '';
        if (first && canWrite && r.pinned && !s && known(m[k])) { send.push(call('/den/pin', { desk: desk.id, item: r.id, section: m[k] }).catch(() => {})); return; }
        if ((m[k] || '') !== s) { ch = true; if (s) m[k] = s; else delete m[k]; } }));
      if (ch) setFiling(m); ls.set(sentKey, true); if (send.length) Promise.all(send).then(() => setTick(t => t + 1)); };
    adoptRef.current = adopt;
    const openSec = secs[desk.id] !== undefined ? secs[desk.id] : ls.get('ax_den_sec_' + desk.id, ''); const setOpenSec = id => { setSecs(o => Object.assign({}, o, { [desk.id]: id })); ls.set('ax_den_sec_' + desk.id, id); };
    const cov = bst.id === desk.id ? bst : { brief: null, texts: null };
    return html`<div data-density=${desk.options.density || 'regular'} id="den-app">
      <${TopBar}>
        <label class="den-desk"><span class="den-sr">Desk</span><select value=${desk.id} aria-label="Desk" data-tour="desk" onChange=${e => pickDesk(e.target.value)}>${desks.map(d => html`<option key=${d.id} value=${d.id}>${d.name}</option>`)}</select></label>
        <label class="den-daypick" title="The day the Board and the Brief read. Today unless another is picked; nothing here spends."><span class="den-sr">Day</span><input type="date" aria-label="Day" data-tour="day" value=${day} max=${today} onChange=${e => setDayPick(e.target.value)} /></label>
        <span class="den-where"><b class="den-day">${dayWords(day)}</b><span class="den-win">${desk.name} - ${desk.cadence}, the ${past ? desk.window_h + ' hours to the end of that day' : 'last ' + desk.window_h + ' hours'}${desk.region !== 'au' ? ', ' + desk.region.toUpperCase() + ' only' : ''} - Australian Eastern time</span></span>
        ${past ? html`<span class="den-chip warn den-otherday" title=${'The Board and the Brief show ' + dayWords(day) + ', not today. Press Today to come back.'}>not today</span><button class="den-mini quiet" data-tour="today" onClick=${() => setDayPick('')}>Today</button>` : null}
        <span class="den-spacer"></span>
        ${budget ? html`<span class="den-budget" data-tour="budget" data-left=${budget.left} data-cap=${budget.cap} title=${BUDGET_T}><span>model calls today: <b>${budget.used} of ${budget.cap}</b></span>
          <span class="den-meter" role="meter" aria-label="Model calls today, used of the cap" aria-valuemin="0" aria-valuemax=${budget.cap} aria-valuenow=${Math.min(budget.used, budget.cap)} title=${BUDGET_T}><i class=${budget.cap && budget.used >= budget.cap ? 'full' : budget.cap && budget.used / budget.cap >= 0.75 ? 'near' : ''} style=${{ width: (budget.cap ? Math.min(100, Math.round(budget.used / budget.cap * 100)) : 0) + '%' }} aria-hidden="true"></i></span></span>` : null}
        ${canWrite ? null : html`<span class="den-chip warn" data-tour="readonly">read-only key</span>`}
        <button class="den-mini quiet" onClick=${() => setTick(t => t + 1)} title="Read the archive again">${Ic('refresh')}Refresh</button>${window.DenTour && typeof window.DenTour.open === 'function' ? html`<button class="den-mini quiet den-guide" data-tour="guide" aria-label="Guided tour" title="Guided tour: one day on the desk, step by step" onClick=${() => window.DenTour.open({ via: 'guide' })}>${Ic('guide')}Guide</button>` : null}<button class="den-mini quiet den-keys" data-tour="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts" onClick=${() => setKeys(true)}>${Ic('keys')}<span aria-hidden="true">?</span></button>
      <//>
      <div class="den-rail">
        <div class="den-tabs" role="tablist" aria-label="Anne's Den">${TABS.map(t => html`<button key=${t[0]} role="tab" id=${'den-tab-' + t[0]} class="den-tab" data-attn=${t[0] === 'collection' && gaps && gaps.length ? '1' : null} aria-description=${t[0] === 'collection' && gaps && gaps.length ? 'A channel is not delivering' : null} aria-selected=${tab === t[0] ? 'true' : 'false'} aria-controls="den-tabpanel" onClick=${() => setTab(t[0])}>${t[1]}</button>`)}</div>
        <${Boundary} name="The checks" resetKey=${desk.id + tick}><${Strip} deskId=${desk.id} to=${to} setTab=${setTab} tick=${tick} handed=${tab === 'today' ? (boardStrip || STRIP_PENDING) : undefined} onSignals=${s => setSigs(s ? { id: bid, s } : s === false ? { id: bid, failed: true } : null)} cov=${cov} /><//>
      </div>
      <div role="tabpanel" id="den-tabpanel" class=${'tab-' + tab} aria-labelledby=${'den-tab-' + tab} tabIndex=${tab === 'today' || tab === 'brief' ? null : '0'}>
        <${Boundary} name=${TABS.find(t => t[0] === tab)[1]} resetKey=${desk.id + tab}>
          ${tab === 'today' ? html`<${Board} desk=${desk} to=${to} tick=${tick} bump=${bump} setTab=${setTab} canWrite=${canWrite} onStrip=${setBoardStrip} onBoard=${d => { readAt.current = tick; setBoard(d ? { id: bid, d } : null); adopt(d); }} bst=${cov} filing=${filing} setFiling=${setFiling} onWrite=${id => { setOpenSec(id); setTab('brief'); }} />` : null}
          <div class="den-briefhost" hidden=${tab !== 'brief'}><${Boundary} name="Brief" resetKey=${desk.id + day}><${BriefPanel} key=${desk.id + '|' + day} desk=${desk} day=${day} past=${past} tick=${tick} bump=${bump} budget=${budget} canWrite=${canWrite} setTab=${setTab} cards=${cards} signals=${mySigs} filing=${filing} setFiling=${setFiling} openSec=${openSec} setOpenSec=${setOpenSec} onState=${s => setBst(Object.assign({ id: desk.id }, s))} /><//></div>
          ${tab === 'watch' ? html`<div class="den-page"><${WatchPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} /></div>` : null}
          ${tab === 'collection' ? html`<div class="den-page"><${CollectionPanel} desk=${desk} tick=${tick} bump=${bump} canWrite=${canWrite} gaps=${gaps} to=${to} setTab=${setTab} /></div>` : null}
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
