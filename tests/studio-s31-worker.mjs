/* S31: the 4 November external audit of p47 (CREATIVE-STUDIO.md s.57), against the worker module in this process with every
 * provider MOCKED. Each case fails on ac22dd1 and passes with its fix.
 *   SC  a guest link may name the clients it reads (AXIOM_GUEST_KEYS "ns"): it reads and writes those clients' Studio work and
 *       is refused every other client's projects, assets, files, brand kit, artwork and Mind, and the rest of AXIOM; a link with
 *       no "ns" keeps decision D2 (reads every client); a malformed "ns" closes the guest list
 *   IMG a brand mark is stored only when it is a whole PNG (or a JPEG / WebP whose structure holds), checked beyond its signature
 *   MK  the worker reads a mark file saved at any PNG bit depth, interlaced or not, and reads faded, turned and cropped marks
 *       itself; what it still cannot read (an opaque file) is listed as checked in the browser only - in readiness and on the
 *       approval - never as passed by the worker, and approval stays possible
 * Run: node --experimental-sqlite tests/studio-s31-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngB64, chunk, pngForVersion } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import zlib from 'node:zlib';

const S = suite('S31: guest client scope; image files checked whole');
const GUESTS = {
  'guest-synth-key1': { n: 'Synth tester', r: 'full', until: '2099-01-01', ns: 'synthdemo' },
  'guest-mca-key01': { n: 'MCA reviewer', r: 'read', until: '2099-01-01', ns: ['mca'] },
  'guest-open-key1': { n: 'Internal tester', r: 'read', until: '2099-01-01' },
};
const env0 = { ANTHROPIC_API_KEY: 'test', STUDIO_INSPECT: '0', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS) };
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };

async function seed(w) {
  const St = (m, p, b) => w.call(m, p, b, 'staff-key');
  await St('POST', '/brand/kit', { ns: 'mca', name: 'MCA', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
  await St('POST', '/brand/kit', { ns: 'synthdemo', name: 'Harbourline', campaigns: [{ id: 'ferries', name: 'Ferries', logoPolicy: 'none' }] });
  const M = (await St('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF live', brief: { objective: 'o', campaignConfirmed: true } })).body.id;
  const Y = (await St('POST', '/studio/project', { ns: 'synthdemo', campaign: 'ferries', title: 'Synth', brief: { objective: 'o', campaignConfirmed: true } })).body.id;
  const MA = (await St('POST', '/studio/asset', { project: M, family: 'F', channel: 'instagram', format: '1:1', title: 'HOOF tile', mode: 'composition', copy: { headline: 'Hands off' }, layout: LAYOUT })).body.asset;
  const YA = (await St('POST', '/studio/asset', { project: Y, family: 'F', channel: 'instagram', format: '1:1', title: 'Synth tile', mode: 'composition', copy: { headline: 'Ferries' }, layout: LAYOUT })).body.asset;
  w.r2.set('studio/' + M + '/' + MA.id + '/x.png', { v: Buffer.from(pngB64(8, 8), 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
  return { M, Y, MA, YA };
}

await S.t('SC: a link scoped to the synthetic client works in it and is refused MCA work and the rest of AXIOM', async () => {
  const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: env0 });
  try {
    const { M, Y, MA, YA } = await seed(w);
    const G = (m, p, b) => w.call(m, p, b, 'guest-synth-key1');
    const me = (await G('GET', '/auth/me')).body; eq(me.scope, ['synthdemo'], 'the page learns the scope');
    const allowed = [['GET', '/studio/list?ns=synthdemo'], ['GET', '/studio/get?id=' + Y], ['GET', '/studio/readiness?asset=' + YA.id], ['GET', '/brand/kit?ns=synthdemo'], ['GET', '/studio/status'], ['GET', '/studio/budget']];
    for (const [m, p] of allowed) { const r = await G(m, p); ok(r.status === 200, p + ' answers for the scoped client: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 140)); }
    const refused = [['GET', '/studio/list?ns=mca'], ['GET', '/studio/get?id=' + M], ['GET', '/studio/readiness?asset=' + MA.id], ['GET', '/studio/versions?asset=' + MA.id],
      ['GET', '/studio/file?key=' + encodeURIComponent('studio/' + M + '/' + MA.id + '/x.png')], ['GET', '/brand/kit?ns=mca'], ['GET', '/brand/workspace?ns=mca'], ['GET', '/studio/metrics?ns=mca'],
      ['POST', '/mind/query', { ns: 'mca', q: 'fuel tax' }], ['GET', '/allnews'], ['GET', '/narratives'], ['GET', '/brief/daily'], ['GET', '/studio/get?id=nope'], ['GET', '/studio/list']];
    for (const [m, p, b] of refused) { const r = await G(m, p, b); eq(r.status, 403, p + ' is refused (' + JSON.stringify(r.body).slice(0, 120) + ')'); eq(r.body.error, 'guest_client_scope', p); }
    // it still works in its own client: a test project is made and an asset written in it
    const P = (await G('POST', '/studio/project', { ns: 'synthdemo', campaign: 'ferries', title: 'Tester work', brief: { objective: 'o', campaignConfirmed: true } })).body; ok(P.id, 'a project in the scoped client: ' + JSON.stringify(P).slice(0, 160));
    const a = await G('POST', '/studio/asset', { project: P.id, family: 'F', channel: 'instagram', format: '1:1', title: 't', mode: 'copy', copy: { headline: 'x' } }); eq(a.status, 200, JSON.stringify(a.body).slice(0, 160));
    const x = await G('POST', '/studio/project', { ns: 'mca', title: 'Elsewhere', brief: { objective: 'o' } }); eq(x.status, 403, 'not in another client');
  } finally { w.restore(); }
});

await S.t('SC: a read link scoped to MCA reads MCA work, not the synthetic client\'s; an unscoped guest keeps D2 (reads every client)', async () => {
  const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: env0 });
  try {
    const { M, Y } = await seed(w);
    const R = (m, p, b) => w.call(m, p, b, 'guest-mca-key01'), O = (m, p, b) => w.call(m, p, b, 'guest-open-key1');
    eq((await R('GET', '/studio/get?id=' + M)).status, 200, 'MCA reads MCA');
    eq((await R('GET', '/studio/get?id=' + Y)).status, 403, 'MCA does not read the synthetic client');
    eq((await O('GET', '/studio/get?id=' + M)).status, 200, 'an unscoped guest reads MCA (D2)');
    eq((await O('GET', '/studio/get?id=' + Y)).status, 200, 'and the synthetic client (D2)');
    eq((await O('GET', '/auth/me')).body.scope, undefined, 'no scope named');
  } finally { w.restore(); }
});

await S.t('SC: a guest list with a malformed "ns" refuses every guest key and leaves the main roster open', async () => {
  const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: Object.assign({}, env0, { AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-bad-key1': { n: 'x', r: 'read', ns: ['MCA!'] } }) }) });
  try {
    eq((await w.call('GET', '/studio/status', null, 'guest-bad-key1')).status, 401, 'the guest list is closed');
    eq((await w.call('GET', '/studio/status', null, 'staff-key')).status, 200, 'staff still in');
  } finally { w.restore(); }
});

await S.t('IMG: a brand mark whose PNG data is corrupt, or a JPEG / WebP that is not whole, is refused; a whole PNG is kept', async () => {
  const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: env0 });
  try {
    const St = (m, p, b) => w.call(m, p, b, 'staff-key');
    await St('POST', '/brand/kit', { ns: 'mca', name: 'MCA', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
    const good = Buffer.from(pngB64(64, 32), 'base64');
    const corrupt = Buffer.from(good); for (let i = 41; i < corrupt.length - 20; i++) corrupt[i] ^= 0x5a;   // the IDAT bytes scrambled: a PNG signature over nothing that decodes
    const jpegNoFrames = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0' + 'x'.repeat(200)), Buffer.from([0xff, 0xd9])]);
    const webpHeaderOnly = (() => { const b = Buffer.alloc(120); b.write('RIFF', 0); b.writeUInt32LE(112, 4); b.write('WEBPVP8 ', 8); b.writeUInt32LE(100, 16); b[20] = 0; return b; })();
    for (const [name, buf, mime] of [['corrupt png', corrupt, 'image/png'], ['jpeg with no image data', jpegNoFrames, 'image/jpeg'], ['webp header only', webpHeaderOnly, 'image/webp']]) {
      const r = await St('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkB64: buf.toString('base64'), wordmarkMime: mime });
      eq(r.status, 422, name + ' is a 422'); ok(/bad_image/.test(JSON.stringify(r.body)), name + ' refused: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    }
    const ok1 = await St('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkB64: good.toString('base64'), wordmarkMime: 'image/png' }); eq(ok1.status, 200, JSON.stringify(ok1.body).slice(0, 160));
  } finally { w.restore(); }
});

/* a PNG encoder for the decoder's cases: any colour type and bit depth, Adam7 or not (filter 0 on every row) */
function encPng(w, h, { ct = 6, depth = 8, inter = false, plte = null, trns = null }, px) {
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct]; const bitsPP = ch * depth;
  const passes = inter ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const parts = [];
  for (const [x0, y0, dx, dy] of passes) {
    const pw = Math.max(0, Math.ceil((w - x0) / dx)), ph = Math.max(0, Math.ceil((h - y0) / dy)); if (!pw || !ph) continue;
    const stride = Math.ceil(pw * bitsPP / 8);
    for (let y = 0; y < ph; y++) {
      const row = Buffer.alloc(stride + 1); let bit = 0;
      for (let x = 0; x < pw; x++) { const vals = px(x0 + x * dx, y0 + y * dy); for (const v of vals) {
        if (depth === 16) { row.writeUInt16BE(v, 1 + (bit >> 3)); } else if (depth === 8) row[1 + (bit >> 3)] = v; else row[1 + (bit >> 3)] |= v << (8 - depth - (bit & 7));
        bit += depth; } }
      parts.push(row);
    }
  }
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = depth; hd[9] = ct; hd[12] = inter ? 1 : 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', hd)].concat(plte ? [chunk('PLTE', Buffer.from(plte))] : []).concat(trns ? [chunk('tRNS', Buffer.from(trns))] : []).concat([chunk('IDAT', zlib.deflateSync(Buffer.concat(parts))), chunk('IEND', Buffer.alloc(0))]));
}

