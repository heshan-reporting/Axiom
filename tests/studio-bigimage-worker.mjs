/* "The inspect step failed: no_image: nothing rendered to inspect (not retried)" on a tile whose image had rendered (the owner,
 * 26 November 2026, a Full AI creative from Nano Banana Pro). The image was on file; it was larger than the 4.5 MB the review
 * could show the model, so it was dropped as if nothing had rendered. Pro's 2K and 4K PNGs are often larger than that.
 * Providers MOCKED; the noise images below do not compress, as a photograph barely does.
 *   BI1 a 2K image over 4.5 MB is reviewed: the model is shown a copy at most 1024 px on its long side and under the limit,
 *       and the job says it showed a smaller copy
 *   BI2 a 4K image (over the 6 million pixels the decoder refused before) is reviewed the same way
 *   BI3 the image on file is untouched: the full-size bitmap stays what was rendered
 * Run: node --experimental-sqlite tests/studio-bigimage-worker.mjs */
import zlib from 'node:zlib'; import crypto from 'node:crypto';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { chunk } from './png.mjs';
const T = suite('studio-bigimage-worker (a large rendered image is reviewed from a smaller copy, never dropped)');
const noisePng = (w, h) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = 1 + w * 3; const raw = crypto.randomBytes(row * h);
  for (let y = 0; y < h; y++) raw[y * row] = 0;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 1 })), chunk('IEND', Buffer.alloc(0))]);
};
const pngSize = b64 => { const u = Buffer.from(b64, 'base64'); return u[0] === 0x89 ? { w: u.readUInt32BE(16), h: u.readUInt32BE(20), bytes: u.length } : { bytes: u.length }; };
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' } }, env: { STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'a', GEMINI_KEY: 'g' } });
const call = (m, p, b) => w.call(m, p, b, 'full-key');
const seen = [];
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const c0 = body.messages[0].content;
  const imgs = Array.isArray(c0) ? c0.filter(x => x.type === 'image').map(x => x.source && x.source.data) : [];
  seen.push(imgs);
  const ans = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 4, reasons: {}, words: { present: ['Businesses pay for every litre'], wrong: [], missing: [] }, marks: { present: [], missing: [], wrong: [] }, issues: [], verdict: 'ship', fix: { kind: 'none' }, note: 'ok' };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ans) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200 });
});
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Big image', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
const step = async id => { let j; for (let i = 0; i < 6; i++) { j = (await call('POST', '/studio/job/step', { id })).body.job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
const LAYOUT = { v: 5, stage: { w: 1080, h: 1350 }, layers: [{ id: 'hl', role: 'headline', type: 'text', x: 8, y: 8, w: 84, h: 20, size: 7 }] };
const review = async (label, wpx, hpx) => {
  const buf = noisePng(wpx, hpx); const key = 'studio/fx/' + label + '.png';
  await w.env.MIND_DOCS.put(key, buf, { httpMetadata: { contentType: 'image/png' } });
  const A = (await call('POST', '/studio/asset', { project: P, channel: 'instagram', format: '4:5', title: label, copy: { headline: 'Businesses pay for every litre' }, layout: LAYOUT, mode: 'composition', image: { key, url: '/studio/file?key=' + key, model: 'gemini-3-pro-image', size: '2K' } })).body.asset;
  const n0 = seen.length;
  const j = await step((await call('POST', '/studio/job', { project: P, asset: A.id, stage: 'inspect', input: { version: A.current }, idem: 'bi-' + label })).body.job.id);
  return { j, buf, key, sent: seen.slice(n0).flat().filter(Boolean) };
};

await T.t('BI1 a 2K image over 4.5 MB is reviewed from a copy at most 1024 px and under the limit', async () => {
  const r = await review('two-k', 1640, 2048);
  ok(r.buf.length > 4500000, 'the image on file is ' + Math.round(r.buf.length / 1e6) + ' MB, over the old limit');
  eq(r.j.state, 'done', 'the review ran: ' + (r.j.error || ''));
  ok(r.sent.length >= 1, 'the model was shown an image');
  const s = pngSize(r.sent[0]); ok(s.w && Math.max(s.w, s.h) <= 1024 && s.bytes < 4500000, 'a copy at most 1024 px and under 4.5 MB: ' + JSON.stringify(s));
  ok(Math.abs(s.w / s.h - 1640 / 2048) < 0.01, 'the copy keeps the shape');
  ok(((r.j.progress || {}).lines || []).some(l => /smaller copy/.test(l.text || l)), 'the job says it showed a smaller copy: ' + JSON.stringify((r.j.progress || {}).lines || []).slice(0, 300));
});
await T.t('BI2 a 4K image, past the old 6 million pixel decoder limit, is reviewed the same way', async () => {
  const r = await review('four-k', 2600, 3250);
  eq(r.j.state, 'done', r.j.error || '');
  const s = pngSize(r.sent[0]); ok(s.w && Math.max(s.w, s.h) <= 1024, JSON.stringify(s));
});
await T.t('BI3 the image on file is untouched', async () => {
  const r = await review('kept', 1640, 2048);
  const back = Buffer.from(await (await w.env.MIND_DOCS.get(r.key)).arrayBuffer());
  ok(back.equals(r.buf), 'the full-size bitmap is what was rendered');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
