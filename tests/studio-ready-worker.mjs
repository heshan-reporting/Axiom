/* Studio test readiness (S28), the blockers, on the worker. Each case failed on d2a51b1.
 *  B1 learning: a decision is filed in the client's memory once, a withdrawal takes it back, the "ready for design" hand-off and a
 *     test project file nothing, a guest key cannot change a live client's brand memory, and the kit can be restored from its history.
 *  B2 identity: drafts belong to the person (a hash of their key), not to a display name two people can share; anonymous public
 *     mode cannot write in the Studio.
 *  B3 export integrity: the validated PNG is content-addressed and checked (PNG, the stage's size); what is approved or shared cannot
 *     be replaced, and the export names the file and its hash.
 *  B4 spend: a person's daily cap holds while another person can still run.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-ready-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngB64, pngForVersion } from './png.mjs';
import { answerFor } from './studio-answers.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const T = suite('studio-ready-worker (learning once and retracted, test projects, person identity, export integrity, per-person caps)');
const KEYS = { 'key-sam-one': { n: 'Sam', r: 'full' }, 'key-sam-two': { n: 'Sam', r: 'full' }, 'key-jo-full': { n: 'Jo', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const GUESTS = { 'guest-key-tester': { n: 'Tester', r: 'full', until: '2099-01-01' } };
const w = await workerEnv({ keys: KEYS, env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS), STUDIO_PERSON_DAILY_CALLS: '1' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'key-jo-full' : k);
const db = w.env.MIND_DB;
const rows = async (sql, ...args) => ((await db.prepare(sql).bind(...args).all()).results || []);
/** a PNG header with a real IHDR (width, height) and filler: enough for the worker's checks */
const png = (wd, ht, fill) => pngB64(wd, ht, { fill: fill || 1 });   // p44: a whole PNG (the worker decodes a measured export)
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const get = async (P, k) => (await call('GET', '/studio/get?id=' + P, null, k)).body;
async function project(title, extra, key) { const r = await call('POST', '/studio/project', Object.assign({ ns: 'mca', title, brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits are not a subsidy' } }, extra || {}), key); if (r.status !== 200) throw new Error('project: ' + JSON.stringify(r.body)); return r.body; }
async function asset(P, mode, key) { const r = await call('POST', '/studio/asset', Object.assign({ project: P, family: 'F', channel: 'facebook', format: '1:1', title: 'Piece ' + mode, copy: { headline: 'Not a subsidy. A tax that never applied.' }, mode }, mode === 'copy' ? {} : { layout: LAYOUT }), key); if (r.status !== 200) throw new Error('asset: ' + JSON.stringify(r.body)); return r.body.asset; }
const outcomes = A => rows("SELECT * FROM engine_outcomes WHERE surface='studio' AND ref LIKE ?", A + '%');

await T.t('B1 a decision is filed in the client\'s memory once; approving again files nothing more; withdrawing takes it back out of the Mind', async () => {
  const P = (await project('Learning once')).id; const a = await asset(P, 'copy');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Reads right for the campaign' })).status, 200);
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Reads right for the campaign' })).status, 200);
  let o = await outcomes(a.id); eq(o.length, 1, 'one outcome for one decision on one version: ' + JSON.stringify(o.map(x => [x.ref, x.verdict])));
  const doc = o[0].doc; ok(doc, 'the Mind document is recorded on the outcome');
  eq((await rows('SELECT status FROM mind_docs WHERE id=?', doc))[0].status, 'complete');
  ok(Array.from(w.vectors.keys()).some(k => k.indexOf(doc + '_') === 0), 'indexed');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'withdraw' })).status, 200);
  o = await outcomes(a.id); ok(o[0].withdrawn > 0, 'the outcome is marked withdrawn');
  eq((await rows('SELECT status FROM mind_docs WHERE id=?', doc))[0].status, 'retracted', 'the Mind document is retracted');
  ok(!Array.from(w.vectors.keys()).some(k => k.indexOf(doc + '_') === 0), 'its vectors are gone, so no brief retrieves it');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Reads right for the campaign' })).status, 200);
  eq((await outcomes(a.id)).filter(x => !x.withdrawn).length, 1, 'approving again after a withdrawal files it again, once');
});

