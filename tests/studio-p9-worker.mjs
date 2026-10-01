/* Creative Studio P9, production readiness that can be enforced: a browser's measurement is re-judged by the worker with the
 * shared layout rules (a report about other words, another size, another geometry or an implausible wrap is refused; a
 * client's own "ok" is ignored); readiness keeps technical validation, the art director's assessment and human approval
 * apart; design approval and export need a passing validation of exactly this composition; a caption edit carries the
 * evidence and a displayed-copy edit makes it stale; a ship verdict that names problems is an inconsistent assessment and
 * never hides a blocker; painted words in artwork mode must be read back; every displayed word is checked against the
 * approved facts of this campaign and the source, with units and periods; suggested figures are flagged; wordmark
 * variants are stored side by side under immutable keys; a region render whose region is gone branches instead of
 * overwriting; a layout repair spends nothing.
 * Run: node --experimental-sqlite tests/studio-p9-worker.mjs */
import { D1Lite } from './d1lite.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import { HOOF_REPRO, HOOF_COPY } from './fixtures/studio-layouts.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
const png = (fill) => { const b = Buffer.alloc(160, fill || 0); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b[24] = 8; b[25] = 6; return b.toString('base64'); };
const anth = { calls: [] }; const gem = { calls: [], answer: 'image' };
let INSPECT = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 5, words: { present: [], wrong: [], missing: [] }, issues: [], verdict: 'ship', fix: { kind: 'none', instruction: '' }, note: 'ok' };
let SUGGEST = {};
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) {
    gem.calls.push(u);
    const parts = gem.answer === 'image' ? [{ inlineData: { mimeType: 'image/png', data: png(9) } }] : [{ text: 'I cannot draw that.' }];
    return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts } }] }), { status: 200 });
  }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); anth.calls.push(body); const sys = String(body.system || '');
    const text = /art director inspecting a rendered social tile/.test(sys) ? JSON.stringify(INSPECT) : /suggesting the next things the team might ask for/.test(sys) ? JSON.stringify(SUGGEST) : /build a claim ledger/.test(sys) ? JSON.stringify({ claims: [] }) : '{}';
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); let d = null; try { d = await res.json(); } catch (x) { d = null; } return { status: res.status, d, res };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const run = async (job) => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await req('POST', '/studio/job/step', { id: j.id })).d.job; return j; };
const get = async P => (await req('GET', '/studio/get?id=' + P)).d;
const curV = async (P, A) => { const g = await get(P); const a = g.assets.find(x => x.id === A); return { a, v: a.versions.find(x => x.id === a.current) }; };
const readiness = async A => (await req('GET', '/studio/readiness?asset=' + A, null, 'read-key')).d;
/** a measurement of the current version as the browser would file it; `tweak` edits the report before sending */
const measure = async (P, A, tweak, opts) => { const { a, v } = await curV(P, A); const rep = stubReport(v, a, opts); if (tweak) tweak(rep, v); return req('POST', '/studio/validation', { asset: A, version: v.id, report: rep, imageB64: png(3) }); };
const lastManifest = () => { const keys = Array.from(r2.keys()).filter(k => /\/export\/[^/]+\.json$/.test(k)); const m = JSON.parse(r2.get(keys[keys.length - 1]).v.toString()); m.assets = m.assets || m.items || []; m.excluded = m.excluded || []; return m; };
const box = (rep, id) => rep.boxes.find(b => b.id === id);
// the HOOF reconstruction with its headline really on three lines (as Chromium measured it in studio-layout-browser.mjs)
const hoofTruth = rep => { const b = box(rep, 'headline'); b.lines = 3; b.contentH = 247; b.h = 247; b.overflowH = true; };
// the repaired geometry (from the renderer's repair of the same reconstruction): boxes fitted, the column restacked
const REPAIRED = JSON.parse(JSON.stringify(HOOF_REPRO));
Object.assign(REPAIRED.layers.find(l => l.id === 'kicker'), { y: 52.4 }); Object.assign(REPAIRED.layers.find(l => l.id === 'rule'), { y: 57.1 });
Object.assign(REPAIRED.layers.find(l => l.id === 'headline'), { y: 58.4, h: 18.6 }); Object.assign(REPAIRED.layers.find(l => l.id === 'support'), { y: 78.8, h: 6.4 });
Object.assign(REPAIRED.layers.find(l => l.id === 'cta'), { y: 87, h: 5.4 });
Object.assign(REPAIRED.layers.find(l => l.id === 'wordmark'), { src: '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=w1', variant: 'white' });

