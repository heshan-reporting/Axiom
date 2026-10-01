/* AXIOM Creative Studio - the one renderer, and the measurement it draws with.
 *
 * A composition is a layout document (layers in per cent of the stage, the Ad
 * Lab model) plus the version's copy and its bitmaps: the rendered imagery,
 * image regions and the exact marks. This file draws that document onto a
 * canvas. The preview on screen, the image the art director inspects and the
 * export PNG are the same function at different sizes.
 *
 * Text is laid out once, by layoutText(), with the resolved font, weight,
 * size, tracking, padding, emphasis and line spacing; draw() paints what
 * layoutText() measured and validate() judges what layoutText() measured, so
 * there is no second, approximate measure that can disagree with the pixels.
 * layoutRules() turns measured boxes into structured issues by layer id; the
 * worker carries a byte-identical copy (between the RULES markers) and
 * re-derives the verdict from the boxes a browser reports, so a client cannot
 * simply claim "passed". repair() makes the smallest geometric correction it
 * can - grow a box, restack a column, widen, move a mark, a bounded type step -
 * and never edits, clips or truncates words. Nothing here calls a model. */
(function () {
  'use strict';
  const RENDERER = 'studio-render/2';
  const FAMILIES = { display: '"Bricolage Grotesque", sans-serif', body: '"Instrument Sans", sans-serif', mono: '"Spline Sans Mono", monospace' };
  const APP_FAMILY = { display: 'Bricolage Grotesque', body: 'Instrument Sans', mono: 'Spline Sans Mono' };
  const GENERIC = { display: 'sans-serif', body: 'sans-serif', mono: 'monospace' };
  const roleKind = l => (l.font === 'body' ? 'body' : l.font === 'mono' ? 'mono' : 'display');
  function kitFamily(layout, l) { const kit = (layout && layout.fonts) || {}; const k = roleKind(l); return k === 'body' ? kit.body : k === 'mono' ? '' : kit.display; }
  function fontFor(layout, l) { const want = kitFamily(layout, l); return (want ? '"' + String(want).replace(/"/g, '') + '", ' : '') + (FAMILIES[roleKind(l)] || FAMILIES.display); }
  /** The words a text layer shows: its role's copy, or its own text; nothing when hidden or when the words are baked into a full artwork. */
  function displayedText(layout, l, copy) {
    if (!l || l.type !== 'text' || l.hidden) return '';
    const baked = Array.isArray(layout && layout.baked) ? layout.baked : [];
    if (l.role && baked.indexOf(l.role) >= 0) return '';
    // a part of approved words split across layers shows its own words (the worker holds the parts to the copy)
    const t = l.part != null && l.text ? l.text : l.role && l.role !== 'free' && copy && copy[l.role] != null ? copy[l.role] : l.text;
    return String(t == null ? '' : t);
  }
  /* break one over-long word: after / . - ? & = first, otherwise between characters */
  function breakWord(ctx, word, maxW) {
    const out = []; let rest = word;
    while (rest && ctx.measureText(rest).width > maxW) {
      let cut = 0;
      for (let i = 1; i <= rest.length; i++) { if (ctx.measureText(rest.slice(0, i)).width > maxW) break; cut = i; }
      cut = Math.max(1, cut);
      const soft = rest.slice(0, cut).search(/[\/.\-?&=_][^\/.\-?&=_]*$/);
      const at = soft > 0 && soft + 1 < cut ? soft + 1 : cut;
      out.push(rest.slice(0, at)); rest = rest.slice(at);
    }
    if (rest) out.push(rest);
    return out;
  }
  /** Greedy word wrap with the context's own measurements; explicit line breaks are kept, an unbreakable word is broken and reported. */
  function wrapText(ctx, text, maxW) {
    const lines = []; let broken = false;
    String(text || '').replace(/\r/g, '').split('\n').forEach(par => {
      const words = par.split(/[ \t]+/).filter(Boolean); let cur = '';
      if (!words.length) { lines.push(''); return; }
      words.forEach(w0 => {
        const parts = ctx.measureText(w0).width > maxW ? (broken = true, breakWord(ctx, w0, maxW)) : [w0];
        parts.forEach((w, pi) => { const t = cur ? cur + (pi ? '' : ' ') + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; });
      });
      lines.push(cur);
    });
    while (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
    return { lines, broken };
  }
  function wrap(ctx, text, maxW) { return wrapText(ctx, text, maxW).lines; }
  /** Lay out one text layer at W x H: the lines, the box, and the space it really occupies (padding, emphasis and rotation included). */
  function layoutText(ctx, layout, l, copy, W, H) {
    let text = displayedText(layout, l, copy); if (!text) return null;
    if (l.emphasis === 'caps') text = text.toUpperCase();
    const x = l.x / 100 * W, y = l.y / 100 * H, w = l.w / 100 * W, h = (l.h || 0) / 100 * H;
    const px = l.size / 100 * W; const font = (l.weight || 600) + ' ' + px + 'px ' + fontFor(layout, l);
    ctx.font = font; if ('letterSpacing' in ctx) ctx.letterSpacing = l.letterSpacing ? (l.letterSpacing * px) + 'px' : '0px';
    const padX = l.bg ? px * 0.8 : 0, padY = l.bg ? px * 0.45 : 0;
    const avail = Math.max(10, w - padX * 2);
    const wr = wrapText(ctx, text, avail); const lines = wr.lines; const lh = px * (l.lineHeight || 1.12);
    const widths = lines.map(s => ctx.measureText(s).width); const maxLineW = widths.length ? Math.max.apply(null, widths) : 0;
    const contentH = lines.length * lh + padY * 2;
    const align = l.align || 'left';
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - padX : x + padX;
    const bw = l.bg ? (align === 'center' || lines.length > 1 ? w : Math.min(w, maxLineW + padX * 2)) : 0;
    const bx = l.bg ? (align === 'center' ? x + (w - bw) / 2 : align === 'right' ? x + w - bw : x) : 0;
    let minX = Infinity, maxX = -Infinity, bottom = y + contentH;
    widths.forEach(lw => { const lx = align === 'center' ? tx - lw / 2 : align === 'right' ? tx - lw : tx; minX = Math.min(minX, lx); maxX = Math.max(maxX, lx + lw); });
    if (l.bg) { minX = Math.min(minX, bx); maxX = Math.max(maxX, bx + bw); }
    if (l.emphasis === 'highlight') { minX -= px * 0.15; maxX += px * 0.15; }
    if (l.emphasis === 'underline' && lines.length) bottom = Math.max(bottom, y + padY + (lines.length - 1) * lh + px * 1.02 + Math.max(1.5, px * 0.08));
    let top = y - (l.emphasis === 'highlight' ? px * 0.05 : 0);
    if (l.emphasis === 'box') { const sw = Math.max(1.5, px * 0.08) / 2; minX = Math.min(minX, x - sw); maxX = Math.max(maxX, x + w + sw); top = Math.min(top, y - sw); bottom = Math.max(bottom, y + contentH + sw); }
    if (!isFinite(minX)) { minX = x; maxX = x; }
    let occ = { x: minX, y: top, w: maxX - minX, h: bottom - top };
    if (l.rotate) {
      // the axis-aligned bounds of the occupied box turned about the layer's centre, as draw() turns it
      const cx = x + w / 2, cy = y + h / 2, a = l.rotate * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
      const pts = [[occ.x, occ.y], [occ.x + occ.w, occ.y], [occ.x, occ.y + occ.h], [occ.x + occ.w, occ.y + occ.h]].map(([px0, py0]) => [cx + (px0 - cx) * cs - (py0 - cy) * sn, cy + (px0 - cx) * sn + (py0 - cy) * cs]);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); occ = { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) };
    }
    return { text, lines, widths, px, lh, padX, padY, contentH, font, tx, bx, bw, align, occupied: occ, overflowH: !!(h && contentH > h + 0.5), overflowW: maxLineW > avail + 0.5, broken: wr.broken };
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.closePath(); }
  /** Cover the box with the image. focus {x, y} (per cent of the image) is the point kept in view as the crop moves toward it,
   *  zoom (1-3) enlarges the image inside the box; the centre at 1 is the plain cover crop. */
  function cover(ctx, img, W, H, box, focus) {
    const bx = box ? box.x : 0, by = box ? box.y : 0, bw = box ? box.w : W, bh = box ? box.h : H;
    const f = focus || {}; const zoom = Math.max(1, Math.min(3, +f.zoom || 1)); const fx = f.x == null ? 50 : Math.max(0, Math.min(100, +f.x)), fy = f.y == null ? 50 : Math.max(0, Math.min(100, +f.y));
    const s = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * zoom; const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.save(); ctx.beginPath(); ctx.rect(bx, by, bw, bh); ctx.clip();
    ctx.drawImage(img, bx - (w - bw) * fx / 100, by - (h - bh) * fy / 100, w, h); ctx.restore();
  }
  function contain(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight); const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  const isMark = l => l && l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark');
  const markImage = (images, l) => images[l.id] || (l.role === 'logo' ? images.logo : null);
  /** Draw layout + copy at W x H. images: {bg, logo, <layer id>} as loaded Image elements or null.
   *  opts.only 'ground' draws everything except the words and the marks (what they sit on, for contrast). */
  function draw(ctx, W, H, layout, copy, images, opts) {
    layout = layout || {}; copy = copy || {}; images = images || {}; opts = opts || {};
    const ground = opts.only === 'ground';
    const layers = Array.isArray(layout.layers) ? layout.layers : [];
    const pal = layout.palette || {};
    ctx.save(); ctx.clearRect(0, 0, W, H);
    const ib = layout.image && layout.image.w > 0 && layout.image.h > 0 ? { x: layout.image.x / 100 * W, y: layout.image.y / 100 * H, w: layout.image.w / 100 * W, h: layout.image.h / 100 * H } : null;
    const bgFill = layout.bg && typeof layout.bg === 'object' ? (() => { const d = layout.bg.dir || 'down'; const g = d === 'right' ? ctx.createLinearGradient(0, 0, W, 0) : d === 'left' ? ctx.createLinearGradient(W, 0, 0, 0) : d === 'up' ? ctx.createLinearGradient(0, H, 0, 0) : ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, layout.bg.from || '#0f171d'); g.addColorStop(1, layout.bg.to || layout.bg.from || '#0f171d'); return g; })() : layout.bg || null;
    const planNoBg = layout.v === 5 && !(layout.regions || []).some(r => r.role === 'background');
    if (ib || bgFill || planNoBg) { ctx.fillStyle = bgFill || pal.primary || '#0f171d'; ctx.fillRect(0, 0, W, H); }
    if (images.bg) cover(ctx, images.bg, W, H, ib, layout.imageFocus);
    else if (!planNoBg) { const g = ib ? ctx.createLinearGradient(0, ib.y, 0, ib.y + ib.h) : ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a33'); g.addColorStop(1, pal.primary && layout.template !== 'plain' ? pal.primary : '#0f171d'); ctx.fillStyle = g; if (ib) ctx.fillRect(ib.x, ib.y, ib.w, ib.h); else ctx.fillRect(0, 0, W, H); }
    const overflow = [];
    const sketch = s => { ctx.setLineDash([W * 0.01, W * 0.008]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, W * 0.003); ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '500 ' + Math.max(10, W * 0.018) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(s.label, s.x + s.w / 2, s.y + s.h / 2); };
    layers.forEach(l => {
      if (l.hidden) return;
      if (ground && (l.type === 'text' || isMark(l))) return;
      const x = l.x / 100 * W, y = l.y / 100 * H, w = l.w / 100 * W, h = (l.h || 0) / 100 * H;
      ctx.save(); ctx.globalAlpha = l.opacity == null ? 1 : l.opacity;
      if (l.rotate) { ctx.translate(x + w / 2, y + h / 2); ctx.rotate(l.rotate * Math.PI / 180); ctx.translate(-(x + w / 2), -(y + h / 2)); }
      if (l.type === 'shape') {
        if (l.gradient) {
          const d = l.dir || 'up'; const g = d === 'down' ? ctx.createLinearGradient(0, y + h, 0, y) : d === 'left' ? ctx.createLinearGradient(x + w, 0, x, 0) : d === 'right' ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.45, l.fill || 'rgba(0,0,0,.7)'); g.addColorStop(1, l.fill || 'rgba(0,0,0,.7)'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
        }
        else if (l.shape === 'circle') { ctx.fillStyle = l.fill || 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
        else if (l.shape === 'rule') { ctx.fillStyle = l.fill || '#fff'; ctx.fillRect(x, y, w, Math.max(1, h || W * 0.004)); }
        else { ctx.fillStyle = l.fill || 'rgba(0,0,0,.5)'; roundRect(ctx, x, y, w, h, l.radius === 0 ? 0 : l.radius ? l.radius / 100 * W : l.shape === 'pill' ? Math.min(w, h) / 2 : Math.max(2, W * 0.004)); ctx.fill(); }
      }
      else if (l.type === 'img') {
        const img = isMark(l) ? markImage(images, l) : images[l.id];
        if (img) { if (l.fit === 'cover') cover(ctx, img, W, H, { x, y, w, h }, l.focus); else contain(ctx, img, x, y, w, h); }
        else if (isMark(l)) { ctx.fillStyle = 'rgba(255,255,255,.9)'; roundRect(ctx, x, y, w, h, 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.font = '600 ' + Math.max(10, h * 0.32) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(l.role === 'wordmark' ? 'WORDMARK MISSING' : 'LOGO MISSING', x + w / 2, y + h / 2); }
        else sketch({ x, y, w, h, label: (l.name || l.id || 'image') + ' - sketch' });
      } else if (l.type === 'text') {
        const t = layoutText(ctx, layout, l, copy, W, H);
        if (!t) { ctx.restore(); return; }
        ctx.textBaseline = 'top'; ctx.textAlign = t.align;
        if (t.overflowH) overflow.push(l.role || l.id);
        if (l.bg) { ctx.fillStyle = l.bg; roundRect(ctx, t.bx, y, t.bw, t.contentH, t.px * 0.35); ctx.fill(); }
        if (l.emphasis === 'highlight' || l.emphasis === 'underline') { ctx.fillStyle = l.emphasisColor || (l.emphasis === 'highlight' ? 'rgba(255,214,0,.85)' : l.color || '#fff'); t.lines.forEach((s, i) => { const lw = t.widths[i]; const lx = t.align === 'center' ? t.tx - lw / 2 : t.align === 'right' ? t.tx - lw : t.tx; if (l.emphasis === 'highlight') ctx.fillRect(lx - t.px * 0.15, y + t.padY + i * t.lh - t.px * 0.05, lw + t.px * 0.3, t.lh); else ctx.fillRect(lx, y + t.padY + i * t.lh + t.px * 1.02, lw, Math.max(1.5, t.px * 0.08)); }); }
        if (l.emphasis === 'box') { ctx.strokeStyle = l.emphasisColor || l.color || '#fff'; ctx.lineWidth = Math.max(1.5, t.px * 0.08); ctx.strokeRect(x, y, w, t.contentH); }
        ctx.fillStyle = l.emphasis === 'highlight' ? (l.emphasisColor ? l.color || '#fff' : '#111') : (l.color || '#fff');
        t.lines.forEach((s, i) => ctx.fillText(s, t.tx, y + t.padY + i * t.lh));
      }
      ctx.restore();
    });
    if (!ground && layout.frame && layout.frame.of > 1) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 ' + Math.max(10, W * 0.02) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillText(layout.frame.index + 1 + ' / ' + layout.frame.of, W - W * 0.025, H * 0.015); ctx.restore(); }
    ctx.restore();
    return { overflow };
  }
  function stageSize(layout, width) {
    const st = (layout && layout.stage) || { w: 1080, h: 1080 }; const w = width || st.w;
    return { w, h: Math.round(w * st.h / st.w) };
  }
  function render(layout, copy, images, width, canvas) {
    const { w, h } = stageSize(layout, width);
    canvas = canvas || document.createElement('canvas');
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const r = draw(canvas.getContext('2d'), w, h, layout, copy, images);
    return { canvas, w, h, overflow: r.overflow };
  }
  function toBlob(layout, copy, images) {
    const { canvas } = render(layout, copy, images, null);
    return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  }
  function loadImage(url) {
    return new Promise((res, rej) => { if (!url) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image failed: ' + String(url).slice(0, 80))); im.src = url; });
  }

  /* ---------------------------------------------------------------- fonts: load, wait, and say what was actually used */
  let probeCtx = null;
  function pctx() { if (!probeCtx) probeCtx = document.createElement('canvas').getContext('2d'); return probeCtx; }
  /** Is a family really rendering, not a fallback? Measured against three generic families, as a browser would substitute. */
  function familyAvailable(name, weight) {
    if (!name) return false; const c = pctx(); const s = 'mmmmmmmmmmlli1WQ@#&%BRgy'; const wt = (weight || 400) + ' ';
    // measured at the weight the words use: a family whose bold face has loaded but whose regular has not is available for the bold words only
    return ['monospace', 'serif', 'sans-serif'].some(base => { c.font = wt + '72px ' + base; const w0 = c.measureText(s).width; c.font = wt + '72px "' + String(name).replace(/"/g, '') + '", ' + base; return Math.abs(c.measureText(s).width - w0) > 0.5; });
  }
  /** Load every face the layout's words need and wait (bounded); report, per role, the family asked for and the family used. */
  async function ensureFonts(layout, copy, opts) {
    opts = opts || {}; const timeout = opts.timeout || 4000;
    const wait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
    const layers = ((layout && layout.layers) || []).filter(l => l.type === 'text' && displayedText(layout, l, copy || {}));
    const faces = new Set(); layers.forEach(l => { [kitFamily(layout, l), APP_FAMILY[roleKind(l)]].filter(Boolean).forEach(f => faces.add((l.weight || 600) + ' 40px "' + f + '"')); });
    if (typeof document !== 'undefined' && document.fonts && document.fonts.load) { await wait(Promise.all(Array.from(faces).map(f => document.fonts.load(f).catch(() => []))), timeout); if (document.fonts.ready) await wait(document.fonts.ready, timeout); }
    const roles = {}; const fallback = [];
    const kinds = {}; layers.forEach(l => { const k = roleKind(l); (kinds[k] = kinds[k] || { l, weights: new Set() }).weights.add(l.weight || 600); });
    Object.keys(kinds).forEach(k => {
      const l = kinds[k].l; const weights = Array.from(kinds[k].weights);
      const asked = kitFamily(layout, l) || APP_FAMILY[k]; const chain = [kitFamily(layout, l), APP_FAMILY[k]].filter(Boolean);
      // the family that draws every weight these words use; one weight missing is a fallback for those words
      const used = chain.find(f => weights.every(w => familyAvailable(f, w))) || GENERIC[k];
      roles[k] = { requested: asked, used, fallback: used !== asked, weights };
      if (used !== asked) fallback.push(k + ': asked "' + asked + '", rendered in ' + (used === GENERIC[k] ? 'the browser\'s generic ' + used : '"' + used + '"'));
    });
    return { roles, fallback, ok: !fallback.length };
  }

  /* ---------------------------------------------------------------- measurement: every layer's assigned and occupied box at the output size */
  function measure(layout, copy, images, W, H) {
    layout = layout || {}; copy = copy || {}; images = images || {};
    const c = (typeof document !== 'undefined' ? document.createElement('canvas') : null); const ctx = c.getContext('2d');
    const seen = {}; const boxes = [];
    (layout.layers || []).forEach((l, i) => {
      const id = String(l.id || ('layer' + i)); const dup = !!seen[id]; seen[id] = true;
      const num = v => typeof v === 'number' && isFinite(v);
      const valid = num(l.x) && num(l.y) && num(l.w) && l.w > 0 && (l.h == null || (num(l.h) && l.h >= 0)) && (l.type !== 'text' || (num(l.size) && l.size > 0));
      const b = { id, role: l.role || '', type: l.type, shape: l.shape || '', hidden: !!l.hidden, locked: !!l.locked, dup, valid, overlaps: Array.isArray(l.overlaps) ? l.overlaps.map(String) : [], rotate: l.rotate || 0, ax: (l.x || 0) / 100 * W, ay: (l.y || 0) / 100 * H, aw: (l.w || 0) / 100 * W, ah: (l.h || 0) / 100 * H };
      b.x = b.ax; b.y = b.ay; b.w = b.aw; b.h = b.ah;
      if (!valid || l.hidden) { boxes.push(b); return; }
      if (l.type === 'text') {
        const t = layoutText(ctx, layout, l, copy, W, H);
        if (!t) { b.empty = true; boxes.push(b); return; }
        Object.assign(b, { x: t.occupied.x, y: t.occupied.y, w: t.occupied.w, h: t.occupied.h, lines: t.lines.length, chars: t.text.length, text: t.text.slice(0, 160), px: t.px, contentH: t.contentH, overflowH: t.overflowH, overflowW: t.overflowW, broken: t.broken, color: l.color || '#fff', bg: l.bg || '', emphasis: l.emphasis || '' });
      } else if (l.type === 'img') {
        const img = isMark(l) ? markImage(images, l) : images[l.id];
        b.mark = isMark(l); b.asset = img ? 'loaded' : (isMark(l) ? 'missing' : 'sketch'); b.src = l.src || '';
      }
      boxes.push(b);
    });
    return boxes;
  }

  /* ---------------------------------------------------------------- the rules: a byte-identical copy lives in the worker */
  /* RULES:BEGIN */
  function layoutRules(boxes, o) {
    o = o || {}; var W = o.W || 1080, H = o.H || 1080; var out = [];
    var add = function (code, severity, layers, detail) { out.push({ code: code, severity: severity, layers: layers, detail: detail }); };
    var tol = Math.max(1, W * 0.0015);
    var safe = o.format === '9:16' && o.channel === 'instagram' ? { top: 0.14, bottom: 0.2, side: 0.06, hard: true } : { top: 0.03, bottom: 0.03, side: 0.03, hard: false };
    var live = [], i, j;
    for (i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.dup) add('duplicate_id', 'blocking', [b.id], 'two layers share the id ' + b.id + '; edits, locks and checks cannot tell them apart');
      if (b.valid === false) { add('invalid_geometry', 'blocking', [b.id], 'the ' + (b.role || b.type) + ' layer has missing or impossible geometry'); continue; }
      if (b.hidden || b.empty) continue;
      if (b.type === 'text' || b.mark) live.push(b);
      if (b.type === 'text') {
        if (b.overflowH) add('text_overflow', 'blocking', [b.id], 'the ' + (b.role || 'text') + ' needs ' + Math.round(b.contentH) + ' px over ' + b.lines + ' lines; its box is ' + Math.round(b.ah) + ' px, so it runs into whatever sits below');
        if (b.overflowW) add('text_too_wide', 'blocking', [b.id], 'a line of the ' + (b.role || 'text') + ' is wider than its box even when broken');
        if (b.broken) add('word_broken', 'warning', [b.id], 'a word or address in the ' + (b.role || 'text') + ' is too long for the box and is broken across lines');
        var pct = b.px / W * 100;
        if (pct < 1.8) add('unreadable_type', 'blocking', [b.id], 'the ' + (b.role || 'text') + ' is ' + pct.toFixed(1) + '% of the width: under 6 px when a feed shows the tile at about 360 px');
        else if (pct < 2.4) add('small_type', 'warning', [b.id], 'the ' + (b.role || 'text') + ' is ' + pct.toFixed(1) + '% of the width, under the 2.4% feed minimum');
        if (typeof b.contrast === 'number') { var large = pct >= 4; if (b.contrast < 1.6) add('unreadable_contrast', 'blocking', [b.id], 'the ' + (b.role || 'text') + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it'); else if (b.contrast < (large ? 3 : 4.5)) add('low_contrast', 'warning', [b.id], 'the ' + (b.role || 'text') + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it (' + (large ? 3 : 4.5) + ':1 wanted)'); }
      }
      if (b.mark) {
        if (b.asset !== 'loaded') add('mark_unloaded', o.production ? 'blocking' : 'warning', [b.id], 'the ' + b.role + ' image did not load; a placeholder is drawn in its place');
        if (typeof b.contrast === 'number') { if (b.contrast < 1.4) add('mark_unreadable', 'blocking', [b.id], 'the ' + b.role + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it'); else if (b.contrast < (b.role === 'wordmark' ? 4.5 : 3)) add('mark_low_contrast', 'warning', [b.id], 'the ' + b.role + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it (' + (b.role === 'wordmark' ? '4.5:1 wanted for a mark made of words' : '3:1 wanted') + '); another approved variant may read better'); }
      }
      if (b.type === 'img' && !b.mark && b.asset !== 'loaded') add('imagery_sketch', o.production ? 'blocking' : 'warning', [b.id], 'image region ' + b.id + ' is still a sketch: its image has not been made or did not load');
      if (b.type === 'text' || b.mark) {
        if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5) add('off_canvas', 'blocking', [b.id], 'the ' + (b.role || b.type) + ' runs off the edge of the stage');
        else if (b.x < W * safe.side - 0.5 || b.x + b.w > W * (1 - safe.side) + 0.5 || b.y < H * safe.top - 0.5 || b.y + b.h > H * (1 - safe.bottom) + 0.5) add('safe_area', safe.hard ? 'blocking' : 'warning', [b.id], 'the ' + (b.role || b.type) + ' sits ' + (safe.hard ? 'under the story interface (top 14%, bottom 20%)' : 'inside the 3% margin'));
      }
    }
    for (i = 0; i < live.length; i++) for (j = i + 1; j < live.length; j++) {
      var a = live[i], c = live[j];
      if (a.overlaps.indexOf(c.id) >= 0 || c.overlaps.indexOf(a.id) >= 0) continue;
      var iw = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), ih = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
      if (iw > tol && ih > tol) {
        var kind = a.type === 'text' && c.type === 'text' ? 'text' : a.mark && c.mark ? 'marks' : 'text_mark';
        add('collision', 'blocking', [a.id, c.id], 'the ' + (a.role || a.type) + ' and the ' + (c.role || c.type) + ' overlap by ' + Math.round(iw) + ' x ' + Math.round(ih) + ' px' + (kind === 'text_mark' ? ' (words over a mark)' : kind === 'marks' ? ' (two marks)' : ''));
      }
    }
    if (o.imageryMissing) add('imagery_missing', o.production ? 'blocking' : 'warning', [], 'the composition expects imagery that is not on file yet');
    if (o.fonts && o.fonts.fallback && o.fonts.fallback.length) add('font_fallback', 'warning', [], 'fonts not available where this was drawn: ' + o.fonts.fallback.join('; '));
    var rank = { blocking: 0, warning: 1, info: 2 };
    out.sort(function (x, y) { return rank[x.severity] - rank[y.severity]; });
    return out;
  }
  /* RULES:END */

  /* ---------------------------------------------------------------- contrast against what is actually behind each word and mark */
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  function colourLum(css) { const c = pctx(); c.fillStyle = '#000'; c.fillStyle = css || '#fff'; const v = c.fillStyle; if (/^#/.test(v)) { const n = parseInt(v.slice(1), 16); return lum((n >> 16) & 255, (n >> 8) & 255, n & 255); } const m = String(v).match(/[\d.]+/g) || [255, 255, 255]; return lum(+m[0], +m[1], +m[2]); }
  function regionLum(data, W, H, r) {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(W, Math.ceil(r.x + r.w)), y1 = Math.min(H, Math.ceil(r.y + r.h));
    const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000))); let n = 0, s = 0;
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const k = (y * W + x) * 4; s += lum(data[k], data[k + 1], data[k + 2]); n++; }
    return n ? s / n : 0;
  }
  function markLum(img) {
    if (!img) return null; const c = document.createElement('canvas'); const w = Math.min(160, img.naturalWidth || 160), h = Math.max(1, Math.round(w * (img.naturalHeight || 1) / (img.naturalWidth || 1))); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); let d; try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    let n = 0, s = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 128) { s += lum(d[k], d[k + 1], d[k + 2]); n++; }
    return n ? s / n : null;
  }
  function contrastOf(layout, copy, images, boxes, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    draw(x, W, H, layout, copy, images, { only: 'ground' }); let data; try { data = x.getImageData(0, 0, W, H).data; } catch (e) { return false; }
    const byId = {}; (layout.layers || []).forEach(l => { byId[String(l.id)] = l; });
    boxes.forEach(b => {
      const l = byId[b.id]; if (!l || b.hidden || b.empty || b.valid === false) return;
      if (b.type === 'text') { const fg = l.emphasis === 'highlight' ? colourLum(l.emphasisColor ? l.color || '#fff' : '#111') : colourLum(l.color || '#fff'); const bgL = l.bg ? colourLum(l.bg) : l.emphasis === 'highlight' ? colourLum(l.emphasisColor || 'rgb(255,214,0)') : regionLum(data, W, H, b); b.contrast = Math.round(ratio(fg, bgL) * 100) / 100; }
      else if (b.mark && b.asset === 'loaded') { const ml = markLum(markImage(images, l)); if (ml != null) b.contrast = Math.round(ratio(ml, regionLum(data, W, H, b)) * 100) / 100; }
    });
    return true;
  }
  /** Does the composition expect imagery that is not there? */
  function imageryMissing(layout, images) {
    if (images && images.bg) return false;
    if (layout.v === 5) return (layout.regions || []).some(r => r.role === 'background');
    return !(layout.style === 'typographic' && !layout.image) && !!(layout.layers || []).length;
  }
  /** The whole technical validation at the output size: measured boxes, contrast, fonts, assets, and the issues by layer. */
  function validate(layout, copy, images, opts) {
    opts = opts || {}; layout = layout || {}; copy = copy || {}; images = images || {};
    const { w: W, h: H } = stageSize(layout, opts.width);
    const boxes = measure(layout, copy, images, W, H);
    const contrasted = opts.contrast === false ? false : contrastOf(layout, copy, images, boxes, W, H);
    const missing = imageryMissing(layout, images);
    const issues = layoutRules(boxes, { W, H, format: opts.format || layout.format, channel: opts.channel, production: opts.production !== false, fonts: opts.fonts, imageryMissing: missing });
    return { renderer: RENDERER, W, H, ok: !issues.some(i => i.severity === 'blocking'), issues, boxes, fonts: opts.fonts || null, contrast: contrasted, imageryMissing: missing, production: opts.production !== false, at: Date.now() };
  }

  /* ---------------------------------------------------------------- repair: the smallest geometric correction, never the words */
  const LAYOUT_CODES = { text_overflow: 1, collision: 1, off_canvas: 1, safe_area: 1, text_too_wide: 1 };
  const MIN_SIZE = { headline: 3.2, support: 2.4, cta: 2.2 };
  function swapMarks(L, copy, images, opts, byId, steps) {
    const v0 = validate(L, copy, images, opts);
    v0.boxes.filter(b => b.mark && typeof b.contrast === 'number' && b.contrast < (b.role === 'wordmark' ? 4.5 : 3)).forEach(b => {
      const l = byId[b.id]; const vars = (opts.variants || {})[b.id] || []; if (!l || l.locked || l.hidden || !vars.length) return;
      let best = null; vars.forEach(vr => { if (!vr.img) return; const imgs = Object.assign({}, images, { [b.id]: vr.img }); const t = validate(Object.assign({}, L, { layers: L.layers.map(x => x === l ? Object.assign({}, l, { src: vr.src }) : x) }), copy, imgs, opts); const tb = t.boxes.find(x => x.id === b.id); if (tb && typeof tb.contrast === 'number' && (!best || tb.contrast > best.c)) best = { vr, c: tb.contrast }; });
      if (best && best.c > b.contrast + 0.3 && best.vr.src !== l.src) { l.src = best.vr.src; l.variant = best.vr.variant; images[b.id] = best.vr.img; steps.push('switched the ' + l.role + ' to its approved ' + best.vr.variant + ' variant (contrast ' + b.contrast.toFixed(2) + ' to ' + best.c.toFixed(2) + ':1)'); }
    });
  }
  /** Only the marks: each approved variant is measured against what is actually behind the mark and the best one is taken.
   *  Nothing else moves; the mark is never redrawn or recoloured, only exchanged for another approved file. */
  function markVariants(layout0, copy, images, opts) {
    opts = opts || {}; const L = JSON.parse(JSON.stringify(layout0 || {})); const byId = {}; (L.layers || []).forEach((l, i) => { byId[String(l.id || ('layer' + i))] = l; });
    const steps = []; const imgs = Object.assign({}, images || {}); if (opts.variants && !(opts.locks && opts.locks.layout)) swapMarks(L, copy || {}, imgs, opts, byId, steps);
    return { layout: L, changed: steps.length > 0, steps, images: imgs };
  }
  function repair(layout0, copy, images, opts) {
    opts = opts || {}; copy = copy || {}; images = images || {};
    const L = JSON.parse(JSON.stringify(layout0 || {})); const { w: W, h: H } = stageSize(L, opts.width);
    const vopts = Object.assign({}, opts, { contrast: false });
    const before = validate(layout0, copy, images, opts);
    const layoutIssues = r => r.issues.filter(i => LAYOUT_CODES[i.code] && i.severity === 'blocking');
    const steps = []; const result = (conflict) => { const after = validate(L, copy, images, opts); return { layout: L, changed: JSON.stringify(L) !== JSON.stringify(layout0), steps, before, after, ok: !layoutIssues(after).length, conflict: conflict || (layoutIssues(after).length ? 'unresolved' : '') }; };
    if (opts.locks && opts.locks.layout) return Object.assign(result('The layout is locked on this asset; unlock it to let the Studio move anything.'), { layout: layout0, changed: false });
    // unreadable words are always fixed; merely low contrast only when the person asked (opts.fixContrast), since a deliberate
    // brand colour (a gold kicker) may sit just under the bar and is not the repair's to change on its own
    const contrastIssues = r => r.issues.filter(i => i.code === 'unreadable_contrast' || (opts.fixContrast && i.code === 'low_contrast'));
    if (!layoutIssues(before).length && !contrastIssues(before).length && !opts.variants) return Object.assign(result(''), { layout: layout0, changed: false });
    const layers = L.layers || []; const byId = {}; layers.forEach((l, i) => { byId[String(l.id || ('layer' + i))] = l; });
    const movable = l => l && !l.locked && !l.hidden;
    const story = (opts.format || L.format) === '9:16' && opts.channel === 'instagram'; const sp = { top: story ? 14 : 3.2, bottom: story ? 20 : 3.2, side: story ? 6 : 3.2 };
    const geo = () => { const bx = measure(L, copy, images, W, H); const m = {}; bx.forEach(b => { m[b.id] = b; }); return m; };
    const pY = v => v / H * 100, pX = v => v / W * 100;
    // 1. a box takes the height its words need
    const grow = () => { const g = geo(); let n = 0; layers.forEach(l => { const b = g[String(l.id)]; if (l.type === 'text' && movable(l) && b && b.contentH && Math.abs(pY(b.contentH) + 0.3 - (l.h || 0)) > 0.35 && (b.overflowH || pY(b.contentH) + 0.3 < (l.h || 0) - 0.35)) { l.h = Math.round((pY(b.contentH) + 0.3) * 10) / 10; n++; } }); return n; };
    // 2. related blocks stack in reading order with an explicit gap (a column: text and the small devices between them)
    const columns = () => {
      const items = layers.filter(l => movable(l) && !l.rotate && ((l.type === 'text' && displayedText(L, l, copy)) || (l.type === 'shape' && (l.role === 'device' || l.shape === 'rule') && (l.h || 0) <= 2.5)));
      const cols = [];
      items.sort((a, b) => a.y - b.y).forEach(it => { const c = cols.find(col => col.some(o => { const ov = Math.min(o.x + o.w, it.x + it.w) - Math.max(o.x, it.x); return ov >= 0.4 * Math.min(o.w, it.w); })); if (c) c.push(it); else cols.push([it]); });
      return cols.filter(c => c.length > 1 || c.some(l => l.type === 'text'));
    };
    const others = col => layers.filter(l => !l.hidden && col.indexOf(l) < 0 && (l.type === 'text' || isMark(l)));
    const restack = () => {
      let moved = 0;
      columns().forEach(col => {
        const g = geo();
        for (let i = 1; i < col.length; i++) {
          const prev = col[i - 1], cur = col[i]; const pb = g[String(prev.id)];
          const prevBottom = prev.type === 'text' && pb && pb.contentH ? prev.y + Math.max(prev.h || 0, pY(pb.contentH)) : prev.y + (prev.h || 0.6);
          const gap = prev.type === 'text' && cur.type === 'text' ? Math.max(1.4, pY((pb && pb.px ? pb.px : 0.02 * W) * 0.45)) : 1.2;
          if (cur.y < prevBottom + gap - 0.05) { const d = prevBottom + gap - cur.y; for (let k = i; k < col.length; k++) col[k].y = Math.round((col[k].y + d) * 10) / 10; moved++; }
        }
        // the column fits the stage (above any mark it would land on): move the whole column up, never past what sits above it
        // how far up the column must go: past the safe bottom edge, and clear of any mark one of its blocks now lands on
        const top = Math.min.apply(null, col.map(l => l.y)); let need = 0;
        col.forEach(l => {
          const bot = l.y + (l.h || 0); need = Math.max(need, bot - (100 - sp.bottom));
          others(col).forEach(o => { if (isMark(o) && Math.min(o.x + o.w, l.x + l.w) - Math.max(o.x, l.x) > 0.3 && bot > o.y + 0.05 && l.y < o.y + (o.h || 0)) need = Math.max(need, bot - (o.y - 1.2)); });
        });
        if (need > 0.05) {
          const xl = Math.min.apply(null, col.map(l => l.x)), xr = Math.max.apply(null, col.map(l => l.x + l.w));
          let ceiling = sp.top; others(col).forEach(o => { if (Math.min(o.x + o.w, xr) - Math.max(o.x, xl) > 0.5 && o.y + (o.h || 0) <= top + 0.01) ceiling = Math.max(ceiling, o.y + (o.h || 0) + 1.2); });
          const d = Math.min(need, Math.max(0, top - ceiling));
          if (d > 0.05) { col.forEach(l => { l.y = Math.round((l.y - d) * 10) / 10; }); moved++; }
        }
      });
      return moved;
    };
    // panels and scrims that held a column hold it again after it moves
    const panelsFor = col => layers.filter(l => l.type === 'shape' && movable(l) && (l.role === 'panel' || l.role === 'overlay') && col.every(t => t.x >= l.x - 0.5 && t.x + t.w <= l.x + l.w + 0.5));
    const before0 = {}; columns().forEach((col, ci) => { const t = Math.min.apply(null, col.map(l => l.y)); const b = Math.max.apply(null, col.map(l => l.y + (l.h || 0))); panelsFor(col).forEach(pn => { if (t >= pn.y - 0.5 && b <= pn.y + (pn.h || 0) + 0.5) before0[pn.id] = { col: ci, padT: t - pn.y, padB: pn.y + pn.h - b }; }); });
    const refitPanels = () => { columns().forEach((col, ci) => { const t = Math.min.apply(null, col.map(l => l.y)); const b = Math.max.apply(null, col.map(l => l.y + (l.h || 0))); panelsFor(col).forEach(pn => { const k = before0[pn.id]; if (!k) return; const ny = Math.max(0, Math.min(pn.y, t - Math.max(0, k.padT))); const nb = Math.min(100, Math.max(pn.y + pn.h, b + Math.max(0, k.padB))); if (Math.abs(ny - pn.y) > 0.05 || Math.abs(nb - (pn.y + pn.h)) > 0.05) { pn.y = Math.round(ny * 10) / 10; pn.h = Math.round((nb - ny) * 10) / 10; } }); }); };
    const settle = () => { let n = 0; for (let k = 0; k < 4; k++) { const a = grow() + restack(); n += a; if (!a) break; } refitPanels(); return n; };
    // 0. a mark outside the safe area comes in from the edge in its own corner (its placement is kept, only inset)
    const markOut = new Set(); layoutIssues(before).filter(i => i.code === 'safe_area' || i.code === 'off_canvas').forEach(i => i.layers.forEach(id => { if (isMark(byId[id]) && movable(byId[id])) markOut.add(id); }));
    markOut.forEach(id => { const mk = byId[id]; const nx = Math.min(Math.max(mk.x, sp.side), 100 - sp.side - mk.w), ny = Math.min(Math.max(mk.y, sp.top), 100 - sp.bottom - mk.h); if (Math.abs(nx - mk.x) > 0.05 || Math.abs(ny - mk.y) > 0.05) { mk.x = Math.round(nx * 10) / 10; mk.y = Math.round(ny * 10) / 10; steps.push('brought the ' + mk.role + ' inside the safe area in the same corner'); } });
    if (settle()) steps.push('fitted each text box to its measured lines and restacked related blocks with explicit spacing');
    let now = validate(L, copy, images, vopts);
    // 3. widen a crowded column into free space on its open side
    if (layoutIssues(now).length) {
      let widened = 0; const bad = new Set(); layoutIssues(now).forEach(i => i.layers.forEach(id => bad.add(id)));
      layers.forEach(l => { if (l.type !== 'text' || !movable(l) || !bad.has(String(l.id)) || (l.align && l.align !== 'left')) return; let right = 100 - sp.side; others([l]).forEach(o => { if (o.x >= l.x + l.w - 0.01 && Math.min(o.y + (o.h || 0), l.y + (l.h || 0)) - Math.max(o.y, l.y) > 0.3) right = Math.min(right, o.x - 1.5); }); const nw = Math.min(right - l.x, l.w * 1.3); if (nw > l.w + 1) { l.w = Math.round(nw * 10) / 10; widened++; } });
      if (widened) { settle(); steps.push('widened ' + widened + ' text block' + (widened === 1 ? '' : 's') + ' into the free space beside ' + (widened === 1 ? 'it' : 'them')); now = validate(L, copy, images, vopts); }
    }
    // 4. move a mark (or the CTA) off the words, only where the campaign has no observed placement rule
    if (layoutIssues(now).some(i => i.code === 'collision' && i.layers.some(id => isMark(byId[id])))) {
      const observed = L.markPlacement && L.markPlacement.basis === 'observed';
      layoutIssues(now).filter(i => i.code === 'collision').forEach(i => {
        const mk = i.layers.map(id => byId[id]).find(isMark); if (!mk || !movable(mk)) return;
        if (observed) { steps.push('left the ' + mk.role + ' where the approved references put it (' + (L.markPlacement.text || 'observed') + ')'); return; }
        const g = geo(); const texts = Object.keys(g).map(k => g[k]).filter(b => b.type === 'text' && !b.hidden && !b.empty);
        const corners = [[100 - sp.side - mk.w, 100 - sp.bottom - mk.h], [sp.side, 100 - sp.bottom - mk.h], [100 - sp.side - mk.w, sp.top], [sp.side, sp.top]];
        const free = corners.find(([cx, cy]) => texts.every(b => { const bx = pX(b.x), by = pY(b.y), bw = pX(b.w), bh = pY(b.h); return Math.min(bx + bw, cx + mk.w) - Math.max(bx, cx) <= 0.3 || Math.min(by + bh, cy + mk.h) - Math.max(by, cy) <= 0.3; }));
        if (free) { mk.x = Math.round(free[0] * 10) / 10; mk.y = Math.round(free[1] * 10) / 10; steps.push('moved the ' + mk.role + ' to a free corner (no observed placement rule for this campaign)'); }
      });
      now = validate(L, copy, images, vopts);
    }
    // 5. a bounded type step that keeps the hierarchy and the readable minimum
    let scale = 1; const minScale = opts.minScale || 0.82;
    while (layoutIssues(now).length && scale * 0.94 >= minScale) {
      const bad = new Set(); layoutIssues(now).forEach(i => i.layers.forEach(id => bad.add(id)));
      const col = columns().find(c => c.some(l => bad.has(String(l.id))));
      if (!col) break;
      const texts = col.filter(l => l.type === 'text');
      if (texts.some(l => l.size * 0.94 < (MIN_SIZE[l.role] || 2.2))) break;
      texts.forEach(l => { l.size = Math.round(l.size * 0.94 * 100) / 100; });
      scale *= 0.94; settle(); now = validate(L, copy, images, vopts);
    }
    if (scale < 1) steps.push('stepped the type in that column down to ' + Math.round(scale * 100) + '% of its size, hierarchy kept, above the readable minimum');
    // a mark that reads badly takes the approved variant that reads best against what is actually behind it
    if (opts.variants) swapMarks(L, copy, images, opts, byId, steps);
    // words that do not read against what is behind them: first the colour (white or near-black, whichever reads), then, only
    // if neither is enough, a backing plate behind the same words - the words, their size and their place are not touched
    contrastIssues(validate(L, copy, images, opts)).forEach(iss => iss.layers.forEach(id => {
      const l = byId[id]; if (!movable(l) || l.type !== 'text') return;
      const read = (patch) => { const t = validate(Object.assign({}, L, { layers: L.layers.map(x => x === l ? Object.assign({}, l, patch) : x) }), copy, images, opts); const tb = t.boxes.find(x => x.id === id); return { c: tb && typeof tb.contrast === 'number' ? tb.contrast : 0, clear: !contrastIssues(t).some(i => i.layers.indexOf(id) >= 0) }; };
      const was = (validate(L, copy, images, opts).boxes.find(x => x.id === id) || {}).contrast || 0;
      const colours = ['#FFFFFF', '#111111'].filter(c => String(l.color || '').toUpperCase() !== c);
      let best = null; colours.forEach(c => { const r = read({ color: c }); if (!best || (r.clear && !best.clear) || (r.clear === best.clear && r.c > best.c)) best = Object.assign({ patch: { color: c } }, r); });
      if (!(best && best.clear)) { const light = !best || best.patch.color === '#FFFFFF'; const patch = { color: light ? '#FFFFFF' : '#111111', bg: light ? 'rgba(10,14,22,0.72)' : 'rgba(255,255,255,0.86)' }; const r = read(patch); if (!best || r.c > best.c) best = Object.assign({ patch }, r); }
      if (best && best.c > was + 0.3) { Object.assign(l, best.patch); steps.push((best.patch.bg ? 'put a backing plate behind' : 'changed the colour of') + ' the ' + (l.role || 'text') + ' ' + id + ' so it reads (contrast ' + was.toFixed(2) + ' to ' + best.c.toFixed(2) + ':1)'); }
    }));
    now = validate(L, copy, images, vopts);
    if (layoutIssues(now).length) {
      const locked = layoutIssues(now).reduce((a, i) => a.concat(i.layers.filter(id => byId[id] && byId[id].locked)), []);
      const g = geo(); const longest = Object.keys(g).map(k => g[k]).filter(b => b.type === 'text' && b.chars).sort((a, b) => b.contentH - a.contentH)[0];
      const left = layoutIssues(now); const textLeft = left.some(i => i.layers.some(id => byId[id] && byId[id].type === 'text' && (i.code === 'text_overflow' || i.code === 'text_too_wide' || i.code === 'collision')));
      const what = left.map(i => i.code.replace(/_/g, ' ') + ' (' + i.layers.join(', ') + ')').join('; ');
      return result(locked.length ? 'Locked layers stop the fix: ' + Array.from(new Set(locked)).join(', ') + '. Unlock them, or decide what may move.'
        : textLeft ? 'Geometry alone cannot fit the words without going under the readable minimum (' + what + ').' + (longest ? ' Shorter copy for the ' + (longest.role || 'text') + ' (about ' + Math.max(10, Math.round(longest.chars * 0.75)) + ' characters instead of ' + longest.chars + ') would fit; the Studio does not cut words on its own.' : '')
        : 'The layout still has ' + what + ' and no move within the rules clears it; decide what may move.');
    }
    return result('');
  }
  /* a store-only zip: enough for images and text, no compression, readable everywhere */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) {
    const enc = new TextEncoder(); const parts = []; const central = []; let offset = 0;
    const le16 = n => [n & 255, (n >>> 8) & 255], le32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    files.forEach(f => {
      const name = enc.encode(f.name); const data = f.data instanceof Uint8Array ? f.data : enc.encode(String(f.data)); const crc = crc32(data);
      const head = new Uint8Array([].concat([0x50, 0x4b, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0)));
      parts.push(head, name, data);
      central.push(new Uint8Array([].concat([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0], le32(crc), le32(data.length), le32(data.length), le16(name.length), le16(0), le16(0), le16(0), le16(0), le32(0), le32(offset))), name);
      offset += head.length + name.length + data.length;
    });
    const cdSize = central.reduce((n, p) => n + p.length, 0);
    const end = new Uint8Array([].concat([0x50, 0x4b, 5, 6, 0, 0, 0, 0], le16(files.length), le16(files.length), le32(cdSize), le32(offset), le16(0)));
    return new Blob([].concat(parts, central, [end]), { type: 'application/zip' });
  }
  /** The report a browser hands the worker: the measured boxes and the attested measurements, not a verdict (the worker derives that). */
  function report(v, val) {
    return { renderer: val.renderer, W: val.W, H: val.H, production: val.production, imageryMissing: val.imageryMissing, fonts: val.fonts, boxes: val.boxes.map(b => { const o = {}; ['id', 'role', 'type', 'hidden', 'empty', 'dup', 'valid', 'overlaps', 'x', 'y', 'w', 'h', 'ax', 'ay', 'aw', 'ah', 'lines', 'chars', 'px', 'contentH', 'overflowH', 'overflowW', 'broken', 'mark', 'asset', 'src', 'contrast', 'rotate'].forEach(k => { if (b[k] !== undefined) o[k] = typeof b[k] === 'number' ? Math.round(b[k] * 100) / 100 : b[k]; }); return o; }), clientIssues: val.issues.map(i => i.code + ':' + i.layers.join(',')) };
  }
  window.STRender = { RENDERER, draw, render, toBlob, loadImage, stageSize, wrap, wrapText, layoutText, displayedText, ensureFonts, familyAvailable, measure, layoutRules, validate, repair, markVariants, report, zip };
})();
