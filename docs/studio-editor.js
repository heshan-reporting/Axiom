/* AXIOM Creative Studio - the canvas editor's parts (S17).
 *
 * The layout editor (LayoutEditor in studio.js) owns the working layout, its history and the selection; this file gives it
 * the parts a person works with: the floating toolbar over the selection, the font picker (brand, recent, recommended,
 * search), the text typed in place on the canvas, the Add menu (text, shapes, icons, images), the effects and image panels,
 * and the maths every gesture uses - snapping with visible guides, resizing from eight handles in the layer's own frame,
 * rotation, a marquee, duplicate and paste. Every change is a property of a layer drawn by the one renderer
 * (studio-render.js), so what is edited here is what is measured and exported. Loads after studio.js (window.STKit). */
(function () {
  'use strict';
  const K = window.STKit; if (!K || !window.React) return;
  const { html, Icon, call, toastMsg } = K;
  const R = window.STRender;
  const { useState, useEffect, useRef } = React;
  const r1 = x => Math.round(x * 10) / 10;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const COPY_ROLES = ['headline', 'support', 'cta'];
  const isMark = l => l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark');
  const uid = p => (p || 'l') + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);

  /* ------------------------------------------------------------ fonts: brand, recent, recommended, search */
  const recentFonts = () => store.get('ax_studio_fonts_recent', []).filter(x => typeof x === 'string').slice(0, 8);
  const pushRecent = name => { const r = recentFonts().filter(x => x !== name); r.unshift(name); store.set('ax_studio_fonts_recent', r.slice(0, 8)); };
  const KIND_WORD = { sans: 'Sans', serif: 'Serif', display: 'Display', mono: 'Mono', script: 'Script' };
  /** The font picker. Hovering a family previews it on the canvas (the face is fetched then); choosing it commits. A name the
      catalogue does not hold can be tried from Google Fonts: if the face does not arrive, the validation says the type fell back. */
  function FontPicker({ value, brand, onPick, onPreview, onClose }) {
    const [q, setQ] = useState(''); const [kind, setKind] = useState('');
    const ref = useRef(null);
    useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose(); }; const k = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }; setTimeout(() => document.addEventListener('pointerdown', h), 0); document.addEventListener('keydown', k, true); return () => { document.removeEventListener('pointerdown', h); document.removeEventListener('keydown', k, true); }; }, []);
    const cat = (R && R.FONT_CATALOGUE) || [];
    const ql = q.trim().toLowerCase();
    const match = f => (!ql || f.name.toLowerCase().indexOf(ql) >= 0) && (!kind || f.kind === kind);
    const brandList = (brand || []).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
    const recent = recentFonts().filter(n => !ql || n.toLowerCase().indexOf(ql) >= 0);
    const rows = cat.filter(match);
    const tryName = q.trim() && /^[A-Za-z0-9][A-Za-z0-9 \-']{1,48}$/.test(q.trim()) && !cat.some(f => f.name.toLowerCase() === ql) ? q.trim() : '';
    const row = (name, note) => html`<button key=${(note || '') + name} role="option" aria-selected=${value === name} class=${'st-font-row' + (value === name ? ' on' : '')} onMouseEnter=${() => onPreview && onPreview(name)} onFocus=${() => onPreview && onPreview(name)} onClick=${() => { pushRecent(name); onPick(name); }}><span>${name}</span>${note ? html`<span class="st-font-note">${note}</span>` : null}</button>`;
    return html`<div class="st-fontpick" ref=${ref} role="dialog" aria-label="Choose a font" onMouseLeave=${() => onPreview && onPreview(null)}>
      <div class="st-fontpick-search"><${Icon} n="search" size=${14} /><input class="st-in" autoFocus value=${q} placeholder="Search fonts" aria-label="Search fonts" onInput=${e => setQ(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && (rows[0] || tryName)) { const n = rows[0] ? rows[0].name : tryName; pushRecent(n); onPick(n); } }} /></div>
      <div class="st-fontpick-kinds" role="group" aria-label="Kind">${[['', 'All']].concat(Object.keys(KIND_WORD).map(k => [k, KIND_WORD[k]])).map(([k, l]) => html`<button key=${k || 'all'} class=${'st-chipbtn' + (kind === k ? ' on' : '')} aria-pressed=${kind === k} onClick=${() => setKind(k)}>${l}</button>`)}</div>
      <div class="st-fontpick-list" role="listbox" aria-label="Fonts">
        ${value ? html`<button class="st-font-row reset" onClick=${() => onPick('')}>Use the brand font for this role</button>` : null}
        ${brandList.length && !kind ? html`<div class="st-fontpick-h">Brand</div>${brandList.filter(n => !ql || n.toLowerCase().indexOf(ql) >= 0).map(n => row(n, 'brand'))}` : null}
        ${recent.length && !kind ? html`<div class="st-fontpick-h">Recent</div>${recent.map(n => row(n))}` : null}
        <div class="st-fontpick-h">Recommended${kind ? ': ' + KIND_WORD[kind] : ''} (${rows.length})</div>
        ${rows.map(f => row(f.name, KIND_WORD[f.kind] + (f.weights.length === 1 ? ', one weight' : '')))}
        ${tryName ? html`<div class="st-fontpick-h">Search Google Fonts</div>${row(tryName, 'try: reported if it does not load')}` : null}
        ${!rows.length && !tryName ? html`<div class="ov-dim st-pad">No font matches.</div>` : null}
      </div>
    </div>`;
  }

  /* ------------------------------------------------------------ colour */
  /** S23: colour, brand first. The client's palette (and the campaign accent) leads, then white and near-black, then the colours
      used recently in this browser; any other colour from the system picker or as hex; and an eyedropper - the browser's own
      where it has one, else a click on the artwork reads that pixel of the composition as drawn. */
  function Swatches({ value, palette, onPick, label }) {
    const pal = palette || {}; const ok = c => /^#[0-9a-f]{6}$/i.test(c || '');
    const CV = window.STCanvas || {};
    const uniq = list => list.filter(ok).filter((c, i, a) => a.findIndex(x => x.toLowerCase() === c.toLowerCase()) === i);
    const brand = uniq([pal.primary, pal.secondary, pal.accent, pal.text, pal.bg]);
    const has = (list, c) => list.some(x => x.toLowerCase() === c.toLowerCase());
    const neutral = uniq(['#FFFFFF', '#111418']).filter(c => !has(brand, c));
    const recent = uniq(CV.recentColours ? CV.recentColours() : []).filter(c => !has(brand, c) && !has(neutral, c)).slice(0, 6);
    const [hex, setHex] = useState(value || ''); const [dropping, setDropping] = useState(false); const nat = useRef(null);
    useEffect(() => { setHex(value || ''); }, [value]);
    const pick = c => { const x = String(c || '').toUpperCase(); if (!/^#[0-9A-F]{3,8}$/.test(x)) return; if (CV.pushColour && ok(x)) CV.pushColour(x); onPick(x); };
    // the system picker commits when it closes (its change event), not on every movement of the cursor
    const pickRef = useRef(pick); pickRef.current = pick;
    useEffect(() => { const el = nat.current; if (!el) return; const h = e => pickRef.current(e.target.value); el.addEventListener('change', h); return () => el.removeEventListener('change', h); }, []);
    const drop = async () => { if (!CV.eyedrop || dropping) return; setDropping(true); try { const c = await CV.eyedrop(); if (c) pick(c); } finally { setDropping(false); } };
    const sw = (c, kind) => html`<button key=${kind + c} class=${'st-swatch' + ((value || '').toLowerCase() === c.toLowerCase() ? ' on' : '') + (kind === 'b' ? ' brand' : '')} style=${{ background: c }} title=${c + (kind === 'b' ? ' (brand)' : kind === 'r' ? ' (recent)' : '')} aria-label=${(label || 'Colour') + ' ' + c + (kind === 'b' ? ', brand' : kind === 'r' ? ', recent' : '')} onClick=${() => pick(c)}></button>`;
    return html`<div class="st-swatches" role="group" aria-label=${label || 'Colour'}>
      ${brand.length ? html`<span class="st-sw-lbl">Brand</span>${brand.map(c => sw(c, 'b'))}` : null}${neutral.map(c => sw(c, 'n'))}
      ${recent.length ? html`<span class="st-sw-lbl">Recent</span>${recent.map(c => sw(c, 'r'))}` : null}
      <input ref=${nat} type="color" class="st-sw-native" defaultValue=${ok(value) ? value.toLowerCase() : '#ffffff'} key=${'n' + (value || '')} aria-label=${(label || 'Colour') + ': any colour'} title="Any colour" />
      ${CV.eyedrop ? html`<button class=${'st-sw-drop' + (dropping ? ' on' : '')} aria-pressed=${dropping} aria-label=${(label || 'Colour') + ': take a colour ' + (typeof window.EyeDropper === 'function' ? 'from the screen' : 'from the artwork')} title=${dropping ? 'Click the artwork (Escape cancels)' : typeof window.EyeDropper === 'function' ? 'Take a colour from anywhere on the screen' : 'Take a colour from the artwork: click the canvas'} onClick=${drop}><${Icon} n="eyedrop" size=${13} /></button>` : null}
      <input class="st-in st-hex" value=${hex} aria-label=${(label || 'Colour') + ', hex'} placeholder="#RRGGBB" onInput=${e => setHex(e.target.value)} onKeyDown=${e => { if (e.key === 'Enter' && /^#[0-9a-f]{3,8}$/i.test(hex)) pick(hex); }} onBlur=${() => { if (hex !== value && /^#[0-9a-f]{3,8}$/i.test(hex)) pick(hex); }} /></div>`;
  }

  /* ------------------------------------------------------------ the floating toolbar over the selection */
  /** What the selection can do, beside it on the canvas: type for words, fill for shapes, the image's own tools, and for every
      selection duplicate, delete, lock and paint order. "More" opens the Properties tab, where every control lives. */
  function ContextToolbar({ sel, bbox, layout, ro, stageW: stageW0, locks, onPatch, onPatchEach, onDuplicate, onDelete, onLock, onOrder, onMore, onEditText, onReplace, onFontOpen, palette }) {
    const stageW = stageW0 || (layout && layout.stage && layout.stage.w) || 1080;
    const [pop, setPop] = useState('');
    if (!sel.length || !bbox || ro) return null;
    const one = sel.length === 1 ? sel[0] : null; const pal = palette || (layout && layout.palette) || {};
    // above the selection, clear of its rotation handle; below it when the selection is at the top of the stage
    const top = bbox.y > 16 ? { bottom: 'calc(' + (100 - bbox.y) + '% + 40px)' } : { top: 'calc(' + Math.min(92, bbox.y + bbox.h) + '% + 14px)' };
    const left = { left: clamp(bbox.x, 0, 70) + '%' };
    const text = one && one.type === 'text'; const shape = one && one.type === 'shape'; const img = one && one.type === 'img' && !isMark(one);
    const mark = one && isMark(one); const locked = sel.some(l => l.locked);
    const textAll = sel.every(l => l.type === 'text');
    const fam = text ? (one.family || '') : '';
    const wordsLocked = text && COPY_ROLES.indexOf(one.role) >= 0 && locks && locks[one.role];
    const tb = (label, icon, fn, on, dis, title) => html`<button class=${'st-fbar-btn' + (on ? ' on' : '')} disabled=${!!dis} aria-pressed=${on ? true : undefined} title=${title || label} aria-label=${label} onClick=${fn}>${icon ? html`<${Icon} n=${icon} size=${15} />` : label}</button>`;
    return html`<div class="st-fbar" role="toolbar" aria-label="Selection tools" style=${Object.assign({}, top, left)} onPointerDown=${e => e.stopPropagation()}>
      ${mark ? html`<span class="st-fbar-note">${one.role}: placed from its file${one.rule && one.rule.mandatory ? ', held by the campaign rule' : ''}</span>` : null}
      ${textAll && !locked ? html`
        ${text ? html`<button class="st-fbar-font" onClick=${() => onFontOpen()} title="Font" aria-label=${'Font: ' + (fam || 'brand font')}>${fam || 'Brand font'}</button>` : null}
        ${tb('Smaller type', 'minus', () => onPatchEach(l => ({ size: r1(Math.max(1.2, l.size - 0.4)) })))}
        <span class="st-fbar-val" aria-label="Type size" title=${text ? one.size + '% of the width' : ''}>${text ? Math.round(one.size * stageW / 100) + ' px' : '-'}</span>
        ${tb('Larger type', 'plus', () => onPatchEach(l => ({ size: r1(Math.min(20, l.size + 0.4)) })))}
        ${tb('Bold', null, () => onPatchEach(l => ({ weight: (l.weight || 600) >= 700 ? 400 : 800 })), text && (one.weight || 600) >= 700, false, 'Bold (heavier or lighter)')}
        ${tb('Italic', null, () => onPatchEach(l => ({ italic: !l.italic || undefined })), text && one.italic, false, 'Italic')}
        ${tb('Align', 'align', () => onPatchEach(l => ({ align: (l.align || 'left') === 'left' ? 'center' : (l.align || 'left') === 'center' ? 'right' : 'left' })), false, false, 'Alignment: ' + ((text && one.align) || 'left'))}
        <button class="st-fbar-swatch" style=${{ background: text ? one.color || '#fff' : '#fff' }} aria-label="Text colour" title="Text colour" onClick=${() => setPop(pop === 'color' ? '' : 'color')}></button>
        ${text ? tb('Edit the words', 'pen', () => onEditText(one), false, wordsLocked, wordsLocked ? 'The ' + one.role + ' is locked on this asset' : 'Edit the words here (or double-click the text)') : null}` : null}
      ${shape && !locked ? html`<button class="st-fbar-swatch" style=${{ background: one.fill || '#000' }} aria-label="Fill" title="Fill" onClick=${() => setPop(pop === 'fill' ? '' : 'fill')}></button>
        <label class="st-fbar-range" title="Opacity">${Math.round((one.opacity == null ? 1 : one.opacity) * 100)}%<input type="range" min="0" max="100" value=${Math.round((one.opacity == null ? 1 : one.opacity) * 100)} aria-label="Opacity" onChange=${e => onPatch({ opacity: Math.round(+e.target.value) / 100 })} /></label>` : null}
      ${img && !locked ? html`${tb('Flip', 'flip', () => onPatch({ flipX: !one.flipX || undefined }), one.flipX, false, 'Flip horizontally')}${tb(one.fit === 'cover' ? 'Fit inside' : 'Fill the box', 'image', () => onPatch({ fit: one.fit === 'cover' ? 'contain' : 'cover' }), false, false)}${one.role === 'image' && onReplace ? tb('Replace image', 'upload', () => onReplace(one)) : null}` : null}
      <span class="st-fbar-sep"></span>
      ${!mark ? tb('Duplicate', 'copy', onDuplicate, false, locked, 'Duplicate (Ctrl or Cmd+D)') : null}
      ${tb(locked ? 'Unlock' : 'Lock', 'lock', onLock, locked, false, locked ? 'Unlock: the layer can be moved and edited again' : 'Lock: the layer keeps its place through directions and hand edits')}
      ${tb('Bring forward', 'up', () => onOrder('forward'), false, locked)}${tb('Send backward', 'down', () => onOrder('backward'), false, locked)}
      ${!mark ? tb('Delete', 'trash', onDelete, false, locked, 'Delete (Delete key); the approved words are hidden, never deleted') : null}
      ${tb('More', 'dots', onMore, false, false, 'Every property of the selection, in the Properties tab')}
      ${pop === 'color' && text ? html`<div class="st-fbar-pop"><${Swatches} value=${one.color} palette=${pal} label="Text colour" onPick=${c => { onPatchEach(() => ({ color: c })); setPop(''); }} /></div>` : null}
      ${pop === 'fill' && shape ? html`<div class="st-fbar-pop"><${Swatches} value=${one.fill} palette=${pal} label="Fill" onPick=${c => { onPatch({ fill: c }); setPop(''); }} /></div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ words typed in place */
  /** A text area over the layer, set in the layer's own face, size, weight, colour and alignment, so the words are edited where
      they sit. Ctrl or Cmd+Enter (or leaving it) keeps them; Escape puts them back. The approved words (headline, support, call
      to action) are edited as copy - the same as the Copy tab - and the rest as the layer's own text. */
  function TextEditor({ layer, value, layout, stageW, onCommit, onCancel, onChange }) {
    const [t, setT] = useState(value || ''); const ref = useRef(null); const done = useRef(false);
    useEffect(() => { const el = ref.current; if (el) { el.focus(); el.select(); } }, []);
    const px = (layer.size || 4) / 100 * stageW;
    const kit = (layout && layout.fonts) || {};
    const fam = [layer.family, layer.font === 'body' ? kit.body : layer.font === 'mono' ? '' : kit.display].filter(Boolean).map(f => '"' + f + '"').concat([layer.font === 'mono' ? '"Spline Sans Mono", monospace' : layer.font === 'body' ? '"Instrument Sans", sans-serif' : '"Bricolage Grotesque", sans-serif']).join(', ');
    const finish = keep => { if (done.current) return; done.current = true; if (keep && t !== value) onCommit(t); else onCancel(); };
    const style = { left: layer.x + '%', top: layer.y + '%', width: layer.w + '%', minHeight: Math.max(layer.h || 0, (layer.size || 4) * 1.4) + '%', fontFamily: fam, fontSize: px + 'px', fontWeight: layer.weight || 600, fontStyle: layer.italic ? 'italic' : 'normal', lineHeight: layer.lineHeight || 1.12, letterSpacing: (layer.letterSpacing || 0) + 'em', color: layer.color || '#fff', textAlign: layer.align === 'center' ? 'center' : layer.align === 'right' ? 'right' : 'left', textTransform: layer.case === 'upper' || layer.emphasis === 'caps' ? 'uppercase' : layer.case === 'lower' ? 'lowercase' : layer.case === 'title' ? 'capitalize' : 'none', transform: layer.rotate ? 'rotate(' + layer.rotate + 'deg)' : undefined };
    return html`<textarea ref=${ref} class="st-le-textedit" style=${style} value=${t} aria-label=${'Words of the ' + (layer.role || 'text') + ' layer'} spellCheck="true"
      onInput=${e => { setT(e.target.value); if (onChange) onChange(e.target.value); }} onPointerDown=${e => e.stopPropagation()}
      onKeyDown=${e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finish(false); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); finish(true); } }}
      onBlur=${() => finish(true)}></textarea>`;
  }

  /* ------------------------------------------------------------ adding elements */
  function AddMenu({ onAdd, onImage, palette }) {
    const [open, setOpen] = useState(''); const ref = useRef(null); const file = useRef(null);
    useEffect(() => { if (!open) return; const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(''); }; document.addEventListener('pointerdown', h); return () => document.removeEventListener('pointerdown', h); }, [open]);
    const icons = Object.keys((R && R.ICONS) || {});
    const add = (k, o) => { onAdd(k, o); setOpen(''); };
    return html`<span class="st-addmenu" ref=${ref}>
      <button class=${'btn sm' + (open ? ' on' : ' ghost')} aria-expanded=${!!open} aria-haspopup="menu" onClick=${() => setOpen(open ? '' : 'main')}><${Icon} n="plus" size=${14} /> Add</button>
      <input ref=${file} type="file" hidden accept="image/png,image/jpeg,image/webp" aria-label="Image to place" onChange=${e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) onImage(f); setOpen(''); }} />
      ${open === 'main' ? html`<div class="st-addmenu-pop" role="menu">
        <div class="st-addmenu-h">Text</div>
        <button role="menuitem" onClick=${() => add('heading')}>Heading</button><button role="menuitem" onClick=${() => add('text')}>Body text</button><button role="menuitem" onClick=${() => add('label')}>Label</button>
        <div class="st-addmenu-h">Shapes</div>
        <div class="st-addmenu-shapes">${[['rect', 'Rectangle'], ['pill', 'Pill'], ['circle', 'Circle'], ['triangle', 'Triangle'], ['rule', 'Line'], ['arrow', 'Arrow']].map(([k, l]) => html`<button key=${k} role="menuitem" class=${'st-shape-btn ' + k} title=${l} aria-label=${'Add a ' + l.toLowerCase()} onClick=${() => add('shape', { shape: k })}><span></span></button>`)}</div>
        <div class="st-addmenu-h">More</div>
        <button role="menuitem" onClick=${() => setOpen('icons')}>Icon...</button><button role="menuitem" onClick=${() => file.current && file.current.click()}>Image from a file...</button>
      </div>` : null}
      ${open === 'icons' ? html`<div class="st-addmenu-pop icons" role="menu" aria-label="Icons">${icons.map(n => html`<button key=${n} role="menuitem" class="st-icon-btn" title=${n} aria-label=${'Add the ' + n + ' icon'} onClick=${() => add('icon', { icon: n })}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" dangerouslySetInnerHTML=${{ __html: R.ICONS[n] }}></svg></button>`)}</div>` : null}
    </span>`;
  }
  /** A new layer of the kind asked for, centred on the stage, in the palette's colours. */
  function newLayer(kind, o, layout) {
    o = o || {}; const pal = (layout && layout.palette) || {}; const prim = /^#[0-9a-f]{6}$/i.test(pal.primary || '') ? pal.primary : '#0E6A6E';
    if (kind === 'heading') return { id: uid('t'), type: 'text', role: 'free', name: 'Heading', text: 'Your heading', x: 15, y: 40, w: 70, h: 12, size: 6, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' };
    if (kind === 'text') return { id: uid('t'), type: 'text', role: 'free', name: 'Text', text: 'Your text', x: 15, y: 46, w: 70, h: 8, size: 3, weight: 500, color: '#FFFFFF', align: 'left', font: 'body' };
    if (kind === 'label') return { id: uid('t'), type: 'text', role: 'label', name: 'Label', text: 'LABEL', x: 15, y: 30, w: 40, h: 5, size: 2.2, weight: 700, color: '#FFFFFF', align: 'left', font: 'mono', letterSpacing: 0.1 };
    // S23: the Elements panel's text styles, frames (an empty image box to drop a picture into), arrows and the brand marks
    if (kind === 'style') { const st = o.style; if (st === 'heading' || st === 'text' || st === 'label') return newLayer(st, {}, layout);
      if (st === 'subheading') return { id: uid('t'), type: 'text', role: 'free', name: 'Subheading', text: 'Your subheading', x: 15, y: 44, w: 70, h: 9, size: 4.2, weight: 700, color: '#FFFFFF', align: 'left', font: 'display' };
      if (st === 'quote') return { id: uid('t'), type: 'text', role: 'free', name: 'Quote', text: '\u201cA line worth quoting.\u201d', x: 12, y: 38, w: 76, h: 16, size: 4.6, weight: 600, italic: true, color: '#FFFFFF', align: 'left', font: 'display', lineHeight: 1.18 };
      if (st === 'number') return { id: uid('t'), type: 'text', role: 'free', name: 'Big number', text: '74', x: 15, y: 30, w: 50, h: 22, size: 16, weight: 800, color: '#FFFFFF', align: 'left', font: 'display', lineHeight: 1 }; return null; }
    if (kind === 'frame') return { id: uid('m'), type: 'img', role: 'frame', name: o.mask === 'circle' ? 'Circle frame' : o.mask === 'round' ? 'Rounded frame' : 'Image frame', x: 30, y: 30, w: 40, h: o.mask === 'circle' ? 40 * ((layout && layout.stage && layout.stage.w) || 1080) / ((layout && layout.stage && layout.stage.h) || 1080) : 32, fit: 'cover', mask: o.mask === 'circle' ? 'circle' : undefined, radius: o.mask === 'round' ? 4 : undefined };
    if (kind === 'upload') return { id: uid('m'), type: 'img', role: 'image', name: o.name || 'Image', key: o.key, src: o.url, x: 25, y: 25, w: 50, h: 50, fit: 'contain' };
    // a mark from the brand kit: the id the worker gives marks ('logo', 'wordmark') when it is free, its campaign named, placed
    // exactly from its file (the worker refuses a mark the campaign's policy does not carry)
    if (kind === 'mark') { const role = o.role === 'wordmark' ? 'wordmark' : 'logo'; const free = !((layout && layout.layers) || []).some(l => l.id === role);
      return { id: free ? role : uid('m'), type: 'img', role, asset: role, campaign: role === 'wordmark' && o.campaign ? o.campaign : undefined, name: o.label || role, src: o.src, variant: o.variant || undefined, x: 70, y: 86, w: 24, h: 9, fit: 'contain', exact: true }; }
    if (kind === 'shape') { const s = o.shape || 'rect'; const line = s === 'rule' || s === 'arrow'; return { id: uid('s'), type: 'shape', role: 'device', name: s === 'rule' ? 'Line' : s.charAt(0).toUpperCase() + s.slice(1), shape: s, x: line ? 30 : 35, y: line ? 48 : 35, w: line ? 40 : 30, h: s === 'rule' ? 0.6 : s === 'arrow' ? 6 : s === 'pill' ? 10 : 30, fill: /^#[0-9a-f]{6}$/i.test(o.fill || '') ? o.fill : prim, radius: s === 'rect' ? 1 : undefined, opacity: 1 }; }
    if (kind === 'icon') return { id: uid('i'), type: 'shape', role: 'device', name: 'Icon: ' + o.icon, shape: 'icon', icon: o.icon, x: 42, y: 42, w: 16, h: 16, fill: '#FFFFFF', strokeWidth: 2 };
    if (kind === 'image') return { id: uid('m'), type: 'img', role: 'image', name: o.name || 'Image', key: o.key, src: o.url, x: 25, y: 25, w: 50, h: 50, fit: 'contain' };
    return null;
  }
  /** Copies of layers for duplicate and paste: new ids, offset, groups renamed together. The approved words are copied as the
      words they show (a second headline would be the same words twice), and a mark is never copied (it is placed from its file). */
  function cloneLayers(layers, copy, layout, off) {
    const g = {}; const d = off == null ? 2 : off;
    return layers.filter(l => !isMark(l)).map(l => { const n = JSON.parse(JSON.stringify(l)); n.id = uid(n.type === 'text' ? 't' : n.type === 'img' ? 'm' : 's'); delete n.locked; delete n.part; delete n.rule;
      if (n.group) { g[n.group] = g[n.group] || ('g' + uid('')); n.group = g[n.group]; }
      if (n.type === 'text' && COPY_ROLES.indexOf(n.role) >= 0) { n.text = R && R.displayedText ? R.displayedText(layout, l, copy) : (copy || {})[l.role] || ''; n.role = 'free'; n.name = 'Copy of the ' + l.role; }
      n.x = r1((n.x || 0) + d); n.y = r1((n.y || 0) + d); return n; });
  }

  /* ------------------------------------------------------------ gestures: snapping, resizing, rotation */
  /** The guides a moving box can settle on: the stage edges and centre, the format's safe area, a grid when it is on, and every
      other visible layer's edges and centre. Returns the offset to apply and the guides to draw (per cent of the stage). */
  function snapMove(box, others, safe, opts) {
    opts = opts || {}; const T = opts.threshold || 0.8;
    const xs = [0, 50, 100, safe.left, safe.right], ys = [0, 50, 100, safe.top, safe.bottom];
    if (opts.grid) for (let k = opts.grid; k < 100; k += opts.grid) { xs.push(k); ys.push(k); }
    others.forEach(o => { xs.push(o.x, o.x + o.w / 2, o.x + o.w); ys.push(o.y, o.y + o.h / 2, o.y + o.h); });
    const best = (vals, edges) => { let b = null; edges.forEach(([pos, kind]) => vals.forEach(v => { const d = v - pos; if (Math.abs(d) <= T && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, at: v, kind }; })); return b; };
    const bx = best(xs, [[box.x, 'start'], [box.x + box.w / 2, 'centre'], [box.x + box.w, 'end']]);
    const by = best(ys, [[box.y, 'start'], [box.y + box.h / 2, 'centre'], [box.y + box.h, 'end']]);
    const guides = []; if (bx) guides.push({ axis: 'x', at: bx.at }); if (by) guides.push({ axis: 'y', at: by.at });
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
  }
  /** Resize from one of eight handles in the layer's own frame (so a turned layer resizes along its own sides): the opposite
      side stays put (or the centre, with Alt); Shift, a corner of a mark or an image keeps the proportions. Pixels in, per cent out. */
  function resizeLocal(o, handle, dxp, dyp, W, H, mods) {
    mods = mods || {}; const th = (o.rotate || 0) * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
    const lx = dxp * cs + dyp * sn, ly = -dxp * sn + dyp * cs;
    const hx = handle.indexOf('e') >= 0 ? 1 : handle.indexOf('w') >= 0 ? -1 : 0, hy = handle.indexOf('s') >= 0 ? 1 : handle.indexOf('n') >= 0 ? -1 : 0;
    const w0 = o.w / 100 * W, h0 = Math.max(1, (o.h || 0) / 100 * H);
    let dw = hx * lx * (mods.centre ? 2 : 1), dh = hy * ly * (mods.centre ? 2 : 1);
    if (mods.keep && (hx || hy)) { const k = hx && hy ? Math.max((w0 + dw) / w0, (h0 + dh) / h0) : hx ? (w0 + dw) / w0 : (h0 + dh) / h0; dw = w0 * (k - 1); dh = h0 * (k - 1); }
    const minW = (mods.minW || 2) / 100 * W, minH = (mods.minH || 1) / 100 * H;
    const nw = Math.max(minW, w0 + dw), nh = Math.max(minH, h0 + dh); const aw = nw - w0, ah = nh - h0;
    const cxL = mods.centre ? 0 : (mods.keep && !hx ? 0 : hx) * aw / 2, cyL = mods.centre ? 0 : (mods.keep && !hy ? 0 : hy) * ah / 2;
    const cx0 = o.x / 100 * W + w0 / 2, cy0 = (o.y || 0) / 100 * H + h0 / 2; const cx = cx0 + cxL * cs - cyL * sn, cy = cy0 + cxL * sn + cyL * cs;
    return { x: r1((cx - nw / 2) / W * 100), y: r1((cy - nh / 2) / H * 100), w: r1(nw / W * 100), h: r1(nh / H * 100), k: nw / w0 };
  }
  /** The angle from the layer's centre to the pointer, a quarter turn back so the handle above the box reads 0; Shift steps by
      15 degrees, and it settles on the square angles within 3 degrees. */
  function angleTo(cx, cy, px, py, step) {
    let a = Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90; a = ((a + 180) % 360 + 360) % 360 - 180;
    if (step) a = Math.round(a / 15) * 15; else [-180, -90, 0, 90, 180].forEach(s => { if (Math.abs(a - s) < 3) a = s; });
    return Math.round(a * 10) / 10;
  }

  /* ------------------------------------------------------------ properties: type extras, effects, image */
  const num = (label, value, set, o) => html`<label>${label} <input class="st-in" type="number" step=${(o && o.step) || 1} min=${o && o.min} max=${o && o.max} value=${value} aria-label=${(o && o.aria) || label} onChange=${e => { const n = +e.target.value; if (isFinite(n)) set(n); }} /></label>`;
  function TypeExtras({ l, onPatch, onFont }) {
    return html`<div class="st-le-type st-le-typex" aria-label="Typeface and paragraph">
      <span class="st-lbl">Typeface</span>
      <button class="btn sm ghost st-font-btn" onClick=${onFont} aria-label=${'Font: ' + (l.family || 'the brand font for this role')}>${l.family || 'Brand font'}</button>
      <label class="st-check"><input type="checkbox" checked=${!!l.italic} onChange=${e => onPatch({ italic: e.target.checked || undefined })} /> italic</label>
      <label>Case <select class="st-sel" value=${l.case || ''} aria-label="Case" onChange=${e => onPatch({ case: e.target.value || undefined })}><option value="">as written</option><option value="upper">UPPER</option><option value="lower">lower</option><option value="title">Title Case</option></select></label>
      ${num('Paragraph gap', l.paraSpacing || 0, n => onPatch({ paraSpacing: n > 0 ? Math.min(3, Math.round(n * 100) / 100) : undefined }), { step: 0.1, min: 0, max: 3, aria: 'Paragraph spacing, times the type size' })}
      ${l.family && R && R.fontEntry && !R.fontEntry(l.family) ? html`<span class="ov-dim">not in the catalogue: fetched from Google Fonts by name; the validation says if it did not load</span>` : null}
    </div>`;
  }
  function Toggle({ on, label, onChange }) { return html`<label class="st-check"><input type="checkbox" checked=${!!on} onChange=${e => onChange(e.target.checked)} /> ${label}</label>`; }
  const BLEND_WORD = { '': 'normal', multiply: 'multiply', screen: 'screen', overlay: 'overlay', 'soft-light': 'soft light', 'hard-light': 'hard light', darken: 'darken', lighten: 'lighten', 'color-dodge': 'colour dodge', 'color-burn': 'colour burn', difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation', color: 'colour', luminosity: 'luminosity' };
  function EffectsPanel({ l, palette, onPatch }) {
    const sh = l.shadow || null, st = l.stroke || null, gl = l.glow || null; const text = l.type === 'text';
    const set = (k, base, patch) => onPatch({ [k]: Object.assign({}, base || {}, patch) });
    return html`<div class="st-le-type st-le-effects" aria-label="Effects">
      <span class="st-lbl">Effects</span>
      <label class="st-le-slider">Opacity <input type="range" min="0" max="100" value=${Math.round((l.opacity == null ? 1 : l.opacity) * 100)} aria-label="Opacity" onChange=${e => onPatch({ opacity: Math.round(+e.target.value) / 100 })} /><span>${Math.round((l.opacity == null ? 1 : l.opacity) * 100)}%</span></label>
      <label>Blend <select class="st-sel" value=${l.blend || ''} aria-label="Blend mode" onChange=${e => onPatch({ blend: e.target.value || undefined })}>${Object.keys(BLEND_WORD).map(k => html`<option key=${k || 'n'} value=${k}>${BLEND_WORD[k]}</option>`)}</select></label>
      <div class="st-le-fx"><${Toggle} on=${!!sh} label="Shadow" onChange=${on => onPatch({ shadow: on ? { x: 0, y: 0.8, blur: 2, color: 'rgba(0,0,0,0.45)' } : undefined })} />
        ${sh ? html`${num('X', sh.x || 0, n => set('shadow', sh, { x: clamp(n, -10, 10) }), { step: 0.2, aria: 'Shadow offset across' })}${num('Y', sh.y || 0, n => set('shadow', sh, { y: clamp(n, -10, 10) }), { step: 0.2, aria: 'Shadow offset down' })}${num('Blur', sh.blur || 0, n => set('shadow', sh, { blur: clamp(n, 0, 20) }), { step: 0.2, min: 0, aria: 'Shadow blur' })}<${Swatches} value=${sh.color} palette=${palette} label="Shadow colour" onPick=${c => set('shadow', sh, { color: c })} />` : null}</div>
      <div class="st-le-fx"><${Toggle} on=${!!st} label=${text ? 'Outline' : 'Border'} onChange=${on => onPatch({ stroke: on ? { width: text ? 0.25 : 0.4, color: text ? '#000000' : '#FFFFFF' } : undefined })} />
        ${st ? html`${num('Width', st.width || 0, n => set('stroke', st, { width: clamp(n, 0, 5) }), { step: 0.05, min: 0, aria: text ? 'Outline width' : 'Border width' })}<${Swatches} value=${st.color} palette=${palette} label=${text ? 'Outline colour' : 'Border colour'} onPick=${c => set('stroke', st, { color: c })} />` : null}</div>
      ${text ? html`<div class="st-le-fx"><${Toggle} on=${!!gl} label="Glow" onChange=${on => onPatch({ glow: on ? { blur: 2, color: '#FFFFFF' } : undefined })} />
        ${gl ? html`${num('Size', gl.blur || 0, n => set('glow', gl, { blur: clamp(n, 0, 40) }), { step: 0.2, min: 0, aria: 'Glow size' })}<${Swatches} value=${gl.color} palette=${palette} label="Glow colour" onPick=${c => set('glow', gl, { color: c })} />` : null}</div>` : null}
      <label class="st-le-slider">Blur <input type="range" min="0" max="40" value=${Math.round((l.blur || 0) * 10)} aria-label="Blur" onChange=${e => onPatch({ blur: +e.target.value ? Math.round(+e.target.value) / 10 : undefined })} /><span>${l.blur || 0}</span></label>
      ${l.type === 'shape' && l.shape !== 'icon' ? html`<div class="st-le-fx"><${Toggle} on=${!!l.fill2} label="Two-colour fill" onChange=${on => onPatch({ fill2: on ? (palette && palette.secondary) || '#000000' : undefined, dir: on ? l.dir || 'down' : l.dir })} />${l.fill2 ? html`<${Swatches} value=${l.fill2} palette=${palette} label="Second colour" onPick=${c => onPatch({ fill2: c })} /><select class="st-sel" value=${l.dir || 'down'} aria-label="Direction" onChange=${e => onPatch({ dir: e.target.value })}><option value="down">top to bottom</option><option value="up">bottom to top</option><option value="right">left to right</option><option value="left">right to left</option></select>` : null}</div>` : null}
      ${text ? html`<span class="ov-dim">An outline thick enough, in a colour that stands off the words, counts toward their contrast; a shadow or glow is not measured.</span>` : null}
    </div>`;
  }
  const ADJ = [['brightness', 'Brightness'], ['contrast', 'Contrast'], ['saturation', 'Saturation'], ['warmth', 'Warmth'], ['tint', 'Tint'], ['sharpness', 'Sharpness']];
  function ImagePanel({ l, onPatch, onReplace }) {
    const a = l.adjust || {};
    const setA = (k, n) => { const x = Object.assign({}, a, { [k]: n }); if (!n) delete x[k]; onPatch({ adjust: Object.keys(x).length ? x : undefined }); };
    return html`<div class="st-le-type st-le-image" aria-label="Image">
      <span class="st-lbl">Image${l.role === 'region' ? ' region' : ''}</span>
      ${ADJ.map(([k, lb]) => html`<label key=${k} class="st-le-slider">${lb} <input type="range" min="-100" max="100" value=${a[k] || 0} aria-label=${lb} onChange=${e => setA(k, Math.round(+e.target.value))} /><span>${a[k] || 0}</span></label>`)}
      ${Object.keys(a).length ? html`<button class="ov-link" onClick=${() => onPatch({ adjust: undefined })}>reset the adjustments</button>` : null}
      <div class="st-le-fx"><${Toggle} on=${!!l.flipX} label="Flip across" onChange=${on => onPatch({ flipX: on || undefined })} /><${Toggle} on=${!!l.flipY} label="Flip down" onChange=${on => onPatch({ flipY: on || undefined })} /></div>
      <label>Shape <select class="st-sel" value=${l.mask === 'circle' ? 'circle' : +l.radius > 0 ? 'rounded' : ''} aria-label="Image shape" onChange=${e => onPatch(e.target.value === 'circle' ? { mask: 'circle', radius: undefined } : e.target.value === 'rounded' ? { mask: undefined, radius: 3 } : { mask: undefined, radius: undefined })}><option value="">rectangle</option><option value="rounded">rounded</option><option value="circle">circle</option></select></label>
      ${+l.radius > 0 && l.mask !== 'circle' ? num('Corner radius', l.radius, n => onPatch({ radius: n > 0 ? clamp(n, 0, 50) : undefined }), { step: 0.5, min: 0, aria: 'Corner radius, per cent of the stage width' }) : null}
      <label>Fit <select class="st-sel" value=${l.fit === 'cover' ? 'cover' : 'contain'} aria-label="Fit" onChange=${e => onPatch({ fit: e.target.value })}><option value="contain">fit inside the box</option><option value="cover">fill the box (crop)</option></select></label>
      ${l.role === 'image' && onReplace ? html`<button class="btn sm ghost" onClick=${() => onReplace(l)}>Replace the image</button>` : null}
      <span class="ov-dim">Adjustments are drawn by the renderer: free, no generation. To change what the photograph shows, use Edit an area of the imagery (one generation).</span>
    </div>`;
  }

  /* ------------------------------------------------------------ an image file to a layer */
  /** Read a picked file, upload it to the project's uploads (checked by its bytes on the worker) and answer the new layer's key and address. */
  async function uploadImage(project, f) {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) throw new Error('PNG, JPEG or WebP only');
    if (f.size > 8 * 1024 * 1024) throw new Error('at most 8 MB');
    const b64 = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(String(rd.result).split(',')[1]); rd.onerror = () => rej(new Error('the file could not be read')); rd.readAsDataURL(f); });
    const r = await call('/studio/image/upload', { project, imageB64: b64, mime: f.type, name: f.name });
    return { key: r.key, url: r.url, name: f.name.replace(/\.[a-z]+$/i, '').slice(0, 40) };
  }

  /* ------------------------------------------------------------ named styles: the same words, marks and imagery */
  /** Ten named treatments (Minimal, Bold, Editorial, Data-led, Social-first, Corporate, Premium, High-impact, Clean,
      Campaign-style) of this composition: typefaces, weights, panels and colours change; the words, the marks, the photograph
      and every locked layer do not. Each is measured (and repaired where geometry or colour can) before it is offered. Free. */
  function StyleVariations({ a, v, ns, comp, ro, onUse, using }) {
    const [list, setList] = useState(null); const [open, setOpen] = useState(false);
    useEffect(() => { setList(null); if (!open || !comp.ready || !R.styles) return; let live = true; const cancel = { cancelled: false }; (async () => { try { if (R.preloadStyles) await R.preloadStyles(4500); const o = { fonts: comp.fonts, format: a.format, channel: a.channel, locks: a.locks, cancel }; const out = R.stylesAsync ? await R.stylesAsync(v.layout, v.copy, comp.imgs, o) : R.styles(v.layout, v.copy, comp.imgs, o); if (live && out) setList(out); } catch (e) { if (live) setList([]); } })(); return () => { live = false; cancel.cancelled = true; }; }, [open, v && v.id, comp.key, comp.ready]);
    if ((a.locks || {}).layout) return null;
    return html`<section class="st-vars st-styles" aria-label="Style variations">
      <div class="st-vars-head"><b>Style variations</b> <span class="ov-dim">ten named treatments of the same words, marks and imagery: typefaces, weights, panels and colour, each measured. Free, no generation.</span> <button class="ov-link" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? 'hide' : 'show the styles'}</button></div>
      ${open ? (!list ? html`<div class="ov-dim st-pad">Fetching the typefaces and measuring each style...</div>` : !list.length ? html`<div class="ov-dim st-pad">No style can be applied to this composition (no live words).</div>` : html`<div class="st-vars-grid">${list.map(x => html`<div key=${x.id} class=${'st-var' + (x.ok ? '' : ' bad')} data-style=${x.id}>
          <${K.Composition} v=${Object.assign({}, v, { layout: x.layout })} a=${a} ns=${ns} size="card" />
          <div class="st-var-name">${x.name}</div><div class="ov-dim st-var-why">${x.note}</div>
          <div class="st-var-state">${x.ok ? html`<${K.Chip} kind="ok" title=${x.steps.length ? 'after: ' + x.steps.join('; ') : 'measured as it would export'}>passes</${K.Chip}>` : html`<${K.Chip} kind="bad" title=${x.blocking.join('; ')}>${x.blocking.length} blocking</${K.Chip}>`}${x.families.length ? html` <${K.Chip} title="Typefaces fetched from Google Fonts; a face that did not load is reported by the validation">${x.families.join(', ')}</${K.Chip}>` : null}</div>
          ${!x.ok ? html`<div class="ov-dim st-var-why">${x.blocking.join('; ')}</div>` : null}
          ${!ro ? html`<button class="btn sm ghost" disabled=${!!using} onClick=${() => onUse(x)}>${using === x.id ? 'Saving...' : 'Use this style'}</button>` : null}</div>`)}</div>`) : null}
    </section>`;
  }

  /* ------------------------------------------------------------ resize to platform formats */
  const PRESETS = [['meta-square', 'Meta square', '1:1'], ['meta-portrait', 'Meta portrait', '4:5'], ['story', 'Story or reel', '9:16'], ['linkedin', 'LinkedIn link', '1.91:1'], ['linkedin-square', 'LinkedIn square', '1:1'], ['x', 'X landscape', '16:9'], ['display', 'Display (medium rectangle)', '6:5'], ['youtube', 'YouTube thumbnail', '16:9']];
  /** The composition re-laid for other platforms: one new asset per format in the same family, from the composition as it
      stands (its words, styling, placed images and photograph), measured like any other. No generation. */
  function ResizePanel({ a, v, ro, busy, onResize, onOpen, made }) {
    const [pick, setPick] = useState([]); const [open, setOpen] = useState(false);
    if (ro || !v || v.mode === 'copy') return null;
    const painted = v.mode === 'finished' || v.mode === 'artwork';
    const togg = k => setPick(pick.indexOf(k) >= 0 ? pick.filter(x => x !== k) : pick.concat([k]));
    return html`<section class="st-resize" aria-label="Resize to other formats">
      <div class="st-vars-head"><b>Resize to other formats</b> <span class="ov-dim">the same words, styling and image, re-laid for each platform as a new asset in ${a.family}; nothing generated, each measured before it is approved</span> <button class="ov-link" aria-expanded=${open} onClick=${() => setOpen(!open)}>${open ? 'hide' : 'choose formats'}</button></div>
      ${open ? html`${painted ? html`<div class="st-warnbar" role="note"><span>This creative is one painted bitmap: its words cannot be re-laid. Make an editable copy first (free), or regenerate it in the other format.</span></div>` : html`
        <div class="st-resize-grid" role="group" aria-label="Formats">${PRESETS.map(([k, l, f]) => { const same = f === a.format; return html`<label key=${k} class=${'st-resize-opt' + (pick.indexOf(k) >= 0 ? ' on' : '') + (same ? ' same' : '')}><input type="checkbox" checked=${pick.indexOf(k) >= 0} onChange=${() => togg(k)} /><span class=${'st-resize-ar'} style=${{ aspectRatio: f.replace(':', ' / ') }}></span><span><b>${l}</b><span class="ov-dim">${f}${same ? ' (this format)' : ''}</span></span></label>`; })}</div>
        <div class="st-nd-row"><button class="btn sm" disabled=${!pick.length || !!busy} onClick=${() => { onResize(pick); setPick([]); }}>Make ${pick.length || ''} resized version${pick.length === 1 ? '' : 's'}</button><span class="ov-dim">free: no model call, no render</span></div>`}
        ${made && made.length ? html`<div class="st-resize-made"><span class="st-lbl">Made</span>${made.map(m => html`<button key=${m.asset} class="st-chipbtn" onClick=${() => onOpen(m.asset)}>${m.title.replace(a.title + ' - ', '')} (${m.format})</button>`)}</div>` : null}` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ the creative quality summary */
  // every code the renderer can report belongs to an area; one it does not know lands in "Other findings", never in silence
  const Q_AREAS = [
    ['readability', 'Readability', /^(low_contrast|unreadable_contrast|patchy_contrast|small_type|unreadable_type|faint|word_broken|occluded|invisible)$/],
    ['layout', 'Layout', /^(text_overflow|collision|off_canvas|text_too_wide|duplicate_text|duplicate_id|invalid_geometry|double_styling)$/],
    ['imagery', 'Imagery', /^(imagery_missing|imagery_sketch|subject_covered|subject_cropped|pixels_unmeasured)$/],
    ['brand', 'Brand', /^(mark_[a-z_]+|font_fallback)$/],
    ['accessibility', 'Accessibility', /^(low_contrast|unreadable_contrast|patchy_contrast|small_type|unreadable_type|faint)$/],
    ['platform', 'Platform fit', /^(safe_area)$/],
  ];
  const Q_COPY = { over_limit: 'platform', too_many_hashtags: 'platform' };
  // what a layout fix cannot touch: the imagery, a mark file, a measurement that could not read the pixels
  const Q_NOT_LAYOUT = /^(imagery_missing|imagery_sketch|mark_unloaded|mark_unmeasured|pixels_unmeasured)$/;
  const Q_NOT_LAYOUT_WORD = { imagery_missing: 'no imagery yet: generate it, or use a solid ground', imagery_sketch: 'the imagery is a sketch: generate it', mark_unloaded: 'a mark file did not load: measure again', mark_unmeasured: 'a mark was not measured: measure again', pixels_unmeasured: 'the pixels could not be read: measure again' };
  /** A rating per area, read from the validation the renderer measured and the copy checks on the version (never an opinion):
      Good with nothing found, Fair with warnings, Poor with a blocking finding; each names what it found. Fix automatically
      runs the same bounded repair as Fix layout (never a word changed), offered only when a blocking finding is a layout
      matter; what no layout move can fix is named with its remedy. */
  function QualitySummary({ v, val, copy, onFix, fixing, ro, fixable, fixNote }) {
    if (!val) return html`<section class="st-qsum" aria-label="Creative quality"><span class="st-lbl">Creative quality</span><span class="ov-dim">measuring...</span></section>`;
    const alt = String((copy && copy.alt) || (v.copy || {}).alt || '').trim();
    const copyHits = (v.checks || []).filter(c => Q_COPY[c.state]).map(c => ({ code: c.state, severity: 'warning', layers: [], area: Q_COPY[c.state] }));
    const known = i => Q_AREAS.some(([, , rx]) => rx.test(i.code));
    const rows = Q_AREAS.map(([k, label, rx]) => {
      const hits = val.issues.filter(i => rx.test(i.code)).concat(copyHits.filter(c => c.area === k)); const extra = k === 'accessibility' && !alt ? [{ code: 'alt_text_missing', severity: 'warning', layers: [] }] : [];
      return { k, label, all: hits.concat(extra) };
    });
    const other = val.issues.filter(i => !known(i)); if (other.length) rows.push({ k: 'other', label: 'Other findings', all: other });
    rows.forEach(r => { const bad = r.all.some(i => i.severity === 'blocking'); r.rating = bad ? 'poor' : r.all.length ? 'fair' : 'good'; r.found = r.all.map(i => i.code.replace(/_/g, ' ')).filter((x, i, a) => a.indexOf(x) === i); });
    const blockers = val.issues.filter(i => i.severity === 'blocking'); const canFix = fixable !== undefined ? !!fixable : blockers.some(i => !Q_NOT_LAYOUT.test(i.code));
    const notLayout = blockers.filter(i => Q_NOT_LAYOUT.test(i.code)).map(i => Q_NOT_LAYOUT_WORD[i.code] || i.code.replace(/_/g, ' ')).filter((x, i, a) => a.indexOf(x) === i);
    const overall = blockers.length ? 'poor' : rows.some(r => r.rating === 'fair') ? 'fair' : 'good';
    return html`<section class="st-qsum" aria-label="Creative quality" data-overall=${overall}>
      <div class="st-qsum-h"><span class="st-lbl">Creative quality</span><span class="ov-dim">measured at ${val.W} x ${val.H}; ratings come from the measurement, not a model</span>${!ro && canFix && onFix ? html`<button class="btn sm" disabled=${!!fixing} onClick=${onFix} title="Moves, fits or recolours; never changes a word. A layout version, no render.">${fixing ? 'Fixing...' : 'Fix automatically'}</button>` : null}</div>
      <ul class="st-qsum-list">${rows.map(r => html`<li key=${r.k} class=${'st-qsum-row ' + r.rating} data-area=${r.k}><span class="st-qsum-dot" aria-hidden="true"></span><b>${r.label}</b><span class=${'st-qsum-rate ' + r.rating}>${r.rating === 'good' ? 'Good' : r.rating === 'fair' ? 'Fair' : 'Poor'}</span><span class="ov-dim">${r.found.length ? r.found.join(', ') : 'nothing found'}</span></li>`)}</ul>
      ${fixNote ? html`<div class="st-qsum-fixed" role="status">${fixNote} <span class="ov-dim">The full outcome and Undo fix are under the artwork.</span></div>` : null}
      ${notLayout.length ? html`<div class="ov-dim st-qsum-note" role="note"><b>Not a layout matter:</b> ${notLayout.join('; ')}. The remedies are under the artwork.</div>` : null}
      ${!ro && canFix && onFix ? html`<div class="ov-dim">Fix automatically moves, fits or recolours (never changes a word); what it cannot fix is named afterwards with the next step.</div>` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ the keyboard, written down */
  // Cmd on a Mac, Ctrl elsewhere: the editor's key handler takes either, the sheet names the one this machine has
  const MOD = (typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '')) ? 'Cmd' : 'Ctrl';
  /** Every key the canvas answers to, in one list: what is written here is what the editor does (the S17 editor harness presses
      the ones it can and reads this list). */
  const SHORTCUTS = [
    ['Selection', [['Click', 'select a layer'], ['Shift+click', 'add to the selection, or take a layer out of it'], ['Drag on the empty stage', 'select every layer the box touches'], [MOD + '+A', 'select every unlocked layer'], ['Escape', 'clear the selection']]],
    ['Layers', [['Right-click, press and hold, Shift+F10', 'the actions for the selection'], ['Delete or Backspace', 'remove (the approved words are hidden, never deleted)'], [MOD + '+D', 'duplicate'], [MOD + '+C, ' + MOD + '+V', 'copy and paste (an image or plain text from elsewhere is placed too)'], [MOD + '+Alt+C, ' + MOD + '+Alt+V', 'copy a style, paste it onto the selection'], [MOD + '+G, ' + MOD + '+Shift+G', 'group, ungroup'], [MOD + '+], ' + MOD + '+[', 'bring forward, send backward'], [MOD + '+Shift+], ' + MOD + '+Shift+[', 'to the front, to the back'], ['F2', 'rename'], ['Arrow keys', 'nudge 0.5% (2% with Shift)']]],
    ['Words', [['Enter or double-click', 'edit the words where they sit'], [MOD + '+Enter', 'keep them (leaving the field keeps them too)'], ['Escape', 'put them back']]],
    ['Gestures', [['Shift with a corner', 'keep the proportions'], ['Alt with a handle', 'resize from the centre'], ['Alt while dragging', 'move without snapping or equal spacing'], ['Shift while rotating', '15 degree steps'], ['A corner of several selected', 'scale them together, type with them (Alt: from the centre)'], ['The handle above several selected', 'turn them together about their centre (Shift: 15 degree steps)']]],
    ['History', [[MOD + '+Z', 'undo'], [MOD + '+Shift+Z or ' + MOD + '+Y', 'redo']]],
    ['View', [['Shift+1', 'fit'], ['Shift+0', 'actual size'], ['Shift+2', 'zoom to the selection (200% with nothing selected)'], [MOD + '+=, ' + MOD + '+-', 'zoom in, zoom out'], [MOD + ' with the wheel', 'zoom'], ['Space and drag', 'pan'], ['Two fingers', 'pinch to zoom, drag to pan'], ['Double-click an image', 'reframe it inside its box']]],
    ['Studio', [['Alt+1 to Alt+7', 'go to a step'], ['?', 'this list']]],
  ];
  /** The shortcuts as a dialog: Escape or ? closes it, and while it is open the canvas takes no key (a Delete pressed here must
      not remove the selection behind it). */
  function ShortcutsSheet({ onClose }) {
    const ref = useRef(null);
    useEffect(() => { const el = ref.current; if (el) el.focus(); }, []);
    return html`<div class="st-dialog st-keys" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onPointerDown=${e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }} onKeyDown=${e => { e.stopPropagation(); if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); onClose(); } }}>
      <div class="st-dialog-box st-keys-box" tabIndex="-1" ref=${ref}>
        <div class="st-keys-h"><span class="ov-title">Keyboard shortcuts</span><button class="btn sm ghost" onClick=${onClose}>Close</button></div>
        <div class="st-keys-grid">${SHORTCUTS.map(([g, rows]) => html`<section key=${g} class="st-keys-group" aria-label=${g}><h4>${g}</h4><dl>${rows.map(([k, d]) => html`<div key=${k}><dt><kbd>${k}</kbd></dt><dd>${d}</dd></div>`)}</dl></section>`)}</div>
        <div class="ov-dim">The canvas takes these wherever the focus is not in a field; a field keeps its own keys.</div>
      </div></div>`;
  }

  window.STEditor = { StyleVariations, ResizePanel, QualitySummary, FontPicker, Swatches, ContextToolbar, TextEditor, AddMenu, ShortcutsSheet, SHORTCUTS, newLayer, cloneLayers, snapMove, resizeLocal, angleTo, TypeExtras, EffectsPanel, ImagePanel, uploadImage, recentFonts, pushRecent, COPY_ROLES, isMark };
})();
