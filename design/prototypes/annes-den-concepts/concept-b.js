/* Anne's Den - Concept B, The Front Page.
 * The window as a newspaper edition: ranked by weight, the brief as the facing page.
 * Renders window.DEN (shared.js) and nothing else; every mutation goes through DEN.a.
 * No framework, no network. The whole app is rendered to a string and patched into the page (morph), so a
 * textarea the person is typing in is never re-created. */
(function () {
  'use strict';
  var D = window.DEN, app = document.getElementById('app');
  if (!D) { app.innerHTML = '<p class="boot" role="alert">shared.js did not load, so there is no data to set an edition from.</p>'; return; }
  var S = D.state, Q = D.q, A = D.a;

  var ROUTES = [
    { id: 'today', label: 'Edition' }, { id: 'brief', label: 'Brief' }, { id: 'watch', label: 'Watch' },
    { id: 'collection', label: 'Collection' }, { id: 'options', label: 'Options' }, { id: 'system', label: 'Design system' }];
  var NOISE_UNDER = 12;
  var SIG_TONE = { gap: 'warn', spike: 'neg', emerging: 'accent', first_seen: 'info', outlier: 'info', burst: 'warn' };
  var SIG_CHECK = { spike: 0, emerging: 1, first_seen: 2, burst: 3, outlier: 4, gap: 5 };
  var DRAFT_STAGES = ['Gathering the window\'s evidence', 'Writing ten sections', 'Checking every citation against its row'];
  var KIND_WORD = { media: 'Media', social: 'Social', actor: 'Public actor', narrative: 'Narrative', upcoming: 'Diary' };

  var ui = {
    route: 'today', sel: null, sec: 'summary', caret: null, caretSec: null, pendingCaret: null,
    search: '', issue: '', pinnedOnly: false, noise: false, showAside: false,
    dialog: null, menu: null, pane: 'report', ff: 'all', regKind: 'term',
    pv: {}, dm: {}, dr: {}, ai: {}, focusSec: false, focusSel: false, undoAt: 0,
    wide: false, facing: false, theme: document.documentElement.getAttribute('data-theme') || 'light', themePref: 'auto'
  };
  try { ui.themePref = localStorage.getItem('den_b_theme') || 'auto'; } catch (e) {}

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function short(s, n) { s = String(s || ''); n = n || 60; return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : s; }
  function RO() { return S.role === 'read'; }
  function issueLabel(id) { var x = Q.issues().filter(function (i) { return i.id === id; })[0]; return x ? x.label : ''; }
  function sec(id) { return Q.sections().filter(function (s) { return s.id === id; })[0] || null; }
  function secTitle(id) { var s = sec(id); return s ? s.title : id; }
  function secShort(id) { return secTitle(id).split(' ').slice(0, 2).join(' ').replace(/ and$/, ''); }
  function editable() { return !RO() && S.brief.status === 'draft'; }
  function sigFor(id) { return Q.signals().filter(function (s) { return s.item === id; }); }
  function fmtDate(iso, o) { try { return new Date(iso + 'T12:00:00+11:00').toLocaleDateString('en-AU', Object.assign({ timeZone: 'Australia/Sydney' }, o || { day: 'numeric', month: 'short' })); } catch (e) { return iso; } }
  function daysUntil(iso) { return Math.ceil((new Date(iso + 'T00:00:00+11:00').getTime() - S.now) / 864e5); }
  function editionDate() { return new Date(S.now).toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  function toneWord(t) { return t <= -0.3 ? 'hostile' : t >= 0.3 ? 'supportive' : 'mixed'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }

  var IC = {
    back: '<path d="M15 6l-6 6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>', right: '<path d="M9 6l6 6-6 6"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3-1-6z"/><path d="M12 13v7"/>',
    tray: '<path d="M4 13l2-8h12l2 8"/><path d="M4 13v5a1 1 0 001 1h14a1 1 0 001-1v-5h-5a3 3 0 01-6 0H4z"/>',
    open: '<path d="M8 16L17 7"/><path d="M9 7h8v8"/>',
    quote: '<path d="M5 17c2 0 4-2 4-5V7H5v5h2"/><path d="M14 17c2 0 4-2 4-5V7h-4v5h2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2"/><path d="M12 17h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', alert: '<path d="M12 4l9 16H3L12 4z"/><path d="M12 10v4M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', undo: '<path d="M9 7L5 11l4 4"/><path d="M5 11h9a5 5 0 010 10h-3"/>',
    download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>', copy: '<rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M5 15V6a1 1 0 011-1h9"/>',
    lock: '<rect x="6" y="11" width="12" height="9" rx="1.5"/><path d="M9 11V8a3 3 0 016 0v3"/>', refresh: '<path d="M19 8a8 8 0 10.9 6"/><path d="M19 3v5h-5"/>',
    play: '<path d="M8 5l11 7-11 7V5z"/>', flask: '<path d="M10 3h4M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>',
    history: '<path d="M4 12a8 8 0 108-8 8 8 0 00-6 2.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    flag: '<path d="M6 21V4"/><path d="M6 5h11l-2 4 2 4H6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>', eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
    file: '<path d="M7 3h7l4 4v14H7V3z"/><path d="M14 3v4h4"/>', mute: '<path d="M4 10v4h3l5 4V6l-5 4H4z"/><path d="M16 9l5 6M21 9l-5 6"/>', plus: '<path d="M12 5v14M5 12h14"/>'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (IC[n] || '') + '</svg>'; }
  function chip(text, tone, extra) { return '<span class="chip chip-' + (tone || 'neutral') + '"' + (extra || '') + '>' + esc(text) + '</span>'; }
  function btn(cls, act, label, o) {
    o = o || {};
    return '<button type="button" class="btn ' + cls + '" data-act="' + act + '"' + (o.id != null ? ' data-id="' + esc(o.id) + '"' : '') + (o.v != null ? ' data-v="' + esc(o.v) + '"' : '') +
      (o.disabled ? ' disabled' : '') + (o.aria ? ' aria-label="' + esc(o.aria) + '"' : '') + (o.auto ? ' data-autofocus="1"' : '') + (o.attrs || '') + '>' +
      (o.icon ? ic(o.icon) : '') + '<span>' + esc(label) + '</span>' + (o.cost ? '<span class="cost">' + esc(o.cost) + '</span>' : '') + '</button>';
  }
  function ra(act, id, label, icon, pressed, text) {
    return '<button type="button" class="ra' + (pressed ? ' is-on' : '') + (text ? ' ra-text' : '') + '" data-act="' + act + '" data-id="' + esc(id) + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' +
      (pressed != null ? ' aria-pressed="' + (pressed ? 'true' : 'false') + '"' : '') + '>' + ic(icon) + (text ? '<span>' + esc(text) + '</span>' : '') + '</button>';
  }
  function notice(tone, title, body, actions) {
    return '<div class="notice notice-' + tone + '" role="' + (tone === 'neg' || tone === 'warn' ? 'alert' : 'status') + '">' + ic(tone === 'pos' ? 'check' : 'alert') +
      '<div class="notice-b"><strong>' + esc(title) + '</strong>' + (body ? '<p>' + body + '</p>' : '') + '</div>' + (actions ? '<div class="notice-a">' + actions + '</div>' : '') + '</div>';
  }
  function statePanel(kind, title, why, actions) {
    return '<div class="state state-' + kind + '" role="' + (kind === 'error' ? 'alert' : 'status') + '"><div class="state-mark" aria-hidden="true">' + ic(kind === 'error' ? 'alert' : 'file') + '</div>' +
      '<h2>' + esc(title) + '</h2><p>' + why + '</p>' + (actions ? '<div class="state-a">' + actions + '</div>' : '') + '</div>';
  }
  function errPanel(title, why) { return statePanel('error', title, why, btn('btn-primary', 'retry', 'Try again', { icon: 'refresh' })); }
  function sk(w, h, cls) { return '<span class="sk ' + (cls || '') + '" style="width:' + w + ';height:' + h + '"></span>'; }

  /* ---------- the edition: ranking ---------- */
  function ranked() {
    var f = {}; if (ui.search) f.search = ui.search; if (ui.issue) f.issue = ui.issue; if (ui.pinnedOnly) f.pinned = true;
    var min = Number(S.options.minInteractions) || 0;
    var rows = Q.rows(f), items = [], narr = [], diary = [];
    rows.forEach(function (r) {
      if (r.kind === 'narrative') narr.push(r); else if (r.kind === 'upcoming') diary.push(r); else items.push({ r: r, w: Q.weight(r) });
    });
    items.sort(function (a, b) { return b.w.score - a.w.score || a.r.t - b.r.t; });
    diary.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var main = [], noise = [];
    items.forEach(function (x) { var quiet = x.r.low || x.w.score < NOISE_UNDER || (x.r.kind === 'social' && (x.r.eng || 0) < min); (quiet && !S.pins[x.r.id] ? noise : main).push(x); });
    var nTier = ui.wide ? 4 : 3;
    return { all: items, lead: main[0] || null, tier: main.slice(1, 1 + nTier), brief: main.slice(1 + nTier), noise: noise, narr: narr, diary: diary, filtered: !!(ui.search || ui.issue || ui.pinnedOnly) };
  }
  function citeLabel(r) {
    if (r.kind === 'media') return r.outlet; if (r.kind === 'social') return r.channel + ' post'; if (r.kind === 'actor') return r.who;
    if (r.kind === 'narrative') return 'Narrative'; return 'Diary, ' + fmtDate(r.date);
  }
  function metaLine(r) {
    var b = [];
    if (r.kind === 'media') { b.push('<b>' + esc(r.outlet) + '</b>'); b.push(esc(r.tier)); }
    else if (r.kind === 'social') { b.push('<b>' + esc(r.channel) + ' post</b>'); b.push('found by ' + esc(r.foundBy)); }
    else if (r.kind === 'actor') { b.push('<b>' + esc(r.who) + '</b>'); b.push(esc(r.role)); b.push('on ' + esc(r.channel)); }
    else if (r.kind === 'narrative') { b.push('<b>Narrative</b>'); b.push(plural(r.n, 'row')); }
    else if (r.kind === 'upcoming') { b.push('<b>' + esc(fmtDate(r.date, { day: 'numeric', month: 'long' })) + '</b>'); b.push(esc(r.what)); }
    if (r.kind !== 'upcoming') b.push('<time>' + esc(Q.when(r.t)) + '</time>');
    return b.join('<span class="sep" aria-hidden="true"> · </span>');
  }
  function statList(r) {
    var o = [];
    if (r.kind === 'media') { o.push([String(r.outlets || 1), (r.outlets || 1) > 1 ? 'outlets' : 'outlet']); o.push([Q.fmt(r.fb), 'Facebook reactions']); }
    else if (r.kind === 'narrative') { o.push([String(r.n), 'rows']); o.push([String(r.n24), 'in the last day']); }
    else if (r.kind !== 'upcoming') {
      o.push([Q.fmt(r.eng), 'interactions']); if (r.growth) o.push(['+' + Q.fmt(r.growth), 'since yesterday']); if (r.comments) o.push([Q.fmt(r.comments), 'comments held']);
    }
    return o;
  }
  function marks(r, o) {
    o = o || {}; var h = '';
    sigFor(r.id).forEach(function (s) { h += chip(s.label, SIG_TONE[s.sig], ' title="' + esc(s.title + '. ' + s.detail) + '"'); });
    if (r.subscriber) h += chip('Subscriber', 'neutral', ' title="Read through a cleared subscription: a brief quotes no more than thirty words"');
    if (r.opinion) h += chip('Opinion', 'neutral');
    if (r.mp) h += chip('Sitting member', 'info', ' title="A public official speaking in office: named on their own post"');
    if (r.kind === 'actor' && !r.mp) h += chip('Registered actor', 'neutral', ' title="Named because the watch register marks this account as a public actor"');
    if (r.recorded) h += chip('Recorded', 'pos', ' title="From the process calendar, not read from a sentence"');
    if (S.pins[r.id] && !o.noPin) h += chip('Pinned', 'accent');
    var ci = Q.citedIn(r.id); if (ci.length) h += chip('Cited: ' + ci.map(secShort).join(', '), 'pos');
    return h;
  }
  function wt(w, big) {
    return '<span class="wt' + (big ? ' wt-big' : '') + '" title="Weight ' + w.score + ' of 100' + (w.why.length ? ': ' + esc(w.why.join(', ')) : '') + '"><span class="wt-n">' + w.score + '</span>' +
      '<span class="wt-bar" aria-hidden="true"><i style="width:' + w.score + '%"></i></span><span class="vh">weight of 100</span></span>';
  }
  function whyLine(w) { return w.why.length ? '<p class="why"><span class="why-l">Why it ranks</span> ' + w.why.map(esc).join('<span class="sep" aria-hidden="true"> · </span>') + '</p>' : '<p class="why"><span class="why-l">Why it ranks</span> recency only</p>'; }
  function itemActs(r, o) {
    o = o || {}; var t = short(r.title, 50), h = '<div class="acts">';
    if (!RO()) {
      h += ra('cite', r.id, 'Cite into ' + secTitle(ui.sec) + ': ' + t, 'quote', null, o.citeText ? 'Cite' : '');
      h += ra('pin', r.id, (S.pins[r.id] ? 'Unpin: ' : 'Pin: ') + t, 'pin', !!S.pins[r.id]);
      h += ra('aside', r.id, 'Set aside: ' + t, 'tray');
    }
    h += ra('open', r.id, 'Open: ' + t, 'eye');
    return h + '</div>';
  }
  function itemAttrs(r, cls) {
    return 'class="item ' + cls + (ui.sel === r.id ? ' is-sel' : '') + (S.pins[r.id] ? ' is-pinned' : '') + '" data-key="i:' + esc(r.id) + '" data-item="' + esc(r.id) + '" data-act="sel" data-id="' + esc(r.id) + '" tabindex="0"' + (ui.sel === r.id ? ' aria-current="true"' : '');
  }
  function leadHTML(x) {
    var r = x.r, st = statList(r);
    var deck = r.kind === 'media' ? r.text.slice(r.title.length + 2) : (r.comments ? 'The tone of ' + Q.fmt(r.comments) + ' held comments is ' + toneWord(r.tone) + '.' : '');
    var h = '<article ' + itemAttrs(r, 'lead') + ' aria-label="Lead item: ' + esc(r.title) + '"><div class="lead-main">' +
      '<p class="kicker"><span class="kick">The lead</span><span class="kick-i">' + esc(issueLabel(r.issue)) + '</span>' + marks(r) + '</p>' +
      '<h2 class="lead-h">' + esc(r.title) + '</h2>' + (deck ? '<p class="deck">' + esc(deck) + '</p>' : '') +
      '<p class="meta">' + metaLine(r) + '</p>' + itemActs(r, { citeText: true }) + '</div>' +
      '<div class="lead-side"><dl class="stats">' + st.map(function (s) { return '<div class="stat"><dt>' + esc(s[1]) + '</dt><dd>' + esc(s[0]) + '</dd></div>'; }).join('') + '</dl>';
    if (r.also && r.also.length) h += '<p class="carried"><span class="lbl">Carried by</span> ' + esc(r.outlet) + ', ' + r.also.map(esc).join(', ') + (S.options.fold ? ' <span class="dim">(copies folded into one item)</span>' : '') + '</p>';
    h += '<div class="lead-w"><span class="lbl">Weight</span>' + wt(x.w, true) + whyLine(x.w) + '</div></div></article>';
    return h;
  }
  function tierHTML(x) {
    var r = x.r, st = statList(r).slice(0, 2);
    return '<article ' + itemAttrs(r, 'tier-item') + '><p class="kicker"><span class="kick-i">' + esc(issueLabel(r.issue)) + '</span>' + marks(r) + '</p>' +
      '<h3 class="tier-h">' + esc(r.title) + '</h3><p class="meta">' + metaLine(r) + '</p>' +
      '<p class="tier-stats">' + st.map(function (s) { return '<span><b>' + esc(s[0]) + '</b> ' + esc(s[1]) + '</span>'; }).join('') + '</p>' +
      '<div class="tier-w">' + wt(x.w) + whyLine(x.w) + '</div>' + itemActs(r) + '</article>';
  }
  function briefRowHTML(x, quiet) {
    var r = x.r, st = statList(r)[r.kind === 'media' ? 1 : 0];
    return '<article ' + itemAttrs(r, 'ib' + (quiet ? ' ib-quiet' : '')) + '>' + wt(x.w) +
      '<div class="ib-b"><h4 class="ib-h">' + esc(r.title) + '</h4><p class="meta">' + metaLine(r) + (st ? '<span class="sep" aria-hidden="true"> · </span>' + esc(st[0]) + ' ' + esc(st[1]) : '') + '</p>' +
      (marks(r) ? '<p class="markrow">' + marks(r) + '</p>' : '') + '</div>' + itemActs(r) + '</article>';
  }
  function narrHTML(r) {
    var w = Q.weight(r);
    return '<article ' + itemAttrs(r, 'story') + '><p class="kicker">' + chip(r.status, r.status === 'emerging' ? 'accent' : r.status === 'growing' ? 'warn' : 'neutral') +
      chip(r.side === 'hostile' ? 'Hostile to the client' : r.side === 'supportive' ? 'Supportive' : 'Mixed', r.side === 'hostile' ? 'neg' : r.side === 'supportive' ? 'pos' : 'neutral') + marks(r, {}) + '</p>' +
      '<h3 class="story-h">' + esc(r.title) + '</h3><p class="story-c">' + esc(r.claim) + '</p>' +
      '<p class="meta"><b>' + r.n + ' rows</b>, ' + r.n24 + ' in the last day<span class="sep" aria-hidden="true"> · </span>' + esc(issueLabel(r.issue)) + '</p>' +
      '<p class="spread" aria-label="Spread in order: ' + esc(r.spread.join(', then ')) + '">' + r.spread.map(function (s) { return '<span>' + esc(s) + '</span>'; }).join(ic('right')) + '</p>' +
      '<div class="story-f">' + wt(w) + itemActs(r) + '</div></article>';
  }
  function diaryHTML(r) {
    var d = daysUntil(r.date);
    return '<article ' + itemAttrs(r, 'diary') + '><div class="diary-d" aria-hidden="true"><b>' + esc(fmtDate(r.date, { day: 'numeric' })) + '</b><span>' + esc(fmtDate(r.date, { month: 'short' })) + '</span></div>' +
      '<div class="diary-b"><p class="kicker"><span class="kick-i">' + esc(r.what) + '</span>' + chip(d <= 0 ? 'today' : 'in ' + plural(d, 'day'), d <= 7 ? 'warn' : 'neutral') + marks(r) + '</p>' +
      '<h3 class="diary-h">' + esc(r.title) + '<span class="vh">, ' + esc(fmtDate(r.date, { day: 'numeric', month: 'long', year: 'numeric' })) + '</span></h3>' +
      '<p class="diary-q">As written: "' + esc(r.asWritten) + '" ' + citeChip(r.from) + '</p>' + itemActs(r) + '</div></article>';
  }

  /* ---------- shared blocks ---------- */
  function gapBanner(compact) {
    var gaps = Q.signals().filter(function (s) { return s.sig === 'gap'; });
    if (!gaps.length) {
      if (S.mode === 'loading') return '';
      return '<div class="nogap" role="status">' + ic('check') + '<span><b>No collection gap in this window.</b> Every channel this desk relies on delivered, or is quiet for a stated reason. ' +
        '<a href="#collection">See Collection</a></span></div>';
    }
    return gaps.map(function (g) {
      return '<div class="gapbanner' + (compact ? ' gapbanner-c' : '') + '" role="alert" data-key="gap:' + esc(g.key) + '"><div class="gap-tag">' + ic('alert') + '<span>' + esc(g.label) + '</span></div>' +
        '<div class="gap-b"><strong>' + esc(g.title) + '</strong><span class="gap-not">A gap, not a quiet day.</span>' + (compact ? '' : '<p>' + esc(g.detail) + '</p>') + '</div>' +
        '<div class="gap-a">' + (g.covered ? chip('Named in the brief', 'pos') : chip('Not yet named in the brief', 'warn-solid')) +
        '<a class="btn btn-secondary btn-sm" href="#collection" data-act="tocoll" data-id="' + esc(g.channel || '') + '">' + ic('right') + '<span>Why, and the one fix</span></a></div></div>';
    }).join('');
  }
  function busyNotice() {
    if (S.mode !== 'busy') return '';
    return notice('warn', 'The database is busy', 'What is on screen was read a moment ago. Nothing is lost: saving keeps your words on this computer and tries again.', btn('btn-secondary btn-sm', 'retry', 'Read again', { icon: 'refresh' }));
  }
  function citeChip(id) {
    var r = Q.row(id);
    if (!r) return '<span class="cite cite-bad" title="This id is not in the window\'s evidence">' + ic('alert') + '<span class="cite-k">' + esc(id) + '</span> not in the evidence</span>';
    var w = Q.weight(r);
    return '<button type="button" class="cite cite-' + r.kind + '" data-act="goto" data-id="' + esc(id) + '" aria-label="Citation ' + esc(id) + ': ' + esc(citeLabel(r)) + ', ' + esc(short(r.title, 80)) + '. Show the item.">' +
      '<span class="cite-k">' + esc(id.charAt(0)) + '</span><span class="cite-l">' + esc(citeLabel(r)) + '</span>' +
      '<span class="cite-card" role="tooltip"><span class="cc-k">' + esc(KIND_WORD[r.kind]) + ' · ' + esc(id) + '</span><span class="cc-t">' + esc(short(r.title, 110)) + '</span>' +
      '<span class="cc-m">' + esc(r.outlet || r.channel || '') + (r.kind === 'upcoming' ? esc(fmtDate(r.date, { day: 'numeric', month: 'long' })) : ' · ' + esc(Q.when(r.t))) + ' · weight ' + w.score + '</span></span></button>';
  }
  function proseText(text, flags) {
    if (!String(text || '').trim()) return '<p class="prose prose-empty">Nothing written yet.</p>';
    return '<p class="prose">' + Q.sentences(text).map(function (sen) {
      var fl = (flags || []).filter(function (f) { return f.sentence === sen; });
      var inner = esc(sen).replace(/\[([A-Z]:\d+)\]/g, function (m, id) { return citeChip(id); });
      if (!fl.length) return '<span class="sen">' + inner + '</span>';
      return '<span class="flagged"><span class="flagged-t">' + inner + '</span>' + fl.map(function (f) { return '<span class="flag" role="note">' + ic('flag') + esc(f.text) + '</span>'; }).join('') + '</span>';
    }).join(' ') + '</p>';
  }

  /* ---------- chrome ---------- */
  function deskState(d) { return d.id === S.desk ? S.brief.status : d.brief; }
  function stateChip(s) { return s === 'filed' ? chip('Filed', 'pos-solid') : s === 'draft' ? chip('Draft', 'warn') : chip('Not started', 'neutral'); }
  function masthead() {
    var d = Q.desk(), desks = Q.desks(), filed = desks.filter(function (x) { return deskState(x) === 'filed'; }).length;
    var h = '<header class="mast"><div class="mast-row">' +
      '<button type="button" class="back" data-act="back">' + ic('back') + '<span>Back to AXIOM</span></button>' +
      '<div class="nameplate"><span class="np-t">Anne\'s Den</span><span class="np-s">' + esc(Q.client().name) + '</span></div>' +
      '<div class="menu-wrap desk"><button type="button" class="desk-btn" data-act="menu" data-id="desk" aria-haspopup="true" aria-expanded="' + (ui.menu === 'desk' ? 'true' : 'false') + '" aria-label="Desk: ' + esc(d.name) + '. ' + filed + ' of ' + desks.length + ' desks filed. Change desk.">' +
      '<span class="desk-l">Desk</span><span class="desk-n">' + esc(d.name) + '</span>' + stateChip(deskState(d)) +
      '<span class="desk-dots" aria-hidden="true">' + desks.map(function (x) { return '<i class="dot dot-' + deskState(x) + (x.id === d.id ? ' dot-on' : '') + '"></i>'; }).join('') + '</span>' + ic('down') + '</button>';
    if (ui.menu === 'desk') {
      h += '<div class="menu menu-desk" role="menu" aria-label="Desks"><p class="menu-h">' + filed + ' of ' + desks.length + ' desks filed today</p>' + desks.map(function (x) {
        return '<button type="button" role="menuitemradio" aria-checked="' + (x.id === d.id ? 'true' : 'false') + '" class="menu-item desk-item" data-act="desk" data-id="' + esc(x.id) + '">' +
          '<span class="di-n">' + esc(x.name) + '</span><span class="di-m">' + esc(x.cadence) + ' · ' + x.rows + ' rows' + '</span>' +
          '<span class="di-c">' + (x.gaps ? chip(plural(x.gaps, 'gap'), 'warn-solid') : '') + stateChip(deskState(x)) + '</span></button>';
      }).join('') + '</div>';
    }
    h += '</div><p class="winlabel" title="' + esc(Q.windowLabel()) + '">' + esc(Q.windowLabel()) + '</p><span class="grow"></span>';
    if (S.mode !== 'normal') h += chip('demo state: ' + S.mode, 'info', ' title="Set with ?state= or in the demo menu"');
    if (RO()) h += '<span class="chip chip-neutral-solid" role="status">' + ic('lock') + 'Read-only key</span>';
    h += '<p class="calls" title="Each draft or regeneration is one model call">model calls today: <b>' + S.calls.used + '</b> of ' + S.calls.cap + '</p>' +
      '<div class="menu-wrap"><button type="button" class="iconbtn" data-act="menu" data-id="demo" aria-haspopup="true" aria-expanded="' + (ui.menu === 'demo' ? 'true' : 'false') + '" aria-label="Prototype demo states" title="Prototype demo states">' + ic('flask') + '</button>';
    if (ui.menu === 'demo') {
      h += '<div class="menu menu-right" role="menu" aria-label="Demo states"><p class="menu-h">Prototype only: show a state</p>' +
        ['normal', 'loading', 'empty', 'error', 'busy', 'dropped', 'readonly', 'filed', 'nogap'].map(function (m) {
          return '<button type="button" role="menuitemradio" aria-checked="' + (S.mode === m ? 'true' : 'false') + '" class="menu-item" data-act="mode" data-id="' + m + '">' + m + '</button>';
        }).join('') + '<hr><button type="button" role="menuitem" class="menu-item" data-act="conflict">Simulate a save conflict</button>' +
        '<button type="button" role="menuitem" class="menu-item" data-act="simmute">Simulate the mute offer</button></div>';
    }
    h += '</div><button type="button" class="iconbtn" data-act="theme" aria-label="Switch to the ' + (ui.theme === 'dark' ? 'light' : 'dark') + ' theme" title="Switch to the ' + (ui.theme === 'dark' ? 'light' : 'dark') + ' theme">' + ic(ui.theme === 'dark' ? 'sun' : 'moon') + '</button>' +
      '<button type="button" class="iconbtn" data-act="help" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">' + ic('help') + '</button></div>';
    h += '<div class="mast-row mast-nav"><nav class="nav" aria-label="Anne\'s Den views">' + ROUTES.map(function (r, i) {
      var badge = '';
      if (r.id === 'brief') { var fc = S.brief.status === 'draft' ? Q.flagCount() : 0; if (fc) badge = '<span class="nav-b nav-b-warn" title="' + plural(fc, 'flagged sentence') + '">' + fc + '</span>'; }
      if (r.id === 'watch') { var pc = S.proposals.filter(function (p) { return p.status === 'proposed'; }).length; if (pc) badge = '<span class="nav-b" title="' + plural(pc, 'proposal') + ' waiting">' + pc + '</span>'; }
      if (r.id === 'collection') { var gc = S.channels.filter(function (c) { return c.state === 'gap'; }).length; if (gc && S.mode !== 'nogap') badge = '<span class="nav-b nav-b-warn" title="' + plural(gc, 'gap') + '">' + gc + '</span>'; }
      return '<a href="#' + r.id + '"' + (ui.route === r.id ? ' aria-current="page"' : '') + (i < 5 ? ' title="Alt+' + (i + 1) + '"' : '') + '>' + esc(r.label) + badge + '</a>';
    }).join('') + '</nav><p class="dateline">' + esc(editionDate()) + '<span class="sep" aria-hidden="true"> · </span>' + (S.mode === 'loading' ? 'reading the window' : plural(Q.rows({}).length, 'row') + ' in the window') + '</p></div></header>';
    return h;
  }

  /* ---------- #today ---------- */
  function toolbar() {
    var c = Q.counts();
    var h = '<div class="toolbar" role="toolbar" aria-label="Edition filters"><label class="field field-search"><span class="vh">Search the edition</span>' + ic('search') +
      '<input type="search" data-in="search" value="' + esc(ui.search) + '" placeholder="Search headlines, outlets, actors"></label>' +
      '<label class="field"><span class="field-l">Issue</span><select data-ch="issue"><option value="">Every issue</option>' + Q.issues().map(function (i) { return '<option value="' + i.id + '"' + (ui.issue === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' +
      '<button type="button" class="btn btn-quiet btn-sm' + (ui.pinnedOnly ? ' is-on' : '') + '" data-act="pinnedonly" aria-pressed="' + (ui.pinnedOnly ? 'true' : 'false') + '">' + ic('pin') + '<span>Pinned only (' + c.pinned + ')</span></button>' +
      '<span class="grow"></span>';
    if (!RO() && S.brief.status === 'draft') {
      h += '<label class="field"><span class="field-l">Cite into</span><select data-ch="sec" aria-label="The section a citation goes into">' + Q.sections().filter(function (s) { return !s.built; }).map(function (s) { return '<option value="' + s.id + '"' + (ui.sec === s.id ? ' selected' : '') + '>' + esc(s.title) + '</option>'; }).join('') + '</select></label>';
    }
    if (!RO()) h += btn('btn-quiet btn-sm', 'undo', 'Undo', { icon: 'undo', disabled: !S.undo.length });
    h += '<a class="btn btn-secondary btn-sm" href="#brief">' + ic('file') + '<span>Open the facing page</span></a></div>';
    return h;
  }
  function notesHTML() {
    var sigs = Q.signals(), rest = sigs.filter(function (s) { return s.sig !== 'gap'; }), un = rest.filter(function (s) { return !s.covered; }).length;
    var h = '<aside class="rail rail-notes" aria-label="Edition notes: the six checks"><header class="rail-h"><h2>Edition notes</h2><p>Six checks, computed with no model. ' +
      (rest.length ? (un ? '<b>' + un + ' not yet in the brief.</b>' : 'All in the brief.') : '') + '</p></header>';
    if (!rest.length) h += '<p class="rail-empty">' + (sigs.length ? 'The other five checks found nothing, but a channel was not collected: what it would have shown is unknown.' : 'The checks found nothing in this window.') + '</p>';
    h += '<ol class="notes">' + rest.map(function (s) {
      return '<li class="note' + (s.covered ? ' is-covered' : '') + '" data-key="n:' + esc(s.key) + '"><p class="note-k">' + chip(s.label, SIG_TONE[s.sig] + '-solid') +
        (s.covered ? '<span class="note-c ok">' + ic('check') + 'in the brief</span>' : '<span class="note-c">not yet in the brief</span>') + '</p>' +
        '<h3>' + esc(s.title) + '</h3><p class="note-d">' + esc(s.detail) + '</p>' +
        '<button type="button" class="linkbtn" data-act="goto" data-id="' + esc(s.item) + '">Show the item ' + ic('right') + '</button></li>';
    }).join('') + '</ol><ul class="checks" aria-label="What each check found">' + Q.checks().map(function (name, i) {
      var n = sigs.filter(function (s) { return SIG_CHECK[s.sig] === i; }).length;
      return '<li><span>' + esc(name) + '</span><b class="' + (n ? 'has' : '') + '">' + (n || 'none') + '</b></li>';
    }).join('') + '</ul></aside>';
    return h;
  }
  function storiesHTML(ed) {
    var h = '<aside class="rail rail-stories" aria-label="Running stories and the diary"><section aria-label="Running stories"><header class="rail-h"><h2>Running stories</h2><p>Narratives that gained rows in this window.</p></header>';
    h += ed.narr.length ? ed.narr.map(narrHTML).join('') : '<p class="rail-empty">No narrative on this desk\'s issues gained rows' + (ed.filtered ? ' under these filters' : '') + '.</p>';
    h += '</section><section aria-label="Diary"><header class="rail-h"><h2>Diary</h2><p>Dates written beside an action word, not yet passed. Never a guess.</p></header>';
    h += ed.diary.length ? ed.diary.map(diaryHTML).join('') : '<p class="rail-empty">No dated action in this window' + (ed.filtered ? ' under these filters' : '') + '.</p>';
    return h + '</section></aside>';
  }
  function asideList() {
    var rows = Q.rows({ aside: true });
    if (!rows.length) return '';
    var h = '<section class="asidebox" aria-label="Set aside"><button type="button" class="drawer-t" data-act="showaside" aria-expanded="' + (ui.showAside ? 'true' : 'false') + '">' + ic(ui.showAside ? 'down' : 'right') +
      '<span><b>Set aside</b> ' + plural(rows.length, 'row') + ', kept out of the edition and the draft</span></button>';
    if (ui.showAside) {
      h += '<ul class="plain">' + rows.map(function (r) {
        var muted = S.mutes.filter(function (m) { return m.value === (r.outlet || r.who || r.channel); })[0];
        return '<li class="aside-row" data-key="a:' + esc(r.id) + '"><span class="aside-t">' + esc(r.title) + '</span><span class="meta">' + esc(r.outlet || r.who || r.channel || KIND_WORD[r.kind]) + '</span>' +
          chip(muted && !S.aside[r.id] ? 'Muted: ' + muted.value : S.aside[r.id] || 'Set aside', 'neutral') +
          (RO() ? '' : (S.aside[r.id] ? btn('btn-quiet btn-sm', 'restore', 'Put it back', { id: r.id, icon: 'undo', aria: 'Put it back: ' + short(r.title, 50) }) : btn('btn-quiet btn-sm', 'unmute', 'Unmute', { id: muted ? muted.value : '', aria: 'Unmute ' + (muted ? muted.value : '') }))) + '</li>';
      }).join('') + '</ul>';
    }
    return h + '</section>';
  }
  function skToday() {
    var t = ''; for (var i = 0; i < 3; i++) t += '<div class="tier-item">' + sk('40%', '12px') + sk('95%', '20px') + sk('80%', '20px') + sk('60%', '12px') + '</div>';
    var b = ''; for (var j = 0; j < 8; j++) b += '<div class="ib">' + sk('28px', '28px') + '<div class="ib-b">' + sk('85%', '16px') + sk('50%', '12px') + '</div></div>';
    return '<div class="toolbar" aria-hidden="true">' + sk('260px', '34px') + sk('160px', '34px') + '</div><p class="vh" role="status">Reading the window...</p>' +
      '<div class="edition" aria-busy="true"><div class="ed-main"><div class="lead"><div class="lead-main">' + sk('30%', '12px') + sk('96%', '38px') + sk('70%', '38px') + sk('90%', '14px') + sk('50%', '12px') + '</div>' +
      '<div class="lead-side">' + sk('80%', '40px') + sk('80%', '40px') + sk('100%', '10px') + '</div></div><div class="tier">' + t + '</div><div class="inbrief">' + b + '</div></div>' +
      '<aside class="rail rail-notes">' + sk('50%', '18px') + sk('100%', '60px') + sk('100%', '60px') + sk('100%', '60px') + '</aside><aside class="rail rail-stories">' + sk('50%', '18px') + sk('100%', '80px') + sk('100%', '80px') + '</aside></div>';
  }
  function viewToday() {
    if (S.mode === 'loading') return skToday();
    if (S.mode === 'error') return errPanel('The edition could not be read', 'The window\'s rows did not arrive, so nothing is shown: an empty page would read as a quiet day, and it is not known to be one.');
    var ed = ranked(), h = gapBanner(false) + busyNotice() + toolbar();
    var total = Q.rows({}).length;
    if (!total) {
      var gap = Q.signals().filter(function (s) { return s.sig === 'gap'; })[0];
      h += statePanel('empty', 'No rows in this window', gap ? 'Nothing arrived for this desk in the last 24 hours, and <b>' + esc(gap.title.toLowerCase()) + '</b>. This is not a quiet day until the channels the desk relies on have delivered.' :
        'Every channel delivered and none carried the desk\'s issues. A quiet day.', '<a class="btn btn-primary" href="#collection">' + ic('right') + '<span>See what was collected, and why not</span></a>');
      return h + '<div class="edition edition-solo">' + notesHTML() + '</div>';
    }
    h += '<div class="edition"><div class="ed-main">';
    if (!ed.lead) {
      h += statePanel('empty', 'Nothing matches these filters', 'The window holds ' + plural(total, 'row') + ', none of them under this search, issue or pinned-only view.', btn('btn-primary', 'clearfilters', 'Clear the filters'));
    } else {
      h += leadHTML(ed.lead);
      if (ed.tier.length) h += '<section class="tier tier-' + ed.tier.length + '" aria-label="Second tier">' + ed.tier.map(tierHTML).join('') + '</section>';
      if (ed.brief.length) {
        h += '<section class="inbrief-wrap" aria-label="In brief"><header class="sect-h"><h2>In brief</h2><p>' + plural(ed.brief.length, 'more item') + ', by weight: reach, spread across outlets, growth since yesterday, a check that names it, recency.</p></header>' +
          '<div class="inbrief">' + ed.brief.map(function (x) { return briefRowHTML(x); }).join('') + '</div></section>';
      }
    }
    if (ed.noise.length) {
      h += '<section class="noisebox" aria-label="Noise"><button type="button" class="drawer-t" data-act="noise" aria-expanded="' + (ui.noise ? 'true' : 'false') + '">' + ic(ui.noise ? 'down' : 'right') +
        '<span><b>Noise</b> ' + plural(ed.noise.length, 'row') + ' marked low, scoring under ' + NOISE_UNDER + ', or under ' + esc(S.options.minInteractions) + ' interactions</span></button>';
      if (ui.noise) h += '<div class="inbrief inbrief-noise">' + ed.noise.map(function (x) { return briefRowHTML(x, true); }).join('') + '</div>';
      h += '</section>';
    }
    h += asideList() + '</div>' + notesHTML() + storiesHTML(ed) + '</div>';
    return h;
  }

  /* ---------- #brief ---------- */
  function facingEdition() {
    if (S.mode === 'loading') { var s = ''; for (var i = 0; i < 9; i++) s += '<div class="fi">' + sk('28px', '28px') + '<div class="fi-b">' + sk('90%', '15px') + sk('55%', '11px') + '</div></div>'; return '<div aria-busy="true">' + s + '</div>'; }
    var ed = ranked(), sigs = Q.signals(), un = sigs.filter(function (x) { return !x.covered && x.item; });
    var unIds = un.map(function (x) { return x.item; });
    var h = gapBanner(true) + '<header class="page-h"><p class="page-k">The edition</p><h2>Evidence, by weight</h2><p class="page-s">Press <kbd>c</kbd> on an item, or its Cite button, to cite it into <b>' + esc(secTitle(ui.sec)) + '</b>.</p></header>';
    h += '<div class="seg" role="tablist" aria-label="Show">' + [['all', 'All'], ['pinned', 'Pinned (' + Q.counts().pinned + ')'], ['uncovered', 'Checks not in the brief (' + un.length + ')']].map(function (t) {
      return '<button type="button" role="tab" aria-selected="' + (ui.ff === t[0] ? 'true' : 'false') + '" class="seg-b" data-act="ff" data-id="' + t[0] + '">' + esc(t[1]) + '</button>';
    }).join('') + '</div>';
    var list = ed.all.map(function (x) { return x; }).concat(ed.narr.map(function (r) { return { r: r, w: Q.weight(r) }; })).concat(ed.diary.map(function (r) { return { r: r, w: Q.weight(r) }; }));
    if (ui.ff === 'pinned') list = list.filter(function (x) { return S.pins[x.r.id]; });
    if (ui.ff === 'uncovered') list = list.filter(function (x) { return unIds.indexOf(x.r.id) >= 0; });
    if (!list.length) {
      h += '<p class="rail-empty">' + (ui.ff === 'pinned' ? 'Nothing is pinned. Pin an item on the edition and it is listed here.' : ui.ff === 'uncovered' ? 'Every check that names an item is cited in the brief.' : 'No rows in this window. See Collection for what was and was not read.') + '</p>';
      return h;
    }
    function row(x) {
      var r = x.r, isNU = r.kind === 'narrative' || r.kind === 'upcoming';
      return '<article ' + itemAttrs(r, 'fi') + '>' + (isNU ? '<span class="fi-g" aria-hidden="true">' + (r.kind === 'narrative' ? 'N' : 'U') + '</span>' : wt(x.w)) +
        '<div class="fi-b"><h3 class="fi-h">' + esc(r.title) + '</h3><p class="meta">' + metaLine(r) + '</p>' + (marks(r) ? '<p class="markrow">' + marks(r) + '</p>' : '') + '</div>' + itemActs(r, { citeText: true }) + '</article>';
    }
    var a = list.filter(function (x) { return x.r.kind !== 'narrative' && x.r.kind !== 'upcoming'; }), n = list.filter(function (x) { return x.r.kind === 'narrative'; }), u = list.filter(function (x) { return x.r.kind === 'upcoming'; });
    if (a.length) h += '<div class="fi-list">' + a.map(row).join('') + '</div>';
    if (n.length) h += '<h3 class="fi-group">Running stories</h3><div class="fi-list">' + n.map(row).join('') + '</div>';
    if (u.length) h += '<h3 class="fi-group">Diary</h3><div class="fi-list">' + u.map(row).join('') + '</div>';
    return h;
  }
  function saveChip() {
    var b = S.brief;
    if (b.status === 'filed') return '<span class="save save-ok" role="status">' + ic('lock') + 'Filed by ' + esc(b.filedBy || 'the desk') + ' · revision ' + b.revision + '</span>';
    if (b.save === 'saving') return '<span class="save" role="status"><span class="spin" aria-hidden="true"></span>Saving...</span>';
    if (b.save === 'unsaved') return '<span class="save save-warn" role="status"><i class="pip" aria-hidden="true"></i>Unsaved changes</span>';
    if (b.save === 'failed') return '<span class="save save-neg" role="alert">' + ic('alert') + 'Not saved: kept on this computer</span>';
    return '<span class="save save-ok" role="status">' + ic('check') + 'Saved · revision ' + b.revision + '</span>';
  }
  function reportBar() {
    var b = S.brief, d = Q.desk(), fc = Q.flagCount();
    var h = '<div class="rep-top"><div class="rep-bar"><div class="rep-t"><h2><span class="vh">The report: </span>' + esc(d.name) + '</h2><p class="rep-m">' + stateChip(b.status) + '<span>' + esc(fmtDate(b.day, { day: 'numeric', month: 'long', year: 'numeric' })) + '</span>' +
      '<span>' + Q.fmt(Q.words()) + ' words</span>' + (fc && b.status === 'draft' ? '<button type="button" class="linkbtn warn" data-act="firstflag">' + ic('flag') + plural(fc, 'flagged sentence') + '</button>' : '') + saveChip() + '</p></div><div class="rep-a">';
    if (!RO() && b.status === 'draft') {
      h += btn('btn-secondary btn-sm', 'save', 'Save', { disabled: b.save === 'saved' || b.save === 'saving', attrs: ' title="Ctrl or Cmd + S"' });
      h += btn('btn-primary btn-sm', 'file', 'Mark as filed', { icon: 'check' });
    }
    if (!RO() && b.status === 'filed') h += btn('btn-secondary btn-sm', 'reopen', 'Reopen', { icon: 'edit' });
    h += '<div class="menu-wrap">' + btn('btn-secondary btn-sm', 'menu', 'Export', { id: 'export', icon: 'download', attrs: ' aria-haspopup="true" aria-expanded="' + (ui.menu === 'export' ? 'true' : 'false') + '"' });
    if (ui.menu === 'export') {
      h += '<div class="menu menu-right" role="menu" aria-label="Export">' +
        '<button type="button" role="menuitem" class="menu-item" data-act="export" data-id="doc">' + ic('copy') + 'Copy for the document</button>' +
        '<button type="button" role="menuitem" class="menu-item" data-act="export" data-id="md">' + ic('download') + 'Download .md</button>' +
        '<button type="button" role="menuitem" class="menu-item" data-act="export" data-id="html">' + ic('download') + 'Download .html</button>' +
        '<button type="button" role="menuitem" class="menu-item" data-act="export" data-id="slack">' + ic('copy') + 'Copy the Slack summary</button></div>';
    }
    h += '</div>' + btn('btn-quiet btn-sm', 'history', 'History', { icon: 'history' });
    if (!RO() && b.status === 'draft') h += btn('btn-quiet btn-sm', 'draft', 'Draft again', { icon: 'refresh', cost: '1 model call' });
    h += '</div></div>';
    h += '<nav class="outline" aria-label="Sections of the report"><ol>' + Q.sections().map(function (s, i) {
      var n = s.built ? Q.sourceList().length : Q.words(s.id), f = s.built ? 0 : Q.flags(s.id).length;
      return '<li><a href="#brief" data-act="tosec" data-id="' + s.id + '"' + (ui.sec === s.id ? ' class="is-on"' : '') + '><span class="ol-n">' + (i + 1) + '</span><span class="ol-t">' + esc(s.title) + '</span>' +
        (f ? '<span class="ol-f" title="' + plural(f, 'flag') + '">' + f + '</span>' : '<span class="ol-c">' + n + '</span>') + '</a></li>';
    }).join('') + '</ol></nav></div>';
    return h;
  }
  function ratingHTML(item) {
    var R = Q.ratings(), cur = S.brief.ratings[item.id] || {}, can = editable();
    function group(key, label, vals) {
      return '<div class="rate-g"><span class="lbl" id="rl-' + key + '">' + esc(label) + '</span><div class="seg seg-rate" role="radiogroup" aria-labelledby="rl-' + key + '">' + vals.map(function (v) {
        return '<button type="button" role="radio" aria-checked="' + (cur[key] === v ? 'true' : 'false') + '" class="seg-b" data-act="rating" data-id="' + esc(item.id) + '" data-k="' + key + '" data-v="' + esc(v) + '"' + (can ? '' : ' disabled') + '>' + esc(v) + '</button>';
      }).join('') + '</div></div>';
    }
    return '<div class="rating" aria-label="' + esc(item.label) + ' rating">' + group('level', item.label, R.levels) + (item.trend ? group('trend', 'Trend', R.trends) : '') + '</div>';
  }
  function sectionHTML(s, i) {
    var b = S.brief;
    if (s.built) {
      var src = Q.sourceList();
      return '<section class="sec sec-built" id="sec-' + s.id + '" data-key="sec:' + s.id + '" aria-labelledby="sh-' + s.id + '"><header class="sec-h"><span class="sec-n">' + (i + 1) + '</span><h3 id="sh-' + s.id + '">' + esc(s.title) + '</h3>' +
        '<span class="chip chip-neutral">' + ic('lock') + 'Built from the citations</span><span class="wc">' + plural(src.length, 'source') + '</span></header>' +
        (src.length ? '<ol class="srcl">' + src.map(function (x) { return '<li><span class="src-id">' + esc(x.id) + '</span><span class="src-t">' + esc(x.title) + '</span><span class="src-w">' + esc(x.where) + ', ' + esc(x.when) + '</span></li>'; }).join('') + '</ol>' :
          '<p class="prose prose-empty">No row is cited yet. Cite an item from the edition and it is listed here; this list cannot be typed into.</p>') + '</section>';
    }
    var x = b.sections[s.id], flags = Q.flags(s.id), can = editable(), active = can && ui.sec === s.id, c = b.conflict && b.conflict.section === s.id ? b.conflict : null;
    var h = '<section class="sec' + (active ? ' is-active' : '') + (flags.length ? ' is-flagged' : '') + (x.busy ? ' is-busy' : '') + '" id="sec-' + s.id + '" data-key="sec:' + s.id + '" data-sec="' + s.id + '" aria-labelledby="sh-' + s.id + '">' +
      '<header class="sec-h"><span class="sec-n">' + (i + 1) + '</span><h3 id="sh-' + s.id + '">' + esc(s.title) + '</h3>' +
      (x.text.trim() ? chip(x.by === 'drafted' ? 'Drafted' : (x.edited ? 'Edited by ' : 'By ') + x.by, x.by === 'drafted' ? 'neutral' : 'info') : '') + (x.dirty ? chip('Unsaved', 'warn') : '') +
      (flags.length ? chip(plural(flags.length, 'flag'), 'warn-solid') : '') + '<span class="wc">' + plural(Q.words(s.id), 'word') + '</span>';
    if (can) {
      h += '<span class="sec-a">' + (active ? '' : '<button type="button" class="ra ra-text" data-act="activate" data-id="' + s.id + '" aria-label="Edit ' + esc(s.title) + '">' + ic('edit') + '<span>Edit</span></button>') +
        '<button type="button" class="ra ra-text" data-act="regen" data-id="' + s.id + '" aria-label="Regenerate ' + esc(s.title) + ', 1 model call"' + (x.busy ? ' disabled' : '') + '>' + ic('refresh') + '<span>Regenerate</span><span class="cost">1 model call</span></button></span>';
    }
    h += '</header>';
    if (c) {
      h += '<div class="conflict" role="alert"><p class="conflict-h">' + ic('alert') + '<strong>' + esc(c.by) + ' saved this section while you were writing.</strong> Nothing has been overwritten. Choose one.</p>' +
        '<div class="conflict-g"><div><p class="lbl">Yours</p>' + proseText(x.text, []) + '</div><div><p class="lbl">' + esc(c.by) + '\'s</p>' + proseText(c.theirs, []) + '</div></div>' +
        '<div class="conflict-a">' + btn('btn-primary btn-sm', 'resolve', 'Keep mine', { id: 'mine' }) + btn('btn-secondary btn-sm', 'resolve', 'Take theirs', { id: 'theirs' }) + '</div></div>';
    }
    if (s.rating) { var item = Q.ratings().items.filter(function (r) { return r.id === s.rating; })[0]; if (item) h += ratingHTML(item); }
    if (x.busy) h += '<div class="sec-busy" role="status"><span class="spin" aria-hidden="true"></span>Regenerating this section: one model call...' + sk('100%', '14px') + sk('92%', '14px') + sk('60%', '14px') + '</div>';
    else if (active) {
      h += '<label class="vh" for="ta-' + s.id + '">' + esc(s.title) + ': text. Keep the marks in square brackets: they are the citations.</label>' +
        '<textarea class="ta" id="ta-' + s.id + '" data-sec="' + s.id + '" data-in="edit" rows="3" spellcheck="true" placeholder="Write this section. Press c on an edition item to cite it here.">\n' + esc(x.text) + '</textarea>' +
        '<div class="reads"><p class="lbl">As it reads' + (flags.length ? ' · ' + plural(flags.length, 'sentence') + ' flagged' : '') + '</p>' + proseText(x.text, flags) + '</div>';
    } else {
      h += '<div class="sec-prose"' + (can ? ' data-act="activate" data-id="' + s.id + '"' : '') + '>' + proseText(x.text, b.status === 'draft' ? flags : []) + '</div>';
    }
    return h + '</section>';
  }
  function draftProgress() {
    var d = S.brief.drafting;
    if (d.dropped) {
      return '<div class="state state-error" role="alert"><div class="state-mark" aria-hidden="true">' + ic('alert') + '</div><h2>The connection dropped mid-draft</h2>' +
        '<p>The draft may have finished on the worker: the model call was already made and is not made twice. Your earlier words are untouched.</p><div class="state-a">' + btn('btn-primary', 'checkdraft', 'Check for the draft', { icon: 'refresh' }) + '</div></div>';
    }
    var el = Math.max(0, Math.floor((Date.now() - d.t0) / 1000));
    return '<div class="drafting" role="status" aria-live="polite"><p class="page-k">Drafting · 1 model call</p><h2>' + esc(d.stage) + '</h2>' +
      '<ol class="stepper">' + DRAFT_STAGES.map(function (st, i) { var n = i + 1; return '<li class="' + (n < d.n ? 'done' : n === d.n ? 'now' : '') + '"' + (n === d.n ? ' aria-current="step"' : '') + '><span class="step-n">' + (n < d.n ? ic('check') : n) + '</span><span>' + esc(st) + '</span></li>'; }).join('') + '</ol>' +
      '<dl class="draft-f"><div><dt>Step</dt><dd>' + d.n + ' of ' + d.of + '</dd></div><div><dt>Elapsed</dt><dd>' + el + ' s</dd></div><div><dt>Evidence</dt><dd>' + d.evidence + ' rows</dd></div><div><dt>Pinned</dt><dd>' + d.pinned + '</dd></div></dl>' +
      '<p class="dim">A draft usually takes a minute or two. The page stays usable; the edition on the facing page can still be read.</p></div>';
  }
  function reportHTML() {
    var b = S.brief;
    if (S.mode === 'loading') return '<div aria-busy="true" class="rep-sk">' + sk('40%', '26px') + sk('100%', '34px') + sk('30%', '18px') + sk('100%', '14px') + sk('96%', '14px') + sk('70%', '14px') + sk('30%', '18px') + sk('100%', '14px') + sk('88%', '14px') + '</div><p class="vh" role="status">Reading the brief...</p>';
    if (b.drafting) return draftProgress();
    if (b.status === 'none') {
      var n = Q.rows({}).length;
      return '<div class="state state-empty"><div class="state-mark" aria-hidden="true">' + ic('file') + '</div><h2>No brief for this window yet</h2>' +
        '<p>' + (n ? 'The window holds ' + plural(n, 'row') + ' of evidence, ' + Q.counts().pinned + ' pinned.' : '<b>The window holds no rows</b>, and a channel was not collected. A draft from nothing would say nothing: read Collection first.') + '</p>' +
        (RO() ? '<p class="dim">This key is read-only: a brief can be read here once someone has started it.</p>' :
          '<div class="state-a">' + btn('btn-primary', 'draft', 'Draft the brief', { cost: '1 model call', disabled: !n }) + btn('btn-secondary', 'byhand', 'Write by hand') + '</div>') + '</div>';
    }
    var h = reportBar();
    if (b.status === 'filed') h += notice('pos', 'Filed by ' + (b.filedBy || 'the desk'), 'A filed brief is final until it is reopened. The exports are of exactly this revision.', RO() ? '' : btn('btn-secondary btn-sm', 'reopen', 'Reopen', { icon: 'edit' }));
    if (b.save === 'failed') h += notice('warn', 'The database is busy', 'Your words are kept on this computer and nothing is lost. Saving will work as soon as the database answers.', btn('btn-secondary btn-sm', 'save', 'Try again', { icon: 'refresh' }));
    if (RO() && b.status !== 'filed') h += notice('info', 'Read-only key', 'Everything here can be read and exported. Writing, drafting and filing need a full key.');
    h += '<div class="rep-body">' + Q.sections().map(sectionHTML).join('') + '</div>';
    return h;
  }
  function viewBrief() {
    if (S.mode === 'error') return errPanel('The brief could not be read', 'Neither the report nor the edition arrived. Your unsaved words, if any, are still on this computer.');
    var showEd = ui.facing || ui.pane === 'edition', showRep = ui.facing || ui.pane === 'report';
    var h = '';
    if (!ui.facing) {
      h += '<div class="pane-t"><div class="seg" role="tablist" aria-label="Facing pages">' +
        '<button type="button" role="tab" id="pt-edition" aria-selected="' + (ui.pane === 'edition' ? 'true' : 'false') + '" class="seg-b" data-act="pane" data-id="edition">The edition</button>' +
        '<button type="button" role="tab" id="pt-report" aria-selected="' + (ui.pane === 'report' ? 'true' : 'false') + '" class="seg-b" data-act="pane" data-id="report">The report</button></div>' +
        '<p class="dim">Both pages sit side by side from 1440 pixels wide. Press <kbd>e</kbd> to turn the page.</p></div>';
    }
    h += busyNotice() + '<div class="facing' + (ui.facing ? ' facing-2' : '') + '">';
    if (showEd) h += '<div class="page page-ed" aria-label="The edition: evidence">' + facingEdition() + '</div>';
    if (showRep) h += '<div class="page page-rep" aria-label="The report">' + reportHTML() + '</div>';
    return h + '</div>';
  }

  /* ---------- #watch ---------- */
  function viewWatch() {
    if (S.mode === 'loading') return '<div class="watch" aria-busy="true"><div>' + sk('40%', '24px') + sk('100%', '90px') + sk('100%', '90px') + sk('100%', '90px') + '</div><div>' + sk('40%', '24px') + sk('100%', '220px') + '</div></div>';
    if (S.mode === 'error') return errPanel('The watch register could not be read', 'Proposals and the register did not arrive. Nothing was decided.');
    var props = S.proposals.filter(function (p) { return p.status === 'proposed'; }), done = S.proposals.filter(function (p) { return p.status !== 'proposed'; });
    var h = busyNotice() + '<div class="watch"><section class="w-props" aria-label="Proposals"><header class="sect-h sect-h-big"><h2>Letters to the desk</h2><p>' + plural(props.length, 'proposal') +
      ' from discovery. A proposal is read by nothing until a person approves it; a dismissal needs a reason and is never proposed again.</p></header>';
    if (!props.length) h += statePanel('empty', 'Nothing waits for a decision', 'Discovery runs once a Sydney day for each desk. New terms, accounts, hashtags and outlets appear here with their evidence.', '');
    h += props.map(function (p) {
      var open = ui.pv[p.id], dm = ui.dm[p.id], reason = ui.dr[p.id] || '';
      var c = '<article class="prop item' + (ui.sel === p.id ? ' is-sel' : '') + '" data-key="p:' + p.id + '" data-item="' + p.id + '" data-act="sel" data-id="' + p.id + '" tabindex="0" aria-label="Proposal: ' + esc(p.kind + ' ' + p.value) + '">' +
        '<div class="prop-s" title="Score ' + p.score + ' of 100"><b>' + p.score + '</b><span>score</span></div><div class="prop-b"><p class="kicker">' + chip(p.kind, 'neutral-solid') + (p.name ? '<span class="kick-i">' + esc(p.name) + '</span>' : '') + '</p>' +
        '<h3 class="prop-h">' + esc(p.value) + '</h3><p class="prop-r">' + esc(p.reason) + '</p><p class="markrow"><span class="lbl">Evidence</span> ' + p.evidence.map(citeChip).join(' ') + '</p>';
      if (open) {
        c += p.preview ? '<div class="preview" role="region" aria-label="Preview of ' + esc(p.value) + '"><dl class="draft-f"><div><dt>Already on the desk</dt><dd>' + p.preview.held + '</dd></div><div><dt>Rows it would add</dt><dd>' + p.preview.add + '</dd></div><div><dt>Say something Australian</dt><dd>' + p.preview.au + '</dd></div></dl>' +
          '<p class="lbl">A sample of what it would have caught</p><ul class="plain sample">' + p.preview.sample.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul><p class="dim">A preview reads what is already held and writes nothing.</p></div>' :
          '<div class="preview" role="region"><p class="dim">A preview counts what a search term would have caught. A ' + esc(p.kind) + ' is followed, not searched for, so there is nothing to count: the evidence rows above are why it was proposed.</p></div>';
      }
      if (!RO()) {
        c += '<div class="prop-a">' + btn('btn-quiet btn-sm', 'pv', open ? 'Hide preview' : 'Preview', { id: p.id, icon: 'eye', attrs: ' aria-expanded="' + (open ? 'true' : 'false') + '"' }) +
          '<span class="grow"></span><label class="field"><span class="field-l">Approve under</span><select data-ch="ai" data-id="' + p.id + '" aria-label="Issue to approve ' + esc(p.value) + ' under"><option value="">No issue (searched, tags nothing)</option>' +
          Q.issues().map(function (i) { return '<option value="' + i.id + '"' + (ui.ai[p.id] === i.id ? ' selected' : '') + '>' + esc(i.label) + '</option>'; }).join('') + '</select></label>' +
          btn('btn-primary btn-sm', 'approve', 'Approve', { id: p.id, icon: 'check', aria: 'Approve ' + p.value }) + btn('btn-danger btn-sm', 'dm', 'Dismiss', { id: p.id, aria: 'Dismiss ' + p.value, attrs: ' aria-expanded="' + (dm ? 'true' : 'false') + '"' }) + '</div>';
        if (dm) {
          c += '<div class="dismiss"><label class="field field-wide"><span class="field-l">Reason for dismissing (required)</span><input type="text" data-in="dr" data-id="' + p.id + '" value="' + esc(reason) + '" placeholder="For example: generic, does not name the harbour"></label>' +
            btn('btn-danger btn-sm', 'dismissgo', 'Dismiss for good', { id: p.id, disabled: reason.trim().length < 3 }) + btn('btn-quiet btn-sm', 'dm', 'Cancel', { id: p.id }) + '</div>';
        }
      } else c += '<div class="prop-a">' + btn('btn-quiet btn-sm', 'pv', open ? 'Hide preview' : 'Preview', { id: p.id, icon: 'eye' }) + '</div>';
      return c + '</div></article>';
    }).join('');
    if (done.length) {
      h += '<h3 class="fi-group">Decided this session</h3><ul class="plain">' + done.map(function (p) {
        return '<li class="aside-row"><span class="aside-t">' + esc(p.value) + '</span><span class="meta">' + esc(p.kind) + '</span>' + (p.status === 'active' ? chip('Approved' + (p.issue ? ' under ' + issueLabel(p.issue) : ', no issue'), 'pos') : chip('Dismissed: ' + (p.reason2 || ''), 'neutral')) + '</li>';
      }).join('') + '</ul>';
    }
    h += '</section><section class="w-reg" aria-label="The register"><header class="sect-h sect-h-big"><h2>The register</h2><p>What this desk reads for, by kind. Only this client\'s.</p></header>';
    var kinds = [['term', 'Terms'], ['account', 'Accounts'], ['hashtag', 'Hashtags'], ['outlet', 'Outlets'], ['group', 'Groups']];
    var all = S.register.concat(S.proposals.filter(function (p) { return p.status === 'active'; }).map(function (p) { return { id: p.id, kind: p.kind, value: p.value, name: p.name, issue: p.issue, status: 'active', last: null, fresh: true }; }));
    h += '<div class="seg" role="tablist" aria-label="Register by kind">' + kinds.map(function (k) {
      var n = all.filter(function (r) { return r.kind === k[0]; }).length;
      return '<button type="button" role="tab" id="rk-' + k[0] + '" aria-selected="' + (ui.regKind === k[0] ? 'true' : 'false') + '" aria-controls="regpanel" class="seg-b" data-act="regkind" data-id="' + k[0] + '">' + k[1] + ' (' + n + ')</button>';
    }).join('') + '</div><div id="regpanel" role="tabpanel" aria-labelledby="rk-' + ui.regKind + '">';
    var rows = all.filter(function (r) { return r.kind === ui.regKind; });
    if (!rows.length) h += '<p class="rail-empty">No ' + esc(ui.regKind) + ' is registered on this desk. Approve a proposal and it is listed here.</p>';
    else {
      h += '<table class="tbl"><thead><tr><th scope="col">' + esc(ui.regKind.charAt(0).toUpperCase() + ui.regKind.slice(1)) + '</th><th scope="col">Issue</th><th scope="col">Last delivered</th><th scope="col">State</th></tr></thead><tbody>' + rows.map(function (r) {
        var stt = r.status === 'dismissed' ? chip('Dismissed', 'neutral') : r.status === 'off' ? chip('Off', 'neutral') : r.error ? chip(r.error, 'warn-solid') : chip('Active', 'pos');
        return '<tr data-key="r:' + r.id + '"><th scope="row"><span class="reg-v">' + esc(r.value) + '</span>' + (r.name || r.platform ? '<span class="meta">' + esc([r.name, r.platform, r.actor === 'official' ? 'public official' : r.actor === 'org' ? 'organisation' : ''].filter(Boolean).join(' · ')) + '</span>' : '') +
          (r.review ? '<span class="meta warn">Approved thirty days ago and has matched nothing since: review it</span>' : '') + (r.reason ? '<span class="meta">Reason: ' + esc(r.reason) + '</span>' : '') + (r.fresh ? '<span class="meta">Approved this session</span>' : '') + '</th>' +
          '<td>' + (r.issue ? esc(issueLabel(r.issue)) : '<span class="dim">none</span>') + '</td><td>' + (r.status === 'dismissed' ? '<span class="dim">never read</span>' : esc(Q.ago(r.last))) + '</td>' +
          '<td class="td-a">' + stt + (!RO() && !r.fresh && r.status !== 'dismissed' ? '<button type="button" class="switch" role="switch" aria-checked="' + (r.status === 'active' ? 'true' : 'false') + '" data-act="regtoggle" data-id="' + r.id + '" aria-label="Read for ' + esc(r.value) + '"><i></i></button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    return h + '</div></section></div>';
  }

  /* ---------- #collection ---------- */
  function chState(c) {
    if (c.off) return chip('Switched off', 'neutral-solid');
    if (c.state === 'gap') return chip('Not collected', 'warn-solid'); if (c.state === 'paused') return chip('Paused', 'neg'); if (c.state === 'quiet') return chip('Quiet, with a reason', 'neutral');
    return chip('Delivering', 'pos');
  }
  function viewCollection() {
    if (S.mode === 'loading') return '<div class="coll" aria-busy="true"><div>' + sk('40%', '24px') + sk('100%', '44px') + sk('100%', '44px') + sk('100%', '44px') + sk('100%', '44px') + sk('100%', '44px') + '</div><div>' + sk('60%', '24px') + sk('100%', '160px') + '</div></div>';
    if (S.mode === 'error') return errPanel('Collection could not be read', 'The state of the channels did not arrive, so none is shown as delivering.');
    var ch = S.channels, max = Math.max.apply(null, ch.map(function (c) { return c.d7; }).concat([1])), job = S.job;
    var gaps = ch.filter(function (c) { return c.state === 'gap' && !c.off; });
    var h = busyNotice() + '<div class="coll"><section aria-label="Channels"><header class="sect-h sect-h-big"><h2>What was read, and what was not</h2><p>Each channel this desk relies on, what it delivered for the desk, and why a gap is a gap. ' +
      (gaps.length && S.mode !== 'nogap' ? '<b>' + plural(gaps.length, 'channel') + ' delivered nothing.</b>' : '') + '</p></header>' +
      '<table class="tbl tbl-ch"><thead><tr><th scope="col">Channel</th><th scope="col" class="num">24 hours</th><th scope="col">7 days</th><th scope="col">Last row</th><th scope="col">State</th><th scope="col"><span class="vh">Actions</span></th></tr></thead><tbody>';
    ch.forEach(function (c) {
      var isGap = c.state === 'gap' && !c.off, running = job && job.channel === c.id;
      h += '<tr class="ch' + (isGap ? ' ch-gap' : '') + (ui.sel === 'ch:' + c.id ? ' is-sel' : '') + '" data-key="c:' + c.id + '" id="ch-' + c.id + '"><th scope="row"><span class="reg-v">' + esc(c.label) + '</span><span class="meta">' + esc(c.how) + '</span><span class="meta">' +
        (c.by === 'mac' ? 'Read by the collector on the agency\'s Mac' : 'Read by the worker itself') + '</span></th>' +
        '<td class="num"><b class="' + (c.d1 ? '' : 'zero') + '">' + c.d1 + '</b></td><td><span class="bar" title="' + c.d7 + ' rows in seven days"><i style="width:' + Math.round(c.d7 / max * 100) + '%"></i></span><span class="bar-n">' + c.d7 + '</span></td>' +
        '<td>' + esc(Q.ago(c.last)) + '</td><td>' + chState(c) + '</td><td class="td-a">';
      if (!RO()) {
        h += btn('btn-secondary btn-sm', 'collect', 'Collect now', { id: c.id, icon: 'play', aria: 'Collect ' + c.label + ' now', disabled: !!c.off || (job && !job.done) }) +
          '<button type="button" class="switch" role="switch" aria-checked="' + (c.off ? 'false' : 'true') + '" data-act="chtoggle" data-id="' + c.id + '" aria-label="Collect ' + esc(c.label) + ' for this desk"><i></i></button>';
      }
      h += '</td></tr>';
      if (c.why && !c.off) {
        h += '<tr class="ch-why' + (isGap ? ' ch-gap' : '') + '" data-key="cw:' + c.id + '"><td colspan="6"><div class="whyfix"><p><span class="lbl">Why</span> ' + esc(c.why) + '</p>' + (c.fix ? '<p><span class="lbl">The one fix</span> <b>' + esc(c.fix) + '</b></p>' : '') +
          (isGap ? '<p class="gap-not">Nothing from ' + esc(c.label) + ' is in the edition. That is a gap, not a quiet day.</p>' : '') + '</div></td></tr>';
      }
      if (running) {
        h += '<tr class="ch-console" data-key="cj:' + c.id + '"><td colspan="6"><div class="console" role="log" aria-live="polite" aria-label="Collection console for ' + esc(c.label) + '"><p class="console-h"><span>' + (job.done ? (job.failed ? 'failed' : 'finished') : '<span class="spin" aria-hidden="true"></span>running') +
          '</span><span>' + esc(c.label) + ' · one bridge job · no model call</span></p>' + job.lines.map(function (l) { return '<p class="' + (/^failed/.test(l) ? 'ln-bad' : /^done/.test(l) ? 'ln-ok' : '') + '">' + esc(l) + '</p>'; }).join('') +
          (job.done ? '' : '<p class="ln-cur" aria-hidden="true">_</p>') + '</div></td></tr>';
      }
    });
    h += '</tbody></table></section><div class="coll-side">';
    h += '<section aria-label="Parliament pages"><header class="sect-h"><h2>Parliament pages</h2><p>Stage and next date as recorded on the page.</p></header><ul class="plain cards">' + Q.pages().map(function (p) {
      return '<li><h3>' + esc(p.name) + '</h3><p class="meta">' + esc(p.house) + ' · ' + esc(p.stage) + '</p><p class="meta"><b>Next: ' + esc(fmtDate(p.next, { day: 'numeric', month: 'long' })) + '</b> · read ' + esc(Q.ago(p.read)) + '</p></li>';
    }).join('') + '</ul></section>';
    h += '<section aria-label="Petition counters"><header class="sect-h"><h2>Petition counters</h2><p>The campaign pages\' own counts: self-reported.</p></header><ul class="plain cards">' + Q.petitions().map(function (p) {
      return '<li><h3>' + esc(p.name) + '</h3><p class="pet"><b>' + Q.fmt(p.count) + '</b><span class="chip chip-' + (p.d1 > 1000 ? 'warn' : 'neutral') + '">+' + Q.fmt(p.d1) + ' in a day</span></p><p class="meta">' + esc(p.host) + '</p></li>';
    }).join('') + '</ul></section>';
    var rc = Q.recall();
    h += '<section aria-label="Recall"><header class="sect-h"><h2>Recall</h2><p>Of the links in ' + rc.reports + ' filed reports, the share AXIOM held by the end of the next day. The measure of the work.</p></header>' +
      '<p class="recall-n"><b>' + Math.round(rc.share * 100) + '%</b> held</p><ul class="plain recall">' + rc.by.map(function (b) {
        var pc = Math.round(b[1] * 100);
        return '<li><span>' + esc(b[0]) + '</span><span class="bar bar-' + (pc < 50 ? 'neg' : pc < 85 ? 'warn' : 'pos') + '"><i style="width:' + pc + '%"></i></span><b>' + pc + '%</b></li>';
      }).join('') + '</ul></section></div></div>';
    return h;
  }

  /* ---------- #options ---------- */
  function sw(key, label, hint) {
    return '<div class="opt"><div><p class="opt-l" id="ol-' + key + '">' + esc(label) + '</p><p class="meta">' + hint + '</p></div><button type="button" class="switch" role="switch" aria-checked="' + (S.options[key] ? 'true' : 'false') + '" aria-labelledby="ol-' + key + '" data-act="opt" data-id="' + key + '"' + (RO() ? ' disabled' : '') + '><i></i></button></div>';
  }
  function viewOptions() {
    var o = S.options, d = Q.desk();
    var h = '<div class="opts"><section aria-label="This desk"><header class="sect-h sect-h-big"><h2>' + esc(d.name) + '</h2><p>' + esc(d.region) + ' · ' + esc(Q.windowLabel()) + '</p></header>' +
      (RO() ? notice('info', 'Read-only key', 'The desk\'s options can be read here. Changing them needs a full key.') : '') +
      '<div class="opt"><div><p class="opt-l" id="ol-density">Density</p><p class="meta">How tightly the edition is set.</p></div><div class="seg" role="radiogroup" aria-labelledby="ol-density">' + ['regular', 'compact'].map(function (v) {
        return '<button type="button" role="radio" aria-checked="' + (o.density === v ? 'true' : 'false') + '" class="seg-b" data-act="optv" data-id="density" data-v="' + v + '"' + (RO() ? ' disabled' : '') + '>' + v + '</button>';
      }).join('') + '</div></div>' +
      '<div class="opt"><div><p class="opt-l">Smallest post worth a line</p><p class="meta">Social posts under this many interactions go to the noise drawer.</p></div><label class="field"><span class="vh">Minimum interactions</span><input type="number" min="0" max="1000" step="5" data-ch="minint" value="' + esc(o.minInteractions) + '"' + (RO() ? ' disabled' : '') + '></label></div>' +
      sw('fold', 'Fold syndicated copies', 'One item for a story carried by several outlets; the outlets are listed on it.') +
      sw('autoDraft', 'Draft each morning', 'Off unless set. <b>1 model call each morning</b>, inside the automation window.') + '</section>';
    h += '<section aria-label="Muted on this desk"><header class="sect-h"><h2>Muted on this desk</h2><p>An outlet or account a person chose to stop seeing here. Offered after the third set-aside, never done unasked.</p></header>';
    h += S.mutes.length ? '<ul class="plain">' + S.mutes.map(function (m) { return '<li class="aside-row"><span class="aside-t">' + esc(m.value) + '</span><span class="meta">' + esc(m.kind) + '</span>' + (RO() ? '' : btn('btn-quiet btn-sm', 'unmute', 'Unmute', { id: m.value, aria: 'Unmute ' + m.value })) + '</li>'; }).join('') + '</ul>' :
      '<p class="rail-empty">Nothing is muted. Set aside three rows from one outlet and the Den offers to mute it.</p>';
    h += '</section><section aria-label="The report"><header class="sect-h"><h2>The report\'s format</h2><p>The sections and rating words are the desk\'s data.</p></header><ol class="fmt">' + Q.sections().map(function (s) {
      return '<li>' + esc(s.title) + (s.built ? ' <span class="dim">(built from citations)</span>' : '') + (s.rating ? ' <span class="dim">(carries the Momentum rating)</span>' : '') + '</li>';
    }).join('') + '</ol><p class="meta">Momentum: ' + Q.ratings().levels.map(esc).join(', ') + '. Trend: ' + Q.ratings().trends.map(esc).join(', ') + '.</p></section>';
    h += '<section aria-label="Appearance"><header class="sect-h"><h2>Appearance</h2><p>For this browser only.</p></header><div class="opt"><div><p class="opt-l" id="ol-theme">Theme</p><p class="meta">Auto follows the system.</p></div><div class="seg" role="radiogroup" aria-labelledby="ol-theme">' + ['auto', 'light', 'dark'].map(function (v) {
      return '<button type="button" role="radio" aria-checked="' + (ui.themePref === v ? 'true' : 'false') + '" class="seg-b" data-act="themeset" data-id="' + v + '">' + v + '</button>';
    }).join('') + '</div></div></section></div>';
    return h;
  }

  /* ---------- #system ---------- */
  var TOKENS = [['--paper', 'Paper, the ground'], ['--paper-2', 'Raised page'], ['--paper-3', 'Sunken, hover'], ['--surface', 'Dialog, menu'], ['--ink', 'Ink, primary text'], ['--ink-2', 'Secondary text'], ['--ink-3', 'Tertiary text'],
    ['--rule', 'Hairline'], ['--rule-2', 'Soft hairline'], ['--accent', 'The one accent'], ['--accent-soft', 'Accent tint'], ['--pos', 'Positive'], ['--pos-soft', 'Positive tint'], ['--warn', 'Warning'], ['--warn-soft', 'Warning tint'],
    ['--neg', 'Negative'], ['--neg-soft', 'Negative tint'], ['--info', 'Information'], ['--info-soft', 'Information tint']];
  var PAIRS = [['--ink', '--paper'], ['--ink-2', '--paper'], ['--ink-3', '--paper'], ['--ink-3', '--paper-3'], ['--ink', '--surface'], ['--accent', '--paper'], ['--on-accent', '--accent'], ['--paper', '--ink'],
    ['--accent', '--accent-soft'], ['--pos', '--pos-soft'], ['--warn', '--warn-soft'], ['--neg', '--neg-soft'], ['--info', '--info-soft'], ['--on-accent', '--pos'], ['--on-accent', '--warn'], ['--on-accent', '--neg']];
  var probes = {};
  function tokenVal(theme, name) {
    if (!probes[theme]) { var p = document.createElement('div'); p.setAttribute('data-theme', theme); p.hidden = true; document.body.appendChild(p); probes[theme] = p; }
    return getComputedStyle(probes[theme]).getPropertyValue(name).trim();
  }
  function lum(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null;
    var c = [0, 2, 4].map(function (i) { var v = parseInt(m[1].substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var x = lum(a), y = lum(b); if (x == null || y == null) return null; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function viewSystem() {
    var h = '<div class="sys"><header class="sect-h sect-h-big"><h2>The Front Page: design system</h2><p>Every colour, size, space, radius, shadow and duration is a custom property at the top of <code>concept-b.css</code>. Ratios below are computed in this page from the live token values.</p></header>';
    h += '<section aria-label="Prototype controls"><h3 class="sys-h">Prototype controls</h3><div class="sys-row">' + ['normal', 'loading', 'empty', 'error', 'busy', 'dropped', 'readonly', 'filed', 'nogap'].map(function (m) {
      return '<button type="button" class="btn btn-sm ' + (S.mode === m ? 'btn-primary' : 'btn-secondary') + '" data-act="mode" data-id="' + m + '" aria-pressed="' + (S.mode === m ? 'true' : 'false') + '"><span>' + m + '</span></button>';
    }).join('') + '</div><div class="sys-row">' + btn('btn-secondary btn-sm', 'conflict', 'Simulate a save conflict') + btn('btn-secondary btn-sm', 'simmute', 'Simulate the mute offer') + btn('btn-secondary btn-sm', 'simtoast', 'Show a toast') + '</div></section>';
    h += '<section aria-label="Colour"><h3 class="sys-h">Colour, light and dark</h3><div class="sys-themes">' + ['light', 'dark'].map(function (th) {
      var c = '<div class="theme-scope" data-theme="' + th + '"><h4>' + th + '</h4><ul class="swatches">' + TOKENS.map(function (t) {
        return '<li><i style="background:var(' + t[0] + ')"></i><span><b>' + t[0] + '</b>' + esc(t[1]) + '<code>' + esc(tokenVal(th, t[0])) + '</code></span></li>';
      }).join('') + '</ul><table class="tbl tbl-pairs"><caption>Text on ground, WCAG contrast</caption><thead><tr><th scope="col">Pair</th><th scope="col">Sample</th><th scope="col" class="num">Ratio</th><th scope="col">AA</th></tr></thead><tbody>' + PAIRS.map(function (p) {
        var r = ratio(tokenVal(th, p[0]), tokenVal(th, p[1]));
        return '<tr><th scope="row"><code>' + p[0].slice(2) + '</code> on <code>' + p[1].slice(2) + '</code></th><td><span class="pair" style="color:var(' + p[0] + ');background:var(' + p[1] + ')">Ferry levy 1,840</span></td><td class="num">' + (r ? r.toFixed(2) : 'n/a') + '</td><td>' +
          (r == null ? '' : r >= 4.5 ? '<span class="chip chip-pos">pass</span>' : '<span class="chip chip-neg">fail</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
      return c;
    }).join('') + '</div></section>';
    h += '<section aria-label="Type"><h3 class="sys-h">Type scale</h3><p class="meta">Display and reading: Iowan Old Style, Charter, Palatino, Georgia. Data and interface: DM Sans, served from this folder.</p><ul class="plain types">' +
      [['--fs-display', 'Lead headline', 'serif', 'Ferry levy splits the upper house'], ['--fs-h1', 'Page title', 'serif', 'What was read, and what was not'], ['--fs-h2', 'Second tier headline', 'serif', 'Harbourline warns levy would end three routes'],
        ['--fs-h3', 'In brief headline', 'serif', 'Council votes to oppose levy in its current form'], ['--fs-read', 'Reading text, the report', 'serif', 'Coverage ran in six outlets and drew 1,840 reactions.'], ['--fs-body', 'Interface text', 'sans', 'The Eastport Ledger · metro · 13 Nov, 5:04 am'],
        ['--fs-small', 'Secondary', 'sans', 'found by ferry levy · 86 comments held'], ['--fs-micro', 'Chips, meta', 'sans', 'Not yet in the brief'], ['--fs-label', 'Labels, uppercase', 'sans label', 'Edition notes']].map(function (t) {
        return '<li><span class="type-k"><code>' + t[0] + '</code>' + esc(t[1]) + '</span><span class="type-s ' + t[2] + '" style="font-size:var(' + t[0] + ')">' + esc(t[3]) + '</span></li>';
      }).join('') + '</ul></section>';
    h += '<section aria-label="Space, radii, elevation, motion"><h3 class="sys-h">Space, radii, elevation, motion</h3><div class="sys-grid"><div><p class="lbl">Space</p><ul class="plain spaces">' + ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6', '--s7'].map(function (s) {
      return '<li><code>' + s + '</code><i style="width:var(' + s + ')"></i><span>' + esc(tokenVal('light', s)) + '</span></li>';
    }).join('') + '</ul></div><div><p class="lbl">Radii</p><div class="sys-row">' + ['--r1', '--r2', '--r3', '--r-pill'].map(function (r) { return '<span class="radius" style="border-radius:var(' + r + ')"><code>' + r + '</code></span>'; }).join('') + '</div>' +
      '<p class="lbl">Elevation</p><div class="sys-row">' + ['--e1', '--e2', '--e3'].map(function (e) { return '<span class="elev" style="box-shadow:var(' + e + ')"><code>' + e + '</code></span>'; }).join('') + '</div></div>' +
      '<div><p class="lbl">Motion</p><ul class="plain motions">' + [['--t-fast', 'hover, press'], ['--t-med', 'menus, chips, switches'], ['--t-slow', 'drawer, dialog, toast']].map(function (m) {
        return '<li><code>' + m[0] + '</code><span>' + esc(tokenVal('light', m[0])) + ' · ' + m[1] + '</span><i class="mo" style="transition-duration:var(' + m[0] + ')"></i></li>';
      }).join('') + '</ul><p class="meta">Hover a bar to see the duration. Under <code>prefers-reduced-motion</code> every transition and animation is cut to nothing and the skeleton stops shimmering.</p></div></div></section>';
    /* components */
    var sample = Q.row('M:2') || Q.rows({})[0], sw2 = sample ? { r: sample, w: Q.weight(sample) } : null;
    h += '<section aria-label="Components"><h3 class="sys-h">Components</h3>' +
      '<h4 class="sys-s">Buttons: primary, secondary, quiet, danger, row action (hit size 32px or more)</h4><div class="sys-row">' + btn('btn-primary', 'noop', 'Mark as filed', { icon: 'check' }) + btn('btn-primary', 'noop', 'Draft the brief', { cost: '1 model call' }) + btn('btn-secondary', 'noop', 'Save') +
      btn('btn-quiet', 'noop', 'History', { icon: 'history' }) + btn('btn-danger', 'noop', 'Dismiss for good') + btn('btn-primary', 'noop', 'Disabled', { disabled: true }) + btn('btn-secondary', 'noop', 'Disabled', { disabled: true }) + '</div>' +
      '<div class="sys-row">' + btn('btn-primary btn-sm', 'noop', 'Small primary') + btn('btn-secondary btn-sm', 'noop', 'Small secondary') + btn('btn-quiet btn-sm is-on', 'noop', 'Quiet, pressed', { icon: 'pin' }) + btn('btn-danger btn-sm', 'noop', 'Small danger') +
      '<span class="acts acts-show">' + ra('noop', 'x', 'Cite (specimen)', 'quote', null, 'Cite') + ra('noop', 'x', 'Pin (specimen)', 'pin', false) + ra('noop', 'x', 'Pinned (specimen)', 'pin', true) + ra('noop', 'x', 'Set aside (specimen)', 'tray') + ra('noop', 'x', 'Open (specimen)', 'eye') + '</span>' +
      '<button type="button" class="iconbtn" data-act="noop" aria-label="Icon button (specimen)">' + ic('help') + '</button><button type="button" class="linkbtn" data-act="noop">Link button ' + ic('right') + '</button></div>' +
      '<h4 class="sys-s">Chips: tinted and solid fills</h4><div class="sys-row">' + ['neutral', 'accent', 'pos', 'warn', 'neg', 'info'].map(function (t) { return chip(t, t) + chip(t + ' solid', t + '-solid'); }).join('') + '</div>' +
      '<h4 class="sys-s">Citation chips, a flagged sentence, the weight</h4><div class="sys-row sys-prose">' + proseText('Coverage ran in six outlets [M:1]. A campaigner named Sam Private is coordinating the petition. An id nobody gave [S:99].', [{ sentence: 'A campaigner named Sam Private is coordinating the petition.', text: 'No evidence behind' }]) + '</div>' +
      '<div class="sys-row">' + (sw2 ? wt(sw2.w, true) + wt(sw2.w) : '') + '</div>' +
      '<h4 class="sys-s">List rows: default, selected, pinned, quiet</h4><div class="inbrief sys-list">' + (sw2 ? briefRowHTML(sw2).replace('data-key="i:', 'data-key="sys1:') + briefRowHTML(sw2).replace('class="item ib', 'class="item ib is-sel').replace('data-key="i:', 'data-key="sys2:') +
        briefRowHTML(sw2, true).replace('data-key="i:', 'data-key="sys3:') : '') + '</div>' +
      '<h4 class="sys-s">Form fields, segmented control, switch</h4><div class="sys-row"><label class="field"><span class="field-l">Issue</span><select aria-label="Issue (specimen)"><option>Every issue</option><option>Ferry levy</option></select></label>' +
      '<label class="field field-search"><span class="vh">Search (specimen)</span>' + ic('search') + '<input type="search" placeholder="Search headlines"></label><label class="field"><span class="field-l">Disabled</span><input type="text" value="Read-only key" disabled></label>' +
      '<div class="seg" role="radiogroup" aria-label="Segmented (specimen)"><button type="button" role="radio" aria-checked="true" class="seg-b" data-act="noop">Stable</button><button type="button" role="radio" aria-checked="false" class="seg-b" data-act="noop">Escalating</button></div>' +
      '<button type="button" class="switch" role="switch" aria-checked="true" data-act="noop" aria-label="Switch on (specimen)"><i></i></button><button type="button" class="switch" role="switch" aria-checked="false" data-act="noop" aria-label="Switch off (specimen)"><i></i></button></div>' +
      '<div class="sys-row"><textarea class="ta" rows="2" aria-label="Section text (specimen)">The petition post is the loudest item of the window [S:1].</textarea></div>' +
      '<h4 class="sys-s">The gap banner and notices</h4><div class="gapbanner"><div class="gap-tag">' + ic('alert') + '<span>Not collected</span></div><div class="gap-b"><strong>A channel delivered nothing in this window</strong><span class="gap-not">A gap, not a quiet day.</span><p>The reason is stated, and the one fix is one press away.</p></div><div class="gap-a">' + chip('Not yet named in the brief', 'warn-solid') + '</div></div>' +
      notice('info', 'Information', 'Everything here can be read and exported.') + notice('warn', 'The database is busy', 'Your words are kept on this computer.', btn('btn-secondary btn-sm', 'noop', 'Try again')) + notice('neg', 'The connection dropped', 'The draft may have finished on the worker.') + notice('pos', 'Filed', 'Final until reopened.') +
      '<h4 class="sys-s">Stepper, console, skeleton</h4><div class="sys-grid"><ol class="stepper"><li class="done"><span class="step-n">' + ic('check') + '</span><span>' + esc(DRAFT_STAGES[0]) + '</span></li><li class="now" aria-current="step"><span class="step-n">2</span><span>' + esc(DRAFT_STAGES[1]) + '</span></li><li><span class="step-n">3</span><span>' + esc(DRAFT_STAGES[2]) + '</span></li></ol>' +
      '<div class="console" aria-label="Console (specimen)"><p class="console-h"><span>finished</span><span>X · one bridge job · no model call</span></p><p>queued: X</p><p>$ sweep x --desk hf_au</p><p>12 hits, 9 Australian kept</p><p class="ln-ok">done in 4.2 s</p><p class="ln-bad">failed: no_collector</p></div>' +
      '<div>' + sk('70%', '22px') + sk('100%', '14px') + sk('92%', '14px') + sk('40%', '14px') + '</div></div>' +
      '<h4 class="sys-s">Empty and error states</h4><div class="sys-grid sys-grid-2">' + statePanel('empty', 'Nothing waits for a decision', 'An empty state says why, and offers the one action that fixes it.', btn('btn-primary btn-sm', 'noop', 'The one action')) + statePanel('error', 'It could not be read', 'An error says what did not arrive and never shows an empty panel in its place.', btn('btn-primary btn-sm', 'noop', 'Try again', { icon: 'refresh' })) + '</div>' +
      '<h4 class="sys-s">Dialog, drawer, toast</h4><div class="sys-grid"><div class="dialog dialog-static" aria-label="Dialog (specimen)"><header class="dlg-h"><h2>Before it is filed</h2></header><div class="dlg-b"><p>A dialog sits on the highest elevation, traps focus and closes on Esc.</p></div><footer class="dlg-f">' + btn('btn-quiet btn-sm', 'noop', 'Go back') + btn('btn-primary btn-sm', 'noop', 'File anyway') + '</footer></div>' +
      '<div class="dialog dialog-static drawer-static" aria-label="Drawer (specimen)"><header class="dlg-h"><h2>An item, opened</h2></header><div class="dlg-b"><p>The drawer slides from the right and holds one item: its text, outlets, weight and where it is cited.</p></div></div>' +
      '<div><div class="toast toast-static"><span>Set aside: Not relevant</span><button type="button" class="linkbtn" data-act="noop">Undo</button></div><div class="toast toast-static toast-warn"><span>This key is read-only: nothing was changed.</span></div><p class="sys-row">' + btn('btn-secondary btn-sm', 'help', 'Open the shortcuts dialog') + '</p></div></div></section></div>';
    return h;
  }

  /* ---------- overlays ---------- */
  function dlg(title, body, foot, o) {
    o = o || {};
    return '<div class="overlay"><div class="scrim" data-act="close"></div><div class="dialog' + (o.drawer ? ' drawer' : '') + (o.wide ? ' dialog-wide' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg-t" data-key="dlg:' + esc(o.key || title) + '">' +
      '<header class="dlg-h"><h2 id="dlg-t">' + title + '</h2><button type="button" class="iconbtn" data-act="close" aria-label="Close">' + ic('close') + '</button></header><div class="dlg-b">' + body + '</div>' + (foot ? '<footer class="dlg-f">' + foot + '</footer>' : '') + '</div></div>';
  }
  function kbd(keys, what) { return '<tr><th scope="row">' + keys.split(' ').map(function (k) { return k === 'or' || k === '+' ? ' ' + k + ' ' : '<kbd>' + esc(k) + '</kbd>'; }).join('') + '</th><td>' + esc(what) + '</td></tr>'; }
  function itemDrawer(d) {
    var r = Q.row(d.id); if (!r) return '';
    var w = Q.weight(r), sigs = sigFor(r.id), ci = Q.citedIn(r.id), st = statList(r);
    var b = '<p class="kicker"><span class="kick">' + esc(KIND_WORD[r.kind]) + ' · ' + esc(r.id) + '</span><span class="kick-i">' + esc(issueLabel(r.issue)) + '</span>' + marks(r) + '</p><h3 class="drawer-h">' + esc(r.title) + '</h3><p class="meta">' + metaLine(r) + '</p>';
    if (r.kind === 'media') b += '<p class="prose drawer-text">' + esc(r.text) + '</p><p class="meta">' + (r.subscriber ? 'Subscriber text, held apart from the archive: a brief quotes no more than thirty words.' : r.full ? 'Full text held.' : 'Headline and summary held.') + ' Layer ' + r.layer + ', a public route.</p>';
    else if (r.kind === 'social' || r.kind === 'actor') b += '<blockquote class="drawer-q">' + esc(r.text) + '</blockquote><p class="meta">' + (r.kind === 'social' ? 'The author is not recorded: nobody unregistered is named. ' : 'Named as a registered public actor on their own post. ') + 'Layer ' + r.layer + (r.layer === 2 ? ', the signed-in collector on the Mac.' : ', a public route.') +
      (r.comments ? ' Tone of ' + Q.fmt(r.comments) + ' held comments: ' + toneWord(r.tone) + '.' : '') + '</p>';
    else if (r.kind === 'narrative') b += '<p class="prose drawer-text"><b>The claim:</b> ' + esc(r.claim) + '.</p><p class="meta">Spread, in the order the channels took it up: ' + r.spread.map(esc).join(', then ') + '.</p>';
    else b += '<p class="prose drawer-text">As written: "' + esc(r.asWritten) + '"</p><p class="meta">' + esc(fmtDate(r.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + ', in ' + plural(Math.max(0, daysUntil(r.date)), 'day') + '. From ' + citeChip(r.from) + '</p>';
    if (st.length) b += '<dl class="stats stats-row">' + st.map(function (s) { return '<div class="stat"><dt>' + esc(s[1]) + '</dt><dd>' + esc(s[0]) + '</dd></div>'; }).join('') + '</dl>';
    if (r.also && r.also.length) b += '<p class="carried"><span class="lbl">Carried by</span> ' + esc(r.outlet) + ', ' + r.also.map(esc).join(', ') + '</p>';
    b += '<div class="drawer-w"><p class="lbl">Weight, and why</p>' + wt(w, true) + '<ul class="whylist">' + (w.why.length ? w.why.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '') + '<li>recency: ' + esc(Q.ago(r.t)) + '</li>' + (r.low ? '<li>marked low: held to 8 or under</li>' : '') + '</ul></div>';
    if (sigs.length) b += '<p class="lbl">Checks that name it</p><ul class="plain">' + sigs.map(function (s) { return '<li class="note"><p class="note-k">' + chip(s.label, SIG_TONE[s.sig] + '-solid') + '</p><p class="note-d"><b>' + esc(s.title) + '.</b> ' + esc(s.detail) + '</p></li>'; }).join('') + '</ul>';
    b += '<p class="lbl">In the brief</p>' + (ci.length ? '<p class="markrow">' + ci.map(function (s) { return '<a class="chip chip-pos" href="#brief" data-act="tosec" data-id="' + s + '">' + esc(secTitle(s)) + '</a>'; }).join(' ') + '</p>' : '<p class="meta">Not cited yet.</p>');
    var f = '';
    if (!RO()) {
      f = btn('btn-quiet btn-sm', 'aside', 'Set aside', { id: r.id, icon: 'tray' }) + btn('btn-secondary btn-sm', 'pin', S.pins[r.id] ? 'Unpin' : 'Pin', { id: r.id, icon: 'pin' }) +
        btn('btn-primary btn-sm', 'cite', 'Cite into ' + secShort(ui.sec), { id: r.id, icon: 'quote', disabled: S.brief.status !== 'draft' });
    }
    return dlg(esc(citeLabel(r)), b, f, { drawer: true, key: 'item' });
  }
  function overlays() {
    var d = ui.dialog, h = '';
    if (d) {
      try {
        if (d.type === 'shortcuts') {
          h += dlg('Keyboard shortcuts', '<table class="tbl tbl-keys"><tbody>' + kbd('j or k', 'Next or previous item') + kbd('p', 'Pin or unpin the item') + kbd('x', 'Set the item aside, with a reason') + kbd('o or Enter', 'Open the item') +
            kbd('c', 'Cite the item into the section being written') + kbd('e', 'On the brief below 1440 pixels: turn between edition and report') + kbd('u', 'Undo the last pin or set-aside') + kbd('Alt + 1 or 2 or 3 or 4 or 5', 'Edition, Brief, Watch, Collection, Options') +
            kbd('1 or 2 or 3 or 4 or 5', 'The same, when not typing') + kbd('Ctrl or Cmd + S', 'Save the brief') + kbd('?', 'This list') + kbd('Esc', 'Close a dialog or menu, or leave the text') + '</tbody></table>', btn('btn-primary btn-sm', 'close', 'Close', { auto: true }), { key: 'keys' });
        } else if (d.type === 'aside') {
          var r = Q.row(d.id);
          h += dlg('Set aside', '<p class="dlg-lead">' + esc(r ? r.title : '') + '</p><fieldset class="reasons"><legend>Why? The reason is kept with the row.</legend>' + Q.asideReasons().map(function (x, i) {
            return '<label class="radio"><input type="radio" name="aside-reason" value="' + esc(x) + '" data-ch="asidereason"' + (d.reason === x ? ' checked' : '') + (i === 0 ? ' data-autofocus="1"' : '') + '><span>' + esc(x) + '</span></label>';
          }).join('') + '</fieldset>' + (d.reason === 'Other' ? '<label class="field field-wide"><span class="field-l">In a few words</span><input type="text" data-in="asideother" value="' + esc(d.other || '') + '"></label>' : '') +
            '<p class="dim">A set-aside row leaves the edition and the draft. It can be put back from the Set aside list.</p>', btn('btn-quiet btn-sm', 'close', 'Cancel') + btn('btn-danger btn-sm', 'asidego', 'Set aside', { disabled: d.reason === 'Other' && !(d.other || '').trim() }), { key: 'aside' });
        } else if (d.type === 'mute') {
          h += dlg('Mute ' + esc(d.offer.value) + '?', '<p class="dlg-lead">That is the third row from this ' + esc(d.offer.kind) + ' set aside on this desk.</p><p>Muting hides every row from <b>' + esc(d.offer.value) + '</b> on this desk only. It is listed in Options and can be unmuted there. Nothing is muted unless you say so.</p>',
            btn('btn-quiet btn-sm', 'close', 'Not now', { auto: true }) + btn('btn-danger btn-sm', 'mutego', 'Mute on this desk', { icon: 'mute' }), { key: 'mute' });
        } else if (d.type === 'draft') {
          var n = Q.rows({}).length, edited = Q.sections().filter(function (s) { return !s.built && S.brief.sections[s.id].edited && S.brief.sections[s.id].text.trim(); }).length, has = S.brief.status === 'draft';
          h += dlg(has ? 'Draft again?' : 'Draft the brief', '<dl class="draft-f"><div><dt>Evidence</dt><dd>' + n + ' rows</dd></div><div><dt>Pinned</dt><dd>' + Q.counts().pinned + '</dd></div><div><dt>Set aside</dt><dd>' + Q.counts().aside + '</dd></div><div><dt>Cost</dt><dd>1 model call</dd></div></dl>' +
            '<p>One model call writes ten sections from the window\'s evidence, pinned rows first. Set-aside rows are left out. ' + S.calls.used + ' of ' + S.calls.cap + ' calls are used today.</p>' +
            (has && edited ? notice('warn', plural(edited, 'section') + ' edited by hand will be replaced', 'To keep them, regenerate single sections instead.') : '') +
            (Q.signals().some(function (s) { return s.sig === 'gap'; }) ? '<p class="dim">A channel was not collected in this window: the draft cannot know what it would have shown.</p>' : ''),
            btn('btn-quiet btn-sm', 'close', 'Cancel') + btn('btn-primary btn-sm', 'draftgo', has ? 'Draft again' : 'Draft the brief', { cost: '1 model call', auto: true }), { key: 'draft' });
        } else if (d.type === 'regen') {
          var sx = S.brief.sections[d.id];
          h += dlg('Regenerate ' + esc(secTitle(d.id)), (sx && sx.edited && sx.text.trim() ? notice('warn', 'This section was edited by ' + esc(sx.by), 'Regenerating replaces those words with a new draft of this section.') : '') +
            '<label class="field field-wide"><span class="field-l">An instruction, if any</span><input type="text" data-in="regeninstr" data-autofocus="1" value="' + esc(d.instr || '') + '" placeholder="For example: shorter, lead with the crossbench"></label><p class="dim">One model call, for this section only. The other sections are untouched.</p>',
            btn('btn-quiet btn-sm', 'close', 'Cancel') + btn('btn-primary btn-sm', 'regengo', 'Regenerate', { cost: '1 model call' }), { key: 'regen' });
        } else if (d.type === 'file') {
          var fc = Q.flagCount();
          h += dlg('Before it is filed', '<p class="dlg-lead">' + plural(d.uncovered.length, 'check') + ' on this window ' + (d.uncovered.length === 1 ? 'is' : 'are') + ' neither cited nor named in the brief.</p><ul class="plain">' + d.uncovered.map(function (s) {
            return '<li class="note"><p class="note-k">' + chip(s.label, SIG_TONE[s.sig] + '-solid') + '</p><p class="note-d"><b>' + esc(s.title) + '.</b> ' + esc(s.detail) + '</p></li>';
          }).join('') + '</ul>' + (fc ? notice('warn', plural(fc, 'sentence') + ' flagged', 'A flagged sentence has no evidence behind it, or cites an id the window does not hold.') : '') + '<p class="dim">This list is shown once. A filed brief is final until it is reopened.</p>',
            btn('btn-secondary btn-sm', 'fileback', 'Go back and cover them', { auto: true }) + btn('btn-danger btn-sm', 'fileanyway', 'File anyway'), { key: 'file' });
        } else if (d.type === 'history') {
          var hs = S.brief.history.slice().reverse(), changed = Q.sections().filter(function (s) { return !s.built && S.brief.sections[s.id].edited; });
          h += dlg('History', '<ol class="plain hist">' + hs.map(function (x, i) { return '<li><span class="hist-r">Revision ' + x.rev + '</span><span>' + (x.by === 'drafted' ? 'Drafted, 1 model call' : 'Saved by ' + esc(x.by)) + '</span><span class="meta">' + esc(Q.ago(x.at)) + '</span>' + (i === 0 ? chip('Latest saved', 'pos') : '') + '</li>'; }).join('') + '</ol>' +
            '<p class="lbl">Against the draft</p>' + (changed.length ? '<ul class="plain">' + changed.map(function (s) { return '<li class="aside-row"><span class="aside-t">' + esc(s.title) + '</span>' + chip('Changed by ' + S.brief.sections[s.id].by, 'info') + '<span class="meta">' + plural(Q.words(s.id), 'word') + '</span></li>'; }).join('') + '</ul>' : '<p class="meta">Every section is as drafted.</p>') +
            '<p class="dim">The last sixty revisions of a brief are kept.</p>', '', { drawer: true, key: 'history' });
        } else if (d.type === 'item') h += itemDrawer(d);
      } catch (e) { console.error(e); h += dlg('This could not be shown', '<p>' + esc(e.message) + '</p>', btn('btn-primary btn-sm', 'close', 'Close', { auto: true }), { key: 'err' }); }
    }
    var t = S.toast;
    if (t) {
      h += '<div class="toast' + (t.kind === 'warn' ? ' toast-warn' : '') + '" role="' + (t.kind === 'warn' ? 'alert' : 'status') + '" data-key="toast:' + t.at + '"><span>' + esc(t.text) + '</span>' +
        (ui.undoAt === t.at && S.undo.length ? '<button type="button" class="linkbtn" data-act="undo">Undo</button>' : '') + '<button type="button" class="iconbtn iconbtn-sm" data-act="toastclose" aria-label="Dismiss this message">' + ic('close') + '</button></div>';
    }
    return h;
  }

  /* ---------- render: string -> morph ---------- */
  function viewHTML() {
    var fn = { today: viewToday, brief: viewBrief, watch: viewWatch, collection: viewCollection, options: viewOptions, system: viewSystem }[ui.route] || viewToday;
    try { return fn(); } catch (e) {
      console.error(e);
      return '<div class="state state-error" role="alert"><div class="state-mark" aria-hidden="true">' + ic('alert') + '</div><h2>This view could not be drawn</h2><p>' + esc(e && e.message) + '</p><div class="state-a"><a class="btn btn-secondary" href="#today"><span>Back to the edition</span></a></div></div>';
    }
  }
  function appHTML() {
    var chrome; try { chrome = masthead(); } catch (e) { console.error(e); chrome = '<header class="mast"><div class="mast-row"><div class="nameplate"><span class="np-t">Anne\'s Den</span></div></div></header>'; }
    var over; try { over = overlays(); } catch (e2) { console.error(e2); over = ''; }
    return '<div id="app" data-route="' + ui.route + '" data-density="' + esc(S.options.density) + '" data-role="' + esc(S.role) + '">' + chrome +
      '<main id="main" class="main main-' + ui.route + '" tabindex="-1" data-key="main:' + ui.route + '">' + viewHTML() + '</main>' + over + '</div>';
  }
  function same(a, b) {
    if (a.nodeType !== b.nodeType) return false; if (a.nodeType !== 1) return true;
    return a.tagName === b.tagName && a.getAttribute('data-key') === b.getAttribute('data-key');
  }
  function morph(from, to) {
    var fa = from.attributes, ta = to.attributes, i, n;
    for (i = fa.length - 1; i >= 0; i--) { n = fa[i].name; if (!to.hasAttribute(n) && !(n === 'style' && from.tagName === 'TEXTAREA')) from.removeAttribute(n); }
    for (i = 0; i < ta.length; i++) { if (from.getAttribute(ta[i].name) !== ta[i].value) from.setAttribute(ta[i].name, ta[i].value); }
    var tag = from.tagName;
    if (tag === 'TEXTAREA') { var v = to.textContent; if (from.value !== v) from.value = v; return; }
    if (tag === 'INPUT') {
      if (from.type === 'radio' || from.type === 'checkbox') from.checked = to.hasAttribute('checked');
      else if (document.activeElement !== from) { var nv = to.getAttribute('value') || ''; if (from.value !== nv) from.value = nv; }
      return;
    }
    morphKids(from, to);
    if (tag === 'SELECT') { var so = to.querySelector('option[selected]'); from.value = so ? so.value : (to.options.length ? to.options[0].value : ''); }
  }
  function morphKids(from, to) {
    var keyed = {}, c, k;
    for (c = from.firstChild; c; c = c.nextSibling) { if (c.nodeType === 1) { k = c.getAttribute('data-key'); if (k) keyed[k] = c; } }
    var fc = from.firstChild, tc = to.firstChild, tn, m, nx;
    while (tc) {
      tn = tc.nextSibling; m = null; k = tc.nodeType === 1 ? tc.getAttribute('data-key') : null;
      if (k && keyed[k] && keyed[k].tagName === tc.tagName) { m = keyed[k]; delete keyed[k]; if (m === fc) fc = fc.nextSibling; else from.insertBefore(m, fc); }
      else if (!k) {
        /* skip over keyed leftovers so they can be matched later or removed at the end */
        var probe = fc; while (probe && probe.nodeType === 1 && probe.getAttribute('data-key')) probe = probe.nextSibling;
        if (probe && same(probe, tc)) { m = probe; if (m === fc) fc = fc.nextSibling; else from.insertBefore(m, fc); }
      }
      if (m) { if (m.nodeType === 1) morph(m, tc); else if (m.nodeValue !== tc.nodeValue) m.nodeValue = tc.nodeValue; }
      else from.insertBefore(tc, fc);
      tc = tn;
    }
    while (fc) { nx = fc.nextSibling; from.removeChild(fc); fc = nx; }
  }
  var pending = false, prevDlg = null, lastFocus = null, lastToast = 0, prevRoute = null;
  function render() { if (pending) return; pending = true; Promise.resolve().then(flush); }
  function flush() {
    pending = false;
    var tpl = document.createElement('template');
    try { tpl.innerHTML = appHTML(); morph(app, tpl.content.firstChild); }
    catch (e) { console.error(e); app.innerHTML = '<div class="state state-error" role="alert"><h2>The page could not be drawn</h2><p>' + esc(e && e.message) + '</p><p><a href="#today" onclick="location.reload()">Reload</a></p></div>'; return; }
    after();
  }
  function after() {
    var i, tas = app.querySelectorAll('textarea.ta');
    for (i = 0; i < tas.length; i++) { tas[i].style.height = 'auto'; tas[i].style.height = (tas[i].scrollHeight + 2) + 'px'; }
    document.title = (ROUTES.filter(function (r) { return r.id === ui.route; })[0] || ROUTES[0]).label + ' - Anne\'s Den, concept B';
    var dk = ui.dialog ? ui.dialog.type + ':' + (ui.dialog.id || '') : null;
    if (dk !== prevDlg) {
      if (dk) { var dEl = app.querySelector('.dialog[role="dialog"]'); if (dEl) { var af = dEl.querySelector('[data-autofocus]') || focusables(dEl)[0] || dEl; try { af.focus(); } catch (e) {} } }
      else if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e2) {} }
      prevDlg = dk;
    }
    if (prevRoute !== ui.route) { if (prevRoute !== null) window.scrollTo(0, 0); prevRoute = ui.route; }
    if (ui.focusSec) {
      ui.focusSec = false;
      var ta = document.getElementById('ta-' + ui.sec), se = document.getElementById('sec-' + ui.sec);
      if (ui.scrollSec && se) se.scrollIntoView({ block: 'start' });
      ui.scrollSec = false;
      if (ta) { try { ta.focus({ preventScroll: true }); var p = ui.pendingCaret != null ? ui.pendingCaret : ta.value.length; ta.setSelectionRange(p, p); } catch (e3) {} if (se) se.scrollIntoView({ block: 'nearest' }); }
      ui.pendingCaret = null;
    } else if (ui.pendingCaret != null) {
      var t2 = document.getElementById('ta-' + ui.sec); if (t2 && document.activeElement === t2) { try { t2.setSelectionRange(ui.pendingCaret, ui.pendingCaret); } catch (e4) {} }
      ui.pendingCaret = null;
    }
    if (ui.focusSel) {
      ui.focusSel = false;
      var el = ui.sel ? app.querySelector('.main [data-item="' + cssq(ui.sel) + '"]') : null;
      if (el) { try { el.focus({ preventScroll: true }); } catch (e5) {} el.scrollIntoView({ block: 'nearest' }); }
    }
    if (ui.scrollTo) { var st = document.getElementById(ui.scrollTo); ui.scrollTo = null; if (st) st.scrollIntoView({ block: 'center' }); }
    var t = S.toast;
    if (t && t.at !== lastToast) { lastToast = t.at; var at = t.at; setTimeout(function () { if (S.toast && S.toast.at === at) A.clearToast(); }, 5200); }
  }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function focusables(root) {
    return Array.prototype.filter.call(root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'), function (e) { return e.offsetParent !== null || e === document.activeElement; });
  }

  /* ---------- actions ---------- */
  function openDialog(d) { if (!ui.dialog) lastFocus = document.activeElement; ui.dialog = d; ui.menu = null; render(); }
  function closeDialog() { ui.dialog = null; render(); }
  function toast(text, kind, undo) { A.say(text, kind); if (undo && S.toast) ui.undoAt = S.toast.at; render(); }
  function itemIds() { return Array.prototype.map.call(app.querySelectorAll('.main [data-item]'), function (e) { return e.getAttribute('data-item'); }); }
  function move(dir) {
    var ids = itemIds(); if (!ids.length) return;
    var i = ids.indexOf(ui.sel); i = i < 0 ? (dir > 0 ? 0 : ids.length - 1) : Math.max(0, Math.min(ids.length - 1, i + dir));
    ui.sel = ids[i]; ui.focusSel = true; render();
  }
  function goTo(id) {
    if (!Q.row(id)) { toast('That id is not in the window\'s evidence.', 'warn'); return; }
    ui.sel = id;
    if (ui.route === 'brief' && !ui.facing) ui.pane = 'edition';
    if (ui.route !== 'today' && ui.route !== 'brief') { location.hash = '#today'; ui.route = 'today'; }
    if (ui.route === 'brief' && ui.ff !== 'all') ui.ff = 'all';
    ui.dialog = null; render();
    Promise.resolve().then(function () {
      Promise.resolve().then(function () {
        var el = app.querySelector('.main [data-item="' + cssq(id) + '"]');
        if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} el.scrollIntoView({ block: 'center' }); }
        else openDialog({ type: 'item', id: id }); /* in the noise drawer, set aside or filtered out: open it instead */
      });
    });
  }
  function citeInto(id) {
    var r = Q.row(id); if (!r) return;
    if (RO()) { toast('This key is read-only: nothing was changed.', 'warn'); return; }
    if (S.brief.status === 'filed') { toast('The brief is filed. Reopen it to cite into it.', 'warn'); return; }
    if (S.brief.status !== 'draft' || S.brief.drafting) { toast('There is no brief to cite into yet. Draft it, or write by hand.', 'warn'); return; }
    var s = sec(ui.sec); if (!s || s.built) ui.sec = 'summary';
    var x = S.brief.sections[ui.sec], pos = ui.caretSec === ui.sec && ui.caret != null ? Math.min(ui.caret, x.text.length) : null;
    var p = pos == null ? x.text.length : pos, head = x.text.slice(0, p).replace(/\s+$/, ''), mark = ' [' + id + ']';
    ui.pendingCaret = head.length + mark.length; ui.caret = ui.pendingCaret;
    A.cite(ui.sec, id, pos);
    toast('Cited ' + citeLabel(r) + ' into ' + secTitle(ui.sec) + '.', 'info');
  }
  function doAside(id, reason) {
    var ids = itemIds(), i = ids.indexOf(id), next = ids[i + 1] || ids[i - 1] || null;
    var res = A.aside(id, reason) || {};
    if (ui.sel === id) { ui.sel = next; ui.focusSel = !!next; }
    ui.dialog = null;
    if (res.offer) { ui.dialog = { type: 'mute', offer: res.offer }; render(); }
    else toast('Set aside: ' + reason + '.', 'info', true);
  }
  function copy(text, html, done) {
    function fb() {
      var t = document.createElement('textarea'); t.value = text; t.setAttribute('aria-hidden', 'true'); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} document.body.removeChild(t); done(ok);
    }
    try {
      if (html && navigator.clipboard && window.ClipboardItem) { navigator.clipboard.write([new window.ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]).then(function () { done(true); }, fb); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(function () { done(true); }, fb); return; }
    } catch (e) {}
    fb();
  }
  function download(name, text, type) {
    try { var u = URL.createObjectURL(new Blob([text], { type: type })), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(function () { URL.revokeObjectURL(u); }, 2000); return true; } catch (e) { return false; }
  }
  function setTheme(pref) {
    ui.themePref = pref; try { localStorage.setItem('den_b_theme', pref); } catch (e) {}
    ui.theme = pref === 'auto' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', ui.theme); render();
  }
  var acts = {
    noop: function () {},
    back: function () { toast('In production this returns to AXIOM, where you left it. The prototype is isolated and has nowhere to go.', 'info'); },
    menu: function (el) { var id = el.getAttribute('data-id'); ui.menu = ui.menu === id ? null : id; render(); },
    desk: function (el) { ui.menu = null; ui.sel = null; A.setDesk(el.getAttribute('data-id')); render(); },
    mode: function (el) {
      var m = el.getAttribute('data-id'); ui.menu = null;
      A.setRole(m === 'readonly' ? 'read' : 'full'); A.setMode(m);
      if (m === 'filed' && S.brief.status !== 'filed') A.file({ acknowledge: true });
      if (m === 'loading') setTimeout(function () { if (S.mode === 'loading') A.setMode('normal'); }, 2200);
      if (m === 'dropped') toast('Draft the brief to see the connection drop mid-draft.', 'info');
      render();
    },
    conflict: function () { ui.menu = null; if (S.brief.status !== 'draft') { toast('A conflict needs a draft brief.', 'warn'); return; } A.simulateConflict(); ui.sec = 'summary'; ui.pane = 'report'; ui.scrollTo = 'sec-summary'; location.hash = '#brief'; render(); },
    simmute: function () { ui.menu = null; openDialog({ type: 'mute', offer: { kind: 'outlet', value: 'Harbour Mail' } }); },
    simtoast: function () { toast('Set aside: Not relevant.', 'info', true); },
    theme: function () { setTheme(ui.theme === 'dark' ? 'light' : 'dark'); },
    themeset: function (el) { setTheme(el.getAttribute('data-id')); },
    help: function () { openDialog({ type: 'shortcuts' }); },
    close: function () { closeDialog(); },
    toastclose: function () { A.clearToast(); },
    retry: function () { A.retry(); },
    sel: function (el) { var id = el.getAttribute('data-id'); if (ui.sel !== id) { ui.sel = id; if (Q.row(id)) A.markRead(id); render(); } },
    pin: function (el) { A.pin(el.getAttribute('data-id')); render(); },
    aside: function (el) { openDialog({ type: 'aside', id: el.getAttribute('data-id'), reason: Q.asideReasons()[0], other: '' }); },
    asidego: function () { var d = ui.dialog; if (!d) return; doAside(d.id, d.reason === 'Other' ? 'Other: ' + (d.other || '').trim() : d.reason); },
    mutego: function () { var d = ui.dialog; ui.dialog = null; if (d && d.offer) A.mute(d.offer.kind, d.offer.value); render(); },
    restore: function (el) { A.restore(el.getAttribute('data-id')); render(); },
    unmute: function (el) { A.unmute(el.getAttribute('data-id')); render(); },
    undo: function () { A.undo(); render(); },
    open: function (el) { var id = el.getAttribute('data-id'); ui.sel = id; openDialog({ type: 'item', id: id }); },
    cite: function (el) { citeInto(el.getAttribute('data-id')); },
    'goto': function (el) { goTo(el.getAttribute('data-id')); },
    tocoll: function (el) { ui.sel = 'ch:' + el.getAttribute('data-id'); ui.scrollTo = 'ch-' + el.getAttribute('data-id'); },
    noise: function () { ui.noise = !ui.noise; render(); },
    showaside: function () { ui.showAside = !ui.showAside; render(); },
    pinnedonly: function () { ui.pinnedOnly = !ui.pinnedOnly; render(); },
    clearfilters: function () { ui.search = ''; ui.issue = ''; ui.pinnedOnly = false; render(); },
    ff: function (el) { ui.ff = el.getAttribute('data-id'); render(); },
    pane: function (el) { ui.pane = el.getAttribute('data-id'); render(); },
    activate: function (el, e) { if (!editable()) return; ui.sec = el.getAttribute('data-id'); ui.caretSec = null; ui.caret = null; ui.focusSec = true; render(); },
    tosec: function (el, e) { if (e) e.preventDefault(); ui.sec = el.getAttribute('data-id'); ui.pane = 'report'; ui.dialog = null; ui.caretSec = null; ui.focusSec = true; ui.scrollSec = true; if (ui.route !== 'brief') location.hash = '#brief'; render(); },
    firstflag: function () { var s = Q.sections().filter(function (x) { return !x.built && Q.flags(x.id).length; })[0]; if (s) { ui.sec = s.id; ui.focusSec = true; ui.scrollSec = true; render(); } },
    draft: function () { openDialog({ type: 'draft' }); },
    draftgo: function () { ui.dialog = null; A.draft(function () { toast('The draft is in. Every sentence is tied to its row; flags mark the ones that are not.', 'info'); }); render(); },
    checkdraft: function () { A.checkDraft(); },
    byhand: function () { A.byHand(); ui.sec = 'summary'; ui.focusSec = true; render(); },
    regen: function (el) { openDialog({ type: 'regen', id: el.getAttribute('data-id'), instr: '' }); },
    regengo: function () { var d = ui.dialog; if (!d) return; ui.dialog = null; var id = d.id; A.regenerate(id, d.instr, function () { toast(secTitle(id) + ' was regenerated.', 'info'); }); render(); },
    save: function () { A.save(); },
    file: function () {
      if (S.brief.save === 'unsaved' || S.brief.save === 'failed') { A.save(); if (S.brief.save === 'failed') return; }
      var r = A.file() || {};
      if (r.uncovered) openDialog({ type: 'file', uncovered: r.uncovered }); else if (r.filed) toast('Filed. The brief is final until it is reopened.', 'info');
    },
    fileanyway: function () { ui.dialog = null; var r = A.file({ acknowledge: true }) || {}; if (r.filed) toast('Filed, with the uncovered checks acknowledged.', 'info'); render(); },
    fileback: function () { var d = ui.dialog; ui.dialog = null; ui.ff = 'uncovered'; if (!ui.facing) ui.pane = 'edition'; var first = d && d.uncovered.filter(function (s) { return s.item; })[0]; if (first) { ui.sel = first.item; ui.focusSel = true; } render(); },
    reopen: function () { A.reopen(); toast('Reopened. It is a draft again.', 'info'); },
    resolve: function (el) { var w = el.getAttribute('data-id'); A.resolve(w); toast(w === 'theirs' ? 'Their version is in the section.' : 'Your version stands.', 'info'); },
    history: function () { openDialog({ type: 'history' }); },
    rating: function (el) { A.setRating(el.getAttribute('data-id'), el.getAttribute('data-k'), el.getAttribute('data-v')); },
    'export': function (el) {
      var f = el.getAttribute('data-id'), name = S.desk + '-' + S.brief.day; ui.menu = null;
      if (f === 'md') toast(download(name + '.md', Q.exportAs('md'), 'text/markdown') ? 'Downloaded ' + name + '.md' : 'The download was refused by this browser.', 'info');
      else if (f === 'html') toast(download(name + '.html', '<!doctype html><meta charset="utf-8"><title>' + esc(name) + '</title>' + Q.exportAs('html'), 'text/html') ? 'Downloaded ' + name + '.html' : 'The download was refused by this browser.', 'info');
      else if (f === 'slack') copy(Q.exportAs('slack'), null, function (ok) { toast(ok ? 'The Slack summary is on the clipboard.' : 'The clipboard was refused by this browser.', ok ? 'info' : 'warn'); });
      else copy(Q.exportAs('md'), Q.exportAs('html'), function (ok) { toast(ok ? 'Copied for the document: formatted and plain text.' : 'The clipboard was refused by this browser.', ok ? 'info' : 'warn'); });
      render();
    },
    pv: function (el) { var id = el.getAttribute('data-id'); ui.pv[id] = !ui.pv[id]; render(); },
    dm: function (el) { var id = el.getAttribute('data-id'); ui.dm[id] = !ui.dm[id]; render(); },
    approve: function (el) { var id = el.getAttribute('data-id'), p = S.proposals.filter(function (x) { return x.id === id; })[0]; A.decide(id, 'approve', { issue: ui.ai[id] || '' }); if (p && !RO()) { ui.regKind = p.kind; toast('Approved: ' + p.value + (ui.ai[id] ? ', under ' + issueLabel(ui.ai[id]) : ', searched for and tagging nothing') + '.', 'info'); } },
    dismissgo: function (el) { var id = el.getAttribute('data-id'), p = S.proposals.filter(function (x) { return x.id === id; })[0], why = (ui.dr[id] || '').trim(); if (why.length < 3) return; A.decide(id, 'dismiss', { reason: why }); if (p && !RO()) toast('Dismissed: ' + p.value + '. It will not be proposed again.', 'info'); },
    regkind: function (el) { ui.regKind = el.getAttribute('data-id'); render(); },
    regtoggle: function (el) { A.toggleRegister(el.getAttribute('data-id')); },
    collect: function (el) { ui.sel = 'ch:' + el.getAttribute('data-id'); A.collect(el.getAttribute('data-id')); },
    chtoggle: function (el) { A.toggleChannel(el.getAttribute('data-id')); },
    opt: function (el) { var k = el.getAttribute('data-id'); A.setOption(k, !S.options[k]); },
    optv: function (el) { A.setOption(el.getAttribute('data-id'), el.getAttribute('data-v')); }
  };

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-act]') : null;
    if (ui.menu && !(e.target.closest && e.target.closest('.menu-wrap'))) { ui.menu = null; render(); }
    if (!t || t.disabled) return;
    var a = t.getAttribute('data-act');
    if (a === 'sel' && e.target.closest('button,a,select,input,textarea')) return;
    if (a === 'activate' && e.target.closest('.cite')) return;
    if (t.tagName === 'A' && a !== 'tosec' && a !== 'tocoll') { /* let the link navigate */ }
    try { if (acts[a]) acts[a](t, e); } catch (err) { console.error(err); A.say('That did not work: ' + err.message, 'warn'); }
  });
  document.addEventListener('dblclick', function (e) {
    var t = e.target.closest ? e.target.closest('[data-item]') : null;
    if (t && !e.target.closest('button,a,select,input,textarea') && Q.row(t.getAttribute('data-item'))) openDialog({ type: 'item', id: t.getAttribute('data-item') });
  });
  document.addEventListener('input', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-in'); if (!k) return;
    if (k === 'edit') { var sid = t.getAttribute('data-sec'); ui.caret = t.selectionStart; ui.caretSec = sid; A.edit(sid, t.value); }
    else if (k === 'search') { ui.search = t.value; render(); }
    else if (k === 'dr') { ui.dr[t.getAttribute('data-id')] = t.value; render(); }
    else if (k === 'asideother' && ui.dialog) { ui.dialog.other = t.value; render(); }
    else if (k === 'regeninstr' && ui.dialog) { ui.dialog.instr = t.value; }
  });
  document.addEventListener('change', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-ch'); if (!k) return;
    if (k === 'issue') { ui.issue = t.value; render(); }
    else if (k === 'sec') { ui.sec = t.value; ui.caretSec = null; render(); }
    else if (k === 'ai') { ui.ai[t.getAttribute('data-id')] = t.value; render(); }
    else if (k === 'asidereason' && ui.dialog) { ui.dialog.reason = t.value; render(); }
    else if (k === 'minint') { A.setOption('minInteractions', Math.max(0, Number(t.value) || 0)); }
  });
  function trackCaret(e) { var t = e.target; if (t && t.tagName === 'TEXTAREA' && t.getAttribute('data-sec')) { ui.caret = t.selectionStart; ui.caretSec = t.getAttribute('data-sec'); } }
  document.addEventListener('keyup', trackCaret); document.addEventListener('mouseup', trackCaret); document.addEventListener('focusout', trackCaret);
  function placeCard(e) {
    var c = e.target && e.target.closest ? e.target.closest('.cite') : null; if (!c || !c.getBoundingClientRect) return;
    var box = c.closest('.page') || document.documentElement, right = box === document.documentElement ? window.innerWidth : box.getBoundingClientRect().right;
    c.classList.toggle('cite-r', c.getBoundingClientRect().left + 310 > right);
  }
  document.addEventListener('mouseover', placeCard);
  document.addEventListener('focusin', function (e) {
    var t = e.target; placeCard(e);
    if (t && t.getAttribute && t.hasAttribute('data-item') && ui.sel !== t.getAttribute('data-item')) { ui.sel = t.getAttribute('data-item'); render(); }
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    var k = e.key;
    if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'S')) {
      e.preventDefault();
      if (RO()) toast('This key is read-only: nothing was changed.', 'warn'); else if (S.brief.status === 'filed') toast('The brief is filed. Reopen it to change it.', 'warn'); else if (S.brief.status === 'draft') A.save();
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.metaKey && /^Digit[1-6]$/.test(e.code || '')) { e.preventDefault(); location.hash = '#' + ROUTES[Number(e.code.slice(5)) - 1].id; return; }
    if (k === 'Escape') {
      if (ui.dialog) { e.preventDefault(); closeDialog(); return; }
      if (ui.menu) { e.preventDefault(); ui.menu = null; render(); return; }
      if (typing) { t.blur(); return; }
      if (ui.sel) { ui.sel = null; render(); } return;
    }
    if (ui.dialog) {
      if (k === 'Tab') {
        var dEl = app.querySelector('.dialog[role="dialog"]'); if (!dEl) return; var f = focusables(dEl); if (!f.length) { e.preventDefault(); return; }
        var first = f[0], last = f[f.length - 1];
        if (!dEl.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      return;
    }
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    var row = ui.sel ? Q.row(ui.sel) : null;
    if (k === '?') { e.preventDefault(); openDialog({ type: 'shortcuts' }); }
    else if (k === 'j' || k === 'ArrowDown' && t && t.hasAttribute && t.hasAttribute('data-item')) { e.preventDefault(); move(1); }
    else if (k === 'k' || k === 'ArrowUp' && t && t.hasAttribute && t.hasAttribute('data-item')) { e.preventDefault(); move(-1); }
    else if (/^[1-5]$/.test(k)) { e.preventDefault(); location.hash = '#' + ROUTES[Number(k) - 1].id; }
    else if (k === 'e' && ui.route === 'brief' && !ui.facing) { ui.pane = ui.pane === 'report' ? 'edition' : 'report'; render(); }
    else if (k === 'u' && !RO() && S.undo.length) { A.undo(); }
    else if (row && k === 'p') { e.preventDefault(); if (RO()) toast('This key is read-only: nothing was changed.', 'warn'); else { A.pin(row.id); render(); } }
    else if (row && k === 'x') { e.preventDefault(); if (RO()) toast('This key is read-only: nothing was changed.', 'warn'); else openDialog({ type: 'aside', id: row.id, reason: Q.asideReasons()[0], other: '' }); }
    else if (row && k === 'c') { e.preventDefault(); citeInto(row.id); }
    else if (row && (k === 'o' || (k === 'Enter' && t && t.hasAttribute && t.hasAttribute('data-item')))) { e.preventDefault(); openDialog({ type: 'item', id: row.id }); }
    else if (ui.route === 'watch' && ui.sel && k === 'o') { ui.pv[ui.sel] = !ui.pv[ui.sel]; render(); }
  });
  function readRoute() { var h = (location.hash || '').replace(/^#/, ''); if (h === 'main') { var mEl = document.getElementById('main'); if (mEl) mEl.focus(); return; } ui.route = ROUTES.some(function (r) { return r.id === h; }) ? h : 'today'; ui.menu = null; if (ui.dialog && ui.dialog.type !== 'shortcuts') ui.dialog = null; }
  window.addEventListener('hashchange', function () { readRoute(); render(); });
  function measure() { var w = window.innerWidth || 1366, a = w >= 1680, b = w >= 1440; if (a !== ui.wide || b !== ui.facing) { ui.wide = a; ui.facing = b; return true; } return false; }
  window.addEventListener('resize', function () { if (measure()) render(); });
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (ui.themePref === 'auto') setTheme('auto'); }); } catch (e) {}
  setInterval(function () { if (S.brief.drafting && !S.brief.drafting.dropped) render(); }, 1000);

  D.on(render);
  measure(); readRoute(); flush();
})();
