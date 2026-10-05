/* Creative Studio S11, the workspace in real Chromium against the worker module (providers MOCKED, nothing spent): the
 * reconstructed HOOF tile (the white wordmark straddling the cream panel and the dark green footer) opens BLOCKED with the
 * top issue named first and the model label off the artwork; selecting the wordmark in the left panel opens Properties with
 * the per-pixel readability figures, the approved variants and the placement rule's provenance, and outlines it on the tile;
 * Fix layout moves the mark into the footer and says Fixed only because the complete validation of the result passes; the
 * worker then holds a passing measurement and export takes exactly that version; Preview strips every piece of chrome;
 * a 9:16 story aligns to its own top and bottom insets, not the side margin; the Brand tab names the policy; the left panel
 * collapses and reopens; a reload comes back to the same asset and state. Screenshots at a laptop (1366 x 768) and a desktop
 * (1920 x 1080) size go to tests/shots/s11-after-*.png (ignored by git).
 * Run: node --experimental-sqlite tests/studio-s11-browser.mjs */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, pngGradient, pngSolid } from './studio-fixture.mjs';
import { HOOF_STRADDLE, HOOF_STRADDLE_COPY } from './fixtures/studio-layouts.mjs';
const fx = await makeStudio({ port: 8819, inspect: false });
const { api, r2 } = fx;
const R = '#studio-root ';
const T = runner('studio-s11-browser (the artwork-first workspace on the reconstructed straddling-wordmark tile; providers MOCKED)');
const OUT = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const shot = (pg, name) => pg.screenshot({ path: OUT + 's11-after-' + name + '.png' });
const step = async id => { let j; for (let i = 0; i < 8; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || j.state === 'done' || j.state === 'failed') return j; } return j; };
const wait = ms => new Promise(r => setTimeout(r, ms));

