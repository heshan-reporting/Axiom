/* S21 on the worker: what the first live demonstration (7 October, HOOF and MCA, real Claude, no images) found, each reproduced
 * here before it was fixed. (A) a strike drawn through the myth was judged "occluded" because the plan could not say an overlap
 * was intended and the normaliser and adaptation dropped it; (B) the logo and wordmark were placed on grounds they do not read on:
 * the worker now reads each mark file's ink (PNG, decoded here), keeps approved logo variants like wordmark variants, chooses the
 * variant and, where nothing holds the mark, the corner by the ground actually under it; (C) text planned off the stage;
 * (D) adaptation to 16:9 scaled type under the readable minimum. PNGs are SYNTHETIC, built here. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s21-worker.mjs */
import zlib from 'node:zlib';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s21-worker (overlaps, mark ink and variants, text on the stage, readable adaptation)');
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' } }, env: { STUDIO_INSPECT: '0' } });
const call = (m, p, b) => w.call(m, p, b, 'full-key');
const X = w.mod.__test;

/* a PNG of size w x h, RGBA, painted by fn(x, y) -> [r, g, b, a] */
function png(wd, ht, fn) {
  const raw = Buffer.alloc((wd * 4 + 1) * ht);
  for (let y = 0; y < ht; y++) { raw[y * (wd * 4 + 1)] = 0; for (let x = 0; x < wd; x++) { const p = fn(x, y); const o = y * (wd * 4 + 1) + 1 + x * 4; raw[o] = p[0]; raw[o + 1] = p[1]; raw[o + 2] = p[2]; raw[o + 3] = p[3]; } }
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type, 'ascii'), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(wd, 0); ihdr.writeUInt32BE(ht, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
// a mark: bars of ink in the middle fifth of the file, the rest transparent padding (as the MCA logo file is: 20% ink)
const bars = rgb => png(200, 80, (x, y) => (x > 40 && x < 160 && y > 28 && y < 52 && (x % 10) < 7) ? rgb.concat([255]) : [0, 0, 0, 0]);
const DARK = bars([20, 40, 70]), WHITE = bars([255, 255, 255]);
const OPAQUE = png(200, 80, (x, y) => (x > 40 && x < 160 && y > 28 && y < 52 && (x % 10) < 7) ? [15, 15, 15, 255] : [255, 255, 255, 255]);

await T.t('A: a declared overlap (a strike through the myth) is kept by the normaliser on both layers, so the validator reads it as intended', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'myth', type: 'text', role: 'myth', text: 'A subsidy for miners', x: 8, y: 30, w: 80, h: 12, size: 6 },
    { id: 'strike', type: 'shape', shape: 'rect', role: 'device', fill: '#E4572E', x: 6, y: 34, w: 84, h: 4, overlaps: ['myth'] },
  ] }, '4:5', { kit: {}, ns: 'mca' });
  const t = L.layers.find(l => l.id === 'myth'), s = L.layers.find(l => l.id === 'strike');
  ok(t && (t.overlaps || []).indexOf('strike') >= 0, 'the words name the device that crosses them: ' + JSON.stringify(t && t.overlaps));
  ok(s && (s.overlaps || []).indexOf('myth') >= 0, 'and the device names the words: ' + JSON.stringify(s && s.overlaps));
});
await T.t('A: a thin device drawn across the words with no declaration is recognised as a strike or underline and recorded as intended (and said)', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'myth', type: 'text', role: 'myth', text: 'A subsidy for miners', x: 8, y: 30, w: 80, h: 12, size: 6 },
    { type: 'rule', role: 'device', fill: '#E4572E', x: 6, y: 35, w: 84, h: 1.2 },
  ] }, '4:5', { kit: {}, ns: 'mca' });
  const t = L.layers.find(l => l.id === 'myth'); const dev = L.layers.find(l => l.type === 'shape');
  ok((t.overlaps || []).indexOf(dev.id) >= 0, 'recorded on the words: ' + JSON.stringify(t.overlaps));
  ok((L.intended || []).some(x => x.layers.indexOf('myth') >= 0 && /strike|underline/.test(x.why)), 'and said: ' + JSON.stringify(L.intended));
});
await T.t('A: an overlap declared for an opaque block that would hide the words is not kept, and the reason is recorded', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'myth', type: 'text', role: 'myth', text: 'A subsidy for miners', x: 8, y: 30, w: 80, h: 12, size: 6 },
    { id: 'slab', type: 'shape', shape: 'rect', role: 'panel', fill: '#E4572E', x: 6, y: 28, w: 84, h: 16, overlaps: ['myth'] },
  ] }, '4:5', { kit: {}, ns: 'mca' });
  const t = L.layers.find(l => l.id === 'myth');
  ok(!(t.overlaps || []).length, 'not on the words: ' + JSON.stringify(t.overlaps));
  ok((L.unsupported || []).some(n => /slab/.test(n) && /hide/.test(n)), 'said: ' + JSON.stringify(L.unsupported));
});
await T.t('A: the text emphasis "strike" is a style of the words themselves (no shape needed) and the plan may ask for it', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [{ id: 'myth', type: 'text', role: 'myth', text: 'A subsidy', x: 8, y: 30, w: 80, h: 12, size: 6, emphasis: 'strike', emphasisColor: '#E4572E' }] }, '1:1', { kit: {}, ns: 'mca' });
  eq(L.layers.find(l => l.id === 'myth').emphasis, 'strike');
});
await T.t('A: adaptation keeps the intended overlap (layout -> plan -> another format -> layout)', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'myth', type: 'text', role: 'myth', text: 'A subsidy for miners', x: 8, y: 30, w: 80, h: 12, size: 6 },
    { id: 'strike', type: 'shape', shape: 'rect', role: 'device', fill: '#E4572E', x: 6, y: 34, w: 84, h: 4, overlaps: ['myth'] },
  ] }, '4:5', { kit: {}, ns: 'mca' });
  const plan = X.stPlanForFormat(X.stLayoutToPlan(L, {}), '4:5', '1:1');
  const L2 = X.stPlanNormalise(plan, '1:1', { kit: {}, ns: 'mca' });
  ok((L2.layers.find(l => l.id === 'myth').overlaps || []).indexOf('strike') >= 0, 'still intended in 1:1: ' + JSON.stringify(L2.layers.find(l => l.id === 'myth')));
});

