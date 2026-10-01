/* Creative Studio P11, client review: a private link with its own token (stored only as a hash, shown once), scoped to
 * chosen assets, revocable, expiring, locked out after repeated guesses; the reviewer sees an allow-list (the validated
 * export of each shared asset's current version, or its copy) and never the thread, internal notes, checks, other
 * assets or another client; comments can be pinned to the tile; a comment or decision on a superseded version is
 * refused; a client approval waits for the agency's own and is of that exact version; the agency resolves comments by
 * naming the version that addresses them; the delivery manifest records the client's decision and can require it.
 * Run: node --experimental-sqlite tests/studio-p11-worker.mjs */
import { D1Lite } from './d1lite.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
};
const png = fill => { const b = Buffer.alloc(160, fill || 0); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b[24] = 8; b[25] = 6; return b.toString('base64'); };
globalThis.fetch = async () => new Response('', { status: 404 });
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key', headers, ip) {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json', 'CF-Connecting-IP': ip || '10.0.0.1' }, key ? { 'X-Axiom-Key': key } : {}, headers || {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; const ct = res.headers.get('Content-Type') || ''; if (/json/.test(ct)) { try { d = await res.json(); } catch (x) {} } return { status: res.status, d, res, ct };
}
const rev = (method, path, body, token, ip) => req(method, path, body, null, { 'X-Review-Token': token }, ip);
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };
const curV = async (P, A) => { const g = (await req('GET', '/studio/get?id=' + P)).d; const a = g.assets.find(x => x.id === A); return { a, v: a.versions.find(x => x.id === a.current) }; };
const measure = async (P, A) => { const { a, v } = await curV(P, A); return req('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a), imageB64: png(3) }); };
const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#0E6A6E', regions: [], layers: [{ id: 'h', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 20, size: 6, weight: 800, color: '#fff' }, { id: 's', type: 'text', role: 'support', x: 6, y: 40, w: 80, h: 12, size: 3, weight: 500, color: '#fff' }, { id: 'c', type: 'text', role: 'cta', x: 6, y: 70, w: 40, h: 8, size: 2.6, weight: 700, color: '#111', bg: '#E8B23A' }] };

console.log('studio-p11-worker harness (client review: private scoped links, allow-list, pins, stale versions, approval after the agency, resolution by version, delivery)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
await req('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers' });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fuel tax review', brief: { objective: 'o', message: 'm' } })).d.id;
const mk = async (title, copy, mode) => (await req('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title, copy, layout: mode === 'copy' ? undefined : L, mode: mode || 'composition', image: mode === 'copy' ? undefined : { key: 'studio/fixture/bg.png' } })).d.asset.id;
r2.set('studio/fixture/bg.png', { v: Buffer.from(png(5), 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
const A = await mk('Myth tile', { headline: 'Not a subsidy', support: 'A tax returned', cta: 'Sign' });
const B = await mk('Caption only', { caption: 'Fuel tax credits are not a subsidy.' }, 'copy');
const HIDDEN = await mk('Internal draft', { headline: 'SECRET-DRAFT-HEADLINE', support: 'x', cta: 'y' });
await req('POST', '/studio/note', { project: P, text: 'INTERNAL-NOTE-do-not-show: the client is difficult about colour' });
let TOKEN = '', SHARE = '';

await t('nothing is shared by default, and an unvalidated composition cannot be put in front of a client', async () => {
  eq((await req('POST', '/studio/share', { project: P, assets: [] })).d.error, 'assets_required');
  const r = await req('POST', '/studio/share', { project: P, assets: [A, B] }); eq(r.status, 409); eq(r.d.error, 'not_reviewable'); ok(/Myth tile \(the current version is not validated/.test(r.d.detail), r.d.detail);
  eq((await req('POST', '/studio/share', { project: P, assets: [A] }, 'read-key')).status, 403, 'sharing is a write');
});

await t('a share is created with a token shown once and stored only as its hash, scoped to the chosen assets, with an expiry', async () => {
  await measure(P, A);
  const r = await req('POST', '/studio/share', { project: P, assets: [A, B], label: 'HOOF round 1', expiresDays: 14, allowApprove: true }); eq(r.status, 200, JSON.stringify(r.d));
  TOKEN = r.d.token; SHARE = r.d.share.id; ok(TOKEN.length >= 40, 'a long random token');
  const row = env.MIND_DB.db.prepare('SELECT * FROM studio_shares WHERE id=?').get(SHARE);
  ok(row.token_hash && row.token_hash.length === 64 && !JSON.stringify(row).includes(TOKEN), 'only the SHA-256 hash is stored');
  ok(Math.abs(row.expires - (Date.now() + 14 * 86400000)) < 60000, 'expires in 14 days');
  const list = (await req('GET', '/studio/shares?project=' + P, null, 'read-key')).d.shares; eq(list.map(s => [s.id, s.state, s.assets.length]), [[SHARE, 'active', 2]]); ok(!JSON.stringify(list).includes(TOKEN), 'the list never shows the token');
});

await t('the reviewer sees an allow-list: the shared assets only, their current version as the validated export or the copy, the client name - no thread, notes, checks, layouts, other assets or keys', async () => {
  const r = await rev('GET', '/review/get', null, TOKEN); eq(r.status, 200, JSON.stringify(r.d));
  eq(r.d.client, 'Minerals Council of Australia'); eq(r.d.assets.map(a => [a.title, a.state, a.kind]), [['Myth tile', 'ready', 'composition'], ['Caption only', 'ready', 'copy']]);
  const s = JSON.stringify(r.d);
  ok(!/INTERNAL-NOTE|SECRET-DRAFT|layers|checks|thread|exportKey|studio\/|token_hash|full-key|aep|Australian Energy/.test(s), 'nothing internal leaks: ' + s.slice(0, 400));
  const img = r.d.assets[0].image; ok(/^\/review\/file\?asset=/.test(img));
  const f = await rev('GET', img, null, TOKEN); eq(f.status, 200); ok(/image\/png/.test(f.res.headers.get('Content-Type')) && /no-store/.test(f.res.headers.get('Cache-Control')));
  eq((await rev('GET', '/review/file?asset=' + HIDDEN + '&version=x', null, TOKEN)).status, 404, 'an asset outside the share is not served');
  eq((await req('GET', '/studio/get?id=' + P, null, null, { 'X-Review-Token': TOKEN })).status, 401, 'the review token opens nothing in the Studio');
  ok((await req('GET', '/studio/shares?project=' + P)).d.shares[0].views >= 1, 'views are counted');
});

await t('a comment can be pinned to the tile; the agency sees it on the thread; a comment on a version that has been superseded is refused', async () => {
  const g = (await rev('GET', '/review/get', null, TOKEN)).d; const a = g.assets[0];
  const c = await rev('POST', '/review/comment', { asset: A, version: a.version.id, text: 'Make the headline bigger', pin: { x: 30.25, y: 18 }, author: 'Tania' }, TOKEN); eq(c.status, 200, JSON.stringify(c.d));
  const rows = (await req('GET', '/studio/review?project=' + P, null, 'read-key')).d.review; eq(rows.map(x => [x.kind, x.text, x.pin, x.author, x.status]), [['comment', 'Make the headline bigger', { x: 30.3, y: 18 }, 'Tania', 'open']]);
  ok((await req('GET', '/studio/get?id=' + P)).d.thread.some(e => e.kind === 'client_review' && /Client comment on Myth tile/.test(e.text) && /as they gave their name/.test(e.text)), 'on the thread, the name labelled as given');
  eq((await rev('POST', '/review/comment', { asset: A, version: 'vold', text: 'x' }, TOKEN)).d.error, 'stale_version');
  eq((await rev('POST', '/review/comment', { asset: HIDDEN, version: 'x', text: 'x' }, TOKEN)).status, 404);
  eq((await rev('POST', '/review/comment', { asset: A, version: a.version.id, text: '' }, TOKEN)).d.error, 'text_required');
});

await t('a client approval waits for the agency\'s own approval, is of that exact version, and stops standing when a new version is made', async () => {
  let a = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0];
  const early = await rev('POST', '/review/decision', { asset: A, version: a.version.id, decision: 'approve', author: 'Tania' }, TOKEN); eq(early.d.error, 'not_ready_for_client');
  await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'agency ok' }); await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'agency ok' });
  a = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0]; eq(a.agencyApproved, true);
  const ap = await rev('POST', '/review/decision', { asset: A, version: a.version.id, decision: 'approve', author: 'Tania' }, TOKEN); eq(ap.status, 200, JSON.stringify(ap.d));
  a = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0]; eq([a.decision.kind, a.decision.author], ['approve', 'Tania']);
  const { v } = await curV(P, A); await req('POST', '/studio/version', { asset: A, copy: Object.assign({}, v.copy, { headline: 'Not a subsidy. Never was.' }), layout: v.layout, note: 'client asked for a bigger headline' });
  const r = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0]; eq([r.state, r.title], ['in_revision', 'Myth tile'], 'the new version is not shown until it is validated');
  await measure(P, A); const r2v = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0]; eq([r2v.state, r2v.version.n, r2v.decision], ['ready', 2, null], 'the earlier approval does not carry to the new version');
});

