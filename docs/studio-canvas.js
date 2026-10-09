/* AXIOM Creative Studio - the canvas's working parts (S23).
 *
 * What a designer expects of a canvas, as tested capabilities rather than buttons: a context menu (right-click, a long press,
 * Shift+F10), copy and paste of a style, a clipboard and a desktop drop that can only ever bring in an image file or plain text
 * (no HTML is parsed, no script can run), an Elements panel to click or drag from, equal-spacing and distance hints in output
 * pixels while moving, rulers with guides kept on the asset, a bounded auto-fit for words, a brand-first colour picker with
 * an eyedropper, and a named undo history. The layout editor (LayoutEditor in studio.js) owns the working layout; this file
 * gives it these parts. Every change is still a property of a layer drawn by the one renderer (studio-render.js), so what is
 * edited here is what is measured and exported. Loads after studio-editor.js (window.STKit, window.STEditor). */
(function () {
  'use strict';
  const K = window.STKit; if (!K || !window.React) return;
  const { html, Icon, toastMsg } = K;
  const R = window.STRender;
  const { useState, useEffect, useRef } = React;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const isMark = l => !!(l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark'));
  const r1 = x => Math.round(x * 10) / 10;

  /* ------------------------------------------------------------ copy and paste a style */
  // what a style is, per kind of layer: how it looks, never where it is, what it says or what it is (id, role, box, words, image)
  const STYLE_KEYS = {
    text: ['family', 'font', 'size', 'weight', 'italic', 'color', 'align', 'lineHeight', 'letterSpacing', 'case', 'emphasis', 'emphasisColor', 'bg', 'bgOpacity', 'paraSpacing', 'shadow', 'stroke', 'glow', 'opacity', 'blend', 'blur'],
    shape: ['fill', 'fill2', 'dir', 'opacity', 'radius', 'stroke', 'shadow', 'blend', 'blur', 'strokeWidth'],
    img: ['adjust', 'radius', 'mask', 'opacity', 'shadow', 'stroke', 'blend', 'blur'],
  };
  /** The style of a layer, to paste onto others of the same kind. A mark has none: it is drawn exactly as its file. */
  function styleOf(l) {
    if (!l || isMark(l) || !STYLE_KEYS[l.type]) return null;
    const out = { type: l.type, from: l.name || l.role || l.type, props: {} };
    STYLE_KEYS[l.type].forEach(k => { if (l[k] !== undefined) out.props[k] = JSON.parse(JSON.stringify(l[k])); });
    out.unset = STYLE_KEYS[l.type].filter(k => l[k] === undefined);
    return out;
  }
  /** The patch that gives a layer a copied style: only the keys of its own kind, the style's unset keys cleared too, so the
      result looks like the source; never a mark, a locked layer, a position or the words. */
  function stylePatch(target, st) {
    if (!st || !target || isMark(target) || target.locked || target.type !== st.type) return null;
    const patch = Object.assign({}, st.props); (st.unset || []).forEach(k => { if (target[k] !== undefined) patch[k] = undefined; });
    return patch;
  }
  const STYLE_KEY = 'ax_studio_style';
  const copyStyle = l => { const s = styleOf(l); if (!s) return null; store.set(STYLE_KEY, Object.assign({ at: Date.now() }, s)); return s; };
  const copiedStyle = () => { const s = store.get(STYLE_KEY, null); return s && s.type && s.props ? s : null; };

  /* ------------------------------------------------------------ what a paste or a drop brings in */
  const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/;
  const MARKER = 'axiom-studio-layers:';
  /** Read a clipboard or a drop as data only. An image file (PNG, JPEG, WebP) is an image to place; plain text becomes words;
      the Studio's own copy of layers is recognised by its marker. HTML is never read, parsed or inserted - not even its text -
      so a pasted page or script can do nothing; what is left out is named so the person is told. */
  function readTransfer(dt) {
    const out = { images: [], text: '', studio: '', rejected: [], html: false };
    if (!dt) return out;
    const files = []; try { Array.from(dt.files || []).forEach(f => files.push(f)); } catch (e) {}
    if (!files.length) try { Array.from(dt.items || []).forEach(it => { if (it.kind === 'file') { const f = it.getAsFile(); if (f) files.push(f); } }); } catch (e) {}
    files.forEach(f => { if (IMAGE_TYPES.test(f.type || '')) out.images.push(f); else out.rejected.push((f.name || 'a file') + (f.type ? ' (' + f.type + ')' : '')); });
    let types = []; try { types = Array.from(dt.types || []); } catch (e) {}
    out.html = types.indexOf('text/html') >= 0;
    let t = ''; try { t = dt.getData('text/plain') || ''; } catch (e) {}
    if (t.indexOf(MARKER) === 0) { out.studio = t.slice(MARKER.length); return out; }
    // plain text only: control characters out, at most 1000 characters, never markup interpreted
    t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').trim();
    if (t.length > 1000) t = t.slice(0, 1000);
    out.text = t;
    return out;
  }
  const what = r => !r.images.length && !r.text && !r.studio ? (r.rejected.length ? 'Not placed: ' + r.rejected.join(', ') + '. Only PNG, JPEG or WebP images and plain text can be placed on the canvas.' : r.html ? 'Not placed: the clipboard held formatted content only. Copy it as plain text, or save the image as a PNG, JPEG or WebP.' : 'Nothing to place: the clipboard is empty.') : '';

  /* ------------------------------------------------------------ equal spacing and distances while moving */
  /** For a moving box among the others (per cent of a W x H stage): the gaps to its nearest neighbours in output pixels, and,
      when the gap on one side nearly equals the gap on the other (or a gap between two neighbours), the move that makes them
      equal - offered as a snap with the marks to draw. */
  function spacingHints(u, others, W, H, T) {
    T = T || 0.8;
    const rowOf = o => o.y < u.y + u.h && o.y + o.h > u.y, colOf = o => o.x < u.x + u.w && o.x + o.w > u.x;
    const left = others.filter(o => rowOf(o) && o.x + o.w <= u.x + 0.01).sort((a, b) => (b.x + b.w) - (a.x + a.w))[0];
    const right = others.filter(o => rowOf(o) && o.x >= u.x + u.w - 0.01).sort((a, b) => a.x - b.x)[0];
    const up = others.filter(o => colOf(o) && o.y + o.h <= u.y + 0.01).sort((a, b) => (b.y + b.h) - (a.y + a.h))[0];
    const down = others.filter(o => colOf(o) && o.y >= u.y + u.h - 0.01).sort((a, b) => a.y - b.y)[0];
    const marks = []; let dx = 0, dy = 0;
    const gx = (a, b) => b - a, px = (v, S) => Math.round(v / 100 * S);
    if (left && right) { const gl = gx(left.x + left.w, u.x), gr = gx(u.x + u.w, right.x); const d = (gr - gl) / 2; if (Math.abs(d) <= T && Math.abs(gl - gr) > 0.01) dx = d; const eq = Math.abs(gl + dx - (gr - dx)) < 0.05; marks.push({ axis: 'x', from: left.x + left.w, to: u.x + dx, at: u.y + u.h / 2, px: px(gl + dx, W), equal: eq }, { axis: 'x', from: u.x + u.w + dx, to: right.x, at: u.y + u.h / 2, px: px(gr - dx, W), equal: eq }); }
    else { if (left) marks.push({ axis: 'x', from: left.x + left.w, to: u.x, at: u.y + u.h / 2, px: px(u.x - left.x - left.w, W) }); if (right) marks.push({ axis: 'x', from: u.x + u.w, to: right.x, at: u.y + u.h / 2, px: px(right.x - u.x - u.w, W) }); }
    if (up && down) { const gu = up.y + up.h, gtop = u.y - gu, gbot = down.y - (u.y + u.h); const d = (gbot - gtop) / 2; if (Math.abs(d) <= T && Math.abs(gtop - gbot) > 0.01) dy = d; const eq = Math.abs(gtop + dy - (gbot - dy)) < 0.05; marks.push({ axis: 'y', from: gu, to: u.y + dy, at: u.x + u.w / 2, px: px(gtop + dy, H), equal: eq }, { axis: 'y', from: u.y + u.h + dy, to: down.y, at: u.x + u.w / 2, px: px(gbot - dy, H), equal: eq }); }
    else { if (up) marks.push({ axis: 'y', from: up.y + up.h, to: u.y, at: u.x + u.w / 2, px: px(u.y - up.y - up.h, H) }); if (down) marks.push({ axis: 'y', from: u.y + u.h, to: down.y, at: u.x + u.w / 2, px: px(down.y - u.y - u.h, H) }); }
    return { dx, dy, marks: marks.filter(m => m.to - m.from > 0.05) };
  }

  /* ------------------------------------------------------------ auto-fit for words, bounded */
  const FIT_MIN = 2.4;   // the feed minimum the validation warns under (unreadable under 1.8)
  /** The largest type size at which the words fit their box without overflowing or breaking a word, searched with the
      renderer's own line layout. Bounded: never under the 2.4% feed minimum and never over 20% of the width; when the words do
      not fit even at the minimum, the answer says so and by how much, and nothing is changed. */
  function fitText(layout, l, copy, W, H, opts) {
    opts = opts || {};
    if (!l || l.type !== 'text' || !R || !R.layoutText) return { ok: false, why: 'not words' };
    const c = document.createElement('canvas').getContext('2d');
    const at = s => R.layoutText(c, layout, Object.assign({}, l, { size: s }), copy, W, H);
    const fits = s => { const t = at(s); return !!t && !t.overflowH && !t.overflowW && !(t.broken && t.broken.length); };
    const lo0 = Math.max(FIT_MIN, opts.min || 0), hi0 = Math.min(20, opts.max || 20);
    if (!at(lo0)) return { ok: false, why: 'the layer shows no words' };
    if (!fits(lo0)) { const t = at(lo0); const over = t ? Math.round((t.contentH - (l.h || 0) / 100 * H) / H * 1000) / 10 : 0; return { ok: false, why: 'the words do not fit this box even at ' + lo0 + '% of the width (the feed minimum)' + (over > 0 ? ': they need ' + over + '% more height' : '') + '. Make the box larger or the words shorter.' }; }
    let lo = lo0, hi = hi0; if (fits(hi)) return { ok: true, size: r1(hi), capped: true };
    for (let i = 0; i < 24 && hi - lo > 0.05; i++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; }
    return { ok: true, size: Math.floor(lo * 10) / 10 };
  }

  /* ------------------------------------------------------------ the context menu */
  /** A menu at the pointer (or at the selection, from the keyboard): every item says what it does; an item that cannot run now
      is shown disabled with the reason. Arrow keys move, Enter runs, Escape closes; the focus returns where it was. */
  function ContextMenu({ x, y, items, onClose, label }) {
    const ref = useRef(null);
    const enabled = () => Array.from(ref.current ? ref.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])') : []);
    useEffect(() => { const back = document.activeElement; const first = enabled()[0]; if (first) first.focus({ preventScroll: true });
      const away = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
      const t = setTimeout(() => document.addEventListener('pointerdown', away, true), 0);
      return () => { clearTimeout(t); document.removeEventListener('pointerdown', away, true); try { if (back && back.focus && document.body.contains(back)) back.focus({ preventScroll: true }); } catch (e) {} }; }, []);
    const go = d => { const els = enabled(); if (!els.length) return; const at = els.indexOf(document.activeElement); const n = d === 'first' ? els[0] : d === 'last' ? els[els.length - 1] : els[((at < 0 ? -1 : at) + d + els.length) % els.length]; n.focus({ preventScroll: true }); };
    const key = e => { e.stopPropagation(); if (e.key === 'Escape' || e.key === 'Tab') { e.preventDefault(); onClose(); } else if (e.key === 'ArrowDown') { e.preventDefault(); go(1); } else if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); } else if (e.key === 'Home') { e.preventDefault(); go('first'); } else if (e.key === 'End') { e.preventDefault(); go('last'); } };
    // kept inside the window
    const st = { left: Math.max(8, Math.min(x, (window.innerWidth || 1200) - 268)) + 'px', top: Math.max(8, Math.min(y, (window.innerHeight || 800) - Math.min(600, items.length * 29 + 20))) + 'px' };
    return html`<div class="st-ctxmenu" role="menu" aria-label=${label || 'Layer actions'} ref=${ref} style=${st} onKeyDown=${key} onContextMenu=${e => { e.preventDefault(); e.stopPropagation(); }} onPointerDown=${e => e.stopPropagation()}>
      ${items.map((it, k) => it.sep ? html`<div key=${'s' + k} class="st-ctxsep" role="separator"></div>` : html`<button key=${it.id} role="menuitem" class="st-ctxitem" tabIndex="-1" aria-disabled=${it.disabled ? 'true' : undefined} title=${it.disabled ? it.why || '' : it.title || ''} data-id=${it.id}
        onClick=${() => { if (it.disabled) return; onClose(); it.run(); }}><span>${it.label}</span>${it.disabled && it.why ? html`<span class="st-ctxwhy">${it.why}</span>` : it.keys ? html`<kbd>${it.keys}</kbd>` : null}</button>`)}
    </div>`;
  }

  /** An image behind the access key (a brand mark, an upload): fetched with the key and shown from a blob address. */
  function KeyedImg({ url, alt }) {
    const [u, setU] = useState('');
    useEffect(() => { let live = true; if (url && K.blobUrl) K.blobUrl(url).then(x => { if (live) setU(x); }).catch(() => {}); return () => { live = false; }; }, [url]);
    return u ? html`<img src=${u} alt=${alt || ''} />` : html`<span class="st-el-ph" aria-hidden="true"></span>`;
  }
  /* ------------------------------------------------------------ the Elements panel */
  const TEXT_STYLES = [['heading', 'Heading', 'Large display type'], ['subheading', 'Subheading', 'A second level'], ['text', 'Body text', 'Running text'], ['label', 'Label', 'A small caps kicker'], ['quote', 'Quote', 'A pulled quotation'], ['number', 'Big number', 'A figure to lead with']];
  const SHAPES = [['rect', 'Rectangle'], ['pill', 'Pill'], ['circle', 'Circle'], ['triangle', 'Triangle']];
  const LINES = [['rule', 'Line'], ['arrow', 'Arrow']];
  const FRAMES = [['frame', 'Image frame', ''], ['frame-circle', 'Circle frame', 'circle'], ['frame-round', 'Rounded frame', 'round']];
  /** Everything that can go on the canvas, grouped: click to add it at the centre of what is in view, or drag it onto the
      artwork to place it where it lands (a dashed preview follows the pointer). Brand assets are the marks the campaign's
      policy allows, placed from their files; the client logo is not offered on a campaign that does not carry it. */
  function ElementsPanel({ kit, ns: ns0, campaign, uploads, ro, onAdd, onUploadsRefresh, onPickFile }) {
    const [q, setQ] = useState(''); const ns = ns0 || (kit && kit.ns) || '';
    const icons = Object.keys((R && R.ICONS) || {});
    const camp = ((kit && kit.campaigns) || []).find(c => c.id === campaign) || null;
    const policy = (camp && camp.logoPolicy) || (camp && (camp.wordmarkV || (camp.wordmarks || []).length) ? 'wordmark' : 'logo');
    const marks = [];
    if (policy === 'logo' || policy === 'both') { if (kit && (kit.logoV || kit.hasLogo)) marks.push({ role: 'logo', variant: '', label: 'Client logo' + ((kit.logoVariants || []).length ? ' (default)' : ''), src: '/brand/logo?ns=' + encodeURIComponent(ns) + (kit.logoV ? '&v=' + kit.logoV : '') }); ((kit && kit.logoVariants) || []).forEach(x => marks.push({ role: 'logo', variant: x.variant, tone: x.tone, label: 'Client logo, ' + x.variant + (x.tone ? ' (' + x.tone + ')' : ''), src: '/brand/logo?ns=' + encodeURIComponent(ns) + '&variant=' + encodeURIComponent(x.variant) + (x.v ? '&v=' + x.v : '') })); }
    if (camp && (policy === 'wordmark' || policy === 'both')) { (camp.wordmarks || []).forEach(x => marks.push({ role: 'wordmark', campaign: camp.id, variant: x.variant, tone: x.tone, label: (camp.name || camp.id) + ' wordmark, ' + x.variant + (x.tone ? ' (' + x.tone + ')' : ''), src: '/brand/wordmark?ns=' + encodeURIComponent(ns) + '&campaign=' + encodeURIComponent(camp.id) + '&variant=' + encodeURIComponent(x.variant) + (x.v ? '&v=' + x.v : '') })); if (!(camp.wordmarks || []).length && camp.wordmarkV) marks.push({ role: 'wordmark', campaign: camp.id, variant: '', label: (camp.name || camp.id) + ' wordmark', src: '/brand/wordmark?ns=' + encodeURIComponent(ns) + '&campaign=' + encodeURIComponent(camp.id) + '&v=' + camp.wordmarkV }); }
    const pal = (kit && kit.palette) || {}; const colours = [pal.primary, pal.secondary, pal.text, pal.bg, camp && camp.accent].filter(c => /^#[0-9a-f]{6}$/i.test(c || '')).filter((c, i, a) => a.indexOf(c) === i);
    const ql = q.trim().toLowerCase(); const m = s => !ql || String(s).toLowerCase().indexOf(ql) >= 0;
    const drag = (kind, o, label) => e => { try { e.dataTransfer.setData('application/x-axiom-element', JSON.stringify({ kind, o })); e.dataTransfer.setData('text/plain', ''); e.dataTransfer.effectAllowed = 'copy'; } catch (x) {} window.dispatchEvent(new CustomEvent('st:element-drag', { detail: { kind, o, label } })); };
    const end = () => window.dispatchEvent(new CustomEvent('st:element-drag', { detail: null }));
    const item = (kind, o, label, inner, title) => html`<button key=${kind + (o && (o.shape || o.icon || o.style || o.key || o.variant || o.fill) || '')} class="st-el-item" draggable=${!ro} disabled=${!!ro} title=${(title || label) + ': click to add at the centre of the view, or drag it onto the artwork'} aria-label=${'Add ' + label} onClick=${() => onAdd(kind, o)} onDragStart=${drag(kind, o, label)} onDragEnd=${end}>${inner}<span class="st-el-l">${label}</span></button>`;
    const sec = (title, n, body) => html`<section class="st-el-sec" aria-label=${title}><h4>${title}${n != null ? html` <span class="ov-dim">${n}</span>` : null}</h4><div class="st-el-grid">${body}</div></section>`;
    return html`<div class="st-elements" aria-label="Elements">
      <label class="st-el-search"><${Icon} n="search" size=${14} /><input type="search" value=${q} onInput=${e => setQ(e.target.value)} placeholder="Search elements" aria-label="Search elements" /></label>
      ${ro ? html`<div class="ov-dim">This key can look but not add.</div>` : null}
      ${sec('Text', null, TEXT_STYLES.filter(([k, l]) => m(l)).map(([k, l, t]) => item('style', { style: k }, l, html`<span class=${'st-el-text ' + k}>${k === 'number' ? '74' : k === 'quote' ? '\u201c\u201d' : 'Aa'}</span>`, t)))}
      ${sec('Shapes', null, SHAPES.filter(([k, l]) => m(l)).map(([k, l]) => item('shape', { shape: k }, l, html`<span class=${'st-el-shape ' + k}></span>`)))}
      ${sec('Lines and arrows', null, LINES.filter(([k, l]) => m(l)).map(([k, l]) => item('shape', { shape: k }, l, html`<span class=${'st-el-shape ' + k}></span>`)))}
      ${sec('Frames', null, FRAMES.filter(([k, l]) => m(l)).map(([k, l, mk]) => item('frame', { mask: mk }, l, html`<span class=${'st-el-frame ' + (mk || 'rect')}></span>`, l + ': an empty image box; drop an image on it, or replace it from Properties')))}
      ${colours.length && m('colour brand block') ? sec('Brand colours', null, colours.map(c => item('shape', { shape: 'rect', fill: c }, 'Block ' + c, html`<span class="st-el-swatch" style=${{ background: c }}></span>`, 'A block in the brand colour ' + c))) : null}
      ${sec('Brand assets', marks.length || null, marks.length ? marks.filter(x => m(x.label)).map(x => item('mark', x, x.label, html`<span class="st-el-mark"><${KeyedImg} url=${x.src} /></span>`, x.label + ': placed from its file, never redrawn')) : html`<div class="ov-dim st-el-none">${camp ? 'No mark on file for ' + (camp.name || camp.id) + ' under its policy (' + policy + '). Add it in Brand.' : 'No mark on file. Add the logo in Brand.'}</div>`)}
      ${sec('Uploads', (uploads || []).length || null, html`${!ro ? html`<button class="st-el-item st-el-upload" onClick=${onPickFile} aria-label="Upload an image"><${Icon} n="upload" size=${18} /><span class="st-el-l">Upload</span></button>` : null}${(uploads || []).filter(u => m(u.name)).map(u => item('upload', u, u.name, html`<span class="st-el-up"><${KeyedImg} url=${u.url} /></span>`, u.name + ': placed in this project'))}`)}
      ${sec('Icons', null, icons.filter(n => m(n) || m('icon')).slice(0, 48).map(n => item('icon', { icon: n }, n, html`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: R.ICONS[n] }}></svg>`)))}
      <div class="ov-dim st-el-foot">Images can also be dropped from the desktop onto the artwork, or pasted (PNG, JPEG or WebP). Pasted text becomes words; formatted content and other files are left out and named.</div>
    </div>`;
  }

  /* ------------------------------------------------------------ colour: brand first, recent, eyedropper */
  const RECENT_KEY = 'ax_studio_colours';
  const recentColours = () => store.get(RECENT_KEY, []).filter(c => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 8);
  const pushColour = c => { if (!/^#[0-9a-f]{6}$/i.test(c || '')) return; const r = recentColours().filter(x => x.toLowerCase() !== c.toLowerCase()); r.unshift(c); store.set(RECENT_KEY, r.slice(0, 8)); };
  /** Pick a colour from the screen: the browser's eyedropper where it exists, else from the artwork (the next click on the
      canvas reads that pixel of the composition as drawn). */
  function eyedrop() {
    if (typeof window.EyeDropper === 'function') { try { return new window.EyeDropper().open().then(r => (r && r.sRGBHex) || null).catch(() => null); } catch (e) {} }
    return new Promise(res => { window.dispatchEvent(new CustomEvent('st:eyedrop', { detail: { done: c => res(c || null) } })); });
  }

  /* ------------------------------------------------------------ named history */
  /** One line for a step of the history: what it did to which layers, read from the two layouts (never a guess). */
  function describeStep(prev, next, hint) {
    if (hint) return hint;
    if (!prev || !next) return 'Change';
    const pl = prev.layers || [], nl = next.layers || []; const byP = {}; pl.forEach(l => { byP[l.id] = l; }); const byN = {}; nl.forEach(l => { byN[l.id] = l; });
    const nm = l => l.name || (l.role && l.role !== 'free' ? l.role : '') || (l.type === 'text' ? 'text' : l.shape || l.type);
    const added = nl.filter(l => !byP[l.id]), gone = pl.filter(l => !byN[l.id]);
    if (added.length) return 'Add ' + (added.length === 1 ? nm(added[0]) : added.length + ' layers');
    if (gone.length) return 'Delete ' + (gone.length === 1 ? nm(gone[0]) : gone.length + ' layers');
    if (JSON.stringify(pl.map(l => l.id)) !== JSON.stringify(nl.map(l => l.id))) return 'Reorder layers';
    const ch = nl.filter(l => JSON.stringify(l) !== JSON.stringify(byP[l.id]));
    if (!ch.length) { if (JSON.stringify(prev._copy || {}) !== JSON.stringify(next._copy || {})) return 'Edit the words'; if (JSON.stringify(prev.imageFocus) !== JSON.stringify(next.imageFocus)) return 'Reframe the photograph'; return 'Change'; }
    const keys = {}; ch.forEach(l => { Object.keys(Object.assign({}, l, byP[l.id])).forEach(k => { if (JSON.stringify(l[k]) !== JSON.stringify(byP[l.id][k])) keys[k] = 1; }); });
    const k = Object.keys(keys); const who = ch.length === 1 ? nm(ch[0]) : ch.length + ' layers';
    const verb = k.every(x => x === 'x' || x === 'y') ? 'Move' : k.some(x => x === 'w' || x === 'h') && k.every(x => /^(x|y|w|h|size)$/.test(x)) ? 'Resize' : k.indexOf('rotate') >= 0 && k.length <= 3 ? 'Rotate' : k.indexOf('focus') >= 0 ? 'Reframe' : k.indexOf('text') >= 0 ? 'Edit the words of' : k.indexOf('locked') >= 0 ? 'Lock or unlock' : k.indexOf('hidden') >= 0 ? 'Show or hide' : k.indexOf('group') >= 0 ? 'Group or ungroup' : k.some(x => /color|fill|fill2/.test(x)) ? 'Recolour' : k.some(x => /family|weight|size|italic|align|lineHeight|letterSpacing|case|emphasis/.test(x)) ? 'Restyle the type of' : 'Change';
    return verb + ' ' + who;
  }
  function HistoryList({ hist, onJump, onClose }) {
    const rows = hist.past.map((e, k) => ({ k: k - hist.past.length, name: e.name, at: e.at, state: 'past' })).concat([{ k: 0, name: hist.now.name, at: hist.now.at, state: 'now' }], hist.future.map((e, k) => ({ k: k + 1, name: e.name, at: e.at, state: 'future' })));
    const ref = useRef(null); useEffect(() => { const el = ref.current && ref.current.querySelector('.now'); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, []);
    return html`<div class="st-hist-pop" role="dialog" aria-label="Editing history" ref=${ref} onKeyDown=${e => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}>
      <div class="st-hist-pop-h"><b>Editing history</b><span class="ov-dim">this session's steps; saved versions are in History</span><button class="ov-link" onClick=${onClose}>close</button></div>
      <ol class="st-hist-steps">${rows.map(r => html`<li key=${r.k} class=${r.state}><button class=${'st-hist-step ' + r.state} aria-current=${r.state === 'now' ? 'step' : undefined} disabled=${r.state === 'now'} onClick=${() => onJump(r.k)}><span>${r.name}</span>${r.state === 'future' ? html`<span class="ov-dim">undone</span>` : null}</button></li>`)}</ol>
    </div>`;
  }

  /* ------------------------------------------------------------ rulers and guides */
  /** Rulers along the top and the left of the artwork, in output pixels. Drag down from the top ruler for a horizontal guide, or
      across from the left ruler for a vertical one; drag a guide to move it, or off the artwork to remove it. Guides are kept on the asset (not in a version) and the canvas snaps to them. */
  function Rulers({ W, H, guides, onChange, box }) {
    const [drag, setDrag] = useState(null);
    const ticks = (S, n) => Array.from({ length: n + 1 }, (_, i) => i * 100 / n);
    const at = (e, axis) => { const r = box.current.getBoundingClientRect(); return axis === 'x' ? (e.clientX - r.left) / r.width * 100 : (e.clientY - r.top) / r.height * 100; };
    const start = (axis, idx) => e => { e.preventDefault(); e.stopPropagation(); setDrag({ axis, idx, pos: at(e, axis) }); try { e.currentTarget.setPointerCapture(e.pointerId); } catch (x) {} };
    const move = e => { if (!drag) return; setDrag(Object.assign({}, drag, { pos: at(e, drag.axis) })); };
    const up = e => { if (!drag) return; const d = drag; setDrag(null); const pos = Math.round(d.pos * 10) / 10; const off = pos < -2 || pos > 102; let g = guides.slice(); if (d.idx == null) { if (!off) g.push({ a: d.axis, at: pos }); } else if (off) g.splice(d.idx, 1); else g[d.idx] = { a: d.axis, at: pos }; onChange(g); };
    const shown = guides.map((g, i) => drag && drag.idx === i ? { a: g.a, at: drag.pos, i } : Object.assign({ i }, g)).concat(drag && drag.idx == null ? [{ a: drag.axis, at: drag.pos, i: -1 }] : []);
    return html`<div class="st-rulers" onPointerMove=${move} onPointerUp=${up} onPointerCancel=${up}>
      <div class="st-ruler x" role="slider" aria-label="Top ruler: drag down onto the artwork to make a horizontal guide" aria-valuemin="0" aria-valuemax=${W} aria-valuenow="0" onPointerDown=${start('y', null)}>${ticks(W, 10).map(t => html`<span key=${t} style=${{ left: t + '%' }}><i>${Math.round(t / 100 * W)}</i></span>`)}</div>
      <div class="st-ruler y" role="slider" aria-label="Left ruler: drag across onto the artwork to make a vertical guide" aria-valuemin="0" aria-valuemax=${H} aria-valuenow="0" onPointerDown=${start('x', null)}>${ticks(H, 10).map(t => html`<span key=${t} style=${{ top: t + '%' }}><i>${Math.round(t / 100 * H)}</i></span>`)}</div>
      ${shown.map(g => html`<div key=${'g' + g.i} class=${'st-uguide ' + g.a + (g.i === -1 || (drag && drag.idx === g.i) ? ' dragging' : '')} style=${g.a === 'x' ? { left: g.at + '%' } : { top: g.at + '%' }} title=${'Guide at ' + Math.round(g.at / 100 * (g.a === 'x' ? W : H)) + ' px: drag to move, onto the ruler to remove'} onPointerDown=${g.i >= 0 ? start(g.a, g.i) : undefined}><span>${Math.round(g.at / 100 * (g.a === 'x' ? W : H))}</span></div>`)}
    </div>`;
  }

  window.STCanvas = { KeyedImg, STYLE_KEYS, styleOf, stylePatch, copyStyle, copiedStyle, readTransfer, transferProblem: what, MARKER, spacingHints, fitText, FIT_MIN, ContextMenu, ElementsPanel, recentColours, pushColour, eyedrop, describeStep, HistoryList, Rulers, isMark };
})();
