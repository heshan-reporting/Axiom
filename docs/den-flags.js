/* AXIOM - Anne's Den: Check before you send (build p72, lane P2 "flags"; spec v3 Part B with Part D's words, UX-SPEC
 * s.4.5, s.6.3, s.8.3, s.10 and s.12.3). One part file, loaded before docs/den-brief.js, that gives window.DenFlags:
 *
 *   covered(check, cites, covers, text)  the one cover rule (spec rule 3) on the page, as the worker files: a strip check is
 *                                        covered when the brief cites one of its cover ids, or a row a cited id stands for
 *                                        (covers: the view's map), in a sentence of four words or more of its own (rule 2),
 *                                        or when its words appear. cites null: worked out from text by the four-word rule.
 *   list({brief, texts, desk, signals, cards, filing, secOf})  the worker's flags (kept while their sentence is still in the
 *                                        live text) and the page's three kinds (check, pinned, empty), in brief order, each
 *                                        { key, kind, section, ..., left?, open }. null when the worker does not serve
 *                                        review and flags (rule 9: nothing new shows, today's page stands).
 *   count(list[, section])               the one count: open flags of every kind, minus those left (A2 P15, G2 N9).
 *   why(kind, flag[, ctx])               the plain "what happened, why it matters" line (UX-SPEC s.8.3).
 *   land(container, flag[, {focus}])     brings the flag's target into view in a container (the workbench's section page or
 *                                        Today's document): its sentence, its word, a check's or a pinned row's card, the
 *                                        rating's select, an empty section's editor; outlines it; returns it.
 *   Panel                                the "Check before you send" component, one for both rooms (props: h, layout).
 *   useBrief(o)                          the hook BriefPanel calls once: the list, the count, the panel's state and actions.
 *
 * Nothing here spends. Text fixes go through the host's save (one revision check); marks through POST /den/brief/review.
 * Styles: docs/den-flags.css. */
