/* Creative Studio S11, the worker's side of mark readability and placement: the validation contract is versioned (a report
 * that does not state contract 2 is refused with the reason; evidence filed under an older signature reads as stale and never
 * certifies a composition under the new rules); a loaded mark reported without its per-pixel figures is unmeasured, not clean;
 * the straddling wordmark of the 5 October screenshot, reported honestly, fails the worker's re-judging (mark_unreadable) and
 * design approval is refused, while the same mark moved into the footer passes; a campaign mark rule carries clear space, a
 * minimum width and a region through the kit (sanitised), through production onto the layer with its basis (a preferred rule is
 * stamped too, and does not hold the mark), and through Teach this brand; the slim report the worker keeps carries the ink
 * figures. Providers are mocked; nothing is spent.
 * Run: node --experimental-sqlite tests/studio-s11-worker.mjs */
import { D1Lite } from './d1lite.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import { HOOF_STRADDLE, HOOF_STRADDLE_COPY } from './fixtures/studio-layouts.mjs';
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
const png = fill => { const b = Buffer.alloc(160, fill || 0); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b[24] = 8; b[25] = 6; return b.toString('base64'); };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png(9) } }] } }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    const body = JSON.parse(init.body); const sys = String(body.system || '');
    const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    let text = '{}';
    if (/producing a coordinated set/.test(sys)) text = JSON.stringify({ pieces: ['instagram', 'facebook'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'Not a subsidy.', alt: 'tile', visual: 'a farmer at a tank', claims: [] })) });
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
const measure = async (P, A, tweak, opts) => { const { a, v } = await curV(P, A); const rep = stubReport(v, a, opts); if (tweak) tweak(rep, v); return req('POST', '/studio/validation', { asset: A, version: v.id, report: rep, imageB64: png(3) }); };
const box = (rep, id) => rep.boxes.find(b => b.id === id);
const codes = r => (r.d.validation ? r.d.validation.issues : []).map(i => i.code + '/' + i.severity + ':' + i.layers.join(','));

console.log('studio-s11-worker harness (validation contract 2, stale evidence, unmeasured marks, the straddle judged server-side, rule fields through kit, production and teaching)');
await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' },
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', identity: 'MYTH in red, FACT in teal', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }],
  facts: [{ text: 'The fuel excise is 50.8 cents per litre', source: 'ATO', status: 'approved', campaign: 'hoof' }] });
