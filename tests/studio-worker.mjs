/* Creative Studio Phase 1: secure projects, immutable versions, approvals that
 * name their content, durable jobs, legacy access. Every acceptance line of the
 * approved proposal's Phase 1 has a case here. The worker runs against a real
 * SQLite behind the D1 API (d1lite.mjs), stub KV and R2, and a stub Gemini.
 * Run: node --experimental-sqlite tests/studio-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const mkEnv = (over) => Object.assign({
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v, httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
}, over || {});
const env = mkEnv();
let gemini = 'ok'; const calls = { gemini: 0, anthropic: 0 };
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    calls.gemini++;
    if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }, { name: 'models/gemini-3.6-flash' }] }), { status: 200 });
    if (gemini === '503') return new Response(JSON.stringify({ error: { code: 503, message: 'The model is overloaded' } }), { status: 503 });
    if (gemini === '400') return new Response(JSON.stringify({ error: { code: 400, message: 'Invalid argument: prompt' } }), { status: 400 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/models') >= 0) { calls.anthropic++; return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-4-6' }] }), { status: 200 }); }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key', e = env) {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, e, ctx); let d = null; try { d = await res.json(); } catch (x) { d = null; } return { status: res.status, d, res };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;

console.log('studio-worker harness (Phase 1)');
await t('the creative endpoints are gated: no key is 401, a read key is 403 on writes, and GETs under /studio read', async () => {
  for (const p of ['/chat', '/nano', '/clickup', '/studio/project']) eq((await req('POST', p, { messages: [{ role: 'user', content: 'x' }], prompt: 'x', ns: 'mca' }, null)).status, 401, p + ' without a key');
  for (const p of ['/chat', '/nano', '/clickup', '/studio/project', '/studio/job']) eq((await req('POST', p, { messages: [{ role: 'user', content: 'x' }], prompt: 'x', ns: 'mca' }, 'read-key')).status, 403, p + ' with a read key');
  const r = await req('GET', '/studio/status', null, 'read-key'); eq(r.status, 200); ok(/studio-p\d/.test(r.d.build), r.d.build); eq(r.d.phase, 2);
  eq((await req('GET', '/studio/list?ns=mca', null, 'read-key')).status, 200);
  eq((await req('GET', '/engine/status?ns=mca', null, 'read-key')).d.build, r.d.build, 'the deploy check route carries the same build id');
});
await t('a broken key roster fails closed: nothing opens, every key is refused with the reason', async () => {
  const e2 = mkEnv({ AXIOM_KEYS: '{not json', AXIOM_ACCESS_KEY: undefined });
  const a = await req('GET', '/studio/status', null, 'full-key', e2); eq(a.status, 401); eq(a.d.error, 'auth_misconfigured');
  eq((await req('GET', '/studio/status', null, null, e2)).status, 401);
  eq((await req('POST', '/nano', { prompt: 'x' }, 'anything', e2)).status, 401);
  const e3 = mkEnv({ AXIOM_KEYS: '[]', AXIOM_ACCESS_KEY: undefined }); eq((await req('GET', '/studio/status', null, 'full-key', e3)).d.error, 'auth_misconfigured', 'an array is not a roster');
  const e4 = mkEnv({ AXIOM_KEYS: '{bad', AXIOM_ACCESS_KEY: 'master', MIND_DB: env.MIND_DB }); eq((await req('GET', '/studio/status', null, 'master', e4)).status, 200, 'the single access key still works beside a broken roster');
});
let P = '', A = '', V1 = '';
await t('a project is created for one client once: the same idempotency key returns the same project; it lists under its client only', async () => {
  const a = await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fuel tax credit spike', brief: { objective: 'answer the subsidy framing' }, idem: 'idem-1' });
  eq(a.status, 200, JSON.stringify(a.d).slice(0, 200)); eq(a.d.ns, 'mca'); eq(a.d.existing, false); P = a.d.id;
  const b = await req('POST', '/studio/project', { ns: 'aep', title: 'other', idem: 'idem-1' }); eq(b.d.existing, true); eq(b.d.id, P); eq(b.d.ns, 'mca', 'the idempotent replay cannot change the client');
  eq((await req('POST', '/studio/project', { title: 'no ns' })).status, 400);
  const l = await req('GET', '/studio/list?ns=mca', null, 'read-key'); eq(l.d.projects.map(p => p.id), [P]);
  eq((await req('GET', '/studio/list?ns=aep', null, 'read-key')).d.projects, [], 'namespaces stay walls');
  const g = await req('GET', '/studio/get?id=' + P, null, 'read-key'); eq(g.d.title, 'Fuel tax credit spike'); eq(g.d.thread.length, 1); eq(g.d.revision, 1);
});
await t('a source keeps its passages; a reference keeps its purpose and an inspiration note; a direction can be chosen', async () => {
  const s = await req('POST', '/studio/source', { project: P, kind: 'release', name: 'release.txt', text: 'Mining paid $74 billion in company tax and royalties in 2023-24.\n\n"Businesses do not pay a road fuel tax on fuel used off-road," Ms Constable said.' });
  eq(s.status, 200); eq(s.d.passages, 2);
  eq((await req('POST', '/studio/source', { project: P, text: 'short' })).status, 400);
  const r = await req('POST', '/studio/reference', { project: P, kind: 'image', name: 'Farm lobby ad', purpose: 'inspiration', imageB64: PNG, mime: 'image/png' }); eq(r.status, 200); ok(/^studio\/.*\/refs\//.test(r.d.key), r.d.key); ok(r2.has(r.d.key));
  const d1 = await req('POST', '/studio/direction', { project: P, data: { title: 'The plain ask' } }); const d2 = await req('POST', '/studio/direction', { project: P, data: { title: 'Who it really is' } });
  eq((await req('POST', '/studio/direction/choose', { id: d2.d.id })).status, 200);
  const g = await req('GET', '/studio/get?id=' + P); eq(g.d.sources.length, 1); eq(Object.keys(g.d.sources[0].passages), ['p1', 'p2']); eq(g.d.sources[0].claims, [], 'the ledger is extracted in Phase 2');
  ok(/Inspiration only/.test(g.d.references[0].note)); eq(g.d.directions.map(x => [x.title, x.chosen]), [['The plain ask', false], ['Who it really is', true]]);
  const f = await req('GET', '/studio/file?key=' + encodeURIComponent(r.d.key), null, 'read-key'); eq(f.status, 200); ok(/image\/png/.test(f.res.headers.get('content-type')));
  eq((await req('GET', '/studio/file?key=packs/x/1.png', null, 'read-key')).status, 400, 'only Studio keys are served here');
});
await t('versions are immutable: a change appends and moves current, the earlier version is unchanged, a stale revision is refused with the current one', async () => {
  const a = await req('POST', '/studio/asset', { project: P, family: 'LinkedIn set', channel: 'linkedin', format: '1:1', title: 'LinkedIn post', copy: { headline: 'Fuel tax credits are not a subsidy.', caption: 'Mining paid $74 billion.' }, image: { key: 'studio/x/y/z.png', model: 'gemini-3-pro-image', size: '2K' } });
  eq(a.status, 200); A = a.d.asset.id; V1 = a.d.asset.current; eq(a.d.asset.versions.length, 1); eq(a.d.asset.revision, 2);
  const v2 = await req('POST', '/studio/version', { asset: A, revision: 2, copy: { headline: 'Not a subsidy. Never was.' }, note: 'sharper headline' });
  eq(v2.status, 200, JSON.stringify(v2.d).slice(0, 200)); eq(v2.d.version.kind, 'text'); eq(v2.d.version.parent, V1); eq(v2.d.asset.current, v2.d.version.id); eq(v2.d.asset.versions.length, 2);
  eq(v2.d.asset.versions[0].copy.headline, 'Fuel tax credits are not a subsidy.', 'the first version is untouched'); eq(v2.d.version.copy.caption, 'Mining paid $74 billion.', 'unchanged fields carry over'); eq(v2.d.version.image.key, 'studio/x/y/z.png', 'the image carries over on a text change');
  const stale = await req('POST', '/studio/version', { asset: A, revision: 2, copy: { headline: 'x' } }); eq(stale.status, 409); eq(stale.d.error, 'conflict'); eq(stale.d.revision, 3);
  eq((await req('GET', '/studio/get?id=' + P)).d.assets[0].versions.length, 2, 'the refused write wrote nothing');
});
await t('a supplied namespace or project id cannot cross a boundary: the asset\'s stored project decides, a mismatch is refused, a foreign asset id is unknown', async () => {
  const other = await req('POST', '/studio/project', { ns: 'aep', title: 'AEP project' }); const oa = await req('POST', '/studio/asset', { project: other.d.id, title: 'AEP asset', copy: { headline: 'gas' } });
  const x = await req('POST', '/studio/version', { asset: A, project: other.d.id, revision: 3, copy: { headline: 'smuggled' } }); eq(x.status, 403); eq(x.d.error, 'cross_project');
  const y = await req('POST', '/studio/version', { asset: A, ns: 'aep', revision: 3, copy: { headline: 'ns ignored' }, note: 'ns param' }); eq(y.status, 200); eq((await req('GET', '/studio/get?id=' + P)).d.ns, 'mca');
  eq((await req('POST', '/studio/job', { project: P, asset: oa.d.asset.id, stage: 'echo' })).d.error, 'cross_project');
  eq((await req('POST', '/studio/version', { asset: 'a_nope', copy: {} })).status, 404);
  eq((await req('GET', '/studio/list?ns=aep')).d.projects.map(p => p.title), ['AEP project']);
  eq((await req('GET', '/studio/get?id=' + other.d.id)).d.assets[0].versions[0].copy.headline, 'gas', 'the other client\'s work is intact');
});
await t('approvals name the content they accept: a copy edit drops the copy approval and leaves design standing; withdraw and reject record reasons; restore keeps history', async () => {
  eq((await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve' })).status, 400, 'a reason is required');
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'client asked for the plain ask' }); eq(ap.status, 200); ok(ap.d.approvals.copy && ap.d.approvals.copy.reason === 'client asked for the plain ask');
  await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'fine' });
  let g = await req('GET', '/studio/get?id=' + P); ok(g.d.assets[0].approvals.copy && g.d.assets[0].approvals.design, 'both stand');
  const cur = g.d.assets[0];
  await req('POST', '/studio/version', { asset: A, revision: cur.revision, copy: { cta: 'Learn more today' }, note: 'cta tweak' });
  g = await req('GET', '/studio/get?id=' + P); ok(!g.d.assets[0].approvals.copy, 'copy approval no longer stands'); ok(g.d.assets[0].approvals.design && g.d.assets[0].approvals.design.carried === true, 'design approval carried: its content is unchanged');
  await req('POST', '/studio/version', { asset: A, revision: g.d.assets[0].revision, image: { key: 'studio/x/y/new.png', model: 'gemini-3-pro-image', size: '2K' }, kind: 'render', note: 'new background' });
  g = await req('GET', '/studio/get?id=' + P); ok(!g.d.assets[0].approvals.design, 'a new image drops the design approval');
  const vs = g.d.assets[0].versions; eq(vs.length, 5);
  const rs = await req('POST', '/studio/version', { asset: A, revision: g.d.assets[0].revision, restoreFrom: vs[1].id }); eq(rs.status, 200); eq(rs.d.version.kind, 'restore'); eq(rs.d.version.restoredFrom, vs[1].id); eq(rs.d.version.copy.headline, 'Not a subsidy. Never was.'); eq(rs.d.asset.versions.length, 6, 'restore appends; nothing is deleted');
  const rj = await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'reject', reason: 'no trucks on HOOF organic' }); eq(rj.status, 200); ok(!rj.d.approvals.copy);
  const ev = (await req('GET', '/studio/get?id=' + P)).d.thread; ok(ev.some(e => /Rejected copy .* no trucks on HOOF organic\. Recorded as client acceptance or feedback, not performance/.test(e.text)), JSON.stringify(ev.slice(-2)));
});
await t('locks: a locked element refuses a version write until unlocked or deliberately overridden', async () => {
  let g = await req('GET', '/studio/get?id=' + P); const a = g.d.assets[0];
  const lk = await req('POST', '/studio/lock', { asset: A, element: 'headline' }); eq(lk.d.asset.locks, { headline: true });
  const w = await req('POST', '/studio/version', { asset: A, copy: { headline: 'changed anyway' } }); eq(w.status, 409); eq(w.d.error, 'locked'); eq(w.d.element, 'headline');
  eq((await req('POST', '/studio/version', { asset: A, copy: { caption: 'other field is fine' } })).status, 200);
  eq((await req('POST', '/studio/version', { asset: A, copy: { headline: 'changed deliberately' }, unlock: true })).status, 200);
  await req('POST', '/studio/lock', { asset: A, element: 'headline', locked: false });
  g = await req('GET', '/studio/get?id=' + P); eq(g.d.assets[0].locks, {});
});
let J = '';
await t('jobs: the same idempotency key makes one job; a step claims and runs it; the result is on the job and the project thread', async () => {
  const a = await req('POST', '/studio/job', { project: P, stage: 'echo', input: { hello: 'world' }, idem: 'job-1' }); eq(a.status, 200); eq(a.d.existing, false); eq(a.d.job.state, 'queued'); J = a.d.job.id;
  const b = await req('POST', '/studio/job', { project: P, stage: 'echo', input: { hello: 'again' }, idem: 'job-1' }); eq(b.d.existing, true); eq(b.d.job.id, J);
  eq((await req('GET', '/studio/jobs?project=' + P, null, 'read-key')).d.jobs.length, 1);
  eq((await req('POST', '/studio/job', { project: P, stage: 'teleport' })).d.error, 'unknown_stage');
  const s = await req('POST', '/studio/job/step', { id: J }); eq(s.d.job.state, 'done'); eq(s.d.job.attempts, 1); eq(s.d.job.result.echo, { hello: 'world' });
  eq((await req('POST', '/studio/job/step', { id: J })).d.job.state, 'done', 'stepping a finished job changes nothing');
  eq((await req('GET', '/studio/job?id=' + J, null, 'read-key')).d.job.state, 'done');
});
await t('a render job files a version with the image in R2 and moves current; a result for a version the asset has left is filed as a branch, never over newer work', async () => {
  let g = await req('GET', '/studio/get?id=' + P); const before = g.d.assets[0].current;
  const j = await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'harvester at dusk', size: '2K' }, idem: 'render-1' }); eq(j.d.job.inputVersion, before);
  const s = await req('POST', '/studio/job/step', { id: j.d.job.id }); eq(s.d.job.state, 'done', JSON.stringify(s.d.job).slice(0, 200)); eq(s.d.job.result.branch, false); ok(r2.has(s.d.job.result.key), 'image stored'); ok(/^studio\/p/.test(s.d.job.result.key));
  g = await req('GET', '/studio/get?id=' + P); eq(g.d.assets[0].current, s.d.job.result.version); eq(g.d.assets[0].versions[g.d.assets[0].versions.length - 1].image.model, 'gemini-3-pro-image'); eq(g.d.assets[0].versions[g.d.assets[0].versions.length - 1].image.size, '2K');
  // the asset moves on while a second render waits
  const j2 = await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'second' }, idem: 'render-2' });
  const hand = await req('POST', '/studio/version', { asset: A, copy: { headline: 'a hand edit while the render waits' }, note: 'hand edit' }); const newest = hand.d.version.id;
  const s2 = await req('POST', '/studio/job/step', { id: j2.d.job.id }); eq(s2.d.job.state, 'done'); eq(s2.d.job.result.branch, true);
  g = await req('GET', '/studio/get?id=' + P); eq(g.d.assets[0].current, newest, 'current is still the hand edit'); const br = g.d.assets[0].versions.find(v => v.id === s2.d.job.result.version); eq(br.parent, j2.d.job.inputVersion, 'the branch hangs off the version it was asked for');
  ok(g.d.thread.some(e => /filed as version .* branching/.test(e.text)));
});
await t('a runner that stopped leaves an expired lease; the cron claims and finishes the job; a duplicate claim is refused', async () => {
  const j = await req('POST', '/studio/job', { project: P, stage: 'echo', input: { n: 1 }, idem: 'abandoned' });
  db.prepare("UPDATE studio_jobs SET state='running', attempts=1, lease_until=? WHERE id=?").run(Date.now() - 1000, j.d.job.id);
  const s = await req('POST', '/studio/job/step', { id: j.d.job.id }); eq(s.d.job.state, 'done'); eq(s.d.job.attempts, 2);
  const k = await req('POST', '/studio/job', { project: P, stage: 'echo', input: { n: 2 }, idem: 'held' });
  db.prepare("UPDATE studio_jobs SET state='running', attempts=1, lease_until=? WHERE id=?").run(Date.now() + 60000, k.d.job.id);
  const held = await req('POST', '/studio/job/step', { id: k.d.job.id }); eq(held.d.job.state, 'running'); ok(/another runner holds the lease/.test(held.d.job.note));
  db.prepare("UPDATE studio_jobs SET lease_until=? WHERE id=?").run(Date.now() - 1, k.d.job.id);
  const cron = await mod.__studioCron(env); ok(cron.ran >= 1 && cron.done >= 1, JSON.stringify(cron));
  eq((await req('GET', '/studio/job?id=' + k.d.job.id)).d.job.state, 'done');
});
await t('retries are bounded and tell transient from invalid: 503 requeues up to three attempts then fails; 400 fails at once; cancel stops a queued job and notes an in-flight one', async () => {
  gemini = '503';
  const j = await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'x' }, idem: 'flaky' });
  let s = await req('POST', '/studio/job/step', { id: j.d.job.id }); eq(s.d.job.state, 'queued', 'after a 503: ' + s.d.job.error); eq(s.d.job.attempts, 1); ok(/will retry/.test(s.d.job.error), s.d.job.error);
  s = await req('POST', '/studio/job/step', { id: j.d.job.id }); eq(s.d.job.state, 'queued'); eq(s.d.job.attempts, 2);
  s = await req('POST', '/studio/job/step', { id: j.d.job.id }); eq(s.d.job.state, 'failed'); eq(s.d.job.attempts, 3); ok(/attempts exhausted/.test(s.d.job.error));
  eq((await req('POST', '/studio/job/step', { id: j.d.job.id })).d.job.state, 'failed', 'no fourth attempt');
  gemini = '400';
  const b = await req('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'bad' }, idem: 'invalid' });
  s = await req('POST', '/studio/job/step', { id: b.d.job.id }); eq(s.d.job.state, 'failed'); eq(s.d.job.attempts, 1); ok(/not a transient failure/.test(s.d.job.error), s.d.job.error);
  gemini = 'ok';
  const c = await req('POST', '/studio/job', { project: P, stage: 'echo', idem: 'cancel-me' }); const cc = await req('POST', '/studio/job/cancel', { id: c.d.job.id }); eq(cc.d.job.state, 'cancelled'); ok(/before it ran/.test(cc.d.job.error));
  const d = await req('POST', '/studio/job', { project: P, stage: 'echo', idem: 'cancel-running' }); db.prepare("UPDATE studio_jobs SET state='running', attempts=1, lease_until=? WHERE id=?").run(Date.now() + 60000, d.d.job.id);
  const dc = await req('POST', '/studio/job/cancel', { id: d.d.job.id }); eq(dc.d.job.state, 'cancelled'); ok(/may still complete and cost/.test(dc.d.job.error));
  eq((await req('POST', '/studio/job/step', { id: d.d.job.id })).d.job.state, 'cancelled', 'a cancelled job is never run');
});
await t('legacy access: release packs and content sets list as read-only projects, open as project views, and originals are unchanged; import is explicit and idempotent', async () => {
  await req('GET', '/release/list?ns=mca'); await req('GET', '/content/list?ns=mca');
  const tiles = JSON.stringify([{ n: 0, kind: 'lead', headline: 'Critical minerals need a reserve', support: 'x', cta: 'Learn more', captions: { linkedin: 'A reserve keeps minerals working for Australians.' }, alt: 'tile', image: { ver: 1, model: 'gemini-2.5-flash-image' }, verdict: 'approved' }, { n: 1, kind: 'stat', headline: '$74 billion', support: 'in tax and royalties', cta: '', captions: {}, alt: '' }]);
  db.prepare("INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES('rp1','mca','Critical minerals reserve','Release text here about a strategic reserve.','{\"headline\":\"Reserve\",\"claims\":[\"Australia holds the minerals\"],\"numbers\":[{\"text\":\"$74 billion\",\"value\":74,\"unit\":\"billion\"}],\"quotes\":[]}',?,'rendered','','Dee','square',1000,2000)").run(tiles);
  db.prepare("INSERT INTO content_sets(id,ns,campaign,segment,brief,source,platforms,items,status,job,who,history,created,updated) VALUES('cs1','mca','hoof','members','HOOF myth busting captions','null','[\"linkedin\"]','[{\"n\":0,\"platform\":\"linkedin\",\"body\":\"Fuel tax credits are not a subsidy.\",\"cta\":\"\",\"verdict\":\"approved\",\"revisions\":1}]','approved','','Dee','[{\"who\":\"Dee\",\"instruction\":\"Fact not Busted\",\"at\":1500}]',1100,2100)").run();
  db.prepare("INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES('rp2','aep','Gas supply','src','{}','[]','rendered','','x','square',1000,2000)").run();
  const before = JSON.stringify(db.prepare('SELECT * FROM release_packs WHERE id=?').get('rp1')) + JSON.stringify(db.prepare('SELECT * FROM content_sets WHERE id=?').get('cs1'));
  const l = await req('GET', '/studio/list?ns=mca', null, 'read-key'); eq(l.d.legacy.map(x => [x.id, x.kind, x.readOnly, x.assets]), [['cs:cs1', 'legacy_content', true, 1], ['rp:rp1', 'legacy_release', true, 2]]);
  ok(!l.d.legacy.some(x => x.id === 'rp:rp2'), 'another client\'s pack is not listed');
  const v = await req('GET', '/studio/get?id=rp:rp1', null, 'read-key'); eq(v.d.readOnly, true); eq(v.d.assets.length, 2); eq(v.d.assets[0].versions[0].mode, 'generated'); eq(v.d.assets[0].versions[0].image.url, '/release/tile?id=rp1&n=0&v=1'); eq(v.d.assets[1].versions[0].mode, 'copy'); eq(v.d.sources[0].claims.length, 2); ok(v.d.brief.notRecorded.length);
  const c = await req('GET', '/studio/get?id=cs:cs1', null, 'read-key'); eq(c.d.assets[0].versions[0].copy.body, 'Fuel tax credits are not a subsidy.'); ok(c.d.thread.some(x => /Fact not Busted/.test(x.text)));
  eq((await req('POST', '/studio/import', { legacy: 'rp:rp1' }, 'read-key')).status, 403, 'import is a write');
  const i1 = await req('POST', '/studio/import', { legacy: 'rp:rp1' }); eq(i1.status, 200); eq(i1.d.existing, false); eq(i1.d.ns, 'mca'); ok(i1.d.legacy && i1.d.legacy.id === 'rp:rp1');
  const i2 = await req('POST', '/studio/import', { legacy: 'rp:rp1' }); eq(i2.d.existing, true); eq(i2.d.id, i1.d.id, 'importing again opens the same project');
  const g = await req('GET', '/studio/get?id=' + i1.d.id); eq(g.d.assets.length, 2); eq(g.d.assets[0].versions[0].mode, 'generated'); eq(g.d.assets[0].versions[0].image.key, 'packs/rp1/0.png', 'the image is referenced, not copied'); ok(/legacy verdict approved/.test(g.d.assets[0].versions[0].note)); ok(g.d.thread.some(e => /original is untouched/.test(e.text)));
  const after = JSON.stringify(db.prepare('SELECT * FROM release_packs WHERE id=?').get('rp1')) + JSON.stringify(db.prepare('SELECT * FROM content_sets WHERE id=?').get('cs1'));
  eq(after, before, 'originals unchanged');
  const l2 = await req('GET', '/studio/list?ns=mca'); eq(l2.d.legacy.find(x => x.id === 'rp:rp1').imported, i1.d.id, 'the list says where it went');
  eq((await req('POST', '/studio/import', { legacy: 'rp:nope' })).status, 404);
});
await t('inventory counts per client and samples KV sessions; the models probe reports what the keys list; status carries the build', async () => {
  kv.set('imgsess_abc', JSON.stringify({ ns: 'mca', thread: [] })); kv.set('imgsess_abc_v1', '{"b64":"x"}'); kv.set('imgsess_def', JSON.stringify({ brief: 'no client recorded' }));
  const inv = await req('GET', '/studio/inventory', null, 'read-key'); eq(inv.status, 200);
  eq(inv.d.namespaces.mca.releasePacks, 1); eq(inv.d.namespaces.mca.contentSets, 1); eq(inv.d.namespaces.aep.releasePacks, 1); ok(inv.d.namespaces.mca.projects >= 2); eq(inv.d.namespaces.mca.imported, 1);
  eq(inv.d.sessions.total, 2); eq(inv.d.sessions.byClient, { mca: 1, unknown: 1 });
  const m = await req('GET', '/studio/models', null, 'read-key'); eq(m.status, 200);
  eq(m.d.claude.models.find(x => x.id === 'claude-opus-5-5').available, true); eq(m.d.claude.models.find(x => x.id === 'claude-sonnet-5-5').available, false);
  eq(m.d.gemini.models.find(x => x.id === 'gemini-3-pro-image').available, true); eq(m.d.gemini.models.find(x => x.id === 'gemini-2.5-flash').available, false);
  eq(m.d.configured.imageSize, '2K'); ok(/Neither is a statement about quality/.test(m.d.note));
  const e2 = mkEnv({ ANTHROPIC_API_KEY: undefined }); const m2 = await req('GET', '/studio/models', null, 'full-key', e2); eq(m2.d.claude.configured, false); eq(m2.d.claude.models[0].available, null);
  const st = await req('GET', '/studio/status', null, 'read-key'); ok(st.d.jobs.total >= 6, JSON.stringify(st.d.jobs)); ok(st.d.projects >= 3); eq(st.d.bound.r2, true);
});
await t('archive hides a project from the default list without deleting anything', async () => {
  const other = (await req('GET', '/studio/list?ns=aep')).d.projects[0];
  const ar = await req('POST', '/studio/project/archive', { id: other.id }); eq(ar.d.archived, true);
  eq((await req('GET', '/studio/list?ns=aep')).d.projects, []); eq((await req('GET', '/studio/list?ns=aep&archived=1')).d.projects.length, 1);
  eq((await req('GET', '/studio/get?id=' + other.id)).d.assets.length, 1, 'still all there');
  eq((await req('POST', '/studio/project/archive', { id: other.id, archived: false })).d.archived, false);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