console.log('studio-p9-worker harness (validation re-judged by the worker, readiness, approval and export gates, inconsistent inspections, painted words, figure checks, wordmark variants, region-gone branch, zero-cost repair)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian mining' }],
  facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }, { text: 'Mining employs 290,000 Australians', source: 'ABS', status: 'approved', campaign: 'national' }, { text: 'Pending: 99,000 farms', source: 'draft', status: 'pending' }] });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF readiness', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy; costs farmers $9.6 billion', channels: ['instagram'] } })).d.id;
const A = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'HOOF tile', copy: HOOF_COPY, layout: HOOF_REPRO, mode: 'composition', image: { key: 'studio/fixture/photo.png', url: '/studio/file?key=studio/fixture/photo.png' } })).d.asset.id;
r2.set('studio/fixture/photo.png', { v: Buffer.from(png(5), 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });

await t('a new composition is "not validated" until it is measured: the reason says so, design approval is refused with 409 and nothing is assumed to pass', async () => {
  const r = await readiness(A); eq(r.technical, 'not_validated'); eq(r.production, false); ok(r.reasons.some(x => /not validated/.test(x)), JSON.stringify(r.reasons));
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'looks right' }); eq(ap.status, 409); eq(ap.d.error, 'not_validated');
  eq((await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'words approved' })).status, 200, 'copy approval does not depend on the layout');
});

await t('a report that does not describe this version is refused (422 report_mismatch) and recorded nowhere: other words, another output size, moved geometry, an impossible wrap, a different mark file, a missing layer', async () => {
  const cases = [
    ['other words', rep => { box(rep, 'headline').chars = 20; }, /other words/],
    ['preview size', rep => { rep.W = 540; rep.H = 675; }, /output size is 1080x1350/],
    ['moved geometry', rep => { box(rep, 'support').ay += 40; }, /another position/],
    ['one line', rep => { box(rep, 'headline').lines = 1; }, /cannot take fewer than 2/],
    ['other mark', rep => { box(rep, 'wordmark').src = '/brand/logo?ns=mca'; }, /wordmark was measured from/],
    ['missing layer', rep => { rep.boxes = rep.boxes.filter(b => b.id !== 'support'); }, /not in the report/],
  ];
  for (const [name, tw, rx] of cases) { const r = await measure(P, A, tw); eq(r.status, 422, name); eq(r.d.error, 'report_mismatch', name); ok(rx.test(r.d.detail), name + ': ' + r.d.detail); }
  eq((await readiness(A)).technical, 'not_validated', 'no refused report became evidence');
  eq((await req('POST', '/studio/validation', { asset: A, report: stubReport((await curV(P, A)).v, (await curV(P, A)).a) }, 'read-key')).status, 403, 'filing evidence is a write');
});

await t('the HOOF defect: a truthful measurement is judged by the worker with the shared rules - the headline overflow and the headline/support collision fail it, whatever verdict the client attached', async () => {
  const r = await measure(P, A, rep => { hoofTruth(rep); rep.ok = true; rep.issues = []; rep.clientIssues = []; });
  eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.validation.ok, false, 'the client\'s ok is not read');
  const codes = r.d.validation.issues.filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(','));
  ok(codes.includes('text_overflow:headline') && codes.some(c => c.startsWith('collision:') && c.includes('headline') && c.includes('support')), JSON.stringify(codes));
  ok(r2.has(r.d.validation.exportKey), 'the measured PNG is kept as the export the inspection reads');
  const rd = await readiness(A); eq(rd.technical, 'failed'); ok(rd.reasons[0].includes('text_overflow (headline)'), rd.reasons[0]);
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'ship it' }); eq(ap.status, 409); eq(ap.d.error, 'validation_failed');
  const ev = (await get(P)).thread.filter(e => e.kind === 'validation'); ok(ev.length === 1 && /failed - text_overflow \(headline\)/.test(ev[0].text), ev.map(e => e.text).join(' | '));
});