await S.t('MK: the worker decodes PNGs at 1, 2, 4, 8 and 16 bits, palette and grey, with and without Adam7 interlacing', async () => {
  const w = await workerEnv({});
  try {
    const T = w.mod.__test; const W = 13, H = 11;   // odd sizes, so every interlace pass is partial
    const want = (x, y) => [(x * 19) & 255, (y * 23) & 255, ((x + y) * 7) & 255, (x * y) % 3 ? 255 : 0];
    const cases = [
      ['RGBA 8-bit', { ct: 6, depth: 8 }, (x, y) => want(x, y), want],
      ['RGBA 8-bit interlaced', { ct: 6, depth: 8, inter: true }, (x, y) => want(x, y), want],
      ['RGBA 16-bit', { ct: 6, depth: 16 }, (x, y) => want(x, y).map(v => v * 257), want],
      ['RGBA 16-bit interlaced', { ct: 6, depth: 16, inter: true }, (x, y) => want(x, y).map(v => v * 257), want],
      ['grey + alpha 16-bit', { ct: 4, depth: 16 }, (x, y) => [((x * 19) & 255) * 257, want(x, y)[3] * 257], (x, y) => { const g = (x * 19) & 255; return [g, g, g, want(x, y)[3]]; }],
      ['grey 1-bit interlaced', { ct: 0, depth: 1, inter: true }, (x, y) => [(x + y) & 1], (x, y) => { const g = (x + y) & 1 ? 255 : 0; return [g, g, g, 255]; }],
      ['grey 4-bit', { ct: 0, depth: 4 }, (x, y) => [x % 16], (x, y) => { const g = Math.round((x % 16) * 17); return [g, g, g, 255]; }],
      ['palette 2-bit with tRNS', { ct: 3, depth: 2, plte: [255, 0, 0, 0, 255, 0, 0, 0, 255, 250, 250, 250], trns: [255, 0] }, (x, y) => [(x + 2 * y) % 4], (x, y) => [[255, 0, 0, 255], [0, 255, 0, 0], [0, 0, 255, 255], [250, 250, 250, 255]][(x + 2 * y) % 4]],
      ['RGB 16-bit interlaced', { ct: 2, depth: 16, inter: true }, (x, y) => want(x, y).slice(0, 3).map(v => v * 257), (x, y) => want(x, y).slice(0, 3).concat([255])],
    ];
    for (const [name, o, px, exp] of cases) {
      const img = await T.stPngDecode(encPng(W, H, o, px)); ok(img && img.W === W && img.H === H, name + ' decodes');
      if (!img) continue; let bad = null;
      for (let y = 0; y < H && !bad; y++) for (let x = 0; x < W && !bad; x++) { const g = img.at(y * W + x), e = exp(x, y); if (g.some((v, k) => Math.abs(v - e[k]) > 1)) bad = [x, y, g, e]; }
      ok(!bad, name + ' reads every pixel right' + (bad ? ': ' + JSON.stringify(bad) : ''));
    }
    ok(!(await T.stPngDecode(encPng(W, H, { ct: 2, depth: 4 }, () => [1, 1, 1]))), 'an illegal depth for the colour type (RGB at 4 bits) is refused');
  } finally { w.restore(); }
});

