/* Anne's Den: the guided tour. One day on a desk, step by step, on the live page: the guide rings the control to press
 * and waits until the person has really used it (a click, a drag, a key, words typed), then moves on.
 *
 * Standalone by design: no React, no htm, no shared page helpers. It mounts #den-tour on document.body (React owns
 * #den-root) and reads the Den only through its data-tour hooks, its #den-tab-* ids, its data-* state attributes and the
 * window event 'den:did' that docs/den.js sends after a write succeeds. It never presses a Den control, never makes a
 * network call, never sets a class on a Den node, and never spends: a control marked data-paid="1" is only ever pointed
 * at, with the day's live cost, and pressed by the person or not at all. Where the page is not in the state a step
 * needs (another tab, another day, unsaved words) the guide asks for the one press that fixes it.
 *
 * State: localStorage ax_den_tour = { v, status: active|paused|done|dismissed, step, done[], skipped[], sample, ask:
 * ask|never, runs, startedAt, updatedAt, completedAt, t: { step: ms }, w: { pin, aside, file } } (written on every
 * change, so a reload resumes at the step it was on). window.DenTour = { open, start, pause, stop, reset, state, steps }.
 * Entry (p72, UX-SPEC s.8.1 and s.8.4): the guide never offers itself when the Den opens, in either room. It is opened
 * by the workbench's Guide button beside ?, the Keyboard sheet's first row, and Today's Help > Full guided tour of the
 * tools; the first open shows the welcome, later ones the guide's menu. Started from Today's report (open({ from:
 * 'report' })), den.js has already opened the workbench as a visit; the finish then reads "Back to Today's report" and
 * goes back there (ax_den_tab = report, through the window event 'ax:goto' den.js already listens to). Any error inside
 * the guide removes the layer and leaves the Den untouched. */
