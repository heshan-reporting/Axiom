/* The release candidate's security and integrity cases (CREATIVE-STUDIO.md s.54), against the worker module in this
 * process with every provider MOCKED (worker-env.mjs). Each case fails on the base commit and passes with its fix.
 *   S2  open access never writes: every anonymous write and acting GET is refused, not only the Studio's; the posture
 *       readout says how the worker is opened without showing a key
 *   S3  the retraction filter fails closed: a passage whose document cannot be cleared is left out
 *   S4  an image the provider sends that is not whole (a cut-off PNG, a JPEG without its end) is never filed; a finished
 *       creative's bitmap is checked whole before it is delivered
 *   S6  a render job cannot name an arbitrary image model: only the chain's own models go first
 *   S5  a measurement is filed with the PNG it measured; an image saved after approval is never bound to an older measurement
 *   D3  the worker reads the filed PNG itself: words the ground swallows, and a mark whose strokes vanish on part of the ground,
 *       fail on the worker's own figures even when the browser's report says they read
 * Run: node --experimental-sqlite tests/studio-rc-security-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngBytes, chunk } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import zlib from 'node:zlib';

const S = suite('RC security: open access, retraction');
const KEYS = { 'full-key': { n: 'Lead', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const providers = w => w.outbound.filter(o => /anthropic|generativelanguage|news\.google|reddit|api\.openai/.test(o.url)).length;

await S.t('S2: with AXIOM_PUBLIC=full an anonymous write is refused everywhere, not only under /studio, /brand and /engine', async () => {
  const w = await workerEnv({ keys: KEYS, env: { AXIOM_PUBLIC: 'full', ANTHROPIC_API_KEY: 'x', GEMINI_KEY: 'g' } });
  try {
    const tries = [['POST', '/mind/ingest', { namespace: 'mca', title: 'x', text: 'anonymous material' }], ['POST', '/chat', { messages: [{ role: 'user', content: 'hi' }] }],
      ['POST', '/nano', { prompt: 'a picture' }], ['POST', '/research', { q: 'fuel tax credits' }], ['POST', '/studio/project', { ns: 'mca', title: 'anon' }], ['GET', '/collect']];
    for (const [m, p, b] of tries) {
      const r = await w.call(m, p, b, null);
      eq(r.status, 403, m + ' ' + p + ' answered ' + r.status + ' ' + r.text.slice(0, 120));
      eq(r.body && r.body.error, 'public_write_refused', p);
    }
    eq(providers(w), 0, 'no refused request reached a provider');
    const rd = await w.call('GET', '/allnews', null, null);
    eq(rd.status, 200, 'reading stays open');
    // S29 (SEC-5): client work is not part of open access
    eq((await w.call('GET', '/studio/list?ns=mca', null, null)).status, 401, 'client work needs a link');
    const withKey = await w.call('POST', '/mind/ingest', { namespace: 'cmm', title: 'with a key', text: 'material filed by a person with a key' }, 'full-key');
    ok(withKey.status !== 403 && withKey.status !== 401, 'a full key still writes: ' + withKey.status);
  } finally { w.restore(); }
});

await S.t('S2: STUDIO_PUBLIC_WRITE=1 opens the Studio\'s writes only; the rest stay refused', async () => {
  const w = await workerEnv({ keys: KEYS, env: { AXIOM_PUBLIC: 'full', STUDIO_PUBLIC_WRITE: '1' } });
  try {
    const st = await w.call('POST', '/studio/project', { ns: 'synthdemo', title: 'anonymous test' }, null);
    eq(st.status, 200, 'the Studio override holds: ' + st.text.slice(0, 160));
    const mi = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'x', text: 'anonymous material' }, null);
    eq(mi.status, 403, 'the Mind stays closed to anonymous writes');
  } finally { w.restore(); }
});

await S.t('S2: the posture readout names how the worker is opened, never a key', async () => {
  const w = await workerEnv({ keys: KEYS, env: { AXIOM_PUBLIC: 'read', AXIOM_PUBLIC_UNTIL: '2026-11-17', STUDIO_GUEST_BRAND: '1', AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-one-key': { n: 'Ana', r: 'read' }, 'guest-two-key': { n: 'Bo', r: 'full', until: '2020-01-01' } }) } });
  try {
    const r = await w.call('GET', '/studio/status', null, 'read-key');
    const p = r.body.posture;
    ok(p, 'posture is answered: ' + r.text.slice(0, 200));
    eq(p.public.role, 'read'); eq(p.public.until, '2026-11-17');
    eq(p.flags.STUDIO_GUEST_BRAND, true); eq(p.flags.STUDIO_PUBLIC_WRITE, false);
    eq(p.guests.read, 1, 'one read guest'); eq(p.guests.expired, 1, 'one expired guest');
    ok(!/guest-one-key|guest-two-key|full-key|read-key/.test(r.text), 'no key appears in the answer');
  } finally { w.restore(); }
});

/* a Mind with passages from many documents; the vector index answers them and D1 says which documents are withdrawn */
async function mindWith(nDocs, retracted) {
  const w = await workerEnv({ keys: KEYS });
  await w.call('POST', '/mind/ingest', { namespace: 'cmm', title: 'seed', text: 'a document so the schema exists' }, 'full-key');
  const db = w.env.MIND_DB;
  for (let i = 0; i < nDocs; i++) await db.prepare("INSERT OR REPLACE INTO mind_docs(id, ns, title, kind, source, dt, chunks, created) VALUES(?,?,?,?,?,?,?,?)").bind('doc' + i, 'mca', 'Doc ' + i, 'note', '', '', 1, Date.now()).run();
  for (const i of retracted) await db.prepare("UPDATE mind_docs SET status='retracted' WHERE id=?").bind('doc' + i).run();
  w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: o.namespace === 'mca' ? Array.from({ length: nDocs }, (_, i) => ({ id: 'v' + i, score: 1 - i / 1000, metadata: { docId: 'doc' + i, title: 'Doc ' + i, kind: 'note', snippet: 'passage ' + i } })).concat([{ id: 'loose', score: 0.1, metadata: { title: 'No document', kind: 'note', snippet: 'a passage with no document' } }]) : [] });
  return w;
}

