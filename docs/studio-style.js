/* AXIOM Creative Studio - the Style panel (concept C, 3 November 2026).
 *
 * The reference editor's right-hand panel, on the Studio's own data: a "Style" heading with the selected layer as a chip (a
 * select of every layer, front to back), sections that fold (remembered per browser), the Spacing box model - the selected
 * layer's distance to each edge of the artwork in output pixels, typed to move it - and a colour field whose picker works in
 * hue, saturation and brightness, says the contrast the colour would make against the ground the renderer measured behind the
 * words (never an estimate from the layout), and offers the client's saved colours first.
 * Nothing here owns state: every change goes back to the layout editor (LayoutEditor in studio.js) as a patch on one layer,
 * so it is one undo step, one layout version when saved, and drawn and measured by the one renderer. Loads after
 * studio-editor.js (window.STKit). */
(function () {
  'use strict';
  const K = window.STKit; if (!K || !window.React) return;
  const { html } = K;
  const { useState, useEffect, useRef, useLayoutEffect } = React;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const r1 = x => Math.round(x * 10) / 10;
  const isHex = c => /^#[0-9a-f]{6}$/i.test(c || '');
  const hex6 = c => { const s = String(c || '').trim(); if (/^#[0-9a-f]{3}$/i.test(s)) return ('#' + s.slice(1).split('').map(x => x + x).join('')).toUpperCase(); if (/^#[0-9a-f]{6,8}$/i.test(s)) return s.slice(0, 7).toUpperCase(); const m = /rgba?\(([^)]+)\)/i.exec(s); if (m) { const v = m[1].split(',').map(x => parseFloat(x)); if (v.length >= 3 && v.slice(0, 3).every(isFinite)) return '#' + v.slice(0, 3).map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('').toUpperCase(); } return ''; };
  const lum = hex => { const h = hex6(hex); if (!h) return 1; const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratioL = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  /** WCAG grade of a contrast ratio: AAA 7, AA 4.5, AA large 3, else fails. */
  const grade = r => r >= 7 ? ['AAA', 'aaa'] : r >= 4.5 ? ['AA', 'aa'] : r >= 3 ? ['AA large', 'large'] : ['Fails', 'fail'];
  /** The contrast a colour would make against a measured ground: the mean, and the worst patch (the darkest or brightest tenth). */
  function contrastOn(hex, ground) {
    if (!ground || typeof ground.lum !== 'number') return null;
    const f = lum(hex); const mean = ratioL(f, ground.lum);
    const worst = Array.isArray(ground.range) && ground.range.length === 2 ? Math.min(ratioL(f, ground.range[0]), ratioL(f, ground.range[1])) : null;
    return { mean: Math.round(mean * 100) / 100, worst: worst == null ? null : Math.round(worst * 100) / 100 };
  }
  function hsvToHex(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); }; return '#' + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function hexToHsv(hex) { const h6 = hex6(hex) || '#FFFFFF'; const [r, g, b] = [1, 3, 5].map(i => parseInt(h6.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return [h, mx ? d / mx : 0, mx]; }

  /* ------------------------------------------------------------ a section that folds */
  const FOLD_KEY = 'ax_studio_stysec';
  function Section({ id, title, hint, children }) {
    const [open, setOpen] = useState(() => (store.get(FOLD_KEY, {}) || {})[id] !== false);
    const flip = () => { const n = !open; setOpen(n); const all = store.get(FOLD_KEY, {}) || {}; all[id] = n; store.set(FOLD_KEY, all); };
    return html`<section class=${'st-sty-sec' + (open ? ' open' : '')} aria-label=${title}>
      <div class="st-sty-sech"><button class="st-sty-fold" aria-expanded=${open ? 'true' : 'false'} onClick=${flip}><span>${title}</span>${hint && !open ? html`<span class="st-sty-hint">${hint}</span>` : null}<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>
      ${open ? html`<div class="st-sty-body">${children}</div>` : null}
    </section>`;
  }

  /* ------------------------------------------------------------ the heading and the selected layer as a chip */
  const layerName = l => l.name || (l.role && l.role !== 'free' ? l.role.charAt(0).toUpperCase() + l.role.slice(1) : '') || (l.type === 'text' ? 'Text' : l.shape ? l.shape.charAt(0).toUpperCase() + l.shape.slice(1) : l.type === 'img' ? 'Image' : 'Layer');
  const kindWord = l => l.type === 'text' ? 'Text' : l.type === 'img' ? (l.role === 'logo' || l.role === 'wordmark' ? 'Mark' : 'Image') : l.type === 'shape' ? 'Shape' : l.type || 'Layer';
  function StyleHead({ layers, one, count, format, W, H, onPick }) {
    const list = (layers || []).slice().reverse();
    return html`<div class="st-sty-head">
      <div class="st-sty-title">Style</div>
      <label class="st-sty-chip"><span class="st-vh">Selected layer</span><select aria-label="Selected layer" value=${one ? one.id : ''} onChange=${e => onPick(e.target.value || null)}>
        <option value="">${count > 1 ? count + ' layers selected' : 'Nothing selected'}</option>
        ${list.map(l => html`<option key=${l.id} value=${l.id}>${layerName(l)}${l.hidden ? ' (hidden)' : ''}${l.locked ? ' (locked)' : ''}</option>`)}
      </select><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></label>
      <div class="st-sty-sub">${one ? kindWord(one) + (one.locked ? ', locked' : '') : count > 1 ? count + ' layers' : 'Select a layer on the canvas'}<span aria-hidden="true"> · </span>${format || ''} ${W} x ${H} px</div>
    </div>`;
  }

  /* ------------------------------------------------------------ Spacing: the distance to each edge, in output pixels */
  function Spacing({ l, W, H, disabled, why, onPatch }) {
    const px = (pc, d) => Math.round(pc / 100 * d);
    const T = px(l.y || 0, H), L = px(l.x || 0, W), Wd = px(l.w || 0, W), Hd = px(l.h || 0, H);
    const Rt = W - L - Wd, B = H - T - Hd;
    const set = (edge, raw) => { const n = +raw; if (!isFinite(n)) return; const pcW = n / W * 100, pcH = n / H * 100;
      if (edge === 't') onPatch({ y: r1(pcH) }, 'Move ' + layerName(l) + ' to ' + Math.round(n) + ' px from the top');
      else if (edge === 'l') onPatch({ x: r1(pcW) }, 'Move ' + layerName(l) + ' to ' + Math.round(n) + ' px from the left');
      else if (edge === 'r') onPatch({ x: r1(100 - (l.w || 0) - pcW) }, 'Move ' + layerName(l) + ' to ' + Math.round(n) + ' px from the right');
      else if (edge === 'b') onPatch({ y: r1(100 - (l.h || 0) - pcH) }, 'Move ' + layerName(l) + ' to ' + Math.round(n) + ' px from the bottom'); };
    // one move per edit: the field commits on Enter or when it is left, and is redrawn when the layer moves on the canvas
    const inp = (edge, val, label) => html`<input key=${edge + ':' + val} class=${'st-sty-e ' + edge} type="number" step="1" defaultValue=${val} disabled=${disabled} aria-label=${label} title=${disabled ? why : label + ': type a distance and press Enter to move the layer there'} onBlur=${e => { if (+e.target.value !== val) set(edge, e.target.value); }} onKeyDown=${e => { e.stopPropagation(); if (e.key === 'Enter' && +e.target.value !== val) set(edge, e.target.value); if (e.key === 'Escape') { e.target.value = val; e.target.blur(); } }} />`;
    return html`<div class="st-sty-box" role="group" aria-label="Distance to the edges of the artwork, output pixels">
      <span class="st-sty-boxlab">To the edges (px)</span>
      ${inp('t', T, 'Distance to the top edge, px')}${inp('r', Rt, 'Distance to the right edge, px')}${inp('b', B, 'Distance to the bottom edge, px')}${inp('l', L, 'Distance to the left edge, px')}
      <div class="st-sty-core" aria-hidden="true"><span>${Wd} x ${Hd}</span></div>
    </div>${disabled && why ? html`<div class="ov-dim st-sty-note">${why}</div>` : null}`;
  }

  /* ------------------------------------------------------------ colour: the field, its contrast, and the picker */
  function ColourField({ value, label, palette, ground, onPick }) {
    const [open, setOpen] = useState(false); const btn = useRef(null);
    const hx = hex6(value) || '#FFFFFF'; const c = contrastOn(hx, ground);
    return html`<div class="st-sty-colourf">
      <button ref=${btn} class="st-sty-colour" aria-haspopup="dialog" aria-expanded=${open ? 'true' : 'false'} aria-label=${label + ' ' + hx + ': open the colour picker'} onClick=${() => setOpen(!open)}><i style=${{ background: value || hx }}></i><span>${hx}</span></button>
      ${c ? html`<div class="st-sty-contrast" title="Measured from the pixels behind these words on the canvas: the mean ground, and the worst patch (its darkest or brightest tenth)"><span>Contrast with the ground behind it</span><span><b class=${'g-' + grade(c.mean)[1]}>${grade(c.mean)[0]}</b> ${c.mean.toFixed(2)}${c.worst != null && c.worst < c.mean - 0.2 ? html`<span class="ov-dim"> · worst patch ${c.worst.toFixed(2)}</span>` : null}</span></div>` : html`<div class="st-sty-contrast ov-dim"><span>Contrast is measured once the artwork has drawn</span></div>`}
      ${open ? ReactDOM.createPortal(html`<${Picker} value=${hx} label=${label} palette=${palette} ground=${ground} anchor=${btn} onPick=${onPick} onClose=${() => { setOpen(false); try { btn.current && btn.current.focus(); } catch (e) {} }} />`, (btn.current && btn.current.closest('#studio-root .st')) || document.getElementById('studio-root') || document.body) : null}
    </div>`;
  }
  function Picker({ value, label, palette, ground, anchor, onPick, onClose }) {
    const [hsv, setHsv] = useState(() => hexToHsv(value)); const [hexIn, setHexIn] = useState(value);
    const ref = useRef(null); const [pos, setPos] = useState({ left: 12, top: 12 });
    const cur = hsvToHex(hsv[0], hsv[1], hsv[2]);
    useEffect(() => { setHexIn(cur); }, [cur]);
    useLayoutEffect(() => { const a = anchor && anchor.current; const el = ref.current; if (!a || !el) return; const r = a.getBoundingClientRect(); const w = el.offsetWidth || 320, h = el.offsetHeight || 460;
      // beside the panel that holds the field (never over it), else beside the field, else wherever it fits
      const side = a.closest('.st-inspector, .st-library'); const edge = side ? side.getBoundingClientRect().left : r.left;
      let left = edge - w - 10; if (left < 8) left = Math.min(window.innerWidth - w - 8, r.right + 12); if (left < 8) left = 8;
      const top = Math.max(8, Math.min(window.innerHeight - h - 8, r.top - h / 2)); setPos({ left, top }); try { el.focus(); } catch (e) {} }, []);
    useEffect(() => { const out = e => { const path = e.composedPath ? e.composedPath() : [e.target]; if (path.indexOf(ref.current) >= 0 || (anchor && path.indexOf(anchor.current) >= 0)) return; onClose(); };
      document.addEventListener('pointerdown', out, true); return () => document.removeEventListener('pointerdown', out, true); }, []);
    const commit = h => { const x = (h || cur).toUpperCase(); if (!isHex(x)) return; try { const CV = window.STCanvas; if (CV && CV.pushColour) CV.pushColour(x); } catch (e) {} onPick(x); };
    // dragging previews in the picker and commits once, on release: one undo step per choice, not one per pixel
    const track = (fn) => e => { const el = e.currentTarget; try { el.setPointerCapture(e.pointerId); } catch (x) {} let last = hsv;
      const go = ev => { const r = el.getBoundingClientRect(); last = fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height)), last); setHsv(last); };
      go(e); const mv = ev => { if (ev.buttons) go(ev); }; const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); commit(hsvToHex(last[0], last[1], last[2])); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); };
    const key = (fn) => e => { const st = e.shiftKey ? 0.1 : 0.02; let n = null; if (e.key === 'ArrowLeft') n = fn(-st, 0); else if (e.key === 'ArrowRight') n = fn(st, 0); else if (e.key === 'ArrowUp') n = fn(0, -st); else if (e.key === 'ArrowDown') n = fn(0, st); if (n) { e.preventDefault(); e.stopPropagation(); setHsv(n); commit(hsvToHex(n[0], n[1], n[2])); } };
    const c = contrastOn(cur, ground);
    const pal = palette || {}; const saved = [];
    [['Primary', pal.primary], ['Secondary', pal.secondary], ['Accent', pal.accent], ['Text', pal.text], ['Background', pal.bg]].forEach(([n, x]) => { if (isHex(x) && !saved.some(s => s[1].toLowerCase() === x.toLowerCase())) saved.push([n, x.toUpperCase()]); });
    const recent = ((window.STCanvas && window.STCanvas.recentColours) ? window.STCanvas.recentColours() : []).filter(x => isHex(x) && !saved.some(s => s[1].toLowerCase() === x.toLowerCase())).slice(0, 8);
    const eyedrop = async () => { const CV = window.STCanvas; if (!CV || !CV.eyedrop) return; const x = await CV.eyedrop(); if (x && isHex(x)) { setHsv(hexToHsv(x)); commit(x); } };
    const num = (i, max, label, scale) => html`<input class="st-pk-n" type="number" min="0" max=${max} value=${Math.round(hsv[i] * scale)} aria-label=${label} onChange=${e => { const n = +e.target.value; if (!isFinite(n)) return; const nx = hsv.slice(); nx[i] = Math.max(0, Math.min(max, n)) / scale; setHsv(nx); commit(hsvToHex(nx[0], nx[1], nx[2])); }} onKeyDown=${e => e.stopPropagation()} />`;
    return html`<div class="st-pk" role="dialog" aria-label=${label + ' colour picker'} ref=${ref} tabIndex="-1" style=${{ left: pos.left + 'px', top: pos.top + 'px' }} onKeyDown=${e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } }}>
      <div class="st-pk-sb" role="slider" tabIndex="0" aria-label="Saturation and brightness" aria-valuetext=${'saturation ' + Math.round(hsv[1] * 100) + '%, brightness ' + Math.round(hsv[2] * 100) + '%'} style=${{ background: 'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,' + hsvToHex(hsv[0], 1, 1) + ')' }}
        onPointerDown=${track((x, y, l) => [l[0], x, 1 - y])} onKeyDown=${key((dx, dy) => [hsv[0], Math.max(0, Math.min(1, hsv[1] + dx)), Math.max(0, Math.min(1, hsv[2] - dy))])}><span class="st-pk-knob" style=${{ left: hsv[1] * 100 + '%', top: (1 - hsv[2]) * 100 + '%', background: cur }}></span></div>
      <div class="st-pk-row">
        <button class="st-pk-drop" onClick=${eyedrop} aria-label="Pick a colour from the screen" title="Pick a colour from the screen (or the next click on the artwork)"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14.5 4.5l5 5M6 18l9-9 3 3-9 9H6v-3zM16 3l5 5-2 2-5-5 2-2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg></button>
        <div class="st-pk-hue" role="slider" tabIndex="0" aria-label="Hue" aria-valuemin="0" aria-valuemax="360" aria-valuenow=${Math.round(hsv[0])} onPointerDown=${track((x, y, l) => [x * 360, l[1], l[2]])} onKeyDown=${key(dx => [Math.max(0, Math.min(360, hsv[0] + dx * 360)), hsv[1], hsv[2]])}><span class="st-pk-knob" style=${{ left: hsv[0] / 360 * 100 + '%', background: hsvToHex(hsv[0], 1, 1) }}></span></div>
        <span class="st-pk-cur" style=${{ background: cur }} aria-hidden="true"></span>
      </div>
      <div class="st-pk-nums"><span class="st-pk-model">HSB</span>${num(0, 360, 'Hue, degrees', 1)}${num(1, 100, 'Saturation, per cent', 100)}${num(2, 100, 'Brightness, per cent', 100)}
        <input class="st-pk-hex" value=${hexIn} aria-label=${label + ', hex'} onInput=${e => setHexIn(e.target.value)} onKeyDown=${e => { e.stopPropagation(); if (e.key === 'Enter') { const x = hex6(e.target.value); if (x) { setHsv(hexToHsv(x)); commit(x); } } }} onBlur=${e => { const x = hex6(e.target.value); if (x && x !== cur) { setHsv(hexToHsv(x)); commit(x); } }} /></div>
      ${c ? html`<div class="st-pk-rat"><span>Contrast ratio</span><span><b class=${'g-' + grade(c.mean)[1]}>${grade(c.mean)[0]}</b><b>${c.mean.toFixed(2)}</b></span></div><div class="ov-dim st-pk-ratnote">against the ground measured behind the words${c.worst != null ? '; the worst patch ' + c.worst.toFixed(2) : ''}</div>` : null}
      ${saved.length ? html`<div class="st-pk-lbl">Saved colours (client)</div><div class="st-pk-sw">${saved.map(([n, x]) => html`<button key=${x} style=${{ background: x }} aria-label=${n + ' ' + x} aria-pressed=${x === cur ? 'true' : 'false'} title=${n + ' ' + x} onClick=${() => { setHsv(hexToHsv(x)); commit(x); }}></button>`)}</div>` : html`<div class="ov-dim st-pk-lbl">No saved colours in the client's kit yet</div>`}
      ${recent.length ? html`<div class="st-pk-lbl">Recent</div><div class="st-pk-sw">${recent.map(x => html`<button key=${x} style=${{ background: x }} aria-label=${'Recent ' + x} aria-pressed=${x.toUpperCase() === cur ? 'true' : 'false'} onClick=${() => { setHsv(hexToHsv(x)); commit(x); }}></button>`)}</div>` : null}
    </div>`;
  }

  /* ------------------------------------------------------------ the ground behind a text layer, as the renderer measured it */
  function groundOf(val, id) { const b = val && (val.boxes || []).find(x => String(x.id) === String(id) && typeof x.groundLum === 'number'); return b ? { lum: b.groundLum, range: b.groundRange || null } : null; }

  window.STStyle = { Section, StyleHead, Spacing, ColourField, Picker, groundOf, contrastOn, grade, hsvToHex, hexToHsv, hex6, layerName };
})();
