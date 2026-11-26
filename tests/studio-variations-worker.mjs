/* Five options everywhere (25 November 2026: "we need more than 4 options ... 5"). Providers MOCKED: nothing is spent.
 *   VA1 a Full AI creative can be painted five ways in one press: five render jobs, each told a different visual approach, all from
 *       the same version; the first to land is current and the other four are filed beside it as versions to choose from
 *   VA2 the count is bounded (2 to 5) and a single regeneration is unchanged
 *   VA3 the directions stage proposes five by default (one to eight on request); the art direction stage asks for five concepts
 * Run: node --experimental-sqlite tests/studio-variations-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngB64 } from './png.mjs';
const T = suite('studio-variations-worker (five options: Full AI variations, five directions, five concepts)');
const PNG = pngB64(16, 16, { fill: 0x00 });
const PNG_LOGO = pngB64(16, 16, { fill: 0x11 });
const PNG_MARK = pngB64(16, 16, { fill: 0x22 });
const gem = { calls: [] }; const anth = { calls: [] }; let inspectAnswer = null; let gemFail = false;
const PLAN = { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', story: 'the credit, plainly', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A quiet regional road at dusk' }],
  elements: [{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 5, y: 56, w: 70, h: 36, fill: '#0E6A6E', opacity: 0.92 }, { id: 'hl', type: 'text', role: 'headline', x: 8, y: 59, w: 64, h: 16, size: 5.2, color: '#FFFFFF' }, { id: 'sp', type: 'text', role: 'support', x: 8, y: 76, w: 64, h: 8, size: 2.6, color: '#FFFFFF' }, { id: 'cta', type: 'text', role: 'cta', x: 8, y: 85, w: 40, h: 5, size: 2.4, color: '#FFFFFF' }] };
const w = await workerEnv({ env: { STUDIO_INSPECT: '1', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_PERSON_DAILY_IMAGES: '0', STUDIO_PERSON_DAILY_CALLS: '0' } });
w.answer(/generativelanguage/, async (u, init) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
  if (gemFail) return new Response(JSON.stringify({ error: { code: 400, message: 'request refused (test)', status: 'INVALID_ARGUMENT' } }), { status: 400 });
  const body = JSON.parse(init.body); const model = decodeURIComponent((u.match(/models\/([^:]+):/) || [])[1] || ''); gem.calls.push({ model, body });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); anth.calls.push(body); const sys = String(body.system || '');
  let text = '{}';
  if (/producing a coordinated set/.test(sys)) text = JSON.stringify({ pieces: [{ channel: 'instagram', headline: 'Fact: fuel tax credits are not a subsidy', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'handsoffourfuel.com.au', caption: 'The credit returns a tax that never applied.', alt: 'A teal fact tile', visual: 'A regional road at dusk', claims: [], hashtags: [], plan: JSON.parse(JSON.stringify(PLAN)) }, { channel: 'linkedin', headline: 'Gas supplies a quarter of the energy', support: 'Plainly.', cta: 'Read more', caption: 'c', alt: 'a', visual: 'v', claims: [], hashtags: [], plan: JSON.parse(JSON.stringify(PLAN)) }] });
  else if (/art director inspecting a rendered social tile/.test(sys)) text = JSON.stringify(inspectAnswer || { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 4, reasons: {}, words: { present: [], wrong: [], missing: [] }, marks: { present: [], missing: [], wrong: [] }, issues: [], verdict: 'ship', fix: { kind: 'none', instruction: '' }, note: '' });
  return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 4 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const assetOf = async (P, A) => (await get(P)).assets.find(x => x.id === A);
const curOf = a => a.versions.find(v => v.id === a.current);
const textOf = body => { const c0 = body.messages[0].content; return typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join(''); };
const imagesOf = body => { const c0 = body.messages[0].content; return typeof c0 === 'string' ? 0 : c0.filter(x => x.type === 'image').length; };

// MCA with its logo; HOOF carries its own wordmark and never the client logo (policy wordmark)
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', identity: 'MYTH in red, FACT in teal, the HANDS OFF OUR FUEL wordmark', url: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining' }], facts: [], logoB64: PNG_LOGO, logoMime: 'image/png' });
await call('GET', '/engine/status?ns=mca');
const wm = await call('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG_MARK, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' }); eq(wm.status, 200, JSON.stringify(wm.body));

let P = '', A = '';
const sysOf = re => anth.calls.filter(b => re.test(String(b.system || '')));

await T.t('setup: a Full AI creative with its painting on file', async () => {
  const p = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Variations', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, creationMode: 'finished' }, idem: 'va-p' });
  P = p.body.id;
  const j0 = await call('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, instruction: 'One tile', acknowledge: true }, idem: 'va-copy' });
  const j = await run(j0.body.job); eq(j.state, 'done', j.error); A = j.result.assets[0];
  for (const id of j.result.renders) await run((await call('GET', '/studio/job?id=' + id)).body.job);
  const a = await assetOf(P, A); ok(curOf(a).image && curOf(a).image.key, 'the painting is on file');
});

await T.t('VA1: five variations in one press, each a different visual approach; one lands current and four beside it', async () => {
  const a0 = await assetOf(P, A); const v0 = a0.current; const n0 = a0.versions.length; const g0 = gem.calls.length;
  const r = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K' }); eq(r.status, 200, JSON.stringify(r.body));
  eq((r.body.jobs || []).length, 5, 'five render jobs'); eq(r.body.variations, 5);
  const jobs = []; for (const id of r.body.jobs) jobs.push((await call('GET', '/studio/job?id=' + id)).body.job);
  const ins = jobs.map(j => j.input.instruction || ''); eq(new Set(ins).size, 5, 'five different briefs: ' + JSON.stringify(ins.map(x => x.slice(0, 60))));
  ok(jobs.every(j => j.input.finished && !j.input.edit), 'each is a fresh painting of the whole piece, not an edit of the last');
  for (const j of jobs) eq((await run(j)).state, 'done');
  eq(gem.calls.length - g0, 5, 'five image calls');
  const a1 = await assetOf(P, A); ok(a1.current !== v0, 'a new painting is current');
  const fresh = a1.versions.filter(v => v.mode === 'finished' && v.image && v.image.key && v.id !== v0 && a1.versions.indexOf(v) >= 0).filter(v => !a0.versions.some(x => x.id === v.id));
  eq(fresh.length, 5, 'five new paintings to choose from (' + (a1.versions.length - n0) + ' new versions)');
  ok(fresh.every(v => /variation \d of 5/.test(v.note || '') || /variation/.test(JSON.stringify(v.context || {}))), 'each says it is one of the variations: ' + JSON.stringify(fresh.map(v => v.note)));
});

await T.t('VA2: two to five; a plain regeneration is one job as before', async () => {
  const big = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 12, size: '1K' }); eq((big.body.jobs || []).length, 5, 'held to five');
  for (const id of big.body.jobs) await run((await call('GET', '/studio/job?id=' + id)).body.job);
  const one = await call('POST', '/studio/finished/regenerate', { asset: A, instruction: 'warmer light', size: '1K' }); eq((one.body.jobs || []).length, 1, 'one job');
});

await T.t('VA3: five directions by default; the art direction stage asks for five concepts', async () => {
  const src = await call('POST', '/studio/source', { project: P, kind: 'brief', name: 'b', text: 'Fuel tax credits are not a subsidy. Mining employs 300,000 Australians.' });
  const before = anth.calls.length;
  const j = await call('POST', '/studio/job', { project: P, stage: 'direct', input: {}, idem: 'va-dir' }); await run(j.body.job);
  const d = anth.calls.slice(before).find(b => /propose|direction/i.test(String(b.system || '') + textOf(b)));
  ok(d && /\b5 (genuinely different )?direction|Give 5 direction/.test(textOf(d) + String(d.system || '')), 'five directions asked for: ' + (d ? (textOf(d).match(/Give \d+ direction[^\n]*/) || [''])[0] : 'no call'));
  const ed = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Concepts', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' } }, idem: 'va-p2' });
  const jc = await call('POST', '/studio/job', { project: ed.body.id, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, instruction: 'One tile', acknowledge: true }, idem: 'va-c2' });
  const jr = await run(jc.body.job); const A2 = jr.result.assets[0]; const b2 = anth.calls.length;
  const jx = await call('POST', '/studio/job', { project: ed.body.id, asset: A2, stage: 'concepts', input: { asset: A2, mode: 'explore', feedback: 'more options' }, idem: 'va-x' }); await run(jx.body.job);
  const c = anth.calls.slice(b2).map(b => textOf(b) + String(b.system || '')).join('\n');
  ok(/Give five distinct concepts/.test(c), 'five concepts asked for');
});

