/* AXIOM Creative Studio - Phase 0 prototype.
 *
 * One client-aware workspace for copy, creative and campaign production,
 * running entirely on SYNTHETIC DATA in the browser: no worker calls, no
 * model calls, nothing saved. Its job is to let the team walk the journey
 * (intake, directions, copy-only work, editable artwork, revision without a
 * render, regeneration announced first, compare, restore, component
 * approvals, checks, export, an explicit ClickUp hand-off, save-as-preference)
 * and correct the design before Phase 1 builds the durable backend under it.
 * Every place the prototype fakes a model or a job says so on screen. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.studioInit = function () {
      const root = document.getElementById('studio-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment.</div>';
    };
    return;
  }
  const { html, toastMsg, ago } = window.AXUI;
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const uid = p => p + Math.random().toString(36).slice(2, 8);
  const canWrite = () => !(window.AX_ROLE === 'read');
  const WHO = () => 'you';

  /* ---------------------------------------------------------------- fixtures */
  const CLIENTS = [
    { id: 'mca', name: 'Minerals Council of Australia', accent: '#c9a227', campaigns: [{ id: 'national', name: 'Australian mining (national)' }, { id: 'hoof', name: 'Hands Off Our Fuel' }, { id: 'vgo', name: "Victoria's Golden Opportunity" }], rules: 28, kit: true, shelf: true },
    { id: 'aep', name: 'Australian Energy Producers', accent: '#2f7fd6', campaigns: [{ id: 'gas', name: 'Gas for Australia' }], rules: 6, kit: true, shelf: false },
    { id: 'pca', name: 'Property Council of Australia', accent: '#3c9a6e', campaigns: [{ id: 'housing', name: 'Housing supply' }], rules: 0, kit: false, shelf: false },
  ];
  const FORMATS = { '1:1': { w: 1, h: 1, label: 'Square 1:1' }, '4:5': { w: 4, h: 5, label: 'Portrait 4:5' }, '9:16': { w: 9, h: 16, label: 'Story 9:16' }, '16:9': { w: 16, h: 9, label: 'Landscape 16:9' } };
  const CHANNELS = { linkedin: { label: 'LinkedIn', max: 900, format: '1:1' }, instagram: { label: 'Instagram', max: 700, format: '4:5' }, facebook: { label: 'Facebook', max: 900, format: '1:1' }, x: { label: 'X', max: 280, format: '16:9' } };
  const NOW = Date.now(), H = 3600e3;
  const RELEASE = 'MEDIA RELEASE - 30 September 2026\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.\n\nMCA Chief Executive Officer Tania Constable said fuel tax credits were not a subsidy. "Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.\n\nThe analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators. Removing it would add costs that pass on to consumers through the prices of goods and services.\n\nMining directly employs more than 300,000 Australians, most of them in regional communities.\n\nENDS';
  const LEDGER = [
    { id: 'c1', text: 'Mining paid $74 billion in company tax and royalties in 2023-24', value: 74, unit: 'billion', subject: 'company tax and royalties', period: '2023-24', passage: 'p1', quote: false },
    { id: 'c2', text: 'more than any other industry', value: null, unit: '', subject: 'tax ranking', period: '2023-24', passage: 'p1', quote: false },
    { id: 'c3', text: '"Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," - Tania Constable, CEO', value: null, unit: '', subject: 'fuel tax credit', period: '', passage: 'p2', quote: true },
    { id: 'c4', text: 'the credit is used by more than 150,000 businesses of all sizes', value: 150000, unit: 'businesses', subject: 'fuel tax credit users', period: '', passage: 'p3', quote: false },
    { id: 'c5', text: 'Removing it would add costs that pass on to consumers through the prices of goods and services', value: null, unit: '', subject: 'consumer cost', period: '', passage: 'p3', quote: false },
    { id: 'c6', text: 'Mining directly employs more than 300,000 Australians, most of them in regional communities', value: 300000, unit: 'jobs', subject: 'direct employment', period: '', passage: 'p4', quote: false },
  ];
  const PASSAGES = { p1: 'The Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.', p2: '"Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.', p3: 'The analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators. Removing it would add costs that pass on to consumers through the prices of goods and services.', p4: 'Mining directly employs more than 300,000 Australians, most of them in regional communities.' };
  const CONTEXT = {
    mandatory: ["Label the answer 'Fact', never 'Busted'", 'Businesses buy fuel and claim credits; vehicles never do', "Write 'more than any other industry', never 'more than all other industries combined'", 'Use the supplied MCA logo; never redraw it'],
    claims: ['$74 billion company tax and royalties, 2023-24 (ATO, EY) - approved', '150,000+ businesses use the credit - approved', '300,000+ direct jobs - approved'],
    preferences: ['Plain language on the road-fuel-tax point', 'Concrete consumer consequence: prices of goods and services'],
    campaign: ['HOOF: teal fact panel, red myth panel, "Hands Off Our Fuel." sign-off'],
    examples: 3, rejected: 1, inspiration: 2,
  };

  const sigOf = (part, v) => (part === 'copy' ? JSON.stringify([v.copy.headline, v.copy.support, v.copy.cta, v.copy.caption, v.copy.alt]) : JSON.stringify([v.image && v.image.key, v.layout, v.mode]));
  /* an approval stands while the content it accepted is unchanged; a copy edit leaves a design approval intact and vice versa */
  const standing = (a, part) => { const ap = (a.approvals || {})[part]; if (!ap) return null; const v = a.versions.find(x => x.id === a.current); return v && ap.sig === sigOf(part, v) ? ap : null; };
  const reconcile = a => { const out = {}; ['copy', 'design'].forEach(part => { const ap = standing(a, part); if (ap) out[part] = ap; }); return Object.assign({}, a, { approvals: out }); };
  function mkVersion(parent, patch, note, kind, by) {
    return Object.assign({ id: uid('v'), parent: parent ? parent.id : null, at: Date.now(), by: by || 'studio', kind: kind || 'text', note: note || '', copy: parent ? Object.assign({}, parent.copy) : {}, image: parent ? parent.image : null, layout: parent ? Object.assign({}, parent.layout) : { bg: 'photo', headlineSize: 'large' }, mode: parent ? parent.mode : 'composition' }, patch || {});
  }
  function demoProject() {
    const lk = mkVersion(null, { copy: { headline: 'Fuel tax credits are not a subsidy.', support: 'Businesses do not pay a road fuel tax on fuel used off-road. The credit returns a tax that was never meant to apply.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry. The fuel tax credit is not part of that story: businesses do not pay a road fuel tax on fuel used off-road. Hands Off Our Fuel. Source: ATO Taxation Statistics 2023-24; EY.', alt: 'Teal fact panel over a harvester at dusk with the line Fuel tax credits are not a subsidy' }, image: { key: 'bg-harvester', label: 'Harvester at dusk, restrained', model: 'gemini-3-pro-image', size: '2K' }, at: NOW - 40 * 60e3 }, 'first production', 'render');
    const lk2 = mkVersion(lk, { copy: Object.assign({}, lk.copy, { headline: 'Not a subsidy. A tax that never applied.' }), at: NOW - 22 * 60e3 }, 'headline tightened; layout and image kept', 'text');
    const ig = mkVersion(null, { copy: { headline: 'Who uses the fuel tax credit?', support: 'More than 150,000 businesses. Farmers, tradies, tourism operators.', cta: 'Hands Off Our Fuel', caption: 'Farmers, tradies and tourism operators: more than 150,000 businesses use the fuel tax credit. Removing it adds costs that pass on to you through the prices of goods and services. #HandsOffOurFuel', alt: 'A tradie loading a ute at a rural fuel bowser' }, image: { key: 'bg-ute', label: 'Tradie at a rural bowser', model: 'gemini-3-pro-image', size: '2K' }, at: NOW - 38 * 60e3 }, 'first production', 'render');
    const fb = mkVersion(null, { copy: { headline: 'Hands off our fuel.', support: 'The credit is used by businesses of all sizes.', cta: 'Learn more', caption: 'Fuel tax credits keep regional Australia moving. Businesses of all sizes use them, and higher costs pass on to consumers. Hands Off Our Fuel.', alt: 'Haul truck on a red dirt road' }, image: { key: 'bg-truck', label: 'Haul truck, red dirt', model: 'gemini-3-pro-image', size: '2K' }, at: NOW - 36 * 60e3 }, 'first production', 'render');
    return {
      id: 'p-demo', ns: 'mca', campaign: 'hoof', title: 'Fuel tax credit spike, 30 Sep', owner: 'Heshan', status: 'production', created: NOW - 50 * 60e3, updated: NOW - 22 * 60e3,
      brief: { objective: 'Answer the subsidy framing while the fuel tax credit is in the news, with the release as the only source of figures.', audience: 'Members, MPs and staffers on LinkedIn; the general public on Instagram and Facebook.', message: 'The credit is not a subsidy: businesses do not pay a road fuel tax on fuel used off-road, and removing it costs consumers.', deliverables: 'Organic posts for LinkedIn, Instagram and Facebook; editable compositions.', assumptions: ['Organic, not paid (inferred from the brief; edit if wrong)', 'HOOF campaign identity (inferred from the issue)'] },
      sources: [{ id: 's1', kind: 'release', name: 'MCA release 30 Sep 2026.txt', text: RELEASE, passages: PASSAGES, claims: LEDGER, added: NOW - 49 * 60e3 }],
      references: [{ id: 'r1', kind: 'logo', name: 'MCA logo (from the brand kit)', purpose: 'brand' }, { id: 'r2', kind: 'image', name: 'HOOF harvester tile, approved Aug 2026', purpose: 'composition' }, { id: 'r3', kind: 'image', name: 'Competitor: farm lobby ad', purpose: 'inspiration', note: 'Inspiration only: no logos, claims or exact layouts reused' }],
      directions: [
        { id: 'd1', title: 'The plain ask', message: 'The credit is not a subsidy; it returns a tax that never applied.', insight: 'People who hear "subsidy" assume a handout; the fix is one plain sentence.', headline: 'Not a subsidy. A tax that never applied.', opening: 'Fuel tax credits are not a subsidy. Here is why.', visual: 'Restrained documentary photography, teal fact panel, no machinery close-ups.', rationale: 'Meets the explicit client feedback for plain language and the correct actor.', claims: ['c3', 'c4'], uncertainty: 'The release does not give a figure for the credit itself.', chosen: true },
        { id: 'd2', title: 'Who it really is', message: 'The credit is used by 150,000 businesses of all sizes.', insight: 'Naming farmers, tradies and tourism operators moves the frame from miners to neighbours.', headline: 'Farmers. Tradies. Tourism operators.', opening: 'Who uses the fuel tax credit? Probably someone you know.', visual: 'Three-panel portrait carousel, one face per trade.', rationale: 'Uses the approved actual-usage wording; strong on Instagram.', claims: ['c4', 'c5'], uncertainty: 'Portrait photography needs model releases or generated faces.', chosen: false },
      ],
      assets: [
        { id: 'a1', family: 'LinkedIn set', channel: 'linkedin', format: '1:1', title: 'LinkedIn post', versions: [lk, lk2], current: lk2.id, locks: { layout: true }, approvals: {} },
        { id: 'a2', family: 'Instagram set', channel: 'instagram', format: '4:5', title: 'Instagram portrait', versions: [ig], current: ig.id, locks: {}, approvals: {} },
        { id: 'a3', family: 'Facebook set', channel: 'facebook', format: '1:1', title: 'Facebook post', versions: [fb], current: fb.id, locks: {}, approvals: {} },
      ],
      thread: [
        { id: uid('m'), role: 'studio', at: NOW - 48 * 60e3, text: 'Read the release: 6 claims, 3 figures, 1 quotation, each tied to its passage. Proposed brief is on the left; two assumptions are marked for you to confirm.' },
        { id: uid('m'), role: 'studio', at: NOW - 46 * 60e3, text: 'Two directions for an open brief on a live issue. A leads with the plain ask; B leads with who uses the credit.' },
        { id: uid('m'), role: 'you', at: NOW - 44 * 60e3, text: 'Go with A. Restrained imagery, no trucks for this campaign.' },
        { id: uid('m'), role: 'studio', at: NOW - 43 * 60e3, text: 'Direction A saved as the project decision. "No trucks" applied to this project; not saved as a rule unless you ask.', offer: { text: 'Restrained imagery, no trucks', scope: null } },
        { id: uid('m'), role: 'studio', at: NOW - 40 * 60e3, text: 'Produced three assets: LinkedIn 1:1, Instagram 4:5, Facebook 1:1. Copy adapted per channel; three background renders at 2K; compositions assembled with the supplied logo.', changed: ['a1', 'a2', 'a3'], render: true },
        { id: uid('m'), role: 'you', at: NOW - 23 * 60e3, text: 'Keep this layout but make the LinkedIn headline sharper.', target: 'LinkedIn post' },
        { id: uid('m'), role: 'studio', at: NOW - 22 * 60e3, text: 'LinkedIn post v2: headline changed, layout and image kept. Text change only, no render spent. Overflow check passed at 1:1.', changed: ['a1'], render: false },
      ],
      jobs: [{ id: 'j1', stage: 'render', asset: 'a1', state: 'done', started: NOW - 40 * 60e3, ended: NOW - 39 * 60e3, attempts: 1 }, { id: 'j2', stage: 'render', asset: 'a2', state: 'done', started: NOW - 40 * 60e3, ended: NOW - 39 * 60e3, attempts: 1 }, { id: 'j3', stage: 'render', asset: 'a3', state: 'done', started: NOW - 40 * 60e3, ended: NOW - 38 * 60e3, attempts: 2 }],
      approvals: [], events: [], preferences: [], legacy: false,
    };
  }
  const LEGACY = [
    { id: 'rp_8k2', ns: 'mca', kind: 'release', title: 'Release pack: Critical minerals reserve, 18 Sep', status: 'rendered', tiles: 6, updated: NOW - 12 * 86400e3 },
    { id: 'cs_31a', ns: 'mca', kind: 'content', title: 'Content set: HOOF myth-busting captions', status: 'approved', items: 9, updated: NOW - 20 * 86400e3 },
    { id: 'rp_2f0', ns: 'aep', kind: 'release', title: 'Release pack: East coast gas supply', status: 'rendered', tiles: 8, updated: NOW - 6 * 86400e3 },
  ];

  /* ------------------------------------------------------------ checks (deterministic) */
  const NUM_RX = /\$?\s?(\d[\d,]*(?:\.\d+)?)\s*(billion|million|bn|m\b|per cent|%|jobs|businesses|australians)?/gi;
  const UNIT = u => ({ bn: 'billion', m: 'million', '%': 'per cent', australians: 'jobs' }[String(u || '').toLowerCase()] || String(u || '').toLowerCase());
  function checkCopy(copy, ledger) {
    const out = [];
    const text = [copy.headline, copy.support, copy.cta, copy.caption].filter(Boolean).join(' \n ');
    let m; const rx = new RegExp(NUM_RX.source, 'gi');
    while ((m = rx.exec(text))) {
      const raw = m[0].trim(); const val = parseFloat(m[1].replace(/,/g, '')); const unit = UNIT(m[2]);
      if (!m[2] && (/^(19|20)\d\d(-\d\d)?$/.test(m[1]) || val < 10)) continue;   // years and small counts are not claims
      const exact = ledger.find(c => c.value === val && c.unit === unit);
      const sameNum = ledger.find(c => c.value === val && c.unit !== unit);
      const sameSubject = ledger.find(c => c.unit === unit && c.value !== val);
      if (exact) out.push({ state: 'matches', text: raw, claim: exact, note: 'matches ' + exact.passage });
      else if (sameNum) out.push({ state: 'differs', text: raw, claim: sameNum, note: 'unit differs: source says ' + sameNum.value + ' ' + sameNum.unit });
      else if (sameSubject) out.push({ state: 'differs', text: raw, claim: sameSubject, note: 'value differs: source says ' + sameSubject.value + ' ' + sameSubject.unit });
      else out.push({ state: 'unsupported', text: raw, claim: null, note: 'not supported by the supplied source' });
    }
    const quotes = text.match(/"([^"]{12,})"/g) || [];
    quotes.forEach(q => { const inner = q.slice(1, -1); const hit = ledger.find(c => c.quote && c.text.indexOf(inner) >= 0); out.push({ state: hit ? 'matches' : 'unsupported', text: q.slice(0, 60), claim: hit || null, note: hit ? 'exact quotation, ' + hit.passage : 'quotation not found verbatim in the source' }); });
    return out;
  }
  function overflow(copy, format) {
    const lim = format === '9:16' ? 44 : format === '4:5' ? 56 : 64;
    const h = (copy.headline || '').length;
    return h > lim ? { state: 'overflow', note: 'Headline is ' + h + ' characters; about ' + lim + ' fit at ' + format + ' before the type shrinks. Shorten, or accept a smaller headline.' } : null;
  }

  /* ------------------------------------------------------------ small parts */
  const Lbl = ({ children }) => html`<div class="st-lbl">${children}</div>`;
  const Chip = ({ kind, children, title }) => html`<span class=${'st-chip ' + (kind || '')} title=${title || ''}>${children}</span>`;
  function Composition({ v, format, client, size }) {
    const f = FORMATS[format] || FORMATS['1:1'];
    const bg = { 'bg-harvester': 'linear-gradient(160deg,#233d3d,#0f1f24 60%,#c98a2a)', 'bg-ute': 'linear-gradient(200deg,#2c3a4a,#7a5a2a 70%,#e0b04a)', 'bg-truck': 'linear-gradient(180deg,#5a3a1f,#a3552a 55%,#2b1d12)', 'bg-plain': 'linear-gradient(180deg,#1b2a33,#0f171d)' }[(v.image && v.image.key) || 'bg-plain'];
    const flat = v.mode === 'generated';
    return html`<div class=${'st-comp' + (size === 'thumb' ? ' thumb' : '')} style=${{ aspectRatio: f.w + ' / ' + f.h, background: bg }} role="img" aria-label=${v.copy.alt || v.copy.headline}>
      ${size !== 'thumb' ? html`<div class="st-comp-tag">${flat ? 'generated artwork, text baked in' : 'editable composition'} - ${(v.image && v.image.model) || 'no image'} ${(v.image && v.image.size) || ''}</div>` : null}
      <div class=${'st-comp-panel' + (v.layout && v.layout.headlineSize === 'small' ? ' small' : '')} style=${{ '--st-accent': client.accent }}>
        <div class="st-comp-h">${v.copy.headline}</div>
        ${v.copy.support && size !== 'thumb' ? html`<div class="st-comp-s">${v.copy.support}</div>` : null}
        ${v.copy.cta && size !== 'thumb' ? html`<div class="st-comp-cta">${v.copy.cta}</div>` : null}
      </div>
      <div class="st-comp-logo">${client.id.toUpperCase()} logo</div>
    </div>`;
  }

  /* ------------------------------------------------------------ library */
  /* Phase 1: the worker's Studio backend, when it is deployed, reports its build and what it holds.
     The workspace itself still runs on the synthetic project until Phase 2 wires it up. */
  function Backend({ client }) {
    const [st, setSt] = useState(undefined);
    useEffect(() => { let live = true; (async () => { try { const s = await call('/studio/status'); const l = await call('/studio/list?ns=' + encodeURIComponent(client.id) + '&limit=5'); if (live) setSt({ s, l }); } catch (e) { if (live) setSt({ err: e.code === 'not_found' || e.status === 404 ? 'not deployed' : e.message }); } })(); return () => { live = false; }; }, [client.id]);
    if (st === undefined) return null;
    if (st.err) return html`<div class="ov-dim st-foot">Backend: ${st.err === 'not deployed' ? 'the worker does not have the Studio routes yet (redeploy it); the workspace below runs on synthetic data' : st.err}</div>`;
    const s = st.s, l = st.l;
    return html`<div class="ov-dim st-foot">Backend build <b>${s.build}</b>: ${s.projects} project${s.projects === 1 ? '' : 's'} (${s.imported} imported), ${s.versions} versions, jobs ${s.jobs.queued} queued / ${s.jobs.running} running / ${s.jobs.failed} failed; for ${client.name}: ${l.projects.length} project${l.projects.length === 1 ? '' : 's'}, ${l.legacy.length} legacy item${l.legacy.length === 1 ? '' : 's'}. The workspace below still shows the synthetic project until Phase 2.</div>`;
  }
  function Library({ client, projects, onOpen, onNew, onImport }) {
    const mine = projects.filter(p => p.ns === client.id);
    const legacy = LEGACY.filter(l => l.ns === client.id);
    return html`<div class="st-lib">
      <div class="st-lib-head"><span class="ov-title">Projects for ${client.name}</span><span class="ov-why">${mine.length} project${mine.length === 1 ? '' : 's'}, ${legacy.length} legacy item${legacy.length === 1 ? '' : 's'}</span>${canWrite() ? html`<button class="btn sm" onClick=${onNew}>New project</button>` : null}</div>
      <${Backend} client=${client} />
      ${!mine.length && !legacy.length ? html`<div class="ov-empty">Nothing yet for this client. Start from a release, a brief or existing artwork.</div>` : null}
      <table class="ov-table"><thead><tr><th>Project</th><th>Campaign</th><th>Status</th><th>Owner</th><th>Last activity</th><th></th></tr></thead><tbody>
        ${mine.map(p => html`<tr key=${p.id}><td><b>${p.title}</b><div class="ov-dim">${p.assets.length} asset${p.assets.length === 1 ? '' : 's'}, ${p.sources.length} source${p.sources.length === 1 ? '' : 's'}</div></td><td>${(client.campaigns.find(c => c.id === p.campaign) || {}).name || '-'}</td><td><span class=${'st-status ' + p.status}>${p.status}</span></td><td>${p.owner}</td><td class="ov-dim">${ago(p.updated)} ago</td><td class="ov-go"><button class="ov-link" onClick=${() => onOpen(p.id)}>open</button></td></tr>`)}
        ${legacy.map(l => html`<tr key=${l.id} class="st-legacy"><td><b>${l.title}</b><div class="ov-dim">legacy ${l.kind === 'release' ? 'release pack' : 'content set'}, read-only; ${l.tiles ? l.tiles + ' flattened tiles' : l.items + ' pieces'}</div></td><td>-</td><td><span class="st-status legacy">${l.status}</span></td><td>-</td><td class="ov-dim">${ago(l.updated)} ago</td><td class="ov-go"><button class="ov-link" onClick=${() => onImport(l)}>${canWrite() ? 'import to Studio' : 'view'}</button></td></tr>`)}
      </tbody></table>
      <div class="ov-dim st-foot">Legacy items open read-only. Importing copies one into a Studio project under this client, keeps the original untouched, and is idempotent. Prototype: nothing here is saved.</div>
    </div>`;
  }

  /* ------------------------------------------------------------ intake */
  function Intake({ client, onCreate, onCancel }) {
    const [start, setStart] = useState('release');
    const [deliverable, setDeliverable] = useState('set');
    const [campaign, setCampaign] = useState(client.campaigns[0] ? client.campaigns[0].id : '');
    const [text, setText] = useState('');
    const [chs, setChs] = useState({ linkedin: true, instagram: true, facebook: true, x: false });
    const clear = /^(adapt|write|three|make|resize|shorten)\b/i.test(text.trim());
    return html`<div class="st-intake">
      <div class="ov-title">New project for ${client.name}</div>
      <div class="st-intake-row">
        <div><${Lbl}>Start from</${Lbl}><div class="st-seg">${[['release', 'A release or source document'], ['brief', 'A brief or one line'], ['reference', 'Existing creative or references']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (start === k ? ' on' : '')} onClick=${() => setStart(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Deliverable</${Lbl}><div class="st-seg">${[['copy', 'Copy only'], ['visual', 'Visual creative'], ['set', 'Coordinated campaign set']].map(([k, l]) => html`<button key=${k} class=${'st-segbtn' + (deliverable === k ? ' on' : '')} onClick=${() => setDeliverable(k)}>${l}</button>`)}</div></div>
        <div><${Lbl}>Campaign</${Lbl}><select class="st-sel" value=${campaign} onChange=${e => setCampaign(e.target.value)} aria-label="Campaign"><option value="">No campaign</option>${client.campaigns.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select><div class="ov-dim">Choosing a campaign never changes the client or its approved facts.</div></div>
      </div>
      <${Lbl}>${start === 'release' ? 'Paste the release or drop the document' : start === 'brief' ? 'The brief, or one line' : 'What to do with the reference'}</${Lbl}>
      <textarea class="st-ta" rows="7" value=${text} onInput=${e => setText(e.target.value)} placeholder=${start === 'release' ? 'Paste the release text. Claims, figures and quotations will be extracted with their passages.' : start === 'brief' ? 'e.g. "Three LinkedIn posts on the $74 billion figure in the HOOF voice" (a clear instruction goes straight to production) or "Something for Victoria about regional jobs" (an open brief gets two or three directions)' : 'e.g. "Adapt the approved harvester tile for Instagram 4:5 and a 9:16 story; keep the headline"'}></textarea>
      ${start === 'reference' ? html`<div class="st-drop">Drop artwork, a logo or reference images here. Each reference carries a purpose: composition, mood, imagery, typography or brand. Competitor work is inspiration only. (Prototype: the drop is not wired.)</div>` : null}
      ${deliverable !== 'visual' ? html`<div><${Lbl}>Channels (suggested from the brief; edit freely)</${Lbl}><div class="st-seg">${Object.keys(CHANNELS).map(k => html`<button key=${k} class=${'st-segbtn' + (chs[k] ? ' on' : '')} onClick=${() => setChs(Object.assign({}, chs, { [k]: !chs[k] }))}>${CHANNELS[k].label}</button>`)}</div></div>` : null}
      <div class="st-intake-foot">
        <span class="ov-dim">${start === 'brief' ? (clear && text ? 'Reads as a clear instruction: production starts without a direction step.' : 'Reads as an open brief: two or three directions first.') : start === 'release' ? 'Extraction first, then a proposed brief and the claim ledger.' : 'An adaptation brief first: what to preserve, what may change.'}</span>
        <button class="btn sm ghost" onClick=${onCancel}>Cancel</button>
        <button class="btn sm" disabled=${!text.trim() && start !== 'reference'} onClick=${() => onCreate({ start, deliverable, campaign, text, channels: Object.keys(chs).filter(k => chs[k]), clear })}>Create project</button>
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ left rail */
  function Rail({ p, client, view, setView, sel, setSel }) {
    const fams = useMemo(() => { const m = {}; p.assets.forEach(a => { (m[a.family] = m[a.family] || []).push(a); }); return m; }, [p.assets]);
    const stat = a => { const c = standing(a, 'copy'), d = standing(a, 'design'); return c && d ? 'approved' : c || d ? 'partly' : a.versions.length > 1 ? 'revised' : 'draft'; };
    return html`<nav class="st-rail" aria-label="Project">
      <${Lbl}>Project</${Lbl}>
      ${[['brief', 'Brief'], ['sources', 'Sources', p.sources.length], ['references', 'References', p.references.length], ['directions', 'Directions', p.directions.length], ['context', 'Client context'], ['jobs', 'Jobs', p.jobs.filter(j => j.state !== 'done').length || null]].map(([k, l, n]) => html`<button key=${k} class=${'st-railbtn' + (view === k ? ' on' : '')} onClick=${() => setView(k)}>${l}${n != null ? html`<span class="st-n">${n}</span>` : null}</button>`)}
      <${Lbl}>Assets</${Lbl}>
      ${Object.keys(fams).map(f => html`<div key=${f} class="st-fam"><div class="st-famname">${f}</div>${fams[f].map(a => html`<button key=${a.id} class=${'st-railbtn asset' + (view === 'asset' && sel === a.id ? ' on' : '')} onClick=${() => { setSel(a.id); setView('asset'); }}>
        <span>${a.title}<span class="ov-dim"> ${a.format}</span></span><span class=${'st-dot ' + stat(a)} title=${stat(a)}></span><span class="ov-dim">v${a.versions.length}</span></button>`)}</div>`)}
      ${!p.assets.length ? html`<div class="ov-dim st-pad">No assets yet. ${p.directions.length ? 'Choose a direction to start production.' : 'Production starts once the brief is confirmed.'}</div>` : null}
    </nav>`;
  }

  /* ------------------------------------------------------------ centre views */
  function BriefView({ p, onChange }) {
    const b = p.brief; const set = (k, v) => onChange(Object.assign({}, b, { [k]: v }));
    return html`<div class="st-centre-pad">
      <div class="ov-title">Brief</div>
      ${['objective', 'audience', 'message', 'deliverables'].map(k => html`<div key=${k} class="st-field"><${Lbl}>${k}</${Lbl}><textarea class="st-ta" rows="2" value=${b[k] || ''} disabled=${!canWrite()} onInput=${e => set(k, e.target.value)}></textarea></div>`)}
      ${b.assumptions && b.assumptions.length ? html`<div class="st-field"><${Lbl}>Assumptions the Studio made (edit or remove)</${Lbl}><ul class="st-ul">${b.assumptions.map((a, i) => html`<li key=${i}>${a} ${canWrite() ? html`<button class="ov-link" onClick=${() => set('assumptions', b.assumptions.filter((_, j) => j !== i))}>remove</button>` : null}</li>`)}</ul></div>` : null}
    </div>`;
  }
  function SourcesView({ p, focus }) {
    return html`<div class="st-centre-pad">
      <div class="ov-title">Sources and the claim ledger</div>
      ${!p.sources.length ? html`<div class="ov-empty">No source yet. Figures and quotations in copy will be marked as not supported until one is added.</div>` : null}
      ${p.sources.map(s => html`<div key=${s.id} class="st-source">
        <div class="st-source-head"><b>${s.name}</b><span class="ov-dim"> ${s.kind}, added ${ago(s.added)} ago, ${s.claims.length} claims extracted</span></div>
        <table class="ov-table st-ledger"><thead><tr><th>Claim</th><th>Value</th><th>Period</th><th>Passage</th></tr></thead><tbody>
          ${s.claims.map(c => html`<tr key=${c.id} class=${focus === c.id ? 'hot' : ''}><td>${c.quote ? html`<em>${c.text}</em>` : c.text}</td><td class="num">${c.value != null ? c.value.toLocaleString() + ' ' + c.unit : html`<span class="ov-dim">-</span>`}</td><td class="ov-dim">${c.period || '-'}</td><td><details><summary class="ov-link">${c.passage}</summary><div class="st-passage">${s.passages[c.passage]}</div></details></td></tr>`)}
        </tbody></table>
        <div class="ov-dim">Extraction can be wrong: a claim is reviewable, and "matches source" never means independently verified or legally cleared.</div>
      </div>`)}
    </div>`;
  }
  function ReferencesView({ p }) {
    return html`<div class="st-centre-pad"><div class="ov-title">References</div>
      <div class="st-refs">${p.references.map(r => html`<div key=${r.id} class="st-ref"><div class=${'st-ref-thumb ' + r.kind}>${r.kind}</div><div><b>${r.name}</b><div class="ov-dim">purpose: ${r.purpose}${r.note ? ' - ' + r.note : ''}</div></div></div>`)}</div>
      <div class="ov-dim st-pad">Logos come from the brand kit and are placed exactly, never redrawn. Competitor work is inspiration only and never a source of claims, logos or exact layouts.</div>
    </div>`;
  }
  function DirectionsView({ p, onChoose, onMore }) {
    return html`<div class="st-centre-pad"><div class="ov-title">Directions</div>
      <div class="ov-why">Two or three genuinely different directions for an open brief. Choose one, combine, or ask for another. A clear production instruction skips this step.</div>
      <div class="st-dirs">${p.directions.map(d => html`<div key=${d.id} class=${'st-dir' + (d.chosen ? ' chosen' : '')}>
        <div class="st-dir-title">${d.title}${d.chosen ? html`<${Chip} kind="ok">chosen</${Chip}>` : null}</div>
        <div class="st-dir-h">${d.headline}</div>
        <div class="st-dir-line"><b>Message</b> ${d.message}</div>
        <div class="st-dir-line"><b>Insight</b> ${d.insight}</div>
        <div class="st-dir-line"><b>Opening</b> ${d.opening}</div>
        <div class="st-dir-line"><b>Visual</b> ${d.visual}</div>
        <div class="st-dir-line"><b>Why</b> ${d.rationale}</div>
        <div class="st-dir-line"><b>Claims</b> ${d.claims.join(', ')} <span class="ov-dim">${d.uncertainty}</span></div>
        ${canWrite() && !d.chosen ? html`<button class="btn sm" onClick=${() => onChoose(d.id)}>Choose this direction</button>` : null}
      </div>`)}</div>
      ${canWrite() ? html`<div class="st-pad"><button class="btn sm ghost" onClick=${onMore}>Another direction</button> <span class="ov-dim">Low-cost preview before any high-resolution production.</span></div>` : null}
    </div>`;
  }
  function ContextView({ client }) {
    const c = CONTEXT;
    return html`<div class="st-centre-pad"><div class="ov-title">What the Studio knows about ${client.name}</div>
      <div class="ov-why">Recorded with every generation as a context snapshot: kit revision, rule ids, retrieved examples, source revisions, model configuration. Source accuracy and mandatory requirements outrank preferences; conflicts are surfaced, not resolved silently.</div>
      <div class="st-ctx"><${Lbl}>Mandatory brand and wording requirements</${Lbl}><ul class="st-ul">${c.mandatory.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>
        <${Lbl}>Approved claims (source, period, status)</${Lbl}><ul class="st-ul">${c.claims.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>
        <${Lbl}>Client preferences</${Lbl}><ul class="st-ul">${c.preferences.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>
        <${Lbl}>Campaign direction</${Lbl}><ul class="st-ul">${c.campaign.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul>
        <${Lbl}>Examples</${Lbl}><div>${c.examples} approved examples, ${c.rejected} rejected with reason, ${c.inspiration} inspiration references, from the ${client.id}_creative shelf. Nothing from any other client.</div></div>
    </div>`;
  }
  function JobsView({ p, onRetry, onCancel }) {
    return html`<div class="st-centre-pad"><div class="ov-title">Jobs</div>
      <div class="ov-why">Every generation is a persistent job with stages and attempts. Elapsed time is shown; no invented percentages. (Prototype: jobs are simulated in the browser.)</div>
      <table class="ov-table"><thead><tr><th>Job</th><th>Stage</th><th>Asset</th><th>State</th><th class="num">Attempts</th><th>Elapsed</th><th></th></tr></thead><tbody>
        ${p.jobs.slice().reverse().map(j => { const a = p.assets.find(x => x.id === j.asset); return html`<tr key=${j.id}><td class="ov-dim">${j.id}</td><td>${j.stage}</td><td>${a ? a.title : '-'}</td><td><span class=${'st-status ' + j.state}>${j.state}</span>${j.error ? html`<div class="ov-dim">${j.error}</div>` : null}</td><td class="num">${j.attempts}</td><td class="ov-dim">${Math.max(1, Math.round(((j.ended || Date.now()) - j.started) / 1000))}s</td><td class="ov-go">${j.state === 'failed' && canWrite() ? html`<button class="ov-link" onClick=${() => onRetry(j.id)}>retry</button>` : j.state === 'running' && canWrite() ? html`<button class="ov-link" onClick=${() => onCancel(j.id)}>cancel</button>` : null}</td></tr>`; })}
      </tbody></table>
    </div>`;
  }
  function CompareView({ a, client, vA, vB, onClose, onRestore }) {
    const rows = ['headline', 'support', 'cta', 'caption'];
    return html`<div class="st-centre-pad"><div class="ov-sechead"><span class="ov-title">Compare</span><span class="ov-why">${a.title}: v${a.versions.indexOf(vA) + 1} against v${a.versions.indexOf(vB) + 1}</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onClose}>Back</button></div>
      <div class="st-cmp">${[vA, vB].map((v, i) => html`<div key=${v.id}><div class="ov-dim">v${a.versions.indexOf(v) + 1}, ${v.note}, ${aest(v.at)}</div><${Composition} v=${v} format=${a.format} client=${client} />${canWrite() && v.id !== a.current ? html`<button class="btn sm ghost" onClick=${() => onRestore(v.id)}>Restore this as a new version</button>` : html`<${Chip} kind="ok">current</${Chip}>`}</div>`)}</div>
      <table class="ov-table"><thead><tr><th>Field</th><th>Left</th><th>Right</th></tr></thead><tbody>${rows.map(k => html`<tr key=${k} class=${vA.copy[k] !== vB.copy[k] ? 'hot' : ''}><td class="ov-dim">${k}</td><td>${vA.copy[k]}</td><td>${vB.copy[k]}</td></tr>`)}<tr class=${(vA.image && vA.image.key) !== (vB.image && vB.image.key) ? 'hot' : ''}><td class="ov-dim">image</td><td>${vA.image ? vA.image.label : '-'}</td><td>${vB.image ? vB.image.label : '-'}</td></tr></tbody></table>
    </div>`;
  }
  function AssetView({ p, a, client, sel, setSel, onEdit, onLock, onApprove, onCompare, onRestore, onRebuild }) {
    const v = a.versions.find(x => x.id === a.current) || a.versions[a.versions.length - 1];
    const ledger = p.sources.flatMap(s => s.claims);
    const checks = useMemo(() => checkCopy(v.copy, ledger), [v, ledger]);
    const ov = overflow(v.copy, a.format);
    const [hist, setHist] = useState(false);
    const [zoom, setZoom] = useState('fit');
    const ap = { copy: standing(a, 'copy'), design: standing(a, 'design') };
    const fields = [['headline', 'Headline'], ['support', 'Support line'], ['cta', 'Call to action'], ['caption', 'Caption (' + (CHANNELS[a.channel] || {}).label + ', ' + (v.copy.caption || '').length + ' of ' + ((CHANNELS[a.channel] || {}).max || 900) + ')'], ['alt', 'Alt text']];
    const flat = v.mode === 'generated';
    return html`<div class="st-asset">
      <div class="st-asset-head">
        <div><b>${a.title}</b> <span class="ov-dim">${(CHANNELS[a.channel] || {}).label} ${FORMATS[a.format].label}, ${a.family}; v${a.versions.indexOf(v) + 1} of ${a.versions.length}, ${v.note}</span></div>
        <div class="st-asset-acts">
          <button class=${'btn sm ghost' + (zoom === 'fit' ? ' on' : '')} onClick=${() => setZoom(zoom === 'fit' ? 'actual' : 'fit')} title="Fit to screen or actual size">${zoom === 'fit' ? 'Actual size' : 'Fit'}</button>
          <button class="btn sm ghost" onClick=${() => setHist(!hist)}>Versions (${a.versions.length})</button>
          ${a.versions.length > 1 ? html`<button class="btn sm ghost" onClick=${() => onCompare(a.versions[a.versions.length - 2].id, v.id)}>Compare</button>` : null}
        </div>
      </div>
      <div class=${'st-stage ' + zoom}>
        <div class="st-stage-inner"><${Composition} v=${v} format=${a.format} client=${client} /></div>
        ${flat ? html`<div class="st-flatnote">This is a flattened legacy tile: the text on the image is not editable. Editing the caption below will not change the image. ${canWrite() ? html`<button class="ov-link" onClick=${onRebuild}>Rebuild as an editable composition</button>` : null} (the original is kept and the result needs review).</div>` : null}
      </div>
      <div class="st-copy">
        ${fields.map(([k, label]) => html`<div key=${k} class=${'st-field' + (sel === k ? ' on' : '') + (a.locks[k] ? ' locked' : '')} onClick=${() => setSel(k)}>
          <div class="st-field-head"><${Lbl}>${label}</${Lbl}>${canWrite() ? html`<button class=${'st-lock' + (a.locks[k] ? ' on' : '')} onClick=${e => { e.stopPropagation(); onLock(k); }} title=${a.locks[k] ? 'Locked: survives revisions until unlocked' : 'Lock this element'} aria-pressed=${!!a.locks[k]}>${a.locks[k] ? 'locked' : 'lock'}</button>` : null}</div>
          ${k === 'caption' || k === 'support' ? html`<textarea class="st-ta" rows=${k === 'caption' ? 4 : 2} value=${v.copy[k] || ''} disabled=${!canWrite() || a.locks[k] || (flat && k !== 'caption' && k !== 'alt')} onInput=${e => onEdit(k, e.target.value)}></textarea>` : html`<input class="st-in" value=${v.copy[k] || ''} disabled=${!canWrite() || a.locks[k] || (flat && k !== 'alt')} onInput=${e => onEdit(k, e.target.value)} />`}
        </div>`)}
        <div class="st-field"><div class="st-field-head"><${Lbl}>Layout</${Lbl}>${canWrite() ? html`<button class=${'st-lock' + (a.locks.layout ? ' on' : '')} onClick=${() => onLock('layout')} aria-pressed=${!!a.locks.layout}>${a.locks.layout ? 'locked' : 'lock'}</button>` : null}</div><div class="ov-dim">${flat ? 'not editable (flattened)' : 'editable composition: background image, teal panel, headline ' + (v.layout.headlineSize || 'large') + ', logo bottom right. Edit layout opens the layer editor (Phase 2).'}</div></div>
        <div class="st-field"><${Lbl}>Checks on this version</${Lbl}>
          <ul class="st-checks">
            ${ov ? html`<li class="warn"><${Chip} kind="warn">layout</${Chip}> ${ov.note}</li>` : html`<li><${Chip} kind="ok">layout</${Chip}> headline fits at ${a.format}</li>`}
            ${checks.map((c, i) => html`<li key=${i} class=${c.state}><${Chip} kind=${c.state === 'matches' ? 'ok' : c.state === 'differs' ? 'bad' : 'warn'}>${c.state === 'matches' ? 'matches source' : c.state === 'differs' ? 'differs from source' : 'not supported'}</${Chip}> <b>${c.text}</b> <span class="ov-dim">${c.note}</span></li>`)}
            ${!checks.length ? html`<li><span class="ov-dim">No figures or quotations in this copy.</span></li>` : null}
            <li class="ov-dim">Deterministic checks on figures, units and quotations. Advisory critique of meaning is separate and labelled. Matching a source is not independent verification.</li>
          </ul>
        </div>
        <div class="st-approve">
          ${['copy', 'design'].map(part => html`<div key=${part} class="st-appr"><span><b>${part}</b> ${ap[part] ? html`<${Chip} kind="ok">approved</${Chip}> <span class="ov-dim">on v${a.versions.findIndex(x => x.id === ap[part].version) + 1} by ${ap[part].by}, ${ap[part].reason}${ap[part].version !== v.id ? ' (unchanged since, so it stands)' : ''}</span>` : html`<span class="ov-dim">draft</span>`}</span>
            ${canWrite() ? html`<span>${ap[part] ? html`<button class="btn sm ghost" onClick=${() => onApprove(part, null)}>Withdraw</button>` : html`<button class="btn sm ghost" onClick=${() => onApprove(part, 'approve')}>Approve ${part}</button>`}<button class="btn sm ghost" onClick=${() => onApprove(part, 'reject')}>Reject</button></span>` : null}
          </div>`)}
        </div>
      </div>
      ${hist ? html`<div class="st-hist"><div class="ov-sechead"><span class="ov-title">Versions</span><span class="ov-why">immutable; restore creates a new current version that references the earlier content</span></div>
        ${a.versions.slice().reverse().map(x => html`<div key=${x.id} class=${'st-hist-row' + (x.id === a.current ? ' cur' : '')}><${Composition} v=${x} format=${a.format} client=${client} size="thumb" /><div><b>v${a.versions.indexOf(x) + 1}</b> <${Chip} kind=${x.kind === 'render' ? 'warn' : ''}>${x.kind === 'render' ? 'render' : x.kind === 'layout' ? 'layout edit' : x.kind === 'restore' ? 'restore' : 'text change'}</${Chip}><div class="ov-dim">${x.note}, ${aest(x.at)}, ${x.by}</div></div><div>${x.id === a.current ? html`<${Chip} kind="ok">current</${Chip}>` : canWrite() ? html`<button class="ov-link" onClick=${() => onRestore(x.id)}>restore</button>` : null} <button class="ov-link" onClick=${() => onCompare(x.id, a.current)}>compare</button></div></div>`)}
      </div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ right panel */
  function Partner({ p, a, sel, target, setTarget, onSend, busy, onOffer, offerOpen, setOfferOpen }) {
    const [text, setText] = useState('');
    const box = useRef(null);
    useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; }, [p.thread.length, busy]);
    const targets = [['element', 'Selected element' + (sel ? ': ' + sel : '')], ['asset', 'This asset' + (a ? ': ' + a.title : '')], ['family', a ? 'The ' + a.family : 'Asset family'], ['set', 'The whole set']];
    return html`<aside class="st-partner" aria-label="Creative partner">
      <div class="st-partner-head"><span class="ov-title">Creative partner</span><span class="ov-why">creative director, copywriter, designer; knows ${p.ns.toUpperCase()}</span></div>
      <div class="st-thread" ref=${box}>
        ${p.thread.map(m => html`<div key=${m.id} class=${'st-msg ' + m.role}>
          <div class="st-msg-meta">${m.role === 'you' ? WHO() : 'Studio'}${m.target ? html` <span class="ov-dim">to ${m.target}</span>` : null} <span class="ov-dim">${aest(m.at)}</span></div>
          <div class="st-msg-text">${m.text}</div>
          ${m.changed ? html`<div class="st-msg-foot">${m.changed.length} asset${m.changed.length === 1 ? '' : 's'} changed ${m.render ? html`<${Chip} kind="warn">render spent</${Chip}>` : html`<${Chip} kind="ok">no render</${Chip}>`}${m.locked ? html` <span class="ov-dim">kept locked: ${m.locked.join(', ')}</span>` : null}</div>` : null}
          ${m.alternatives ? html`<div class="st-alts">${m.alternatives.map((alt, i) => html`<button key=${i} class="st-alt" onClick=${() => onSend({ pick: alt, field: m.field, asset: m.asset })}>${alt}</button>`)}<div class="ov-dim">Choose one to make it the ${m.field}, as a text change.</div></div>` : null}
          ${m.proposal ? html`<div class="st-proposal"><div class="ov-dim">Proposed interpretation before a costly change:</div><ul class="st-ul">${m.proposal.steps.map((s, i) => html`<li key=${i}>${s}</li>`)}</ul>${!m.proposal.decided && canWrite() ? html`<div><button class="btn sm" onClick=${() => onSend({ confirm: m.id })}>Do this${m.proposal.render ? ' (one render)' : ''}</button> <button class="btn sm ghost" onClick=${() => onSend({ decline: m.id })}>Not that</button></div>` : html`<${Chip}>${m.proposal.decided === 'yes' ? 'done' : 'declined'}</${Chip}>`}</div>` : null}
          ${m.offer && canWrite() ? html`<div class="st-offer">${m.offer.scope ? html`<${Chip} kind="ok">saved as ${m.offer.scope === 'campaign' ? 'a campaign preference' : 'a client rule'}</${Chip}>` : m.offer.declined ? html`<${Chip}>not saved</${Chip}>` : html`<span class="ov-dim">Save as a preference?</span> <button class="ov-link" onClick=${() => setOfferOpen(m.id)}>show wording</button>`}
            ${offerOpen === m.id && !m.offer.scope ? html`<div class="st-offer-box"><div class="ov-dim">Proposed wording (edit before saving):</div><textarea class="st-ta" rows="2" id=${'offer-' + m.id} defaultValue=${'For ' + (p.campaign || 'this client') + ': ' + m.offer.text + '.'}></textarea><div><button class="btn sm ghost" onClick=${() => onOffer(m.id, 'campaign')}>Campaign preference</button> <button class="btn sm ghost" onClick=${() => onOffer(m.id, 'client')}>Lasting client rule</button> <button class="btn sm ghost" onClick=${() => onOffer(m.id, null)}>Don't save</button></div></div>` : null}</div>` : null}
        </div>`)}
        ${busy ? html`<div class="st-msg studio"><div class="st-msg-text ov-dim">${busy}</div></div>` : null}
      </div>
      ${canWrite() ? html`<div class="st-composer">
        <select class="st-sel" value=${target} onChange=${e => setTarget(e.target.value)} aria-label="Target of the direction">${targets.map(([k, l]) => html`<option key=${k} value=${k} disabled=${(k === 'element' && !sel) || (k !== 'set' && !a)}>${l}</option>`)}</select>
        <textarea class="st-ta" rows="2" value=${text} placeholder=${'Direct the team. e.g. "Keep the layout, sharpen the headline", "three alternative opening lines", "adapt this for Instagram", "more restrained visual"'} onInput=${e => setText(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (text.trim()) { onSend({ text: text.trim() }); setText(''); } } }} aria-label="Direction"></textarea>
        <button class="btn sm" disabled=${!text.trim() || !!busy} onClick=${() => { onSend({ text: text.trim() }); setText(''); }}>Send</button>
      </div>` : html`<div class="ov-dim st-pad">A read-only key can review and export; directing the team needs a full key.</div>`}
    </aside>`;
  }

  /* ------------------------------------------------------------ dialogs */
  function ExportDialog({ p, client, onClose, onClickup }) {
    const approved = p.assets.map(a => { const c = standing(a, 'copy'), d = standing(a, 'design'); const v = a.versions.find(x => x.id === a.current); return { a, v, c, d, ok: !!(c && d), partly: !!(c || d) }; });
    const ready = approved.filter(x => x.ok);
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="Export"><div class="st-dialog-box">
      <div class="ov-sechead"><span class="ov-title">Export</span><span class="ov-why">approved versions only; the export records the exact version it took</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${onClose}>Close</button></div>
      <table class="ov-table"><thead><tr><th>Asset</th><th>Version</th><th>Copy</th><th>Design</th><th>Export</th></tr></thead><tbody>${approved.map(x => html`<tr key=${x.a.id}><td>${x.a.title}</td><td class="ov-dim">v${x.a.versions.indexOf(x.v) + 1}</td><td>${x.c ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.d ? html`<${Chip} kind="ok">approved</${Chip}>` : html`<${Chip}>draft</${Chip}>`}</td><td>${x.ok ? html`<${Chip} kind="ok">included</${Chip}>` : html`<span class="ov-dim">not included${x.partly ? ' (partly approved)' : ''}</span>`}</td></tr>`)}</tbody></table>
      <div class="st-pad"><b>${ready.length}</b> asset${ready.length === 1 ? '' : 's'} ready: images at their format and 2K, one copy sheet (headline, support, CTA, caption, alt text, source passages), the context snapshot. <span class="ov-dim">Prototype: downloads are simulated.</span></div>
      <div class="st-dialog-acts"><button class="btn sm" disabled=${!ready.length} onClick=${() => { toastMsg('Export bundle prepared for ' + ready.length + ' asset' + (ready.length === 1 ? '' : 's') + ' (prototype)'); }}>Download bundle</button><button class="btn sm ghost" disabled=${!ready.length} onClick=${() => onClickup(ready)}>Send to ClickUp...</button><span class="ov-dim">Export never creates a task or sends anything by itself; the hand-off is its own step.</span></div>
    </div></div>`;
  }
  function ClickupDialog({ ready, client, onClose }) {
    return html`<div class="st-dialog" role="dialog" aria-modal="true" aria-label="Send to ClickUp"><div class="st-dialog-box narrow">
      <div class="ov-title">Send to ClickUp</div>
      <div class="st-pad">Destination: <b>${client.name} - Creative</b> list (the worker's configured list). One task per asset, with the approved image and the copy sheet attached:</div>
      <ul class="st-ul">${ready.map(x => html`<li key=${x.a.id}>${x.a.title}, v${x.a.versions.indexOf(x.v) + 1}</li>`)}</ul>
      <div class="st-dialog-acts"><button class="btn sm" onClick=${() => { toastMsg(ready.length + ' ClickUp task' + (ready.length === 1 ? '' : 's') + ' would be created (prototype: nothing sent)'); onClose(); }}>Create ${ready.length} task${ready.length === 1 ? '' : 's'}</button><button class="btn sm ghost" onClick=${onClose}>Cancel</button></div>
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
    const [clientId, setClientId] = useState('mca');
    const [projects, setProjects] = useState(() => [demoProject()]);
    const [pid, setPid] = useState(null);
    const [intake, setIntake] = useState(false);
    const [view, setView] = useState('asset');
    const [selAsset, setSelAsset] = useState('a1');
    const [selField, setSelField] = useState(null);
    const [target, setTarget] = useState('asset');
    const [busy, setBusy] = useState('');
    const [cmp, setCmp] = useState(null);
    const [dialog, setDialog] = useState(null);
    const [offerOpen, setOfferOpen] = useState(null);
    const client = CLIENTS.find(c => c.id === clientId) || CLIENTS[0];
    const p = projects.find(x => x.id === pid) || null;
    const a = p ? p.assets.find(x => x.id === selAsset) || null : null;
    const update = useCallback((fn) => setProjects(ps => ps.map(x => (x.id === pid ? fn(Object.assign({}, x, { updated: Date.now() })) : x))), [pid]);
    const say = (fields) => update(x => Object.assign({}, x, { thread: x.thread.concat([Object.assign({ id: uid('m'), role: 'studio', at: Date.now() }, fields)]) }));
    const stage = !p ? '' : !p.assets.length && p.directions.length && !p.directions.some(d => d.chosen) ? 'directions' : !p.assets.length ? 'brief' : p.assets.every(x => standing(x, 'copy') && standing(x, 'design')) ? 'export' : p.assets.some(x => standing(x, 'copy') || standing(x, 'design')) ? 'review' : 'production';

    const switchClient = id => { setClientId(id); setPid(null); setIntake(false); setView('asset'); setSelAsset(null); setSelField(null); setCmp(null); };
    const openProject = id => { setPid(id); const pr = projects.find(x => x.id === id); setSelAsset(pr && pr.assets[0] ? pr.assets[0].id : null); setView(pr && pr.assets.length ? 'asset' : pr && pr.directions.length ? 'directions' : 'brief'); setCmp(null); };

    const createProject = (o) => {
      const id = uid('p'); const chans = o.deliverable === 'visual' ? ['instagram'] : o.channels.length ? o.channels : ['linkedin'];
      const fromRelease = o.start === 'release';
      const ledger = fromRelease ? LEDGER : [];
      const np = { id, ns: client.id, campaign: o.campaign, title: (o.text || 'Adaptation').split('\n')[0].slice(0, 60) || 'New project', owner: 'Heshan', status: 'brief', created: Date.now(), updated: Date.now(),
        brief: { objective: fromRelease ? 'Proposed from the release; edit before production.' : o.text.slice(0, 200), audience: chans.map(c => CHANNELS[c].label).join(', ') + ' audiences (inferred; edit if wrong)', message: fromRelease ? 'Proposed: the strongest claim in the release, in the client voice.' : '', deliverables: (o.deliverable === 'copy' ? 'Copy only for ' : o.deliverable === 'visual' ? 'Visual creative for ' : 'Coordinated set for ') + chans.map(c => CHANNELS[c].label).join(', '), assumptions: ['Organic, not paid (inferred)'].concat(o.campaign ? [] : ['No campaign chosen: campaign-specific rules will not apply']) },
        sources: fromRelease ? [{ id: uid('s'), kind: 'release', name: 'Pasted release.txt', text: o.text, passages: PASSAGES, claims: ledger, added: Date.now() }] : [],
        references: o.start === 'reference' ? [{ id: uid('r'), kind: 'image', name: 'Dropped reference', purpose: 'composition' }] : [], directions: [], assets: [], thread: [], jobs: [], approvals: [], events: [], preferences: [], legacy: false };
      const openBrief = !o.clear && o.start !== 'reference';
      if (openBrief) np.directions = demoProject().directions.map(d => Object.assign({}, d, { chosen: false }));
      np.thread.push({ id: uid('m'), role: 'studio', at: Date.now(), text: fromRelease ? 'Read the source: ' + ledger.length + ' claims extracted with their passages (prototype: the demo ledger). The proposed brief is on the left with its assumptions marked. ' + (openBrief ? 'Two directions follow.' : 'Production can start.') : o.start === 'reference' ? 'Adaptation brief: preserve the headline and logo placement, allow the image and format to change. Confirm and production starts.' : o.clear ? 'Clear instruction: no direction step. Confirm the channels and production starts.' : 'Open brief: two directions to choose from before production.' });
      setProjects(ps => ps.concat([np])); setPid(id); setIntake(false); setSelAsset(null); setView(openBrief ? 'directions' : 'brief');
      if (!openBrief) setTimeout(() => produce(id, chans, o.deliverable), 50);
    };
    const produce = (id, chans, deliverable) => {
      setBusy('Writing copy for ' + chans.length + ' channel' + (chans.length === 1 ? '' : 's') + ' from the chosen direction, then ' + (deliverable === 'copy' ? 'no renders (copy only)' : chans.length + ' background render' + (chans.length === 1 ? '' : 's') + ' at 2K') + '. (prototype: simulated)');
      setTimeout(() => {
        setProjects(ps => ps.map(x => {
          if (x.id !== id) return x;
          const demo = demoProject();
          const assets = chans.map((c, i) => { const src = demo.assets[i % demo.assets.length]; const v0 = src.versions[0]; const v = mkVersion(null, { copy: Object.assign({}, v0.copy), image: deliverable === 'copy' ? null : v0.image, mode: deliverable === 'copy' ? 'copy' : 'composition' }, 'first production', deliverable === 'copy' ? 'text' : 'render'); return { id: uid('a'), family: CHANNELS[c].label + ' set', channel: c, format: CHANNELS[c].format, title: CHANNELS[c].label + ' ' + (deliverable === 'copy' ? 'copy' : 'post'), versions: [v], current: v.id, locks: {}, approvals: {} }; });
          const jobs = deliverable === 'copy' ? [] : assets.map(as => ({ id: uid('j'), stage: 'render', asset: as.id, state: 'done', started: Date.now() - 4000, ended: Date.now(), attempts: 1 }));
          return Object.assign({}, x, { status: 'production', assets, jobs: x.jobs.concat(jobs), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Produced ' + assets.length + ' asset' + (assets.length === 1 ? '' : 's') + ': ' + assets.map(as => as.title + ' ' + as.format).join(', ') + '. Copy adapted per channel' + (deliverable === 'copy' ? '; copy only, no renders.' : '; backgrounds rendered at 2K and compositions assembled with the supplied logo.'), changed: assets.map(as => as.id), render: deliverable !== 'copy' }]) });
        }));
        setBusy(''); setView('asset');
        setProjects(ps => { const pr = ps.find(x => x.id === id); if (pr && pr.assets[0]) setSelAsset(pr.assets[0].id); return ps; });
      }, 900);
    };
    const chooseDirection = (did) => { update(x => Object.assign({}, x, { directions: x.directions.map(d => Object.assign({}, d, { chosen: d.id === did })), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Direction "' + (x.directions.find(d => d.id === did) || {}).title + '" saved as the project decision. Producing the set.' }]) })); produce(pid, ['linkedin', 'instagram', 'facebook'], 'set'); };
    const moreDirection = () => say({ text: 'A third direction would be written here by the creative-director model, grounded in the same ledger and client context. (prototype)' });

    const editField = (k, val) => update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (as.id !== selAsset) return as; const cur = as.versions.find(v => v.id === as.current); if (cur.by === WHO() && cur.kind === 'text' && Date.now() - cur.at < 60000) { const nv = Object.assign({}, cur, { copy: Object.assign({}, cur.copy, { [k]: val }) }); return Object.assign({}, as, { versions: as.versions.map(v => (v.id === cur.id ? nv : v)), }); } const nv = mkVersion(cur, { copy: Object.assign({}, cur.copy, { [k]: val }) }, 'hand edit: ' + k, 'text', WHO()); return reconcile(Object.assign({}, as, { versions: as.versions.concat([nv]), current: nv.id })); }) }));
    const toggleLock = (k) => update(x => Object.assign({}, x, { assets: x.assets.map(as => (as.id === selAsset ? Object.assign({}, as, { locks: Object.assign({}, as.locks, { [k]: !as.locks[k] }) }) : as)) }));
    const approve = (part, what) => {
      if (!what) { update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (as.id !== selAsset) return as; const ap = Object.assign({}, as.approvals); delete ap[part]; return Object.assign({}, as, { approvals: ap }); }) })); return; }
      setDialog({ kind: 'reason', part, what });
    };
    const recordDecision = (why) => {
      const d = dialog; setDialog(null); if (!why) return;
      update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (as.id !== selAsset) return as; const ap = Object.assign({}, as.approvals); if (d.what === 'approve') ap[d.part] = { version: as.current, sig: sigOf(d.part, as.versions.find(v => v.id === as.current)), by: WHO(), reason: why, at: Date.now() }; else delete ap[d.part]; return Object.assign({}, as, { approvals: ap }); }), approvals: x.approvals.concat([{ asset: selAsset, part: d.part, decision: d.what, reason: why, by: WHO(), at: Date.now() }]), thread: x.thread.concat([{ id: uid('m'), role: 'you', at: Date.now(), target: (a || {}).title, text: (d.what === 'approve' ? 'Approved ' : 'Rejected ') + d.part + ': ' + why }].concat(d.what === 'reject' && /truck|machinery|vehicle|logo|always|never|terminology|wording/i.test(why) ? [{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Recorded as client taste, not performance. This reads like a standing preference.', offer: { text: why, scope: null } }] : [{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Recorded as client ' + (d.what === 'approve' ? 'acceptance' : 'feedback') + ', not as measured performance.' }])) }));
    };
    const compare = (va, vb) => setCmp({ a: va, b: vb });
    const restore = (vid) => update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (as.id !== selAsset) return as; const src = as.versions.find(v => v.id === vid); const cur = as.versions.find(v => v.id === as.current); const nv = mkVersion(cur, { copy: Object.assign({}, src.copy), image: src.image, layout: Object.assign({}, src.layout), mode: src.mode, restoredFrom: vid }, 'restored from v' + (as.versions.indexOf(src) + 1), 'restore', WHO()); return reconcile(Object.assign({}, as, { versions: as.versions.concat([nv]), current: nv.id })); }), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Restored as a new version; the later history is kept. Approvals stand only for content that is unchanged.', changed: [selAsset], render: false }]) }));
    const rebuild = () => say({ text: 'Rebuilding a flattened tile as an editable composition would create a new version with the same background and the text as layers, keep the original, and ask for review. (Phase 2)' });
    const retryJob = (jid) => update(x => Object.assign({}, x, { jobs: x.jobs.map(j => (j.id === jid ? Object.assign({}, j, { state: 'done', attempts: j.attempts + 1, ended: Date.now(), error: '' }) : j)) }));
    const cancelJob = (jid) => update(x => Object.assign({}, x, { jobs: x.jobs.map(j => (j.id === jid ? Object.assign({}, j, { state: 'cancelled', ended: Date.now(), error: 'cancelled; an in-flight provider call may still complete and cost' }) : j)) }));

    /* the direction interpreter: keyword rules stand in for the creative-director model */
    const send = (cmd) => {
      if (!p) return;
      if (cmd.pick) { update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (as.id !== cmd.asset) return as; const cur = as.versions.find(v => v.id === as.current); const nv = mkVersion(cur, { copy: Object.assign({}, cur.copy, { [cmd.field]: cmd.pick }) }, 'chose an alternative ' + cmd.field, 'text', WHO()); return reconcile(Object.assign({}, as, { versions: as.versions.concat([nv]), current: nv.id })); }), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Applied the chosen ' + cmd.field + ' as a text change.', changed: [cmd.asset], render: false }]) })); return; }
      if (cmd.confirm || cmd.decline) {
        const mid = cmd.confirm || cmd.decline;
        update(x => { const m = x.thread.find(t => t.id === mid); const prop = m && m.proposal; return Object.assign({}, x, { thread: x.thread.map(t => (t.id === mid ? Object.assign({}, t, { proposal: Object.assign({}, t.proposal, { decided: cmd.confirm ? 'yes' : 'no' }) }) : t)) }); });
        if (cmd.confirm) runRender(mid);
        return;
      }
      const text = cmd.text; const tgt = target;
      update(x => Object.assign({}, x, { thread: x.thread.concat([{ id: uid('m'), role: 'you', at: Date.now(), text, target: tgt === 'set' ? 'the whole set' : tgt === 'family' && a ? a.family : tgt === 'element' && selField ? (a || {}).title + ' / ' + selField : (a || {}).title }]) }));
      const lower = text.toLowerCase();
      if (/\b(this|it|that)\b/.test(lower) && tgt === 'set' && !/all|every|whole|set/.test(lower)) { say({ text: 'Which asset do you mean? The target is set to the whole set, but the direction says "this". Pick the asset on the left or change the target, and I will apply it once.' }); return; }
      if (!a && tgt !== 'set') { say({ text: 'Select an asset on the left first, or set the target to the whole set.' }); return; }
      const targetsIds = tgt === 'set' ? p.assets.map(x => x.id) : tgt === 'family' ? p.assets.filter(x => x.family === a.family).map(x => x.id) : [a.id];
      if (/three|3|alternative|options?|variants?/.test(lower) && /(opening|headline|line|cta|caption)/.test(lower)) {
        const field = /opening|caption/.test(lower) ? 'caption' : /cta|call/.test(lower) ? 'cta' : 'headline';
        const alts = field === 'headline' ? ['Not a subsidy. A tax that never applied.', 'The credit returns a tax. It never was a handout.', 'Off-road fuel. No road tax. No subsidy.'] : field === 'cta' ? ['Get the facts', 'See how the credit works', 'Hands Off Our Fuel'] : ['Who uses the fuel tax credit? Probably someone you know.', 'Farmers, tradies and tourism operators all rely on it.', 'It is not a subsidy. Here is what it actually is.'];
        say({ text: 'Three alternative ' + field + 's for ' + a.title + ', each within the channel limit and the client rules. Choose one; it becomes a text change, no render.', alternatives: alts, field, asset: a.id }); return;
      }
      if (/adapt|resize|version for|for (linkedin|instagram|facebook|x\b|story|portrait|square|landscape)/.test(lower) && a) {
        const want = Object.keys(CHANNELS).filter(c => lower.indexOf(c) >= 0 || (c === 'x' && /\bx\b/.test(lower)));
        const fmts = ['9:16', '4:5', '1:1', '16:9'].filter(f => lower.indexOf(f) >= 0 || (f === '9:16' && /story/.test(lower)) || (f === '4:5' && /portrait/.test(lower)) || (f === '16:9' && /landscape/.test(lower)));
        const cur = a.versions.find(v => v.id === a.current);
        const news = (want.length ? want : [a.channel]).flatMap(c => (fmts.length ? fmts : [CHANNELS[c].format]).map(f => { const v = mkVersion(null, { copy: Object.assign({}, cur.copy, c !== a.channel ? { caption: (cur.copy.caption || '').slice(0, CHANNELS[c].max - 40) + (c === 'instagram' ? ' #HandsOffOurFuel' : '') } : {}), image: cur.image, mode: cur.mode, adaptedFrom: cur.id }, 'adapted from ' + a.title + ' v' + a.versions.indexOf(cur), c !== a.channel || f !== a.format ? 'layout' : 'text'); return { id: uid('a'), family: a.family, channel: c, format: f, title: CHANNELS[c].label + ' ' + (f === '9:16' ? 'story' : f === '4:5' ? 'portrait' : f === '16:9' ? 'landscape' : 'post'), versions: [v], current: v.id, locks: Object.assign({}, a.locks), approvals: {} }; }));
        if (!news.length) { say({ text: 'Name the channel or format to adapt to: LinkedIn, Instagram, Facebook, X, portrait 4:5, story 9:16, landscape 16:9.' }); return; }
        update(x => Object.assign({}, x, { assets: x.assets.concat(news), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Adapted ' + a.title + ' into ' + news.map(n => n.title + ' ' + n.format).join(', ') + ' in the same family. Same approved messaging; the argument, reading order and caption length are adjusted per channel; the layout is re-flowed for each format, the image is reused, so no render was spent. Locks carried across.', changed: news.map(n => n.id), render: false }]) })); setSelAsset(news[0].id); setView('asset'); return;
      }
      if (/(restrain|calmer|quieter|less busy|background|imagery|image|visual|regenerat|re-render|new photo|no truck|different (photo|image))/.test(lower)) {
        const steps = /restrain|calm|quiet|less/.test(lower) ? ['Simplify the background: fewer elements, softer light', 'Keep the teal panel, headline size and logo placement (layout is ' + (a.locks.layout ? 'locked' : 'unlocked') + ')', 'Render one new 2K background for ' + a.title] : /no truck/.test(lower) ? ['Replace the haul truck with a regional scene without machinery', 'Keep every text element and the layout', 'Render one new 2K background for ' + a.title] : ['Render a new background as directed', 'Keep the text elements and layout', 'One 2K render for ' + a.title];
        say({ text: 'That needs a new image, not a text change. Here is what I would do; confirm and it runs as a job you can watch under Jobs.', proposal: { steps, render: true, asset: a.id, text } , offer: /no truck|never|always/.test(lower) ? { text: text.replace(/^\W+/, ''), scope: null } : undefined }); return;
      }
      if (/professional|better|nicer|improve|stronger/.test(lower) && !/headline|caption|cta|line/.test(lower)) {
        say({ text: '"' + text + '" can mean several things. Proposed interpretation:', proposal: { steps: ['Reduce the headline one step and tighten the support line (text change)', 'Simplify the background so the panel reads first (one render)', 'Keep the logo and layout as they are'], render: true, asset: a.id, text } }); return;
      }
      if (/headline|sharper|shorter|tighter|punchier|caption|support|cta|call to action|terminology|wording|plain|use the client/.test(lower)) {
        const field = /caption|opening/.test(lower) ? 'caption' : /support/.test(lower) ? 'support' : /cta|call to action/.test(lower) ? 'cta' : 'headline';
        if (a.locks[field]) { say({ text: 'The ' + field + ' on ' + a.title + ' is locked. Unlock it on the asset (the lock button beside the field) and send the direction again.' }); return; }
        const rewrite = { headline: /plain|terminology|wording|client/.test(lower) ? 'Fuel tax credits are not a subsidy.' : 'Not a subsidy. Never was.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: (a.versions.find(v => v.id === a.current).copy.caption || '').replace(/^[^.]+\./, 'Fuel tax credits are not a subsidy.') }[field];
        const locked = Object.keys(a.locks).filter(k => a.locks[k]);
        update(x => Object.assign({}, x, { assets: x.assets.map(as => { if (targetsIds.indexOf(as.id) < 0 || as.locks[field]) return as; const cur = as.versions.find(v => v.id === as.current); const nv = mkVersion(cur, { copy: Object.assign({}, cur.copy, { [field]: rewrite }) }, field + ' revised: ' + text.slice(0, 40), 'text', 'studio'); return reconcile(Object.assign({}, as, { versions: as.versions.concat([nv]), current: nv.id })); }), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: (targetsIds.length === 1 ? a.title : targetsIds.length + ' assets') + ': ' + field + ' changed' + (/plain|terminology|wording|client/.test(lower) ? ' to the client\'s approved wording' : '') + '. Layout and image kept. Text change only, no render spent.' + (overflow(Object.assign({}, a.versions.find(v => v.id === a.current).copy, { [field]: rewrite }), a.format) ? ' Layout check: the new headline may overflow; see Checks.' : ' Overflow check passed.'), changed: targetsIds, render: false, locked: locked.length ? locked : undefined, offer: /always|never|terminology|use the client/.test(lower) ? { text: text.replace(/^\W+/, ''), scope: null } : undefined }]) })); return;
      }
      say({ text: 'I can change a text element (headline, support, CTA, caption), give alternatives, adapt to a channel or format, or change the imagery (a render). Tell me which, and which asset. (prototype: the creative-director model answers here in Phase 2)' });
    };
    const runRender = (mid) => {
      const m = p.thread.find(t => t.id === mid); if (!m || !m.proposal) return;
      const asId = m.proposal.asset; const jid = uid('j');
      update(x => Object.assign({}, x, { jobs: x.jobs.concat([{ id: jid, stage: 'render', asset: asId, state: 'running', started: Date.now(), attempts: 1 }]) }));
      setBusy('Rendering a new 2K background for ' + ((p.assets.find(x => x.id === asId) || {}).title || 'the asset') + '. Job ' + jid + ' is under Jobs; you can close the browser and come back. (prototype: 2 seconds)');
      setTimeout(() => {
        update(x => Object.assign({}, x, { jobs: x.jobs.map(j => (j.id === jid ? Object.assign({}, j, { state: 'done', ended: Date.now() }) : j)), assets: x.assets.map(as => { if (as.id !== asId) return as; const cur = as.versions.find(v => v.id === as.current); if (cur.at > Date.now() - 1500 && cur.by === WHO()) return as; /* a newer hand edit wins; the render is kept as a branch */ const nv = mkVersion(cur, { image: { key: /no truck/i.test(m.proposal.text) ? 'bg-harvester' : 'bg-plain', label: /no truck/i.test(m.proposal.text) ? 'Regional scene, no machinery' : 'Simplified background', model: 'gemini-3-pro-image', size: '2K' } }, 'new background: ' + m.proposal.text.slice(0, 40), 'render', 'studio'); return reconcile(Object.assign({}, as, { versions: as.versions.concat([nv]), current: nv.id })); }), thread: x.thread.concat([{ id: uid('m'), role: 'studio', at: Date.now(), text: 'New background rendered (2K, gemini-3-pro-image). Text elements and layout unchanged. Design approval on this asset needs renewing; copy approval stands.', changed: [asId], render: true }]) }));
        setBusy('');
      }, 2000);
    };
    const saveOffer = (mid, scope) => {
      const ta = document.getElementById('offer-' + mid); const wording = ta ? ta.value.trim() : '';
      update(x => Object.assign({}, x, { thread: x.thread.map(t => (t.id === mid ? Object.assign({}, t, { offer: Object.assign({}, t.offer, scope ? { scope, wording } : { declined: true }) }) : t)), preferences: scope ? x.preferences.concat([{ scope, wording, campaign: scope === 'campaign' ? x.campaign : null, by: WHO(), at: Date.now() }]) : x.preferences }));
      setOfferOpen(null); toastMsg(scope ? 'Saved as ' + (scope === 'campaign' ? 'a campaign preference for ' + (p.campaign || 'this project') : 'a lasting ' + client.id.toUpperCase() + ' rule') + ' (prototype: not written to the Engine)' : 'Not saved; applied to this work only');
    };
    const importLegacy = (l) => { if (!canWrite()) { toastMsg('Legacy items open read-only'); return; } const id = uid('p'); const v = mkVersion(null, { copy: { headline: 'Critical minerals need a strategic reserve', support: '', cta: 'Learn more', caption: 'Australia holds the minerals the world needs. A strategic reserve keeps them working for Australians.', alt: 'Flattened legacy tile' }, image: { key: 'bg-plain', label: 'Legacy tile (flattened)', model: 'gemini-2.5-flash-image', size: '1K' }, mode: 'generated' }, 'imported from ' + l.id + ' (original kept)', 'render'); const np = Object.assign(demoProject(), { id, title: l.title.replace(/^(Release pack|Content set): /, ''), campaign: '', status: 'production', legacy: l.id, brief: { objective: 'Imported legacy work; brief not recorded at the time.', audience: 'Not recorded', message: 'Not recorded', deliverables: l.tiles ? l.tiles + ' tiles' : l.items + ' pieces', assumptions: [] }, sources: [], references: [], directions: [], assets: [{ id: uid('a'), family: 'Imported tiles', channel: 'linkedin', format: '1:1', title: 'Tile 1', versions: [v], current: v.id, locks: {}, approvals: {} }], thread: [{ id: uid('m'), role: 'studio', at: Date.now(), text: 'Imported ' + l.title + ' as a Studio project under ' + client.name + '. The original ' + l.kind + ' is untouched; its tiles are flattened images, so their text is not editable until a tile is rebuilt as a composition. Historical brief fields are marked "not recorded" rather than invented. Importing again would open this project, not create a second one.' }], jobs: [] }); setProjects(ps => ps.concat([np])); setPid(id); setSelAsset(np.assets[0].id); setView('asset'); };

    /* ---------------------------------------------------------- render */
    const header = html`<div class="st-head">
      <div class="st-head-l"><span class="ov-title">Creative Studio</span>
        <select class="st-sel" value=${clientId} onChange=${e => switchClient(e.target.value)} aria-label="Client">${CLIENTS.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        ${p ? html`<button class="ov-link" onClick=${() => { setPid(null); setCmp(null); }}>projects</button><span class="st-sep">/</span><b>${p.title}</b><span class="ov-dim">${(client.campaigns.find(c => c.id === p.campaign) || {}).name || 'no campaign'}</span>` : html`<span class="ov-dim">project library</span>`}
      </div>
      <div class="st-head-r">${p ? html`<span class="ov-dim">saved ${ago(p.updated)} ago${p.legacy ? ', imported from ' + p.legacy : ''}</span><span class=${'st-status ' + stage}>${stage}</span><button class="ov-link" onClick=${() => setView('context')} title="What the Studio knows about this client">client context</button>${p.assets.length ? html`<button class="btn sm ghost" onClick=${() => setDialog({ kind: 'export' })}>Export</button>` : null}` : null}<${Chip} kind="warn" title="Phase 0: synthetic data, simulated models and jobs, nothing saved">prototype</${Chip}></div>
    </div>`;
    const stepper = p ? html`<div class="st-steps" aria-label="Stages">${['brief', 'directions', 'production', 'review', 'export'].map((s, i, arr) => { const idx = arr.indexOf(stage); const skipped = s === 'directions' && !p.directions.length; return html`<button key=${s} class=${'st-step' + (s === stage ? ' on' : i < idx ? ' done' : '') + (skipped ? ' skipped' : '')} onClick=${() => setView(s === 'directions' ? 'directions' : s === 'brief' ? 'brief' : s === 'export' ? 'asset' : 'asset')} title=${skipped ? 'Skipped: a clear instruction needs no direction step' : ''}>${s}</button>`; })}</div>` : null;

    let centre;
    if (!p) centre = intake ? html`<${Intake} client=${client} onCreate=${createProject} onCancel=${() => setIntake(false)} />` : html`<${Library} client=${client} projects=${projects} onOpen=${openProject} onNew=${() => setIntake(true)} onImport=${importLegacy} />`;
    else if (cmp && a) centre = html`<${CompareView} a=${a} client=${client} vA=${a.versions.find(v => v.id === cmp.a)} vB=${a.versions.find(v => v.id === cmp.b)} onClose=${() => setCmp(null)} onRestore=${vid => { restore(vid); setCmp(null); }} />`;
    else if (view === 'brief') centre = html`<${BriefView} p=${p} onChange=${b => update(x => Object.assign({}, x, { brief: b }))} />`;
    else if (view === 'sources') centre = html`<${SourcesView} p=${p} />`;
    else if (view === 'references') centre = html`<${ReferencesView} p=${p} />`;
    else if (view === 'directions') centre = html`<${DirectionsView} p=${p} onChoose=${chooseDirection} onMore=${moreDirection} />`;
    else if (view === 'context') centre = html`<${ContextView} client=${client} />`;
    else if (view === 'jobs') centre = html`<${JobsView} p=${p} onRetry=${retryJob} onCancel=${cancelJob} />`;
    else if (a) centre = html`<${AssetView} p=${p} a=${a} client=${client} sel=${selField} setSel=${setSelField} onEdit=${editField} onLock=${toggleLock} onApprove=${approve} onCompare=${compare} onRestore=${restore} onRebuild=${rebuild} />`;
    else centre = html`<div class="st-centre-pad"><div class="ov-empty">${p.directions.length && !p.directions.some(d => d.chosen) ? 'Choose a direction to start production.' : 'Confirm the brief on the left; production starts from it.'}</div></div>`;

    return html`<div class="st">
      ${header}${stepper}
      <div class=${'st-body' + (p ? '' : ' lib')}>
        ${p ? html`<${Rail} p=${p} client=${client} view=${cmp ? 'compare' : view} setView=${v => { setCmp(null); setView(v); }} sel=${selAsset} setSel=${id => { setSelAsset(id); setSelField(null); setCmp(null); }} />` : null}
        <main class="st-centre">${centre}</main>
        ${p ? html`<${Partner} p=${p} a=${a} sel=${selField} target=${target} setTarget=${setTarget} onSend=${send} busy=${busy} onOffer=${saveOffer} offerOpen=${offerOpen} setOfferOpen=${setOfferOpen} />` : null}
      </div>
      ${dialog && dialog.kind === 'export' ? html`<${ExportDialog} p=${p} client=${client} onClose=${() => setDialog(null)} onClickup=${ready => setDialog({ kind: 'clickup', ready })} />` : null}
      ${dialog && dialog.kind === 'clickup' ? html`<${ClickupDialog} ready=${dialog.ready} client=${client} onClose=${() => setDialog(null)} />` : null}
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
