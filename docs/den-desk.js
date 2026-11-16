/* AXIOM - Anne's Den: Watch (the register and its proposals), Collection and Options. Split out of docs/den.js (release r52, 16 November 2026) so
 * that the Den's parts can each have one writer. A factory: docs/den.js calls window.__DEN_PARTS.desk(D) once at load with
 * its shared names (D grows only by a name added in den.js) and takes the components it returns. Loaded before den.js
 * (docs/index.html), so den.js finds it; React and htm come from docs/vendor, the shared pieces through D. */
window.__DEN_PARTS = window.__DEN_PARTS || {};
window.__DEN_PARTS.desk = function (D) {
  'use strict';
  const {
    html, call, own, hdrs, toastMsg, fmtN, Console, tailJob, useGoto, canWriteNow, TABS, CH, SIG, ASIDE, fmtAest,
    fmtDay, aest, since, ls, say, web, q, BUSY_WAITS, get, getText, useLoad, Loading, Failed, Empty, Boundary, Panel,
    Dialog, engText, tell, openEvidence, KINDS_ROW, fbTotal, sydDay, sydOffset, dayEnd, dayWords, BUDGET_T, wc, plural,
    toCards, sigsFor, weigh, LOW, deck, byWeight, covered, secOfKind, KIND_SEC, sigSec, secState, secKey, citeOf,
    STRIP_PENDING, CHECKS, Strip, RowActions, layerTitle, Card, Board
  } = D;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  /* ---- Watch: the register and the proposals that wait for a person ---- */
  const KINDS = [['proposed', 'Proposals'], ['term', 'Terms'], ['hashtag', 'Hashtags'], ['account', 'Accounts'], ['group', 'Groups'], ['source', 'Outlets'], ['dismissed', 'Dismissed']];
  function Proposal({ p, desk, canWrite, onDone }) {
    const [mode, setMode] = useState(''); const [issue, setIssue] = useState(p.issue || (desk.issues[0] || {}).id || ''); const [why, setWhy] = useState(''); const [prev, setPrev] = useState(null); const [busy, setBusy] = useState(false);
    const decide = async body => { setBusy(true); try { const d = await call('/den/watch/decide', Object.assign({ id: p.id }, body)); if (d.note) toastMsg(d.note); onDone(); } catch (e) { toastMsg(say(e), true); } setBusy(false); };
    const preview = async () => { if (prev) return setPrev(null); setBusy(true); try { setPrev(await call('/den/preview?' + q({ ns: desk.ns, term: p.value }))); } catch (e) { toastMsg(say(e), true); } setBusy(false); };
    return html`<tr class="den-row"><td><span class="den-chip">${p.kind}${p.kind === 'account' || p.kind === 'group' ? ' on ' + (CH[p.platform] || p.platform) : ''}</span></td>
      <td><span class="den-t">${p.kind === 'hashtag' ? '#' : ''}${p.value}</span><span class="den-sub">${p.reason || (p.source === 'reports' ? 'From the reports.' : '')}</span>
        ${(p.evidence || []).length ? html`<ul class="den-ev">${p.evidence.slice(0, 5).map((e, i) => html`<li key=${i}>${e.label ? html`<b>${e.label}</b> (${e.rows} rows)` : e.text} ${web(e.url) ? html`<a class="den-link" href=${web(e.url)} target="_blank" rel="noopener" aria-label="Open this evidence row">open</a>` : null}</li>`)}</ul>` : null}
        ${prev ? html`<div class="den-notice den-mt"><b>In the last ${prev.days} days:</b> ${prev.matched} row${prev.matched === 1 ? '' : 's'} carry it; ${prev.already} already on this desk; it would add ${prev.new}${prev.new ? ' (' + Object.keys(prev.byChannel).map(k => prev.byChannel[k] + ' ' + (CH[k] || k)).join(', ') + '), of which ' + prev.australian + ' say something Australian' : ''}. ${prev.note}
          ${prev.sample.length ? html`<ul class="den-ev">${prev.sample.slice(0, 8).map(x => html`<li key=${x.id}>${x.australian ? '' : html`<span class="den-chip warn">not Australian</span> `}${x.text}</li>`)}</ul>` : null}</div>` : null}
        ${mode === 'approve' ? html`<div class="den-form den-mt">${p.kind === 'term' ? html`<label class="den-lab">Files under<select value=${issue} onChange=${e => setIssue(e.target.value)}>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}<option value="">no issue (searched for only)</option></select></label>` : null}
          <button class="den-mini primary" disabled=${busy} onClick=${() => decide(Object.assign({ decision: 'approve' }, p.kind === 'term' ? { issue } : {}))}>Approve</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button><span class="den-sub">${p.kind === 'term' ? 'It joins what every collector searches for and how new rows are filed. It never changes what counts as a spike.' : 'Collectors read it from the next sweep.'}</span></div>` : null}
        ${mode === 'dismiss' ? html`<div class="den-form den-mt"><label class="den-lab den-grow">Why (it is never proposed again)<input value=${why} maxlength="300" onInput=${e => setWhy(e.target.value)} /></label><button class="den-mini danger" disabled=${busy || why.trim().length < 3} onClick=${() => decide({ decision: 'dismiss', reason: why })}>Dismiss</button><button class="den-mini" onClick=${() => setMode('')}>Cancel</button></div>` : null}</td>
      <td class="num">${p.score ? Math.round(p.score) : '-'}</td>
      <td class="act">${p.kind === 'term' ? html`<button class="den-mini" disabled=${busy} aria-expanded=${prev ? 'true' : 'false'} title="What it would have caught in what is already held. Free." onClick=${preview}>Preview</button> ` : null}${canWrite && !mode ? html`<button class="den-mini" onClick=${() => setMode('approve')}>Approve</button> <button class="den-mini" onClick=${() => setMode('dismiss')}>Dismiss</button>` : null}</td></tr>`;
  }
  function WatchPanel({ desk, tick, bump, canWrite }) {
    const [kind, setKind] = useState('proposed'); const [busy, setBusy] = useState(''); const [found, setFound] = useState(null); const [del, setDel] = useState(null); const [add, setAdd] = useState({ kind: 'term', platform: 'x', value: '', name: '', actor_kind: '', issue: '' });
    const W = useLoad(() => get('/den/watch?' + q({ ns: desk.ns }), 'watch'), [desk.ns, tick], desk.ns);
    const X = useLoad(() => get('/den/lexicon?' + q({ ns: desk.ns, review: 1 }), 'terms'), [desk.ns, tick], desk.ns);
    const T = useLoad(() => get('/den/themes?' + q({ ns: desk.ns }), 'themes'), [desk.ns, tick], desk.ns);
    const act = async (name, fn) => { setBusy(name); try { await fn(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const discover = () => act('discover', async () => { const d = await call('/den/discover', { ns: desk.ns }); setFound(d); W.reload(); });
    const themes = () => act('themes', async () => { await call('/den/themes', { ns: desk.ns }); T.reload(); bump('budget'); });
    const decide = (id, decision) => act('row', async () => { await call('/den/watch/decide', { id, decision }); W.reload(); X.reload(); });
    const remove = id => act('row', async () => { await call('/den/watch/delete', { id }); W.reload(); X.reload(); });
    const setIssue = (id, issue) => act('row', async () => { await call('/den/watch/update', { id, issue }); W.reload(); X.reload(); });
    const submit = () => act('add', async () => { const b = Object.assign({ ns: desk.ns }, add); if (b.kind !== 'account') { delete b.actor_kind; delete b.name; } if (b.kind === 'term' || b.kind === 'source' || b.kind === 'group') delete b.platform; await call('/den/watch/add', b); setAdd(Object.assign({}, add, { value: '', name: '' })); toastMsg('Added to the register'); W.reload(); X.reload(); });
    if (W.loading && !W.data) return html`<${Loading} what="the register" />`;
    if (W.err && !W.data) return html`<${Failed} what="The register" err=${W.err} onRetry=${W.reload} />`;
    const all = W.data.watch || []; const props = all.filter(r => r.status === 'proposed'); const gone = all.filter(r => r.status === 'dismissed'); const rows = kind === 'proposed' ? props : kind === 'dismissed' ? gone : all.filter(r => r.kind === kind && r.status !== 'proposed' && r.status !== 'dismissed'); const lex = X.data; const th = T.data && T.data.themes && T.data.themes.length ? T.data : null;
    const term = id => (lex && lex.terms || []).find(t => t.id === id) || {};
    return html`<div>
      ${X.err ? html`<div class="den-notice bad" role="alert">The desk's lexicon could not be loaded: ${X.err} The register below is complete, but the notes on each term (review, generic, the cap) are missing. <button class="den-mini" onClick=${X.reload}>Try again</button></div>` : null}
      ${T.err ? html`<div class="den-notice bad" role="alert">The last grouping of the proposals could not be loaded: ${T.err} The proposals themselves are all below. <button class="den-mini" onClick=${T.reload}>Try again</button></div>` : null}
      <div class="den-tabs" data-tour="watch-kinds" role="tablist" aria-label="Register">${KINDS.map(k => { const n = k[0] === 'proposed' ? props.length : k[0] === 'dismissed' ? gone.length : all.filter(r => r.kind === k[0] && r.status === 'active').length; return html`<button key=${k[0]} role="tab" class="den-tab" aria-selected=${kind === k[0] ? 'true' : 'false'} onClick=${() => setKind(k[0])}>${k[1]}<span class="n">${n}</span></button>`; })}</div>
      ${kind === 'proposed' ? html`<${Panel} title="Waiting for a person" note="Nothing proposed is read by any collector until it is approved" flush=${true}
          actions=${canWrite ? html`<button class="den-mini" data-tour="watch-discover" disabled=${busy === 'discover'} title="Reads what the archive already holds. No model call, nothing collected." onClick=${discover}>${busy === 'discover' ? 'Looking...' : 'Find new keywords now (free)'}</button><button class="den-mini" data-tour="watch-themes" data-paid="1" disabled=${busy === 'themes' || props.length < 4} title=${props.length < 4 ? 'With fewer than four waiting, read them as they are' : 'One model call. It changes no status.'} onClick=${themes}>${busy === 'themes' ? 'Grouping...' : 'Group into themes (1 model call)'}</button>` : null}>
          ${found ? html`<div class="den-notice ${found.filed.proposed ? 'good' : ''}" role="status">Read ${fmtN(found.rows.scanned)} rows of the last ${found.days} days (${fmtN(found.rows.desk)} on this desk). ${found.filed.proposed} new proposal${found.filed.proposed === 1 ? '' : 's'}; ${found.filed.known} already decided or waiting. ${(found.thin || []).join(' ')}</div>` : null}
          ${th ? html`<div class="den-notice" role="status"><b>Grouped ${since(th.at)}</b> by one model call; it changed nothing.<ul class="den-ev">${th.themes.map((t, i) => html`<li key=${i}><b>${t.name}</b>: ${t.why} <span class="den-mono">(${t.ids.map(id => (all.find(r => r.id === id) || {}).value).filter(Boolean).join(', ')})</span></li>`)}</ul></div>` : null}
          ${props.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>Candidate, and why</th><th class="num">Score</th><th></th></tr></thead><tbody>${props.map(p => html`<${Proposal} key=${p.id} p=${p} desk=${desk} canWrite=${canWrite} onDone=${() => { W.reload(); X.reload(); }} />`)}</tbody></table>`
            : html`<${Empty}><b>Nothing is waiting.</b> Proposals arrive once a day from what was collected, and from the reports with <code>tools/den-mine-reports.py</code>. ${canWrite ? 'Press Find new keywords now to look straight away.' : ''}<//>`}
        <//>`
      : kind === 'dismissed' ? html`<${Panel} title="Dismissed" note="Never proposed again. Each can be brought back." flush=${true}>
          ${gone.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>What</th><th>Why it was dismissed</th><th>By</th><th></th></tr></thead><tbody>${gone.map(r => html`<tr key=${r.id} class="den-row"><td><span class="den-chip">${r.kind}</span></td><td><span class="den-t">${r.kind === 'hashtag' ? '#' : ''}${r.value}</span></td><td>${r.reason}</td><td class="den-mono">${r.decided_by} ${since(r.decided_at)}</td>
            <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} aria-label=${'Approve ' + r.value + ' after all'} onClick=${() => decide(r.id, 'approve')}>Approve after all</button>` : null}</td></tr>`)}</tbody></table>` : html`<${Empty}>Nothing has been dismissed on this desk.<//>`}
        <//>`
      : html`<${Panel} title=${KINDS.find(k => k[0] === kind)[1]} note=${kind === 'term' && lex ? lex.cap.active + ' of ' + lex.cap.max + ' active terms' : ''} flush=${true}>
          ${kind === 'term' && lex ? html`<div class="den-state">${lex.rule} The lexicon's own terms for this desk: ${lex.issues.map(i => html`<span key=${i.id} class="den-chip" title=${i.own.join(', ')}>${i.label}: ${i.own.length}${i.added.length ? ' + ' + i.added.length : ''}</span> `)}</div>` : null}
          ${rows.length ? html`<table class="den-table"><thead><tr><th>${kind === 'term' ? 'Term' : kind === 'source' ? 'Site' : 'Name'}</th><th>${kind === 'term' ? 'Files under' : 'Channel'}</th><th>State</th><th>Last read</th><th></th></tr></thead><tbody>
            ${rows.map(r => { const t = kind === 'term' ? term(r.id) : {}; return html`<tr key=${r.id} class="den-row"><td><span class="den-t">${kind === 'hashtag' ? '#' : ''}${r.value}</span>${r.name ? html`<span class="den-sub">${r.name}${r.actor_kind ? ' - a public actor (' + r.actor_kind + '), named on its own posts' : ''}</span>` : null}${t.note ? html`<span class="den-sub">${t.note}</span>` : null}</td>
              <td>${kind !== 'term' ? (CH[r.platform] || r.platform) : canWrite ? html`<select class="den-in" value=${r.issue || ''} disabled=${!!busy} aria-label=${'The issue "' + r.value + '" files under'} onChange=${e => setIssue(r.id, e.target.value)}><option value="">no issue (searched for only)</option>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}</select>` : ((desk.issues.find(i => i.id === r.issue) || {}).label || html`<span class="den-chip warn">no issue</span>`)}</td>
              <td><span class=${'den-chip ' + (r.status === 'active' ? 'pos' : '')}>${r.status === 'active' ? 'active' : 'off'}</span>${t.review ? html` <span class="den-chip warn" title="Approved a month ago or more and matched nothing since: keep it or switch it off">review</span>` : null}${t.generic ? html` <span class="den-chip" title="It does not name Australia: what it finds outside the watched places must say something Australian to be kept">generic</span>` : null}</td>
              <td class="den-mono den-lastread">${r.last_ok ? since(r.last_ok) : kind === 'term' || kind === 'source' ? '-' : 'not read yet'}</td>
              <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} onClick=${() => decide(r.id, r.status === 'active' ? 'off' : 'on')}>${r.status === 'active' ? 'Switch off' : 'Switch on'}</button> <button class="den-mini danger" disabled=${!!busy} aria-label=${'Delete ' + r.value} onClick=${() => setDel(r)}>Delete</button>` : null}</td></tr>`; })}</tbody></table>`
            : html`<${Empty}>This desk's register holds no ${KINDS.find(k => k[0] === kind)[1].toLowerCase()} yet.${kind === 'account' ? ' A registered account is read on its own posts; mark it as a public actor only if it is an organisation, an official or a media outlet.' : ''}<//>`}
        <//>`}
      ${canWrite ? html`<${Panel} title="Add to the register" tour="watch-add"><div class="den-form">
        <label class="den-lab">Kind<select value=${add.kind} onChange=${e => setAdd(Object.assign({}, add, { kind: e.target.value }))}><option value="term">a term</option><option value="hashtag">a hashtag</option><option value="account">an account</option><option value="group">a public Facebook group</option><option value="source">an outlet</option></select></label>
        ${add.kind === 'account' || add.kind === 'hashtag' ? html`<label class="den-lab">Channel<select value=${add.platform} onChange=${e => setAdd(Object.assign({}, add, { platform: e.target.value }))}>${(add.kind === 'hashtag' ? ['instagram', 'any'] : ['x', 'facebook', 'instagram', 'youtube', 'tiktok', 'threads', 'linkedin']).map(p => html`<option key=${p} value=${p}>${CH[p] || 'any channel'}</option>`)}</select></label>` : null}
        <label class="den-lab den-grow">${add.kind === 'term' ? 'Word or phrase' : add.kind === 'source' ? 'Site address' : add.kind === 'hashtag' ? 'Hashtag' : 'Handle or address'}<input value=${add.value} maxlength="200" onInput=${e => setAdd(Object.assign({}, add, { value: e.target.value }))} onKeyDown=${e => { if (e.key === 'Enter' && add.value.trim().length > 1) submit(); }} /></label>
        ${add.kind === 'account' ? html`<label class="den-lab">Its name<input value=${add.name} maxlength="120" onInput=${e => setAdd(Object.assign({}, add, { name: e.target.value }))} /></label><label class="den-lab">A public actor?<select value=${add.actor_kind} onChange=${e => setAdd(Object.assign({}, add, { actor_kind: e.target.value }))}><option value="">no: never named</option><option value="org">an organisation</option><option value="official">an official</option><option value="media">a media outlet</option></select></label>` : null}
        ${add.kind === 'term' ? html`<label class="den-lab">Files under<select value=${add.issue} onChange=${e => setAdd(Object.assign({}, add, { issue: e.target.value }))}><option value="">no issue (searched for only)</option>${desk.issues.map(i => html`<option key=${i.id} value=${i.id}>${i.label}</option>`)}</select></label>` : null}
        <button class="den-mini primary" disabled=${busy === 'add' || add.value.trim().length < 2} onClick=${submit}>Add</button></div>
        ${add.kind === 'account' && /tiktok|threads|linkedin/.test(add.platform) ? html`<p class="den-mono">No collector reads ${CH[add.platform]}: an account on it is kept as a note and collects nothing.</p>` : null}<//>` : null}
      ${del ? html`<${Dialog} title="Delete from the register?" onClose=${() => setDel(null)}><p>Delete <b>${(del.kind === 'hashtag' ? '#' : '') + del.value}</b> from this desk's register? Collectors stop reading it. It can be proposed again later.</p>
        <div class="den-form"><button class="den-mini" onClick=${() => setDel(null)}>Keep it</button><button class="den-mini danger" onClick=${() => { const id = del.id; setDel(null); remove(id); }}>Delete it</button></div><//>` : null}
    </div>`;
  }

  /* ---- Collection: the one home of delivery problems (owner's item (a), 16 November 2026) ----
     A channel that delivered nothing is said here, with why and the one action, and on no other tab. The gaps come from
     the checks DenApp already read (no request of its own): undefined while they load, null if they could not be read
     (the page says so instead of guessing), [] when every channel delivered. */
  const SECRET = /\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|tools\/|\.py\b|--[a-z]{3,}/;
  const SETUPISH = /\b(Access|permission|token|secret|scope|key)\b/i;
  /* A gap's detail as plain sentences, with the names only a person setting up the route needs (secrets, permissions,
     scripts) taken out and folded under "Setup details". */
  function whyOf(detail) {
    const plain = []; const setup = [];
    String(detail || '').split(/(?<=[.!?])\s+(?=[A-Z])/).forEach(s => {
      if (!s.trim()) return; if (SECRET.test(s)) { setup.push(s.trim()); return; }
      plain.push(s.replace(/\s*\(([^()]*)\)/g, (m, x) => { if (SECRET.test(x) || SETUPISH.test(x)) { setup.push(x.trim()); return ''; } return m; }).trim());
    });
    return { plain, setup };
  }
  const routeWords = c => { const r = []; if (c.worker) r.push('the worker'); if (c.collector) r.push('the Mac'); return r.length ? 'By ' + r.join(' and ') : 'Not set up'; };
  const NO_ROUTE = 'No collection job exists for this channel: it is read on its own schedule.';

  function Gaps({ gaps, to, chOf, canWrite, busy, job, collect, accounts }) {
    const note = to ? 'For ' + fmtDay.format(new Date(+to)) : 'In this desk\'s window';
    const action = g => { const c = chOf(g.channel); if (!c) return null;
      if (c.collector && c.collector.off) return html`<span class="den-gapact">Switched off under Signed-in collection.</span>`;
      if (c.collector && c.collector.challenge) return html`<span class="den-gapact">Paused at a verification: a person signs in again on the Mac. Nothing is retried.</span>`;
      if (!c.collect) return html`<span class="den-gapact">${NO_ROUTE}</span>`;
      if (!canWrite) return html`<span class="den-gapact">A full key can start a collection.</span>`;
      return html`<button class="den-mini" data-tour="gap-collect" aria-label=${'Collect now: ' + c.label} disabled=${busy === c.id} title="Starts one collection job. No model call." onClick=${() => collect(c, 'gaps')}>${busy === c.id ? 'Starting...' : 'Collect now'}</button>`; };
    const acc = Array.isArray(accounts) ? accounts.filter(a => a && a.last_error) : [];
    return html`<${Panel} title="Not delivering" tour="gaps" note=${note} flush=${true}>
      ${gaps === undefined ? html`<${Empty}>Checking what each channel delivered...<//>`
        : gaps === null ? html`<${Empty}>The checks could not be read, so which channel delivered nothing is not known here. The table below still says what each one delivered.<//>`
        : !gaps.length ? html`<${Empty}><span class="den-allgood">Every channel this desk relies on delivered.</span><//>`
        : html`<ul class="den-gaps">${gaps.map(g => { const w = whyOf(g.detail); const c = chOf(g.channel);
            return html`<li key=${g.key} data-channel=${g.channel || null}><span class="den-gapdot" aria-hidden="true"></span>
              <div class="den-gapmain"><span class="den-t">${g.title}</span><span class="den-why">${w.plain.map((s, i) => html`<span key=${i}>${s} </span>`)}</span>
                ${w.setup.length ? html`<details class="den-setup"><summary>Setup details</summary><ul>${w.setup.map((s, i) => html`<li key=${i}>${s}</li>`)}</ul></details>` : null}</div>
              <div class="den-gapside">${action(g)}</div>
              ${job && job.from === 'gaps' && c && job.ch === c.id ? html`<div class="den-gapjob"><${Console} job=${job} title=${job.title} canWrite=${canWrite} /></div>` : null}</li>`; })}</ul>`}
      ${acc.length ? html`<div class="den-gapacc"><h4>Accounts that could not be read</h4><ul>${acc.slice(0, 40).map((a, i) => html`<li key=${i}><span class="den-t">${a.name || a.value}</span> on ${CH[a.platform] || a.platform}<span class="den-sub">${a.last_ok ? 'last read ' + since(a.last_ok) : 'never read'}; the last try said: ${String(a.last_error).slice(0, 160)}</span></li>`)}</ul></div>` : null}
      ${to ? html`<p class="den-gapnow">The channels below are as they stand now, not as they stood that day.</p>` : null}
    <//>`;
  }

  /* The analysis behind the Board, drawn only when the worker sends it (p67: /den/collection `pipeline` and `tick`). */
  function Pipeline({ pipeline, last }) {
    const pl = pipeline && typeof pipeline === 'object' ? pipeline : null; const tk = last && typeof last === 'object' && +last.total > 0 ? last : null;
    if (!pl && !tk) return null; const n = v => (Number.isFinite(+v) ? +v : 0);
    const slow = tk && Array.isArray(tk.stages) ? tk.stages.filter(s => Array.isArray(s) && +s[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3) : [];
    return html`<${Panel} title="Analysis" tour="pipeline" note="What waits to be grouped and named, and how long the last collection run took">
      <ul class="den-pipe">
        ${pl ? html`<li>${n(pl.unplaced) ? plural(n(pl.unplaced), 'item') + ' waiting to be grouped' + (n(pl.oldestUnplacedMin) ? ' (oldest ' + n(pl.oldestUnplacedMin) + ' min)' : '') + '.' : 'Nothing is waiting to be grouped.'}</li>
          <li>${plural(n(pl.titled), 'narrative') + (n(pl.titled) === 1 ? ' carries' : ' carry') + ' a working title'}${n(pl.awaitingModel) ? '; ' + n(pl.awaitingModel) + (n(pl.awaitingModel) === 1 ? ' waits' : ' wait') + ' for a model name in the daily window' : ''}.</li>` : null}
        ${tk ? html`<li>The last tick took ${Math.round(n(tk.total) / 1000)} s, ${since(+tk.at)}${tk.ai ? ', inside the daily window for automated model work' : ''}.${slow.length ? html` <span class="den-sub">Slowest: ${slow.map(s => String(s[0]) + ' ' + Math.round(s[1] / 1000) + ' s').join(', ')}.</span>` : null}</li>` : null}
      </ul>
    <//>`;
  }

  function CollectionPanel({ desk, tick, bump, canWrite, gaps, to, setTab }) {
    const C = useLoad(() => get('/den/collection?' + q({ desk: desk.id }), 'channels'), [desk.id, tick], desk.id); const [job, setJob] = useState(null); const [busy, setBusy] = useState('');
    const collect = async (ch, from) => { setBusy(ch.id); try { const d = await call('/den/collect', { desk: desk.id, channel: ch.collect }); setJob({ ch: ch.id, from: from || 'table', id: d.id, status: d.where === 'desktop' ? 'queued' : 'running', lines: [], title: ch.label + (d.where === 'desktop' ? ' (waiting for the Mac collector)' : '') }); tailJob(d.id, j => setJob(o => Object.assign({}, o, j)), () => { C.reload(); bump('collected'); }); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const toggle = async src => { const off = (C.data.reach.off || []).slice(); const i = off.indexOf(src); if (i >= 0) off.splice(i, 1); else off.push(src); setBusy('sw'); try { await call('/den/reach', { off }); C.reload(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const chs = C.data && Array.isArray(C.data.channels) ? C.data.channels : []; const chOf = id => chs.find(c => c && c.id === id) || null;
    const gapIds = Array.isArray(gaps) ? gaps.map(g => g.channel) : [];
    const head = html`<${Gaps} gaps=${gaps} to=${to} chOf=${chOf} canWrite=${canWrite} busy=${busy} job=${job} collect=${collect} accounts=${C.data && C.data.accounts} />`;
    if (C.loading && !C.data) return html`<div>${head}<${Loading} what="collection" /></div>`;
    if (C.err && !C.data) return html`<div>${head}<${Failed} what="Collection" err=${C.err} onRetry=${C.reload} /></div>`;
    const d = C.data; const live = (d.reach.agents || []).filter(a => a.live); const bt = d.backtest;
    const state = c => { const k = c.collector; if (!k) return c.worker ? html`<span class="den-chip pos">from the worker</span>` : html`<span class="den-chip" title="Neither the worker nor a Mac collector reads this channel yet: see How it is read.">not set up</span>`; if (k.off) return html`<span class="den-chip warn">switched off</span>`; if (k.challenge) return html`<span class="den-chip neg" title=${'Stopped at a verification ' + since(k.challenge.at) + '. Nothing is retried: a person signs in again on the Mac.'}>paused: verification</span>`; if (k.offered) return html`<span class="den-chip pos">a collector is connected</span>`;
      return c.worker ? html`<span class="den-chip" title="The worker's own read of this channel runs. Its signed-in read waits: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there).">from the worker only</span>` : html`<span class="den-chip warn" title="Nothing reads this channel now: no Mac collector offers it (the Mac is off, the agent is not running, or nobody has signed in to it there), and the worker has no route of its own.">no collector</span>`; };
    return html`<div>
      ${head}
      <div class="den-notice ${live.length ? 'good' : ''}" data-tour="collectors" role="status">${live.length ? live.length + ' collector' + (live.length === 1 ? ' is' : 's are') + ' connected (' + live.map(a => a.agent).join(', ') + ').' : 'No Mac collector is connected. Channels read from the worker still run; signed-in reads wait.'} ${canWrite ? '' : 'Your key is read-only: collecting and the switches need a full key.'}</div>
      <${Panel} title="Channels" tour="channels" note=${'What each delivered for ' + desk.name + ', as it stands now'} flush=${true}>
        <table class="den-table den-chtable"><thead><tr><th>Channel</th><th>How it is read</th><th>Now</th><th class="num">Last day</th><th class="num">7 days</th><th>Last delivered</th><th></th></tr></thead><tbody>
        ${d.channels.map(c => html`<${React.Fragment} key=${c.id}><tr class="den-row" data-gap=${gapIds.indexOf(c.id) >= 0 ? '1' : null}><td><span class="den-t">${c.label}</span>${c.accounts != null ? html`<span class="den-sub">${c.accounts} registered account${c.accounts === 1 ? '' : 's'}</span>` : null}</td>
          <td><details class="den-how"><summary>${routeWords(c)}</summary><span class="den-howtext">${c.how}</span>${c.cannot ? html`<span class="den-sub">Cannot reach: ${c.cannot}</span>` : null}</details></td><td>${state(c)}</td>
          <td class="num">${c.delivered.d1 || (gapIds.indexOf(c.id) >= 0 ? html`<span class="den-chip warn" title="Nothing for this desk in the last day, on a channel this desk relies on. That is a collection fact, not a quiet day.">0</span>` : html`<span class="den-zero" title="Nothing for this desk in the last day.">0</span>`)}</td><td class="num">${fmtN(c.delivered.d7)}</td><td class="den-mono" title=${c.delivered.layers.length ? 'Read through layer ' + c.delivered.layers.join(', ') : null}>${c.delivered.last ? since(c.delivered.last) : 'never'}</td>
          <td class="act">${canWrite ? html`<button class="den-mini" data-tour="collect-now" disabled=${busy === c.id || !c.collect || (c.collector && c.collector.off)} title=${!c.collect ? NO_ROUTE : c.collector && c.collector.off ? 'Switched off below' : 'Starts one collection job. No model call.'} onClick=${() => collect(c, 'table')}>${busy === c.id ? 'Starting...' : 'Collect now'}</button>` : null}</td></tr>
          ${job && job.from !== 'gaps' && job.ch === c.id ? html`<tr class="den-jobrow"><td colSpan="7"><${Console} job=${job} title=${job.title} canWrite=${canWrite} /></td></tr>` : null}<//>`)}</tbody></table>
      <//>
      <${Pipeline} pipeline=${d.pipeline} last=${d.tick} />
      <div class="den-grid2">
        <${Panel} title="Signed-in collection" note="Off stops every collector at once" flush=${true}>
          <table class="den-table"><thead><tr><th>Platform</th><th>State</th><th></th></tr></thead><tbody>${['x', 'facebook', 'instagram', 'ytsearch', 'reddit', 'gated'].map(src => { const off = (d.reach.off || []).indexOf(src) >= 0; const chal = (d.reach.challenges || {})[src]; return html`<tr key=${src}><td>${{ ytsearch: 'YouTube search', gated: 'Subscriber news' }[src] || CH[src]}</td><td>${off ? html`<span class="den-chip warn">off</span>` : html`<span class="den-chip pos">allowed</span>`}${chal ? html` <span class="den-chip neg">verification ${since(chal.at)}</span>` : null}</td>
            <td class="act">${canWrite ? html`<button class="den-mini" disabled=${busy === 'sw'} aria-pressed=${off ? 'true' : 'false'} onClick=${() => toggle(src)}>${off ? 'Switch on' : 'Switch off'}</button>` : null}</td></tr>`; })}</tbody></table>
          <div class="den-state">A platform collects only after a person has signed in to it on the Mac. Instagram hashtags: ${d.hashtags.used} of ${d.hashtags.limit} used in the last ${d.hashtags.windowDays} days.</div>
        <//>
        <${Panel} title="Subscriber outlets" note="Read through the agency's own subscription, once cleared" flush=${true}>
          ${d.gated.length ? html`<table class="den-table"><thead><tr><th>Outlet</th><th>Access</th><th>Cleared</th></tr></thead><tbody>${d.gated.slice(0, 30).map(g => html`<tr key=${g.id}><td>${g.name}</td><td>${g.access}</td><td>${g.cleared ? html`<span class="den-chip pos">by ${g.cleared_by}</span>` : html`<span class="den-chip">headlines only</span>`}</td></tr>`)}</tbody></table>` : html`<${Empty}>No paid outlet is in the Source Registry.<//>`}
          <div class="den-state">Clearance is recorded on the source: <button class="den-link" onClick=${() => window.AXUI.goto('sources', {})}>open Sources</button>.</div>
        <//>
      </div>
      <${PublicRecord} desk=${desk} tick=${tick} canWrite=${canWrite} />
      <${Panel} title="Recall against the reports" note="Of the links in filed reports, how many AXIOM held at the time">
        ${bt ? html`<div><p><b class="den-t">${bt.share}%</b> - ${fmtN(bt.held)} of ${fmtN(bt.links)} links in ${bt.reports} reports${bt.period ? ' (' + bt.period + ')' : ''}; measured ${since(bt.at)} by ${bt.by}.</p>
            <table class="den-table"><thead><tr><th>Channel</th><th class="num">Links</th><th class="num">Held</th><th class="num">Share</th></tr></thead><tbody>${Object.keys(bt.byChannel).map(k => html`<tr key=${k}><td>${CH[k] || k}</td><td class="num">${bt.byChannel[k].links}</td><td class="num">${bt.byChannel[k].held}</td><td class="num">${bt.byChannel[k].links ? Math.round(bt.byChannel[k].held / bt.byChannel[k].links * 100) + '%' : '-'}</td></tr>`)}</tbody></table>
            ${bt.misses.length ? html`<details><summary class="den-link">${bt.misses.length} of the links it did not hold</summary><ul class="den-ev">${bt.misses.map((m, i) => html`<li key=${i}>${CH[m.channel] || m.channel}: ${m.url}</li>`)}</ul></details>` : null}</div>`
          : html`<${Empty}><b>Not measured yet.</b> This is the number that says whether collection is good enough. It is measured on the Mac, against a folder of exported reports kept outside the repository.
              <details class="den-setup"><summary>Setup details</summary><code>python3 tools/den-backtest.py ~/Documents/briefs --desk ${desk.id} --key $AXIOM_KEY --save</code></details><//>`}
      <//>
      ${(d.notBuilt || []).length ? html`<details class="den-setup den-notbuilt"><summary>Setup details: what is not collected, and why</summary><p class="den-mono">${d.notBuilt.join(' ')}</p></details>` : null}
    </div>`;
  }

  /* ---- public record: the parliament pages a desk watches and the campaign counters read for it (release 7) ---- */
  function PublicRecord({ desk, tick, canWrite }) {
    const P = useLoad(() => get('/den/process?' + q({ desk: desk.id }), 'process'), [desk.id, tick], desk.id);
    const K = useLoad(() => get('/social/petitions/counters', 'counters'), [desk.id, tick], desk.id);
    const [f, setF] = useState({ url: '', title: '', type: 'inquiry', house: '' }); const [c, setC] = useState({ url: '', name: '' }); const [busy, setBusy] = useState('');
    const run = async (key, path, body, after) => { setBusy(key); try { const r = await call(path, body); if (after) after(r); P.reload(); K.reload(); } catch (e) { toastMsg(say(e), true); } setBusy(''); };
    const addPage = () => run('page', '/den/process/add', { url: f.url.trim(), title: f.title.trim(), type: f.type, house: f.house, juris: desk.region && desk.region !== 'au' ? desk.region : 'au', issues: desk.issues.map(i => i.id).slice(0, 1) }, () => { setF({ url: '', title: '', type: f.type, house: f.house }); toastMsg('Watched. It is read at the next sweep, under robots.txt.'); });
    const addCounter = () => run('counter', '/social/petitions/counters', { add: { url: c.url.trim(), name: c.name.trim(), ns: desk.ns } }, () => { setC({ url: '', name: '' }); toastMsg('Added. Its count is read once a day.'); });
    const pages = (P.data && P.data.pages) || []; const recs = (P.data && P.data.process) || []; const byPage = id => recs.filter(r => r.source === id);
    const counters = ((K.data && K.data.counters) || []).filter(x => !x.ns || x.ns === desk.ns);
    return html`<div class="den-grid2">
      <${Panel} title="Watched parliament pages" note="Stage and dates read from the parliament's own page" flush=${true}>
        ${P.err && !P.data ? html`<${Failed} what="The process calendar" err=${P.err} onRetry=${P.reload} />` : P.loading && !P.data ? html`<${Loading} what="the process calendar" />`
          : pages.length ? html`<table class="den-table"><thead><tr><th>Bill, inquiry or notice page</th><th>Stage</th><th>Next date</th><th>Read</th><th></th></tr></thead><tbody>
            ${pages.map(p => { const r = byPage(p.id); const first = r[0]; return html`<tr key=${p.id} class="den-row"><td><span class="den-t">${p.name}</span><span class="den-sub">${p.type}${p.juris && p.juris !== 'au' ? ', ' + String(p.juris).toUpperCase() : ''}${r.length > 1 ? ', ' + r.length + ' notices kept' : ''}${first && first.submissions ? ', ' + fmtN(first.submissions) + ' submissions' : ''}</span></td>
              <td>${!p.enabled ? html`<span class="den-chip warn">switched off</span>` : first ? first.stage : html`<span class="den-chip" title="Nothing has been recorded from this page yet">not read yet</span>`}</td>
              <td class="den-mono">${first && first.next_date ? first.next_date + ' ' + first.next_what : '-'}</td>
              <td>${p.error ? html`<span class="den-chip neg" title=${p.error}>failed</span><span class="den-sub">${p.error.slice(0, 110)}</span>` : p.last_ok ? since(p.last_ok) : 'not yet'}</td>
              <td class="act">${web(p.url) ? html`<a class="den-link" href=${web(p.url)} target="_blank" rel="noopener" aria-label=${'Open ' + p.name}>Open</a>` : null}${canWrite && p.enabled ? html` <button class="den-mini" disabled=${!!busy} title="Its source is switched off and its records leave the calendar" onClick=${() => run('rm' + p.id, '/den/process/remove', { source: p.id })}>Stop</button>` : null}</td></tr>`; })}</tbody></table>`
          : html`<${Empty}><b>No parliament page is watched for this desk.</b> ${canWrite ? 'Add a bill or an inquiry below by its address on the parliament\'s own site.' : 'A full-access user can add one.'}<//>`}
        ${canWrite ? html`<div class="den-form den-padform">
          <label class="den-lab den-grow2">Address of the page<input class="den-in" value=${f.url} maxlength="400" placeholder="https://www.aph.gov.au/..." onInput=${e => setF(Object.assign({}, f, { url: e.target.value }))} /></label>
          <label class="den-lab den-grow2">Its name, as the parliament writes it<input class="den-in" value=${f.title} maxlength="120" onInput=${e => setF(Object.assign({}, f, { title: e.target.value }))} /></label>
          <label class="den-lab">Kind<select class="den-in" value=${f.type} onChange=${e => setF(Object.assign({}, f, { type: e.target.value }))}>${[['inquiry', 'Inquiry'], ['bill', 'Bill'], ['motion', 'Notice paper'], ['disallowance', 'Disallowance list'], ['regulation', 'Regulation'], ['decision', 'Decision']].map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>
          <label class="den-lab">House<select class="den-in" value=${f.house} onChange=${e => setF(Object.assign({}, f, { house: e.target.value }))}>${[['', 'Not said'], ['senate', 'Senate'], ['reps', 'House of Representatives'], ['upper', 'Upper house'], ['lower', 'Lower house'], ['joint', 'Joint']].map(o => html`<option key=${o[0]} value=${o[0]}>${o[1]}</option>`)}</select></label>
          <button class="den-mini primary" disabled=${!!busy || f.url.trim().length < 12 || f.title.trim().length < 4} title="No model call. The page is read at one request every ten seconds a host." onClick=${addPage}>${busy === 'page' ? 'Adding...' : 'Watch this page'}</button></div>` : null}
        <div class="den-state">Submitters' names are never read. A page that refuses the reader is left alone for a day and says so here.</div>
      <//>
      <${Panel} title="Campaign petition counters" note="Self-reported by each campaign, read once a day" flush=${true}>
        ${K.err && !K.data ? html`<${Failed} what="The petition counters" err=${K.err} onRetry=${K.reload} />` : K.loading && !K.data ? html`<${Loading} what="the petition counters" />`
          : counters.length ? html`<table class="den-table"><thead><tr><th>Petition</th><th>Page</th><th></th></tr></thead><tbody>${counters.map(x => html`<tr key=${x.url} class="den-row"><td><span class="den-t">${x.name}</span>${x.seed ? html`<span class="den-sub">seeded; its address is unproven until it is read</span>` : x.by ? html`<span class="den-sub">added by ${x.by}</span>` : null}</td>
              <td>${web(x.url) ? html`<a class="den-link" href=${web(x.url)} target="_blank" rel="noopener">${String(x.url).replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}</a>` : x.url}</td>
              <td class="act">${canWrite ? html`<button class="den-mini" disabled=${!!busy} onClick=${() => run('rc' + x.url, '/social/petitions/counters', { remove: x.url })}>Remove</button>` : null}</td></tr>`)}</tbody></table>`
          : html`<${Empty}><b>No campaign counter is read for this desk.</b> ${canWrite ? 'Add the campaign page that prints its signature count.' : ''}<//>`}
        ${canWrite ? html`<div class="den-form den-padform">
          <label class="den-lab den-grow2">Address of the campaign page<input class="den-in" value=${c.url} maxlength="400" placeholder="https://..." onInput=${e => setC(Object.assign({}, c, { url: e.target.value }))} /></label>
          <label class="den-lab den-grow2">The petition's name<input class="den-in" value=${c.name} maxlength="120" onInput=${e => setC(Object.assign({}, c, { name: e.target.value }))} /></label>
          <button class="den-mini primary" disabled=${!!busy || c.url.trim().length < 12 || c.name.trim().length < 3} onClick=${addCounter}>${busy === 'counter' ? 'Adding...' : 'Add counter'}</button>
          <button class="den-mini" disabled=${!!busy} title="Proposes the campaign names found in paid advertising as terms. Nothing searches one until it is approved in Watch." onClick=${() => run('seed', '/den/watch/seed', {}, r => toastMsg(r.proposed ? r.proposed + ' campaign name' + (r.proposed === 1 ? '' : 's') + ' proposed. Approve them in Watch.' : 'Already proposed. See Watch.'))}>${busy === 'seed' ? 'Proposing...' : 'Propose campaign names'}</button></div>` : null}
        <div class="den-state">The count is the campaign's own claim and nobody has audited it. The numbers and their daily growth are in Signals, Petitions. change.org is not read: it refuses automated readers.</div>
      <//>
    </div>`;
  }

  /* ---- Options ---- */
  function OptionsPanel({ desk, canWrite, onSaved, onCreated }) {
    const init = () => ({ name: desk.name, region: desk.region, cadence: desk.cadence, window_h: desk.window_h, auto_draft: desk.auto_draft, sections: desk.sections.map(s => Object.assign({}, s)), hidden: desk.options.hidden.slice(), levels: desk.ratings.levels.join(', '), trends: desk.ratings.trends.join(', '),
      minEng: Object.assign({}, desk.options.minEng), fold: desk.options.fold !== false, density: desk.options.density || 'regular' });
    const [f, setF] = useState(init); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState(null); const [nd, setNd] = useState({ name: '', region: 'au' });
    const create = async () => { setBusy(true); setMsg(null); try { const d = await call('/den/desk/update', { ns: desk.ns, name: nd.name, region: nd.region, like: desk.id }); setNd({ name: '', region: 'au' }); onCreated(d.desk); } catch (e) { setMsg({ ok: false, text: say(e) }); } setBusy(false); };
    // a desk that comes back with a new revision after this panel's own save keeps "Saved."; another desk, or a change
    // made since, clears it (a conflict note is cleared by the revision it asked to load)
    const lastId = useRef(desk.id);
    useEffect(() => { setF(init()); const same = lastId.current === desk.id; lastId.current = desk.id; setMsg(m => (same && m && m.ok ? m : null)); }, [desk.id, desk.revision]);   // eslint-disable-line
    const set = (k, v) => { setF(o => Object.assign({}, o, { [k]: v })); setMsg(m => (m && m.ok ? null : m)); }; const dirty = JSON.stringify(f) !== JSON.stringify(init());
    const move = (i, d) => { const s = f.sections.slice(); const j = i + d; if (j < 0 || j >= s.length) return; const t = s[i]; s[i] = s[j]; s[j] = t; set('sections', s); };
    const save = async () => { setBusy(true); setMsg(null); try { const list = v => v.split(',').map(x => x.trim()).filter(Boolean);
        const d = await call('/den/desk/update', { id: desk.id, revision: desk.revision, patch: { name: f.name, region: f.region, cadence: f.cadence, window_h: f.window_h, auto_draft: f.auto_draft, sections: f.sections, ratings: { levels: list(f.levels), trends: list(f.trends), items: desk.ratings.items }, options: { hidden: f.hidden, minEng: f.minEng, fold: f.fold, density: f.density } } });
        setMsg({ ok: true, text: 'Saved.' }); onSaved(d.desk); } catch (e) { setMsg({ ok: false, text: say(e), theirs: e.code === 'conflict' && e.body ? e.body.desk : null }); } setBusy(false); };
    const unmute = async m => { try { const d = await call('/den/mute', { desk: desk.id, kind: m.kind, value: m.value, on: false }); onSaved(d.desk); } catch (e) { toastMsg(say(e), true); } };
    const ro = !canWrite;
    return html`<div>
      ${msg ? html`<div class=${'den-notice ' + (msg.ok ? 'good' : 'bad')} role=${msg.ok ? 'status' : 'alert'}>${msg.text}${msg.theirs ? html`<div><button class="den-mini" onClick=${() => onSaved(msg.theirs)}>Load theirs</button></div>` : null}</div>` : null}
      ${ro ? html`<div class="den-notice">Your key is read-only: these are the desk's options as they stand.</div>` : null}
      <${Panel} title="The desk" tour="opt-desk"><div class="den-form">
        <label class="den-lab">Name<input value=${f.name} maxlength="60" disabled=${ro} onInput=${e => set('name', e.target.value)} /></label>
        <label class="den-lab">Region<select value=${f.region} disabled=${ro} onChange=${e => set('region', e.target.value)}>${['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'].map(r => html`<option key=${r} value=${r}>${r === 'au' ? 'National' : r.toUpperCase()}</option>`)}</select></label>
        <label class="den-lab">Cadence<select value=${f.cadence} disabled=${ro} onChange=${e => set('cadence', e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
        <label class="den-lab">Reporting window (hours)<input type="number" min="1" max="336" value=${f.window_h} disabled=${ro} onInput=${e => set('window_h', Math.max(1, Math.min(336, parseInt(e.target.value, 10) || 24)))} /></label>
        <label class="den-lab">Table density<select value=${f.density} disabled=${ro} onChange=${e => set('density', e.target.value)}><option value="compact">Compact</option><option value="regular">Regular</option><option value="roomy">Roomy</option></select></label>
        <label class="den-lab">Syndicated copies<select value=${f.fold ? '1' : '0'} disabled=${ro} onChange=${e => set('fold', e.target.value === '1')}><option value="1">Fold into one row</option><option value="0">Show each copy</option></select></label>
        <label class="den-lab">Draft each morning<select value=${f.auto_draft ? '1' : '0'} disabled=${ro} onChange=${e => set('auto_draft', e.target.value === '1')}><option value="0">No: a person starts each draft</option><option value="1">Yes: one model call a morning</option></select></label></div>
        <p class="den-mono">Times are Australian Eastern. A morning draft is one model call a day for this desk, inside the day's one window for automated model work; it is a draft and files nothing.</p><//>
      <${Panel} title="Sections of the report" tour="opt-sections" note="Their order, their titles and which show" flush=${true}>
        <table class="den-table"><thead><tr><th>Title</th><th>What it is</th><th>Shown</th><th></th></tr></thead><tbody>${f.sections.map((s, i) => html`<tr key=${s.id}><td><input class="den-in" value=${s.title} maxlength="80" disabled=${ro} aria-label=${'Title of section ' + (i + 1)} onInput=${e => set('sections', f.sections.map((x, j) => (j === i ? Object.assign({}, x, { title: e.target.value }) : x)))} /></td><td class="den-mono">${s.kind}${s.kind === 'sources' ? ' (built from the citations)' : ''}</td>
          <td><input type="checkbox" checked=${f.hidden.indexOf(s.id) < 0} disabled=${ro} aria-label=${'Show ' + s.title} onChange=${e => set('hidden', e.target.checked ? f.hidden.filter(h => h !== s.id) : f.hidden.concat([s.id]))} /></td>
          <td class="act">${ro ? null : html`<button class="den-mini" disabled=${i === 0} aria-label=${'Move ' + s.title + ' up'} onClick=${() => move(i, -1)}>Up</button> <button class="den-mini" disabled=${i === f.sections.length - 1} aria-label=${'Move ' + s.title + ' down'} onClick=${() => move(i, 1)}>Down</button>`}</td></tr>`)}</tbody></table><//>
      <div class="den-grid2">
        <${Panel} title="Ratings" note=${desk.ratings.items.map(i => i.label).join(', ')}><div class="den-form"><label class="den-lab den-full">Levels, lowest first<input value=${f.levels} disabled=${ro} onInput=${e => set('levels', e.target.value)} /></label><label class="den-lab den-full">Trends<input value=${f.trends} disabled=${ro} onInput=${e => set('trends', e.target.value)} /></label></div><p class="den-mono">A draft may only rate in these words; anything else is left blank for a person.</p><//>
        <${Panel} title="Least interactions to show a post" note="Registered accounts and MPs always show"><div class="den-form">${['x', 'facebook', 'instagram', 'youtube', 'reddit'].map(p => html`<label key=${p} class="den-lab">${CH[p]}<input type="number" min="0" max="100000" value=${f.minEng[p] || 0} disabled=${ro} onInput=${e => { const v = Math.max(0, parseInt(e.target.value, 10) || 0); const m = Object.assign({}, f.minEng); if (v) m[p] = v; else delete m[p]; set('minEng', m); }} /></label>`)}</div><//>
      </div>
      <${Panel} title="Mutes" note="Hidden on this desk only" flush=${true}>${desk.options.mutes.length ? html`<table class="den-table"><thead><tr><th>Kind</th><th>What</th><th>By</th><th></th></tr></thead><tbody>${desk.options.mutes.map((m, i) => html`<tr key=${i}><td>${m.kind}</td><td>${m.value}</td><td class="den-mono">${m.by} ${since(m.at)}</td><td class="act">${ro ? null : html`<button class="den-mini" aria-label=${'Remove the mute on ' + m.value} onClick=${() => unmute(m)}>Remove</button>`}</td></tr>`)}</tbody></table>` : html`<${Empty}>Nothing is muted. After three set-asides of the same account, site or term, the board offers a mute.<//>`}<//>
      ${ro ? null : html`<${Panel} title="Another desk for this client" note="A second region, or a second analyst's own desk, with this desk's sections and rating words"><div class="den-form">
        <label class="den-lab den-grow">Its name<input value=${nd.name} maxlength="60" placeholder=${desk.client + ' Queensland'} aria-label="The new desk's name" onInput=${e => setNd(Object.assign({}, nd, { name: e.target.value }))} /></label>
        <label class="den-lab">Region<select value=${nd.region} aria-label="The new desk's region" onChange=${e => setNd(Object.assign({}, nd, { region: e.target.value }))}>${['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'].map(r => html`<option key=${r} value=${r}>${r === 'au' ? 'National' : r.toUpperCase()}</option>`)}</select></label>
        <button class="den-mini" disabled=${busy || nd.name.trim().length < 3} onClick=${create}>Add the desk</button></div><//>`}
      ${ro ? null : html`<div class="den-bar den-optbar"><button class="den-mini primary" data-tour="opt-save" disabled=${busy || !dirty} onClick=${save}>${busy ? 'Saving...' : 'Save options'}</button><button class="den-mini" disabled=${busy || !dirty} onClick=${() => setF(init())}>Undo changes</button><span class=${'den-save' + (dirty ? ' dirty' : '')}>${dirty ? 'Not saved' : 'Saved, revision ' + desk.revision}</span></div>`}
    </div>`;
  }

  return { WatchPanel, CollectionPanel, OptionsPanel };
};
