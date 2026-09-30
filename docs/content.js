/* AXIOM - the Content Desk. Copy for each client and each platform, in the
 * client's own voice, changed by telling it what to change.
 *
 * A React island (React, ReactDOM and htm vendored under docs/vendor; shared
 * pieces from docs/ax-ui.js). Pick the client, the campaign and the platforms,
 * write a one-line brief (or paste source material), press Write. The worker
 * composes from the brand kit's voice profile - campaigns, approved facts,
 * banned terms - the approved examples filed in the Mind and the corrections
 * the team has taught the Engine, and this view tails the job. Every piece can
 * then be revised by instruction in the chat pane: a one-off change is applied
 * to this set; a standing instruction is remembered for the client and shown
 * as a chip you can switch off. Figures are checked against the approved facts
 * and the source and flagged, never dropped.
 */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.contentInit = function () {
      const root = document.getElementById('content-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, blobUrl, toastMsg, ago, Console, tailJob } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const clients = () => (typeof CC_CLIENTS !== 'undefined' && Array.isArray(CC_CLIENTS) ? CC_CLIENTS : []);
  const clientOf = id => clients().find(c => c.id === id) || null;
  const ORDER = ['facebook', 'instagram', 'linkedin', 'x', 'tiktok', 'reddit', 'youtube', 'spotify', 'email'];
  const FALLBACK = { facebook: { label: 'Facebook', max: 900 }, instagram: { label: 'Instagram', max: 700 }, linkedin: { label: 'LinkedIn', max: 900 }, x: { label: 'X', max: 280 }, tiktok: { label: 'TikTok', max: 300 }, reddit: { label: 'Reddit', max: 2500, title: true }, youtube: { label: 'YouTube', max: 1200, title: true }, spotify: { label: 'Spotify audio', max: 700, script: true }, email: { label: 'Email', max: 1800, title: true } };
  const QUICK = ['Shorter', 'Add the source line', 'Lead with the local figure', 'Warmer and less formal', 'Take out the hashtag', 'End with the campaign sign-off'];
  const REMEMBER = [['auto', 'Remember standing instructions'], ['always', 'Always remember this'], ['never', 'This set only']];

  function useImage(url) {
    const [src, setSrc] = useState('');
    useEffect(() => {
      let alive = true, obj = '';
      if (!url) { setSrc(''); return; }
      blobUrl(url).then(u => { if (alive) { obj = u; setSrc(u); } else URL.revokeObjectURL(u); }).catch(() => { if (alive) setSrc(''); });
      return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
    }, [url]);
    return src;
  }
  const flagWord = f => ({ unverified_figure: 'figure not in facts or source', banned_term: 'banned term', over_limit: 'over the limit', too_many_hashtags: 'too many hashtags', exclamation: 'exclamation mark' })[f] || f;

  /* The client header: who we are writing as, and what the Desk knows. */
  function ClientHeader({ ns, client, kit, logoUrl, status, fixes, onVoice, onLearned }) {
    const logo = useImage(logoUrl);
    const camps = (kit && kit.campaigns || []).filter(c => c.active !== false).length;
    const facts = (kit && kit.facts || []).filter(f => f.status !== 'pending').length;
    const live = fixes.filter(f => f.active).length;
    const examples = ((status && status.mind) || []).filter(d => /^(copy|outcome)$/.test(d.kind)).reduce((a, d) => a + (d.n || 0), 0);
    const ready = !!(kit && (kit.voice || camps));
    return html`<div class="cd-head">
      <div class="cd-logo" style=${client.accent ? { borderColor: client.accent } : null}>${logo ? html`<img src=${logo} alt=${client.name + ' logo'} />` : html`<span>${client.short || ns.toUpperCase()}</span>`}</div>
      <div class="cd-who">
        <div class="cd-name">Writing as <b>${(kit && kit.name) || client.name || ns}</b></div>
        <div class="cd-know">
          <span class=${'cd-stat' + (camps ? '' : ' dim')}>${camps} campaign${camps === 1 ? '' : 's'}</span>
          <span class=${'cd-stat' + (facts ? '' : ' dim')}>${facts} approved fact${facts === 1 ? '' : 's'}</span>
          <span class=${'cd-stat' + (live ? '' : ' dim')}>${live} correction${live === 1 ? '' : 's'} in force</span>
          <span class=${'cd-stat' + (examples ? '' : ' dim')}>${examples} example${examples === 1 ? '' : 's'} in the Mind</span>
        </div>
        ${!ready ? html`<div class="cd-warn">No voice profile for ${client.short || ns} yet. Load the client's voice pack with <code>tools/engine-ingest.py</code> or fill in the profile here; the Desk will write from Client Central's brief until then.</div>` : null}
      </div>
      <div class="rd-ctl" style=${{ margin: 0 }}>
        <button class=${'btn sm ghost' + (ready ? '' : ' rel-attn')} onClick=${onVoice}>Voice profile</button>
        <button class="btn sm ghost" onClick=${onLearned}>${live} learned</button>
      </div>
    </div>`;
  }

  /* One piece of copy, with its checks and its actions. */
  function Piece({ item, spec, selected, canWrite, onSelect, onSave, onVerdict, campaignLabel }) {
    const [edit, setEdit] = useState(false);
    const [draft, setDraft] = useState({ title: item.title || '', body: item.body, cta: item.cta || '' });
    useEffect(() => { setDraft({ title: item.title || '', body: item.body, cta: item.cta || '' }); }, [item.title, item.body, item.cta]);
    const max = (item.check && item.check.max) || spec.max || 900;
    const chars = (edit ? draft.body : item.body).length;
    const pct = Math.min(100, Math.round(chars / max * 100));
    const tone = chars > max ? 'over' : pct > 85 ? 'warm' : 'ok';
    const copy = async () => {
      const txt = [item.title, item.body, item.cta, item.link, item.hashtags && item.hashtags.length ? item.hashtags.map(h => '#' + h).join(' ') : ''].filter(Boolean).join('\n\n');
      try { await navigator.clipboard.writeText(txt); toastMsg('Copied'); } catch (e) { toastMsg('Could not copy', true); }
    };
    const chk = item.check || { ok: true, flags: [], missing: [], banned: [] };
    return html`<div class=${'cd-piece' + (selected ? ' on' : '') + (item.verdict ? ' ' + item.verdict : '')} onClick=${() => onSelect(item.n)}>
      <div class="cd-piecehead">
        <span class="cd-plat">${spec.label || item.platform}</span>
        <span class="cd-n">#${item.n + 1}</span>
        ${item.note ? html`<span class="cd-angle" title="The angle">${item.note}</span>` : null}
        ${item.revisions ? html`<span class="rd-chip" title="Revised by instruction">${item.revisions} edit${item.revisions === 1 ? '' : 's'}</span>` : null}
        ${item.verdict ? html`<span class=${'rel-chk ' + (item.verdict === 'approved' ? 'ok' : 'warn')}>${item.verdict}</span>` : null}
      </div>
      ${edit ? html`
        ${spec.title || spec.script ? html`<input class="fi" value=${draft.title} maxLength="160" placeholder=${spec.script ? 'Script title' : 'Title / subject'} onInput=${e => setDraft(d => Object.assign({}, d, { title: e.target.value }))} aria-label="Title" />` : null}
        <textarea class="fi cd-body" rows="7" value=${draft.body} onInput=${e => setDraft(d => Object.assign({}, d, { body: e.target.value }))} aria-label="Body"></textarea>
        <input class="fi" value=${draft.cta} maxLength="160" placeholder="Closing line / CTA (optional)" onInput=${e => setDraft(d => Object.assign({}, d, { cta: e.target.value }))} aria-label="CTA" />`
      : html`
        ${item.title ? html`<div class="cd-title">${item.title}</div>` : null}
        <div class="cd-text">${item.body}</div>
        ${item.cta ? html`<div class="cd-cta">${item.cta}</div>` : null}
        ${item.link ? html`<div class="cd-link">${item.link}</div>` : null}
        ${item.hashtags && item.hashtags.length ? html`<div class="cd-tags">${item.hashtags.map(h => html`<span key=${h}>#${h}</span>`)}</div>` : null}`}
      <div class="cd-meter" title=${chars + ' of ' + max + ' characters'}><i class=${tone} style=${{ width: pct + '%' }}></i></div>
      <div class="rel-meta">
        <span class="rd-chip">${chars}/${max}</span>
        ${chk.ok ? html`<span class="rel-chk ok" title="Every figure appears in the approved facts or the source; no banned terms">checks passed</span>`
          : chk.flags.map(f => html`<span key=${f} class="rel-chk warn" title=${f === 'unverified_figure' ? 'Not in the approved facts or source: ' + (chk.missing || []).join(', ') : f === 'banned_term' ? (chk.banned || []).join(', ') : ''}>${flagWord(f)}${f === 'unverified_figure' && chk.missing && chk.missing.length ? ': ' + chk.missing.slice(0, 4).join(', ') : f === 'banned_term' && chk.banned && chk.banned.length ? ': ' + chk.banned.join(', ') : ''}</span>`)}
        ${item.factIds && item.factIds.length ? html`<span class="rd-chip" title="Approved facts used">${item.factIds.join(', ')}</span>` : null}
      </div>
      ${canWrite ? html`<div class="cd-acts" onClick=${e => e.stopPropagation()}>
        ${edit ? html`<button class="btn sm" onClick=${() => { onSave(item.n, draft); setEdit(false); }}>Save</button><button class="btn sm ghost" onClick=${() => { setDraft({ title: item.title || '', body: item.body, cta: item.cta || '' }); setEdit(false); }}>Cancel</button>`
        : html`<button class="btn sm ghost" onClick=${copy}>Copy</button>
               <button class="btn sm ghost" onClick=${() => setEdit(true)}>Edit</button>
               <button class=${'btn sm ghost' + (selected ? ' on' : '')} onClick=${() => onSelect(item.n, true)} title="Tell the Desk what to change on this piece">Ask the Desk</button>
               <button class=${'btn sm' + (item.verdict === 'approved' ? '' : ' ghost')} onClick=${() => onVerdict(item, 'approved')} title="Record this as approved: the Engine keeps it as an example of what works">${item.verdict === 'approved' ? 'Approved' : 'Approve'}</button>
               <button class="btn sm ghost" onClick=${() => { const why = window.prompt('Why is this one killed? (one line, optional)') || ''; onVerdict(item, 'killed', why); }}>Kill</button>`}
      </div>` : html`<div class="cd-acts"><button class="btn sm ghost" onClick=${e => { e.stopPropagation(); copy(); }}>Copy</button></div>`}
    </div>`;
  }

  /* The chat: tell the Desk what to change. The thread is the set's own
     history, so reopening a set brings the conversation back with it. */
  function Chat({ set, items, target, setTarget, remember, setRemember, onSend, busy, client, canWrite, onLearned }) {
    const [text, setText] = useState('');
    const boxRef = useRef(null);
    const hist = (set && set.history) || [];
    useEffect(() => { const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight; }, [hist.length, busy]);
    const label = n => { const it = items.find(x => x.n === n); return it ? '#' + (n + 1) + ' ' + ((FALLBACK[it.platform] || {}).label || it.platform) : 'piece ' + (n + 1); };
    const send = () => { const t = text.trim(); if (!t || busy) return; onSend(t); setText(''); };
    return html`<div class="cd-chat panel">
      <div class="phead"><div class="ptitle">Tell the Desk what to change</div><span class="ptag">${hist.length ? hist.length + ' INSTRUCTION' + (hist.length === 1 ? '' : 'S') : 'CHAT'}</span></div>
      <div class="cd-thread" ref=${boxRef}>
        ${!hist.length ? html`<div class="cd-msg desk"><div class="b">Ask for anything: "make the LinkedIn one shorter", "say per cent, not %", "never call it a subsidy". One-off changes apply to this set. Anything phrased as a standing instruction is remembered for ${client.short || set.ns} and shows here as a rule you can switch off.</div></div>` : null}
        ${hist.map((h, i) => html`<div key=${i}>
          <div class="cd-msg user"><div class="b">${h.instruction}</div><div class="m">${h.n == null ? 'all pieces' : label(h.n)}${h.who ? ' - ' + h.who : ''} - ${ago(h.ts)} ago</div></div>
          <div class="cd-msg desk"><div class="b">${h.note}</div>
            ${h.ruleId ? html`<button class="cd-remember" onClick=${onLearned} title="Open what the Engine has learned">Remembered for ${client.short || set.ns}: ${h.rule}</button>`
              : h.standing ? html`<div class="m">Sounded like a standing instruction but was not remembered (confidence ${Math.round((h.confidence || 0) * 100)}%). Pick "Always remember this" to keep it.</div>`
              : html`<div class="m">Applied to this set only.</div>`}
          </div>
        </div>`)}
        ${busy ? html`<div class="cd-msg desk busy"><div class="b">Rewriting...</div></div>` : null}
      </div>
      ${canWrite ? html`<div class="cd-compose">
        <div class="cd-quick">${QUICK.map(q => html`<button key=${q} class="cd-qchip" disabled=${busy} onClick=${() => onSend(q)}>${q}</button>`)}</div>
        <div class="rd-ctl" style=${{ margin: '6px 0' }}>
          <select class="sel" value=${target} onChange=${e => setTarget(e.target.value)} aria-label="Which pieces" style=${{ padding: '6px 10px', fontSize: 11 }}>
            <option value="all">All ${items.length} pieces</option>
            ${items.map(it => html`<option key=${it.n} value=${String(it.n)}>${label(it.n)}</option>`)}
          </select>
          <select class="sel" value=${remember} onChange=${e => setRemember(e.target.value)} aria-label="Remember" style=${{ padding: '6px 10px', fontSize: 11 }}>${REMEMBER.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select>
        </div>
        <textarea class="fi cd-input" rows="2" value=${text} placeholder=${target === 'all' ? 'e.g. Shorter, and write per cent instead of %' : 'e.g. Lead with the Bendigo figure and drop the second paragraph'} onInput=${e => setText(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Instruction"></textarea>
        <div class="rd-ctl" style=${{ marginTop: 6 }}><button class="btn sm" disabled=${busy || !text.trim()} onClick=${send}>${busy ? 'Working...' : 'Send'}</button><span class="sig-where">Enter sends. Shift+Enter for a new line.</span></div>
      </div>` : html`<div class="cd-compose"><span class="rd-chip">read-only key: you can read the thread, not add to it</span></div>`}
    </div>`;
  }

  /* The voice profile: what the Desk writes from. Colours, fonts and the logo
     stay in the Release Desk brand kit; this is the words. */
  function VoicePanel({ ns, kit, canWrite, onSaved, onClose }) {
    const c = clientOf(ns) || {};
    const k = kit || {};
    const [f, setF] = useState(() => ({ voice: k.voice || c.brief || '', rules: k.rules || '', campaigns: (k.campaigns || []).map(x => Object.assign({}, x)), facts: (k.facts || []).map(x => Object.assign({}, x)), banned: (k.banned || []).map(x => Object.assign({}, x)) }));
    const [tab, setTab] = useState('voice');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [open, setOpen] = useState(-1);
    const upd = (key, i, field, v) => setF(x => { const a = x[key].slice(); a[i] = Object.assign({}, a[i], { [field]: v }); return Object.assign({}, x, { [key]: a }); });
    const del = (key, i) => setF(x => Object.assign({}, x, { [key]: x[key].filter((_, j) => j !== i) }));
    const save = async () => {
      setBusy(true); setErr('');
      try {
        const d = await call('/brand/kit', { ns, voice: f.voice, rules: f.rules, campaigns: f.campaigns.filter(x => x.name || x.id), facts: f.facts.filter(x => x.text), banned: f.banned.filter(x => x.term) });
        toastMsg('Voice profile saved'); onSaved(d);
      } catch (e) { setErr(e.message); }
      setBusy(false);
    };
    const TABS = [['voice', 'Voice and rules'], ['campaigns', 'Campaigns (' + f.campaigns.length + ')'], ['facts', 'Approved facts (' + f.facts.length + ')'], ['banned', 'Never say (' + f.banned.length + ')']];
    return html`<div class="panel rel-brand cd-voice">
      <div class="phead"><div class="ptitle">Voice profile - ${c.short || ns.toUpperCase()}</div><span class="ptag">${kit && kit.updated ? 'SET ' + ago(kit.updated) + ' AGO' + (kit.by ? ' BY ' + kit.by.toUpperCase() : '') : 'NOT SET'}</span></div>
      <div class="tp-tabs">${TABS.map(([id, l]) => html`<button key=${id} class=${'tp-tab' + (tab === id ? ' on' : '')} onClick=${() => setTab(id)}>${l}</button>`)}</div>
      ${tab === 'voice' ? html`
        <label class="rel-lbl">Voice - how this client speaks</label>
        <textarea class="fi" rows="7" value=${f.voice} disabled=${!canWrite} onInput=${e => setF(x => Object.assign({}, x, { voice: e.target.value }))}></textarea>
        <label class="rel-lbl">Standing rules - always / never</label>
        <textarea class="fi" rows="6" value=${f.rules} disabled=${!canWrite} placeholder="ALWAYS: ... NEVER: ..." onInput=${e => setF(x => Object.assign({}, x, { rules: e.target.value }))}></textarea>
        <div class="sig-where" style=${{ marginTop: 6 }}>Colours, fonts and the logo are set in the Release Desk brand kit and shared with this profile.</div>` : null}
      ${tab === 'campaigns' ? html`<div class="cd-list">
        ${f.campaigns.map((cp, i) => html`<div key=${i} class=${'cd-row' + (open === i ? ' open' : '')}>
          <div class="cd-rowhead" onClick=${() => setOpen(open === i ? -1 : i)}><b>${cp.name || cp.id || 'Untitled campaign'}</b><span class="m">${cp.signoff || ''}</span><span class="rd-chip">${cp.active === false ? 'off' : 'on'}</span></div>
          ${open === i ? html`<div class="cd-rowbody">
            <div class="rd-ctl"><input class="fi" placeholder="Short id (e.g. hoof)" value=${cp.id || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'id', e.target.value)} /><input class="fi" placeholder="Name" value=${cp.name || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'name', e.target.value)} /></div>
            <div class="rd-ctl"><input class="fi" placeholder="Sign-off line" value=${cp.signoff || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'signoff', e.target.value)} /><input class="fi" placeholder="Link line / CTA" value=${cp.cta || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'cta', e.target.value)} /></div>
            <div class="rd-ctl"><input class="fi" placeholder="Site (thatsmining.com.au)" value=${cp.url || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'url', e.target.value)} /><input class="fi" placeholder="Source line" value=${cp.sourceLine || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'sourceLine', e.target.value)} /></div>
            <textarea class="fi" rows="2" placeholder="Tone" value=${cp.tone || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'tone', e.target.value)}></textarea>
            <textarea class="fi" rows="2" placeholder="Structure of a post" value=${cp.structure || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'structure', e.target.value)}></textarea>
            <textarea class="fi" rows="3" placeholder="Notes: phases, what the client asked for, sensitivities" value=${cp.notes || ''} disabled=${!canWrite} onInput=${e => upd('campaigns', i, 'notes', e.target.value)}></textarea>
            ${canWrite ? html`<div class="rd-ctl"><button class="btn sm ghost" onClick=${() => upd('campaigns', i, 'active', cp.active === false)}>${cp.active === false ? 'Switch on' : 'Switch off'}</button><button class="btn sm ghost" onClick=${() => del('campaigns', i)}>Remove</button></div>` : null}
          </div>` : null}
        </div>`)}
        ${canWrite ? html`<button class="btn sm ghost" onClick=${() => { setF(x => Object.assign({}, x, { campaigns: x.campaigns.concat([{ id: '', name: '', signoff: '', cta: '', url: '', sourceLine: '', tone: '', structure: '', notes: '', active: true }]) })); setOpen(f.campaigns.length); }}>Add a campaign</button>` : null}
      </div>` : null}
      ${tab === 'facts' ? html`<div class="cd-list">
        <div class="sig-where" style=${{ marginBottom: 6 }}>The only figures the Desk may quote, besides what is in the brief or source. Pending facts are held back until approved.</div>
        ${f.facts.map((ft, i) => html`<div key=${i} class="cd-fact">
          <textarea class="fi" rows="2" value=${ft.text || ''} disabled=${!canWrite} placeholder="The fact, with its figure, as the client approved it" onInput=${e => upd('facts', i, 'text', e.target.value)}></textarea>
          <div class="rd-ctl"><input class="fi" placeholder="Source" value=${ft.source || ''} disabled=${!canWrite} onInput=${e => upd('facts', i, 'source', e.target.value)} /><input class="fi" style=${{ maxWidth: 110 }} placeholder="campaign" value=${ft.campaign || ''} disabled=${!canWrite} onInput=${e => upd('facts', i, 'campaign', e.target.value)} />
            ${canWrite ? html`<button class=${'btn sm' + (ft.status === 'pending' ? ' ghost' : '')} onClick=${() => upd('facts', i, 'status', ft.status === 'pending' ? 'approved' : 'pending')}>${ft.status === 'pending' ? 'pending' : 'approved'}</button><button class="btn sm ghost" onClick=${() => del('facts', i)}>Remove</button>` : html`<span class="rd-chip">${ft.status || 'approved'}</span>`}</div>
        </div>`)}
        ${canWrite ? html`<button class="btn sm ghost" onClick=${() => setF(x => Object.assign({}, x, { facts: x.facts.concat([{ id: '', text: '', source: '', status: 'approved', campaign: '' }]) }))}>Add a fact</button>` : null}
      </div>` : null}
      ${tab === 'banned' ? html`<div class="cd-list">
        ${f.banned.map((b, i) => html`<div key=${i} class="rd-ctl cd-ban">
          <input class="fi" style=${{ maxWidth: 180 }} placeholder="Never say" value=${b.term || ''} disabled=${!canWrite} onInput=${e => upd('banned', i, 'term', e.target.value)} />
          <input class="fi" placeholder="Say instead" value=${b.use || ''} disabled=${!canWrite} onInput=${e => upd('banned', i, 'use', e.target.value)} />
          <label class="rd-chip" title="Allowed inside a denial, e.g. 'not a subsidy'"><input type="checkbox" checked=${!!b.allowNegated} disabled=${!canWrite} onChange=${e => upd('banned', i, 'allowNegated', e.target.checked)} style=${{ marginRight: 4 }} />ok in a denial</label>
          ${canWrite ? html`<button class="btn sm ghost" onClick=${() => del('banned', i)}>Remove</button>` : null}
        </div>`)}
        ${canWrite ? html`<button class="btn sm ghost" onClick=${() => setF(x => Object.assign({}, x, { banned: x.banned.concat([{ term: '', use: '', why: '', allowNegated: false }]) }))}>Add a term</button>` : null}
      </div>` : null}
      ${err ? html`<div class="rd-res err">${err}</div>` : null}
      <div class="rd-ctl" style=${{ marginTop: 10 }}>
        ${canWrite ? html`<button class="btn sm" disabled=${busy} onClick=${save}>${busy ? 'Saving...' : 'Save voice profile'}</button>` : html`<span class="rd-chip">read-only key: view only</span>`}
        <button class="btn sm ghost" onClick=${onClose}>Close</button>
        <span class="sig-where">Loaded in bulk by <code>tools/engine-ingest.py &lt;voice-pack&gt; --ns ${ns}</code>; edited here one line at a time.</span>
      </div>
    </div>`;
  }

  function LearnedPanel({ ns, fixes, canWrite, onToggle, onDelete, onClose }) {
    const c = clientOf(ns) || {};
    const list = fixes.filter(f => f.task === 'copy' || f.task === 'any');
    return html`<div class="panel rel-brand">
      <div class="phead"><div class="ptitle">What the Desk has learned - ${c.short || ns.toUpperCase()}</div><span class="ptag">${list.filter(f => f.active).length} IN FORCE</span></div>
      ${!list.length ? html`<div class="empty">Nothing taught yet. Tell the Desk what to change in the chat; standing instructions land here as rules for every later build.</div>`
        : html`<div class="rel-hist">${list.map(f => html`<div key=${f.id} class=${'rel-fix' + (f.active ? '' : ' off')}>
            <div class="r">${f.rule}</div>
            <div class="m">${f.scope === 'all' ? 'every client' : (c.short || ns)} - ${f.task === 'any' ? 'everything' : f.task} - applied ${f.hits} time${f.hits === 1 ? '' : 's'} - ${ago(f.created)} ago${f.who ? ' - ' + f.who : ''}${f.source ? ' - ' + f.source : ''}${f.why ? html`<div class="w">${f.why.slice(0, 160)}</div>` : null}</div>
            ${canWrite ? html`<div class="rd-ctl" style=${{ margin: 0 }}><button class="btn sm ghost" onClick=${() => onToggle(f)}>${f.active ? 'Switch off' : 'Switch on'}</button><button class="btn sm ghost" onClick=${() => { if (window.confirm('Delete this correction? The Desk will forget it.')) onDelete(f); }}>Delete</button></div>` : null}
          </div>`)}</div>`}
      <div class="rd-ctl" style=${{ marginTop: 10 }}><button class="btn sm ghost" onClick=${onClose}>Close</button><span class="sig-where">Rules are in the prompt within the minute. Switched-off ones stay on record.</span></div>
    </div>`;
  }

  /* the Studio reuses the voice profile editor and the learned panel as its Client panel */
  window.AX_CONTENT = { VoicePanel, LearnedPanel };

  function Notice({ err }) {
    const e = String((err && err.message) || ''); const code = (err && err.code) || '';
    let body;
    if (err && (code === 'not_found' || err.status === 404)) body = html`<b>The worker needs updating.</b> The live worker does not have the <code>/content</code> routes. Run <code>tools/deploy-worker.sh</code>, then reload.`;
    else if (err && (code === 'unauthorized' || err.status === 401)) body = html`<b>No access key.</b> Open Settings, paste your key, save, then reload.`;
    else if (err && (code === 'mind_unbound' || code === 'mind_not_configured')) body = html`<b>Storage not bound.</b> ${e}`;
    else if (err && code === 'analysis_not_configured') body = html`<b>Claude is not configured on the worker.</b> ${e}`;
    else if (err) body = html`<b>The worker returned an error:</b> <code>${e}</code>`;
    return body ? html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}>${body}</div>` : null;
  }

  function ContentApp() {
    const active = (typeof CC_ACTIVE !== 'undefined' && CC_ACTIVE) || 'mca';
    const [ns, setNs] = useState(clientOf(active) ? active : ((clients()[0] || {}).id || 'mca'));
    const [specs, setSpecs] = useState(FALLBACK);
    const [kit, setKit] = useState(null);
    const [logoUrl, setLogoUrl] = useState('');
    const [status, setStatus] = useState(null);
    const [fixes, setFixes] = useState([]);
    const [history, setHistory] = useState([]);
    const [packs, setPacks] = useState([]);
    const [campaign, setCampaign] = useState('');
    const [segment, setSegment] = useState('');
    const [platforms, setPlatforms] = useState(() => new Set(['facebook', 'linkedin']));
    const [count, setCount] = useState(2);
    const [brief, setBrief] = useState('');
    const [showSource, setShowSource] = useState(false);
    const [source, setSource] = useState('');
    const [packId, setPackId] = useState('');
    const [job, setJob] = useState(null);
    const [set, setSet] = useState(null);
    const [busy, setBusy] = useState({ write: false, chat: false });
    const [err, setErr] = useState(null);
    const [result, setResult] = useState(null);
    const [target, setTarget] = useState('all');
    const [remember, setRemember] = useState('auto');
    const [selected, setSelected] = useState(null);
    const [showVoice, setShowVoice] = useState(false);
    const [showLearned, setShowLearned] = useState(false);
    const stopRef = useRef(null);
    const chatRef = useRef(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const client = clientOf(ns) || { name: ns, short: ns.toUpperCase() };

    useEffect(() => { call('/content/platforms').then(d => { if (d.platforms) setSpecs(Object.assign({}, FALLBACK, d.platforms)); }).catch(() => {}); }, []);
    const loadKit = useCallback(async () => { try { const d = await call('/brand/kit?ns=' + ns); setKit(d.kit); setLogoUrl(d.logoUrl || ''); setErr(null); } catch (e) { setKit(null); setErr(e); } }, [ns]);
    const loadStatus = useCallback(async () => { try { setStatus(await call('/engine/status?ns=' + ns)); } catch (e) { setStatus(null); } }, [ns]);
    const loadFixes = useCallback(async () => { try { const d = await call('/engine/fixes?ns=' + ns + '&all=1'); setFixes(d.fixes || []); } catch (e) { setFixes([]); } }, [ns]);
    const loadHistory = useCallback(async () => { try { const d = await call('/content/list?ns=' + ns + '&limit=12'); setHistory(d.sets || []); } catch (e) { /* the kit call reports */ } }, [ns]);
    const loadPacks = useCallback(async () => { try { const d = await call('/release/list?ns=' + ns + '&limit=8'); setPacks(d.packs || []); } catch (e) { setPacks([]); } }, [ns]);
    useEffect(() => { loadKit(); loadStatus(); loadFixes(); loadHistory(); loadPacks(); setSet(null); setJob(null); setResult(null); setSelected(null); setTarget('all'); setCampaign(''); setSegment(''); setPackId(''); }, [loadKit, loadStatus, loadFixes, loadHistory, loadPacks]);
    useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);
    // the first active campaign is the default once the kit arrives
    useEffect(() => { if (kit && !campaign) { const c = (kit.campaigns || []).find(x => x.active !== false); if (c) setCampaign(c.id); } }, [kit]);

    const openSet = useCallback(async (id) => { const d = await call('/content/set?id=' + encodeURIComponent(id)); setSet(d.set); setSelected(null); setTarget('all'); return d.set; }, []);
    const togglePlatform = p => setPlatforms(s => { const x = new Set(s); if (x.has(p)) { if (x.size > 1) x.delete(p); } else if (x.size < 6) x.add(p); return x; });

    const write = async () => {
      const b = brief.trim();
      if (b.length < 8 && source.trim().length < 40 && !packId) { setResult({ ok: false, text: 'Write a one-line brief, or paste source material.' }); return; }
      setBusy(x => Object.assign({}, x, { write: true })); setResult(null); setSet(null); setJob(null);
      if (stopRef.current) stopRef.current();
      try {
        const body = { ns, campaign, segment, platforms: Array.from(platforms), brief: b, n: count };
        if (packId) body.source = { kind: 'release', id: packId }; else if (source.trim()) body.source = { kind: 'text', text: source.trim() };
        const d = await call('/content/generate', body);
        const title = 'Content Desk - ' + (client.short || ns);
        setJob({ id: d.job, status: 'running', lines: [], follow: true, title });
        stopRef.current = tailJob(d.job, j => setJob(Object.assign({ title }, j)), async (j) => {
          setJob(Object.assign({ title }, j));
          setBusy(x => Object.assign({}, x, { write: false }));
          if (j.success) {
            const s = await openSet(d.id);
            const flagged = s.items.filter(it => it.check && !it.check.ok).length;
            setResult({ ok: true, text: s.items.length + ' pieces written for ' + (client.short || ns) + '.' + (flagged ? ' ' + flagged + ' flagged - a figure not in the approved facts, a banned term or a limit; check before publishing.' : ' Every figure traced, no banned terms.') + ' Tell the Desk what to change on the right.' });
            toastMsg('Copy written'); loadHistory();
            setTimeout(() => { if (chatRef.current && window.innerWidth < 1100) chatRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 200);
          } else {
            const rr = (j.result || {});
            setResult({ ok: false, text: 'Writing failed: ' + (rr.detail || rr.error || (j.error && j.error.message) || 'see the console') });
            toastMsg('Writing failed', true);
          }
        });
      } catch (e) { setBusy(x => Object.assign({}, x, { write: false })); setResult({ ok: false, text: 'Could not start: ' + e.message }); if (e.status === 404 || e.status === 401 || e.status === 501) setErr(e); }
    };
    const send = async (instruction) => {
      if (!set) return;
      setBusy(x => Object.assign({}, x, { chat: true }));
      try {
        const r = await call('/content/revise', { id: set.id, n: target === 'all' ? null : +target, instruction, remember });
        setSet(r.set);
        if (r.remembered) { toastMsg('Changed and remembered for ' + (client.short || ns)); loadFixes(); loadStatus(); }
        else toastMsg(r.changed.length ? 'Changed ' + r.changed.length + ' piece' + (r.changed.length === 1 ? '' : 's') : 'Nothing to change');
      } catch (e) { setResult({ ok: false, text: 'Revise: ' + e.message }); toastMsg('Could not revise', true); }
      setBusy(x => Object.assign({}, x, { chat: false }));
    };
    const onSave = async (n, draft) => {
      if (!set) return;
      try { const r = await call('/content/update', { id: set.id, n, patch: draft }); setSet(s => Object.assign({}, s, { items: s.items.map(it => it.n === n ? r.item : it) })); toastMsg('Saved'); }
      catch (e) { setResult({ ok: false, text: 'Save: ' + e.message }); }
    };
    const onVerdict = async (item, verdict, why) => {
      if (!set) return;
      try { const r = await call('/content/verdict', { id: set.id, n: item.n, verdict, why: why || '' }); setSet(s => Object.assign({}, s, { items: s.items.map(it => it.n === item.n ? r.item : it) })); toastMsg(verdict === 'approved' ? 'Approved - kept as an example of what works' : 'Killed - kept as an example of what does not'); loadStatus(); }
      catch (e) { toastMsg('Could not record it: ' + e.message, true); }
    };
    const onSelect = (n, focus) => { setSelected(n); setTarget(String(n)); if (focus && chatRef.current) { chatRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); const ta = chatRef.current.querySelector('textarea'); if (ta) ta.focus(); } };
    const onToggleFix = async (f) => { try { await call('/engine/fix/update', { id: f.id, active: !f.active }); setFixes(x => x.map(y => y.id === f.id ? Object.assign({}, y, { active: !f.active }) : y)); } catch (e) { toastMsg(e.message, true); } };
    const onDeleteFix = async (f) => { try { await call('/engine/fix/delete', { id: f.id }); setFixes(x => x.filter(y => y.id !== f.id)); } catch (e) { toastMsg(e.message, true); } };

    const clientOpts = useMemo(() => clients().filter(c => c.id !== 'cmm').map(c => ({ id: c.id, name: c.short ? c.short + ' - ' + c.name : c.name })), []);
    const camps = (kit && kit.campaigns || []).filter(c => c.active !== false);
    const segs = (kit && kit.segments) || [];
    const items = (set && set.items) || [];
    const grouped = useMemo(() => { const g = {}; items.forEach(it => { (g[it.platform] = g[it.platform] || []).push(it); }); return ORDER.filter(p => g[p]).map(p => [p, g[p]]); }, [items]);
    const campLabel = id => { const c = camps.find(x => x.id === id); return c ? c.name : ''; };

    return html`<div class="rd-wrap cd-wrap">
      <div class="rd-ctl rel-top">
        <select class="sel" value=${ns} onChange=${e => setNs(e.target.value)} aria-label="Client">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        <span class="sig-where">Copy for ${client.short || ns}, in ${client.short || ns}'s voice, changed by telling the Desk what to change.</span>
      </div>
      <${ClientHeader} ns=${ns} client=${client} kit=${kit} logoUrl=${logoUrl} status=${status} fixes=${fixes} onVoice=${() => setShowVoice(s => !s)} onLearned=${() => setShowLearned(s => !s)} />
      ${showLearned ? html`<${LearnedPanel} ns=${ns} fixes=${fixes} canWrite=${canWrite} onToggle=${onToggleFix} onDelete=${onDeleteFix} onClose=${() => setShowLearned(false)} />` : null}
      ${showVoice ? html`<${VoicePanel} key=${ns + (kit ? kit.updated : 0)} ns=${ns} kit=${kit} canWrite=${canWrite} onSaved=${d => { setKit(d.kit); setLogoUrl(d.logoUrl || ''); }} onClose=${() => setShowVoice(false)} />` : null}
      <${Notice} err=${err} />
      <div class="panel cd-setup">
        <div class="phead"><div class="ptitle">What are we writing?</div><span class="ptag">${platforms.size} PLATFORM${platforms.size === 1 ? '' : 'S'} x ${count}</span></div>
        <div class="cd-lbl">Campaign</div>
        <div class="cd-chips cd-campaigns">
          <button class=${'cd-chip' + (!campaign ? ' on' : '')} onClick=${() => setCampaign('')} title="No campaign frame: the client voice and rules only">General</button>
          ${camps.map(c => html`<button key=${c.id} class=${'cd-chip' + (campaign === c.id ? ' on' : '')} onClick=${() => setCampaign(c.id)} title=${c.signoff || ''}>${c.name.length > 42 ? c.name.slice(0, 40) + '...' : c.name}</button>`)}
        </div>
        <div class="cd-lbl">Platforms</div>
        <div class="cd-chips cd-platforms">${ORDER.map(p => html`<button key=${p} class=${'cd-chip' + (platforms.has(p) ? ' on' : '')} onClick=${() => togglePlatform(p)} title=${(specs[p] || {}).register || ''}>${(specs[p] || FALLBACK[p] || {}).label || p}</button>`)}</div>
        <div class="rd-ctl" style=${{ marginTop: 8 }}>
          ${segs.length ? html`<select class="sel" value=${segment} onChange=${e => setSegment(e.target.value)} aria-label="Audience"><option value="">Any audience</option>${segs.map(s => html`<option key=${s.id} value=${s.id}>${s.name}</option>`)}</select>` : null}
          <select class="sel" value=${count} onChange=${e => setCount(+e.target.value)} aria-label="Pieces per platform"><option value="1">1 per platform</option><option value="2">2 per platform</option><option value="3">3 per platform</option><option value="4">4 per platform</option></select>
          ${packs.length ? html`<select class="sel" value=${packId} onChange=${e => { setPackId(e.target.value); if (e.target.value) setShowSource(false); }} aria-label="From a release pack"><option value="">No release pack</option>${packs.map(p => html`<option key=${p.id} value=${p.id}>From release: ${(p.title || p.id).slice(0, 48)}</option>`)}</select>` : null}
          <button class=${'btn sm ghost' + (showSource ? ' on' : '')} onClick=${() => { setShowSource(s => !s); if (!showSource) setPackId(''); }}>${showSource ? 'Hide source' : 'Paste source material'}</button>
        </div>
        <textarea class="fi cd-brief" rows="2" value=${brief} placeholder=${'What is this about? e.g. ' + (campaign === 'hoof' ? 'The petition just passed 20,000 - thank the signers and ask for one more push' : campaign === 'vgo' ? 'Phase 2 petition push for Bendigo, use the local figures' : 'The Budget kept tax settings stable - two posts on what that means for jobs and regional communities')} onInput=${e => setBrief(e.target.value)} aria-label="Brief"></textarea>
        ${showSource ? html`<textarea class="fi cd-source" rows="6" value=${source} placeholder="Paste a media release, an article, research notes - the Desk takes its figures from here and from the approved facts, nowhere else." onInput=${e => setSource(e.target.value)} aria-label="Source material"></textarea>` : null}
        <div class="rd-ctl" style=${{ marginTop: 8 }}>
          ${canWrite ? html`<button class="btn sm" disabled=${busy.write || (brief.trim().length < 8 && source.trim().length < 40 && !packId)} onClick=${write}>${busy.write ? 'Writing...' : 'Write ' + (platforms.size * count) + ' piece' + (platforms.size * count === 1 ? '' : 's')}</button>` : html`<span class="rd-chip">read-only key: you can read sets, not write them</span>`}
          <span class="sig-where">${campaign ? 'In the ' + (campLabel(campaign).split(' (')[0]) + ' frame. ' : ''}Figures come only from the approved facts and your source; every piece is checked.</span>
        </div>
      </div>
      <${Console} job=${job} canWrite=${canWrite} />
      ${result ? html`<div class=${'rd-res ' + (result.ok ? 'ok' : 'err')}>${result.text}</div>` : null}
      ${set ? html`<div class="cd-main">
        <div class="cd-pieces">
          <div class="panel">
            <div class="phead"><div class="ptitle">${set.brief ? set.brief.slice(0, 90) : 'Content set'}</div>
              <div class="rd-ctl" style=${{ margin: 0 }}>${set.campaign ? html`<span class="rd-chip">${campLabel(set.campaign).split(' (')[0] || set.campaign}</span>` : null}<span class="rd-chip">${items.length} pieces</span><span class="rd-chip">${items.filter(it => it.check && !it.check.ok).length} flagged</span><span class="rd-chip">${items.filter(it => it.verdict === 'approved').length} approved</span></div>
            </div>
            ${grouped.map(([p, list]) => html`<div key=${p} class="cd-group">
              <div class="cd-grouphead"><b>${(specs[p] || FALLBACK[p] || {}).label || p}</b><span class="m">${list.length} piece${list.length === 1 ? '' : 's'} - up to ${(specs[p] || FALLBACK[p] || {}).max} characters</span></div>
              <div class="cd-grid">${list.map(it => html`<${Piece} key=${it.n} item=${it} spec=${specs[p] || FALLBACK[p] || {}} selected=${selected === it.n} canWrite=${canWrite} onSelect=${onSelect} onSave=${onSave} onVerdict=${onVerdict} />`)}</div>
            </div>`)}
          </div>
        </div>
        <div class="cd-side" ref=${chatRef}>
          <${Chat} set=${set} items=${items} target=${target} setTarget=${v => { setTarget(v); setSelected(v === 'all' ? null : +v); }} remember=${remember} setRemember=${setRemember} onSend=${send} busy=${busy.chat} client=${client} canWrite=${canWrite} onLearned=${() => setShowLearned(true)} />
        </div>
      </div>` : null}
      ${history.length ? html`<div class="panel">
        <div class="phead"><div class="ptitle">Recent sets - ${client.short || ns}</div><span class="ptag">${history.length}</span></div>
        <div class="rel-hist">${history.map(h => html`<button key=${h.id} class=${'rel-histrow' + (set && set.id === h.id ? ' on' : '')} onClick=${() => openSet(h.id).then(() => setResult(null))}>
          <span class="t">${h.brief || h.id}</span><span class="m">${(h.platforms || []).join(', ')} - ${h.pieces} pieces${h.approved ? ' - ' + h.approved + ' approved' : ''}${h.flagged ? ' - ' + h.flagged + ' flagged' : ''} - ${ago(h.created)} ago${h.who ? ' - ' + h.who : ''}</span>
        </button>`)}</div>
      </div>` : null}
      ${!set && !history.length && !job ? html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}><b>Nothing written for ${client.short || ns} yet.</b> Pick a campaign and the platforms, write a one-line brief and press Write. ${kit && (kit.campaigns || []).length ? '' : 'Load the voice pack first so the Desk knows the sign-offs, the approved figures and the words never to use.'}</div>` : null}
    </div>`;
  }

  let mounted = false;
  window.contentInit = function () {
    const root = document.getElementById('content-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${ContentApp} />`); }
  };
})();