await req('POST', '/brand/kit', { ns: 'mca', logoB64: png(11), logoMime: 'image/png' });
await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: png(2), wordmarkMime: 'image/png', wordmarkDefault: true });
await req('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'blue', wordmarkTone: 'colour', wordmarkB64: png(4), wordmarkMime: 'image/png' });
const P = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF straddle', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'] } })).d.id;
// the reconstruction of the reported tile, its wordmark pointed at the file this kit really holds
const STRADDLE = JSON.parse(JSON.stringify(HOOF_STRADDLE)); const wmSrc = (await req('GET', '/brand/kit?ns=mca')).d.kit.campaigns.find(c => c.id === 'hoof').wordmarks.find(w => w.variant === 'white');
STRADDLE.layers.find(l => l.id === 'wordmark').src = '/brand/wordmark?ns=mca&campaign=hoof&variant=white&v=' + (wmSrc && wmSrc.v || 'w1');
const A = (await req('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'Straddle tile', copy: HOOF_STRADDLE_COPY, layout: STRADDLE, mode: 'composition', image: { key: 'studio/fixture/photo.png', url: '/studio/file?key=studio/fixture/photo.png' } })).d.asset.id;
r2.set('studio/fixture/photo.png', { v: Buffer.from(png(5), 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
// the straddle as the renderer measures it (tests/studio-marks-browser.mjs, section 1): half the strokes lost, the upper part, across a light/dark boundary
const straddle = rep => { Object.assign(box(rep, 'wordmark'), { inkLost: 0.5, inkWeak: 0, inkCovered: 0, inkLocal: 1.19, inkMean: 4.59, inkRun: 0.333, inkWhere: 'upper part', inkBoundary: true, contrast: 4.59 }); };

await t('a report that does not state the validation contract is refused as a mismatch (422) with the reason and the remedy, and nothing is recorded', async () => {
  const r = await measure(P, A, rep => { delete rep.contract; });
  eq(r.status, 422, JSON.stringify(r.d)); eq(r.d.error, 'report_mismatch'); ok(/contract 1 \(none stated\)/.test(r.d.detail) && /contract 2/.test(r.d.detail) && /reload the page/.test(r.d.detail), r.d.detail);
  const r1 = await measure(P, A, rep => { rep.contract = 1; }); eq(r1.status, 422); ok(/contract 1;/.test(r1.d.detail), r1.d.detail);
  eq((await readiness(A)).technical, 'not_validated', 'no refused report became evidence');
});

await t('a loaded mark reported without its per-pixel figures is unmeasured: the composition is not passed, the finding says unknown rather than clean', async () => {
  const r = await measure(P, A, null, { markInk: false });
  eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.validation.ok, false);
  const c = codes(r); ok(c.some(x => /^mark_unmeasured\/blocking:wordmark/.test(x)) || c.some(x => /^pixels_unmeasured\/blocking/.test(x)), c.join(', '));
  const rd = await readiness(A); eq(rd.technical, 'failed'); ok(rd.reasons.some(x => /unmeasured/.test(x)), JSON.stringify(rd.reasons));
});

await t('the reported defect, judged by the worker: half the wordmark\'s strokes lost across the panel/footer boundary is mark_unreadable (blocking) even though the mean contrast is 4.6:1; readiness fails, design approval is 409, the stored report carries the ink figures', async () => {
  const r = await measure(P, A, straddle); eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.validation.ok, false);
  const bad = r.d.validation.issues.find(i => i.code === 'mark_unreadable'); ok(bad && bad.severity === 'blocking' && bad.layers[0] === 'wordmark', JSON.stringify(codes(r)));
  ok(/50% of the wordmark/.test(bad.detail) && /light\/dark boundary/.test(bad.detail) && /upper part/.test(bad.detail) && /per pixel, not an average/.test(bad.detail), bad.detail);
  ok(codes(r).some(x => /^double_styling\/warning:cta/.test(x)), 'the CTA plate plus outline is named as double styling: ' + codes(r).join(', '));
  const rd = await readiness(A); eq(rd.technical, 'failed'); ok(rd.reasons[0].includes('mark_unreadable (wordmark)'), rd.reasons[0]);
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'ship it' }); eq(ap.status, 409); eq(ap.d.error, 'validation_failed');
  const row = await env.MIND_DB.prepare('SELECT report FROM studio_validations WHERE asset=? ORDER BY created DESC, id DESC LIMIT 1').bind(A).first(); const slim = JSON.parse(row.report);
  eq(slim.contract, 2); const wm = slim.boxes.find(b => b.id === 'wordmark'); eq([wm.inkLost, wm.inkWhere, wm.inkBoundary, wm.clearWant != null], [0.5, 'upper part', true, true], 'the slim report keeps the per-pixel evidence: ' + JSON.stringify(wm));
});

await t('the correction: the same wordmark moved down into the footer (same file, same size) measured with every stroke reading passes, and design approval stands', async () => {
  const { v } = await curV(P, A); const L = JSON.parse(JSON.stringify(v.layout)); const mk = L.layers.find(l => l.id === 'wordmark'); mk.y = 88.5; mk.h = 9;
  const w = await req('POST', '/studio/version', { asset: A, copy: v.copy, layout: L, note: 'moved the wordmark 7% down within its corner so every stroke reads' }); eq(w.status, 200, JSON.stringify(w.d));
  const rd0 = await readiness(A); ok(rd0.technical !== 'passed' && rd0.production === false, 'a moved layout carries no passing evidence: ' + rd0.technical);
  const r = await measure(P, A, rep => { Object.assign(box(rep, 'wordmark'), { inkLost: 0, inkWeak: 0, inkLocal: 8.04, inkMean: 8.04, inkRun: 0, inkWhere: '', inkBoundary: false, contrast: 8.04 }); });
  eq(r.status, 200, JSON.stringify(r.d)); eq(r.d.validation.ok, true, codes(r).join(', ')); ok(!codes(r).some(x => /^mark_/.test(x)), codes(r).join(', '));
  eq((await readiness(A)).technical, 'passed');
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'the mark reads on the footer now' }); eq(ap.status, 200, JSON.stringify(ap.d));
});

