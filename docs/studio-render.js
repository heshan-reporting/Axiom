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
  const RENDERER = 'studio-render/3';
  /* The validation contract: the shape of the evidence a browser files and the rules it is judged by. The worker refuses
   * a report from another contract and folds the number into the composition signature, so a measurement filed under an
   * older contract cannot certify a tile under the new rules - it reads as stale and is measured again.
   *   1  boxes, text contrast, mark contrast as an average over the mark's bounding box
   *   2  mark readability per pixel (visible strokes against the ground below them, padding excluded, cover by later
   *      layers counted), mark constraints (clear space, placement region, minimum size), double styling */
  const CONTRACT = 2;
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
    if (l.emphasis === 'box') { const sw = Math.max(1.5, px * 0.08) / 2; const x0 = l.bg ? bx : x, x1 = l.bg ? bx + bw : x + w; minX = Math.min(minX, x0 - sw); maxX = Math.max(maxX, x1 + sw); top = Math.min(top, y - sw); bottom = Math.max(bottom, y + contentH + sw); }
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
  /* The image-to-canvas transform, in one place and documented, because the preview, the export, the hit-testing, the
   * framing controls and the subject check all have to agree on where a pixel of the photograph lands:
   *   scale   s  = max(boxW / imgW, boxH / imgH) * zoom          (cover: the image always fills the box; zoom 1-3 enlarges it)
   *   drawn   w, h = imgW * s, imgH * s
   *   origin  x0 = boxX - (w - boxW) * fx / 100,  y0 = boxY - (h - boxH) * fy / 100
   * so the image point at (fx%, fy%) of the image sits at (fx%, fy%) of the box: a focus of (50, 50) is the plain centred
   * crop, (0, 0) pins the top-left corner, (100, 100) the bottom-right. Because fx and fy are clamped to 0..100 and zoom
   * to 1 or more, the box is always fully covered: there is no pan that shows an empty edge. The same focus therefore keeps
   * the subject at the same relative place in a 1:1, a 4:5 and a 9:16 crop of the same photograph. */
  function coverTransform(iw, ih, box, focus) {
    const bx = box.x || 0, by = box.y || 0, bw = box.w, bh = box.h;
    const f = focus || {}; const zoom = Math.max(1, Math.min(3, +f.zoom || 1)); const fx = f.x == null ? 50 : Math.max(0, Math.min(100, +f.x)), fy = f.y == null ? 50 : Math.max(0, Math.min(100, +f.y));
    const s = Math.max(bw / (iw || 1), bh / (ih || 1)) * zoom; const w = (iw || 1) * s, h = (ih || 1) * s;
    return { s, w, h, x: bx - (w - bw) * fx / 100, y: by - (h - bh) * fy / 100, box: { x: bx, y: by, w: bw, h: bh }, focus: { x: fx, y: fy, zoom } };
  }
  /** A point of the image (per cent) to the canvas, and back, under the transform. */
  function imageToCanvas(t, px, py) { return { x: t.x + px / 100 * t.w, y: t.y + py / 100 * t.h }; }
  function canvasToImage(t, cx, cy) { return { x: (cx - t.x) / t.w * 100, y: (cy - t.y) / t.h * 100 }; }
  /** The focus after the image is dragged by (dx, dy) canvas pixels inside its box: the origin moves with the drag, the
   *  focus follows from the origin, clamped so the box stays covered. A drag along an axis with no overflow changes nothing. */
  function panFocus(iw, ih, box, focus, dx, dy) {
    const t = coverTransform(iw, ih, box, focus); const ox = t.w - t.box.w, oy = t.h - t.box.h;
    const fx = ox > 0.5 ? Math.max(0, Math.min(100, t.focus.x - dx * 100 / ox)) : t.focus.x; const fy = oy > 0.5 ? Math.max(0, Math.min(100, t.focus.y - dy * 100 / oy)) : t.focus.y;
    return { x: Math.round(fx * 10) / 10, y: Math.round(fy * 10) / 10, zoom: t.focus.zoom };
  }
  function cover(ctx, img, W, H, box, focus) {
    const t = coverTransform(img.naturalWidth, img.naturalHeight, box ? box : { x: 0, y: 0, w: W, h: H }, focus);
    ctx.save(); ctx.beginPath(); ctx.rect(t.box.x, t.box.y, t.box.w, t.box.h); ctx.clip();
    ctx.drawImage(img, t.x, t.y, t.w, t.h); ctx.restore();
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
    // layersOnly: draw just these layers on a clear stage (no base, no imagery) - the occlusion pass asks what a set of
    // later layers paints over the words and marks beneath them
    const subset = Array.isArray(opts.layersOnly) ? opts.layersOnly : null;
    // belowIndex: the base and the layers before that index only - what is really behind a layer, for its readability
    const all = Array.isArray(layout.layers) ? layout.layers : [];
    const layers = subset || (typeof opts.belowIndex === 'number' ? all.slice(0, Math.max(0, opts.belowIndex)) : all);
    const pal = layout.palette || {};
    ctx.save(); ctx.clearRect(0, 0, W, H);
    const ib = layout.image && layout.image.w > 0 && layout.image.h > 0 ? { x: layout.image.x / 100 * W, y: layout.image.y / 100 * H, w: layout.image.w / 100 * W, h: layout.image.h / 100 * H } : null;
    const bgFill = layout.bg && typeof layout.bg === 'object' ? (() => { const d = layout.bg.dir || 'down'; const g = d === 'right' ? ctx.createLinearGradient(0, 0, W, 0) : d === 'left' ? ctx.createLinearGradient(W, 0, 0, 0) : d === 'up' ? ctx.createLinearGradient(0, H, 0, 0) : ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, layout.bg.from || '#0f171d'); g.addColorStop(1, layout.bg.to || layout.bg.from || '#0f171d'); return g; })() : layout.bg || null;
    const planNoBg = layout.v === 5 && !(layout.regions || []).some(r => r.role === 'background');
    if (!subset) {
      if (ib || bgFill || planNoBg) { ctx.fillStyle = bgFill || pal.primary || '#0f171d'; ctx.fillRect(0, 0, W, H); }
      if (images.bg && !layout.noImagery) cover(ctx, images.bg, W, H, ib, layout.imageFocus);
      else if (!planNoBg && !layout.noImagery) { const g = ib ? ctx.createLinearGradient(0, ib.y, 0, ib.y + ib.h) : ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a33'); g.addColorStop(1, pal.primary && layout.template !== 'plain' ? pal.primary : '#0f171d'); ctx.fillStyle = g; if (ib) ctx.fillRect(ib.x, ib.y, ib.w, ib.h); else ctx.fillRect(0, 0, W, H); }
    }
    const overflow = [];
    const sketch = s => { ctx.setLineDash([W * 0.01, W * 0.008]); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = Math.max(1, W * 0.003); ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2); ctx.setLineDash([]); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '500 ' + Math.max(10, W * 0.018) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(s.label, s.x + s.w / 2, s.y + s.h / 2); };
    layers.forEach(l => {
      if (l.hidden) return;
      // the ground pass leaves out the marks and the glyphs, but keeps a text layer's plate and highlight band: they are
      // what the glyphs sit on, drawn with their real alpha, so the contrast is measured against what is really there
      if (ground && isMark(l)) return;
      const glyphs = !(ground && l.type === 'text');
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
        if (l.emphasis === 'highlight') { ctx.fillStyle = l.emphasisColor || 'rgba(255,214,0,.85)'; t.lines.forEach((s, i) => { const lw = t.widths[i]; const lx = t.align === 'center' ? t.tx - lw / 2 : t.align === 'right' ? t.tx - lw : t.tx; ctx.fillRect(lx - t.px * 0.15, y + t.padY + i * t.lh - t.px * 0.05, lw + t.px * 0.3, t.lh); }); }
        if (glyphs) {
          if (l.emphasis === 'underline') { ctx.fillStyle = l.emphasisColor || l.color || '#fff'; t.lines.forEach((s, i) => { const lw = t.widths[i]; const lx = t.align === 'center' ? t.tx - lw / 2 : t.align === 'right' ? t.tx - lw : t.tx; ctx.fillRect(lx, y + t.padY + i * t.lh + t.px * 1.02, lw, Math.max(1.5, t.px * 0.08)); }); }
          // a box outline follows the plate when there is one, so a chip never sits inside a wider second rectangle
          if (l.emphasis === 'box') { ctx.strokeStyle = l.emphasisColor || l.color || '#fff'; ctx.lineWidth = Math.max(1.5, t.px * 0.08); if (l.bg) ctx.strokeRect(t.bx, y, t.bw, t.contentH); else ctx.strokeRect(x, y, w, t.contentH); }
          ctx.fillStyle = l.emphasis === 'highlight' ? (l.emphasisColor ? l.color || '#fff' : '#111') : (l.color || '#fff');
          t.lines.forEach((s, i) => ctx.fillText(s, t.tx, y + t.padY + i * t.lh));
        }
      }
      ctx.restore();
    });
    if (!ground && !subset && layout.frame && layout.frame.of > 1) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '500 ' + Math.max(10, W * 0.02) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'top'; ctx.textAlign = 'right'; ctx.fillText(layout.frame.index + 1 + ' / ' + layout.frame.of, W - W * 0.025, H * 0.015); ctx.restore(); }
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
      const b = { id, role: l.role || '', type: l.type, shape: l.shape || '', hidden: !!l.hidden, locked: !!l.locked, dup, valid, overlaps: Array.isArray(l.overlaps) ? l.overlaps.map(String) : [], rotate: l.rotate || 0, opacity: l.opacity == null ? 1 : Math.max(0, Math.min(1, +l.opacity || 0)), ax: (l.x || 0) / 100 * W, ay: (l.y || 0) / 100 * H, aw: (l.w || 0) / 100 * W, ah: (l.h || 0) / 100 * H };
      b.x = b.ax; b.y = b.ay; b.w = b.aw; b.h = b.ah;
      if (!valid || l.hidden) { boxes.push(b); return; }
      if (l.type === 'text') {
        const t = layoutText(ctx, layout, l, copy, W, H);
        if (!t) { b.empty = true; boxes.push(b); return; }
        Object.assign(b, { x: t.occupied.x, y: t.occupied.y, w: t.occupied.w, h: t.occupied.h, lines: t.lines.length, chars: t.text.length, text: t.text.slice(0, 160), px: t.px, contentH: t.contentH, overflowH: t.overflowH, overflowW: t.overflowW, broken: t.broken, color: l.color || '#fff', bg: l.bg || '', emphasis: l.emphasis || '' });
      } else if (l.type === 'img') {
        const img = isMark(l) ? markImage(images, l) : images[l.id];
        b.mark = isMark(l); b.asset = img ? 'loaded' : (isMark(l) ? 'missing' : 'sketch'); b.src = l.src || '';
        // a mark is its visible pixels, not its box: the contained image's drawn rectangle, then the bounds of its opaque pixels,
        // become the box the rules judge (collisions, safe areas, clear space, size); the layer box stays in ax/ay/aw/ah
        if (b.mark && img) {
          const s = Math.min(b.aw / (img.naturalWidth || 1), b.ah / (img.naturalHeight || 1)); const dw = (img.naturalWidth || 1) * s, dh = (img.naturalHeight || 1) * s; const dx = b.ax + (b.aw - dw) / 2, dy = b.ay + (b.ah - dh) / 2;
          const m = markStats(img);
          if (m && m.bounds) { b.vx = dx + m.bounds.x * dw; b.vy = dy + m.bounds.y * dh; b.vw = m.bounds.w * dw; b.vh = m.bounds.h * dh; b.markFill = Math.round(m.fill * 100) / 100; }
          else { b.vx = dx; b.vy = dy; b.vw = dw; b.vh = dh; }
          b.x = b.vx; b.y = b.vy; b.w = b.vw; b.h = b.vh;
          b.multicolour = !!(m && m.colours > 1);
        }
        // the placement constraints the mark carries (its campaign rule, or the house defaults), in stage pixels, from the
        // same helper the worker's judge uses
        if (b.mark) Object.assign(b, markConstraints(l.rule, b, W, H));
        if (l.rotate && (b.mark || b.type === 'img')) {
          // the axis-aligned bounds of the drawn rectangle turned about the layer's centre, as draw() turns it
          const cx = b.ax + b.aw / 2, cy = b.ay + b.ah / 2, a = l.rotate * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
          const pts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([px0, py0]) => [cx + (px0 - cx) * cs - (py0 - cy) * sn, cy + (px0 - cx) * sn + (py0 - cy) * cs]);
          const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); b.x = Math.min.apply(null, xs); b.y = Math.min.apply(null, ys); b.w = Math.max.apply(null, xs) - b.x; b.h = Math.max.apply(null, ys) - b.y;
        }
      }
      boxes.push(b);
    });
    return boxes;
  }

  /* ---------------------------------------------------------------- the rules: a byte-identical copy lives in the worker */
  /* RULES:BEGIN */
  /* The one safe-area table: the Instagram story interface (top 14%, bottom 20%, 6% sides, hard) and the feed margin (3%,
     advisory). The rules judge by it, the editor draws its guides from it, the worker places marks inside it. */
  function safeAreaOf(format, channel) {
    return format === '9:16' && channel === 'instagram' ? { top: 0.14, bottom: 0.2, side: 0.06, hard: true } : { top: 0.03, bottom: 0.03, side: 0.03, hard: false };
  }
  /* A mark's placement constraints, in stage pixels, from the rule it carries (a campaign rule taught in the Brand view, or a
     rule set on the layer) and the house defaults: clear space around the visible mark (a share of its ink height, default a
     half), the minimum visible width (per cent of the stage, default 6), a permitted region (per cent of the stage) when one is
     set, and whether each is mandatory (a blocking matter) or preferred (a warning). The basis says where the rule came from. */
  function markConstraints(rule, b, W, H) {
    rule = rule && typeof rule === 'object' ? rule : {};
    var vh = typeof b.vh === 'number' && b.vh > 0 ? b.vh : (b.ah || 0);
    var cs = typeof rule.clearSpace === 'number' && rule.clearSpace >= 0 && rule.clearSpace <= 3 ? rule.clearSpace : 0.5;
    var mw = typeof rule.minWidth === 'number' && rule.minWidth >= 2 && rule.minWidth <= 60 ? rule.minWidth : 6;
    var reg = rule.region && typeof rule.region === 'object' && typeof rule.region.x === 'number' && typeof rule.region.w === 'number' && rule.region.w > 0 && typeof rule.region.h === 'number' && rule.region.h > 0
      ? { x: rule.region.x / 100 * W, y: (rule.region.y || 0) / 100 * H, w: rule.region.w / 100 * W, h: rule.region.h / 100 * H } : null;
    return { clearWant: Math.round(cs * vh * 10) / 10, clearShare: cs, minWant: Math.round(mw / 100 * W), region: reg, ruleMandatory: !!rule.mandatory, ruleBasis: rule.basis || (rule.corner || reg ? 'rule' : 'default'), ruleCorner: rule.corner || '' };
  }
  function layoutRules(boxes, o) {
    o = o || {}; var W = o.W || 1080, H = o.H || 1080; var out = [];
    var add = function (code, severity, layers, detail) { out.push({ code: code, severity: severity, layers: layers, detail: detail }); };
    var tol = Math.max(1, W * 0.0015);
    var safe = safeAreaOf(o.format, o.channel);
    if (o.unresolved && o.unresolved.length) add('pixels_unmeasured', o.production ? 'blocking' : 'warning', [], 'the ' + o.unresolved.join(' and ') + ' analysis could not read the pixels (a blocked or tainted canvas); what it would have found is unknown, so this measurement is unresolved, not passed');
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
        if (typeof b.contrast === 'number') { var large = pct >= 4; var want = large ? 3 : 4.5; if (b.contrast < 1.6) add('unreadable_contrast', 'blocking', [b.id], 'the ' + (b.role || 'text') + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it'); else if (b.contrast < want) add('low_contrast', 'warning', [b.id], 'the ' + (b.role || 'text') + ' has a contrast of ' + b.contrast.toFixed(2) + ':1 against what is behind it (' + want + ':1 wanted)');
          // the mean can hide a bright or dark patch under part of the words: the worst tenth of the ground is judged too
          if (typeof b.contrastMin === 'number' && b.contrast >= 1.6) { if (b.contrastMin < 1.6) add('patchy_contrast', 'blocking', [b.id], 'part of the ' + (b.role || 'text') + ' sits on a patch of the ground where its contrast falls to ' + b.contrastMin.toFixed(2) + ':1 (the average is ' + b.contrast.toFixed(2) + ':1): those words vanish'); else if (b.contrastMin < want * 0.75) add('patchy_contrast', 'warning', [b.id], 'the ground under the ' + (b.role || 'text') + ' is uneven: its contrast falls to ' + b.contrastMin.toFixed(2) + ':1 on the worst patch (average ' + b.contrast.toFixed(2) + ':1)'); } }
      }
      if (b.mark) {
        if (b.asset !== 'loaded') add('mark_unloaded', o.production ? 'blocking' : 'warning', [b.id], 'the ' + b.role + ' image did not load; a placeholder is drawn in its place');
        // the mark is judged by its visible pixels: a box far larger than its ink misleads every placement, and ink under the
        // minimum width (6% of the stage, or the rule's own) is not an identity a feed can read
        if (typeof b.vw === 'number' && b.asset === 'loaded') {
          var minW = typeof b.minWant === 'number' ? b.minWant : W * 0.06;
          if (typeof b.markFill === 'number' && b.markFill < 0.25 && b.vw < b.aw * 0.6) add('mark_padding', 'warning', [b.id], 'the visible ' + b.role + ' is ' + Math.round(b.vw) + ' px wide inside a ' + Math.round(b.aw) + ' px box (' + Math.round(b.markFill * 100) + '% of the box is ink): size, clear space and collisions are judged by the ink, not the box');
          if (b.vw < minW) add('mark_small', b.ruleMandatory && typeof b.minWant === 'number' ? 'blocking' : 'warning', [b.id], 'the visible ' + b.role + ' is ' + Math.round(b.vw) + ' px wide, under ' + Math.round(minW / W * 100) + '% of the stage' + (b.ruleBasis === 'rule' ? ' (the campaign rule\'s minimum)' : '') + ': too small to read in a feed');
          // the permitted region, when the rule names one: the ink must lie inside it
          if (b.region && (b.x < b.region.x - tol || b.y < b.region.y - tol || b.x + b.w > b.region.x + b.region.w + tol || b.y + b.h > b.region.y + b.region.h + tol)) add('mark_outside_region', b.ruleMandatory ? 'blocking' : 'warning', [b.id], 'the ' + b.role + ' sits outside the placement region the ' + (b.ruleMandatory ? 'rule' : 'preference') + ' allows (' + Math.round(b.region.x / W * 100) + ',' + Math.round(b.region.y / H * 100) + ' to ' + Math.round((b.region.x + b.region.w) / W * 100) + ',' + Math.round((b.region.y + b.region.h) / H * 100) + '% of the stage)');
        }
        /* readability per pixel (contract 2): the mark's visible strokes against the ground actually behind each of them, the
           layer's opacity composited in, transparent padding excluded, strokes covered by a later layer counted as lost. A
           wordmark is lettering: a stroke under 2:1 locally is lost and under 3:1 weak; a graphic symbol survives less (1.6 / 2.5).
           The judgment is on the share of ink lost and on its extent (a quarter of the mark's length unreadable in one stretch
           is a mark a reader cannot complete), never on one average that a split ground can satisfy. */
        if (b.asset === 'loaded') {
          if (typeof b.inkLost === 'number') {
            var wm = b.role === 'wordmark'; var wantM = wm ? 3 : 2.5;
            var where = b.inkWhere ? ' - the ' + b.inkWhere + ' of the ' + b.role : '';
            var split = b.inkBoundary ? ': it crosses a light/dark boundary' : '';
            var worst = typeof b.inkLocal === 'number' ? '; worst local contrast ' + b.inkLocal.toFixed(2) + ':1' : '';
            var covered = typeof b.inkCovered === 'number' && b.inkCovered >= 0.05 ? ', ' + Math.round(b.inkCovered * 100) + '% painted over by later layers' : '';
            if (b.inkLost >= 0.12 || (typeof b.inkRun === 'number' && b.inkRun >= 0.25)) add('mark_unreadable', 'blocking', [b.id], Math.round(b.inkLost * 100) + '% of the ' + b.role + '\'s visible strokes do not read against what is behind them' + split + where + worst + covered + ' (measured per pixel, not an average)');
            else if (b.inkLost >= 0.04 || (typeof b.inkWeak === 'number' && b.inkWeak >= 0.3) || (typeof b.inkLocal === 'number' && b.inkLocal < wantM)) add('mark_low_contrast', 'warning', [b.id], 'parts of the ' + b.role + ' read weakly: ' + Math.round((b.inkWeak || 0) * 100) + '% of its strokes under ' + wantM + ':1' + (b.inkLost ? ', ' + Math.round(b.inkLost * 100) + '% lost' : '') + split + where + worst + '; another approved variant or a quieter ground may read better');
          } else if (o.unresolved && o.unresolved.length) { /* said once by pixels_unmeasured */ }
          else add('mark_unmeasured', o.production ? 'blocking' : 'warning', [b.id], 'the ' + b.role + '\'s readability was not measured per pixel (an older measurement, or one made without its image): unknown, not passed');
        }
      }
      if (b.type === 'text' && b.bg && b.emphasis === 'box') add('double_styling', 'warning', [b.id], 'the ' + (b.role || 'text') + ' has both a filled plate and a box outline: one device is enough (the outline is drawn around the plate, never wider)');
      if (b.type === 'img' && !b.mark && b.asset !== 'loaded') add('imagery_sketch', o.production ? 'blocking' : 'warning', [b.id], 'image region ' + b.id + ' is still a sketch: its image has not been made or did not load');
      if (b.type === 'text' || b.mark) {
        if (typeof b.opacity === 'number') { if (b.opacity < 0.05) add('invisible', 'blocking', [b.id], 'the ' + (b.role || b.type) + ' is drawn at ' + Math.round(b.opacity * 100) + '% opacity: it is not visible'); else if (b.opacity < 0.5) add('faint', 'warning', [b.id], 'the ' + (b.role || b.type) + ' is drawn at ' + Math.round(b.opacity * 100) + '% opacity'); }
        if (typeof b.occluded === 'number') {
          var cov = (b.occludedBy || []).filter(function (id) { return b.overlaps.indexOf(String(id)) < 0; });
          if (cov.length || !(b.occludedBy && b.occludedBy.length)) { var cl = [b.id].concat(cov); if (b.occluded >= 0.2) add('occluded', 'blocking', cl, Math.round(b.occluded * 100) + '% of the ' + (b.role || b.type) + ' is painted over by ' + (cov.length ? 'a later layer (' + cov.join(', ') + ')' : 'later layers')); else if (b.occluded >= 0.05) add('occluded', 'warning', cl, Math.round(b.occluded * 100) + '% of the ' + (b.role || b.type) + ' is painted over by ' + (cov.length ? cov.join(', ') : 'later layers')); }
        }
        if (b.x < -0.5 || b.y < -0.5 || b.x + b.w > W + 0.5 || b.y + b.h > H + 0.5) add('off_canvas', 'blocking', [b.id], 'the ' + (b.role || b.type) + ' runs off the edge of the stage');
        else if (b.x < W * safe.side - 0.5 || b.x + b.w > W * (1 - safe.side) + 0.5 || b.y < H * safe.top - 0.5 || b.y + b.h > H * (1 - safe.bottom) + 0.5) add('safe_area', safe.hard ? 'blocking' : 'warning', [b.id], 'the ' + (b.role || b.type) + ' sits ' + (safe.hard ? 'under the story interface (top ' + Math.round(safe.top * 100) + '%, bottom ' + Math.round(safe.bottom * 100) + '%)' : 'inside the ' + Math.round(safe.side * 100) + '% margin'));
      }
    }
    for (i = 0; i < live.length; i++) for (j = i + 1; j < live.length; j++) {
      var a = live[i], c = live[j];
      if (a.overlaps.indexOf(c.id) >= 0 || c.overlaps.indexOf(a.id) >= 0) continue;
      var iw = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), ih = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
      if (iw > tol && ih > tol) {
        var kind = a.type === 'text' && c.type === 'text' ? 'text' : a.mark && c.mark ? 'marks' : 'text_mark';
        add('collision', 'blocking', [a.id, c.id], 'the ' + (a.role || a.type) + ' and the ' + (c.role || c.type) + ' overlap by ' + Math.round(iw) + ' x ' + Math.round(ih) + ' px' + (kind === 'text_mark' ? ' (words over a mark)' : kind === 'marks' ? ' (two marks)' : ''));
      } else if ((a.mark || c.mark) && (a.type === 'text' || c.type === 'text' || (a.mark && c.mark))) {
        // clear space around a mark's ink: the separation from any words, URL, CTA or other mark, judged against the share of
        // the mark's own height its rule asks for (mandatory: blocking; preferred or the house default: a warning)
        var mk = a.mark ? a : c, ot = a.mark ? c : a; var want = typeof mk.clearWant === 'number' ? mk.clearWant : 0;
        if (want > 0) {
          var gx = Math.max(ot.x - (mk.x + mk.w), mk.x - (ot.x + ot.w)), gy = Math.max(ot.y - (mk.y + mk.h), mk.y - (ot.y + ot.h)); var gap = Math.max(gx, gy);
          if (gap < want - tol) add('mark_clear_space', mk.ruleMandatory ? 'blocking' : 'warning', [mk.id, ot.id], 'the ' + (ot.role || ot.type) + ' sits ' + Math.round(Math.max(0, gap)) + ' px from the ' + mk.role + '\'s visible edge; the ' + (mk.ruleBasis === 'rule' ? 'campaign rule' : 'house default') + ' asks for ' + Math.round(want) + ' px of clear space (' + Math.round((mk.clearShare || 0.5) * 100) + '% of the mark\'s height)');
        }
      }
    }
    if (o.imageryMissing) add('imagery_missing', o.production ? 'blocking' : 'warning', [], 'the composition expects imagery that is not on file yet');
    // a likely subject of the photograph under the words or a panel: a warning that carries its confidence (saliency, not detection)
    (o.subjects || []).forEach(function (s) { if (s && typeof s.covered === 'number' && s.covered >= 0.35 && s.by && s.by.length) add('subject_covered', 'warning', s.by.slice(0, 4), Math.round(s.covered * 100) + '% of a likely subject of the photograph (' + (s.id || 'subject') + ', confidence ' + Math.round((s.confidence || 0) * 100) + '%: a colour-and-edge estimate, not detection) is under ' + s.by.join(', ') + '; reframe the photograph or move the words'); else if (s && typeof s.cropped === 'number' && s.cropped >= 0.5) add('subject_cropped', 'warning', [], Math.round(s.cropped * 100) + '% of a likely subject of the photograph (' + (s.id || 'subject') + ', confidence ' + Math.round((s.confidence || 0) * 100) + '%) falls outside the crop'); });
    if (o.fonts && o.fonts.fallback && o.fonts.fallback.length) add('font_fallback', 'warning', [], 'fonts not available where this was drawn: ' + o.fonts.fallback.join('; '));
    var rank = { blocking: 0, warning: 1, info: 2 };
    out.sort(function (x, y) { return rank[x.severity] - rank[y.severity]; });
    return out;
  }
  /* RULES:END */

  /* ---------------------------------------------------------------- contrast against what is actually behind each word and mark */
  const lum = (r, g, b) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  /** A CSS colour as [r, g, b, a] (0-255, alpha 0-1), through the canvas parser; alpha is kept, never dropped. */
  function colourRGBA(css) {
    const c = pctx(); c.fillStyle = '#000'; c.fillStyle = css || '#fff'; const v = String(c.fillStyle);
    if (/^#/.test(v)) { const n = parseInt(v.slice(1, 7), 16); const a = v.length === 9 ? parseInt(v.slice(7, 9), 16) / 255 : 1; return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]; }
    const m = v.match(/[\d.]+/g) || [255, 255, 255]; return [+m[0], +m[1], +m[2], m.length > 3 ? Math.max(0, Math.min(1, +m[3])) : 1];
  }
  function colourLum(css) { const c = colourRGBA(css); return lum(c[0], c[1], c[2]); }
  /** The composited pixels under a box: mean colour and luminance, and the brightest and darkest sampled patch (local
   *  readability, which an average can hide). */
  function regionStats(data, W, H, r) {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(W, Math.ceil(r.x + r.w)), y1 = Math.min(H, Math.ceil(r.y + r.h));
    const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 4000))); let n = 0, s = 0, sr = 0, sg = 0, sb = 0, lo = 1, hi = 0; const ls = [];
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) { const k = (y * W + x) * 4; const L = lum(data[k], data[k + 1], data[k + 2]); s += L; sr += data[k]; sg += data[k + 1]; sb += data[k + 2]; if (L < lo) lo = L; if (L > hi) hi = L; ls.push(L); n++; }
    // the darkest and brightest tenth of the ground (percentiles, so one stray pixel does not decide): local readability
    ls.sort((a, b) => a - b); const p10 = n ? ls[Math.floor((n - 1) * 0.1)] : 0, p90 = n ? ls[Math.floor((n - 1) * 0.9)] : 0;
    return n ? { lum: s / n, rgb: [sr / n, sg / n, sb / n], lo, hi, p10, p90, n } : { lum: 0, rgb: [0, 0, 0], lo: 0, hi: 0, p10: 0, p90: 0, n: 0 };
  }
  function regionLum(data, W, H, r) { return regionStats(data, W, H, r).lum; }
  /** The visible pixels of a mark: mean colour and luminance over the pixels that are not transparent, and how much of the
   *  box they fill (a mark with wide transparent padding is smaller than its box). */
  function markStats(img) {
    if (!img) return null; const c = document.createElement('canvas'); const w = Math.min(160, img.naturalWidth || 160), h = Math.max(1, Math.round(w * (img.naturalHeight || 1) / (img.naturalWidth || 1))); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); let d; try { d = x.getImageData(0, 0, w, h).data; } catch (e) { return null; }
    let n = 0, s = 0, sr = 0, sg = 0, sb = 0; let minX = w, minY = h, maxX = -1, maxY = -1; const hues = {};
    for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 128) { s += lum(d[k], d[k + 1], d[k + 2]); sr += d[k]; sg += d[k + 1]; sb += d[k + 2]; n++; const px = (k / 4) % w, py = Math.floor(k / 4 / w); if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py; hues[(d[k] >> 6) * 16 + (d[k + 1] >> 6) * 4 + (d[k + 2] >> 6)] = (hues[(d[k] >> 6) * 16 + (d[k + 1] >> 6) * 4 + (d[k + 2] >> 6)] || 0) + 1; }
    // distinct colour families with a real share of the ink: a multicolour mark is never averaged into one misleading value
    const colours = n ? Object.keys(hues).filter(k => hues[k] >= n * 0.08).length : 0;
    return n ? { lum: s / n, rgb: [sr / n, sg / n, sb / n], fill: n / (w * h), colours, bounds: { x: minX / w, y: minY / h, w: (maxX - minX + 1) / w, h: (maxY - minY + 1) / h } } : null;
  }
  /* ---------------------------------------------------------------- mark readability, per pixel
   * The earlier estimate compared the mark's mean colour with the mean luminance under its box, which a mark straddling a
   * light panel and a dark footer passes with ease while half its lettering disappears. This reads the mark as drawn - the
   * same contain/cover, scale, rotation and opacity as draw(), so every sample is a real stroke pixel in its real place -
   * against the ground actually behind that pixel (the base imagery and only the layers below the mark, with their alpha), and
   * counts a stroke painted over by a later layer as lost. Padding is not ink and is never sampled. The result is a share and
   * a distribution, not an average: how much ink is lost, how much reads weakly, the worst local contrast (a tenth-percentile,
   * so one noisy pixel does not decide), the longest unreadable stretch along the mark, which part of the mark it is, and
   * whether the ground under the ink is split light/dark. Thresholds: a wordmark is lettering, so a stroke under 2:1 is lost
   * and under 3:1 weak; a graphic symbol survives less (1.6 and 2.5). The rules decide; this only measures.
   * opts.only: measure one mark (by id). Returns false when the pixels could not be read (an unresolved state, never a pass). */
  function markReadability(layout, copy, images, boxes, W, H, opts) {
    opts = opts || {}; const layers = Array.isArray(layout.layers) ? layout.layers : [];
    const marks = boxes.filter(b => b.mark && b.asset === 'loaded' && !b.hidden && b.valid !== false && (!opts.only || b.id === opts.only));
    if (!marks.length) return true;
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    let ok = true;
    marks.forEach(b => {
      const i = layers.findIndex((l, k) => String(l.id || ('layer' + k)) === b.id); const l = layers[i]; if (!l) return;
      const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(W, Math.ceil(b.x + b.w)), y1 = Math.min(H, Math.ceil(b.y + b.h));
      if (x1 <= x0 || y1 <= y0) { b.inkN = 0; b.inkLost = 1; b.inkWeak = 1; b.inkLocal = 1; b.inkRun = 1; b.inkWhere = 'whole'; b.inkBoundary = false; b.inkCovered = 0; return; }
      const cw = x1 - x0, ch = y1 - y0;
      // the ground below the mark, the mark alone at full alpha, and what later layers paint over it
      const G = mk(W, H); draw(G.getContext('2d'), W, H, layout, copy, images, { only: 'ground', belowIndex: i });
      const M = mk(W, H); draw(M.getContext('2d'), W, H, layout, copy, images, { layersOnly: [Object.assign({}, l, { opacity: 1, hidden: false })] });
      const later = layers.slice(i + 1).filter(x => !x.hidden && b.overlaps.indexOf(String(x.id)) < 0).filter(x => { const lx = x.x / 100 * W, ly = x.y / 100 * H, lw = x.w / 100 * W, lh = (x.h || 0) / 100 * H; const pad = x.rotate ? Math.max(lw, lh) : 0; return Math.min(lx + lw + pad, b.x + b.w) - Math.max(lx - pad, b.x) > 0 && Math.min(ly + lh + pad, b.y + b.h) - Math.max(ly - pad, b.y) > 0; });
      let C = null; if (later.length) { C = mk(W, H); draw(C.getContext('2d'), W, H, layout, copy, images, { layersOnly: later }); }
      let g, m, c; try { g = G.getContext('2d').getImageData(x0, y0, cw, ch).data; m = M.getContext('2d').getImageData(x0, y0, cw, ch).data; c = C ? C.getContext('2d').getImageData(x0, y0, cw, ch).data : null; } catch (e) { ok = false; b.inkUnresolved = true; return; }
      const op = b.opacity == null ? 1 : b.opacity; const wm = b.role === 'wordmark'; const lostBar = wm ? 2 : 1.6, weakBar = wm ? 3 : 2.5;
      const step = Math.max(1, Math.floor(Math.sqrt((cw * ch) / 24000)));
      const N = 12; const rowN = new Array(N).fill(0), rowLost = new Array(N).fill(0), colN = new Array(N).fill(0), colLost = new Array(N).fill(0);
      let n = 0, lost = 0, weak = 0, cov = 0, sum = 0; const ratios = []; const grounds = [];
      for (let yy = 0; yy < ch; yy += step) for (let xx = 0; xx < cw; xx += step) {
        const k = (yy * cw + xx) * 4; const a = m[k + 3]; if (a < 128) continue;
        n++; const ri = Math.min(N - 1, Math.floor(yy / ch * N)), ci = Math.min(N - 1, Math.floor(xx / cw * N)); rowN[ri]++; colN[ci]++;
        const gl = lum(g[k], g[k + 1], g[k + 2]); grounds.push(gl);
        if (c && c[k + 3] >= 128) { cov++; lost++; rowLost[ri]++; colLost[ci]++; ratios.push(1); continue; }
        const fa = (a / 255) * op; const fr = fa * m[k] + (1 - fa) * g[k], fg = fa * m[k + 1] + (1 - fa) * g[k + 1], fb = fa * m[k + 2] + (1 - fa) * g[k + 2];
        const r = ratio(lum(fr, fg, fb), gl); ratios.push(r); sum += r;
        if (r < lostBar) { lost++; rowLost[ri]++; colLost[ci]++; } else if (r < weakBar) weak++;
      }
      if (!n) { b.inkN = 0; b.inkLost = 1; b.inkWeak = 0; b.inkLocal = 1; b.inkRun = 1; b.inkWhere = 'whole'; b.inkBoundary = false; b.inkCovered = 0; return; }
      ratios.sort((p, q) => p - q); grounds.sort((p, q) => p - q);
      const p10 = ratios[Math.floor((ratios.length - 1) * 0.1)]; const gp10 = grounds[Math.floor((grounds.length - 1) * 0.1)], gp90 = grounds[Math.floor((grounds.length - 1) * 0.9)];
      // the longest stretch of lost bands along either axis, and which part of the mark it is
      // a band is unreadable when most of its ink is lost (0.6, so a mark whose every column loses exactly half is judged by its
      // rows, where the loss is concentrated); the axis that carries the loss is the one whose bands differ most
      const run = (ns, ls) => { let best = 0, cur = 0, start = -1, bs = -1, lo = 1, hi = 0; for (let k = 0; k < N; k++) { if (ns[k] > 0) { const f = ls[k] / ns[k]; if (f < lo) lo = f; if (f > hi) hi = f; } const bad = ns[k] > 0 && ls[k] / ns[k] >= 0.6; if (bad) { if (!cur) start = k; cur++; if (cur > best) { best = cur; bs = start; } } else cur = 0; } return { len: best / N, at: bs, spread: Math.max(0, hi - lo) }; };
      const rr = run(rowN, rowLost), rc = run(colN, colLost); const rmax = Math.max(rr.len, rc.len);
      let where = ''; if (rmax >= 2 / N) { if (rr.spread >= rc.spread) where = rr.at + rr.len * N / 2 < N / 2 ? 'upper part' : 'lower part'; else where = rc.at + rc.len * N / 2 < N / 2 ? 'left part' : 'right part'; }
      if (lost / n >= 0.85) where = 'whole mark';
      b.inkN = n; b.inkLost = Math.round(lost / n * 1000) / 1000; b.inkWeak = Math.round(weak / n * 1000) / 1000; b.inkCovered = Math.round(cov / n * 1000) / 1000;
      b.inkLocal = Math.round(p10 * 100) / 100; b.inkMean = Math.round((sum / Math.max(1, n - cov)) * 100) / 100; b.inkRun = Math.round(rmax * 1000) / 1000; b.inkWhere = where;
      b.inkBoundary = gp90 - gp10 >= 0.35; b.inkGround = [Math.round(gp10 * 1000) / 1000, Math.round(gp90 * 1000) / 1000];
      b.contrast = b.inkMean; b.contrastMin = b.inkLocal;
    });
    return ok;
  }
  /* ---------------------------------------------------------------- the region behind a mark: evidence, not knowledge
   * When a footer or panel is a live shape its box is known. When it is painted into the bitmap, the only evidence is the
   * pixels: this scans the ground below the mark for the contiguous band of rows around the mark's lower edge whose mean
   * luminance stays close and whose spread stays small (a flat footer), and returns that band with a confidence that says how
   * far to trust it. It is offered to a person as a candidate placement region, never applied on its own. */
  function markRegion(layout, copy, images, id, opts) {
    opts = opts || {}; const { w: W, h: H } = stageSize(layout, opts.width);
    const boxes = measure(layout, copy, images, W, H); const b = boxes.find(x => x.id === id && x.mark); if (!b || b.asset !== 'loaded') return null;
    const layers = layout.layers || []; const i = layers.findIndex((l, k) => String(l.id || ('layer' + k)) === id);
    const G = document.createElement('canvas'); G.width = W; G.height = H; draw(G.getContext('2d'), W, H, layout, copy, images, { only: 'ground', belowIndex: i });
    let d; try { d = G.getContext('2d').getImageData(0, 0, W, H).data; } catch (e) { return { unresolved: true }; }
    const rowStat = y => { let s = 0, s2 = 0, n = 0; for (let x = 0; x < W; x += 4) { const k = (y * W + x) * 4; const L = lum(d[k], d[k + 1], d[k + 2]); s += L; s2 += L * L; n++; } const mu = s / n; return { mu, sd: Math.sqrt(Math.max(0, s2 / n - mu * mu)) }; };
    // anchor on the row just under the mark's ink, then grow up and down while the band stays flat and alike
    const yA = Math.min(H - 1, Math.max(0, Math.round(b.y + b.h) + 2)); const ref = rowStat(yA); if (ref.sd > 0.09) return { x: 0, y: 0, w: 0, h: 0, confidence: 0, note: 'no flat band under the mark: the ground there is textured' };
    let top = yA, bot = yA; const alike = st => Math.abs(st.mu - ref.mu) <= 0.06 && st.sd <= 0.09;
    while (top > 0 && alike(rowStat(top - 1))) top--; while (bot < H - 1 && alike(rowStat(bot + 1))) bot++;
    const h = bot - top + 1; const conf = Math.round(Math.max(0, Math.min(0.9, (h / Math.max(1, b.h)) * 0.3 + (ref.sd < 0.03 ? 0.4 : 0.2))) * 100) / 100;
    return { x: 0, y: Math.round(top / H * 1000) / 10, w: 100, h: Math.round(h / H * 1000) / 10, lum: Math.round(ref.mu * 1000) / 1000, confidence: conf, px: { x: 0, y: top, w: W, h }, note: h >= b.h * 1.2 ? 'a flat ' + (ref.mu < 0.25 ? 'dark' : ref.mu > 0.6 ? 'light' : 'mid-tone') + ' band of ' + h + ' px under the mark (confidence ' + Math.round(conf * 100) + '%: pixel evidence, not a known shape)' : 'the flat band under the mark is shorter than the mark itself (confidence ' + Math.round(conf * 100) + '%)' };
  }
  function markLum(img) { const m = markStats(img); return m ? m.lum : null; }
  const blend = (fg, a, bg) => [0, 1, 2].map(i => a * fg[i] + (1 - a) * bg[i]);
  /** Contrast against what is actually behind each word and mark: the ground pass draws everything but the glyphs and
   *  the marks (plates, panels, scrims, imagery, with their real alpha and order); the foreground is composited with its
   *  colour's alpha and the layer's opacity before it is compared, so a transparent plate is not a ground and a faint word
   *  is a faint word. */
  function contrastOf(layout, copy, images, boxes, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    draw(x, W, H, layout, copy, images, { only: 'ground' }); let data; try { data = x.getImageData(0, 0, W, H).data; } catch (e) { return false; }
    const byId = {}; (layout.layers || []).forEach(l => { byId[String(l.id)] = l; });
    boxes.forEach(b => {
      const l = byId[b.id]; if (!l || b.hidden || b.empty || b.valid === false) return;
      const op = b.opacity == null ? 1 : b.opacity;
      if (b.type === 'text') {
        const g = regionStats(data, W, H, b); const fgc = colourRGBA(l.emphasis === 'highlight' ? (l.emphasisColor ? l.color || '#fff' : '#111') : (l.color || '#fff'));
        const a = fgc[3] * op; const eff = blend(fgc, a, g.rgb); const fl = lum(eff[0], eff[1], eff[2]);
        b.contrast = Math.round(ratio(fl, g.lum) * 100) / 100; b.alpha = Math.round(a * 100) / 100;
        // the worst local contrast: against the brightest and the darkest tenth of the ground, whichever the words lose to
        b.contrastMin = Math.round(Math.min(ratio(fl, g.p10), ratio(fl, g.p90)) * 100) / 100;
        b.groundLum = Math.round(g.lum * 1000) / 1000; b.groundRange = [Math.round(g.p10 * 1000) / 1000, Math.round(g.p90 * 1000) / 1000];
      } else if (b.mark && b.asset === 'loaded') {
        // marks are read per pixel by markReadability(); only the ground's mean is noted here for the record
        const g = regionStats(data, W, H, b); b.alpha = Math.round(op * 100) / 100; b.groundLum = Math.round(g.lum * 1000) / 1000;
      }
    });
    return true;
  }
  /** What later layers paint over each word and mark: the layers after it (its named overlaps excepted) are drawn alone on
   *  a clear stage and the alpha under its occupied box is sampled; the covered share and the covering layers are recorded. */
  function occlusionOf(layout, copy, images, boxes, W, H) {
    const layers = Array.isArray(layout.layers) ? layout.layers : []; if (layers.length < 2) return true;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const idx = {}; layers.forEach((l, i) => { idx[String(l.id || ('layer' + i))] = i; });
    for (const b of boxes) {
      if (!(b.type === 'text' || b.mark) || b.hidden || b.empty || b.valid === false) continue;
      const i = idx[b.id]; if (i == null) continue;
      const later = layers.slice(i + 1).filter(l => !l.hidden && b.overlaps.indexOf(String(l.id)) < 0);
      if (!later.length) continue;
      // only layers whose own box meets this one can cover it (a cheap geometric filter before the pixels are read)
      const near = later.filter(l => { const lx = l.x / 100 * W, ly = l.y / 100 * H, lw = l.w / 100 * W, lh = (l.h || 0) / 100 * H; const pad = l.rotate ? Math.max(lw, lh) : 0; return Math.min(lx + lw + pad, b.x + b.w) - Math.max(lx - pad, b.x) > 0 && Math.min(ly + lh + pad, b.y + b.h) - Math.max(ly - pad, b.y) > 0; });
      if (!near.length) continue;
      draw(x, W, H, layout, copy, images, { layersOnly: near }); let data; try { data = x.getImageData(0, 0, W, H).data; } catch (e) { return false; }
      const x0 = Math.max(0, Math.floor(b.x)), y0 = Math.max(0, Math.floor(b.y)), x1 = Math.min(W, Math.ceil(b.x + b.w)), y1 = Math.min(H, Math.ceil(b.y + b.h));
      const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 6000))); let n = 0, cov = 0;
      for (let yy = y0; yy < y1; yy += step) for (let xx = x0; xx < x1; xx += step) { n++; if (data[(yy * W + xx) * 4 + 3] >= 128) cov++; }
      if (n) { b.occluded = Math.round(cov / n * 1000) / 1000; b.occludedBy = near.map(l => String(l.id)); }
    }
    return true;
  }
  /* ---------------------------------------------------------------- subjects: where the photograph's attention probably is
   * No face or object model runs here (none is available offline, and none is claimed). The estimate is colour-and-edge
   * saliency over a coarse grid: cells that differ most from the image's mean colour and carry the most edge energy are
   * grouped into regions. It is evidence with a confidence, never a fact: the rules treat a covered subject as a warning
   * that names the confidence, and the framing suggestion offers, never applies. */
  function subjects(img) {
    if (!img || !(img.naturalWidth > 0)) return { regions: [], method: 'none', confidence: 0 };
    const N = 48; const c = document.createElement('canvas'); c.width = N; c.height = N; const x = c.getContext('2d');
    let d; try { x.drawImage(img, 0, 0, N, N); d = x.getImageData(0, 0, N, N).data; } catch (e) { return { regions: [], method: 'unavailable', confidence: 0, unresolved: true }; }
    const L = new Float32Array(N * N); const R = new Float32Array(N * N), G = new Float32Array(N * N), B = new Float32Array(N * N); let mr = 0, mg = 0, mb = 0;
    for (let i = 0; i < N * N; i++) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; L[i] = 0.2126 * R[i] + 0.7152 * G[i] + 0.0722 * B[i]; mr += R[i]; mg += G[i]; mb += B[i]; }
    mr /= N * N; mg /= N * N; mb /= N * N;
    const score = new Float32Array(N * N); let max = 0;
    for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
      const i = yy * N + xx; const col = Math.sqrt((R[i] - mr) ** 2 + (G[i] - mg) ** 2 + (B[i] - mb) ** 2) / 441;
      const gx = xx > 0 && xx < N - 1 ? Math.abs(L[i + 1] - L[i - 1]) : 0, gy = yy > 0 && yy < N - 1 ? Math.abs(L[i + N] - L[i - N]) : 0; const edge = Math.min(1, (gx + gy) / 160);
      score[i] = col * 0.6 + edge * 0.4; if (score[i] > max) max = score[i];
    }
    if (max < 0.08) return { regions: [], method: 'colour-and-edge saliency (no face or object model)', confidence: 0.2, note: 'no part of the image stands out from the rest' };
    // cells above the bar, grouped into connected regions (4-neighbour), the three strongest kept
    const bar = max * 0.55; const seen = new Uint8Array(N * N); const regs = [];
    for (let i = 0; i < N * N; i++) {
      if (seen[i] || score[i] < bar) continue; const stack = [i]; seen[i] = 1; let minX = N, minY = N, maxX = -1, maxY = -1, sum = 0, n = 0;
      while (stack.length) { const k = stack.pop(); const kx = k % N, ky = Math.floor(k / N); sum += score[k]; n++; if (kx < minX) minX = kx; if (kx > maxX) maxX = kx; if (ky < minY) minY = ky; if (ky > maxY) maxY = ky; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => { const nx = kx + ox, ny = ky + oy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) return; const j = ny * N + nx; if (!seen[j] && score[j] >= bar) { seen[j] = 1; stack.push(j); } }); }
      if (n < 4) continue;
      regs.push({ x: minX / N * 100, y: minY / N * 100, w: (maxX - minX + 1) / N * 100, h: (maxY - minY + 1) / N * 100, score: sum / n, cells: n });
    }
    regs.sort((a, b) => b.score * b.cells - a.score * a.cells);
    const top = regs.slice(0, 3).map((r, i) => ({ id: 's' + (i + 1), x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.w * 10) / 10, h: Math.round(r.h * 10) / 10, score: Math.round(r.score * 100) / 100, kind: 'salient' }));
    // confidence: how much the strongest region stands out from the rest, capped well under certainty - this is not detection
    const conf = top.length ? Math.max(0.25, Math.min(0.6, 0.25 + (top[0].score - bar) * 1.5)) : 0.2;
    return { regions: top, method: 'colour-and-edge saliency (no face or object model)', confidence: Math.round(conf * 100) / 100 };
  }
  /** Where the photograph's subjects land on the stage under the current framing, and how much of each the words, panels and
   *  marks cover. Returns [{id, x, y, w, h, covered, by, confidence}] in stage pixels, or [] when there is no photograph. */
  function subjectCoverage(layout, images, boxes, W, H, subj) {
    if (!images || !images.bg || layout.noImagery) return [];
    const sj = subj || subjects(images.bg); if (!sj.regions.length) return [];
    const ib = layout.image && layout.image.w > 0 && layout.image.h > 0 ? { x: layout.image.x / 100 * W, y: layout.image.y / 100 * H, w: layout.image.w / 100 * W, h: layout.image.h / 100 * H } : { x: 0, y: 0, w: W, h: H };
    const t = coverTransform(images.bg.naturalWidth, images.bg.naturalHeight, ib, layout.imageFocus);
    const covers = (boxes || []).filter(b => !b.hidden && !b.empty && b.valid !== false && (b.type === 'text' || b.mark || (b.type === 'shape' && b.opacity >= 0.5 && b.role !== 'overlay')));
    return sj.regions.map(r => {
      const p0 = imageToCanvas(t, r.x, r.y), p1 = imageToCanvas(t, r.x + r.w, r.y + r.h);
      // the part of the subject that is inside the image box at all (the crop may cut it)
      const sx = Math.max(ib.x, p0.x), sy = Math.max(ib.y, p0.y), ex = Math.min(ib.x + ib.w, p1.x), ey = Math.min(ib.y + ib.h, p1.y);
      const vis = Math.max(0, ex - sx) * Math.max(0, ey - sy); const whole = (p1.x - p0.x) * (p1.y - p0.y);
      let cov = 0; const by = [];
      covers.forEach(b => { const iw = Math.min(ex, b.x + b.w) - Math.max(sx, b.x), ih = Math.min(ey, b.y + b.h) - Math.max(sy, b.y); if (iw > 0 && ih > 0) { cov += iw * ih; by.push(b.id); } });
      return { id: r.id, x: Math.round(sx), y: Math.round(sy), w: Math.round(Math.max(0, ex - sx)), h: Math.round(Math.max(0, ey - sy)), cropped: whole > 0 ? Math.round((1 - vis / whole) * 100) / 100 : 0, covered: vis > 0 ? Math.round(Math.min(1, cov / vis) * 100) / 100 : 0, by, confidence: sj.confidence, score: r.score };
    });
  }
  /** A framing (focus and zoom of the photograph) that keeps the likely subjects clear of the words and marks, without moving
   *  a layer: a small grid of focus points and two zooms is measured with the same transform; the best is offered, never applied.
   *  Returns null when there is no photograph or no subject to protect, or when nothing beats the current framing. */
  function frameSuggest(layout, copy, images, opts) {
    opts = opts || {}; if (!images || !images.bg || layout.noImagery) return null;
    const sj = subjects(images.bg); if (!sj.regions.length) return null;
    const { w: W, h: H } = stageSize(layout, opts.width); const boxes = measure(layout, copy, images, W, H);
    // what covers the subject and what the crop cuts off both count; a crop that loses more than half of a subject is no way to keep it clear
    const cost = focus => { const L2 = Object.assign({}, layout, { imageFocus: focus }); const cov = subjectCoverage(L2, images, boxes, W, H, sj); return cov.reduce((s, c) => s + (c.covered + c.cropped + (c.cropped > 0.5 ? 1 : 0)) * (c.score || 1), 0); };
    const cur = layout.imageFocus || { x: 50, y: 50, zoom: 1 }; const now = cost(cur);
    let best = null;
    [1, 1.25].forEach(zoom => [20, 35, 50, 65, 80].forEach(fy => [20, 35, 50, 65, 80].forEach(fx => { const f = { x: fx, y: fy, zoom }; const c = cost(f); const dist = Math.abs(fx - (cur.x == null ? 50 : cur.x)) + Math.abs(fy - (cur.y == null ? 50 : cur.y)) + Math.abs(zoom - (cur.zoom || 1)) * 40; if (!best || c < best.cost - 1e-6 || (Math.abs(c - best.cost) < 1e-6 && dist < best.dist)) best = { focus: f, cost: c, dist }; })));
    if (!best || best.cost >= now - 0.02) return { focus: null, before: now, after: now, subjects: sj, note: 'no framing on the grid keeps the subjects clearer than the current one; move the words instead' };
    return { focus: best.focus, before: Math.round(now * 100) / 100, after: Math.round(best.cost * 100) / 100, subjects: sj, note: 'focus ' + best.focus.x + ', ' + best.focus.y + ' at zoom ' + best.focus.zoom + ' keeps the likely subject' + (sj.regions.length === 1 ? '' : 's') + ' clearer of the words (confidence ' + Math.round(sj.confidence * 100) + '%: a saliency estimate, not detection)' };
  }
  /** Does the composition expect imagery that is not there? */
  function imageryMissing(layout, images) {
    if (layout.noImagery) return false;
    if (images && images.bg) return false;
    if (layout.v === 5) return (layout.regions || []).some(r => r.role === 'background');
    return !(layout.style === 'typographic' && !layout.image) && !!(layout.layers || []).length;
  }
  /** The whole technical validation at the output size: measured boxes, contrast, fonts, assets, and the issues by layer. */
  function validate(layout, copy, images, opts) {
    opts = opts || {}; layout = layout || {}; copy = copy || {}; images = images || {};
    const { w: W, h: H } = stageSize(layout, opts.width);
    const boxes = measure(layout, copy, images, W, H);
    // an analysis that could not run (pixels unreadable: a tainted canvas, a blocked getImageData) is an unresolved state the rules
    // report, never a quiet pass; an analysis the caller switched off is not unresolved, it was not asked for
    const unresolved = [];
    const contrasted = opts.contrast === false ? false : contrastOf(layout, copy, images, boxes, W, H);
    if (opts.contrast !== false && contrasted === false) unresolved.push('contrast');
    // the marks, per pixel (contract 2); switched off with the contrast pass, since both read the pixels
    if (opts.contrast !== false && markReadability(layout, copy, images, boxes, W, H) === false) unresolved.push('mark readability');
    if (opts.occlusion !== false && occlusionOf(layout, copy, images, boxes, W, H) === false) unresolved.push('occlusion');
    const missing = imageryMissing(layout, images);
    // the photograph's likely subjects under this framing, and what covers them: an estimate with a confidence, a warning at most
    let subj = []; if (opts.subjects !== false) { try { subj = subjectCoverage(layout, images, boxes, W, H); } catch (e) { subj = []; } }
    const issues = layoutRules(boxes, { W, H, format: opts.format || layout.format, channel: opts.channel, production: opts.production !== false, fonts: opts.fonts, imageryMissing: missing, unresolved, subjects: subj });
    return { renderer: RENDERER, contract: CONTRACT, W, H, ok: !issues.some(i => i.severity === 'blocking'), issues, boxes, fonts: opts.fonts || null, contrast: contrasted, unresolved: unresolved.length ? unresolved : undefined, subjects: subj.length ? subj : undefined, imageryMissing: missing, production: opts.production !== false, at: Date.now() };
  }
  /** The state of a validation in four words a designer can act on, with the technical, assessment and approval parts kept apart:
   *  blocked (required corrections remain), review (warnings or unmeasured checks remain), passed (every applicable check passed).
   *  Approval is a person's and is added by the page from the asset's record, never here. */
  function qualityOf(val) {
    if (!val) return { state: 'unknown', word: 'Not measured', blocking: 0, warnings: 0, unresolved: 0, top: null };
    const blocking = val.issues.filter(i => i.severity === 'blocking'), warnings = val.issues.filter(i => i.severity === 'warning');
    const unresolved = (val.unresolved || []).length;
    const state = blocking.length ? 'blocked' : (warnings.length || unresolved) ? 'review' : 'passed';
    return { state, word: state === 'blocked' ? 'Blocked' : state === 'review' ? 'Needs review' : 'Checks passed', blocking: blocking.length, warnings: warnings.length, unresolved, top: blocking[0] || warnings[0] || null };
  }

  /* ---------------------------------------------------------------- repair: the smallest geometric correction, never the words */
  const LAYOUT_CODES = { text_overflow: 1, collision: 1, off_canvas: 1, safe_area: 1, text_too_wide: 1 };
  const MIN_SIZE = { headline: 3.2, support: 2.4, cta: 2.2 };
  /* a mark's readability as one comparable score: the share of its ink that reads, then the worst local contrast */
  const inkScore = b => (b && typeof b.inkLost === 'number') ? (1 - b.inkLost) * 10 + Math.min(10, b.inkLocal || 0) / 10 : (b && typeof b.contrast === 'number' ? Math.min(10, b.contrast) / 10 : 0);
  const markBad = i => /^mark_(unreadable|low_contrast)$/.test(i.code);
  function swapMarks(L, copy, images, opts, byId, steps) {
    const v0 = validate(L, copy, images, opts);
    v0.boxes.filter(b => b.mark && v0.issues.some(i => markBad(i) && i.layers.indexOf(b.id) >= 0)).forEach(b => {
      const l = byId[b.id]; const vars = (opts.variants || {})[b.id] || []; if (!l || l.locked || l.hidden || !vars.length) return;
      let best = null; vars.forEach(vr => { if (!vr.img) return; const imgs = Object.assign({}, images, { [b.id]: vr.img }); const t = validate(Object.assign({}, L, { layers: L.layers.map(x => x === l ? Object.assign({}, l, { src: vr.src }) : x) }), copy, imgs, opts); const tb = t.boxes.find(x => x.id === b.id); const s = inkScore(tb); if (tb && (!best || s > best.s)) best = { vr, s, b: tb, clear: !t.issues.some(i => markBad(i) && i.layers.indexOf(b.id) >= 0) }; });
      // the variant that reads best, taken only when it reads materially better than the one in place
      if (best && best.vr.src !== l.src && best.s > inkScore(b) + 0.4) { l.src = best.vr.src; l.variant = best.vr.variant; images[b.id] = best.vr.img; steps.push('switched the ' + l.role + ' to its approved ' + best.vr.variant + ' variant (' + Math.round((b.inkLost || 0) * 100) + '% of its strokes lost before, ' + Math.round((best.b.inkLost || 0) * 100) + '% after' + (best.clear ? '' : '; still not fully readable') + ')'); }
    });
  }
  /** Only the marks: each approved variant is measured against what is actually behind the mark and the best one is taken.
   *  Nothing else moves; the mark is never redrawn or recoloured, only exchanged for another approved file. */
  function markVariants(layout0, copy, images, opts) {
    opts = opts || {}; const L = JSON.parse(JSON.stringify(layout0 || {})); const byId = {}; (L.layers || []).forEach((l, i) => { byId[String(l.id || ('layer' + i))] = l; });
    const steps = []; const imgs = Object.assign({}, images || {}); if (opts.variants && !(opts.locks && opts.locks.layout)) swapMarks(L, copy || {}, imgs, opts, byId, steps);
    return { layout: L, changed: steps.length > 0, steps, images: imgs };
  }
  const PENDING_CODES = { imagery_missing: 1, mark_unloaded: 1, imagery_sketch: 1, pixels_unmeasured: 1, mark_unmeasured: 1 };
  /** Repair, with its completion judged on the complete final validation (never on the geometry checks alone). The result says
   *  what it did (steps), what the tile measured before and after, and what remains by kind - geometry, readability (words or
   *  marks), brand constraints (clear space, placement region, size, a mark not on file), pending matters no layout can fix
   *  (imagery not made, a mark not loaded), and checks that could not be measured - so a defect the engine cannot solve is named
   *  as remaining, never folded into "fixed". outcome: complete (nothing blocking remains), partial (fewer or different
   *  blockers remain), blocked (it changed nothing or nothing improved while blockers remain), nothing (there was nothing to fix). */
  function repair(layout0, copy, images, opts) {
    opts = opts || {}; copy = copy || {}; images = images || {};
    const L = JSON.parse(JSON.stringify(layout0 || {})); const { w: W, h: H } = stageSize(L, opts.width);
    const vopts = Object.assign({}, opts, { contrast: false });
    const before = validate(layout0, copy, images, opts);
    const layoutIssues = r => r.issues.filter(i => LAYOUT_CODES[i.code] && i.severity === 'blocking');
    const blockingOf = r => r.issues.filter(i => i.severity === 'blocking');
    const codesOf = r => blockingOf(r).map(i => i.code + ':' + i.layers.join(',')).sort().join('|');
    const steps = [];
    const result = (conflict) => {
      const after = validate(L, copy, images, opts); const changed = JSON.stringify(L) !== JSON.stringify(layout0);
      const blk = blockingOf(after); const b0 = blockingOf(before);
      const kinds = { geometry: blk.filter(i => LAYOUT_CODES[i.code]).length, readability: blk.filter(i => /contrast|^mark_unreadable$|^occluded$|^invisible$/.test(i.code)).length, brand: blk.filter(i => /^mark_(clear_space|outside_region|small|missing)$/.test(i.code)).length, pending: blk.filter(i => PENDING_CODES[i.code]).length };
      kinds.other = blk.length - kinds.geometry - kinds.readability - kinds.brand - kinds.pending;
      const outcome = !changed ? (before.ok ? 'nothing' : 'blocked') : after.ok ? 'complete' : (blk.length < b0.length || codesOf(after) !== codesOf(before)) ? 'partial' : 'blocked';
      return { layout: L, changed, steps, before, after, ok: after.ok, outcome, counts: { before: b0.length, after: blk.length }, kinds, remaining: { blocking: blk, warnings: after.issues.filter(i => i.severity === 'warning'), unresolved: after.unresolved || [] }, conflict: conflict || (blk.length ? 'unresolved' : '') };
    };
    if (opts.locks && opts.locks.layout) return Object.assign(result('The layout is locked on this asset; unlock it to let the Studio move anything.'), { layout: layout0, changed: false });
    // unreadable words are always fixed; merely low contrast only when the person asked (opts.fixContrast), since a deliberate
    // brand colour (a gold kicker) may sit just under the bar and is not the repair's to change on its own
    const contrastIssues = r => r.issues.filter(i => i.code === 'unreadable_contrast' || (i.code === 'patchy_contrast' && i.severity === 'blocking') || (opts.fixContrast && (i.code === 'low_contrast' || i.code === 'patchy_contrast')));
    // a mark that does not read, or breaks its clear space or placement region: blocking findings always, warnings when asked
    const markIssues = r => r.issues.filter(i => (markBad(i) || i.code === 'mark_clear_space' || i.code === 'mark_outside_region') && (i.severity === 'blocking' || opts.fixContrast));
    if (!layoutIssues(before).length && !contrastIssues(before).length && !markIssues(before).length && !opts.variants) return Object.assign(result(''), { layout: layout0, changed: false });
    const layers = L.layers || []; const byId = {}; layers.forEach((l, i) => { byId[String(l.id || ('layer' + i))] = l; });
    const movable = l => l && !l.locked && !l.hidden;
    const sa0 = safeAreaOf(opts.format || L.format, opts.channel); const story = sa0.hard; const sp = { top: sa0.top * 100 + (story ? 0 : 0.2), bottom: sa0.bottom * 100 + (story ? 0 : 0.2), side: sa0.side * 100 + (story ? 0 : 0.2) };
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
    // 4. move a mark (or the CTA) off the words, only where nothing holds the mark: a mandatory campaign rule and an
    //    observed placement both hold it (the words move instead, in 2 and 5), and the step says so
    const markHeld = mk => (mk && mk.rule && mk.rule.mandatory) ? 'the approved placement rule' + (mk.rule.note ? ' (' + mk.rule.note + ')' : '') : (L.markPlacement && L.markPlacement.basis === 'rule') ? 'the approved placement rule' + (L.markPlacement.text ? ' (' + L.markPlacement.text + ')' : '') : (L.markPlacement && L.markPlacement.basis === 'observed') ? 'the approved references (' + (L.markPlacement.text || 'observed') + ')' : '';
    if (layoutIssues(now).some(i => i.code === 'collision' && i.layers.some(id => isMark(byId[id])))) {
      layoutIssues(now).filter(i => i.code === 'collision').forEach(i => {
        const mk = i.layers.map(id => byId[id]).find(isMark); if (!mk || !movable(mk)) return;
        const held = markHeld(mk); if (held) { steps.push('left the ' + mk.role + ' where ' + held + ' puts it; the words must move instead'); return; }
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
    /* a mark that does not read, or sits too close to the words, or outside its permitted region: the smallest local
       correction, in this order - (1) another place inside its permitted region (the rule's region, else its own corner's
       neighbourhood: a nudge, never a jump to another corner), measured per pixel at each candidate; (2) the approved variant that
       reads best against what is actually behind it (after the placement, so a mark that can simply move keeps its file); (3) if
       the mark is held by a mandatory corner rule, or no place reads, an editable supporting panel beneath it is extended to carry
       it (never a new box, shadow, outline or recolour: those are not the Studio's to add); (4) otherwise the conflict is named for
       a person to decide (the layout variations are measured alternatives) */
    const placeMark = (mk) => {
      const now0 = validate(L, copy, images, opts); const b0 = now0.boxes.find(x => x.id === String(mk.id)); if (!b0 || b0.asset !== 'loaded') return false;
      const rule = mk.rule || {}; const heldCorner = !!(rule.mandatory && rule.corner && !rule.region);
      const bar = b => b && typeof b.inkLost === 'number' && b.inkLost < 0.04 && (b.inkRun || 0) < 2 / 12 && (b.inkWeak || 0) < 0.3;
      const clean = (L2, id) => { const bx = measure(L2, copy, images, W, H); const iss = layoutRules(bx, { W, H, format: opts.format || L2.format, channel: opts.channel, production: true }); return !iss.some(i => i.severity === 'blocking' && i.layers.indexOf(id) >= 0 && !markBad(i) && i.code !== 'mark_unmeasured'); };
      const tryAt = (x, y) => { const L2 = Object.assign({}, L, { layers: L.layers.map(l => l === mk ? Object.assign({}, l, { x: r1(x), y: r1(y) }) : l) }); if (!clean(L2, String(mk.id))) return null; const bx = measure(L2, copy, images, W, H); const b = bx.find(z => z.id === String(mk.id)); if (markReadability(L2, copy, images, bx, W, H, { only: String(mk.id) }) === false) return null; return { L2, b, reads: bar(b) }; };
      if (!heldCorner && movable(mk)) {
        const reg = rule.region && typeof rule.region === 'object' ? rule.region : null;
        const cands = [];
        if (reg) { const xs = [], ys = []; for (let x = reg.x; x <= reg.x + reg.w - mk.w + 0.01; x += Math.max(1, (reg.w - mk.w) / 4)) xs.push(x); for (let y = reg.y; y <= reg.y + reg.h - (mk.h || 0) + 0.01; y += 1) ys.push(y); xs.forEach(x => ys.forEach(y => cands.push([x, y]))); if (!cands.length) cands.push([reg.x, reg.y]); }
        else { for (let dy = 0; dy <= 12; dy++) for (const sy of (dy ? [1, -1] : [1])) for (const dx of [0, 2, -2, 4, -4, 6, -6]) { const x = Math.min(100 - sp.side - mk.w, Math.max(sp.side, mk.x + dx)), y = Math.min(100 - sp.bottom - (mk.h || 0), Math.max(sp.top, mk.y + dy * sy)); cands.push([x, y]); } }
        const seen = new Set(); const uniq = cands.filter(([x, y]) => { const k = r1(x) + ':' + r1(y); if (seen.has(k)) return false; seen.add(k); return true; });
        uniq.sort((p, q) => (Math.abs(p[0] - mk.x) + Math.abs(p[1] - mk.y)) - (Math.abs(q[0] - mk.x) + Math.abs(q[1] - mk.y)));
        let tried = 0, best = null;
        for (const [x, y] of uniq) { if (tried >= 28) break; const t = tryAt(x, y); if (!t) continue; tried++; if (t.reads) { best = Object.assign({ x, y }, t); break; } if (!best || (t.b.inkLost || 1) < (best.b.inkLost || 1) - 0.1) best = Object.assign({ x, y, partial: true }, t); }
        if (best && (best.reads || (best.partial && best.b.inkLost <= (b0.inkLost || 0) * 0.5))) {
          const dxp = r1(best.x - mk.x), dyp = r1(best.y - mk.y); mk.x = r1(best.x); mk.y = r1(best.y);
          steps.push('moved the ' + mk.role + ' ' + (dyp ? Math.abs(dyp) + '% ' + (dyp > 0 ? 'down' : 'up') : '') + (dxp ? (dyp ? ' and ' : '') + Math.abs(dxp) + '% ' + (dxp > 0 ? 'right' : 'left') : '') + (reg ? ' inside its placement region' : ' within its corner') + ' so ' + (best.reads ? 'every stroke reads' : 'more of it reads') + ' (' + Math.round((b0.inkLost || 0) * 100) + '% of its strokes lost before, ' + Math.round((best.b.inkLost || 0) * 100) + '% after)');
          return best.reads;
        }
      }
      // a supporting panel beneath the mark, editable and not locked, extended to carry the mark and its clear space
      const idx = L.layers.indexOf(mk); const panel = L.layers.slice(0, idx).filter(s => s.type === 'shape' && !s.gradient && (s.role === 'panel' || s.role === 'overlay' || s.role === 'footer' || s.role === 'band') && movable(s) && s.shape !== 'circle' && s.shape !== 'rule').filter(s => Math.min(s.x + s.w, mk.x + mk.w) - Math.max(s.x, mk.x) > 0.5 && (Math.min(s.y + (s.h || 0), mk.y + (mk.h || 0)) - Math.max(s.y, mk.y) > -8)).sort((p, q) => Math.abs(p.y - mk.y) - Math.abs(q.y - mk.y))[0];
      if (panel) {
        const clear = pY(b0.clearWant || 0); const top = Math.min(panel.y, (b0.y / H * 100) - clear), bottom = Math.max(panel.y + (panel.h || 0), (b0.y + b0.h) / H * 100 + clear);
        const L2 = Object.assign({}, L, { layers: L.layers.map(l => l === panel ? Object.assign({}, l, { y: r1(Math.max(0, top)), h: r1(Math.min(100, bottom) - Math.max(0, top)) }) : l) });
        const bx = measure(L2, copy, images, W, H); const b = bx.find(z => z.id === String(mk.id)); markReadability(L2, copy, images, bx, W, H, { only: String(mk.id) });
        if (bar(b)) { panel.y = r1(Math.max(0, top)); panel.h = r1(Math.min(100, bottom) - Math.max(0, top)); steps.push('extended the ' + (panel.role || 'panel') + ' ' + panel.id + ' to carry the ' + mk.role + (heldCorner ? ' (the mark itself is held by the campaign rule)' : '') + ': every stroke reads now'); return true; }
      }
      return false;
    };
    // every mark a finding names, at any severity: a blocking one (or any, with fixContrast) is moved; a weak one with approved
    // variants on offer still takes the variant that reads better where it stands
    const markNamed = r => r.issues.filter(i => markBad(i) || i.code === 'mark_clear_space' || i.code === 'mark_outside_region');
    const markIds = Array.from(new Set(markNamed(validate(L, copy, images, opts)).reduce((acc, i) => acc.concat(i.layers.filter(id => isMark(byId[id]))), [])));
    markIds.forEach(id => { const mk = byId[id]; if (!mk || mk.hidden || mk.locked) return;
      const still = any => markNamed(validate(L, copy, images, opts)).some(i => i.layers.indexOf(id) >= 0 && (any || i.severity === 'blocking' || opts.fixContrast));
      let placed = false;
      if (still()) { placed = placeMark(mk); if (placed && !still(true)) return; }
      // (2) the approved variants, measured where the mark now stands; then (3) the panel beneath it, once more, for the chosen variant
      if (opts.variants) { const n0 = steps.length; swapMarks(L, copy, images, opts, byId, steps); if (!still(true)) return; if (steps.length > n0 && still() && placeMark(mk) && !still()) return; }
      if (still() && !placed) steps.push('could not make the ' + mk.role + ' read by moving it' + ((mk.rule && mk.rule.mandatory && mk.rule.corner && !mk.rule.region) ? ' (held ' + mk.rule.corner + ' by the campaign rule)' : '') + (opts.variants ? ', by an approved variant' : '') + ' or by extending a panel beneath it; no box, shadow or recolour is added to a mark'); });
    // words that do not read against what is behind them: first the colour (white or near-black, whichever reads), then, only
    // if neither is enough, a backing plate behind the same words - the words, their size and their place are not touched
    // each layer once (a low-contrast and a patchy finding may name the same words), and only while it still fails to read
    Array.from(new Set(contrastIssues(validate(L, copy, images, opts)).reduce((acc, iss) => acc.concat(iss.layers), []))).forEach(id => {
      const l = byId[id]; if (!movable(l) || l.type !== 'text') return;
      const read = (patch) => { const t = validate(Object.assign({}, L, { layers: L.layers.map(x => x === l ? Object.assign({}, l, patch) : x) }), copy, images, opts); const tb = t.boxes.find(x => x.id === id); return { c: tb && typeof tb.contrast === 'number' ? tb.contrast : 0, clear: !contrastIssues(t).some(i => i.layers.indexOf(id) >= 0), ch: tb ? tb.contentH : 0, ovf: !!(tb && tb.overflowH) }; };
      const v1 = validate(L, copy, images, opts); if (!contrastIssues(v1).some(i => i.layers.indexOf(id) >= 0)) return;
      const was = (v1.boxes.find(x => x.id === id) || {}).contrast || 0;
      const colours = ['#FFFFFF', '#111111'].filter(c => String(l.color || '').toUpperCase() !== c);
      let best = null; colours.forEach(c => { const r = read({ color: c }); if (!best || (r.clear && !best.clear) || (r.clear === best.clear && r.c > best.c)) best = Object.assign({ patch: { color: c } }, r); });
      // a plate at 72% first; over a ground that is uneven under the words (a patchy finding) a denser plate, still translucent, still the same words
      if (!(best && best.clear)) { const light = !best || best.patch.color === '#FFFFFF'; const plates = light ? ['rgba(10,14,22,0.72)', 'rgba(10,14,22,0.92)'] : ['rgba(255,255,255,0.86)', 'rgba(255,255,255,0.96)']; for (const bg of plates) { const patch = { color: light ? '#FFFFFF' : '#111111', bg }; const r = read(patch); if (!best || r.c > best.c || (r.clear && !best.clear)) best = Object.assign({ patch }, r); if (best.clear) break; } }
      // a plate adds padding around the same words: the box grows to hold it, the words, their size and their place unchanged
      if (best && best.c > was + 0.3) { Object.assign(l, best.patch); if (best.patch.bg && best.ovf && best.ch) l.h = Math.round((best.ch / H * 100 + 0.2) * 10) / 10; steps.push((best.patch.bg ? 'put a backing plate behind' : 'changed the colour of') + ' the ' + (l.role || 'text') + ' ' + id + ' so it reads (contrast ' + was.toFixed(2) + ' to ' + best.c.toFixed(2) + ':1)'); }
    });
    const fin = validate(L, copy, images, opts); const leftAll = blockingOf(fin).filter(i => !PENDING_CODES[i.code]);
    if (leftAll.length) {
      const locked = leftAll.reduce((a, i) => a.concat(i.layers.filter(id => byId[id] && byId[id].locked)), []);
      const heldMark = leftAll.filter(i => i.code === 'collision' || markBad(i) || i.code === 'mark_clear_space').map(i => i.layers.map(id => byId[id]).find(mk => isMark(mk) && markHeld(mk))).find(Boolean);
      const g = geo(); const longest = Object.keys(g).map(k => g[k]).filter(b => b.type === 'text' && b.chars).sort((a, b) => b.contentH - a.contentH)[0];
      const textLeft = leftAll.some(i => i.layers.some(id => byId[id] && byId[id].type === 'text' && (i.code === 'text_overflow' || i.code === 'text_too_wide' || i.code === 'collision')));
      const markLeft = leftAll.filter(i => markBad(i) || i.code === 'mark_clear_space' || i.code === 'mark_outside_region');
      const readLeft = leftAll.filter(i => /contrast/.test(i.code) && !markBad(i));
      const what = leftAll.map(i => i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')).join('; ');
      return result(locked.length ? 'Locked layers stop the fix: ' + Array.from(new Set(locked)).join(', ') + ' (' + what + '). Unlock them, or decide what may move.'
        : heldMark ? 'The ' + heldMark.role + ' is held by ' + markHeld(heldMark) + ' and ' + (markLeft.length ? 'does not read where the rule puts it' : 'the words still run into it') + ' (' + what + '); no approved variant reads better and no panel beneath it could be extended. Decide: relax the rule for this tile, move the panel by hand, or choose another layout.'
        : markLeft.length ? 'The ' + markLeft.map(i => (byId[i.layers[0]] || {}).role || 'mark').filter((v, k, a) => a.indexOf(v) === k).join(' and ') + ' still does not read or sit within its constraints (' + what + '): no nearby place, approved variant or supporting panel clears it, and the Studio adds no box, shadow or recolour to a mark. Choose a layout variation, move it by hand, or revise the ground.'
        : textLeft ? 'Geometry alone cannot fit the words without going under the readable minimum (' + what + ').' + (longest ? ' Shorter copy for the ' + (longest.role || 'text') + ' (about ' + Math.max(10, Math.round(longest.chars * 0.75)) + ' characters instead of ' + longest.chars + ') would fit; the Studio does not cut words on its own.' : '')
        : readLeft.length ? 'Words still do not read against what is behind them (' + what + ') and neither a colour nor a plate was enough or allowed; revise the ground or move the words.'
        : 'The layout still has ' + what + ' and no move within the rules clears it; decide what may move.');
    }
    return result('');
  }
  /* ---------------------------------------------------------------- variations: the same words, marks and imagery arranged other ways, measured before they are offered */
  const ROLE_ORDER = ['kicker', 'label', 'myth', 'fact', 'headline', 'support', 'free', 'caption', 'cta'];
  const r1 = n => Math.round(n * 10) / 10;
  /** Up to nine arrangements of a composition: bands, columns, cards, a centred statement, a fade, and (when allowed) type only.
   *  The words are never changed; only where they sit, their size within the readable minimum, their colour against the new
   *  ground, and the panel behind them. Each is laid out by measurement, repaired if it needs it, and validated; the result says
   *  whether it passes, what still blocks it, and what is pending that no layout can fix (imagery not made yet, a mark not loaded). */
  function variants(layout0, copy, images, opts) {
    opts = opts || {}; copy = copy || {}; images = images || {};
    const L0 = layout0 || {}; if (opts.locks && opts.locks.layout) return [];
    const fmt = opts.format || L0.format || '1:1'; const { w: W, h: H } = stageSize(L0, opts.width);
    const story = fmt === '9:16'; const wide = fmt === '16:9';
    // the story interface from the one safe-area table; a feed variation keeps a design margin wider than the 3% minimum
    const sa0 = safeAreaOf(fmt, 'instagram'); const sp = story ? { top: sa0.top * 100, bottom: sa0.bottom * 100, side: sa0.side * 100 } : { top: 5, bottom: 5, side: 5.5 };
    const layers0 = L0.layers || [];
    const texts0 = layers0.filter(l => l.type === 'text' && !l.hidden && displayedText(L0, l, copy));
    if (!texts0.length) return [];
    const order = l => { const i = ROLE_ORDER.indexOf(l.role); return (i < 0 ? 4.5 : i) * 1000 + (l.y || 0); };
    const panel0 = layers0.find(l => l.type === 'shape' && (l.role === 'panel') && typeof l.fill === 'string' && /^#[0-9a-f]{6}$/i.test(l.fill));
    const accent = (panel0 && panel0.fill) || (L0.palette && L0.palette.primary) || '#0E6A6E';
    const observed = L0.markPlacement && (L0.markPlacement.basis === 'observed' || L0.markPlacement.basis === 'rule') ? L0.markPlacement.corner : '';
    const heldMark = l => isMark(l) && ((l.rule && l.rule.mandatory) || (L0.markPlacement && L0.markPlacement.basis === 'rule'));
    const sigOf = L => (L.layers || []).filter(l => l.type === 'text').map(l => [l.id, Math.round(l.x), Math.round(l.y), Math.round(l.w)].join(':')).sort().join('|');
    const current = sigOf(L0);
    const recipes = [
      { id: 'band-foot', name: 'Band across the foot', panel: 'band', zone: { x: sp.side, y: 50, w: 100 - 2 * sp.side, h: 50 - sp.bottom }, anchor: 'bottom' },
      { id: 'band-head', name: 'Band across the top', panel: 'band', zone: { x: sp.side, y: sp.top, w: 100 - 2 * sp.side, h: 50 - sp.top }, anchor: 'top' },
      { id: 'col-left', name: 'Words in a column on the left', panel: 'column', zone: { x: sp.side, y: sp.top, w: (wide ? 44 : 52) - sp.side - 2, h: 100 - sp.top - sp.bottom }, anchor: 'middle', colW: wide ? 44 : 52 },
      { id: 'col-right', name: 'Words in a column on the right', panel: 'column', right: true, zone: { x: (wide ? 56 : 48) + 2, y: sp.top, w: (wide ? 44 : 52) - sp.side - 2, h: 100 - sp.top - sp.bottom }, anchor: 'middle', colW: wide ? 44 : 52 },
      { id: 'card-low', name: 'Card, lower left', panel: 'card', zone: { x: sp.side, y: 40, w: wide ? 52 : 72, h: 60 - sp.bottom }, anchor: 'bottom' },
      { id: 'card-high', name: 'Card, upper left', panel: 'card', zone: { x: sp.side, y: sp.top, w: wide ? 52 : 72, h: 56 - sp.top }, anchor: 'top' },
      { id: 'centre', name: 'Centred statement over a shade', panel: 'scrim', align: 'center', zone: { x: 10, y: sp.top + 4, w: 80, h: 100 - sp.top - sp.bottom - 8 }, anchor: 'middle' },
      { id: 'fade', name: 'Words over a fade from the foot', panel: 'fade', zone: { x: sp.side, y: 45, w: wide ? 60 : 100 - 2 * sp.side, h: 55 - sp.bottom }, anchor: 'bottom' },
    ];
    if (opts.allowNoImagery !== false) recipes.push({ id: 'type-only', name: 'Type only, no photograph', panel: 'none', typeOnly: true, zone: { x: sp.side + 2, y: sp.top + 4, w: 100 - 2 * sp.side - 4, h: 100 - sp.top - sp.bottom - 8 }, anchor: 'middle', grow: 1.25 });
    const out = [];
    recipes.forEach(r => {
      const L = JSON.parse(JSON.stringify(L0)); const byId = {}; (L.layers || []).forEach(l => { byId[String(l.id)] = l; });
      const keepImgs = r.typeOnly ? [] : L.layers.filter(l => l.type === 'img' && !isMark(l));
      const lockedShapes = L.layers.filter(l => l.type === 'shape' && l.locked);
      const marks = L.layers.filter(l => isMark(l) && !l.hidden);
      const T = texts0.slice().sort((a, b) => order(a) - order(b)).map(t => byId[String(t.id)]).filter(Boolean);
      const lockedText = T.filter(l => l.locked); const moving = T.filter(l => !l.locked);
      if (!moving.length) return;
      if (r.typeOnly) { L.noImagery = true; L.regions = []; L.bg = accent; L.image = null; if (L.v !== 5) { L.style = 'typographic'; L.template = L.template || 'plain'; } }
      const zone = Object.assign({}, r.zone); const pad = r.panel === 'band' || r.panel === 'column' || r.panel === 'card' ? 3 : 0;
      // a band or a fade at the foot is where the mark reads best (its own ground, not the photograph's sky): the words leave it room on
      // the preferred side, so the mark sits on the band rather than being pushed to a top corner over whatever the picture shows there
      const freeMarks = marks.filter(mk => !mk.locked && !heldMark(mk));
      if ((r.panel === 'band' || r.panel === 'fade') && r.anchor === 'bottom' && freeMarks.length && zone.w > 55) { const lw = (freeMarks[0].w || 17) + 3; if (observed === 'bl' || observed === 'tl') zone.x += lw; zone.w -= lw; }
      const kz = Math.max(0.7, Math.min(1.15, zone.w / (100 - 2 * sp.side))) * (r.grow || 1) * (story ? 1.12 : 1);
      moving.forEach(l => {
        const o = texts0.find(t => t.id === l.id) || l;
        l.rotate = 0; l.opacity = 1; l.align = r.align || 'left'; delete l.group;
        if (!l.bg) l.color = '#FFFFFF';
        l.size = Math.max(MIN_SIZE[l.role] || 2.2, Math.round(o.size * (l.role === 'headline' || l.role === 'myth' || l.role === 'fact' ? kz : Math.min(1, kz)) * 100) / 100);
      });
      // lay the column out by measurement, stepping the type down (never under the readable minimum) until it fits the zone
      let total = 0;
      for (let attempt = 0; attempt < 10; attempt++) {
        moving.forEach(l => { l.x = r1(zone.x + pad); l.w = r1(zone.w - pad * 2); l.y = 0; l.h = 60; });
        const g = {}; measure(L, copy, images, W, H).forEach(b => { g[b.id] = b; });
        let cur = 0; let tooWide = false;
        moving.forEach((l, i) => {
          const b = g[String(l.id)]; const hh = b && b.contentH ? b.contentH / H * 100 + 0.3 : l.size * 1.3 * W / H;
          if (b && b.overflowW) tooWide = true;
          l.y = cur; l.h = r1(hh); cur += hh;
          const nx = moving[i + 1]; if (nx) cur += Math.max(1.2, (l.size / 100 * W) * (nx.role === 'cta' ? 0.9 : 0.5) / H * 100);
        });
        total = cur;
        const fits = total <= zone.h - pad * 2 && !tooWide;
        if (fits) break;
        if (moving.every(l => l.size * 0.92 < (MIN_SIZE[l.role] || 2.2))) break;
        moving.forEach(l => { const m = MIN_SIZE[l.role] || 2.2; if (l.size * 0.92 >= m) l.size = Math.round(l.size * 0.92 * 100) / 100; });
      }
      const top = r.anchor === 'top' ? zone.y + pad : r.anchor === 'bottom' ? zone.y + zone.h - pad - total : zone.y + Math.max(0, (zone.h - total) / 2);
      moving.forEach(l => { l.y = r1(l.y + top); });
      // a one-line chip (a label or a CTA on its own plate) keeps its natural width when the column is centred, instead of
      // the plate running the width of the column
      if (r.align === 'center') {
        const chips = moving.filter(l => l.bg); chips.forEach(l => { l.align = 'left'; });
        const g = {}; measure(L, copy, images, W, H).forEach(b => { g[b.id] = b; });
        chips.forEach(l => { const b = g[String(l.id)]; l.align = 'center'; if (!b || b.lines !== 1 || !b.w) return; const nw = Math.min(l.w, b.w / W * 100 + 0.6); l.x = r1(zone.x + (zone.w - nw) / 2); l.w = r1(nw); });
      }
      const sTop = top - pad, sBot = top + total + pad;
      // the ground the words sit on
      const shapes = [];
      if (r.panel === 'band') shapes.push({ id: 'v-panel', type: 'shape', role: 'panel', shape: 'rect', x: 0, w: 100, y: r.anchor === 'bottom' ? r1(Math.max(0, sTop - 1)) : 0, h: r.anchor === 'bottom' ? r1(100 - Math.max(0, sTop - 1)) : r1(Math.min(100, sBot + 1)), fill: accent, opacity: 0.94, radius: 0 });
      if (r.panel === 'column') shapes.push({ id: 'v-panel', type: 'shape', role: 'panel', shape: 'rect', x: r.right ? 100 - r.colW : 0, y: 0, w: r.colW, h: 100, fill: accent, opacity: 0.94, radius: 0 });
      if (r.panel === 'card') shapes.push({ id: 'v-panel', type: 'shape', role: 'panel', shape: 'rect', x: r1(zone.x), y: r1(sTop), w: r1(zone.w), h: r1(sBot - sTop), fill: accent, opacity: 0.94 });
      if (r.panel === 'scrim') shapes.push({ id: 'v-panel', type: 'shape', role: 'overlay', shape: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'rgba(8,12,18,0.55)', radius: 0 });
      if (r.panel === 'fade') shapes.push({ id: 'v-panel', type: 'shape', role: 'overlay', shape: 'rect', gradient: true, dir: 'up', x: 0, y: r1(Math.max(0, sTop - 18)), w: 100, h: r1(100 - Math.max(0, sTop - 18)), fill: 'rgba(8,12,18,0.82)', radius: 0 });
      // the marks go to a corner clear of the words (the observed corner first), unless locked
      const occupied = { x: zone.x, y: sTop, w: zone.w, h: sBot - sTop };
      marks.filter(mk => !mk.locked && !heldMark(mk)).forEach(mk => {
        const lh = mk.h || 6; const lw = mk.w || 17;
        const C = { tl: [sp.side, sp.top], tr: [100 - sp.side - lw, sp.top], bl: [sp.side, 100 - sp.bottom - lh], br: [100 - sp.side - lw, 100 - sp.bottom - lh] };
        const pref = [observed, 'br', 'bl', 'tr', 'tl'].filter((c, i, a) => c && a.indexOf(c) === i);
        const clear = c => { const [x, y] = C[c]; return Math.min(x + lw, occupied.x + occupied.w) - Math.max(x, occupied.x) <= 0.5 || Math.min(y + lh, occupied.y + occupied.h) - Math.max(y, occupied.y) <= 0.5; };
        const clearC = pref.filter(clear); const pick = clearC[0] || pref[0]; mk.x = r1(C[pick][0]); mk.y = r1(C[pick][1]);
        mk._cands = clearC;   // the clear corners, read per pixel once the ground (the shapes) is in place
      });
      const textIds = new Set(T.map(l => String(l.id)));
      L.layers = keepImgs.concat(lockedShapes, shapes, L.layers.filter(l => l.type === 'text' && textIds.has(String(l.id))), L.layers.filter(l => l.type === 'text' && !textIds.has(String(l.id))), marks.concat(L.layers.filter(l => isMark(l) && l.hidden)));
      void lockedText;
      const vopts = Object.assign({}, opts, { production: true });
      // the mark's corner is chosen by what reads: among the clear corners, the first (in the preferred order) where every stroke reads
      // against the ground actually there, measured per pixel; the preferred corner stays when none reads (the repair below then tries)
      marks.filter(mk => Array.isArray(mk._cands)).forEach(mk => {
        const cands = mk._cands; delete mk._cands; if (cands.length < 2) return;
        const lh = mk.h || 6; const lw = mk.w || 17; const C = { tl: [sp.side, sp.top], tr: [100 - sp.side - lw, sp.top], bl: [sp.side, 100 - sp.bottom - lh], br: [100 - sp.side - lw, 100 - sp.bottom - lh] };
        const reads = c => { const L2 = Object.assign({}, L, { layers: L.layers.map(l => l === mk ? Object.assign({}, mk, { x: r1(C[c][0]), y: r1(C[c][1]) }) : l) }); const bx = measure(L2, copy, images, W, H); if (markReadability(L2, copy, images, bx, W, H, { only: String(mk.id) }) === false) return false; const b = bx.find(z => z.id === String(mk.id)); return !!(b && typeof b.inkLost === 'number' && b.inkLost < 0.04 && (b.inkRun || 0) < 2 / 12); };
        const good = cands.find(reads); if (good) { mk.x = r1(C[good][0]); mk.y = r1(C[good][1]); }
      });
      // measure; repair what geometry or colour can fix; never the words
      let v = validate(L, copy, images, vopts); let final = L; let steps = [];
      const pendingCodes = { imagery_missing: 1, mark_unloaded: 1, imagery_sketch: 1 };
      const blockers = x => x.issues.filter(i => i.severity === 'blocking' && !pendingCodes[i.code]);
      if (blockers(v).length || v.issues.some(i => i.code === 'low_contrast')) { const rp = repair(L, copy, images, Object.assign({}, opts, { fixContrast: true })); if (rp.changed) { final = rp.layout; steps = rp.steps; v = validate(final, copy, images, vopts); } }
      if (sigOf(final) === current && !r.typeOnly) return;
      out.push({ id: r.id, name: r.name, layout: final, ok: !blockers(v).length, typeOnly: !!r.typeOnly, blocking: blockers(v).map(i => i.code.replace(/_/g, ' ') + (i.layers.length ? ' (' + i.layers.join(', ') + ')' : '')), pending: v.issues.filter(i => pendingCodes[i.code]).map(i => i.code), warnings: v.issues.filter(i => i.severity !== 'blocking').map(i => i.code), steps });
    });
    return out.sort((a, b) => (b.ok - a.ok));
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
    return { renderer: val.renderer, contract: val.contract || CONTRACT, W: val.W, H: val.H, production: val.production, imageryMissing: val.imageryMissing, unresolved: val.unresolved, subjects: val.subjects ? val.subjects.map(s => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h, covered: s.covered, cropped: s.cropped, by: s.by, confidence: s.confidence })) : undefined, fonts: val.fonts, boxes: val.boxes.map(b => { const o = {}; ['id', 'role', 'type', 'hidden', 'empty', 'dup', 'valid', 'overlaps', 'x', 'y', 'w', 'h', 'ax', 'ay', 'aw', 'ah', 'vx', 'vy', 'vw', 'vh', 'lines', 'chars', 'px', 'contentH', 'overflowH', 'overflowW', 'broken', 'mark', 'asset', 'src', 'contrast', 'contrastMin', 'rotate', 'opacity', 'alpha', 'occluded', 'occludedBy', 'groundLum', 'markFill', 'multicolour', 'inkN', 'inkLost', 'inkWeak', 'inkCovered', 'inkLocal', 'inkMean', 'inkRun', 'inkWhere', 'inkBoundary', 'inkGround', 'inkUnresolved', 'bg', 'emphasis'].forEach(k => { if (b[k] !== undefined) o[k] = typeof b[k] === 'number' ? Math.round(b[k] * 1000) / 1000 : b[k]; }); return o; }), clientIssues: val.issues.map(i => i.code + ':' + i.layers.join(',')) };
  }
  window.STRender = { RENDERER, CONTRACT, draw, render, toBlob, loadImage, stageSize, wrap, wrapText, layoutText, displayedText, ensureFonts, familyAvailable, measure, layoutRules, markConstraints, safeArea: safeAreaOf, validate, qualityOf, repair, markVariants, variants, report, zip, colourRGBA, regionStats, markStats, markReadability, markRegion, occlusionOf, contrastOf, coverTransform, imageToCanvas, canvasToImage, panFocus, subjects, subjectCoverage, frameSuggest };
})();