// the kit: HOOF carries three approved wordmark files (synthetic solid blocks: every pixel is ink, so the geometry decides)
const solid = rgb => pngSolid(480, 120, rgb).toString('base64');
await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', identity: 'MYTH in red, FACT in teal', cta: 'handsoffourfuel.com.au' }], wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: solid([255, 255, 255]), wordmarkMime: 'image/png', wordmarkDefault: true });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'blue', wordmarkTone: 'colour', wordmarkB64: solid([31, 95, 168]), wordmarkMime: 'image/png' });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'black', wordmarkTone: 'dark', wordmarkB64: solid([17, 17, 17]), wordmarkMime: 'image/png' });
const kit = (await api('GET', '/brand/kit?ns=mca')).kit; const camp = kit.campaigns.find(c => c.id === 'hoof');
const wmSrc = variant => { const w = camp.wordmarks.find(x => x.variant === variant); return '/brand/wordmark?ns=mca&campaign=hoof&variant=' + variant + '&v=' + (w ? w.v : ''); };
// the reconstruction, its wordmark pointed at the files this kit really holds, over a cream "photograph" (the panel and footer are live shapes)
const L = JSON.parse(JSON.stringify(HOOF_STRADDLE)); const wm = L.layers.find(l => l.id === 'wordmark'); wm.src = wmSrc('white'); wm.variants = [{ variant: 'white', src: wmSrc('white'), tone: 'light' }, { variant: 'blue', src: wmSrc('blue'), tone: 'colour' }, { variant: 'black', src: wmSrc('black'), tone: 'dark' }];
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S11 straddle', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'], deliverable: 'set', campaignConfirmed: true } })).id;
// the photograph lives where /studio/file serves project files from: studio/<project>/<asset>/<name>.png
const PHOTO_KEY = 'studio/' + P + '/fixture/s11-photo.png'; r2.set(PHOTO_KEY, { v: pngGradient(1080, 1350, [242, 235, 221], [214, 198, 170]), o: { httpMetadata: { contentType: 'image/png' } } });
const A = (await api('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '4:5', title: 'Fact tile', copy: HOOF_STRADDLE_COPY, layout: L, mode: 'composition', image: { key: PHOTO_KEY, url: '/studio/file?key=' + PHOTO_KEY } })).asset.id;
// a 9:16 story with no imagery (a typographic composition), for the alignment case
const STORY = { v: 5, format: '9:16', stage: { w: 1080, h: 1920 }, medium: 'typographic', approach: 'editable', regions: [], noImagery: true, bg: '#1E5B3A', palette: { primary: '#1E5B3A' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, marks: { policy: 'wordmark', campaign: 'hoof' }, incomplete: [], unsupported: [],
  layers: [{ id: 'headline', type: 'text', role: 'headline', x: 10, y: 40, w: 80, h: 14, size: 7, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' }, { id: 'support', type: 'text', role: 'support', x: 10, y: 58, w: 80, h: 8, size: 3.2, weight: 500, color: '#FFFFFF', align: 'left', font: 'body' }] };
const S = (await api('POST', '/studio/asset', { project: P, family: 'HOOF', channel: 'instagram', format: '9:16', title: 'Story', copy: { headline: 'Not a subsidy', support: 'Fuel used off-road never owed a road tax.' }, layout: STORY, mode: 'composition' })).asset.id;
const cur = async id => { const g = await api('GET', '/studio/get?id=' + P); const a = g.assets.find(x => x.id === id); return { g, a, v: a.versions.find(x => x.id === a.current) }; };
let page;

await T.t('the reported tile opens Blocked: the top issue (mark unreadable, the wordmark) is named first with its remedy, the model label sits under the stage and not on the artwork, and the worker records a failing measurement', async () => {
  page = await fx.open({ viewport: { width: 1366, height: 768 } });
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("S11 straddle")', { timeout: 20000 });
  await page.click(R + '.st-lib tbody tr:has-text("S11 straddle") button.st-lib-open');
  await page.waitForSelector(R + '.st-railbtn.asset:has-text("Fact tile")', { timeout: 20000 }); await page.click(R + '.st-railbtn.asset:has-text("Fact tile")');
  await page.waitForSelector(R + '.st-stage canvas', { timeout: 20000 });
  await page.waitForFunction(() => { const q = document.querySelector('#studio-root .st-qstate'); return q && q.dataset.state && q.dataset.state !== 'unknown' && !/Measuring/.test(q.textContent); }, null, { timeout: 30000 });
  const state = await page.$eval(R + '.st-qstate', el => el.dataset.state); eq(state, 'blocked');
  const top = await page.textContent(R + '.st-qtop'); ok(/mark unreadable/.test(top) && /wordmark/.test(top) && /do not read/.test(top), 'the top issue: ' + top.replace(/\s+/g, ' ').slice(0, 200));
  ok(await page.$(R + '.st-qtop .st-qact:has-text("Fix layout")'), 'the remedy is offered beside the issue');
  eq(await page.$$eval(R + '.st-readystrip button:has-text("Fix layout")', b => b.length), 1, 'Fix layout is offered once, beside the issue, not again in the action row');
  eq(await page.$(R + '.st-stage .st-comp .st-comp-tag'), null, 'nothing is written over the artwork');
  const info = await page.textContent(R + '.st-comp-info .st-comp-tag'); ok(/editable composition/.test(info), 'the composition facts sit under the stage: ' + info);
  await page.waitForFunction(() => /Technical validation\s*failed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  const { a } = await cur(A); eq(a.readiness.technical, 'failed'); ok(a.readiness.reasons[0].includes('mark_unreadable (wordmark)'), a.readiness.reasons[0]);
  ok(await page.$(R + '.st-stage-tools .st-sel[aria-label="Zoom"]'), 'the canvas toolbar'); ok(await page.$(R + '.st-layers .st-layer-pick:has-text("wordmark")'), 'the layers list in the left panel');
  await shot(page, 'blocked-1366');
});

await T.t('selecting the wordmark in Layers opens Properties: the per-pixel figures (half the strokes lost across the boundary), the three approved variants, the placement provenance (house default: no rule stands), and the mark outlined on the tile', async () => {
  await page.click(R + '.st-layers .st-layer-pick:has-text("wordmark")');
  await page.waitForSelector(R + '.st-props-one[data-layer="wordmark"]', { timeout: 10000 });
  eq((await page.textContent(R + '.st-instab.on')).trim(), 'Properties');
  const fig = await page.textContent(R + '.st-readfig'); const m = fig.match(/(\d+)% of the strokes do not read/); ok(m && +m[1] >= 40 && +m[1] <= 60, 'the lost share, per pixel: ' + fig.slice(0, 160));
  ok(/light\/dark boundary/.test(fig) && /not an average/.test(fig), fig.slice(0, 240));
  eq(await page.$$eval(R + '#st-prop-variant option', o => o.length), 3, 'the approved variants');
  const rule = await page.textContent(R + '.st-prop-rule'); ok(/House default/.test(rule) && /No campaign rule/.test(rule), rule);
  eq(await page.$eval(R + '.st-prop-rule', el => el.dataset.basis), 'default');
  ok(await page.$(R + '.st-stage .st-hl[data-layer="wordmark"]'), 'the wordmark is outlined on the tile');
  ok(await page.$(R + '.st-props-one .st-le-type[aria-label="Position and size"] input[aria-label="Width, per cent of the stage"]'), 'position and size'); ok(/aspect locked/.test(await page.textContent(R + '.st-props-one')), 'the aspect is locked');
  await shot(page, 'properties-1366');
});

await T.t('Fix layout moves the wordmark down into the footer (same file, same width) and says Fixed because the complete validation of the result passes; the worker then holds a passing measurement, the state is Needs review (type warnings remain, nothing blocks), and a reload comes back to the same asset and state', async () => {
  const before = (await cur(A)).v;
  await page.click(R + '.st-readystrip .btn:has-text("Fix layout")');
  await page.waitForSelector(R + '.st-repair-note[data-outcome]', { timeout: 30000 });
  const outcome = await page.$eval(R + '.st-repair-note', el => el.dataset.outcome); const note = await page.textContent(R + '.st-repair-note');
  eq(outcome, 'complete', note.replace(/\s+/g, ' ').slice(0, 300)); ok(/^Fixed/.test(note.trim()) && !/Still blocking/.test(note) && /moved the wordmark/.test(note), note.replace(/\s+/g, ' ').slice(0, 300));
  const { v } = await cur(A); ok(v.id !== before.id && v.kind === 'layout', 'a layout version'); const w2 = v.layout.layers.find(l => l.id === 'wordmark'); const w1 = before.layout.layers.find(l => l.id === 'wordmark');
  // the smallest move that reads: the mark's INK (the 480 x 120 block drawn by contain(), 6.4% tall inside the 9% box, so 1.3% of padding above it) ends up on the footer
  // within the 4% lost tolerance the rules allow - judged on the ink, not the layer box
  const inkTop = l => { const s0 = Math.min(l.w / 100 * 1080 / 480, l.h / 100 * 1350 / 120); return l.y + (l.h - 120 * s0 / 1350 * 100) / 2; };
  ok(w2.y > w1.y && inkTop(w2) >= 86 - 0.35 && w2.x === w1.x && w2.w === w1.w && w2.src === w1.src, 'moved down so its ink sits on the footer, nothing else changed: ' + JSON.stringify({ was: w1.y, now: w2.y, inkTop: Math.round(inkTop(w2) * 100) / 100 }));
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  const st = await page.$eval(R + '.st-qstate', el => el.dataset.state); ok(st === 'review' || st === 'passed', 'the state after the fix: ' + st);
  ok(!(await page.$(R + '.st-stage .st-hl')), 'the outline is cleared when the version moves');
  const a2 = (await cur(A)).a; eq(a2.readiness.technical, 'passed');
  await shot(page, 'fixed-1366');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof go === 'function' && window.STRender && typeof studioInit === 'function'); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-railbtn.asset.on:has-text("Fact tile")', { timeout: 30000 });
  await page.waitForFunction(() => { const q = document.querySelector('#studio-root .st-qstate'); return q && q.dataset.state && q.dataset.state !== 'unknown' && !/Measuring/.test(q.textContent); }, null, { timeout: 30000 });
  const st2 = await page.$eval(R + '.st-qstate', el => el.dataset.state); ok(st2 === 'review' || st2 === 'passed', 'the same state after a reload: ' + st2);
});

await T.t('Preview is the artwork alone: no toolbar controls, no outline, no label, no workflow strip; Exit preview brings the chrome back', async () => {
  await page.click(R + '.st-head-acts button:has-text("Preview")');
  await page.waitForSelector(R + '.st-stage.preview', { timeout: 5000 });
  eq(await page.$(R + '.st-comp-info'), null, 'no composition label'); eq(await page.$(R + '.st-stage .st-hl'), null, 'no outlines'); eq(await page.$(R + '.st-stage-tools .st-sel'), null, 'no zoom control');
  ok(!(await page.isVisible(R + '.st-flow')), 'the workflow strip is out of the way');
  ok(await page.$(R + '.st-stage canvas'), 'the artwork is there');
  await shot(page, 'preview-1366');
  await page.click(R + '.st-head-acts button:has-text("Exit preview")');
  await page.waitForSelector(R + '.st-stage-tools .st-sel[aria-label="Zoom"]', { timeout: 5000 }); ok(await page.$(R + '.st-comp-info'), 'the label is back'); ok(await page.isVisible(R + '.st-flow'), 'the workflow is back');
});

await T.t('the Brand tab names the campaign policy (wordmark, never the client logo), the marks on file with their variants, and the placement provenance', async () => {
  await page.click(R + '.st-instab:has-text("Brand")'); await page.waitForSelector(R + '.st-brandtab', { timeout: 5000 });
  const t = await page.textContent(R + '.st-brandtab');
  ok(/Mark policy: ?wordmark/.test(t.replace(/\s+/g, ' ')) && /never the client logo/.test(t), t.slice(0, 200));
  ok(/must not appear here/.test(t), 'the client logo is named as excluded'); ok(/Wordmark white/.test(t.replace(/\s+/g, ' ')) && /Wordmark black/.test(t.replace(/\s+/g, ' ')), 'the variants on file');
  ok(/House default/.test(t), 'the provenance');
});

await T.t('the left panel collapses and reopens; its width is a drag away', async () => {
  await page.click(R + '.st-rail-collapse'); await page.waitForSelector(R + '.st-body.norail', { timeout: 5000 }); eq(await page.$(R + '.st-rail'), null, 'collapsed');
  await page.click(R + '.st-rail-open'); await page.waitForSelector(R + '.st-rail', { timeout: 5000 }); ok(!(await page.$(R + '.st-body.norail')), 'open again');
  ok(await page.$(R + '.st-rail-handle'), 'a resize handle');
});

await T.t('a 9:16 story aligns a single layer to its own insets - top 14%, bottom 80%, sides 6% - on the measured ink, not to a 3% margin', async () => {
  page.on('dialog', d => d.accept());
  await page.click(R + '.st-railbtn.asset:has-text("Story")'); await page.waitForSelector(R + '.st-asset-title:has-text("Story")', { timeout: 20000 });
  await page.waitForSelector(R + '.st-asset-acts button:has-text("Edit layout")', { timeout: 20000 }); await page.click(R + '.st-asset-acts button:has-text("Edit layout")');
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"][data-ink]', { timeout: 20000 }); await wait(400);
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  const geom = async () => page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', el => ({ top: parseFloat(el.style.top), left: parseFloat(el.style.left), h: parseFloat(el.style.height), w: parseFloat(el.style.width) }));
  await page.click(R + '.st-le-tools button:has-text("Align top")'); await wait(300); const g1 = await geom();
  ok(Math.abs(g1.top - 14) < 0.9, 'the ink top sits on the story\'s top inset (14%), not 3%: ' + g1.top.toFixed(1));
  await page.click(R + '.st-le-tools button:has-text("Align bottom")'); await wait(300); const g2 = await geom();
  ok(Math.abs(g2.top + g2.h - 80) < 0.9, 'the ink bottom sits on the bottom inset (80%), not 97%: ' + (g2.top + g2.h).toFixed(1));
  await page.click(R + '.st-le-tools button:has-text("Align left")'); await wait(300); const g3 = await geom();
  ok(Math.abs(g3.left - 6) < 0.9, 'the ink left sits on the side inset (6%): ' + g3.left.toFixed(1));
  ok(await page.$(R + '#st-tab-properties .st-le-type[aria-label="Typography"]'), 'the type panel is in Properties while editing');
  await page.click(R + '.st-le-foot button:has-text("Cancel")'); await page.waitForSelector(R + '.st-le-layer', { state: 'detached', timeout: 5000 });
});

await T.t('export takes exactly the corrected version: design approval stands on the passing measurement and the export manifest names that version with the wordmark in the footer', async () => {
  const { v } = await cur(A);
  eq((await api('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'the words are approved' }))._status, 200);
  const ap = await api('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'the mark reads on the footer now' }); eq(ap._status, 200, JSON.stringify(ap));
  const j = await step((await api('POST', '/studio/job', { project: P, stage: 'export', input: { assets: [A] }, idem: 's11-export' })).job.id); eq(j.state, 'done', j.error);
  const key = Array.from(r2.keys()).filter(k => k.indexOf('studio/' + P + '/export/') === 0 && /\.json$/.test(k)).pop(); ok(key, 'a manifest was written');
  const man = JSON.parse(String(r2.get(key).v)); const row = (man.assets || man.items || []).find(x => x.asset === A || x.id === A) || (man.assets || man.items || [])[0];
  ok(row && row.version === v.id, 'the exported version is the corrected one: ' + JSON.stringify(row && { version: row.version, want: v.id }));
  const wmx = row.layout ? row.layout.layers.find(l => l.id === 'wordmark') : null; ok(!row.layout || (wmx && wmx.y > 81.5 && wmx.y === v.layout.layers.find(l => l.id === 'wordmark').y), 'the manifest layout carries the moved mark: ' + JSON.stringify(wmx && { y: wmx.y }));
  await page.click(R + '.st-head-acts button:has-text("Export")'); await page.waitForSelector(R + '.st-step.on:has-text("Export")', { timeout: 10000 });
  ok(/Fact tile/.test(await page.textContent(R + '.st-centre')), 'the Export stage lists the asset');
  await shot(page, 'export-1366');
});

await T.t('a render filed on the type-only Story (the ground that hides it still on the layout) is named as hidden under the stage and on it, and Show the imagery lifts it as a layout version, no render: the photograph is then drawn under the words', async () => {
  // a render version written as the earlier worker filed it: the image on the version, the noImagery ground left in place
  const { a: s0 } = await cur(S);
  const rv = await api('POST', '/studio/version', { asset: S, revision: s0.revision, image: { key: PHOTO_KEY, url: '/studio/file?key=' + PHOTO_KEY, model: 'gemini-3-pro-image', size: '2K' }, kind: 'render', note: 'imagery as directed' }); eq(rv._status, 200, JSON.stringify(rv));
  const { v: s1 } = await cur(S); eq(s1.layout.noImagery, true, 'the fixture reproduces the state: image on the version, type-only ground still on the layout');
  const p3 = await fx.open({ viewport: { width: 1366, height: 768 }, quiet: true });
  await p3.waitForSelector(R + '.st-lib tbody tr:has-text("S11 straddle")', { timeout: 20000 }); await p3.click(R + '.st-lib tbody tr:has-text("S11 straddle") button.st-lib-open');
  await p3.waitForSelector(R + '.st-railbtn.asset:has-text("Story")', { timeout: 20000 }); await p3.click(R + '.st-railbtn.asset:has-text("Story")');
  await p3.waitForSelector(R + '.st-stage canvas', { timeout: 20000 });
  await p3.waitForSelector(R + '.st-remedy-hidden', { timeout: 30000 });
  const rem = await p3.textContent(R + '.st-remedy-hidden'); ok(/Imagery on file but not shown/.test(rem) && /type-only/.test(rem) && /gemini-3-pro-image/.test(rem), rem.replace(/\s+/g, ' ').slice(0, 240));
  ok(/IMAGERY HIDDEN/.test(await p3.textContent(R + '.st-comp-info .st-comp-tag')), 'the composition facts under the stage say the imagery is hidden');
  ok(await p3.$(R + '.st-stage .st-hidden-imagery'), 'the note on the stage');
  // before: the canvas shows the green ground at the top-left (the photograph is cream)
  const px = async () => p3.$eval(R + '.st-stage canvas', c => { const d = c.getContext('2d').getImageData(Math.round(c.width * 0.05), Math.round(c.height * 0.05), 1, 1).data; return [d[0], d[1], d[2]]; });
  const before = await px(); ok(before[1] > before[0] + 20 && before[0] < 80, 'the ground is green before: ' + before.join(','));
  await p3.click(R + '.st-remedy-hidden button:has-text("Show the imagery")');
  await p3.waitForFunction(() => !document.querySelector('#studio-root .st-remedy-hidden'), null, { timeout: 30000 });
  const { v: s2, a: sa } = await cur(S); ok(s2.id !== s1.id, 'a new version'); eq(s2.kind, 'layout'); eq(s2.layout.noImagery, undefined, 'the flag is lifted'); ok((s2.layout.regions || []).some(r => r.role === 'background'), 'a background region holds the image');
  eq(s2.image.key, PHOTO_KEY, 'the image stays the one that landed'); ok(/show the imagery/.test(s2.note) && /no render/.test(s2.note), s2.note);
  eq(sa.versions.filter(x => x.kind === 'render').length, 1, 'no render was spent');
  await p3.waitForFunction(() => { const c = document.querySelector('#studio-root .st-stage canvas'); if (!c) return false; const d = c.getContext('2d').getImageData(Math.round(c.width * 0.05), Math.round(c.height * 0.05), 1, 1).data; return d[0] > 180 && d[2] > 140; }, null, { timeout: 20000 });
  const after = await px(); ok(after[0] > 180, 'the photograph (cream) is drawn after: ' + after.join(','));
  ok(!/IMAGERY HIDDEN/.test(await p3.textContent(R + '.st-comp-info .st-comp-tag')), 'the facts no longer say hidden');
  ok(!p3.errors.length, 'no page errors: ' + p3.errors.join(' | ')); await p3.ctxB.close();
});

await T.t('a fix that cannot clear what blocks says so once: the outcome, a compact count naming only the kinds left, the renderer\'s verdict, "Nothing was saved", and the next steps as buttons (Move it by hand opens the editor; Layout variations with its pass count) - no second sentence of generic advice', async () => {
  // the Story now shows the cream photograph under white words; locking the headline leaves the fix no colour it may change
  const { a: s0, v: s1 } = await cur(S);
  const L2 = JSON.parse(JSON.stringify(s1.layout)); L2.layers.forEach(l => { if (l.type === 'text') l.locked = true; });
  const lv = await api('POST', '/studio/version', { asset: S, revision: s0.revision, layout: L2, kind: 'layout', note: 'words locked for the blocked-fix case' }); eq(lv._status, 200, JSON.stringify(lv));
  const p4 = await fx.open({ viewport: { width: 1366, height: 768 }, quiet: true });
  await p4.waitForSelector(R + '.st-lib tbody tr:has-text("S11 straddle")', { timeout: 20000 }); await p4.click(R + '.st-lib tbody tr:has-text("S11 straddle") button.st-lib-open');
  await p4.waitForSelector(R + '.st-railbtn.asset:has-text("Story")', { timeout: 20000 }); await p4.click(R + '.st-railbtn.asset:has-text("Story")');
  await p4.waitForSelector(R + '.st-stage canvas', { timeout: 20000 });
  await p4.waitForFunction(() => { const q = document.querySelector('#studio-root .st-qstate'); return q && q.dataset.state === 'blocked' && !/Measuring/.test(q.textContent); }, null, { timeout: 30000 });
  await p4.waitForSelector(R + '.st-readystrip button:has-text("Fix layout")', { timeout: 30000 });
  eq(await p4.$$eval(R + '.st-readystrip button:has-text("Fix layout")', b => b.length), 1, 'one Fix layout button (top issue: ' + (await p4.textContent(R + '.st-qtop')).replace(/\s+/g, ' ').slice(0, 160) + ')');
  const before = (await cur(S)).v.id;
  await p4.click(R + '.st-readystrip button:has-text("Fix layout")');
  await p4.waitForSelector(R + '.st-repair-note[data-outcome]', { timeout: 30000 });
  const outcome = await p4.$eval(R + '.st-repair-note', el => el.dataset.outcome); const note = (await p4.textContent(R + '.st-repair-note')).replace(/\s+/g, ' ').trim();
  eq(outcome, 'blocked', note.slice(0, 300));
  ok(/^Blocked\./.test(note), 'the outcome first: ' + note.slice(0, 80));
  const counts = await p4.textContent(R + '.st-repair-counts'); ok(/blocking before and after \(/.test(counts) && !/geometry 0|brand 0|pending 0/.test(counts), 'the count names only the kinds left: ' + counts);
  ok(/Locked layers stop the fix/.test(note) && /Nothing was saved/.test(note), note.slice(0, 300));
  ok(!/Move the words by hand, choose a layout variation, or shorten the copy/.test(note), 'no generic second sentence of advice');
  eq((note.match(/Still blocking/g) || []).length, 0, 'what blocks is named once, by the verdict, not again as "Still blocking"');
  eq((await cur(S)).v.id, before, 'nothing was saved');
  ok(await p4.$(R + '.st-repair-acts button:has-text("Move it by hand")'), 'the next step is a button');
  // the variations button tells the measured truth: once the arrangements are measured it carries the pass count, and when the
  // renderer can offer none (every word locked) it is not offered at all
  await p4.waitForFunction(() => /\d+ arrangements/.test((document.querySelector('#studio-root .st-vars-head') || {}).textContent || ''), null, { timeout: 30000 });
  const nVars = await p4.$$eval(R + '.st-vars .st-var', x => x.length); const varTxt = await p4.textContent(R + '.st-repair-acts');
  if (nVars) ok(/Layout variations \(\d+ of \d+ pass\)/.test(varTxt), 'with its pass count: ' + varTxt);
  else ok(!/Layout variations/.test(varTxt), 'no variations to offer, so no button: ' + varTxt);
  await p4.click(R + '.st-repair-acts button:has-text("Move it by hand")'); await p4.waitForSelector(R + '.st-le-layer', { timeout: 10000 });
  await p4.click(R + '.st-le-foot button:has-text("Cancel")'); await p4.waitForSelector(R + '.st-le-layer', { state: 'detached', timeout: 5000 });
  const props = await p4.textContent(R + '.st-props-none'); eq((props.match(/gemini-3-pro-image/g) || []).length, 1, 'Properties states the imagery once, in the composition line, not again in the facts: ' + props.replace(/\s+/g, ' ').slice(0, 200));
  ok(!p4.errors.length, 'no page errors: ' + p4.errors.join(' | ')); await shot(p4, 'blocked-fix-1366'); await p4.ctxB.close();
});

await T.t('the same workspace at a desktop size (1920 x 1080): the artwork, Properties and Quality', async () => {
  const p2 = await fx.open({ viewport: { width: 1920, height: 1080 }, quiet: true });
  await p2.waitForSelector(R + '.st-lib tbody tr:has-text("S11 straddle")', { timeout: 20000 }); await p2.click(R + '.st-lib tbody tr:has-text("S11 straddle") button.st-lib-open');
  await p2.waitForSelector(R + '.st-railbtn.asset:has-text("Fact tile")', { timeout: 20000 }); await p2.click(R + '.st-railbtn.asset:has-text("Fact tile")');
  await p2.waitForSelector(R + '.st-stage canvas', { timeout: 20000 }); await p2.waitForFunction(() => { const q = document.querySelector('#studio-root .st-qstate'); return q && q.dataset.state && !/Measuring/.test(q.textContent); }, null, { timeout: 30000 }); await wait(500);
  await shot(p2, 'asset-1920');
  await p2.click(R + '.st-layers .st-layer-pick:has-text("wordmark")'); await p2.waitForSelector(R + '.st-props-one', { timeout: 10000 }); await shot(p2, 'properties-1920');
  await p2.click(R + '.st-instab:has-text("Quality")'); await wait(300); await shot(p2, 'quality-1920');
  ok(!p2.errors.length, 'no page errors: ' + p2.errors.join(' | ')); await p2.ctxB.close();
});

ok(!page.errors.length, 'no page errors on the laptop page: ' + page.errors.join(' | ')); console.log('  page errors (laptop): ' + (page.errors.length || 'none'));
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