await S.t('S3: a withdrawn document past the ninetieth hit is still left out', async () => {
  const w = await mindWith(100, [95]);
  try {
    const r = await w.call('POST', '/mind/query', { namespace: 'mca', q: 'anything', topK: 12 }, 'full-key');
    eq(r.status, 200, r.text.slice(0, 200));
    // the route returns topK; ask the shared retrieval directly through a wide query on the module
    const hits = await w.mod.__test.mindDropRetracted(w.env, Array.from({ length: 100 }, (_, i) => ({ meta: { docId: 'doc' + i } })));
    ok(!hits.some(h => h.meta.docId === 'doc95'), 'doc95 is withdrawn and left out');
    eq(hits.length, 99, 'the other 99 stay');
  } finally { w.restore(); }
});

await S.t('S3: when the withdrawal record cannot be read, passages from documents are left out (fail closed), loose ones kept', async () => {
  const w = await mindWith(5, []);
  try {
    const prep = w.env.MIND_DB.prepare.bind(w.env.MIND_DB);
    w.env.MIND_DB.prepare = sql => { if (/status IN \('retracting','retracted'\)/.test(sql)) throw new Error('D1 is down'); return prep(sql); };
    const r = await w.call('POST', '/mind/query', { namespace: 'mca', q: 'anything', topK: 12 }, 'full-key');
    eq(r.status, 200, r.text.slice(0, 200));
    ok(!r.body.hits.some(h => /^Doc /.test(h.title)), 'no passage of a document it could not clear: ' + JSON.stringify(r.body.hits.map(h => h.title)));
    ok(r.body.hits.some(h => h.title === 'No document'), 'a passage with no document is kept');
  } finally { w.restore(); }
});

