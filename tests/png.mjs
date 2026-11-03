/* Real PNGs for the harnesses: a whole file (signature, IHDR, IDAT, IEND, every CRC right) that decodes to the size it states,
 * plus the ways a file can only look like one. The worker refuses a measured export that is not a decodable PNG at the
 * composition's size (p44), so a fake header no longer stands in for a picture.
 *   pngBytes(w, h, opts) -> Buffer       opts.fill: 0-255 shade (the bytes differ by fill); opts.alpha: RGBA instead of RGB
 *   pngB64(w, h, opts) -> base64
 *   pngForVersion(v, opts) -> base64 at the version's layout.stage size
 *   broken(kind, w, h) -> Buffer          kind: crc | truncated | zero | short | filter | trailing | nosig | noiend | idatgap */
import zlib from 'node:zlib';

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
export function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const SIG = Buffer.from('89504e470d0a1a0a', 'hex');
function ihdr(w, h, ct) { const d = Buffer.alloc(13); d.writeUInt32BE(w, 0); d.writeUInt32BE(h, 4); d[8] = 8; d[9] = ct; d[10] = 0; d[11] = 0; d[12] = 0; return d; }
function raw(w, h, ch, fill, filter) {
  const rowLen = 1 + w * ch; const out = Buffer.alloc(rowLen * h, fill);
  for (let y = 0; y < h; y++) out[y * rowLen] = filter == null ? 0 : filter;
  return out;
}
const cache = new Map();
export function pngBytes(w, h, opts) {
  const o = opts || {}; const fill = o.fill == null ? 0x30 : o.fill; const ch = o.alpha ? 4 : 3; const key = [w, h, fill, ch].join(':');
  if (cache.has(key)) return cache.get(key);
  const b = Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, o.alpha ? 6 : 2)), chunk('IDAT', zlib.deflateSync(raw(w, h, ch, fill), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  cache.set(key, b); return b;
}
export const pngB64 = (w, h, opts) => pngBytes(w, h, opts).toString('base64');
/* the measured image of a version, as a stand-in: the stage at its size in a flat shade, and under each live text layer a ground
   that contrasts with its colour (black under light words, white under dark ones), so the worker's own reading of the image
   (RC D3) agrees with a stub report that claims readable words; a harness testing poor contrast says so in its report */
export function pngForVersion(v, opts) {
  const s = (v && v.layout && v.layout.stage) || { w: 1080, h: 1080 }; const o = opts || {};
  const layers = (v && v.layout && Array.isArray(v.layout.layers) ? v.layout.layers : []).filter(l => l && l.type === 'text' && !l.hidden);
  if (!layers.length || o.flat) return pngB64(s.w, s.h, opts);
  const W = s.w, H = s.h; const fill = o.fill == null ? 0x30 : o.fill; const rowLen = 1 + W * 3; const raw = Buffer.alloc(rowLen * H, fill);
  for (let y = 0; y < H; y++) raw[y * rowLen] = 0;
  const lum = hex => { const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '#ffffff')); if (!m) return 1; const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]; const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  for (const l of layers) {
    const g = lum(l.color) > 0.3 ? 0 : 255; const x0 = Math.max(0, Math.floor(l.x / 100 * W)), x1 = Math.min(W, Math.ceil((l.x + l.w) / 100 * W));
    const hPct = Math.max(+l.h || 0, (+l.size || 4) * 1.12 * 3); const y0 = Math.max(0, Math.floor(l.y / 100 * H)), y1 = Math.min(H, Math.ceil((l.y + hPct) / 100 * H));
    for (let y = y0; y < y1; y++) raw.fill(g, y * rowLen + 1 + x0 * 3, y * rowLen + 1 + x1 * 3);
  }
  return Buffer.concat([SIG, chunk('IHDR', ihdr(W, H, 2)), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]).toString('base64');
}

export function broken(kind, w, h) {
  w = w || 1080; h = h || 1080;
  const good = pngBytes(w, h, { fill: 0x41 });
  if (kind === 'nosig') { const b = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'); const f = Buffer.alloc(200, 1); b.copy(f, 0); f.writeUInt32BE(w, 16); f.writeUInt32BE(h, 20); f[24] = 8; f[25] = 6; return f; }   // the old fake: a signature and a header, then filler
  if (kind === 'crc') { const b = Buffer.from(good); b[b.length - 20] ^= 0xff; return b; }                                            // a byte of IDAT flipped: its CRC no longer matches
  if (kind === 'truncated') return good.subarray(0, Math.floor(good.length * 0.6));                                                   // cut off in the middle
  if (kind === 'noiend') return good.subarray(0, good.length - 12);                                                                   // everything but IEND
  if (kind === 'trailing') return Buffer.concat([good, Buffer.from('extra bytes after the end')]);
  if (kind === 'zero') return Buffer.concat([SIG, chunk('IHDR', ihdr(0, 0, 2)), chunk('IDAT', zlib.deflateSync(Buffer.alloc(0))), chunk('IEND', Buffer.alloc(0))]);
  if (kind === 'short') return Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, 2)), chunk('IDAT', zlib.deflateSync(raw(w, Math.floor(h / 2), 3, 0x41))), chunk('IEND', Buffer.alloc(0))]);   // states w x h, holds half the rows
  if (kind === 'filter') return Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, 2)), chunk('IDAT', zlib.deflateSync(raw(w, h, 3, 0x41, 9))), chunk('IEND', Buffer.alloc(0))]);           // every row names filter 9 (there are 0-4)
  if (kind === 'baddeflate') { const z = zlib.deflateSync(raw(w, h, 3, 0x41)); const bad = Buffer.from(z); for (let i = 10; i < Math.min(bad.length - 4, 60); i++) bad[i] ^= 0x5a; return Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, 2)), chunk('IDAT', bad), chunk('IEND', Buffer.alloc(0))]); }   // CRCs right, the compressed data wrong
  if (kind === 'idatgap') { const z = zlib.deflateSync(raw(w, h, 3, 0x41)); const mid = Math.floor(z.length / 2); return Buffer.concat([SIG, chunk('IHDR', ihdr(w, h, 2)), chunk('IDAT', z.subarray(0, mid)), chunk('tEXt', Buffer.from('k\0v')), chunk('IDAT', z.subarray(mid)), chunk('IEND', Buffer.alloc(0))]); }
  throw new Error('unknown broken kind ' + kind);
}
