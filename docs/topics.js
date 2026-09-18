/* AXIOM - Topics. Keyword research for SIFA and for us.
 *
 * A React island (React, ReactDOM and htm vendored under docs/vendor; shared
 * pieces from docs/ax-ui.js). Keywords arrive from SIFA or are added here. Run
 * starts a research job in the worker: news, government and party statements,
 * Hansard, the archive, the Mind, then the collectors go after the MPs' own X
 * accounts and the Reddit conversation, and a cited brief is written. This view
 * tails the job so every step shows as it happens, then lays the results out
 * by source with the brief first. SIFA reads the same results back through its
 * own endpoints; nothing here is for the browser only.
 */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.topicsInit = function () {
      const root = document.getElementById('topics-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, toastMsg, ago, fmtN, scrub, Console, tailJob } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const clients = () => (typeof CC_CLIENTS !== 'undefined' && Array.isArray(CC_CLIENTS) ? CC_CLIENTS : []);
  const clientName = id => { const c = clients().find(x => x.id === id); return c ? (c.short || c.name) : (id || 'cmm').toUpperCase(); };
  const TABS = [['brief', 'Brief'], ['news', 'News'], ['statements', 'Statements'], ['hansard', 'Parliament'], ['x', 'MPs on X'], ['reddit', 'Reddit']];
  const tone = t => (t < 0 ? 'hostile' : t > 0 ? 'supportive' : 'neutral');

  function Chip({ on, children, title }) {
    return html`<span class=${'sig-agent' + (on ? ' on' : '')} style=${{ marginLeft: 0 }} title=${title || ''}>${children}</span>`;
  }

  function Item({ it, showMp }) {
    return html`<div class="tp-item">
      <div class="t">${it.url && it.url.indexOf('x:') !== 0 ? html`<a href=${it.url} target="_blank" rel="noopener">${it.title}</a>` : html`<span style=${{ color: 'var(--t0)', fontSize: 13 }}>${it.title}</span>`}</div>
      ${it.excerpt && it.excerpt !== it.title ? html`<div class="x">${it.excerpt}</div>` : null}
      <div class="m">
        ${showMp && it.mp && it.mp.name ? html`<span class="tp-mp">${it.mp.name}${it.mp.party ? ' - ' + it.mp.party : ''}</span>` : null}
        ${it.outlet ? html`<span>${it.outlet}</span>` : null}
        ${it.sub ? html`<span>r/${it.sub}</span>` : null}
        ${it.score !== undefined && it.score !== null ? html`<span>${fmtN(it.score)} reactions</span>` : null}
        ${it.comments !== undefined && it.comments !== null ? html`<span>${fmtN(it.comments)} comments</span>` : null}
        ${it.ts ? html`<span>${ago(it.ts)} ago</span>` : null}
        ${typeof it.tone === 'number' && it.tone !== 0 ? html`<span class=${'tn ' + (it.tone < 0 ? 'h' : 's')}>${tone(it.tone)}</span>` : null}
      </div>
    </div>`;
  }

  /* The brief: what the research desk concluded, every claim pointing at a source id. */
  function Brief({ doc }) {
    if (!doc) return html`<div class="empty">No brief yet. Run the topic and one is written from the sources found.</div>`;
    const b = doc.brief || null;
    const srcs = doc.sources || [];
    const byId = {}; srcs.forEach(s => { byId[s.id] = s; });
    const cite = ref => { const ids = String(ref || '').match(/[WNGHAS]\d+/g) || []; return ids.map(id => byId[id] && byId[id].url ? html`<a key=${id} class="tp-src" href=${byId[id].url} target="_blank" rel="noopener">[${id}]</a>` : html`<span key=${id} class="tp-src">[${id}]</span>`); };
    const list = (arr) => (arr || []).length ? html`<ul>${arr.map((x, i) => html`<li key=${i}>${String(x).replace(/\[[WNGHAS]\d+\]/g, '')}${cite(x)}</li>`)}</ul>` : null;
    if (!b) return html`<div class="tp-brief"><div class="empty">The run filed ${fmtN((doc.counts || {}).news || 0)} news items but no brief was written${doc.sources && !doc.sources.length ? ' because nothing was found' : ' (is ANTHROPIC_API_KEY set?)'}.</div></div>`;
    return html`<div class="tp-brief">
      <div class="sum">${b.summary || ''}</div>
      ${b.volume ? html`<div style=${{ fontSize: 12.5, color: 'var(--t2)' }}>${b.volume}</div>` : null}
      ${(b.positions || []).length ? html`<h4>Who holds what position</h4>
        <table class="tp-pos"><tbody>${b.positions.map((p, i) => html`<tr key=${i}><td>${p.who}<div style=${{ fontWeight: 400, fontSize: 11, color: 'var(--t3)' }}>${p.role || ''}</div></td><td>${p.stance}${p.evidence ? html`<div class="ev">"${p.evidence}"</div>` : null}${cite(p.source)}</td></tr>`)}</tbody></table>` : null}
      ${(b.statements || []).length ? html`<h4>Statements</h4><ul>${b.statements.map((s, i) => html`<li key=${i}><b>${s.who}</b>: ${s.what}${cite(s.source)}</li>`)}</ul>` : null}
      ${(b.coverage || []).length ? html`<h4>Coverage</h4><ul>${b.coverage.map((c, i) => html`<li key=${i}><b>${c.outlet}</b>: ${c.angle}${cite(c.source)}</li>`)}</ul>` : null}
      ${(b.changes || []).length ? html`<h4>What changed</h4>${list(b.changes)}` : null}
      ${(b.risks || []).length ? html`<h4>Risks for the client</h4>${list(b.risks)}` : null}
      ${(b.openings || []).length ? html`<h4>Openings</h4>${list(b.openings)}` : null}
      ${(b.watch || []).length ? html`<h4>Watch next</h4>${list(b.watch)}` : null}
      ${(b.gaps || []).length ? html`<h4>Not covered by the sources</h4>${list(b.gaps)}` : null}
      ${srcs.length ? html`<h4>Sources (${srcs.length})</h4><div class="tp-cite">${srcs.slice(0, 60).map(s => html`<div key=${s.id}>[${s.id}] ${s.url ? html`<a href=${s.url} target="_blank" rel="noopener">${s.title}</a>` : s.title} <span style=${{ color: 'var(--t3)' }}>- ${s.origin}</span></div>`)}</div>` : null}
      <div style=${{ fontFamily: 'var(--fm)', fontSize: 10.5, color: 'var(--t3)', marginTop: 12 }}>written ${ago(doc.at)} ago from ${srcs.length} sources, ${Math.round((doc.hours || 168) / 24)} day window</div>
    </div>`;
  }

  function TopicsApp() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);
    const [sel, setSel] = useState('');
    const [res, setRes] = useState(null);
    const [tab, setTab] = useState('brief');
    const [days, setDays] = useState(30);
    const [job, setJob] = useState(null);
    const [busy, setBusy] = useState({});
    const [add, setAdd] = useState({ keyword: '', ns: 'cmm', topic: '' });
    const [probe, setProbe] = useState(null);
    const [result, setResult] = useState(null);
    const stopRef = useRef(null);
    const canWrite = !(window.AX_ROLE === 'read');
    const B = (k, v) => setBusy(b => Object.assign({}, b, { [k]: v }));

    const load = useCallback(async () => {
      try { const d = await call('/topics'); setData(d); setErr(null); if (!sel && d.topics && d.topics.length) setSel(d.topics[0].id); }
      catch (e) { setErr(e); }
    }, [sel]);
    useEffect(() => { load(); }, []);
    const loadResults = useCallback(async () => {
      if (!sel) { setRes(null); return; }
      B('res', true);
      try { setRes(await call('/topics/results?id=' + encodeURIComponent(sel) + '&days=' + days)); }
      catch (e) { setRes(null); setResult({ ok: false, text: 'Results: ' + e.message }); }
      B('res', false);
    }, [sel, days]);
    useEffect(() => { setTab('brief'); loadResults(); }, [loadResults]);
    useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);

    const topics = (data && data.topics) || [];
    const cur = topics.find(t => t.id === sel) || null;
    const clientOpts = useMemo(() => [{ id: 'cmm', name: 'Curious Minds (shared)' }].concat(clients().filter(c => c.id !== 'cmm').map(c => ({ id: c.id, name: c.short || c.name }))), []);
    const agents = ((data && data.agents) || []).filter(a => a.live);
    const xAgent = agents.some(a => (a.sources || []).indexOf('x') >= 0);

    const run = async (t) => {
      if (!t) return;
      B('run', true); setResult(null); setJob(null);
      try {
        const d = await call('/topics/run', { id: t.id });
        setJob({ id: d.id, source: 'topic', status: 'running', lines: [], follow: true });
        if (stopRef.current) stopRef.current();
        stopRef.current = tailJob(d.id, snap => setJob(snap), async snap => {
          stopRef.current = null; B('run', false);
          const r = snap.result || {};
          if (snap.success) {
            const c = r.counts || {};
            setResult({ ok: true, text: 'Run finished: ' + (c.news || 0) + ' news, ' + (c.statements || 0) + ' statements, ' + (c.hansard || 0) + ' Hansard, ' + (c.archive || 0) + ' already on file; ' + (r.filed || 0) + ' new items filed' + (r.hasBrief ? ', brief written' : ', no brief') + (r.children && r.children.x ? '. X job queued for the Mac collector' : '') + '.' });
            toastMsg('Topic researched');
          } else setResult({ ok: false, text: 'Run failed: ' + scrub(r.detail || r.error || (snap.error && snap.error.message) || 'see the console') });
          await load(); await loadResults();
        });
      } catch (e) { B('run', false); setResult({ ok: false, text: 'Could not start the run: ' + e.message }); }
    };
    const sync = async () => {
      B('sync', true); setResult(null);
      try { const r = await call('/topics/sync', {}); setResult({ ok: true, text: 'SIFA sent ' + r.received + ' keywords: ' + r.added + ' new, ' + r.updated + ' updated, ' + r.active + ' active.' }); toastMsg('Synced from SIFA'); await load(); }
      catch (e) { setResult({ ok: false, text: 'SIFA sync: ' + e.message }); toastMsg('Sync failed', true); }
      B('sync', false);
    };
    const doProbe = async () => {
      B('probe', true);
      try { setProbe(await call('/topics/probe')); } catch (e) { setProbe({ ok: false, detail: e.message }); }
      B('probe', false);
    };
    const syncMps = async () => {
      B('mps', true); setResult(null);
      try { const r = await call('/mps/sync', {}); setResult({ ok: true, text: 'MP register: ' + r.total + ' sitting members and senators, ' + r.withX + ' with an X account, ' + r.withFacebook + ' with a Facebook page.' }); toastMsg('MPs synced'); await load(); }
      catch (e) { setResult({ ok: false, text: 'MP sync: ' + e.message }); toastMsg('MP sync failed', true); }
      B('mps', false);
    };
    const addTopic = async () => {
      const kw = add.keyword.trim(); if (!kw) return;
      B('add', true);
      try { const r = await call('/topics/add', { keyword: kw, ns: add.ns, topic: add.topic }); setAdd(a => Object.assign({}, a, { keyword: '', topic: '' })); await load(); if (r.topic) setSel(r.topic.id); toastMsg('Keyword added'); }
      catch (e) { setResult({ ok: false, text: 'Add: ' + e.message }); }
      B('add', false);
    };
    const toggle = async (t, e) => {
      e.stopPropagation();
      try { await call('/topics/update', { id: t.id, active: !t.active }); await load(); } catch (er) { toastMsg('Could not update', true); }
    };
    const setNs = async (t, ns) => {
      try { await call('/topics/update', { id: t.id, ns }); await load(); } catch (er) { toastMsg('Could not update', true); }
    };

    const counts = res ? { brief: res.brief && res.brief.brief ? 1 : 0, news: res.news.length, statements: res.statements.length, hansard: res.hansard.length, x: res.x.length, reddit: res.reddit.length } : {};
    const cm = (res && res.comments) || [];
    const cmTot = cm.reduce((a, c) => a + (c.n || 0), 0), cmHos = cm.reduce((a, c) => a + (c.hostile || 0), 0);
    const sifa = (data && data.sifa) || {};
    const mps = (data && data.mps) || {};

    return html`<div class="rd-wrap">
      <div class="tp-head">
        <${Chip} on=${sifa.configured} title=${sifa.url || ''}>${sifa.configured ? 'SIFA connected' : 'SIFA token not set'}</${Chip}>
        ${sifa.last ? html`<span class="rd-chip" title=${sifa.last.error ? scrub(sifa.last.detail || sifa.last.error) : 'last pull'}>${sifa.last.ok ? 'last pull ' + ago(sifa.last.at) + ' ago, ' + sifa.last.n + ' keywords' : 'last pull failed: ' + sifa.last.error}</span>` : null}
        <${Chip} on=${sifa.inbound} title="SIFA can push keywords and read results with its own bearer key">${sifa.inbound ? 'inbound key set' : 'inbound key not set'}</${Chip}>
        <${Chip} on=${!!mps.total} title="Sitting MPs and senators with the accounts Wikidata records">${mps.total ? fmtN(mps.total) + ' MPs, ' + fmtN(mps.withX) + ' on X' : 'no MP register'}</${Chip}>
        <${Chip} on=${!!(data && data.hansard)} title="OpenAustralia Hansard search">${data && data.hansard ? 'Hansard on' : 'Hansard off (OPENAUSTRALIA_KEY)'}</${Chip}>
        <${Chip} on=${xAgent} title=${agents.length ? 'Collectors: ' + agents.map(a => a.agent).join(', ') : 'Run tools/reach-agent.py on your Mac for the MP X sweep'}>${xAgent ? 'X collector connected' : 'no X collector'}</${Chip}>
        ${canWrite ? html`<span style=${{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button class="btn sm ghost" disabled=${busy.sync} onClick=${sync} title="Pull the keyword list from SIFA now">${busy.sync ? 'Syncing...' : 'Sync from SIFA'}</button>
          <button class="btn sm ghost" disabled=${busy.probe} onClick=${doProbe} title="Show what SIFA answers, raw">${busy.probe ? '...' : 'Probe'}</button>
          <button class="btn sm ghost" disabled=${busy.mps} onClick=${syncMps} title="Rebuild the MP register from Wikidata">${busy.mps ? 'Syncing...' : 'Sync MPs'}</button>
        </span>` : null}
      </div>
      ${probe ? html`<div class="panel" style=${{ marginBottom: 12 }}><div class="phead"><div class="ptitle">What SIFA answers</div><span class="ptag">${probe.ok ? 'HTTP ' + probe.status + ' - ' + (probe.keywords || []).length + ' keywords read' : (probe.error || 'failed')}</span><button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${() => setProbe(null)}>Close</button></div>
        ${probe.ok ? html`<div class="tp-raw">${probe.sample}</div><div style=${{ fontSize: 12, color: 'var(--t2)', marginTop: 8 }}>Read as: ${(probe.keywords || []).slice(0, 12).map(k => k.keyword + (k.topic ? ' (' + k.topic + ')' : '')).join(', ')}${(probe.keywords || []).length > 12 ? ' ...' : ''}</div>` : html`<div class="rd-res err">${scrub(probe.detail || probe.error || '')}</div>`}</div>` : null}
      ${canWrite ? html`<div class="tp-head" style=${{ marginBottom: 14 }}>
        <input class="fi" value=${add.keyword} placeholder="Add a keyword or topic to research, e.g. critical minerals strategic reserve" onInput=${e => setAdd(a => Object.assign({}, a, { keyword: e.target.value }))} onKeyDown=${e => { if (e.key === 'Enter') addTopic(); }} aria-label="New keyword" />
        <input class="fi" style=${{ maxWidth: 180, flex: '0 1 180px' }} value=${add.topic} placeholder="Topic label (optional)" onInput=${e => setAdd(a => Object.assign({}, a, { topic: e.target.value }))} aria-label="Topic label" />
        <select class="sel" value=${add.ns} onChange=${e => setAdd(a => Object.assign({}, a, { ns: e.target.value }))} aria-label="Client">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        <button class="btn sm" disabled=${busy.add || !add.keyword.trim()} onClick=${addTopic}>Add</button>
      </div>` : null}
      ${err ? html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}>${err.status === 404 || err.code === 'not_found' ? html`<b>The worker needs updating.</b> The live worker has no <code>/topics</code> routes yet. Deploy the latest worker, then reload.` : err.code === 'unauthorized' || err.status === 401 ? html`<b>No access key.</b> Open Settings, paste your key, save, then reload.` : html`<b>The worker returned an error:</b> <code>${err.message}</code>`}</div>` : null}
      ${result ? html`<div class=${'rd-res ' + (result.ok ? 'ok' : 'err')}>${result.text}</div>` : null}
      <${Console} job=${job} canWrite=${canWrite} onCancel=${() => {}} />
      <div class="tp-grid">
        <div class="panel">
          <div class="phead"><div class="ptitle">Keywords</div><span class="ptag">${topics.filter(t => t.active).length} ACTIVE</span></div>
          ${!topics.length ? html`<div class="empty">${data ? (sifa.configured ? 'Nothing from SIFA yet. Press Sync from SIFA, or add a keyword above.' : 'No keywords yet. Set SIFA_TOKEN on the worker and press Sync from SIFA, or add a keyword above.') : 'Loading...'}</div>` : null}
          <div>${topics.map(t => html`<div key=${t.id} class=${'tp-row' + (t.id === sel ? ' on' : '') + (t.active ? '' : ' off')} onClick=${() => setSel(t.id)}>
            <div>
              <div class="kw">${t.keyword}</div>
              <div class="m">
                ${t.topic ? html`<span class="rd-chip i">${t.topic}</span>` : null}
                <span class="rd-chip">${clientName(t.ns)}</span>
                <span>${t.source === 'manual' ? 'added here' : 'from SIFA'}</span>
                <span>${t.last_run ? 'run ' + ago(t.last_run) + ' ago' : 'never run'}</span>
                ${t.hits ? html`<span>${fmtN(t.hits)} items</span>` : null}
              </div>
            </div>
            <div class="act" onClick=${e => e.stopPropagation()}>
              ${canWrite ? html`<select class="sel" value=${t.ns || 'cmm'} onChange=${e => setNs(t, e.target.value)} style=${{ padding: '4px 8px', fontSize: 10.5 }} aria-label="Client for this keyword">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>` : null}
              ${canWrite ? html`<label class="rd-chip" style=${{ cursor: 'pointer' }} title="Active keywords are researched on the cron"><input type="checkbox" checked=${!!t.active} onChange=${e => toggle(t, e)} style=${{ marginRight: 4 }} />on</label>` : null}
              ${canWrite ? html`<button class="btn sm" disabled=${busy.run} onClick=${() => { setSel(t.id); run(t); }} title="Research this keyword now">${busy.run && job && cur && cur.id === t.id ? 'Running...' : 'Run'}</button>` : null}
            </div>
          </div>`)}</div>
        </div>
        <div class="panel">
          <div class="phead"><div class="ptitle">${cur ? cur.keyword : 'Results'}</div>
            <div class="rd-ctl" style=${{ margin: 0 }}>
              <select class="sel" value=${days} onChange=${e => setDays(+e.target.value)} aria-label="Window" style=${{ padding: '6px 10px', fontSize: 11 }}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select>
              ${cur ? html`<span class="ptag">${clientName(cur.ns)}</span>` : null}
            </div>
          </div>
          ${!cur ? html`<div class="empty">Pick a keyword to see what is on file for it.</div>` : busy.res && !res ? html`<div class="empty">Loading...</div>` : res ? html`
            <div class="sen-strip aud-strip" style=${{ marginBottom: 10 }}>
              <div class="sen-stat"><div class="k">News</div><div class="v">${fmtN(res.news.length)}</div><div class="s">articles</div></div>
              <div class="sen-stat"><div class="k">Statements</div><div class="v">${fmtN(res.statements.length)}</div><div class="s">gov and party</div></div>
              <div class="sen-stat"><div class="k">Parliament</div><div class="v">${fmtN(res.hansard.length)}</div><div class="s">Hansard speeches</div></div>
              <div class="sen-stat"><div class="k">MPs on X</div><div class="v">${fmtN(res.x.filter(p => p.mp).length)}</div><div class="s">of ${fmtN(res.x.length)} posts</div></div>
              <div class="sen-stat"><div class="k">Comments</div><div class="v">${fmtN(cmTot)}</div><div class="s">${cmTot ? Math.round(cmHos / cmTot * 100) + '% hostile' : 'none held'}</div></div>
            </div>
            ${(res.jobs || []).length ? html`<div class="tp-jobs">${res.jobs.slice(0, 6).map(j => html`<span key=${j.id} class=${'tp-job ' + j.status} title=${j.id}>${j.source} ${j.status}${j.agent ? ' on ' + j.agent : ''} - ${ago(j.created)} ago</span>`)}</div>` : null}
            <div class="tp-tabs">${TABS.map(([id, label]) => html`<button key=${id} class=${'tp-tab' + (tab === id ? ' on' : '')} onClick=${() => setTab(id)}>${label}${id !== 'brief' ? html`<span class="n">${fmtN(counts[id] || 0)}</span>` : null}</button>`)}</div>
            ${tab === 'brief' ? html`<${Brief} doc=${res.brief} />`
              : tab === 'x' ? (res.x.length ? res.x.map((it, i) => html`<${Item} key=${i} it=${it} showMp=${true} />`) : html`<div class="empty">${xAgent ? 'No posts yet. The X job runs on the Mac collector after a Run; check back in a minute.' : 'The MP account sweep needs the collector on your Mac: cd ~/Axiom && python3 tools/reach-agent.py --key $AXIOM_KEY'}</div>`)
              : tab === 'reddit' ? (res.reddit.length ? res.reddit.map((it, i) => html`<${Item} key=${i} it=${it} />`) : html`<div class="empty">No Reddit threads on file for this keyword in the window.</div>`)
              : (res[tab] || []).length ? res[tab].map((it, i) => html`<${Item} key=${i} it=${it} showMp=${tab === 'hansard'} />`)
              : html`<div class="empty">${tab === 'hansard' && !(data && data.hansard) ? 'Hansard search is off. Set OPENAUSTRALIA_KEY on the worker (free key from openaustralia.org.au).' : 'Nothing on file in this window. Press Run.'}</div>`}
          ` : html`<div class="empty">Nothing on file yet. Press Run.</div>`}
        </div>
      </div>
    </div>`;
  }

  let mounted = false;
  window.topicsInit = function () {
    const root = document.getElementById('topics-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${TopicsApp} />`); }
  };
})();