await t('evidence filed under an older signature (a validation made before the contract entered the signature) reads as stale: readiness says so, approval is refused, nothing passes silently', async () => {
  const { v } = await curV(P, A);
  await env.MIND_DB.prepare('UPDATE studio_validations SET sig=? WHERE asset=? AND version=?').bind('pre-contract-signature', A, v.id).run();
  const rd = await readiness(A); eq(rd.technical, 'stale'); ok(rd.reasons.some(x => /not validated/.test(x)), JSON.stringify(rd.reasons)); eq(rd.production, false);
  await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'withdraw', reason: 'measure again under the new contract' });
  const ap = await req('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'trust the old pass' }); eq(ap.status, 409, JSON.stringify(ap.d));
  // measured again under contract 2, it passes again
  const r = await measure(P, A, rep => { Object.assign(box(rep, 'wordmark'), { inkLost: 0, inkLocal: 8.04, inkMean: 8.04, contrast: 8.04 }); }); eq(r.d.validation.ok, true, codes(r).join(', ')); eq((await readiness(A)).technical, 'passed');
});

await t('a campaign mark rule carries clear space, a minimum width and a region through the kit, sanitised: out-of-range figures are dropped, a rule with neither corner nor region does not exist, and GET returns what was kept', async () => {
  const k1 = await req('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', markRule: { corner: 'bl', mandatory: true, note: 'bottom left, in the footer', clearSpace: 0.75, minWidth: 10, region: { x: 0, y: 86, w: 100, h: 14 }, basis: 'rule' } }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo', markRule: { mandatory: true, clearSpace: 9, minWidth: 1 } }] });
  eq(k1.status, 200, JSON.stringify(k1.d));
  const kit = (await req('GET', '/brand/kit?ns=mca', null, 'read-key')).d.kit;
  eq(kit.campaigns.find(c => c.id === 'hoof').markRule, { corner: 'bl', mandatory: true, note: 'bottom left, in the footer', clearSpace: 0.75, minWidth: 10, region: { x: 0, y: 86, w: 100, h: 14 }, basis: 'rule' });
  eq(kit.campaigns.find(c => c.id === 'national').markRule, undefined, 'no corner and no region: no rule');
  const k2 = await req('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', markRule: { corner: 'bl', mandatory: true, clearSpace: 9, minWidth: 90, region: { x: 50, y: 50, w: 80, h: 10 } } }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }] });
  eq(k2.status, 200); const r2k = (await req('GET', '/brand/kit?ns=mca', null, 'read-key')).d.kit.campaigns.find(c => c.id === 'hoof').markRule;
  eq(r2k, { corner: 'bl', mandatory: true, note: '' }, 'a clear space of 9 heights, a 90% minimum and a region past the stage edge are dropped, the corner kept: ' + JSON.stringify(r2k));
  ok(kit.campaigns.find(c => c.id === 'hoof').wordmarks.length === 2, 'the wordmark library survives the saves');
});