await t('a ship verdict over a failing measurement is an inconsistent assessment: the inspection sees the composed export and the deterministic issues, and readiness says the two disagree', async () => {
  INSPECT = Object.assign({}, INSPECT, { verdict: 'ship', issues: [], words: { present: ['A new tax on the people who grow our food'], wrong: [], missing: [] } });
  const j = await req('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: {}, idem: 'ins-1' }); const done = await run(j.d.job); eq(done.state, 'done', done.error);
  const call = anth.calls[anth.calls.length - 1]; const user = call.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
  ok(/COMPOSED TILE/.test(user) && /DETERMINISTIC CHECKS OF THIS TILE \(measured with the renderer at 1080x1350, technical validation failed\): blocking text_overflow \[headline\]/.test(user), user.slice(0, 600));
  ok(/kicker "ACTIVISTS ARE TARGETING FUEL TAX CREDITS"/.test(user), 'the free kicker text is in the inventory');
  const ev = (await get(P)).thread.filter(e => e.kind === 'inspection').pop(); eq(ev.assessment, 'inconsistent'); eq(ev.composed, true);
  const rd = await readiness(A); eq(rd.inspection.state, 'inconsistent'); eq(rd.technical, 'failed', 'the verdict did not change the measurement');
  eq((await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'the AD said ship', acknowledgeInspection: true })).d.error, 'validation_failed', 'acknowledging an inspection never overrides a technical blocker');
});

let V_REPAIRED = '';
await t('a layout repair is a layout version: no model, no render, no job; the new composition is measured, passes, and design approval goes through', async () => {
  const before = { a: anth.calls.length, g: gem.calls.length, jobs: (await req('GET', '/studio/jobs?project=' + P)).d.jobs.length };
  const { v } = await curV(P, A);
  const w = await req('POST', '/studio/version', { asset: A, layout: REPAIRED, copy: v.copy, note: 'layout repaired: fitted each text box to its measured lines and restacked related blocks with explicit spacing' }); eq(w.status, 200, JSON.stringify(w.d));
  eq([anth.calls.length, gem.calls.length, (await req('GET', '/studio/jobs?project=' + P)).d.jobs.length], [before.a, before.g, before.jobs], 'nothing was spent and nothing queued');
  ok(/\(no render\)/.test((await get(P)).thread.filter(e => e.kind === 'version').pop().text));
  eq((await readiness(A)).technical, 'stale', 'the old measurement is of another layout');
  const r = await measure(P, A, rep => { box(rep, 'headline').lines = 3; }); eq(r.d.validation.ok, true, JSON.stringify(r.d.validation.issues)); V_REPAIRED = (await curV(P, A)).v.id;
  eq((await readiness(A)).technical, 'passed');
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'layout fixed' }); eq(ap.status, 200, JSON.stringify(ap.d));
});

