/* AXIOM - the front page. Three questions, answered from what the other
 * modules already keep: what changed in the window, why it matters (which
 * client, which issue), and where the evidence is (every row opens the view
 * that holds it). A React island mounted into #overview-root. */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.overviewInit = function () {
      const root = document.getElementById('overview-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, blobUrl, toastMsg, fmtN, ago, goto, useScope } = window.AXUI;
  const { useState, useEffect, useCallback } = React;
  const canWrite = () => !(window.AX_ROLE === 'read');
  const PLAT = { news: 'News', reddit: 'Reddit', x: 'X', bluesky: 'Bluesky', mastodon: 'Mastodon', youtube: 'YouTube', substack: 'Substack', linkedin: 'LinkedIn', meta: 'Facebook', forum: 'Forums' };
  const fmtAest = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const aest = ts => (ts ? fmtAest.format(new Date(+ts)) : '');
  const pct = (a, n) => (n ? Math.round(a / n * 100) : 0);
  const signed = v => (v == null ? '' : (v > 0 ? '+' : '') + (Math.round(v * 100) / 100).toFixed(2));
  const pace = n => (n.nprev ? n.velocity + 'x' : n.n24 ? 'new' : 'quiet');
  const SIDE = { hostile: 'hostile', supportive: 'supportive', mixed: 'mixed', unknown: 'unread' };

  function Sec({ title, why, count, children }) {
    return html`<section class="ov-sec">
      <div class="ov-sechead"><span class="ov-title">${title}</span>${count != null ? html`<span class="ov-count">${count}</span>` : null}${why ? html`<span class="ov-why">${why}</span>` : null}</div>
      ${children}
    </section>`;
  }
  const Empty = ({ children }) => html`<div class="ov-empty">${children}</div>`;
  const Link = ({ onClick, children, title }) => html`<button class="ov-link" onClick=${onClick} title=${title || ''}>${children}</button>`;
  function Split({ s }) {
    if (!s || !s.judged) return html`<span class="ov-dim">unjudged</span>`;
    const neg = pct(s.neg, s.judged), pos = pct(s.pos, s.judged);
    return html`<span class="nr-split" title=${s.neg + ' hostile, ' + s.neu + ' neutral, ' + s.pos + ' warm of ' + s.judged}><i style=${{ width: neg + '%', background: 'var(--x-neg)' }}></i><i style=${{ width: (100 - neg - pos) + '%', background: 'rgba(255,255,255,.14)' }}></i><i style=${{ width: pos + '%', background: 'var(--x-pos)' }}></i></span>`;
  }

  function Alerts({ a }) {
    const rows = a.open.length ? a.open : a.recent.slice(0, 3);
    return html`<${Sec} title=${a.open.length ? 'Needs a response' : 'Sentinel'} count=${a.open.length || null} why="Coverage of a client issue spiked against its own fourteen-day baseline">
      ${!rows.length ? html`<${Empty}>No spike on any client issue in the last seven days.</${Empty}>` : html`<table class="ov-table"><tbody>${rows.map(r => html`<tr key=${r.id} class=${r.open ? 'hot' : ''}>
        <td class="ov-when">${ago(r.detected)} ago</td>
        <td><b>${r.label}</b><span class="ov-dim"> ${r.client || r.ns}</span></td>
        <td class="num"><b>${r.ratio}x</b><span class="ov-dim"> baseline</span></td>
        <td class="num">${r.hot}<span class="ov-dim"> stories, ${r.srcs} outlets</span></td>
        <td class="ov-dim">${r.open ? 'awaiting acknowledgement' : r.drafted ? 'drafted' : 'acknowledged'}</td>
        <td class="ov-go"><${Link} onClick=${() => goto('sentinel', { id: r.id })}>open</${Link}></td>
      </tr>`)}</tbody></table>`}
    </${Sec}>`;
  }
  function Narratives({ n, hours }) {
    return html`<${Sec} title="Narratives moving" count=${n.moving.length || null} why=${n.live + ' live, ' + n.emerging + ' emerging, ' + n.growing + ' growing; ' + fmtN(n.placed24) + ' rows placed today'}>
      ${n.error ? html`<${Empty}>${n.error}</${Empty}>` : !n.moving.length ? html`<${Empty}>No narrative gained rows in the last ${hours} hours.${n.backlog ? ' ' + fmtN(n.backlog) + ' rows wait to be placed.' : ''}</${Empty}>` : html`<table class="ov-table">
        <thead><tr><th>Narrative</th><th>Client</th><th class="num">Rows</th><th class="num">24h vs before</th><th>Toward client</th><th>Split</th><th>First seen</th><th>Status</th><th></th></tr></thead>
        <tbody>${n.moving.map(x => html`<tr key=${x.id}>
          <td class="ov-lbl">${x.label ? html`<b>${x.label}</b>` : html`<i>unnamed, ${x.n} rows</i>`}${x.proponents ? html`<div class="ov-dim">${x.proponents}</div>` : null}</td>
          <td>${x.client || html`<span class="ov-dim">-</span>`}<div class="ov-dim">${(x.issueLabels || []).join(', ')}</div></td>
          <td class="num">${fmtN(x.n)}</td>
          <td class="num"><b>${x.n24}</b><span class="ov-dim"> vs ${x.nprev}</span> <span class=${'ov-pace' + (x.nprev && x.velocity >= 2 ? ' up' : '')}>${pace(x)}</span></td>
          <td><span class=${'nr-side ' + x.side}>${SIDE[x.side] || x.side}</span></td>
          <td><${Split} s=${x.sentiment} /></td>
          <td class="ov-dim">${(PLAT[x.first_platform] || x.first_platform || '?') + (x.first_channel ? ' ' + x.first_channel : '')}, ${ago(x.first_ts)} ago</td>
          <td><span class=${'nr-status ' + x.status}>${x.status}</span></td>
          <td class="ov-go"><${Link} onClick=${() => goto('narratives', { id: x.id })}>rows</${Link}></td>
        </tr>`)}</tbody></table>`}
      ${n.fading.length ? html`<div class="ov-foot">Fading: ${n.fading.map((x, i) => html`<span key=${x.id}>${i ? ', ' : ''}<${Link} onClick=${() => goto('narratives', { id: x.id })}>${x.label || 'unnamed'}</${Link}> (${x.n})</span>`)}</div>` : null}
    </${Sec}>`;
  }
  function Movers({ s, days }) {
    const win = days >= 2 ? days + ' days' : '24 hours';
    return html`<${Sec} title="Who moved" count=${s.movers.length || null} why=${'Net stance now against the ' + win + ' before; ' + fmtN(s.judged24) + ' rows judged today'}>
      ${!s.configured ? html`<${Empty}>The classifier needs ANTHROPIC_API_KEY on the worker; the register and the first pass work, verdicts wait.</${Empty}>` : null}
      ${s.error ? html`<${Empty}>${s.error}</${Empty}>` : !s.movers.length && !s.loudest.length ? html`<${Empty}>No entity has enough judged mentions in this window yet.${s.backlog ? ' ' + fmtN(s.backlog) + ' matched rows wait for a verdict.' : ''}</${Empty}>` : html`<div class="ov-cols">
        <table class="ov-table"><thead><tr><th>Moved most</th><th class="num">Mentions</th><th class="num">Net stance</th><th class="num">Change</th><th></th></tr></thead>
          <tbody>${(s.movers.length ? s.movers : s.loudest).map(e => html`<tr key=${e.id}>
            <td><b>${e.name}</b><span class="ov-dim"> ${e.kind}${e.party ? ', ' + e.party.toUpperCase() : ''}${e.side === 'client' ? ', client' : e.side === 'opponent' ? ', opponent' : ''}</span></td>
            <td class="num">${fmtN(e.n)}</td>
            <td class=${'num ' + (e.score < -0.2 ? 'neg' : e.score > 0.2 ? 'pos' : '')}>${signed(e.score)}</td>
            <td class=${'num ' + (e.change < -0.1 ? 'neg' : e.change > 0.1 ? 'pos' : '')}>${e.change == null ? html`<span class="ov-dim">new</span>` : signed(e.change)}</td>
            <td class="ov-go"><${Link} onClick=${() => goto('sentiment', { id: e.id })}>rows</${Link}></td>
          </tr>`)}</tbody></table>
        ${s.hostileTo.length ? html`<table class="ov-table"><thead><tr><th>Our clients and their issues</th><th class="num">Mentions</th><th class="num">Net stance</th><th class="num">Critical</th><th></th></tr></thead>
          <tbody>${s.hostileTo.map(e => html`<tr key=${e.id}>
            <td><b>${e.name}</b><span class="ov-dim"> ${e.kind}</span></td>
            <td class="num">${fmtN(e.n)}</td>
            <td class=${'num ' + (e.score < -0.2 ? 'neg' : e.score > 0.2 ? 'pos' : '')}>${signed(e.score)}</td>
            <td class="num">${pct(e.neg, e.n)}%</td>
            <td class="ov-go"><${Link} onClick=${() => goto('sentiment', { id: e.id })}>rows</${Link}></td>
          </tr>`)}</tbody></table>` : null}
      </div>`}
    </${Sec}>`;
  }
  function Issues({ issues, hours, totals }) {
    const max = Math.max(1, ...issues.map(i => Math.max(i.recent, i.base)));
    return html`<${Sec} title="Our issues against their own baseline" why=${fmtN(totals.rows) + ' rows on client issues in ' + hours + 'h, ' + fmtN(totals.news) + ' of them news; the bar is this window, the mark is the usual'}>
      <table class="ov-table ov-issues"><thead><tr><th>Issue</th><th>Client</th><th class="num">Rows</th><th class="num">Usual</th><th>Against usual</th><th class="num">Ratio</th><th></th></tr></thead>
        <tbody>${issues.map(i => html`<tr key=${i.id} class=${i.ratio != null && i.ratio >= 2 && i.recent >= 3 ? 'hot' : ''}>
          <td><b>${i.label}</b></td>
          <td class="ov-dim">${i.client}</td>
          <td class="num">${i.recent}<span class="ov-dim"> (${i.news} news)</span></td>
          <td class="num ov-dim">${i.base}</td>
          <td class="ov-barcell"><span class="ov-bar"><i style=${{ width: Math.round(i.recent / max * 100) + '%' }}></i><b style=${{ left: Math.round(i.base / max * 100) + '%' }}></b></span></td>
          <td class=${'num ' + (i.ratio != null && i.ratio >= 2 ? 'neg' : '')}>${i.ratio == null ? (i.recent ? 'new' : '-') : i.ratio + 'x'}</td>
          <td class="ov-go"><${Link} onClick=${() => goto('narratives', { issue: i.id })}>narratives</${Link}> <${Link} onClick=${() => goto('sentiment', { issue: i.id })}>stances</${Link}></td>
        </tr>`)}</tbody></table>
    </${Sec}>`;
  }
  function Collection({ c, n, s }) {
    const src = c.sources;
    return html`<${Sec} title="Collection" why="What the machine read and judged; every figure opens its view">
      <div class="ov-lines">
        <div><${Link} onClick=${() => goto('sources', {})}><b>${src.delivering}</b> sources delivering</${Link}>, ${fmtN(src.items24)} items in 24h${src.dead ? html`, <span class="neg">${src.dead} dead</span>` : ''}${src.failing ? ', ' + src.failing + ' failing' : ''}${src.unverified ? ', ' + src.unverified + ' not yet tried' : ''}${src.lastSweep ? html`<span class="ov-dim"> - last sweep ${ago(src.lastSweep.at)} ago, ${src.lastSweep.succeeded} of ${src.lastSweep.ran} delivered</span>` : ''}</div>
        <div><${Link} onClick=${() => goto('sentiment', {})}><b>${fmtN(s.judged24)}</b> rows judged today</${Link}>${s.budget ? html`<span class="ov-dim">, ${s.budget.used} of ${s.budget.cap} calls spent</span>` : ''}${s.backlog ? ', ' + fmtN(s.backlog) + ' waiting' : ''}</div>
        <div><${Link} onClick=${() => goto('narratives', {})}><b>${fmtN(n.placed24)}</b> rows placed into narratives today</${Link}>, ${n.live} live${n.backlog ? ', ' + fmtN(n.backlog) + ' waiting' : ''}</div>
        ${c.social.length ? html`<div><${Link} onClick=${() => goto('signals', {})}>Social</${Link}>: ${c.social.map((p, i) => html`<span key=${p.platform} class=${p.ok ? '' : 'neg'}>${i ? ', ' : ''}${PLAT[p.platform] || p.platform}${p.filed != null ? ' ' + fmtN(p.filed) : ''}${p.ok ? '' : ' (' + (p.error || 'failed') + ')'}</span>`)}</div>` : null}
      </div>
    </${Sec}>`;
  }
  function Latest({ rows, hours }) {
    const issues = typeof AX_ISSUES !== 'undefined' && Array.isArray(AX_ISSUES) ? AX_ISSUES : [];
    const lbl = id => { const i = issues.find(x => x.id === id); return i ? (i.label || id) : id; };
    return html`<${Sec} title="Latest on our issues" count=${rows.length || null} why="Newest first, Australian Eastern">
      ${!rows.length ? html`<${Empty}>Nothing tagged with a client issue in the last ${hours} hours.</${Empty}>` : html`<div class="ov-latest">${rows.map(r => html`<div key=${r.id} class="ov-row">
        <span class="ov-when" title=${aest(r.ts)}>${ago(r.ts)}</span>
        <span class="ov-chan">${PLAT[r.platform] || r.platform}${r.channel && r.channel !== r.platform ? html`<i> ${r.channel}</i>` : null}</span>
        <span class="ov-tx">${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.title}</a>` : r.title}</span>
        <span class="ov-tags">${r.issues.map(i => html`<em key=${i}>${lbl(i)}</em>`)}${r.tone != null && r.tone !== 0 ? html`<span class=${'sn-st ' + (r.tone < 0 ? 'neg' : 'pos')}>${r.tone < 0 ? 'hostile' : 'warm'}</span>` : null}${r.comments ? html`<span class="ov-dim">${fmtN(r.comments)} comments</span>` : null}</span>
      </div>`)}</div>`}
    </${Sec}>`;
  }

  /* One evidence id from the brief - N a narrative, E an entity, I an issue, A an alert, L a headline - as a link into the view that holds it. */
  function Ev({ ids }) {
    if (!ids || !ids.length) return null;
    const open = id => { const k = id.slice(0, 1).toUpperCase(), v = id.slice(2); if (k === 'N') goto('narratives', { id: v }); else if (k === 'E') goto('sentiment', { id: v }); else if (k === 'I') goto('narratives', { issue: v }); else if (k === 'A') goto('sentinel', { id: v }); };
    return html`<span class="ov-ev">${ids.map(id => (/^[NEIA]:/i.test(id) ? html`<button key=${id} class="ov-evid" title=${'open ' + id} onClick=${() => open(id)}>${id}</button>` : html`<span key=${id} class="ov-evid dim">${id}</span>`))}</span>`;
  }
  const Bul = ({ title, items }) => (items && items.length ? html`<div class="ov-bul"><span class="ov-bul-t">${title}</span><ul>${items.map((x, i) => html`<li key=${i}>${x}</li>`)}</ul></div>` : null);
  /* The day's brief: what the director reads first. Written by Claude from what the other
     sections hold, once a morning by the cron or on demand here after the queues are drained. */
  function Brief({ days }) {
    const [b, setB] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState('');
    const [open, setOpen] = useState(true);
    const load = useCallback(async () => { try { setB(await call('/brief/daily')); setErr(''); } catch (e) { setB(null); setErr(e.code === 'no_brief' ? '' : e.message); } }, []);
    useEffect(() => { load(); }, [load]);
    const write = async () => {
      setBusy(true); setNote('Gathering the evidence and writing; this takes a minute or two. The result replaces today\'s brief.');
      try { const d = await call('/brief/daily', { days: days || 1 }); setB(d); setOpen(true); setNote(''); toastMsg('Brief written: ' + d.brief.headline); }
      catch (e) { setNote(''); toastMsg(e.message, true); }
      setBusy(false);
    };
    const download = async () => {
      try { const u = await blobUrl('/brief/daily?day=' + b.day + '&format=md'); const a = document.createElement('a'); a.href = u; a.download = 'axiom-brief-' + b.day + '.md'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 5000); }
      catch (e) { toastMsg(e.message, true); }
    };
    const copy = async () => { try { await navigator.clipboard.writeText(b.md || ''); toastMsg('Brief copied as Markdown'); } catch (e) { toastMsg('Copy failed', true); } };
    const w = canWrite();
    const br = b && b.brief;
    return html`<div class="ov-brief">
      <div class="ov-sechead">
        <span class="ov-title">${b ? (b.isToday ? 'Today\'s brief' : 'Latest brief') : 'Daily brief'}</span>
        ${b ? html`<span class="ov-count">${b.day}</span><span class="ov-why">written ${ago(b.at)} ago by ${b.by === 'cron' ? 'the morning run' : b.by}, ${b.model}${b.mind ? ', filed in the Mind' : ''}</span>` : html`<span class="ov-why">${err || 'No brief has been written yet. The morning run writes one after 7am Sydney; write one now once the queues are drained.'}</span>`}
        <span class="ov-brief-acts">
          ${b ? html`<button class="btn sm ghost" onClick=${() => setOpen(!open)}>${open ? 'Fold' : 'Unfold'}</button><button class="btn sm ghost" onClick=${copy} title="Copy the brief as Markdown">Copy</button><button class="btn sm ghost" onClick=${download} title="Save the brief as a Markdown file">Download .md</button>` : null}
          ${w ? html`<button class="btn sm" disabled=${busy} onClick=${write} title="Gather today's evidence and have Claude write the brief; replaces today's">${busy ? 'Writing...' : b && b.isToday ? 'Rewrite today\'s brief' : 'Write today\'s brief'}</button>` : null}
        </span>
      </div>
      ${note ? html`<div class="ov-empty">${note}</div>` : null}
      ${br && open ? html`<div class="ov-brief-body">
        <h3 class="ov-brief-h">${br.headline}</h3>
        <p class="ov-brief-sum">${br.summary}</p>
        ${br.changed.length ? html`<div class="ov-brief-sec"><span class="ov-bul-t">What changed</span><ul class="ov-changed">${br.changed.map((c, i) => html`<li key=${i}><b>${c.what}</b> ${c.why} <${Ev} ids=${c.evidence} /></li>`)}</ul></div>` : null}
        ${br.clients.length ? html`<div class="ov-brief-sec"><span class="ov-bul-t">By client</span><table class="ov-table ov-clients"><tbody>${br.clients.map(c => html`<tr key=${c.ns}>
          <td class="ov-lbl"><b>${c.client}</b><div class="ov-dim">${c.ns}</div></td>
          <td>${c.read} <${Ev} ids=${c.evidence} />
            <div class="ov-cols3"><${Bul} title="Watch" items=${c.watch} /><${Bul} title="Risks" items=${c.risks} /><${Bul} title="Openings" items=${c.openings} /></div></td>
          <td class="ov-acts"><${Bul} title="Actions" items=${c.actions} /></td>
        </tr>`)}</tbody></table></div>` : null}
        <div class="ov-cols">
          ${br.narratives.length ? html`<table class="ov-table"><thead><tr><th>Narratives to watch</th><th class="num">Rows</th><th>Toward client</th><th>Why it matters</th><th></th></tr></thead><tbody>${br.narratives.map(n => html`<tr key=${n.id}>
            <td><b>${n.label}</b>${n.client ? html`<div class="ov-dim">${n.client}</div>` : null}</td><td class="num">${fmtN(n.n)}<span class="ov-dim"> (${n.n24 || 0} today)</span></td><td><span class=${'nr-side ' + n.stance}>${SIDE[n.stance] || n.stance}</span></td><td>${n.why}</td>
            <td class="ov-go"><${Link} onClick=${() => goto('narratives', { id: n.id })}>rows</${Link}></td></tr>`)}</tbody></table>` : null}
          ${br.sentiment.length ? html`<table class="ov-table"><thead><tr><th>Stances that moved</th><th class="num">Mentions</th><th class="num">Net</th><th class="num">Change</th><th>Why</th><th></th></tr></thead><tbody>${br.sentiment.map(s => html`<tr key=${s.id}>
            <td><b>${s.name}</b><div class="ov-dim">${s.direction}</div></td><td class="num">${fmtN(s.n)}</td><td class=${'num ' + (s.score < -0.2 ? 'neg' : s.score > 0.2 ? 'pos' : '')}>${signed(s.score)}</td><td class=${'num ' + (s.change < -0.1 ? 'neg' : s.change > 0.1 ? 'pos' : '')}>${s.change == null ? html`<span class="ov-dim">new</span>` : signed(s.change)}</td><td>${s.why}</td>
            <td class="ov-go"><${Link} onClick=${() => goto('sentiment', { id: s.id })}>rows</${Link}></td></tr>`)}</tbody></table>` : null}
        </div>
        <div class="ov-cols3 ov-brief-foot"><${Bul} title="Risks" items=${br.risks} /><${Bul} title="Actions" items=${br.actions} /><${Bul} title="Gaps in the evidence" items=${br.gaps} /></div>
      </div>` : null}
    </div>`;
  }

  function OverviewApp() {
    const [days, setDays] = useState(1);
    const [d, setD] = useState(null);
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [sc, setSc] = useState({ ns: '', issue: '' });
    const load = useCallback(async () => { setBusy(true); try { const r = await call('/overview?days=' + days); if (!r || !r.alerts || !r.narratives || !r.sentiment) throw new Error('the worker answered without the overview parts; redeploy it'); setD(r); setErr(''); } catch (e) { setErr(e.message); } setBusy(false); }, [days]);
    useEffect(() => { load(); const t = setInterval(load, 5 * 60000); return () => clearInterval(t); }, [load]);
    useScope(s => { setSc({ ns: s.ns || '', issue: s.issue || '' }); if (s.days) setDays(Math.min(7, s.days)); });
    if (err && !d) return html`<div class="aud-notice" style=${{ margin: '12px 0' }}><b>Could not read the overview.</b> ${err}</div>`;
    if (!d) return html`<div class="empty" style=${{ padding: '30px 0' }}>Reading what changed...</div>`;
    /* The scope narrows the parts that carry a client or an issue; stances are per entity and stay whole. */
    const inScope = (ns, issues) => (!sc.ns || ns === sc.ns) && (!sc.issue || (issues || []).indexOf(sc.issue) >= 0);
    const issueNs = id => { const i = d.issues.find(x => x.id === id); return i ? i.ns : ''; };
    const scoped = !sc.ns && !sc.issue ? d : Object.assign({}, d, {
      alerts: Object.assign({}, d.alerts, { open: d.alerts.open.filter(a => inScope(a.ns, [a.issue])), recent: d.alerts.recent.filter(a => inScope(a.ns, [a.issue])) }),
      narratives: Object.assign({}, d.narratives, { moving: d.narratives.moving.filter(n => inScope(n.ns, n.issues)), fading: d.narratives.fading.filter(n => inScope(n.ns, n.issues)) }),
      issues: d.issues.filter(i => inScope(i.ns, [i.id])),
      latest: d.latest.filter(r => (!sc.ns || (r.issues || []).map(issueNs).indexOf(sc.ns) >= 0) && (!sc.issue || (r.issues || []).indexOf(sc.issue) >= 0)),
    });
    const scopeWords = [sc.ns ? ((d.issues.find(i => i.ns === sc.ns) || {}).client || sc.ns) : '', sc.issue ? ((d.issues.find(i => i.id === sc.issue) || {}).label || sc.issue) : ''].filter(Boolean).join(' / ');
    return html`<div class="ovpage">
      <div class="ov-head">
        <span class="ov-scope">What changed in the last <select value=${days} onChange=${e => setDays(+e.target.value)} aria-label="Window"><option value="0.25">6 hours</option><option value="1">24 hours</option><option value="3">3 days</option><option value="7">7 days</option></select> to ${aest(d.at)} AEST${scopeWords ? html`<span class="ov-scoped">, scoped to ${scopeWords}</span>` : null}</span>
        <span class="ov-dim">${d.errors && d.errors.length ? d.errors.length + ' part' + (d.errors.length === 1 ? '' : 's') + ' failed: ' + d.errors.join('; ') : ''}</span>
        <button class="btn sm ghost" disabled=${busy} onClick=${load}>${busy ? 'Reading...' : 'Refresh'}</button>
      </div>
      <${Brief} days=${days} />
      <${Alerts} a=${scoped.alerts} />
      <${Narratives} n=${scoped.narratives} hours=${d.hours} />
      <${Movers} s=${d.sentiment} days=${d.days} />
      <${Issues} issues=${scoped.issues} hours=${d.hours} totals=${d.totals} />
      <${Latest} rows=${scoped.latest} hours=${d.hours} />
      <${Collection} c=${d.collection} n=${d.narratives} s=${d.sentiment} />
    </div>`;
  }

  let mounted = false;
  window.overviewInit = function () {
    const root = document.getElementById('overview-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${OverviewApp} />`); }
  };
  /* The command view is on at load and go() is not called for it, so mount
     once the page's own script has run (it defines the worker url and the key). */
  const boot = () => { const v = document.getElementById('v-command'); if (v && v.classList.contains('on')) window.overviewInit(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