await T.t('C: text a plan puts off the stage is brought onto it (box inside 0-100 on both axes), the change said', async () => {
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'a', type: 'text', role: 'label', text: 'Farmers', x: -6, y: 20, w: 112, h: 8, size: 4 },
    { id: 'b', type: 'text', role: 'cta', x: 10, y: 96, w: 50, h: 9, size: 3 },
  ] }, '1:1', { kit: {}, ns: 'mca' });
  L.layers.filter(l => l.type === 'text').forEach(l => { ok(l.x >= 0 && l.y >= 0 && l.x + l.w <= 100.01 && l.y + l.h <= 100.01, l.id + ' on the stage: ' + JSON.stringify([l.x, l.y, l.w, l.h])); });
  ok((L.unsupported || []).some(n => /off the stage/.test(n)), 'said: ' + JSON.stringify(L.unsupported));
});

await T.t('D: adaptation to 16:9 keeps type at or above the feed minimum (headline 3.2, everything else 2.4) and never enlarges type that was smaller already', async () => {
  const plan = { medium: 'typographic', elements: [
    { id: 'h', type: 'text', role: 'headline', x: 8, y: 20, w: 80, h: 20, size: 7 },
    { id: 'k', type: 'text', role: 'kicker', text: 'MYTH', x: 8, y: 10, w: 40, h: 6, size: 3 },
    { id: 's', type: 'text', role: 'support', x: 8, y: 50, w: 80, h: 12, size: 3.4 },
    { id: 'tiny', type: 'text', role: 'caption', text: 'Source: ATO', x: 8, y: 90, w: 40, h: 4, size: 2 },
  ] };
  const out = X.stPlanForFormat(plan, '4:5', '16:9'); const by = id => out.elements.find(e => e.id === id).size;
  ok(by('h') >= 3.2, 'headline ' + by('h')); ok(by('k') >= 2.4, 'kicker ' + by('k')); ok(by('s') >= 2.4, 'support ' + by('s'));
  ok(by('tiny') <= 2.0 + 1e-9 && by('tiny') >= 1.8, 'a caption already under the minimum is not enlarged past what it was, and not shrunk under the blocking line: ' + by('tiny'));
});

