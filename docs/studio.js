/* AXIOM Creative Studio - the workspace (Phases 2-3: production and direction on the worker).
 *
 * One client-aware workspace for copy, creative and campaign production. Everything
 * on screen comes from /studio/* in the worker: projects, sources and their claim
 * ledger, directions, assets with immutable versions, approvals, jobs. Every model
 * call is a job the browser steps and the cron finishes if the tab closes; every
 * composition is drawn by the one renderer (studio-render.js) for preview and
 * export alike, so a headline edit changes both without an image model. The
 * creative partner takes a direction on an asset, a family or the set: a text
 * or layout change lands as versions with no render, alternatives are offered
 * beside the field, a new image is proposed with its steps and run only when
 * confirmed, an adaptation makes new assets that reuse the image, and a
 * standing preference is offered - campaign, client or no - never saved alone. */
(function () {
  'use strict';
  if (!window.AXUI || !window.STRender) {
    window.studioInit = function () {
      const root = document.getElementById('studio-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The Studio runtime did not load.</b> The files under <code>docs/vendor/</code> or <code>docs/studio-render.js</code> are missing from this deployment.</div>';
    };
    return;
  }
  const { html, call, blobUrl, toastMsg, ago, useGoto } = window.AXUI;
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
  /* the current version is the one the worker names, always sent with the asset however old it is; if it is not there
     the asset has no current version to show (null), never an older version presented as current */
  const current = a => (a && a.versions ? a.versions.find(v => v.id === a.current) || null : null);
  /* a version's number on its asset comes from the worker (insertion order), so a paged history numbers it right */
  const vnum = (a, v) => (a && v ? (v.n || (a.versions.findIndex(x => x.id === v.id) + 1)) : 0);
  const vtotal = a => (a ? a.versionsTotal || (a.versions || []).length : 0);
  const chanLabel = c => (CHANNELS[c] || { label: c || '-' }).label;
  const isClear = t => /^(adapt|write|make|produce|resize|shorten|draft|three|two|one|give me|turn|create)\b/i.test(String(t || '').trim());
  const FORMAT_RATIO = { '1:1': 1, '4:5': 0.8, '9:16': 0.5625, '16:9': 1.7778 };

  /* ------------------------------------------------------------ what went wrong, in words a producer can act on */
  /** An error from the worker or a failed job, explained: a title, what it means for the work, what to do. The raw
      message stays available as the diagnostic detail; nothing here pretends a failure was a success. */
  function explain(e, what) {
    const code = String((e && e.code) || ''); const msg = String((e && (e.message || e.error)) || e || '');
    const has = re => re.test(code) || re.test(msg); const status = e && e.status;
    const rid = String((e && e.requestId) || '');
    const out = (title, text, kind) => ({ title, text, kind: kind || 'error', detail: (msg && msg !== title ? msg : '') + (rid ? (msg && msg !== title ? ' ' : '') + '(request ' + rid + ')' : '') });
    const failedHere = () => out('Something failed on the worker', 'Nothing more was done and your work is as it was. Try again; if it fails again, quote ' + (rid ? 'request ' + rid : 'the time it happened') + ' when reporting it.');
    if (has(/internal_error/)) return failedHere();
    if (has(/claude_not_configured/)) return out('Claude is not configured on the worker', 'Nothing that writes, plans or inspects can run until an administrator sets ANTHROPIC_API_KEY on the worker. Nothing was spent and your work is unchanged.', 'provider');
    if (has(/gemini_not_configured|GEMINI_KEY/)) return out('Image generation is not configured on the worker', 'No image can be made until an administrator sets GEMINI_KEY. Compositions, copy and layout work without it; choose "No imagery" to produce a complete typographic set.', 'provider');
    if (has(/budget_exhausted/)) return out('Today\'s Studio budget is used up', 'The worker allows a set number of model calls a day (STUDIO_DAILY_CALLS). It resets at midnight Sydney time, or an administrator can raise it. Nothing more was spent.', 'provider');
    if (has(/account_limit|credit balance|spend limit|usage limit|billing/i)) return out('The provider account has hit its spend limit', 'The Anthropic or Google account behind the worker refused the call. An administrator needs to raise the limit; retrying will not help until then.', 'provider');
    if (has(/brief_incomplete/)) return out('The brief is missing something mandatory', msg.replace(/^brief_incomplete:\s*/, '').replace(/\s*\(not retried\)\s*$/, '') + ' Resolve it in the Brief, or tick "Proceed on the stated assumptions".', 'warn');
    if (has(/answer_truncated|unparseable/)) return out('The model\'s answer could not be read', 'Nothing was saved from it; your work is as it was. Retry: it is a new call and may be billed.');
    if (has(/refus/i)) return out('The model declined this request', 'Nothing was saved. Reword the instruction or brief and try again.');
    if (has(/gemini_5\d\d|gemini_429|overloaded|\b529\b|\b503\b|rate[ _-]?limit|too many requests|\b429\b|TimeoutError|AbortError|timed out|timeout/i)) return out('The provider is busy or timed out', 'Your work is kept. Retry when ready; a retry is a new attempt and may be billed.', 'provider');
    if (has(/brief_too_large|input_too_large|data_too_large|layout_too_large|content_too_large/)) return out('That is too long to save', msg.replace(/^[a-z_]+:\s*/, '') + ' Nothing was saved and your text is still where you typed it; put long material in a Source instead.');
    if (has(/input_corrupt/)) return out('This job\'s stored instruction is damaged', 'It was not run with an empty instruction. Start the step again from here; the damaged job stays in Jobs as history.');
    if (status === 409 && /version_moved/.test(code)) return out('A newer version arrived while you decided', 'Nothing was recorded. Look at the current version and decide again.', 'warn');
    if (status === 409 && /job_ended/.test(code)) return out('That job had already ended', 'It finished or was cancelled first; nothing more was filed.', 'warn');
    if (has(/auth_not_configured/)) return out('The worker has no access keys set', 'An administrator must set AXIOM_KEYS (or AXIOM_ACCESS_KEY) on the worker before anything can be read or changed.');
    if (has(/auth_misconfigured/)) return out('The worker\'s key list is invalid', 'An administrator must fix AXIOM_KEYS on the worker (every key needs the role "read" or "full"). Nothing was changed.');
    if (status === 409 && /conflict/.test(code)) return out('This changed elsewhere since you read it', 'Someone, or a job, saved a newer version first. Nothing was overwritten; the latest version is now shown.', 'warn');
    if (status === 409 && /locked/.test(code)) return out('That element is locked', 'Unlock it first (the lock beside the field), then make the change.', 'warn');
    if (status === 409 && /stale/.test(code)) return out('That suggestion was made for an earlier version', 'The asset has moved on since. Ask again on the current version.', 'warn');
    if (status === 401) return out('The access key was not accepted', 'Set a valid key in Settings, Access key. Nothing was changed.');
    if (status === 403) return out('This key can read but not change', 'A full-access key is needed to make changes. Nothing was changed.');
    if (has(/Failed to fetch|NetworkError|network|Load failed/i)) return out('Cannot reach the worker', 'Check the connection. Nothing you typed was lost; try again when the connection is back.');
    if (status >= 500 && status < 600 && !msg) return failedHere();
    return out(what || 'That did not work', msg);
  }
  const RUN_NOTE = 'Cancelling stops queued work and anything not yet sent; a provider call already in flight may still finish and be billed.';

  /* ------------------------------------------------------------ where the team left off: this browser only, never shared */
  const STORE = 'ax_studio_v1';
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; } },
    set(patch) { try { localStorage.setItem(STORE, JSON.stringify(Object.assign(store.get(), patch))); } catch (e) {} },
    place(ns) { return (store.get().byClient || {})[ns] || null; },
    setPlace(ns, place) { const s = store.get(); const by = Object.assign({}, s.byClient || {}); if (place) by[ns] = place; else delete by[ns]; store.set({ byClient: by }); },
    draft(pid) { try { return JSON.parse(localStorage.getItem('ax_studio_brief_' + pid) || 'null'); } catch (e) { return null; } },
    setDraft(pid, d) { try { if (d) localStorage.setItem('ax_studio_brief_' + pid, JSON.stringify(d)); else localStorage.removeItem('ax_studio_brief_' + pid); } catch (e) {} },
  };

  /* ------------------------------------------------------------ the workflow: six stages, each with its views, its state worked out from the project */
  const STAGES = [
    { id: 'brief', label: 'Brief', views: ['brief', 'sources', 'references'], purpose: 'Say what the work must do, for whom, on which channels, and what it may claim.' },
    { id: 'directions', label: 'Directions', views: ['directions'], purpose: 'Compare different ideas for the brief and choose the one production follows.' },
    { id: 'produce', label: 'Produce', views: ['board', 'sequence', 'production', 'jobs'], purpose: 'Make the set from the chosen direction or the brief: copy per channel, laid out as editable compositions.' },
    { id: 'refine', label: 'Refine', views: ['asset', 'copy'], purpose: 'Edit the words, the layout and the imagery of each asset until it passes validation.' },
    { id: 'review', label: 'Review', views: ['review'], purpose: 'Approve copy and design for each exact version, then share it with the client.' },
    { id: 'export', label: 'Export', views: ['export'], purpose: 'Download exactly the approved, validated versions at their native size.' },
  ];
  const stageOfView = v => (STAGES.find(s => s.views.indexOf(v) >= 0) || { id: '' }).id;
  const validOf = a => { const v = current(a); return !!v && (v.mode === 'copy' || v.mode === 'generated' || (a.readiness || {}).technical === 'passed'); };
  const approvedOf = a => !!(standing(a, 'copy') && (standing(a, 'design') || (current(a) || {}).mode === 'copy'));
  /** Where the project stands, stage by stage: done, current, to do, running, skipped or blocked (with the reason). */
  function flowOf(p) {
    const A = p.assets || [], n = A.length, b = p.brief || {}, jobs = p.jobs || [];
    const live = j => j.state === 'queued' || j.state === 'running';
    const chosen = p.directions.find(d => d.chosen);
    const rendersLive = jobs.filter(j => (j.stage === 'render' || j.stage === 'inspect') && live(j)).length;
    const producing = jobs.some(j => (j.stage === 'copy' || j.stage === 'sequence') && live(j));
    const valid = A.filter(validOf).length, approved = A.filter(approvedOf).length, ready = A.filter(a => approvedOf(a) && validOf(a)).length;
    const channels = (b.channels || []).length;
    const exported = p.thread.some(e => e.kind === 'export');
    return {
      counts: { n, valid, approved, ready, rendersLive },
      brief: { state: n || p.directions.length || (b.objective && b.message) ? 'done' : 'current', note: channels ? channels + ' channel' + (channels === 1 ? '' : 's') : 'no channels yet' },
      directions: { state: chosen ? 'done' : n && !p.directions.length ? 'skipped' : p.directions.length ? 'current' : 'todo', note: chosen ? chosen.title : n && !p.directions.length ? 'not needed' : p.directions.length ? p.directions.length + ' to choose from' : 'optional' },
      produce: { state: producing ? 'running' : !n ? (channels ? 'todo' : 'blocked') : rendersLive ? 'running' : 'done', blocked: 'Choose at least one channel in the brief first.', note: producing ? 'writing' : n ? n + ' asset' + (n === 1 ? '' : 's') + (rendersLive ? ', ' + rendersLive + ' job' + (rendersLive === 1 ? '' : 's') + ' running' : '') : '' },
      refine: { state: !n ? 'blocked' : valid === n ? 'done' : 'todo', blocked: 'Nothing has been produced yet.', note: n ? valid + ' of ' + n + ' validated' : '' },
      review: { state: !n ? 'blocked' : approved === n ? 'done' : approved || A.some(a => standing(a, 'copy') || standing(a, 'design')) ? 'current' : 'todo', blocked: 'Nothing has been produced yet.', note: n ? approved + ' of ' + n + ' approved' : '' },
      export: { state: exported && ready ? 'done' : ready ? 'todo' : 'blocked', blocked: n ? 'No asset has both approvals and a passing validation yet.' : 'Nothing has been produced yet.', note: ready ? ready + ' ready' : '' },
    };
  }

  /* ------------------------------------------------------------ images behind the key */
  /* images behind the key: cached by URL (mark URLs carry the file's version, so a replaced logo or wordmark is a new URL);
     a failed load is remembered as a failure, shown, and tried again later - never cached as an image that is not there */
  const imgCache = new Map(); const imgFailed = new Map();
  async function keyedImage(url) {
    if (!url) return null;
    if (imgCache.has(url)) return imgCache.get(url);
    const pr = (async () => { try { const b = await blobUrl(url); const im = await R.loadImage(b); imgFailed.delete(url); return im; } catch (e) { imgFailed.set(url, String((e && e.message) || e).slice(0, 120)); imgCache.delete(url); return null; } })();
    imgCache.set(url, pr); return pr;
  }
  async function loadImages(v, ns) {
    const layout = (v && v.layout) || {}; const want = (Array.isArray(layout.layers) ? layout.layers : []).filter(l => l.type === 'img' && l.src);
    const [bg, logo, ...rest] = await Promise.all([keyedImage(v && v.image && v.image.url), keyedImage(ns ? '/brand/logo?ns=' + encodeURIComponent(ns) : '')].concat(want.map(l => keyedImage(l.src))));
    const out = { bg, logo }; want.forEach((l, i) => { if (rest[i]) out[l.id] = rest[i]; });
    const failed = [v && v.image && v.image.url].concat(want.map(l => l.src)).filter(u => u && imgFailed.has(u));
    return Object.defineProperty(out, '_failed', { value: failed, enumerable: false });
  }
  /* everything a composition needs before it is drawn for real: every image layer (keyed by layer id) and the fonts its words use.
     The canvas is drawn at once (a draft) and again when the fonts or any image arrive; `ready` says measurement may begin. */
  function useComposition(v, ns, layoutOverride, copy, nonce) {
    const layout = layoutOverride || (v && v.layout) || {};
    const bgUrl = v && v.image && v.image.url;
    const srcs = (Array.isArray(layout.layers) ? layout.layers : []).filter(l => l.type === 'img' && l.src).map(l => l.id + '=' + l.src).join('|');
    const words = JSON.stringify((Array.isArray(layout.layers) ? layout.layers : []).filter(l => l.type === 'text').map(l => [l.font, l.weight])) + JSON.stringify(layout.fonts || {});
    const [st, setSt] = useState({ imgs: { bg: null, logo: null }, fonts: null, failed: [], ready: false, key: '' });
    useEffect(() => {
      let live = true; setSt(s => Object.assign({}, s, { ready: false }));
      (async () => {
        const imgs = await loadImages(Object.assign({}, v || {}, { layout }), ns);
        const fonts = layout.layers ? await R.ensureFonts(layout, copy || (v && v.copy) || {}, { timeout: 4000 }) : null;
        if (live) setSt({ imgs, fonts, failed: imgs._failed || [], ready: true, key: (bgUrl || '') + '|' + srcs + '|' + words + '|' + Date.now() });
      })();
      // a face that finishes loading later still changes the measure: redraw and re-measure
      const onFonts = () => { if (live && layout.layers) R.ensureFonts(layout, copy || (v && v.copy) || {}, { timeout: 1500 }).then(fonts => { if (live) setSt(s => Object.assign({}, s, { fonts, key: s.key + '+f' })); }); };
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
      return () => { live = false; if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts); };
    }, [bgUrl, srcs, words, ns, nonce || 0]);
    return st;
  }
  function useImages(v, ns, layoutOverride) { return useComposition(v, ns, layoutOverride).imgs; }

  /* ------------------------------------------------------------ small parts */
  const Lbl = ({ children }) => html`<div class="st-lbl">${children}</div>`;
  const Chip = ({ kind, children, title }) => html`<span class=${'st-chip ' + (kind || '')} title=${title || ''}>${children}</span>`;
  const CHECK_KIND = { matches: 'ok', fact: 'ok', differs: 'bad', unsupported: 'warn', banned: 'bad', overflow: 'warn', over_limit: 'warn', too_many_hashtags: 'warn', exclamation: 'warn', small_type: 'warn', logo_size: 'warn', mark_missing: 'bad' };
  const CHECK_WORD = { matches: 'matches source', fact: 'approved fact', differs: 'differs from source', unsupported: 'not supported', banned: 'banned term', overflow: 'overflow', over_limit: 'over the limit', too_many_hashtags: 'hashtags', exclamation: 'exclamation', small_type: 'small type', logo_size: 'logo size', mark_missing: 'mark missing' };
  /** The composition: the one renderer at preview size. A copy-only version is a text card; a flattened legacy tile is its image. */
  function Composition({ v, a, ns, size, copy }) {
    const layout = v && v.layout && v.layout.layers ? v.layout : null; const c = copy || (v && v.copy) || {};
    const ref = useRef(null); const comp = useComposition(v, ns, layout, c); const imgs = comp.imgs;
    useEffect(() => {
      const el = ref.current; if (!el) return;
      if (layout) { const w = size === 'mini' ? 96 : size === 'thumb' ? 192 : size === 'card' ? 480 : Math.min(1080, Math.max(320, Math.round((el.parentElement ? el.parentElement.clientWidth : 520) * 2))); R.render(layout, c, imgs, w, el); }
      else if (imgs.bg) { el.width = imgs.bg.naturalWidth; el.height = imgs.bg.naturalHeight; el.getContext('2d').drawImage(imgs.bg, 0, 0); }
    }, [layout, JSON.stringify(c), comp.key, size]);
    if (!layout && !(v && v.image) && size === 'mini') return html`<div class="st-copycard thumb mini" aria-hidden="true"></div>`;
    if (!layout && !(v && v.image)) return html`<div class=${'st-copycard' + (size === 'thumb' ? ' thumb' : '')}><div class="st-copycard-h">${c.headline || c.title || '(no headline)'}</div>${size !== 'thumb' && size !== 'mini' ? html`<div class="st-copycard-b">${c.caption || c.body || ''}</div>` : null}<div class="st-comp-tag">copy only</div></div>`;
    return html`<div class=${'st-comp' + (size === 'thumb' || size === 'mini' ? ' thumb' : '') + (size === 'mini' ? ' mini' : '')} role="img" aria-label=${c.alt || c.headline || ''}>
      <canvas class="st-canvas" ref=${ref}></canvas>
      ${size !== 'thumb' && size !== 'card' && size !== 'mini' ? html`<div class="st-comp-tag">${v.mode === 'artwork' ? 'full artwork, words in the bitmap' + (layout && layout.layers.some(l => l.role === 'logo' || l.role === 'wordmark') ? ', mark live' : '') : layout ? (layout.v === 5 ? (v.image || (layout.regions || []).every(r => /keep the current/i.test(r.prompt || '')) ? 'editable composition, ' : 'sketch (imagery not generated yet), ') + (layout.mediumName || 'plan') : 'editable composition, ' + (layout.templateName || layout.template)) : v.mode === 'generated' ? 'generated artwork, text baked in' : 'image'}${v.image ? ' - ' + (v.image.model || '') + ' ' + (v.image.size || '') + (v.image.fallback ? ' (fallback from ' + (v.image.requested || 'the requested model') + ')' : '') + ((v.context || {}).size && v.image.size && v.context.size !== v.image.size ? ', asked ' + v.context.size : '') : layout ? ((v.context || {}).imagery === 'none' ? ' - no imagery, by choice' : ' - no imagery yet') : ''}${layout && (layout.incomplete || []).length ? ' - INCOMPLETE: mark not on file' : ''}${comp.failed.length ? ' - ' + comp.failed.length + ' image' + (comp.failed.length === 1 ? '' : 's') + ' failed to load' : ''}${comp.fonts && comp.fonts.fallback.length ? ' - fallback fonts' : ''}</div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ the frame: navigator, stage heading, notices */
  const FLOW_WORD = { done: 'done', current: 'in progress', todo: 'to do', running: 'running', skipped: 'skipped', blocked: 'blocked' };
  /** The workflow navigator: every stage reachable (a blocked one opens on its explanation), its state and a short note. */
  function Flow({ flow, at, onGo }) {
    const ref = useRef(null);
    useEffect(() => { const el = ref.current && ref.current.querySelector('.st-step.on'); if (el && el.scrollIntoView && ref.current.scrollWidth > ref.current.clientWidth) { try { el.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} } }, [at]);
    return html`<nav class="st-steps st-flow" aria-label="Workflow" ref=${ref}>${STAGES.map((s, i) => { const f = flow[s.id] || {}; const on = at === s.id;
      return html`<button key=${s.id} class=${'st-step ' + (f.state || '') + (on ? ' on' : '')} aria-current=${on ? 'step' : undefined} title=${f.state === 'blocked' ? 'Blocked: ' + f.blocked : f.state === 'skipped' ? 'Skipped: a clear instruction needs no direction step' : s.purpose} onClick=${() => onGo(s.id)}>
        <span class="st-step-n" aria-hidden="true">${f.state === 'done' ? '✓' : f.state === 'skipped' ? '–' : i + 1}</span><span class="st-step-l">${s.label}</span><span class="st-step-note">${f.state === 'blocked' ? 'blocked' : f.note || FLOW_WORD[f.state] || ''}</span><span class="st-vh">, ${FLOW_WORD[f.state] || ''}</span></button>`; })}</nav>`;
  }
  /** The head of every stage: what it is for, when it is done (or why it is blocked), its main action and the views inside it. */
  function StageHead({ id, title, purpose, flow, children, tabs, tab, onTab, focusRef, compact }) {
    const f = (flow && flow[id]) || {};
    if (compact) return html`<div class="st-stagehead compact"><div class="st-stagehead-row"><h2 class="st-stage-title" tabIndex="-1" ref=${focusRef} title=${purpose}>${title}</h2>
      ${tabs ? html`<div class="st-subnav" role="tablist" aria-label=${title + ' views'}>${tabs.map(([k, l, n]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${'st-railbtn st-subtab' + (tab === k ? ' on' : '')} onClick=${() => onTab(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`)}</div>` : null}
      <span class="st-stage-purpose st-purpose-inline">${purpose}</span><div class="st-stagehead-acts">${children}</div></div></div>`;
    return html`<div class="st-stagehead">
      <div class="st-stagehead-row"><div class="st-stagehead-main"><h2 class="st-stage-title" tabIndex="-1" ref=${focusRef}>${title}</h2><span class="st-stage-purpose">${purpose}</span></div>
        <div class="st-stagehead-acts">${children}</div></div>
      ${f.state === 'blocked' ? html`<div class="st-blocked" role="status"><${Chip} kind="warn">blocked</${Chip}> ${f.blocked}</div>` : null}
      ${tabs ? html`<div class="st-subnav" role="tablist" aria-label=${title + ' views'}>${tabs.map(([k, l, n]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${'st-railbtn st-subtab' + (tab === k ? ' on' : '')} onClick=${() => onTab(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`)}</div>` : null}
    </div>`;
  }
  /** One notice at a time under the navigator: an error explained, a conflict, a restored session. Its actions are real. */
  function Notice({ n, onClose }) {
    if (!n) return null;
    return html`<div class=${'st-notice ' + (n.kind || 'error')} role=${n.kind === 'info' ? 'status' : 'alert'}>
      <div class="st-notice-body"><b>${n.title}</b> <span>${n.text}</span>
        ${n.detail ? html`<details class="st-notice-detail"><summary>Details</summary><code>${n.detail}</code></details>` : null}</div>
      <div class="st-notice-acts">${(n.actions || []).map((x, i) => html`<button key=${i} class=${'btn sm' + (i ? ' ghost' : '')} onClick=${() => { onClose(); x.fn(); }}>${x.label}</button>`)}<button class="btn sm ghost" onClick=${onClose} aria-label="Dismiss this notice">Dismiss</button></div>
    </div>`;
  }

  /* ------------------------------------------------------------ library and intake */
  const NEXT_WORD = { brief: 'finish the brief', directions: 'choose a direction', production: 'refine and validate', review: 'approve and share', approved: 'export', exported: 'exported' };
  function Library({ client, data, onOpen, onNew, onStart, onImport, err, resume }) {
    if (err) return html`<div class="st-lib"><div class="st-empty-state"><b>The Studio backend did not answer.</b> <span>${err}</span> ${/not_found|404/.test(err) ? html`<span>The worker does not have the Studio routes yet: it needs redeploying.</span>` : html`<span>Check the connection and the worker address in Settings.</span>`}</div></div>`;
    if (!data) return html`<div class="st-lib" aria-busy="true"><div class="ov-empty">Loading projects for ${client.name}...</div></div>`;
    const mine = data.projects || [], legacy = data.legacy || [];
    const last = resume ? mine.find(p => p.id === resume.pid) : null;
    return html`<div class="st-lib">
      <div class="st-lib-head"><h2 class="st-stage-title">Projects for ${client.name}</h2><span class="ov-why">${mine.length} project${mine.length === 1 ? '' : 's'}${legacy.length ? ', ' + legacy.length + ' legacy item' + (legacy.length === 1 ? '' : 's') : ''}</span>${canWrite() ? html`<button class="btn sm" onClick=${onNew}>New project</button>` : null}</div>
      ${last ? html`<div class="st-resume" aria-label="Continue where you left off"><div><span class="st-lbl">Continue where you left off</span><div><b>${last.title}</b> <span class="ov-dim">${last.campaign || 'no campaign'}, ${last.assets} asset${last.assets === 1 ? '' : 's'}, last activity ${ago(last.updated)} ago; next: ${NEXT_WORD[last.status] || last.status}</span></div></div><button class="btn sm" onClick=${() => onOpen(last.id)}>Continue</button></div>` : null}
      ${!mine.length && !legacy.length ? html`<div class="st-empty-state st-first"><b>No projects yet for ${client.name}.</b><span>A project holds one piece of work from brief to export: its sources, directions, every version of every asset, the approvals and the exports. Start from what you have:</span>
        ${canWrite() ? html`<div class="st-first-acts">${[['release', 'A media release', 'paste it; claims and figures are read first'], ['brief', 'A brief or one line', 'a clear instruction goes straight to production'], ['reference', 'Existing creative', 'adapt or build on artwork you already have']].map(([k, l, t]) => html`<button key=${k} class="st-first-btn" onClick=${() => onStart(k)}><b>${l}</b><span>${t}</span></button>`)}</div>` : html`<span class="ov-dim">This key can read only; a full key is needed to start a project.</span>`}</div>` : null}
      ${mine.length || legacy.length ? html`<table class="ov-table"><thead><tr><th>Project</th><th>Campaign</th><th>Stage</th><th>Owner</th><th>Last activity</th><th></th></tr></thead><tbody>
        ${mine.map(p => html`<tr key=${p.id}><td><button class="st-lib-open" onClick=${() => onOpen(p.id)}>${p.title}</button><div class="ov-dim">${p.assets} asset${p.assets === 1 ? '' : 's'}, ${p.sources} source${p.sources === 1 ? '' : 's'}${p.legacy ? ', imported from ' + p.legacy.id : ''}</div></td><td>${p.campaign || '-'}</td><td><span class=${'st-status ' + p.status}>${p.status}</span><div class="ov-dim">next: ${NEXT_WORD[p.status] || '-'}</div></td><td>${p.owner}</td><td class="ov-dim">${ago(p.updated)} ago</td><td class="ov-go"><button class="ov-link" onClick=${() => onOpen(p.id)} aria-label=${'Open ' + p.title}>open</button></td></tr>`)}
        ${legacy.map(l => html`<tr key=${l.id} class="st-legacy"><td><b>${l.title}</b><div class="ov-dim">legacy ${l.kind === 'legacy_release' ? 'release pack' : 'content set'}, read-only; ${l.assets} ${l.kind === 'legacy_release' ? 'flattened tiles' : 'pieces'}${l.imported ? '; imported' : ''}</div></td><td>${l.campaign || '-'}</td><td><span class="st-status legacy">${l.status}</span></td><td>${l.owner || '-'}</td><td class="ov-dim">${ago(l.updated)} ago</td><td class="ov-go">${l.imported ? html`<button class="ov-link" onClick=${() => onOpen(l.imported)}>open import</button>` : html`<button class="ov-link" onClick=${() => onOpen(l.id)}>view</button>`}${canWrite() && !l.imported ? html` <button class="ov-link" onClick=${() => onImport(l)}>import to Studio</button>` : null}</td></tr>`)}
      </tbody></table>` : null}
      ${legacy.length ? html`<div class="ov-dim st-foot">Legacy items open read-only. Importing copies one into a Studio project under this client, keeps the original untouched, and is idempotent.</div>` : null}
      ${data.status ? html`<details class="st-diag"><summary>Diagnostics</summary><div class="ov-dim">Backend build <b>${data.status.build}</b>, ${data.status.projects} project${data.status.projects === 1 ? '' : 's'} across clients; model calls today ${data.status.budget ? data.status.budget.used + ' of ' + data.status.budget.cap : '-'}; ${data.status.keys.claude ? 'Claude' : 'no Claude key'}, ${data.status.keys.gemini ? 'Gemini' : 'no Gemini key'}.</div></details>` : null}
      <${MetricsPanel} client=${client} />
    </div>`;
  }
  /* Outcomes: counts over recorded rows against the client's previous window and the desks the Studio replaced. A figure
     the records cannot support is shown as "not recorded" or with its n, never as a zero or a guess. */
  const dur = ms => ms == null ? '-' : ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + ' min' : ms < 172800000 ? Math.round(ms / 360000) / 10 + ' h' : Math.round(ms / 8640000) / 10 + ' d';
  function MetricsPanel({ client }) {
    const [open, setOpen] = useState(false); const [days, setDays] = useState('30'); const [m, setM] = useState(null);
    useEffect(() => { if (!open) return; let live = true; setM(null); call('/studio/metrics?ns=' + encodeURIComponent(client.id) + '&days=' + days).then(d => { if (live) setM(d); }).catch(e => { if (live) setM({ error: e.message }); }); return () => { live = false; }; }, [open, days, client.id]);
    if (!open) return html`<div class="st-metrics"><button class="ov-link" onClick=${() => setOpen(true)}>Outcome metrics for ${client.name}</button></div>`;
    const st = x => !x ? '-' : x.n ? dur(x.median) + ' (n ' + x.n + ')' : html`<span class="ov-dim">none yet</span>`;
    const num = x => !x ? '-' : x.n ? x.median + ' (n ' + x.n + ', mean ' + x.mean + ')' : html`<span class="ov-dim">none yet</span>`;
    const cost = (w) => w.costPerApproved ? w.costPerApproved.calls + ' calls, ' + w.costPerApproved.images + ' images' : html`<span class="ov-dim">${w.costNote || 'none approved'}</span>`;
    const pct = (o, a, b) => o && o.share != null ? o.share + '% (' + o[a] + ' of ' + o[b] + ')' : html`<span class="ov-dim">none yet</span>`;
    const NR = html`<span class="ov-dim">not recorded</span>`;
    let body = null;
    if (!m) body = html`<div class="ov-dim">Counting...</div>`;
    else if (m.error) body = html`<div class="ov-dim">Metrics unavailable: ${m.error}</div>`;
    else { const c = m.current, e = m.baseline.earlier, L = m.baseline.legacy, D = m.definitions || {};
      const rows = [
        ['Work started', c.projects + ' project' + (c.projects === 1 ? '' : 's') + ', ' + c.assets + ' assets', e.projects + ' project' + (e.projects === 1 ? '' : 's') + ', ' + e.assets + ' assets', L.packs + ' pack' + (L.packs === 1 ? '' : 's') + ', ' + L.sets + ' set' + (L.sets === 1 ? '' : 's') + ', ' + L.pieces + ' pieces', ''],
        ['Time to first draft', st(c.timeToFirstDraft), st(e.timeToFirstDraft), NR, D.timeToFirstDraft],
        ['Time to a validated composition', st(c.timeToFirstValidated), st(e.timeToFirstValidated), NR, D.timeToFirstValidated],
        ['Time to first approval', st(c.timeToFirstApproval), st(e.timeToFirstApproval), st(L.timeToFirstApproval), D.timeToFirstApproval],
        ['Versions per approved asset', num(c.versionsPerApproved), num(e.versionsPerApproved), L.revisionsPerSet.n ? html`${num(L.revisionsPerSet)} <span class="ov-dim">revisions per set</span>` : num(L.revisionsPerSet), D.versionsPerApproved],
        ['Spend per approved asset', cost(c), cost(e), NR, D.costPerApproved],
        ['First-pass quality', c.firstPass && c.firstPass.measured ? c.firstPass.share + '% measured clean first time (' + c.firstPass.passed + ' of ' + c.firstPass.measured + '); ' + c.firstPass.approvedAsDrafted + ' of ' + c.firstPass.approved + ' approved as first drafted' : html`<span class="ov-dim">none yet</span>`, e.firstPass && e.firstPass.measured ? e.firstPass.share + '% (' + e.firstPass.passed + ' of ' + e.firstPass.measured + ')' : html`<span class="ov-dim">none yet</span>`, NR, D.firstPass],
        ['Constraint adherence', pct(c.adherence, 'clean', 'current'), pct(e.adherence, 'clean', 'current'), L.adherence.pieces ? html`${pct(L.adherence, 'clean', 'pieces')} <span class="ov-dim">figures and banned terms only</span>` : pct(L.adherence, 'clean', 'pieces'), D.adherence],
        ['Technical validation passed', pct(c.validation, 'passed', 'measured'), pct(e.validation, 'passed', 'measured'), NR, ''],
        ['Agency rejections', String(c.rejections), String(e.rejections), L.killed + ' killed', ''],
        ['Client: changes asked / approvals', c.client.changesRequested + ' / ' + c.client.approvals, e.client.changesRequested + ' / ' + e.client.approvals, NR, ''],
      ];
      body = html`<table class="ov-table" aria-label="Outcome metrics"><thead><tr><th>Measure</th><th>Last ${m.days} days</th><th>The ${m.days} days before</th><th>Release and Content Desks, last ${m.days} days</th></tr></thead><tbody>${rows.map(r => html`<tr key=${r[0]}><td title=${r[4] || ''}>${r[0]}</td><td class="num">${r[1]}</td><td class="num">${r[2]}</td><td class="num">${r[3]}</td></tr>`)}</tbody></table>
        <div class=${'st-iso' + (m.isolation.clean ? '' : ' bad')} aria-label="Isolation audit"><b>Isolation:</b> ${m.isolation.clean ? 'clean' : m.isolation.violations.length + ' item' + (m.isolation.violations.length === 1 ? '' : 's') + ' belonging elsewhere'} across ${m.isolation.versions} current version${m.isolation.versions === 1 ? '' : 's'} (${m.isolation.checked.rules} rules, ${m.isolation.checked.references} references, ${m.isolation.checked.marks} marks read).
          ${m.isolation.violations.length ? html`<ul>${m.isolation.violations.map((v, i) => html`<li key=${i}>${v.asset}: ${v.kind} - ${v.detail}</li>`)}</ul>` : null}</div>
        <div class="ov-dim">The desks never recorded: ${L.notRecorded.join('; ')}. ${m.note} Hover a measure for its definition.</div>`; }
    return html`<div class="st-metrics" aria-label="Outcome metrics panel"><div class="ov-sechead"><span class="ov-title">Outcomes for ${client.name}</span><select class="st-sel" value=${days} onChange=${e => setDays(e.target.value)} aria-label="Metrics window"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select><button class="ov-link" onClick=${() => setOpen(false)}>fold</button></div>${body}</div>`;
  }
  function Intake({ client, kit, onCreate, onCancel, preset }) {
    const pr = preset || {};
    const [start, setStart] = useState(['release', 'brief', 'reference'].indexOf(pr.start) >= 0 ? pr.start : 'release');
    const [deliverable, setDeliverable] = useState(['copy', 'visual', 'set'].indexOf(pr.deliverable) >= 0 ? pr.deliverable : 'set');
    const camps = (kit && kit.campaigns || []).filter(c => c.active !== false);
    // the campaign is the team's choice: with one campaign in the kit it is shown chosen and named as such; with several nothing is chosen until someone chooses
    const [campaign, setCampaign] = useState(pr.campaign != null ? pr.campaign : camps.length === 1 ? camps[0].id : '');
    const [campChosen, setCampChosen] = useState(pr.campaign != null || camps.length <= 1);
    const [text, setText] = useState(pr.text || ''); const [instruction, setInstruction] = useState(pr.instruction || '');
    const [chs, setChs] = useState({ linkedin: true, instagram: true, facebook: true, x: false });
    const [file, setFile] = useState(null);
    const [route, setRoute] = useState(pr.route === 'guided' ? 'guided' : 'quick');
    const clear = start === 'brief' ? isClear(text) : start === 'release' ? !!instruction.trim() : true;
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setFile({ name: f.name, mime: f.type || 'image/png', b64: String(rd.result).split(',')[1] }); rd.readAsDataURL(f); };
    return html`<div class="st-intake">
      <div class="ov-title">New project for ${client.name}</div>
      ${pr.from ? html`<div class="ov-dim">${pr.from === 'release' ? 'The Release Desk is this intake now: paste the release, the ledger is read, tiles and copy come out of the same project.' : pr.from === 'content' ? 'The Content Desk is this intake now: a brief in, copy per channel out, with the same checks and the same voice.' : pr.from === 'sentinel' ? 'Drafted from a Sentinel alert: the alert is the brief; edit it, pick the channels and create the project.' : ''}</div>` : null}
      <div class="st-intake-row">
        <div><${Lbl}>Route</${Lbl}><div class="st-seg" role="radiogroup" aria-label="Route">${[['quick', 'Quick production', 'a clear, approved brief: straight to production'], ['guided', 'Guided campaign development', 'strategy first, then three directions, then a sequence']].map(([k, l, t]) => html`<button key=${k} class=${'st-segbtn' + (route === k ? ' on' : '')} title=${t} role="radio" aria-checked=${route === k} onClick=${() => setRoute(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Start from</${Lbl}><div class="st-seg">${[['release', 'A release or source document'], ['brief', 'A brief or one line'], ['reference', 'Existing creative or references']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (start === k ? ' on' : '')} onClick=${() => setStart(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Deliverable</${Lbl}><div class="st-seg">${[['copy', 'Copy only'], ['visual', 'Visual creative'], ['set', 'Coordinated campaign set']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (deliverable === k ? ' on' : '')} onClick=${() => setDeliverable(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Campaign</${Lbl}><select class="st-sel" value=${campChosen ? campaign : '__'} onChange=${e => { if (e.target.value === '__') { setCampChosen(false); return; } setCampaign(e.target.value); setCampChosen(true); }} aria-label="Campaign">${!campChosen ? html`<option value="__">Choose the campaign...</option>` : null}<option value="">No campaign</option>${camps.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select><div class="ov-dim">${!camps.length ? 'No campaigns in this client\'s brand kit yet.' : !campChosen ? 'The kit has ' + camps.length + ' campaigns; the first is not assumed. The campaign decides the mark, the colours and the facts in play.' : camps.length === 1 && campaign ? 'The kit\'s only campaign is shown chosen; pick "No campaign" if this work is not part of it.' : 'From the brand kit. Choosing a campaign never changes the client or its approved facts.'}</div></div>
      </div>
      <${Lbl}>${start === 'release' ? 'Paste the release or source text' : start === 'brief' ? 'The brief, or one line' : 'What to do with the reference'}</${Lbl}>
      <textarea class="st-ta" rows="7" value=${text} onInput=${e => setText(e.target.value)} placeholder=${start === 'release' ? 'Paste the release text. Claims, figures and quotations are extracted with their passages before anything is written.' : start === 'brief' ? 'e.g. "Write three LinkedIn posts on the $74 billion figure in the HOOF voice" (a clear instruction goes straight to production) or "Something for Victoria about regional jobs" (an open brief gets two directions first)' : 'e.g. "Adapt the approved harvester tile for Instagram 4:5 and a 9:16 story; keep the headline"'}></textarea>
      ${start === 'release' ? html`<div><${Lbl}>Instruction (optional: a clear instruction skips the direction step)</${Lbl}><input class="st-in" value=${instruction} onInput=${e => setInstruction(e.target.value)} placeholder='e.g. "Three posts on the $74 billion figure" - leave empty to get two directions first' /></div>` : null}
      ${start === 'reference' ? html`<div class="st-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${pick} aria-label="Reference image" /> ${file ? html`<span>${file.name} attached as a composition reference.</span>` : html`<span>Attach artwork or a reference image (PNG, JPEG, WebP). Competitor work is inspiration only.</span>`}</div>` : null}
      ${deliverable !== 'visual' ? html`<div><${Lbl}>Channels (edit freely)</${Lbl}><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + (chs[k] ? ' on' : '')} onClick=${() => setChs(Object.assign({}, chs, { [k]: !chs[k] }))}>${CHANNELS[k].label} ${CHANNELS[k].format}</button>`)}</div></div>` : html`<div class="ov-dim">Visual creative: an Instagram 4:5 composition; adapt to other formats afterwards.</div>`}
      <div class="st-intake-foot">
        <span class="ov-dim">${route === 'guided' ? 'Guided: ' + (start === 'release' ? 'the source is read first, then ' : '') + 'a creative strategy to confirm, then three directions to choose from; nothing is produced until you choose.' : start === 'release' ? (clear ? 'Extraction first, then production from your instruction; no direction step.' : 'Extraction first, then two directions to choose from.') : start === 'brief' ? (clear && text ? 'Reads as a clear instruction: production starts without a direction step.' : 'Reads as an open brief: two directions first.') : 'Production from the reference and your instruction; no direction step.'}</span>
        <button class="btn sm ghost" onClick=${onCancel}>Cancel</button>
        <button class="btn sm" disabled=${!text.trim() || !campChosen} title=${!campChosen ? 'Choose the campaign first' : ''} onClick=${() => onCreate({ route, start, deliverable, campaign, campaignConfirmed: campChosen, text: text.trim(), instruction: instruction.trim(), channels: deliverable === 'visual' ? ['instagram'] : Object.keys(chs).filter(k => chs[k]), clear, file })}>Create project</button>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ rail and centre views */
  /** The left rail: the assets (what Refine works on) with their state, then the project's tools. */
  const ASSET_WORD = { approved: 'approved', partly: 'partly approved', revised: 'revised, not approved', draft: 'draft' };
  function Rail({ p, view, setView, sel, setSel, toolsOpen, setToolsOpen }) {
    const fams = useMemo(() => { const m = {}; (p.assets || []).forEach(a => { (m[a.family] = m[a.family] || []).push(a); }); return m; }, [p.assets]);
    const stat = a => { const c = standing(a, 'copy'), d = standing(a, 'design'); const cur = current(a); return c && (d || (cur && cur.mode === 'copy')) ? 'approved' : c || d ? 'partly' : vtotal(a) > 1 ? 'revised' : 'draft'; };
    const tech = a => { const v = current(a); if (!v || v.mode === 'copy' || v.mode === 'generated') return ''; const t = (a.readiness || {}).technical; return t === 'passed' ? '' : t === 'failed' ? 'failing validation' : 'not validated'; };
    const live = (p.jobs || []).filter(j => j.state === 'queued' || j.state === 'running').length;
    const failed = (p.jobs || []).filter(j => j.state === 'failed').length;
    const busyOn = id => (p.jobs || []).some(j => j.asset === id && (j.state === 'queued' || j.state === 'running'));
    const tools = [['brand', 'Brand'], ['context', 'Client context'], ['jobs', 'Jobs', live || (failed ? failed + ' failed' : null)]];
    return html`<nav class="st-rail" aria-label="Assets and project tools">
      <div class="st-rail-sec"><${Lbl}>Assets ${p.assets.length ? '(' + p.assets.length + ')' : ''}</${Lbl}>
      ${Object.keys(fams).map(f => html`<div key=${f} class="st-fam" role="group" aria-label=${f}><div class="st-famname">${f}</div>${fams[f].map(a => { const t = tech(a); const s0 = stat(a); return html`<button key=${a.id} class=${'st-railbtn asset' + (view === 'asset' && sel === a.id ? ' on' : '')} aria-current=${view === 'asset' && sel === a.id ? 'true' : undefined} onClick=${() => { setSel(a.id); setView('asset'); }} title=${a.title + ': ' + ASSET_WORD[s0] + (t ? ', ' + t : '')}>
        <${Composition} v=${current(a)} a=${a} ns=${p.ns} size="mini" />
        <span class="st-asset-name">${a.title}<span class="ov-dim"> ${a.format}</span>${t ? html`<span class="st-asset-flag">${t}</span>` : null}</span><span class="st-asset-meta">${busyOn(a.id) ? html`<span class="st-spin" aria-label="a job is running on this asset"></span>` : null}<span class=${'st-dot ' + s0} aria-label=${ASSET_WORD[s0]}></span><span class="ov-dim">v${vtotal(a)}</span></span></button>`; })}</div>`)}
      ${!p.assets.length ? html`<div class="ov-dim st-pad">No assets yet. ${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction to start production.' : 'Production starts from the brief.'}</div>` : null}
      </div>
      <div class="st-rail-sec st-tools"><button class="st-tools-toggle" aria-expanded=${!!toolsOpen} onClick=${() => setToolsOpen(!toolsOpen)}><span class="st-lbl">Client and jobs</span><span aria-hidden="true">${toolsOpen ? '−' : '+'}</span></button>
        ${toolsOpen ? tools.map(([k, l, n]) => html`<button key=${k} class=${'st-railbtn' + (view === k ? ' on' : '')} aria-current=${view === k ? 'true' : undefined} onClick=${() => setView(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`) : null}
      </div>
    </nav>`;
  }
  const SRC_WORD = { approved: 'approved', preference: 'preference', previous: 'previous brief', reference: 'reference', team: 'team', ai: 'AI suggestion' };
  const SRC_KIND = { approved: 'ok', preference: '', previous: '', reference: '', team: '', ai: 'warn' };
  /** A searchable, editable field: type freely, or take a suggestion; each suggestion says where it came from. */
  function Combo({ id, value, onChange, items, rows, disabled, placeholder }) {
    const [open, setOpen] = useState(false);
    const q = String(value || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const list = (items || []).filter(it => !value || it.text.toLowerCase() !== String(value).toLowerCase()).map(it => ({ it, score: q.length ? q.filter(w => it.text.toLowerCase().indexOf(w) >= 0).length : 0 })).sort((x, y) => y.score - x.score).slice(0, open ? 8 : 3).map(x => x.it);
    return html`<div class="st-combo">
      <textarea class="st-ta" rows=${rows || 2} id=${id} value=${value || ''} disabled=${disabled} placeholder=${placeholder || ''} onInput=${e => onChange(e.target.value, 'team')} onFocus=${() => setOpen(true)}></textarea>
      ${!disabled && list.length ? html`<div class="st-combo-list" role="listbox" aria-label=${'Suggestions for ' + id}>${list.map((it, i) => html`<button key=${i} class="st-combo-opt" role="option" title=${it.from || ''} onClick=${() => { onChange(it.text, it.source, it); setOpen(false); }}><${Chip} kind=${SRC_KIND[it.source]}>${SRC_WORD[it.source] || it.source}</${Chip}> ${it.text}${it.from ? html` <span class="ov-dim">- ${it.from}</span>` : null}</button>`)}${(items || []).length > list.length && !open ? html`<button class="ov-link" onClick=${() => setOpen(true)}>more (${items.length})</button>` : null}</div>` : null}
    </div>`;
  }
  function BriefView({ p, onSave, onDirect, onProduce, onCampaign, onStrategy, busy, head, prov, onGo }) {
    // the working copy: the brief as the server last held it (base) and the team's edits on top; edits survive a reload in
    // this browser and a newer version saved elsewhere, and are merged field by field when saved, never silently dropped
    const saved0 = store.draft(p.id);
    const restoredDraft = saved0 && saved0.b && JSON.stringify(saved0.b) !== JSON.stringify(p.brief || {}) ? saved0 : null;
    const baseRef = useRef(restoredDraft ? (saved0.base || p.brief || {}) : (p.brief || {}));
    const [b, setB] = useState(restoredDraft ? restoredDraft.b : (p.brief || {}));
    const [restored, setRestored] = useState(!!restoredDraft); const [elsewhere, setElsewhere] = useState(false); const [clash, setClash] = useState(null); const [saving, setSaving] = useState(false);
    const dirty = JSON.stringify(b) !== JSON.stringify(baseRef.current);
    const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
    useEffect(() => { if (!dirtyRef.current) { baseRef.current = p.brief || {}; setB(p.brief || {}); setElsewhere(false); } else if (JSON.stringify(p.brief || {}) !== JSON.stringify(baseRef.current)) setElsewhere(true); }, [p.revision]);
    useEffect(() => { store.setDraft(p.id, dirty ? { b, base: baseRef.current, rev: p.revision, at: Date.now() } : null); }, [b, dirty]);
    const save = async (next, force) => {
      setSaving(true);
      try { const r = await onSave(next || b, baseRef.current, force);
        if (r && r.ok) { baseRef.current = r.brief || next || b; setB(r.brief || next || b); setRestored(false); setElsewhere(false); setClash(null); store.setDraft(p.id, null); return true; }
        if (r && r.clash) setClash(r); return false; }
      finally { setSaving(false); }
    };
    const discard = () => { baseRef.current = p.brief || {}; setB(p.brief || {}); setRestored(false); setElsewhere(false); setClash(null); store.setDraft(p.id, null); };
    const [sugg, setSugg] = useState(null); const [chk, setChk] = useState(null); const [ack, setAck] = useState(false); const [addTo, setAddTo] = useState({ mandatory: '', preferred: '', open: '' });
    const loadSugg = useCallback(async (ai) => { try { setSugg(s => Object.assign({}, s || {}, { loading: true })); const d = await call('/studio/brief/suggest?project=' + encodeURIComponent(p.id) + (ai ? '&ai=1' : '')); setSugg(d); } catch (e) { setSugg({ error: e.message }); } }, [p.id]);
    useEffect(() => { loadSugg(false); }, [p.id, p.campaign]);
    useEffect(() => { let live = true; call('/studio/brief/check?project=' + encodeURIComponent(p.id)).then(d => { if (live) setChk(d); }).catch(e => { if (live) setChk({ error: e.message }); }); return () => { live = false; }; }, [p.id, p.revision]);
    const set = (k, v, src) => setB(Object.assign({}, b, { [k]: v }, src && ['objective', 'audience', 'message', 'action'].indexOf(k) >= 0 ? { [k + 'Source']: src } : {}));
    const chans = (b.channels || []).map(chanLabel).join(', ');
    const ro = !canWrite() || p.readOnly;
    const fields = (sugg && sugg.fields) || {};
    const req = Object.assign({ mandatory: [], preferred: [], open: [] }, b.requirements || {});
    const setReq = (band, items) => setB(Object.assign({}, b, { requirements: Object.assign({}, req, { [band]: items }) }));
    const blocking = chk && !chk.error ? chk.gaps.filter(g => g.level === 'mandatory') : [];
    const sizeNow = b.size || '2K'; const [imagery, setImagery] = useState(b.imagery === 'none' ? 'none' : sizeNow);
    const chosen = p.directions.find(d => d.chosen);
    const noClaude = prov && prov.claude === false;
    const go = async (fn) => { if (dirty && !(await save())) return; fn(); };
    const produceArgs = () => ({ acknowledge: !!(blocking.length && ack), size: imagery === 'none' ? undefined : imagery, imagery: imagery === 'none' ? 'none' : undefined });
    return html`<div class="st-centre-pad st-brief">
      <${StageHead} ...${head}>
        ${!ro && dirty ? html`<span class="st-dirty" role="status">Unsaved changes</span><button class="btn sm" disabled=${saving} onClick=${() => save()}>${saving ? 'Saving...' : 'Save brief'}</button>` : !ro ? html`<span class="ov-dim" role="status">Brief saved</span>` : null}
        ${p.assets.length && onGo ? html`<button class="btn sm ghost" onClick=${() => onGo('refine')}>Continue to Refine</button>` : null}
      </${StageHead}>
      ${restored ? html`<div class="st-notice info" role="status"><div class="st-notice-body"><b>Unsaved brief edits restored.</b> <span>These edits were made in this browser and never saved. Save them, or discard them to see the brief as saved.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save()}>Save them</button><button class="btn sm ghost" onClick=${discard}>Discard</button></div></div>` : null}
      ${elsewhere && !clash ? html`<div class="st-notice warn" role="status"><div class="st-notice-body"><b>The brief changed elsewhere.</b> <span>A job or a teammate saved a newer brief while you were editing. Your edits are kept here; saving merges them field by field.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save()}>Save and merge</button><button class="btn sm ghost" onClick=${discard}>Use the saved brief</button></div></div>` : null}
      ${clash ? html`<div class="st-notice warn" role="alert"><div class="st-notice-body"><b>Both versions changed the same field${clash.clash.length === 1 ? '' : 's'}: ${clash.clash.join(', ')}.</b> <span>Nothing was overwritten. Keep yours to save over the newer version, or take theirs for ${clash.clash.length === 1 ? 'that field' : 'those fields'} and keep the rest of your edits.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save(clash.merged, true)}>Keep mine</button><button class="btn sm ghost" onClick=${() => { const next = Object.assign({}, clash.merged); clash.clash.forEach(k => { next[k] = clash.theirs[k]; }); baseRef.current = clash.theirs; setB(next); setClash(null); }}>Take theirs</button></div></div>` : null}
      ${!ro && !p.assets.length ? html`<div class="st-produce st-actionbar" aria-label="Produce">
        <div class="st-actionbar-text"><b>${chosen ? 'Produce from "' + chosen.title + '"' : 'When the brief is ready'}</b><span class="ov-dim">${chosen ? 'The chosen direction decides the idea; the brief decides channels and claims.' : 'A clear, approved brief can go straight to production; an open one is better explored as directions first.'} ${chans ? 'Channels: ' + chans + '.' : 'No channels set.'}</span></div>
        <label class="ov-dim st-size">Imagery <select class="st-sel" value=${imagery} onChange=${e => { setImagery(e.target.value); setB(Object.assign({}, b, e.target.value === 'none' ? { imagery: 'none' } : { size: e.target.value, imagery: '' })); }} aria-label="Imagery resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option><option value="none">No imagery (type and colour)</option></select></label>
        ${blocking.length ? html`<label class="st-check"><input type="checkbox" checked=${ack} onChange=${e => setAck(e.target.checked)} /> Proceed on the stated assumptions despite ${blocking.length} mandatory gap${blocking.length === 1 ? '' : 's'}</label>` : null}
        <div class="st-actionbar-acts">
          <button class=${'btn sm' + (chosen ? '' : ' ghost')} disabled=${!!busy || noClaude || !(b.channels || []).length || (blocking.length && !ack)} title=${noClaude ? 'Claude is not configured on the worker' : !(b.channels || []).length ? 'Choose channels first' : blocking.length && !ack ? 'Resolve the mandatory gaps, or tick to proceed on the assumptions' : ''} onClick=${() => go(() => onProduce(produceArgs()))}>Produce now</button>
          ${!chosen ? html`<button class="btn sm" disabled=${!!busy || noClaude} title=${noClaude ? 'Claude is not configured on the worker' : ''} onClick=${() => go(() => onDirect())}>Explore directions first</button>` : null}
        </div>
        <div class="ov-dim st-actionbar-foot">${imagery === 'none' ? 'No image will be generated: every asset is a complete typographic composition (type, shapes, colour and the mark).' : 'Renders are queued at ' + imagery + ' after the copy is written; each is a job you can watch, retry or cancel.'} ${noClaude ? 'Claude is not configured on the worker, so nothing can be written yet.' : ''}</div>
      </div>` : null}
      <div class="st-field st-check-panel" aria-label="Brief check"><${Lbl}>Before anything is spent</${Lbl}>
        ${!chk ? html`<div class="ov-dim">Checking the brief...</div>` : chk.error ? html`<div class="ov-dim">${chk.error}</div>` : html`<div>
          ${!chk.gaps.length ? html`<div><${Chip} kind="ok">complete</${Chip}> <span class="ov-dim">objective, message, audience, action and deliverables are set; the campaign and its mark are on file.</span></div>` : null}
          <ul class="st-ul">${chk.gaps.map((g, i) => html`<li key=${i}><${Chip} kind=${g.level === 'mandatory' || g.level === 'blocking' ? 'bad' : g.level === 'preferred' ? 'warn' : ''}>${g.level === 'blocking' ? 'blocks approval' : g.level}</${Chip}> ${g.text}${g.options && !ro && onCampaign ? html` <span class="st-seg">${g.options.map(o => html`<button key=${o.id} class="st-segbtn" onClick=${() => onCampaign(o.id)}>${o.name}</button>`)}<button class="st-segbtn" onClick=${() => onCampaign('', true)}>No campaign</button></span>` : null}</li>`)}</ul>
          ${chk.assumptions.length ? html`<div class="ov-dim">Production would proceed on: ${chk.assumptions.map(a => a.text).join('; ')}.</div>` : null}
          ${chk.campaign ? html`<div class="ov-dim">Campaign ${chk.campaign.name}: mark policy ${chk.campaign.policy}; client logo ${chk.campaign.logoOnFile ? 'on file' : 'not on file'}${chk.campaign.policy === 'wordmark' || chk.campaign.policy === 'both' ? '; wordmark ' + (chk.campaign.wordmarkOnFile ? 'on file' : 'not on file') : ''}.</div>` : null}
          ${chk.brand ? html`<div class="st-brand-line" aria-label="Brand readiness"><${Chip} kind=${chk.brand.state === 'ready' ? 'ok' : chk.brand.state === 'blocked' ? 'bad' : 'warn'}>brand ${chk.brand.state === 'ready' ? 'ready' : chk.brand.state}</${Chip}> <span class="ov-dim">${[chk.brand.blocking.length ? chk.brand.blocking.map(x => x.text).join(' ') : '', chk.brand.conflicts.length ? chk.brand.conflicts.length + ' conflict' + (chk.brand.conflicts.length === 1 ? '' : 's') + ' in what the Studio knows' : '', chk.brand.gaps ? chk.brand.gaps + ' gap' + (chk.brand.gaps === 1 ? '' : 's') : '', chk.brand.outdated ? chk.brand.outdated + ' to review' : ''].filter(Boolean).join('; ') || 'nothing missing or conflicting'}. Open Brand in the rail for the detail.</span></div>` : null}
        </div>`}
      </div>
      ${sugg && !sugg.error ? html`<div class="ov-dim st-brief-src">Suggestions come from ${['approved', 'preference', 'previous', 'reference', 'ai'].filter(k => sugg.sources && sugg.sources[k]).map(k => sugg.sources[k] + ' ' + (SRC_WORD[k] || k) + (sugg.sources[k] === 1 ? '' : 's')).join(', ') || 'nothing on file yet'}. Approved items are the kit's own records; an AI suggestion is only a suggestion.${!ro ? html` <button class="ov-link" disabled=${!!busy || sugg.loading} onClick=${() => loadSugg(true)}>${sugg.aiModel ? 'ask the model again' : 'ask the model for suggestions (one call)'}</button>` : null}${sugg.aiError ? ' The model did not answer: ' + sugg.aiError : ''}</div>` : sugg && sugg.error ? html`<div class="ov-dim">Suggestions unavailable: ${sugg.error}</div>` : null}
      ${['objective', 'audience', 'message', 'action', 'deliverables'].map(k => html`<div key=${k} class="st-field"><${Lbl}>${k}${(b.proposed || []).indexOf(k) >= 0 ? html` <${Chip} kind="warn">proposed by the Studio</${Chip}>` : null}${b[k + 'Source'] && b[k + 'Source'] !== 'team' ? html` <${Chip} kind=${SRC_KIND[b[k + 'Source']]}>${SRC_WORD[b[k + 'Source']]}</${Chip}>` : null}</${Lbl}><${Combo} id=${'brief-' + k} value=${b[k] || ''} items=${fields[k] || []} disabled=${ro} onChange=${(v, src) => set(k, v, src)} placeholder=${k === 'action' ? 'What the audience should do' : ''} /></div>`)}
      <div class="st-field st-reqs"><${Lbl}>Design requirements</${Lbl}><div class="ov-dim">Mandatory items are constraints on every concept; preferred ones are followed unless the message needs otherwise; open ones are the art director's call. Each says where it came from.</div>
        ${['mandatory', 'preferred', 'open'].map(band => html`<div key=${band} class=${'st-req-band ' + band}><div class="st-req-head"><b>${band}</b> <span class="ov-dim">${(req[band] || []).length}</span></div>
          ${(req[band] || []).length ? html`<ul class="st-ul">${(req[band] || []).map((it, i) => html`<li key=${i}><${Chip} kind=${SRC_KIND[it.source]}>${SRC_WORD[it.source] || it.source}</${Chip}> ${it.text}${it.from ? html` <span class="ov-dim">- ${it.from}</span>` : null}${!ro ? html` <button class="ov-link" onClick=${() => setReq(band, req[band].filter((_, j) => j !== i))}>remove</button>` : null}</li>`)}</ul>` : null}
          ${!ro ? html`<${Combo} id=${'req-' + band} rows=${1} value=${addTo[band]} items=${(fields.requirements || []).filter(it => (it.band || 'open') === band || band === 'open')} onChange=${(v, src, it) => { if (it) { setReq(band, (req[band] || []).concat([{ text: it.text, source: it.source, from: it.from || '' }])); setAddTo(Object.assign({}, addTo, { [band]: '' })); } else setAddTo(Object.assign({}, addTo, { [band]: v })); }} placeholder=${'Add a ' + band + ' requirement, or pick a suggestion'} />${addTo[band].trim() ? html`<button class="ov-link" onClick=${() => { setReq(band, (req[band] || []).concat([{ text: addTo[band].trim(), source: 'team', from: '' }])); setAddTo(Object.assign({}, addTo, { [band]: '' })); }}>add as written</button>` : null}` : null}
        </div>`)}
      </div>
      ${b.assumptions && b.assumptions.length ? html`<div class="st-field"><${Lbl}>Assumptions the Studio made (edit or remove)</${Lbl}><ul class="st-ul">${b.assumptions.map((a, i) => html`<li key=${i}>${a} ${!ro ? html`<button class="ov-link" onClick=${() => setB(Object.assign({}, b, { assumptions: b.assumptions.filter((_, j) => j !== i) }))}>remove</button>` : null}</li>`)}</ul></div>` : null}
      ${(b.notRecorded || []).length ? html`<div class="ov-dim">Not recorded at the time: ${b.notRecorded.join(', ')}. Left blank rather than invented.</div>` : null}
      <${StrategyPanel} p=${p} onDraft=${onStrategy} onSave=${st => save(Object.assign({}, b, { strategy: st }))} busy=${busy} />
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
  const REF_COMPONENTS = ['typography', 'colour', 'composition', 'hierarchy', 'imagery', 'image treatment', 'panels', 'spacing', 'mark placement', 'copy tone'];
  /** A reference recipe: per component, borrow it, leave it, or say nothing; the models see the recipe on the reference's line. */
  function RecipeEditor({ r, onSave, busy }) {
    const rc0 = r.recipe || { borrow: [], exclude: [], note: '' };
    const [st, setSt] = useState(() => { const m = {}; REF_COMPONENTS.forEach(c => { m[c] = rc0.borrow.indexOf(c) >= 0 ? 'borrow' : rc0.exclude.indexOf(c) >= 0 ? 'exclude' : ''; }); return m; });
    const [note, setNote] = useState(rc0.note || '');
    return html`<div class="st-recipe" aria-label=${'Recipe for ' + r.name}>
      <div class="ov-dim">Per component: take it from this reference, leave it, or say nothing (the purpose decides).</div>
      <div class="st-recipe-grid">${REF_COMPONENTS.map(c => html`<label key=${c} class="st-recipe-row"><span>${c}</span><select class="st-sel" value=${st[c]} onChange=${e => setSt(Object.assign({}, st, { [c]: e.target.value }))} aria-label=${c + ' from ' + r.name}><option value="">-</option><option value="borrow">borrow</option><option value="exclude">do not take</option></select></label>`)}</div>
      <input class="st-in" value=${note} onInput=${e => setNote(e.target.value)} placeholder="Note for the designers and the models (optional)" aria-label="Recipe note" />
      <div><button class="btn sm" disabled=${!!busy} onClick=${() => onSave(r.id, { borrow: REF_COMPONENTS.filter(c => st[c] === 'borrow'), exclude: REF_COMPONENTS.filter(c => st[c] === 'exclude'), note: note.trim() })}>Save recipe</button></div>
    </div>`;
  }
  function ReferencesView({ p, onAdd, onAnalyse, onRecipe, busy }) {
    const [purpose, setPurpose] = useState('composition'); const [note, setNote] = useState(''); const [rcOpen, setRcOpen] = useState(null);
    const [own, setOwn] = useState(!!p.campaign);
    // over 4.5 MB the models cannot be shown the original: a smaller JPEG is prepared here and sent beside it; the original is kept exactly
    const prepare = (dataUrl) => new Promise(res => { const im = new Image(); im.onload = () => { const k = Math.min(1, 2400 / Math.max(im.naturalWidth, im.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.86).split(',')[1]); }; im.onerror = () => res(null); im.src = dataUrl; });
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = async () => { const url = String(rd.result); const body = { name: f.name, mime: f.type || 'image/png', imageB64: url.split(',')[1], purpose, note, campaign: own ? p.campaign : '' }; if (f.size >= 4500000) { const prep = await prepare(url); if (prep) { body.prepB64 = prep; body.prepMime = 'image/jpeg'; } } onAdd(body); }; rd.readAsDataURL(f); e.target.value = ''; };
    return html`<div class="st-centre-pad"><div class="ov-title">References</div>
      ${!p.references.length ? html`<div class="ov-empty">No references. The client logo comes from the brand kit and is placed exactly, never redrawn.</div>` : null}
      <div class="st-refs">${p.references.map(r => { const an = r.analysis; return html`<div key=${r.id} class="st-ref"><${RefThumb} r=${r} /><div><b>${r.name}</b> <${Chip} kind=${r.purpose === 'brand' || r.purpose === 'approved' ? 'ok' : ''} title=${r.purpose === 'brand' || r.purpose === 'approved' ? 'a constraint: the client\'s requirements' : 'an example in this one respect'}>${r.purpose}</${Chip}>${r.campaign ? html` <${Chip} title="a concept on another campaign leaves it out of the recommended pack">${r.campaign}</${Chip}>` : null}${r.prepKey ? html` <${Chip} title="the original is over 4.5 MB; the models see a prepared copy and the original is kept">prepared copy</${Chip}>` : null}<div class="ov-dim">${r.note ? r.note + '; ' : ''}added by ${r.who}, ${aest(r.created)}</div>
        ${an && !an.error ? html`<div class="st-ref-an"><div>${an.summary}</div>${an.typography ? html`<div><b>Type</b> ${an.typography}</div>` : null}${an.colour && (an.colour.palette.length || an.colour.relationships) ? html`<div><b>Colour</b> ${an.colour.palette.map((c, i) => html`<span key=${i} class="st-swatch" style=${{ background: c }} title=${c}></span>`)} ${an.colour.relationships}</div>` : null}${an.composition ? html`<div><b>Composition</b> ${an.composition}</div>` : null}${an.hierarchy ? html`<div><b>Hierarchy</b> ${an.hierarchy}</div>` : null}${an.imageTreatment ? html`<div><b>Image</b> ${an.imageTreatment}</div>` : null}${an.panels ? html`<div><b>Panels</b> ${an.panels}</div>` : null}${an.spacing ? html`<div><b>Spacing</b> ${an.spacing}</div>` : null}${an.logo ? html`<div><b>Logo</b> ${an.logo}</div>` : null}${(an.takeaways || []).length ? html`<div><b>Take</b> ${an.takeaways.join('; ')}</div>` : null}<div class="ov-dim">read by ${an.model || 'the vision pass'}; this is what the models are told about it</div></div>`
        : html`<div class="st-ref-an limited"><${Chip} kind="warn">not analysed</${Chip}> <span class="ov-dim">${an && an.error ? an.error : 'no vision pass yet'}; the models know its name and purpose only.</span> ${canWrite() && !p.readOnly && r.key && onAnalyse ? html`<button class="ov-link" disabled=${!!busy} onClick=${() => onAnalyse(r.id)}>Analyse now</button>` : null}</div>`}
        <div class="st-ref-recipe">${r.recipe ? html`<span><b>Recipe</b> ${r.recipe.borrow.length ? 'borrow ' + r.recipe.borrow.join(', ') : ''}${r.recipe.borrow.length && r.recipe.exclude.length ? '; ' : ''}${r.recipe.exclude.length ? 'do not take ' + r.recipe.exclude.join(', ') : ''}${r.recipe.note ? ' - ' + r.recipe.note : ''}</span>${r.recipe.conflict ? html` <${Chip} kind="warn" title=${r.recipe.conflict}>constraint still holds</${Chip}>` : null}` : html`<span class="ov-dim">No recipe: the purpose decides what the models take from it.</span>`} ${canWrite() && !p.readOnly && onRecipe ? html`<button class="ov-link" onClick=${() => setRcOpen(rcOpen === r.id ? null : r.id)}>${r.recipe ? 'edit recipe' : 'set a recipe'}</button>` : null}</div>
        ${rcOpen === r.id ? html`<${RecipeEditor} r=${r} busy=${busy} onSave=${(id, rc) => { onRecipe(id, rc); setRcOpen(null); }} />` : null}
      </div></div>`; })}</div>
      ${canWrite() && !p.readOnly ? html`<div class="st-field"><${Lbl}>Add a reference</${Lbl}><div class="st-seg">${['brand', 'composition', 'mood', 'imagery', 'typography', 'inspiration', 'approved'].map(k => html`<button key=${k} class=${'st-segbtn' + (purpose === k ? ' on' : '')} onClick=${() => setPurpose(k)}>${k}</button>`)}</div><input class="st-in" value=${note} onInput=${e => setNote(e.target.value)} placeholder="Note (what to take from it)" /><div class="st-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${pick} disabled=${!!busy} aria-label="Reference image" /> PNG, JPEG or WebP up to 12 MB; over 4.5 MB a smaller copy is prepared for the models and the original kept. Competitor work is inspiration only: no logos, claims or exact layouts reused.</div>${p.campaign ? html`<label class="st-check"><input type="checkbox" checked=${own} onChange=${e => setOwn(e.target.checked)} /> belongs to the campaign ${p.campaign}</label>` : null}</div>` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ the creative strategy: drafted, edited, confirmed - every later stage reads it */
  function StrategyPanel({ p, onDraft, onSave, busy }) {
    const st = (p.brief || {}).strategy || null; const ro = !canWrite() || p.readOnly;
    const [edit, setS] = useState(null); const [ins, setIns] = useState('');
    useEffect(() => { setS(null); }, [p.id, p.revision]);
    // the saved strategy until someone edits; then their working copy (never a null in between)
    const s = edit || st || null;
    const set = (k, v) => setS(Object.assign({}, s, { [k]: v })); const setA = (k, v) => setS(Object.assign({}, s, { audience: Object.assign({}, s.audience || {}, { [k]: v }) }));
    const lines = v => (v || []).join('\n'); const unlines = v => String(v || '').split('\n').map(x => x.trim()).filter(Boolean);
    const dirty = !!edit && JSON.stringify(edit) !== JSON.stringify(st);
    if (!st) return html`<div class="st-field st-strategy" aria-label="Creative strategy"><${Lbl}>Creative strategy</${Lbl}><div class="ov-dim">No strategy yet. A strategy names the communication problem, the audience as they are and as the work wants them to be, the insight and the campaign idea; directions, sequences and copy then work within it.</div>
      ${!ro ? html`<div class="st-nd-row"><input class="st-in" value=${ins} onInput=${e => setIns(e.target.value)} placeholder='Optional steer, e.g. "lead with regional voters"' aria-label="Strategy steer" /><button class="btn sm" disabled=${!!busy} onClick=${() => onDraft(ins.trim())}>Draft the strategy</button></div><div class="ov-dim">One model call at high effort; it is a proposal until you confirm it.</div>` : null}</div>`;
    const F = (label, val, on, rows) => html`<label class="st-sfield"><span class="st-lbl">${label}</span>${rows ? html`<textarea class="st-ta" rows=${rows} value=${val || ''} disabled=${ro} onInput=${e => on(e.target.value)}></textarea>` : html`<input class="st-in" value=${val || ''} disabled=${ro} onInput=${e => on(e.target.value)} />`}</label>`;
    return html`<div class="st-field st-strategy" aria-label="Creative strategy"><div class="st-field-head"><${Lbl}>Creative strategy</${Lbl}><${Chip} kind=${st.status === 'confirmed' ? 'ok' : 'warn'}>${st.status === 'confirmed' ? 'confirmed' + (st.confirmedBy ? ' by ' + st.confirmedBy : '') : 'proposed - not yet confirmed'}</${Chip}> <span class="ov-dim">${st.source === 'ai' ? 'drafted by ' + (st.model || 'a model') : 'edited by the team'}</span></div>
      <div class="st-sgrid">
        ${F('Campaign idea', s.idea, v => set('idea', v))}${F('Proposition', s.proposition, v => set('proposition', v))}
        ${F('Communication problem', s.problem, v => set('problem', v), 2)}${F('Insight', s.audience.insight, v => setA('insight', v), 2)}
        ${F('Audience', s.audience.who, v => setA('who', v))}${F('Tone', s.tone, v => set('tone', v))}
        ${F('They believe now', s.audience.now, v => setA('now', v), 2)}${F('We want them to believe', s.audience.wanted, v => setA('wanted', v), 2)}
        ${F('Avoid (one per line)', lines(s.avoid), v => set('avoid', unlines(v)), 3)}${F('Risks (one per line)', lines(s.risks), v => set('risks', unlines(v)), 3)}
        ${F('How we will judge it (signals, not forecasts)', lines(s.measures), v => set('measures', unlines(v)), 3)}${F('Open questions for the team', lines(s.questions), v => set('questions', unlines(v)), 3)}
      </div>
      ${s.proof && s.proof.length ? html`<div class="ov-dim">Proof from the ledger: ${s.proof.join(', ')}</div>` : null}
      ${!ro ? html`<div class="st-nd-row"><button class="btn sm ghost" disabled=${!!busy || !dirty} onClick=${() => onSave(Object.assign({}, s, { source: 'team' }))}>Save edits</button><button class="btn sm" disabled=${!!busy} onClick=${() => onSave(Object.assign({}, s, { status: 'confirmed', source: dirty ? 'team' : s.source }))}>${st.status === 'confirmed' ? 'Save and keep confirmed' : 'Confirm the strategy'}</button><button class="btn sm ghost" disabled=${!!busy} onClick=${() => onDraft(ins.trim())}>Draft again</button></div>` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ the campaign sequence: one argument told in order across channels */
  const ROLE_WORD = { opener: 'opener', explain: 'explain', proof: 'proof', response: 'response', voices: 'voices', 'call-to-action': 'call to action', reminder: 'reminder', other: 'other' };
  function SequenceView({ p, onPlan, onOpen, busy }) {
    const ro = !canWrite() || p.readOnly; const seqs = ((p.brief || {}).sequences || []).slice().reverse();
    const chosen = p.directions.find(d => d.chosen);
    const [f, setF] = useState({ direction: chosen ? chosen.id : '', channels: Object.assign({}, ...(((p.brief || {}).channels) || ['instagram', 'facebook', 'linkedin']).map(c => ({ [c]: true }))), count: '4', deliverable: 'composition', instruction: '' });
    const assetOf = id => p.assets.find(a => a.id === id);
    return html`<div class="st-centre-pad st-seq" aria-label="Campaign sequence"><div class="ov-title">Campaign sequence</div>
      <div class="ov-why">A coordinated set planned as one argument told in order: each asset has a role, a channel and format, a day, a purpose and a relation to the idea. The plan is one model call; every asset is made as an editable composition with no image spent until you ask for imagery.</div>
      ${!ro ? html`<div class="st-offer-box" aria-label="Plan a sequence"><div class="st-nd-row">
        <label class="ov-dim">From <select class="st-sel" value=${f.direction} onChange=${e => setF(Object.assign({}, f, { direction: e.target.value }))} aria-label="Direction"><option value="">the brief and the strategy</option>${p.directions.map((d, i) => html`<option key=${d.id} value=${d.id}>${String.fromCharCode(65 + i)}) ${d.title}${d.chosen ? ' (chosen)' : ''}</option>`)}</select></label>
        <label class="ov-dim">Assets <select class="st-sel" value=${f.count} onChange=${e => setF(Object.assign({}, f, { count: e.target.value }))} aria-label="Number of assets">${[2, 3, 4, 5, 6, 7, 8].map(n => html`<option key=${n} value=${n}>${n}</option>`)}</select></label>
        <label class="ov-dim">Deliver <select class="st-sel" value=${f.deliverable} onChange=${e => setF(Object.assign({}, f, { deliverable: e.target.value }))} aria-label="Deliverable"><option value="composition">editable compositions</option><option value="copy">copy only</option></select></label></div>
        <div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + (f.channels[k] ? ' on' : '')} onClick=${() => setF(Object.assign({}, f, { channels: Object.assign({}, f.channels, { [k]: !f.channels[k] }) }))}>${CHANNELS[k].label}</button>`)}</div>
        <input class="st-in" value=${f.instruction} onInput=${e => setF(Object.assign({}, f, { instruction: e.target.value }))} placeholder='Optional, e.g. "open with the myth, close with the petition, five days"' aria-label="Sequence instruction" />
        <div><button class="btn sm" disabled=${!!busy || !Object.values(f.channels).some(Boolean)} onClick=${() => onPlan({ direction: f.direction || undefined, channels: Object.keys(f.channels).filter(k => f.channels[k]), count: +f.count, deliverable: f.deliverable, instruction: f.instruction.trim() || undefined })}>Plan the sequence</button> <span class="ov-dim">one model call, no render</span></div></div>` : null}
      ${!seqs.length ? html`<div class="ov-empty">No sequence yet.</div>` : null}
      ${seqs.map(sq => html`<div key=${sq.id} class="st-seq-one"><div class="st-field-head"><b>${sq.name}</b> <span class="ov-dim">${aest(sq.at)}${sq.cadence ? ', ' + sq.cadence : ''}</span></div><div>${sq.arc}</div>
        <div class="st-seq-board">${sq.items.map(it => { const a = assetOf(it.asset); return html`<div key=${it.asset} class="st-seq-card"><div class="st-know-h"><b>${it.order}.</b> <${Chip}>${ROLE_WORD[it.role] || it.role}</${Chip}> <span class="ov-dim">${chanLabel(it.channel)} ${it.format}, day ${it.day}</span></div>
          ${a ? html`<${Composition} v=${current(a)} a=${a} ns=${p.ns} size="card" />` : html`<div class="ov-dim">asset removed</div>`}
          <div><b>Job</b> ${it.purpose}</div><div class="ov-dim">${it.relation}</div>
          ${a ? html`<button class="ov-link" onClick=${() => onOpen(a.id)}>open ${a.title}</button>` : null}</div>`; })}</div></div>`)}
    </div>`;
  }
  /* ------------------------------------------------------------ Board and Copy: the whole project at a glance, and every word in one deck */
  function BoardView({ p, onOpen }) {
    const fams = {}; p.assets.forEach(a => { (fams[a.family] = fams[a.family] || []).push(a); });
    const tech = a => { const v = current(a); if (!v) return ['none', '']; if (v.mode === 'copy') return ['copy', 'ok']; const t = (a.readiness || {}).technical; return [t === 'passed' ? 'validated' : t === 'failed' ? 'failing' : t === 'stale' ? 'stale' : 'not validated', t === 'passed' ? 'ok' : t === 'failed' ? 'bad' : 'warn']; };
    return html`<div class="st-centre-pad st-board" aria-label="Board"><div class="ov-title">Board</div><div class="ov-why">Every asset in the project, by family, drawn by the one renderer, with where it stands: technical validation, the agency's approvals and the version.</div>
      ${!p.assets.length ? html`<div class="ov-empty">No assets yet.</div>` : null}
      ${Object.keys(fams).map(f => html`<div key=${f} class="st-board-fam"><${Lbl}>${f} (${fams[f].length})</${Lbl}><div class="st-board-grid">${fams[f].map(a => { const [tw, tk] = tech(a); return html`<button key=${a.id} class="st-board-card" onClick=${() => onOpen(a.id)} aria-label=${'Open ' + a.title}>
        <${Composition} v=${current(a)} a=${a} ns=${p.ns} size="card" />
        <span class="st-board-t">${a.title}</span><span class="ov-dim">${chanLabel(a.channel)} ${a.format}, v${vtotal(a)}</span>
        <span class="st-know-h"><${Chip} kind=${tk}>${tw}</${Chip}>${standing(a, 'copy') ? html`<${Chip} kind="ok">copy approved</${Chip}>` : null}${standing(a, 'design') ? html`<${Chip} kind="ok">design approved</${Chip}>` : null}</span></button>`; })}</div></div>`)}
    </div>`;
  }
  function CopyView({ p, onEdit, onOpen }) {
    const ro = !canWrite() || p.readOnly; const [draft, setDraft] = useState({});
    const key = (a, k) => a.id + ':' + k;
    const val = (a, k) => draft[key(a, k)] != null ? draft[key(a, k)] : ((current(a) || {}).copy || {})[k] || '';
    const save = (a, k) => { const d = draft[key(a, k)]; if (d == null) return; const cur = ((current(a) || {}).copy || {})[k] || ''; if (d !== cur) onEdit(a, { [k]: d }); setDraft(x => { const y = Object.assign({}, x); delete y[key(a, k)]; return y; }); };
    const F = [['headline', 'Headline'], ['support', 'Support'], ['cta', 'CTA'], ['caption', 'Caption']];
    return html`<div class="st-centre-pad st-copydeck" aria-label="Copy deck"><div class="ov-title">Copy</div><div class="ov-why">Every word in the project in one place. An edit here is a text version of that asset (no render), checked again against the ledger, the facts and the banned terms; a change to words on a tile asks for its validation again.</div>
      <div class="st-copydeck-scroll"><table class="ov-table"><thead><tr><th>Asset</th>${F.map(([k, l]) => html`<th key=${k}>${l}</th>`)}<th>Checks</th></tr></thead><tbody>
      ${p.assets.map(a => { const v = current(a) || {}; const flags = (v.checks || []).filter(c => c.state !== 'matches' && c.state !== 'fact'); const max = (CHANNELS[a.channel] || {}).max || 900;
        return html`<tr key=${a.id}><td><button class="ov-link" onClick=${() => onOpen(a.id)}>${a.title}</button><div class="ov-dim">${chanLabel(a.channel)} ${a.format}, v${vtotal(a)}</div></td>
          ${F.map(([k]) => html`<td key=${k}>${k !== 'cta' ? html`<textarea class="st-ta" rows=${k === 'caption' ? 3 : 2} disabled=${ro || (a.locks || {})[k]} value=${val(a, k)} onInput=${e => setDraft(Object.assign({}, draft, { [key(a, k)]: e.target.value }))} onBlur=${() => save(a, k)} aria-label=${k + ' of ' + a.title}></textarea>` : html`<input class="st-in" disabled=${ro || (a.locks || {})[k]} value=${val(a, k)} onInput=${e => setDraft(Object.assign({}, draft, { [key(a, k)]: e.target.value }))} onBlur=${() => save(a, k)} aria-label=${k + ' of ' + a.title} />`}${k === 'caption' ? html`<div class=${'ov-dim' + (val(a, k).length > max ? ' st-over' : '')}>${val(a, k).length} of ${max}</div>` : null}</td>`)}
          <td>${flags.length ? flags.slice(0, 4).map((c, i) => html`<div key=${i}><${Chip} kind=${CHECK_KIND[c.state] || 'warn'}>${CHECK_WORD[c.state] || c.state}</${Chip}> <span class="ov-dim">${c.text}</span></div>`) : html`<${Chip} kind="ok">clean</${Chip}>`}</td></tr>`; })}
      </tbody></table></div></div>`;
  }
  function DirectionsView({ p, onChoose, onMore, busy, head, prov }) {
    const noClaude = prov && prov.claude === false;
    const choose = d => { if (p.assets.length && !window.confirm('Produce a new set from "' + d.title + '"? The ' + p.assets.length + ' asset' + (p.assets.length === 1 ? '' : 's') + ' already made stay as they are; this writes new ones (model calls, and renders unless the brief says no imagery).')) return; onChoose(d.id); };
    return html`<div class="st-centre-pad">
      <${StageHead} ...${head}>${canWrite() && !p.readOnly && !p.directions.length ? html`<button class="btn sm" disabled=${!!busy || noClaude} onClick=${() => onMore(3)}>Propose three directions</button>` : null}</${StageHead}>
      <div class="ov-why">Genuinely different directions for an open brief, three by default: each with its idea, copy approach, medium, composition, type and colour, the references it draws on and the images it would need. Diversity is measured, not claimed. Choosing one starts production from it.</div>
      ${(() => { const ev = p.thread.filter(e => e.kind === 'directions' && e.diversity != null).pop(); return ev ? html`<div class="ov-dim">Last set: diversity ${ev.diversity} (1 = nothing in common between the directions; under 0.5 they repeat each other).</div>` : null; })()}
      ${!p.directions.length ? html`<div class="ov-empty">No directions yet.</div>` : null}
      <div class="st-dirs">${p.directions.map((d, i) => html`<div key=${d.id} class=${'st-dir' + (d.chosen ? ' chosen' : '')}>
        <div class="st-dir-title">${String.fromCharCode(65 + i)}) ${d.title}${d.chosen ? html`<${Chip} kind="ok">chosen</${Chip}>` : d.similar ? html`<${Chip} kind="warn" title=${'reads close to ' + d.similar}>close to ${d.similar}</${Chip}>` : null}</div>
        <div class="st-dir-h">${d.headline}</div>
        <div class="st-dir-line"><b>Message</b> ${d.message}</div>
        <div class="st-dir-line"><b>Insight</b> ${d.insight}</div>
        <div class="st-dir-line"><b>Opening</b> ${d.opening}</div>
        <div class="st-dir-line"><b>Visual</b> ${d.visual}</div>
        <div class="st-dir-line"><b>Why</b> ${d.rationale}</div>
        ${d.idea ? html`<div class="st-dir-line"><b>Idea</b> ${d.idea}</div>` : null}${d.copyApproach ? html`<div class="st-dir-line"><b>Copy</b> ${d.copyApproach}</div>` : null}
        ${d.medium || d.composition ? html`<div class="st-dir-line"><b>Medium</b> ${d.medium ? html`<${Chip}>${d.medium}</${Chip}> ` : null}${d.composition}${d.typography ? '; type: ' + d.typography : ''}${d.colour ? '; colour: ' + d.colour : ''}</div>` : null}
        ${(d.references || []).length ? html`<div class="st-dir-line"><b>Draws on</b> ${d.references.join(', ')}</div>` : null}
        ${(d.plan || []).length ? html`<div class="st-dir-line"><b>Plan</b> ${d.plan.join(' / ')} <${Chip} kind=${d.renders ? 'warn' : 'ok'}>${d.renders ? d.renders + ' render' + (d.renders === 1 ? '' : 's') + ' per asset' : 'no render'}</${Chip}></div>` : null}
        <div class="st-dir-line"><b>Claims</b> ${(d.claims || []).join(', ') || 'none'} <span class="ov-dim">${d.uncertainty}</span></div>
        <div class="ov-dim">${d.model || ''}${d.who && d.who !== 'studio' ? ', recorded by ' + d.who : ''}</div>
        ${canWrite() && !p.readOnly && !d.chosen ? html`<button class="btn sm" disabled=${!!busy || noClaude} title=${noClaude ? 'Claude is not configured on the worker' : ''} onClick=${() => choose(d)}>Choose this direction</button>` : null}
      </div>`)}</div>
      ${canWrite() && !p.readOnly ? html`<div class="st-pad"><label class="ov-dim">Explore <select class="st-sel" id="st-dir-n" aria-label="Exploration budget" defaultValue="3">${[1, 2, 3, 4, 5].map(n => html`<option key=${n} value=${n}>${n} direction${n === 1 ? '' : 's'}</option>`)}</select></label> <button class="btn sm ghost" disabled=${!!busy || noClaude} onClick=${() => onMore(+((document.getElementById('st-dir-n') || {}).value || 3))}>Explore further</button> <span class="ov-dim">One model call; nothing is produced until you choose.</span></div>` : null}
    </div>`;
  }
  function ContextView({ p, onVoice, onLearned, tick }) {
    const [c, setC] = useState(undefined); const [idn, setIdn] = useState(null);
    useEffect(() => { let live = true; call('/studio/identity?ns=' + encodeURIComponent(p.ns)).then(d => { if (live) setIdn(d); }).catch(e => { if (live) setIdn({ error: e.message }); }); return () => { live = false; }; }, [p.ns, tick]);
    useEffect(() => { let live = true; setC(undefined); call('/studio/context?project=' + encodeURIComponent(p.id)).then(d => { if (live) setC(d); }).catch(e => { if (live) setC({ error: e.message }); }); return () => { live = false; }; }, [p.id, p.revision, tick]);
    if (c === undefined) return html`<div class="st-centre-pad"><div class="ov-empty">Reading what the Studio knows about ${p.ns}...</div></div>`;
    if (c.error) return html`<div class="st-centre-pad"><div class="ov-empty">${c.error}</div></div>`;
    return html`<div class="st-centre-pad"><div class="ov-sechead"><span class="ov-title">What the Studio knows about ${c.client}</span>${canWrite() ? html`<span style=${{ marginLeft: 'auto', display: 'flex', gap: 6 }}><button class="btn sm ghost" onClick=${onVoice}>Edit voice profile</button><button class="btn sm ghost" onClick=${onLearned}>Learned rules (${c.learned.length})</button></span>` : null}</div>
      <div class="ov-why">${c.note}</div>
      <div class="st-ctx">
        <${Lbl}>Brand kit</${Lbl}><div>${c.kit.name || 'no kit saved'}${c.kit.updated ? ', updated ' + aest(c.kit.updated) : ''}; ${c.kit.hasLogo ? 'logo on file (placed exactly, never redrawn)' : 'no logo on file'}; fonts ${c.kit.fonts.display || '-'} / ${c.kit.fonts.body || '-'}.</div>
        ${c.kit.voice ? html`<${Lbl}>Voice</${Lbl}><div>${c.kit.voice}</div>` : null}
        <${Lbl}>Mandatory rules (kit)</${Lbl}>${c.kit.rules.length ? html`<ul class="st-ul">${c.kit.rules.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>` : html`<div class="ov-dim">none recorded</div>`}
        <${Lbl}>Learned corrections in force (${c.learned.length})</${Lbl}>${c.learned.length ? html`<ul class="st-ul">${c.learned.map(f => html`<li key=${f.id}>${f.rule} <span class="ov-dim">${f.task}, ${f.scope === 'campaign' ? 'campaign ' + f.campaign : f.scope}${f.who ? ', taught by ' + f.who : ''}</span></li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Approved facts (${c.facts.length}) - the only figures besides the sources</${Lbl}>${c.facts.length ? html`<ul class="st-ul">${c.facts.map(f => html`<li key=${f.id}>${f.text}${f.source ? html` <span class="ov-dim">(${f.source})</span>` : null}${f.campaign ? html` <${Chip}>${f.campaign}</${Chip}>` : null}</li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Never use (${c.banned.length})</${Lbl}>${c.banned.length ? html`<ul class="st-ul">${c.banned.map((b, i) => html`<li key=${i}>"${b.term}"${b.use ? ' - say "' + b.use + '"' : ''}${b.allowNegated ? ' (allowed inside a denial)' : ''}${b.why ? html` <span class="ov-dim">${b.why}</span>` : null}</li>`)}</ul>` : html`<div class="ov-dim">none</div>`}
        <${Lbl}>Campaign</${Lbl}><div>${c.campaign ? c.campaign.name + (c.campaign.signoff ? ' - sign-off "' + c.campaign.signoff + '"' : '') + (c.campaign.tone ? '; tone: ' + c.campaign.tone : '') : 'no campaign on this project'}${c.campaigns.length ? html` <span class="ov-dim">(${c.campaigns.length} in the kit)</span>` : null}</div>
        <${Lbl}>Creative shelf and examples</${Lbl}><div>${c.shelf.error ? c.shelf.error : c.shelf.docs + ' document' + (c.shelf.docs === 1 ? '' : 's') + ' on the ' + c.ns + '_creative shelf near this brief, ' + (c.shelf.examples || 0) + ' approved examples retrieved. Nothing from any other client.'}</div>
        <${Lbl}>Campaign identity: what is on file</${Lbl}>${!idn ? html`<div class="ov-dim">Reading the identity audit...</div>` : idn.error ? html`<div class="ov-dim">${idn.error}</div>` : html`<div class="st-identity"><table class="ov-table"><thead><tr><th>Campaign</th><th>Mark policy</th><th>Client logo</th><th>Wordmark</th><th>References</th><th>Placement</th><th>Gaps</th></tr></thead><tbody>${idn.campaigns.map(k => html`<tr key=${k.id} class=${k.id === p.campaign ? 'hot' : ''}><td><b>${k.name}</b>${k.identity ? html`<div class="ov-dim">${k.identity}</div>` : null}</td><td>${k.policy}</td><td>${k.policy === 'logo' || k.policy === 'both' ? (k.logo.onFile ? 'on file' : html`<${Chip} kind="bad">missing</${Chip}>`) : html`<span class="ov-dim">not used</span>`}</td><td>${k.policy === 'wordmark' || k.policy === 'both' ? (k.wordmark.onFile ? 'on file' : html`<${Chip} kind="bad">missing</${Chip}>`) : k.wordmark.onFile ? 'on file (not used)' : html`<span class="ov-dim">-</span>`}</td><td>${k.references.total}${k.references.total ? html`<div class="ov-dim">${Object.keys(k.references.byPurpose).map(x => x + ' ' + k.references.byPurpose[x]).join(', ')}</div>` : null}</td><td class="ov-dim">${k.placement.basis === 'observed' ? k.placement.text : 'default (bottom right)'}</td><td class="ov-dim">${k.gaps.join('; ') || '-'}</td></tr>`)}</tbody></table><div class="ov-dim">${idn.note}</div></div>`}
        <${Lbl}>Models</${Lbl}><div>directions and copy: ${c.models.creative}; extraction: ${c.models.extract}; images: ${c.models.image}. Reachability is checked by /studio/models, never assumed.</div>
      </div>
    </div>`;
  }
  /* ------------------------------------------------------------ the Brand Workspace: what the Studio knows, where it came from, what is missing */
  const AUTH_KIND = { rule: 'ok', observation: '', preference: '', decision: '', inference: 'warn' };
  const AUTH_TITLE = { rule: 'an approved rule: it binds', observation: 'seen in a reference: it informs, it does not bind', preference: 'a recorded preference: followed unless a rule says otherwise', decision: 'a decision on a project: it applies where it was made unless kept wider', inference: 'inferred by a model: it never binds until a person keeps it' };
  function KnowRow({ i, onHistory, extra }) {
    return html`<li class=${'st-know' + (i.status === 'retired' ? ' retired' : '')}>
      <div class="st-know-h"><${Chip} kind=${AUTH_KIND[i.authority] || ''} title=${AUTH_TITLE[i.authority] || ''}>${i.authorityWord || i.authority}</${Chip}> <${Chip}>${i.scope === 'campaign' ? 'campaign ' + i.campaign : 'whole client'}</${Chip}>${i.status !== 'active' ? html` <${Chip} kind=${i.status === 'proposed' ? 'warn' : ''}>${i.status}</${Chip}>` : null} <b>${i.title || i.kind}</b>${i.rev > 1 ? html` <span class="ov-dim">rev ${i.rev}</span>` : null}</div>
      ${i.body ? html`<div>${i.body}</div>` : null}
      <div class="ov-dim">${i.source && i.source.label ? 'from ' + i.source.label : i.source && i.source.type ? 'from ' + i.source.type : ''}${i.who ? ', ' + i.who : ''}${i.updated || i.created ? ', ' + aest(i.updated || i.created) : ''}${onHistory && i.native ? html` <button class="ov-link" onClick=${() => onHistory(i)}>history</button>` : null}</div>
      ${extra || null}
    </li>`;
  }
  const fileB64 = f => new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1] || ''); rd.onerror = () => rej(new Error('could not read the file')); rd.readAsDataURL(f); });
  function MarkThumb({ url, label }) {
    const [src, setSrc] = useState(null); const [err, setErr] = useState('');
    useEffect(() => { let live = true; if (!url) return; blobUrl(url).then(u => { if (live) setSrc(u); }).catch(e => { if (live) setErr(e.message || 'did not load'); }); return () => { live = false; }; }, [url]);
    return html`<div class="st-mark" aria-label=${label}>${src ? html`<div class="st-mark-grounds"><span class="g light"><img src=${src} alt=${label} /></span><span class="g dark"><img src=${src} alt="" /></span></div>` : html`<div class="ov-dim">${err ? 'did not load: ' + err : 'loading...'}</div>`}</div>`;
  }
  function BrandView({ p, tick }) {
    const [camp, setCamp] = useState(p.campaign || ''); const [ws, setWs] = useState(undefined); const [n, setN] = useState(0);
    const [hist, setHist] = useState(null); const [busy, setBusy] = useState(''); const [up, setUp] = useState({ variant: '', tone: 'light', def: false, file: null });
    const [add, setAdd] = useState(null); const [dismiss, setDismiss] = useState({}); const [keep, setKeep] = useState({});
    useEffect(() => { let live = true; setWs(undefined); call('/brand/workspace?ns=' + encodeURIComponent(p.ns) + (camp ? '&campaign=' + encodeURIComponent(camp) : '')).then(d => { if (live) setWs(d); }).catch(e => { if (live) setWs({ error: e.message }); }); return () => { live = false; }; }, [p.ns, camp, n, tick]);
    const again = () => setN(x => x + 1);
    const act = async (label, fn) => { setBusy(label); try { await fn(); again(); } catch (e) { toastMsg(label + ': ' + e.message, true); } finally { setBusy(''); } };
    const openHistory = i => call('/brand/item/history?ns=' + encodeURIComponent(p.ns) + '&id=' + encodeURIComponent(i.id)).then(setHist).catch(e => toastMsg(e.message, true));
    if (ws === undefined) return html`<div class="st-centre-pad"><div class="ov-empty">Reading the ${p.ns} brand workspace...</div></div>`;
    if (ws.error) return html`<div class="st-centre-pad"><div class="ov-empty">${ws.detail || ws.error}</div></div>`;
    const rd = ws.readiness, id = ws.identity, rw = canWrite();
    const proposals = ws.items.filter(i => i.status === 'proposed').concat(ws.words.items.filter(i => i.status === 'proposed'));
    const upload = () => act('Wordmark variant not saved', async () => {
      if (!camp) throw new Error('choose the campaign the wordmark belongs to');
      if (!up.file || !up.variant.trim()) throw new Error('choose the file and name the variant (e.g. white)');
      await call('/brand/kit', { ns: p.ns, wordmarkCampaign: camp, wordmarkVariant: up.variant.trim(), wordmarkTone: up.tone, wordmarkDefault: up.def, wordmarkB64: await fileB64(up.file), wordmarkMime: up.file.type || 'image/png' });
      toastMsg('Saved the ' + up.variant.trim() + ' variant exactly as supplied (a new version; earlier versions stay on file)'); setUp({ variant: '', tone: 'light', def: false, file: null });
    });
    const RDY = { ready: 'ok', gaps: 'warn', blocked: 'bad' };
    const issueList = (list, kind) => list.map((x, k) => html`<li key=${kind + k}><${Chip} kind=${kind === 'blocking' ? 'bad' : kind === 'conflict' ? 'bad' : kind === 'gap' ? 'warn' : ''}>${kind}</${Chip}> ${x.text}${x.fix ? html`<div class="ov-dim">${x.fix}</div>` : null}</li>`);
    return html`<div class="st-centre-pad st-brand" aria-label="Brand workspace">
      <div class="ov-sechead"><span class="ov-title">Brand workspace: ${ws.client}</span>
        <label class="ov-dim" style=${{ marginLeft: 'auto' }}>Scope <select class="st-sel" value=${camp} onChange=${e => setCamp(e.target.value)} aria-label="Campaign scope"><option value="">whole client</option>${ws.campaigns.map(c => html`<option key=${c.id} value=${c.id}>${c.name}${c.active ? '' : ' (inactive)'}</option>`)}</select></label></div>
      <div class="ov-why">${ws.note}</div>
      <div class="st-brand-auth">${ws.authorities.map(a => html`<span key=${a.id}><${Chip} kind=${AUTH_KIND[a.id] || ''} title=${AUTH_TITLE[a.id]}>${a.word}</${Chip}> ${ws.counts[a.id] || 0}</span>`)}</div>

      <section class="st-brand-sec" aria-label="Brand readiness"><${Lbl}>Readiness ${ws.campaign ? 'for ' + ws.campaign.name : 'for the client'}</${Lbl}>
        <div><${Chip} kind=${RDY[rd.state]}>${rd.state === 'ready' ? 'ready to produce' : rd.state === 'blocked' ? 'blocked: production would be incomplete' : 'ready, with gaps to close'}</${Chip}></div>
        ${rd.blocking.length + rd.conflicts.length + rd.gaps.length + rd.outdated.length ? html`<ul class="st-ul">${issueList(rd.blocking, 'blocking')}${issueList(rd.conflicts, 'conflict')}${issueList(rd.gaps, 'gap')}${issueList(rd.outdated, 'review')}</ul>` : html`<div class="ov-dim">Nothing missing, conflicting or out of date.</div>`}
      </section>

      ${proposals.length ? html`<section class="st-brand-sec" aria-label="Proposed memory updates"><${Lbl}>Proposed memory updates (${proposals.length}) - none applies until a person keeps it</${Lbl}>
        <ul class="st-ul st-know-list">${proposals.map(i => html`<${KnowRow} key=${i.id} i=${i} onHistory=${openHistory} extra=${rw && i.native ? html`<div class="st-know-acts">
          <select class="st-sel" value=${(keep[i.id] || {}).authority || 'preference'} onChange=${e => setKeep(Object.assign({}, keep, { [i.id]: Object.assign({}, keep[i.id], { authority: e.target.value }) }))} aria-label="Keep as"><option value="preference">keep as a preference</option><option value="decision">keep as a project decision</option><option value="rule">keep as an approved rule</option><option value="observation">keep as an observation</option></select>
          <select class="st-sel" value=${(keep[i.id] || {}).scope || (camp ? 'campaign' : 'client')} onChange=${e => setKeep(Object.assign({}, keep, { [i.id]: Object.assign({}, keep[i.id], { scope: e.target.value }) }))} aria-label="Scope">${camp ? html`<option value="campaign">for ${ws.campaign.name}</option>` : null}<option value="client">for the whole client</option></select>
          <button class="btn sm" disabled=${!!busy} onClick=${() => act('Not kept', () => { const k = keep[i.id] || {}; return call('/brand/item/review', { ns: p.ns, id: i.id, decision: 'keep', authority: k.authority || 'preference', scope: k.scope || (camp ? 'campaign' : 'client'), campaign: camp || i.campaign }); })}>Keep</button>
          <input class="st-in" placeholder="why dismiss (required)" value=${dismiss[i.id] || ''} onInput=${e => setDismiss(Object.assign({}, dismiss, { [i.id]: e.target.value }))} aria-label="Reason to dismiss" />
          <button class="btn sm ghost" disabled=${!!busy || !(dismiss[i.id] || '').trim()} onClick=${() => act('Not dismissed', () => call('/brand/item/review', { ns: p.ns, id: i.id, decision: 'dismiss', reason: dismiss[i.id] }))}>Dismiss</button></div>` : null} />`)}</ul></section>` : null}

      <section class="st-brand-sec" aria-label="Identity"><${Lbl}>Identity and marks${ws.campaign ? ': mark policy ' + id.policy : ''}</${Lbl}>
        ${ws.campaign && id.policy !== 'logo' && id.policy !== 'both' ? html`<div class="ov-dim">${ws.campaign.name} does not carry the ${ws.client} logo${id.policy === 'none' ? ' or any mark' : '; it carries its own wordmark'}. Format never decides identity: a myth-busting tile in this campaign still carries this campaign's mark.</div>` : null}
        <div class="st-marks">
          <div class="st-markcard"><b>Client logo</b><div class="st-know-h">${id.logo.required ? html`<${Chip} kind=${id.logo.onFile ? 'ok' : 'bad'}>${id.logo.onFile ? 'required, on file' : 'required, missing'}</${Chip}>` : id.logo.forbidden ? html`<${Chip}>not used on this campaign</${Chip}>` : null}</div>
            ${id.logo.onFile ? html`<${MarkThumb} url=${id.logo.url} label="Client logo" /><div class="ov-dim">version ${id.logo.v || 'unversioned'}${id.logo.versions.length > 1 ? ', ' + id.logo.versions.length + ' versions on file (approved work keeps the one it carried)' : ''}</div>` : html`<div class="ov-dim">no logo file${id.logo.kitSays ? ' (the kit says there is one; storage has none)' : ''}</div>`}</div>
          ${ws.campaign ? id.wordmark.variants.map(v => html`<div key=${v.variant} class="st-markcard"><b>${ws.campaign.name} wordmark: ${v.variant}</b><div class="st-know-h"><${Chip} kind=${v.onFile ? 'ok' : 'bad'}>${v.tone}</${Chip}>${v.default ? html`<${Chip} kind="ok">default</${Chip}>` : null}</div>
            ${v.onFile ? html`<${MarkThumb} url=${v.url} label=${'Wordmark ' + v.variant} />` : html`<div class="ov-dim">file missing in storage</div>`}
            <div class="ov-dim">version ${v.v}${v.at ? ', ' + aest(v.at) : ''}${v.history.length ? '; ' + v.history.length + ' earlier version' + (v.history.length === 1 ? '' : 's') + ' kept' : ''}</div>
            ${rw && !v.default ? html`<button class="ov-link" disabled=${!!busy} onClick=${() => act('Default not changed', () => call('/brand/kit', { ns: p.ns, wordmarkCampaign: camp, wordmarkVariant: v.variant, wordmarkDefault: true }))}>make default</button>` : null}</div>`) : null}
          ${ws.campaign && id.wordmark.legacy ? html`<div class="st-markcard legacy"><b>${ws.campaign.name} wordmark: single upload slot</b><div class="st-know-h"><${Chip}>no name, no tone</${Chip}></div><${MarkThumb} url=${id.wordmark.legacy.url} label="Single-slot wordmark" /><div class="ov-dim">${id.wordmark.legacy.note}</div></div>` : null}
        </div>
        ${rw && ws.campaign ? html`<div class="st-upload" aria-label="Add a wordmark variant"><span class="st-lbl">Add an approved ${ws.campaign.name} wordmark variant</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange=${e => setUp(Object.assign({}, up, { file: e.target.files && e.target.files[0] }))} aria-label="Wordmark file" />
          <input class="st-in" placeholder="variant name, e.g. white" value=${up.variant} onInput=${e => setUp(Object.assign({}, up, { variant: e.target.value }))} aria-label="Variant name" />
          <select class="st-sel" value=${up.tone} onChange=${e => setUp(Object.assign({}, up, { tone: e.target.value }))} aria-label="Tone"><option value="light">light (for dark grounds)</option><option value="dark">dark (for light grounds)</option><option value="colour">colour</option></select>
          <label class="st-check"><input type="checkbox" checked=${up.def} onChange=${e => setUp(Object.assign({}, up, { def: e.target.checked }))} /> default</label>
          <button class="btn sm" disabled=${!!busy} onClick=${upload}>Save variant</button>
          <div class="ov-dim">Stored exactly as supplied under its own version; never redrawn. Uploading the same name again makes a new version and keeps the earlier one for work that carried it.</div></div>` : null}
      </section>

      <section class="st-brand-sec" aria-label="Type and colour"><${Lbl}>Typography and colour</${Lbl}>
        <div>Display <b>${ws.type.fonts.display || 'not set'}</b>, body <b>${ws.type.fonts.body || 'not set'}</b> <span class="ov-dim">(the renderer reports a fallback whenever a face does not load)</span></div>
        <div class="st-swatches">${Object.keys(ws.colour.palette).map(k => html`<span key=${k} class="st-swatch"><i style=${{ background: ws.colour.palette[k] }}></i>${k} ${ws.colour.palette[k]}</span>`)}</div>
        ${ws.type.note ? html`<div><${Chip} kind="ok" title=${AUTH_TITLE.rule}>approved rule</${Chip}> ${ws.type.note}</div>` : null}
      </section>

      <section class="st-brand-sec" aria-label="References"><${Lbl}>Design and imagery references (${ws.references.length})</${Lbl}>
        ${ws.references.length ? html`<ul class="st-ul st-know-list">${ws.references.map(r => html`<${KnowRow} key=${r.id} i=${Object.assign({}, r, { title: r.name + ' (' + r.purpose + ')' })} extra=${!r.analysed ? html`<div class="ov-dim">not analysed: the models read it by name only</div>` : null} />`)}</ul>` : html`<div class="ov-dim">No references ${ws.campaign ? 'for this campaign' : ''} on any project yet.</div>`}
        <div><b>Mark placement</b> ${ws.placement.basis === 'observed' ? html`<${Chip} title=${AUTH_TITLE.observation}>reference observation</${Chip}> ${ws.placement.text} <span class="ov-dim">(${ws.placement.supporting.map(x => x.name).join(', ')})</span>` : html`<span class="ov-dim">not observed in an approved reference; the house default (bottom right) applies and the Studio may move the mark to clear words</span>`}</div>
        ${ws.artworks.length ? html`<div class="ov-dim">${ws.artworks.length} catalogued artwork${ws.artworks.length === 1 ? '' : 's'} in the client's artwork memory${ws.campaign ? ' for this campaign or unassigned' : ''}.</div>` : null}
      </section>

      <section class="st-brand-sec" aria-label="Voice and words"><${Lbl}>Voice, wording and claims</${Lbl}>
        <ul class="st-ul st-know-list">${ws.voice.items.map(i => html`<${KnowRow} key=${i.id} i=${i} />`)}${ws.words.items.map(i => html`<${KnowRow} key=${i.id} i=${Object.assign({}, i, { title: i.kind === 'banned' ? 'Never use "' + i.title + '"' : i.title })} />`)}</ul>
        ${ws.words.excludedFacts ? html`<div class="ov-dim">${ws.words.excludedFacts} fact${ws.words.excludedFacts === 1 ? ' belongs' : 's belong'} to another campaign and ${ws.words.excludedFacts === 1 ? 'is' : 'are'} not used here.</div>` : null}
      </section>

      <section class="st-brand-sec" aria-label="Preferences and decisions"><${Lbl}>Preferences, decisions and accepted or rejected work</${Lbl}>
        <ul class="st-ul st-know-list">${ws.items.filter(i => i.status !== 'proposed').map(i => html`<${KnowRow} key=${i.id} i=${i} onHistory=${openHistory} extra=${rw ? html`<div class="st-know-acts"><button class="ov-link" disabled=${!!busy} onClick=${() => act('Not retired', () => call('/brand/item/update', { ns: p.ns, id: i.id, status: 'retired', why: 'retired from the Brand workspace' }))}>retire</button></div>` : null} />`)}${ws.preferences.map(i => html`<${KnowRow} key=${i.id} i=${i} />`)}${ws.accepted.map(i => html`<${KnowRow} key=${i.id} i=${i} />`)}</ul>
        ${!ws.items.length && !ws.preferences.length && !ws.accepted.length ? html`<div class="ov-dim">Nothing recorded yet.</div>` : null}
        ${rw ? (add ? html`<div class="st-offer-box" aria-label="Add knowledge"><div class="st-nd-row">
            <select class="st-sel" value=${add.kind} onChange=${e => setAdd(Object.assign({}, add, { kind: e.target.value }))} aria-label="Kind">${['like', 'dislike', 'device', 'placement', 'term', 'typography', 'colour', 'imagery', 'voice', 'note'].map(k => html`<option key=${k} value=${k}>${k}</option>`)}</select>
            <select class="st-sel" value=${add.authority} onChange=${e => setAdd(Object.assign({}, add, { authority: e.target.value }))} aria-label="Authority"><option value="rule">approved rule</option><option value="preference">preference</option><option value="decision">project decision</option><option value="observation">reference observation</option></select>
            <select class="st-sel" value=${add.scope} onChange=${e => setAdd(Object.assign({}, add, { scope: e.target.value }))} aria-label="Scope">${camp ? html`<option value="campaign">${ws.campaign.name}</option>` : null}<option value="client">whole client</option></select></div>
          <input class="st-in" placeholder="Title" value=${add.title} onInput=${e => setAdd(Object.assign({}, add, { title: e.target.value }))} aria-label="Title" />
          <textarea class="st-ta" rows="2" placeholder="What it says, in the client's terms" value=${add.body} onInput=${e => setAdd(Object.assign({}, add, { body: e.target.value }))} aria-label="Body"></textarea>
          <input class="st-in" placeholder="Where it comes from (a guide, a meeting, an approved file)" value=${add.source} onInput=${e => setAdd(Object.assign({}, add, { source: e.target.value }))} aria-label="Source" />
          <div><button class="btn sm" disabled=${!!busy || !(add.title.trim() || add.body.trim())} onClick=${() => act('Not saved', async () => { await call('/brand/item', { ns: p.ns, kind: add.kind, authority: add.authority, campaign: add.scope === 'campaign' ? camp : '', title: add.title, body: add.body, source: { type: 'team', label: add.source || 'the team' } }); setAdd(null); })}>Save</button> <button class="btn sm ghost" onClick=${() => setAdd(null)}>Cancel</button></div></div>`
          : html`<button class="btn sm ghost" onClick=${() => setAdd({ kind: 'like', authority: 'preference', scope: camp ? 'campaign' : 'client', title: '', body: '', source: '' })}>Add knowledge</button>`) : null}
      </section>

      <section class="st-brand-sec" aria-label="Kit history"><${Lbl}>Kit history</${Lbl}>
        ${ws.revisions.length ? html`<ul class="st-ul">${ws.revisions.slice(0, 15).map(r => html`<li key=${r.id}><span class="ov-dim">${aest(r.at)}${r.who ? ', ' + r.who : ''}:</span> ${r.summary.join('; ')}</li>`)}</ul>` : html`<div class="ov-dim">No recorded changes yet.</div>`}
      </section>
      ${hist ? html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="Item history" onClick=${() => setHist(null)}><div class="st-dialog-box" onClick=${e => e.stopPropagation()}><div class="ov-sechead"><span class="ov-title">${hist.item.title || hist.item.kind}: history</span></div>
        <ul class="st-ul">${hist.revisions.map(r => html`<li key=${r.rev + ':' + r.at}><b>rev ${r.rev}</b> <span class="ov-dim">${aest(r.at)}${r.who ? ', ' + r.who : ''}</span> - ${r.why}<div class="ov-dim">${r.data.authority} / ${r.data.status} / ${r.data.campaign ? 'campaign ' + r.data.campaign : 'whole client'}: ${r.data.body || r.data.title}</div></li>`)}</ul>
        <div class="st-dialog-acts"><button class="btn sm ghost" onClick=${() => setHist(null)}>Close</button></div></div></div>` : null}
    </div>`;
  }
  /** What the Studio used to make this version: references, rules, facts, marks, models, assumptions. Fetched when opened. */
  /** The compiled instructions behind a version: per job, exactly what each model call was sent (read from the worker's record). */
  function CompiledList({ list }) {
    const [open, setOpen] = useState(null); const [d, setD] = useState({});
    const load = async j => { setOpen(open === j ? null : j); if (d[j]) return; try { const x = await call('/studio/compiled?job=' + encodeURIComponent(j)); setD(s => Object.assign({}, s, { [j]: x })); } catch (e) { setD(s => Object.assign({}, s, { [j]: { error: e.message } })); } };
    if (!list.length) return html`<div class="ov-dim"><b>Compiled instructions</b> none recorded for this version (made by hand, or before build studio-p21).</div>`;
    return html`<div class="st-compiled" aria-label="Compiled instructions"><b>Compiled instructions</b> ${list.map(c => html`<button key=${c.job} class="ov-link" onClick=${() => load(c.job)}>${c.why} (${c.stage}${c.recorded ? ', ' + c.calls + ' call' + (c.calls === 1 ? '' : 's') : ', not recorded'})</button> `)}
      ${open && d[open] ? (x => x.error ? html`<div class="ov-dim">${x.error}</div>` : !(x.calls || []).length ? html`<div class="ov-dim">${x.note || 'No call recorded.'}</div>` : html`<div class="st-compiled-calls">${x.calls.map((c, i) => html`<div key=${i} class="st-compiled-call">
        <div><b>${c.provider === 'google' ? 'Image model' : 'Language model'}</b> ${c.op || ''} - asked ${c.model}${c.answered && c.answered !== c.model ? ', answered by ' + c.answered : ''}${c.fallback ? ' (fallback)' : ''}${c.effort ? ', effort ' + c.effort : ''}${c.thinking && c.thinking !== 'off' ? ', thinking ' + c.thinking : ''}${c.imageConfig && c.imageConfig.imageSize ? ', size ' + c.imageConfig.imageSize + (c.capped ? ' (asked ' + c.capped + ', capped)' : '') : ''}${c.historyTurns ? ', ' + c.historyTurns + ' earlier turns ' + (c.historyReplayed ? 'replayed' : 'not replayed') : ''}${c.error ? html` <${Chip} kind="bad">${c.error}</${Chip}>` : null}</div>
        ${c.plain ? html`<div class="ov-dim">${c.plain}</div>` : null}${c.areaNote ? html`<div class="ov-dim">${c.areaNote}</div>` : null}
        ${(c.images || []).length ? html`<div class="ov-dim">Images sent: ${c.images.map(im => (im.name || im.role || 'image') + (im.kb ? ' (' + im.kb + ' KB' + (im.prepared ? ', prepared copy' : '') + ')' : im.role && im.name ? ' - ' + im.role : '')).join('; ')}</div>` : null}
        ${c.system ? html`<details><summary class="ov-link">system (${c.system.length} characters)</summary><pre class="st-pre">${c.system}</pre></details>` : null}
        <details><summary class="ov-link">${c.provider === 'google' ? 'prompt' : 'user'} (${(c.user || c.text || '').length} characters)</summary><pre class="st-pre">${c.user || c.text || ''}</pre></details>
      </div>`)}</div>`)(d[open]) : null}
    </div>`;
  }
  function UsedPanel({ a, v }) {
    const [open, setOpen] = useState(false); const [u, setU] = useState(null);
    useEffect(() => { if (!open) return; let live = true; setU(null); call('/studio/used?asset=' + encodeURIComponent(a.id) + '&version=' + encodeURIComponent(v.id)).then(d => { if (live) setU(d); }).catch(e => { if (live) setU({ error: e.message }); }); return () => { live = false; }; }, [open, a.id, v.id]);
    const refLine = r => r.name + (r.purpose ? ' (' + r.purpose + ')' : '');
    return html`<details class="st-used" open=${open} onToggle=${e => setOpen(e.target.open)}><summary>What the Studio used</summary>
      ${!open ? null : !u ? html`<div class="ov-dim">Reading...</div>` : u.error ? html`<div class="ov-dim">${u.error}</div>` : html`<div class="st-used-body">
        <div class="ov-dim">${u.note}</div>
        ${u.generatedBy ? html`<div><b>Words and plan</b> made as version ${vnum(a, a.versions.find(x => x.id === u.generatedBy.version) || {})} (${u.generatedBy.note})${u.models.text ? ' by ' + u.models.text : ''}${u.concept ? ' from the ' + u.concept.mode + ' card "' + u.concept.option + '"' : ''}.</div>` : html`<div><b>Words and plan</b> <span class="ov-dim">not generated by the Studio (an import or a hand-made layout)</span></div>`}
        ${u.imagery ? html`<div><b>Imagery</b> rendered as version ${vnum(a, a.versions.find(x => x.id === u.imagery.version) || {})} by ${u.imagery.model || 'the image model'}${u.imagery.size ? ' at ' + u.imagery.size : ''}${u.imagery.pixels ? ' (' + u.imagery.pixels.w + 'x' + u.imagery.pixels.h + ' px received)' : ''}${u.imagery.fallback ? ', a fallback model' : ''}; ${u.imagery.references.length ? 'reference images given: ' + u.imagery.references.join(', ') : 'no reference images'}.${u.imagery.prompt ? html` <span class="ov-dim">Brief: ${u.imagery.prompt}</span>` : null}</div>` : html`<div><b>Imagery</b> <span class="ov-dim">none rendered for this composition</span></div>`}
        ${u.editsSince.length ? html`<div class="ov-dim">Then ${u.editsSince.length} hand edit${u.editsSince.length === 1 ? '' : 's'}: ${u.editsSince.map(e => e.note).join('; ')}.</div>` : null}
        <div><b>References</b> ${u.references ? html`${u.references.mode}: ${u.references.attached.length ? 'shown as images: ' + u.references.attached.map(refLine).join(', ') + '. ' : ''}${u.references.read.length ? 'read by analysis: ' + u.references.read.map(refLine).join(', ') + '. ' : ''}${!u.references.attached.length && !u.references.read.length ? 'none reached the model. ' : ''}${u.references.excluded.length ? html`<span class="ov-dim">Left out: ${u.references.excluded.map(x => x.name + ' (' + x.why + ')').join('; ')}.</span>` : null}` : html`<span class="ov-dim">no reference pack recorded</span>`}</div>
        <div><b>Rules applied</b> ${u.rules.length ? html`<ul class="st-ul">${u.rules.map(r => html`<li key=${r.id}>${r.rule} <span class="ov-dim">${r.task || ''}${r.campaign ? ', campaign ' + r.campaign : ''}${r.activeNow ? '' : ', since switched off'}</span></li>`)}</ul>` : html`<span class="ov-dim">no learned corrections were in force</span>`}</div>
        <div><b>Knowledge</b> ${u.facts != null ? u.facts + ' approved fact' + (u.facts === 1 ? '' : 's') : 'facts not recorded'}, ${u.banned != null ? u.banned + ' banned term' + (u.banned === 1 ? '' : 's') : ''}${u.campaign ? ', campaign ' + u.campaign : ''}${u.kit.revision ? html`; the kit as revised ${aest(u.kit.revision.at)} <span class="ov-dim">(${u.kit.revision.summary.slice(0, 3).join('; ')})</span>` : ''}.</div>
        <div><b>Marks</b> ${u.marks.length ? u.marks.map(m => m.role + (m.variant ? ' ' + m.variant : '') + (m.version ? ' v' + m.version : '') + (m.hidden ? ' (hidden)' : '')).join(', ') + ' - placed exactly from the file' : html`<span class="ov-dim">none on the tile</span>`}</div>
        ${(u.concept && (u.concept.influence || []).length) ? html`<div><b>Reference influence</b> ${u.concept.influence.map(x => x.component + ' from ' + x.name + (x.outsideRecipe ? ' (outside the recipe)' : '')).join('; ')}</div>` : null}
        <${CompiledList} list=${u.compiled || []} />
        ${u.assumptions.length ? html`<div><b>Assumptions</b> ${u.assumptions.join('; ')}${u.acknowledged ? ' (gaps acknowledged before producing)' : ''}</div>` : null}
      </div>`}</details>`;
  }
  /* ------------------------------------------------------------ client review: private links out, comments in, resolved by version */
  /* ------------------------------------------------------------ Review: one table of every asset's approvals, then the client's review */
  const TECH_SHORT = { passed: 'passed', failed: 'failing', stale: 'stale', not_validated: 'not validated', not_applicable: 'n/a' };
  function ReviewStage({ p, onApprove, onOpen, head, onGo, flow }) {
    const rw = canWrite() && !p.readOnly;
    const cell = (a, part) => { const v = current(a); const ap = standing(a, part); const copyOnly = v && v.mode === 'copy';
      if (part === 'design' && copyOnly) return html`<span class="ov-dim">copy only</span>`;
      const blocked = part === 'design' && (!a.readiness || (a.readiness.technical !== 'passed' && a.readiness.technical !== 'not_applicable')) ? 'Design approval waits for a passing validation of this exact version: open it in Refine to measure it.' : part === 'design' && v && v.layout && (v.layout.incomplete || []).length ? 'The campaign mark is not on file.' : '';
      return ap ? html`<span><${Chip} kind="ok">approved</${Chip}> <span class="ov-dim">v${vnum(a, a.versions.find(x => x.id === ap.version) || {})} by ${ap.by}${ap.carried ? ', unchanged since' : ''}</span>${rw ? html` <button class="ov-link" onClick=${() => onApprove(a, part, 'withdraw')}>withdraw</button>` : null}</span>`
        : rw ? html`<span class="st-apcell"><button class="btn sm ghost" disabled=${!!blocked} title=${blocked} onClick=${() => onApprove(a, part, 'approve')} aria-label=${'Approve ' + part + ' of ' + a.title}>Approve ${part}</button>${blocked ? html`<span class="ov-dim">${blocked}</span>` : null}</span>` : html`<span class="ov-dim">not approved</span>`; };
    return html`<div class="st-centre-pad st-reviewstage">
      <${StageHead} ...${head}>${flow.counts.ready ? html`<button class="btn sm" onClick=${() => onGo('export')}>Continue to Export (${flow.counts.ready} ready)</button>` : null}</${StageHead}>
      <div class="ov-why">Approval is a person's decision about one exact version: it stands while that version is current, and an edit drops the approval of the part it changes. The art director's verdict is advice and never approves.</div>
      ${!p.assets.length ? html`<div class="st-empty-state"><b>Nothing to review yet.</b><span>Produce the set first.</span><button class="btn sm" onClick=${() => onGo('produce')}>Go to Produce</button></div>` : html`<table class="ov-table st-approvals" aria-label="Approvals"><thead><tr><th>Asset</th><th>Version</th><th>Validation</th><th>Copy</th><th>Design</th></tr></thead><tbody>
        ${p.assets.map(a => { const v = current(a); const t = v && (v.mode === 'copy' || v.mode === 'generated') ? 'not_applicable' : (a.readiness || {}).technical || 'not_validated'; return html`<tr key=${a.id}><td><button class="st-lib-open" onClick=${() => onOpen(a.id)}>${a.title}</button><div class="ov-dim">${chanLabel(a.channel)} ${a.format}</div></td><td>v${vnum(a, v)} <span class="ov-dim">of ${vtotal(a)}</span></td><td><${Chip} kind=${TECH_KIND[t] || ''}>${TECH_SHORT[t] || t}</${Chip}></td><td>${cell(a, 'copy')}</td><td>${cell(a, 'design')}</td></tr>`; })}
      </tbody></table>`}
      ${p.assets.length ? html`<${ReviewView} p=${p} onOpen=${onOpen} />` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ Export: what will be in the bundle, and what is in it once made */
  function ExportView({ p, head, flow, state, onExport, onClickup, onGo }) {
    const rows = p.assets.map(a => { const v = current(a); const c = standing(a, 'copy'), d = standing(a, 'design'); const copyOnly = v && v.mode === 'copy'; const tech = (a.readiness || {}).technical; const valid = copyOnly || (v && v.mode === 'generated') || tech === 'passed'; return { a, v, c, d, valid, tech, ok: !!(c && (d || copyOnly) && valid), partly: !!(c || d) }; });
    const ready = rows.filter(x => x.ok); const busy = state && state.busy;
    return html`<div class="st-centre-pad st-exportstage" aria-label="Export">
      <${StageHead} ...${head}>${ready.length ? html`<button class="btn sm" disabled=${busy} onClick=${() => onExport(ready)}>${busy ? 'Preparing...' : state && state.url ? 'Prepare again' : 'Prepare bundle (' + ready.length + ')'}</button>` : null}${state && state.url ? html`<a class="btn sm ghost" href=${state.url} download=${state.name}>Download ${state.name} (${Math.round(state.size / 1024)} KB)</a>` : null}</${StageHead}>
      <div class="ov-why">Only versions with both approvals and a passing validation go in, drawn at their native size by the same renderer as the preview, with a copy sheet and a manifest naming each exact version. Export sends nothing anywhere; a hand-off is its own step.</div>
      <table class="ov-table"><thead><tr><th>Asset</th><th>Version</th><th>Copy</th><th>Design</th><th>Validation</th><th>Export</th></tr></thead><tbody>${rows.map(x => html`<tr key=${x.a.id}><td>${x.a.title}<div class="ov-dim">${chanLabel(x.a.channel)} ${x.a.format}${x.v && x.v.layout && x.v.layout.stage ? ', ' + x.v.layout.stage.w + ' x ' + x.v.layout.stage.h + ' px' : ''}</div></td><td class="ov-dim">v${vnum(x.a, x.v)}</td><td>${x.c ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.v && x.v.mode === 'copy' ? html`<span class="ov-dim">copy only</span>` : x.d ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.valid ? html`<${Chip} kind="ok">${x.v && x.v.mode === 'copy' ? 'n/a' : 'passed'}</${Chip}>` : html`<${Chip} kind=${x.tech === 'failed' ? 'bad' : 'warn'}>${x.tech === 'failed' ? 'failing' : 'not validated'}</${Chip}>`}</td><td>${x.ok ? html`<${Chip} kind="ok">included</${Chip}>` : html`<span class="ov-dim">left out${x.c && (x.d || (x.v && x.v.mode === 'copy')) && !x.valid ? ' (approved, but ' + (x.tech === 'failed' ? 'its validation fails' : 'not validated') + ')' : x.partly ? ' (partly approved)' : ' (not approved)'}</span>`}</td></tr>`)}</tbody></table>
      ${!ready.length && p.assets.length ? html`<div class="st-empty-state"><b>Nothing is ready to export.</b><span>An asset goes in once its copy and design are approved and its current version passes validation.</span><button class="btn sm" onClick=${() => onGo('review')}>Go to Review</button></div>` : null}
      ${state && state.msg ? html`<div class=${'st-export-msg' + (state.error ? ' bad' : '')} role="status">${state.msg}</div>` : null}
      ${state && state.files ? html`<table class="ov-table st-export-files" aria-label="Files in the bundle"><thead><tr><th>File</th><th class="num">Size</th><th>Pixels</th></tr></thead><tbody>${state.files.map(f => html`<tr key=${f.name}><td>${f.name}</td><td class="num">${Math.max(1, Math.round(f.bytes / 1024))} KB</td><td>${f.w ? html`${f.w} x ${f.h}${f.want ? (f.w === f.want.w && f.h === f.want.h ? html` <${Chip} kind="ok">native size</${Chip}>` : html` <${Chip} kind="bad">expected ${f.want.w} x ${f.want.h}</${Chip}>`) : null}` : html`<span class="ov-dim">-</span>`}</td></tr>`)}</tbody></table>` : null}
      ${ready.length ? html`<div class="st-pad"><button class="btn sm ghost" disabled=${!canWrite()} onClick=${() => onClickup(ready)}>Send to ClickUp...</button> <span class="ov-dim">a separate, confirmed step: one task per asset with the approved copy</span></div>` : null}
    </div>`;
  }
  function reviewLink(token) {
    const page = new URL('review.html', location.href); const base = (window.csBase ? window.csBase() : '') || '';
    return page.origin + page.pathname + '#t=' + encodeURIComponent(token) + (base ? '&w=' + encodeURIComponent(base) : '');
  }
  function ReviewView({ p, onOpen }) {
    const [shares, setShares] = useState(null); const [rows, setRows] = useState(null); const [n, setN] = useState(0);
    const [form, setForm] = useState(null); const [made, setMade] = useState(null); const [busy, setBusy] = useState(''); const [notes, setNotes] = useState({});
    useEffect(() => { let live = true; Promise.all([call('/studio/shares?project=' + encodeURIComponent(p.id)), call('/studio/review?project=' + encodeURIComponent(p.id))]).then(([s, r]) => { if (live) { setShares(s.shares); setRows(r.review); } }).catch(e => { if (live) { setShares([]); setRows([]); toastMsg(e.message, true); } }); return () => { live = false; }; }, [p.id, p.revision, n]);
    const again = () => setN(x => x + 1); const rw = canWrite();
    const act = async (label, fn) => { setBusy(label); try { await fn(); again(); } catch (e) { toastMsg(label + ': ' + e.message, true); } finally { setBusy(''); } };
    const ready = a => { const v = current(a); return v && (v.mode === 'copy' || (a.readiness && a.readiness.technical === 'passed')); };
    const why = a => { const v = current(a); return !v ? 'no version' : a.readiness && a.readiness.technical === 'failed' ? 'technical validation failing' : 'not validated yet - open it so the Studio measures it'; };
    const assetOf = id => p.assets.find(a => a.id === id);
    const create = () => act('Not shared', async () => { const r = await call('/studio/share', { project: p.id, assets: Object.keys(form.assets).filter(k => form.assets[k]), label: form.label, expiresDays: +form.days, allowApprove: form.approve }); setMade({ link: reviewLink(r.token), share: r.share }); setForm(null); });
    if (shares === null) return html`<div class="st-centre-pad"><div class="ov-empty">Reading the review links...</div></div>`;
    const open = (rows || []).filter(r => r.status === 'open' && r.kind !== 'approve');
    return html`<div class="st-centre-pad st-review" aria-label="Client review">
      <div class="ov-sechead"><span class="ov-title">Client review</span>${rw && !form ? html`<button class="btn sm" style=${{ marginLeft: 'auto' }} onClick=${() => { setMade(null); setForm({ assets: {}, label: p.title + ' - review', days: '14', approve: true }); }}>Share for review</button>` : null}</div>
      <div class="ov-why">A private link per review: the client sees only the assets chosen, each as the exact validated export of its current version, and never the thread, notes, checks or anything else. Links can expire and can be withdrawn; repeated wrong links lock the address out. The link is shown once.</div>
      ${made ? html`<div class="st-offer-box" aria-label="New review link"><b>Link for "${made.share.label}"</b> <span class="ov-dim">shown once - copy it now</span><input class="st-in" readonly value=${made.link} onFocus=${e => e.target.select()} aria-label="Review link" /><div><button class="btn sm" onClick=${() => { try { navigator.clipboard.writeText(made.link); toastMsg('Link copied'); } catch (e) {} }}>Copy link</button> <button class="btn sm ghost" onClick=${() => setMade(null)}>Done</button></div></div>` : null}
      ${form ? html`<div class="st-offer-box" aria-label="Share for review">
        <div class="st-lbl">Assets the client will see</div>
        ${p.assets.map(a => html`<label key=${a.id} class="st-check"><input type="checkbox" disabled=${!ready(a)} checked=${!!form.assets[a.id]} onChange=${e => setForm(Object.assign({}, form, { assets: Object.assign({}, form.assets, { [a.id]: e.target.checked }) }))} /> ${a.title} <span class="ov-dim">${a.format}, v${vtotal(a)}${ready(a) ? '' : ' - ' + why(a)}</span></label>`)}
        <input class="st-in" value=${form.label} onInput=${e => setForm(Object.assign({}, form, { label: e.target.value }))} aria-label="Review label" />
        <div class="st-nd-row"><label class="ov-dim">Expires <select class="st-sel" value=${form.days} onChange=${e => setForm(Object.assign({}, form, { days: e.target.value }))} aria-label="Expiry"><option value="7">in 7 days</option><option value="14">in 14 days</option><option value="30">in 30 days</option><option value="0">never (withdraw by hand)</option></select></label>
          <label class="st-check"><input type="checkbox" checked=${form.approve} onChange=${e => setForm(Object.assign({}, form, { approve: e.target.checked }))} /> the client may approve (after the agency has)</label></div>
        <div><button class="btn sm" disabled=${!!busy || !Object.values(form.assets).some(Boolean)} onClick=${create}>Create the link</button> <button class="btn sm ghost" onClick=${() => setForm(null)}>Cancel</button></div></div>` : null}
      <${Lbl}>Links (${shares.length})</${Lbl}>
      ${shares.length ? html`<table class="ov-table"><thead><tr><th>Review</th><th>Assets</th><th>State</th><th>Seen</th><th></th></tr></thead><tbody>${shares.map(s => html`<tr key=${s.id}><td><b>${s.label}</b><div class="ov-dim">by ${s.createdBy || '-'}, ${aest(s.created)}${s.allowApprove ? ', client may approve' : ', comments only'}</div></td><td>${s.assets.map(id => (assetOf(id) || {}).title || id).join(', ')}</td><td><${Chip} kind=${s.state === 'active' ? 'ok' : ''}>${s.state}</${Chip}>${s.expires ? html`<div class="ov-dim">${s.state === 'expired' ? 'expired' : 'until'} ${aest(s.expires)}</div>` : html`<div class="ov-dim">no expiry</div>`}</td><td class="ov-dim">${s.views ? s.views + ' view' + (s.views === 1 ? '' : 's') + ', last ' + aest(s.lastSeen) : 'not opened'}</td><td>${rw && s.state === 'active' ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => act('Not withdrawn', () => call('/studio/share/revoke', { project: p.id, id: s.id }))}>Withdraw</button>` : null}</td></tr>`)}</tbody></table>` : html`<div class="ov-dim">No review links yet.</div>`}
      <${Lbl}>Client comments (${open.length} open of ${(rows || []).filter(r => r.kind !== 'approve').length})</${Lbl}>
      ${Array.from(new Set((rows || []).map(r => r.asset))).map(aid => { const a = assetOf(aid); if (!a) return null; const list = rows.filter(r => r.asset === aid); const cur = current(a); const pinned = list.filter(r => r.pin);
        return html`<div key=${aid} class="st-review-asset"><div><div class="st-review-thumb"><${Composition} v=${cur} a=${a} ns=${p.ns} size="card" />${pinned.map(r => html`<span key=${r.id} class=${'st-pin' + (r.status === 'resolved' ? ' resolved' : '')} style=${{ left: r.pin.x + '%', top: r.pin.y + '%' }}>${list.indexOf(r) + 1}</span>`)}</div><div class="ov-dim">pins were placed on the version the client saw; the thumbnail is the current version</div></div>
          <div><b>${a.title}</b> <button class="ov-link" onClick=${() => onOpen(a.id)}>open</button>
          <ol class="st-review-list">${list.map(r => html`<li key=${r.id}><${Chip} kind=${r.kind === 'approve' ? 'ok' : r.kind === 'changes' ? 'warn' : ''}>${r.kind === 'approve' ? 'client approval' : r.kind === 'changes' ? 'changes requested' : 'comment'}</${Chip}> ${r.text || ''} <span class="ov-dim">- ${r.author} (name as given), on v${vnum(a, a.versions.find(x => x.id === r.version) || {})}, ${aest(r.created)}</span>
            ${r.kind === 'approve' ? (r.version === a.current ? html` <${Chip} kind="ok">stands: current version</${Chip}>` : html` <${Chip}>of an earlier version</${Chip}>`) : r.status === 'resolved' ? html` <${Chip} kind="ok">${r.resolvedVersion ? 'addressed in v' + vnum(a, a.versions.find(x => x.id === r.resolvedVersion) || {}) : 'answered'}</${Chip}>${r.resolvedNote ? html` <span class="ov-dim">${r.resolvedNote}</span>` : null}`
              : rw ? html`<div class="st-know-acts"><input class="st-in" placeholder="note for the client" value=${notes[r.id] || ''} onInput=${e => setNotes(Object.assign({}, notes, { [r.id]: e.target.value }))} aria-label="Resolution note" />${cur && cur.id !== r.version ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => act('Not resolved', () => call('/studio/review/resolve', { project: p.id, id: r.id, version: cur.id, note: notes[r.id] || '' }))}>Addressed in v${vnum(a, cur)}</button>` : html`<span class="ov-dim">make the change as a new version, then mark it addressed</span>`}<button class="btn sm ghost" disabled=${!!busy || !(notes[r.id] || '').trim()} onClick=${() => act('Not answered', () => call('/studio/review/resolve', { project: p.id, id: r.id, decision: 'wontfix', note: notes[r.id] }))}>Answer without a change</button></div>` : null}</li>`)}</ol></div></div>`; })}
      ${!(rows || []).length ? html`<div class="ov-dim">No client comments yet.</div>` : null}
    </div>`;
  }
  /* Production: recipes (a saved order of stages, each waiting for the one before), what an upstream change made stale with
     its remedy and whether it costs a call, and what the project has actually spent. No node graph: a list, in order. */
  const RECIPE_STAGE = { extract: { label: 'Read the latest source', input: { source: '$latestSource' } }, strategy: { label: 'Draft the strategy', input: {} }, direct: { label: 'Propose three directions', input: { n: 3 } }, sequence: { label: 'Plan a four-asset sequence (no images)', input: { count: 4, channels: '$briefChannels' } }, copy: { label: 'Write and lay out a set (renders imagery)', input: { channels: '$briefChannels', deliverable: 'set' } }, export: { label: 'Package what the client approved', input: { requireClient: true } } };
  const REMEDY = { recheck: 'Re-check (no model call)', measure: 'Open to measure again (no model call)', share: 'Share the current version again', revise: 'Revise to the confirmed strategy (one model call)', readapt: 'Re-adapt from the master (one model call)' };
  /** What each operation can and cannot do on this worker, as the worker states it; reachability is the models probe. */
  function CapabilitiesPanel() {
    const [c, setC] = useState(null);
    useEffect(() => { let live = true; call('/studio/capabilities').then(d => { if (live) setC(d); }).catch(e => { if (live) setC({ error: e.message }); }); return () => { live = false; }; }, []);
    return html`<div class="st-caps" aria-label="Capabilities"><${Lbl}>What each operation can do here</${Lbl}>
      ${!c ? html`<div class="ov-dim">Reading...</div>` : c.error ? html`<div class="ov-dim">Capabilities unavailable: ${c.error}</div>` : html`
      <table class="ov-table"><thead><tr><th>Operation</th><th>Model</th><th>Takes</th><th>Cannot</th><th>Shown how</th></tr></thead><tbody>${c.operations.map(o => html`<tr key=${o.op}><td><b>${o.op}</b><div class="ov-dim">${o.what}</div></td><td>${o.model || o.provider}${o.fallbacks ? html`<div class="ov-dim">then ${o.fallbacks.join(', ')}</div>` : null}${o.configured ? '' : html` <${Chip} kind="warn">not configured</${Chip}>`}</td><td class="ov-dim">${Object.keys(o.accepts || {}).map(k => k + ': ' + (Array.isArray(o.accepts[k]) ? o.accepts[k].join(', ') : o.accepts[k])).join('; ')}</td><td class="ov-dim">${(o.cannot || []).join('; ') || '-'}</td><td class="ov-dim">${o.verified}</td></tr>`)}</tbody></table>
      <div class="ov-dim">Pixel masks: ${c.masks ? 'supported' : 'not supported - area edits are described in words and measured afterwards'}. ${c.note}</div>`}
    </div>`;
  }
  function ProductionView({ p, onRun, onOpen, onReview, onRevise }) {
    const [lib, setLib] = useState(null); const [imp, setImp] = useState(null); const [use, setUse] = useState(null); const [est, setEst] = useState({}); const [n, setN] = useState(0);
    const [busy, setBusy] = useState(''); const [form, setForm] = useState(null); const [done, setDone] = useState({}); const rw = canWrite() && !p.readOnly;
    useEffect(() => { let live = true; Promise.all([call('/studio/recipes?ns=' + encodeURIComponent(p.ns)), call('/studio/impact?project=' + encodeURIComponent(p.id)), call('/studio/usage?project=' + encodeURIComponent(p.id))]).then(([r, i, u]) => { if (live) { setLib(r); setImp(i); setUse(u); } }).catch(e => { if (live) { setLib({ builtin: [], recipes: [] }); setImp({ assets: [] }); setUse(null); toastMsg(e.message, true); } }); return () => { live = false; }; }, [p.id, p.revision, n]);
    const again = () => setN(x => x + 1);
    const estimate = async (id) => { try { const d = await call('/studio/recipe/estimate?project=' + encodeURIComponent(p.id) + '&recipe=' + encodeURIComponent(id)); setEst(s => Object.assign({}, s, { [id]: d })); return d; } catch (e) { setEst(s => Object.assign({}, s, { [id]: { error: e.message } })); return null; } };
    const run = async (rc) => {
      setBusy('run:' + rc.id);
      try {
        const e = est[rc.id] && !est[rc.id].error ? est[rc.id] : await estimate(rc.id); if (!e) return;
        if (e.missing && e.missing.length) { toastMsg('Cannot run: ' + e.missing.join('; '), true); return; }
        // anything that renders is said out loud first: images and calls, as an estimate
        if (e.renders > 0 && !window.confirm('"' + rc.name + '" would generate about ' + e.renders + ' image' + (e.renders === 1 ? '' : 's') + ' and ' + e.calls + ' model call' + (e.calls === 1 ? '' : 's') + ' (an estimate; a plan with several image regions renders more). Run it?')) return;
        const r = await call('/studio/recipe/run', { project: p.id, recipe: rc.id, confirm: e.renders > 0 ? true : undefined });
        toastMsg('Recipe started: ' + r.jobs.length + ' step' + (r.jobs.length === 1 ? '' : 's') + ', each waiting for the one before'); await onRun(r); again();
      } catch (e) { toastMsg(e.message, true); } finally { setBusy(''); }
    };
    const save = async () => { setBusy('save'); try { await call('/studio/recipe', { ns: p.ns, name: form.name, campaign: form.campaignOnly ? p.campaign : '', note: form.note, steps: form.steps.map(s => ({ stage: s, input: RECIPE_STAGE[s].input, label: RECIPE_STAGE[s].label })) }); toastMsg('Recipe saved for ' + p.ns.toUpperCase()); setForm(null); again(); } catch (e) { toastMsg(e.message, true); } finally { setBusy(''); } };
    const remedy = async (x, r) => {
      const key = x.asset + ':' + r.code; setBusy(key);
      try {
        if (r.remedy === 'recheck') { const d = await call('/studio/recheck', { asset: x.asset }); const flags = (d.checks || []).filter(c => ['matches', 'fact'].indexOf(c.state) < 0); setDone(s => Object.assign({}, s, { [key]: flags.length ? 'Re-checked: ' + flags.map(c => c.state + ' ' + c.text).join('; ') + '. Rewrite only if this matters (one model call).' : 'Re-checked: clean against the kit as it is now. No rewrite needed.' })); again(); }
        else if (r.remedy === 'measure') onOpen(x.asset);
        else if (r.remedy === 'share') onReview();
        else if (window.confirm(REMEDY[r.remedy] + ' for "' + x.title + '"?' + (x.locks.length ? ' Locked fields (' + x.locks.join(', ') + ') stay as they are.' : ''))) { await onRevise(x, r); again(); }
      } catch (e) { toastMsg(e.message, true); } finally { setBusy(''); }
    };
    if (!lib) return html`<div class="st-centre-pad"><div class="ov-empty">Reading recipes, impact and usage...</div></div>`;
    const all = (lib.builtin || []).map(r => Object.assign({ builtin: true }, r)).concat((lib.recipes || []).filter(r => !r.campaign || r.campaign === p.campaign));
    return html`<div class="st-centre-pad st-prod" aria-label="Production">
      <div class="ov-sechead"><span class="ov-title">Production</span></div>
      <div class="ov-why">A recipe is a saved order of stages. Each step waits for the one before; if one fails the rest stop and say why. Estimates come before anything renders, and actual usage is counted from the jobs afterwards.</div>
      <${Lbl}>Needs attention (${(imp.assets || []).length})</${Lbl}>
      ${(imp.assets || []).length ? html`<table class="ov-table" aria-label="Impact"><thead><tr><th>Asset</th><th>What changed</th><th>Remedy</th></tr></thead><tbody>${imp.assets.map(x => x.reasons.map((r, i) => html`<tr key=${x.asset + r.code}>${i === 0 ? html`<td rowSpan=${x.reasons.length}><button class="ov-link" onClick=${() => onOpen(x.asset)}>${x.title}</button>${x.locks.length ? html`<div class="ov-dim">locked: ${x.locks.join(', ')}</div>` : null}</td>` : null}<td>${r.text}${done[x.asset + ':' + r.code] ? html`<div class="ov-dim st-prod-done">${done[x.asset + ':' + r.code]}</div>` : null}</td><td>${rw || r.remedy === 'measure' ? html`<button class=${'btn sm' + (r.paid ? '' : ' ghost')} disabled=${!!busy} onClick=${() => remedy(x, r)}>${REMEDY[r.remedy] || r.remedy}</button>` : null} <${Chip} kind=${r.paid ? 'warn' : 'ok'}>${r.paid ? 'paid' : 'free'}</${Chip}>${r.then ? html`<div class="ov-dim">then: ${r.then}</div>` : null}</td></tr>`))}</tbody></table>` : html`<div class="ov-dim">Nothing is stale: no kit, strategy, master or measurement change since these versions were made.</div>`}
      <${Lbl}>Recipes</${Lbl}>
      <table class="ov-table" aria-label="Recipes"><thead><tr><th>Recipe</th><th>Steps</th><th>Estimate</th><th></th></tr></thead><tbody>${all.map(rc => { const e = est[rc.id]; return html`<tr key=${rc.id}><td><b>${rc.name}</b>${rc.builtin ? html` <${Chip}>built in</${Chip}>` : html` <${Chip}>${rc.campaign ? rc.campaign + ' only' : p.ns.toUpperCase()}</${Chip}>`}${rc.note ? html`<div class="ov-dim">${rc.note}</div>` : null}</td><td><ol class="st-prod-steps">${(rc.steps || []).map((s, i) => html`<li key=${i}>${s.label || (RECIPE_STAGE[s.stage] || {}).label || s.stage}</li>`)}</ol></td>
        <td>${!e ? html`<button class="ov-link" onClick=${() => estimate(rc.id)}>estimate</button>` : e.error ? html`<span class="ov-dim">${e.error}</span>` : html`<span class="st-prod-est">${e.calls} call${e.calls === 1 ? '' : 's'}, ${e.renders} image${e.renders === 1 ? '' : 's'}</span>${e.missing && e.missing.length ? html`<div class="ov-dim">cannot run: ${e.missing.join('; ')}</div>` : null}`}</td>
        <td>${rw ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => run(rc)}>${busy === 'run:' + rc.id ? 'Starting...' : 'Run'}</button>` : null}</td></tr>`; })}</tbody></table>
      ${rw && !form ? html`<button class="btn sm ghost" onClick=${() => setForm({ name: '', steps: ['strategy', 'direct'], note: '', campaignOnly: !!p.campaign })}>Save a recipe for ${p.ns.toUpperCase()}</button>` : null}
      ${form ? html`<div class="st-offer-box" aria-label="New recipe">
        <input class="st-in" placeholder="Recipe name" value=${form.name} onInput=${e => setForm(Object.assign({}, form, { name: e.target.value }))} aria-label="Recipe name" />
        <ol class="st-prod-steps">${form.steps.map((s, i) => html`<li key=${i}>${RECIPE_STAGE[s].label} <button class="ov-link" onClick=${() => setForm(Object.assign({}, form, { steps: form.steps.filter((x, j) => j !== i) }))}>remove</button></li>`)}</ol>
        <div class="st-nd-row"><select class="st-sel" value="" onChange=${e => { if (e.target.value) setForm(Object.assign({}, form, { steps: form.steps.concat(e.target.value).slice(0, 8) })); }} aria-label="Add a step"><option value="">add a step...</option>${Object.keys(RECIPE_STAGE).map(k => html`<option key=${k} value=${k}>${RECIPE_STAGE[k].label}</option>`)}</select>
          ${p.campaign ? html`<label class="st-check"><input type="checkbox" checked=${form.campaignOnly} onChange=${e => setForm(Object.assign({}, form, { campaignOnly: e.target.checked }))} /> ${p.campaign} only</label>` : null}</div>
        <input class="st-in" placeholder="Note (optional)" value=${form.note} onInput=${e => setForm(Object.assign({}, form, { note: e.target.value }))} aria-label="Recipe note" />
        <div><button class="btn sm" disabled=${!!busy || !form.name.trim() || !form.steps.length} onClick=${save}>Save the recipe</button> <button class="btn sm ghost" onClick=${() => setForm(null)}>Cancel</button></div></div>` : null}
      <${Lbl}>Usage on this project</${Lbl}>
      ${use ? html`<div class="sen-strip st-prod-use" aria-label="Usage"><span><b>${use.calls}</b> model call${use.calls === 1 ? '' : 's'}</span><span><b>${use.renders}</b> image${use.renders === 1 ? '' : 's'}${Object.keys(use.sizes || {}).length ? ' (' + Object.keys(use.sizes).map(k => use.sizes[k] + ' at ' + k).join(', ') + ')' : ''}</span><span><b>${use.versions.free}</b> free versions</span><span><b>${use.failed}</b> failed</span><span><b>${use.queued}</b> waiting</span></div>
        <table class="ov-table"><thead><tr><th>Stage</th><th class="num">Done</th><th class="num">Failed</th><th class="num">Waiting</th><th class="num">Model calls</th></tr></thead><tbody>${Object.keys(use.byStage || {}).map(k => { const s = use.byStage[k]; return html`<tr key=${k}><td>${k}</td><td class="num">${s.done}</td><td class="num">${s.failed}</td><td class="num">${s.queued}</td><td class="num">${k === 'render' ? '-' : s.calls}</td></tr>`; })}</tbody></table>
        <div class="ov-dim">${use.note}</div>` : html`<div class="ov-dim">Usage unavailable.</div>`}
      <${CapabilitiesPanel} />
    </div>`;
  }
  function JobsView({ p, onRetry, onCancel, onStep, budget }) {
    const jobs = (p.jobs || []).slice();
    const asset = id => (p.assets.find(x => x.id === id) || {}).title || (id ? id : '-');
    return html`<div class="st-jobs">
      <div class="ov-why">Every generation is a persistent job: claimed with a lease, one stage at a time, stepped by this browser while the tab is open and finished by the worker's tick otherwise. A transient provider failure is tried again up to three times; then it fails here with a Retry. No invented percentages. ${RUN_NOTE}${budget ? ' Model calls today: ' + budget.used + ' of ' + budget.cap + '.' : ''}</div>
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
  /* ------------------------------------------------------------ art direction: the re-render area as an art director */
  /** Suggested next directions: specific, editable instructions the worker drew from this tile, its references and the recent feedback. */
  function Suggestions({ kind, sugg, onUse, onRefresh, busy, compact }) {
    const d = sugg && sugg.data; const items = d && Array.isArray(d[kind]) ? d[kind] : [];
    const title = kind === 'image' ? 'Suggested photographs' : kind === 'typography' ? 'Suggested type changes' : kind === 'copy' ? 'Suggested copy changes' : kind === 'concept' ? 'Concepts worth exploring' : 'Suggested next directions';
    return html`<div class=${'st-sugg ' + kind + (compact ? ' compact' : '')} aria-label=${title}>
      <div class="st-sugg-head"><${Lbl}>${title}</${Lbl}><span class="ov-dim">${sugg && sugg.loading ? 'thinking...' : d ? (d.cached ? 'from the last look' : 'fresh') + (d.imageSeen ? ', the artwork seen' : '') + ((d.refsUsed || []).length ? ', ' + d.refsUsed.length + ' reference' + (d.refsUsed.length === 1 ? '' : 's') : '') : ''}</span>${onRefresh && sugg && !sugg.idle ? html`<button class="ov-link" disabled=${!!busy || sugg.loading} onClick=${() => onRefresh(true)} title="Ask again for this version: one model call">refresh</button>` : null}</div>
      ${sugg && sugg.idle && onRefresh ? html`<div><button class="btn sm ghost" disabled=${!!busy} onClick=${() => onRefresh(false)} title="One small model call for this version (none when an answer for it is already cached); nothing is applied until you choose">Suggest for this version (1 model call)</button></div>` : null}
      ${sugg && sugg.err ? html`<div class="ov-dim">Suggestions unavailable: ${sugg.err}</div>` : null}
      ${d && !items.length && !sugg.loading ? html`<div class="ov-dim">Nothing suggested for this version.</div>` : null}
      ${items.map((s, i) => html`<div key=${i} class="st-sugg-item"><div class="st-sugg-text">${s.text}</div>${s.basis || s.changes || s.preserves || s.paid != null ? html`<div class="st-sugg-meta">${s.basis ? html`<${Chip} kind=${s.basis === 'rule' ? 'ok' : s.basis === 'inferred' ? 'warn' : ''}>${s.basis}</${Chip}>` : null}${s.changes ? html` <span class="ov-dim">changes ${s.changes}</span>` : null}${s.preserves ? html` <span class="ov-dim">keeps ${s.preserves}</span>` : null} <${Chip} kind=${s.paid ? 'warn' : 'ok'}>${s.paid ? 'needs a render' : 'no render'}</${Chip}></div>` : null}<div class="st-sugg-foot"><span class="ov-dim">${s.why}${(s.refs || []).length ? ' - from ' + s.refs.map(r => r.name).join(', ') : ''}</span><button class="ov-link" disabled=${!!busy} onClick=${() => onUse(s.text)}>${kind === 'image' ? 'use as the description' : 'use'}</button></div></div>`)}
      ${d && (d.unanalysed || []).length ? html`<div class="ov-dim">Not read: ${d.unanalysed.join('; ')}</div>` : null}
    </div>`;
  }
  function ArtDirection({ p, a, v, ro, busy, onPropose, onApply, onRender, rr, setRr, sugg, onSuggRefresh }) {
    const [fb, setFb] = useState(''); const [refining, setRefining] = useState(null); const [refineText, setRefineText] = useState(''); const [imgFrom, setImgFrom] = useState({});
    const [nd, setNd] = useState(null); // the Create-a-new-design form: {instruction, refs:{id:true}, keep:{imagery,copy,composition}}
    const ev = useMemo(() => p.thread.filter(e => e.kind === 'concepts' && e.asset === a.id).pop() || null, [p.thread, a.id]);
    const applied = useMemo(() => { const m = {}; p.thread.forEach(e => { if (e.kind === 'applied' && e.eid) m[e.eid + ':' + e.index] = e; }); return m; }, [p.thread]);
    const stale = ev && ev.version !== v.id;
    const withImage = ev ? ev.options.filter(o => o.needsImage) : [];
    const basisKind = b => b.kind === 'rule' ? 'ok' : b.kind === 'preference' || b.kind === 'reference' ? '' : 'warn';
    const basisTitle = b => b.kind === 'rule' ? 'a stated brand rule' : b.kind === 'preference' ? 'a recorded preference' : b.kind === 'reference' ? 'a project reference' : 'inferred by the model';
    // the life of a card: proposed or sketch, then queued, generating, generated, reviewed (inspected), approved - or failed
    const stateOf = o => { const ap = applied[ev.eid + ':' + o.i]; if (!ap) return o.renders ? 'sketch' : 'proposed'; const js = (ap.jobs || []).map(id => (p.jobs || []).find(j => j.id === id)).filter(Boolean); if (js.some(j => j.state === 'failed')) return 'failed'; if (js.some(j => j.state === 'running')) return 'generating'; if (js.some(j => j.state === 'queued')) return 'queued'; const as = p.assets.find(x => x.id === ap.asset); if (as && standing(as, 'design')) return 'approved'; if (js.length && p.thread.some(e => e.kind === 'inspection' && (ap.assets || [ap.asset]).indexOf(e.asset) >= 0 && e.id > ap.id)) return 'reviewed'; if (js.length) return 'generated'; return o.renders ? 'applied as a sketch' : 'applied'; };
    const STATE_KIND = { approved: 'ok', reviewed: 'ok', generated: 'ok', applied: 'ok', failed: 'bad', queued: 'warn', generating: 'warn' };
    const sizeKey = 'st_size_' + a.id; const remembered = (() => { try { return sessionStorage.getItem(sizeKey); } catch (e) { return null; } })();
    const [size, setSize0] = useState(remembered || (v.image && v.image.size) || ((p.brief || {}).size) || '2K');
    const setSize = x => { setSize0(x); try { sessionStorage.setItem(sizeKey, x); } catch (e) {} };
    useEffect(() => { let r = null; try { r = sessionStorage.getItem('st_size_' + a.id); } catch (e) {} setSize0(r || (v.image && v.image.size) || ((p.brief || {}).size) || '2K'); }, [a.id]);
    const refName = id => (p.references.find(r => r.id === id) || {}).name || id;
    return html`<div class="st-field st-ad"><div class="st-field-head"><${Lbl}>Art direction</${Lbl}><span class="ov-dim">concepts are sketched on the current imagery first; nothing is generated until you press Generate</span></div>
      ${!ro ? html`<div class="st-ad-ask">
        <input class="st-in" value=${fb} onInput=${e => setFb(e.target.value)} placeholder='Feedback or a brief for the art director (optional): "the fisher is covered", "more cinematic", "a myth / fact pair"' />
        <div class="st-ad-actions">
          <button class="btn sm ghost" disabled=${!!busy} title="Keep the idea, improve the finish in named ways" onClick=${() => onPropose(a, fb.trim() || 'Refine this design: keep the idea, improve the finish', null, { mode: 'refine', size })}>Refine this design</button>
          <button class="btn sm" disabled=${!!busy} title="Three visibly different interpretations of the same message" onClick=${() => onPropose(a, fb.trim() || 'Give me different variations', null, { mode: 'explore', size })}>Explore variations</button>
          <button class="btn sm ghost" disabled=${!!busy} title="Three different arrangements of this tile: the same photograph and the approved words, a different hierarchy, placement and panel treatment; no render" onClick=${() => onPropose(a, fb.trim() || 'Show me different layouts of this tile', null, { mode: 'layouts', size })}>Explore layouts (same image and copy)</button>
          <button class=${'btn sm ghost' + (nd ? ' on' : '')} disabled=${!!busy} title="A fresh visual concept from the brief and the campaign identity; the current panel and layout are not inherited" onClick=${() => setNd(nd ? null : { instruction: fb.trim(), refs: {}, refMode: 'recommended', keep: { imagery: false, copy: true, composition: false } })}>Create a new design</button>
        </div>
        <span class="ov-dim">one model call at high effort (a second only if two concepts would look alike); the artwork, the reference pack and the client's memory are shown to it; no render</span>
        <label class="ov-dim st-size">Generate at <select class="st-sel" value=${size} onChange=${e => setSize(e.target.value)} aria-label="Render resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option></select> <span class="ov-dim">${'applies to Generate on a concept and to re-rendering the imagery; proposing concepts costs no render'}</span></label>
      </div>` : null}
      ${nd ? html`<div class="st-offer-box st-newdesign" aria-label="Create a new design">
        <div class="ov-dim">A new design starts from the confirmed brief and the campaign identity. Mandatory campaign requirements (the mark, the colours, the approved facts) always carry forward; choose what else to retain.</div>
        <textarea class="st-ta" rows="2" value=${nd.instruction} onInput=${e => setNd(Object.assign({}, nd, { instruction: e.target.value }))} placeholder='What the new design should do, e.g. "A cinematic myth opener and a fact-response slide as a two-frame carousel" or "Typography-led, no photograph, the number does the work"' aria-label="New design instruction"></textarea>
        <div class="st-nd-row"><span class="st-lbl">Retain</span>${[['imagery', 'the current imagery'], ['copy', 'the current copy'], ['composition', 'the current composition']].map(([k, l]) => html`<label key=${k} class="st-check"><input type="checkbox" checked=${!!nd.keep[k]} onChange=${e => setNd(Object.assign({}, nd, { keep: Object.assign({}, nd.keep, { [k]: e.target.checked }) }))} /> ${l}</label>`)}</div>
        ${p.references.length ? html`<div class="st-nd-row"><span class="st-lbl">References</span>${[['recommended', 'recommended (brand and approved always; another campaign\'s left out)'], ['chosen', 'only the ones I choose'], ['none', 'use none']].map(([k, l]) => html`<label key=${k} class="st-check"><input type="radio" name="nd-refmode" checked=${nd.refMode === k} onChange=${() => setNd(Object.assign({}, nd, { refMode: k }))} /> ${l}</label>`)}</div>
          ${nd.refMode === 'chosen' ? html`<div class="st-nd-row"><span class="st-lbl">References to use</span>${p.references.map(r => html`<label key=${r.id} class="st-check"><input type="checkbox" checked=${!!nd.refs[r.id]} onChange=${e => setNd(Object.assign({}, nd, { refs: Object.assign({}, nd.refs, { [r.id]: e.target.checked }) }))} /> ${r.name} <span class="ov-dim">(${r.purpose}${r.campaign ? ', ' + r.campaign : ''}${r.analysis && !r.analysis.error ? '' : ', not analysed'})</span></label>`)}</div>` : null}` : html`<div class="ov-dim">No references on the project; the design works from the kit, the campaign identity and the client's artwork memory.</div>`}
        <div><button class="btn sm" disabled=${!!busy} onClick=${() => { onPropose(a, nd.instruction.trim() || 'Create a new design from the brief', null, { mode: 'new', refMode: nd.refMode, refs: nd.refMode === 'chosen' ? Object.keys(nd.refs).filter(k => nd.refs[k]) : undefined, keep: nd.keep, size }); setNd(null); }}>Propose the new design</button> <button class="btn sm ghost" onClick=${() => setNd(null)}>Cancel</button></div>
      </div>` : null}
      ${ev ? html`<div class="st-ad-crit"><b>${ev.mode === 'new' ? 'New design' : ev.mode === 'refine' ? 'Refinement' : ev.mode === 'layouts' ? 'Layouts' : 'Critique'}</b>${ev.mode === 'layouts' ? html` <span class="ov-dim">Same photograph and approved words in each; only the arrangement changes.</span>` : null} ${ev.critique}${ev.imageSeen ? '' : html` <span class="ov-dim">(the artwork was not shown to the model)</span>`}${(ev.refsUsed || []).length ? html` <span class="ov-dim">Read ${ev.refsUsed.filter(r => r.analysed).length} of ${ev.refsUsed.length} references${(ev.unanalysed || []).length ? ' (by name only: ' + ev.unanalysed.join('; ') + ')' : ''}.</span>` : null}${stale ? html` <${Chip} kind="warn">proposed against an earlier version</${Chip}>` : null}${ev.replanned ? html` <${Chip} title="two concepts would have looked alike; the model was asked once for replacements">${ev.replanned} replanned</${Chip}>` : null}</div>
        ${ev.refPack ? html`<div class="st-pack" aria-label="Reference pack"><${Lbl}>Reference pack (${ev.refPack.mode})</${Lbl}>
          <div class="st-pack-row">${(ev.refPack.attached || []).map(id => { const r = p.references.find(x => x.id === id); return r ? html`<span key=${id} class="st-pack-ref" title=${r.purpose + ': attached as an image'}><${RefThumb} r=${r} /><span>${r.name}</span><${Chip} kind="ok">${r.purpose}</${Chip}></span>` : null; })}${(ev.refPack.read || []).map(id => html`<span key=${id} class="st-pack-ref"><${Chip}>read</${Chip}> ${refName(id)}</span>`)}</div>
          ${(ev.refPack.excluded || []).length ? html`<div class="ov-dim">Left out: ${ev.refPack.excluded.map(x => x.name + ' (' + x.why + ')').join('; ')}</div>` : null}${(ev.refPack.unavailable || []).length ? html`<div class="ov-dim">No image to show the models: ${ev.refPack.unavailable.map(x => x.name + ' (' + x.why + ')').join('; ')}</div>` : null}${!(ev.refPack.attached || []).length && !(ev.refPack.read || []).length ? html`<div class="ov-dim">${ev.refPack.mode === 'none' ? 'No references, by the team\'s choice.' : 'No references reached the model.'}</div>` : null}
          ${ev.placement && ev.placement.basis === 'observed' ? html`<div class="ov-dim">Mark placement observed in approved references: ${ev.placement.text}</div>` : null}
        </div>` : null}
        <div class="st-ad-cards">${ev.options.map(o => { const ap = applied[ev.eid + ':' + o.i]; const src = imgFrom[o.i] != null && imgFrom[o.i] !== '' ? ev.options[imgFrom[o.i]] : null; const renders = src ? Math.max(1, src.renders || 1) : (o.renders || 0); const st = stateOf(o); const preview = o.layout && o.layout.frames ? Object.assign({}, o.layout.frames[0].layout, { frame: { index: 0, of: o.layout.frames.length } }) : o.layout; return html`<div key=${o.i} class=${'st-ad-card' + (ap ? ' applied' : '') + (o.similar ? ' similar' : '')}>
          <${Composition} v=${Object.assign({}, v, { layout: preview, copy: Object.assign({}, v.copy, o.copy || {}, o.layout && o.layout.frames ? o.layout.frames[0].copy : {}), image: o.approach === 'artwork' || (o.layout && o.layout.v === 5 && !((o.layout.regions || []).some(x => x.role === 'background' && /keep the current/i.test(x.prompt || '')))) ? null : v.image, mode: 'composition' })} a=${a} ns=${p.ns} size="card" />
          <div class="st-ad-name">${String.fromCharCode(65 + o.i)}) ${o.name} <${Chip} kind=${STATE_KIND[st] || ''}>${st}</${Chip}>${o.medium ? html` <${Chip} title="visual medium">${o.medium.replace('photo-', '')}</${Chip}>` : null}${o.approach === 'artwork' ? html` <${Chip} kind="warn" title="the image model paints the whole piece; the words become part of the bitmap">full artwork</${Chip}>` : null}${o.frames ? html` <${Chip}>${o.frames}-frame carousel</${Chip}>` : null}${o.similar ? html` <${Chip} kind="warn" title="measured on where the words and images sit, the medium and the approach">looks like ${o.similar}</${Chip}>` : null}${(o.kept || []).length ? html` <${Chip} kind="ok" title="what the team asked to retain, held in the plan">retained: ${o.kept.join(', ')}</${Chip}>` : null}${(o.setAside || []).length ? html` <${Chip} kind="warn" title=${'held out of this layout: ' + o.setAside.join('; ')}>set aside: ${o.setAside.length}</${Chip}>` : null}${o.fromCurrent != null ? html` <${Chip} title="how differently it draws from the current layout (0 the same, 1 entirely different), measured on where the words, panels and images sit">${Math.round(o.fromCurrent * 100)}% from current</${Chip}>` : null}${o.incomplete ? html` <${Chip} kind="bad" title=${o.incomplete.map(i => i.text).join('; ')}>incomplete: mark not on file</${Chip}>` : null}${o.markOverridden ? html` <${Chip} title="the campaign's logo policy is mandatory">mark set by the campaign policy</${Chip}>` : null}</div>
          <div class="st-ad-line">${o.concept}</div>
          ${o.summary ? html`<div class="st-ad-line st-ad-sum">${o.summary}</div>` : null}
          <div class="st-ad-line"><b>Why</b> ${o.rationale}</div>
          <div class="st-ad-line"><b>Imagery</b> ${o.imagery}</div>
          <div class="st-ad-line"><b>Composition</b> ${o.composition}</div>
          <div class="st-ad-line"><b>Type and colour</b> ${o.typography}${o.colour ? '; ' + o.colour : ''}</div>
          ${o.devices ? html`<div class="st-ad-line"><b>Devices</b> ${o.devices}</div>` : null}
          ${o.mark ? html`<div class="st-ad-line"><b>Mark</b> ${o.mark}</div>` : null}
          ${o.copy && o.copy.headline ? html`<div class="st-ad-line"><b>Headline</b> ${o.copy.headline}</div>` : null}
          <div class="st-ad-line"><b>Keeps</b> ${(o.keeps || []).join(', ') || '-'} <b>Changes</b> ${(o.changes || []).join(', ') || '-'}</div>
          ${(o.refs || []).length ? html`<div class="st-ad-line"><b>Draws on</b> ${o.refs.map(r => r.name).join(', ')}</div>` : null}
          ${(o.influence || []).length ? html`<div class="st-ad-line st-influence"><b>Influence</b> ${o.influence.map((x, i) => html`<${Chip} key=${i} kind=${x.outsideRecipe ? 'warn' : ''} title=${x.outsideRecipe || 'within the reference\'s recipe'}>${x.component} from ${x.name}${x.outsideRecipe ? ' (outside the recipe)' : ''}</${Chip}>`)}</div>` : null}
          <div class="st-ad-basis">${(o.basis || []).map((b, i) => html`<${Chip} key=${i} kind=${basisKind(b)} title=${basisTitle(b)}>${b.kind}${b.ref ? ' ' + b.ref : ''}: ${b.claim}</${Chip}>`)}${(o.missing || []).length ? html`<span class="ov-dim">Missing: ${o.missing.join('; ')}</span>` : null}</div>
          ${(o.unsupported || []).length ? html`<div class="st-ad-basis">${o.unsupported.map((u, i) => html`<${Chip} key=${i} kind="warn" title="the renderer cannot draw this part of the plan; it is not quietly replaced">cannot draw: ${u}</${Chip}>`)}</div>` : null}
          <div class="st-ad-cost">${renders ? html`<${Chip} kind="warn">${renders} render${renders === 1 ? '' : 's'} at ${size}${o.approach === 'artwork' ? ', words in the bitmap' : ''}</${Chip}>` : html`<${Chip} kind="ok">${o.cost}</${Chip}>`}${o.layoutLocked ? html` <span class="ov-dim">layout locked: create a new design instead</span>` : null}</div>
          ${!ro && !ap && withImage.length && (withImage.length > 1 || !o.needsImage) && o.kind !== 'plan' ? html`<div class="st-ad-combine"><label class="ov-dim">Photograph from <select class="st-sel" value=${imgFrom[o.i] == null ? '' : imgFrom[o.i]} onChange=${e => setImgFrom(Object.assign({}, imgFrom, { [o.i]: e.target.value === '' ? '' : Number(e.target.value) }))} aria-label=${'Photograph for ' + o.name}><option value="">${o.needsImage ? 'this concept' : 'the current photograph'}</option>${withImage.filter(x => x.i !== o.i).map(x => html`<option key=${x.i} value=${x.i}>${String.fromCharCode(65 + x.i)}) ${x.name}</option>`)}</select></label></div>` : null}
          ${!ro && !ap ? html`<div class="st-ad-acts">
            ${renders ? html`<button class="btn sm" disabled=${!!busy || o.layoutLocked} onClick=${() => onApply(ev.eid, o.i, true, src ? src.i : undefined, size)}>Generate (${renders} render${renders === 1 ? '' : 's'} at ${size})</button><button class="btn sm ghost" disabled=${!!busy || o.layoutLocked} title="Apply the composition on the current imagery and decide about the imagery later" onClick=${() => onApply(ev.eid, o.i, false, src ? src.i : undefined)}>${o.fresh ? 'Create as a sketch' : 'Apply as a sketch'}</button>` : html`<button class="btn sm" disabled=${!!busy || o.layoutLocked} onClick=${() => onApply(ev.eid, o.i, false)}>${o.fresh ? 'Create (layout only)' : 'Apply layout only'}</button>`}
            <button class="btn sm ghost" onClick=${() => { setRefining(refining === o.i ? null : o.i); setRefineText(''); }}>Refine</button>
          </div>` : ap ? html`<div class="ov-dim">${ap.fresh ? 'created as ' + (ap.frames ? ap.frames + ' frames' : 'a new asset') : 'applied as version ' + ap.version}${ap.render ? ', ' + (ap.jobs || []).length + ' render' + ((ap.jobs || []).length === 1 ? '' : 's') + ' queued' : ''}${ap.imageFrom != null ? ', photograph from ' + String.fromCharCode(65 + ap.imageFrom) : ''}</div>` : null}
          ${refining === o.i ? html`<div class="st-offer-box"><textarea class="st-ta" rows="2" value=${refineText} onInput=${e => setRefineText(e.target.value)} placeholder="What to change about this concept"></textarea><div><button class="btn sm" disabled=${!!busy || !refineText.trim()} onClick=${() => { onPropose(a, refineText.trim(), { eid: ev.eid, index: o.i }, { mode: 'refine', size }); setRefining(null); }}>Propose refinements</button></div></div>` : null}
        </div>`; })}</div>` : html`<div class="ov-dim">No concepts proposed yet for this asset. Refine keeps the idea and polishes it; Explore gives three different ones; Explore layouts rearranges the same photograph and words three ways; Create a new design starts again from the brief.</div>`}
      ${!ro ? html`<div class="st-ad-quick">${rr === null ? html`<button class="ov-link" onClick=${() => setRr(String((v.context || {}).visual || ''))}>${v.image ? (v.mode === 'artwork' ? 'Edit the artwork with an instruction' : 'Just re-render the imagery from a description') : 'Render imagery from a description'}</button>${sugg && sugg.data && (sugg.data.image || []).length ? html` <span class="ov-dim">(${sugg.data.image.length} photograph suggestions inside)</span>` : null}` : html`<div class="st-proposal"><div class="ov-dim">${v.mode === 'artwork' ? 'Instruction for the image model: it edits the current artwork and keeps everything else (the earlier turns are replayed).' : 'Art direction for the imagery (no text, no logos - the words are layers; the composition\'s quiet zone is added for you):'}</div><textarea class="st-ta" rows="2" value=${rr} onInput=${e => setRr(e.target.value)} aria-label="Photograph description"></textarea><div><button class="btn sm" disabled=${!!busy} onClick=${() => { onRender(a, rr, v.mode === 'artwork', size); setRr(null); }}>Do this (one render at ${size})</button> <button class="btn sm ghost" onClick=${() => setRr(null)}>Not now</button></div>
        <${Suggestions} kind="image" sugg=${sugg} busy=${busy} compact=${true} onUse=${t => setRr(t)} onRefresh=${onSuggRefresh} /></div>`}</div>` : null}
    </div>`;
  }

  /* Edit the imagery by area (P17): mark a rectangle (drag on the image, or type it), or choose a background swap or a
     restyle, and say what to change. Gemini edits by described area, not a pixel mask, so nothing outside the area is
     promised: the result is measured against the version it came from and the difference is shown before approval. */
  const EDIT_KINDS = [['area', 'Change a marked area'], ['background', 'New background, keep the subject'], ['restyle', 'Restyle, keep the content']];
  function AreaEdit({ a, v, busy, onEdit }) {
    const [open, setOpen] = useState(false); const [kind, setKind] = useState('area'); const [box, setBox] = useState(null); const [ins, setIns] = useState('');
    const [size, setSize] = useState((v.image && v.image.size) || '2K'); const [src, setSrc] = useState(null); const drag = useRef(null); const ref = useRef(null);
    useEffect(() => { let live = true; setSrc(null); if (open && v.image && v.image.url) blobUrl(v.image.url).then(u => { if (live) setSrc(u); }).catch(() => {}); return () => { live = false; }; }, [open, v.id]);
    if (!v.image || !v.image.url || v.mode === 'artwork') return null;
    if (!open) return html`<div class="st-ad-quick"><button class="ov-link" onClick=${() => setOpen(true)}>Edit an area of the imagery</button> <span class="ov-dim">(one image call; the rest of the photograph is measured afterwards)</span></div>`;
    const r1 = n => Math.round(n * 10) / 10;
    const pt = e => { const r = ref.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) }; };
    const down = e => { if (kind !== 'area') return; e.preventDefault(); const p0 = pt(e); drag.current = p0; setBox({ x: r1(p0.x), y: r1(p0.y), w: 0, h: 0 }); };
    const move = e => { if (!drag.current) return; const p1 = pt(e), p0 = drag.current; setBox({ x: r1(Math.min(p0.x, p1.x)), y: r1(Math.min(p0.y, p1.y)), w: r1(Math.abs(p1.x - p0.x)), h: r1(Math.abs(p1.y - p0.y)) }); };
    const up = () => { drag.current = null; };
    const setNum = (k, val) => setBox(Object.assign({ x: 0, y: 0, w: 0, h: 0 }, box || {}, { [k]: Math.max(0, Math.min(100, +val || 0)) }));
    const ready = !!ins.trim() && (kind !== 'area' || (box && box.w >= 2 && box.h >= 2));
    return html`<div class="st-areaedit" aria-label="Edit an area">
      <div class="st-lbl">Edit the imagery</div>
      <div class="st-seg" role="group" aria-label="What kind of edit">${EDIT_KINDS.map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (kind === k ? ' on' : '')} aria-pressed=${kind === k} onClick=${() => setKind(k)}>${l}</button>`)}</div>
      <div class="st-area-stage" ref=${ref} style=${{ aspectRatio: String(a.format || '1:1').replace(':', ' / ') }} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerLeave=${up}>
        ${src ? html`<img src=${src} alt="The current imagery" draggable="false" />` : html`<div class="ov-dim">Loading the imagery...</div>`}
        ${kind === 'area' && box && box.w > 0 ? html`<div class="st-area-box" style=${{ left: box.x + '%', top: box.y + '%', width: box.w + '%', height: box.h + '%' }}></div>` : null}
      </div>
      ${kind === 'area' ? html`<div class="st-nd-row st-area-nums">${[['x', 'from left'], ['y', 'from top'], ['w', 'width'], ['h', 'height']].map(([k, l]) => html`<label key=${k} class="ov-dim">${l} <input class="st-in st-le-num" type="number" min="0" max="100" step="1" value=${box ? box[k] : ''} onInput=${e => setNum(k, e.target.value)} aria-label=${'Area ' + l + ', per cent'} />%</label>`)}</div><div class="ov-dim">${box && box.w >= 2 && box.h >= 2 ? 'Marked: ' + box.w + '% x ' + box.h + '% of the frame.' : 'Drag on the image, or type the area in per cent.'}</div>`
        : html`<div class="ov-dim">${kind === 'background' ? 'The subject should stay as it is; what is behind it changes.' : 'Everything stays where it is; only the treatment (palette, light, style) changes.'}</div>`}
      <textarea class="st-ta" rows="2" value=${ins} onInput=${e => setIns(e.target.value)} placeholder=${kind === 'area' ? 'What to change in the area, e.g. "remove the sign"' : kind === 'background' ? 'The new background, e.g. "a regional town street at dusk"' : 'The new treatment, e.g. "warmer, late afternoon light"'} aria-label="What to change"></textarea>
      <div class="st-nd-row"><select class="st-sel" value=${size} onChange=${e => setSize(e.target.value)} aria-label="Edit resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option></select>
        <button class="btn sm" disabled=${!!busy || !ready} onClick=${() => { onEdit(a, { kind, area: kind === 'area' ? box : undefined, instruction: ins.trim(), size }); setOpen(false); setIns(''); setBox(null); }}>Edit (1 image at ${size})</button>
        <button class="btn sm ghost" onClick=${() => setOpen(false)}>Cancel</button></div>
      <div class="ov-dim">The image model edits by described area, not a pixel mask: it is asked to leave everything else alone and cannot promise to. The words and marks are layers and are not touched. The result is a new version, measured against this one.</div>
    </div>`;
  }
  /** What an area edit changed, measured here: both images drawn small, the mean change outside and inside the area and the share of pixels outside it that moved visibly. */
  async function measurePreservation(a, v) {
    const ed = ((v.image || {}).meta || {}).edit; if (!ed) return null; const base = a.versions.find(x => x.id === ed.of); if (!base || !base.image || !base.image.url) return null;
    const [A, B] = await Promise.all([keyedImage(base.image.url), keyedImage(v.image.url)]); if (!A || !B) return null;
    const W = 160, H = Math.max(16, Math.round(160 * (B.naturalHeight || B.height) / Math.max(1, B.naturalWidth || B.width)));
    const px = img => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
    const P = px(A), Q = px(B); const ar = ed.kind === 'area' ? ed.area : null; let so = 0, no = 0, si = 0, ni = 0, mv = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4; const d = (Math.abs(P[i] - Q[i]) + Math.abs(P[i + 1] - Q[i + 1]) + Math.abs(P[i + 2] - Q[i + 2])) / 765;
      const inA = ar && (x + 0.5) / W * 100 >= ar.x && (x + 0.5) / W * 100 <= ar.x + ar.w && (y + 0.5) / H * 100 >= ar.y && (y + 0.5) / H * 100 <= ar.y + ar.h;
      if (inA) { si += d; ni++; } else { so += d; no++; if (d > 0.1) mv++; }
    }
    return { asset: a.id, version: v.id, against: ed.of, outside: no ? so / no : 0, inside: ni ? si / ni : undefined, changedOutside: no ? mv / no : 0, size: W + 'x' + H };
  }
  function Preservation({ p, a, v, ro, onCompare, onFile }) {
    const ed = ((v.image || {}).meta || {}).edit; const filing = useRef('');
    const ev = ed ? (p.thread || []).filter(e => e.kind === 'preservation' && e.version === v.id).pop() : null;
    useEffect(() => { if (!ed || ev || ro || filing.current === v.id) return; filing.current = v.id; measurePreservation(a, v).then(m => { if (m) onFile(m); }); }, [v.id, !!ev]);
    if (!ed) return null;
    const from = a.versions.findIndex(x => x.id === ed.of) + 1;
    return html`<div class=${'st-preserve ' + (ev ? ev.verdict : 'pending')} aria-label="Preservation">
      <b>${ed.kind === 'area' ? 'Area edit' : ed.kind === 'background' ? 'Background swap' : 'Restyle'}</b> of v${from}: "${ed.instruction}".
      ${ev ? html` <${Chip} kind=${ev.verdict === 'held' ? 'ok' : ev.verdict === 'changed' ? 'bad' : 'warn'}>${ev.verdict === 'measured' ? 'measured' : ev.verdict}</${Chip}> <span>${ev.text}</span>` : html` <span class="ov-dim">${ro ? 'Not measured yet.' : 'Measuring what changed outside the area...'}</span>`}
      <button class="ov-link" onClick=${() => onCompare(ed.of, v.id)}>compare v${from} and this version</button>
      <div class="ov-dim">${ed.limits || ''}</div></div>`;
  }
  /** The family an asset belongs to: carousel frames in order, a master and its adaptations - each a thumbnail drawn by the renderer. */
  function FamilyStrip({ p, a, onOpen }) {
    const fam = p.assets.filter(x => x.family === a.family);
    const v = current(a); const master = v && v.context && v.context.master ? p.assets.find(x => x.id === v.context.master) : null;
    const adapted = p.assets.filter(x => { const xv = current(x); return xv && xv.context && xv.context.master === a.id; });
    if (fam.length < 2 && !master && !adapted.length) return null;
    const frameOf = x => { const xv = current(x); return xv && xv.layout && xv.layout.frame ? xv.layout.frame.index + 1 : null; };
    const list = fam.slice().sort((x, y) => (frameOf(x) || 99) - (frameOf(y) || 99) || x.created - y.created);
    return html`<div class="st-family" aria-label="Family"><${Lbl}>${v && v.layout && v.layout.frame ? 'Carousel: frame ' + (v.layout.frame.index + 1) + ' of ' + v.layout.frame.of : a.family}${master ? ' - adapted from ' + master.title : ''}</${Lbl}>
      <div class="st-family-row">${list.map(x => html`<button key=${x.id} class=${'st-family-item' + (x.id === a.id ? ' on' : '')} onClick=${() => onOpen && onOpen(x.id)} title=${x.title}><${Composition} v=${current(x)} a=${x} ns=${p.ns} size="thumb" /><span>${frameOf(x) ? frameOf(x) + '. ' : ''}${x.title}</span></button>`)}${adapted.filter(x => x.family !== a.family).map(x => html`<button key=${x.id} class="st-family-item" onClick=${() => onOpen && onOpen(x.id)}><${Composition} v=${current(x)} a=${x} ns=${p.ns} size="thumb" /><span>adaptation: ${x.title}</span></button>`)}</div>
    </div>`;
  }
  const TECH_WORD = { passed: 'passed', failed: 'failed', stale: 'not validated (stale)', not_validated: 'not validated', not_applicable: 'not applicable', unknown: 'unknown', none: 'not validated' };
  const TECH_KIND = { passed: 'ok', failed: 'bad', stale: 'warn', not_validated: 'warn' };
  const INS_WORD = { none: 'not inspected', stale: 'inspected an earlier composition', imagery_only: 'imagery only (not a finished-layout review)', inconsistent: 'inconsistent: ship with unresolved problems', ship: 'ship', fix: 'fix', redo: 'redo', stop: 'bounded: a designer next' };
  const LAYOUT_CODES = { text_overflow: 1, collision: 1, off_canvas: 1, safe_area: 1, text_too_wide: 1 };
  const fixableOf = val => !!(val && val.issues.some(i => LAYOUT_CODES[i.code] || /^(mark_low_contrast|mark_unreadable|low_contrast|unreadable_contrast)$/.test(i.code)));
  /** Under the artwork: the measured state in one line and the free fixes; the detail is in the Quality tab. */
  function ReadyStrip({ a, v, val, measuring, ro, onRepair, onMeasure, onDraft, repairing, repairNote, onDetail }) {
    const rd = a.readiness || {}; const t = measuring ? 'measuring' : rd.technical || 'not_validated';
    const blocking = val ? val.issues.filter(i => i.severity === 'blocking').length : 0; const warns = val ? val.issues.filter(i => i.severity !== 'blocking').length : 0;
    return html`<div class=${'st-ready st-readystrip ' + t} aria-label="Readiness">
      <div class="st-ready-row"><b>Technical validation</b> <${Chip} kind=${measuring ? '' : TECH_KIND[rd.technical] || ''}>${measuring ? 'measuring at ' + (v.layout && v.layout.stage ? v.layout.stage.w + ' x ' + v.layout.stage.h : 'native size') + '...' : TECH_WORD[rd.technical] || rd.technical || 'not validated'}</${Chip}>
        ${val && !measuring ? html`<span class="ov-dim">${val.issues.length ? (blocking ? blocking + ' blocking' : '') + (blocking && warns ? ', ' : '') + (warns ? warns + ' to look at' : '') : 'no overflow, collisions, clipping or missing files at the output size'}</span>` : null}
        ${val && val.issues.length ? html`<button class="ov-link" onClick=${onDetail}>details</button>` : null}</div>
      ${!ro ? html`<div class="st-ready-acts">${fixableOf(val) ? html`<button class="btn sm" disabled=${repairing} onClick=${onRepair} title="Fit boxes to their measured lines, restack, widen, move a mark, a bounded type step, a readable colour or a better approved mark variant - never the words; a layout version, no render">${repairing ? 'Fixing...' : 'Fix layout (no render)'}</button>` : null}<button class="btn sm ghost" disabled=${measuring} onClick=${onMeasure}>Measure again</button><button class="btn sm ghost" onClick=${onDraft} title="A PNG labelled as a draft: not validated production artwork">Download draft PNG</button></div>` : null}
      ${repairNote ? html`<div class=${'ov-dim st-repair-note' + (repairNote.conflict ? ' warn' : '')} role="status">${repairNote.text}</div>` : null}
    </div>`;
  }
  /** What no layout move can fix, said with its remedy: imagery the composition expects but nobody has made yet, and a mark file
      that did not load. Generating the imagery is one render (paid, announced); a solid ground is a layout version, no render. */
  function Remedies({ a, v, val, ro, renderJob, lastRender, typeOnly, onGenerate, onSolid, onRetry, onRefresh }) {
    if (!val) return null;
    const missing = val.issues.some(i => i.code === 'imagery_missing'); const unloaded = val.issues.filter(i => i.code === 'mark_unloaded');
    if (!missing && !unloaded.length) return null;
    const failed = lastRender && lastRender.state === 'failed' ? lastRender : null;
    return html`<div class="st-remedy" role="region" aria-label="What a layout cannot fix">
      ${missing ? html`<div class="st-remedy-row"><div><b>No imagery yet.</b> <span class="ov-dim">This composition expects a photograph or illustration that has not been made, so it cannot pass validation. Moving the words does not change that.</span>
          ${renderJob ? html`<div class="ov-dim">${renderJob.state === 'running' ? 'The imagery is being generated now.' : 'A render is queued for this asset.'}</div>` : failed ? html`<div class="st-remedy-fail"><${Chip} kind="bad">last render failed</${Chip}> <span class="ov-dim">${explain({ message: failed.error, code: (String(failed.error).match(/^[a-z_0-9]+/) || [''])[0] }).title}</span></div>` : null}</div>
        ${!ro && !renderJob ? html`<div class="st-remedy-acts">
          ${failed ? html`<button class="btn sm" onClick=${() => onRetry(failed)} title="Runs the same render again: one image generation">Retry the render (1 render)</button>` : html`<button class="btn sm" onClick=${onGenerate} title="One image generation from the composition's own art direction; the words and marks stay live layers">Generate the imagery (1 render)</button>`}
          ${typeOnly ? html`<button class="btn sm ghost" onClick=${onSolid} title=${'Drop the photograph and set the words on the campaign colour: ' + (typeOnly.ok ? 'measured and passing' : 'measured; still ' + typeOnly.blocking.join(', ')) + '. A layout version, no render.'}>Use a solid ground instead (no render)</button>` : null}
        </div>` : null}</div>` : null}
      ${unloaded.length ? html`<div class="st-remedy-row"><div><b>A mark file did not load</b> <span class="ov-dim">(${unloaded.map(i => i.layers.join(', ')).join('; ')}). The logo or wordmark is placed from its file and is never redrawn; reload it, or check the Brand view for the file.</span></div>${!ro ? html`<div class="st-remedy-acts"><button class="btn sm ghost" onClick=${onRefresh}>Load the marks again</button></div>` : null}</div>` : null}
    </div>`;
  }
  /** Other arrangements of the same words, marks and imagery, laid out by the renderer and measured at the output size before
      they are offered: free, no model call, no render. Choosing one saves it as a layout version named after it. */
  function LayoutVariations({ a, v, ns, comp, ro, list, onUse, using }) {
    const [open, setOpen] = useState(true);
    if (!list) return html`<section class="st-vars" aria-label="Layout variations"><div class="st-vars-head"><b>Layout variations</b> <span class="ov-dim">${comp.ready ? 'measuring each arrangement at the output size...' : 'waiting for the fonts and images...'}</span></div></section>`;
    if ((a.locks || {}).layout) return html`<section class="st-vars" aria-label="Layout variations"><div class="st-vars-head"><b>Layout variations</b> <span class="ov-dim">The layout is locked on this asset; unlock it (Copy tab) to try other arrangements.</span></div></section>`;
    const ok = list.filter(x => x.ok).length; const needs = list.filter(x => x.ok && x.pending.indexOf('imagery_missing') >= 0).length;
    return html`<section class="st-vars" aria-label="Layout variations">
      <div class="st-vars-head"><b>Layout variations</b> <span class="ov-dim">${list.length} arrangements of the same words${v.image ? ', photograph' : ''} and marks, each measured at ${v.layout.stage ? v.layout.stage.w + ' x ' + v.layout.stage.h : 'the output size'}: ${ok} pass${ok === 1 ? 'es' : ''} the layout checks${needs ? ', ' + needs + ' of them still need the imagery made' : ''}. Free: no model call, no render. The words are never changed.</span>
        <button class="ov-link" onClick=${() => setOpen(!open)} aria-expanded=${open}>${open ? 'hide' : 'show'}</button></div>
      ${open ? html`<div class="st-vars-grid">${list.map(x => html`<div key=${x.id} class=${'st-var' + (x.ok ? '' : ' bad')} data-variant=${x.id}>
        <${Composition} v=${Object.assign({}, v, { layout: x.layout })} a=${a} ns=${ns} size="card" />
        <div class="st-var-name">${x.name}</div>
        <div class="st-var-state">${x.ok ? html`<${Chip} kind="ok" title=${x.steps.length ? 'after: ' + x.steps.join('; ') : 'laid out by measurement'}>passes</${Chip}>` : html`<${Chip} kind="bad" title=${x.blocking.join('; ')}>${x.blocking.length} blocking</${Chip}>`}${x.typeOnly ? html`<${Chip} title="no photograph: the words on the campaign colour">no photograph</${Chip}>` : x.pending.indexOf('imagery_missing') >= 0 ? html`<${Chip} kind="warn" title="the arrangement is sound; the imagery still has to be made">needs imagery</${Chip}>` : null}${x.warnings.length ? html`<${Chip} title=${x.warnings.join(', ')}>${x.warnings.length} to look at</${Chip}>` : null}</div>
        ${!x.ok ? html`<div class="ov-dim st-var-why">${x.blocking.join('; ')}</div>` : null}
        ${!ro ? html`<button class="btn sm ghost" disabled=${!!using} onClick=${() => onUse(x)}>${using === x.id ? 'Saving...' : 'Use this layout'}</button>` : null}
      </div>`)}</div>` : null}
    </section>`;
  }
  /** Three things kept apart: the measured technical validation, the art director's opinion, and a person's approval. */
  function Readiness({ p, a, v, val }) {
    const rd = a.readiness || {}; const ins = rd.inspection || { state: 'none' }; const appr = standing(a, 'design');
    const last = (p.thread || []).filter(e => e.kind === 'inspection' && e.asset === a.id).pop();
    return html`<div class="st-readydetail" aria-label="Quality">
      <div class="st-ready-row"><b>Technical validation</b> <${Chip} kind=${TECH_KIND[rd.technical] || ''}>${TECH_WORD[rd.technical] || rd.technical || 'not validated'}</${Chip}>${rd.validation ? html` <span class="ov-dim">${aest(rd.validation.at)}, ${rd.validation.who}</span>` : null}</div>
      ${val ? html`<ul class="st-vallist st-val">${val.issues.length ? val.issues.map((i, k) => html`<li key=${k}><${Chip} kind=${i.severity === 'blocking' ? 'bad' : i.severity === 'warning' ? 'warn' : ''}>${i.code.replace(/_/g, ' ')}</${Chip}> ${i.layers.length ? html`<b>${i.layers.join(', ')}</b> ` : null}<span class="ov-dim">${i.detail}</span></li>`) : html`<li><span class="ov-dim">No collisions, overflow, clipping or missing assets measured at the output size.</span></li>`}${val.fonts ? html`<li class="ov-dim">Fonts: ${Object.keys(val.fonts.roles || {}).map(k => k + ' ' + val.fonts.roles[k].used + (val.fonts.roles[k].fallback ? ' (asked ' + val.fonts.roles[k].requested + ')' : '')).join('; ') || 'none needed'}</li>` : null}</ul>` : null}
      ${rd.technical && rd.technical !== 'passed' && rd.reasons && rd.reasons.length ? html`<div class="ov-dim">${rd.reasons.join(' ')}</div>` : null}
      <div class="st-ready-row"><b>Art direction</b> <${Chip} kind=${ins.state === 'ship' ? 'ok' : ins.state === 'inconsistent' || ins.state === 'redo' ? 'bad' : ins.state === 'none' ? '' : 'warn'}>${INS_WORD[ins.state] || ins.state}</${Chip}>${rd.baked ? html` <${Chip} kind=${rd.baked.verified ? 'ok' : 'warn'}>${rd.baked.verified ? 'painted words read back' : 'painted words not verified'}</${Chip}>` : null}</div>
      ${last && last.scores ? html`<div class="st-insp-mini" aria-label="Latest inspection"><div class="st-insp-scores">${['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'].map(k => html`<span key=${k} class=${'st-insp-score s' + (last.scores[k] == null ? 'n' : last.scores[k])} title=${(last.reasons || {})[k] || ''}>${k} <b>${last.scores[k] == null ? 'not scored' : last.scores[k]}</b></span>`)}</div>
        <div class="ov-dim">Verdict ${last.verdict}, round ${last.round} of ${last.of || 2}${(() => { const vn = a.versions.findIndex(x => x.id === last.version) + 1; return vn ? ', on v' + vn + (last.version !== a.current ? ' (an earlier version)' : '') : ''; })()}. The critique, its reasons and the offered correction are in the Art Director tab. An opinion: it never approves.</div></div>` : html`<div class="ov-dim">No inspection of this asset yet. One runs after each render; it is advice and never approves.</div>`}
      <div class="st-ready-row"><b>Human approval</b> <${Chip} kind=${appr ? 'ok' : ''}>${appr ? 'design approved by ' + appr.by : 'design not approved'}</${Chip}>${appr && rd.technical !== 'passed' && rd.technical !== 'not_applicable' ? html` <span class="ov-dim">the approval stands, but export waits for a passing validation</span>` : null}</div>
    </div>`;
  }
  /** The Refine workspace: the artwork, sized to the screen, with the free fixes under it and the design tools below; the
      words, the quality record, approvals and versions are in the inspector beside it (rendered there through a portal). */
  function AssetView({ p, a, sel, setSel, onEdit, onDraftState, onLayout, onLayoutSave, onLock, onApprove, onCompare, onRestore, onRender, onPropose, onApplyConcept, sugg, onSuggRefresh, busy, onOpen, onValidate, onRepair, onMarkVariant, onAreaEdit, onPreservation, onVariant, onRetryJob, slot, tab, setTab, conflict, onConflict, neighbours }) {
    const v = current(a);
    const [zoom, setZoom] = useState('fit'); const [rr, setRr] = useState(null); const [le, setLe] = useState(false);
    useEffect(() => { setLe(false); }, [a.current]);
    // the words being typed: shown at once on the canvas, saved after a pause as a text version; a key leaves the draft
    // only once the server holds exactly that value, so a reload in between never takes a keystroke back
    const [draft, setDraft] = useState({}); const timer = useRef(null); const draftRef = useRef({}); draftRef.current = draft;
    useEffect(() => { setDraft(d => { const n = {}; Object.keys(d).forEach(k => { if ((((v && v.copy) || {})[k] || '') !== d[k]) n[k] = d[k]; }); return Object.keys(n).length === Object.keys(d).length ? d : n; }); }, [a.current, v && v.id]);
    useEffect(() => { if (onDraftState) onDraftState(a.id, Object.keys(draft).length > 0); }, [Object.keys(draft).length]);
    const flushNow = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; const d = draftRef.current; if (Object.keys(d).length) onEdit(a, d); } };
    useEffect(() => () => { flushNow(); if (onDraftState) onDraftState(a.id, false); }, []);
    const copy = Object.assign({}, v ? v.copy : {}, draft);
    const edit = (k, val) => { const d = Object.assign({}, draftRef.current, { [k]: val }); draftRef.current = d; setDraft(d); clearTimeout(timer.current); timer.current = setTimeout(() => { timer.current = null; onEdit(a, draftRef.current); }, 700); };
    const ap = { copy: standing(a, 'copy'), design: standing(a, 'design') };
    const flat = v && v.mode === 'generated'; const copyOnly = v && v.mode === 'copy'; const ro = !canWrite() || p.readOnly;
    const fields = [['headline', copyOnly ? 'Hook line' : 'Headline'], ['support', 'Support line'], ['cta', 'Call to action'], ['caption', 'Caption (' + chanLabel(a.channel) + ', ' + (copy.caption || '').length + ' of ' + ((CHANNELS[a.channel] || {}).max || 900) + ')'], ['alt', 'Alt text']];
    if (!v) return html`<div class="st-centre-pad"><div class="ov-empty" role="alert">${a.currentMissing ? 'The current version of this asset could not be found. Nothing older is shown in its place; open Versions to restore one.' : 'This asset has no version.'}</div></div>`;
    // on a full artwork the words are in the bitmap: the fields show them but cannot change them
    const baked = v.mode === 'artwork' ? new Set((v.layout || {}).baked || ['headline', 'support', 'cta']) : new Set();
    const hl = v.layout && v.layout.layers ? v.layout.layers.find(l => l.role === 'headline') : null;
    const [nonce, setNonce] = useState(0);
    // history older than the window the project view carries, paged on request in the worker's order
    const [older, setOlder] = useState([]); useEffect(() => { setOlder([]); }, [a.id]);
    const loadOlder = async () => { try { const before = older.length ? older[older.length - 1].n : (a.versionsFrom || 1); const d = await call('/studio/versions?asset=' + encodeURIComponent(a.id) + '&before=' + before + '&limit=40'); setOlder(o => o.concat((d.versions || []).slice().reverse())); } catch (e) { toastMsg('Older versions did not load: ' + e.message, true); } };
    const comp = useComposition(v, p.ns, v.layout, v.copy, nonce);
    // the variations are worked out once the fonts and images are in, so every one is measured as it would export
    const canVary = !copyOnly && !flat && v.mode !== 'artwork' && v.layout && Array.isArray(v.layout.layers);
    const [vars, setVars] = useState(null); const [using, setUsing] = useState('');
    useEffect(() => {
      setVars(null); if (!canVary || !comp.ready) return; let live = true;
      const t = setTimeout(() => { try { const r = R.variants(v.layout, v.copy, comp.imgs, { fonts: comp.fonts, format: a.format, channel: a.channel, locks: a.locks }); if (live) setVars(r); } catch (e) { if (live) setVars([]); } }, 40);
      return () => { live = false; clearTimeout(t); };
    }, [v && v.id, comp.key, comp.ready, !!(a.locks || {}).layout]);
    const useVariant = async x => { setUsing(x.id); try { await onVariant(a, x.layout, v.id, x.name); } finally { setUsing(''); } };
    const [val, setVal] = useState(null); const [measuring, setMeasuring] = useState(false); const [repairing, setRepairing] = useState(false); const [repairNote, setRepairNote] = useState(null);
    const filed = useRef(''); const autoMark = useRef('');
    const measure = useCallback(async (force) => {
      if (!v || !v.layout || !Array.isArray(v.layout.layers) || !comp.ready) return;
      const r = R.validate(v.layout, v.copy, comp.imgs, { fonts: comp.fonts, channel: a.channel, format: a.format }); setVal(r);
      // a mark that does not read takes its best approved variant at once (blue, white or black, measured against what is behind
      // it): an identity requirement, not a taste, so it needs no click; it is a layout version, no render, said on the version
      if (!ro && onMarkVariant && !(a.locks || {}).layout && autoMark.current !== v.id && r.issues.some(i => (i.code === 'mark_unreadable' || i.code === 'mark_low_contrast') && i.layers.some(id => { const l = v.layout.layers.find(x => x.id === id); return l && !l.locked && Array.isArray(l.variants) && l.variants.length > 1; }))) {
        autoMark.current = v.id; setMeasuring(true); try { if (await onMarkVariant(a, v, comp)) return; } finally { setMeasuring(false); }
      }
      const rd = a.readiness || {}; const sigKey = v.id + '|' + r.issues.map(i => i.code + ':' + i.layers.join(',')).join(';') + '|' + (comp.fonts ? comp.fonts.fallback.join(',') : '');
      // file the evidence when the worker has none for this composition, or when what was measured disagrees with what it holds
      const disagrees = (rd.technical === 'passed' && !r.ok) || (rd.technical === 'failed' && r.ok);
      // the signature is recorded only once the worker accepted the evidence: a filing that failed (network, 500, a stale
      // version) leaves nothing recorded, so Measure again sends it again instead of doing nothing
      if (!ro && onValidate && (force || ((rd.technical !== 'passed' && rd.technical !== 'failed') || disagrees)) && (force || filed.current !== sigKey)) { setMeasuring(true); try { const sent = await onValidate(a, v, r, comp); if (sent) filed.current = sigKey; } finally { setMeasuring(false); } }
    }, [v && v.id, comp.key, comp.ready, a.readiness && a.readiness.technical]);
    useEffect(() => { measure(false); }, [measure]);
    const repair = async () => { setRepairing(true); try { const r = await onRepair(a, v, comp); setRepairNote(r); } finally { setRepairing(false); } };
    const draftPng = async () => { const blob = await R.toBlob(v.layout, v.copy, comp.imgs); const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = (a.title + '-v' + vnum(a, v) + '-DRAFT-not-validated.png').replace(/[^a-z0-9.-]+/gi, '_'); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
    const renderJob = (p.jobs || []).find(j => j.asset === a.id && (j.stage === 'render' || j.stage === 'inspect') && (j.state === 'queued' || j.state === 'running'));
    const imageJob = (p.jobs || []).find(j => j.asset === a.id && j.stage === 'render' && (j.state === 'queued' || j.state === 'running'));
    const lastRender = (p.jobs || []).filter(j => j.asset === a.id && j.stage === 'render').sort((x, y) => (x.created || 0) - (y.created || 0)).pop();
    // the art direction the composition already carries: the background region's own brief, else the version's visual note
    const bgPrompt = () => { const L = v.layout || {}; const r = (L.regions || []).find(x => x.role === 'background'); return (r && r.prompt) || (v.context || {}).visual || ''; };
    const ratio = (v.layout && v.layout.stage && v.layout.stage.w / v.layout.stage.h) || FORMAT_RATIO[a.format] || 1;
    const hasLayout = !copyOnly && !flat && v.layout && v.layout.layers;
    const work = html`<div class="st-asset">
      <div class="st-asset-head">
        <div class="st-asset-title"><b>${a.title}</b> <span class="ov-dim">${chanLabel(a.channel)} ${(FORMATS[a.format] || {}).label || a.format}, ${a.family}; v${vnum(a, v)} of ${vtotal(a)}, ${v.note}${v.who ? ', ' + v.who : ''}</span></div>
        <div class="st-asset-acts">
          ${neighbours && neighbours.prev ? html`<button class="btn sm ghost" onClick=${() => onOpen(neighbours.prev)} aria-label="Previous asset" title="Previous asset">←</button>` : null}${neighbours && neighbours.next ? html`<button class="btn sm ghost" onClick=${() => onOpen(neighbours.next)} aria-label="Next asset" title="Next asset">→</button>` : null}
          ${!copyOnly ? html`<button class="btn sm ghost" onClick=${() => setZoom(zoom === 'fit' ? 'actual' : 'fit')} title="Fit to the screen or actual size">${zoom === 'fit' ? 'Actual size' : 'Fit'}</button>` : null}
          ${!copyOnly && !flat && !ro && v.layout && v.layout.layers && !a.locks.layout ? html`<button class=${'btn sm ghost' + (le ? ' on' : '')} aria-pressed=${le} onClick=${() => setLe(!le)}>${le ? 'Close layout editor' : 'Edit layout'}</button>` : null}
          <button class="btn sm ghost" onClick=${() => setTab('versions')}>Versions (${vtotal(a)})</button>
          ${(() => { const vi = a.versions.findIndex(x => x.id === v.id); return vi > 0 ? html`<button class="btn sm ghost" onClick=${() => onCompare(a.versions[vi - 1].id, v.id)}>Compare</button>` : null; })()}
        </div>
      </div>
      <div class=${'st-stage ' + zoom} style=${{ '--ar': ratio }}>
        <div class="st-stage-inner">${le ? html`<${LayoutEditor} v=${Object.assign({}, v, { copy })} a=${a} ns=${p.ns} onDone=${layout => { setLe(false); if (layout) onLayoutSave(a, layout, v.id); }} />` : html`<${Composition} v=${v} a=${a} ns=${p.ns} copy=${copy} />`}</div>
        ${renderJob ? html`<div class="st-stage-job" role="status"><span class="st-spin" aria-hidden="true"></span> ${renderJob.stage === 'inspect' ? 'The art director is inspecting this version' : 'Imagery ' + (renderJob.state === 'running' ? 'is being generated' : 'is queued') + (renderJob.attempts ? ' (attempt ' + (renderJob.attempts + 1) + ' of 3)' : '')}. The composition stays editable meanwhile.</div>` : null}
        ${flat ? html`<div class="st-flatnote">This is a flattened legacy tile: the text on the image is not editable. Editing the caption does not change the image.</div>` : null}
        ${v.mode === 'artwork' ? html`<div class="st-flatnote">Full artwork: the ${((v.layout || {}).baked || ['headline', 'support', 'cta']).join(', ')} are painted into the generated image (${(v.image || {}).model || 'image model'}, ${(v.image || {}).size || ''}${(v.image || {}).fallback ? ', fell back from ' + (v.image || {}).requested : ''}) and are not independently editable; the ${(v.layout || {}).layers && v.layout.layers.some(l => l.role === 'wordmark') ? 'wordmark' : 'logo'} is a live layer placed from its original file. Change the words by editing the artwork with an instruction, or switch to an editable composition.</div>` : null}
        ${v.image && v.image.fallback && v.mode !== 'artwork' ? html`<div class="st-flatnote">The image model fell back: ${v.image.requested} was requested, ${v.image.model} answered at ${v.image.size}.</div>` : null}
        ${v.layout && (v.layout.incomplete || []).length ? html`<div class="st-flatnote st-incomplete"><${Chip} kind="bad">incomplete</${Chip}> ${v.layout.incomplete.map(i => i.text).join('; ')}. Design approval and export wait for the file.</div>` : null}
        ${hasLayout && !v.image && !renderJob && (v.context || {}).imagery !== 'none' && (v.layout.regions || []).length ? html`<div class="st-flatnote">No imagery yet: the composition is drawn over its ground until a render lands (see Jobs).</div>` : null}
        ${(v.context || {}).imagery === 'none' ? html`<div class="st-flatnote">No imagery by choice: a complete typographic composition, nothing to render.</div>` : null}
      </div>
      ${hasLayout ? html`<${ReadyStrip} a=${a} v=${v} val=${val} measuring=${measuring} ro=${ro} onRepair=${repair} onMeasure=${() => measure(true)} onDraft=${draftPng} repairing=${repairing} repairNote=${repairNote} onDetail=${() => setTab('quality')} />` : null}
      ${hasLayout && !measuring ? html`<${Remedies} a=${a} v=${v} val=${val} ro=${ro} renderJob=${imageJob} lastRender=${lastRender} typeOnly=${(vars || []).find(x => x.typeOnly) || null} onGenerate=${() => { if (window.confirm('Generate the imagery for ' + a.title + '? One image generation at ' + ((v.image && v.image.size) || (v.context || {}).size || '2K') + ', from the composition\'s own art direction. The words and marks stay live layers.')) onRender(a, bgPrompt(), false, (v.context || {}).size); }} onSolid=${() => { const x = (vars || []).find(y => y.typeOnly); if (x) useVariant(x); }} onRetry=${j => { if (window.confirm('Run the render again? One image generation.')) onRetryJob(j); }} onRefresh=${() => setNonce(n => n + 1)} />` : null}
      ${canVary ? html`<${LayoutVariations} a=${a} v=${v} ns=${p.ns} comp=${comp} ro=${ro} list=${vars} using=${using} onUse=${useVariant} />` : null}
      <${Preservation} p=${p} a=${a} v=${v} ro=${ro} onCompare=${onCompare} onFile=${onPreservation} />
      <${FamilyStrip} p=${p} a=${a} onOpen=${onOpen} />
      ${!copyOnly && !flat ? html`<${ArtDirection} p=${p} a=${a} v=${v} ro=${ro} busy=${busy} onPropose=${onPropose} onApply=${onApplyConcept} onRender=${onRender} rr=${rr} setRr=${setRr} sugg=${sugg} onSuggRefresh=${onSuggRefresh} />` : null}
      ${!copyOnly && !flat && !ro ? html`<${AreaEdit} a=${a} v=${v} busy=${busy} onEdit=${onAreaEdit} />` : null}
    </div>`;
    const panel = (id, body) => html`<div key=${id} role="tabpanel" id=${'st-tab-' + id} aria-labelledby=${'st-tabbtn-' + id} hidden=${tab !== id} class="st-tabpanel">${body}</div>`;
    const inspector = html`<div class="st-inspector-asset">
      ${panel('copy', html`<div class="st-copy">
        ${conflict ? html`<div class="st-notice warn" role="alert"><div class="st-notice-body"><b>Changed elsewhere while you typed: ${conflict.fields.join(', ')}.</b> <span>Nothing was overwritten. Your text is still in the field${conflict.fields.length === 1 ? '' : 's'}.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => onConflict('mine')}>Keep mine</button><button class="btn sm ghost" onClick=${() => { const d = Object.assign({}, draftRef.current); conflict.fields.forEach(k => { delete d[k]; }); draftRef.current = d; setDraft(d); onConflict('theirs'); }}>Take theirs</button></div></div>` : null}
        ${fields.map(([k, label]) => html`<div key=${k} class=${'st-field' + (sel === k ? ' on' : '') + (a.locks[k] ? ' locked' : '')} onClick=${() => setSel(k)}>
          <div class="st-field-head"><label class="st-lbl" for=${'st-f-' + k}>${label}</label>${!ro ? html`<button class=${'st-lock' + (a.locks[k] ? ' on' : '')} onClick=${e => { e.stopPropagation(); onLock(a, k, !a.locks[k]); }} title=${a.locks[k] ? 'Locked: survives revisions until unlocked' : 'Lock this element'} aria-pressed=${!!a.locks[k]} aria-label=${(a.locks[k] ? 'Unlock ' : 'Lock ') + label}>${a.locks[k] ? 'locked' : 'lock'}</button>` : null}</div>
          ${k === 'caption' || k === 'support' ? html`<textarea class="st-ta" id=${'st-f-' + k} rows=${k === 'caption' ? 4 : 2} value=${copy[k] || ''} disabled=${ro || a.locks[k] || baked.has(k) || (flat && k !== 'caption' && k !== 'alt')} title=${baked.has(k) ? 'part of the generated artwork; not independently editable' : ''} onInput=${e => edit(k, e.target.value)} onBlur=${flushNow}></textarea>` : html`<input class="st-in" id=${'st-f-' + k} value=${copy[k] || ''} disabled=${ro || a.locks[k] || baked.has(k) || (flat && k !== 'alt')} title=${baked.has(k) ? 'part of the generated artwork; not independently editable' : ''} onInput=${e => edit(k, e.target.value)} onBlur=${flushNow} />`}${baked.has(k) ? html` <${Chip} kind="warn" title="painted into the bitmap by the image model">in the artwork</${Chip}>` : null}
        </div>`)}
        <div class="ov-dim st-savenote" role="status">${Object.keys(draft).length ? 'Saving as a new version (text change, no render)...' : 'Edits save as a new version after a pause; no render.'}</div>
        <div class="st-field"><div class="st-field-head"><${Lbl}>Layout</${Lbl}>${!ro && !copyOnly && !flat ? html`<button class=${'st-lock' + (a.locks.layout ? ' on' : '')} onClick=${() => onLock(a, 'layout', !a.locks.layout)} aria-pressed=${!!a.locks.layout} aria-label=${a.locks.layout ? 'Unlock the layout' : 'Lock the layout'}>${a.locks.layout ? 'locked' : 'lock'}</button>` : null}</div>
          <div class="ov-dim">${copyOnly ? 'copy only: no tile' : flat ? 'not editable (flattened)' : v.layout && v.layout.layers ? 'editable composition: ' + (v.layout.mediumName || v.layout.templateName) + ', headline ' + (hl ? hl.size : '-') + '% of the width, ' + v.layout.layers.length + ' layers' + (v.layout.layers.some(l => l.role === 'logo') ? ', kit logo placed exactly' : v.layout.layers.some(l => l.role === 'wordmark') ? ', campaign wordmark placed exactly' : ', no mark on file') + '.' : 'no layout'}
            ${!ro && hl && !a.locks.layout ? html` <button class="ov-link" onClick=${() => onLayout(a, -0.6)}>headline smaller</button> <button class="ov-link" onClick=${() => onLayout(a, 0.6)}>larger</button> <span class="ov-dim">(a layout version, no render)</span>` : null}</div></div>
        <div class="st-field"><${Lbl}>Checks on this version</${Lbl}>
          <ul class="st-checks">
            ${(v.checks || []).map((c, i) => html`<li key=${i} class=${c.state}><${Chip} kind=${CHECK_KIND[c.state] || 'warn'}>${CHECK_WORD[c.state] || c.state}</${Chip}> <b>${c.text}</b> <span class="ov-dim">${c.note}</span></li>`)}
            ${!(v.checks || []).length ? html`<li><span class="ov-dim">No figures, quotations or fit problems found in this copy.</span></li>` : null}
            <li class="ov-dim">Deterministic checks on figures, units, quotations, banned terms, limits and fit. Matching a source is not independent verification.</li>
          </ul>
        </div>
      </div>`)}
      ${panel('quality', html`${hasLayout ? html`<${Readiness} p=${p} a=${a} v=${v} val=${val} />` : html`<div class="ov-dim">${copyOnly ? 'Copy only: nothing to measure; the checks on the words are in the Copy tab.' : 'A flattened tile cannot be measured.'}</div>`}
        <div class="st-approve" aria-label="Approvals">
          ${['copy', 'design'].filter(part => part === 'copy' || !copyOnly).map(part => html`<div key=${part} class="st-appr"><span><b>${part}</b> ${ap[part] ? html`<${Chip} kind="ok">approved</${Chip}> <span class="ov-dim">on v${a.versions.findIndex(x => x.id === ap[part].version) + 1} by ${ap[part].by}, ${ap[part].reason}${ap[part].carried ? ' (unchanged since, so it stands)' : ''}</span>` : html`<span class="ov-dim">draft</span>`}</span>
            ${!ro ? html`<span>${ap[part] ? html`<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'withdraw')}>Withdraw</button>` : html`<button class="btn sm ghost" disabled=${part === 'design' && ((v.layout && (v.layout.incomplete || []).length > 0) || !a.readiness || (a.readiness.technical !== 'passed' && a.readiness.technical !== 'not_applicable'))} title=${part === 'design' && v.layout && (v.layout.incomplete || []).length ? 'The campaign mark is not on file: the design cannot be approved until it is' : part === 'design' && a.readiness && a.readiness.technical !== 'passed' ? 'Design approval waits for a passing technical validation of this composition' : ''} onClick=${() => onApprove(a, part, 'approve')}>Approve ${part}</button>`}<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'reject')}>Reject</button></span>` : null}
          </div>`)}
          <div class="ov-dim">An approval names this exact version. The inspection's verdict is advice and never approves.</div>
        </div>`)}
      ${panel('versions', html`<div class="st-hist"><div class="ov-dim">Versions are immutable; restoring creates a new current version that references the earlier content.</div>
        ${a.versions.slice().reverse().map(x => html`<div key=${x.id} class=${'st-hist-row' + (x.id === a.current ? ' cur' : '')}><${Composition} v=${x} a=${a} ns=${p.ns} size="thumb" /><div><b>v${vnum(a, x)}</b> <${Chip} kind=${x.kind === 'render' ? 'warn' : ''}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.created)}, ${x.who}${x.parent && x.parent !== (a.versions[vnum(a, x) - 2] || {}).id ? ' (branch)' : ''}</div></div><div>${x.id === a.current ? html`<${Chip} kind="ok">current</${Chip}>` : !ro ? html`<button class="ov-link" onClick=${() => onRestore(a, x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
        ${older.map(x => html`<div key=${x.id} class="st-hist-row st-hist-older"><div></div><div><b>v${x.n}</b> <${Chip}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.created)}, ${x.who}</div></div><div>${!ro ? html`<button class="ov-link" onClick=${() => onRestore(a, x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
        ${(older.length ? older[older.length - 1].n : (a.versionsFrom || 1)) > 1 ? html`<button class="ov-link st-hist-more" onClick=${loadOlder}>Load older versions (${(older.length ? older[older.length - 1].n : a.versionsFrom) - 1} earlier)</button>` : null}
        </div>
        ${!flat ? html`<${UsedPanel} a=${a} v=${v} />` : null}`)}
    </div>`;
    return html`${work}${slot ? ReactDOM.createPortal(inspector, slot) : null}`;
  }

  /* ------------------------------------------------------------ the right panel: the direction thread */
  /** The Art Director's latest word on this asset, pinned above the thread: the verdict, the scores with their reasons, the
      most serious issue and the correction on offer, which version it judged, and a review on request (one model call). */
  function ArtDirectorReview({ p, a, ro, busy, onReview, onApplyInspection }) {
    if (!a) return null; const v = current(a); if (!v || v.mode === 'copy') return null;
    const last = (p.thread || []).filter(e => e.kind === 'inspection' && e.asset === a.id).pop();
    const reviewing = (p.jobs || []).some(j => j.asset === a.id && j.stage === 'inspect' && (j.state === 'queued' || j.state === 'running'));
    const vn = last ? a.versions.findIndex(x => x.id === last.version) + 1 : 0; const old = last && last.version && last.version !== a.current;
    const done = last ? (p.thread || []).find(e => e.kind === 'inspection_applied' && e.eid === last.eid) : null;
    const issues = last ? (last.issues || []).map(x => typeof x === 'string' ? { text: x, severity: '' } : x) : [];
    const top = issues.find(x => x.severity === 'blocking') || issues.find(x => x.severity === 'material') || issues[0];
    const KEYS = ['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'];
    return html`<div class="st-adreview" aria-label="Art Director review">
      <div class="st-adreview-head"><b>Review of ${a.title}</b>
        ${!ro ? html`<button class="btn sm" disabled=${reviewing || !!busy} onClick=${() => onReview(a)} title="The tile is composed exactly as it exports, then the Art Director reads it: scores with reasons, the words it can read, a verdict and one bounded correction. One model call; it approves nothing.">${reviewing ? 'Reviewing...' : last && !old ? 'Review again (1 model call)' : 'Review v' + vtotal(a) + ' (1 model call)'}</button>` : null}</div>
      ${last && last.scores ? html`<div class="st-adreview-body">
        <div class="st-insp-scores">${KEYS.map(k => html`<span key=${k} class=${'st-insp-score s' + (last.scores[k] == null ? 'n' : last.scores[k])} title=${(last.reasons || {})[k] || ''}>${k} <b>${last.scores[k] == null ? 'not scored' : last.scores[k]}</b></span>`)}</div>
        <div><${Chip} kind=${last.verdict === 'ship' ? 'ok' : last.verdict === 'redo' ? 'bad' : 'warn'}>verdict: ${last.verdict}</${Chip}> <span class="ov-dim">on v${vn || '?'}${old ? ' - an earlier version; review again for this one' : ', the current version'}, round ${last.round} of ${last.of || 2}, ${last.composed ? 'the composed tile' : 'the imagery only'}, ${aest(last.at)}</span></div>
        ${top ? html`<div class="st-adreview-top">${top.severity ? html`<${Chip} kind=${top.severity === 'blocking' ? 'bad' : top.severity === 'material' ? 'warn' : ''}>${top.severity}</${Chip}> ` : null}${top.text}${issues.length > 1 ? html` <span class="ov-dim">(+${issues.length - 1} more in the thread)</span>` : null}</div>` : null}
        ${last.fix ? done ? html`<div><${Chip} kind="ok">correction applied (${done.fixKind})</${Chip}></div>` : !ro ? html`<div class="st-adreview-fix"><span class="ov-dim">Offered (${last.fix.kind}${last.fix.kind === 'design' || last.fix.kind === 'copy' ? ', no render' : ', one render'}):</span> ${last.fix.instruction} <button class="btn sm ghost" disabled=${!!busy} onClick=${() => { if (old && !window.confirm('This review judged an earlier version. Apply its correction to the current version anyway?')) return; onApplyInspection(last.eid, last.fix.instruction, old); }}>Apply</button></div>` : null : null}
        <div class="ov-dim">Advice, not approval: a person approves the copy and design in the Quality tab.</div>
      </div>` : last && last.verdict === 'stop' ? html`<div class="ov-dim">${last.text}</div>` : html`<div class="ov-dim">Not reviewed yet. A review runs after each render, or now on request; it reads the tile as it exports.</div>`}
    </div>`;
  }
  function Partner({ p, a, target, setTarget, onDirect, onNote, onPick, onDecide, onRemember, onApplyInspection, onReview, busy, sugg, onSuggRefresh, prefill }) {
    const [text, setText] = useState(''); const [offerOpen, setOfferOpen] = useState(null); const box = useRef(null); const [sk, setSk] = useState('design');
    useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [p.thread.length, busy]);
    // a chosen suggestion lands in the composer as an editable instruction, never sent on its own
    useEffect(() => { if (prefill && prefill.text) setText(prefill.text); }, [prefill && prefill.at]);
    const targets = [['asset', 'This asset' + (a ? ': ' + a.title : '')], ['family', a ? 'The ' + a.family : 'Asset family'], ['set', 'The whole set']];
    const answered = useMemo(() => { const m = {}; p.thread.forEach(e => { if ((e.kind === 'decided' || e.kind === 'remembered' || e.kind === 'offer_declined') && e.eid) m[e.eid + ':' + (e.kind === 'decided' ? 'proposal' : 'offer')] = e; }); return m; }, [p.thread]);
    const send = () => { if (!text.trim()) return; onDirect(text.trim(), target); setText(''); };
    const ro = !canWrite() || p.readOnly;
    return html`<section class="st-partner" aria-label="Art Director">
      <div class="st-partner-head"><span class="ov-why">Your Art Director for ${p.ns.toUpperCase()}: reviews the tile as it exports, proposes directions and takes instructions on words, layout and imagery; knows nothing of any other client. Every change lands as a version; nothing is approved for you.</span></div>
      ${onReview ? html`<${ArtDirectorReview} p=${p} a=${a} ro=${ro} busy=${busy} onReview=${onReview} onApplyInspection=${onApplyInspection} />` : null}
      <div class="st-thread" ref=${box}>
        ${p.thread.map(m => { const dec = m.kind === 'proposal' ? answered[m.eid + ':proposal'] : null; const off = m.offer ? answered[m.eid + ':offer'] : null; return html`<div key=${m.id} class=${'st-msg ' + (m.who === 'studio' ? 'studio' : 'you')}>
          <div class="st-msg-meta">${m.who === 'studio' ? (/^(inspection|concepts)$/.test(m.kind || '') ? 'Art Director' : 'Studio') : m.who || 'team'}${m.target && m.kind === 'note' ? html` <span class="ov-dim">to ${m.target}</span>` : null} <span class="ov-dim">${aest(m.at)}${m.kind && m.kind !== 'note' ? ' - ' + m.kind : ''}</span></div>
          ${m.instruction && /^(revise|adapted|alternatives|proposal|question)$/.test(m.kind) ? html`<div class="st-msg-you">Direction: ${m.instruction}</div>` : null}
          <div class="st-msg-text">${m.text}</div>
          ${m.changed || m.render != null ? html`<div class="st-msg-foot">${m.changed && m.changed.length ? m.changed.length + ' asset' + (m.changed.length === 1 ? '' : 's') + ' changed ' : ''}${m.kind === 'proposal' ? html`<${Chip} kind="warn">render proposed, nothing spent</${Chip}>` : m.kind === 'decided' ? html`<${Chip} kind="warn">${(m.jobs || []).length} render${(m.jobs || []).length === 1 ? '' : 's'} queued</${Chip}>` : m.render ? html`<${Chip} kind="warn">render spent</${Chip}>` : m.render === false ? html`<${Chip} kind="ok">no render</${Chip}>` : null}${m.locked ? html` <span class="ov-dim">kept locked: ${m.locked.join(', ')}</span>` : null}</div>` : null}
          ${m.kind === 'inspection' && m.scores ? html`<div class="st-insp"><div class="st-insp-scores">${['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'].map(k => html`<span key=${k} class=${'st-insp-score s' + (m.scores[k] == null ? 'n' : m.scores[k])} title=${k + (m.scores[k] == null ? ': not scored' : ' ' + m.scores[k] + ' of 5') + (m.reasons && m.reasons[k] ? ' - ' + m.reasons[k] : '')}>${k} <b>${m.scores[k] == null ? 'not scored' : m.scores[k]}</b></span>`)}<${Chip} kind=${m.verdict === 'ship' ? 'ok' : m.verdict === 'redo' ? 'bad' : 'warn'} title="the art director's verdict on this version">verdict: ${m.verdict}</${Chip}><span class="ov-dim">round ${m.round} of ${m.of || 2}</span>${(() => { const ia = p.assets.find(x => x.id === m.asset); const vn = ia ? ia.versions.findIndex(x => x.id === m.version) + 1 : m.versionNumber; return vn ? html`<span class="ov-dim">of v${vn}</span>` : null; })()}${m.composed ? html`<${Chip} kind="ok" title="the art director saw the tile exactly as it exports: imagery, words, shapes and marks">composed tile</${Chip}>` : m.scores ? html`<${Chip} kind="warn" title="no composed export was saved for this version; the words and marks were described, not seen">imagery only</${Chip}>` : null}${(() => { const ia = p.assets.find(x => x.id === m.asset); return ia && m.version && ia.current !== m.version ? html`<${Chip} kind="warn" title="the asset has moved on since this inspection">inspected an earlier version</${Chip}>` : null; })()}</div>
            ${m.reasons && Object.keys(m.reasons).length ? html`<ul class="st-ul st-insp-reasons">${['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'].filter(k => m.reasons[k]).map(k => html`<li key=${k}><b>${k} ${m.scores[k] == null ? '(not scored)' : m.scores[k]}</b> ${m.reasons[k]}</li>`)}</ul>` : html`<div class="ov-dim">The art director gave no reasons with these scores.</div>`}
            ${m.verdict === 'ship' ? html`<div class="ov-dim">Ship is the art director's opinion, not an approval: approval stays a person's decision below the tile.</div>` : null}
            ${m.assessment === 'inconsistent' ? html`<div class="st-insp-incons"><${Chip} kind="bad">inconsistent assessment</${Chip}> <span class="ov-dim">the verdict is ship, but ${m.technical === 'failed' ? 'the measured validation fails' : 'it names unresolved problems'}. It approves nothing; review the tile.</span></div>` : null}
            ${(m.issues || []).length ? html`<ul class="st-ul">${m.issues.map((x, i) => typeof x === 'string' ? html`<li key=${i}>${x}</li>` : html`<li key=${i}><${Chip} kind=${x.severity === 'blocking' ? 'bad' : x.severity === 'material' ? 'warn' : ''}>${x.severity}</${Chip}> ${x.text}</li>`)}</ul>` : null}
            ${m.words && (m.words.missing || []).length ? html`<div class="st-insp-words"><${Chip} kind="warn">approved words not read</${Chip}> ${m.words.missing.join(', ')}</div>` : null}
            ${m.words && (m.words.wrong || []).length ? html`<div class="st-insp-words"><${Chip} kind="bad">wording in the image not in the approved copy</${Chip}> ${m.words.wrong.join(', ')}</div>` : null}
            ${m.fix ? (() => { const done = p.thread.find(e => e.kind === 'inspection_applied' && e.eid === m.eid); return done ? html`<${Chip} kind="ok">correction applied (${done.fixKind})</${Chip}>` : !ro ? html`<div class="st-offer-box"><div class="ov-dim">Correction offered (${m.fix.kind}${m.fix.kind === 'design' || m.fix.kind === 'copy' ? ', no render' : m.fix.kind === 'edit' ? ', one render: an edit of this image' : ', one render: a re-brief'}); edit before applying:</div><textarea class="st-ta" rows="2" id=${'fix-' + m.eid} defaultValue=${m.fix.instruction}></textarea><div>${(() => { const ia = p.assets.find(x => x.id === m.asset); const old = ia && m.version && ia.current !== m.version; return html`<button class=${'btn sm' + (old ? ' ghost' : '')} disabled=${!!busy} title=${old ? 'This inspection judged an earlier version; applying it to the current one is a deliberate choice' : ''} onClick=${() => { if (old && !window.confirm('This inspection judged an earlier version. Apply its correction to the current version anyway?')) return; const ta = document.getElementById('fix-' + m.eid); onApplyInspection(m.eid, ta ? ta.value.trim() : m.fix.instruction, old); }}>${old ? 'Apply the correction to the current version anyway' : 'Apply the correction'}</button>${m.fix.kind === 'render' || m.fix.kind === 'edit' ? html` <span class="ov-dim">spends one render</span>` : null}`; })()}</div></div>` : null; })() : null}
            ${m.verdict === 'stop' ? html`<div class="ov-dim">Bounded: two corrections have run on this line; the next step is a designer's eye.</div>` : null}
          </div>` : null}
          ${m.kind === 'revise' && (m.layers || m.refused) ? html`<div class="st-focused" aria-label="Focused edit">
            ${(m.layers || []).length ? html`<div><${Lbl}>Changed</${Lbl}> ${m.layers.map(c => html`<${Chip} key=${c.id} kind="ok" title=${c.role || ''}>${c.id}: ${c.fields.join(', ')}</${Chip}>`)}</div>` : null}
            ${(m.unchanged || []).length ? html`<div class="ov-dim">Left as they were: ${m.unchanged.join(', ')}${m.render === false ? '; the photograph unchanged, no render' : ''}</div>` : null}
            ${(m.refused || []).length ? html`<div><${Lbl}>Not done</${Lbl}> ${m.refused.map((x, i) => html`<${Chip} key=${i} kind="warn">${x.id}: ${x.why}</${Chip}>`)}</div>` : null}
            ${(m.keeps || []).length ? html`<div class="ov-dim">Kept on purpose: ${m.keeps.join(', ')}</div>` : null}
          </div>` : null}
          ${m.kind === 'alternatives' && m.options ? html`<div class="st-alts">${m.options.map((o, i) => html`<button key=${i} class="st-alt" disabled=${ro || !!busy} onClick=${() => onPick(m.asset, m.field, o)}>${o}${m.checks && m.checks[i] && m.checks[i].length ? html` <${Chip} kind="warn">${m.checks[i].join(', ')}</${Chip}>` : null}</button>`)}<div class="ov-dim">Choose one to make it the ${m.field}, as a text change.</div></div>` : null}
          ${m.kind === 'proposal' ? html`<div class="st-proposal"><div class="ov-dim">Before a costly change, what would happen:</div><ul class="st-ul">${(m.steps || []).map((st, i) => html`<li key=${i}>${st}</li>`)}<li>Art direction: ${m.visual}</li></ul>${dec ? html`<${Chip}>${dec.decision === 'do' ? 'confirmed, ' + (dec.jobs || []).length + ' render' + ((dec.jobs || []).length === 1 ? '' : 's') : 'declined'}</${Chip}>` : !ro ? html`<div><button class="btn sm" disabled=${!!busy} onClick=${() => onDecide(m.eid, 'do')}>Do this (${(m.assets || []).length} render${(m.assets || []).length === 1 ? '' : 's'})</button> <button class="btn sm ghost" disabled=${!!busy} onClick=${() => onDecide(m.eid, 'decline')}>Not that</button></div>` : null}</div>` : null}
          ${m.offer ? html`<div class="st-offer">${off ? html`<${Chip} kind=${off.kind === 'remembered' ? 'ok' : ''}>${off.kind === 'remembered' ? 'saved as ' + (off.scope === 'campaign' ? 'a campaign preference' : 'a client rule') : 'not saved'}</${Chip}>` : !ro ? html`<span class="ov-dim">This reads like a standing preference. Save it?</span> <button class="ov-link" onClick=${() => setOfferOpen(offerOpen === m.eid ? null : m.eid)}>show wording</button>` : null}
            ${offerOpen === m.eid && !off ? html`<div class="st-offer-box"><div class="ov-dim">Proposed wording (edit before saving):</div><textarea class="st-ta" rows="2" id=${'offer-' + m.eid} defaultValue=${m.offer.rule}></textarea><div>${m.offer.campaign ? html`<button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'campaign', m.offer); setOfferOpen(null); }}>Campaign preference (${m.offer.campaign})</button> ` : null}<button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'client', m.offer); setOfferOpen(null); }}>Lasting client rule</button> <button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'none', m.offer); setOfferOpen(null); }}>Don't save</button></div></div>` : null}</div>` : null}
        </div>`; })}
        ${busy ? html`<div class="st-msg studio"><div class="st-msg-text ov-dim">${busy}</div></div>` : null}
      </div>
      ${!ro && a && sugg ? html`<div class="st-sugg-tabs" role="tablist">${[['design', 'Design'], ['typography', 'Type'], ['copy', 'Copy'], ['concept', 'Concepts']].map(([k, l]) => html`<button key=${k} role="tab" class=${'st-segbtn' + (sk === k ? ' on' : '')} onClick=${() => setSk(k)}>${l}${sugg.data && (sugg.data[k] || []).length ? ' ' + sugg.data[k].length : ''}</button>`)}</div><${Suggestions} kind=${sk} sugg=${sugg} busy=${busy} onUse=${t => { setText(t); setTarget('asset'); }} onRefresh=${onSuggRefresh} />` : null}
      ${!ro ? html`<div class="st-composer">
        <select class="st-sel" value=${target} onChange=${e => setTarget(e.target.value)} aria-label="Target of the direction">${targets.map(([k, l]) => html`<option key=${k} value=${k} disabled=${k !== 'set' && !a}>${l}</option>`)}</select>
        <textarea class="st-ta" rows="2" value=${text} placeholder=${'Tell the Art Director. e.g. "Keep the layout, sharpen the headline", "three alternative opening lines", "adapt this for Instagram", "more restrained visual"'} onInput=${e => setText(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} aria-label="Direction"></textarea>
        <div class="st-composer-acts"><button class="btn sm" disabled=${!text.trim() || !!busy || (target !== 'set' && !a)} onClick=${send}>Send</button><button class="ov-link" disabled=${!text.trim() || !!busy} onClick=${() => { onNote(text.trim(), target === 'set' ? 'the whole set' : (a || {}).title || ''); setText(''); }}>record as a note instead</button></div>
      </div>` : html`<div class="ov-dim st-pad">A read-only key can review, compare and export; directing the team needs a full key.</div>`}
    </section>`;
  }

  /* ------------------------------------------------------------ the Client panel: voice profile (the Content Desk's editor, reused) and learned rules */
  function ClientPanel({ p, kind, onClose, onChanged }) {
    const [kit, setKit] = useState(undefined); const [fixes, setFixes] = useState(null);
    const load = useCallback(async () => { try { const [k, f] = await Promise.all([call('/brand/kit?ns=' + encodeURIComponent(p.ns)), call('/engine/fixes?ns=' + encodeURIComponent(p.ns) + '&all=1')]); setKit(k.kit || {}); setFixes(f.fixes || []); } catch (e) { setKit({}); setFixes([]); toastMsg(e.message, true); } }, [p.ns]);
    useEffect(() => { load(); }, [load]);
    const AXC = window.AX_CONTENT;
    if (kit === undefined || fixes === null) return html`<div class="st-dialog" role="dialog" aria-modal="true"><div class="st-dialog-box"><div class="ov-empty">Loading the client profile...</div></div></div>`;
    const toggle = async f => { try { await call('/engine/fix/update', { id: f.id, active: !f.active }); await load(); onChanged(); } catch (e) { toastMsg(e.message, true); } };
    const del = async f => { try { await call('/engine/fix/delete', { id: f.id }); await load(); onChanged(); } catch (e) { toastMsg(e.message, true); } };
    const campOf = f => (/:campaign:([a-z0-9_-]+)$/.exec(f.source || '') || [])[1] || '';
    return html`<div class="st-dialog st-panel-dialog" role="dialog" aria-modal="true" aria-label=${kind === 'voice' ? 'Voice profile' : 'Learned rules'}><div class="st-dialog-box">
      ${kind === 'voice' ? (AXC && AXC.VoicePanel ? html`<${AXC.VoicePanel} ns=${p.ns} kit=${kit} canWrite=${canWrite()} onSaved=${() => { load(); onChanged(); }} onClose=${onClose} />` : html`<div class="ov-empty">The voice profile editor (content.js) is not loaded on this page.</div><button class="btn sm ghost" onClick=${onClose}>Close</button>`)
      : html`<div class="ov-sechead"><span class="ov-title">What the Studio has learned for ${p.ns.toUpperCase()}</span><span class="ov-why">${fixes.filter(f => f.active).length} in force; rules are in the prompt within the minute, switched-off ones stay on record</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onClose}>Close</button></div>
        ${!fixes.length ? html`<div class="ov-empty">Nothing taught yet. Direct the team; a standing preference is offered after the change and lands here when you save it.</div>` : html`<table class="ov-table"><thead><tr><th>Rule</th><th>Applies to</th><th>Task</th><th>From</th><th></th></tr></thead><tbody>${fixes.map(f => html`<tr key=${f.id} class=${f.active ? '' : 'st-legacy'}><td>${f.rule}${f.why ? html`<div class="ov-dim">${f.why.slice(0, 160)}</div>` : null}</td><td>${campOf(f) ? 'campaign ' + campOf(f) : f.scope === 'all' ? 'every client' : p.ns.toUpperCase()}</td><td class="ov-dim">${f.task}</td><td class="ov-dim">${f.who || ''}${f.source ? ' - ' + f.source.replace(/^studio:[a-z0-9]+/, 'studio') : ''}, ${ago(f.created)} ago, applied ${f.hits}x</td><td class="ov-go">${canWrite() ? html`<button class="ov-link" onClick=${() => toggle(f)}>${f.active ? 'switch off' : 'switch on'}</button> <button class="ov-link" onClick=${() => { if (window.confirm('Delete this rule? The Studio will forget it.')) del(f); }}>delete</button>` : null}</td></tr>`)}</tbody></table>`}`}
    </div></div>`;
  }

  /* ------------------------------------------------------------ the layout editor: drag, resize and nudge the layers over the same renderer */
  function LayoutEditor({ v, a, ns, onDone }) {
    // the working layout with its history: every finished gesture or command is one step that undo and redo walk
    const [hist, setHist] = useState(() => ({ past: [], now: JSON.parse(JSON.stringify(v.layout)), future: [] }));
    const layout = hist.now;
    const [sel, setSelIds] = useState([]); const [focusId, setFocus] = useState(null); const [guides, setGuides] = useState(true); const [scaleType, setScaleType] = useState(false); const box = useRef(null); const act = useRef(null);
    const clickFocus = useRef(null);   // the layer being focused by a click (the click already chose the selection; keyboard focus selects)
    const commit = next => setHist(h => ({ past: h.past.concat([h.now]).slice(-80), now: next, future: [] }));
    const live = next => setHist(h => Object.assign({}, h, { now: next }));            // during a drag; the step is committed on release
    const undo = () => setHist(h => h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now].concat(h.future) } : h);
    const redo = () => setHist(h => h.future.length ? { past: h.past.concat([h.now]), now: h.future[0], future: h.future.slice(1) } : h);
    const layers = layout.layers;
    const byId = id => layers.find(l => l.id === id);
    const groupOf = id => { const l = byId(id); return l && l.group ? layers.filter(x => x.group === l.group).map(x => x.id) : [id]; };
    const selected = () => Array.from(new Set(sel.reduce((acc, id) => acc.concat(groupOf(id)), []))).map(byId).filter(Boolean);
    const movable = l => l && !l.locked;
    const patchMany = (L, patches) => Object.assign({}, L, { layers: L.layers.map(l => (patches[l.id] ? Object.assign({}, l, patches[l.id]) : l)) });
    const r1 = x => Math.round(x * 10) / 10;
    const pick = (e, l) => { setFocus(l.id); setSelIds(s => e.shiftKey ? (s.indexOf(l.id) >= 0 ? s.filter(x => x !== l.id) : s.concat([l.id])) : (s.indexOf(l.id) >= 0 && s.length > 1 ? s : [l.id])); };
    const down = (e, l, mode) => { e.preventDefault(); e.stopPropagation(); pick(e, l);
      // preventDefault keeps the browser from focusing the layer, so focus it by hand: the arrow keys then nudge what was clicked
      try { const el = mode === 'move' ? e.currentTarget : e.currentTarget.parentElement; if (el && el.focus) { clickFocus.current = l.id; el.focus({ preventScroll: true }); clickFocus.current = null; } } catch (x) {}
      if (l.locked) return; const r = box.current.getBoundingClientRect();
      const ids = mode === 'move' ? Array.from(new Set((sel.indexOf(l.id) >= 0 ? sel : [l.id]).reduce((acc, id) => acc.concat(groupOf(id)), []))) : [l.id];
      act.current = { id: l.id, ids, mode, sx: e.clientX, sy: e.clientY, start: layout, rw: r.width, rh: r.height }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const move = e => { const c = act.current; if (!c) return; const dx = (e.clientX - c.sx) / c.rw * 100, dy = (e.clientY - c.sy) / c.rh * 100; const patches = {};
      if (c.mode === 'move') c.ids.forEach(id => { const o = c.start.layers.find(x => x.id === id); if (movable(o)) patches[id] = { x: r1(Math.max(-o.w + 2, Math.min(98, o.x + dx))), y: r1(Math.max(-2, Math.min(98, o.y + dy))) }; });
      // the corner resizes the box; the type keeps its size unless "resize scales type" is on (then it scales with the width, as before)
      else { const o = c.start.layers.find(x => x.id === c.id); if (o.type === 'text' && scaleType) { const w = Math.max(10, o.w + dx); patches[o.id] = { w: r1(w), size: r1(Math.max(2.4, o.size * (w / o.w))), h: r1((o.h || 0) * (w / o.w)) }; } else patches[o.id] = { w: r1(Math.max(o.type === 'text' ? 6 : 4, o.w + dx)), h: r1(Math.max(2, (o.h || 0) + dy)) }; }
      live(patchMany(c.start, patches)); };
    const up = () => { const c = act.current; act.current = null; if (c && JSON.stringify(c.start) !== JSON.stringify(layout)) setHist(h => ({ past: h.past.concat([c.start]).slice(-80), now: h.now, future: [] })); };
    const nudge = (dx, dy) => { const s = selected().filter(movable); if (!s.length) return; const patches = {}; s.forEach(l => { patches[l.id] = { x: r1(l.x + dx), y: r1(l.y + dy) }; }); commit(patchMany(layout, patches)); };
    // alignment: to the selection's bounds when two or more are chosen, to the stage's 3% margin when one is
    const align = how => { const s = selected().filter(movable); if (!s.length) return; const one = s.length === 1; const m = 3;
      const L0 = one ? m : Math.min.apply(null, s.map(l => l.x)), R0 = one ? 100 - m : Math.max.apply(null, s.map(l => l.x + l.w)), T0 = one ? m : Math.min.apply(null, s.map(l => l.y)), B0 = one ? 100 - m : Math.max.apply(null, s.map(l => l.y + (l.h || 0)));
      const patches = {}; s.forEach(l => { const h = l.h || 0; patches[l.id] = how === 'left' ? { x: r1(L0) } : how === 'right' ? { x: r1(R0 - l.w) } : how === 'centre' ? { x: r1((L0 + R0) / 2 - l.w / 2) } : how === 'top' ? { y: r1(T0) } : how === 'bottom' ? { y: r1(B0 - h) } : { y: r1((T0 + B0) / 2 - h / 2) }; });
      commit(patchMany(layout, patches)); };
    const distribute = axis => { const s = selected().filter(movable).slice().sort((p, q) => axis === 'v' ? p.y - q.y : p.x - q.x); if (s.length < 3) return;
      const size = l => axis === 'v' ? (l.h || 0) : l.w; const pos = l => axis === 'v' ? l.y : l.x; const first = s[0], last = s[s.length - 1];
      const gap = (pos(last) + size(last) - pos(first) - s.reduce((n, l) => n + size(l), 0)) / (s.length - 1); let at = pos(first); const patches = {};
      s.forEach(l => { patches[l.id] = axis === 'v' ? { y: r1(at) } : { x: r1(at) }; at += size(l) + gap; }); commit(patchMany(layout, patches)); };
    // paint order: the selection (a group moves as one) goes to the front or back, or one step, keeping its own order
    const reorder = how => { const s = selected(); if (!s.length) return; const set = new Set(s.map(l => l.id)); const rest = layers.filter(l => !set.has(l.id)); const block = layers.filter(l => set.has(l.id));
      let at; const firstI = layers.findIndex(l => set.has(l.id)); const before = layers.slice(0, firstI).filter(l => !set.has(l.id)).length;
      at = how === 'front' ? rest.length : how === 'back' ? 0 : how === 'forward' ? Math.min(rest.length, before + 1) : Math.max(0, before - 1);
      commit(Object.assign({}, layout, { layers: rest.slice(0, at).concat(block, rest.slice(at)) })); };
    const group = () => { const s = selected(); if (s.length < 2) return; const g = 'g' + Date.now().toString(36); const patches = {}; s.forEach(l => { patches[l.id] = { group: g }; }); commit(patchMany(layout, patches)); };
    const ungroup = () => { const patches = {}; selected().forEach(l => { patches[l.id] = { group: undefined }; }); commit(patchMany(layout, patches)); };
    const setOne = (id, patch) => commit(patchMany(layout, { [id]: patch }));
    const keyAll = e => { const mod = e.metaKey || e.ctrlKey;
      // a key typed into a field edits the field: the canvas shortcuts (nudge, undo, redo, escape) never take it
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable)) return;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') { setSelIds([]); return; }
      const step = e.shiftKey ? 2 : 0.5; const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]; if (d) { e.preventDefault(); nudge(d[0], d[1]); } };
    // the same validation the readiness uses, at the output size, on the working layout (debounced)
    const comp = useComposition(Object.assign({}, v, { layout }), ns, layout, v.copy);
    const [val, setVal] = useState(null);
    useEffect(() => { if (!comp.ready) return; const t = setTimeout(() => { try { setVal(R.validate(layout, v.copy, comp.imgs, { fonts: comp.fonts, channel: a.channel, format: a.format })); } catch (e) { setVal(null); } }, 250); return () => clearTimeout(t); }, [layout, comp.key, comp.ready]);
    const bad = new Set(); (val ? val.issues : []).filter(i => i.severity === 'blocking').forEach(i => i.layers.forEach(id => bad.add(id)));
    const story = a.format === '9:16' && a.channel === 'instagram';
    const changed = JSON.stringify(layout) !== JSON.stringify(v.layout);
    const one = selected().length === 1 ? selected()[0] : null;
    // the type panel follows the layer last clicked, even inside a group (type is set per layer)
    const typed = focusId && sel.length && byId(focusId) && byId(focusId).type === 'text' ? byId(focusId) : one;
    const tb = (label, fn, dis, title) => html`<button class="btn sm ghost" disabled=${dis} title=${title || label} onClick=${fn}>${label}</button>`;
    return html`<div class="st-le-wrap" onKeyDown=${keyAll}>
      <div class="st-le-tools" role="toolbar" aria-label="Canvas tools">
        ${tb('Undo', undo, !hist.past.length, 'Undo (Ctrl or Cmd+Z)')}${tb('Redo', redo, !hist.future.length, 'Redo (Ctrl or Cmd+Shift+Z)')}
        <span class="st-le-sep"></span>${['left', 'centre', 'right', 'top', 'middle', 'bottom'].map(h => tb('Align ' + h, () => align(h), !selected().length, 'Align ' + h + (selected().length > 1 ? ' to the selection' : ' to the stage margin')))}
        ${tb('Distribute across', () => distribute('h'), selected().length < 3)}${tb('Distribute down', () => distribute('v'), selected().length < 3)}
        <span class="st-le-sep"></span>${tb('To front', () => reorder('front'), !selected().length)}${tb('Forward', () => reorder('forward'), !selected().length)}${tb('Backward', () => reorder('backward'), !selected().length)}${tb('To back', () => reorder('back'), !selected().length)}
        <span class="st-le-sep"></span>${tb('Group', group, selected().length < 2)}${tb('Ungroup', ungroup, !selected().some(l => l.group))}
        <label class="st-check"><input type="checkbox" checked=${guides} onChange=${e => setGuides(e.target.checked)} /> safe-area guides</label>
        <label class="st-check" title="Off: the corner changes the text box and the words rewrap at the same size. On: the type scales with the box width."><input type="checkbox" checked=${scaleType} onChange=${e => setScaleType(e.target.checked)} aria-label="Resize scales type" /> resize scales type</label>
      </div>
      <div class="st-le" ref=${box} onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onPointerDown=${e => { if (e.target === box.current) setSelIds([]); }}>
        <${Composition} v=${Object.assign({}, v, { layout })} a=${a} ns=${ns} />
        ${guides ? html`<div class="st-le-guide" style=${{ left: '3%', top: '3%', right: '3%', bottom: '3%' }} title="3% margin"></div>${story ? html`<div class="st-le-zone" style=${{ left: 0, right: 0, top: 0, height: '14%' }} title="Instagram story interface (top 14%)"></div><div class="st-le-zone" style=${{ left: 0, right: 0, bottom: 0, height: '20%' }} title="Instagram story interface (bottom 20%)"></div>` : null}` : null}
        ${layers.filter(l => !l.hidden).map(l => html`<div key=${l.id} class=${'st-le-layer' + (sel.indexOf(l.id) >= 0 || (l.group && sel.some(id => (byId(id) || {}).group === l.group)) ? ' sel' : '') + (l.locked ? ' locked' : '') + (bad.has(l.id) ? ' bad' : '')} tabIndex="0" role="button" aria-label=${'Layer ' + (l.role || l.id)} aria-pressed=${sel.indexOf(l.id) >= 0} style=${{ left: l.x + '%', top: l.y + '%', width: l.w + '%', height: (l.h || 4) + '%' }} onPointerDown=${e => down(e, l, 'move')} onFocus=${() => { if (clickFocus.current !== l.id && sel.indexOf(l.id) < 0) setSelIds([l.id]); }}>
          <span class="st-le-lbl">${l.role || l.type}${l.locked ? ' (locked)' : ''}${l.group ? ' (grouped)' : ''}</span>${!l.locked ? html`<span class="st-le-h" onPointerDown=${e => down(e, l, 'resize')}></span>` : null}
        </div>`)}
      </div>
      ${val ? html`<div class=${'st-le-val' + (val.ok ? '' : ' bad')} role="status">${val.ok ? 'Measured at ' + val.W + 'x' + val.H + ': no blocking issue' + (val.issues.length ? ' (' + val.issues.map(i => i.code.replace(/_/g, ' ')).join(', ') + ')' : '') : 'Measured at ' + val.W + 'x' + val.H + ': ' + val.issues.filter(i => i.severity === 'blocking').map(i => i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')).join('; ')}</div>` : null}
      ${typed && typed.type === 'text' && !typed.locked ? (one => html`<div class="st-le-type" aria-label="Typography">
        <span class="st-lbl">Type: ${one.role}</span>
        <label>Size <input class="st-in" type="number" step="0.1" min="1" max="20" value=${one.size} onChange=${e => setOne(one.id, { size: r1(Math.max(1, +e.target.value || one.size)) })} aria-label="Type size, per cent of the width" /></label>
        <label>Weight <select class="st-sel" value=${String(one.weight || 600)} onChange=${e => setOne(one.id, { weight: +e.target.value })} aria-label="Weight">${[400, 500, 600, 700, 800, 900].map(w => html`<option key=${w} value=${String(w)}>${w}</option>`)}</select></label>
        <label>Align <select class="st-sel" value=${one.align || 'left'} onChange=${e => setOne(one.id, { align: e.target.value })} aria-label="Text alignment"><option value="left">left</option><option value="center">centre</option><option value="right">right</option></select></label>
        <label>Line height <input class="st-in" type="number" step="0.02" min="0.8" max="2" value=${one.lineHeight || 1.12} onChange=${e => setOne(one.id, { lineHeight: Math.round(Math.max(0.8, Math.min(2, +e.target.value || 1.12)) * 100) / 100 })} aria-label="Line height, times the type size" /></label>
        <label>Tracking <input class="st-in" type="number" step="0.01" min="-0.05" max="0.3" value=${one.letterSpacing || 0} onChange=${e => setOne(one.id, { letterSpacing: Math.round((+e.target.value || 0) * 100) / 100 })} aria-label="Letter spacing, em" /></label>
        <label>Colour <input class="st-in" value=${one.color || '#ffffff'} onChange=${e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value)) setOne(one.id, { color: e.target.value }); }} aria-label="Colour" /></label>
        <label>Emphasis <select class="st-sel" value=${one.emphasis || ''} onChange=${e => setOne(one.id, { emphasis: e.target.value || undefined })} aria-label="Emphasis"><option value="">none</option><option value="caps">caps</option><option value="highlight">highlight</option><option value="underline">underline</option><option value="box">box</option></select></label>
      </div>`)(typed) : null}
      ${one && !one.locked ? html`<div class="st-le-type" aria-label="Position and size">
        <span class="st-lbl">Box: ${one.role || one.type}</span>
        ${[['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].map(([k, lb]) => html`<label key=${k}>${lb} <input class="st-in" type="number" step="0.5" min=${k === 'w' || k === 'h' ? 1 : -50} max=${150} value=${one[k] == null ? 0 : one[k]} onChange=${e => { const n = +e.target.value; if (isFinite(n)) setOne(one.id, { [k]: r1(k === 'w' || k === 'h' ? Math.max(1, n) : n) }); }} aria-label=${lb + ', per cent of the stage'} /></label>`)}
        ${one.type === 'shape' ? html`<label>Opacity <input class="st-in" type="number" step="0.05" min="0" max="1" value=${one.opacity == null ? 1 : one.opacity} onChange=${e => setOne(one.id, { opacity: Math.round(Math.max(0, Math.min(1, +e.target.value)) * 100) / 100 })} aria-label="Panel opacity" /></label><label>Fill <input class="st-in" value=${one.fill || ''} onChange=${e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value) || /^rgba?\(/.test(e.target.value)) setOne(one.id, { fill: e.target.value }); }} aria-label="Panel fill" /></label>` : null}
      </div>` : null}
      ${(() => { // image framing: the background photograph, or the image region selected
        const reg = one && one.type === 'img' && one.role === 'region' && !one.locked ? one : null; if (!reg && !(v.image && v.image.url)) return null;
        const f = (reg ? reg.focus : layout.imageFocus) || {}; const cur = { x: f.x == null ? 50 : f.x, y: f.y == null ? 50 : f.y, zoom: f.zoom || 1 };
        const set = (k, n) => { const nf = Object.assign({}, cur, { [k]: n }); const plain = nf.x === 50 && nf.y === 50 && nf.zoom === 1; if (reg) setOne(reg.id, { focus: plain ? undefined : nf }); else commit(Object.assign({}, layout, { imageFocus: plain ? undefined : nf })); };
        return html`<div class="st-le-type" aria-label="Image framing"><span class="st-lbl">Framing: ${reg ? 'image region ' + (reg.region || reg.id) : 'the photograph'}</span>
          <label>Across <input type="range" min="0" max="100" step="1" value=${cur.x} onChange=${e => set('x', +e.target.value)} aria-label="Focal point across, per cent" /></label>
          <label>Down <input type="range" min="0" max="100" step="1" value=${cur.y} onChange=${e => set('y', +e.target.value)} aria-label="Focal point down, per cent" /></label>
          <label>Zoom <input class="st-in" type="number" step="0.05" min="1" max="3" value=${cur.zoom} onChange=${e => set('zoom', Math.round(Math.max(1, Math.min(3, +e.target.value || 1)) * 100) / 100)} aria-label="Image zoom" /></label>
          <button class="ov-link" onClick=${() => { if (reg) setOne(reg.id, { focus: undefined }); else commit(Object.assign({}, layout, { imageFocus: undefined })); }}>centre</button>
          <span class="ov-dim">reframes the same image: no render</span></div>`; })()}
      <div class="st-le-list">${layers.slice().reverse().map(l => html`<span key=${l.id} class=${'st-le-item' + (sel.indexOf(l.id) >= 0 ? ' on' : '')}><button class="ov-link" onClick=${e => pick(e, l)}>${l.role || l.type}</button> <button class="st-lock" onClick=${() => setOne(l.id, { hidden: !l.hidden })} title="Hide or show this element">${l.hidden ? 'show' : 'hide'}</button> <button class=${'st-lock' + (l.locked ? ' on' : '')} onClick=${() => setOne(l.id, { locked: !l.locked })} title="A locked element keeps its place through directions and hand edits">${l.locked ? 'locked' : 'lock'}</button></span>`)}</div>
      <div class="st-msg-foot" style=${{ marginTop: 8 }}><span class="ov-dim">Drag to move (Shift-click to select several; grouped layers move together), the corner to resize the box (the type keeps its size unless "resize scales type" is on), arrow keys nudge (Shift for 2%), Ctrl or Cmd+Z undoes. The list runs from front to back.</span><button class="btn sm" disabled=${!changed} onClick=${() => onDone(layout)}>Save layout${changed ? '' : ' (unchanged)'}</button><button class="btn sm ghost" onClick=${() => onDone(null)}>Cancel</button></div>
    </div>`;
  }

  /* ------------------------------------------------------------ dialogs */
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
    const saved0 = useMemo(() => store.get(), []);
    const [clientId, setClientId] = useState(saved0.client && CLIENTS.some(c => c.id === saved0.client) ? saved0.client : (CLIENTS[0] ? CLIENTS[0].id : 'mca'));
    const [lib, setLib] = useState(null); const [libErr, setLibErr] = useState('');
    const [status, setStatus] = useState(null);
    const [kit, setKit] = useState(null);
    const [pid, setPid] = useState(null); const [p, setP] = useState(null);
    const [intake, setIntake] = useState(false);
    const [view, setView0] = useState('brief');
    const [selAsset, setSelAsset] = useState(null); const [selField, setSelField] = useState(null);
    const [target, setTarget] = useState('asset');
    const [busy, setBusy] = useState('');
    const [cmp, setCmp] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [exportState, setExportState] = useState(null);
    const [preset, setPreset] = useState(null); const [panel, setPanel] = useState(null); const [ctxTick, setCtxTick] = useState(0);
    const [notice, setNotice] = useState(null);
    const [tab, setTab] = useState('copy');
    const [slot, setSlot] = useState(null);
    const [toolsOpen, setToolsOpen0] = useState(saved0.tools !== false);
    const [partnerOpen, setPartnerOpen0] = useState(saved0.partner !== false);
    const [saveSt, setSaveSt] = useState({ pending: 0, err: null, at: 0 });
    const [typing, setTyping] = useState(0);
    const [conflict, setConflict] = useState(null);
    const stepping = useRef(new Set()); const pidRef = useRef(null); pidRef.current = pid;
    const pRef = useRef(null); const pSeen = useRef(null); if (pSeen.current !== p) { pSeen.current = p; pRef.current = p; }
    const clientRef = useRef(clientId); clientRef.current = clientId;
    const once = useRef(new Set()); const libSeq = useRef(0); const resumed = useRef(false); const intakeRef = useRef(false); intakeRef.current = intake;
    const titleRef = useRef(null); const focusNext = useRef(false); const typingSet = useRef(new Set());
    const client = CLIENTS.find(c => c.id === clientId) || CLIENTS[0] || FALLBACK_CLIENTS[0];
    const a = p ? p.assets.find(x => x.id === selAsset) || null : null;
    const prov = status && status.keys ? { claude: !!status.keys.claude, gemini: !!status.keys.gemini } : null;
    const setToolsOpen = v => { setToolsOpen0(v); store.set({ tools: v }); };
    const setPartnerOpen = v => { setPartnerOpen0(v); store.set({ partner: v }); };
    /* a view change from a deliberate navigation moves focus to the stage's heading, so a keyboard or screen-reader user lands on it */
    const setView = useCallback((v, focus) => { setView0(v); setCmp(null); if (focus) focusNext.current = true; }, []);
    // the heading is brought to just under the sticky context bar and navigator (its scroll-margin), so a new stage starts at its top
    useEffect(() => { if (focusNext.current && titleRef.current) { focusNext.current = false; try { titleRef.current.focus({ preventScroll: true }); titleRef.current.scrollIntoView({ block: 'start' }); } catch (e) {} } }, [view, p && p.id]);
    /* suggested next directions for the selected composition: one small, cached model call per version, made only when the team asks for it */
    const [sugg, setSugg] = useState(null); const suggSig = useRef('');
    const av = a ? current(a) : null; const suggKey = a && av && av.mode !== 'copy' && av.mode !== 'generated' && p && !p.readOnly && canWrite() && prov && prov.claude ? a.id + '|' + av.id + '|' + p.references.length : '';
    const fetchSugg = useCallback(async (refresh) => {
      if (!suggKey) { setSugg(null); return; }
      suggSig.current = suggKey; setSugg(s => ({ loading: true, data: refresh ? null : (s && s.data) || null, err: '' }));
      try { const d = await call('/studio/suggest', { project: pidRef.current, asset: suggKey.split('|')[0], refresh: !!refresh }); if (suggSig.current !== suggKey) return; if (d.ok) setSugg({ loading: false, data: d, err: '' }); else setSugg({ loading: false, data: null, err: d.detail || d.error || 'no answer' }); }
      catch (e) { if (suggSig.current === suggKey) setSugg({ loading: false, data: null, err: e.message }); }
    }, [suggKey]);
    // asked for, never fetched on its own: a new version (every pause in typing makes one) must not spend a call by itself
    useEffect(() => { suggSig.current = suggKey; setSugg(suggKey ? { idle: true, data: null, err: '' } : null); }, [suggKey]);

    const refreshStatus = useCallback(() => call('/studio/status').then(s => { setStatus(s); return s; }).catch(() => null), []);
    /* the library of one client; a slower answer for a client no longer chosen is dropped, never shown */
    const loadLib = useCallback(async () => {
      const seq = ++libSeq.current; const ns = clientId; setLib(null); setLibErr(''); setKit(null);
      try {
        const [l, s, k] = await Promise.all([call('/studio/list?ns=' + encodeURIComponent(ns)), call('/studio/status').catch(() => null), call('/brand/kit?ns=' + encodeURIComponent(ns)).catch(() => null)]);
        if (seq !== libSeq.current || clientRef.current !== ns) return;
        setLib(Object.assign({}, l, { status: s })); if (s) setStatus(s); setKit(k && k.kit ? k.kit : {});
        // reopen the project this browser had open for this client, where it was left (unless another desk sent work in)
        if (!resumed.current) { resumed.current = true; const pl = store.place(ns); if (pl && pl.open && !intakeRef.current && (l.projects || []).some(x => x.id === pl.pid)) { const d = await openProject(pl.pid, pl); if (d) setNotice({ kind: 'info', title: 'Resumed where you left off.', text: d.title + ': ' + ((STAGES.find(x => x.views.indexOf(pl.view) >= 0) || {}).label || 'Brief') + (pl.asset && d.assets.some(x => x.id === pl.asset) ? ', ' + d.assets.find(x => x.id === pl.asset).title : '') + '.', actions: [{ label: 'All projects', fn: () => closeProject() }] }); } }
      } catch (e) { if (seq === libSeq.current) setLibErr(e.code || e.message); }
    }, [clientId]);
    useEffect(() => { loadLib(); }, [loadLib]);
    useEffect(() => { store.set({ client: clientId }); }, [clientId]);
    useEffect(() => { if (pid && p && p.id === pid && !p.readOnly) store.setPlace(clientId, { pid, view: view === 'export' ? 'review' : view, asset: selAsset, open: true, title: p.title }); }, [pid, view, selAsset, p && p.id]);
    /* the Release Desk, the Content Desk, the Sentinel and Client Central open the Studio's intake with their brief */
    useGoto('studio', q => { q = q || {}; resumed.current = true; if (q.ns && CLIENTS.some(c => c.id === q.ns) && q.ns !== clientId) setClientId(q.ns); setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); if (q.intake) { setPreset({ start: q.intake, deliverable: q.deliverable, text: q.text, instruction: q.instruction, from: q.from, at: q.at || Date.now() }); setIntake(true); } });
    const reload = useCallback(async (id) => {
      const want = id || pidRef.current; if (!want) return null;
      // the ref moves with the answer, not with the next render: a write that follows a reload in the same handler sends the fresh revision
      try { const d = await call('/studio/get?id=' + encodeURIComponent(want)); if (pidRef.current === want) { pRef.current = d; setP(d); } return d; } catch (e) { if (pidRef.current === want) setNotice(Object.assign(explain(e, 'The project did not load'), { actions: [{ label: 'Try again', fn: () => reload(want) }] })); return null; }
    }, []);
    /* an error explained where the work is, with a real retry when one makes sense; a provider problem refreshes the status chips */
    const fail = (e, what, retry) => { const x = explain(e, what); setNotice(Object.assign(x, { actions: retry ? [{ label: 'Retry', fn: retry }] : [] })); setBusy(''); if (x.kind === 'provider') refreshStatus(); };
    /* the same action twice while it is still running is refused here, before any request: a double click never makes two jobs or two charges */
    const guard = async (key, fn) => { if (once.current.has(key)) { setNotice({ kind: 'info', title: 'Already in progress.', text: 'That was not started a second time.' }); return null; } once.current.add(key); try { return await fn(); } finally { once.current.delete(key); } };

    /* a job: step it until it ends; a lease held elsewhere is waited out; the project is reloaded as it moves */
    const runJob = useCallback(async (id, label) => {
      if (stepping.current.has(id)) return null; stepping.current.add(id);
      try {
        let waits = 0;
        for (let i = 0; i < 60; i++) {
          if (label) setBusy(label);
          let j;
          try { j = (await call('/studio/job/step', { id })).job; } catch (e) { fail(e, 'The job could not be stepped', () => runJob(id, label)); break; }
          const d = await reload();
          if (j.state === 'done' || j.state === 'failed' || j.state === 'cancelled') {
            if (j.state === 'failed' && pidRef.current === j.project) { const x = explain({ message: j.error, code: (String(j.error).match(/^[a-z_0-9]+/) || [''])[0] }, 'The ' + j.stage + ' step failed'); setNotice(Object.assign(x, { title: x.title + (x.title.indexOf(j.stage) < 0 ? ' (' + j.stage + ')' : ''), actions: canWrite() && !/not retried|not_configured|budget_exhausted|account_limit/.test(j.error) ? [{ label: 'Retry ' + j.stage, fn: () => retryJob(j) }, { label: 'Jobs', fn: () => setView('jobs', true) }] : [{ label: 'Jobs', fn: () => setView('jobs', true) }] })); if (x.kind === 'provider') refreshStatus(); }
            return j;
          }
          // a recipe step waits for the one before it: that one is stepped in its turn (or by the tick), so this one is left, not spun
          if (j.note && /waiting for the step before/.test(j.note)) { if (++waits >= 4) return j; await sleep(2500); continue; }
          await sleep(j.note && /another runner/.test(j.note) ? 3000 : 600);
        }
      } finally { stepping.current.delete(id); setBusy(''); }
      return null;
    }, [reload]);
    /* the composed tile for one version, drawn by the one renderer at native size and saved as that version's export PNG */
    const composeExport = useCallback(async (d, assetId, versionId) => {
      try {
        const as = (d.assets || []).find(x => x.id === assetId); if (!as) return false; const v = versionId ? as.versions.find(x => x.id === versionId) : current(as);
        if (!v || !v.layout || !Array.isArray(v.layout.layers) || !canWrite() || d.readOnly) return false;
        const imgs = await loadImages(v, d.ns); const fonts = await R.ensureFonts(v.layout, v.copy, { timeout: 4000 });
        const val = R.validate(v.layout, v.copy, imgs, { fonts, channel: as.channel, format: as.format });
        const blob = await R.toBlob(v.layout, v.copy, imgs); const u8 = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        await call('/studio/validation', { asset: as.id, version: v.id, report: R.report(v, val), imageB64: btoa(bin), mime: 'image/png' }); return true;
      } catch (e) { return false; }
    }, []);
    /* anything queued (renders the copy stage enqueued) is run in turn while the tab is open */
    const pump = useCallback(async (d) => {
      let cur = d || pRef.current; const seen = new Set();
      for (let round = 0; round < 10 && cur; round++) {
        const st = {}; (cur.jobs || []).forEach(j => { st[j.id] = j.state; });
        const jobs = (cur.jobs || []).filter(j => j.state === 'queued' && !stepping.current.has(j.id) && !seen.has(j.id) && !(j.after && (st[j.after] === 'queued' || st[j.after] === 'running'))).sort((x, y) => x.created - y.created);
        if (!jobs.length) break;
        for (const j of jobs) { seen.add(j.id); if (pidRef.current !== j.project) return; if (j.stage === 'inspect') await composeExport(cur, j.asset, (j.input || {}).version); await runJob(j.id, (j.stage === 'render' ? 'Rendering ' + (((j.input || {}).approach === 'artwork') ? 'the full artwork' : (j.input || {}).region && (j.input || {}).region !== 'bg' ? 'the ' + (j.input || {}).regionRole + ' image' : 'the background') + ' at ' + ((j.input || {}).size || '2K') : j.stage === 'inspect' ? 'The art director inspects the result' : 'Running ' + j.stage) + (cur.assets || []).filter(x => x.id === j.asset).map(x => ' for ' + x.title).join('')); }
        cur = await reload();
      }
    }, [runJob, reload, composeExport]);
    const openProject = async (id, place) => {
      setPid(id); pidRef.current = id; setCmp(null); setIntake(false); setP(null); setNotice(null); setConflict(null); setExportState(null); setTab('copy');
      const d = await reload(id); if (!d) { setPid(null); pidRef.current = null; return null; }
      const asset = place && place.asset && d.assets.some(x => x.id === place.asset) ? place.asset : d.assets[0] ? d.assets[0].id : null;
      setSelAsset(asset); setSelField(null);
      const want = place && place.view && stageOfView(place.view) && (place.view !== 'asset' || asset) ? place.view : d.assets.length ? 'asset' : d.directions.length ? 'directions' : 'brief';
      setView(want, true);
      refreshStatus();
      if (!d.readOnly) pump(d);
      return d;
    };
    const closeProject = () => { const pl = store.place(clientRef.current); if (pl) store.setPlace(clientRef.current, Object.assign({}, pl, { open: false })); setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); setConflict(null); setExportState(null); setSugg(null); loadLib(); };
    /* switching client leaves nothing of the other client on screen: project, kit, suggestions, notices, export, dialogs */
    const switchClient = id => { if (id === clientId) return; resumed.current = true; setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); setConflict(null); setExportState(null); setDialog(null); setPanel(null); setPreset(null); setIntake(false); setSelAsset(null); setSelField(null); setSugg(null); setKit(null); setLib(null); setTab('copy'); setClientId(id); };

    const job = async (stage, input, asset, idem, label) => { const r = await call('/studio/job', { project: pidRef.current, asset: asset || undefined, stage, input, idem }); return runJob(r.job.id, label); };
    const produce = (extra) => guard('produce:' + pidRef.current, async () => {
      try {
        const d = pRef.current || await reload(); const b = d.brief || {}; const channels = (b.channels || []).filter(c => CHANNELS[c]);
        if (!channels.length) { setNotice({ kind: 'warn', title: 'No channels in the brief.', text: 'Choose at least one channel, then produce.', actions: [{ label: 'Open the brief', fn: () => setView('brief', true) }] }); return; }
        const imagery = (extra && extra.imagery) || (b.imagery === 'none' ? 'none' : undefined);
        const before = new Set(d.assets.map(x => x.id));
        const j = await job('copy', { channels, deliverable: b.deliverable || 'set', formats: b.formats || {}, template: b.template || '', instruction: (extra && extra.instruction) || '', acknowledge: !!(extra && extra.acknowledge) || undefined, size: imagery === 'none' ? undefined : (extra && extra.size) || b.size || undefined, imagery: imagery === 'none' ? 'none' : undefined, quick: !!(extra && extra.instruction) || undefined }, null, 'copy:' + pidRef.current + ':' + Date.now(), 'Writing ' + channels.length + ' piece' + (channels.length === 1 ? '' : 's') + ' in the ' + (d.ns || '').toUpperCase() + ' voice' + ((b.deliverable || 'set') === 'copy' ? ', copy only' : ', then laying out compositions'));
        const d2 = await reload(); const fresh = d2 ? d2.assets.filter(x => !before.has(x.id)) : [];
        if (fresh.length) { setSelAsset(fresh[0].id); setTab('copy'); setView('asset', true); }
        if (j && j.state === 'done') pump(d2);
      } catch (e) { fail(e, 'Production did not start', () => produce(extra)); }
    });
    const direct = (n) => guard('direct:' + pidRef.current, async () => { n = Math.max(1, Math.min(5, +n || 3)); try { const j = await job('direct', { n, channels: ((pRef.current && pRef.current.brief) || {}).channels || [] }, null, 'direct:' + pidRef.current + ':' + Date.now(), 'Proposing ' + n + ' direction' + (n === 1 ? '' : 's') + ' from the brief, the strategy and the ledger'); if (j && j.state === 'done') setView('directions', true); } catch (e) { fail(e, 'Directions did not start', () => direct(n)); } });
    const draftStrategy = (instruction) => guard('strategy:' + pidRef.current, async () => { try { await job('strategy', { instruction: instruction || undefined }, null, 'strategy:' + pidRef.current + ':' + Date.now(), 'Drafting the creative strategy'); setView('brief'); } catch (e) { fail(e, 'The strategy did not start', () => draftStrategy(instruction)); } });
    const planSequence = (input) => guard('sequence:' + pidRef.current, async () => { try { await job('sequence', input, null, 'sequence:' + pidRef.current + ':' + Date.now(), 'Planning the campaign sequence'); setView('sequence'); } catch (e) { fail(e, 'The sequence did not start', () => planSequence(input)); } });
    const createProject = (o) => guard('create:' + clientId, async () => {
      try {
        setBusy('Creating the project'); setIntake(false);
        const formats = {}; o.channels.forEach(c => { formats[c] = (CHANNELS[c] || {}).format || '1:1'; }); if (o.deliverable === 'visual') formats.instagram = '4:5';
        const brief = { objective: o.start === 'brief' ? o.text : o.start === 'reference' ? 'Adapt the reference: ' + o.text : '', audience: '', message: '', deliverables: (o.deliverable === 'copy' ? 'Copy only for ' : o.deliverable === 'visual' ? 'Visual creative for ' : 'Coordinated set for ') + o.channels.map(chanLabel).join(', '), channels: o.channels, deliverable: o.deliverable, formats, campaignConfirmed: !!o.campaignConfirmed, assumptions: ['Organic, not paid (assumed; edit if wrong)'].concat(o.campaign ? [] : ['No campaign chosen: campaign identity and campaign facts will not apply']) };
        const pr = await call('/studio/project', { ns: client.id, campaign: o.campaign, title: (o.start === 'release' ? (o.text.split('\n').map(s => s.trim()).filter(s => s && !/^media release/i.test(s))[0] || 'Release') : o.text).slice(0, 80), brief, idem: 'p:' + client.id + ':' + Date.now() });
        setPid(pr.id); pidRef.current = pr.id; setSelAsset(null); setView('brief', true);
        if (o.start === 'release') { const s = await call('/studio/source', { project: pr.id, kind: 'release', name: 'Pasted release', text: o.text }); await reload(pr.id); await job('extract', { source: s.id }, null, 'extract:' + s.id, 'Reading the source: claims, figures and quotations with their passages'); }
        if (o.start === 'reference' && o.file) { await call('/studio/reference', { project: pr.id, kind: 'image', name: o.file.name, purpose: 'composition', imageB64: o.file.b64, mime: o.file.mime, note: 'from intake' }); }
        await reload(pr.id);
        if (o.route === 'guided') { await job('strategy', {}, null, 'strategy:' + pr.id, 'Drafting the creative strategy'); await direct(3); }
        else if (o.clear) await produce({ instruction: o.start === 'release' ? o.instruction : o.text }); else await direct();
      } catch (e) { fail(e, 'The project was not created'); } finally { setBusy(''); }
    });
    const setCampaign = async (cid) => { try { await call('/studio/project/update', { id: pRef.current.id, revision: pRef.current.revision, patch: { campaign: cid || '', brief: { campaignConfirmed: true } } }); await reload(); } catch (e) { if (e.status === 409) { await reload(); fail(e); } else fail(e, 'The campaign was not set'); } };
    /* the brief is saved on the latest revision; if a newer one arrived first, the team's changed fields are laid over it and
       saved again when nobody else changed the same field, and handed back as a clash when someone did - never overwritten */
    const saveBrief = async (b, base, force) => {
      const changedKeys = (from, to) => Array.from(new Set(Object.keys(from || {}).concat(Object.keys(to || {})))).filter(k => JSON.stringify((from || {})[k]) !== JSON.stringify((to || {})[k]));
      const put = async (brief) => { await call('/studio/project/update', { id: pRef.current.id, revision: pRef.current.revision, patch: { brief } }); const d = await reload(); return { ok: true, brief: d ? d.brief : brief }; };
      try { return await put(b); }
      catch (e) {
        if (e.status !== 409) { fail(e, 'The brief was not saved', () => saveBrief(b, base, force)); return { ok: false }; }
        const d = await reload(); if (!d) return { ok: false };
        const mine = changedKeys(base, b); const theirs = changedKeys(base, d.brief);
        const merged = Object.assign({}, d.brief); mine.forEach(k => { merged[k] = b[k]; });
        const clash = mine.filter(k => theirs.indexOf(k) >= 0 && JSON.stringify(d.brief[k]) !== JSON.stringify(b[k]));
        if (clash.length && !force) return { ok: false, clash, merged, theirs: d.brief };
        try { const r = await put(merged); setNotice({ kind: 'info', title: 'Brief saved and merged.', text: 'A newer brief had been saved meanwhile; your changes were laid over it' + (theirs.length ? ' (' + theirs.filter(k => mine.indexOf(k) < 0).join(', ') + ' kept from the newer version).' : '.') }); return r; }
        catch (e2) { fail(e2, 'The brief was not saved', () => saveBrief(b, base, force)); return { ok: false }; }
      }
    };
    const addSource = async (name, text) => { try { const s = await call('/studio/source', { project: p.id, kind: 'text', name, text }); await reload(); await job('extract', { source: s.id }, null, 'extract:' + s.id, 'Reading ' + name); } catch (e) { fail(e, 'The source was not added'); } };
    const addReference = async (r) => { try { setBusy('Adding the reference and reading it'); const d = await call('/studio/reference', Object.assign({ project: p.id, kind: 'image' }, r)); await reload(); toastMsg(d.analysis ? (d.analysis.error ? 'Reference added; not analysed: ' + d.analysis.error : 'Reference added and read') : 'Reference added'); } catch (e) { fail(e, 'The reference was not added'); } finally { setBusy(''); } };
    const saveRecipe = async (id, recipe) => { try { setBusy('Saving the recipe'); const d = await call('/studio/reference/recipe', Object.assign({ id, project: p.id }, recipe)); await reload(); toastMsg(d.recipe && d.recipe.conflict ? 'Saved, with a note: ' + d.recipe.conflict : 'Recipe saved', !!(d.recipe && d.recipe.conflict)); } catch (e) { fail(e, 'The recipe was not saved'); } finally { setBusy(''); } };
    const analyseReference = async (id) => { try { setBusy('Reading the reference'); const d = await call('/studio/reference/analyse', { id }); await reload(); toastMsg(d.ok ? 'Reference read' : 'Not analysed: ' + ((d.analysis || {}).error || ''), !d.ok); } catch (e) { fail(e, 'The reference was not read'); } finally { setBusy(''); } };
    const chooseDirection = async (did) => { try { await call('/studio/direction/choose', { id: did }); await reload(); await produce({}); } catch (e) { fail(e, 'The direction was not chosen'); } };

    /* text edits: one queue per asset, sent one at a time on the latest revision, so a fast second edit waits for the first
       instead of racing it; a revision taken by someone else is retried only when they did not touch the same words */
    const saveQ = useRef(new Map());
    const bump = (dn, extra) => setSaveSt(s => Object.assign({}, s, { pending: Math.max(0, s.pending + dn) }, extra || {}));
    const flushCopy = async (id) => {
      const q = saveQ.current.get(id); if (!q || q.running) return; q.running = true; q.failed = false; bump(1);
      try {
        while (Object.keys(q.patch).length) {
          const patch = q.patch; q.patch = {};
          let as = ((pRef.current || {}).assets || []).find(x => x.id === id); if (!as) break;
          const curCopy = (current(as) || {}).copy || {}; const changed = {};
          Object.keys(patch).forEach(k => { if ((curCopy[k] || '') !== patch[k]) changed[k] = patch[k]; });
          if (!Object.keys(changed).length) continue;
          const note = 'hand edit: ' + Object.keys(changed).join(', ');
          try { await call('/studio/version', { asset: id, revision: as.revision, copy: changed, note }); Object.keys(changed).forEach(k => { q.known[k] = changed[k]; }); }
          catch (e) {
            if (e.status === 409 && e.code === 'conflict') {
              const d = await reload(); as = d && d.assets.find(x => x.id === id); if (!as) throw e;
              const server = (current(as) || {}).copy || {};
              const clash = Object.keys(changed).filter(k => (server[k] || '') !== (q.known[k] != null ? q.known[k] : curCopy[k] || '') && (server[k] || '') !== changed[k]);
              if (clash.length) { setConflict({ asset: id, fields: clash, mine: changed }); q.patch = {}; break; }
              await call('/studio/version', { asset: id, revision: as.revision, copy: changed, note }); Object.keys(changed).forEach(k => { q.known[k] = changed[k]; });
            } else { q.patch = Object.assign({}, changed, q.patch); throw e; }
          }
          await reload();
        }
        setSaveSt(s => Object.assign({}, s, { err: null, at: Date.now() }));
      } catch (e) {
        q.failed = true; setSaveSt(s => Object.assign({}, s, { err: { asset: id, message: explain(e).title } }));
        fail(e, 'Your edit was not saved', () => flushCopy(id));
      } finally { q.running = false; bump(-1); if (Object.keys(q.patch).length && !q.failed) setTimeout(() => flushCopy(id), 0); }
    };
    const editAsset = (as, patch) => {
      const q = saveQ.current.get(as.id) || { patch: {}, known: {}, running: false };
      const cur = (((pRef.current || {}).assets || []).find(x => x.id === as.id) || as); const copy0 = (current(cur) || {}).copy || {};
      Object.keys(patch).forEach(k => { if (q.known[k] == null) q.known[k] = copy0[k] || ''; q.patch[k] = patch[k]; });
      saveQ.current.set(as.id, q); flushCopy(as.id);
    };
    const resolveConflict = async (which) => {
      const c = conflict; setConflict(null); if (!c) return;
      const q = saveQ.current.get(c.asset); if (q) c.fields.forEach(k => { delete q.known[k]; });
      if (which !== 'mine') { await reload(); return; }
      try { const as = (await reload()).assets.find(x => x.id === c.asset); const mine = {}; c.fields.forEach(k => { mine[k] = c.mine[k]; }); await call('/studio/version', { asset: c.asset, revision: as.revision, copy: mine, note: 'hand edit kept over a newer change: ' + c.fields.join(', ') }); await reload(); }
      catch (e) { fail(e, 'Your text was not saved'); }
    };
    const onDraftState = useCallback((id, on) => { if (on) typingSet.current.add(id); else typingSet.current.delete(id); setTyping(typingSet.current.size); }, []);
    useEffect(() => { const h = e => { if (typingSet.current.size || saveSt.pending) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [saveSt.pending]);

    const propose = (as, feedback, refine, opts) => guard('concepts:' + as.id, async () => { opts = opts || {}; try { await job('concepts', { asset: as.id, feedback, refine: refine || undefined, mode: opts.mode || 'explore', refs: opts.refs || undefined, refMode: opts.refMode || undefined, keep: opts.keep || undefined, size: opts.size || undefined }, as.id, 'concepts:' + as.id + ':' + Date.now(), (opts.mode === 'new' ? 'The art director designs afresh from the brief for ' : opts.mode === 'refine' ? 'The art director refines ' : 'The art director explores variations of ') + as.title); await reload(); } catch (e) { fail(e, 'The art director did not start', () => propose(as, feedback, refine, opts)); } });
    const applyInspection = (eid, instruction, force) => guard('inspection:' + eid, async () => { try { const r = await call('/studio/inspection/apply', { project: pRef.current.id, eid, instruction, force: force || undefined }); const d = await reload(); if (r.job) { await runJob(r.job, 'Applying the art director\'s correction (' + r.kind + ')'); pump(await reload()); } else pump(d); } catch (e) { fail(e, 'The correction was not applied'); } });
    const applyConcept = (eid, index, render, imageFrom, size) => guard('apply:' + eid + ':' + index, async () => { try { const r = await call('/studio/concept/apply', { project: pRef.current.id, eid, index, render, imageFrom: imageFrom == null ? undefined : imageFrom, size: render ? size : undefined }); const d = await reload(); if (r.asset) setSelAsset(r.asset); if (r.job) pump(d); } catch (e) { fail(e, 'The concept was not applied'); } });
    /* a measurement of one version at its output size, with the composed PNG: the worker re-judges it with the shared rules */
    const fileValidation = async (as, v, val, comp) => {
      try {
        const blob = await R.toBlob(v.layout, v.copy, comp.imgs); const u8 = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        await call('/studio/validation', { asset: as.id, version: v.id, report: R.report(v, val), imageB64: btoa(bin), mime: 'image/png' });
        await reload(); return true;
      } catch (e) { if (!/report_mismatch|not_current|stale/.test(e.code || '')) toastMsg('Validation not filed: ' + e.message + (e.requestId ? ' (request ' + e.requestId + ')' : '') + '. Measure again to retry.', true); return false; }
    };
    /* layout versions go on the latest revision; if the asset moved on, the layout is re-sent only when the newer version did not change the layout too */
    const putLayout = async (as, layout, baseVid, note) => {
      const fresh = (((pRef.current || {}).assets || []).find(x => x.id === as.id)) || as;
      try { await call('/studio/version', { asset: as.id, revision: fresh.revision, layout, kind: 'layout', note }); await reload(); return true; }
      catch (e) {
        if (e.status !== 409 || e.code !== 'conflict') throw e;
        const d = await reload(); const as2 = d && d.assets.find(x => x.id === as.id); if (!as2) throw e;
        const base = as2.versions.find(x => x.id === baseVid); const cur = current(as2);
        if (base && JSON.stringify(base.layout) === JSON.stringify(cur.layout)) { await call('/studio/version', { asset: as.id, revision: as2.revision, layout, kind: 'layout', note }); await reload(); return true; }
        setNotice({ kind: 'warn', title: 'The layout changed elsewhere while you edited.', text: 'v' + vtotal(as2) + ' changed the layout too, so yours was not saved over it. Apply yours on top of v' + vtotal(as2) + ', or leave the newer layout.', actions: [{ label: 'Apply mine on top', fn: async () => { try { const as3 = (await reload()).assets.find(x => x.id === as.id); await call('/studio/version', { asset: as.id, revision: as3.revision, layout, kind: 'layout', note: note + ' (applied over a newer layout)' }); await reload(); } catch (e3) { fail(e3, 'The layout was not saved'); } } }] });
        return false;
      }
    };
    /* the smallest geometric fix, measured with the real renderer, saved as a layout version: no image call is made */
    const repairLayout = async (as, v, comp) => {
      try {
        const variants = {}; for (const l of (v.layout.layers || [])) { if (Array.isArray(l.variants) && l.variants.length) variants[l.id] = await Promise.all(l.variants.map(async x => Object.assign({}, x, { img: await keyedImage(x.src) }))); }
        const r = R.repair(v.layout, v.copy, Object.assign({}, comp.imgs), { fonts: comp.fonts, channel: as.channel, format: as.format, locks: as.locks, fixContrast: true, variants: Object.keys(variants).length ? variants : undefined });
        // what no layout move can clear is named with its remedy, so "fixed" never hides a tile that still cannot pass
        const rest = (r.after ? r.after.issues : []).filter(i => i.severity === 'blocking' && !LAYOUT_CODES[i.code] && !/contrast/.test(i.code));
        const restText = rest.length ? ' Still blocking, and not a layout matter: ' + Array.from(new Set(rest.map(i => i.code === 'imagery_missing' ? 'no imagery yet (generate it, or use a solid ground - see below the artwork)' : i.code === 'mark_unloaded' ? 'a mark file did not load (load the marks again)' : i.code === 'imagery_sketch' ? 'an image region is still a sketch (generate it)' : i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')))).join('; ') + '.' : '';
        if (!r.changed) return { text: (r.conflict ? 'Nothing changed: ' + r.conflict : 'Nothing to fix in the layout: no overflow, collision or unreadable words.') + restText + ' Or choose one of the layout variations below.', conflict: !!r.conflict || !!rest.length };
        const saved = await putLayout(as, r.layout, v.id, 'layout repaired: ' + r.steps.join('; ').slice(0, 170));
        if (!saved) return { text: 'Not saved: the layout changed elsewhere first.', conflict: true };
        return { text: (r.ok ? 'Layout fixed with no render: ' : 'Partly fixed with no render: ') + r.steps.join('; ') + '.' + (r.conflict ? ' ' + r.conflict : '') + ' The words were not changed.' + restText + (r.ok ? '' : ' The layout variations below are each measured and may fit where this one cannot.'), conflict: !r.ok || !!rest.length };
      } catch (e) { fail(e, 'The layout fix was not saved'); return { text: 'The fix failed: ' + e.message, conflict: true }; }
    };
    const markVariant = async (as, v, comp) => {
      try {
        const variants = {}; for (const l of (v.layout.layers || [])) { if (Array.isArray(l.variants) && l.variants.length) variants[l.id] = await Promise.all(l.variants.map(async x => Object.assign({}, x, { img: await keyedImage(x.src) }))); }
        const r = R.markVariants(v.layout, v.copy, Object.assign({}, comp.imgs), { fonts: comp.fonts, channel: as.channel, format: as.format, locks: as.locks, variants });
        if (!r.changed) return false;
        const ok2 = await putLayout(as, r.layout, v.id, 'mark variant chosen for contrast: ' + r.steps.join('; ').slice(0, 160));
        if (ok2) toastMsg(r.steps.join('; ') + ' - no render'); return ok2;
      } catch (e) { toastMsg('Mark variant not changed: ' + e.message, true); return false; }
    };
    /* a measured arrangement from the variations: a layout version named after it, no render */
    const layoutVariant = (as, layout, baseVid, name) => guard('variant:' + as.id, async () => { try { const ok = await putLayout(as, layout, baseVid, 'layout variation: ' + name + ' (no render)'); if (ok) toastMsg('Layout changed to "' + name + '" - a new version, no render; the words are unchanged'); } catch (e) { fail(e, 'The layout was not saved', () => layoutVariant(as, layout, baseVid, name)); } });
    /* the Art Director reviews the version on request: the tile is composed exactly as it exports, then one model call reads it */
    const reviewNow = (as) => guard('inspect:' + as.id, async () => {
      try {
        const v = current(as); setBusy('Composing ' + as.title + ' exactly as it exports');
        const composed = await composeExport(pRef.current, as.id, v.id);
        const j = await job('inspect', { version: v.id }, as.id, 'review:' + v.id + ':' + Date.now(), 'The Art Director reviews ' + as.title + (composed ? ' (the composed tile)' : ' (the imagery only; the composed tile was not saved)'));
        await reload(); setTab('partner');
        if (j && j.state === 'done') toastMsg('Review in: an opinion, it approves nothing');
      } catch (e) { fail(e, 'The review did not start', () => reviewNow(as)); }
    });
    const saveLayout = async (as, layout, baseVid) => { try { await putLayout(as, layout, baseVid || as.current, 'layout edited by hand'); } catch (e) { fail(e, 'The layout was not saved', () => saveLayout(as, layout, baseVid)); } };
    const editLayout = async (as, delta) => { try { const cur = current(as); const layout = JSON.parse(JSON.stringify(cur.layout)); const hl = layout.layers.find(l => l.role === 'headline'); hl.size = Math.max(2.4, Math.round((hl.size + delta) * 10) / 10); hl.h = Math.round(hl.h * (hl.size / (hl.size - delta)) * 10) / 10; await putLayout(as, layout, cur.id, 'headline ' + (delta > 0 ? 'larger' : 'smaller') + ' (' + hl.size + '%)'); } catch (e) { fail(e, 'The layout was not saved'); } };
    const toggleLock = async (as, k, locked) => { try { await call('/studio/lock', { asset: as.id, element: k, locked }); await reload(); } catch (e) { fail(e, 'The lock was not changed'); } };
    const approve = (as, part, what) => { if (what === 'withdraw') { call('/studio/approve', { asset: as.id, part, decision: 'withdraw' }).then(() => reload()).catch(e => fail(e, 'The approval was not withdrawn')); return; } setDialog({ kind: 'reason', part, what, asset: as.id, title: as.title, version: vnum(as, current(as)) }); };
    const recordDecision = async (why) => {
      const d = dialog; setDialog(null); if (!why) return;
      try { await call('/studio/approve', { asset: d.asset, part: d.part, decision: d.what, reason: why }); await reload(); }
      catch (e) {
        // painted words nobody could verify, or an inconsistent inspection: a person may still approve, having looked
        if (e.status === 409 && /baked_text_unverified|inspection_inconsistent/.test(e.code || e.message) && window.confirm((e.detail || e.message) + '\n\nApprove anyway, having checked the tile yourself?')) { try { await call('/studio/approve', { asset: d.asset, part: d.part, decision: d.what, reason: why, acknowledgeInspection: true }); await reload(); } catch (e2) { fail(e2, 'The decision was not recorded'); } }
        else fail(e, 'The decision was not recorded');
      }
    };
    const restore = async (as, vid) => { try { const fresh = pRef.current.assets.find(x => x.id === as.id) || as; await call('/studio/version', { asset: as.id, revision: fresh.revision, restoreFrom: vid }); await reload(); setCmp(null); } catch (e) { if (e.status === 409) { await reload(); } fail(e, 'The version was not restored'); } };
    const render = (as, prompt, edit, size) => guard('render:' + as.id, async () => { try { const v = current(as); const artwork = v.mode === 'artwork'; await job('render', { prompt: prompt || (v.context || {}).visual || 'documentary background, no text', edit: !!edit, approach: artwork ? 'artwork' : undefined, baked: artwork ? (v.layout || {}).baked : undefined, aspect: as.format, size: ['1K', '2K', '4K'].indexOf(size) >= 0 ? size : (v.image && v.image.size) || '2K', note: edit ? 'edit: ' + String(prompt || '').slice(0, 60) : 'imagery as directed' }, as.id, 'render:' + as.id + ':' + v.id + ':' + Date.now(), (edit ? 'Editing the artwork of ' : 'Rendering new imagery for ') + as.title); pump(await reload()); } catch (e) { fail(e, 'The render did not start'); } });
    const areaEdit = (as, o) => guard('render:' + as.id, async () => { try { const v = current(as); await job('render', { edit: true, editKind: o.kind, area: o.area, instruction: o.instruction, aspect: as.format, size: o.size, note: (o.kind === 'area' ? 'area edit: ' : o.kind === 'background' ? 'background swap: ' : 'restyle: ') + o.instruction.slice(0, 60) }, as.id, 'area:' + as.id + ':' + v.id + ':' + Date.now(), (o.kind === 'area' ? 'Editing the marked area of ' : o.kind === 'background' ? 'Changing the background of ' : 'Restyling ') + as.title + ' at ' + o.size); pump(await reload()); } catch (e) { fail(e, 'The edit did not start'); } });
    const filePreservation = async (m) => { try { await call('/studio/preservation', m); await reload(); } catch (e) { toastMsg('Preservation not filed: ' + e.message, true); } };
    const note = async (text, tgt) => { try { await call('/studio/note', { project: pRef.current.id, text, target: tgt }); await reload(); } catch (e) { fail(e, 'The note was not recorded'); } };
    const directTeam = (text, tgt) => guard('revise:' + pidRef.current, async () => { try { const j = await job('revise', { target: tgt, asset: tgt !== 'set' && a ? a.id : undefined, instruction: text }, null, 'revise:' + pRef.current.id + ':' + Date.now(), 'Reading the direction against ' + (tgt === 'set' ? 'the whole set' : tgt === 'family' && a ? 'the ' + a.family : (a || {}).title || 'the asset')); const d = await reload(); if (j && j.result && j.result.kind === 'adapt' && j.result.changed && j.result.changed.length && d) { setSelAsset(j.result.changed[0]); setTab('copy'); setView('asset'); } } catch (e) { fail(e, 'The direction was not sent'); } });
    /* the paid remedies of the impact list: one revise call on that asset, locked fields kept by the stage itself */
    const reviseFromImpact = async (x, r) => { const ins = r.remedy === 'readapt' ? 'The master this was adapted from has changed. Bring this asset\'s words in line with the master\'s current version, fitted to this channel and format. Keep the locked fields.' : 'The creative strategy was confirmed after this asset was made. Bring the words in line with the confirmed strategy (proposition, audience, tone). Keep the locked fields.'; await job('revise', { target: 'asset', asset: x.asset, instruction: ins }, null, 'revise:' + x.asset + ':' + r.code + ':' + x.version, (r.remedy === 'readapt' ? 'Re-adapting ' : 'Revising ') + x.title); await reload(); };
    const pickAlternative = async (assetId, field, option) => { try { const as = pRef.current.assets.find(x => x.id === assetId); if (!as) return; await call('/studio/version', { asset: as.id, revision: as.revision, copy: { [field]: option }, note: 'chose an alternative ' + field }); await reload(); setSelAsset(as.id); setView('asset'); } catch (e) { if (e.status === 409) await reload(); fail(e, 'The alternative was not applied'); } };
    const decideProposal = async (eid, decision) => { try { const r = await call('/studio/proposal', { project: pRef.current.id, eid, decision }); const d = await reload(); if (decision === 'do' && r.jobs && r.jobs.length) pump(d); } catch (e) { fail(e, 'The decision was not recorded'); } };
    const remember = async (eid, scope, offer) => { try { const ta = document.getElementById('offer-' + eid); const rule = ta ? ta.value.trim() : offer.rule; const r = await call('/studio/remember', { project: pRef.current.id, eid, scope, rule, task: offer.task, campaign: offer.campaign, instruction: offer.instruction }); toastMsg(r.saved ? 'Saved as ' + (r.scope === 'campaign' ? 'a campaign preference for ' + r.campaign : 'a lasting ' + pRef.current.ns.toUpperCase() + ' rule') : 'Not saved; applied to this work only'); await reload(); } catch (e) { fail(e, 'The preference was not recorded'); } };
    /* a retry is a new job named after the one that failed and how many retries it has had: pressing Retry twice runs it once */
    const retryJob = (j) => guard('retry:' + j.id, async () => { try { const n = ((pRef.current || {}).jobs || []).filter(x => (x.idem || '').indexOf('retry:' + j.id + ':') === 0 && (x.state === 'failed' || x.state === 'cancelled')).length; const r = await call('/studio/job', { project: j.project || pidRef.current, asset: j.asset || undefined, stage: j.stage, input: j.input, idem: 'retry:' + j.id + ':' + n }); const done = await runJob(r.job.id, 'Retrying ' + j.stage); const d = await reload(); if (done && done.state === 'done') { setNotice({ kind: 'info', title: 'The ' + j.stage + ' step ran on retry.', text: 'Nothing was lost; the result is in place.' }); if (j.stage === 'copy' && d) { const fresh = d.assets[d.assets.length - 1]; if (fresh) { setSelAsset(fresh.id); setView('asset'); } } pump(d); } } catch (e) { fail(e, 'The retry did not start'); } });
    const cancelJob = async (id) => { try { const r = await call('/studio/job/cancel', { id }); await reload(); setNotice({ kind: 'info', title: 'Cancelled.', text: (r && r.note) || RUN_NOTE }); } catch (e) { fail(e, 'The job was not cancelled'); } };
    const importLegacy = async (l) => { try { setBusy('Importing ' + l.title); const r = await call('/studio/import', { legacy: l.id }); toastMsg(r.existing ? 'Already imported: opening that project' : 'Imported; the original is untouched'); await openProject(r.id); } catch (e) { fail(e, 'The import did not run'); } finally { setBusy(''); } };

    /* export: the renderer draws each approved composition at native size (fonts and imagery loaded first, as for the
       validation); a full key saves the PNGs and runs the export stage; the bundle downloads; the files are listed with their pixels */
    const doExport = (ready) => guard('export:' + pidRef.current, async () => {
      const p0 = pRef.current;
      setExportState({ busy: true, msg: 'Drawing ' + ready.length + ' composition' + (ready.length === 1 ? '' : 's') + ' at native size...' });
      try {
        const files = []; const sheet = []; const list = [];
        const dims = u8 => (u8 && u8.length > 24 && u8[1] === 80 && u8[2] === 78 && u8[3] === 71) ? { w: ((u8[16] << 24) | (u8[17] << 16) | (u8[18] << 8) | u8[19]) >>> 0, h: ((u8[20] << 24) | (u8[21] << 16) | (u8[22] << 8) | u8[23]) >>> 0 } : null;
        for (const x of ready) {
          const v = x.v; const safe = (x.a.title + '-v' + vnum(x.a, v)).replace(/[^a-z0-9-]+/gi, '_');
          if (v.layout && v.layout.layers) {
            const imgs = await loadImages(v, p0.ns); await R.ensureFonts(v.layout, v.copy, { timeout: 4000 });
            const blob = await R.toBlob(v.layout, v.copy, imgs); const u8 = new Uint8Array(await blob.arrayBuffer());
            files.push({ name: safe + '.png', data: u8 }); const d0 = dims(u8); list.push(Object.assign({ name: safe + '.png', bytes: u8.length, want: v.layout.stage ? { w: v.layout.stage.w, h: v.layout.stage.h } : null }, d0 || {}));
            if (canWrite() && !p0.readOnly) { let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); await call('/studio/render/save', { asset: x.a.id, version: v.id, imageB64: btoa(bin), mime: 'image/png' }); }
          } else if (v.image && v.image.url) { try { const r = await fetch((typeof csBase === 'function' ? csBase() : '') + v.image.url, { headers: typeof axHeaders === 'function' ? axHeaders() : {} }); const u8 = new Uint8Array(await r.arrayBuffer()); files.push({ name: safe + '.png', data: u8 }); list.push(Object.assign({ name: safe + '.png', bytes: u8.length }, dims(u8) || {})); } catch (e) {} }
          sheet.push('== ' + x.a.title + ' (' + x.a.channel + ' ' + x.a.format + ') - version ' + v.id + ' ==', ...['headline', 'support', 'cta', 'caption', 'alt'].filter(k => v.copy[k]).map(k => k.toUpperCase() + ': ' + v.copy[k]), 'CHECKS: ' + ((v.checks || []).map(c => c.state + ' ' + c.text).join('; ') || 'none'), 'APPROVALS: ' + Object.keys(x.a.approvals || {}).map(k => k + ' by ' + x.a.approvals[k].by + ' - ' + x.a.approvals[k].reason).join('; '), '');
        }
        let manifest = null;
        if (canWrite() && !p0.readOnly) { setExportState({ busy: true, msg: 'Recording the export on the project...' }); const j = await job('export', { assets: ready.map(x => x.a.id) }, null, 'export:' + p0.id + ':' + Date.now(), 'Recording the export'); if (!j || j.state !== 'done') throw new Error((j && j.error) || 'the export was not recorded'); manifest = j.result || null; }
        const sheetText = manifest && manifest.sheet && manifest.sheet.length < 4000 ? manifest.sheet : 'COPY SHEET - ' + p0.title + '\n\n' + sheet.join('\n');
        files.push({ name: 'copy-sheet.txt', data: sheetText });
        const man = JSON.stringify({ project: p0.id, ns: p0.ns, title: p0.title, campaign: p0.campaign, at: new Date().toISOString(), assets: ready.map(x => ({ asset: x.a.id, title: x.a.title, channel: x.a.channel, format: x.a.format, version: x.v.id, versionNumber: vnum(x.a, x.v), copy: x.v.copy, layout: x.v.layout, image: x.v.image, checks: x.v.checks, approvals: x.a.approvals, context: x.v.context })), export: manifest ? { id: manifest.export, files: manifest.files, excluded: manifest.excluded } : { note: 'downloaded by a read-only key; not recorded on the project' }, note: 'Approved versions only. This export created no task and sent nothing anywhere.' }, null, 2);
        files.push({ name: 'manifest.json', data: man });
        list.push({ name: 'copy-sheet.txt', bytes: sheetText.length }, { name: 'manifest.json', bytes: man.length });
        const blob = R.zip(files); const url = URL.createObjectURL(blob); const name = 'studio-' + p0.ns + '-' + p0.id + '.zip';
        // the browser may refuse a download that code starts after a long wait (Safari always does), so the view also shows the link for a real click
        try { const el = document.createElement('a'); el.href = url; el.download = name; document.body.appendChild(el); el.click(); el.remove(); } catch (e) {}
        const bad = list.filter(f => f.want && f.w && (f.w !== f.want.w || f.h !== f.want.h));
        setExportState({ busy: false, url, name, size: blob.size, files: list, error: !!bad.length, msg: 'Bundle ready: ' + files.length + ' files' + (manifest ? '; recorded as export ' + manifest.export + ' on the project.' : '.') + (bad.length ? ' ' + bad.length + ' image' + (bad.length === 1 ? ' is' : 's are') + ' not at the native size: do not send them.' : ' Every image is at its native size.') + ' If the download did not start, use the link.' });
        window.__studioLastExport = { files: files.map(f => f.name), list, manifest };
        await reload();
      } catch (e) { const x = explain(e, 'The export stopped'); setExportState({ busy: false, error: true, msg: x.title + '. ' + x.text }); }
    });

    const flow = p ? flowOf(p) : null;
    const stage = stageOfView(view) || (view === 'brand' || view === 'context' ? '' : 'brief');
    const goStage = (id) => {
      if (id === 'brief') setView('brief', true); else if (id === 'directions') setView('directions', true); else if (id === 'produce') setView('board', true);
      else if (id === 'refine') { if (!a && p && p.assets[0]) setSelAsset(p.assets[0].id); setView('asset', true); }
      else if (id === 'review') setView('review', true); else if (id === 'export') setView('export', true);
    };
    const openAsset = id => { setSelAsset(id); setSelField(null); setView('asset'); };
    /* Alt+1..6 jumps to a stage from anywhere in the Studio, except while typing */
    useEffect(() => { const h = e => { if (!pRef.current || !e.altKey || e.ctrlKey || e.metaKey) return; const n = +e.key; if (n >= 1 && n <= 6 && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); goStage(STAGES[n - 1].id); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); });

    const liveJobs = p ? (p.jobs || []).filter(j => j.state === 'queued' || j.state === 'running') : [];
    const campName = p && p.campaign ? ((kit && kit.campaigns || []).find(c => c.id === p.campaign) || {}).name || p.campaign : '';
    const saveWord = saveSt.err ? 'Not saved' : saveSt.pending || typing ? 'Saving...' : saveSt.at ? 'All changes saved' : 'Saved';
    const header = html`<div class="st-head">
      <div class="st-head-l"><span class="st-appname">Creative Studio</span>
        <select class="st-sel st-client" value=${clientId} onChange=${e => switchClient(e.target.value)} aria-label="Client">${CLIENTS.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        ${p ? html`<span class="st-sep" aria-hidden="true">/</span><button class="ov-link" onClick=${closeProject}>All projects</button><span class="st-sep" aria-hidden="true">/</span><b class="st-ptitle" title=${p.title}>${p.title}</b>${campName ? html`<${Chip} title="campaign">${campName}</${Chip}>` : html`<span class="ov-dim">no campaign</span>`}${p.readOnly ? html`<${Chip}>legacy, read-only</${Chip}>` : null}${p.legacy ? html`<${Chip} title="the original is untouched">imported from ${p.legacy.id}</${Chip}>` : null}${a && view === 'asset' ? html`<span class="st-sep" aria-hidden="true">/</span><span class="st-curasset">${a.title} <span class="ov-dim">v${vnum(a, current(a))} of ${vtotal(a)}</span></span>` : null}` : html`<span class="ov-dim">project library</span>`}
      </div>
      <div class="st-head-r">
        ${p && !p.readOnly && canWrite() ? html`<span class=${'st-save' + (saveSt.err ? ' bad' : saveSt.pending || typing ? ' busy' : ' ok')} role="status" aria-live="polite">${saveWord}${saveSt.err ? html` <button class="ov-link" onClick=${() => { setSaveSt(s => Object.assign({}, s, { err: null })); flushCopy(saveSt.err.asset); }}>retry</button>` : null}</span>` : null}
        ${p ? html`<button class=${'st-activity' + (liveJobs.length ? ' on' : '')} onClick=${() => setView('jobs', true)} aria-label=${liveJobs.length ? liveJobs.length + ' jobs running or queued; open Jobs' : 'No jobs running; open Jobs'}>${liveJobs.length ? html`<span class="st-spin" aria-hidden="true"></span>${liveJobs.length} running` : 'Jobs'}</button>` : null}
        ${prov ? (prov.claude && prov.gemini ? html`<span class="st-prov ok" title=${'Claude and image generation are configured on the worker (reachability is checked when a call is made). Model calls today ' + (status.budget ? status.budget.used + ' of ' + status.budget.cap : '-') + '. Build ' + status.build + '.'}>Models ready</span>` : html`<span class=${'st-prov ' + (prov.claude ? 'ok' : 'bad')} title=${prov.claude ? 'Claude is configured on the worker' : 'Claude is not configured on the worker: writing, planning and inspection cannot run'}>Claude ${prov.claude ? 'ready' : 'not configured'}</span><span class=${'st-prov ' + (prov.gemini ? 'ok' : 'bad')} title=${prov.gemini ? 'Image generation is configured on the worker' : 'Image generation is not configured: compositions work, imagery cannot be made'}>Images ${prov.gemini ? 'ready' : 'not configured'}</span>`) : null}
        ${status && !p ? html`<${Chip} title=${'Worker build; model calls today ' + (status.budget ? status.budget.used + ' of ' + status.budget.cap : '-')}>${status.build}</${Chip}>` : null}
      </div>
    </div>`;

    const headOf = (id, extra) => { const s0 = STAGES.find(x => x.id === id); return Object.assign({ id, title: s0.label, purpose: s0.purpose, flow, focusRef: titleRef }, extra || {}); };
    const tabsFor = id => id === 'brief' ? { tabs: [['brief', 'Brief'], ['sources', 'Sources', p.sources.length], ['references', 'References', p.references.length]], tab: view, onTab: k => setView(k) }
      : id === 'produce' ? { tabs: [['board', 'Board', p.assets.length || null], ['sequence', 'Sequence', ((p.brief || {}).sequences || []).length || null], ['production', 'Recipes and usage'], ['jobs', 'Jobs', liveJobs.length || null]], tab: view, onTab: k => setView(k) }
      : id === 'refine' ? { tabs: [['asset', a ? a.title : 'Asset'], ['copy', 'Copy deck']], tab: view, onTab: k => { if (k === 'asset' && !a && p.assets[0]) setSelAsset(p.assets[0].id); setView(k); } } : {};
    const Staged = (id, acts, body) => html`<div class="st-centre-pad"><${StageHead} ...${headOf(id, tabsFor(id))}>${acts}</${StageHead}>${body}</div>`;
    const jobsLine = p && (liveJobs.length || (p.jobs || []).some(j => j.state === 'failed')) ? html`<div class="st-jobline-strip" aria-label="Jobs in progress">${liveJobs.slice(0, 4).map(j => html`<span key=${j.id} class="st-jobchip"><span class="st-spin" aria-hidden="true"></span>${j.stage}${j.asset ? ' - ' + ((p.assets.find(x => x.id === j.asset) || {}).title || '') : ''} <span class="ov-dim">${j.state}${j.attempts ? ', attempt ' + (j.attempts + 1) + ' of 3' : ''}</span>${canWrite() ? html` <button class="ov-link" title=${RUN_NOTE} onClick=${() => cancelJob(j.id)}>cancel</button>` : null}</span>`)}${(p.jobs || []).filter(j => j.state === 'failed' && !(p.jobs || []).some(x => (x.idem || '').indexOf('retry:' + j.id + ':') === 0 && x.state !== 'failed')).slice(-3).map(j => html`<span key=${j.id} class="st-jobchip bad"><${Chip} kind="bad">failed</${Chip}> ${j.stage}${j.asset ? ' - ' + ((p.assets.find(x => x.id === j.asset) || {}).title || '') : ''} <span class="ov-dim">${explain({ message: j.error }).title}</span>${canWrite() ? html` <button class="ov-link" onClick=${() => retryJob(j)}>retry</button>` : null}</span>`)}</div>` : null;

    let centre;
    if (!pid) centre = intake ? html`<${Intake} key=${'intake:' + clientId + ':' + ((preset && preset.at) || 0)} client=${client} kit=${kit} preset=${preset} onCreate=${o => { setPreset(null); createProject(o); }} onCancel=${() => { setIntake(false); setPreset(null); }} />` : html`<${Library} client=${client} data=${lib} err=${libErr} resume=${store.place(clientId)} onOpen=${openProject} onNew=${() => setIntake(true)} onStart=${k => { setPreset({ start: k, at: Date.now() }); setIntake(true); }} onImport=${importLegacy} />`;
    else if (!p) centre = html`<div class="st-centre-pad" aria-busy="true"><div class="ov-empty">${busy || 'Opening the project...'}</div></div>`;
    else if (cmp && a) centre = html`<${CompareView} a=${a} ns=${p.ns} vA=${a.versions.find(v => v.id === cmp.a)} vB=${a.versions.find(v => v.id === cmp.b)} onClose=${() => setCmp(null)} onRestore=${vid => restore(a, vid)} />`;
    else if (view === 'brief') centre = html`<${BriefView} key=${p.id} p=${p} head=${headOf('brief', tabsFor('brief'))} prov=${prov} onGo=${goStage} onSave=${saveBrief} onDirect=${direct} onProduce=${o => produce(o || {})} onCampaign=${setCampaign} onStrategy=${draftStrategy} busy=${busy} />`;
    else if (view === 'sources') centre = Staged('brief', null, html`<${SourcesView} p=${p} onAdd=${addSource} busy=${busy} />`);
    else if (view === 'references') centre = Staged('brief', null, html`<${ReferencesView} p=${p} onAdd=${addReference} onAnalyse=${analyseReference} onRecipe=${saveRecipe} busy=${busy} />`);
    else if (view === 'directions') centre = html`<${DirectionsView} p=${p} head=${headOf('directions')} prov=${prov} onChoose=${chooseDirection} onMore=${direct} busy=${busy} />`;
    else if (view === 'board') centre = Staged('produce', p.assets.length ? html`<button class="btn sm" onClick=${() => goStage('refine')}>Continue to Refine</button>` : canWrite() && !p.readOnly ? html`<button class="btn sm" disabled=${!!busy || (prov && !prov.claude) || !((p.brief || {}).channels || []).length} title=${prov && !prov.claude ? 'Claude is not configured on the worker' : ''} onClick=${() => produce({})}>Produce the set</button><button class="btn sm ghost" onClick=${() => setView('brief', true)}>Check the brief</button>` : null, html`${jobsLine}${!p.assets.length ? html`<div class="st-empty-state"><b>Nothing produced yet.</b><span>${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction, or produce straight from the brief.' : 'Production writes one piece per channel in the brief and lays each out as an editable composition.'}</span></div>` : null}<${BoardView} p=${p} onOpen=${openAsset} />`);
    else if (view === 'sequence') centre = Staged('produce', null, html`<${SequenceView} p=${p} onPlan=${planSequence} onOpen=${openAsset} busy=${busy} />`);
    else if (view === 'production') centre = Staged('produce', null, html`<${ProductionView} p=${p} onRun=${async () => pump(await reload())} onOpen=${openAsset} onReview=${() => setView('review', true)} onRevise=${reviseFromImpact} />`);
    else if (view === 'jobs') centre = Staged('produce', null, html`<${JobsView} p=${p} onRetry=${retryJob} onCancel=${cancelJob} onStep=${j => runJob(j.id, 'Running ' + j.stage)} budget=${status ? status.budget : null} />`);
    else if (view === 'copy') centre = Staged('refine', null, html`<${CopyView} p=${p} onEdit=${editAsset} onOpen=${openAsset} />`);
    else if (view === 'review') centre = html`<${ReviewStage} p=${p} head=${headOf('review')} flow=${flow} onGo=${goStage} onApprove=${approve} onOpen=${openAsset} />`;
    else if (view === 'export') centre = html`<${ExportView} p=${p} head=${headOf('export')} flow=${flow} state=${exportState} onGo=${goStage} onExport=${doExport} onClickup=${ready => setDialog({ kind: 'clickup', ready })} />`;
    else if (view === 'brand') centre = html`<div class="st-centre-pad"><${BrandView} p=${p} tick=${ctxTick} /></div>`;
    else if (view === 'context') centre = html`<${ContextView} p=${p} tick=${ctxTick} onVoice=${() => setPanel('voice')} onLearned=${() => setPanel('learned')} />`;
    else if (a) { const i = p.assets.indexOf(a); centre = html`<div class="st-centre-pad st-refine"><${StageHead} ...${headOf('refine', Object.assign({ compact: true }, tabsFor('refine')))}>${flow.counts.valid === flow.counts.n && flow.counts.n ? html`<button class="btn sm" onClick=${() => goStage('review')}>Continue to Review</button>` : null}</${StageHead}>${jobsLine}<${AssetView} key=${a.id} p=${p} a=${a} slot=${slot} tab=${tab} setTab=${setTab} conflict=${conflict && conflict.asset === a.id ? conflict : null} onConflict=${resolveConflict} neighbours=${{ prev: i > 0 ? p.assets[i - 1].id : null, next: i < p.assets.length - 1 ? p.assets[i + 1].id : null }} sel=${selField} setSel=${setSelField} onEdit=${editAsset} onDraftState=${onDraftState} onLayout=${editLayout} onLayoutSave=${saveLayout} onPropose=${propose} onApplyConcept=${applyConcept} onOpen=${openAsset} onValidate=${fileValidation} onMarkVariant=${markVariant} onRepair=${repairLayout} onLock=${toggleLock} onApprove=${approve} onCompare=${(x, y) => setCmp({ a: x, b: y })} onRestore=${restore} onRender=${render} onAreaEdit=${areaEdit} onPreservation=${filePreservation} onVariant=${layoutVariant} onRetryJob=${retryJob} sugg=${sugg} onSuggRefresh=${r => fetchSugg(r !== false)} busy=${busy} /></div>`; }
    else centre = Staged('refine', null, html`<div class="st-empty-state"><b>${p.assets.length ? 'Choose an asset on the left.' : 'Nothing to refine yet.'}</b><span>${p.assets.length ? 'Each asset opens here with its words, layout and imagery.' : p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction to start production.' : 'Produce the set from the brief first.'}</span>${!p.assets.length ? html`<button class="btn sm" onClick=${() => goStage(p.directions.length ? 'directions' : 'brief')}>${p.directions.length ? 'Go to Directions' : 'Go to the Brief'}</button>` : null}</div>`);

    const inRefine = !!(p && view === 'asset' && a && !cmp);
    const insTabs = [['copy', 'Copy'], ['quality', 'Quality'], ['partner', 'Art Director'], ['versions', 'Versions']];
    const tabKey = e => { const i = insTabs.findIndex(t => t[0] === tab); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = insTabs[(i + (e.key === 'ArrowRight' ? 1 : insTabs.length - 1)) % insTabs.length][0]; setTab(n); setTimeout(() => { const el = document.getElementById('st-tabbtn-' + n); if (el) el.focus(); }, 0); } };
    const showAside = !!p && (inRefine || partnerOpen);
    const partnerEl = p ? html`<${Partner} p=${p} a=${a} target=${target} setTarget=${setTarget} onDirect=${directTeam} onNote=${note} onPick=${pickAlternative} onDecide=${decideProposal} onRemember=${remember} onApplyInspection=${applyInspection} onReview=${inRefine ? reviewNow : null} busy=${busy} sugg=${inRefine ? sugg : null} onSuggRefresh=${r => fetchSugg(r !== false)} />` : null;
    return html`<div class=${'st' + (p ? ' has-project' : '')} data-stage=${stage}>
      ${header}
      ${p ? html`<${Flow} flow=${flow} at=${stage} onGo=${goStage} />` : null}
      ${busy && p ? html`<div class="st-busy" role="status" aria-live="polite"><span class="st-spin" aria-hidden="true"></span>${busy}<span class="ov-dim"> - a persistent job: it continues if you close the tab, and the worker's tick finishes it.</span></div>` : null}
      <${Notice} n=${notice} onClose=${() => setNotice(null)} />
      <div class=${'st-body' + (p ? '' : ' lib') + (p && !showAside ? ' noaside' : '')}>
        ${p ? html`<${Rail} p=${p} view=${cmp ? 'compare' : view} setView=${v => setView(v, true)} sel=${selAsset} setSel=${id => { setSelAsset(id); setSelField(null); setCmp(null); }} toolsOpen=${toolsOpen} setToolsOpen=${setToolsOpen} />` : null}
        <main class="st-centre" aria-label="Workspace">${centre}</main>
        ${p ? (showAside ? html`<aside class="st-inspector" aria-label=${inRefine ? 'Inspector' : 'Art Director'}>
          ${inRefine ? html`<div class="st-instabs" role="tablist" aria-label="Inspector" onKeyDown=${tabKey}>${insTabs.map(([k, l]) => html`<button key=${k} id=${'st-tabbtn-' + k} role="tab" aria-selected=${tab === k} aria-controls=${'st-tab-' + k} tabIndex=${tab === k ? 0 : -1} class=${'st-instab' + (tab === k ? ' on' : '')} onClick=${() => setTab(k)}>${l}${k === 'quality' && a && (a.readiness || {}).technical === 'failed' ? html` <span class="st-dot bad" aria-label="failing"></span>` : null}</button>`)}</div>` : html`<div class="st-insp-head"><span class="st-lbl">Art Director</span><button class="ov-link" onClick=${() => setPartnerOpen(false)} aria-label="Hide the Art Director">hide</button></div>`}
          <div class="st-slot" ref=${setSlot}></div>
          <div class="st-partner-wrap" id="st-tab-partner" role=${inRefine ? 'tabpanel' : undefined} hidden=${inRefine && tab !== 'partner'}>${partnerEl}</div>
        </aside>` : html`<button class="st-aside-open" onClick=${() => setPartnerOpen(true)} aria-label="Show the Art Director">Art Director</button>`) : null}
      </div>
      ${dialog && dialog.kind === 'clickup' && p ? html`<${ClickupDialog} ready=${dialog.ready} client=${client} p=${p} onClose=${() => setDialog(null)} />` : null}
      ${panel && p ? html`<${ClientPanel} p=${p} kind=${panel} onClose=${() => setPanel(null)} onChanged=${() => { setCtxTick(t => t + 1); loadLib(); }} />` : null}
      ${dialog && dialog.kind === 'reason' ? html`<${ReasonDialog} title=${(dialog.what === 'approve' ? 'Approve ' : 'Reject ') + dialog.part} prompt=${'On ' + dialog.title + ', version ' + dialog.version + ' (the current one). Approval is recorded as client acceptance of this exact version, never as performance.'} onDone=${recordDecision} />` : null}
    </div>`;
  }

  let mounted = false;
  window.studioInit = function () {
    const root = document.getElementById('studio-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${StudioApp} />`); }
  };
})();