/* a transparent wordmark file, drawn into a tile through a transform of the test's own (supersampled, as a canvas smooths it) */
const FILE = { W: 300, H: 80, at: i => { const x = i % 300, y = Math.floor(i / 300); return (y >= 12 && y < 68 && (x % 25) < 16) ? [255, 255, 255, 255] : [0, 0, 0, 0]; } };
function drawTile(ground, b, { rot = 0, alpha = 1 } = {}) {
  const s = Math.min(b.aw / FILE.W, b.ah / FILE.H); const dw = FILE.W * s, dh = FILE.H * s; const ox = b.ax + (b.aw - dw) / 2, oy = b.ay + (b.ah - dh) / 2; const cx = b.ax + b.aw / 2, cy = b.ay + b.ah / 2;
  const t = rot * Math.PI / 180, c = Math.cos(-t), sn = Math.sin(-t);
  const cov = (X, Y) => { let n = 0; for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) { let ux = X + (sx + 0.5) / 3, uy = Y + (sy + 0.5) / 3; const dx = ux - cx, dy = uy - cy; ux = dx * c - dy * sn + cx; uy = dx * sn + dy * c + cy; const fx = Math.floor((ux - ox) / s), fy = Math.floor((uy - oy) / s); if (fx >= 0 && fy >= 0 && fx < FILE.W && fy < FILE.H && FILE.at(fy * FILE.W + fx)[3]) n++; } return n / 9 * alpha; };
  return { W: 1080, H: 1080, at: i => { const X = i % 1080, Y = Math.floor(i / 1080); const k = cov(X, Y); return [0, 1, 2].map(j => Math.round(255 * k + ground[j] * (1 - k))).concat([255]); } };
}