await T.t('B: the worker reads a mark file\'s ink from its PNG: dark bars on transparency are dark ink; white bars light; an opaque white file with dark bars is dark ink on its own white field', async () => {
  const a = await X.stPngInk(DARK); const b = await X.stPngInk(WHITE); const c = await X.stPngInk(OPAQUE);
  eq([a && a.tone, b && b.tone, c && c.tone], ['dark', 'light', 'dark'], JSON.stringify([a, b, c]));
  ok(a.fill > 0.05 && a.fill < 0.35, 'its ink is a small share of the file (padding): ' + a.fill); ok(c.opaque === true && a.opaque === false, 'opaque told apart');
});
await T.t('B: logo variants are kept like wordmark variants (immutable key per version, tone, default) and served by variant and version', async () => {
  let r = await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] }); eq(r.status, 200, r.text);
  r = await call('POST', '/brand/kit', { ns: 'mca', logoB64: DARK.toString('base64'), logoMime: 'image/png' }); eq(r.status, 200, r.text);
  r = await call('POST', '/brand/kit', { ns: 'mca', logoB64: WHITE.toString('base64'), logoMime: 'image/png', logoVariant: 'white', logoTone: 'light' }); eq(r.status, 200, r.text);
  const kit = r.body.kit || r.body; const v = (kit.logoVariants || []).find(x => x.variant === 'white');
  ok(v && v.tone === 'light' && v.v, 'the variant is on the kit: ' + JSON.stringify(kit.logoVariants));
  ok(kit.logoV && kit.logoV !== v.v, 'the primary logo is untouched by a variant upload');
  const f = await w.call('GET', '/brand/logo?ns=mca&variant=white&v=' + v.v, null, 'full-key'); eq(f.status, 200, 'served: ' + f.status);
  const g = await call('GET', '/brand/kit?ns=mca'); const k2 = g.body.kit || g.body;
  ok(k2.logoInk && k2.logoInk.tone === 'dark' && k2.logoInk.v === k2.logoV, 'the primary logo\'s ink is read from its file and named by version: ' + JSON.stringify(k2.logoInk));
});
await T.t('B: on a dark ground the logo layer takes the approved light variant, and carries every variant for the browser to measure', async () => {
  const kit = (await call('GET', '/brand/kit?ns=mca')).body; const K = kit.kit || kit;
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', mark: 'campaign', elements: [{ id: 'h', type: 'text', role: 'headline', x: 8, y: 30, w: 80, h: 20, size: 7 }] }, '1:1', { kit: K, ns: 'mca', campaign: 'national' });
  const lg = L.layers.find(l => l.role === 'logo');
  ok(lg && /variant=white/.test(lg.src) && lg.variant === 'white', 'white on navy: ' + JSON.stringify(lg && { src: lg.src, variant: lg.variant }));
  ok(Array.isArray(lg.variants) && lg.variants.length === 2 && lg.variants.some(x => x.variant === 'primary'), 'both files offered: ' + JSON.stringify(lg.variants));
});
await T.t('B: with no variant that reads, a mark nothing holds goes to the corner whose ground it reads on (a light band at the top), and the move is said', async () => {
  const K = { name: 'X', hasLogo: true, logoV: 'aaa', logoInk: { v: 'aaa', tone: 'dark', lum: 0.08 }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] };
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', mark: 'campaign', markPlace: { corner: 'br' }, elements: [
    { id: 'band', type: 'shape', shape: 'rect', role: 'band', fill: '#F2EBDD', x: 0, y: 0, w: 100, h: 18 },
    { id: 'h', type: 'text', role: 'headline', x: 8, y: 30, w: 80, h: 20, size: 7 } ] }, '1:1', { kit: K, ns: 'mca', campaign: 'national' });
  const lg = L.layers.find(l => l.role === 'logo');
  ok(lg.y < 18 && lg.y + lg.h <= 18.01, 'on the light band: ' + JSON.stringify([lg.x, lg.y, lg.w, lg.h]));
  ok((L.unsupported || []).some(n => /logo/.test(n) && /reads/.test(n)), 'said: ' + JSON.stringify(L.unsupported));
});
await T.t('B: a mark held by a mandatory rule stays, and the plan says plainly it will not read there and what fixes it (an approved light variant)', async () => {
  const K = { name: 'X', hasLogo: true, logoV: 'aaa', logoInk: { v: 'aaa', tone: 'dark', lum: 0.08 }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo', markRule: { corner: 'br', mandatory: true } }] };
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', mark: 'campaign', elements: [{ id: 'h', type: 'text', role: 'headline', x: 8, y: 30, w: 80, h: 20, size: 7 }] }, '1:1', { kit: K, ns: 'mca', campaign: 'national' });
  const lg = L.layers.find(l => l.role === 'logo'); ok(lg.x > 50 && lg.y > 50, 'held bottom right');
  ok((L.unsupported || []).some(n => /will not read/.test(n) && /--variant/.test(n)), 'said with the fix: ' + JSON.stringify(L.unsupported));
});
await T.t('B: a logo whose ink could not be read (a JPEG) is never judged on a guess: it stays where the plan put it, nothing said', async () => {
  const K = { name: 'X', hasLogo: true, logoV: 'jjj', logoMime: 'image/jpeg', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] };
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', mark: 'campaign', markPlace: { corner: 'br' }, elements: [{ id: 'h', type: 'text', role: 'headline', x: 8, y: 30, w: 80, h: 20, size: 7 }] }, '1:1', { kit: K, ns: 'mca', campaign: 'national' });
  const lg = L.layers.find(l => l.role === 'logo'); ok(lg.x > 50 && lg.y > 50, 'left bottom right');
  ok(!(L.unsupported || []).some(n => /logo/.test(n) && /read/.test(n)), 'and no claim about its ink: ' + JSON.stringify(L.unsupported));
});
await T.t('B: the planner is told each mark\'s ink and the grounds it reads on', async () => {
  const K = { name: 'X', hasLogo: true, logoV: 'aaa', logoInk: { v: 'aaa', tone: 'dark', lum: 0.08 }, logoVariants: [], campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', hasWordmark: true, wordmarks: [{ variant: 'blue', tone: 'colour', v: 'b1' }, { variant: 'white', tone: 'light', v: 'w1' }] }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] };
  const a = X.stMarkInkText(K, 'national'); const b = X.stMarkInkText(K, 'hoof');
  ok(/logo/.test(a) && /dark ink/.test(a) && /light ground/.test(a), a);
  ok(/white/.test(b) && /dark ground/.test(b) && /blue/.test(b), b);
});

T.done(); w.restore();