await t('a ship verdict that still names a material problem is inconsistent and approval waits for a person to acknowledge it; a consistent ship never approves by itself', async () => {
  INSPECT = Object.assign({}, INSPECT, { verdict: 'ship', issues: [{ text: 'support line crowds the CTA', severity: 'material' }] });
  await run((await req('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: {}, idem: 'ins-2' })).d.job);
  const rd = await readiness(A); eq(rd.inspection.state, 'inconsistent'); eq(rd.technical, 'passed');
  await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'withdraw', reason: 're-review' });
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'fine' }); eq(ap.status, 409); eq(ap.d.error, 'inspection_inconsistent');
  const ap2 = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'reviewed the crowding, acceptable', acknowledgeInspection: true }); eq(ap2.status, 200, JSON.stringify(ap2.d));
  ok(/after reviewing an inconsistent inspection/.test(JSON.stringify(ap2.d)), 'the acknowledgement is on the record');
  INSPECT = Object.assign({}, INSPECT, { verdict: 'ship', issues: [{ text: 'warmer sky would be nice', severity: 'cosmetic' }] });
  const before = (await get(P)).assets.find(a => a.id === A).approvals;
  await run((await req('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: {}, idem: 'ins-3' })).d.job);
  eq((await readiness(A)).inspection.state, 'ship', 'cosmetic notes do not make it inconsistent');
  eq((await get(P)).assets.find(a => a.id === A).approvals, before, 'a ship verdict changed no approval');
});

await t('a caption-only version shows the same tile: its validation and design approval carry; a change to the displayed words makes the evidence stale and drops design approval; the export key follows the evidence', async () => {
  const { v } = await curV(P, A);
  await req('POST', '/studio/version', { asset: A, copy: Object.assign({}, v.copy, { caption: 'Not a subsidy. Never was.' }), layout: v.layout, note: 'caption' });
  const r1 = await readiness(A); eq(r1.technical, 'passed', 'caption-only: ' + JSON.stringify(r1.reasons));
  ok(r1.validation.exportKey.endsWith(V_REPAIRED + '-export.png'), 'the export of the composition that was measured');
  const g1 = (await get(P)).assets.find(a => a.id === A); ok(g1.approvals.design && g1.approvals.design.carried, 'design approval stands, carried: ' + JSON.stringify(g1.approvals));
  await req('POST', '/studio/version', { asset: A, copy: Object.assign({}, v.copy, { caption: 'Not a subsidy. Never was.', support: 'Fuel tax credits are not a subsidy. They return a road tax.' }), layout: v.layout, note: 'support shortened' });
  const r2v = await readiness(A); eq(r2v.technical, 'stale'); ok(r2v.reasons.some(x => /different words/.test(x)));
  const g2 = (await get(P)).assets.find(a => a.id === A); ok(!g2.approvals.design, 'design approval dropped: ' + JSON.stringify(g2.approvals));
  eq((await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'ok' })).d.error, 'validation_stale');
});

await t('export takes only compositions whose technical validation passes for exactly what is shown; the manifest records the validation, the imagery size and the output size', async () => {
  const j = await run((await req('POST', '/studio/job', { project: P, stage: 'export', input: {}, idem: 'exp-1' })).d.job); eq(j.state, 'done', j.error);
  const man0 = lastManifest();
  ok(!man0.assets.some(x => x.asset === A) && man0.excluded.some(x => x.asset === A), 'an edited composition is not exported: ' + JSON.stringify(man0.excluded));
  await measure(P, A, rep => { box(rep, 'headline').lines = 3; });
  await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'measured again' });
  await req('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'words approved' });
  const j2 = await run((await req('POST', '/studio/job', { project: P, stage: 'export', input: {}, idem: 'exp-2' })).d.job); eq(j2.state, 'done', j2.error);
  const row = lastManifest().assets.find(x => x.asset === A); ok(row, JSON.stringify(lastManifest().excluded));
  ok(row.validation && row.validation.id && row.output === '1080x1350' && row.imagery && row.exportKey, JSON.stringify({ v: row.validation, o: row.output, i: row.imagery, e: row.exportKey }));
});

