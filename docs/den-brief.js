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
    STRIP_PENDING, CHECKS, Strip, RowActions, layerTitle, Card, Board, addrDated, addrDay
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
    upcoming: 'M5 6h14v14H5zM5 10h14M9 3.5V7M15 3.5V7', tone: 'M5 20V10M12 20V4M19 20v-7', measure: 'M4 17l5-5 4 3 7-8M15 7h5v5', alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.2v.3',
    memory: 'M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6', open: 'M14 5h5v5M19 5l-8 8M11 7H6a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-5',
    pen: 'M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19l-4 1zM14 7l3 3', eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
    plus: 'M12 5v14M5 12h14', left: 'M15 6l-6 6 6 6', right: 'M9 6l6 6-6 6', chev: 'M6 9l6 6 6-6', check: 'M5 12.5l4.5 4.5L19 7.5',
    refresh: 'M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5M4 13a8 8 0 0 0 14.3 4.3L20 15.5M20 20v-4.5h-4.5', info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8v.01',
    copy: 'M9 9h10v11H9zM5 15V4h10', file: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 14.5l2.2 2.2L15.5 12'
  };
  const Ic = n => html`<svg class="den-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d=${GLYPH[n] || GLYPH.info} /></svg>`;
  // a kind as the evidence says it (e.k) or as the Board says it (c.kind), to one word, its icon, and whether a card of it can be filed under a section
  // measure (worker p71): a figure line the momentum section cites, an issue above its usual volume or against the window before
  const KIND = { media: 'media', social: 'social', actor: 'actor', actors: 'actor', narrative: 'narrative', narratives: 'narrative', upcoming: 'upcoming', tone: 'tone', measure: 'measure', alert: 'alert', memory: 'memory' };
  const FILEABLE = { media: 1, social: 1, actor: 1, narrative: 1, upcoming: 1 };
  const NAMELESS = /^A narrative not yet named$/i;
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n).trim() + '\u2026' : s; };
  const MARK = /\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g;
  const fHM = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const hm = ts => (ts ? fHM.format(new Date(+ts)) : '');   // 11:04, Sydney, as Today says it
  const markSays = e => { if (!e) return ''; if (e.text) return String(e.text); const l = String(e.label || ''); return e.k === 'media' ? l.split(' - ').slice(1).join(' - ') : e.k === 'social' || e.k === 'actor' ? '' : l; };
  const FS = !!(window.CSS && CSS.supports && CSS.supports('field-sizing', 'content'));   // a textarea that grows with its text by itself
  /* The downloaded document as plain text (p71, AEP m9): one conversion for the clipboard's text/plain item and for a browser
     that cannot copy formatted text. The body only (never the title or the stylesheet), a blank line after each block, the
     tags removed, the entities decoded once (&amp; last, so a written "&amp;lt;" stays as it was written). */
  function denDocPlain(h) { const s = String(h || ''); const b = (/<body[^>]*>([\s\S]*?)<\/body>/i.exec(s) || [0, s.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<(style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, '')])[1]; return b.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|h1|h2|h3|h4|li|div|ul|ol|table|tr)>/gi, '\n\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'; }

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
  /* A citation as a person reads it: the outlet, the channel or the actor, a narrative by its name, a tone figure or a
     measure by its issue; never the bare id, and never cut mid-word without saying so. A measure is named by what it
     measures (worker p71, review C5), as the strip names its checks: an issue's two figures, "Above baseline" (its usual
     volume) and "Window before", read apart in one sentence; a post's reach against its account's usual is "Unusual reach". */
  function citeLabel(id, e) {
    if (!e) return id; const l = String(e.label || '');
    if (e.k === 'media') return l.split(' - ')[0].slice(0, 32) || id; if (e.k === 'social') { const p = l.split(' ')[0]; return (CH[p] || p) + ' post'; }
    if (e.k === 'actor') return l.replace(/ on ([a-z]+)$/, (m, p) => ' on ' + (CH[p] || p)).slice(0, 36); if (e.k === 'alert') return 'Sentinel alert'; if (e.k === 'tone') return 'Tone: ' + cut(l, 28);
    if (e.k === 'measure') { const c = l.lastIndexOf(': '), m = c > 0 ? l.slice(c + 2) : '';   // "Gas taxation: above its usual volume" -> "Above baseline: Gas taxation"
      return (/^this window against /.test(m) ? 'Window before' : /^above its usual volume/.test(m) ? 'Above baseline' : /^far above its usual/.test(m) ? 'Unusual reach' : 'Figure') + ': ' + cut(c > 0 ? l.slice(0, c) : l, 28); }
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
  /* The flag a sentence carries. The worker (p71) checks the figures of a sentence that cites nothing against the whole
     evidence and marks that entry bare: such a figure is "not in the evidence", one in a cited sentence "not in the row it
     cites". A sentence whose ids the evidence never gave needs a source; when it also holds such a figure its one flag says
     both (it was said twice: in place, and again under the text), and its figure was read against the whole evidence, so
     it is "not in the evidence" whatever the entry says. `used` holds the entries already said: each is said once. */
  function figSay(u, bare) { const f = u && Array.isArray(u.figures) ? u.figures : []; return f.join(', ') + (f.length > 1 ? ' are' : ' is') + (bare || (u && u.bare) ? ' not in the evidence' : ' not in the row it cites'); }
  function flagOf(F, s, pl, used) {
    const u = (F.uncited || []).findIndex((x, j) => !used.u.has(j) && x === pl.slice(0, 240)); const f = (F.unverified || []).findIndex((x, j) => !used.f.has(j) && x.sentence === pl.slice(0, 200));
    if (u >= 0) { used.u.add(u); if (f >= 0) used.f.add(f); return 'Needs a source' + (f >= 0 ? ' (' + figSay(F.unverified[f], true) + ')' : '') + ':'; }
    if (f >= 0) { used.f.add(f); return figSay(F.unverified[f]) + ':'; }
    const t = (F.trimmed || []).findIndex((x, j) => !used.t.has(j) && s.indexOf(String(x).split(/\s+/).slice(0, 6).join(' ')) >= 0); if (t >= 0) { used.t.add(t); return 'A subscriber quotation was cut at thirty words:'; }
    return '';
  }
  /* The flags whose sentence could not be found in the text, said under it, in the same words and each once. */
  function flagsLeft(F, used) {
    const out = [];
    (F.uncited || []).forEach((x, i) => { if (used.u.has(i)) return; used.u.add(i); const f = (F.unverified || []).findIndex((y, j) => !used.f.has(j) && y.sentence === String(x).slice(0, 200)); if (f >= 0) used.f.add(f); out.push({ w: 'Needs a source' + (f >= 0 ? ' (' + figSay(F.unverified[f], true) + ')' : '') + ':', t: String(x) }); });
    (F.unverified || []).forEach((x, i) => { if (used.f.has(i)) return; used.f.add(i); out.push({ w: figSay(x) + ':', t: String(x.sentence || '') }); });
    (F.trimmed || []).forEach((x, i) => { if (used.t.has(i)) return; used.t.add(i); out.push({ w: 'A subscriber quotation was cut at thirty words:', t: String(x) + '...' }); });
    return out;
  }
  function Reads({ text, F, FL, evidence, onJump, onEdit, ix, stack }) {
    const used = { u: new Set(), f: new Set(), t: new Set() }; const plain = s => s.replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:])/g, '$1').replace(/ {2,}/g, ' ').trim();
    // p72 (lane P2): under a worker that serves flags, each open flag is marked at its sentence by its key (docs/den-flags.js), cut as the worker cuts
    const M = FL && window.DenFlags ? window.DenFlags.matcher(FL) : null; const cutS = M ? window.DenFlags.split : sentences; const wUsed = new Set();
    const I = ix || { nums: {}, names: {} };
    // a chip is a press to its card in the evidence pane (brought into view and focused), where the source is the next press; a chip the evidence cannot place says so
    const chip = (id, k) => { const e = evidence[id]; const t = id + (e ? ' - ' + (e.label || '') + '. Press to see its card in the evidence pane.' : ': this brief\'s evidence holds no row with this id, so saving removes it'); const body = (e ? I.names[id] || citeLabel(id, e) : 'unknown source') + (e && e.gated ? ' (subscriber)' : ''); const n = e ? I.nums[id] : 0;
      return e && onJump ? html`<button key=${k} type="button" class="den-cite" data-tour="cite-chip" data-cite=${id} data-n=${n || null} title=${t} aria-label=${'Citation ' + (n ? n + ', ' : '') + body + ': show its card in the evidence pane'} onClick=${() => onJump(id)}>${Ic(KIND[e.k] || 'info')}${body}</button>`
        : html`<span key=${k} class=${'den-cite' + (e ? '' : ' bad')} data-cite=${id} data-n=${n || null} title=${t}>${e ? Ic(KIND[e.k] || 'info') : null}${body}</span>`; };
    const parts = (s, k, ws) => s.split(/(\[[A-Z]:[A-Za-z0-9_.-]{1,40}\])/).filter(Boolean).map((p, i) => (/^\[[A-Z]:/.test(p) ? chip(p.slice(1, -1), k + '-' + i) : ws && ws.length ? window.DenFlags.pick(p, ws.filter(x => !wUsed.has(x.key))).map((x, j) => (typeof x === 'string' ? x : (wUsed.add(x.key), html`<mark key=${k + '-' + i + 'w' + j} class="den-fw" data-flag-keys=${x.key} data-word=${x.w}>${x.text}</mark>`))) : p));
    const raw = String(text || '').replace(/\r/g, ''); let from = 0;
    const paras = raw.split(/\n\n+/).filter(p => p.trim());
    const body = paras.map((p, pi) => { const ps = raw.indexOf(p, from); if (ps >= 0) from = ps;
      return html`<p key=${pi}>${cutS(p).map((s, si) => { const k = pi + '-' + si; const pl = plain(s); let lab = null, hit = null; const i = raw.indexOf(s, from); let at = null; if (i >= 0) { at = i + s.replace(/\s+$/, '').length; from = i + s.length; }
        if (M && pl) { hit = M(s); if (hit) lab = html`<span class="w">To check:</span>`; } else if (F && pl) { const w = flagOf(F, s, pl, used); if (w) lab = html`<span class="w">${w}</span>`; }
        return lab ? html`<span key=${k} class="den-flag" data-at=${at} data-flag-keys=${hit && hit.keys.length ? hit.keys.join(' ') : null}>${lab} <mark>${parts(s, k, hit && hit.words)}</mark> </span>` : html`<span key=${k} data-at=${at}>${parts(s, k)} </span>`; })}</p>`; });
    // a flag whose sentence could not be found in the text is still said, under it
    const rest = M ? M.rest().map(f => html`<li key=${f.key} data-flag-keys=${f.key}><span class="w">To check:</span> ${f.sentence}</li>`) : F ? flagsLeft(F, used).map((x, i) => html`<li key=${'r' + i}><span class="w">${x.w}</span> ${x.t}</li>`) : [];
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
  function Section({ s, n, of, sec, text, evidence, readOnly, onChange, onBlur, onSave, onRegen, busy, left, hidden, rate, carets, state, onStep, onJump, briefDirty, fl }) {
    const [ask, setAsk] = useState(false); const [note, setNote] = useState(''); const dirty = !!sec && text !== sec.text;
    const [mode, setMode] = useState('read'); const root = useRef(null); const ta = useRef(null); const gone = useRef(true); const blur = useRef(onBlur); blur.current = onBlur;
    const has = !!String(text || '').trim(); const editing = !readOnly && (mode === 'edit' || !has);   // an empty section is its own invitation to write
    const ix = useMemo(() => citeIndex(text, evidence), [text, evidence]);
    const [cur, setCur] = useState(-1);
    const caret = e => { const p = e.target.selectionStart; carets.current[s.id] = p; if (DEN_EDITOR_STACK && p !== cur) setCur(p); };
    // the citation the cursor is in or beside, named under the page so nobody has to decode a mark
    const markAt = useMemo(() => { if (!editing || cur < 0) return ''; const rx = new RegExp(MARK.source, 'g'); let m; while ((m = rx.exec(text))) { if (cur >= m.index && cur <= m.index + m[0].length) return m[0].slice(1, -1); if (m.index > cur) break; } return ''; }, [editing, cur, text]);   // eslint-disable-line
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
    const regenBtn = !readOnly && onRegen && !ask ? html`<button class="den-mini quiet" data-tour="regen" disabled=${busy} title="Opens the choices. Rewriting it uses 1 of today's AI drafts."
      onClick=${async () => { if ((dirty || briefDirty) && onSave) { const okd = await onSave(); if (!okd) return; } gone.current = true; setMode('read'); setAsk(true); }}>${Ic('refresh')}Rewrite this section\u2026</button>` : null;
    const regenForm = !readOnly && onRegen && ask ? html`<div class="den-form den-regen" data-tour="regen-form"><label class="den-lab den-grow">What to change (optional)<input value=${note} maxlength="400" placeholder="Shorter. Lead with the Senate vote." onInput=${e => setNote(e.target.value)} /></label>
        <button class="den-mini primary" data-tour="regen-go" data-paid="1" disabled=${busy || !left || briefDirty} title=${briefDirty ? 'Save your edits first' : left ? '' : 'Today\'s AI drafts are used; they come back at midnight (Sydney)'} onClick=${() => { onRegen(s.id, note, sec && sec.edited); setAsk(false); }}>Rewrite (uses 1 AI draft)</button><button class="den-mini quiet" data-tour="regen-cancel" onClick=${() => setAsk(false)}>Cancel</button>
        ${sec && sec.edited ? html`<span class="den-save dirty">This replaces ${sec.by ? sec.by + '\'s' : 'someone\'s'} edit.</span>` : null}</div>` : null;
    // the form takes the focus when it opens, and gives it back to Regenerate when it closes (the pressed button is gone)
    const asked = useRef(false);
    useEffect(() => { const r = root.current; if (!r) return; if (ask) { const i = r.querySelector('.den-regen input'); if (i) i.focus(); } else if (asked.current) { const b = [r.querySelector('[data-tour="regen"]'), r.querySelector('[data-tour="edit"]')].find(x => x && !x.disabled); if (b) b.focus(); } asked.current = ask; }, [ask]);
    const title = html`<h4>${s.title}${sec && sec.edited ? html`<span class="den-chip pos" title="A person has edited this section; a model will not write over it unless asked">${sec.by ? 'edited by ' + sec.by : 'edited'}</span>` : sec && sec.by === 'model' ? html`<span class="den-chip acc">drafted</span>` : null}${dirty ? html`<span class="den-chip warn">not saved</span>` : null}</h4>`;
    const onIn = e => { caret(e); onChange(s.id, e.target.value); };
    if (!DEN_EDITOR_STACK) return html`<div class="den-sec" data-tour="section" data-section=${s.id} hidden=${hidden}>
      <div class="den-eyebrow"><span>Section ${n} of ${of}</span><span class=${'den-chip ' + state[1]}>${state[0]}</span><span class="den-spacer"></span>
        <button class="den-mini quiet" disabled=${n <= 1} onClick=${() => onStep(-1)}>Previous</button><button class="den-mini quiet" disabled=${n >= of} onClick=${() => onStep(1)}>Next</button></div>
      ${title}<div class="den-secmeta"><span class="den-mono">${wc(text)} words</span><span class="den-spacer"></span>${regenBtn}</div>${regenForm}${rate || null}
      <div class="den-write-h"><b>Write</b> <span>citations are typed as [M:123]; a card on the right inserts one where the cursor was</span></div>
      <textarea class="den-ta" data-tour="editor" aria-label=${s.title} readOnly=${readOnly} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section, or draft the brief. Keep the [M:123] marks: they are the citations.'} onInput=${onIn} onSelect=${caret} onKeyUp=${caret} onClick=${caret} onBlur=${e => { caret(e); onBlur(); }}></textarea>
      <${Reads} text=${text} F=${sec && !dirty ? sec : null} evidence=${evidence} onJump=${onJump} ix=${ix} />
    </div>`;
    const flagN = state[2] != null ? state[2] : state[1] === 'warn' ? +((String(state[0]).match(/\d+/) || [0])[0]) : 0;   // p72: state[2] is the one count (docs/den-flags.js)
    return html`<div class="den-sec" ref=${root} data-tour="section" data-section=${s.id} data-mode=${editing ? 'edit' : 'read'} data-can=${readOnly ? null : '1'} hidden=${hidden}>
      <div class="den-eyebrow"><span>Section ${n} of ${of}</span>${flagN ? html`<span class="den-chip warn" title=${state[2] != null ? 'Things to check in this section, each in Check before you send' : 'Sentences the check flagged: no evidence behind them, a figure not in the row they cite, or a quotation cut. Each is marked at its sentence.'}>${state[2] != null ? flagN + ' to check' : plural(flagN, 'flag')}</span>` : null}<span class="den-spacer"></span>
        <button class="den-mini quiet den-step" disabled=${n <= 1} onClick=${() => onStep(-1)}>${Ic('left')}Previous</button><button class="den-mini quiet den-step" disabled=${n >= of} onClick=${() => onStep(1)}>Next${Ic('right')}</button></div>
      ${title}
      <div class="den-doc">
        <div class="den-docbar">${readOnly ? null : html`<div class="den-modes" role="group" aria-label="Read or edit this section">
            <button type="button" class="den-mode" data-tour="done" aria-pressed=${editing ? 'false' : 'true'} disabled=${!has} onClick=${() => { if (editing) finish(); }}>${Ic('eye')}Read</button><button type="button" class="den-mode" data-tour="edit" aria-pressed=${editing ? 'true' : 'false'} onClick=${() => edit(null)}>${Ic('pen')}Edit</button></div>`}
          <span class="den-words">${plural(wc(text), 'word')}</span><span class="den-spacer"></span>${regenBtn}</div>
        ${regenForm}
        <div class="den-docbody">
          ${editing ? html`<div class="den-ta-mirror" aria-hidden="true">${String(text || '').replace(/\r\n?/g, '\n').split(/(\[[A-Z]:[A-Za-z0-9_.-]{1,40}\])/).map((p, i) => (/^\[[A-Z]:/.test(p) ? html`<span key=${i} class=${'den-code' + (evidence[p.slice(1, -1)] ? '' : ' bad') + (markAt === p.slice(1, -1) ? ' on' : '')}>${p}</span>` : p))}${'\u200b'}</div>` : null}
          <${Reads} stack=${true} text=${text} F=${sec && !dirty ? sec : null} FL=${fl} evidence=${evidence} onJump=${onJump} onEdit=${readOnly ? null : edit} ix=${ix} />
          <textarea class="den-ta" ref=${ta} data-tour="editor" aria-label=${s.title} aria-hidden=${editing ? null : 'true'} readOnly=${readOnly} tabIndex=${readOnly || !editing ? -1 : 0} value=${text} placeholder=${readOnly ? 'Nothing written yet.' : 'Write this section. Click a card on the right to cite it.'}
            onFocus=${() => { if (!readOnly) { gone.current = false; setMode('edit'); } }} onInput=${onIn} onSelect=${caret} onKeyUp=${caret} onClick=${caret}
            onKeyDown=${e => { if (e.key === 'Escape') { e.preventDefault(); const b = root.current && root.current.querySelector('[data-tour="edit"]'); finish(); if (b) b.focus(); else e.target.blur(); } }} onBlur=${e => { caret(e); if (!keeps(e.relatedTarget)) finish(); }}></textarea>
        </div>
        ${readOnly ? null : html`<div class=${'den-dochint' + (markAt ? ' on' : '')} aria-live="polite">${!editing ? html`${Ic('pen')}<span>Click any sentence to edit it in place.</span>`
          : markAt && evidence[markAt] ? html`${Ic(KIND[evidence[markAt].k] || 'info')}<span><b>${ix.names[markAt] || citeLabel(markAt, evidence[markAt])}</b>${markSays(evidence[markAt]) ? ' \u00b7 ' + cut(markSays(evidence[markAt]), 90) : ''}</span><span class="den-evcode">${markAt}</span>`
          : markAt ? html`${Ic('alert')}<span><b>Unknown source.</b> This citation matches nothing in the brief's evidence; saving removes it.</span>`
          : html`${Ic('info')}<span>Click a card on the right to cite it at the cursor. Esc, or a click outside the text, saves and returns to reading.</span>`}</div>`}
      </div>
      ${rate || null}
    </div>`;
  }
  /* Time since an AI draft began. A count of seconds, never a share of the work: nothing here knows how far it is. p72 lane P5
     (UX-SPEC s.10.4): the ticking seconds are aria-hidden, so a screen reader inside the progress panel's role=status hears the
     start, at most one "Still being written" a minute, and the end (the panel goes and the toast says it), never each second. */
  function Elapsed({ from }) { const [, f] = useState(0); useEffect(() => { const t = setInterval(() => f(x => x + 1), 1000); return () => clearInterval(t); }, []); const s = Math.max(0, Math.round((Date.now() - from) / 1000)); const m = Math.floor(s / 60);
    return html`<span aria-hidden="true" data-elapsed="1">${m + ':' + String(s % 60).padStart(2, '0')}</span><span class="den-sr">${m ? 'Still being written, ' + m + ' min so far.' : ''}</span>`; }

  /* ---- p72, lane pane: each section's sources, without the Board ----
     Spec v3 Part A, in Part D's words (UX-SPEC s.6.3, the rows marked P1; s.12.2). It turns on only when the worker serves
     it, that is when the brief view carries `review` and `flags` (spec v3 rule 9); a view without them (a p71 worker) keeps
     the pane below it exactly as it was. Every list is worked out here from the view and the live words, nothing stored:
     Used in this section (what the live text cites, what is added to the section on the Board or by a person, less what a
     person took out), Used here but marked not for this section, Suggested (at most three, each with its reason), New since
     it was written, Taken out of this section, Find a story or post, and Add a new source (paste a link). A correction is,
     in this order, a text save (POST /den/brief/save), the Board's unfiling (POST /den/pin with no section) and the
     corrections beside the text (POST /den/brief/review); it stops at the first that fails and says which went through.
     window.DenPane carries the pure parts, the component and land() for the other rooms (P2's flags, P3's Today). */
  const PANE_KIND = { media: 'media', social: 'social', actor: 'actors', actors: 'actors', narrative: 'narratives', narratives: 'narratives', upcoming: 'upcoming', added: 'added' };
  const PANE_NARROW = { summary: 1, judgement: 1, bottom: 1, posture: 1 };   // Suggested offers nothing here but what an open check stands behind
  const PANE_ABBR = /(?<![A-Za-z])(?:Dr|Mr|Mrs|Ms|Mx|Prof|Sr|Jr|St|Mt|Ft|Sen|Hon|Rev|Gen|Lt|Col|Capt|Sgt|Cpl|Insp|Supt|Det|Cmdr|Adm|Gov|Pres|No|Nos|Fig|Vol|vs|approx|ca|cf|e\.g|i\.e)\.$/;
  const paneSupport = b => !!(b && b.review && typeof b.review === 'object' && Array.isArray(b.flags));
  const paneFnv = s => { s = String(s == null ? '' : s); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); };
  // the sentence as the worker matches it (denPlain): its marks out, no space before a stop, white space collapsed
  const panePlain = s => String(s == null ? '' : s).replace(/\[[A-Z]:[^\]]+\]/g, '').replace(/\s+([.,;:!?])/g, '$1').replace(/\s+/g, ' ').trim();
  // a paragraph's sentences, each with the white space after it, cut as the worker cuts them (denSentences): after . ! ? or ]
  // before a capital, a quote or a mark, never after a title or an abbreviation (Dr., Mt., No.)
  function paneSplit(par) { const out = []; const rx = /(?<=[.!?\]])\s+(?=[A-Z"'\[])/g; let at = 0, m;
    const put = (s, sep) => { const l = out[out.length - 1]; if (l && PANE_ABBR.test(l.s)) { l.s += l.sep + s; l.sep = sep; } else out.push({ s, sep }); };
    while ((m = rx.exec(par))) { put(par.slice(at, m.index), m[0]); at = m.index + m[0].length; } put(par.slice(at), ''); return out; }
  /* The sentences of a text that carry a mark, in order. */
  const paneCiting = (text, id) => { const mk = '[' + id + ']'; const out = []; String(text || '').split(/\n\n+/).forEach(p => paneSplit(p).forEach(x => { if (x.s.indexOf(mk) >= 0) out.push(x.s); })); return out; };
  /* A text with each sentence that carries the mark deleted ('del') or kept without that mark ('keep'), as `pick(n)` says for
     the nth such sentence. `keep` lists the plain form of each kept sentence left with no mark at all (sent as nosource). */
  function paneApply(text, id, pick) { const mk = '[' + id + ']'; const bits = String(text || '').split(/(\n\n+)/); let n = 0; const keep = []; let changed = false;
    for (let i = 0; i < bits.length; i += 2) { const out = [];
      paneSplit(bits[i]).forEach(x => { if (x.s.indexOf(mk) < 0) { out.push(x); return; } const how = pick(n++); changed = true;
        if (how === 'del') return;
        const s = x.s.split(mk).join('').replace(/[ \t]+([.,;:!?])/g, '$1').replace(/[ \t]{2,}/g, ' ').replace(/^\s+/, '');
        if (!/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/.test(s) && panePlain(s)) keep.push(panePlain(s)); out.push({ s, sep: x.sep }); });
      bits[i] = out.map((x, j) => x.s + (j < out.length - 1 ? (x.sep || ' ') : '')).join(''); }
    const t = changed ? bits.join('').split(/\n\n+/).filter(p => p.trim()).join('\n\n') : String(text || '');
    return { text: t, keep }; }
  // an upcoming date's id as the worker gives it (denUpId): U: and FNV-1a 32 of its date and event, with its record or its row
  // when two entries share both; a date the brief's sources do not hold yet is cited by it
  // the worker's denUpId tie-break (p72 fix W3): process, else first (the lowest story row telling it; absent on an older worker), else item, else fold
  const paneUpId = (u, dup) => { u = u || {}; const base = String(u.date || '') + '|' + String(u.event || ''); const alt = u.process ? 'p' + u.process : +u.first > 0 ? 'i' + (+u.first) : u.item ? 'i' + u.item : String(u.fold || ''); return 'U:' + paneFnv(dup[base] > 1 ? base + '|' + alt : base); };
  const paneHost = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
  const panePlatform = h => (/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/.test(h) ? 'facebook' : /(^|\.)instagram\.com$/.test(h) ? 'instagram' : /(^|\.)(x\.com|twitter\.com)$/.test(h) ? 'x' : /(^|\.)(youtube\.com|youtu\.be)$/.test(h) ? 'youtube' : /(^|\.)(reddit\.com|redd\.it)$/.test(h) ? 'reddit'
    : /(^|\.)linkedin\.com$/.test(h) ? 'linkedin' : /(^|\.)tiktok\.com$/.test(h) ? 'tiktok' : /(^|\.)threads\.(net|com)$/.test(h) ? 'threads' : /(^|\.)bsky\.app$/.test(h) ? 'bluesky' : '');
  /* Pasted links: every web address in what was pasted, once each (a bare www. address is read as https); anything else is
     said back as not a link. The worker cleans and checks each again (denSourceIn). */
  function paneAddrs(s) { const ok = [], bad = []; String(s || '').split(/[\s,]+/).filter(Boolean).forEach(t => { let u = t.replace(/[)>\]"'.,;]+$/, ''); if (/^www\./i.test(u)) u = 'https://' + u;
      if (/^https?:\/\//i.test(u) && paneHost(u).indexOf('.') > 0) { if (ok.indexOf(u) < 0) ok.push(u); } else if (bad.indexOf(t) < 0) bad.push(t); }); return { ok, bad }; }
  const paneAddrLabel = u => { const h = paneHost(u); const p = panePlatform(h); return p ? (CH[p] || p) + ' post' : h; };
  /* A board card as a citation the page treats as known until the save answers (spec v3 Part A item 2): its chip and label
     from the card, never the red "unknown source" mark. */
  function panePending(ev, cards, texts, refused) {
    const ups = (cards || []).filter(c => c.kind === 'upcoming'); const dup = {}; ups.forEach(c => { const b = String((c.r || {}).date || '') + '|' + String((c.r || {}).event || ''); dup[b] = (dup[b] || 0) + 1; });
    const want = new Set(); Object.keys(texts || {}).forEach(k => (String(texts[k] || '').match(MARK) || []).forEach(m => { const id = m.slice(1, -1); if (!ev[id] && (refused || []).indexOf(id) < 0) want.add(id); }));
    if (!want.size) return ev; const out = Object.assign({}, ev);
    (cards || []).forEach(c => { const id = c.kind === 'upcoming' ? (citeOf(c, ev) || paneUpId(c.r, dup)) : c.cite; if (!want.has(id) || out[id]) return; const r = c.r || {};
      const k = { media: 'media', social: 'social', actors: 'actor', narratives: 'narrative', upcoming: 'upcoming' }[c.kind] || 'media';
      const label = k === 'media' ? (r.outlet || r.source || 'News') + ' - ' + (c.title || '') : k === 'social' ? (r.platform || 'social') + ' post' : k === 'actor' ? (r.who || 'An account') + (r.platform ? ' on ' + r.platform : '') : k === 'upcoming' ? (c.label || c.title || '') : String(c.title || '');
      out[id] = { k, label, url: c.url || '', gated: 0, item: c.id || 0, text: k === 'media' || k === 'narrative' || k === 'upcoming' ? '' : String(c.title || ''), pending: true }; });
    return out; }
  /* What a card says, in words, as the evidence pane's own card says it (srcOf, sayOf, metaOf in BriefPanel), with Part D's
     words: a post's figures are engagements; a source a person added is its platform's post or its host, in her line. */
  const paneSrc = (c, e) => { if (c) { const r = c.r || {}; return c.kind === 'media' ? (r.outlet || r.source || 'News') : c.kind === 'social' ? (CH[r.platform] || r.platform || 'Social') + ' post' : c.kind === 'actors' ? (r.who || 'A registered account') + (r.platform ? ' on ' + (CH[r.platform] || r.platform) : '') : c.kind === 'narratives' ? 'Narrative' : 'Date'; }
    if (!e) return 'Collected after it was written'; const l = String(e.label || '');
    return e.k === 'added' ? (l || paneHost(e.url) || 'A source you added') : e.k === 'media' ? (l.split(' - ')[0] || 'News') : e.k === 'social' || e.k === 'actor' ? citeLabel('', e) : e.k === 'narrative' ? 'Narrative' : e.k === 'tone' ? 'Tone' : e.k === 'measure' ? 'Figure' : e.k === 'alert' ? 'Sentinel alert' : e.k === 'memory' ? 'Agency memory' : e.k === 'upcoming' ? 'Date' : 'Source'; };
  const paneSays = (c, e) => { if (c && c.title) return { t: String(c.title) }; if (!e) return { t: c ? String(c.label || '') : '' }; if (e.k === 'added') return e.line ? { t: String(e.line) } : { t: String(e.url || ''), quiet: true };
    if (e.text) return { t: String(e.text) }; const l = String(e.label || '');
    if (e.k === 'media') return { t: l.split(' - ').slice(1).join(' - ') || l }; if (e.k === 'narrative') return { t: NAMELESS.test(l) ? 'A narrative the Den has not named yet' : l };
    if (e.k === 'upcoming' || e.k === 'tone' || e.k === 'measure' || e.k === 'alert' || e.k === 'memory') return { t: l }; return { t: 'Its words were not kept with this report. View the source to read it.', quiet: true }; };
  const paneMeta = (c, e, day) => { if (c) { const r = c.r || {}; const bits = c.kind === 'media' ? [c.outlets > 1 ? c.outlets + ' outlets' : '', c.reach ? fmtN(c.reach) + ' on Facebook' : ''] : c.kind === 'social' || c.kind === 'actors' ? [c.reach ? fmtN(c.reach) + ' engagements' : ''] : c.kind === 'narratives' ? [r.n ? plural(r.n, 'story and post').replace('story and posts', 'stories and posts') : '', r.n24 ? r.n24 + ' in the last day' : '', r.status || ''] : [r.date || ''];
      if (c.kind === 'media' && addrDated(r)) bits.push(addrDay(r, String(day || '').slice(0, 4))); else if (c.ts) bits.push(since(c.ts)); return bits.filter(Boolean).join(' \u00b7 '); }
    if (e && e.k === 'added') return e.date ? dayWords(e.date) : ''; return e ? String(e.sub || (e.gated ? 'Subscriber story: quoted at most thirty words' : '')).replace(/\binteractions\b/g, 'engagements') : ''; };

  /* The pane's lists for one section, from the view, the live words, the Board's cards and where they are filed. Pure.
     o.stories (Today's drawer, UX-SPEC s.4.7 and s.6.2): only stories, posts and sources added by link are offered, never an
     alert, a figure, a tone line, a narrative or a date (p72 review U2). */
  const PANE_STORY_E = { media: 1, social: 1, actor: 1, added: 1 }, PANE_STORY_C = { media: 1, social: 1, actors: 1 };
  const paneStory = r => (r.c ? !!PANE_STORY_C[r.c.kind] : !!(r.e && PANE_STORY_E[r.e.k]));
  function paneLists(o) {
    const { brief, sec, others, T, cards, filing, sigs, isCov } = o; const only = o.stories ? paneStory : () => true; const ev = (brief && brief.evidence) || {}; const rv = (brief && brief.review) || {}; const fl = filing || {};
    const pk = ((rv.picks || {})[sec.id]) || {}; const add = pk.add || {}, rem = pk.remove || {};
    const left = new Set(Object.keys(rv.marks || {}).filter(k => (rv.marks[k] || {}).kind === 'check'));
    const dup = {}; (cards || []).forEach(c => { if (c.kind !== 'upcoming') return; const b = String((c.r || {}).date || '') + '|' + String((c.r || {}).event || ''); dup[b] = (dup[b] || 0) + 1; });
    const pid = new Map(); const idOf = c => { if (pid.has(c)) return pid.get(c); const id = citeOf(c, ev) || (c.kind === 'upcoming' ? paneUpId(c.r, dup) : c.cite); pid.set(c, id); return id; };
    const byId = {}, byKey = {}; (cards || []).forEach(c => { const id = idOf(c); byKey[c.key] = c; if (id && !byId[id]) byId[id] = c; });
    const known = id => !!(ev[id] || byId[id]); const row = id => ({ id, c: byId[id] || null, e: ev[id] || null });
    const marks = t => { const out = []; (String(t || '').match(MARK) || []).forEach(m => { const id = m.slice(1, -1); if (out.indexOf(id) < 0) out.push(id); }); return out; };
    const citedBy = {}; others.forEach(s => marks(T(s.id)).forEach(id => { (citedBy[id] = citedBy[id] || []).push(s.id); }));
    const here = marks(T(sec.id));
    const filedIn = sid => Object.keys(fl).filter(k => fl[k] === sid).map(k => { const c = byKey[k]; const id = c ? idOf(c) : (ev[k] ? k : ''); return id ? { id, c: c || null, board: !!(c && c.pin && c.pinned) } : null; }).filter(Boolean);
    const filedHere = filedIn(sec.id);
    const ids = []; const put = id => { if (id && ids.indexOf(id) < 0) ids.push(id); }; here.forEach(put); filedHere.forEach(f => put(f.id)); Object.keys(add).forEach(put);
    const used = ids.filter(id => !rem[id] && known(id) && only(row(id))).map(id => Object.assign(row(id), { cited: here.indexOf(id) >= 0, filed: filedHere.find(f => f.id === id) || null, added: add[id] || null }));
    const marked = here.filter(id => rem[id] && known(id)).map(id => Object.assign(row(id), { removed: rem[id], filed: filedHere.find(f => f.id === id) || null }));
    const removed = Object.keys(rem).filter(id => here.indexOf(id) < 0 && known(id)).map(id => Object.assign(row(id), { removed: rem[id] }));
    const taken = new Set(ids.concat(Object.keys(rem)));
    const open = (sigs || []).filter(s => s && s.sig !== 'gap' && !left.has(s.key) && !(isCov && isCov(s)));
    const behind = id => { const c = byId[id]; return open.some(s => (s.cover || []).indexOf(id) >= 0 || !!(c && (c.sigs || []).some(x => x && x.key === s.key))); };
    const kinds = Object.keys(KIND_SEC).filter(k => KIND_SEC[k].indexOf(sec.kind) >= 0 || KIND_SEC[k].indexOf(sec.id) >= 0); const narrow = !!PANE_NARROW[sec.kind];
    const suggested = [];
    for (const id of Object.keys(ev)) { if (suggested.length >= 3) break; const e = ev[id] || {}; if (e.k === 'added' || citedBy[id] || taken.has(id)) continue;
      const c = byId[id] || null; if (!only({ c, e })) continue; const b = behind(id); if (narrow ? !b : kinds.indexOf(c ? c.kind : PANE_KIND[e.k]) < 0) continue;
      const why = b ? 'behind something to check' : c && c.pinned ? 'must mention' + (c.r && c.r.pinned_by ? ' \u00b7 ' + c.r.pinned_by : '') : c && c.outlets > 1 ? 'carried by ' + c.outlets + ' outlets' : '';
      if (why) suggested.push(Object.assign(row(id), { why })); }
    const fresh = cards ? cards.filter(c => { const id = idOf(c); return id && !ev[id] && !taken.has(id) && only({ c }); }).sort(byWeight).map(c => row(idOf(c))) : null;
    const pool = cards ? cards.filter(c => { const id = idOf(c); return id && !taken.has(id) && only({ c }); }).sort(byWeight).map(c => Object.assign(row(idOf(c)), { fresh: !ev[idOf(c)] })) : null;
    const checks = open.filter(s => sigSec(s, cards, fl, others) === sec.id);
    // whether a section holds the card in its list: cited there, added there, or filed there (on the Board or on this computer), and not taken out
    const inList = (id, sid) => { const p = ((rv.picks || {})[sid]) || {}; if ((p.remove || {})[id]) return false; return (citedBy[id] || []).indexOf(sid) >= 0 || !!(p.add || {})[id] || filedIn(sid).some(f => f.id === id); };
    return { used, marked, removed, suggested, fresh, pool, checks, citedBy, inList, idOf };
  }
  /* A card named in words when it may not be in the evidence any more: its label, its Board card, or what kind of line it was. */
  const PANE_LINE = { K: 'a key line', T: 'a tone figure', C: 'a comparison line', I: 'an issue figure', A: 'a Sentinel alert', U: 'a date', H: 'a source added by link', N: 'a narrative' };
  const paneIdName = (id, ev, cards) => { if (ev && ev[id]) return citeLabel(id, ev[id]); const c = (cards || []).find(x => x.cite === id); return c && c.title ? cut(c.title, 60) : PANE_LINE[String(id).charAt(0)] || 'a story or post'; };
  /* What a replace draft will drop of the review (worker item 9, denReviewRemap), said before it is paid for: a pick of a line
     each draft writes afresh (K:, T:, C:, I:, A:) or of a date by its old place goes; a story's or post's pick stays only if
     the new draft still has its row (or a source she added, only if the draft keeps it); a narrative's and a date's stay;
     a flag left as it is in a section goes with the section's words. A strip check left out stays. */
  function paneDropPreview(review, secTitle, name, flagSay) { const rv = review || {}; const drop = [], maybe = [];
    Object.keys(rv.picks || {}).forEach(sid => { const p = rv.picks[sid] || {}; ['add', 'remove'].forEach(l => Object.keys(p[l] || {}).forEach(id => { const what = (l === 'add' ? 'Added to ' : 'Taken out of ') + secTitle(sid) + ': ' + name(id); const pre = id.charAt(0);
      if ('KTCIA'.indexOf(pre) >= 0) drop.push({ what, why: 'a line each draft writes afresh' }); else if (pre === 'U' && !/^U:[0-9a-f]{8}$/.test(id)) drop.push({ what, why: 'the dates are numbered afresh' });
      else if (pre !== 'N' && pre !== 'U') maybe.push({ what }); })); });
    Object.keys(rv.marks || {}).forEach(k => { const m = rv.marks[k] || {}; if (m.sec) drop.push({ what: 'Left as it is in ' + secTitle(m.sec) + ': ' + (flagSay(k) || 'a check'), why: 'the section is written again' }); });
    return { drop, maybe }; }
  /* Land on a card, a check or a citation inside a container: the workbench's pane, a section page, or Today's document and
     drawer (UX-SPEC s.14). `target` is an id ('M:12'), { cite }, { check: <signal key> } or { sel }. The element is brought
     into view, focused (its card button when it has one) and lit for a moment. Answers the element, or null. */
  function paneLand(container, target) { if (!container || !container.querySelector) return null; const t = typeof target === 'string' ? { cite: target } : (target || {});
    const q = s => String(s).replace(/["\\]/g, '\\$&');
    const sel = t.check ? '[data-check="' + q(t.check) + '"]' : t.cite ? '.den-evitem[data-cite="' + q(t.cite) + '"], li[data-cite="' + q(t.cite) + '"], [data-cite="' + q(t.cite) + '"]' : t.sel || '';
    const el = sel ? container.querySelector(sel) : null; if (!el) return null;
    try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
    const b = el.matches('button, a[href]') ? el : el.querySelector('.den-evcard:not([disabled]), button:not([disabled]), a[href]'); const f = b || el; if (!b && !(f.tabIndex >= 0)) f.setAttribute('tabindex', '-1');
    f.focus({ preventScroll: true }); el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 1800); return el; }

  /* The pane. `room` is 'pane' (the workbench, every list and every correction) or 'drawer' (Today: Suggested, Used, New
     since, Find and Add a new source; Use here only, UX-SPEC s.4.7). Its writes are the panel's: onCite(id), review(ops)
     (throws in words), saveWith({sections, nosource, sources, sources_remove}) ({ok, d} or {ok:false, e}) and unfile(card).
     In the drawer (p72 review U2, U4, U7) it offers stories, posts and added links only, each with a Use here button that is
     always seen, draws no heading of its own (the drawer has one), and, given say(t) and alert(t), speaks through the room's
     one polite region and one alert region instead of drawing live regions of its own. */
  function SourcesPane(P) {
    const { brief, sec, others, T, cards, filing, sigs, isCov, ro, room, day, onCite, review, saveWith, unfile, ix, setTab, refusal } = P;
    const ev = brief.evidence || {}; const drawer = room === 'drawer'; const can = !ro; const quiet = !!(P.say || P.alert); const role = r => (quiet ? null : r);
    const [offer, setOffer] = useState(null); const [busy, setBusy] = useState(''); const [err, setErr] = useState(null); const [note, setNote] = useState(null);
    const [findOpen, setFindOpen] = useState(false); const [needle, setNeedle] = useState(''); const [kind, setKind] = useState('all'); const [onlyNew, setOnlyNew] = useState(false);
    const [outOpen, setOutOpen] = useState(false); const [freshAll, setFreshAll] = useState(false); const [addOpen, setAddOpen] = useState(false); const [addText, setAddText] = useState(''); const [addMeta, setAddMeta] = useState({});
    const root = useRef(null); const opener = useRef(null); const after = useRef(null);
    useEffect(() => { setOffer(null); setErr(null); setNote(null); }, [sec.id]);
    // before a card leaves its list the focus is sent on (the next card in that list, else the previous, else the heading)
    useEffect(() => { const a = after.current; if (!a) return; after.current = null; requestAnimationFrame(() => { const r = root.current; if (!r) return;
      const el = (a.cite && r.querySelector('li[data-list="' + a.list + '"][data-cite="' + a.cite + '"] .den-evcard:not([disabled]), li[data-list="' + a.list + '"][data-cite="' + a.cite + '"] button:not([disabled])')) || r.querySelector('.den-evh1 b');
      if (el) { if (!(el.tabIndex >= 0)) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); } }); });
    // an offer takes the focus when it opens (its first choice), and gives it back to the button that opened it when it closes
    const offered = useRef(false);
    useEffect(() => { const r = root.current; if (!r) return; if (offer) { const i = r.querySelector('.den-offer input, .den-offer button'); if (i) i.focus(); } else if (offered.current && opener.current && opener.current.isConnected) opener.current.focus(); offered.current = !!offer; }, [offer && offer.id, offer && offer.scope]);   // eslint-disable-line
    const L = paneLists({ brief, sec, others, T, cards, filing, sigs, isCov, stories: drawer });
    useEffect(() => { if (note && P.say) P.say(note.msg); }, [note && note.msg]);   // eslint-disable-line
    useEffect(() => { if (err && P.alert) P.alert(err.msg); }, [err && err.msg]);   // eslint-disable-line
    useEffect(() => { if (refusal && P.alert) P.alert(refusal); }, [refusal]);   // eslint-disable-line
    const name = r => cut(paneSays(r.c, r.e).t || r.id, 90); const secName = id => (others.find(s => s.id === id) || {}).title || id;
    const nextFrom = (list, id) => { const r = root.current; const li = r && r.querySelector('li[data-list="' + list + '"][data-cite="' + id + '"]'); const sib = li && (li.nextElementSibling || li.previousElementSibling); return { list, cite: sib ? sib.getAttribute('data-cite') : '' }; };
    const closeOffer = () => setOffer(null);
    const fail = (id, what, e, done) => setErr({ id, msg: (done && done.length ? done.join(' ') + ' ' : '') + what + ' didn\'t go through: ' + say(e) + (done && done.length ? ' The rest was not tried.' : ' Nothing changed.') });
    // one correction beside the text: Add to this section, Put back, Keep it
    const PICK = { add: ['Added to ', 'Adding it to this section'], back: ['Put back in ', 'Putting it back'], unremove: ['Kept in ', 'Keeping it in this section'] };
    const pickOp = async (r, list, how, leaves) => { const op = how === 'back' ? 'add' : how; const nx = leaves ? nextFrom(list, r.id) : null; setBusy(r.id); setErr(null); setNote(null);
      try { await review([{ op, sec: sec.id, item: r.id }]); if (nx) after.current = nx; setNote({ msg: PICK[how][0] + sec.title + ': ' + name(r) + '.' }); }
      catch (e) { fail(r.id, PICK[how][1], e); } setBusy(''); };
    // Remove the number: the mark comes out of every sentence of this section that carries it, and a sentence left with no
    // source joins the section's list of sentences without one (nosource), all in one save
    const strike = async r => { const x = paneApply(T(sec.id), r.id, () => 'keep'); const nx = nextFrom('marked', r.id); setBusy(r.id); setErr(null); setNote(null);
      const res = await saveWith({ sections: { [sec.id]: x.text }, nosource: x.keep.length ? { [sec.id]: x.keep } : undefined }); setBusy('');
      if (!res.ok) { fail(r.id, 'Removing the number', res.e); return; } after.current = nx; setNote({ msg: 'The number was removed from ' + sec.title + (x.keep.length ? '; ' + plural(x.keep.length, 'sentence') + ' kept without a source' : '') + ': ' + name(r) + '.' }); };
    // Not for this section / Not for this report: the text save, then the Board's unfiling, then the corrections beside the text
    const runOut = async (r, scope, picks) => { const secs = scope === 'report' ? others : [sec]; const sections = {}, nos = {}; let nDel = 0, nKeep = 0;
      secs.forEach(s => { const t = T(s.id); if (!paneCiting(t, r.id).length) return; let i = 0;
        const x = paneApply(t, r.id, () => { const v = (picks || {})[s.id + '|' + (i++)] === 'del' ? 'del' : 'keep'; if (v === 'del') nDel++; else nKeep++; return v; }); sections[s.id] = x.text; if (x.keep.length) nos[s.id] = x.keep; });
      const list = L.used.some(x => x.id === r.id) ? 'used' : 'marked'; const nx = nextFrom(list, r.id); const done = []; setBusy(r.id); setErr(null); setNote(null);
      if (Object.keys(sections).length) { const res = await saveWith({ sections, nosource: Object.keys(nos).length ? nos : undefined }); if (!res.ok) { setBusy(''); fail(r.id, 'Saving the sentences', res.e); return; }
        done.push('The sentences were saved (' + [nDel ? plural(nDel, 'sentence') + ' deleted' : '', nKeep ? plural(nKeep, 'sentence') + ' kept without the source' : ''].filter(Boolean).join(', ') + ').'); }
      const c = r.c; const bsec = c && c.pin && c.pinned && filing[c.key] && secs.some(s => s.id === filing[c.key]) ? filing[c.key] : '';
      if (bsec) { try { await unfile(c); } catch (e) { setBusy(''); fail(r.id, 'Taking it off ' + secName(bsec) + ' on the Board', e, done); return; } done.push('It is no longer added to ' + secName(bsec) + ' on the Board.'); }
      const addIn = sid => !!((((brief.review || {}).picks || {})[sid] || {}).add || {})[r.id];
      const ops = secs.filter(s => (s.id === sec.id || L.inList(r.id, s.id)) && !(s.id === bsec && !addIn(s.id))).map(s => ({ op: 'remove', sec: s.id, item: r.id }));
      if (ops.length) { try { await review(ops); } catch (e) { setBusy(''); fail(r.id, 'Taking it out of ' + (scope === 'report' ? 'the report\'s sections' : sec.title), e, done); return; } }
      after.current = nx; setOffer(null); setBusy(''); setNote({ msg: 'Taken out of ' + (scope === 'report' ? 'this report' : sec.title) + ': ' + name(r) + '.' + (done.length ? ' ' + done.join(' ') : '') }); };
    const askOut = (r, scope, e) => { opener.current = e && e.currentTarget; const secs = scope === 'report' ? others : [sec]; if (!secs.some(s => paneCiting(T(s.id), r.id).length)) { runOut(r, scope, {}); return; } setErr(null); setOffer({ id: r.id, scope, picks: {} }); };
    const dropSource = async r => { setBusy(r.id); setErr(null); setNote(null); const nx = nextFrom('used', r.id); const res = await saveWith({ sources_remove: [r.id] }); setBusy('');
      if (!res.ok) { fail(r.id, 'Removing the source', res.e); return; } after.current = nx; setNote({ msg: 'Source removed from the report: ' + name(r) + '.' }); };
    const parsed = paneAddrs(addText); const hNow = Object.keys(ev).filter(k => /^H:/.test(k)).length; const roomFor = Math.max(0, 40 - hNow);
    const tooMany = parsed.ok.length > roomFor; useEffect(() => { if (tooMany && P.alert) P.alert('A report holds at most 40 sources added by link; this one has ' + hNow + ', so ' + (roomFor ? 'only ' + roomFor + ' more can be added' : 'no more can be added') + '.'); }, [tooMany]);   // eslint-disable-line
    const addRun = async () => { const list = parsed.ok.map(u => { const m = addMeta[u] || {}; return Object.assign({ url: u }, m.line ? { line: m.line } : {}, m.date ? { date: m.date } : {}); }); setBusy('add'); setErr(null); setNote(null);
      const res = await saveWith({ sources: list }); if (!res.ok) { setBusy(''); fail('add', 'Adding ' + (list.length === 1 ? 'the source' : 'the sources'), res.e); return; }
      const got = (res.d && res.d.added) || []; const evn = (res.d && res.d.brief && res.d.brief.evidence) || {}; setAddText(''); setAddMeta({});
      const names = got.map(a => paneSrc(null, evn[a.id] || { k: 'added', label: paneAddrLabel(a.url) })); let listed = true;
      if (got.length) { try { await review(got.map(a => ({ op: 'add', sec: sec.id, item: a.id }))); } catch (e) { listed = false; setErr({ id: 'add', msg: (got.length === 1 ? 'The source was' : 'The sources were') + ' added to the report, but listing ' + (got.length === 1 ? 'it' : 'them') + ' under ' + sec.title + ' didn\'t go through: ' + say(e) + ' Use here still works.' }); } }
      setBusy(''); if (listed) setNote({ msg: 'Added ' + plural(got.length, 'source') + ' to ' + sec.title + ': ' + names.join(', ') + '.' + (drawer ? '' : ' Use here puts its number where your cursor is.') }); };
    const escToText = e => { if (e.key !== 'Escape') return; const wrap = e.currentTarget.closest('.den-briefwrap') || document; const ta = wrap.querySelector('.den-sec[data-mode="edit"]:not([hidden]) textarea'); if (ta) { e.preventDefault(); ta.focus(); } };
    const prov = r => { const w = (verb, x) => verb + (x.by ? ' by ' + x.by : '') + (x.at ? ', ' + aest(x.at) : '');
      return r.removed ? w('Taken out', r.removed) : r.e && r.e.k === 'added' ? w('Source added', r.e) : r.added ? w('Added to this section', r.added) : r.filed && r.filed.board ? 'Added to this section on the Board' : ''; };
    const filedState = (r, ik) => { if (!FILEABLE[ik]) return 'na'; const k = r.c ? r.c.key : r.id; const s = filing[k]; return s === sec.id ? 'here' : s && others.some(x => x.id === s) ? 'else' : 'none'; };
    const offerBox = r => { const scope = offer.scope; const secs = scope === 'report' ? others : [sec]; const hid = 'den-offer-' + r.id.replace(/[^A-Za-z0-9]/g, '-');
      const groups = secs.map(s => ({ s, list: paneCiting(T(s.id), r.id) })).filter(g => g.list.length); const total = groups.reduce((n, g) => n + g.list.length, 0);
      const all = groups.every(g => g.list.every((x, i) => offer.picks[g.s.id + '|' + i])); const pick = (k, v) => setOffer(o => Object.assign({}, o, { picks: Object.assign({}, o.picks, { [k]: v }) }));
      return html`<div class="den-offer" role="group" aria-labelledby=${hid} onKeyDown=${e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeOffer(); } }}>
        <p id=${hid}><b>${scope === 'report' ? 'Not for this report' : 'Not for this section'}</b>: ${scope === 'report' ? 'the report uses it in ' : 'this section uses it in '}${plural(total, 'sentence')}. Choose for each, then take it out.</p>
        ${groups.map(g => html`<div key=${g.s.id} class="den-offer-g">${scope === 'report' ? html`<div class="den-offer-sec">${g.s.title}</div>` : null}
          ${g.list.map((x, i) => { const k = g.s.id + '|' + i; const nm = hid + '-' + g.s.id + '-' + i; return html`<fieldset key=${k} class="den-offer-s"><legend>${'\u201c' + cut(panePlain(x), 220) + '\u201d'}</legend>
            <label><input type="radio" name=${nm} value="del" checked=${offer.picks[k] === 'del'} onChange=${() => pick(k, 'del')} />Delete the sentence</label>
            <label><input type="radio" name=${nm} value="keep" checked=${offer.picks[k] === 'keep'} onChange=${() => pick(k, 'keep')} />Keep it without the source</label></fieldset>`; })}</div>`)}
        <div class="den-form"><button type="button" class="den-mini primary" disabled=${!all || !!busy} onClick=${() => runOut(r, scope, offer.picks)}>${scope === 'report' ? 'Take it out of this report' : 'Take it out of this section'}</button><button type="button" class="den-mini" onClick=${closeOffer}>Cancel</button></div></div>`; };
    const card = (r, list) => { const { id, c, e } = r; const ik = KIND[c ? c.kind : e ? e.k : ''] || (e && e.k === 'added' ? (e.platform ? 'social' : 'media') : '');
      const sd = paneSays(c, e); const t = sd.t || id; const url = c ? c.url : e ? e.url : ''; const num = ix.nums[id] || 0; const by = (L.citedBy[id] || []).length; const meta = paneMeta(c, e, day);
      const canUse = can && !!id; const who = c && c.pinned ? (c.r || {}).pinned_by || '' : ''; const p = prov(r); const b = !!busy;
      const acts = drawer ? (canUse ? html`<button type="button" class="den-mini row den-usehere" data-use=${id} disabled=${b} aria-label=${'Use here: ' + t.slice(0, 80)} onMouseDown=${x => x.preventDefault()} onClick=${() => onCite(id)}>Use here</button>` : null) : !can ? null : list === 'used' ? html`<button type="button" class="den-mini row" disabled=${b} aria-expanded=${offer && offer.id === id && offer.scope === 'sec' ? 'true' : 'false'} aria-label=${'Not for this section: ' + t.slice(0, 80)} onClick=${x => askOut(r, 'sec', x)}>Not for this section</button><button type="button" class="den-mini row quiet" disabled=${b} aria-expanded=${offer && offer.id === id && offer.scope === 'report' ? 'true' : 'false'} aria-label=${'Not for this report: ' + t.slice(0, 80)} onClick=${x => askOut(r, 'report', x)}>Not for this report</button>${e && e.k === 'added' && !by ? html`<button type="button" class="den-mini row quiet" disabled=${b} aria-label=${'Remove this source from the report: ' + t.slice(0, 80)} onClick=${() => dropSource(r)}>Remove this source</button>` : null}`
        : list === 'marked' ? html`<button type="button" class="den-mini row" disabled=${b} aria-label=${'Remove the number: ' + t.slice(0, 80)} onClick=${() => strike(r)}>Remove the number</button><button type="button" class="den-mini row quiet" disabled=${b} aria-label=${'Keep it: ' + t.slice(0, 80)} onClick=${() => pickOp(r, list, 'unremove', true)}>Keep it</button>`
        : list === 'removed' ? html`<button type="button" class="den-mini row" disabled=${b} aria-label=${'Put back: ' + t.slice(0, 80)} onClick=${() => pickOp(r, list, 'back', true)}>Put back</button>`
        : html`<button type="button" class="den-mini row" data-tour="pull-file" disabled=${b} aria-label=${'Add to this section: ' + t.slice(0, 80)} onClick=${() => pickOp(r, list, 'add', true)}>Add to this section</button>`;
      return html`<li key=${list + id} class=${'den-evitem' + (num ? ' here' : '')} data-cite=${id} data-list=${list} data-kind=${ik || null} data-filed=${filedState(r, ik)} data-busy=${busy === id ? '1' : null} tabIndex="-1">
        <button type="button" class=${'den-evcard' + (by ? ' cited' : '')} data-tour="ev-card" data-cited=${by} disabled=${!canUse} tabIndex=${drawer ? '-1' : null} aria-label=${(canUse ? 'Use here, ' : 'Source ') + id + ': ' + t.slice(0, 100)}
          title=${canUse ? 'Put its number where your cursor is in ' + sec.title : t.slice(0, 140)} onMouseDown=${x => x.preventDefault()} onClick=${() => onCite(id)} onKeyDown=${escToText}>
          <span class="den-evtop">${num ? html`<span class="den-evnum" title=${'Source ' + num + ' in this section'}>${num}</span>` : null}<span class="den-evsrc">${Ic(ik || 'info')}<span>${paneSrc(c, e)}</span></span>
            ${!e ? html`<span class="den-tag" title="Collected after the report was written: saving it with its number adds it to the report's sources">new since it was written</span>` : null}${(c && c.r && c.r.named === 'auto') || (e && e.named === 'auto') ? html`<span class="den-tag" title="A working title the Den gave this narrative from its own stories and posts; nobody has named it yet">working title</span>` : null}
            ${c && c.pinned ? html`<span class="den-tag den-must">${'Must mention' + (who ? ' \u00b7 ' + who : '')}</span>` : null}
            ${!by ? null : num && by === 1 ? html`<span class="den-sr">Used here</span>` : html`<span class="den-chip pos" title=${'Used in ' + plural(by, 'section') + ' of this report'}>${num ? 'In ' + plural(by, 'section') : 'Used in ' + plural(by, 'section')}</span>`}${canUse && !drawer ? html`<span class="den-evhint" aria-hidden="true">${Ic('plus')}Use here</span>` : null}</span>
          <span class=${'den-t' + (sd.quiet ? ' quiet' : '')}>${t}</span>${meta ? html`<span class="den-sub">${meta}</span>` : null}${r.why ? html`<span class="den-why">${r.why}</span>` : null}${p ? html`<span class="den-evwho">${p}</span>` : null}</button>
        <div class="den-evact">${drawer ? acts : null}${web(url) ? html`<a class="den-link" href=${web(url)} target="_blank" rel="noopener" aria-label=${'View source: ' + t.slice(0, 80)}>${Ic('open')}View source</a>` : null}${drawer ? null : acts}</div>
        ${offer && offer.id === id && (list === 'used' || list === 'marked') ? offerBox(r) : null}${err && err.id === id ? html`<p class="den-evfail" role=${role('alert')}>${err.msg}</p>` : null}</li>`; };
    const findRow = r => { const c = r.c; const sub = paneMeta(c, null, day); return html`<li key=${r.id} data-cite=${r.id} data-list="find" data-kind=${KIND[c.kind] || null}><span class="den-w" title="Weight on the Board">${c.w ? c.w.score : ''}</span>
        <span class="den-pull-t"><span class="den-evsrc">${Ic(KIND[c.kind] || 'info')}<span>${paneSrc(c, null)}</span>${r.fresh ? html`<span class="den-tag">new since it was written</span>` : null}</span><span class="den-t">${c.title}</span>${sub ? html`<span class="den-sub">${sub}</span>` : null}</span>
        <span class="den-pull-act">${can ? html`<button type="button" class="den-mini row" disabled=${!!busy} aria-label=${'Use here: ' + cut(c.title, 80)} onMouseDown=${x => x.preventDefault()} onClick=${() => onCite(r.id)}>Use here</button>${drawer ? null : html`<button type="button" class="den-mini row" data-tour="pull-file" disabled=${!!busy} aria-label=${'Add to this section: ' + cut(c.title, 80)} onClick=${() => pickOp(r, 'find', 'add', false)}>Add to this section</button>`}` : null}${web(c.url) ? html`<a class="den-link" href=${web(c.url)} target="_blank" rel="noopener" aria-label=${'View source: ' + cut(c.title, 80)}>View source</a>` : null}</span>
        ${err && err.id === r.id ? html`<p class="den-evfail" role=${role('alert')}>${err.msg}</p>` : null}</li>`; };
    const nd = needle.trim().toLowerCase();
    const shown = (L.pool || []).filter(r => { const c = r.c; return (kind === 'all' || c.kind === kind) && (!onlyNew || r.fresh) && (!nd || (String(c.title || '') + ' ' + ((c.r || {}).outlet || '') + ' ' + ((c.r || {}).who || '') + ' ' + ((c.r || {}).what || '') + ' ' + ((c.r || {}).claim || '')).toLowerCase().indexOf(nd) >= 0); });
    const head = html`<div class=${'den-evhead sp' + (Math.max(0, others.indexOf(sec)) % 11)}><div class="den-evh1"><b>Sources</b><span class="den-count" title="Used in this section">${L.used.length}</span></div><span class="den-evfor">${sec.title}</span>
      <p>${ro ? (brief.status === 'filed' ? 'This report is sent; Change the sent report makes it editable again.' : 'View only: you can read the sources; changing them needs an edit key.') : !Object.keys(ev).length && !cards ? 'This report was started by hand, so it holds no sources yet. You can still write it and add a source by its link.' : 'Press a story or post to use it where your cursor is.'}<span class="den-sr"> Stories and posts added to a section are kept with the report, for everyone who works on it; narratives and dates on this computer only.</span></p>
      ${refusal ? html`<p class="den-evfail" role=${role('alert')}>${refusal}</p>` : null}${note ? html`<p class="den-panenote" role=${role('status')}>${note.msg}</p>` : null}</div>`;
    // the drawer draws no heading of its own (Today's drawer has one); what the pane says shows at its top
    const drawerSaid = refusal || note ? html`<div class="den-drawersaid">${refusal ? html`<p class="den-evfail">${refusal}</p>` : null}${note ? html`<p class="den-panenote">${note.msg}</p>` : null}</div>` : null;
    const sub = (t, n, extra) => html`<div class="den-evsub">${t}${n != null ? html` <span class="den-count">${n}</span>` : null}${extra || null}</div>`;
    const usedB = html`${sub('Used in this section', L.used.length)}${L.used.length ? html`<ul class="den-evlist" data-list="used">${L.used.map(r => card(r, 'used'))}</ul>` : html`<p class="den-quiet den-evnone">Nothing is used in this section yet. ${can ? 'Press a story or post below to use it where your cursor is, or add one to this section.' : 'Stories and posts this section uses appear here.'}</p>`}`;
    const markedB = !drawer && L.marked.length ? html`${sub('Used here, but marked not for this section', L.marked.length)}<ul class="den-evlist" data-list="marked">${L.marked.map(r => card(r, 'marked'))}</ul>` : null;
    const checksB = !drawer && L.checks.length ? html`${sub('Still to check in this section', L.checks.length)}<ul class="den-evlist">${L.checks.map(s => html`<li key=${s.key} class="den-uncheck" data-check=${s.key} tabIndex="-1"><span class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]}>${(SIG[s.sig] || [s.sig])[0]}</span><span class="den-t">${s.title}</span><span class="den-sub">${s.detail}</span></li>`)}</ul>` : null;
    const suggB = L.suggested.length ? html`${sub('Suggested', null)}<ul class="den-evlist" data-list="sugg">${L.suggested.map(r => card(r, 'sugg'))}</ul>` : null;
    const fresh = L.fresh || []; const freshB = fresh.length ? html`${sub('New since it was written', fresh.length)}<ul class="den-evlist" data-list="new">${(freshAll ? fresh : fresh.slice(0, 8)).map(r => card(r, 'new'))}</ul>${fresh.length > 8 ? html`<button type="button" class="den-link den-more" aria-expanded=${freshAll ? 'true' : 'false'} onClick=${() => setFreshAll(!freshAll)}>${freshAll ? 'Show fewer' : 'Show all ' + fresh.length}</button>` : null}` : null;
    const outB = !drawer && L.removed.length ? html`<div class="den-foldwrap den-out-fold"><button type="button" class="den-fold" aria-expanded=${outOpen ? 'true' : 'false'} onClick=${() => setOutOpen(!outOpen)}>${Ic(outOpen ? 'chev' : 'right')}<span>Taken out of this section</span> <span class="den-count">${L.removed.length}</span></button>${outOpen ? html`<ul class="den-evlist" data-list="removed">${L.removed.map(r => card(r, 'removed'))}</ul>` : null}</div>` : null;
    const findB = html`<div class="den-pull"><button type="button" class="den-fold" data-tour="pull" aria-expanded=${findOpen ? 'true' : 'false'} onClick=${() => setFindOpen(!findOpen)}>${Ic(findOpen ? 'chev' : 'right')}<span>Find a story or post</span>${L.pool ? html` <span class="den-count">${L.pool.length}</span>` : null}</button>
      ${!findOpen ? null : !L.pool ? html`<p class="den-quiet">Looking at today's stories and posts\u2026 They are read with the Board. <button type="button" class="den-link" onClick=${() => setTab('today')}>Open the Board</button></p>`
        : html`<div class="den-findbar"><label class="den-lab den-grow">Search<input type="search" value=${needle} placeholder="Words in a headline, an outlet or an account" onInput=${e => setNeedle(e.target.value)} /></label>
          <label class="den-lab">Kind<select value=${kind} onChange=${e => setKind(e.target.value)}><option value="all">All</option>${KINDS_ROW.filter(k => !drawer || PANE_STORY_C[k[0]]).map(k => html`<option key=${k[0]} value=${k[0]}>${k[1]}</option>`)}</select></label>
          <label class="den-checkline"><input type="checkbox" checked=${onlyNew} onChange=${e => setOnlyNew(e.target.checked)} />Only new since it was written</label></div>
          ${shown.length ? html`<ul class="den-pulllist">${shown.slice(0, 80).map(findRow)}</ul>${shown.length > 80 ? html`<p class="den-quiet">The first 80 of ${shown.length}: search to narrow them.</p>` : null}` : html`<p class="den-quiet">${L.pool.length ? 'Nothing matches.' : 'Every story and post of today is already in this section.'}</p>`}`}</div>`;
    const addB = !can ? null : html`<div class="den-foldwrap den-addsrc"><button type="button" class="den-fold" data-tour="add-source" aria-expanded=${addOpen ? 'true' : 'false'} onClick=${() => setAddOpen(!addOpen)}>${Ic(addOpen ? 'chev' : 'right')}<span>Add a new source (paste a link)</span></button>
      ${!addOpen ? null : html`<div class="den-addbox"><label class="den-lab">Links, one or more<textarea class="den-addta" rows="3" value=${addText} placeholder="https://..." onInput=${e => setAddText(e.target.value)}></textarea></label>
        ${parsed.ok.length ? html`<ul class="den-addlist">${parsed.ok.map(u => { const m = addMeta[u] || {}; const set = (k, v) => setAddMeta(o => Object.assign({}, o, { [u]: Object.assign({}, o[u], { [k]: v }) })); return html`<li key=${u}><span class="den-evsrc">${Ic(panePlatform(paneHost(u)) ? 'social' : 'media')}<span>${paneAddrLabel(u)}</span></span><span class="den-sub den-addurl">${u}</span>
          <span class="den-addf"><label class="den-lab">Day (optional)<input type="date" value=${m.date || ''} max=${String(day || '')} onInput=${e => set('date', e.target.value)} /></label><label class="den-lab den-grow">In your words (optional)<input value=${m.line || ''} maxlength="200" placeholder="One line on what it says" onInput=${e => set('line', e.target.value)} /></label></span></li>`; })}</ul>` : null}
        ${parsed.bad.length ? html`<p class="den-quiet">Not a link, so left out: ${parsed.bad.slice(0, 6).map(x => cut(x, 40)).join(', ')}${parsed.bad.length > 6 ? ' and ' + (parsed.bad.length - 6) + ' more' : ''}.</p>` : null}
        ${parsed.ok.length > roomFor ? html`<p class="den-evfail" role=${role('alert')}>A report holds at most 40 sources added by link; this one has ${hNow}, so ${roomFor ? 'only ' + roomFor + ' more can be added' : 'no more can be added'}.</p>` : null}
        <div class="den-form"><button type="button" class="den-mini primary" disabled=${!parsed.ok.length || parsed.ok.length > roomFor || !!busy} onClick=${addRun}>${busy === 'add' ? 'Adding\u2026' : parsed.ok.length > 1 ? 'Add ' + parsed.ok.length + ' sources to this section' : 'Add it to this section'}</button><span class="den-sub">Its platform is read from the link. It is saved with your words, and can be used in any section.</span></div>
        ${err && err.id === 'add' ? html`<p class="den-evfail" role=${role('alert')}>${err.msg}</p>` : null}</div>`}</div>`;
    return html`<div class="den-evin den-pane" ref=${root} data-room=${room || 'pane'}>${drawer ? html`${drawerSaid}${suggB}${usedB}${freshB}` : html`${head}${usedB}${markedB}${checksB}${suggB}${freshB}${outB}`}${findB}${addB}</div>`;
  }
  window.DenPane = { supported: paneSupport, lists: paneLists, land: paneLand, dropPreview: paneDropPreview, pending: panePending, citing: paneCiting, apply: paneApply, split: paneSplit, plain: panePlain, upId: paneUpId, addrs: paneAddrs, Pane: SourcesPane };
  function BriefPanel({ desk, day, past, tick, bump, budget, canWrite, setTab, cards, signals, filing, setFiling, openSec, setOpenSec, onState, layout, host }) {
    const wk = b => 'ax_den_work_' + b.id;
    // today's brief is the desk's latest; another day's is asked for by its day (GET /den/brief?day=), and is never drafted from here
    const L = useLoad(() => get('/den/brief?' + q({ desk: desk.id, day: past ? day : '' }), 'brief'), [desk.id, tick, day], desk.id + '|' + day);
    const [work, setWork] = useState(null);        // { id, revision, sections: {id: text}, ratings } - this person's unsaved words
    const [save, setSave] = useState({ s: 'idle', msg: '' }); const [busy, setBusy] = useState(''); const [t0, setT0] = useState(0); const [conflict, setConflict] = useState(null); const [ask, setAsk] = useState(null); const [restored, setRestored] = useState(false);
    const [hist, setHist] = useState(null); const [cmp, setCmp] = useState(null); const [dropped, setDropped] = useState(false); const [fail, setFail] = useState(null); const saving = useRef(false); const mine = useRef(0); const workRef = useRef(null); const inflight = useRef(null); const again = useRef(false); const saveRef = useRef(null);
    // p72 lane pane: the sources a save refused (409 cannot_cite: said, the words kept, the marks left as they were), what the
    // pane says after a save (not_kept), what a replace draft dropped of the corrections (review_dropped), the last save's answer
    const [refused, setRefused] = useState(null); const [paneSaid, setPaneSaid] = useState(null); const [dropNote, setDropNote] = useState(null); const lastRes = useRef(null);
    const brief = L.data ? L.data.brief : null; const left = budget ? budget.left : 1; const latest = useRef(null); latest.current = brief;   // latest: the brief as the last answer left it, for a correction that follows a save
    const texts = b => { const o = {}; desk.sections.forEach(s => { if (s.kind !== 'sources') o[s.id] = (b.sections[s.id] && b.sections[s.id].text) || ''; }); return o; };
    // open the brief: this person's unsaved words, if any were kept on this computer, come back over it
    useEffect(() => { workRef.current = work; }, [work]);
    useEffect(() => { if (!brief) { setWork(null); return; } if (mine.current === brief.revision) { mine.current = 0; return; }   // my own save: the editor was already brought up to it, words typed meanwhile included
      const kept = ls.get(wk(brief), null);
      if (kept && kept.sections && (kept.revision === brief.revision || Object.keys(kept.sections).some(k => kept.sections[k] !== ((brief.sections[k] || {}).text || '')) || (kept.ratings && JSON.stringify(kept.ratings) !== JSON.stringify(brief.ratings || {})))) { setWork({ id: brief.id, revision: kept.revision, sections: Object.assign(texts(brief), kept.sections), ratings: kept.ratings || brief.ratings }); setRestored(true); if (kept.revision !== brief.revision) setConflict({ theirs: brief }); }
      else { setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); } setHist(null); setCmp(null); }, [brief && brief.id, brief && brief.revision]);   // eslint-disable-line
    const dirtyIds = brief && work ? Object.keys(work.sections).filter(k => work.sections[k] !== ((brief.sections[k] || {}).text || '')) : []; const ratingsDirty = brief && work ? JSON.stringify(work.ratings || {}) !== JSON.stringify(brief.ratings || {}) : false; const dirty = dirtyIds.length > 0 || ratingsDirty;
    useEffect(() => { if (!brief || !work) return; if (dirty) ls.set(wk(brief), { revision: work.revision, sections: dirtyIds.reduce((a, k) => { a[k] = work.sections[k]; return a; }, {}), ratings: work.ratings, at: Date.now() }); else ls.del(wk(brief)); }, [work, brief && brief.revision]);   // eslint-disable-line
    useEffect(() => { const warn = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
    const change = (id, v) => { setWork(w => Object.assign({}, w, { sections: Object.assign({}, w.sections, { [id]: v }) })); setSave({ s: 'dirty', msg: '' }); };
    /* A save asked for while one is in flight is not dropped: the caller gets the in-flight save's answer, and the words
       typed meanwhile are saved as soon as it has answered (leaving the editor always saves). */
    const doSave = useCallback((over, extra) => { if (saving.current) { again.current = true; return inflight.current || Promise.resolve(false); }
      const p = doSave1(over, extra); inflight.current = p; return p; }, [brief, work, dirty, ratingsDirty, dirtyIds.join('|')]);   // eslint-disable-line
    saveRef.current = doSave;
    /* p72 lane pane: `extra` rides on the text save, so the brief's evidence and words keep one writer: sections a correction
       rewrote (already in the editor), nosource (Keep it without the source), sources (Add a new source) and sources_remove. */
    const doSave1 = async (over, extra) => { if (!brief || !work) return false; if (!dirty && !over && !extra) return true; saving.current = true; setSave({ s: 'saving', msg: '' }); lastRes.current = null;
      const sent = Object.assign(dirtyIds.reduce((a, k) => { a[k] = work.sections[k]; return a; }, {}), (extra && extra.sections) || {}); const sentRatings = JSON.stringify(work.ratings || {});
      const more1 = extra ? ['nosource', 'sources', 'sources_remove'].reduce((a, k) => { if (extra[k]) a[k] = extra[k]; return a; }, {}) : {};
      try { const d = await call('/den/brief/save', Object.assign({ id: brief.id, revision: over ? over.revision : work.revision, sections: sent, ratings: ratingsDirty ? work.ratings : undefined }, more1)); lastRes.current = { d };
        if (extra || refused) { setRefused(null); setPaneSaid(Array.isArray(d.not_kept) && d.not_kept.length ? d.not_kept.map(x => 'Not kept without its source, because the sentence no longer reads as it did: “' + cut(x.sentence, 140) + '”.').join(' ') + ' Nothing else changed.' : null); }
        // what was saved takes the server's words; what was typed in another section while this save was in flight stays in the editor, unsaved
        const now = workRef.current || work; const base = texts(d.brief); const next = Object.assign({}, base); let more = false;
        Object.keys(now.sections).forEach(k => { const was = (brief.sections[k] || {}).text || ''; if (now.sections[k] !== (k in sent ? sent[k] : was)) { next[k] = now.sections[k]; more = true; } });
        const ratings = JSON.stringify(now.ratings || {}) !== sentRatings ? now.ratings : d.brief.ratings; if (ratings !== d.brief.ratings) more = true;
        mine.current = d.brief.revision; latest.current = d.brief; setWork({ id: d.brief.id, revision: d.brief.revision, sections: next, ratings }); if (!more) ls.del(wk(brief));
        setConflict(null); setRestored(false); L.set({ ok: true, brief: d.brief }); setSave(more ? { s: 'dirty', msg: '' } : { s: 'saved', msg: 'revision ' + d.brief.revision }); saving.current = false; tell('save', { id: d.brief.id, revision: d.brief.revision });
        if (again.current) { again.current = false; if (more) setTimeout(() => { if (saveRef.current) saveRef.current(); }, 30); } return true; }
      catch (e) { saving.current = false; again.current = false; lastRes.current = { e }; if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); setSave({ s: 'bad', msg: 'Someone else changed this report first.' }); } else setSave({ s: 'bad', msg: say(e) });
        // p72 (409 cannot_cite): a source this report cannot use is said in words, the person's text is kept as it is (the mark
        // is not struck), and the chip of each refused id shows as unknown until the words change
        if (e.code === 'cannot_cite') { const ids = (e.body && Array.isArray(e.body.ids) ? e.body.ids : []).map(String); setRefused({ ids, msg: 'Not saved: ' + (ids.length === 1 ? 'one source' : ids.length + ' sources') + ' can\'t be used in this report (' + ids.join(', ') + '). ' + say(e) + ' Your words are kept on this computer.' }); }
        return false; } };
    useEffect(() => { const key = e => { if ((e.metaKey || e.ctrlKey) && e.key === 's' && brief && work) { e.preventDefault(); doSave(); } }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [doSave]);   // eslint-disable-line
    const keepMine = () => { const t = conflict.theirs; const kept = ls.get(wk(t), null); if (kept) ls.set(wk(t), Object.assign({}, kept, { revision: t.revision })); setWork(w => Object.assign({}, w, { revision: t.revision })); L.set({ ok: true, brief: t }); setConflict(null); setSave({ s: 'dirty', msg: 'Your words are kept. Save to put them over theirs.' }); };
    const takeTheirs = () => { const t = conflict.theirs; ls.del(wk(t)); L.set({ ok: true, brief: t }); setWork({ id: t.id, revision: t.revision, sections: texts(t), ratings: t.ratings }); setConflict(null); setRestored(false); setSave({ s: 'idle', msg: '' }); };
    // a failed draft or rewrite stays said on the page (a toast is gone in three seconds); a dropped connection has its own note.
    // worker p71 (ST2): a draft whose day gained a brief while it was written (an edit, a filing, another draft) is not saved
    // over it, and the brief that is there comes back with the refusal: it is shown at once, and the note says what happened
    // (review C4: the page said no draft was written and nothing here changed, and kept the old view until a reload)
    const guard = async (name, fn) => { if (busy) return; setBusy(name); setT0(Date.now()); setDropped(false); setFail(null); try { await fn(); } catch (e) { if (!e.code && !e.status) setDropped(true); else if (e.code === 'conflict' && e.body && e.body.brief) { setConflict({ theirs: e.body.brief }); toastMsg('Someone else changed this report first.', true); }
      else if (e.code === 'brief_changed') { const t = e.body && e.body.brief; if (t) L.set({ ok: true, brief: t }); else L.reload(); toastMsg('The new version was not saved: someone changed this report while it was being written.', true); setFail({ what: 'changed', msg: say(e), shown: !!t }); }
      else { toastMsg(say(e), true); if (name === 'draft' || name === 'section') setFail({ what: name, msg: say(e) }); } } setBusy(''); bump('budget'); };
    const draft = replace => guard('draft', async () => { const d = await call('/den/brief', { desk: desk.id, replace: !!replace }); L.set({ ok: true, brief: d.brief }); tell('draft', { id: d.brief.id, replace: !!replace });
      setDropNote(replace && Array.isArray(d.review_dropped) && d.review_dropped.length ? d.review_dropped : null); /* p72: what the rewrite dropped of the corrections, said */ toastMsg('Drafted from ' + Object.keys(d.brief.evidence).length + ' rows of evidence' + ((d.dropped || []).length ? '; ' + d.dropped.length + ' citation' + (d.dropped.length === 1 ? ' the evidence never gave was removed' : 's the evidence never gave were removed') : '')); });
    const regen = (section, instruction, force) => guard('section', async () => { const d = await call('/den/brief/section', { id: brief.id, section, revision: brief.revision, instruction, force: !!force }); L.set({ ok: true, brief: d.brief }); tell('regen', { id: d.brief.id, section }); toastMsg('Section rewritten'); });
    /* Filing asks the worker once. Its list of what the brief does not cover is checks only: a collection gap is the
       Collection tab's (owner's instruction, item a), so a worker that still lists gaps (p66) has them dropped here, and a
       list that held nothing else is acknowledged at once, without a dialog; the worker still records the gap keys. */
    const file = ack => guard('file', async () => { const send = a => call('/den/brief/file', { id: brief.id, revision: brief.revision, acknowledge: !!a }); let d, acked = !!ack;
      try { d = await send(ack); } catch (e) { if (e.code !== 'uncited_signals') throw e; const open = ((e.body && e.body.signals) || []).filter(s => s && s.sig !== 'gap');
        // p72 (worker): checks a person left out come back in their own left group, not in signals; the dialog still asks (spec v3 rule 3; D2 is Today's only)
        const leftG = ((e.body && e.body.left) || []).filter(x => x && !/^G:/.test(String(x.key))); if (open.length || leftG.length) { setAsk(Object.assign({}, e.body, { signals: open, left: leftG })); return; } d = await send(true); acked = true; }
      setAsk(null); L.set({ ok: true, brief: d.brief }); setSave({ s: 'idle', msg: '' }); tell('filed', { id: d.brief.id, acknowledged: acked }); if (window.DenFlags && window.DenFlags.sent) window.DenFlags.sent(); toastMsg('Sent at ' + hm(d.brief.filed_at) + (d.brief.filed_by ? ' by ' + d.brief.filed_by : '')); bump('filed'); });
    const reopen = () => guard('file', async () => { const d = await call('/den/brief/file', { id: brief.id, reopen: true }); L.set({ ok: true, brief: d.brief }); tell('reopen', { id: d.brief.id }); toastMsg('You can change it again. Mark it as sent when you\'re done.'); });
    /* p72 lane pane: the corrections beside the text. POST /den/brief/review answers the review alone (no brief): it is put on
       the brief as it stands, which leaves the text, its revision and the unsaved words alone; den:review tells the other parts
       (P2's flags read review.marks from the brief). Throws in words; nothing here changes when it fails. */
    const review = async ops => { if (!brief) throw new Error('The report is not loaded.'); const id = brief.id;
      const d = await call('/den/brief/review', { id, ops }); if (!d || !d.review || typeof d.review !== 'object') { const e = new Error('AXIOM sent something this page can\'t read, so the correction may not have been kept. Nothing else changed.'); e.code = 'bad_answer'; throw e; }
      const cur = latest.current; if (cur && cur.id === id) { const nb = Object.assign({}, cur, { review: d.review, review_rev: d.review_rev }); latest.current = nb; L.set({ ok: true, brief: nb }); }
      tell('review', { id, ops: ops.map(o => o.op), review_rev: d.review_rev }); try { window.dispatchEvent(new CustomEvent('den:review', { detail: { id, review: d.review, review_rev: d.review_rev, ops } })); } catch (e) {} return d; };
    /* A save that carries a correction: the sections it rewrote are put in the editor first (so the save's own answer keeps
       them), sent with whatever else is unsaved; when the save fails those sections go back to the words they had, so a
       correction is never half made. Answers { ok, d } or { ok: false, e }. */
    const saveWith = async extra => { if (saving.current && inflight.current) { try { await inflight.current; } catch (e) {} await new Promise(r => setTimeout(r, 30)); }
      const base = workRef.current || work; if (!base) return { ok: false, e: new Error('The report is not loaded.') }; const was = {};
      if (extra && extra.sections) { Object.keys(extra.sections).forEach(k => { was[k] = base.sections[k]; }); const nw = Object.assign({}, base, { sections: Object.assign({}, base.sections, extra.sections) }); workRef.current = nw; setWork(nw); }
      const okd = await (saveRef.current || doSave)(undefined, extra || {}); const r = lastRes.current;
      if (okd && r && r.d) return { ok: true, d: r.d };
      if (Object.keys(was).length) { const cur = workRef.current || base; const back = Object.assign({}, cur, { sections: Object.assign({}, cur.sections, was) }); workRef.current = back; setWork(back); }
      return { ok: false, e: (r && r.e) || new Error(okd ? 'Another save was still being made: try again.' : 'The report could not be saved.') }; };
    // Not for this section, for a card added to the section on the Board: the Board's own route, with no section (it stays pinned)
    const unfileCard = async c => { await call('/den/pin', { desk: desk.id, item: c.id, section: '' }); const m = Object.assign({}, fref.current); delete m[c.key]; setFiling(m); tell('file', { key: c.key, sec: '', desk: desk.id, via: 'pane' }); };
    const start = () => guard('hand', async () => { const d = await call('/den/brief/save', { desk: desk.id }); L.set({ ok: true, brief: d.brief }); tell('start', { id: d.brief.id }); });
    const fname = ext => (desk.id + '-' + brief.day + (brief.status === 'filed' ? '' : '-draft') + '.' + ext);
    const download = async fmt => { try { const t = await getText('/den/brief?' + q({ id: brief.id, format: fmt })); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: fmt === 'html' ? 'text/html' : 'text/markdown' })); a.download = fname(fmt); document.body.appendChild(a); a.click(); a.remove(); tell('download', { fmt }); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (e) { toastMsg(say(e), true); } };
    /* p72 lane P5 (UX-SPEC s.6.3): Copy for Google Docs pastes no DRAFT line in the workbench either: nodraft=1 asks the worker
       for none, and a worker before p72 ignores it, so the marker is taken out here too (as docs/den-today.js does). Downloads keep it. */
    const copy = async fmt => { try { const rich = fmt === 'rich'; const raw = await getText('/den/brief?' + q(rich ? { id: brief.id, format: 'html', nodraft: 1 } : { id: brief.id, format: 'slack' }));
        const t = rich ? String(raw || '').replace(/<p class="draft">[\s\S]*?<\/p>/gi, '').replace(/( - DRAFT)(<\/title>)/i, '$2') : raw; const plain = () => denDocPlain(t).split('\n').filter(l => l.trim() !== 'DRAFT').join('\n').replace(/\n{3,}/g, '\n\n');
        const where = ' Paste it into today\'s tab of the ' + desk.name + ' report.';
        if (rich && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) { const body = (/<body[^>]*>([\s\S]*?)<\/body>/i.exec(t) || [0, t])[1];
          await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob([plain()], { type: 'text/plain' }) })]); toastMsg('Copied at ' + hm(Date.now()) + '.' + where); }
        else { await navigator.clipboard.writeText(rich ? plain() : t); toastMsg(rich ? 'Copied at ' + hm(Date.now()) + ' as plain text (this browser can\'t copy formatted text).' + where : 'Slack summary copied'); } tell('copy', { fmt, nodraft: rich || undefined }); } catch (e) { toastMsg('Could not copy: ' + say(e), true); } };
    const loadHist = async () => { if (hist) return setHist(null); try { setHist((await call('/den/brief/history?' + q({ id: brief.id }))).revisions || []); } catch (e) { toastMsg(say(e), true); } };
    const compare = async () => { if (cmp) return setCmp(null); try { const d = await call('/den/brief?' + q({ desk: desk.id, prev: 1, day: brief.day })); setCmp(d.brief ? d.brief : { none: true }); } catch (e) { toastMsg(say(e), true); } };

    const carets = useRef({}); const wrap = useRef(null); const [menu, setMenu] = useState(false); const [pull, setPull] = useState(false);
    /* The history and comparison drawer: its Close takes the focus when it opens, Escape closes it, and the focus goes
       back to the button that opened it (History or Compare). */
    const drawerOpen = !!(hist || cmp); const drawerFrom = useRef(null);
    useEffect(() => { const w = wrap.current; if (!w) return;
      if (drawerOpen) { if (!drawerFrom.current) drawerFrom.current = document.activeElement; requestAnimationFrame(() => { const b = w.querySelector('.den-drawer button'); if (b) b.focus(); });
        const key = e => { if (e.key === 'Escape' && !e.defaultPrevented) { e.preventDefault(); setHist(null); setCmp(null); } }; document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key); }
      const back = drawerFrom.current; drawerFrom.current = null; if (back && back.isConnected && (!document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected)) back.focus(); }, [drawerOpen]);   // eslint-disable-line
    const fref = useRef(filing); fref.current = filing;   // the filing as it is when a write has answered, not as the render that started the click saw it
    // the Board's columns and the rail read the brief as it stands in the editor
    useEffect(() => { if (onState) onState({ brief: brief || null, texts: work && brief && work.id === brief.id ? work.sections : null }); }, [brief, work]);   // eslint-disable-line
    useEffect(() => { if (!menu) return; const out = e => { if (!e.target.closest || !e.target.closest('.den-menu')) setMenu(false); }; const key = e => { if (e.key === 'Escape') setMenu(false); };
      document.addEventListener('mousedown', out); document.addEventListener('keydown', key); return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); }; }, [menu]);
    // p72 lane P3: on Today, Check before you send lands in Today's document, edits there and speaks through the room's one polite region (o.root, o.open, o.edit, o.say)
    // p72 review U7, U13: its failures through the room's one alert region; why the alerts couldn't be read, and Try again
    const tref = useRef({}); const todayO = layout === 'today' ? { layout: 'today', root: () => (tref.current.root ? tref.current.root() : null), open: sec => { if (tref.current.open) tref.current.open(sec); }, edit: (sec, a, z, then) => { if (tref.current.edit) tref.current.edit(sec, a, z, then); }, say: t => { if (tref.current.say) tref.current.say(t); },
      alert: t => { if (tref.current.alert) tref.current.alert(t); }, alertsWhy: (host && host.alertsWhy) || '', alertsRetry: host && host.retryAlerts ? host.retryAlerts : null } : {};
    // p72 (lane P2, docs/den-flags.js): Check before you send, its one count and its fixes; off (FL.on false) under a worker that serves no review and flags (spec rule 9)
    const FL = window.DenFlags && window.DenFlags.useBrief ? window.DenFlags.useBrief({ L, brief, work, desk, signals: signals === false ? false : signals ? signals.filter(s => s && s.sig !== 'gap') : null, alerts: signals === false ? 'failed' : signals ? 'ok' : 'loading', cards, filing, secOf: (s, secs) => sigSec(s, cards, filing, secs),
      canWrite, past, dirty, revision: brief ? brief.revision : 0, change, saveRef, setOpenSec, carets, wrap, call, saveState: save, latest, ...todayO }) : null; const flOn = !!(FL && FL.on);
    /* p72 lane P3 (UX-SPEC s.14, "The one source of state"): the Today layout. One BriefPanel serves both rooms; on Today it hands
       its state and actions, as plain objects, to window.DenToday.Layout (docs/den-today.js) and draws nothing of its own. Every
       line below this branch is the Brief layout, unchanged. */
    if (layout === 'today' && window.DenToday && window.DenToday.Layout) return html`<${window.DenToday.Layout} host=${host || {}} tref=${tref}
      s=${{ L, brief, work, dirty, dirtyIds, save, conflict, restored, busy, t0, fail, dropped, refused, paneSaid, dropNote, hist, cmp, ask, budget, left, desk, day, past, tick, cards, signals, filing, canWrite, FL, flOn, carets }}
      a=${{ change, doSave, saveRef, saveWith, review, keepMine, takeTheirs, setWork, setRestored, setSave, setBusy, setT0, setFail, setDropped, setConflict, setHist, setCmp, setAsk, setDropNote, loadHist, compare, download, unfileCard, setOpenSec, setTab, bump, tell, call, getText, wk, texts, latest }} />`;

    if (L.loading && !L.data) return html`<${Loading} what="the brief" />`;
    if (L.err && !L.data) return html`<${Failed} what="The brief" err=${L.err} onRetry=${L.reload} />`;
    const cost = budget ? 'Uses 1 of today\'s ' + budget.cap + ' AI drafts (a second only if the first answer can\'t be read); ' + budget.left + ' left.' : 'Uses 1 AI draft (a second only if the first answer can\'t be read).';
    const droppedNote = dropped ? html`<div class="den-notice bad" role="alert">The connection dropped while it was being written. It may still finish: nothing here was lost. <div><button class="den-mini primary" onClick=${() => { setDropped(false); L.reload(); }}>Check again</button></div></div>` : null;
    const failNote = fail ? html`<div class="den-notice bad den-fail" role="alert"><b>${fail.what === 'changed' ? 'Someone changed this report while it was being written, so the new version wasn\'t saved.' : fail.what === 'draft' ? 'Couldn\'t be written:' : 'This section couldn\'t be rewritten:'}</b> ${fail.what === 'changed' ? '' : fail.msg} ${fail.what === 'changed' ? (fail.shown ? 'Theirs is shown.' : '') : 'Nothing that was already here changed.'}${fail.what === 'draft' && !brief && canWrite ? null : html`<div><button class="den-mini quiet" onClick=${() => setFail(null)}>Close this note</button></div>`}</div>` : null;
    const progress = busy === 'draft' || busy === 'section' ? html`<div class="den-progress" data-tour="progress" role="status"><span class="den-spin" aria-hidden="true"></span><span><b>${busy === 'draft' ? 'Being written' : 'This section is being rewritten'}</b>, started at ${hm(t0)} (<${Elapsed} from=${t0} /><span aria-hidden="true"> so far</span>). It uses 1 AI draft and usually takes a minute or two. Nothing else is locked: the Board and the other tabs stay usable.</span></div>` : null;
    if (!brief && past) return html`<div class="den-briefwrap den-page">${droppedNote}<${Panel} title=${'The brief for ' + dayWords(day) + ' - ' + desk.name}>
      <${Empty}><b>No brief was written for ${dayWords(day)}.</b> A brief is drafted for today's window only; press Today in the top bar to draft one. Nothing was spent reading this day.<//><//></div>`;
    if (!brief) return html`<div class="den-briefwrap den-page">${droppedNote}${failNote}<${Panel} title=${'Today\'s brief - ' + desk.name}>
      <${Empty} tour="brief-empty"><b>Not written yet.</b> It is written from the cards on the Board, every sentence tied to the card it rests on; mark the cards it must mention first.${cards ? ' The Board holds ' + plural(cards.length, 'card') + ' now, ' + cards.filter(c => c.pinned).length + ' marked must mention.' : ''}
        ${canWrite ? html`<div class="den-mt"><button class="den-mini primary" data-tour="draft" data-paid="1" disabled=${!!busy || !left} onClick=${() => draft(false)}>${busy === 'draft' ? 'Being written (a minute or two)\u2026' : fail && fail.what === 'draft' ? 'Try again' : 'Write it now'}</button> <button class="den-mini" data-tour="by-hand" disabled=${!!busy} onClick=${start}>Write it myself</button><span class="den-sub">${left ? 'Takes a minute or two \u00b7 ' + (budget ? 'uses 1 of today\'s ' + budget.cap + ' AI drafts' : 'uses 1 AI draft') : 'Today\'s ' + (budget ? budget.cap + ' ' : '') + 'AI drafts are used; they come back at midnight (Sydney). You can still write it yourself.'}</span></div>` : html`<div class="den-mt">Your key is read-only: drafting and writing need a full key.</div>`}<//>
      ${progress}<//></div>`;
    const filed = brief.status === 'filed'; const ro = !canWrite || filed; const ev = brief.evidence || {};
    // p72 lane pane: on only when the view carries review and flags (spec v3 rule 9); then a citation of a Board card the
    // evidence does not hold yet reads as that card until the save answers (evx), and the pane is the Sources pane
    const support = paneSupport(brief); const evx = support ? panePending(ev, cards, work && work.id === brief.id ? work.sections : null, refused ? refused.ids : null) : ev;
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
    // a section's sources: the cards filed under it and the rows its words cite that the evidence holds, each once
    const srcCount = sid => { const set = new Set(filedHere(sid).map(k => { const c = cardBy[k]; return (c && citeOf(c, ev)) || k; })); (T(sid).match(/\[[A-Z]:[A-Za-z0-9_.-]{1,40}\]/g) || []).forEach(m => { const id = m.slice(1, -1); if (ev[id]) set.add(id); }); return set.size; };
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
      return e.k === 'media' ? (l.split(' - ')[0] || 'News') : e.k === 'social' || e.k === 'actor' ? citeLabel('', e) : e.k === 'narrative' ? 'Narrative' : e.k === 'tone' ? 'Tone' : e.k === 'measure' ? 'Figure' : e.k === 'alert' ? 'Sentinel alert' : e.k === 'memory' ? 'Agency memory' : e.k === 'upcoming' ? 'Date' : 'Evidence'; };
    const sayOf = (c, e) => { if (c && c.title) return { t: String(c.title) }; if (!e) return { t: c ? String(c.label || '') : '' }; if (e.text) return { t: String(e.text) }; const l = String(e.label || '');
      if (e.k === 'media') return { t: l.split(' - ').slice(1).join(' - ') || l }; if (e.k === 'narrative') return { t: NAMELESS.test(l) ? 'A narrative the Den has not named yet' : l };
      if (e.k === 'upcoming' || e.k === 'tone' || e.k === 'measure' || e.k === 'alert' || e.k === 'memory') return { t: l }; return { t: 'Its words were not kept with this report. View source to read it.', quiet: true }; };
    // p71 fx3 (G3, C8): a story dated by its address (or stale) says its day here as on its Board card, in its line's
    // words, never "3 h ago" from a stamp that was never its time
    const metaOf = (c, e) => { if (c) { const r = c.r || {}; const bits = c.kind === 'media' ? [c.outlets > 1 ? c.outlets + ' outlets' : '', c.reach ? fmtN(c.reach) + ' on Facebook' : ''] : c.kind === 'social' || c.kind === 'actors' ? [c.reach ? fmtN(c.reach) + ' interactions' : ''] : c.kind === 'narratives' ? [r.n ? plural(r.n, 'row') : '', r.n24 ? r.n24 + ' in the last day' : '', r.status || ''] : [r.date || ''];
        if (c.kind === 'media' && addrDated(r)) bits.push(addrDay(r, String(day || '').slice(0, 4))); else if (c.ts) bits.push(since(c.ts)); return bits.filter(Boolean).join(' \u00b7 '); } return e ? String(e.sub || (e.gated ? 'Subscriber story: quoted at most thirty words' : '')) : ''; };
    const auto = (c, e) => (c && c.r && c.r.named === 'auto') || (e && e.named === 'auto');
    const openIx = onSrc ? { nums: {} } : citeIndex(T(openS.id), evx);
    /* The shared cover rule (spec v3 rule 3) is P2's DenFlags.covered(check, cites, covers, text) when that part is loaded and
       the view carries covers; else the rule the page has today (den.js covered()). Only the pane's Suggested and its list of
       what is still to check read it here. */
    const isCov = s => { const F = window.DenFlags; if (support && F && typeof F.covered === 'function') { try { const tx = others.map(x => T(x.id)).join('\n\n'); const cites = Array.from(new Set((tx.match(MARK) || []).map(m => m.slice(1, -1)))); return !!F.covered(s, cites, brief.covers || {}, tx); } catch (e) { /* the rule of today */ } }
      return covered(s, brief, work ? work.sections : null); };
    const evItem = (key, o) => { o = o || {}; const c = cardBy[key]; const cid = c ? citeOf(c, ev) : (ev[key] ? key : ''); const e = cid ? ev[cid] : null; const kind = KIND[c ? c.kind : e ? e.k : ''] || '';
      const sd = sayOf(c, e); const title = sd.t || key; const url = c ? c.url : e ? e.url : ''; const n = cid ? citedIn(cid) : 0; const num = cid ? openIx.nums[cid] : 0; const meta = metaOf(c, e);
      const st = !FILEABLE[kind] ? 'na' : o.here ? 'here' : visFiled(key) ? 'else' : 'none';
      return html`<li key=${key} class=${'den-evitem' + (num ? ' here' : '')} data-cite=${cid || null} data-ev=${key} data-kind=${kind || null} data-filed=${st} tabIndex="-1"><button type="button" class=${'den-evcard' + (n ? ' cited' : '')} data-tour="ev-card" data-cited=${n} disabled=${ro || !cid}
          aria-label=${(cid ? 'Cite ' + cid + ': ' : 'Cannot be cited in this brief: ') + title.slice(0, 100)} title=${cid ? (ro ? cid + ': ' + title.slice(0, 140) : 'Cite this where the cursor is in ' + openS.title + ' (' + cid + ')') : 'This brief\'s evidence does not hold this row: it was collected after the draft, or the brief was started by hand. Rewrite the whole report to cite it.'}
          onMouseDown=${x => x.preventDefault()} onClick=${() => cite(cid)}>
          <span class="den-evtop">${num ? html`<span class="den-evnum" title=${'Citation ' + num + ' in this section'}>${num}</span>` : null}<span class="den-evsrc">${Ic(kind || 'info')}<span>${srcOf(c, e)}</span></span>
            ${c && !cid ? html`<span class="den-tag" title="Collected after the brief was drafted, so the brief's evidence does not hold it">new since the draft</span>` : null}${auto(c, e) ? html`<span class="den-tag" title="A working title the Den gave this narrative from its own rows; nobody has named it yet">working title</span>` : null}${!n ? null : num && n === 1 ? html`<span class="den-sr">Cited</span>` : html`<span class="den-chip pos" title=${'Cited in ' + plural(n, 'section') + ' of this brief'}>${num ? 'In ' + plural(n, 'section') : 'Cited'}</span>`}${!ro && cid ? html`<span class="den-evhint" aria-hidden="true">${Ic('plus')}Cite here</span>` : null}</span>
          <span class=${'den-t' + (sd.quiet ? ' quiet' : '')}>${title}</span>${meta ? html`<span class="den-sub">${meta}</span>` : null}</button>
        <div class="den-evact">${web(url) ? html`<a class="den-link" href=${web(url)} target="_blank" rel="noopener" aria-label=${'View source: ' + title.slice(0, 80)}>${Ic('open')}View source</a>` : null}${o.extra || null}</div></li>`; };
    const here = onSrc ? [] : filedHere(openS.id); const hereIds = new Set(here.map(k => { const c = cardBy[k]; return c ? citeOf(c, ev) : k; }));
    const elsewhere = onSrc ? [] : openIx.ids.filter(id => !hereIds.has(id));
    const keyOfCite = id => { const c = (cards || []).find(x => citeOf(x, ev) === id); return c ? c.key : id; };
    const fileBtn = c => html`<button class="den-mini row" data-tour="pull-file" disabled=${filed} aria-label=${'Add to this section: ' + String(c.title || '').slice(0, 80)} title=${filed ? 'The report is sent: Change the sent report makes it editable again' : c.pin ? 'Pins it to the report and files it under this section, for everyone on the desk' : 'Files it under this section on this computer'} onClick=${() => fileHere(c)}>Add to this section</button>`;
    const pullList = cards ? cards.filter(c => !visFiled(c.key)).sort(byWeight) : null; const unHere = uncAll && !onSrc ? uncAll.filter(s => secOfSig(s) === openS.id) : [];
    const matched = s => desk.ratings.items.filter(i => i.id === s.id || i.id === s.kind); const loose = desk.ratings.items.filter(i => !others.some(s => i.id === s.id || i.id === s.kind));
    const rateBar = items => (items.length ? html`<div class="den-bar den-rate">${items.map(i => { const r = (work && work.ratings && work.ratings[i.id]) || {}; const set = (k, v) => { setWork(w => Object.assign({}, w, { ratings: Object.assign({}, w.ratings, { [i.id]: Object.assign({}, r, { [k]: v }) }) })); setSave({ s: 'dirty', msg: '' }); };
      return html`<span key=${i.id} class="den-form"><label class="den-lab">${i.label}<select value=${r.level || ''} disabled=${ro} data-rating=${i.id} onChange=${e => set('level', e.target.value)}><option value="">Not rated</option>${desk.ratings.levels.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>
        ${i.trend ? html`<label class="den-lab">Trend<select value=${r.trend || ''} disabled=${ro} aria-label=${i.label + ' trend'} onChange=${e => set('trend', e.target.value)}><option value="">-</option>${desk.ratings.trends.map(l => html`<option key=${l} value=${l}>${l}</option>`)}</select></label>` : null}</span>`; })}</div>` : null);
    /* The Source List section (p71, AEP B3): each entry carries the number the document's text gives it (i.n), written as text,
       "[7] Outlet - Headline, 16 November 2026 - address", one count across the groups; never an auto-numbered list, which
       started again at 1 in each group. A worker before p71 sends no number, and none is printed. */
    const nSources = brief.sourceList.reduce((a, g) => a + g.items.length, 0);
    /* The foot's chips are presses: what is left leads to where it is. A flag opens its section at the first flagged
       sentence; a check opens the section it belongs to, at the pane's list of checks not mentioned yet. */
    const land = (sel, what) => setTimeout(() => { const el = wrap.current && wrap.current.querySelector(sel); if (!el) return; try { el.scrollIntoView({ block: 'center' }); } catch (e) {} if (!(el.tabIndex >= 0)) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); el.classList.add('lit'); setTimeout(() => el.classList.remove('lit'), 1800); tell('foot', { what }); }, 60);
    const goFlag = () => { const s = others.find(x => ((brief.sections[x.id] || {}).uncited || []).length); if (!s) return; setOpenSec(s.id); land('.den-sec[data-section="' + s.id + '"] .den-flag', 'flags'); };
    const goCheck = () => { const s0 = (uncAll || [])[0]; if (!s0) return; const sid = secOfSig(s0); if (sid) { setOpenSec(sid); land('.den-evpane .den-uncheck', 'checks'); } else toastMsg('Not in the brief yet: ' + s0.title); };
    const acked = filed ? (brief.acknowledged || []).filter(k => !/^G:/.test(String(k && typeof k === 'object' ? k.key : k))) : [];   // p72: acknowledged are objects {key, how, at, fig}
    // p72 lane pane: a rewrite of the whole brief remaps the corrections beside the text; what it will drop is said before it is paid for
    const rvw = (support && brief.review) || {}; const reviewHeld = support && (Object.keys(rvw.picks || {}).length > 0 || Object.keys(rvw.marks || {}).length > 0);
    const dropPv = reviewHeld ? paneDropPreview(rvw, id => (others.find(s => s.id === id) || {}).title || id, id => paneIdName(id, ev, cards), k => { const f = (brief.flags || []).find(x => x.key === k); return f && f.sentence ? '\u201c' + cut(f.sentence, 80) + '\u201d' : ''; }) : null;
    const dropList = dropPv ? html`<div class="den-droppv" data-tour="redraft-drops"><p>You have corrections beside the text. Rewriting keeps what it can:</p>
      ${dropPv.drop.length ? html`<p><b>These will be dropped:</b></p><ul>${dropPv.drop.map((x, i) => html`<li key=${'d' + i}>${x.what} (${x.why})</li>`)}</ul>` : null}
      ${dropPv.maybe.length ? html`<p><b>These stay only if the new report still has the story, post or source:</b></p><ul>${dropPv.maybe.map((x, i) => html`<li key=${'m' + i}>${x.what}</li>`)}</ul>` : null}
      ${!dropPv.drop.length && !dropPv.maybe.length ? html`<p>Nothing will be dropped: the narratives and dates you chose, and the alerts you left out, stay.</p>` : null}</div>` : null;
    const openI = others.indexOf(openS);
    return html`<div class="den-briefwrap" ref=${wrap}>
      ${droppedNote}${failNote}
      ${dropNote ? html`<div class="den-notice den-dropnote" role="status"><b>The rewrite dropped ${dropNote.length === 1 ? 'one of your corrections' : dropNote.length + ' of your corrections'}:</b><ul>${dropNote.map((x, i) => html`<li key=${i}>${x.item ? ((others.find(s => s.id === x.sec) || {}).title || x.sec) + ': ' + paneIdName(x.item, ev, cards) : 'Left as it is in ' + ((others.find(s => s.id === x.sec) || {}).title || x.sec)}${x.why ? ' (' + x.why + ')' : ''}</li>`)}</ul><div><button class="den-mini quiet" onClick=${() => setDropNote(null)}>Close this note</button></div></div>` : null}
      ${restored && !conflict ? html`<div class="den-notice" role="status">Your unsaved words from ${since((ls.get(wk(brief), {}) || {}).at)} were kept on this computer and are back in the editor. <div><button class="den-mini primary" disabled=${ro} onClick=${() => doSave()}>Save them</button><button class="den-mini" onClick=${() => { ls.del(wk(brief)); setWork({ id: brief.id, revision: brief.revision, sections: texts(brief), ratings: brief.ratings }); setRestored(false); setSave({ s: 'idle', msg: '' }); }}>Discard them</button></div></div>` : null}
      ${conflict ? html`<div class="den-notice bad" role="alert"><b>${conflict.theirs.sections && Object.keys(conflict.theirs.sections).map(k => conflict.theirs.sections[k].by).filter(x => x && x !== 'model').pop() || 'Someone else'} changed this report after you opened it.</b> Your words are still here.
        <div><button class="den-mini primary" onClick=${keepMine}>Keep mine</button><button class="den-mini" onClick=${takeTheirs}>Use theirs</button></div><span class="den-sub">Keep mine keeps what you typed in the sections you changed; you then save it over theirs. Use theirs discards what you typed.</span></div>` : null}
      <section class="den-panel den-brief" aria-label=${desk.client + ' - ' + desk.name}>
        <header><h3>${desk.client + ' - ' + desk.name}</h3><span class="den-note">${'Reporting window: ' + (brief.window.label || brief.day)}</span><span class="den-spacer"></span><span class=${'den-chip ' + (filed ? 'pos' : 'warn')} data-tour="status" data-status=${brief.status}>${filed ? 'Sent' + (brief.filed_by ? ' by ' + brief.filed_by : '') + ', ' + hm(brief.filed_at) : 'Not sent yet'}</span><span class="den-mono">revision ${brief.revision}</span></header>
        ${filed ? html`<div class="den-filedband" role="status">${Ic('check')}<span><b>Sent at ${hm(brief.filed_at)}${brief.filed_by ? ' by ' + brief.filed_by : ''}.</b> It reads as it was sent; Change the sent report, in the foot, makes it editable again.</span><span class="den-spacer"></span>
          <button class="den-mini primary" onClick=${() => copy('rich')}>${Ic('copy')}Copy for Google Docs</button></div>` : null}
        ${rateBar(loose)}
        <div class=${'den-panes' + (flOn ? ' den-panes-fl' : '')} data-tour="panes">
          ${flOn ? html`<${window.DenFlags.Panel} h=${FL} />` : null}
          <nav class="den-outline" data-tour="outline" aria-label="Sections of the brief"><div class="den-outline-h"><b>Sections</b><span class="den-mono">${fmtN(total)} words</span></div>
            <ol>${others.map((s, i) => { const st = flOn ? FL.state(s.id, brief.sections[s.id], T(s.id), filedHere(s.id).length) : secState(brief.sections[s.id], T(s.id), filedHere(s.id).length); const un = uncAll && !flOn ? uncAll.filter(x => secOfSig(x) === s.id).length : 0; const fl = !flOn && st[1] === 'warn' ? +((String(st[0]).match(/\d+/) || [0])[0]) : 0;
              return html`<li key=${s.id}><button class=${'den-out sp' + (i % 11)} data-tour="outline-item" data-goto=${s.id} aria-current=${openS === s ? 'true' : null} onClick=${() => setOpenSec(s.id)}><span class="den-outn" aria-hidden="true">${i + 1}</span>
                <span class="den-out-t"><b>${s.title}</b><span class="den-out-m"><span class="den-mono">${wc(T(s.id))} words, ${plural(srcCount(s.id), 'source')}</span><span class=${'den-chip ' + st[1]}>${fl ? plural(fl, 'flag') : st[0]}</span></span></span>${un ? html`<span class="den-dot" title=${plural(un, 'check') + ' not in the brief yet'}><span class="den-sr">${plural(un, 'check')} not in the brief yet</span></span>` : null}</button></li>`; })}
              ${src ? html`<li><button class="den-out den-out-src" data-tour="outline-item" data-goto=${src.id} aria-current=${onSrc ? 'true' : null} onClick=${() => setOpenSec(src.id)}><span class="den-outn" aria-hidden="true">${Ic('file')}</span><span class="den-out-t"><b>${src.title}</b><span class="den-mono">${plural(nSources, 'source')}, built</span></span></button></li>` : null}</ol></nav>
          <div class="den-write"><div class="den-measure">
            ${progress}
            ${others.map((s, i) => html`<${Section} key=${s.id} s=${s} n=${i + 1} of=${others.length} sec=${brief.sections[s.id]} text=${T(s.id)} evidence=${evx} readOnly=${ro} onChange=${change} onBlur=${() => { if (dirty && !conflict) doSave(); }} onSave=${doSave} onRegen=${canWrite && !filed && !past ? regen : null} busy=${!!busy} left=${left} briefDirty=${dirty}
              hidden=${openS !== s} rate=${rateBar(matched(s))} carets=${carets} state=${flOn ? FL.state(s.id, brief.sections[s.id], T(s.id), filedHere(s.id).length) : secState(brief.sections[s.id], T(s.id), filedHere(s.id).length)} onStep=${step} onJump=${jump} fl=${flOn ? FL.inline(s.id) : null} />`)}
            ${src ? html`<div class="den-sec den-srcsec" data-tour="section" data-section=${src.id} hidden=${!onSrc}><div class="den-eyebrow"><span>Built, not written</span><span class="den-spacer"></span><button class="den-mini quiet den-step" onClick=${() => step(-1)}>${Ic('left')}Previous</button></div>
              <h4>${src.title}<span class="den-chip" title="Built from the rows the brief cites. It is never written by a model and cannot be edited: change what is cited instead.">built from the citations</span></h4>
              <div class="den-doc den-srcdoc">${brief.sourceList.length ? brief.sourceList.map(g => html`<div key=${g.group}><div class="den-mono den-grouph">${g.group}</div><ul class="den-ev den-srcl" style=${{ listStyle: 'none', paddingLeft: 0 }}>${g.items.map(i => html`<li key=${i.id} data-n=${i.n || null}>${i.n ? '[' + i.n + '] ' : ''}${i.label}${i.date ? ', ' + i.date : ''}${web(i.url) ? html` - <a class="den-link" href=${web(i.url)} target="_blank" rel="noopener">${i.url}</a>` : null}</li>`)}</ul></div>`) : html`<span class="den-mono">Nothing is cited yet, so there is nothing to list.</span>`}</div></div>` : null}
          </div></div>
          <aside class="den-evpane" data-tour="evidence" aria-label=${support && !onSrc ? 'Sources for this section' : 'Evidence for this section'}>
            ${support && !onSrc ? html`<${SourcesPane} brief=${brief} sec=${openS} others=${others} T=${T} cards=${cards} filing=${filing} sigs=${sigs} isCov=${isCov} ro=${ro} room="pane" day=${day} ix=${openIx} setTab=${setTab}
              onCite=${cite} review=${review} saveWith=${saveWith} unfile=${unfileCard} refusal=${refused ? refused.msg : paneSaid} />` : onSrc ? html`<div class="den-evhead"><div class="den-evh1"><b>Source List</b></div><p>Built from every row the brief cites, in the report's own groups. Cite a row in a section and it appears here; nothing is typed into it.</p></div>` : html`<div class="den-evin">
            <div class=${'den-evhead sp' + (openI % 11)}><div class="den-evh1"><b>Evidence</b>${here.length ? html`<span class="den-count" title="Cards filed under this section">${here.length}</span>` : null}</div><span class="den-evfor">${openS.title}</span>
              <p>${ro ? (filed ? 'This report is sent; Change the sent report makes it editable again.' : 'View only: this key reads the brief and does not change it.') : !Object.keys(ev).length ? 'This brief was started by hand, so its evidence holds no rows and cards cannot be cited in it yet. You can still write, save, export and file it.' : 'Click a card to cite it where your cursor is.'}<span class="den-sr"> Stories and posts filed here are kept with the desk, for everyone on it; narratives and dates on this computer only.</span></p></div>
            ${here.length ? html`<div class="den-evsub">Filed under this section</div><ul class="den-evlist">${here.map(k => evItem(k, { here: true, extra: canWrite && !filed ? html`<button class="den-link den-evx" aria-label=${'Remove from this section: ' + String((cardBy[k] || {}).title || k).slice(0, 80)} onClick=${() => unfileKey(k)}>Remove</button>` : null }))}</ul>` : null}
            ${elsewhere.length ? html`<div class="den-evsub">Cited here<span class="den-sr">, filed elsewhere</span> <span class="den-count">${elsewhere.length}</span></div><ul class="den-evlist">${elsewhere.map(id => { const k = keyOfCite(id); const c = cardBy[k]; const kind = KIND[c ? c.kind : (ev[id] || {}).k] || '';
                const f = visFiled(k) ? filing[k] : ''; return evItem(k, { extra: !FILEABLE[kind] ? null : f ? html`<span class="den-evstate">Filed under ${secTitle(f)}</span>` : (c && canWrite && !filed ? fileBtn(c) : null) }); })}</ul>` : null}
            ${!here.length && !elsewhere.length ? html`<p class="den-quiet den-evnone">Nothing is cited or filed here yet. ${ro ? 'Cards filed under this section on the Board appear here.' : 'Open More from this window below and file a card, or click a sentence and start writing.'}</p>` : null}
            ${unHere.length ? html`<div class="den-evsub">Checks this section does not mention yet</div><ul class="den-evlist">${unHere.map(s => html`<li key=${s.key} class="den-uncheck" data-check=${s.key}><span class=${'den-chip ' + (SIG[s.sig] || ['', ''])[1]}>${(SIG[s.sig] || [s.sig])[0]}</span><span class="den-t">${s.title}</span><span class="den-sub">${s.detail}</span></li>`)}</ul>` : null}
            <div class="den-pull"><button class="den-fold" data-tour="pull" aria-expanded=${pull ? 'true' : 'false'} onClick=${() => setPull(!pull)}>${Ic(pull ? 'chev' : 'right')}<span>More from this window</span>${pullList ? html` <span class="den-count">${pullList.length}</span>` : null}</button>
              ${!pull ? null : !pullList ? html`<p class="den-quiet">The window's rows are read with the Board. <button class="den-link" onClick=${() => setTab('today')}>Open the Board</button></p>`
                : pullList.length ? html`<ul class="den-pulllist">${pullList.slice(0, 80).map(c => html`<li key=${c.key}><span class="den-w" title="Weight on the Board">${c.w.score}</span><span class="den-pull-t"><span class="den-evsrc">${Ic(KIND[c.kind] || 'info')}<span>${srcOf(c, null)}</span></span><span class="den-t">${c.title}</span>${metaOf(c, null) ? html`<span class="den-sub">${metaOf(c, null)}</span>` : null}</span>
                  ${canWrite ? fileBtn(c) : null}</li>`)}</ul>`
                : html`<p class="den-quiet">Every card of the window is filed under a section.</p>`}</div></div>`}
          </aside>
          ${hist || cmp ? html`<div class="den-drawer-scrim" aria-hidden="true" onClick=${() => { setHist(null); setCmp(null); }}></div><aside class="den-drawer" data-tour="drawer" aria-label="Earlier versions and comparison">
        ${hist ? html`<${Panel} title="Earlier versions" note="The last 60 saves" flush=${true} actions=${html`<button class="den-mini quiet" aria-label="Close the earlier versions" onClick=${() => setHist(null)}>Close</button>`}>${hist.length ? html`<table class="den-table"><thead><tr><th class="num">Version</th><th>What</th><th>By</th><th>When</th></tr></thead><tbody>${hist.map((h, i) => html`<tr key=${i}><td class="num">${h.revision}</td><td>${String(h.note || '').replace(/; not read in this window: .*$/, '')}</td><td>${h.by}</td><td class="den-mono">${aest(h.at)}</td></tr>`)}</tbody></table>` : html`<${Empty}>No save is recorded yet.<//>`}<//>` : null}
        ${cmp ? html`<${Panel} title="Compare with the last sent report" note=${cmp.none ? '' : cmp.day + (cmp.filed_by ? ', sent by ' + cmp.filed_by : ', sent')} actions=${html`<button class="den-mini quiet" aria-label="Close the comparison" onClick=${() => setCmp(null)}>Close</button>`}>${cmp.none ? html`<${Empty}>No report was sent before this one, so there is nothing to compare with.<//>`
          : others.map(s => html`<div key=${s.id} class="den-cmp den-diff"><h4>${s.title}</h4><p>${diffWords((cmp.sections[s.id] || {}).text, (brief.sections[s.id] || {}).text).map((p, i) => p.t === 'ins' ? html`<ins key=${i}>${p.s}</ins>` : p.t === 'del' ? html`<del key=${i}>${p.s}</del>` : p.s)}</p></div>`)}<//>` : null}
      </aside>` : null}
        </div>
        <div class="den-foot">
          <div class="den-bar" role="status" aria-live="polite">
            <span data-tour="save-state" data-state=${save.s} data-dirty=${dirty ? '1' : '0'} class=${'den-save ' + (save.s === 'bad' ? 'bad' : dirty ? 'dirty' : save.s === 'saved' ? 'ok' : '')}>${save.s === 'saving' ? 'Saving\u2026' : save.s === 'bad' ? 'Not saved: ' + save.msg + ' Your words are kept on this computer.' : dirty ? 'Not saved yet (kept on this computer)' + (save.msg ? '. ' + save.msg : '') : filed ? 'Sent. Use Change the sent report to edit it.' : 'All changes saved'}</span>
            <span class="den-mono">${fmtN(total)} words</span>
            ${flags && !flOn ? html`<button type="button" class="den-chip warn den-chip-btn" data-tour="foot-flags" title="Sentences that rest on no evidence row. Press to go to the first, marked where it stands in its section." onClick=${goFlag}>${flags} need${flags === 1 ? 's' : ''} a source</button>` : null}
            ${filed && acked.length ? html`<span class="den-chip" title="Alerts the report didn't mention when it was sent; the person who sent it saw them and sent it anyway">${plural(acked.length, 'alert')} left out when sent</span>`
              : flOn ? html`<${window.DenFlags.Foot} h=${FL} />` : uncAll && !filed ? (uncAll.length ? html`<button type="button" class="den-chip den-chip-q den-chip-btn" data-tour="foot-checks" title=${'Checks on the rail the brief does not mention yet: ' + uncAll.map(s => s.title).join('; ') + '. Press to open the section the first belongs to.'} onClick=${goCheck}>${plural(uncAll.length, 'check') + ' not in the brief yet'}</button>`
                : html`<span class="den-chip pos" title="The brief mentions every check on the rail">all checks covered</span>`) : null}
          </div>
          <div class="den-foot-act">
            <button class="den-mini quiet" data-tour="history" aria-expanded=${hist ? 'true' : 'false'} onClick=${loadHist}>Earlier versions</button><button class="den-mini quiet" data-tour="compare" aria-expanded=${cmp ? 'true' : 'false'} aria-label="Compare with the last sent report" title="Compare with the last sent report" onClick=${compare}>Compare</button>
            <span class="den-menu"><button class="den-mini" data-tour="export" aria-expanded=${menu ? 'true' : 'false'} onClick=${() => setMenu(!menu)}>Export</button>
              ${menu ? html`<div class="den-menu-list" data-tour="export-menu" role="group" aria-label="Take it out"><span class="den-mono">Take it out${dirty ? ' (of the saved brief: save first to include your edits)' : ''}</span><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('rich'); }}>Copy for Google Docs</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('md'); }}>Download .md</button><button class="den-mini quiet" onClick=${() => { setMenu(false); download('html'); }}>Download .html</button><button class="den-mini quiet" onClick=${() => { setMenu(false); copy('slack'); }}>Copy the Slack summary</button></div>` : null}</span>
            ${canWrite && !filed && !past ? html`<button class="den-mini quiet" data-tour="draft-again" data-paid="1" disabled=${!!busy || !left || dirty} title=${dirty ? 'Save your edits first' : cost} onClick=${() => { if (Object.keys(brief.sections).some(k => brief.sections[k].edited) || reviewHeld) setAsk({ redraft: true }); else draft(true); }}>${busy === 'draft' ? 'Being written\u2026' : 'Rewrite the whole report\u2026'}</button>` : null}
            ${canWrite && !filed ? html`<button class="den-mini" data-tour="save" hidden=${!dirty} disabled=${!dirty || save.s === 'saving' || !!conflict} onClick=${() => doSave()}>Save changes</button>
              <button class="den-mini primary" data-tour="file" disabled=${!!busy || dirty} title=${dirty ? 'Save your edits first' : 'Records that this report went to the client. Nothing is emailed.'} onClick=${() => file(false)}>${busy === 'file' ? 'Marking as sent\u2026' : html`${Ic('file')}Mark as sent`}</button>` : null}
            ${canWrite && filed ? html`<button class="den-mini" data-tour="reopen" disabled=${!!busy} onClick=${reopen}>Change the sent report</button>` : null}
          </div>
        </div>
      </section>
      ${ask && ask.redraft ? html`<${Dialog} title="Rewrite the whole report?" onClose=${() => setAsk(null)}>${Object.keys(brief.sections).some(k => brief.sections[k].edited) ? html`<p>Some sections were changed by a person. Rewriting replaces the whole report, their words included. To keep them, rewrite single sections instead.</p>` : null}${reviewHeld ? dropList : null}<p class="den-mono">${cost}</p><div class="den-form"><button class="den-mini danger" data-paid="1" onClick=${() => { setAsk(null); draft(true); }}>Rewrite it all (uses 1 AI draft)</button><button class="den-mini" onClick=${() => setAsk(null)}>Keep this one</button></div><//>` : null}
      ${ask && ask.signals ? html`<${Dialog} title="Before you send" tour="file-dialog" onClose=${() => setAsk(null)}>${ask.signals.length ? html`<p data-open-n=${ask.signals.length}><b>${ask.signals.length === 1 ? '1 thing is' : ask.signals.length + ' things are'} still to check:</b></p>
        <ul class="den-ev">${ask.signals.map(s => html`<li key=${s.key}><b>${s.title}</b><br />${s.detail}</li>`)}</ul>` : null}
        ${(ask.left || []).length ? html`<p data-left-n=${ask.left.length}>${ask.left.length === 1 ? 'One alert was' : ask.left.length + ' alerts were'} left out on purpose:</p><ul class="den-ev den-leftg">${ask.left.map(x => html`<li key=${x.key} data-key=${x.key}><b>${x.title}</b><br />Left out by ${x.by || 'someone'}${x.at ? ', ' + aest(x.at) : ''}${x.note ? ': "' + x.note + '"' : ''}.${x.fig_then != null && JSON.stringify(x.fig_then) !== JSON.stringify(x.fig_now) ? html`<br /><span class="den-sub">When it was left out: ${typeof x.fig_then === 'object' ? Object.keys(x.fig_then).map(k => x.fig_then[k]).join(', ') : String(x.fig_then)}. Now: ${x.fig_now && typeof x.fig_now === 'object' ? Object.keys(x.fig_now).map(k => x.fig_now[k]).join(', ') : String(x.fig_now == null ? '' : x.fig_now)}.</span>` : null}</li>`)}</ul>` : null}
        <p class="den-mono">Sending anyway notes that you saw them and left them out.</p>
        <div class="den-form"><button class="den-mini primary" data-act="back" onClick=${() => setAsk(null)}>Go back to them</button><button class="den-mini" data-act="send" disabled=${!!busy} onClick=${() => file(true)}>Send anyway</button></div><//>` : null}
    </div>`;
  }

  return { BriefPanel };
};