await T.t('VA4: a repeated press (two tabs, a resent request) queues the same five jobs, never five more', async () => {
  const a = await assetOf(P, A);
  const r1 = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '2K' });
  const r2 = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '2K' });
  eq(r1.body.jobs, r2.body.jobs, 'the repeat answers the jobs already queued');
  for (const id of r1.body.jobs) await run((await call('GET', '/studio/job?id=' + id)).body.job);
  ok(a, 'asset read');
});

await T.t('VA5: run together, five variations make one current version, four kept beside it, and one inspection', async () => {
  const insp0 = (await get(P)).jobs.filter(j => j.stage === 'inspect').length;
  const a0 = await assetOf(P, A);
  const r = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K', instruction: 'concurrent run' });
  const jobs = []; for (const id of r.body.jobs) jobs.push((await call('GET', '/studio/job?id=' + id)).body.job);
  await Promise.all(jobs.map(j => call('POST', '/studio/job/step', { id: j.id })));
  for (const j of jobs) await run((await call('GET', '/studio/job?id=' + j.id)).body.job);
  const g = await get(P); const a1 = g.assets.find(x => x.id === A);
  const fresh = a1.versions.filter(v => !a0.versions.some(x => x.id === v.id) && /^variation \d of 5/.test(v.note || ''));
  eq(fresh.length, 5, 'five paintings filed');
  const insp = g.jobs.filter(j => j.stage === 'inspect').length - insp0;
  eq(insp, 1, 'one inspection, of the one that became current (' + insp + ')');
  ok(fresh.every(v => (v.context || {}).variationRun), 'each names its run, so the picker never mixes runs');
  eq(new Set(fresh.map(v => v.context.variationRun)).size, 1, 'one run');
});