await t('artwork mode: painted words pass geometry but are not verified until an inspection of the composed tile reads every one back; a missing word keeps approval waiting', async () => {
  const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, approach: 'artwork', baked: ['headline', 'support'], regions: [], layers: [{ id: 'wordmark', type: 'img', role: 'wordmark', x: 72, y: 86, w: 24, h: 8, src: '/brand/wordmark?ns=mca&campaign=hoof' }] };
  const B = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '1:1', title: 'Painted', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy' }, layout: L, mode: 'artwork', image: { key: 'studio/fixture/photo.png' } })).d.asset.id;
  const r = await measure(P, B); eq(r.d.validation.ok, true, JSON.stringify(r.d.validation.issues)); ok(r.d.validation.issues.some(i => i.code === 'baked_text'), 'the painted words are named as outside geometry');
  const rd = await readiness(B); eq(rd.technical, 'passed'); eq(rd.baked.verified, false); eq(rd.production, false);
  eq((await req('POST', '/studio/approve', { asset: B, part: 'design', decision: 'approve', reason: 'ok' })).d.error, 'baked_text_unverified');
  INSPECT = Object.assign({}, INSPECT, { verdict: 'fix', issues: [], words: { present: ['HANDS OFF OUR FUEL'], wrong: [], missing: ['Not a subsidy'] } });
  await run((await req('POST', '/studio/job', { project: P, asset: B, stage: 'inspect', input: {}, idem: 'ins-b1' })).d.job);
  const user = anth.calls[anth.calls.length - 1].messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
  ok(/PAINTED WORDS TO READ BACK.*headline "Hands off our fuel"; support "Not a subsidy"/.test(user), 'the model is asked to read the painted words back');
  const rd2 = await readiness(B); eq(rd2.baked.verified, false); ok(/not read: Not a subsidy/.test(rd2.baked.why), rd2.baked.why);
  INSPECT = Object.assign({}, INSPECT, { verdict: 'ship', issues: [], words: { present: ['Hands off our fuel', 'Not a subsidy'], wrong: [], missing: [] } });
  await run((await req('POST', '/studio/job', { project: P, asset: B, stage: 'inspect', input: {}, idem: 'ins-b2' })).d.job);
  const rd3 = await readiness(B); eq(rd3.baked.verified, true); eq(rd3.production, true);
  eq((await req('POST', '/studio/approve', { asset: B, part: 'design', decision: 'approve', reason: 'every painted word read back' })).status, 200);
});

await t('every displayed word is checked: a figure in a free text layer, another campaign\'s fact, a pending fact, a brief-only number, a unit or a value that differs, and a period that differs from the source', async () => {
  const L = JSON.parse(JSON.stringify(REPAIRED)); L.layers.find(l => l.id === 'kicker').text = 'MINING EMPLOYS 290,000 AUSTRALIANS';
  L.layers.push({ id: 'src', type: 'text', role: 'caption', text: 'Excise 50.8 cents per litre; 99,000 farms; $9.6 billion a year', x: 6, y: 95, w: 60, h: 3, size: 2.2, weight: 500, color: '#fff' });
  const C = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'Figures', copy: { headline: 'Excise is 50.8 dollars per litre', support: 'Farmers pay 51.2 cents per litre', cta: 'Sign' }, layout: L, mode: 'composition' })).d.asset;
  const checks = C.versions.find(v => v.id === C.current).checks; const st = s => checks.filter(c => c.text && c.text.replace(/\s/g, '').includes(s)).map(c => c.state);
  ok(st('290,000').includes('unsupported'), 'another campaign\'s fact in a kicker is not this campaign\'s evidence: ' + JSON.stringify(checks.filter(c => /290/.test(c.text))));
  ok(st('50.8').includes('fact'), 'the HOOF fact in the free caption layer: ' + JSON.stringify(checks));
  ok(st('99,000').includes('unsupported'), 'a pending fact is not approved');
  ok(st('9.6').includes('unsupported') && checks.find(c => /9\.6/.test(c.text)).note.includes('brief'), 'a number that is only in the brief is not verified');
  ok(st('50.8').includes('differs'), 'dollars per litre against cents per litre is a unit difference: ' + JSON.stringify(checks.filter(c => /50\.8/.test(c.text))));
  ok(st('51.2').includes('differs'), 'a different value in the same unit');
  const s = await req('POST', '/studio/source', { project: P, kind: 'release', name: 'release.txt', text: 'Farmers claimed 1.2 billion litres of fuel in 2023-24, according to the ATO. The industry says the scheme is not a subsidy.' });
  const ex = await run((await req('POST', '/studio/job', { project: P, stage: 'extract', input: { source: s.d.id }, idem: 'ex-1' })).d.job); eq(ex.state, 'done', ex.error);
  const D = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'Period', copy: { headline: '1.2 billion litres in 2019-20', support: 'x', cta: 'y' }, layout: REPAIRED, mode: 'composition' })).d.asset;
  const pc = D.versions.find(v => v.id === D.current).checks.filter(c => /1\.2/.test(c.text));
  ok(pc.some(c => c.state === 'differs' && /period differs/.test(c.note)), 'the same figure for another year is not the same claim: ' + JSON.stringify(pc));
});