await t('the agency resolves a comment by naming the version that addresses it (not an older one), or says why nothing changes; the client sees it addressed', async () => {
  const c = (await req('GET', '/studio/review?project=' + P)).d.review.find(x => x.kind === 'comment');
  const first = (await curV(P, A)).a.versions[0].id;
  eq((await req('POST', '/studio/review/resolve', { project: P, id: c.id, version: 'nope' })).status, 404);
  const older = await req('POST', '/studio/review/resolve', { project: P, id: c.id, version: first }); eq(older.status, 200, 'the version commented on itself may be named');
  const cur = (await curV(P, A)).v.id;
  const r = await req('POST', '/studio/review/resolve', { project: P, id: c.id, version: cur, note: 'headline enlarged' }); eq(r.d.review.resolvedVersion, cur);
  const seen = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0].comments[0]; eq([seen.status, seen.addressedIn, seen.note], ['resolved', 2, 'headline enlarged']);
  eq((await req('POST', '/studio/review/resolve', { project: P, id: c.id, decision: 'wontfix' })).d.error, 'reason_required');
});

await t('the delivery manifest records the client\'s decision and, when asked, leaves out what the client has not approved in its current version', async () => {
  await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'agency ok' }); await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'agency ok' });
  const lastManifest = () => { const keys = Array.from(r2.keys()).filter(k => /\/export\/[^/]+\.json$/.test(k)); return JSON.parse(r2.get(keys[keys.length - 1]).v.toString()); };
  let j = await run((await req('POST', '/studio/job', { project: P, stage: 'export', input: { assets: [A], requireClient: true }, idem: 'x1' })).d.job); eq(j.state, 'done', j.error);
  ok(lastManifest().excluded.some(x => x.asset === A && /approved an earlier version/.test(x.why)), JSON.stringify(lastManifest().excluded));
  const a = (await rev('GET', '/review/get', null, TOKEN)).d.assets[0]; await rev('POST', '/review/decision', { asset: A, version: a.version.id, decision: 'approve', author: 'Tania' }, TOKEN);
  j = await run((await req('POST', '/studio/job', { project: P, stage: 'export', input: { assets: [A], requireClient: true }, idem: 'x2' })).d.job);
  const row = lastManifest().assets.find(x => x.asset === A); ok(row && row.client.decision === 'approve' && row.client.current && row.client.by === 'Tania', JSON.stringify(row && row.client));
});

