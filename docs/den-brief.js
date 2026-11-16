/* AXIOM - Anne's Den: the Brief: the report, its section editor and the evidence pane. Split out of docs/den.js (release r52, 16 November 2026) so
 * that the Den's parts can each have one writer. A factory: docs/den.js calls window.__DEN_PARTS.brief(D) once at load with
 * its shared names (D grows only by a name added in den.js) and takes the components it returns. Loaded before den.js
 * (docs/index.html), so den.js finds it; React and htm come from docs/vendor, the shared pieces through D.
 *
 * Release r52 (the owner's screenshot of 16 November 2026): a section is ONE page. It reads by default, its citations as
 * numbered chips that name their source and its flags at their sentence; a click on a sentence, the Edit button or Tab
 * opens the same page as the plain-text editor with the cursor at that sentence, and leaving it saves once and reads
 * again. An evidence card is headed by where the row came from and says what it says; the row's id stays in the card's
 * accessible name and a small code, never as its head. A collection gap is not the Brief's business: it is never counted
 * here and never asked about when a brief is filed (owner's instruction, item a). Styles: docs/den-brief.css. */
window.__DEN_PARTS = window.__DEN_PARTS || {};
window.__DEN_PARTS.brief = function (D) {
  'use strict';
  const {
    html, call, own, hdrs, toastMsg, fmtN, Console, tailJob, useGoto, canWriteNow, TABS, CH, SIG, ASIDE, fmtAest,
    fmtDay, aest, since, ls, say, web, q, BUSY_WAITS, get, getText, useLoad, Loading, Failed, Empty, Boundary, Panel,
    Dialog, engText, tell, openEvidence, KINDS_ROW, fbTotal, sydDay, sydOffset, dayEnd, dayWords, BUDGET_T, wc, plural,
    toCards, sigsFor, weigh, LOW, deck, byWeight, covered, secOfKind, KIND_SEC, sigSec, secState, secKey, citeOf,
    STRIP_PENDING, CHECKS, Strip, RowActions, layerTitle, Card, Board
  } = D;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  /* The kill switch of the r52 section editor. true: one page per section, read by default, edited in place. false: the
     r51 layout, a Write box above a second "As it reads" copy. The evidence cards are the new ones either way. */
  const DEN_EDITOR_STACK = true;

  /* ---- small pieces ---- */
  /* Line icons, beside words and never instead of them (the Storyboard prototype's glyphs,
     design/prototypes/annes-den-concepts/concept-a.js). aria-hidden: an icon adds nothing to a control's name. */
  const GLYPH = {
    media: 'M5 5h11v14H6a1 1 0 0 1-1-1V5zM16 9h3v8a2 2 0 0 1-2 2M8 9h5M8 12.5h5M8 16h3', social: 'M5 5h14v10H10l-4 4v-4H5z',
    actor: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20c.8-3.6 3.8-6 7.5-6s6.7 2.4 7.5 6', narrative: 'M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0',
    upcoming: 'M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7', tone: 'M5 20V10M12 20V4M19 20v-7', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.3',
    memory: 'M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6', open: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5',
    pen: 'M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14 7l3 3', eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    plus: 'M12 5v14M5 12h14', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', chev: 'M6 9l6 6 6-6', check: 'M5 12.5l4.5 4.5L19 7.5',
    refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.01',
    copy: 'M9 9h10v11H9zM5 15V4h10', file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 14.5l2.2 2.2L15.5 12'
  };
  const Ic = n => html`<svg class="den-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d=${GLYPH[n] || GLYPH.info} /></svg>`;
  // a kind as the evidence says it (e.k) or as the Board says it (c.kind), to one word, its icon, and whether a card of it can be filed under a section
  const KIND = { media: 'media', social: 'social', actor: 'actor', actors: 'actor', narrative: 'narrative', narratives: 'narrative', upcoming: 'upcoming', tone: 'tone', alert: 'alert', memory: 'memory' };
  const FILEABLE = { media: 1, social: 1, actor: 1, narrative: 1, upcoming: 1 };
  const NAMELESS = /^A narrative not yet named$/i;
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).trim() + '\u2026' : s; };
  const MARK = /\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g;
  const FS = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));   // a textarea that grows with its text by itself

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
  /* A citation as a person reads it: the outlet, the channel or the actor, a narrative by its name, a tone figure by its
     issue; never the bare id. */
  function citeLabel(id, e) {
    if (!e) return id; const l = String(e.label || '');
    if (e.k === 'media') return l.split(' - ')[0].slice(0, 32) || id; if (e.k === 'social') { const p = l.split(' ')[0]; return (CH[p] || p) + ' post'; }
    if (e.k === 'actor') return l.replace(/ on ([a-z]+)$/, (m, p) => ' on ' + (CH[p] || p)).slice(0, 36); if (e.k === 'alert') return 'Sentinel alert'; if (e.k === 'tone') return 'Tone: ' + cut(l, 28);
    if (e.k === 'memory') return 'Agency memory'; if (e.k === 'narrative') return !l || NAMELESS.test(l) ? 'Narrative' : 'Narrative: ' + cut(l, 28); if (e.k === 'upcoming') return 'Date: ' + cut(l, 28);
    return l.slice(0, 32) || id;
  }
  /* The ids one text cites that the evidence holds, numbered in the order they first appear (the number a chip and its
     card share), and each named so two never read the same: a second story of one outlet reads "pointpost 2". */
  function citeIndex(text, ev) {
    const ids = Array.from(new Set((String(text || '').match(MARK) || []).map(x => x.slice(1, -1)))).filter(id => ev[id]); const nums = {}; const names = {}; const seen = {};
    ids.forEach((id, i) => { nums[id] = i + 1; const b = citeLabel(id, ev[id]); seen[b] = (seen[b] || 0) + 1; names[id] = seen[b] > 1 ? b + ' ' + seen[b] : b; });
    return { ids, nums, names };
  }
  /* The text as it reads: sentences cut the way the worker's check cuts them, every citation a chip that carries the row's
     outlet, and each flag at the sentence it concerns. `F` is the saved section's flags, or null while the words differ.
     Each sentence carries where it ends in the raw text (data-at), so a click on it puts the cursor there. */
  function sentences(par) { const out = []; const rx = /([.!?\]])(\s+)(?=[A-Z"'\[])/g; let at = 0, m; while ((m = rx.exec(par))) { out.push(par.slice(at, m.index + 1)); at = m.index + m[0].length; } if (at < par.length) out.push(par.slice(at)); return out; }
  function Reads({ text, F, evidence, onJump, onEdit, ix, stack }) {
    const used = { u: new Set(), f: new Set(), t: new Set() }; const plain = s => s.replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:])/g, '$1').replace(/ {2,}/g, ' ').trim();
    const I = ix || { nums: {}, names: {} };
    // a chip is a press to its card in the evidence pane (brought into view and focused), where the source is the next press; a chip the evidence cannot place says so
    const chip = (id, k) => { const e = evidence[id]; const t = id + (e ? ' - ' + (e.label || '') + '. Press to see its card in the evidence pane.' : ': this brief\'s evidence holds no row with this id, so saving removes it'); const body = (e ? I.names[id] || citeLabel(id, e) : 'unknown source') + (e && e.gated ? ' (subscriber)' : ''); const n = e ? I.nums[id] : 0;
      return e && onJump ? html`<button key=${k} type="button" class="den-cite" data-tour="cite-chip" data-cite=${id} data-n=${n || null} title=${t} aria-label=${'Citation ' + (n ? n + ', ' : '') + body + ': show its card in the evidence pane'} onClick=${() => onJump(id)}>${Ic(KIND[e.k] || 'info')}${body}</button>`
        : html`<span key=${k} class=${'den-cite' + (e ? '' : ' bad')} data-cite=${id} data-n=${n || null} title=${t}>${e ? Ic(KIND[e.k] || 'info') : null}${body}</span>`; };
    const parts = (s, k) => s.split(/(\[[A-Z]:[A-Za-z0-9_.-]{1,40}\])/).filter(Boolean).map((p, i) => (/^\[[A-Z]:/.test(p) ? chip(p.slice(1, -1), k + '-' + i) : p));
    const raw = String(text || '').replace(/\r/g, ''); let from = 0;
    const paras = raw.split(/\n\n+/).filter(p => p.trim());
    const body = paras.map((p, pi) => { const ps = raw.indexOf(p, from); if (ps >= 0) from = ps;
      return html`<p key=${pi}>${sentences(p).map((s, si) => { const k = pi + '-' + si; const pl = plain(s); let lab = null; const i = raw.indexOf(s, from); let at = null; if (i >= 0) { at = i + s.replace(/\s+$/, '').length; from = i + s.length; }
        if (F && pl) { const u = (F.uncited || []).findIndex((x, j) => !used.u.has(j) && x === pl.slice(0, 240)); if (u >= 0) { used.u.add(u); lab = html`<span class="w">No evidence behind:</span>`; }
          else { const f = (F.unverified || []).findIndex((x, j) => !used.f.has(j) && x.sentence === pl.slice(0, 200)); if (f >= 0) { used.f.add(f); lab = html`<span class="w">${F.unverified[f].figures.join(', ')} is not in the row it cites:</span>`; }
            else { const t = (F.trimmed || []).findIndex((x, j) => !used.t.has(j) && s.indexOf(String(x).split(/\s+/).slice(0, 6).join(' ')) >= 0); if (t >= 0) { used.t.add(t); lab = html`<span class="w">A subscriber quotation was cut at thirty words:</span>`; } } } }
        return lab ? html`<span key=${k} class="den-flag" data-at=${at}>${lab} <mark>${parts(s, k)}</mark> </span>` : html`<span key=${k} data-at=${at}>${parts(s, k)} </span>`; })}</p>`; });
    // a flag whose sentence could not be found in the text is still said, under it
    const rest = F ? (F.uncited || []).filter((x, i) => !used.u.has(i)).map((u, i) => html`<li key=${'u' + i}><span class="w">No evidence behind:</span> ${u}</li>`)
      .concat((F.unverified || []).filter((x, i) => !used.f.has(i)).map((u, i) => html`<li key=${'f' + i}><span class="w">${u.figures.join(', ')}</span> is not in the row it cites: ${u.sentence}</li>`))
      .concat((F.trimmed || []).filter((x, i) => !used.t.has(i)).map((u, i) => html`<li key=${'t' + i}><span class="w">A subscriber quotation was cut at thirty words:</span> ${u}...</li>`)) : [];
    // a click on a sentence edits it in place; a chip, a link or a drag that selected words to copy does not
    const click = e => { if (!onEdit) return; const tg = e.target; if (tg && tg.closest && tg.closest('.den-cite, a, button')) return; const sel = window.getSelection ? window.getSelection() : null; if (sel && !sel.isCollapsed && String(sel).trim()) return;
      const sp = tg && tg.closest ? tg.closest('[data-at]') : null; onEdit(sp && sp.getAttribute('data-at') ? +sp.getAttribute('data-at') : null); };
    const head = stack ? html`<span class="den-sr">The section as it reads</span>` : html`<div class="den-reads-h"><b>As it reads</b> <span>citations resolved${F ? ', flags at the sentence they concern' : '; flags return when the words are saved'}</span></div>`;
    return html`<div class="den-reads" data-tour="reads" onClick=${stack ? click : null}>${head}
      <div class="den-cites" aria-label="As it reads">${body.length ? body : html`<p class="den-quiet">Nothing written yet.</p>`}</div>${rest.length ? html`<ul class="den-flags">${rest}</ul>` : null}</div>`;
  }
  /* One section: one page that reads by default and is edited in place. The textarea and the reading text share one grid
     cell; only one is drawn at a time. Leaving the editor (Esc, Tab away, a click outside the text and outside the evidence
     pane) is the save. A card pressed while editing keeps the editor open, so citing five cards is one save, not five. */
  function Section({ s, n, of, sec, text, evidence, readOnly, onChange, onBlur, onSave, onRegen, busy, left, hidden, rate, carets, state, onStep, onJump }) {
    const [ask, setAsk] = useState(false); const [note, setNote] = useState(''); const dirty = !!sec && text !== sec.text;
    const [mode, setMode] = useState('read'); const root = useRef(null); const ta = useRef(null); const gone = useRef(true); const blur = useRef(onBlur); blur.current = onBlur;
    const has = !!String(text || '').trim(); const editing = !readOnly && (mode === 'edit' || !has);   // an empty section is its own invitation to write
    const ix = useMemo(() => citeIndex(text, evidence), [text, evidence]);
    const caret = e => { carets.current[s.id] = e.target.selectionStart; };
    // focus that stays with the words: the textarea itself, this page's bar and rewrite form, or a card in the evidence pane
    const keeps = a => !!a && a !== document.body && (a === ta.current || (!!root.current && root.current.contains(a) && !!a.closest('.den-docbar, .den-regen')) || !!a.closest('.den-evpane'));
    const finish = () => { if (gone.current) return; gone.current = true; blur.current(); setMode('read'); };
    const edit = at => { if (readOnly) return; gone.current = false; setMode('edit');
      requestAnimationFrame(() => { const el = ta.current; if (!el) return; if (document.activeElement !== el) el.focus({ preventScroll: true }); const L = el.value.length;
        const p = at != null ? Math.min(at, L) : carets.current[s.id] != null ? Math.min(carets.current[s.id], L) : L; try { el.setSelectionRange(p, p); } catch (e) {} carets.current[s.id] = p; }); };
    // focus that leaves for a card and then for somewhere else still ends the edit
    useEffect(() => { if (!DEN_EDITOR_STACK || mode !== 'edit' || readOnly) return; let tm = 0; const check = () => { tm = 0; if (!keeps(document.activeElement)) finish(); }; const out = () => { if (!tm) tm = setTimeout(check, 0); };
      document.addEventListener('focusout', out, true); return () => { document.removeEventListener('focusout', out, true); if (tm) clearTimeout(tm); }; }, [mode, readOnly]);   // eslint-disable-line
    useEffect(() => { const el = ta.current; if (!el || FS || !DEN_EDITOR_STACK) return; if (editing) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } else el.style.height = ''; }, [editing, text]);
    const regenBtn = !readOnly && onRegen && !ask ? html`<button class="den-mini quiet" data-tour="regen" disabled=${busy} title="Opens the choices. Writing it again is one model call, counted against today's Den budget."
      onClick=${async () => { if (dirty && onSave) { const okd = await onSave(); if (!okd) return; } gone.current = true; setMode('read'); setAsk(true); }}>${Ic('refresh')}Regenerate this section</button>` : null;
    const regenForm = !readOnly && onRegen && ask ? html`<div class="den-form den-regen" data-tour="regen-form"><label class="den-lab den-grow">What to change (optional)<input value=${note} maxlength="400" placeholder="Shorter. Lead with the Senate vote." onInput=${e => setNote(e.target.value)} /></label>
        <button class="den-mini primary" data-tour="regen-go" data-paid="1" disabled=${busy || !left} title=${left ? '' : 'Today\'s Den model calls are used'} onClick=${() => { onRegen(s.id, note, sec && sec.edited); setAsk(false); }}>Write it again (1 model call)</button><button class="den-mini quiet" data-tour="regen-cancel" onClick=${() => setAsk(false)}>Cancel</button>
        ${sec && sec.edited ? html`<span class="den-save dirty">This replaces ${sec.by}'s edit.</span>` : null}</div>` : null;
    const title = html`<h4>${s.title}${sec && sec.edited ? html`<span class="den-chip pos" title="A person has edited this section; a model will not write over it unless asked">edited by ${sec.by}</span>` : sec && sec.by === 'model' ? html`<span class="den-chip acc">drafted</span>` : null}${dirty ? html`<span class="den-chip warn">not saved</span>` : null}</h4>`;
    const onIn = e => { caret(e); onChange(s.id, e.target.value); };
    if (!DEN_EDITOR_STACK) return html`<div class="den-sec" data-tour="section" data-section=${s.id} hidden=${hidden}>
      <div class="den-eyebrow"><span>Section ${n} of ${of}</span><span class=${'den-chip ' + state[1]}>${state[0]}</span><span class="den-spacer"></span>
        <button class="den-mini quiet" disabled=${n <= 1} onClick=${() => onStep(-1)}>Previous</button><button class="den-mini quiet" disabled=${n >= of} onClick=${() => onStep(1)}>Next</button></div>
      ${title}<div class="den-secmeta"><span class="den-mono">${wc(text)} words</span><span class="den-spacer"></span>${regenBtn}</div>${regenForm}${rate || null}
      <div class="den-write-h"><b>Write</b> <span>citations are typed as [M:123]; a card on the right inserts one where the cursor was</span></div>
      <textarea class="den-ta" data-tour="editor" aria-label=${s.title} readOnly=${readOnly} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section, or draft the brief. Keep the [M:123] marks: they are the citations.'} onInput=${onIn} onSelect=${caret} onKeyUp=${caret} onClick=${caret} onBlur=${e => { caret(e); onBlur(); }}></textarea>
      <${Reads} text=${text} F=${sec && !dirty ? sec : null} evidence=${evidence} onJump=${onJump} ix=${ix} />
    </div>`;
    const flagN = state[1] === 'warn' ? +((String(state[0]).match(/\d+/) || [0])[0]) : 0;
    return html`<div class="den-sec" ref=${root} data-tour="section" data-section=${s.id} data-mode=${editing ? 'edit' : 'read'} data-can=${readOnly ? null : '1'} hidden=${hidden}>
      <div class="den-eyebrow"><span>Section ${n} of ${of}</span>${flagN ? html`<span class="den-chip warn" title="Sentences the check flagged: no evidence behind them, a figure not in the row they cite, or a quotation cut. Each is marked at its sentence.">${plural(flagN, 'flag')}</span>` : null}<span class="den-spacer"></span>
        <button class="den-mini quiet den-step" disabled=${n <= 1} onClick=${() => onStep(-1)}>${Ic('left')}Previous</button><button class="den-mini quiet den-step" disabled=${n >= of} onClick=${() => onStep(1)}>Next${Ic('right')}</button></div>
      ${title}
      <div class="den-doc">
        <div class="den-docbar">${readOnly ? null : html`<div class="den-modes" role="group" aria-label="Read or edit this section">
            <button type="button" class="den-mode" data-tour="done" aria-pressed=${editing ? 'false' : 'true'} disabled=${!has} onClick=${() => { if (editing) finish(); }}>${Ic('eye')}Read</button><button type="button" class="den-mode" data-tour="edit" aria-pressed=${editing ? 'true' : 'false'} onClick=${() => edit(null)}>${Ic('pen')}Edit</button></div>`}
          <span class="den-words">${plural(wc(text), 'word')}</span><span class="den-spacer"></span>${regenBtn}</div>
        ${regenForm}
        <div class="den-docbody">
          <${Reads} stack=${true} text=${text} F=${sec && !dirty ? sec : null} evidence=${evidence} onJump=${onJump} onEdit=${readOnly ? null : edit} ix=${ix} />
          <textarea class="den-ta" ref=${ta} data-tour="editor" aria-label=${s.title} readOnly=${readOnly} tabIndex=${readOnly ? -1 : 0} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section. Click a card on the right to cite it.'}
            onFocus=${() => { if (!readOnly) { gone.current = false; setMode('edit'); } }} onInput=${onIn} onSelect=${caret} onKeyUp=${caret} onClick=${caret}
            onKeyDown=${e => { if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); } }} onBlur=${e => { caret(e); if (!keeps(e.relatedTarget)) finish(); }}></textarea>
        </div>
        ${readOnly ? null : html`<div class="den-dochint">${editing ? html`${Ic('info')}<span>Click a card on the right to cite it at the cursor. Esc, or a click outside the text, saves and returns to reading.</span>` : html`${Ic('pen')}<span>Click any sentence to edit it in place.</span>`}</div>`}
      </div>
      ${rate || null}
    </div>`;
  }
  /* Time since a model call began. A count of seconds, never a share of the work: nothing here knows how far it is. */
  function Elapsed({ from }) { const [, f] = useState(0); useEffect(() => { const t = setInterval(() => f(x => x + 1), 1000); return () => clearInterval(t); }, []); const s = Math.max(0, Math.round((Date.now() - from) / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function BriefPanel({ desk, day, past, tick, bump, budget, canWrite, setTab, cards, signals, filing, setFiling, openSec, setOpenSec, onState }) {
    const wk = b => 'ax_den_work_' + b.id;
    // today's brief is the desk's latest; another day's is asked for by its day (GET /den/brief?day=), and is never drafted from here
    const L = useLoad(() => get('/den/brief?' + q({ desk: desk.id, day: past ? day : '' }), 'brief'), [desk.id, tick, day], desk.id + '|' + day);
    const [work, setWork] = useState(null);        // { id, revision, sections: {id: text}, ratings } - this person's unsaved words
    const [save, setSave] = useState({ s: 'idle', msg: '' }); const [busy, setBusy] = useState(''); const [t0, setT0] = useState(0); const [conflict, setConflict] = useState(null); const [ask, setAsk] = useState(null); const [restored, setRestored] = useState(false);
    const [hist, setHist] = useState(null); const [cmp, setCmp] = useState(null); const [dropped, setDropped] = useState(false); const [fail, setFail] = useState(null); const saving = useRef(false); const mine = useRef(0); const workRef = useRef(null);
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
        setConflict(null); setRestored(false); L.set({ ok: true, brief: d.brief }); setSave(more ? { s: 'dirty', msg: '' } : { s: 'saved', msg: 'revision ' + d.brief.revision }); saving.current = false; tell('save', { id: d.brief.id, revision: d.brief.revision }); return true; }
      catch (e) { saving.current = false; if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); setSave({ s: 'bad', msg: 'Someone else saved this brief first.' }); } else setSave({ s: 'bad', msg: say(e) }); return false; } }, [brief, work, dirty, ratingsDirty, dirtyIds.join('|')]);   // eslint-disable-line
    useEffect(() => { const key = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && brief && work) { e.preventDefault(); doSave(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [doSave]);   // eslint-disable-line
    const keepMine = () => { const t = conflict.theirs; const kept = ls.get(wk(t), null); if (kept) ls.set(wk(t), Object.assign({}, kept, { revision: t.revision })); setWork(w => Object.assign({}, w, { revision: t.revision })); L.set({ ok: true, brief: t }); setConflict(null); setSave({ s: 'dirty', msg: 'Your words are kept. Save to put them over theirs.' }); };
    const takeTheirs = () => { const t = conflict.theirs; ls.del(wk(t)); L.set({ ok: true, brief: t }); setWork({ id: t.id, revision: t.revision, sections: texts(t), ratings: t.ratings }); setConflict(null); setRestored(false); setSave({ s: 'idle', msg: '' }); };
    // a failed draft or rewrite stays said on the page (a toast is gone in three seconds); a dropped connection has its own note
    const guard = async (name, fn) => { if (busy) return; setBusy(name); setT0(Date.now()); setDropped(false); setFail(null); try { await fn(); } catch (e) { if (!e.code && !e.status) setDropped(true); else if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); toastMsg('Someone else changed this brief first.', true); } else { toastMsg(say(e), true); if (name === 'draft' || name === 'section') setFail({ what: name, msg: say(e) }); } } setBusy(''); bump('budget'); };
    const draft = replace => guard('draft', async () => { const d = await call('/den/brief', { desk: desk.id, replace: !!replace }); L.set({ ok: true, brief: d.brief }); tell('draft', { id: d.brief.id, replace: !!replace }); toastMsg('Drafted from ' + Object.keys(d.brief.evidence).length + ' rows of evidence' + ((d.dropped || []).length ? '; ' + d.dropped.length + ' citation' + (d.dropped.length === 1 ? ' the evidence never gave was removed' : 's the evidence never gave were removed') : '')); });
    const regen = (section, instruction, force) => guard('section', async () => { const d = await call('/den/brief/section', { id: brief.id, section, revision: brief.revision, instruction, force: !!force }); L.set({ ok: true, brief: d.brief }); tell('regen', { id: d.brief.id, section }); toastMsg('Section written again'); });
    /* Filing asks the worker once. Its list of what the brief does not cover is checks only: a collection gap is the
       Collection tab's (owner's instruction, item a), so a worker that still lists gaps (p66) has them dropped here, and a
       list that held nothing else is acknowledged at once, without a dialog; the worker still records the gap keys. */
    const file = ack => guard('file', async () => { const send = a => call('/den/brief/file', { id: brief.id, revision: brief.revision, acknowledge: !!a }); let d, acked = !!ack;
      try { d = await send(ack); } catch (e) { if (e.code !== 'uncited_signals') throw e; const open = ((e.body && e.body.signals) || []).filter(s => s && s.sig !== 'gap'); if (open.length) { setAsk(Object.assign({}, e.body, { signals: open })); return; } d = await send(true); acked = true; }
      setAsk(null); L.set({ ok: true, brief: d.brief }); setSave({ s: 'idle', msg: '' }); tell('filed', { id: d.brief.id, acknowledged: acked }); toastMsg('Marked as filed'); bump('filed'); });
    const reopen = () => guard('file', async () => { const d = await call('/den/brief/file', { id: brief.id, reopen: true }); L.set({ ok: true, brief: d.brief }); tell('reopen', { id: d.brief.id }); toastMsg('Reopened: the brief can be edited again'); });
    const start = () => guard('hand', async () => { const d = await call('/den/brief/save', { desk: desk.id }); L.set({ ok: true, brief: d.brief }); tell('start', { id: d.brief.id }); });
    const fname = ext => (desk.id + '-' + brief.day + (brief.status === 'filed' ? '' : '-draft') + '.' + ext);
    const download = async fmt => { try { const t = await getText('/den/brief?' + q({ id: brief.id, format: fmt })); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: fmt === 'html' ? 'text/html' : 'text/markdown' })); a.download = fname(fmt); document.body.appendChild(a); a.click(); a.remove(); tell('download', { fmt }); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (e) { toastMsg(say(e), true); } };
    const copy = async fmt => { try { const t = await getText('/den/brief?' + q({ id: brief.id, format: fmt === 'rich' ? 'html' : 'slack' }));
        if (fmt === 'rich' && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { const body = (/<body>([\s\S]*)<\/body>/.exec(t) || [0, t])[1]; const plain = body.replace(/<\/(p|h1|h2|h3|li)>/g, '\n\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]); toastMsg('Copied with its headings and links: paste into the document'); }
        else { await navigator.clipboard.writeText(fmt === 'rich' ? t.replace(/<[^>]+>/g, ' ') : t); toastMsg(fmt === 'rich' ? 'Copied as plain text (this browser cannot copy formatted text)' : 'Slack summary copied'); } tell('copy', { fmt }); } catch (e) { toastMsg('Could not copy: ' + say(e), true); } };
    const loadHist = async () => { if (hist) return setHist(null); try { setHist((await call('/den/brief/history?' + q({ id: brief.id }))).revisions || []); } catch (e) { toastMsg(say(e), true); } };
    const compare = async () => { if (cmp) return setCmp(null); try { const d = await call('/den/brief?' + q({ desk: desk.id, prev: 1, day: brief.day })); setCmp(d.brief ? d.brief : { none: true }); } catch (e) { toastMsg(say(e), true); } };

    const carets = useRef({}); const wrap = useRef(null); const [menu, setMenu] = useState(false); const [pull, setPull] = useState(false);
    const fref = useRef(filing); fref.current = filing;   // the filing as it is when a write has answered, not as the render that started the click saw it
    // the Board's columns and the rail read the brief as it stands in the editor
    useEffect(() => { if (onState) onState({ brief: brief || null, texts: work && brief && work.id === brief.id ? work.sections : null }); }, [brief, work]);   // eslint-disable-line
    useEffect(() => { if (!menu) return; const out = e => { if (!e.target.closest || !e.target.closest('.den-menu')) setMenu(false); }; const key = e => { if (e.key === 'Escape') setMenu(false); };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [menu]);

    if (L.loading && !L.data) return html`<${Loading} what="the brief" />`;
    if (L.err && !L.data) return html`<${Failed} what="The brief" err=${L.err} onRetry=${L.reload} />`;
    const cost = 'One model call (a second only if the first answer cannot be read). ' + (budget ? budget.left + ' of ' + budget.cap + ' left today.' : '');
    const droppedNote = dropped ? html`<div class="den-notice bad" role="alert">The connection dropped while the worker was writing. The worker may still finish and save it: nothing here was lost. <div><button class="den-mini primary" onClick=${() => { setDropped(false); L.reload(); }}>Check for the draft</button></div></div>` : null;
    const failNote = fail ? html`<div class="den-notice bad den-fail" role="alert"><b>${fail.what === 'draft' ? 'No draft was written.' : 'The section was not written again.'}</b> ${fail.msg} Nothing that was already here changed.<div><button class="den-mini quiet" onClick=${() => setFail(null)}>Close this note</button></div></div>` : null;
    const progress = busy === 'draft' || busy === 'section' ? html`<div class="den-progress" data-tour="progress" role="status"><span class="den-spin" aria-hidden="true"></span><span><b>${busy === 'draft' ? 'Writing the brief from the evidence.' : 'Writing the section again.'}</b> One model call, usually a minute or two; <${Elapsed} from=${t0} /> so far. Nothing else is locked: the Board and the other tabs stay usable.</span></div>` : null;
    if (!brief && past) return html`<div class="den-briefwrap den-page">${droppedNote}<${Panel} title=${'The brief for ' + dayWords(day) + ' - ' + desk.name}>
      <${Empty}><b>No brief was written for ${dayWords(day)}.</b> A brief is drafted for today's window only; press Today in the top bar to draft one. Nothing was spent reading this day.<//><//></div>`;
    if (!brief) return html`<div class="den-briefwrap den-page">${droppedNote}${failNote}<${Panel} title=${'Today\'s brief - ' + desk.name}>
      <${Empty} tour="brief-empty"><b>No brief has been started for this window.</b> A draft is written from the rows on the Board, every sentence tied to the row it rests on; pin the rows it must cover first.${cards ? ' The Board holds ' + plural(cards.length, 'card') + ' now, ' + cards.filter(c => c.pinned).length + ' pinned.' : ''}
        ${canWrite ? html`<div class="den-mt"><button class="den-mini primary" data-tour="draft" data-paid="1" disabled=${!!busy || !left} onClick=${() => draft(false)}>${busy === 'draft' ? 'Drafting (a minute or two)...' : 'Draft the brief (1 model call)'}</button> <button class="den-mini" data-tour="by-hand" disabled=${!!busy} onClick=${start}>Write it by hand</button><span class="den-sub">${left ? cost : 'Today\'s Den model calls are used. A brief can still be written by hand.'}</span></div>` : html`<div class="den-mt">Your key is read-only: drafting and writing need a full key.</div>`}<//>
      ${progress}<//></div>`;
    const filed = brief.status === 'filed'; const ro = !canWrite || filed; const ev = brief.evidence || {};
    const src = desk.sections.find(s => s.kind === 'sources' && desk.options.hidden.indexOf(s.id) < 0); const others = desk.sections.filter(s => s.kind !== 'sources' && desk.options.hidden.indexOf(s.id) < 0);
    const flags = others.reduce((n, s) => n + (((brief.sections[s.id] || {}).uncited || []).length), 0);
    const openS = others.find(s => s.id === openSec) || (src && src.id === openSec ? src : null) || others[0] || src; const onSrc = !!(src && openS === src);
    const T = id => (work ? work.sections[id] || '' : ''); const total = others.reduce((n, s) => n + wc(T(s.id)), 0);
    const cardBy = {}; (cards || []).forEach(c => { cardBy[c.key] = c; });
    // the checks the brief is measured against: never a collection gap, whatever the list it was handed holds
    const sigs = signals ? signals.filter(s => s && s.sig !== 'gap') : null;
    const uncAll = sigs ? sigs.filter(s => !covered(s, brief, work ? work.sections : null)) : null; const secOfSig = s => sigSec(s, cards, filing, others);
    const filedHere = id => Object.keys(filing).filter(k => filing[k] === id && (cardBy[k] || ev[k]));
    const citedIn = cid => others.filter(s => T(s.id).indexOf('[' + cid + ']') >= 0).length;
    const step = d => { const all = others.concat(src ? [src] : []); const i = all.indexOf(openS) + d; if (all[i]) setOpenSec(all[i].id); };
    const taOf = sid => wrap.current && Array.from(wrap.current.querySelectorAll('.den-sec textarea')).find(x => x.closest('.den-sec').dataset.section === sid);
    /* A card's citation goes in where the cursor is in the open section (or where it last was), and the words are then this
       person's unsaved edit like any other. The card press never takes the focus from the words (its mousedown is held),
       and the mark goes in as typing does, so the browser's own undo takes it out again. Only an id this brief's evidence
       holds is offered: the worker removes any other. */
    const cite = cid => { if (ro || !cid || onSrc) return; const sid = openS.id; const t = T(sid); const ta = taOf(sid);
      let pos = ta && document.activeElement === ta ? ta.selectionStart : carets.current[sid]; if (pos == null || pos > t.length) pos = t.length;
      const pre = t.slice(0, pos); const ins = (pre && !/[\s(]$/.test(pre) ? ' ' : '') + '[' + cid + ']'; const want = pre + ins + t.slice(pos); const at = pos + ins.length; let done = false;
      if (ta && ta.value === t) { try { if (document.activeElement !== ta) ta.focus({ preventScroll: true }); ta.setSelectionRange(pos, pos); done = document.execCommand('insertText', false, ins) && ta.value === want; } catch (e) { done = false; } }
      carets.current[sid] = at; if (!done) { change(sid, want); setTimeout(() => { const x = taOf(sid); if (x) { x.focus(); try { x.setSelectionRange(at, at); } catch (e) {} } }, 0); }
      tell('cite', { id: cid, section: sid }); };
    // filing from here is the Board's rule: a row the worker pins is pinned with its section (the desk's record), the rest is this computer's note;
    // the note is built from fref, what it is when the worker has answered, so two quick clicks keep both
    const fileHere = async c => { if (!canWrite || filed || onSrc) return; if (c.pin) { try { await call('/den/pin', { desk: desk.id, item: c.id, section: openS.id }); c.pinned = true; } catch (e) { toastMsg(say(e), true); return; } } setFiling(Object.assign({}, fref.current, { [c.key]: openS.id })); tell('file', { key: c.key, sec: openS.id, desk: desk.id, via: 'brief' }); };
    /* A citation chip leads to its card in the evidence pane: every id the open section cites and the evidence holds is
       listed there (filed here, or cited here and filed elsewhere), so there is always a card to land on. */
    const jump = cid => { const el = wrap.current && wrap.current.querySelector('.den-evpane li[data-cite="' + cid + '"]'); if (!el) { toastMsg('That row is not in the evidence pane for this section.'); return; }
      try { el.scrollIntoView({ block: 'center' }); } catch (e) {} const b = el.querySelector('.den-evcard'); (b && !b.disabled ? b : el).focus({ preventScroll: true }); el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 1800); tell('jump', { id: cid }); };
    const unfileKey = async k => { const c = cardBy[k]; const idm = /^[MSP]:(\d+)$/.exec(k); const item = c ? c.id : (idm && ev[k] ? +idm[1] : 0);   // a row of the brief's evidence is the worker's even when the window has not been read here
      if (item && (!c || c.pinned)) { try { await call('/den/pin', { desk: desk.id, item, section: '' }); } catch (e) { toastMsg(say(e), true); return; } } const m = Object.assign({}, fref.current); delete m[k]; setFiling(m); };
    const visFiled = k => !!filing[k] && others.some(s => s.id === filing[k]);   // a section hidden on Options is not a place a card is filed: the Board shows such a card in Unsorted, and so does the pull list
    const secTitle = id => (others.find(s => s.id === id) || {}).title || id;
    /* What a card says, in words: where it came from (the head), what it says (the title) and one line of figures. A row
       the Board holds speaks for itself; a row it has not read speaks through what the brief kept (its label, and with
       worker p67 its words and a line of figures); a post whose words were not kept says so instead of showing a code. */
    const srcOf = (c, e) => { if (c) { const r = c.r || {}; return c.kind === 'media' ? (r.outlet || r.source || 'News') : c.kind === 'social' ? (CH[r.platform] || r.platform || 'Social') + ' post' : c.kind === 'actors' ? (r.who || 'A registered account') + (r.platform ? ' on ' + (CH[r.platform] || r.platform) : '') : c.kind === 'narratives' ? 'Narrative' : 'Date'; }
      if (!e) return 'Collected after the draft'; const l = String(e.label || '');
      return e.k === 'media' ? (l.split(' - ')[0] || 'News') : e.k === 'social' || e.k === 'actor' ? citeLabel('', e) : e.k === 'narrative' ? 'Narrative' : e.k === 'tone' ? 'Tone' : e.k === 'alert' ? 'Sentinel alert' : e.k === 'memory' ? 'Agency memory' : e.k === 'upcoming' ? 'Date' : 'Evidence'; };
    const sayOf = (c, e) => { if (c && c.title) return { t: String(c.title) }; if (!e) return { t: c ? String(c.label || '') : '' }; if (e.text) return { t: String(e.text) }; const l = String(e.label || '');
      if (e.k === 'media') return { t: l.split(' - ').slice(1).join(' - ') || l }; if (e.k === 'narrative') return { t: NAMELESS.test(l) ? 'A narrative the Den has not named yet' : l };
      if (e.k === 'upcoming' || e.k === 'tone' || e.k === 'alert' || e.k === 'memory') return { t: l }; return { t: 'Its words were not kept with this brief. Open the source to read it.', quiet: true }; };
    const metaOf = (c, e) => { if (c) { const r = c.r || {}; const bits = c.kind === 'media' ? [c.outlets > 1 ? c.outlets + ' outlets' : '', c.reach ? fmtN(c.reach) + ' on Facebook' : ''] : c.kind === 'social' || c.kind === 'actors' ? [c.reach ? fmtN(c.reach) + ' interactions' : ''] : c.kind === 'narratives' ? [r.n ? plural(r.n, 'row') : '', r.n24 ? r.n24 + ' in the last day' : '', r.status || ''] : [r.date || ''];
        if (c.ts) bits.push(since(c.ts)); return bits.filter(Boolean).join(' \u00b7 '); } return e ? String(e.sub || (e.gated ? 'Subscriber story: quoted at most thirty words' : '')) : ''; };
    const auto = (c, e) => (c && c.r && c.r.named === 'auto') || (e && e.named === 'auto');
    const openIx = onSrc ? { nums: {} } : citeIndex(T(openS.id), ev);
    const evItem = (key, o) => { o = o || {}; const c = cardBy[key]; const cid = c ? citeOf(c, ev) : (ev[key] ? key : ''); const e = cid ? ev[cid] : null; const kind = KIND[c ? c.kind : e ? e.k : ''] || '';
      const sd = sayOf(c, e); const title = sd.t || key; const url = c ? c.url : e ? e.url : ''; const n = cid ? citedIn(cid) : 0; const num = cid ? openIx.nums[cid] : 0; const meta = metaOf(c, e);
      const st = !FILEABLE[kind] ? 'na' : o.here ? 'here' : visFiled(key) ? 'else' : 'none';
      return html`<li key=${key} class=${'den-evitem' + (num ? ' here' : '')} data-cite=${cid || null} data-ev=${key} data-kind=${kind || null} data-filed=${st} tabIndex="-1"><button type="button" class=${'den-evcard' + (n ? ' cited' : '')} data-tour="ev-card" data-cited=${n} disabled=${ro || !cid}
          aria-label=${(cid ? 'Cite ' + cid + ': ' : 'Cannot be cited in this brief: ') + title.slice(0, 100)} title=${cid ? (ro ? cid + ': ' + title.slice(0, 140) : 'Cite this where the cursor is in ' + openS.title + ' (' + cid + ')') : 'This brief\'s evidence does not hold this row: it was collected after the draft, or the brief was started by hand. Draft again to cite it.'}
          onMouseDown=${x => x.preventDefault()} onClick=${() => cite(cid)}>
          <span class="den-evtop">${num ? html`<span class="den-evnum" title=${'Citation ' + num + ' in this section'}>${num}</span>` : null}<span class="den-evsrc">${Ic(kind || 'info')}<span>${srcOf(c, e)}</span></span>
            ${auto(c, e) ? html`<span class="den-tag" title="A working title the Den gave this narrative from its own rows; nobody has named it yet">working title</span>` : null}${n ? html`<span class="den-chip pos" title=${'Cited in ' + plural(n, 'section') + ' of this brief'}>Cited</span>` : null}${!ro && cid ? html`<span class="den-evhint" aria-hidden="true">${Ic('plus')}Cite here</span>` : null}</span>
          <span class=${'den-t' + (sd.quiet ? ' quiet' : '')}>${title}</span>${meta ? html`<span class="den-sub">${meta}</span>` : null}</button>
        <div class="den-evact">${web(url) ? html`<a class="den-link" href=${web(url)} target="_blank" rel="noopener" aria-label=${'Open the source: ' + title.slice(0, 80)}>${Ic('open')}Open</a>` : null}${o.extra || null}${cid ? html`<span class="den-evcode" title="The id the brief cites this row by">${cid}</span>` : null}</div></li>`; };
    const here = onSrc ? [] : filedHere(openS.id); const hereIds = new Set(here.map(k => { const c = cardBy[k]; return c ? citeOf(c, ev) : k; }));
    const elsewhere = onSrc ? [] : openIx.ids.filter(id => !hereIds.has(id));
    const keyOfCite = id => { const c = (cards || []).find(x => citeOf(x, ev) === id); return c ? c.key : id; };
    const fileBtn = c => html`<button class="den-mini row" data-tour="pull-file" disabled=${filed} aria-label=${'File here: ' + String(c.title || '').slice(0, 80)} title=${filed ? 'The brief is filed: reopen it to file a card under a section' : c.pin ? 'Pins it to the report and files it under this section, for everyone on the desk' : 'Files it under this section on this computer'} onClick=${() => fileHere(c)}>File here</button>`;
    const pullList = cards ? cards.filter(c => !visFiled(c.key)).sort(byWeight) : null; const unHere = uncAll && !onSrc ? uncAll.filter(s => secOfSig(s) === openS.id) : [];
    const matched = s => desk.ratings.items.filter(i => i.id === s.id || i.id === s.kind); const loose = desk.ratings.items.filter(i => !others.some(s => i.id === s.id || i.id === s.kind));
    const rateBar = items => (items.length ? html`<div class="den-bar den-rate">${items.map(i => { const r = (work && work.ratings && work.ratings[i.id]) || {}; const set = (k, v) => { setWork(w => Object.assign({}, w, { ratings: Object.assign({}, w.ratings, { [i.id]: Object.assign({}, r, { [k]: v }) }) })); setSave({ s: 'dirty', msg: '' }); };
      return html`<span key=${i.id} class="den-form"><label class="den-lab">${i.label}<select value=${r.level || ''} disabled=${ro} onChange=${e => set('level', e.target.value)}><option value="">Not rated</option>${desk.ratings.levels.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>
        ${i.trend ? html`<label class="den-lab">Trend<select value=${r.trend || ''} disabled=${ro} aria-label=${i.label + ' trend'} onChange=${e => set('trend', e.target.value)}><option value="">-</option>${desk.ratings.trends.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>` : null}</span>`; })}</div>` : null);
    const nSources = brief.sourceList.reduce((a, g) => a + g.items.length, 0);
    const acked = filed ? (brief.acknowledged || []).filter(k => !/^G:/.test(String(k))) : [];
    const openI = others.indexOf(openS);
    return html`<div class="den-briefwrap" ref=${wrap}>
      ${droppedNote}${failNote}
      ${restored && !conflict ? html`<div class="den-notice" role="status">Your unsaved words from ${since((ls.get(wk(brief), {}) || {}).at)} were kept on this computer and are back in the editor. <div><button class="den-mini primary" disabled=${ro} onClick=${() => doSave()}>Save them</button><button class="den-mini" onClick=${() => { ls.del(wk(brief)); setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); setSave({ s: 'idle', msg: '' }); }}>Discard them</button></div></div>` : null}
      ${conflict ? html`<div class="den-notice bad" role="alert"><b>${conflict.theirs.sections && Object.keys(conflict.theirs.sections).map(k => conflict.theirs.sections[k].by).filter(x => x && x !== 'model').pop() || 'Someone else'} saved this brief after you opened it</b> (it is now revision ${conflict.theirs.revision}). Your words are still here and nothing was overwritten.
        <div><button class="den-mini primary" onClick=${keepMine}>Keep mine</button><button class="den-mini" onClick=${takeTheirs}>Take theirs</button></div><span class="den-sub">Keep mine keeps what you typed in the sections you changed; you then save it over theirs. Take theirs discards what you typed.</span></div>` : null}
      <section class="den-panel den-brief" aria-label=${desk.client + ' - ' + desk.name}>
        <header><h3>${desk.client + ' - ' + desk.name}</h3><span class="den-note">${'Reporting window: ' + (brief.window.label || brief.day)}</span><span class="den-spacer"></span><span class=${'den-chip ' + (filed ? 'pos' : 'warn')} data-tour="status" data-status=${brief.status}>${filed ? 'Filed by ' + brief.filed_by + ', ' + aest(brief.filed_at) : 'Draft'}</span><span class="den-mono">revision ${brief.revision}</span></header>
        ${filed ? html`<div class="den-filedband" role="status">${Ic('check')}<span><b>Filed ${aest(brief.filed_at)} by ${brief.filed_by}.</b> It reads as it was filed; Reopen in the foot makes it editable again.</span><span class="den-spacer"></span>
          <button class="den-mini primary" onClick=${() => copy('rich')}>${Ic('copy')}Copy it for the document</button></div>` : null}
        ${rateBar(loose)}
        <div class="den-panes" data-tour="panes">
          <nav class="den-outline" data-tour="outline" aria-label="Sections of the brief"><div class="den-outline-h"><b>Sections</b><span class="den-mono">${fmtN(total)} words</span></div>
            <ol>${others.map((s, i) => { const st = secState(brief.sections[s.id], T(s.id), filedHere(s.id).length); const un = uncAll ? uncAll.filter(x => secOfSig(x) === s.id).length : 0; const fl = st[1] === 'warn' ? +((String(st[0]).match(/\d+/) || [0])[0]) : 0;
              return html`<li key=${s.id}><button class=${'den-out sp' + (i % 11)} data-tour="outline-item" data-goto=${s.id} aria-current=${openS === s ? 'true' : null} onClick=${() => setOpenSec(s.id)}><span class="den-outn" aria-hidden="true">${i + 1}</span>
                <span class="den-out-t"><b>${s.title}</b><span class="den-out-m"><span class="den-mono">${wc(T(s.id))} words, ${plural(filedHere(s.id).length, 'card')}</span><span class=${'den-chip ' + st[1]}>${fl ? plural(fl, 'flag') : st[0]}</span></span></span>${un ? html`<span class="den-dot" title=${plural(un, 'check') + ' not in the brief yet'}><span class="den-sr">${plural(un, 'check')} not in the brief yet</span></span>` : null}</button></li>`; })}
              ${src ? html`<li><button class="den-out den-out-src" data-tour="outline-item" data-goto=${src.id} aria-current=${onSrc ? 'true' : null} onClick=${() => setOpenSec(src.id)}><span class="den-outn" aria-hidden="true">${Ic('file')}</span><span class="den-out-t"><b>${src.title}</b><span class="den-mono">${plural(nSources, 'source')}, built</span></span></button></li>` : null}</ol></nav>
          <div class="den-write"><div class="den-measure">
            ${progress}
            ${others.map((s, i) => html`<${Section} key=${s.id} s=${s} n=${i + 1} of=${others.length} sec=${brief.sections[s.id]} text=${T(s.id)} evidence=${ev} readOnly=${ro} onChange=${change} onBlur=${() => { if (dirty && !conflict) doSave(); }} onSave=${doSave} onRegen=${canWrite && !filed && !past ? regen : null} busy=${!!busy} left=${left}
              hidden=${openS !== s} rate=${rateBar(matched(s))} carets=${carets} state=${secState(brief.sections[s.id], T(s.id), filedHere(s.id).length)} onStep=${step} onJump=${jump} />`)}
            ${src ? html`<div class="den-sec den-srcsec" data-tour="section" data-section=${src.id} hidden=${!onSrc}><div class="den-eyebrow"><span>Built, not written</span><span class="den-spacer"></span><button class="den-mini quiet den-step" onClick=${() => step(-1)}>${Ic('left')}Previous</button></div>
              <h4>${src.title}<span class="den-chip" title="Built from the rows the brief cites. It is never written by a model and cannot be edited: change what is cited instead.">built from the citations</span></h4>
              <div class="den-doc den-srcdoc">${brief.sourceList.length ? brief.sourceList.map(g => html`<div key=${g.group}><div class="den-mono den-grouph">${g.group}</div><ol class="den-ev">${g.items.map(i => html`<li key=${i.id}>${i.label}${web(i.url) ? html` - <a class="den-link" href=${web(i.url)} target="_blank" rel="noopener">${i.url}</a>` : null}</li>`)}</ol></div>`) : html`<span class="den-mono">Nothing is cited yet, so there is nothing to list.</span>`}</div></div>` : null}
          </div></div>
          <aside class="den-evpane" data-tour="evidence" aria-label="Evidence for this section">
            ${onSrc ? html`<div class="den-evhead"><div class="den-evh1"><b>Source List</b></div><p>Built from every row the brief cites, in the report's own groups. Cite a row in a section and it appears here; nothing is typed into it.</p></div>` : html`<div class="den-evin">
            <div class=${'den-evhead sp' + (openI % 11)}><div class="den-evh1"><b>Evidence</b>${here.length ? html`<span class="den-count" title="Cards filed under this section">${here.length}</span>` : null}</div><span class="den-evfor">${openS.title}</span>
              <p>${ro ? (filed ? 'The brief is filed: reopen it to change it.' : 'View only: this key reads the brief and does not change it.') : 'Click a card to cite it where your cursor is.'}<span class="den-sr"> Stories and posts filed here are kept with the desk, for everyone on it; narratives and dates on this computer only.</span></p></div>
            ${here.length ? html`<div class="den-evsub">Filed under this section</div><ul class="den-evlist">${here.map(k => evItem(k, { here: true, extra: canWrite && !filed ? html`<button class="den-link den-evx" aria-label=${'Take it out of this section: ' + String((cardBy[k] || {}).title || k).slice(0, 80)} onClick=${() => unfileKey(k)}>Unfile</button>` : null }))}</ul>` : null}
            ${elsewhere.length ? html`<div class="den-evsub">Cited here<span class="den-sr">, filed elsewhere</span> <span class="den-count">${elsewhere.length}</span></div><ul class="den-evlist">${elsewhere.map(id => { const k = keyOfCite(id); const c = cardBy[k]; const kind = KIND[c ? c.kind : (ev[id] || {}).k] || '';
                const f = visFiled(k) ? filing[k] : ''; return evItem(k, { extra: !FILEABLE[kind] ? null : f ? html`<span class="den-evstate">Filed under ${secTitle(f)}</span>` : html`<span class="den-evstate">not filed</span>${c && canWrite && !filed ? fileBtn(c) : null}` }); })}</ul>` : null}
            ${!here.length && !elsewhere.length ? html`<p class="den-quiet den-evnone">Nothing is cited or filed here yet. ${ro ? 'Cards filed under this section on the Board appear here.' : 'Open More from this window below and file a card, or click a sentence and start writing.'}</p>` : null}
            ${unHere.length ? html`<div class="den-evsub">Checks this section does not mention yet</div><ul class="den-evlist">${unHere.map(s => html`<li key=${s.key} class="den-uncheck"><span class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]}>${(SIG[s.sig] || [s.sig])[0]}</span><span class="den-t">${s.title}</span><span class="den-sub">${s.detail}</span></li>`)}</ul>` : null}
            <div class="den-pull"><button class="den-fold" data-tour="pull" aria-expanded=${pull ? 'true' : 'false'} onClick=${() => setPull(!pull)}>${Ic(pull ? 'chev' : 'right')}<span>More from this window</span>${pullList ? html` <span class="den-count">${pullList.length}</span>` : null}</button>
              ${!pull ? null : !pullList ? html`<p class="den-quiet">The window's rows are read with the Board. <button class="den-link" onClick=${() => setTab('today')}>Open the Board</button></p>`
                : pullList.length ? html`<ul class="den-pulllist">${pullList.slice(0, 80).map(c => html`<li key=${c.key}><span class="den-w" title="Weight on the Board">${c.w.score}</span><span class="den-pull-t"><span class="den-evsrc">${Ic(KIND[c.kind] || 'info')}<span>${srcOf(c, null)}</span></span><span class="den-t">${c.title}</span>${metaOf(c, null) ? html`<span class="den-sub">${metaOf(c, null)}</span>` : null}</span>
                  ${canWrite ? fileBtn(c) : null}</li>`)}</ul>`
                : html`<p class="den-quiet">Every card of the window is filed under a section.</p>`}</div></div>`}
          </aside>
          ${hist || cmp ? html`<div class="den-drawer-scrim" aria-hidden="true" onClick=${() => { setHist(null); setCmp(null); }}></div><aside class="den-drawer" data-tour="drawer" aria-label="History and comparison">
        ${hist ? html`<${Panel} title="History" note="The last sixty saves" flush=${true} actions=${html`<button class="den-mini quiet" aria-label="Close the history" onClick=${() => setHist(null)}>Close</button>`}>${hist.length ? html`<table class="den-table"><thead><tr><th class="num">Revision</th><th>What</th><th>By</th><th>When</th></tr></thead><tbody>${hist.map((h, i) => html`<tr key=${i}><td class="num">${h.revision}</td><td>${h.note}</td><td>${h.by}</td><td class="den-mono">${aest(h.at)}</td></tr>`)}</tbody></table>` : html`<${Empty}>No save is recorded yet.<//>`}<//>` : null}
        ${cmp ? html`<${Panel} title="Against the last filed brief" note=${cmp.none ? '' : cmp.day + ', filed by ' + cmp.filed_by} actions=${html`<button class="den-mini quiet" aria-label="Close the comparison" onClick=${() => setCmp(null)}>Close</button>`}>${cmp.none ? html`<${Empty}>No brief was filed on this desk before this one, so there is nothing to compare with.<//>`
          : others.map(s => html`<div key=${s.id} class="den-cmp den-diff"><h4>${s.title}</h4><p>${diffWords((cmp.sections[s.id] || {}).text, (brief.sections[s.id] || {}).text).map((p, i) => p.t === 'ins' ? html`<ins key=${i}>${p.s}</ins>` : p.t === 'del' ? html`<del key=${i}>${p.s}</del>` : p.s)}</p></div>`)}<//>` : null}
      </aside>` : null}
        </div>
        <div class="den-foot">
          <div class="den-bar" role="status" aria-live="polite">
            <span data-tour="save-state" data-state=${save.s} data-dirty=${dirty ? '1' : '0'} class=${'den-save ' + (save.s === 'bad' ? 'bad' : dirty ? 'dirty' : save.s === 'saved' ? 'ok' : '')}>${save.s === 'saving' ? 'Saving...' : save.s === 'bad' ? 'Not saved: ' + save.msg + ' Your words are kept on this computer.' : dirty ? 'Unsaved changes (kept on this computer)' + (save.msg ? '. ' + save.msg : '') : save.s === 'saved' ? 'Saved, ' + save.msg : filed ? 'Filed: reopen it to change it' : 'Saved'}</span>
            <span class="den-mono">${fmtN(total)} words</span>
            ${flags ? html`<span class="den-chip warn" title="Sentences that rest on no evidence row. Each is marked where it stands, in the section's text.">${flags} without evidence</span>` : null}
            ${filed && acked.length ? html`<span class="den-chip" title="Checks the brief did not mention when it was filed; the person who filed it saw them and filed anyway">${plural(acked.length, 'check')} acknowledged</span>`
              : uncAll && !filed ? html`<span class=${'den-chip ' + (uncAll.length ? 'den-chip-q' : 'pos')} title=${uncAll.length ? 'Checks on the rail the brief does not mention yet: ' + uncAll.map(s => s.title).join('; ') : 'The brief mentions every check on the rail'}>${uncAll.length ? plural(uncAll.length, 'check') + ' not in the brief yet' : 'all checks covered'}</span>` : null}
          </div>
          <div class="den-foot-act">
            <button class="den-mini quiet" data-tour="history" aria-expanded=${hist ? 'true' : 'false'} onClick=${loadHist}>History</button><button class="den-mini quiet" data-tour="compare" aria-expanded=${cmp ? 'true' : 'false'} aria-label="Compare with the last filed brief" title="Compare with the last filed brief" onClick=${compare}>Compare</button>
            <span class="den-menu"><button class="den-mini" data-tour="export" aria-expanded=${menu ? 'true' : 'false'} onClick=${() => setMenu(!menu)}>Export</button>
              ${menu ? html`<div class="den-menu-list" data-tour="export-menu" role="group" aria-label="Take it out"><span class="den-mono">Take it out${dirty ? ' (of the saved brief: save first to include your edits)' : ''}</span><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('rich'); }}>Copy for the document</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('md'); }}>Download .md</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('html'); }}>Download .html</button><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('slack'); }}>Copy the Slack summary</button></div>` : null}</span>
            ${canWrite && !filed && !past ? html`<button class="den-mini quiet" data-tour="draft-again" data-paid="1" disabled=${!!busy || !left || dirty} title=${dirty ? 'Save your edits first' : cost} onClick=${() => { if (Object.keys(brief.sections).some(k => brief.sections[k].edited)) setAsk({ redraft: true }); else draft(true); }}>${busy === 'draft' ? 'Drafting...' : 'Draft again (1 model call)'}</button>` : null}
            ${canWrite && !filed ? html`<button class="den-mini" data-tour="save" hidden=${!dirty} disabled=${!dirty || save.s === 'saving' || !!conflict} onClick=${() => doSave()}>Save changes</button>
              <button class="den-mini primary" data-tour="file" disabled=${!!busy || dirty} title=${dirty ? 'Save your edits first' : 'A person files a brief: nothing files by itself'} onClick=${() => file(false)}>${busy === 'file' ? 'Checking...' : html`${Ic('file')}Mark as filed`}</button>` : null}
            ${canWrite && filed ? html`<button class="den-mini" data-tour="reopen" disabled=${!!busy} onClick=${reopen}>Reopen</button>` : null}
          </div>
        </div>
      </section>
      ${ask && ask.redraft ? html`<${Dialog} title="Draft again?" onClose=${() => setAsk(null)}><p>Some sections were edited by a person. Drafting again replaces the whole brief, their words included. To keep them, regenerate single sections instead.</p><p class="den-mono">${cost}</p><div class="den-form"><button class="den-mini danger" data-paid="1" onClick=${() => { setAsk(null); draft(true); }}>Replace it all (1 model call)</button><button class="den-mini" onClick=${() => setAsk(null)}>Go back</button></div><//>` : null}
      ${ask && ask.signals ? html`<${Dialog} title="Before it is filed" tour="file-dialog" onClose=${() => setAsk(null)}><p>${ask.signals.length === 1 ? 'One thing' : ask.signals.length + ' things'} on the strip ${ask.signals.length === 1 ? 'is' : 'are'} not in this brief:</p>
        <ul class="den-ev">${ask.signals.map(s => html`<li key=${s.key}><b>${s.title}</b><br />${s.detail}</li>`)}</ul><p class="den-mono">Filing anyway records that these were seen and left out.</p>
        <div class="den-form"><button class="den-mini" onClick=${() => setAsk(null)}>Go back and cover them</button><button class="den-mini primary" disabled=${!!busy} onClick=${() => file(true)}>File anyway</button></div><//>` : null}
    </div>`;
  }

  return { BriefPanel };
};