await T.t('B1 the "ready for design" hand-off on a visual piece files no learning; the design approval files one win for the piece', async () => {
  const P = (await project('Hand-off')).id; const a = await asset(P, 'composition');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'copy ready' })).status, 200);
  eq((await outcomes(a.id)).length, 0, 'the tick is a hand-off, not a verdict the Mind learns from');
  eq((await rows('SELECT * FROM studio_intel_log WHERE project=?', P)).length, 0);
  eq((await rows("SELECT * FROM brand_items WHERE ns='mca' AND body LIKE ?", '%' + a.title + '%')).length, 0);
});

await T.t('B1 a test project files nothing in the client\'s memory and cannot teach a lasting rule; a guest\'s project is a test project', async () => {
  const p = await project('Tester project', { test: true }); eq(p.project ? p.project.test : p.test, true, 'the flag is on the project: ' + JSON.stringify(p).slice(0, 200));
  const a = await asset(p.id, 'copy');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Reads right for the campaign, ship it' })).status, 200);
  eq((await outcomes(a.id)).length, 0, 'no WIN in the client Mind');
  eq((await rows('SELECT * FROM studio_intel_log WHERE project=?', p.id)).length, 0, 'no intelligence log entry');
  eq((await rows("SELECT * FROM brand_items WHERE ns='mca' AND body LIKE ?", '%ship it%')).length, 0, 'no brand proposal');
  const rem = await call('POST', '/studio/remember', { project: p.id, eid: 1, scope: 'client', rule: 'Always say "fuel tax credits"', task: 'copy' });
  eq([rem.status, rem.body.error], [409, 'test_project'], JSON.stringify(rem.body));
  const g = await project('A guest made this', {}, 'guest-key-tester'); eq(g.project ? g.project.test : g.test, true, 'a guest key makes test projects');
  const real = await project('Real work'); eq(!!(real.project ? real.project.test : real.test), false, 'a roster key makes live projects');
});

await T.t('B1 a guest key cannot change a live client\'s brand memory; the synthetic client is open to it', async () => {
  const r = await call('POST', '/brand/kit', { ns: 'mca', voice: 'Shouty and informal' }, 'guest-key-tester');
  eq([r.status, r.body.error], [403, 'guest_live_memory'], JSON.stringify(r.body));
  eq((await call('POST', '/brand/teach', { ns: 'mca', campaign: 'national', kind: 'banned', proposal: { term: 'handout' }, confirm: true, reason: 'tester trying it' }, 'guest-key-tester')).status, 403);
  eq((await call('POST', '/brand/kit', { ns: 'synthdemo', name: 'Harbourline Ferries - SYNTHETIC DEMO CLIENT', voice: 'Calm' }, 'guest-key-tester')).status, 200);
  eq((await call('POST', '/brand/kit', { ns: 'mca', voice: 'Plain, factual, regional.' })).status, 200, 'a roster key still can');
});

