/* Two creation modes (S2). Mode A, Editable Studio: Gemini makes only the imagery; the Studio composes the words, the exact
 * marks and the shapes as live layers (the default, and everything built so far). Mode B, Gemini Finished Creative: the image
 * model paints the whole piece - words, the campaign's own mark and the URL - from the approved copy, with the mark files sent
 * to it as actual image inputs; the result is one flattened bitmap, labelled as such, with no element composed over it, and the
 * words and marks are read back by the inspection before design approval. The hybrid "artwork" mode (words painted, marks placed
 * exactly by the Studio) stays as it was and is labelled as the hybrid it is. Providers MOCKED: nothing is spent.
 * Run: node --experimental-sqlite tests/studio-s2-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s2-worker (two creation modes: Editable Studio and Gemini Finished Creative, the hybrid labelled)');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const PNG_LOGO = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const PNG_MARK = Buffer.from('89504e470d0a1a0a' + '22'.repeat(100), 'hex').toString('base64');
const gem = { calls: [] }; const anth = { calls: [] }; let inspectAnswer = null;
const PLAN = { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', story: 'the credit, plainly', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'A quiet regional road at dusk' }],
  elements: [{ id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 5, y: 56, w: 70, h: 36, fill: '#0E6A6E', opacity: 0.92 }, { id: 'hl', type: 'text', role: 'headline', x: 8, y: 59, w: 64, h: 16, size: 5.2, color: '#FFFFFF' }, { id: 'sp', type: 'text', role: 'support', x: 8, y: 76, w: 64, h: 8, size: 2.6, color: '#FFFFFF' }, { id: 'cta', type: 'text', role: 'cta', x: 8, y: 85, w: 40, h: 5, size: 2.4, color: '#FFFFFF' }] };
const w = await workerEnv({ env: { STUDIO_INSPECT: '1', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/generativelanguage/, async (u, init) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
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

let P = '', A = '', FIN = null;
await T.t('the brief records the creation mode; editable is the default and an unknown value is refused, not guessed', async () => {
  const p = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Finished mode', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, creationMode: 'finished' }, idem: 's2-fin' });
  eq(p.status, 200, JSON.stringify(p.body)); P = p.body.id; eq(p.body.brief.creationMode, 'finished');
  const d = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Default mode', brief: { objective: 'o', message: 'm' }, idem: 's2-def' });
  eq(d.body.brief.creationMode, 'editable', 'the default is the editable Studio');
  const b = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Bad mode', brief: { objective: 'o', creationMode: 'magic' }, idem: 's2-bad' });
  eq(b.body.brief.creationMode, 'editable', 'an unknown mode falls to editable and is not stored as given');
});
await T.t('finished-mode production: one render job that paints the whole piece, with the HOOF wordmark attached as an image input and the MCA logo nowhere', async () => {
  const j0 = await call('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, instruction: 'One tile', acknowledge: true }, idem: 's2-copy' });
  eq(j0.status, 200, JSON.stringify(j0.body)); const j = await run(j0.body.job); eq(j.state, 'done', j.error);
  eq(j.result.creationMode, 'finished'); eq(j.result.renders.length, 1);
  const g = await get(P); A = j.result.assets[0]; const a = g.assets.find(x => x.id === A); const v0 = curOf(a);
  eq(v0.mode, 'finished', 'the version is marked finished before the image lands'); eq(v0.layout.finished, true); eq(v0.layout.approach, 'artwork');
  ok(!v0.layout.layers.some(l => l.role === 'logo'), 'no MCA logo in the plan sketch of a HOOF tile');
  const rj = (await call('GET', '/studio/job?id=' + j.result.renders[0])).body.job;
  eq([rj.input.finished, rj.input.approach], [true, 'artwork']);
  ok(/Paint the whole tile|whole piece|finished creative/i.test(rj.input.prompt), 'the prompt asks for the finished piece: ' + rj.input.prompt.slice(0, 200));
  ok(/handsoffourfuel\.com\.au/.test(rj.input.prompt), 'the URL is set exactly in the prompt'); ok(/headline "Fact: fuel tax credits are not a subsidy"/.test(rj.input.prompt), 'the exact words');
  ok(/wordmark/i.test(rj.input.prompt) && /exactly as attached|reproduce it exactly|as supplied/i.test(rj.input.prompt), 'the mark is to be reproduced from the attached file: ' + rj.input.prompt);
  ok(/client logo must not appear|no client logo|must not appear/i.test(rj.input.prompt), 'HOOF: the MCA logo is forbidden in words too');
  eq(rj.input.marks.map(m => m.role), ['wordmark'], 'only the wordmark is sent: ' + JSON.stringify(rj.input.marks));
  const g0 = gem.calls.length; const done = await run(rj); eq(done.state, 'done', done.error); eq(gem.calls.length, g0 + 1);
  const parts = gem.calls[gem.calls.length - 1].body.contents[0].parts; const imgs = parts.filter(x => x.inline_data);
  eq(imgs.length, 1, 'exactly one image input: the wordmark'); eq(imgs[0].inline_data.data, PNG_MARK, 'the bytes are the HOOF wordmark file, not the MCA logo');
  ok(/REFERENCE IMAGES, attached in this order:\n1\. .*wordmark.*exact/i.test(parts[0].text), 'the role names the mark as exact: ' + parts[0].text.slice(-300));
  eq(done.result.finished, true);
  const a2 = await assetOf(P, A); FIN = curOf(a2);
  eq(FIN.mode, 'finished'); eq(FIN.layout.layers, [], 'nothing is composed over the bitmap'); eq(FIN.layout.baked.slice().sort(), ['cta', 'headline', 'support', 'wordmark'], 'words and the mark are in the bitmap');
  ok(FIN.image && FIN.image.key, 'the flattened image is the version'); eq(FIN.image.meta.finished, true); eq(FIN.image.meta.marksSent, ['wordmark']);
  const ev = (await get(P)).thread.filter(e => e.kind === 'job' && e.render).pop(); ok(/finished creative/i.test(ev.text) && /wordmark/.test(ev.text), ev.text);
});
await T.t('painted words and marks cannot be edited as layers (409 finished_bitmap); caption and alt text stay editable; the layout is not editable', async () => {
  const r1 = await call('POST', '/studio/version', { asset: A, copy: { headline: 'Changed' } }); eq(r1.status, 409, JSON.stringify(r1.body)); eq(r1.body.error, 'finished_bitmap'); ok(/regenerat/i.test(r1.body.detail) && /editable/i.test(r1.body.detail), r1.body.detail);
  const r2 = await call('POST', '/studio/version', { asset: A, layout: Object.assign({}, FIN.layout, { layers: [{ id: 'x', type: 'text', role: 'free', text: 'hi', x: 1, y: 1, w: 10, h: 5, size: 3 }] }) }); eq(r2.status, 409); eq(r2.body.error, 'finished_bitmap');
  const r3 = await call('POST', '/studio/version', { asset: A, copy: { caption: 'A new caption', alt: 'A finished tile' }, note: 'caption' }); eq(r3.status, 200, JSON.stringify(r3.body));
  eq([r3.body.version.mode, r3.body.version.copy.caption, r3.body.version.copy.headline], ['finished', 'A new caption', 'Fact: fuel tax credits are not a subsidy']);
  eq(r3.body.version.image.key, FIN.image.key, 'the same bitmap');
  FIN = r3.body.version;
});
await T.t('readiness: technical validation does not apply; the painted words and the mark must be read back by the inspection before design approval; a missing mark blocks', async () => {
  const a = await assetOf(P, A); const rd = a.readiness;
  eq(rd.technical, 'not_applicable'); eq(rd.finished, true); ok(rd.baked && rd.baked.verified === false, JSON.stringify(rd.baked)); ok(/no inspection/.test(rd.baked.why), rd.baked.why);
  const ap0 = await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'looks right to me' }); eq(ap0.status, 409); eq(ap0.body.error, 'baked_text_unverified');
  // the inspection sees the mark file beside the artwork and is asked which marks it can see
  inspectAnswer = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 2, reasons: { identity: 'The wordmark is not there' }, words: { present: ['Fact: fuel tax credits are not a subsidy', 'Businesses do not pay a road fuel tax on fuel used off-road.', 'handsoffourfuel.com.au'], wrong: [], missing: [] }, marks: { present: [], missing: ['wordmark'], wrong: [] }, issues: [{ text: 'The wordmark is missing', severity: 'blocking' }], verdict: 'fix', fix: { kind: 'render', instruction: 'Paint the attached wordmark bottom right at its own proportions.' }, note: '' };
  const i1 = await call('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: { asset: A, composed: false }, idem: 's2-ins1' }); const d1 = await run(i1.body.job); eq(d1.state, 'done', d1.error);
  const ib = anth.calls[anth.calls.length - 1]; eq(imagesOf(ib), 2, 'the artwork and the wordmark file go to the inspector'); ok(/FINISHED CREATIVE/.test(textOf(ib)) && /MARKS TO READ BACK/.test(textOf(ib)) && /wordmark/.test(textOf(ib)), textOf(ib).slice(0, 600));
  ok(/"marks":\{"present"/.test(ib.system), 'the inspector is asked for the marks it can see');
  const ev1 = (await get(P)).thread.filter(e => e.kind === 'inspection').pop(); eq(ev1.marks.missing, ['wordmark']); eq(ev1.baked.verified, false);
  let rd1 = (await assetOf(P, A)).readiness; eq(rd1.baked.verified, false); ok(/wordmark/.test(rd1.baked.why), rd1.baked.why);
  eq(rd1.baked.markProblem, { missing: ['wordmark'], wrong: [] }, 'S23: the reading names the identity problem, so the page offers the editable path (the exact file) rather than another roll');
  eq((await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'looks right to me' })).status, 409);
  // a second inspection reads everything back: now the words and the mark are verified and approval stands
  inspectAnswer = Object.assign({}, inspectAnswer, { identity: 5, marks: { present: ['wordmark'], missing: [], wrong: [] }, issues: [], verdict: 'ship', fix: { kind: 'none', instruction: '' } });
  const i2 = await call('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: { asset: A, composed: false }, idem: 's2-ins2' }); const d2 = await run(i2.body.job); eq(d2.state, 'done', d2.error);
  rd1 = (await assetOf(P, A)).readiness; eq(rd1.baked.verified, true, JSON.stringify(rd1.baked)); eq(rd1.production, true); eq(rd1.baked.markProblem, null, 'S23: no identity problem once the mark is read back');
  const ap = await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'every word and the wordmark read back' }); eq(ap.status, 200, JSON.stringify(ap.body));
});
await T.t('a revision is a new generated version (regenerate), never a layer edit; the mark goes along again; export carries the bitmap itself', async () => {
  const g0 = gem.calls.length;
  const r = await call('POST', '/studio/finished/regenerate', { asset: A, copy: { headline: 'Fact: the credit is not a subsidy' }, instruction: 'Warmer light', size: '2K' }); eq(r.status, 200, JSON.stringify(r.body)); ok(r.body.job);
  const rj = (await call('GET', '/studio/job?id=' + r.body.job)).body.job; eq([rj.input.finished, rj.input.approach], [true, 'artwork']); eq(rj.input.marks.map(m => m.role), ['wordmark']); ok(/Fact: the credit is not a subsidy/.test(rj.input.prompt) && /Warmer light/.test(rj.input.prompt), rj.input.prompt);
  const done = await run(rj); eq(done.state, 'done', done.error); eq(gem.calls.length, g0 + 1);
  const a = await assetOf(P, A); const v = curOf(a); eq(v.mode, 'finished'); eq(v.copy.headline, 'Fact: the credit is not a subsidy'); eq(v.layout.layers, []); ok(v.image.key !== FIN.image.key, 'a new bitmap');
  ok(!a.approvals.design, 'the earlier design approval does not carry to a new bitmap');
  eq(a.readiness.baked.verified, false, 'the new bitmap has not been read back');
  // export: for a finished creative the file is the generated bitmap, not a composed PNG
  await call('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'the words are approved' });
  inspectAnswer = { fidelity: 5, hierarchy: 5, readability: 5, relevance: 5, identity: 5, reasons: {}, words: { present: ['Fact: the credit is not a subsidy', 'handsoffourfuel.com.au', 'Businesses do not pay a road fuel tax on fuel used off-road.'], wrong: [], missing: [] }, marks: { present: ['wordmark'], missing: [], wrong: [] }, issues: [], verdict: 'ship', fix: { kind: 'none', instruction: '' } };
  const i3 = await call('POST', '/studio/job', { project: P, asset: A, stage: 'inspect', input: { asset: A, composed: false }, idem: 's2-ins3' }); eq((await run(i3.body.job)).state, 'done');
  eq((await call('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'read back in full' })).status, 200);
  const ex = await call('POST', '/studio/job', { project: P, stage: 'export', input: { assets: [A] }, idem: 's2-exp' }); const ed = await run(ex.body.job); eq(ed.state, 'done', ed.error);
  eq(ed.result.included.length, 1, JSON.stringify(ed.result.excluded)); eq(ed.result.included[0].exportKey, v.image.key, 'the export file is the generated bitmap itself'); eq(ed.result.included[0].finished, true);
});
await T.t('switching to Editable creates a derived asset that says what was reconstructed; the finished original is untouched', async () => {
  const n = (await get(P)).assets.length;
  const r = await call('POST', '/studio/derive', { asset: A, to: 'editable' }); eq(r.status, 200, JSON.stringify(r.body)); ok(r.body.asset && r.body.asset !== A);
  const g = await get(P); eq(g.assets.length, n + 1); const d = g.assets.find(x => x.id === r.body.asset); const dv = curOf(d);
  eq(d.family, 'Editable from finished'); eq(dv.mode, 'composition'); ok(dv.layout.layers.some(l => l.type === 'text' && l.role === 'headline'), 'the words are live layers again'); ok(dv.layout.layers.some(l => l.role === 'wordmark'), 'the exact wordmark is a live layer'); ok(!dv.layout.layers.some(l => l.role === 'logo'), 'still no MCA logo');
  eq(dv.image, null, 'the painted bitmap, words included, is not reused as the ground'); eq(dv.context.derivedFrom.asset, A); ok(/reconstruct/i.test(dv.context.derivedFrom.note) && /lettering/i.test(dv.context.derivedFrom.note), dv.context.derivedFrom.note);
  eq(curOf(g.assets.find(x => x.id === A)).mode, 'finished', 'the original stays finished');
  ok(/Editable from finished|derived/i.test(g.thread.filter(e => e.kind === 'derived').pop().text));
  eq((await call('POST', '/studio/derive', { asset: A, to: 'editable' }, 'read-key')).status, 403, 'read keys cannot derive');
});
await T.t('the hybrid artwork mode is unchanged and labelled as the hybrid it is; capabilities state what finished mode cannot promise', async () => {
  const p2 = await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Hybrid', brief: { objective: 'o', message: 'm' }, idem: 's2-hyb' });
  const a2 = await call('POST', '/studio/asset', { project: p2.body.id, family: 'Set', channel: 'instagram', format: '4:5', title: 'Hybrid tile', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.' }, mode: 'composition' });
  const v2 = a2.body.asset.versions[0]; ok(v2.layout.layers.some(l => l.role === 'wordmark'), 'the hybrid path still places the wordmark');
  const art = await call('POST', '/studio/job', { project: p2.body.id, asset: a2.body.asset.id, stage: 'render', input: { prompt: 'Paint it', approach: 'artwork', baked: ['headline', 'support'], aspect: '4:5', size: '1K' }, idem: 's2-art' }); const ad = await run(art.body.job); eq(ad.state, 'done', ad.error);
  const parts = gem.calls[gem.calls.length - 1].body.contents[0].parts; eq(parts.filter(x => x.inline_data).length, 0, 'the hybrid sends no mark file: the Studio places it afterwards');
  const av = curOf((await get(p2.body.id)).assets[0]); eq(av.mode, 'artwork'); eq(av.layout.layers.map(l => l.role), ['wordmark']); eq(av.layout.finished, undefined);
  const rd = (await get(p2.body.id)).assets[0].readiness; eq(rd.finished, false); eq(rd.hybrid, true);
  const cap = (await call('GET', '/studio/capabilities')).body; const fin = cap.operations.find(o => o.op === 'finished'); ok(fin, 'finished mode is a stated operation');
  ok(fin.cannot.some(c => /spell|lettering/i.test(c)) && fin.cannot.some(c => /mark|logo|wordmark/i.test(c)), JSON.stringify(fin.cannot)); ok(/editable/i.test(fin.fallback || ''), 'the editable mode is the stated fallback');
  const modes = cap.modes; ok(modes && modes.editable && modes.finished && modes.artwork, 'the three modes are described'); ok(/hybrid/i.test(modes.artwork.label || modes.artwork.what), JSON.stringify(modes.artwork));
});
await T.t('finished mode with no mark on file fails before any render is spent, naming the file', async () => {
  const p3 = await call('POST', '/studio/project', { ns: 'aep', title: 'No mark', brief: { objective: 'o', message: 'm', channels: ['linkedin'], deliverable: 'visual', creationMode: 'finished' }, idem: 's2-nomark' });
  await call('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', palette: { primary: '#2F7FD6' }, campaigns: [{ id: 'gas', name: 'Gas', logoPolicy: 'logo' }] });
  await call('POST', '/studio/project/update', { id: p3.body.id, patch: { campaign: 'gas' } });
  const g0 = gem.calls.length;
  const j0 = await call('POST', '/studio/job', { project: p3.body.id, stage: 'copy', input: { channels: ['linkedin'], deliverable: 'visual', instruction: 'One tile', acknowledge: true }, idem: 's2-copy3' }); const j = await run(j0.body.job);
  eq(j.state, 'failed', JSON.stringify(j)); ok(/mark_missing|not on file/i.test(j.error) && /not retried/.test(j.error), j.error); eq(gem.calls.length, g0, 'no render was queued or spent');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
