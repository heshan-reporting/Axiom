/* AXIOM - the Release Desk. A media release in, a pack of social tiles out.
 *
 * A React island (React, ReactDOM and htm vendored under docs/vendor; shared
 * pieces from docs/ax-ui.js). Paste the release, pick the client, press Build.
 * The worker extracts what the release actually says, composes a set of tiles
 * in the client's voice from the playbook in the Mind, and this view tails the
 * job so every step shows as it happens. Tiles then render one at a time in the
 * client's stored brand kit; each one can be edited, re-rendered, downloaded,
 * or handed to the Ad Lab canvas for layer-level work. Every figure on a tile
 * is checked back against the release and flagged if it is not there.
 */
(function () {
  'use strict';
  if (!window.AXUI) {
    window.releaseInit = function () {
      const root = document.getElementById('release-root');
      if (root) root.innerHTML = '<div class="aud-notice" style="margin:12px 0"><b>The React runtime did not load.</b> The files under <code>docs/vendor/</code> are missing from this deployment. Redeploy the site and reload.</div>';
    };
    return;
  }
  const { html, call, blobUrl, toastMsg, ago, Console, tailJob } = window.AXUI;
  const { useState, useEffect, useMemo, useCallback, useRef } = React;

  const clients = () => (typeof CC_CLIENTS !== 'undefined' && Array.isArray(CC_CLIENTS) ? CC_CLIENTS : []);
  const clientOf = id => clients().find(c => c.id === id) || null;
  const FORMATS = [['square', 'Square 1:1'], ['portrait', 'Portrait 4:5'], ['story', 'Story 9:16'], ['landscape', 'Landscape 16:9']];
  const KIND_LABEL = { lead: 'Lead', stat: 'The number', people: 'People', proof: 'Proof', warning: 'The test', quote: 'Quote', cta: 'Call to action' };
  const CAPTIONS = [['linkedin', 'LinkedIn'], ['x', 'X'], ['facebook', 'Facebook']];

  /* A private image behind the access key: fetched with the key, shown from a
     blob URL, revoked when the tile changes or unmounts. */
  function useTileImage(url) {
    const [src, setSrc] = useState('');
    useEffect(() => {
      let alive = true, obj = '';
      if (!url) { setSrc(''); return; }
      blobUrl(url).then(u => { if (alive) { obj = u; setSrc(u); } else URL.revokeObjectURL(u); }).catch(() => { if (alive) setSrc(''); });
      return () => { alive = false; if (obj) URL.revokeObjectURL(obj); };
    }, [url]);
    return src;
  }

  function Check({ check }) {
    if (!check) return null;
    return check.ok
      ? html`<span class="rel-chk ok" title="Every figure on this tile appears in the release">figures traced</span>`
      : html`<span class="rel-chk warn" title="These figures do not appear in the release text - check before publishing">not in release: ${(check.missing || []).join(', ')}</span>`;
  }

  /* Teach mode: what the model wrote, what it should have been, why, and how
     far the lesson reaches. One form, one post, in force on the next build. */
  function TeachForm({ tile, ns, onTeach, onClose }) {
    const [f, setF] = useState({ wrong: [tile.headline, tile.support, tile.cta].filter(Boolean).join(' / '), right: '', why: '', scope: 'client', task: 'tiles' });
    const [busy, setBusy] = useState(false);
    const c = clientOf(ns) || {};
    const submit = async () => {
      if (!f.wrong.trim() && !f.right.trim()) return;
      setBusy(true);
      try { await onTeach(Object.assign({}, f, { source: 'tile ' + (tile.n + 1) })); onClose(); } catch (e) {}
      setBusy(false);
    };
    return html`<div class="rel-teach">
      <div class="rel-lbl">What it wrote</div>
      <textarea class="fi" rows="2" value=${f.wrong} onInput=${e => setF(x => Object.assign({}, x, { wrong: e.target.value }))} aria-label="What it wrote"></textarea>
      <div class="rel-lbl">What it should have been</div>
      <textarea class="fi" rows="2" value=${f.right} placeholder="The wording you would have signed off" onInput=${e => setF(x => Object.assign({}, x, { right: e.target.value }))} aria-label="What it should have been"></textarea>
      <div class="rel-lbl">Why (optional, but this is what makes the rule general)</div>
      <input class="fi" value=${f.why} placeholder=${'e.g. "subsidy" is the opposition\'s word for the fuel tax credit'} onInput=${e => setF(x => Object.assign({}, x, { why: e.target.value }))} aria-label="Why" />
      <div class="rd-ctl" style=${{ marginTop: 6 }}>
        <select class="sel" value=${f.scope} onChange=${e => setF(x => Object.assign({}, x, { scope: e.target.value }))} aria-label="Scope" style=${{ padding: '6px 10px', fontSize: 11 }}><option value="client">${c.short || ns.toUpperCase()} only</option><option value="all">Every client</option></select>
        <select class="sel" value=${f.task} onChange=${e => setF(x => Object.assign({}, x, { task: e.target.value }))} aria-label="Applies to" style=${{ padding: '6px 10px', fontSize: 11 }}><option value="tiles">Tile packs</option><option value="copy">All copy</option><option value="any">Everything</option></select>
        <button class="btn sm" disabled=${busy || (!f.wrong.trim() && !f.right.trim())} onClick=${submit}>${busy ? 'Teaching...' : 'Teach the Engine'}</button>
        <button class="btn sm ghost" onClick=${onClose}>Cancel</button>
      </div>
    </div>`;
  }

  function Tile({ tile, pack, canWrite, busy, verdict, onRender, onSave, onCanvas, onTeach, onVerdict }) {
    const img = useTileImage(tile.image ? tile.image.url : '');
    const [edit, setEdit] = useState(false);
    const [teach, setTeach] = useState(false);
    const [draft, setDraft] = useState({ headline: tile.headline, support: tile.support, cta: tile.cta });
    const [cap, setCap] = useState('linkedin');
    useEffect(() => { setDraft({ headline: tile.headline, support: tile.support, cta: tile.cta }); }, [tile.headline, tile.support, tile.cta]);
    const dirty = draft.headline !== tile.headline || draft.support !== tile.support || draft.cta !== tile.cta;
    const copyCap = async () => { try { await navigator.clipboard.writeText(tile.caption[cap] || ''); toastMsg('Caption copied'); } catch (e) { toastMsg('Could not copy', true); } };
    const download = () => {
      if (!img) return;
      const a = document.createElement('a'); a.href = img; a.download = (pack.ns + '-' + (pack.title || 'tile').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + (tile.n + 1) + '-' + tile.kind + '.png'); document.body.appendChild(a); a.click(); a.remove();
    };
    return html`<div class=${'rel-tile' + (busy ? ' busy' : '')}>
      <div class=${'rel-art ' + pack.format}>
        ${img ? html`<img src=${img} alt=${tile.alt || tile.headline} />`
          : busy ? html`<div class="rel-shimmer"><span>rendering in the brand...</span></div>`
          : html`<div class="rel-empty"><div class="hl">${tile.headline}</div>${tile.support ? html`<div class="sp">${tile.support}</div>` : null}<span class="rd-chip">not rendered yet</span></div>`}
        <span class="rel-kind">${KIND_LABEL[tile.kind] || tile.kind}</span>
        ${tile.image ? html`<span class="rel-ver" title=${'rendered by ' + tile.image.model}>v${tile.image.ver}</span>` : null}
      </div>
      <div class="rel-copy">
        ${edit ? html`
          <input class="fi" value=${draft.headline} maxLength="90" onInput=${e => setDraft(d => Object.assign({}, d, { headline: e.target.value }))} aria-label="Headline" />
          <textarea class="fi" rows="2" maxLength="180" value=${draft.support} onInput=${e => setDraft(d => Object.assign({}, d, { support: e.target.value }))} aria-label="Support line"></textarea>
          <input class="fi" value=${draft.cta} maxLength="40" placeholder="CTA (optional)" onInput=${e => setDraft(d => Object.assign({}, d, { cta: e.target.value }))} aria-label="Call to action" />`
        : html`<div class="hl">${tile.headline}</div>${tile.support ? html`<div class="sp">${tile.support}</div>` : null}${tile.cta ? html`<div class="cta">${tile.cta}</div>` : null}`}
        <div class="rel-meta"><${Check} check=${tile.check} />${verdict ? html`<span class=${'rel-chk ' + (verdict === 'approved' ? 'ok' : 'warn')}>${verdict}</span>` : null}${tile.image ? html`<span class="rd-chip">${ago(tile.image.rendered)} ago</span>` : null}</div>
      </div>
      ${teach ? html`<${TeachForm} tile=${tile} ns=${pack.ns} onTeach=${onTeach} onClose=${() => setTeach(false)} />` : null}
      <div class="rel-caps">
        <div class="rel-captabs">${CAPTIONS.map(([k, l]) => html`<button key=${k} class=${'rel-captab' + (cap === k ? ' on' : '')} onClick=${() => setCap(k)}>${l}</button>`)}<button class="btn sm ghost" style=${{ marginLeft: 'auto' }} onClick=${copyCap}>Copy</button></div>
        <div class="rel-capbody">${(tile.caption && tile.caption[cap]) || html`<i>no ${cap} caption</i>`}</div>
      </div>
      ${canWrite ? html`<div class="rel-acts">
        ${edit ? html`<button class="btn sm" disabled=${busy} onClick=${() => { onSave(tile.n, draft); setEdit(false); }}>Save copy</button>
                 <button class="btn sm ghost" disabled=${busy} onClick=${() => { onRender(tile.n, dirty ? draft : null); setEdit(false); }}>Save + render</button>
                 <button class="btn sm ghost" onClick=${() => { setDraft({ headline: tile.headline, support: tile.support, cta: tile.cta }); setEdit(false); }}>Cancel</button>`
        : html`<button class="btn sm ghost" disabled=${busy} onClick=${() => setEdit(true)}>Edit copy</button>
               <button class="btn sm ghost" disabled=${busy} onClick=${() => onRender(tile.n, null)} title=${tile.image ? 'Render a fresh version in the brand' : 'Render this tile in the brand'}>${tile.image ? 'Re-render' : 'Render'}</button>
               <button class=${'btn sm ghost' + (teach ? ' on' : '')} onClick=${() => setTeach(t => !t)} title="Teach the Engine what this should have been - it applies to every build from now on">Fix this</button>
               ${tile.image ? html`<button class="btn sm ghost" onClick=${download}>Download PNG</button>
               <button class="btn sm ghost" onClick=${() => onCanvas(tile, img)} title="Open the artwork in the Ad Lab canvas with the copy as editable layers">Open in canvas</button>
               <button class=${'btn sm' + (verdict === 'approved' ? '' : ' ghost')} onClick=${() => onVerdict(tile, 'approved')} title="Record this as approved: the Engine keeps it as an example of what works">${verdict === 'approved' ? 'Approved' : 'Approve'}</button>
               <button class="btn sm ghost" onClick=${() => { const why = window.prompt('Why is this one killed? (one line, optional)') || ''; onVerdict(tile, 'killed', why); }} title="Record this as killed, with the reason">Kill</button>` : null}`}
      </div>` : null}
    </div>`;
  }

  function BrandPanel({ ns, kit, logoUrl, canWrite, onSaved, onClose }) {
    const c = clientOf(ns) || {};
    const [f, setF] = useState(() => ({
      name: (kit && kit.name) || c.name || '', primary: (kit && kit.palette && kit.palette.primary) || c.accent || '#3F8CFF', secondary: (kit && kit.palette && kit.palette.secondary) || c.accent2 || '',
      bg: (kit && kit.palette && kit.palette.bg) || '#0F1420', text: (kit && kit.palette && kit.palette.text) || '#FFFFFF',
      display: (kit && kit.fonts && kit.fonts.display) || '', body: (kit && kit.fonts && kit.fonts.body) || '',
      voice: (kit && kit.voice) || c.brief || '', rules: (kit && kit.rules) || '', logoB64: '', logoMime: '', removeLogo: false,
    }));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const logo = useTileImage(f.logoB64 ? '' : logoUrl);
    const onLogo = e => {
      const file = e.target.files && e.target.files[0]; if (!file) return;
      if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { setErr('Logo must be PNG, JPEG or WebP.'); return; }
      if (file.size > 2 * 1024 * 1024) { setErr('Logo must be under 2 MB.'); return; }
      const rd = new FileReader(); rd.onload = () => setF(x => Object.assign({}, x, { logoB64: String(rd.result).split(',')[1], logoMime: file.type, removeLogo: false })); rd.readAsDataURL(file);
    };
    const save = async () => {
      setBusy(true); setErr('');
      try {
        const body = { ns, name: f.name, palette: { primary: f.primary, secondary: f.secondary, bg: f.bg, text: f.text }, fonts: { display: f.display, body: f.body }, voice: f.voice, rules: f.rules };
        if (f.logoB64) { body.logoB64 = f.logoB64; body.logoMime = f.logoMime; }
        if (f.removeLogo) body.removeLogo = true;
        const d = await call('/brand/kit', body);
        toastMsg('Brand kit saved'); onSaved(d);
      } catch (e) { setErr(e.message); }
      setBusy(false);
    };
    const Col = ({ k, label }) => html`<label class="rel-col"><span>${label}</span><input type="color" value=${/^#[0-9a-f]{6}$/i.test(f[k]) ? f[k] : '#000000'} onInput=${e => setF(x => Object.assign({}, x, { [k]: e.target.value }))} /><input class="fi" value=${f[k]} onInput=${e => setF(x => Object.assign({}, x, { [k]: e.target.value }))} /></label>`;
    return html`<div class="panel rel-brand">
      <div class="phead"><div class="ptitle">Brand kit - ${c.short || ns.toUpperCase()}</div><span class="ptag">${kit ? 'SET ' + ago(kit.updated) + ' AGO' : 'NOT SET'}</span></div>
      <div class="rel-brandgrid">
        <div>
          <div class="rel-logo">${f.logoB64 ? html`<img src=${'data:' + f.logoMime + ';base64,' + f.logoB64} alt="New logo" />` : logo && !f.removeLogo ? html`<img src=${logo} alt="Logo" />` : html`<span>no logo</span>`}</div>
          ${canWrite ? html`<div class="rd-ctl"><label class="btn sm ghost">Upload logo<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange=${onLogo} /></label>${(kit && kit.hasLogo) || f.logoB64 ? html`<button class="btn sm ghost" onClick=${() => setF(x => Object.assign({}, x, { logoB64: '', removeLogo: true }))}>Remove</button>` : null}</div>` : null}
          <div class="rel-cols"><${Col} k="primary" label="Primary" /><${Col} k="secondary" label="Secondary" /><${Col} k="bg" label="Background" /><${Col} k="text" label="Text" /></div>
          <div class="rd-ctl"><input class="fi" placeholder="Display font" value=${f.display} onInput=${e => setF(x => Object.assign({}, x, { display: e.target.value }))} /><input class="fi" placeholder="Body font" value=${f.body} onInput=${e => setF(x => Object.assign({}, x, { body: e.target.value }))} /></div>
        </div>
        <div>
          <label class="rel-lbl">Voice - how this client speaks</label>
          <textarea class="fi" rows="7" value=${f.voice} onInput=${e => setF(x => Object.assign({}, x, { voice: e.target.value }))}></textarea>
          <label class="rel-lbl">Standing rules - never / always</label>
          <textarea class="fi" rows="3" value=${f.rules} placeholder="e.g. Never call the fuel tax credit a subsidy. Always lead with jobs and regions." onInput=${e => setF(x => Object.assign({}, x, { rules: e.target.value }))}></textarea>
        </div>
      </div>
      ${err ? html`<div class="rd-res err">${err}</div>` : null}
      <div class="rd-ctl" style=${{ marginTop: 10 }}>
        ${canWrite ? html`<button class="btn sm" disabled=${busy} onClick=${save}>${busy ? 'Saving...' : 'Save brand kit'}</button>` : html`<span class="rd-chip">read-only key: view only</span>`}
        <button class="btn sm ghost" onClick=${onClose}>Close</button>
        <span class="sig-where">Set once per client. Every tile renders with these colours, fonts and logo.</span>
      </div>
    </div>`;
  }

  /* What the Engine has been taught for this client: switch off, delete. */
  function LearnedPanel({ ns, fixes, canWrite, onToggle, onDelete, onClose }) {
    const c = clientOf(ns) || {};
    return html`<div class="panel rel-brand">
      <div class="phead"><div class="ptitle">What the Engine has learned - ${c.short || ns.toUpperCase()}</div><span class="ptag">${fixes.filter(f => f.active).length} IN FORCE</span></div>
      ${!fixes.length ? html`<div class="empty">Nothing taught yet. Press <b>Fix this</b> on any tile that is not quite right; the correction becomes a standing rule for the next build.</div>`
        : html`<div class="rel-hist">${fixes.map(f => html`<div key=${f.id} class=${'rel-fix' + (f.active ? '' : ' off')}>
            <div class="r">${f.rule}</div>
            <div class="m">${f.scope === 'all' ? 'every client' : (c.short || ns)} - ${f.task === 'any' ? 'everything' : f.task} - applied ${f.hits} time${f.hits === 1 ? '' : 's'} - ${ago(f.created)} ago${f.who ? ' - ' + f.who : ''}${f.wrong ? html`<div class="w">was: "${f.wrong.slice(0, 140)}"</div>` : null}${f.right ? html`<div class="w">should be: "${f.right.slice(0, 140)}"</div>` : null}</div>
            ${canWrite ? html`<div class="rd-ctl" style=${{ margin: 0 }}><button class="btn sm ghost" onClick=${() => onToggle(f)}>${f.active ? 'Switch off' : 'Switch on'}</button><button class="btn sm ghost" onClick=${() => { if (window.confirm('Delete this correction? The Engine will forget it.')) onDelete(f); }}>Delete</button></div>` : null}
          </div>`)}</div>`}
      <div class="rd-ctl" style=${{ marginTop: 10 }}><button class="btn sm ghost" onClick=${onClose}>Close</button><span class="sig-where">Corrections are in the prompt within the minute. Switched-off ones stay on record.</span></div>
    </div>`;
  }

  function Notice({ err, plat }) {
    const e = String((err && err.message) || ''); const code = (err && err.code) || '';
    let body;
    if (err && (code === 'not_found' || err.status === 404)) body = html`<b>The worker needs updating.</b> The live Cloudflare worker does not have the <code>/release</code> routes. Paste the latest <code>axiomworkerv4.js</code> into newsaus and Deploy, then reload.`;
    else if (err && (code === 'unauthorized' || err.status === 401)) body = html`<b>No access key.</b> Open Settings, paste your key, save, then reload.`;
    else if (err && (code === 'mind_unbound' || code === 'mind_not_configured')) body = html`<b>Storage not bound.</b> ${e}`;
    else if (err && code === 'analysis_not_configured') body = html`<b>Claude is not configured on the worker.</b> ${e}`;
    else if (err) body = html`<b>The worker returned an error:</b> <code>${e}</code>`;
    return body ? html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}>${body}</div>` : null;
  }

  function ReleaseApp() {
    const active = (typeof CC_ACTIVE !== 'undefined' && CC_ACTIVE) || 'mca';
    const [ns, setNs] = useState(clientOf(active) ? active : ((clients()[0] || {}).id || 'mca'));
    const [text, setText] = useState('');
    const [count, setCount] = useState(6);
    const [format, setFormat] = useState('square');
    const [job, setJob] = useState(null);
    const [pack, setPack] = useState(null);
    const [err, setErr] = useState(null);
    const [busy, setBusy] = useState({ build: false });
    const [rendering, setRendering] = useState(() => new Set());
    const [autoRender, setAutoRender] = useState(true);
    const [kit, setKit] = useState(null);
    const [logoUrl, setLogoUrl] = useState('');
    const [showBrand, setShowBrand] = useState(false);
    const [history, setHistory] = useState([]);
    const [result, setResult] = useState(null);
    const [fixes, setFixes] = useState([]);
    const [showLearned, setShowLearned] = useState(false);
    const [verdicts, setVerdicts] = useState({});
    const stopRef = useRef(null);
    const autoRef = useRef(true);
    const canWrite = !(window.AX_ROLE === 'read');
    const client = clientOf(ns) || { name: ns, short: ns.toUpperCase() };

    const loadKit = useCallback(async () => {
      try { const d = await call('/brand/kit?ns=' + ns); setKit(d.kit); setLogoUrl(d.logoUrl || ''); setErr(null); } catch (e) { setKit(null); setErr(e); }
    }, [ns]);
    const loadHistory = useCallback(async () => {
      try { const d = await call('/release/list?ns=' + ns + '&limit=12'); setHistory(d.packs || []); } catch (e) { /* the kit call reports */ }
    }, [ns]);
    const loadFixes = useCallback(async () => {
      try { const d = await call('/engine/fixes?ns=' + ns + '&all=1'); setFixes(d.fixes || []); } catch (e) { setFixes([]); }
    }, [ns]);
    const loadVerdicts = useCallback(async (packId) => {
      try { const d = await call('/engine/outcomes?ns=' + ns + '&limit=200'); const m = {}; (d.outcomes || []).filter(o => o.ref === packId).forEach(o => { m[o.n] = m[o.n] || o.verdict; }); setVerdicts(m); } catch (e) { setVerdicts({}); }
    }, [ns]);
    useEffect(() => { loadKit(); loadHistory(); loadFixes(); setPack(null); setJob(null); setResult(null); setVerdicts({}); }, [loadKit, loadHistory, loadFixes]);
    useEffect(() => () => { if (stopRef.current) stopRef.current(); }, []);
    useEffect(() => { autoRef.current = autoRender; }, [autoRender]);

    const openPack = useCallback(async (id) => {
      const d = await call('/release/pack?id=' + encodeURIComponent(id));
      setPack(d.pack); loadVerdicts(id); return d.pack;
    }, [loadVerdicts]);
    const onTeach = async (f) => {
      const d = await call('/engine/fix', { ns, task: f.task, scope: f.scope, wrong: f.wrong, right: f.right, why: f.why, source: (pack ? pack.id + ' ' : '') + (f.source || '') });
      setFixes(x => [d.fix].concat(x));
      setResult({ ok: true, text: 'Learned: "' + d.fix.rule + '" - in force for ' + (f.scope === 'all' ? 'every client' : client.short) + ' from the next build.' });
      toastMsg('The Engine learned it');
    };
    const onVerdict = async (tile, verdict, why) => {
      try {
        await call('/engine/outcome', { ns, surface: 'release', ref: pack.id, n: tile.n, verdict, why: why || '', headline: tile.headline, support: tile.support, cta: tile.cta });
        setVerdicts(v => Object.assign({}, v, { [tile.n]: verdict }));
        toastMsg(verdict === 'approved' ? 'Approved - kept as an example of what works' : 'Killed - kept as an example of what does not');
      } catch (e) { toastMsg('Could not record it: ' + e.message, true); }
    };
    const onToggleFix = async (f) => { try { await call('/engine/fix/update', { id: f.id, active: !f.active }); setFixes(x => x.map(y => y.id === f.id ? Object.assign({}, y, { active: !f.active }) : y)); } catch (e) { toastMsg(e.message, true); } };
    const onDeleteFix = async (f) => { try { await call('/engine/fix/delete', { id: f.id }); setFixes(x => x.filter(y => y.id !== f.id)); } catch (e) { toastMsg(e.message, true); } };

    /* Render tiles one after another so each request stays short and the grid
       fills in as it goes. Stops if the operator turns auto-render off. */
    const renderQueue = useCallback(async (p, only) => {
      const todo = (only ? [only] : p.tiles.filter(t => !t.image).map(t => t.n));
      for (const n of todo) {
        if (!autoRef.current && !only) break;
        setRendering(s => { const x = new Set(s); x.add(n); return x; });
        try {
          const r = await call('/release/render', { id: p.id, n });
          setPack(pp => pp && pp.id === p.id ? Object.assign({}, pp, { status: r.complete ? 'rendered' : pp.status, tiles: pp.tiles.map(t => t.n === n ? Object.assign({}, t, r.tile, { image: { url: r.url, model: r.model, rendered: Date.now(), ver: (r.tile.image && r.tile.image.ver) || 1 } }) : t) }) : pp);
        } catch (e) { setResult({ ok: false, text: 'Tile ' + (n + 1) + ': ' + e.message }); if (/gemini_not_configured|mind_not_configured/.test(e.code || '')) break; }
        setRendering(s => { const x = new Set(s); x.delete(n); return x; });
      }
      loadHistory();
    }, [loadHistory]);

    const build = async () => {
      const t = text.trim();
      if (t.length < 200) { setResult({ ok: false, text: 'Paste the whole release - at least a few paragraphs.' }); return; }
      setBusy({ build: true }); setResult(null); setPack(null); setJob(null);
      if (stopRef.current) stopRef.current();
      try {
        const d = await call('/release/pack', { ns, text: t, tiles: count, format, brief: (client.brief || '').slice(0, 3000) });
        setJob({ id: d.job, status: 'running', lines: [], follow: true, title: 'Release Desk - ' + client.short });
        stopRef.current = tailJob(d.job, j => setJob(Object.assign({ title: 'Release Desk - ' + client.short }, j)), async (j) => {
          setJob(Object.assign({ title: 'Release Desk - ' + client.short }, j));
          setBusy({ build: false });
          if (j.success) {
            const p = await openPack(d.id);
            const flagged = p.tiles.filter(x => x.check && !x.check.ok).length;
            setResult({ ok: true, text: 'Pack composed: ' + p.tiles.length + ' tiles for ' + client.short + '.' + (flagged ? ' ' + flagged + ' carry a figure not found in the release - flagged amber, check before publishing.' : ' Every figure traces back to the release.') + (autoRef.current ? ' Rendering in the brand now.' : '') });
            toastMsg('Pack composed');
            if (autoRef.current) renderQueue(p);
          } else {
            const rr = (j.result || {});
            setResult({ ok: false, text: 'Compose failed: ' + (rr.detail || rr.error || (j.error && j.error.message) || 'see the console') });
            toastMsg('Compose failed', true);
          }
        });
      } catch (e) { setBusy({ build: false }); setResult({ ok: false, text: 'Could not start: ' + e.message }); if (e.status === 404 || e.status === 401 || e.status === 501) setErr(e); }
    };
    const onRender = async (n, patch) => {
      if (!pack) return;
      setRendering(s => { const x = new Set(s); x.add(n); return x; });
      try {
        const r = await call('/release/render', { id: pack.id, n, patch: patch || undefined });
        setPack(pp => Object.assign({}, pp, { status: r.complete ? 'rendered' : pp.status, tiles: pp.tiles.map(t => t.n === n ? Object.assign({}, t, r.tile, { image: { url: r.url, model: r.model, rendered: Date.now(), ver: (r.tile.image && r.tile.image.ver) || 1 } }) : t) }));
        toastMsg('Tile ' + (n + 1) + ' rendered');
      } catch (e) { setResult({ ok: false, text: 'Tile ' + (n + 1) + ': ' + e.message }); toastMsg('Render failed', true); }
      setRendering(s => { const x = new Set(s); x.delete(n); return x; });
    };
    const onSave = async (n, draft) => {
      if (!pack) return;
      try { const r = await call('/release/update', { id: pack.id, n, patch: draft }); setPack(pp => Object.assign({}, pp, { tiles: pp.tiles.map(t => t.n === n ? Object.assign({}, t, r.tile, { image: t.image }) : t) })); toastMsg('Copy saved'); }
      catch (e) { setResult({ ok: false, text: 'Save: ' + e.message }); }
    };
    /* Hand a rendered tile to the Ad Lab canvas: the art as the base, the copy
       as editable layers, the client's logo if the kit has one. */
    const onCanvas = async (tile, img) => {
      if (typeof alSeedFromDesk !== 'function') { toastMsg('Ad Lab canvas is not available on this page', true); return; }
      try {
        const r = await fetch(img); const blob = await r.blob();
        const b64 = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = rej; rd.readAsDataURL(blob); });
        let logo = null;
        if (logoUrl) { try { const lr = await fetch(window.AXUI.base() + logoUrl, { headers: window.AXUI.hdrs() }); const lb = await lr.blob(); logo = { mime: lb.type || 'image/png', data: await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = rej; rd.readAsDataURL(lb); }) }; } catch (e) { logo = null; } }
        alSeedFromDesk({ ns, b64, mime: blob.type || 'image/png', headline: tile.headline, support: tile.support, cta: tile.cta, format: pack.format, logo, source: 'Release Desk - ' + (pack.title || '') });
      } catch (e) { toastMsg('Could not open the canvas: ' + e.message, true); }
    };
    const downloadAll = () => {
      // one download per rendered tile, spaced so the browser accepts them all
      const rendered = (pack && pack.tiles.filter(t => t.image)) || [];
      rendered.forEach((t, i) => setTimeout(async () => {
        try { const u = await blobUrl(t.image.url); const a = document.createElement('a'); a.href = u; a.download = pack.ns + '-' + (t.n + 1) + '-' + t.kind + '.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) {}
      }, i * 450));
      if (rendered.length) toastMsg('Downloading ' + rendered.length + ' tiles');
    };

    const clientOpts = useMemo(() => clients().filter(c => c.id !== 'cmm').map(c => ({ id: c.id, name: c.short ? c.short + ' - ' + c.name : c.name })), []);
    const rendered = pack ? pack.tiles.filter(t => t.image).length : 0;

    return html`<div class="rd-wrap">
      <div class="rd-ctl rel-top">
        <select class="sel" value=${ns} onChange=${e => setNs(e.target.value)} aria-label="Client">${clientOpts.map(c => html`<option key=${c.id} value=${c.id}>${c.name}</option>`)}</select>
        <select class="sel" value=${count} onChange=${e => setCount(+e.target.value)} aria-label="Tiles"><option value="3">3 tiles</option><option value="4">4 tiles</option><option value="5">5 tiles</option><option value="6">6 tiles</option><option value="8">8 tiles</option></select>
        <select class="sel" value=${format} onChange=${e => setFormat(e.target.value)} aria-label="Format">${FORMATS.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select>
        <button class=${'btn sm ghost' + (kit ? '' : ' rel-attn')} onClick=${() => setShowBrand(s => !s)} title=${kit ? 'Colours, fonts, voice and logo used for every render' : 'No brand kit yet - tiles will render without the logo and palette'}>${kit ? 'Brand kit' : 'Set up brand kit'}</button>
        <button class="btn sm ghost" onClick=${() => setShowLearned(s => !s)} title="Corrections the team has taught the Engine for this client">${fixes.filter(f => f.active).length} learned</button>
        <label class="rd-chip" style=${{ cursor: 'pointer', marginLeft: 'auto' }}><input type="checkbox" checked=${autoRender} onChange=${e => setAutoRender(e.target.checked)} style=${{ marginRight: 6 }} />render automatically</label>
      </div>
      ${showLearned ? html`<${LearnedPanel} ns=${ns} fixes=${fixes} canWrite=${canWrite} onToggle=${onToggleFix} onDelete=${onDeleteFix} onClose=${() => setShowLearned(false)} />` : null}
      ${showBrand ? html`<${BrandPanel} key=${ns} ns=${ns} kit=${kit} logoUrl=${logoUrl} canWrite=${canWrite} onSaved=${d => { setKit(d.kit); setLogoUrl(d.logoUrl || ''); }} onClose=${() => setShowBrand(false)} />` : null}
      <${Notice} err=${err} />
      <div class="rel-paste panel">
        <div class="phead"><div class="ptitle">The release</div><span class="ptag">${text.trim().length ? text.trim().length.toLocaleString() + ' CHARS' : 'PASTE THE WHOLE RELEASE'}</span></div>
        <textarea class="fi rel-text" rows="9" value=${text} placeholder=${'Paste the media release for ' + client.short + ' here - headline, spokesperson, the lot. The Desk reads it, pulls the claims, numbers and quotes, and writes ' + count + ' tiles in the client voice.'} onInput=${e => setText(e.target.value)} aria-label="Media release"></textarea>
        <div class="rd-ctl" style=${{ marginTop: 8 }}>
          ${canWrite ? html`<button class="btn sm" disabled=${busy.build || text.trim().length < 200} onClick=${build}>${busy.build ? 'Composing...' : 'Build tile pack'}</button>` : html`<span class="rd-chip">read-only key: you can view packs, not build them</span>`}
          ${text.trim() ? html`<button class="btn sm ghost" onClick=${() => setText('')}>Clear</button>` : null}
          <span class="sig-where">Only the release's own facts, figures and quotes are used. Every number is checked back against the text.</span>
        </div>
      </div>
      <${Console} job=${job} canWrite=${canWrite} />
      ${result ? html`<div class=${'rd-res ' + (result.ok ? 'ok' : 'err')}>${result.text}</div>` : null}
      ${pack ? html`<div class="panel">
        <div class="phead"><div class="ptitle">${pack.title || 'Tile pack'}</div>
          <div class="rd-ctl" style=${{ margin: 0 }}>
            <span class="rd-chip">${rendered}/${pack.tiles.length} rendered</span>
            ${pack.extract && pack.extract.spokesperson && pack.extract.spokesperson.name ? html`<span class="rd-chip">${pack.extract.spokesperson.name}</span>` : null}
            ${canWrite && rendered < pack.tiles.length ? html`<button class="btn sm ghost" disabled=${rendering.size > 0} onClick=${() => { autoRef.current = true; setAutoRender(true); renderQueue(pack); }}>Render the rest</button>` : null}
            ${rendered ? html`<button class="btn sm ghost" onClick=${downloadAll}>Download all</button>` : null}
          </div>
        </div>
        <div class=${'rel-grid ' + pack.format}>${pack.tiles.map(t => html`<${Tile} key=${t.n} tile=${t} pack=${pack} canWrite=${canWrite} busy=${rendering.has(t.n)} verdict=${verdicts[t.n] || ''} onRender=${onRender} onSave=${onSave} onCanvas=${onCanvas} onTeach=${onTeach} onVerdict=${onVerdict} />`)}</div>
      </div>` : null}
      ${history.length ? html`<div class="panel">
        <div class="phead"><div class="ptitle">Recent packs - ${client.short}</div><span class="ptag">${history.length}</span></div>
        <div class="rel-hist">${history.map(h => html`<button key=${h.id} class=${'rel-histrow' + (pack && pack.id === h.id ? ' on' : '')} onClick=${() => openPack(h.id).then(p => { setResult(null); if (autoRef.current && p.tiles.some(t => !t.image) && canWrite) renderQueue(p); })}>
          <span class="t">${h.title || h.id}</span><span class="m">${h.rendered}/${h.tiles} rendered - ${h.format} - ${ago(h.created)} ago${h.who ? ' - ' + h.who : ''}</span>
        </button>`)}</div>
      </div>` : null}
      ${!pack && !history.length && !job ? html`<div class="aud-notice" style=${{ margin: '6px 0 14px' }}><b>Nothing on file for ${client.short} yet.</b> Paste a release above and press Build. ${kit ? '' : 'Set up the brand kit first so the tiles render with the logo and colours - it takes a minute and it is remembered.'}</div>` : null}
    </div>`;
  }

  let mounted = false;
  window.releaseInit = function () {
    const root = document.getElementById('release-root');
    if (!root) return;
    if (!mounted) { mounted = true; ReactDOM.createRoot(root).render(html`<${ReleaseApp} />`); }
  };
})();