await S.t('MK: faded, turned and cropped marks are read by the worker (no longer left to the browser); an opaque file is said to be skipped, with why', async () => {
  const w = await workerEnv({});
  try {
    const T = w.mod.__test; const b = { ax: 600, ay: 880, aw: 360, ah: 96 };
    const navy = [16, 30, 60], pale = [235, 235, 235];
    const r1 = T.stServerMark(drawTile(navy, b, { rot: 20 }), FILE, { role: 'wordmark', rotate: 20 }, b);
    ok(r1 && !r1.skip && r1.inkLost < 0.1, 'a white wordmark turned 20 degrees on navy reads: ' + JSON.stringify(r1));
    const r2 = T.stServerMark(drawTile(pale, b, { rot: 20 }), FILE, { role: 'wordmark', rotate: 20 }, b);
    ok(r2 && !r2.skip && r2.inkLost > 0.5, 'and on a pale ground it does not: ' + JSON.stringify(r2));
    const r3 = T.stServerMark(drawTile(navy, b, { alpha: 0.9 }), FILE, { role: 'wordmark', opacity: 0.9 }, b);
    ok(r3 && !r3.skip && r3.inkLost < 0.1, 'at 90% opacity on navy it reads: ' + JSON.stringify(r3));
    const mid = [150, 150, 150]; const r4 = T.stServerMark(drawTile(mid, b, { alpha: 0.35 }), FILE, { role: 'wordmark', opacity: 0.35 }, b);
    ok(r4 && !r4.skip && r4.inkLost > 0.5, 'faded to 35% on mid grey it does not (the faded ink is what a reader sees): ' + JSON.stringify(r4));
    const r5 = T.stServerMark(drawTile(navy, b), FILE, { role: 'wordmark', fit: 'cover' }, b);
    ok(r5 && !r5.skip, 'a cover-fitted mark is read too: ' + JSON.stringify(r5));
    const opaque = { W: 300, H: 80, at: () => [255, 255, 255, 255] };
    const r6 = T.stServerMark(drawTile(navy, b), opaque, { role: 'wordmark' }, b);
    ok(r6 && r6.skip && /transparent/.test(r6.skip), 'an opaque file is skipped and says why: ' + JSON.stringify(r6));
  } finally { w.restore(); }
});