/* a Studio with a scripted Gemini: each request takes the next answer (bytes as base64, the declared type) */
async function studioWith(answers) {
  const w = await workerEnv({ keys: KEYS, env: { GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
  const gem = { calls: [] };
  w.answer(/generativelanguage/, async u => {
    if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [] }), { status: 200 });
    gem.calls.push(decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || ''));
    const a = answers.length > 1 ? answers.shift() : answers[0];
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: a.mime || 'image/png', data: a.b64 } }] } }] }), { status: 200 });
  });
  const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: '', title: 'bytes', brief: { objective: 'o', message: 'm', channels: ['instagram'] } }, 'full-key')).body.id;
  const A = (await w.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Two more crossings' }, mode: 'composition' }, 'full-key')).body.asset.id;
  const render = async input => {
    const j = (await w.call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: Object.assign({ prompt: 'a ferry at dawn', aspect: '1:1' }, input || {}), idem: 'r' + Math.random() }, 'full-key')).body.job;
    let job = j; for (let i = 0; i < 6 && (job.state === 'queued' || job.state === 'running'); i++) job = (await w.call('POST', '/studio/job/step', { id: j.id }, 'full-key')).body.job;
    return job;
  };
  const versions = async () => (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body.assets[0].versions;
  return { w, gem, P, A, render, versions };
}
const WHOLE = pngBytes(64, 64);

await S.t('S4: a cut-off PNG and a JPEG without its end are malformed, retried within the policy and never filed', async () => {
  const cut = WHOLE.subarray(0, WHOLE.length - 30).toString('base64');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x40, 0x00, 0x40, 0x03]), Buffer.alloc(200, 7)]).toString('base64');
  const x = await studioWith([{ b64: cut }, { b64: jpeg, mime: 'image/jpeg' }, { b64: cut }, { b64: jpeg, mime: 'image/jpeg' }]);
  try {
    const job = await x.render();
    const vs = await x.versions();
    ok(!vs.some(v => v.image && v.image.key), 'no version carries the broken image: ' + JSON.stringify(vs.map(v => v.kind)));
    const rows = (await x.w.env.MIND_DB.prepare("SELECT outcome FROM studio_dispatch WHERE kind='image'").all()).results.map(r => r.outcome);
    ok(rows.length >= 2 && rows.every(o => o === 'malformed'), 'every request is recorded as malformed: ' + rows.join(', '));
    ok(job.state === 'failed' || job.state === 'queued', 'the job did not succeed: ' + job.state);
  } finally { x.w.restore(); }
});

await S.t('S4: a whole image after a broken one is filed, its type taken from the bytes', async () => {
  const cut = WHOLE.subarray(0, WHOLE.length - 30).toString('base64');
  const x = await studioWith([{ b64: cut }, { b64: WHOLE.toString('base64'), mime: 'image/jpeg' }]);
  try {
    const job = await x.render();
    eq(job.state, 'done', 'the render lands: ' + JSON.stringify(job.error || ''));
    const v = (await x.versions()).find(v => v.image && v.image.key);
    ok(v, 'a version carries the image');
    const obj = x.w.r2.get(v.image.key);
    eq(obj.o.httpMetadata.contentType, 'image/png', 'stored as what the bytes are, not what was declared');
    eq(obj.v.length, WHOLE.length, 'the whole image was filed, not the broken one before it');
  } finally { x.w.restore(); }
});

await S.t('S6: a render job naming a model outside the chain is sent to the chain\'s head', async () => {
  const x = await studioWith([{ b64: WHOLE.toString('base64') }]);
  try {
    await x.render({ model: 'someone-elses-model-9' });
    ok(x.gem.calls.length >= 1, 'a request went');
    ok(!x.gem.calls.some(m => /someone-elses/.test(m)), 'the named model was never asked: ' + x.gem.calls.join(', '));
    eq(x.gem.calls[0], 'gemini-3-pro-image', 'the chain\'s head was asked first');
    await x.render({ model: 'gemini-2.5-flash-image' });
    eq(x.gem.calls[x.gem.calls.length - 1], 'gemini-2.5-flash-image', 'a model of the chain may still be put first');
  } finally { x.w.restore(); }
});

