/* S19: the data-safety failures of the S18 build, each written to fail on it first, then the behaviour that replaces them.
 * Real Chromium against the worker module in this process (studio-fixture.mjs; providers MOCKED, nothing spent).
 *   A  saving a version destroyed the recovery draft before the save succeeded, and autosave stopped afterwards
 *   B  a conflict while saving a canvas edit kept the layout and silently dropped the words typed on the canvas
 *   C  switching asset inside the draft debounce (or during an open text edit) lost the edits without a trace
 * Run: node --experimental-sqlite tests/studio-s19-browser.mjs   (SHOT=1 writes tests/shots/s19/t-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: 8871, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s19-browser (data safety: drafts kept until a version is acknowledged, canvas words through conflicts, edits kept across navigation; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/s19/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const PA = (await seedStages(fx, { only: ['design'], prefix: 'S19 A' })).design;
const PB = (await seedStages(fx, { only: ['design'], prefix: 'S19 B' })).design;
const PC = (await seedStages(fx, { only: ['design'], prefix: 'S19 C' })).design;
const PD = (await seedStages(fx, { only: ['design'], prefix: 'S19 D' })).design;
const PE = await seedStages(fx, { only: ['design', 'copy'], prefix: 'S19 E' });
let page;
const shot = async n => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 't-' + n + '.png' }); };
const assets = async P => (await api('GET', '/studio/get?id=' + P)).assets.filter(a => a.versions && a.versions.length);
const cur = a => a.versions.find(v => v.id === a.current) || a.versions[a.versions.length - 1];
const draftOf = async id => (await api('GET', '/studio/draft?asset=' + id)).draft;
const saveWord = () => page.textContent(R + '.st-head .st-save');

async function openDesign(title, viewport) {
  page = await fx.open({ viewport: viewport || { width: 1440, height: 900 }, quiet: true }); page.on('dialog', d => d.accept());
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  const asset = page.locator(R + '.st-assetpick').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(500);
}
/** type words into the headline on the canvas; commit them (Ctrl+Enter) unless asked to leave the edit open */
async function typeHeadline(words, open) {
  await page.dblclick(R + '.st-le-layer[aria-label="Layer headline"]');
  await page.waitForSelector(R + '.st-le-textedit', { timeout: 5000 });
  await page.fill(R + '.st-le-textedit', words);
  if (!open) { await page.keyboard.press('Control+Enter'); await page.waitForSelector(R + '.st-le-textedit', { state: 'detached', timeout: 5000 }); }
}
const headTop = () => page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', el => parseFloat(el.style.top));

await T.t('A. a failed version save keeps the recovery draft and the edits, autosave carries on, and the save line says it failed', async () => {
  await openDesign('S19 A at design');
  const A = (await assets(PA))[0]; const n0 = A.versions.length;
  await typeHeadline('Canvas words that must survive');
  await page.waitForFunction(() => /Draft saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 10000 });
  const d0 = await draftOf(A.id); ok(d0 && d0.copy && d0.copy.headline === 'Canvas words that must survive', 'the recovery draft holds the words: ' + JSON.stringify(d0 && d0.copy));
  const f = fx.failNext(/^\/studio\/version$/, 500, { error: 'internal_error', detail: 'simulated failure' });
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForFunction(() => /Save failed|Not saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 10000 }).catch(() => {});
  await sleep(800); eq(f.hit, 1, 'the save was refused once');
  ok(/Save failed|Not saved/.test(await saveWord()), 'the header says the save failed: ' + await saveWord());
  const d1 = await draftOf(A.id); ok(d1 && d1.copy && d1.copy.headline === 'Canvas words that must survive', 'the recovery draft is still there after the failed save');
  eq((await assets(PA))[0].versions.length, n0, 'no version was written');
  await shot('a-failed');
  // the editor is still the working copy, and autosave continues after the failure
  ok(await page.$(R + '.st-le-layer[aria-label="Layer headline"]'), 'the canvas is still open for editing');
  const t0 = await headTop(); await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.waitForFunction(at => true, null); await sleep(2600);
  const d2 = await draftOf(A.id); ok(d2 && d2.at > d1.at, 'a newer draft was saved after the failure (' + (d2 && d2.at) + ' > ' + d1.at + ')');
  const hl = d2.layout.layers.find(l => l.role === 'headline'); ok(Math.abs(hl.y - t0) > 0.5 && d2.copy.headline === 'Canvas words that must survive', 'the newer draft holds both the move and the words');
  // and the save, when it goes through, writes one version with the words and clears the draft for that version only
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForFunction(() => /Version saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 15000 });
  const A2 = (await assets(PA))[0]; eq(A2.versions.length, n0 + 1, 'one version'); eq(cur(A2).copy.headline, 'Canvas words that must survive', 'the words are in the saved version');
  await sleep(600); const d3 = await draftOf(A.id); ok(!d3 || d3.version === A2.current, 'the draft for the saved edit is gone: ' + JSON.stringify(d3 && { v: d3.version }));
});

