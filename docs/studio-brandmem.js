/* AXIOM Creative Studio - what the Studio keeps about a client's references (S23 slice I).
 *
 * A reference is more than its picture. Its record says whether it ran paid or organic, its format and channel, whether and
 * when it was approved and by whom, and what the team liked and disliked in it, each with its evidence; its campaign is its
 * own (a reference counted under a campaign only because its project is, is "scope uncertain" on the Brand workspace).
 * Its observations say what was seen in it and how much each item weighs: observed (seen in the image), inferred (a
 * conclusion the vision pass drew), preferred or mandatory (only a person says so, with the reason). A person corrects an
 * item (the vision pass's wording is kept beside it), retires and restores it, adds their own, confirms an inference, and
 * may promote an item to a standing rule of its campaign through Teach this brand, which previews first, refuses an
 * inference, and names other references of the campaign that say something different until that is resolved. What is
 * stored here reaches the models as part of the reference's line: retrieval memory, not training.
 * Loads after studio.js (window.STKit). */
(function () {
  'use strict';
  const K = window.STKit; if (!K || !window.React) return;
  const { html, Chip, canWrite } = K;
  const { useState, useEffect } = React;
  const AREAS = ['logo', 'url', 'typography', 'colour', 'spacing', 'composition', 'hierarchy', 'imagery', 'panels', 'words', 'takeaway', 'other'];
  const AREA_WORD = { logo: 'Mark', url: 'URL', typography: 'Typography', colour: 'Colour', spacing: 'Spacing', composition: 'Composition', hierarchy: 'Hierarchy', imagery: 'Imagery', panels: 'Panels', words: 'Words on it', takeaway: 'Lesson', other: 'Note' };
  const AUTH = ['observed', 'inferred', 'preferred', 'mandatory'];
  const AUTH_WORD = { observed: 'observed', inferred: 'inferred', preferred: 'preferred', mandatory: 'mandatory' };
  const AUTH_TITLE = { observed: 'seen in the image', inferred: 'a conclusion drawn from it, not a fact: confirm it before it can become a rule', preferred: 'the team prefers it; the plan may depart from it and says so', mandatory: 'the team requires it, with the reason recorded' };
  const AUTH_KIND = { observed: '', inferred: 'warn', preferred: 'ok', mandatory: 'ok' };
  const CONTEXTS = [['', 'not recorded'], ['paid', 'paid'], ['organic', 'organic'], ['both', 'paid and organic'], ['unknown', 'unknown']];
  const STATES = [['unknown', 'not recorded'], ['approved', 'approved'], ['pending', 'pending'], ['rejected', 'turned down']];
  const FORMATS = ['', '1:1', '4:5', '9:16', '16:9', '1.91:1'];
  const lines = a => (a || []).map(x => x.text + (x.evidence ? ' | ' + x.evidence : '')).join('\n');
  const unlines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean).map(x => { const i = x.indexOf('|'); return i >= 0 ? { text: x.slice(0, i).trim(), evidence: x.slice(i + 1).trim() } : { text: x }; }).filter(x => x.text);

  /** The record in one line of chips: where it ran, its shape, its approval, what the team said, and where its campaign comes from. */
  function RecordLine({ r, campaigns }) {
    const m = r.meta || {}; const ap = m.approval || null; const camp = (campaigns || []).find(c => c.id === r.campaign);
    const bits = [];
    if (m.context && m.context !== 'unknown') bits.push(html`<${Chip} key="c" title="where it ran">${m.context === 'both' ? 'paid and organic' : m.context}</${Chip}>`);
    if (m.format) bits.push(html`<${Chip} key="f" title="the format it was made in">${m.format}</${Chip}>`);
    if (m.channel) bits.push(html`<${Chip} key="ch" title="the channel it ran on">${m.channel}</${Chip}>`);
    if (ap && ap.state && ap.state !== 'unknown') bits.push(html`<${Chip} key="a" kind=${ap.state === 'approved' ? 'ok' : ap.state === 'rejected' ? 'bad' : 'warn'} title=${ap.evidence || 'approval as recorded by the team'}>${ap.state === 'rejected' ? 'turned down' : ap.state}${ap.date ? ' ' + ap.date : ''}${ap.by ? ' by ' + ap.by : ''}</${Chip}>`);
    return html`<div class="st-ref-rec" aria-label="The reference's record">
      ${bits.length ? bits : html`<span class="ov-dim">No record yet: where it ran, its approval and what the team thought of it are not written down.</span>`}
      ${r.campaign ? null : html` <${Chip} kind="warn" title="the reference carries no campaign of its own; with several identities on a client, say which it shows">no campaign</${Chip}>`}
      ${camp ? html` <span class="ov-dim">${camp.name}</span>` : null}
      ${(m.likes || []).length ? html`<div class="st-ref-said"><b>Liked</b> ${m.likes.map((x, i) => html`<span key=${i}>${i ? '; ' : ''}${x.text}${x.evidence ? html` <span class="ov-dim">(${x.evidence})</span>` : null}</span>`)}</div>` : null}
      ${(m.dislikes || []).length ? html`<div class="st-ref-said"><b>Disliked</b> ${m.dislikes.map((x, i) => html`<span key=${i}>${i ? '; ' : ''}${x.text}${x.evidence ? html` <span class="ov-dim">(${x.evidence})</span>` : null}</span>`)}</div>` : null}
    </div>`;
  }

  /** The form for the record. Likes and dislikes are one per line, with the evidence after a bar: "the bold band | Dee in Slack, 30 Sept". */
  function RecordEditor({ r, campaigns, busy, onSave, onCancel }) {
    const m = r.meta || {}; const ap = m.approval || {};
    const [f, setF] = useState(() => ({ context: m.context || '', format: m.format || '', channel: m.channel || '', state: ap.state || 'unknown', date: ap.date || '', by: ap.by || '', evidence: ap.evidence || '', likes: lines(m.likes), dislikes: lines(m.dislikes), campaign: r.campaign || '' }));
    const set = (k, v) => setF(Object.assign({}, f, { [k]: v }));
    const badDate = f.date && !/^\d{4}-\d{2}-\d{2}$/.test(f.date);
    const id = s => 'st-rr-' + r.id + '-' + s;
    const save = () => onSave(r.id, { context: f.context, format: f.format, channel: f.channel, approval: { state: f.state, date: f.date, by: f.by, evidence: f.evidence }, likes: unlines(f.likes), dislikes: unlines(f.dislikes), campaign: f.campaign });
    return html`<div class="st-ref-recedit" role="group" aria-label=${'Record of ' + r.name}>
      <div class="st-ref-recgrid">
        <label for=${id('camp')}><span class="st-lbl">Campaign</span><select id=${id('camp')} class="st-sel" value=${f.campaign} onChange=${e => set('campaign', e.target.value)}><option value="">none (client-wide)</option>${(campaigns || []).map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select></label>
        <label for=${id('ctx')}><span class="st-lbl">Ran</span><select id=${id('ctx')} class="st-sel" value=${f.context} onChange=${e => set('context', e.target.value)}>${CONTEXTS.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
        <label for=${id('fmt')}><span class="st-lbl">Format</span><select id=${id('fmt')} class="st-sel" value=${f.format} onChange=${e => set('format', e.target.value)}>${FORMATS.map(k => html`<option key=${k} value=${k}>${k || 'not recorded'}</option>`)}</select></label>
        <label for=${id('ch')}><span class="st-lbl">Channel</span><input id=${id('ch')} class="st-in" value=${f.channel} onInput=${e => set('channel', e.target.value)} placeholder="instagram, facebook, linkedin..." /></label>
        <label for=${id('st')}><span class="st-lbl">Approval</span><select id=${id('st')} class="st-sel" value=${f.state} onChange=${e => set('state', e.target.value)}>${STATES.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
        <label for=${id('dt')}><span class="st-lbl">On (YYYY-MM-DD)</span><input id=${id('dt')} class=${'st-in' + (badDate ? ' st-bad' : '')} value=${f.date} onInput=${e => set('date', e.target.value)} placeholder="2026-09-30" aria-invalid=${badDate ? 'true' : 'false'} /></label>
        <label for=${id('by')}><span class="st-lbl">By</span><input id=${id('by')} class="st-in" value=${f.by} onInput=${e => set('by', e.target.value)} placeholder="who approved it" /></label>
        <label for=${id('ev')}><span class="st-lbl">Where it was approved</span><input id=${id('ev')} class="st-in" value=${f.evidence} onInput=${e => set('evidence', e.target.value)} placeholder="the email, the thread, the meeting" /></label>
      </div>
      <label for=${id('lk')}><span class="st-lbl">Liked (one per line; evidence after a bar)</span><textarea id=${id('lk')} class="st-ta" rows="2" value=${f.likes} onInput=${e => set('likes', e.target.value)} placeholder="The bold yellow band | Dee in Slack, 30 Sept"></textarea></label>
      <label for=${id('dl')}><span class="st-lbl">Disliked (the models read these as things to avoid)</span><textarea id=${id('dl')} class="st-ta" rows="2" value=${f.dislikes} onInput=${e => set('dislikes', e.target.value)} placeholder="The URL too small to read | client feedback, round 2"></textarea></label>
      ${badDate ? html`<div class="st-err" role="alert">The date is written YYYY-MM-DD.</div>` : null}
      <div class="st-nd-row"><button class="btn sm" disabled=${!!busy || badDate} onClick=${save}>Save the record</button><button class="btn sm ghost" onClick=${onCancel}>Cancel</button></div>
    </div>`;
  }

  /** The observations: what was seen, what was concluded and what the team requires, each with its authority, source and status. */
  function Observations({ r, campaigns, busy, onObs, onTeach, ro: roIn }) {
    const ro = !!roIn || !canWrite();
    const obs = ((r.meta || {}).observations || []);
    const [edit, setEdit] = useState(null); const [text, setText] = useState(''); const [why, setWhy] = useState('');
    const [adding, setAdding] = useState(false); const [add, setAdd] = useState({ area: 'url', text: '', authority: 'observed', why: '' });
    const [teach, setTeach] = useState(null); const [showOld, setShowOld] = useState(false);
    useEffect(() => { setEdit(null); setTeach(null); }, [r.id]);
    const camp = (campaigns || []).find(c => c.id === r.campaign);
    const active = obs.filter(o => o.status === 'active'), promoted = obs.filter(o => o.status === 'promoted'), retired = obs.filter(o => o.status === 'retired');
    const act = async (o, body) => { const ok = await onObs(r.id, Object.assign({ obs: o ? o.id : undefined }, body)); if (ok) { setEdit(null); setText(''); setWhy(''); } return ok; };
    const ask = (q, d) => { const v = window.prompt(q, d || ''); return v == null ? null : v.trim(); };
    const startTeach = async o => {
      if (!r.campaign) { setTeach({ o, error: 'This reference carries no campaign of its own: set its campaign in the record first, so the rule is taught to the right identity.' }); return; }
      const res = await onTeach({ campaign: r.campaign, kind: 'rule', proposal: { observation: { ref: r.id, obs: o.id } } });
      setTeach(Object.assign({ o, resolve: '', reason: '' }, res));
    };
    const confirmTeach = async () => { const t = teach; if (!t.reason || t.reason.length < 4) return; const res = await onTeach({ campaign: r.campaign, kind: 'rule', proposal: { observation: { ref: r.id, obs: t.o.id }, resolve: t.resolve || undefined }, confirm: true, reason: t.reason }); if (res && res.written) setTeach(null); else setTeach(Object.assign({}, t, res)); };
    const row = o => html`<li key=${o.id} class=${'st-obs st-obs-' + o.status}>
      <span class="st-obs-area">${AREA_WORD[o.area] || o.area}</span>
      <span class="st-obs-text">${edit === o.id ? html`<input class="st-in" value=${text} onInput=${e => setText(e.target.value)} aria-label=${'Correct the ' + (AREA_WORD[o.area] || o.area).toLowerCase() + ' observation'} />` : o.text}
        ${o.was ? html`<span class="ov-dim st-obs-was">the vision pass said: ${o.was.text}</span>` : null}
        ${o.retired ? html`<span class="ov-dim st-obs-was">set aside: ${o.retired.why}</span>` : null}
        ${o.promoted ? html`<span class="ov-dim st-obs-was">became a ${camp ? camp.name : r.campaign} rule</span>` : null}
        ${edit === o.id ? html`<input class="st-in" value=${why} onInput=${e => setWhy(e.target.value)} placeholder="why (who said so, where)" aria-label="Why it is corrected" />` : null}</span>
      <span class="st-obs-meta"><${Chip} kind=${AUTH_KIND[o.authority]} title=${AUTH_TITLE[o.authority]}>${AUTH_WORD[o.authority]}</${Chip}> <span class="ov-dim">${o.source === 'team' ? 'the team' : 'vision pass'}</span></span>
      ${ro ? null : html`<span class="st-obs-acts">${o.status === 'active' ? (edit === o.id
        ? html`<button class="ov-link" disabled=${!!busy || !text.trim()} onClick=${() => act(o, { action: 'correct', text: text.trim(), why: why.trim() })}>save</button> <button class="ov-link" onClick=${() => setEdit(null)}>cancel</button>`
        : html`<button class="ov-link" onClick=${() => { setEdit(o.id); setText(o.text); setWhy(''); }}>correct</button>
          ${o.authority === 'inferred' ? html` <button class="ov-link" disabled=${!!busy} title="Confirm what the vision pass concluded: it becomes an observation, and may then be taught as a rule" onClick=${() => { const w = ask('Who confirmed it, and where? (an inference is confirmed only with a reason)'); if (w) act(o, { action: 'authority', authority: 'observed', why: w }); }}>confirm</button>` : null}
          <button class="ov-link" disabled=${!!busy} onClick=${() => { const w = ask('Why is it set aside? (kept, and restorable)'); if (w != null) act(o, { action: 'retire', why: w }); }}>retire</button>
          ${r.purpose === 'approved' || r.purpose === 'brand' ? html` <button class="ov-link" disabled=${!!busy} title="Teach it as a standing rule of this reference's campaign: a preview first, then your reason" onClick=${() => startTeach(o)}>make it a rule</button>` : null}`)
        : o.status === 'retired' ? html`<button class="ov-link" disabled=${!!busy} onClick=${() => act(o, { action: 'restore' })}>restore</button>` : null}</span>`}
    </li>`;
    return html`<div class="st-obs-wrap" aria-label=${'Observations on ' + r.name}>
      <div class="st-obs-h"><span class="st-lbl">Observations (${active.length})</span><span class="ov-dim">observed = seen in it; inferred = concluded, not a fact; preferred and mandatory are the team's word. The models read the active ones with their weight.</span></div>
      ${active.length ? html`<ul class="st-obs-list">${active.map(row)}</ul>` : html`<div class="ov-dim">${obs.length ? 'None active.' : 'None yet: they come from the vision pass (Analyse) or from the team.'}</div>`}
      ${promoted.length ? html`<ul class="st-obs-list">${promoted.map(row)}</ul>` : null}
      ${retired.length ? html`<button class="st-tools-toggle" aria-expanded=${showOld} onClick=${() => setShowOld(!showOld)}><span class="st-lbl">Set aside (${retired.length})</span><span aria-hidden="true">${showOld ? '-' : '+'}</span></button>${showOld ? html`<ul class="st-obs-list">${retired.map(row)}</ul>` : null}` : null}
      ${teach ? html`<div class="st-obs-teach" role="group" aria-label="Teach it as a rule">
        ${teach.error && !teach.preview ? html`<div class=${'st-err' + (teach.code === 'ambiguous' ? ' st-warn' : '')} role="alert">${teach.error}</div>` : null}
        ${(teach.others || []).length ? html`<div><b>Other ${camp ? camp.name : ''} references say something different:</b><ul class="st-ul">${teach.others.map(x => html`<li key=${x.obs}>${x.name}: "${x.text}" <span class="ov-dim">(${x.authority})</span></li>`)}</ul>
          <div class="st-seg" role="radiogroup" aria-label="Resolve the disagreement"><button role="radio" aria-checked=${teach.resolve === 'this'} class=${'st-segbtn' + (teach.resolve === 'this' ? ' on' : '')} onClick=${() => setTeach(Object.assign({}, teach, { resolve: 'this' }))}>This one takes precedence</button><button role="radio" aria-checked=${teach.resolve === 'both'} class=${'st-segbtn' + (teach.resolve === 'both' ? ' on' : '')} onClick=${() => setTeach(Object.assign({}, teach, { resolve: 'both' }))}>They do not conflict</button></div></div>` : null}
        ${teach.preview ? html`<div class="st-obs-prev"><div><b>Rule</b> ${teach.preview.fix.rule}</div><div class="ov-dim">${(teach.preview.writes || []).join('; ')}. ${teach.preview.note || ''}</div></div>` : null}
        ${teach.preview || (teach.others || []).length ? html`<div class="st-nd-row"><input class="st-in" value=${teach.reason || ''} onInput=${e => setTeach(Object.assign({}, teach, { reason: e.target.value }))} placeholder="Why it is a rule: who confirmed it, from what" aria-label="Why it is taught" />
          <button class="btn sm" disabled=${!!busy || !(teach.reason || '').trim() || ((teach.others || []).length && !teach.resolve)} onClick=${teach.preview ? confirmTeach : async () => { const res = await onTeach({ campaign: r.campaign, kind: 'rule', proposal: { observation: { ref: r.id, obs: teach.o.id }, resolve: teach.resolve } }); setTeach(Object.assign({}, teach, res)); }}>${teach.preview ? 'Teach the rule' : 'Preview'}</button></div>` : null}
        <button class="ov-link" onClick=${() => setTeach(null)}>close</button>
      </div>` : null}
      ${ro ? null : adding ? html`<div class="st-obs-add" role="group" aria-label="Add an observation">
        <select class="st-sel" value=${add.area} onChange=${e => setAdd(Object.assign({}, add, { area: e.target.value }))} aria-label="What it is about">${AREAS.map(k => html`<option key=${k} value=${k}>${AREA_WORD[k]}</option>`)}</select>
        <input class="st-in" value=${add.text} onInput=${e => setAdd(Object.assign({}, add, { text: e.target.value }))} placeholder="What is seen, or required" aria-label="The observation" />
        <select class="st-sel" value=${add.authority} onChange=${e => setAdd(Object.assign({}, add, { authority: e.target.value }))} aria-label="Its weight">${AUTH.filter(k => k !== 'inferred').map(k => html`<option key=${k} value=${k}>${AUTH_WORD[k]}</option>`)}</select>
        <input class="st-in" value=${add.why} onInput=${e => setAdd(Object.assign({}, add, { why: e.target.value }))} placeholder=${add.authority === 'observed' ? 'why (optional)' : 'who requires it, where it was agreed'} aria-label="Why" />
        <button class="btn sm" disabled=${!!busy || !add.text.trim() || (add.authority !== 'observed' && !add.why.trim())} onClick=${async () => { const ok = await act(null, { action: 'add', area: add.area, text: add.text.trim(), authority: add.authority, why: add.why.trim() }); if (ok) { setAdding(false); setAdd({ area: 'url', text: '', authority: 'observed', why: '' }); } }}>Add</button><button class="btn sm ghost" onClick=${() => setAdding(false)}>Cancel</button></div>`
        : html`<button class="ov-link" onClick=${() => setAdding(true)}>add an observation</button>`}
    </div>`;
  }

  /** The references the Brand workspace says would help: what, for which campaign and format, and why. */
  function Wanted({ wanted }) {
    if (!wanted || !wanted.length) return null;
    return html`<div class="st-wanted" aria-label="References that would help"><div class="st-lbl">References that would help (${wanted.length})</div>
      <ul class="st-ul">${wanted.map((w, i) => html`<li key=${i}><b>${w.text}</b> <${Chip} title="upload it with this purpose">${w.purpose}</${Chip}><div class="ov-dim">${w.why}</div></li>`)}</ul>
      <div class="ov-dim">Uploaded references are read into the client's memory and retrieved for the matching campaign; no model is trained on them.</div></div>`;
  }

  window.STBrandMem = { RecordLine, RecordEditor, Observations, Wanted, AREA_WORD, AUTH_WORD };
})();