await T.t('B1 the brand kit can be restored from its history, with a reason, as a new revision', async () => {
  await call('POST', '/brand/kit', { ns: 'pca', name: 'Property Council', voice: 'First voice' });
  await call('POST', '/brand/kit', { ns: 'pca', voice: 'Second voice' });
  const list = (await call('GET', '/brand/revisions?ns=pca')).body.revisions; ok(list.length >= 2, JSON.stringify(list));
  let first = null; for (const r of list) { const one = (await call('GET', '/brand/revisions?ns=pca&id=' + r.id)).body.revisions[0]; if (one.kit && one.kit.voice === 'First voice') first = one; }
  ok(first, 'the first revision holds the first voice');
  eq((await call('POST', '/brand/kit/restore', { ns: 'pca', revision: first.id })).body.error, 'reason_required');
  eq((await call('POST', '/brand/kit/restore', { ns: 'pca', revision: first.id }, 'read-key')).status, 403);
  const r = await call('POST', '/brand/kit/restore', { ns: 'pca', revision: first.id, reason: 'The second voice was a test edit' }); eq(r.status, 200, JSON.stringify(r.body));
  eq((await call('GET', '/brand/kit?ns=pca')).body.kit.voice, 'First voice');
  const top = (await call('GET', '/brand/revisions?ns=pca')).body.revisions[0]; ok(top.summary.some(s => /restored from revision/.test(s) && /second voice was a test edit/i.test(s)), JSON.stringify(top.summary));
});

await T.t('B2 drafts belong to the person, not the display name: two keys named Sam keep separate drafts and one cannot discard the other\'s', async () => {
  const P = (await project('Drafts')).id; const a = await asset(P, 'composition');
  const v = (await get(P)).assets.find(x => x.id === a.id).current;
  const L = JSON.parse(JSON.stringify(LAYOUT)); L.layers[0].y = 40;
  eq((await call('POST', '/studio/draft', { asset: a.id, version: v, layout: L, copy: {} }, 'key-sam-one')).status, 200);
  eq((await call('GET', '/studio/draft?asset=' + a.id, null, 'key-sam-two')).body.draft, null, 'the other Sam sees no draft');
  eq((await call('POST', '/studio/draft/discard', { asset: a.id }, 'key-sam-two')).status, 200);
  const mine = (await call('GET', '/studio/draft?asset=' + a.id, null, 'key-sam-one')).body.draft; ok(mine && mine.layout.layers[0].y === 40, 'the first Sam keeps theirs: ' + JSON.stringify(mine));
});

await T.t('B2 anonymous public mode cannot write in the Studio or the brand kit; it can still read', async () => {
  const pub = await workerEnv({ keys: KEYS, env: { AXIOM_PUBLIC: 'full' } });
  try {
  const r = await pub.call('POST', '/studio/project', { ns: 'mca', title: 'Anonymous' });
  eq([r.status, r.body.error], [403, 'public_write_refused'], JSON.stringify(r.body));
  eq((await pub.call('POST', '/brand/kit', { ns: 'mca', voice: 'x' })).status, 403);
  eq((await pub.call('GET', '/allnews')).status, 200, 'reading is open in public mode');
  eq((await pub.call('GET', '/studio/list?ns=mca')).status, 401, 'client work needs a link (S29, SEC-5)');
  eq((await pub.call('POST', '/studio/project', { ns: 'mca', title: 'Signed in' }, 'key-jo-full')).status, 200, 'a key still writes');
  } finally { pub.restore(); }
});

