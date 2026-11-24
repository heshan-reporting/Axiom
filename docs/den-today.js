/* AXIOM - Anne's Den: Today's report (build p72, page lane P3; UX-SPEC Part D s.2 to s.11, s.13's fallback, s.14).
 * The room the analyst opens each morning: her report as it will be pasted, Check before you send beside it with the send
 * block at its foot, one switcher of her reports, More tools and Help. Loaded after docs/den-flags.js and before docs/den.js,
 * it gives window.DenToday:
 *
 *   use(D)       den.js hands over its shared names once at load (call, getText, q, ls, say, Dialog...)
 *   Live         the room's one polite region and its one alert region (s.10.4); say(t) and alert(t) speak through them
 *   Top          the room's top bar: skip links, AXIOM, Your reports, More tools, Help (s.4.2, s.7), and the checks sheet
 *   Layout       what BriefPanel draws on Today (s.14: one BriefPanel, two layouts): the status line, the report, the check
 *                column and its send block, the bottom bar under 1200 px, the Sources drawer, the three intro cards
 *
 * One BriefPanel instance serves both rooms, so the save queue, the revision check, the unsaved words (ax_den_work_<brief>)
 * and Undo are one state (rule 10). Check before you send is P2's component (window.DenFlags), the drawer is P1's pane in its
 * drawer room (window.DenPane). Nothing here spends without saying so; the intro cards press nothing. Styles: den-today.css. */
