/* Anne's Den - Concept A, The Storyboard.
 * Organised by the report: the brief's sections are columns, the evidence filed under each is its cards,
 * and Unsorted is the window's triage queue. Renders window.DEN (shared.js); every mutation goes through DEN.a.
 * Vanilla, no build, no network; works from file://. */
(function () {
  'use strict';
  var D = window.DEN;
  if (!D) { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">shared.js did not load.</p>'; return; }
  var st = D.state, q = D.q, a = D.a;

  var ROUTES = ['today', 'brief', 'watch', 'collection', 'options', 'system'];
  var ROUTE_LABEL = { today: 'Board', brief: 'Brief', watch: 'Watch', collection: 'Collection', options: 'Options', system: 'System' };
  var SEC_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  var ui = {
    route: 'today', section: 'summary', filter: 'all', search: '', showLow: false, showAside: false,
    check: null, open: null, deskOpen: false, preview: {}, issueFor: {}, caret: null, pull: false, pullSearch: '',
    dialog: null, lastFocus: null, focusAfter: null, stages: {}, dragId: null
  };

  /* ---------- small helpers ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }

  var ICONS = {
    back: 'M15 6l-6 6 6 6', chev: 'M6 9l6 6 6-6', right: 'M9 6l6 6-6 6', left: 'M15 6l-6 6 6 6',
    pin: 'M9 4h6l-1 6 3 3v2H7v-2l3-3-1-6zM12 15v5', x: 'M6 6l12 12M18 6L6 18',
    aside: 'M4 7h16M6 7v11a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7M9 4h6M10 11l4 4M14 11l-4 4',
    open: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5',
    check: 'M5 12.5l4.5 4.5L19 7.5', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.3',
    gap: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8', spike: 'M3 17l5-5 4 3 8-9M15 6h5v5',
    emerging: 'M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
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
    wifi: 'M3 9c5-5 13-5 18 0M6.5 12.5c3-3 8-3 11 0M10 16c1.2-1.2 2.8-1.2 4 0M4 4l16 16'
  };
  function ic(n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + (ICONS[n] || ICONS.info) + '"/></svg>'; }

  /* ---------- derived ---------- */
  function secs() { return q.sections(); }
  function editable() { return secs().filter(function (s) { return !s.built; }); }
  function secBy(id) { return secs().filter(function (s) { return s.id === id; })[0] || secs()[0]; }
  function keyOf(sid) { var i = editable().map(function (s) { return s.id; }).indexOf(sid); return i >= 0 && i < 10 ? SEC_KEYS[i] : ''; }
  function hasBrief() { return st.brief.status !== 'none'; }
  function filed() { return st.brief.status === 'filed'; }
  function rw() { return st.role !== 'read'; }
  function canEdit() { return rw() && !filed(); }
  function sText(sid) { var s = st.brief.sections[sid]; return hasBrief() && s ? s.text : ''; }
  function defSec(r) { return r ? ({ media: 'media', social: 'social', actor: 'actors', narrative: 'narratives', upcoming: 'momentum' })[r.kind] : 'risks'; }
  function signals() { return q.signals().map(function (s) { s.covered = hasBrief() && s.covered; return s; }).sort(function (x, y) { return (y.sig === 'gap') - (x.sig === 'gap'); }); }
  function sigSec(s) { if (s.sig === 'gap') return 'risks'; return st.assigned[s.item] || defSec(q.row(s.item)); }
  function byWeight(x, y) { return q.weight(y).score - q.weight(x).score; }
  function rowsFor(sid) { return q.rows({}).filter(function (r) { return st.assigned[r.id] === sid; }).sort(byWeight); }
  function flagsFor(sid) { return hasBrief() ? q.flags(sid) : []; }
  function secState(sid) {
    var n = rowsFor(sid).length, f = flagsFor(sid).length, t = sText(sid).trim(), s = st.brief.sections[sid];
    if (f) return { key: 'flagged', label: 'Flagged ' + f, chip: 'warn' };
    if (t) return s && s.edited ? { key: 'edited', label: 'Edited', chip: 'ok' } : { key: 'drafted', label: 'Drafted', chip: 'accent' };
    if (n) return { key: 'evidence', label: 'Has evidence', chip: 'info' };
    return { key: 'empty', label: 'Empty', chip: 'neutral' };
  }
  function kindLabel(r) { return ({ media: 'News', social: 'Post', actor: 'Registered actor', narrative: 'Narrative', upcoming: 'Upcoming' })[r.kind] || r.kind; }
  function where(r) {
    if (r.kind === 'media') return r.outlet;
    if (r.kind === 'social') return r.channel + ' post';
    if (r.kind === 'actor') return r.who;
    if (r.kind === 'narrative') return 'Narrative';
    if (r.kind === 'upcoming') return day(r.date);
    return r.kind;
  }
  function day(d) { try { return new Date(d + 'T12:00:00+11:00').toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; } }
  function issueLabel(id) { var x = q.issues().filter(function (i) { return i.id === id; })[0]; return x ? x.label : ''; }
  function layerText(n) { return n === 1 ? 'Layer 1, the platform\'s own programme' : n === 2 ? 'Layer 2, a signed-in session on the agency\'s Mac' : 'Layer 3, a keyless public route'; }
  function fmtElapsed(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function sigChip(s) { var k = { gap: 'danger', spike: 'danger', emerging: 'warn', first_seen: 'info', outlier: 'accent', burst: 'warn' }[s.sig] || 'neutral'; return '<span class="chip chip-' + k + '" title="' + esc(s.title) + '">' + ic(s.sig) + esc(s.label) + '</span>'; }

  /* ---------- painting: keep focus, caret and scroll through a re-render ---------- */
  function fkey(el) {
    if (!el || !el.getAttribute) return '';
    var f = el.getAttribute('data-fid'); if (f) return 'f:' + f;
    var ac = el.getAttribute('data-act'); if (!ac) return '';
    return 'a:' + ac + '|' + (el.getAttribute('data-id') || '') + '|' + (el.getAttribute('data-sec') || '') + '|' + (el.getAttribute('data-val') || '');
  }
  function findKey(host, key) { if (!key) return null; var els = host.querySelectorAll('[data-fid],[data-act]'); for (var i = 0; i < els.length; i++) if (fkey(els[i]) === key) return els[i]; return null; }
  function isEntry(el) { return !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el.tagName === 'INPUT' && /^(text|search|number)$/.test(el.type))); }
  function paint(host, html) {
    if (!host) return;
    var act = document.activeElement, inside = !!act && act !== document.body && host.contains(act);
    var key = inside ? fkey(act) : '', sel = null, sc = {};
    $$('[data-scroll]', host).forEach(function (el) { sc[el.getAttribute('data-scroll')] = [el.scrollTop, el.scrollLeft]; });
    function restore() { $$('[data-scroll]', host).forEach(function (el) { var v = sc[el.getAttribute('data-scroll')]; if (v) { el.scrollTop = v[0]; el.scrollLeft = v[1]; } }); }
    if (inside && isEntry(act)) {
      /* someone is typing: replace only the regions around the field, never the field */
      var tpl = document.createElement('div'); tpl.innerHTML = html;
      var nr = $$('[data-region]', tpl), old = $$('[data-region]', host), map = {}, ok = nr.length > 0 && nr.length === old.length;
      old.forEach(function (el) { map[el.getAttribute('data-region')] = el; });
      nr.forEach(function (el) { if (!map[el.getAttribute('data-region')]) ok = false; });
      if (ok) { nr.forEach(function (el) { var o = map[el.getAttribute('data-region')]; if (o.contains(act)) return; o.parentNode.replaceChild(el, o); }); restore(); return; }
      try { if (act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch (e) { sel = null; }
    }
    host.innerHTML = html; restore();
    if (key) { var t = findKey(host, key); if (t) { try { t.focus({ preventScroll: true }); if (sel) t.setSelectionRange(sel[0], sel[1]); } catch (e2) { /* a number field has no selection */ } } }
  }

  /* ---------- the top bar ---------- */
  function briefChip(status) {
    return status === 'filed' ? '<span class="chip chip-ok">' + ic('check') + 'Filed</span>' : status === 'draft' ? '<span class="chip chip-accent">Draft</span>' : '<span class="chip chip-neutral">No brief</span>';
  }
  function topHtml() {
    var d = q.desk(), c = st.calls, pct = Math.round(100 * c.used / c.cap);
    var h = '<a class="btn btn-quiet back" href="./index.html" title="Prototype: returns to the concept index. In the app this returns to AXIOM.">' + ic('back') + '<span>Back to AXIOM</span></a>';
    h += '<div class="brand"><span class="brand-mark" aria-hidden="true"></span><span class="brand-name">Anne\'s Den</span></div>';
    h += '<div class="desk"><button type="button" class="desk-btn" data-act="deskToggle" aria-haspopup="true" aria-expanded="' + (ui.deskOpen ? 'true' : 'false') + '" aria-label="Desk: ' + esc(d.name) + '. Change desk">' +
      '<span class="desk-name">' + esc(d.name) + '</span>' + briefChip(st.brief.status) + ic('chev') + '</button>';
    if (ui.deskOpen) {
      h += '<div class="menu desk-menu" role="menu" aria-label="Desks"><div class="menu-head">' + esc(q.client().name) + ' <span class="chip chip-neutral">' + esc(q.client().note) + '</span></div>';
      q.desks().forEach(function (x) {
        var cur = x.id === d.id, bs = cur ? st.brief.status : x.brief;
        h += '<button type="button" role="menuitemradio" aria-checked="' + (cur ? 'true' : 'false') + '" class="menu-item' + (cur ? ' is-current' : '') + '" data-act="desk" data-id="' + x.id + '">' +
          '<span class="mi-main"><span class="mi-title">' + esc(x.name) + '</span><span class="mi-sub">' + esc(cap(x.cadence)) + ', ' + (x.windowH === 24 ? '24 hours' : '7 days') + ' &middot; ' + plural(x.rows, 'row') + '</span></span>' +
          (x.gaps ? '<span class="chip chip-danger">' + ic('gap') + plural(x.gaps, 'gap') + '</span>' : '<span class="chip chip-neutral">No gaps</span>') + briefChip(bs) + '</button>';
      });
      h += '</div>';
    }
    h += '</div>';
    h += '<div class="window" title="' + esc(q.windowLabel()) + '">' + ic('clock') + '<span class="window-day">' + esc(day(st.brief.day)) + '</span><span class="window-label">' + esc(q.windowLabel()) + '</span></div>';
    h += '<div class="top-right">';
    if (!rw()) h += '<span class="chip chip-warn chip-lg" role="status">' + ic('lock') + 'Read-only key</span>';
    h += '<div class="calls" title="Model calls today for this desk: ' + c.used + ' of ' + c.cap + '"><span class="calls-label">model calls today: <strong>' + c.used + ' of ' + c.cap + '</strong></span><span class="meter" aria-hidden="true"><span style="width:' + pct + '%"></span></span></div>';
    h += '<button type="button" class="btn btn-quiet btn-icon" data-act="shortcuts" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">' + ic('keys') + '</button>';
    h += '</div>';
    return h;
  }

  /* ---------- the rail: navigation and the six checks, always in view ---------- */
  function railHtml() {
    var props = st.proposals.filter(function (p) { return p.status === 'proposed'; }).length;
    var gaps = st.channels.filter(function (c) { return c.state === 'gap'; }).length;
    var h = '<nav class="nav" aria-label="Den views">';
    ROUTES.forEach(function (r, i) {
      var badge = r === 'watch' && props ? '<span class="nav-badge">' + props + '</span>' : r === 'collection' && gaps && st.mode !== 'nogap' ? '<span class="nav-badge nav-badge-danger">' + gaps + '</span>' : '';
      h += '<a class="nav-link' + (ui.route === r ? ' is-current' : '') + '" href="#' + r + '"' + (ui.route === r ? ' aria-current="page"' : '') + ' title="' + ROUTE_LABEL[r] + (i < 5 ? ' (Alt+' + (i + 1) + ')' : '') + '">' + ROUTE_LABEL[r] + badge + '</a>';
    });
    h += '</nav><div class="checks" role="group" aria-label="The six checks, computed with no model">';
    h += '<span class="checks-label" title="' + esc(q.checks().join(' · ')) + '">6 checks</span>';
    if (st.mode === 'loading') { for (var i = 0; i < 6; i++) h += '<span class="sk sk-pill"></span>'; }
    else if (st.mode === 'error') h += '<span class="chip chip-danger chip-lg">' + ic('alert') + 'The checks could not be read. Nothing is assumed quiet.</span>';
    else {
      var sig = signals(), un = sig.filter(function (s) { return !s.covered; }).length;
      if (!sig.some(function (s) { return s.sig === 'gap'; })) h += '<span class="check check-ok">' + ic('check') + '<span class="check-l">No collection gaps</span></span>';
      sig.forEach(function (s) {
        h += '<button type="button" class="check check-' + s.sig + (s.covered ? ' is-covered' : '') + (ui.check === s.key ? ' is-open' : '') + '" data-act="check" data-id="' + esc(s.key) + '" aria-expanded="' + (ui.check === s.key ? 'true' : 'false') + '" aria-label="' + esc(s.label + ': ' + s.title + '. ' + (s.covered ? 'Covered in the brief' : 'Not yet in the brief')) + '">' +
          ic(s.sig) + '<span class="check-l">' + esc(s.label) + '</span><span class="check-cov" aria-hidden="true">' + (s.covered ? ic('check') : '') + '</span></button>';
      });
      h += '<span class="checks-sum">' + (hasBrief() ? (un ? un + ' not in the brief' : 'all in the brief') : 'no brief yet') + '</span>';
      var open = sig.filter(function (s) { return s.key === ui.check; })[0];
      if (open) {
        var r = open.item ? q.row(open.item) : null;
        h += '<div class="pop check-pop" role="dialog" aria-label="' + esc(open.label) + '"><div class="pop-head">' + sigChip(open) + '<span class="chip chip-' + (open.covered ? 'ok' : 'neutral') + '">' + (open.covered ? ic('check') + 'Covered in the brief' : 'Not yet in the brief') + '</span>' +
          '<button type="button" class="btn btn-quiet btn-icon" data-act="checkClose" aria-label="Close">' + ic('x') + '</button></div>' +
          '<h3 class="pop-title">' + esc(open.title) + '</h3><p class="pop-text">' + esc(open.detail) + '</p>';
        if (open.sig === 'gap') h += '<p class="pop-note">' + ic('alert') + 'A channel that delivered nothing is a gap in what was read, not a quiet day.</p><div class="pop-acts"><a class="btn btn-primary" href="#collection" data-act="checkClose">' + esc(open.fix || 'Open Collection') + '</a></div>';
        else h += '<div class="pop-acts">' + (r ? '<button type="button" class="btn btn-secondary" data-act="showRow" data-id="' + esc(r.id) + '">' + ic('eye') + 'Show the row</button>' : '') +
          '<button type="button" class="btn btn-quiet" data-act="openSection" data-sec="' + sigSec(open) + '">Write it up in ' + esc(secBy(sigSec(open)).title) + '</button></div>';
        h += '</div>';
      }
    }
    h += '</div>';
    return h;
  }

  /* ---------- cards ---------- */
  function chipsFor(r) {
    var c = '';
    if (r.outlets > 1) c += '<span class="chip chip-neutral" title="Also in: ' + esc((r.also || []).join(', ')) + '">' + r.outlets + ' outlets</span>';
    if (r.subscriber) c += '<span class="chip chip-accent" title="Subscriber source: a brief quotes no more than thirty words">' + ic('lock') + 'Subscriber</span>';
    if (r.opinion) c += '<span class="chip chip-neutral">Opinion</span>';
    if (r.mp) c += '<span class="chip chip-info">In office</span>';
    if (r.kind === 'narrative') c += '<span class="chip chip-' + (r.side === 'hostile' ? 'danger' : 'neutral') + '">' + esc(cap(r.side)) + '</span><span class="chip chip-neutral">' + esc(cap(r.status)) + ' &middot; ' + plural(r.n, 'row') + '</span>';
    if (r.kind === 'upcoming') c += r.recorded ? '<span class="chip chip-ok">' + ic('check') + 'Recorded</span>' : '<span class="chip chip-neutral" title="' + esc(r.asWritten) + '">As written</span>';
    signals().forEach(function (s) { if (s.item === r.id) c += sigChip(s); });
    if (hasBrief()) { var ci = q.citedIn(r.id); if (ci.length) c += '<span class="chip chip-ok" title="Cited in ' + esc(ci.map(function (k) { return secBy(k).title; }).join(', ')) + '">' + ic('quote') + 'Cited' + (ci.length > 1 ? ' ×' + ci.length : '') + '</span>'; }
    if (r.low) c += '<span class="chip chip-neutral">Low weight</span>';
    return c;
  }
  function card(r, ctx) {
    var w = q.weight(r), pinned = !!st.pins[r.id], asg = st.assigned[r.id];
    var top = r.kind === 'media' ? esc(r.outlet) + ' <span class="dim">&middot; ' + esc(r.tier) + '</span>' : r.kind === 'social' ? esc(r.channel) + ' <span class="dim">&middot; post</span>' : r.kind === 'actor' ? esc(r.channel) + ' <span class="dim">&middot; registered</span>' : r.kind === 'narrative' ? 'Narrative' : 'Upcoming <span class="dim">&middot; ' + esc(r.what) + '</span>';
    var when = r.kind === 'upcoming' ? day(r.date) : q.when(r.t);
    var h = '<article class="card k-' + r.kind + (pinned ? ' is-pinned' : '') + (st.read[r.id] ? ' is-read' : '') + (r.low ? ' is-low' : '') + '" tabindex="0" data-id="' + esc(r.id) + '" data-ctx="' + ctx + '" data-fid="' + ctx + '-' + esc(r.id) + '"' + (asg ? ' data-sec="' + asg + '"' : '') + (ctx === 'board' && rw() ? ' draggable="true"' : '') + ' aria-label="' + esc(kindLabel(r) + ': ' + (r.who ? r.who + ', ' : '') + r.title) + '">';
    h += '<div class="card-top"><span class="weight w' + (w.score >= 60 ? 3 : w.score >= 30 ? 2 : 1) + '" title="Weight ' + w.score + ' of 100' + (w.why.length ? ': ' + esc(w.why.join(', ')) : '') + '">' + w.score + '</span><span class="card-src">' + ic(r.kind) + '<span>' + top + '</span></span><span class="card-when">' + esc(when) + '</span></div>';
    if (r.kind === 'actor') h += '<div class="card-who"><strong>' + esc(r.who) + '</strong><span>' + esc(r.role) + '</span></div>';
    h += '<h4 class="card-title">' + (pinned ? '<span class="pin-mark" title="Pinned">' + ic('pin') + '</span>' : '') + esc(r.title) + '</h4>';
    if (w.why.length) h += '<p class="card-why">' + esc(w.why.join(' · ')) + '</p>';
    var ch = chipsFor(r); if (ch) h += '<div class="chips">' + ch + '</div>';
    h += '<div class="card-acts">';
    if (ctx === 'brief' && canEdit() && hasBrief()) h += '<button type="button" class="btn btn-row" data-act="cite" data-id="' + esc(r.id) + '" aria-label="Insert the citation for ' + esc(r.title) + '">' + ic('quote') + 'Cite</button>';
    if (ctx === 'board' && rw()) {
      h += '<button type="button" class="btn btn-row btn-icon" data-act="pin" data-id="' + esc(r.id) + '" aria-pressed="' + (pinned ? 'true' : 'false') + '" aria-label="' + (pinned ? 'Unpin' + (asg ? ' and return to Unsorted' : '') : 'Pin') + ': ' + esc(r.title) + '" title="' + (pinned ? 'Unpin' : 'Pin') + ' (P)">' + ic('pin') + '</button>';
      h += '<button type="button" class="btn btn-row btn-icon" data-act="aside" data-id="' + esc(r.id) + '" aria-label="Set aside: ' + esc(r.title) + '" title="Set aside (X)">' + ic('aside') + '</button>';
    }
    h += '<button type="button" class="btn btn-row btn-icon" data-act="openRow" data-id="' + esc(r.id) + '" aria-label="Open: ' + esc(r.title) + '" title="Open (O)">' + ic('open') + '</button></div></article>';
    return h;
  }
  function skCards(n) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="card sk-card" aria-hidden="true"><span class="sk sk-line w40"></span><span class="sk sk-line"></span><span class="sk sk-line w70"></span><span class="sk sk-line w30"></span></div>'; return h; }

  /* ---------- mode notices ---------- */
  function modeBanner() {
    var h = '';
    if (st.mode === 'busy') h += '<div class="notice notice-warn banner" role="status">' + ic('clock') + '<div><strong>The database is busy.</strong> What is on screen is the last good read. Saving will fail until it answers; your words are kept on this computer.</div><button type="button" class="btn btn-secondary" data-act="retry">Try again now</button></div>';
    if (st.mode === 'dropped' && !(st.brief.drafting && st.brief.drafting.dropped)) h += '<div class="notice notice-info banner" role="status">' + ic('wifi') + '<div><strong>Demo state: the connection will drop mid-draft.</strong> Start a draft from the Brief to see it.</div></div>';
    return h;
  }
  function errorPanel() {
    return '<div class="state state-err" role="alert">' + ic('alert', 'state-ic') + '<h2>The desk could not be read</h2><p>The worker answered, but not with this desk\'s window (a gateway page, an older worker, or the wrong shape). Nothing is shown rather than an empty board, because an empty board would read as a quiet day.</p><button type="button" class="btn btn-primary" data-act="retry">' + ic('refresh') + 'Try again</button></div>';
  }

  /* ---------- #today: the board ---------- */
  function unsortedParts() {
    var all = q.rows({}), un = all.filter(function (r) { return !st.assigned[r.id]; });
    var f = un.filter(function (r) { return (ui.filter === 'all' || r.kind === ui.filter) && (!ui.search || (r.title + ' ' + (r.outlet || '') + ' ' + (r.who || '') + ' ' + (r.channel || '')).toLowerCase().indexOf(ui.search.toLowerCase()) >= 0); });
    var main = f.filter(function (r) { return !r.low; }).sort(function (x, y) { return (!!st.pins[y.id] - !!st.pins[x.id]) || byWeight(x, y); });
    return { all: all, un: un, main: main, low: f.filter(function (r) { return r.low; }).sort(byWeight), aside: q.rows({ aside: true }) };
  }
  function boardHtml() {
    if (st.mode === 'loading') return boardSkeleton();
    var p = unsortedParts(), gap = signals().filter(function (s) { return s.sig === 'gap'; })[0];
    var h = '<div class="board" data-scroll="board"><div class="uns-wrap"><section class="col col-unsorted" data-drop="" aria-label="Unsorted: the window\'s triage queue">';
    h += '<header class="col-head" data-region="uns-head"><div class="col-title"><h2>Unsorted</h2><span class="count">' + p.un.length + '</span></div><p class="col-sub">The window\'s triage queue. Drag a card to a section, or focus it and press the section\'s number.</p>';
    if (gap) h += '<a class="gapline" href="#collection">' + ic('gap') + '<span><strong>' + esc(gap.title) + '.</strong> Not a quiet day: see why</span></a>';
    h += '</header>';
    h += '<div class="col-tools" data-region="uns-tools"><label class="field field-search">' + ic('search') + '<span class="vh">Search the unsorted rows</span><input type="search" data-in="search" data-fid="search" placeholder="Search rows (/)" value="' + esc(ui.search) + '" autocomplete="off"></label>';
    h += '<div class="seg" role="group" aria-label="Kind">';
    [['all', 'All'], ['media', 'News'], ['social', 'Posts'], ['actor', 'Actors'], ['narrative', 'Narratives'], ['upcoming', 'Upcoming']].forEach(function (k) {
      var n = k[0] === 'all' ? p.un.length : p.un.filter(function (r) { return r.kind === k[0]; }).length;
      h += '<button type="button" class="seg-btn' + (ui.filter === k[0] ? ' is-on' : '') + '" data-act="filter" data-val="' + k[0] + '" aria-pressed="' + (ui.filter === k[0] ? 'true' : 'false') + '">' + k[1] + '<span class="seg-n">' + n + '</span></button>';
    });
    h += '</div>' + (rw() ? '<button type="button" class="btn btn-quiet btn-sm undo" data-act="undo"' + (st.undo.length ? '' : ' disabled') + ' title="Undo the last pin or set-aside (U)">' + ic('undo') + 'Undo</button>' : '') + '</div>';
    h += '<div class="col-body" data-region="uns-list" data-scroll="uns">';
    if (!p.all.length && !p.aside.length) {
      h += gap ? '<div class="state">' + ic('gap', 'state-ic danger') + '<h3>Nothing was held for this window</h3><p>That is not the same as nothing happening. <strong>' + esc(gap.title) + '</strong>, so the board is empty because a channel was not read. ' + esc(gap.detail) + '</p><a class="btn btn-primary" href="#collection">Open Collection and fix it</a></div>'
        : '<div class="state">' + ic('radar', 'state-ic') + '<h3>Nothing on this desk\'s issues in the window</h3><p>Every channel the desk relies on delivered, and none of it named a desk issue or a registered account.</p><a class="btn btn-secondary" href="#collection">See what each channel delivered</a></div>';
    } else if (!p.main.length && !p.low.length) {
      h += (ui.search || ui.filter !== 'all') ? '<div class="state">' + ic('search', 'state-ic') + '<h3>No unsorted row matches</h3><p>The search and the kind filter leave nothing.</p><button type="button" class="btn btn-secondary" data-act="clearFilters">Clear the filters</button></div>'
        : '<div class="state">' + ic('check', 'state-ic ok') + '<h3>The queue is clear</h3><p>Every row is filed under a section or set aside.</p><a class="btn btn-primary" href="#brief">Open the brief</a></div>';
    } else h += p.main.map(function (r) { return card(r, 'board'); }).join('');
    if (p.low.length) {
      h += '<button type="button" class="group-toggle" data-act="toggleLow" aria-expanded="' + (ui.showLow ? 'true' : 'false') + '">' + ic(ui.showLow ? 'chev' : 'right') + 'Low weight <span class="count">' + p.low.length + '</span><span class="dim">scores 8 or under</span></button>';
      if (ui.showLow) h += p.low.map(function (r) { return card(r, 'board'); }).join('');
    }
    if (p.aside.length) {
      h += '<button type="button" class="group-toggle" data-act="toggleAside" aria-expanded="' + (ui.showAside ? 'true' : 'false') + '">' + ic(ui.showAside ? 'chev' : 'right') + 'Set aside <span class="count">' + p.aside.length + '</span></button>';
      if (ui.showAside) h += p.aside.map(function (r) {
        var why = st.aside[r.id] || 'Muted on this desk';
        return '<div class="aside-row"><div><span class="aside-title">' + esc(r.title) + '</span><span class="aside-why">' + esc(where(r)) + ' &middot; ' + esc(why) + '</span></div>' + (rw() && st.aside[r.id] ? '<button type="button" class="btn btn-row" data-act="restore" data-id="' + esc(r.id) + '" aria-label="Put back: ' + esc(r.title) + '">' + ic('undo') + 'Put back</button>' : '') + '</div>';
      }).join('');
    }
    h += '</div></section></div>';
    h += '<div class="cols" data-region="cols">';
    var sig = signals();
    secs().forEach(function (s) {
      if (s.built) {
        var src = hasBrief() ? q.sourceList() : [];
        h += '<section class="col col-built" data-sec="' + s.id + '" aria-label="' + esc(s.title) + '"><header class="col-head"><div class="col-title"><h3>' + esc(s.title) + '</h3><span class="count">' + src.length + '</span></div><div class="col-meta"><span class="chip chip-neutral">' + ic('lock') + 'Built from citations</span><a class="btn btn-row" href="#brief" data-act="openSection" data-sec="' + s.id + '">View</a></div></header><div class="col-body" data-scroll="col-' + s.id + '">' +
          (src.length ? src.map(function (x) { return '<button type="button" class="src-row" data-act="openRow" data-id="' + esc(x.id) + '"><span class="src-id">' + esc(x.id) + '</span><span class="src-t">' + esc(x.title) + '</span><span class="src-w">' + esc(x.where) + '</span></button>'; }).join('') : '<p class="col-empty">A source appears here when a section cites it. It is never typed.</p>') + '</div></section>';
        return;
      }
      var rows = rowsFor(s.id), state = secState(s.id), un = sig.filter(function (x) { return !x.covered && sigSec(x) === s.id; }), key = keyOf(s.id), text = sText(s.id);
      h += '<section class="col state-' + state.key + '" data-sec="' + s.id + '" data-drop="' + s.id + '" aria-label="' + esc(s.title) + '">';
      h += '<header class="col-head"><div class="col-title"><kbd class="keycap" title="Press ' + key + ' to file the focused card here">' + key + '</kbd><h3>' + esc(s.title) + '</h3><span class="count" title="' + plural(rows.length, 'row') + ' filed here">' + rows.length + '</span></div>';
      h += '<div class="col-meta"><span class="chip chip-' + state.chip + '">' + esc(state.label) + '</span>' + (un.length ? '<span class="chip chip-danger" title="' + esc(un.map(function (x) { return x.title; }).join('; ')) + '">' + ic('alert') + plural(un.length, 'check') + ' uncovered</span>' : '') +
        '<button type="button" class="btn btn-row col-open" data-act="openSection" data-sec="' + s.id + '" aria-label="' + (canEdit() ? 'Write ' : 'Read ') + esc(s.title) + '">' + ic(canEdit() ? 'pen' : 'eye') + (canEdit() ? 'Write' : 'Read') + '</button></div></header>';
      h += '<div class="col-body" data-scroll="col-' + s.id + '">';
      h += rows.length ? rows.map(function (r) { return card(r, 'board'); }).join('') : '<p class="col-empty">' + (rw() ? 'Drop evidence here, or focus a card and press <kbd class="keycap">' + key + '</kbd>.' : 'No evidence is filed under this section.') + '</p>';
      if (text.trim()) h += '<button type="button" class="excerpt" data-act="openSection" data-sec="' + s.id + '" data-val="excerpt" aria-label="Open the text of ' + esc(s.title) + '"><span class="excerpt-h">' + q.words(s.id) + ' words' + (st.brief.sections[s.id].by ? ' &middot; ' + esc(st.brief.sections[s.id].by === 'drafted' ? 'drafted' : 'by ' + st.brief.sections[s.id].by) : '') + '</span><span class="excerpt-t">' + esc(text.replace(/\s*\[[A-Z]:\d+\]/g, '').slice(0, 150)) + (text.length > 150 ? '…' : '') + '</span></button>';
      h += '</div></section>';
    });
    h += '</div></div>';
    return h;
  }
  function boardSkeleton() {
    var h = '<div class="board" aria-busy="true" aria-label="Loading the window"><div class="uns-wrap"><section class="col col-unsorted"><header class="col-head"><div class="col-title"><h2>Unsorted</h2></div><p class="col-sub">Reading the window…</p></header><div class="col-body">' + skCards(5) + '</div></section></div><div class="cols">';
    editable().slice(0, 7).forEach(function (s, i) { h += '<section class="col" data-sec="' + s.id + '"><header class="col-head"><div class="col-title"><kbd class="keycap">' + keyOf(s.id) + '</kbd><h3>' + esc(s.title) + '</h3></div><div class="col-meta"><span class="sk sk-pill"></span></div></header><div class="col-body">' + skCards(i % 3 === 0 ? 2 : 1) + '</div></section>'; });
    return h + '</div></div>';
  }

  /* ---------- #brief: a section opened as a writing surface ---------- */
  function citeChip(id) {
    var r = q.row(id);
    if (!r) return '<span class="cite cite-bad" title="This id is not in the window\'s evidence">' + ic('alert') + 'Not in the evidence: ' + esc(id) + '</span>';
    return '<button type="button" class="cite k-' + r.kind + '" data-act="openRow" data-id="' + esc(id) + '" title="' + esc(r.title + ' — ' + where(r) + ', ' + (r.kind === 'upcoming' ? day(r.date) : q.when(r.t))) + '" aria-label="Citation: ' + esc(where(r) + ', ' + r.title) + '">' + ic(r.kind) + '<span>' + esc(where(r)) + '</span></button>';
  }
  function sentenceHtml(sen) { return sen.split(/(\[[A-Z]:\d+\])/).map(function (part) { var m = /^\[([A-Z]:\d+)\]$/.exec(part); return m ? citeChip(m[1]) : esc(part); }).join(''); }
  function readHtml(sid) {
    var text = sText(sid);
    if (!text.trim()) return '<p class="read-empty">Nothing is written here yet. Type above, and click a card on the right to tie a sentence to its evidence.</p>';
    var flags = flagsFor(sid), used = {}, h = '';
    text.split(/\n+/).forEach(function (para) {
      if (!para.trim()) return;
      h += '<p>' + q.sentences(para).map(function (sen) {
        var fl = flags.filter(function (f, i) { if (f.sentence.trim() === sen.trim()) { used[i] = 1; return true; } return false; });
        if (!fl.length) return '<span class="sen">' + sentenceHtml(sen) + '</span>';
        return '<mark class="sen flagged">' + sentenceHtml(sen) + fl.map(function (f) { return '<span class="flag" role="note">' + ic('alert') + esc(f.text) + '</span>'; }).join('') + '</mark>';
      }).join(' ') + '</p>';
    });
    var rest = flags.filter(function (f, i) { return !used[i]; });
    if (rest.length) h += '<ul class="flag-list">' + rest.map(function (f) { return '<li><span class="flag">' + ic('alert') + esc(f.text) + '</span> ' + esc(f.sentence) + '</li>'; }).join('') + '</ul>';
    return h;
  }
  function outlineHtml() {
    var sig = signals();
    var h = '<div class="outline-head"><h2>Sections</h2><span class="dim">' + (hasBrief() ? q.fmt(q.words()) + ' words' : 'no brief') + '</span></div><ol class="outline-list">';
    secs().forEach(function (s) {
      var cur = ui.section === s.id, key = keyOf(s.id);
      if (s.built) { h += '<li><button type="button" class="ol-item' + (cur ? ' is-current' : '') + '" data-act="section" data-sec="' + s.id + '"' + (cur ? ' aria-current="true"' : '') + '><span class="keycap keycap-ghost">' + ic('lock') + '</span><span class="ol-main"><span class="ol-title">' + esc(s.title) + '</span><span class="ol-sub">' + (hasBrief() ? plural(q.sourceList().length, 'source') + ', built' : 'built from citations') + '</span></span></button></li>'; return; }
      var state = secState(s.id), un = sig.filter(function (x) { return !x.covered && sigSec(x) === s.id; }).length, n = rowsFor(s.id).length;
      h += '<li><button type="button" class="ol-item' + (cur ? ' is-current' : '') + '" data-act="section" data-sec="' + s.id + '"' + (cur ? ' aria-current="true"' : '') + ' aria-label="' + esc(s.title + ', ' + state.label + ', ' + plural(n, 'row') + ' of evidence') + '"><kbd class="keycap">' + key + '</kbd><span class="ol-main"><span class="ol-title">' + esc(s.title) + '</span><span class="ol-sub">' + (hasBrief() ? q.words(s.id) + ' words' : '') + ' &middot; ' + plural(n, 'card') + '</span></span>' +
        (un ? '<span class="dot dot-danger" title="' + plural(un, 'check') + ' uncovered"></span>' : '') + '<span class="chip chip-' + state.chip + ' chip-sm">' + esc(state.label) + '</span></button></li>';
    });
    return h + '</ol>';
  }
  function draftingHtml() {
    var d = st.brief.drafting;
    if (d.dropped) return '<div class="state state-err" role="alert">' + ic('wifi', 'state-ic danger') + '<h2>The connection dropped mid-draft</h2><p>The page stopped hearing from the worker while the brief was being written. The draft may have finished there without this page. Nothing you typed was lost, and asking again is not a second model call.</p><div class="state-acts"><button type="button" class="btn btn-primary" data-act="checkDraft">' + ic('refresh') + 'Check for the draft</button>' + '<a class="btn btn-quiet" href="#today">Back to the board</a></div></div>';
    ui.stages[d.n] = d.stage;
    var h = '<div class="drafting" role="status" aria-live="polite"><div class="drafting-head"><span class="spinner" aria-hidden="true"></span><div><h2>Drafting the brief</h2><p>1 model call &middot; ' + plural(d.evidence, 'row') + ' of evidence &middot; ' + d.pinned + ' pinned &middot; elapsed <strong id="draft-elapsed">' + fmtElapsed(Date.now() - d.t0) + '</strong></p></div></div><ol class="stepper">';
    for (var i = 1; i <= d.of; i++) h += '<li class="step ' + (i < d.n ? 'is-done' : i === d.n ? 'is-now' : '') + '"' + (i === d.n ? ' aria-current="step"' : '') + '><span class="step-n">' + (i < d.n ? ic('check') : i) + '</span><span class="step-t">' + esc(ui.stages[i] || (i === d.n ? d.stage : 'Step ' + i)) + '</span></li>';
    h += '</ol><div class="drafting-sk"><span class="sk sk-line w40"></span><span class="sk sk-line"></span><span class="sk sk-line"></span><span class="sk sk-line w70"></span></div><p class="dim">The page keeps its connection while the worker writes. Every sentence that comes back is checked against the row it cites.</p></div>';
    return h;
  }
  function startHtml() {
    var n = q.rows({}).length, gap = signals().filter(function (s) { return s.sig === 'gap'; })[0];
    if (!n) return '<div class="state">' + ic(gap ? 'gap' : 'file', 'state-ic' + (gap ? ' danger' : '')) + '<h2>No brief yet, and nothing to cite</h2><p>No evidence is held for this window, so a draft would have nothing behind it. ' + (gap ? '<strong>' + esc(gap.title) + '</strong>: fix collection first, or write by hand and say what was not read.' : 'Check what each channel delivered, or write by hand.') + '</p><div class="state-acts"><a class="btn btn-primary" href="#collection">Open Collection</a>' + (rw() ? '<button type="button" class="btn btn-secondary" data-act="byHand">' + ic('pen') + 'Write by hand</button>' : '') + '</div></div>';
    return '<div class="state">' + ic('file', 'state-ic') + '<h2>No brief for today</h2><p>' + plural(n, 'row') + ' of evidence in the window, ' + Object.keys(st.pins).length + ' pinned. A draft writes all ten sections from them; writing by hand starts them empty.</p>' + (rw() ? '<div class="state-acts"><button type="button" class="btn btn-primary" data-act="draftAsk">' + ic('play') + 'Draft the brief <span class="cost">1 model call</span></button><button type="button" class="btn btn-secondary" data-act="byHand">' + ic('pen') + 'Write by hand</button></div>' : '<p class="dim">This key is read-only.</p>') + '</div>';
  }
  function saveStateHtml() {
    var b = st.brief, s = b.save;
    if (filed()) return '<span class="save save-ok">' + ic('check') + 'Filed' + (b.filedBy ? ' by ' + esc(b.filedBy) : '') + ' &middot; revision ' + b.revision + '</span>';
    if (s === 'unsaved') return '<span class="save save-warn"><span class="dot dot-warn"></span>Unsaved changes, kept on this computer</span>';
    if (s === 'saving') return '<span class="save"><span class="spinner spinner-sm" aria-hidden="true"></span>Saving…</span>';
    if (s === 'failed') return '<span class="save save-danger">' + ic('alert') + 'Not saved: the database is busy. Your words are kept here.</span>';
    return '<span class="save save-ok">' + ic('check') + 'Saved, revision ' + b.revision + '</span>';
  }
  function barHtml() {
    var un = signals().filter(function (s) { return !s.covered; }).length, fc = hasBrief() ? q.flagCount() : 0;
    var h = '<div class="bar-left" role="status">' + saveStateHtml() + (hasBrief() ? '<span class="bar-stat">' + q.fmt(q.words()) + ' words</span><span class="bar-stat' + (fc ? ' is-warn' : '') + '">' + plural(fc, 'flag') + '</span><span class="bar-stat' + (un ? ' is-danger' : '') + '">' + (un ? plural(un, 'check') + ' uncovered' : 'all checks covered') + '</span>' : '') + '</div><div class="bar-right">';
    if (hasBrief()) {
      h += '<button type="button" class="btn btn-quiet btn-fold" data-act="history" aria-label="History" title="History">' + ic('history') + '<span class="btn-t">History</span></button><button type="button" class="btn btn-quiet btn-fold" data-act="exportOpen" aria-label="Export" title="Export">' + ic('download') + '<span class="btn-t">Export</span></button>';
      if (rw()) {
        if (filed()) h += '<button type="button" class="btn btn-secondary" data-act="reopen">' + ic('pen') + 'Reopen</button>';
        else {
          h += '<button type="button" class="btn btn-quiet" data-act="draftAsk"' + (st.brief.drafting ? ' disabled' : '') + '>' + ic('play') + 'Redraft <span class="cost">1 model call</span></button>';
          h += '<button type="button" class="btn btn-secondary" data-act="save"' + (st.brief.save === 'saving' ? ' disabled' : '') + ' title="Save (Ctrl or Cmd+S)">' + (st.brief.save === 'failed' ? 'Save again' : 'Save') + '</button>';
          h += '<button type="button" class="btn btn-primary" data-act="fileAsk"' + (st.brief.drafting ? ' disabled' : '') + '>' + ic('file') + 'Mark as filed</button>';
        }
      }
    }
    return h + '</div>';
  }
  function evidencePaneHtml() {
    var sid = ui.section, sec = secBy(sid), h = '';
    if (sec.built) return '<div class="ev-head" data-region="ev-head"><h2>Evidence</h2></div><div class="ev-body" data-region="ev-list"><p class="col-empty">The Source List has no evidence of its own. It is the rows the other sections cite, in order.</p></div>';
    var mine = rowsFor(sid), citedHere = hasBrief() ? q.cites(sText(sid)) : [];
    var extra = citedHere.filter(function (id, i) { return citedHere.indexOf(id) === i && st.assigned[id] !== sid && q.row(id); }).map(function (id) { return q.row(id); });
    var un = signals().filter(function (s) { return !s.covered && sigSec(s) === sid; });
    h += '<div class="ev-head" data-region="ev-head"><h2>Evidence for this section</h2><span class="count">' + (mine.length + extra.length) + '</span><p class="col-sub">' + (canEdit() && hasBrief() ? 'Click a card to insert its citation where the cursor was.' : 'What was filed under this section.') + '</p></div>';
    h += '<div class="ev-body" data-scroll="ev" data-region="ev-list">';
    if (un.length) h += '<div class="notice notice-danger">' + ic('alert') + '<div><strong>' + plural(un.length, 'check') + ' this section should cover</strong>' + un.map(function (s) { return '<div class="un-row"><span>' + esc(s.title) + '</span>' + (s.item && canEdit() && hasBrief() ? '<button type="button" class="btn btn-row" data-act="cite" data-id="' + esc(s.item) + '" data-val="signal">' + ic('quote') + 'Cite its row</button>' : s.sig === 'gap' ? '<a class="btn btn-row" href="#collection">Why</a>' : '') + '</div>'; }).join('') + '</div></div>';
    if (!mine.length && !extra.length) h += '<div class="state state-sm">' + ic('board', 'state-ic') + '<h3>Nothing is filed under ' + esc(sec.title) + '</h3><p>File rows here from the board, or pull one from the window below.</p><a class="btn btn-secondary" href="#today">Go to the board</a></div>';
    h += mine.map(function (r) { return card(r, 'brief'); }).join('');
    if (extra.length) h += '<h3 class="ev-sub">Cited here, filed elsewhere</h3>' + extra.map(function (r) { return card(r, 'brief'); }).join('');
    h += '</div>';
    var pool = q.rows({ search: ui.pullSearch || undefined }).filter(function (r) { return st.assigned[r.id] !== sid && !r.low; }).sort(byWeight);
    h += '<div class="ev-pull-head" data-region="ev-pull-head"><button type="button" class="group-toggle" data-act="togglePull" aria-expanded="' + (ui.pull ? 'true' : 'false') + '">' + ic(ui.pull ? 'chev' : 'right') + 'Pull from the rest of the window <span class="count">' + pool.length + '</span></button></div>';
    if (ui.pull) {
      h += '<div class="ev-pull-tools" data-region="ev-pull-tools"><label class="field field-search">' + ic('search') + '<span class="vh">Search the window</span><input type="search" data-in="pullSearch" data-fid="pull-search" placeholder="Search the window" value="' + esc(ui.pullSearch) + '" autocomplete="off"></label></div>';
      h += '<div class="ev-pull" data-scroll="pull" data-region="ev-pull">' + (pool.length ? pool.slice(0, 14).map(function (r) { return card(r, 'brief'); }).join('') : '<p class="col-empty">No row matches.</p>') + '</div>';
    }
    return h;
  }
  function centreHtml() {
    var sid = ui.section, sec = secBy(sid), s = st.brief.sections[sid], b = st.brief, h = '';
    if (b.drafting) return '<div class="centre-inner" data-region="drafting">' + draftingHtml() + '</div>';
    if (!hasBrief()) return '<div class="centre-inner" data-region="start">' + startHtml() + '</div>';
    var list = secs(), idx = list.map(function (x) { return x.id; }).indexOf(sid), state = sec.built ? null : secState(sid);
    h += '<div class="centre-inner"><div data-region="sec-notices">';
    if (filed()) h += '<div class="notice notice-ok">' + ic('check') + '<div><strong>This brief is filed' + (b.filedBy ? ' by ' + esc(b.filedBy) : '') + '.</strong> It is final until someone reopens it. Exports are below.</div></div>';
    if (b.conflict) {
      var c = b.conflict;
      h += '<div class="notice notice-warn conflict" role="alert">' + ic('alert') + '<div><strong>' + esc(c.by) + ' saved ' + esc(secBy(c.section).title) + ' while you were editing it.</strong> Nothing has been overwritten.<div class="conflict-grid"><div><span class="label">Yours</span><p>' + esc(sText(c.section) || '(empty)') + '</p></div><div><span class="label">' + esc(c.by) + '\'s</span><p>' + esc(c.theirs) + '</p></div></div><div class="state-acts"><button type="button" class="btn btn-primary" data-act="resolve" data-val="mine">Keep mine</button><button type="button" class="btn btn-secondary" data-act="resolve" data-val="theirs">Take theirs</button></div></div></div>';
    }
    h += '</div>';
    h += '<header class="sec-head" data-region="sec-head" data-sec="' + sid + '"><div class="sec-kicker"><span class="spine-dot"></span>Section ' + (idx + 1) + ' of ' + list.length + (state ? '<span class="chip chip-' + state.chip + '">' + esc(state.label) + '</span>' : '<span class="chip chip-neutral">' + ic('lock') + 'Built, never typed</span>') + '</div>' +
      '<div class="sec-title-row"><h1>' + esc(sec.title) + '</h1><div class="sec-nav"><button type="button" class="btn btn-quiet btn-icon" data-act="stepSec" data-val="-1" aria-label="Previous section"' + (idx <= 0 ? ' disabled' : '') + '>' + ic('left') + '</button><button type="button" class="btn btn-quiet btn-icon" data-act="stepSec" data-val="1" aria-label="Next section"' + (idx >= list.length - 1 ? ' disabled' : '') + '>' + ic('right') + '</button></div></div>';
    if (!sec.built) h += '<div class="sec-meta"><span>' + q.words(sid) + ' words</span><span>' + esc(s.by === 'drafted' ? 'Drafted, not yet edited' : 'Last written by ' + (s.by || 'nobody')) + '</span>' + (s.dirty ? '<span class="save-warn">Unsaved</span>' : '') +
      (canEdit() ? '<button type="button" class="btn btn-secondary btn-sm" data-act="regen" data-sec="' + sid + '"' + (s.busy ? ' disabled' : '') + '>' + ic('refresh') + 'Regenerate this section <span class="cost">1 model call</span></button>' : '') + '</div>';
    h += '</header>';
    if (sec.built) {
      var src = q.sourceList();
      h += '<div class="read source" data-region="source"><p class="dim">Built from the citations in the ten sections, in the order they first appear. It cannot be edited: cite a row and it appears; remove the last citation and it goes.</p>' + (src.length ? '<ol class="source-list">' + src.map(function (x) { return '<li><button type="button" class="src-line" data-act="openRow" data-id="' + esc(x.id) + '"><span class="src-id">' + esc(x.id) + '</span><span class="src-t">' + esc(x.title) + '</span><span class="src-w">' + esc(x.where) + ' &middot; ' + esc(x.when) + '</span></button></li>'; }).join('') + '</ol>' : '<div class="state state-sm"><h3>No sources yet</h3><p>Nothing in the brief cites a row.</p></div>') + '</div></div>';
      return h;
    }
    if (sec.rating) {
      var R = q.ratings(), item = R.items.filter(function (x) { return x.id === sec.rating; })[0], val = b.ratings[sec.rating] || {};
      if (item) {
        h += '<div class="rating" data-region="rating"><span class="label">' + esc(item.label) + ' rating</span><label class="field"><span class="vh">' + esc(item.label) + ' level</span><select data-in="rating" data-id="' + item.id + '" data-val="level" data-fid="rating-level"' + (canEdit() ? '' : ' disabled') + '>' + R.levels.map(function (l) { return '<option' + (val.level === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></label>';
        if (item.trend) h += '<label class="field"><span class="vh">' + esc(item.label) + ' trend</span><select data-in="rating" data-id="' + item.id + '" data-val="trend" data-fid="rating-trend"' + (canEdit() ? '' : ' disabled') + '>' + R.trends.map(function (l) { return '<option' + (val.trend === l ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select></label>';
        h += '<span class="dim">Set here, where the assessment is written. Only the desk\'s own words are offered.</span></div>';
      }
    }
    h += '<div class="editor' + (s.busy ? ' is-busy' : '') + '" data-region="editor"><label class="label" for="sec-text">' + (canEdit() ? 'Write' : 'Text') + ' <span class="dim">citations are typed as [M:1]; clicking a card inserts one</span></label>' +
      '<textarea id="sec-text" data-in="edit" data-sec="' + sid + '" data-fid="ta-' + sid + '" spellcheck="true"' + (canEdit() && !s.busy ? '' : ' readonly') + ' placeholder="Write ' + esc(sec.title) + '. Every factual sentence needs the row it rests on.">' + esc(s.text) + '</textarea>' +
      (s.busy ? '<div class="editor-busy" role="status"><span class="spinner" aria-hidden="true"></span>Regenerating this section from its evidence… 1 model call</div>' : '') + '</div>';
    h += '<section class="read" data-region="read" aria-label="As it reads"><h2 class="label">As it reads <span class="dim">citations resolved, flags at the sentence they concern</span></h2>' + readHtml(sid) + '</section>';
    return h + '</div>';
  }
  function briefHtml() {
    if (st.mode === 'loading') return '<div class="brief" aria-busy="true"><aside class="outline"><div class="outline-head"><h2>Sections</h2></div>' + new Array(9).join('<span class="sk sk-row"></span>') + '</aside><div class="centre"><div class="centre-scroll"><div class="centre-inner"><span class="sk sk-line w30"></span><span class="sk sk-title"></span><span class="sk sk-block"></span><span class="sk sk-line"></span><span class="sk sk-line w70"></span></div></div></div><aside class="evidence"><div class="ev-head"><h2>Evidence for this section</h2></div><div class="ev-body">' + skCards(3) + '</div></aside></div>';
    return '<div class="brief" data-sec="' + ui.section + '"><aside class="outline" aria-label="Sections of the brief" data-region="outline" data-scroll="outline">' + outlineHtml() + '</aside>' +
      '<div class="centre"><div class="centre-scroll" data-scroll="centre">' + centreHtml() + '</div><footer class="bar" data-region="bar">' + barHtml() + '</footer></div>' +
      '<aside class="evidence" aria-label="Evidence for this section">' + evidencePaneHtml() + '</aside></div>';
  }

  /* ---------- #watch ---------- */
  function watchHtml() {
    if (st.mode === 'loading') return '<div class="page page-2"><div class="panel">' + skCards(3) + '</div><div class="panel">' + skCards(2) + '</div></div>';
    var wait = st.proposals.filter(function (p) { return p.status === 'proposed'; }), done = st.proposals.filter(function (p) { return p.status !== 'proposed'; });
    var h = '<div class="page page-2"><section class="panel" aria-label="Proposals" data-scroll="watch-l"><header class="panel-head" data-region="w-head"><div><h1>Proposals</h1><p class="col-sub">What the window suggests this desk should also watch. A proposal is read by nothing until a person approves it; a dismissal needs a reason and is never proposed again.</p></div><span class="count count-lg">' + wait.length + '</span></header>';
    if (!wait.length) h += '<div class="state" data-region="w-empty">' + ic('check', 'state-ic ok') + '<h3>Nothing is waiting</h3><p>Discovery runs once a day for each desk and proposes only what recurs. The next pass is tomorrow morning.</p><a class="btn btn-secondary" href="#today">Back to the board</a></div>';
    wait.forEach(function (p) {
      var pv = ui.preview[p.id];
      h += '<article class="card prop" tabindex="0" data-pid="' + p.id + '" data-fid="prop-' + p.id + '" data-region="prop-' + p.id + '" aria-label="Proposed ' + esc(p.kind + ': ' + p.value) + '"><div class="prop-top"><span class="weight w' + (p.score >= 75 ? 3 : p.score >= 55 ? 2 : 1) + '" title="Score ' + p.score + '">' + p.score + '</span><span class="chip chip-neutral">' + esc(cap(p.kind)) + '</span><h3 class="prop-value">' + esc(p.value) + '</h3>' + (p.name ? '<span class="dim">' + esc(p.name) + '</span>' : '') + '</div>';
      h += '<p class="prop-reason">' + esc(p.reason) + '</p><div class="chips"><span class="dim">Evidence</span>' + (p.evidence || []).map(citeChip).join('') + '</div>';
      if (pv && p.preview) h += '<div class="preview" role="region" aria-label="Preview of ' + esc(p.value) + '"><div class="stat-row"><div class="stat"><span class="stat-n">' + p.preview.held + '</span><span class="stat-l">rows already on the desk</span></div><div class="stat"><span class="stat-n">+' + p.preview.add + '</span><span class="stat-l">rows it would add</span></div><div class="stat"><span class="stat-n">' + p.preview.au + '</span><span class="stat-l">of those say something Australian</span></div></div><ul class="sample">' + p.preview.sample.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="dim">Counted from what is already held. Nothing was fetched or written.</p></div>';
      h += '<div class="prop-acts">';
      h += p.preview ? '<button type="button" class="btn btn-quiet" data-act="preview" data-id="' + p.id + '" aria-expanded="' + (pv ? 'true' : 'false') + '">' + ic('eye') + (pv ? 'Hide preview' : 'Preview') + '</button>' : '<span class="dim prop-nopreview">Preview is for terms</span>';
      if (rw()) {
        h += '<span class="grow"></span><label class="field field-inline"><span class="field-l">Approve under</span><select data-in="issueFor" data-id="' + p.id + '" data-fid="issue-' + p.id + '"><option value="">No issue (searched, tags nothing)</option>' + q.issues().map(function (i) { return '<option value="' + i.id + '"' + (ui.issueFor[p.id] === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' +
          '<button type="button" class="btn btn-primary" data-act="approve" data-id="' + p.id + '">' + ic('check') + 'Approve</button><button type="button" class="btn btn-danger-quiet" data-act="dismissAsk" data-id="' + p.id + '">Dismiss…</button>';
      }
      h += '</div></article>';
    });
    if (done.length) h += '<div data-region="w-done"><h2 class="ev-sub">Decided</h2>' + done.map(function (p) { return '<div class="aside-row"><div><span class="aside-title">' + esc(p.value) + ' <span class="chip chip-' + (p.status === 'active' ? 'ok' : 'neutral') + '">' + (p.status === 'active' ? 'Approved' : 'Dismissed') + '</span></span><span class="aside-why">' + (p.status === 'active' ? (p.issue ? 'Tags ' + esc(issueLabel(p.issue)) : 'Searched for, tags nothing') : 'Reason: ' + esc(p.reason2 || '')) + '</span></div></div>'; }).join('') + '</div>';
    h += '</section><section class="panel" aria-label="The watch register" data-scroll="watch-r" data-region="w-reg"><header class="panel-head"><div><h1>The register</h1><p class="col-sub">What this desk reads, by kind. Switching a line off stops it being read; nothing is deleted.</p></div><span class="count count-lg">' + st.register.filter(function (r) { return r.status === 'active'; }).length + '</span></header>';
    [['term', 'Terms'], ['account', 'Accounts'], ['hashtag', 'Hashtags'], ['outlet', 'Outlets'], ['group', 'Public groups']].forEach(function (k) {
      var rows = st.register.filter(function (r) { return r.kind === k[0]; });
      h += '<h2 class="ev-sub">' + k[1] + ' <span class="count">' + rows.length + '</span></h2>';
      if (!rows.length) { h += '<p class="col-empty">None registered. Approve a proposal of this kind to add one.</p>'; return; }
      h += '<ul class="rows">' + rows.map(function (r) {
        var on = r.status === 'active', dis = r.status === 'dismissed';
        return '<li class="row' + (on ? '' : ' is-off') + '"><div class="row-main"><span class="row-title">' + esc(r.value) + (r.name ? ' <span class="dim">' + esc(r.name) + '</span>' : '') + '</span><span class="row-sub">' +
          (r.platform ? esc(r.platform) + ' &middot; ' : '') + (r.actor ? (r.actor === 'official' ? 'public official' : r.actor === 'org' ? 'organisation' : r.actor) + ' &middot; ' : '') + (dis ? 'Dismissed: ' + esc(r.reason || '') + '. Never proposed again.' : r.error ? '' : 'last matched ' + esc(q.ago(r.last))) + '</span></div>' +
          (r.issue ? '<span class="chip chip-neutral">' + esc(issueLabel(r.issue)) + '</span>' : '') + (r.review ? '<span class="chip chip-warn" title="Approved thirty days ago and has matched nothing since">' + ic('clock') + 'Review</span>' : '') + (r.error ? '<span class="chip chip-danger">' + ic('gap') + esc(cap(r.error)) + '</span>' : '') +
          (dis ? '<span class="chip chip-neutral">Dismissed</span>' : '<button type="button" class="switch" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-act="regToggle" data-id="' + r.id + '" aria-label="Read ' + esc(r.value) + '"' + (rw() ? '' : ' disabled') + '><span></span></button>') + '</li>';
      }).join('') + '</ul>';
    });
    return h + '</section></div>';
  }

  /* ---------- #collection ---------- */
  function chanState(c) {
    if (c.off) return '<span class="chip chip-neutral">Switched off</span>';
    if (c.state === 'gap' && st.mode !== 'nogap') return '<span class="chip chip-danger">' + ic('gap') + 'Not collected</span>';
    if (c.state === 'paused') return '<span class="chip chip-warn">' + ic('clock') + 'Paused</span>';
    if (c.state === 'quiet') return '<span class="chip chip-neutral">Quiet, and read</span>';
    return '<span class="chip chip-ok">' + ic('check') + 'Delivering</span>';
  }
  function collectionHtml() {
    if (st.mode === 'loading') return '<div class="page"><div class="panel"><span class="sk sk-title"></span>' + new Array(7).join('<span class="sk sk-row"></span>') + '</div></div>';
    var ch = st.channels, gaps = ch.filter(function (c) { return c.state === 'gap' && st.mode !== 'nogap'; }), job = st.job, running = job && !job.done;
    var h = '<div class="page" data-scroll="coll"><section class="panel" aria-label="Channels"><header class="panel-head"><div><h1>What each channel delivered</h1><p class="col-sub">For ' + esc(q.desk().name) + ', ' + esc(q.windowLabel()) + '. A channel with a zero is either quiet and read, or not read at all: the state says which.</p></div>' +
      '<div class="stat-row"><div class="stat"><span class="stat-n">' + ch.filter(function (c) { return c.d1 > 0; }).length + ' of ' + ch.length + '</span><span class="stat-l">channels delivered</span></div><div class="stat"><span class="stat-n' + (gaps.length ? ' is-danger' : '') + '">' + gaps.length + '</span><span class="stat-l">gaps</span></div><div class="stat"><span class="stat-n">' + ch.reduce(function (n, c) { return n + c.d1; }, 0) + '</span><span class="stat-l">rows in 24 hours</span></div></div></header>';
    h += '<div class="table" role="table" aria-label="Channels"><div class="tr th" role="row"><span role="columnheader">Channel</span><span role="columnheader">How it is read</span><span role="columnheader" class="num">24 h</span><span role="columnheader" class="num">7 d</span><span role="columnheader">Last read</span><span role="columnheader">State</span><span role="columnheader" class="tr-acts">Collect now / read for this desk</span></div>';
    ch.forEach(function (c) {
      var isGap = c.state === 'gap' && st.mode !== 'nogap', mine = job && job.channel === c.id;
      h += '<div class="tr' + (isGap ? ' is-gap' : '') + (c.off ? ' is-off' : '') + '" role="row"><span role="cell" class="td-title">' + esc(c.label) + '</span><span role="cell" class="td-how">' + esc(c.how) + ' <span class="chip chip-neutral chip-sm">' + (c.by === 'mac' ? 'the Mac' : 'the worker') + '</span></span><span role="cell" class="num' + (c.d1 ? '' : ' zero') + '">' + c.d1 + '</span><span role="cell" class="num">' + c.d7 + '</span><span role="cell">' + esc(q.ago(c.last)) + '</span><span role="cell">' + chanState(c) + '</span><span role="cell" class="tr-acts">' +
        (rw() ? '<button type="button" class="btn btn-row" data-act="collect" data-id="' + c.id + '"' + (running || c.off ? ' disabled' : '') + (running ? ' title="One job at a time"' : '') + ' aria-label="Collect ' + esc(c.label) + ' now">' + (mine && running ? '<span class="spinner spinner-sm" aria-hidden="true"></span>Collecting' : ic('play') + 'Collect now') + '</button>' : '') +
        '<button type="button" class="switch" role="switch" aria-checked="' + (c.off ? 'false' : 'true') + '" data-act="chanToggle" data-id="' + c.id + '" aria-label="Read ' + esc(c.label) + ' for this desk"' + (rw() ? '' : ' disabled') + '><span></span></button></span>';
      if ((isGap || c.state === 'paused' || c.state === 'quiet') && c.why) h += '<div role="cell" class="tr-note ' + (isGap ? 'note-danger' : c.state === 'paused' ? 'note-warn' : 'note-quiet') + '">' + ic(isGap ? 'gap' : c.state === 'paused' ? 'clock' : 'info') + '<span><strong>' + (isGap ? 'Why it is a gap: ' : c.state === 'paused' ? 'Why it is paused: ' : 'Why it is quiet: ') + '</strong>' + esc(c.why) + (c.fix ? ' <strong>The fix:</strong> ' + esc(c.fix) : '') + '</span></div>';
      if (mine) h += '<div role="cell" class="tr-console"><div class="console" role="log" aria-live="polite" aria-label="Collection console for ' + esc(c.label) + '"><div class="console-head"><span>' + (job.done ? (job.failed ? 'Failed' : 'Finished') : 'Running') + ' &middot; ' + esc(c.label) + '</span><span class="chip chip-' + (job.done ? (job.failed ? 'danger' : 'ok') : 'info') + ' chip-sm">' + (job.done ? (job.failed ? 'failed' : 'done') : 'live') + '</span></div><pre>' + (job.lines.length ? job.lines.map(function (l) { return '<span class="' + (/^failed/.test(l) ? 'ln-err' : /^\$/.test(l) ? 'ln-cmd' : '') + '">' + esc(l) + '</span>'; }).join('\n') : '<span class="dim">waiting for the first line…</span>') + (job.done ? '' : '<span class="caret"></span>') + '</pre></div></div>';
      h += '</div>';
    });
    h += '</div></section>';
    h += '<div class="grid-3"><section class="panel" aria-label="Parliament pages"><header class="panel-head"><div><h2>Parliament pages</h2><p class="col-sub">Watched for a stage or a date changing. Labelled status and dates only.</p></div></header><ul class="rows">' + q.pages().map(function (p) { return '<li class="row"><div class="row-main"><span class="row-title">' + esc(p.name) + '</span><span class="row-sub">' + esc(p.house) + ' &middot; read ' + esc(q.ago(p.read)) + '</span></div><span class="chip chip-neutral">' + esc(p.stage) + '</span><span class="chip chip-info">' + ic('upcoming') + esc(day(p.next)) + '</span></li>'; }).join('') + '</ul></section>';
    h += '<section class="panel" aria-label="Petition counters"><header class="panel-head"><div><h2>Petition counters</h2><p class="col-sub">The campaign pages\' own counts, so self-reported. A count not found is an error, never a zero.</p></div></header><ul class="rows">' + q.petitions().map(function (p) { return '<li class="row"><div class="row-main"><span class="row-title">' + esc(p.name) + '</span><span class="row-sub">' + esc(p.host) + ' &middot; self-reported</span></div><span class="big-n">' + q.fmt(p.count) + '</span><span class="chip chip-' + (p.d1 > 500 ? 'warn' : 'neutral') + '">+' + q.fmt(p.d1) + ' in a day</span></li>'; }).join('') + '</ul></section>';
    var rc = q.recall();
    h += '<section class="panel" aria-label="Recall"><header class="panel-head"><div><h2>Recall</h2><p class="col-sub">Of the links in ' + rc.reports + ' filed reports, the share the desk held by the end of the next day. This is the measure of the work.</p></div><span class="big-n">' + Math.round(rc.share * 100) + '%</span></header><ul class="bars">' + rc.by.map(function (x) { var pc = Math.round(x[1] * 100); return '<li><span class="bar-l">' + esc(x[0]) + '</span><span class="bar-track"><span class="bar-fill' + (pc < 50 ? ' is-low' : '') + '" style="width:' + pc + '%"></span></span><span class="bar-n">' + pc + '%</span></li>'; }).join('') + '</ul></section></div></div>';
    return h;
  }

  /* ---------- #options ---------- */
  function optionsHtml() {
    var o = st.options, dis = rw() ? '' : ' disabled';
    function sw(key, label, sub) { return '<li class="row"><div class="row-main"><span class="row-title">' + label + '</span><span class="row-sub">' + sub + '</span></div><button type="button" class="switch" role="switch" aria-checked="' + (o[key] ? 'true' : 'false') + '" data-act="optToggle" data-val="' + key + '" aria-label="' + esc(label) + '"' + dis + '><span></span></button></li>'; }
    var h = '<div class="page" data-scroll="opts"><div class="grid-2"><section class="panel" aria-label="Display and triage" data-region="o-main"><header class="panel-head"><div><h1>Options</h1><p class="col-sub">For ' + esc(q.desk().name) + '. ' + (rw() ? 'Changes apply at once.' : 'This key is read-only: the settings can be read, not changed.') + '</p></div></header><ul class="rows">' +
      '<li class="row"><div class="row-main"><span class="row-title">Density</span><span class="row-sub">How much each card shows on the board.</span></div><div class="seg" role="group" aria-label="Density">' + ['regular', 'compact'].map(function (d) { return '<button type="button" class="seg-btn' + (o.density === d ? ' is-on' : '') + '" data-act="density" data-val="' + d + '" aria-pressed="' + (o.density === d ? 'true' : 'false') + '"' + dis + '>' + cap(d) + '</button>'; }).join('') + '</div></li>' +
      sw('fold', 'Fold syndicated copies', 'One card for a story that ran in several outlets, with the count.') +
      sw('autoDraft', 'Draft the brief each morning', 'Off by default. On, it spends <strong>1 model call</strong> a day for this desk.') + '</ul></section>';
    h += '<section class="panel" aria-label="Thresholds" data-region="o-thr"><header class="panel-head"><div><h2>Thresholds</h2></div></header><ul class="rows"><li class="row"><div class="row-main"><label class="row-title" for="opt-min">Smallest post worth a card</label><span class="row-sub">Posts under this many interactions go to Low weight.</span></div><div class="field"><input id="opt-min" type="number" min="0" max="5000" step="5" data-in="minInt" data-fid="opt-min" value="' + esc(o.minInteractions) + '"' + dis + '></div></li></ul></section></div>';
    h += '<div class="grid-2"><section class="panel" aria-label="Mutes" data-region="o-mutes"><header class="panel-head"><div><h2>Muted on this desk</h2><p class="col-sub">A mute is offered after the third set-aside of one outlet or account, and a person confirms it.</p></div><span class="count count-lg">' + st.mutes.length + '</span></header>' +
      (st.mutes.length ? '<ul class="rows">' + st.mutes.map(function (m) { return '<li class="row"><div class="row-main"><span class="row-title">' + esc(m.value) + '</span><span class="row-sub">' + esc(cap(m.kind)) + '</span></div>' + (rw() ? '<button type="button" class="btn btn-row" data-act="unmute" data-val="' + esc(m.value) + '">' + ic('undo') + 'Unmute</button>' : '') + '</li>'; }).join('') + '</ul>' : '<div class="state state-sm">' + ic('mute', 'state-ic') + '<h3>Nothing is muted</h3><p>Set-aside rows are on the board under Set aside, each with its reason.</p><a class="btn btn-secondary" href="#today">Go to the board</a></div>') + '</section>';
    h += '<section class="panel" aria-label="Report format" data-region="o-fmt"><header class="panel-head"><div><h2>Report format</h2><p class="col-sub">The sections are the board\'s columns, in this order. Ratings offer these words and no others.</p></div></header><ol class="fmt">' + secs().map(function (s) { return '<li data-sec="' + s.id + '"><span class="spine-dot"></span>' + esc(s.title) + (s.built ? ' <span class="chip chip-neutral chip-sm">built</span>' : '') + (s.rating ? ' <span class="chip chip-neutral chip-sm">rating</span>' : '') + '</li>'; }).join('') + '</ol><div class="chips"><span class="dim">Levels</span>' + q.ratings().levels.map(function (l) { return '<span class="chip chip-neutral">' + esc(l) + '</span>'; }).join('') + '</div><div class="chips"><span class="dim">Trends</span>' + q.ratings().trends.map(function (l) { return '<span class="chip chip-neutral">' + esc(l) + '</span>'; }).join('') + '</div></section></div></div>';
    return h;
  }

  /* ---------- #system: the design system ---------- */
  function hex2rgb(hx) { hx = String(hx).trim(); var m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hx); if (!m) return null; var s = m[1]; if (s.length === 3) s = s.replace(/./g, '$&$&'); return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]; }
  function lum(c) { var v = c.map(function (x) { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }
  function ratio(x, y) { var A = hex2rgb(x), B = hex2rgb(y); if (!A || !B) return null; var l1 = lum(A), l2 = lum(B); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  var PAIRS = [['--ink-0', '--bg-0'], ['--ink-0', '--surface-2'], ['--ink-1', '--surface-1'], ['--ink-1', '--surface-2'], ['--ink-2', '--bg-1'], ['--ink-2', '--surface-1'], ['--ink-2', '--surface-2'], ['--ink-2', '--surface-3'],
    ['--accent-ink', '--accent'], ['--accent-text', '--surface-2'], ['--accent-text', '--accent-bg'], ['--ok-ink', '--ok-bg'], ['--warn-ink', '--warn-bg'], ['--danger-ink', '--danger-bg'], ['--info-ink', '--info-bg'], ['--ink-1', '--neutral-bg'], ['--danger-solid-ink', '--danger-solid']];
  var SWATCHES = ['--bg-0', '--bg-1', '--surface-1', '--surface-2', '--surface-3', '--line-1', '--line-2', '--ink-0', '--ink-1', '--ink-2', '--ink-3', '--accent', '--accent-bg', '--accent-text', '--ok', '--ok-bg', '--ok-ink', '--warn', '--warn-bg', '--warn-ink', '--danger', '--danger-bg', '--danger-ink', '--info', '--info-bg', '--info-ink'];
  function themeBlock(theme) {
    return '<div class="theme-demo" data-theme="' + theme + '" data-tokens="' + theme + '"><h3>' + cap(theme) + (theme === 'light' ? ' <span class="chip chip-neutral chip-sm">tokens ready; the views ship dark</span>' : '') + '</h3><div class="swatches" data-fill="swatches"></div><table class="ctable"><thead><tr><th>Text on ground</th><th>Sample</th><th>Ratio</th><th>AA</th></tr></thead><tbody data-fill="pairs"></tbody></table></div>';
  }
  function fillTokens() {
    $$('[data-tokens]').forEach(function (box) {
      var cs = getComputedStyle(box), get = function (t) { return cs.getPropertyValue(t).trim(); };
      var sw = $('[data-fill="swatches"]', box), tb = $('[data-fill="pairs"]', box);
      if (sw) sw.innerHTML = SWATCHES.map(function (t) { return '<div class="swatch"><span style="background:var(' + t + ')"></span><code>' + t.slice(2) + '</code><code class="dim">' + esc(get(t)) + '</code></div>'; }).join('');
      if (tb) tb.innerHTML = PAIRS.map(function (p) { var r = ratio(get(p[0]), get(p[1])); return '<tr><td><code>' + p[0].slice(2) + '</code> on <code>' + p[1].slice(2) + '</code></td><td><span class="csample" style="color:var(' + p[0] + ');background:var(' + p[1] + ')">Ferry levy 2,140</span></td><td class="num">' + (r ? r.toFixed(2) + ' : 1' : 'n/a') + '</td><td>' + (r ? (r >= 4.5 ? '<span class="chip chip-ok chip-sm">AA</span>' : r >= 3 ? '<span class="chip chip-warn chip-sm">large only</span>' : '<span class="chip chip-danger chip-sm">fails</span>') : '') + '</td></tr>'; }).join('');
    });
  }
  function systemHtml() {
    var demoRow = q.row('M:1') || {}, h = '<div class="page sys" data-scroll="sys">';
    h += '<header class="sys-head"><p class="sec-kicker">Concept A &middot; The Storyboard</p><h1>Design system</h1><p class="lead">A studio pinboard done with restraint: a deep slate ground, cards that are really raised, one colour per report section used only as a spine, Manrope for display and DM Sans for text. Every value below is a custom property at the top of <code>concept-a.css</code>.</p></header>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Demo states</h2><p class="col-sub">Each link reloads the prototype in that state. The buttons act on the running page.</p></div></header><div class="chips dev">' +
      [['', 'Normal'], ['loading&hold=1', 'Loading (held)'], ['loading', 'Loading'], ['empty', 'Empty'], ['error', 'Error'], ['busy', 'Busy database'], ['dropped', 'Dropped mid-draft'], ['readonly', 'Read-only key'], ['filed', 'Filed'], ['nogap', 'No gap']].map(function (x) { return '<a class="btn btn-secondary btn-sm" href="' + (x[0] ? '?state=' + x[0] : '?') + '#today">' + x[1] + '</a>'; }).join('') +
      '</div><div class="chips dev"><button type="button" class="btn btn-quiet btn-sm" data-act="simConflict">Simulate a conflict on the brief</button><button type="button" class="btn btn-quiet btn-sm" data-act="simMute">Simulate the mute offer</button><button type="button" class="btn btn-quiet btn-sm" data-act="role" data-val="' + (rw() ? 'read' : 'full') + '">Switch to a ' + (rw() ? 'read-only' : 'full') + ' key</button><button type="button" class="btn btn-quiet btn-sm" data-act="simToast">Show a toast</button></div></section>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Colour</h2><p class="col-sub">Semantic tokens, dark and light, with the contrast of each text and ground pair measured from the computed values.</p></div></header><div class="grid-2">' + themeBlock('dark') + themeBlock('light') + '</div>' +
      '<h3 class="ev-sub">Section spines</h3><div class="spines">' + secs().map(function (s) { return '<span class="spine-chip" data-sec="' + s.id + '"><span class="spine-dot"></span>' + esc(s.title) + '</span>'; }).join('') + '</div><p class="dim">A spine is a 3px rule or a dot. It is never the colour of text and never the only carrier of a state.</p></section>';
    h += '<div class="grid-2"><section class="panel"><header class="panel-head"><div><h2>Type</h2></div></header><div class="type-scale">' +
      [['--fs-3xl', 'Display', 'Manrope 700'], ['--fs-2xl', 'Page title', 'Manrope 700'], ['--fs-xl', 'Section title', 'Manrope 650'], ['--fs-lg', 'Card title, reading text', 'DM Sans 500'], ['--fs-md', 'Body', 'DM Sans 400'], ['--fs-sm', 'Meta and controls', 'DM Sans 500'], ['--fs-xs', 'Chips and labels', 'DM Sans 600']].map(function (t, i) { return '<div class="type-row"><code>' + t[0].slice(2) + '</code><span style="font-size:var(' + t[0] + ');font-family:' + (i < 3 ? 'var(--font-display)' : 'var(--font-text)') + ';font-weight:' + (i < 3 ? 700 : 500) + '">' + t[1] + '</span><span class="dim">' + t[2] + '</span></div>'; }).join('') + '</div></section>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Space, radius, elevation, motion</h2></div></header><div class="sys-row"><span class="label">Space</span>' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (n) { return '<span class="sp-demo"><i style="width:var(--sp-' + n + ');height:var(--sp-' + n + ')"></i><code>sp-' + n + '</code></span>'; }).join('') + '</div>' +
      '<div class="sys-row"><span class="label">Radius</span>' + ['xs', 'sm', 'md', 'lg', 'pill'].map(function (n) { return '<span class="rad-demo" style="border-radius:var(--r-' + n + ')"><code>r-' + n + '</code></span>'; }).join('') + '</div>' +
      '<div class="sys-row"><span class="label">Elevation</span>' + [1, 2, 3, 4].map(function (n) { return '<span class="el-demo" style="box-shadow:var(--e-' + n + ')"><code>e-' + n + '</code></span>'; }).join('') + '</div>' +
      '<div class="sys-row"><span class="label">Motion</span><span class="mo-demo" tabindex="0">hover or focus<br><code>dur-1 120ms</code></span><span class="mo-demo mo-2" tabindex="0">lift<br><code>dur-2 200ms</code></span><span class="mo-demo mo-3" tabindex="0">enter<br><code>dur-3 320ms</code></span></div><p class="dim">One easing (<code>--ease</code>). Motion only confirms a change the person made: a card lifting, a drawer arriving, a toast. Under <code>prefers-reduced-motion</code> every animation and transition is cut to nothing.</p></section></div>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Buttons</h2><p class="col-sub">Five ranks. The smallest hit area is 32px; a paid button states its cost in the label.</p></div></header><div class="comp-grid">' +
      [['btn-primary', 'Primary'], ['btn-secondary', 'Secondary'], ['btn-quiet', 'Quiet'], ['btn-danger', 'Danger'], ['btn-danger-quiet', 'Danger, quiet'], ['btn-row', 'Row action']].map(function (b) { return '<div class="comp"><span class="label">' + b[1] + '</span><div class="chips"><button type="button" class="btn ' + b[0] + '">' + ic('check') + 'Default</button><button type="button" class="btn ' + b[0] + ' is-hover">Hover</button><button type="button" class="btn ' + b[0] + ' is-focus">Focus</button><button type="button" class="btn ' + b[0] + '" disabled>Disabled</button></div></div>'; }).join('') +
      '<div class="comp"><span class="label">With a cost, busy, icon only</span><div class="chips"><button type="button" class="btn btn-primary">' + ic('play') + 'Draft the brief <span class="cost">1 model call</span></button><button type="button" class="btn btn-secondary" disabled><span class="spinner spinner-sm"></span>Saving…</button><button type="button" class="btn btn-quiet btn-icon" aria-label="Example icon button">' + ic('keys') + '</button><button type="button" class="btn btn-secondary btn-sm">Small</button></div></div></div></section>';
    h += '<div class="grid-2"><section class="panel"><header class="panel-head"><div><h2>Chips, checks, keys</h2><p class="col-sub">Status is a filled chip with an icon, never an outline in a different ink.</p></div></header><div class="chips">' + ['neutral', 'accent', 'info', 'ok', 'warn', 'danger'].map(function (k) { return '<span class="chip chip-' + k + '">' + ic(k === 'ok' ? 'check' : k === 'danger' ? 'gap' : 'info') + cap(k) + '</span>'; }).join('') + '<span class="chip chip-ok chip-sm">Small</span><span class="chip chip-warn chip-lg">' + ic('lock') + 'Large</span></div>' +
      '<div class="chips"><span class="check check-gap">' + ic('gap') + '<span class="check-l">Not collected</span><span class="check-cov"></span></span><span class="check check-spike">' + ic('spike') + '<span class="check-l">Spike</span><span class="check-cov"></span></span><span class="check check-emerging is-covered">' + ic('emerging') + '<span class="check-l">Emerging</span><span class="check-cov">' + ic('check') + '</span></span><span class="check check-ok">' + ic('check') + '<span class="check-l">No collection gaps</span></span></div>' +
      '<div class="chips"><kbd class="keycap">3</kbd><kbd class="keycap">J</kbd><kbd class="keycap keycap-wide">Alt</kbd><span class="weight w3">82</span><span class="weight w2">44</span><span class="weight w1">8</span>' + citeChip('M:1') + citeChip('S:1') + citeChip('P:2') + citeChip('X:99') + '<span class="flag">' + ic('alert') + 'No evidence behind</span></div></section>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Fields</h2></div></header><div class="comp-grid"><label class="field"><span class="field-l">Text</span><input type="text" value="ferry levy"></label><label class="field"><span class="field-l">Select</span><select><option>Ferry levy</option><option>Fare cap</option></select></label><label class="field field-search">' + ic('search') + '<span class="vh">Search example</span><input type="search" placeholder="Search rows"></label><label class="field is-invalid"><span class="field-l">With an error</span><input type="text" value="" aria-invalid="true"><span class="field-err">A reason is needed before a dismissal.</span></label><label class="field"><span class="field-l">Disabled</span><input type="text" value="read-only key" disabled></label>' +
      '<div class="chips"><button type="button" class="switch" role="switch" aria-checked="true" aria-label="Example switch, on"><span></span></button><button type="button" class="switch" role="switch" aria-checked="false" aria-label="Example switch, off"><span></span></button><button type="button" class="switch" role="switch" aria-checked="true" aria-label="Example switch, disabled" disabled><span></span></button><div class="seg" role="group" aria-label="Example segmented control"><button type="button" class="seg-btn is-on" aria-pressed="true">All<span class="seg-n">32</span></button><button type="button" class="seg-btn" aria-pressed="false">News<span class="seg-n">14</span></button></div><label class="radio"><input type="radio" name="sysr" checked><span>Not relevant</span></label><label class="radio"><input type="radio" name="sysr"><span>Duplicate</span></label></div></div></section></div>';
    h += '<div class="grid-2"><section class="panel"><header class="panel-head"><div><h2>Cards and columns</h2><p class="col-sub">Default, pinned and filed under a section, focused, dragging, low weight.</p></div></header><div class="card-demo">' +
      (demoRow.id ? card(demoRow, 'system') + card(q.row('S:2'), 'system').replace('class="card ', 'class="card is-focus ') + card(q.row('P:4'), 'system').replace('class="card ', 'class="card is-dragging ') + card(q.row('M:16'), 'system') : '') + '</div>' +
      '<div class="chips">' + [['empty', 'neutral', 'Empty'], ['evidence', 'info', 'Has evidence'], ['drafted', 'accent', 'Drafted'], ['edited', 'ok', 'Edited'], ['flagged', 'warn', 'Flagged 1']].map(function (x) { return '<span class="chip chip-' + x[1] + '">' + x[2] + '</span>'; }).join('') + '<span class="chip chip-danger">' + ic('alert') + '1 check uncovered</span></div><p class="col-empty drop-on">A drop target: drop evidence here, or press <kbd class="keycap">3</kbd>.</p></section>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Notices, states, skeleton</h2></div></header><div class="notice notice-info">' + ic('info') + '<div><strong>Information.</strong> A proposal is read by nothing until a person approves it.</div></div><div class="notice notice-ok">' + ic('check') + '<div><strong>Done.</strong> This brief is filed.</div></div><div class="notice notice-warn">' + ic('clock') + '<div><strong>Wait.</strong> The database is busy.</div><button type="button" class="btn btn-secondary btn-sm">Try again</button></div><div class="notice notice-danger">' + ic('gap') + '<div><strong>A gap.</strong> Facebook delivered nothing in this window. Not a quiet day.</div></div>' +
      '<div class="state state-sm">' + ic('check', 'state-ic ok') + '<h3>The queue is clear</h3><p>An empty state says why, and offers the one action that helps.</p><button type="button" class="btn btn-secondary">Open the brief</button></div><div class="card sk-card"><span class="sk sk-line w40"></span><span class="sk sk-line"></span><span class="sk sk-line w70"></span></div></section></div>';
    h += '<div class="grid-2"><section class="panel"><header class="panel-head"><div><h2>Stepper, console, toast</h2></div></header><ol class="stepper"><li class="step is-done"><span class="step-n">' + ic('check') + '</span><span class="step-t">Gathering the window\'s evidence</span></li><li class="step is-now"><span class="step-n">2</span><span class="step-t">Writing ten sections</span></li><li class="step"><span class="step-n">3</span><span class="step-t">Step 3</span></li></ol>' +
      '<div class="console"><div class="console-head"><span>Finished &middot; Bluesky</span><span class="chip chip-ok chip-sm">done</span></div><pre><span>queued: Bluesky</span>\n<span class="ln-cmd">$ sweep bluesky --desk hf_au</span>\n<span>12 hits, 9 Australian kept</span>\n<span class="ln-err">failed: no_collector (an example of a failure line)</span></pre></div>' +
      '<div class="toast toast-info toast-static">' + ic('check') + '<span>Set aside. Press U to undo.</span><button type="button" class="btn btn-quiet btn-icon" aria-label="Dismiss the example toast">' + ic('x') + '</button></div><div class="toast toast-warn toast-static">' + ic('alert') + '<span>This key is read-only: nothing was changed.</span></div></section>';
    h += '<section class="panel"><header class="panel-head"><div><h2>Dialog, drawer, rows</h2><p class="col-sub">A dialog is the top elevation, traps focus and closes on Esc. The drawer is the evidence reader and does not block the board.</p></div></header><div class="dialog dialog-static" role="group" aria-label="Example dialog"><h2>Set this row aside?</h2><p>It leaves the board and the draft. The reason is kept with it.</p><div class="dialog-acts"><button type="button" class="btn btn-quiet">Cancel</button><button type="button" class="btn btn-primary">Set aside</button></div></div>' +
      '<ul class="rows"><li class="row"><div class="row-main"><span class="row-title">ferry levy</span><span class="row-sub">last matched 24 min ago</span></div><span class="chip chip-neutral">Ferry levy</span><button type="button" class="btn btn-row">' + ic('undo') + 'Row action</button></li><li class="row is-off"><div class="row-main"><span class="row-title">boats</span><span class="row-sub">Dismissed: generic</span></div><span class="chip chip-neutral">Dismissed</span></li></ul></section></div>';
    return h + '</div>';
  }

  /* ---------- the drawer: one row, read in place ---------- */
  function drawerHtml() {
    var r = ui.open ? q.row(ui.open) : null; if (!r) return '';
    var w = q.weight(r), cited = hasBrief() ? q.citedIn(r.id) : [], sg = signals().filter(function (s) { return s.item === r.id; }), asg = st.assigned[r.id], isAside = !!st.aside[r.id];
    var h = '<aside class="drawer" role="dialog" aria-label="Evidence: ' + esc(r.title) + '"' + (asg ? ' data-sec="' + asg + '"' : '') + '><header class="drawer-head"><span class="card-src">' + ic(r.kind) + '<span>' + esc(kindLabel(r)) + ' &middot; ' + esc(r.id) + '</span></span><button type="button" class="btn btn-quiet btn-icon" data-act="closeDrawer" data-fid="drawer-close" aria-label="Close (Esc)">' + ic('x') + '</button></header><div class="drawer-body" data-scroll="drawer">';
    if (r.kind === 'actor') h += '<div class="card-who"><strong>' + esc(r.who) + '</strong><span>' + esc(r.role) + ' &middot; a registered public actor, named on their own post</span></div>';
    h += '<h2 class="drawer-title">' + esc(r.title) + '</h2><dl class="facts">';
    function fact(k, v) { h += '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
    if (r.kind === 'media') { fact('Outlet', esc(r.outlet) + ' <span class="dim">(' + esc(r.tier) + ')</span>'); if (r.outlets > 1) fact('Also ran in', esc((r.also || []).join(', '))); fact('Facebook reactions', q.fmt(r.fb)); }
    if (r.kind === 'social' || r.kind === 'actor') { fact('Channel', esc(r.channel)); fact('Interactions', q.fmt(r.eng) + (r.growth ? ' <span class="chip chip-warn chip-sm">+' + q.fmt(r.growth) + ' since yesterday</span>' : '')); }
    if (r.kind === 'social') { fact('Comments held', q.fmt(r.comments) + ' <span class="dim">(no commenter is recorded)</span>'); fact('Tone of held comments', '<span class="tone"><span class="tone-fill" style="left:' + Math.round(50 + r.tone * 50) + '%"></span></span> ' + (r.tone < -0.15 ? 'hostile' : r.tone > 0.15 ? 'warm' : 'mixed')); fact('Found by', esc(r.foundBy)); }
    if (r.kind === 'narrative') { fact('Claim', esc(r.claim)); fact('Stance toward the client', esc(cap(r.side))); fact('Rows', r.n + ' in all, ' + r.n24 + ' in the last day'); fact('Spread, in order', esc((r.spread || []).join(' → '))); }
    if (r.kind === 'upcoming') { fact('Date', esc(day(r.date))); fact('What', esc(cap(r.what))); fact('As written', '“' + esc(r.asWritten) + '”'); fact('Basis', r.recorded ? 'Recorded on a watched page' : 'Read from a headline, never guessed'); if (r.from && q.row(r.from)) fact('From', citeChip(r.from)); }
    if (r.kind !== 'upcoming') fact('When', esc(q.when(r.t)) + ' <span class="dim">Australian Eastern</span>');
    if (r.issue) fact('Issue', esc(issueLabel(r.issue)));
    if (r.layer) fact('Collected by', esc(layerText(r.layer)));
    h += '</dl>';
    if (r.kind === 'social') h += '<p class="drawer-note">' + ic('info') + 'Social rows carry no author. Only a registered public actor is named, and only on their own post.</p>';
    if (r.kind === 'media' && r.text) h += '<div class="held"><span class="label">' + (r.subscriber ? 'Subscriber text: thirty words, and a brief quotes no more' : r.full ? 'Held text' : 'Summary') + '</span><p>' + esc(r.subscriber ? r.text.split(/\s+/).slice(0, 30).join(' ') + '…' : r.text) + '</p></div>';
    h += '<div class="held"><span class="label">Weight ' + w.score + ' of 100, and why</span>' + (w.why.length ? '<ul class="why">' + w.why.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="dim">Nothing lifts it: little reach, one outlet, no check names it.</p>') + '</div>';
    if (sg.length) h += '<div class="held"><span class="label">Checks that name it</span><div class="chips">' + sg.map(sigChip).join('') + '</div></div>';
    h += '<div class="held"><span class="label">Cited in</span>' + (cited.length ? '<div class="chips">' + cited.map(function (k) { return '<button type="button" class="btn btn-row" data-act="openSection" data-sec="' + k + '" data-id="' + esc(r.id) + '">' + esc(secBy(k).title) + '</button>'; }).join('') + '</div>' : '<p class="dim">Not cited yet.</p>') + '</div>';
    if (rw() && !isAside) {
      h += '<div class="held"><span class="label">File under a section</span><div class="assign-grid">' + editable().map(function (s) { return '<button type="button" class="assign' + (asg === s.id ? ' is-on' : '') + '" data-sec="' + s.id + '" data-act="assign" data-id="' + esc(r.id) + '" aria-pressed="' + (asg === s.id ? 'true' : 'false') + '"><kbd class="keycap">' + keyOf(s.id) + '</kbd><span>' + esc(s.title) + '</span></button>'; }).join('') + '</div></div>';
    }
    h += '</div><footer class="drawer-foot">';
    if (isAside) h += '<span class="dim">Set aside: ' + esc(st.aside[r.id]) + '</span>' + (rw() ? '<button type="button" class="btn btn-secondary" data-act="restore" data-id="' + esc(r.id) + '">' + ic('undo') + 'Put back</button>' : '');
    else if (rw()) {
      if (ui.route === 'brief' && canEdit() && hasBrief() && !secBy(ui.section).built) h += '<button type="button" class="btn btn-primary" data-act="cite" data-id="' + esc(r.id) + '" data-val="drawer">' + ic('quote') + 'Cite in ' + esc(secBy(ui.section).title) + '</button>';
      h += '<button type="button" class="btn btn-secondary" data-act="pin" data-id="' + esc(r.id) + '" data-val="drawer" aria-pressed="' + (st.pins[r.id] ? 'true' : 'false') + '">' + ic('pin') + (st.pins[r.id] ? 'Unpin' : 'Pin') + '</button><button type="button" class="btn btn-danger-quiet" data-act="aside" data-id="' + esc(r.id) + '" data-val="drawer">' + ic('aside') + 'Set aside…</button>';
    } else h += '<span class="dim">Read-only key: the row can be read, not filed.</span>';
    return h + '</footer></aside>';
  }

  /* ---------- dialogs ---------- */
  function dialogHtml() {
    var d = ui.dialog; if (!d) return '';
    var h = '<div class="backdrop" data-act="backdrop"></div><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title"' + (d.wide ? ' data-wide="1"' : '') + '>';
    function acts(inner) { return '<div class="dialog-acts">' + inner + '</div>'; }
    var cancel = '<button type="button" class="btn btn-quiet" data-act="closeDialog">Cancel</button>';
    if (d.type === 'aside') {
      var r = q.row(d.id) || {};
      h += '<h2 id="dlg-title">Set this row aside</h2><p class="dialog-sub">' + esc(r.title) + '</p><fieldset class="radios"><legend class="label">Why</legend>' + q.asideReasons().map(function (x, i) { return '<label class="radio"><input type="radio" name="aside-reason" value="' + esc(x) + '"' + (i === 0 ? ' checked data-autofocus' : '') + '><span>' + esc(x) + '</span></label>'; }).join('') + '</fieldset><label class="field"><span class="field-l">A note, if the reason is Other</span><input type="text" id="aside-note" maxlength="80"></label><p class="dim">It leaves the board and any draft. It can be put back, and U undoes it.</p>' + acts(cancel + '<button type="button" class="btn btn-primary" data-act="asideGo" data-primary>Set aside</button>');
    } else if (d.type === 'mute') {
      h += '<h2 id="dlg-title">Mute ' + esc(d.offer.value) + ' on this desk?</h2><p>That is the third row from this ' + esc(d.offer.kind) + ' you have set aside. Muted, its rows stop reaching the board for this desk. Other desks are untouched, and Options can undo it.</p>' + acts('<button type="button" class="btn btn-quiet" data-act="closeDialog" data-autofocus>Not now</button><button type="button" class="btn btn-primary" data-act="muteGo" data-primary>' + ic('mute') + 'Mute it</button>');
    } else if (d.type === 'draft') {
      var n = q.rows({}).length, ed = Object.keys(st.brief.sections).filter(function (k) { return st.brief.sections[k].edited && sText(k).trim(); }).length;
      h += '<h2 id="dlg-title">Draft the brief</h2><div class="stat-row"><div class="stat"><span class="stat-n">' + n + '</span><span class="stat-l">rows of evidence in the window</span></div><div class="stat"><span class="stat-n">' + Object.keys(st.pins).length + '</span><span class="stat-l">pinned, and sure to be used</span></div><div class="stat"><span class="stat-n">' + (st.calls.cap - st.calls.used) + '</span><span class="stat-l">model calls left today</span></div></div><p>One model call writes all ten sections from what is filed on the board. Every sentence comes back tied to a row, or flagged.</p>' + (ed && hasBrief() ? '<div class="notice notice-warn">' + ic('alert') + '<div><strong>' + plural(ed, 'section') + ' you edited will be replaced.</strong> The current revision stays in History.</div></div>' : '') + acts(cancel + '<button type="button" class="btn btn-primary" data-act="draftGo" data-primary data-autofocus>' + ic('play') + 'Draft the brief <span class="cost">1 model call</span></button>');
    } else if (d.type === 'regen') {
      h += '<h2 id="dlg-title">Regenerate ' + esc(secBy(d.sec).title) + '</h2><p>One model call rewrites this section from the ' + plural(rowsFor(d.sec).length, 'row') + ' filed under it. ' + (st.brief.sections[d.sec].edited ? '<strong>Your edits to it will be replaced.</strong>' : 'The other sections are untouched.') + '</p><label class="field"><span class="field-l">An instruction, if you have one</span><input type="text" id="regen-note" placeholder="For example: lead with the crossbench" data-autofocus></label>' + acts(cancel + '<button type="button" class="btn btn-primary" data-act="regenGo" data-primary>' + ic('refresh') + 'Regenerate <span class="cost">1 model call</span></button>');
    } else if (d.type === 'file') {
      h += '<h2 id="dlg-title">Before it is filed</h2><p>The checks found ' + plural(d.uncovered.length, 'thing') + ' the brief neither cites nor names. This is asked once.</p><ul class="rows">' + d.uncovered.map(function (s) { return '<li class="row"><div class="row-main"><span class="row-title">' + esc(s.title) + '</span><span class="row-sub">' + esc(s.detail) + '</span></div>' + sigChip(s) + '</li>'; }).join('') + '</ul>' + acts('<button type="button" class="btn btn-secondary" data-act="fileBack" data-autofocus>Go back and cover them</button><button type="button" class="btn btn-primary" data-act="fileAnyway" data-primary>File anyway</button>');
    } else if (d.type === 'history') {
      h += '<h2 id="dlg-title">History</h2><p class="dialog-sub">' + esc(q.desk().name) + ', ' + esc(day(st.brief.day)) + '. The last sixty revisions are kept.</p><ul class="rows">' + st.brief.history.slice().reverse().map(function (x, i) { return '<li class="row"><div class="row-main"><span class="row-title">Revision ' + x.rev + (i === 0 ? ' <span class="chip chip-accent chip-sm">current</span>' : '') + '</span><span class="row-sub">' + (x.by === 'drafted' ? 'Drafted by the model' : 'Saved by ' + esc(x.by)) + ' &middot; ' + esc(q.when(x.at)) + '</span></div></li>'; }).join('') + '</ul>' + acts('<button type="button" class="btn btn-primary" data-act="closeDialog" data-autofocus data-primary>Close</button>');
    } else if (d.type === 'export') {
      h += '<h2 id="dlg-title">Export the brief</h2><p class="dialog-sub">' + q.fmt(q.words()) + ' words, ' + plural(q.sourceList().length, 'source') + (filed() ? ', filed' : ', not yet filed') + '.</p><div class="export-grid">' +
        [['doc', 'copy', 'Copy for the document', 'Rich text and plain text on the clipboard'], ['md', 'download', 'Download .md', 'Markdown, with the Source List'], ['html', 'download', 'Download .html', 'A standalone page'], ['slack', 'send', 'Copy the Slack summary', 'The summary and the rating']].map(function (x, i) { return '<button type="button" class="export" data-act="export" data-val="' + x[0] + '"' + (i === 0 ? ' data-autofocus' : '') + '>' + ic(x[1]) + '<span class="export-t">' + x[2] + '</span><span class="export-s">' + x[3] + '</span></button>'; }).join('') + '</div>' + acts('<button type="button" class="btn btn-quiet" data-act="closeDialog">Close</button>');
    } else if (d.type === 'dismiss') {
      var p = st.proposals.filter(function (x) { return x.id === d.id; })[0] || {};
      h += '<h2 id="dlg-title">Dismiss “' + esc(p.value) + '”</h2><p>A dismissed proposal is never proposed again, so the reason is kept with it.</p><label class="field' + (d.err ? ' is-invalid' : '') + '"><span class="field-l">Reason (required)</span><input type="text" id="dismiss-reason" maxlength="120" data-autofocus aria-required="true"' + (d.err ? ' aria-invalid="true" aria-describedby="dismiss-err"' : '') + ' value="' + esc(d.val || '') + '">' + (d.err ? '<span class="field-err" id="dismiss-err" role="alert">A reason is needed before a dismissal.</span>' : '') + '</label>' + acts(cancel + '<button type="button" class="btn btn-danger" data-act="dismissGo" data-primary>Dismiss</button>');
    } else if (d.type === 'shortcuts') {
      var K = function (k) { return '<kbd class="keycap' + (k.length > 1 ? ' keycap-wide' : '') + '">' + k + '</kbd>'; };
      h += '<h2 id="dlg-title">Keyboard</h2><div class="keys-grid">' + [
        [K('J') + K('K'), 'Next and previous card'], [K('1') + '…' + K('9') + K('0'), 'File the focused card under that section; with no card focused, jump to the section'], [K('P'), 'Pin or unpin the focused card'], [K('X'), 'Set the focused card aside, with a reason'], [K('O') + ' or ' + K('Enter'), 'Open the focused card'], [K('U'), 'Undo the last pin or set-aside'], [K('/'), 'Search the unsorted rows'],
        [K('Alt') + K('1') + '…' + K('5'), 'Board, Brief, Watch, Collection, Options'], [K('Ctrl') + ' or ' + K('Cmd') + K('S'), 'Save the brief'], [K('Esc'), 'Close what is open, or leave the text field'], [K('?'), 'This list']
      ].map(function (x) { return '<div class="keys-row"><span class="keys-k">' + x[0] + '</span><span>' + x[1] + '</span></div>'; }).join('') + '</div>' + acts('<button type="button" class="btn btn-primary" data-act="closeDialog" data-autofocus data-primary>Close</button>');
    }
    return h + '</div>';
  }
  function openDialog(d) { ui.lastFocus = document.activeElement; ui.dialog = d; renderDialog(); }
  function closeDialog() { var lf = ui.lastFocus; ui.dialog = null; ui.lastFocus = null; renderDialog(); if (lf && document.contains(lf)) { try { lf.focus(); } catch (e) { /* gone */ } } else { var m = $('#main'); if (m) m.focus(); } }
  function renderDialog() {
    var host = $('#dialog'); if (!host) return;
    try { host.innerHTML = dialogHtml(); } catch (e) { console.error(e); host.innerHTML = ''; ui.dialog = null; }
    document.body.classList.toggle('has-dialog', !!ui.dialog);
    if (ui.dialog) { var f = $('[data-autofocus]', host) || $('button, input, select, textarea', host); if (f) f.focus(); }
  }

  /* ---------- render ---------- */
  var pending = false, toastAt = 0, toastTimer = null;
  function schedule() { if (pending) return; pending = true; Promise.resolve().then(render); }
  function guard(host, fn, name) {
    try { paint(host, fn()); }
    catch (e) { console.error(e); if (host) host.innerHTML = '<div class="state state-err" role="alert">' + ic('alert', 'state-ic') + '<h2>' + esc(name) + ' could not be drawn</h2><p>' + esc(e && e.message || e) + '</p><button type="button" class="btn btn-primary" data-act="rerender">Draw it again</button></div>'; }
  }
  function viewHtml() {
    var r = ui.route;
    if (r === 'system') return systemHtml();
    if (r === 'options') return optionsHtml();
    if (st.mode === 'error') return '<div class="page">' + errorPanel() + '</div>';
    var banner = modeBanner();
    var body = r === 'brief' ? briefHtml() : r === 'watch' ? watchHtml() : r === 'collection' ? collectionHtml() : boardHtml();
    return (banner ? '<div class="banners" data-region="banners">' + banner + '</div>' : '') + '<div class="view view-' + r + '">' + body + '</div>';
  }
  function renderToast() {
    var host = $('#toasts'), t = st.toast; if (!host) return;
    if (!t) { if (host.firstChild) host.innerHTML = ''; toastAt = 0; return; }
    if (t.at === toastAt && host.firstChild && host.firstChild.getAttribute('data-text') === t.text) return;
    toastAt = t.at;
    var warn = t.kind === 'warn';
    host.innerHTML = '<div class="toast toast-' + (warn ? 'warn' : 'info') + '" role="' + (warn ? 'alert' : 'status') + '" data-text="' + esc(t.text) + '">' + ic(warn ? 'alert' : 'check') + '<span>' + esc(t.text) + '</span><button type="button" class="btn btn-quiet btn-icon" data-act="toastClose" aria-label="Dismiss">' + ic('x') + '</button></div>';
    clearTimeout(toastTimer); var mine = t.at; toastTimer = setTimeout(function () { if (st.toast && st.toast.at === mine) a.clearToast(); }, 5200);
  }
  function render() {
    pending = false;
    var app = $('#app'); if (app) { app.setAttribute('data-density', st.options.density || 'regular'); app.setAttribute('data-route', ui.route); app.setAttribute('data-role', st.role); }
    if (ui.open && st.mode === 'error') ui.open = null;
    guard($('#top'), topHtml, 'The header');
    guard($('#rail'), railHtml, 'The checks');
    guard($('#main'), viewHtml, 'This view');
    guard($('#drawer'), drawerHtml, 'The evidence drawer');
    document.body.classList.toggle('has-drawer', !!ui.open && !!q.row(ui.open));
    try { renderToast(); } catch (e) { console.error(e); }
    if (ui.route === 'system') { try { fillTokens(); } catch (e2) { console.error(e2); } }
    if (ui.focusAfter) { var el = findKey(document, 'f:' + ui.focusAfter); ui.focusAfter = null; if (el) { try { el.focus(); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e3) { /* not focusable */ } } }
    document.title = ROUTE_LABEL[ui.route] + ' · Anne\'s Den · Concept A, The Storyboard';
  }

  /* ---------- routing ---------- */
  function readRoute() {
    var r = (location.hash || '').replace(/^#/, '').split(/[/?]/)[0];
    if (ROUTES.indexOf(r) < 0) { r = 'today'; try { history.replaceState(null, '', location.pathname + location.search + '#today'); } catch (e) { /* file:// may refuse */ } }
    if (r !== ui.route) { ui.check = null; ui.deskOpen = false; }
    ui.route = r;
  }
  function go(r) { if (location.hash === '#' + r) { readRoute(); schedule(); } else location.hash = '#' + r; }

  /* ---------- actions ---------- */
  function cards() { return $$('#main .card[data-id], #main .card[data-pid]').filter(function (el) { return el.offsetParent !== null; }); }
  function focusedCard() { var el = document.activeElement; return el && el.closest ? el.closest('.card[data-id]') : null; }
  function nextFid(cardEl) { if (!cardEl) return null; var list = cards(), i = list.indexOf(cardEl), n = list[i + 1] || list[i - 1]; return n ? n.getAttribute('data-fid') : null; }
  function moveFocus(dir) {
    var list = cards(); if (!list.length) return;
    var cur = document.activeElement && document.activeElement.closest ? document.activeElement.closest('.card') : null, i = list.indexOf(cur);
    var n = list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : Math.max(0, Math.min(list.length - 1, i + dir))];
    if (n) { n.focus(); n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
  }
  function doAssign(id, sec, fromCard) {
    if (!rw()) { a.say('This key is read-only: nothing was changed.', 'warn'); return; }
    if (fromCard) ui.focusAfter = nextFid(fromCard);
    a.assign(id, sec); a.say('Filed under ' + secBy(sec).title + '.');
  }
  function doCite(id) {
    var sid = ui.section, s = st.brief.sections[sid];
    if (!s || !canEdit() || !hasBrief()) return;
    var t = s.text, pos = ui.caret && ui.caret.sid === sid ? ui.caret.pos : null; if (pos == null || pos > t.length) pos = t.length;
    var before = t.slice(0, pos).replace(/\s+$/, '');
    a.cite(sid, id, pos);
    ui.caret = { sid: sid, pos: before.length + (' [' + id + ']').length };
  }
  function copyText(t, okMsg, html) {
    function fb() { var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('aria-hidden', 'true'); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } document.body.removeChild(ta); a.say(ok ? okMsg : 'The browser would not copy from this page. Use a download instead.', ok ? 'info' : 'warn'); }
    try {
      if (navigator.clipboard && window.isSecureContext) {
        if (html && window.ClipboardItem) navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([t], { type: 'text/plain' }) })]).then(function () { a.say(okMsg); }, fb);
        else navigator.clipboard.writeText(t).then(function () { a.say(okMsg); }, fb);
      } else fb();
    } catch (e) { fb(); }
  }
  function download(name, text, mime) {
    try { var b = new Blob([text], { type: mime }), u = URL.createObjectURL(b), l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); document.body.removeChild(l); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); a.say('Downloaded ' + name + '.'); }
    catch (e) { a.say('The browser would not download from this page.', 'warn'); }
  }

  var acts = {
    rerender: function () { schedule(); },
    retry: function () { a.retry(); },
    toastClose: function () { a.clearToast(); },
    shortcuts: function () { openDialog({ type: 'shortcuts' }); },
    closeDialog: function () { closeDialog(); },
    backdrop: function () { closeDialog(); },
    deskToggle: function () { ui.deskOpen = !ui.deskOpen; ui.check = null; schedule(); },
    desk: function (el) { ui.deskOpen = false; a.setDesk(el.getAttribute('data-id')); a.say('Desk: ' + q.desk().name + '.'); },
    check: function (el) { var k = el.getAttribute('data-id'); ui.check = ui.check === k ? null : k; ui.deskOpen = false; schedule(); },
    checkClose: function () { ui.check = null; schedule(); },
    showRow: function (el) { var id = el.getAttribute('data-id'); ui.check = null; ui.open = id; a.markRead(id); ui.focusAfter = 'drawer-close'; if (ui.route !== 'today' && ui.route !== 'brief') go('today'); schedule(); },
    openSection: function (el, ev) { if (ev) ev.preventDefault(); ui.section = el.getAttribute('data-sec'); ui.check = null; ui.caret = null; if (el.closest('.drawer')) ui.open = null; ui.focusAfter = canEdit() && hasBrief() && !secBy(ui.section).built ? 'ta-' + ui.section : null; go('brief'); schedule(); },
    section: function (el) { ui.section = el.getAttribute('data-sec'); ui.caret = null; schedule(); },
    stepSec: function (el) { var l = secs().map(function (s) { return s.id; }), i = l.indexOf(ui.section) + Number(el.getAttribute('data-val')); if (i >= 0 && i < l.length) { ui.section = l[i]; ui.caret = null; schedule(); } },
    filter: function (el) { ui.filter = el.getAttribute('data-val'); schedule(); },
    clearFilters: function () { ui.filter = 'all'; ui.search = ''; schedule(); },
    toggleLow: function () { ui.showLow = !ui.showLow; schedule(); },
    toggleAside: function () { ui.showAside = !ui.showAside; schedule(); },
    togglePull: function () { ui.pull = !ui.pull; schedule(); },
    undo: function () { a.undo(); },
    pin: function (el) { var c = el.closest('.card'); if (c && st.assigned[el.getAttribute('data-id')]) ui.focusAfter = 'board-' + el.getAttribute('data-id'); a.pin(el.getAttribute('data-id')); },
    aside: function (el) { openDialog({ type: 'aside', id: el.getAttribute('data-id'), next: nextFid(el.closest('.card')) }); },
    asideGo: function () {
      var d = ui.dialog, pick = $('input[name="aside-reason"]:checked'), note = ($('#aside-note') || {}).value || '', reason = pick ? pick.value : 'Not relevant';
      if (reason === 'Other' && note.trim()) reason = 'Other: ' + note.trim();
      ui.dialog = null; renderDialog(); ui.lastFocus = null;
      if (ui.open === d.id) ui.open = null;
      ui.focusAfter = d.next;
      var res = a.aside(d.id, reason) || {};
      if (res.offer) openDialog({ type: 'mute', offer: res.offer }); else if (rw()) a.say('Set aside: ' + reason + '. Press U to undo.');
    },
    muteGo: function () { var o = ui.dialog.offer; closeDialog(); a.mute(o.kind, o.value); },
    restore: function (el) { a.restore(el.getAttribute('data-id')); if (rw()) a.say('Put back on the board.'); },
    openRow: function (el) { var id = el.getAttribute('data-id'); if (!q.row(id)) return; ui.open = id; ui.check = null; a.markRead(id); ui.focusAfter = 'drawer-close'; schedule(); },
    closeDrawer: function () { var id = ui.open; ui.open = null; ui.focusAfter = id ? (ui.route === 'brief' ? 'brief-' : 'board-') + id : null; schedule(); },
    assign: function (el) { var id = el.getAttribute('data-id'), sec = el.getAttribute('data-sec'); if (st.assigned[id] === sec) { a.pin(id); a.say('Returned to Unsorted.'); } else doAssign(id, sec, null); },
    cite: function (el) { doCite(el.getAttribute('data-id')); a.say('Cited ' + el.getAttribute('data-id') + ' in ' + secBy(ui.section).title + '.'); },
    regen: function (el) { openDialog({ type: 'regen', sec: el.getAttribute('data-sec') }); },
    regenGo: function () { var d = ui.dialog, note = ($('#regen-note') || {}).value || ''; closeDialog(); if (st.calls.used >= st.calls.cap) { a.say('Today\'s ' + st.calls.cap + ' model calls are used.', 'warn'); return; } a.regenerate(d.sec, note, function () { a.say(secBy(d.sec).title + ' was regenerated. 1 model call.'); }); },
    draftAsk: function () { openDialog({ type: 'draft' }); },
    draftGo: function () { closeDialog(); ui.stages = {}; if (ui.route !== 'brief') go('brief'); a.draft(function () { a.say('The draft is in. 1 model call.'); }); },
    byHand: function () { a.byHand(); ui.section = 'summary'; ui.focusAfter = 'ta-summary'; if (ui.route !== 'brief') go('brief'); schedule(); },
    checkDraft: function () { a.checkDraft(); },
    save: function () { a.save(); },
    fileAsk: function () { var r = a.file() || {}; if (r.uncovered) openDialog({ type: 'file', uncovered: r.uncovered }); else if (r.filed) a.say('Filed.'); },
    fileAnyway: function () { closeDialog(); var r = a.file({ acknowledge: true }) || {}; if (r.filed) a.say('Filed, with the uncovered checks acknowledged.'); },
    fileBack: function () { var s = ui.dialog.uncovered[0]; closeDialog(); if (s) { ui.section = sigSec(s); ui.check = s.key; } schedule(); },
    reopen: function () { a.reopen(); if (rw()) a.say('Reopened. It is a draft again.'); },
    history: function () { openDialog({ type: 'history' }); },
    exportOpen: function () { openDialog({ type: 'export', wide: true }); },
    'export': function (el) {
      var v = el.getAttribute('data-val'), name = 'brief-' + st.desk + '-' + st.brief.day; closeDialog();
      if (v === 'doc') copyText(q.exportAs('md'), 'Copied for the document.', q.exportAs('html'));
      else if (v === 'md') download(name + '.md', q.exportAs('md'), 'text/markdown');
      else if (v === 'html') download(name + '.html', '<!doctype html><meta charset="utf-8"><title>' + esc(name) + '</title>' + q.exportAs('html'), 'text/html');
      else copyText(q.exportAs('slack'), 'The Slack summary is copied.');
    },
    resolve: function (el) { var v = el.getAttribute('data-val'); a.resolve(v); a.say(v === 'theirs' ? 'Took their version.' : 'Kept yours. Save to file it.'); },
    preview: function (el) { var id = el.getAttribute('data-id'); ui.preview[id] = !ui.preview[id]; schedule(); },
    approve: function (el) { var id = el.getAttribute('data-id'), p = st.proposals.filter(function (x) { return x.id === id; })[0], iss = ui.issueFor[id] || ''; ui.focusAfter = nextFid(el.closest('.card')); a.decide(id, 'approve', { issue: iss }); if (rw() && p) a.say('Approved “' + p.value + '”' + (iss ? ' under ' + issueLabel(iss) : ': searched for, tags nothing') + '.'); },
    dismissAsk: function (el) { openDialog({ type: 'dismiss', id: el.getAttribute('data-id'), next: nextFid(el.closest('.card')) }); },
    dismissGo: function () { var d = ui.dialog, v = (($('#dismiss-reason') || {}).value || '').trim(); if (v.length < 3) { d.err = true; d.val = v; renderDialog(); return; } ui.dialog = null; renderDialog(); ui.lastFocus = null; ui.focusAfter = d.next; a.decide(d.id, 'dismiss', { reason: v }); if (rw()) a.say('Dismissed. It will not be proposed again.'); },
    regToggle: function (el) { a.toggleRegister(el.getAttribute('data-id')); },
    collect: function (el) { a.collect(el.getAttribute('data-id')); },
    chanToggle: function (el) { a.toggleChannel(el.getAttribute('data-id')); },
    density: function (el) { a.setOption('density', el.getAttribute('data-val')); },
    optToggle: function (el) { var k = el.getAttribute('data-val'); a.setOption(k, !st.options[k]); },
    unmute: function (el) { a.unmute(el.getAttribute('data-val')); },
    simConflict: function () { a.simulateConflict(); ui.section = 'summary'; go('brief'); },
    simMute: function () { openDialog({ type: 'mute', offer: { kind: 'outlet', value: 'Harbour Mail' } }); },
    simToast: function () { a.say('Set aside. Press U to undo.'); },
    role: function (el) { a.setRole(el.getAttribute('data-val')); }
  };

  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var el = t.closest('[data-act]');
    if (el) {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      var fn = acts[el.getAttribute('data-act')];
      if (fn) { try { fn(el, e); } catch (err) { console.error(err); a.say('That did not work: ' + (err && err.message || err), 'warn'); } }
      return;
    }
    var c = t.closest('.card[data-id]');
    if (c && !t.closest('button, a, input, select, textarea')) {
      var id = c.getAttribute('data-id'), ctx = c.getAttribute('data-ctx');
      if (ctx === 'brief' && canEdit() && hasBrief()) acts.cite(c); else if (ctx !== 'system') acts.openRow(c);
      return;
    }
    if (ui.deskOpen && !t.closest('.desk')) { ui.deskOpen = false; schedule(); }
    if (ui.check && !t.closest('.checks')) { ui.check = null; schedule(); }
  });
  document.addEventListener('input', function (e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute('data-in'); if (!k) return;
    if (k === 'search') { ui.search = t.value; schedule(); }
    else if (k === 'pullSearch') { ui.pullSearch = t.value; schedule(); }
    else if (k === 'edit') { ui.caret = { sid: t.getAttribute('data-sec'), pos: t.selectionStart }; a.edit(t.getAttribute('data-sec'), t.value); }
    else if (k === 'minInt') { var n = parseInt(t.value, 10); if (!isNaN(n)) a.setOption('minInteractions', n); }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t && t.getAttribute && t.getAttribute('data-in'); if (!k) return;
    if (k === 'issueFor') ui.issueFor[t.getAttribute('data-id')] = t.value;
    else if (k === 'rating') a.setRating(t.getAttribute('data-id'), t.getAttribute('data-val'), t.value);
  });
  ['keyup', 'click', 'select', 'focusout'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { var t = e.target; if (t && t.tagName === 'TEXTAREA' && t.getAttribute('data-in') === 'edit') { try { ui.caret = { sid: t.getAttribute('data-sec'), pos: t.selectionStart }; } catch (x) { /* no caret */ } } });
  });

  /* drag a card to a column */
  document.addEventListener('dragstart', function (e) { var c = e.target && e.target.closest && e.target.closest('.card[draggable="true"]'); if (!c) return; ui.dragId = c.getAttribute('data-id'); try { e.dataTransfer.setData('text/plain', ui.dragId); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* older engines */ } c.classList.add('is-dragging'); document.body.classList.add('is-dragging-card'); });
  document.addEventListener('dragend', function () { ui.dragId = null; document.body.classList.remove('is-dragging-card'); $$('.is-dragging').forEach(function (el) { el.classList.remove('is-dragging'); }); $$('.col.drop-on').forEach(function (el) { el.classList.remove('drop-on'); }); });
  document.addEventListener('dragover', function (e) { if (!ui.dragId) return; var col = e.target && e.target.closest && e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); try { e.dataTransfer.dropEffect = 'move'; } catch (x) { /* fine */ } $$('.col.drop-on').forEach(function (el) { if (el !== col) el.classList.remove('drop-on'); }); col.classList.add('drop-on'); });
  document.addEventListener('drop', function (e) {
    var col = e.target && e.target.closest && e.target.closest('[data-drop]'), id = ui.dragId; if (!col || !id) return; e.preventDefault();
    var sec = col.getAttribute('data-drop'); ui.dragId = null; document.body.classList.remove('is-dragging-card');
    if (sec) { if (st.assigned[id] !== sec) doAssign(id, sec, null); }
    else if (st.assigned[id]) { a.pin(id); a.say('Returned to Unsorted.'); }
    schedule();
  });

  /* keyboard */
  function typing(t) { return !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || (t.tagName === 'INPUT' && !/^(radio|checkbox|button)$/.test(t.type)) || t.isContentEditable); }
  document.addEventListener('keydown', function (e) {
    var t = e.target, k = e.key;
    if ((e.metaKey || e.ctrlKey) && (k === 's' || k === 'S')) { e.preventDefault(); if (hasBrief() && !filed()) a.save(); return; }
    if (ui.dialog) {
      var dlg = $('#dialog .dialog');
      if (k === 'Escape') { e.preventDefault(); closeDialog(); return; }
      if (k === 'Tab' && dlg) { var f = $$('button, input, select, textarea, a[href]', dlg).filter(function (x) { return !x.disabled && x.offsetParent !== null; }); if (!f.length) return; var first = f[0], last = f[f.length - 1]; if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (document.activeElement === last || !dlg.contains(document.activeElement))) { e.preventDefault(); first.focus(); } return; }
      if (k === 'Enter' && t && t.tagName === 'INPUT') { var p = $('[data-primary]', dlg); if (p) { e.preventDefault(); p.click(); } }
      return;
    }
    if (e.altKey && /^Digit[1-6]$/.test(e.code || '')) { e.preventDefault(); go(ROUTES[Number(e.code.slice(5)) - 1]); return; }
    if (k === 'Escape') {
      if (ui.deskOpen || ui.check) { ui.deskOpen = false; ui.check = null; schedule(); return; }
      if (ui.open) { acts.closeDrawer(); return; }
      if (typing(t)) { t.blur(); var m = $('#main'); if (m) m.focus(); }
      return;
    }
    if (typing(t) || e.metaKey || e.ctrlKey || e.altKey) return;
    var c = focusedCard(), id = c && c.getAttribute('data-id'), onCard = c && document.activeElement === c;
    if (k === '?') { e.preventDefault(); openDialog({ type: 'shortcuts' }); return; }
    if (k === 'j' || k === 'J') { e.preventDefault(); moveFocus(1); return; }
    if (k === 'k' || k === 'K') { e.preventDefault(); moveFocus(-1); return; }
    if (k === '/') { var s = $('[data-in="search"]') || $('[data-in="pullSearch"]'); if (s) { e.preventDefault(); s.focus(); } return; }
    if (k === 'u' || k === 'U') { if (rw()) a.undo(); return; }
    if (c && (k === 'o' || k === 'O' || (k === 'Enter' && onCard))) { e.preventDefault(); acts.openRow(c); return; }
    if (c && (k === 'p' || k === 'P') && c.getAttribute('data-ctx') !== 'system') { e.preventDefault(); if (!rw()) { a.say('This key is read-only: nothing was changed.', 'warn'); return; } if (st.assigned[id]) ui.focusAfter = 'board-' + id; a.pin(id); return; }
    if (c && (k === 'x' || k === 'X') && c.getAttribute('data-ctx') !== 'system') { e.preventDefault(); if (!rw()) { a.say('This key is read-only: nothing was changed.', 'warn'); return; } openDialog({ type: 'aside', id: id, next: nextFid(c) }); return; }
    if (/^[0-9]$/.test(k)) {
      var sec = editable()[k === '0' ? 9 : Number(k) - 1]; if (!sec) return; e.preventDefault();
      if (c && ui.route === 'today') { if (st.assigned[id] !== sec.id) doAssign(id, sec.id, c); return; }
      if (ui.route === 'brief') { ui.section = sec.id; ui.caret = null; schedule(); return; }
      if (ui.route === 'today') { var col = $('.col[data-drop="' + sec.id + '"]'); if (col) { col.scrollIntoView({ block: 'nearest', inline: 'center' }); var b = $('.col-open', col); if (b) b.focus(); } }
    }
  });

  setInterval(function () { var d = st.brief.drafting, el = $('#draft-elapsed'); if (d && d.t0 && el) el.textContent = fmtElapsed(Date.now() - d.t0); }, 250);
  window.addEventListener('hashchange', function () { readRoute(); schedule(); });
  window.addEventListener('beforeunload', function (e) { if (st.brief.save === 'unsaved' && location.protocol !== 'file:') { e.preventDefault(); e.returnValue = ''; } });
  D.on(schedule);
  readRoute(); render();
})();