await t('production stamps the rule on the mark layer with its provenance: a mandatory rule (basis rule, with its clear space, minimum and region) holds the mark; a preferred rule is carried as such and does not hold it', async () => {
  await req('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', markRule: { corner: 'bl', mandatory: true, note: 'in the footer', clearSpace: 0.75, minWidth: 10, region: { x: 0, y: 86, w: 100, h: 14 } } }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo', markRule: { corner: 'br', mandatory: false, note: 'usually bottom right' } }] });
  const PP = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Held', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'] } })).d.id;
  const j = await run((await req('POST', '/studio/job', { project: PP, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', acknowledge: true }, idem: 's11-held' })).d.job); eq(j.state, 'done', j.error);
  const g = await get(PP); const a = g.assets[0]; const v = a.versions.find(x => x.id === a.current); const wm = (v.layout.layers || []).find(l => l.role === 'wordmark'); ok(wm, 'a wordmark layer');
  eq(wm.rule, { mandatory: true, note: 'in the footer', basis: 'rule', corner: 'bl', region: { x: 0, y: 86, w: 100, h: 14 }, clearSpace: 0.75, minWidth: 10 }, 'the layer rule: ' + JSON.stringify(wm.rule));
  const moved = JSON.parse(JSON.stringify(v.layout)); moved.layers.find(l => l.role === 'wordmark').x = 70;
  const r = await req('POST', '/studio/version', { asset: a.id, copy: v.copy, layout: moved, note: 'move the mark' }); eq(r.status, 409, JSON.stringify(r.d)); eq(r.d.error, 'mark_held');
  const PN = (await req('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).d.id;
  const j2 = await run((await req('POST', '/studio/job', { project: PN, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', acknowledge: true }, idem: 's11-pref' })).d.job); eq(j2.state, 'done', j2.error);
  const g2 = await get(PN); const a2 = g2.assets[0]; const v2 = a2.versions.find(x => x.id === a2.current); const lg = (v2.layout.layers || []).find(l => l.role === 'logo'); ok(lg, 'a logo layer');
  eq(lg.rule, { mandatory: false, note: 'usually bottom right', basis: 'preferred', corner: 'br' }, 'the preferred rule rides on the layer, named as preferred: ' + JSON.stringify(lg.rule));
  const moved2 = JSON.parse(JSON.stringify(v2.layout)); moved2.layers.find(l => l.role === 'logo').x = 6;
  const r2v = await req('POST', '/studio/version', { asset: a2.id, copy: v2.copy, layout: moved2, note: 'move the logo' }); eq(r2v.status, 200, 'a preferred rule does not hold the mark: ' + JSON.stringify(r2v.d));
});

await t('Teach this brand carries the new fields: a confirmed placement proposal with clear space, a minimum width and a region writes them into the campaign rule, and the preview shows the rule that would be written', async () => {
  const pv = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits in the footer band', clearSpace: 0.6, minWidth: 8, region: { x: 0, y: 84, w: 100, h: 16 } } })).d;
  eq(pv.ok, true, JSON.stringify(pv)); eq(pv.written, false); eq(pv.preview.rule, { corner: 'bl', mandatory: true, note: 'the wordmark sits in the footer band', clearSpace: 0.6, minWidth: 8, region: { x: 0, y: 84, w: 100, h: 16 } }, JSON.stringify(pv.preview.rule));
  const w = (await req('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits in the footer band', clearSpace: 0.6, minWidth: 8, region: { x: 0, y: 84, w: 100, h: 16 } }, confirm: true, reason: 'Dee confirmed the footer band on the approved tiles' })).d;
  eq(w.ok, true, JSON.stringify(w)); eq(w.written, true);
  const kit = (await req('GET', '/brand/kit?ns=mca', null, 'read-key')).d.kit; eq(kit.campaigns.find(c => c.id === 'hoof').markRule, { corner: 'bl', mandatory: true, note: 'the wordmark sits in the footer band', clearSpace: 0.6, minWidth: 8, region: { x: 0, y: 84, w: 100, h: 16 } });
  const ws = (await req('GET', '/brand/workspace?ns=mca&campaign=hoof', null, 'read-key')).d; eq([ws.placement.basis, ws.placement.corner, ws.placement.mandatory], ['rule', 'bl', true]);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