await T.t('A2. a save that committed on the server but timed out in the browser writes one version on retry, not two', async () => {
  const A = (await assets(PA))[0]; const n0 = A.versions.length;
  await typeHeadline('Words saved once, even after a timeout');
  const f = fx.failNext(/^\/studio\/version$/, 504, { error: 'timeout', detail: 'simulated gateway timeout after the write' }, { after: true });
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForFunction(() => /Save failed|Not saved|Version saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 10000 }).catch(() => {});
  await sleep(800); eq(f.hit, 1, 'the save reached the server and the answer was lost');
  const btn = await page.$(R + '.st-le-foot .btn:has-text("Save layout")'); if (btn) { await btn.click(); await sleep(2000); }
  else { const r = await page.$(R + '.st-head .st-save button:has-text("retry")'); if (r) { await r.click(); await sleep(2000); } }
  const A2 = (await assets(PA))[0]; eq(A2.versions.length, n0 + 1, 'exactly one version for the edit');
  eq(cur(A2).copy.headline, 'Words saved once, even after a timeout');
  await page.waitForFunction(() => /Version saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 15000 });
});

await T.t('B. a canvas word edit saved while someone else changed the caption keeps both: the new headline and their caption', async () => {
  await page.ctxB.close(); await openDesign('S19 B at design');
  const A = (await assets(PB))[0]; const vb = cur(A);
  await typeHeadline('Headline typed on the canvas');
  // someone else writes the caption on the same asset
  const r = await api('POST', '/studio/version', { asset: A.id, revision: A.revision, copy: Object.assign({}, vb.copy, { caption: 'Caption written by a colleague' }), kind: 'text', note: 'colleague edit' }); eq(r._status, 200, JSON.stringify(r).slice(0, 200));
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await sleep(2500);
  const A2 = (await assets(PB))[0]; const c = cur(A2);
  eq(c.copy.caption, 'Caption written by a colleague', 'their caption is kept');
  eq(c.copy.headline, 'Headline typed on the canvas', 'my headline is kept');
});

await T.t('B2. the same field changed by both: nothing is overwritten silently - the choice is offered, and keeping mine writes mine', async () => {
  await page.ctxB.close(); await openDesign('S19 B at design');
  const A = (await assets(PB))[0]; const vb = cur(A);
  await typeHeadline('My headline for the same field');
  const r = await api('POST', '/studio/version', { asset: A.id, revision: A.revision, copy: Object.assign({}, vb.copy, { headline: 'Their headline for the same field' }), kind: 'text', note: 'colleague edit' }); eq(r._status, 200);
  const n1 = (await assets(PB))[0].versions.length;
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForSelector(R + '.st-conflict', { timeout: 10000 });
  const txt = (await page.textContent(R + '.st-conflict')).replace(/\s+/g, ' ');
  ok(/headline/.test(txt) && /My headline for the same field/.test(txt) && /Their headline for the same field/.test(txt), 'both versions of the field are shown: ' + txt.slice(0, 300));
  eq((await assets(PB))[0].versions.length, n1, 'nothing written before the choice');
  await shot('b2-conflict');
  await page.click(R + '.st-conflict button:has-text("Keep mine")');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-conflict'), null, { timeout: 10000 });
  await sleep(1500);
  const c = cur((await assets(PB))[0]); eq(c.copy.headline, 'My headline for the same field', 'mine was written after the choice');
});