await S.t('S4: a finished creative whose bitmap on file is not whole is left out of the export with the reason', async () => {
  const x = await studioWith([{ b64: WHOLE.toString('base64') }]);
  try {
    const db = x.w.env.MIND_DB; const key = 'studio/' + x.P + '/' + x.A + '/broken.png';
    await x.w.env.MIND_DOCS.put(key, WHOLE.subarray(0, 50));
    const cur = (await db.prepare('SELECT current FROM studio_assets WHERE id=?').bind(x.A).first()).current;
    await db.prepare("UPDATE studio_versions SET mode='finished', image=? WHERE id=?").bind(JSON.stringify({ key, url: '/studio/file?key=' + key }), cur).run();
    // the stand-in readiness of a finished creative: its words and marks read back, approvals standing
    const mod = x.w.mod.__test;
    const out = await mod.stFinishedBitmapCheck(x.w.env, key);
    eq(out.ok, false, 'the broken bitmap is refused: ' + JSON.stringify(out));
    ok(/not a whole image/.test(out.why), out.why);
    await x.w.env.MIND_DOCS.put(key, WHOLE);
    eq((await mod.stFinishedBitmapCheck(x.w.env, key)).ok, true, 'a whole bitmap passes');
  } finally { x.w.restore(); }
});

/* an RGBA PNG drawn pixel by pixel: fn(x, y) -> [r, g, b, a] */
function rgbaPng(w, h, fn) {
  const row = 1 + w * 4; const raw = Buffer.alloc(row * h);
  for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let x = 0; x < w; x++) { const q = fn(x, y); raw.set(q, y * row + 1 + x * 4); } }
  const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', hd), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const WORDMARK = rgbaPng(200, 50, (x, y) => (y >= 8 && y < 42 && (x % 20) < 12) ? [255, 255, 255, 255] : [0, 0, 0, 0]);   // white bars on transparency
