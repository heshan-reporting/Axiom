/* AXIOM Creative Studio - the workspace (Phase 2: the production journey on the worker).
 *
 * One client-aware workspace for copy, creative and campaign production. Everything
 * on screen comes from /studio/* in the worker: projects, sources and their claim
 * ledger, directions, assets with immutable versions, approvals, jobs. Every model
 * call is a job the browser steps and the cron finishes if the tab closes; every
 * composition is drawn by the one renderer (studio-render.js) for preview and
 * export alike, so a headline edit changes both without an image model. What the
 * Studio cannot do yet says so: direction by instruction (revise, alternatives,
 * adapt) is Phase 3; the composer records a note to the team meanwhile. */
(function () {
  'use strict';
  if (!window.AXUI || !window.STRender) {
    window.studioInit = function () {
      const root = document.getElementById('studio-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The Studio runtime did not load.</b> The files under <code>docs/vendor/</code> or <code>docs/studio-render.js</code> are missing from this deployment.</div>';
    };
    return;
  }
  const { html, call, blobUrl, toastMsg, ago } = window.AXUI;
  const R = window.STRender;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const canWrite = () => !(window.AX_ROLE === 'read');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const FORMATS = { '1:1': { label: 'Square 1:1' }, '4:5': { label: 'Portrait 4:5' }, '9:16': { label: 'Story 9:16' }, '16:9': { label: 'Landscape 16:9' } };
  const CHANNELS = { linkedin: { label: 'LinkedIn', format: '1:1', max: 900 }, facebook: { label: 'Facebook', format: '1:1', max: 900 }, instagram: { label: 'Instagram', format: '4:5', max: 700 }, x: { label: 'X', format: '16:9', max: 280 } };
  const FALLBACK_CLIENTS = [{ id: 'mca', name: 'Minerals Council of Australia', accent: '#c9a227' }, { id: 'aep', name: 'Australian Energy Producers', accent: '#2f7fd6' }, { id: 'pca', name: 'Property Council of Australia', accent: '#3c9a6e' }];
  const clientList = () => (Array.isArray(window.CC_CLIENTS) && window.CC_CLIENTS.length ? window.CC_CLIENTS : FALLBACK_CLIENTS).map(c => ({ id: c.id, name: c.name, accent: c.accent || '#c9a227' }));
  const standing = (a, part) => (a && a.approvals && a.approvals[part]) || null;
  const current = a => (a && a.versions ? a.versions.find(v => v.id === a.current) || a.versions[a.versions.length - 1] : null);
  const vnum = (a, v) => (a && v ? a.versions.findIndex(x => x.id === v.id) + 1 : 0);
  const chanLabel = c => (CHANNELS[c] || { label: c || '-' }).label;
  const isClear = t => /^(adapt|write|make|produce|resize|shorten|draft|three|two|one|give me|turn|create)\b/i.test(String(t || '').trim());

  /* ------------------------------------------------------------ images behind the key */
  const imgCache = new Map();
  async function keyedImage(url) {
    if (!url) return null;
    if (imgCache.has(url)) return imgCache.get(url);
    const pr = (async () => { try { const b = await blobUrl(url); return await R.loadImage(b); } catch (e) { return null; } })();
    imgCache.set(url, pr); return pr;
  }
  function useImages(v, ns) {
    const [imgs, setImgs] = useState({ bg: null, logo: null });
    const bgUrl = v && v.image && v.image.url; const logoUrl = ns ? '/brand/logo?ns=' + encodeURIComponent(ns) : '';
    useEffect(() => { let live = true; (async () => { const [bg, logo] = await Promise.all([keyedImage(bgUrl), keyedImage(logoUrl)]); if (live) setImgs({ bg, logo }); })(); return () => { live = false; }; }, [bgUrl, logoUrl]);
    return imgs;
  }

  /* ------------------------------------------------------------ small parts */
  const Lbl = ({ children }) => html`<div class="st-lbl">${children}</div>`;
  const Chip = ({ kind, children, title }) => html`<span class=${'st-chip ' + (kind || '')} title=${title || ''}>${children}</span>`;
  const CHECK_KIND = { matches: 'ok', fact: 'ok', differs: 'bad', unsupported: 'warn', banned: 'bad', overflow: 'warn', over_limit: 'warn', too_many_hashtags: 'warn', exclamation: 'warn', small_type: 'warn', logo_size: 'warn' };
  const CHECK_WORD = { matches: 'matches source', fact: 'approved fact', differs: 'differs from source', unsupported: 'not supported', banned: 'banned term', overflow: 'overflow', over_limit: 'over the limit', too_many_hashtags: 'hashtags', exclamation: 'exclamation', small_type: 'small type', logo_size: 'logo size' };
  /** The composition: the one renderer at preview size. A copy-only version is a text card; a flattened legacy tile is its image. */
  function Composition({ v, a, ns, size, copy }) {
    const ref = useRef(null); const imgs = useImages(v, ns);
    const layout = v && v.layout && v.layout.layers ? v.layout : null; const c = copy || (v && v.copy) || {};
    useEffect(() => {
      const el = ref.current; if (!el) return;
      if (layout) { const w = size === 'thumb' ? 192 : Math.min(1080, Math.max(320, Math.round((el.parentElement ? el.parentElement.clientWidth : 520) * 2))); R.render(layout, c, imgs, w, el); }
      else if (imgs.bg) { el.width = imgs.bg.naturalWidth; el.height = imgs.bg.naturalHeight; el.getContext('2d').drawImage(imgs.bg, 0, 0); }
    }, [layout, JSON.stringify(c), imgs.bg, imgs.logo, size]);
    if (!layout && !(v && v.image)) return html`<div class=${'st-copycard' + (size === 'thumb' ? ' thumb' : '')}><div class="st-copycard-h">${c.headline || c.title || '(no headline)'}</div>${size !== 'thumb' ? html`<div class="st-copycard-b">${c.caption || c.body || ''}</div>` : null}<div class="st-comp-tag">copy only</div></div>`;
    return html`<div class=${'st-comp' + (size === 'thumb' ? ' thumb' : '')} role="img" aria-label=${c.alt || c.headline || ''}>
      <canvas class="st-canvas" ref=${ref}></canvas>
      ${size !== 'thumb' ? html`<div class="st-comp-tag">${layout ? 'editable composition, ' + (v.layout.templateName || v.layout.template) : v.mode === 'generated' ? 'generated artwork, text baked in' : 'image'}${v.image ? ' - ' + (v.image.model || '') + ' ' + (v.image.size || '') : layout ? ' - no background yet' : ''}</div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ library and intake */
  function Library({ client, data, onOpen, onNew, onImport, err }) {
    if (err) return html`<div class="st-lib"><div class="ov-empty">The Studio backend did not answer: ${err}. ${/not_found|404/.test(err) ? 'The worker does not have the Studio routes yet: redeploy it.' : ''}</div></div>`;
    if (!data) return html`<div class="st-lib"><div class="ov-empty">Loading projects for ${client.name}...</div></div>`;
    const mine = data.projects || [], legacy = data.legacy || [];
    return html`<div class="st-lib">
      <div class="st-lib-head"><span class="ov-title">Projects for ${client.name}</span><span class="ov-why">${mine.length} project${mine.length === 1 ? '' : 's'}, ${legacy.length} legacy item${legacy.length === 1 ? '' : 's'}</span>${canWrite() ? html`<button class="btn sm" onClick=${onNew}>New project</button>` : null}</div>
      ${data.status ? html`<div class="ov-dim st-foot">Backend build <b>${data.status.build}</b>, ${data.status.projects} project${data.status.projects === 1 ? '' : 's'} across clients; model calls today ${data.status.budget ? data.status.budget.used + ' of ' + data.status.budget.cap : '-'}; ${data.status.keys.claude ? 'Claude' : 'no Claude key'}, ${data.status.keys.gemini ? 'Gemini' : 'no Gemini key'}.</div>` : null}
      ${!mine.length && !legacy.length ? html`<div class="ov-empty">Nothing yet for this client. Start from a release, a brief or existing artwork.</div>` : null}
      <table class="ov-table"><thead><tr><th>Project</th><th>Campaign</th><th>Status</th><th>Owner</th><th>Last activity</th><th></th></tr></thead><tbody>
        ${mine.map(p => html`<tr key=${p.id}><td><b>${p.title}</b><div class="ov-dim">${p.assets} asset${p.assets === 1 ? '' : 's'}, ${p.sources} source${p.sources === 1 ? '' : 's'}${p.legacy ? ', imported from ' + p.legacy.id : ''}</div></td><td>${p.campaign || '-'}</td><td><span class=${'st-status ' + p.status}>${p.status}</span></td><td>${p.owner}</td><td class="ov-dim">${ago(p.updated)} ago</td><td class="ov-go"><button class="ov-link" onClick=${() => onOpen(p.id)}>open</button></td></tr>`)}
        ${legacy.map(l => html`<tr key=${l.id} class="st-legacy"><td><b>${l.title}</b><div class="ov-dim">legacy ${l.kind === 'legacy_release' ? 'release pack' : 'content set'}, read-only; ${l.assets} ${l.kind === 'legacy_release' ? 'flattened tiles' : 'pieces'}${l.imported ? '; imported' : ''}</div></td><td>${l.campaign || '-'}</td><td><span class="st-status legacy">${l.status}</span></td><td>${l.owner || '-'}</td><td class="ov-dim">${ago(l.updated)} ago</td><td class="ov-go">${l.imported ? html`<button class="ov-link" onClick=${() => onOpen(l.imported)}>open import</button>` : html`<button class="ov-link" onClick=${() => onOpen(l.id)}>view</button>`}${canWrite() && !l.imported ? html` <button class="ov-link" onClick=${() => onImport(l)}>import to Studio</button>` : null}</td></tr>`)}
      </tbody></table>
      <div class="ov-dim st-foot">Legacy items open read-only. Importing copies one into a Studio project under this client, keeps the original untouched, and is idempotent.</div>
    </div>`;
  }
  function Intake({ client, kit, onCreate, onCancel }) {
    const [start, setStart] = useState('release');
    const [deliverable, setDeliverable] = useState('set');
    const camps = (kit && kit.campaigns || []).filter(c => c.active !== false);
    const [campaign, setCampaign] = useState(camps[0] ? camps[0].id : '');
    const [text, setText] = useState(''); const [instruction, setInstruction] = useState('');
    const [chs, setChs] = useState({ linkedin: true, instagram: true, facebook: true, x: false });
    const [file, setFile] = useState(null);
    const clear = start === 'brief' ? isClear(text) : start === 'release' ? !!instruction.trim() : true;
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setFile({ name: f.name, mime: f.type || 'image/png', b64: String(rd.result).split(',')[1] }); rd.readAsDataURL(f); };
    return html`<div class="st-intake">
      <div class="ov-title">New project for ${client.name}</div>
      <div class="st-intake-row">
        <div><${Lbl}>Start from</${Lbl}><div class="st-seg">${[['release', 'A release or source document'], ['brief', 'A brief or one line'], ['reference', 'Existing creative or references']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (start === k ? ' on' : '')} onClick=${() => setStart(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Deliverable</${Lbl}><div class="st-seg">${[['copy', 'Copy only'], ['visual', 'Visual creative'], ['set', 'Coordinated campaign set']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (deliverable === k ? ' on' : '')} onClick=${() => setDeliverable(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Campaign</${Lbl}><select class="st-sel" value=${campaign} onChange=${e => setCampaign(e.target.value)} aria-label="Campaign"><option value="">No campaign</option>${camps.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select><div class="ov-dim">${camps.length ? 'From the brand kit. Choosing a campaign never changes the client or its approved facts.' : 'No campaigns in this client\'s brand kit yet.'}</div></div>
      </div>
      <${Lbl}>${start === 'release' ? 'Paste the release or source text' : start === 'brief' ? 'The brief, or one line' : 'What to do with the reference'}</${Lbl}>
      <textarea class="st-ta" rows="7" value=${text} onInput=${e => setText(e.target.value)} placeholder=${start === 'release' ? 'Paste the release text. Claims, figures and quotations are extracted with their passages before anything is written.' : start === 'brief' ? 'e.g. "Write three LinkedIn posts on the $74 billion figure in the HOOF voice" (a clear instruction goes straight to production) or "Something for Victoria about regional jobs" (an open brief gets two directions first)' : 'e.g. "Adapt the approved harvester tile for Instagram 4:5 and a 9:16 story; keep the headline"'}></textarea>
      ${start === 'release' ? html`<div><${Lbl}>Instruction (optional: a clear instruction skips the direction step)</${Lbl}><input class="st-in" value=${instruction} onInput=${e => setInstruction(e.target.value)} placeholder='e.g. "Three posts on the $74 billion figure" - leave empty to get two directions first' /></div>` : null}
      ${start === 'reference' ? html`<div class="st-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${pick} aria-label="Reference image" /> ${file ? html`<span>${file.name} attached as a composition reference.</span>` : html`<span>Attach artwork or a reference image (PNG, JPEG, WebP). Competitor work is inspiration only.</span>`}</div>` : null}
      ${deliverable !== 'visual' ? html`<div><${Lbl}>Channels (edit freely)</${Lbl}><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + (chs[k] ? ' on' : '')} onClick=${() => setChs(Object.assign({}, chs, { [k]: !chs[k] }))}>${CHANNELS[k].label} ${CHANNELS[k].format}</button>`)}</div></div>` : html`<div class="ov-dim">Visual creative: an Instagram 4:5 composition; adapt to other formats afterwards.</div>`}
      <div class="st-intake-foot">
        <span class="ov-dim">${start === 'release' ? (clear ? 'Extraction first, then production from your instruction; no direction step.' : 'Extraction first, then two directions to choose from.') : start === 'brief' ? (clear && text ? 'Reads as a clear instruction: production starts without a direction step.' : 'Reads as an open brief: two directions first.') : 'Production from the reference and your instruction; no direction step.'}</span>
        <button class="btn sm ghost" onClick=${onCancel}>Cancel</button>
        <button class="btn sm" disabled=${!text.trim()} onClick=${() => onCreate({ start, deliverable, campaign, text: text.trim(), instruction: instruction.trim(), channels: deliverable === 'visual' ? ['instagram'] : Object.keys(chs).filter(k => chs[k]), clear, file })}>Create project</button>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ rail and centre views */
  function Rail({ p, view, setView, sel, setSel }) {
    const fams = useMemo(() => { const m = {}; (p.assets || []).forEach(a => { (m[a.family] = m[a.family] || []).push(a); }); return m; }, [p.assets]);
    const stat = a => { const c = standing(a, 'copy'), d = standing(a, 'design'); const cur = current(a); return c && (d || (cur && cur.mode === 'copy')) ? 'approved' : c || d ? 'partly' : a.versions.length > 1 ? 'revised' : 'draft'; };
    const live = (p.jobs || []).filter(j => j.state === 'queued' || j.state === 'running').length;
    return html`<nav class="st-rail" aria-label="Project">
      <${Lbl}>Project</${Lbl}>
      ${[['brief', 'Brief'], ['sources', 'Sources', p.sources.length], ['references', 'References', p.references.length], ['directions', 'Directions', p.directions.length], ['context', 'Client context'], ['jobs', 'Jobs', live || null]].map(([k, l, n]) => html`<button key=${k} class=${'st-railbtn' + (view === k ? ' on' : '')} onClick=${() => setView(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`)}
      <${Lbl}>Assets</${Lbl}>
      ${Object.keys(fams).map(f => html`<div key=${f} class="st-fam"><div class="st-famname">${f}</div>${fams[f].map(a => html`<button key=${a.id} class=${'st-railbtn asset' + (view === 'asset' && sel === a.id ? ' on' : '')} onClick=${() => { setSel(a.id); setView('asset'); }}>
        <span>${a.title}<span class="ov-dim"> ${a.format}</span></span><span class=${'st-dot ' + stat(a)} title=${stat(a)}></span><span class="ov-dim">v${a.versions.length}</span></button>`)}</div>`)}
      ${!p.assets.length ? html`<div class="ov-dim st-pad">No assets yet. ${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction to start production.' : 'Production starts from the brief.'}</div>` : null}
    </nav>`;
  }
  function BriefView({ p, onSave, onDirect, onProduce, busy }) {
    const [b, setB] = useState(p.brief || {});
    useEffect(() => { setB(p.brief || {}); }, [p.id, p.revision]);
    const set = (k, v) => setB(Object.assign({}, b, { [k]: v }));
    const dirty = JSON.stringify(b) !== JSON.stringify(p.brief || {});
    const chans = (b.channels || []).map(chanLabel).join(', ');
    return html`<div class="st-centre-pad">
      <div class="ov-sechead"><span class="ov-title">Brief</span><span class="ov-why">${chans ? 'for ' + chans + ', ' + (b.deliverable || 'set') : 'channels and deliverable are set at intake'}</span>${dirty && canWrite() && !p.readOnly ? html`<button class="btn sm" style=${{ marginLeft: 'auto' }} onClick=${() => onSave(b)}>Save brief</button>` : null}</div>
      ${['objective', 'audience', 'message', 'deliverables'].map(k => html`<div key=${k} class="st-field"><${Lbl}>${k}${(b.proposed || []).indexOf(k) >= 0 ? html` <${Chip} kind="warn">proposed by the Studio</${Chip}>` : null}</${Lbl}><textarea class="st-ta" rows="2" value=${b[k] || ''} disabled=${!canWrite() || p.readOnly} onInput=${e => set(k, e.target.value)}></textarea></div>`)}
      ${b.assumptions && b.assumptions.length ? html`<div class="st-field"><${Lbl}>Assumptions the Studio made (edit or remove)</${Lbl}><ul class="st-ul">${b.assumptions.map((a, i) => html`<li key=${i}>${a} ${canWrite() && !p.readOnly ? html`<button class="ov-link" onClick=${() => onSave(Object.assign({}, b, { assumptions: b.assumptions.filter((_, j) => j !== i) }))}>remove</button>` : null}</li>`)}</ul></div>` : null}
      ${(b.notRecorded || []).length ? html`<div class="ov-dim">Not recorded at the time: ${b.notRecorded.join(', ')}. Left blank rather than invented.</div>` : null}
      ${canWrite() && !p.readOnly && !p.assets.length ? html`<div class="st-pad"><button class="btn sm" disabled=${!!busy} onClick=${onProduce}>Produce now</button> <button class="btn sm ghost" disabled=${!!busy} onClick=${onDirect}>Two directions first</button> <span class="ov-dim">A clear brief goes straight to production; an open one gets directions to choose from.</span></div>` : null}
    </div>`;
  }
  function SourcesView({ p, onAdd, busy }) {
    const [text, setText] = useState(''); const [name, setName] = useState('');
    return html`<div class="st-centre-pad">
      <div class="ov-title">Sources and the claim ledger</div>
      ${!p.sources.length ? html`<div class="ov-empty">No source yet. Figures and quotations in copy are marked as not supported until one is added.</div>` : null}
      ${p.sources.map(s => html`<div key=${s.id} class="st-source">
        <div class="st-source-head"><b>${s.name}</b><span class="ov-dim"> ${s.kind}, ${s.chars} characters, ${Object.keys(s.passages || {}).length} passages, ${s.claims.length} claims${s.claims.length ? '' : ' (extraction has not run)'}</span></div>
        ${s.claims.length ? html`<table class="ov-table st-ledger"><thead><tr><th>Claim</th><th>Value</th><th>Period</th><th>Passage</th></tr></thead><tbody>
          ${s.claims.map(c => html`<tr key=${c.id} class=${c.verified === false ? 'unv' : ''}><td><span class="ov-dim">${c.id}</span> ${c.quote ? html`<em>"${c.text}"</em>${c.who ? html` <span class="ov-dim">- ${c.who}</span>` : null}` : c.text}${c.verified === false ? html` <${Chip} kind="warn">unverified</${Chip}> <span class="ov-dim">${c.note || ''}</span>` : null}</td><td class="num">${c.value != null ? Number(c.value).toLocaleString('en-AU') + ' ' + (c.unit || '') : html`<span class="ov-dim">-</span>`}</td><td class="ov-dim">${c.period || '-'}</td><td>${c.passage ? html`<details><summary class="ov-link">${c.passage}</summary><div class="st-passage">${(s.passages || {})[c.passage]}</div></details>` : html`<span class="ov-dim">-</span>`}</td></tr>`)}
        </tbody></table>` : null}
        <div class="ov-dim">Extraction can be wrong: a claim is reviewable, and "matches source" never means independently verified or legally cleared.</div>
      </div>`)}
      ${canWrite() && !p.readOnly ? html`<div class="st-field"><${Lbl}>Add a source</${Lbl}><input class="st-in" value=${name} onInput=${e => setName(e.target.value)} placeholder="Name (e.g. ATO release 2025)" /><textarea class="st-ta" rows="4" value=${text} onInput=${e => setText(e.target.value)} placeholder="Paste the text. Extraction runs as a job."></textarea><div class="st-pad"><button class="btn sm" disabled=${text.trim().length < 20 || !!busy} onClick=${() => { onAdd(name.trim() || 'Pasted text', text.trim()); setText(''); setName(''); }}>Add and extract</button></div></div>` : null}
    </div>`;
  }
  function RefThumb({ r }) {
    const [u, setU] = useState('');
    useEffect(() => { let live = true; if (r.url) blobUrl(r.url).then(x => { if (live) setU(x); }).catch(() => {}); return () => { live = false; }; }, [r.url]);
    return u ? html`<img class="st-ref-thumb" src=${u} alt="" />` : html`<div class=${'st-ref-thumb ' + r.kind}>${r.kind}</div>`;
  }
  function ReferencesView({ p, onAdd, busy }) {
    const [purpose, setPurpose] = useState('composition'); const [note, setNote] = useState('');
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => onAdd({ name: f.name, mime: f.type || 'image/png', imageB64: String(rd.result).split(',')[1], purpose, note }); rd.readAsDataURL(f); e.target.value = ''; };
    return html`<div class="st-centre-pad"><div class="ov-title">References</div>
      ${!p.references.length ? html`<div class="ov-empty">No references. The client logo comes from the brand kit and is placed exactly, never redrawn.</div>` : null}
      <div class="st-refs">${p.references.map(r => html`<div key=${r.id} class="st-ref"><${RefThumb} r=${r} /><div><b>${r.name}</b><div class="ov-dim">purpose: ${r.purpose}${r.note ? ' - ' + r.note : ''}; added by ${r.who}, ${aest(r.created)}</div></div></div>`)}</div>
      ${canWrite() && !p.readOnly ? html`<div class="st-field"><${Lbl}>Add a reference</${Lbl}><div class="st-seg">${['brand', 'composition', 'mood', 'imagery', 'typography', 'inspiration', 'approved'].map(k => html`<button key=${k} class=${'st-segbtn' + (purpose === k ? ' on' : '')} onClick=${() => setPurpose(k)}>${k}</button>`)}</div><input class="st-in" value=${note} onInput=${e => setNote(e.target.value)} placeholder="Note (what to take from it)" /><div class="st-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${pick} disabled=${!!busy} aria-label="Reference image" /> PNG, JPEG or WebP up to 6 MB. Competitor work is inspiration only: no logos, claims or exact layouts reused.</div></div>` : null}
    </div>`;
  }
  function DirectionsView({ p, onChoose, onMore, busy }) {
    return html`<div class="st-centre-pad"><div class="ov-title">Directions</div>
      <div class="ov-why">Two or three genuinely different directions for an open brief, each citing the ledger claims it would use. Choose one, or ask for more. A clear production instruction skips this step.</div>
      ${!p.directions.length ? html`<div class="ov-empty">No directions yet.</div>` : null}
      <div class="st-dirs">${p.directions.map((d, i) => html`<div key=${d.id} class=${'st-dir' + (d.chosen ? ' chosen' : '')}>
        <div class="st-dir-title">${String.fromCharCode(65 + i)}) ${d.title}${d.chosen ? html`<${Chip} kind="ok">chosen</${Chip}>` : d.similar ? html`<${Chip} kind="warn" title=${'reads close to ' + d.similar}>close to ${d.similar}</${Chip}>` : null}</div>
        <div class="st-dir-h">${d.headline}</div>
        <div class="st-dir-line"><b>Message</b> ${d.message}</div>
        <div class="st-dir-line"><b>Insight</b> ${d.insight}</div>
        <div class="st-dir-line"><b>Opening</b> ${d.opening}</div>
        <div class="st-dir-line"><b>Visual</b> ${d.visual}</div>
        <div class="st-dir-line"><b>Why</b> ${d.rationale}</div>
        <div class="st-dir-line"><b>Claims</b> ${(d.claims || []).join(', ') || 'none'} <span class="ov-dim">${d.uncertainty}</span></div>
        <div class="ov-dim">${d.model || ''}${d.who && d.who !== 'studio' ? ', recorded by ' + d.who : ''}</div>
        ${canWrite() && !p.readOnly && !d.chosen ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => onChoose(d.id)}>Choose this direction</button>` : null}
      </div>`)}</div>
      ${canWrite() && !p.readOnly ? html`<div class="st-pad"><button class="btn sm ghost" disabled=${!!busy} onClick=${onMore}>Two more directions</button> <span class="ov-dim">One model call; nothing is produced until you choose.</span></div>` : null}
    </div>`;
  }
  function ContextView({ p }) {
    const [c, setC] = useState(undefined);
    useEffect(() => { let live = true; setC(undefined); call('/studio/context?project=' + encodeURIComponent(p.id)).then(d => { if (live) setC(d); }).catch(e => { if (live) setC({ error: e.message }); }); return () => { live = false; }; }, [p.id, p.revision]);
    if (c === undefined) return html`<div class="st-centre-pad"><div class="ov-empty">Reading what the Studio knows about ${p.ns}...</div></div>`;
    if (c.error) return html`<div class="st-centre-pad"><div class="ov-empty">${c.error}</div></div>`;
    return html`<div class="st-centre-pad"><div class="ov-title">What the Studio knows about ${c.client}</div>
      <div class="ov-why">${c.note}</div>
      <div class="st-ctx">
        <${Lbl}>Brand kit</${Lbl}><div>${c.kit.name || 'no kit saved'}${c.kit.updated ? ', updated ' + aest(c.kit.updated) : ''}; ${c.kit.hasLogo ? 'logo on file (placed exactly, never redrawn)' : 'no logo on file'}; fonts ${c.kit.fonts.display || '-'} / ${c.kit.fonts.body || '-'}.</div>
        ${c.kit.voice ? html`<${Lbl}>Voice</${Lbl}><div>${c.kit.voice}</div>` : null}
        <${Lbl}>Mandatory rules (kit)</${Lbl}>${c.kit.rules.length ? html`<ul class="st-ul">${c.kit.rules.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>` : html`<div class="ov-dim">none recorded</div>`}
        <${Lbl}>Learned corrections in force (${c.learned.length})</${Lbl}>${c.learned.length ? html`<ul class="st-ul">${c.learned.map(f => html`<li key=${f.id}>${f.rule} <span class="ov-dim">${f.task}, ${f.scope}${f.who ? ', taught by ' + f.who : ''}</span></li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Approved facts (${c.facts.length}) - the only figures besides the sources</${Lbl}>${c.facts.length ? html`<ul class="st-ul">${c.facts.map(f => html`<li key=${f.id}>${f.text}${f.source ? html` <span class="ov-dim">(${f.source})</span>` : null}${f.campaign ? html` <${Chip}>${f.campaign}</${Chip}>` : null}</li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Never use (${c.banned.length})</${Lbl}>${c.banned.length ? html`<ul class="st-ul">${c.banned.map((b, i) => html`<li key=${i}>"${b.term}"${b.use ? ' - say "' + b.use + '"' : ''}${b.allowNegated ? ' (allowed inside a denial)' : ''}${b.why ? html` <span class="ov-dim">${b.why}</span>` : null}</li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Campaign</${Lbl}><div>${c.campaign ? c.campaign.name + (c.campaign.signoff ? ' - sign-off "' + c.campaign.signoff + '"' : '') + (c.campaign.tone ? '; tone: ' + c.campaign.tone : '') : 'no campaign on this project'}${c.campaigns.length ? html` <span class="ov-dim">(${c.campaigns.length} in the kit)</span>` : null}</div>
        <${Lbl}>Creative shelf and examples</${Lbl}><div>${c.shelf.error ? c.shelf.error : c.shelf.docs + ' document' + (c.shelf.docs === 1 ? '' : 's') + ' on the ' + c.ns + '_creative shelf near this brief, ' + (c.shelf.examples || 0) + ' approved examples retrieved. Nothing from any other client.'}</div>
        <${Lbl}>Models</${Lbl}><div>directions and copy: ${c.models.creative}; extraction: ${c.models.extract}; images: ${c.models.image}. Reachability is checked by /studio/models, never assumed.</div>
      </div>
    </div>`;
  }
  function JobsView({ p, onRetry, onCancel, onStep, budget }) {
    const jobs = (p.jobs || []).slice();
    const asset = id => (p.assets.find(x => x.id === id) || {}).title || (id ? id : '-');
    return html`<div class="st-centre-pad"><div class="ov-title">Jobs</div>
      <div class="ov-why">Every generation is a persistent job: claimed with a lease, one stage at a time, stepped by this browser while the tab is open and finished by the worker's tick otherwise. No invented percentages.${budget ? ' Model calls today: ' + budget.used + ' of ' + budget.cap + '.' : ''}</div>
      ${!jobs.length ? html`<div class="ov-empty">No jobs yet.</div>` : null}
      <table class="ov-table"><thead><tr><th>Job</th><th>Stage</th><th>Asset</th><th>State</th><th class="num">Attempts</th><th>When</th><th></th></tr></thead><tbody>
        ${jobs.map(j => html`<tr key=${j.id}><td class="ov-dim">${j.id}</td><td>${j.stage}</td><td>${asset(j.asset)}</td><td><span class=${'st-status ' + j.state}>${j.state}</span>${j.error ? html`<div class="ov-dim">${j.error}</div>` : null}${j.progress && j.progress.lines && j.progress.lines.length ? html`<details><summary class="ov-link">${j.progress.lines.length} log lines</summary><div class="st-joblog">${j.progress.lines.map(l => html`<div key=${l.id} class=${'st-jobline ' + l.kind}>${l.kind === 'cmd' ? '$ ' : l.kind === 'err' ? '! ' : '> '}${l.text}</div>`)}</div></details>` : null}</td><td class="num">${j.attempts}</td><td class="ov-dim">${aest(j.updated || j.created)}</td><td class="ov-go">${canWrite() ? html`${j.state === 'failed' ? html`<button class="ov-link" onClick=${() => onRetry(j)}>retry</button>` : null} ${j.state === 'queued' ? html`<button class="ov-link" onClick=${() => onStep(j)}>run now</button> <button class="ov-link" onClick=${() => onCancel(j.id)}>cancel</button>` : null} ${j.state === 'running' ? html`<button class="ov-link" onClick=${() => onCancel(j.id)}>cancel</button>` : null}` : null}</td></tr>`)}
      </tbody></table>
    </div>`;
  }
  function CompareView({ a, ns, vA, vB, onClose, onRestore }) {
    const rows = ['headline', 'support', 'cta', 'caption', 'alt'];
    return html`<div class="st-centre-pad"><div class="ov-sechead"><span class="ov-title">Compare</span><span class="ov-why">${a.title}: v${vnum(a, vA)} against v${vnum(a, vB)}</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onClose}>Back</button></div>
      <div class="st-cmp">${[vA, vB].map(v => html`<div key=${v.id}><div class="ov-dim">v${vnum(a, v)}, ${v.note}, ${aest(v.created)}, ${v.who}</div><${Composition} v=${v} a=${a} ns=${ns} />${canWrite() && v.id !== a.current ? html`<button class="btn sm ghost" onClick=${() => onRestore(v.id)}>Restore this as a new version</button>` : v.id === a.current ? html`<${Chip} kind="ok">current</${Chip}>` : null}</div>`)}</div>
      <table class="ov-table"><thead><tr><th>Field</th><th>Left</th><th>Right</th></tr></thead><tbody>${rows.map(k => html`<tr key=${k} class=${(vA.copy || {})[k] !== (vB.copy || {})[k] ? 'hot' : ''}><td class="ov-dim">${k}</td><td>${(vA.copy || {})[k]}</td><td>${(vB.copy || {})[k]}</td></tr>`)}<tr class=${((vA.image || {}).key) !== ((vB.image || {}).key) ? 'hot' : ''}><td class="ov-dim">image</td><td>${vA.image ? vA.image.key.split('/').pop() : '-'}</td><td>${vB.image ? vB.image.key.split('/').pop() : '-'}</td></tr><tr class=${JSON.stringify(vA.layout) !== JSON.stringify(vB.layout) ? 'hot' : ''}><td class="ov-dim">layout</td><td>${vA.layout && vA.layout.template ? vA.layout.templateName : '-'}</td><td>${vB.layout && vB.layout.template ? vB.layout.templateName : '-'}</td></tr></tbody></table>
    </div>`;
  }
  function AssetView({ p, a, sel, setSel, onEdit, onLayout, onLock, onApprove, onCompare, onRestore, onRender, busy }) {
    const v = current(a);
    const [hist, setHist] = useState(false); const [zoom, setZoom] = useState('fit'); const [rr, setRr] = useState(null);
    const [draft, setDraft] = useState({}); const timer = useRef(null);
    useEffect(() => { setDraft({}); }, [a.id, a.current]);
    const copy = Object.assign({}, v ? v.copy : {}, draft);
    const edit = (k, val) => { const d = Object.assign({}, draft, { [k]: val }); setDraft(d); clearTimeout(timer.current); timer.current = setTimeout(() => onEdit(a, d), 800); };
    const ap = { copy: standing(a, 'copy'), design: standing(a, 'design') };
    const flat = v && v.mode === 'generated'; const copyOnly = v && v.mode === 'copy'; const ro = !canWrite() || p.readOnly;
    const fields = [['headline', copyOnly ? 'Hook line' : 'Headline'], ['support', 'Support line'], ['cta', 'Call to action'], ['caption', 'Caption (' + chanLabel(a.channel) + ', ' + (copy.caption || '').length + ' of ' + ((CHANNELS[a.channel] || {}).max || 900) + ')'], ['alt', 'Alt text']];
    if (!v) return html`<div class="st-centre-pad"><div class="ov-empty">This asset has no version.</div></div>`;
    const hl = v.layout && v.layout.layers ? v.layout.layers.find(l => l.role === 'headline') : null;
    return html`<div class="st-asset">
      <div class="st-asset-head">
        <div><b>${a.title}</b> <span class="ov-dim">${chanLabel(a.channel)} ${(FORMATS[a.format] || {}).label || a.format}, ${a.family}; v${vnum(a, v)} of ${a.versions.length}, ${v.note}${v.who ? ', ' + v.who : ''}</span></div>
        <div class="st-asset-acts">
          ${!copyOnly ? html`<button class="btn sm ghost" onClick=${() => setZoom(zoom === 'fit' ? 'actual' : 'fit')} title="Fit to screen or actual size">${zoom === 'fit' ? 'Actual size' : 'Fit'}</button>` : null}
          <button class="btn sm ghost" onClick=${() => setHist(!hist)}>Versions (${a.versions.length})</button>
          ${a.versions.length > 1 ? html`<button class="btn sm ghost" onClick=${() => onCompare(a.versions[a.versions.length - 2].id, v.id)}>Compare</button>` : null}
        </div>
      </div>
      <div class=${'st-stage ' + zoom}>
        <div class="st-stage-inner"><${Composition} v=${v} a=${a} ns=${p.ns} copy=${copy} /></div>
        ${flat ? html`<div class="st-flatnote">This is a flattened legacy tile: the text on the image is not editable. Editing the caption below does not change the image; rebuilding it as a composition is a later phase.</div>` : null}
        ${!copyOnly && !flat && !v.image ? html`<div class="st-flatnote">No background yet: ${(p.jobs || []).some(j => j.asset === a.id && j.stage === 'render' && (j.state === 'queued' || j.state === 'running')) ? 'a render job is ' + ((p.jobs || []).find(j => j.asset === a.id && j.stage === 'render' && (j.state === 'queued' || j.state === 'running')) || {}).state + ' (see Jobs).' : 'the composition is drawn over a plain ground until one is rendered.'}</div>` : null}
      </div>
      <div class="st-copy">
        ${fields.map(([k, label]) => html`<div key=${k} class=${'st-field' + (sel === k ? ' on' : '') + (a.locks[k] ? ' locked' : '')} onClick=${() => setSel(k)}>
          <div class="st-field-head"><${Lbl}>${label}</${Lbl}>${!ro ? html`<button class=${'st-lock' + (a.locks[k] ? ' on' : '')} onClick=${e => { e.stopPropagation(); onLock(a, k, !a.locks[k]); }} title=${a.locks[k] ? 'Locked: survives revisions until unlocked' : 'Lock this element'} aria-pressed=${!!a.locks[k]}>${a.locks[k] ? 'locked' : 'lock'}</button>` : null}</div>
          ${k === 'caption' || k === 'support' ? html`<textarea class="st-ta" rows=${k === 'caption' ? 4 : 2} value=${copy[k] || ''} disabled=${ro || a.locks[k] || (flat && k !== 'caption' && k !== 'alt')} onInput=${e => edit(k, e.target.value)}></textarea>` : html`<input class="st-in" value=${copy[k] || ''} disabled=${ro || a.locks[k] || (flat && k !== 'alt')} onInput=${e => edit(k, e.target.value)} />`}
        </div>`)}
        ${Object.keys(draft).length ? html`<div class="ov-dim">Saving as a new version (text change, no render)...</div>` : null}
        <div class="st-field"><div class="st-field-head"><${Lbl}>Layout</${Lbl}>${!ro && !copyOnly && !flat ? html`<button class=${'st-lock' + (a.locks.layout ? ' on' : '')} onClick=${() => onLock(a, 'layout', !a.locks.layout)} aria-pressed=${!!a.locks.layout}>${a.locks.layout ? 'locked' : 'lock'}</button>` : null}</div>
          <div class="ov-dim">${copyOnly ? 'copy only: no tile' : flat ? 'not editable (flattened)' : v.layout && v.layout.layers ? 'editable composition: ' + v.layout.templateName + ', headline ' + (hl ? hl.size : '-') + '% of the width, ' + v.layout.layers.length + ' layers' + (v.layout.layers.some(l => l.role === 'logo') ? ', kit logo placed exactly' : ', no logo on file') + '.' : 'no layout'}
            ${!ro && hl && !a.locks.layout ? html` <button class="ov-link" onClick=${() => onLayout(a, -0.6)}>headline smaller</button> <button class="ov-link" onClick=${() => onLayout(a, 0.6)}>larger</button> <span class="ov-dim">(a layout version, no render)</span>` : null}</div></div>
        ${!copyOnly && !flat && !ro ? html`<div class="st-field"><${Lbl}>Background</${Lbl}>${rr === null ? html`<div><button class="btn sm ghost" disabled=${!!busy} onClick=${() => setRr(String((v.context || {}).visual || ''))}>${v.image ? 'Re-render background' : 'Render background'}</button> <span class="ov-dim">announced first: one render at ${(v.image && v.image.size) || '2K'}, text and layout unchanged.</span></div>` : html`<div class="st-proposal"><div class="ov-dim">Art direction for the photograph (no text, no logos - the words are layers):</div><textarea class="st-ta" rows="2" value=${rr} onInput=${e => setRr(e.target.value)}></textarea><div><button class="btn sm" disabled=${!!busy} onClick=${() => { onRender(a, rr); setRr(null); }}>Do this (one render)</button> <button class="btn sm ghost" onClick=${() => setRr(null)}>Not now</button></div></div>`}</div>` : null}
        <div class="st-field"><${Lbl}>Checks on this version</${Lbl}>
          <ul class="st-checks">
            ${(v.checks || []).map((c, i) => html`<li key=${i} class=${c.state}><${Chip} kind=${CHECK_KIND[c.state] || 'warn'}>${CHECK_WORD[c.state] || c.state}</${Chip}> <b>${c.text}</b> <span class="ov-dim">${c.note}</span></li>`)}
            ${!(v.checks || []).length ? html`<li><span class="ov-dim">No figures, quotations or fit problems found in this copy.</span></li>` : null}
            <li class="ov-dim">Deterministic checks on figures, units, quotations, banned terms, limits and fit. Matching a source is not independent verification.</li>
          </ul>
        </div>
        <div class="st-approve">
          ${['copy', 'design'].filter(part => part === 'copy' || !copyOnly).map(part => html`<div key=${part} class="st-appr"><span><b>${part}</b> ${ap[part] ? html`<${Chip} kind="ok">approved</${Chip}> <span class="ov-dim">on v${a.versions.findIndex(x => x.id === ap[part].version) + 1} by ${ap[part].by}, ${ap[part].reason}${ap[part].carried ? ' (unchanged since, so it stands)' : ''}</span>` : html`<span class="ov-dim">draft</span>`}</span>
            ${!ro ? html`<span>${ap[part] ? html`<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'withdraw')}>Withdraw</button>` : html`<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'approve')}>Approve ${part}</button>`}<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'reject')}>Reject</button></span>` : null}
          </div>`)}
        </div>
      </div>
      ${hist ? html`<div class="st-hist"><div class="ov-sechead"><span class="ov-title">Versions</span><span class="ov-why">immutable; restore creates a new current version that references the earlier content</span></div>
        ${a.versions.slice().reverse().map(x => html`<div key=${x.id} class=${'st-hist-row' + (x.id === a.current ? ' cur' : '')}><${Composition} v=${x} a=${a} ns=${p.ns} size="thumb" /><div><b>v${vnum(a, x)}</b> <${Chip} kind=${x.kind === 'render' ? 'warn' : ''}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.created)}, ${x.who}${x.parent && x.parent !== (a.versions[vnum(a, x) - 2] || {}).id ? ' (branch)' : ''}</div></div><div>${x.id === a.current ? html`<${Chip} kind="ok">current</${Chip}>` : !ro ? html`<button class="ov-link" onClick=${() => onRestore(a, x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
      </div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ the right panel: the project thread */
  function Partner({ p, a, target, setTarget, onNote, busy }) {
    const [text, setText] = useState(''); const box = useRef(null);
    useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [p.thread.length, busy]);
    const targets = [['asset', 'This asset' + (a ? ': ' + a.title : '')], ['set', 'The whole set']];
    return html`<aside class="st-partner" aria-label="Project thread">
      <div class="st-partner-head"><span class="ov-title">Project thread</span><span class="ov-why">what the Studio did, why, and the team's notes; ${p.ns.toUpperCase()} only</span></div>
      <div class="st-thread" ref=${box}>
        ${p.thread.map(m => html`<div key=${m.id} class=${'st-msg ' + (m.who === 'studio' ? 'studio' : 'you')}>
          <div class="st-msg-meta">${m.who === 'studio' ? 'Studio' : m.who || 'team'}${m.target ? html` <span class="ov-dim">to ${m.target}</span>` : null} <span class="ov-dim">${aest(m.at)}${m.kind && m.kind !== 'note' ? ' - ' + m.kind : ''}</span></div>
          <div class="st-msg-text">${m.text}</div>
          ${m.changed || m.render != null ? html`<div class="st-msg-foot">${m.changed ? m.changed.length + ' asset' + (m.changed.length === 1 ? '' : 's') + ' changed ' : ''}${m.render ? html`<${Chip} kind="warn">render spent</${Chip}>` : m.render === false ? html`<${Chip} kind="ok">no render</${Chip}>` : null}</div>` : null}
        </div>`)}
        ${busy ? html`<div class="st-msg studio"><div class="st-msg-text ov-dim">${busy}</div></div>` : null}
      </div>
      ${canWrite() && !p.readOnly ? html`<div class="st-composer">
        <select class="st-sel" value=${target} onChange=${e => setTarget(e.target.value)} aria-label="Target of the note">${targets.map(([k, l]) => html`<option key=${k} value=${k} disabled=${k === 'asset' && !a}>${l}</option>`)}</select>
        <textarea class="st-ta" rows="2" value=${text} placeholder="A note to the team, recorded on the project. Direction by instruction (revise, alternatives, adapt) arrives in Phase 3; until then edit the fields directly." onInput=${e => setText(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { onNote(text.trim(), target === 'asset' && a ? a.title : 'the whole set'); setText(''); } } }} aria-label="Note"></textarea>
        <button class="btn sm" disabled=${!text.trim() || !!busy} onClick=${() => { onNote(text.trim(), target === 'asset' && a ? a.title : 'the whole set'); setText(''); }}>Record note</button>
      </div>` : html`<div class="ov-dim st-pad">A read-only key can review, compare and export; changing the work needs a full key.</div>`}
    </aside>`;
  }

  /* ------------------------------------------------------------ dialogs */
  function ExportDialog({ p, client, onClose, onClickup, onExport, state }) {
    const rows = p.assets.map(a => { const v = current(a); const c = standing(a, 'copy'), d = standing(a, 'design'); const copyOnly = v && v.mode === 'copy'; return { a, v, c, d, ok: !!(c && (d || copyOnly)), partly: !!(c || d) }; });
    const ready = rows.filter(x => x.ok);
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="Export"><div class="st-dialog-box">
      <div class="ov-sechead"><span class="ov-title">Export</span><span class="ov-why">approved versions only; the export records the exact version it took</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onClose}>Close</button></div>
      <table class="ov-table"><thead><tr><th>Asset</th><th>Version</th><th>Copy</th><th>Design</th><th>Export</th></tr></thead><tbody>${rows.map(x => html`<tr key=${x.a.id}><td>${x.a.title}</td><td class="ov-dim">v${vnum(x.a, x.v)}</td><td>${x.c ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.v && x.v.mode === 'copy' ? html`<span class="ov-dim">copy only</span>` : x.d ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.ok ? html`<${Chip} kind="ok">included</${Chip}>` : html`<span class="ov-dim">left out${x.partly ? ' (partly approved)' : ''}</span>`}</td></tr>`)}</tbody></table>
      <div class="st-pad"><b>${ready.length}</b> asset${ready.length === 1 ? '' : 's'} ready: each composition drawn at its native size by the same renderer as the preview, one copy sheet (headline, support, CTA, caption, alt text, checks, approvals), the manifest with the context snapshot. ${state && state.msg ? html`<div class="ov-dim">${state.msg}</div>` : null}</div>
      <div class="st-dialog-acts"><button class="btn sm" disabled=${!ready.length || (state && state.busy)} onClick=${() => onExport(ready)}>${state && state.busy ? 'Preparing...' : 'Download bundle'}</button><button class="btn sm ghost" disabled=${!ready.length || !canWrite()} onClick=${() => onClickup(ready)}>Send to ClickUp...</button><span class="ov-dim">Export never creates a task or sends anything by itself; the hand-off is its own step.</span></div>
    </div></div>`;
  }
  function ClickupDialog({ ready, client, p, onClose }) {
    const [state, setState] = useState({ busy: false, msg: '' });
    const send = async () => {
      setState({ busy: true, msg: '' }); const done = [];
      for (const x of ready) {
        try { const r = await call('/clickup', { name: client.name + ' - ' + p.title + ' - ' + x.a.title + ' (v' + vnum(x.a, x.v) + ')', description: ['Approved in the AXIOM Studio.', 'Headline: ' + (x.v.copy.headline || ''), 'Support: ' + (x.v.copy.support || ''), 'CTA: ' + (x.v.copy.cta || ''), 'Caption: ' + (x.v.copy.caption || ''), 'Alt: ' + (x.v.copy.alt || ''), 'Version ' + x.v.id + ' of asset ' + x.a.id + ', project ' + p.id].join('\n'), tags: ['studio', p.ns] }); done.push(x.a.title + (r.url ? ' -> ' + r.url : '')); }
        catch (e) { setState({ busy: false, msg: 'Stopped at ' + x.a.title + ': ' + e.message + (done.length ? '. Created: ' + done.join('; ') : '') }); return; }
      }
      setState({ busy: false, msg: 'Created ' + done.length + ' task' + (done.length === 1 ? '' : 's') + ': ' + done.join('; ') }); toastMsg(done.length + ' ClickUp task' + (done.length === 1 ? '' : 's') + ' created');
    };
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="Send to ClickUp"><div class="st-dialog-box narrow">
      <div class="ov-title">Send to ClickUp</div>
      <div class="st-pad">Destination: the worker's configured ClickUp list. One task per asset with the approved copy; images are downloaded from the bundle:</div>
      <ul class="st-ul">${ready.map(x => html`<li key=${x.a.id}>${x.a.title}, v${vnum(x.a, x.v)}</li>`)}</ul>
      ${state.msg ? html`<div class="ov-dim st-pad">${state.msg}</div>` : null}
      <div class="st-dialog-acts"><button class="btn sm" disabled=${state.busy} onClick=${send}>Create ${ready.length} task${ready.length === 1 ? '' : 's'}</button><button class="btn sm ghost" onClick=${onClose}>${state.msg ? 'Close' : 'Cancel'}</button></div>
    </div></div>`;
  }
  function ReasonDialog({ title, prompt, onDone }) {
    const [why, setWhy] = useState('');
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label=${title}><div class="st-dialog-box narrow">
      <div class="ov-title">${title}</div><div class="st-pad">${prompt}</div>
      <textarea class="st-ta" rows="2" value=${why} onInput=${e => setWhy(e.target.value)} placeholder="Reason (recorded with the decision; client taste, not performance)" autoFocus></textarea>
      <div class="st-dialog-acts"><button class="btn sm" disabled=${!why.trim()} onClick=${() => onDone(why.trim())}>Record</button><button class="btn sm ghost" onClick=${() => onDone(null)}>Cancel</button></div>
    </div></div>`;
  }

  /* ------------------------------------------------------------ the app */
  function StudioApp() {
    const CLIENTS = clientList();
    const [clientId, setClientId] = useState(CLIENTS[0] ? CLIENTS[0].id : 'mca');
    const [lib, setLib] = useState(null); const [libErr, setLibErr] = useState('');
    const [kit, setKit] = useState(null);
    const [pid, setPid] = useState(null); const [p, setP] = useState(null);
    const [intake, setIntake] = useState(false);
    const [view, setView] = useState('brief');
    const [selAsset, setSelAsset] = useState(null); const [selField, setSelField] = useState(null);
    const [target, setTarget] = useState('asset');
    const [busy, setBusy] = useState('');
    const [cmp, setCmp] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [exportState, setExportState] = useState(null);
    const stepping = useRef(new Set()); const pidRef = useRef(null); pidRef.current = pid;
    const client = CLIENTS.find(c => c.id === clientId) || CLIENTS[0] || FALLBACK_CLIENTS[0];
    const a = p ? p.assets.find(x => x.id === selAsset) || null : null;

    const loadLib = useCallback(async () => {
      setLib(null); setLibErr('');
      try { const [l, s, k] = await Promise.all([call('/studio/list?ns=' + encodeURIComponent(clientId)), call('/studio/status').catch(() => null), call('/brand/kit?ns=' + encodeURIComponent(clientId)).catch(() => null)]); setLib(Object.assign({}, l, { status: s })); setKit(k && k.kit ? k.kit : {}); }
      catch (e) { setLibErr(e.code || e.message); }
    }, [clientId]);
    useEffect(() => { loadLib(); }, [loadLib]);
    const reload = useCallback(async (id) => {
      const want = id || pidRef.current; if (!want) return null;
      try { const d = await call('/studio/get?id=' + encodeURIComponent(want)); if (pidRef.current === want) setP(d); return d; } catch (e) { toastMsg(e.message, true); return null; }
    }, []);
    const fail = e => { toastMsg(e.message, true); setBusy(''); };

    /* a job: step it until it ends; a lease held elsewhere is waited out; the project is reloaded as it moves */
    const runJob = useCallback(async (id, label) => {
      if (stepping.current.has(id)) return null; stepping.current.add(id);
      try {
        for (let i = 0; i < 60; i++) {
          if (label) setBusy(label + ' (job ' + id + '; you can close the tab, the tick finishes it)');
          let j;
          try { j = (await call('/studio/job/step', { id })).job; } catch (e) { toastMsg(e.message, true); break; }
          await reload();
          if (j.state === 'done' || j.state === 'failed' || j.state === 'cancelled') { if (j.state === 'failed') toastMsg('Job ' + j.stage + ' failed: ' + j.error, true); return j; }
          await sleep(j.note && /another runner/.test(j.note) ? 3000 : 600);
        }
      } finally { stepping.current.delete(id); setBusy(''); }
      return null;
    }, [reload]);
    /* anything queued (renders the copy stage enqueued) is run in turn while the tab is open */
    const pump = useCallback(async (d) => {
      const jobs = ((d || p || {}).jobs || []).filter(j => j.state === 'queued' && !stepping.current.has(j.id)).sort((x, y) => x.created - y.created);
      for (const j of jobs) { if (pidRef.current !== j.project) return; await runJob(j.id, (j.stage === 'render' ? 'Rendering the background at ' + ((j.input || {}).size || '2K') : 'Running ' + j.stage) + ((d || p || {}).assets || []).filter(x => x.id === j.asset).map(x => ' for ' + x.title).join('')); }
    }, [p, runJob]);
    const openProject = async (id) => {
      setPid(id); pidRef.current = id; setCmp(null); setIntake(false); setP(null);
      const d = await reload(id); if (!d) { setPid(null); return; }
      setSelAsset(d.assets[0] ? d.assets[0].id : null); setView(d.assets.length ? 'asset' : d.directions.length ? 'directions' : 'brief');
      if (!d.readOnly) pump(d);
    };
    const closeProject = () => { setPid(null); pidRef.current = null; setP(null); setCmp(null); loadLib(); };
    const switchClient = id => { setClientId(id); closeProject(); setIntake(false); setSelAsset(null); setSelField(null); };

    const job = async (stage, input, asset, idem, label) => { const r = await call('/studio/job', { project: pidRef.current, asset: asset || undefined, stage, input, idem }); return runJob(r.job.id, label); };
    const produce = async (extra) => { const d = p || await reload(); const b = d.brief || {}; const channels = (b.channels || []).filter(c => CHANNELS[c]); if (!channels.length) { toastMsg('Choose channels in the brief first', true); return; } const j = await job('copy', { channels, deliverable: b.deliverable || 'set', formats: b.formats || {}, template: b.template || '', instruction: (extra && extra.instruction) || '' }, null, 'copy:' + pidRef.current + ':' + Date.now(), 'Writing ' + channels.length + ' piece' + (channels.length === 1 ? '' : 's') + ' in the ' + (d.ns || '').toUpperCase() + ' voice' + ((b.deliverable || 'set') === 'copy' ? ', copy only' : ', then laying out compositions')); const d2 = await reload(); if (d2 && d2.assets.length) { setSelAsset(d2.assets[d2.assets.length - 1].id); setView('asset'); } if (j && j.state === 'done') pump(d2); };
    const direct = async () => { await job('direct', { n: 2, channels: ((p && p.brief) || {}).channels || [] }, null, 'direct:' + pidRef.current + ':' + Date.now(), 'Proposing two directions from the brief and the ledger'); setView('directions'); };
    const createProject = async (o) => {
      try {
        setBusy('Creating the project'); setIntake(false);
        const formats = {}; o.channels.forEach(c => { formats[c] = (CHANNELS[c] || {}).format || '1:1'; }); if (o.deliverable === 'visual') formats.instagram = '4:5';
        const brief = { objective: o.start === 'brief' ? o.text : o.start === 'reference' ? 'Adapt the reference: ' + o.text : '', audience: '', message: '', deliverables: (o.deliverable === 'copy' ? 'Copy only for ' : o.deliverable === 'visual' ? 'Visual creative for ' : 'Coordinated set for ') + o.channels.map(chanLabel).join(', '), channels: o.channels, deliverable: o.deliverable, formats, assumptions: ['Organic, not paid (assumed; edit if wrong)'].concat(o.campaign ? [] : ['No campaign chosen: campaign identity and campaign facts will not apply']) };
        const pr = await call('/studio/project', { ns: client.id, campaign: o.campaign, title: (o.start === 'release' ? (o.text.split('\n').map(s => s.trim()).filter(s => s && !/^media release/i.test(s))[0] || 'Release') : o.text).slice(0, 80), brief, idem: 'p:' + client.id + ':' + Date.now() });
        setPid(pr.id); pidRef.current = pr.id; setView('brief');
        if (o.start === 'release') { const s = await call('/studio/source', { project: pr.id, kind: 'release', name: 'Pasted release', text: o.text }); await reload(pr.id); await job('extract', { source: s.id }, null, 'extract:' + s.id, 'Reading the source: claims, figures and quotations with their passages'); }
        if (o.start === 'reference' && o.file) { await call('/studio/reference', { project: pr.id, kind: 'image', name: o.file.name, purpose: 'composition', imageB64: o.file.b64, mime: o.file.mime, note: 'from intake' }); }
        await reload(pr.id);
        if (o.clear) await produce({ instruction: o.start === 'release' ? o.instruction : o.text }); else await direct();
      } catch (e) { fail(e); } finally { setBusy(''); }
    };
    const saveBrief = async (b) => { try { await call('/studio/project/update', { id: p.id, revision: p.revision, patch: { brief: b } }); await reload(); } catch (e) { fail(e); if (e.status === 409) reload(); } };
    const addSource = async (name, text) => { try { const s = await call('/studio/source', { project: p.id, kind: 'text', name, text }); await reload(); await job('extract', { source: s.id }, null, 'extract:' + s.id, 'Reading ' + name); } catch (e) { fail(e); } };
    const addReference = async (r) => { try { await call('/studio/reference', Object.assign({ project: p.id, kind: 'image' }, r)); await reload(); toastMsg('Reference added'); } catch (e) { fail(e); } };
    const chooseDirection = async (did) => { try { await call('/studio/direction/choose', { id: did }); await reload(); await produce({}); } catch (e) { fail(e); } };
    const editAsset = async (as, patch) => { try { const cur = p.assets.find(x => x.id === as.id) || as; const changed = {}; Object.keys(patch).forEach(k => { if ((current(cur).copy || {})[k] !== patch[k]) changed[k] = patch[k]; }); if (!Object.keys(changed).length) return; await call('/studio/version', { asset: as.id, revision: cur.revision, copy: changed, note: 'hand edit: ' + Object.keys(changed).join(', ') }); await reload(); } catch (e) { fail(e); if (e.status === 409 || e.code === 'locked') reload(); } };
    const editLayout = async (as, delta) => { try { const cur = current(as); const layout = JSON.parse(JSON.stringify(cur.layout)); const hl = layout.layers.find(l => l.role === 'headline'); hl.size = Math.max(2.4, Math.round((hl.size + delta) * 10) / 10); hl.h = Math.round(hl.h * (hl.size / (hl.size - delta)) * 10) / 10; await call('/studio/version', { asset: as.id, revision: as.revision, layout, kind: 'layout', note: 'headline ' + (delta > 0 ? 'larger' : 'smaller') + ' (' + hl.size + '%)' }); await reload(); } catch (e) { fail(e); } };
    const toggleLock = async (as, k, locked) => { try { await call('/studio/lock', { asset: as.id, element: k, locked }); await reload(); } catch (e) { fail(e); } };
    const approve = (as, part, what) => { if (what === 'withdraw') { call('/studio/approve', { asset: as.id, part, decision: 'withdraw' }).then(() => reload()).catch(fail); return; } setDialog({ kind: 'reason', part, what, asset: as.id }); };
    const recordDecision = async (why) => { const d = dialog; setDialog(null); if (!why) return; try { await call('/studio/approve', { asset: d.asset, part: d.part, decision: d.what, reason: why }); await reload(); } catch (e) { fail(e); } };
    const restore = async (as, vid) => { try { await call('/studio/version', { asset: as.id, revision: as.revision, restoreFrom: vid }); await reload(); setCmp(null); } catch (e) { fail(e); } };
    const render = async (as, prompt) => { try { const v = current(as); await job('render', { prompt: prompt || (v.context || {}).visual || 'documentary background, no text', aspect: as.format, size: (v.image && v.image.size) || '2K', note: 'background as directed' }, as.id, 'render:' + as.id + ':' + v.id + ':' + Date.now(), 'Rendering a new background for ' + as.title); } catch (e) { fail(e); } };
    const note = async (text, tgt) => { try { await call('/studio/note', { project: p.id, text, target: tgt }); await reload(); } catch (e) { fail(e); } };
    const retryJob = async (j) => { try { await job(j.stage, j.input, j.asset || null, (j.idem || j.id) + ':retry:' + Date.now(), 'Retrying ' + j.stage); } catch (e) { fail(e); } };
    const cancelJob = async (id) => { try { await call('/studio/job/cancel', { id }); await reload(); } catch (e) { fail(e); } };
    const importLegacy = async (l) => { try { setBusy('Importing ' + l.title); const r = await call('/studio/import', { legacy: l.id }); toastMsg(r.existing ? 'Already imported: opening that project' : 'Imported; the original is untouched'); await openProject(r.id); } catch (e) { fail(e); } finally { setBusy(''); } };

    /* export: the renderer draws each approved composition at native size; a full key saves the PNGs and runs the export stage; the bundle downloads */
    const doExport = async (ready) => {
      setExportState({ busy: true, msg: 'Drawing ' + ready.length + ' composition' + (ready.length === 1 ? '' : 's') + ' at native size...' });
      try {
        const files = []; const sheet = [];
        for (const x of ready) {
          const v = x.v; const safe = (x.a.title + '-v' + vnum(x.a, v)).replace(/[^a-z0-9-]+/gi, '_');
          if (v.layout && v.layout.layers) {
            const [bg, logo] = await Promise.all([keyedImage(v.image && v.image.url), keyedImage('/brand/logo?ns=' + encodeURIComponent(p.ns))]);
            const blob = await R.toBlob(v.layout, v.copy, { bg, logo }); const u8 = new Uint8Array(await blob.arrayBuffer());
            files.push({ name: safe + '.png', data: u8 });
            if (canWrite() && !p.readOnly) { const b64 = btoa(Array.from(u8).map(c => String.fromCharCode(c)).join('')); await call('/studio/render/save', { asset: x.a.id, version: v.id, imageB64: b64, mime: 'image/png' }); }
          } else if (v.image && v.image.url) { try { const r = await fetch((typeof csBase === 'function' ? csBase() : '') + v.image.url, { headers: typeof axHeaders === 'function' ? axHeaders() : {} }); files.push({ name: safe + '.png', data: new Uint8Array(await r.arrayBuffer()) }); } catch (e) {} }
          sheet.push('== ' + x.a.title + ' (' + x.a.channel + ' ' + x.a.format + ') - version ' + v.id + ' ==', ...['headline', 'support', 'cta', 'caption', 'alt'].filter(k => v.copy[k]).map(k => k.toUpperCase() + ': ' + v.copy[k]), 'CHECKS: ' + ((v.checks || []).map(c => c.state + ' ' + c.text).join('; ') || 'none'), 'APPROVALS: ' + Object.keys(x.a.approvals || {}).map(k => k + ' by ' + x.a.approvals[k].by + ' - ' + x.a.approvals[k].reason).join('; '), '');
        }
        let manifest = null;
        if (canWrite() && !p.readOnly) { setExportState({ busy: true, msg: 'Recording the export on the project...' }); const j = await job('export', { assets: ready.map(x => x.a.id) }, null, 'export:' + p.id + ':' + Date.now(), 'Recording the export'); manifest = j && j.result ? j.result : null; if (manifest && manifest.sheet) sheet.unshift(manifest.sheet.split('\n')[0], ''); }
        files.push({ name: 'copy-sheet.txt', data: (manifest && manifest.sheet && manifest.sheet.length < 4000 ? manifest.sheet : 'COPY SHEET - ' + p.title + '\n\n' + sheet.join('\n')) });
        files.push({ name: 'manifest.json', data: JSON.stringify({ project: p.id, ns: p.ns, title: p.title, campaign: p.campaign, at: new Date().toISOString(), assets: ready.map(x => ({ asset: x.a.id, title: x.a.title, channel: x.a.channel, format: x.a.format, version: x.v.id, copy: x.v.copy, layout: x.v.layout, image: x.v.image, checks: x.v.checks, approvals: x.a.approvals, context: x.v.context })), export: manifest ? { id: manifest.export, files: manifest.files, excluded: manifest.excluded } : { note: 'downloaded by a read-only key; not recorded on the project' }, note: 'Approved versions only. This export created no task and sent nothing anywhere.' }, null, 2) });
        const blob = R.zip(files); const url = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = url; el.download = 'studio-' + p.ns + '-' + p.id + '.zip'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
        setExportState({ busy: false, msg: 'Bundle downloaded: ' + files.length + ' files' + (manifest ? '; recorded as export ' + manifest.export + ' on the project.' : '.') }); window.__studioLastExport = { files: files.map(f => f.name), manifest };
      } catch (e) { setExportState({ busy: false, msg: 'Export stopped: ' + e.message }); }
    };

    const stage = !p ? '' : !p.assets.length && p.directions.length && !p.directions.some(d => d.chosen) ? 'directions' : !p.assets.length ? 'brief' : p.assets.every(x => standing(x, 'copy') && (standing(x, 'design') || (current(x) || {}).mode === 'copy')) ? 'export' : p.assets.some(x => standing(x, 'copy') || standing(x, 'design')) ? 'review' : 'production';
    const header = html`<div class="st-head">
      <div class="st-head-l"><span class="ov-title">Creative Studio</span>
        <select class="st-sel" value=${clientId} onChange=${e => switchClient(e.target.value)} aria-label="Client">${CLIENTS.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        ${p ? html`<button class="ov-link" onClick=${closeProject}>projects</button><span class="st-sep">/</span><b>${p.title}</b><span class="ov-dim">${p.campaign || 'no campaign'}</span>${p.readOnly ? html`<${Chip}>legacy, read-only</${Chip}>` : null}` : html`<span class="ov-dim">project library</span>`}
      </div>
      <div class="st-head-r">${p ? html`<span class="ov-dim">saved ${ago(p.updated)} ago${p.legacy ? ', imported from ' + p.legacy.id : ''}</span><span class=${'st-status ' + stage}>${stage}</span><button class="ov-link" onClick=${() => { setCmp(null); setView('context'); }} title="What the Studio knows about this client">client context</button>${p.assets.length ? html`<button class="btn sm ghost" onClick=${() => { setExportState(null); setDialog({ kind: 'export' }); }}>Export</button>` : null}` : null}${lib && lib.status ? html`<${Chip} title="Worker build">${lib.status.build}</${Chip}>` : null}</div>
    </div>`;
    const stepper = p ? html`<div class="st-steps" aria-label="Stages">${['brief', 'directions', 'production', 'review', 'export'].map((s, i, arr) => { const idx = arr.indexOf(stage); const skipped = s === 'directions' && !p.directions.length && p.assets.length; return html`<button key=${s} class=${'st-step' + (s === stage ? ' on' : i < idx ? ' done' : '') + (skipped ? ' skipped' : '')} onClick=${() => { setCmp(null); setView(s === 'directions' ? 'directions' : s === 'brief' ? 'brief' : 'asset'); }} title=${skipped ? 'Skipped: a clear instruction needs no direction step' : ''}>${s}</button>`; })}</div>` : null;

    let centre;
    if (!pid) centre = intake ? html`<${Intake} client=${client} kit=${kit} onCreate=${createProject} onCancel=${() => setIntake(false)} />` : html`<${Library} client=${client} data=${lib} err=${libErr} onOpen=${openProject} onNew=${() => setIntake(true)} onImport=${importLegacy} />`;
    else if (!p) centre = html`<div class="st-centre-pad"><div class="ov-empty">${busy || 'Opening the project...'}</div></div>`;
    else if (cmp && a) centre = html`<${CompareView} a=${a} ns=${p.ns} vA=${a.versions.find(v => v.id === cmp.a)} vB=${a.versions.find(v => v.id === cmp.b)} onClose=${() => setCmp(null)} onRestore=${vid => restore(a, vid)} />`;
    else if (view === 'brief') centre = html`<${BriefView} p=${p} onSave=${saveBrief} onDirect=${direct} onProduce=${() => produce({})} busy=${busy} />`;
    else if (view === 'sources') centre = html`<${SourcesView} p=${p} onAdd=${addSource} busy=${busy} />`;
    else if (view === 'references') centre = html`<${ReferencesView} p=${p} onAdd=${addReference} busy=${busy} />`;
    else if (view === 'directions') centre = html`<${DirectionsView} p=${p} onChoose=${chooseDirection} onMore=${direct} busy=${busy} />`;
    else if (view === 'context') centre = html`<${ContextView} p=${p} />`;
    else if (view === 'jobs') centre = html`<${JobsView} p=${p} onRetry=${retryJob} onCancel=${cancelJob} onStep=${j => runJob(j.id, 'Running ' + j.stage)} budget=${lib && lib.status ? lib.status.budget : null} />`;
    else if (a) centre = html`<${AssetView} p=${p} a=${a} sel=${selField} setSel=${setSelField} onEdit=${editAsset} onLayout=${editLayout} onLock=${toggleLock} onApprove=${approve} onCompare=${(x, y) => setCmp({ a: x, b: y })} onRestore=${restore} onRender=${render} busy=${busy} />`;
    else centre = html`<div class="st-centre-pad"><div class="ov-empty">${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction to start production.' : 'Confirm the brief on the left; production starts from it.'}</div></div>`;

    return html`<div class="st">
      ${header}${stepper}
      <div class=${'st-body' + (p ? '' : ' lib')}>
        ${p ? html`<${Rail} p=${p} view=${cmp ? 'compare' : view} setView=${v => { setCmp(null); setView(v); }} sel=${selAsset} setSel=${id => { setSelAsset(id); setSelField(null); setCmp(null); }} />` : null}
        <main class="st-centre">${centre}</main>
        ${p ? html`<${Partner} p=${p} a=${a} target=${target} setTarget=${setTarget} onNote=${note} busy=${busy} />` : null}
      </div>
      ${dialog && dialog.kind === 'export' && p ? html`<${ExportDialog} p=${p} client=${client} onClose=${() => setDialog(null)} onClickup=${ready => setDialog({ kind: 'clickup', ready })} onExport=${doExport} state=${exportState} />` : null}
      ${dialog && dialog.kind === 'clickup' && p ? html`<${ClickupDialog} ready=${dialog.ready} client=${client} p=${p} onClose=${() => setDialog(null)} />` : null}
      ${dialog && dialog.kind === 'reason' ? html`<${ReasonDialog} title=${(dialog.what === 'approve' ? 'Approve ' : 'Reject ') + dialog.part} prompt=${'On ' + (a || {}).title + ', the current version. Approval is recorded as client acceptance of this exact version, never as performance.'} onDone=${recordDecision} />` : null}
    </div>`;
  }

  let mounted = false;
  window.studioInit = function () {
    const root = document.getElementById('studio-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${StudioApp} />`); }
  };
})();