await S.t('MK: a mark the worker cannot read is listed as checked in the browser only (readiness and the approval); a 16-bit interlaced mark is read; approval stays possible', async () => {
  const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: env0 });
  try {
    const St = (m, p, b) => w.call(m, p, b, 'staff-key');
    await St('POST', '/brand/kit', { ns: 'mca', name: 'MCA', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
    const transparent16 = encPng(300, 80, { ct: 6, depth: 16, inter: true }, (x, y) => FILE.at(y * 300 + x).map(v => v * 257));
    const opaque = encPng(300, 80, { ct: 2, depth: 8 }, () => [255, 255, 255]);
    const P = (await St('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF marks', brief: { objective: 'o', campaignConfirmed: true } })).body.id;
    const out = {};
    for (const [variant, buf] of [['clear', transparent16], ['solid', opaque]]) {
      const k = await St('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: variant, wordmarkTone: 'light', wordmarkB64: buf.toString('base64'), wordmarkMime: 'image/png' }); eq(k.status, 200, variant + ' stored: ' + JSON.stringify(k.body).slice(0, 160));
      const kit = (await St('GET', '/brand/kit?ns=mca')).body; const wm = ((kit.kit || kit).campaigns.find(c => c.id === 'hoof').wordmarks || []).find(x => x.variant === variant);
      const layout = Object.assign({}, LAYOUT, { layers: LAYOUT.layers.concat([{ id: 'wordmark', type: 'img', role: 'wordmark', asset: 'wordmark', campaign: 'hoof', src: '/brand/wordmark?ns=mca&campaign=hoof&variant=' + variant + '&v=' + wm.v, x: 60, y: 86, w: 30, h: 8, fit: 'contain', exact: true }]) });
      const A = (await St('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: variant, mode: 'composition', copy: { headline: 'Hands off' }, layout })).body.asset.id;
      const g = (await St('GET', '/studio/get?id=' + P)).body; const a = g.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current);
      const r = await St('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a), imageB64: pngForVersion(v, { fill: 3 }) }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
      out[variant] = { A, v, r: r.body };
    }
    const rdClear = out.clear.r.readiness, rdSolid = out.solid.r.readiness;
    ok(!rdClear.browserOnly, 'the 16-bit interlaced transparent wordmark is read by the worker: ' + JSON.stringify(rdClear.browserOnly));
    ok(rdSolid.browserOnly && rdSolid.browserOnly[0].element === 'wordmark' && /transparent/.test(rdSolid.browserOnly[0].why), 'the opaque wordmark is listed as checked in the browser only, with why: ' + JSON.stringify(rdSolid.browserOnly));
    ok(rdSolid.technical === 'passed', 'it is not called failed either: ' + rdSolid.technical);
    const rd2 = (await St('GET', '/studio/readiness?asset=' + out.solid.A)).body; ok(rd2.browserOnly && rd2.browserOnly.length === 1, 'the readiness route says the same');
    eq((await St('POST', '/studio/approve', { asset: out.solid.A, part: 'copy', decision: 'approve', reason: 'copy fine', version: out.solid.v.id })).status, 200, 'copy approved');
    const ap = await St('POST', '/studio/approve', { asset: out.solid.A, part: 'design', decision: 'approve', reason: 'looked at the mark', version: out.solid.v.id }); eq(ap.status, 200, 'design approval stays possible: ' + JSON.stringify(ap.body).slice(0, 200));
    const row = w.env.MIND_DB.db.prepare("SELECT reason FROM studio_approvals WHERE asset=? AND part='design' ORDER BY created DESC LIMIT 1").get(out.solid.A);
    ok(/checked in the browser only/.test(row.reason), 'the approval records it: ' + row.reason);
  } finally { w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
