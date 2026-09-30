/* AXIOM - the Narratives view. The stories the conversation keeps telling:
 * where each first appeared, the order the channels took it up, who carries
 * it, its pace, the sentiment split of its rows, where it stands toward the
 * client, its counter-narrative, and every row behind it. A React island
 * (React, ReactDOM and htm vendored under docs/vendor; shared pieces from
 * docs/ax-ui.js) mounted into #narratives-root on first open. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.narrativesInit = function () {
      const root = document.getElementById('narratives-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, toastMsg, fmtN, ago, Console, tailJob, useGoto, useScope } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const PLATFORMS = ['news', 'reddit', 'x', 'bluesky', 'mastodon', 'youtube', 'substack', 'linkedin', 'meta', 'forum'];
  const PLAT_LABEL = { news: 'News', reddit: 'Reddit', x: 'X', bluesky: 'Bluesky', mastodon: 'Mastodon', youtube: 'YouTube', substack: 'Substack', linkedin: 'LinkedIn', meta: 'Facebook / Instagram', forum: 'Forums', unknown: 'Other' };
  const STATUS_LABEL = { emerging: 'Emerging', growing: 'Growing', steady: 'Steady', fading: 'Fading', new: 'New' };
  const SIDE_LABEL = { hostile: 'Hostile to the client', supportive: 'Supportive of the client', mixed: 'Mixed', unknown: 'No stance read yet' };
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const issues = () => (typeof AX_ISSUES !== 'undefined' && Array.isArray(AX_ISSUES) ? AX_ISSUES : []);
  const pct = (a, n) => (n ? Math.round(a / n * 100) : 0);
  const pace = n => (n.nprev ? n.velocity + 'x' : n.n24 ? n.n24 + ' new' : 'quiet');

  function Split({ s }) {
    if (!s || !s.judged) return html`<span class="src-name"><span class="m" style=${{ marginTop: 0 }}>no rows judged yet</span></span>`;
    const neg = pct(s.neg, s.judged), pos = pct(s.pos, s.judged);
    return html`<span class="nr-split" title=${s.neg + ' hostile, ' + s.neu + ' neutral, ' + s.pos + ' warm of ' + s.judged + ' rows judged'}><i style=${{ width: neg + '%', background: 'var(--x-neg)' }}></i><i style=${{ width: (100 - neg - pos) + '%', background: 'rgba(255,255,255,.14)' }}></i><i style=${{ width: pos + '%', background: 'var(--x-pos)' }}></i></span>`;
  }
  function Spread({ spread }) { return html`<span class="nr-spread">${(spread || []).slice(0, 6).map(s => html`<span key=${s.platform} title=${(PLAT_LABEL[s.platform] || s.platform) + ': first ' + aest(s.first) + ', ' + s.n + ' rows'}>${PLAT_LABEL[s.platform] || s.platform}</span>`)}</span>`; }
  function Status({ s }) { return html`<span class=${'nr-status ' + s}>${STATUS_LABEL[s] || s}</span>`; }
  function Side({ s }) { return html`<span class=${'nr-side ' + s} title=${SIDE_LABEL[s] || s}>${s === 'unknown' ? 'unread' : s}</span>`; }
  /* Rows a day, stacked by channel. */
  function Chart({ series }) {
    if (!series || !series.length) return html`<div class="empty" style=${{ padding: '14px 0' }}>Nothing yet.</div>`;
    const W = 480, H = 100, pad = 6, maxN = Math.max(1, ...series.map(p => p.n));
    const bw = Math.max(3, (W - pad * 2) / series.length - 3);
    const colour = { news: 'var(--x-ac-hi)', reddit: '#FF6314', x: '#C9D2E0', bluesky: '#3B82F6', mastodon: '#8C8DFF', youtube: '#FF4E45', substack: '#FF6719', meta: '#5A8DEE', linkedin: '#4A9BE0', forum: 'var(--x-pos)' };
    return html`<svg class="sn-chart" style=${{ height: 100 }} viewBox=${'0 0 ' + W + ' ' + H} preserveAspectRatio="none" role="img" aria-label="Rows a day by channel">
      ${series.map((p, i) => { let y = H - pad; const x = pad + i * ((W - pad * 2) / series.length); return Object.keys(p.platforms).map(pl => { const h = (p.platforms[pl] / maxN) * (H - pad * 2); y -= h; return html`<rect key=${i + pl} x=${x} y=${y} width=${bw} height=${h} fill=${colour[pl] || 'rgba(255,255,255,.3)'}><title>${new Date(p.t).toISOString().slice(0, 10) + ' ' + (PLAT_LABEL[pl] || pl) + ': ' + p.platforms[pl]}</title></rect>`; }); })}
    </svg>`;
  }

  function Strip({ status, onRun, onReset, onNameAll, busy, canWrite }) {
    const s = status || {}; const b = s.budget || {};
    return html`<div class="src-strip">
      <div class="src-stats">
        <div class="src-stat"><div class="k">Live narratives</div><div class="v">${fmtN(s.live || 0)}</div><div class="s">${fmtN(s.named || 0)} named, ${fmtN(s.placed24 || 0)} rows placed today</div></div>
        <div class="src-stat"><div class="k">Emerging</div><div class="v" style=${{ color: (s.emerging || 0) ? 'var(--x-neg)' : undefined }}>${s.emerging || 0}</div><div class="s">new, ${s.alertMin || 6}+ rows within 48h</div></div>
        <div class="src-stat"><div class="k">Growing</div><div class="v" style=${{ color: (s.growing || 0) ? 'var(--x-warn)' : undefined }}>${s.growing || 0}</div><div class="s">faster than yesterday</div></div>
        <div class="src-stat"><div class="k">Alerts sent</div><div class="v">${s.alerted || 0}</div><div class="s">to the client's Slack, once each</div></div>
        <div class="src-stat"><div class="k">Waiting</div><div class="v" style=${{ color: (s.backlog || 0) > 300 ? 'var(--x-warn)' : undefined }}>${fmtN(s.backlog || 0)}</div><div class="s">rows of the last ${s.windowHours || 72}h not yet placed</div></div>
        <div class="src-stat"><div class="k">Naming budget</div><div class="v">${b.used || 0}<i style=${{ fontStyle: 'normal', fontSize: 12, color: 'var(--t3)' }}> / ${b.cap || 0}</i></div><div class="s">${s.embeddings ? 'embeddings' : 'term vectors (Workers AI unbound)'}${s.naming ? ', ' + (b.model || '') : ', ANTHROPIC_API_KEY not set'}</div></div>
      </div>
      ${canWrite ? html`<div class="src-actions"><button class="btn sm" disabled=${busy} onClick=${onRun} title="Place the newest rows, recount, name what has earned a name, pair counters, raise alerts">${busy ? 'Running...' : 'Place and name now'}</button>${s.naming ? html`<button class="btn sm ghost" disabled=${busy} onClick=${onNameAll} title="Recount what is stale, then name every narrative that has earned a name, one Claude call at a time; Stop in the console halts it">Name all waiting</button>` : null}${s.broad ? html`<button class="btn sm ghost" disabled=${busy} onClick=${onReset} title=${'A cluster past ' + (s.maxRows || 200) + ' rows is a topic, not a narrative. Dissolving it frees its rows to be placed again under the current rules.'}>Dissolve ${s.broad} broad cluster${s.broad === 1 ? '' : 's'}</button>` : null}</div>` : null}
    </div>`;
  }
  function Filters({ f, setF, count }) {
    const set = (k, v) => setF(Object.assign({}, f, { [k]: v }));
    return html`<div class="sn-filters">
      <select value=${f.days} onChange=${e => set('days', +e.target.value)} aria-label="Window"><option value="1">Active in 24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option></select>
      <select value=${f.issue} onChange=${e => set('issue', e.target.value)} aria-label="Client issue"><option value="">Any client issue</option>${issues().map(i => html`<option key=${i.id} value=${i.id}>${i.label || i.id}</option>`)}</select>
      <select value=${f.platform} onChange=${e => set('platform', e.target.value)} aria-label="Channel"><option value="">Every channel</option>${PLATFORMS.map(p => html`<option key=${p} value=${p}>${PLAT_LABEL[p]}</option>`)}</select>
      <select value=${f.status} onChange=${e => set('status', e.target.value)} aria-label="Status"><option value="">Any status</option>${Object.keys(STATUS_LABEL).map(s => html`<option key=${s} value=${s}>${STATUS_LABEL[s]}</option>`)}</select>
      <select value=${f.side} onChange=${e => set('side', e.target.value)} aria-label="Stance"><option value="">Any stance</option><option value="hostile">Hostile to the client</option><option value="supportive">Supportive</option><option value="mixed">Mixed</option><option value="unknown">Unread</option></select>
      <select value=${f.scope} onChange=${e => set('scope', e.target.value)} aria-label="Relevance"><option value="">Client issues and Australian politics</option><option value="client">Client issues only</option><option value="off">Off-topic (hidden by default)</option></select>
      <select value=${f.sort} onChange=${e => set('sort', e.target.value)} aria-label="Sort"><option value="velocity">Fastest moving</option><option value="n">Largest</option><option value="new">Newest</option><option value="latest">Latest activity</option></select>
      <input class="src-q" placeholder="Search labels and terms" value=${f.q} onInput=${e => set('q', e.target.value)} />
      <span class="src-count">${count} narratives</span>
    </div>`;
  }
  const unnamed = n => 'Unnamed: ' + ((n.termsTop && n.termsTop.length ? n.termsTop.slice(0, 5) : (n.entities || []).slice(0, 3)).join(', ') || n.id);
  /* What the last run did, in words, with the narratives it touched as links. */
  function RunResult({ r, list, onOpen, only, setOnly }) {
    if (!r) return null;
    const touched = r.touched || [];
    const byId = {}; (list || []).forEach(n => { byId[n.id] = n; });
    const shown = touched.slice(0, 8);
    return html`<div class="nr-result">
      <div class="nr-resulthead"><span class="ov-title">This run</span><span class="nr-resultsum">${r.summary || (r.placed + ' rows placed')}</span></div>
      ${touched.length ? html`<div class="nr-resultlist">
        <span class="ov-dim">${touched.length} narrative${touched.length === 1 ? '' : 's'} gained rows:</span>
        ${shown.map(x => { const n = byId[x.id]; return html`<button key=${x.id} class="nr-link" onClick=${() => onOpen(x.id)} title=${n ? n.n + ' rows, ' + (n.client || 'no client') : 'not in the current list (filtered out, or a single row)'}>${n ? (n.label || unnamed(n)) : (x.started ? 'new narrative' : 'narrative ' + x.id)}<i>+${x.added}${x.started ? ' new' : ''}</i></button>`; })}
        ${touched.length > shown.length ? html`<span class="ov-dim">and ${touched.length - shown.length} more</span>` : null}
        <label class="nr-only"><input type="checkbox" checked=${!!only} onChange=${e => setOnly(e.target.checked)} /> show only these</label>
      </div>` : html`<div class="ov-dim">No narrative gained a row in this run.</div>`}
      ${r.namingDeferred || r.deferred ? html`<div class="ov-dim">${[r.deferred ? r.deferred + ' recounts' : '', r.namingDeferred ? 'naming' : ''].filter(Boolean).join(' and ')} wait for the half-hourly tick, which has minutes where a run from here has seconds.</div>` : null}
      ${r.simStats ? html`<div class="ov-dim">Closest existing narrative for the ${r.simStats.started} rows that started one: typically ${r.simStats.median}, top tenth ${r.simStats.p90}; the bar is ${r.simStats.bar}${r.simStats.atOldBar ? ' (' + r.simStats.atOldBar + ' would have joined at 0.80)' : ''}.</div>` : null}
    </div>`;
  }
  function Table({ list, pick, onPick, touched }) {
    return html`<div class="sn-tablewrap"><table class="sn-table nr-table">
      <thead><tr><th>Narrative</th><th>Toward client</th><th class="num">Rows</th><th class="num">Pace</th><th>Spread</th><th>First seen</th><th>Split</th><th>Status</th></tr></thead>
      <tbody>${list.map(n => html`<tr key=${n.id} class=${'sn-row' + (pick === n.id ? ' on' : '')} onClick=${() => onPick(n.id)}>
        <td><div class=${'lbl' + (n.label ? '' : ' un')}>${n.pinned ? html`<span title="pinned">* </span>` : null}${n.label || unnamed(n)}${touched && touched[n.id] ? html`<span class="nr-chip" title="rows this narrative gained in the last run from here">+${touched[n.id].added}${touched[n.id].started ? ' new' : ''}</span>` : null}</div><div class="m">${n.scope === 'off' ? html`<span class="nr-off" title=${n.scopeWhy || 'judged off-topic for the agency and its clients'}>off-topic</span> ` : n.scope === 'politics' ? html`<span class="nr-scope" title=${n.scopeWhy || ''}>politics</span> ` : null}${(n.issueLabels || []).join(', ')}${n.client ? ' / ' + n.client : ''}${n.proponents ? ' / ' + n.proponents : ''}</div></td>
        <td><${Side} s=${n.side} /></td>
        <td class="num" title=${n.n24 + ' in the last 24h, ' + n.nprev + ' the day before'}>${fmtN(n.n)}</td>
        <td class="num"><span class="nr-pace" style=${{ color: n.nprev && n.velocity >= 2 ? 'var(--x-neg)' : n.nprev && n.velocity < 0.5 ? 'var(--t3)' : undefined }}>${pace(n)}</span></td>
        <td><${Spread} spread=${n.spread} /></td>
        <td title=${aest(n.first_ts)}><span class="src-name"><span class="m" style=${{ marginTop: 0 }}>${(PLAT_LABEL[n.first_platform] || n.first_platform || '?') + (n.first_channel ? ' ' + n.first_channel : '')}</span></span><div class="m">${ago(n.first_ts)} ago</div></td>
        <td><${Split} s=${n.sentiment} /></td>
        <td><${Status} s=${n.status} /></td>
      </tr>`)}</tbody>
    </table>${!list.length ? html`<div class="empty" style=${{ padding: '30px 0' }}>No narrative in this scope. Widen the window or run the placement.</div>` : null}</div>`;
  }

  function Drawer({ id, list, canWrite, onClose, onOpen, onChanged }) {
    const [d, setD] = useState(null); const [err, setErr] = useState(''); const [edit, setEdit] = useState(null); const [mergeInto, setMergeInto] = useState(''); const [busy, setBusy] = useState(false);
    const load = useCallback(async () => { try { setD(await call('/narratives/one?id=' + encodeURIComponent(id))); setErr(''); } catch (e) { setErr(e.message); } }, [id]);
    useEffect(() => { setD(null); setEdit(null); setMergeInto(''); load(); }, [load]);
    if (err) return html`<div class="sn-drawer"><div class="aud-notice">${err}</div></div>`;
    if (!d) return html`<div class="sn-drawer"><div class="empty">Loading...</div></div>`;
    const s = d.sentiment || {};
    const save = async () => { setBusy(true); try { await call('/narratives/update', Object.assign({ id }, edit, { issues: String(edit.issues || '').split(/[,\s]+/).filter(Boolean) })); toastMsg('Saved'); setEdit(null); await load(); onChanged(); } catch (e) { toastMsg(e.message, true); } setBusy(false); };
    const flag = async (patch, msg) => { try { await call('/narratives/update', Object.assign({ id }, patch)); toastMsg(msg); await load(); onChanged(); } catch (e) { toastMsg(e.message, true); } };
    const merge = async () => { if (!mergeInto || !confirm('Fold this narrative and its rows into the chosen one?')) return; setBusy(true); try { await call('/narratives/merge', { into: mergeInto, from: id }); toastMsg('Merged'); onChanged(); onOpen(mergeInto); } catch (e) { toastMsg(e.message, true); } setBusy(false); };
    return html`<div class="sn-drawer">
      <div class="sn-drawerhead"><div><div class="sn-drawertitle">${d.label || 'Unnamed narrative'}</div><div class="src-name"><div class="m">${[(d.issueLabels || []).join(', '), d.client, d.proponents ? 'carried by ' + d.proponents : ''].filter(Boolean).join(' / ')}</div></div></div><button class="btn sm ghost" onClick=${onClose}>Close</button></div>
      <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><${Status} s=${d.status} /><${Side} s=${d.side} />${d.scope ? html`<span class=${'nr-status' + (d.scope === 'off' ? ' off' : '')} title=${d.scopeWhy || ''}>${d.scope === 'off' ? 'off-topic' : d.scope === 'client' ? 'client issue' : 'Australian politics'}${d.relevance >= 0 ? ', relevance ' + d.relevance + '/3' : ''}</span>` : null}${d.alerted ? html`<span class="nr-status">alerted ${ago(d.alert_ts)} ago</span>` : null}${d.muted ? html`<span class="nr-status">muted</span>` : null}</div>
      ${d.summary ? html`<div class="nr-claim" style=${{ color: 'var(--t1)', fontSize: 12.5 }}>${d.summary}</div>` : null}
      ${d.claim ? html`<div class="sn-sub">The claim</div><div class="nr-claim">${d.claim}</div>` : null}
      ${d.counter_claim ? html`<div class="sn-sub">The counter-claim</div><div class="nr-claim counter">${d.counter_claim}</div>` : null}
      ${d.counterNarrative ? html`<div class="src-name"><div class="m">Counter-narrative on file: <button class="nr-link" onClick=${() => onOpen(d.counterNarrative.id)}>${d.counterNarrative.label}</button> (${d.counterNarrative.n} rows, ${d.counterNarrative.side})</div></div>` : null}
      <div class="sn-sub">What changed</div>
      <div class="sn-facts">
        <div><span class="k">Rows</span>${fmtN(d.n)}</div>
        <div><span class="k">Last 24h vs before</span>${d.n24} vs ${d.nprev} (${pace(d)})</div>
        <div><span class="k">First seen</span>${(PLAT_LABEL[d.first_platform] || d.first_platform)}${d.first_channel ? ' ' + d.first_channel : ''}, ${ago(d.first_ts)} ago</div>
        <div><span class="k">Split</span><${Split} s=${s} /></div>
        <div><span class="k">Hostile / warm</span>${s.judged ? pct(s.neg, s.judged) + '% / ' + pct(s.pos, s.judged) + '%' : '-'}</div>
        <div><span class="k">Channels</span>${Object.keys(d.platforms || {}).length}</div>
      </div>
      <div class="sn-sub">How it spread: the order the channels took it up (Australian Eastern)</div>
      <div class="nr-timeline">${(d.spread || []).map((sp, i) => html`<div key=${sp.platform}><span class="k">${i + 1}</span><span class="k">${aest(sp.first)}</span><span>${PLAT_LABEL[sp.platform] || sp.platform} - ${sp.n} row${sp.n === 1 ? '' : 's'}</span></div>`)}</div>
      <div class="sn-sub">Rows a day by channel</div>
      <${Chart} series=${d.series} />
      <div class="sn-sub">Who carries it</div>
      <table class="sn-mini"><tbody>${(d.channels || []).map(c => html`<tr key=${c.channel + c.platform}><td>${c.channel}</td><td class="src-name"><span class="m" style=${{ marginTop: 0 }}>${PLAT_LABEL[c.platform] || c.platform}</span></td><td class="num">${c.n}</td></tr>`)}</tbody></table>
      ${(d.amplifiers || []).length ? html`<div class="sn-sub">Loudest rows</div><div>${d.amplifiers.map(a => html`<div key=${a.item} class="nr-ev"><div class="tx"><b>${a.title}</b></div><div class="m"><span>${a.channel}</span><span>${fmtN(a.score)} reactions</span><span>${fmtN(a.comments)} comments</span><span>${ago(a.ts)} ago</span>${/^https?:/.test(a.url || '') ? html`<a href=${a.url} target="_blank" rel="noopener">open</a>` : null}</div></div>`)}</div>` : null}
      ${(d.termsTop || []).length ? html`<div class="sn-sub">Shared terms</div><div class="nr-terms">${d.termsTop.map(w => html`<span key=${w}>${w}</span>`)}</div>` : null}
      <div class="sn-sub">Every row, newest first (the origin is marked)</div>
      <div>${(d.items || []).map(it => html`<div key=${it.id} class=${'nr-ev' + (d.origin && it.id === d.origin.id ? ' origin' : '')}>
        <div class="tx">${it.title ? html`<b>${it.title}</b> ` : null}${it.excerpt}</div>
        <div class="m">${d.origin && it.id === d.origin.id ? html`<span style=${{ color: 'var(--x-ac-hi)' }}>origin</span>` : null}<span>${PLAT_LABEL[it.platform] || it.platform}</span><span>${it.channel}</span>${it.mp ? html`<span>${it.mp.name}, ${it.mp.party}</span>` : null}<span title=${aest(it.ts)}>${ago(it.ts)} ago</span>${it.tone != null ? html`<span class=${'sn-st ' + (it.tone < -0.2 ? 'neg' : it.tone > 0.2 ? 'pos' : 'neu')}>tone ${it.tone}</span>` : null}<span>fit ${Math.round((it.sim || 0) * 100)}%</span>${/^https?:/.test(it.url || '') ? html`<a href=${it.url} target="_blank" rel="noopener">open</a>` : null}</div>
      </div>`)}</div>
      ${canWrite ? html`<div class="sn-sub">Operator</div>
        <div class="src-btns">
          <button class="btn sm ghost" onClick=${() => setEdit({ label: d.label, summary: d.summary, claim: d.claim, counter_claim: d.counter_claim, issues: (d.issues || []).join(', ') })}>Edit</button>
          <button class="btn sm ghost" onClick=${() => flag({ pinned: !d.pinned }, d.pinned ? 'Unpinned' : 'Pinned')}>${d.pinned ? 'Unpin' : 'Pin'}</button>
          <button class="btn sm ghost" onClick=${() => flag({ muted: !d.muted }, d.muted ? 'Unmuted' : 'Muted: hidden and no longer matched')}>${d.muted ? 'Unmute' : 'Mute'}</button>
          <select value=${mergeInto} onChange=${e => setMergeInto(e.target.value)} style=${{ fontSize: 12, padding: '6px 9px', borderRadius: 8, border: '1px solid var(--ln)', background: 'rgba(255,255,255,.03)', color: 'var(--t1)' }}><option value="">Merge into...</option>${(list || []).filter(n => n.id !== id).map(n => html`<option key=${n.id} value=${n.id}>${(n.label || unnamed(n)).slice(0, 60)} (${n.n})</option>`)}</select>
          <button class="btn sm ghost" disabled=${!mergeInto || busy} onClick=${merge}>Merge</button>
        </div>
        ${edit ? html`<div class="sn-form" style=${{ marginTop: 10 }}>
          <label class="wide">Label<input value=${edit.label} onInput=${e => setEdit(Object.assign({}, edit, { label: e.target.value }))} /></label>
          <label class="wide">Summary<textarea rows="3" value=${edit.summary} onInput=${e => setEdit(Object.assign({}, edit, { summary: e.target.value }))}></textarea></label>
          <label class="wide">Claim<input value=${edit.claim} onInput=${e => setEdit(Object.assign({}, edit, { claim: e.target.value }))} /></label>
          <label class="wide">Counter-claim<input value=${edit.counter_claim} onInput=${e => setEdit(Object.assign({}, edit, { counter_claim: e.target.value }))} /></label>
          <label class="wide">Client issue ids, comma-separated (${issues().map(i => i.id).join(', ')})<input value=${edit.issues} onInput=${e => setEdit(Object.assign({}, edit, { issues: e.target.value }))} /></label>
          <div class="wide src-btns"><button class="btn sm" disabled=${busy} onClick=${save}>${busy ? 'Saving...' : 'Save'}</button><button class="btn sm ghost" onClick=${() => setEdit(null)}>Cancel</button></div>
        </div>` : null}` : null}
    </div>`;
  }

  function NarrativesApp() {
    const [status, setStatus] = useState(null);
    const [f, setF] = useState({ days: 7, issue: '', platform: '', status: '', side: '', sort: 'velocity', q: '', ns: '', entity: '', scope: '' });
    const [list, setList] = useState(null);
    const [pick, setPick] = useState('');
    const [job, setJob] = useState(null);
    const [lastRun, setLastRun] = useState(null);
    const [onlyRun, setOnlyRun] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const stopRef = useRef(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const loadStatus = useCallback(async () => { try { setStatus(await call('/narratives/status')); } catch (e) { setErr(e.message); } }, []);
    const load = useCallback(async () => {
      try { const d = await call('/narratives?days=' + f.days + '&issue=' + encodeURIComponent(f.issue) + '&platform=' + encodeURIComponent(f.platform) + '&status=' + encodeURIComponent(f.status) + '&side=' + encodeURIComponent(f.side) + '&sort=' + f.sort + '&q=' + encodeURIComponent(f.q.trim()) + '&ns=' + encodeURIComponent(f.ns || '') + '&entity=' + encodeURIComponent(f.entity || '') + '&scope=' + encodeURIComponent(f.scope || '') + '&limit=120'); setList(d.narratives || []); setErr(''); }
      catch (e) { setErr(e.message); setList([]); }
    }, [f.days, f.issue, f.platform, f.status, f.side, f.sort, f.q, f.ns, f.entity, f.scope]);
    useScope(sc => setF(cur => Object.assign({}, cur, { issue: sc.issue || '', platform: sc.platform || '', ns: sc.ns || '', entity: sc.entity || '', days: sc.days || cur.days })));
    useEffect(() => { loadStatus(); return () => { if (stopRef.current) stopRef.current(); }; }, [loadStatus]);
    useEffect(() => { load(); }, [load]);
    useGoto('narratives', p => { if (p.id) setPick(String(p.id)); if (p.issue != null || p.status || p.side || p.platform) setF(cur => Object.assign({}, cur, p.issue != null ? { issue: String(p.issue) } : {}, p.status ? { status: String(p.status) } : {}, p.side ? { side: String(p.side) } : {}, p.platform ? { platform: String(p.platform) } : {})); });
    const run = async () => {
      setBusy(true);
      try { const d = await call('/narratives/run', {}); if (stopRef.current) stopRef.current(); setLastRun(null); setOnlyRun(false); setJob({ id: d.job, status: 'running', lines: [] }); stopRef.current = tailJob(d.job, j => setJob(j), j => { setJob(j); setLastRun(j.result && j.result.ok !== false ? j.result : null); setBusy(false); loadStatus(); load(); }); }
      catch (e) { toastMsg(e.message, true); setBusy(false); }
    };
    const refresh = () => { loadStatus(); load(); };
    const touchedMap = useMemo(() => { if (!lastRun || !lastRun.touched) return null; const m = {}; lastRun.touched.forEach(x => { m[x.id] = x; }); return m; }, [lastRun]);
    const haltRef = useRef(false);
    /* Recount what is stale, then name everything that has earned a name, one call per request, so
       the whole backlog can be finished from here instead of over many ticks. */
    const nameAll = async () => {
      setBusy(true); haltRef.current = false; setLastRun(null);
      const lines = []; let n = 0;
      const push = (kind, text) => { lines.push({ id: ++n, ts: Date.now(), kind, text }); setJob({ id: 'step', status: 'running', lines: lines.slice(), follow: true }); };
      push('info', 'recounting stale narratives, then naming every one that has earned a name; one Claude call per step, Stop halts it');
      let good = true, named = 0;
      try {
        for (let i = 0; i < 10; i++) { if (haltRef.current) break; const d = await call('/narratives/step', { what: 'recount' }); (d.lines || []).forEach(l => push(l.kind, l.text)); if (!d.remaining || !d.recounted) break; }
        for (let i = 0; i < 80; i++) {
          if (haltRef.current) { push('info', 'stopped'); break; }
          const d = await call('/narratives/step', { what: 'name' });
          (d.lines || []).forEach(l => push(l.kind, l.text)); named += d.named || 0;
          if (d.errors && d.errors.length) { const e = d.errors[0]; push('err', e); if (/budget|usage limit|spend limit|regain access/i.test(e)) { push('info', /budget/.test(e) ? 'the daily naming budget is spent; NARRATIVE_DAILY_CALLS raises it' : 'this is the Anthropic account spend limit, not an AXIOM budget; raise it in the Anthropic Console under Settings, Limits'); good = false; break; } }
          if (!d.remaining) { push('info', 'nothing left waiting for a name'); break; }
          if (!d.named && !d.calls) break;
          if (i === 79) push('info', d.remaining + ' still wait; press again');
        }
      } catch (e) { push('err', e.message); good = false; }
      push('done', named + ' narrative' + (named === 1 ? '' : 's') + ' named in this pass');
      setJob({ id: 'step', status: 'done', success: good, lines: lines.slice() });
      setBusy(false); refresh();
    };
    const reset = async () => {
      if (!confirm('Dissolve the broad clusters? Their rows go back to the unplaced pool and are placed again under the current rules over the next ticks.')) return;
      setBusy(true);
      try { const d = await call('/narratives/reset', { broad: true }); toastMsg(d.narratives + ' dissolved, ' + fmtN(d.items) + ' rows freed'); setPick(''); refresh(); } catch (e) { toastMsg(e.message, true); }
      setBusy(false);
    };
    if (err && !list) return html`<div class="aud-notice" style=${{ margin: '12px 0' }}><b>Could not load narratives.</b> ${err}</div>`;
    return html`<div>
      <${Strip} status=${status} onRun=${run} onReset=${reset} onNameAll=${nameAll} busy=${busy} canWrite=${canWrite} />
      <${RunResult} r=${lastRun} list=${list} onOpen=${id => setPick(id)} only=${onlyRun} setOnly=${setOnlyRun} />
      ${job ? html`<${Console} job=${job} title=${job.id === 'step' ? 'name all waiting' : 'place and name'} canWrite=${canWrite} onCancel=${() => { haltRef.current = true; }} />` : null}
      ${err ? html`<div class="rd-res err">${err}</div>` : null}
      <${Filters} f=${f} setF=${setF} count=${(list || []).length} />
      <div class=${'sn-main' + (pick ? ' split' : '')}>
        <div>${list === null ? html`<div class="empty" style=${{ padding: '30px 0' }}>Loading...</div>` : html`<${Table} list=${onlyRun && touchedMap ? list.filter(n => touchedMap[n.id]) : list} pick=${pick} onPick=${id => setPick(id === pick ? '' : id)} touched=${touchedMap} />`}</div>
        ${pick ? html`<${Drawer} id=${pick} list=${list} canWrite=${canWrite} onClose=${() => setPick('')} onOpen=${id => setPick(id)} onChanged=${refresh} />` : null}
      </div>
    </div>`;
  }

  let mounted = false;
  window.narrativesInit = function () {
    const root = document.getElementById('narratives-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${NarrativesApp} />`); }
  };
})();