await T.t('C. switching asset within a moment of a canvas move keeps the move: a recovery draft is written and the edit is back on return', async () => {
  await page.ctxB.close(); await openDesign('S19 C at design');
  const [A, B] = await assets(PC); const t0 = await headTop();
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  const moved = await headTop(); ok(Math.abs(moved - t0) > 1, 'moved on the canvas');
  await page.click(R + '.st-pagechip:has-text("' + B.title + '")');   // immediately, inside the old 1.2 s debounce
  await page.waitForFunction(t => (document.querySelector('#studio-root .st-asset-title') || {}).textContent === t, B.title, { timeout: 10000 });
  await sleep(1200);
  const d = await draftOf(A.id); ok(d && d.layout, 'a recovery draft exists for the asset left behind');
  ok(d && Math.abs(d.layout.layers.find(l => l.role === 'headline').y - moved) < 0.2, 'it holds the move');
  await page.click(R + '.st-pagechip:has-text("' + A.title + '")');
  await page.waitForFunction(t => (document.querySelector('#studio-root .st-asset-title') || {}).textContent === t, A.title, { timeout: 10000 });
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(700);
  const back = await headTop(); ok(Math.abs(back - moved) < 0.2, 'the move is on the canvas on return (' + back + ' vs ' + moved + ')');
  ok(/Draft saved/.test(await saveWord()), 'and it is named as work held in the recovery draft: ' + await saveWord());
});

await T.t('C2. switching asset in the middle of typing on the canvas keeps the words being typed', async () => {
  await page.ctxB.close(); await openDesign('S19 D at design');
  const [A, B] = await assets(PD);
  await typeHeadline('Words still being typed', true);
  await page.click(R + '.st-pagechip:has-text("' + B.title + '")');
  await page.waitForFunction(t => (document.querySelector('#studio-root .st-asset-title') || {}).textContent === t, B.title, { timeout: 10000 });
  await sleep(1500);
  const d = await draftOf(A.id); ok(d && d.copy && d.copy.headline === 'Words still being typed', 'the open text edit reached the recovery draft: ' + JSON.stringify(d && d.copy));
  await page.click(R + '.st-pagechip:has-text("' + A.title + '")');
  await page.waitForFunction(t => (document.querySelector('#studio-root .st-asset-title') || {}).textContent === t, A.title, { timeout: 10000 }); await sleep(800);
  const words = await page.evaluate(() => document.querySelector('#studio-root .st-le-layer[aria-label="Layer headline"]').getAttribute('aria-description') || '');
  ok(/Words still being typed/.test(words), 'the words are on the canvas on return: ' + words);
});

await T.t('C3. moving to another stage and back, or reloading the page, brings the unsaved canvas edit back without a question', async () => {
  await page.ctxB.close(); await openDesign('S19 C at design');
  const t0 = await headTop(); await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowUp');
  const moved = await headTop(); ok(Math.abs(moved - t0) > 0.5, 'moved');
  let asked = 0; page.on('dialog', () => { asked++; });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await sleep(600);
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 10000 }); await sleep(600);
  ok(Math.abs(await headTop() - moved) < 0.2, 'back after a stage change');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof go === 'function' && typeof studioInit === 'function'); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  if (!(await page.$(R + '.st-step.on:has(.st-step-l:text-is("Design"))'))) await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(800);
  ok(Math.abs(await headTop() - moved) < 0.2, 'back after a reload');
  eq(asked, 0, 'no dialog was needed: the work was recoverable all along');
});

await T.t('D. the tool row is contextual: with nothing selected it offers Undo, Redo, Add and View only; a selection brings Align and order, three bring Distribute; guides and grid sit in the View menu', async () => {
  await page.ctxB.close(); await openDesign('S19 E at design');
  await page.keyboard.press('Escape'); await page.click(R + '.st-le', { position: { x: 3, y: 3 } }).catch(() => {}); await sleep(200);
  const has = async t => !!(await page.$(R + '.st-le-tools button:has-text("' + t + '")'));
  ok(await has('Undo') && await has('Redo'), 'undo and redo are always there');
  ok(!(await has('To front')) && !(await has('Align left')), 'no arrangement tools without a selection');
  ok(await page.$(R + '.st-le-tools .st-le-hint-inline'), 'the row says how to select instead');
  ok(!(await page.$(R + '.st-le-tools > label input[aria-label="Grid"]')), 'the grid is not a loose checkbox in the row');
  await page.click(R + '.st-le-viewopts > summary'); ok(await page.isVisible(R + '.st-le-viewpop input[aria-label="Grid"]'), 'the grid lives in the View menu');
  await page.click(R + '.st-le-viewopts > summary');
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(200);
  ok(await has('Align left') && await has('To front'), 'a selection brings align and order');
  ok(!(await has('Distribute across')), 'no distribute with one layer');
  const n = await page.$$eval(R + '.st-le-layer', els => els.length);
  if (n >= 3) { const ids = await page.$$eval(R + '.st-le-layer', els => els.slice(0, 3).map(e => e.getAttribute('aria-label'))); await page.click(R + '.st-le-layer[aria-label="' + ids[0] + '"]'); for (const id of ids.slice(1)) await page.click(R + '.st-le-layer[aria-label="' + id + '"]', { modifiers: ['Shift'], force: true }); await sleep(200);
    ok(await has('Distribute across'), 'three selected bring Distribute'); }
});

