/* AXIOM - the Sources view. Every outlet, office, party, pollster, sector title
 * and podcast the platform reads, as one table: which method delivers for each
 * (feed, WordPress API, JSON feed, news sitemap, podcast directory, listing
 * page, Google News, a rendered page), when it last delivered, how much it
 * gave in the last day, how many sweeps in a row have failed, and why. Probe
 * runs every method live and shows each answer; Sweep files what a source has
 * now; a source that has stopped delivering is red here and was reported to
 * Slack once. Times are shown in Australian Eastern time.
 *
 * A React island (React, ReactDOM and htm vendored under docs/vendor; shared
 * pieces from docs/ax-ui.js) mounted into #sources-root on first open.
 */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.sourcesInit = function () {
      const root = document.getElementById('sources-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, toastMsg, ago, Console, tailJob } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const TIER_LABEL = { core: 'Core feed', national: 'National', metro: 'Metro', regional: 'Regional', broadcaster: 'Broadcaster', wire: 'Wire', independent: 'Independent', official: 'Official', party: 'Party', polling: 'Polling', thinktank: 'Think tank / peak body', sector: 'Sector press', podcast: 'Podcast', sweep: 'Google News sweep' };
  const JURIS_LABEL = { au: 'National', nsw: 'NSW', vic: 'VIC', qld: 'QLD', wa: 'WA', sa: 'SA', tas: 'TAS', act: 'ACT', nt: 'NT' };
  const METHOD_LABEL = { rss: 'feed', wp: 'WordPress API', json: 'JSON feed', sitemap: 'news sitemap', podcast: 'podcast directory', html: 'listing page', gnews: 'Google News', render: 'rendered page' };
  const STATUS = { ok: ['Delivering', 'var(--x-pos)'], failing: ['Failing', 'var(--x-warn)'], dead: ['Dead', 'var(--x-neg)'], stale: ['Stale', '#C9A24A'], unverified: ['Not yet tried', '#8A93A6'], off: ['Off', '#5C6475'] };
  const STATUS_ORDER = { dead: 0, failing: 1, stale: 2, unverified: 3, ok: 4, off: 5 };
  const URL_FIELDS = [['rss', 'Feed (RSS/Atom)'], ['wp', 'WordPress site root'], ['json', 'JSON feed'], ['sitemap', 'News sitemap'], ['home', 'Listing page'], ['site', 'Site for Google News (site:)'], ['gnews', 'Google News query'], ['podcast', 'Podcast (Apple directory search)']];
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const fmtAestLong = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZoneName: 'short' });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const aestLong = ts => (ts ? fmtAestLong.format(new Date(+ts)) : '');
  const issues = () => (typeof AX_ISSUES !== 'undefined' && Array.isArray(AX_ISSUES) ? AX_ISSUES : []);
  const issueLabel = id => { const i = issues().find(x => x.id === id); return i ? (i.label || i.id) : id; };
  const dl = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };

  function Dot({ status }) { const s = STATUS[status] || STATUS.unverified; return html`<span class="src-dot" style=${{ background: s[1] }} title=${s[0]}></span>`; }
  function Word({ status }) { const s = STATUS[status] || STATUS.unverified; return html`<span class="src-status" style=${{ color: s[1] }}><${Dot} status=${status} />${s[0]}</span>`; }

  /* The strip: what the estate looks like right now. */
  function Summary({ data, onSweepDue, onSweepAll, onStatus, canWrite, busy }) {
    const s = (data && data.summary) || {};
    const last = data && data.lastSweep;
    const by = s.byMethod || {};
    const methods = Object.keys(by).sort((a, b) => by[b] - by[a]).map(m => (METHOD_LABEL[m] || m) + ' ' + by[m]).join(' / ');
    const quiet = [['failing', s.failing, 'failing'], ['dead', s.dead, 'dead'], ['stale', s.stale, 'stale'], ['unverified', s.unverified, 'not yet tried'], ['off', s.off, 'off']].filter(x => x[1]);
    const notDelivering = quiet.reduce((a, x) => a + x[1], 0);
    return html`<div class="src-strip">
      <div class="src-stats">
        <div class="src-stat"><div class="k">Delivering</div><div class="v" style=${{ color: 'var(--x-pos)' }}>${s.ok || 0}</div><div class="s">${methods || 'no method has delivered yet'}</div></div>
        <div class="src-stat"><div class="k">Items, 24h</div><div class="v">${s.items24 || 0}</div><div class="s">${last ? 'last sweep ' + ago(last.at) + ' ago: ' + last.succeeded + ' of ' + last.ran + ' delivered' : 'no sweep recorded yet'}</div></div>
        <div class="src-stat"><div class="k">Sources</div><div class="v">${s.total || 0}</div><div class="s">${s.enabled || 0} on, ${s.core || 0} core feeds${data && data.perTick ? ', ' + data.perTick + ' swept each half hour' : ''}</div></div>
        <div class="src-stat quiet"><div class="k">Not delivering</div><div class="v">${notDelivering}</div><div class="s">${quiet.length ? quiet.map((x, i) => html`<span key=${x[0]}>${i ? ' / ' : ''}<button class="src-link" onClick=${() => onStatus(x[0])}>${x[1]} ${x[2]}</button></span>`) : 'every source on the books delivers'}</div></div>
      </div>
      ${canWrite ? html`<div class="src-actions">
        <button class="btn sm" disabled=${busy} onClick=${onSweepDue}>Sweep what is due</button>
        <button class="btn sm ghost" disabled=${busy} onClick=${onSweepAll}>Sweep every source</button>
      </div>` : null}
    </div>`;
  }

  function DeadBanner({ list, onPick, shown }) {
    const dead = list.filter(s => s.status === 'dead');
    if (!dead.length) return null;
    if (!shown) return html`<div class="src-banner quiet"><span class="m">${dead.length} source${dead.length === 1 ? ' has' : 's have'} stopped delivering (reported to Slack once).</span> <button class="src-link" onClick=${() => onPick('')}>Show them</button></div>`;
    return html`<div class="src-banner">
      <b>${dead.length} source${dead.length === 1 ? ' has' : 's have'} stopped delivering.</b> Reported to Slack once; probe to see every route, or switch off what is gone.
      <span class="src-banner-list">${dead.slice(0, 12).map(s => html`<button key=${s.id} class="src-link" onClick=${() => onPick(s.id)}>${s.name}</button>`)}${dead.length > 12 ? html`<span class="m">and ${dead.length - 12} more</span>` : null}</span>
    </div>`;
  }

  function Filters({ f, setF, data, count, hidden }) {
    const set = (k, v) => setF(Object.assign({}, f, { [k]: v }));
    const tiers = (data && data.tiers) || Object.keys(TIER_LABEL);
    const juris = (data && data.juris) || Object.keys(JURIS_LABEL);
    const methods = (data && data.methods) || Object.keys(METHOD_LABEL);
    return html`<div class="src-filters">
      <input class="src-q" placeholder="Search name, id or url" value=${f.q} onInput=${e => set('q', e.target.value)} />
      <select value=${f.tier} onChange=${e => set('tier', e.target.value)}><option value="">All tiers</option>${tiers.map(t => html`<option key=${t} value=${t}>${TIER_LABEL[t] || t}</option>`)}</select>
      <select value=${f.juris} onChange=${e => set('juris', e.target.value)}><option value="">All jurisdictions</option>${juris.map(j => html`<option key=${j} value=${j}>${JURIS_LABEL[j] || j}</option>`)}</select>
      <select value=${f.status} onChange=${e => set('status', e.target.value)} aria-label="Status"><option value="ok">Delivering only</option><option value="">Every status</option>${Object.keys(STATUS).filter(s => s !== 'ok').map(s => html`<option key=${s} value=${s}>${STATUS[s][0]}</option>`)}</select>
      <select value=${f.issue} onChange=${e => set('issue', e.target.value)}><option value="">Any client issue</option>${issues().map(i => html`<option key=${i.id} value=${i.id}>${i.label || i.id}</option>`)}</select>
      <select value=${f.method} onChange=${e => set('method', e.target.value)}><option value="">Any method</option>${methods.map(m => html`<option key=${m} value=${m}>${METHOD_LABEL[m] || m}</option>`)}</select>
      <select value=${f.sort} onChange=${e => set('sort', e.target.value)}><option value="status">Sort: needs attention</option><option value="name">Sort: name</option><option value="items">Sort: items 24h</option><option value="latest">Sort: latest item</option><option value="fails">Sort: failures</option></select>
      <span class="src-count">${count} shown${hidden ? ', ' + hidden + ' hidden' : ''}</span>
    </div>`;
  }

  function Row({ s, on, onPick }) {
    const route = s.method_ok ? (METHOD_LABEL[s.method_ok] || s.method_ok) : (s.last_try ? 'nothing yet' : '-');
    const others = Math.max(0, (s.methods || []).length - (s.method_ok ? 1 : 0));
    return html`<tr class=${'src-row' + (on ? ' on' : '') + (s.enabled ? '' : ' off')} onClick=${() => onPick(s.id)}>
      <td class="src-name"><div class="n">${s.name}</div><div class="m">${s.id}${s.core ? ' / core' : ''}${s.edited ? ' / edited' : ''}</div></td>
      <td class="src-tier">${TIER_LABEL[s.tier] || s.tier}</td>
      <td>${JURIS_LABEL[s.juris] || s.juris}</td>
      <td class="src-route"><span class=${'src-chip' + (s.method_ok ? ' on' : '')}>${route}</span>${others ? html`<span class="m">+${others} fallback${others === 1 ? '' : 's'}</span>` : null}</td>
      <td class="num" title=${s.latest_ts ? aestLong(s.latest_ts) : 'no dated item yet'}>${s.latest_ts ? ago(s.latest_ts) : '-'}</td>
      <td class="num">${s.items24 || 0}</td>
      <td class="num" style=${{ color: s.fails >= 6 ? 'var(--x-neg)' : s.fails ? 'var(--x-warn)' : undefined }}>${s.fails || 0}</td>
      <td><${Word} status=${s.status} /></td>
    </tr>`;
  }

  /* The drawer: one source in full - its routes, the live probe, its recent
     attempts, and the fields the operator can change. */
  function Drawer({ s, canWrite, renderReady, onClose, onChanged, onJob }) {
    const [probe, setProbe] = useState(null);
    const [probing, setProbing] = useState(false);
    const [health, setHealth] = useState([]);
    const [edit, setEdit] = useState(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setProbe(null); setEdit(null); setHealth([]); if (s) call('/sources/health?id=' + encodeURIComponent(s.id) + '&limit=20').then(d => setHealth(d.rows || [])).catch(() => setHealth([])); }, [s && s.id]);
    if (!s) return null;
    const doProbe = async () => {
      setProbing(true);
      try { const d = await call('/sources/probe?id=' + encodeURIComponent(s.id)); setProbe(d); onChanged(); }
      catch (e) { toastMsg(e.message, true); }
      setProbing(false);
    };
    const doSweep = async () => {
      setProbing(true);
      try { const d = await call('/sources/sweep', { ids: [s.id] }); const r = (d.results || [])[0]; toastMsg(r && r.ok ? r.items + ' items via ' + (METHOD_LABEL[r.method] || r.method) + ', ' + r.added + ' new' : 'Nothing delivered: ' + ((r && r.tried || []).filter(t => !t.skipped).map(t => t.method + ' ' + t.detail).join('; ') || 'no route'), !(r && r.ok)); if (r && r.tried) setProbe({ id: s.id, results: r.tried, best: r.method, delivering: r.tried.filter(t => t.ok).map(t => t.method), swept: true }); onChanged(); }
      catch (e) { toastMsg(e.message, true); }
      setProbing(false);
    };
    const toggle = async () => { try { await call('/sources/update', { id: s.id, enabled: !s.enabled }); toastMsg(s.enabled ? 'Switched off' : 'Switched on'); onChanged(); } catch (e) { toastMsg(e.message, true); } };
    const remove = async () => { if (!confirm('Delete ' + s.name + ' from the registry? Its archive rows stay.')) return; try { await call('/sources/delete', { id: s.id }); toastMsg('Deleted'); onClose(); onChanged(); } catch (e) { toastMsg(e.message, true); } };
    const renderProbe = async () => { try { const d = await call('/bridge/run', { source: 'render', params: { source: s.id } }); onJob(d.id, 'render ' + s.id + (d.where === 'desktop' ? ' (waiting for a Mac with Playwright)' : '')); } catch (e) { toastMsg(e.message, true); } };
    const startEdit = () => setEdit({ name: s.name, tier: s.tier, juris: s.juris, issues: s.issues.slice(), schedule: s.schedule, note: s.note, urls: Object.assign({}, s.urls) });
    const save = async () => {
      setSaving(true);
      try { const body = Object.assign({ id: s.id }, edit); if (s.core) delete body.urls; await call('/sources/update', body); toastMsg('Saved'); setEdit(null); onChanged(); }
      catch (e) { toastMsg(e.message, true); }
      setSaving(false);
    };
    const results = (probe && probe.results) || [];
    return html`<div class="src-drawer">
      <div class="src-drawerhead">
        <div><div class="src-drawertitle">${s.name}</div><div class="m">${s.id} / ${TIER_LABEL[s.tier] || s.tier} / ${JURIS_LABEL[s.juris] || s.juris}${s.core ? ' / core feed, fetched every tick by the news aggregator' : ''}</div></div>
        <button class="btn sm ghost" onClick=${onClose}>Close</button>
      </div>
      <div class="src-facts">
        <div><span class="k">Status</span><${Word} status=${s.status} /></div>
        <div><span class="k">Delivers via</span>${s.method_ok ? (METHOD_LABEL[s.method_ok] || s.method_ok) : 'nothing yet'}</div>
        <div><span class="k">Last delivered</span>${s.last_ok ? aestLong(s.last_ok) : 'never'}</div>
        <div><span class="k">Last tried</span>${s.last_try ? aestLong(s.last_try) : 'never'}</div>
        <div><span class="k">Latest item</span>${s.latest_ts ? aestLong(s.latest_ts) : '-'}</div>
        <div><span class="k">Items, 24h</span>${s.items24 || 0}</div>
        <div><span class="k">Failed in a row</span>${s.fails || 0}</div>
        <div><span class="k">Schedule</span>every ${s.schedule} min</div>
        ${s.issues.length ? html`<div class="wide"><span class="k">Client issues</span>${s.issues.map(issueLabel).join(', ')}</div>` : null}
        ${s.last_error ? html`<div class="wide err"><span class="k">Last failure</span>${s.last_error}</div>` : null}
        ${s.note ? html`<div class="wide"><span class="k">Note</span>${s.note}</div>` : null}
      </div>
      <div class="src-sub">Routes, in the order the sweep tries them</div>
      <div class="src-routes">${(s.methods || []).map(m => html`<span key=${m} class=${'src-chip' + (m === s.method_ok ? ' on' : '')} title=${s.urls[m === 'html' || m === 'render' ? 'home' : m === 'gnews' ? (s.urls.gnews ? 'gnews' : 'site') : m] || ''}>${METHOD_LABEL[m] || m}</span>`)}</div>
      <div class="src-urls">${Object.keys(s.urls).map(k => html`<div key=${k}><span class="k">${k}</span><span class="u">${s.urls[k]}</span></div>`)}</div>
      <div class="src-btns">
        <button class="btn sm" disabled=${probing} onClick=${doProbe}>${probing ? 'Probing...' : 'Probe every route'}</button>
        ${canWrite ? html`<button class="btn sm" disabled=${probing} onClick=${doSweep}>Sweep now</button>` : null}
        ${canWrite && s.urls.home ? html`<button class="btn sm ghost" onClick=${renderProbe} title=${renderReady ? 'Render the listing page through the configured browser' : 'No browser is configured on the worker: the job waits for a Mac running tools/reach-agent.py with Playwright'}>Probe with a browser</button>` : null}
        ${canWrite ? html`<button class="btn sm ghost" onClick=${toggle}>${s.enabled ? 'Switch off' : 'Switch on'}</button>` : null}
        ${canWrite && !edit ? html`<button class="btn sm ghost" onClick=${startEdit}>Edit</button>` : null}
        ${canWrite && !s.core ? html`<button class="btn sm ghost" onClick=${remove}>Delete</button>` : null}
      </div>
      ${probe ? html`<div class="src-sub">${probe.swept ? 'This sweep' : 'Live probe'}: ${probe.delivering && probe.delivering.length ? 'delivering via ' + probe.delivering.map(m => METHOD_LABEL[m] || m).join(', ') : 'no route delivered'}</div>
        <table class="src-probe"><thead><tr><th>Route</th><th>Result</th><th class="num">Items</th><th class="num">ms</th><th>Detail</th></tr></thead><tbody>
          ${results.map(r => html`<tr key=${r.method} class=${r.ok ? 'ok' : r.skipped ? 'skip' : 'bad'}>
            <td>${METHOD_LABEL[r.method] || r.method}</td>
            <td>${r.ok ? 'delivered' + (r.full ? ' (full text)' : '') : r.skipped ? 'skipped' : 'failed'}</td>
            <td class="num">${r.n || 0}</td><td class="num">${r.ms || 0}</td>
            <td class="det">${r.detail || (r.sample && r.sample.length ? r.sample.map(x => x.title).join(' / ') : '')}</td>
          </tr>`)}
        </tbody></table>` : null}
      ${health.length ? html`<div class="src-sub">Recent attempts (Australian Eastern time)</div>
        <table class="src-probe"><thead><tr><th>When</th><th>Result</th><th>Route</th><th class="num">New rows</th><th>Detail</th></tr></thead><tbody>
          ${health.map(h => html`<tr key=${h.id} class=${h.ok ? 'ok' : 'bad'}><td>${aest(h.ts)}</td><td>${h.ok ? 'delivered' : 'failed'}</td><td>${h.method ? (METHOD_LABEL[h.method] || h.method) : '-'}</td><td class="num">${h.n || 0}</td><td class="det">${h.detail}</td></tr>`)}
        </tbody></table>` : null}
      ${edit ? html`<div class="src-sub">Edit</div>
        <div class="src-form">
          <label>Name<input value=${edit.name} onInput=${e => setEdit(Object.assign({}, edit, { name: e.target.value }))} /></label>
          <label>Tier<select value=${edit.tier} onChange=${e => setEdit(Object.assign({}, edit, { tier: e.target.value }))}>${Object.keys(TIER_LABEL).map(t => html`<option key=${t} value=${t}>${TIER_LABEL[t]}</option>`)}</select></label>
          <label>Jurisdiction<select value=${edit.juris} onChange=${e => setEdit(Object.assign({}, edit, { juris: e.target.value }))}>${Object.keys(JURIS_LABEL).map(j => html`<option key=${j} value=${j}>${JURIS_LABEL[j]}</option>`)}</select></label>
          <label>Every (minutes)<input type="number" min="15" max="1440" value=${edit.schedule} onInput=${e => setEdit(Object.assign({}, edit, { schedule: e.target.value }))} /></label>
          <label class="wide">Note<input value=${edit.note} onInput=${e => setEdit(Object.assign({}, edit, { note: e.target.value }))} /></label>
          <div class="wide"><div class="k">Client issues</div><div class="src-chips">${issues().map(i => html`<button key=${i.id} type="button" class=${'src-chip pick' + (edit.issues.indexOf(i.id) >= 0 ? ' on' : '')} onClick=${() => setEdit(Object.assign({}, edit, { issues: edit.issues.indexOf(i.id) >= 0 ? edit.issues.filter(x => x !== i.id) : edit.issues.concat([i.id]) }))}>${i.label || i.id}</button>`)}</div></div>
          ${!s.core ? URL_FIELDS.map(([k, label]) => html`<label key=${k} class="wide">${label}<input value=${edit.urls[k] || ''} placeholder=${k === 'site' ? 'example.com.au' : k === 'gnews' ? 'site:example.com.au OR "search terms"' : k === 'podcast' ? 'Podcast name as listed by Apple' : 'https://...'} onInput=${e => { const u = Object.assign({}, edit.urls); if (e.target.value.trim()) u[k] = e.target.value.trim(); else delete u[k]; setEdit(Object.assign({}, edit, { urls: u })); }} /></label>`) : html`<div class="wide m">A core feed's url is code (AU_FEEDS in the worker); switch it off here if it should not be fetched.</div>`}
          <div class="wide src-btns"><button class="btn sm" disabled=${saving} onClick=${save}>${saving ? 'Saving...' : 'Save'}</button><button class="btn sm ghost" onClick=${() => setEdit(null)}>Cancel</button></div>
        </div>` : null}
    </div>`;
  }

  function AddForm({ onAdded, onClose }) {
    const [f, setF] = useState({ name: '', tier: 'independent', juris: 'au', issues: [], schedule: '', note: '', urls: {} });
    const [saving, setSaving] = useState(false);
    const save = async () => {
      setSaving(true);
      try { const d = await call('/sources/add', f); toastMsg('Added ' + d.source.name + ': ' + d.source.methods.map(m => METHOD_LABEL[m] || m).join(', ')); onAdded(d.source.id); }
      catch (e) { toastMsg(e.message, true); }
      setSaving(false);
    };
    return html`<div class="src-drawer">
      <div class="src-drawerhead"><div><div class="src-drawertitle">Add a source</div><div class="m">Give it any way in; the sweep tries them in order and keeps what works.</div></div><button class="btn sm ghost" onClick=${onClose}>Close</button></div>
      <div class="src-form">
        <label>Name<input value=${f.name} onInput=${e => setF(Object.assign({}, f, { name: e.target.value }))} placeholder="Riverine Herald" /></label>
        <label>Tier<select value=${f.tier} onChange=${e => setF(Object.assign({}, f, { tier: e.target.value }))}>${Object.keys(TIER_LABEL).filter(t => t !== 'core').map(t => html`<option key=${t} value=${t}>${TIER_LABEL[t]}</option>`)}</select></label>
        <label>Jurisdiction<select value=${f.juris} onChange=${e => setF(Object.assign({}, f, { juris: e.target.value }))}>${Object.keys(JURIS_LABEL).map(j => html`<option key=${j} value=${j}>${JURIS_LABEL[j]}</option>`)}</select></label>
        <label>Every (minutes)<input type="number" min="15" max="1440" value=${f.schedule} placeholder="by tier" onInput=${e => setF(Object.assign({}, f, { schedule: e.target.value }))} /></label>
        <div class="wide"><div class="k">Client issues</div><div class="src-chips">${issues().map(i => html`<button key=${i.id} type="button" class=${'src-chip pick' + (f.issues.indexOf(i.id) >= 0 ? ' on' : '')} onClick=${() => setF(Object.assign({}, f, { issues: f.issues.indexOf(i.id) >= 0 ? f.issues.filter(x => x !== i.id) : f.issues.concat([i.id]) }))}>${i.label || i.id}</button>`)}</div></div>
        ${URL_FIELDS.map(([k, label]) => html`<label key=${k} class="wide">${label}<input value=${f.urls[k] || ''} placeholder=${k === 'site' ? 'example.com.au' : k === 'gnews' ? 'site:example.com.au OR "search terms"' : k === 'podcast' ? 'Podcast name as listed by Apple' : 'https://...'} onInput=${e => { const u = Object.assign({}, f.urls); if (e.target.value.trim()) u[k] = e.target.value.trim(); else delete u[k]; setF(Object.assign({}, f, { urls: u })); }} /></label>`)}
        <label class="wide">Note<input value=${f.note} onInput=${e => setF(Object.assign({}, f, { note: e.target.value }))} /></label>
        <div class="wide src-btns"><button class="btn sm" disabled=${saving || !f.name.trim() || !Object.keys(f.urls).length} onClick=${save}>${saving ? 'Adding...' : 'Add source'}</button></div>
      </div>
    </div>`;
  }

  function SourcesApp() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState('');
    const [f, setF] = useState({ q: '', tier: '', juris: '', status: 'ok', issue: '', method: '', sort: 'items' });
    window.AXUI.useScope(sc => setF(cur => Object.assign({}, cur, { issue: sc.issue || '', juris: sc.region && sc.region !== 'au' ? sc.region : (sc.region === 'au' ? 'au' : cur.juris) })));
    const [pick, setPick] = useState('');
    const [adding, setAdding] = useState(false);
    const [job, setJob] = useState(null);
    const [busy, setBusy] = useState(false);
    const stopRef = useRef(null);
    const fileRef = useRef(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const load = useCallback(async () => { try { const d = await call('/sources'); setData(d); setErr(''); } catch (e) { setErr(e.message); } }, []);
    useEffect(() => { load(); return () => { if (stopRef.current) stopRef.current(); }; }, [load]);
    const list = useMemo(() => {
      if (!data) return [];
      const q = f.q.trim().toLowerCase();
      let l = data.sources.filter(s => (!f.tier || s.tier === f.tier) && (!f.juris || s.juris === f.juris) && (!f.status || s.status === f.status) && (!f.issue || s.issues.indexOf(f.issue) >= 0) && (!f.method || s.method_ok === f.method)
        && (!q || (s.name + ' ' + s.id + ' ' + Object.values(s.urls || {}).join(' ')).toLowerCase().indexOf(q) >= 0));
      const by = { status: (a, b) => (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) || (b.fails - a.fails) || a.name.localeCompare(b.name), name: (a, b) => a.name.localeCompare(b.name), items: (a, b) => (b.items24 - a.items24) || a.name.localeCompare(b.name), latest: (a, b) => (b.latest_ts - a.latest_ts) || a.name.localeCompare(b.name), fails: (a, b) => (b.fails - a.fails) || a.name.localeCompare(b.name) };
      return l.slice().sort(by[f.sort] || by.status);
    }, [data, f]);
    const picked = data && pick ? data.sources.find(s => s.id === pick) : null;
    const tail = (id, title) => {
      if (stopRef.current) stopRef.current();
      setJob({ id, title, status: 'running', lines: [] });
      stopRef.current = tailJob(id, j => setJob(Object.assign({ title }, j)), j => { setJob(Object.assign({ title }, j)); setBusy(false); load(); });
    };
    const sweep = async (all) => {
      setBusy(true);
      try { const d = await call('/sources/sweep', all ? { all: true } : { ids: [] }); if (d.job) tail(d.job, all ? 'sweep every source' : 'sweep what is due'); else { setBusy(false); load(); } }
      catch (e) { toastMsg(e.message, true); setBusy(false); }
    };
    const exportJson = async () => { try { const d = await call('/sources/export'); dl('axiom-sources-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(d, null, 2)); } catch (e) { toastMsg(e.message, true); } };
    const importJson = async (file) => {
      if (!file) return;
      try { const d = JSON.parse(await file.text()); const r = await call('/sources/import', { sources: d.sources || d }); toastMsg(r.added + ' added, ' + r.updated + ' updated' + (r.skipped.length ? ', ' + r.skipped.length + ' skipped' : '')); load(); }
      catch (e) { toastMsg(e.message, true); }
      if (fileRef.current) fileRef.current.value = '';
    };
    if (err) return html`<div class="aud-notice" style=${{ margin: '12px 0' }}><b>Could not load the registry.</b> ${err}</div>`;
    if (!data) return html`<div class="empty" style=${{ padding: '40px 0' }}>Loading the source registry...</div>`;
    return html`<div class="src-app">
      <${Summary} data=${data} canWrite=${canWrite} busy=${busy} onSweepDue=${() => sweep(false)} onSweepAll=${() => sweep(true)} onStatus=${st => setF(Object.assign({}, f, { status: st, sort: 'status' }))} />
      <${DeadBanner} list=${data.sources} shown=${f.status !== 'ok'} onPick=${id => { if (!id) { setF(Object.assign({}, f, { status: 'dead', sort: 'status' })); return; } setAdding(false); setPick(id); }} />
      ${job ? html`<${Console} job=${job} title=${job.title} />` : null}
      <div class="src-toolbar">
        <${Filters} f=${f} setF=${setF} data=${data} count=${list.length} hidden=${data.sources.length - list.length} />
        <div class="src-toolbtns">
          ${canWrite ? html`<button class="btn sm" onClick=${() => { setPick(''); setAdding(true); }}>Add source</button>` : null}
          <button class="btn sm ghost" onClick=${exportJson}>Export</button>
          ${canWrite ? html`<button class="btn sm ghost" onClick=${() => fileRef.current && fileRef.current.click()}>Import</button><input ref=${fileRef} type="file" accept="application/json" style=${{ display: 'none' }} onChange=${e => importJson(e.target.files && e.target.files[0])} />` : null}
          <button class="btn sm ghost" onClick=${load}>Refresh</button>
        </div>
      </div>
      <div class=${'src-main' + (picked || adding ? ' split' : '')}>
        <div class="src-tablewrap">
          <table class="src-table">
            <thead><tr><th>Source</th><th>Tier</th><th>Juris.</th><th>Delivers via</th><th class="num">Latest</th><th class="num">24h</th><th class="num">Fails</th><th>Status</th></tr></thead>
            <tbody>${list.map(s => html`<${Row} key=${s.id} s=${s} on=${s.id === pick} onPick=${id => { setAdding(false); setPick(id === pick ? '' : id); }} />`)}</tbody>
          </table>
          ${!list.length ? (f.status === 'ok' && !f.q && !f.tier && !f.juris && !f.issue && !f.method
            ? html`<div class="empty" style=${{ padding: '30px 0' }}>No source is delivering yet. The first sweeps after a deploy prove the routes; ${data.sources.length} sources are on the books. <button class="src-link" onClick=${() => setF(Object.assign({}, f, { status: '', sort: 'status' }))}>Show every source</button></div>`
            : html`<div class="empty" style=${{ padding: '30px 0' }}>No source matches these filters.${f.status === 'ok' ? html` <button class="src-link" onClick=${() => setF(Object.assign({}, f, { status: '' }))}>Include sources that are not delivering</button>` : null}</div>`) : null}
        </div>
        ${adding ? html`<${AddForm} onAdded=${id => { setAdding(false); setPick(id); load(); }} onClose=${() => setAdding(false)} />`
          : picked ? html`<${Drawer} s=${picked} canWrite=${canWrite} renderReady=${!!data.renderConfigured} onClose=${() => setPick('')} onChanged=${load} onJob=${tail} />` : null}
      </div>
    </div>`;
  }

  let mounted = false;
  window.sourcesInit = function () {
    const root = document.getElementById('sources-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${SourcesApp} />`); }
  };
})();
