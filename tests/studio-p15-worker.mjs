/* Creative Studio P15, outcome metrics with baselines: every figure is a count over recorded rows - time from a project's
 * creation to its first draft, its first validated composition and its first agency approval; versions per fully approved
 * asset; model calls and images per approved asset; constraint adherence of the current versions; technical validation;
 * client decisions - compared with the same client's previous window and with the desks the Studio replaced, which name
 * what they never recorded instead of a zero. The isolation audit reads every rule, reference and mark on a client's
 * current versions and names any that belong to another client (or, for a wordmark, another campaign).
 * Run: node --experimental-sqlite tests/studio-p15-worker.mjs */
import { D1Lite } from './d1lite.mjs';
import { validateAsset } from './studio-measure-stub.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}), upsert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const calls = { anth: 0, gem: 0 };
globalThis.fetch = async (url) => { const u = String(url); if (u.indexOf('generativelanguage') >= 0) { calls.gem++; return new Response('{}', { status: 500 }); } if (u.indexOf('api.anthropic.com') >= 0) { calls.anth++; return new Response(JSON.stringify({ content: [{ type: 'text', text: '{}' }], stop_reason: 'end_turn' }), { status: 200 }); } return new Response('', { status: 404 }); };
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') { const res = await handler.fetch(new Request('https://newsaus.test' + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key }, body: body ? JSON.stringify(body) : undefined }), env, ctx); let d = null; try { d = await res.json(); } catch (x) {} return { status: res.status, d }; }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db; const DAY = 86400000;
const LAYOUT = { v: 3, style: 'typographic', bg: '#0b3d3a', stage: { w: 1080, h: 1080 }, layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 8, w: 88, h: 24, size: 6, color: '#ffffff', weight: 800 }, { id: 'support', type: 'text', role: 'support', x: 6, y: 40, w: 88, h: 20, size: 3.4, color: '#ffffff' }] };
const asset = async (P, title, mode, copy) => (await req('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title, copy, layout: mode === 'copy' ? undefined : LAYOUT, mode })).d.asset.id;
const edit = async (P, A, copy) => { const g = (await req('GET', '/studio/get?id=' + P)).d; const a = g.assets.find(x => x.id === A); return req('POST', '/studio/version', { asset: A, revision: a.revision, copy, note: 'edit' }); };
const shift = (P, ms) => { ['studio_projects:id', 'studio_versions:project', 'studio_approvals:project', 'studio_validations:project', 'studio_jobs:project', 'studio_assets:project', 'studio_events:project'].forEach(x => { const [tb, col] = x.split(':'); const c = tb === 'studio_projects' ? ['created', 'updated'] : tb === 'studio_assets' || tb === 'studio_jobs' ? ['created', 'updated'] : ['created']; c.forEach(k => db.prepare('UPDATE ' + tb + ' SET ' + k + '=' + k + '-? WHERE ' + col + '=?').run(ms, P)); }); };

console.log('studio-p15-worker harness (outcome metrics with baselines, the isolation audit)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }, { id: 'national', name: 'Australian mining', logoPolicy: 'none' }], facts: [{ text: 'Mining paid $74 billion in company tax and royalties', source: 'MCA', status: 'approved' }], banned: [{ term: 'handout', use: 'credit' }] });
await req('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', campaigns: [{ id: 'gas', name: 'Gas', logoPolicy: 'none' }] });

// the earlier window: one project, one copy-only asset approved after four versions
const E = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Earlier', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;
const EA = await asset(E, 'Earlier caption', 'copy', { headline: 'Fuel tax credits are not a subsidy', caption: 'c1' });
for (const c of ['c2', 'c3', 'c4']) await edit(E, EA, { caption: c });
await req('POST', '/studio/approve', { asset: EA, part: 'copy', decision: 'approve', reason: 'the words the client signed' });
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('je1',?,'copy','done',1,1,?,?)").run(E, Date.now(), Date.now());
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('je2',?,'render','done',1,0,?,?)").run(E, Date.now(), Date.now());
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('je3',?,'render','done',1,0,?,?)").run(E, Date.now(), Date.now());
shift(E, 40 * DAY);

// this window: a copy-only asset approved at its second version, a composition validated and approved in both parts, a third with a banned term
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Now', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;
const A1 = await asset(P, 'Caption', 'copy', { headline: 'Fuel tax credits are not a subsidy', caption: 'one' });
await edit(P, A1, { caption: 'two' });
await req('POST', '/studio/approve', { asset: A1, part: 'copy', decision: 'approve', reason: 'approved by the team' });
const A2 = await asset(P, 'Tile', 'composition', { headline: 'Mining paid $74 billion in company tax and royalties', support: 'More than any other industry.' });
const vr = await validateAsset(req, P, A2);
const A3 = await asset(P, 'Rough', 'copy', { headline: 'Another handout to miners', caption: 'x' });
await req('POST', '/studio/approve', { asset: A3, part: 'copy', decision: 'reject', reason: 'wrong framing entirely' });
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('jp1',?,'copy','done',1,1,?,?)").run(P, Date.now(), Date.now());
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('jp2',?,'render','done',1,0,?,?)").run(P, Date.now(), Date.now());
db.prepare("INSERT INTO studio_jobs(id,project,stage,state,attempts,cost,created,updated) VALUES('jp3',?,'render','failed',3,0,?,?)").run(P, Date.now(), Date.now());

// the desks, this window: a release pack approved after two hours, a content set revised three times with one flagged piece
await req('GET', '/release/list?ns=mca'); await req('GET', '/content/list?ns=mca');
const now = Date.now();
db.prepare("INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES('rpm','mca','Pack','src','{}',?,'done','','Hesh','1:1',?,?)").run(JSON.stringify([{ n: 0, headline: 'h', check: { ok: true } }, { n: 1, headline: 'h2', check: { ok: false, missing: ['12'] } }]), now - 5 * DAY, now - 5 * DAY);
db.prepare("INSERT INTO content_sets(id,ns,campaign,segment,brief,source,platforms,items,status,job,who,history,created,updated) VALUES('csm','mca','hoof','','b','{}','[]',?,'done','','Hesh',?,?,?)").run(JSON.stringify([{ platform: 'x', body: 'a', check: { ok: true } }, { platform: 'x', body: 'b', check: { ok: true } }]), JSON.stringify([{}, {}, {}]), now - 4 * DAY, now - 4 * DAY);
await req('POST', '/engine/outcome', { ns: 'mca', surface: 'release', ref: 'rpm', n: 0, verdict: 'approved', why: 'good' });
db.prepare("UPDATE engine_outcomes SET created=? WHERE ref='rpm'").run(now - 5 * DAY + 2 * 3600000);

await t('the validation filed for the composition was accepted, so it can be approved in both parts', async () => {
  eq(vr.status, 200, JSON.stringify(vr.d).slice(0, 300)); ok(vr.d.ok !== false, 'validation passed: ' + JSON.stringify(vr.d).slice(0, 300));
  eq((await req('POST', '/studio/approve', { asset: A2, part: 'copy', decision: 'approve', reason: 'figures match the release' })).status, 200);
  const d = await req('POST', '/studio/approve', { asset: A2, part: 'design', decision: 'approve', reason: 'the layout is right' }); eq(d.status, 200, JSON.stringify(d.d));
});
await t('this window counts what happened: projects, approved assets, times from creation, versions to approval, spend per approved asset, adherence, validation and rejections', async () => {
  const m = (await req('GET', '/studio/metrics?ns=mca&days=30', null, 'read-key')).d; ok(m.ok, JSON.stringify(m).slice(0, 200));
  const c = m.current; eq([c.projects, c.assets, c.approvedAssets], [1, 3, 2]);
  eq(c.timeToFirstDraft.n, 1); ok(c.timeToFirstDraft.median >= 0 && c.timeToFirstDraft.median < 60000, 'first draft within the run');
  eq(c.timeToFirstValidated.n, 1); eq(c.timeToFirstApproval.n, 1);
  eq(c.versionsPerApproved.n, 2); eq(c.versionsPerApproved.median, 2, 'the caption at v2 and the tile at v1: median of 2 and 1 rounds to 2'); eq(c.versionsPerApproved.mean, 1.5);
  eq(c.spend, { calls: 1, images: 1 }, 'done jobs only'); eq(c.costPerApproved, { calls: 0.5, images: 0.5 });
  eq(c.adherence.current, 3); eq(c.adherence.clean, 2, 'the banned term keeps one version from being clean'); eq(c.adherence.byState.banned, 1); eq(c.adherence.share, 67);
  eq(c.validation, { measured: 1, passed: 1, share: 100 }); eq(c.rejections, 1);
  eq(c.firstPass, { measured: 1, passed: 1, share: 100, approvedAsDrafted: 1, approved: 2 }, 'the tile measured clean first time and was approved as drafted; the caption needed a second version');
});
await t('the earlier window is the baseline from the same client: four versions to approval, two images and one call on one approved asset', async () => {
  const m = (await req('GET', '/studio/metrics?ns=mca&days=30')).d; const e = m.baseline.earlier;
  eq([e.projects, e.approvedAssets], [1, 1]); eq(e.versionsPerApproved.median, 4); eq(e.costPerApproved, { calls: 1, images: 2 });
  eq(m.current.timeToFirstValidated.n, 1); eq(e.timeToFirstValidated.n, 0, 'no validation then: n says so, the median is null'); eq(e.timeToFirstValidated.median, null);
});
await t('the desks are a baseline too, with what they recorded and a plain list of what they never did', async () => {
  const L = (await req('GET', '/studio/metrics?ns=mca&days=30')).d.baseline.legacy;
  eq([L.packs, L.sets, L.pieces, L.approved], [1, 1, 4, 1]); eq(L.timeToFirstApproval.median, 2 * 3600000); eq(L.revisionsPerSet.median, 3);
  eq([L.adherence.clean, L.adherence.share], [3, 75]); ok(L.notRecorded.length >= 3 && L.notRecorded.some(x => /validated composition/.test(x)), JSON.stringify(L.notRecorded));
});
await t('metrics are walled by client: another client sees none of these rows', async () => {
  const m = (await req('GET', '/studio/metrics?ns=aep&days=30')).d;
  eq([m.current.projects, m.baseline.earlier.projects, m.baseline.legacy.pieces, m.isolation.versions], [0, 0, 0, 0]); eq(m.current.costPerApproved, null); ok(/no asset fully approved/.test(m.current.costNote));
});
await t('the isolation audit is clean on honest work and names a rule, a mark and a wordmark that belong elsewhere', async () => {
  const m0 = (await req('GET', '/studio/metrics?ns=mca&days=30')).d; ok(m0.isolation.clean, JSON.stringify(m0.isolation.violations)); eq(m0.isolation.versions, 4);
  const fx = (await req('POST', '/engine/fix', { ns: 'aep', task: 'copy', scope: 'client', wrong: 'gas is dirty', right: 'gas firms the grid', why: 'house line' })).d; const fid = (fx.fix || fx).id; ok(fid, JSON.stringify(fx));
  const cur = db.prepare('SELECT current FROM studio_assets WHERE id=?').get(A2).current; const row = db.prepare('SELECT context, layout FROM studio_versions WHERE id=?').get(cur);
  const c = JSON.parse(row.context || '{}'); c.rules = { copy: [fid], tiles: [] }; const L = JSON.parse(row.layout); L.layers.push({ id: 'logo', type: 'img', role: 'logo', src: '/brand/logo?ns=aep', x: 80, y: 80, w: 12, h: 12 }, { id: 'wm', type: 'img', role: 'wordmark', src: '/brand/wordmark?ns=mca&campaign=national', x: 4, y: 80, w: 20, h: 10 });
  db.prepare('UPDATE studio_versions SET context=?, layout=? WHERE id=?').run(JSON.stringify(c), JSON.stringify(L), cur);
  const m = (await req('GET', '/studio/metrics?ns=mca&days=30')).d; eq(m.isolation.clean, false);
  const k = m.isolation.violations.map(v => v.kind + ': ' + v.detail).sort(); eq(k, ['mark: the logo of aep', 'mark: the national wordmark on a hoof asset', 'rule: a rule of aep']);
  eq(m.isolation.checked, { rules: 1, references: 0, marks: 2 });
  eq((await req('GET', '/studio/metrics?ns=aep&days=30')).d.isolation.clean, true, 'the audit reads the client\'s own versions only');
});
await t('every figure says what it counts, and the metrics cost nothing', async () => {
  const a0 = calls.anth, g0 = calls.gem; const m = (await req('GET', '/studio/metrics?ns=mca&days=7')).d; eq([calls.anth, calls.gem], [a0, g0]);
  ['timeToFirstDraft', 'firstPass', 'timeToFirstValidated', 'timeToFirstApproval', 'versionsPerApproved', 'costPerApproved', 'adherence', 'isolation'].forEach(k => ok(m.definitions[k], 'defined: ' + k)); ok(/Small numbers are small numbers/.test(m.note)); eq(m.days, 7);
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