await T.t('E. the inspector folds to a rail and opens again, its width and the tool panel\'s width are set from the keyboard on their edges and kept after a reload', async () => {
  await page.click(R + '.st-insp-collapse'); await sleep(300);
  ok(await page.$(R + '.st-inspector.min .st-insp-rail'), 'the inspector is a rail');
  const art0 = await page.$eval(R + '.st-stage canvas, ' + R + '.st-artboard canvas', el => el.getBoundingClientRect().width);
  await page.click(R + '.st-insp-rail button[aria-label="Open Checks"]'); await sleep(300);
  ok(!(await page.$(R + '.st-inspector.min')), 'a tab on the rail opens the inspector at that tab');
  ok(await page.$(R + '#st-tabbtn-checks[aria-selected="true"]'), 'on Checks');
  const art1 = await page.$eval(R + '.st-stage canvas, ' + R + '.st-artboard canvas', el => el.getBoundingClientRect().width);
  ok(art0 >= art1, 'the folded inspector gave the canvas room (' + Math.round(art0) + ' vs ' + Math.round(art1) + ')');
  const w0 = await page.$eval(R + '#st-inspector', el => el.getBoundingClientRect().width);
  await page.focus(R + '#st-inspector > .st-panel-handle'); for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft'); await sleep(200);
  const w1 = await page.$eval(R + '#st-inspector', el => el.getBoundingClientRect().width);
  ok(w1 >= w0 + 100, 'three Shift+Left on the edge widen the inspector by 120px (' + Math.round(w0) + ' -> ' + Math.round(w1) + ')');
  await page.click(R + '.st-dock-btn:has-text("Layers")'); await page.waitForSelector(R + '#st-library', { timeout: 5000 });
  const l0 = await page.$eval(R + '#st-library', el => el.getBoundingClientRect().width);
  await page.focus(R + '#st-library > .st-panel-handle'); await page.keyboard.press('Shift+ArrowRight'); await sleep(200);
  const l1 = await page.$eval(R + '#st-library', el => el.getBoundingClientRect().width); ok(l1 >= l0 + 30, 'the tool panel widens from its edge (' + Math.round(l0) + ' -> ' + Math.round(l1) + ')');
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof go === 'function' && typeof studioInit === 'function'); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '#st-inspector', { timeout: 15000 }); await sleep(600);
  const w2 = await page.$eval(R + '#st-inspector', el => el.getBoundingClientRect().width); ok(Math.abs(w2 - w1) < 2, 'the inspector width is kept (' + Math.round(w2) + ')');
});

await T.t('F. the layers list finds a layer by name or words, and a layer renamed there keeps its name in the saved version', async () => {
  if (!(await page.$(R + '#st-library[data-tool="layers"]'))) { await page.click(R + '.st-dock-btn:has-text("Layers")'); await page.waitForSelector(R + '#st-library', { timeout: 5000 }); }
  const search = await page.$(R + '#st-library .st-le-search');
  if (search) { await search.fill('headline'); await sleep(150); const rows = await page.$$eval(R + '#st-library .st-le-item', els => els.length); ok(rows >= 1, 'a search keeps the matching rows (' + rows + ')'); await search.fill(''); }
  await page.dblclick(R + '#st-library .st-layer-pick:has-text("headline")');
  await page.waitForSelector(R + '#st-library .st-le-rename', { timeout: 5000 }); await page.fill(R + '#st-library .st-le-rename', 'Main line'); await page.keyboard.press('Enter'); await sleep(300);
  ok(await page.$(R + '#st-library .st-layer-pick:has-text("Main line")'), 'the row shows the new name');
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForFunction(() => /Version saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 10000 });
  const A = (await assets(PE.design))[0]; const hl = cur(A).layout.layers.find(l => l.role === 'headline'); eq(hl.name, 'Main line', 'the name is in the version');
});

await T.t('G. Copy is one list of the pieces: the assets rail of the other steps is not shown beside it', async () => {
  await page.ctxB.close(); page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true });
  const row = R + '.st-lib tbody tr:has-text("S19 E at copy")'; await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await sleep(800);
  ok(!(await page.$(R + 'nav.st-rail')), 'no assets rail in Copy'); ok(!(await page.$(R + '.st-rail-open')), 'nor a button to open one');
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
