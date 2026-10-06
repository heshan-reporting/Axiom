/* The editor's routes on the worker (S17): resize to platform formats from the composition as it stands (no model call, no
 * render), images placed on the canvas (stored in the project's uploads, checked by their bytes), the autosaved draft (one per
 * person per asset, never a version), the editor's styling surviving re-composition (and nothing unsafe getting through),
 * the Art Director told which layers were selected, and two more imagery edits by description (remove, relight).
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-s17-editor-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-s17-editor-worker (resize, uploads, drafts, styling through re-composition, selection, remove and relight)');
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const anth = []; const gem = [];
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' }, 'other-key': { n: 'Steve', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } }, env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.push({ sys, user });
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
w.answer(/generativelanguage/, async (u, init) => { gem.push(JSON.parse(init.body)); return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 }); });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const step = async id => { let j; for (let i = 0; i < 6; i++) { j = (await call('POST', '/studio/job/step', { id })).body.job; if (['done', 'failed', 'cancelled'].indexOf(j.state) >= 0) return j; } return j; };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const cur = a => a.versions.find(x => x.id === a.current);

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Editor', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
w.r2.set('studio/' + P + '/a1/v1.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
let upKey = '';

await T.t('an image placed on the canvas is stored in the project\'s uploads, checked by its bytes, served back, and refused when it is not what it claims', async () => {
  const r = await call('POST', '/studio/image/upload', { project: P, imageB64: PNG, mime: 'image/png', name: 'farmer.png' }); eq(r.status, 200, r.text);
  upKey = r.body.key; ok(new RegExp('^studio/' + P + '/uploads/[a-z0-9]+\\.png$').test(upKey), upKey); ok(w.r2.has(upKey), 'stored in R2');
  const f = await call('GET', '/studio/file?key=' + encodeURIComponent(upKey)); eq(f.status, 200, 'served back through the file route');
  const lie = await call('POST', '/studio/image/upload', { project: P, imageB64: Buffer.from('<svg onload="x()"></svg>').toString('base64'), mime: 'image/png' }); eq([lie.status, lie.body.error], [400, 'bad_file']);
  const svg = await call('POST', '/studio/image/upload', { project: P, imageB64: PNG, mime: 'image/svg+xml' }); eq([svg.status, svg.body.error], [400, 'bad_type']);
  const big = await call('POST', '/studio/image/upload', { project: P, imageB64: Buffer.concat([Buffer.from(PNG, 'base64'), Buffer.alloc(8.5 * 1024 * 1024)]).toString('base64'), mime: 'image/png' }); eq(big.status, 413);
  const ro = await call('POST', '/studio/image/upload', { project: P, imageB64: PNG, mime: 'image/png' }, 'read-key'); eq(ro.status, 403);
});

const LAYOUT = () => ({ v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, fit: 'cover', prompt: 'keep the current image' }], palette: { primary: '#0E6A6E' },
  layers: [
    { id: 'panel', type: 'shape', role: 'panel', shape: 'rect', x: 6, y: 52, w: 88, h: 40, fill: '#0E6A6E', fill2: '#0b3d40', dir: 'down', shadow: { x: 0, y: 1, blur: 3, color: 'rgba(0,0,0,0.4)' }, radius: 2 },
    { id: 'headline', type: 'text', role: 'headline', x: 10, y: 56, w: 80, h: 16, size: 6, weight: 800, color: '#FFFFFF', family: 'Playfair Display', italic: true, case: 'upper', stroke: { width: 0.3, color: '#000000' }, rotate: 35 },
    { id: 'support', type: 'text', role: 'support', x: 10, y: 74, w: 80, h: 8, size: 2.8, weight: 500, color: '#FFFFFF', font: 'body', paraSpacing: 0.6, glow: { blur: 2, color: '#ffffff' }, blend: 'screen' },
    { id: 'icon', type: 'shape', role: 'device', shape: 'icon', icon: 'check-circle', x: 80, y: 8, w: 12, h: 12, fill: '#FFFFFF' },
    { id: 'photo', type: 'img', role: 'image', key: '', x: 60, y: 10, w: 30, h: 30, fit: 'cover', adjust: { brightness: 20, warmth: 40 }, mask: 'circle', flipX: true },
    { id: 'bad', type: 'text', role: 'free', text: 'Free words', x: 10, y: 86, w: 60, h: 4, size: 2, color: '#FFFFFF', family: 'x"; font: 9px evil', blend: 'evil-mode', shadow: { x: 999, blur: 'a', color: 'url(javascript:1)' } },
  ] });
let A = '', A2 = '';

await T.t('resize makes one asset per format from the composition as it stands: the words, the editor\'s styling, the placed image and the photograph kept; nothing generated', async () => {
  const L = LAYOUT(); L.layers.find(l => l.id === 'photo').key = upKey; L.layers.find(l => l.id === 'photo').src = '/studio/file?key=' + encodeURIComponent(upKey);
  A = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Not a subsidy', support: 'A tax refund for fuel used off-road.' }, layout: L, mode: 'composition', image: { key: 'studio/' + P + '/a1/v1.png', url: '/studio/file?key=' + encodeURIComponent('studio/' + P + '/a1/v1.png') } })).body.asset.id;
  const n0 = w.outbound.length; const a0 = anth.length, g0 = gem.length;
  const r = await call('POST', '/studio/resize', { asset: A, presets: ['story', 'linkedin', 'display'] }); eq(r.status, 200, r.text);
  eq(r.body.made.map(m => [m.format, m.channel]), [['9:16', 'instagram'], ['1.91:1', 'linkedin'], ['6:5', 'instagram']]);
  eq([anth.length, gem.length], [a0, g0], 'no model call and no render'); ok(w.outbound.slice(n0).every(o => !/anthropic|generativelanguage/.test(o.url)), 'nothing outbound to a provider');
  const g = await get(P); const story = g.assets.find(a => a.id === r.body.made[0].asset); const v = cur(story); A2 = story.id;
  eq(story.family, 'Set'); eq(v.image.key, 'studio/' + P + '/a1/v1.png', 'the photograph reused'); eq(v.copy.headline, 'Not a subsidy'); eq(v.layout.stage, { w: 1080, h: 1920 });
  const h = v.layout.layers.find(l => l.id === 'headline'); eq([h.family, h.italic, h.case, h.stroke, h.rotate], ['Playfair Display', true, 'upper', { width: 0.3, color: '#000000' }, 35], 'the type styling and a person\'s own turn survive');
  const s = v.layout.layers.find(l => l.id === 'support'); eq([s.paraSpacing, s.glow, s.blend], [0.6, { blur: 2, color: '#ffffff' }, 'screen']);
  const pnl = v.layout.layers.find(l => l.id === 'panel'); eq([pnl.fill2, pnl.dir, pnl.shadow.blur], ['#0b3d40', 'down', 3]);
  const ic = v.layout.layers.find(l => l.id === 'icon'); eq([ic.shape, ic.icon], ['icon', 'check-circle']);
  const ph = v.layout.layers.find(l => l.id === 'photo'); eq([ph.type, ph.key, ph.src, ph.mask, ph.flipX, ph.adjust], ['img', upKey, '/studio/file?key=' + encodeURIComponent(upKey), 'circle', true, { brightness: 20, warmth: 40 }]);
  const bad = v.layout.layers.find(l => l.id === 'bad'); ok(bad && !bad.family && !bad.blend, 'an unsafe family and an unknown blend are dropped, never passed on: ' + JSON.stringify(bad));
  eq(bad.shadow, { x: 10 }, 'a malformed shadow is bounded (999 to 10), its unreadable blur and its unsafe colour dropped');
  ok(v.note.indexOf('resized from Tile') === 0 && /no render/.test(v.note), v.note); eq(v.context.resizedFrom.split(':')[0], A);
  ok(g.thread.some(e => e.kind === 'resized' && /Story or reel, LinkedIn link, Display/.test(e.text)), 'the thread records it');
});

await T.t('resize refuses what cannot be re-laid, and names its formats; a placed image from another project is not carried', async () => {
  const none = await call('POST', '/studio/resize', { asset: A, presets: ['nope'] }); eq([none.status, none.body.error], [400, 'no_formats']); ok(/meta-square/.test(none.body.detail), none.body.detail);
  const same = await call('POST', '/studio/resize', { asset: A, formats: ['1:1'] }); eq(same.status, 200); eq(same.body.made, []); eq(same.body.skipped[0].why, 'the same format as the original');
  const C = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Words only', copy: { headline: 'x' }, mode: 'copy' })).body.asset.id;
  eq((await call('POST', '/studio/resize', { asset: C, presets: ['story'] })).body.error, 'copy_only');
  const L = LAYOUT(); L.layers.find(l => l.id === 'photo').key = 'studio/pother123/uploads/abcdef12.png';
  const X = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Foreign image', copy: { headline: 'x' }, layout: L, mode: 'composition' })).body.asset.id;
  const r = await call('POST', '/studio/resize', { asset: X, presets: ['meta-portrait'] }); eq(r.status, 200);
  const v = cur((await get(P)).assets.find(a => a.id === r.body.made[0].asset)); ok(!v.layout.layers.some(l => l.id === 'photo'), 'another project\'s image is not placed'); ok((v.layout.unsupported || []).some(u => /not one of this project's uploads/.test(u)), JSON.stringify(v.layout.unsupported));
  const fin = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Painted', copy: { headline: 'x' }, layout: { finished: true, layers: [] }, mode: 'finished' })).body.asset.id;
  eq((await call('POST', '/studio/resize', { asset: fin, presets: ['story'] })).body.error, 'not_reflowable');
  eq((await call('POST', '/studio/resize', { asset: A, presets: ['story'] }, 'read-key')).status, 403);
});

await T.t('the autosaved draft is one per person per asset, names the version it was made on, is never a version, and goes when discarded', async () => {
  const g = await get(P); const a = g.assets.find(x => x.id === A); const v = cur(a); const nv = a.versions.length;
  const L = JSON.parse(JSON.stringify(v.layout)); L.layers.find(l => l.id === 'headline').x = 14;
  const s1 = await call('POST', '/studio/draft', { asset: A, version: v.id, layout: L, copy: { headline: 'Not a subsidy, never was' } }); eq(s1.status, 200, s1.text);
  const d = (await call('GET', '/studio/draft?asset=' + A)).body.draft; eq([d.version, d.current, d.layout.layers.find(l => l.id === 'headline').x, d.copy.headline], [v.id, true, 14, 'Not a subsidy, never was']);
  eq((await get(P)).assets.find(x => x.id === A).versions.length, nv, 'a draft is not a version');
  eq((await call('GET', '/studio/draft?asset=' + A, null, 'other-key')).body.draft, null, 'another person does not see it');
  eq((await call('GET', '/studio/draft?asset=' + A, null, 'read-key')).body.draft, null, 'a read key reads only its own (none)');
  eq((await call('POST', '/studio/draft', { asset: A, version: v.id, layout: L }, 'read-key')).status, 403);
  eq((await call('POST', '/studio/draft', { asset: A, version: 'vnotmine', layout: L })).body.error, 'bad_version');
  await call('POST', '/studio/version', { asset: A, copy: { headline: 'A new saved version' }, note: 'saved elsewhere' });
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft.current, false, 'a newer saved version makes the draft one of an earlier version');
  eq((await call('POST', '/studio/draft/discard', { asset: A })).status, 200); eq((await call('GET', '/studio/draft?asset=' + A)).body.draft, null);
});

await T.t('the Art Director is told which layers were selected in the editor, and to leave the rest', async () => {
  const n = anth.length;
  const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'revise', input: { target: 'asset', asset: A, instruction: 'make this bolder', layers: ['headline', 'icon', 'ghost'] }, idem: 'sel1' })).body.job;
  await step(j.id); const c = anth.slice(n).find(x => /INSTRUCTION FROM THE TEAM LEAD/.test(x.user));
  ok(c && /SELECTED IN THE EDITOR: headline \(headline, the headline words\), icon \(device\)\. The instruction is about these layers/.test(c.user), c ? c.user.slice(0, 400) : 'no revise call');
  ok(!/ghost/.test(c.user.split('SELECTED IN THE EDITOR')[1].split('\n')[0]), 'a layer id the composition does not have is not named');
});

await T.t('remove and relight are imagery edits by description: the area said in words for a removal, the light alone for a relight, each recorded', async () => {
  const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'remove', area: { x: 70, y: 60, w: 20, h: 20 }, instruction: 'the parked ute', aspect: '1:1', size: '1K' }, idem: 'rm1' })).body.job;
  eq((await step(j.id)).state, 'done'); const pr = gem[gem.length - 1].contents.slice(-1)[0].parts.filter(x => x.text).map(x => x.text).join(' ');
  ok(/EDIT ONLY ONE AREA OF THE CURRENT IMAGE: the lower right/.test(pr) && /Remove the parked ute and fill the space with what would naturally be behind it/.test(pr), pr.slice(0, 300));
  const v = cur((await get(P)).assets.find(x => x.id === A)); eq([v.image.meta.edit.kind, v.image.meta.edit.area], ['remove', { x: 70, y: 60, w: 20, h: 20 }]);
  const j2 = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'relight', instruction: 'late afternoon sun from the left', aspect: '1:1', size: '1K' }, idem: 'rl1' })).body.job;
  eq((await step(j2.id)).state, 'done'); const pr2 = gem[gem.length - 1].contents.slice(-1)[0].parts.filter(x => x.text).map(x => x.text).join(' ');
  ok(/Change only the lighting: late afternoon sun from the left/.test(pr2), pr2.slice(0, 200));
});

await T.t('a removal is said by its marked area alone; without an area it is refused before any image call, and an area edit still needs words', async () => {
  const g0 = gem.length;
  const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'remove', area: { x: 5, y: 5, w: 20, h: 20 }, aspect: '1:1', size: '1K' }, idem: 'rm2' })).body.job;
  eq((await step(j.id)).state, 'done'); const pr = gem[gem.length - 1].contents.slice(-1)[0].parts.filter(x => x.text).map(x => x.text).join(' ');
  ok(/Remove the object in that area and fill the space/.test(pr), pr.slice(0, 300));
  const n = gem.length;
  const j2 = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'remove', aspect: '1:1', size: '1K' }, idem: 'rm3' })).body.job;
  const r2 = await step(j2.id); eq(r2.state, 'failed'); ok(/^area_required/.test(r2.error || ''), r2.error);
  const j3 = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { edit: true, editKind: 'area', area: { x: 5, y: 5, w: 20, h: 20 }, aspect: '1:1', size: '1K' }, idem: 'ar3' })).body.job;
  const r3 = await step(j3.id); eq(r3.state, 'failed'); ok(/^instruction_required/.test(r3.error || ''), r3.error);
  eq(gem.length, n, 'neither refused edit reached the image model'); ok(n === g0 + 1, 'one image call in all');
});

await T.t('an image for a format the image model has no ratio for asks for the nearest one it has', async () => {
  const g = await get(P); const link = g.assets.find(a => a.format === '1.91:1');
  const j = (await call('POST', '/studio/job', { project: P, asset: link.id, stage: 'render', input: { prompt: 'a regional road at dusk', aspect: '1.91:1', size: '1K' }, idem: 'asp1' })).body.job;
  await step(j.id); eq(gem[gem.length - 1].generationConfig.imageConfig.aspectRatio, '16:9');
});

const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
