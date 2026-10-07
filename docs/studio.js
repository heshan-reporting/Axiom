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
  /* S19: the working state of a canvas edit lives here, outside the canvas component, so switching asset, stage or project
     never takes it away. The editor writes on every change and reads when it mounts; a copy is kept in localStorage under a
     fingerprint of the access key (never the key itself) so a reload brings it back too. A record names the client, project,
     asset and the version it was made on (base): it is only ever laid back onto that same version. */
  const MERGE = window.STMerge;
  const WORK = (() => {
    const fp = () => { try { const k = ((typeof axHeaders === 'function' ? axHeaders() : {}) || {})['X-Axiom-Key'] || ''; return MERGE ? MERGE.sig('k:' + k).split(':')[0] : 'anon'; } catch (e) { return 'anon'; } };
    const mems = {}; let t = null;
    const mem = () => { const f = fp(); if (!mems[f]) { let m = {}; try { m = JSON.parse(localStorage.getItem('ax_studio_work_' + f) || '{}') || {}; } catch (e) {} const old = Date.now() - 14 * 864e5; Object.keys(m).forEach(k => { if (!m[k] || (m[k].at || 0) < old) delete m[k]; }); mems[f] = m; } return { f, m: mems[f] }; };
    const persist = now => { clearTimeout(t); const run = () => { const { f, m } = mem(); try { localStorage.setItem('ax_studio_work_' + f, JSON.stringify(m)); } catch (e) {} }; if (now) run(); else t = setTimeout(run, 250); };
    try { window.addEventListener('pagehide', () => persist(true)); } catch (e) {}
    return {
      get: id => mem().m[id] || null,
      set: (id, rec, now) => { mem().m[id] = Object.assign({ at: Date.now() }, rec); persist(now); },
      del: (id, base) => { const { m } = mem(); if (m[id] && (!base || m[id].base === base)) { delete m[id]; persist(true); } },
      any: () => Object.keys(mem().m).length,
      clear: () => { const { m } = mem(); Object.keys(m).forEach(k => delete m[k]); persist(true); },
    };
  })();
  window.STWork = WORK;
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
    if (status === 409 && /finished_bitmap/.test(code)) return out('This is a finished creative', 'Its words, mark and layout are painted into one bitmap, so they cannot be edited as layers. Regenerate it with the new words or direction (a new generated version), or switch to the editable Studio, which makes a derived asset with live layers. Caption and alt text can be edited here.', 'warn');
    if (status === 409 && /not_finished/.test(code)) return out('Only a finished creative is regenerated whole', 'This asset is an editable composition: use the Creative Director, the layout editor or the imagery controls instead.', 'warn');
    if (has(/mark_missing/)) return out('The campaign mark is not on file', msg.replace(/^mark_missing:\s*/, '').replace(/\s*\(not retried\)\s*$/, '') + ' Nothing was rendered and nothing was spent. Upload the file in the Brand view, or produce in the editable mode, which leaves the mark as an incomplete layer rather than painting something in its place.', 'warn');
    if (has(/nothing_to_change/)) return out('Nothing to regenerate', 'Give new words or a direction first.', 'warn');
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

  /* ------------------------------------------------------------ the workflow: seven steps, each with its views; their state is the worker's */
  /* S17: the guided workflow - Brief, Objectives, Strategy, Directions, Copy, Design, Review - each depending on the one before.
     The state of every step (not started, in progress, processing, needs review, complete, locked with the reason, error) is
     worked out by the worker from the record (p.workflow) and enforced there; the island shows it and never moves the person
     to another step by itself. Export is the last view of Review. Each step names its purpose and what its action spends. */
  const STAGES = [
    { id: 'brief', label: 'Brief', sub: 'Understand the situation', need: 'Material about the situation: a brief, an article, a link, a file or an Axiom item. Then a person reviews what Axiom understood.', act: 'Analyse reads every piece together against this client (one model call); Confirm opens Objectives.', headline: 'Start with what happened.', views: ['brief', 'sources', 'references'], purpose: 'Give Axiom the brief - text, links, files, screenshots, notes, or something Axiom already holds - and review what it understood.', next: 'Analysing is one model call that reads every piece of material together against the client. Confirming the understanding opens the objectives.' },
    { id: 'objectives', label: 'Objectives', sub: 'What the work must achieve', need: 'An understanding a person has reviewed. Choose one objective and one key message (Axiom\'s, or your own words).', act: 'Confirm writes them into the brief and opens Strategy. Nothing is spent.', headline: 'Decide what this must achieve.', views: ['objectives'], purpose: 'Choose the objective, the key message under it and the topics in play, from what Axiom proposed for this client.', next: 'Confirming writes the objective, the message and the call to action into the brief and opens the strategy. Nothing is spent.' },
    { id: 'strategy', label: 'Strategy', sub: 'How to respond', need: 'A confirmed objective. Choose a response strategy, or record that the client should not respond, with a reason.', act: 'Confirm opens Directions; proposing them is one model call.', headline: 'Choose how to respond.', views: ['strategy'], purpose: 'Choose the response strategy (or decide not to respond) and settle the campaign.', next: 'Confirming opens Directions; generating them is one model call, built on the objective, the message and this strategy.' },
    { id: 'directions', label: 'Directions', sub: 'Choose the idea', need: 'A confirmed strategy. Select one direction to write from.', act: 'Select opens Copy. Refine changes one direction; explore asks for new ones (one model call each). Previews are free sketches.', headline: 'Choose an idea, not just a background.', views: ['directions'], purpose: 'Compare genuinely different directions built on the confirmed strategy; refine, merge or ask for alternatives, then select one.', next: 'Selecting opens Copy. Refining, merging and alternatives are one model call each; previews are free.' },
    { id: 'copy', label: 'Copy', sub: 'Get the words right', need: 'A selected direction. Each piece is marked ready for design once its words are right.', act: 'Write the copy is one model call; nothing is rendered. Ready for design is not approval: approval happens in Review.', headline: 'Get the words right first.', views: ['copywrite', 'copy', 'kit', 'sequence'], purpose: 'Write each channel\'s words and its visual narrative from the selected direction, then mark each piece ready for design.', next: 'Generating the copy is one model call for the words and plans; nothing is rendered. Marking a piece ready is the agency\'s copy approval of that exact version.' },
    { id: 'design', label: 'Design', sub: 'Build the creative', need: 'Copy marked ready. A production mode per piece (editable or finished), then a composition that passes its checks.', act: 'Imagery is one paid render per planned image, confirmed first; layout, type and Fix layout are free.', headline: 'Make the creative yours.', views: ['asset', 'board', 'production', 'jobs'], purpose: 'Choose the production mode, then build each creative on the canvas: imagery, layout, type and the exact marks, measured as you work.', next: 'Generating imagery is one paid render per planned image (stated first); the canvas, layout variations and Fix layout are free; the Creative Director\'s review is one model call and is advice, never approval.' },
    { id: 'review', label: 'Review & Delivery', sub: 'Approve and deliver', headline: 'One final check, then deliver.', need: 'Every piece validated (or its painted words read back). A person approves copy and design of the exact version.', act: 'Prepare the package draws each approved version at native size; nothing is sent anywhere.', views: ['review', 'export'], purpose: 'Check every piece against the preflight, approve it, share it with the client, then export exactly the approved, validated versions.', next: 'Each check is read from the current version, never estimated. Approval is a person\'s decision about that exact version; export draws each one at its native size.' },
  ];
  const stageOfView = v => (STAGES.find(s => s.views.indexOf(v) >= 0) || { id: '' }).id;
  /* a finished creative has no layers to measure: it is ready once its words and marks were read back (readiness.production) */
  const validOf = a => { const v = current(a); return !!v && (v.mode === 'copy' || v.mode === 'generated' || (v.mode === 'finished' ? !!(a.readiness || {}).production : (a.readiness || {}).technical === 'passed')); };
  const MODE_WORD = { editable: 'Editable Studio', finished: 'Finished creative', artwork: 'Hybrid artwork', generated: 'Legacy flattened', copy: 'Copy only' };
  const modeOf = v => !v ? '' : v.mode === 'finished' ? 'finished' : v.mode === 'artwork' ? 'artwork' : v.mode === 'generated' ? 'generated' : v.mode === 'copy' ? 'copy' : 'editable';
  const approvedOf = a => !!(standing(a, 'copy') && (standing(a, 'design') || (current(a) || {}).mode === 'copy'));
  /* the worker's step states as the navigator draws them */
  const WF_CLASS = { complete: 'done', processing: 'running', in_progress: 'current', needs_review: 'review', not_started: 'todo', locked: 'locked', error: 'error', skipped: 'skipped' };
  /** Where the project stands: the worker's workflow (S17) for every step, with the counts the stages show. */
  function flowOf(p) {
    const base = flowCounts(p); const wf = p.workflow;
    if (!wf || !wf.steps) return base;
    const out = { counts: base.counts, wf };
    STAGES.forEach(s0 => { const st = wf.steps[s0.id] || {}; out[s0.id] = { state: WF_CLASS[st.state] || 'todo', raw: st.state, note: st.note || '', blocked: st.need || '', why: st.why || '' }; });
    return out;
  }
  /** Where the project stands, stage by stage: done, current, to do, running, skipped or blocked (with the reason). */
  function flowCounts(p) {
    const A = p.assets || [], n = A.length, b = p.brief || {}, jobs = p.jobs || [];
    const live = j => j.state === 'queued' || j.state === 'running';
    const chosen = p.directions.find(d => d.chosen);
    const rendersLive = jobs.filter(j => (j.stage === 'render' || j.stage === 'inspect') && live(j)).length;
    const writing = jobs.some(j => (j.stage === 'copy' || j.stage === 'sequence') && live(j));
    const valid = A.filter(validOf).length, approved = A.filter(approvedOf).length, ready = A.filter(a => approvedOf(a) && validOf(a)).length;
    const copyReady = A.filter(a => !!standing(a, 'copy')).length;
    const visual = A.filter(a => { const v = current(a); return v && v.mode !== 'copy'; });
    const awaitingImagery = visual.filter(needsImagery).length;
    const channels = (b.channels || []).length;
    const exported = p.thread.some(e => e.kind === 'export');
    return {
      counts: { n, valid, approved, ready, rendersLive, copyReady, visual: visual.length, awaitingImagery },
      brief: { state: n || p.directions.length || (b.objective && b.message) ? 'done' : 'current', note: channels ? channels + ' channel' + (channels === 1 ? '' : 's') : 'no channels yet' },
      directions: { state: chosen ? 'done' : n && !p.directions.length ? 'skipped' : p.directions.length ? 'current' : 'todo', note: chosen ? chosen.title : n && !p.directions.length ? 'not needed' : p.directions.length ? p.directions.length + ' to choose from' : 'optional' },
      copy: { state: writing ? 'running' : !n ? (channels ? 'todo' : 'blocked') : copyReady === n ? 'done' : 'current', blocked: 'Choose at least one channel in the brief first.', note: writing ? 'writing' : n ? copyReady + ' of ' + n + ' ready' : '' },
      design: { state: !n ? 'blocked' : !visual.length ? 'skipped' : rendersLive ? 'running' : visual.every(validOf) ? 'done' : 'todo', blocked: 'Write the copy first.', note: !visual.length && n ? 'copy only' : n ? visual.filter(validOf).length + ' of ' + visual.length + ' validated' + (awaitingImagery ? ', ' + awaitingImagery + ' awaiting imagery' : '') : '' },
      review: { state: !n ? 'blocked' : approved === n ? 'done' : approved || A.some(a => standing(a, 'copy') || standing(a, 'design')) ? 'current' : 'todo', blocked: 'Nothing has been made yet.', note: n ? approved + ' of ' + n + ' approved' : '' },
      export: { state: exported && ready ? 'done' : ready ? 'todo' : 'blocked', blocked: n ? 'No asset has both approvals and a passing validation yet.' : 'Nothing has been made yet.', note: ready ? ready + ' ready' : '' },
    };
  }
  /** A composition that plans imagery and has none on file yet, and none hidden or declined on purpose. */
  function needsImagery(a) {
    const v = current(a); if (!v || v.mode === 'copy' || v.mode === 'generated') return false;
    if (v.image && v.image.key) return false; const L = v.layout || {};
    if ((v.context || {}).imagery === 'none' || L.noImagery) return false;
    if (v.mode === 'finished' || L.finished) return true;
    if (L.v === 5) return (L.regions || []).some(r => r.role === 'background' || !(L.layers || []).some(l => l.type === 'img' && l.region === r.id && l.src));
    return !!(L.layers || []).length && !(L.style === 'typographic' && !L.image);
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
    const words = JSON.stringify((Array.isArray(layout.layers) ? layout.layers : []).filter(l => l.type === 'text').map(l => [l.font, l.weight, l.family || '', l.italic ? 1 : 0])) + JSON.stringify(layout.fonts || {});
    // what this composition needs, as one key: the state answered for another key (the version before, a layout just edited)
    // is never handed out as ready, so nothing measures the new version against the old version's images in the render between
    const want = (bgUrl || '') + '|' + srcs + '|' + words + '|' + (ns || '') + '|' + (nonce || 0);
    const [st, setSt] = useState({ imgs: { bg: null, logo: null }, fonts: null, failed: [], ready: false, key: '', want: '' });
    useEffect(() => {
      let live = true; setSt(s => Object.assign({}, s, { ready: false, want }));
      (async () => {
        const imgs = await loadImages(Object.assign({}, v || {}, { layout }), ns);
        const fonts = layout.layers ? await R.ensureFonts(layout, copy || (v && v.copy) || {}, { timeout: 4000 }) : null;
        if (live) setSt({ imgs, fonts, failed: imgs._failed || [], ready: true, want, key: (bgUrl || '') + '|' + srcs + '|' + words + '|' + Date.now() });
      })();
      // a face that finishes loading later still changes the measure: redraw and re-measure
      const onFonts = () => { if (live && layout.layers) R.ensureFonts(layout, copy || (v && v.copy) || {}, { timeout: 1500 }).then(fonts => { if (live) setSt(s => Object.assign({}, s, { fonts, key: s.key + '+f' })); }); };
      if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', onFonts);
      return () => { live = false; if (document.fonts && document.fonts.removeEventListener) document.fonts.removeEventListener('loadingdone', onFonts); };
    }, [bgUrl, srcs, words, ns, nonce || 0]);
    return st.want === want ? st : Object.assign({}, st, { ready: false });
  }
  function useImages(v, ns, layoutOverride) { return useComposition(v, ns, layoutOverride).imgs; }

  /* ------------------------------------------------------------ small parts */
  const Lbl = ({ children }) => html`<div class="st-lbl">${children}</div>`;
  /* the Studio's own line icons (24-unit grid, drawn here, no icon CDN): one stroke weight, round caps, currentColor */
  const ICON = {
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    minus: '<path d="M5 12h14"/>',
    align: '<path d="M4 6h16"/><path d="M7 10h10"/><path d="M4 14h16"/><path d="M7 18h10"/>',
    flip: '<path d="M12 3v18"/><path d="M8 7L3.5 12 8 17z"/><path d="M16 7l4.5 5-4.5 5z"/>',
    up: '<path d="M12 19V5"/><path d="M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14"/><path d="M6 13l6 6 6-6"/>',
    trash: '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/><path d="M8 10.5h5"/><path d="M10.5 8v5"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    design: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/><path d="M3.5 9.5h17"/><path d="M9.5 9.5v11"/>',
    text: '<path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5L6 19.5"/>',
    images: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 15.5l-5-5L6 19.5"/>',
    brand: '<path d="M12 3.5l7.5 8.5-7.5 8.5-7.5-8.5z"/><path d="M12 8.5v7"/>',
    layers: '<path d="M12 3.5l8.5 4.5-8.5 4.5-8.5-4.5z"/><path d="M3.5 12.5l8.5 4.5 8.5-4.5"/><path d="M3.5 16.5l8.5 4.5 8.5-4.5"/>',
    partner: '<path d="M11 3.5l1.9 4.9 4.9 1.9-4.9 1.9L11 17.1l-1.9-4.9-4.9-1.9 4.9-1.9z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    file: '<path d="M14 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5"/><path d="M9 13h6"/><path d="M9 16.5h6"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    square: '<rect x="4.5" y="4.5" width="15" height="15" rx="2.5"/>',
    portrait: '<rect x="5.5" y="3.5" width="13" height="17" rx="2.5"/>',
    wide: '<rect x="2.5" y="6.5" width="19" height="11" rx="2.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    download: '<path d="M12 4v11"/><path d="M7 10.5l5 5 5-5"/><path d="M5 19.5h14"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    // S17: the wizard's project types, the material starting points and the board's actions
    flag: '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
    reply: '<path d="M9.5 6.5L4 12l5.5 5.5"/><path d="M4.5 12h9a6 6 0 0 1 6 6v1"/>',
    chat: '<path d="M4.5 5.5h15a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-4.5 3.5V16.5h-2.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z"/>',
    megaphone: '<path d="M4 10v4a1 1 0 0 0 1 1h2.5l7.5 4V5L7.5 9H5a1 1 0 0 0-1 1z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5"/>',
    bell: '<path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    news: '<rect x="3.5" y="5" width="13.5" height="14" rx="1.5"/><path d="M17 8.5h2.5a1 1 0 0 1 1 1V17a2 2 0 0 1-2 2h-1.5"/><path d="M6.5 8.5h7.5"/><path d="M6.5 12h7.5"/><path d="M6.5 15.5h5"/>',
    bulb: '<path d="M9 17.5h6"/><path d="M10 20.5h4"/><path d="M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.4 1.2 2.3v1.7h4v-1.7c0-.9.4-1.7 1.2-2.3A5.5 5.5 0 0 0 12 3.5z"/>',
    diamond: '<path d="M7 4.5h10l3.5 5-8.5 10-8.5-10z"/><path d="M3.5 9.5h17"/><path d="M12 19.5l-3-10 3-5 3 5z"/>',
    bolt: '<path d="M13 3l-7.5 10.5H12l-1 7.5 7.5-10.5H12z"/>',
    dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    upload: '<path d="M12 15.5V4.5"/><path d="M7 9.5l5-5 5 5"/><path d="M5 19.5h14"/>',
    sparkle: '<path d="M12 3.5l1.8 5 5 1.8-5 1.8-1.8 5-1.8-5-5-1.8 5-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
    search: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7"/><path d="M12 16.8v.3"/>',
    history: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5V9H9"/><path d="M12 8v4.5l3 2"/>',
    shield: '<path d="M12 3.5l7 2.8v5.2c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6.3z"/><path d="M8.8 12.2l2.3 2.3 4.3-4.6"/>',
    sliders: '<path d="M5 7h9"/><path d="M18 7h1"/><circle cx="16" cy="7" r="2"/><path d="M5 17h3"/><path d="M12 17h7"/><circle cx="10" cy="17" r="2"/>',
    fit: '<path d="M4.5 9V4.5H9"/><path d="M15 4.5h4.5V9"/><path d="M19.5 15v4.5H15"/><path d="M9 19.5H4.5V15"/>',
    zoomin: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/><path d="M11 8.3v5.4"/><path d="M8.3 11h5.4"/>',
    zoomout: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/><path d="M8.3 11h5.4"/>',
    expand: '<path d="M14.5 4.5h5v5"/><path d="M19.5 4.5L13.5 10.5"/><path d="M9.5 19.5h-5v-5"/><path d="M4.5 19.5l6-6"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M15 4.5v15"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.5H15"/>',
    merge: '<path d="M6 4v5a6 6 0 0 0 6 6h6"/><path d="M18 4v5"/><path d="M15 12l3 3-3 3"/>',
    copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
    bookmark: '<path d="M6.5 4.5h11v15.5l-5.5-4-5.5 4z"/>',
    archive: '<rect x="3.5" y="4.5" width="17" height="4.5" rx="1"/><path d="M5 9v9.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9"/><path d="M10 13h4"/>',
    target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    pen: '<path d="M4.5 19.5l1-4.5L16 4.5l3.5 3.5L9 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.2"/><rect x="13" y="4" width="7" height="7" rx="1.2"/><rect x="4" y="13" width="7" height="7" rx="1.2"/><rect x="13" y="13" width="7" height="7" rx="1.2"/>',
    review: '<path d="M4.5 12.5l4 4L19.5 6"/><path d="M4.5 19.5h15"/>',
    alert: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5"/><path d="M12 17.2v.3"/>',
  };
  /* S18: the interface takes the client's colour, never the artwork's. The approved campaign accent first (kit
     campaigns[].accent), then the client palette's primary, then the Studio's neutral cyan; the colour is lightened until it
     reads on the Studio's dark panels (4.5:1 for text in the accent), and its ink (text on an accent fill) is whichever of
     near-black or white reads better, never under 4.5:1. The renderer draws every creative from its own layout, so nothing
     here can recolour a creative. */
  const hexRgb = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h || ''); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null; };
  const rgbHex = c => '#' + c.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
  const relLum = c => { const t = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * t[0] + 0.7152 * t[1] + 0.0722 * t[2]; };
  const ratioOf = (a, b) => { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const THEME_PANEL = [25, 29, 36];   // --sk-panel, #191d24
  function studioTheme(kit, campaignId) {
    const ok = h => !!hexRgb(h);
    const camp = ((kit && kit.campaigns) || []).find(c => c && c.id === campaignId);
    const source = camp && ok(camp.accent) ? 'campaign' : kit && kit.palette && ok(kit.palette.primary) ? 'client' : 'neutral';
    const base = source === 'campaign' ? camp.accent : source === 'client' ? kit.palette.primary : '#5dd4e5';
    let c = hexRgb(base); let i = 0;
    while (ratioOf(c, THEME_PANEL) < 4.5 && i++ < 40) c = c.map(v => v + (255 - v) * 0.08);
    const black = [8, 12, 16], white = [255, 255, 255];
    const ink = ratioOf(c, black) >= ratioOf(c, white) ? black : white; let j = 0;
    while (ratioOf(c, ink) < 4.5 && j++ < 40) c = ink === black ? c.map(v => v + (255 - v) * 0.06) : c.map(v => v * 0.92);
    const accent = rgbHex(c);
    return { source, base, accent, ink: rgbHex(ink), name: source === 'campaign' ? (camp.name || camp.id) : source === 'client' ? 'client palette' : 'Studio neutral' };
  }
  const Icon = ({ n, size }) => html`<svg class=${'st-ic st-ic-' + n} viewBox="0 0 24 24" width=${size || 16} height=${size || 16} fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" dangerouslySetInnerHTML=${{ __html: ICON[n] || '' }}></svg>`;
  const FORMAT_ICON = { '1:1': 'square', '4:5': 'portrait', '9:16': 'phone', '16:9': 'wide' };
  const Chip = ({ kind, children, title }) => html`<span class=${'st-chip ' + (kind || '')} title=${title || ''}>${children}</span>`;
  const CHECK_KIND = { matches: 'ok', fact: 'ok', differs: 'bad', unsupported: 'warn', banned: 'bad', overflow: 'warn', over_limit: 'warn', too_many_hashtags: 'warn', exclamation: 'warn', small_type: 'warn', logo_size: 'warn', mark_missing: 'bad' };
  const CHECK_WORD = { matches: 'matches source', fact: 'approved fact', differs: 'differs from source', unsupported: 'not supported', banned: 'banned term', overflow: 'overflow', over_limit: 'over the limit', too_many_hashtags: 'hashtags', exclamation: 'exclamation', small_type: 'small type', logo_size: 'logo size', mark_missing: 'mark missing' };
  /** The composition: the one renderer at preview size. A copy-only version is a text card; a flattened legacy tile is its image. */
  /** What this composition is, in one line: mode, medium, imagery and model, incomplete marks, failed loads, fallback fonts. */
  /** An image on the version that the layout tells the renderer not to draw: the type-only ground (noImagery, from the "solid
      ground" variation) or a plan with no background region. Answers why, or '' when the imagery shows (or there is none). */
  function hiddenImagery(v) {
    const L = v && v.image && v.layout && Array.isArray(v.layout.layers) ? v.layout : null; if (!L || v.mode === 'finished' || v.mode === 'artwork') return '';
    if (L.noImagery) return 'the layout is the type-only arrangement (solid ground), which draws no photograph';
    if (L.v === 5 && !(L.regions || []).some(r => r && r.role === 'background')) return 'the plan has no background region, so the renderer draws its ground instead of the photograph';
    return '';
  }
  /** The same layout with the imagery allowed to show: the type-only flag lifted and a full-stage background region present. */
  function showImagery(L) {
    const out = JSON.parse(JSON.stringify(L)); delete out.noImagery;
    if (out.v === 5 && !(out.regions || []).some(r => r && r.role === 'background')) out.regions = [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, fit: 'cover', prompt: 'keep the current image', refs: [] }].concat(out.regions || []);
    return out;
  }
  function compTag(v, layout, comp) {
    if (!v) return '';
    const base = v.mode === 'finished' ? (v.image ? 'finished creative: one bitmap, words' + ((layout && layout.baked || []).some(r => r === 'logo' || r === 'wordmark') ? ', ' + (layout.baked.indexOf('wordmark') >= 0 ? 'wordmark' : 'logo') : '') + ' and URL painted by the image model; nothing composed over it' : 'finished creative queued: this sketch is the plan the image model is briefed from, not the result') : v.mode === 'artwork' ? 'hybrid artwork: words in the bitmap' + (layout && layout.layers.some(l => l.role === 'logo' || l.role === 'wordmark') ? ', mark live' : '') : layout ? (layout.v === 5 ? (v.image || (layout.regions || []).every(r => /keep the current/i.test(r.prompt || '')) ? 'editable composition, ' : 'sketch (imagery not generated yet), ') + (layout.mediumName || 'plan') : 'editable composition, ' + (layout.templateName || layout.template)) : v.mode === 'generated' ? 'generated artwork, text baked in' : 'image';
    const img = v.image ? ' - ' + (v.image.model || '') + ' ' + (v.image.size || '') + (v.image.fallback ? ' (fallback from ' + (v.image.requested || 'the requested model') + ')' : '') + ((v.context || {}).size && v.image.size && v.context.size !== v.image.size ? ', asked ' + v.context.size : '') : layout ? ((v.context || {}).imagery === 'none' ? ' - no imagery, by choice' : ' - no imagery yet') : '';
    return base + img + (hiddenImagery(v) ? ' - IMAGERY HIDDEN: ' + hiddenImagery(v) : '') + (layout && (layout.incomplete || []).length ? ' - INCOMPLETE: mark not on file' : '') + (comp && comp.failed.length ? ' - ' + comp.failed.length + ' image' + (comp.failed.length === 1 ? '' : 's') + ' failed to load' : '') + (comp && comp.fonts && comp.fonts.fallback.length ? ' - fallback fonts' : '');
  }
  function Composition({ v, a, ns, size, copy, highlight, tagOut }) {
    const layout = v && v.layout && v.layout.layers ? v.layout : null; const c = copy || (v && v.copy) || {};
    // S9: an issue names its layers; the named layers are outlined on the tile itself (the layer box, in per cent of the stage)
    const hl = Array.isArray(highlight) && layout ? highlight.map(id => layout.layers.find(l => l && l.id === id)).filter(l => l && l.x != null && l.w != null) : [];
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
      ${hl.map(l => html`<div key=${'hl-' + l.id} class="st-hl" data-layer=${l.id} aria-hidden="true" style=${{ left: l.x + '%', top: l.y + '%', width: l.w + '%', height: l.h + '%' }}><span class="st-hl-lbl">${l.role || l.type}${l.id !== (l.role || l.type) ? ' ' + l.id : ''}</span></div>`)}
      ${size !== 'thumb' && size !== 'card' && size !== 'mini' && !tagOut ? html`<div class="st-comp-tag">${compTag(v, layout, comp)}</div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ workspace activity: everything that runs, visibly */
  /* Every job is shown while it runs: what it is (the stage in plain words), what it is doing now (the phase the worker
     reports mid-run, else its latest log line), how long it has taken against how long that stage typically takes here,
     a bar that is determinate only where the work is countable (the copy stage's channels, the run's finished steps) and
     indeterminate otherwise - a model call shows no share until it answers; nothing is estimated from the clock. The job
     model is STProgress (docs/studio-progress.js); this is its one consumer in the Studio. */
  const STAGE_NOTE = { render: 'one image model call; no share until it answers', copy: 'one model call for the words and plans, then one composition per channel', direct: 'one model call', strategy: 'one model call', concepts: 'one model call that sees the artwork', extract: 'one model call over the source', analyse: 'one model call: the material read against the client, its campaigns and knowledge (plus one to read an image or PDF)', kit: 'one model call for the whole kit', inspect: 'one model call that sees the composed tile', revise: 'one model call', sequence: 'one model call, then one composition per item', export: 'files written; nothing is generated', echo: 'a round trip' };
  function WorkspaceActivity({ p, status, now, ro, open, onToggle, onRetry, onCancel, onOpenJobs, onOpenAsset, liveOnly }) {
    const S = window.STProgress; if (!S || !p) return null;
    const all = p.jobs || []; const jobs = S.jobsForDisplay(all);
    const live = jobs.filter(S.active); const failed = jobs.filter(j => j.state === 'failed');
    const recent = jobs.filter(j => j.state === 'done' && now - (j.updated || 0) < 90000);
    if (!live.length && !failed.length && (liveOnly || !recent.length)) return null;
    const dur = (status && status.durations) || {}; const run = S.run(all, now);
    const title = id => (p.assets.find(x => x.id === id) || {}).title || '';
    const top = live.find(j => j.state === 'running') || live[0] || failed[0] || recent[0];
    const topJ = top ? S.job(top, now, dur[top.stage]) : null;
    const cards = (open ? live.concat(failed).concat(recent) : live.concat(failed)).slice(0, 12);
    const beacon = live.some(j => j.state === 'running') ? 'live' : live.length ? 'queued' : failed.length ? 'failed' : 'done';
    const running = live.filter(j => j.state === 'running').length, queued = live.length - running;
    return html`<section class=${'st-workspace-activity ' + beacon} aria-label="Activity">
      <div class="st-work-summary">
        <button class="st-work-toggle" onClick=${onToggle} aria-expanded=${open ? 'true' : 'false'} aria-controls="st-work-detail">
          <span class=${'st-work-beacon ' + beacon} aria-hidden="true"></span>
          <span class="st-work-lead"><span class="st-work-eyebrow">${live.length ? 'Working' : failed.length ? 'Needs attention' : 'Just finished'}</span><b>${topJ ? topJ.title + (top.asset && title(top.asset) ? ' for ' + title(top.asset) : '') : 'Nothing running'}</b>${topJ ? html`<span class="st-work-now" role="status" aria-live="polite">${topJ.phaseText}${live.length && topJ.time ? ' - ' + topJ.time : ''}${live.length && topJ.typical ? ' (typically ' + topJ.typical + ')' : ''}</span>` : null}</span>
          <span class="st-work-more">${open ? 'hide' : 'details'}</span>
        </button>
        <div class="st-work-metrics">
          ${live.length ? html`<div><b>${running}</b><span>running</span></div><div><b>${queued}</b><span>queued</span></div>` : null}
          ${failed.length ? html`<div class="bad"><b>${failed.length}</b><span>failed</span></div>` : null}
          ${run && run.total > 1 ? html`<div class="st-work-run" title=${run.text}><b>${run.done} of ${run.total}</b><span>steps done</span><div class=${'st-progress-track small' + (run.active ? ' active' : '')} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${run.percent} aria-valuetext=${run.done + ' of ' + run.total + ' steps finished'}><span style=${{ width: run.percent + '%' }}></span></div></div>` : null}
        </div>
      </div>
      ${open ? html`<div class="st-work-detail" id="st-work-detail"><div class="st-work-grid">${cards.map(j => { const x = S.job(j, now, dur[j.stage]); return html`<div key=${j.id} class=${'st-work-card ' + j.state + (x.slow ? ' slow' : '')} data-job=${j.id} data-stage=${j.stage} data-phase=${x.phase || ''}>
          <div class="st-work-card-head"><b>${x.title}</b><span class=${'st-status ' + j.state}>${j.state}</span></div>
          ${j.asset ? html`<div class="st-work-asset">${onOpenAsset && title(j.asset) ? html`<button class="ov-link" onClick=${() => onOpenAsset(j.asset)}>${title(j.asset)}</button>` : title(j.asset) || j.asset}</div>` : null}
          <div class="st-work-phase">${x.phaseText}</div>
          <div class=${'st-progress-track' + (x.percent == null ? ' indeterminate' : '') + (x.running ? ' active' : '')} role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${x.percent == null ? undefined : x.percent} aria-valuetext=${x.percent == null ? (x.running ? 'in progress, no measurable share yet' : x.label) : x.percent + '%'}><span style=${{ width: (x.percent == null ? (j.state === 'done' ? 100 : 0) : x.percent) + '%' }}></span></div>
          <div class="st-work-meta"><span>${x.percent != null ? x.completed + ' of ' + x.total + ' (' + x.percent + '%)' : STAGE_NOTE[j.stage] || ''}</span><span>${x.time}${x.typical ? ' / typically ' + x.typical : ''}${x.attempt > 1 ? ' / attempt ' + x.attempt + ' of 3' : ''}</span></div>
          ${x.slow ? html`<div class="st-work-slow">No update for ${Math.round((now - x.lastAt) / 1000)} s. A provider call can take a few minutes; if this tab was asleep, the worker's tick resumes the job.</div>` : null}
          ${j.state === 'failed' ? html`<div class="st-work-error">${explain({ message: j.error, code: (String(j.error || '').match(/^[a-z_0-9]+/) || [''])[0] }).title}</div>` : null}
          ${j.state === 'queued' && j.error ? html`<div class="st-work-hint ov-dim">${j.error}</div>` : null}
          <div class="st-work-acts">${!ro && j.state === 'failed' ? html`<button class="btn sm" onClick=${() => onRetry(j)}>Retry</button>` : null}${!ro && S.active(j) ? html`<button class="btn sm ghost" onClick=${() => onCancel(j.id)}>Cancel</button>` : null}<button class="ov-link" onClick=${onOpenJobs}>log</button></div>
        </div>`; })}</div>
        <div class="st-work-foot"><span>Shares are counts of finished steps; a model call shows none until it answers. Nothing here is estimated from the clock.</span><button class="ov-link" onClick=${onOpenJobs}>All jobs</button></div></div>` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ the frame: navigator, stage heading, notices */
  const FLOW_WORD = { done: 'complete', current: 'in progress', todo: 'not started', running: 'processing', skipped: 'skipped', blocked: 'locked', locked: 'locked', review: 'needs review', error: 'error' };
  /** The workflow navigator: every step reachable (a locked one opens on what unlocks it), its state and a short note. */
  function Flow({ flow, at, onGo }) {
    const ref = useRef(null);
    useEffect(() => { const el = ref.current && ref.current.querySelector('.st-step.on'); if (el && el.scrollIntoView && ref.current.scrollWidth > ref.current.clientWidth) { try { el.scrollIntoView({ inline: 'center', block: 'nearest' }); } catch (e) {} } }, [at]);
    return html`<nav class="st-steps st-flow" aria-label="Workflow" ref=${ref}>${STAGES.map((s, i) => { const f = flow[s.id] || {}; const on = at === s.id; const locked = f.state === 'locked' || f.state === 'blocked';
      return html`<button key=${s.id} class=${'st-step ' + (f.state || '') + (on ? ' on' : '')} aria-current=${on ? 'step' : undefined} data-state=${f.raw || f.state || ''} title=${s.sub + ': ' + (locked ? (f.blocked || 'locked') : f.state === 'skipped' ? 'skipped - ' + (f.note || 'not needed') : f.note || s.purpose)} onClick=${() => onGo(s.id)}>
        <span class="st-step-n" aria-hidden="true">${f.state === 'done' ? html`<${Icon} n="check" size=${13} />` : locked ? html`<${Icon} n="lock" size=${12} />` : f.state === 'error' ? '!' : f.state === 'skipped' ? '-' : String(i + 1).padStart(2, '0')}</span><span class="st-step-txt"><span class="st-step-l">${s.label}</span><span class="st-step-meta">${(() => { const note = locked ? 'Locked' : f.state === 'review' ? 'Needs review' : f.state === 'error' ? 'Error' : f.note || ''; return note ? html`<span class="st-step-note">${note}</span>` : html`<span class="st-step-sub">${s.sub}</span>`; })()}</span></span><span class="st-vh">, ${FLOW_WORD[f.state] || ''}</span>${f.state === 'running' ? html`<span class="st-step-live" aria-hidden="true"></span>` : null}${f.state === 'review' ? html`<span class="st-step-dot" aria-hidden="true"></span>` : null}</button>`; })}</nav>`;
  }
  /** The head of every stage (S18): it answers the same questions everywhere, in the same places - what this step is for (the
      purpose), what it needs, what its main action does (and what it costs), and what is blocking it - with the main action on the
      right and the step's views as tabs. What Axiom proposed and why is the step's own content, below. The longer account of what
      happens next is behind the help toggle, so the work starts high on the page. */
  function StageHead({ id, title, purpose, next, flow, children, tabs, tab, onTab, focusRef, compact }) {
    const f = (flow && flow[id]) || {};
    const si = STAGES.findIndex(x => x.id === id); const sd = STAGES[si] || {};
    const [help, setHelp] = useState(false);
    const blocked = f.state === 'blocked' || f.state === 'locked' ? (f.blocked || f.note || 'Locked until the step before is done.') : '';
    const heading = sd.headline || title;
    const facts = html`<dl class="st-stage-facts">
      <div><dt>Needs</dt><dd>${sd.need || purpose}</dd></div>
      <div><dt>Main action</dt><dd>${sd.act || next}</dd></div>
    </dl>`;
    const tabsEl = tabs ? html`<div class="st-subnav" role="tablist" aria-label=${sd.label + ' views'}>${tabs.map(([k, l, n]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${'st-railbtn st-subtab' + (tab === k ? ' on' : '')} onClick=${() => onTab(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`)}</div>` : null;
    return html`<div class=${'st-stagehead' + (compact ? ' compact' : '')}>
      <div class="st-stagehead-row">
        <div class="st-stagehead-main"><div class="st-eyebrow" aria-hidden="true"><span class="st-eyebrow-n">${String(si + 1).padStart(2, '0')}</span>${sd.label || title}</div><h2 class="st-stage-title" tabIndex="-1" ref=${focusRef} title=${compact ? purpose : undefined}>${heading}</h2></div>
        ${compact && tabsEl ? tabsEl : null}
        <div class="st-stagehead-acts">${children}<button class=${'st-iconbtn sm' + (help ? ' on' : '')} aria-expanded=${help ? 'true' : 'false'} onClick=${() => setHelp(!help)} title="What this step needs, what its actions do and cost" aria-label=${'About the ' + (sd.label || title) + ' step'}><${Icon} n="help" size=${15} /></button></div>
      </div>
      ${!compact ? html`<p class="st-stage-purpose">${purpose}</p>${facts}` : null}
      ${blocked ? html`<div class="st-blocked" role="status"><${Chip} kind="warn">blocked</${Chip}> ${blocked}</div>` : null}
      ${f.state === 'review' || f.state === 'error' || f.state === 'running' ? html`<div class=${'st-stepstate ' + f.state} role="status"><span class="st-stepstate-dot" aria-hidden="true"></span>${f.state === 'review' ? 'Needs review' : f.state === 'error' ? 'Error' : 'Processing'}${f.note ? html`<span class="ov-dim"> - ${f.note}</span>` : null}</div>` : null}
      ${help ? html`<div class="st-stage-help" role="note">${compact ? html`<p>${purpose}</p>${facts}` : null}${next ? html`<div class="st-stage-next"><span class="st-lbl">What happens next</span><span>${next}</span></div>` : null}</div>` : null}
      ${!compact && tabsEl ? tabsEl : null}
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
      ${!mine.length && !legacy.length ? html`<div class="st-empty-state st-first"><b>No projects yet for ${client.name}.</b><span>A project holds one piece of work from brief to export: its sources, objectives, strategy, directions, every version of every asset, the approvals and the exports. Start from what you have; the project wizard asks for the type, the client and the campaign first:</span>
        ${canWrite() ? html`<div class="st-first-acts">${[['analyse', 'A brief or article', 'today\'s brief, an article or a file: Axiom reads it against the client first'], ['release', 'A media release', 'Axiom reads its claims and figures before anything is written'], ['brief', 'A brief or one line', 'write what is needed; each step is confirmed before the next'], ['reference', 'Existing creative', 'start from artwork you already have']].map(([k, l, t]) => html`<button key=${k} class="st-first-btn" onClick=${() => onStart(k)}><b>${l}</b><span>${t}</span></button>`)}</div>` : html`<span class="ov-dim">This key can read only; a full key is needed to start a project.</span>`}</div>` : null}
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
    const [start, setStart] = useState(['analyse', 'release', 'brief', 'reference'].indexOf(pr.start) >= 0 ? pr.start : 'release');
    const [akind, setAkind] = useState(pr.kind || 'brief');
    const [deliverable, setDeliverable] = useState(['copy', 'visual', 'set'].indexOf(pr.deliverable) >= 0 ? pr.deliverable : 'set');
    const camps = (kit && kit.campaigns || []).filter(c => c.active !== false);
    // the campaign is the team's choice: with one campaign in the kit it is shown chosen and named as such; with several nothing is chosen until someone chooses
    const [campaign, setCampaign] = useState(pr.campaign != null ? pr.campaign : camps.length === 1 ? camps[0].id : '');
    const [campChosen, setCampChosen] = useState(pr.campaign != null || camps.length <= 1);
    const [text, setText] = useState(pr.text || ''); const [instruction, setInstruction] = useState(pr.instruction || '');
    const [chs, setChs] = useState({ linkedin: true, instagram: true, facebook: true, x: false });
    const [file, setFile] = useState(null);
    const [route, setRoute] = useState(pr.route === 'guided' ? 'guided' : 'quick');
    // the creation mode is chosen here, before anything is generated, and travels with the project
    const [mode, setMode] = useState(pr.creationMode === 'finished' ? 'finished' : 'editable');
    const [timing, setTiming] = useState(pr.imageryTiming === 'after_copy' ? 'after_copy' : 'with_copy');
    const camp = camps.find(c => c.id === campaign) || null; const policy = camp ? camp.logoPolicy || 'logo' : 'logo';
    const markOnFile = camp ? (policy === 'wordmark' ? !!camp.hasWordmark : policy === 'both' ? !!(camp.hasWordmark && kit && kit.hasLogo) : policy === 'none' ? true : !!(kit && kit.hasLogo)) : !!(kit && kit.hasLogo);
    const clear = start === 'analyse' ? false : start === 'brief' ? isClear(text) : start === 'release' ? !!instruction.trim() : true;
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setFile({ name: f.name, mime: f.type || 'image/png', b64: String(rd.result).split(',')[1] }); rd.readAsDataURL(f); };
    return html`<div class="st-intake">
      <div class="ov-title">New project for ${client.name}</div>
      ${pr.from ? html`<div class="ov-dim">${pr.from === 'release' ? 'The Release Desk is this intake now: paste the release, the ledger is read, tiles and copy come out of the same project.' : pr.from === 'content' ? 'The Content Desk is this intake now: a brief in, copy per channel out, with the same checks and the same voice.' : pr.from === 'sentinel' ? 'Drafted from a Sentinel alert: the alert is the brief; edit it, pick the channels and create the project.' : ''}</div>` : null}
      <div class="st-intake-row">
        <div><${Lbl}>Route</${Lbl}><div class="st-seg" role="radiogroup" aria-label="Route">${[['quick', 'Quick production', 'a clear, approved brief: straight to production'], ['guided', 'Guided campaign development', 'strategy first, then three directions, then a sequence']].map(([k, l, t]) => html`<button key=${k} class=${'st-segbtn' + (route === k ? ' on' : '')} title=${t} role="radio" aria-checked=${route === k} onClick=${() => setRoute(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Start from</${Lbl}><div class="st-seg">${[['analyse', 'A brief or article to analyse'], ['release', 'A release or source document'], ['brief', 'A brief or one line'], ['reference', 'Existing creative or references']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (start === k ? ' on' : '')} onClick=${() => setStart(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Deliverable</${Lbl}><div class="st-seg">${[['copy', 'Copy only'], ['visual', 'Visual creative'], ['set', 'Coordinated campaign set']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (deliverable === k ? ' on' : '')} onClick=${() => setDeliverable(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Campaign</${Lbl}><select class="st-sel" value=${campChosen ? campaign : '__'} onChange=${e => { if (e.target.value === '__') { setCampChosen(false); return; } setCampaign(e.target.value); setCampChosen(true); }} aria-label="Campaign">${!campChosen ? html`<option value="__">Choose the campaign...</option>` : null}<option value="">No campaign</option>${camps.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select><div class="ov-dim">${!camps.length ? 'No campaigns in this client\'s brand kit yet.' : !campChosen ? 'The kit has ' + camps.length + ' campaigns; the first is not assumed. The campaign decides the mark, the colours and the facts in play.' : camps.length === 1 && campaign ? 'The kit\'s only campaign is shown chosen; pick "No campaign" if this work is not part of it.' : 'From the brand kit. Choosing a campaign never changes the client or its approved facts.'}</div></div>
      </div>
      ${start === 'analyse' ? html`<div class="st-intake-an"><div class="st-seg" role="radiogroup" aria-label="What the material is">${ANALYSE_KINDS.map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (akind === k ? ' on' : '')} role="radio" aria-checked=${akind === k} onClick=${() => setAkind(k)}>${l}</button>`)}</div>
        <div class="ov-dim">The material is read against ${client.name} first: what concerns them is kept, the rest set aside with the reason; it is matched to a campaign, checked against the approved facts and the knowledge, and you get a proposed brief, copy angles and visual narratives (editable layout or finished Gemini creative). Nothing is produced until you choose.</div></div>` : null}
      <${Lbl}>${start === 'analyse' ? 'Paste the brief, the article or today\'s brief' : start === 'release' ? 'Paste the release or source text' : start === 'brief' ? 'The brief, or one line' : 'What to do with the reference'}</${Lbl}>
      <textarea class="st-ta" rows="7" value=${text} onInput=${e => setText(e.target.value)} placeholder=${start === 'release' ? 'Paste the release text. Claims, figures and quotations are extracted with their passages before anything is written.' : start === 'brief' ? 'e.g. "Write three LinkedIn posts on the $74 billion figure in the HOOF voice" (a clear instruction goes straight to production) or "Something for Victoria about regional jobs" (an open brief gets two directions first)' : 'e.g. "Adapt the approved harvester tile for Instagram 4:5 and a 9:16 story; keep the headline"'}></textarea>
      ${start === 'release' ? html`<div><${Lbl}>Instruction (optional: a clear instruction skips the direction step)</${Lbl}><input class="st-in" value=${instruction} onInput=${e => setInstruction(e.target.value)} placeholder='e.g. "Three posts on the $74 billion figure" - leave empty to get two directions first' /></div>` : null}
      ${start === 'reference' ? html`<div class="st-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange=${pick} aria-label="Reference image" /> ${file ? html`<span>${file.name} attached as a composition reference.</span>` : html`<span>Attach artwork or a reference image (PNG, JPEG, WebP). Competitor work is inspiration only.</span>`}</div>` : null}
      ${deliverable !== 'copy' ? html`<div class="st-modes" role="radiogroup" aria-label="Creation mode"><${Lbl}>Creation mode</${Lbl}><div class="st-seg">${[['editable', 'Editable Studio'], ['finished', 'Gemini Finished Creative']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (mode === k ? ' on' : '')} role="radio" aria-checked=${mode === k} onClick=${() => setMode(k)}>${l}</button>`)}</div>
        <div class="ov-dim st-mode-note">${mode === 'editable' ? 'Gemini makes the imagery; the Studio composes the words, the exact mark file, the URL and the shapes as live layers you can edit, measure and export. The mark is placed from its file, never redrawn.' : 'Gemini paints the whole piece - words, the campaign mark and the URL - from the approved copy, with the mark file given to it as an image to reproduce. One flattened image: nothing is composed over it, no layer is editable, and the Creative Director reads the words and the mark back before design approval. Revisions regenerate the whole piece; caption and alt text are edited separately. Spelling and the mark are asked for exactly and checked, never guaranteed.'}${mode === 'finished' && !markOnFile ? ' The campaign mark is not on file: finished mode will refuse to produce until it is uploaded (Brand view), because nothing is painted in its place.' : ''}</div>
        <div class="st-timing-row" role="radiogroup" aria-label="When the imagery is made"><${Lbl}>Imagery</${Lbl}><div class="st-seg">${[['with_copy', 'With the copy'], ['after_copy', 'After the copy is ready']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (timing === k ? ' on' : '')} role="radio" aria-checked=${timing === k} onClick=${() => setTiming(k)}>${l}</button>`)}</div>
        <div class="ov-dim">${timing === 'after_copy' ? 'The copy and layouts are made first; no render is spent until the words are ready and you generate the imagery in Design.' + (mode === 'finished' ? ' Recommended for a finished creative, whose words are painted into the image.' : '') : 'The renders are queued as soon as the copy is written, and run while you check the words.' + (mode === 'finished' ? ' A finished creative paints the words: changing them later means generating it again.' : '')}</div></div></div>` : null}
      ${deliverable !== 'visual' ? html`<div><${Lbl}>Channels (edit freely)</${Lbl}><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + (chs[k] ? ' on' : '')} onClick=${() => setChs(Object.assign({}, chs, { [k]: !chs[k] }))}>${CHANNELS[k].label} ${CHANNELS[k].format}</button>`)}</div></div>` : html`<div class="ov-dim">Visual creative: an Instagram 4:5 composition; adapt to other formats afterwards.</div>`}
      <div class="st-intake-foot">
        <span class="ov-dim">${start === 'analyse' ? 'One model call reads the material against the client; then you choose the next step.' : route === 'guided' ? 'Guided: ' + (start === 'release' ? 'the source is read first, then ' : '') + 'a creative strategy to confirm, then three directions to choose from; nothing is produced until you choose.' : start === 'release' ? (clear ? 'Extraction first, then production from your instruction; no direction step.' : 'Extraction first, then two directions to choose from.') : start === 'brief' ? (clear && text ? 'Reads as a clear instruction: production starts without a direction step.' : 'Reads as an open brief: two directions first.') : 'Production from the reference and your instruction; no direction step.'}</span>
        <button class="btn sm ghost" onClick=${onCancel}>Cancel</button>
        <button class="btn sm" disabled=${!text.trim() || !campChosen} title=${!campChosen ? 'Choose the campaign first' : ''} onClick=${() => onCreate({ route, start, kind: akind, deliverable, campaign, campaignConfirmed: campChosen, creationMode: deliverable === 'copy' ? 'editable' : mode, imageryTiming: deliverable === 'copy' ? undefined : timing, text: text.trim(), instruction: instruction.trim(), channels: deliverable === 'visual' ? ['instagram'] : Object.keys(chs).filter(k => chs[k]), clear, file })}>Create project</button>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ rail and centre views */
  /** The left rail: the assets (what Refine works on) with their state, then the project's tools. */
  const ASSET_WORD = { approved: 'approved', partly: 'partly approved', revised: 'revised, not approved', draft: 'draft' };
  function Rail({ p, view, setView, sel, setSel, toolsOpen, setToolsOpen, layersRef, onCollapse }) {
    const fams = useMemo(() => { const m = {}; (p.assets || []).forEach(a => { (m[a.family] = m[a.family] || []).push(a); }); return m; }, [p.assets]);
    const stat = a => { const c = standing(a, 'copy'), d = standing(a, 'design'); const cur = current(a); return c && (d || (cur && cur.mode === 'copy')) ? 'approved' : c || d ? 'partly' : vtotal(a) > 1 ? 'revised' : 'draft'; };
    const tech = a => { const v = current(a); if (!v || v.mode === 'copy' || v.mode === 'generated') return ''; if (v.mode === 'finished') { const b = (a.readiness || {}).baked; return !v.image ? 'not generated yet' : b && b.verified ? '' : 'words and mark not read back'; } const t = (a.readiness || {}).technical; return t === 'passed' ? '' : t === 'failed' ? 'failing validation' : 'not validated'; };
    const live = (p.jobs || []).filter(j => j.state === 'queued' || j.state === 'running').length;
    const failed = (p.jobs || []).filter(j => j.state === 'failed').length;
    const busyOn = id => (p.jobs || []).some(j => j.asset === id && (j.state === 'queued' || j.state === 'running'));
    const tools = [['brand', 'Brand'], ['context', 'Client context'], ['jobs', 'Jobs', live || (failed ? failed + ' failed' : null)]];
    return html`<nav class="st-rail" aria-label="Assets and project tools">
      ${onCollapse ? html`<button class="st-rail-collapse" onClick=${onCollapse} aria-label="Collapse the left panel" title="Collapse the left panel">‹</button>` : null}
      <div class="st-rail-sec st-layers-sec" ref=${layersRef}></div>
      <div class="st-rail-sec"><${Lbl}>Assets ${p.assets.length ? '(' + p.assets.length + ')' : ''}</${Lbl}>
      ${Object.keys(fams).map(f => html`<div key=${f} class="st-fam" role="group" aria-label=${f}><div class="st-famname">${f}</div>${fams[f].map(a => { const t = tech(a); const s0 = stat(a); return html`<button key=${a.id} class=${'st-railbtn asset st-assetpick' + ((view === 'asset' || view === 'copywrite') && sel === a.id ? ' on' : '')} aria-current=${(view === 'asset' || view === 'copywrite') && sel === a.id ? 'true' : undefined} onClick=${() => { setSel(a.id); setView(view === 'copywrite' ? 'copywrite' : 'asset'); }} title=${a.title + ': ' + ASSET_WORD[s0] + (t ? ', ' + t : '')}>
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
  function Combo({ id, value, onChange, items, rows, disabled, placeholder, label }) {
    const [open, setOpen] = useState(false);
    const q = String(value || '').toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const list = (items || []).filter(it => !value || it.text.toLowerCase() !== String(value).toLowerCase()).map(it => ({ it, score: q.length ? q.filter(w => it.text.toLowerCase().indexOf(w) >= 0).length : 0 })).sort((x, y) => y.score - x.score).slice(0, open ? 8 : 3).map(x => x.it);
    return html`<div class="st-combo">
      <textarea class="st-ta" rows=${rows || 2} id=${id} aria-label=${label || id} value=${value || ''} disabled=${disabled} placeholder=${placeholder || ''} onInput=${e => onChange(e.target.value, 'team')} onFocus=${() => setOpen(true)}></textarea>
      ${!disabled && list.length ? html`<div class="st-combo-list" role="listbox" aria-label=${'Suggestions for ' + id}>${list.map((it, i) => html`<button key=${i} class="st-combo-opt" role="option" title=${it.from || ''} onClick=${() => { onChange(it.text, it.source, it); setOpen(false); }}><${Chip} kind=${SRC_KIND[it.source]}>${SRC_WORD[it.source] || it.source}</${Chip}> ${it.text}${it.from ? html` <span class="ov-dim">- ${it.from}</span>` : null}</button>`)}${(items || []).length > list.length && !open ? html`<button class="ov-link" onClick=${() => setOpen(true)}>more (${items.length})</button>` : null}</div>` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ the brief engine: material in, read against the client */
  const ANALYSE_KINDS = [['brief', 'A written brief'], ['daily', 'Today\'s daily brief'], ['article', 'A news article'], ['release', 'A media release'], ['statement', 'A statement or announcement'], ['social', 'A social media post'], ['situation', 'A situation to respond to'], ['upload', 'An uploaded document'], ['other', 'Something else']];
  const CLAIM_WORD = { matches_fact: ['ok', 'matches an approved fact'], conflicts_fact: ['bad', 'conflicts with an approved fact'], new_unverified: ['warn', 'new, not verified'] };
  /** Paste or upload the material; the engine sorts what concerns this client from what does not, then proposes. */
  function AnalyseBox({ client, onAnalyse, busy, open0, onClose }) {
    const [via, setVia] = useState('paste'); const [kind, setKind] = useState('brief'); const [text, setText] = useState(''); const [name, setName] = useState(''); const [file, setFile] = useState('');
    const [ins, setIns] = useState(''); const [note, setNote] = useState(''); const [url, setUrl] = useState(''); const [bin, setBin] = useState(null); const [feed, setFeed] = useState(null);
    // text files are read here; an image (a screenshot, a social post, a creative) or a PDF goes to the worker as it is and is read there
    const pick = e => { const f = e.target.files && e.target.files[0]; if (!f) return; if (f.size > 8000000) { setNote('That file is over 8 MB; upload a smaller copy or paste the part that matters.'); return; }
      const isBin = /^image\/(png|jpeg|webp|gif)$/.test(f.type) || f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const rd = new FileReader();
      if (isBin) { rd.onload = () => { setBin({ name: f.name, mime: f.type || 'application/pdf', b64: String(rd.result).split(',')[1], kb: Math.round(f.size / 1024) }); setText(''); setFile(f.name); setName(n => n || f.name.replace(/\.[a-z0-9]+$/i, '')); setNote(f.type === 'application/pdf' || /\.pdf$/i.test(f.name) ? 'The PDF is read into text by the model, then analysed.' : 'The image is read into text by the model (what it says and what it shows), then analysed with the image in view.'); }; rd.readAsDataURL(f); return; }
      rd.onload = () => { let t = String(rd.result || ''); if (/html?$/i.test(f.name) || /<\/(p|div|h\d)>/i.test(t)) { const d = new DOMParser().parseFromString(t, 'text/html'); d.querySelectorAll('script,style,nav,header,footer').forEach(x => x.remove()); t = Array.from(d.body.querySelectorAll('h1,h2,h3,h4,p,li,blockquote')).map(x => x.textContent.trim()).filter(Boolean).join('\n\n') || d.body.textContent; }
        setBin(null); setText(t.trim()); setFile(f.name); setName(n => n || f.name.replace(/\.[a-z0-9]+$/i, '')); if (kind === 'brief') setKind('upload'); setNote(''); }; rd.readAsText(f); };
    const today = async () => { setNote('Fetching today\'s brief...'); try { const d = await call('/brief/daily'); const md = d.md || [d.brief && d.brief.headline, d.brief && d.brief.summary].filter(Boolean).join('\n\n'); if (!md) throw new Error('the brief has no text'); setVia('paste'); setText(md); setKind('daily'); setName('Daily brief ' + (d.day || '')); setNote(d.isToday ? 'Today\'s brief (' + d.day + ') is in; it covers every client - the analysis keeps what concerns ' + client.name + '.' : 'No brief for today yet: this is the latest, ' + d.day + '.'); } catch (e) { setNote('No daily brief to fetch: ' + (e.message || e)); } };
    useEffect(() => { if (via !== 'axiom' || feed) return; let live = true; call('/studio/intake/feed?ns=' + encodeURIComponent(client.id)).then(d => { if (live) setFeed(d); }).catch(e => { if (live) setFeed({ error: e.message }); }); return () => { live = false; }; }, [via]);
    const urlOk = /^https?:\/\/\S+\.\S+/.test(url.trim());
    const ok = via === 'link' ? urlOk : via === 'file' ? !!(bin || text.trim().length >= 20) : text.trim().length >= 20;
    const go = () => { if (via === 'link') return onAnalyse({ via: 'url', url: url.trim(), instruction: ins.trim() }); if (via === 'file' && bin) return onAnalyse({ via: 'file', b64: bin.b64, mime: bin.mime, name: name.trim() || bin.name, instruction: ins.trim() }); return onAnalyse({ kind, text: text.trim(), name: name.trim() || (ANALYSE_KINDS.find(x => x[0] === kind) || [])[1], instruction: ins.trim(), file }); };
    const item = (type, id) => onAnalyse({ via: 'item', type, id, instruction: ins.trim() });
    return html`<div class="st-field st-analyse" aria-label="Analyse a brief">
      <div class="st-field-head"><${Lbl}>Analyse a brief, a situation or any material</${Lbl}>${onClose ? html`<button class="ov-link" onClick=${onClose}>Close</button>` : null}</div>
      <div class="ov-dim">A brief rarely arrives as a brief. Paste a brief, today's intelligence brief, an article, a statement, a social post or an email; give a link; upload a screenshot, a PDF or a document; or start from something Axiom already holds. One model call reads it against ${client.name} - what happened, why it matters to them, whether to respond - and proposes objectives, key messages, response strategies and creative directions for you to choose from. Nothing is produced until you choose.</div>
      <div class="st-seg st-via" role="tablist" aria-label="Where the material comes from">${[['paste', 'Paste'], ['link', 'Link'], ['file', 'File or screenshot'], ['axiom', 'From Axiom']].map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${via === k} class=${'st-segbtn' + (via === k ? ' on' : '')} onClick=${() => setVia(k)}>${l}</button>`)}</div>
      ${via === 'paste' || (via === 'file' && !bin && text) ? html`<div class="st-seg" role="radiogroup" aria-label="What the material is">${ANALYSE_KINDS.map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (kind === k ? ' on' : '')} role="radio" aria-checked=${kind === k} onClick=${() => setKind(k)}>${l}</button>`)}</div>
        <textarea class="st-ta" rows="8" value=${text} onInput=${e => setText(e.target.value)} aria-label="The material to analyse" placeholder=${kind === 'daily' ? 'Paste today\'s brief from the front page (Copy), or fetch it below.' : kind === 'article' ? 'Paste the article text (headline and body).' : 'Paste the brief, the statement, the post or the situation.'}></textarea>` : null}
      ${via === 'link' ? html`<input class="st-in" type="url" value=${url} onInput=${e => setUrl(e.target.value)} placeholder="https://... a news story, a statement, a post" aria-label="Link to the material" /><div class="ov-dim">The page is read through Axiom's full-text reader (the publisher's own page, its AMP copy or an archive); a paywalled page that cannot be read says so - paste it instead.</div>` : null}
      ${via === 'file' ? html`<label class="st-drop sm"><input type="file" accept=".txt,.md,.markdown,.html,.htm,.csv,.json,.pdf,image/png,image/jpeg,image/webp,image/gif,text/plain,text/markdown,text/html,application/pdf" onChange=${pick} aria-label="Upload a document or screenshot" /> ${file ? html`<span>${file}${bin ? ' (' + bin.kb + ' KB)' : ''}</span>` : html`<span>Upload a screenshot, a PDF, or a .txt / .md / .html file</span>`}</label>` : null}
      ${via === 'axiom' ? html`<div class="st-feed" aria-label="What Axiom holds for this client">${!feed ? html`<div class="ov-dim">Reading what Axiom holds for ${client.name}...</div>` : feed.error ? html`<div class="ov-dim">${feed.error}</div>` : html`
        ${feed.brief ? html`<div class="st-feed-row"><span><b>Daily brief ${feed.brief.day}</b> <span class="ov-dim">${feed.brief.headline}</span></span><button class="btn sm ghost" disabled=${!!busy} onClick=${() => item('brief', feed.brief.day)}>Analyse</button></div>` : null}
        ${(feed.alerts || []).map(x => html`<div key=${'a' + x.id} class="st-feed-row"><span><${Chip} kind="warn">Sentinel</${Chip}> <b>${x.label}</b> <span class="ov-dim">x${x.ratio}, ${ago(x.at)}${x.acked ? ', acknowledged' : ''}</span></span><button class="btn sm ghost" disabled=${!!busy} onClick=${() => item('alert', x.id)}>Analyse</button></div>`)}
        ${(feed.narratives || []).map(x => html`<div key=${'n' + x.id} class="st-feed-row"><span><${Chip}>narrative</${Chip}> <b>${x.label}</b> <span class="ov-dim">${x.rows} rows, ${x.status}</span></span><button class="btn sm ghost" disabled=${!!busy} onClick=${() => item('narrative', x.id)}>Analyse</button></div>`)}
        ${(feed.news || []).map(x => html`<div key=${'s' + x.id} class="st-feed-row"><span><${Chip}>news</${Chip}> <b>${x.title}</b> <span class="ov-dim">${x.outlet}, ${ago(x.at)}</span></span><button class="btn sm ghost" disabled=${!!busy} onClick=${() => item('news', x.id)}>Analyse</button></div>`)}
        ${!feed.brief && !(feed.alerts || []).length && !(feed.narratives || []).length && !(feed.news || []).length ? html`<div class="ov-dim">Nothing live for ${client.name}: no alerts, narratives or news on its issues in the last days.</div>` : null}`}</div>` : null}
      ${via !== 'axiom' ? html`<div class="st-analyse-row">${via === 'paste' ? html`<button class="btn sm ghost" onClick=${today}>Use today's daily brief</button>` : null}<input class="st-in" value=${name} onInput=${e => setName(e.target.value)} placeholder="Name (e.g. ATO ruling coverage, 6 Oct)" aria-label="Name of the material" /></div>` : null}
      <input class="st-in" value=${ins} onInput=${e => setIns(e.target.value)} placeholder='Optional note for the analysis, e.g. "only the regional angle"' aria-label="Note for the analysis" />
      ${note ? html`<div class="ov-dim" role="status">${note}</div>` : null}
      ${via !== 'axiom' ? html`<div class="st-nd-row"><button class="btn sm" disabled=${!!busy || !ok} title=${!ok ? 'Give the material first' : ''} onClick=${go}>Analyse against ${client.name} (1 model call${via === 'file' && bin ? ', plus 1 to read the file' : ''})</button><span class="ov-dim">${via === 'paste' && text.trim() ? text.trim().split(/\n\s*\n/).filter(Boolean).length + ' paragraphs' : ''}</span></div>` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ S16: the intelligence engine in the page */
  const WORD = s => String(s || '').replace(/_/g, ' ');
  const INPUT_WORD = { formal_brief: 'Formal brief', news: 'News development', reactive: 'Reactive situation', client_request: 'Client request', campaign_update: 'Campaign update', competitor: 'Competitor activity', political: 'Political announcement', research: 'Research / data', social: 'Social conversation', reputation: 'Reputation issue', proactive: 'Proactive opportunity', response_artwork: 'Response artwork', daily_brief: 'Daily brief', other: 'Other material' };
  const STRAT_WORD = { direct: 'Direct response', indirect: 'Indirect response', evidence: 'Evidence-led', values: 'Values-based', rapid: 'Rapid reaction', education: 'Education', campaign: 'Campaign integration', none: 'Do not respond' };
  const BASIS_WORD = { stated: 'stated', inferred: 'inferred', knowledge: 'from knowledge' };
  const FIELD_WORD = { client: 'Client', campaign: 'Campaign', situation: 'Situation', objective: 'Objective', topic: 'Topic', issue: 'Issue', audience: 'Audience', platforms: 'Platforms', deliverable: 'Deliverable', keyMessage: 'Key message', cta: 'Call to action', tone: 'Tone', timing: 'Timing', urgency: 'Urgency', mandatory: 'Mandatory', restrictions: 'Restrictions', compliance: 'Compliance', sources: 'Sources', evidence: 'Evidence', stakeholders: 'Stakeholders' };
  const KNOW_WORD = { K: 'Mind', N: 'Live narratives', A: 'Sentinel alerts', D: 'Recorded decisions', H: 'Earlier choices', S: 'Sentiment' };
  const VIS_WORD = { scene: 'Scene', artDirection: 'Art direction', composition: 'Composition', subject: 'Subject', environment: 'Environment', camera: 'Camera', lighting: 'Lighting', typography: 'Typography', hierarchy: 'Hierarchy', colour: 'Colour', brand: 'Brand treatment', dataViz: 'Data visualisation', emotion: 'Emotional tone', motion: 'Motion', dimensions: 'Dimensions', textPlacement: 'Text placement', ctaPlacement: 'CTA placement' };
  /** Source -> objective -> message -> strategy -> direction: where a piece of work came from, from the record. */
  function TraceLine({ tr, p }) {
    const src = (p.sources || []).find(s => s.id === tr.source);
    const parts = [src ? 'Source: ' + src.name + ((tr.sources || []).length ? ' (' + tr.sources.slice(0, 4).join(', ') + ')' : '') : '', tr.objective ? tr.objective + (tr.objectiveTitle ? ' ' + tr.objectiveTitle : '') : '', tr.message ? tr.message + (tr.messageText ? ' "' + tr.messageText + '"' : '') : '', tr.strategy ? tr.strategy + ' ' + WORD(tr.strategyKind) : '', tr.directionTitle ? 'Direction "' + tr.directionTitle + '"' + (tr.approach ? ' (' + WORD(tr.approach) + ')' : '') : ''].filter(Boolean);
    return parts.length ? html`<div class="st-trace" aria-label="Where this came from"><span class="st-lbl">Traceable to</span> ${parts.map((x, i) => html`<span key=${i} class="st-trace-step">${x}</span>`)}${(tr.evidence || []).length ? html`<span class="ov-dim"> evidence ${tr.evidence.join(', ')}</span>` : null}</div>` : null;
  }
  /** The reading of the material, in the order a strategist works, with the choices the team makes on it. */
  function IntelSections({ p, it, ro, busy, client, onSelect, onDecision, onChoose, onVariants, onKit, onGo }) {
    const sel = ((p.brief || {}).intel || {}).selected || {}; const rec = it.recommendation || {};
    const [obj, setObj] = useState(sel.objective ? sel.objective.id : rec.objective || ((it.objectives || [])[0] || {}).id || '');
    const [msg, setMsg] = useState(sel.message ? sel.message.id : rec.message || '');
    const [strat, setStrat] = useState(sel.strategy ? sel.strategy.id : rec.strategy || '');
    const [pick, setPick] = useState([]); const [open, setOpen] = useState({}); const [kitKinds, setKitKinds] = useState(['talking_points', 'statement', 'linkedin']);
    useEffect(() => { setObj(sel.objective ? sel.objective.id : rec.objective || ((it.objectives || [])[0] || {}).id || ''); setMsg(sel.message ? sel.message.id : rec.message || ''); setStrat(sel.strategy ? sel.strategy.id : rec.strategy || ''); }, [it.id]);
    const O = (it.objectives || []).find(o => o.id === obj) || null; const sit = it.situation || {}; const cmp = it.comparison || {}; const u = it.understanding || {};
    const dirs = (it.directions || []).map(d => Object.assign({}, d, { row: p.directions.find(x => x.id === d.directionId) })).filter(d => d.row);
    const chosenSel = sel.objective && sel.objective.id === obj && (!msg || (sel.message && sel.message.id === msg)) && (!strat || (sel.strategy && sel.strategy.id === strat));
    const noResp = ((p.brief || {}).intel || {}).noResponse; const recommendsNo = sit.respond === 'no' || (it.next || {}).stage === 'decide';
    const topicsBy = r => (it.topics || []).filter(t => t.relevance === r);
    const toggle = id => setPick(pk => pk.indexOf(id) >= 0 ? pk.filter(x => x !== id) : pk.concat([id]));
    const picked = dirs.filter(d => pick.indexOf(d.directionId) >= 0);
    const L = (label, list) => (list || []).length ? html`<div class="st-cmp-row"><span class="st-lbl">${label}</span><ul class="st-ul">${list.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null;
    return html`<div class="st-intel" aria-label="Axiom Understanding">
      <div class="st-intel-head"><h3>Axiom Understanding</h3>
        <${Chip}>${INPUT_WORD[(it.input || {}).type] || 'Material'}</${Chip}>${u.urgency ? html`<${Chip} kind=${u.urgency.v === 'critical' || u.urgency.v === 'high' ? 'warn' : ''}>urgency ${u.urgency.v}</${Chip}>` : null}
        <${Chip} kind=${sit.respond === 'no' ? 'bad' : sit.respond === 'monitor' ? 'warn' : 'ok'}>${sit.respond === 'no' ? 'recommends not responding' : sit.respond === 'monitor' ? 'monitor' : 'respond'}</${Chip}>
        ${(it.input || {}).why ? html`<span class="ov-dim">${it.input.why}</span>` : null}</div>
      <div class="st-sit" role="group" aria-label="The situation">
        <div><span class="st-lbl">What happened</span><p>${sit.what || '-'}</p></div>
        <div><span class="st-lbl">Why it matters to ${client ? client.name : 'the client'}</span><p>${sit.whyItMatters || '-'}</p>${(sit.kinds || []).length ? html`<div>${sit.kinds.map(k => html`<${Chip} key=${k}>${WORD(k)}</${Chip}> `)}</div>` : null}</div>
        <div><span class="st-lbl">Should ${client ? client.name : 'the client'} respond?</span><p><b>${sit.respond === 'no' ? 'No.' : sit.respond === 'monitor' ? 'Watch it, not yet.' : 'Yes.'}</b> ${sit.why || ''}</p>
          ${recommendsNo && !ro ? (noResp ? html`<div class="st-noresp"><${Chip} kind="bad">decided: no response</${Chip}> <span class="ov-dim">${noResp.reason}</span> <button class="ov-link" onClick=${() => onDecision('respond_anyway', '', true)}>Respond after all</button></div>` : html`<div class="st-nd-row"><button class="btn sm" disabled=${!!busy} onClick=${() => onDecision('no_response', '')}>Record: no response</button><span class="ov-dim">or choose an objective below to respond anyway</span></div>`) : null}</div>
      </div>
      ${it.intelSummary ? html`<div class="st-intel-sum"><span class="st-lbl">Creative Intelligence Summary</span><p>${it.intelSummary}</p></div>` : null}
      <details class="st-und" open=${false}><summary><span class="st-lbl">Understanding (${Object.keys(u).length} fields)</span> <span class="ov-dim">every brief field, stated in the material, inferred, or from what Axiom knows</span></summary>
        <table class="ov-table st-und-table"><tbody>${Object.keys(FIELD_WORD).filter(k => u[k]).map(k => html`<tr key=${k}><th scope="row">${FIELD_WORD[k]}</th><td>${u[k].v}</td><td><${Chip} kind=${u[k].basis === 'stated' ? 'ok' : u[k].basis === 'knowledge' ? '' : 'warn'}>${BASIS_WORD[u[k].basis] || u[k].basis}</${Chip}></td></tr>`)}</tbody></table></details>
      ${(it.topics || []).length ? html`<div class="st-topics" role="group" aria-label="Topics and issues">${[['high', 'Highly relevant to this client'], ['potential', 'Potentially relevant'], ['not', 'Not relevant']].map(([r, l]) => html`<div key=${r} class=${'st-topic-col ' + r}><span class="st-lbl">${l}</span>${topicsBy(r).length ? html`<ul class="st-ul">${topicsBy(r).map((t, i) => html`<li key=${i}><b>${t.name}</b>${t.kind !== 'topic' ? html` <span class="ov-dim">${WORD(t.kind)}</span>` : null}${t.issue ? html` <${Chip}>${t.issue}</${Chip}>` : null}<div class="ov-dim">${t.why}</div></li>`)}</ul>` : html`<div class="ov-dim">none</div>`}</div>`)}</div>` : null}
      <details class="st-cmp"><summary><span class="st-lbl">Compared with what Axiom knows</span> <span class="ov-dim">${[cmp.narrative && cmp.narrative.state !== 'none' ? 'narrative ' + cmp.narrative.state + (cmp.narrative.label ? ': ' + cmp.narrative.label : '') : '', (cmp.gaps || []).length ? cmp.gaps.length + ' gap' + (cmp.gaps.length === 1 ? '' : 's') : '', (cmp.contradicts || []).length ? cmp.contradicts.length + ' contradiction' + (cmp.contradicts.length === 1 ? '' : 's') : ''].filter(Boolean).join(' / ') || 'new, known, supporting, contradicting'}</span></summary>
        <div class="st-cmp-grid">${L('New', cmp.new)}${L('Already known', cmp.known)}${L('Supports', cmp.supports)}${L('Contradicts', cmp.contradicts)}${L('Messaging gaps', cmp.gaps)}${L('Missing context', cmp.missingContext)}${L('Conflicts with current objectives', cmp.conflicts)}${L('How the brief could be better', cmp.briefImprovements)}</div>
        ${cmp.campaignAffected || cmp.alreadyCommunicated || cmp.publicDiscussion ? html`<div class="ov-dim">${[cmp.campaignAffected ? 'Campaign affected: ' + cmp.campaignAffected : '', cmp.alreadyCommunicated ? 'Already said: ' + cmp.alreadyCommunicated : '', cmp.publicDiscussion ? 'Public discussion: ' + cmp.publicDiscussion : ''].filter(Boolean).join(' / ')}</div>` : null}
        <div class="st-know"><span class="st-lbl">Knowledge retrieved, by relevance</span>${Object.keys(KNOW_WORD).map(k => ((it.knowItems || {})[k] || []).length ? html`<div key=${k}><b>${KNOW_WORD[k]}</b> ${(it.knowItems[k]).map(x => html`<span key=${x.id} class="st-know-item" title=${x.why || ''}><span class="ov-dim">${x.id}</span> ${x.label}</span>`)}</div>` : null)}<div class="ov-dim">Retrieved: ${Object.keys(it.retrieved || {}).map(k => (it.retrieved[k]) + ' ' + (KNOW_WORD[k] || (k === 'F' ? 'approved facts' : k))).join(', ')}. Cited: ${(cmp.cites || []).join(', ') || 'none'}.</div></div>
      </details>
      <div class="st-choose" role="group" aria-label="Objectives, key messages and response strategy">
        <div class="st-choose-col"><span class="st-lbl">Objectives, ranked</span>
          ${(it.objectives || []).map(o => html`<label key=${o.id} class=${'st-opt' + (obj === o.id ? ' on' : '')}><input type="radio" name="st-obj" checked=${obj === o.id} disabled=${ro} onChange=${() => { setObj(o.id); setMsg(''); }} /><span><b>${o.rank}. ${o.title}</b> <${Chip}>${WORD(o.kind)}</${Chip}>${rec.objective === o.id ? html` <${Chip} kind="ok">recommended</${Chip}>` : null}<span class="ov-dim st-opt-line">${o.why}</span></span>${!ro ? html`<button class="ov-link st-opt-x" title="Set this objective aside (recorded)" onClick=${e => { e.preventDefault(); onDecision('reject_objective', o.id); }}>set aside</button>` : null}</label>`)}</div>
        <div class="st-choose-col"><span class="st-lbl">Key messages${O ? ' for ' + O.id : ''}</span>
          ${O ? O.messages.map(m => html`<label key=${m.id} class=${'st-opt msg' + (msg === m.id ? ' on' : '')}><input type="radio" name="st-msg" checked=${msg === m.id} disabled=${ro} onChange=${() => setMsg(m.id)} /><span><b>${m.primary}</b>${m.banned ? html` <${Chip} kind="bad">uses "${m.banned}"</${Chip}>` : null}${rec.message === m.id ? html` <${Chip} kind="ok">recommended</${Chip}>` : null}
            ${m.supporting ? html`<span class="st-opt-line">${m.supporting}</span>` : null}
            <span class="st-opt-meta">${[m.proof ? 'Proof: ' + m.proof : '', (m.evidence || []).length ? 'Evidence: ' + m.evidence.join(', ') : '', m.takeaway ? 'Takeaway: ' + m.takeaway : '', m.emotion ? 'Feels: ' + m.emotion : '', m.reaction ? 'Reaction: ' + m.reaction : '', m.cta ? 'CTA: ' + m.cta : ''].filter(Boolean).join(' / ')}</span></span></label>`) : html`<div class="ov-dim">Choose an objective.</div>`}</div>
        <div class="st-choose-col"><span class="st-lbl">Response strategy</span>
          ${(it.strategies || []).map(st => html`<label key=${st.id} class=${'st-opt' + (strat === st.id ? ' on' : '') + (st.kind === 'none' ? ' none' : '')}><input type="radio" name="st-strat" checked=${strat === st.id} disabled=${ro} onChange=${() => setStrat(st.id)} /><span><b>${STRAT_WORD[st.kind] || st.kind}</b>${st.recommended ? html` <${Chip} kind="ok">Axiom recommends</${Chip}>` : null} <${Chip} kind=${st.urgency === 'critical' || st.urgency === 'high' ? 'warn' : ''}>${st.urgency}</${Chip}>
            ${st.message ? html`<span class="st-opt-line">${st.message}</span>` : null}<span class="st-opt-meta">${[st.audience ? 'For ' + st.audience : '', st.benefit ? 'Gains: ' + st.benefit : '', st.risk ? 'Risk: ' + st.risk : '', (st.platforms || []).length ? st.platforms.join(', ') : '', st.format].filter(Boolean).join(' / ')}</span></span></label>`)}</div>
      </div>
      ${!ro ? html`<div class="st-nd-row st-choose-acts"><button class="btn sm" disabled=${!!busy || !obj || chosenSel} onClick=${() => onSelect({ objective: obj, message: msg || undefined, strategy: strat || undefined })}>${chosenSel ? 'These choices are in the brief' : 'Use these choices in the brief'}</button>
        ${rec.objective ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => { setObj(rec.objective); setMsg(rec.message || ''); setStrat(rec.strategy || ''); onSelect({ objective: rec.objective, message: rec.message || undefined, strategy: rec.strategy || undefined }); }}>Accept Axiom's recommendation</button>` : null}
        <span class="ov-dim">The brief's objective, message and call to action follow the choice; every choice is recorded for the engine to learn from.</span></div>` : null}
      ${rec.why ? html`<div class="st-rec"><span class="st-lbl">Axiom recommendation</span> ${[(it.strategies || []).find(x => x.id === rec.strategy), (it.objectives || []).find(x => x.id === rec.objective)].filter(Boolean).map(x => x.title || STRAT_WORD[x.kind]).join(' to ')}${rec.direction && dirs[rec.direction - 1] ? ', through "' + dirs[rec.direction - 1].name + '"' : ''}: <span>${rec.why}</span></div>` : null}
      ${dirs.length ? html`<div class="st-an-sec"><h3>Creative directions</h3><div class="st-an-narrs">${dirs.map(d => html`<div key=${d.directionId} class=${'st-an-narr' + (d.row.chosen ? ' chosen' : '') + (pick.indexOf(d.directionId) >= 0 ? ' picked' : '')}>
          <div class="st-an-narr-h"><b>${d.name}</b> <${Chip} kind=${d.route === 'finished' ? 'warn' : 'ok'}>${d.route === 'finished' ? 'Gemini finished' : 'editable layout'}</${Chip}>${d.approach ? html` <${Chip}>${WORD(d.approach)}</${Chip}>` : null}${d.medium ? html` <${Chip}>${d.medium}</${Chip}>` : null}${d.format ? html` <${Chip}>${WORD(d.format)}</${Chip}>` : null}${rec.direction === d.n ? html` <${Chip} kind="ok">recommended</${Chip}>` : null}</div>
          <div>${d.core}</div>${d.relevance ? html`<div class="ov-dim">${d.relevance}</div>` : null}
          ${d.hook ? html`<div><span class="st-lbl">Hook</span> ${d.hook}</div>` : null}
          ${(d.headlines || []).length ? html`<div><span class="st-lbl">Headlines</span><ol class="st-ul">${d.headlines.map((h, i) => html`<li key=${i}>${h}${(d.bannedHeadlines || []).length && d.bannedHeadlines[i] ? html` <${Chip} kind="bad">uses "${d.bannedHeadlines[i]}"</${Chip}>` : null}</li>`)}</ol></div>` : null}
          <div class="st-opt-meta">${[d.audience ? 'For ' + d.audience : '', d.response ? 'Wants: ' + d.response : '', (d.platforms || []).length ? d.platforms.join(', ') : '', (d.risks || []).length ? 'Risk: ' + d.risks.join('; ') : '', (d.evidence || []).length ? 'Evidence: ' + d.evidence.join(', ') : '', [d.objective, d.message, d.strategy].filter(Boolean).join(' / ')].filter(Boolean).join(' | ')}</div>
          <button class="ov-link" aria-expanded=${!!open[d.directionId]} onClick=${() => setOpen(Object.assign({}, open, { [d.directionId]: !open[d.directionId] }))}>${open[d.directionId] ? 'Hide' : 'Show'} the visual narrative</button>
          ${open[d.directionId] ? html`<dl class="st-vis">${Object.keys(VIS_WORD).filter(k => (d.visual || {})[k]).map(k => html`<div key=${k}><dt>${VIS_WORD[k]}</dt><dd>${d.visual[k]}</dd></div>`)}${(d.captions || []).length ? html`<div><dt>Captions</dt><dd>${d.captions.join(' / ')}</dd></div>` : null}${d.routeWhy ? html`<div><dt>Why ${d.route}</dt><dd>${d.routeWhy}</dd></div>` : null}</dl>` : null}
          ${!ro ? html`<div class="st-nd-row"><label class="st-check"><input type="checkbox" checked=${pick.indexOf(d.directionId) >= 0} onChange=${() => toggle(d.directionId)} /> compare</label>${!d.row.chosen ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => onChoose(d.directionId)}>${d.route === 'finished' ? 'Produce as a finished creative' : 'Produce as an editable layout'}</button>` : html`<${Chip} kind="ok">chosen</${Chip}>`}<button class="ov-link" onClick=${() => onDecision('reject_direction', String(d.n))}>set aside</button></div>` : null}
        </div>`)}</div>
        ${picked.length >= 2 ? html`<div class="st-compare" role="region" aria-label="Directions compared"><table class="ov-table"><thead><tr><th></th>${picked.map(d => html`<th key=${d.directionId}>${d.name}</th>`)}</tr></thead><tbody>
          ${[['Approach', d => WORD(d.approach)], ['Objective', d => { const o = (it.objectives || []).find(x => x.id === d.objective); return o ? o.title : '-'; }], ['Key message', d => { const m = [].concat(...(it.objectives || []).map(o => o.messages)).find(x => x.id === d.message); return m ? m.primary : '-'; }], ['Hook', d => d.hook], ['First headline', d => (d.headlines || [])[0]], ['Format', d => WORD(d.format)], ['Route', d => d.route === 'finished' ? 'Gemini finished' : 'editable layout'], ['Platforms', d => (d.platforms || []).join(', ')], ['Risks', d => (d.risks || []).join('; ')]].map(([l, f]) => html`<tr key=${l}><th scope="row">${l}</th>${picked.map(d => html`<td key=${d.directionId}>${f(d) || '-'}</td>`)}</tr>`)}
        </tbody></table>
        ${!ro ? html`<div class="st-nd-row"><button class="btn sm" disabled=${!!busy} onClick=${() => onVariants(picked.map(d => d.directionId))}>Produce ${picked.length} as variants</button><span class="ov-dim">One production per direction, each in its own family on the Board, each by its own route; ${picked.length} model call${picked.length === 1 ? '' : 's'}${picked.some(d => d.route === 'finished' || d.medium !== 'typographic') ? ' plus renders unless the brief says after the copy' : ''}.</span></div>` : null}</div>` : null}
        ${!ro ? html`<div class="st-kitpick" role="group" aria-label="Message kit"><span class="st-lbl">Message kit</span> <span class="ov-dim">talking points, statements, scripts, emails, ad wording - written from ${picked.length === 1 ? '"' + picked[0].name + '"' : 'the direction you tick (or the chosen one)'}</span>
          <div class="st-seg">${Object.keys(KIT_KINDS).map(k => html`<button key=${k} class=${'st-segbtn' + (kitKinds.indexOf(k) >= 0 ? ' on' : '')} aria-pressed=${kitKinds.indexOf(k) >= 0} onClick=${() => setKitKinds(kitKinds.indexOf(k) >= 0 ? kitKinds.filter(x => x !== k) : kitKinds.concat([k]))}>${KIT_KINDS[k]}</button>`)}</div>
          <div class="st-nd-row"><button class="btn sm ghost" disabled=${!!busy || !kitKinds.length || !(picked.length === 1 || dirs.some(d => d.row.chosen))} onClick=${() => onKit((picked.length === 1 ? picked[0] : dirs.find(d => d.row.chosen)).directionId, kitKinds)}>Write the message kit (1 model call)</button></div></div>` : null}
      </div>` : null}
      ${(it.filtered || []).length ? html`<div class="st-ignored"><span class="st-lbl">Information ignored</span><ul class="st-ul">${it.filtered.slice(0, 6).map(x => html`<li key=${x.p}><span class="ov-dim">${x.p}</span> ${x.text} <${Chip}>${WORD(x.class)}</${Chip}> <span class="ov-dim">${x.why}</span></li>`)}</ul>${it.filtered.length > 6 ? html`<div class="ov-dim">and ${it.filtered.length - 6} more in the table below</div>` : null}</div>` : null}
    </div>`;
  }
  const KIT_KINDS = { talking_points: 'Talking points', media_response: 'Media response', statement: 'Statement', video_script: 'Video script', voiceover: 'Voiceover', email: 'Email', landing_page: 'Landing page', google_ads: 'Google ads', carousel: 'Carousel slides', quote_cards: 'Quote cards', linkedin: 'LinkedIn', meta: 'Facebook / Instagram', x: 'X', tiktok: 'TikTok', long_caption: 'Long caption', short_caption: 'Short caption', hooks: 'Hooks', onscreen: 'On-screen text' };
  /** The message kit: the words that are not tiles, each traced and checked, edited in place, approved or rejected with a reason. */
  function KitView({ p, busy, onWrite, onUpdate, onVerdict }) {
    const texts = p.texts || []; const ro = !canWrite() || p.readOnly; const [edit, setEdit] = useState({});
    const chosen = p.directions.find(d => d.chosen);
    return html`<div class="st-kit">
      ${!texts.length ? html`<div class="ov-empty">No message kit yet. ${chosen ? 'Write one from "' + chosen.title + '" on the Brief, under Creative directions.' : 'Choose a direction first; the kit is written from it.'}</div>` : null}
      ${texts.map(t => html`<article key=${t.id} class=${'st-kit-item ' + t.status} aria-label=${t.label}>
        <div class="st-kit-head"><h3>${t.label}</h3><span class="ov-dim">${t.title !== t.label ? t.title : ''}</span><${Chip} kind=${t.status === 'approved' ? 'ok' : t.status === 'rejected' ? 'bad' : ''}>${t.status}</${Chip}>${(t.checks || []).map((c, i) => html`<${Chip} key=${i} kind="warn" title=${c.text}>${c.state}</${Chip}>`)}</div>
        ${edit[t.id] != null ? html`<textarea class="st-ta" rows="8" value=${edit[t.id]} aria-label=${'Edit ' + t.label} onInput=${e => setEdit(Object.assign({}, edit, { [t.id]: e.target.value }))}></textarea><div class="st-nd-row"><button class="btn sm" disabled=${!!busy} onClick=${async () => { if (await onUpdate(t, edit[t.id])) { const n = Object.assign({}, edit); delete n[t.id]; setEdit(n); } }}>Save</button><button class="btn sm ghost" onClick=${() => { const n = Object.assign({}, edit); delete n[t.id]; setEdit(n); }}>Cancel</button></div>`
          : html`<pre class="st-kit-body">${t.body}</pre>`}
        ${(t.checks || []).length ? html`<ul class="st-ul">${t.checks.map((c, i) => html`<li key=${i} class="ov-dim">${c.text}</li>`)}</ul>` : null}
        <${TraceLine} tr=${t.trace || {}} p=${p} />
        ${!ro && edit[t.id] == null ? html`<div class="st-nd-row"><button class="btn sm ghost" onClick=${() => setEdit(Object.assign({}, edit, { [t.id]: t.body }))}>Edit</button><button class="btn sm ghost" onClick=${() => navigator.clipboard && navigator.clipboard.writeText(t.body)}>Copy</button><button class="btn sm" disabled=${!!busy || t.status === 'approved'} onClick=${() => onVerdict(t, 'approve')}>Approve</button><button class="btn sm ghost" disabled=${!!busy || t.status === 'rejected'} onClick=${() => onVerdict(t, 'reject')}>Reject</button></div>` : null}
      </article>`)}
    </div>`;
  }
  /** What the analysis found, in the order a strategist reads it, ending with the next step. */
  function AnalysisPanel({ p, a, kit, ro, busy, onCampaign, onGo, onDirect, onProduce, onChoose, onAgain, client, onSelect, onDecision, onVariants, onKit }) {
    const it = p.intel && p.intel.id === a.intel ? p.intel : null;
    const [showSet, setShowSet] = useState(false);
    const camps = (kit && kit.campaigns) || []; const c = a.campaign || {};
    const dirs = (a.directions || []).map(id => p.directions.find(d => d.id === id)).filter(Boolean);
    const nextLabel = a.next.stage === 'copy' ? 'Write the copy' : a.next.stage === 'directions' ? 'Choose a visual narrative' : a.next.stage === 'decide' ? 'Decide whether to respond' : 'Complete the brief';
    const cl = a.claims || []; const nOk = cl.filter(x => x.status === 'matches_fact').length, nBad = cl.filter(x => x.status === 'conflicts_fact').length, nNew = cl.filter(x => x.status === 'new_unverified').length;
    return html`<section class="st-field st-analysis" aria-label="Brief analysis">
      <div class="st-field-head"><${Lbl}>Brief analysis</${Lbl}><span class="ov-dim">${a.sourceName} - ${(ANALYSE_KINDS.find(x => x[0] === a.kind) || [0, a.kind])[1]}, ${a.paragraphs} paragraphs, ${a.model || ''}</span>${!ro && onAgain ? html`<button class="ov-link" onClick=${onAgain}>Analyse something else</button>` : null}</div>
      ${a.summary ? html`<p class="st-an-sum">${a.summary}</p>` : null}
      <div class="st-an-strip" role="list">
        <span role="listitem"><b>${a.relevant.length}</b> kept</span><span role="listitem"><b>${a.filtered.length}</b> set aside</span>${(a.unplaced || []).length ? html`<span role="listitem"><b>${a.unplaced.length}</b> not placed</span>` : null}
        <span role="listitem"><b>${nOk}</b> claims match facts</span>${nBad ? html`<span role="listitem" class="bad"><b>${nBad}</b> conflict</span>` : null}<span role="listitem"><b>${nNew}</b> unverified</span>
        <span role="listitem"><b>${(a.knowledge || []).length}</b> of ${a.retrieved} knowledge passages used</span>
      </div>
      <div class="st-an-next" role="status"><div><b>Next: ${nextLabel}.</b> <span>${a.next.why}</span></div>
        ${!ro ? html`<div class="st-nd-row">${a.next.stage === 'copy' ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => onProduce()}>Write the copy</button>` : a.next.stage === 'directions' && dirs.length ? html`<button class="btn sm" onClick=${() => onGo('directions')}>See the ${dirs.length} narratives</button>` : html`<a class="btn sm ghost" href="#st-brief-fields" onClick=${e => { e.preventDefault(); const el = document.getElementById('st-brief-fields'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>Complete the brief</a>`}
          ${a.next.stage !== 'directions' && dirs.length ? html`<button class="btn sm ghost" onClick=${() => onGo('directions')}>Narratives (${dirs.length})</button>` : null}
          ${a.next.stage !== 'copy' ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => onProduce()}>Write the copy now</button>` : null}</div>` : null}
      </div>
      ${it ? html`<${IntelSections} p=${p} it=${it} ro=${ro} busy=${busy} client=${client} onSelect=${onSelect} onDecision=${onDecision} onChoose=${onChoose} onVariants=${onVariants} onKit=${onKit} onGo=${onGo} />` : null}
      <div class="st-an-grid">
        <div class="st-an-card"><h3>Campaign</h3>
          ${c.id ? html`<div><b>${c.name}</b> <${Chip} kind=${c.confidence >= 0.7 ? 'ok' : 'warn'}>${Math.round(c.confidence * 100)}% match</${Chip}></div><div class="ov-dim">${c.why}</div>
            ${p.campaign === c.id ? html`<div><${Chip} kind="ok">the project's campaign</${Chip}></div>` : !ro ? html`<button class="btn sm" onClick=${() => onCampaign(c.id)}>Use ${c.name}</button>${p.campaign ? html` <span class="ov-dim">now: ${(camps.find(x => x.id === p.campaign) || {}).name || p.campaign}</span>` : null}` : null}`
          : html`<div class="ov-dim">No campaign of ${camps.length} matched${c.why ? ': ' + c.why : '.'}</div>`}
        </div>
        <div class="st-an-card"><h3>Proposed brief</h3>
          ${['objective', 'audience', 'message', 'action'].map(k => a.brief[k] ? html`<div key=${k} class="st-an-bf"><span class="st-lbl">${k}</span> ${a.brief[k]}${(p.brief || {})[k] === a.brief[k] ? html` <${Chip}>in the brief</${Chip}>` : null}</div>` : null)}
          ${a.brief.channels && a.brief.channels.length ? html`<div class="st-an-bf"><span class="st-lbl">channels</span> ${a.brief.channels.map(chanLabel).join(', ')}</div>` : null}
          <div class="ov-dim">Empty fields took the proposal, marked as the Studio's; a field the team wrote is never replaced.</div>
        </div>
      </div>
      ${(a.angles || []).length ? html`<div class="st-an-sec"><h3>Copy angles</h3><ol class="st-an-angles">${a.angles.map((x, i) => html`<li key=${i}><b>${x.headline}</b>${x.banned ? html` <${Chip} kind="bad">uses "${x.banned}"</${Chip}>` : null}<div>${x.line}</div><div class="ov-dim">${x.why}</div></li>`)}</ol></div>` : null}
      ${dirs.length && !it ? html`<div class="st-an-sec"><h3>Visual narratives</h3><div class="st-an-narrs">${dirs.map((d, i) => html`<div key=${d.id} class=${'st-an-narr' + (d.chosen ? ' chosen' : '')}><div class="st-an-narr-h"><b>${d.title}</b> <${Chip} kind=${d.route === 'finished' ? 'warn' : 'ok'}>${d.route === 'finished' ? 'Gemini finished' : 'editable layout'}</${Chip}>${d.medium ? html` <${Chip}>${d.medium}</${Chip}>` : null}</div><div>${d.idea}</div><div class="ov-dim">${d.visual}</div><div class="ov-dim">${d.rationale}</div>
        ${!ro && !d.chosen ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => onChoose(d.id)}>${d.route === 'finished' ? 'Produce as a finished creative' : 'Produce as an editable layout'}</button>` : d.chosen ? html`<${Chip} kind="ok">chosen</${Chip}>` : null}</div>`)}</div></div>` : null}
      ${cl.length ? html`<div class="st-an-sec"><h3>Claims against the approved facts</h3><ul class="st-ul">${cl.map((x, i) => { const w = CLAIM_WORD[x.status] || ['', x.status]; return html`<li key=${i}><${Chip} kind=${w[0]}>${w[1]}</${Chip}> ${x.text}${x.p ? html` <span class="ov-dim">(${x.p}${x.fact ? ', ' + x.fact : ''})</span>` : null}${x.factText ? html`<div class="ov-dim">fact: ${x.factText}</div>` : null}</li>`; })}</ul></div>` : null}
      ${(a.knowledge || []).length ? html`<div class="st-an-sec"><h3>Knowledge used</h3><ul class="st-ul">${a.knowledge.map(k => html`<li key=${k.k}><b>${k.title}</b> <span class="ov-dim">${k.kind || ''}${k.ns ? ', ' + k.ns : ''}</span> - ${k.use}</li>`)}</ul></div>` : null}
      ${(a.risks || []).length || (a.gaps || []).length ? html`<div class="st-an-grid">${(a.risks || []).length ? html`<div class="st-an-card"><h3>Risks</h3><ul class="st-ul">${a.risks.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null}${(a.gaps || []).length ? html`<div class="st-an-card"><h3>Gaps</h3><ul class="st-ul">${a.gaps.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null}</div>` : null}
      <div class="st-an-sec"><button class="st-tools-toggle" aria-expanded=${showSet} onClick=${() => setShowSet(!showSet)}><span class="st-lbl">What was kept and what was set aside (${a.relevant.length} / ${a.filtered.length})</span><span aria-hidden="true">${showSet ? '−' : '+'}</span></button>
        ${showSet ? html`<table class="ov-table st-an-paras"><thead><tr><th>Paragraph</th><th>Read as</th><th>Why</th></tr></thead><tbody>
          ${a.relevant.map(x => html`<tr key=${'k' + x.p} class="kept"><td><span class="ov-dim">${x.p}</span> ${x.text}</td><td><${Chip} kind="ok">kept</${Chip}></td><td>${x.why}</td></tr>`)}
          ${a.filtered.map(x => html`<tr key=${'f' + x.p} class="aside"><td><span class="ov-dim">${x.p}</span> ${x.text}</td><td><${Chip}>set aside</${Chip}></td><td>${x.why}</td></tr>`)}
          ${(a.unplaced || []).map(id => html`<tr key=${'u' + id}><td><span class="ov-dim">${id}</span></td><td><${Chip} kind="warn">not placed</${Chip}></td><td class="ov-dim">the model did not say; treated as set aside</td></tr>`)}
        </tbody></table><div class="ov-dim">Only the kept paragraphs reach the copy and the directions; the ledger holds ${(a.ledger || {}).claims != null ? a.ledger.claims + ' entr' + (a.ledger.claims === 1 ? 'y' : 'ies') + ' (figures and quotations) from them' : 'what they carry'}.</div>` : null}
      </div>
    </section>`;
  }
  function BriefView({ p, onSave, onDirect, onProduce, onCampaign, onStrategy, busy, head, prov, onGo, onAnalyse, onChoose, kit, client, onSelect, onDecision, onVariants, onKit }) {
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
    const [anOpen, setAnOpen] = useState(false);
    // the box opens by itself only on an empty brief; a brief already written shows it as one line
    const anAuto = !String((p.brief || {}).objective || '').trim() && !(p.sources || []).length;
    const produceArgs = () => ({ acknowledge: !!(blocking.length && ack), size: imagery === 'none' ? undefined : imagery, imagery: imagery === 'none' ? 'none' : undefined });
    return html`<div class="st-centre-pad st-brief">
      <${StageHead} ...${head}>
        ${!ro && dirty ? html`<span class="st-dirty" role="status">Unsaved changes</span><button class="btn sm" disabled=${saving} onClick=${() => save()}>${saving ? 'Saving...' : 'Save brief'}</button>` : !ro ? html`<span class="ov-dim" role="status">Brief saved</span>` : null}
        ${p.assets.length && onGo ? html`<button class="btn sm ghost" onClick=${() => onGo('copy')}>Continue to Copy</button>` : null}
      </${StageHead}>
      ${restored ? html`<div class="st-notice info" role="status"><div class="st-notice-body"><b>Unsaved brief edits restored.</b> <span>These edits were made in this browser and never saved. Save them, or discard them to see the brief as saved.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save()}>Save them</button><button class="btn sm ghost" onClick=${discard}>Discard</button></div></div>` : null}
      ${elsewhere && !clash ? html`<div class="st-notice warn" role="status"><div class="st-notice-body"><b>The brief changed elsewhere.</b> <span>A job or a teammate saved a newer brief while you were editing. Your edits are kept here; saving merges them field by field.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save()}>Save and merge</button><button class="btn sm ghost" onClick=${discard}>Use the saved brief</button></div></div>` : null}
      ${clash ? html`<div class="st-notice warn" role="alert"><div class="st-notice-body"><b>Both versions changed the same field${clash.clash.length === 1 ? '' : 's'}: ${clash.clash.join(', ')}.</b> <span>Nothing was overwritten. Keep yours to save over the newer version, or take theirs for ${clash.clash.length === 1 ? 'that field' : 'those fields'} and keep the rest of your edits.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => save(clash.merged, true)}>Keep mine</button><button class="btn sm ghost" onClick=${() => { const next = Object.assign({}, clash.merged); clash.clash.forEach(k => { next[k] = clash.theirs[k]; }); baseRef.current = clash.theirs; setB(next); setClash(null); }}>Take theirs</button></div></div>` : null}
      ${(p.brief || {}).analysis && !anOpen ? html`<${AnalysisPanel} p=${p} a=${p.brief.analysis} kit=${kit} ro=${ro} busy=${busy} client=${client} onSelect=${onSelect} onDecision=${onDecision} onVariants=${onVariants} onKit=${onKit} onCampaign=${onCampaign} onGo=${onGo} onDirect=${onDirect} onChoose=${onChoose} onProduce=${() => go(() => onProduce(produceArgs()))} onAgain=${() => setAnOpen(true)} />` : null}
      ${!ro && onAnalyse && client && (anOpen || (!(p.brief || {}).analysis && anAuto)) ? html`<${AnalyseBox} client=${client} busy=${busy} onAnalyse=${o => { setAnOpen(false); go(() => onAnalyse(o)); }} onClose=${(p.brief || {}).analysis || !anAuto ? () => setAnOpen(false) : null} />`
        : !ro && onAnalyse && client && !(p.brief || {}).analysis ? html`<div class="st-analyse-open"><button class="btn sm ghost" onClick=${() => setAnOpen(true)}>Analyse a brief, article or upload against ${client.name}</button><span class="ov-dim">one model call; what concerns the client is kept, the rest set aside</span></div>` : null}
      ${!ro && !p.assets.length ? html`<div class="st-produce st-actionbar" aria-label="Write the copy">
        <div class="st-actionbar-text"><b>${chosen ? 'Write the copy from "' + chosen.title + '"' : 'When the brief is ready'}</b><span class="ov-dim">${chosen ? 'The chosen direction decides the idea; the brief decides channels and claims.' : 'A clear, approved brief can go straight to the copy; an open one is better explored as directions first.'} ${chans ? 'Channels: ' + chans + '.' : 'No channels set.'}</span></div>
        ${imagery !== 'none' && b.deliverable !== 'copy' ? html`<div class="st-seg st-timing" role="group" aria-label="When the imagery is made"><span class="ov-dim">Imagery</span><button class=${'st-segbtn' + (b.imageryTiming !== 'after_copy' ? ' on' : '')} aria-pressed=${b.imageryTiming !== 'after_copy'} title="The renders are queued as soon as the copy is written" onClick=${() => setB(Object.assign({}, b, { imageryTiming: 'with_copy' }))}>With the copy</button><button class=${'st-segbtn' + (b.imageryTiming === 'after_copy' ? ' on' : '')} aria-pressed=${b.imageryTiming === 'after_copy'} title="The copy and layouts are made first; the imagery is generated in Design once the words are ready (no render is spent on words that change)" onClick=${() => setB(Object.assign({}, b, { imageryTiming: 'after_copy' }))}>After the copy is ready</button></div>` : null}
        <label class="ov-dim st-size">Imagery <select class="st-sel" value=${imagery} onChange=${e => { setImagery(e.target.value); setB(Object.assign({}, b, e.target.value === 'none' ? { imagery: 'none' } : { size: e.target.value, imagery: '' })); }} aria-label="Imagery resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option><option value="none">No imagery (type and colour)</option></select></label>
        ${blocking.length ? html`<label class="st-check"><input type="checkbox" checked=${ack} onChange=${e => setAck(e.target.checked)} /> Proceed on the stated assumptions despite ${blocking.length} mandatory gap${blocking.length === 1 ? '' : 's'}</label>` : null}
        <div class="st-actionbar-acts">
          <button class=${'btn sm' + (chosen ? '' : ' ghost')} disabled=${!!busy || noClaude || !(b.channels || []).length || (blocking.length && !ack)} title=${noClaude ? 'Claude is not configured on the worker' : !(b.channels || []).length ? 'Choose channels first' : blocking.length && !ack ? 'Resolve the mandatory gaps, or tick to proceed on the assumptions' : ''} onClick=${() => go(() => onProduce(produceArgs()))}>Write the copy</button>
          ${!chosen ? html`<button class="btn sm" disabled=${!!busy || noClaude} title=${noClaude ? 'Claude is not configured on the worker' : ''} onClick=${() => go(() => onDirect())}>Explore directions first</button>` : null}
        </div>
        <div class="ov-dim st-actionbar-foot">${imagery === 'none' ? 'No image will be generated: every asset is a complete typographic composition (type, shapes, colour and the mark).' : b.imageryTiming === 'after_copy' ? 'No render is spent yet: the copy and layouts are made now, and the imagery (at ' + imagery + ') is generated in Design once the words are ready.' : 'Renders are queued at ' + imagery + ' after the copy is written; each is a job you can watch, retry or cancel.'} ${noClaude ? 'Claude is not configured on the worker, so nothing can be written yet.' : ''}</div>
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
      <span id="st-brief-fields" class="st-anchor"></span>
      ${['objective', 'audience', 'message', 'action', 'deliverables'].map(k => html`<div key=${k} class="st-field"><${Lbl}>${k}${(b.proposed || []).indexOf(k) >= 0 ? html` <${Chip} kind="warn">proposed by the Studio</${Chip}>` : null}${b[k + 'Source'] && b[k + 'Source'] !== 'team' ? html` <${Chip} kind=${SRC_KIND[b[k + 'Source']]}>${SRC_WORD[b[k + 'Source']]}</${Chip}>` : null}</${Lbl}><${Combo} id=${'brief-' + k} label=${'Brief ' + k} value=${b[k] || ''} items=${fields[k] || []} disabled=${ro} onChange=${(v, src) => set(k, v, src)} placeholder=${k === 'action' ? 'What the audience should do' : ''} /></div>`)}
      <div class="st-field st-reqs"><${Lbl}>Design requirements</${Lbl}><div class="ov-dim">Mandatory items are constraints on every concept; preferred ones are followed unless the message needs otherwise; open ones are the Creative Director's call. Each says where it came from.</div>
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
  /* ------------------------------------------------------------ Copy: get the words right before the design is built (S13) */
  const COPY_FIELDS = [['headline', 'Headline', 'The one thing they should remember'], ['support', 'Supporting line', 'Context, without repeating the headline'], ['cta', 'Call to action', 'One clear next step'], ['caption', 'Post caption', 'The words that go with the creative on the platform'], ['alt', 'Alt text', 'What the creative shows, for people using a screen reader']];
  const COPY_BAD = { differs: 1, unsupported: 1, banned: 1, over_limit: 1, too_many_hashtags: 1, exclamation: 1 };
  const FORMAT_WORD = { '1:1': 'square creative', '4:5': 'portrait creative', '9:16': 'vertical creative', '16:9': 'landscape creative' };
  /** One channel's words at a time, beside the list of the set and a copy partner. "Ready for design" is the agency's copy
   *  approval of exactly this version (reason "copy ready"); an edit to the words makes a new version and the mark falls away. */
  function CopyStage({ p, a, head, activity, banner, prov, busy, onSel, onEdit, onReady, onDirect, onPick, onWrite, onGo, onDraftState }) {
    const ro = !canWrite() || p.readOnly; const noClaude = prov && prov.claude === false;
    const sel = (a && p.assets.indexOf(a) >= 0 ? a : null) || p.assets[0] || null;
    const [draft, setDraft] = useState({}); const [ask, setAsk] = useState(''); const [asking, setAsking] = useState(false); const [askFail, setAskFail] = useState('');
    const key = (x, k) => x.id + ':' + k;
    const vOf = x => current(x) || {};
    const val = (x, k) => draft[key(x, k)] != null ? draft[key(x, k)] : (vOf(x).copy || {})[k] || '';
    const dirtyOf = x => COPY_FIELDS.some(([k]) => draft[key(x, k)] != null && draft[key(x, k)] !== ((vOf(x).copy || {})[k] || ''));
    useEffect(() => { if (onDraftState) onDraftState('copystage', Object.keys(draft).length > 0); }, [Object.keys(draft).length]);
    useEffect(() => () => { if (onDraftState) onDraftState('copystage', false); }, []);
    const save = (x, k) => { const d = draft[key(x, k)]; if (d == null) return; if (d !== ((vOf(x).copy || {})[k] || '')) onEdit(x, { [k]: d }); setDraft(o => { const y = Object.assign({}, o); delete y[key(x, k)]; return y; }); };
    const byChannel = useMemo(() => { const m = {}; p.assets.forEach(x => { (m[x.channel] = m[x.channel] || []).push(x); }); return m; }, [p.assets]);
    const flagsOf = x => (vOf(x).checks || []).filter(c => COPY_BAD[c.state]);
    const ready = x => !!standing(x, 'copy');
    const n = p.assets.length, nReady = p.assets.filter(ready).length;
    const staleIds = new Set((((p.workflow || {}).steps || {}).copy || {}).stale || []);
    const b = p.brief || {}; const afterCopy = b.imageryTiming === 'after_copy';
    if (!n) return html`<div class="st-centre-pad st-copystage"><${StageHead} ...${head}>${!ro ? html`<button class="btn sm" disabled=${!!busy || noClaude || !(b.channels || []).length} title=${noClaude ? 'Claude is not configured on the worker' : !(b.channels || []).length ? 'Choose at least one channel in the brief first' : 'One model call for the words and plans, then one composition per channel'} onClick=${onWrite}>Write the copy</button>` : null}</${StageHead}>${activity}
      <div class="st-empty-state"><b>Get the words right first.</b><span>${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction, or write the copy straight from the brief.' : 'Writing the copy is one model call: one piece per channel in the brief (' + ((b.channels || []).map(chanLabel).join(', ') || 'none chosen yet') + '), each laid out as an editable composition. ' + (b.deliverable === 'copy' ? 'This project is copy only.' : afterCopy ? 'The imagery waits for Design, as the brief says.' : 'The imagery is queued with it, as the brief says; set "Imagery: after the copy" in the brief to hold it.')}</span>${!ro && p.directions.length && !p.directions.some(d => d.chosen) ? html`<button class="btn sm ghost" onClick=${() => onGo('directions')}>Go to Direction</button>` : null}</div></div>`;
    const v = vOf(sel); const flags = flagsOf(sel); const dirty = dirtyOf(sel); const isReady = ready(sel);
    const finished = v.mode === 'finished'; const max = (CHANNELS[sel.channel] || {}).max || 900;
    const alts = p.thread.filter(e => e.kind === 'alternatives' && e.asset === sel.id && e.options).slice(-1)[0];
    const toggle = () => { if (dirty) return; if (!isReady && flags.length && !window.confirm(flags.length + ' check' + (flags.length === 1 ? '' : 's') + ' on these words still to look at (' + flags.map(c => CHECK_WORD[c.state] || c.state).join(', ') + '). Mark them ready for design anyway?')) return; onReady(sel, !isReady); };
    const quick = [['Shorter headline', 'Write a shorter headline for this piece: same claim, fewer words. Offer it as alternatives.'], ['Plainer words', 'Make the words plainer: shorter sentences, no jargon, the same claims and figures.'], ['Three headline options', 'Offer three different headlines for this piece as alternatives; keep every figure as it is.']];
    return html`<div class="st-centre-pad st-copystage">
      <${StageHead} ...${head}><span class="st-copy-count" role="status">${nReady} of ${n} ready for design</span>${nReady ? html`<button class=${'btn sm' + (nReady === n ? '' : ' ghost')} onClick=${() => onGo('design')}>Continue to Design</button>` : null}</${StageHead}>${activity}${banner || null}
      <div class="st-copy3">
        <nav class="st-copy-list" aria-label="The copy set">${Object.keys(byChannel).map(c => html`<div key=${c} class="st-copy-chan" role="group" aria-label=${chanLabel(c)}><div class="st-famname">${chanLabel(c)}</div>${byChannel[c].map(x => { const f = flagsOf(x).length; const on = x.id === sel.id; return html`<button key=${x.id} class=${'st-copy-pick' + (on ? ' on' : '')} aria-current=${on ? 'true' : undefined} onClick=${() => onSel(x.id)}>
          <span class="st-copy-pick-ic"><${Icon} n=${FORMAT_ICON[x.format] || 'file'} size=${15} /></span><span class="st-copy-pick-t">${x.title}<small>${FORMAT_WORD[x.format] || x.format}${(vOf(x).mode === 'copy') ? ', copy only' : ''}${staleIds.has(x.id) ? html`<span class="st-mini-chip warn" title="Written on an earlier objective, message or strategy">earlier choice</span>` : null}</small></span>
          <span class=${'st-copy-state' + (ready(x) ? ' ok' : f ? ' warn' : '')}>${ready(x) ? 'Ready' : f ? f + ' to check' : 'Draft'}</span></button>`; })}</div>`)}</nav>
        <section class="st-copy-edit" aria-label=${'Copy for ' + sel.title}>
          <div class="st-copy-title"><h3>${chanLabel(sel.channel)} copy <span class="ov-dim">${sel.title}, v${vnum(sel, v)}${v.note ? ' - ' + v.note : ''}</span></h3><span class=${'st-copy-badge' + (isReady ? ' ok' : '')} role="status">${isReady ? 'Ready for design' : dirty ? 'Unsaved words' : 'Working draft'}</span></div>
          ${v.context && v.context.trace ? html`<${TraceLine} tr=${v.context.trace} p=${p} />` : null}
          ${finished ? html`<div class="st-flatnote" role="note">Finished creative: these words will be painted into the image. Settle them here first; changing them after the image is made means generating it again.</div>` : null}
          ${COPY_FIELDS.map(([k, l, help]) => { const t = val(sel, k); const locked = !!(sel.locks || {})[k]; const lim = k === 'caption' ? max : 0; return html`<div key=${k} class="st-copy-field">
            <div class="st-copy-flabel"><label for=${'st-cf-' + k}>${l}${locked ? html` <${Chip}>locked</${Chip}>` : null}</label><span class=${'ov-dim' + (lim && t.length > lim ? ' st-over' : '')}>${t.length}${lim ? ' of ' + lim : ''} characters</span></div>
            <textarea id=${'st-cf-' + k} class=${'st-ta' + (k === 'headline' ? ' st-copy-hl' : '')} rows=${k === 'caption' ? 4 : k === 'headline' ? 3 : 2} disabled=${ro || locked} value=${t} onInput=${e => setDraft(Object.assign({}, draft, { [key(sel, k)]: e.target.value }))} onBlur=${() => save(sel, k)}></textarea>
            <small class="ov-dim">${help}</small></div>`; })}
          <div class="st-copy-checks" aria-label="Checks on these words">${flags.length ? flags.map((c, i) => html`<div key=${i}><${Chip} kind=${CHECK_KIND[c.state] || 'warn'}>${CHECK_WORD[c.state] || c.state}</${Chip}> <span class="ov-dim">${c.text}</span></div>`) : html`<span><${Chip} kind="ok">checks clean</${Chip}> <span class="ov-dim">every figure traced to the facts, the brief or the source; no banned term; within the limits</span></span>`}</div>
          <label class=${'st-ready-check' + (isReady ? ' on' : '')}><input type="checkbox" checked=${isReady} disabled=${ro || dirty || !!busy} onChange=${toggle} /> <span><b>Mark this copy ready for design.</b> ${dirty ? 'Leave the field to save the words first. ' : ''}Records the agency's copy approval of version ${vnum(sel, v)}; editing the words afterwards clears it. The client's approval happens in Review.</span></label>
        </section>
        <aside class="st-copy-partner" aria-label="Copy partner">
          <div class="st-lbl">Copy partner</div>
          <p class="ov-dim">Asks about this piece only. Each ask is one model call; the answer arrives as options or a new text version, never approved for you.</p>
          ${!ro ? html`<div class="st-copy-asks">${quick.map(([l, t]) => html`<button key=${l} class="btn sm ghost" disabled=${!!busy || noClaude} title=${noClaude ? 'Claude is not configured on the worker' : '1 model call'} onClick=${() => onDirect(t, 'asset')}>${l}</button>`)}</div>
            <div class="st-copy-ask"><textarea class="st-ta" rows="2" aria-label="Ask the copy partner" placeholder="e.g. lead with the human story" value=${ask} onInput=${e => setAsk(e.target.value)}></textarea><button class="btn sm" disabled=${!ask.trim() || !!busy || noClaude || asking} onClick=${async () => { const t = ask.trim(); setAsking(true); setAskFail(''); const r = await onDirect(t, 'asset'); setAsking(false); if (r && r.accepted) setAsk(c => (c.trim() === t ? '' : c)); else setAskFail(r && r.busy ? 'Not sent: another instruction is still running. Your words are still here.' : 'Not sent: ' + explain((r && r.error) || {}, 'the worker refused it').title + '. Your words are still here.'); }}>${asking ? 'Sending...' : 'Ask'}</button></div>${askFail ? html`<div class="st-send-fail" role="alert">${askFail}</div>` : null}` : null}
          ${alts ? html`<div class="st-copy-alts"><div class="st-lbl">Options for the ${alts.field}</div>${alts.options.map((o, i) => html`<div key=${i} class="st-copy-alt"><p>${o}</p>${alts.checks && alts.checks[i] && alts.checks[i].length ? html`<${Chip} kind="warn">${alts.checks[i].join(', ')}</${Chip}>` : null}${!ro ? html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => onPick(sel.id, alts.field, o)}>Use this ${alts.field}</button>` : null}</div>`)}</div>` : null}
          <div class="st-copy-ctx"><div class="st-lbl">From the brief</div>${[['Objective', b.objective], ['Audience', b.audience], ['Message', b.message], ['Action', b.action]].filter(x => x[1]).map(([l, t]) => html`<div key=${l}><b>${l}</b> <span class="ov-dim">${t}</span></div>`)}${!b.objective && !b.message ? html`<span class="ov-dim">The brief has no objective or message yet.</span>` : null}</div>
        </aside>
      </div>
    </div>`;
  }

  function DirectionsView({ p, onChoose, onMore, busy, head, prov }) {
    const noClaude = prov && prov.claude === false;
    const choose = d => { if (p.assets.length && !window.confirm('Produce a new set from "' + d.title + '"? The ' + p.assets.length + ' asset' + (p.assets.length === 1 ? '' : 's') + ' already made stay as they are; this writes new ones (model calls, and renders unless the brief says no imagery).')) return; onChoose(d.id); };
    return html`<div class="st-centre-pad">
      <${StageHead} ...${head}>${canWrite() && !p.readOnly && !p.directions.length ? html`<button class="btn sm" disabled=${!!busy || noClaude} onClick=${() => onMore(3)}>Propose three directions</button>` : null}</${StageHead}>
      <div class="ov-why">Genuinely different directions for an open brief, three by default: each with its idea, copy approach, medium, composition, type and colour, the references it draws on and the images it would need. Diversity is measured, not claimed. Choosing one starts production from it.</div>
      ${(() => { const ev = p.thread.filter(e => e.kind === 'directions' && e.diversity != null).pop(); return ev ? html`<div class="ov-dim">Last set: diversity ${ev.diversity} (1 = nothing in common between the directions; under 0.5 they repeat each other).</div>` : null; })()}
      ${!p.directions.length ? html`<div class="ov-empty">No directions yet.</div>` : null}
      <div class="st-dirs">${p.directions.map((d, i) => html`<div key=${d.id} class=${'st-dir' + (d.chosen ? ' chosen' : '')} style=${{ '--i': i }}>
        <div class=${'st-dir-art m-' + String(d.medium || 'type').replace(/[^a-z-]/gi, '').toLowerCase()} aria-hidden="true"><span class="st-dir-art-k">${(d.medium || 'Direction ' + String.fromCharCode(65 + i)).replace('photo-', '')}</span><span class="st-dir-art-h">${d.headline || d.title}</span><span class="st-dir-art-f">${String.fromCharCode(65 + i)}</span></div>
        <div class="st-dir-title">${String.fromCharCode(65 + i)}) ${d.title}${d.chosen ? html`<${Chip} kind="ok">chosen</${Chip}>` : d.similar ? html`<${Chip} kind="warn" title=${'reads close to ' + d.similar}>close to ${d.similar}</${Chip}>` : null}</div>
        <div class="st-dir-h">${d.headline}</div>
        <div class="st-dir-line"><b>Message</b> ${d.message}</div>
        <div class="st-dir-line"><b>Insight</b> ${d.insight}</div>
        <div class="st-dir-line"><b>Opening</b> ${d.opening}</div>
        <div class="st-dir-line"><b>Visual</b> ${d.visual}</div>
        <div class="st-dir-line"><b>Why</b> ${d.rationale}</div>
        ${d.idea ? html`<div class="st-dir-line"><b>Idea</b> ${d.idea}</div>` : null}${d.copyApproach ? html`<div class="st-dir-line"><b>Copy</b> ${d.copyApproach}</div>` : null}
        ${d.medium || d.composition ? html`<div class="st-dir-line"><b>Medium</b> ${d.medium ? html`<${Chip}>${d.medium}</${Chip}> ` : null}${d.composition}${d.typography ? '; type: ' + d.typography : ''}${d.colour ? '; colour: ' + d.colour : ''}</div>` : null}
        ${d.route ? html`<div class="st-dir-line st-dir-route"><b>Route</b> <${Chip} kind=${d.route === 'finished' ? 'warn' : 'ok'}>${d.route === 'finished' ? 'Gemini finished creative' : 'editable composition'}</${Chip}> <span class="ov-dim">${d.route === 'finished' ? 'Gemini paints the whole piece, words and mark included; choosing this sets the project to Finished creative.' : 'generated imagery with the words and the exact mark as live, editable layers.'}</span>${d.fromAnalysis ? html` <${Chip}>from the brief analysis</${Chip}>` : null}</div>` : null}
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
        <${Lbl}>Approved facts (${c.facts.length}) - the only figures besides the sources</${Lbl}>${c.facts.length ? html`<ul class="st-ul">${c.facts.map(f => html`<li key=${f.id}>${f.text}${f.source ? html` <span class="ov-dim">(${f.source})</span>` : null}${f.campaign ? html` <${Chip}>${f.campaign}</${Chip}>` : null}</li>`)}</ul>` : html`<div class="ov-dim">none</div>`}${c.excludedFacts ? html`<div class="ov-dim">${c.excludedFacts} approved fact${c.excludedFacts === 1 ? '' : 's'} of other campaigns ${c.excludedFacts === 1 ? 'is' : 'are'} not offered to this campaign's models.</div>` : null}
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
    const [inv, setInv] = useState(undefined); const [teach, setTeach] = useState(null); const [insp, setInsp] = useState(null); const [invOpen, setInvOpen] = useState({});
    const scopeQ = '?ns=' + encodeURIComponent(p.ns) + (camp ? '&campaign=' + encodeURIComponent(camp) : '');
    useEffect(() => { let live = true; setWs(undefined); call('/brand/workspace' + scopeQ).then(d => { if (live) setWs(d); }).catch(e => { if (live) setWs({ error: e.message }); }); return () => { live = false; }; }, [p.ns, camp, n, tick]);
    useEffect(() => { let live = true; setInv(undefined); setInsp(null); call('/brand/inventory' + scopeQ).then(d => { if (live) setInv(d); }).catch(e => { if (live) setInv({ error: e.message }); }); return () => { live = false; }; }, [p.ns, camp, n, tick]);
    const again = () => setN(x => x + 1);
    const act = async (label, fn) => { setBusy(label); try { await fn(); again(); } catch (e) { toastMsg(label + ': ' + e.message, true); } finally { setBusy(''); } };
    const openHistory = i => call('/brand/item/history?ns=' + encodeURIComponent(p.ns) + '&id=' + encodeURIComponent(i.id)).then(setHist).catch(e => toastMsg(e.message, true));
    /* Teach this brand: a proposal (from the inspection, a recommendation or the form) is previewed, then confirmed with a reason */
    const CORNER_WORD = { tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' };
    const teachOpen = (kind, proposal, from) => setTeach({ kind: kind || 'placement', proposal: Object.assign(kind === 'placement' || !kind ? { corner: 'br', mandatory: true, note: '' } : {}, proposal || {}), reason: '', preview: null, from: from || '' });
    const teachSet = patch => setTeach(t => Object.assign({}, t, patch));
    const teachProp = patch => setTeach(t => Object.assign({}, t, { proposal: Object.assign({}, t.proposal, patch), preview: null }));
    const teachBody = (confirm) => Object.assign({ ns: p.ns, campaign: teach.kind === 'banned' ? (camp || '') : camp, kind: teach.kind, proposal: teach.proposal }, confirm ? { confirm: true, reason: teach.reason } : {});
    // reading (a preview, the inspection) refreshes nothing; only a confirmed teaching reloads the workspace
    const quiet = async (label, fn) => { setBusy(label); try { await fn(); } catch (e) { toastMsg(label + ': ' + e.message, true); } finally { setBusy(''); } };
    const teachPreview = () => quiet('Preview not made', async () => { const d = await call('/brand/teach', teachBody(false)); teachSet({ preview: d.preview || d }); });
    const teachConfirm = () => act('Not taught', async () => { const d = await call('/brand/teach', teachBody(true)); toastMsg('Taught: ' + (d.text || (d.fact && d.fact.text) || (d.banned && 'never "' + d.banned.term + '"') || (d.fix && d.fix.rule) || (d.item && d.item.title) || 'recorded') + ' (a revision, with your reason)'); setTeach(null); });
    const inspect = () => quiet('Inspection not read', async () => { setInsp(await call('/brand/teach/inspect' + scopeQ)); });
    const recAct = r => {
      const a = r.action || {};
      if (a.route === '/brand/teach' && a.body) return html`<button class="btn sm" disabled=${!!busy} onClick=${() => teachOpen(a.body.kind, a.body.proposal, r.code)}>Teach</button>`;
      if (a.route === '/engine/artwork/describe') return html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => { if (!confirm('Describe ' + (a.body.limit || 1) + ' artwork' + ((a.body.limit || 1) === 1 ? '' : 's') + ' with the vision model (' + (a.body.limit || 1) + ' paid call' + ((a.body.limit || 1) === 1 ? '' : 's') + ')?')) return; act('Not described', () => call('/engine/artwork/describe', { ns: p.ns, limit: a.body.limit || 1 })); }}>Describe (${a.body.limit || 1} paid)</button>`;
      if (a.route === '/studio/reference/analyse' && a.ids) return html`<button class="btn sm ghost" disabled=${!!busy} onClick=${() => { if (!confirm('Analyse ' + a.ids.length + ' reference' + (a.ids.length === 1 ? '' : 's') + ' (' + a.ids.length + ' paid extraction call' + (a.ids.length === 1 ? '' : 's') + ')?')) return; act('Not analysed', async () => { for (const id of a.ids) await call('/studio/reference/analyse', { id }); }); }}>Analyse (${a.ids.length} paid)</button>`;
      return null;
    };
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

      <section class="st-brand-sec st-inv" aria-label="Knowledge inventory"><${Lbl}>What the Studio can use ${ws.campaign ? 'for ' + ws.campaign.name : 'for the client'}, and what it holds but never sends</${Lbl}>
        ${inv === undefined ? html`<div class="ov-dim">Counting...</div>` : inv.error ? html`<div class="ov-dim">${inv.detail || inv.error}</div>` : html`
          <div class="st-inv-strip"><span><b>${inv.counts.usable}</b> usable</span><span><b>${inv.counts.notRetrieved}</b> stored, not retrieved</span><span><b>${inv.counts.unanalysed}</b> not analysed</span><span><b>${inv.counts.missing}</b> missing</span><span><b>${inv.counts.conflicting}</b> to resolve</span><span><b>${inv.counts.recommendations}</b> recommended</span></div>
          <table class="ov-table st-inv-table"><thead><tr><th>Usable</th><th>n</th><th>What</th><th>Reaches</th></tr></thead><tbody>${inv.usable.map(u => html`<tr key=${u.kind}><td><b>${u.kind}</b></td><td class="num">${u.n}${u.analysed != null && u.analysed !== u.n ? html` <span class="ov-dim">(${u.analysed} analysed)</span>` : null}</td><td>${u.text}</td><td class="ov-dim">${u.reaches}</td></tr>`)}</tbody></table>
          ${inv.notRetrieved.length ? html`<div class="st-inv-nr"><span class="st-lbl">Stored but never reaches a model</span><ul class="st-ul">${inv.notRetrieved.map(x => html`<li key=${x.code}><${Chip} kind="warn">${x.code.replace(/_/g, ' ')}</${Chip}> <b>${x.n}</b> - ${x.why}. <span class="ov-dim">${x.remedy}</span>
            <button class="ov-link" onClick=${() => setInvOpen(Object.assign({}, invOpen, { [x.code]: !invOpen[x.code] }))}>${invOpen[x.code] ? 'hide' : 'show'}</button>${invOpen[x.code] ? html`<ul class="st-ul ov-dim">${x.items.map((it, k) => html`<li key=${k}>${it.text || it.name || it.title || it.id}${it.campaign ? ' (' + it.campaign + ')' : ''}</li>`)}</ul>` : null}</li>`)}</ul></div>` : html`<div class="ov-dim">Everything stored for this scope reaches the models.</div>`}
          ${inv.unanalysed.length ? html`<div><span class="st-lbl">Not analysed</span> <span class="ov-dim">${inv.unanalysed.map(r => r.name).join(', ')} - the models read them by name only.</span></div>` : null}
          ${inv.recommendations.length ? html`<div class="st-inv-rec"><span class="st-lbl">Recommended</span><ul class="st-ul">${inv.recommendations.map((r, k) => html`<li key=${r.code + k} class="st-inv-rec-row"><${Chip} kind=${r.priority === 'blocking' ? 'bad' : r.priority === 'high' ? 'warn' : ''}>${r.code.replace(/_/g, ' ')}</${Chip}> ${r.text} ${rw ? recAct(r) : null}</li>`)}</ul></div>` : null}
          ${inv.examples.length ? html`<div class="ov-dim"><span class="st-lbl">Curated examples still wanted</span> ${inv.examples.map(x => x.purpose + ' (' + x.why + ')').join('; ')}. ${inv.examples[0].where}.</div>` : null}
          <div class="ov-dim">${inv.note}</div>`}
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
        <div class="st-place" aria-label="Mark placement evidence"><b>Mark placement</b> ${ws.placement.basis === 'rule' ? html`<${Chip} kind="ok" title=${AUTH_TITLE.rule}>approved rule${ws.placement.mandatory ? ', held' : ', preferred'}</${Chip}> ${ws.placement.text}` : ws.placement.basis === 'observed' ? html`<${Chip} kind=${ws.placement.exceptions.length || ws.placement.confidence < 0.7 ? 'warn' : ''} title=${AUTH_TITLE.observation}>reference observation, ${Math.round(ws.placement.confidence * 100)}% agreement</${Chip}> ${ws.placement.text}${ws.campaign && rw ? html` <button class="ov-link" onClick=${() => teachOpen('placement', { corner: ws.placement.corner, mandatory: true, note: '' }, 'evidence')}>make it the rule</button>` : null}` : html`<span class="ov-dim">not observed in an approved reference and no rule taught; the house default (bottom right) applies and the Studio may move the mark to clear words</span>${ws.campaign && rw ? html` <button class="ov-link" onClick=${() => teachOpen('placement', null, 'default')}>teach it</button>` : null}`}
          ${ws.placement.evidence.length ? html`<table class="ov-table st-place-table"><thead><tr><th>Reference</th><th>Approval</th><th>Corner</th><th>Read as</th><th>Confidence</th><th>Mark</th></tr></thead><tbody>${ws.placement.evidence.map(e => html`<tr key=${e.ref} class=${e.corner !== ws.placement.corner ? 'st-place-ex' : ''}><td>${e.name}</td><td>${e.approval}</td><td>${CORNER_WORD[e.corner] || e.corner}${e.corner !== ws.placement.corner ? html` <${Chip} kind="warn">exception</${Chip}>` : null}</td><td class="ov-dim">${e.basis === 'structured' ? 'the analyst\'s mark reading' : 'a corner phrase in the prose'}</td><td class="num">${Math.round(e.confidence * 100)}%</td><td class="ov-dim">${e.kind}${e.size ? ', ' + e.size : ''}</td></tr>`)}</tbody></table>` : null}
        </div>
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

      ${rw ? html`<section class="st-brand-sec st-teach" aria-label="Teach this brand"><${Lbl}>Teach this brand</${Lbl}>
        <div class="ov-dim">Turn what the references show, and what the team knows, into rules the Studio holds: a mark placement, an approved fact with its source, a term never to use, a correction for the models, a note. Every teaching is previewed first and confirmed with a reason; each confirmation is a kit revision, a learned correction or a knowledge item, never a silent change.</div>
        <div class="st-know-acts"><button class="btn sm ghost" disabled=${!!busy} onClick=${inspect}>Inspect: what could be taught</button>
          ${!teach ? html`<button class="btn sm" onClick=${() => teachOpen('placement', null, 'form')}>Teach something</button>` : null}</div>
        ${insp ? html`<div class="st-teach-props">${insp.proposals.length ? html`<ul class="st-ul">${insp.proposals.map((x, k) => html`<li key=${x.kind + k}><${Chip} kind=${x.kind === 'placement' ? 'ok' : 'warn'}>${x.kind}</${Chip}> ${x.kind === 'placement' ? 'Mark ' + CORNER_WORD[x.proposal.corner] + ' (' + Math.round(x.confidence * 100) + '% agreement, ' + x.evidence.length + ' reference' + (x.evidence.length === 1 ? '' : 's') + ')' : x.kind === 'fact' ? 'Approve the fact "' + x.proposal.text + '"' + (x.proposal.source ? ' (' + x.proposal.source + ')' : '') : (x.proposal.title || x.proposal.body)} <span class="ov-dim">- ${x.why}</span> <button class="ov-link" onClick=${() => teachOpen(x.kind, x.proposal, 'inspect')}>use</button></li>`)}</ul>` : html`<div class="ov-dim">Nothing proposed: no observed placement without a rule, no pending fact, no waiting item.</div>`}</div>` : null}
        ${teach ? html`<div class="st-offer-box st-teach-form" aria-label="Teach form">
          <div class="st-nd-row"><select class="st-sel" value=${teach.kind} onChange=${e => teachOpen(e.target.value, null, teach.from)} aria-label="What to teach"><option value="placement">mark placement (campaign rule)</option><option value="fact">an approved fact</option><option value="banned">a term never to use</option><option value="rule">a correction for the models</option><option value="item">a knowledge item</option></select>
            <span class="ov-dim">${teach.kind === 'placement' || teach.kind === 'rule' ? (camp ? 'for ' + ws.campaign.name : teach.kind === 'placement' ? 'choose a campaign scope above: a placement rule belongs to a campaign' : 'for the whole client') : camp ? 'for ' + ws.campaign.name : 'for the whole client'}</span></div>
          ${teach.kind === 'placement' ? html`<div class="st-nd-row"><select class="st-sel" value=${teach.proposal.corner} onChange=${e => teachProp({ corner: e.target.value })} aria-label="Corner">${Object.keys(CORNER_WORD).map(k => html`<option key=${k} value=${k}>${CORNER_WORD[k]}</option>`)}</select>
            <label class="st-check"><input type="checkbox" checked=${teach.proposal.mandatory !== false} onChange=${e => teachProp({ mandatory: e.target.checked })} /> mandatory: hold the mark there (moves are refused)</label></div>
            <input class="st-in" placeholder="Note on the rule (optional): e.g. the wordmark sits bottom left on every tile" value=${teach.proposal.note || ''} onInput=${e => teachProp({ note: e.target.value })} aria-label="Rule note" />` : null}
          ${teach.kind === 'fact' ? html`<textarea class="st-ta" rows="2" placeholder="The fact, exactly as the client approved it" value=${teach.proposal.text || ''} onInput=${e => teachProp({ text: e.target.value })} aria-label="Fact text"></textarea><input class="st-in" placeholder="Source (required): the document or page it comes from" value=${teach.proposal.source || ''} onInput=${e => teachProp({ source: e.target.value })} aria-label="Fact source" />` : null}
          ${teach.kind === 'banned' ? html`<div class="st-nd-row"><input class="st-in" placeholder="Term never to use" value=${teach.proposal.term || ''} onInput=${e => teachProp({ term: e.target.value })} aria-label="Banned term" /><input class="st-in" placeholder="Say instead" value=${teach.proposal.use || ''} onInput=${e => teachProp({ use: e.target.value })} aria-label="Use instead" /><label class="st-check"><input type="checkbox" checked=${!!teach.proposal.allowNegated} onChange=${e => teachProp({ allowNegated: e.target.checked })} /> allowed inside a denial</label></div>` : null}
          ${teach.kind === 'rule' ? html`<div class="st-nd-row"><select class="st-sel" value=${teach.proposal.task || 'tiles'} onChange=${e => teachProp({ task: e.target.value })} aria-label="Task"><option value="tiles">tiles (design)</option><option value="copy">copy</option><option value="any">any</option></select></div><textarea class="st-ta" rows="2" placeholder="The rule, in the words the models should follow" value=${teach.proposal.rule || ''} onInput=${e => teachProp({ rule: e.target.value })} aria-label="Rule text"></textarea>` : null}
          ${teach.kind === 'item' ? html`<input class="st-in" placeholder="Title" value=${teach.proposal.title || ''} onInput=${e => teachProp({ title: e.target.value })} aria-label="Item title" /><textarea class="st-ta" rows="2" placeholder="What it says" value=${teach.proposal.body || ''} onInput=${e => teachProp({ body: e.target.value })} aria-label="Item body"></textarea>` : null}
          <input class="st-in" placeholder="Reason (required to confirm): who confirmed it, from what" value=${teach.reason} onInput=${e => teachSet({ reason: e.target.value })} aria-label="Teach reason" />
          ${teach.preview ? html`<div class="st-teach-preview" aria-label="Teach preview"><b>Preview</b> ${teach.preview.text || (teach.preview.fact && 'fact: "' + teach.preview.fact.text + '" cited to ' + teach.preview.fact.source) || (teach.preview.banned && 'never "' + teach.preview.banned.term + '"') || (teach.preview.fix && teach.preview.fix.rule) || (teach.preview.item && teach.preview.item.title) || teach.preview.detail || ''}
            ${teach.preview.writes ? html`<div class="ov-dim">Writes: ${teach.preview.writes.join('; ')}.</div>` : null}
            ${teach.preview.affects ? html`<div class="ov-dim">${teach.preview.affects.assets} existing composition${teach.preview.affects.assets === 1 ? '' : 's'} on the campaign: ${teach.preview.affects.note}.</div>` : null}
            ${teach.preview.exceptions && teach.preview.exceptions.length ? html`<div class="ov-dim">Recorded as exceptions: ${teach.preview.exceptions.map(e => e.name + ' (' + CORNER_WORD[e.corner] + ')').join(', ')}.</div>` : null}</div>` : null}
          <div class="st-know-acts"><button class="btn sm ghost" disabled=${!!busy} onClick=${teachPreview}>Preview</button><button class="btn sm" disabled=${!!busy || !teach.reason.trim() || !teach.preview} title=${!teach.preview ? 'preview first' : !teach.reason.trim() ? 'a reason is required' : ''} onClick=${teachConfirm}>Confirm and teach</button><button class="btn sm ghost" onClick=${() => setTeach(null)}>Cancel</button></div>
        </div>` : null}
      </section>` : null}

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
        <${InformedPanel} m=${u.informed} />
      </div>`}</details>`;
  }
  /** What informed this creative: the compiler's manifest as recorded with the generation - what reached the model, by id, and what was held back, by reason. */
  function InformedPanel({ m }) {
    if (!m) return html`<div class="st-informed"><b>What informed this creative?</b> <span class="ov-dim">no manifest recorded: this version was made before the context compiler, or not by a model call.</span></div>`;
    const refs = m.references; const list = (arr, f) => arr.map(f).join(', ');
    return html`<div class="st-informed" aria-label="What informed this creative">
      <div><b>What informed this creative?</b> <span class="ov-dim">compiled for the ${m.stage} stage, ${aest(m.at)}; ${m.client}${m.campaign ? ', campaign ' + m.campaign : ', no campaign'}.</span></div>
      <ul class="st-ul">
        <li><b>Approved facts (${m.kit.facts.length})</b> ${m.kit.facts.length ? list(m.kit.facts, f => f.text + (f.source ? ' [' + f.source + ']' : '')) : html`<span class="ov-dim">none: figures only from the sources</span>`}</li>
        <li><b>Never use (${m.kit.banned.length})</b> ${m.kit.banned.length ? list(m.kit.banned, b => '"' + b + '"') : html`<span class="ov-dim">none</span>`}</li>
        <li><b>Voice and rules</b> ${m.kit.voice ? 'the client voice' : 'no voice recorded'}, ${m.kit.standingRules} standing rule${m.kit.standingRules === 1 ? '' : 's'}${m.kit.identity ? ', identity "' + m.kit.identity + '"' : ''}, mark policy ${m.kit.policy}${m.marks ? ' (' + (m.marks.logoOnFile ? 'logo on file' : 'no logo') + ', ' + (m.marks.wordmarkOnFile ? 'wordmark on file' : 'no wordmark') + ')' : ''}</li>
        <li><b>Learned corrections (${m.corrections.length})</b> ${m.corrections.length ? list(m.corrections, c => c.rule + (c.campaign ? ' (campaign ' + c.campaign + ')' : '')) : html`<span class="ov-dim">none in force</span>`}</li>
        <li><b>Approved examples</b> ${m.examples} from the creative shelf</li>
        <li><b>References</b> ${refs ? html`${refs.attached.length ? 'shown as images: ' + list(refs.attached, r => r.name + ' (' + r.purpose + ')') + '. ' : ''}${refs.read.length ? 'read by analysis: ' + list(refs.read, r => r.name + ' (' + r.purpose + ')') + '. ' : ''}${!refs.attached.length && !refs.read.length ? 'none reached the model. ' : ''}${refs.excluded ? html`<span class="ov-dim">${refs.excluded} left out.</span>` : null}` : html`<span class="ov-dim">no references for this stage (copy only)</span>`}</li>
        ${m.artMemory ? html`<li><b>Artwork memory</b> ${m.artMemory.count} catalogued artwork${m.artMemory.count === 1 ? '' : 's'}${m.artMemory.sameCampaign ? ' (' + m.artMemory.sameCampaign + ' of this campaign)' : ''}${m.artMemory.otherCampaigns ? ', ' + m.artMemory.otherCampaigns + ' of other campaigns left out' : ''}</li>` : null}
        ${m.placement ? html`<li><b>Mark placement</b> ${m.placement.basis === 'rule' ? 'the approved rule' : m.placement.basis === 'observed' ? 'observed in ' + m.placement.evidence + ' reference' + (m.placement.evidence === 1 ? '' : 's') + ' (' + Math.round(m.placement.confidence * 100) + '% agreement' + (m.placement.exceptions ? ', ' + m.placement.exceptions + ' differing' : '') + ')' : 'the house default'}: ${({ tl: 'top left', tr: 'top right', bl: 'bottom left', br: 'bottom right' })[m.placement.corner] || m.placement.corner}${m.placement.mandatory ? ', held' : ''}</li>` : null}
        ${m.omitted.length ? html`<li><b>Held back (${m.omitted.length})</b> <ul class="st-ul ov-dim">${m.omitted.map((o, k) => html`<li key=${k}>${o.what}${o.text ? ' "' + o.text + '"' : ''}: ${o.why}</li>`)}</ul></li>` : null}
        <li class="ov-dim">Prompt sections: ${list(m.sections, s => s.id + ' ' + s.chars + ' chars')}. Models: ${m.models ? m.models.creative + ' / ' + m.models.extract : 'not recorded'}. Nothing from another client.</li>
      </ul>
    </div>`;
  }
  /* ------------------------------------------------------------ client review: private links out, comments in, resolved by version */
  /* ------------------------------------------------------------ Review: one table of every asset's approvals, then the client's review */
  const TECH_SHORT = { passed: 'passed', failed: 'failing', stale: 'stale', not_validated: 'not validated', not_applicable: 'n/a' };
  /* the preflight of one asset, read from what is on record for its current version - the copy checks, the stored technical
     validation (its blocking findings and warnings), the mark, the alt text and the Creative Director's last reading - never estimated */
  const A11Y_RX = /contrast|small_type|unreadable_type|tiny_type/;
  const BRAND_RX = /^mark_|logo|wordmark|clear_space|double_styling/;
  function preflight(a) {
    const v = current(a) || {}; const r = a.readiness || {}; const val = r.validation || {};
    const bl = val.blocking || [], wn = val.warnings || [];
    const word = c => (c.code || '').replace(/_/g, ' ');
    const pick = (rx, yes) => ({ b: bl.filter(i => yes ? rx.test(i.code || '') : !(A11Y_RX.test(i.code || '') || BRAND_RX.test(i.code || ''))), w: wn.filter(i => yes ? rx.test(i.code || '') : !(A11Y_RX.test(i.code || '') || BRAND_RX.test(i.code || ''))) });
    const copyOnly = v.mode === 'copy'; const finished = v.mode === 'finished'; const flat = v.mode === 'generated';
    const cf = (v.checks || []).filter(c => COPY_BAD[c.state]);
    const out = {};
    out.copy = cf.some(c => c.state === 'differs' || c.state === 'banned') ? { s: 'bad', t: cf.map(c => CHECK_WORD[c.state] || c.state).join(', ') } : cf.length ? { s: 'warn', t: cf.length + ' to look at: ' + cf.map(c => CHECK_WORD[c.state] || c.state).join(', ') } : { s: 'ok', t: 'figures traced, no banned term' };
    if (copyOnly) { out.design = out.brand = { s: 'na', t: 'copy only' }; }
    else if (finished) { const bk = r.baked || {}; out.design = !v.image ? { s: 'warn', t: 'not generated yet' } : bk.verified ? { s: 'ok', t: 'words and mark read back' } : { s: 'warn', t: 'not read back: the painted words and mark wait for the Creative Director' }; out.brand = (v.layout || {}).incomplete && v.layout.incomplete.length ? { s: 'bad', t: 'mark not on file' } : bk.verified ? { s: 'ok', t: 'mark read back' } : { s: 'warn', t: 'mark not read back' }; }
    else if (flat) { out.design = out.brand = { s: 'na', t: 'legacy flattened tile' }; }
    else {
      const t = r.technical || 'not_validated';
      const d = pick(null, false), br = pick(BRAND_RX, true);
      out.design = t === 'passed' ? (d.w.length ? { s: 'warn', t: 'passed, ' + d.w.length + ' warning' + (d.w.length === 1 ? '' : 's') + ': ' + d.w.slice(0, 3).map(word).join(', ') } : { s: 'ok', t: 'validation passed' }) : t === 'failed' ? { s: 'bad', t: d.b.length ? d.b.slice(0, 3).map(word).join(', ') : 'validation failing' } : t === 'stale' ? { s: 'warn', t: 'measured on an earlier version' } : { s: 'warn', t: 'not measured yet' };
      const inc = (v.layout || {}).incomplete || [];
      out.brand = inc.length ? { s: 'bad', t: 'mark not on file' } : br.b.length ? { s: 'bad', t: br.b.slice(0, 3).map(word).join(', ') } : br.w.length ? { s: 'warn', t: br.w.slice(0, 3).map(word).join(', ') } : t === 'passed' ? { s: 'ok', t: 'marks placed and readable' } : { s: 'warn', t: 'not measured yet' };
    }
    const ax = copyOnly || flat ? { b: [], w: [] } : pick(A11Y_RX, true); const alt = String((v.copy || {}).alt || '').trim();
    out.access = ax.b.length ? { s: 'bad', t: ax.b.slice(0, 3).map(word).join(', ') } : !alt && !copyOnly ? { s: 'warn', t: 'no alt text' + (ax.w.length ? '; ' + ax.w.slice(0, 2).map(word).join(', ') : '') } : ax.w.length ? { s: 'warn', t: ax.w.slice(0, 3).map(word).join(', ') } : !copyOnly && !finished && !flat && (r.technical || '') !== 'passed' ? { s: 'warn', t: 'contrast not measured yet' } : { s: 'ok', t: copyOnly ? 'nothing visual' : 'alt text present' + (finished ? '; contrast judged by eye' : ', contrast measured') };
    const ins = r.inspection || {}; out.advice = ins.state && ins.state !== 'none' && ins.state !== 'not_applicable' ? (ins.state === 'stale' ? 'Creative Director: read an earlier version' : 'Creative Director: ' + (ins.verdict || ins.state) + (ins.state === 'inconsistent' ? ' (disagrees with the measurement)' : '')) : '';
    out.clear = ['copy', 'design', 'brand', 'access'].every(k => out[k].s === 'ok' || out[k].s === 'na');
    return out;
  }
  const PF_WORD = { ok: 'pass', warn: 'check', bad: 'fix', na: 'n/a' };
  function ReviewStage({ p, onApprove, onOpen, head, onGo, flow }) {
    const rw = canWrite() && !p.readOnly;
    const cell = (a, part) => { const v = current(a); const ap = standing(a, part); const copyOnly = v && v.mode === 'copy';
      if (part === 'design' && copyOnly) return html`<span class="ov-dim">copy only</span>`;
      const blocked = part === 'design' && v && v.mode === 'finished' ? (!v.image ? 'The finished creative has not been generated yet.' : !(a.readiness && a.readiness.baked && a.readiness.baked.verified) ? 'Design approval waits for the Creative Director to read the painted words and the mark back from this exact bitmap: open it in Design and press Review.' : '') : part === 'design' && (!a.readiness || (a.readiness.technical !== 'passed' && a.readiness.technical !== 'not_applicable')) ? 'Design approval waits for a passing validation of this exact version: open it in Design to measure it.' : part === 'design' && v && v.layout && (v.layout.incomplete || []).length ? 'The campaign mark is not on file.' : '';
      return ap ? html`<span><${Chip} kind="ok">${part === 'copy' ? 'ready / approved' : 'approved'}</${Chip}> <span class="ov-dim">v${vnum(a, a.versions.find(x => x.id === ap.version) || {})} by ${ap.by}${ap.carried ? ', unchanged since' : ''}</span>${rw ? html` <button class="ov-link" onClick=${() => onApprove(a, part, 'withdraw')}>withdraw</button>` : null}</span>`
        : rw ? html`<span class="st-apcell"><button class="btn sm ghost" disabled=${!!blocked} title=${blocked} onClick=${() => onApprove(a, part, 'approve')} aria-label=${'Approve ' + part + ' of ' + a.title}>Approve ${part}</button>${blocked ? html`<span class="ov-dim">${blocked}</span>` : null}</span>` : html`<span class="ov-dim">not approved</span>`; };
    const pfs = p.assets.map(a => ({ a, f: preflight(a) }));
    const clear = pfs.filter(x => x.f.clear).length;
    const pf = (c, label) => html`<td class=${'st-pf st-pf-' + c.s} data-check=${label}><span class=${'st-pf-chip ' + c.s}>${PF_WORD[c.s]}</span> <span class="st-pf-t">${c.t}</span></td>`;
    return html`<div class="st-centre-pad st-reviewstage">
      <${StageHead} ...${head}>${flow.counts.ready ? html`<button class="btn sm" onClick=${() => onGo('export')}>Continue to Export (${flow.counts.ready} ready)</button>` : null}</${StageHead}>
      <div class="ov-why">The preflight is read from each piece's current version: the checks on its words, its measured validation (layout, marks, contrast) and its alt text. Approval is a person's decision about that exact version; an edit drops the approval of the part it changes. The Creative Director's verdict is advice and never approves.</div>
      ${!p.assets.length ? html`<div class="st-empty-state"><b>Nothing to review yet.</b><span>Write the copy and build the design first.</span><button class="btn sm" onClick=${() => onGo('copy')}>Go to Copy</button></div>` : html`
      <div class="st-pf-sum" role="status"><b>${clear} of ${p.assets.length}</b> clear the preflight; <b>${flow.counts.approved}</b> approved; <b>${flow.counts.ready}</b> ready to export.</div>
      <div class="st-copydeck-scroll"><table class="ov-table st-approvals" aria-label="Preflight and approvals"><thead><tr><th>Asset</th><th>Copy</th><th>Design</th><th>Brand</th><th>Accessibility</th><th>Approvals</th></tr></thead><tbody>
        ${pfs.map(({ a, f }) => { const v = current(a); const fin = v && v.mode === 'finished'; return html`<tr key=${a.id}><td class="st-pf-asset">${v && v.mode !== 'copy' ? html`<span class="st-pf-thumb"><${Composition} v=${v} a=${a} ns=${p.ns} size="mini" /></span>` : null}<button class="st-lib-open" onClick=${() => onOpen(a.id)}>${a.title}</button><div class="ov-dim">${chanLabel(a.channel)} ${a.format}${fin ? ', finished creative' : ''}; v${vnum(a, v)} of ${vtotal(a)}</div>${f.advice ? html`<div class="ov-dim st-pf-advice">${f.advice}</div>` : null}</td>${pf(f.copy, 'copy')}${pf(f.design, 'design')}${pf(f.brand, 'brand')}${pf(f.access, 'accessibility')}<td class="st-pf-ap"><div><span class="st-lbl">Copy</span> ${cell(a, 'copy')}</div><div><span class="st-lbl">Design</span> ${cell(a, 'design')}</div></td></tr>`; })}
      </tbody></table></div>`}
      ${p.assets.length ? html`<${ReviewView} p=${p} onOpen=${onOpen} />` : null}
    </div>`;
  }
  /* ------------------------------------------------------------ Export: what will be in the bundle, and what is in it once made */
  function ExportView({ p, head, flow, state, onExport, onClickup, onGo }) {
    const rows = p.assets.map(a => { const v = current(a); const c = standing(a, 'copy'), d = standing(a, 'design'); const copyOnly = v && v.mode === 'copy'; const fin = v && v.mode === 'finished'; const tech = fin ? 'not_applicable' : (a.readiness || {}).technical; const valid = copyOnly || (v && v.mode === 'generated') || (fin ? !!(a.readiness || {}).production : tech === 'passed'); return { a, v, c, d, valid, tech, fin, ok: !!(c && (d || copyOnly) && valid), partly: !!(c || d) }; });
    const ready = rows.filter(x => x.ok); const busy = state && state.busy;
    // S18: delivery says what the package will hold before anything is drawn, and why each piece left out is left out
    const blockers = x => { const out = []; if (!x.c) out.push('copy not approved'); if (!(x.v && x.v.mode === 'copy') && !x.d) out.push('design not approved'); if (!x.valid) out.push(x.fin ? 'painted words and mark not read back' : x.tech === 'failed' ? 'technical validation failing' : 'not validated yet'); return out; };
    const fileOf = x => { const v = x.v; const safe = (x.a.title + '-v' + vnum(x.a, v)).replace(/[^a-z0-9-]+/gi, '_'); if (v.mode === 'copy') return null; if (v.mode === 'finished' || !(v.layout && v.layout.layers)) return { name: safe + ' (the generated image)', px: v.image && v.image.size ? v.image.size : '' }; return { name: safe + '.png', px: v.layout.stage ? v.layout.stage.w + ' x ' + v.layout.stage.h : '' }; };
    const out = rows.filter(x => !x.ok);
    return html`<div class="st-centre-pad st-exportstage" aria-label="Delivery">
      <${StageHead} ...${head}>${ready.length ? html`<button class="btn sm" disabled=${busy} onClick=${() => onExport(ready)}>${busy ? 'Preparing...' : state && state.url ? 'Prepare again' : 'Prepare the package (' + ready.length + ')'}</button>` : null}${state && state.url ? html`<a class="btn sm ghost" href=${state.url} download=${state.name}>Download ${state.name} (${Math.round(state.size / 1024)} KB)</a>` : null}</${StageHead}>
      <section class="st-delivery" aria-label="The delivery package">
        <div class="st-delivery-col"><div class="st-lbl">In the package (${ready.length})</div>
          ${ready.length ? html`<ul class="st-delivery-list">${ready.map(x => { const f = fileOf(x); return html`<li key=${x.a.id}><b>${x.a.title}</b> <span class="ov-dim">v${vnum(x.a, x.v)}${f ? ' - ' + f.name + (f.px ? ', ' + f.px + ' px' : '') : ' - copy only'}</span></li>`; })}<li><b>copy-sheet.txt</b> <span class="ov-dim">every approved word, its checks and approvals</span></li><li><b>manifest.json</b> <span class="ov-dim">each exact version, its layout, imagery and approvals</span></li></ul>` : html`<div class="ov-dim">Nothing yet: a piece goes in once its copy and design are approved and its current version passes its checks.</div>`}</div>
        <div class="st-delivery-col"><div class="st-lbl">Left out (${out.length})</div>
          ${out.length ? html`<ul class="st-delivery-list out">${out.map(x => html`<li key=${x.a.id}><b>${x.a.title}</b> <span class="st-bad">${blockers(x).join('; ')}</span></li>`)}</ul>` : html`<div class="ov-dim">Nothing is left out.</div>`}</div>
      </section>
      <div class="ov-why">Each image is drawn at its native size by the same renderer as the preview. Preparing the package sends nothing anywhere; a hand-off is its own, confirmed step.</div>
      <table class="ov-table"><thead><tr><th>Asset</th><th>Version</th><th>Copy</th><th>Design</th><th>Validation</th><th>Export</th></tr></thead><tbody>${rows.map(x => html`<tr key=${x.a.id}><td>${x.a.title}<div class="ov-dim">${chanLabel(x.a.channel)} ${x.a.format}${x.v && x.v.layout && x.v.layout.stage ? ', ' + x.v.layout.stage.w + ' x ' + x.v.layout.stage.h + ' px' : ''}</div></td><td class="ov-dim">v${vnum(x.a, x.v)}</td><td>${x.c ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.v && x.v.mode === 'copy' ? html`<span class="ov-dim">copy only</span>` : x.d ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.valid ? html`<${Chip} kind="ok">${x.v && x.v.mode === 'copy' ? 'n/a' : x.fin ? 'read back' : 'passed'}</${Chip}>` : html`<${Chip} kind=${x.tech === 'failed' ? 'bad' : 'warn'}>${x.tech === 'failed' ? 'failing' : x.fin ? 'not read back' : 'not validated'}</${Chip}>`}${x.fin ? html`<div class="ov-dim">finished bitmap: the file is the generated image</div>` : null}</td><td>${x.ok ? html`<${Chip} kind="ok">included</${Chip}>` : html`<span class="ov-dim">left out${x.c && (x.d || (x.v && x.v.mode === 'copy')) && !x.valid ? ' (approved, but ' + (x.tech === 'failed' ? 'its validation fails' : x.fin ? 'its words and mark were not read back' : 'not validated') + ')' : x.partly ? ' (partly approved)' : ' (not approved)'}</span>`}</td></tr>`)}</tbody></table>
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
  /* ------------------------------------------------------------ art direction: the re-render area as a creative director */
  /** Suggested next directions: specific, editable instructions the worker drew from this tile, its references and the recent feedback. */
  function Suggestions({ kind, sugg, onUse, onApply, onRefresh, busy, compact }) {
    const d = sugg && sugg.data; const items = d && Array.isArray(d[kind]) ? d[kind] : [];
    const title = kind === 'image' ? 'Suggested photographs' : kind === 'typography' ? 'Suggested type changes' : kind === 'copy' ? 'Suggested copy changes' : kind === 'concept' ? 'Concepts worth exploring' : 'Suggested next directions';
    return html`<div class=${'st-sugg ' + kind + (compact ? ' compact' : '')} aria-label=${title}>
      <div class="st-sugg-head"><${Lbl}>${title}</${Lbl}><span class="ov-dim">${sugg && sugg.loading ? 'thinking...' : d ? (d.cached ? 'from the last look' : 'fresh') + (d.imageSeen ? ', the artwork seen' : '') + ((d.refsUsed || []).length ? ', ' + d.refsUsed.length + ' reference' + (d.refsUsed.length === 1 ? '' : 's') : '') : ''}</span>${onRefresh && sugg && !sugg.idle ? html`<button class="ov-link" disabled=${!!busy || sugg.loading} onClick=${() => onRefresh(true)} title="Ask again for this version: one model call">refresh</button>` : null}</div>
      ${sugg && sugg.idle && onRefresh ? html`<div><button class="btn sm ghost" disabled=${!!busy} onClick=${() => onRefresh(false)} title="One small model call for this version (none when an answer for it is already cached); nothing is applied until you choose">Suggest for this version (1 model call)</button></div>` : null}
      ${sugg && sugg.err ? html`<div class="ov-dim">Suggestions unavailable: ${sugg.err}</div>` : null}
      ${d && !items.length && !sugg.loading ? html`<div class="ov-dim">Nothing suggested for this version.</div>` : null}
      ${items.map((s, i) => html`<div key=${i} class="st-sugg-item"><div class="st-sugg-text">${s.text}</div>${s.basis || s.changes || s.preserves || s.paid != null ? html`<div class="st-sugg-meta">${s.basis ? html`<${Chip} kind=${s.basis === 'rule' ? 'ok' : s.basis === 'inferred' ? 'warn' : ''}>${s.basis}</${Chip}>` : null}${s.changes ? html` <span class="ov-dim">changes ${s.changes}</span>` : null}${s.preserves ? html` <span class="ov-dim">keeps ${s.preserves}</span>` : null} <${Chip} kind=${s.paid ? 'warn' : 'ok'}>${s.paid ? 'needs a render' : 'no render'}</${Chip}></div>` : null}<div class="st-sugg-foot"><span class="ov-dim">${s.why}${(s.refs || []).length ? ' - from ' + s.refs.map(r => r.name).join(', ') : ''}</span><span class="st-sugg-acts"><button class="ov-link" disabled=${!!busy} onClick=${() => onUse(s.text)} title="Put it in the composer to edit before sending">${kind === 'image' ? 'use as the description' : 'use as instruction'}</button>${onApply && kind !== 'image' ? html`<button class="ov-link" disabled=${!!busy} onClick=${() => onApply(s.text)} title=${'Send it as it stands: one model call' + (s.paid ? '; it needs a render, which is proposed and never spent without your yes' : '; no render')}>apply (1 model call)</button>` : null}</span></div></div>`)}
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
    // S8: what each action changes, preserves and costs, computed by the worker from the version as it stands
    const [acts, setActs] = useState(null); const [actsOpen, setActsOpen] = useState(false);
    useEffect(() => { let live = true; setActs(null); call('/studio/actions?asset=' + encodeURIComponent(a.id) + '&version=' + encodeURIComponent(v.id)).then(d => { if (live) setActs(d); }).catch(e => { if (live) setActs({ error: e.message }); }); return () => { live = false; }; }, [a.id, v.id, JSON.stringify(a.locks || {}), (p.jobs || []).filter(j => j.asset === a.id && (j.state === 'queued' || j.state === 'running')).length]);
    const actOf = id => (acts && acts.actions || []).find(x => x.id === id) || null;
    const actTitle = (id, dflt) => { const x = actOf(id); return x ? (x.available ? x.what + '. Changes: ' + x.changes.join('; ') + '. Keeps: ' + x.preserves.join('; ') + '. Cost: ' + x.cost.text + '.' : 'Not now: ' + x.why) : dflt; };
    const actOff = id => { const x = actOf(id); return !!(x && !x.available); };
    return html`<div class="st-field st-ad"><div class="st-field-head"><${Lbl}>Art direction</${Lbl}><span class="ov-dim">concepts are sketched on the current imagery first; nothing is generated until you press Generate</span></div>
      ${acts && !acts.error ? html`<div class="st-actions" aria-label="What each action changes, keeps and costs"><button class="ov-link" onClick=${() => setActsOpen(!actsOpen)}>${actsOpen ? 'Hide' : 'Show'} what each action changes, keeps and costs</button>
        ${actsOpen ? html`<table class="ov-table st-actions-table"><thead><tr><th>Action</th><th>Changes</th><th>Keeps</th><th>Cost</th><th>Now</th></tr></thead><tbody>${acts.actions.map(x => html`<tr key=${x.id} class=${x.available ? '' : 'st-act-off'}><td><b>${x.label}</b><div class="ov-dim">${x.what}</div></td><td>${x.changes.join('; ')}</td><td>${x.preserves.join('; ')}</td><td class="st-act-cost">${x.cost.text}</td><td>${x.available ? html`<${Chip} kind="ok">available</${Chip}>` : html`<${Chip} kind="warn" title=${x.why}>not now</${Chip}><div class="ov-dim">${x.why}</div>`}</td></tr>`)}</tbody></table><div class="ov-dim">${acts.note}</div>` : null}</div>` : null}
      ${!ro ? html`<div class="st-ad-ask">
        <input class="st-in" value=${fb} onInput=${e => setFb(e.target.value)} placeholder='Feedback or a brief for the Creative Director (optional): "the fisher is covered", "more cinematic", "a myth / fact pair"' />
        <div class="st-ad-actions">
          <button class="btn sm ghost" disabled=${!!busy || actOff('refine')} title=${actTitle('refine', 'Keep the idea, improve the finish in named ways')} onClick=${() => onPropose(a, fb.trim() || 'Refine this design: keep the idea, improve the finish', null, { mode: 'refine', size })}>Refine this design</button>
          <button class="btn sm" disabled=${!!busy || actOff('explore')} title=${actTitle('explore', 'Three visibly different interpretations of the same message')} onClick=${() => onPropose(a, fb.trim() || 'Give me different variations', null, { mode: 'explore', size })}>Explore variations</button>
          <button class="btn sm ghost" disabled=${!!busy || actOff('layouts')} title=${actTitle('layouts', 'Three different arrangements of this tile: the same photograph and the approved words, a different hierarchy, placement and panel treatment; no render')} onClick=${() => onPropose(a, fb.trim() || 'Show me different layouts of this tile', null, { mode: 'layouts', size })}>Explore layouts (same image and copy)</button>
          <button class=${'btn sm ghost' + (nd ? ' on' : '')} disabled=${!!busy || actOff('new')} title=${actTitle('new', 'A fresh visual concept from the brief and the campaign identity; the current panel and layout are not inherited')} onClick=${() => setNd(nd ? null : { instruction: fb.trim(), refs: {}, refMode: 'recommended', keep: { imagery: false, copy: true, composition: false } })}>Create a new design</button>
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
  const EDIT_KINDS = [['area', 'Change a marked area'], ['remove', 'Remove an object'], ['background', 'New background, keep the subject'], ['relight', 'Change the light'], ['restyle', 'Restyle, keep the content']];
  const EDIT_BOXED = { area: 1, remove: 1 };
  const EDIT_NOTE = { area: 'area edit: ', remove: 'removal: ', background: 'background swap: ', relight: 'relight: ', restyle: 'restyle: ' };
  const EDIT_DOING = { area: 'Editing the marked area of ', remove: 'Removing an object from ', background: 'Changing the background of ', relight: 'Relighting ', restyle: 'Restyling ' };
  function AreaEdit({ a, v, busy, onEdit }) {
    const [open, setOpen] = useState(false); const [kind, setKind] = useState('area'); const [box, setBox] = useState(null); const [ins, setIns] = useState('');
    const [size, setSize] = useState((v.image && v.image.size) || '2K'); const [src, setSrc] = useState(null); const drag = useRef(null); const ref = useRef(null);
    useEffect(() => { let live = true; setSrc(null); if (open && v.image && v.image.url) blobUrl(v.image.url).then(u => { if (live) setSrc(u); }).catch(() => {}); return () => { live = false; }; }, [open, v.id]);
    if (!v.image || !v.image.url || v.mode === 'artwork') return null;
    if (!open) return html`<div class="st-ad-quick"><button class="ov-link" onClick=${() => setOpen(true)}>Edit an area of the imagery</button> <span class="ov-dim">(one image call; the rest of the photograph is measured afterwards)</span></div>`;
    const r1 = n => Math.round(n * 10) / 10;
    const pt = e => { const r = ref.current.getBoundingClientRect(); return { x: Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100)), y: Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100)) }; };
    const boxed = !!EDIT_BOXED[kind];
    const down = e => { if (!boxed) return; e.preventDefault(); const p0 = pt(e); drag.current = p0; setBox({ x: r1(p0.x), y: r1(p0.y), w: 0, h: 0 }); };
    const move = e => { if (!drag.current) return; const p1 = pt(e), p0 = drag.current; setBox({ x: r1(Math.min(p0.x, p1.x)), y: r1(Math.min(p0.y, p1.y)), w: r1(Math.abs(p1.x - p0.x)), h: r1(Math.abs(p1.y - p0.y)) }); };
    const up = () => { drag.current = null; };
    const setNum = (k, val) => setBox(Object.assign({ x: 0, y: 0, w: 0, h: 0 }, box || {}, { [k]: Math.max(0, Math.min(100, +val || 0)) }));
    const marked = !!(box && box.w >= 2 && box.h >= 2);
    const ready = (kind === 'remove' || !!ins.trim()) && (!boxed || marked);
    return html`<div class="st-areaedit" aria-label="Edit an area">
      <div class="st-lbl">Edit the imagery</div>
      <div class="st-seg" role="group" aria-label="What kind of edit">${EDIT_KINDS.map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (kind === k ? ' on' : '')} aria-pressed=${kind === k} onClick=${() => setKind(k)}>${l}</button>`)}</div>
      <div class="st-area-stage" ref=${ref} style=${{ aspectRatio: String(a.format || '1:1').replace(':', ' / ') }} onPointerDown=${down} onPointerMove=${move} onPointerUp=${up} onPointerLeave=${up}>
        ${src ? html`<img src=${src} alt="The current imagery" draggable="false" />` : html`<div class="ov-dim">Loading the imagery...</div>`}
        ${boxed && box && box.w > 0 ? html`<div class="st-area-box" style=${{ left: box.x + '%', top: box.y + '%', width: box.w + '%', height: box.h + '%' }}></div>` : null}
      </div>
      ${boxed ? html`<div class="st-nd-row st-area-nums">${[['x', 'from left'], ['y', 'from top'], ['w', 'width'], ['h', 'height']].map(([k, l]) => html`<label key=${k} class="ov-dim">${l} <input class="st-in st-le-num" type="number" min="0" max="100" step="1" value=${box ? box[k] : ''} onInput=${e => setNum(k, e.target.value)} aria-label=${'Area ' + l + ', per cent'} />%</label>`)}</div><div class="ov-dim">${marked ? 'Marked: ' + box.w + '% x ' + box.h + '% of the frame.' + (kind === 'remove' ? ' What is inside is removed and the space filled with what would be behind it.' : '') : kind === 'remove' ? 'Drag a box around what to remove, or type the area in per cent.' : 'Drag on the image, or type the area in per cent.'}</div>`
        : html`<div class="ov-dim">${kind === 'background' ? 'The subject should stay as it is; what is behind it changes.' : kind === 'relight' ? 'Every element stays where it is; only the light and its shadows change.' : 'Everything stays where it is; only the treatment (palette, light, style) changes.'}</div>`}
      <textarea class="st-ta" rows="2" value=${ins} onInput=${e => setIns(e.target.value)} placeholder=${kind === 'area' ? 'What to change in the area, e.g. "replace the sign with a blank wall"' : kind === 'remove' ? 'Optional: what to remove, e.g. "the parked car" (the marked area is enough)' : kind === 'background' ? 'The new background, e.g. "a regional town street at dusk"' : kind === 'relight' ? 'The new light, e.g. "low golden light from the left, long shadows"' : 'The new treatment, e.g. "warmer, muted palette, film grain"'} aria-label="What to change"></textarea>
      <div class="st-nd-row"><select class="st-sel" value=${size} onChange=${e => setSize(e.target.value)} aria-label="Edit resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K final</option></select>
        <button class="btn sm" disabled=${!!busy || !ready} onClick=${() => { onEdit(a, { kind, area: boxed ? box : undefined, instruction: ins.trim(), size }); setOpen(false); setIns(''); setBox(null); }}>Edit (1 image at ${size})</button>
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
    const P = px(A), Q = px(B); const ar = EDIT_BOXED[ed.kind] ? ed.area : null; let so = 0, no = 0, si = 0, ni = 0, mv = 0;
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
      <b>${({ area: 'Area edit', remove: 'Removal', background: 'Background swap', relight: 'Relight', restyle: 'Restyle' })[ed.kind] || 'Edit'}</b> of v${from}${ed.instruction ? html`: "${ed.instruction}"` : ' (the marked area)'}.
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
  const LAYOUT_CODES = { text_overflow: 1, collision: 1, off_canvas: 1, safe_area: 1, text_too_wide: 1, duplicate_text: 1 };
  const MARK_FIX_CODES = /^(mark_low_contrast|mark_unreadable|mark_clear_space|mark_outside_region|mark_small|low_contrast|unreadable_contrast|patchy_contrast)$/;
  const fixableOf = val => !!(val && val.issues.some(i => LAYOUT_CODES[i.code] || MARK_FIX_CODES.test(i.code)));
  /* S11: one status hierarchy for a composition - Blocked (a blocking measurement, an incomplete mark, a failed filing), Needs
     review (warnings, unresolved pixels, no accepted measurement yet, an inconsistent inspection), Checks passed (the worker holds
     a passing measurement of exactly this composition), Approved (a person approved the design on it). Technical, the art
     director's opinion and human approval stay distinct underneath; this is the one word at the top. Nothing is hard-coded from
     a model. */
  const QUALITY_WORD = { blocked: 'Blocked', review: 'Needs review', passed: 'Checks passed', approved: 'Approved', unknown: 'Not measured' };
  const QUALITY_KIND = { blocked: 'bad', review: 'warn', passed: 'ok', approved: 'ok', unknown: '' };
  function qualityState(a, v, val) {
    const rd = a.readiness || {}; const appr = standing(a, 'design'); const ins = rd.inspection || { state: 'none' };
    if (v && v.mode === 'finished') { const b = rd.baked; const st = !v.image ? 'review' : b && b.verified ? (appr ? 'approved' : 'passed') : 'review'; return { state: st, word: QUALITY_WORD[st], kind: QUALITY_KIND[st], top: null, why: !v.image ? 'the bitmap is not generated yet' : b && b.verified ? '' : 'painted words and mark not read back yet' }; }
    const q = val ? R.qualityOf(val) : null;
    let state = q ? q.state : rd.technical === 'passed' ? 'passed' : rd.technical === 'failed' ? 'blocked' : 'unknown'; let why = '';
    if (v && v.layout && (v.layout.incomplete || []).length) { state = 'blocked'; why = 'the campaign mark is not on file'; }
    else if ((state === 'passed' || state === 'review') && rd.technical !== 'passed') { state = 'review'; why = rd.technical === 'failed' ? 'the worker holds a failing measurement of this composition' : rd.technical === 'stale' ? 'the recorded measurement is of an earlier composition' : 'the measurement is not accepted by the worker yet'; }
    // a person's approval on a composition the worker measured as passing is the top of the hierarchy; warnings and the Creative Director's opinion stay listed beneath it
    else if ((state === 'passed' || state === 'review') && appr) { state = 'approved'; why = q && q.warnings ? q.warnings + ' warning' + (q.warnings === 1 ? '' : 's') + ' to look at; approved by ' + appr.by : 'approved by ' + appr.by; }
    else if (state === 'passed' && ins.state === 'inconsistent') { state = 'review'; why = 'the Creative Director\'s verdict disagrees with the measurements'; }
    else if (state === 'blocked' && q && q.top) why = q.top.code.replace(/_/g, ' ') + (q.top.layers.length ? ' (' + q.top.layers.join(', ') + ')' : '');
    else if (state === 'review' && q) why = q.unresolved ? 'pixels not measured: ' + (val.unresolved || []).join(', ') : (q.warnings + ' to look at');
    return { state, word: QUALITY_WORD[state], kind: QUALITY_KIND[state], top: q ? q.top : null, blocking: q ? q.blocking : 0, warnings: q ? q.warnings : 0, why };
  }
  /** Under the artwork: the one quality word, the top issue (shown on the tile, with its remedy), the technical state and the free fixes. */
  const REPAIR_WORD = { complete: 'Fixed', partial: 'Partly fixed', blocked: 'Blocked', nothing: 'Nothing to fix' };
  /** The repair outcome in one line: what blocks before and after, and of which kind - only the kinds that are left are named. */
  function repairCounts(n) {
    if (!n || !n.counts) return '';
    const c = n.counts; const k = n.kinds || {}; const kinds = ['geometry', 'readability', 'brand', 'pending', 'other'].filter(x => k[x] > 0).map(x => k[x] + ' ' + x);
    if (!c.before && !c.after) return '';
    return (c.before === c.after ? c.before + ' blocking before and after' : c.before + ' blocking before, ' + c.after + ' after') + (c.after && kinds.length ? ' (' + kinds.join(', ') + ')' : '');
  }
  function ReadyStrip({ a, v, val, measuring, ro, onRepair, onUndoRepair, onMeasure, onDraft, repairing, repairNote, onDetail, highlight, onHighlight, onAction, onEditLayout, onVariations, varsOk, varsN, compact }) {
    const rd = a.readiness || {}; const t = measuring ? 'measuring' : rd.technical || 'not_validated';
    const blocking = val ? val.issues.filter(i => i.severity === 'blocking').length : 0; const warns = val ? val.issues.filter(i => i.severity !== 'blocking').length : 0;
    const q = qualityState(a, v, val); const top = q.top;
    const shown = top && Array.isArray(highlight) && top.layers.length && highlight.length === top.layers.length && top.layers.every(x => highlight.indexOf(x) >= 0);
    // the remedy for the top issue: a layout fix for geometry and readability, the imagery for a missing photograph, a file for a mark
    const act = !top ? null : (LAYOUT_CODES[top.code] || MARK_FIX_CODES.test(top.code)) ? { label: 'Fix layout (no render)', fn: onRepair } : top.code === 'imagery_missing' || top.code === 'imagery_sketch' ? { label: 'Generate the imagery (1 render)', fn: () => onAction && onAction('imagery') } : top.code === 'mark_unloaded' ? { label: 'Load the marks again', fn: onMeasure } : top.code === 'pixels_unmeasured' || top.code === 'mark_unmeasured' ? { label: 'Measure again', fn: onMeasure } : null;
    return html`<div class=${'st-ready st-readystrip ' + t + ' q-' + q.state + (compact ? ' compact' : '')} aria-label="Readiness">
      <div class="st-ready-row st-qrow"><span class=${'st-qstate ' + q.state} data-state=${q.state}>${measuring ? 'Measuring...' : q.word}</span>
        ${!measuring && top ? html`<span class="st-qtop"><${Chip} kind=${top.severity === 'blocking' ? 'bad' : 'warn'}>${top.code.replace(/_/g, ' ')}</${Chip}> ${top.layers.length ? html`<b>${top.layers.join(', ')}</b> ` : null}<span class="ov-dim">${top.detail}</span>${top.layers.length && onHighlight ? html` <button class="ov-link st-val-show" onClick=${() => onHighlight(top.layers)} aria-pressed=${shown ? 'true' : 'false'}>${shown ? 'hide on the tile' : 'show on the tile'}</button>` : null}${act && !ro ? html` <button class="btn sm st-qact" disabled=${repairing} onClick=${act.fn}>${act.label}</button>` : null}</span>` : !measuring && q.why ? html`<span class="ov-dim">${q.why}</span>` : null}</div>
      <div class="st-ready-row st-ready-tech"><b>Technical validation</b> <${Chip} kind=${measuring ? '' : TECH_KIND[rd.technical] || ''}>${measuring ? 'measuring at ' + (v.layout && v.layout.stage ? v.layout.stage.w + ' x ' + v.layout.stage.h : 'native size') + '...' : TECH_WORD[rd.technical] || rd.technical || 'not validated'}</${Chip}>
        ${val && !measuring ? html`<span class="ov-dim">${val.issues.length ? (blocking ? blocking + ' blocking' : '') + (blocking && warns ? ', ' : '') + (warns ? warns + ' to look at' : '') : 'no overflow, collisions, clipping, unreadable marks or missing files at the output size'}${val.unresolved && val.unresolved.length ? '; not measured: ' + val.unresolved.join(', ') : ''}</span>` : null}
        ${val && val.issues.length ? html`<button class="ov-link" onClick=${onDetail}>all checks</button>` : null}</div>
      ${!ro ? html`<div class="st-ready-acts">${fixableOf(val) && !(act && act.fn === onRepair) ? html`<button class="btn sm" disabled=${repairing} onClick=${onRepair} title="Fit boxes to their measured lines, restack, widen, move a mark, a bounded type step, a readable colour or a better approved mark variant - never the words; a layout version, no render">${repairing ? 'Fixing...' : 'Fix layout (no render)'}</button>` : null}<button class="btn sm ghost" disabled=${measuring} onClick=${onMeasure}>Measure again</button><button class="btn sm ghost" onClick=${onDraft} title="A PNG labelled as a draft: not validated production artwork">Download draft PNG</button></div>` : null}
      ${repairNote ? html`<div class=${'ov-dim st-repair-note' + (repairNote.conflict || repairNote.state === 'blocked' || repairNote.state === 'partial' ? ' warn' : '')} role="status" data-outcome=${repairNote.state}><b>${REPAIR_WORD[repairNote.state] || 'Fix layout'}.</b> ${repairCounts(repairNote) ? html`<span class="st-repair-counts">${repairCounts(repairNote)}.</span> ` : null}${repairNote.text}
        ${!ro && (repairNote.undo || ((repairNote.state === 'blocked' || repairNote.state === 'partial') && (onEditLayout || onVariations))) ? html`<span class="st-repair-acts">${repairNote.undo ? html`<button class="btn sm ghost" disabled=${repairing} onClick=${onUndoRepair} title="Restore the layout as it was before this fix, as a new version">Undo fix</button>` : null}${(repairNote.state === 'blocked' || repairNote.state === 'partial') && onEditLayout && !a.locks.layout ? html`<button class="btn sm ghost" onClick=${onEditLayout} title="Opens the canvas with handles: move the mark or the words by hand; a layout version, no render">Move it by hand</button>` : null}${(repairNote.state === 'blocked' || repairNote.state === 'partial') && onVariations && (varsOk == null || varsN > 0) ? html`<button class="btn sm ghost" onClick=${onVariations} title="Other arrangements of the same words, marks and imagery, each measured at the output size; free, no render">Layout variations${varsOk != null && varsN ? ' (' + varsOk + ' of ' + varsN + ' pass)' : ''}</button>` : null}</span>` : null}</div>` : null}
    </div>`;
  }
  /** What no layout move can fix, said with its remedy: imagery the composition expects but nobody has made yet, and a mark file
      that did not load. Generating the imagery is one render (paid, announced); a solid ground is a layout version, no render. */
  function Remedies({ a, v, val, ro, renderJob, lastRender, typeOnly, hidden, onGenerate, onSolid, onShow, onRetry, onRefresh }) {
    if (!val) return null;
    const missing = val.issues.some(i => i.code === 'imagery_missing'); const unloaded = val.issues.filter(i => i.code === 'mark_unloaded');
    if (!missing && !unloaded.length && !hidden) return null;
    const failed = lastRender && lastRender.state === 'failed' ? lastRender : null;
    return html`<div class="st-remedy" role="region" aria-label="What a layout cannot fix">
      ${hidden ? html`<div class="st-remedy-row st-remedy-hidden"><div><b>Imagery on file but not shown.</b> <span class="ov-dim">A render landed on this version (${(v.image || {}).model || 'image model'}${v.image && v.image.size ? ', ' + v.image.size : ''}), but ${hidden}. No layout move changes that; lifting it is a layout version, no render.</span></div>
        ${!ro ? html`<div class="st-remedy-acts"><button class="btn sm" onClick=${onShow} title="Lifts the type-only ground (or adds the background region) so the photograph is drawn under the words and marks. A layout version, no render.">Show the imagery (no render)</button></div>` : null}</div>` : null}
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
  /** Three things kept apart: the measured technical validation, the Creative Director's opinion, and a person's approval. */
  function Readiness({ p, a, v, val, highlight, onHighlight }) {
    const rd = a.readiness || {}; const ins = rd.inspection || { state: 'none' }; const appr = standing(a, 'design');
    const last = (p.thread || []).filter(e => e.kind === 'inspection' && e.asset === a.id).pop();
    const shown = ids => Array.isArray(highlight) && ids.length && ids.every(x => highlight.indexOf(x) >= 0) && highlight.length === ids.length;
    return html`<div class="st-readydetail" aria-label="Quality">
      ${rd.finished ? html`<div class="ov-dim">Finished creative: one bitmap painted by the image model. There are no layers to measure, so the technical validation does not apply; what stands in its place is the Creative Director reading every painted word and the mark back from this exact image.</div>` : null}
      <div class="st-ready-row"><b>Technical validation</b> <${Chip} kind=${TECH_KIND[rd.technical] || ''}>${TECH_WORD[rd.technical] || rd.technical || 'not validated'}</${Chip}>${rd.validation ? html` <span class="ov-dim">${aest(rd.validation.at)}, ${rd.validation.who}</span>` : null}</div>
      ${val ? html`<ul class="st-vallist st-val">${val.issues.length ? val.issues.map((i, k) => html`<li key=${k} class=${shown(i.layers) ? 'st-val-on' : ''}><${Chip} kind=${i.severity === 'blocking' ? 'bad' : i.severity === 'warning' ? 'warn' : ''}>${i.code.replace(/_/g, ' ')}</${Chip}> ${i.layers.length ? html`<b>${i.layers.join(', ')}</b> ` : null}<span class="ov-dim">${i.detail}</span>${i.layers.length && onHighlight ? html` <button class="ov-link st-val-show" onClick=${() => onHighlight(i.layers)} aria-pressed=${shown(i.layers) ? 'true' : 'false'}>${shown(i.layers) ? 'hide on the tile' : 'show on the tile'}</button>` : null}</li>`) : html`<li><span class="ov-dim">No collisions, overflow, clipping or missing assets measured at the output size.</span></li>`}${val.fonts ? html`<li class="ov-dim">Fonts: ${Object.keys(val.fonts.roles || {}).map(k => k + ' ' + val.fonts.roles[k].used + (val.fonts.roles[k].fallback ? ' (asked ' + val.fonts.roles[k].requested + ')' : '')).join('; ') || 'none needed'}</li>` : null}</ul>` : null}
      ${rd.technical && rd.technical !== 'passed' && rd.reasons && rd.reasons.length ? html`<div class="ov-dim">${rd.reasons.join(' ')}</div>` : null}
      <div class="st-ready-row"><b>Art direction</b> <${Chip} kind=${ins.state === 'ship' ? 'ok' : ins.state === 'inconsistent' || ins.state === 'redo' ? 'bad' : ins.state === 'none' ? '' : 'warn'}>${INS_WORD[ins.state] || ins.state}</${Chip}>${rd.baked ? html` <${Chip} kind=${rd.baked.verified ? 'ok' : 'warn'} title=${rd.baked.why || ''}>${rd.baked.verified ? 'painted words' + ((rd.baked.marks || []).length ? ' and ' + rd.baked.marks.join(' and ') : '') + ' read back' : 'painted words' + ((rd.baked.marks || []).length ? ' and ' + rd.baked.marks.join(' and ') : '') + ' not verified'}</${Chip}>` : null}</div>
      ${rd.baked && !rd.baked.verified ? html`<div class="ov-dim">${rd.baked.why}</div>` : null}
      ${last && last.scores ? html`<div class="st-insp-mini" aria-label="Latest inspection"><div class="st-insp-scores">${['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'].map(k => html`<span key=${k} class=${'st-insp-score s' + (last.scores[k] == null ? 'n' : last.scores[k])} title=${(last.reasons || {})[k] || ''}>${k} <b>${last.scores[k] == null ? 'not scored' : last.scores[k]}</b></span>`)}</div>
        <div class="ov-dim">Verdict ${last.verdict}, round ${last.round} of ${last.of || 2}${(() => { const vn = a.versions.findIndex(x => x.id === last.version) + 1; return vn ? ', on v' + vn + (last.version !== a.current ? ' (an earlier version)' : '') : ''; })()}. The critique, its reasons and the offered correction are in the Creative Director tab. An opinion: it never approves.</div></div>` : html`<div class="ov-dim">No inspection of this asset yet. One runs after each render; it is advice and never approves.</div>`}
      <div class="st-ready-row"><b>Human approval</b> <${Chip} kind=${appr ? 'ok' : ''}>${appr ? 'design approved by ' + appr.by : 'design not approved'}</${Chip}>${appr && rd.technical !== 'passed' && rd.technical !== 'not_applicable' ? html` <span class="ov-dim">the approval stands, but export waits for a passing validation</span>` : null}</div>
    </div>`;
  }
  /** The Refine workspace: the artwork, sized to the screen, with the free fixes under it and the design tools below; the
      words, the quality record, approvals and versions are in the inspector beside it (rendered there through a portal). */
  /** A finished creative under the artwork: what it is, what it is waiting for, and its two ways forward - regenerate the whole piece
      (one image generation, announced) or derive an editable asset (free). Painted words are shown for regeneration, never retyped in place. */
  function FinishedPanel({ p, a, v, ro, busy, renderJob, lastRender, onRegenerate, onDerive, onRetry }) {
    const rd = a.readiness || {}; const b = rd.baked || null; const ins = rd.inspection || { state: 'none' };
    const [open, setOpen] = useState(false); const [copy, setCopy] = useState({}); const [ins2, setIns] = useState(''); const [size, setSize] = useState((v.image && v.image.size) || (v.context || {}).size || '2K');
    useEffect(() => { setCopy({}); setIns(''); setOpen(false); }, [v.id]);
    const roles = ((v.layout || {}).baked || ['headline', 'support', 'cta']).filter(r => r !== 'logo' && r !== 'wordmark'); const marks = ((v.layout || {}).baked || []).filter(r => r === 'logo' || r === 'wordmark');
    const changed = Object.keys(copy).filter(k => copy[k] != null && copy[k] !== (v.copy[k] || ''));
    const failed = lastRender && lastRender.state === 'failed' ? lastRender : null;
    const go = () => { const o = { copy: {}, instruction: ins2.trim(), size }; changed.forEach(k => { o.copy[k] = copy[k]; }); if (!changed.length && !o.instruction) return; if (!window.confirm('Regenerate ' + a.title + ' as a finished creative? One image generation at ' + size + ': the whole piece is painted again' + (changed.length ? ' with the new ' + changed.join(', ') : '') + (marks.length ? ', the ' + marks.join(' and ') + ' file attached again' : '') + '. The current version stays until the new one lands; approvals do not carry to a new bitmap.')) return; onRegenerate(a, o); setOpen(false); };
    return html`<div class="st-remedy st-finished" role="region" aria-label="Finished creative">
      <div class="st-remedy-row"><div><b>Finished creative</b> <${Chip} kind=${!v.image ? 'warn' : b && b.verified ? 'ok' : 'warn'}>${!v.image ? 'not generated yet' : b && b.verified ? 'words and ' + (marks.join(' and ') || 'mark') + ' read back' : 'not read back yet'}</${Chip}>
        <span class="ov-dim">${!v.image ? (renderJob ? (renderJob.state === 'running' ? 'The image model is painting it now.' : 'A render is queued.') : failed ? 'The render failed.' : 'No render is running.') : b && b.verified ? 'The Creative Director read every painted word' + (marks.length ? ' and compared the ' + marks.join(' and ') + ' with its file' : '') + '. Approval is still a person\'s decision (Review).' : 'Technical validation does not apply to a bitmap. Design approval waits for the Creative Director to read the ' + roles.join(', ') + (marks.length ? ' and the ' + marks.join(' and ') : '') + ' back from this exact image: press Review in the Creative Director panel.' + (b && !b.verified && ins.state !== 'none' ? ' Last reading: ' + b.why + '.' : '')}</span>
        ${failed ? html`<div class="st-remedy-fail"><${Chip} kind="bad">last render failed</${Chip}> <span class="ov-dim">${explain({ message: failed.error, code: (String(failed.error).match(/^[a-z_0-9]+/) || [''])[0] }).title}</span></div>` : null}</div>
        ${!ro ? html`<div class="st-remedy-acts">${failed && !v.image ? html`<button class="btn sm" disabled=${!!busy} onClick=${() => onRetry(failed)}>Retry the render (1 render)</button>` : null}<button class="btn sm" disabled=${!!busy || !!renderJob} onClick=${() => setOpen(!open)} aria-expanded=${open}>Regenerate (1 render)...</button><button class="btn sm ghost" disabled=${!!busy} title="A derived asset in the editable mode: the words as live type, the mark placed from its file exactly; this finished original is kept" onClick=${() => { if (window.confirm('Switch to the editable Studio? A new asset is derived from this one: the words become live type again and the ' + (marks.join(' and ') || 'mark') + ' is placed from its file exactly. The painted bitmap is not reused as the ground (its lettering is part of it); the imagery is generated only when you ask. This finished creative stays as it is. No model call.')) onDerive(a, {}); }}>Switch to Editable (free)</button></div>` : null}</div>
      ${open && !ro ? html`<div class="st-regen" aria-label="Regenerate the finished creative">
        <div class="ov-dim">New words replace the painted ones in the next bitmap; a direction alone continues from the current picture. Figures must come from the approved facts.</div>
        ${roles.map(k => html`<div key=${k} class="st-field"><label class="st-lbl" for=${'st-rg-' + k}>${k}${a.locks[k] ? ' (locked)' : ''}</label><input class="st-in" id=${'st-rg-' + k} disabled=${!!a.locks[k]} value=${copy[k] != null ? copy[k] : (v.copy[k] || '')} onInput=${e => setCopy(Object.assign({}, copy, { [k]: e.target.value }))} /></div>`)}
        <div class="st-field"><label class="st-lbl" for="st-rg-ins">Direction (optional)</label><input class="st-in" id="st-rg-ins" value=${ins2} placeholder="e.g. warmer light, the mark larger, more sky" onInput=${e => setIns(e.target.value)} /></div>
        <div class="st-nd-row"><label class="ov-dim">Resolution <select class="st-sel" value=${size} onChange=${e => setSize(e.target.value)} aria-label="Resolution"><option value="1K">1K draft</option><option value="2K">2K</option><option value="4K">4K</option></select></label><button class="btn sm" disabled=${!!busy || (!changed.length && !ins2.trim())} onClick=${go}>Regenerate now (1 render at ${size})</button><button class="btn sm ghost" onClick=${() => setOpen(false)}>Cancel</button></div>
      </div>` : null}
    </div>`;
  }
  /** The rule a mark layer carries, in words with its provenance: a mandatory campaign rule, a preferred one, a placement observed
      on approved references, or the house default. Nothing here is inferred by a model. */
  function ruleWords(l, layout) {
    const r = l && l.rule; const mp = (layout || {}).markPlacement || {};
    if (r && r.mandatory) return { kind: 'rule', label: 'Mandatory campaign rule', text: (r.corner ? 'corner ' + r.corner : '') + (r.region ? (r.corner ? ', ' : '') + 'region ' + r.region.x + ',' + r.region.y + ' to ' + (r.region.x + r.region.w) + ',' + (r.region.y + r.region.h) + '% of the stage' : '') + (r.clearSpace != null ? '; clear space ' + Math.round(r.clearSpace * 100) + '% of the mark\'s height' : '; clear space the house default (50% of the mark\'s height)') + (r.minWidth != null ? '; at least ' + r.minWidth + '% of the width' : '') + (r.note ? '. ' + r.note : '') };
    if (r) return { kind: 'preferred', label: r.basis === 'inferred' ? 'Inferred preference' : 'Preferred placement', text: (r.corner ? 'corner ' + r.corner : 'a region') + (r.note ? '. ' + r.note : '') + '. A preference: a warning when broken, never a hold.' };
    if (mp.basis === 'observed') return { kind: 'observed', label: 'Observed on approved references', text: 'corner ' + (mp.corner || '') + (mp.text ? '. ' + mp.text : '') + '. Not a rule: Teach this brand (Brand view) makes it one.' };
    return { kind: 'default', label: 'House default', text: 'corner ' + (mp.corner || 'br') + '; clear space 50% of the mark\'s height; at least 6% of the width. No campaign rule stands.' };
  }
  /** Properties for the selection when the editor is closed: a mark (variant, position and size with the aspect locked, clear space,
      the placement rule with its provenance, local readability from the measurement, a region offered from the pixels), a text layer
      (typography and box), an image (framing), or nothing (the composition's facts). Each change is one layout version, no render. */
  function StaticProps({ a, v, ids, val, comp, kit, ro, tagText, onPatch, onEditLayout, onHighlight, infoOnly, dirty }) {
    const L = v.layout || {}; const layers = L.layers || []; const one = ids.length === 1 ? layers.find(l => l.id === ids[0]) : null;
    const box = one && val ? (val.boxes || []).find(b => b.id === one.id) : null;
    const isMark = one && one.type === 'img' && (one.role === 'logo' || one.role === 'wordmark');
    const held = isMark && one.rule && one.rule.mandatory; const locked = one && one.locked; const canMove = !ro && !a.locks.layout && one && !locked && !held && !dirty;
    const num = (k, lb, patchFn) => html`<label key=${k}>${lb} <input class="st-in" type="number" step="0.5" value=${one[k] == null ? 0 : one[k]} disabled=${!canMove} onChange=${e => { const n = +e.target.value; if (isFinite(n)) patchFn(n); }} aria-label=${lb + ', per cent of the stage'} /></label>`;
    const r1 = x => Math.round(x * 10) / 10;
    // the band behind the mark when the footer is painted into the photograph: pixel evidence with a confidence, offered and never applied by itself
    const region = useMemo(() => { if (!isMark || !comp || !comp.ready || !comp.imgs.bg || !R.markRegion) return null; try { return R.markRegion(L, v.copy, comp.imgs, one.id); } catch (e) { return null; } }, [isMark && one && one.id, comp && comp.key, comp && comp.ready, v.id]);
    const stage = L.stage || { w: 1080, h: 1080 };
    if (!one) return html`<div class="st-props-none">
      <div class="st-field"><${Lbl}>This composition</${Lbl}><div class="ov-dim">${tagText}</div><div class="ov-dim">${stage.w} x ${stage.h} px; ${layers.length} layer${layers.length === 1 ? '' : 's'}${layers.filter(l => l.hidden).length ? ' (' + layers.filter(l => l.hidden).length + ' hidden)' : ''}${layers.filter(l => l.locked).length ? '; ' + layers.filter(l => l.locked).length + ' locked' : ''}${a.locks && a.locks.layout ? '; layout locked' : ''}.</div></div>
      ${v.image && v.image.url ? html`<div class="st-field"><${Lbl}>Framing</${Lbl}><div class="ov-dim">${(() => { const f = L.imageFocus || {}; return 'focus ' + (f.x == null ? 50 : f.x) + '% across, ' + (f.y == null ? 50 : f.y) + '% down, zoom ' + (f.zoom || 1) + 'x'; })()}${!ro && !a.locks.layout && onEditLayout ? html` <button class="ov-link" onClick=${onEditLayout}>frame by dragging</button>` : null}</div></div>` : null}
      ${infoOnly ? null : html`<div class="ov-dim">Select a layer on the canvas or in the Layers tool, or an issue's "show on the tile", to see its properties.</div>`}
    </div>`;
    const rw = isMark ? ruleWords(one, L) : null;
    if (infoOnly && !isMark) return null;
    return html`<div class="st-props-one" data-layer=${one.id}>
      <div class="st-props-head"><b>${one.role || one.type}</b> <span class="ov-dim">${one.id}</span>${locked ? html` <${Chip} kind="warn">locked</${Chip}>` : null}${held ? html` <${Chip} title="held by the mandatory campaign rule">held by the rule</${Chip}>` : null}${onHighlight ? html` <button class="ov-link" onClick=${() => onHighlight([one.id])}>show on the tile</button>` : null}</div>
      ${isMark ? html`
        ${Array.isArray(one.variants) && one.variants.length > 1 ? html`<div class="st-field"><label class="st-lbl" for="st-prop-variant">Approved variant</label><select class="st-sel" id="st-prop-variant" value=${one.variant || (one.variants.find(x => x.src === one.src) || {}).variant || ''} disabled=${ro || a.locks.layout || locked || dirty} onChange=${e => { const x = one.variants.find(y => y.variant === e.target.value); if (x) onPatch(one.id, { src: x.src, variant: x.variant }, 'mark variant ' + x.variant + ' chosen by hand (no render)'); }}>${one.variants.map(x => html`<option key=${x.variant} value=${x.variant}>${x.variant}${x.tone ? ' (' + x.tone + ')' : ''}</option>`)}</select><div class="ov-dim">The approved files only, placed exactly; never redrawn, recoloured, outlined or shadowed.</div></div>` : html`<div class="ov-dim">One approved file for this mark${one.src ? '' : ' - none on file'}.</div>`}
        ${infoOnly ? (dirty ? html`<div class="ov-dim">Save or discard the layout changes on the canvas to change the variant or move the mark from here.</div>` : null) : html`<div class="st-le-type" aria-label="Position and size"><span class="st-lbl">Box</span>
          ${num('x', 'X', n => onPatch(one.id, { x: r1(n) }, 'moved the ' + one.role))}${num('y', 'Y', n => onPatch(one.id, { y: r1(n) }, 'moved the ' + one.role))}
          ${num('w', 'Width', n => { const w = Math.max(1, r1(n)); onPatch(one.id, { w, h: r1(Math.max(1, (one.h || 1) * (w / (one.w || 1)))) }, 'resized the ' + one.role); })}
          <span class="ov-dim" title="An exact image keeps its proportions: the height follows the width">aspect locked</span>
          ${box && typeof box.vw === 'number' ? html`<span class="ov-dim">ink ${Math.round(box.vw)} x ${Math.round(box.vh)} px${typeof box.markFill === 'number' ? ' (' + Math.round(box.markFill * 100) + '% of the box)' : ''}</span>` : null}
        </div>`}
        <div class="st-field st-prop-rule" data-basis=${rw.kind}><${Lbl}>Placement</${Lbl}><div><b>${rw.label}</b> <span class="ov-dim">${rw.text}</span></div>
          ${box && typeof box.clearWant === 'number' ? html`<div class="ov-dim">Clear space wanted: ${Math.round(box.clearWant)} px around the visible mark (${Math.round((box.clearShare || 0.5) * 100)}% of its height${box.ruleBasis === 'rule' ? ', from the campaign rule' : ', the house default'}).</div>` : null}</div>
        <div class="st-field st-prop-read"><${Lbl}>Local readability</${Lbl}>
          ${box && typeof box.inkLost === 'number' ? html`<div class=${'st-readfig' + (box.inkLost >= 0.12 ? ' bad' : box.inkLost >= 0.04 ? ' warn' : '')}><b>${Math.round(box.inkLost * 100)}%</b> of the strokes do not read where they sit${box.inkWhere ? ' (the ' + box.inkWhere + ')' : ''}${box.inkBoundary ? '; the mark crosses a light/dark boundary' : ''}${typeof box.inkCovered === 'number' && box.inkCovered >= 0.05 ? '; ' + Math.round(box.inkCovered * 100) + '% painted over by later layers' : ''}. Worst local contrast ${typeof box.inkLocal === 'number' ? box.inkLocal.toFixed(2) : '-'}:1, mean ${typeof box.inkMean === 'number' ? box.inkMean.toFixed(2) : '-'}:1${typeof box.inkWeak === 'number' && box.inkWeak > 0 ? '; ' + Math.round(box.inkWeak * 100) + '% weak' : ''}. Measured per pixel against what is behind each stroke, not an average.</div>` : html`<div class="ov-dim">${val ? 'Not measured per pixel yet (the mark may not have loaded).' : 'Measuring...'}</div>`}
          ${region ? html`<div class="st-prop-region"><span class="ov-dim">Found from the pixels: a flat ${region.tone || ''} band at ${Math.round(region.y)}% to ${Math.round(region.y + region.h)}% of the stage (confidence ${Math.round(region.confidence * 100)}%: ${region.note}).</span>${canMove ? html` <button class="btn sm ghost" onClick=${() => { const y = r1(region.h >= (one.h || 0) ? region.y + (region.h - (one.h || 0)) / 2 : region.y); onPatch(one.id, { y }, 'moved the ' + one.role + ' into the band found behind it (offered from the pixels, confidence ' + Math.round(region.confidence * 100) + '%)'); }}>Move into this band</button>` : null}</div>` : null}
        </div>`
      : one.type === 'text' ? html`
        <div class="st-le-type" aria-label="Typography"><span class="st-lbl">Type</span>
          <label>Size <input class="st-in" type="number" step="0.1" min="1" max="20" value=${one.size} disabled=${!canMove} onChange=${e => onPatch(one.id, { size: r1(Math.max(1, +e.target.value || one.size)) }, 'type size of the ' + one.role)} aria-label="Type size, per cent of the width" /></label>
          <label>Weight <select class="st-sel" value=${String(one.weight || 600)} disabled=${!canMove} onChange=${e => onPatch(one.id, { weight: +e.target.value }, 'weight of the ' + one.role)} aria-label="Weight">${[400, 500, 600, 700, 800, 900].map(w => html`<option key=${w} value=${String(w)}>${w}</option>`)}</select></label>
          <label>Align <select class="st-sel" value=${one.align || 'left'} disabled=${!canMove} onChange=${e => onPatch(one.id, { align: e.target.value }, 'alignment of the ' + one.role)} aria-label="Text alignment"><option value="left">left</option><option value="center">centre</option><option value="right">right</option></select></label>
          <label>Colour <input class="st-in" value=${one.color || '#ffffff'} disabled=${!canMove} onChange=${e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value)) onPatch(one.id, { color: e.target.value }, 'colour of the ' + one.role); }} aria-label="Colour" /></label>
          <label>Emphasis <select class="st-sel" value=${one.emphasis || ''} disabled=${!canMove} onChange=${e => onPatch(one.id, { emphasis: e.target.value || undefined }, 'emphasis of the ' + one.role)} aria-label="Emphasis"><option value="">none</option><option value="caps">caps</option><option value="highlight">highlight</option><option value="underline">underline</option><option value="box">box</option></select></label>
          ${one.bg && one.emphasis === 'box' ? html`<span class="ov-dim">a filled plate and a box outline together: one device is enough</span>` : null}
        </div>
        <div class="st-le-type" aria-label="Position and size"><span class="st-lbl">Box</span>${num('x', 'X', n => onPatch(one.id, { x: r1(n) }, 'moved the ' + one.role))}${num('y', 'Y', n => onPatch(one.id, { y: r1(n) }, 'moved the ' + one.role))}${num('w', 'Width', n => onPatch(one.id, { w: r1(Math.max(1, n)) }, 'resized the ' + one.role))}${num('h', 'Height', n => onPatch(one.id, { h: r1(Math.max(1, n)) }, 'resized the ' + one.role))}
          ${box ? html`<span class="ov-dim">${box.lines || 1} line${box.lines === 1 ? '' : 's'}${typeof box.contrast === 'number' ? ', contrast ' + box.contrast.toFixed(1) + ':1' : ''}${typeof box.contrastMin === 'number' ? ' (worst patch ' + box.contrastMin.toFixed(1) + ':1)' : ''}</span>` : null}</div>`
      : one.type === 'img' ? html`<div class="st-field"><${Lbl}>Framing</${Lbl}><div class="ov-dim">${(() => { const f = one.focus || {}; return 'focus ' + (f.x == null ? 50 : f.x) + '% across, ' + (f.y == null ? 50 : f.y) + '% down, zoom ' + (f.zoom || 1) + 'x'; })()}${canMove && onEditLayout ? html` <button class="ov-link" onClick=${onEditLayout}>frame by dragging</button>` : null}</div></div>`
      : html`<div class="st-le-type" aria-label="Position and size"><span class="st-lbl">Box</span>${num('x', 'X', n => onPatch(one.id, { x: r1(n) }, 'moved the ' + (one.role || one.type)))}${num('y', 'Y', n => onPatch(one.id, { y: r1(n) }, 'moved the ' + (one.role || one.type)))}${num('w', 'Width', n => onPatch(one.id, { w: r1(Math.max(1, n)) }, 'resized the ' + (one.role || one.type)))}${num('h', 'Height', n => onPatch(one.id, { h: r1(Math.max(1, n)) }, 'resized the ' + (one.role || one.type)))}${one.type === 'shape' ? html`<label>Opacity <input class="st-in" type="number" step="0.05" min="0" max="1" value=${one.opacity == null ? 1 : one.opacity} disabled=${!canMove} onChange=${e => onPatch(one.id, { opacity: Math.round(Math.max(0, Math.min(1, +e.target.value)) * 100) / 100 }, 'opacity of the ' + (one.role || 'panel'))} aria-label="Panel opacity" /></label>` : null}</div>`}
      ${!ro && !a.locks.layout && !infoOnly ? html`<div class="ov-dim st-props-foot">Each change saves as one layout version, no render.${locked ? ' Unlock the layer in the Layers list to change it.' : held ? ' The campaign rule holds this mark; the words move around it.' : ' Drag, align or resize it on the canvas.'}</div>` : null}
    </div>`;
  }
  /** The Brand tab: what this asset's campaign requires and holds - the mark policy and identity, the placement rule with its provenance,
      the mark files on file (variants), the marks on this composition - and the way to the Brand workspace. Reads the kit; writes nothing. */
  function BrandTab({ p, a, v, kit, onBrand, onContext }) {
    const camp = kit && (kit.campaigns || []).find(c => c.id === p.campaign) || null; const L = (v && v.layout) || {};
    const marks = (L.layers || []).filter(l => l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark'));
    const pol = camp ? (camp.logoPolicy || 'logo') : 'logo';
    return html`<div class="st-brandtab">
      <div class="st-field"><${Lbl}>Campaign</${Lbl}><div><b>${camp ? camp.name : p.campaign || 'none'}</b>${camp && camp.identity ? html` <span class="ov-dim">${camp.identity}</span>` : null}</div>
        <div class="ov-dim">Mark policy: <b>${pol}</b>${pol === 'wordmark' ? ' - the campaign wordmark, never the client logo' : pol === 'none' ? ' - no mark' : pol === 'both' ? ' - the client logo and the campaign wordmark' : ' - the client logo'}.</div></div>
      <div class="st-field"><${Lbl}>Placement rule</${Lbl}>${(() => { const r = camp && camp.markRule; if (r) { const w = ruleWords({ rule: Object.assign({ basis: r.mandatory ? 'rule' : 'preferred' }, r) }, L); return html`<div data-basis=${w.kind}><b>${w.label}</b> <span class="ov-dim">${w.text}</span></div>`; } const mp = L.markPlacement || {}; return html`<div data-basis=${mp.basis === 'observed' ? 'observed' : 'default'}><b>${mp.basis === 'observed' ? 'Observed on approved references' : 'House default'}</b> <span class="ov-dim">${mp.basis === 'observed' ? 'corner ' + (mp.corner || '') + (mp.text ? '. ' + mp.text : '') + '. No rule stands: the Brand view can teach one from the evidence.' : 'corner ' + (mp.corner || 'br') + '. No campaign rule and no reference evidence.'}</span></div>`; })()}</div>
      <div class="st-field"><${Lbl}>Marks on file</${Lbl}>
        ${kit && kit.hasLogo ? html`<div>Client logo${kit.logoV ? html` <span class="ov-dim">version ${kit.logoV}</span>` : null}${pol === 'wordmark' ? html` <${Chip} kind="warn" title="the campaign policy excludes it">must not appear here</${Chip}>` : null}</div>` : html`<div class="ov-dim">No client logo on file.</div>`}
        ${camp && Array.isArray(camp.wordmarks) && camp.wordmarks.length ? camp.wordmarks.map(w => html`<div key=${w.variant}>Wordmark <b>${w.variant}</b> <span class="ov-dim">${w.tone || ''}${w.v ? ', version ' + w.v : ''}${camp.wordmarkDefault === w.variant ? ', default' : ''}</span></div>`) : camp && camp.hasWordmark ? html`<div>Wordmark <span class="ov-dim">(single file, no variants)</span></div>` : pol !== 'logo' && pol !== 'none' ? html`<div class="ov-dim">No campaign wordmark on file${pol === 'wordmark' ? ': production cannot complete the mark' : ''}.</div>` : null}
      </div>
      <div class="st-field"><${Lbl}>On this composition</${Lbl}>${marks.length ? marks.map(l => html`<div key=${l.id}>${l.role} <span class="ov-dim">${l.variant ? 'variant ' + l.variant + ', ' : ''}${l.rule ? (l.rule.mandatory ? 'held by the campaign rule' : 'preferred placement') : 'no rule on the layer'}${l.locked ? ', locked' : ''}</span></div>`) : html`<div class="ov-dim">${v && v.mode === 'finished' ? 'Painted into the bitmap by the image model; read back by the Creative Director.' : 'No mark layer.'}</div>`}</div>
      <div class="st-nd-row">${onBrand ? html`<button class="btn sm ghost" onClick=${onBrand}>Open the Brand workspace</button>` : null}${onContext ? html`<button class="btn sm ghost" onClick=${onContext}>Client context</button>` : null}</div>
      <div class="ov-dim">Knowledge is per client and per campaign: another client's or another campaign's marks, facts and references never reach this project.</div>
    </div>`;
  }
  /* S18: the Design dock - five stable tools down the left of the canvas, each opening its panel beside it (never scrolling the
     page): Design (layout variations, styles, resize), Text (the words), Images (generation, art direction, area edits), Brand (the
     campaign identity), Layers. The creation mode is stated under them. Nothing here runs anything paid on its own. The Creative
     Director is the right panel, not a tool. */
  function DesignDock({ tool, ro, canVary, canEdit, hasLayout, finished, flat, onTool, onEditable }) {
    const tools = [
      ['design', 'Design', canVary ? 'Layout variations, style variations and other formats of these words, marks and imagery: free, measured, no model call' : finished ? 'A finished creative is one bitmap: its layout is not editable' : 'No layout variations for this version', false],
      ['text', 'Text', 'The words on this creative, edited as a text version (no render); the checks on them', false],
      ['images', 'Images', finished ? 'A finished creative is regenerated whole (under the canvas); the preservation record of edits' : flat ? 'A flattened legacy tile has no imagery controls' : 'Imagery: generate, re-render, art direction, edit an area - each states its cost first', false],
      ['brand', 'Brand', 'The campaign identity: mark policy, marks on file, placement rule', false],
      ['layers', 'Layers', hasLayout ? (canEdit ? 'Every layer front to back: select, hide, lock, reorder' : 'The layers (the layout is locked or read-only)') : 'A finished creative or a flattened tile has no layers', !hasLayout],
    ];
    return html`<nav class="st-dock" role="toolbar" aria-label="Design tools" aria-orientation="vertical">
      ${tools.map(([k, l, t, off]) => html`<button key=${k} class=${'st-dock-btn' + (tool === k ? ' on' : '')} aria-pressed=${tool === k} aria-controls=${tool === k ? 'st-library' : undefined} disabled=${off} title=${t} onClick=${() => onTool(k)}><span class="st-dock-ic"><${Icon} n=${k} size=${18} /></span><span class="st-dock-l">${l}</span></button>`)}
      <div class="st-dock-mode" title=${finished ? 'Finished creative: one bitmap painted by the image model, words and mark included' : 'Editable: imagery generated, words and the exact mark composed as live layers'}>
        <span class="st-lbl">Mode</span><b>${finished ? 'AI finished' : flat ? 'Legacy' : 'Editable'}</b>
        ${finished && !ro ? html`<button class="ov-link" onClick=${onEditable} title="Make an editable copy: words as live type, the mark placed from its file; free, no render; this finished creative stays">make editable</button>` : null}
      </div>
    </nav>`;
  }
  /** S18: the page strip under the canvas - every visual piece of the project in family order, the current one marked, with the
      carousel frame or the master it was adapted from named; one click opens a piece on the same canvas. */
  function PageStrip({ p, a, onOpen }) {
    const list = p.assets.filter(x => { const v = current(x); return v && v.mode !== 'copy'; });
    if (!list.length) return null;
    const fams = []; list.forEach(x => { if (fams.indexOf(x.family) < 0) fams.push(x.family); });
    const frameOf = x => { const xv = current(x); return xv && xv.layout && xv.layout.frame ? xv.layout.frame.index + 1 : null; };
    return html`<nav class="st-pagestrip" aria-label="Pages in this project">${fams.map(f => html`<div key=${f} class="st-pagefam" role="group" aria-label=${f}>${list.filter(x => x.family === f).sort((x, y) => (frameOf(x) || 99) - (frameOf(y) || 99) || x.created - y.created).map(x => { const m = (current(x) || {}).context || {}; const master = m.master ? p.assets.find(y => y.id === m.master) : null; return html`<button key=${x.id} class=${'st-pagechip st-assetpick' + (x.id === a.id ? ' on' : '')} aria-current=${x.id === a.id ? 'page' : undefined} onClick=${() => onOpen && onOpen(x.id)} title=${x.title + ' - ' + f + (master ? ', adapted from ' + master.title : '') + (frameOf(x) ? ', frame ' + frameOf(x) : '')}><${Composition} v=${current(x)} a=${x} ns=${p.ns} size="mini" /><span class="st-pagechip-l"><span class="st-pagechip-t">${frameOf(x) ? frameOf(x) + '. ' : ''}${x.title}</span><span class="st-pagechip-f">${(FORMATS[x.format] || {}).label || x.format}</span></span>${validOf(x) ? html`<span class="st-dot ok" aria-label="passes its checks"></span>` : null}</button>`; })}</div>`)}</nav>`;
  }
  function AssetView({ p, a, kit, sel, setSel, onEdit, onDraftState, onLayoutDirty, onUndoRepair, onLayout, onLayoutSave, onLock, onApprove, onCompare, onRestore, onRender, onPropose, onApplyConcept, sugg, onSuggRefresh, busy, onOpen, onValidate, onRepair, onMarkVariant, onAreaEdit, onRegenerate, onDerive, onPreservation, onVariant, onRetryJob, slot, tab, setTab, tool, setTool, conflict, onConflict, neighbours, preview, setPreview, onBrand, onContext, onSelection, onResize, resized }) {
    const v = current(a);
    const [zoom, setZoom] = useState('fit'); const [rr, setRr] = useState(null); const [edKey, setEdKey] = useState(0);
    // S11: the canvas controls - overlays (guides, outlines, subject marks), the optional checkerboard, full screen - and the layer selection
    const [overlays, setOverlaysRaw] = useState(() => { try { return localStorage.getItem('ax_studio_guides') === '1'; } catch (e) { return false; } }); // S18: guides off by default; the choice is remembered per browser
    const setOverlays = x => setOverlaysRaw(o => { const n = typeof x === 'function' ? x(o) : x; try { localStorage.setItem('ax_studio_guides', n ? '1' : '0'); } catch (e) {} return n; }); const [checker, setChecker] = useState(false); const [full, setFull] = useState(false);
    const [layerSel, setLayerSel] = useState([]); useEffect(() => { setLayerSel([]); }, [a.id]);
    useEffect(() => { if (onSelection) onSelection(layerSel); }, [layerSel.join(',')]);
    useEffect(() => () => { if (onSelection) onSelection([]); }, []);
    const [propsSlot, setPropsSlot] = useState(null); const [layersSlot, setLayersSlot] = useState(null);
    useEffect(() => { if (!full) return; const h = e => { if (e.key === 'Escape') setFull(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [full]);
    // opening the editor, or selecting a layer, opens the Properties tab: that is where the selection's controls are
    const pickLayer = ids => { setLayerSel(ids); if (ids.length) { if (tab !== 'director') setTab('properties'); setHlIds(ids.slice()); } };
    // S9: the layers an issue names, outlined on the tile while the issue is shown; cleared when the version moves
    const [hlIds, setHlIds] = useState([]); useEffect(() => { setHlIds([]); }, [a.current]);
    const toggleHl = ids => setHlIds(cur => { const same = cur.length === ids.length && ids.every(x => cur.indexOf(x) >= 0); return same ? [] : ids.slice(); });
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
    // a finished creative is one bitmap: no layers to lay out, measure or vary; its words are regenerated, never typed over
    const finished = v && v.mode === 'finished';
    const fields = [['headline', copyOnly ? 'Hook line' : 'Headline'], ['support', 'Support line'], ['cta', 'Call to action'], ['caption', 'Caption (' + chanLabel(a.channel) + ', ' + (copy.caption || '').length + ' of ' + ((CHANNELS[a.channel] || {}).max || 900) + ')'], ['alt', 'Alt text']];
    if (!v) return html`<div class="st-centre-pad"><div class="ov-empty" role="alert">${a.currentMissing ? 'The current version of this asset could not be found. Nothing older is shown in its place; open Versions to restore one.' : 'This asset has no version.'}</div></div>`;
    // on a full artwork the words are in the bitmap: the fields show them but cannot change them
    const baked = v.mode === 'artwork' || finished ? new Set(((v.layout || {}).baked || ['headline', 'support', 'cta']).filter(r => r !== 'logo' && r !== 'wordmark')) : new Set();
    const hl = v.layout && v.layout.layers ? v.layout.layers.find(l => l.role === 'headline') : null;
    const [nonce, setNonce] = useState(0);
    // history older than the window the project view carries, paged on request in the worker's order
    const [older, setOlder] = useState([]); useEffect(() => { setOlder([]); }, [a.id]);
    const loadOlder = async () => { try { const before = older.length ? older[older.length - 1].n : (a.versionsFrom || 1); const d = await call('/studio/versions?asset=' + encodeURIComponent(a.id) + '&before=' + before + '&limit=40'); setOlder(o => o.concat((d.versions || []).slice().reverse())); } catch (e) { toastMsg('Older versions did not load: ' + e.message, true); } };
    const comp = useComposition(v, p.ns, v.layout, v.copy, nonce);
    // the variations are worked out once the fonts and images are in, so every one is measured as it would export
    const canVary = !copyOnly && !flat && !finished && v.mode !== 'artwork' && v.layout && Array.isArray(v.layout.layers);
    const [vars, setVars] = useState(null); const [using, setUsing] = useState('');
    useEffect(() => {
      setVars(null); if (!canVary || !comp.ready) return; let live = true;
      const t = setTimeout(() => { try { const r = R.variants(v.layout, v.copy, comp.imgs, { fonts: comp.fonts, format: a.format, channel: a.channel, locks: a.locks }); if (live) setVars(r); } catch (e) { if (live) setVars([]); } }, 40);
      return () => { live = false; clearTimeout(t); };
    }, [v && v.id, comp.key, comp.ready, !!(a.locks || {}).layout]);
    const useVariant = async x => { setUsing(x.id); try { await onVariant(a, x.layout, v.id, x.name); } finally { setUsing(''); } };
    const useStyle = async x => { setUsing(x.id); try { await onVariant(a, x.layout, v.id, x.name, 'style'); } finally { setUsing(''); } };
    const ED = window.STEditor || {};
    const [val, setVal] = useState(null); const [measuring, setMeasuring] = useState(false); const [repairing, setRepairing] = useState(false); const [repairNote, setRepairNote] = useState(null);
    const filed = useRef('');
    const measure = useCallback(async (force) => {
      if (!v || !v.layout || !Array.isArray(v.layout.layers) || !comp.ready || finished) return;
      const r = R.validate(v.layout, v.copy, comp.imgs, { fonts: comp.fonts, channel: a.channel, format: a.format }); setVal(r);
      /* S11: a mark that does not read is REPORTED here, never changed by itself: the correction is Fix layout, which first moves the
         mark within its own corner or region, then tries the approved variants where it stands, then extends a panel beneath it -
         the smallest local change first, and every step named on the version. (Until S11 the view swapped the variant on sight.) */
      const rd = a.readiness || {}; const sigKey = v.id + '|' + r.issues.map(i => i.code + ':' + i.layers.join(',')).join(';') + '|' + (comp.fonts ? comp.fonts.fallback.join(',') : '');
      // file the evidence when the worker has none for this composition, or when what was measured disagrees with what it holds
      const disagrees = (rd.technical === 'passed' && !r.ok) || (rd.technical === 'failed' && r.ok);
      // the signature is recorded only once the worker accepted the evidence: a filing that failed (network, 500, a stale
      // version) leaves nothing recorded, so Measure again sends it again instead of doing nothing
      if (!ro && onValidate && (force || ((rd.technical !== 'passed' && rd.technical !== 'failed') || disagrees)) && (force || filed.current !== sigKey)) { setMeasuring(true); try { const sent = await onValidate(a, v, r, comp); if (sent) filed.current = sigKey; } finally { setMeasuring(false); } }
    }, [v && v.id, comp.key, comp.ready, a.readiness && a.readiness.technical]);
    useEffect(() => { const f = forceNext.current; forceNext.current = false; measure(f); }, [measure]);
    const repair = async () => { setRepairing(true); try { const r = await onRepair(a, v, comp); setRepairNote(r); } finally { setRepairing(false); } };
    const undoRepair = async () => { if (!repairNote || !repairNote.undo) return; setRepairing(true); try { await onUndoRepair(a, repairNote.undo); setRepairNote(null); } finally { setRepairing(false); } };
    // Measure again reloads the images and fonts first (a mark that failed to load, a font that arrived late), then files the measurement
    const forceNext = useRef(false);
    const measureAgain = () => { forceNext.current = true; setNonce(n => n + 1); };
    const draftPng = async () => { const blob = await R.toBlob(v.layout, v.copy, comp.imgs); const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = (a.title + '-v' + vnum(a, v) + '-DRAFT-not-validated.png').replace(/[^a-z0-9.-]+/gi, '_'); document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); };
    const renderJob = (p.jobs || []).find(j => j.asset === a.id && (j.stage === 'render' || j.stage === 'inspect') && (j.state === 'queued' || j.state === 'running'));
    const imageJob = (p.jobs || []).find(j => j.asset === a.id && j.stage === 'render' && (j.state === 'queued' || j.state === 'running'));
    const lastRender = (p.jobs || []).filter(j => j.asset === a.id && j.stage === 'render').sort((x, y) => (x.created || 0) - (y.created || 0)).pop();
    // the art direction the composition already carries: the background region's own brief, else the version's visual note
    const bgPrompt = () => { const L = v.layout || {}; const r = (L.regions || []).find(x => x.role === 'background'); return (r && r.prompt) || (v.context || {}).visual || ''; };
    const ratio = (v.layout && v.layout.stage && v.layout.stage.w / v.layout.stage.h) || FORMAT_RATIO[a.format] || 1;
    const hasLayout = !copyOnly && !flat && !finished && v.layout && v.layout.layers;
    // S18: the canvas IS the editor for an editable composition (no separate edit mode): select, drag, type in place; a read-only
    // key, a locked layout, a bitmap or a flattened tile shows the composition as it stands
    const le = !!(hasLayout && !ro && !a.locks.layout);
    const stageW = v.layout && v.layout.stage ? v.layout.stage.w : 1080;
    const zoomStyle = zoom === 'fit' ? null : { width: Math.round(stageW * (zoom === 'actual' ? 1 : (+zoom || 100) / 100)) + 'px', maxWidth: 'none' };
    const ZOOMS0 = [['fit', 'Fit'], ['50', '50%'], ['75', '75%'], ['actual', '100% (actual)'], ['150', '150%'], ['200', '200%']];
    const ZOOMS = ZOOMS0.some(z => z[0] === zoom) ? ZOOMS0 : ZOOMS0.concat([[zoom, zoom + '%']]);
    /* zoom and pan: Ctrl or Cmd with the wheel zooms about the stage (25-400%), Space held while dragging pans a zoomed stage,
       Shift+1 fits, Shift+0 is actual size, Shift+2 is 200%; a key typed into a field is the field's */
    const stageRef = useRef(null); const panRef = useRef(null); const [spaceDown, setSpaceDown] = useState(false);
    const zoomPct = () => { if (zoom === 'actual') return 100; if (zoom !== 'fit') return +zoom || 100; const inner = stageRef.current && stageRef.current.querySelector('.st-stage-inner'); return inner ? Math.round(inner.getBoundingClientRect().width / stageW * 100) : 100; };
    useEffect(() => { const el = stageRef.current; if (!el) return; const h = e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); const next = Math.max(25, Math.min(400, Math.round(zoomPct() * (e.deltaY < 0 ? 1.12 : 0.89)))); setZoom(next === 100 ? 'actual' : String(next)); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); });
    useEffect(() => {
      const typing = t => t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable);
      const kd = e => { if (typing(e.target)) return; if (e.code === 'Space' && zoom !== 'fit' && !e.repeat) { setSpaceDown(true); e.preventDefault(); } if (e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) { if (e.code === 'Digit1') { e.preventDefault(); setZoom('fit'); } else if (e.code === 'Digit0') { e.preventDefault(); setZoom('actual'); } else if (e.code === 'Digit2') { e.preventDefault(); setZoom('200'); } } };
      const ku = e => { if (e.code === 'Space') setSpaceDown(false); };
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }, [zoom]);
    const panDown = e => { if (!spaceDown || zoom === 'fit') return; e.preventDefault(); e.stopPropagation(); const el = stageRef.current; panRef.current = { x: e.clientX, y: e.clientY, sl: el.scrollLeft, st: el.scrollTop }; try { el.setPointerCapture(e.pointerId); } catch (x) {} };
    const panMove = e => { const c = panRef.current; if (!c) return; e.preventDefault(); e.stopPropagation(); const el = stageRef.current; el.scrollLeft = c.sl - (e.clientX - c.x); el.scrollTop = c.st - (e.clientY - c.y); };
    const panUp = e => { if (panRef.current) { panRef.current = null; e.stopPropagation(); } };
    const tagText = compTag(v, v.layout && v.layout.layers ? v.layout : null, comp);
    const ZOOM_STEPS = [25, 33, 50, 67, 75, 100, 125, 150, 200, 300, 400];
    const zoomStep = d => { const cur = zoomPct(); const nx = d > 0 ? ZOOM_STEPS.find(z => z > cur + 1) : ZOOM_STEPS.slice().reverse().find(z => z < cur - 1); if (nx) setZoom(nx === 100 ? 'actual' : String(nx)); };
    const toolName = { design: 'Design', text: 'Text', images: 'Images', brand: 'Brand', layers: 'Layers' };
    // the canvas bar: what this is, how big it is shown, and the views of it - never the artwork's own controls
    const canvasBar = html`<div class="st-canvasbar st-asset-head" role="toolbar" aria-label="Canvas">
      <div class="st-canvasbar-l"><b class="st-asset-title" title=${a.title}>${a.title}</b>${hasLayout || finished ? (() => { const q = qualityState(a, v, val); return html`<span class=${'st-qstate mini ' + q.state} data-state=${q.state} title=${q.why || q.word}>${measuring ? 'Measuring...' : q.word}</span>`; })() : null}<span class="ov-dim st-canvasbar-meta" title=${'v' + vnum(a, v) + ' of ' + vtotal(a) + ': ' + v.note + (v.who ? ', ' + v.who : '')}>${chanLabel(a.channel)} ${(FORMATS[a.format] || {}).label || a.format}${v.layout && v.layout.stage ? ' - ' + v.layout.stage.w + ' x ' + v.layout.stage.h : ''} - v${vnum(a, v)} of ${vtotal(a)}, ${v.note}</span></div>
      ${!copyOnly ? html`<div class="st-canvasbar-c st-stage-tools">
        ${!preview ? html`<button class="st-iconbtn sm" onClick=${() => zoomStep(-1)} aria-label="Zoom out" title="Zoom out (Ctrl or Cmd with the wheel)"><${Icon} n="zoomout" size=${15} /></button>
        <label class="st-zoom"><span class="st-vh">Zoom</span><select class="st-sel" value=${zoom} onChange=${e => setZoom(e.target.value)} aria-label="Zoom">${ZOOMS.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>
        <button class="st-iconbtn sm" onClick=${() => zoomStep(1)} aria-label="Zoom in" title="Zoom in"><${Icon} n="zoomin" size=${15} /></button>
        <button class=${'btn sm ghost' + (zoom === 'fit' ? ' on' : '')} aria-pressed=${zoom === 'fit'} onClick=${() => setZoom('fit')} title="The whole artwork in the space available (Shift+1)">Fit</button>` : null}
      </div>` : null}
      <div class="st-canvasbar-r">
        ${!copyOnly && !preview ? html`<button class=${'btn sm ghost' + (overlays ? ' on' : '')} aria-pressed=${overlays} onClick=${() => { setOverlays(!overlays); if (overlays) setHlIds([]); }} title="Guides, issue outlines and subject marks while you work; never in previews or exports">Guides</button>
        <button class=${'btn sm ghost' + (checker ? ' on' : '')} aria-pressed=${checker} onClick=${() => setChecker(!checker)} title="A checkerboard behind the stage shows transparent areas">Checkerboard</button>` : null}
        ${!copyOnly ? html`<button class=${'btn sm' + (preview ? ' on' : ' ghost')} aria-pressed=${!!preview} onClick=${() => setPreview(!preview)} title="Preview: the artwork alone, as it exports - no handles, outlines, labels or guides">${preview ? 'Exit preview' : 'Preview'}</button>
        <button class=${'st-iconbtn sm' + (full ? ' on' : '')} aria-pressed=${full} onClick=${() => setFull(!full)} aria-label=${full ? 'Leave full screen' : 'Full screen'} title="Full screen (Escape leaves)"><${Icon} n="expand" size=${15} /></button>` : null}
        ${(() => { const vi = a.versions.findIndex(x => x.id === v.id); return vi > 0 ? html`<button class="btn sm ghost" onClick=${() => onCompare(a.versions[vi - 1].id, v.id)} title="Compare with the version before">Compare</button>` : null; })()}
        ${neighbours && neighbours.prev ? html`<button class="st-iconbtn sm" onClick=${() => onOpen(neighbours.prev)} aria-label="Previous asset" title="Previous asset"><${Icon} n="up" size=${15} /></button>` : null}${neighbours && neighbours.next ? html`<button class="st-iconbtn sm" onClick=${() => onOpen(neighbours.next)} aria-label="Next asset" title="Next asset"><${Icon} n="down" size=${15} /></button>` : null}
      </div>
    </div>`;
    const [edTools, setEdTools] = useState(null); const [edFoot, setEdFoot] = useState(null); const [dirtyNow, setDirtyNow] = useState(false);
    const stage = html`<div ref=${stageRef} class=${'st-stage ' + (zoom === 'fit' ? 'fit' : 'zoomed') + (checker ? ' checker' : ' plain') + (preview ? ' preview' : '') + (full ? ' full' : '') + (spaceDown && zoom !== 'fit' ? ' panning' : '')} style=${{ '--ar': ratio }} data-zoom=${zoom} onPointerDownCapture=${panDown} onPointerMoveCapture=${panMove} onPointerUpCapture=${panUp}>
        ${full ? html`<div class="st-full-bar"><b>${a.title}</b><button class="btn sm ghost" onClick=${() => setFull(false)}>Leave full screen</button></div>` : null}
        <div class="st-stage-inner st-artboard" style=${zoomStyle}>${le ? html`<${LayoutEditor} key=${v.id + ':' + edKey} v=${Object.assign({}, v, { copy })} a=${a} ns=${p.ns} p=${p} kit=${kit} preview=${preview} onMore=${() => setTab('properties')} onDirty=${d => { setDirtyNow(d); if (onLayoutDirty) onLayoutDirty(d); }} propsSlot=${propsSlot} layersSlot=${layersSlot} toolsSlot=${edTools} footSlot=${edFoot} onSel=${ids => { setLayerSel(ids); if (ids.length && tab !== 'director') setTab('properties'); }} guides=${overlays && !preview} highlight=${!preview ? hlIds : []} onDone=${(layout, cp, o) => { if (layout) return onLayoutSave(a, layout, (o && o.base) || v.id, null, cp, o); setEdKey(k => k + 1); return null; }} />` : html`<${Composition} v=${v} a=${a} ns=${p.ns} copy=${copy} highlight=${!preview ? hlIds : []} tagOut=${true} />`}</div>
        ${hlIds.length && !preview ? html`<div class="st-hl-note" role="status">Outlined on the tile: ${hlIds.join(', ')}. <button class="ov-link" onClick=${() => setHlIds([])}>clear</button></div>` : null}
        ${renderJob ? html`<div class="st-stage-job" role="status"><span class="st-spin" aria-hidden="true"></span> ${renderJob.stage === 'inspect' ? 'The Creative Director is reviewing this version' : 'Imagery ' + (renderJob.state === 'running' ? 'is being generated' : 'is queued') + (renderJob.attempts ? ' (attempt ' + (renderJob.attempts + 1) + ' of 3)' : '')}. The composition stays editable meanwhile.</div>` : null}
      </div>`;
    // the notes that explain what kind of artwork this is: said once, under the canvas, never on the artwork
    const notes = !preview ? html`${flat ? html`<div class="st-flatnote">A flattened legacy tile: the text on the image is not editable. Editing the caption does not change the image.</div>` : null}
        ${finished ? html`<div class="st-flatnote st-finnote" role="note"><b>Finished creative.</b> ${v.image ? 'One bitmap painted by the image model (' + ((v.image || {}).model || 'image model') + ', ' + ((v.image || {}).size || '') + ((v.image || {}).fallback ? ', fell back from ' + (v.image || {}).requested : '') + '): the ' + Array.from(baked).join(', ') + ((v.layout || {}).baked || []).filter(r => r === 'logo' || r === 'wordmark').map(r => ', the ' + r).join('') + ' and the URL are pixels, not layers - nothing on it can be dragged or retyped. Change it by regenerating (Images); the Creative Director reads the words and the mark back before approval.' : 'Queued: the image model will paint the whole piece, words and mark included. What you see is the plan it is briefed from, not the result.'}</div>` : null}
        ${v.mode === 'artwork' ? html`<div class="st-flatnote">Hybrid artwork (legacy): the ${((v.layout || {}).baked || ['headline', 'support', 'cta']).join(', ')} are painted into the image and are not editable; the ${(v.layout || {}).layers && v.layout.layers.some(l => l.role === 'wordmark') ? 'wordmark' : 'logo'} is a live layer from its file.</div>` : null}
        ${v.image && v.image.fallback && v.mode !== 'artwork' && !finished ? html`<div class="st-flatnote">The image model fell back: ${v.image.requested} was requested, ${v.image.model} answered at ${v.image.size}.</div>` : null}
        ${v.layout && (v.layout.incomplete || []).length ? html`<div class="st-flatnote st-incomplete"><${Chip} kind="bad">incomplete</${Chip}> ${v.layout.incomplete.map(i => i.text).join('; ')}. Design approval and export wait for the file.</div>` : null}
        ${hasLayout && !v.image && !renderJob && (v.context || {}).imagery !== 'none' && (v.layout.regions || []).length ? html`<div class="st-flatnote">No imagery yet: the composition is drawn over its ground until a render lands.</div>` : null}
        ${(v.context || {}).imagery === 'none' && !hiddenImagery(v) ? html`<div class="st-flatnote">No imagery by choice: a typographic composition, nothing to render.</div>` : null}
        ${hiddenImagery(v) ? html`<div class="st-flatnote st-hidden-imagery">Imagery on file but not shown: ${hiddenImagery(v)}. Show the imagery (below) lifts it, no render.</div>` : null}` : null;
    const genImagery = () => { if (window.confirm('Generate the imagery for ' + a.title + '? One image generation at ' + ((v.image && v.image.size) || (v.context || {}).size || '2K') + ', from the composition\'s own art direction. The words and marks stay live layers.')) onRender(a, bgPrompt(), false, (v.context || {}).size); };
    const openTool = k => { setTool(tool === k ? '' : k); };
    // the contextual library: the tool chosen in the dock opens its panel beside the canvas; the page never scrolls to find it
    const library = tool && !preview ? html`<aside class="st-library" id="st-library" aria-label=${(toolName[tool] || tool) + ' tool'} data-tool=${tool}>
      <div class="st-library-head"><b>${toolName[tool] || tool}</b><button class="st-iconbtn sm" onClick=${() => setTool('')} aria-label=${'Close the ' + (toolName[tool] || tool) + ' panel'} title="Close"><${Icon} n="x" size=${14} /></button></div>
      <div class="st-library-body">
      ${tool === 'design' ? html`<div id="st-tool-design">${canVary ? html`<${LayoutVariations} a=${a} v=${v} ns=${p.ns} comp=${comp} ro=${ro} list=${vars} using=${using} onUse=${useVariant} />` : html`<div class="ov-dim">${finished ? 'A finished creative is one bitmap: its layout cannot be varied. Switch to Editable makes an editable copy (free).' : 'No layout variations for this version.'}</div>`}
        ${canVary && ED.StyleVariations ? html`<${ED.StyleVariations} a=${a} v=${v} ns=${p.ns} comp=${comp} ro=${ro} using=${using} onUse=${useStyle} />` : null}
        ${!copyOnly && !flat && ED.ResizePanel && onResize ? html`<${ED.ResizePanel} a=${a} v=${v} ro=${ro} busy=${busy} made=${resized} onResize=${presets => onResize(a, presets)} onOpen=${onOpen} />` : null}</div>` : null}
      ${tool === 'text' ? html`<div class="st-copy" id="st-tool-text">
        ${conflict ? html`<div class="st-notice warn" role="alert"><div class="st-notice-body"><b>Changed elsewhere while you typed: ${conflict.fields.join(', ')}.</b> <span>Nothing was overwritten. Your text is still in the field${conflict.fields.length === 1 ? '' : 's'}.</span></div><div class="st-notice-acts"><button class="btn sm" onClick=${() => onConflict('mine')}>Keep mine</button><button class="btn sm ghost" onClick=${() => { const d = Object.assign({}, draftRef.current); conflict.fields.forEach(k => { delete d[k]; }); draftRef.current = d; setDraft(d); onConflict('theirs'); }}>Take theirs</button></div></div>` : null}
        ${fields.map(([k, label]) => html`<div key=${k} class=${'st-field' + (sel === k ? ' on' : '') + (a.locks[k] ? ' locked' : '')} onClick=${() => setSel(k)}>
          <div class="st-field-head"><label class="st-lbl" for=${'st-f-' + k}>${label}</label>${!ro ? html`<button class=${'st-lock' + (a.locks[k] ? ' on' : '')} onClick=${e => { e.stopPropagation(); onLock(a, k, !a.locks[k]); }} title=${a.locks[k] ? 'Locked: survives revisions until unlocked' : 'Lock this element'} aria-pressed=${!!a.locks[k]} aria-label=${(a.locks[k] ? 'Unlock ' : 'Lock ') + label}>${a.locks[k] ? 'locked' : 'lock'}</button>` : null}</div>
          ${k === 'caption' || k === 'support' ? html`<textarea class="st-ta" id=${'st-f-' + k} rows=${k === 'caption' ? 4 : 2} value=${copy[k] || ''} disabled=${ro || a.locks[k] || baked.has(k) || (flat && k !== 'caption' && k !== 'alt')} title=${baked.has(k) ? 'part of the generated artwork; not independently editable' : ''} onInput=${e => edit(k, e.target.value)} onBlur=${flushNow}></textarea>` : html`<input class="st-in" id=${'st-f-' + k} value=${copy[k] || ''} disabled=${ro || a.locks[k] || baked.has(k) || (flat && k !== 'alt')} title=${baked.has(k) ? 'part of the generated artwork; not independently editable' : ''} onInput=${e => edit(k, e.target.value)} onBlur=${flushNow} />`}${baked.has(k) ? html` <${Chip} kind="warn" title="painted into the bitmap by the image model">in the artwork</${Chip}>` : null}
        </div>`)}
        <div class="ov-dim st-savenote" role="status">${Object.keys(draft).length ? 'Saving as a new version (text change, no render)...' : 'Edits save as a new version after a pause; no render. Words on the canvas can also be typed in place (double-click).'}</div>
        <div class="st-field"><${Lbl}>Checks on these words</${Lbl}>
          <ul class="st-checks">
            ${(v.checks || []).map((c, i) => html`<li key=${i} class=${c.state}><${Chip} kind=${CHECK_KIND[c.state] || 'warn'}>${CHECK_WORD[c.state] || c.state}</${Chip}> <b>${c.text}</b> <span class="ov-dim">${c.note}</span></li>`)}
            ${!(v.checks || []).length ? html`<li><span class="ov-dim">No figures, quotations or fit problems found in this copy.</span></li>`  : null}
            <li class="ov-dim">Deterministic checks on figures, units, quotations, banned terms, limits and fit. Matching a source is not independent verification.</li>
          </ul></div>
      </div>` : null}
      ${tool === 'images' ? html`<div id="st-tool-images">
        ${finished ? html`<div class="ov-dim">A finished creative is changed by regenerating it whole, or by switching to an editable copy: both are under the canvas.</div>` : null}
        ${!copyOnly && !flat && !finished ? html`<${ArtDirection} p=${p} a=${a} v=${v} ro=${ro} busy=${busy} onPropose=${onPropose} onApply=${onApplyConcept} onRender=${onRender} rr=${rr} setRr=${setRr} sugg=${sugg} onSuggRefresh=${onSuggRefresh} />` : null}
        ${!copyOnly && !flat && !finished && !ro ? html`<${AreaEdit} a=${a} v=${v} busy=${busy} onEdit=${onAreaEdit} />` : null}
        <${Preservation} p=${p} a=${a} v=${v} ro=${ro} onCompare=${onCompare} onFile=${onPreservation} />
        ${flat ? html`<div class="ov-dim">A flattened legacy tile has no imagery controls.</div>` : null}</div>` : null}
      ${tool === 'brand' ? html`<${BrandTab} p=${p} a=${a} v=${v} kit=${kit} onBrand=${onBrand} onContext=${onContext} />` : null}
      ${tool === 'layers' ? html`<div class="st-layers" aria-label="Layers"><div class="ov-dim">Front to back. Select to edit; hide, lock and reorder here or on the canvas.</div>
        <div ref=${setLayersSlot}></div>
        ${!le && hasLayout ? html`<${LayersList} layers=${v.layout.layers} sel=${layerSel} ro=${ro || !!a.locks.layout} bad=${new Set(val ? val.issues.filter(i => i.severity === 'blocking').reduce((acc, i) => acc.concat(i.layers), []) : [])} heldMark=${l => !!(l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark') && l.rule && l.rule.mandatory)} onPick=${(e, l) => pickLayer(layerSel.length === 1 && layerSel[0] === l.id ? [] : [l.id])} onHide=${l => patchLayer(l.id, { hidden: !l.hidden }, (l.hidden ? 'showed' : 'hid') + ' the ' + (l.role || l.type))} onLock=${l => patchLayer(l.id, { locked: !l.locked }, (l.locked ? 'unlocked' : 'locked') + ' the ' + (l.role || l.type))} />` : null}
        ${!hasLayout ? html`<div class="ov-dim">${finished ? 'A finished creative is one bitmap: it has no layers.' : 'No layers on this version.'}</div>` : null}
        ${hasLayout && a.locks.layout ? html`<div class="ov-dim">The layout is locked: unlock it in the Text tool's Layout line to edit on the canvas.</div>` : null}</div>` : null}
      </div>
    </aside>` : null;
    const work = html`<div class=${'st-design' + (preview ? ' preview' : '') + (library ? ' has-library' : '')}>
      ${!preview && !copyOnly ? html`<${DesignDock} tool=${tool} ro=${ro} canVary=${canVary} canEdit=${!!le} hasLayout=${!!hasLayout} finished=${finished} flat=${flat} onTool=${openTool} onEditable=${() => { if (window.confirm('Make an editable copy of ' + a.title + '? A new asset in the family "Editable from finished": the words become live type and the mark is placed from its file; this finished creative stays as it is. Free, no render.')) onDerive(a, {}); }} />` : null}
      ${library}
      <section class=${'st-canvas-col st-asset' + (preview ? ' preview' : '')} aria-label="Canvas">
        ${canvasBar}
        ${le && !preview ? html`<div class="st-edtools" ref=${setEdTools}></div>` : null}
        ${stage}
        ${!preview ? html`<div class="st-canvas-foot">
          <div class="st-canvas-sub"><${PageStrip} p=${p} a=${a} onOpen=${onOpen} /><div class="st-canvas-subr">${le ? html`<div class="st-edfoot" ref=${setEdFoot}></div>` : null}<div class="st-comp-info ov-dim" aria-label="About this composition"><span class="st-comp-tag" title=${tagText}>${tagText}</span></div></div></div>
          ${hasLayout ? html`<${ReadyStrip} compact=${true} a=${a} v=${v} val=${val} measuring=${measuring} ro=${ro} onRepair=${repair} onUndoRepair=${undoRepair} onMeasure=${measureAgain} onDraft=${draftPng} repairing=${repairing} repairNote=${repairNote} onDetail=${() => setTab('checks')} highlight=${hlIds} onHighlight=${ids => { toggleHl(ids); if (!overlays) setOverlays(true); if (preview) setPreview(false); }} onAction=${k => { if (k === 'imagery') genImagery(); }} onEditLayout=${le ? () => { try { stageRef.current.querySelector('.st-le').focus(); } catch (e) {} } : null} onVariations=${canVary ? () => setTool('design') : null} varsOk=${vars ? vars.filter(x => x.ok).length : null} varsN=${vars ? vars.length : 0} />` : null}
          ${hasLayout && !measuring ? html`<${Remedies} a=${a} v=${v} val=${val} ro=${ro} renderJob=${imageJob} lastRender=${lastRender} typeOnly=${(vars || []).find(x => x.typeOnly) || null} hidden=${hiddenImagery(v)} onShow=${() => onLayoutSave(a, showImagery(v.layout), v.id, 'show the imagery: the ground that hid it is lifted')} onGenerate=${genImagery} onSolid=${() => { const x = (vars || []).find(y => y.typeOnly); if (x) useVariant(x); }} onRetry=${j => { if (window.confirm('Run the render again? One image generation.')) onRetryJob(j); }} onRefresh=${() => setNonce(n => n + 1)} />` : null}
          ${finished ? html`<${FinishedPanel} p=${p} a=${a} v=${v} ro=${ro} busy=${busy} renderJob=${imageJob} lastRender=${lastRender} onRegenerate=${onRegenerate} onDerive=${onDerive} onRetry=${j => { if (window.confirm('Run the render again? One image generation.')) onRetryJob(j); }} />` : null}
          ${notes}
        </div>` : null}
      </section>
    </div>`;
    // a change to one layer outside the editor: one layout version, no render
    const patchLayer = (id, patch, note) => { const L = JSON.parse(JSON.stringify(v.layout)); const l = L.layers.find(x => x.id === id); if (!l) return; Object.assign(l, patch); onLayoutSave(a, L, v.id, note); };
    const panel = (id, body) => html`<div key=${id} role="tabpanel" id=${'st-tab-' + id} aria-labelledby=${'st-tabbtn-' + id} hidden=${tab !== id} class="st-tabpanel">${body}</div>`;
    const inspector = html`<div class="st-inspector-asset">
      ${panel('properties', html`<div class="st-props">
        ${hasLayout ? html`<${StaticProps} a=${a} v=${v} ids=${layerSel} val=${val} comp=${comp} kit=${kit} ro=${ro} tagText=${tagText} onPatch=${patchLayer} onEditLayout=${null} infoOnly=${le} dirty=${!!dirtyNow} onHighlight=${ids => { setHlIds(ids); if (!overlays) setOverlays(true); }} />` : null}
        <div ref=${setPropsSlot}></div>
        <div class="st-field"><div class="st-field-head"><${Lbl}>Layout</${Lbl}>${!ro && !copyOnly && !flat ? html`<button class=${'st-lock' + (a.locks.layout ? ' on' : '')} onClick=${() => onLock(a, 'layout', !a.locks.layout)} aria-pressed=${!!a.locks.layout} aria-label=${a.locks.layout ? 'Unlock the layout' : 'Lock the layout'}>${a.locks.layout ? 'locked' : 'lock'}</button>` : null}</div>
          <div class="ov-dim">${copyOnly ? 'copy only: no tile' : flat ? 'not editable (flattened)' : finished ? 'one painted bitmap: no layers' : v.layout && v.layout.layers ? (v.layout.mediumName || v.layout.templateName || 'composition') + ', ' + v.layout.layers.length + ' layers' + (v.layout.layers.some(l => l.role === 'logo') ? ', kit logo placed exactly' : v.layout.layers.some(l => l.role === 'wordmark') ? ', campaign wordmark placed exactly' : ', no mark on file') + '.' + (a.locks.layout ? ' Locked: unlock to edit on the canvas.' : '') : 'no layout'}
            ${!ro && hl && !a.locks.layout ? html` <button class="ov-link" onClick=${() => onLayout(a, -0.6)}>headline smaller</button> <button class="ov-link" onClick=${() => onLayout(a, 0.6)}>larger</button> <span class="ov-dim">(a layout version, no render)</span>` : null}</div></div>
      </div>`)}
      ${panel('checks', html`${hasLayout && ED.QualitySummary ? html`<${ED.QualitySummary} v=${v} val=${val} copy=${copy} ro=${ro} fixing=${repairing} onFix=${repair} fixable=${fixableOf(val)} fixNote=${repairNote ? (REPAIR_WORD[repairNote.state] || 'Fix layout') + '.' + (repairCounts(repairNote) ? ' ' + repairCounts(repairNote) + '.' : '') : ''} />` : null}${hasLayout || finished ? html`<${Readiness} p=${p} a=${a} v=${v} val=${val} highlight=${hlIds} onHighlight=${toggleHl} />` : html`<div class="ov-dim">${copyOnly ? 'Copy only: nothing to measure; the checks on the words are in the Text tool.' : 'A flattened tile cannot be measured.'}</div>`}
        <div class="st-approve" aria-label="Approvals">
          <div class="st-lbl">Human approval of v${vnum(a, v)}</div>
          ${['copy', 'design'].filter(part => part === 'copy' || !copyOnly).map(part => html`<div key=${part} class="st-appr"><span><b>${part}</b> ${ap[part] ? html`<${Chip} kind="ok">approved</${Chip}> <span class="ov-dim">on v${a.versions.findIndex(x => x.id === ap[part].version) + 1} by ${ap[part].by}, ${ap[part].reason}${ap[part].carried ? ' (unchanged since, so it stands)' : ''}</span>` : html`<span class="ov-dim">draft</span>`}</span>
            ${!ro ? html`<span>${ap[part] ? html`<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'withdraw')}>Withdraw</button>` : html`<button class="btn sm ghost" disabled=${part === 'design' && ((v.layout && (v.layout.incomplete || []).length > 0) || !a.readiness || (a.readiness.technical !== 'passed' && a.readiness.technical !== 'not_applicable'))} title=${part === 'design' && v.layout && (v.layout.incomplete || []).length ? 'The campaign mark is not on file: the design cannot be approved until it is' : part === 'design' && a.readiness && a.readiness.technical !== 'passed' ? 'Design approval waits for a passing technical validation of this composition' : ''} onClick=${() => onApprove(a, part, 'approve')}>Approve ${part}</button>`}<button class="btn sm ghost" onClick=${() => onApprove(a, part, 'reject')}>Reject</button></span>` : null}
          </div>`)}
          <div class="ov-dim">An approval names this exact version; a later change drops it. The Creative Director's verdict is advice and never approves.</div>
        </div>`)}
      ${panel('history', html`<div class="st-hist"><div class="ov-dim">Versions never change; restoring makes a new current version from the earlier content.</div>
        ${a.versions.slice().reverse().map(x => html`<div key=${x.id} class=${'st-hist-row' + (x.id === a.current ? ' cur' : '')}><${Composition} v=${x} a=${a} ns=${p.ns} size="thumb" /><div><b>v${vnum(a, x)}</b> <${Chip} kind=${x.kind === 'render' ? 'warn' : ''}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.created)}, ${x.who}${x.parent && x.parent !== (a.versions[vnum(a, x) - 2] || {}).id ? ' (branch)' : ''}</div></div><div>${x.id === a.current ? html`<${Chip} kind="ok">current</${Chip}>` : !ro ? html`<button class="ov-link" onClick=${() => onRestore(a, x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
        ${older.map(x => html`<div key=${x.id} class="st-hist-row st-hist-older"><div></div><div><b>v${x.n}</b> <${Chip}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.created)}, ${x.who}</div></div><div>${!ro ? html`<button class="ov-link" onClick=${() => onRestore(a, x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
        ${(older.length ? older[older.length - 1].n : (a.versionsFrom || 1)) > 1 ? html`<button class="ov-link st-hist-more" onClick=${loadOlder}>Load older versions (${(older.length ? older[older.length - 1].n : a.versionsFrom) - 1} earlier)</button>` : null}
        </div>
        ${!flat ? html`<${UsedPanel} a=${a} v=${v} />` : null}`)}
    </div>`;
    return html`${work}${slot ? ReactDOM.createPortal(inspector, slot) : null}`;
  }

  /* ------------------------------------------------------------ the right panel: the direction thread */
  /** S18: the Creative Director's one current review of an asset - the latest inspection of it, the exact version it judged and
      whether that is still the current one, what it saw (the composed tile or the imagery only), the scores with their reasons,
      the verdict, the round, the top issue first, the words it read against the approved copy, and the correction it offers,
      editable and applied once. Nothing here is hard-coded: every figure is the inspection record. Ship is an opinion, never an
      approval. The conversation below never repeats this card's controls. */
  function CDReview({ p, a, ro, busy, onReview, onApplyInspection }) {
    const [applying, setApplying] = useState(false);
    if (!a) return html`<div class="st-cd-empty ov-dim">Open a composition in Design to review it. The review reads the tile exactly as it exports.</div>`;
    const v = current(a); if (!v || v.mode === 'copy') return html`<div class="st-cd-empty ov-dim">${a.title} is copy only: there is no tile to review. Its words are checked in the Copy step.</div>`;
    const last = (p.thread || []).filter(e => e.kind === 'inspection' && e.asset === a.id).pop();
    const reviewing = (p.jobs || []).some(j => j.asset === a.id && j.stage === 'inspect' && (j.state === 'queued' || j.state === 'running'));
    const vn = last ? (a.versions.findIndex(x => x.id === last.version) + 1 || last.versionNumber || 0) : 0; const old = !!(last && last.version && last.version !== a.current);
    const done = last ? (p.thread || []).find(e => e.kind === 'inspection_applied' && e.eid === last.eid) : null;
    const issues = last ? (last.issues || []).map(x => typeof x === 'string' ? { text: x, severity: '' } : x) : [];
    const order = { blocking: 0, material: 1 }; const sorted = issues.slice().sort((x, y) => (order[x.severity] == null ? 2 : order[x.severity]) - (order[y.severity] == null ? 2 : order[y.severity]));
    const KEYS = ['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'];
    const apply = async () => { if (applying) return; if (old && !window.confirm('This review judged v' + vn + '; the current version is v' + vtotal(a) + '. Apply its correction to the current version anyway?')) return; const ta = document.getElementById('fix-' + last.eid); setApplying(true); try { await onApplyInspection(last.eid, ta ? ta.value.trim() || last.fix.instruction : last.fix.instruction, old); } finally { setApplying(false); } };
    return html`<div class="st-adreview st-cd-review" aria-label="Current review">
      <div class="st-adreview-head"><div><b>${a.title}</b> <span class="ov-dim">current v${vtotal(a)}</span></div>
        ${!ro ? html`<button class="btn sm" disabled=${reviewing || !!busy} onClick=${() => onReview(a)} title="The tile is composed exactly as it exports, then the Creative Director reads it: scores with reasons, the words it can read, a verdict and one bounded correction. One model call; it approves nothing.">${reviewing ? 'Reviewing...' : 'Review v' + vtotal(a) + ' (1 model call)'}</button>` : null}</div>
      ${last && last.scores ? html`<div class="st-adreview-body">
        <div class="st-cd-verdict"><${Chip} kind=${last.verdict === 'ship' ? 'ok' : last.verdict === 'redo' ? 'bad' : 'warn'}>verdict: ${last.verdict}</${Chip}>
          ${old ? html`<${Chip} kind="warn" title="the asset has moved on since this review">outdated: judged v${vn || '?'}</${Chip}>` : html`<${Chip} kind="ok">judged v${vn || vtotal(a)}, the current version</${Chip}>`}
          ${old ? html`<div class="st-cd-stale">This review judged v${vn || '?'}, an earlier version; review again for this one.</div>` : null}
          <${Chip} kind=${last.composed ? 'ok' : 'warn'} title=${last.composed ? 'it saw the tile exactly as it exports: imagery, words, shapes and marks' : 'no composed export was saved; the words and marks were described to it, not seen'}>${last.composed ? 'composed tile' : 'imagery only'}</${Chip}>
          <span class="ov-dim">round ${last.round || 1} of ${last.of || 2}, ${aest(last.at)}</span></div>
        ${sorted.length ? html`<div class="st-adreview-top"><span class="st-lbl">Top issue</span> ${sorted[0].severity ? html`<${Chip} kind=${sorted[0].severity === 'blocking' ? 'bad' : sorted[0].severity === 'material' ? 'warn' : ''}>${sorted[0].severity}</${Chip}> ` : null}${sorted[0].text}</div>` : html`<div class="ov-dim">No issue named.</div>`}
        <ul class="st-cd-scores">${KEYS.map(k => html`<li key=${k} class=${'s' + (last.scores[k] == null ? 'n' : last.scores[k])}><span class="st-cd-sk">${k} </span><b>${last.scores[k] == null ? 'not scored' : last.scores[k] + ' / 5'} </b><span class="st-cd-sr">${(last.reasons || {})[k] || 'no reason given'}</span></li>`)}</ul>
        ${last.unscored && last.unscored.length ? html`<div class="ov-dim">Not scored: ${last.unscored.join(', ')} (the model gave no score; nothing was assumed).</div>` : null}
        ${sorted.length > 1 ? html`<details class="st-cd-more"><summary>${sorted.length - 1} more issue${sorted.length === 2 ? '' : 's'}</summary><ul class="st-ul">${sorted.slice(1).map((x, i) => html`<li key=${i}>${x.severity ? html`<${Chip} kind=${x.severity === 'blocking' ? 'bad' : x.severity === 'material' ? 'warn' : ''}>${x.severity}</${Chip}> ` : null}${x.text}</li>`)}</ul></details>` : null}
        ${last.words ? html`<div class="ov-dim st-adreview-words">Words it read: ${(last.words.present || []).length ? (last.words.present || []).map(w => '"' + w + '"').join(', ') : 'none'}${(last.words.wrong || []).length ? html`; <span class="st-bad">not in the approved copy: ${last.words.wrong.map(w => '"' + w + '"').join(', ')}</span>` : null}${(last.words.missing || []).length ? html`; <span class="st-bad">approved words it could not find: ${last.words.missing.map(w => '"' + w + '"').join(', ')}</span>` : null}.</div>` : null}
        ${last.assessment === 'inconsistent' ? html`<div class="st-insp-incons"><${Chip} kind="bad">inconsistent</${Chip}> <span class="ov-dim">the verdict is ship, but ${last.technical === 'failed' ? 'the measured validation fails' : 'it names unresolved problems'}.</span></div>` : null}
        ${last.fix ? done ? html`<div class="st-cd-fixdone"><${Chip} kind="ok">correction applied (${done.fixKind})</${Chip}> <span class="ov-dim">${aest(done.at)}; review again to judge the result.</span></div>` : !ro ? html`<div class="st-offer-box st-cd-fix"><div class="ov-dim">Correction offered (${last.fix.kind}${last.fix.kind === 'design' || last.fix.kind === 'copy' ? ', no render' : last.fix.kind === 'edit' ? ', one render: an edit of this image' : ', one render: a re-brief'}). Edit it before applying; it lands as a new version.</div><textarea class="st-ta" rows="2" id=${'fix-' + last.eid} defaultValue=${last.fix.instruction} aria-label="The correction to apply"></textarea><div><button class=${'btn sm' + (old ? ' ghost' : '')} disabled=${!!busy || applying} onClick=${apply}>${applying ? 'Applying...' : old ? 'Apply the correction to the current version anyway' : 'Apply the correction'}</button>${last.fix.kind === 'render' || last.fix.kind === 'edit' ? html` <span class="ov-dim">spends one render</span>` : null}</div></div>` : null : null}
        ${last.verdict === 'stop' ? html`<div class="ov-dim">Bounded: two corrections have run on this line; the next step is a designer's eye.</div>` : null}
        <div class="ov-dim st-cd-note">${last.composed ? 'It saw the composed tile as it exports.' : 'It saw the imagery only: the words and marks were not in the picture it judged.'} One read by one model; the scores are its opinion, not a measurement (Checks holds the measurements). Advice, not approval: a person approves in Review & Delivery; ship is not approval.</div>
      </div>` : last && last.verdict === 'stop' ? html`<div class="ov-dim">${last.text}</div>` : html`<div class="st-cd-empty ov-dim">Not reviewed yet: ${a.title} has no review. One runs after each render, or now on request; it reads the tile exactly as it exports.</div>`}
    </div>`;
  }
  // the thread's dialogue: what a person said and what the Studio or the Creative Director answered; everything else is the log
  const CD_DIALOGUE = { note: 1, revise: 1, alternatives: 1, proposal: 1, decided: 1, question: 1, adapted: 1, remembered: 1, offer_declined: 1, inspection: 1, inspection_applied: 1, concepts: 1, applied: 1, client_review: 1, directions: 1, strategy: 1 };
  const aboutAsset = (e, a) => !!a && (e.asset === a.id || (e.assets || []).indexOf(a.id) >= 0 || (e.changed || []).indexOf(a.id) >= 0 || (e.kind === 'note' && e.target === a.title));
  /** S18: the right panel's Creative Director, in three parts - Review (the one current review), Ideas (a few suggestions, each with
      what it changes and keeps, its basis and its cost; and new directions) and Conversation (the dialogue about the selected asset,
      or the whole project; the Studio's log kept apart) - over one composer anchored at the foot, whose scope is stated. An
      instruction stays in the composer until the worker has accepted it: a refused request gives it back with Retry and Edit. Enter
      and Send go through one check: nothing empty, nothing while a request is out, nothing mid-composition, never twice. */
  function CreativeDirector({ p, a, kit, target, setTarget, onDirect, onNote, onPick, onDecide, onRemember, onApplyInspection, onReview, busy, sugg, onSuggRefresh, prefill, selLayers, onTool, sub, setSub }) {
    const [text, setText] = useState(''); const [offerOpen, setOfferOpen] = useState(null); const [sk, setSk] = useState('design');
    const [sending, setSending] = useState(false); const [failed, setFailed] = useState(null); const [scope, setScope] = useState('asset'); const [showLog, setShowLog] = useState(false);
    const box = useRef(null); const ta = useRef(null); const stick = useRef(true); const sendingRef = useRef(false);
    const ro = !canWrite() || p.readOnly;
    const tabs = a ? [['review', 'Review'], ['ideas', 'Ideas'], ['conversation', 'Conversation']] : [['conversation', 'Conversation']];
    const cur = tabs.some(t => t[0] === sub) ? sub : tabs[0][0];
    useEffect(() => { if (!a && scope === 'asset') setScope('project'); else if (a && scope === 'project0') setScope('asset'); }, [a && a.id]);
    // a chosen suggestion lands in the composer as an editable instruction, never sent on its own
    useEffect(() => { if (prefill && prefill.text) setText(prefill.text); }, [prefill && prefill.at]);
    const answered = useMemo(() => { const m = {}; p.thread.forEach(e => { if ((e.kind === 'decided' || e.kind === 'remembered' || e.kind === 'offer_declined') && e.eid) m[e.eid + ':' + (e.kind === 'decided' ? 'proposal' : 'offer')] = e; }); return m; }, [p.thread]);
    // the selected asset's conversation is what concerns it plus what concerns the project as a whole; events about other assets wait for Whole project
    const touchesAsset = e => !!(e.asset || (e.assets || []).length || (e.changed || []).length || (e.kind === 'note' && e.target && e.target !== 'the whole set'));
    const inScope = e => scope === 'project' || !a || aboutAsset(e, a) || !touchesAsset(e);
    const dialogue = p.thread.filter(e => CD_DIALOGUE[e.kind] && inScope(e));
    const log = p.thread.filter(e => !CD_DIALOGUE[e.kind] && inScope(e));
    // the thread follows new messages only while the reader is at its foot; reading older messages is never interrupted
    const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; };
    useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight; }, [dialogue.length, busy, cur, scope]);
    const targets = [['asset', 'This asset' + (a ? ': ' + a.title : '')], ['family', a ? 'The ' + a.family : 'Asset family'], ['set', 'The whole set']];
    const why = () => !text.trim() ? 'Write an instruction first' : sendingRef.current ? 'Sending the last instruction' : busy ? 'Wait for the running step to finish' : target !== 'set' && !a ? 'Choose an asset, or direct the whole set' : '';
    const send = async (words) => {
      const t = String(words != null ? words : text).trim();
      if (!t || sendingRef.current || busy || (target !== 'set' && !a)) return;
      sendingRef.current = true; setSending(true); setFailed(null); stick.current = true;
      let r = null; try { r = await onDirect(t, target, { layers: target === 'asset' && selLayers && selLayers.length ? selLayers.slice() : undefined }); } catch (e) { r = { error: e }; }
      sendingRef.current = false; setSending(false);
      if (r && r.accepted) { setText(cur0 => (cur0.trim() === t ? '' : cur0)); return; }
      if (r === null || (r && r.busy)) { setFailed({ text: t, title: 'Not sent: another instruction is still running.', retry: true }); return; }
      const x = explain((r && r.error) || {}, 'The instruction was not sent');
      setText(cur0 => (cur0.trim() ? cur0 : t)); setFailed({ text: t, title: 'Not sent. ' + x.title, detail: x.text, retry: true });
    };
    // an Enter that confirms a character being composed (an input method: Japanese, Chinese, Korean, accents) is not a send
    const composing = useRef(false);
    const keyDown = e => { if (e.key !== 'Enter' || e.shiftKey) return; const ne = e.nativeEvent || e; if (ne.isComposing || composing.current || e.keyCode === 229 || ne.keyCode === 229) return; e.preventDefault(); send(); };
    const sc = a ? (selLayers || []) : [];
    const layerName = id => { const cv = a && current(a); const l = cv && cv.layout && (cv.layout.layers || []).find(x => x.id === id); return l ? (l.name || (l.role && l.role !== 'free' ? l.role : '') || (l.type === 'text' ? String(l.text || '').slice(0, 24) : l.shape || l.type) || id) : id; };
    const camp = kit && (kit.campaigns || []).find(c => c.id === p.campaign);
    const msg = m => { const dec = m.kind === 'proposal' ? answered[m.eid + ':proposal'] : null; const off = m.offer ? answered[m.eid + ':offer'] : null; const ia = m.asset ? p.assets.find(x => x.id === m.asset) : null;
      return html`<div key=${m.id} class=${'st-msg ' + (m.who === 'studio' ? 'studio' : 'you')}>
        <div class="st-msg-meta">${m.who === 'studio' ? (/^(inspection|concepts)$/.test(m.kind || '') ? 'Creative Director' : 'Studio') : m.who || 'team'}${m.target && m.kind === 'note' ? html` <span class="ov-dim">to ${m.target}</span>` : null} <span class="ov-dim">${aest(m.at)}${m.kind && m.kind !== 'note' ? ' - ' + m.kind : ''}${scope === 'project' && ia ? ' - ' + ia.title : ''}</span></div>
        ${m.instruction && /^(revise|adapted|alternatives|proposal|question)$/.test(m.kind) ? html`<div class="st-msg-you">Direction: ${m.instruction}</div>` : null}
        ${m.kind === 'inspection' ? html`<div class="st-msg-text">Reviewed ${ia ? ia.title : 'the asset'}${(() => { const vn = ia ? ia.versions.findIndex(x => x.id === m.version) + 1 : m.versionNumber; return vn ? ' v' + vn : ''; })()}: verdict <b>${m.verdict}</b>${m.scores ? ' (' + ['fidelity', 'hierarchy', 'readability', 'relevance', 'identity'].map(k => k + ' ' + (m.scores[k] == null ? '-' : m.scores[k])).join(', ') + ')' : ''}.${a && m.asset === a.id && cur !== 'review' ? html` <button class="ov-link" onClick=${() => setSub('review')}>the current review</button>` : ''}</div>`
          : html`<div class="st-msg-text">${m.text}</div>`}
        ${m.changed || m.render != null ? html`<div class="st-msg-foot">${m.changed && m.changed.length ? m.changed.length + ' asset' + (m.changed.length === 1 ? '' : 's') + ' changed ' : ''}${m.kind === 'proposal' ? html`<${Chip} kind="warn">render proposed, nothing spent</${Chip}>` : m.kind === 'decided' ? html`<${Chip} kind="warn">${(m.jobs || []).length} render${(m.jobs || []).length === 1 ? '' : 's'} queued</${Chip}>` : m.render ? html`<${Chip} kind="warn">render spent</${Chip}>` : m.render === false ? html`<${Chip} kind="ok">no render</${Chip}>` : null}${m.locked ? html` <span class="ov-dim">kept locked: ${m.locked.join(', ')}</span>` : null}</div>` : null}
        ${m.kind === 'revise' && (m.layers || m.refused) ? html`<div class="st-focused" aria-label="Focused edit">
          ${(m.layers || []).length ? html`<div><${Lbl}>Changed</${Lbl}> ${m.layers.map(c => html`<${Chip} key=${c.id} kind="ok" title=${c.role || ''}>${c.id}: ${c.fields.join(', ')}</${Chip}>`)}</div>` : null}
          ${(m.unchanged || []).length ? html`<div class="ov-dim">Left as they were: ${m.unchanged.join(', ')}${m.render === false ? '; the photograph unchanged, no render' : ''}</div>` : null}
          ${(m.refused || []).length ? html`<div><${Lbl}>Not done</${Lbl}> ${m.refused.map((x, i) => html`<${Chip} key=${i} kind="warn">${x.id}: ${x.why}</${Chip}>`)}</div>` : null}
          ${(m.keeps || []).length ? html`<div class="ov-dim">Kept on purpose: ${m.keeps.join(', ')}</div>` : null}
        </div>` : null}
        ${m.kind === 'alternatives' && m.options ? html`<div class="st-alts">${m.options.map((o, i) => html`<button key=${i} class="st-alt" disabled=${ro || !!busy} onClick=${() => onPick(m.asset, m.field, o)}>${o}${m.checks && m.checks[i] && m.checks[i].length ? html` <${Chip} kind="warn">${m.checks[i].join(', ')}</${Chip}>` : null}</button>`)}<div class="ov-dim">Choose one to make it the ${m.field}, as a text change.</div></div>` : null}
        ${m.kind === 'proposal' ? html`<div class="st-proposal"><div class="ov-dim">Before a costly change, what would happen:</div><ul class="st-ul">${(m.steps || []).map((st, i) => html`<li key=${i}>${st}</li>`)}<li>Art direction: ${m.visual}</li></ul>${dec ? html`<${Chip}>${dec.decision === 'do' ? 'confirmed, ' + (dec.jobs || []).length + ' render' + ((dec.jobs || []).length === 1 ? '' : 's') : 'declined'}</${Chip}>` : !ro ? html`<div><button class="btn sm" disabled=${!!busy} onClick=${() => onDecide(m.eid, 'do')}>Do this (${(m.assets || []).length} render${(m.assets || []).length === 1 ? '' : 's'})</button> <button class="btn sm ghost" disabled=${!!busy} onClick=${() => onDecide(m.eid, 'decline')}>Not that</button></div>` : null}</div>` : null}
        ${m.offer ? html`<div class="st-offer">${off ? html`<${Chip} kind=${off.kind === 'remembered' ? 'ok' : ''}>${off.kind === 'remembered' ? 'saved as ' + (off.scope === 'campaign' ? 'a campaign preference' : 'a client rule') : 'not saved'}</${Chip}>` : !ro ? html`<span class="ov-dim">This reads like a standing preference. It is not saved unless you choose.</span> <button class="ov-link" onClick=${() => setOfferOpen(offerOpen === m.eid ? null : m.eid)}>show wording</button>` : null}
          ${offerOpen === m.eid && !off ? html`<div class="st-offer-box"><div class="ov-dim">Proposed wording (edit before saving):</div><textarea class="st-ta" rows="2" id=${'offer-' + m.eid} defaultValue=${m.offer.rule} aria-label="Wording of the preference"></textarea><div>${m.offer.campaign ? html`<button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'campaign', m.offer); setOfferOpen(null); }}>Campaign preference (${m.offer.campaign})</button> ` : null}<button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'client', m.offer); setOfferOpen(null); }}>Lasting client rule</button> <button class="btn sm ghost" onClick=${() => { onRemember(m.eid, 'none', m.offer); setOfferOpen(null); }}>Don't save</button></div></div>` : null}</div>` : null}
      </div>`; };
    return html`<section class="st-partner st-cd" aria-label="Creative Director">
      <div class="st-cd-scope" aria-label="Scope"><span class="st-lbl">Working on</span> <span>${p.ns.toUpperCase()}${camp ? ' / ' + camp.name : p.campaign ? ' / ' + p.campaign : ''}</span>${a ? html`<span class="st-dotsep" aria-hidden="true"></span><span>${a.title} v${vtotal(a)}</span>` : html`<span class="st-dotsep" aria-hidden="true"></span><span>${p.title}</span>`}${sc.length ? html`<span class="st-dotsep" aria-hidden="true"></span><span>${sc.length} layer${sc.length === 1 ? '' : 's'}: ${sc.map(layerName).join(', ')}</span>` : null}</div>
      ${tabs.length > 1 ? html`<div class="st-cd-tabs" role="tablist" aria-label="Creative Director">${tabs.map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${cur === k} class=${'st-cd-tab' + (cur === k ? ' on' : '')} onClick=${() => setSub(k)}>${l}</button>`)}</div>` : null}
      <div class="st-cd-body" ref=${box} onScroll=${onScroll} role="tabpanel" aria-label=${cur}>
        ${cur === 'review' ? html`<${CDReview} p=${p} a=${a} ro=${ro} busy=${busy} onReview=${onReview} onApplyInspection=${onApplyInspection} />` : null}
        ${cur === 'ideas' ? html`<div class="st-cd-ideas">
          <div class="ov-dim">A few suggestions for v${vtotal(a)}, asked for only when you want them. Each says what it changes and keeps, what it rests on, and whether it needs a render. Use one as an instruction (edit it first, then Send), or apply it as it stands.</div>
          ${!ro && sugg ? html`<div class="st-sugg-tabs" role="tablist" aria-label="Kinds of suggestion">${[['design', 'Design'], ['typography', 'Type'], ['copy', 'Copy'], ['concept', 'Concepts']].map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${sk === k} class=${'st-segbtn' + (sk === k ? ' on' : '')} onClick=${() => setSk(k)}>${l}${sugg.data && (sugg.data[k] || []).length ? ' ' + sugg.data[k].length : ''}</button>`)}</div><${Suggestions} kind=${sk} sugg=${sugg} busy=${busy || sending} onUse=${t => { setText(t); setTarget('asset'); setFailed(null); try { ta.current && ta.current.focus(); } catch (e) {} }} onApply=${t => { if (window.confirm('Apply this suggestion to ' + a.title + ' as it stands? One model call reads it against the composition; the result lands as a new version (a render is only proposed, never spent without your yes).')) { setTarget('asset'); send(t); } }} onRefresh=${onSuggRefresh} />` : ro ? html`<div class="ov-dim">Suggestions need a full key.</div>` : null}
          <div class="st-cd-new"><span class="st-lbl">New directions</span><span class="ov-dim">Different ideas for this piece, not tweaks: the Images tool proposes three or four directions (one model call that sees the artwork); each card states its cost before anything is applied.</span>${onTool ? html`<button class="btn sm ghost" onClick=${() => onTool('images')}>Open art direction</button>` : null}<span class="ov-dim">Free alternatives of the same words and imagery are in the Design tool's layout variations.</span>${onTool ? html`<button class="btn sm ghost" onClick=${() => onTool('design')}>Open layout variations</button>` : null}</div>
        </div>` : null}
        ${cur === 'conversation' ? html`<div class="st-cd-conv">
          <div class="st-cd-convhead">${a ? html`<div class="st-seg" role="group" aria-label="Conversation scope"><button class=${'st-segbtn' + (scope === 'asset' ? ' on' : '')} aria-pressed=${scope === 'asset'} onClick=${() => setScope('asset')}>${a.title}</button><button class=${'st-segbtn' + (scope === 'project' ? ' on' : '')} aria-pressed=${scope === 'project'} onClick=${() => setScope('project')}>Whole project</button></div>` : null}<span class="ov-dim">${dialogue.length} message${dialogue.length === 1 ? '' : 's'}</span></div>
          <div class="st-thread">${dialogue.length ? dialogue.map(msg) : html`<div class="ov-dim st-cd-empty">${a && scope === 'asset' ? 'Nothing said about ' + a.title + ' yet.' : 'Nothing said yet.'} Direct the work below: every change lands as a version, nothing is approved for you.</div>`}
            ${busy ? html`<div class="st-msg studio"><div class="st-msg-text ov-dim">${busy}</div></div>` : null}</div>
          ${log.length ? html`<details class="st-cd-log" open=${showLog} onToggle=${e => setShowLog(e.currentTarget.open)}><summary>Studio log (${log.length})</summary><ul class="st-cd-loglist">${log.slice(-60).map(m => html`<li key=${m.id}><span class="ov-dim">${aest(m.at)}</span> <b>${m.kind}</b> ${m.text || ''}${m.render ? html` <${Chip} kind="warn">render spent</${Chip}>` : m.render === false ? html` <${Chip} kind="ok">no render</${Chip}>` : null}</li>`)}</ul></details>` : null}
        </div>` : null}
      </div>
      ${!ro ? html`<div class="st-composer">
        ${failed ? html`<div class="st-send-fail" role="alert"><b>${failed.title}</b>${failed.detail ? html` <span class="ov-dim">${failed.detail}</span>` : null} <span class="ov-dim">Your words are still here.</span><span class="st-send-fail-acts">${failed.retry ? html`<button class="btn sm" disabled=${sending || !!busy} onClick=${() => send(text.trim() ? text : failed.text)}>Retry</button>` : null}<button class="btn sm ghost" onClick=${() => { setFailed(null); try { ta.current && ta.current.focus(); } catch (e) {} }}>Edit</button></span></div>` : null}
        <div class="st-composer-row">
          <select class="st-sel" value=${target} onChange=${e => setTarget(e.target.value)} aria-label="Target of the direction">${targets.map(([k, l]) => html`<option key=${k} value=${k} disabled=${k !== 'set' && !a}>${l}</option>`)}</select>
          ${a && target === 'asset' && sc.length ? html`<span class="st-sel-about" role="status"><span class="st-lbl">About the selection</span> ${sc.map(id => html`<span key=${id} class="st-mini-chip" title=${id}>${layerName(id)}</span>`)} <span class="ov-dim">the rest stays as it is</span></span>` : null}
        </div>
        <textarea ref=${ta} class="st-ta" rows="2" value=${text} placeholder=${'Tell the Creative Director, e.g. "Keep the layout, sharpen the headline", "three alternative opening lines", "adapt this for Instagram"'} onInput=${e => setText(e.target.value)} onKeyDown=${keyDown} onCompositionStart=${() => { composing.current = true; }} onCompositionEnd=${() => { setTimeout(() => { composing.current = false; }, 0); }} aria-label="Instruction to the Creative Director" aria-describedby="st-cd-hint"></textarea>
        <div class="st-composer-acts"><button class="btn sm" disabled=${!!why()} title=${why() || 'Send (Enter); Shift+Enter for a new line'} onClick=${() => send()}>${sending ? 'Sending...' : 'Send'}</button><button class="ov-link" disabled=${!text.trim() || sending} onClick=${async () => { const t = text.trim(); const ok0 = await onNote(t, target === 'set' ? 'the whole set' : (a || {}).title || ''); if (ok0 !== false) setText(cur0 => (cur0.trim() === t ? '' : cur0)); }}>record as a note instead</button><span id="st-cd-hint" class="ov-dim st-cd-hint">${sending ? 'Sending; your words stay until the Studio accepts them.' : 'Enter sends; Shift+Enter is a new line. One model call; changes land as versions.'}</span></div>
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
  /* S11: the editor draws on the canvas; its panels (type, box, framing, held mark) render into the Properties tab and its
     layer list into the left panel when those slots are given (portals), so the canvas carries the artwork and its handles only.
     onSel reports the selection (ids) so the Properties tab and the layer list follow it; guides is the overlays switch. */
  function LayoutEditor({ v, a, ns, p, kit, onDone, onDirty, propsSlot, layersSlot, toolsSlot, footSlot, onSel, guides: guidesOn, preview, onMore, highlight }) {
    const E = window.STEditor || {};
    // the working layout with its history: every finished gesture or command is one step that undo and redo walk. Words typed on
    // the canvas for the approved copy ride in the working layout as _copy, so undo walks them too; they are saved as copy.
    // S19: an edit left on this exact version comes back from the working store (a switch of asset, stage or project does not lose it)
    const work0 = useMemo(() => { const w = WORK.get(a.id); return w && w.base === v.id && w.layout && Array.isArray(w.layout.layers) ? w : null; }, []);
    const [hist, setHist] = useState(() => ({ past: [], now: JSON.parse(JSON.stringify(work0 ? work0.layout : v.layout)), future: [] }));
    const layout = hist.now;
    const [sel, setSelIds] = useState([]); const [focusId, setFocus] = useState(null); const [guides0, setGuides] = useState(true); const [scaleType, setScaleType] = useState(false); const box = useRef(null); const act = useRef(null);
    const [grid, setGrid] = useState(false); const [snapLines, setSnapLines] = useState([]); const [marquee, setMarquee] = useState(null); const [keysOpen, setKeysOpen] = useState(false);
    const [editing, setEditing] = useState(null); const [fontOpen, setFontOpen] = useState(false); const [fontPreview, setFontPreview] = useState(null);
    const guides = guidesOn == null ? guides0 : (guidesOn && guides0);
    useEffect(() => { if (onSel) onSel(sel); }, [sel.join(',')]);
    const clickFocus = useRef(null);   // the layer being focused by a click (the click already chose the selection; keyboard focus selects)
    const commit = next => setHist(h => ({ past: h.past.concat([h.now]).slice(-80), now: next, future: [] }));
    const live = next => setHist(h => Object.assign({}, h, { now: next }));            // during a drag; the step is committed on release
    const undo = () => setHist(h => h.past.length ? { past: h.past.slice(0, -1), now: h.past[h.past.length - 1], future: [h.now].concat(h.future) } : h);
    const redo = () => setHist(h => h.future.length ? { past: h.past.concat([h.now]), now: h.future[0], future: h.future.slice(1) } : h);
    const layers = layout.layers;
    const wcopy = Object.assign({}, v.copy || {}, layout._copy || {});
    const byId = id => layers.find(l => l.id === id);
    const groupOf = id => { const l = byId(id); return l && l.group ? layers.filter(x => x.group === l.group).map(x => x.id) : [id]; };
    const selected = () => Array.from(new Set(sel.reduce((acc, id) => acc.concat(groupOf(id)), []))).map(byId).filter(Boolean);
    // a mark held by a mandatory campaign rule is not the editor's to move; a locked layer is not the editor's to touch at all
    const heldMark = l => !!(l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark') && l.rule && l.rule.mandatory);
    const isMarkL = l => !!(l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark'));
    const exactImg = l => !!(l && l.type === 'img' && (l.exact || l.role === 'logo' || l.role === 'wordmark'));
    const movable = l => l && !l.locked && !heldMark(l);
    const patchMany = (L, patches) => Object.assign({}, L, { layers: L.layers.map(l => { if (!patches[l.id]) return l; const n = Object.assign({}, l, patches[l.id]); Object.keys(n).forEach(k => { if (n[k] === undefined) delete n[k]; }); return n; }) });
    const r1 = x => Math.round(x * 10) / 10;
    const pick = (e, l) => { setFocus(l.id); setSelIds(s => e.shiftKey ? (s.indexOf(l.id) >= 0 ? s.filter(x => x !== l.id) : s.concat([l.id])) : (s.indexOf(l.id) >= 0 && s.length > 1 ? s : [l.id])); };
    /* every gesture goes through one pointer path, throttled to the display's frames: move, resize from eight handles, rotate */
    const raf = useRef(0); const pend = useRef(null);
    const down = (e, l, mode) => { e.preventDefault(); e.stopPropagation(); if (editing) return; pick(e, l);
      // preventDefault keeps the browser from focusing the layer, so focus it by hand: the arrow keys then nudge what was clicked
      try { const el = mode === 'move' ? e.currentTarget : e.currentTarget.closest('.st-le-layer'); if (el && el.focus) { clickFocus.current = l.id; el.focus({ preventScroll: true }); clickFocus.current = null; } } catch (x) {}
      if (!movable(l)) return; const r = box.current.getBoundingClientRect();
      const ids = mode === 'move' ? Array.from(new Set((sel.indexOf(l.id) >= 0 && !e.shiftKey ? sel : [l.id]).reduce((acc, id) => acc.concat(groupOf(id)), []))).filter(id => movable(byId(id))) : [l.id];
      // the measured boxes as they stand when the gesture starts: the moving ones (their ink, offset by the drag) and every other
      // visible layer (the guides they offer) - taken once, since the live layout moves the measurement with it
      const boxes = mode === 'move' ? ids.map(id => inkOf(byId(id))) : null;
      const others = mode === 'move' ? layers.filter(o => !o.hidden && ids.indexOf(o.id) < 0 && o.role !== 'overlay').map(inkOf).filter(b => b.w > 0 && b.w < 99) : null;
      act.current = { id: l.id, ids, mode, sx: e.clientX, sy: e.clientY, start: layout, rw: r.width, rh: r.height, rl: r.left, rt: r.top, boxes, others }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const apply = e => { const c = act.current; if (!c) return; const dx = (e.clientX - c.sx) / c.rw * 100, dy = (e.clientY - c.sy) / c.rh * 100; const patches = {};
      if (c.mode === 'move') {
        c.ids.forEach(id => { const o = c.start.layers.find(x => x.id === id); if (movable(o)) patches[id] = { x: r1(Math.max(-o.w + 2, Math.min(98, o.x + dx))), y: r1(Math.max(-2, Math.min(98, o.y + dy))) }; });
        // snapping: the moving selection's measured edges and centre settle on the stage, the safe area, a grid and the other layers'
        // edges and centres within 0.8% (Alt to pass), and the guide they settled on is drawn while the gesture lasts
        let lines = [];
        if (!e.altKey && c.ids.length) {
          const bx = c.boxes.map(b => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }));
          const u = { x: Math.min.apply(null, bx.map(b => b.x)), y: Math.min.apply(null, bx.map(b => b.y)) }; u.w = Math.max.apply(null, bx.map(b => b.x + b.w)) - u.x; u.h = Math.max.apply(null, bx.map(b => b.y + b.h)) - u.y;
          const sn = E.snapMove ? E.snapMove(u, c.others, edges(), { grid: grid ? 10 : 0 }) : { dx: 0, dy: 0, guides: [] };
          if (sn.dx || sn.dy) Object.keys(patches).forEach(id => { patches[id].x = r1(patches[id].x + sn.dx); patches[id].y = r1(patches[id].y + sn.dy); });
          lines = sn.guides;
        }
        setSnapLines(lines);
      }
      else if (c.mode === 'rotate') { const o = c.start.layers.find(x => x.id === c.id); const cx = c.rl + (o.x + o.w / 2) / 100 * c.rw, cy = c.rt + (o.y + (o.h || 0) / 2) / 100 * c.rh; const ang = E.angleTo ? E.angleTo(cx, cy, e.clientX, e.clientY, e.shiftKey) : 0; patches[o.id] = { rotate: ang || undefined }; }
      // the corner and the sides resize the box in the layer's own frame; the type keeps its size unless "resize scales type" is on;
      // an exact image (a logo or wordmark) keeps its proportions whatever the handle does: a mark is never distorted
      else { const o = c.start.layers.find(x => x.id === c.id); const hnd = c.mode === 'resize' ? 'se' : c.mode.slice(7);
        const keep = exactImg(o) || (e.shiftKey && hnd.length === 2) || (o.type === 'text' && scaleType && hnd.length === 2);
        const rz = E.resizeLocal ? E.resizeLocal(o, hnd, e.clientX - c.sx, e.clientY - c.sy, c.rw, c.rh, { keep, centre: e.altKey, minW: o.type === 'text' ? 6 : exactImg(o) ? 4 : 2, minH: o.type === 'text' ? 2 : 1 }) : null;
        if (rz) { const pt = { x: rz.x, y: rz.y, w: rz.w, h: rz.h }; if (o.type === 'text' && scaleType) pt.size = r1(Math.max(1.2, o.size * rz.k)); patches[o.id] = pt; } }
      live(patchMany(c.start, patches)); };
    const move = e => { if (marquee && marquee.on) { marqueeMove(e); return; } if (!act.current) return; pend.current = { clientX: e.clientX, clientY: e.clientY, altKey: e.altKey, shiftKey: e.shiftKey }; if (!raf.current) raf.current = requestAnimationFrame(() => { raf.current = 0; const q = pend.current; pend.current = null; if (q) apply(q); }); };
    const up = () => { if (marquee && marquee.on) { marqueeUp(); return; } if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; } if (pend.current) { const q = pend.current; pend.current = null; apply(q); } const c = act.current; act.current = null; setSnapLines([]); if (c) setHist(h => (JSON.stringify(c.start) !== JSON.stringify(h.now) ? { past: h.past.concat([c.start]).slice(-80), now: h.now, future: [] } : h)); };
    /* a marquee from the empty stage selects every visible, unlocked layer it touches (Shift adds to the selection); a click selects nothing */
    const marqueeDown = e => { if (editing || preview) return; if (e.target.closest && (e.target.closest('.st-le-layer') || e.target.closest('.st-fbar') || e.target.closest('.st-le-frame') || e.target.closest('.st-le-fontwrap') || e.target.closest('.st-le-textedit'))) return; const r = box.current.getBoundingClientRect(); const x0 = (e.clientX - r.left) / r.width * 100, y0 = (e.clientY - r.top) / r.height * 100; setMarquee({ on: true, x0, y0, x1: x0, y1: y0, add: e.shiftKey, base: e.shiftKey ? sel : [] }); try { box.current.setPointerCapture(e.pointerId); } catch (x) {} };
    const marqueeMove = e => { const r = box.current.getBoundingClientRect(); setMarquee(m => m ? Object.assign({}, m, { x1: (e.clientX - r.left) / r.width * 100, y1: (e.clientY - r.top) / r.height * 100 }) : m); };
    const marqueeUp = () => { const m = marquee; setMarquee(null); if (!m) return; const x = Math.min(m.x0, m.x1), y = Math.min(m.y0, m.y1), w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
      if (w < 0.6 && h < 0.6) { if (!m.add) setSelIds([]); return; }
      const hit = layers.filter(l => !l.hidden && !l.locked).filter(l => { const b = inkOf(l); return b.x < x + w && b.x + b.w > x && b.y < y + h && b.y + b.h > y; }).map(l => l.id);
      setSelIds(Array.from(new Set(m.base.concat(hit)))); };
    const nudge = (dx, dy) => { const s = selected().filter(movable); if (!s.length) return; const patches = {}; s.forEach(l => { patches[l.id] = { x: r1(l.x + dx), y: r1(l.y + dy) }; }); commit(patchMany(layout, patches)); };
    /* alignment: to the selection's bounds when two or more are chosen; to the format's safe area when one is - each edge its own
       inset (a 9:16 story's top is 14% and its bottom 20%, the sides 6%; a feed tile 3% all round), the same table the rules,
       the guides, repair() and the export judge by - and on the layer's measured ink (the words, a mark's visible pixels), not
       its box, so what lines up is what the eye sees */
    const edges = () => { const sa0 = R.safeArea ? R.safeArea(a.format, a.channel) : { side: 0.03, top: 0.03, bottom: 0.03 }; return { left: sa0.side * 100, right: 100 - sa0.side * 100, top: sa0.top * 100, bottom: 100 - sa0.bottom * 100 }; };
    const inkOf = l => { const b = ink[l.id]; return b && b.w > 0 && b.h > 0 && !l.rotate ? b : { x: l.x, y: l.y, w: l.w, h: l.h || 0 }; };
    const align = how => { const s = selected().filter(movable); if (!s.length) return; const one = s.length === 1; const E2 = edges();
      const bx = s.map(inkOf);
      const L0 = one ? E2.left : Math.min.apply(null, bx.map(b => b.x)), R0 = one ? E2.right : Math.max.apply(null, bx.map(b => b.x + b.w)), T0 = one ? E2.top : Math.min.apply(null, bx.map(b => b.y)), B0 = one ? E2.bottom : Math.max.apply(null, bx.map(b => b.y + b.h));
      const patches = {}; s.forEach((l, i) => { const b = bx[i]; const dl = b.x - l.x, dt = b.y - l.y;   // where the ink sits inside the box
        patches[l.id] = how === 'left' ? { x: r1(L0 - dl) } : how === 'right' ? { x: r1(R0 - b.w - dl) } : how === 'centre' ? { x: r1((L0 + R0) / 2 - b.w / 2 - dl) } : how === 'top' ? { y: r1(T0 - dt) } : how === 'bottom' ? { y: r1(B0 - b.h - dt) } : { y: r1((T0 + B0) / 2 - b.h / 2 - dt) }; });
      commit(patchMany(layout, patches)); };
    const distribute = axis => { const s = selected().filter(movable).slice().sort((p0, q) => axis === 'v' ? p0.y - q.y : p0.x - q.x); if (s.length < 3) return;
      const size = l => axis === 'v' ? (l.h || 0) : l.w; const pos = l => axis === 'v' ? l.y : l.x; const first = s[0], last = s[s.length - 1];
      const gap = (pos(last) + size(last) - pos(first) - s.reduce((n, l) => n + size(l), 0)) / (s.length - 1); let at = pos(first); const patches = {};
      s.forEach(l => { patches[l.id] = axis === 'v' ? { y: r1(at) } : { x: r1(at) }; at += size(l) + gap; }); commit(patchMany(layout, patches)); };
    // paint order: the selection (a group moves as one) goes to the front or back, or one step, keeping its own order
    const reorder = how => { const s = selected().filter(movable); if (!s.length) return; const set = new Set(s.map(l => l.id)); const rest = layers.filter(l => !set.has(l.id)); const block = layers.filter(l => set.has(l.id));
      let at; const firstI = layers.findIndex(l => set.has(l.id)); const before = layers.slice(0, firstI).filter(l => !set.has(l.id)).length;
      at = how === 'front' ? rest.length : how === 'back' ? 0 : how === 'forward' ? Math.min(rest.length, before + 1) : Math.max(0, before - 1);
      commit(Object.assign({}, layout, { layers: rest.slice(0, at).concat(block, rest.slice(at)) })); };
    // the layer list drags a layer to a new place in the paint order (one step)
    const moveTo = (id, toIndex) => { const l = byId(id); if (!l || !movable(l)) return; const rest = layers.filter(x => x.id !== id); const at = Math.max(0, Math.min(rest.length, toIndex)); commit(Object.assign({}, layout, { layers: rest.slice(0, at).concat([l], rest.slice(at)) })); };
    const group = () => { const s = selected().filter(movable); if (s.length < 2) return; const g = 'g' + Date.now().toString(36); const patches = {}; s.forEach(l => { patches[l.id] = { group: g }; }); commit(patchMany(layout, patches)); };
    const ungroup = () => { const patches = {}; selected().filter(movable).forEach(l => { patches[l.id] = { group: undefined }; }); commit(patchMany(layout, patches)); };
    const setOne = (id, patch) => commit(patchMany(layout, { [id]: patch }));
    const setEach = fn => { const patches = {}; selected().filter(movable).forEach(l => { patches[l.id] = fn(l); }); if (Object.keys(patches).length) commit(patchMany(layout, patches)); };
    /* add, duplicate, delete, copy and paste. The approved words are hidden rather than deleted (they stay in the copy), and a
       mark is never duplicated or deleted here: it is placed from its file by the campaign policy */
    const add = (kind, o) => { const n = E.newLayer ? E.newLayer(kind, o, layout) : null; if (!n) return; commit(Object.assign({}, layout, { layers: layers.concat([n]) })); setSelIds([n.id]); setFocus(n.id); };
    const addImage = async f => { if (!p) return; try { toastMsg('Placing ' + f.name + '...'); const r = await E.uploadImage(p.id, f); add('image', r); } catch (e) { toastMsg('The image was not placed: ' + e.message, true); } };
    const replaceImage = l => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp'; inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { const r = await E.uploadImage(p.id, f); setOne(l.id, { key: r.key, src: r.url, name: r.name }); } catch (e) { toastMsg('The image was not replaced: ' + e.message, true); } }; inp.click(); };
    const duplicate = () => { const s = selected().filter(l => !l.locked); if (!s.length || !E.cloneLayers) return; const n = E.cloneLayers(s, wcopy, layout); if (!n.length) { toastMsg('A mark is placed from its file and is not duplicated', true); return; } commit(Object.assign({}, layout, { layers: layers.concat(n) })); setSelIds(n.map(x => x.id)); };
    const removeLayers = s => { if (!s.length) return; const out = [], hide = [], keep = [];
      s.forEach(l => { if (l.locked || heldMark(l)) keep.push(l); else if (isMarkL(l)) keep.push(l); else if (l.type === 'text' && (E.COPY_ROLES || []).indexOf(l.role) >= 0) hide.push(l); else out.push(l.id); });
      if (!out.length && !hide.length) { toastMsg('Not removed: ' + keep.map(l => (l.role || l.type) + (l.locked ? ' is locked' : ' is placed by the campaign policy')).join('; '), true); return; }
      const patches = {}; hide.forEach(l => { patches[l.id] = { hidden: true }; });
      commit(Object.assign({}, patchMany(layout, patches), { layers: patchMany(layout, patches).layers.filter(l => out.indexOf(l.id) < 0) })); setSelIds([]);
      // the focused layer has just left the canvas: keep the keyboard on the stage so Ctrl+Z brings it back
      try { if (box.current) box.current.focus({ preventScroll: true }); } catch (x) {}
      if (hide.length) toastMsg('Hidden, not deleted: the ' + hide.map(l => l.role).join(' and ') + (hide.length === 1 ? ' stays' : ' stay') + ' in the approved copy' + (keep.length ? '; kept: ' + keep.map(l => l.role || l.type).join(', ') : ''));
      else if (keep.length) toastMsg('Kept: ' + keep.map(l => (l.role || l.type) + (l.locked ? ' (locked)' : ' (placed by the campaign policy)')).join(', ')); };
    const remove = () => removeLayers(selected());
    const clipKey = 'ax_studio_clip';
    const copySel = () => { const s = selected().filter(l => !isMarkL(l)); if (!s.length) return; try { localStorage.setItem(clipKey, JSON.stringify({ layers: E.cloneLayers ? E.cloneLayers(s, wcopy, layout, 0) : [], at: Date.now() })); toastMsg('Copied ' + s.length + ' layer' + (s.length === 1 ? '' : 's')); } catch (e) {} };
    const paste = () => { let c = null; try { c = JSON.parse(localStorage.getItem(clipKey) || 'null'); } catch (e) {} if (!c || !Array.isArray(c.layers) || !c.layers.length) return; const n = E.cloneLayers(c.layers, wcopy, layout, 2).filter(l => l.type !== 'img' || (l.key && p && l.key.indexOf('studio/' + p.id + '/') === 0)); if (!n.length) { toastMsg('Nothing to paste here (an image from another project is not carried)', true); return; } commit(Object.assign({}, layout, { layers: layers.concat(n) })); setSelIds(n.map(x => x.id)); };
    /* the words typed on the canvas: the approved copy for its roles (the same words as the Copy tab, saved with the layout), the
       layer's own text otherwise; a locked field is not opened */
    const startEdit = l => { if (!l || l.type !== 'text' || l.locked || preview) return; const copyRole = (E.COPY_ROLES || []).indexOf(l.role) >= 0; if (copyRole && a.locks && a.locks[l.role]) { toastMsg('The ' + l.role + ' is locked on this asset: unlock it in the Copy tab to change its words', true); return; } if (l.part != null) { toastMsg('These words are part of the approved ' + l.role + ': edit the ' + l.role + ' in the Copy tab', true); return; } setSelIds([l.id]); setEditing(l.id); };
    const commitEdit = (l, t) => { setEditing(null); const copyRole = (E.COPY_ROLES || []).indexOf(l.role) >= 0; if (copyRole) commit(Object.assign({}, layout, { _copy: Object.assign({}, layout._copy || {}, { [l.role]: t }) })); else setOne(l.id, { text: t }); };
    const keyAll = e => { const mod = e.metaKey || e.ctrlKey;
      // a key typed into a field edits the field: the canvas shortcuts (nudge, undo, redo, escape) never take it
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable)) return;
      if (mod && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (mod && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (mod && (e.key === 'a' || e.key === 'A')) { e.preventDefault(); setSelIds(layers.filter(l => !l.hidden && !l.locked).map(l => l.id)); return; }
      if (mod && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copySel(); return; }
      if (mod && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); paste(); return; }
      if (mod && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); duplicate(); return; }
      if (mod && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); if (e.shiftKey) ungroup(); else group(); return; }
      // read by the key's place, not its character: with Shift held the bracket arrives as a brace on most layouts
      const br = e.code === 'BracketRight' || e.key === ']' || e.key === '}' ? ']' : e.code === 'BracketLeft' || e.key === '[' || e.key === '{' ? '[' : '';
      if (mod && br) { e.preventDefault(); reorder(br === ']' ? (e.shiftKey ? 'front' : 'forward') : (e.shiftKey ? 'back' : 'backward')); return; }
      if (e.key === '?' && !mod) { e.preventDefault(); setKeysOpen(true); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.length) { e.preventDefault(); remove(); } return; }
      if (e.key === 'Enter' && sel.length === 1 && byId(sel[0]) && byId(sel[0]).type === 'text') { e.preventDefault(); startEdit(byId(sel[0])); return; }
      if (e.key === 'Escape') { setSelIds([]); setFontOpen(false); return; }
      const step = e.shiftKey ? 2 : 0.5; const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]; if (d) { e.preventDefault(); nudge(d[0], d[1]); } };
    // a key pressed while nothing has focus (the layer it was on was hidden or deleted, a click landed on the empty page) still
    // reaches the canvas; a text selection on the page keeps its own copy and select-all
    const keyRef = useRef(null); keyRef.current = keyAll;
    useEffect(() => { const on = e => { const ae = document.activeElement; if (ae && ae !== document.body && ae !== document.documentElement) return;
      const ts = window.getSelection ? window.getSelection() : null; if (ts && !ts.isCollapsed && (e.ctrlKey || e.metaKey) && /^[acAC]$/.test(e.key)) return;
      if (keyRef.current) keyRef.current(e); };
      document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on); }, []);
    // what is drawn: the working layout, a family being previewed from the font picker, and the words being typed hidden underneath
    const drawn = useMemo(() => { let L = layout; if (fontPreview && fontPreview.ids.length) L = patchMany(L, fontPreview.ids.reduce((o, id) => { o[id] = { family: fontPreview.family || undefined }; return o; }, {})); if (editing) L = patchMany(L, { [editing]: { hidden: true } }); return L; }, [layout, fontPreview, editing]);
    // the same validation the readiness uses, at the output size, on the working layout (debounced)
    const comp = useComposition(Object.assign({}, v, { layout: drawn, copy: wcopy }), ns, drawn, wcopy);
    const [val, setVal] = useState(null);
    useEffect(() => { if (!comp.ready) return; const t = setTimeout(() => { try { setVal(R.validate(layout, wcopy, comp.imgs, { fonts: comp.fonts, channel: a.channel, format: a.format })); } catch (e) { setVal(null); } }, 250); return () => clearTimeout(t); }, [layout, comp.key, comp.ready]);
    const bad = new Set(); (val ? val.issues : []).filter(i => i.severity === 'blocking').forEach(i => i.layers.forEach(id => bad.add(id)));
    // the handles sit on what the renderer measured - the words' ink, a mark's visible pixels - not on the layer box, so what you
    // grab is what you see; the layer box is drawn faintly behind when it differs (the same scene the rules judge). A turned layer
    // is framed by its own box, turned with it, so its handles resize along its own sides.
    const ink = useMemo(() => { const o = {}; if (!comp.ready || !layout.stage) return o; try { const W = layout.stage.w, H = layout.stage.h; R.measure(layout, wcopy, comp.imgs, W, H).forEach(b => { if (b.hidden || b.empty || b.valid === false) return; if (b.type === 'text' || (b.mark && b.asset === 'loaded')) o[b.id] = { x: b.x / W * 100, y: b.y / H * 100, w: b.w / W * 100, h: b.h / H * 100 }; }); } catch (e) {} return o; }, [layout, comp.key, comp.ready]);
    const geo = l => { const bx0 = { x: l.x, y: l.y, w: l.w, h: l.h || 4 }; if (l.rotate) return { on: bx0, box: null, turned: true }; const b = ink[l.id]; if (!b || b.w <= 0 || b.h <= 0) return { on: bx0, box: null }; const same = Math.abs(b.x - bx0.x) < 0.3 && Math.abs(b.y - bx0.y) < 0.3 && Math.abs(b.w - bx0.w) < 0.3 && Math.abs(b.h - bx0.h) < 0.3; return { on: b, box: same ? null : bx0 }; };
    const sa = R.safeArea ? R.safeArea(a.format, a.channel) : { top: 0.03, bottom: 0.03, side: 0.03, hard: false }; const story = sa.hard;
    /* framing by dragging: the photograph (or the selected region's image) is panned inside its box through the renderer's own
       transform (panFocus inverts coverTransform), the wheel zooms about the same focus, and one drag or one zoom gesture is one
       undo step. The likely subjects of the photograph are marked as an estimate with their confidence; "Keep the subject clear"
       applies the measured framing the renderer suggests, as a layout change that renders nothing. */
    const [frame, setFrame] = useState(false); const pan = useRef(null); const wheelT = useRef(null);
    const subj = useMemo(() => { if (!comp.ready || !comp.imgs.bg || layout.noImagery || !R.subjects) return null; try { return R.subjects(comp.imgs.bg); } catch (e) { return null; } }, [comp.key, comp.ready]);
    const subjOn = useMemo(() => { if (!subj || !subj.regions.length || !layout.stage) return []; try { const W = layout.stage.w, H = layout.stage.h; return R.subjectCoverage(layout, comp.imgs, R.measure(layout, wcopy, comp.imgs, W, H), W, H, subj).map(s => ({ id: s.id, x: s.x / W * 100, y: s.y / H * 100, w: s.w / W * 100, h: s.h / H * 100, covered: s.covered, confidence: s.confidence })); } catch (e) { return []; } }, [layout, comp.key, comp.ready, subj]);
    const suggestion = useMemo(() => { if (!subj || !subj.regions.length || !comp.ready || !R.frameSuggest) return null; try { return R.frameSuggest(layout, wcopy, comp.imgs, { format: a.format }); } catch (e) { return null; } }, [layout, comp.key, comp.ready, subj]);
    const frameTarget = () => { const s = selected(); const reg = s.length === 1 && s[0].type === 'img' && s[0].role === 'region' && !s[0].locked ? s[0] : null; if (reg) { const im = comp.imgs[reg.id]; if (!im) return null; return { reg, img: im, box: { x: reg.x, y: reg.y, w: reg.w, h: reg.h || 0 }, focus: reg.focus }; } if (!comp.imgs.bg) return null; const ib = layout.image && layout.image.w > 0 ? layout.image : { x: 0, y: 0, w: 100, h: 100 }; return { reg: null, img: comp.imgs.bg, box: ib, focus: layout.imageFocus }; };
    const applyFocus = (L0, t, nf) => { const plain = nf.x === 50 && nf.y === 50 && nf.zoom === 1; const val2 = plain ? undefined : nf; return t.reg ? patchMany(L0, { [t.reg.id]: { focus: val2 } }) : Object.assign({}, L0, { imageFocus: val2 }); };
    const frameDown = e => { const t = frameTarget(); if (!t || !layout.stage) return; e.preventDefault(); e.stopPropagation(); const r = box.current.getBoundingClientRect(); pan.current = { t, sx: e.clientX, sy: e.clientY, start: layout, k: layout.stage.w / r.width }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const frameMove = e => { const c = pan.current; if (!c) return; const W = c.start.stage.w, H = c.start.stage.h; const bx = { x: c.t.box.x / 100 * W, y: c.t.box.y / 100 * H, w: c.t.box.w / 100 * W, h: c.t.box.h / 100 * H }; const nf = R.panFocus(c.t.img.naturalWidth, c.t.img.naturalHeight, bx, c.t.focus, (e.clientX - c.sx) * c.k, (e.clientY - c.sy) * c.k); live(applyFocus(c.start, c.t, nf)); };
    const frameUp = () => { const c = pan.current; pan.current = null; if (c && JSON.stringify(c.start) !== JSON.stringify(layout)) setHist(h => ({ past: h.past.concat([c.start]).slice(-80), now: h.now, future: [] })); };
    const frameWheel = e => { const t = frameTarget(); if (!t) return; e.preventDefault(); const f = t.focus || {}; const cur = { x: f.x == null ? 50 : f.x, y: f.y == null ? 50 : f.y, zoom: f.zoom || 1 }; const nf = Object.assign({}, cur, { zoom: Math.round(Math.max(1, Math.min(3, cur.zoom - Math.sign(e.deltaY) * 0.05)) * 100) / 100 }); if (nf.zoom === cur.zoom) return; if (!wheelT.current) wheelT.current = { start: layout }; live(applyFocus(layout, t, nf)); clearTimeout(wheelT.current.timer); wheelT.current.timer = setTimeout(() => { const s0 = wheelT.current && wheelT.current.start; wheelT.current = null; if (s0) setHist(h => (JSON.stringify(s0) !== JSON.stringify(h.now) ? { past: h.past.concat([s0]).slice(-80), now: h.now, future: [] } : h)); }, 500); };
    // the wheel is bound natively and non-passively on the overlay, so zooming the photograph never scrolls the page under it
    const frameRef = useRef(null); const wheelFn = useRef(null); wheelFn.current = frameWheel;
    useEffect(() => { const el = frameRef.current; if (!frame || !el) return; const h = e => { if (wheelFn.current) wheelFn.current(e); }; el.addEventListener('wheel', h, { passive: false }); return () => el.removeEventListener('wheel', h); }, [frame]);
    const strip = L => { const o = Object.assign({}, L); delete o._copy; return o; };
    const patchOf = L => { const c = (L || layout)._copy || {}; const out = {}; Object.keys(c).forEach(k => { if (c[k] !== ((v.copy || {})[k] || '')) out[k] = c[k]; }); return Object.keys(out).length ? out : null; };
    const copyPatch = () => patchOf(layout);
    const isChanged = L => JSON.stringify(strip(L)) !== JSON.stringify(v.layout) || !!patchOf(L);
    const changed = isChanged(layout);
    // words being typed on the canvas, not yet committed: they belong to the working state too
    const pendingText = useRef(null);
    const foldText = (L, pt) => { if (!pt) return L; const l = (L.layers || []).find(x => x.id === pt.id); if (!l) return L; const copyRole = (E.COPY_ROLES || []).indexOf(l.role) >= 0; if (copyRole) return Object.assign({}, L, { _copy: Object.assign({}, L._copy || {}, { [l.role]: pt.t }) }); return Object.assign({}, L, { layers: L.layers.map(x => x.id === pt.id ? Object.assign({}, x, { text: pt.t }) : x) }); };
    // unsaved edits are a state the whole page knows about (the header names them, leaving the page asks), never a silent loss
    /* the draft: the working layout autosaved for this person a moment after each change (never a version), restored on return.
       S19: the draft is kept until a version holding the edit is acknowledged; a failed or conflicting save leaves it, and autosave
       carries on. The save line names each state: Unsaved, Saving recovery draft, Draft saved, Saving version, Save failed. */
    // back from the working store: when the recovery draft already holds exactly this, say so (Draft saved), not Unsaved
    const [draftSt, setDraftSt] = useState(() => work0 && MERGE && work0.draftSig && work0.draftSig === MERGE.sig({ l: strip(work0.layout), c: work0.layout._copy || {} }) ? { state: 'saved', at: work0.at, sig: work0.draftSig } : null); const [restore, setRestore] = useState(null); const draftT = useRef(null); const draftOn = useRef(true);
    const [saveSt, setSaveSt] = useState(null);           // {state: 'saving'|'failed'|'conflict', msg}
    const draftSig = useRef(work0 && work0.draftSig || null);   // the content the server draft holds
    const savedSig = useRef(null); const savedTo = useRef(null);   // the content a version now holds, and that version's id
    const layoutRef = useRef(layout); layoutRef.current = layout;
    const sigOf = L => (MERGE ? MERGE.sig({ l: strip(L), c: L._copy || {} }) : JSON.stringify(L).length + '');
    const sendDraft = (L, now) => { const sg = sigOf(L); if (sg === draftSig.current) return Promise.resolve({ same: true }); if (!now) setDraftSt({ state: 'saving' }); return call('/studio/draft', { asset: a.id, version: v.id, layout: strip(L), copy: L._copy || {} }).then(r => { draftSig.current = sg; const w = WORK.get(a.id); if (w && w.base === v.id) WORK.set(a.id, Object.assign({}, w, { draftSig: sg })); if (!now) setDraftSt({ state: 'saved', at: r.at || Date.now(), sig: sg }); return r; }).catch(e => { if (!now) setDraftSt({ state: 'error', msg: e.message }); throw e; }); };
    useEffect(() => { let live2 = true; if (work0) { toastMsg('Your unsaved changes to ' + a.title + ' are back'); return () => { live2 = false; }; } call('/studio/draft?asset=' + encodeURIComponent(a.id)).then(d => { if (!live2 || !d || !d.draft || !d.draft.layout) return; const same = JSON.stringify(d.draft.layout) === JSON.stringify(v.layout) && !Object.keys(d.draft.copy || {}).some(k => d.draft.copy[k] !== ((v.copy || {})[k] || '')); if (!same) setRestore(d.draft); }).catch(() => {}); return () => { live2 = false; }; }, []);
    // the working store follows every change; the server draft follows a moment later
    useEffect(() => { if (changed) WORK.set(a.id, { base: v.id, project: p && p.id, ns, layout, draftSig: draftSig.current }); else if (!savedTo.current) WORK.del(a.id, v.id); }, [layout]);
    useEffect(() => { if (!changed || !draftOn.current || restore) return; if (draftSig.current && draftSig.current === sigOf(layout)) return; clearTimeout(draftT.current); setDraftSt(d => d && d.state === 'saved' ? Object.assign({}, d, { state: 'pending' }) : { state: 'pending' }); draftT.current = setTimeout(() => { sendDraft(layoutRef.current).catch(() => {}); }, 1200); return () => clearTimeout(draftT.current); }, [layout]);
    /* leaving the canvas (another asset, stage or project, or the Studio itself) never drops the work: the open text edit is
       folded in, the working store keeps it, and the draft is written at once instead of after the debounce */
    useEffect(() => () => {
      clearTimeout(draftT.current);
      const L = foldText(layoutRef.current, pendingText.current); const sg = sigOf(L);
      if (savedSig.current && sg === savedSig.current) { WORK.del(a.id); return; }   // exactly what the saved version holds
      if (!isChanged(L)) return;
      const base = savedTo.current || v.id;                                             // edits made while a save was answered ride on the saved version
      WORK.set(a.id, { base, project: p && p.id, ns, layout: L, draftSig: draftSig.current }, true);
      if (!savedTo.current && draftOn.current) sendDraft(L, true).catch(() => {});
    }, []);
    // S18/S19: the page's save state names the difference
    const stateWord = !changed ? false : saveSt && saveSt.state === 'saving' ? 'saving' : saveSt && (saveSt.state === 'failed' || saveSt.state === 'conflict') ? 'failed' : draftSt && draftSt.state === 'saving' ? 'drafting' : draftSt && draftSt.state === 'saved' && draftSig.current === sigOf(layout) ? 'draft' : 'unsaved';
    useEffect(() => { if (onDirty) onDirty(stateWord); }, [stateWord]);
    useEffect(() => () => { if (onDirty) onDirty(false); }, []);
    const discardDraft = () => { draftOn.current = false; clearTimeout(draftT.current); WORK.del(a.id); call('/studio/draft/discard', { asset: a.id }).catch(() => {}); };
    const doRestore = () => { const d = restore; setRestore(null); if (!d) return; const L = JSON.parse(JSON.stringify(d.layout)); const c = d.copy || {}; if (Object.keys(c).length) L._copy = c; commit(L); toastMsg('Your unsaved layout is back'); };
    /* saving a version: the draft stays until the worker acknowledges a version that holds the edit; the op id makes a retry of the
       same edit idempotent (a save that committed but timed out is answered, not written twice) */
    const saving = useRef(false);
    const save = async () => {
      if (saving.current) return; saving.current = true;
      const L = layoutRef.current; const sg = sigOf(L); const op = 'e' + (MERGE ? MERGE.sig(v.id + '|' + sg).replace(':', '') : Date.now().toString(36));
      setSaveSt({ state: 'saving' });
      let r = null;
      try { r = await onDone(strip(L), patchOf(L), { op, base: v.id }); }
      catch (e) { r = { status: 'failed', error: e }; }
      finally { saving.current = false; }
      if (r && r.status === 'saved') { savedSig.current = sg; savedTo.current = r.version || null; setSaveSt(null); WORK.del(a.id, v.id); return; }
      if (r && r.status === 'cancelled') { setSaveSt(null); return; }
      setSaveSt({ state: r && r.status === 'conflict' ? 'conflict' : 'failed', msg: r && r.error ? (r.error.message || String(r.error)) : 'the version was not saved' });
      draftOn.current = true; if (draftSig.current !== sg) sendDraft(L).catch(() => {});   // keep a recovery copy of exactly what failed
    };
    const cancel = () => { if (changed && !window.confirm('Discard the unsaved layout changes? The saved version stays as it is.')) return; discardDraft(); draftOn.current = true; onDone(null); };
    const one = selected().length === 1 ? selected()[0] : null;
    // the type panel follows the layer last clicked, even inside a group (type is set per layer)
    const typed = focusId && sel.length && byId(focusId) && byId(focusId).type === 'text' ? byId(focusId) : one;
    const tb = (label, fn, dis, title) => html`<button class="btn sm ghost" disabled=${dis} title=${title || label} onClick=${fn}>${label}</button>`;
    const fontTargets = () => selected().filter(l => l.type === 'text' && movable(l)).map(l => l.id);
    const pickFont = f => { const ids = fontTargets(); setFontOpen(false); setFontPreview(null); if (!ids.length) return; const patches = {}; ids.forEach(id => { const l = byId(id); patches[id] = { family: f || undefined, weight: f && R.fontWeight ? R.fontWeight(f, l.weight || 600) : l.weight }; }); commit(patchMany(layout, patches)); };
    // the panels: type for the layer last clicked, the held-mark note, the box, effects, the image, the framing - rendered into the Properties tab when a slot is given
    const panels = html`<div class="st-le-panels">
      ${typed && typed.type === 'text' && !typed.locked ? (one2 => html`<div class="st-le-type" aria-label="Typography">
        <span class="st-lbl">Type: ${one2.role}</span>
        <label>Size <input class="st-in" type="number" step="0.1" min="1" max="20" value=${one2.size} onChange=${e => setOne(one2.id, { size: r1(Math.max(1, +e.target.value || one2.size)) })} aria-label="Type size, per cent of the width" /></label>
        <label>Weight <select class="st-sel" value=${String(one2.weight || 600)} onChange=${e => setOne(one2.id, { weight: +e.target.value })} aria-label="Weight">${Array.from(new Set((one2.family && R.fontEntry && R.fontEntry(one2.family) ? R.fontEntry(one2.family).weights : [400, 500, 600, 700, 800, 900]).concat([one2.weight || 600]))).sort((p0, q) => p0 - q).map(w => html`<option key=${w} value=${String(w)}>${w}</option>`)}</select></label>
        <label>Align <select class="st-sel" value=${one2.align || 'left'} onChange=${e => setOne(one2.id, { align: e.target.value })} aria-label="Text alignment"><option value="left">left</option><option value="center">centre</option><option value="right">right</option></select></label>
        <label>Line height <input class="st-in" type="number" step="0.02" min="0.8" max="2" value=${one2.lineHeight || 1.12} onChange=${e => setOne(one2.id, { lineHeight: Math.round(Math.max(0.8, Math.min(2, +e.target.value || 1.12)) * 100) / 100 })} aria-label="Line height, times the type size" /></label>
        <label>Tracking <input class="st-in" type="number" step="0.01" min="-0.05" max="0.3" value=${one2.letterSpacing || 0} onChange=${e => setOne(one2.id, { letterSpacing: Math.round((+e.target.value || 0) * 100) / 100 })} aria-label="Letter spacing, em" /></label>
        <label>Colour <input class="st-in" value=${one2.color || '#ffffff'} onChange=${e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value)) setOne(one2.id, { color: e.target.value }); }} aria-label="Colour" /></label>
        <label>Emphasis <select class="st-sel" value=${one2.emphasis || ''} onChange=${e => setOne(one2.id, { emphasis: e.target.value || undefined })} aria-label="Emphasis"><option value="">none</option><option value="caps">caps</option><option value="highlight">highlight</option><option value="underline">underline</option><option value="box">box</option></select></label>
        ${one2.bg && one2.emphasis === 'box' ? html`<span class="ov-dim">a filled plate and a box outline together: one device is enough</span>` : null}
      </div>${E.TypeExtras ? html`<${E.TypeExtras} l=${one2} onPatch=${pt => setOne(one2.id, pt)} onFont=${() => setFontOpen(true)} />` : null}`)(typed) : null}
      ${one && heldMark(one) ? html`<div class="st-le-type" aria-label="Held mark"><span class="st-lbl">${one.role}</span><span class="ov-dim">held where the campaign rule puts it (${one.rule.corner || 'its corner'}${one.rule.note ? ': ' + one.rule.note : ''}); the words move, the mark stays</span></div>` : null}
      ${one && movable(one) ? html`<div class="st-le-type" aria-label="Position and size">
        <span class="st-lbl">Box: ${one.name || one.role || one.type}</span>
        ${[['x', 'X'], ['y', 'Y'], ['w', 'Width'], ['h', 'Height']].map(([k, lb]) => html`<label key=${k}>${lb} <input class="st-in" type="number" step="0.5" min=${k === 'w' || k === 'h' ? 1 : -50} max=${150} value=${one[k] == null ? 0 : one[k]} onChange=${e => { const n = +e.target.value; if (isFinite(n)) { const keep = exactImg(one) && (k === 'w' || k === 'h'); const patch = { [k]: r1(k === 'w' || k === 'h' ? Math.max(1, n) : n) }; if (keep && one.w && one.h) { if (k === 'w') patch.h = r1(Math.max(1, one.h * (patch.w / one.w))); else patch.w = r1(Math.max(1, one.w * (patch.h / one.h))); } setOne(one.id, patch); } }} aria-label=${lb + ', per cent of the stage'} /></label>`)}
        ${!isMarkL(one) ? html`<label>Rotate <input class="st-in" type="number" step="1" min="-180" max="180" value=${one.rotate || 0} onChange=${e => { const n = +e.target.value; if (isFinite(n)) setOne(one.id, { rotate: Math.max(-180, Math.min(180, Math.round(n * 10) / 10)) || undefined }); }} aria-label="Rotation, degrees" /></label>` : null}
        ${exactImg(one) ? html`<span class="ov-dim" title="An exact image keeps its proportions: width and height move together">aspect locked</span>` : null}
        ${one.type === 'shape' ? html`<label>Opacity <input class="st-in" type="number" step="0.05" min="0" max="1" value=${one.opacity == null ? 1 : one.opacity} onChange=${e => setOne(one.id, { opacity: Math.round(Math.max(0, Math.min(1, +e.target.value)) * 100) / 100 })} aria-label="Panel opacity" /></label><label>Fill <input class="st-in" value=${one.fill || ''} onChange=${e => { if (/^#[0-9a-fA-F]{3,8}$/.test(e.target.value) || /^rgba?\(/.test(e.target.value)) setOne(one.id, { fill: e.target.value }); }} aria-label="Panel fill" /></label>` : null}
        ${one.type === 'shape' && one.shape === 'icon' ? html`<label>Line <input class="st-in" type="number" step="0.25" min="0.5" max="4" value=${one.strokeWidth || 2} onChange=${e => setOne(one.id, { strokeWidth: Math.max(0.5, Math.min(4, +e.target.value || 2)) })} aria-label="Icon line weight" /></label>` : null}
      </div>` : null}
      ${one && movable(one) && !isMarkL(one) && E.EffectsPanel ? html`<${E.EffectsPanel} l=${one} palette=${layout.palette} onPatch=${pt => setOne(one.id, pt)} />` : null}
      ${one && movable(one) && one.type === 'img' && !isMarkL(one) && E.ImagePanel ? html`<${E.ImagePanel} l=${one} onPatch=${pt => setOne(one.id, pt)} onReplace=${one.role === 'image' ? replaceImage : null} />` : null}
      ${(() => { // image framing: the background photograph, or the image region selected
        const reg = one && one.type === 'img' && one.role === 'region' && !one.locked ? one : null; if (!reg && !(v.image && v.image.url)) return null;
        const f = (reg ? reg.focus : layout.imageFocus) || {}; const cur = { x: f.x == null ? 50 : f.x, y: f.y == null ? 50 : f.y, zoom: f.zoom || 1 };
        const set = (k, n) => { const nf = Object.assign({}, cur, { [k]: n }); const plain = nf.x === 50 && nf.y === 50 && nf.zoom === 1; if (reg) setOne(reg.id, { focus: plain ? undefined : nf }); else commit(Object.assign({}, layout, { imageFocus: plain ? undefined : nf })); };
        const zoomBy = d => set('zoom', Math.round(Math.max(1, Math.min(3, cur.zoom + d)) * 100) / 100);
        return html`<div class="st-le-type st-le-framing" aria-label="Image framing"><span class="st-lbl">Framing: ${reg ? 'image region ' + (reg.region || reg.id) : 'the photograph'}</span>
          <button class=${'btn sm ghost' + (frame ? ' on' : '')} aria-pressed=${frame} onClick=${() => setFrame(!frame)} title="Drag the photograph to reposition it inside its box; the wheel zooms; nothing else moves">${frame ? 'Done framing' : 'Frame by dragging'}</button>
          <label>Across <input type="range" min="0" max="100" step="1" value=${cur.x} onChange=${e => set('x', +e.target.value)} aria-label="Focal point across, per cent" /></label>
          <label>Down <input type="range" min="0" max="100" step="1" value=${cur.y} onChange=${e => set('y', +e.target.value)} aria-label="Focal point down, per cent" /></label>
          <label>Zoom <button class="btn sm ghost" onClick=${() => zoomBy(-0.1)} disabled=${cur.zoom <= 1} aria-label="Zoom out">-</button><input class="st-in" type="number" step="0.05" min="1" max="3" value=${cur.zoom} onChange=${e => set('zoom', Math.round(Math.max(1, Math.min(3, +e.target.value || 1)) * 100) / 100)} aria-label="Image zoom" /><button class="btn sm ghost" onClick=${() => zoomBy(0.1)} disabled=${cur.zoom >= 3} aria-label="Zoom in">+</button></label>
          <button class="ov-link" onClick=${() => { if (reg) setOne(reg.id, { focus: undefined }); else commit(Object.assign({}, layout, { imageFocus: undefined })); }} title="Back to the plain centred crop at zoom 1">centre and reset</button>
          ${!reg && suggestion && suggestion.focus ? html`<button class="btn sm" onClick=${() => commit(Object.assign({}, layout, { imageFocus: suggestion.focus }))} title=${suggestion.note}>Keep the subject clear (measured)</button>` : null}
          <span class="ov-dim">${subj && subj.regions && subj.regions.length ? 'likely subject' + (subj.regions.length === 1 ? '' : 's') + ' marked on the stage (confidence ' + Math.round(subj.confidence * 100) + '%: a colour-and-edge estimate, not detection); ' : ''}reframes the same image: no render. The focus is the image point that sits at the same place in the box, so it holds in every format.</span></div>`; })()}
      ${!one && !sel.length ? html`<div class="ov-dim st-le-hint">Select a layer on the canvas or in the Layers list (drag across the empty stage to select several) to edit its type, box, effects or framing. Double-click words to type them in place. Changes save as one layout version; no render.</div>` : null}
      ${sel.length > 1 ? html`<div class="ov-dim st-le-hint">${sel.length} layers selected: the floating toolbar sets type for all the words among them; align, distribute, order and group are in the tools above.</div>` : null}
    </div>`;
    const list = html`<${LayersList} layers=${layers} sel=${sel} onPick=${(e, l) => pick(e, l)} onHide=${l => setOne(l.id, { hidden: !l.hidden })} onLock=${l => setOne(l.id, { locked: !l.locked })} bad=${bad} heldMark=${heldMark} onMove=${moveTo} onDuplicate=${l => { setSelIds([l.id]); const n = E.cloneLayers ? E.cloneLayers([l], wcopy, layout) : []; if (n.length) { commit(Object.assign({}, layout, { layers: layers.concat(n) })); setSelIds(n.map(x => x.id)); } }} onDelete=${l => removeLayers([l])} editing=${true} />`;
    // the floating toolbar sits over the selection's measured bounds
    const selBox = (() => { const s = selected(); if (!s.length) return null; const bx = s.map(l => l.rotate ? { x: l.x, y: l.y, w: l.w, h: l.h || 0 } : inkOf(l)); const x = Math.min.apply(null, bx.map(b => b.x)), y = Math.min.apply(null, bx.map(b => b.y)); return { x, y, w: Math.max.apply(null, bx.map(b => b.x + b.w)) - x, h: Math.max.apply(null, bx.map(b => b.y + b.h)) - y }; })();
    const HANDLES = ['nw', 'n', 'ne', 'e', 'sw', 's', 'w'];
    const editingL = editing ? byId(editing) : null;
    const brandFonts = [((kit && kit.fonts) || layout.fonts || {}).display, ((kit && kit.fonts) || layout.fonts || {}).body].filter(Boolean);
    const toolsEl = html`<div class="st-le-toolbar">
      ${!preview ? html`<div class="st-le-tools" role="toolbar" aria-label="Canvas tools">
        ${tb('Undo', undo, !hist.past.length, 'Undo (Ctrl or Cmd+Z)')}${tb('Redo', redo, !hist.future.length, 'Redo (Ctrl or Cmd+Shift+Z)')}
        <span class="st-le-sep"></span>${E.AddMenu ? html`<${E.AddMenu} palette=${layout.palette} onAdd=${add} onImage=${addImage} />` : null}
        <span class="st-le-sep"></span>${['left', 'centre', 'right', 'top', 'middle', 'bottom'].map(h => tb('Align ' + h, () => align(h), !selected().length, 'Align ' + h + (selected().length > 1 ? ' to the selection' : ' to the safe area of this format (' + (story ? 'story: top ' + Math.round(sa.top * 100) + '%, bottom ' + Math.round(sa.bottom * 100) + '%, sides ' + Math.round(sa.side * 100) + '%' : Math.round(sa.side * 100) + '% margin') + '), on the measured ink')))}
        ${tb('Distribute across', () => distribute('h'), selected().length < 3)}${tb('Distribute down', () => distribute('v'), selected().length < 3)}
        <span class="st-le-sep"></span>${tb('To front', () => reorder('front'), !selected().length)}${tb('Forward', () => reorder('forward'), !selected().length)}${tb('Backward', () => reorder('backward'), !selected().length)}${tb('To back', () => reorder('back'), !selected().length)}
        <span class="st-le-sep"></span>${tb('Group', group, selected().length < 2)}${tb('Ungroup', ungroup, !selected().some(l => l.group))}
        <label class="st-check"><input type="checkbox" checked=${guides0} onChange=${e => setGuides(e.target.checked)} /> safe-area guides</label>
        <label class="st-check" title="Snap to a 10% grid as well as the stage, the safe area and the other layers"><input type="checkbox" checked=${grid} onChange=${e => setGrid(e.target.checked)} aria-label="Grid" /> grid</label>
        <label class="st-check" title="Off: the corner changes the text box and the words rewrap at the same size. On: the type scales with the box width."><input type="checkbox" checked=${scaleType} onChange=${e => setScaleType(e.target.checked)} aria-label="Resize scales type" /> resize scales type</label>
        <span class="st-le-sep"></span>${tb('Shortcuts', () => setKeysOpen(true), false, 'Keyboard shortcuts (?)')}
      </div>` : null}
      </div>`;
    const sheetEl = html`${keysOpen && E.ShortcutsSheet ? html`<${E.ShortcutsSheet} onClose=${() => { setKeysOpen(false); try { if (box.current) box.current.focus({ preventScroll: true }); } catch (x) {} }} />` : null}`;
    const restoreEl = html`${restore && !preview ? html`<div class="st-le-restore" role="status"><b>${restore.current ? 'You have unsaved layout changes from ' + ago(restore.at) + ' ago.' : 'A draft from an earlier version is kept (' + ago(restore.at) + ' ago).'}</b> <span class="ov-dim">${restore.current ? 'Autosaved for you only; nothing was saved as a version.' : 'The asset was saved since; restoring it would lay an older arrangement over the newer one.'}</span>${restore.current ? html`<button class="btn sm" onClick=${doRestore}>Restore my changes</button>` : null}<button class="btn sm ghost" onClick=${() => { setRestore(null); discardDraft(); draftOn.current = true; }}>Discard the draft</button></div>` : null}`;
    return html`<div class="st-le-wrap" onKeyDown=${keyAll}>
      ${toolsSlot ? ReactDOM.createPortal(html`${toolsEl}${restoreEl}`, toolsSlot) : html`${toolsEl}${restoreEl}`}${sheetEl}
      <div class=${'st-le' + (preview ? ' preview' : '') + (marquee && marquee.on ? ' marqueeing' : '')} ref=${box} tabIndex="-1" onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up} onPointerDown=${marqueeDown} onDoubleClick=${e => { const el = e.target.closest && e.target.closest('.st-le-layer'); if (!el) return; const l = byId(el.getAttribute('data-id')); if (l && l.type === 'text') startEdit(l); }}>
        <${Composition} v=${Object.assign({}, v, { layout: drawn, copy: wcopy })} a=${a} ns=${ns} tagOut=${true} highlight=${!preview && highlight ? highlight : []} />
        ${guides && !preview ? html`<div class="st-le-guide" style=${{ left: (story ? sa.side * 100 : 3) + '%', top: (story ? sa.top * 100 : 3) + '%', right: (story ? sa.side * 100 : 3) + '%', bottom: (story ? sa.bottom * 100 : 3) + '%' }} title=${story ? 'safe area inside the story interface' : '3% margin'}></div>${story ? html`<div class="st-le-zone" style=${{ left: 0, right: 0, top: 0, height: (sa.top * 100) + '%' }} title=${'Instagram story interface (top ' + Math.round(sa.top * 100) + '%)'}></div><div class="st-le-zone" style=${{ left: 0, right: 0, bottom: 0, height: (sa.bottom * 100) + '%' }} title=${'Instagram story interface (bottom ' + Math.round(sa.bottom * 100) + '%)'}></div>` : null}` : null}
        ${grid && !preview ? html`<div class="st-le-grid" aria-hidden="true"></div>` : null}
        ${guides && !preview && subjOn.length ? subjOn.map(s => html`<div key=${'subj-' + s.id} class=${'st-le-subject' + (s.covered >= 0.35 ? ' covered' : '')} aria-hidden="true" style=${{ left: s.x + '%', top: s.y + '%', width: s.w + '%', height: s.h + '%' }} title=${'likely subject ' + s.id + ', confidence ' + Math.round(s.confidence * 100) + '% (an estimate, not detection)' + (s.covered ? '; ' + Math.round(s.covered * 100) + '% covered' : '')}><span>subject? ${Math.round(s.confidence * 100)}%</span></div>`) : null}
        ${frame && !preview ? html`<div class="st-le-frame" role="application" aria-label="Frame the photograph: drag to reposition, wheel to zoom" data-ready=${frameTarget() ? '1' : '0'} ref=${frameRef} onPointerDown=${frameDown} onPointerMove=${frameMove} onPointerUp=${frameUp} onPointerCancel=${frameUp}><span class="st-le-frame-hint">drag to reposition the ${frameTarget() && frameTarget().reg ? 'region image' : 'photograph'}; wheel to zoom</span></div>` : null}
        ${!preview ? layers.filter(l => !l.hidden).map(l => { const g = geo(l); const isSel = sel.indexOf(l.id) >= 0 || (l.group && sel.some(id => (byId(id) || {}).group === l.group)); const single = sel.length === 1 && sel[0] === l.id && movable(l);
          return html`${g.box ? html`<div key=${l.id + ':box'} class="st-le-box" aria-hidden="true" style=${{ left: g.box.x + '%', top: g.box.y + '%', width: g.box.w + '%', height: g.box.h + '%' }}></div>` : null}<div key=${l.id} data-id=${l.id} class=${'st-le-layer' + (isSel ? ' sel' : '') + (l.locked ? ' locked' : '') + (heldMark(l) ? ' held' : '') + (bad.has(l.id) ? ' bad' : '') + (g.box ? ' ink' : '') + (g.turned ? ' turned' : '') + (editing === l.id ? ' editing' : '')} tabIndex="0" role="button" aria-label=${'Layer ' + (l.role || l.id)} aria-description=${l.type === 'text' && R.displayedText ? R.displayedText(layout, l, wcopy) || undefined : undefined} aria-pressed=${sel.indexOf(l.id) >= 0} data-ink=${g.box ? '1' : '0'} style=${Object.assign({ left: g.on.x + '%', top: g.on.y + '%', width: g.on.w + '%', height: g.on.h + '%' }, g.turned ? { transform: 'rotate(' + l.rotate + 'deg)' } : {})} onPointerDown=${e => down(e, l, 'move')} onFocus=${() => { if (clickFocus.current !== l.id && sel.indexOf(l.id) < 0) setSelIds([l.id]); }}>
          <span class="st-le-lbl">${l.name && l.role === 'free' ? l.name : l.role || l.type}${l.locked ? ' (locked)' : ''}${heldMark(l) ? ' (held by the campaign rule)' : ''}${l.group ? ' (grouped)' : ''}</span>${movable(l) ? html`<span class="st-le-h" data-h="se" title="Resize (Shift keeps the proportions, Alt from the centre)" onPointerDown=${e => down(e, l, 'resize')}></span>` : null}
          ${single && !editing ? html`${HANDLES.map(h => html`<span key=${h} class=${'st-le-hh h-' + h} data-h=${h} onPointerDown=${e => down(e, l, 'resize:' + h)}></span>`)}${!isMarkL(l) ? html`<span class="st-le-rot" title="Rotate (Shift: 15 degree steps)" aria-label="Rotate" onPointerDown=${e => down(e, l, 'rotate')}></span>` : null}` : null}
        </div>`; }) : null}
        ${snapLines.map((g, i) => html`<div key=${'snap' + i} class=${'st-le-snap ' + g.axis} aria-hidden="true" style=${g.axis === 'x' ? { left: g.at + '%' } : { top: g.at + '%' }}></div>`)}
        ${marquee && marquee.on ? html`<div class="st-le-marquee" aria-hidden="true" style=${{ left: Math.min(marquee.x0, marquee.x1) + '%', top: Math.min(marquee.y0, marquee.y1) + '%', width: Math.abs(marquee.x1 - marquee.x0) + '%', height: Math.abs(marquee.y1 - marquee.y0) + '%' }}></div>` : null}
        ${editingL && E.TextEditor && layout.stage ? html`<${E.TextEditor} key=${'te-' + editingL.id} layer=${editingL} value=${R.displayedText(Object.assign({}, layout, { baked: [] }), Object.assign({}, editingL, { hidden: false }), wcopy)} layout=${layout} stageW=${box.current ? box.current.getBoundingClientRect().width : layout.stage.w} onCommit=${t => { pendingText.current = null; commitEdit(editingL, t); }} onCancel=${() => { pendingText.current = null; setEditing(null); }} onChange=${t => { pendingText.current = { id: editingL.id, t }; WORK.set(a.id, { base: v.id, project: p && p.id, ns, layout: foldText(layout, pendingText.current), draftSig: draftSig.current }); }} />` : null}
        ${!preview && !editing && !(act.current) && E.ContextToolbar ? html`<${E.ContextToolbar} sel=${selected()} bbox=${selBox} layout=${layout} ro=${false} locks=${a.locks || {}} onPatch=${pt => { const s = selected().filter(movable); if (s.length === 1) setOne(s[0].id, pt); }} onPatchEach=${fn => setEach(l => (l.type === 'text' ? fn(l) : {}))} onDuplicate=${duplicate} onDelete=${remove} onLock=${() => { const s = selected(); const lockIt = !s.some(l => l.locked); const patches = {}; s.forEach(l => { patches[l.id] = { locked: lockIt || undefined }; }); commit(patchMany(layout, patches)); }} onOrder=${reorder} onMore=${() => { if (onMore) onMore(); }} onEditText=${startEdit} onReplace=${replaceImage} onFontOpen=${() => setFontOpen(true)} />` : null}
        ${fontOpen && E.FontPicker ? html`<div class="st-le-fontwrap" onPointerDown=${e => e.stopPropagation()}><${E.FontPicker} value=${(byId(fontTargets()[0]) || {}).family || ''} brand=${brandFonts} onPick=${pickFont} onPreview=${f => setFontPreview(f == null ? null : { family: f, ids: fontTargets() })} onClose=${() => { setFontOpen(false); setFontPreview(null); }} /></div>` : null}
      </div>
      ${propsSlot ? ReactDOM.createPortal(panels, propsSlot) : null}
      ${layersSlot ? ReactDOM.createPortal(list, layersSlot) : null}
      ${(() => { const foot = html`<div class="st-msg-foot st-le-foot">
        ${val && !preview ? html`<span class=${'st-le-val' + (val.ok ? '' : ' bad')} role="status" title="The working layout, measured as you edit it at the output size">${val.ok ? 'Measured at ' + val.W + 'x' + val.H + ' as you edit: no blocking issue' : 'Measured at ' + val.W + 'x' + val.H + ' as you edit: ' + val.issues.filter(i => i.severity === 'blocking').map(i => i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')).join('; ')}</span>` : null}
        <span class=${'st-le-draft ' + (stateWord || 'clean') + (changed ? ' st-le-dirty' : '')} role="status" aria-live="polite" title=${saveSt && saveSt.msg ? saveSt.msg : ''}>${!changed ? 'No unsaved changes' : stateWord === 'saving' ? 'Saving version...' : stateWord === 'failed' ? (saveSt.state === 'conflict' ? 'Not saved: changed elsewhere - choose what to keep' : 'Save failed: ' + (saveSt.msg || 'not saved') + '. Your changes and the recovery draft are kept; Save again.') : stateWord === 'drafting' ? 'Saving recovery draft...' : stateWord === 'draft' ? 'Draft saved ' + new Date((draftSt && draftSt.at) || Date.now()).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) + ' (for you only)' : draftSt && draftSt.state === 'error' ? 'Unsaved: the recovery draft did not save (' + draftSt.msg + ')' : 'Unsaved changes'}</span>
        ${changed ? html`<button class="btn sm" disabled=${stateWord === 'saving'} onClick=${save} title="Save the layout (and any words typed on the canvas) as a new version; no render">${stateWord === 'saving' ? 'Saving...' : stateWord === 'failed' ? 'Save layout again' : 'Save layout as a version'}</button><button class="btn sm ghost" onClick=${cancel} title="Put the canvas back to the saved version">Discard changes</button>` : null}
        <button class="st-iconbtn sm" onClick=${() => setKeysOpen(true)} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)"><${Icon} n="help" size=${14} /></button>
      </div>`; return footSlot ? ReactDOM.createPortal(foot, footSlot) : foot; })()}
    </div>`;
  }
  /** The layer list, front to back: select, hide or show, lock or unlock. Used by the editor (working layout) and, when the editor is
      closed, on the current version (each toggle then saves a layout version). */
  function LayersList({ layers, sel, onPick, onHide, onLock, bad, heldMark, ro, onMove, onDuplicate, onDelete, editing }) {
    // front to back: the first row is the layer painted last. Dragging a row (in the editor) moves it in the paint order.
    const [drag, setDrag] = useState(null); const [over, setOver] = useState(null);
    const rows = layers.slice().reverse(); const N = layers.length;
    const dropAt = (target) => { if (!drag || !onMove || drag === target) return; const ti = layers.findIndex(l => l.id === target); onMove(drag, ti); };
    return html`<div class="st-le-list" role="list" aria-label="Layers, front to back">${rows.map(l => html`<span key=${l.id} role="listitem" class=${'st-le-item' + (sel.indexOf(l.id) >= 0 ? ' on' : '') + (l.hidden ? ' hidden' : '') + (bad && bad.has(l.id) ? ' bad' : '') + (over === l.id ? ' over' : '')} draggable=${!!(editing && onMove && !ro && !l.locked)} onDragStart=${e => { setDrag(l.id); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', l.id); } catch (x) {} }} onDragOver=${e => { if (drag) { e.preventDefault(); setOver(l.id); } }} onDragLeave=${() => setOver(o => (o === l.id ? null : o))} onDrop=${e => { e.preventDefault(); dropAt(l.id); setDrag(null); setOver(null); }} onDragEnd=${() => { setDrag(null); setOver(null); }}>${editing && onMove && !ro ? html`<span class="st-layer-grip" aria-hidden="true" title="Drag to change the paint order">::</span>` : null}<button class="ov-link st-layer-pick" aria-pressed=${sel.indexOf(l.id) >= 0} title=${(l.role || l.type) + ' ' + l.id + (heldMark && heldMark(l) ? ' - held by the campaign rule' : '')} onClick=${e => onPick(e, l)}>${l.name && (l.role === 'free' || l.role === 'device' || l.role === 'image') ? l.name : l.role || l.type}${heldMark && heldMark(l) ? html`<span class="st-layer-held" aria-label="held by the campaign rule">rule</span>` : null}${bad && bad.has(l.id) ? html`<span class="st-dot bad" aria-label="blocking issue"></span>` : null}</button> ${!ro ? html`<button class="st-lock" onClick=${() => onHide(l)} title="Hide or show this element" aria-pressed=${!!l.hidden}>${l.hidden ? 'show' : 'hide'}</button> <button class=${'st-lock' + (l.locked ? ' on' : '')} onClick=${() => onLock(l)} title="A locked element keeps its place through directions and hand edits" aria-pressed=${!!l.locked}>${l.locked ? 'locked' : 'lock'}</button>${editing && onDuplicate && !(l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')) ? html` <button class="st-lock st-lord st-lord-ic" onClick=${() => onDuplicate(l)} title="Duplicate this layer" aria-label=${'Duplicate ' + (l.role || l.type)}><${Icon} n="copy" size=${11} /></button>` : null}${editing && onDelete && !l.locked && !(l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')) ? html` <button class="st-lock st-lord st-lord-ic" onClick=${() => onDelete(l)} title="Delete (the approved words are hidden instead)" aria-label=${'Delete ' + (l.role || l.type)}><${Icon} n="trash" size=${11} /></button>` : null}${N > 1 && editing && onMove && !ro && !l.locked ? html` <button class="st-lock st-lord st-lord-ic" onClick=${() => onMove(l.id, Math.min(N - 1, layers.findIndex(x => x.id === l.id) + 1))} title="Bring forward" aria-label=${'Bring ' + (l.role || l.type) + ' forward'}><${Icon} n="up" size=${11} /></button><button class="st-lock st-lord st-lord-ic" onClick=${() => onMove(l.id, Math.max(0, layers.findIndex(x => x.id === l.id) - 1))} title="Send backward" aria-label=${'Send ' + (l.role || l.type) + ' backward'}><${Icon} n="down" size=${11} /></button>` : null}` : null}</span>`)}</div>`;
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

  /** S19: both people changed the same thing. Each conflicting field or layer is shown with what it was, what I made it and what
      they made it; nothing is written until a person chooses: keep mine, keep theirs, or choose item by item. Cancel keeps my
      edit on the canvas (and in the recovery draft) and writes nothing. */
  function ConflictDialog({ c, onDone }) {
    const [per, setPer] = useState(false); const [ch, setCh] = useState({});
    const show = (x, kind) => x === undefined ? html`<i class="ov-dim">removed</i>` : kind === 'copy' ? (String(x) || html`<i class="ov-dim">empty</i>`) : kind === 'layer' ? html`<span class="ov-dim">${'x ' + x.x + ' y ' + x.y + ' w ' + x.w + (x.size ? ', size ' + x.size : '') + (x.hidden ? ', hidden' : '')}</span>` : html`<span class="ov-dim">${JSON.stringify(x).slice(0, 80)}</span>`;
    const all = c.m.conflicts.every(x => ch[x.id]);
    return html`<div class="st-dialog st-conflict" role="dialog" aria-modal="true" aria-labelledby="st-conflict-h"><div class="st-dialog-box">
      <div class="ov-title" id="st-conflict-h">${c.as.title} changed while you edited</div>
      <div class="st-pad ov-dim">v${c.theirsN} changed ${c.m.conflicts.length === 1 ? 'something you changed too' : c.m.conflicts.length + ' things you changed too'}. Everything else from both of you is kept. Nothing is saved until you choose.</div>
      <table class="st-table st-conflict-t"><thead><tr><th>What</th><th>Before</th><th>Yours</th><th>Theirs</th>${per ? html`<th>Keep</th>` : null}</tr></thead><tbody>
        ${c.m.conflicts.map(x => html`<tr key=${x.id}><td>${x.label}</td><td>${show(x.base, x.kind)}</td><td>${show(x.mine, x.kind)}</td><td>${show(x.theirs, x.kind)}</td>${per ? html`<td><span class="st-seg" role="group" aria-label=${'Keep for ' + x.label}><button class=${'btn sm' + (ch[x.id] === 'mine' ? ' on' : ' ghost')} aria-pressed=${ch[x.id] === 'mine'} onClick=${() => setCh(o => Object.assign({}, o, { [x.id]: 'mine' }))}>Mine</button><button class=${'btn sm' + (ch[x.id] === 'theirs' ? ' on' : ' ghost')} aria-pressed=${ch[x.id] === 'theirs'} onClick=${() => setCh(o => Object.assign({}, o, { [x.id]: 'theirs' }))}>Theirs</button></span></td>` : null}</tr>`)}
      </tbody></table>
      <div class="st-dialog-acts">
        ${per ? html`<button class="btn sm" disabled=${!all} onClick=${() => onDone(ch)}>Save these choices</button>` : html`<button class="btn sm" onClick=${() => onDone('mine')}>Keep mine</button><button class="btn sm ghost" onClick=${() => onDone('theirs')}>Keep theirs</button>${c.m.conflicts.length > 1 ? html`<button class="btn sm ghost" onClick=${() => setPer(true)}>Choose item by item</button>` : null}`}
        <button class="btn sm ghost" onClick=${() => onDone(null)}>Cancel (keep editing)</button>
      </div></div></div>`;
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
    const [tab, setTab] = useState('properties');
    // S18: the right panel's Creative Director part (review, ideas, conversation), the Design tool open beside the canvas, and,
    // on a narrow screen, whether the inspector drawer is out
    const [cdSub, setCdSub] = useState('review'); const [tool, setTool0] = useState(saved0.tool || ''); const [inspOpen, setInspOpen] = useState(false);
    const setTool = v => { setTool0(v); store.set({ tool: v }); };
    const [slot, setSlot] = useState(null);
    // S11: preview (the artwork alone) is a page state, so the header can switch it; the left panel's width and whether it is open are this browser's
    const [preview, setPreview] = useState(false); useEffect(() => { setPreview(false); }, [selAsset]);
    const [railOpen, setRailOpen] = useState(saved0.rail !== false); const [railW, setRailW] = useState(saved0.railW || 220); const railDrag = useRef(null);
    const railDown = e => { e.preventDefault(); railDrag.current = { x: e.clientX, w: railW }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const railMove = e => { const d = railDrag.current; if (!d) return; setRailW(Math.max(160, Math.min(420, Math.round(d.w + e.clientX - d.x)))); };
    const railUp = () => { if (!railDrag.current) return; railDrag.current = null; store.set({ railW }); };
    const [toolsOpen, setToolsOpen0] = useState(saved0.tools !== false);
    const [partnerOpen, setPartnerOpen0] = useState(saved0.partner !== false);
    const [saveSt, setSaveSt] = useState({ pending: 0, err: null, at: 0 });
    const [typing, setTyping] = useState(0);
    const [conflict, setConflict] = useState(null);
    // S17: the question a change to an earlier choice asks before anything is written (update the work built on it, keep it, cancel)
    const [impactQ, setImpactQ] = useState(null);
    // S17: the layers selected on the canvas (an Creative Director direction about the asset is about them) and the assets resize made
    const [selLayers, setSelLayers] = useState([]); const [resized, setResized] = useState({});
    const viewRef = useRef('brief');
    const stepping = useRef(new Set()); const pidRef = useRef(null); pidRef.current = pid;
    // the activity panel: a clock for elapsed times while anything runs or just finished, and a poll of the jobs this browser
    // (or the worker's tick) is stepping, so the phase the worker reports mid-call reaches the screen while the call is in flight
    const [actOpen, setActOpen] = useState(false); const [now, setNow] = useState(Date.now());
    const [helpOpen, setHelpOpen] = useState(false);
    const liveIds = ((p && p.jobs) || []).filter(j => j.state === 'running' || j.state === 'queued').map(j => j.id).join(',');
    const recentDone = ((p && p.jobs) || []).some(j => j.state === 'done' && Date.now() - (j.updated || 0) < 90000);
    useEffect(() => { if (!liveIds && !recentDone) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [liveIds, recentDone]);
    useEffect(() => {
      if (!liveIds) return; let on = true;
      const poll = async () => { for (const id of liveIds.split(',')) { if (!on) return; try { const r = await call('/studio/job?id=' + encodeURIComponent(id)); if (on && r && r.job) setP(prev => prev && prev.id === r.job.project ? Object.assign({}, prev, { jobs: (prev.jobs || []).map(j => j.id === r.job.id ? Object.assign({}, j, r.job) : j) }) : prev); } catch (e) {} } };
      const t = setInterval(poll, 2500); return () => { on = false; clearInterval(t); };
    }, [liveIds]);
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
    /* browser history: a deliberate move (a step, a project opened or closed) is an entry, so the browser's Back returns to
       the previous step or project inside AXIOM; a move made by Back itself is not pushed again (histRestoring) */
    const histRestoring = useRef(false);
    const pushHist = useCallback((pidV, viewV) => { if (histRestoring.current) return; try { const cur = history.state && history.state.studio; if (cur && cur.pid === (pidV || null) && cur.view === (viewV || null)) return; history.pushState({ ax: 1, v: 'studio', studio: { pid: pidV || null, view: viewV || null } }, '', location.pathname + location.search + '#v=studio'); } catch (e) {} }, []);
    const setView = useCallback((v, focus) => { viewRef.current = v; setView0(v); setCmp(null); if (focus) { focusNext.current = true; pushHist(pidRef.current, v); } }, []);
    /* S17: finished work is announced where the person is, with a button to go and see it - the Studio never moves them by itself */
    const ready = (stageId, title, text, label) => { if (stageOfView(viewRef.current) === stageId) { toastMsg(title); return; } setNotice({ kind: 'success', title, text: text || '', actions: [{ label: label || 'Go to ' + ((STAGES.find(x => x.id === stageId) || {}).label || stageId), fn: () => goStageRef.current(stageId) }] }); };
    const goStageRef = useRef(() => {});
    // the heading is brought to just under the sticky context bar and navigator (its scroll-margin), so a new stage starts at its top
    useEffect(() => { if (focusNext.current && titleRef.current) { focusNext.current = false; try { titleRef.current.focus({ preventScroll: true }); const c = titleRef.current.closest('.st-centre'); if (c) c.scrollTop = 0; } catch (e) {} } }, [view, p && p.id]);
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
    // coming back to the Studio tab with no project open re-reads the library: work made elsewhere meanwhile is listed
    useEffect(() => { const h = () => { if (!pidRef.current && !intakeRef.current) loadLib(); }; window.addEventListener('ax:studio-shown', h); return () => window.removeEventListener('ax:studio-shown', h); }, [loadLib]);
    useEffect(() => { store.set({ client: clientId }); }, [clientId]);
    useEffect(() => { if (pid && p && p.id === pid && !p.readOnly) store.setPlace(clientId, { pid, view: view === 'export' ? 'review' : view, asset: selAsset, open: true, title: p.title }); }, [pid, view, selAsset, p && p.id]);
    /* the Release Desk, the Content Desk, the Sentinel and Client Central open the Studio's intake with their brief */
    useGoto('studio', q => { q = q || {}; resumed.current = true; if (q.ns && CLIENTS.some(c => c.id === q.ns) && q.ns !== clientId) setClientId(q.ns); setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); if (q.intake) { setPreset({ start: q.intake, deliverable: q.deliverable, text: q.text, instruction: q.instruction, from: q.from, at: q.at || Date.now() }); setIntake(true); } });
    const reloadSeq = useRef(0), reloadApplied = useRef(0);
    const reload = useCallback(async (id) => {
      const want = id || pidRef.current; if (!want) return null;
      // reloads overlap (the poll, an action's own reload): an answer older than one already applied is never laid over it
      const seq = ++reloadSeq.current;
      // the ref moves with the answer, not with the next render: a write that follows a reload in the same handler sends the fresh revision
      try { const d = await call('/studio/get?id=' + encodeURIComponent(want)); if (pidRef.current === want) { if (seq < reloadApplied.current) return pRef.current; reloadApplied.current = seq; pRef.current = d; setP(d); } return d; } catch (e) { if (pidRef.current === want && seq >= reloadApplied.current) setNotice(Object.assign(explain(e, 'The project did not load'), { actions: [{ label: 'Try again', fn: () => reload(want) }] })); return null; }
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
        for (const j of jobs) { seen.add(j.id); if (pidRef.current !== j.project) return; if (j.stage === 'inspect') { const ia = (cur.assets || []).find(x => x.id === j.asset); const iv = ia && current(ia); if (!(iv && iv.mode === 'finished')) await composeExport(cur, j.asset, (j.input || {}).version); } await runJob(j.id, (j.stage === 'render' ? 'Rendering ' + ((j.input || {}).finished ? 'the finished creative (words and mark painted)' : ((j.input || {}).approach === 'artwork') ? 'the hybrid artwork' : (j.input || {}).region && (j.input || {}).region !== 'bg' ? 'the ' + (j.input || {}).regionRole + ' image' : 'the background') + ' at ' + ((j.input || {}).size || '2K') : j.stage === 'inspect' ? 'The Creative Director inspects the result' : 'Running ' + j.stage) + (cur.assets || []).filter(x => x.id === j.asset).map(x => ' for ' + x.title).join('')); }
        cur = await reload();
      }
    }, [runJob, reload, composeExport]);
    const openProject = async (id, place) => {
      setPid(id); pidRef.current = id; setCmp(null); setIntake(false); setP(null); setNotice(null); setConflict(null); setExportState(null); setTab('properties');
      const d = await reload(id); if (!d) { setPid(null); pidRef.current = null; return null; }
      const asset = place && place.asset && d.assets.some(x => x.id === place.asset) ? place.asset : d.assets[0] ? d.assets[0].id : null;
      setSelAsset(asset); setSelField(null);
      const want = place && place.view && stageOfView(place.view) && (place.view !== 'asset' || asset) ? place.view : d.assets.length ? 'asset' : d.directions.length ? 'directions' : 'brief';
      setView(want, true);
      refreshStatus();
      if (!d.readOnly) pump(d);
      return d;
    };
    const closeProject = () => { pushHist(null, null); const pl = store.place(clientRef.current); if (pl) store.setPlace(clientRef.current, Object.assign({}, pl, { open: false })); setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); setConflict(null); setExportState(null); setSugg(null); loadLib(); };
    const histFns = useRef({}); histFns.current = { openProject, closeProject };
    useEffect(() => {
      const h = e => {
        const d = e.detail || null; histRestoring.current = true;
        const done = () => { setTimeout(() => { histRestoring.current = false; }, 0); };
        try {
          if (!d || !d.pid) { if (pidRef.current) histFns.current.closeProject(); done(); }
          else if (d.pid !== pidRef.current) Promise.resolve(histFns.current.openProject(d.pid, { view: d.view, open: true })).finally(done);
          else { if (d.view) { setView0(d.view); setCmp(null); } done(); }
        } catch (err) { done(); }
      };
      window.addEventListener('ax:studio-history', h); return () => window.removeEventListener('ax:studio-history', h);
    }, []);
    /* switching client leaves nothing of the other client on screen: project, kit, suggestions, notices, export, dialogs */
    const switchClient = id => { if (id === clientId) return; resumed.current = true; setPid(null); pidRef.current = null; setP(null); setCmp(null); setNotice(null); setConflict(null); setExportState(null); setDialog(null); setPanel(null); setPreset(null); setIntake(false); setSelAsset(null); setSelField(null); setSugg(null); setKit(null); setLib(null); setTab('properties'); setClientId(id); };

    const job = async (stage, input, asset, idem, label) => {
      const r = await call('/studio/job', { project: pidRef.current, asset: asset || undefined, stage, input, idem });
      // the job is on the page from the moment it exists: the processing cards and the activity panel show it queued, and the
      // poll (every 2.5 s while anything is live) shows it running with its phase while the step is still out
      if (r && r.job) setP(prev => prev && prev.id === r.job.project && !(prev.jobs || []).some(j => j.id === r.job.id) ? Object.assign({}, prev, { jobs: (prev.jobs || []).concat([r.job]) }) : prev);
      return runJob(r.job.id, label);
    };
    const produce = (extra) => guard('produce:' + pidRef.current, async () => {
      try {
        const d = pRef.current || await reload(); const b = d.brief || {}; const channels = (b.channels || []).filter(c => CHANNELS[c]);
        if (!channels.length) { setNotice({ kind: 'warn', title: 'No channels in the brief.', text: 'Choose at least one channel, then produce.', actions: [{ label: 'Open the brief', fn: () => setView('brief', true) }] }); return; }
        const imagery = (extra && extra.imagery) || (b.imagery === 'none' ? 'none' : undefined);
        const before = new Set(d.assets.map(x => x.id));
        const j = await job('copy', { channels, deliverable: b.deliverable || 'set', formats: b.formats || {}, template: b.template || '', instruction: (extra && extra.instruction) || '', acknowledge: !!(extra && extra.acknowledge) || undefined, size: imagery === 'none' ? undefined : (extra && extra.size) || b.size || undefined, imagery: imagery === 'none' ? 'none' : undefined, quick: !!(extra && extra.instruction) || undefined }, null, 'copy:' + pidRef.current + ':' + Date.now(), 'Writing ' + channels.length + ' piece' + (channels.length === 1 ? '' : 's') + ' in the ' + (d.ns || '').toUpperCase() + ' voice' + ((b.deliverable || 'set') === 'copy' ? ', copy only' : ', then laying out compositions'));
        const d2 = await reload(); const fresh = d2 ? d2.assets.filter(x => !before.has(x.id)) : [];
        // the words first: the first new piece is selected for the Copy step, and the person is told where it is (never moved there)
        if (fresh.length) { setSelAsset(fresh[0].id); setTab('properties'); ready('copy', fresh.length + ' piece' + (fresh.length === 1 ? '' : 's') + ' of copy ready', 'Each channel\'s words and its visual narrative are written; check them and mark each ready for design.', 'Go to Copy'); }
        if (j && j.state === 'done') pump(d2);
      } catch (e) { fail(e, 'Production did not start', () => produce(extra)); }
    });
    const direct = (n) => guard('direct:' + pidRef.current, async () => { n = Math.max(1, Math.min(5, +n || 3)); try { const j = await job('direct', { n, channels: ((pRef.current && pRef.current.brief) || {}).channels || [] }, null, 'direct:' + pidRef.current + ':' + Date.now(), 'Proposing ' + n + ' direction' + (n === 1 ? '' : 's') + ' from the brief, the strategy and the ledger'); if (j && j.state === 'done') ready('directions', 'Creative Directions ready', 'Compare them and select one; nothing is produced until you do.', 'View directions'); } catch (e) { fail(e, 'Directions did not start', () => direct(n)); } });
    const draftStrategy = (instruction) => guard('strategy:' + pidRef.current, async () => { try { await job('strategy', { instruction: instruction || undefined }, null, 'strategy:' + pidRef.current + ':' + Date.now(), 'Drafting the creative strategy'); } catch (e) { fail(e, 'The strategy did not start', () => draftStrategy(instruction)); } });
    const planSequence = (input) => guard('sequence:' + pidRef.current, async () => { try { await job('sequence', input, null, 'sequence:' + pidRef.current + ':' + Date.now(), 'Planning the campaign sequence'); ready('copy', 'Sequence planned', 'Each asset is an editable composition with no image spent.', 'View the sequence'); } catch (e) { fail(e, 'The sequence did not start', () => planSequence(input)); } });
    const createProject = (o) => guard('create:' + clientId, async () => {
      try {
        setBusy('Creating the project'); setIntake(false);
        const formats = {}; o.channels.forEach(c => { formats[c] = (CHANNELS[c] || {}).format || '1:1'; }); if (o.deliverable === 'visual') formats.instagram = '4:5';
        const brief = { objective: o.start === 'brief' ? o.text : o.start === 'reference' ? 'Adapt the reference: ' + o.text : '', audience: '', message: '', deliverables: (o.deliverable === 'copy' ? 'Copy only for ' : o.deliverable === 'visual' ? 'Visual creative for ' : 'Coordinated set for ') + o.channels.map(chanLabel).join(', '), channels: o.channels, deliverable: o.deliverable, formats, creationMode: o.creationMode === 'finished' ? 'finished' : 'editable', imageryTiming: o.imageryTiming === 'after_copy' ? 'after_copy' : 'with_copy', campaignConfirmed: !!o.campaignConfirmed, assumptions: ['Organic, not paid (assumed; edit if wrong)'].concat(o.campaign ? [] : ['No campaign chosen: campaign identity and campaign facts will not apply']) };
        const pr = await call('/studio/project', { ns: client.id, campaign: o.campaign, title: (o.start === 'release' || o.start === 'analyse' ? (o.text.split('\n').map(s => s.replace(/^#+\s*/, '').trim()).filter(s => s && !/^media release/i.test(s))[0] || 'Release') : o.text).slice(0, 80), brief, idem: 'p:' + client.id + ':' + Date.now() });
        setPid(pr.id); pidRef.current = pr.id; setSelAsset(null); setView('brief', true);
        if (o.start === 'release') { const s = await call('/studio/source', { project: pr.id, kind: 'release', name: 'Pasted release', text: o.text }); await reload(pr.id); await job('extract', { source: s.id }, null, 'extract:' + s.id, 'Reading the source: claims, figures and quotations with their passages'); }
        if (o.start === 'analyse' && /^https?:\/\/\S+$/.test(o.text.trim())) { await reload(pr.id); await analyse({ via: 'url', url: o.text.trim() }); return; }
        if (o.start === 'analyse') { await reload(pr.id); await analyse({ kind: o.kind || 'brief', text: o.text, name: (ANALYSE_KINDS.find(x => x[0] === o.kind) || [0, 'Brief'])[1] + ': ' + (o.text.split('\n').map(x => x.replace(/^#+\s*/, '').trim()).filter(Boolean)[0] || '').slice(0, 60) }); return; }
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
    const chooseDirection = async (did) => { try {
      // a narrative from the brief analysis names its route: a finished one sets the project to Finished creative before
      // production, an editable one back to Editable (copy-only projects have no route to follow)
      const pr0 = pRef.current || {}; const d0 = (pr0.directions || []).find(x => x.id === did); const b0 = pr0.brief || {};
      if (d0 && d0.route && b0.deliverable !== 'copy' && (b0.creationMode || 'editable') !== d0.route) await call('/studio/project/update', { id: pr0.id, revision: pr0.revision, patch: { brief: { creationMode: d0.route } } });
      await call('/studio/direction/choose', { id: did }); await reload(); await produce({}); } catch (e) { fail(e, 'The direction was not chosen'); } };
    /* the brief engine: the material (a brief, an article, today's daily brief, a file) becomes a source, and one model call
       reads it against the client - what concerns them, which campaign, which facts, which knowledge - and proposes the brief,
       copy angles and visual narratives (each with its route), then names the next step */
    const analyse = (o) => guard('analyse:' + pidRef.current, async () => {
      try {
        setBusy('Adding the material');
        // the material arrives as text, a link, a file (image or PDF), or something Axiom already holds
        const via = o.via || 'text'; let s0;
        if (via === 'url') s0 = await call('/studio/source/url', { project: pidRef.current, url: o.url });
        else if (via === 'item') s0 = await call('/studio/source/item', { project: pidRef.current, type: o.type, id: o.id });
        else if (via === 'file') s0 = await call('/studio/source', { project: pidRef.current, name: o.name || 'Upload', fileB64: o.b64, mime: o.mime, provenance: 'upload: ' + (o.name || '') });
        else s0 = await call('/studio/source', { project: pidRef.current, kind: 'analyse:' + (o.kind || 'brief'), name: o.name || 'Pasted brief', text: o.text, provenance: o.kind === 'daily' ? 'daily brief' : o.file ? 'upload: ' + o.file : 'pasted' });
        await reload(); setBusy('');
        const kind = o.kind || (via === 'url' ? 'url' : via === 'item' ? (s0.kind || 'item') : via === 'file' ? (o.mime === 'application/pdf' ? 'pdf' : 'image') : 'brief');
        await job('analyse', { source: s0.id, kind, instruction: o.instruction || undefined }, null, 'analyse:' + s0.id, 'Reading "' + (s0.name || o.name || 'the material') + '" against ' + ((client && client.name) || 'the client') + ': situation, objectives, messages, strategies and directions');
        await reload(); ready('brief', 'Axiom\'s understanding is ready', 'Review it on the Brief.', 'Review the understanding');
      } catch (e) { fail(e, 'The analysis did not run', () => analyse(o)); } finally { setBusy(''); }
    });
    /* the team's choices on the reading: each fills the brief and is recorded for the engine to learn from */
    const selectIntel = async (sel) => { try { setBusy('Saving the choice'); const d = await call('/studio/intel/select', Object.assign({ project: pRef.current.id }, sel)); await reload(); toastMsg(d.changed && d.changed.length ? 'The brief now carries the ' + Array.from(new Set(d.changed)).join(', ') : 'Choice recorded'); } catch (e) { fail(e, 'The choice was not saved'); } finally { setBusy(''); } };
    const intelDecision = async (kind, ref, noReason) => {
      const reason = noReason ? '' : window.prompt(kind === 'no_response' ? 'Why not respond? (recorded; the engine learns from it)' : 'Why set this aside? (recorded; the engine learns from it)', '');
      if (!noReason && (reason == null || reason.trim().length < 4)) { if (reason != null) toastMsg('Nothing recorded: a reason of a few words is needed', true); return; }
      try { setBusy('Recording the decision'); await call('/studio/intel/decision', { project: pRef.current.id, kind, ref, reason: reason || '' }); await reload(); toastMsg('Recorded'); } catch (e) { fail(e, 'The decision was not recorded'); } finally { setBusy(''); }
    };
    /* several narratives produced side by side: one production each, by its own route, in its own family on the Board */
    const produceVariants = (ids) => guard('variants:' + pidRef.current, async () => {
      const d = pRef.current; const b = d.brief || {}; const channels = (b.channels || []).filter(c => CHANNELS[c]);
      if (!channels.length) { setNotice({ kind: 'warn', title: 'No channels in the brief.', text: 'Choose at least one channel, then produce.', actions: [{ label: 'Open the brief', fn: () => setView('brief', true) }] }); return; }
      if (!window.confirm('Produce ' + ids.length + ' narratives as variants? One model call each' + (b.imageryTiming === 'after_copy' || b.imagery === 'none' ? '; no imagery yet.' : ', and the imagery each plans.'))) return;
      try {
        for (const id of ids) { const dir = d.directions.find(x => x.id === id); if (!dir) continue;
          await job('copy', { channels, deliverable: b.deliverable === 'copy' ? 'copy' : (b.deliverable || 'set'), formats: b.formats || {}, direction: id, variant: true, creationMode: dir.route || undefined, size: b.size || undefined, imagery: b.imagery === 'none' ? 'none' : undefined, acknowledge: true }, null, 'variant:' + id + ':' + Date.now(), 'Producing "' + dir.title + '" as a variant (' + (dir.route === 'finished' ? 'finished creative' : 'editable') + ')'); }
        const d2 = await reload(); ready('design', ids.length + ' variants produced', 'Each in its own family on the Board.', 'View on the Board'); if (d2) pump(d2);
      } catch (e) { fail(e, 'The variants were not produced', () => produceVariants(ids)); }
    });
    const writeKit = (direction, kinds) => guard('kit:' + pidRef.current, async () => { try { await job('kit', { direction, kinds }, null, 'kit:' + direction + ':' + Date.now(), 'Writing the message kit: ' + kinds.length + ' piece' + (kinds.length === 1 ? '' : 's')); await reload(); ready('copy', 'Message kit ready', kinds.length + ' piece' + (kinds.length === 1 ? '' : 's') + ', each traced and checked.', 'View the kit'); } catch (e) { fail(e, 'The message kit was not written', () => writeKit(direction, kinds)); } });
    const updateText = async (t, body) => { try { await call('/studio/text/update', { id: t.id, body, revision: t.revision }); await reload(); return true; } catch (e) { if (e.status === 409) await reload(); fail(e, 'The piece was not saved'); return false; } };
    const textVerdict = async (t, verdict) => { const reason = window.prompt((verdict === 'approve' ? 'Approve' : 'Reject') + ' "' + t.label + '": why? (recorded; the engine learns from it)', ''); if (reason == null) return; if (reason.trim().length < 4) { toastMsg('Nothing recorded: a reason of a few words is needed', true); return; } try { await call('/studio/text/verdict', { id: t.id, verdict, reason }); await reload(); toastMsg(verdict === 'approve' ? 'Approved' : 'Rejected'); } catch (e) { fail(e, 'The verdict was not recorded'); } };

    /* ------------------------------------------------------------ S17: the guided workflow's own actions */
    /** A project from the wizard: the campaign made in the kit first when asked, the project as guided workflow 2, the material
        as sources, and - when asked - one analysis of all of it. The project opens on its Brief; nothing else is spent. */
    const createGuided = (o) => guard('create:' + o.ns, async () => {
      try {
        setBusy('Creating the project'); setIntake(false);
        let campaign = o.campaign || '';
        if (o.campaignMode === 'new' && o.newCampaign) { const c = await call('/studio/campaign/create', { ns: o.ns, name: o.newCampaign.name, description: o.newCampaign.description }); campaign = c.campaign.id; }
        const formats = {}; o.channels.forEach(c => { formats[c] = (CHANNELS[c] || {}).format || '1:1'; }); if (o.deliverable === 'visual') formats.instagram = '4:5';
        const first = (o.text || '').split('\n').map(x => x.replace(/^#+\s*/, '').trim()).filter(Boolean)[0] || ((o.items || [])[0] || {}).label || '';
        const typeName = ((window.STFlow && window.STFlow.TYPES.find(t => t[0] === o.type)) || [0, 'Project'])[1];
        const brief = { workflow: 2, projectType: o.type, campaignMode: o.campaignMode, channels: o.channels, deliverable: o.deliverable, formats, deliverables: (o.deliverable === 'copy' ? 'Copy only for ' : o.deliverable === 'visual' ? 'One visual for ' : 'Coordinated set for ') + o.channels.map(chanLabel).join(', '), creationMode: 'editable', imageryTiming: 'after_copy', campaignConfirmed: o.campaignMode !== 'detect', assumptions: o.campaignMode === 'standalone' ? ['Standalone: no campaign identity or campaign facts apply'] : [] };
        const pr = await call('/studio/project', { ns: o.ns, campaign, title: (o.title || first || typeName + ' ' + new Date().toLocaleDateString('en-AU')).slice(0, 80), brief, idem: 'p:' + o.ns + ':' + Date.now() });
        if (o.ns !== clientRef.current) { resumed.current = true; clientRef.current = o.ns; setClientId(o.ns); }
        setPid(pr.id); pidRef.current = pr.id; setSelAsset(null); setView('brief', true); await reload(pr.id);
        const m = await window.STFlow.materialSources(pr.id, o.text, o.kind, o.items);
        if (m.fails.length) setNotice({ kind: 'warn', title: 'Some material was not added', text: m.fails.join('; ') });
        await reload(pr.id);
        if (o.analyse && m.ids.length) await job('analyse', { sources: m.ids, kind: m.ids.length > 1 ? 'mixed' : (o.kind || 'brief') }, null, 'analyse:' + m.ids.join(','), 'Reading the brief against ' + ((CLIENTS.find(c => c.id === o.ns) || {}).name || o.ns));
        await reload(pr.id);
      } catch (e) { fail(e, 'The project was not created'); } finally { setBusy(''); }
    });
    /** Material added on the Brief (text, links, files, notes, Axiom items) plus sources already on the project, read as one. */
    const analyseGuided = (o) => guard('analyse:' + pidRef.current, async () => {
      try {
        setBusy('Adding the material');
        const m = await window.STFlow.materialSources(pidRef.current, o.text, o.kind, o.items);
        if (m.fails.length) setNotice({ kind: 'warn', title: 'Some material was not added', text: m.fails.join('; ') });
        const ids = m.ids.concat(o.sources || []); await reload(); setBusy('');
        if (!ids.length) { setNotice({ kind: 'warn', title: 'Nothing to analyse', text: 'Write, paste, link or upload the brief first.' }); return false; }
        await job('analyse', { sources: ids, kind: ids.length > 1 ? 'mixed' : (o.kind || 'brief') }, null, 'analyse:' + ids.join(',') + ':' + Date.now(), 'Reading the brief against ' + ((client && client.name) || 'the client'));
        await reload(); return true;
      } catch (e) { fail(e, 'The analysis did not run', () => analyseGuided(o)); return false; } finally { setBusy(''); }
    });
    /** A step confirmed by a person. A change that would leave work on an earlier choice asks first (impactQ); nothing is written until answered. */
    const confirmStep = async (step, body, opts) => {
      opts = opts || {};
      try {
        setBusy(step === 'brief' ? 'Confirming the understanding' : 'Confirming the ' + step);
        await call('/studio/workflow/confirm', Object.assign({ project: pRef.current.id, step }, body));
        await reload();
        if (opts.then) await opts.then();
        return true;
      } catch (e) {
        if (e.status === 409 && e.code === 'affects_downstream') { setImpactQ({ step, body, opts, impact: e.body ? e.body.impact : (e.impact || {}), title: step === 'objectives' ? 'Changing this objective may affect your current Creative Directions' : 'Changing the strategy may affect your current Creative Directions' }); return false; }
        if (e.status === 409) await reload();
        fail(e, 'The ' + step + ' was not confirmed'); return false;
      } finally { setBusy(''); }
    };
    const answerImpact = async (ans) => {
      const q = impactQ; setImpactQ(null); if (!q || !ans) return;
      const ok = await confirmStep(q.step, Object.assign({}, q.body, { acknowledge: ans }), q.opts);
      // "Update directions": the earlier work stays, and new directions are built on the new choice (one model call)
      if (ok && ans === 'update') { const d = pRef.current; const wf = d && d.workflow; if (wf && wf.steps.directions && wf.steps.directions.state !== 'locked') await directGuided({ n: 3 }); else setNotice({ kind: 'info', title: 'The earlier work is kept, marked as built on the earlier choice.', text: 'Confirm the strategy to build new directions on the new choice.' }); }
    };
    /** Directions in a guided project: fresh, alternatives, refine or merge - one model call; the board shows them where they land. */
    const directGuided = (o) => guard('direct:' + pidRef.current, async () => {
      try {
        const n = o.mode === 'refine' || o.mode === 'merge' ? 1 : Math.max(1, Math.min(5, +o.n || 3));
        const j = await job('direct', Object.assign({ n, channels: ((pRef.current && pRef.current.brief) || {}).channels || [] }, o), null, 'direct:' + (o.mode || 'fresh') + ':' + pidRef.current + ':' + Date.now(), o.mode === 'refine' ? 'Refining the direction' : o.mode === 'merge' ? 'Merging the directions' : o.mode === 'alternatives' ? 'Asking for alternatives' : 'Building creative directions');
        if (j && j.state === 'done') ready('directions', o.mode === 'refine' ? 'Refined direction ready' : o.mode === 'merge' ? 'Merged direction ready' : 'Creative Directions ready', 'Compare them and select one; nothing is produced until you do.', 'View directions');
      } catch (e) { fail(e, 'The directions did not start', () => directGuided(o)); }
    });
    const chooseGuided = async (d) => {
      const d0 = pRef.current; const other = (d0.assets || []).length && !d.chosen;
      if (other && !window.confirm('Select "' + d.title + '"? The ' + d0.assets.length + ' piece' + (d0.assets.length === 1 ? '' : 's') + ' already written stay as they are; new copy follows this direction.')) return;
      try { setBusy('Selecting the direction'); await call('/studio/direction/choose', { id: d.id }); await reload(); ready('copy', 'Direction selected: ' + d.title, 'Copy is open: the words and the visual narrative are written from it.', 'Continue to Copy'); }
      catch (e) { if (e.status === 409) await reload(); fail(e, 'The direction was not selected'); } finally { setBusy(''); }
    };
    const updateDirection = async (d, patch, reason) => { try { await call('/studio/direction/update', { id: d.id, patch, reason: reason || undefined }); await reload(); if (patch.saved != null) toastMsg(patch.saved ? 'Saved for later' : 'No longer saved'); if (patch.archived) toastMsg('Set aside; the reason is recorded'); } catch (e) { fail(e, 'The direction was not changed'); } };
    const duplicateDirection = async (d) => { try { await call('/studio/direction/duplicate', { id: d.id }); await reload(); toastMsg('Duplicated "' + d.title + '"'); } catch (e) { fail(e, 'The direction was not duplicated'); } };
    /** The production mode, chosen in Design once the words are ready: editable queues the planned imagery; finished paints each piece. */
    const produceMode = (mode, assets, size) => guard('production:' + pidRef.current, async () => {
      if (!window.confirm((mode === 'finished' ? 'Paint ' : 'Generate the imagery for ') + assets.length + ' piece' + (assets.length === 1 ? '' : 's') + ' at ' + size + '? ' + (mode === 'finished' ? 'One paid painting per piece, words and mark included.' : 'One paid render per planned image.') + ' Each is a job you can watch or cancel.')) return;
      try {
        setBusy('Queuing the ' + (mode === 'finished' ? 'paintings' : 'imagery'));
        const r = await call('/studio/production', { project: pidRef.current, mode, assets, size });
        const d = await reload(); if (r.jobs && r.jobs.length && d) pump(d);
        setNotice({ kind: r.skipped && r.skipped.length ? 'warn' : 'info', title: (r.done || []).length + ' piece' + ((r.done || []).length === 1 ? '' : 's') + ' in production (' + (mode === 'finished' ? 'full AI creative' : 'editable') + ')', text: (r.jobs || []).length + ' render' + ((r.jobs || []).length === 1 ? '' : 's') + ' queued at ' + r.size + '.' + (r.skipped && r.skipped.length ? ' Not queued: ' + r.skipped.map(x => x.title + ' (' + x.why + ')').join('; ') + '.' : '') });
      } catch (e) { fail(e, 'Production did not start'); } finally { setBusy(''); }
    });
    const saveBriefPatch = async (patch) => { try { await call('/studio/project/update', { id: pRef.current.id, revision: pRef.current.revision, patch: { brief: patch } }); await reload(); return true; } catch (e) { if (e.status === 409) await reload(); fail(e, 'The brief was not saved'); return false; } };
    /** Pieces (or directions) written on an earlier choice, kept under the current one: nothing regenerated, nothing deleted. */
    const keepEarlier = async (assets, directions) => { try { setBusy('Keeping the earlier work'); const r = await call('/studio/workflow/confirm', { project: pRef.current.id, step: 'keep', assets: assets || undefined, directions: directions || undefined }); await reload(); toastMsg('Kept ' + [r.keptAssets ? r.keptAssets + ' piece' + (r.keptAssets === 1 ? '' : 's') : '', r.keptDirections ? r.keptDirections + ' direction' + (r.keptDirections === 1 ? '' : 's') : ''].filter(Boolean).join(' and ') + ' under the current choice'); } catch (e) { if (e.status === 409) await reload(); fail(e, 'Nothing was kept'); } finally { setBusy(''); } };

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
    // an open layout editor with unsaved changes: named in the header, and leaving the page asks first
    const [layoutDirty, setLayoutDirty] = useState(false); const layoutDirtyRef = useRef(false); layoutDirtyRef.current = layoutDirty;
    useEffect(() => { const h = e => { /* S19: canvas edits survive a reload (the working store and the recovery draft); only a write in flight or a failed save needs a question */ if (typingSet.current.size || saveSt.pending || layoutDirtyRef.current === 'saving' || layoutDirtyRef.current === 'failed') { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [saveSt.pending]);

    const propose = (as, feedback, refine, opts) => guard('concepts:' + as.id, async () => { opts = opts || {}; try { await job('concepts', { asset: as.id, feedback, refine: refine || undefined, mode: opts.mode || 'explore', refs: opts.refs || undefined, refMode: opts.refMode || undefined, keep: opts.keep || undefined, size: opts.size || undefined }, as.id, 'concepts:' + as.id + ':' + Date.now(), (opts.mode === 'new' ? 'The Creative Director designs afresh from the brief for ' : opts.mode === 'refine' ? 'The Creative Director refines ' : 'The Creative Director explores variations of ') + as.title); await reload(); } catch (e) { fail(e, 'The Creative Director did not start', () => propose(as, feedback, refine, opts)); } });
    const applyInspection = (eid, instruction, force) => guard('inspection:' + eid, async () => { try { const r = await call('/studio/inspection/apply', { project: pRef.current.id, eid, instruction, force: force || undefined }); const d = await reload(); if (r.job) { await runJob(r.job, 'Applying the Creative Director\'s correction (' + r.kind + ')'); pump(await reload()); } else pump(d); } catch (e) { fail(e, 'The correction was not applied'); } });
    const applyConcept = (eid, index, render, imageFrom, size) => guard('apply:' + eid + ':' + index, async () => { try { const r = await call('/studio/concept/apply', { project: pRef.current.id, eid, index, render, imageFrom: imageFrom == null ? undefined : imageFrom, size: render ? size : undefined }); const d = await reload(); if (r.asset && r.fresh) setNotice({ kind: 'success', title: 'New design made', text: 'It is a new asset in the family "New designs".', actions: [{ label: 'Open it', fn: () => setSelAsset(r.asset) }] }); else if (r.asset) setSelAsset(r.asset); if (r.job) pump(d); } catch (e) { fail(e, 'The concept was not applied'); } });
    /* a measurement of one version at its output size, with the composed PNG: the worker re-judges it with the shared rules */
    const fileValidation = async (as, v, val, comp) => {
      try {
        const blob = await R.toBlob(v.layout, v.copy, comp.imgs); const u8 = new Uint8Array(await blob.arrayBuffer());
        let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        await call('/studio/validation', { asset: as.id, version: v.id, report: R.report(v, val), imageB64: btoa(bin), mime: 'image/png' });
        await reload(); return true;
      } catch (e) { if (!/report_mismatch|not_current|stale/.test(e.code || '')) toastMsg('Validation not filed: ' + e.message + (e.requestId ? ' (request ' + e.requestId + ')' : '') + '. Measure again to retry.', true); return false; }
    };
    /* S19: one canvas edit - the layout and the words typed on the canvas - is saved as one version. When the asset moved on since
       the edit began, the edit is merged three ways against the version it was made on (STMerge): independent changes combine,
       and where both changed the same field or layer a person chooses (the conflict dialog) - nothing is overwritten or dropped in
       silence. The op id makes a retry of the same edit idempotent: a save that committed but timed out is answered by the worker
       with the version it already wrote. Success is reported only when the saved version holds the edit; the recovery draft of the
       edit is discarded only then, and only that draft (made on the same base, written no later than the version). */
    const [editConflict, setEditConflict] = useState(null);
    const saveEdit = async (as, edit) => {
      const { layout, baseVid, note } = edit; const patch = edit.copyPatch && Object.keys(edit.copyPatch).length ? edit.copyPatch : null;
      const op = edit.op || ('l' + (MERGE ? MERGE.sig({ b: baseVid, l: layout, c: patch, n: note }).replace(':', '') : Date.now().toString(36)));
      const find = d => ((d || pRef.current || {}).assets || []).find(x => x.id === as.id);
      let fresh = find() || as;
      const baseV = (fresh.versions || []).find(x => x.id === baseVid) || (as.versions || []).find(x => x.id === baseVid) || current(fresh);
      let want = { layout, copy: patch ? Object.assign({}, (baseV && baseV.copy) || {}, patch) : null };
      const intended = () => ({ layout: want.layout, copy: patch ? Object.keys(patch).reduce((o, k) => { o[k] = (want.copy || {})[k]; return o; }, {}) : {} });
      let needMerge = !!(current(fresh) && current(fresh).id !== baseVid);
      for (let round = 0; round < 4; round++) {
        if (needMerge) {
          const theirs = current(fresh); if (!theirs || !MERGE) return { status: 'failed', error: new Error('the asset changed and could not be merged') };
          const m = MERGE.merge({ base: { layout: baseV.layout, copy: baseV.copy }, mine: { layout, copy: patch || {} }, theirs: { layout: theirs.layout, copy: theirs.copy } });
          if (m.clean) want = { layout: m.layout, copy: m.copy };
          else {
            const choice = await new Promise(res => setEditConflict({ as, m, theirsN: vtotal(fresh), res }));
            setEditConflict(null);
            if (!choice) return { status: 'conflict', error: new Error('changed elsewhere; nothing was saved over it') };
            const x = MERGE.resolve(m, null, null, null, choice); want = { layout: x.layout, copy: x.copy };
          }
          needMerge = false;
        }
        try {
          const r = await call('/studio/version', Object.assign({ asset: as.id, revision: fresh.revision, layout: want.layout, kind: 'layout', note: note + (round ? ' (merged with a newer version)' : ''), op }, want.copy ? { copy: want.copy } : {}));
          await reload();
          if (MERGE && r.version && !MERGE.contains(r.version, intended())) return { status: 'failed', error: new Error('the version written does not hold the edit; nothing is lost - save again') };
          call('/studio/draft/discard', { asset: as.id, version: baseVid, savedVersion: r.version && r.version.id }).catch(() => {});
          return { status: 'saved', version: r.version && r.version.id, duplicate: !!r.duplicate };
        } catch (e) {
          if (e.status !== 409 || e.code !== 'conflict') return { status: 'failed', error: e };
          const d = await reload(); fresh = find(d); if (!fresh) return { status: 'failed', error: e };
          needMerge = !!(current(fresh) && current(fresh).id !== baseVid); if (!needMerge) continue;
        }
      }
      return { status: 'failed', error: new Error('the asset kept changing while saving; nothing was lost - save again') };
    };
    /* the other layout writers (fix, variations, variants, headline size) go through the same path */
    const putLayout = async (as, layout, baseVid, note, copyPatch) => {
      const r = await saveEdit(as, { layout, baseVid, note, copyPatch });
      if (r.status === 'saved') return true; if (r.status === 'failed') throw r.error; return false;
    };
    /* the smallest geometric fix, measured with the real renderer, saved as a layout version: no image call is made. The outcome is one
       of four states - complete, partial, blocked, nothing - with the blocking count before and after, what changed, what still stands
       and why, and an undo; the fix is bounded (three per asset in a session) and stops when it would return to an arrangement a
       previous fix already left (oscillation), instead of trading one defect for another for ever */
    const repairHist = useRef({});
    const repairLayout = async (as, v, comp) => {
      try {
        const hist = repairHist.current[as.id] || (repairHist.current[as.id] = { sigs: [], n: 0 });
        const variants = {}; for (const l of (v.layout.layers || [])) { if (Array.isArray(l.variants) && l.variants.length) variants[l.id] = await Promise.all(l.variants.map(async x => Object.assign({}, x, { img: await keyedImage(x.src) }))); }
        const r = R.repair(v.layout, v.copy, Object.assign({}, comp.imgs), { fonts: comp.fonts, channel: as.channel, format: as.format, locks: as.locks, fixContrast: true, variants: Object.keys(variants).length ? variants : undefined });
        /* the outcome is the renderer's own, judged on the COMPLETE validation of the result (geometry, readability of words and
           marks, brand constraints, pending imagery, unmeasured pixels) - never on the geometry alone: "Fixed" is said only when
           nothing blocks; a defect the fix could not clear is named by kind and layer */
        const counts = r.counts || { before: 0, after: 0 }; const kinds = r.kinds || { geometry: 0, readability: 0, brand: 0, pending: 0, other: 0 };
        const left = r.remaining ? r.remaining.blocking : (r.after ? r.after.issues.filter(i => i.severity === 'blocking') : []);
        const pendingText = left.filter(i => /^(imagery_missing|mark_unloaded|imagery_sketch|pixels_unmeasured|mark_unmeasured)$/.test(i.code)).map(i => i.code === 'imagery_missing' ? 'no imagery yet (generate it, or use a solid ground - see below the artwork)' : i.code === 'mark_unloaded' ? 'a mark file did not load (load the marks again)' : i.code === 'imagery_sketch' ? 'an image region is still a sketch (generate it)' : 'pixels not measured (measure again)');
        const leftText = left.length ? ' Still blocking: ' + Array.from(new Set(left.map(i => i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')))).join('; ') + '.' : '';
        const notLayout = pendingText.length ? ' Not a layout matter: ' + Array.from(new Set(pendingText)).join('; ') + '.' : '';
        if (!r.changed) {
          if (r.outcome === 'nothing') return { state: 'nothing', counts, kinds, text: 'Measured at the output size: nothing blocks, so nothing was changed and no version was saved.' + (r.after && r.after.issues.length ? ' ' + r.after.issues.length + ' warning' + (r.after.issues.length === 1 ? '' : 's') + ' to look at (Quality tab).' : ''), conflict: false };
          // the renderer's verdict already names what is left and what would clear it; the island adds only what it knows (what is
          // not a layout matter) and that nothing was written - the next steps are buttons, not a second sentence of advice
          return { state: 'blocked', counts, kinds, left: left.map(i => i.code), text: (r.conflict || 'The fix found no geometric move that clears what blocks.' + leftText) + notLayout + ' Nothing was saved.', conflict: true };
        }
        const sig = JSON.stringify(r.layout);
        if (hist.sigs.indexOf(sig) >= 0) return { state: 'blocked', counts, kinds, left: left.map(i => i.code), text: 'This fix would return the layout to an arrangement an earlier fix already left (the repair is oscillating between two states).' + leftText + ' Nothing was saved.', conflict: true };
        if (hist.n >= 3) return { state: 'blocked', counts, kinds, text: 'Three fixes have been saved on this asset already; the next step is a designer\'s hand, not another pass. Nothing was saved.', conflict: true };
        const saved = await putLayout(as, r.layout, v.id, 'layout repaired: ' + r.steps.join('; ').slice(0, 170));
        if (!saved) return { state: 'blocked', counts, kinds, text: 'Not saved: the layout changed elsewhere first.', conflict: true };
        hist.sigs.push(JSON.stringify(v.layout)); hist.sigs.push(sig); hist.n++;
        const state = r.outcome === 'complete' && r.ok ? 'complete' : 'partial';
        return { state, counts, kinds, left: left.map(i => i.code), undo: { from: v.id }, text: (state === 'complete' ? 'No render. ' : 'No render; the layout changed but the composition does not pass yet.' + (r.conflict ? '' : leftText) + ' ') + r.steps.join('; ') + '.' + (r.conflict && state !== 'complete' ? ' ' + r.conflict : '') + ' The words were not changed.' + notLayout, conflict: state !== 'complete' };
      } catch (e) { fail(e, 'The layout fix was not saved'); return { state: 'blocked', text: 'The fix failed: ' + e.message, conflict: true }; }
    };
    const undoRepair = async (as, undo) => { try { const fresh = (pRef.current.assets || []).find(x => x.id === as.id) || as; await call('/studio/version', { asset: as.id, revision: fresh.revision, restoreFrom: undo.from, note: 'undid the layout fix (restored the layout before it)' }); const h = repairHist.current[as.id]; if (h) h.n = Math.max(0, h.n - 1); await reload(); } catch (e) { if (e.status === 409) await reload(); fail(e, 'The fix was not undone'); } };
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
    const layoutVariant = (as, layout, baseVid, name, kind) => guard('variant:' + as.id, async () => { try { const ok = await putLayout(as, layout, baseVid, (kind === 'style' ? 'style variation: ' : 'layout variation: ') + name + ' (no render)'); if (ok) toastMsg((kind === 'style' ? 'Style changed to "' : 'Layout changed to "') + name + '" - a new version, no render; the words are unchanged'); } catch (e) { fail(e, 'The layout was not saved', () => layoutVariant(as, layout, baseVid, name, kind)); } });
    /** resize to platform formats: one new asset per format, from the composition as it stands; nothing generated */
    const resizeAsset = (as, presets) => guard('resize:' + as.id, async () => { try { setBusy('Resizing ' + as.title); const r = await call('/studio/resize', { asset: as.id, presets }); await reload(); setResized(m => Object.assign({}, m, { [as.id]: (r.made || []) })); toastMsg((r.made || []).length + ' resized version' + ((r.made || []).length === 1 ? '' : 's') + ' made in ' + as.family + ': nothing generated' + ((r.skipped || []).length ? '; not made: ' + r.skipped.map(x => x.format + ' (' + x.why + ')').join(', ') : '')); } catch (e) { fail(e, 'The resize did not run'); } finally { setBusy(''); } });
    /* the Creative Director reviews the version on request: the tile is composed exactly as it exports, then one model call reads it */
    const reviewNow = (as) => guard('inspect:' + as.id, async () => {
      try {
        const v = current(as); const fin = v.mode === 'finished'; setBusy(fin ? 'Sending the finished bitmap for review' : 'Composing ' + as.title + ' exactly as it exports');
        const composed = fin ? true : await composeExport(pRef.current, as.id, v.id);
        const j = await job('inspect', { version: v.id }, as.id, 'review:' + v.id + ':' + Date.now(), 'The Creative Director reviews ' + as.title + (fin ? ' (the finished bitmap, with the mark file for comparison)' : composed ? ' (the composed tile)' : ' (the imagery only; the composed tile was not saved)'));
        await reload(); setTab('director'); setCdSub('review');
        if (j && j.state === 'done') toastMsg('Review in: an opinion, it approves nothing');
      } catch (e) { fail(e, 'The review did not start', () => reviewNow(as)); }
    });
    const saveLayout = async (as, layout, baseVid, note, copyPatch, o) => {
      const words = copyPatch && Object.keys(copyPatch).length;
      const r = await saveEdit(as, { layout, copyPatch, baseVid: baseVid || as.current, op: o && o.op, note: note ? 'layout: ' + String(note).slice(0, 160) + ' (no render)' : words ? 'layout and words (' + Object.keys(copyPatch).join(', ') + ') edited on the canvas' : 'layout edited by hand' });
      if (r.status === 'failed') fail(r.error, 'The layout was not saved (your changes and the recovery draft are kept)');
      return r;
    };
    const editLayout = async (as, delta) => { try { const cur = current(as); const layout = JSON.parse(JSON.stringify(cur.layout)); const hl = layout.layers.find(l => l.role === 'headline'); hl.size = Math.max(2.4, Math.round((hl.size + delta) * 10) / 10); hl.h = Math.round(hl.h * (hl.size / (hl.size - delta)) * 10) / 10; await putLayout(as, layout, cur.id, 'headline ' + (delta > 0 ? 'larger' : 'smaller') + ' (' + hl.size + '%)'); } catch (e) { fail(e, 'The layout was not saved'); } };
    const toggleLock = async (as, k, locked) => { try { await call('/studio/lock', { asset: as.id, element: k, locked }); await reload(); } catch (e) { fail(e, 'The lock was not changed'); } };
    const approve = (as, part, what) => { if (what === 'withdraw') { call('/studio/approve', { asset: as.id, part, decision: 'withdraw' }).then(() => reload()).catch(e => fail(e, 'The approval was not withdrawn')); return; } setDialog({ kind: 'reason', part, what, asset: as.id, title: as.title, version: vnum(as, current(as)) }); };
    /* Copy: "ready for design" is the agency's copy approval of this exact version, recorded with a short reason (under the length
       that proposes a brand item); unticking withdraws it. Design: the imagery each composition plans, queued on request. */
    const readyCopy = (as, on) => guard('ready:' + as.id, async () => { try { await call('/studio/approve', on ? { asset: as.id, part: 'copy', decision: 'approve', reason: 'copy ready' } : { asset: as.id, part: 'copy', decision: 'withdraw' }); await reload(); } catch (e) { if (e.status === 409) await reload(); fail(e, on ? 'The copy was not marked ready' : 'The mark was not withdrawn'); } });
    const generateImagery = (list) => guard('imagery:' + pidRef.current, async () => {
      const b0 = (pRef.current || {}).brief || {}; const size = b0.size || '2K';
      if (!list.length) return;
      if (!window.confirm('Generate the imagery for ' + list.length + ' composition' + (list.length === 1 ? '' : 's') + ' (' + list.map(x => x.title).join(', ') + ')? One paid image generation per planned region at ' + size + (list.some(x => (current(x) || {}).mode === 'finished') ? '; a finished creative is one painting with the words and the mark' : '') + '. The words and marks stay as they are; each render is a job you can watch or cancel.')) return;
      let queued = 0; const refused = [];
      for (const as of list) { try { const r = await call('/studio/imagery', { project: pidRef.current, asset: as.id, size }); queued += (r.jobs || []).length; } catch (e) { refused.push(as.title + ': ' + (e.detail || e.message || e.code)); } }
      const d = await reload(); if (queued && d) pump(d);
      setNotice({ kind: refused.length ? 'warn' : 'info', title: queued + ' render' + (queued === 1 ? '' : 's') + ' queued.', text: (refused.length ? 'Not queued: ' + refused.join('; ') + '. ' : '') + (queued ? 'Follow them in the activity panel; the compositions stay editable meanwhile.' : '') });
    });
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
    /* the two creation modes: a finished creative is revised by regenerating the whole piece, and leaves the mode only as a derived editable asset */
    const regenerateFinished = (as, o) => guard('render:' + as.id, async () => { try { const r = await call('/studio/finished/regenerate', { asset: as.id, copy: o.copy, instruction: o.instruction, size: o.size }); const d = await reload(); if (r.job) pump(d); } catch (e) { fail(e, 'The regeneration did not start'); } });
    const deriveEditable = (as, o) => guard('derive:' + as.id, async () => { try { const r = await call('/studio/derive', { asset: as.id, to: 'editable', regenerate: !!(o && o.regenerate) }); const d = await reload(); if (r.jobs && r.jobs.length) pump(d); setNotice({ kind: 'info', title: 'Derived an editable asset.', text: r.note || 'The words and the mark are live layers again; the finished original is untouched.', actions: r.asset ? [{ label: 'Open the editable copy', fn: () => { setSelAsset(r.asset); setTab('properties'); setView('asset', true); } }] : [] }); } catch (e) { fail(e, 'The editable asset was not derived'); } });
    const areaEdit = (as, o) => guard('render:' + as.id, async () => { try { const v = current(as); await job('render', { edit: true, editKind: o.kind, area: o.area, instruction: o.instruction, aspect: as.format, size: o.size, note: (EDIT_NOTE[o.kind] || 'edit: ') + (o.instruction || 'the marked area').slice(0, 60) }, as.id, 'area:' + as.id + ':' + v.id + ':' + Date.now(), (EDIT_DOING[o.kind] || 'Editing ') + as.title + ' at ' + o.size); pump(await reload()); } catch (e) { fail(e, 'The edit did not start'); } });
    const filePreservation = async (m) => { try { await call('/studio/preservation', m); await reload(); } catch (e) { toastMsg('Preservation not filed: ' + e.message, true); } };
    const note = async (text, tgt) => { try { await call('/studio/note', { project: pRef.current.id, text, target: tgt }); await reload(); return true; } catch (e) { fail(e, 'The note was not recorded'); return false; } };
    /* S18: an instruction to the Creative Director answers as soon as the worker has ACCEPTED it (the job exists), so the composer
       clears only then; a refusal (network, 4xx, 5xx) comes back as {error} and the composer keeps the words with Retry and Edit.
       The job then runs on; its own failure is reported by the activity panel. One instruction at a time per project ({busy}). */
    const directTeam = async (text, tgt, o) => {
      o = o || {}; const key = 'revise:' + pidRef.current; const P0 = pRef.current;
      if (!P0) return { error: { message: 'no project open' } };
      if (once.current.has(key)) return { busy: true };
      once.current.add(key);
      const asset = tgt !== 'set' && a ? a.id : undefined; const layers = o.layers || (tgt === 'asset' && selLayers.length ? selLayers : undefined);
      const label = 'Reading the direction against ' + (tgt === 'set' ? 'the whole set' : tgt === 'family' && a ? 'the ' + a.family : (a || {}).title || 'the asset');
      let r;
      try { r = await call('/studio/job', { project: P0.id, stage: 'revise', input: { target: tgt, asset, instruction: text, layers }, idem: 'revise:' + P0.id + ':' + Date.now() }); }
      catch (e) { once.current.delete(key); return { error: e }; }
      if (!r || !r.job) { once.current.delete(key); return { error: { message: 'the worker did not create the job' } }; }
      setP(prev => prev && prev.id === r.job.project && !(prev.jobs || []).some(j => j.id === r.job.id) ? Object.assign({}, prev, { jobs: (prev.jobs || []).concat([r.job]) }) : prev);
      (async () => {
        try { const j = await runJob(r.job.id, label); const d = await reload(); if (j && j.result && j.result.kind === 'adapt' && j.result.changed && j.result.changed.length && d) { const first = j.result.changed[0]; setNotice({ kind: 'success', title: j.result.changed.length + ' adaptation' + (j.result.changed.length === 1 ? '' : 's') + ' made', text: 'New assets in the family, the words kept.', actions: [{ label: 'Open the first', fn: () => { setSelAsset(first); setView('asset', true); } }] }); } }
        catch (e) { fail(e, 'The direction did not finish'); } finally { once.current.delete(key); }
      })();
      return { accepted: true, job: r.job };
    };
    /* the paid remedies of the impact list: one revise call on that asset, locked fields kept by the stage itself */
    const reviseFromImpact = async (x, r) => { const ins = r.remedy === 'readapt' ? 'The master this was adapted from has changed. Bring this asset\'s words in line with the master\'s current version, fitted to this channel and format. Keep the locked fields.' : 'The creative strategy was confirmed after this asset was made. Bring the words in line with the confirmed strategy (proposition, audience, tone). Keep the locked fields.'; await job('revise', { target: 'asset', asset: x.asset, instruction: ins }, null, 'revise:' + x.asset + ':' + r.code + ':' + x.version, (r.remedy === 'readapt' ? 'Re-adapting ' : 'Revising ') + x.title); await reload(); };
    const pickAlternative = async (assetId, field, option) => { try { const as = pRef.current.assets.find(x => x.id === assetId); if (!as) return; await call('/studio/version', { asset: as.id, revision: as.revision, copy: { [field]: option }, note: 'chose an alternative ' + field }); await reload(); setSelAsset(as.id); } catch (e) { if (e.status === 409) await reload(); fail(e, 'The alternative was not applied'); } };
    const decideProposal = async (eid, decision) => { try { const r = await call('/studio/proposal', { project: pRef.current.id, eid, decision }); const d = await reload(); if (decision === 'do' && r.jobs && r.jobs.length) pump(d); } catch (e) { fail(e, 'The decision was not recorded'); } };
    const remember = async (eid, scope, offer) => { try { const ta = document.getElementById('offer-' + eid); const rule = ta ? ta.value.trim() : offer.rule; const r = await call('/studio/remember', { project: pRef.current.id, eid, scope, rule, task: offer.task, campaign: offer.campaign, instruction: offer.instruction }); toastMsg(r.saved ? 'Saved as ' + (r.scope === 'campaign' ? 'a campaign preference for ' + r.campaign : 'a lasting ' + pRef.current.ns.toUpperCase() + ' rule') : 'Not saved; applied to this work only'); await reload(); } catch (e) { fail(e, 'The preference was not recorded'); } };
    /* a retry is a new job named after the one that failed and how many retries it has had: pressing Retry twice runs it once */
    const retryJob = (j) => guard('retry:' + j.id, async () => { try { const n = ((pRef.current || {}).jobs || []).filter(x => (x.idem || '').indexOf('retry:' + j.id + ':') === 0 && (x.state === 'failed' || x.state === 'cancelled')).length; const r = await call('/studio/job', { project: j.project || pidRef.current, asset: j.asset || undefined, stage: j.stage, input: j.input, idem: 'retry:' + j.id + ':' + n }); const done = await runJob(r.job.id, 'Retrying ' + j.stage); const d = await reload(); if (done && done.state === 'done') { setNotice({ kind: 'info', title: 'The ' + j.stage + ' step ran on retry.', text: 'Nothing was lost; the result is in place.' }); if (j.stage === 'copy' && d) { const fresh = d.assets[d.assets.length - 1]; if (fresh) setSelAsset(fresh.id); } pump(d); } } catch (e) { fail(e, 'The retry did not start'); } });
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
          // a finished creative is exported as the generated bitmap itself: nothing is drawn over it and no composed PNG is saved
          if (v.layout && v.layout.layers && v.mode !== 'finished') {
            const imgs = await loadImages(v, p0.ns); const fonts = await R.ensureFonts(v.layout, v.copy, { timeout: 4000 });
            // the bundle is the approved version as validated: an image that did not load, or a composition that no longer passes
            // here, stops the export with the asset named - never a zip with a hole or a blocked tile in it
            if ((imgs._failed || []).length) throw new Error(x.a.title + ': an image file did not load (' + imgs._failed.length + '). Open it in Design and measure again; no bundle was made.');
            const pre = R.validate(v.layout, v.copy, imgs, { fonts, format: x.a.format, channel: x.a.channel });
            if (!pre.ok) throw new Error(x.a.title + ': the export preflight found ' + pre.issues.filter(i => i.severity === 'blocking').map(i => i.code.replace(/_/g, ' ')).join(', ') + '. Open it in Design to fix it; no bundle was made.');
            const blob = await R.toBlob(v.layout, v.copy, imgs); const u8 = new Uint8Array(await blob.arrayBuffer());
            files.push({ name: safe + '.png', data: u8 }); const d0 = dims(u8); list.push(Object.assign({ name: safe + '.png', bytes: u8.length, want: v.layout.stage ? { w: v.layout.stage.w, h: v.layout.stage.h } : null }, d0 || {}));
            if (canWrite() && !p0.readOnly) { let bin = ''; for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); await call('/studio/render/save', { asset: x.a.id, version: v.id, imageB64: btoa(bin), mime: 'image/png' }); }
          } else if (v.image && v.image.url) {
            // the generated bitmap itself: a failed download stops the export (it used to be skipped in silence), and the file keeps its own type
            const r = await fetch((typeof csBase === 'function' ? csBase() : '') + v.image.url, { headers: typeof axHeaders === 'function' ? axHeaders() : {} });
            if (!r.ok) throw new Error(x.a.title + ': the image did not download (HTTP ' + r.status + '); no bundle was made.');
            const ct = r.headers.get('content-type') || ''; const ext = /jpe?g/.test(ct) ? '.jpg' : /webp/.test(ct) ? '.webp' : '.png';
            const u8 = new Uint8Array(await r.arrayBuffer()); files.push({ name: safe + ext, data: u8 }); list.push(Object.assign({ name: safe + ext, bytes: u8.length }, dims(u8) || {}));
          } else if (v.mode !== 'copy') throw new Error(x.a.title + ': there is no image or composition to export for this version.');
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
      if (id === 'produce') id = 'copy'; else if (id === 'refine') id = 'design';   // the names before S13, from older links and stored places
      const visual = p ? p.assets.filter(x => (current(x) || {}).mode !== 'copy') : [];
      if (id === 'brief-details') { setView('brief', true); setTimeout(() => { const el = document.getElementById('st-brief-details'); if (el) { el.open = true; el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, 60); return; }
      if (id === 'brief' || id === 'objectives' || id === 'strategy' || id === 'directions') setView(id, true);
      else if (id === 'copy') { if (p && p.assets[0] && !a) setSelAsset(p.assets[0].id); setView('copywrite', true); }
      else if (id === 'design') { const guided = !!(p && p.workflow && p.workflow.v === 2); const needsMode = guided && !(p.brief || {}).production && visual.length && !visual.some(x => { const v = current(x); return v && v.image && v.image.key; }); if (!visual.length || needsMode) setView('board', true); else { if (!a || visual.indexOf(a) < 0) setSelAsset(visual[0].id); setView('asset', true); } }
      else if (id === 'review') setView('review', true); else if (id === 'export') setView('export', true);
    };
    goStageRef.current = goStage;
    const openAsset = id => { setSelAsset(id); setSelField(null); setView('asset'); };
    /* Alt+1..7 jumps to a step from anywhere in the Studio, except while typing; the digit is read by its key (e.code), since
       Option with a digit types a symbol on a Mac */
    useEffect(() => { const h = e => { if (!pRef.current || !e.altKey || e.ctrlKey || e.metaKey) return; const dm = /^(?:Digit|Numpad)([1-9])$/.exec(e.code || ''); const n = dm ? +dm[1] : +e.key; if (n >= 1 && n <= STAGES.length && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); goStage(STAGES[n - 1].id); } }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); });

    const inRefine = !!(p && view === 'asset' && a && !cmp);
    const liveJobs = p ? (p.jobs || []).filter(j => j.state === 'queued' || j.state === 'running') : [];
    const campName = p && p.campaign ? ((kit && kit.campaigns || []).find(c => c.id === p.campaign) || {}).name || p.campaign : '';
    /* S18: one save state for the whole page, in four words that mean four different things: a version is saved, a change is
       being written, a layout draft is kept for this person only (recoverable, not a version), or there are changes nothing holds */
    // S19: one vocabulary for the whole page: Unsaved, Saving recovery draft, Draft saved, Saving version, Version saved, Save failed
    const saveKind = saveSt.err || layoutDirty === 'failed' ? 'bad' : layoutDirty === 'saving' ? 'busy' : saveSt.pending || typing ? 'busy' : layoutDirty === 'drafting' ? 'drafting' : layoutDirty === 'draft' ? 'draft' : layoutDirty ? 'warn' : 'ok';
    const saveWord = { bad: 'Save failed', busy: layoutDirty === 'saving' ? 'Saving version...' : 'Saving...', drafting: 'Saving recovery draft...', draft: 'Draft saved', warn: 'Unsaved', ok: 'Version saved' }[saveKind];
    const saveTitle = { bad: 'The last change was refused or did not reach the worker; your changes are still here (and the recovery draft is kept). Save again or retry.', busy: 'A change is being written as a new version', drafting: 'Your layout changes are being kept as a recovery draft for you only', draft: 'Your layout changes are kept as a draft for you only (they come back after a reload or when you return to this asset); Save layout makes them a version', warn: 'Layout changes that nothing holds yet: they are kept as a recovery draft in a moment, or Save layout keeps them as a version', ok: 'Every change is saved as a version' }[saveKind];
    const b0 = (p && p.brief) || {}; const g2h = b0.workflow === 2;
    const pmode = p && b0.deliverable !== 'copy' ? ((b0.production && b0.production.mode) || (g2h ? '' : b0.creationMode === 'finished' ? 'finished' : 'editable')) : null;
    const backToAxiom = () => { const st = layoutDirtyRef.current; if ((st === 'saving' && !window.confirm('A version is still being saved. Leave the Studio anyway? Your changes stay as a recovery draft.')) || (st === 'failed' && !window.confirm('The last save failed. Leave the Studio? Your changes stay as a recovery draft for you, and come back when you open this asset.'))) return; try { if (typeof window.go === 'function') window.go('command'); } catch (e) {} };
    const header = html`<header class="st-head">
      <button class="st-back" onClick=${backToAxiom} title="Back to AXIOM: the newsroom and every other view (the Studio keeps your place)" aria-label="Back to AXIOM"><${Icon} n="back" size=${15} /><span>AXIOM</span></button>
      <span class="st-hbrand" aria-hidden=${p ? 'true' : undefined}><span class="st-appname">Creative Studio</span></span>
      ${p ? html`<div class="st-proj">
          <div class="st-proj-row"><button class="ov-link st-allp" onClick=${closeProject} title="Every project for this client">All projects</button><span class="st-sep" aria-hidden="true">/</span><b class="st-ptitle" title=${p.title}>${p.title}</b></div>
          <div class="st-psub"><span title="client">${client.name}</span>${campName ? html`<span class="st-dotsep" aria-hidden="true"></span><span title="campaign">${campName}</span>` : html`<span class="st-dotsep" aria-hidden="true"></span><span class="ov-dim">no campaign</span>`}<span class="st-dotsep" aria-hidden="true"></span><span title=${'Content type: ' + (b0.deliverable === 'copy' ? 'copy only, no tiles' : b0.deliverable === 'visual' ? 'visual creative' : 'a coordinated set') + ((b0.channels || []).length ? ' for ' + b0.channels.map(chanLabel).join(', ') : '')}>${b0.deliverable === 'copy' ? 'Copy only' : b0.deliverable === 'visual' ? 'Visual' : 'Set'}${(b0.channels || []).length ? ' - ' + b0.channels.map(chanLabel).join(', ') : ''}</span>
            ${pmode === null ? null : !pmode ? html`<${Chip} title="The production mode (Editable creative or Full AI creative) is chosen in Design once the copy is ready">mode: chosen in Design</${Chip}>` : html`<${Chip} kind=${pmode === 'finished' ? 'warn' : ''} title=${pmode === 'finished' ? 'Full AI creative: the image model paints the whole piece, words and mark included; one bitmap, nothing composed over it' : 'Editable: imagery generated, words and the exact mark composed as live layers'}>${pmode === 'finished' ? 'Finished creative' : 'Editable'}</${Chip}>`}
            ${p.readOnly ? html`<${Chip}>legacy, read-only</${Chip}>` : !canWrite() ? html`<${Chip} title="This key can look, compare and export; it cannot change anything">read-only key</${Chip}>` : null}${p.legacy ? html`<${Chip} title="the original is untouched">imported from ${p.legacy.id}</${Chip}>` : null}</div>
        </div>` : html`<div class="st-proj"><div class="st-proj-row"><b class="st-libword">Project library</b><select class="st-sel st-client" value=${clientId} onChange=${e => switchClient(e.target.value)} aria-label="Client">${CLIENTS.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select></div></div>`}
      <div class="st-head-r">
        ${p && !p.readOnly && canWrite() ? html`<span class=${'st-save ' + saveKind} role="status" aria-live="polite" title=${saveTitle}>${saveWord}${saveSt.err ? html` <button class="ov-link" onClick=${() => { setSaveSt(s => Object.assign({}, s, { err: null })); flushCopy(saveSt.err.asset); }}>retry</button>` : null}</span>` : null}
        ${p ? html`<button class=${'st-activity' + (liveJobs.length ? ' on' : '') + ((p.jobs || []).some(j => j.state === 'failed') ? ' bad' : '')} onClick=${() => { setActOpen(true); const el = document.querySelector('#studio-root .st-workspace-activity'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); else setView('jobs', true); }} aria-label=${liveJobs.length ? liveJobs.length + ' job' + (liveJobs.length === 1 ? '' : 's') + ' running or queued; show the activity' : 'No jobs running; open Jobs'} title=${liveJobs.length ? 'Show what is running now' : 'Open the jobs list'}>${liveJobs.length ? html`<span class="st-work-beacon live small" aria-hidden="true"></span>${liveJobs.length} running` : (p.jobs || []).some(j => j.state === 'failed') ? html`<span class="st-work-beacon failed small" aria-hidden="true"></span>needs attention` : 'Jobs'}</button>` : null}
        ${prov ? html`<span class=${'st-prov ' + (prov.claude && prov.gemini ? 'ok' : prov.claude ? 'part' : 'bad')} title=${(prov.claude ? 'Claude is configured on the worker. ' : 'Claude is not configured on the worker: writing, planning and the Creative Director cannot run. ') + (prov.gemini ? 'Image generation is configured. ' : 'Image generation is not configured: compositions work, imagery cannot be made. ') + 'Reachability is checked when a call is made. Model calls today ' + (status.budget ? status.budget.used + ' of ' + status.budget.cap : '-') + '. Build ' + status.build + '.'}>${prov.claude && prov.gemini ? 'Models ready' : !prov.claude ? 'Claude not configured' : 'Images not configured'}</span>` : null}
        ${status && !p ? html`<${Chip} title=${'Worker build; model calls today ' + (status.budget ? status.budget.used + ' of ' + status.budget.cap : '-')}>${status.build}</${Chip}>` : null}
        <button class=${'st-iconbtn' + (helpOpen ? ' on' : '')} aria-expanded=${helpOpen ? 'true' : 'false'} aria-controls="st-help" onClick=${() => setHelpOpen(!helpOpen)} title="How the Studio works: the steps, what costs a model call, the keyboard" aria-label="Help"><${Icon} n="help" size=${16} /></button>
      </div>
    </header>`;
    const helpPanel = helpOpen ? html`<div class="st-help" id="st-help" role="region" aria-label="How the Studio works">
      <div class="st-help-head"><b>How the Studio works</b><button class="ov-link" onClick=${() => setHelpOpen(false)}>close</button></div>
      <ol class="st-help-steps">${STAGES.map((s0, i) => html`<li key=${s0.id}><b>${s0.label}</b> ${s0.purpose} <span class="ov-dim">${s0.next}</span></li>`)}</ol>
      <div class="ov-dim">Nothing is generated, approved, deleted or moved for you: every paid action states its cost first and asks; a change to an earlier choice asks what to do with the work built on it. Alt+1..7 moves between the steps; on the canvas, ? lists the editing keys.</div>
    </div>` : null;

    const headOf = (id, extra) => { const s0 = STAGES.find(x => x.id === id); return Object.assign({ id, title: s0.label, purpose: s0.purpose, next: s0.next, flow, focusRef: titleRef }, extra || {}); };
    const tabsFor = id => id === 'brief' ? { tabs: [['brief', 'Brief'], ['sources', 'Sources', p.sources.length], ['references', 'References', p.references.length]], tab: view, onTab: k => setView(k) }
      : id === 'copy' ? { tabs: [['copywrite', 'By channel'], ['copy', 'All copy', p.assets.length || null], ['kit', 'Message kit', (p.texts || []).length || null], ['sequence', 'Sequence', ((p.brief || {}).sequences || []).length || null]], tab: view, onTab: k => { if (k === 'copywrite' && !a && p.assets[0]) setSelAsset(p.assets[0].id); setView(k); } }
      : id === 'design' ? { tabs: [['asset', a ? a.title : 'Canvas'], ['board', 'Board', p.assets.length || null], ['production', 'Recipes and usage'], ['jobs', 'Jobs', liveJobs.length || null]], tab: view, onTab: k => { if (k === 'asset' && !a && p.assets[0]) setSelAsset(p.assets[0].id); setView(k); } }
      : id === 'review' ? { tabs: [['review', 'Preflight and approvals'], ['export', 'Delivery', flow.counts.ready || null]], tab: view, onTab: k => setView(k) } : {};
    const Staged = (id, acts, body) => html`<div class="st-centre-pad"><${StageHead} ...${headOf(id, tabsFor(id))}>${acts}</${StageHead}>${body}</div>`;
    // the activity panel replaces the old line of job chips: every running, queued, failed or just-finished job with its phase
    const jobsLine = p ? html`<${WorkspaceActivity} p=${p} status=${status} now=${now} ro=${!canWrite()} open=${actOpen} onToggle=${() => setActOpen(o => !o)} onRetry=${retryJob} onCancel=${cancelJob} onOpenJobs=${() => setView('jobs', true)} onOpenAsset=${id => { if (p.assets.some(y => y.id === id)) openAsset(id); }} />` : null;
    const jobsLineLive = p ? html`<${WorkspaceActivity} p=${p} status=${status} now=${now} ro=${!canWrite()} open=${actOpen} liveOnly=${!actOpen} onToggle=${() => setActOpen(o => !o)} onRetry=${retryJob} onCancel=${cancelJob} onOpenJobs=${() => setView('jobs', true)} onOpenAsset=${id => { if (p.assets.some(y => y.id === id)) openAsset(id); }} />` : null;

    const F = window.STFlow; const guided = !!(p && p.workflow && p.workflow.v === 2 && F);
    const lockedAt = id => guided && flow && flow[id] && flow[id].state === 'locked';
    const lastJob = st => p ? ((p.jobs || []).filter(j => j.stage === st).sort((x, y) => (y.created || 0) - (x.created || 0))[0] || null) : null;
    const notUsed = step => html`<div class="st-empty-state"><b>Not used in this project.</b><span>This project was made before the guided workflow${step === 'objectives' ? ': its objective and key message are written in the Brief' : ': its strategy, if any, is in the Brief'}. New projects choose ${step === 'objectives' ? 'their objectives' : 'their strategy'} here, from Axiom's reading of the brief.</span><button class="btn sm ghost" onClick=${() => goStage('brief')}>Open the Brief</button></div>`;
    const wizPreset = preset ? Object.assign({}, preset, { type: preset.type || (preset.from === 'release' || preset.start === 'release' ? 'announcement' : preset.from === 'content' ? 'social' : preset.from === 'sentinel' || preset.start === 'analyse' ? 'response' : preset.start === 'reference' ? 'campaign' : ''), kind: preset.start === 'release' ? 'article' : preset.from === 'sentinel' ? 'situation' : 'brief', text: [preset.text, preset.instruction].filter(Boolean).join('\n\n') }) : null;
    let centre;
    if (!pid && intake && F && F.Wizard) centre = html`<${F.Wizard} key=${'wiz:' + ((preset && preset.at) || 0)} clients=${CLIENTS} clientId=${clientId} preset=${wizPreset} busy=${busy} prov=${prov} onClient=${() => {}} onCreate=${o => { setPreset(null); createGuided(o); }} onCancel=${() => { setIntake(false); setPreset(null); }} />`;
    else if (!pid) centre = intake ? html`<${Intake} key=${'intake:' + clientId + ':' + ((preset && preset.at) || 0)} client=${client} kit=${kit} preset=${preset} onCreate=${o => { setPreset(null); createProject(o); }} onCancel=${() => { setIntake(false); setPreset(null); }} />` : html`<${Library} client=${client} data=${lib} err=${libErr} resume=${store.place(clientId)} onOpen=${openProject} onNew=${() => setIntake(true)} onStart=${k => { setPreset({ start: k, at: Date.now() }); setIntake(true); }} onImport=${importLegacy} />`;
    else if (!p) centre = html`<div class="st-centre-pad" aria-busy="true"><div class="ov-empty">${busy || 'Opening the project...'}</div></div>`;
    else if (cmp && a) centre = html`<${CompareView} a=${a} ns=${p.ns} vA=${a.versions.find(v => v.id === cmp.a)} vB=${a.versions.find(v => v.id === cmp.b)} onClose=${() => setCmp(null)} onRestore=${vid => restore(a, vid)} />`;
    else if (lockedAt(stage) && view !== 'brand' && view !== 'context') centre = Staged(stage, null, html`<${F.LockedStage} step=${stage} wf=${p.workflow} onGo=${goStage} />`);
    else if (view === 'brief' && guided) centre = Staged('brief', null, html`<${F.BriefWorkspace} key=${p.id} p=${p} client=${client} kit=${kit} busy=${busy} prov=${prov} wf=${p.workflow} job=${lastJob('analyse')} now=${now} durations=${(status || {}).durations} onAnalyse=${analyseGuided} onConfirm=${() => confirmStep('brief', {}, { then: async () => { const st = ((pRef.current || {}).workflow || {}).steps || {}; if (st.objectives && st.objectives.state !== 'locked' && (st.brief || {}).state === 'complete') setView('objectives', true); } })} onCampaign=${setCampaign} onRetry=${() => { const j = lastJob('analyse'); if (j) retryJob(j); }} onCancel=${() => { const j = lastJob('analyse'); if (j) cancelJob(j.id); }} onGo=${goStage} onSaveBrief=${saveBriefPatch} />`);
    else if (view === 'objectives') centre = Staged('objectives', null, p.intel && F ? html`<${F.ObjectivesStep} key=${p.intel.id} p=${p} busy=${busy} onConfirm=${body => guided ? confirmStep('objectives', body, { then: () => setView('strategy', true) }) : selectIntel({ objective: body.objective, message: body.message })} onDecision=${intelDecision} />` : notUsed('objectives'));
    else if (view === 'strategy') centre = Staged('strategy', null, p.intel && F ? html`<${F.StrategyStep} key=${p.intel.id} p=${p} kit=${kit} busy=${busy} wf=${p.workflow} job=${lastJob('direct')} now=${now} durations=${(status || {}).durations} onConfirm=${(body, gen) => !body ? directGuided({ n: 3 }) : guided ? confirmStep('strategy', body, { then: gen ? () => directGuided({ n: 3 }) : null }) : selectIntel({ strategy: body.strategy })} onDecision=${intelDecision} onDraftStrategy=${draftStrategy} onSaveStrategy=${st => saveBriefPatch({ strategy: st })} onRetry=${() => { const j = lastJob('direct'); if (j) retryJob(j); }} onGo=${goStage} />` : notUsed('strategy'));
    else if (view === 'directions' && guided) centre = Staged('directions', null, html`<${F.DirectionsBoard} p=${p} kit=${kit} busy=${busy} wf=${p.workflow} job=${lastJob('direct')} now=${now} durations=${(status || {}).durations} onDirect=${directGuided} onChoose=${chooseGuided} onUpdate=${updateDirection} onDuplicate=${duplicateDirection} onDecision=${intelDecision} onRetry=${() => { const j = lastJob('direct'); if (j) retryJob(j); }} onGo=${goStage} onKeep=${d => keepEarlier(null, [d.id])} />`);
    else if (view === 'brief') centre = html`<${BriefView} key=${p.id} p=${p} head=${headOf('brief', tabsFor('brief'))} prov=${prov} onGo=${goStage} onSave=${saveBrief} onDirect=${direct} onProduce=${o => produce(o || {})} onCampaign=${setCampaign} onStrategy=${draftStrategy} onAnalyse=${analyse} onChoose=${chooseDirection} onSelect=${selectIntel} onDecision=${intelDecision} onVariants=${produceVariants} onKit=${writeKit} kit=${kit} client=${client} busy=${busy} />`;
    else if (view === 'sources') centre = Staged('brief', null, html`<${SourcesView} p=${p} onAdd=${addSource} busy=${busy} />`);
    else if (view === 'references') centre = Staged('brief', null, html`<${ReferencesView} p=${p} onAdd=${addReference} onAnalyse=${analyseReference} onRecipe=${saveRecipe} busy=${busy} />`);
    else if (view === 'directions') centre = html`<${DirectionsView} p=${p} head=${headOf('directions')} prov=${prov} onChoose=${chooseDirection} onMore=${direct} busy=${busy} />`;
    else if ((view === 'copywrite' || view === 'copy') && guided && !p.assets.length) centre = Staged('copy', null, html`<${F.CopyStart} key=${'cs:' + p.id} p=${p} busy=${busy} prov=${prov} job=${lastJob('copy')} now=${now} durations=${(status || {}).durations} onGenerate=${() => produce({})} onSaveBrief=${saveBriefPatch} onRetry=${() => { const j = lastJob('copy'); if (j) retryJob(j); }} onGo=${goStage} />`);
    else if (view === 'copywrite') centre = html`<${CopyStage} p=${p} a=${a} head=${headOf('copy', tabsFor('copy'))} activity=${jobsLine} banner=${guided ? html`<${F.StaleCopy} p=${p} wf=${p.workflow} busy=${busy} onRewrite=${() => produce({})} onKeep=${ids => keepEarlier(ids)} />` : null} prov=${prov} busy=${busy} onSel=${id => { setSelAsset(id); setSelField(null); }} onEdit=${editAsset} onReady=${readyCopy} onDirect=${directTeam} onPick=${pickAlternative} onWrite=${() => produce({})} onGo=${goStage} onDraftState=${onDraftState} />`;
    else if (view === 'board' && guided && !(p.brief || {}).production && p.assets.some(x => { const v = current(x); return v && v.mode !== 'copy' && !(v.image && v.image.key); }) && !(p.jobs || []).some(j => j.stage === 'render')) centre = Staged('design', null, html`${jobsLine}<${F.ProductionModes} p=${p} busy=${busy} prov=${prov} onProduce=${produceMode} /><${BoardView} p=${p} onOpen=${openAsset} />`);
    else if (view === 'board') { const wait = p.assets.filter(needsImagery); const imgRunning = (p.jobs || []).some(j => j.stage === 'render' && (j.state === 'queued' || j.state === 'running')); centre = Staged('design', p.assets.length ? html`${wait.length && canWrite() && !p.readOnly ? html`<button class="btn sm" disabled=${!!busy || (prov && !prov.gemini) || imgRunning} title=${prov && !prov.gemini ? 'Image generation is not configured on the worker' : imgRunning ? 'Renders are already running' : 'One paid image generation per planned region, confirmed first'} onClick=${() => generateImagery(wait)}>Generate imagery (${wait.length})</button>` : null}${p.assets.some(x => (current(x) || {}).mode !== 'copy') ? html`<button class=${'btn sm' + (wait.length ? ' ghost' : '')} onClick=${() => goStage('design')}>Open the canvas</button>` : html`<button class="btn sm" onClick=${() => goStage('review')}>Continue to Review</button>`}` : canWrite() && !p.readOnly ? html`<button class="btn sm" onClick=${() => goStage('copy')}>Write the copy first</button>` : null, html`${jobsLine}${!p.assets.length ? html`<div class="st-empty-state"><b>Nothing to design yet.</b><span>The words come first: write and check the copy, then build each creative here.</span></div>` : !p.assets.some(x => (current(x) || {}).mode !== 'copy') ? html`<div class="st-empty-state"><b>Copy only: nothing to design.</b><span>This project's pieces are words for the channels, with no creative to build. Approve them in Review.</span></div>` : wait.length ? html`<div class="st-imagery-wait" role="status"><b>${wait.length} composition${wait.length === 1 ? '' : 's'} waiting for imagery.</b> <span class="ov-dim">${(p.brief || {}).imageryTiming === 'after_copy' ? 'The brief holds the imagery until the copy is ready: ' + p.assets.filter(x => wait.indexOf(x) >= 0 && standing(x, 'copy')).length + ' of them have their copy marked ready.' : 'Their renders have not landed (or did not run).'}</span></div>` : null}<${BoardView} p=${p} onOpen=${openAsset} />`); }
    else if (view === 'kit') centre = Staged('copy', null, html`<${KitView} p=${p} busy=${busy} onWrite=${writeKit} onUpdate=${updateText} onVerdict=${textVerdict} />`);
    else if (view === 'sequence') centre = Staged('copy', null, html`<${SequenceView} p=${p} onPlan=${planSequence} onOpen=${openAsset} busy=${busy} />`);
    else if (view === 'production') centre = Staged('design', null, html`<${ProductionView} p=${p} onRun=${async () => pump(await reload())} onOpen=${openAsset} onReview=${() => setView('review', true)} onRevise=${reviseFromImpact} />`);
    else if (view === 'jobs') centre = Staged('design', null, html`<${JobsView} p=${p} onRetry=${retryJob} onCancel=${cancelJob} onStep=${j => runJob(j.id, 'Running ' + j.stage)} budget=${status ? status.budget : null} />`);
    else if (view === 'copy') centre = Staged('copy', null, html`<${CopyView} p=${p} onEdit=${editAsset} onOpen=${id => { setSelAsset(id); setView('copywrite'); }} />`);
    else if (view === 'review') centre = html`<${ReviewStage} p=${p} head=${headOf('review', tabsFor('review'))} flow=${flow} onGo=${goStage} onApprove=${approve} onOpen=${openAsset} />`;
    else if (view === 'export') centre = html`<${ExportView} p=${p} head=${headOf('review', tabsFor('review'))} flow=${flow} state=${exportState} onGo=${goStage} onExport=${doExport} onClickup=${ready => setDialog({ kind: 'clickup', ready })} />`;
    else if (view === 'brand') centre = html`<div class="st-centre-pad"><${BrandView} p=${p} tick=${ctxTick} /></div>`;
    else if (view === 'context') centre = html`<${ContextView} p=${p} tick=${ctxTick} onVoice=${() => setPanel('voice')} onLearned=${() => setPanel('learned')} />`;
    else if (a) { const i = p.assets.indexOf(a); centre = html`<div class="st-centre-pad st-refine"><${StageHead} ...${headOf('design', Object.assign({ compact: true }, tabsFor('design')))}>${flow.counts.valid === flow.counts.n && flow.counts.n ? html`<button class="btn sm" onClick=${() => goStage('review')}>Continue to Review</button>` : null}</${StageHead}>${jobsLineLive}<${AssetView} key=${a.id} p=${p} a=${a} kit=${kit} slot=${slot} tool=${tool} setTool=${setTool} preview=${preview} setPreview=${setPreview} onBrand=${() => setView('brand', true)} onContext=${() => setView('context', true)} tab=${tab} setTab=${setTab} conflict=${conflict && conflict.asset === a.id ? conflict : null} onConflict=${resolveConflict} neighbours=${{ prev: i > 0 ? p.assets[i - 1].id : null, next: i < p.assets.length - 1 ? p.assets[i + 1].id : null }} sel=${selField} setSel=${setSelField} onEdit=${editAsset} onDraftState=${onDraftState} onLayout=${editLayout} onLayoutSave=${saveLayout} onPropose=${propose} onApplyConcept=${applyConcept} onOpen=${openAsset} onValidate=${fileValidation} onMarkVariant=${markVariant} onRepair=${repairLayout} onUndoRepair=${undoRepair} onLayoutDirty=${setLayoutDirty} onLock=${toggleLock} onApprove=${approve} onCompare=${(x, y) => setCmp({ a: x, b: y })} onRestore=${restore} onRender=${render} onAreaEdit=${areaEdit} onRegenerate=${regenerateFinished} onDerive=${deriveEditable} onPreservation=${filePreservation} onVariant=${layoutVariant} onRetryJob=${retryJob} sugg=${sugg} onSuggRefresh=${r => fetchSugg(r !== false)} onSelection=${setSelLayers} onResize=${resizeAsset} resized=${resized[a.id]} busy=${busy} /></div>`; }
    else centre = Staged('design', null, html`<div class="st-empty-state"><b>${p.assets.length ? 'Choose an asset on the left.' : 'Nothing to design yet.'}</b><span>${p.assets.length ? 'Each asset opens here with its words, layout and imagery.' : p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction, then write the copy.' : 'Write the copy first.'}</span>${!p.assets.length ? html`<button class="btn sm" onClick=${() => goStage(p.directions.length && !p.directions.some(d => d.chosen) ? 'directions' : 'copy')}>${p.directions.length && !p.directions.some(d => d.chosen) ? 'Go to Direction' : 'Go to Copy'}</button>` : null}</div>`);

    /* S18: the inspector in Design has two modes - Properties (the selection) and Creative Director (review, ideas, conversation) -
       and two controls, Checks (validation, quality, the human approval of this version) and History (versions, what the Studio used).
       Brand and the words are tools in the dock. Arrow keys move between the four. */
    const insTabs = [['properties', 'Properties'], ['director', 'Creative Director'], ['checks', 'Checks'], ['history', 'History']];
    const tabKey = e => { const i = insTabs.findIndex(t => t[0] === tab); if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = insTabs[(i + (e.key === 'ArrowRight' ? 1 : insTabs.length - 1)) % insTabs.length][0]; setTab(n); setTimeout(() => { const el = document.getElementById('st-tabbtn-' + n); if (el) el.focus(); }, 0); } };
    // before there is anything to design, the frame is the work and its context: no assets rail, no canvas tools
    const early = !!p && !inRefine && view !== 'brand' && view !== 'context' && (['brief', 'objectives', 'strategy', 'directions'].indexOf(stage) >= 0 || (guided && stage === 'copy' && !p.assets.length && (view === 'copywrite' || view === 'copy')));
    const showCtx = early && !!F;
    const showAside = !!p && (inRefine || showCtx || (stage !== 'copy' && !early && partnerOpen));
    const showRail = !!p && !early && !inRefine && railOpen;
    const partnerEl = p ? html`<${CreativeDirector} p=${p} a=${inRefine ? a : null} kit=${kit} target=${target} setTarget=${setTarget} onDirect=${directTeam} onNote=${note} onPick=${pickAlternative} onDecide=${decideProposal} onRemember=${remember} onApplyInspection=${applyInspection} onReview=${reviewNow} busy=${busy} sugg=${inRefine ? sugg : null} onSuggRefresh=${r => fetchSugg(r !== false)} selLayers=${inRefine ? selLayers : []} onTool=${inRefine ? k => setTool(k) : null} sub=${cdSub} setSub=${setCdSub} />` : null;
    /* S18: the theme contract. The interface takes one accent: the campaign's own colour when the kit names one, else the client's
       palette primary, else the Studio's neutral; it is lightened until it reads at 4.5:1 on the panel, and its ink (the text on an
       accent fill) is black or white, whichever reads, at 4.5:1. Only the interface reads these: the renderer draws the creative
       from its own layout and never sees a CSS variable. */
    const theme = studioTheme(kit, p ? p.campaign : '');
    const rootRef = useRef(null);
    // a narrow screen keeps the inspector as a drawer: it closes when the asset changes, and Escape closes it
    useEffect(() => { setInspOpen(false); }, [selAsset, view]);
    useEffect(() => { if (!inspOpen) return; const h = e => { if (e.key === 'Escape') setInspOpen(false); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [inspOpen]);
    return html`<div ref=${rootRef} class=${'st' + (p ? ' has-project' : '') + (inRefine ? ' has-asset' : '') + (preview && inRefine ? ' previewing' : '')} data-stage=${stage} data-theme=${theme.source} style=${{ '--st-client-accent': theme.accent, '--st-client-ink': theme.ink }}>
      ${header}
      ${helpPanel}
      ${p ? html`<${Flow} flow=${flow} at=${stage} onGo=${goStage} />` : null}
      ${busy && p ? html`<div class="st-busy" role="status" aria-live="polite"><span class="st-spin" aria-hidden="true"></span>${busy}<span class="ov-dim"> - a persistent job: it continues if you close the tab, and the worker's tick finishes it.</span></div>` : null}
      <${Notice} n=${notice} onClose=${() => setNotice(null)} />
      <div class=${'st-body' + (p ? '' : ' lib') + (inRefine ? ' design' : '') + (p && !showAside ? ' noaside' : '') + (p && !showRail ? ' norail' : '') + (early ? ' early' : '')} style=${showRail ? { '--st-rail-w': railW + 'px' } : null}>
        ${showRail ? html`<${Rail} p=${p} view=${cmp ? 'compare' : view} setView=${v => setView(v, true)} sel=${selAsset} setSel=${id => { setSelAsset(id); setSelField(null); setCmp(null); }} toolsOpen=${toolsOpen} setToolsOpen=${setToolsOpen} layersRef=${null} onCollapse=${() => { setRailOpen(false); store.set({ rail: false }); }} />` : p && !early && !inRefine ? html`<button class="st-rail-open" onClick=${() => { setRailOpen(true); store.set({ rail: true }); }} aria-label="Show the assets panel" title="Show the assets">›</button>` : null}
        ${showRail ? html`<div class="st-rail-handle" role="separator" aria-orientation="vertical" aria-label="Resize the left panel" title="Drag to resize" onPointerDown=${railDown} onPointerMove=${railMove} onPointerUp=${railUp} onPointerCancel=${railUp}></div>` : null}
        <main class="st-centre" aria-label="Workspace">${centre}</main>
        ${p && showCtx && !inRefine ? html`<aside class="st-inspector st-ctxaside" aria-label="Project context"><${F.ContextPanel} p=${p} client=${client} kit=${kit} wf=${p.workflow} /><div class="st-ctx-links"><button class="ov-link" onClick=${() => setView('brand', true)}>Brand</button><button class="ov-link" onClick=${() => setView('context', true)}>Client context</button><button class="ov-link" onClick=${() => setView('jobs', true)}>Jobs</button></div></aside>` : p ? (showAside ? html`<aside class=${'st-inspector' + (inspOpen ? ' open' : '')} id="st-inspector" aria-label=${inRefine ? 'Inspector' : 'Creative Director'}>
          ${inRefine ? html`<div class="st-instabs" role="tablist" aria-label="Inspector" onKeyDown=${tabKey}>${insTabs.map(([k, l]) => html`<button key=${k} id=${'st-tabbtn-' + k} role="tab" aria-selected=${tab === k} aria-controls=${'st-tab-' + k} tabIndex=${tab === k ? 0 : -1} class=${'st-instab' + (tab === k ? ' on' : '') + (k === 'checks' || k === 'history' ? ' ctl' : ' mode')} title=${k === 'checks' ? 'Validation, quality and the human approval of this version' : k === 'history' ? 'Every version, and what the Studio used' : undefined} onClick=${() => setTab(k)}>${k === 'checks' ? html`<${Icon} n="shield" size=${14} />` : k === 'history' ? html`<${Icon} n="history" size=${14} />` : null}<span>${l}</span>${k === 'checks' && a && (a.readiness || {}).technical === 'failed' ? html` <span class="st-dot bad" aria-label="failing"></span>` : null}</button>`)}<button class="st-iconbtn sm st-insp-close" onClick=${() => setInspOpen(false)} aria-label="Close the inspector"><${Icon} n="x" size=${14} /></button></div>` : html`<div class="st-insp-head"><span class="st-lbl">Creative Director</span><button class="ov-link" onClick=${() => setPartnerOpen(false)} aria-label="Hide the Creative Director">hide</button></div>`}
          <div class="st-slot" ref=${setSlot} hidden=${inRefine && tab === 'director'}></div>
          <div class="st-partner-wrap" id="st-tab-director" role=${inRefine ? 'tabpanel' : undefined} aria-labelledby=${inRefine ? 'st-tabbtn-director' : undefined} hidden=${inRefine && tab !== 'director'}>${partnerEl}</div>
        </aside>${inRefine ? html`<button class="st-insp-toggle btn sm" aria-expanded=${inspOpen ? 'true' : 'false'} aria-controls="st-inspector" onClick=${() => setInspOpen(!inspOpen)}>${inspOpen ? 'Close panel' : 'Properties and Creative Director'}</button>` : null}` : stage === 'copy' || early ? null : html`<button class="st-aside-open" onClick=${() => setPartnerOpen(true)} aria-label="Show the Creative Director">Creative Director</button>`) : null}
      </div>
      ${dialog && dialog.kind === 'clickup' && p ? html`<${ClickupDialog} ready=${dialog.ready} client=${client} p=${p} onClose=${() => setDialog(null)} />` : null}
      ${panel && p ? html`<${ClientPanel} p=${p} kind=${panel} onClose=${() => setPanel(null)} onChanged=${() => { setCtxTick(t => t + 1); loadLib(); }} />` : null}
      ${impactQ && F ? html`<${F.ImpactDialog} q=${impactQ} onAnswer=${answerImpact} />` : null}
      ${editConflict ? html`<${ConflictDialog} c=${editConflict} onDone=${v => editConflict.res(v)} />` : null}
      ${dialog && dialog.kind === 'reason' ? html`<${ReasonDialog} title=${(dialog.what === 'approve' ? 'Approve ' : 'Reject ') + dialog.part} prompt=${'On ' + dialog.title + ', version ' + dialog.version + ' (the current one). Approval is recorded as client acceptance of this exact version, never as performance.'} onDone=${recordDecision} />` : null}
    </div>`;
  }

  /* S17: the parts the guided workflow (docs/studio-guided.js) builds on - one renderer, one set of chips and icons, one way of
     explaining an error - shared rather than copied; studio-guided.js loads after this file and registers window.STFlow */
  window.STKit = { html, call, blobUrl, toastMsg, ago, R, Chip, Icon, ICON, Lbl, Composition, useComposition, explain, canWrite, current, standing, chanLabel, CHANNELS, FORMATS, FORMAT_ICON, aest, keyedImage, StrategyPanel, TraceLine, WORD, INPUT_WORD, STRAT_WORD, BASIS_WORD, FIELD_WORD, KNOW_WORD, VIS_WORD, CLAIM_WORD, ANALYSE_KINDS, KIT_KINDS, sleep, vnum, vtotal, approvedOf, validOf, needsImagery };
  let mounted = false;
  window.studioInit = function () {
    const root = document.getElementById('studio-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${StudioApp} />`); }
    else { try { window.dispatchEvent(new CustomEvent('ax:studio-shown')); } catch (e) {} }
  };
})();
