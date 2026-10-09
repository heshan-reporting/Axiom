/* S17: the canvas editor in real Chromium against the worker module in this process (studio-fixture.mjs; providers MOCKED,
 * nothing spent). What a designer does on the canvas, checked against the record:
 *   - selection: eight handles and a rotation handle, a floating toolbar; an edge handle resizes from that edge; rotation
 *     turns the layer and one Ctrl+Z undoes the whole gesture;
 *   - a drag snaps to the stage centre and draws the guide; a marquee selects every layer it touches;
 *   - words typed on the canvas go to the copy field the layer shows and save with the layout as one version;
 *   - adding and styling: a heading, an icon from the set, a Google font from the picker, a shadow; Ctrl+D duplicates,
 *     Delete removes, and Delete on a copy-role layer hides it instead of losing the approved words;
 *   - an unsaved layout is a draft for this person only, offered back after a reload - never a version on its own;
 *   - zoom shortcuts; the shortcuts sheet (?), Ctrl+Shift+] read by the key, Alt with a digit by the key (a Mac's Option);
 *   - style variations, resize to platform formats and the Creative quality summary, all free;
 *   - the Art Director hears which layers are selected; imagery edits by description (remove, relight).
 * Run: node --experimental-sqlite tests/studio-s17-editor-browser.mjs   (SHOT=1 writes tests/shots/s17-ed-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8808, inspect: false });
const { api, calls, env } = fx;
const R = '#studio-root ';
const T = runner('studio-s17-editor-browser (the canvas editor: handles, snapping, words on the canvas, elements, drafts, zoom, styles, resize, quality, selection, imagery edits; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
let page;
const shot = async name => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 's17-ed-' + name + '.png' }); };
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'A road tax, returned.', alt: 'Teal panel with the headline' };
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Editor check', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'ed1' });
const A = (await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Square tile', copy: COPY, mode: 'composition' })).asset.id;
const B = (await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'facebook', format: '1:1', title: 'Photo tile', copy: COPY, mode: 'composition' })).asset.id;
{ const j = await api('POST', '/studio/job', { project: pr.id, asset: B, stage: 'render', input: { prompt: 'a regional road at dusk', aspect: '1:1', size: '1K' }, idem: 'edr' }); for (let i = 0; i < 6; i++) { const s = await api('POST', '/studio/job/step', { id: j.job.id }); if (/done|failed/.test(s.job.state)) break; } }
const get = async () => api('GET', '/studio/get?id=' + pr.id);
const cur = a => a.versions.find(v => v.id === a.current);
const box = sel => page.$eval(R + sel, el => ({ left: el.style.left, top: el.style.top, width: el.style.width, transform: el.style.transform }));
const L = id => '.st-le-layer[aria-label="Layer ' + id + '"]';
async function openAsset(title) {
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Editor check") button.st-lib-open');
  await page.waitForSelector(R + '.st-step'); await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  await page.click(R + '.st-assetpick:has-text("' + title + '")'); await page.waitForSelector(R + '.st-stage canvas');
}
// every test starts from a closed editor (a failed test may have left it open) and works on a stage in view: the mouse can only
// reach what the viewport shows
async function editLayout() {
  // S18: the canvas is the editor; a fresh start discards any working changes (the dialog is accepted), and the Layers tool is open
  const d = page.locator(R + '.st-le-foot .btn:has-text("Discard changes")'); if (await d.count()) { await d.first().click({ timeout: 3000 }).catch(() => {}); await sleep(300); }
  await page.waitForSelector(R + '.st-le-layer'); await sleep(500);
  await page.$eval(R + '.st-le', el => el.scrollIntoView({ block: 'center' })); await sleep(150);
}

await T.t('a selected layer has eight handles and a rotation handle with a floating toolbar; an edge handle resizes from that edge; the rotation handle turns the layer and one Ctrl+Z undoes the gesture', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 1000 } }); page.on('dialog', d => d.accept());
  await openAsset('Square tile'); await editLayout();
  await page.click(R + L('headline'));
  eq((await page.$$(R + '.st-le-layer.sel .st-le-hh')).length + (await page.$$(R + '.st-le-layer.sel .st-le-h')).length, 8, 'eight handles');
  eq((await page.$$(R + '.st-le-layer.sel .st-le-rot')).length, 1, 'a rotation handle'); ok(await page.$(R + '.st-fbar'), 'the floating toolbar');
  const x0 = await page.inputValue(R + 'input[aria-label="X, per cent of the stage"]'); const w0 = +(await page.inputValue(R + 'input[aria-label="Width, per cent of the stage"]'));
  const e = await (await page.$(R + '.st-le-layer.sel .st-le-hh.h-e')).boundingBox();
  await page.mouse.move(e.x + 5, e.y + 5); await page.mouse.down(); await page.mouse.move(e.x - 60, e.y + 5, { steps: 6 }); await page.mouse.up(); await sleep(200);
  ok(+(await page.inputValue(R + 'input[aria-label="Width, per cent of the stage"]')) < w0, 'narrower from the east edge');
  eq(await page.inputValue(R + 'input[aria-label="X, per cent of the stage"]'), x0, 'the west edge stayed');
  const rot = await (await page.$(R + '.st-le-layer.sel .st-le-rot')).boundingBox(); const lb = await (await page.$(R + '.st-le-layer.sel')).boundingBox();
  await page.mouse.move(rot.x + 7, rot.y + 7); await page.mouse.down(); await page.mouse.move(lb.x + lb.width + 80, lb.y + lb.height / 2 + 4, { steps: 8 }); await page.mouse.up(); await sleep(200);
  ok(/rotate\((?!0deg)[-\d.]+deg\)/.test((await box(L('headline'))).transform), 'turned: ' + (await box(L('headline'))).transform);
  await page.keyboard.press('Control+z'); await sleep(200);
  ok(!/rotate\((?!0deg)[-\d.]+deg\)/.test((await box(L('headline'))).transform), 'one undo for the whole turn: ' + (await box(L('headline'))).transform);
  await shot('handles');
});

await T.t('a drag snaps to the stage centre and draws the guide; a marquee across the stage selects every layer it touches', async () => {
  await page.$eval(R + '.st-le', el => el.scrollIntoView({ block: 'center' })); await sleep(150);
  const hl = await (await page.$(R + L('headline'))).boundingBox(); const stage = await (await page.$(R + '.st-le')).boundingBox();
  // 2 px short of the centre, from the left: the stage centre is the nearest guide within the 0.8% the snap reaches (the other
  // layers' centres lie on the far side of it)
  await page.mouse.move(hl.x + 20, hl.y + 10); await page.mouse.down();
  await page.mouse.move(hl.x + 20 + (stage.x + stage.width / 2 - (hl.x + hl.width / 2)) - 2, hl.y + 10, { steps: 10 }); await sleep(120);
  const guides = await page.$$eval(R + '.st-le-snap.x', x => x.map(e => e.style.left));
  ok(guides.indexOf('50%') >= 0, 'the stage centre guide is drawn while the centre lines up: ' + JSON.stringify(guides));
  await page.mouse.up(); await sleep(150);
  eq((await page.$$(R + '.st-le-snap')).length, 0, 'the guide goes when the gesture ends');
  const b = await (await page.$(R + L('headline'))).boundingBox(); const off = b.x + b.width / 2 - (stage.x + stage.width / 2);
  ok(Math.abs(off) < 1.5, 'the headline sits on the centre line (' + off.toFixed(2) + ' px)');
  await page.mouse.move(stage.x + 4, stage.y + stage.height * 0.4); await page.mouse.down(); await page.mouse.move(stage.x + stage.width - 4, stage.y + stage.height - 4, { steps: 8 }); await page.mouse.up(); await sleep(200);
  ok((await page.$$(R + '.st-le-layer[aria-pressed="true"]')).length >= 3, 'the marquee selected the layers it crossed');
  await page.keyboard.press('Escape');
  { const dz = page.locator(R + '.st-le-foot .btn:has-text("Discard changes")'); if (await dz.count()) { await dz.first().click({ timeout: 3000 }).catch(() => {}); await sleep(300); } }
});

await T.t('words typed on the canvas go to the copy field the layer shows and save with the layout as one version', async () => {
  await editLayout(); const n0 = (await get()).assets.find(a => a.id === A).versions.length;
  await page.dblclick(R + L('headline')); await page.waitForSelector(R + '.st-le-textedit');
  await page.fill(R + '.st-le-textedit', 'Words typed on the canvas'); await page.keyboard.press('Control+Enter');
  await page.waitForSelector(R + '.st-le-textedit', { state: 'detached' });
  // the words are drawn on the canvas; the layer says them to a screen reader (aria-description), which is what is read here
  ok(/Words typed on the canvas/.test(await page.getAttribute(R + L('headline'), 'aria-description') || ''), 'the layer shows the new words');
  await page.click(R + '.st-le-foot button:has-text("Save layout")');
  let a; for (let i = 0; i < 40; i++) { a = (await get()).assets.find(x => x.id === A); if (a.versions.length > n0) break; await sleep(150); }
  eq(a.versions.length, n0 + 1, 'one version'); const v = cur(a);
  eq(v.copy.headline, 'Words typed on the canvas', 'the copy field took the words'); ok(/words \(headline\) edited on the canvas/.test(v.note), v.note);
});

await T.t('adding and styling on the canvas: a heading, an icon from the set, a Google font from the picker and a shadow; Ctrl+D duplicates, Delete removes, and Delete on a copy-role layer hides it rather than losing the approved words', async () => {
  await editLayout(); const n0 = (await page.$$(R + '.st-le-layer')).length;
  await page.$eval(R + '.st-le-tools', el => el.scrollIntoView({ block: 'center' }));
  await page.click(R + '.st-addmenu > button'); await page.click(R + '.st-addmenu-pop button:has-text("Heading")'); await sleep(150);
  await page.click(R + '.st-addmenu > button'); await page.click(R + '.st-addmenu-pop button:has-text("Icon")'); await page.click(R + '.st-addmenu-pop.icons button[title="check-circle"]'); await sleep(150);
  eq((await page.$$(R + '.st-le-layer')).length, n0 + 2, 'a heading and an icon added');
  await page.$eval(R + '.st-le', el => el.scrollIntoView({ block: 'center' })); await page.click(R + L('support')); await sleep(150);
  await page.click(R + '.st-fbar .st-fbar-font'); await page.waitForSelector(R + '.st-fontpick');
  ok(/Brand|Recommended/.test(await page.textContent(R + '.st-fontpick')), 'the picker groups the brand and recommended faces');
  await page.fill(R + '.st-fontpick input', 'Playfair'); await page.click(R + '.st-fontpick .st-font-row:has-text("Playfair Display")'); await sleep(200);
  ok(/Playfair Display/.test(await page.textContent(R + '.st-fbar .st-fbar-font')), 'the support line is set in Playfair Display');
  // S19: effects live in a collapsed section of Properties (secondary controls in menus); it opens and remembers that
  ok(!(await page.$(R + '.st-le-effects')), 'the effects are folded until asked for');
  await page.click(R + 'details[data-sec="effects"] > summary'); await page.waitForSelector(R + '.st-le-effects', { timeout: 5000 });
  await page.check(R + '.st-le-effects label:has-text("Shadow") input'); await sleep(150);
  const icon = await page.$$eval(R + '.st-le-layer', x => x.map(e => e.getAttribute('aria-label')).filter(a => /Layer (icon|device|l)/.test(a)).pop());
  await page.click(R + '.st-le-layer[aria-label="' + icon + '"]'); await page.keyboard.press('Control+d'); await sleep(150);
  eq((await page.$$(R + '.st-le-layer')).length, n0 + 3, 'Ctrl+D duplicated the icon');
  await page.keyboard.press('Delete'); await sleep(150); eq((await page.$$(R + '.st-le-layer')).length, n0 + 2, 'Delete removed the copy');
  await page.click(R + L('headline')); await page.keyboard.press('Delete'); await sleep(200);
  eq((await page.$$(R + L('headline'))).length, 0, 'the headline is off the canvas');
  ok(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#studio-root .st-le'))), 'the keyboard stays on the canvas after the focused layer leaves it');
  await page.keyboard.press('Control+z'); await sleep(150);
  eq((await page.$$(R + L('headline'))).length, 1, 'and back with Ctrl+Z');
  await page.click(R + '.st-le-foot button:has-text("Save layout")'); await sleep(800);
  const v = cur((await get()).assets.find(x => x.id === A)); const sp = v.layout.layers.find(l => l.role === 'support');
  eq(sp.family, 'Playfair Display'); ok(sp.shadow && sp.shadow.blur > 0, 'the shadow saved: ' + JSON.stringify(sp.shadow));
  ok(v.layout.layers.some(l => l.shape === 'icon' && l.icon === 'check-circle'), 'the icon saved'); eq(v.copy.headline, 'Words typed on the canvas', 'the approved words kept');
  await shot('elements');
});

await T.t('an unsaved layout is autosaved as a draft for this person only and offered back after a reload; it never became a version', async () => {
  await editLayout(); const n0 = cur((await get()).assets.find(x => x.id === A)) && (await get()).assets.find(x => x.id === A).versions.length;
  await page.click(R + L('cta')); const before = await box(L('cta'));
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowUp');
  await page.waitForFunction(() => /Draft saved/.test((document.querySelector('#studio-root .st-le-draft') || {}).textContent || ''), null, { timeout: 15000 });
  const moved = await box(L('cta')); ok(moved.top !== before.top, 'the CTA moved');
  const dr = await api('GET', '/studio/draft?asset=' + A); ok(dr.draft && dr.draft.layout, 'the draft is on the worker for this key');
  const rd = await api('GET', '/studio/draft?asset=' + A, null, 'read-key'); ok(!rd.draft, 'another person does not see it');
  await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.STRender); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-step'); await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))').catch(() => {});
  await page.waitForSelector(R + '.st-assetpick:has-text("Square tile")'); await page.click(R + '.st-assetpick:has-text("Square tile")'); await page.waitForSelector(R + '.st-stage canvas');
  // S19: in the same browser the working store brings the edit straight back - no question to answer
  await page.waitForSelector(R + L('cta')); await sleep(600); eq((await box(L('cta'))).top, moved.top, 'the CTA is back on its own after a reload (the working store)');
  ok(!(await page.$(R + '.st-le-restore')), 'no restore prompt when the work came back by itself');
  // without the local copy (another browser or device) the server draft is offered back
  await page.evaluate(() => window.STWork.clear());
  await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.STRender); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-step'); await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))').catch(() => {});
  await page.waitForSelector(R + '.st-assetpick:has-text("Square tile")'); await page.click(R + '.st-assetpick:has-text("Square tile")'); await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForSelector(R + '.st-le-layer'); await page.waitForSelector(R + '.st-le-restore', { timeout: 15000 });
  ok(/unsaved layout changes/.test(await page.textContent(R + '.st-le-restore')), await page.textContent(R + '.st-le-restore'));
  await page.click(R + '.st-le-restore button:has-text("Restore my changes")'); await sleep(300);
  eq((await box(L('cta'))).top, moved.top, 'the CTA is back where it was moved');
  eq((await get()).assets.find(x => x.id === A).versions.length, n0, 'nothing became a version');
  { const dz = page.locator(R + '.st-le-foot .btn:has-text("Discard changes")'); if (await dz.count()) { await dz.first().click({ timeout: 3000 }).catch(() => {}); await sleep(300); } }
  await shot('draft');
});

await T.t('zoom by keyboard: Shift+2 doubles (or, with a selection, zooms to it - S23), Shift+0 is actual size, Shift+1 fits; the zoom control follows', async () => {
  await page.click(R + '.st-stage'); await page.keyboard.press('Escape'); await sleep(100); await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Shift+Digit2'); await sleep(150); eq(await page.inputValue(R + 'select[aria-label="Zoom"]'), '200', 'nothing selected: Shift+2 is 200%');
  await page.keyboard.press('Shift+Digit0'); await sleep(150); eq(await page.inputValue(R + 'select[aria-label="Zoom"]'), 'actual');
  await page.keyboard.press('Shift+Digit1'); await sleep(150); eq(await page.inputValue(R + 'select[aria-label="Zoom"]'), 'fit');
  // S23: with a layer selected the same key zooms to the selection, as in other design tools
  if (await page.$(R + L('cta'))) { await page.click(R + L('cta')); await page.keyboard.press('Shift+Digit2'); await sleep(250);
    ok(await page.inputValue(R + 'select[aria-label="Zoom"]') !== 'fit', 'with a selection Shift+2 zooms to it');
    await page.keyboard.press('Escape'); await page.keyboard.press('Shift+Digit1'); await sleep(150); eq(await page.inputValue(R + 'select[aria-label="Zoom"]'), 'fit'); }
});

await T.t('the keyboard, written down and kept: ? opens the shortcuts (a key pressed there never reaches the canvas), Ctrl+Shift+] brings a layer to the front, and Alt with a digit moves between steps by the key it is (Option+1 on a Mac types a symbol)', async () => {
  await editLayout(); await tool(page, 'Layers'); const rows = () => page.$$eval(R + '.st-le-list button.st-layer-pick', x => x.map(e => (e.getAttribute('title') || '').split(' ')[0]));
  const r0 = await rows(); ok(r0[0] !== 'cta', 'the call to action is not in front to begin with: ' + r0.join(', '));
  await page.click(R + '.st-le-list button.st-layer-pick[title^="cta "]');
  await page.keyboard.press('Control+Shift+BracketRight'); await sleep(150);
  eq((await rows())[0], 'cta', 'Ctrl+Shift+] put it in front (the brace the key types with Shift is read as the bracket)');
  await page.keyboard.press('Control+z'); await sleep(150); eq(await rows(), r0, 'and one undo puts it back');
  await page.keyboard.press('Shift+Slash'); await page.waitForSelector(R + '.st-keys', { timeout: 5000 });
  const groups = await page.$$eval(R + '.st-keys .st-keys-group h4', x => x.map(e => e.textContent));
  eq(groups, ['Selection', 'Layers', 'Words', 'Gestures', 'History', 'View', 'Studio'], 'the sheet groups every shortcut');
  ok(/Ctrl\+Shift\+\]/.test(await page.textContent(R + '.st-keys')), 'it names the keys this machine has');
  await page.keyboard.press('Delete'); await sleep(150);
  eq((await page.$$(R + L('cta'))).length, 1, 'Delete pressed in the sheet did not remove the selected layer behind it');
  await page.keyboard.press('Escape'); await page.waitForSelector(R + '.st-keys', { state: 'detached', timeout: 5000 });
  ok(await page.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#studio-root .st-le'))), 'the keyboard is back on the canvas');
  await page.click(R + '.st-le-tools button:has-text("Shortcuts")'); await page.waitForSelector(R + '.st-keys');
  await page.click(R + '.st-keys button:has-text("Close")'); await page.waitForSelector(R + '.st-keys', { state: 'detached', timeout: 5000 });
  { const dz = page.locator(R + '.st-le-foot .btn:has-text("Discard changes")'); if (await dz.count()) { await dz.first().click({ timeout: 3000 }).catch(() => {}); await sleep(300); } }
  // Option+1 on a Mac: the key is Digit1, the character a symbol
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '\u00a1', code: 'Digit1', altKey: true, bubbles: true })));
  await page.waitForFunction(() => /Brief/.test((document.querySelector('#studio-root .st-step.on .st-step-l') || {}).textContent || ''), null, { timeout: 5000 });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '\u00a2', code: 'Digit4', altKey: true, bubbles: true })));
  await page.waitForFunction(() => /Design/.test((document.querySelector('#studio-root .st-step.on .st-step-l') || {}).textContent || ''), null, { timeout: 5000 });
  await page.click(R + '.st-assetpick:has-text("Square tile")'); await page.waitForSelector(R + '.st-stage canvas');
  await shot('keys');
});

await T.t('style variations: ten named treatments of the same words and marks, each measured; Use this style is a layout version with no model call', async () => {
  const a0 = calls.anthropic, g0 = calls.gemini; const n0 = (await get()).assets.find(x => x.id === A).versions.length;
  await tool(page, 'Design'); await page.click(R + '.st-styles .st-vars-head button'); await page.waitForSelector(R + '.st-styles .st-var', { timeout: 20000 });
  const names = await page.$$eval(R + '.st-styles .st-var .st-var-name', x => x.map(e => e.textContent));
  eq(names, ['Minimal', 'Bold', 'Editorial', 'Data-led', 'Social-first', 'Corporate', 'Premium', 'High-impact', 'Clean', 'Campaign-style'], 'the ten styles');
  ok((await page.$$(R + '.st-styles .st-var .st-chip')).length >= 10, 'each says whether it passes the measurement');
  const before = cur((await get()).assets.find(x => x.id === A));
  await page.click(R + '.st-styles .st-var[data-style="editorial"] button:has-text("Use this style")');
  let a; for (let i = 0; i < 40; i++) { a = (await get()).assets.find(x => x.id === A); if (a.versions.length > n0) break; await sleep(150); }
  const v = cur(a); ok(/style variation: Editorial \(no render\)/.test(v.note), v.note); eq(v.copy, before.copy, 'the words unchanged');
  ok(v.layout.layers.some(l => l.family === 'Playfair Display'), 'the editorial face');
  eq([calls.anthropic, calls.gemini], [a0, g0], 'no model or image call');
});

await T.t('resize to platform formats: the chosen presets become new assets in the same family, measured, with the words and styling kept; the current format is marked', async () => {
  const n0 = (await get()).assets.length;
  await tool(page, 'Design'); await page.click(R + '.st-resize .st-vars-head button'); await page.waitForSelector(R + '.st-resize-opt');
  ok(/this format/.test(await page.textContent(R + '.st-resize-opt:has-text("Meta square")')), 'the current format is marked');
  await page.click(R + '.st-resize-opt:has-text("Story or reel")'); await page.click(R + '.st-resize-opt:has-text("LinkedIn link")');
  await page.click(R + '.st-resize button:has-text("Make 2 resized versions")');
  await page.waitForSelector(R + '.st-resize-made button', { timeout: 20000 });
  const g = await get(); eq(g.assets.length, n0 + 2, 'two new assets');
  const made = g.assets.filter(x => / - (Story or reel|LinkedIn link)$/.test(x.title));
  eq(made.map(x => x.format).sort(), ['1.91:1', '9:16']); ok(made.every(x => x.family === 'Set'), 'in the same family');
  const src = cur(g.assets.find(x => x.id === A)); ok(made.every(x => cur(x).copy.headline === src.copy.headline), 'the words kept');
  ok(made.every(x => /resized from/.test(cur(x).note) && /no render/.test(cur(x).note)), 'each says where it came from and that nothing rendered');
  await shot('resize');
});

await T.t('the Creative quality summary rates five areas from the measurement, offers Fix automatically only for a layout matter, and names what no layout can fix', async () => {
  await page.click(R + '#st-tabbtn-checks'); await page.waitForSelector(R + '.st-qsum-row');
  const rows = await page.$$eval(R + '.st-qsum-row', x => x.map(e => e.getAttribute('data-area') + ':' + e.querySelector('.st-qsum-rate').textContent));
  ok(['readability', 'layout', 'imagery', 'brand', 'accessibility', 'platform'].every(k => rows.some(r => r.indexOf(k + ':') === 0)), JSON.stringify(rows));
  ok(rows.some(r => /^imagery:Poor/.test(r)), 'no imagery yet is a blocking finding in its own area: ' + JSON.stringify(rows));
  ok(/Not a layout matter: no imagery yet/.test(await page.textContent(R + '.st-qsum')), 'the remedy is named');
  ok(/ratings come from the measurement, not a model/.test(await page.textContent(R + '.st-qsum')));
  await shot('quality');
});

await T.t('the Art Director hears which layers are selected: the composer names them and the direction it sends carries them', async () => {
  await editLayout(); await page.click(R + L('headline')); await sleep(200);
  await page.click(R + '#st-tabbtn-director'); await page.waitForSelector(R + '.st-sel-about');
  ok(/About the selection/.test(await page.textContent(R + '.st-sel-about')) && /headline/.test(await page.textContent(R + '.st-sel-about')), await page.textContent(R + '.st-sel-about'));
  await page.fill(R + '.st-composer textarea', 'Make it bolder'); await page.click(R + '.st-composer .btn:has-text("Send")');
  let row = null; for (let i = 0; i < 40 && !row; i++) { row = env.MIND_DB.db.prepare("SELECT input FROM studio_jobs WHERE stage='revise' ORDER BY created DESC LIMIT 1").get(); if (!row) await sleep(150); }
  ok(row && JSON.parse(row.input).layers && JSON.parse(row.input).layers.indexOf('headline') >= 0, 'the revise job carries the selection: ' + (row && row.input));
  { const dz = page.locator(R + '.st-le-foot .btn:has-text("Discard changes")'); if (await dz.count()) { await dz.first().click({ timeout: 3000 }).catch(() => {}); await sleep(300); } }
});

await T.t('imagery edits by description: a removal needs only its marked area, a relight needs the words of the change; each is one image edit stated before anything is spent', async () => {
  await page.click(R + '.st-assetpick:has-text("Photo tile")'); await page.waitForSelector(R + '.st-stage canvas');
  await tool(page, 'Images'); const link = page.locator(R + 'button:has-text("Edit an area of the imagery")'); await link.first().scrollIntoViewIfNeeded(); await link.first().click();
  eq(await page.$$eval(R + '.st-areaedit .st-segbtn', x => x.map(b => b.textContent)), ['Change a marked area', 'Remove an object', 'New background, keep the subject', 'Change the light', 'Restyle, keep the content']);
  ok(/not a pixel mask/.test(await page.textContent(R + '.st-areaedit')), 'the limit is said first');
  await page.click(R + '.st-areaedit .st-segbtn:has-text("Remove an object")');
  const go = R + '.st-areaedit button.btn.sm:not(.ghost)'; ok(await page.isDisabled(go), 'nothing to remove until an area is marked');
  await page.$eval(R + '.st-area-stage', el => el.scrollIntoView({ block: 'center' })); await sleep(200);
  const st = await (await page.$(R + '.st-area-stage')).boundingBox();
  await page.mouse.move(st.x + st.width * 0.6, st.y + st.height * 0.6); await page.mouse.down(); await page.mouse.move(st.x + st.width * 0.85, st.y + st.height * 0.85, { steps: 6 }); await page.mouse.up();
  ok(!(await page.isDisabled(go)), 'the marked area is enough');
  const g0 = calls.gemini; await page.click(go);
  let rj = null; for (let i = 0; i < 60 && !rj; i++) { rj = env.MIND_DB.db.prepare("SELECT input, state FROM studio_jobs WHERE stage='render' AND input LIKE '%\"editKind\":\"remove\"%'").get(); if (!rj) await sleep(150); }
  ok(rj, 'a removal job'); const inp = JSON.parse(rj.input); eq([inp.editKind, inp.area.w > 0, inp.instruction], ['remove', true, '']);
  for (let i = 0; i < 60 && calls.gemini === g0; i++) await sleep(150); eq(calls.gemini - g0, 1, 'one image edit');
  await page.waitForSelector(R + '.st-preserve', { timeout: 15000 }); ok(/Removal of v\d+ \(the marked area\)/.test(await page.textContent(R + '.st-preserve')), await page.textContent(R + '.st-preserve'));
  await tool(page, 'Images'); const link2 = page.locator(R + 'button:has-text("Edit an area of the imagery")'); await link2.first().scrollIntoViewIfNeeded(); await link2.first().click();
  await page.click(R + '.st-areaedit .st-segbtn:has-text("Change the light")');
  ok(await page.isDisabled(go), 'a relight needs the words of the change'); await page.fill(R + '.st-areaedit textarea', 'low golden light from the left'); ok(!(await page.isDisabled(go)));
  await page.click(R + '.st-areaedit button:has-text("Cancel")');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | '));
  await shot('area');
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