(function () {
  'use strict';
  const DT = window.DenToday = window.DenToday || {};
  if (!window.React || !window.AXUI || !window.AXUI.html) return;
  const html = window.AXUI.html; const { useState, useEffect, useRef } = React;
  let D = null; DT.use = d => { D = d; };
  const F = () => window.DenFlags || null; const PN = () => window.DenPane || null;
  const TZ = 'Australia/Sydney';
  const fHM = new Intl.DateTimeFormat('en-AU', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const hm = ts => (ts ? fHM.format(new Date(+ts)) : '');
  const fDay = new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  const dayLong = day => { try { const p = {}; fDay.formatToParts(new Date(day + 'T12:00:00Z')).forEach(x => { p[x.type] = x.value; }); return p.weekday + ' ' + p.day + ' ' + p.month; } catch (e) { return String(day || ''); } };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateWords = day => { const m = /^(\d{4})-(\d\d)-(\d\d)$/.exec(String(day || '')); return m ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] + ' ' + m[1] : String(day || ''); };
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  const andList = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
  const fnv = s => { s = String(s == null ? '' : s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16); };
  const MARK = /\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g;
  const CH = { news: 'News', x: 'X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit', bluesky: 'Bluesky', mastodon: 'Mastodon', substack: 'Substack', petitions: 'Petitions', forum: 'Forum', linkedin: 'LinkedIn', tiktok: 'TikTok', threads: 'Threads', meta: 'Facebook and Instagram' };
  const errSay = e => { const m = String((e && e.message) || e || ''); return !e || e.status === 0 || (/Failed to fetch|NetworkError|Load failed|network/i.test(m) && !e.code) ? 'the connection to AXIOM dropped before an answer came back' : e.code === 'bad_answer' ? 'AXIOM sent something this page can\'t read. Nothing was changed' : m.replace(/\.$/, ''); };

  /* ---- a small store the top bar and the layout share: the introduction and the sheets (no Den state lives here) ---- */
  const store = { intro: 0, introLine: false, offered: false, sheet: '' }; const subs = new Set();
  const setStore = o => { Object.assign(store, o); subs.forEach(f => f()); };
  const useStore = () => { const [, f] = useState(0); useEffect(() => { const g = () => f(x => x + 1); subs.add(g); return () => { subs.delete(g); }; }, []); return store; };
  // what was copied, by report, so the copy guard holds across a visit to the workbench (the layout remounts; the record stays)
  const COPIED = {};

  /* ---- the one polite region and the one alert region (s.10.4): every announcement goes through say() ---- */
  let sayFn = null, alertFn = null;
  DT.say = t => { if (sayFn) sayFn(String(t || '')); };
  DT.alert = t => { if (alertFn) alertFn(String(t || '')); };
  function Live() {
    const [m, setM] = useState(''); const [al, setAl] = useState(''); const tm = useRef(0); const ta = useRef(0);
    useEffect(() => { sayFn = t => { clearTimeout(tm.current); setM(''); tm.current = setTimeout(() => setM(t), 40); }; alertFn = t => { clearTimeout(ta.current); setAl(''); ta.current = setTimeout(() => setAl(t), 40); };
      return () => { sayFn = null; alertFn = null; clearTimeout(tm.current); clearTimeout(ta.current); }; }, []);
    return html`<div class="den-sr" role="status" aria-live="polite" data-dt-live="polite">${m}</div><div class="den-sr" role="alert" data-dt-live="alert">${al}</div>`;
  }

  /* ---- a disclosure list closes on Escape (the focus goes back to its button) and on a press outside it ---- */
  function useOutside(open, ref, close) {
    useEffect(() => { if (!open) return; const out = e => { if (ref.current && !ref.current.contains(e.target)) close(false); };
      const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); close(true); } };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [open]);   // eslint-disable-line
  }
  const focusSoon = (sel, ms) => setTimeout(() => { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (el && el.focus) { try { el.focus({ preventScroll: false }); } catch (e) {} } }, ms || 60);
  /* p72 review U1: Copy and Mark as sent are drawn twice (the column's send block, and the bottom bar under 1200 px), and only one
     of the two is seen: a focus goes to the one she can see */
  const drawn = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const focusDrawn = (root, sel, ms) => setTimeout(() => { const el = Array.from((root || document).querySelectorAll(sel)).find(drawn); if (el) { try { el.focus({ preventScroll: false }); } catch (e) {} } }, ms || 60);
  const ACT = k => '.dt-send [data-act="' + k + '"], .dt-bar [data-act="' + k + '"]';
  // under 1200 px the column folds into the bottom bar (s.11); what the send block says is drawn above the bar then (U1, U3)
  const NARROW = '(max-width: 1199px)';
  function useNarrow() { const mq = () => { try { return window.matchMedia(NARROW).matches; } catch (e) { return false; } }; const [n, setN] = useState(mq);
    useEffect(() => { let m; try { m = window.matchMedia(NARROW); } catch (e) { return undefined; } const f = () => setN(m.matches); f(); if (m.addEventListener) m.addEventListener('change', f); else if (m.addListener) m.addListener(f);
      return () => { if (m.removeEventListener) m.removeEventListener('change', f); else if (m.removeListener) m.removeListener(f); }; }, []); return n; }
  const waitFor = (fn, ms) => new Promise(r => { const t0 = Date.now(); const tick = () => { let v = false; try { v = fn(); } catch (e) {} if (v || Date.now() - t0 > ms) r(v); else setTimeout(tick, 80); }; tick(); });

  /* ---- What the checks mean (Help; s.7). A sheet: a non-modal dialog, its heading takes the focus, Escape closes it. ---- */
  const MEANING = [['A sentence that lost its source', 'The AI gave a sentence a source that didn\'t back it up, so the source was taken out. Choose a source, delete the sentence, or edit it.'],
    ['A figure not found in its source', 'A number in the sentence isn\'t in the story or post it points to. Edit it, or say the figure is right.'], ['A figure with no source', 'A number with no source behind it. Choose a source for it.'],
    ['A paywalled quote cut to 30 words', 'Quotes from subscriber stories are kept short. Check the cut still reads well; "Leave it" is fine if it does.'],
    ['A spike, an emerging story, a post with unusual reach, a new voice, an issue busier than usual', 'Things noticed today that the report doesn\'t mention yet. Mention each in a sentence, or leave it out and say why.'],
    ['A must-mention story the report doesn\'t mention', 'Someone marked this story must-mention. Write a sentence for it, or leave it out.'], ['Nothing written under a section', 'An empty section won\'t be in the copy. Write it yourself, or add a new source.'],
    ['A word readers won\'t know', 'A word the Den uses for its own work. Readers won\'t know it: say what is meant.'], ['A rating today\'s coverage doesn\'t support', 'A rating that reads differently from today\'s coverage. Change it, or say it stands.']];
  function Sheet({ onClose }) {
    const ref = useRef(null);
    useEffect(() => { const h = ref.current && ref.current.querySelector('h2'); if (h) h.focus(); const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); onClose(true); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, []);   // eslint-disable-line
    return html`<div class="dt-sheet" role="dialog" aria-modal="false" aria-labelledby="dt-sheet-h" ref=${ref}><div class="dt-sheet-h"><h2 id="dt-sheet-h" tabindex="-1">What the checks mean</h2><button type="button" class="den-mini quiet" onClick=${() => onClose(true)}>Close</button></div>
      <div class="dt-sheet-b"><p class="dt-quiet">The Den checks sources, figures, quotes and alerts. It can't tell whether a claim is fair: that's your read.</p><dl>${MEANING.map(k => html`<div key=${k[0]}><dt>${k[0]}</dt><dd>${k[1]}</dd></div>`)}</dl></div></div>`;
  }

  /* ---- the top bar (s.4.2, s.7): skip links, AXIOM, Your reports, More tools, Help ---- */
  const lineLabel = l => (l ? ', ' + l[0].charAt(0).toLowerCase() + l[0].slice(1).replace(/ \u00b7 /g, ', ') : '');
  function Top(p) {
    const { desks, desk, mine, lineOf, pick, remove, budget, visit, refresh, actions, setDay, today, keys, tour, back, to } = p;
    // the coverage report (docs/den-snapshot.js): figures and charts counted from the window, no AI; absent when its script is
    const snap = window.DenSnapshot && typeof window.DenSnapshot.open === 'function' ? opener => window.DenSnapshot.open({ desk, to, opener }) : null;
    const S = useStore(); const [menu, setMenu] = useState(''); const [sub, setSub] = useState(''); const box = useRef(null);
    const close = backTo => { const m = menu; setMenu(''); setSub(''); if (backTo && m) focusSoon('#dt-btn-' + m, 0); };
    useOutside(menu, box, close);   // keyed on which menu (p72 review P12): moving from one to another gives the focus back to the right button
    const toggle = m => { if (menu === m) close(false); else { setMenu(m); setSub(m === 'others' ? 'others' : ''); } };
    const run = fn => () => { setMenu(''); setSub(''); fn(); };
    const A = actions || {}; const mineIds = mine.map(d => d.id);
    const item = (label, fn, small, o) => html`<li key=${label}><button type="button" class="dt-mi" data-mi=${(o && o.id) || null} disabled=${o && o.disabled} onClick=${fn}><span>${label}</span>${small ? html`<small>${small}</small>` : null}</button></li>`;
    const othersList = html`<div class="dt-mlist" id="dt-list-others" role="group" aria-label="Other reports"><h3>Every report, today</h3><ul>${desks.map(d => { const l = lineOf(d); const m = mineIds.indexOf(d.id) >= 0;
        return html`<li key=${d.id} class="dt-other"><button type="button" class="dt-mi" data-desk=${d.id} aria-current=${d.id === desk.id ? 'page' : null} aria-label=${d.name + lineLabel(l) + (m ? ', in your reports' : '')} onClick=${run(() => pick(d.id))}><span>${d.name}${m ? html` <small>in your reports</small>` : null}</span>${l ? html`<small>${l[0]}</small>` : null}</button>
          ${m && mine.length > 1 ? html`<button type="button" class="den-link dt-rm" aria-label=${'Remove from my reports: ' + d.name} onClick=${() => remove(d.id)}>Remove from my reports</button>` : null}</li>`; })}</ul><p class="dt-mfoot">Choosing one opens it here and adds it to your reports.</p></div>`;
    const jumpList = html`<div class="dt-mlist" id="dt-list-jump" role="group" aria-label="Jump to a section"><h3>Jump to a section</h3><ul>${(A.sections || []).map(s => item(s.title, run(() => A.jump && A.jump(s.id))))}</ul></div>`;
    const dayBox = html`<div class="dt-mlist" id="dt-list-day" role="group" aria-label="Open another day"><h3>Open another day</h3><label class="dt-daylab">Day<input type="date" max=${today} onChange=${e => { const v = e.target.value; if (/^\d{4}-\d\d-\d\d$/.test(v)) { setMenu(''); setSub(''); setDay(v); } }} /></label><p class="dt-mfoot">A report is written for today only; another day shows what was written then.</p></div>`;
    const gap = !!(p.gaps && p.gaps.length);
    const moreList = sub === 'others' ? othersList : sub === 'jump' ? jumpList : sub === 'day' ? dayBox : html`<div class="dt-mlist" id="dt-list-more" role="group" aria-label="More tools">
      <ul class="dt-narrow">${item('Back to AXIOM', run(back))}</ul>
      <h3>This report</h3><ul>
        ${item('Sections and sources', run(() => visit('brief')), 'Alt+2')}${item('Find a story the report missed', run(() => visit('today')), 'Alt+1')}
        ${snap ? item('Coverage report', run(() => snap(document.getElementById('dt-btn-more'))), 'charts, no AI') : null}
        ${A.sections && A.sections.length ? item('Jump to a section \u203a', () => setSub('jump')) : null}
        ${A.canRewrite ? item('Rewrite the whole report\u2026', run(() => A.run('rewrite')), 'uses 1 AI draft', { disabled: !(budget && budget.left) }) : null}
        ${A.hasBrief ? item('Earlier versions', run(() => A.run('history'))) : null}${A.hasBrief ? item('Compare with the last sent report', run(() => A.run('compare'))) : null}
        ${item('Open another day\u2026', () => setSub('day'))}
        ${A.canReopen ? item('Change the sent report', run(() => A.run('reopen'))) : null}
        ${item('Other reports \u203a', () => setSub('others'))}</ul>
      ${A.hasBrief ? html`<h3>Other formats</h3><ul>${item('Copy the Slack summary', run(() => A.run('slack')))}${item('Download .md', run(() => A.run('md')), 'text')}${item('Download .html', run(() => A.run('html')), 'web page')}</ul>` : null}
      <h3>Setting up the reports</h3><ul>${item('Watch: keywords and accounts', run(() => visit('watch')), 'Alt+3')}
        <li key="col"><button type="button" class="dt-mi" onClick=${run(() => visit('collection'))}><span>Collection: what was collected, and why not${gap ? html`<span class="dt-dot" aria-hidden="true"></span><span class="den-sr"> (a platform sent nothing today)</span>` : null}</span><small>Alt+4</small></button></li>
        ${item('Options: this report\u2019s settings', run(() => visit('options')), 'Alt+5')}</ul>
      <div class="dt-mfoot dt-mfoot-row">${budget ? html`<span data-left=${budget.left}>AI drafts left today: ${budget.left} of ${budget.cap}</span>` : html`<span></span>`}<button type="button" class="den-link" title="Look for new stories and posts" onClick=${run(refresh)}>Refresh</button></div></div>`;
    const helpList = html`<div class="dt-mlist dt-help" id="dt-list-help" role="group" aria-label="Help"><ul>
      ${item('Show me how', run(() => setStore({ intro: 1, introLine: false })), '3 steps')}${item('What the checks mean', run(() => setStore({ sheet: 'checks' })))}
      ${item('Keyboard shortcuts', run(keys), '?')}${tour ? item('Full guided tour of the tools', run(tour), 'about 15 minutes') : null}
      ${item('Show the tips again', run(() => { lsSet('ax_den_sends', 0); DT.say('The tips will show again on each thing to check.'); }))}</ul></div>`;
    const skip = (label, sel) => html`<button type="button" class="dt-skip" onClick=${() => { const el = document.querySelector(sel); if (el) { if (!(el.tabIndex >= 0)) el.setAttribute('tabindex', '-1'); el.focus(); } }}>${label}</button>`;
    const cur = lineOf(desk);
    return html`<header class="dt-top" ref=${box}>
      ${skip('Skip to the report', '#dt-report')}${skip('Skip to Check before you send', '#dt-col .den-checks-h, #dt-col h2')}
      <button type="button" class="dt-back" onClick=${back}><span aria-hidden="true">\u2039 </span>AXIOM</button>
      <span class="dt-brand">Anne's Den</span>
      <nav class="dt-mine" aria-label="Your reports"><ul>${mine.slice(0, 3).map(d => { const l = lineOf(d);
        return html`<li key=${d.id}><button type="button" class="dt-rep" data-desk=${d.id} aria-current=${d.id === desk.id ? 'page' : null} aria-label=${d.name + lineLabel(l)} onClick=${() => pick(d.id)}><b>${d.name}</b>${l ? html`<span class=${'dt-rl ' + (l[1] || '')}>${l[0]}</span>` : null}</button></li>`; })}</ul></nav>
      <div class="dt-menu dt-mine1"><button type="button" class="dt-tbtn" id="dt-btn-others" aria-expanded=${menu === 'others' ? 'true' : 'false'} aria-controls="dt-list-others" aria-label=${desk.name + lineLabel(cur) + ': every report'} onClick=${() => toggle('others')}>${desk.name} \u25be</button>${menu === 'others' ? othersList : null}</div>
      <span class="dt-spacer"></span>
      ${snap ? html`<button type="button" class="dt-tbtn dt-cov" id="dt-btn-cov" title="Figures and charts for this window: mentions, share of voice, outlets, top stories and posts. No AI, nothing spent." onClick=${e => snap(e.currentTarget)}>Coverage<span class="dt-lg"> report</span></button>` : null}
      <div class="dt-menu"><button type="button" class="dt-tbtn" id="dt-btn-more" aria-expanded=${menu === 'more' ? 'true' : 'false'} aria-controls="dt-list-more" onClick=${() => toggle('more')}>More tools \u25be</button>${menu === 'more' ? moreList : null}</div>
      <div class="dt-menu"><button type="button" class="dt-tbtn" id="dt-btn-help" aria-expanded=${menu === 'help' ? 'true' : 'false'} aria-controls="dt-list-help" aria-label="Help" onClick=${() => toggle('help')}>?<span class="dt-lg"> Help \u25be</span></button>${menu === 'help' ? helpList : null}</div>
      ${S.sheet === 'checks' ? html`<${Sheet} onClose=${b => { setStore({ sheet: '' }); if (b) focusSoon('#dt-btn-help', 0); }} />` : null}
    </header>`;
  }

  /* ---- the report as it will be pasted (s.4.4) ---- */
  // the copy's plain-text fallback, as the workbench's Copy for Google Docs makes it (den-brief.js denDocPlain)
  function docPlain(h) { const s = String(h || ''); const b = (/<body[^>]*>([\s\S]*?)<\/body>/i.exec(s) || [0, s.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<(style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, '')])[1]; return b.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h1|h2|h3|h4|li|div|ul|ol|table|tr)>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'; }
  // s.4.6 step 3: the DRAFT marker never pastes (nodraft=1 asks the worker for none; a worker before p72 ignores it, so it is taken out here too)
  const noDraft = h => String(h || '').replace(/<p class="draft">[\s\S]*?<\/p>/gi, '').replace(/( - DRAFT)(<\/title>)/i, '$2');
  const plainNoDraft = t => String(t || '').split('\n').filter(l => l.trim() !== 'DRAFT').join('\n').replace(/\n{3,}/g, '\n\n');
  // the number a source prints, as the export numbers it: the Source List entry with its id, else with its address
  function numbering(brief) { const byId = {}, byUrl = {}, label = {}; ((brief && brief.sourceList) || []).forEach(g => (g.items || []).forEach(i => { if (!i.n) return; if (i.id && !byId[i.id]) byId[i.id] = i.n; if (i.url && !byUrl[i.url]) byUrl[i.url] = i.n; if (!label[i.n]) label[i.n] = i; }));
    const ev = (brief && brief.evidence) || {}; return { of: id => byId[id] || (ev[id] && byUrl[ev[id].url]) || 0, item: n => label[n] || null }; }
  // where the ratings print, as the export places them (worker denBriefDoc): under the rating's own momentum or sentiment
  // section, else the first momentum section, after the summary, or the header; the first of these with words in it
  function placeRatings(desk, secs, T, ratings) { const under = {}, after = {}, top = []; const done = s => !!s && !!String(T(s.id) || '').trim(); const mom = secs.find(s => s.kind === 'momentum'), sum = secs.find(s => s.kind === 'summary');
    ((desk.ratings && desk.ratings.items) || []).forEach(i => { const x = { id: i.id, label: i.label, trend: !!i.trend, r: (ratings || {})[i.id] || {} }; const own = [secs.find(s => s.id === i.id && (s.kind === 'momentum' || s.kind === 'sentiment')), mom].find(done);
      if (own) (under[own.id] = under[own.id] || []).push(x); else if (done(sum)) (after[sum.id] = after[sum.id] || []).push(x); else top.push(x); });
    return { under, after, top }; }
  const storiesN = b => { const ev = (b && b.evidence) || {}; return Object.keys(ev).filter(k => { const x = ev[k] || {}; return x.k === 'media' || x.k === 'social' || x.k === 'actor'; }).length; };
  const beforeEnd = t => { const S = F() ? F().spans(t) : []; const sp = S[S.length - 1]; if (!sp) return String(t || '').length; const raw0 = sp.raw.replace(/\s*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]\s*$/, ''); const m = /[.!?]["'\u201d\u2019)\]]*$/.exec(raw0); return sp.start + (m ? raw0.length - m[0].length : raw0.length); };
  function Elapsed({ from }) { const [, f] = useState(0); useEffect(() => { const t = setInterval(() => f(x => x + 1), 1000); return () => clearInterval(t); }, []); const s = Math.max(0, Math.round((Date.now() - from) / 1000)); return html`<span class="dt-elapsed" aria-hidden="true">(${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} so far)</span>`; }

  /* The editor on Today (s.4.8): the section's words with their source marks, one section at a time; Escape or a press
     outside saves; Ctrl or Cmd+S saves (BriefPanel's own key). */
  function Editor({ sec, title, text, onChange, onDone, sel, onCaret }) {
    const ref = useRef(null);
    // p72 review P5: where her cursor is, each time it moves, for Use here (with the words it stands in, so a stale one is never used)
    const rec = e => { const ta = e.target; if (onCaret && ta) onCaret(sec, ta.selectionStart, ta.value); };
    useEffect(() => { const ta = ref.current; if (!ta) return; const L = ta.value.length; const s = sel.current; const a = s && s.a != null ? Math.min(s.a, L) : L; const z = s && s.z != null ? Math.min(s.z, L) : a;
      try { ta.focus({ preventScroll: true }); ta.setSelectionRange(a, z); } catch (e) {} if (onCaret) onCaret(sec, a, ta.value); if (s && s.then) setTimeout(s.then, 30); sel.current = null; }, []);   // eslint-disable-line
    return html`<div class="den-sec dt-edit" data-mode="edit"><label class="den-sr" for=${'dt-ta-' + sec}>${'Edit ' + title}</label>
      <textarea id=${'dt-ta-' + sec} class="dt-ta" ref=${ref} value=${text} onInput=${e => { onChange(e.target.value); rec(e); }} onSelect=${rec} onKeyUp=${rec} onClick=${rec} onKeyDown=${e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onDone('esc'); } }} onBlur=${() => onDone('blur')}></textarea>
      <p class="dt-hint">The [M:121] marks are your sources' links: leave them where they are. <b>Esc</b> saves.</p></div>`;
  }

  /* p71's own checks, under a worker that serves no review and flags (s.9 state 35; spec v3 rule 9): the sentences that need a
     source, the figures not found, the cut quotes and the alerts not mentioned, said, with no fix and no Leave-it mark. */
  function oldItems(brief, desk, T, signals) { const out = []; const secs = (desk.sections || []).filter(s => s.kind !== 'sources' && (desk.options.hidden || []).indexOf(s.id) < 0);
    secs.forEach(s => { const x = (brief.sections || {})[s.id] || {}; if (String(x.text || '') !== String(T(s.id) || '')) return; const un = (x.uncited || []).map(u => String(u));
      un.forEach((u, i) => out.push({ key: 'u' + s.id + i, section: s.id, title: 'A sentence that needs a source', where: s.title, quote: u }));
      (x.unverified || []).filter(v => v && un.indexOf(v.sentence) < 0).forEach((v, i) => out.push({ key: 'v' + s.id + i, section: s.id, title: 'A figure not found in its source', where: s.title, quote: v.sentence }));
      (x.trimmed || []).forEach((q, i) => out.push({ key: 't' + s.id + i, section: s.id, title: 'A paywalled quote cut to 30 words', where: s.title, quote: typeof q === 'string' ? q : (q && (q.quote || q.sentence)) || '' })); });
    (signals || []).filter(s => s && s.sig !== 'gap' && !(D && D.covered(s, brief, null))).forEach(s => out.push({ key: s.key, section: '', title: ((F() && F().title({ kind: 'check', sig: s })) || 'An alert the report doesn\'t mention'), where: F() ? F().subject(s) : s.title, quote: '' }));
    return out; }

  /* ---- the layout BriefPanel hands its state to on Today (s.14) ---- */
  function Layout({ s, a, host, tref }) {
    const { L, brief, work, dirty, save, conflict, restored, busy, t0, fail, dropped, refused, paneSaid, hist, cmp, ask, budget, desk, day, past, cards, signals, filing, canWrite, FL, flOn, carets } = s;
    const S = useStore(); const root = useRef(null); const sel = useRef(null); const drawerReq = useRef(null); const latest = useRef({}); const actRef = useRef({}); const saveSoon = useRef(false); const prevCount = useRef(null); const saidOpen = useRef('');
    const [editing, setEditing] = useState(''); const [drawer, setDrawer] = useState(null); const [secMenu, setSecMenu] = useState(''); const [regenSec, setRegenSec] = useState(''); const [regenTxt, setRegenTxt] = useState(''); const [rateOpen, setRateOpen] = useState('');
    const narrow = useNarrow(); const caretAt = useRef({}); const countRef = useRef(0); const flRef = useRef(null); const [lastWeekly, setLastWeekly] = useState(null);
    const [box, setBox] = useState(null); const [unseen, setUnseen] = useState([]); const [sheet, setSheet] = useState(false); const [waitFrom, setWaitFrom] = useState(0); const [droppedAt, setDroppedAt] = useState(0); const [reopened, setReopened] = useState(false); const [, bumpCopy] = useState(0); const [rwNote, setRwNote] = useState(null); const [hand, setHand] = useState(false);
    const others = (desk.sections || []).filter(x => x.kind !== 'sources' && (desk.options.hidden || []).indexOf(x.id) < 0); const srcSec = (desk.sections || []).find(x => x.kind === 'sources');
    const T = id => (work && brief && work.id === brief.id ? (work.sections[id] != null ? work.sections[id] : '') : ((brief && brief.sections && brief.sections[id]) || {}).text || '');
    const filed = !!(brief && brief.status === 'filed'); const canEdit = !!(brief && canWrite && !filed); const n = flOn ? FL.count : 0;
    const old = brief && !flOn ? oldItems(brief, desk, T, signals || null) : null; const count = flOn ? n : old ? old.length : 0;
    const say = DT.say; countRef.current = count; flRef.current = FL;
    latest.current = { brief, work, dirty };
    const wordsKey = () => fnv(JSON.stringify((s.dirtyIds || []).map(k => [k, work && work.sections[k]])) + (work ? JSON.stringify(work.ratings || {}) : ''));
    const cp = brief ? COPIED[brief.id] : null; const changed = !!(cp && (cp.rev !== brief.revision || cp.words !== wordsKey()));

    // the overrides P2 reads through (o.root, o.open, o.edit, o.say): its fixes land in this document and edit here
    tref.current = { root: () => root.current, say, alert: DT.alert, open: () => {},
      // Choose a source opens the drawer, not the editor: where its number will go is the flagged sentence's end (P5)
      edit: (sec, aa, z, then) => { const r = drawerReq.current; if (r && r.sec === sec) { drawerReq.current = null; const t = T(sec); setDrawer(d => (d && d.sec === sec ? Object.assign({}, d, { pos: aa == null ? null : aa, text: t }) : d)); return; }
        sel.current = { a: aa, z, then }; if (editing === sec) { const ta = root.current && root.current.querySelector('#dt-ta-' + sec); if (ta) { try { ta.focus(); ta.setSelectionRange(aa == null ? ta.value.length : aa, z == null ? (aa == null ? ta.value.length : aa) : z); } catch (e) {} sel.current = null; if (then) setTimeout(then, 30); } return; } setEditing(sec); } };

    useEffect(() => { if (saveSoon.current) { saveSoon.current = false; if (a.saveRef.current) a.saveRef.current(); } }, [work]);   // eslint-disable-line
    // the switcher hears this report's state and its one count (s.4.2: the count only for reports read in this session)
    const stateWord = !brief ? (busy === 'draft' ? 'writing' : fail && fail.what === 'draft' ? 'failed' : '') : '';
    useEffect(() => { if (host.report) host.report(desk.id, { count: brief && !filed && !past ? count : null, brief: brief && !past ? { status: brief.status, at: brief.created, filed_at: brief.filed_at, revision: brief.revision } : null, state: stateWord || (empty ? 'empty' : '') }); });   // eslint-disable-line
    // after the last fix the focus goes to Copy for Google Docs (s.10.3)
    useEffect(() => { const pc = prevCount.current; prevCount.current = count; if (brief && !filed && pc > 0 && count === 0) focusDrawn(root.current, ACT('copy'), 180); }, [count]);   // eslint-disable-line
    // a report switched to takes the focus at its heading, and is said once (s.10.3, s.10.4)
    useEffect(() => { if (!brief && !L.err && L.loading) return; if (L.err && !brief) return; const key = desk.id + '|' + day; if (saidOpen.current === key) return; if (brief && flOn && signals == null) return; saidOpen.current = key;
      if (host.takeH1 && host.takeH1()) focusSoon(root.current && root.current.querySelector('h1'), 30); say(h1 + '. ' + (brief ? (filed ? 'Sent at ' + hm(brief.filed_at) : 'Written ' + hm(brief.created) + ', ' + (count ? count + ' to check' : 'nothing to check')) : 'Not written yet') + '.'); });   // eslint-disable-line
    // the introduction opens by itself once, the first time this browser shows the room (s.8.1)
    useEffect(() => { if (store.offered || L.loading) return; store.offered = true; if (lsGet('ax_den_intro', '') !== 'seen') setStore({ intro: 1 }); }, [L.loading]);   // eslint-disable-line
    useEffect(() => { if (!S.intro) return; focusSoon(root.current && root.current.querySelector('.dt-card'), 40); }, [S.intro]);   // eslint-disable-line
    // Being written: "Still being written" at most once a minute (s.9 state 8); the seconds on screen are hidden from screen readers
    useEffect(() => { if (busy !== 'draft' && busy !== 'section') return; const t = setInterval(() => say('Still being written.'), 60000); return () => clearInterval(t); }, [busy]);   // eslint-disable-line
    // being written elsewhere (the morning run, someone else, or a 409 draft_in_progress): /den/desks every 20 s, up to 10 minutes
    const other = !brief && !past && !busy && (waitFrom || (desk.drafting && desk.drafting.since));
    useEffect(() => { if (!other) return; const t0w = Date.now(); const t = setInterval(() => { if (Date.now() - t0w > 600000) { clearInterval(t); return; } if (host.refreshDesks) host.refreshDesks(); L.reload(); }, 20000); return () => clearInterval(t); }, [!!other]);   // eslint-disable-line
    useEffect(() => { if (!droppedAt) return; const t = setTimeout(() => setDroppedAt(0), 180000); return () => clearTimeout(t); }, [droppedAt]);
    useEffect(() => { if (brief) setWaitFrom(0); }, [brief && brief.id]);   // eslint-disable-line
    // the drawer's heading takes the focus, except beside the editor Write a sentence for it opened (p72 review P2: the editor keeps it)
    useEffect(() => { if (!drawer) return; const ref = root.current; if (drawer.focus !== false) focusSoon(ref && ref.querySelector('#dt-drawer-h'), 40);
      const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); closeDrawer(true); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [drawer && drawer.at]);   // eslint-disable-line
    useEffect(() => { if (!sheet) return; const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setSheet(false); focusSoon('.dt-bar .dt-barcount', 0); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [sheet]);
    useEffect(() => { if (!box) return; const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setBox(null); focusDrawn(root.current, ACT('mark'), 0); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }, [box]);
    useEffect(() => { if (!secMenu) return; const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); const m = secMenu; setSecMenu(''); focusSoon('#dt-secbtn-' + m, 0); } }; const out = e => { if (!e.target.closest || !e.target.closest('.dt-secmenu')) setSecMenu(''); };
      document.addEventListener('keydown', key); document.addEventListener('mousedown', out); return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', out); }; }, [secMenu]);
    useEffect(() => { if (box && box.focus) { box.focus = false; focusSoon(root.current && root.current.querySelector('.dt-box [data-act="first"]'), 30); } }, [box]);   // eslint-disable-line
    // the More tools items that are this report's (s.7): they reach the top bar through the host
    const secsWritten = others.filter(x => String(T(x.id)).trim()).map(x => ({ id: x.id, title: x.title }));
    useEffect(() => { if (!host.setActions) return; host.setActions({ hasBrief: !!brief, filed, canRewrite: !!(brief && canWrite && !filed && !past), canReopen: !!(brief && canWrite && filed), sections: secsWritten.concat(srcSec && brief && (brief.sourceList || []).length ? [{ id: srcSec.id, title: srcSec.title }] : []), run: k => actRef.current[k] && actRef.current[k](), jump: id => actRef.current.jump(id) }); }, [!!brief, filed, canWrite, past, secsWritten.map(x => x.id).join('|')]);   // eslint-disable-line
    useEffect(() => () => { if (host.setActions) host.setActions(null); }, []);   // eslint-disable-line

    const h1 = desk.name + ' report \u00b7 ' + dayLong(day);
    const ev = (brief && brief.evidence) || {}; const nb = numbering(brief);
    const openItems = flOn ? FL.items.filter(x => x.open) : []; const numOfKey = k => openItems.findIndex(x => x.key === k) + 1;
    const openFlag = flOn && FL.openKey ? FL.items.find(x => x.key === FL.openKey) : null;
    const empty = !brief && Array.isArray(cards) && !cards.some(c => c.kind === 'media' || c.kind === 'social' || c.kind === 'actors');

    /* ---- actions ---- */
    const call = (path, body) => D.call(path, body);
    const run = async (name, fn) => { if (busy) return; const left0 = budget ? budget.left : null; a.setBusy(name); a.setT0(Date.now()); a.setDropped(false); a.setFail(null); setDroppedAt(0); if (name === 'draft' || name === 'section') say('Being written.');
      try { await fn(); } catch (e) {
        if (e && e.code === 'draft_in_progress') setWaitFrom(Date.now());
        else if (!e || (!e.code && !e.status)) { a.setDropped(true); setDroppedAt(Date.now()); focusSoon('.dt-status [data-act="check-again"]', 80); }
        else if (e.code === 'conflict' && e.body && e.body.brief) a.setConflict({ theirs: e.body.brief });
        else if (e.code === 'brief_changed') { const t = e.body && e.body.brief; if (t) L.set({ ok: true, brief: t }); else L.reload(); a.setFail({ what: 'changed', msg: errSay(e), shown: !!t }); }
        else { a.setFail({ what: name === 'section' ? 'section' : name === 'draft' ? 'draft' : name, msg: errSay(e), left0 }); DT.alert((name === 'draft' ? 'Couldn\'t be written: ' : name === 'section' ? 'The section couldn\'t be rewritten: ' : 'It didn\'t go through: ') + errSay(e) + '.'); if (name === 'draft') focusSoon('.dt-status [data-act="try-again"]', 80); } }
      a.setBusy(''); a.bump('budget'); if (host.refreshDesks) host.refreshDesks(); };
    const writeNow = replace => run('draft', async () => { const d = await call('/den/brief', { desk: desk.id, replace: !!replace }); L.set({ ok: true, brief: d.brief }); a.tell('draft', { id: d.brief.id, replace: !!replace });
      setRwNote(replace && Array.isArray(d.review_dropped) && d.review_dropped.length ? d.review_dropped : null); say('Written at ' + hm(Date.now()) + ' from ' + storiesN(d.brief) + ' stories and posts.'); });
    const writeMine = () => run('hand', async () => { const d = await call('/den/brief/save', { desk: desk.id }); L.set({ ok: true, brief: d.brief }); a.tell('start', { id: d.brief.id }); setHand(true); const first = others[0]; if (first) { sel.current = { a: 0 }; setEditing(first.id); } });
    const regen = (sec, instruction) => run('section', async () => { const d = await call('/den/brief/section', { id: brief.id, section: sec, revision: brief.revision, instruction }); L.set({ ok: true, brief: d.brief }); a.tell('regen', { id: d.brief.id, section: sec }); say('Section rewritten.'); });
    const saveNow = () => (a.saveRef.current ? a.saveRef.current() : Promise.resolve(true));
    const copyDoc = async () => { if (!brief) return; const id = brief.id;
      const get = (async () => { if (latest.current.dirty) { const ok = await saveNow(); if (!ok) throw new Error('the report could not be saved first, so nothing was copied'); } const t = await D.getText('/den/brief?' + D.q({ id, format: 'html', nodraft: 1 })); return noDraft(t); })();
      try {
        if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { const body = get.then(t => new Blob([(/<body[^>]*>([\s\S]*?)<\/body>/i.exec(t) || [0, t])[1]], { type: 'text/html' })); const txt = get.then(t => new Blob([plainNoDraft(docPlain(t))], { type: 'text/plain' }));
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': body, 'text/plain': txt })]); }
        else { const t = await get; await navigator.clipboard.writeText(plainNoDraft(docPlain(t))); }
        // what was copied: the revision, and the words key of a saved report (nothing unsaved: it was saved first), in wordsKey()'s shape
        await new Promise(r => setTimeout(r, 30)); const cur = latest.current; COPIED[id] = { rev: cur.brief ? cur.brief.revision : 0, words: fnv(JSON.stringify([]) + (cur.work ? JSON.stringify(cur.work.ratings || {}) : '')), at: Date.now() };
        bumpCopy(x => x + 1); a.tell('copy', { fmt: 'rich', nodraft: true }); say('Copied.'); if (narrow) setSheet(false); focusDrawn(root.current, ACT('mark'), 60);
      } catch (e) { DT.alert('It wasn\'t copied: ' + errSay(e) + '.'); }
    };
    const copySlack = async () => { try { const t = await D.getText('/den/brief?' + D.q({ id: brief.id, format: 'slack' })); await navigator.clipboard.writeText(t); say('The Slack summary is copied.'); } catch (e) { DT.alert('It wasn\'t copied: ' + errSay(e) + '.'); } };
    // the send box (s.4.6): one primary at a time, so an open item closes (p72 review U6); under 1200 px the sheet folds so the box is seen
    const openBox = nb => { if (flOn && FL.openKey) FL.setOpenKey(''); if (narrow) setSheet(false); setBox({ n: nb, focus: true }); };
    const markSent = async anyway => { if (!brief || busy) return; setBox(null);
      if (latest.current.dirty) { const ok = await saveNow(); if (!ok) { DT.alert('It wasn\'t marked as sent: the report couldn\'t be saved first.'); return; } await new Promise(r => setTimeout(r, 40)); }
      const nOpen = countRef.current;   // the count after its own save, not the one of the press (p72 review P10)
      if (nOpen && !anyway) { openBox(nOpen); return; }
      a.setBusy('file'); const b0 = latest.current.brief || brief; const send = ack => call('/den/brief/file', { id: b0.id, revision: b0.revision, acknowledge: ack });
      try { let d;
        try { d = await send(anyway ? true : false); }
        catch (e) { if (!e || e.code !== 'uncited_signals') throw e; const sig = ((e.body && e.body.signals) || []).filter(x => x && x.sig !== 'gap'); const left = ((e.body && e.body.left) || []).filter(x => x && !/^G:/.test(String(x.key)));
          // D2 (Today only): alerts she left out with a reason, named in the send block, are acknowledged without a second ask
          if (!sig.length) d = await send(left.length ? 'left' : true);
          else { setUnseen(sig.map(x => ({ key: x.key, title: x.title || x.key }))); a.setBusy(''); openBox(countRef.current + sig.length); a.bump('marks'); return; } }
        L.set({ ok: true, brief: d.brief }); a.setSave({ s: 'idle', msg: '' }); if (F() && F().sent) F().sent(); a.tell('filed', { id: d.brief.id, acknowledged: !!anyway }); setUnseen([]); setReopened(false);
        a.setBusy(''); a.bump('filed'); if (host.refreshDesks) host.refreshDesks(); say('Sent at ' + hm(d.brief.filed_at || Date.now()) + '.'); focusDrawn(root.current, ACT('next') + ', .dt-allsent', 120);
      } catch (e) { a.setBusy(''); if (e && e.code === 'conflict' && e.body && e.body.brief) a.setConflict({ theirs: e.body.brief }); DT.alert('It wasn\'t marked as sent: ' + errSay(e) + '.'); } };
    const reopen = async () => { try { const d = await call('/den/brief/file', { id: brief.id, reopen: true }); L.set({ ok: true, brief: d.brief }); a.tell('reopen', { id: d.brief.id }); setReopened(true); if (host.refreshDesks) host.refreshDesks(); say('You can change it again. Mark it as sent when you\'re done.'); } catch (e) { DT.alert('It couldn\'t be opened again: ' + errSay(e) + '.'); } };
    const jump = id => { const el = root.current && root.current.querySelector('[data-section="' + id + '"] h2'); if (el) { try { el.scrollIntoView({ block: 'start' }); } catch (e) {} el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } };
    actRef.current = { rewrite: () => { const edited = Object.keys(brief.sections || {}).some(k => brief.sections[k].edited); const rv = brief.review || {}; const held = !!(PN() && PN().supported(brief) && (Object.keys(rv.picks || {}).length || Object.keys(rv.marks || {}).length)); if (edited || held) a.setAsk({ redraft: true, today: true }); else writeNow(true); },
      history: () => a.loadHist(), compare: () => a.compare(), reopen, slack: copySlack, md: () => a.download('md'), html: () => a.download('html'), jump };
    const openEdit = (sec, at) => { if (!canEdit) return; sel.current = { a: at }; setEditing(sec); setSecMenu(''); };
    // an editor a fix opened and closed with nothing changed: no save follows, so the fix stops waiting for one (p72 review P8)
    const doneEdit = how => { const sec = editing; setEditing(''); if (latest.current.dirty) saveNow(); else if (FL && FL.api && FL.api.endEdit) FL.api.endEdit(sec); if (how === 'esc') focusSoon('#dt-secbtn-' + sec, 30); };
    const onCaret = (sec, pos, text) => { caretAt.current[sec] = { pos, text }; if (carets) carets.current[sec] = pos; };
    const openDrawer = o => setDrawer(Object.assign({ at: Date.now(), opener: document.activeElement }, o));
    const closeDrawer = back => { const d = drawer; setDrawer(null); if (back && d && d.opener && d.opener.isConnected) focusSoon(d.opener, 0); };
    /* Use here (s.4.7; p72 review P5, P9): in the open editor, at her cursor; else at the end of the sentence the drawer was opened
       for (a source number's, or the one Choose a source is for); else where her cursor was when the editor closed, while the words
       are still those; else at the end of the section's last sentence. Never a cursor left from older words. The drawer stays open
       until the save answers: a refusal is said there and in the send block, with a way to take the mark out. */
    const useHere = id => { const d = drawer; if (!d || !canEdit) return; const sec = d.sec; const t = T(sec); let pos = null;
      const ta = editing === sec && root.current ? root.current.querySelector('#dt-ta-' + sec) : null; const c = caretAt.current[sec];
      if (ta) pos = ta.selectionStart; else if (d.pos != null && d.text === t) pos = d.pos; else if (c && c.text === t) pos = c.pos;
      if (pos == null || pos > t.length) pos = beforeEnd(t);
      const pre = t.slice(0, pos); const ins = (pre && !/[\s(]$/.test(pre) ? ' ' : '') + '[' + id + ']'; const next = pre + ins + t.slice(pos); const p2 = pos + ins.length;
      if (ta) { a.change(sec, next); caretAt.current[sec] = { pos: p2, text: next }; closeDrawer(false); setTimeout(() => { const x = root.current && root.current.querySelector('#dt-ta-' + sec); if (x) { try { x.focus(); x.setSelectionRange(p2, p2); } catch (e) {} } }, 30); return; }
      if (!(FL && FL.api)) { a.change(sec, next); saveSoon.current = true; closeDrawer(!d.flag); return; }
      FL.api.saveText(sec, next).then(ok => { if (ok) { closeDrawer(!d.flag); if (!d.flag) say('Source added.'); } }); };
    // a source this report can't use (409 cannot_cite): its marks come out of the words, and the words are saved again (P9)
    const refusedSecs = refused && refused.ids ? others.filter(x => refused.ids.some(id => String(T(x.id)).indexOf('[' + id + ']') >= 0)) : [];
    const dropRefused = () => { const ids = (refused && refused.ids) || []; refusedSecs.forEach(x => { let v = String(T(x.id)); ids.forEach(id => { v = v.split('[' + id + ']').join(''); }); a.change(x.id, v.replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ')); }); saveSoon.current = true;
      // the refused save never changed the report: with the marks out the words may be the saved ones again, and nothing is left to save
      setTimeout(() => { if (!latest.current.dirty) a.setSave({ s: 'saved', msg: '' }); }, 80); };
    const refusing = !!(refused && refusedSecs.length);   // said while its marks are still in the words
    // P2's fixes, with the drawer for the ones that choose a source or write for an alert (s.4.5, s.4.7)
    const h2 = flOn ? Object.assign({}, FL, { fix: (f, k, arg) => {
      if (k === 'source') { drawerReq.current = { sec: f.section }; openDrawer({ sec: f.section, flag: f, mode: 'choose' }); }
      else if (k === 'mention') openDrawer({ sec: f.section, flag: f, mode: 'mention', focus: false });   // the editor it opens keeps the focus (P2)
      else if (k === 'add') openDrawer({ sec: f.section, flag: f, mode: 'add' });
      else if (k === 'view') { const sp = F().locate(T(f.section), f); const id = sp && sp.cites[0]; if (id) { openDrawer({ sec: f.section, mode: 'sources', cite: id }); setTimeout(() => { const r = root.current && root.current.querySelector('.dt-drawer'); if (r && PN()) PN().land(r, id); }, 120); return; } }
      else if (k === 'change') setRateOpen(f.item);
      return FL.fix(f, k, arg); } }) : null;

    /* ---- the report's pieces ---- */
    // the end of a sentence, before its final stop (and any closing quote), where a source number goes (as DenFlags' beforeStop)
    const stopOf = sp => { const raw0 = sp.raw.replace(/\s*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]\s*$/, ''); const m = /[.!?]["'\u201d\u2019)\]]*$/.exec(raw0); return sp.start + (m ? raw0.length - m[0].length : raw0.length); };
    const srcBtn = (id, nn, sec) => { const it = nb.item(nn); const lab = it ? String(it.label || '').split(' - ')[0] : 'a source'; const head = it ? String(it.label || '').split(' - ').slice(1).join(' - ') : '';
      return html`<sup class="dt-src" key=${'s' + nn}><button type="button" aria-label=${'Source ' + nn + ': ' + lab} title=${head || lab} onClick=${e => { e.stopPropagation(); const t = T(sec); const at = e.currentTarget.closest('[data-at]'); const s0 = at ? +at.getAttribute('data-at') : -1; const sp = F() ? F().spans(t).find(x => x.start === s0) : null;
        openDrawer({ sec, mode: 'sources', cite: id, pos: sp ? stopOf(sp) : null, text: t }); setTimeout(() => { const r = root.current && root.current.querySelector('.dt-drawer'); if (r && PN()) PN().land(r, id); }, 120); }}>[${nn}]</button></sup>`; };
    const unk = (id, k) => html`<span key=${k} class="dt-unk" title=${'Not saved: ' + id + ' can\'t be used in this report'}>[a source this report can't use]</span>`;
    // a sentence's words with its source numbers (a run of marks prints each number once, as the copy does; a mark with no number prints nothing)
    const piece = (raw, sec, words, k) => { const parts = String(raw).split(/((?:[ \t]*\[[A-Z]:[A-Za-z0-9_.-]{1,40}\])+)/); const out = [];
      parts.forEach((p, i) => { if (i % 2) { const got = [], bad = []; (p.match(MARK) || []).forEach(m => { const id = m.slice(1, -1); const nn = nb.of(id); if (nn && !got.some(g => g[1] === nn)) got.push([id, nn]); else if (!nn && refused && (refused.ids || []).indexOf(id) >= 0) bad.push(id); });
          if (got.length || bad.length) { if (i > 1 || parts[0]) out.push(' '); got.forEach(g => out.push(srcBtn(g[0], g[1], sec))); bad.forEach((id, j) => out.push(unk(id, k + 'u' + i + j))); } return; }
        if (!p) return; const bits = words && words.length && F() ? F().pick(p, words) : [p]; bits.forEach((b, j) => out.push(typeof b === 'string' ? b : html`<mark key=${k + 'w' + i + j} class="den-fw dt-fw">${b.text}</mark>`)); });
      return out; };
    const body = (sec, text) => { const t = String(text || '').replace(/\r/g, ''); const paras = []; const rx = /\n\n+/g; let p0 = 0, m; while ((m = rx.exec(t))) { paras.push([p0, m.index]); p0 = m.index + m[0].length; } paras.push([p0, t.length]);
      const sp = F() ? F().spans(t) : [{ start: 0, end: t.length, raw: t, plain: t, cites: [] }]; const match = flOn && F() ? F().matcher(openItems.filter(x => x.section === sec)) : null;
      return paras.filter(([x, y]) => t.slice(x, y).trim()).map(([x, y], pi) => html`<p key=${pi}>${sp.filter(q => q.start >= x && q.end <= y).map((q, si) => { const hit = match ? match(q.raw) : null; const k = sec + pi + '-' + si;
        if (!hit) return html`<span key=${k} class="dt-s" data-at=${q.start}>${piece(q.raw, sec, null, k)} </span>`;
        const nn = numOfKey(hit.all[0]); const lit = FL.openKey && hit.all.indexOf(FL.openKey) >= 0;
        return html`<span key=${k}><mark class=${'dt-mark' + (lit ? ' lit' : '')} id=${'dt-mark-' + String(hit.all[0]).replace(/[^A-Za-z0-9_-]/g, '_')} data-flag-keys=${hit.all.join(' ')} data-at=${q.start}><span class="den-sr">To check ${nn}: </span><span class="dt-pill" aria-hidden="true">${nn}</span>${piece(q.raw, sec, hit.words, k)}</mark> </span>`; })}</p>`); };
    const rv = placeRatings(desk, others, T, work && brief && work.id === brief.id ? work.ratings : brief && brief.ratings);
    const rateKeys = id => (flOn ? openItems.filter(f => f.kind === 'rating' && f.item === id).map(f => f.key).join(' ') : '');
    const setRating = (i, k, v) => { a.setWork(w => Object.assign({}, w, { ratings: Object.assign({}, w.ratings, { [i]: Object.assign({}, (w.ratings || {})[i], { [k]: v }) }) })); a.setSave({ s: 'dirty', msg: '' }); saveSoon.current = true; };
    const rateLine = x => { const lv = x.r.level, tr = x.r.trend; const on = rateOpen === x.id && canEdit; const lev = (desk.ratings && desk.ratings.levels) || [], trs = (desk.ratings && desk.ratings.trends) || [];
      return html`<p key=${x.id} class="dt-rate" data-rate=${x.id} data-flag-keys=${rateKeys(x.id) || null}>${x.label}: <b>${lv ? lv + (tr ? ', ' + tr : '') : 'Not rated yet'}</b>${canEdit && !on ? html` <span aria-hidden="true">\u00b7</span> <button type="button" class="den-link dt-change" aria-label=${'Change ' + x.label} onClick=${() => setRateOpen(x.id)}>Change</button>` : null}
        ${on ? html`<span class="dt-rsel"><label>${x.label}<select data-rating=${x.id} value=${lv || ''} onChange=${e => setRating(x.id, 'level', e.target.value)}><option value="">Not rated yet</option>${lev.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>
          ${x.trend ? html`<label>Trend<select aria-label=${x.label + ' trend'} value=${tr || ''} onChange=${e => setRating(x.id, 'trend', e.target.value)}><option value="">-</option>${trs.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>` : null}<button type="button" class="den-mini quiet" onClick=${() => setRateOpen('')}>Done</button></span>` : null}</p>`; };
    const slot = sec => { const f = openFlag; if (!f || f.section !== sec || (f.kind !== 'check' && f.kind !== 'pinned')) return null; const subj = f.kind === 'check' ? (F() ? F().subject(f.sig) : '') : String((f.card && f.card.title) || 'this story');
      return html`<p class="dt-slot" data-check=${f.kind === 'check' ? f.key : null} data-pinkey=${f.kind === 'pinned' ? f.item : null}>A sentence about ${subj} would go here. Nothing is added until you write it.</p>`; };
    const secMenuBox = x => html`<div class="dt-secmenu"><button type="button" class="dt-secbtn" id=${'dt-secbtn-' + x.id} aria-expanded=${secMenu === x.id ? 'true' : 'false'} aria-controls=${'dt-secl-' + x.id} aria-label=${'Section options: ' + x.title} onClick=${() => setSecMenu(secMenu === x.id ? '' : x.id)}><span aria-hidden="true">\u00b7\u00b7\u00b7 Edit</span></button>
      ${secMenu === x.id ? html`<div class="dt-mlist dt-secl" id=${'dt-secl-' + x.id} role="group" aria-label=${'Section options: ' + x.title}><ul>
        <li><button type="button" class="dt-mi" onClick=${() => openEdit(x.id, null)}><span>Edit this section</span></button></li>
        ${!past ? html`<li><button type="button" class="dt-mi" disabled=${!(budget && budget.left) || !!busy} onClick=${() => { setSecMenu(''); setRegenSec(x.id); setRegenTxt(''); }}><span>Rewrite this section\u2026</span><small>uses 1 AI draft</small></button></li>` : null}
        <li><button type="button" class="dt-mi" onClick=${() => { setSecMenu(''); openDrawer({ sec: x.id, mode: 'sources' }); }}><span>Sources for this section</span></button></li>
        <li><button type="button" class="dt-mi" onClick=${() => { setSecMenu(''); a.setOpenSec(x.id); host.visit('brief'); }}><span>Open in Sections and sources</span></button></li></ul></div>` : null}</div>`;
    const ringed = w => (S.intro === 1 && w === 'report') || (S.intro === 2 && w === 'list') || (S.intro === 3 && w === 'send');
    const head = desk.head && !past ? desk.head : null; const docTitle = head ? head.title : desk.name; const docClient = head ? head.client : (desk.client || '');
    const docLine = head ? head.line : brief ? 'Date: ' + dateWords(brief.day || day) + ' | Reporting window: ' + String((brief.window && brief.window.label) || dateWords(day)).replace(/([0-9a-z])-([0-9])/gi, '$1\u2013$2') : 'Date: ' + dateWords(day);
    const docHead = html`<div class="dt-dochead"><p class="dt-doct">${docTitle}</p>${docClient ? html`<p class="dt-docc">${docClient}</p>` : null}<p class="dt-docl">${docLine}</p></div>`;
    const article = brief ? html`<article class=${'dt-doc' + (ringed('report') ? ' dt-ring' : '')} id="dt-report" aria-label="The report, as it will be pasted" ref=${el => { latest.current.art = el; }}>${docHead}
      ${rv.top.length ? html`<div class="dt-ratetop">${rv.top.map(rateLine)}</div>` : null}
      ${others.map(x => { const t = T(x.id); const isE = !String(t).trim();
        return html`<section key=${x.id} class=${'dt-sec' + (isE ? ' dt-sec-empty' : '')} data-section=${x.id} data-empty=${isE ? '1' : null} aria-labelledby=${'dt-h-' + x.id}><div class="dt-sec-h"><h2 id=${'dt-h-' + x.id}>${x.title}</h2>${canEdit ? secMenuBox(x) : null}</div>
          ${regenSec === x.id ? html`<div class="dt-regen" role="group" aria-label=${'Rewrite ' + x.title}><label class="dt-daylab">What to change (optional)<input value=${regenTxt} maxlength="300" onInput=${e => setRegenTxt(e.target.value)} /></label><div class="dt-row"><button type="button" class="den-mini" data-paid="1" disabled=${!!busy} onClick=${() => { setRegenSec(''); regen(x.id, regenTxt.trim()); }}>Rewrite (uses 1 AI draft)</button><button type="button" class="den-mini quiet" onClick=${() => setRegenSec('')}>Keep it</button></div></div>` : null}
          ${(rv.under[x.id] || []).map(rateLine)}
          ${editing === x.id ? html`<${Editor} sec=${x.id} title=${x.title} text=${t} sel=${sel} onChange=${v => a.change(x.id, v)} onDone=${doneEdit} onCaret=${onCaret} />`
            : isE ? html`<div class="den-docbody"><p class="dt-empty">Nothing written yet, so it won't be in the copy.${canEdit ? html` <button type="button" class="den-link" onClick=${() => openEdit(x.id, 0)}>Write it myself</button>` : null}</p></div>`
            : html`<div class="den-docbody" onClick=${e => { if (!canEdit || (e.target.closest && e.target.closest('button, a, select'))) return; const at = e.target.closest && e.target.closest('[data-at]'); openEdit(x.id, at ? +at.getAttribute('data-at') : null); }}>${body(x.id, t)}</div>`}
          ${(rv.after[x.id] || []).map(rateLine)}${slot(x.id)}</section>`; })}
      ${(brief.sourceList || []).length ? html`<section class="dt-sec dt-srcsec" data-section=${srcSec ? srcSec.id : 'sources'} aria-labelledby="dt-h-sources"><div class="dt-sec-h"><h2 id="dt-h-sources">${(srcSec && srcSec.title) || 'Source List'}</h2></div>
        ${brief.sourceList.map(g => html`<div key=${g.group} class="dt-srcg"><h3>${g.group}</h3><ul class="dt-srcl">${(g.items || []).map(i => html`<li key=${i.id} data-n=${i.n || null}>${i.n ? '[' + i.n + '] ' : ''}${i.label}${i.date ? ', ' + i.date : ''}${/^https?:\/\//i.test(String(i.url || '')) ? html` \u00b7 <a class="den-link" href=${i.url} target="_blank" rel="noopener" aria-label=${'View source ' + (i.n || '') + ': ' + String(i.label || '').slice(0, 80)}>View source</a>` : null}</li>`)}</ul></div>`)}</section>` : null}
    </article>` : null;
    const ghost = html`<article class="dt-doc dt-ghost" id="dt-report" aria-label="The report, once it is written">${docHead}<p class="dt-quiet">Your sections, in your order, appear here once it is written:</p><ol class="dt-ghostl">${others.map(x => html`<li key=${x.id}>${x.title}</li>`)}</ol></article>`;

    /* ---- the status line (s.4.3, s.9) ---- */
    const by = brief ? String(brief.by || '') : ''; const nS = storiesN(brief); const morning = by === 'morning draft';
    const writtenWords = brief ? (brief.created ? 'Written ' + (morning ? 'for you ' : '') + 'at ' + hm(brief.created) + (by && !morning ? ' by ' + by : '') + (nS ? ' from ' + nS + ' stories and posts' : '') + '.' : 'Written by the morning draft.') : '';
    const sentWords = filed ? ' Sent at ' + hm(brief.filed_at) + (brief.filed_by ? ' by ' + brief.filed_by : '') + '.' : ' Not sent yet.';
    const left = budget ? budget.left : 1; const cost = 'Takes a minute or two \u00b7 uses 1 of today\'s ' + (budget ? budget.cap : 20) + ' AI drafts';
    const mo = desk.morning || null; const sydNow = (() => { try { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); } catch (e) { return '00:00'; } })();
    const looking = signals == null && !past; const btn = (label, fn, o) => html`<button type="button" class=${'den-mini' + (o && o.primary ? ' primary' : '')} data-act=${(o && o.act) || null} data-paid=${o && o.paid ? '1' : null} disabled=${!!(o && o.disabled)} onClick=${fn}>${label}</button>`;
    let line = '', acts = null, kind = '';
    // state 20 (p72 review U8): the reason, with the answer's reference when it carried one, said in the alert region; Try again takes the focus
    if (L.err && !L.data) { kind = 'loadfail'; line = 'The report couldn\'t be loaded: ' + String(L.err).replace(/\.$/, '') + (L.ref ? ' (reference ' + L.ref + ')' : '') + '.'; acts = btn('Try again', () => L.reload(), { act: 'try-again' }); }
    else if (L.loading && !L.data) { kind = 'loading'; }
    else if (!brief && past) { kind = 'pastnone'; line = 'No report was written for ' + dayLong(day) + '. A report is written for today only.'; acts = btn('Back to today', () => host.setDay(''), { act: 'today' }); }
    else if (!brief && busy === 'draft') { kind = 'writing'; line = null; }
    else if (!brief && dropped) { kind = 'dropped'; line = 'The connection dropped while it was being written. It may still finish.'; acts = html`${btn('Check again', () => { a.setDropped(false); L.reload(); if (host.refreshDesks) host.refreshDesks(); }, { act: 'check-again', primary: true })}<span class="dt-sub">${droppedAt ? 'Write it now comes back in 3 minutes, if it hasn\'t finished.' : ''}</span>`; }
    else if (!brief && other) { kind = 'other'; const dr = desk.drafting; line = 'Being written now' + (dr && dr.since ? ' (started at ' + hm(dr.since) + (dr.by ? ' by ' + dr.by : '') + ')' : '') + '. It appears here when it\'s ready.'; }
    else if (!brief && fail && fail.what === 'draft') { kind = 'failed'; line = null; acts = html`${btn('Try again', () => writeNow(false), { act: 'try-again', primary: true, paid: true, disabled: !left || !canWrite })}${btn('Write it myself', writeMine, { act: 'mine', disabled: !canWrite })}`; }
    else if (!brief && mo && mo.due === false && desk.cadence === 'weekly') { kind = 'weekly'; const lw = lastWeekly && lastWeekly.desk === desk.id ? lastWeekly : null;   // state 34 (p72 review U13): the last one sent, and Open it
      line = 'This is a weekly report, and today isn\'t its day.' + (lw && lw.day ? ' The last one was sent on ' + dayLong(lw.day) + '.' : lw && !lw.failed ? ' None has been sent yet.' : ' Open another day from More tools to read the last one.');
      acts = lw && lw.day ? btn('Open it', () => host.setDay(lw.day), { act: 'open-last' }) : null; }
    else if (!brief && empty) { kind = 'empty'; line = 'Nothing was collected for this report in the reporting period, so there is nothing to write it from. You can still write it yourself.'; acts = html`${canWrite ? btn('Write it myself', writeMine, { act: 'mine' }) : null}${btn('What was collected, and why not', () => host.visit('collection'), { act: 'collection' })}`; }
    else if (!brief) { kind = 'not';
      line = !left ? 'Not written yet. Today\'s ' + (budget ? budget.cap : 20) + ' AI drafts are used; they come back at midnight (Sydney). You can still write it yourself.'
        : mo && mo.on && mo.due && mo.state === 'due' && sydNow < '07:15' ? 'Not written yet. It is written at 7:00 each morning.'
        : mo && mo.on && mo.due ? 'Not written yet. The morning run hasn\'t written it today.' + (mo.why ? ' ' + mo.why : '')
        : mo ? 'Not written yet. This report isn\'t set to be written each morning yet; the Den\'s owner can switch that on.' : 'Not written yet.';
      acts = canWrite ? html`${left ? btn('Write it now', () => writeNow(false), { act: 'write', primary: true, paid: true, disabled: looking || !!droppedAt || !!busy }) : null}${btn('Write it myself', writeMine, { act: 'mine', primary: !left, disabled: !!busy })}<span class="dt-sub">${looking ? 'Looking at today\'s stories and posts\u2026' : left ? cost : ''}</span>` : html`<span class="dt-sub">Writing it needs an edit key.</span>`; }
    else { kind = filed ? 'sent' : 'written'; line = (past ? 'Not today. ' : '') + (fail && fail.what === 'changed' ? 'Someone changed this report while it was being written, so the new version wasn\'t saved. Theirs is shown. ' : '') + (reopened && !filed ? 'You can change it again. Mark it as sent when you\'re done.' : writtenWords + sentWords) + (canWrite ? '' : ' View only: you can read and copy this report.');
      if (past) acts = btn('Back to today', () => host.setDay(''), { act: 'today' }); }
    const gaps = !past && host.gaps && host.gaps.length ? Array.from(new Set(host.gaps.map(g => CH[g.channel] || g.channel).filter(Boolean))) : [];
    const progress = busy === 'draft' || busy === 'section' ? html`<p class="dt-prog"><span class="dt-spin" aria-hidden="true"></span><b>Being written</b>, started at ${hm(t0)} <${Elapsed} from=${t0} />. It appears here when it's ready; you can leave this page open.</p>` : null;
    // state 11 (p72 review U13): whether an AI draft was spent is read from the budget after the failure, never assumed
    const spent = !!(fail && fail.left0 != null && budget && budget.left < fail.left0);
    const failLine = fail && (fail.what === 'draft' || fail.what === 'section') ? html`<p class="dt-failln"><b>Couldn't be written:</b> ${fail.msg}. ${spent ? '1 AI draft was used, and nothing that was already here changed.' : 'Nothing was used, and nothing that was already here changed.'}</p>` : null;
    const weeklyOff = !brief && !past && !!mo && mo.due === false && desk.cadence === 'weekly' && !(L.err && !L.data);
    useEffect(() => { if (!weeklyOff) return; let on = true; D.call('/den/briefs?' + D.q({ desk: desk.id })).then(d => { const f = ((d && d.briefs) || []).filter(x => x && x.status === 'filed' && x.day && x.day < day).sort((x, y) => (x.day < y.day ? 1 : -1))[0]; if (on) setLastWeekly({ desk: desk.id, day: f ? f.day : '' }); }, () => { if (on) setLastWeekly({ desk: desk.id, failed: true }); }); return () => { on = false; }; }, [weeklyOff, desk.id, day]);   // eslint-disable-line
    useEffect(() => { if (kind !== 'loadfail') return; DT.alert(line); focusSoon(root.current && root.current.querySelector('.dt-status [data-act="try-again"]'), 60); }, [kind === 'loadfail', L.err, L.ref]);   // eslint-disable-line
    const conflictName = conflict ? (conflict.theirs.sections && Object.keys(conflict.theirs.sections).map(k => conflict.theirs.sections[k].by).filter(x => x && x !== 'model' && x !== 'morning draft').pop()) || 'Someone' : '';

    /* ---- the introduction (s.8.2): inline, never on top; show, never do ---- */
    // Done chooses Today as the room she opens in (p72 review P3), through the host's choose, as Today's report from anywhere does
    const closeIntro = done => { lsSet('ax_den_intro', 'seen'); if (done && host.choose) host.choose('report'); setStore({ intro: 0, introLine: !!done }); focusSoon(root.current && root.current.querySelector('h1'), 30); };
    const nextCard = () => { const nx = store.intro === 1 ? (count ? 2 : 3) : 3; setStore({ intro: nx }); };
    const card1 = () => { const w = kind === 'written' ? 'It was written at ' + hm(brief.created) + (nS ? ' from ' + nS + ' stories and posts' : '') + ', in your sections and your order. Read it as the client will. ' + (canWrite ? 'Click any sentence to change it.' : 'You can read and copy it.')
        : kind === 'sent' ? 'This one is already sent. Your next one is on the bar above.' : kind === 'writing' || kind === 'other' ? 'It\'s being written now. It will appear here when it\'s ready.'
        : kind === 'failed' ? 'It couldn\'t be written today: ' + ((fail && fail.msg) || 'the AI draft failed') + '. Try again, or write it yourself.' : kind === 'empty' ? 'Nothing was collected for it today, so there is nothing to write it from. You can write it yourself.'
        : 'It isn\'t written yet. Write it now takes a minute or two.' + (mo && !mo.on ? ' (This report isn\'t set to be written each morning yet; the Den\'s owner can switch that on.)' : '');
      return w; };
    const card = (i, title, words) => html`<div class="dt-card" role="region" aria-label=${'Introduction, ' + i + ' of 3'} tabindex="-1"><p class="dt-step">${i} of 3</p><h2 class="dt-cardh">${title}</h2><p>${words}</p>
      <div class="dt-row">${i < 3 ? html`<button type="button" class="den-mini primary" onClick=${nextCard}>Next</button>` : html`<button type="button" class="den-mini primary" onClick=${() => closeIntro(true)}>Done</button>`}<button type="button" class="den-mini quiet" onClick=${() => closeIntro(false)}>Close</button><span class="dt-sub">Nothing is changed by this guide.</span></div></div>`;
    // the kinds in words, mid-sentence (p72 review U12): every title lower-cased at its start; the empty sections are one kind
    const kindsSay = () => { const ks = []; const nE = openItems.filter(f => f.kind === 'empty').length; openItems.forEach(f => { const t0 = f.kind === 'empty' ? (nE > 1 ? 'sections with nothing written' : 'a section with nothing written') : F().title(f); const t = t0.charAt(0).toLowerCase() + t0.slice(1); if (ks.indexOf(t) < 0) ks.push(t); }); return andList(ks.slice(0, 3)); };
    const card2 = () => card(2, 'Check these before you send', 'The Den found ' + count + ' thing' + (count === 1 ? '' : 's') + ' to check' + (flOn && openItems.length ? ': ' + kindsSay() : '') + '. Each fix is next to it. You decide: "Leave it" is a fine answer.');
    const card3 = () => card(3, 'Copy it, then mark it sent', (count ? '' : 'Nothing needed checking today. ') + (canWrite ? 'Copy takes your header, every section, the ratings and the numbered Source List, with links. Paste it into today\'s tab of your Google Doc, then press Mark as sent. Nothing is emailed.' : 'Copy takes the whole report. Marking it sent needs an edit key.'));

    /* ---- the send block (s.4.6) ---- */
    const settle = !!conflict; const leftAlerts = flOn ? FL.items.filter(f => f.kind === 'check' && f.left) : [];
    const saveLine = save.s === 'saving' ? html`<p class="dt-saveln">Saving\u2026</p>` : save.s === 'bad' ? html`<p class="dt-saveln bad">Not saved: ${save.msg} Your words are kept on this computer.</p>` : dirty ? html`<p class="dt-saveln w">Not saved yet (kept on this computer)</p>` : brief && !filed ? html`<p class="dt-saveln ok">All changes saved</p>` : null;
    useEffect(() => { if (save.s === 'bad' && save.msg) DT.alert(refusing && refused.msg ? refused.msg : 'Not saved: ' + save.msg + ' Your words are kept on this computer.'); }, [save.s, save.msg, refusing]);   // a refused source is said as such (P9)
    const nextDesk = host.next ? host.next(desk.id) : null; const copyPrimary = !!brief && count === 0 && (!cp || changed) && !filed; const markPrimary = !!brief && count === 0 && !!cp && !changed && !filed;
    // what the send block says (s.4.6): the left-out line and the copy line as one line (p72 review U11), the box with words that say
    // what Send anyway records (U10: the alerts only), the all-sent line; under 1200 px they are drawn above the bar (U1)
    const loLine = leftAlerts.length ? html`<span class="dt-lo">Left out on purpose: ${plural(leftAlerts.length, 'alert')} (${leftAlerts.map(f => '"' + ((f.left && f.left.note) || 'no reason given') + '"').join(', ')}). It goes with the report as seen and left out.</span>` : null;
    const cpLine = settle ? html`<span class="dt-copied w">Settle the change first.</span>` : cp && changed ? html`<span class="dt-copied w"><b>You changed the report after copying.</b> Copy it again so the Doc has the change.</span>` : cp ? html`<span class="dt-copied">Copied at ${hm(cp.at)}. Paste it into today's tab of the ${desk.name} report.</span>` : null;
    const sendLines = brief && !filed && (loLine || cpLine) ? html`<p class=${'dt-sendln' + (settle || (cp && changed) ? ' w' : '')}>${loLine}${cpLine}</p>` : null;
    const refusedLine = refusing && brief && !filed ? html`<p class="dt-saveln bad" data-refused="1">Not saved: ${refused.ids.length === 1 ? 'a source' : refused.ids.length + ' sources'}${refusedSecs.length ? ' in ' + andList(refusedSecs.map(x => x.title)) : ''} can't be used in this report. Your words are kept on this computer.${canEdit ? html` <button type="button" class="den-link" data-act="unmark" onClick=${dropRefused}>${refused.ids.length === 1 ? 'Take the mark out' : 'Take the marks out'}</button>` : null}</p>` : null;
    const boxAlerts = box ? (flOn ? openItems.filter(f => f.kind === 'check').length : (old || []).filter(f => !f.section).length) + unseen.length : 0; const boxOther = box ? Math.max(0, box.n - boxAlerts) : 0;
    const boxWhy = !boxOther ? 'Sending anyway notes that you saw them and left them out.' : boxAlerts ? 'Sending anyway notes the ' + plural(boxAlerts, 'alert') + ' you saw and left out. The other ' + boxOther + (boxOther === 1 ? ' is' : ' are') + ' not recorded.' : 'Sending anyway doesn\'t record them.';
    const goFirst = async () => { const want = unseen.map(u => u.key); setBox(null); setUnseen([]); if (narrow) setSheet(true);
      if (flOn) { if (want.length) await waitFor(() => want.every(k => ((flRef.current && flRef.current.items) || []).some(x => x.key === k)), 4000);   // an alert first met in the 409 joins the list with the next read (P11)
        setTimeout(() => { if (flRef.current) flRef.current.first('fix'); }, narrow ? 60 : 0); } else if (old && old[0]) jump(old[0].section || others[0].id); };
    const boxEl = box ? html`<div class="dt-box"><p id="dt-box-t"><b>${plural(box.n, 'thing')} ${box.n === 1 ? 'is' : 'are'} still to check.</b> ${boxWhy}${unseen.length ? ' New since the list was read: ' + unseen.map(u => u.title).join('; ') + '.' : ''}</p>
          <div class="dt-row"><button type="button" class="den-mini primary" data-act="first" aria-describedby="dt-box-t" onClick=${goFirst}>Go to the first</button><button type="button" class="den-mini" data-act="anyway" onClick=${() => markSent(true)}>Send anyway</button></div></div>` : null;
    const allSent = html`<p class="dt-allsent" tabindex="-1">All your reports are sent for today.</p>`;
    const copyBtn = (cls, primary) => html`<button type="button" class=${'den-mini ' + (cls || '') + (primary ? ' primary' : '')} data-act="copy" disabled=${!brief || settle} onClick=${copyDoc}>${changed && !filed ? 'Copy again' : 'Copy for Google Docs'}</button>`;
    const markBtn = (cls, primary) => html`<button type="button" class=${'den-mini ' + (cls || '') + (primary ? ' primary' : '')} data-act="mark" disabled=${!brief || settle || busy === 'file' || (!!busy && busy !== 'file')} onClick=${() => markSent(false)}>${busy === 'file' ? 'Marking as sent\u2026' : changed ? 'Mark as sent anyway' : 'Mark as sent'}</button>`;
    const sendBlock = !brief ? html`<div class="dt-send" role="group" aria-label="Send"><p class="dt-quiet">The checks run once the report is written.</p><button type="button" class="den-mini dt-block" data-act="copy" disabled>Copy for Google Docs</button>${canWrite ? html`<button type="button" class="den-mini dt-block" data-act="mark" disabled>Mark as sent</button>` : null}</div>`
      : filed ? html`<div class="dt-send" role="group" aria-label="Send"><p class="dt-sentok"><b>\u2713 Sent at ${hm(brief.filed_at)}${brief.filed_by ? ' by ' + brief.filed_by : ''}</b></p>${canWrite ? html`<p class="dt-quiet">To change it: More tools \u203a Change the sent report.</p>` : null}
        ${past ? null : nextDesk ? html`<button type="button" class="den-mini primary dt-block" data-act="next" onClick=${() => host.pick(nextDesk.id)}>Next: ${nextDesk.name}</button>` : narrow ? null : allSent}${copyBtn('dt-block', false)}</div>`
      : html`<div class="dt-send" role="group" aria-label="Send">${narrow ? null : refusedLine || saveLine}${narrow ? null : sendLines}
        ${copyBtn('dt-block' + (ringed('send') ? ' dt-ring' : ''), copyPrimary)}${canWrite ? markBtn('dt-block' + (ringed('send') ? ' dt-ring' : ''), markPrimary) : html`<p class="dt-quiet">Marking it sent needs an edit key.</p>`}
        ${narrow ? null : boxEl}
        ${canWrite && !box && F() && F().sends() === 0 ? html`<p class="dt-small">Records that this report went to the client. Nothing is emailed.</p>` : null}</div>`;
    // under 1200 px: what the send block says, drawn in the bar above its buttons (p72 review U1); the save line only when it isn't "All changes saved"
    const barNote = !narrow || !brief ? null : filed ? (!past && !nextDesk ? allSent : null) : (refusedLine || (save.s === 'saving' || save.s === 'bad' || dirty ? saveLine : null) || sendLines || boxEl) ? html`${refusedLine || (save.s === 'saving' || save.s === 'bad' || dirty ? saveLine : null)}${sendLines}${boxEl}` : null;

    /* ---- the column: Check before you send (P2's component), or p71's own list ---- */
    const oldList = old ? html`<section class="den-checks den-checks--today" aria-labelledby="den-checks-h-today"><div class="den-checks-head"><h2 class="den-checks-h" id="den-checks-h-today">Check before you send</h2><span class=${'den-chip ' + (filed ? 'pos' : old.length ? 'warn' : 'pos')} data-count=${filed ? 0 : old.length}>${filed ? 'Sent' : old.length ? old.length + ' to check' : 'Nothing to check'}</span></div>
      ${old.length && !filed ? html`<div class="den-checks-list" role="region" tabindex="0" aria-label=${'Things to check, ' + old.length}><ol>${old.map((f, i) => html`<li key=${f.key} class="den-fl" data-fl-item=${f.key}><button type="button" class="den-fl-t" aria-label=${(i + 1) + ' of ' + old.length + ': ' + f.title + ', ' + f.where} onClick=${() => jump(f.section || others[0].id)}><span class="den-fl-n" aria-hidden="true">${i + 1}</span><span class="den-fl-tt"><b>${f.title}</b><span class="den-fl-w">${f.where}</span>${f.quote ? html`<q class="den-fl-q">${f.quote}</q>` : null}</span></button></li>`)}</ol></div>` : filed ? null : html`<p class="den-checks-clear">\u2713 Nothing left to check</p>`}
      <p class="dt-quiet">Some checks need the Den's next update.</p></section>` : null;
    const colBody = brief ? (flOn ? html`<${F().Panel} h=${h2} layout="today" />` : oldList) : html`<section class="den-checks den-checks--today" aria-labelledby="den-checks-h-today"><div class="den-checks-head"><h2 class="den-checks-h" id="den-checks-h-today">Check before you send</h2></div></section>`;

    // the Sources drawer (s.4.7): P1's pane in its drawer room, a non-modal side sheet over the column
    const dsec = drawer ? others.find(x => x.id === drawer.sec) || others[0] : null;
    const isCov = sg => { try { const tx = others.map(x => T(x.id)).join('\n\n'); const cites = Array.from(new Set((tx.match(MARK) || []).map(m => m.slice(1, -1)))); return !!F().covered(sg, cites, brief.covers || {}, tx); } catch (e) { return false; } };
    const ixOf = sec => { const ids = []; (String(T(sec)).match(MARK) || []).forEach(m => { const id = m.slice(1, -1); if (ids.indexOf(id) < 0) ids.push(id); }); const nums = {}; ids.forEach(id => { const nn = nb.of(id); if (nn) nums[id] = nn; }); return { ids, nums }; };
    const drawerEl = drawer && dsec && brief && PN() && PN().supported(brief) ? html`<div class="dt-drawer" role="dialog" aria-modal="false" aria-labelledby="dt-drawer-h">
      <div class="dt-drawer-h"><div><h2 id="dt-drawer-h" tabindex="-1">${drawer.mode === 'choose' ? 'Choose a source for this sentence' : 'Sources for ' + dsec.title}</h2>${drawer.mode === 'choose' && drawer.flag && drawer.flag.sentence ? html`<q>${drawer.flag.sentence}</q>` : drawer.mode === 'mention' && drawer.flag ? html`<p class="dt-quiet">For: ${F().title(drawer.flag)}. Write your sentence in the report; Use here puts a number where your cursor is.</p>` : null}
        ${canEdit && drawer.mode !== 'mention' ? html`<p class="dt-quiet dt-usewhere">${editing === dsec.id ? 'Use here puts its number where your cursor is.' : drawer.pos != null ? 'Use here puts its number at the end of the sentence and saves.' : 'Use here puts its number at the end of the section\'s last sentence and saves.'}</p>` : null}</div>
        <button type="button" class="den-mini quiet" onClick=${() => closeDrawer(true)}>Close</button></div>
      <div class="den-briefwrap dt-drawerpane"><div class="den-evpane"><${PN().Pane} brief=${brief} sec=${dsec} others=${others} T=${T} cards=${cards} filing=${filing || {}} sigs=${signals ? signals.filter(x => x && x.sig !== 'gap') : null} isCov=${isCov} ro=${!canEdit} room="drawer" day=${day} ix=${ixOf(dsec.id)} setTab=${t => host.visit(t)}
        onCite=${useHere} review=${a.review} saveWith=${a.saveWith} unfile=${a.unfileCard} refusal=${refusing ? refused.msg : paneSaid} say=${DT.say} alert=${DT.alert} /></div></div>
      <p class="dt-drawer-f"><button type="button" class="den-link" onClick=${() => { const sid = dsec.id; closeDrawer(false); a.setOpenSec(sid); host.visit('brief'); }}>Manage this section's sources</button> (in Sections and sources)</p></div>` : null;
    const histEl = hist || cmp ? html`<div class="dt-drawer dt-hist" role="dialog" aria-modal="false" aria-labelledby="dt-hist-h"><div class="dt-drawer-h"><h2 id="dt-hist-h" tabindex="-1">${hist ? 'Earlier versions' : 'Compare with the last sent report'}</h2><button type="button" class="den-mini quiet" onClick=${() => { a.setHist(null); a.setCmp(null); focusSoon('#dt-btn-more', 0); }}>Close</button></div>
      <div class="dt-sheet-b">${hist ? (hist.length ? html`<p class="dt-quiet">The last 60 saves.</p><table class="den-table"><thead><tr><th>Version</th><th>What</th><th>By</th><th>When</th></tr></thead><tbody>${hist.map((x, i) => html`<tr key=${i}><td>${x.revision}</td><td>${String(x.note || '').replace(/; not read in this window: .*$/, '')}</td><td>${x.by}</td><td>${D.aest(x.at)}</td></tr>`)}</tbody></table>` : html`<p>No save is recorded yet.</p>`)
        : cmp.none ? html`<p>No report was sent before this one, so there is nothing to compare with.</p>` : html`<p class="dt-quiet">The report sent for ${dayLong(cmp.day)}${cmp.filed_by ? ', by ' + cmp.filed_by : ''}:</p>${others.map(x => html`<div key=${x.id} class="dt-cmp"><h3>${x.title}</h3><p>${String(((cmp.sections || {})[x.id] || {}).text || '').replace(/\s*\[[A-Z]:[^\]]+\]/g, '') || 'Nothing written.'}</p></div>`)}`}</div></div>` : null;
    useEffect(() => { if (hist || cmp) focusSoon(root.current && root.current.querySelector('#dt-hist-h'), 40); }, [!!(hist || cmp)]);   // eslint-disable-line
    const rwDialog = ask && ask.redraft && D.Dialog ? html`<${D.Dialog} title="Rewrite the whole report?" onClose=${() => a.setAsk(null)}>${Object.keys(brief.sections || {}).some(k => brief.sections[k].edited) ? html`<p>Some sections were changed by a person. Rewriting replaces the whole report, their words included. To keep them, rewrite single sections instead.</p>` : null}
      ${(() => { const rvw = (brief && brief.review) || {}; const pv = PN() && PN().supported(brief) ? PN().dropPreview(rvw, id => (others.find(x => x.id === id) || {}).title || id, id => { const e = ev[id]; return e ? String(e.label || id) : id; }, k => { const f = (brief.flags || []).find(x => x.key === k); return f && f.sentence ? '\u201c' + String(f.sentence).slice(0, 80) + '\u201d' : ''; }) : null;
        return pv && (pv.drop.length || pv.maybe.length) ? html`<div class="den-droppv"><p>You have corrections beside the text. Rewriting keeps what it can.</p>${pv.drop.length ? html`<p><b>These will be dropped:</b></p><ul>${pv.drop.map((x, i) => html`<li key=${i}>${x.what} (${x.why})</li>`)}</ul>` : null}${pv.maybe.length ? html`<p><b>These stay only if the new report still has the story, post or source:</b></p><ul>${pv.maybe.map((x, i) => html`<li key=${'m' + i}>${x.what}</li>`)}</ul>` : null}</div>` : null; })()}
      <p class="dt-quiet">${cost}</p><div class="den-form"><button type="button" class="den-mini danger" data-paid="1" onClick=${() => { a.setAsk(null); writeNow(true); }}>Rewrite it all (uses 1 AI draft)</button><button type="button" class="den-mini" onClick=${() => a.setAsk(null)}>Keep this one</button></div><//>` : null;

    const statusEl = html`<div class="dt-status">
      <h1 tabindex="-1">${h1}</h1>
      ${kind === 'loading' ? html`<p class="dt-skel" aria-hidden="true"><span></span></p>` : kind === 'writing' ? null : kind === 'failed' ? failLine : line ? html`<p class="dt-line" data-state=${kind}>${line}</p>` : null}
      ${progress}${kind !== 'failed' && brief ? failLine : null}
      ${acts ? html`<div class="dt-act">${acts}</div>` : null}
      ${conflict ? html`<div class="dt-note w"><p><b>${conflictName} changed this report after you opened it.</b> Your words are still here.</p><div class="dt-row"><button type="button" class="den-mini primary" data-act="keep-mine" onClick=${a.keepMine}>Keep mine</button><button type="button" class="den-mini" onClick=${a.takeTheirs}>Use theirs</button></div></div>` : null}
      ${restored && !conflict && brief ? html`<div class="dt-note"><p>Your unsaved words from ${D.since(((lsGet(a.wk(brief), {}) || {}).at))} were kept on this computer and are back in the report.</p><div class="dt-row"><button type="button" class="den-mini primary" disabled=${!canEdit} onClick=${() => saveNow()}>Save them</button><button type="button" class="den-mini" onClick=${() => { try { localStorage.removeItem(a.wk(brief)); } catch (e) {} a.setWork({ id: brief.id, revision: brief.revision, sections: a.texts(brief), ratings: brief.ratings }); a.setRestored(false); a.setSave({ s: 'idle', msg: '' }); }}>Discard them</button></div></div>` : null}
      ${rwNote ? html`<div class="dt-note"><p>The rewrite dropped ${rwNote.length === 1 ? 'one of your corrections' : rwNote.length + ' of your corrections'}.</p><button type="button" class="den-mini quiet" onClick=${() => setRwNote(null)}>Close this note</button></div>` : null}
      ${hand && brief && !String(others.map(x => T(x.id)).join('')).trim() ? html`<p class="dt-quiet">Started by you. Write each section in your words; Esc saves.</p>` : null}
      ${gaps.length ? html`<p class="dt-gaps">Not read today: ${andList(gaps)}.</p>` : null}
      ${S.introLine ? html`<p class="dt-oneline">That's the whole daily report. Everything else is under More tools; you don't need it for this.</p>` : null}
    </div>`;
    const loadingDoc = html`<div class="dt-doc dt-skeleton" aria-hidden="true"><span></span><span class="s2"></span><span class="s3"></span><span></span><span class="s2"></span></div>`;
    const barCount = html`<button type="button" class=${'den-mini dt-barcount' + (narrow && ringed('list') ? ' dt-ring' : '')} aria-expanded=${sheet ? 'true' : 'false'} aria-controls="dt-col" data-count=${brief && !filed ? count : 0} onClick=${() => setSheet(!sheet)}>${!brief ? 'Check before you send' : filed ? 'Sent' : count ? count + ' to check' : 'Nothing to check'} <span aria-hidden="true">${sheet ? '\u25be' : '\u25b4'}</span></button>`;
    // the bar (s.11): its Go to the first is plain while an item is open and gone while the box asks (one primary, p72 review U6);
    // card 3 rings its Copy and Mark as sent (U3); what the send block says sits above its buttons (U1)
    const sendRing = narrow && ringed('send') ? 'dt-ring' : '';
    const bar = html`<div class=${'dt-bar' + (barNote ? ' dt-bar-noted' : '')} role="group" aria-label="Check and send">${barNote ? html`<div class="dt-barnote">${barNote}</div>` : null}${barCount}${brief && !filed && count && flOn && !box ? html`<button type="button" class=${'den-mini dt-bargo' + (FL.openKey ? '' : ' primary')} onClick=${() => { setSheet(true); setTimeout(() => FL.first(FL.canFix ? 'fix' : 'toggle'), 60); }}>${FL.canFix ? 'Go to the first' : 'Next'}</button>` : null}
      ${filed && nextDesk && !past ? html`<button type="button" class="den-mini primary" data-act="next" onClick=${() => host.pick(nextDesk.id)}>Next: ${nextDesk.name}</button>` : null}${copyBtn(sendRing, copyPrimary)}${canWrite && !filed ? markBtn(sendRing, markPrimary) : null}</div>`;
    // the bar's height, for the sheet above it and the report's last lines (it grows when it carries the send block's words)
    useEffect(() => { const r = root.current; const b = r && r.querySelector('.dt-bar'); if (!b || !window.ResizeObserver) return undefined; const ro = new ResizeObserver(() => { if (root.current) root.current.style.setProperty('--dt-bar-h', b.offsetHeight + 'px'); }); ro.observe(b); return () => ro.disconnect(); }, [narrow]);   // eslint-disable-line
    const showCards = !!S.intro && kind !== 'loading';
    return html`<div class=${'dt-room' + (box ? ' dt-box-on' : '') + (sheet ? ' dt-sheet-on' : '') + (drawer || hist || cmp ? ' dt-drawer-on' : '')} ref=${root} data-state=${kind}>
      <main class="dt-main" id="dt-main" aria-label=${h1}>
        ${statusEl}
        ${showCards && S.intro === 1 ? card(1, 'This is today\'s ' + desk.name + ' report', card1()) : null}${narrow && showCards && S.intro === 2 ? card2() : null}${narrow && showCards && S.intro === 3 ? card3() : null}
        ${kind === 'loading' ? loadingDoc : brief ? article : kind === 'loadfail' ? null : ghost}
      </main>
      <aside class="dt-col" id="dt-col" aria-labelledby="den-checks-h-today">
        ${!narrow && showCards && S.intro === 2 ? card2() : null}${!narrow && showCards && S.intro === 3 ? card3() : null}
        <div class=${'dt-colscroll' + (ringed('list') ? ' dt-ring' : '')}>${colBody}</div>
        ${sendBlock}
      </aside>
      ${bar}${drawerEl}${histEl}${rwDialog}
    </div>`;
  }

  Object.assign(DT, { Live, Top, Layout, store, setStore, COPIED, hm, dayLong });
})();
