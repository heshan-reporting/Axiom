/* AXIOM Creative Studio - the one renderer.
 *
 * A composition is a layout document (layers in per cent of the stage, the Ad
 * Lab model) plus the version's copy and two bitmaps: the rendered background
 * and the client's exact logo. This file draws that document onto a canvas.
 * The preview on screen and the export PNG are the same function at different
 * sizes - font sizes and boxes scale with the stage width, so line breaks
 * agree and a headline that fits the preview fits the export. Nothing here
 * calls a model or the worker. */
(function () {
  'use strict';
  const FAMILIES = { display: '"Bricolage Grotesque", sans-serif', body: '"Instrument Sans", sans-serif', mono: '"Spline Sans Mono", monospace' };
  function fontFor(layout, l) {
    const kit = (layout && layout.fonts) || {};
    const want = l.font === 'body' ? kit.body : l.font === 'mono' ? '' : kit.display;
    return (want ? '"' + String(want).replace(/"/g, '') + '", ' : '') + (FAMILIES[l.font] || FAMILIES.display);
  }
  /* greedy word wrap with the context's own measurements */
  function wrap(ctx, text, maxW) {
    const words = String(text || '').split(/\s+/).filter(Boolean); const lines = []; let cur = '';
    words.forEach(w => { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur);
    return lines;
  }
  function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); ctx.closePath(); }
  function cover(ctx, img, W, H) {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight); const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  function contain(ctx, img, x, y, w, h) {
    const s = Math.min(w / img.naturalWidth, h / img.naturalHeight); const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  /** Draw layout + copy at W x H. images: {bg, logo} as loaded Image elements or null. Returns {overflow:[role]}. */
  function draw(ctx, W, H, layout, copy, images) {
    layout = layout || {}; copy = copy || {}; images = images || {};
    const layers = Array.isArray(layout.layers) ? layout.layers : [];
    const pal = layout.palette || {};
    ctx.save(); ctx.clearRect(0, 0, W, H);
    if (images.bg) cover(ctx, images.bg, W, H);
    else { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a33'); g.addColorStop(1, pal.primary && layout.template !== 'plain' ? pal.primary : '#0f171d'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
    const overflow = [];
    layers.forEach(l => {
      const x = l.x / 100 * W, y = l.y / 100 * H, w = l.w / 100 * W, h = (l.h || 0) / 100 * H;
      ctx.save(); ctx.globalAlpha = l.opacity == null ? 1 : l.opacity;
      if (l.type === 'shape') { ctx.fillStyle = l.fill || 'rgba(0,0,0,.5)'; roundRect(ctx, x, y, w, h, l.shape === 'pill' ? Math.min(w, h) / 2 : Math.max(2, W * 0.004)); ctx.fill(); }
      else if (l.type === 'img') {
        const img = l.role === 'logo' ? images.logo : images[l.id];
        if (img) contain(ctx, img, x, y, w, h);
        else if (l.role === 'logo') { ctx.fillStyle = 'rgba(255,255,255,.9)'; roundRect(ctx, x, y, w, h, 2); ctx.fill(); ctx.fillStyle = '#333'; ctx.font = '600 ' + Math.max(10, h * 0.32) + 'px ' + FAMILIES.mono; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText('LOGO', x + w / 2, y + h / 2); }
      } else if (l.type === 'text') {
        const text = l.role && copy[l.role] != null ? copy[l.role] : l.text;
        if (!text) { ctx.restore(); return; }
        const px = l.size / 100 * W; ctx.font = (l.weight || 600) + ' ' + px + 'px ' + fontFor(layout, l); ctx.textBaseline = 'top'; ctx.textAlign = l.align || 'left';
        const padX = l.bg ? px * 0.8 : 0, padY = l.bg ? px * 0.45 : 0;
        const lines = wrap(ctx, text, Math.max(10, w - padX * 2)); const lh = px * 1.12;
        const boxH = lines.length * lh + padY * 2;
        if (h && boxH > h + 0.5) overflow.push(l.role || l.id);
        if (l.bg) { const bw = l.align === 'center' || lines.length > 1 ? w : Math.min(w, Math.max.apply(null, lines.map(s => ctx.measureText(s).width)) + padX * 2); const bx = l.align === 'center' ? x + (w - bw) / 2 : l.align === 'right' ? x + w - bw : x; ctx.fillStyle = l.bg; roundRect(ctx, bx, y, bw, boxH, px * 0.35); ctx.fill(); }
        ctx.fillStyle = l.color || '#fff';
        const tx = l.align === 'center' ? x + w / 2 : l.align === 'right' ? x + w - padX : x + padX;
        lines.forEach((s, i) => ctx.fillText(s, tx, y + padY + i * lh));
      }
      ctx.restore();
    });
    ctx.restore();
    return { overflow };
  }
  function stageSize(layout, width) {
    const st = (layout && layout.stage) || { w: 1080, h: 1080 }; const w = width || st.w;
    return { w, h: Math.round(w * st.h / st.w) };
  }
  /** Render into a canvas element (created if not given) at the requested width; the height follows the format. */
  function render(layout, copy, images, width, canvas) {
    const { w, h } = stageSize(layout, width);
    canvas = canvas || document.createElement('canvas');
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const r = draw(canvas.getContext('2d'), w, h, layout, copy, images);
    return { canvas, w, h, overflow: r.overflow };
  }
  /** The export: the same document at the stage's native size, as a PNG blob. */
  function toBlob(layout, copy, images) {
    const { canvas } = render(layout, copy, images, null);
    return new Promise(res => canvas.toBlob(b => res(b), 'image/png'));
  }
  function loadImage(url) {
    return new Promise((res, rej) => { if (!url) return res(null); const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image failed: ' + String(url).slice(0, 80))); im.src = url; });
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
  window.STRender = { draw, render, toBlob, loadImage, stageSize, wrap, zip };
})();