await T.t('B3 the validated PNG is content-addressed and checked: not a PNG, or another size than the stage, is refused', async () => {
  const P = (await project('Export integrity')).id; const a = await asset(P, 'composition');
  const g = await get(P); const ax = g.assets.find(x => x.id === a.id); const v = ax.versions.find(x => x.id === ax.current);
  const bad = await call('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, ax), imageB64: png(540, 540) });
  eq([bad.status, bad.body.error], [422, 'image_size'], JSON.stringify(bad.body).slice(0, 300));
  const notPng = await call('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, ax), imageB64: Buffer.from('<html>' + 'x'.repeat(200)).toString('base64') });
  eq([notPng.status, notPng.body.error], [422, 'not_png'], JSON.stringify(notPng.body).slice(0, 300));
  const vd = await call('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, ax), imageB64: png(1080, 1080, 1) });
  eq(vd.status, 200, JSON.stringify(vd.body).slice(0, 300)); ok(vd.body.validation.ok, JSON.stringify(vd.body.validation.issues));
  ok(/-export-[0-9a-f]{16}\.png$/.test(vd.body.validation.exportKey), vd.body.validation.exportKey); ok(/^[0-9a-f]{64}$/.test(vd.body.validation.exportHash || ''), 'the hash is recorded');
  eq([vd.body.validation.exportW, vd.body.validation.exportH], [1080, 1080]);
});

await T.t('B3 what is approved or shared cannot be replaced: render/save refuses other bytes, accepts the same, and the review and export serve the validated file by its hash', async () => {
  const P = (await project('Locked export')).id; const a = await asset(P, 'composition');
  const g = await get(P); const ax = g.assets.find(x => x.id === a.id); const v = ax.versions.find(x => x.id === ax.current);
  const vd = await call('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, ax), imageB64: png(1080, 1080, 1) }); const key = vd.body.validation.exportKey;
  // before any approval the working file may be saved again: the validated file is never touched
  const early = await call('POST', '/studio/render/save', { asset: a.id, version: v.id, imageB64: png(1080, 1080, 2), mime: 'image/png' }); eq(early.status, 200, JSON.stringify(early.body));
  ok(early.body.key !== key, 'a working file never takes the validated file\'s place'); eq(w.r2.get(key).v.toString('base64'), png(1080, 1080, 1));
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Words are right' })).status, 200);
  const ap = await call('POST', '/studio/approve', { asset: a.id, part: 'design', decision: 'approve', reason: 'Layout is right' }); eq(ap.status, 200, JSON.stringify(ap.body));
  const other = await call('POST', '/studio/render/save', { asset: a.id, version: v.id, imageB64: png(1080, 1080, 7), mime: 'image/png' });
  eq([other.status, other.body.error, other.body.key], [409, 'export_locked', key], JSON.stringify(other.body));
  eq(w.r2.get(key).v.toString('base64'), png(1080, 1080, 1), 'the validated bytes are unchanged');
  const same = await call('POST', '/studio/render/save', { asset: a.id, version: v.id, imageB64: png(1080, 1080, 1), mime: 'image/png' }); eq([same.status, same.body.key], [200, key]);
  ok((await get(P)).thread.some(e => e.kind === 'export_image'), 'every save is on the thread');
  const j = await call('POST', '/studio/job', { project: P, stage: 'export', input: {}, idem: 'ex:' + P }); let job = j.body.job;
  for (let i = 0; i < 4 && (job.state === 'queued' || job.state === 'running'); i++) job = (await call('POST', '/studio/job/step', { id: job.id })).body.job;
  eq(job.state, 'done', job.error); eq(job.result.included[0].exportKey, key); eq(job.result.included[0].exportHash, vd.body.validation.exportHash);
});

await T.t('B4 a person\'s daily cap holds while another person can still run, and the refusal names the person\'s cap', async () => {
  const P = (await project('Caps', { brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits are not a subsidy', audience: 'Regional voters' } }, 'key-sam-one')).id;
  const job = async (k, n) => { const r = await call('POST', '/studio/job', { project: P, stage: 'strategy', input: { instruction: 'draft ' + n }, idem: 'cap:' + n }, k); let j = r.body.job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id }, 'key-jo-full')).body.job; return j; };
  const a1 = await job('key-sam-one', 1); eq(a1.state, 'done', a1.error);
  const a2 = await job('key-sam-one', 2); eq(a2.state, 'failed'); ok(/person_budget_exhausted/.test(a2.error || ''), a2.error);
  const b1 = await job('key-jo-full', 3); eq(b1.state, 'done', 'someone else can still run: ' + b1.error);
  const bud = (await call('GET', '/studio/budget', null, 'key-sam-one')).body; ok(bud.you && bud.you.calls && bud.you.calls.used === 1 && bud.you.calls.cap === 1, JSON.stringify(bud.you));
});

w.restore();
T.done();
