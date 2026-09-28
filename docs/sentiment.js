/* AXIOM - the Sentiment view. How the conversation regards each party, person,
 * organisation and topic: the entity register with its aliases, the verdicts
 * Claude has given on the rows that mention them, summed by window, channel,
 * region and client issue, and every figure opens the rows behind it. A React
 * island (React, ReactDOM and htm vendored under docs/vendor; shared pieces
 * from docs/ax-ui.js) mounted into #sentiment-root on first open. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.sentimentInit = function () {
      const root = document.getElementById('sentiment-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, toastMsg, fmtN, ago, Console, tailJob } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const PARTY_COLOUR = { alp: '#E13C3C', lib: '#1D6FE8', nat: '#1E8E3E', coalition: '#2F6FC4', grn: '#1BAA5C', on: '#F28C28', ind: '#8A93A6', teal: '#1FA79C' };
  const PLATFORMS = ['news', 'reddit', 'x', 'bluesky', 'mastodon', 'youtube', 'substack', 'linkedin', 'meta', 'forum'];
  const PLAT_LABEL = { news: 'News', reddit: 'Reddit', x: 'X', bluesky: 'Bluesky', mastodon: 'Mastodon', youtube: 'YouTube', substack: 'Substack', linkedin: 'LinkedIn', meta: 'Facebook / Instagram', forum: 'Forums' };
  const REGION_LABEL = { au: 'National', nsw: 'NSW', vic: 'VIC', qld: 'QLD', wa: 'WA', sa: 'SA', tas: 'TAS', act: 'ACT', nt: 'NT' };
  const KIND_LABEL = { party: 'Party', person: 'Person', org: 'Organisation', topic: 'Topic' };
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const issues = () => (typeof AX_ISSUES !== 'undefined' && Array.isArray(AX_ISSUES) ? AX_ISSUES : []);
  const issueLabel = id => { const i = issues().find(x => x.id === id); return i ? (i.label || i.id) : id; };
  const pct = (a, n) => (n ? Math.round(a / n * 100) : 0);
  const signed = v => (v == null ? '-' : (v > 0 ? '+' : '') + (Math.round(v * 100) / 100).toFixed(2));
  const stanceWord = s => (s < 0 ? 'critical' : s > 0 ? 'supportive' : 'neutral');
  const stanceCls = s => (s < 0 ? 'neg' : s > 0 ? 'pos' : 'neu');

  function Bar({ score }) {
    const v = Math.max(-1, Math.min(1, Number(score) || 0));
    const w = Math.abs(v) * 50;
    return html`<span class="sn-bar" title=${'net stance ' + signed(v) + ' (-1 all critical, +1 all supportive)'}><i style=${{ left: v < 0 ? (50 - w) + '%' : '50%', width: w + '%', background: v < 0 ? 'var(--x-neg)' : 'var(--x-pos)' }}></i></span>`;
  }
  function Kind({ e }) { return html`<span class=${'sn-kind ' + (e.side || '')} title=${e.side === 'client' ? 'A client or its people' : e.side === 'opponent' ? 'An opponent' : ''}>${e.side === 'client' ? 'client' : e.side === 'opponent' ? 'opponent' : (KIND_LABEL[e.kind] || e.kind)}</span>`; }
  function Dot({ party }) { const c = PARTY_COLOUR[party]; return c ? html`<span class="sn-dot" style=${{ background: c }} title=${party}></span>` : null; }
  /* Volume as bars, net stance as a line, in one SVG. */
  function Chart({ points, tone }) {
    if (!points || !points.length) return html`<div class="empty" style=${{ padding: '20px 0' }}>Nothing judged in this window yet.</div>`;
    const W = 480, H = 120, pad = 8, maxN = Math.max(1, ...points.map(p => p.n));
    const bw = Math.max(2, (W - pad * 2) / points.length - 2);
    const x = i => pad + i * ((W - pad * 2) / points.length);
    const y = s => H / 2 - (Math.max(-1, Math.min(1, s)) * (H / 2 - pad));
    const line = points.map((p, i) => (i ? 'L' : 'M') + (x(i) + bw / 2).toFixed(1) + ' ' + y(p.score).toFixed(1)).join(' ');
    return html`<svg class="sn-chart" viewBox=${'0 0 ' + W + ' ' + H} preserveAspectRatio="none" role="img" aria-label="Volume and net stance by day">
      <line x1="0" y1=${H / 2} x2=${W} y2=${H / 2} stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3" />
      ${points.map((p, i) => html`<rect key=${i} x=${x(i)} y=${H - pad - (p.n / maxN) * (H * 0.5)} width=${bw} height=${(p.n / maxN) * (H * 0.5)} fill=${p.score < -0.15 ? 'rgba(240,144,139,.35)' : p.score > 0.15 ? 'rgba(126,224,174,.35)' : 'rgba(255,255,255,.12)'}><title>${new Date(p.t).toISOString().slice(0, 10) + ': ' + p.n + ' mentions, net ' + signed(p.score)}</title></rect>`)}
      <path d=${line} fill="none" stroke=${tone ? 'var(--x-ac-hi)' : 'var(--x-warn)'} stroke-width="2" />
    </svg>`;
  }

  function Strip({ status, onRun, busy, canWrite, onRegister, showReg }) {
    const s = status || {};
    const b = s.budget || {};
    const critical = s.mentions7 ? pct(s.neg7, s.mentions7) : null, supportive = s.mentions7 ? pct(s.pos7, s.mentions7) : null;
    return html`<div class="src-strip">
      <div class="src-stats">
        <div class="src-stat"><div class="k">Stances, 7 days</div><div class="v">${fmtN(s.mentions7 || 0)}</div><div class="s">${fmtN(s.classified7 || 0)} rows judged</div></div>
        <div class="src-stat"><div class="k">Critical</div><div class="v" style=${{ color: critical != null && critical >= 40 ? 'var(--x-neg)' : undefined }}>${critical == null ? '-' : critical + '%'}</div><div class="s">${fmtN(s.neg7 || 0)} critical mentions</div></div>
        <div class="src-stat"><div class="k">Supportive</div><div class="v" style=${{ color: supportive != null && supportive >= 30 ? 'var(--x-pos)' : undefined }}>${supportive == null ? '-' : supportive + '%'}</div><div class="s">${fmtN(s.pos7 || 0)} supportive mentions</div></div>
        <div class="src-stat"><div class="k">Judged, 24h</div><div class="v">${fmtN(s.classified24 || 0)}</div><div class="s">${fmtN(s.skipped24 || 0)} rows mentioned nothing</div></div>
        <div class="src-stat"><div class="k">Waiting</div><div class="v" style=${{ color: (s.backlog || 0) > 200 ? 'var(--x-warn)' : undefined }}>${fmtN(s.backlog || 0)}</div><div class="s">rows that mention an entity, of the newest ${s.unclassifiedScanned || 0} unjudged</div></div>
        <div class="src-stat"><div class="k">Budget today</div><div class="v">${b.used || 0}<i style=${{ fontStyle: 'normal', fontSize: 12, color: 'var(--t3)' }}> / ${b.cap || 0}</i></div><div class="s">${s.configured ? 'Claude calls, ' + (b.model || '') : 'ANTHROPIC_API_KEY is not set'}</div></div>
      </div>
      <div class="src-actions">
        ${canWrite ? html`<button class="btn sm" disabled=${busy || !s.configured} onClick=${onRun} title="Judge the newest rows that mention an entity now">${busy ? 'Classifying...' : 'Classify now'}</button>` : null}
        <button class=${'btn sm ghost' + (showReg ? ' on' : '')} onClick=${onRegister}>${showReg ? 'Back to the table' : 'Entity register (' + ((s.entities || {}).active || 0) + ')'}</button>
      </div>
    </div>`;
  }

  function Filters({ f, setF, count }) {
    const set = (k, v) => setF(Object.assign({}, f, { [k]: v }));
    return html`<div class="sn-filters">
      <select value=${f.days} onChange=${e => set('days', +e.target.value)} aria-label="Window"><option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select>
      <select value=${f.platform} onChange=${e => set('platform', e.target.value)} aria-label="Channel"><option value="">Every channel</option>${PLATFORMS.map(p => html`<option key=${p} value=${p}>${PLAT_LABEL[p]}</option>`)}</select>
      <select value=${f.region} onChange=${e => set('region', e.target.value)} aria-label="Region"><option value="">Every region</option>${Object.keys(REGION_LABEL).map(r => html`<option key=${r} value=${r}>${REGION_LABEL[r]}</option>`)}</select>
      <select value=${f.issue} onChange=${e => set('issue', e.target.value)} aria-label="Client issue"><option value="">Any client issue</option>${issues().map(i => html`<option key=${i.id} value=${i.id}>${i.label || i.id}</option>`)}</select>
      <select value=${f.kind} onChange=${e => set('kind', e.target.value)} aria-label="Kind"><option value="">Parties, people, organisations, topics</option>${Object.keys(KIND_LABEL).map(k => html`<option key=${k} value=${k}>${KIND_LABEL[k]}</option>`)}</select>
      <span class="src-count">${count} entities</span>
    </div>`;
  }

  function Leaderboard({ list, sort, setSort, pick, onPick }) {
    const th = (k, label, cls) => html`<th class=${(sort === k ? 'on ' : '') + (cls || '')} onClick=${() => setSort(k)}>${label}${sort === k ? ' v' : ''}</th>`;
    return html`<div class="sn-tablewrap"><table class="sn-table">
      <thead><tr>${th('name', 'Entity')}${th('n', 'Mentions', 'num')}${th('score', 'Net stance')}${th('neg', 'Critical', 'num')}${th('pos', 'Supportive', 'num')}${th('change', 'Change', 'num')}<th>Channels</th></tr></thead>
      <tbody>${list.map(e => html`<tr key=${e.id} class=${'sn-row' + (pick === e.id ? ' on' : '')} onClick=${() => onPick(e.id)}>
        <td class="sn-name"><div class="n"><${Dot} party=${e.party} />${e.name}<${Kind} e=${e} /></div>${e.role ? html`<div class="m">${e.role}</div>` : null}</td>
        <td class="num">${fmtN(e.n)}</td>
        <td><${Bar} score=${e.score} /><span class="sn-score" style=${{ color: e.score < -0.15 ? 'var(--x-neg)' : e.score > 0.15 ? 'var(--x-pos)' : undefined }}>${signed(e.score)}</span></td>
        <td class="num" style=${{ color: pct(e.neg, e.n) >= 50 ? 'var(--x-neg)' : undefined }}>${pct(e.neg, e.n)}%</td>
        <td class="num" style=${{ color: pct(e.pos, e.n) >= 40 ? 'var(--x-pos)' : undefined }}>${pct(e.pos, e.n)}%</td>
        <td class="num"><span class="sn-delta" style=${{ color: e.change == null ? 'var(--t3)' : e.change < -0.1 ? 'var(--x-neg)' : e.change > 0.1 ? 'var(--x-pos)' : undefined }} title=${e.prev ? 'previous window: ' + e.prev.n + ' mentions, net ' + signed(e.prev.score) : 'no mentions in the previous window'}>${e.change == null ? 'new' : signed(e.change)}</span></td>
        <td><span class="src-name"><span class="m" style=${{ marginTop: 0 }}>${(e.platforms || []).slice(0, 4).map(p => (PLAT_LABEL[p.platform] || p.platform) + ' ' + p.n).join(' / ')}</span></span></td>
      </tr>`)}</tbody>
    </table>${!list.length ? html`<div class="empty" style=${{ padding: '30px 0' }}>No entity has been judged in this scope. Widen the window, or press Classify now.</div>` : null}</div>`;
  }

  function Topics({ topics, onPick }) {
    if (!topics || !topics.length) return null;
    return html`<div class="sn-sub">By client issue: the tone of what was said, and who was named in it</div>
      <div class="sn-tablewrap" style=${{ maxHeight: 320 }}><table class="sn-table">
        <thead><tr><th>Issue</th><th class="num">Rows</th><th>Tone</th><th class="num">Critical</th><th class="num">Supportive</th><th class="num">News</th><th>Named most</th></tr></thead>
        <tbody>${topics.map(t => html`<tr key=${t.id} class="sn-row" onClick=${() => onPick(t)}>
          <td class="sn-name"><div class="n">${t.label}</div><div class="m">${t.client || ''}</div></td>
          <td class="num">${fmtN(t.n)}</td>
          <td><${Bar} score=${t.tone} /><span class="sn-score">${signed(t.tone)}</span></td>
          <td class="num">${pct(t.neg, t.n)}%</td><td class="num">${pct(t.pos, t.n)}%</td><td class="num">${pct(t.news, t.n)}%</td>
          <td><span class="src-name"><span class="m" style=${{ marginTop: 0 }}>${(t.entities || []).slice(0, 4).map(e => e.name + ' ' + signed(e.score)).join(' / ')}</span></span></td>
        </tr>`)}</tbody>
      </table></div>`;
  }

  /* The rows behind a number. */
  function Evidence({ items, loading }) {
    if (loading) return html`<div class="empty" style=${{ padding: '16px 0' }}>Loading the rows...</div>`;
    if (!items || !items.length) return html`<div class="empty" style=${{ padding: '16px 0' }}>No rows in this scope.</div>`;
    return html`<div>${items.map(it => html`<div key=${it.id + ':' + (it.entity || '')} class="sn-ev">
      <div>${it.stance != null ? html`<span class=${'sn-st ' + stanceCls(it.stance)}>${stanceWord(it.stance)}${it.intensity >= 3 ? ', strong' : ''}${it.sarcasm ? ', sarcasm' : ''}</span> ` : html`<span class=${'sn-st ' + (it.tone < -0.2 ? 'neg' : it.tone > 0.2 ? 'pos' : 'neu')}>tone ${signed(it.tone)}</span> `}${it.why ? html`<span class="why">"${it.why}"</span>` : null}</div>
      <div class="tx">${it.kind === 'news' || /thread/.test(it.kind) ? html`<b style=${{ color: 'var(--t0)' }}>${it.title}</b> ` : null}${it.excerpt}</div>
      <div class="m"><span>${PLAT_LABEL[it.platform] || it.platform}</span><span>${REGION_LABEL[it.region] || it.region}</span><span>${it.type}</span><span title=${aest(it.ts)}>${ago(it.ts)} ago</span>${it.issues && it.issues.length ? html`<span>${it.issues.map(issueLabel).join(', ')}</span>` : null}${/^https?:/.test(it.url || '') ? html`<a href=${it.url} target="_blank" rel="noopener">open</a>` : null}</div>
    </div>`)}</div>`;
  }

  function Drawer({ e, f, onClose }) {
    const [series, setSeries] = useState(null);
    const [items, setItems] = useState(null);
    const [stance, setStance] = useState('');
    const [plat, setPlat] = useState('');
    useEffect(() => { setSeries(null); setStance(''); setPlat(''); if (e) call('/sentiment/series?entity=' + encodeURIComponent(e.id) + '&days=' + Math.max(f.days, 14) + '&platform=' + encodeURIComponent(f.platform) + '&region=' + encodeURIComponent(f.region)).then(setSeries).catch(() => setSeries({ points: [] })); }, [e && e.id, f.days, f.platform, f.region]);
    useEffect(() => { setItems(null); if (e) call('/sentiment/items?entity=' + encodeURIComponent(e.id) + '&days=' + f.days + '&stance=' + stance + '&platform=' + encodeURIComponent(plat || f.platform) + '&region=' + encodeURIComponent(f.region) + '&issue=' + encodeURIComponent(f.issue) + '&limit=80').then(d => setItems(d.items || [])).catch(() => setItems([])); }, [e && e.id, f.days, f.platform, f.region, f.issue, stance, plat]);
    if (!e) return null;
    return html`<div class="sn-drawer">
      <div class="sn-drawerhead"><div><div class="sn-drawertitle"><${Dot} party=${e.party} /> ${e.name}</div><div class="src-name"><div class="m">${[KIND_LABEL[e.kind] || e.kind, e.role, e.side !== 'neutral' ? e.side + (e.ns ? ' (' + e.ns + ')' : '') : ''].filter(Boolean).join(' / ')}</div></div></div><button class="btn sm ghost" onClick=${onClose}>Close</button></div>
      <div class="sn-facts">
        <div><span class="k">Mentions</span>${fmtN(e.n)}</div>
        <div><span class="k">Net stance</span><span style=${{ color: e.score < -0.15 ? 'var(--x-neg)' : e.score > 0.15 ? 'var(--x-pos)' : undefined }}>${signed(e.score)}</span></div>
        <div><span class="k">Change</span>${e.change == null ? 'new in this window' : signed(e.change) + ' vs previous ' + f.days + 'd'}</div>
        <div><span class="k">Critical</span>${pct(e.neg, e.n)}% (${e.neg})</div>
        <div><span class="k">Supportive</span>${pct(e.pos, e.n)}% (${e.pos})</div>
        <div><span class="k">Sarcasm, intensity</span>${e.sarcasm} / ${e.intensity}</div>
      </div>
      <div class="sn-sub">Over time: bars are mentions a day, the line is net stance</div>
      <${Chart} points=${series ? series.points : null} />
      <div class="sn-sub">By channel and region</div>
      <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <table class="sn-mini"><tbody>${(e.platforms || []).map(p => html`<tr key=${p.platform} class="sn-row" onClick=${() => setPlat(plat === p.platform ? '' : p.platform)} style=${plat === p.platform ? { background: 'rgba(143,182,255,.08)' } : null}><td>${PLAT_LABEL[p.platform] || p.platform}</td><td class="num">${p.n}</td><td><${Bar} score=${p.score} /></td></tr>`)}</tbody></table>
        <table class="sn-mini"><tbody>${(e.regions || []).map(r => html`<tr key=${r.region}><td>${REGION_LABEL[r.region] || r.region}</td><td class="num">${r.n}</td><td><${Bar} score=${r.score} /></td></tr>`)}</tbody></table>
      </div>
      <div class="sn-sub">The rows behind the numbers</div>
      <div class="sn-chips">${[['', 'All'], ['-1', 'Critical'], ['0', 'Neutral'], ['1', 'Supportive']].map(([v, l]) => html`<button key=${v} class=${'sn-chip' + (stance === v ? ' on' : '')} onClick=${() => setStance(v)}>${l}</button>`)}${plat ? html`<span class="sn-chip on" onClick=${() => setPlat('')} title="Clear the channel filter">${PLAT_LABEL[plat] || plat} x</span>` : null}</div>
      <${Evidence} items=${items} loading=${items === null} />
    </div>`;
  }

  function TopicDrawer({ t, f, onClose }) {
    const [items, setItems] = useState(null); const [stance, setStance] = useState('');
    useEffect(() => { setItems(null); if (t) call('/sentiment/items?issue=' + encodeURIComponent(t.id) + '&days=' + f.days + '&stance=' + stance + '&platform=' + encodeURIComponent(f.platform) + '&region=' + encodeURIComponent(f.region) + '&limit=80').then(d => setItems(d.items || [])).catch(() => setItems([])); }, [t && t.id, f.days, f.platform, f.region, stance]);
    if (!t) return null;
    return html`<div class="sn-drawer">
      <div class="sn-drawerhead"><div><div class="sn-drawertitle">${t.label}</div><div class="src-name"><div class="m">${t.client ? 'client issue, ' + t.client : 'issue'} / ${fmtN(t.n)} rows judged in ${f.days}d</div></div></div><button class="btn sm ghost" onClick=${onClose}>Close</button></div>
      <div class="sn-facts"><div><span class="k">Tone</span>${signed(t.tone)}</div><div><span class="k">Critical</span>${pct(t.neg, t.n)}%</div><div><span class="k">Supportive</span>${pct(t.pos, t.n)}%</div></div>
      ${(t.entities || []).length ? html`<div class="sn-sub">Named in these rows</div><table class="sn-mini"><tbody>${t.entities.map(e => html`<tr key=${e.id}><td>${e.name}</td><td class="num">${e.n}</td><td><${Bar} score=${e.score} /></td></tr>`)}</tbody></table>` : null}
      <div class="sn-sub">The rows behind the numbers</div>
      <div class="sn-chips">${[['', 'All'], ['-1', 'Hostile'], ['0', 'Neutral'], ['1', 'Warm']].map(([v, l]) => html`<button key=${v} class=${'sn-chip' + (stance === v ? ' on' : '')} onClick=${() => setStance(v)}>${l}</button>`)}</div>
      <${Evidence} items=${items} loading=${items === null} />
    </div>`;
  }

  /* The register: who we watch and the names they go by. */
  function Register({ canWrite, onChanged }) {
    const [list, setList] = useState(null); const [q, setQ] = useState(''); const [kind, setKind] = useState('');
    const [edit, setEdit] = useState(null); const [test, setTest] = useState({ text: '', hits: null });
    const [busy, setBusy] = useState(false);
    const load = useCallback(async () => { try { const d = await call('/entities'); setList(d.entities || []); } catch (e) { toastMsg(e.message, true); setList([]); } }, []);
    useEffect(() => { load(); }, [load]);
    const blank = { id: '', name: '', kind: 'person', aliases: '', party: '', role: '', side: 'neutral', ns: '', note: '', active: true };
    const save = async () => {
      setBusy(true);
      try { const body = Object.assign({}, edit, { aliases: String(edit.aliases || '').split(/[|\n,]/).map(s => s.trim()).filter(Boolean) }); await call(edit.isNew ? '/entities/add' : '/entities/update', body); toastMsg(edit.isNew ? 'Added' : 'Saved'); setEdit(null); await load(); onChanged(); }
      catch (e) { toastMsg(e.message, true); }
      setBusy(false);
    };
    const toggle = async (e) => { try { await call('/entities/update', { id: e.id, active: !e.active }); await load(); onChanged(); } catch (err) { toastMsg(err.message, true); } };
    const remove = async (e) => { if (!confirm('Delete ' + e.name + ' from the register? Past verdicts stay until they age out.')) return; try { await call('/entities/delete', { id: e.id }); toastMsg('Deleted'); await load(); onChanged(); } catch (err) { toastMsg(err.message, true); } };
    const syncMps = async () => { setBusy(true); try { const r = await call('/entities/sync-mps', {}); toastMsg(r.synced + ' members and senators in the register'); await load(); onChanged(); } catch (e) { toastMsg(e.message, true); } setBusy(false); };
    const runTest = async () => { try { const d = await call('/entities/test?text=' + encodeURIComponent(test.text)); setTest(Object.assign({}, test, { hits: d })); } catch (e) { toastMsg(e.message, true); } };
    const rows = (list || []).filter(e => (!kind || e.kind === kind) && (!q || (e.name + ' ' + e.id + ' ' + e.aliases.join(' ') + ' ' + e.role).toLowerCase().indexOf(q.toLowerCase()) >= 0));
    const field = (k, label, type) => html`<label>${label}${type === 'select-kind' ? html`<select value=${edit[k]} onChange=${ev => setEdit(Object.assign({}, edit, { [k]: ev.target.value }))}>${Object.keys(KIND_LABEL).map(x => html`<option key=${x} value=${x}>${KIND_LABEL[x]}</option>`)}</select>`
      : type === 'select-side' ? html`<select value=${edit[k]} onChange=${ev => setEdit(Object.assign({}, edit, { [k]: ev.target.value }))}><option value="neutral">Neutral</option><option value="client">Client</option><option value="opponent">Opponent</option></select>`
      : html`<input value=${edit[k]} onInput=${ev => setEdit(Object.assign({}, edit, { [k]: ev.target.value }))} placeholder=${type || ''} />`}</label>`;
    return html`<div>
      <div class="sn-filters">
        <input class="src-q" placeholder="Search name, alias or role" value=${q} onInput=${e => setQ(e.target.value)} />
        <select value=${kind} onChange=${e => setKind(e.target.value)}><option value="">Every kind</option>${Object.keys(KIND_LABEL).map(k => html`<option key=${k} value=${k}>${KIND_LABEL[k]}</option>`)}</select>
        <span class="src-count">${rows.length} of ${(list || []).length}</span>
        ${canWrite ? html`<button class="btn sm" onClick=${() => setEdit(Object.assign({ isNew: true }, blank))}>Add entity</button><button class="btn sm ghost" disabled=${busy} onClick=${syncMps} title="Every sitting member and senator from the MP register becomes a person entity under their own name">Sync MPs</button>` : null}
      </div>
      <div class="sn-filters"><input class="src-q" style=${{ flex: '1 1 420px' }} placeholder="Paste a sentence to see which entities it mentions" value=${test.text} onInput=${e => setTest({ text: e.target.value, hits: null })} onKeyDown=${e => { if (e.key === 'Enter') runTest(); }} /><button class="btn sm ghost" onClick=${runTest}>Test</button>${test.hits ? html`<span class="src-count">${test.hits.entities.length ? test.hits.entities.map(h => h.name).join(', ') : 'nothing matched'} / region ${REGION_LABEL[test.hits.region] || test.hits.region}</span>` : null}</div>
      ${edit ? html`<div class="sn-drawer" style=${{ position: 'static', marginBottom: 12 }}><div class="sn-drawertitle">${edit.isNew ? 'New entity' : 'Edit ' + edit.name}</div>
        <div class="sn-form">
          ${field('name', 'Name', 'Jim Chalmers')}${field('kind', 'Kind', 'select-kind')}
          <label class="wide">Aliases, one per line or comma-separated (plain words; plurals are implied)<textarea rows="3" value=${edit.aliases} onInput=${ev => setEdit(Object.assign({}, edit, { aliases: ev.target.value }))}></textarea></label>
          ${field('party', 'Party code (alp, lib, nat, grn, on, ind)', 'alp')}${field('role', 'Role', 'Treasurer')}${field('side', 'Side', 'select-side')}${field('ns', 'Client namespace (for a client or its opponent)', 'mca')}
          <label class="wide">Note<input value=${edit.note} onInput=${ev => setEdit(Object.assign({}, edit, { note: ev.target.value }))} /></label>
          <div class="wide src-btns"><button class="btn sm" disabled=${busy || !String(edit.name).trim()} onClick=${save}>${busy ? 'Saving...' : 'Save'}</button><button class="btn sm ghost" onClick=${() => setEdit(null)}>Cancel</button></div>
        </div></div>` : null}
      <div class="sn-tablewrap"><table class="sn-table sn-reg">
        <thead><tr><th>Entity</th><th>Kind</th><th>Aliases</th><th>Role</th><th class="num">Mentions, 7d</th><th>Net</th><th>${canWrite ? 'Actions' : ''}</th></tr></thead>
        <tbody>${rows.map(e => html`<tr key=${e.id} class=${'sn-row' + (e.active ? '' : ' off')} style=${e.active ? null : { opacity: .55 }}>
          <td class="sn-name"><div class="n"><${Dot} party=${e.party} />${e.name}<${Kind} e=${e} /></div><div class="m">${e.id}${e.source === 'mps' ? ' / from the MP register' : e.edited ? ' / edited' : ''}</div></td>
          <td>${KIND_LABEL[e.kind] || e.kind}</td>
          <td><div class="al">${e.aliases.join(' / ')}</div></td>
          <td>${e.role}</td>
          <td class="num">${fmtN(e.mentions7 || 0)}</td>
          <td>${e.mentions7 ? html`<${Bar} score=${e.score7} />` : null}</td>
          <td>${canWrite ? html`<div class="src-btns" style=${{ marginTop: 0 }}><button class="btn sm ghost" onClick=${() => setEdit(Object.assign({}, e, { aliases: e.aliases.join('\n') }))}>Edit</button><button class="btn sm ghost" onClick=${() => toggle(e)}>${e.active ? 'Off' : 'On'}</button><button class="btn sm ghost" onClick=${() => remove(e)}>Delete</button></div>` : null}</td>
        </tr>`)}</tbody>
      </table>${list && !rows.length ? html`<div class="empty" style=${{ padding: '20px 0' }}>Nothing matches.</div>` : null}</div>
    </div>`;
  }

  function SentimentApp() {
    const [status, setStatus] = useState(null);
    const [f, setF] = useState({ days: 7, platform: '', region: '', issue: '', kind: '' });
    const [sort, setSort] = useState('n');
    const [board, setBoard] = useState(null);
    const [topics, setTopics] = useState(null);
    const [pick, setPick] = useState('');
    const [topic, setTopic] = useState(null);
    const [showReg, setShowReg] = useState(false);
    const [job, setJob] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const stopRef = useRef(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const loadStatus = useCallback(async () => { try { setStatus(await call('/sentiment/status')); setErr(''); } catch (e) { setErr(e.message); } }, []);
    const load = useCallback(async () => {
      const qs = '?days=' + f.days + '&platform=' + encodeURIComponent(f.platform) + '&region=' + encodeURIComponent(f.region) + '&issue=' + encodeURIComponent(f.issue);
      try { const [b, t] = await Promise.all([call('/sentiment/entities' + qs + '&kind=' + encodeURIComponent(f.kind)), call('/sentiment/topics' + qs)]); setBoard(b.entities || []); setTopics(t.topics || []); setErr(''); }
      catch (e) { setErr(e.message); }
    }, [f.days, f.platform, f.region, f.issue, f.kind]);
    useEffect(() => { loadStatus(); return () => { if (stopRef.current) stopRef.current(); }; }, [loadStatus]);
    useEffect(() => { load(); }, [load]);
    const list = useMemo(() => {
      const by = { n: (a, b) => b.n - a.n, score: (a, b) => a.score - b.score, neg: (a, b) => (pct(b.neg, b.n) - pct(a.neg, a.n)) || (b.n - a.n), pos: (a, b) => (pct(b.pos, b.n) - pct(a.pos, a.n)) || (b.n - a.n), change: (a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0), name: (a, b) => a.name.localeCompare(b.name) };
      return (board || []).slice().sort(by[sort] || by.n);
    }, [board, sort]);
    const picked = pick ? (board || []).find(e => e.id === pick) : null;
    const run = async () => {
      setBusy(true);
      try {
        const d = await call('/sentiment/run', { limit: 100 });
        if (stopRef.current) stopRef.current();
        setJob({ id: d.job, status: 'running', lines: [] });
        stopRef.current = tailJob(d.job, j => setJob(j), j => { setJob(j); setBusy(false); loadStatus(); load(); });
      } catch (e) { toastMsg(e.message, true); setBusy(false); }
    };
    if (err && !board) return html`<div class="aud-notice" style=${{ margin: '12px 0' }}><b>Could not load sentiment.</b> ${err}</div>`;
    return html`<div>
      <${Strip} status=${status} onRun=${run} busy=${busy} canWrite=${canWrite} onRegister=${() => setShowReg(!showReg)} showReg=${showReg} />
      ${job ? html`<${Console} job=${job} title="classify" />` : null}
      ${status && !status.configured ? html`<div class="aud-notice" style=${{ margin: '6px 0 12px' }}><b>The classifier is Claude and ANTHROPIC_API_KEY is not set on the worker.</b> The register and the first pass work; verdicts need the key.</div>` : null}
      ${showReg ? html`<${Register} canWrite=${canWrite} onChanged=${() => { loadStatus(); load(); }} />` : html`
        <${Filters} f=${f} setF=${setF} count=${list.length} />
        <div class=${'sn-main' + (picked || topic ? ' split' : '')}>
          <div>
            ${board === null ? html`<div class="empty" style=${{ padding: '30px 0' }}>Loading...</div>` : html`<${Leaderboard} list=${list} sort=${sort} setSort=${setSort} pick=${pick} onPick=${id => { setTopic(null); setPick(id === pick ? '' : id); }} />`}
            <${Topics} topics=${topics} onPick=${t => { setPick(''); setTopic(topic && topic.id === t.id ? null : t); }} />
          </div>
          ${picked ? html`<${Drawer} e=${picked} f=${f} onClose=${() => setPick('')} />` : topic ? html`<${TopicDrawer} t=${topic} f=${f} onClose=${() => setTopic(null)} />` : null}
        </div>`}
    </div>`;
  }

  let mounted = false;
  window.sentimentInit = function () {
    const root = document.getElementById('sentiment-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${SentimentApp} />`); }
  };
})();