(function () {
  'use strict';
  if (window.DenTour) return;
  const KEY = 'ax_den_tour', V = 1;
  const CHAPTERS = ['Set up', 'Find stories', 'Start the report', 'Sections and sources', 'Copy and send', 'Settings'];
  // p72: Today's report is a room of its own (no tab row there); the workbench's Brief tab reads "Sections and sources" (D1)
  const TABN = { report: 'Today\'s report', today: 'Board', brief: 'Sections and sources', watch: 'Watch', collection: 'Collection', options: 'Options' };
  // on Today the workbench's tools are in More tools (UX-SPEC s.7): the item, and its Alt key
  const MORE = { today: ['Find a story the report missed', '1'], brief: ['Sections and sources', '2'], watch: ['Watch', '3'], collection: ['Collection', '4'], options: ['Options', '5'] };
  const VIEW = 'Your key is view-only, so this is shown, not done.';
  const SAMPLE = 'Sample: not your desk\'s data';
  const WELCOME = 'A tour of the tools behind the daily report: finding stories, sources and settings. About 15 minutes. You don\'t need it for the report itself.';
  const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const now = () => Date.now();

  /* ---------------------------------------------------------------- the record */
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  let S = load();
  const put = patch => { S = Object.assign({ v: V, status: 'dismissed', step: '', done: [], skipped: [], sample: false, ask: 'ask', runs: 0, t: {}, w: {} }, S || {}, patch || {}, { updatedAt: now() }); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  /* ---------------------------------------------------------------- reading the Den */
  const root = () => document.getElementById('den-root');
  const visible = el => { try { return !!(el && el.isConnected && el.getClientRects().length > 0 && !el.closest('[hidden]') && getComputedStyle(el).visibility !== 'hidden'); } catch (e) { return false; } };
  const H = n => '[data-tour="' + n + '"]';
  const every = (sel, within) => { const r = within || root(); return r ? Array.from(r.querySelectorAll(sel)) : []; };
  const all = (sel, within) => every(sel, within).filter(visible);
  const one = (sel, within) => all(sel, within)[0] || null;
  const hook = (n, within) => one(H(n), within);
  const any = n => { const r = root(); return r ? r.querySelector(H(n)) : null; };
  const inDen = () => document.body && document.body.classList.contains('in-den');
  const app = () => document.getElementById('den-app');
  const cardBy = k => every(H('card')).find(x => x.dataset.key === k) || null;
  const inCol = el => !!(el && el.closest(H('col')));
  const inUns = el => !!(el && el.closest(H('unsorted')));
  const colBy = s => every(H('col')).find(x => x.dataset.sec === s) || null;
  const KIND = { media: ['media'], social: ['social', 'developments'], actors: ['actors'], narratives: ['narratives', 'developments'], upcoming: ['developments', 'summary'] };
  const colFor = kind => { for (const s of KIND[kind] || []) { const c = colBy(s); if (c) return c; } return every(H('col'))[0] || null; };
  const keyOf = col => { const i = every(H('col')).indexOf(col); return i < 0 ? '' : i < 9 ? String(i + 1) : i === 9 ? '0' : ''; };
  const colName = col => (col ? col.getAttribute('aria-label') || col.dataset.sec : 'a section');
  const dialog = () => one('[role="dialog"][aria-modal="true"]');
  const loading = () => !!one('.den-loading');
  const onToday = () => { const a = app(); return !!(a && a.classList.contains('dt-on')); };
  const ctx = () => {
    const sel = any('desk'); const opt = sel && sel.options && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null; const b = any('budget');
    const tab = Object.keys(TABN).find(t => { const el = document.getElementById('den-tab-' + t); return el && el.getAttribute('aria-selected') === 'true'; }) || (onToday() ? 'report' : '');
    const st = any('status'); const rep = root() && root().querySelector('.dt-rep[aria-current="page"] b');
    return { desk: opt ? opt.textContent.trim() : rep ? rep.textContent.trim() : 'this', tab, ro: window.AX_ROLE === 'read' || !!any('readonly'), past: !!hook('today'),
      budget: b ? { left: +b.getAttribute('data-left') || 0, cap: +b.getAttribute('data-cap') || 0 } : null, filed: !!(st && st.getAttribute('data-status') === 'filed') };
  };
  const costLine = c => (c.budget ? c.budget.left + ' of ' + c.budget.cap + ' left today' : 'counted against today\'s AI drafts');
  /* the press that opens a workbench tab: its tab in the row; on Today, More tools (then its item, once the menu is open) */
  const tabTarget = tab => { const el = document.getElementById('den-tab-' + tab); if (el) return el; const m = MORE[tab]; const list = m && one('#dt-list-more');
    if (list) { const it = all('.dt-mi', list).find(x => x.textContent.indexOf(m[0]) === 0); if (it) return it; } return one('#dt-btn-more'); };
  const tabLine = (tab, c) => (c.tab === 'report' && MORE[tab] ? 'Open More tools, then ' + MORE[tab][0] + ' (or press Alt+' + MORE[tab][1] + ')' : 'Press ' + TABN[tab]);
  const SAMPLE_ALT = { label: 'Show me with a sample', go: () => put({ sample: true }) };
  const saveState = () => any('save-state');
  const dirty = () => { const s = saveState(); return !!(s && s.getAttribute('data-dirty') === '1'); };
  const openSec = () => one(H('section'));
  const secTitle = id => { const s = every(H('section')).find(x => x.dataset.section === id); const ed = s && s.querySelector(H('editor')); return (ed && ed.getAttribute('aria-label')) || (s && s.querySelector('h4') ? s.querySelector('h4').childNodes[0].textContent.trim() : id); };
  const citedSum = () => every(H('ev-card')).reduce((a, b) => a + (+b.getAttribute('data-cited') || 0), 0);
  const dayWords = v => { try { const d = new Date(v + 'T12:00:00'); return new Intl.DateTimeFormat('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); } catch (e) { return 'today'; } };
  const show = o => Object.assign({ mode: 'show' }, o);
  const PAID = '[data-paid="1"]';

  /* ---------------------------------------------------------------- the steps
     view(m, c) says what the card shows and what is ringed, from the page as it is now; done(m, c) is the proof that
     the person did it; on(m, ev, c) notes what happened (an event, or a 'den:did'). m is this step's memory, X is what
     one step leaves for the next. Nothing here changes the page. */
  const X = {};
  const did = (e, what) => e.type === 'den:did' && e.detail && e.detail.what === what;
  /* A Sections-and-sources step. p72 (UX-SPEC s.8.4): the sample path is offered on every one of them, not only while no report
     exists, so following the guide never has to write into the real report; once chosen, the rest of the chapter is the sample. */
  const briefStep = (def, art) => { const inner = def.view; def.tab = 'brief'; def.today = true; def.art = art;
    def.view = (m, c) => { const panes = hook('panes'); const empty = !panes && hook('brief-empty');
      if (S.sample || c.ro || (!panes && empty && !hook('by-hand') && !hook('draft'))) return show({ phase: 'sample', sample: true, body: (def.sampleBody || '') + (c.ro ? ' ' + VIEW : panes ? ' This is a sample: nothing was written into your report.' : ' When today\'s report exists, you do this on the page.'), targets: [] });
      if (panes) { const v = inner(m, c); return v ? Object.assign({}, v, { alts: (v.alts || []).concat([SAMPLE_ALT]) }) : v; }
      if (empty) return { mode: 'route', route: 'brief', title: 'Start the report first', body: 'This step needs today\'s report. Write it now (uses 1 AI draft, pressed by you), write it yourself for free, or see a sample.', line: 'Press Write it myself, or Write it now', targets: [hook('by-hand'), hook('draft')], alts: [SAMPLE_ALT] };
      return null; };
    return def; };
  /* A tab's second half is a press too (the owner: every step waits for the person to do it): something on the tab that
     only shows more, never a control that collects or saves. Where there is nothing of that kind to press (a read-only
     key, an empty panel), the step is shown instead. */
  const tabStep = (id, tab, title, body, look, lookBody, press, pressLine) => ({ id, ch: 5, title,
    view(m, c) { if (c.tab !== tab) return { mode: 'do', phase: 'tab', body, line: tabLine(tab, c), targets: [tabTarget(tab)] };
      const t = look(); const can = t && press ? all(press, t).filter(x => !x.disabled && x.getAttribute('aria-selected') !== 'true') : [];
      if (!can.length) return show({ phase: 'look', body: lookBody, targets: t ? [t] : [] });
      return { mode: 'do', phase: 'look', body: lookBody, line: pressLine, targets: [can[0]] }; },
    on(m, e) { if (e.type === 'click' && press && e.target.closest) { const t = look(); const hit = e.target.closest(press); if (t && hit && t.contains(hit)) m.pressed = true; } },
    done: m => !!m.pressed });

  const STEPS = [
    { id: 'desk', ch: 0, title: 'Choose your desk',
      view(m, c) { const sel = hook('desk'); if (!sel) return null;
        if (sel.options.length < 2) return show({ body: 'You have one desk: ' + c.desk + '. A desk is one client, one region and one report.', targets: [sel] });
        return { mode: 'do', act: 'Choose', body: 'A desk is one client, one region and one report. Pick yours, or keep ' + c.desk + '.', line: 'Choose a desk, or press Keep ' + c.desk, targets: [sel], alts: [{ label: 'Keep ' + c.desk, go: () => complete('got') }] }; },
      on(m, e) { if (e.type === 'change' && e.target.closest && e.target.closest(H('desk'))) m.changed = true; },
      done: m => !!m.changed },
    { id: 'day', ch: 0, title: 'Check the day',
      view(m, c) { if (c.past) { m.wasPast = true; return { mode: 'do', phase: 'today', body: 'The Den is showing another day. Nothing drafts for a past day. Press Today to come back.', line: 'Press Today', targets: [hook('today')] }; }
        const d = hook('day'), b = hook('budget'); const meter = c.budget ? ' The meter beside it counts today\'s AI drafts: ' + c.budget.left + ' of ' + c.budget.cap + ' left. Only a button that says it uses an AI draft spends, and this guide never presses one.' : '';
        const body = 'The Den reads one day at a time. It is showing ' + (d && d.value ? dayWords(d.value) : 'today') + ', the desk\'s window up to now. Looking at another day spends nothing.' + meter;
        if (!d) return show({ body, targets: [b].filter(Boolean) });
        return { mode: 'do', act: 'Click', body, line: m.touched ? 'Now press Escape, or click away' : 'Click the date, then press Escape or click away', targets: [d, b].filter(Boolean), badges: ['Click here', 'Look here'] }; },
      on(m, e) { const inDay = e.target && e.target.closest && e.target.closest(H('day')); if ((e.type === 'focusin' || e.type === 'click') && inDay) m.touched = true;
        if (m.touched && inDay && (e.type === 'change' || (e.type === 'keydown' && (e.key === 'Escape' || e.key === 'Enter')))) m.left = true; },
      done: (m, c) => (!!m.wasPast && !c.past) || (!!m.touched && (!!m.left || !(document.activeElement && document.activeElement.closest && document.activeElement.closest(H('day'))))) },
    { id: 'checks', ch: 0, title: 'Read the alerts',
      view(m) { const pills = all(H('check')); const pop = hook('check-pop');
        if (pop) { m.opened = true; return { mode: 'do', phase: 'close', body: 'Each alert says whether today\'s report mentions it, and opens its stories and posts.', line: 'Close it: press Close, or Escape', targets: [pop] }; }
        if (!pills.length) { const s = hook('strip'); return show({ body: 'The alerts are still loading, or could not be read. When they are there, a number on an alert means something to read.', targets: s ? [s] : [] }); }
        const has = pills.filter(b => (b.getAttribute('data-n') || '0') !== '0'); const pill = has[0] || pills[0]; const label = String(pill.getAttribute('title') || '').split(':')[0] || 'an alert';
        return { mode: 'do', phase: 'open', body: has.length ? 'The Alerts rail holds ' + pills.length + ' automatic checks on today\'s stories and posts. A number means there is something to read. No AI is used.' : 'Nothing was found today. Press any alert to see what it looks for. No AI is used.', line: 'Press ' + label + ', then close it', targets: [pill] }; },
      done: m => !!m.opened && !hook('check-pop') },

    { id: 'card', ch: 1, title: 'Meet a card', tab: 'today', today: true,
      view(m, c) { const u = hook('unsorted'); if (!u) return null;
        if (u.getAttribute('data-n') === '0') return show({ phase: 'empty', noGot: true, body: 'Nothing has been collected for ' + c.desk + ' today, so there is nothing to sort. The Collection tab says what was read.', targets: [u],
          alts: [{ label: 'Try another desk', go: () => goId('desk', true) }, { label: 'Carry on', primary: true, go: () => skipTo('write', ['card', 'find', 'pin', 'aside', 'drag', 'key']) }] });
        let k = m.key && cardBy(m.key); if (!k || !inUns(k)) { k = one(H('card'), u); m.key = k ? k.dataset.key : ''; }
        if (!k) return show({ body: 'Unsorted is everything collected for ' + c.desk + ' today, heaviest first. Its cards are folded under Low weight just now.', targets: [u] });
        return { mode: 'do', body: 'Unsorted is everything collected for ' + c.desk + ' today, heaviest first. A card shows where it ran, its headline and its reach.', line: 'Click this card', targets: [k] }; },
      on(m, e) { if (e.type === 'focusin' || e.type === 'click') { const k = e.target.closest && e.target.closest(H('card')); if (k && inUns(k)) m.hit = true; } },
      done: m => !!m.hit },
    { id: 'find', ch: 1, title: 'Find a card', tab: 'today', today: true,
      view(m) { const s = hook('search'), f = hook('filter'); if (!s && !f) return null; const segs = f ? all('[data-kind]', f) : []; const allSeg = segs.find(b => b.dataset.kind === 'all');
        const narrowKind = segs.find(b => b.dataset.kind !== 'all' && b.getAttribute('aria-pressed') === 'true'); if ((s && s.value.trim().length >= 2) || narrowKind) m.narrowed = true;
        if (m.narrowed) { const need = []; if (s && s.value) need.push(s); if (allSeg && allSeg.getAttribute('aria-pressed') !== 'true') need.push(allSeg);
          return { mode: 'do', phase: 'reset', body: 'That is how the list narrows. Now bring every card back.', line: s && s.value ? 'Clear the search' + (need.length > 1 ? ', then press All' : '') : 'Press All', targets: need.length ? need : [s || f] }; }
        const kind = segs.find(b => b.dataset.kind !== 'all' && /[1-9]\d*\s*$/.test(b.textContent)); const kl = kind ? kind.textContent.replace(/\s*\d+\s*$/, '').trim() : 'News';
        return { mode: 'do', act: 'Type', phase: 'narrow', body: 'Type a word to narrow the list, or press a kind such as ' + kl + '.', line: 'Type two letters, or press ' + kl, targets: [s, f].filter(Boolean) }; },
      done(m) { if (!m.narrowed) return false; const s = hook('search'), f = hook('filter'); const a = f && f.querySelector('[data-kind="all"]'); return (!s || !s.value) && (!a || a.getAttribute('aria-pressed') === 'true'); } },
    { id: 'pin', ch: 1, title: 'Mark what must be mentioned', tab: 'today', today: true, write: true,
      view(m, c) { const u = hook('unsorted'); if (!u) return null;
        if (c.ro) return show({ body: 'A must-mention card is one the report has to mention; everyone on the desk sees the mark. ' + VIEW, targets: [one(H('card'), u) || u] });
        let k = m.key && cardBy(m.key); if (!k || !inUns(k)) { const p = all(H('card') + '[data-pin="1"]', u); k = p.find(x => x.dataset.pinned !== '1'); m.key = k ? k.dataset.key : '';
          if (!k) return show({ body: p.length ? 'Every card that can be marked must mention already is. This is what one looks like.' : 'No card here can be marked must mention: narratives and dates are added to sections instead.', targets: [p[0] || u] }); }
        return { mode: 'do', body: 'A must-mention card is one the report has to mention. Everyone on this desk sees the mark. Press it again, or Undo, to take it back.', line: 'Press Must mention (or p on a focused card)', targets: [hook('card-pin', k) || k] }; },
      on(m, e) { if (did(e, 'pin')) m.item = String(e.detail.item); },
      done(m) { const k = m.key && cardBy(m.key); if (k && k.dataset.pinned === '1') { X.pinKey = m.key; return true; }
        if (m.item) { const j = every(H('card')).find(x => new RegExp(':' + m.item + '$').test(x.dataset.key || '')); X.pinKey = j ? j.dataset.key : ''; return true; } return false; } },
    { id: 'aside', ch: 1, title: 'Set one aside', tab: 'today', today: true,
      view(m, c) { const u = hook('unsorted'); if (!u) return null;
        if (c.ro) return show({ body: 'Setting a card aside takes it off the Board for everyone on the desk, with a reason; Undo brings it back. ' + VIEW, targets: [u] });
        if (m.asided) { const offer = hook('mute-offer'); if (offer) return { mode: 'do', phase: 'mute', body: 'Three from one source and the Den offers to mute it on this desk. Either answer is fine.', line: 'Answer the offer', targets: [offer] };
          const un = hook('undo'); if (un && !un.disabled && /^Set aside/.test(un.getAttribute('data-what') || '')) return { mode: 'do', phase: 'undo', body: 'Undo puts it back on the Board for everyone. Press it, or leave it aside.', line: 'Press Undo', targets: [un], alts: [{ label: 'Leave it aside', go: () => complete('got') }] };
          return { mode: 'do', phase: 'undo', body: 'Done.', targets: [] }; }
        const form = (m.key && cardBy(m.key) && hook('aside-form', cardBy(m.key))) || hook('aside-form');
        if (form) { m.opened = true; return { mode: 'do', phase: 'form', body: 'Pick a reason, then press Set aside: it leaves the Board for everyone on this desk, and Undo brings it straight back. Or press Cancel to back out.', line: 'Set it aside, or press Cancel', targets: [form] }; }
        const p = all(H('card') + '[data-pin="1"]', u).filter(x => x.dataset.pinned !== '1' && x.dataset.key !== X.pinKey); let k = m.key && cardBy(m.key); if (!k || !inUns(k)) { k = p[p.length - 1] || null; m.key = k ? k.dataset.key : ''; }
        if (!k || !hook('card-aside', k)) return show({ body: 'No card here can be set aside just now. A card that can be has a Set aside button.', targets: [u] });
        return { mode: 'do', phase: 'open', body: 'Not useful? Set it aside with a reason. It leaves the Board for everyone on this desk, and Undo brings it straight back.' + (p.length <= 2 ? ' This desk has few cards: open the form, then press Cancel.' : ' You can also back out.'), line: 'Press Set aside', targets: [hook('card-aside', k)] }; },
      on(m, e) { if (did(e, 'aside')) m.asided = true; },
      done(m) { if (m.asided) { const un = hook('undo'); return !hook('mute-offer') && !(un && !un.disabled && /^Set aside/.test(un.getAttribute('data-what') || '')); } return !!m.opened && !any('aside-form'); } },
    { id: 'drag', ch: 1, title: 'Add it to a section', tab: 'today', today: true, write: true,
      view(m, c) { const u = hook('unsorted'); if (!u) return null;
        if (c.ro) return show({ body: 'A card is added to a section by dragging it onto the column, or with the card\'s menu. ' + VIEW, targets: [u] });
        let k = m.key && cardBy(m.key); if (!k || !inUns(k)) { const pk = X.pinKey && cardBy(X.pinKey); k = (pk && inUns(pk) && visible(pk) ? pk : null) || one(H('card') + '[data-pin="1"]', u) || one(H('card'), u); m.key = k ? k.dataset.key : ''; }
        if (!k) return show({ body: 'No card is left in Unsorted to add to a section.', targets: [u] });
        const col = colFor(k.dataset.kind); const t = colName(col);
        if (m.menu) return { mode: 'do', act: 'Choose', phase: 'menu', body: 'The card\'s menu does the same as dragging: choose ' + t + '. It is kept with the desk for everyone, and Undo takes it back.', line: 'Choose ' + t + ' in the card\'s menu', targets: [hook('card-file', k) || k, col] };
        return { mode: 'do', act: 'Drag', phase: 'drag', body: 'Drag this card onto ' + t + '. Stories and posts added this way are kept with the desk for everyone, and marked must mention. Undo, or the card\'s menu, takes it back.', line: 'Drag it onto ' + t, targets: [k, col], badges: ['Drag from here', 'Drop here'], alts: [{ label: 'Can\'t drag? Use the card\'s menu', go: () => { m.menu = true; } }] }; },
      on(m, e) { if (did(e, 'file') && e.detail.sec) m.filed = String(e.detail.key || ''); },
      done(m) { for (const k of [m.filed, m.key]) { const el = k && cardBy(k); if (el && inCol(el)) { X.fileKey = k; X.fileSec = el.closest(H('col')).dataset.sec; return true; } } return false; } },
    { id: 'key', ch: 1, title: 'Do it with one key', tab: 'today', today: true, write: true,
      view(m, c) { const u = hook('unsorted'); if (!u) return null;
        if (c.ro) return show({ body: 'Faster: a focused card goes to a section when its number is pressed; j and k move between cards. ' + VIEW, targets: [u] });
        let k = m.key && cardBy(m.key); if (!k || !inUns(k)) { k = all(H('card'), u).find(x => x.dataset.key !== X.fileKey) || null; m.key = k ? k.dataset.key : ''; }
        if (!k) { const f = (X.fileKey && cardBy(X.fileKey)) || one(H('col') + ' ' + H('card')); if (!f) return show({ body: 'No card is left to add with a key.', targets: [u] });
          return { mode: 'do', act: 'Choose', phase: 'back', body: 'Every card is in a section. Put one back first: in its menu choose Back to Unsorted.', line: 'Choose Back to Unsorted', targets: [hook('card-file', f) || f] }; }
        let col = colFor(k.dataset.kind) || (X.fileSec && colBy(X.fileSec)); if (!keyOf(col)) col = every(H('col'))[0]; const n = keyOf(col); m.n = n;   // the card's own kind picks its section, as step 8 does
        return { mode: 'do', act: 'Press ' + n, phase: 'key', key: n, body: 'Faster: click a card, then press ' + n + ' to add it to ' + colName(col) + '. j and k move between cards.', line: 'Click a card, then press ' + n, targets: [k, col], badges: ['Click here', 'Press ' + n],
          status: m.retry ? 'That did not go through; click the card first, then press ' + n + '.' : '' }; },
      on(m, e) { if (e.type === 'keydown' && /^[0-9]$/.test(e.key) && !e.altKey && !e.metaKey && !e.ctrlKey) { const a = document.activeElement; const k = a && a.closest && a.closest(H('card')); if (k) m.keyed = { key: k.dataset.key, at: now() }; } },
      done(m) { const k = m.keyed; if (!k) return false; const el = cardBy(k.key); if (el && inCol(el)) { X.fileSec = X.fileSec || el.closest(H('col')).dataset.sec; return true; } if (now() - k.at > 6000) { m.keyed = null; m.retry = true; } return false; } },

    { id: 'write', ch: 2, title: 'Open Sections and sources', tabs: ['today', 'brief'], today: true,
      view(m, c) { const col = (X.fileSec && colBy(X.fileSec)) || every(H('col'))[0]; const b = (col && hook('col-write', col)) || hook('col-write'); const w = c.ro ? 'Read' : 'Write';
        return { mode: 'do', body: 'Each section has a ' + w + ' button. It opens that section of today\'s report on Sections and sources, with its sources beside it.', line: 'Press ' + w + ' on ' + colName(col) + ', or the Sections and sources tab', targets: [b || tabTarget('brief')] }; },
      done: (m, c) => c.tab === 'brief' },
    { id: 'start', ch: 2, title: 'Start the report', tab: 'brief', today: true, paid: true,
      view(m, c) { if (hook('panes')) return show({ phase: 'exists', body: c.desk + ' already has today\'s report, so there is nothing to pay for here. Rewrite the whole report, at its foot, would use 1 AI draft; this guide will not ask for it.', targets: [hook('status')].filter(Boolean) });
        const empty = hook('brief-empty'); if (!empty) return null; const prog = hook('progress');
        if (prog) { m.wait = m.wait || now(); m.lost = 0; const s = Math.round((now() - m.wait) / 1000); return { mode: 'do', phase: 'writing', body: 'The report is being written from the cards on the Board.', status: 'Being written. ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '. You can keep looking around.', targets: [prog] }; }
        if (m.wait && !m.lost) m.lost = now(); const failed = !!(m.lost && now() - m.lost > 2000);
        const draft = hook('draft'), hand = hook('by-hand');
        if (c.ro || (!draft && !hand)) return show({ phase: 'cannot', body: 'When the report exists you open a section, click a sentence to edit, press a source to add it, then mark it as sent. ' + (c.ro ? VIEW + ' ' : '') + 'The next steps show a sample.', targets: [empty], got: () => put({ sample: true }) });
        const can = !!(draft && !draft.disabled && (!c.budget || c.budget.left > 0));
        return { mode: 'do', phase: failed ? 'failed' : 'choose', cost: can ? 'Uses 1 AI draft - ' + costLine(c) : '',
          body: failed ? 'It couldn\'t be written, and nothing was lost. Writing it yourself is free.' : 'Write it now writes the report from the cards on the Board, each sentence tied to its source. ' + (can ? 'It uses 1 AI draft; ' + costLine(c) + '. It takes a minute or two and nothing else is locked.' : 'Today\'s AI drafts are used, so it cannot be written for you today.') + ' Writing it yourself is free.',
          line: can ? 'Press Write it now yourself, or Write it myself' : 'Press Write it myself', targets: can ? [draft, hand] : [hand], badges: can ? ['1 AI draft', 'Free'] : ['Free'],
          alts: [{ label: 'Skip: show me with a sample', go: () => { put({ sample: true }); complete('got'); } }] }; },
      on(m, e) { if (did(e, 'draft') || did(e, 'start')) m.made = true; },
      done: m => !!m.made && !!hook('panes') },

    briefStep({ id: 'outline', ch: 3, title: 'Open a section', sampleBody: 'The outline lists the report\'s sections, their length and what is still to check. One is open at a time; press a title to open it.',
      view(m) { const items = all(H('outline-item')); if (items.length < 2) return show({ body: 'This brief has one section, so it is always the open one.', targets: items });
        const cur = items.find(b => b.getAttribute('aria-current') === 'true'); if (m.from == null) m.from = cur ? cur.dataset.goto : '';
        let pick = m.pick && items.find(b => b.dataset.goto === m.pick);
        if (!pick) { const sec = id => every(H('section')).find(s => s.dataset.section === id); const ed = b => { const s = sec(b.dataset.goto); return s && s.querySelector(H('editor')); };
          const cand = items.filter(b => b !== cur && ed(b)); pick = cand.find(b => (ed(b).value || '').trim()) || cand[0] || items.find(b => b !== cur); m.pick = pick.dataset.goto; }
        return { mode: 'do', body: 'The outline lists the report\'s sections, their length and what is still to check. One is open at a time.', line: 'Press ' + secTitle(m.pick), targets: [pick] }; },
      done(m) { const c = all(H('outline-item')).find(b => b.getAttribute('aria-current') === 'true'); return !!c && m.from != null && c.dataset.goto !== m.from; } },
      ['Executive summary', 'Coverage', 'Bottom line']),
    briefStep({ id: 'edit', ch: 3, title: 'Edit the words', write: true, sampleBody: 'Click any sentence and type. Your words are kept on this computer as you type and saved when you leave the text.',
      view(m, c) { if (c.filed || c.ro) return show({ body: c.filed ? 'This report is marked as sent, so the words cannot change here. Change the sent report to edit it.' : 'The words cannot change with this key. ' + VIEW, targets: [openSec()].filter(Boolean) });
        const s = openSec(); const ed = s && hook('editor', s); return { mode: 'do', act: 'Type', body: 'Click any sentence and type. Your words are kept on this computer as you type and saved when you leave the text. Every save is kept.', line: 'Click a sentence and change a word', targets: [ed || (s && hook('reads', s)) || s].filter(Boolean) }; },
      on(m, e) { if (e.type === 'input' && e.target.closest && e.target.closest(H('editor'))) m.typed = true; if (did(e, 'save')) m.saved = true; },
      done(m) { if (dirty()) m.dirty = true; return !!m.typed && (m.dirty || !!m.saved); } }, 'edit'),
    briefStep({ id: 'cite', ch: 3, title: 'Add a source', write: true, sampleBody: 'Put your cursor where the source belongs, then press a source in the Sources pane: its number goes in at the cursor.',
      view(m, c) { if (c.filed || c.ro) return show({ body: c.filed ? 'This report is marked as sent, so no source can be added until it is changed.' : 'Adding a source changes the words. ' + VIEW, targets: [hook('evidence')].filter(Boolean) });
        const pane = hook('evidence'); if (!pane) return null; if (m.base == null) m.base = citedSum();
        const cards = all(H('ev-card'), pane).filter(b => !b.disabled);
        if (!cards.length) { const any_ = all(H('ev-card'), pane).length; const pull = hook('pull', pane); const rows = all(H('pull-file'), pane).filter(b => !b.disabled); const n = pull ? +((pull.textContent.match(/(\d+)\s*$/) || [0, 0])[1]) : 0;
          if (!any_ && rows.length) return { mode: 'do', phase: 'add', body: 'No source is used here yet. Add one card to this section; then it can be used. It is kept with the desk, and Remove takes it out.', line: 'Press Add to this section on one card', targets: [rows[0]] };
          if (!any_ && pull && n > 0 && pull.getAttribute('aria-expanded') !== 'true') return { mode: 'do', phase: 'pull', body: 'No source is used here yet. Open the rest of today\'s cards and add one.', line: 'Open it', targets: [pull] };
          return show({ phase: 'none', sample: true, body: 'No source in this pane can be used in this report yet: a report written by hand uses today\'s cards once AXIOM is updated, or after Write it now. This is what adding a source looks like.', targets: [pane] }); }
        const pick = cards.slice().sort((a, b) => (+a.getAttribute('data-cited') || 0) - (+b.getAttribute('data-cited') || 0))[0];
        return { mode: 'do', body: 'Put your cursor where the source belongs, then press this source. Its number goes in at the cursor. The words are then yours to save.', line: 'Press the source', targets: [pick] }; },
      on(m, e) { if (did(e, 'cite')) m.cited = true; },
      done: m => !!m.cited || (m.base != null && citedSum() > m.base) }, 'cite'),
    briefStep({ id: 'save', ch: 3, title: 'Save', write: true, sampleBody: 'Leaving the text saves it; so do Ctrl or Cmd + S and Save changes. The line at the foot always says where you stand.',
      view(m, c) { const st = saveState(); if (c.filed || c.ro) return show({ body: c.filed ? 'A report marked as sent is saved and locked; Change the sent report is how it changes.' : 'Saving changes the report. ' + VIEW, targets: [st].filter(Boolean) });
        if (!dirty()) return show({ phase: 'saved', body: 'Already saved: leaving the text did it. This line always says where you stand.', targets: [st].filter(Boolean) });
        return { mode: 'do', body: 'Leaving the text saves it; so do Ctrl or Cmd + S and Save changes. This line always says where you stand. Every save is kept.', line: 'Press Save changes, or click outside the text', targets: [hook('save') || hook('done'), st].filter(Boolean) }; },
      on(m, e) { if (did(e, 'save')) m.saved = true; },
      done: m => !!m.saved }, 'save'),
    briefStep({ id: 'jump', ch: 3, title: 'Follow a source', sampleBody: 'Every source number is a chip. Press one to land on its source in the Sources pane; from there View source goes to the original.',
      view() { const s = openSec(); const chips = s ? all(H('cite-chip'), s) : [];
        if (chips.length) return { mode: 'do', body: 'Every source number is a chip. Press one to land on its source; from there View source goes to the original.', line: 'Press a source chip', targets: [chips[0]] };
        if (s && s.querySelector(H('cite-chip'))) return { mode: 'do', phase: 'read', body: 'This section has sources; they show as chips when you are reading, not typing.', line: 'Press Read, or click outside the text', targets: [hook('done', s) || hook('done') || hook('reads', s) || s] };
        const other = every(H('section')).find(x => x.querySelector(H('cite-chip'))); const it = other && one(H('outline-item') + '[data-goto="' + other.dataset.section + '"]');
        if (it) return { mode: 'do', phase: 'go', body: 'This section uses no source yet. Open one that does.', line: 'Press ' + secTitle(other.dataset.section), targets: [it] };
        return show({ phase: 'none', sample: true, body: 'No section uses a source yet. When one does, each source number is a chip that leads to its source.', targets: [] }); },
      on(m, e) { if (did(e, 'jump')) m.jumped = true; },
      done: m => !!m.jumped }, 'jump'),
    briefStep({ id: 'regen', ch: 3, title: 'Rewrite one section', paid: true, sampleBody: 'One section can be rewritten without touching the rest. Opening the options is free; rewriting it uses 1 AI draft, pressed by you.',
      view(m, c) { const s = openSec(); if (c.ro || c.filed || c.past) return show({ body: 'Rewriting a section is not offered here: ' + (c.ro ? 'the key is view-only.' : c.filed ? 'the report is marked as sent.' : 'this is another day.'), targets: [s].filter(Boolean) });
        if (hook('progress') && m.opened) { m.paid = true; return { mode: 'do', phase: 'writing', body: 'The section is being rewritten.', status: 'Being rewritten. You can keep looking around.', targets: [hook('progress')] }; }
        const form = s && hook('regen-form', s);
        if (form) { m.opened = true; return { mode: 'do', phase: 'form', cost: 'Uses 1 AI draft - ' + costLine(c), body: 'Rewriting it uses 1 AI draft; ' + costLine(c) + '. It would replace this section, including your edit. Press Cancel to keep your words, or write an instruction and press Rewrite yourself.', line: 'Press Cancel (free), or Rewrite (uses 1 AI draft)', targets: [hook('regen-cancel', form) || form, hook('regen-go', form)].filter(Boolean), badges: ['Free', '1 AI draft'] }; }
        const b = s && hook('regen', s); if (!b) return show({ body: c.budget && c.budget.left === 0 ? 'Today\'s AI drafts are used, so a section cannot be rewritten today.' : 'This section cannot be rewritten here.', targets: [s].filter(Boolean) });
        if (dirty()) return { mode: 'route', route: 'saved', title: 'Save your words first', body: 'Rewriting a section replaces its words, unsaved ones included. Save them first: nothing is lost.', line: 'Press Save changes', targets: [hook('save') || saveState()] };
        return { mode: 'do', phase: 'open', body: 'One section can be rewritten without touching the rest. Opening the options is free.', line: 'Press Rewrite this section', targets: [b] }; },
      on(m, e) { if (did(e, 'regen')) m.regen = true; },
      done: m => (m.regen && !hook('progress')) || (!!m.opened && !any('regen-form') && !hook('progress')) }, 'regen'),

    briefStep({ id: 'history', ch: 4, title: 'Look back', sampleBody: 'Every save is kept, the last 60, with who and when. Compare, beside it, shows what changed since the last report this desk sent.',
      view(m) { const h = hook('history'); if (!h) return null; const body = 'Every save is kept, the last 60, with who and when. Compare, beside it, shows what changed since the last report this desk sent.';
        if (h.getAttribute('aria-expanded') === 'true') { m.opened = true; return { mode: 'do', phase: 'close', body, line: 'Press History again, or Close, to put it away', targets: [h, hook('drawer')].filter(Boolean) }; }
        return { mode: 'do', phase: 'open', body, line: 'Press History', targets: [h] }; },
      done(m) { const h = any('history'); return !!m.opened && !(h && h.getAttribute('aria-expanded') === 'true'); } }, 'history'),
    briefStep({ id: 'foot', ch: 4, title: 'See what is left to check', sampleBody: 'The foot says what is left to check: sentences without a source, and alerts the report does not mention yet.',
      view() { const st = saveState(); const left = [hook('foot-flags'), hook('foot-checks')].filter(b => b && !b.disabled); const body = 'The foot says what is left to check: sentences without a source, and alerts the report does not mention yet. Neither stops you; both are worth a look.';
        if (!left.length) return show({ phase: 'clear', body: body + ' Nothing is left to check on this report.', targets: st ? [st.closest('[role="status"]') || st] : [] });
        return { mode: 'do', body, line: 'Press the first thing the foot says is left', targets: [left[0]] }; },
      on(m, e) { if (e.type === 'click' && e.target.closest && e.target.closest(H('foot-flags') + ',' + H('foot-checks'))) m.pressed = true; },
      done: m => !!m.pressed }, 'foot'),
    briefStep({ id: 'export', ch: 4, title: 'Copy or download it', sampleBody: 'Copy it for Google Docs, download it, or copy a short Slack summary. Each uses the saved report.',
      view(m) { const menu = hook('export-menu'); const body = 'Copy it for Google Docs, download it, or copy a short Slack summary. Each uses the saved report.';
        if (menu) { m.opened = true; return { mode: 'do', phase: 'pick', body, line: 'Pick one', targets: [menu] }; }
        return { mode: 'do', phase: 'open', body, line: 'Press Export, then pick one', targets: [hook('export')].filter(Boolean), status: m.blocked ? 'Your browser blocked the clipboard; Download works everywhere.' : '' }; },
      on(m, e) { if (e.type === 'click' && e.target.closest && e.target.closest(H('export-menu')) && e.target.closest('button')) m.picked = true; if (did(e, 'copy') || did(e, 'download')) m.picked = true; },
      done: m => !!m.picked }, 'export'),
    briefStep({ id: 'file', ch: 4, title: 'Mark it as sent', write: true, sampleBody: 'Mark as sent records that this report went to the client. Nothing is emailed, and nothing is marked sent by itself. It locks the report until someone presses Change the sent report.',
      view(m, c) { if (c.ro) return show({ body: 'A person with a full key marks the report as sent; that locks it until someone presses Change the sent report. ' + VIEW, targets: [hook('status')].filter(Boolean) });
        if (c.filed && !m.open) return show({ phase: 'filed', body: 'Already marked as sent. Change the sent report is how it changes; nothing is marked sent by itself.', targets: [hook('reopen') || hook('status')].filter(Boolean) });
        m.open = true; const dlg = hook('file-dialog');
        // p72: the workbench's dialog is "Before you send"; its Go back to them is the one ringed (UX-SPEC s.6.3, s.8.4)
        if (dlg) { const back = all('button', dlg).find(x => /^Go back/.test(x.textContent.trim()));
          return { mode: 'do', phase: 'dialog', body: 'Before you send: some things are still to check. Go back to them, or Send anyway, which notes that you saw them and left them out.', line: 'Press Go back to them, or Send anyway', targets: [back || dlg] }; }
        const b = hook('file'); if (b && b.disabled && dirty()) return { mode: 'route', route: 'saved', title: 'Save your words first', body: 'A report with unsaved words cannot be marked as sent. Save them first.', line: 'Press Save changes', targets: [hook('save') || saveState()] };
        return { mode: 'do', phase: 'press', body: 'Mark as sent records that this report went to the client. Nothing is emailed, and nothing is marked sent by itself. It locks the report until someone presses Change the sent report. Mark it now if it is ready.', line: 'Press Mark as sent, or Not yet', targets: [b].filter(Boolean), alts: [{ label: 'Not yet, show me the rest', go: () => complete('got') }] }; },
      done: (m, c) => !!m.open && c.filed }, 'file'),

    tabStep('watch', 'watch', 'See what is watched', 'Watch is the list this desk collects on: words, hashtags, accounts and outlets.', () => hook('watch-kinds'),
      'Suggestions wait here until a person approves them; nothing suggested is collected before that. Find new keywords reads the archive for free; Group into themes uses 1 AI draft, and the guide does not ask for it.',
      '[role="tab"]', 'Press another kind, such as Accounts'),
    tabStep('collection', 'collection', 'See what was read', 'Collection says which channels delivered, and why not.', () => hook('gaps') || hook('channels') || hook('collectors'),
      'Collection is the one place the Den tells you a channel delivered nothing, why, and what to do about it. Collect now starts one collection; no AI draft.',
      'summary', 'Open Setup details, or how a channel is read'),
    /* p72 (UX-SPEC s.8.4): step 24 rings Draft each morning in Options, shown and never changed, in place of a section's Down */
    { id: 'options', ch: 5, title: 'Draft each morning',
      view(m, c) { if (c.tab !== 'options') return { mode: 'do', phase: 'tab', body: 'Options holds this report\'s own settings.', line: tabLine('options', c), targets: [tabTarget('options')] };
        const p = hook('opt-desk'); const lab = p ? all('label', p).find(x => /^\s*Draft each morning/.test(x.textContent)) : null;
        const body = 'Draft each morning writes this report at 7:00 each morning with one AI draft, so it is waiting when you open the Den. Options also holds the sections and their order, the window and the mutes. The guide only shows it: nothing changes until someone presses Save options.';
        return show({ phase: 'look', body, targets: [lab || hook('opt-sections') || p].filter(Boolean) }); },
      done: () => false }
  ];
  STEPS.forEach((s, i) => { s.n = i + 1; });
  const N = STEPS.length;
  const idxOf = id => STEPS.findIndex(s => s.id === id);

  /* ---------------------------------------------------------------- the layer */
  let layer = null, ui = 'none', cur = null, acts = [], lastHtml = '', lastFocus = null, sched = false, leftActive = false, restoreTo = null, tempTab = null;
  let fromRep = false;   // opened from Today's report: the finish goes back there
  function mount() {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div'); layer.id = 'den-tour'; layer.setAttribute('data-ui', 'none');
    layer.innerHTML = '<svg class="dt-shade" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d=""></path></svg><div class="dt-rings" aria-hidden="true"></div><div class="dt-slot"></div><div class="dt-live" aria-live="polite" aria-atomic="true"></div>';
    layer.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-act]'); if (!b || !layer.contains(b)) return; const f = acts[+b.getAttribute('data-act')]; if (f) { try { f(e); } catch (x) { fail(x); } } });
    layer.addEventListener('change', e => { const b = e.target.closest && e.target.closest('[data-act]'); if (b && b.type === 'checkbox') { const f = acts[+b.getAttribute('data-act')]; if (f) f(e); } });
    document.body.appendChild(layer); return layer;
  }
  const slot = () => mount().querySelector('.dt-slot');
  function announce(t) { const l = mount().querySelector('.dt-live'); l.textContent = ''; setTimeout(() => { l.textContent = t; }, 30); }
  function clearLayer() { acts = []; lastHtml = ''; if (!layer) return; layer.setAttribute('data-ui', 'none'); layer.className = ''; slot().innerHTML = ''; layer.querySelector('.dt-rings').innerHTML = ''; layer.querySelector('.dt-shade path').setAttribute('d', ''); }
  function fail(e) { try { console.warn('Den guide stopped: ' + (e && e.message || e)); } catch (x) {} try { if (S && S.status === 'active') put({ status: 'paused' }); ui = 'none'; cur = null; if (layer) layer.remove(); layer = null; } catch (x) {} }
  const btn = (label, f, cls, extra) => { acts.push(f); return '<button type="button" class="dt-btn' + (cls ? ' ' + cls : '') + '" data-act="' + (acts.length - 1) + '"' + (extra || '') + '>' + esc(label) + '</button>'; };
  function paint(html, focus) {
    const s = slot(); if (html === lastHtml) { if (focus) doFocus(focus); return; }
    const a = document.activeElement; const had = a && s.contains(a) ? (a.getAttribute('data-act') != null ? '[data-act="' + a.getAttribute('data-act') + '"]' : a.tagName === 'H2' ? 'h2' : a.type === 'checkbox' ? 'input' : '') : '';
    s.innerHTML = html; lastHtml = html; if (focus) doFocus(focus); else if (had) { const el = s.querySelector(had); if (el) el.focus({ preventScroll: true }); }
  }
  // the guide never takes the focus from a field the person is typing in on the Den
  const typing = () => { const a = document.activeElement; const r = root(); return !!(a && r && r.contains(a) && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)); };
  function doFocus(sel, force) { if (!force && typing()) return; const el = slot().querySelector(sel); if (el) try { el.focus({ preventScroll: true }); } catch (e) {} }

  /* geometry: the holes, the shade, the rings, the card's place */
  const pad = (r, p) => ({ left: r.left - p, top: r.top - p, right: r.right + p, bottom: r.bottom + p, width: r.width + 2 * p, height: r.height + 2 * p });
  const meets = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  function clipped(el) { const r = el.getBoundingClientRect(); if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return true;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll|hidden)/.test(s.overflow + s.overflowX + s.overflowY)) { const q = p.getBoundingClientRect(); if (r.top < q.top - 1 || r.bottom > q.bottom + 1 || r.left < q.left - 1 || r.right > q.right + 1) return true; } } return false; }
  function holes(targets) {
    return targets.map(el => { if (cur && cur.scrolled && !cur.scrolled.has(el) && clipped(el)) { cur.scrolled.add(el); try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' }); } catch (e) {} }
      const r = el.getBoundingClientRect(); const l = Math.max(0, r.left), t = Math.max(0, r.top), rr = Math.min(innerWidth, r.right), b = Math.min(innerHeight, r.bottom);
      return pad({ left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t }, 6); }).filter(r => r.width > 0 && r.height > 0);
  }
  function shade(hs) { const W = innerWidth, Hh = innerHeight; const svg = layer.querySelector('.dt-shade'); svg.setAttribute('width', W); svg.setAttribute('height', Hh); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    const rr = (r, k) => 'M' + (r.left + k) + ' ' + r.top + 'H' + (r.right - k) + 'Q' + r.right + ' ' + r.top + ' ' + r.right + ' ' + (r.top + k) + 'V' + (r.bottom - k) + 'Q' + r.right + ' ' + r.bottom + ' ' + (r.right - k) + ' ' + r.bottom + 'H' + (r.left + k) + 'Q' + r.left + ' ' + r.bottom + ' ' + r.left + ' ' + (r.bottom - k) + 'V' + (r.top + k) + 'Q' + r.left + ' ' + r.top + ' ' + (r.left + k) + ' ' + r.top + 'Z';
    layer.querySelector('.dt-shade path').setAttribute('d', 'M0 0H' + W + 'V' + Hh + 'H0Z' + hs.map(r => rr(r, Math.min(8, r.width / 2, r.height / 2))).join('')); }
  function drawRings(hs, labels, els) { const box = layer.querySelector('.dt-rings'); while (box.children.length > hs.length) box.lastChild.remove();
    while (box.children.length < hs.length) { const d = document.createElement('div'); d.className = 'dt-ring'; d.innerHTML = '<span class="dt-badge"></span>'; box.appendChild(d); }
    hs.forEach((r, i) => { const d = box.children[i]; d.style.left = r.left + 'px'; d.style.top = r.top + 'px'; d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
      const lab = labels[i] || ''; const b = d.firstChild; if (b.textContent !== lab) b.textContent = lab; d.classList.toggle('dt-below', r.top < 30 || !!(els && els[i] && els[i].matches && els[i].matches(PAID)));   /* a paid badge sits under its ring, never over the page's own words */ d.classList.toggle('dt-badged', i > 0 || /Drag|Press [0-9]|AI draft/.test(lab)); d.classList.toggle('dt-paid', !!(els && els[i] && els[i].matches(PAID))); }); }
  function place(card, hs, avoid) {
    const W = innerWidth, Hh = innerHeight, mg = 12, gap = 14; card.classList.toggle('dt-dock', W < 1100); if (W < 1100) { card.style.left = ''; card.style.top = ''; return; }
    const cw = card.offsetWidth, ch = card.offsetHeight; const no = hs.concat(avoid); const fits = p => p.left >= mg && p.top >= mg && p.left + cw <= W - mg && p.top + ch <= Hh - mg;
    const box = p => ({ left: p.left, top: p.top, right: p.left + cw, bottom: p.top + ch }); const ok = p => fits(p) && !no.some(r => meets(box(p), r));
    const cy = y => Math.max(mg, Math.min(Hh - ch - mg, y)), cx = x => Math.max(mg, Math.min(W - cw - mg, x)); let pick = null;
    if (hs.length) { const U = hs.reduce((a, r) => ({ left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom) }));
      for (const p of [{ left: U.right + gap, top: cy(U.top) }, { left: U.left - gap - cw, top: cy(U.top) }, { left: cx(U.left), top: U.bottom + gap }, { left: cx(U.left), top: U.top - gap - ch }]) if (ok(p)) { pick = p; break; }
      // two holes far apart (step 8: a card at the left, its drop column at the right): beside one of them, in the space between
      if (!pick && hs.length > 1) for (const r of hs) { for (const p of [{ left: r.right + gap, top: cy(r.top) }, { left: r.left - gap - cw, top: cy(r.top) }, { left: cx(r.left), top: r.bottom + gap }, { left: cx(r.left), top: r.top - gap - ch }]) if (ok(p)) { pick = p; break; } if (pick) break; } }
    if (!pick) for (const p of [{ left: W - cw - mg, top: Hh - ch - mg }, { left: mg, top: Hh - ch - mg }, { left: W - cw - mg, top: 60 }, { left: mg, top: 60 }]) if (!no.some(r => meets(box(p), r))) { pick = p; break; }
    pick = pick || { left: W - cw - mg, top: Hh - ch - mg }; card.style.left = Math.round(pick.left) + 'px'; card.style.top = Math.round(pick.top) + 'px'; }

  /* ---------------------------------------------------------------- one step on the screen */
  function routeOf(st, c) {
    if (st.today && c.past) return { mode: 'route', route: 'today', title: 'Come back to today', body: 'This step works on today\'s window. Reading another day spends nothing; press Today in the top bar to come back.', line: 'Press Today', targets: [hook('today')] };
    // every step is in the workbench: on Today's report the first press asked is the tool's More tools item (a visit)
    const want = st.tabs || (st.tab ? [st.tab] : c.tab === 'report' ? ['today'] : null);
    if (want && want.indexOf(c.tab) < 0) return { mode: 'route', route: 'tab', title: 'Go back to the ' + TABN[want[0]] + ' to carry on', body: 'This step is on the ' + TABN[want[0]] + (c.tab === 'report' ? ', in the workbench behind Today\'s report.' : ' tab.'), line: tabLine(want[0], c), targets: [tabTarget(want[0])] };
    return null;
  }
  function sampleArt(kind) {
    const A = { edit: '<p>Regional outlets led the story through the morning <span class="dt-chip">1</span>. Comment stayed small.<span class="dt-caret" aria-hidden="true"></span></p>',
      cite: '<div class="dt-mini"><b>Example Herald</b> - Council backs the harbour plan</div><p>... the plan passed on a close vote <span class="dt-chip dt-on">2</span></p>',
      jump: '<p>The vote was close <span class="dt-chip dt-on">2</span></p><div class="dt-mini dt-lit"><b>2</b> Example Herald - Council backs the harbour plan</div>',
      save: '<p class="dt-mono">All changes saved</p>', regen: '<p><span class="dt-fake">Rewrite (uses 1 AI draft)</span> <span class="dt-fake">Cancel</span></p>',
      history: '<table class="dt-tab"><tr><td>3</td><td>Edited Summary</td><td>Sam</td></tr><tr><td>2</td><td>Written</td><td>AI draft</td></tr></table>',
      foot: '<p class="dt-mono">All changes saved - 412 words - 2 to check</p>', export: '<p><span class="dt-fake">Copy for Google Docs</span> <span class="dt-fake">Download .md</span> <span class="dt-fake">Copy the Slack summary</span></p>',
      file: '<p class="dt-mono">Sent by Sam, 9:10 am</p>' };
    return Array.isArray(kind) ? '<ol class="dt-out">' + kind.map((t, i) => '<li' + (i === 1 ? ' class="dt-on"' : '') + '>' + esc(t) + '</li>').join('') + '</ol>' : A[kind] || '';
  }
  function stepTick() {
    const st = STEPS[cur.idx]; const c = ctx(); const t = now();
    let v; if (cur.flash) v = Object.assign({}, cur.last || {}, { flash: true });
    else { try { v = routeOf(st, c) || st.view(cur.m, c); } catch (e) { v = null; } v = v || { mode: 'do', wait: true, targets: [] };
      if (v.mode !== 'route' && !v.wait && !cur.back) { let ok = false; try { ok = !!st.done(cur.m, c); } catch (e) {} if (ok) { cur.last = v; return complete('did'); } } }
    const dlg = dialog(); let targets = (v.targets || []).filter(visible);
    if (!v.flash && dlg && !targets.some(x => dlg.contains(x))) { v = Object.assign({}, v, { suspended: true }); targets = []; }
    const phase = (v.mode === 'route' ? 'route:' + v.route : v.phase || '') + (v.suspended ? ':dlg' : ''); if (phase !== cur.phase) { cur.phase = phase; cur.phaseAt = t; cur.miss = 0; }
    if (v.mode === 'do' && !v.flash && !v.suspended && !targets.length) { cur.miss = cur.miss || t; if (!loading() && t - cur.miss > 4000) v = Object.assign({}, v, { mode: 'show', missing: true }); } else cur.miss = 0;
    cur.view = { id: st.id, n: st.n, phase: v.phase || (v.mode === 'route' ? v.route : ''), mode: v.missing ? 'show' : v.mode, route: v.route || '', key: v.key || '', flash: !!v.flash, title: v.title || st.title, sample: !!v.sample };
    cur.target = targets[0] || null; const stuck = t - cur.phaseAt;
    acts = []; const done = (S.done || []).indexOf(st.id) >= 0;
    const eyebrow = v.mode === 'route' ? 'Before step ' + st.n : CHAPTERS[st.ch];
    const segs = CHAPTERS.map((n, i) => '<span class="dt-seg' + (i < st.ch ? ' dt-on' : i === st.ch ? ' dt-cur' : '') + '"></span>').join('');
    const glyph = v.mode === 'show' ? 'Look' : v.act || (st.id === 'find' ? 'Type' : 'Click');
    let status = v.flash ? 'Done' : v.suspended ? 'A dialog is open: finish with it first. The guide waits.' : v.missing ? 'This control is not available right now. Skip this step, or come back to it from the Guide button.' : v.wait || (v.mode === 'do' && !targets.length) ? (loading() ? 'Waiting for the page to load.' : 'Waiting for the control to appear.') : v.status || '';
    if (!status && v.mode === 'do' && stuck > 20000) status = 'Can\'t find it? The ring shows where.';
    status = v.flash ? '<span class="dt-ok">Done</span>' : esc(status);
    const primSkip = v.missing || (v.mode === 'do' && stuck > 45000);
    let nav = '';
    if (v.mode === 'show' && !v.noGot && !v.missing && !v.flash) nav += btn(done ? 'Next' : 'Got it', () => { if (v.got) v.got(); if (done) goIdx(cur.idx + 1, true); else complete('got'); }, 'dt-primary');
    else if (done && v.mode === 'do' && !v.flash) nav += btn('Next', () => goIdx(cur.idx + 1, true), 'dt-primary');
    const alts = (v.alts || []).map(a => btn(a.label, a.go, a.primary ? 'dt-primary' : '')).join('');
    if (v.mode === 'do' && stuck > 20000 && cur.target) nav += btn('Show me where', () => { cur.scrolled = new WeakSet(); layer.classList.remove('dt-repulse'); void layer.offsetWidth; layer.classList.add('dt-repulse'); setTimeout(() => layer.classList.remove('dt-repulse'), 1600); schedule(); });
    nav += btn('Back', () => goIdx(cur.idx - 1, true), '', cur.idx === 0 ? ' disabled' : '') + btn('Skip this step', () => complete('skip'), primSkip ? 'dt-primary' : '') + btn('I\'ll do it later', later);
    const sampleHtml = v.sample ? '<div class="dt-sample"><div class="dt-sample-h">' + esc(SAMPLE) + '</div>' + sampleArt(st.art || st.id) + '</div>' : '';
    const html = '<section class="dt-card" role="region" aria-label="Guide"' + (v.mode === 'show' ? ' data-mode="show"' : '') + '>' +
      btn('×', later, 'dt-x', ' aria-label="Close the guide (I\'ll do it later)" title="Close the guide (I\'ll do it later)"') +
      '<div class="dt-eyebrow"><span>' + esc(eyebrow) + '</span><span>Step ' + st.n + ' of ' + N + '</span></div>' +
      '<div class="dt-bar" role="progressbar" aria-label="Guide progress" aria-valuemin="1" aria-valuemax="' + N + '" aria-valuenow="' + st.n + '" aria-valuetext="Step ' + st.n + ' of ' + N + ', ' + esc(CHAPTERS[st.ch]) + '">' + segs + '</div>' +
      '<h2 tabindex="-1">' + esc(v.title || st.title) + '</h2><p class="dt-body">' + esc(v.body || '') + '</p>' + sampleHtml +
      (v.cost ? '<p class="dt-cost">' + esc(v.cost) + '</p>' : '') +
      (v.line && !v.flash ? '<p class="dt-act"><span class="dt-glyph">' + esc(glyph) + '</span>' + esc(v.line) + '</p>' : '') +
      '<p class="dt-status"></p>' +
      (alts ? '<div class="dt-alts">' + alts + '</div>' : '') + '<div class="dt-nav">' + nav + '</div>' +
      (cur.target && !v.flash ? '<div class="dt-foot">' + btn('Go to the highlighted control (Alt+G)', toTarget, 'dt-link') + '</div>' : '') + '</section>';
    layer.setAttribute('data-ui', 'step'); layer.className = (v.mode === 'show' || v.missing ? 'dt-show' : 'dt-do') + (reduced() ? ' dt-reduced' : '') + (v.suspended ? ' dt-suspended' : '') + (layer.classList.contains('dt-repulse') ? ' dt-repulse' : '');
    paint(html, cur.focus ? 'h2' : null); cur.focus = false;
    const sl = slot().querySelector('.dt-status'); if (sl && sl.innerHTML !== status) sl.innerHTML = status;   // the status line changes in place: the card is not redrawn for a second's tick
    const hs = holes(targets); shade(hs);
    // a control that uses an AI draft (data-paid="1") is only ever pointed at: its ring says the cost, and nothing here presses it
    const lab = i => (targets[i] && targets[i].matches(PAID) ? '1 AI draft, you press it' : (v.badges && v.badges[i]) || (v.mode === 'show' ? 'Look here' : i > 0 ? 'And here' : glyph === 'Type' ? 'Type here' : glyph === 'Drag' ? 'Drag from here' : glyph === 'Choose' ? 'Choose here' : /^Press [0-9]$/.test(glyph) ? 'Click here' : 'Press here'));
    drawRings(hs, hs.map((r, i) => lab(i)), targets);
    const avoid = [hook('export-menu'), hook('check-pop'), dlg].filter(Boolean).map(e => pad(e.getBoundingClientRect(), 4));   // a Den dialog stays clear (step 21 rings one of its buttons)
    place(slot().querySelector('.dt-card'), hs, avoid);
  }
  function toTarget() { const el = cur && cur.target; if (!el) return; if (!(el.tabIndex >= 0) && !/^(BUTTON|INPUT|SELECT|TEXTAREA|A)$/.test(el.tagName)) { el.setAttribute('tabindex', '-1'); tempTab = el; el.addEventListener('blur', () => { if (tempTab === el) { el.removeAttribute('tabindex'); tempTab = null; } }, { once: true }); } try { el.focus({ preventScroll: false }); } catch (e) {} }

  /* ---------------------------------------------------------------- moving between steps */
  function timeOn() { if (!cur) return; const id = STEPS[cur.idx].id; const t = Object.assign({}, S.t || {}); t[id] = (t[id] || 0) + (now() - cur.at); put({ t }); }
  function goIdx(i, fromCard) {
    if (cur) timeOn(); if (i < 0) i = 0; if (i >= N) return finish();
    const back = !!cur && i < cur.idx;   // reached through Back: done() waits for the person's own next action, so the step is not completed (and left) by the state it was entered in
    cur = { idx: i, m: {}, at: now(), phase: null, phaseAt: now(), scrolled: new WeakSet(), focus: !!fromCard, back }; ui = 'step'; put({ status: 'active', step: STEPS[i].id });
    tick(); const v = cur && cur.view; if (v) announce('Step ' + STEPS[i].n + ' of ' + N + '. ' + v.title + '.');
  }
  const goId = (id, fromCard) => goIdx(Math.max(0, idxOf(id)), fromCard);
  function skipTo(id, list) { const sk = (S.skipped || []).filter(x => list.indexOf(x) < 0).concat(list); const dn = (S.done || []).filter(x => list.indexOf(x) < 0); put({ skipped: sk, done: dn }); goId(id, true); }
  function complete(how) {
    if (!cur || cur.flash) return; const id = STEPS[cur.idx].id; const done = (S.done || []).filter(x => x !== id), sk = (S.skipped || []).filter(x => x !== id);
    if (how === 'skip') sk.push(id); else done.push(id); put({ done, skipped: sk });
    if (how !== 'did') return goIdx(cur.idx + 1, true);
    cur.flash = now(); announce('Done.'); const me = cur; paintStep(); setTimeout(() => { if (cur === me && ui === 'step') { cur.flash = 0; goIdx(cur.idx + 1, false); } }, reduced() ? 400 : 700);
  }
  const paintStep = () => { try { stepTick(); } catch (e) { fail(e); } };
  function later() { const t = cur && cur.target; if (cur) timeOn(); put({ status: 'paused' }); ui = 'none'; cur = null; clearLayer(); const g = any('guide'); try { (t && t.isConnected ? t : g || document.body).focus({ preventScroll: true }); } catch (e) {} announce('The guide is paused. Help, Full guided tour of the tools, or the Guide button beside ?, brings it back.'); }

  /* ---------------------------------------------------------------- modals, prompts, the menu */
  function modal(title, body, buttons, extra) {
    return '<div class="dt-backdrop"></div><section class="dt-card dt-modal" role="dialog" aria-modal="true" aria-labelledby="dt-mt"><h2 id="dt-mt" tabindex="-1">' + esc(title) + '</h2>' + body + (extra || '') + '<div class="dt-nav">' + buttons + '</div></section>';
  }
  function welcome() { ui = 'welcome'; restoreTo = document.activeElement; renderStatic(true); }
  function renderStatic(first) {
    mount(); acts = []; const c = ctx(); let html = '', focus = null; layer.className = (reduced() ? 'dt-reduced ' : '') + (ui === 'welcome' || ui === 'finish' ? 'dt-modal-on' : 'dt-quiet');
    if (ui === 'welcome') { html = modal('Full guided tour of the tools', '<p class="dt-body">' + esc(WELCOME) + '</p><p class="dt-body">It runs on ' + esc(c.desk) + '. You press each control yourself and the guide points at it. Nothing is spent unless you press a button that says it uses an AI draft, and the guide never presses one.</p>' + (c.ro ? '<p class="dt-body">Your key is view-only, so I will show the steps that change things instead of asking for them.</p>' : ''),
      btn('Start the guide', () => { closeModal(); start(); }, 'dt-primary') + btn('I\'ll do it later', () => { put({ status: 'dismissed' }); closeModal(); backIfVisit(); })); if (first) focus = '.dt-btn.dt-primary'; }
    else if (ui === 'finish') { const w = S.w || {}; const bits = []; if (w.pin) bits.push('marked ' + w.pin + ' card' + (w.pin === 1 ? '' : 's') + ' must mention'); if (w.aside) bits.push('set ' + w.aside + ' aside'); if (w.file) bits.push('added ' + w.file + ' to sections');
      const line = bits.length ? '<p class="dt-body">You ' + bits.join(' and ').replace(/ and (?=[^,]* and )/, ', ') + '. Undo is on the Board.</p>' : '';
      html = modal('That is the whole tour', '<p class="dt-body">Finding stories, sources and settings, on ' + esc(c.desk) + '. Replay it any time from Help, Full guided tour of the tools, or the Guide button beside ?.</p>' + line,
        (fromRep ? btn('Back to Today\'s report', () => endTour('report'), 'dt-primary') : btn('Back to the Board', () => endTour('today'), 'dt-primary')) + btn('Keyboard shortcuts', () => endTour('help'))); if (first) focus = '.dt-btn.dt-primary'; }
    else if (ui === 'resume') { const st = STEPS[Math.max(0, idxOf(S.step))]; html = '<section class="dt-card dt-prompt" role="region" aria-label="Guide"><h2>Carry on with the guide?</h2><p class="dt-body">You were on step ' + st.n + ' of ' + N + ': ' + esc(st.title) + '.</p><div class="dt-nav">' +
      btn('Carry on', () => { ui = 'none'; goId(st.id, true); }, 'dt-primary') + btn('Start over', () => { ui = 'none'; start(); }) + btn('Not now', () => { put({ status: 'paused' }); quiet(); }) + btn('Don\'t ask again', () => { put({ ask: 'never', status: 'paused' }); quiet(); note(); }) + '</div></section>'; }
    else if (ui === 'menu') { const st = S && S.step && idxOf(S.step) >= 0 && (S.status === 'active' || S.status === 'paused') ? STEPS[idxOf(S.step)] : null;
      html = '<section class="dt-card dt-menu" role="region" aria-label="Guide">' + btn('×', () => { quiet(); backIfVisit(); }, 'dt-x', ' aria-label="Close the guide menu"') + '<h2 tabindex="-1">Full guided tour of the tools</h2><p class="dt-body">' + esc(WELCOME) + ' ' + N + ' steps; you press each control yourself and the guide spends nothing.</p><div class="dt-nav dt-col">' +
        btn('Start from the beginning', () => { ui = 'none'; start(); }, 'dt-primary') + (st ? btn('Resume at step ' + st.n + ': ' + st.title, () => { ui = 'none'; goId(st.id, true); }) : '') + '</div>' +
        '<div class="dt-chapters" role="group" aria-label="Chapters">' + CHAPTERS.map((n, i) => btn(n, () => { ui = 'none'; const j = STEPS.findIndex(s => s.ch === i); put({ runs: (S && S.runs || 0) + 1 }); goIdx(j, true); }, 'dt-chip-btn')).join('') + '</div></section>';
      if (first) focus = '.dt-btn.dt-primary'; }
    else if (ui === 'note') html = '<section class="dt-card dt-note" role="region" aria-label="Guide"><p class="dt-body">' + esc(noteText) + '</p><div class="dt-nav">' + btn('Got it', () => quiet(), 'dt-primary') + '</div></section>';
    layer.setAttribute('data-ui', ui); layer.querySelector('.dt-rings').innerHTML = ''; layer.querySelector('.dt-shade path').setAttribute('d', ui === 'welcome' || ui === 'finish' ? 'M0 0H' + innerWidth + 'V' + innerHeight + 'H0Z' : '');
    if (ui === 'welcome' || ui === 'finish') { const svg = layer.querySelector('.dt-shade'); svg.setAttribute('width', innerWidth); svg.setAttribute('height', innerHeight); }
    paint(html, focus); if (first && ui === 'resume') announce('Carry on with the guide?');
  }
  let noteText = '';
  function note(t) { noteText = t || 'Okay. The Guide button beside ? brings it back.'; ui = 'note'; renderStatic(); announce(noteText); }
  /* Closing the menu or a prompt removes the focused button: the focus goes back to where it was when the menu or the
     prompt opened, or to the Guide button, never to the page body. */
  function quiet() { const a = document.activeElement; const had = !!layer && !!a && layer.contains(a); ui = 'none'; clearLayer(); const r = restoreTo; restoreTo = null;
    if (had || !document.activeElement || document.activeElement === document.body) { const t = r && r.isConnected && r !== document.body && !(layer && layer.contains(r)) ? r : any('guide'); if (t) try { t.focus({ preventScroll: true }); } catch (e) {} } }
  function closeModal() { ui = 'none'; clearLayer(); const r = restoreTo; restoreTo = null; if (r && r.isConnected && r.focus) try { r.focus({ preventScroll: true }); } catch (e) {} }
  function finish() { if (cur) timeOn(); cur = null; put({ status: 'done', completedAt: now() }); ui = 'finish'; restoreTo = null; renderStatic(true); announce('That is the whole tour.'); }
  /* Back to Today's report: Today chosen (ax_den_tab = report, as den.js's own choice writes it), through the window event
     'ax:goto' that den.js's goto hook already listens to; the guide presses no Den control and calls nothing. */
  function toReport() { try { localStorage.setItem('ax_den_tab', JSON.stringify('report')); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('ax:goto', { detail: { view: 'den', params: { tab: 'report' } } })); } catch (e) {}
    setTimeout(() => { const h = document.querySelector('#den-root .dt-status h1') || document.querySelector('#den-root h1'); if (h) try { if (!(h.tabIndex >= 0)) h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } catch (e) {} }, 120); }
  // opened from Today and closed without starting: back where the person was (the workbench was only a visit)
  function backIfVisit() { if (fromRep && !(S && S.status === 'active')) { fromRep = false; toReport(); } }
  function endTour(to) { put({ status: 'done' }); ui = 'none'; clearLayer();
    if (to === 'report') { fromRep = false; toReport(); announce('Today\'s report.'); return; }
    const el = to === 'today' ? document.getElementById('den-tab-today') : any('help'); if (el) try { el.focus(); } catch (e) {} announce(to === 'today' ? 'Press Enter to open the Board.' : 'Press Enter, or ?, for the keyboard sheet.'); }

  /* ---------------------------------------------------------------- the loop */
  function schedule() { if (sched) return; sched = true; const f = () => { if (!sched) return; sched = false; tick(); }; if (window.requestAnimationFrame) requestAnimationFrame(f); setTimeout(f, 100); }
  function tick() {
    try {
      if (ui === 'none') return;
      mount(); if (!inDen()) { layer.style.display = 'none'; if (ui === 'step') { timeOn(); put({ status: 'paused' }); ui = 'none'; cur = null; clearLayer(); leftActive = true; } return; }
      layer.style.display = '';
      if (ui === 'step') { if (!app()) { slot().innerHTML = ''; lastHtml = ''; return; } stepTick(); } else renderStatic(false);
    } catch (e) { fail(e); }
  }
  /* p72 (UX-SPEC s.8.1): the guide never offers itself when the Den opens, in either room: no welcome, no "carry on", no
     daily question. The one thing boot still does: a person who left the Den in the middle of a step (another AXIOM view)
     and comes back in the same session is asked whether to carry on. */
  function boot() {
    try {
      if (!inDen()) { if (layer) layer.style.display = 'none'; return; }
      if (layer) layer.style.display = '';
      if (!app()) return;
      if (leftActive && ui === 'none') { leftActive = false; S = load() || S; if (S && S.ask !== 'never') { ui = 'resume'; renderStatic(true); } }
    } catch (e) { fail(e); }
  }
  // what the person does, seen and never stopped: capture phase, passive, no preventDefault
  const onEv = e => { try { if (layer && e.target && e.target.nodeType === 1 && layer.contains(e.target)) return;
    if (e.type === 'den:did' && ui === 'step' && e.detail) { const w = Object.assign({}, S.w || {}); const d = e.detail; if (d.what === 'pin') w.pin = (w.pin || 0) + 1; if (d.what === 'aside') w.aside = (w.aside || 0) + (Array.isArray(d.items) ? d.items.length : 1); if (d.what === 'file' && d.sec) w.file = (w.file || 0) + 1; put({ w }); }
    if (ui === 'step' && cur && !cur.flash) { if (e.type !== 'focusin' && e.type !== 'den:did') cur.back = false; const st = STEPS[cur.idx]; if (st.on) st.on(cur.m, e, ctx()); } schedule(); } catch (x) {} };
  ['click', 'input', 'change', 'keydown', 'dragstart', 'drop', 'dragend', 'focusin'].forEach(t => document.addEventListener(t, onEv, { capture: true, passive: true }));
  window.addEventListener('den:did', onEv); window.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, { capture: true, passive: true });
  // the guide's own keys: Alt+G between the card and the control; Escape only from inside the card; Tab kept inside a modal
  document.addEventListener('keydown', e => { try {
    if (ui === 'none' || !layer) return; const inCard = layer.contains(document.activeElement);
    if (e.altKey && (e.code === 'KeyG' || /^g$/i.test(e.key))) { if (ui === 'step') { e.preventDefault(); if (inCard) toTarget(); else doFocus('h2', true); } else if (ui !== 'welcome' && ui !== 'finish') { e.preventDefault(); doFocus(inCard ? '.dt-btn' : '.dt-btn.dt-primary'); } return; }
    if (e.key === 'Escape' && inCard) { if (ui === 'welcome') { put({ status: 'dismissed' }); closeModal(); backIfVisit(); } else if (ui === 'finish') endTour(fromRep ? 'report' : 'today'); else if (ui === 'step') later(); else if (ui === 'menu') { quiet(); backIfVisit(); } else quiet(); return; }
    if ((ui === 'welcome' || ui === 'finish') && !/^(Tab|Enter| |Spacebar)$/.test(e.key)) e.stopPropagation();   // Alt+1-5, ?, / and Ctrl+S never reach the Den behind the modal
    if (e.key === 'Tab' && (ui === 'welcome' || ui === 'finish')) { const f = Array.from(slot().querySelectorAll('button:not([disabled]), input')); if (!f.length) return; const a = f[0], z = f[f.length - 1];
      if (!inCard) { e.preventDefault(); a.focus(); } else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  } catch (x) {} }, true);
  let mo = null; function watch() { const r = root(); if (!r || (mo && mo.r === r)) return; if (mo) mo.disconnect(); mo = new MutationObserver(schedule); mo.r = r;
    mo.observe(r, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected', 'aria-expanded', 'aria-pressed', 'aria-current', 'hidden', 'disabled', 'data-state', 'data-dirty', 'data-status', 'data-pinned', 'data-cited', 'data-what', 'data-n', 'data-left'] }); }
  setInterval(() => { watch(); boot(); if (ui === 'step') schedule(); }, 400);

  /* ---------------------------------------------------------------- the public face */
  function start(id) {
    const fresh = !id; const i = fresh ? 0 : idxOf(id); if (i < 0) return;
    put(Object.assign({ status: 'active', runs: ((S && S.runs) || 0) + (fresh ? 1 : 0), v: V }, fresh ? { done: [], skipped: [], sample: false, w: {}, t: {}, startedAt: now() } : {}));
    for (const k in X) delete X[k]; ui = 'none'; clearLayer(); if (!app()) { note('The guide needs a report set up. Ask the Den\'s owner to add one, then open the guide again.'); return; } goIdx(i, true);
  }
  window.DenTour = {
    /* open({ via, from }): the welcome the first time (never started), else the menu. from: 'report' when Today's Help (or the
       Keyboard sheet on Today) opened it; den.js has already opened the workbench as a visit. */
    open(o) { fromRep = !!(o && o.from === 'report'); mount(); if (!(layer && layer.contains(document.activeElement))) restoreTo = document.activeElement; if (!app()) { note('The guide needs a report set up. Ask the Den\'s owner to add one, then open the guide again.'); return; } if (ui === 'step' && cur) { timeOn(); put({ status: 'paused' }); cur = null; }
      if (!S || (!S.runs && !/^(done|active|paused)$/.test(S.status || ''))) return welcome(); ui = 'menu'; renderStatic(true); },
    start(id) { start(id); },
    pause() { if (ui === 'step') later(); },
    stop() { if (cur) timeOn(); cur = null; put({ status: 'dismissed' }); quiet(); },
    reset() { try { localStorage.removeItem(KEY); } catch (e) {} S = null; cur = null; quiet(); },
    state() { return Object.assign({}, S ? JSON.parse(JSON.stringify(S)) : {}, { ui, from: fromRep ? 'report' : '', view: ui === 'step' && cur ? Object.assign({}, cur.view || { id: STEPS[cur.idx].id, n: STEPS[cur.idx].n, mode: 'do', flash: !!cur.flash }) : null }); },
    steps: STEPS.map(s => ({ id: s.id, n: s.n, chapter: CHAPTERS[s.ch], title: s.title, paid: !!s.paid, writes: !!s.write }))
  };
})();