await T.t('VA6: the answers have room for five: the directions and concepts budgets scale with the count, and the system prompt says five', async () => {
  const b0 = anth.calls.length;
  const j = await call('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 8 }, idem: 'va-dir8' }); await run(j.body.job);
  const d = anth.calls.slice(b0).find(b => /Give 8 direction/.test(textOf(b)));
  ok(d && d.max_tokens >= 12000, 'eight directions get room (' + (d && d.max_tokens) + ')');
  const c = anth.calls.find(b => /Give five distinct concepts/.test(textOf(b)));
  ok(c && c.max_tokens >= 20000, 'five concepts get room (' + (c && c.max_tokens) + ')');
  ok(c && /five concepts that differ visibly/.test(String(c.system)) && !/three concepts that differ/.test(String(c.system)), 'the system prompt agrees: five');
});

await T.t('VA8: a run whose every painting failed is not handed back: pressing again paints again', async () => {
  gemFail = true;
  const r1 = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K', instruction: 'outage run' }); eq(r1.status, 200, JSON.stringify(r1.body));
  for (const id of r1.body.jobs) { let j = (await call('GET', '/studio/job?id=' + id)).body.job; for (let i = 0; i < 6 && /queued|running/.test(j.state); i++) j = (await call('POST', '/studio/job/step', { id })).body.job; }
  const st = []; for (const id of r1.body.jobs) st.push((await call('GET', '/studio/job?id=' + id)).body.job.state);
  ok(st.every(s => s === 'failed' || s === 'cancelled'), 'the first run failed: ' + st.join(','));
  gemFail = false;
  const r2 = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K', instruction: 'outage run' });
  eq((r2.body.jobs || []).length, 5, 'five jobs');
  ok(r2.body.jobs.every(id => r1.body.jobs.indexOf(id) < 0), 'new jobs, not the failed ones');
  for (const id of r2.body.jobs) eq((await run((await call('GET', '/studio/job?id=' + id)).body.job)).state, 'done');
});

await T.t('VA9: a painting the person restores while the run paints stays current, even when it is the same image the run started from', async () => {
  const a0 = await assetOf(P, A); const v0 = a0.current;
  const r = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K', instruction: 'restore run' });
  await run((await call('GET', '/studio/job?id=' + r.body.jobs[0])).body.job);
  ok((await assetOf(P, A)).current !== v0, 'the first painting landed current');
  const rs = await call('POST', '/studio/version', { asset: A, restoreFrom: v0 }); eq(rs.status, 200, JSON.stringify(rs.body).slice(0, 300));
  const picked = (await assetOf(P, A)).current;
  for (const id of r.body.jobs.slice(1)) await run((await call('GET', '/studio/job?id=' + id)).body.job);
  eq((await assetOf(P, A)).current, picked, 'the restore still stands');
});

await T.t('VA10: a caption edited before the run starts still lets the first painting land current', async () => {
  const a0 = await assetOf(P, A);
  const r = await call('POST', '/studio/finished/regenerate', { asset: A, variations: 5, size: '1K', instruction: 'caption run' });
  const ed = await call('POST', '/studio/version', { asset: A, copy: { caption: 'A caption written while the run waits.' }, kind: 'text' }); eq(ed.status, 200, JSON.stringify(ed.body).slice(0, 300));
  const afterEdit = (await assetOf(P, A)).current;
  for (const id of r.body.jobs) await run((await call('GET', '/studio/job?id=' + id)).body.job);
  const a1 = await assetOf(P, A); const cur = curOf(a1);
  ok(a1.current !== afterEdit && /^variation \d of 5/.test(cur.note || ''), 'a painting of the run is current: ' + cur.note);
  ok(a0, 'asset read');
});

await T.t('VA7: the worker names its build p77 or later so a page that sends variations can tell an older worker', async () => {
  const s = await call('GET', '/studio/status'); const m = /studio-p(\d+)$/.exec(s.body.build || ''); ok(m && +m[1] >= 77, s.body.build);
});

const r = T.done(); w.restore(); process.exit(r.fail ? 1 : 0);