async function measured() {
  const w = await workerEnv({ keys: KEYS });
  await w.call('POST', '/brand/kit', { ns: 'synthdemo', name: 'Harbourline Ferries - SYNTHETIC DEMO CLIENT', campaigns: [{ id: 'nightboat', name: 'Night boat', logoPolicy: 'wordmark' }] }, 'full-key');
  await w.call('POST', '/brand/kit', { ns: 'synthdemo', wordmarkCampaign: 'nightboat', wordmarkB64: WORDMARK.toString('base64'), wordmarkMime: 'image/png' }, 'full-key');
  const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: 'nightboat', title: 'D3', brief: { objective: 'o', message: 'm' } }, 'full-key')).body.id;
  const cur = async A => { const g = (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body; const a = g.assets.find(x => x.id === A); return { a, v: a.versions.find(x => x.id === a.current) }; };
  const file = async (A, png, opts) => { const { a, v } = await cur(A); return w.call('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a, opts), imageB64: png ? png(v).toString('base64') : undefined }, 'full-key'); };
  return { w, P, cur, file };
}
const TEXT_ONLY = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#123B2A', regions: [], layers: [{ id: 'h', type: 'text', role: 'headline', x: 8, y: 40, w: 80, h: 20, size: 6, weight: 800, color: '#FFFFFF' }] };
const flat = rgb => v => rgbaPng(v.layout.stage.w, v.layout.stage.h, () => rgb.concat([255]));

await S.t('S5: a measurement without the PNG it measured is refused and nothing is recorded', async () => {
  const x = await measured();
  try {
    const A = (await x.w.call('POST', '/studio/asset', { project: x.P, family: 'F', channel: 'instagram', format: '1:1', title: 'Text', copy: { headline: 'The night boat runs Fridays' }, layout: TEXT_ONLY, mode: 'composition' }, 'full-key')).body.asset.id;
    const r = await x.file(A, null);
    eq(r.status, 422, r.text.slice(0, 200)); eq(r.body.error, 'png_required');
    eq((await x.w.env.MIND_DB.prepare('SELECT COUNT(*) n FROM studio_validations WHERE asset=?').bind(A).first()).n, 0, 'nothing recorded');
  } finally { x.w.restore(); }
});

await S.t('S5: an image saved after approval is never bound to a measurement filed without one', async () => {
  const x = await measured();
  try {
    const A = (await x.w.call('POST', '/studio/asset', { project: x.P, family: 'F', channel: 'instagram', format: '1:1', title: 'Text', copy: { headline: 'The night boat runs Fridays' }, layout: TEXT_ONLY, mode: 'composition' }, 'full-key')).body.asset.id;
    const ok1 = await x.file(A, flat([10, 30, 20])); eq(ok1.status, 200, ok1.text.slice(0, 200)); ok(ok1.body.validation.ok, JSON.stringify(ok1.body.validation.issues));
    // a measurement from before the release candidate: no image kept with it
    await x.w.env.MIND_DB.prepare("UPDATE studio_validations SET export_key='', export_hash=NULL WHERE asset=?").bind(A).run();
    eq((await x.w.call('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'words agreed' }, 'full-key')).status, 200);
    const ap = await x.w.call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'layout agreed' }, 'full-key'); eq(ap.status, 200, ap.text.slice(0, 200));
    const { v } = await x.cur(A);
    const other = rgbaPng(1080, 1080, () => [200, 0, 0, 255]).toString('base64');
    const sv = await x.w.call('POST', '/studio/render/save', { asset: A, version: v.id, imageB64: other, mime: 'image/png' }, 'full-key');
    eq(sv.status, 409, sv.text.slice(0, 200)); eq(sv.body.error, 'export_locked');
  } finally { x.w.restore(); }
});

await S.t('D3: words the ground swallows fail on the worker\'s own reading, though the report says they read', async () => {
  const x = await measured();
  try {
    const A = (await x.w.call('POST', '/studio/asset', { project: x.P, family: 'F', channel: 'instagram', format: '1:1', title: 'Text', copy: { headline: 'The night boat runs Fridays' }, layout: TEXT_ONLY, mode: 'composition' }, 'full-key')).body.asset.id;
    const bad = await x.file(A, flat([255, 255, 255]));   // white words on a white image, reported at 7:1
    eq(bad.status, 200, bad.text.slice(0, 200));
    ok(!bad.body.validation.ok, 'not a pass');
    ok(bad.body.validation.issues.some(i => i.code === 'unreadable_contrast' && i.layers.indexOf('h') >= 0), JSON.stringify(bad.body.validation.issues));
    const good = await x.file(A, flat([10, 30, 20]));    // white words on a dark image: the worker agrees with the report
    ok(good.body.validation.ok, 'an honest image passes: ' + JSON.stringify(good.body.validation.issues));
    const row = await x.w.env.MIND_DB.prepare('SELECT report FROM studio_validations WHERE asset=? ORDER BY created DESC LIMIT 1').bind(A).first();
    const hb = JSON.parse(row.report).boxes.find(b => b.id === 'h');
    ok(hb.server && hb.server.contrast > 7 && !hb.server.adopted, 'the worker\'s figure is kept beside the browser\'s: ' + JSON.stringify(hb.server));
  } finally { x.w.restore(); }
});

await S.t('D3: a wordmark half of whose strokes vanish into a light ground fails on the worker\'s reading of its own file', async () => {
  const x = await measured();
  try {
    const A = (await x.w.call('POST', '/studio/asset', { project: x.P, family: 'F', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Fridays, 9.40pm, Pier 3' }, mode: 'composition' }, 'full-key')).body.asset.id;
    const { v } = await x.cur(A); const mk = v.layout.layers.find(l => l.role === 'wordmark');
    ok(mk && mk.src, 'the house layout places the wordmark: ' + JSON.stringify(v.layout.layers.map(l => l.role)));
    // the composite: cream above the wordmark's middle, dark green below, with the wordmark's white strokes drawn where the renderer contains them
    const W = v.layout.stage.w, H = v.layout.stage.h; const bx = mk.x / 100 * W, by = mk.y / 100 * H, bw = mk.w / 100 * W, bh = mk.h / 100 * H;
    const s = Math.min(bw / 200, bh / 50), ox = bx + (bw - 200 * s) / 2, oy = by + (bh - 50 * s) / 2, mid = oy + 25 * s;
    const comp = () => rgbaPng(W, H, (X, Y) => { const fx = Math.floor((X + 0.5 - ox) / s), fy = Math.floor((Y + 0.5 - oy) / s); if (fx >= 0 && fy >= 0 && fx < 200 && fy < 50 && fy >= 8 && fy < 42 && (fx % 20) < 12) return [255, 255, 255, 255]; return Y < mid ? [247, 244, 238, 255] : [18, 59, 42, 255]; });
    const r = await x.file(A, comp);
    eq(r.status, 200, r.text.slice(0, 300));
    const iss = r.body.validation.issues;
    ok(iss.some(i => i.code === 'mark_unreadable' && i.layers.indexOf(mk.id) >= 0), 'the wordmark does not read: ' + JSON.stringify(iss.map(i => i.code + ':' + i.layers.join(','))));
  } finally { x.w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