await t('suggested copy with a figure no approved fact or source supports is flagged, never presented as a rule', async () => {
  SUGGEST = { design: [], image: [], typography: [], copy: [{ text: 'Say it costs farmers $14 billion a year', why: 'stronger', basis: 'rule', changes: 'support', preserves: 'headline', paid: false }, { text: 'Lead with the 50.8 cents per litre excise', why: 'fact', basis: 'rule', changes: 'headline', preserves: 'cta', paid: false }], concept: [] };
  const r = await req('POST', '/studio/suggest', { asset: A, refresh: true }); eq(r.status, 200, JSON.stringify(r.d));
  const c = r.d.copy || (r.d.suggestions && r.d.suggestions.copy) || [];
  const bad = c.find(x => /14 billion/.test(x.text)), good = c.find(x => /50\.8/.test(x.text));
  ok(bad && bad.unverifiedFigures && bad.unverifiedFigures.length && bad.basis === 'inferred', JSON.stringify(bad));
  ok(good && !good.unverifiedFigures, JSON.stringify(good));
});

await t('wordmark variants live side by side under immutable keys: tone and default recorded, each served by variant and version, a re-upload makes a new version and the old one still answers; the logo too', async () => {
  for (const [variant, tone, fill] of [['blue', 'colour', 1], ['white', 'light', 2], ['black', 'dark', 3]]) { const r = await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: variant, wordmarkTone: tone, wordmarkB64: png(fill), wordmarkMime: 'image/png' }); eq(r.status, 200, JSON.stringify(r.d)); }
  const kit = (await req('GET', '/brand/kit?ns=mca')).d; const camp = (kit.kit || kit).campaigns.find(c => c.id === 'hoof');
  eq(camp.wordmarks.map(w => [w.variant, w.tone]), [['blue', 'colour'], ['white', 'light'], ['black', 'dark']]); eq(camp.wordmarkDefault, 'blue', 'the first uploaded is the default until one is named');
  const white = camp.wordmarks.find(w => w.variant === 'white');
  const served = await handler.fetch(new Request('https://newsaus.test/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + white.v, { headers: { 'X-Axiom-Key': 'full-key' } }), env, ctx);
  eq(served.status, 200); eq(Buffer.from(await served.arrayBuffer()).toString('base64'), png(2));
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: png(7), wordmarkMime: 'image/png' });
  const camp2 = ((await req('GET', '/brand/kit?ns=mca')).d.kit || (await req('GET', '/brand/kit?ns=mca')).d).campaigns.find(c => c.id === 'hoof');
  ok(camp2.wordmarks.find(w => w.variant === 'white').v !== white.v, 'a new file is a new version');
  const old = await handler.fetch(new Request('https://newsaus.test/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + white.v, { headers: { 'X-Axiom-Key': 'full-key' } }), env, ctx);
  eq(Buffer.from(await old.arrayBuffer()).toString('base64'), png(2), 'approved work keeps its exact mark');
  // a new composition carries a versioned variant src and the approved alternatives, picked by the ground it sits on
  const E = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '1:1', title: 'Variants', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy', cta: 'Sign' }, mode: 'composition' })).d.asset;
  const wm = E.versions[0].layout.layers.find(l => l.role === 'wordmark');
  ok(/variant=(blue|white|black)&v=[a-z0-9]+/.test(wm.src) && wm.variants.length === 3, JSON.stringify(wm));
  // the logo: a re-upload gets a new content version and the old one is still served
  await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(11), logoMime: 'image/png' }); const v1 = ((await req('GET', '/brand/kit?ns=mca')).d.kit || (await req('GET', '/brand/kit?ns=mca')).d).logoV;
  await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(12), logoMime: 'image/png' }); const v2 = ((await req('GET', '/brand/kit?ns=mca')).d.kit || (await req('GET', '/brand/kit?ns=mca')).d).logoV;
  ok(v1 && v2 && v1 !== v2, [v1, v2].join(' '));
  const l1 = await handler.fetch(new Request('https://newsaus.test/brand/logo?ns=mca&v=' + v1, { headers: { 'X-Axiom-Key': 'full-key' } }), env, ctx); eq(Buffer.from(await l1.arrayBuffer()).toString('base64'), png(11));
});

