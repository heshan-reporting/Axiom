/* AXIOM Creative Studio - the guided workflow (S17).
 *
 * The parts of the Studio a project made by the wizard walks through, in order: the project wizard (type, client,
 * campaign context, the brief), the brief workspace (several pieces of material read as one, the honest processing
 * checklist, Axiom's understanding to review), the Objectives and Strategy steps, the Creative Directions board, and
 * the production-mode choice in Design. Every state shown here is the worker's (p.workflow): a locked step says what
 * unlocks it, a change to an earlier choice asks what to do with the work built on it, and nothing moves the person
 * to another step by itself - finished work is announced with a button to go and see it.
 * Loads after studio.js, which shares its renderer, chips, icons and helpers as window.STKit. */
(function () {
  'use strict';
  const K = window.STKit; if (!K || !window.React) return;
  const { html, call, blobUrl, toastMsg, ago, Chip, Icon, Lbl, Composition, explain, canWrite, chanLabel, CHANNELS, WORD, INPUT_WORD, STRAT_WORD, BASIS_WORD, FIELD_WORD, KNOW_WORD, VIS_WORD, CLAIM_WORD, StrategyPanel } = K;
  const { useState, useEffect, useMemo, useRef } = React;
  const S = window.STProgress;

  /* ------------------------------------------------------------ vocabulary */
  const TYPES = [
    ['campaign', 'Campaign Creative', 'Ongoing campaign work: one argument across channels', 'flag'],
    ['response', 'Response Creative', 'Answer something that has happened', 'reply'],
    ['social', 'Social Content', 'Posts for the client\'s own channels', 'chat'],
    ['paid', 'Paid Advertisement', 'Ads with a budget behind them', 'megaphone'],
    ['announcement', 'Announcement', 'News the client is making', 'bell'],
    ['news_response', 'News Response', 'React to a story in the media', 'news'],
    ['explainer', 'Explainer', 'Make something complicated clear', 'bulb'],
    ['brand', 'Brand Content', 'Who the client is and what it stands for', 'diamond'],
    ['reactive', 'Reactive Content', 'A fast turn-around on a live moment', 'bolt'],
    ['other', 'Other', 'Anything else', 'dots'],
  ];
  const TYPE_CHANNELS = { campaign: ['facebook', 'instagram', 'linkedin'], response: ['facebook', 'x', 'linkedin'], social: ['facebook', 'instagram'], paid: ['facebook', 'instagram'], announcement: ['linkedin', 'facebook', 'x'], news_response: ['x', 'facebook', 'linkedin'], explainer: ['instagram', 'linkedin'], brand: ['instagram', 'linkedin'], reactive: ['x', 'facebook'], other: ['facebook', 'instagram'] };
  const STEP_WORD = { not_started: 'Not started', in_progress: 'In progress', processing: 'Processing', needs_review: 'Needs review', complete: 'Complete', locked: 'Locked', error: 'Error', skipped: 'Skipped' };
  const STEP_LABEL = { brief: 'Brief', objectives: 'Objectives', strategy: 'Strategy', directions: 'Explore', copy: 'Copy', design: 'Design', review: 'Review & Deliver' };
  // S20: the five phases the person moves between, over the worker's seven steps
  const PHASE_STEPS = [['Brief', ['brief', 'objectives', 'strategy']], ['Explore', ['directions']], ['Copy', ['copy']], ['Design', ['design']], ['Review & Deliver', ['review']]];
  const SUB_LABEL = { brief: 'Understanding', objectives: 'Objectives', strategy: 'Strategy' };
  const STARTS = [
    ['brief', 'Paste a Brief', 'pen'], ['situation', 'Describe a Situation', 'chat'], ['article', 'Paste an Article', 'news'], ['url', 'Add a URL', 'link'],
    ['file', 'Upload Files', 'upload'], ['screenshot', 'Upload Screenshot', 'image'], ['campaign', 'Use Existing Campaign', 'flag'], ['axiom', 'Start With Axiom', 'sparkle'],
  ];
  const PLACEHOLDER = 'Paste a brief, describe what happened, upload an article, or tell Axiom what you need to respond to...';

  /* ------------------------------------------------------------ the honest processing checklist */
  /* each item is a phase the worker reports while the job runs (progress.activity.step or .phase); what came before the
     current phase is done, the current one is working, the rest wait. A model call shows no share until it answers. */
  const CHECKLISTS = {
    analyse: { title: 'Understanding your brief', items: [['reading', 'Reading the material'], ['knowledge', 'Matching client knowledge'], ['model', 'Checking campaign relevance, topics, issues, facts and risks', 'and drafting objectives and the strategy Axiom recommends'], ['checking', 'Checking every citation against what was given'], ['filing', 'Filing the understanding']] },
    direct: { title: 'Building Creative Directions', items: [['strategy', 'Reviewing the selected strategy'], ['campaign', 'Matching campaign messaging'], ['model', 'Developing visual narratives', 'and generating creative concepts'], ['checking', 'Measuring how different they are'], ['filing', 'Filing the directions']] },
    copy: { title: 'Writing the copy and the visual narrative', items: [['context', 'Gathering the direction, the voice and the facts'], ['model', 'Writing each channel\'s words', 'and planning its composition'], ['composing', 'Laying out each composition'], ['queueing', 'Filing the pieces']] },
  };
  function stepOf(kind, a) {
    const ph = a.step || a.phase || '';
    if (kind === 'analyse' && ph === 'model' && !a.step) return 'reading';   // the file transcription call, inside "reading the material"
    if (kind === 'copy' && (!ph || ph === 'starting')) return 'context';
    return ph;
  }
  function ProcessingCard({ job, kind, now, onRetry, onCancel, onManual, onChange, durations }) {
    const cl = CHECKLISTS[kind] || CHECKLISTS.analyse; if (!job) return null;
    const a = (job.progress || {}).activity || {}; const x = S ? S.job(job, now || Date.now(), (durations || {})[job.stage]) : { time: '', typical: '' };
    const order = cl.items.map(i => i[0]); const cur = stepOf(kind, a); let at = order.indexOf(cur);
    const failed = job.state === 'failed', done = job.state === 'done', queued = job.state === 'queued';
    if (done) at = order.length; if (queued || at < 0) at = queued ? -1 : 0;
    return html`<section class=${'st-proc' + (failed ? ' failed' : done ? ' done' : '')} role="status" aria-live="polite" aria-label=${cl.title}>
      <div class="st-proc-head"><span class=${'st-proc-orb' + (failed ? ' bad' : done ? ' ok' : '')} aria-hidden="true">${done ? html`<${Icon} n="check" size=${18} />` : failed ? html`<${Icon} n="alert" size=${18} />` : html`<span class="st-proc-spin"></span>`}</span>
        <div><h3>${failed ? 'We couldn\'t complete this generation.' : done ? cl.title.replace(/^Building /, '').replace(/^Understanding your brief$/, 'Understanding ready') + (done && kind !== 'analyse' ? ' ready' : '') : cl.title}</h3>
          <span class="ov-dim">${failed ? explain({ message: job.error, code: (String(job.error || '').match(/^[a-z_0-9]+/) || [''])[0] }).title + '. Nothing you made before was touched.' : queued ? 'Queued, waiting to start' : done ? 'Finished in ' + x.time : x.time + (x.typical ? ' so far, typically ' + x.typical : ' so far') + '. One model call: no share is shown until it answers.'}</span></div></div>
      <ol class="st-proc-list">${cl.items.map(([k, l, sub], i) => { const st = failed && i === Math.max(0, at) ? 'bad' : i < at ? 'done' : i === at && !done ? 'now' : 'wait'; return html`<li key=${k} class=${'st-proc-item ' + st} style=${{ '--i': i }}><span class="st-proc-dot" aria-hidden="true">${st === 'done' ? html`<${Icon} n="check" size=${12} />` : st === 'bad' ? '!' : ''}</span><span>${l}${sub ? html` <span class="ov-dim">${sub}</span>` : null}${st === 'now' && a.completed != null && a.total ? html` <span class="st-proc-count">${a.completed} of ${a.total}</span>` : null}</span></li>`; })}</ol>
      ${failed ? html`<div class="st-proc-acts">${onRetry ? html`<button class="btn sm" onClick=${onRetry}>Retry</button>` : null}${onChange ? html`<button class="btn sm ghost" onClick=${onChange}>Change input</button>` : null}${onManual ? html`<button class="btn sm ghost" onClick=${onManual}>Continue manually</button>` : null}</div>`
        : !done && onCancel ? html`<div class="st-proc-acts"><button class="ov-link" onClick=${onCancel}>Cancel</button><span class="ov-dim">a call already sent may still finish and be billed</span></div>` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ locked steps, ready notices, the impact question */
  function LockedStage({ step, wf, onGo }) {
    const s = (wf && wf.steps && wf.steps[step]) || {}; const order = (wf && wf.order) || Object.keys(STEP_LABEL);
    const unlock = order.slice(0, order.indexOf(step)).find(k => wf.steps[k] && wf.steps[k].state !== 'complete' && wf.steps[k].state !== 'skipped');
    return html`<div class="st-locked" role="region" aria-label=${STEP_LABEL[step] + ' is locked'}>
      <span class="st-locked-ic" aria-hidden="true"><${Icon} n="lock" size=${26} /></span>
      <h3>${STEP_LABEL[step]} is locked</h3>
      <p>${s.need || 'Complete the step before it to continue.'}</p>
      ${unlock && onGo ? html`<button class="btn sm" onClick=${() => onGo(unlock)}>Go to ${STEP_LABEL[unlock]}</button>` : null}
    </div>`;
  }
  /** The question a change to an earlier choice asks before anything is written: update the work built on it, keep it, or cancel. */
  function ImpactDialog({ q, onAnswer }) {
    if (!q) return null; const im = q.impact || {};
    const what = [im.directions ? im.directions + ' creative direction' + (im.directions === 1 ? '' : 's') + (im.chosen ? ' (one chosen)' : '') : '', im.assets ? im.assets + ' piece' + (im.assets === 1 ? '' : 's') + ' of copy and design' + (im.approvals ? ', ' + im.approvals + ' with an approval' : '') : ''].filter(Boolean).join(' and ');
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="This change affects later work"><div class="st-dialog-box narrow st-impact">
      <span class="st-impact-ic" aria-hidden="true"><${Icon} n="alert" size=${22} /></span>
      <div class="ov-title">${q.title || 'Changing this may affect your current Creative Directions'}</div>
      <div class="st-pad">${what ? 'Built on the current choice: ' + what + '. ' : ''}Nothing is deleted either way.</div>
      <ul class="st-ul st-impact-opts"><li><b>Update directions</b>: the existing work stays, marked as built on the earlier choice, and new directions are built on the new one (1 model call).</li><li><b>Keep existing directions</b>: the work stays current under the new choice; nothing is regenerated.</li></ul>
      <div class="st-dialog-acts"><button class="btn sm" onClick=${() => onAnswer('update')}>Update directions</button><button class="btn sm ghost" onClick=${() => onAnswer('keep')}>Keep existing directions</button><button class="btn sm ghost" onClick=${() => onAnswer(null)}>Cancel</button></div>
    </div></div>`;
  }

  /* ------------------------------------------------------------ the material composer: several pieces, one brief */
  /** A brief rarely arrives as one thing: text, links, files, screenshots, notes, something Axiom holds, a campaign. Each
      becomes a source; they are read together. The composer keeps them as a list until the project asks for them. */
  function MaterialComposer({ client, kit, text, setText, kind, setKind, items, setItems, busy, compact }) {
    const [mode, setMode] = useState(''); const [url, setUrl] = useState(''); const [note, setNote] = useState(''); const [feed, setFeed] = useState(null); const [err, setErr] = useState('');
    const fileRef = useRef(null); const shotRef = useRef(null);
    const add = it => setItems(items.concat([Object.assign({ key: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, it)]));
    const camps = ((kit && kit.campaigns) || []).filter(c => c.active !== false);
    const start = k => { setErr(''); if (k === 'url' || k === 'campaign' || k === 'axiom') { setMode(mode === k ? '' : k); return; } if (k === 'file') { fileRef.current && fileRef.current.click(); return; } if (k === 'screenshot') { shotRef.current && shotRef.current.click(); return; } setKind(k); setMode(''); };
    useEffect(() => { if (mode !== 'axiom' || feed || !client) return; let live = true; call('/studio/intake/feed?ns=' + encodeURIComponent(client.id)).then(d => { if (live) setFeed(d); }).catch(e => { if (live) setFeed({ error: e.message }); }); return () => { live = false; }; }, [mode]);
    const readFile = (f, shot) => new Promise(res => {
      if (f.size > 8000000) { setErr(f.name + ' is over 8 MB: upload a smaller copy, or paste the part that matters.'); return res(null); }
      const bin = /^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const rd = new FileReader();
      if (bin) { rd.onload = () => res({ type: 'file', label: f.name, mime: f.type || 'application/pdf', b64: String(rd.result).split(',')[1], kb: Math.round(f.size / 1024), shot: !!shot }); rd.readAsDataURL(f); return; }
      rd.onload = () => { let t = String(rd.result || ''); if (/html?$/i.test(f.name) || /<\/(p|div|h\d)>/i.test(t)) { const d = new DOMParser().parseFromString(t, 'text/html'); d.querySelectorAll('script,style,nav,header,footer').forEach(x => x.remove()); t = Array.from(d.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote')).map(x => x.textContent.trim()).filter(Boolean).join('\n\n') || d.body.textContent; } res({ type: 'text', label: f.name, text: t.trim(), kind: 'upload' }); };
      rd.readAsText(f);
    });
    const pickFiles = async (e, shot) => { const fs = Array.from((e.target.files || [])); e.target.value = ''; const got = []; for (const f of fs.slice(0, 6)) { const it = await readFile(f, shot); if (it) got.push(Object.assign({ key: 'm' + Math.random().toString(36).slice(2, 9) }, it)); } if (got.length) setItems(items.concat(got)); };
    const urlOk = /^https?:\/\/\S+\.\S+/.test(url.trim());
    const n = items.length + (text.trim().length >= 20 ? 1 : 0);
    return html`<div class=${'st-compose' + (compact ? ' compact' : '')} aria-label="Brief material">
      <div class="st-starts" role="group" aria-label="Starting points">${STARTS.map(([k, l, ic], i) => html`<button key=${k} class=${'st-start' + ((kind === k && !mode && ['brief', 'situation', 'article'].indexOf(k) >= 0) || mode === k ? ' on' : '')} style=${{ '--i': i }} aria-pressed=${(kind === k && !mode) || mode === k} disabled=${k === 'campaign' && !camps.length} title=${k === 'campaign' && !camps.length ? 'This client has no campaign in its kit yet' : ''} onClick=${() => start(k)}><${Icon} n=${ic} size=${16} /><span>${l}</span></button>`)}</div>
      <input ref=${fileRef} type="file" multiple hidden accept=".txt,.md,.markdown,.html,.htm,.pdf,application/pdf,text/plain,text/markdown,text/html" onChange=${e => pickFiles(e, false)} aria-label="Upload files" />
      <input ref=${shotRef} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif" onChange=${e => pickFiles(e, true)} aria-label="Upload screenshots" />
      ${mode === 'url' ? html`<div class="st-compose-row"><input class="st-in" type="url" value=${url} placeholder="https://... a news story, a statement, a post" aria-label="Link to the material" onInput=${e => setUrl(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && urlOk) { add({ type: 'url', label: url.trim(), url: url.trim() }); setUrl(''); } }} /><button class="btn sm" disabled=${!urlOk} onClick=${() => { add({ type: 'url', label: url.trim(), url: url.trim() }); setUrl(''); }}>Add link</button><span class="ov-dim">read through Axiom's full-text reader when the project analyses it</span></div>` : null}
      ${mode === 'campaign' ? html`<div class="st-compose-row wrap">${camps.map(c => html`<button key=${c.id} class="st-chipbtn" onClick=${() => { add({ type: 'campaign', label: 'Campaign: ' + c.name, text: ['Campaign: ' + c.name, c.notes, c.tone ? 'Tone: ' + c.tone : '', c.structure ? 'Structure: ' + c.structure : '', c.cta ? 'Call to action: ' + c.cta : '', c.url ? 'URL: ' + c.url : ''].filter(Boolean).join('\n\n'), campaign: c.id }); setMode(''); }}>${c.name}</button>`)}<span class="ov-dim">the campaign's own notes join the brief as material</span></div>` : null}
      ${mode === 'axiom' ? html`<div class="st-feed st-compose-feed" aria-label="What Axiom holds for this client">${!feed ? html`<div class="ov-dim">Reading what Axiom holds for ${client ? client.name : 'the client'}...</div>` : feed.error ? html`<div class="ov-dim">${feed.error}</div>` : html`
        ${feed.brief ? html`<div class="st-feed-row"><span><b>Daily brief ${feed.brief.day}</b> <span class="ov-dim">${feed.brief.headline}</span></span><button class="btn sm ghost" onClick=${() => add({ type: 'item', item: 'brief', id: feed.brief.day, label: 'Daily brief ' + feed.brief.day })}>Add</button></div>` : null}
        ${(feed.alerts || []).map(x => html`<div key=${'a' + x.id} class="st-feed-row"><span><${Chip} kind="warn">Sentinel</${Chip}> <b>${x.label}</b> <span class="ov-dim">x${x.ratio}, ${ago(x.at)} ago</span></span><button class="btn sm ghost" onClick=${() => add({ type: 'item', item: 'alert', id: x.id, label: 'Sentinel: ' + x.label })}>Add</button></div>`)}
        ${(feed.narratives || []).map(x => html`<div key=${'n' + x.id} class="st-feed-row"><span><${Chip}>narrative</${Chip}> <b>${x.label}</b> <span class="ov-dim">${x.rows} rows, ${x.status}</span></span><button class="btn sm ghost" onClick=${() => add({ type: 'item', item: 'narrative', id: x.id, label: 'Narrative: ' + x.label })}>Add</button></div>`)}
        ${(feed.news || []).map(x => html`<div key=${'s' + x.id} class="st-feed-row"><span><${Chip}>news</${Chip}> <b>${x.title}</b> <span class="ov-dim">${x.outlet}</span></span><button class="btn sm ghost" onClick=${() => add({ type: 'item', item: 'news', id: x.id, label: x.title })}>Add</button></div>`)}
        ${!feed.brief && !(feed.alerts || []).length && !(feed.narratives || []).length && !(feed.news || []).length ? html`<div class="ov-dim">Nothing live for ${client ? client.name : 'this client'}: no alerts, narratives or news on its issues in the last days.</div>` : null}`}</div>` : null}
      <textarea class="st-ta st-compose-ta" rows=${compact ? 6 : 9} value=${text} placeholder=${PLACEHOLDER} aria-label="The brief or the material" onInput=${e => setText(e.target.value)}></textarea>
      <div class="st-compose-row"><input class="st-in" value=${note} placeholder="Add a note for Axiom, e.g. only the regional angle, due Friday" aria-label="A note" onInput=${e => setNote(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && note.trim()) { add({ type: 'note', label: note.trim(), text: note.trim() }); setNote(''); } }} /><button class="btn sm ghost" disabled=${!note.trim()} onClick=${() => { add({ type: 'note', label: note.trim(), text: note.trim() }); setNote(''); }}><${Icon} n="plus" size=${13} /> Note</button></div>
      ${err ? html`<div class="st-compose-err" role="alert">${err}</div>` : null}
      ${items.length ? html`<ul class="st-tray" aria-label="Material added">${items.map(it => html`<li key=${it.key} class=${'st-tray-item ' + it.type}><${Icon} n=${it.type === 'url' ? 'link' : it.type === 'file' ? (it.shot || /^image/.test(it.mime || '') ? 'image' : 'file') : it.type === 'item' ? 'sparkle' : it.type === 'campaign' ? 'flag' : it.type === 'note' ? 'pen' : 'file'} size=${14} /><span class="st-tray-l" title=${it.label}>${it.label}</span><span class="ov-dim">${it.type === 'file' ? it.kb + ' KB' : it.type === 'url' ? 'link' : it.type === 'item' ? 'from Axiom' : it.type}</span>${!busy ? html`<button class="st-tray-x" aria-label=${'Remove ' + it.label} onClick=${() => setItems(items.filter(x => x.key !== it.key))}><${Icon} n="x" size=${12} /></button>` : null}</li>`)}</ul>` : null}
      <div class="st-compose-foot ov-dim" role="status">${n ? n + ' piece' + (n === 1 ? '' : 's') + ' of material: read together as one brief' : 'Nothing added yet: write, paste, link or upload'}</div>
    </div>`;
  }
  /** Each piece of material becomes a source of the project; the ids are what one analysis reads together. */
  async function materialSources(pid, text, kind, items) {
    const ids = []; const fails = [];
    if (text && text.trim().length >= 20) { const r = await call('/studio/source', { project: pid, kind: 'analyse:' + (kind || 'brief'), name: (text.trim().split('\n').map(x => x.replace(/^#+\s*/, '').trim()).filter(Boolean)[0] || 'Brief').slice(0, 80), text: text.trim(), provenance: 'pasted' }); ids.push(r.id); }
    for (const it of items || []) {
      try {
        if (it.type === 'url') ids.push((await call('/studio/source/url', { project: pid, url: it.url })).id);
        else if (it.type === 'file') ids.push((await call('/studio/source', { project: pid, name: it.label, fileB64: it.b64, mime: it.mime, provenance: 'upload: ' + it.label })).id);
        else if (it.type === 'item') ids.push((await call('/studio/source/item', { project: pid, type: it.item, id: it.id })).id);
        else if (it.text && it.text.trim().length >= 20) ids.push((await call('/studio/source', { project: pid, kind: 'analyse:' + (it.type === 'campaign' ? 'brief' : it.type === 'note' ? 'note' : it.kind || 'upload'), name: it.label.slice(0, 80), text: it.text, provenance: it.type === 'campaign' ? 'campaign ' + it.campaign : it.type === 'note' ? 'note' : 'upload' })).id);
        else if (it.text) fails.push(it.label + ' (too short to read on its own: add it to the main text)');
      } catch (e) { fails.push(it.label + ': ' + ((e && (e.detail || e.message)) || e)); }
    }
    return { ids, fails };
  }

  /* ------------------------------------------------------------ the project wizard */
  function ClientLogo({ c, size }) {
    const [u, setU] = useState('');
    useEffect(() => { let live = true; setU(''); if (c && c.hasLogo) blobUrl('/brand/logo?ns=' + encodeURIComponent(c.ns || c.id) + (c.logoV ? '&v=' + encodeURIComponent(c.logoV) : '')).then(x => { if (live) setU(x); }).catch(() => {}); return () => { live = false; }; }, [c && (c.ns || c.id), c && c.logoV]);
    const initials = String((c && c.name) || '?').split(/\s+/).filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 3) || '?';
    return u ? html`<img class="st-clogo" src=${u} alt="" style=${{ width: (size || 44) + 'px', height: (size || 44) + 'px' }} />` : html`<span class="st-clogo ph" aria-hidden="true" style=${{ width: (size || 44) + 'px', height: (size || 44) + 'px', '--c': (c && c.accent) || '#5dd4e5' }}>${initials}</span>`;
  }
  /** Four steps before a project exists: what kind of work, for which client, in which campaign context, and the brief. */
  function Wizard({ clients, clientId, preset, onCreate, onCancel, onClient, busy, prov }) {
    // the model that reads the brief is checked before it is asked for: without it the project is made, unanalysed
    const noClaude = !!(prov && prov.claude === false); const NO_CLAUDE = 'Claude is not configured on the worker (ANTHROPIC_API_KEY): create the project now and analyse the brief once it is. Nothing is spent.';
    const pr = preset || {};
    const [step, setStep] = useState(0);
    const [type, setType] = useState(pr.type || '');
    const [ns, setNs] = useState(pr.ns || clientId || '');
    const [q, setQ] = useState('');
    const [info, setInfo] = useState(null); const [inv, setInv] = useState(null); const [kit, setKit] = useState(null);
    const [cmode, setCmode] = useState(''); const [camp, setCamp] = useState(''); const [ncName, setNcName] = useState(''); const [ncDesc, setNcDesc] = useState('');
    const [title, setTitle] = useState(''); const [text, setText] = useState(pr.text || ''); const [kind, setKind] = useState(pr.kind || 'brief'); const [items, setItems] = useState([]);
    const [chs, setChs] = useState(null); const [deliverable, setDeliverable] = useState('set');
    useEffect(() => { let live = true; call('/studio/clients?ns=' + encodeURIComponent(clients.map(c => c.id).join(','))).then(d => { if (live) setInfo(d.clients || []); }).catch(() => { if (live) setInfo([]); }); return () => { live = false; }; }, []);
    // choosing a client prepares its knowledge in the background: the kit and what of it reaches the models
    useEffect(() => { if (!ns) return; let live = true; setInv(null); setKit(null); setCamp(''); setCmode('');
      call('/brand/kit?ns=' + encodeURIComponent(ns)).then(d => { if (live) setKit((d && d.kit) || {}); }).catch(() => { if (live) setKit({}); });
      call('/brand/inventory?ns=' + encodeURIComponent(ns)).then(d => { if (live) setInv(d); }).catch(e => { if (live) setInv({ error: e.message }); });
      return () => { live = false; }; }, [ns]);
    useEffect(() => { if (type && !chs) setChs(TYPE_CHANNELS[type] || ['facebook', 'instagram']); }, [type]);
    const merged = clients.map(c => Object.assign({ ns: c.id, campaigns: [], projects: 0, knowledge: {} }, (info || []).find(x => x.ns === c.id) || {}, { id: c.id, name: c.name, accent: c.accent }));
    const shown = merged.filter(c => !q.trim() || (c.name + ' ' + c.id + ' ' + c.campaigns.map(x => x.name).join(' ')).toLowerCase().indexOf(q.trim().toLowerCase()) >= 0);
    const client = merged.find(c => c.id === ns) || null;
    const camps = ((kit && kit.campaigns) || []).filter(c => c.active !== false);
    const campOk = cmode === 'existing' ? !!camp : cmode === 'new' ? ncName.trim().length >= 2 : !!cmode;
    const hasMaterial = text.trim().length >= 20 || items.length > 0;
    const can = [!!type, !!ns, campOk, true][step];
    const steps = [['Project type', 'What are we making?'], ['Client', 'Who is it for?'], ['Campaign', 'Which campaign context?'], ['Brief', 'What do we need to respond to?']];
    const next = () => { if (can && step < 3) setStep(step + 1); };
    const make = analyse => onCreate({ type, ns, campaignMode: cmode, campaign: cmode === 'existing' ? camp : '', newCampaign: cmode === 'new' ? { name: ncName.trim(), description: ncDesc.trim() } : null, title: title.trim(), text, kind, items, channels: deliverable === 'visual' ? ['instagram'] : (chs || []).filter(c => CHANNELS[c]), deliverable, analyse, kit });
    const keys = e => { if (e.key === 'Escape') { e.preventDefault(); onCancel(); } else if (e.key === 'Enter' && !e.shiftKey && step < 3 && can && !/TEXTAREA|INPUT/.test((e.target || {}).tagName || '')) { e.preventDefault(); next(); } };
    const usable = inv && !inv.error ? (inv.usable || []).filter(u => u.n) : [];
    return html`<div class="st-wiz" onKeyDown=${keys} role="region" aria-label="Create a project">
      <div class="st-wiz-top"><div><span class="st-eyebrow-n">New project</span><h2 class="st-wiz-title">${steps[step][1]}</h2></div><button class="ov-link" onClick=${onCancel}>Cancel</button></div>
      <ol class="st-wiz-steps" aria-label="Steps">${steps.map(([l], i) => html`<li key=${l} class=${i < step ? 'done' : i === step ? 'on' : ''}><button disabled=${i > step} onClick=${() => i < step && setStep(i)} aria-current=${i === step ? 'step' : undefined}><span class="st-wiz-n">${i < step ? html`<${Icon} n="check" size=${12} />` : i + 1}</span>${l}</button></li>`)}</ol>
      <div class="st-wiz-body" key=${'s' + step}>
        ${step === 0 ? html`<div class="st-types" role="radiogroup" aria-label="Project type">${TYPES.map(([k, l, t, ic], i) => html`<button key=${k} role="radio" aria-checked=${type === k} class=${'st-type' + (type === k ? ' on' : '')} style=${{ '--i': i }} onClick=${() => { setType(k); setChs(TYPE_CHANNELS[k]); }} onDoubleClick=${() => { setType(k); setStep(1); }}><span class="st-type-ic"><${Icon} n=${ic} size=${22} /></span><b>${l}</b><span>${t}</span></button>`)}</div>` : null}
        ${step === 1 ? html`<div class="st-cpick">
          <label class="st-search"><${Icon} n="search" size=${15} /><input class="st-in" value=${q} placeholder="Search clients and campaigns" aria-label="Search clients" onInput=${e => setQ(e.target.value)} /></label>
          <div class="st-clients" role="radiogroup" aria-label="Client">${!info ? html`<div class="ov-dim">Reading the clients...</div>` : shown.map((c, i) => html`<button key=${c.id} role="radio" aria-checked=${ns === c.id} class=${'st-client-card' + (ns === c.id ? ' on' : '')} style=${{ '--i': i, '--c': c.accent }} onClick=${() => { setNs(c.id); if (onClient) onClient(c.id); }}>
            <${ClientLogo} c=${c} /><span class="st-client-main"><b>${c.name}</b><span class="st-client-camps">${c.campaigns.length ? c.campaigns.slice(0, 3).map(x => html`<span key=${x.id} class="st-mini-chip">${x.name}</span>`) : html`<span class="ov-dim">no campaign in the kit</span>`}${c.campaigns.length > 3 ? html`<span class="ov-dim">+${c.campaigns.length - 3}</span>` : null}</span>
            <span class="ov-dim st-client-act">${c.last ? 'Last: ' + c.last.title + ', ' + ago(c.last.updated) + ' ago' : 'No projects yet'}${c.projects ? ' - ' + c.projects + ' project' + (c.projects === 1 ? '' : 's') : ''}</span></span></button>`)}</div>
          ${client ? html`<div class="st-knowprep" role="status" aria-live="polite"><span class=${'st-knowprep-dot' + (inv ? ' ok' : '')} aria-hidden="true"></span>${!inv ? 'Preparing ' + client.name + '\'s knowledge...' : inv.error ? 'Knowledge not read: ' + inv.error : html`<span><b>${client.name}'s knowledge is ready.</b> ${usable.length ? usable.map(u => u.n + ' ' + u.kind).join(' - ') : 'Nothing on file yet: the brief carries everything.'}${(inv.notRetrieved || []).length ? html` <span class="ov-dim">(${inv.notRetrieved.length} stored item${inv.notRetrieved.length === 1 ? '' : 's'} not used: see Brand)</span>` : null}</span>`}</div>` : null}
        </div>` : null}
        ${step === 2 ? html`<div class="st-cmode">
          <div class="st-cmodes" role="radiogroup" aria-label="Campaign context">${[['existing', 'Select existing campaign', 'Work inside one of ' + (client ? client.name : 'the client') + '\'s campaigns: its marks, facts and tone apply', 'flag'], ['new', 'Create new campaign', 'Start a campaign in the brand kit for this work', 'plus'], ['standalone', 'Standalone', 'No campaign: the client\'s own identity and facts only', 'square'], ['detect', 'Let Axiom detect', 'Axiom reads the brief and recommends a campaign; you decide', 'sparkle']].map(([k, l, t, ic], i) => html`<button key=${k} role="radio" aria-checked=${cmode === k} class=${'st-type' + (cmode === k ? ' on' : '')} style=${{ '--i': i }} disabled=${k === 'existing' && kit && !camps.length} onClick=${() => setCmode(k)}><span class="st-type-ic"><${Icon} n=${ic} size=${20} /></span><b>${l}</b><span>${k === 'existing' && kit && !camps.length ? 'This client has no campaign in its kit yet' : t}</span></button>`)}</div>
          ${cmode === 'existing' ? html`<div class="st-camps" role="radiogroup" aria-label="Campaign">${camps.map((c, i) => html`<button key=${c.id} role="radio" aria-checked=${camp === c.id} class=${'st-camp' + (camp === c.id ? ' on' : '')} style=${{ '--i': i }} onClick=${() => setCamp(c.id)}><b>${c.name}</b><span class="ov-dim">${c.notes || c.tone || 'No notes in the kit'}</span><span class="st-mini-chip">${c.logoPolicy === 'wordmark' ? 'carries its wordmark' : c.logoPolicy === 'both' ? 'logo and wordmark' : c.logoPolicy === 'none' ? 'no mark' : 'client logo'}</span></button>`)}</div>` : null}
          ${cmode === 'new' ? html`<div class="st-newcamp"><label><span class="st-lbl">Campaign name</span><input class="st-in" value=${ncName} onInput=${e => setNcName(e.target.value)} placeholder="e.g. Regional jobs 2026" aria-label="Campaign name" /></label><label><span class="st-lbl">What it is for</span><textarea class="st-ta" rows="3" value=${ncDesc} onInput=${e => setNcDesc(e.target.value)} placeholder="The argument, the audience, the period" aria-label="Campaign description"></textarea></label><div class="ov-dim">The campaign is added to ${client ? client.name : 'the client'}'s brand kit when the project is created (a recorded kit revision). Its marks and facts can be added in Brand.</div></div>` : null}
          ${cmode === 'detect' ? html`<div class="ov-dim st-pad">Axiom will compare the brief with ${camps.length ? camps.map(c => c.name).join(', ') : 'the kit\'s campaigns'} and recommend one, with its confidence. Use it or keep the work standalone: nothing is assumed.</div>` : null}
        </div>` : null}
        ${step === 3 ? html`<div class="st-wiz-brief">
          <div class="st-wiz-meta"><label class="st-wiz-titlein"><span class="st-lbl">Project name</span><input class="st-in" value=${title} onInput=${e => setTitle(e.target.value)} placeholder="Named from the brief if left empty" aria-label="Project name" /></label>
            <div><span class="st-lbl">Deliverable</span><div class="st-seg">${[['set', 'Coordinated set'], ['visual', 'One visual'], ['copy', 'Copy only']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (deliverable === k ? ' on' : '')} aria-pressed=${deliverable === k} onClick=${() => setDeliverable(k)}>${l}</button>`)}</div></div>
            ${deliverable !== 'visual' ? html`<div><span class="st-lbl">Channels</span><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + ((chs || []).indexOf(k) >= 0 ? ' on' : '')} aria-pressed=${(chs || []).indexOf(k) >= 0} onClick=${() => setChs((chs || []).indexOf(k) >= 0 ? (chs || []).filter(x => x !== k) : (chs || []).concat([k]))}>${CHANNELS[k].label}</button>`)}</div></div>` : null}</div>
          <${MaterialComposer} client=${client} kit=${kit} text=${text} setText=${setText} kind=${kind} setKind=${setKind} items=${items} setItems=${setItems} busy=${busy} />
        </div>` : null}
      </div>
      <div class="st-wiz-foot">
        ${step > 0 ? html`<button class="btn sm ghost" onClick=${() => setStep(step - 1)}><${Icon} n="back" size=${14} /> Back</button>` : html`<span></span>`}
        <span class="ov-dim">${step === 0 ? (type ? TYPES.find(t => t[0] === type)[1] + ' chosen' : 'Choose what kind of work this is') : step === 1 ? (client ? client.name : 'Choose the client') : step === 2 ? (cmode ? { existing: camp ? 'Inside ' + ((camps.find(c => c.id === camp) || {}).name || camp) : 'Choose the campaign', new: 'A new campaign in the kit', standalone: 'Standalone', detect: 'Axiom will recommend a campaign' }[cmode] : 'Choose the campaign context') : 'Analysing is one model call; nothing else is spent until you choose'}</span>
        ${step < 3 ? html`<button class="btn sm" disabled=${!can} onClick=${next}>Next <${Icon} n="arrow" size=${14} /></button>`
          : html`<span class="st-wiz-go"><button class="btn sm ghost" disabled=${!!busy || (deliverable !== 'visual' && !(chs || []).length)} onClick=${() => make(false)}>Create without analysing</button><button class="btn sm" disabled=${!!busy || noClaude || !hasMaterial || (deliverable !== 'visual' && !(chs || []).length)} title=${noClaude ? NO_CLAUDE : !hasMaterial ? 'Write, paste, link or upload the brief first' : ''} onClick=${() => make(true)}>Create and analyse <span class="ov-dim">(1 model call)</span></button></span>`}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ the brief workspace and Axiom's understanding */
  function UnderstandingReview({ p, it, client, kit, ro, busy, onConfirm, onCampaign, onAgain, wf }) {
    const a = (p.brief || {}).analysis || {}; const sit = it.situation || {}; const u = it.understanding || {}; const cmp = it.comparison || {};
    const [showParas, setShowParas] = useState(false);
    const camps = ((kit && kit.campaigns) || []); const c = it.campaign || {};
    const topicsBy = r => (it.topics || []).filter(t => t.relevance === r);
    const st = (wf && wf.steps && wf.steps.brief) || {}; const reviewed = st.state === 'complete';
    const cl = it.claims || []; const L = (label, list) => (list || []).length ? html`<div class="st-cmp-row"><span class="st-lbl">${label}</span><ul class="st-ul">${list.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null;
    const detect = c.id && c.id !== p.campaign;
    return html`<div class="st-under" aria-label="Axiom Understanding">
      <div class="st-under-head"><div><span class="st-eyebrow-n">Axiom Understanding</span><h3>${it.summary || 'What Axiom read in the material'}</h3></div>
        <div class="st-under-chips"><${Chip}>${INPUT_WORD[(it.input || {}).type] || 'Material'}</${Chip}>${u.urgency ? html`<${Chip} kind=${u.urgency.v === 'critical' || u.urgency.v === 'high' ? 'warn' : ''}>urgency ${u.urgency.v}</${Chip}>` : null}<${Chip} kind=${sit.respond === 'no' ? 'bad' : sit.respond === 'monitor' ? 'warn' : 'ok'}>${sit.respond === 'no' ? 'recommends not responding' : sit.respond === 'monitor' ? 'monitor' : 'respond'}</${Chip}><span class="ov-dim">${(it.sources || [it.source]).length} source${(it.sources || [it.source]).length === 1 ? '' : 's'}, ${it.paragraphs} paragraphs</span></div></div>
      <div class="st-sit" role="group" aria-label="The situation">
        <div><span class="st-lbl">What happened</span><p>${sit.what || '-'}</p></div>
        <div><span class="st-lbl">Why it matters to ${client ? client.name : 'the client'}</span><p>${sit.whyItMatters || '-'}</p></div>
        <div><span class="st-lbl">Should ${client ? client.name : 'the client'} respond?</span><p><b>${sit.respond === 'no' ? 'No.' : sit.respond === 'monitor' ? 'Watch it, not yet.' : 'Yes.'}</b> ${sit.why || ''}</p></div>
      </div>
      ${it.intelSummary ? html`<div class="st-intel-sum"><span class="st-lbl">Creative Intelligence Summary</span><p>${it.intelSummary}</p></div>` : null}
      ${detect || (p.brief || {}).campaignMode === 'detect' ? html`<div class=${'st-detect' + (detect ? '' : ' none')} role="group" aria-label="Campaign detection">${c.id ? html`<span><${Icon} n="sparkle" size=${16} /> <b>Axiom detected ${c.name}</b> <${Chip} kind=${c.confidence >= 0.7 ? 'ok' : 'warn'}>${Math.round((c.confidence || 0) * 100)}% match</${Chip}> <span class="ov-dim">${c.why}</span></span>${!ro ? (p.campaign === c.id ? html`<${Chip} kind="ok">in use</${Chip}>` : html`<span class="st-detect-acts"><button class="btn sm" disabled=${!!busy} onClick=${() => onCampaign(c.id)}>Use campaign</button><button class="btn sm ghost" disabled=${!!busy} onClick=${() => onCampaign('', true)}>Keep standalone</button></span>`) : null}` : html`<span class="ov-dim">No campaign of ${camps.length} matched${c.why ? ': ' + c.why : ''}; the work stays standalone.</span>`}</div>` : null}
      ${(it.topics || []).length ? html`<div class="st-topics" role="group" aria-label="Topics and issues">${[['high', 'Highly relevant'], ['potential', 'Potentially relevant'], ['not', 'Not relevant']].map(([r, l]) => html`<div key=${r} class=${'st-topic-col ' + r}><span class="st-lbl">${l}</span>${topicsBy(r).length ? html`<ul class="st-ul">${topicsBy(r).map((t, i) => html`<li key=${i}><b>${t.name}</b>${t.issue ? html` <${Chip}>${t.issue}</${Chip}>` : null}<div class="ov-dim">${t.why}</div></li>`)}</ul>` : html`<div class="ov-dim">none</div>`}</div>`)}</div>` : null}
      <div class="st-under-grid">
        <details class="st-und"><summary><span class="st-lbl">Understanding (${Object.keys(u).length} fields)</span> <span class="ov-dim">each stated, inferred or from what Axiom knows</span></summary>
          <table class="ov-table st-und-table"><tbody>${Object.keys(FIELD_WORD).filter(k => u[k]).map(k => html`<tr key=${k}><th scope="row">${FIELD_WORD[k]}</th><td>${u[k].v}</td><td><${Chip} kind=${u[k].basis === 'stated' ? 'ok' : u[k].basis === 'knowledge' ? '' : 'warn'}>${BASIS_WORD[u[k].basis] || u[k].basis}</${Chip}></td></tr>`)}</tbody></table></details>
        <details class="st-cmp"><summary><span class="st-lbl">Compared with what Axiom knows</span> <span class="ov-dim">${[(cmp.gaps || []).length ? cmp.gaps.length + ' gap' + (cmp.gaps.length === 1 ? '' : 's') : '', (cmp.contradicts || []).length ? cmp.contradicts.length + ' contradiction' + (cmp.contradicts.length === 1 ? '' : 's') : ''].filter(Boolean).join(' / ') || 'new, known, supporting, contradicting'}</span></summary>
          <div class="st-cmp-grid">${L('New', cmp.new)}${L('Already known', cmp.known)}${L('Supports', cmp.supports)}${L('Contradicts', cmp.contradicts)}${L('Messaging gaps', cmp.gaps)}${L('Missing context', cmp.missingContext)}${L('How the brief could be better', cmp.briefImprovements)}</div>
          <div class="st-know"><span class="st-lbl">Knowledge retrieved</span>${Object.keys(KNOW_WORD).map(k => ((it.knowItems || {})[k] || []).length ? html`<div key=${k}><b>${KNOW_WORD[k]}</b> ${it.knowItems[k].map(x => html`<span key=${x.id} class="st-know-item" title=${x.why || ''}><span class="ov-dim">${x.id}</span> ${x.label}</span>`)}</div>` : null)}</div></details>
      </div>
      ${cl.length ? html`<div class="st-an-sec"><span class="st-lbl">Claims against the approved facts</span><ul class="st-ul">${cl.map((x, i) => { const w = CLAIM_WORD[x.status] || ['', x.status]; return html`<li key=${i}><${Chip} kind=${w[0]}>${w[1]}</${Chip}> ${x.text}${x.p ? html` <span class="ov-dim">(${x.p})</span>` : null}</li>`; })}</ul></div>` : null}
      ${(it.risks || []).length || (it.gaps || []).length ? html`<div class="st-an-grid">${(it.risks || []).length ? html`<div class="st-an-card"><span class="st-lbl">Risks</span><ul class="st-ul">${it.risks.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null}${(it.gaps || []).length ? html`<div class="st-an-card"><span class="st-lbl">Gaps</span><ul class="st-ul">${it.gaps.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null}</div>` : null}
      <div class="st-an-sec"><button class="st-tools-toggle" aria-expanded=${showParas} onClick=${() => setShowParas(!showParas)}><span class="st-lbl">What was kept and what was set aside (${(it.relevant || []).length} / ${(it.filtered || []).length})</span><span aria-hidden="true">${showParas ? '-' : '+'}</span></button>
        ${showParas ? html`<table class="ov-table st-an-paras"><thead><tr><th>Paragraph</th><th>Read as</th><th>Why</th></tr></thead><tbody>${(it.relevant || []).map(x => html`<tr key=${'k' + x.p}><td><span class="ov-dim">${x.p}</span> ${x.text}</td><td><${Chip} kind="ok">kept</${Chip}></td><td>${x.why}</td></tr>`)}${(it.filtered || []).map(x => html`<tr key=${'f' + x.p}><td><span class="ov-dim">${x.p}</span> ${x.text}</td><td><${Chip}>set aside</${Chip}></td><td>${x.why}</td></tr>`)}</tbody></table>` : null}</div>
      ${!ro ? html`<div class="st-stepbar" role="group" aria-label="Review the understanding">
        <div><b>${reviewed ? 'Understanding confirmed.' : st.why === 'campaign_changed' ? 'The campaign changed after this reading.' : 'Does Axiom have this right?'}</b><span class="ov-dim">${reviewed ? 'The objectives come from this reading.' : st.why === 'campaign_changed' ? 'Analyse again so relevance and the strategy follow the new campaign, or keep this reading.' : 'Confirm it to choose the objectives, or add material and analyse again.'}</span></div>
        <div class="st-stepbar-acts"><button class="btn sm ghost" disabled=${!!busy} onClick=${onAgain}><${Icon} n="refresh" size=${13} /> ${st.why === 'campaign_changed' ? 'Analyse again' : 'Add material and analyse again'}</button>${!reviewed ? html`<button class="btn sm" disabled=${!!busy} onClick=${onConfirm}>${st.why === 'campaign_changed' ? 'Keep this reading' : 'Confirm and continue to Objectives'} <${Icon} n="arrow" size=${14} /></button>` : null}</div>
      </div>` : null}
    </div>`;
  }
  function BriefWorkspace({ p, client, kit, busy, wf, job, now, durations, onAnalyse, onConfirm, onCampaign, onRetry, onCancel, onGo, onSaveBrief, prov }) {
    const noClaude = !!(prov && prov.claude === false);
    const ro = !canWrite() || p.readOnly; const it = p.intel && ((p.brief || {}).analysis || {}).intel === p.intel.id ? p.intel : null;
    const [again, setAgain] = useState(false);
    const [text, setText] = useState(''); const [kind, setKind] = useState('brief'); const [items, setItems] = useState([]);
    const [useSources, setUseSources] = useState(true);
    const pending = (p.sources || []).filter(s => !((p.intel || {}).sources || [(p.intel || {}).source]).some(id => id === s.id));
    const live = job && (job.state === 'queued' || job.state === 'running');
    const showCompose = !ro && (!it || again) && !live;
    const go = () => { onAnalyse({ text, kind, items, sources: useSources ? pending.map(s => s.id) : [] }).then(ok => { if (ok) { setText(''); setItems([]); setAgain(false); } }); };
    const n = items.length + (text.trim().length >= 20 ? 1 : 0) + (useSources ? pending.length : 0);
    const b = p.brief || {};
    return html`<div class="st-briefws">
      ${job && (live || job.state === 'failed' || (job.state === 'done' && now - (job.updated || 0) < 4000)) ? html`<${ProcessingCard} job=${job} kind="analyse" now=${now} durations=${durations} onRetry=${onRetry} onCancel=${live ? onCancel : null} onChange=${() => setAgain(true)} onManual=${() => onGo('brief-details')} />` : null}
      ${showCompose ? html`<section class="st-compose-wrap" aria-label="The brief">
        <div class="st-compose-head"><h3>${it ? 'Add material and analyse again' : 'What do we need to respond to?'}</h3><span class="ov-dim">${it ? 'A new reading replaces this one for the steps that follow; directions and copy made on it stay, marked as built on the earlier reading.' : 'Everything you add is read together, against ' + (client ? client.name : 'the client') + '\'s campaigns, facts and knowledge.'}</span>${it ? html`<button class="ov-link" onClick=${() => setAgain(false)}>Close</button>` : null}</div>
        <${MaterialComposer} client=${client} kit=${kit} text=${text} setText=${setText} kind=${kind} setKind=${setKind} items=${items} setItems=${setItems} busy=${busy} />
        ${pending.length ? html`<label class="st-check st-pending"><input type="checkbox" checked=${useSources} onChange=${e => setUseSources(e.target.checked)} /> Include the ${pending.length} source${pending.length === 1 ? '' : 's'} already on the project (${pending.map(s => s.name).join(', ')})</label>` : null}
        <div class="st-stepbar"><div><b>Analyse the brief</b><span class="ov-dim">One model call reads ${n || 'the'} piece${n === 1 ? '' : 's'} of material: what happened, why it matters, what to keep, the objectives and the strategy Axiom recommends. Nothing else is spent.</span></div>
          <div class="st-stepbar-acts"><button class="btn sm" disabled=${!!busy || !n || noClaude} title=${noClaude ? 'Claude is not configured on the worker (ANTHROPIC_API_KEY): the brief is kept and is analysed once it is. Nothing is spent.' : !n ? 'Write, paste, link or upload the brief first' : ''} onClick=${go}><${Icon} n="sparkle" size=${14} /> Analyse brief</button></div></div>
      </section>` : null}
      ${it && !(live && again) ? html`<${UnderstandingReview} p=${p} it=${it} client=${client} kit=${kit} ro=${ro} busy=${busy} wf=${wf} onConfirm=${onConfirm} onCampaign=${onCampaign} onAgain=${() => setAgain(true)} />` : null}
      ${!it && !showCompose && !live && ro ? html`<div class="st-empty-state"><b>No brief has been analysed yet.</b><span>A full key adds the material and analyses it.</span></div>` : null}
      <details class="st-briefdetails" id="st-brief-details"><summary><span class="st-lbl">Brief details</span> <span class="ov-dim">${(b.channels || []).map(chanLabel).join(', ') || 'no channels'} - ${b.deliverable === 'copy' ? 'copy only' : b.deliverable === 'visual' ? 'one visual' : 'coordinated set'}${b.objective ? ' - ' + b.objective : ''}</span></summary>
        <div class="st-bd-grid">${[['Objective', b.objective], ['Audience', b.audience], ['Key message', b.message], ['Call to action', b.action]].map(([l, v]) => html`<div key=${l}><span class="st-lbl">${l}</span><p>${v || html`<span class="ov-dim">set by the Objectives and Strategy steps</span>`}</p></div>`)}</div>
        ${!ro ? html`<div class="st-bd-chans"><span class="st-lbl">Channels</span><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + ((b.channels || []).indexOf(k) >= 0 ? ' on' : '')} aria-pressed=${(b.channels || []).indexOf(k) >= 0} disabled=${!!busy} onClick=${() => onSaveBrief({ channels: (b.channels || []).indexOf(k) >= 0 ? (b.channels || []).filter(x => x !== k) : (b.channels || []).concat([k]) })}>${CHANNELS[k].label}</button>`)}</div></div>` : null}
      </details>
    </div>`;
  }

  /* ------------------------------------------------------------ Objectives and Strategy */
  function ObjectivesStep({ p, busy, onConfirm, onDecision }) {
    const it = p.intel || {}; const i0 = (p.brief || {}).intel || {}; const sel = i0.selected || {}; const rec = it.recommendation || {}; const ro = !canWrite() || p.readOnly;
    const [obj, setObj] = useState(sel.objective ? sel.objective.id : rec.objective || ((it.objectives || [])[0] || {}).id || '');
    const [msg, setMsg] = useState(sel.message ? sel.message.id : rec.message || '');
    const high = (it.topics || []).filter(t => t.relevance === 'high').map(t => t.name);
    const [topics, setTopics] = useState(Array.isArray((p.brief || {}).topics) && (p.brief || {}).topics.length ? p.brief.topics : high);
    useEffect(() => { setObj(sel.objective ? sel.objective.id : rec.objective || ((it.objectives || [])[0] || {}).id || ''); setMsg(sel.message ? sel.message.id : rec.message || ''); }, [it.id]);
    const O = (it.objectives || []).find(o => o.id === obj) || null; const M = O && (O.messages || []).find(m => m.id === msg);
    const conf = (i0.confirmed || {}).objectives; const same = conf && conf.intel === it.id && conf.objective === obj && conf.message === msg && JSON.stringify((p.brief || {}).topics || []) === JSON.stringify(topics);
    const togg = t => setTopics(topics.indexOf(t) >= 0 ? topics.filter(x => x !== t) : topics.concat([t]));
    return html`<div class="st-objectives">
      <div class="st-choose3">
        <section class="st-choose-col" aria-label="Objectives"><div class="st-col-h"><span class="st-col-n">1</span><span class="st-lbl">Objective</span><span class="ov-dim">ranked by Axiom</span></div>
          ${(it.objectives || []).map((o, i) => html`<label key=${o.id} class=${'st-opt card' + (obj === o.id ? ' on' : '')} style=${{ '--i': i }}><input type="radio" name="st-obj" checked=${obj === o.id} disabled=${ro} onChange=${() => { setObj(o.id); setMsg(((o.messages || [])[0] || {}).id || ''); }} /><span><span class="st-opt-top"><b>${o.rank}. ${o.title}</b>${rec.objective === o.id ? html`<${Chip} kind="ok">recommended</${Chip}>` : null}</span><span class="st-opt-line ov-dim">${o.why}</span><${Chip}>${WORD(o.kind)}</${Chip}></span></label>`)}</section>
        <section class="st-choose-col" aria-label="Key messages"><div class="st-col-h"><span class="st-col-n">2</span><span class="st-lbl">Key message${O ? ' for ' + O.id : ''}</span></div>
          ${O ? (O.messages || []).map((m, i) => html`<label key=${m.id} class=${'st-opt card msg' + (msg === m.id ? ' on' : '')} style=${{ '--i': i }}><input type="radio" name="st-msg" checked=${msg === m.id} disabled=${ro} onChange=${() => setMsg(m.id)} /><span><span class="st-opt-top"><b>${m.primary}</b>${m.banned ? html`<${Chip} kind="bad">uses "${m.banned}"</${Chip}>` : null}${rec.message === m.id ? html`<${Chip} kind="ok">recommended</${Chip}>` : null}</span>${m.supporting ? html`<span class="st-opt-line">${m.supporting}</span>` : null}<span class="st-opt-meta">${[m.proof ? 'Proof: ' + m.proof : '', (m.evidence || []).length ? 'Evidence: ' + m.evidence.join(', ') : '', m.takeaway ? 'Takeaway: ' + m.takeaway : '', m.cta ? 'CTA: ' + m.cta : ''].filter(Boolean).join(' / ')}</span></span></label>`) : html`<div class="ov-dim">Choose an objective first.</div>`}</section>
        <section class="st-choose-col" aria-label="Topics and issues"><div class="st-col-h"><span class="st-col-n">3</span><span class="st-lbl">Topics and issues in play</span></div>
          ${(it.topics || []).filter(t => t.relevance !== 'not').map((t, i) => html`<label key=${t.name} class=${'st-opt card topic' + (topics.indexOf(t.name) >= 0 ? ' on' : '')} style=${{ '--i': i }}><input type="checkbox" checked=${topics.indexOf(t.name) >= 0} disabled=${ro} onChange=${() => togg(t.name)} /><span><span class="st-opt-top"><b>${t.name}</b><${Chip} kind=${t.relevance === 'high' ? 'ok' : ''}>${t.relevance === 'high' ? 'high' : 'potential'}</${Chip}>${t.issue ? html`<${Chip}>${t.issue}</${Chip}>` : null}</span><span class="st-opt-line ov-dim">${t.why}</span></span></label>`)}
          ${!(it.topics || []).some(t => t.relevance !== 'not') ? html`<div class="ov-dim">No topic of this client's was found in the material.</div>` : null}</section>
      </div>
      ${!ro ? html`<div class="st-stepbar sticky"><div><b>${same ? 'Objectives confirmed.' : M ? 'Objective ' + O.id + ', message ' + M.id + (topics.length ? ', ' + topics.length + ' topic' + (topics.length === 1 ? '' : 's') : '') : 'Choose an objective and a key message'}</b><span class="ov-dim">${same ? 'The strategy is chosen next.' : 'The brief\'s objective, message and call to action follow this choice; it is recorded for the engine to learn from.'}</span></div>
        <div class="st-stepbar-acts">${O ? html`<button class="ov-link" onClick=${() => onDecision('reject_objective', O.id)}>Set this objective aside</button>` : null}<button class="btn sm" disabled=${!!busy || !O || !M || same} onClick=${() => onConfirm({ objective: O.id, message: M.id, topics })}>${same ? 'Confirmed' : 'Confirm and continue to Strategy'} <${Icon} n="arrow" size=${14} /></button></div></div>` : null}
    </div>`;
  }
  function StrategyStep({ p, kit, busy, wf, job, now, durations, onConfirm, onDecision, onCampaign, onDraftStrategy, onSaveStrategy, onRetry, onGo }) {
    const it = p.intel || {}; const i0 = (p.brief || {}).intel || {}; const sel = i0.selected || {}; const ro = !canWrite() || p.readOnly;
    const strats = (it.strategies || []).filter(s => s.kind !== 'none'); const noneS = (it.strategies || []).find(s => s.kind === 'none');
    const [strat, setStrat] = useState(sel.strategy ? sel.strategy.id : ((strats.find(s => s.recommended) || strats[0] || {}).id || ''));
    const S0 = strats.find(s => s.id === strat) || null; const st = (wf && wf.steps && wf.steps.strategy) || {};
    const conf = (i0.confirmed || {}).strategy; const same = conf && conf.intel === it.id && conf.strategy === strat;
    const c = it.campaign || {}; const live = job && (job.state === 'queued' || job.state === 'running');
    // the campaign Axiom matched is decided with the strategy: chosen here, written when the strategy is confirmed
    const [campPick, setCampPick] = useState(null);
    const campNow = campPick != null ? campPick : (p.campaign || '');
    const dirsReady = wf && wf.steps && wf.steps.directions && (wf.steps.directions.state === 'needs_review' || wf.steps.directions.state === 'complete');
    const recNo = (it.situation || {}).respond === 'no' || (noneS && noneS.recommended);
    return html`<div class="st-strategy-step">
      ${i0.noResponse ? html`<div class="st-decided" role="status"><${Icon} n="archive" size=${18} /><div><b>The team decided not to respond.</b> <span class="ov-dim">${i0.noResponse.reason}</span></div>${!ro ? html`<button class="btn sm ghost" onClick=${() => onDecision('respond_anyway', '', true)}>Respond after all</button>` : null}</div>` : null}
      ${recNo && !i0.noResponse ? html`<div class="st-warnbar" role="note"><${Icon} n="alert" size=${16} /> <span><b>Axiom recommends not responding.</b> ${(it.situation || {}).why || ''}</span>${!ro ? html`<button class="btn sm ghost" onClick=${() => onDecision('no_response', '')}>Record: no response</button>` : null}</div>` : null}
      <div class="st-strats" role="radiogroup" aria-label="Response strategy">${strats.map((s, i) => html`<label key=${s.id} class=${'st-strat' + (strat === s.id ? ' on' : '')} style=${{ '--i': i }}><input type="radio" name="st-strat" checked=${strat === s.id} disabled=${ro || !!i0.noResponse} onChange=${() => setStrat(s.id)} />
        <span class="st-strat-top"><b>${STRAT_WORD[s.kind] || s.kind}</b>${s.recommended ? html`<${Chip} kind="ok">Axiom recommends</${Chip}>` : null}<${Chip} kind=${s.urgency === 'critical' || s.urgency === 'high' ? 'warn' : ''}>${s.urgency}</${Chip}></span>
        ${s.message ? html`<span class="st-strat-msg">${s.message}</span>` : null}
        <span class="st-strat-grid">${[['For', s.audience], ['Gains', s.benefit], ['Risk', s.risk], ['Where', (s.platforms || []).join(', ')], ['Format', s.format]].filter(x => x[1]).map(([l, v]) => html`<span key=${l}><span class="st-lbl">${l}</span>${v}</span>`)}</span></label>`)}</div>
      ${c.id || p.campaign ? html`<div class="st-campdec" role="group" aria-label="Campaign"><span class="st-lbl">Campaign</span><span>${campNow ? html`Inside <b>${(((kit && kit.campaigns) || []).find(x => x.id === campNow) || {}).name || campNow}</b>` : 'Standalone'}${c.id && c.id !== campNow ? html` <span class="ov-dim">- Axiom matched ${c.name} (${Math.round((c.confidence || 0) * 100)}%)</span>` : null}${campPick != null && campPick !== (p.campaign || '') ? html` <${Chip} kind="warn">set when you confirm</${Chip}>` : null}</span>${!ro && c.id && c.id !== campNow ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => setCampPick(c.id)}>Use ${c.name}</button>` : null}${!ro && campNow ? html`<button class="ov-link" disabled=${!!busy} onClick=${() => setCampPick('')}>Keep standalone</button>` : null}</div>` : null}
      <details class="st-cstrat"><summary><span class="st-lbl">Creative strategy (optional)</span> <span class="ov-dim">the problem, the insight and the campaign idea, as one paragraph the directions work within</span></summary>${StrategyPanel ? html`<${StrategyPanel} p=${p} onDraft=${onDraftStrategy} onSave=${onSaveStrategy} busy=${busy} />` : null}</details>
      ${job && (live || job.state === 'failed') ? html`<${ProcessingCard} job=${job} kind="direct" now=${now} durations=${durations} onRetry=${onRetry} />` : null}
      ${job && job.state === 'done' && dirsReady && st.state === 'complete' ? html`<div class="st-ready-card" role="status"><${Icon} n="check" size=${18} /><div><b>Creative Directions ready.</b> <span class="ov-dim">${(p.directions || []).filter(d => !d.archived && d.basis && wf && d.basis.strategy === (wf.basis || {}).strategy).length} built on this strategy.</span></div><button class="btn sm" onClick=${() => onGo('directions')}>View directions <${Icon} n="arrow" size=${14} /></button></div>` : null}
      ${!ro && !i0.noResponse ? html`<div class="st-stepbar sticky"><div><b>${same ? 'Strategy confirmed: ' + (STRAT_WORD[(S0 || {}).kind] || '') + '.' : S0 ? (STRAT_WORD[S0.kind] || S0.kind) + ' chosen' : 'Choose a response strategy'}</b><span class="ov-dim">${same ? 'Directions are built on the objective, the message and this strategy.' : 'Confirming opens Directions; generating them is one model call.'}</span></div>
        <div class="st-stepbar-acts">${!same ? html`<button class="btn sm ghost" disabled=${!!busy || !S0} onClick=${() => onConfirm(Object.assign({ strategy: strat }, campPick != null ? { campaign: campPick } : {}), false)}>Confirm only</button>` : null}<button class="btn sm" disabled=${!!busy || !S0 || live} onClick=${() => same && campPick == null ? onConfirm(null, true) : onConfirm(Object.assign({ strategy: strat }, campPick != null ? { campaign: campPick } : {}), true)}><${Icon} n="sparkle" size=${14} /> ${same ? 'Generate creative directions' : 'Confirm and generate directions'} <span class="ov-dim">(1 model call)</span></button></div></div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ the Creative Directions board */
  /** S20: a free sketch of a direction, laid out from what it says it would draw (the worker's descriptor: medium, where the words
      sit, how much is imagery, type scale, palette words) in the client's palette by the one renderer. Image areas are drawn as
      dashed sketch boxes - nothing is generated here, and the card says so. Directions filed before S20 carry no descriptor and
      are sketched from their medium alone. */
  const SKETCH_HEX = { black: '#111418', white: '#f6f4ef', dark: '#141a20', light: '#f4f1ea', teal: '#0E6A6E', gold: '#C9A227', orange: '#E07A2E', blue: '#1F4E8C', green: '#2F6B3A', red: '#B03A2E', yellow: '#E8C547', navy: '#14213D', cream: '#F3EAD7', grey: '#5B6470', ochre: '#C08A2E', sand: '#D8C7A3', earth: '#6B4F3A', charcoal: '#2B2F33', pastel: '#E9DDEB', monochrome: '#2B2F33' };
  function dirSketch(d) {
    if (d.sketch && d.sketch.zone) return d.sketch;
    const m = d.medium || ''; return { medium: m, zone: 'bottom', image: m === 'typographic' ? 'none' : m === 'infographic' || m === 'diagram' ? 'chart' : m === 'cutout' ? 'inset' : 'full', scale: 'standard', palette: [] };
  }
  function dirPreview(d, kit, i) {
    const pal = (kit && kit.palette) || {}; const primary = /^#[0-9a-f]{6}$/i.test(pal.primary || '') ? pal.primary : '#0E6A6E';
    const sk = dirSketch(d); const hexes = (sk.palette || []).map(w => SKETCH_HEX[w]).filter(Boolean);
    const lum = h => { const n = parseInt(h.slice(1), 16); return (0.2126 * (n >> 16 & 255) + 0.7152 * (n >> 8 & 255) + 0.0722 * (n & 255)) / 255; };
    // a photograph's area is a neutral placeholder ground (never the palette, which belongs to the type and the panels)
    const ground = sk.image === 'full' ? '#2a3038' : hexes[0] || (sk.image === 'none' ? primary : i % 2 ? '#1d2630' : '#18222b'); const light = lum(ground) > 0.6;
    const ink = light ? '#111418' : '#ffffff'; const accent = hexes[1] || primary;
    const hl = d.headline || d.hook || d.title; const big = sk.scale === 'large' ? 1.3 : sk.scale === 'small' ? 0.78 : 1;
    const hs = Math.round((hl.length > 60 ? 6 : 7.6) * big * 10) / 10;
    // where the words go, and what the image takes
    const Z = { top: { x: 8, y: 8, w: 84 }, bottom: { x: 8, y: 56, w: 84 }, middle: { x: 10, y: 32, w: 80 }, left: { x: 6, y: 30, w: 44 }, right: { x: 50, y: 30, w: 44 } }[sk.zone] || { x: 8, y: 56, w: 84 };
    const layers = [];
    if (sk.image === 'full') layers.push({ id: 'image', name: 'photograph', type: 'img', role: 'region', x: 0, y: 0, w: 100, h: 100 }, { id: 'shade', type: 'shape', shape: 'rect', role: 'overlay', x: 0, y: sk.zone === 'top' ? 0 : sk.zone === 'middle' ? 25 : 45, w: 100, h: sk.zone === 'middle' ? 50 : 55, fill: '#000000', opacity: 0.45 });
    else if (sk.image === 'split') layers.push({ id: 'image', name: 'photograph', type: 'img', role: 'region', x: sk.zone === 'left' ? 50 : 0, y: sk.zone === 'left' || sk.zone === 'right' ? 0 : sk.zone === 'top' ? 50 : 0, w: sk.zone === 'left' || sk.zone === 'right' ? 50 : 100, h: sk.zone === 'left' || sk.zone === 'right' ? 100 : 50 });
    else if (sk.image === 'inset') layers.push({ id: 'image', name: 'inset', type: 'img', role: 'region', x: sk.zone === 'right' ? 8 : 56, y: sk.zone === 'top' ? 56 : 8, w: 36, h: 36 });
    else if (sk.image === 'chart') [38, 62, 48, 80].forEach((h, k) => layers.push({ id: 'bar' + k, type: 'shape', shape: 'rect', role: 'free', x: 12 + k * 18, y: (sk.zone === 'top' ? 92 : 50) - h * 0.4, w: 12, h: h * 0.4, fill: k === 3 ? accent : (light ? '#9aa3ad' : 'rgba(255,255,255,0.5)') }));
    const onImg = sk.image === 'full'; const textInk = onImg ? '#ffffff' : ink;
    layers.push(
      { id: 'k', type: 'text', role: 'free', text: String(d.title || '').toUpperCase(), x: Z.x, y: Z.y, w: Z.w, h: 5, size: 2.4, weight: 700, letterSpacing: 0.12, color: onImg ? 'rgba(255,255,255,0.8)' : light ? accent : 'rgba(255,255,255,0.78)', font: 'mono' },
      { id: 'r', type: 'shape', shape: 'rule', role: 'rule', x: Z.x, y: Z.y + 6.5, w: 14, h: 0.6, fill: onImg ? '#ffffff' : light ? accent : '#ffffff' },
      { id: 'h', type: 'text', role: 'free', text: hl, x: Z.x, y: Z.y + 10, w: Z.w, h: sk.zone === 'left' || sk.zone === 'right' ? 40 : 26, size: Math.min(hs, Z.w < 60 ? 6 : hs), weight: 800, lineHeight: 1.04, color: textInk }
    );
    return { v: 5, stage: { w: 1080, h: 1350 }, bg: ground, palette: pal, fonts: (kit && kit.fonts) || {}, layers, sketch: true };
  }
  const SKETCH_WORD = { full: 'full-bleed image', split: 'split with an image', inset: 'inset image', chart: 'a chart', none: 'type only' };
  function DirCard({ d, i, p, kit, ro, busy, picked, earlier, onPick, onChoose, onRefine, onUpdate, onDuplicate, onArchive, onKeep }) {
    const [open, setOpen] = useState(false); const [ref, setRef] = useState(null);
    const layout = useMemo(() => dirPreview(d, kit, i), [d.id, d.headline, d.hook, d.title, d.medium, JSON.stringify(d.sketch || null), kit]);
    const v = { id: 'preview-' + d.id, layout, copy: {}, mode: 'composition' };
    const vn = d.visualNarrative || {};
    return html`<article class=${'st-dcard' + (d.chosen ? ' chosen' : '') + (picked ? ' picked' : '') + (earlier ? ' earlier' : '') + (d.saved ? ' saved' : '')} style=${{ '--i': i }} aria-label=${'Direction ' + d.title}>
      <div class="st-dcard-art"><${Composition} v=${v} a=${{ id: d.id, format: '4:5', channel: 'instagram' }} ns=${p.ns} size="card" /><span class="st-dcard-note" title="Laid out from what the direction says it would draw; image areas are dashed boxes">sketch: ${SKETCH_WORD[dirSketch(d).image] || 'layout'}, words at the ${dirSketch(d).zone}${dirSketch(d).scale !== 'standard' ? ', ' + dirSketch(d).scale + ' type' : ''} - nothing generated</span>
        <span class="st-dcard-badges">${d.chosen ? html`<${Chip} kind="ok">selected</${Chip}>` : null}${d.saved ? html`<${Chip}>saved</${Chip}>` : null}${earlier ? html`<${Chip} kind="warn">earlier choice</${Chip}>` : null}${d.refinedFrom ? html`<${Chip}>refined</${Chip}>` : null}${d.mergedFrom ? html`<${Chip}>merged</${Chip}>` : null}${d.similar ? html`<${Chip} kind="warn" title=${'reads close to ' + d.similar}>close to another</${Chip}>` : null}${d.lookalike ? html`<${Chip} kind="warn" title=${'would look like "' + d.lookalike + '" on the page'}>looks like another</${Chip}>` : null}</span></div>
      <div class="st-dcard-body">
        <div class="st-dcard-h"><h4>${d.title}</h4>${d.route ? html`<${Chip} kind=${d.route === 'finished' ? 'warn' : ''}>${d.route === 'finished' ? 'full AI' : 'editable'}</${Chip}>` : null}${d.medium ? html`<${Chip}>${String(d.medium).replace('photo-', '')}</${Chip}>` : null}</div>
        <p class="st-dcard-idea">${d.idea || d.message}</p>
        <dl class="st-dcard-dl">
          ${d.objectiveTitle ? html`<div><dt>Objective</dt><dd>${d.objectiveTitle}</dd></div>` : null}
          <div><dt>Key message</dt><dd>${d.messageText || d.message}</dd></div>
          ${d.audience ? html`<div><dt>Audience</dt><dd>${d.audience}</dd></div>` : null}
          ${d.tone ? html`<div><dt>Tone</dt><dd>${d.tone}</dd></div>` : null}
          ${d.hook ? html`<div><dt>Hook</dt><dd>${d.hook}</dd></div>` : null}
          ${d.headline ? html`<div><dt>Headline</dt><dd>${d.headline}</dd></div>` : null}
          ${d.layout || d.composition ? html`<div><dt>Layout</dt><dd>${d.layout || d.composition}</dd></div>` : null}
          ${(d.platforms || []).length ? html`<div><dt>Platforms</dt><dd>${d.platforms.map(chanLabel).join(', ')}</dd></div>` : null}
          ${d.why || d.rationale ? html`<div><dt>Why it could work</dt><dd>${d.why || d.rationale}</dd></div>` : null}
          ${(d.risks || []).length || d.uncertainty ? html`<div><dt>Risks</dt><dd>${(d.risks || []).join('; ') || d.uncertainty}</dd></div>` : null}
        </dl>
        <button class="ov-link st-dcard-vn" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? 'Hide' : 'Show'} the visual narrative</button>
        ${open ? html`<dl class="st-vis">${d.visual ? html`<div><dt>Visual</dt><dd>${d.visual}</dd></div>` : null}${Object.keys(VIS_WORD).filter(k => vn[k]).map(k => html`<div key=${k}><dt>${VIS_WORD[k]}</dt><dd>${vn[k]}</dd></div>`)}${d.typography ? html`<div><dt>Typography</dt><dd>${d.typography}</dd></div>` : null}${d.colour ? html`<div><dt>Colour</dt><dd>${d.colour}</dd></div>` : null}</dl>` : null}
        ${ref != null ? html`<div class="st-dcard-refine"><input class="st-in" value=${ref} autoFocus placeholder="What should change? e.g. more defiant, lead with the farmer" aria-label=${'Refine ' + d.title} onInput=${e => setRef(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && ref.trim()) { onRefine(d, ref.trim()); setRef(null); } if (e.key === 'Escape') setRef(null); }} /><button class="btn sm" disabled=${!ref.trim() || !!busy} onClick=${() => { onRefine(d, ref.trim()); setRef(null); }}>Refine (1 call)</button><button class="ov-link" onClick=${() => setRef(null)}>cancel</button></div>` : null}
        ${!ro ? html`<div class="st-dcard-acts">
          ${!d.chosen && !earlier ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => onChoose(d)}>Select</button>` : null}
          ${earlier && onKeep ? html`<button class="btn sm ghost" disabled=${!!busy} title="Keep this direction under the current objective, message and strategy; nothing is regenerated" onClick=${() => onKeep(d)}>Keep under the current choice</button>` : null}
          <button class="btn sm ghost" disabled=${!!busy} title="Refine this direction with an instruction (1 model call)" onClick=${() => setRef('')}><${Icon} n="pen" size=${13} /> Refine</button>
          <button class="st-iconbtn" disabled=${!!busy} title="Duplicate" aria-label=${'Duplicate ' + d.title} onClick=${() => onDuplicate(d)}><${Icon} n="copy" size=${15} /></button>
          <button class=${'st-iconbtn' + (d.saved ? ' on' : '')} disabled=${!!busy} title=${d.saved ? 'Saved for later: click to unsave' : 'Save for later'} aria-pressed=${!!d.saved} aria-label=${(d.saved ? 'Unsave ' : 'Save for later ') + d.title} onClick=${() => onUpdate(d, { saved: !d.saved })}><${Icon} n="bookmark" size=${15} /></button>
          <button class="st-iconbtn" disabled=${!!busy} title="Set aside (with a reason)" aria-label=${'Set aside ' + d.title} onClick=${() => onArchive(d)}><${Icon} n="archive" size=${15} /></button>
          <label class="st-check st-dcard-pick" title="Tick two or more to compare, merge or combine them"><input type="checkbox" checked=${!!picked} onChange=${() => onPick(d)} aria-label=${'Compare ' + d.title} /> Compare</label>
        </div>` : null}
      </div>
    </article>`;
  }
  const PARTS = [['idea', 'idea'], ['hook', 'hook'], ['headline', 'headline'], ['visual', 'visual'], ['tone', 'tone'], ['layout', 'layout']];
  function DirectionsBoard({ p, kit, busy, wf, job, now, durations, onDirect, onChoose, onUpdate, onDuplicate, onDecision, onRetry, onGo, onKeep }) {
    const ro = !canWrite() || p.readOnly; const [pick, setPick] = useState([]); const [parts, setParts] = useState({}); const [showOld, setShowOld] = useState(false); const [showAside, setShowAside] = useState(false);
    const earlierIds = new Set(((wf || {}).earlier || {}).directions || []);
    const all = (p.directions || []).filter(d => !d.archived);
    const cur = all.filter(d => !earlierIds.has(d.id) && !d.saved); const saved = all.filter(d => d.saved && !earlierIds.has(d.id)); const old = all.filter(d => earlierIds.has(d.id)); const aside = (p.directions || []).filter(d => d.archived);
    const picked = all.filter(d => pick.indexOf(d.id) >= 0);
    const live = job && (job.state === 'queued' || job.state === 'running');
    const st = (wf && wf.steps && wf.steps.directions) || {};
    const togg = d => setPick(pick.indexOf(d.id) >= 0 ? pick.filter(x => x !== d.id) : pick.concat([d.id]));
    const archive = d => { const why = window.prompt('Why set "' + d.title + '" aside? (recorded; the engine learns from it)', ''); if (why == null) return; if (why.trim().length < 4) { toastMsg('Nothing recorded: a reason of a few words is needed', true); return; } onUpdate(d, { archived: true }, why.trim()); };
    const card = (d, i, earlier) => html`<${DirCard} key=${d.id} d=${d} i=${i} p=${p} kit=${kit} ro=${ro} busy=${busy} earlier=${earlier} picked=${pick.indexOf(d.id) >= 0} onPick=${togg} onChoose=${onChoose} onRefine=${(x, ins) => onDirect({ mode: 'refine', ids: [x.id], instruction: ins })} onUpdate=${onUpdate} onDuplicate=${onDuplicate} onArchive=${archive} onKeep=${onKeep} />`;
    const partList = Object.keys(parts).filter(k => parts[k]).map(k => ({ id: k.split(':')[0], part: k.split(':')[1] }));
    return html`<div class="st-dboard">
      ${live || (job && job.state === 'failed') ? html`<${ProcessingCard} job=${job} kind="direct" now=${now} durations=${durations} onRetry=${onRetry} />` : null}
      ${!all.length && !live ? html`<div class="st-empty-state st-dboard-empty"><span class="st-locked-ic" aria-hidden="true"><${Icon} n="compass" size=${26} /></span><b>No creative directions yet.</b><span>${st.state === 'error' ? 'The last attempt did not complete; nothing was lost.' : 'Directions are built on the objective, the message and the strategy you confirmed: genuinely different arguments and media, measured for how different they are.'}</span>${!ro ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => onDirect({ n: 3 })}><${Icon} n="sparkle" size=${14} /> Generate creative directions <span class="ov-dim">(1 model call)</span></button>` : null}</div>` : null}
      ${(() => { const ev = (p.thread || []).filter(e => e.kind === 'directions' && (e.composition != null || e.diversity != null)).pop(); if (!ev || !cur.length) return null;
        return html`<div class="st-divline" role="note"><span><span class="st-lbl">Argument diversity</span> ${ev.argument != null ? ev.argument : ev.diversity}</span>${ev.composition != null ? html`<span><span class="st-lbl">Composition diversity</span> ${ev.composition}</span>` : html`<span class="ov-dim">composition not measured for this set (made before S20)</span>`}<span class="ov-dim">1 = nothing in common. Composition is read from what each direction says it would draw, not from rendered images.</span>${(ev.lookalikes || []).length ? html`<span class="st-divwarn">Would look alike on the page: ${ev.lookalikes.map(x => '"' + x.a + '" and "' + x.b + '" (' + (x.same || []).join(', ') + ')').join('; ')}</span>` : null}</div>`; })()}
      ${cur.length > 1 ? html`<div class="st-dstrip" role="list" aria-label="The directions side by side">${cur.map((d, i) => html`<button key=${d.id} role="listitem" class=${'st-dstrip-it' + (d.chosen ? ' chosen' : '')} title=${'Go to ' + d.title} onClick=${() => { const el = document.querySelector('#studio-root [aria-label="Direction ' + d.title.replace(/"/g, '') + '"]'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }}><${Composition} v=${{ id: 'strip-' + d.id, layout: dirPreview(d, kit, i), copy: {}, mode: 'composition' }} a=${{ id: d.id, format: '4:5', channel: 'instagram' }} ns=${p.ns} size="card" /><span class="st-dstrip-t">${d.title}</span><span class="st-dstrip-m ov-dim">${SKETCH_WORD[dirSketch(d).image] || ''}${d.medium ? ' - ' + String(d.medium).replace('photo-', '') : ''}</span></button>`)}</div>` : null}
      ${cur.length ? html`<div class="st-dgrid" role="list" aria-label="Creative directions">${cur.map((d, i) => card(d, i, false))}</div>` : null}
      ${saved.length ? html`<div class="st-dgroup"><span class="st-lbl">Saved for later (${saved.length})</span><div class="st-dgrid">${saved.map((d, i) => card(d, i, false))}</div></div>` : null}
      ${old.length ? html`<div class="st-dgroup"><button class="st-tools-toggle" aria-expanded=${showOld} onClick=${() => setShowOld(!showOld)}><span class="st-lbl">Built on an earlier choice (${old.length})</span><span aria-hidden="true">${showOld ? '-' : '+'}</span></button>${showOld ? html`<div class="st-dgrid">${old.map((d, i) => card(d, i, true))}</div>` : null}</div>` : null}
      ${aside.length ? html`<div class="st-dgroup"><button class="st-tools-toggle" aria-expanded=${showAside} onClick=${() => setShowAside(!showAside)}><span class="st-lbl">Set aside (${aside.length})</span><span aria-hidden="true">${showAside ? '-' : '+'}</span></button>${showAside ? html`<ul class="st-ul">${aside.map(d => html`<li key=${d.id}><b>${d.title}</b> <span class="ov-dim">${d.idea || d.message}</span>${!ro ? html` <button class="ov-link" onClick=${() => onUpdate(d, { archived: false })}>restore</button>` : null}</li>`)}</ul>` : null}</div>` : null}
      ${picked.length >= 2 ? html`<section class="st-dcompare" aria-label="Picked directions"><div class="st-dcompare-h"><b>Comparing ${picked.length} directions</b><span class="ov-dim">compare them, merge them, or combine named parts of each into one direction</span></div>
        <div class="st-copydeck-scroll"><table class="ov-table"><thead><tr><th></th>${picked.map(d => html`<th key=${d.id}>${d.title}</th>`)}</tr></thead><tbody>${PARTS.map(([k, l]) => html`<tr key=${k}><th scope="row">${l}</th>${picked.map(d => html`<td key=${d.id}><label class="st-check"><input type="checkbox" checked=${!!parts[d.id + ':' + k]} onChange=${e => setParts(Object.assign({}, parts, { [d.id + ':' + k]: e.target.checked }))} aria-label=${'Take the ' + l + ' of ' + d.title} /> ${d[k] || html`<span class="ov-dim">-</span>`}</label></td>`)}</tr>`)}</tbody></table></div>
        ${!ro ? html`<div class="st-nd-row"><button class="btn sm" disabled=${!!busy} onClick=${() => { onDirect({ mode: 'merge', ids: picked.map(d => d.id), parts: partList }); setPick([]); setParts({}); }}><${Icon} n="merge" size=${14} /> ${partList.length ? 'Combine the ticked parts' : 'Merge into one'} <span class="ov-dim">(1 model call)</span></button><button class="ov-link" onClick=${() => { setPick([]); setParts({}); }}>clear</button></div>` : null}</section>` : null}
      ${!ro && all.length ? html`<div class="st-stepbar"><div><b>${st.state === 'complete' ? 'Direction selected: ' + ((all.find(d => d.chosen) || {}).title || '') : st.why === 'chosen_earlier' ? 'The selected direction was built on an earlier choice' : 'Select the direction the copy follows'}</b><span class="ov-dim">${st.state === 'complete' ? 'Copy is open: the words and the visual narrative are written from it.' : 'Refine, merge or ask for alternatives until one is right; nothing is produced until you select.'}</span></div>
        <div class="st-stepbar-acts"><button class="btn sm ghost" disabled=${!!busy || live} onClick=${() => onDirect({ mode: 'alternatives', n: 2 })}><${Icon} n="sparkle" size=${14} /> Ask Axiom for alternatives <span class="ov-dim">(1 call)</span></button>${st.state === 'complete' ? html`<button class="btn sm" onClick=${() => onGo('copy')}>Continue to Copy <${Icon} n="arrow" size=${14} /></button>` : null}</div></div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ Copy: the words and the visual narrative, before any image */
  const DELIVERABLES = [['set', 'Set', 'a creative and its words per channel'], ['visual', 'Visual', 'one creative, adapted per channel'], ['copy', 'Copy only', 'words for the channels, no creative']];
  /** Copy's start in a guided project: the direction it follows, the channels and the content type, and one model call that
      writes each channel's words with its visual narrative (the composition plan the design is built from). No image is
      generated here: the production mode is chosen in Design once the words are marked ready. */
  function CopyStart({ p, busy, prov, job, now, durations, onGenerate, onSaveBrief, onRetry, onGo }) {
    const ro = !canWrite() || p.readOnly; const b = p.brief || {}; const chosen = (p.directions || []).find(d => d.chosen && !d.archived);
    const [chans, setChans] = useState(() => (b.channels || []).filter(c => CHANNELS[c]));
    const [deliv, setDeliv] = useState(b.deliverable || 'set');
    const live = job && (job.state === 'queued' || job.state === 'running'); const noClaude = prov && prov.claude === false;
    const changed = chans.join(',') !== (b.channels || []).join(',') || deliv !== (b.deliverable || 'set');
    const go = async () => { if (changed) { const ok = await onSaveBrief({ channels: chans, deliverable: deliv, formats: Object.assign({}, b.formats || {}, ...chans.filter(c => !(b.formats || {})[c]).map(c => ({ [c]: (CHANNELS[c] || {}).format || '1:1' }))) }); if (ok === false) return; } onGenerate(); };
    const vn = (chosen && chosen.visualNarrative) || {};
    const fields = deliv === 'copy' ? ['headline', 'supporting line', 'call to action', 'caption'] : ['headline', 'supporting line', 'call to action', 'caption', 'alt text'];
    return html`<section class="st-copystart" aria-label="Generate the copy">
      ${live || (job && job.state === 'failed') ? html`<${ProcessingCard} job=${job} kind="copy" now=${now} durations=${durations} onRetry=${onRetry} onManual=${() => onGo('brief')} />` : null}
      ${chosen ? html`<div class="st-copystart-dir"><span class="st-lbl">Following the direction</span><h3>${chosen.title}</h3><p>${chosen.idea || chosen.message}</p>
        <dl class="st-dcard-dl">${chosen.hook ? html`<div><dt>Hook</dt><dd>${chosen.hook}</dd></div>` : null}${chosen.headline ? html`<div><dt>Headline</dt><dd>${chosen.headline}</dd></div>` : null}${chosen.messageText || chosen.message ? html`<div><dt>Key message</dt><dd>${chosen.messageText || chosen.message}</dd></div>` : null}${vn.scene || chosen.visual ? html`<div><dt>Visual narrative</dt><dd>${vn.scene || chosen.visual}</dd></div>` : null}${chosen.medium ? html`<div><dt>Medium</dt><dd>${String(chosen.medium).replace('photo-', 'photograph, ')}</dd></div>` : null}</dl>
        <button class="ov-link" onClick=${() => onGo('directions')}>Change the direction</button></div>` : html`<div class="st-warnbar" role="note"><${Icon} n="alert" size=${16} /> <span>No direction is selected; the copy follows the brief alone.</span><button class="btn sm ghost" onClick=${() => onGo('directions')}>Go to Directions</button></div>`}
      <div class="st-copystart-grid">
        <fieldset class="st-copystart-f" disabled=${ro || live}><legend class="st-lbl">Channels</legend><div class="st-chiprow">${Object.keys(CHANNELS).map(c => { const on = chans.indexOf(c) >= 0; return html`<button key=${c} type="button" class=${'st-chipbtn' + (on ? ' on' : '')} aria-pressed=${on} onClick=${() => setChans(on ? chans.filter(x => x !== c) : chans.concat([c]))}>${chanLabel(c)}</button>`; })}</div><span class="ov-dim">one piece per channel, in its own format and length</span></fieldset>
        <fieldset class="st-copystart-f" disabled=${ro || live}><legend class="st-lbl">Content type</legend><div class="st-seg" role="radiogroup" aria-label="Content type">${DELIVERABLES.map(([k, l, t]) => html`<button key=${k} type="button" role="radio" aria-checked=${deliv === k} class=${'st-segbtn' + (deliv === k ? ' on' : '')} title=${t} onClick=${() => setDeliv(k)}>${l}</button>`)}</div><span class="ov-dim">${(DELIVERABLES.find(x => x[0] === deliv) || [])[2]}</span></fieldset>
      </div>
      <div class="st-copystart-what"><span class="st-lbl">What one call writes</span><ul class="st-ul"><li>For each channel: the ${fields.join(', ')}, checked against the approved facts and banned terms.</li>${deliv !== 'copy' ? html`<li>The visual narrative: the medium, the composition and what each image should show, laid out as an editable composition you can see straight away.</li><li><b>No image is generated here.</b> Once the words are marked ready, Design asks how the creative is made (editable layers or a full AI painting) before anything is spent on imagery.</li>` : html`<li>Copy only: nothing to design; the pieces go to Review once the words are ready.</li>`}</ul></div>
      ${!ro ? html`<div class="st-stepbar"><div><b>${chans.length ? chans.length + ' channel' + (chans.length === 1 ? '' : 's') + ': ' + chans.map(chanLabel).join(', ') : 'Choose at least one channel'}</b><span class="ov-dim">${changed ? 'The channels and content type are saved to the brief when you generate.' : 'From the confirmed objective, key message, strategy' + (chosen ? ' and direction' : '') + '.'}</span></div>
        <div class="st-stepbar-acts"><button class="btn sm" disabled=${!!busy || live || !chans.length || noClaude} title=${noClaude ? 'Claude is not configured on the worker' : ''} onClick=${go}><${Icon} n="sparkle" size=${14} /> Generate copy${deliv === 'copy' ? '' : ' and visual narrative'} <span class="ov-dim">(1 model call)</span></button></div></div>` : null}
    </section>`;
  }
  /** Copy written on an earlier objective, message, strategy or direction: said once, with the two honest choices. */
  function StaleCopy({ p, wf, busy, onRewrite, onKeep }) {
    const st = (wf && wf.steps && wf.steps.copy) || {}; if (st.why !== 'earlier_choice' || !(st.stale || []).length) return null;
    const n = st.stale.length; const ro = !canWrite() || p.readOnly;
    return html`<div class="st-warnbar st-stalecopy" role="status"><${Icon} n="alert" size=${16} /> <span><b>${n} piece${n === 1 ? ' was' : 's were'} written on an earlier choice.</b> The objective, message or strategy changed after ${n === 1 ? 'it was' : 'they were'} written. ${n === 1 ? 'It stays' : 'They stay'} as ${n === 1 ? 'it is' : 'they are'} until you decide.</span>
      ${!ro ? html`<span class="st-stalecopy-acts"><button class="btn sm" disabled=${!!busy} onClick=${onRewrite}>Write new copy from the current choice <span class="ov-dim">(1 model call)</span></button><button class="btn sm ghost" disabled=${!!busy} onClick=${() => onKeep(st.stale)}>Keep ${n === 1 ? 'it' : 'them'} under the current choice</button></span>` : null}</div>`;
  }

  /* ------------------------------------------------------------ production mode: chosen once the words are ready */
  function ProductionModes({ p, busy, prov, onProduce }) {
    const ro = !canWrite() || p.readOnly; const visual = p.assets.filter(a => { const v = K.current(a); return v && v.mode !== 'copy'; });
    const ready = visual.filter(a => K.standing(a, 'copy')); const notReady = visual.filter(a => !K.standing(a, 'copy'));
    const [mode, setMode] = useState(''); const [size, setSize] = useState((p.brief || {}).size || '2K'); const [sel, setSel] = useState(() => ready.map(a => a.id));
    useEffect(() => { setSel(ready.map(a => a.id)); }, [ready.map(a => a.id).join(',')]);
    const n = sel.filter(id => ready.some(a => a.id === id)).length; const noGem = prov && prov.gemini === false;
    return html`<section class="st-pmodes" aria-label="Production mode">
      <div class="st-pmodes-h"><h3>Choose the production mode</h3><span class="ov-dim">The words are settled; now decide how the creative is made. Nothing is generated until you press.</span></div>
      <div class="st-pmode-cards" role="radiogroup" aria-label="Production mode">${[['editable', 'Editable creative', 'Gemini makes the imagery; the Studio composes the words, the exact mark, the URL and the shapes as live layers. Every element stays editable, measured and exportable.', 'layers', 'one render per planned image'], ['finished', 'Full AI creative', 'Gemini paints the whole piece - words, the campaign mark (from its file) and the URL - as one finished image. Striking, but not editable as layers: a change regenerates it.', 'sparkle', 'one painting per piece']].map(([k, l, t, ic, cost], i) => html`<button key=${k} role="radio" aria-checked=${mode === k} class=${'st-pmode' + (mode === k ? ' on' : '')} style=${{ '--i': i }} onClick=${() => setMode(k)}><span class="st-type-ic"><${Icon} n=${ic} size=${22} /></span><b>${l}</b><span>${t}</span><span class="st-mini-chip">${cost}</span></button>`)}</div>
      ${visual.length ? html`<div class="st-pm-pieces"><span class="st-lbl">Pieces</span>${visual.map(a => { const ok = !!K.standing(a, 'copy'); return html`<label key=${a.id} class=${'st-pm-piece' + (ok ? '' : ' off')}><input type="checkbox" checked=${sel.indexOf(a.id) >= 0 && ok} disabled=${!ok || ro} onChange=${e => setSel(e.target.checked ? sel.concat([a.id]) : sel.filter(x => x !== a.id))} /><span class="st-pm-thumb"><${Composition} v=${K.current(a)} a=${a} ns=${p.ns} size="mini" /></span><span>${a.title}<span class="ov-dim">${ok ? ' copy ready' : ' copy not marked ready yet'}</span></span></label>`; })}</div>` : null}
      ${!ro ? html`<div class="st-stepbar"><div><b>${mode ? (mode === 'finished' ? 'Full AI creative' : 'Editable creative') + ' for ' + n + ' piece' + (n === 1 ? '' : 's') : 'Choose a mode'}</b><span class="ov-dim">${notReady.length ? notReady.length + ' piece' + (notReady.length === 1 ? '' : 's') + ' wait for their copy to be marked ready (Copy step). ' : ''}${noGem ? 'Image generation is not configured on the worker.' : 'Each image is a job you can watch, retry or cancel.'}</span></div>
        <div class="st-stepbar-acts"><label class="ov-dim">Resolution <select class="st-sel" value=${size} onChange=${e => setSize(e.target.value)} aria-label="Resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option></select></label><button class="btn sm" disabled=${!mode || !n || !!busy || noGem} onClick=${() => onProduce(mode, sel.filter(id => ready.some(a => a.id === id)), size)}><${Icon} n="image" size=${14} /> Generate ${n} piece${n === 1 ? '' : 's'}</button></div></div>` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ the project context, beside the early steps */
  function ContextPanel({ p, client, kit, wf }) {
    const b = p.brief || {}; const i0 = b.intel || {}; const sel = i0.selected || {}; const camp = ((kit && kit.campaigns) || []).find(c => c.id === p.campaign);
    const chosen = (p.directions || []).find(d => d.chosen);
    const T = (TYPES.find(t => t[0] === b.projectType) || [])[1];
    const row = (l, v, extra) => v ? html`<div class="st-ctx-row"><span class="st-lbl">${l}</span><span>${v}</span>${extra || null}</div>` : null;
    return html`<aside class="st-ctxpanel" aria-label="Project context">
      <div class="st-ctx-client"><${ClientLogo} c=${Object.assign({ ns: p.ns, name: client ? client.name : p.ns, accent: client && client.accent }, { hasLogo: !!(kit && kit.hasLogo), logoV: kit && kit.logoV })} size=${36} /><div><b>${client ? client.name : p.ns}</b><span class="ov-dim">${camp ? camp.name : b.campaignMode === 'detect' ? 'campaign: Axiom detects' : 'standalone'}${T ? ' - ' + T : ''}</span></div></div>
      ${row('Brief', ((b.analysis || {}).summary || '').slice(0, 220))}
      ${row('Objective', sel.objective && sel.objective.title)}
      ${row('Key message', sel.message && sel.message.primary)}
      ${row('Topics', (b.topics || []).join(', '))}
      ${row('Strategy', sel.strategy && (STRAT_WORD[sel.strategy.kind] || sel.strategy.kind))}
      ${row('Direction', chosen && chosen.title)}
      ${row('Channels', (b.channels || []).map(chanLabel).join(', '))}
      ${wf && wf.steps ? html`<ol class="st-ctx-steps" aria-label="Where the project stands">${PHASE_STEPS.map(([ph, ids]) => ids.length === 1 ? html`<li key=${ph} class=${(wf.steps[ids[0]] || {}).state}><span>${ph}</span><span class="ov-dim">${STEP_WORD[(wf.steps[ids[0]] || {}).state] || (wf.steps[ids[0]] || {}).state || ''}</span></li>`
        : html`<li key=${ph} class="st-ctx-phase"><span>${ph}</span><ol class="st-ctx-sub">${ids.map(k => html`<li key=${k} class=${(wf.steps[k] || {}).state}><span>${SUB_LABEL[k]}</span><span class="ov-dim">${STEP_WORD[(wf.steps[k] || {}).state] || (wf.steps[k] || {}).state || ''}</span></li>`)}</ol></li>`)}</ol>` : null}
    </aside>`;
  }

  window.STFlow = { Wizard, BriefWorkspace, ObjectivesStep, StrategyStep, DirectionsBoard, CopyStart, StaleCopy, ProductionModes, ProcessingCard, LockedStage, ImpactDialog, ContextPanel, MaterialComposer, materialSources, STEP_WORD, STEP_LABEL, TYPES, TYPE_CHANNELS };
})();
