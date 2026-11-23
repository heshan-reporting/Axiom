/* Anne's Den - concept D, The Clock. Renders window.DEN (shared.js); every mutation goes through DEN.a.
 * No framework, no network. Regions are re-rendered as strings and patched only when their HTML changed;
 * a field being typed in is carried across the patch, so the caret never moves. */
(function () {
  'use strict';
  var D = window.DEN, S = D.state, Q = D.q, A = D.a;
  var $ = function (id) { return document.getElementById(id); };
  var TZ = 'Australia/Sydney', HOUR = 3600e3;
  var ROUTES = ['today', 'brief', 'watch', 'collection', 'options', 'system'];
  var ROUTE_LABEL = { today: 'Today', brief: 'Brief', watch: 'Watch', collection: 'Collection', options: 'Options', system: 'System' };
  var CH = ['News', 'X', 'Bluesky', 'Reddit', 'YouTube', 'Mastodon', 'Facebook'];
  var STAGES = ['Gathering the window\'s evidence', 'Writing ten sections', 'Checking every citation against its row'];
  var ui = { route: 'today', sel: null, hover: null, cur: 'summary', editing: null, brush: null, yst: false, facet: 'all', pinned: false, showAside: false, search: '',
    dockOpen: false, dialog: null, menu: null, vis: [], drag: null, w: { mode: {}, issue: {}, reason: {} }, after: [], returnKey: null, snaps: {} };
  var geom = null, toastTimer = null, toastAt = 0, draftTimer = null;

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f1(n) { return (Math.round(n * 10) / 10).toString(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function parts(ts) { var o = {}; new Intl.DateTimeFormat('en-AU', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(ts)).forEach(function (p) { o[p.type] = p.value; }); return o; }
  function hm(ts) { var p = parts(ts); return p.hour + ':' + p.minute; }
  function dayLabel(ts) { var p = parts(ts); return p.weekday + ' ' + p.day + ' ' + p.month; }
  function tsOf(t) { return S.now - t * HOUR; }
  function chOf(r) { return r.kind === 'media' ? 'News' : r.kind === 'narrative' ? 'Narrative' : r.kind === 'upcoming' ? 'Upcoming' : r.channel; }
  function cc(ch) { return 'c-' + String(ch).toLowerCase(); }
  function cv(ch) { var l = String(ch).toLowerCase(); return 'var(--ch-' + ({ narrative: 'narr', upcoming: 'up' }[l] || l) + ')'; }
  function canWrite() { return S.role !== 'read'; }
  function filed() { return S.brief.status === 'filed'; }
  function secTitle(id) { var s = Q.sections().filter(function (x) { return x.id === id; })[0]; return s ? s.title : id; }
  function shortTitle(id) { return ({ summary: 'Summary', narratives: 'Narratives', media: 'Media', social: 'Social', actors: 'Actors', sentiment: 'Sentiment', momentum: 'Momentum', risks: 'Risks', bottom: 'Bottom line', posture: 'Posture', source: 'Sources' })[id] || secTitle(id); }
  function issueLabel(id) { var i = Q.issues().filter(function (x) { return x.id === id; })[0]; return i ? i.label : ''; }
  var ICON = { back: 'M15 18l-6-6 6-6', pin: 'M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6z', aside: 'M4 4h16v5H4zM6 9v11h12V9M10 13h4', cite: 'M7 7h4v4c0 3-1 5-4 6M14 7h4v4c0 3-1 5-4 6',
    open: 'M7 17L17 7M9 7h8v8', check: 'M5 12l5 5 9-10', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17v.5', undo: 'M9 8L5 12l4 4M5 12h9a5 5 0 010 10h-2', x: 'M6 6l12 12M18 6L6 18',
    down: 'M6 9l6 6 6-6', download: 'M12 4v11M7 11l5 5 5-5M5 20h14', copy: 'M9 9h10v11H9zM5 15V4h10', history: 'M4 12a8 8 0 108-8 8 8 0 00-6 3M4 4v4h4M12 8v4l3 2', refresh: 'M20 12a8 8 0 11-3-6M20 4v5h-5',
    play: 'M8 5l11 7-11 7z', search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM16 16l4 4', lock: 'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3', regen: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4', info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.5', clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2', help: 'M9.5 9a2.5 2.5 0 114 2c-1 .7-1.5 1.2-1.5 2.5M12 17v.5', panel: 'M4 5h16v14H4zM14 5v14' };
  function ico(n) { return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICON[n] || '') + '"/></svg>'; }
  function btn(kind, label, act, o) { o = o || {}; return '<button type="button" class="btn ' + kind + (o.busy ? ' busy' : '') + (o.cls ? ' ' + o.cls : '') + '" data-act="' + act + '"' + (o.id != null ? ' data-id="' + esc(o.id) + '"' : '') + (o.arg != null ? ' data-arg="' + esc(o.arg) + '"' : '') +
    (o.disabled ? ' disabled' : '') + (o.pressed != null ? ' aria-pressed="' + (o.pressed ? 'true' : 'false') + '"' : '') + (o.expanded != null ? ' aria-expanded="' + (o.expanded ? 'true' : 'false') + '"' : '') + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : '') + (o.title ? ' title="' + esc(o.title) + '"' : '') + (o.auto ? ' data-autofocus' : '') + '>' +
    (o.icon ? ico(o.icon) : '') + (label ? '<span>' + esc(label) + '</span>' : '') + (o.cost ? '<span class="cost">' + esc(o.cost) + '</span>' : '') + '</button>'; }
  function chip(kind, label, icon, title) { return '<span class="chip ' + kind + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + (icon ? ico(icon) : '') + esc(label) + '</span>'; }
  function briefChip(st) { return st === 'filed' ? chip('pos', 'Filed', 'check') : st === 'draft' ? chip('warn', 'Draft') : chip('', 'No brief'); }
  function notice(kind, title, body, acts) { return '<div class="notice ' + kind + '" role="' + (kind === 'neg' ? 'alert' : 'status') + '">' + ico(kind === 'pos' ? 'check' : kind === 'info' || kind === '' ? 'info' : 'alert') + '<div class="body"><b>' + esc(title) + '</b>' + (body || '') + (acts ? '<div class="acts">' + acts + '</div>' : '') + '</div></div>'; }
  function emptyState(title, text, why, action, err) { return '<div class="empty' + (err ? ' err' : '') + '"' + (err ? ' role="alert"' : '') + '><div class="glyph-big">' + ico(err ? 'alert' : 'clock') + '</div><h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>' +
    (why && why.length ? '<ul class="why">' + why.map(function (w) { return '<li>' + ico('info') + '<span>' + esc(w) + '</span></li>'; }).join('') + '</ul>' : '') + (action || '') + '</div>'; }
  function glyph(sig, cx, cy, cls) { var c = 'class="shape' + (cls ? ' ' + cls : '') + '"';
    if (sig === 'spike') return '<path ' + c + ' d="M' + f1(cx) + ',' + f1(cy - 6) + 'L' + f1(cx + 5.5) + ',' + f1(cy + 4) + 'H' + f1(cx - 5.5) + 'Z"/>';
    if (sig === 'emerging') return '<path ' + c + ' d="M' + f1(cx) + ',' + f1(cy - 6) + 'L' + f1(cx + 6) + ',' + f1(cy) + 'L' + f1(cx) + ',' + f1(cy + 6) + 'L' + f1(cx - 6) + ',' + f1(cy) + 'Z"/>';
    if (sig === 'first_seen') return '<circle class="shape open" cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="4.2"/>';
    if (sig === 'outlier') return '<rect ' + c + ' x="' + f1(cx - 4.5) + '" y="' + f1(cy - 4.5) + '" width="9" height="9"/>';
    return '<path ' + c + ' d="M' + f1(cx - 1.8) + ',' + f1(cy - 6) + 'h3.6v4.2h4.2v3.6h-4.2v4.2h-3.6v-4.2h-4.2v-3.6h4.2z"/>'; }
  function glyphIcon(sig) { return '<svg class="glyph" viewBox="-8 -8 16 16" aria-hidden="true">' + glyph(sig, 0, 0).replace('class="shape open"', 'class="shape open" style="fill:none;stroke:var(--mark);stroke-width:2"') + '</svg>'; }

  /* ---------- patching ---------- */
  var last = new WeakMap();
  function fkey(el) { if (!el || !el.getAttribute) return null; return el.getAttribute('data-fk') || (el.getAttribute('data-act') ? el.getAttribute('data-act') + '|' + (el.getAttribute('data-id') || '') + '|' + (el.getAttribute('data-arg') || '') : null); }
  function findKey(root, key) { if (!key) return null; var all = root.querySelectorAll('[data-fk],[data-act]'); for (var i = 0; i < all.length; i++) if (fkey(all[i]) === key) return all[i]; return null; }
  function patch(el, html) {
    if (!el || last.get(el) === html) return false; last.set(el, html);
    var act = document.activeElement, inside = act && act !== el && el.contains(act), keep = null, key = null, s0, s1, sc = {};
    if (inside) { if (act.hasAttribute('data-keep')) { keep = act; try { s0 = act.selectionStart; s1 = act.selectionEnd; } catch (e) {} } else key = fkey(act); }
    Array.prototype.forEach.call(el.querySelectorAll('[data-scroll]'), function (n) { sc[n.getAttribute('data-scroll')] = n.scrollTop; });
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    if (keep) { var ph = tmp.querySelector('[data-keep="' + keep.getAttribute('data-keep') + '"]'); if (ph) ph.parentNode.replaceChild(keep, ph); else keep = null; }
    while (el.firstChild) el.removeChild(el.firstChild);
    while (tmp.firstChild) el.appendChild(tmp.firstChild);
    Array.prototype.forEach.call(el.querySelectorAll('[data-scroll]'), function (n) { var v = sc[n.getAttribute('data-scroll')]; if (v) n.scrollTop = v; });
    if (keep) { try { keep.focus({ preventScroll: true }); if (s0 != null) keep.setSelectionRange(s0, s1); } catch (e) {} }
    else if (key) { var n = findKey(el, key); if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} } }
    return true;
  }
  function safe(name, el, fn) { var html; try { html = fn(); } catch (e) { if (window.console) console.error(name, e); html = '<div class="empty err" role="alert"><div class="glyph-big">' + ico('alert') + '</div><h3>This part could not be drawn</h3><p>' + esc(name) + ': ' + esc(e && e.message) + '</p>' + btn('secondary', 'Try again', 'rerender') + '</div>'; } patch(el, html); }

  /* ---------- routing ---------- */
  function route() { var h = (location.hash || '').replace('#', ''); return ROUTES.indexOf(h) >= 0 ? h : 'today'; }
  function go(r) { if (route() === r) return; location.hash = r; }
  function onStream() { return ui.route === 'today' || ui.route === 'brief'; }

  /* ---------- top bar ---------- */
  function renderTop() {
    var d = Q.desk(), ro = !canWrite(), waiting = S.proposals.filter(function (p) { return p.status === 'proposed'; }).length;
    var gaps = S.mode === 'nogap' ? 0 : S.channels.filter(function (c) { return c.state === 'gap'; }).length;
    var short = d.cadence + ' · ' + (d.windowH === 24 ? '24 h' : '7 d') + ' · Aus. Eastern time';
    var h = '<button type="button" class="btn quiet" data-act="backapp" aria-label="Back to AXIOM" title="Back to AXIOM">' + ico('back') + '<span class="hide-md">AXIOM</span></button>' +
      '<div class="top-brand">Anne’s Den</div><span class="top-sep" aria-hidden="true"></span>' +
      '<button type="button" class="deskbtn" data-act="deskmenu" aria-haspopup="true" aria-expanded="' + (ui.menu === 'desk' ? 'true' : 'false') + '" aria-label="Desk: ' + esc(d.name) + '. ' + esc(Q.windowLabel()) + '. Change desk" title="' + esc(Q.windowLabel()) + '"><div><div class="deskbtn-name">' + esc(d.name) + '</div><div class="deskbtn-sub">' + esc(short) + '</div></div><span class="hide-md">' + briefChip(S.brief.status) + '</span>' + ico('down') + '</button>';
    h += '<div class="nav" role="tablist" aria-label="Views">' + ROUTES.map(function (r, i) {
      var badge = r === 'watch' && waiting ? '<span class="badge" title="' + waiting + ' proposals waiting">' + waiting + '</span>' : r === 'collection' && gaps ? '<span class="chip solid-neg" title="' + gaps + ' collection gap">' + gaps + ' gap</span>' : '';
      return '<button type="button" role="tab" class="nav-tab" data-act="go" data-arg="' + r + '" aria-selected="' + (ui.route === r ? 'true' : 'false') + '" title="Alt+' + (i + 1) + '">' + ROUTE_LABEL[r] + badge + '<kbd aria-hidden="true">⌥' + (i + 1) + '</kbd></button>'; }).join('') + '</div>';
    h += '<div class="top-right">' + (ro ? chip('info', 'Read-only', 'lock', 'Read-only key: everything is readable; nothing can be changed') : '') +
      '<div class="meter" title="Model calls spent by this desk today"><span>model calls today: <b class="num">' + S.calls.used + '</b> of ' + S.calls.cap + '</span><div class="meter-bar" aria-hidden="true"><i style="width:' + Math.round(S.calls.used / S.calls.cap * 100) + '%"></i></div></div>' +
      btn('row', '', 'help', { icon: 'help', aria: 'Keyboard shortcuts', title: 'Keyboard shortcuts (?)' }) + '</div>';
    if (ui.menu === 'desk') h += '<div class="menu desk" role="menu" aria-label="Desks">' + Q.desks().map(function (x) { var cur = x.id === S.desk;
      return '<button type="button" role="menuitem" class="menu-item" data-act="setdesk" data-id="' + x.id + '"' + (cur ? ' aria-current="true"' : '') + '><span class="grow"><b>' + esc(x.name) + '</b><small>' + esc(x.region + ' · ' + x.cadence + ' · ' + x.rows + ' rows') + '</small></span>' +
        (x.gaps ? chip('solid-neg', x.gaps + (x.gaps > 1 ? ' gaps' : ' gap')) : '') + briefChip(cur ? S.brief.status : x.brief) + '</button>'; }).join('') + '<div class="menu-note">Synthetic data: every desk shows the same invented window.</div></div>';
    return h;
  }
  function renderBanner() {
    if (S.mode === 'busy') return '<div class="banner" role="alert">' + ico('alert') + '<b>The database is busy.</b><span>What is on screen loaded before it. A save is kept on this computer and tried again.</span>' + btn('secondary', 'Try again', 'retry', { icon: 'refresh' }) + '</div>';
    return '';
  }

  /* ---------- the timeline ---------- */
  function hourly() { var h = Q.hourly(); if (S.mode === 'empty') h.forEach(function (b) { CH.forEach(function (c) { b[c] = 0; }); }); return h; }
  function total(b) { return CH.reduce(function (n, c) { return n + (b[c] || 0); }, 0); }
  function gapSignal() { return Q.signals().filter(function (s) { return s.sig === 'gap'; })[0] || null; }
  function topRound(x, y, w, h, r) { r = Math.min(r, h, w / 2); return 'M' + f1(x) + ',' + f1(y + h) + 'V' + f1(y + r) + 'Q' + f1(x) + ',' + f1(y) + ' ' + f1(x + r) + ',' + f1(y) + 'H' + f1(x + w - r) + 'Q' + f1(x + w) + ',' + f1(y) + ' ' + f1(x + w) + ',' + f1(y + r) + 'V' + f1(y + h) + 'Z'; }
  function chartSVG(W, Hh, o) {
    o = o || {}; var idp = o.idp || 'd', hours = hourly(), yst = Q.yesterdayHourly(), gap = gapSignal(), sigs = Q.signals().filter(function (s) { return s.at != null; });
    var pl = 30, pr = 8, pt = 30, pb = 18 + (gap ? 16 : 0), pw = W - pl - pr, y0 = pt, y1 = Hh - pb, ph = y1 - y0;
    var max = Math.max.apply(null, hours.map(total).concat(ui.yst ? yst.map(function (y) { return y.total; }) : [0]).concat([1]));
    var top = max <= 4 ? 4 : Math.ceil(max / 2) * 2;
    var x = function (t) { return pl + (24 - t) / 24 * pw; }, y = function (v) { return y1 - v / top * ph; };
    var g = { W: W, pl: pl, pw: pw, y0: y0, y1: y1, x: x };
    var s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" height="' + Hh + '" role="group" aria-labelledby="' + idp + '-t" aria-describedby="' + idp + '-desc"><title id="' + idp + '-t">Rows per hour by channel, the last 24 hours, Australian Eastern time</title>' +
      '<defs><pattern id="' + idp + '-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="2" height="6" style="fill:var(--ch-facebook)"/></pattern></defs>';
    /* grid and axis */
    [top / 2, top].forEach(function (v) { s += '<line class="g-h" x1="' + pl + '" x2="' + f1(pl + pw) + '" y1="' + f1(y(v)) + '" y2="' + f1(y(v)) + '"/><text x="' + (pl - 6) + '" y="' + f1(y(v) + 3) + '" text-anchor="end">' + v + '</text>'; });
    s += '<text x="' + (pl - 6) + '" y="' + f1(y1 + 3) + '" text-anchor="end">0</text>';
    var p = parts(S.now), min = +p.minute, hr = +p.hour;
    for (var k = 0; k <= 24; k++) { var t = min / 60 + k; if (t > 24) break; var clock = ((hr - k) % 24 + 24) % 24; if (clock % 3) continue; var xx = x(t), mid = clock === 0;
      s += '<g' + (mid ? ' class="mid"' : '') + '><line class="g-v" x1="' + f1(xx) + '" x2="' + f1(xx) + '" y1="' + y0 + '" y2="' + f1(y1) + '"/>';
      if (xx > pl + 16 && xx < pl + pw - 74) s += '<text x="' + f1(xx) + '" y="' + f1(y1 + 12) + '" text-anchor="middle">' + (clock < 10 ? '0' : '') + clock + ':00' + (mid ? ' ' + esc(dayLabel(tsOf(t) + 60e3)) : '') + '</text>';
      s += '</g>'; }
    /* bars */
    s += '<g class="bars" aria-hidden="true">'; var slotW = pw / 24, bw = Math.min(20, slotW - 6);
    hours.forEach(function (b) { var sx = x(b.h + 1), bx = sx + (slotW - bw) / 2, yb = y1, tot = total(b), n = 0, dim = ui.brush && !(b.h < ui.brush.from && b.h + 1 > ui.brush.to), drawn = 0;
      s += '<g' + (dim ? ' class="dim"' : '') + '>';
      CH.forEach(function (c) { var v = b[c] || 0; if (!v) return; n += v; var hgt = v / top * ph, last2 = n === tot, yy = yb - hgt, hh = Math.max(1.5, hgt - (drawn ? 2 : 0)); drawn++;
        s += last2 ? '<path d="' + topRound(bx, yy, bw, hh, 3) + '" style="fill:' + cv(c) + '"/>' : '<rect x="' + f1(bx) + '" y="' + f1(yy) + '" width="' + f1(bw) + '" height="' + f1(hh) + '" style="fill:' + cv(c) + '"/>'; yb = yy; });
      s += '</g>'; });
    s += '</g><line class="axis" x1="' + pl + '" x2="' + f1(pl + pw) + '" y1="' + f1(y1) + '" y2="' + f1(y1) + '"/>';
    if (!hours.some(total)) s += '<text x="' + f1(pl + pw / 2) + '" y="' + f1(y0 + ph / 2) + '" text-anchor="middle" style="fill:var(--ink-2);font-size:11.5px;font-family:var(--f-ui)">No rows were collected in this window' + (gap ? ' - and Facebook was not read at all' : '') + '</text>';
    if (ui.yst) s += '<polyline class="yst" points="' + yst.map(function (b) { return f1(x(b.h + .5)) + ',' + f1(y(b.total)); }).join(' ') + '"/>';
    /* hover slots */
    if (o.interactive) hours.forEach(function (b) { s += '<rect class="slot" data-tip="slot" data-h="' + b.h + '" x="' + f1(x(b.h + 1)) + '" y="' + y0 + '" width="' + f1(slotW) + '" height="' + f1(ph) + '"/>'; });
    /* the collection gap: a hatched lane, never zero bars */
    if (gap) { var gx0 = x(gap.span[1]), gx1 = x(gap.span[0]), gy = y1 + 18;
      s += '<g class="gap-lane mark" data-act="check" data-id="' + esc(gap.key) + '" data-fk="gaplane" data-tip="sig" tabindex="0" role="button" aria-label="Collection gap: ' + esc(gap.title) + '. Open Collection"><rect class="h" x="' + f1(gx0) + '" y="' + gy + '" width="' + f1(gx1 - gx0) + '" height="12" rx="2" style="fill:url(#' + idp + '-hatch)"/>' +
        '<rect class="plate" x="' + f1(gx0 + 8) + '" y="' + (gy - 1) + '" width="138" height="14"/><text x="' + f1(gx0 + 14) + '" y="' + (gy + 10) + '">Facebook: not collected</text></g>'; }
    /* now */
    s += '<g class="now"><line x1="' + f1(x(0)) + '" x2="' + f1(x(0)) + '" y1="4" y2="' + f1(y1 + 4) + '"/><text x="' + f1(x(0)) + '" y="' + f1(y1 + 12) + '" text-anchor="end" dx="-4">' + hm(S.now) + ' now</text></g>';
    /* brush and the row cursor */
    var bq = ui.brush; s += '<rect class="brush" id="' + idp + '-brush" y="' + y0 + '" height="' + f1(ph) + '" x="' + f1(bq ? x(bq.from) : 0) + '" width="' + f1(bq ? x(bq.to) - x(bq.from) : 0) + '"' + (bq ? '' : ' visibility="hidden"') + '/>';
    s += '<g class="cur" id="' + idp + '-cur" visibility="hidden" aria-hidden="true"><line x1="0" x2="0" y1="' + y0 + '" y2="' + f1(y1) + '"/><circle cx="0" cy="' + y0 + '" r="4"/></g>';
    /* marks for the checks that carry a time; near neighbours are spread, each with a stem to its true hour */
    var ms = sigs.map(function (m) { return { m: m, x: x(m.at), p: x(m.at) }; }).sort(function (a, b) { return a.x - b.x; });
    ms.forEach(function (m, i) { if (i && m.p < ms[i - 1].p + 16) m.p = ms[i - 1].p + 16; });
    for (var i = ms.length - 1; i >= 0; i--) { var lim = pl + pw - 8 - 16 * (ms.length - 1 - i); if (ms[i].p > lim) ms[i].p = lim; }
    ms.forEach(function (m) { var sg = m.m, hot = ui.sel && sg.item === ui.sel;
      s += '<g class="mark' + (hot ? ' hot' : '') + '" data-act="check" data-id="' + esc(sg.key) + '" data-item="' + esc(sg.item || '') + '" data-fk="mark|' + esc(sg.key) + '" data-tip="sig" tabindex="0" role="button" aria-label="' + esc(sg.label + ': ' + sg.title + ', ' + Q.when(sg.at)) + '">' +
        '<path class="stem" fill="none" d="M' + f1(m.p) + ',20L' + f1(m.x) + ',' + y0 + '"/><circle class="hit" cx="' + f1(m.p) + '" cy="12" r="11"/>' + glyph(sg.sig, m.p, 12) + '</g>'; });
    s += '</svg>';
    return { svg: s, geom: g };
  }
  function chartTable() { var hours = hourly(), gap = gapSignal(), rows = hours.filter(total);
    return '<div class="sr" id="d-desc"><p>' + (rows.length ? 'The busiest hour held ' + Math.max.apply(null, hours.map(total)) + ' rows. ' : 'No rows in the window. ') + (gap ? 'Facebook was not collected for the whole window: its absence is a gap, not a quiet day. ' : '') + 'Marks: ' + Q.signals().filter(function (s) { return s.at != null; }).map(function (s) { return s.label + ' at ' + hm(tsOf(s.at)); }).join(', ') + '.</p>' +
      '<table><caption>Rows per hour by channel, Australian Eastern time</caption><thead><tr><th>Hour starting</th>' + CH.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '<th>Total</th></tr></thead><tbody>' +
      rows.map(function (b) { return '<tr><th>' + hm(tsOf(b.h + 1)) + '</th>' + CH.map(function (c) { return '<td>' + (c === 'Facebook' && gap ? 'not collected' : b[c]) + '</td>'; }).join('') + '<td>' + total(b) + '</td></tr>'; }).join('') + '</tbody></table></div>'; }
  function brushLabel() { var b = ui.brush; if (!b) return ''; var a = tsOf(b.from), z = tsOf(b.to); return dayLabel(a).split(' ')[0] + ' ' + hm(a) + ' – ' + dayLabel(z).split(' ')[0] + ' ' + hm(z) + ' · ' + (b.from - b.to) + ' h'; }
  function chartWidth() { var el = $('tl'); var w = (el && el.clientWidth) || window.innerWidth || 1366; return Math.max(420, Math.floor(w - 32 - 250 - 16)); }
  function renderChecks() { var sig = Q.signals(), gap = sig.some(function (s) { return s.sig === 'gap'; });
    var h = '<div class="checks" role="group" aria-label="Nothing critical missed: six checks, no model"><span class="checks-h">' + Q.checks().length + ' checks · no model</span>';
    h += sig.map(function (s) { var isGap = s.sig === 'gap', sel = ui.sel && s.item === ui.sel;
      return '<button type="button" class="check' + (isGap ? ' gap' : '') + (sel ? ' sel' : '') + '" data-act="check" data-id="' + esc(s.key) + '" data-tip="sig" aria-label="' + esc(s.label + ': ' + s.title + '. ' + (s.covered ? 'Covered in the brief' : 'Not yet in the brief')) + '">' +
        (isGap ? '<span class="sw hatch" aria-hidden="true"></span>' : glyphIcon(s.sig)) + '<b>' + esc(s.label) + '</b><span class="t">' + esc(s.title.replace(/^Sentinel spike: |^New narrative: /, '')) + '</span>' +
        (S.brief.status === 'none' ? '' : s.covered ? '<span class="cov yes">' + ico('check') + 'in brief</span>' : '<span class="cov no">not in brief</span>') + '</button>'; }).join('');
    if (!gap) h += chip('pos', 'Collection: every channel this desk relies on delivered', 'check');
    return h + '</div>';
  }
  function renderTL() {
    if (!onStream()) return '';
    var compact = ui.route === 'brief', d = Q.desk();
    if (S.mode === 'loading') { var sk = ''; for (var i = 0; i < 24; i++) sk += '<div class="skel" style="height:' + (18 + (i * 37 % 70)) + '%"></div>'; return '<div class="tl-head"><span class="tl-title">Reading the window…</span></div><div class="skel-tl" aria-hidden="true" style="height:' + (compact ? 86 : 118) + 'px">' + sk + '</div><div class="checks"><span class="skel" style="width:60%;height:22px"></span></div><p class="sr" role="status">Loading the window.</p>'; }
    if (S.mode === 'error') return '<div class="tl-head"><span class="tl-title">The window could not be read</span><span class="tl-range">No timeline is drawn from a failed read: an empty chart would look like a quiet day.</span><div class="tl-ctl">' + btn('secondary', 'Try again', 'retry', { icon: 'refresh' }) + '</div></div>';
    var W = chartWidth(), c = chartSVG(W, compact ? 104 : 132, { interactive: true }); geom = c.geom;
    var hours = hourly(), used = CH.filter(function (ch) { return hours.some(function (b) { return b[ch]; }); }), gap = gapSignal(), up = Q.rows({ kind: 'upcoming' }).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var h = '<div class="tl-head"><span class="tl-title">' + (d.windowH === 24 ? 'The last 24 hours' : 'The last 7 days (shown: the newest 24 hours)') + '</span><span class="tl-range" title="' + esc(Q.windowLabel()) + '">' + esc(dayLabel(tsOf(24)) + ' ' + hm(tsOf(24)) + ' → ' + dayLabel(S.now) + ' ' + hm(S.now)) + ' AEDT</span>' +
      '<div class="legend" aria-label="Legend">' + used.map(function (ch) { return '<span class="lg ' + cc(ch) + '"><i class="sw"></i>' + ch + '</span>'; }).join('') + (gap ? '<span class="lg"><i class="sw hatch"></i>Facebook: not collected</span>' : '') + (ui.yst ? '<span class="lg"><i class="ln"></i>yesterday, all channels</span>' : '') + '</div>' +
      '<div class="tl-ctl">' + (ui.brush ? '<span class="brush-read">' + esc(brushLabel()) + '</span>' + btn('quiet', 'Clear', 'clearbrush', { icon: 'x', aria: 'Clear the time brush' }) : '<span class="tl-range hide-md">drag to brush a span</span>') +
      btn('secondary', 'Yesterday', 'yst', { pressed: ui.yst, title: 'Overlay yesterday’s volume as a faint line' }) + '</div></div>';
    h += '<div class="tl-body"><div class="tl-chart' + (compact ? ' compact' : '') + '" id="d-chart" data-fk="chart" tabindex="0" role="group" aria-label="Time brush. Left and Right move a three hour window, Shift with Left or Right resizes it, Escape clears it.' + (ui.brush ? ' Now: ' + esc(brushLabel()) : '') + '">' + c.svg + '</div>' +
      '<div class="diary" aria-label="Upcoming actions, after now"><div class="diary-h">After now · upcoming</div>' + (up.length ? up.map(function (r) { var dt = new Date(r.date + 'T12:00:00+11:00'), p = parts(dt.getTime()), days = Math.round((dt.getTime() - S.now) / 864e5);
        return '<button type="button" class="diary-item' + (ui.sel === r.id ? ' sel' : '') + '" data-act="selrow" data-id="' + r.id + '" data-cite="' + r.id + '" title="' + esc('As written: ' + r.asWritten) + '"><span class="d-date">' + p.day + ' ' + p.month + '<small>in ' + days + ' d</small></span><span class="d-title">' + esc(r.title) + ' <span class="num">· ' + esc(r.what) + (r.recorded ? ', recorded' : ', as written') + '</span></span></button>'; }).join('') : '<p class="d-title">No dated action was found in this window.</p>') + '</div></div>';
    return h + chartTable() + renderChecks();
  }
  function showCursor(id) { var g = $('d-cur'); if (!g || !geom) return; var r = id && Q.row(id);
    Array.prototype.forEach.call(document.querySelectorAll('#d-chart .mark'), function (m) { m.classList.toggle('hot', !!id && m.getAttribute('data-item') === id); });
    if (!r || r.t > 24) { g.setAttribute('visibility', 'hidden'); return; }
    g.setAttribute('transform', 'translate(' + f1(geom.x(r.t)) + ',0)'); g.querySelector('circle').style.fill = cv(chOf(r)); g.setAttribute('visibility', 'visible'); }

  /* ---------- the stream ---------- */
  function baseRows() { var f = {}; if (ui.showAside) f.aside = true; if (ui.pinned) f.pinned = true; if (ui.search) f.search = ui.search;
    var rows = Q.rows(f); if (ui.brush) rows = rows.filter(function (r) { return r.t <= ui.brush.from && r.t >= ui.brush.to; }); return rows; }
  function streamRows() { var rows = baseRows(); if (ui.facet !== 'all') rows = rows.filter(function (r) { return chOf(r) === ui.facet; }); return rows.slice().sort(function (a, b) { return a.t - b.t; }); }
  function citeLabel(r) { if (r.kind === 'media') return r.outlet; if (r.kind === 'social') return r.channel + ' post'; if (r.kind === 'actor') return r.who; if (r.kind === 'narrative') return 'Narrative'; var p = parts(new Date(r.date + 'T12:00:00+11:00').getTime()); return p.day + ' ' + p.month + ' ' + r.what; }
  function citeChip(id) { var r = Q.row(id); if (!r) return '<span class="cite bad" title="This id is not in the window’s evidence">' + ico('alert') + '<span>not in the evidence</span><em>' + esc(id) + '</em></span>';
    return '<button type="button" class="cite ' + cc(chOf(r)) + (ui.sel === id ? ' hot' : '') + '" data-act="selrow" data-id="' + id + '" data-cite="' + id + '" title="' + esc(r.title + ' — ' + (r.outlet || r.channel || r.kind) + ', ' + Q.when(r.t)) + '"><i class="dot" aria-hidden="true"></i><span>' + esc(citeLabel(r)) + '</span><em>' + id + '</em></button>'; }
  function toneWord(t) { return t <= -0.25 ? 'hostile' : t >= 0.25 ? 'warm' : 'mixed'; }
  function rowSub(r) { var b = [];
    if (r.kind === 'media') { b.push('<b>' + esc(r.outlet) + '</b>'); b.push(esc(r.tier)); if (r.outlets > 1) b.push('<span title="' + esc('Also in: ' + r.also.join(', ')) + '"><b class="num">' + r.outlets + '</b> outlets</span>'); if (r.fb) b.push('<span><b class="num">' + Q.fmt(r.fb) + '</b> Facebook reactions</span>');
      if (r.subscriber) b.push(chip('info', 'subscriber · 30-word excerpt', 'lock')); if (r.opinion) b.push(chip('', 'opinion')); if (r.full) b.push(chip('', 'full text held')); }
    else if (r.kind === 'social') { b.push('<span><b class="num">' + Q.fmt(r.eng) + '</b> interactions</span>'); if (r.growth) b.push(chip('accent', '+' + Q.fmt(r.growth) + ' since yesterday')); b.push('<span><b class="num">' + r.comments + '</b> comments, ' + toneWord(r.tone) + '</span>'); b.push('found by “' + esc(r.foundBy) + '”'); b.push('layer ' + r.layer); }
    else if (r.kind === 'actor') { b.push('<b>' + esc(r.who) + '</b>'); b.push(esc(r.role)); b.push(chip('', r.mp ? 'sitting member' : 'registered public actor')); b.push('<span><b class="num">' + Q.fmt(r.eng) + '</b> interactions</span>'); }
    else if (r.kind === 'narrative') { b.push(chip(r.status === 'emerging' ? 'warn' : '', r.status)); b.push(esc(r.side) + ' toward the client'); b.push('<span><b class="num">' + r.n + '</b> rows, ' + r.n24 + ' in 24 h</span>'); b.push(esc(r.spread.join(' → '))); }
    else { b.push(chip(r.recorded ? 'pos' : '', r.recorded ? 'recorded' : 'as written')); b.push(esc(r.what + ' on ' + r.date)); b.push('from ' + citeChip(r.from)); }
    Q.signals().filter(function (s) { return s.item === r.id; }).forEach(function (s) { b.push(chip('warn', s.label, 'alert', s.detail)); });
    var ci = Q.citedIn(r.id); if (ci.length && S.brief.status !== 'none') b.push(chip('accent', 'cited: ' + ci.map(shortTitle).join(', '), 'cite'));
    return b.join('<span aria-hidden="true">·</span>'); }
  function rowHTML(r) { var w = Q.weight(r), ch = chOf(r), pinned = !!S.pins[r.id], sel = ui.sel === r.id, wr = canWrite(), ts = tsOf(r.t);
    var acts = '';
    if (ui.showAside) acts = wr ? btn('secondary', 'Put it back', 'restore', { id: r.id, icon: 'undo' }) : '';
    else { if (wr) acts += btn('row', '', 'pin', { id: r.id, icon: 'pin', pressed: pinned, aria: (pinned ? 'Unpin: ' : 'Pin: ') + r.title, title: pinned ? 'Unpin (p)' : 'Pin (p)' }) + btn('row', '', 'aside', { id: r.id, icon: 'aside', aria: 'Set aside: ' + r.title, title: 'Set aside (x)' }) +
        (S.brief.status !== 'none' && !filed() ? btn('row', '', 'citerow', { id: r.id, icon: 'cite', aria: 'Cite into ' + secTitle(ui.cur) + ': ' + r.title, title: 'Cite into ' + secTitle(ui.cur) + ' (c)' }) : '');
      acts += btn('row', '', 'openrow', { id: r.id, icon: 'open', aria: 'Open: ' + r.title, title: 'Open (o)' }); }
    return '<li class="row ' + cc(ch) + (sel ? ' sel' : '') + (r.low ? ' low' : '') + (w.score >= 60 ? ' heavy' : '') + '" tabindex="0" data-act="rowsel" data-id="' + r.id + '" data-fk="row|' + r.id + '" data-cite="' + r.id + '"' + (sel ? ' aria-current="true"' : '') + '>' +
      '<span class="lane" aria-hidden="true"></span><span class="lane-l">' + (pinned ? '<span class="chip accent" title="Pinned">' + ico('pin') + '</span>' : '') + esc(ch) + '</span>' +
      '<span class="r-time" title="' + esc(Q.when(r.t) + ', Australian Eastern time') + '">' + hm(ts) + '<br>' + esc(Q.ago(r.t)) + '</span>' +
      '<div class="r-main"><div class="r-title">' + esc(r.title) + '</div><div class="r-sub">' + (ui.showAside ? '<span class="aside-reason">Set aside: ' + esc(S.aside[r.id] || 'muted on this desk') + '</span><span aria-hidden="true">·</span>' : '') + rowSub(r) + '</div></div>' +
      '<div class="r-w" data-tip="text" data-tt="' + esc('Weight ' + w.score + ' of 100' + (w.why.length ? ': ' + w.why.join(', ') : ': low reach, no check names it')) + '"><span class="wbar" aria-hidden="true"><i style="width:' + w.score + '%"></i></span><span class="wnum" aria-label="weight ' + w.score + '">' + w.score + '</span></div>' +
      '<div class="r-acts">' + acts + '</div></li>'; }
  function renderStream() {
    if (!onStream()) return '';
    if (S.mode === 'loading') { var sk = ''; for (var i = 0; i < 9; i++) sk += '<div class="skel-row"><span class="skel" style="width:60px"></span><span class="skel" style="width:40px"></span><span><span class="skel" style="display:block;width:' + (50 + i * 13 % 40) + '%;height:14px;margin-bottom:8px"></span><span class="skel" style="display:block;width:' + (30 + i * 7 % 30) + '%;height:10px"></span></span><span class="skel"></span></div>'; return '<div class="st-bar"><span class="skel" style="width:420px;height:26px"></span></div><div aria-hidden="true">' + sk + '</div><p class="sr" role="status">Loading the evidence.</p>'; }
    if (S.mode === 'error') return emptyState('The window could not be read', 'The worker answered with an error, so nothing is shown rather than an empty list. Your brief and pins are untouched.', ['GET /den/board answered 500. Reference: req-synthetic-0042'], btn('primary', 'Try again', 'retry', { icon: 'refresh' }), true);
    var base = baseRows(), rows = streamRows(), counts = {}, gap = gapSignal(), k = Q.counts();
    base.forEach(function (r) { var c = chOf(r); counts[c] = (counts[c] || 0) + 1; });
    ui.vis = rows.map(function (r) { return r.id; });
    var facets = ['all', 'News', 'X', 'Bluesky', 'Reddit', 'YouTube', 'Mastodon', 'Narrative', 'Upcoming'];
    var h = '<div class="st-bar"><div class="facets" role="group" aria-label="Channel">' + facets.map(function (f) { var n = f === 'all' ? base.length : (counts[f] || 0);
      return '<button type="button" class="facet ' + (f === 'all' ? '' : cc(f)) + '" data-act="facet" data-arg="' + f + '" aria-pressed="' + (ui.facet === f ? 'true' : 'false') + '">' + (f === 'all' ? '' : '<i class="dot" aria-hidden="true"></i>') + (f === 'all' ? 'All' : f === 'Narrative' ? 'Narratives' : f) + '<span class="n">' + n + '</span></button>'; }).join('') +
      (gap ? '<button type="button" class="facet gap" data-act="check" data-id="' + esc(gap.key) + '" data-tip="sig" aria-label="Facebook: not collected. Open Collection"><span class="sw hatch" aria-hidden="true"></span>Facebook<span class="chip solid-neg">not collected</span></button>' : '') + '</div>' +
      '<div class="st-tools"><label class="search">' + ico('search') + '<span class="sr">Search the stream</span><input type="search" placeholder="Search" data-in="search" data-keep="search" value="' + esc(ui.search) + '"></label>' +
      btn('quiet', 'Pinned ' + k.pinned, 'pinnedonly', { icon: 'pin', pressed: ui.pinned, title: 'Show pinned rows only' }) +
      btn('quiet', 'Set aside ' + (k.aside + k.muted), 'showaside', { icon: 'aside', pressed: ui.showAside, title: 'Show what was set aside or muted, to put it back' }) +
      (canWrite() ? btn('row', '', 'undo', { icon: 'undo', aria: 'Undo the last pin or set-aside', title: 'Undo (u)', disabled: !S.undo.length }) : '') +
      (ui.route === 'today' ? btn('secondary', 'Brief', 'dock', { icon: 'panel', pressed: ui.dockOpen, cls: 'only-narrow', title: 'Show the brief beside the stream' }) : '') + '</div></div>';
    h += '<div class="stream-scroll" data-scroll="stream">';
    if (gap && ui.facet === 'all' && !ui.showAside) h += '<div class="gaprow" role="note"><span class="sw hatch" aria-hidden="true"></span><p><b>Facebook: not collected in this window.</b> ' + esc(gap.detail) + ' This is a gap, not a quiet day.</p>' + btn('secondary', 'Why, and the one fix', 'go', { arg: 'collection' }) + '</div>';
    if (S.mode === 'empty') h += emptyState('Nothing on this desk’s issues in the window', 'The window was read and held no rows. That is not the same as nothing happening:', ['Facebook was not collected: no collector is connected.', 'Four terms are active on this desk and matched nothing in 24 hours.', 'News, X, Bluesky and Reddit were read and returned no rows on the desk’s issues.'], btn('primary', 'Open Collection and collect now', 'go', { arg: 'collection' }));
    else if (!rows.length) h += ui.showAside ? emptyState('Nothing is set aside', 'Rows you set aside, and anything muted on this desk, wait here so they can be put back.', null, btn('secondary', 'Back to the stream', 'showaside')) :
      emptyState('No rows match', 'Nothing in the window passes the span, channel, search and pinned filters together.', [ui.brush ? 'Time span: ' + brushLabel() : '', ui.facet !== 'all' ? 'Channel: ' + ui.facet : '', ui.search ? 'Search: ' + ui.search : '', ui.pinned ? 'Pinned only' : ''].filter(Boolean), btn('primary', 'Clear the filters', 'clearfilters'));
    else { var day = null; h += '<ul class="stream" aria-label="' + rows.length + ' rows, newest first">'; rows.forEach(function (r) { var d = dayLabel(tsOf(r.t)); if (d !== day) { h += '<li class="divider" role="presentation">' + esc(d) + (ui.brush ? ' · brushed ' + esc(brushLabel()) : '') + (ui.showAside ? ' · set aside' : '') + '</li>'; day = d; } h += rowHTML(r); }); h += '</ul>'; }
    return h + '</div>';
  }

  /* ---------- the brief ---------- */
  function prose(sid, text) { var fl = Q.flags(sid);
    return Q.sentences(text).map(function (sen) { var f = fl.filter(function (x) { return x.sentence === sen; }), inner = esc(sen).replace(/\[([A-Z]:\d+)\]/g, function (m, id) { return citeChip(id); });
      return f.length ? '<span class="sent flagged">' + inner + '</span>' + f.map(function (x) { return '<span class="flag" role="note">' + ico('alert') + esc(x.kind === 'uncited' ? 'No evidence behind this sentence' : x.text) + '</span>'; }).join('') : '<span class="sent">' + inner + '</span>'; }).join(' '); }
  function ratingHTML(s) { var R = Q.ratings(), it = R.items.filter(function (x) { return x.id === s.rating; })[0], v = S.brief.ratings[s.rating] || {}, dis = !canWrite() || filed();
    if (!it) return '';
    var sel = function (key, list, label) { return '<label>' + label + '<select class="in" data-in="rating" data-id="' + key + '"' + (dis ? ' disabled' : '') + '>' + list.map(function (x) { return '<option' + (x === v[key] ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>'; };
    return '<div class="rating" role="group" aria-label="' + esc(it.label) + ' rating">' + chip('accent', it.label + ' rating') + sel('level', R.levels, 'Level') + (it.trend ? sel('trend', R.trends, 'Trend') : '') + '</div>'; }
  function secHTML(s) { var b = S.brief, wr = canWrite() && !filed();
    if (s.built) { var src = Q.sourceList(); return '<section class="sec" id="sec-' + s.id + '" aria-label="' + esc(s.title) + '"><div class="sec-h"><h3>' + esc(s.title) + '</h3>' + chip('', 'built from citations · not editable', 'lock') + '<span class="sp"></span><span class="sec-meta">' + src.length + ' sources</span></div>' +
      (src.length ? '<ol class="srclist">' + src.map(function (x) { return '<li><span class="num">' + esc(x.id) + '</span><span>' + esc(x.title) + '<small>' + esc(x.where + ', ' + x.when) + '</small></span></li>'; }).join('') + '</ol>' : '<p class="sec-text none">Nothing is cited yet. The list fills itself as sections cite rows.</p>') + '</section>'; }
    var d = b.sections[s.id], flags = Q.flags(s.id), editing = wr && ui.editing === s.id, cur = ui.cur === s.id, selRow = ui.sel && Q.row(ui.sel);
    var h = '<section class="sec' + (cur ? ' cur' : '') + '" id="sec-' + s.id + '" data-section="' + s.id + '" aria-label="' + esc(s.title) + '"><div class="sec-h"><h3>' + esc(s.title) + '</h3>' +
      (d.by === 'drafted' ? chip('', 'drafted') : chip('info', (d.edited ? 'edited by ' : 'by ') + d.by)) + (flags.length ? chip('warn', flags.length + (flags.length > 1 ? ' flags' : ' flag'), 'alert') : '') + '<span class="sp"></span><span class="sec-meta">' + Q.words(s.id) + ' words</span>' +
      (wr ? (editing ? btn('secondary', 'Done', 'editdone', { id: s.id }) : btn('quiet', 'Edit', 'edit', { id: s.id, icon: 'edit', aria: 'Edit ' + s.title })) + btn('quiet', 'Regenerate', 'regen', { id: s.id, icon: 'regen', cost: '1 call', aria: 'Regenerate ' + s.title + ', 1 model call', disabled: !!d.busy }) : '') + '</div>';
    if (s.rating) h += ratingHTML(s);
    if (d.busy) h += '<div aria-hidden="true"><span class="skel" style="display:block;height:14px;margin:8px 0;width:96%"></span><span class="skel" style="display:block;height:14px;margin:8px 0;width:88%"></span><span class="skel" style="display:block;height:14px;margin:8px 0;width:62%"></span></div><p class="sr" role="status">Regenerating ' + esc(s.title) + '</p>';
    else if (editing) { h += '<div class="sec-edit"><textarea data-keep="ta-' + s.id + '" data-in="sectext" data-id="' + s.id + '" aria-label="' + esc(s.title) + ' text" spellcheck="true">' + esc(d.text) + '</textarea></div>' +
      '<div class="sec-foot"><span>Cite as <span class="num">[M:1]</span>. Select a row and press <span class="num">c</span>, or use its cite button: the mark lands at the caret.</span><span class="sp"></span>' + (selRow ? btn('secondary', 'Cite the selected row', 'citerow', { id: selRow.id, icon: 'cite', title: selRow.title }) : '') + '</div>' +
      (flags.length ? '<ul class="flaglist" aria-label="Flags in this section">' + flags.map(function (f) { return '<li><b>' + esc(f.kind === 'uncited' ? 'No evidence behind' : f.text) + '</b><span>“' + esc(f.sentence) + '”</span></li>'; }).join('') + '</ul>' : '') +
      '<div class="sec-text" aria-label="Preview with citations" style="margin-top:10px">' + prose(s.id, d.text) + '</div>'; }
    else h += d.text.trim() ? '<div class="sec-text"' + (wr ? ' data-act="edit" data-id="' + s.id + '" title="Click to edit"' : '') + '>' + prose(s.id, d.text) + '</div>' : '<p class="sec-text none"' + (wr ? ' data-act="edit" data-id="' + s.id + '"' : '') + '>Nothing written yet.' + (wr ? ' Click to write, or cite a row into this section.' : '') + '</p>';
    return h + '</section>'; }
  function spendLine() { return '<div class="kv"><div><b>' + Q.rows({}).length + '</b>rows in the window</div><div><b>' + Q.counts().pinned + '</b>pinned, sent first</div><div><b>' + S.calls.used + ' of ' + S.calls.cap + '</b>model calls today</div><div><b>1</b>model call this costs</div></div>'; }
  function renderDock() {
    if (!onStream()) return '';
    var b = S.brief, wr = canWrite(), fl = filed(), secs = Q.sections();
    if (S.mode === 'loading') return '<div class="dk-head"><span class="skel" style="width:180px;height:20px"></span><span class="skel" style="width:90%;height:26px"></span></div><div class="dk-body" aria-hidden="true">' + [92, 80, 96, 60, 88, 72].map(function (w) { return '<span class="skel" style="display:block;height:14px;margin:12px 0;width:' + w + '%"></span>'; }).join('') + '</div>';
    if (S.mode === 'error') return '<div class="dk-body">' + emptyState('The brief could not be read', 'The same failed read. Words you had not saved are still on this computer.', null, btn('primary', 'Try again', 'retry', { icon: 'refresh' }), true) + '</div>';
    var saveTxt = { unsaved: 'unsaved changes', saving: 'saving…', saved: 'saved · revision ' + b.revision, failed: 'not saved · kept on this computer' }[b.save] || b.save, flagN = b.status === 'none' ? 0 : Q.flagCount();
    var h = '<div class="dk-head"><div class="dk-row"><h2 class="dk-title">Brief</h2><span class="dk-meta">' + esc(b.day) + '</span>' + briefChip(b.status) + '<span class="sp"></span>' +
      (b.status !== 'none' ? '<span class="save ' + b.save + '" role="status"><i aria-hidden="true"></i>' + esc(saveTxt) + '</span>' : '') + (ui.route === 'today' ? btn('row', '', 'dock', { icon: 'x', aria: 'Hide the brief', cls: 'only-narrow' }) : '') + '</div>';
    if (b.status !== 'none' && !b.drafting) {
      h += '<div class="dk-row" style="flex-wrap:wrap"><span class="dk-meta"><b class="num">' + Q.fmt(Q.words()) + '</b> words</span>' + (flagN ? chip('warn', flagN + ' flags', 'alert') : chip('pos', 'no flags', 'check')) + '<span class="sp"></span>';
      if (wr && !fl) h += (b.save === 'failed' ? btn('danger', 'Save again', 'save', { icon: 'refresh' }) : btn('secondary', 'Save', 'save', { disabled: b.save !== 'unsaved', title: 'Ctrl or Cmd + S', busy: b.save === 'saving' })) + btn('primary', 'Mark as filed', 'file', { icon: 'check' });
      if (wr && fl) h += btn('secondary', 'Reopen', 'reopen', { icon: 'undo' });
      h += '<span class="rel">' + btn('quiet', 'Export', 'expmenu', { icon: 'download', expanded: ui.menu === 'export' }) + (ui.menu === 'export' ? '<div class="menu right" role="menu" aria-label="Export">' +
        [['doc', 'copy', 'Copy for the document'], ['md', 'download', 'Download .md'], ['html', 'download', 'Download .html'], ['slack', 'copy', 'Copy the Slack summary']].map(function (e) { return '<button type="button" role="menuitem" class="menu-item" data-act="exp" data-arg="' + e[0] + '">' + ico(e[1]) + '<span class="grow">' + e[2] + '</span></button>'; }).join('') + '</div>' : '') + '</span>' +
        btn('quiet', 'History', 'history', { icon: 'history' }) + (wr && !fl ? btn('quiet', 'Draft again', 'draftask', { icon: 'regen', cost: '1 call', aria: 'Draft the brief again, 1 model call' }) : '') + '</div>';
      h += '<div class="dk-row">' + (wr && !fl ? '<label class="dk-meta" for="d-cursel">citing into</label><select id="d-cursel" class="in" data-in="cur">' + secs.filter(function (s) { return !s.built; }).map(function (s) { return '<option value="' + s.id + '"' + (ui.cur === s.id ? ' selected' : '') + '>' + esc(s.title) + '</option>'; }).join('') + '</select>' : '') +
        '<nav class="outline" aria-label="Sections">' + secs.map(function (s) { var n = s.built ? 0 : Q.flags(s.id).length; return '<button type="button" class="ol" data-act="sec" data-id="' + s.id + '"' + (ui.cur === s.id ? ' aria-current="true"' : '') + '>' + esc(shortTitle(s.id)) + (n ? '<i class="fl" title="' + n + ' flagged"></i><span class="sr">, ' + n + ' flagged</span>' : '') + '</button>'; }).join('') + '</nav></div>';
    }
    h += '</div><div class="dk-body" data-scroll="dock">';
    if (b.conflict) { var c = b.conflict, mine = (b.sections[c.section] || {}).text || '';
      h += notice('warn', c.by + ' saved ' + secTitle(c.section) + ' while you were editing it', '<div class="quote"><small>Yours</small>' + esc(mine) + '</div><div class="quote"><small>' + esc(c.by) + '’s</small>' + esc(c.theirs) + '</div>', btn('primary', 'Keep mine', 'resolve', { arg: 'mine' }) + btn('secondary', 'Take theirs', 'resolve', { arg: 'theirs' })); }
    if (b.drafting && b.drafting.dropped) return h + notice('neg', 'The connection dropped while the brief was being drafted', '<p>The call was already sent, so the draft may have finished on the worker. Nothing is spent twice by checking.</p>', btn('primary', 'Check for the draft', 'checkdraft', { icon: 'refresh' })) + '</div>';
    if (b.drafting) { var dr = b.drafting, el = Math.max(0, Math.round((Date.now() - dr.t0) / 1000));
      return h + '<div class="card" role="status" aria-live="polite"><h3>Drafting the brief</h3><p>One model call, answered once. You can keep triaging: pins made now are not in this draft.</p><div class="kv"><div><b>' + dr.evidence + '</b>rows of evidence</div><div><b>' + dr.pinned + '</b>pinned</div><div><b>' + el + ' s</b>elapsed</div><div><b>' + dr.n + ' of ' + dr.of + '</b>stage</div></div>' +
        '<div class="stepper">' + STAGES.map(function (st, i) { var cls = i + 1 < dr.n ? 'done' : i + 1 === dr.n ? 'on' : ''; return '<div class="step ' + cls + '"><i>' + (cls === 'done' ? '✓' : cls === 'on' ? '' : i + 1) + '</i><span>' + esc(i + 1 === dr.n ? dr.stage : st) + '</span></div>'; }).join('') + '</div></div></div>'; }
    if (b.status === 'none') { var n = Q.rows({}).length;
      return h + '<div class="card"><h3>No brief for ' + esc(b.day) + ' yet</h3>' + (n ? '<p>A draft is written from the window’s rows, pinned rows first, and every sentence is tied back to a row.</p>' + spendLine() : '<p>There is nothing in the window to draft from, so a draft would spend a model call on no evidence. You can still write by hand.</p>') +
        (wr ? '<div class="acts">' + btn('primary', 'Draft the brief', 'draft', { icon: 'regen', cost: '1 model call', disabled: !n }) + btn('secondary', 'Write by hand', 'byhand', { icon: 'edit' }) + '</div>' : '<p style="margin-top:12px">' + chip('info', 'Read-only key: a brief cannot be started', 'lock') + '</p>') + '</div></div>'; }
    if (fl) h += notice('pos', 'Filed by ' + (b.filedBy || 'Anne') + ' · final until reopened', '<p>The filed brief cannot be edited. Exports are of this exact text.</p>', wr ? btn('secondary', 'Reopen', 'reopen', { icon: 'undo' }) : '');
    if (!wr) h += notice('info', 'Read-only key', '<p>You can read the brief, its citations and its history, and export it. Editing, drafting and filing need a full key.</p>');
    return h + secs.map(secHTML).join('') + '</div>';
  }

  /* ---------- watch ---------- */
  function scoreBar(n) { return '<span class="score" title="Score ' + n + ' of 100"><span class="wbar" aria-hidden="true"><i style="width:' + n + '%"></i></span><span class="wnum">' + n + '</span></span>'; }
  function propHTML(p) { var wr = canWrite(), m = ui.w.mode[p.id], iss = ui.w.issue[p.id] || '', reason = ui.w.reason[p.id] || '';
    var h = '<li class="prop"><div class="prop-top">' + chip('', p.kind) + '<span class="prop-val">' + esc(p.value) + (p.name ? ' <span style="font-weight:400;color:var(--ink-3)">' + esc(p.name) + '</span>' : '') + '</span><span class="sp"></span>' + scoreBar(p.score) + '</div><p class="prop-reason">' + esc(p.reason) + '</p><div class="prop-ev"><span>Evidence</span>' + p.evidence.map(citeChip).join('') + '</div>';
    if (p.status !== 'proposed') return h + '<div style="margin-top:8px">' + (p.status === 'active' ? chip('pos', 'Approved' + (p.issue ? ' under ' + issueLabel(p.issue) : ', searched for, tags nothing'), 'check') : chip('', 'Dismissed: ' + (p.reason2 || ''), 'x')) + '</div></li>';
    h += '<div class="card-acts" style="display:flex;gap:8px;margin-top:10px">' + btn('quiet', 'Preview', 'wmode', { id: p.id, arg: 'preview', expanded: m === 'preview', icon: 'search' }) + (wr ? btn('secondary', 'Approve…', 'wmode', { id: p.id, arg: 'approve', expanded: m === 'approve', icon: 'check' }) + btn('quiet', 'Dismiss…', 'wmode', { id: p.id, arg: 'dismiss', expanded: m === 'dismiss', icon: 'x' }) : '') + '</div>';
    if (m === 'preview') h += '<div class="prop-box">' + (p.preview ? '<div class="kv" style="margin:0 0 8px"><div><b>' + p.preview.held + '</b>rows already on the desk</div><div><b>' + p.preview.add + '</b>it would add</div><div><b>' + p.preview.au + '</b>say something Australian</div></div><ul>' + p.preview.sample.map(function (x) { return '<li class="quote">' + esc(x) + '</li>'; }).join('') + '</ul><p class="sec-meta">Counted from what is already held. A preview writes nothing.</p>' : '<p>A preview counts what a <b>term</b> would have caught. This is ' + esc(p.kind === 'account' || p.kind === 'outlet' ? 'an ' : 'a ') + esc(p.kind) + ': open its evidence instead.</p>') + '</div>';
    if (m === 'approve') h += '<div class="prop-box"><div class="rowf"><label class="field">Approve under an issue<select data-in="wissue" data-id="' + p.id + '"><option value="">No issue: searched for, tags nothing</option>' + Q.issues().map(function (i) { return '<option value="' + i.id + '"' + (iss === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' + btn('primary', iss ? 'Approve under ' + issueLabel(iss) : 'Approve without an issue', 'wapprove', { id: p.id, icon: 'check' }) + '</div><p class="sec-meta" style="margin-top:8px">An approved term widens collection and tagging only. It never changes what counts as a spike.</p></div>';
    if (m === 'dismiss') h += '<div class="prop-box"><div class="rowf"><label class="field" style="flex:1">Reason (required)<input type="text" data-in="wreason" data-keep="wr-' + p.id + '" data-id="' + p.id + '" value="' + esc(reason) + '" placeholder="generic, foreign, already covered…"></label>' + btn('danger', 'Dismiss', 'wdismiss', { id: p.id, disabled: reason.trim().length < 3 }) + '</div><p class="sec-meta" style="margin-top:8px">A dismissal is never proposed again, and stands for the words inside the phrase.</p></div>';
    return h + '</li>'; }
  function renderWatch() { var wr = canWrite(), props = S.proposals.slice().sort(function (a, b) { return (a.status === 'proposed' ? 0 : 1) - (b.status === 'proposed' ? 0 : 1) || b.score - a.score; }), waiting = props.filter(function (p) { return p.status === 'proposed'; }).length;
    var kinds = ['term', 'account', 'hashtag', 'outlet', 'group'], klabel = { term: 'Terms', account: 'Accounts', hashtag: 'Hashtags', outlet: 'Outlets', group: 'Groups' };
    var h = '<div class="pg"><div class="pg-h"><div><h1>Watch</h1><p>What this desk listens for. The lexicon grows by proposal, and a person decides: nothing proposed is read by any collector until it is approved.</p></div></div><div class="grid2"><div>' +
      '<section class="panel" aria-label="Proposals"><div class="panel-h"><h2>Proposals</h2>' + chip(waiting ? 'warn' : 'pos', waiting ? waiting + ' waiting' : 'all decided') + '<span class="sp"></span><small>found by counting, no model</small></div><ul class="panel-b flush">' + props.map(propHTML).join('') + '</ul></section></div><div>';
    h += '<section class="panel" aria-label="The register"><div class="panel-h"><h2>The register</h2><span class="sp"></span><small>' + S.register.filter(function (r) { return r.status === 'active'; }).length + ' active</small></div><div class="panel-b flush"><table class="tbl"><thead><tr><th>Watched</th><th>Issue</th><th>Last matched</th><th class="r">On</th></tr></thead><tbody>';
    kinds.forEach(function (k) { var rs = S.register.filter(function (r) { return r.kind === k; }); if (!rs.length) return; h += '<tr><th colspan="4" scope="colgroup">' + klabel[k] + ' · ' + rs.length + '</th></tr>';
      rs.forEach(function (r) { h += '<tr' + (r.error ? ' class="gap"' : '') + '><td><b>' + esc(r.value) + '</b>' + (r.name || r.platform ? '<small>' + esc([r.name, r.platform, r.actor === 'official' ? 'official' : r.actor === 'org' ? 'organisation' : ''].filter(Boolean).join(' · ')) + '</small>' : '') +
        (r.review ? chip('warn', 'review: matched nothing new in 30 days', 'alert') : '') + (r.status === 'dismissed' ? chip('', 'dismissed: ' + r.reason) : '') + '</td><td>' + esc(issueLabel(r.issue) || '—') + '</td><td>' + (r.error ? chip('solid-neg', r.error) : '<span class="num">' + esc(Q.ago(r.last)) + '</span>') + '</td><td class="r">' +
        (r.status === 'dismissed' ? '' : '<button type="button" class="switch" role="switch" data-act="regtoggle" data-id="' + r.id + '" aria-checked="' + (r.status === 'active' ? 'true' : 'false') + '" aria-label="Watch ' + esc(r.value) + '"' + (wr ? '' : ' disabled') + '></button>') + '</td></tr>'; }); });
    h += '</tbody></table></div></section>';
    if (wr) h += '<section class="panel" aria-label="Add to the register"><div class="panel-h"><h2>Add to the register</h2></div><div class="panel-b"><div class="rowf" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap"><label class="field">Kind<select id="d-addkind">' + kinds.map(function (k) { return '<option>' + k + '</option>'; }).join('') + '</select></label><label class="field" style="flex:1">Value<input type="text" id="d-addval" placeholder="a term, @account, #hashtag or site"></label>' + btn('secondary', 'Add', 'addreg') + '</div></div></section>';
    return h + '</div></div></div>'; }

  /* ---------- collection ---------- */
  function week(c) { var rest = Math.max(0, c.d7 - c.d1), wts = [.9, 1.15, .8, 1.2, 1.0, .95], sum = 6; return wts.map(function (w) { return Math.round(rest * w / sum); }).concat([c.d1]); }
  function spark(c) { var W = 84, H = 22, v = week(c), max = Math.max.apply(null, v.concat([1])), bw = 9, col = cv(c.label);
    if (c.state === 'gap' && S.mode !== 'nogap') return '<svg class="spark" width="' + W + '" height="' + H + '" role="img" aria-label="Not collected in seven days: a gap, not zero"><defs><pattern id="sp-h" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><rect width="2" height="6" style="fill:var(--ch-facebook)"/></pattern></defs><rect x=".5" y="4.5" width="' + (W - 1) + '" height="' + (H - 5) + '" rx="2" style="fill:url(#sp-h);stroke:var(--ch-facebook)"/></svg>';
    return '<svg class="spark" width="' + W + '" height="' + H + '" role="img" aria-label="Seven days, oldest first: ' + v.join(', ') + '">' + v.map(function (n, i) { var hh = n ? Math.max(2, n / max * (H - 2)) : 1; return '<rect x="' + (i * 12 + 1) + '" y="' + f1(H - hh) + '" width="' + bw + '" height="' + f1(hh) + '" rx="1.5" style="fill:' + (n ? col : 'var(--line-strong)') + ';opacity:' + (i === 6 ? 1 : .6) + '"/>'; }).join('') + '</svg>'; }
  function consoleHTML() { var j = S.job; if (!j) return ''; return '<div class="console" role="log" aria-live="polite" aria-label="Collection console">' + j.lines.map(function (l) { return '<div class="ln' + (/^failed/.test(l) ? ' fail' : /^done|^filed/.test(l) ? ' ok' : '') + '">' + esc(l) + '</div>'; }).join('') + (j.done ? '' : '<span class="cursor" aria-hidden="true"></span>') + '</div>'; }
  function renderCollection() { var wr = canWrite(), nogap = S.mode === 'nogap', R = Q.recall();
    var gaps = nogap ? [] : S.channels.filter(function (c) { return c.state === 'gap'; });
    var h = '<div class="pg"><div class="pg-h"><div><h1>Collection</h1><p>What each channel delivered for this desk, how it is read, and why a gap is a gap. A channel that delivered nothing is never shown as a quiet day.</p></div></div>';
    gaps.forEach(function (c) { h += notice('neg', c.label + ': not collected in this window', '<p>' + esc(c.why) + '</p><p><b style="display:inline">The one fix:</b> ' + esc(c.fix) + '</p>', wr ? btn('secondary', 'Collect now', 'collect', { id: c.id, icon: 'play' }) : ''); });
    if (!gaps.length) h += notice('pos', 'Every channel this desk relies on delivered in the window', '');
    h += '<section class="panel" aria-label="Channels"><div class="panel-h"><h2>Channels</h2><span class="sp"></span><small>seven-day bars: each row to its own scale, today brightest</small></div><div class="panel-b flush"><table class="tbl"><thead><tr><th>Channel</th><th>Read by</th><th class="r">24 h</th><th>7 days</th><th>Last row</th><th>State</th><th>On</th><th></th></tr></thead><tbody>';
    S.channels.forEach(function (c) { var isGap = c.state === 'gap' && !nogap, run = S.job && S.job.channel === c.id, state = c.off ? chip('', 'switched off') : isGap ? chip('solid-neg', 'gap: not collected', 'alert') : c.state === 'paused' ? chip('warn', 'paused 24 h', 'clock') : c.state === 'quiet' ? chip('info', 'quiet, expected') : chip('pos', 'delivering', 'check');
      h += '<tr' + (isGap ? ' class="gap"' : '') + '><td><span class="lg ' + cc(c.label) + '"><i class="sw' + (isGap ? ' hatch' : '') + '"></i><b>' + esc(c.label) + '</b></span><small>' + esc(c.how) + '</small></td><td>' + chip('', c.by === 'mac' ? 'the Mac, signed in' : 'the worker') + '</td>' +
        '<td class="r num">' + (isGap ? '—' : c.d1) + '</td><td><div style="display:flex;align-items:center;gap:8px">' + spark(c) + '<span class="num">' + (isGap ? '' : c.d7) + '</span></div></td><td class="num">' + esc(Q.ago(c.last)) + '</td><td>' + state + (c.why && !(c.state === 'gap' && nogap) ? '<small>' + esc(c.why) + (c.fix ? ' ' + esc(c.fix) : '') + '</small>' : '') + '</td>' +
        '<td><button type="button" class="switch" role="switch" data-act="chtoggle" data-id="' + c.id + '" aria-checked="' + (c.off ? 'false' : 'true') + '" aria-label="Collect ' + esc(c.label) + '"' + (wr ? '' : ' disabled') + '></button></td><td class="r">' + (wr ? btn('secondary', 'Collect now', 'collect', { id: c.id, icon: 'play', busy: run && !S.job.done, disabled: !!c.off || (S.job && !S.job.done), aria: 'Collect ' + c.label + ' now' }) : '') + '</td></tr>';
      if (run) h += '<tr class="sub"><td colspan="8">' + consoleHTML() + (S.job.done ? '<p class="sec-meta" style="margin-top:6px">' + (S.job.failed ? 'The job failed. Nothing was filed.' : 'The job finished.') + '</p>' : '') + '</td></tr>'; });
    h += '</tbody></table></div></section><div class="grid3">';
    h += '<section class="panel" aria-label="Parliament pages"><div class="panel-h"><h2>Parliament pages</h2><span class="sp"></span><small>public record</small></div><div class="panel-b flush"><table class="tbl"><thead><tr><th>Watched page</th><th>Stage</th><th>Next</th></tr></thead><tbody>' + Q.pages().map(function (p) { return '<tr><td><b>' + esc(p.name) + '</b><small>' + esc(p.house) + ' · read ' + esc(Q.ago(p.read)) + '</small></td><td>' + chip('', p.stage) + '</td><td class="num">' + esc(p.next) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="panel" aria-label="Petition counters"><div class="panel-h"><h2>Petition counters</h2><span class="sp"></span><small>self-reported by the page</small></div><div class="panel-b flush"><table class="tbl"><thead><tr><th>Petition</th><th class="r">Signatures</th><th class="r">24 h</th></tr></thead><tbody>' + Q.petitions().map(function (p) { return '<tr><td><b>' + esc(p.name) + '</b><small>' + esc(p.host) + '</small></td><td class="r num">' + Q.fmt(p.count) + '</td><td class="r">' + chip(p.d1 > 500 ? 'warn' : '', '+' + Q.fmt(p.d1)) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
    h += '<section class="panel" aria-label="Recall"><div class="panel-h"><h2>Recall</h2><span class="sp"></span><small>the measure of the work</small></div><div class="panel-b"><div class="hero">' + Math.round(R.share * 100) + '%<small>of the links in ' + R.reports + ' filed reports were held by the end of the day after each report</small></div><div class="recall" role="img" aria-label="Recall by channel: ' + R.by.map(function (x) { return x[0] + ' ' + Math.round(x[1] * 100) + ' per cent'; }).join(', ') + '">' +
      R.by.map(function (x) { return '<span class="lg ' + cc(x[0]) + '"><i class="sw"></i>' + esc(x[0]) + '</span><span class="track ' + cc(x[0]) + '"><i style="width:' + Math.round(x[1] * 100) + '%"></i></span><span class="v">' + Math.round(x[1] * 100) + '%</span>'; }).join('') + '</div></div></section>';
    return h + '</div></div>'; }

  /* ---------- options ---------- */
  function sw(act, id, on, label, dis) { return '<button type="button" class="switch" role="switch" data-act="' + act + '" data-id="' + id + '" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) + '"' + (dis ? ' disabled' : '') + '></button>'; }
  function renderOptions() { var o = S.options, wr = canWrite(), R = Q.ratings();
    var h = '<div class="pg" style="max-width:980px"><div class="pg-h"><div><h1>Options</h1><p>How this desk is shown and drafted. Rare settings live here, away from the daily loop.</p></div></div>' + (wr ? '' : notice('info', 'Read-only key', '<p>Options are shown and cannot be changed with this key.</p>'));
    h += '<section class="panel" aria-label="Display"><div class="panel-h"><h2>Display</h2></div><div class="panel-b">' +
      '<div class="optrow"><div><b>Row density</b><small>How much air each stream row gets.</small></div><div class="seg" role="group" aria-label="Row density">' + ['compact', 'regular', 'comfortable'].map(function (d) { return '<button type="button" data-act="opt" data-id="density" data-arg="' + d + '" aria-pressed="' + (o.density === d ? 'true' : 'false') + '"' + (wr ? '' : ' disabled') + '>' + d + '</button>'; }).join('') + '</div></div>' +
      '<div class="optrow"><div><b>Fold syndicated copies</b><small>One row for a story carried by several outlets, with the count.</small></div>' + sw('optsw', 'fold', o.fold, 'Fold syndicated copies', !wr) + '</div>' +
      '<div class="optrow"><div><b>Smallest social post shown</b><small>Posts under this many interactions are left out unless a check names them.</small></div><label class="field"><span class="sr">Minimum interactions</span><input type="number" min="0" step="5" data-in="optnum" data-keep="optnum" data-id="minInteractions" value="' + esc(o.minInteractions) + '"' + (wr ? '' : ' disabled') + ' style="width:90px"></label></div></div></section>';
    h += '<section class="panel" aria-label="Drafting"><div class="panel-h"><h2>Drafting</h2></div><div class="panel-b"><div class="optrow"><div><b>Draft each morning</b><small>Off unless set. When on it spends <b style="display:inline">1 model call</b> a day for this desk, inside the automation window.</small></div>' + sw('optsw', 'autoDraft', o.autoDraft, 'Draft each morning, 1 model call a day', !wr) + '</div>' +
      '<div class="optrow"><div><b>Report format</b><small>' + Q.sections().map(function (s) { return esc(s.title); }).join(' · ') + '</small></div></div><div class="optrow"><div><b>Rating words</b><small>' + R.levels.join(' · ') + ' — ' + R.trends.join(' · ') + '</small></div></div></div></section>';
    h += '<section class="panel" aria-label="Muted on this desk"><div class="panel-h"><h2>Muted on this desk</h2><span class="sp"></span><small>' + S.mutes.length + '</small></div><div class="panel-b">' + (S.mutes.length ? S.mutes.map(function (m) { return '<div class="optrow"><div><b>' + esc(m.value) + '</b><small>' + esc(m.kind) + ' · its rows are left out of the stream and the draft</small></div>' + (wr ? btn('secondary', 'Unmute', 'unmute', { id: m.value }) : '') + '</div>'; }).join('') : '<p class="sec-meta">Nothing is muted. The third set-aside of one outlet or account offers a mute; a person confirms it.</p>') + '</div></section>';
    return h + '</div>'; }

  /* ---------- the design-system page ---------- */
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join(''); var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function lum(c) { var a = c.map(function (v) { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; }
  function contrast(a, b) { if (!/^#[0-9a-f]{3,6}$/i.test(a) || !/^#[0-9a-f]{3,6}$/i.test(b)) return null; var l1 = lum(rgb(a)), l2 = lum(rgb(b)); return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); }
  function swatch(name, against, need) { var v = cssVar(name), c = against ? contrast(v, cssVar(against)) : null;
    return '<div class="swatch"><i style="background:var(' + name + ')"></i><div><b>' + name + '</b>' + esc(v) + (c ? '<br>' + c.toFixed(1) + ':1 on ' + against.replace('--', '') + ' ' + (c >= need ? '✓ ' + (need >= 4.5 ? 'AA text' : 'AA graphic') : '✗ below ' + need + ':1') : '') + '</div></div>'; }
  function spec(label, body) { return '<div class="spec"><span class="spec-l">' + label + '</span>' + body + '</div>'; }
  function renderSystem() { var modes = ['normal', 'loading', 'empty', 'error', 'busy', 'dropped', 'readonly', 'filed', 'nogap'], theme = document.documentElement.getAttribute('data-theme');
    var demo = Q.rows({ kind: 'media' })[0] || Q.rows({})[0], demo2 = Q.rows({ kind: 'social' })[0];
    var h = '<div class="pg"><div class="pg-h"><div><h1>The Clock: design system</h1><p>Every colour, size, radius, shadow and duration on this page is a custom property at the top of concept-d.css. Dark is the first theme; light re-points the same names.</p></div><span class="sp"></span>' +
      '<div class="seg" role="group" aria-label="Theme">' + ['dark', 'light'].map(function (t) { return '<button type="button" data-act="theme" data-arg="' + t + '" aria-pressed="' + (theme === t ? 'true' : 'false') + '">' + t + (t === 'light' ? ' (preview)' : '') + '</button>'; }).join('') + '</div></div>';
    h += '<section class="panel" aria-label="Demo states"><div class="panel-h"><h2>Demo states</h2><span class="sp"></span><small>also ?state= in the address</small></div><div class="panel-b">' + spec('state', '<div class="seg" role="group" aria-label="Demo state">' + modes.map(function (m) { return '<button type="button" data-act="mode" data-arg="' + m + '" aria-pressed="' + (S.mode === m ? 'true' : 'false') + '">' + m + '</button>'; }).join('') + '</div>') +
      spec('simulate', btn('secondary', 'Simulate a save conflict', 'conflict') + btn('secondary', 'Show a toast', 'demotoast') + btn('secondary', 'Open a dialog', 'demodlg') + btn('secondary', 'Open a row drawer', 'openrow', { id: demo ? demo.id : '' }) + btn('quiet', 'See it on Today', 'go', { arg: 'today' })) + '</div></section>';
    h += '<section class="panel" aria-label="Colour"><div class="panel-h"><h2>Colour</h2><span class="sp"></span><small>contrast is computed live from the tokens in force</small></div><div class="panel-b">' +
      spec('surfaces', '<div class="sw-grid" style="flex:1">' + ['--bg', '--surface-1', '--surface-2', '--surface-3', '--surface-4', '--line', '--line-strong'].map(function (n) { return swatch(n); }).join('') + '</div>') +
      spec('ink', '<div class="sw-grid" style="flex:1">' + ['--ink-1', '--ink-2', '--ink-3', '--accent'].map(function (n) { return swatch(n, '--surface-1', 4.5) + swatch(n, '--surface-3', 4.5); }).join('') + '</div>') +
      spec('status', '<div class="sw-grid" style="flex:1">' + ['--pos', '--warn', '--neg', '--info'].map(function (n) { return swatch(n, '--surface-1', 4.5); }).join('') + '</div>') +
      spec('channels', '<div class="sw-grid" style="flex:1">' + ['news', 'x', 'bluesky', 'reddit', 'youtube', 'mastodon', 'facebook', 'instagram', 'hansard'].map(function (n) { return swatch('--ch-' + n, '--surface-1', 3); }).join('') + '</div>') +
      '<p class="sec-meta">One hue per channel, in a fixed order, the same wherever the channel appears. The seven charted hues were run through a colour-vision validator against this surface (worst adjacent pair ΔE 8.4 protan; all at or above 3:1). Status colours are reserved and always carry an icon or a word. Instagram and Hansard are never charted and wear neutrals.</p></div></section>';
    h += '<section class="panel" aria-label="Type"><div class="panel-h"><h2>Type</h2><span class="sp"></span><small>Manrope display · DM Sans interface · system mono for figures</small></div><div class="panel-b">' +
      [['--t-3xl', 'hero figure', 'font:700 var(--t-3xl)/1 var(--f-mono)', '83%'], ['--t-2xl', 'page title', 'font:800 var(--t-2xl)/1.15 var(--f-display)', 'Collection'], ['--t-xl', 'dialog title', 'font:800 var(--t-xl)/1.25 var(--f-display)', 'Before it is filed'], ['--t-lg', 'heavy row, brief prose', 'font:400 var(--t-lg)/var(--lh-read) var(--f-ui)', 'The ferry levy dominated the window.'], ['--t-md', 'row title, body', 'font:600 var(--t-md)/1.35 var(--f-ui)', 'Minister rules out fare cap changes before the budget'], ['--t-sm', 'controls, tables', 'font:400 var(--t-sm)/1.45 var(--f-ui)', 'Signed-in search on the Mac'], ['--t-xs', 'meta, chips', 'font:400 var(--t-xs)/1.4 var(--f-mono)', '05:04 · 2 h ago · 1,840'], ['--t-2xs', 'labels', 'font:600 var(--t-2xs)/1 var(--f-mono);letter-spacing:.08em;text-transform:uppercase', '6 checks · no model']].map(function (t) { return spec(t[0] + ' ' + cssVar(t[0]), '<span style="' + t[2] + '">' + esc(t[3]) + '</span><span class="sec-meta">' + t[1] + '</span>'); }).join('') + '</div></section>';
    h += '<div class="grid2"><section class="panel" aria-label="Space, radius, elevation"><div class="panel-h"><h2>Space, radius, elevation</h2></div><div class="panel-b">' +
      spec('space', ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7'].map(function (n) { return '<span class="box" style="width:var(' + n + ');height:var(' + n + ')" title="' + n + ' ' + cssVar(n) + '"></span>'; }).join('') + '<span class="sec-meta">4 · 8 · 12 · 16 · 24 · 32 · 48</span>') +
      spec('radius', ['--r1', '--r2', '--r3', '--r4', '--r-pill'].map(function (n) { return '<span class="box" style="width:64px;height:36px;border-radius:var(' + n + ')">' + n.replace('--', '') + '</span>'; }).join('')) +
      spec('elevation', ['--e1', '--e2', '--e3'].map(function (n, i) { return '<span class="elev" style="box-shadow:var(' + n + ')">' + n.replace('--', '') + ' · ' + ['panel', 'menu, tip', 'dialog'][i] + '</span>'; }).join('')) +
      spec('hit size', '<span class="box" style="width:var(--hit);height:var(--hit)">32</span><span class="sec-meta">every control is at least 32 px; row actions are 32 by 32</span>') + '</div></section>';
    h += '<section class="panel" aria-label="Motion"><div class="panel-h"><h2>Motion</h2></div><div class="panel-b">' + spec('durations', '<span class="sec-meta">--m-fast ' + cssVar('--m-fast') + ' hover and press · --m-med ' + cssVar('--m-med') + ' menus, dialogs, chart dimming · --m-slow ' + cssVar('--m-slow') + ' drawer</span>') + spec('ease', '<span class="mo" aria-hidden="true"></span><span class="sec-meta">hover this row: ' + esc(cssVar('--ease')) + '</span>') +
      '<p class="sec-meta">Motion only explains a change of state. Under prefers-reduced-motion every animation and transition is cut to nothing and the skeleton stops shimmering.</p></div></section></div>';
    var cs = chartSVG(620, 132, { idp: 's' });
    h += '<section class="panel" aria-label="Chart specimens"><div class="panel-h"><h2>Chart specimens</h2></div><div class="panel-b">' +
      spec('timeline', '<div class="tl-chart" style="flex:none;width:620px;max-width:100%;cursor:default">' + cs.svg + '<p class="sr" id="s-desc">A specimen of the timeline above.</p></div>') +
      spec('marks', ['spike', 'emerging', 'first_seen', 'outlier', 'burst'].map(function (s) { return '<span class="check">' + glyphIcon(s) + '<b>' + ({ spike: 'Spike', emerging: 'Emerging', first_seen: 'First seen', outlier: 'Unusual reach', burst: 'Above baseline' })[s] + '</b></span>'; }).join('') + '<span class="sec-meta">shape carries the kind; one ink</span>') +
      spec('gap', '<span class="lg"><i class="sw hatch" style="width:120px;height:14px"></i>not collected</span><span class="sec-meta">a gap is hatched in the channel’s hue, never drawn as zero</span>') +
      spec('sparkbars', S.channels.slice(0, 4).map(function (c) { return '<span class="lg ' + cc(c.label) + '">' + spark(c) + c.label + '</span>'; }).join('')) +
      spec('weight', (demo ? '<span class="r-w" style="width:120px"><span class="wbar"><i style="width:' + Q.weight(demo).score + '%"></i></span><span class="wnum">' + Q.weight(demo).score + '</span></span>' : '') + scoreBar(41) + '<span class="sec-meta">0 to 100, with its reasons on hover</span>') +
      spec('tooltip', '<div class="tip static"><b>04:10 – 05:10, Fri 13 Nov</b><div class="tr c-news"><i class="dot"></i><span>News</span><span class="num">6</span></div><div class="tr c-x"><i class="dot"></i><span>X</span><span class="num">1</span></div><div class="tr tot"><span></span><span>Total</span><span class="num">7</span></div></div>') + '</div></section>';
    h += '<section class="panel" aria-label="Components"><div class="panel-h"><h2>Components</h2><span class="sp"></span><small>every state</small></div><div class="panel-b">' +
      spec('primary', btn('primary', 'Mark as filed', 'noop', { icon: 'check' }) + btn('primary', 'Draft the brief', 'noop', { cost: '1 model call', icon: 'regen' }) + btn('primary', 'Disabled', 'noop', { disabled: true }) + btn('primary', 'Working', 'noop', { busy: true })) +
      spec('secondary', btn('secondary', 'Save', 'noop') + btn('secondary', 'Yesterday', 'noop', { pressed: true }) + btn('secondary', 'Disabled', 'noop', { disabled: true }) + btn('secondary', 'Collecting', 'noop', { busy: true })) +
      spec('quiet', btn('quiet', 'History', 'noop', { icon: 'history' }) + btn('quiet', 'Regenerate', 'noop', { icon: 'regen', cost: '1 call' }) + btn('quiet', 'Disabled', 'noop', { disabled: true })) +
      spec('danger', btn('danger', 'Dismiss', 'noop') + btn('danger', 'Disabled', 'noop', { disabled: true })) +
      spec('row action', btn('row', '', 'noop', { icon: 'pin', aria: 'Pin' }) + btn('row', '', 'noop', { icon: 'pin', aria: 'Pinned', pressed: true }) + btn('row', '', 'noop', { icon: 'aside', aria: 'Set aside' }) + btn('row', '', 'noop', { icon: 'cite', aria: 'Cite' }) + btn('row', '', 'noop', { icon: 'open', aria: 'Open', disabled: true })) +
      spec('chips', chip('', 'neutral') + chip('pos', 'Filed', 'check') + chip('warn', 'Draft') + chip('neg', 'failed') + chip('info', 'Read-only key', 'lock') + chip('accent', 'cited: Summary', 'cite') + chip('solid-neg', 'gap: not collected', 'alert')) +
      spec('citation', (demo ? citeChip(demo.id) : '') + (demo2 ? citeChip(demo2.id) : '') + citeChip('M:99') + '<span class="flag">' + ico('alert') + 'No evidence behind this sentence</span>') +
      spec('facets', '<button type="button" class="facet" aria-pressed="true">All<span class="n">44</span></button><button type="button" class="facet c-news" aria-pressed="false"><i class="dot"></i>News<span class="n">18</span></button><span class="facet gap"><span class="sw hatch"></span>Facebook' + chip('solid-neg', 'not collected') + '</span>') +
      spec('fields', '<label class="field">Reason<input type="text" placeholder="default"></label><label class="field bad">Reason<input type="text" value="x" aria-invalid="true"><span class="hint" style="color:var(--neg)">A reason of three characters or more</span></label><label class="field">Issue<select><option>Ferry levy</option></select></label><label class="field">Disabled<input type="text" disabled value="read-only key"></label>') +
      spec('switch', sw('noop', 'a', true, 'Specimen on') + sw('noop', 'b', false, 'Specimen off') + sw('noop', 'c', true, 'Specimen disabled', true) + '<div class="seg"><button type="button" aria-pressed="true">regular</button><button type="button" aria-pressed="false">compact</button></div>') +
      spec('save state', '<span class="save unsaved"><i></i>unsaved changes</span><span class="save saving"><i></i>saving…</span><span class="save saved"><i></i>saved · revision 4</span><span class="save failed"><i></i>not saved · kept on this computer</span>') +
      spec('stepper', '<div class="stepper" style="margin:0"><div class="step done"><i>✓</i><span>Gathering the window’s evidence</span></div><div class="step on"><i></i><span>Writing ten sections</span></div><div class="step"><i>3</i><span>Checking every citation against its row</span></div></div>') +
      spec('skeleton', '<div style="flex:1;max-width:420px"><span class="skel" style="display:block;height:14px;margin:6px 0;width:90%"></span><span class="skel" style="display:block;height:14px;margin:6px 0;width:60%"></span></div>') +
      spec('console', '<div class="console" style="flex:1;max-width:520px"><div class="ln">queued: Bluesky</div><div class="ln">$ sweep bluesky --desk hf_au</div><div class="ln ok">filed 3 new rows, 6 already held</div><div class="ln fail">failed: no_collector</div><span class="cursor"></span></div>') +
      spec('toast', '<div class="toast"><span>Set aside: Not relevant.</span>' + btn('quiet', 'Undo', 'noop') + '</div><div class="toast warn"><span>This key is read-only: nothing was changed.</span></div>') + '</div></section>';
    h += '<section class="panel" aria-label="Notices and rows"><div class="panel-h"><h2>Notices, rows, empty and error</h2></div><div class="panel-b">' + notice('info', 'Information', '<p>Read-only key: everything is readable.</p>') + notice('pos', 'Success', '<p>Filed by Anne.</p>') + notice('warn', 'Needs a decision', '<p>Kai saved this section while you were editing.</p>', btn('primary', 'Keep mine', 'noop') + btn('secondary', 'Take theirs', 'noop')) + notice('neg', 'A collection gap', '<p>Facebook: not collected. The one fix: start the collector on the Mac.</p>') +
      '<ul class="stream" style="border:1px solid var(--line);border-radius:var(--r2);padding:0;margin-bottom:16px">' + (demo ? rowHTML(demo) : '') + (demo2 ? rowHTML(demo2) : '') + '</ul><div class="grid2">' + emptyState('No rows match', 'An empty state says why, and offers the one action that fixes it.', ['Channel: Mastodon', 'Pinned only'], btn('primary', 'Clear the filters', 'noop')) + emptyState('The window could not be read', 'An error keeps what you had and offers a retry.', null, btn('primary', 'Try again', 'noop', { icon: 'refresh' }), true) + '</div></div></section>';
    return h + '</div>'; }

  /* ---------- dialogs ---------- */
  function dlg(title, body, foot, cls, drawer) { return '<div class="dlg-back' + (drawer ? ' drawer' : '') + '" data-act="backdrop"><div class="dlg ' + (cls || '') + '" role="dialog" aria-modal="true" aria-labelledby="d-dlg-t"><div class="dlg-h"><h2 id="d-dlg-t">' + esc(title) + '</h2>' + btn('row', '', 'closedlg', { icon: 'x', aria: 'Close' }) + '</div><div class="dlg-b">' + body + '</div>' + (foot ? '<div class="dlg-f">' + foot + '</div>' : '') + '</div></div>'; }
  function renderOverlay() { var d = ui.dialog; if (!d) return ''; var r, b = S.brief;
    if (d.type === 'aside') { r = Q.row(d.id); return dlg('Set aside', '<p>“' + esc(r ? r.title : '') + '”</p><p>Why? The reason is kept with the row, and it can be put back.</p><div class="reasons">' + Q.asideReasons().map(function (x, i) { return '<button type="button" class="btn secondary" data-act="asidedo" data-arg="' + esc(x) + '"' + (i === 0 ? ' data-autofocus' : '') + '><kbd>' + (i + 1) + '</kbd><span>' + esc(x) + '</span></button>'; }).join('') + '</div>', btn('quiet', 'Cancel', 'closedlg')); }
    if (d.type === 'mute') return dlg('Mute ' + d.value + ' on this desk?', '<p>That is the third row from this ' + esc(d.kind) + ' you have set aside. Muting leaves its rows out of this desk’s stream and drafts until you unmute it in Options. Other desks are not changed.</p>', btn('quiet', 'Not now', 'closedlg') + btn('primary', 'Mute ' + d.value, 'mutedo', { auto: true }));
    if (d.type === 'regen') { var sx = b.sections[d.id]; return dlg('Regenerate ' + secTitle(d.id), (sx && sx.edited ? notice('warn', 'This replaces your edits to this section', '') : '') + '<p>One section is written again from the same evidence. The other sections are not touched.</p><label class="field">An instruction for this section (optional)<textarea data-in="instr" data-keep="instr" placeholder="Shorter. Lead with the crossbench.">' + esc(d.instr || '') + '</textarea></label><p class="sec-meta" style="margin-top:10px">Model calls today: ' + S.calls.used + ' of ' + S.calls.cap + '</p>', btn('quiet', 'Cancel', 'closedlg') + btn('primary', 'Regenerate', 'regendo', { cost: '1 model call', icon: 'regen', auto: true })); }
    if (d.type === 'draft') { var ed = Object.keys(b.sections).filter(function (k) { return b.sections[k].edited; }).length; return dlg('Draft the brief again?', (ed ? notice('warn', ed + ' edited section' + (ed > 1 ? 's' : '') + ' will be replaced', '<p>The current text stays in History as revision ' + b.revision + '.</p>') : '') + '<p>All ten sections are written again from the window, pinned rows first.</p>' + spendLine(), btn('quiet', 'Cancel', 'closedlg') + btn('secondary', 'Start empty, by hand', 'byhand') + btn('primary', 'Draft the brief', 'draft', { cost: '1 model call', icon: 'regen', auto: true })); }
    if (d.type === 'file') return dlg('Before it is filed', '<p>These checks are neither cited nor named in the brief. A filed brief is final until it is reopened.</p><ul class="unc">' + d.uncovered.map(function (s) { return '<li>' + chip(s.sig === 'gap' ? 'solid-neg' : 'warn', s.label, 'alert') + '<div>' + esc(s.title) + '<small>' + esc(s.detail) + '</small></div></li>'; }).join('') + '</ul>', btn('secondary', 'File anyway', 'fileanyway') + btn('primary', 'Go back and cover them', 'cover', { auto: true }));
    if (d.type === 'history') { var hist = b.history.slice().reverse(), snap = d.rev != null ? ui.snaps[d.rev] : null, body = '<table class="tbl" style="margin-bottom:12px"><thead><tr><th>Revision</th><th>By</th><th>When</th><th></th></tr></thead><tbody>' + hist.map(function (x) { return '<tr><td class="num">' + x.rev + (x.rev === b.revision ? ' ' + chip('accent', 'current') : '') + '</td><td>' + esc(x.by) + '</td><td class="num">' + esc(Q.ago(x.at)) + '</td><td class="r">' + (x.rev === b.revision ? '' : btn('quiet', 'Compare', 'histsel', { id: x.rev, pressed: d.rev === x.rev })) + '</td></tr>'; }).join('') + '</tbody></table>';
      if (d.rev != null) { if (!snap) body += notice('info', 'Revision ' + d.rev + ' was saved before this session', '<p>The prototype holds the text of revisions saved while it has been open. Save once, edit, and compare again.</p>'); else { var diff = Object.keys(b.sections).filter(function (k) { return snap[k] !== b.sections[k].text; }); body += diff.length ? '<p><b style="color:var(--ink-1)">' + diff.length + ' section' + (diff.length > 1 ? 's differ' : ' differs') + ' from revision ' + d.rev + '</b></p>' + diff.map(function (k) { return '<p style="margin:8px 0 2px;color:var(--ink-1);font-weight:600">' + esc(secTitle(k)) + '</p><div class="quote"><small>Revision ' + d.rev + '</small>' + esc(snap[k] || '(empty)') + '</div><div class="quote"><small>Now</small>' + esc(b.sections[k].text || '(empty)') + '</div>'; }).join('') : notice('pos', 'No difference from revision ' + d.rev, ''); } }
      return dlg('History', body, btn('primary', 'Close', 'closedlg', { auto: true }), 'wide'); }
    if (d.type === 'row') { r = Q.row(d.id); if (!r) return dlg('Row', '<p>This row is not in the window.</p>', btn('primary', 'Close', 'closedlg', { auto: true }), '', true); var w = Q.weight(r), ci = Q.citedIn(r.id), wr = canWrite();
      return dlg(r.title, '<p><span class="lg ' + cc(chOf(r)) + '"><i class="sw"></i>' + esc(chOf(r)) + '</span> · <span class="num">' + esc(Q.when(r.t)) + '</span> Australian Eastern time · <span class="num">' + r.id + '</span></p><div class="r-sub" style="margin-bottom:12px">' + rowSub(r) + '</div>' +
        (r.kind === 'social' ? '<p class="sec-meta">The account is not registered as a public actor, so no author is held or shown.</p>' : '') + (r.subscriber ? notice('info', 'Subscriber source', '<p>The text is held apart from the archive. A brief quotes thirty words at most.</p>') : '') +
        '<div class="quote"><small>' + (r.kind === 'narrative' ? 'The claim' : r.kind === 'upcoming' ? 'As written' : 'Held text') + '</small>' + esc(r.claim || r.asWritten || r.text || r.title) + '</div>' + (r.also && r.also.length ? '<p><b style="color:var(--ink-1)">Also carried by</b> ' + esc(r.also.join(', ')) + '</p>' : '') +
        '<p><b style="color:var(--ink-1)">Weight ' + w.score + ' of 100</b> ' + esc(w.why.join(', ') || 'low reach, no check names it') + '</p><p><b style="color:var(--ink-1)">In the brief</b> ' + (ci.length ? esc(ci.map(secTitle).join(', ')) : 'not cited yet') + '</p>',
        (wr ? btn('quiet', S.pins[r.id] ? 'Unpin' : 'Pin', 'pin', { id: r.id, icon: 'pin' }) + (b.status !== 'none' && !filed() ? btn('secondary', 'Cite into ' + secTitle(ui.cur), 'citerow', { id: r.id, icon: 'cite' }) : '') : '') + btn('primary', 'Close', 'closedlg', { auto: true }), '', true); }
    if (d.type === 'help') return dlg('Keyboard shortcuts', '<div class="keys">' + [['j / k', 'Next and previous row in the stream'], ['p', 'Pin or unpin the selected row'], ['x', 'Set the selected row aside (then 1–5 for the reason)'], ['o', 'Open the selected row'], ['c', 'Cite the selected row into the current section, at the caret'], ['u', 'Undo the last pin or set-aside'], ['/', 'Search the stream'], ['← →', 'On the timeline: move a three-hour window'], ['Shift ← →', 'On the timeline: resize the window'], ['Alt 1–6', 'Today, Brief, Watch, Collection, Options, System'], ['Ctrl / Cmd S', 'Save the brief'], ['?', 'This list'], ['Esc', 'Close; leave a field; clear the brush; clear the selection']].map(function (k) { return '<span><kbd>' + k[0] + '</kbd></span><span>' + k[1] + '</span>'; }).join('') + '</div>', btn('primary', 'Close', 'closedlg', { auto: true }));
    if (d.type === 'sample') return dlg('A dialog', '<p>Dialogs trap focus, close on Escape and on the backdrop, and return focus to the control that opened them. The safest action is on the right and takes focus.</p><label class="field">A field<input type="text" placeholder="Tab cycles inside the dialog"></label>', btn('quiet', 'Cancel', 'closedlg') + btn('danger', 'Destructive', 'closedlg') + btn('primary', 'Confirm', 'closedlg', { auto: true }));
    return '';
  }
  function renderToast() { var t = S.toast; if (!t) return ''; var undo = canWrite() && S.undo.length && /^(Set aside|Pinned|Unpinned)/.test(t.text);
    return '<div class="toast ' + (t.kind === 'warn' ? 'warn' : '') + '"><span>' + esc(t.text) + '</span>' + (undo ? btn('quiet', 'Undo', 'undo', { icon: 'undo' }) : '') + btn('row', '', 'toastx', { icon: 'x', aria: 'Dismiss the message' }) + '</div>'; }

  /* ---------- render ---------- */
  function render() {
    ui.route = route(); var body = document.body;
    body.setAttribute('data-route', ui.route); body.setAttribute('data-density', S.options.density || 'regular');
    if (ui.dockOpen) body.setAttribute('data-dock', 'open'); else body.removeAttribute('data-dock');
    document.title = ROUTE_LABEL[ui.route] + ' · ' + Q.desk().name + ' · Anne’s Den (concept D)';
    safe('top bar', $('top'), renderTop); safe('banner', $('banner'), renderBanner);
    if (!ui.drag) safe('timeline', $('tl'), renderTL);
    safe('stream', $('stream'), renderStream); safe('brief', $('dock'), renderDock);
    safe(ui.route, $('page'), function () { return ui.route === 'watch' ? renderWatch() : ui.route === 'collection' ? renderCollection() : ui.route === 'options' ? renderOptions() : ui.route === 'system' ? renderSystem() : ''; });
    safe('dialog', $('overlay'), renderOverlay); safe('toast', $('toast'), renderToast);
    try { showCursor(ui.hover || ui.sel); } catch (e) {}
    var t = S.toast; if (t && t.at !== toastAt) { toastAt = t.at; clearTimeout(toastTimer); toastTimer = setTimeout(function () { if (S.toast && S.toast.at === toastAt) A.clearToast(); }, 5200); }
    var drafting = S.brief.drafting && !S.brief.drafting.dropped; if (drafting && !draftTimer) draftTimer = setInterval(function () { safe('brief', $('dock'), renderDock); }, 1000); if (!drafting && draftTimer) { clearInterval(draftTimer); draftTimer = null; }
    if (S.brief.save === 'saved' && !ui.snaps[S.brief.revision]) snapshot();
    var q = ui.after; ui.after = []; q.forEach(function (fn) { try { fn(); } catch (e) {} });
  }
  function snapshot() { var o = {}; Object.keys(S.brief.sections).forEach(function (k) { o[k] = S.brief.sections[k].text; }); ui.snaps[S.brief.revision] = o; }
  function after(fn) { ui.after.push(fn); }
  function focusRow(id, center) { after(function () { var n = findKey($('stream'), 'row|' + id); if (n) { n.focus({ preventScroll: true }); n.scrollIntoView({ block: center ? 'center' : 'nearest' }); } }); }
  function openDlg(d) { if (!ui.dialog) ui.returnKey = fkey(document.activeElement); ui.dialog = d; ui.menu = null; after(function () { var o = $('overlay'), n = o.querySelector('[data-autofocus]') || o.querySelector('button, input, select, textarea'); if (n) n.focus(); }); render(); }
  function closeDlg() { if (!ui.dialog) return; ui.dialog = null; var k = ui.returnKey; ui.returnKey = null; after(function () { var n = findKey(document, k); if (n) { try { n.focus({ preventScroll: true }); } catch (e) {} } }); render(); }
  function selectRow(id, reveal) { var r = Q.row(id); if (!r) return; ui.sel = id;
    if (!onStream()) { go('today'); reveal = true; }
    if (reveal && streamRows().every(function (x) { return x.id !== id; })) { ui.facet = 'all'; ui.brush = null; ui.search = ''; ui.pinned = false; ui.showAside = false; }
    if (reveal) focusRow(id, true); A.markRead(id); render(); }
  function move(dir) { if (!onStream() || !ui.vis.length) return; var i = ui.vis.indexOf(ui.sel); i = i < 0 ? (dir > 0 ? 0 : ui.vis.length - 1) : clamp(i + dir, 0, ui.vis.length - 1); ui.sel = ui.vis[i]; focusRow(ui.sel); render(); }
  function doCite(id) { if (!canWrite()) { A.say('This key is read-only: nothing was changed.', 'warn'); return; } if (S.brief.status === 'none') { A.say('There is no brief to cite into yet. Draft one, or write by hand.', 'warn'); return; } if (filed()) { A.say('The brief is filed and final. Reopen it to cite.', 'warn'); return; }
    var ta = document.querySelector('textarea[data-in="sectext"][data-id="' + ui.cur + '"]'), pos = ta ? ta.selectionStart : null; A.cite(ui.cur, id, pos); A.say('Cited ' + id + ' into ' + secTitle(ui.cur) + '.'); }
  function doPin(id) { var was = !!S.pins[id]; A.pin(id); if (canWrite()) A.say(was ? 'Unpinned.' : 'Pinned.'); }
  function askAside(id) { if (!canWrite()) { A.say('This key is read-only: nothing was changed.', 'warn'); return; } if (!Q.row(id)) return; openDlg({ type: 'aside', id: id }); }
  function asideDo(reason) { var d = ui.dialog; if (!d || d.type !== 'aside') return; var id = d.id, i = ui.vis.indexOf(id), next = ui.vis[i + 1] || ui.vis[i - 1] || null, res = A.aside(id, reason) || {};
    ui.dialog = null; if (ui.sel === id) ui.sel = next; if (next) focusRow(next);
    if (res.offer) { ui.dialog = { type: 'mute', kind: res.offer.kind, value: res.offer.value }; after(function () { var n = $('overlay').querySelector('[data-autofocus]'); if (n) n.focus(); }); render(); } else A.say('Set aside: ' + reason + '.'); }
  function copyText(text, what) { var done = function () { A.say(what + ' copied.'); }, legacy = function () { var ta = document.createElement('textarea'); ta.value = text; ta.className = 'sr'; ta.setAttribute('aria-hidden', 'true'); document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(ta); if (ok) done(); else A.say('The clipboard could not be reached from this page.', 'warn'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, legacy); else legacy(); }
  function download(name, text, mime) { try { var u = URL.createObjectURL(new Blob([text], { type: mime })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(u); }, 1500); A.say(name + ' downloaded.'); } catch (e) { A.say('The download could not start here.', 'warn'); } }
  function setMode(m) { A.setRole(m === 'readonly' ? 'read' : 'full');
    if (m === 'filed') { A.setMode('normal'); if (!filed()) A.file({ acknowledge: true }); A.say('The brief is filed. Reopen it from the brief.'); return; }
    A.setMode(m); if (m === 'loading') setTimeout(function () { if (S.mode === 'loading') A.setMode('normal'); }, 1800); }

  /* ---------- actions ---------- */
  var ACT = {
    noop: function () {}, rerender: function () { last = new WeakMap(); render(); }, backapp: function () { A.say('In production this returns to AXIOM’s front page. The prototype stands alone.'); },
    go: function (d) { ui.menu = null; go(d.arg); }, help: function () { openDlg({ type: 'help' }); }, retry: function () { A.retry(); },
    deskmenu: function () { ui.menu = ui.menu === 'desk' ? null : 'desk'; if (ui.menu) after(function () { var n = $('top').querySelector('.menu [aria-current]') || $('top').querySelector('.menu-item'); if (n) n.focus(); }); render(); },
    setdesk: function (d) { ui.menu = null; ui.brush = null; ui.sel = null; A.setDesk(d.id); },
    rowsel: function (d) { ui.sel = d.id; A.markRead(d.id); render(); }, selrow: function (d) { selectRow(d.id, true); },
    check: function (d) { var s = Q.signals().filter(function (x) { return x.key === d.id; })[0]; if (!s) return; if (s.sig === 'gap') go('collection'); else selectRow(s.item, true); },
    pin: function (d) { doPin(d.id); }, aside: function (d) { askAside(d.id); }, asidedo: function (d) { asideDo(d.arg); }, citerow: function (d) { doCite(d.id); }, openrow: function (d) { if (d.id) { ui.sel = d.id; openDlg({ type: 'row', id: d.id }); } },
    restore: function (d) { A.restore(d.id); A.say('Put back in the stream.'); }, undo: function () { A.undo(); }, mutedo: function () { var d = ui.dialog; closeDlg(); if (d) A.mute(d.kind, d.value); }, unmute: function (d) { A.unmute(d.id); },
    facet: function (d) { ui.facet = d.arg; render(); }, pinnedonly: function () { ui.pinned = !ui.pinned; render(); }, showaside: function () { ui.showAside = !ui.showAside; render(); },
    clearfilters: function () { ui.facet = 'all'; ui.brush = null; ui.search = ''; ui.pinned = false; ui.showAside = false; last.delete($('stream')); render(); }, clearbrush: function () { ui.brush = null; after(function () { var c = $('d-chart'); if (c) c.focus(); }); render(); },
    yst: function () { ui.yst = !ui.yst; render(); }, dock: function () { ui.dockOpen = !ui.dockOpen; render(); window.requestAnimationFrame(function () { last.delete($('tl')); render(); }); },
    sec: function (d) { var s = Q.sections().filter(function (x) { return x.id === d.id; })[0]; if (s && !s.built) ui.cur = d.id; after(function () { var n = $('sec-' + d.id); if (n) n.scrollIntoView({ block: 'start' }); }); render(); },
    edit: function (d) { if (!canWrite() || filed()) return; ui.editing = d.id; ui.cur = d.id; after(function () { var ta = document.querySelector('textarea[data-keep="ta-' + d.id + '"]'); if (ta) { ta.focus(); try { ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) {} } }); render(); },
    editdone: function () { ui.editing = null; render(); },
    regen: function (d) { openDlg({ type: 'regen', id: d.id, instr: '' }); }, regendo: function () { var d = ui.dialog; closeDlg(); if (d) { if (ui.editing === d.id) ui.editing = null; A.regenerate(d.id, d.instr, function () { A.say(secTitle(d.id) + ' was written again. 1 model call spent.'); }); } },
    draftask: function () { openDlg({ type: 'draft' }); }, draft: function () { ui.dialog = null; ui.editing = null; A.draft(function () { A.say('The draft is ready: ten sections, every citation checked.'); }); render(); },
    byhand: function () { ui.dialog = null; A.byHand(); ui.cur = 'summary'; ACT.edit({ id: 'summary' }); }, checkdraft: function () { A.checkDraft(); },
    save: function () { A.save(); }, file: function () { var r = A.file() || {}; if (r.uncovered) openDlg({ type: 'file', uncovered: r.uncovered }); else if (r.filed) { ui.editing = null; A.say('Filed. The brief is final until it is reopened.'); } },
    fileanyway: function () { ui.dialog = null; ui.editing = null; A.file({ acknowledge: true }); A.say('Filed, with the uncovered checks acknowledged.'); },
    cover: function () { var d = ui.dialog, first = d && d.uncovered.filter(function (s) { return s.item; })[0]; ui.dialog = null; if (route() !== 'brief') go('brief'); if (first) selectRow(first.item, true); else render(); A.say('Select the row and press c to cite it into ' + secTitle(ui.cur) + '.'); },
    reopen: function () { A.reopen(); A.say('Reopened. It is a draft again.'); }, resolve: function (d) { A.resolve(d.arg); A.say(d.arg === 'theirs' ? 'Took theirs.' : 'Kept yours. Save to write it.'); },
    expmenu: function () { ui.menu = ui.menu === 'export' ? null : 'export'; if (ui.menu) after(function () { var n = $('dock').querySelector('.menu-item'); if (n) n.focus(); }); render(); },
    exp: function (d) { ui.menu = null; var name = 'brief-' + S.desk + '-' + S.brief.day; if (d.arg === 'doc') copyText(Q.exportAs('md'), 'The brief, for the document,'); else if (d.arg === 'slack') copyText(Q.exportAs('slack'), 'The Slack summary'); else if (d.arg === 'md') download(name + '.md', Q.exportAs('md'), 'text/markdown'); else download(name + '.html', '<!doctype html><meta charset="utf-8"><title>' + name + '</title>' + Q.exportAs('html'), 'text/html'); render(); },
    history: function () { openDlg({ type: 'history', rev: null }); }, histsel: function (d) { if (ui.dialog) { ui.dialog.rev = ui.dialog.rev === +d.id ? null : +d.id; render(); } },
    closedlg: function () { closeDlg(); }, backdrop: function (d, el, e) { if (e.target === el) closeDlg(); }, toastx: function () { A.clearToast(); },
    wmode: function (d) { ui.w.mode[d.id] = ui.w.mode[d.id] === d.arg ? null : d.arg; if (d.arg === 'dismiss' && ui.w.mode[d.id]) after(function () { var n = document.querySelector('[data-keep="wr-' + d.id + '"]'); if (n) n.focus(); }); render(); },
    wapprove: function (d) { var iss = ui.w.issue[d.id] || ''; A.decide(d.id, 'approve', { issue: iss }); ui.w.mode[d.id] = null; A.say('Approved' + (iss ? ' under ' + issueLabel(iss) : '') + '. Collectors read it from the next sweep.'); },
    wdismiss: function (d) { var r = (ui.w.reason[d.id] || '').trim(); if (r.length < 3) return; A.decide(d.id, 'dismiss', { reason: r }); ui.w.mode[d.id] = null; A.say('Dismissed. It will not be proposed again.'); },
    regtoggle: function (d) { A.toggleRegister(d.id); }, addreg: function () { var v = $('d-addval'); A.say(v && v.value.trim() ? 'Adding “' + v.value.trim() + '” is not wired in this prototype: the shared state has no add action.' : 'Type a value to add.', 'warn'); },
    chtoggle: function (d) { A.toggleChannel(d.id); }, collect: function (d) { A.collect(d.id); },
    opt: function (d) { A.setOption(d.id, d.arg); }, optsw: function (d) { A.setOption(d.id, !S.options[d.id]); },
    mode: function (d) { setMode(d.arg); }, conflict: function () { A.simulateConflict(); go('brief'); A.say('Kai saved the Executive Summary. See the brief.', 'warn'); }, demotoast: function () { A.say('A toast says what happened, once, and leaves.'); }, demodlg: function () { openDlg({ type: 'sample' }); },
    theme: function (d) { document.documentElement.setAttribute('data-theme', d.arg); last = new WeakMap(); render(); }
  };

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (ui.menu && !(e.target.closest && e.target.closest('.menu, [data-act="deskmenu"], [data-act="expmenu"]'))) { ui.menu = null; if (!t) { render(); return; } }
    if (!t || t.disabled || t.getAttribute('aria-disabled') === 'true') return;
    var fn = ACT[t.getAttribute('data-act')]; if (!fn) return;
    try { fn({ id: t.getAttribute('data-id'), arg: t.getAttribute('data-arg') }, t, e); } catch (err) { if (window.console) console.error(err); A.say('That did not work: ' + (err && err.message), 'warn'); }
  });
  function onInput(e) { var t = e.target, k = t.getAttribute && t.getAttribute('data-in'); if (!k) return; var sel = t.tagName === 'SELECT'; if (sel !== (e.type === 'change')) return; var id = t.getAttribute('data-id'), v = t.value;
    if (k === 'search') { ui.search = v; render(); } else if (k === 'sectext') { A.edit(id, v); } else if (k === 'rating') { A.setRating('momentum', id, v); } else if (k === 'cur') { ui.cur = v; render(); }
    else if (k === 'wreason') { ui.w.reason[id] = v; render(); } else if (k === 'wissue') { ui.w.issue[id] = v; render(); } else if (k === 'instr') { if (ui.dialog) ui.dialog.instr = v; } else if (k === 'optnum') { A.setOption(id, Math.max(0, +v || 0)); } }
  document.addEventListener('input', onInput); document.addEventListener('change', onInput);
  function trap(e) { var o = $('overlay'), f = Array.prototype.filter.call(o.querySelectorAll('button, input, select, textarea, [tabindex="0"]'), function (n) { return !n.disabled && n.offsetParent !== null; }); if (!f.length) return; var first = f[0], lastEl = f[f.length - 1];
    if (!o.contains(document.activeElement)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); } else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); } }
  function brushKey(e) { var b = ui.brush, left = e.key === 'ArrowLeft'; e.preventDefault();
    if (!b) b = { from: 3, to: 0 }; else if (e.shiftKey) b = { from: left ? Math.min(24, b.from + 1) : Math.max(b.to + 1, b.from - 1), to: b.to }; else if (left && b.from < 24) b = { from: b.from + 1, to: b.to + 1 }; else if (!left && b.to > 0) b = { from: b.from - 1, to: b.to - 1 };
    ui.brush = b; render(); var lv = $('live'); if (lv) lv.textContent = 'Brushed ' + brushLabel() + ', ' + streamRows().length + ' rows'; }
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''), key = e.key;
    if ((e.metaKey || e.ctrlKey) && String(key).toLowerCase() === 's') { e.preventDefault(); if (S.brief.status !== 'none' && !filed()) A.save(); return; }
    if (e.altKey && /^Digit[1-6]$/.test(e.code || '')) { e.preventDefault(); ui.dialog = null; ui.menu = null; var r = ROUTES[+e.code.slice(5) - 1]; if (route() === r) render(); else go(r); return; }
    if (ui.dialog) { if (key === 'Escape') { e.preventDefault(); closeDlg(); } else if (key === 'Tab') trap(e); else if (ui.dialog.type === 'aside' && !typing && /^[1-5]$/.test(key)) { e.preventDefault(); asideDo(Q.asideReasons()[+key - 1]); } return; }
    if (key === 'Escape') { if (ui.menu) { var m = ui.menu; ui.menu = null; after(function () { var n = document.querySelector('[data-act="' + (m === 'desk' ? 'deskmenu' : 'expmenu') + '"]'); if (n) n.focus(); }); render(); }
      else if (typing) { if (t.getAttribute('data-in') === 'sectext') { var sid = t.getAttribute('data-id'); ui.editing = null; after(function () { var n = findKey($('dock'), 'edit|' + sid + '|'); if (n) n.focus(); }); render(); } else t.blur(); }
      else if (ui.brush) { ui.brush = null; render(); } else if (ui.sel) { ui.sel = null; render(); } return; }
    if (ui.menu && (key === 'ArrowDown' || key === 'ArrowUp')) { var items = Array.prototype.slice.call(document.querySelectorAll('.menu .menu-item')), i = items.indexOf(document.activeElement); if (items.length) { e.preventDefault(); items[(i + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); } return; }
    if (t.id === 'd-chart' && (key === 'ArrowLeft' || key === 'ArrowRight')) { brushKey(e); return; }
    if ((key === 'Enter' || key === ' ') && t.matches && t.matches('[data-act]') && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) { e.preventDefault(); if (key === 'Enter' && t.classList.contains('row')) { ui.sel = t.getAttribute('data-id'); openDlg({ type: 'row', id: ui.sel }); } else t.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (key === '?') { e.preventDefault(); openDlg({ type: 'help' }); return; }
    if (!onStream()) return;
    if (key === 'j') move(1); else if (key === 'k') move(-1); else if (key === '/') { e.preventDefault(); var s = document.querySelector('[data-in="search"]'); if (s) s.focus(); } else if (key === 'u') { if (canWrite()) A.undo(); }
    else if (ui.sel && !ui.showAside) { if (key === 'p') doPin(ui.sel); else if (key === 'x') askAside(ui.sel); else if (key === 'o') openDlg({ type: 'row', id: ui.sel }); else if (key === 'c') doCite(ui.sel); }
    else if (/^[pxoc]$/.test(key)) A.say('Select a row first: j and k move through the stream.');
  });

  /* tooltips and the timeline cursor */
  var tip = $('tip');
  function tipHTML(el) { var k = el.getAttribute('data-tip');
    if (k === 'text') return esc(el.getAttribute('data-tt'));
    if (k === 'sig') { var s = Q.signals().filter(function (x) { return x.key === el.getAttribute('data-id'); })[0]; if (!s) return ''; return '<b>' + esc(s.label + ': ' + s.title) + '</b>' + esc(s.detail) + (s.at != null ? '<div class="tr tot"><span></span><span>' + esc(Q.when(s.at)) + '</span><span>' + (S.brief.status === 'none' ? '' : s.covered ? 'in the brief' : 'not in the brief') + '</span></div>' : '<div class="tr tot"><span></span><span>The whole window. Click for why, and the one fix.</span></div>'); }
    if (k === 'slot') { var h = +el.getAttribute('data-h'), b = hourly().filter(function (x) { return x.h === h; })[0]; if (!b) return ''; var y = Q.yesterdayHourly().filter(function (x) { return x.h === h; })[0], gap = gapSignal();
      return '<b>' + hm(tsOf(h + 1)) + ' – ' + hm(tsOf(h)) + ', ' + esc(dayLabel(tsOf(h + 1))) + '</b>' + CH.filter(function (c) { return b[c]; }).map(function (c) { return '<div class="tr ' + cc(c) + '"><i class="dot"></i><span>' + c + '</span><span class="num">' + b[c] + '</span></div>'; }).join('') + (gap ? '<div class="tr c-facebook"><i class="dot"></i><span>Facebook</span><span>not collected</span></div>' : '') +
        '<div class="tr tot"><span></span><span>Total rows</span><span class="num">' + total(b) + '</span></div>' + (ui.yst && y ? '<div class="tr"><span></span><span>Yesterday, same hour</span><span class="num">' + y.total + '</span></div>' : ''); }
    return ''; }
  function placeTip(x, y) { var w = tip.offsetWidth, h = tip.offsetHeight, vx = window.innerWidth, vy = window.innerHeight; var lx = x + 14, ly = y + 16; if (lx + w > vx - 8) lx = Math.max(8, x - w - 14); if (ly + h > vy - 8) ly = Math.max(8, y - h - 14); tip.style.left = lx + 'px'; tip.style.top = ly + 'px'; }
  function showTip(el, x, y) { var html = tipHTML(el); if (!html) { tip.hidden = true; return; } tip.innerHTML = html; tip.hidden = false; placeTip(x, y); }
  document.addEventListener('mouseover', function (e) { if (ui.drag || !e.target.closest) return; var t = e.target.closest('[data-tip]'); if (t) showTip(t, e.clientX, e.clientY); else tip.hidden = true;
    var c = e.target.closest('[data-cite]'), id = c ? c.getAttribute('data-cite') : null; if (id !== ui.hover) { ui.hover = id; try { showCursor(ui.hover || ui.sel); } catch (er) {} } });
  document.addEventListener('mousemove', function (e) { if (!tip.hidden && !ui.drag) placeTip(e.clientX, e.clientY); });
  document.addEventListener('focusin', function (e) { var t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) { var r = t.getBoundingClientRect(); showTip(t, r.left + r.width / 2, r.bottom); } });
  document.addEventListener('focusout', function () { tip.hidden = true; });
  document.addEventListener('scroll', function () { tip.hidden = true; }, true);

  /* brushing */
  var tl = $('tl');
  tl.addEventListener('pointerdown', function (e) { var ch = e.target.closest && e.target.closest('#d-chart'); if (!ch || e.button !== 0 || !geom || e.target.closest('.mark')) return; var svg = ch.querySelector('svg'); if (!svg) return; var rect = svg.getBoundingClientRect(), g = geom;
    var tAt = function (cx) { return clamp(24 - ((cx - rect.left) * (g.W / rect.width) - g.pl) / g.pw * 24, 0, 24); };
    ui.drag = { x0: e.clientX, t0: tAt(e.clientX), tAt: tAt, moved: false, from: null, to: null }; tip.hidden = true; try { ch.setPointerCapture(e.pointerId); } catch (er) {} });
  tl.addEventListener('pointermove', function (e) { var d = ui.drag; if (!d) return; if (Math.abs(e.clientX - d.x0) > 4) d.moved = true; if (!d.moved) return; var t1 = d.tAt(e.clientX), from = Math.ceil(Math.max(d.t0, t1)), to = Math.floor(Math.min(d.t0, t1)); if (from <= to) from = to + 1; if (from > 24) { from = 24; to = Math.min(to, 23); } d.from = from; d.to = to;
    var b = $('d-brush'); if (b) { b.setAttribute('x', f1(geom.x(from))); b.setAttribute('width', f1(geom.x(to) - geom.x(from))); b.setAttribute('visibility', 'visible'); } });
  function endDrag(e) { var d = ui.drag; if (!d) return; ui.drag = null; if (e.type === 'pointercancel') { render(); return; } if (d.moved && d.from != null) ui.brush = { from: d.from, to: d.to }; else if (ui.brush) ui.brush = null; last.delete(tl); render(); }
  tl.addEventListener('pointerup', endDrag); tl.addEventListener('pointercancel', endDrag);

  var rz = null; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(render, 80); });
  window.addEventListener('hashchange', function () { ui.menu = null; render(); window.requestAnimationFrame(function () { if (onStream()) { last.delete($('tl')); render(); } }); });
  D.on(render);
  snapshot();
  render();
})();
