/* Anne's Den - Concept C, The Reading Room.
 * One pattern everywhere: a list on the left, the selected thing in a reading pane, the brief as a third pane.
 * Renders window.DEN (shared.js); every mutation goes through DEN.a. Invented data only. Works from file://. */
(function () {
  'use strict';
  var D = window.DEN;
  if (!D) { document.body.innerHTML = '<p style="padding:24px;font-family:sans-serif">shared.js did not load, so there is nothing to show.</p>'; return; }
  var S = D.state, Q = D.q, A = D.a;
  function $(id) { return document.getElementById(id); }

  var ROUTES = [
    { id: 'today', label: 'Today' }, { id: 'brief', label: 'Brief' }, { id: 'watch', label: 'Watch' },
    { id: 'collection', label: 'Collection' }, { id: 'options', label: 'Options' }, { id: 'system', label: 'System' }];
  var KIND = {
    media: { label: 'News', one: 'News story', icon: 'news', sec: 'media' }, social: { label: 'Social', one: 'Social post', icon: 'chat', sec: 'social' },
    actor: { label: 'Actors', one: 'Registered public actor', icon: 'user', sec: 'actors' }, narrative: { label: 'Narratives', one: 'Narrative', icon: 'flow', sec: 'narratives' },
    upcoming: { label: 'Upcoming', one: 'Upcoming', icon: 'cal', sec: 'momentum' } };
  var SHORT = { summary: 'Summary', narratives: 'Narratives', media: 'Media', social: 'Social', actors: 'Actors', sentiment: 'Tone', momentum: 'Momentum', risks: 'Risks', bottom: 'Bottom line', posture: 'Posture', source: 'Sources' };
  var LAYER = { 1: 'Layer 1 - the platform\'s own programme', 2: 'Layer 2 - a signed-in session on the agency\'s Mac', 3: 'Layer 3 - a keyless public route the worker reads' };
  var SIGTONE = { gap: 'warn-solid', spike: 'neg', emerging: 'accent', first_seen: 'info', outlier: 'info', burst: 'warn' };
  var OPT = [
    { id: 'display', label: 'Display', sub: 'Density and appearance', icon: 'sliders' }, { id: 'evidence', label: 'Evidence', sub: 'What reaches the window', icon: 'layers' },
    { id: 'drafting', label: 'Drafting', sub: 'The morning draft and its cost', icon: 'spark' }, { id: 'mutes', label: 'Mutes and set-aside', sub: 'What this desk leaves out', icon: 'aside' },
    { id: 'format', label: 'Report format', sub: 'Sections and rating words', icon: 'doc' }, { id: 'states', label: 'Prototype states', sub: 'Simulate loading, errors, a conflict', icon: 'term' }];
  var SYS = [['colour', 'Colour'], ['type', 'Type'], ['space', 'Spacing and radii'], ['depth', 'Elevation'], ['motion', 'Motion'], ['buttons', 'Buttons'], ['chips', 'Chips'], ['rows', 'List rows'],
    ['fields', 'Form fields'], ['notices', 'Notices'], ['overlays', 'Dialog, drawer, menu'], ['console', 'Console and stepper'], ['skeleton', 'Skeleton, empty, error'], ['toast', 'Toast'], ['simulate', 'Simulate states']];

  var ui = { route: 'today', sel: {}, kind: '', channel: '', search: '', sort: 'weight', pinnedOnly: false, unreadOnly: false, showAside: false, showLow: false, checksOpen: true,
    listOpen: false, narrow: false, rail: false, editing: null, lastEdit: null, order: [], preview: {}, issue: {}, add: { kind: 'term', value: '', issue: '' },
    snap: {}, lastRev: null, cmp: null, toastAt: 0, toastUndo: false, toastTimer: null, menu: null, dlg: null, briefKey: null, headKey: null, readerKey: null, rendering: false, dirty: false, theme: 'dark' };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function canWrite() { return S.role !== 'read'; }
  function filed() { return S.brief.status === 'filed'; }
  function listRoute() { return ui.route === 'brief' ? 'today' : ui.route; }
  function selKey() { return ui.sel[listRoute()] || ''; }
  function issueLabel(id) { var x = Q.issues().filter(function (i) { return i.id === id; })[0]; return x ? x.label : ''; }
  function secTitle(id) { var x = Q.sections().filter(function (s) { return s.id === id; })[0]; return x ? x.title : id; }
  function day(d) { try { return new Date(d + 'T12:00:00+11:00').toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric', month: 'short' }); } catch (e) { return d; } }
  function plural(n, one, many) { return Q.fmt(n) + ' ' + (n === 1 ? one : (many || one + 's')); }
  function where(r) { return r.kind === 'media' ? r.outlet : r.kind === 'social' ? r.channel : r.kind === 'actor' ? r.who : KIND[r.kind].one; }
  function citeLabel(r) { return r.kind === 'media' ? r.outlet : r.kind === 'social' ? r.channel + ' post' : r.kind === 'actor' ? r.who : r.kind === 'narrative' ? 'Narrative' : day(r.date); }
  function toneWord(t) { return t <= -0.3 ? 'hostile' : t >= 0.3 ? 'supportive' : 'mixed'; }

  var P = {
    back: 'M15 18l-6-6 6-6', down: 'M6 9l6 6 6-6', up: 'M18 15l-6-6-6 6', right: 'M9 6l6 6-6 6', x: 'M18 6L6 18M6 6l12 12', check: 'M20 6L9 17l-5-5',
    pin: 'M12 17v5M9 3h6l-1 6 4 4v2H6v-2l4-4-1-6z', aside: 'M3 6h18v4H3zM5 10v10h14V10M10 14h4', search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
    ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5', quote: 'M4 6h16M4 12h9M4 18h6M18 13v8M14 17h8',
    doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6', news: 'M4 5h13v14H6a2 2 0 01-2-2zM17 9h3v8a2 2 0 01-2 2M8 9h5M8 13h5', chat: 'M4 5h16v11H9l-5 4z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0', flow: 'M4 7h5a4 4 0 014 4v2a4 4 0 004 4h3M17 14l3 3-3 3', cal: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5',
    alert: 'M12 4l9 16H3zM12 10v4M12 17.5v.5', refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7', play: 'M7 4l13 8-13 8z', kbd: 'M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10',
    more: 'M5 12h.01M12 12h.01M19 12h.01', clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2', copy: 'M9 9h11v11H9zM5 15H4V4h11v1', dl: 'M12 4v11M7 11l5 5 5-5M5 20h14',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', plus: 'M12 5v14M5 12h14', sliders: 'M4 7h10M18 7h2M4 17h4M12 17h8M16 4v6M10 14v6', layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    hist: 'M4 12a8 8 0 108-8 8 8 0 00-6 2.7M4 4v4h4M12 8v4l3 2', edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', spark: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z', lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
    menu: 'M4 6h16M4 12h16M4 18h16', flag: 'M5 21V4h11l-2 4 2 4H5', term: 'M4 5h16v14H4zM8 10l3 2-3 2M13 15h3', dot: 'M12 12h.01', info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01',
    eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z', sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4' };
  function ic(n, c) { return '<svg class="ic' + (c ? ' ' + c : '') + '" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="' + (P[n] || '') + '"/></svg>'; }
  function chip(text, tone, icon) { return '<span class="chip chip-' + (tone || 'neutral') + '">' + (icon ? ic(icon) : '') + esc(text) + '</span>'; }
  function kbd(k) { return '<kbd class="kbd">' + esc(k) + '</kbd>'; }
  function notice(tone, title, body, acts, role) { return '<div class="notice notice-' + tone + '" role="' + (role || (tone === 'neg' || tone === 'warn' ? 'alert' : 'status')) + '"><span class="notice-ic">' + ic(tone === 'pos' ? 'check' : tone === 'info' ? 'info' : 'alert') + '</span><div class="notice-b"><strong>' + esc(title) + '</strong>' + (body ? '<p>' + body + '</p>' : '') + (acts ? '<div class="notice-acts">' + acts + '</div>' : '') + '</div></div>'; }
  function skel(n, cls) { var h = ''; for (var i = 0; i < n; i++) h += '<div class="skel ' + (cls || 'skel-line') + '" style="width:' + [92, 78, 96, 64, 88, 71, 94, 58][i % 8] + '%"></div>'; return '<div class="skel-wrap" aria-hidden="true">' + h + '</div>'; }
  function emptyState(icon, title, why, actHTML) { return '<div class="empty"><span class="empty-ic">' + ic(icon) + '</span><h3>' + esc(title) + '</h3><p>' + why + '</p>' + (actHTML || '') + '</div>'; }
  function facts(pairs) { return '<dl class="facts">' + pairs.filter(Boolean).map(function (p) { return '<div class="fact"><dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd></div>'; }).join('') + '</dl>'; }
  function bar(pct, tone) { return '<span class="meter' + (tone ? ' meter-' + tone : '') + '" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, Math.round(pct))) + '%"></i></span>'; }

  function setHTML(el, html) {
    if (!el || el.__h === html) return false;
    var ae = document.activeElement, k = null, ss = null, se = null;
    if (ae && ae !== document.body && el.contains(ae)) { k = ae.getAttribute('data-k'); try { ss = ae.selectionStart; se = ae.selectionEnd; } catch (e) {} }
    el.innerHTML = html; el.__h = html;
    if (k) { var n = el.querySelector('[data-k="' + cssq(k) + '"]'); if (n) { try { n.focus({ preventScroll: true }); if (ss != null && n.setSelectionRange) n.setSelectionRange(ss, se); } catch (e) {} } }
    return true;
  }

  /* ---------- selection ---------- */
  function resolve(k) {
    if (!k) return null; var i = k.indexOf('|'), t = k.slice(0, i), id = k.slice(i + 1);
    function pick(arr) { return arr.filter(function (x) { return x.id === id; })[0] || null; }
    switch (t) {
      case 'row': return S.mode === 'empty' ? null : Q.row(id);
      case 'sig': return Q.signals().filter(function (s) { return s.key === id; })[0] || null;
      case 'prop': return pick(S.proposals); case 'reg': return pick(S.register); case 'add': return { add: true };
      case 'ch': return pick(S.channels); case 'pg': return pick(Q.pages()); case 'pt': return pick(Q.petitions()); case 'recall': return Q.recall();
      case 'opt': return pick(OPT); case 'sys': return { id: id };
    } return null;
  }
  function selType() { var k = selKey(); return k ? k.slice(0, k.indexOf('|')) : ''; }
  function selId() { var k = selKey(); return k ? k.slice(k.indexOf('|') + 1) : ''; }
  function selRow() { return selType() === 'row' ? resolve(selKey()) : null; }
  function defaultSel(r) {
    if (r === 'today') {
      var rows = Q.rows({}).filter(function (x) { return !x.low; }).map(function (x) { return { r: x, w: Q.weight(x).score }; }).sort(function (a, b) { return b.w - a.w; });
      if (rows.length) return 'row|' + rows[0].r.id; var sg = Q.signals(); return sg.length ? 'sig|' + sg[0].key : '';
    }
    if (r === 'watch') { var p = S.proposals.filter(function (x) { return x.status === 'proposed'; }).sort(function (a, b) { return b.score - a.score; })[0]; return p ? 'prop|' + p.id : (S.register[0] ? 'reg|' + S.register[0].id : 'add|'); }
    if (r === 'collection') { var g = S.channels.filter(function (c) { return c.state === 'gap'; })[0] || S.channels[0]; return g ? 'ch|' + g.id : 'recall|'; }
    if (r === 'options') return 'opt|display';
    if (r === 'system') return 'sys|colour';
    return '';
  }
  function ensureSel() {
    if (S.mode === 'loading' || S.mode === 'error') return;
    var lr = listRoute(), k = ui.sel[lr]; if (k && resolve(k)) return;
    var d = defaultSel(lr); ui.sel[lr] = d;
    if (d.indexOf('row|') === 0) { var id = d.slice(4); setTimeout(function () { A.markRead(id); }, 0); }
  }
  function select(key, scroll) {
    if (!key) return; ui.sel[listRoute()] = key;
    var id = key.indexOf('row|') === 0 ? key.slice(4) : null;
    if (id && !S.read[id]) A.markRead(id); else render();
    if (listRoute() === 'system') { var t = $('sys-' + key.slice(4)); if (t && t.scrollIntoView) t.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); }
    if (scroll) { var n = $('list-body').querySelector('[data-key="' + cssq(key) + '"]'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'nearest' }); }
  }
  function move(dir) {
    var o = ui.order, i = o.indexOf(selKey()), n = i < 0 ? 0 : i + dir; if (n < 0 || n >= o.length) return;
    select(o[n], true);
  }
  function go(route, key) {
    if (key) ui.sel[route === 'brief' ? 'today' : route] = key;
    if (location.hash !== '#' + route) location.hash = route; else onRoute();
  }
  function openRow(id) { if (ui.route === 'today' || ui.route === 'brief') select('row|' + id, true); else go('today', 'row|' + id); }

  /* ---------- the top bar ---------- */
  function deskState(d) { var st = d.id === S.desk ? S.brief.status : d.brief; return st === 'filed' ? ['Filed', 'pos'] : st === 'draft' ? ['Draft', 'accent'] : ['No brief', 'neutral']; }
  function renderTop() {
    var d = Q.desk(), ds = deskState(d), gaps = S.channels.filter(function (c) { return c.state === 'gap' && !c.off; }).length, waiting = S.proposals.filter(function (p) { return p.status === 'proposed'; }).length;
    var nav = ROUTES.map(function (r, i) {
      var badge = r.id === 'watch' && waiting ? '<span class="nav-n" aria-label="' + waiting + ' waiting">' + waiting + '</span>' : r.id === 'collection' && gaps && S.mode !== 'nogap' ? '<span class="nav-n nav-n-warn" aria-label="' + gaps + ' not collected">' + gaps + '</span>' : '';
      return '<a class="nav-a" href="#' + r.id + '" data-k="nav-' + r.id + '"' + (ui.route === r.id ? ' aria-current="page"' : '') + ' title="Alt+' + (i + 1) + '">' + r.label + badge + '</a>';
    }).join('');
    var c = S.calls, callsTone = c.used >= c.cap ? 'neg' : c.used >= c.cap - 3 ? 'warn' : 'neutral';
    setHTML($('top'),
      '<button class="btn btn-quiet top-back" data-act="back" data-k="back" aria-label="Back to AXIOM">' + ic('back') + '<span>AXIOM</span></button>' +
      '<div class="brand"><span class="brand-mark" aria-hidden="true"></span><h1 class="brand-name">Anne\'s Den</h1></div>' +
      '<button class="desk" data-act="desks" data-k="desk" aria-haspopup="menu" aria-label="Desk: ' + esc(d.name) + ', ' + ds[0] + '. ' + esc(Q.windowLabel()) + '. Change desk">' +
        '<span class="desk-l"><span class="desk-name">' + esc(d.name) + '</span><span class="desk-win">' + esc(Q.windowLabel()) + '</span></span>' + chip(ds[0], ds[1]) + ic('down') + '</button>' +
      '<nav class="nav" aria-label="Views">' + nav + '</nav>' +
      '<div class="top-r">' +
        (canWrite() ? '' : chip('Read-only key', 'info', 'lock')) +
        '<span class="chip chip-' + callsTone + ' calls" title="Drafting and regenerating a section each spend one model call">model calls today: ' + c.used + ' of ' + c.cap + '</span>' +
        '<button class="btn-icon" data-act="help" data-k="help" aria-label="Keyboard shortcuts">' + ic('kbd') + '</button>' +
        '<button class="btn-icon" data-act="states" data-k="states" aria-haspopup="menu" aria-label="Prototype states">' + ic('term') + '</button>' +
      '</div>');
  }
  function renderBanner() {
    var h = '', dr = S.brief.drafting;
    if (S.mode === 'busy') h += notice('warn', 'The database is busy (503 db_busy).', 'Reads were asked again twice and answered. A save may be refused: your words stay on this computer until it goes through.', '<button class="btn btn-secondary btn-sm" data-act="retry" data-k="b-retry">' + ic('refresh') + 'Ask again</button>');
    if (dr && !dr.dropped && ui.route !== 'brief') h += '<div class="notice notice-accent" role="status"><span class="notice-ic"><span class="spin" aria-hidden="true"></span></span><div class="notice-b"><strong>Drafting the brief: ' + esc(dr.stage) + ' (' + dr.n + ' of ' + dr.of + ')</strong><div class="notice-acts"><a class="btn btn-secondary btn-sm" href="#brief" data-k="b-brief">Watch it in the brief</a></div></div></div>';
    if (dr && dr.dropped && ui.route !== 'brief') h += notice('neg', 'The connection dropped while the brief was being drafted.', 'The worker may have finished it.', '<button class="btn btn-primary btn-sm" data-act="checkdraft" data-k="b-check">Check for the draft</button>');
    setHTML($('banner'), h);
  }

  /* ---------- lists ---------- */
  function todayRows() {
    var f = {}; if (ui.kind) f.kind = ui.kind; if (ui.channel) f.channel = ui.channel; if (ui.pinnedOnly) f.pinned = true; if (ui.search) f.search = ui.search; if (ui.showAside) f.aside = true;
    var cur = selType() === 'row' ? selId() : '';
    var rows = Q.rows(f); if (ui.unreadOnly) rows = rows.filter(function (r) { return !S.read[r.id] || r.id === cur; });
    rows = rows.map(function (r) { return { r: r, w: Q.weight(r) }; });
    rows.sort(ui.sort === 'new' ? function (a, b) { return a.r.t - b.r.t; } : function (a, b) { return b.w.score - a.w.score || a.r.t - b.r.t; });
    return rows;
  }
  function rowMeta(r) {
    var bits = [];
    if (r.kind === 'media') { bits.push(esc(r.outlet)); if (r.outlets > 1) bits.push(r.outlets + ' outlets'); }
    else if (r.kind === 'social') { bits.push(esc(r.channel)); bits.push(Q.fmt(r.eng) + ' interactions'); }
    else if (r.kind === 'actor') { bits.push(esc(r.who)); bits.push(esc(r.channel)); }
    else if (r.kind === 'narrative') { bits.push(esc(r.status)); bits.push(r.n + ' rows'); }
    else if (r.kind === 'upcoming') { bits.push(day(r.date)); bits.push(esc(r.what)); }
    bits.push(Q.ago(r.t)); return bits.join(' &middot; ');
  }
  function itemRow(o, sel) {
    var r = o.r, w = o.w, key = 'row|' + r.id, pinned = !!S.pins[r.id], unread = !S.read[r.id], gone = S.aside[r.id], cited = Q.cited(r.id);
    if (ui.rail) return '<li><button class="item rail-item' + (sel === key ? ' sel' : '') + (unread ? ' unread' : '') + '" data-act="sel" data-key="' + key + '" data-k="i:' + key + '"' + (sel === key ? ' aria-current="true"' : '') + ' aria-label="' + esc((unread ? 'Unread. ' : '') + (pinned ? 'Pinned. ' : '') + r.title) + '" title="' + esc(r.title) + '">' +
      '<span class="rail-w" aria-hidden="true"><i style="height:' + w.score + '%"></i></span>' + ic(pinned ? 'pin' : KIND[r.kind].icon) + '</button></li>';
    return '<li><button class="item' + (sel === key ? ' sel' : '') + (unread ? ' unread' : '') + (pinned ? ' pinned' : '') + (gone ? ' gone' : '') + '" data-act="sel" data-key="' + key + '" data-k="i:' + key + '"' + (sel === key ? ' aria-current="true"' : '') + '>' +
      '<span class="it-mark" aria-hidden="true">' + (pinned ? ic('pin') : '<i class="dot"></i>') + '</span>' +
      '<span class="it-main"><span class="vh">' + (unread ? 'Unread. ' : '') + (pinned ? 'Pinned. ' : '') + '</span><span class="it-title">' + esc(r.title) + '</span>' +
        '<span class="it-meta">' + ic(KIND[r.kind].icon) + '<span>' + rowMeta(r) + '</span></span>' +
        ((r.subscriber || cited || gone || r.firstSeen || r.mp) ? '<span class="it-chips">' + (gone ? chip('Set aside: ' + gone, 'neutral') : '') + (r.subscriber ? chip('Subscriber', 'info', 'lock') : '') + (r.firstSeen ? chip('First seen', 'info') : '') + (r.mp ? chip('MP', 'neutral') : '') + (cited ? chip('Cited', 'pos', 'check') : '') + '</span>' : '') +
      '</span>' +
      '<span class="it-w" title="Weight ' + w.score + (w.why.length ? ': ' + esc(w.why.join(', ')) : '') + '"><span class="it-wn">' + w.score + '</span><span class="it-wbar" aria-hidden="true"><i style="width:' + w.score + '%"></i></span><span class="vh"> weight</span></span>' +
    '</button></li>';
  }
  function itemSig(s, sel) {
    var key = 'sig|' + s.key, tone = SIGTONE[s.sig] || 'neutral';
    if (ui.rail) return '<li><button class="item rail-item rail-sig rail-' + tone + (sel === key ? ' sel' : '') + '" data-act="sel" data-key="' + key + '" data-k="i:' + key + '"' + (sel === key ? ' aria-current="true"' : '') + ' aria-label="' + esc(s.label + ': ' + s.title) + '" title="' + esc(s.label + ': ' + s.title) + '">' + ic(s.sig === 'gap' ? 'alert' : 'flag') + '</button></li>';
    return '<li><button class="item item-sig' + (s.sig === 'gap' ? ' item-gap' : '') + (sel === key ? ' sel' : '') + '" data-act="sel" data-key="' + key + '" data-k="i:' + key + '"' + (sel === key ? ' aria-current="true"' : '') + '>' +
      chip(s.label, tone, s.sig === 'gap' ? 'alert' : null) + '<span class="it-title one">' + esc(s.title) + '</span>' +
      '<span class="it-cov ' + (s.covered ? 'ok' : '') + '" title="' + (s.covered ? 'The brief covers this' : 'Not yet covered in the brief') + '">' + (s.covered ? ic('check') : '<i class="ring"></i>') + '<span class="vh">' + (s.covered ? 'Covered in the brief' : 'Not yet covered in the brief') + '</span></span></button></li>';
  }
  function listToday() {
    var sel = selKey(), order = [], h = '', sigs = Q.signals(), rows = todayRows(), gaps = sigs.filter(function (s) { return s.sig === 'gap'; }), unc = sigs.filter(function (s) { return !s.covered; }).length;
    if (S.mode === 'loading') return { html: '<div class="pad">' + skel(3, 'skel-chip') + skel(7, 'skel-item') + '</div>', order: [] };
    if (S.mode === 'error') return { html: '<div class="pad">' + notice('neg', 'The window could not be read.', 'The worker answered an error for this desk\'s board.', '<button class="btn btn-secondary btn-sm" data-act="retry" data-k="l-retry">' + ic('refresh') + 'Try again</button>') + '</div>', order: [] };
    if (!ui.showAside) {
      if (ui.rail) { h += '<ul class="items rail-items" aria-label="The six checks">' + sigs.map(function (s) { order.push('sig|' + s.key); return itemSig(s, sel); }).join('') + '</ul><div class="rail-rule"></div>'; }
      else {
        h += '<div class="group checks' + (gaps.length ? ' has-gap' : '') + '"><button class="group-h" data-act="toggle" data-t="checksOpen" data-k="t-checks" aria-expanded="' + ui.checksOpen + '">' + ic(ui.checksOpen ? 'down' : 'right') +
          '<span class="group-t">Nothing critical missed</span><span class="group-s">' + (gaps.length ? '<b class="gapword">' + plural(gaps.length, 'gap') + '</b> &middot; ' : '') + (sigs.length ? unc + ' of ' + sigs.length + ' to cover' : 'nothing found') + '</span></button>';
        if (ui.checksOpen) {
          h += sigs.length ? '<ul class="items" aria-label="The six checks, collection gaps first">' + sigs.map(function (s) { order.push('sig|' + s.key); return itemSig(s, sel); }).join('') + '</ul>'
            : '<p class="group-note">The six checks ran and found nothing. Computed, no model.</p>';
        } else sigs.forEach(function (s) { /* folded: not in j/k order */ });
        h += '</div>';
      }
    }
    var main = rows.filter(function (o) { return !o.r.low || ui.showAside; }), low = ui.showAside ? [] : rows.filter(function (o) { return o.r.low; });
    if (!ui.rail) h += '<div class="group-h group-h-static"><span class="group-t">' + (ui.showAside ? 'Set aside and muted' : 'Evidence') + '</span><span class="group-s">' + main.length + (ui.sort === 'new' ? ' &middot; newest first' : ' &middot; by weight') + '</span></div>';
    if (main.length) h += '<ul class="items' + (ui.rail ? ' rail-items' : '') + '" aria-label="' + (ui.showAside ? 'Set-aside rows' : 'Evidence in the window') + '">' + main.map(function (o) { order.push('row|' + o.r.id); return itemRow(o, sel); }).join('') + '</ul>';
    else if (!ui.rail) {
      var filtered = ui.kind || ui.channel || ui.search || ui.pinnedOnly || ui.unreadOnly;
      if (ui.showAside) h += emptyState('aside', 'Nothing is set aside', 'Rows you set aside, and rows from a muted outlet or account, wait here so they can be put back.', '<button class="btn btn-secondary" data-act="toggle" data-t="showAside" data-k="e-back">Back to the window</button>');
      else if (filtered) h += emptyState('search', 'No row matches', 'The window holds ' + Q.rows({}).length + ' rows; the filters or the search leave none of them.', '<button class="btn btn-secondary" data-act="clear" data-k="e-clear">Clear the filters</button>');
      else if (gaps.length) h += emptyState('alert', 'No rows, and this is not a quiet day', esc(gaps[0].title) + '. An empty window cannot be read as quiet until that channel is collected.', '<button class="btn btn-primary" data-act="goto" data-r="collection" data-key="ch|' + esc(gaps[0].channel) + '" data-k="e-coll">Open Collection</button>');
      else h += emptyState('check', 'A quiet window', 'Every channel this desk relies on delivered, and nothing on its issues arrived in the last ' + (Q.desk().windowH === 24 ? '24 hours' : '7 days') + '.', '<button class="btn btn-secondary" data-act="goto" data-r="collection" data-k="e-coll">See what each channel read</button>');
    }
    if (low.length && !ui.rail) {
      h += '<button class="group-h group-low" data-act="toggle" data-t="showLow" data-k="t-low" aria-expanded="' + ui.showLow + '">' + ic(ui.showLow ? 'down' : 'right') + '<span class="group-t">Low weight</span><span class="group-s">' + low.length + ' rows &middot; timetables, round-ups</span></button>';
      if (ui.showLow) h += '<ul class="items" aria-label="Low-weight rows">' + low.map(function (o) { order.push('row|' + o.r.id); return itemRow(o, sel); }).join('') + '</ul>';
    }
    return { html: h, order: order };
  }
  function toolsToday() {
    var kinds = [['', 'All']].concat(Object.keys(KIND).map(function (k) { return [k, KIND[k].label]; }));
    var c = Q.counts(), unread = Q.rows({}).filter(function (r) { return !S.read[r.id]; }).length, chans = ['News', 'X', 'Bluesky', 'Reddit', 'YouTube', 'Mastodon'];
    return '<div class="facets" role="group" aria-label="Kind of evidence">' + kinds.map(function (k) { var n = Q.rows(k[0] ? { kind: k[0] } : {}).length; return '<button class="facet" data-act="facet" data-v="' + k[0] + '" data-k="f-' + k[0] + '" aria-pressed="' + (ui.kind === k[0]) + '">' + k[1] + '<span class="facet-n">' + n + '</span></button>'; }).join('') + '</div>' +
      '<div class="tools-row">' +
        '<label class="sel"><span class="vh">Channel</span><select data-ch="channel" data-k="s-ch"><option value="">Every channel</option>' + chans.map(function (x) { return '<option' + (ui.channel === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
        '<label class="sel"><span class="vh">Order</span><select data-ch="sort" data-k="s-sort"><option value="weight"' + (ui.sort === 'weight' ? ' selected' : '') + '>By weight</option><option value="new"' + (ui.sort === 'new' ? ' selected' : '') + '>Newest</option></select></label>' +
        '<span class="tgls">' +
          '<button class="tgl" data-act="toggle" data-t="pinnedOnly" data-k="t-pin" aria-pressed="' + ui.pinnedOnly + '" aria-label="Pinned only, ' + c.pinned + '" title="Pinned only">' + ic('pin') + '<span>' + c.pinned + '</span></button>' +
          '<button class="tgl" data-act="toggle" data-t="unreadOnly" data-k="t-unread" aria-pressed="' + ui.unreadOnly + '" aria-label="Unread only, ' + unread + '" title="Unread only"><i class="dot"></i><span>' + unread + '</span></button>' +
          '<button class="tgl" data-act="toggle" data-t="showAside" data-k="t-aside" aria-pressed="' + ui.showAside + '" aria-label="Show set-aside and muted rows, ' + (c.aside) + '" title="Set aside and muted">' + ic('aside') + '<span>' + c.aside + '</span></button>' +
        '</span></div>';
  }
  function simpleItem(key, sel, main, sub, right, extra) {
    return '<li><button class="item item-plain' + (sel === key ? ' sel' : '') + (extra || '') + '" data-act="sel" data-key="' + esc(key) + '" data-k="i:' + esc(key) + '"' + (sel === key ? ' aria-current="true"' : '') + '><span class="it-main"><span class="it-title one">' + main + '</span>' + (sub ? '<span class="it-meta"><span>' + sub + '</span></span>' : '') + '</span>' + (right ? '<span class="it-r">' + right + '</span>' : '') + '</button></li>';
  }
  function listWatch() {
    var sel = selKey(), order = [], h = '';
    if (S.mode === 'loading') return { html: '<div class="pad">' + skel(8, 'skel-item') + '</div>', order: [] };
    if (S.mode === 'error') return { html: '<div class="pad">' + notice('neg', 'The register could not be read.', '', '<button class="btn btn-secondary btn-sm" data-act="retry" data-k="l-retry">Try again</button>') + '</div>', order: [] };
    var wait = S.proposals.filter(function (p) { return p.status === 'proposed'; }).sort(function (a, b) { return b.score - a.score; }), done = S.proposals.filter(function (p) { return p.status !== 'proposed'; });
    function pi(p) { order.push('prop|' + p.id); return simpleItem('prop|' + p.id, sel, esc(p.name || p.value), chip(p.kind, 'neutral') + ' ' + esc(p.reason), p.status === 'proposed' ? '<span class="it-w"><span class="it-wn">' + p.score + '</span><span class="it-wbar" aria-hidden="true"><i style="width:' + p.score + '%"></i></span><span class="vh"> score</span></span>' : chip(p.status === 'active' ? 'Approved' : 'Dismissed', p.status === 'active' ? 'pos' : 'neutral')); }
    h += '<div class="group-h group-h-static"><span class="group-t">Waiting for a decision</span><span class="group-s">' + wait.length + '</span></div>';
    h += wait.length ? '<ul class="items" aria-label="Proposals waiting">' + wait.map(pi).join('') + '</ul>' : '<p class="group-note">Nothing waits. Discovery proposes once a day; a person decides.</p>';
    if (done.length) h += '<div class="group-h group-h-static"><span class="group-t">Decided this session</span><span class="group-s">' + done.length + '</span></div><ul class="items" aria-label="Decided proposals">' + done.map(pi).join('') + '</ul>';
    [['term', 'Terms'], ['account', 'Accounts'], ['hashtag', 'Hashtags'], ['outlet', 'Outlets'], ['group', 'Groups']].forEach(function (k) {
      var rs = S.register.filter(function (r) { return r.kind === k[0]; }); if (!rs.length) return;
      h += '<div class="group-h group-h-static"><span class="group-t">Register: ' + k[1] + '</span><span class="group-s">' + rs.length + '</span></div><ul class="items" aria-label="Register, ' + k[1] + '">' + rs.map(function (r) {
        order.push('reg|' + r.id);
        var st = r.status === 'active' ? (r.error ? chip('Not collected', 'warn-solid') : r.review ? chip('Review', 'warn') : chip('Active', 'pos')) : chip(r.status === 'off' ? 'Off' : 'Dismissed', 'neutral');
        return simpleItem('reg|' + r.id, sel, esc(r.name || r.value), esc((r.platform ? r.platform + ' - ' : '') + (r.name ? r.value : (r.issue ? issueLabel(r.issue) : 'no issue'))), st);
      }).join('') + '</ul>';
    });
    order.push('add|');
    h += '<ul class="items" aria-label="Add"><li><button class="item item-plain item-add' + (sel === 'add|' ? ' sel' : '') + '" data-act="sel" data-key="add|" data-k="i:add|"' + (sel === 'add|' ? ' aria-current="true"' : '') + '>' + ic('plus') + '<span class="it-title one">Add to the register</span></button></li></ul>';
    return { html: h, order: order };
  }
  function chState(c) { return c.off ? ['Switched off', 'neutral'] : c.state === 'ok' ? ['Delivering', 'pos'] : c.state === 'gap' ? ['Not collected', 'warn-solid'] : c.state === 'paused' ? ['Paused', 'warn'] : ['Quiet, explained', 'neutral']; }
  function listCollection() {
    var sel = selKey(), order = [], h = '';
    if (S.mode === 'loading') return { html: '<div class="pad">' + skel(9, 'skel-item') + '</div>', order: [] };
    if (S.mode === 'error') return { html: '<div class="pad">' + notice('neg', 'Collection could not be read.', '', '<button class="btn btn-secondary btn-sm" data-act="retry" data-k="l-retry">Try again</button>') + '</div>', order: [] };
    var rank = { gap: 0, paused: 1, ok: 2, quiet: 3 }, chs = S.channels.slice().sort(function (a, b) { return rank[a.state] - rank[b.state]; });
    h += '<div class="group-h group-h-static"><span class="group-t">Channels</span><span class="group-s">gaps first</span></div><ul class="items" aria-label="Channels">' + chs.map(function (c) {
      order.push('ch|' + c.id); var st = chState(c);
      return simpleItem('ch|' + c.id, sel, esc(c.label), c.d1 + ' in the window &middot; ' + (c.by === 'mac' ? 'the Mac' : 'the worker'), chip(st[0], st[1], c.state === 'gap' && !c.off ? 'alert' : null), c.state === 'gap' && !c.off ? ' item-gap' : '');
    }).join('') + '</ul>';
    h += '<div class="group-h group-h-static"><span class="group-t">Public record</span><span class="group-s">parliament and petitions</span></div><ul class="items" aria-label="Public record">' +
      Q.pages().map(function (p) { order.push('pg|' + p.id); return simpleItem('pg|' + p.id, sel, esc(p.name), esc(p.house + ' - ' + p.stage), chip('next ' + day(p.next), 'neutral', 'cal')); }).join('') +
      Q.petitions().map(function (p) { order.push('pt|' + p.id); return simpleItem('pt|' + p.id, sel, esc(p.name), Q.fmt(p.count) + ' signatures &middot; ' + esc(p.host), chip('+' + Q.fmt(p.d1), p.d1 > 500 ? 'accent' : 'neutral')); }).join('') + '</ul>';
    order.push('recall|');
    h += '<div class="group-h group-h-static"><span class="group-t">The measure of the work</span></div><ul class="items" aria-label="Recall">' + simpleItem('recall|', sel, 'Recall against filed reports', 'Of the links in ' + Q.recall().reports + ' reports, the share held', '<span class="it-w"><span class="it-wn">' + Math.round(Q.recall().share * 100) + '%</span></span>') + '</ul>';
    return { html: h, order: order };
  }
  function listOptions() { var sel = selKey(), order = []; return { html: '<ul class="items" aria-label="Options">' + OPT.map(function (o) { order.push('opt|' + o.id); return '<li><button class="item item-plain item-nav' + (sel === 'opt|' + o.id ? ' sel' : '') + '" data-act="sel" data-key="opt|' + o.id + '" data-k="i:opt|' + o.id + '"' + (sel === 'opt|' + o.id ? ' aria-current="true"' : '') + '>' + ic(o.icon) + '<span class="it-main"><span class="it-title one">' + o.label + '</span><span class="it-meta"><span>' + o.sub + '</span></span></span></button></li>'; }).join('') + '</ul>', order: order }; }
  function listSystem() { var sel = selKey(), order = []; return { html: '<ul class="items" aria-label="Design system sections">' + SYS.map(function (s) { order.push('sys|' + s[0]); return '<li><button class="item item-plain item-nav' + (sel === 'sys|' + s[0] ? ' sel' : '') + '" data-act="sel" data-key="sys|' + s[0] + '" data-k="i:sys|' + s[0] + '"' + (sel === 'sys|' + s[0] ? ' aria-current="true"' : '') + '><span class="it-title one">' + s[1] + '</span></button></li>'; }).join('') + '</ul>', order: order }; }

  function renderList() {
    var lr = listRoute(), hk = ui.route + '|' + ui.rail + '|' + ui.narrow, head = $('list-head');
    if (ui.headKey !== hk) {
      ui.headKey = hk; var h;
      if (ui.rail) h = '<button class="btn-icon" data-act="rail" data-k="rail" aria-label="Expand the list" title="Expand the list">' + ic('menu') + '</button>';
      else if (lr === 'today') h = '<div class="lh-row"><h2 class="lh-title">The window</h2><span class="lh-count" id="lh-count"></span>' + (ui.narrow && ui.route === 'brief' ? '<button class="btn-icon btn-icon-sm" data-act="rail" data-k="rail" aria-label="Collapse the list to a rail" title="Collapse to a rail">' + ic('menu') + '</button>' : '') + '</div>' +
        '<label class="search"><span class="vh">Search the window</span>' + ic('search') + '<input id="search" type="search" placeholder="Search titles, outlets, actors" autocomplete="off" spellcheck="false" value="' + esc(ui.search) + '">' + kbd('/') + '</label><div id="list-tools"></div>';
      else h = '<div class="lh-row"><h2 class="lh-title">' + ({ watch: 'Watch', collection: 'Collection', options: 'Options', system: 'Design system' })[lr] + '</h2><span class="lh-count">' + ({ watch: 'proposals, then the register', collection: 'what each channel delivered', options: esc(Q.desk().name), system: 'Concept C tokens and parts' })[lr] + '</span></div>';
      head.innerHTML = h;
    }
    $('list').setAttribute('aria-label', ({ today: 'The window: checks and evidence', watch: 'Watch: proposals and the register', collection: 'Collection: channels and the public record', options: 'Options', system: 'Design system sections' })[lr]);
    if (lr === 'today' && !ui.rail) {
      setHTML($('list-tools'), toolsToday());
      var n = Q.rows({}).length, un = Q.rows({}).filter(function (r) { return !S.read[r.id]; }).length, lc = $('lh-count');
      if (lc) lc.textContent = S.mode === 'loading' ? 'reading...' : n + ' rows, ' + un + ' unread';
    }
    var m = ({ today: listToday, watch: listWatch, collection: listCollection, options: listOptions, system: listSystem })[lr]();
    ui.order = m.order; setHTML($('list-body'), m.html);
  }

  /* ---------- the reading pane ---------- */
  function evCard(id) { var r = Q.row(id); if (!r) return ''; return '<button class="ev" data-act="open" data-id="' + esc(id) + '" data-k="ev:' + esc(id) + '">' + ic(KIND[r.kind].icon) + '<span class="ev-b"><span class="ev-t">' + esc(r.title) + '</span><span class="ev-m">' + esc(where(r)) + ' &middot; ' + esc(Q.when(r.t)) + '</span></span>' + ic('right') + '</button>'; }
  function sigCard(s) { return '<button class="ev ev-sig" data-act="sel" data-key="sig|' + esc(s.key) + '" data-k="sg:' + esc(s.key) + '">' + chip(s.label, SIGTONE[s.sig]) + '<span class="ev-b"><span class="ev-t">' + esc(s.title) + '</span><span class="ev-m">' + (s.covered ? 'covered in the brief' : 'not yet covered in the brief') + '</span></span>' + ic('right') + '</button>'; }
  function readerRow(r) {
    var w = Q.weight(r), k = KIND[r.kind], sigs = Q.signals().filter(function (s) { return s.item === r.id; }), cin = Q.citedIn(r.id), asg = S.assigned[r.id], gone = S.aside[r.id];
    var kick = [k.one, issueLabel(r.issue)]; if (r.tier) kick.push(r.tier); if (r.opinion) kick.push('opinion');
    var chips = '';
    if (gone) chips += chip('Set aside: ' + gone, 'neutral', 'aside');
    if (S.pins[r.id]) chips += chip(asg ? 'Pinned for ' + (SHORT[asg] || asg) : 'Pinned', 'accent', 'pin');
    if (r.subscriber) chips += chip('Subscriber source', 'info', 'lock');
    if (r.firstSeen) chips += chip('First seen in fourteen days', 'info');
    if (r.mp) chips += chip('Sitting MP, named on their own post', 'neutral');
    if (r.recorded) chips += chip('Recorded date', 'pos', 'check');
    var by = r.kind === 'media' ? '<b>' + esc(r.outlet) + '</b>' : r.kind === 'actor' ? '<b>' + esc(r.who) + '</b> &middot; ' + esc(r.role) + ' &middot; ' + esc(r.channel) : r.kind === 'social' ? '<b>' + esc(r.channel) + '</b> &middot; author not recorded' : r.kind === 'narrative' ? '<b>' + r.n + ' rows</b> across ' + r.spread.length + ' channels' : '<b>' + day(r.date) + '</b> &middot; ' + esc(r.what);
    var body = '';
    if (r.kind === 'media') {
      body = '<div class="art-body"><p>' + esc(r.text) + '</p></div><p class="art-note">' + ic(r.subscriber ? 'lock' : 'info') + (r.subscriber ? 'Subscriber text is held apart from the archive. A brief quotes thirty words of it at most.' : r.full ? 'The full text is held, read from a public route.' : 'The headline and summary are held. The full text was not fetched for this row.') + '</p>';
    } else if (r.kind === 'social' || r.kind === 'actor') {
      body = '<blockquote class="post"><p>' + esc(r.text) + '</p></blockquote><p class="art-note">' + ic('info') + (r.kind === 'actor' ? 'A registered public actor on its own post, named from the register.' : 'An unregistered account is never named: this row carries no author. Found by ' + esc(r.foundBy || 'the lexicon') + '.') + '</p>';
    } else if (r.kind === 'narrative') {
      body = '<div class="art-body"><p class="claim"><span class="lbl">The claim</span>' + esc(r.claim) + '</p></div>' +
        '<h3 class="sub">How it spread</h3><ol class="stepper stepper-h">' + r.spread.map(function (c, i) { return '<li class="step done"><span class="step-n">' + (i + 1) + '</span><span class="step-t">' + esc(c) + '</span></li>'; }).join('') + '</ol>';
    } else {
      body = '<div class="art-body"><p class="claim"><span class="lbl">As written</span>&ldquo;' + esc(r.asWritten) + '&rdquo;</p></div><p class="art-note">' + ic('info') + (r.recorded ? 'The date is recorded on a watched parliament page.' : 'A day and a month written beside an action word. Never a guess.') + '</p>' +
        (r.from ? '<h3 class="sub">Read from</h3>' + evCard(r.from) : '');
    }
    var f = [];
    if (r.kind === 'media') {
      f.push(['Outlets', r.outlets > 1 ? '<b>' + r.outlets + '</b> carried it<ul class="also">' + ['<li><span class="also-o">' + esc(r.outlet) + '</span><span class="also-n">first seen</span></li>'].concat(r.also.map(function (o) { return '<li><span class="also-o">' + esc(o) + '</span><span class="also-n">syndicated copy</span></li>'; })).join('') + '</ul>' : 'One outlet. No syndicated copy is held.']);
      f.push(['Reach', r.fb ? '<b>' + Q.fmt(r.fb) + '</b> Facebook reactions' + bar(Math.log10(1 + r.fb) / 3.5 * 100) : 'No reach figure is held.']);
    }
    if (r.kind === 'social' || r.kind === 'actor') {
      var y = (r.eng || 0) - (r.growth || 0);
      f.push(['Reach and growth', '<b>' + Q.fmt(r.eng) + '</b> interactions' + (r.growth ? '<div class="grow"><div class="grow-r"><span>Yesterday\'s snapshot</span>' + bar(y / r.eng * 100, 'dim') + '<span class="num">' + Q.fmt(y) + '</span></div><div class="grow-r"><span>Now</span>' + bar(100) + '<span class="num">' + Q.fmt(r.eng) + '</span></div></div><span class="up">+' + Q.fmt(r.growth) + ' since yesterday</span>' : r.kind === 'social' ? '<br><span class="muted">No growth since yesterday\'s snapshot.</span>' : '')]);
    }
    if (r.kind === 'social') f.push(['Tone of held comments', r.comments ? '<b>' + toneWord(r.tone) + '</b> across ' + plural(r.comments, 'comment') + '<span class="tone" aria-hidden="true"><i style="left:' + Math.round((r.tone + 1) / 2 * 100) + '%"></i></span><span class="tone-l"><span>hostile</span><span>supportive</span></span>' : 'No comments are held under this post.']);
    if (r.kind === 'narrative') { f.push(['Stance toward the client', chip(r.side, r.side === 'hostile' ? 'neg' : 'neutral')]); f.push(['Pace', '<b>' + r.n24 + '</b> of its ' + r.n + ' rows arrived in the last day' + bar(r.n24 / r.n * 100)]); f.push(['Status', chip(r.status, r.status === 'emerging' ? 'accent' : 'neutral')]); }
    if (r.layer) f.push(['Collected by', esc(LAYER[r.layer])]);
    f.push(['Weight', '<b>' + w.score + '</b> of 100' + bar(w.score) + (w.why.length ? '<span class="why">' + w.why.map(function (x) { return chip(x, 'neutral'); }).join('') + '</span>' : '<br><span class="muted">Nothing lifts it: no reach, spread or check.</span>')]);
    f.push(['Checks that name it', sigs.length ? sigs.map(sigCard).join('') : '<span class="muted">None of the six checks names this row.</span>']);
    f.push(['Already cited in', cin.length ? cin.map(function (s) { return '<button class="chip chip-btn chip-pos" data-act="jump" data-sid="' + s + '" data-k="ci:' + s + '">' + ic('check') + esc(secTitle(s)) + '</button>'; }).join(' ') : '<span class="muted">Not cited in the brief yet.</span>']);
    return '<article class="read-grid"><div class="art"><p class="kicker">' + ic(k.icon) + kick.map(esc).join(' <span class="sep">/</span> ') + '</p><h2 class="art-h">' + esc(r.title) + '</h2>' +
      '<p class="byline">' + by + ' <span class="sep">&middot;</span> <time>' + esc(Q.when(r.t)) + '</time> <span class="sep">&middot;</span> ' + Q.ago(r.t) + '</p>' + (chips ? '<div class="art-chips">' + chips + '</div>' : '') + body + '</div>' +
      '<aside class="side" aria-label="What is known about this item">' + facts(f) + '</aside></article>';
  }
  function readerSig(s) {
    var gap = s.sig === 'gap', ch = gap ? S.channels.filter(function (c) { return c.id === s.channel; })[0] : null, checks = Q.checks();
    var h = '<article class="read-grid"><div class="art"><p class="kicker">' + ic(gap ? 'alert' : 'flag') + 'Check <span class="sep">/</span> computed, no model</p>' +
      '<div class="art-chips">' + chip(s.label, SIGTONE[s.sig], gap ? 'alert' : null) + (s.covered ? chip('Covered in the brief', 'pos', 'check') : chip('Not yet covered in the brief', 'neutral')) + '</div>' +
      '<h2 class="art-h">' + esc(s.title) + '</h2>';
    if (gap) {
      h += '<div class="art-body"><p>' + esc(s.detail) + '</p></div>' +
        '<div class="fix"><div class="fix-c"><span class="lbl">Why this is a gap</span><p>' + esc(ch && ch.why || s.detail) + '</p></div><div class="fix-c fix-do"><span class="lbl">The one fix</span><p>' + esc(ch && ch.fix || s.fix) + '</p>' +
        '<button class="btn btn-primary" data-act="goto" data-r="collection" data-key="ch|' + esc(s.channel) + '" data-k="fix-go">Open ' + esc(ch ? ch.label : 'Collection') + ' in Collection</button></div></div>' +
        notice('warn', 'This window is not a quiet day for Facebook.', 'Nothing was read there, so nothing can be said about it. Until the brief says so in words, this check stays open.', '', 'note');
    } else {
      h += '<div class="art-body"><p>' + esc(s.detail) + '</p></div>' + (s.at != null ? '<p class="byline">Seen <time>' + esc(Q.when(s.at)) + '</time> &middot; ' + Q.ago(s.at) + '</p>' : '') + (s.item ? '<h3 class="sub">The row it names</h3>' + evCard(s.item) + (canWrite() && !filed() ? '<div class="inline-acts"><button class="btn btn-secondary" data-act="use" data-id="' + esc(s.item) + '" data-k="sig-use">' + ic('quote') + 'Use that row in a section</button></div>' : '') : '');
    }
    h += '</div><aside class="side" aria-label="The six checks">' + facts([['Covered when', gap ? 'the brief names the channel that was not collected.' : 'the brief cites the row this check names.'],
      ['The six checks', '<ul class="checklist">' + checks.map(function (c) { return '<li>' + ic('check') + esc(c) + '</li>'; }).join('') + '</ul><span class="muted">All six ran for this window. Gaps lead the list: an empty table is never read as a quiet day.</span>']]) + '</aside></article>';
    return h;
  }
  function readerProposal(p) {
    var prop = p.status === 'proposed', w = canWrite(), pv = p.preview, iss = ui.issue[p.id] || '';
    var h = '<article class="read-grid"><div class="art"><p class="kicker">' + ic('eye') + 'Proposal <span class="sep">/</span> ' + esc(p.kind) + '</p><div class="art-chips">' + (prop ? chip('Waiting for a decision', 'accent') : p.status === 'active' ? chip('Approved' + (p.issue ? ' under ' + issueLabel(p.issue) : ''), 'pos', 'check') : chip('Dismissed', 'neutral')) + '</div>' +
      '<h2 class="art-h">' + esc(p.name || p.value) + '</h2>' + (p.name ? '<p class="byline">' + esc(p.value) + '</p>' : '') + '<div class="art-body"><p>' + esc(p.reason) + '.</p></div>';
    if (!prop && p.reason2) h += notice('info', 'Dismissed with a reason', esc(p.reason2) + ' It will not be proposed again.', '', 'note');
    h += '<h3 class="sub">The rows behind it</h3>' + p.evidence.map(evCard).join('');
    h += '<h3 class="sub">Preview</h3>';
    if (!pv) h += '<p class="muted">A preview counts what a term would have caught in what is already held. ' + (p.kind === 'term' ? 'None is held for this one.' : 'It applies to terms; this is a' + (/^[aeiou]/.test(p.kind) ? 'n ' : ' ') + esc(p.kind) + '.') + '</p>';
    else if (!ui.preview[p.id]) h += '<p class="muted">What this term would have caught in what is already held. Writes nothing, spends nothing.</p><div class="inline-acts"><button class="btn btn-secondary" data-act="preview" data-id="' + p.id + '" data-k="pv">' + ic('eye') + 'Preview what it would catch</button></div>';
    else h += '<div class="stats"><div class="stat"><b>' + pv.held + '</b><span>rows already on the desk</span></div><div class="stat"><b>+' + pv.add + '</b><span>rows it would add</span></div><div class="stat"><b>' + pv.au + ' of ' + pv.add + '</b><span>say something Australian</span></div></div><ul class="samples">' + pv.sample.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>';
    if (prop && w) {
      h += '<h3 class="sub">Decide</h3><div class="decide">' + ((p.kind === 'term' || p.kind === 'hashtag') ? '<label class="field"><span class="field-l">Approve under an issue</span><select data-ch="issue" data-id="' + p.id + '" data-k="iss"><option value="">No issue: searched for, tags nothing</option>' + Q.issues().map(function (i) { return '<option value="' + i.id + '"' + (iss === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' : '') +
        '<div class="inline-acts"><button class="btn btn-primary" data-act="approve" data-id="' + p.id + '" data-k="appr">' + ic('check') + 'Approve</button><button class="btn btn-danger" data-act="dismiss" data-id="' + p.id + '" data-k="dism">Dismiss with a reason...</button></div>' +
        '<p class="muted">An approval widens collection and tagging only. It never changes a Sentinel trigger. A dismissal is never proposed again.</p></div>';
    } else if (prop) h += '<p class="muted">' + ic('lock') + ' A read-only key cannot decide a proposal.</p>';
    h += '</div><aside class="side" aria-label="About this proposal">' + facts([['Score', '<b>' + p.score + '</b> of 100' + bar(p.score)], ['Kind', esc(p.kind)], ['Proposed by', 'Keyword discovery, once a day for this desk. No model call.'], ['Read by', prop ? 'Nothing, until a person approves it.' : p.status === 'active' ? 'Every collector, from the next sweep.' : 'Nothing.']]) + '</aside></article>';
    return h;
  }
  function readerRegister(r) {
    var w = canWrite(), on = r.status === 'active';
    var h = '<article class="read-grid"><div class="art"><p class="kicker">' + ic('layers') + 'Register <span class="sep">/</span> ' + esc(r.kind) + '</p><div class="art-chips">' + chip(on ? 'Active' : r.status === 'off' ? 'Switched off' : 'Dismissed', on ? 'pos' : 'neutral') + (r.actor ? chip(r.actor === 'official' ? 'Public official' : 'Organisation', 'neutral') : '') + '</div>' +
      '<h2 class="art-h">' + esc(r.name || r.value) + '</h2>' + (r.name ? '<p class="byline">' + esc(r.value) + (r.platform ? ' &middot; ' + esc(r.platform) : '') + '</p>' : '');
    if (r.error) h += notice('warn', 'Not collected: ' + esc(r.platform || 'this channel') + ' delivered nothing.', 'This account is on the register, but no layer can read it today.', '<button class="btn btn-secondary btn-sm" data-act="goto" data-r="collection" data-key="ch|' + esc((r.platform || '').toLowerCase()) + '" data-k="r-coll">Open Collection</button>');
    if (r.review) h += notice('info', 'Due for review', 'Approved thirty days ago and has matched nothing since. Keep it, or switch it off.', '', 'note');
    if (r.status === 'dismissed') h += notice('info', 'Dismissed', esc(r.reason || '') + '. It is never proposed again.', '', 'note');
    if (r.status !== 'dismissed') h += '<div class="setting"><div><span class="field-l" id="sw-reg">Read by the collectors</span><p class="muted">Off stops the search and the tagging; the entry and its history stay.</p></div>' + (w ? '<button class="switch" role="switch" aria-checked="' + on + '" aria-labelledby="sw-reg" data-act="reg-toggle" data-id="' + r.id + '" data-k="sw-reg"><span></span></button>' : chip(on ? 'On' : 'Off', 'neutral')) + '</div>';
    h += '</div><aside class="side" aria-label="About this entry">' + facts([['Kind', esc(r.kind)], r.issue ? ['Tags under', esc(issueLabel(r.issue))] : (r.kind === 'term' ? ['Tags under', 'No issue: searched for only'] : null), ['Last matched', r.last == null ? '<span class="muted">Never in this window</span>' : Q.ago(r.last)], r.actor ? ['Named on its posts', 'Yes: a registered public actor, on its own posts only.'] : null]) + '</aside></article>';
    return h;
  }
  function readerAdd() {
    if (!canWrite()) return '<div class="read-one">' + emptyState('lock', 'A read-only key cannot add to the register', 'Everything on the register can still be read from the list.', '') + '</div>';
    var a = ui.add;
    return '<article class="read-one"><p class="kicker">' + ic('plus') + 'Register</p><h2 class="art-h">Add to the register</h2><p class="muted">A person adds it, so it is active at once. Only public names: an account is added as a public actor or not at all.</p>' +
      '<form class="form" data-form="add"><label class="field"><span class="field-l">Kind</span><select data-ch="add-kind" data-k="a-kind">' + ['term', 'hashtag', 'account', 'outlet', 'group'].map(function (k) { return '<option' + (a.kind === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span class="field-l">Value</span><input type="text" data-in="add-value" data-k="a-val" value="' + esc(a.value) + '" placeholder="for example: wharf closure" autocomplete="off"><span class="field-h">At most sixty active terms a desk. A generic term must name Australia.</span></label>' +
      '<label class="field"><span class="field-l">Issue it tags under</span><select data-ch="add-issue" data-k="a-iss"><option value="">No issue: searched for only</option>' + Q.issues().map(function (i) { return '<option value="' + i.id + '"' + (a.issue === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' +
      '<div class="inline-acts"><button type="submit" class="btn btn-primary" data-k="a-go">' + ic('plus') + 'Add as active</button></div></form></article>';
  }
  function consoleHTML(id) {
    var j = S.job; if (!j || j.channel !== id) return '';
    return '<div class="console" role="log" aria-live="polite" aria-label="Collection job"><div class="console-h"><span>' + (j.done ? (j.failed ? 'failed' : 'finished') : 'running') + '</span>' + (j.done ? chip(j.failed ? 'Failed' : 'Done', j.failed ? 'neg' : 'pos') : '<span class="spin" aria-hidden="true"></span>') + '</div><pre>' + (j.lines.length ? j.lines.map(function (l) { return '<span class="' + (/^failed/.test(l) ? 'c-neg' : /^\$/.test(l) ? 'c-cmd' : /^done/.test(l) ? 'c-pos' : '') + '">' + esc(l) + '</span>'; }).join('\n') : '<span class="c-dim">waiting for the first line...</span>') + (j.done ? '' : '\n<span class="cursor">_</span>') + '</pre></div>';
  }
  function readerChannel(c) {
    var st = chState(c), w = canWrite(), gap = (c.state === 'gap' || c.state === 'paused') && !c.off, running = S.job && S.job.channel === c.id && !S.job.done;
    var h = '<article class="read-grid"><div class="art"><p class="kicker">' + ic('layers') + 'Channel <span class="sep">/</span> read by ' + (c.by === 'mac' ? 'the Mac collector' : 'the worker') + '</p><div class="art-chips">' + chip(st[0], st[1], c.state === 'gap' && !c.off ? 'alert' : null) + '</div><h2 class="art-h">' + esc(c.label) + '</h2><div class="art-body"><p>' + esc(c.how) + '.</p></div>';
    if (gap) h += '<div class="fix"><div class="fix-c"><span class="lbl">Why this is a gap</span><p>' + esc(c.why) + '</p></div><div class="fix-c fix-do"><span class="lbl">The one fix</span><p>' + esc(c.fix) + '</p></div></div>';
    else if (c.state === 'quiet') h += notice('info', 'Quiet, and explained', esc(c.why) + ' This is not a gap.', '', 'note');
    else if (c.off) h += notice('info', 'Switched off for this desk', 'Nothing is read from this channel until it is switched on again.', '', 'note');
    h += '<h3 class="sub">Collect now</h3><div class="inline-acts">' + (w ? '<button class="btn btn-primary" data-act="collect" data-id="' + c.id + '" data-k="collect"' + (running || c.off ? ' disabled' : '') + '>' + ic('play') + (running ? 'Collecting...' : 'Collect now') + '</button><span class="muted">One bridge job. No model call.</span>' : '<span class="muted">' + ic('lock') + ' A read-only key cannot start a job.</span>') + '</div>' + consoleHTML(c.id);
    h += '<div class="setting"><div><span class="field-l" id="sw-ch">Read ' + esc(c.label) + ' for this desk</span><p class="muted">The kill switch for this channel. Rare: daily status is above.</p></div>' + (w ? '<button class="switch" role="switch" aria-checked="' + !c.off + '" aria-labelledby="sw-ch" data-act="ch-toggle" data-id="' + c.id + '" data-k="sw-ch"><span></span></button>' : chip(c.off ? 'Off' : 'On', 'neutral')) + '</div>';
    h += '</div><aside class="side" aria-label="What it delivered">' + facts([['Delivered in the window', '<b>' + c.d1 + '</b> ' + (c.d1 === 1 ? 'row' : 'rows') + (c.d1 === 0 && gap ? ' <span class="warnword">not collected, not quiet</span>' : '')], ['Last seven days', '<b>' + c.d7 + '</b>' + bar(c.d7 / 212 * 100)], ['Last delivered', c.last == null ? '<span class="warnword">Never for this desk</span>' : Q.ago(c.last)], ['Read by', c.by === 'mac' ? 'The collector on the agency\'s Mac (layer 2)' : 'The worker itself (layer 3)']]) + '</aside></article>';
    return h;
  }
  function readerPage(p) { return '<article class="read-grid"><div class="art"><p class="kicker">' + ic('doc') + 'Parliament page <span class="sep">/</span> ' + esc(p.house) + '</p><div class="art-chips">' + chip(p.stage, 'accent') + '</div><h2 class="art-h">' + esc(p.name) + '</h2><div class="art-body"><p>Watched on the public record. Only a labelled stage and a labelled date are read; a date with no year is not. Submitters are never read.</p></div>' + (canWrite() ? '<div class="inline-acts"><button class="btn btn-secondary" data-act="stop-page" data-k="stop">Stop watching this page</button></div>' : '') + '</div><aside class="side" aria-label="About this page">' + facts([['Stage', esc(p.stage)], ['Next date', '<b>' + day(p.next) + '</b><br><span class="muted">Shown first in Upcoming, marked as recorded.</span>'], ['Last read', Q.ago(p.read)], ['Read through', 'The public reader: robots.txt obeyed, ten seconds a host.']]) + '</aside></article>'; }
  function readerPetition(p) { return '<article class="read-grid"><div class="art"><p class="kicker">' + ic('user') + 'Petition counter <span class="sep">/</span> ' + esc(p.host) + '</p><div class="art-chips">' + chip('Self-reported', 'neutral') + '</div><h2 class="art-h">' + esc(p.name) + '</h2><div class="stats"><div class="stat"><b>' + Q.fmt(p.count) + '</b><span>signatures, as the page says</span></div><div class="stat"><b>+' + Q.fmt(p.d1) + '</b><span>since yesterday\'s snapshot</span></div></div><p class="art-note">' + ic('info') + 'The campaign\'s own count, snapshotted once a day. A count that cannot be found is a failure in words, never a zero.</p></div><aside class="side" aria-label="About this counter">' + facts([['Host', esc(p.host)], ['Growth share', bar(p.d1 / p.count * 100) + Math.round(p.d1 / p.count * 1000) / 10 + '% in a day']]) + '</aside></article>'; }
  function readerRecall(r) { return '<article class="read-grid"><div class="art"><p class="kicker">' + ic('check') + 'Recall <span class="sep">/</span> the measure of the work</p><h2 class="art-h">' + Math.round(r.share * 100) + '% of what the filed reports linked to was held</h2><div class="art-body"><p>Of the links in ' + r.reports + ' filed reports, the share AXIOM held by the end of the day after each report. The misses say where to collect next.</p></div><h3 class="sub">By channel</h3><div class="recall">' + r.by.map(function (b) { var pc = Math.round(b[1] * 100); return '<div class="recall-r"><span>' + esc(b[0]) + '</span>' + bar(pc, pc < 50 ? 'warn' : '') + '<span class="num">' + pc + '%</span></div>'; }).join('') + '</div></div><aside class="side" aria-label="About recall">' + facts([['Reports read', '<b>' + r.reports + '</b>'], ['Weakest channel', 'Facebook, 22%: the same gap the checks lead with.'], ['Counted by', 'A tool on the Mac. No sentence of a report leaves it.']]) + '</aside></article>'; }

  function readerOptions(o) {
    var w = canWrite(), op = S.options, h = '<article class="read-one"><p class="kicker">' + ic(o.icon) + 'Options <span class="sep">/</span> ' + esc(Q.desk().name) + '</p><h2 class="art-h">' + o.label + '</h2>';
    function sw(label, hint, key, lab) { return '<div class="setting"><div><span class="field-l" id="' + lab + '">' + label + '</span><p class="muted">' + hint + '</p></div>' + (w ? '<button class="switch" role="switch" aria-checked="' + !!op[key] + '" aria-labelledby="' + lab + '" data-act="opt-toggle" data-o="' + key + '" data-k="' + lab + '"><span></span></button>' : chip(op[key] ? 'On' : 'Off', 'neutral')) + '</div>'; }
    if (o.id === 'display') h += '<div class="form"><div class="field"><span class="field-l" id="dens-l">List density</span><div class="seg" role="radiogroup" aria-labelledby="dens-l">' + ['compact', 'regular', 'comfortable'].map(function (d) { return '<button class="seg-b" role="radio" aria-checked="' + (op.density === d) + '" data-act="density" data-v="' + d + '" data-k="d-' + d + '"' + (w ? '' : ' disabled') + '>' + d + '</button>'; }).join('') + '</div><span class="field-h">Saved with the desk. The reading pane keeps its measure at every density.</span></div>' +
      '<div class="field"><span class="field-l" id="th-l">Appearance</span><div class="seg" role="radiogroup" aria-labelledby="th-l">' + ['dark', 'light'].map(function (t) { return '<button class="seg-b" role="radio" aria-checked="' + (ui.theme === t) + '" data-act="theme" data-v="' + t + '" data-k="th-' + t + '">' + t + '</button>'; }).join('') + '</div><span class="field-h">Dark first. Light is the same tokens re-pointed, kept on this browser.</span></div></div>';
    if (o.id === 'evidence') h += '<div class="form"><label class="field"><span class="field-l">Smallest social post to show</span><input type="number" min="0" max="5000" step="5" data-in="minInteractions" data-k="o-min" value="' + esc(op.minInteractions) + '"' + (w ? '' : ' disabled') + '><span class="field-h">Interactions. Posts under it stay in Low weight; a registered actor\'s post is always shown.</span></label>' + sw('Fold syndicated copies', 'One row for a story, with the outlets that carried it listed in the reading pane.', 'fold', 'o-fold') + '</div>';
    if (o.id === 'drafting') h += sw('Draft the brief each morning', 'One model call a day, inside the automation window. Off: a person presses Draft.', 'autoDraft', 'o-auto') + facts([['Model calls today', '<b>' + S.calls.used + '</b> of ' + S.calls.cap + bar(S.calls.used / S.calls.cap * 100)], ['What spends one', 'Drafting the brief; regenerating a section. Nothing else in the Den.'], ['What never does', 'The six checks, weight, previews, discovery, collection.']]);
    if (o.id === 'mutes') {
      var as = Q.rows({ aside: true });
      h += '<h3 class="sub">Muted on this desk</h3>' + (S.mutes.length ? '<ul class="plain">' + S.mutes.map(function (m) { return '<li><span>' + chip(m.kind, 'neutral') + ' ' + esc(m.value) + '</span>' + (w ? '<button class="btn btn-row" data-act="unmute" data-v="' + esc(m.value) + '" data-k="um:' + esc(m.value) + '">Unmute</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">Nothing is muted. The third set-aside of one outlet or account offers a mute; a person confirms it.</p>') +
        '<h3 class="sub">Set aside in this window</h3>' + (as.length ? '<ul class="plain">' + as.map(function (r) { return '<li><span class="plain-t">' + esc(r.title) + ' <span class="muted">&middot; ' + esc(S.aside[r.id] || 'muted') + '</span></span>' + (w && S.aside[r.id] ? '<button class="btn btn-row" data-act="restore" data-id="' + r.id + '" data-k="rs:' + r.id + '">Put it back</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted">No row is set aside.</p>');
    }
    if (o.id === 'format') h += '<p class="muted">Format A. The sections and the rating words are the desk\'s data; this prototype shows them and does not edit them.</p><ol class="outline-list">' + Q.sections().map(function (s) { return '<li>' + esc(s.title) + (s.built ? ' ' + chip('built from citations', 'neutral', 'lock') : '') + (s.rating ? ' ' + chip('carries the Momentum rating', 'accent') : '') + '</li>'; }).join('') + '</ol>' + facts([['Rating levels', Q.ratings().levels.map(function (l) { return chip(l, 'neutral'); }).join(' ')], ['Trends', Q.ratings().trends.map(function (l) { return chip(l, 'neutral'); }).join(' ')]]);
    if (o.id === 'states') h += simulateHTML();
    return h + '</article>';
  }
  function simulateHTML() {
    var modes = [['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty window'], ['error', 'Error'], ['busy', 'Busy database'], ['dropped', 'Drop the next draft'], ['readonly', 'Read-only key'], ['nogap', 'No collection gap']];
    return '<p class="muted">For reviewing the prototype. The same states open with <code>?state=</code> in the address.</p><div class="sim">' + modes.map(function (m) { return '<button class="btn btn-secondary" data-act="sim" data-v="' + m[0] + '" data-k="sim-' + m[0] + '" aria-pressed="' + ((S.mode === m[0]) || (m[0] === 'normal' && (S.mode === 'filed'))) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
      '<div class="sim"><button class="btn btn-secondary" data-act="sim-conflict" data-k="sim-c">Simulate a conflict in the brief</button><button class="btn btn-secondary" data-act="sim-mute" data-k="sim-m">Simulate the mute offer</button><button class="btn btn-secondary" data-act="sim-file" data-k="sim-f">File the brief</button></div>';
  }

  /* ---------- the design-system page ---------- */
  function parseCol(s) { s = String(s || '').trim(); var m = /^#([0-9a-f]{6})$/i.exec(s); if (m) { var n = parseInt(m[1], 16); return [n >> 16 & 255, n >> 8 & 255, n & 255, 1]; } m = /^rgba?\(([^)]+)\)$/i.exec(s); if (m) { var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat); return [p[0], p[1], p[2], p[3] == null || isNaN(p[3]) ? 1 : p[3]]; } return null; }
  function over(f, b) { var a = f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1]; }
  function lum(c) { var a = [c[0], c[1], c[2]].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; }
  function ratio(f, b) { var l1 = lum(f), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
  function tokens(theme) { var el = $('probe-' + theme), cs = el && window.getComputedStyle ? getComputedStyle(el) : null; return function (n) { return cs ? cs.getPropertyValue(n).trim() : ''; }; }
  function contrastTable(theme) {
    var t = tokens(theme), pairs = [['--c-ink', '--c-plane-2', 'Body text on the reader'], ['--c-ink', '--c-plane-1', 'Titles on the list'], ['--c-ink-2', '--c-plane-1', 'Secondary on the list'], ['--c-ink-2', '--c-plane-3', 'Secondary on the brief'], ['--c-ink-3', '--c-plane-1', 'Meta on the list'], ['--c-ink-3', '--c-plane-3', 'Meta on the brief'], ['--c-ink-3', '--c-raised', 'Meta on a raised surface'],
      ['--c-accent', '--c-plane-2', 'Accent text'], ['--c-accent-ink', '--c-accent', 'Primary button'], ['--c-accent', '--c-accent-dim', 'Accent chip', '--c-plane-2'], ['--c-pos', '--c-pos-dim', 'Positive chip', '--c-plane-2'], ['--c-neg', '--c-neg-dim', 'Negative chip', '--c-plane-2'], ['--c-warn', '--c-warn-dim', 'Warning chip', '--c-plane-2'], ['--c-warn-ink', '--c-warn', 'Gap chip (solid)'], ['--c-info', '--c-info-dim', 'Info chip', '--c-plane-2'], ['--c-ink-2', '--c-chip', 'Neutral chip', '--c-plane-1']];
    return '<table class="tbl"><caption class="vh">' + theme + ' theme contrast</caption><thead><tr><th>Pair</th><th>Text</th><th>Ground</th><th class="num">Ratio</th><th>AA</th></tr></thead><tbody>' + pairs.map(function (p) {
      var f = parseCol(t(p[0])), b = parseCol(t(p[1])), base = p[3] ? parseCol(t(p[3])) : null; if (!f || !b) return '<tr><td>' + p[2] + '</td><td colspan="4" class="muted">not computed</td></tr>';
      if (b[3] < 1 && base) b = over(b, base); if (f[3] < 1) f = over(f, b); var r = ratio(f, b);
      return '<tr><td>' + p[2] + '</td><td><span class="sw" style="background:' + esc(t(p[0])) + '"></span><code>' + p[0] + '</code></td><td><span class="sw" style="background:rgb(' + b.slice(0, 3).map(Math.round).join(',') + ')"></span><code>' + p[1] + '</code></td><td class="num">' + r.toFixed(2) + '</td><td>' + (r >= 4.5 ? chip('Pass', 'pos', 'check') : r >= 3 ? chip('Large text only', 'warn') : chip('Fail', 'neg')) + '</td></tr>';
    }).join('') + '</tbody></table>';
  }
  function swatches(theme) { var t = tokens(theme); return '<div class="swatches" data-theme="' + theme + '">' + ['--c-ground', '--c-plane-1', '--c-plane-2', '--c-plane-3', '--c-raised', '--c-line', '--c-ink', '--c-ink-2', '--c-ink-3', '--c-accent', '--c-pos', '--c-neg', '--c-warn', '--c-info'].map(function (n) { return '<div class="swatch"><span style="background:' + esc(t(n)) + '"></span><code>' + n.replace('--c-', '') + '</code><small>' + esc(t(n)) + '</small></div>'; }).join('') + '</div>'; }
  function sysSec(id, title, body) { return '<section class="sys-sec" id="sys-' + id + '" aria-labelledby="sys-h-' + id + '"><h3 class="sys-h" id="sys-h-' + id + '">' + title + '</h3>' + body + '</section>'; }
  function readerSystem() {
    var sampleRow = Q.row('M:1'), sampleSoc = Q.row('S:1'), wasRail = ui.rail; ui.rail = false;
    var rowsDemo = '<ul class="items demo-items">' + (sampleRow ? itemRow({ r: sampleRow, w: Q.weight(sampleRow) }, 'row|M:1') : '') + (sampleSoc ? itemRow({ r: sampleSoc, w: Q.weight(sampleSoc) }, '') : '') + Q.signals().slice(0, 2).map(function (s) { return itemSig(s, ''); }).join('') + '</ul>'; ui.rail = wasRail;
    var h = '<div class="sys"><header class="sys-top"><p class="kicker">' + ic('layers') + 'Concept C <span class="sep">/</span> The Reading Room</p><h2 class="art-h">Design system</h2><p class="art-lead">One pattern for the whole Den: a list, a reading pane, and the brief as a third plane. A soft neutral dark, one warm accent, small precise type in the list and large comfortable type where the reading happens.</p></header>';
    h += sysSec('colour', 'Colour', '<p class="muted">Three planes step up in lightness from list to reader to brief; depth is the step and one soft shadow, never a border alone. Ratios below are computed in the page from the tokens.</p><h4 class="sys-sub">Dark (first)</h4>' + swatches('dark') + contrastTable('dark') + '<h4 class="sys-sub">Light</h4>' + swatches('light') + contrastTable('light') + '<div class="inline-acts"><div class="seg" role="radiogroup" aria-label="Appearance">' + ['dark', 'light'].map(function (t) { return '<button class="seg-b" role="radio" aria-checked="' + (ui.theme === t) + '" data-act="theme" data-v="' + t + '" data-k="sth-' + t + '">' + t + '</button>'; }).join('') + '</div><span class="muted">Switch the whole prototype.</span></div>');
    h += sysSec('type', 'Type', '<div class="type-scale">' + [['Display, Manrope 700', 't-28', 'Ferry levy splits the upper house'], ['Heading, Manrope 650', 't-20', 'Traditional Media Coverage'], ['Reading, serif 17.5 / 1.6, 68 characters', 't-read', 'The report sets out the proposal, the operator\'s response and what the harbour authority has said so far.'], ['Body, DM Sans 14', 't-14', 'Coverage ran in six outlets and drew 1,840 reactions.'], ['List title, DM Sans 13 / 550', 't-13', 'Harbourline warns levy would end three off-peak routes'], ['Meta, DM Sans 12', 't-12', 'National Wire - 4 outlets - 3 h ago'], ['Label, DM Sans 11 / 650 caps', 't-11', 'Checks that name it']].map(function (r) { return '<div class="type-r"><span class="type-n">' + r[0] + '</span><span class="' + r[1] + '">' + esc(r[2]) + '</span></div>'; }).join('') + '</div>');
    h += sysSec('space', 'Spacing and radii', '<div class="scale">' + [4, 8, 12, 16, 20, 24, 32, 48].map(function (n, i) { return '<div class="scale-i"><span style="width:' + n + 'px;height:' + n + 'px"></span><code>--s-' + (i + 1) + '</code><small>' + n + '</small></div>'; }).join('') + '</div><div class="scale">' + [['--r-1', 4], ['--r-2', 6], ['--r-3', 10], ['--r-4', 14], ['--r-pill', 999]].map(function (r) { return '<div class="scale-i"><span class="rad" style="border-radius:var(' + r[0] + ')"></span><code>' + r[0] + '</code><small>' + r[1] + '</small></div>'; }).join('') + '</div>');
    h += sysSec('depth', 'Elevation', '<div class="elev"><div class="elev-i e0">Plane 1<small>the list</small></div><div class="elev-i e1">Plane 2<small>the reader</small></div><div class="elev-i e2">Plane 3<small>the brief</small></div><div class="elev-i e3">Raised<small>menu, card</small></div><div class="elev-i e4">Overlay<small>dialog</small></div></div>');
    h += sysSec('motion', 'Motion', '<p class="muted">Three durations, one curve. Motion says where something came from: the brief slides in from its edge, a menu grows from its button, a toast rises. Under <code>prefers-reduced-motion</code> every duration is zero and the skeleton stops.</p>' + facts([['--m-fast', '120 ms: hover, press, focus'], ['--m-base', '200 ms: menus, chips, the list selection'], ['--m-slow', '320 ms: the brief pane, dialogs, the drawer'], ['--m-ease', 'cubic-bezier(.2, .7, .2, 1)']]) + '<div class="inline-acts"><button class="btn btn-secondary" data-act="say" data-v="A toast rises from the foot of the reader." data-k="m-toast">Show a toast</button><button class="btn btn-secondary" data-act="help" data-k="m-dlg">Open a dialog</button></div>');
    h += sysSec('buttons', 'Buttons', '<p class="muted">Five ranks. One primary a pane. Hit sizes: 36 px, 32 px for row actions and small. A paid button states its cost in its label.</p><div class="demo-grid">' +
      [['Primary', 'btn btn-primary', 'Mark as filed'], ['Primary, with cost', 'btn btn-primary', 'Draft the brief <span class="cost">1 model call</span>'], ['Secondary', 'btn btn-secondary', 'Save'], ['Quiet', 'btn btn-quiet', 'History'], ['Danger', 'btn btn-danger', 'Dismiss with a reason...'], ['Row action', 'btn btn-row', 'Put it back'], ['Small', 'btn btn-secondary btn-sm', 'Try again']].map(function (b) { return '<div class="demo-c"><span class="lbl">' + b[0] + '</span><div class="demo-r"><button class="' + b[1] + '" type="button">' + b[2] + '</button><button class="' + b[1] + ' is-hover" type="button">Hover</button><button class="' + b[1] + ' is-focus" type="button">Focus</button><button class="' + b[1] + '" type="button" disabled>Disabled</button></div></div>'; }).join('') +
      '<div class="demo-c"><span class="lbl">Icon, toggle, switch, segmented</span><div class="demo-r"><button class="btn-icon" type="button" aria-label="Sample icon button">' + ic('kbd') + '</button><button class="tgl" type="button" aria-pressed="false" aria-label="Sample toggle, off">' + ic('pin') + '<span>3</span></button><button class="tgl" type="button" aria-pressed="true" aria-label="Sample toggle, on">' + ic('pin') + '<span>3</span></button><button class="switch" type="button" role="switch" aria-checked="true" aria-label="Sample switch, on"><span></span></button><button class="switch" type="button" role="switch" aria-checked="false" aria-label="Sample switch, off"><span></span></button><div class="seg" role="radiogroup" aria-label="Sample segmented control"><button class="seg-b" type="button" role="radio" aria-checked="true">regular</button><button class="seg-b" type="button" role="radio" aria-checked="false">compact</button></div></div></div></div>');
    h += sysSec('chips', 'Chips', '<p class="muted">Filled, never outline-only. Tone carries meaning; a collection gap is the one solid chip, so it cannot be mistaken for a quiet label.</p><div class="demo-r wrap">' + chip('Not collected', 'warn-solid', 'alert') + chip('Paused', 'warn') + chip('Spike', 'neg') + chip('Emerging', 'accent') + chip('First seen', 'info') + chip('Delivering', 'pos') + chip('Cited', 'pos', 'check') + chip('Subscriber', 'info', 'lock') + chip('Draft', 'accent') + chip('Filed', 'pos') + chip('No brief', 'neutral') + chip('Read-only key', 'info', 'lock') + '</div><h4 class="sys-sub">Citation chips</h4><div class="demo-r wrap"><span class="prose">led by the Eastport Ledger ' + citeChip('M:1', 'sys') + ' and on X ' + citeChip('S:1', 'sys') + ' <span class="flagged">A sentence with no evidence behind it.</span><span class="flag" role="note">' + ic('flag') + 'No evidence behind this sentence</span> ' + citeChip('Z:9', 'sys') + '</span></div>');
    h += sysSec('rows', 'List rows', '<p class="muted">Selected, unread (a dot and a heavier title), pinned (the pin replaces the dot), read, a check, a gap. The bar at the right is weight, 0 to 100, and its title says why.</p>' + rowsDemo);
    h += sysSec('fields', 'Form fields', '<div class="form demo-form"><label class="field"><span class="field-l">Text</span><input type="text" value="seagrass survey"><span class="field-h">A hint sits under the field.</span></label><label class="field"><span class="field-l">Select</span><select><option>Ferry levy</option><option>Harbour dredging</option></select></label><label class="field field-err"><span class="field-l">With an error</span><input type="text" value="" aria-invalid="true" aria-describedby="demo-err"><span class="field-e" id="demo-err">A dismissal needs a reason.</span></label><label class="field"><span class="field-l">Disabled</span><input type="text" value="read-only key" disabled></label><label class="search"><span class="vh">Sample search</span>' + ic('search') + '<input type="search" placeholder="Search titles, outlets, actors">' + kbd('/') + '</label></div>');
    h += sysSec('notices', 'Notices', notice('warn', 'Facebook delivered nothing in this window.', 'A gap is said in words, with its one fix.', '<button class="btn btn-secondary btn-sm" type="button">Open Collection</button>', 'note') + notice('neg', 'The window could not be read.', 'An error always carries a retry.', '<button class="btn btn-secondary btn-sm" type="button">Try again</button>', 'note') + notice('info', 'Quiet, and explained', 'Parliament is not sitting this week. This is not a gap.', '', 'note') + notice('pos', 'Filed by Anne', 'Final until reopened.', '', 'note'));
    h += sysSec('overlays', 'Dialog, drawer, menu', '<p class="muted">A dialog traps focus, closes on Esc and returns focus to the control that opened it. History opens as a drawer from the right. Menus take arrow keys, and number keys where the items are sections.</p><div class="inline-acts"><button class="btn btn-secondary" data-act="help" data-k="o-dlg">Dialog: shortcuts</button><button class="btn btn-secondary" data-act="history" data-k="o-drw">Drawer: history</button><button class="btn btn-secondary" data-act="states" data-k="o-menu">Menu: states</button></div><div class="dlg dlg-static" aria-hidden="true"><div class="dlg-h"><h4>Before it is filed</h4></div><div class="dlg-b"><p>Two checks are not covered by the brief.</p></div><div class="dlg-f"><span class="btn btn-secondary">Go back and cover them</span><span class="btn btn-primary">File anyway</span></div></div>');
    h += sysSec('console', 'Console and stepper', '<div class="console" aria-label="Sample console"><div class="console-h"><span>finished</span>' + chip('Done', 'pos') + '</div><pre><span>queued: Bluesky</span>\n<span class="c-cmd">$ sweep bluesky --desk hf_au</span>\n<span>12 hits, 9 Australian kept</span>\n<span class="c-pos">done in 4.2 s</span>\n<span class="c-neg">failed: no_collector - start the collector on the Mac</span></pre></div>' + stepperHTML(['Gathering the window\'s evidence', 'Writing ten sections', 'Checking every citation against its row'], 2));
    h += sysSec('skeleton', 'Skeleton, empty, error', '<div class="demo-3"><div class="demo-box">' + skel(2, 'skel-item') + skel(3) + '</div><div class="demo-box">' + emptyState('alert', 'No rows, and this is not a quiet day', 'Empty states say why, and carry the one action that fixes it.', '<button class="btn btn-primary" type="button">Open Collection</button>') + '</div><div class="demo-box">' + emptyState('refresh', 'This pane could not be read', 'The worker answered an error.', '<button class="btn btn-secondary" type="button">Try again</button>') + '</div></div>');
    h += sysSec('toast', 'Toast', '<div class="toast toast-static"><span>Set aside: Duplicate.</span><span class="btn btn-row">Undo</span></div> <div class="toast toast-static toast-warn"><span>This key is read-only: nothing was changed.</span></div>');
    h += sysSec('simulate', 'Simulate states', simulateHTML());
    return h + '</div>';
  }
  function stepperHTML(stages, n) { return '<ol class="stepper">' + stages.map(function (s, i) { var st = i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''; return '<li class="step ' + st + '"' + (st === 'now' ? ' aria-current="step"' : '') + '><span class="step-n">' + (st === 'done' ? ic('check') : i + 1) + '</span><span class="step-t">' + esc(s) + '</span>' + (st === 'now' ? '<span class="spin" aria-hidden="true"></span>' : '') + '</li>'; }).join('') + '</ol>'; }

  function renderReaderBar() {
    var lr = listRoute(), r = lr === 'today' ? selRow() : null, o = ui.order, i = o.indexOf(selKey()), w = canWrite(), h = '';
    if (lr !== 'system') h += '<div class="rb-nav"><button class="btn-icon" data-act="prev" data-k="rb-prev" aria-label="Previous item (k)" title="Previous (k)"' + (i <= 0 ? ' disabled' : '') + '>' + ic('up') + '</button><button class="btn-icon" data-act="next" data-k="rb-next" aria-label="Next item (j)" title="Next (j)"' + (i < 0 || i >= o.length - 1 ? ' disabled' : '') + '>' + ic('down') + '</button><span class="rb-pos">' + (i >= 0 ? (i + 1) + ' of ' + o.length : (o.length ? o.length + ' items' : '')) + '</span></div>';
    else h += '<div class="rb-nav"><span class="rb-pos">Tokens, parts and every state</span></div>';
    h += '<div class="rb-acts">';
    if (r && S.mode !== 'loading' && S.mode !== 'error') {
      var pinned = !!S.pins[r.id], gone = !!S.aside[r.id];
      if (w) {
        h += '<button class="btn btn-quiet' + (pinned ? ' is-on' : '') + '" data-act="pin" data-k="rb-pin" aria-pressed="' + pinned + '" aria-label="' + (pinned ? 'Unpin' : 'Pin') + ' (p)" title="' + (pinned ? 'Unpin' : 'Pin') + ' (p)">' + ic('pin') + '<span class="lbl-opt">' + (pinned ? 'Pinned' : 'Pin') + '</span></button>';
        h += gone ? '<button class="btn btn-quiet" data-act="restore" data-id="' + r.id + '" data-k="rb-aside" title="Put it back in the window">' + ic('undo') + '<span>Put it back</span></button>'
          : '<button class="btn btn-quiet" data-act="aside" data-k="rb-aside" aria-haspopup="menu" aria-label="Set aside with a reason (x)" title="Set aside (x)">' + ic('aside') + '<span class="lbl-opt">Set aside</span></button>';
        h += '<button class="btn btn-accent" data-act="use" data-k="rb-use" aria-haspopup="menu" title="Use in a section (u)"' + (filed() ? ' disabled' : '') + '>' + ic('quote') + '<span>Use in...</span></button>';
      }
      if (r.kind !== 'narrative' && r.kind !== 'upcoming') h += '<button class="btn btn-quiet" data-act="src" data-k="rb-src" aria-label="Open the source in a new tab (o)" title="Open the source (o)">' + ic('ext') + '<span class="lbl-opt">Source</span></button>';
    }
    h += '</div>';
    if (lr === 'today') { var bs = deskState(Q.desk()), open = ui.route === 'brief'; h += '<div class="rb-right"><button class="btn btn-secondary brief-tgl" data-act="brief-toggle" data-k="rb-brief" aria-pressed="' + open + '" title="Toggle the brief (b)">' + ic('doc') + '<span>Brief</span>' + chip(bs[0], bs[1]) + '</button></div>'; }
    setHTML($('reader-bar'), h);
  }
  function renderReader() {
    renderReaderBar();
    var lr = listRoute(), sc = $('reader-scroll'), k = selKey(), h, x = resolve(k);
    if (S.mode === 'loading') h = '<div class="read-one">' + skel(1, 'skel-chip') + skel(1, 'skel-h') + skel(7) + '</div>';
    else if (S.mode === 'error') h = '<div class="read-one">' + emptyState('refresh', 'This desk could not be read', 'The worker answered an error (500). Nothing is lost; nothing below is from this window.', '<button class="btn btn-primary" data-act="retry" data-k="r-retry">' + ic('refresh') + 'Try again</button>') + '</div>';
    else if (lr === 'system') h = readerSystem();
    else if (!x) h = '<div class="read-one">' + emptyState('doc', 'Nothing is selected', 'Choose an item from the list, or press <kbd class="kbd">j</kbd> to start at the top.', '') + '</div>';
    else { var t = selType();
      h = t === 'row' ? readerRow(x) : t === 'sig' ? readerSig(x) : t === 'prop' ? readerProposal(x) : t === 'reg' ? readerRegister(x) : t === 'add' ? readerAdd() : t === 'ch' ? readerChannel(x) : t === 'pg' ? readerPage(x) : t === 'pt' ? readerPetition(x) : t === 'recall' ? readerRecall(x) : t === 'opt' ? readerOptions(x) : ''; }
    setHTML(sc, h);
    var rk = lr + '|' + (lr === 'system' ? '' : k) + '|' + S.mode;
    if (ui.readerKey !== rk) { ui.readerKey = rk; sc.scrollTop = 0; }
    $('reader').setAttribute('aria-label', lr === 'today' ? 'Reading pane: the selected item' : lr === 'system' ? 'Design system' : 'Detail of the selected item');
  }

  /* ---------- the brief ---------- */
  function citeChip(id, sid) { var r = Q.row(id); if (!r) return '<span class="cite cite-bad" title="This id is not in the evidence">' + ic('alert') + esc(id) + ' not in the evidence</span>'; return '<button type="button" class="cite" data-act="open" data-id="' + esc(id) + '" data-tip="' + esc(id) + '" data-k="c:' + sid + ':' + esc(id) + '" aria-label="Citation: ' + esc(citeLabel(r) + ', ' + r.title) + '. Open it in the reader">' + ic(KIND[r.kind].icon) + '<span>' + esc(citeLabel(r)) + '</span></button>'; }
  function citeify(sen, sid) { return esc(sen).replace(/\[([A-Z]:\d+)\]/g, function (m, id) { return citeChip(id, sid); }); }
  function proseHTML(sid) {
    var text = S.brief.sections[sid].text, w = canWrite() && !filed();
    if (!text.trim()) return '<p class="prose prose-empty"' + (w ? ' data-act="edit" data-sid="' + sid + '"' : '') + '>Nothing written yet. ' + (w ? 'Click to write, or open a row and choose Use in...' : '') + '</p>';
    var flags = Q.flags(sid);
    return '<p class="prose"' + (w ? ' data-act="edit" data-sid="' + sid + '" title="Click to edit"' : '') + '>' + Q.sentences(text).map(function (sen) {
      var fl = flags.filter(function (f) { return f.sentence === sen; }), h = citeify(sen, sid);
      return fl.length ? '<span class="flagged">' + h + '</span><span class="flag" role="note">' + ic('flag') + esc(fl.map(function (f) { return f.kind === 'uncited' ? 'No evidence behind this sentence' : f.text; }).join('; ')) + '</span> ' : h + ' ';
    }).join('') + '</p>';
  }
  function secMeta(s) {
    var sec = S.brief.sections[s.id], fl = Q.flags(s.id).length, wds = Q.words(s.id);
    return (fl ? chip(plural(fl, 'flag'), 'warn', 'flag') : '') + (sec.dirty ? chip('Unsaved', 'accent') : '') + '<span class="sec-by">' + (sec.edited ? 'edited by ' + esc(sec.by) : esc(sec.by)) + '</span><span class="sec-w">' + plural(wds, 'word') + '</span>';
  }
  function rateHTML() {
    var R = Q.ratings(), cur = S.brief.ratings.momentum, w = canWrite() && !filed();
    if (!w) return '<span class="lbl">Momentum</span>' + chip(cur.level, 'accent') + chip(cur.trend, cur.trend === 'Escalating' ? 'warn' : 'neutral');
    return '<label class="field field-in"><span class="field-l">Momentum</span><select data-ch="rating" data-key="level" data-k="rt-level">' + R.levels.map(function (l) { return '<option' + (cur.level === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label><label class="field field-in"><span class="field-l">Trend</span><select data-ch="rating" data-key="trend" data-k="rt-trend">' + R.trends.map(function (l) { return '<option' + (cur.trend === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label><span class="muted">The rating is set here, where the section argues for it.</span>';
  }
  function auxHTML(sid) {
    var cs = Q.cites(S.brief.sections[sid].text), fl = Q.flags(sid), seen = {};
    cs = cs.filter(function (c) { if (seen[c]) return false; seen[c] = 1; return true; });
    return '<div class="aux-r"><span class="lbl">Cited here</span>' + (cs.length ? cs.map(function (c) { return citeChip(c, 'aux' + sid); }).join(' ') : '<span class="muted">Nothing yet. Open a row and press ' + kbd('u') + ' to insert its citation at the cursor.</span>') + '</div>' +
      (fl.length ? '<ul class="aux-flags">' + fl.map(function (f) { return '<li>' + ic('flag') + '<span><b>' + esc(f.kind === 'uncited' ? 'No evidence behind' : f.text) + '</b> &ldquo;' + esc(f.sentence.length > 110 ? f.sentence.slice(0, 110) + '...' : f.sentence) + '&rdquo;</span></li>'; }).join('') + '</ul>' : '');
  }
  function sourceHTML() { var sl = Q.sourceList(); return sl.length ? '<ol class="srcs">' + sl.map(function (x) { return '<li><button class="src" data-act="open" data-id="' + esc(x.id) + '" data-k="sl:' + esc(x.id) + '"><span class="src-id">' + esc(x.id) + '</span><span class="src-b"><span class="src-t">' + esc(x.title) + '</span><span class="src-m">' + esc(x.where) + ' &middot; ' + esc(x.when) + '</span></span></button></li>'; }).join('') + '</ol>' : '<p class="muted">No row is cited yet, so the list is empty.</p>'; }
  function secHTML(s, i) {
    var b = S.brief, w = canWrite() && !filed();
    if (s.built) return '<section class="sec sec-built" id="sec-' + s.id + '" data-sid="' + s.id + '" aria-labelledby="sec-t-' + s.id + '"><header class="sec-h"><span class="sec-n">' + (i + 1) + '</span><h3 id="sec-t-' + s.id + '">' + esc(s.title) + '</h3><span class="sec-meta">' + chip('Built from the citations', 'neutral', 'lock') + '</span></header><p class="muted">Every row cited above, in the order it is first cited. It cannot be edited: change a citation and the list follows.</p><div id="sec-src"></div></section>';
    var sec = b.sections[s.id], ed = ui.editing === s.id && w, cf = b.conflict && b.conflict.section === s.id ? b.conflict : null;
    return '<section class="sec' + (ed ? ' editing' : '') + '" id="sec-' + s.id + '" data-sid="' + s.id + '" aria-labelledby="sec-t-' + s.id + '">' +
      '<header class="sec-h"><span class="sec-n">' + (i + 1) + '</span><h3 id="sec-t-' + s.id + '">' + esc(s.title) + '</h3><span class="sec-meta" id="sec-meta-' + s.id + '"></span>' +
        (w ? '<span class="sec-acts">' + (ed ? '<button class="btn btn-secondary btn-sm" data-act="done" data-k="done-' + s.id + '">Done</button>' : '<button class="btn btn-row" data-act="edit" data-sid="' + s.id + '" data-k="ed-' + s.id + '" aria-label="Edit ' + esc(s.title) + '">' + ic('edit') + 'Edit</button>') +
          '<button class="btn btn-row" data-act="regen" data-sid="' + s.id + '" data-k="rg-' + s.id + '" aria-label="Regenerate ' + esc(s.title) + ', 1 model call"' + (sec.busy ? ' disabled' : '') + '>' + ic('spark') + 'Regenerate <span class="cost">1 call</span></button></span>' : '') + '</header>' +
      (cf ? '<div class="notice notice-warn conflict" role="alert"><span class="notice-ic">' + ic('alert') + '</span><div class="notice-b"><strong>' + esc(cf.by) + ' saved this section while you were writing.</strong><p class="theirs"><span class="lbl">Theirs</span>' + citeify(cf.theirs, 'cf') + '</p><div class="notice-acts"><button class="btn btn-primary btn-sm" data-act="keep-mine" data-k="cf-mine">Keep mine</button><button class="btn btn-secondary btn-sm" data-act="take-theirs" data-k="cf-theirs">Take theirs</button></div></div></div>' : '') +
      (s.rating ? '<div class="sec-rate" id="sec-rate"></div>' : '') +
      '<div class="sec-body" id="sec-body-' + s.id + '">' + (sec.busy ? '<div class="regen-busy" role="status"><span class="spin" aria-hidden="true"></span>Regenerating this section from the window\'s evidence...</div>' + skel(3) : ed ? '<label class="vh" for="ta-' + s.id + '">' + esc(s.title) + '</label><textarea class="sec-ta" id="ta-' + s.id + '" data-sid="' + s.id + '" spellcheck="true" placeholder="Write the section. Open a row and press u to cite it here."></textarea>' : '') + '</div>' +
      (ed ? '<div class="sec-aux" id="sec-aux-' + s.id + '"></div>' : '') + '</section>';
  }
  function briefHead() {
    var b = S.brief, w = canWrite(), d = Q.desk(), st = deskState(d), has = b.status !== 'none', dr = b.drafting, loading = S.mode === 'loading' || S.mode === 'error';
    var save = b.conflict ? '<span class="save save-warn">' + ic('alert') + 'Conflict with ' + esc(b.conflict.by) + '\'s save</span>' : b.save === 'unsaved' ? '<span class="save save-dirty"><i class="dot"></i>Unsaved changes</span>' : b.save === 'saving' ? '<span class="save"><span class="spin" aria-hidden="true"></span>Saving...</span>' : b.save === 'failed' ? '<span class="save save-neg">' + ic('alert') + 'Save failed: kept on this computer</span>' : '<span class="save save-ok">' + ic('check') + 'Saved, revision ' + b.revision + '</span>';
    var h = '<div class="bh-row"><div class="bh-t"><h2>Brief</h2><span class="bh-day">' + day(b.day) + '</span>' + chip(st[0], st[1]) + '</div><div class="bh-save" role="status">' + (has && !loading ? save : '') + '</div><button class="btn-icon" data-act="brief-toggle" data-k="bh-x" aria-label="Close the brief pane">' + ic('x') + '</button></div>';
    if (has && !dr && !loading) {
      h += '<div class="bh-acts">';
      if (w && !filed()) h += '<button class="btn btn-secondary" data-act="save" data-k="bh-save"' + (b.save === 'saved' && !b.conflict ? ' disabled' : '') + ' title="Ctrl or Cmd+S">' + (b.save === 'failed' ? 'Save again' : 'Save') + '</button><button class="btn btn-primary" data-act="file" data-k="bh-file">' + ic('check') + 'Mark as filed</button>';
      if (w && filed()) h += '<button class="btn btn-secondary" data-act="reopen" data-k="bh-reopen">Reopen</button>';
      h += '<span class="bh-sp"></span><button class="btn btn-quiet" data-act="export" data-k="bh-exp" aria-haspopup="menu" aria-label="Export" title="Export">' + ic('dl') + '<span class="lbl-b">Export</span></button><button class="btn btn-quiet" data-act="history" data-k="bh-hist" aria-label="History" title="History">' + ic('hist') + '<span class="lbl-b">History</span></button>';
      if (w && !filed()) h += '<button class="btn-icon" data-act="brief-more" data-k="bh-more" aria-haspopup="menu" aria-label="More: draft again">' + ic('more') + '</button>';
      h += '</div>';
      var total = Q.words(), fc = Q.flagCount();
      h += '<nav class="outline" aria-label="Sections of the brief">' + Q.sections().map(function (s, i) {
        var sec = b.sections[s.id], fl = s.built ? 0 : Q.flags(s.id).length, state = s.built ? 'built' : fl ? 'flag' : !sec.text.trim() ? 'empty' : sec.edited ? 'edited' : 'drafted';
        return '<button class="ol ol-' + state + (ui.editing === s.id ? ' ol-on' : '') + '" data-act="jump" data-sid="' + s.id + '" data-k="ol-' + s.id + '" title="' + esc(s.title) + (s.built ? '' : ': ' + Q.words(s.id) + ' words' + (fl ? ', ' + fl + ' flagged' : '')) + '"><span class="ol-n">' + (i + 1) + '</span><span class="ol-t">' + SHORT[s.id] + '</span>' + (fl ? '<span class="ol-f" aria-label="' + fl + ' flagged">' + fl + '</span>' : '') + '</button>';
      }).join('') + '</nav>';
      var unc = Q.signals().filter(function (s) { return !s.covered; });
      h += '<div class="bh-foot"><span class="bh-words"><b>' + Q.fmt(total) + '</b> words</span>' + (fc ? '<span class="bh-flags">' + ic('flag') + plural(fc, 'flagged sentence') + '</span>' : '<span class="bh-okay">' + ic('check') + 'No flags</span>') +
        (unc.length ? '<span class="bh-unc"><span class="lbl">Not yet covered</span>' + unc.map(function (s) { return '<button class="chip chip-btn chip-' + (SIGTONE[s.sig] || 'neutral') + '" data-act="sel" data-key="sig|' + esc(s.key) + '" data-k="unc:' + esc(s.key) + '" title="' + esc(s.title) + '">' + esc(s.label) + '</button>'; }).join('') + '</span>' : '<span class="bh-okay">' + ic('check') + 'Every check is covered</span>') + '</div>';
    }
    return h;
  }
  function briefBody() {
    var b = S.brief, w = canWrite(), dr = b.drafting, n = Q.rows({}).length, pins = Q.counts().pinned;
    if (S.mode === 'loading') return '<div class="pad-l">' + skel(1, 'skel-h') + skel(5) + skel(1, 'skel-h') + skel(4) + '</div>';
    if (S.mode === 'error') return '<div class="pad-l">' + emptyState('refresh', 'The brief could not be read', 'The worker answered an error.', '<button class="btn btn-primary" data-act="retry" data-k="bb-retry">Try again</button>') + '</div>';
    if (dr && dr.dropped) return '<div class="pad-l">' + notice('neg', 'The connection dropped while the brief was being drafted.', 'The worker may have finished it: a draft that completes there is kept. Nothing you wrote is lost, and no second call is spent by checking.', '<button class="btn btn-primary" data-act="checkdraft" data-k="bb-check">Check for the draft</button>') + '</div>';
    if (dr) return '<div class="pad-l drafting" role="status"><h3 class="art-h small">Drafting the brief</h3><p class="muted">One model call, reading ' + plural(dr.evidence, 'row') + ' (' + dr.pinned + ' pinned). Usually a minute or two; the page keeps its connection open.</p>' + stepperHTML(['Gathering the window\'s evidence', 'Writing ten sections', 'Checking every citation against its row'], dr.n) + '<p class="elapsed">Elapsed <b id="draft-el">' + Math.max(0, Math.round((Date.now() - dr.t0) / 1000)) + ' s</b></p></div>';
    if (b.status === 'none') return '<div class="pad-l">' + emptyState('doc', 'No brief for ' + day(b.day) + ' yet', n ? 'The window holds <b>' + plural(n, 'row') + '</b>, ' + pins + ' pinned. A draft reads them all, pinned rows first, and ties every sentence to a row.' : 'The window holds no rows. A brief can still be written by hand, and should say what was not collected.',
      w ? '<div class="empty-acts"><button class="btn btn-primary" data-act="draft" data-k="bb-draft"' + (n ? '' : ' disabled') + '>' + ic('spark') + 'Draft the brief <span class="cost">1 model call</span></button><button class="btn btn-secondary" data-act="byhand" data-k="bb-hand">' + ic('edit') + 'Write by hand</button></div><p class="muted small">' + S.calls.used + ' of ' + S.calls.cap + ' model calls used today.</p>' : '<p class="muted">' + ic('lock') + ' A read-only key cannot start a brief.</p>') + '</div>';
    var h = '';
    if (filed()) h += notice('pos', 'Filed by ' + esc(b.filedBy || 'Anne') + '.', 'A filed brief is final until it is reopened. The exports stay available.', w ? '<button class="btn btn-secondary btn-sm" data-act="reopen" data-k="bb-reopen">Reopen</button>' : '', 'status');
    if (!w) h += notice('info', 'Read-only key', 'Everything can be read and exported. Nothing can be changed.', '', 'note');
    return h + Q.sections().map(secHTML).join('');
  }
  function renderBrief() {
    if (ui.route !== 'brief') { ui.briefKey = null; return; }
    var b = S.brief, sc = $('brief-scroll'), w = canWrite() && !filed();
    if (ui.editing && !w) ui.editing = null;
    setHTML($('brief-head'), briefHead());
    var busy = Object.keys(b.sections).filter(function (k) { return b.sections[k].busy; }).join(',');
    var key = [S.desk, S.mode === 'loading', S.mode === 'error', b.status, b.drafting ? (b.drafting.dropped ? 'x' : b.drafting.n) : '', b.conflict ? b.conflict.section : '', S.role, ui.editing || '', busy, Q.rows({}).length].join('|');
    if (ui.briefKey !== key) {
      var top = sc.scrollTop, fresh = ui.briefKey === null; ui.briefKey = key; sc.innerHTML = briefBody(); sc.scrollTop = fresh ? 0 : top;
      if (ui.editing) { var ta = $('ta-' + ui.editing); if (ta) { ta.value = b.sections[ui.editing].text; autosize(ta); try { ta.focus({ preventScroll: true }); var p = ui.lastEdit && ui.lastEdit.sid === ui.editing ? ui.lastEdit.pos : ta.value.length; ta.setSelectionRange(p, p); } catch (e) {} } }
    }
    if (b.status === 'none' || b.drafting || S.mode === 'loading' || S.mode === 'error') return;
    Q.sections().forEach(function (s) {
      if (s.built) { setHTML($('sec-src'), sourceHTML()); return; }
      var sec = b.sections[s.id]; setHTML($('sec-meta-' + s.id), secMeta(s));
      if (s.rating) { var rt = $('sec-rate'); if (rt && !rt.contains(document.activeElement)) setHTML(rt, rateHTML()); }
      if (sec.busy) return;
      if (ui.editing === s.id && w) {
        var ta = $('ta-' + s.id); if (ta && ta.value !== sec.text) { var at = document.activeElement === ta, pos = ui.lastEdit && ui.lastEdit.sid === s.id ? ui.lastEdit.pos : null; ta.value = sec.text; autosize(ta); if (at && pos != null) { try { ta.setSelectionRange(pos, pos); } catch (e) {} } }
        setHTML($('sec-aux-' + s.id), auxHTML(s.id));
      } else setHTML($('sec-body-' + s.id), proseHTML(s.id));
    });
  }
  function autosize(ta) { try { ta.style.height = 'auto'; ta.style.height = Math.max(120, ta.scrollHeight + 2) + 'px'; } catch (e) {} }
  function startEdit(sid) {
    if (!canWrite() || filed()) return; if (ui.route !== 'brief') { ui.editing = sid; go('brief'); return; }
    ui.editing = sid; ui.lastEdit = { sid: sid, pos: S.brief.sections[sid].text.length }; render();
    var el = $('sec-' + sid); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }
  function doneEdit() { var sid = ui.editing; ui.editing = null; render(); var b = sid && $('brief-scroll').querySelector('[data-k="ed-' + sid + '"]'); if (b) b.focus(); }
  function jumpTo(sid) {
    if (ui.route !== 'brief') { ui.pendingJump = sid; go('brief'); return; }
    var el = $('sec-' + sid); if (el && el.scrollIntoView) { el.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); el.classList.add('flash'); setTimeout(function () { el.classList.remove('flash'); }, 900); }
  }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function save() { if (!canWrite()) { A.say('This key is read-only: nothing was changed.', 'warn'); return; } if (S.brief.status === 'none' || filed()) return; if (S.brief.save === 'saved' && !S.brief.conflict) { A.say('Nothing to save: revision ' + S.brief.revision + ' is current.'); return; } A.save(); }
  function doCite(sid, rowId) {
    if (!canWrite()) { A.say('This key is read-only: nothing was changed.', 'warn'); return; }
    if (filed()) { A.say('The brief is filed. Reopen it to cite a row.', 'warn'); return; }
    if (S.brief.status === 'none') { A.say('There is no brief yet. Draft it, or write by hand, then cite.', 'warn'); return; }
    var at = ui.editing === sid && ui.lastEdit && ui.lastEdit.sid === sid ? ui.lastEdit.pos : null, before = S.brief.sections[sid].text.length;
    A.cite(sid, rowId, at);
    if (at != null) ui.lastEdit.pos = at + (S.brief.sections[sid].text.length - before);
    A.say('Cited in ' + secTitle(sid) + (ui.route === 'brief' ? '.' : '. Press b to open the brief.'));
  }
  function fileFlow() {
    var r = A.file() || {};
    if (r.filed) { ui.editing = null; A.say('Filed. Final until reopened.'); return; }
    if (!r.uncovered) return;
    dialog({ title: 'Before it is filed', html: '<p>The checks below are not covered by the brief: it neither cites the row nor names the gap. Nothing critical missed comes before volume.</p><ul class="dlg-list">' + r.uncovered.map(function (s) { return '<li>' + chip(s.label, SIGTONE[s.sig], s.sig === 'gap' ? 'alert' : null) + '<span><b>' + esc(s.title) + '</b><br><span class="muted">' + esc(s.detail) + '</span></span></li>'; }).join('') + '</ul>' + (Q.flagCount() ? '<p class="muted">' + ic('flag') + ' ' + plural(Q.flagCount(), 'sentence') + ' in the brief ' + (Q.flagCount() === 1 ? 'is' : 'are') + ' also flagged.</p>' : ''),
      foot: [{ label: 'Go back and cover them', cls: 'btn-secondary', auto: true, fn: function () { var k = 'sig|' + r.uncovered[0].key; setTimeout(function () { select(k, true); }, 0); } },
        { label: 'File anyway', cls: 'btn-primary', fn: function () { var x = A.file({ acknowledge: true }) || {}; if (x.filed) { ui.editing = null; A.say('Filed, with ' + plural(r.uncovered.length, 'check') + ' acknowledged as not covered.'); } } }] });
  }
  function copyText(text, label, html) {
    function ok() { A.say(label + ' copied.'); } function fb() { try { var t = document.createElement('textarea'); t.value = text; t.setAttribute('aria-hidden', 'true'); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); var done = document.execCommand('copy'); document.body.removeChild(t); if (done) ok(); else A.say('The browser refused the clipboard. Use a download instead.', 'warn'); } catch (e) { A.say('The browser refused the clipboard. Use a download instead.', 'warn'); } }
    try {
      if (html && navigator.clipboard && window.ClipboardItem) { navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]).then(ok, fb); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(ok, fb); return; }
    } catch (e) {} fb();
  }
  function download(name, text, mime) { try { var u = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(u); }, 500); A.say(name + ' downloaded.'); } catch (e) { A.say('The download could not start in this browser.', 'warn'); } }
  function exportMenu(anchor) {
    var name = 'brief-' + S.desk + '-' + S.brief.day;
    menu(anchor, [{ label: 'Copy for the document', hint: 'formatted and plain text', icon: 'copy', fn: function () { copyText(Q.exportAs('md'), 'The brief', Q.exportAs('html')); } },
      { label: 'Download .md', icon: 'dl', fn: function () { download(name + '.md', Q.exportAs('md'), 'text/markdown'); } },
      { label: 'Download .html', icon: 'dl', fn: function () { download(name + '.html', '<!doctype html><meta charset="utf-8"><title>' + esc(name) + '</title>' + Q.exportAs('html'), 'text/html'); } },
      { label: 'Copy the Slack summary', hint: 'summary and rating', icon: 'copy', fn: function () { copyText(Q.exportAs('slack'), 'The Slack summary'); } }], { label: 'Export the brief' });
  }
  function texts() { var o = {}; Object.keys(S.brief.sections).forEach(function (k) { o[k] = S.brief.sections[k].text; }); return o; }
  function historyDrawer() {
    var b = S.brief, cmp = ui.cmp, h = '<p class="muted">The last sixty revisions are kept. Compare one with what is on the page now.</p><ul class="hist">' + b.history.slice().reverse().map(function (x) {
      var held = !!ui.snap[x.rev], cur = x.rev === b.revision;
      return '<li class="' + (cmp === x.rev ? 'on' : '') + '"><span class="hist-n">' + x.rev + '</span><span class="hist-b"><b>Revision ' + x.rev + '</b>' + (cur ? ' ' + chip('current', 'accent') : '') + '<br><span class="muted">' + (x.by === 'drafted' ? 'drafted by the model' : 'saved by ' + esc(x.by)) + ' &middot; ' + esc(Q.when(x.at)) + '</span></span>' + (held ? '<button class="btn btn-row" data-act="compare" data-rev="' + x.rev + '">' + (cmp === x.rev ? 'Comparing' : 'Compare with now') + '</button>' : '<span class="muted small">text not held in the prototype</span>') + '</li>';
    }).join('') + '</ul>';
    if (cmp != null && ui.snap[cmp]) {
      var snap = ui.snap[cmp], diff = Q.sections().filter(function (s) { return !s.built && snap[s.id] !== b.sections[s.id].text; });
      h += '<h3 class="sub">Revision ' + cmp + ' against now</h3>' + (diff.length ? diff.map(function (s) { return '<div class="cmp"><h4>' + esc(s.title) + '</h4><div class="cmp-2"><div><span class="lbl">Revision ' + cmp + '</span><p>' + esc(snap[s.id] || '(empty)') + '</p></div><div><span class="lbl">Now</span><p>' + esc(b.sections[s.id].text || '(empty)') + '</p></div></div></div>'; }).join('') : '<p class="muted">Every section reads the same as it does now.</p>');
    }
    dialog({ title: 'History', drawer: true, html: h });
  }
  function draftConfirm() {
    var n = Q.rows({}).length, pins = Q.counts().pinned, edited = Object.keys(S.brief.sections).filter(function (k) { return S.brief.sections[k].edited; }).length, has = S.brief.status !== 'none';
    dialog({ title: has ? 'Draft the brief again?' : 'Draft the brief', html: '<div class="stats"><div class="stat"><b>' + n + '</b><span>rows in the window</span></div><div class="stat"><b>' + pins + '</b><span>pinned, read first</span></div><div class="stat"><b>' + S.calls.used + ' of ' + S.calls.cap + '</b><span>model calls used today</span></div></div><p>One model call writes all ten sections from this evidence and ties each sentence to a row. The Source List is built from the citations, never written by the model.</p>' + (has && edited ? notice('warn', plural(edited, 'section') + ' edited by hand will be replaced.', 'To keep them, regenerate single sections instead.', '', 'note') : '') + (S.mode === 'dropped' ? '<p class="muted">Prototype: the connection will drop mid-draft.</p>' : ''),
      foot: [{ label: 'Cancel', cls: 'btn-quiet' }, { label: 'Draft the brief <span class="cost">1 model call</span>', cls: 'btn-primary', auto: true, fn: function () { ui.editing = null; A.draft(function () { A.say('The draft is ready. Every sentence is tied to a row; ' + plural(Q.flagCount(), 'sentence') + ' flagged.'); }); if (ui.route !== 'brief') go('brief'); } }] });
  }
  function regenDialog(sid) {
    var sec = S.brief.sections[sid];
    dialog({ title: 'Regenerate: ' + secTitle(sid), html: '<p>One model call rewrites this section from the window\'s evidence. The other sections are not touched.</p>' + (sec.edited ? notice('warn', 'Your edits to this section will be replaced.', '', '', 'note') : '') + '<label class="field"><span class="field-l">An instruction (optional)</span><input type="text" id="regen-in" placeholder="for example: lead with the crossbench" autocomplete="off"><span class="field-h">' + S.calls.used + ' of ' + S.calls.cap + ' model calls used today.</span></label>',
      foot: [{ label: 'Cancel', cls: 'btn-quiet' }, { label: 'Regenerate this section <span class="cost">1 model call</span>', cls: 'btn-primary', fn: function (root) { var i = root.querySelector('#regen-in'); if (ui.editing === sid) ui.editing = null; if (S.calls.used >= S.calls.cap) { A.say('Today\'s ' + S.calls.cap + ' model calls are used.', 'warn'); return; } A.regenerate(sid, i ? i.value : '', function () { A.say(secTitle(sid) + ' was regenerated.'); }); } }], focus: '#regen-in' });
  }

  /* ---------- triage ---------- */
  function ro() { if (canWrite()) return false; A.say('This key is read-only: nothing was changed.', 'warn'); return true; }
  function doPin(id) { if (ro()) return; var was = !!S.pins[id]; A.pin(id); ui.toastUndo = true; A.say(was ? 'Unpinned.' : 'Pinned. It leads the evidence when the brief is drafted.'); }
  function asideMenu(id, anchor) {
    if (ro()) return; var r = Q.row(id); if (!r || S.aside[id]) return;
    menu(anchor, Q.asideReasons().map(function (reason) { return { label: reason, fn: function () { doAside(id, reason); } }; }), { label: 'Set aside because', digits: true });
  }
  function doAside(id, reason) {
    var o = ui.order, i = o.indexOf('row|' + id), next = o[i + 1] || o[i - 1] || '';
    var res = A.aside(id, reason) || {};
    if (next && selKey() === 'row|' + id && !ui.showAside) ui.sel.today = next;
    ui.toastUndo = true; A.say('Set aside: ' + reason + '.');
    if (res.offer) muteOffer(res.offer);
  }
  function muteOffer(of) {
    dialog({ title: 'Mute ' + of.value + ' on this desk?', html: '<p>That is the third row from this ' + esc(of.kind) + ' you have set aside in this window. Muting leaves its rows out of this desk\'s window from now on; they stay in the archive and other desks still see them.</p><p class="muted">A mute is undone in Options, under Mutes and set-aside.</p>',
      foot: [{ label: 'Not now', cls: 'btn-secondary', auto: true }, { label: 'Mute ' + esc(of.value), cls: 'btn-danger', fn: function () { A.mute(of.kind, of.value); } }] });
  }
  function useMenu(id, anchor) {
    if (ro()) return; var r = Q.row(id); if (!r) return;
    if (filed()) { A.say('The brief is filed. Reopen it to cite a row.', 'warn'); return; }
    if (S.brief.status === 'none') { A.say('There is no brief yet. Draft it, or write by hand, then cite.', 'warn'); return; }
    var cin = Q.citedIn(id), sug = KIND[r.kind].sec, secs = Q.sections().filter(function (s) { return !s.built; });
    menu(anchor, secs.map(function (s, i) { var hint = ui.editing === s.id ? 'at the cursor' : cin.indexOf(s.id) >= 0 ? 'cited here' : s.id === sug ? 'suggested' : ''; return { label: s.title, key: i < 9 ? String(i + 1) : i === 9 ? '0' : '', hint: hint, mark: cin.indexOf(s.id) >= 0, fn: function () { doCite(s.id, id); } }; }), { label: 'Use in a section', digits: true, focus: Math.max(0, secs.map(function (s) { return s.id; }).indexOf(ui.editing || sug)) });
  }

  /* ---------- overlays: menu, dialog, tooltip, toast ---------- */
  function menu(anchor, items, o) {
    closeMenu(); o = o || {}; var pop = $('pop'); if (!anchor || !anchor.getBoundingClientRect) anchor = $('reader-bar');
    ui.menu = { items: items, digits: o.digits, ret: anchor.getAttribute && anchor.getAttribute('data-k') };
    pop.innerHTML = '<div class="menu-scrim" data-act="menu-close"></div><div class="menu" role="menu" aria-label="' + esc(o.label || 'Menu') + '">' + (o.label ? '<div class="menu-l" aria-hidden="true">' + esc(o.label) + '</div>' : '') + items.map(function (it, i) {
      if (it.sep) return '<div class="menu-sep" role="separator"></div>';
      return '<button class="menu-i' + (it.danger ? ' danger' : '') + '" role="menuitem" data-act="mi" data-i="' + i + '"' + (it.disabled ? ' disabled' : '') + '>' + (it.icon ? ic(it.icon) : it.mark ? ic('check') : it.key ? '<span class="menu-k">' + it.key + '</span>' : '<span class="menu-k"></span>') + '<span class="menu-t">' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' + (it.right || '') + (it.hint ? '<span class="menu-h">' + esc(it.hint) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
    var m = pop.querySelector('.menu'), r = anchor.getBoundingClientRect(), mw = m.offsetWidth || 260, mh = m.offsetHeight || 300, vw = window.innerWidth, vh = window.innerHeight;
    var left = Math.max(8, Math.min(r.left, vw - mw - 8)), top = r.bottom + 6; if (top + mh > vh - 8) top = Math.max(8, r.top - mh - 6);
    m.style.left = left + 'px'; m.style.top = top + 'px';
    var bs = m.querySelectorAll('.menu-i:not([disabled])'); var f = bs[Math.min(o.focus || 0, bs.length - 1)]; if (f) f.focus();
  }
  function closeMenu(noFocus) { if (!ui.menu) return; var ret = ui.menu.ret; ui.menu = null; $('pop').innerHTML = ''; if (!noFocus && ret) { var n = document.querySelector('[data-k="' + cssq(ret) + '"]'); if (n) n.focus(); } }
  function menuKey(e) {
    var bs = Array.prototype.slice.call($('pop').querySelectorAll('.menu-i:not([disabled])')), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (bs[(i + 1) % bs.length] || bs[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (bs[(i - 1 + bs.length) % bs.length] || bs[0]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); bs[0].focus(); } else if (e.key === 'End') { e.preventDefault(); bs[bs.length - 1].focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); }
    else if (ui.menu.digits && /^[0-9]$/.test(e.key)) { var n = e.key === '0' ? 9 : +e.key - 1, it = ui.menu.items[n]; if (it && !it.disabled) { e.preventDefault(); closeMenu(); it.fn(); } }
  }
  function dialog(o) {
    closeMenu(true); var ae = document.activeElement, keep = ui.dlg ? ui.dlg.ret : (ae && ae.getAttribute ? ae.getAttribute('data-k') : null);
    ui.dlg = { o: o, ret: keep };
    $('dialog-root').innerHTML = '<div class="scrim" data-act="dlg-close"></div><div class="dlg' + (o.drawer ? ' drawer' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><header class="dlg-h"><h2 id="dlg-t">' + esc(o.title) + '</h2><button class="btn-icon" data-act="dlg-close" aria-label="Close">' + ic('x') + '</button></header><div class="dlg-b">' + o.html + '</div>' +
      (o.foot ? '<footer class="dlg-f">' + o.foot.map(function (f, i) { return '<button class="btn ' + f.cls + '" data-act="dlg" data-i="' + i + '"' + (f.auto ? ' data-auto' : '') + '>' + f.label + '</button>'; }).join('') + '</footer>' : '') + '</div>';
    var root = $('dialog-root').querySelector('.dlg'), f = (o.focus && root.querySelector(o.focus)) || root.querySelector('[data-auto]') || root.querySelector('.dlg-b button, .dlg-b input, .dlg-b textarea, .dlg-b select') || root.querySelector('button');
    if (f) f.focus();
  }
  function closeDialog() { if (!ui.dlg) return; var ret = ui.dlg.ret; ui.dlg = null; ui.cmp = null; $('dialog-root').innerHTML = ''; if (ret) { var n = document.querySelector('[data-k="' + cssq(ret) + '"]'); if (n) n.focus(); } }
  function trap(e) {
    var root = $('dialog-root').querySelector('.dlg'); if (!root) return;
    var fs = Array.prototype.slice.call(root.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]')); if (!fs.length) { e.preventDefault(); return; }
    var first = fs[0], last = fs[fs.length - 1], ae = document.activeElement;
    if (!root.contains(ae)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && ae === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && ae === last) { e.preventDefault(); first.focus(); }
  }
  function helpDialog() {
    var rows = [['j / k', 'Next / previous item; marks it read'], ['p', 'Pin or unpin the open row'], ['x', 'Set the open row aside, with a reason'], ['u', 'Use the open row in a section (then 1-9, 0)'], ['o', 'Open the source in a new tab'], ['b', 'Open or close the brief'], ['z', 'Undo the last pin or set-aside'], ['/', 'Search the window'], ['1 - 5', 'Today, Brief, Watch, Collection, Options'], ['Alt + 1 - 6', 'The same from inside a field; 6 is the design system'], ['Ctrl or Cmd + S', 'Save the brief'], ['?', 'This list'], ['Esc', 'Close a menu or dialog, finish editing, close the brief']];
    dialog({ title: 'Keyboard shortcuts', html: '<dl class="keys">' + rows.map(function (r) { return '<div><dt>' + r[0].split(' / ').map(function (k) { return k.split(' + ').map(kbd).join(' + '); }).join(' / ') + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>', foot: [{ label: 'Close', cls: 'btn-secondary', auto: true }] });
  }
  function desksMenu(anchor) {
    menu(anchor, Q.desks().map(function (d) { var st = deskState(d); return { label: d.name, sub: d.cadence + ', ' + (d.windowH === 24 ? '24 hours' : '7 days') + ' - ' + d.rows + ' rows' + (d.gaps ? ' - ' + plural(d.gaps, 'gap') : ''), mark: d.id === S.desk, right: chip(st[0], st[1]) + (d.gaps ? chip(plural(d.gaps, 'gap'), 'warn-solid', 'alert') : ''), fn: function () { ui.editing = null; ui.briefKey = null; A.setDesk(d.id); if (d.id !== 'hf_au') A.say('Prototype: every desk shows the same invented window.'); } }; }), { label: 'Desks: which are filed today' });
  }
  function setMode(m) {
    if (S.role === 'read' && m !== 'readonly') A.setRole('full');
    A.setMode(m);
    if (m === 'loading') setTimeout(function () { if (S.mode === 'loading') A.setMode('normal'); }, 1600);
    A.say(({ normal: 'Back to normal.', loading: 'Loading for a moment.', empty: 'The window is empty.', error: 'The worker answers an error.', busy: 'The database is busy: try saving the brief.', dropped: 'The next draft will lose its connection.', readonly: 'A read-only key.', nogap: 'Every channel delivered.' })[m] || m);
  }
  function statesMenu(anchor) {
    var modes = [['normal', 'Normal'], ['loading', 'Loading'], ['empty', 'Empty window'], ['error', 'Error, with retry'], ['busy', 'Busy database'], ['dropped', 'Drop the next draft'], ['readonly', 'Read-only key'], ['nogap', 'No collection gap']];
    var items = modes.map(function (m) { return { label: m[1], mark: S.mode === m[0], fn: function () { setMode(m[0]); } }; });
    items.push({ sep: true }, { label: 'Simulate a conflict in the brief', icon: 'alert', fn: simConflict }, { label: 'Simulate the mute offer', icon: 'aside', fn: function () { muteOffer({ kind: 'outlet', value: 'Coast Daily' }); } }, { label: ui.theme === 'dark' ? 'Light appearance' : 'Dark appearance', icon: 'sun', fn: function () { setTheme(ui.theme === 'dark' ? 'light' : 'dark'); } });
    menu(anchor, items, { label: 'Prototype states' });
  }
  function simConflict() { if (ro()) return; if (S.brief.status === 'none') { A.say('Start a brief first.', 'warn'); return; } A.simulateConflict(); jumpTo('summary'); }
  function setTheme(t) { ui.theme = t; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('den_c_theme', t); } catch (e) {} $('reader-scroll').__h = null; render(); }

  function showTip(el) {
    var r = Q.row(el.getAttribute('data-tip')), tip = $('tip'); if (!r) return;
    tip.innerHTML = '<span class="tip-k">' + ic(KIND[r.kind].icon) + esc(KIND[r.kind].one) + ' &middot; ' + esc(el.getAttribute('data-tip')) + '</span><b>' + esc(r.title) + '</b><span class="tip-m">' + esc(where(r)) + ' &middot; ' + esc(Q.when(r.t)) + ' &middot; weight ' + Q.weight(r).score + '</span><span class="tip-m">Click to open it in the reader</span>';
    tip.hidden = false; var b = el.getBoundingClientRect(), tw = tip.offsetWidth || 300, th = tip.offsetHeight || 90;
    tip.style.left = Math.max(8, Math.min(b.left, window.innerWidth - tw - 8)) + 'px'; tip.style.top = (b.top - th - 8 < 8 ? b.bottom + 8 : b.top - th - 8) + 'px';
  }
  function hideTip() { var t = $('tip'); if (t) t.hidden = true; }
  function renderToast() {
    var t = S.toast, el = $('toast');
    if (!t) { if (el.__h) { el.innerHTML = ''; el.__h = ''; } return; }
    if (t.at !== ui.toastAt || el.__t !== t.text) {
      ui.toastAt = t.at; el.__t = t.text; var undo = ui.toastUndo && S.undo.length && canWrite(); ui.toastUndo = false;
      setHTML(el, '<div class="toast toast-' + esc(t.kind) + '"><span>' + esc(t.text) + '</span>' + (undo ? '<button class="btn btn-row" data-act="undo" data-k="t-undo">' + ic('undo') + 'Undo ' + kbd('z') + '</button>' : '') + '<button class="btn-icon btn-icon-sm" data-act="toast-x" aria-label="Dismiss">' + ic('x') + '</button></div>');
      clearTimeout(ui.toastTimer); ui.toastTimer = setTimeout(function () { if (S.toast && S.toast.at === t.at) A.clearToast(); }, 5200);
    }
  }

  /* ---------- render ---------- */
  function layout() {
    var app = $('app'); ui.narrow = (window.innerWidth || 1440) < 1440; ui.rail = ui.route === 'brief' && ui.narrow && !ui.listOpen;
    app.setAttribute('data-route', ui.route); app.setAttribute('data-brief', ui.route === 'brief' ? '1' : '0'); app.setAttribute('data-rail', ui.rail ? '1' : '0'); app.setAttribute('data-density', S.options.density || 'regular');
    $('brief').hidden = ui.route !== 'brief';
  }
  function track() { var rev = S.brief.revision; if (ui.lastRev !== rev) { ui.snap[rev] = texts(); ui.lastRev = rev; } }
  function safe(fn, target) { try { fn(); } catch (e) { if (window.console) console.error(e); var el = $(target); if (el) { el.__h = null; el.innerHTML = '<div class="pad-l">' + notice('neg', 'This part of the page failed to draw.', esc(e && e.message || String(e)), '<button class="btn btn-secondary btn-sm" data-act="reload">Reload the prototype</button>') + '</div>'; } } }
  function render() {
    if (ui.rendering) { ui.dirty = true; return; }
    ui.rendering = true;
    try { track(); ensureSel(); layout(); safe(renderTop, 'top'); safe(renderBanner, 'banner'); safe(renderList, 'list-body'); safe(renderReader, 'reader-scroll'); safe(renderBrief, 'brief-scroll'); safe(renderToast, 'toast'); }
    finally { ui.rendering = false; }
    if (ui.dirty) { ui.dirty = false; render(); }
  }
  function onRoute() {
    var h = (location.hash || '').replace(/^#/, ''), r = ROUTES.some(function (x) { return x.id === h; }) ? h : 'today';
    if (r !== 'brief') ui.editing = null; ui.route = r; closeMenu(true); hideTip();
    try { document.title = 'Anne\'s Den - ' + ROUTES.filter(function (x) { return x.id === r; })[0].label + ' - Concept C'; } catch (e) {}
    render();
    if (ui.pendingJump && r === 'brief') { var pj = ui.pendingJump; ui.pendingJump = null; jumpTo(pj); }
  }

  /* ---------- events ---------- */
  function act(a, el, e) {
    var d = el.dataset || {}, row = selRow();
    switch (a) {
      case 'sel': if (listRoute() === 'system' && d.key.indexOf('sys|') !== 0) break; if (d.key.indexOf('sig|') === 0 && listRoute() !== 'today') go('today', d.key); else select(d.key); break;
      case 'open': hideTip(); openRow(d.id); break;
      case 'goto': go(d.r, d.key); break;
      case 'back': A.say('Back to AXIOM: in the app this returns to the view you came from. The prototype has nowhere to go.'); break;
      case 'desks': desksMenu(el); break; case 'states': statesMenu(el); break; case 'help': helpDialog(); break;
      case 'rail': ui.listOpen = !ui.listOpen; render(); break;
      case 'facet': ui.kind = d.v || ''; render(); break;
      case 'toggle': ui[d.t] = !ui[d.t]; render(); break;
      case 'clear': ui.kind = ''; ui.channel = ''; ui.search = ''; ui.pinnedOnly = false; ui.unreadOnly = false; var s = $('search'); if (s) s.value = ''; render(); break;
      case 'prev': move(-1); break; case 'next': move(1); break;
      case 'pin': if (row) doPin(row.id); break;
      case 'aside': if (row) asideMenu(row.id, el); break;
      case 'use': useMenu(d.id || (row && row.id), el); break;
      case 'src': if (row) A.say('In the app this opens ' + where(row) + ' in a new tab. The prototype\'s outlets are invented.'); break;
      case 'restore': if (!ro()) { A.restore(d.id); A.say('Put back in the window.'); } break;
      case 'undo': A.undo(); break;
      case 'toast-x': A.clearToast(); break;
      case 'retry': A.retry(); break;
      case 'reload': location.reload(); break;
      case 'say': A.say(d.v); break;
      case 'brief-toggle': go(ui.route === 'brief' ? 'today' : 'brief'); break;
      case 'save': save(); break; case 'file': fileFlow(); break; case 'export': exportMenu(el); break; case 'history': ui.cmp = null; historyDrawer(); break;
      case 'compare': ui.cmp = +d.rev; historyDrawer(); break;
      case 'brief-more': menu(el, [{ label: 'Draft the whole brief again', hint: '1 model call', icon: 'spark', fn: draftConfirm }, { label: 'Start again by hand', hint: 'empties every section', icon: 'edit', danger: true, fn: function () { dialog({ title: 'Empty every section?', html: '<p>Writing by hand starts from ten empty sections. The current text stays in History as revision ' + S.brief.revision + '.</p>', foot: [{ label: 'Cancel', cls: 'btn-secondary', auto: true }, { label: 'Empty the sections', cls: 'btn-danger', fn: function () { ui.editing = null; A.byHand(); } }] }); } }], { label: 'More' }); break;
      case 'draft': if (!ro()) draftConfirm(); break;
      case 'byhand': if (!ro()) { A.byHand(); startEdit('summary'); } break;
      case 'checkdraft': A.checkDraft(); break;
      case 'edit': if (e && e.target && e.target.closest && e.target.closest('.cite')) break; startEdit(d.sid); break;
      case 'done': if (S.brief.save === 'unsaved') A.save(); doneEdit(); break;
      case 'regen': if (!ro()) regenDialog(d.sid); break;
      case 'keep-mine': A.resolve('mine'); A.say('Kept yours. Save to write it over theirs.'); break;
      case 'take-theirs': if (ui.editing === 'summary') ui.editing = null; A.resolve('theirs'); A.say('Took theirs.'); break;
      case 'reopen': if (!ro()) { A.reopen(); A.say('Reopened. It is a draft again.'); } break;
      case 'jump': jumpTo(d.sid); break;
      case 'preview': ui.preview[d.id] = true; $('reader-scroll').__h = null; render(); break;
      case 'approve': if (!ro()) { var iss = ui.issue[d.id] || ''; A.decide(d.id, 'approve', { issue: iss }); A.say('Approved' + (iss ? ' under ' + issueLabel(iss) : ': searched for, tags nothing') + '.'); } break;
      case 'dismiss': if (!ro()) dismissDialog(d.id); break;
      case 'reg-toggle': A.toggleRegister(d.id); break;
      case 'collect': A.collect(d.id); break;
      case 'ch-toggle': A.toggleChannel(d.id); break;
      case 'stop-page': if (!ro()) A.say('Prototype: the watched pages are fixed data, so nothing was removed.'); break;
      case 'unmute': A.unmute(d.v); break;
      case 'opt-toggle': A.setOption(d.o, !S.options[d.o]); break;
      case 'density': A.setOption('density', d.v); break;
      case 'theme': setTheme(d.v); break;
      case 'sim': setMode(d.v); break; case 'sim-conflict': simConflict(); break; case 'sim-mute': muteOffer({ kind: 'outlet', value: 'Coast Daily' }); break; case 'sim-file': fileFlow(); break;
      case 'menu-close': closeMenu(); break;
      case 'mi': var it = ui.menu && ui.menu.items[+d.i]; closeMenu(); if (it && it.fn) it.fn(); break;
      case 'dlg-close': closeDialog(); break;
      case 'dlg': var f = ui.dlg && ui.dlg.o.foot[+d.i], root = $('dialog-root').querySelector('.dlg'), keep = f && f.fn ? f.fn(root) : null; if (keep !== false && ui.dlg && ui.dlg.o.foot && ui.dlg.o.foot[+d.i] === f) closeDialog(); break;
    }
  }
  function dismissDialog(id) {
    var p = S.proposals.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    dialog({ title: 'Dismiss "' + (p.name || p.value) + '"', html: '<p>A dismissed proposal is never proposed again, and the decision stands for the words inside it. Say why, for whoever reads the register next.</p><label class="field" id="dm-f"><span class="field-l">Reason (required)</span><textarea id="dm-in" rows="3" aria-describedby="dm-e" placeholder="for example: generic, does not name the harbour"></textarea><span class="field-e" id="dm-e" role="alert"></span></label>',
      foot: [{ label: 'Cancel', cls: 'btn-quiet' }, { label: 'Dismiss', cls: 'btn-danger', fn: function (root) { var i = root.querySelector('#dm-in'), v = (i.value || '').trim(); if (v.length < 3) { root.querySelector('#dm-e').textContent = 'A dismissal needs a reason.'; root.querySelector('#dm-f').classList.add('field-err'); i.setAttribute('aria-invalid', 'true'); i.focus(); return false; } A.decide(id, 'dismiss', { reason: v }); A.say('Dismissed. It will not be proposed again.'); } }], focus: '#dm-in' });
  }

  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!el || el.disabled) return;
    if (el.tagName === 'A') return;
    try { act(el.getAttribute('data-act'), el, e); } catch (err) { if (window.console) console.error(err); A.say('That did not work: ' + (err && err.message || err), 'warn'); }
  });
  document.addEventListener('submit', function (e) {
    e.preventDefault(); var f = e.target; if (!f || f.getAttribute('data-form') !== 'add') return; if (ro()) return;
    var v = ui.add.value.trim(); if (!v) { A.say('Give the entry a value first.', 'warn'); return; }
    A.say('Prototype: the register is fixed data. "' + v + '" would be added as an active ' + ui.add.kind + (ui.add.issue ? ' under ' + issueLabel(ui.add.issue) : '') + '.'); ui.add.value = ''; $('reader-scroll').__h = null; render();
  });
  document.addEventListener('input', function (e) {
    var t = e.target; if (!t) return;
    if (t.id === 'search') { ui.search = t.value; safe(renderList, 'list-body'); safe(renderReaderBar, 'reader-bar'); return; }
    if (t.classList && t.classList.contains('sec-ta')) { var sid = t.getAttribute('data-sid'); ui.lastEdit = { sid: sid, pos: t.selectionStart }; autosize(t); A.edit(sid, t.value); return; }
    var k = t.getAttribute && t.getAttribute('data-in');
    if (k === 'add-value') ui.add.value = t.value;
  });
  document.addEventListener('change', function (e) {
    var t = e.target, c = t && t.getAttribute && t.getAttribute('data-ch');
    if (t && t.getAttribute && t.getAttribute('data-in') === 'minInteractions') { A.setOption('minInteractions', Math.max(0, parseInt(t.value, 10) || 0)); return; }
    if (!c) return;
    if (c === 'channel') { ui.channel = t.value; render(); } else if (c === 'sort') { ui.sort = t.value; render(); }
    else if (c === 'rating') A.setRating('momentum', t.getAttribute('data-key'), t.value);
    else if (c === 'issue') ui.issue[t.getAttribute('data-id')] = t.value;
    else if (c === 'add-kind') ui.add.kind = t.value; else if (c === 'add-issue') ui.add.issue = t.value;
  });
  function caret(e) { var t = e.target; if (t && t.classList && t.classList.contains('sec-ta')) ui.lastEdit = { sid: t.getAttribute('data-sid'), pos: t.selectionStart }; }
  document.addEventListener('keyup', caret); document.addEventListener('mouseup', caret); document.addEventListener('focusout', caret);
  document.addEventListener('mouseover', function (e) { var c = e.target && e.target.closest ? e.target.closest('[data-tip]') : null; if (c) showTip(c); });
  document.addEventListener('mouseout', function (e) { var c = e.target && e.target.closest ? e.target.closest('[data-tip]') : null; if (c) hideTip(); });
  document.addEventListener('focusin', function (e) { var c = e.target && e.target.closest ? e.target.closest('[data-tip]') : null; if (c) showTip(c); else hideTip(); });

  document.addEventListener('keydown', function (e) {
    var t = e.target, tag = t && t.tagName, typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(checkbox|radio|button|submit)$/.test(t.type)) || (t && t.isContentEditable);
    var key = e.key || '';
    if ((e.metaKey || e.ctrlKey) && key.toLowerCase() === 's') { e.preventDefault(); save(); return; }
    if (key === 'Escape') {
      if (ui.menu) { closeMenu(); return; } if (ui.dlg) { closeDialog(); return; }
      if (ui.editing) { doneEdit(); return; } if (typing) { t.blur(); return; }
      if (ui.route === 'brief') go('today'); return;
    }
    if (ui.dlg) { if (key === 'Tab') trap(e); return; }
    if (ui.menu) { menuKey(e); return; }
    if (e.altKey && /^Digit[1-6]$/.test(e.code || '')) { e.preventDefault(); go(ROUTES[+e.code.slice(5) - 1].id); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    var row = (ui.route === 'today' || ui.route === 'brief') ? selRow() : null, anchor = function (k) { return document.querySelector('[data-k="' + k + '"]') || $('reader-bar'); };
    switch (key) {
      case 'j': e.preventDefault(); move(1); break; case 'k': e.preventDefault(); move(-1); break;
      case 'p': if (row) doPin(row.id); break;
      case 'x': if (row) asideMenu(row.id, anchor('rb-aside')); break;
      case 'u': if (row) useMenu(row.id, anchor('rb-use')); break;
      case 'o': if (row && row.kind !== 'narrative' && row.kind !== 'upcoming') A.say('In the app this opens ' + where(row) + ' in a new tab. The prototype\'s outlets are invented.'); break;
      case 'b': if (ui.route === 'today' || ui.route === 'brief') go(ui.route === 'brief' ? 'today' : 'brief'); break;
      case 'z': if (canWrite() && S.undo.length) A.undo(); break;
      case '/': var s = $('search'); if (s) { e.preventDefault(); s.focus(); s.select(); } else if (ui.rail) { e.preventDefault(); ui.listOpen = true; render(); var s2 = $('search'); if (s2) s2.focus(); } break;
      case '?': e.preventDefault(); helpDialog(); break;
      case '1': case '2': case '3': case '4': case '5': go(ROUTES[+key - 1].id); break;
    }
  });

  window.addEventListener('hashchange', onRoute);
  window.addEventListener('resize', function () { var was = ui.narrow; if (((window.innerWidth || 1440) < 1440) !== was) render(); });
  setInterval(function () { var d = S.brief.drafting, el = $('draft-el'); if (d && !d.dropped && el) el.textContent = Math.max(0, Math.round((Date.now() - d.t0) / 1000)) + ' s'; }, 500);

  try { var th = localStorage.getItem('den_c_theme'); if (th === 'light' || th === 'dark') { ui.theme = th; document.documentElement.setAttribute('data-theme', th); } } catch (e) {}
  D.on(render);
  window.DENC = { ui: ui, render: render, go: go, act: act };
  onRoute();
})();