await t('a link stops working when revoked or expired; wrong tokens are refused and lock the address out after a dozen tries; another client\'s link sees nothing of this one', async () => {
  const other = (await req('POST', '/studio/project', { ns: 'aep', title: 'Gas' })).d.id;
  const oa = (await req('POST', '/studio/asset', { project: other, family: 'F', channel: 'x', format: '1:1', title: 'Gas copy', copy: { caption: 'gas' }, mode: 'copy' })).d.asset.id;
  const ot = (await req('POST', '/studio/share', { project: other, assets: [oa] })).d.token;
  const og = (await rev('GET', '/review/get', null, ot)).d; eq(og.assets.map(x => x.title), ['Gas copy']); ok(!/Myth|Fuel|Minerals/.test(JSON.stringify(og)));
  eq((await rev('POST', '/review/comment', { asset: A, version: 'x', text: 'x' }, ot)).status, 404, 'an AEP link cannot touch an MCA asset');
  eq((await req('POST', '/studio/share', { project: P, assets: [oa] })).d.error, 'not_reviewable', 'another project\'s asset cannot be put in this share');
  await req('POST', '/studio/share/revoke', { project: P, id: SHARE });
  eq((await rev('GET', '/review/get', null, TOKEN)).d.error, 'link_revoked');
  const ex = (await req('POST', '/studio/share', { project: P, assets: [B], expiresDays: 1 })).d; env.MIND_DB.db.prepare('UPDATE studio_shares SET expires=? WHERE id=?').run(Date.now() - 1000, ex.share.id);
  eq((await rev('GET', '/review/get', null, ex.token)).status, 410);
  for (let i = 0; i < 12; i++) eq((await rev('GET', '/review/get', null, 'x'.repeat(43) + i, '10.9.9.9')).status, 401);
  eq((await rev('GET', '/review/get', null, ot, '10.9.9.9')).status, 429, 'after a dozen wrong tokens the address waits, even with a good one');
  eq((await rev('GET', '/review/get', null, ot, '10.1.1.1')).status, 200, 'other addresses are unaffected');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