await t('a mark file change makes the composition\'s evidence stale even with the same words and layout', async () => {
  const { a, v } = await curV(P, A); await measure(P, A, rep => { box(rep, 'headline').lines = 3; });
  eq((await readiness(A)).technical, 'passed');
  await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'blue', wordmarkTone: 'colour', wordmarkB64: png(21), wordmarkMime: 'image/png' });
  eq((await readiness(A)).technical, 'stale', 'the campaign\'s marks changed under the same layout');
  ok((await get(P)).assets.find(x => x.id === A).approvals.design, 'the design approval itself still stands (same words, same layout)');
  const j = await run((await req('POST', '/studio/job', { project: P, stage: 'export', input: { assets: [A] }, idem: 'exp-3' })).d.job); eq(j.state, 'done', j.error);
  const ex = lastManifest().excluded.find(x => x.asset === A); ok(ex && /not validated/.test(ex.why), 'but export waits for a measurement with the new mark: ' + JSON.stringify(lastManifest().excluded));
});

await t('a region render whose region has since been removed is filed as a branch off the version it was asked for; current is left alone and nothing blank replaces it', async () => {
  const L = JSON.parse(JSON.stringify(REPAIRED)); L.regions = L.regions.concat([{ id: 'c1', role: 'cutout', x: 60, y: 10, w: 30, h: 30, prompt: 'a harvester cut out' }]);
  L.layers.splice(1, 0, { id: 'c1', type: 'img', role: 'cutout', region: 'c1', x: 60, y: 10, w: 30, h: 30, fit: 'contain' });
  const F = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'Region', copy: HOOF_COPY, layout: L, mode: 'composition', image: { key: 'studio/fixture/photo.png' } })).d.asset;
  const j = (await req('POST', '/studio/job', { project: P, asset: F.id, stage: 'render', input: { prompt: 'a harvester cut out', region: 'c1', size: '1K' }, idem: 'reg-1' })).d.job;
  const L2 = JSON.parse(JSON.stringify(L)); L2.layers = L2.layers.filter(l => l.id !== 'c1'); L2.regions = L2.regions.filter(r => r.id !== 'c1');
  const w = await req('POST', '/studio/version', { asset: F.id, layout: L2, copy: HOOF_COPY, note: 'cutout removed' }); const keep = w.d.version ? w.d.version.id : (await curV(P, F.id)).v.id;
  const done = await run(j); eq(done.state, 'done', done.error); eq(done.result.branch, true, JSON.stringify(done.result));
  const after = await curV(P, F.id); eq(after.v.id, keep, 'current stays the version without the cutout');
  // an answer with no image is a failure, never a blank version
  gem.answer = 'text'; const n0 = after.a.versions.length;
  const j2 = await run((await req('POST', '/studio/job', { project: P, asset: F.id, stage: 'render', input: { prompt: 'again', size: '1K' }, idem: 'reg-2' })).d.job);
  ok(j2.state !== 'done', 'no image is not success: ' + j2.state); eq((await curV(P, F.id)).a.versions.length, n0, 'no version was written'); gem.answer = 'image';
  eq((await req('POST', '/studio/job', { project: P, asset: F.id, stage: 'render', input: { prompt: 'again', size: '1K' }, idem: 'reg-2' })).d.job.id, j2.id, 'the same request is the same job: nothing paid twice');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