(function () {
  'use strict';
  const ABBR = /(?<![A-Za-z])(?:Dr|Mr|Mrs|Ms|Mx|Prof|Sr|Jr|St|Mt|Ft|Sen|Hon|Rev|Gen|Lt|Col|Capt|Sgt|Cpl|Insp|Supt|Det|Cmdr|Adm|Gov|Pres|No|Nos|Fig|Vol|vs|approx|ca|cf|e\.g|i\.e)\.$/;
  const MARKS = /\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g;
  /** The worker's denPlain: every citation mark removed, white space collapsed. */
  const plain = s => String(s == null ? '' : s).replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
  const idsIn = s => Array.from(new Set((String(s || '').match(MARKS) || []).map(x => x.slice(1, -1))));
  /** A sentence's own words: tokens with a letter or a digit once the marks are struck (rule 2). */
  const own = s => plain(s).split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length;
  /** One paragraph cut into sentences the way the worker's denSentences cuts it: after . ! ? or ] before a capital, a quote
   *  or a mark; never after a title or a common abbreviation ("Dr. Chalmers"). */
  function split(par) {
    const p = String(par == null ? '' : par); const rx = /(?<=[.!?\]])\s+(?=[A-Z"'[])/g; const cuts = []; let at = 0, m;
    while ((m = rx.exec(p))) { cuts.push([at, m.index]); at = m.index + m[0].length; } cuts.push([at, p.length]);
    const out = []; cuts.forEach(c => { const last = out[out.length - 1]; if (last && ABBR.test(p.slice(last[0], last[1]))) last[1] = c[1]; else out.push(c.slice()); });
    return out.map(c => p.slice(c[0], c[1]));
  }
  /** Every sentence of a text with where it stands in it: { start, end, raw, plain, cites }. */
  function spans(text) {
    const t = String(text == null ? '' : text).replace(/\r/g, ''); const out = []; const pr = /\n\n+/g; let p0 = 0, m; const paras = [];
    while ((m = pr.exec(t))) { paras.push([p0, m.index]); p0 = m.index + m[0].length; } paras.push([p0, t.length]);
    paras.forEach(([a, b]) => { const p = t.slice(a, b); let from = 0;
      split(p).forEach(s => { const i = p.indexOf(s, from); if (i < 0) return; from = i + s.length; const lead = s.length - s.replace(/^\s+/, '').length; const r = s.trim(); if (!r) return;
        out.push({ start: a + i + lead, end: a + i + lead + r.length, raw: r, plain: plain(r), cites: idsIn(r) }); }); });
    return out;
  }
  const textsOf = x => (typeof x === 'string' ? [x] : Array.isArray(x) ? x : x && typeof x === 'object' ? Object.keys(x).map(k => x[k]) : []).map(v => String(v == null ? '' : v));
  /** The ids a text cites; min > 0: only in sentences with at least that many words of their own (the worker's denBriefCites). */
  function citesOf(texts, min) { const out = new Set(); textsOf(texts).forEach(t => spans(t).forEach(x => { if (x.cites.length && (!min || own(x.raw) >= min)) x.cites.forEach(c => out.add(c)); })); return out; }
  function covered(check, cites, covers, text) {
    if (!check) return false; const C = cites == null ? citesOf(text, 4) : cites instanceof Set ? cites : new Set(cites || []);
    const all = new Set(C); const cv = covers || {}; C.forEach(c => (Array.isArray(cv[c]) ? cv[c] : []).forEach(x => all.add(x)));
    const low = textsOf(text).join('\n').toLowerCase();
    return (check.cover || []).some(c => all.has(c)) || (check.words || []).some(w => w && low.indexOf(String(w).toLowerCase()) >= 0);
  }
  /** The worker serves corrections and flags (spec rule 9): the view carries review and flags. */
  const supported = b => !!(b && b.review && typeof b.review === 'object' && Array.isArray(b.flags));
  const visible = desk => { const hid = (desk && desk.options && Array.isArray(desk.options.hidden)) ? desk.options.hidden : []; return ((desk && desk.sections) || []).filter(s => s.kind !== 'sources' && hid.indexOf(s.id) < 0); };
  const KIND_SEC = { media: ['media'], social: ['social', 'developments'], actors: ['actors'], narratives: ['narratives', 'developments'], upcoming: ['developments', 'summary'] };
  const secOfKind = (secs, kinds) => { for (const k of kinds || []) { const s = secs.find(x => x.kind === k || x.id === k); if (s) return s.id; } return (secs[0] || {}).id || ''; };
  const EMPTY_WHY = { media: 'no stories were collected in this reporting period', social: 'no posts were collected in this reporting period', actors: 'no posts from people and organisations were collected in this reporting period', narratives: 'no narrative gained stories or posts in this reporting period', upcoming: 'no date ahead was found in this reporting period' };
  const CARD_KIND = { media: 'media', social: 'social', actors: 'actors', narratives: 'narratives', upcoming: 'upcoming' };
  const RANK = { check: 1, pinned: 2, empty: 3 };
  const leftOf = m => (m && typeof m === 'object' ? { by: m.by || '', at: Number(m.at) || 0, note: m.note || '' } : undefined);

  function list(o) {
    o = o || {}; const b = o.brief; if (!supported(b)) return null;
    const desk = o.desk || {}; const secs = visible(desk); const bs = b.sections || {}; const over = o.over || {};
    const T = id => String((o.texts && o.texts[id] != null ? o.texts[id] : (bs[id] || {}).text) || '');
    const marks = (b.review && b.review.marks) || {}; const filed = b.status === 'filed'; const items = [];
    const isLeft = (key, dflt) => (Object.prototype.hasOwnProperty.call(over, key) ? over[key] || undefined : dflt);
    // a worker flag stands on the saved words: while a section's live words differ, it is kept only while its sentence is still there
    const live = {}; secs.forEach(s => { const t = T(s.id); live[s.id] = t === String((bs[s.id] || {}).text || '') ? null : new Set(spans(t).map(x => x.plain)); });
    (b.flags || []).forEach(f => { if (!f || !f.key || !secs.some(s => s.id === f.section)) return; const L = live[f.section];
      if (L && f.kind !== 'rating' && f.sentence && !L.has(f.sentence)) return; const left = isLeft(f.key, f.left); items.push(Object.assign({}, f, { left, open: !left && !filed })); });   // a sent report has nothing left to check
    if (!filed) {
      const all = {}; Object.keys(bs).forEach(k => { all[k] = T(k); }); secs.forEach(s => { all[s.id] = T(s.id); }); const body = Object.keys(all).map(k => all[k]).join('\n');
      const cites = citesOf(all, 4), any = citesOf(all, 0), covers = b.covers || {}; const anyCovers = new Set(any); any.forEach(c => (covers[c] || []).forEach(x => anyCovers.add(x)));
      if (Array.isArray(o.signals)) o.signals.filter(s => s && s.sig !== 'gap' && s.key).forEach(s => { if (covered(s, cites, covers, body)) return; const m = marks[s.key];
        const left = isLeft(s.key, m && m.kind === 'check' ? leftOf(m) : undefined); let sec = ''; try { sec = o.secOf ? o.secOf(s) || '' : ''; } catch (e) { sec = ''; }
        items.push({ key: s.key, kind: 'check', section: secs.some(x => x.id === sec) ? sec : '', sig: s, left, open: !left }); });
      if (Array.isArray(o.cards)) o.cards.filter(c => c && c.pin && c.pinned && c.cite).forEach(c => { if (anyCovers.has(c.cite)) return; const key = 'pin:' + c.cite; const m = marks[key];
        const f = o.filing && o.filing[c.key]; const sec = f && secs.some(x => x.id === f) ? f : c.wsec && secs.some(x => x.id === c.wsec) ? c.wsec : secOfKind(secs, KIND_SEC[c.kind]);
        const left = isLeft(key, m && m.kind === 'pinned' ? leftOf(m) : undefined); items.push({ key, kind: 'pinned', section: sec, card: c, item: c.cite, left, open: !left }); });
      const have = {}; (o.cards || []).forEach(c => { have[CARD_KIND[c.kind]] = (have[CARD_KIND[c.kind]] || 0) + 1; });
      secs.forEach(s => { if (T(s.id).trim()) return; const key = 'empty:' + s.id; const m = marks[key]; const why = o.cards && EMPTY_WHY[s.kind] && !have[s.kind] ? EMPTY_WHY[s.kind] : '';
        const left = isLeft(key, m && m.kind === 'empty' ? leftOf(m) : undefined); items.push({ key, kind: 'empty', section: s.id, title: s.title, reason: why, left, open: !left }); });
    }
    const at = id => { const i = secs.findIndex(s => s.id === id); return i < 0 ? 1e6 : i; };
    return items.map((x, i) => ({ x, i })).sort((p, q) => (at(p.x.section) - at(q.x.section)) || ((RANK[p.x.kind] || 0) - (RANK[q.x.kind] || 0)) || (p.i - q.i)).map(p => p.x);
  }
  const count = (l, sec) => (Array.isArray(l) ? l.filter(x => x.open && (sec == null || x.section === sec)).length : 0);
  /** The order the list shows (p72 review U5): more than three open items of one kind are one row, at the place of the first of
   *  them, so they are moved together there; the walk, the numbers on the list and in the report follow this one order. */
  function shown(l) {
    if (!Array.isArray(l)) return l; const by = {}; l.forEach(f => { if (f.open) by[f.kind] = (by[f.kind] || 0) + 1; }); if (!Object.keys(by).some(k => by[k] > 3)) return l;
    const out = [], put = new Set(); l.forEach(f => { if (put.has(f)) return; if (f.open && by[f.kind] > 3) { l.forEach(x => { if (x.open && x.kind === f.kind && !put.has(x)) { out.push(x); put.add(x); } }); return; } out.push(f); put.add(f); });
    return out;
  }
  /** A section's state in one chip, the one count first: "2 to check", else what its words are (never "Flagged N"). */
  function state(sec, text, nCards, n) {
    if (n) return [n + ' to check', 'warn', n];
    if (String(text || '').trim()) return sec && sec.edited ? ['Edited', 'pos', 0] : ['Drafted', 'acc', 0];
    return nCards ? ['Has evidence', 'info', 0] : ['Empty', '', 0];
  }

  /* ---- words (UX-SPEC s.4.5 and s.6.3; no Den word: no evidence, row, card, pin, strip, flag, cite) ---- */
  const SIGN = { spike: 'A spike', emerging: 'An emerging story', outlier: 'A post with unusual reach', first_seen: 'A new voice', burst: 'An issue busier than usual' };
  const TITLE = { dropped: 'A sentence that lost its source', figure: 'A figure not found in its source', figure_bare: 'A figure with no source', trimmed: 'A paywalled quote cut to 30 words',
    mark: 'A source number with no sentence', pinned: 'A must-mention story the report doesn\'t mention', denwords: 'A word readers won\'t know', compare: 'A comparison with nothing to compare',
    unread: 'Names a platform that wasn\'t read today', rating: 'A rating today\'s coverage doesn\'t support' };
  function title(f) {
    if (!f) return ''; if (f.kind === 'check') return (SIGN[f.sig && f.sig.sig] || 'An alert') + ' the report doesn\'t mention';
    if (f.kind === 'empty') return 'Nothing written under ' + (f.title || f.section); return TITLE[f.kind] || 'Something to check';
  }
  const KIND_MANY = { check: n => n + ' alerts the report doesn\'t mention', pinned: n => n + ' must-mention stories the report doesn\'t mention', empty: n => n + ' sections with nothing written' };
  const many = (kind, n) => (KIND_MANY[kind] ? KIND_MANY[kind](n) : (TITLE[kind] || 'Something to check') + ', in ' + n + ' sentences');
  /** An alert's subject and figure in words, never the worker's detail sentence (UX-SPEC s.6.4). */
  function subject(s) {
    if (!s) return ''; const t = String(s.title || ''); const f = s.fig && typeof s.fig === 'object' ? s.fig : null;
    if (s.sig === 'spike') return f && f.label ? f.label + ': ' + f.hot + ' stories in six hours, about ' + f.ratio + ' times the usual' : t.replace(/^Sentinel spike:\s*/, '');
    if (s.sig === 'emerging') return t.replace(/^Emerging narrative(?: \(working title\))?:\s*/, '');
    if (s.sig === 'burst') return t.replace(/ is running above its baseline$/, '') + (/\((\d+(?:\.\d+)?) times\)/.test(String(s.detail || '')) ? ': about ' + /\((\d+(?:\.\d+)?) times\)/.exec(String(s.detail))[1] + ' times the usual' : '');
    return t.replace(/^A registered /, 'An ').replace(/ posted on this desk for the first time in fourteen days$/, ' posted for the first time in two weeks').replace(/ named on this desk's issues for the first time in fourteen days$/, ' named for the first time in two weeks');
  }
  function where(f, desk) {
    if (!f) return ''; const st = id => ((desk && desk.sections) || []).find(s => s.id === id); const sec = (st(f.section) || {}).title || f.section || '';
    if (f.kind === 'check') return subject(f.sig); if (f.kind === 'empty') return f.reason ? 'Why: ' + f.reason : 'Nothing is written under it yet';
    if (f.kind === 'pinned') { const c = f.card || {}; const r = c.r || {}; return [r.outlet || r.who || (c.kind === 'social' ? 'A post' : ''), String(c.title || '').slice(0, 90)].filter(Boolean).join(' \u00b7 '); }
    if (f.kind === 'rating') return f.sentence || sec; if ((f.kind === 'denwords' || f.kind === 'unread') && f.word) return sec + ' \u00b7 ' + f.word;
    return sec;
  }
  /** The why line (UX-SPEC s.4.5, s.8.3): what happened and why it matters for the client, with the figures the flag carries. */
  function why(kind, f, ctx) {
    f = f || {}; ctx = ctx || {}; const fig = Array.isArray(f.figures) && f.figures.length ? f.figures.join(', ') : '';
    switch (kind) {
      case 'dropped': return 'The AI gave this sentence a source that didn\'t back it up, so the source was taken out. Every sentence the client reads should rest on a source in the Source List.';
      case 'figure': return '"' + (fig || 'The figure') + '" isn\'t in the story or post this sentence points to' + (ctx.source ? ' (' + ctx.source + ')' : '') + '. A wrong figure is the mistake a reader notices first.';
      case 'figure_bare': return '"' + (fig || 'The figure') + '" has no source behind it in this sentence.';
      case 'trimmed': return 'Quotes from subscriber stories are cut at 30 words. Check the cut still reads well; "Leave it" is fine if it does.';
      case 'mark': return 'A source number stands without a sentence of its own, so it supports nothing.';
      case 'check': return 'The Den noticed this today, and the report doesn\'t mention it yet. Mention it in a sentence, or say why it\'s left out.';
      case 'pinned': { const who = (f.card && f.card.r && f.card.r.pinned_by) || ctx.who || ''; return (who || 'Someone') + ' marked this story must-mention.'; }
      case 'empty': return 'This section is empty, so it won\'t be in the copy.';
      case 'denwords': return '"' + (f.word || 'This word') + '" is the Den\'s word for its own work; readers won\'t know it.' + (/^the client$/i.test(String(f.word || '')) ? ' Name who is meant.' : '');
      case 'compare': return 'This sentence compares with an earlier report, and no earlier report was sent.';
      case 'unread': return (f.word || 'This platform') + ' wasn\'t read in this reporting period.';
      case 'rating': { const s = String(f.sentence || ''); const c = s.indexOf(': '); const lab = c > 0 ? s.slice(0, c) : 'The rating'; const lv = c > 0 ? s.slice(c + 2) : s;
        return lab + ' is ' + lv + ' while ' + (f.word || 'an issue') + ' runs at ' + (fig || 'well above its usual') + '.'; }
      default: return '';
    }
  }
  /* The fixes of each kind, the usual one first (UX-SPEC s.4.5; spec v3 Part B). mark: true marks it left (POST /den/brief/review). */
  const FX = {
    source: 'Choose a source', delete: 'Delete the sentence', edit: 'Edit the sentence', right: 'The figure is right', view: 'View source', leave: 'Leave it',
    write: 'Write the sentence', unnum: 'Remove the number', mention: 'Write a sentence for it', out: 'Leave it out', mine: 'Write it myself', add: 'Add a new source (paste a link)',
    change: 'Change it', stands: 'The rating stands'
  };
  const FIXES = { dropped: ['source', 'delete', 'edit'], figure: ['edit', 'right', 'view'], figure_bare: ['source', 'edit', 'right'], trimmed: ['leave', 'edit'], mark: ['write', 'unnum'],
    check: ['mention', 'out'], pinned: ['mention', 'out'], empty: ['mine', 'add'], denwords: ['edit'], compare: ['edit', 'leave'], unread: ['edit', 'leave'], rating: ['change', 'stands'] };
  const MARKING = { right: 1, leave: 1, out: 1, stands: 1 };
  const REASONS = ['Not relevant to this report', 'Already covered in other words', 'Too small to report'];
  const DONE = { right: 'Marked: the figure is right', leave: 'Left as it is', out: 'Left out', stands: 'Marked: the rating stands', delete: 'Deleted the sentence', unnum: 'Removed the number', source: 'Source added', edit: 'Saved', write: 'Saved', mention: 'Saved', mine: 'Saved', change: 'Saved' };

  /** Brings a flag's target into view inside a container and outlines it (the landing table: spec v3 Part B, UX-SPEC s.4.5). */
  function land(root, f, o) {
    o = o || {}; if (!root || !f || !root.querySelector) return null; const esc = s => String(s).replace(/["\\]/g, '\\$&'); let el = null;
    try {
      el = root.querySelector('[data-flag-keys~="' + esc(f.key) + '"]');
      if (!el && f.kind === 'check') el = root.querySelector('[data-check="' + esc(f.key) + '"]');
      if (!el && f.kind === 'pinned') el = root.querySelector('[data-ev="' + esc(f.item) + '"]') || root.querySelector('[data-pinkey="' + esc(f.item) + '"]');
      if (!el && f.kind === 'rating') el = root.querySelector('select[data-rating="' + esc(f.item) + '"]');
      if (!el && f.kind === 'empty') el = root.querySelector('[data-section="' + esc(f.section) + '"] textarea');
      if (!el && f.section) el = root.querySelector('[data-section="' + esc(f.section) + '"] .den-docbody') || root.querySelector('[data-section="' + esc(f.section) + '"]');
    } catch (e) { el = null; }
    if (!el) return null;
    Array.from(root.querySelectorAll('.den-fl-on')).forEach(x => { if (x !== el) x.classList.remove('den-fl-on'); }); el.classList.add('den-fl-on');
    try { el.scrollIntoView({ block: o.block || 'center', inline: 'nearest' }); } catch (e) {}   // never smooth: no motion to reduce
    if (o.focus) { if (!(el.tabIndex >= 0) && !/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1'); try { el.focus({ preventScroll: true }); } catch (e) {} }
    return el;
  }
  /** For the reading text: given a sentence, the open flags it carries, each used once (keys: the sentence's; words: the
   *  words or figures marked inside it, each with its own key). */
  function matcher(flags) {
    const used = new Set(); const fl = (flags || []).filter(f => f && f.open && f.sentence && f.kind !== 'rating');
    const fn = raw => { const p = plain(raw); if (!p) return null; const hit = fl.filter(f => !used.has(f.key) && f.sentence === p); if (!hit.length) return null; hit.forEach(f => used.add(f.key));
      const words = []; const keys = [];
      hit.forEach(f => { const w = f.kind === 'denwords' ? f.word : (f.kind === 'figure' || f.kind === 'figure_bare') && Array.isArray(f.figures) && f.figures[0] ? String(f.figures[0]) : '';
        if (w && wordRx(w).test(raw)) words.push({ w, key: f.key }); else keys.push(f.key); });
      return { keys, words, all: hit.map(f => f.key) }; };
    fn.rest = () => fl.filter(f => !used.has(f.key));
    return fn;
  }
  const wordRx = w => new RegExp('(?<![A-Za-z0-9_-])' + String(w).split(/\s+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+') + '(?![A-Za-z0-9_])', 'i');
  /** Pieces of a run of text with the given words picked out: [string | {w, key, text}]. */
  function pick(text, words) {
    let out = [String(text || '')]; (words || []).forEach(x => { const next = []; let done = false;
      out.forEach(p => { if (done || typeof p !== 'string') { next.push(p); return; } const m = wordRx(x.w).exec(p); if (!m) { next.push(p); return; } done = true;
        if (m.index) next.push(p.slice(0, m.index)); next.push({ w: x.w, key: x.key, text: m[0] }); if (m.index + m[0].length < p.length) next.push(p.slice(m.index + m[0].length)); });
      out = next; }); return out;
  }

  /* ---- the text fixes, on a section's words ---- */
  function locate(text, f) { const S = spans(text); const i = f && f.sentence ? S.findIndex(x => x.plain === f.sentence) : -1; return i < 0 ? null : S[i]; }
  function cutSentence(text, sp) {
    const t = String(text || ''); let a = sp.start, b = sp.end; const after = t.slice(b).match(/^[ \t]*/)[0].length; const before = t.slice(0, a).match(/[ \t]*$/)[0].length;
    if (after) b += after; else if (before) a -= before;
    return t.slice(0, a) + t.slice(b).replace(/^\n{3,}/, '\n\n');
  }
  function dropMarks(text, sp) { const t = String(text || ''); const inner = sp.raw.replace(/\s*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g, ''); if (!own(inner)) return cutSentence(t, sp); return t.slice(0, sp.start) + inner.replace(/\s+([.!?])$/, '$1') + t.slice(sp.end); }
  /** Where a source number goes: before the sentence's final stop (and any closing quote). */
  function beforeStop(sp) { const m = /[.!?]["'\u201d\u2019)\]]*$/.exec(sp.raw.replace(/\s*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]\s*$/, '')); const raw0 = sp.raw.replace(/\s*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]\s*$/, ''); return sp.start + (m ? raw0.length - m[0].length : raw0.length); }

  /* ---- storage: the first ten sends show each item's why line (UX-SPEC s.8.3) ---- */
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const sends = () => { const n = Number(lsGet('ax_den_sends', 0)); return isFinite(n) && n > 0 ? n : 0; };
  const sent = () => lsSet('ax_den_sends', sends() + 1);

  const DenFlags = { covered, citesOf, supported, list, shown, count, state, why, title, where, subject, land, matcher, pick, split, spans, plain, own, sends, sent, FIXES, FX, REASONS, wordRx, locate };
  window.DenFlags = DenFlags;
  if (!window.React || !window.AXUI || !window.AXUI.html) return;   // the pure part still stands; the page shows today's Den
  const html = window.AXUI.html; const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const fmtT = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const when = ts => (ts ? fmtT.format(new Date(+ts)) : '');
  const errSay = e => { const m = String((e && e.message) || e || ''); return !e || e.status === 0 || (/Failed to fetch|NetworkError|Load failed|network/i.test(m) && !e.code) ? 'the connection to AXIOM dropped before an answer came back' : m.replace(/\.$/, ''); };

  /** The hook BriefPanel calls once, before any early return. o: { L, brief, work, desk, signals, cards, filing, secOf,
   *  canWrite, past, dirty, revision, change, saveRef, setOpenSec, carets, wrap, call, toast }. */
  function useBrief(o) {
    const b = o.brief || null; const on = supported(b); const desk = o.desk; const secs = useMemo(() => visible(desk), [desk]);
    const texts = b && o.work && o.work.id === b.id ? o.work.sections : null;
    const [over, setOver] = useState({}); const [openKey, setOpenKey] = useState(''); const [pend, setPend] = useState(null); const [undo, setUndo] = useState(null);
    const [said, setSaid] = useState(''); const [errs, setErrs] = useState({}); const [note, setNote] = useState(''); const [focusReq, setFocusReq] = useState(null);
    const queued = useRef(null); const liveRef = useRef(null); const sref = useRef(null); sref.current = o.saveState || null;
    useEffect(() => { setOver({}); }, [b && b.id, b && b.review_rev]);   // the worker's answer replaces what was shown before it came
    const items = useMemo(() => (on ? shown(list({ brief: b, texts, desk, signals: o.signals, cards: o.cards, filing: o.filing, over, secOf: s => (o.secOf ? o.secOf(s, secs) : '') })) : null), [on, b, texts, desk, o.signals, o.cards, o.filing, over]);   // eslint-disable-line
    const n = count(items); const filed = !!(b && b.status === 'filed'); const canFix = !!(on && o.canWrite && !filed);
    // a save asked for right after a text change runs once the change has been drawn (the host's save reads its state)
    useEffect(() => { const r = queued.current; if (!r) return; queued.current = null; Promise.resolve(o.saveRef && o.saveRef.current ? o.saveRef.current() : true).then(r, () => r(false)); }, [o.work]);   // eslint-disable-line
    const root = () => (o.root ? o.root() : (o.wrap && o.wrap.current) || null);
    const say = t => { if (o.say) { o.say(t); return; } setSaid(''); setTimeout(() => setSaid(t), 30); };
    // the words as they stand now, read through refs, so an Undo pressed seconds later compares with the present, not the render it was made in
    const tref = useRef(null); tref.current = texts; const bref = useRef(null); bref.current = b;
    const T = sec => { const tx = tref.current, bb = bref.current; return String((tx && tx[sec] != null ? tx[sec] : ((bb && bb.sections && bb.sections[sec]) || {}).text) || ''); };
    const api = {
      root, text: T, canFix, filed, past: !!o.past, count: n,
      save: () => Promise.resolve(o.saveRef && o.saveRef.current ? o.saveRef.current() : true),
      saveText: (sec, t) => new Promise(r => { queued.current = r; o.change(sec, t); }),
      setText: (sec, t) => o.change(sec, t),
      open: sec => { if (o.open) { o.open(sec); return; } if (sec && o.setOpenSec) o.setOpenSec(sec); },
      edit: (sec, a, z, then) => { if (o.edit) { o.edit(sec, a, z, then); return; } api.open(sec); setTimeout(() => { const r = root(); const ta = r && Array.from(r.querySelectorAll('.den-sec textarea')).find(x => x.closest('.den-sec').getAttribute('data-section') === sec); if (!ta) return;
        const L = ta.value.length; const p = a == null ? L : Math.min(a, L); const q = z == null ? p : Math.min(z, L); if (o.carets) o.carets.current[sec] = p; try { ta.focus({ preventScroll: false }); ta.setSelectionRange(p, q); } catch (e) {} if (then) setTimeout(then, 30); }, 50); },
      /* p72 review P1: the answer is put on the brief as the last answer left it (o.latest, BriefPanel's), never on the brief of the
         render the press was made in: a save that answered meanwhile (a newer revision, newer words) is kept */
      review: async ops => { const id = b.id; const d = await o.call('/den/brief/review', { id, ops }); if (!d || d.ok !== true || !d.review) { const e = new Error('AXIOM sent something this page can\'t read. Nothing was changed'); e.code = 'bad_answer'; throw e; }
        const cur = (o.latest && o.latest.current) || bref.current; if (!cur || cur.id !== id) return d;
        const marks = d.review.marks || {}; const flags = (cur.flags || []).map(f => { const m = marks[f.key]; const x = Object.assign({}, f); if (m) x.left = { by: m.by || '', at: m.at, note: m.note || '' }; else delete x.left; return x; });
        const nb = Object.assign({}, cur, { review: d.review, review_rev: d.review_rev, flags }); if (o.latest) o.latest.current = nb; o.L.set({ ok: true, brief: nb }); return d; },
      /** p72 review P8: an editor a fix opened, closed with its words as they were saved: no save will follow, so nothing waits for one. */
      endEdit: sec => setPend(p => (p && p.mode === 'edit' && p.sec === sec && T(sec) === String((((bref.current && bref.current.sections) || {})[sec] || {}).text || '') ? null : p)),
      paneTo: sel => setTimeout(() => { const r = root(); const el = r && r.querySelector(sel); if (el) { try { el.scrollIntoView({ block: 'nearest' }); } catch (e) {} el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 1800); } }, 120)
    };
    const at = (it, how) => { if (!it) return; api.open(it.section); setOpenKey(it.key); setFocusReq({ key: it.key, how: how || 'fix', t: Date.now() }); };
    useEffect(() => { if (!focusReq || !items) return; const it = items.find(x => x.key === focusReq.key); const tm = setTimeout(() => { const r = root(); if (it) land(r, it, { focus: focusReq.how === 'target' });
      const box = document.querySelector('[data-fl-item="' + String(focusReq.key).replace(/["\\]/g, '\\$&') + '"]'); if (focusReq.how === 'fix' && box) { const btn = box.querySelector('.den-fx.go') || box.querySelector('.den-fl-t'); if (btn) btn.focus({ preventScroll: true }); }
      else if (focusReq.how === 'toggle' && box) { const t = box.querySelector('.den-fl-t'); if (t) t.focus({ preventScroll: true }); } }, 70); return () => clearTimeout(tm); }, [focusReq]);   // eslint-disable-line
    const openList = items ? items.filter(x => x.open) : [];
    const nextFrom = (idx, skip) => { const L = items ? items.filter(x => x.open && x.key !== skip) : []; if (!L.length) return null; const after = items.slice(idx).find(x => x.open && x.key !== skip); return after || L[0]; };
    const first = async how => { if (o.dirty) { const ok = await api.save(); if (!ok) return; } const it = openList[0]; if (it) { at(it, how); say((1) + ' of ' + openList.length + ': ' + title(it) + ', ' + where(it, desk)); } };
    // after a fix the next item opens by itself (UX-SPEC s.4.5): when the save or the mark has answered and the item is gone
    useEffect(() => { if (!pend || !items) return;
      // p72 review P8: a fix made while another save was in flight waits for that save's answer before it takes the revision to wait past
      if (pend.mode === 'edit' && pend.rev == null) { if (!(o.saveState && o.saveState.s === 'saving')) setPend(p => (p && p.rev == null ? Object.assign({}, p, { rev: o.revision || 0 }) : p)); return; }
      if (pend.mode === 'edit' && (o.dirty || (o.revision || 0) === pend.rev)) return;
      const still = items.find(x => x.key === pend.key && x.open); const p = pend; setPend(null);
      if (still) { if (p.mode === 'edit') { setErrs(e => Object.assign({}, e, { [p.key]: { soft: true, t: 'Saved. This is still to check: the words did not clear it.' } })); setOpenKey(p.key); } return; }
      const nx = nextFrom(p.idx, p.key); const left = count(items);
      if (nx) { at(nx, 'fix'); say((p.done ? p.done + '. ' : '') + left + ' to check. Next: ' + title(nx) + '.'); }
      // after the last fix: on Today the room moves the focus once, to Copy for Google Docs (UX-SPEC s.10.3; p72 review U9); the workbench takes it to the heading
      else { setOpenKey(''); say((p.done ? p.done + '. ' : '') + 'Nothing left to check.'); setFocusReq({ key: '', how: 'none', t: Date.now() }); if (o.layout !== 'today') setTimeout(() => { const h = document.querySelector('.den-checks-h'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }, 90); }
    }, [items, o.dirty, o.revision, pend, o.saveState && o.saveState.s]);   // eslint-disable-line
    // p72 review U7: on Today a failure is said in the room's one alert region (o.alert); the words under the item are plain text
    const saidErr = useRef({});
    useEffect(() => { if (!o.alert) return; Object.keys(saidErr.current).forEach(k => { if (!errs[k] || errs[k].t !== saidErr.current[k]) delete saidErr.current[k]; });
      Object.keys(errs).forEach(k => { const e = errs[k]; if (e && !e.soft && e.t && saidErr.current[k] !== e.t) { saidErr.current[k] = e.t; o.alert(e.t); } }); }, [errs]);   // eslint-disable-line
    useEffect(() => { if (!undo) return; const t = setTimeout(() => setUndo(null), 10000); return () => clearTimeout(t); }, [undo]);
    const idxOf = key => (items || []).findIndex(x => x.key === key);
    const fail = (key, what, e) => { setErrs(x => Object.assign({}, x, { [key]: { t: what + ' didn\'t go through: ' + errSay(e) + '. Nothing changed.' } })); setOpenKey(key); };
    const holdFocus = () => { const reg = document.querySelector('.den-checks-list'); if (reg && reg.contains(document.activeElement)) reg.focus({ preventScroll: true }); };
    /** Marks flags as left (who, when, note) through the review route; shown at once, put back if the route says no. */
    const mark = async (its, how, noteText) => { if (!canFix) return; const L = its.filter(Boolean); if (!L.length) return; const f0 = L[0];
      const ops = L.map(f => Object.assign({ op: 'leave', key: f.key, kind: f.kind }, f.kind === 'check' ? {} : { sec: f.section || '' }, noteText ? { note: noteText } : {}, f.kind === 'check' ? { fig: (f.sig && (f.sig.fig || f.sig.detail)) || undefined } : {}));
      setErrs(x => { const y = Object.assign({}, x); L.forEach(f => delete y[f.key]); return y; }); setUndo(null); holdFocus();
      const was = {}; L.forEach(f => { was[f.key] = Object.prototype.hasOwnProperty.call(over, f.key) ? over[f.key] : null; });
      setOver(v => { const y = Object.assign({}, v); L.forEach(f => { y[f.key] = { by: 'you', at: Date.now(), note: noteText || '' }; }); return y; });
      const done = DONE[how] || 'Left as it is'; setPend({ key: f0.key, mode: 'mark', idx: idxOf(f0.key), done });
      try { await api.review(ops); setUndo({ text: done, kind: 'mark', keys: L.map(f => f.key), note: how === 'right' || how === 'stands' ? { f: f0 } : null, run: () => unmark(L, true) }); }
      catch (e) { setPend(null); setOver(v => { const y = Object.assign({}, v); L.forEach(f => { delete y[f.key]; }); return y; }); fail(f0.key, how === 'out' ? 'Leaving it out' : 'Marking it', e); at(f0, 'fix'); } };
    const unmark = async (its, isUndo) => { if (!canFix) return; const L = its.filter(Boolean); if (!L.length) return; setUndo(null);
      setOver(v => { const y = Object.assign({}, v); L.forEach(f => { y[f.key] = null; }); return y; });
      try { await api.review(L.map(f => ({ op: 'unleave', key: f.key }))); say((isUndo ? 'Undone. ' : 'Put back on the list. ') + count(items) + ' to check.'); if (isUndo) at(L[0], 'fix'); }
      catch (e) { setOver(v => { const y = Object.assign({}, v); L.forEach(f => { delete y[f.key]; }); return y; }); setErrs(x => Object.assign({}, x, { ['left:' + L[0].key]: { t: 'Putting it back didn\'t go through: ' + errSay(e) + '. Nothing changed.' } })); } };
    const noteOn = async (f, t) => { try { await api.review([Object.assign({ op: 'leave', key: f.key, kind: f.kind }, f.kind === 'check' ? {} : { sec: f.section || '' }, { note: t })]); say('Note added.'); setUndo(null); } catch (e) { setErrs(x => Object.assign({}, x, { note: { t: 'The note didn\'t go through: ' + errSay(e) + '. Nothing changed.' } })); } };
    /** A text fix: the words change and are saved through the host's save (its revision check); Undo puts them back the same way. */
    const textFix = async (f, how, next) => { if (!canFix) return; const sec = f.section; const before = T(sec); if (next == null || next === before) return; setUndo(null); holdFocus();
      setErrs(x => { const y = Object.assign({}, x); delete y[f.key]; return y; }); const done = DONE[how]; setPend({ key: f.key, mode: 'edit', rev: o.revision || 0, idx: idxOf(f.key), done });
      const ok = await api.saveText(sec, next);
      if (!ok) { await new Promise(r => setTimeout(r, 40)); const st = sref.current; const why0 = st && st.s === 'bad' && st.msg ? st.msg : 'the save was refused';   // the host said why on its save line
        setPend(null); o.change(sec, before); fail(f.key, done === 'Deleted the sentence' ? 'Deleting the sentence' : 'Removing the number', why0); at(f, 'fix'); return; }
      setUndo({ text: done, kind: 'text', run: async () => { const rv = o.revRef ? o.revRef.current : null; const now = T(sec);
        if (now !== next) { setErrs(x => Object.assign({}, x, { undo: { t: 'The words changed after this fix, so Undo can\'t put them back safely. Nothing was changed.' } })); return; }
        const ok2 = await api.saveText(sec, before); if (ok2) say('Undone. The sentence is back.'); else { o.change(sec, now); setErrs(x => Object.assign({}, x, { undo: { t: 'Undo didn\'t go through: the report changed after this fix (or the save was refused). Nothing was changed.' } })); }
        void rv; } }); };
    /** A fix where the person writes: the editor opens where it should; the item stays open until the save answers. */
    const writeFix = (f, a, z, then) => { if (!canFix) return; setErrs(x => { const y = Object.assign({}, x); delete y[f.key]; return y; }); setUndo(null);
      setPend({ key: f.key, sec: f.section, mode: 'edit', rev: o.saveState && o.saveState.s === 'saving' ? null : (o.revision || 0), idx: idxOf(f.key), done: 'Saved' }); api.edit(f.section, a, z, then); };
    const fix = (f, how, arg) => {
      const t = T(f.section); const sp = locate(t, f);
      switch (how) {
        case 'right': case 'leave': case 'stands': return mark([f], how);
        case 'out': return mark([f].concat(arg && arg.also ? arg.also : []), 'out', arg && arg.note);
        case 'delete': return sp ? textFix(f, 'delete', cutSentence(t, sp)) : writeFix(f, null);
        case 'unnum': return sp ? textFix(f, 'unnum', dropMarks(t, sp)) : writeFix(f, null);
        case 'source': return writeFix(f, sp ? beforeStop(sp) : null, null, () => { const r = root(); const c = r && (r.querySelector('.den-evpane [data-tour="suggested"] .den-evcard:not([disabled])') || r.querySelector('.den-evpane .den-evcard:not([disabled])')); if (c) c.focus({ preventScroll: false }); });
        case 'edit': { if (!sp) return writeFix(f, null); const w = f.kind === 'denwords' ? f.word : (f.kind === 'figure' || f.kind === 'figure_bare') && f.figures && f.figures[0] ? String(f.figures[0]) : '';
          const m = w ? wordRx(w).exec(sp.raw) : null; return m ? writeFix(f, sp.start + m.index, sp.start + m.index + m[0].length) : writeFix(f, beforeStop(sp)); }
        case 'write': { if (!sp) return writeFix(f, null); const i = sp.raw.search(/\[[A-Z]:/); return writeFix(f, i >= 0 ? sp.start + i : sp.start); }
        case 'mention': { writeFix(f, null); return api.paneTo(f.kind === 'check' ? '[data-check="' + f.key + '"]' : '[data-ev="' + f.item + '"]'); }
        case 'mine': return writeFix(f, null);
        case 'add': { api.open(f.section); setTimeout(() => { const r = root(); const a = r && r.querySelector('.den-evpane [data-tour="add-source"]'); if (a) { a.focus(); a.click && a.tagName === 'BUTTON' && a.getAttribute('aria-expanded') === 'false' && a.click(); } else writeFix(f, null); }, 80); return; }
        case 'change': { setPend({ key: f.key, mode: 'edit', rev: o.revision || 0, idx: idxOf(f.key), done: 'Saved' }); api.open(f.section); setTimeout(() => { const r = root(); const s = r && r.querySelector('select[data-rating="' + f.item + '"]'); if (s) { land(r, f); s.focus(); } }, 60); return; }
        case 'view': { const id = (sp && sp.cites[0]) || ''; api.open(f.section); setTimeout(() => { const r = root(); const li = r && id && r.querySelector('.den-evpane li[data-cite="' + id + '"]'); if (li) { try { li.scrollIntoView({ block: 'center' }); } catch (e) {} const btn = li.querySelector('a.den-link') || li.querySelector('.den-evcard'); (btn || li).focus(); } }, 80); return; }
        default: return;
      }
    };
    const skip = f => { const i = idxOf(f.key); const nx = items ? items.slice(i + 1).find(x => x.open) || items.find(x => x.open && x.key !== f.key) : null; if (nx && nx.key !== f.key) { at(nx, 'fix'); const k = openList.findIndex(x => x.key === nx.key); say((k + 1) + ' of ' + openList.length + ': ' + title(nx) + ', ' + where(nx, desk)); } };
    const toggle = f => { if (openKey === f.key) { setOpenKey(''); return; } at(f, canFix ? 'fix' : 'toggle'); const k = openList.findIndex(x => x.key === f.key); say((k + 1) + ' of ' + openList.length + ': ' + title(f) + ', ' + where(f, desk)); };
    /** The foot's count is a press: the first open flag opens here, and the place it stands takes the focus (spec v3: what is left leads to where it is). */
    const foot = () => first('target');
    return { on, items, count: n, countOf: sec => count(items, sec), state: (id, sec, text, nCards) => state(sec, text, nCards, count(items, id)), inline: sec => (items || []).filter(x => x.section === sec && x.open),
      api, desk, canFix, filed, openKey, setOpenKey, undo, setUndo, said, errs, setErrs, note, setNote, liveRef, first, foot, fix, skip, toggle, unmark, noteOn, mark, acknowledged: (b && b.acknowledged) || [], marks: (b && b.review && b.review.marks) || {}, signals: o.signals, alerts: o.alerts, alertsWhy: o.alertsWhy || '', alertsRetry: o.alertsRetry || null, layout: o.layout };
  }

  /* ---- the component: one for both rooms (UX-SPEC s.4.5; s.12.3: the workbench's panel is headed "Check before you send") ---- */
  function Reasons({ f, h, others, onClose }) {
    const [own_, setOwn] = useState(false); const [txt, setTxt] = useState(''); const [also, setAlso] = useState([]); const box = useRef(null);
    useEffect(() => { const b = box.current && box.current.querySelector('button'); if (b) b.focus(); }, []);
    const go = n => { onClose(false); h.fix(f, 'out', { note: n, also: others.filter(x => also.indexOf(x.key) >= 0) }); };
    return html`<div class="den-fl-reasons" ref=${box} role="group" aria-label="Why it is left out" onKeyDown=${e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); } }}>
      ${REASONS.map(r => html`<button key=${r} type="button" class="den-mini den-fl-reason" onClick=${() => go(r)}>${r}</button>`)}
      <button type="button" class="den-mini den-fl-reason" aria-expanded=${own_ ? 'true' : 'false'} onClick=${() => setOwn(!own_)}>Something else (say why)</button>
      ${own_ ? html`<span class="den-fl-own"><label class="den-sr" for=${'fl-why-' + f.key}>Why it is left out</label><input id=${'fl-why-' + f.key} class="den-in" maxlength="200" value=${txt} placeholder="Why" onInput=${e => setTxt(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && txt.trim().length >= 3) go(txt.trim()); }} />
        <button type="button" class="den-mini primary" disabled=${txt.trim().length < 3} onClick=${() => go(txt.trim())}>Leave it out</button></span>` : null}
      ${others.length ? html`<fieldset class="den-fl-also"><legend>Leave these out for the same reason too</legend>${others.map(x => html`<label key=${x.key}><input type="checkbox" checked=${also.indexOf(x.key) >= 0} onChange=${e => setAlso(a => (e.target.checked ? a.concat([x.key]) : a.filter(k => k !== x.key)))} /> ${title(x)}: ${where(x, h.desk)}</label>`)}</fieldset>` : null}
      <button type="button" class="den-link" onClick=${() => onClose(true)}>Cancel</button></div>`;
  }
  function Item({ f, i, of, h, showWhy, inGroup }) {
    const open = h.openKey === f.key; const [ask, setAsk] = useState(false); const [whyOn, setWhyOn] = useState(false); const opener = useRef(null);
    const id = 'den-fl-' + String(f.key).replace(/[^A-Za-z0-9_-]/g, '_'); const t = title(f), w = where(f, h.desk); const err = h.errs[f.key];
    const fixes = (FIXES[f.kind] || []).filter(k => k !== 'view' || /\[[A-Z]:/.test(String((locate(h.api.text(f.section), f) || {}).raw || '')));
    const others = f.kind === 'check' ? h.items.filter(x => x.open && x.kind === 'check' && x.key !== f.key) : [];
    const quote = f.kind === 'check' || f.kind === 'empty' || f.kind === 'pinned' ? '' : String(f.sentence || f.quote || '');
    return html`<li class=${'den-fl' + (open ? ' open' : '')} data-fl-item=${f.key} data-kind=${f.kind} onKeyDown=${e => { if (e.key === 'Escape' && open && !e.defaultPrevented) { e.preventDefault(); e.stopPropagation(); h.setOpenKey(''); const b = e.currentTarget.querySelector('.den-fl-t'); if (b) b.focus(); } }}>
      <button type="button" class="den-fl-t" aria-expanded=${open ? 'true' : 'false'} aria-controls=${id} aria-label=${(i + 1) + ' of ' + of + ': ' + t + ', ' + w} onClick=${() => h.toggle(f)}>
        <span class="den-fl-n" aria-hidden="true">${i + 1}</span><span class="den-fl-tt"><b>${t}</b><span class="den-fl-w">${w}</span>${quote && !open ? html`<q class="den-fl-q">${quote}</q>` : null}</span></button>
      ${open ? html`<div class="den-fl-body" id=${id}>
        ${showWhy || whyOn ? html`<p class="why">${why(f.kind, f)}</p>` : html`<button type="button" class="den-link den-fl-whyb" onClick=${() => setWhyOn(true)}>Why?</button>`}
        ${h.canFix ? html`<div class="den-fl-fix" role="group" aria-label=${'Fixes for ' + t}>
          ${fixes.map((k, j) => html`<button key=${k} type="button" ref=${k === 'out' ? opener : null} class=${'den-mini den-fx' + (j === 0 ? ' primary go' : '')} data-fx=${k} aria-expanded=${k === 'out' ? (ask ? 'true' : 'false') : null} onClick=${() => { if (k === 'out') setAsk(!ask); else h.fix(f, k); }}>${FX[k]}</button>`)}
          ${of > 1 ? html`<button type="button" class="den-link den-fl-skip" onClick=${() => h.skip(f)}>Skip for now</button>` : null}</div>
          ${ask ? html`<${Reasons} f=${f} h=${h} others=${others} onClose=${back => { setAsk(false); if (back && opener.current) opener.current.focus(); }} />` : null}` : of > 1 ? html`<button type="button" class="den-link den-fl-skip" onClick=${() => h.skip(f)}>Next</button>` : null}
        ${err ? html`<p class=${'den-fl-err' + (err.soft ? ' soft' : '')} role=${err.soft || h.layout === 'today' ? null : 'alert'}>${err.t}</p>` : null}
      </div>` : null}
      ${inGroup ? null : null}</li>`;
  }
  function Panel({ h, layout }) {
    const [foldLeft, setFoldLeft] = useState(false); const [all, setAll] = useState(false); const [groups, setGroups] = useState({}); const [noteOpen, setNoteOpen] = useState(false); const [noteTxt, setNoteTxt] = useState('');
    if (!h || !h.on) return null;
    const today = layout === 'today'; const items = h.items || []; const open = items.filter(x => x.open); const left = items.filter(x => x.left); const n = open.length; const showWhy = sends() < 10;
    const head = html`<div class="den-checks-head"><h2 class="den-checks-h" id=${'den-checks-h-' + (layout || 'brief')}>Check before you send</h2><span class=${'den-chip ' + (h.filed ? 'pos' : n ? 'warn' : 'pos')} data-count=${h.filed ? 0 : n}>${h.filed ? 'Sent' : n ? n + ' to check' : 'Nothing to check'}</span></div>`;
    // p72 lane P3: on Today the room owns the one polite region (UX-SPEC s.10.4; h.say goes to it through o.say), so the panel draws none
    const live = today ? null : html`<span class="den-sr" role="status" aria-live="polite">${h.said}</span>`;
    if (h.filed) {
      const ack = (h.acknowledged || []).map(a => (a && typeof a === 'object' ? a : { key: String(a), how: 'at_filing' })).filter(a => !/^G:/.test(String(a.key)));
      const sigT = k => { const s = (h.signals || []).find(x => x && x.key === k); return s ? (SIGN[s.sig] || 'An alert') + ': ' + subject(s) : 'An alert (' + k + ')'; };
      const mk = h.marks || {}; const pageLeft = Object.keys(mk).filter(k => mk[k] && (mk[k].kind === 'pinned' || mk[k].kind === 'empty')).map(k => ({ key: k, kind: mk[k].kind, section: mk[k].sec || '', title: (((h.desk && h.desk.sections) || []).find(x => x.id === mk[k].sec) || {}).title, item: k.replace(/^pin:/, ''), left: leftOf(mk[k]) }));
      const leftAll = left.concat(pageLeft); const byWhy = k => { const m = mk[k]; return m ? [m.note ? '"' + m.note + '"' : '', m.by || ''].filter(Boolean).join(', ') : ''; };
      return html`<section class=${'den-checks den-checks--filed' + (today ? ' den-checks--today' : '')} aria-labelledby=${'den-checks-h-' + (layout || 'brief')} data-tour="checks">${head}
        <p class="den-checks-note">Sent: this is what was left as it was, and why. It can't be changed unless the sent report is opened again.</p>
        ${leftAll.length ? html`<h3 class="den-checks-sub">Left as it was when sent</h3><ul class="den-fl-audit">${leftAll.map(f => html`<li key=${f.key} data-fl-left=${f.key}><b>${title(f)}</b> <span class="den-fl-w">${where(f, h.desk)}</span><span class="den-fl-by">${[f.left.note ? '"' + f.left.note + '"' : '', f.left.by, when(f.left.at)].filter(Boolean).join(', ')}</span></li>`)}</ul>` : null}
        ${ack.length ? html`<h3 class="den-checks-sub">Alerts left out when sent</h3><ul class="den-fl-audit">${ack.map(a => html`<li key=${a.key} data-ack=${a.key}><b>${sigT(a.key)}</b><span class="den-fl-by">${a.how === 'marked' ? 'left out with a reason before it was sent' + (byWhy(a.key) ? ' (' + byWhy(a.key) + ')' : '') : 'seen and left out when it was sent'}${a.at ? ', ' + when(a.at) : ''}</span></li>`)}</ul>` : null}
        ${!leftAll.length && !ack.length ? html`<p class="den-quiet">Nothing was left out when it was sent.</p>` : null}${live}</section>`;
    }
    // more than three open items of one kind show as one row; the walk still goes one at a time (UX-SPEC s.4.5)
    const byKind = {}; open.forEach(f => { byKind[f.kind] = (byKind[f.kind] || 0) + 1; });
    const rows = []; const seen = {}; open.forEach((f, i) => { if (byKind[f.kind] > 3) { if (seen[f.kind]) { seen[f.kind].items.push({ f, i }); return; } seen[f.kind] = { group: f.kind, items: [{ f, i }] }; rows.push(seen[f.kind]); } else rows.push({ f, i }); });
    const openRow = rows.findIndex(r => (r.group ? r.items.some(x => x.f.key === h.openKey) : r.f.key === h.openKey));
    const cap = today || all || rows.length <= 3 ? rows.length : Math.max(3, openRow + 1); const shown = rows.slice(0, cap);
    const u = h.undo; const errU = h.errs.undo || h.errs.note;
    return html`<section class=${'den-checks' + (today ? ' den-checks--today' : '')} aria-labelledby=${'den-checks-h-' + (layout || 'brief')} data-tour="checks">${head}
      ${h.openKey ? null : html`<p class="den-checks-note">The Den checks sources, figures, quotes and alerts. Whether a claim is fair is your call.</p>`}
      ${h.alerts === 'loading' ? html`<p class="den-quiet den-checks-alerts">Looking for alerts\u2026</p>` : h.alerts === 'failed' ? html`<p class="den-quiet den-checks-alerts">Alerts couldn't be checked${h.alertsWhy ? ': ' + String(h.alertsWhy).replace(/\.$/, '') : ' just now'}.${h.alertsRetry ? html` <button type="button" class="den-link" data-act="alerts-again" onClick=${h.alertsRetry}>Try again</button>.` : null} You can still send: they are checked again when you mark it sent.</p>` : null}
      ${u ? html`<p class="den-checks-done" data-undo=${u.kind}><span>\u2713 ${u.text}.</span> ${u.note && h.canFix ? (noteOpen ? html`<span class="den-fl-own"><label class="den-sr" for="den-fl-note">A note</label><input id="den-fl-note" class="den-in" maxlength="200" value=${noteTxt} placeholder="A note (optional)" onInput=${e => setNoteTxt(e.target.value)} /><button type="button" class="den-mini" disabled=${!noteTxt.trim()} onClick=${() => { h.noteOn(u.note.f, noteTxt.trim()); setNoteOpen(false); setNoteTxt(''); }}>Save the note</button></span>` : html`<button type="button" class="den-link" onClick=${() => setNoteOpen(true)}>Add a note</button>`) : null} <button type="button" class="den-link den-undo-fl" onClick=${() => { const x = u; h.setUndo(null); if (x && x.run) x.run(); }}>Undo</button></p>` : null}
      ${errU ? html`<p class="den-fl-err" role=${today ? null : 'alert'}>${errU.t}</p>` : null}
      ${n && !h.openKey ? html`<button type="button" class="den-mini primary den-fl-first" data-tour="fix-next" onClick=${() => h.first(h.canFix ? 'fix' : 'toggle')}>${h.canFix ? 'Go to the first' : 'Next'}</button>` : null}
      ${n ? html`<div class="den-checks-list" role="region" tabindex="0" aria-label=${'Things to check, ' + n}><ol>${shown.map(r => {
          if (!r.group) return html`<${Item} key=${r.f.key} f=${r.f} i=${r.i} of=${n} h=${h} showWhy=${showWhy} />`;
          const on = groups[r.group] || r.items.some(x => x.f.key === h.openKey);
          const a = r.items[0].i + 1, z = r.items[r.items.length - 1].i + 1;   // the numbers its items carry (one order: shown())
          return html`<li key=${'g:' + r.group} class="den-fl-group" data-group=${r.group} data-n=${r.items.length}><button type="button" class="den-fl-t den-fl-gt" aria-expanded=${on ? 'true' : 'false'} aria-label=${a + ' to ' + z + ' of ' + n + ': ' + many(r.group, r.items.length)} onClick=${() => setGroups(g => Object.assign({}, g, { [r.group]: !on }))}><span class="den-fl-range" aria-hidden="true">${a}\u2013${z}</span><span class="den-fl-tt"><b>${many(r.group, r.items.length)}</b></span></button>
            ${on ? html`<ol class="den-fl-sub">${r.items.map(x => html`<${Item} key=${x.f.key} f=${x.f} i=${x.i} of=${n} h=${h} showWhy=${showWhy} inGroup=${true} />`)}</ol>` : null}</li>`; })}</ol>
        ${rows.length > cap ? html`<button type="button" class="den-link den-fl-all" onClick=${() => setAll(true)}>Show all ${rows.length}</button>` : null}</div>`
        : html`<p class="den-checks-clear">\u2713 Nothing left to check</p>`}
      ${left.length ? html`<div class="den-checks-left"><button type="button" class="den-fold" aria-expanded=${foldLeft ? 'true' : 'false'} onClick=${() => setFoldLeft(!foldLeft)}>Left as it is (${left.length})</button>
        ${foldLeft ? html`<ul class="den-fl-audit">${left.map(f => html`<li key=${f.key} data-fl-left=${f.key}><b>${title(f)}</b> <span class="den-fl-w">${where(f, h.desk)}</span><span class="den-fl-by">${[f.left.note ? '"' + f.left.note + '"' : '', f.left.by, when(f.left.at)].filter(Boolean).join(', ')}</span>
          ${h.canFix ? html`<button type="button" class="den-mini den-fl-back" onClick=${() => h.unmark([f])}>Put it back on the list</button>` : null}${h.errs['left:' + f.key] ? html`<p class="den-fl-err" role=${today ? null : 'alert'}>${h.errs['left:' + f.key].t}</p>` : null}</li>`)}</ul>` : null}</div>` : null}
      ${live}</section>`;
  }
  /** The foot's one count: a press to the first open item ("N to check"), or "Nothing to check". */
  function Foot({ h }) {
    if (!h || !h.on || h.filed) return null;
    return h.count ? html`<button type="button" class="den-chip warn den-chip-btn" data-tour="foot-flags" data-count=${h.count} title="Things to check before it is sent. Press to go to the first." onClick=${h.foot}>${h.count} to check</button>`
      : html`<span class="den-chip pos" data-count="0">Nothing to check</span>`;
  }
  Object.assign(DenFlags, { useBrief, Panel, Foot });
})();
