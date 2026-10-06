/* The Studio page's editing and measuring behaviour (S1): when filing the measurement fails (the worker answers 500),
 * the page must not record the composition as filed - a later Measure again must send the evidence again; and the
 * layout editor's canvas shortcuts (arrow keys, Ctrl+Z) never take a key typed into one of its fields. Each case was
 * written to fail on build studio-p24-r2 and pass after the fix. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-editor-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8795, inspect: false });
const T = runner('studio-editor-browser (Measure again retries a failed filing; fields keep their keys from the canvas shortcuts)');
const R = '#studio-root ';
const api = fx.api;

await T.t('a failed validation filing is not recorded as done: the readiness stays unvalidated and Measure again files it', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Measure me', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'm1' });
  const a0 = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Square tile', copy: { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition' }, mode: 'composition' });
  ok(a0.asset, 'asset made');
  // the first filing fails on the worker's side
  const f = fx.failNext(/^\/studio\/validation$/, 500);
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Measure me") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.waitForSelector(R + '.st-ready', { timeout: 30000 });
  try { await page.waitForFunction(() => !/measuring/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 }); }
  catch (e) { console.log('    strip: ' + (await page.textContent(R + '.st-ready')).replace(/\s+/g, ' ').slice(0, 300)); console.log('    validation requests: ' + fx.seen.filter(s => s.path === '/studio/validation').length + ', failNext hit ' + f.hit); throw e; }
  await page.waitForTimeout(600);
  eq(f.hit, 1, 'the first filing was attempted and failed');
  let d = await api('GET', '/studio/get?id=' + pr.id); let a = d.assets[0];
  ok(a.readiness.technical !== 'passed', 'the worker holds no passing validation (' + a.readiness.technical + ')');
  const txt = await page.textContent(R + '.st-ready');
  ok(!/Technical validation\s*passed/.test(txt), 'the page does not show the composition as passed: ' + txt.replace(/\s+/g, ' ').slice(0, 160));
  // Measure again must send the evidence again, and this time it lands
  const before = fx.seen.filter(s => s.path === '/studio/validation').length;
  await page.click(R + '.st-ready button:has-text("Measure again")');
  // the composition expects a photograph that was never made, so the honest verdict is "failed" (imagery missing): what
  // matters here is that the evidence was sent again and recorded, not the verdict
  await page.waitForFunction(() => /Technical validation\s*(passed|failed)/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  const after = fx.seen.filter(s => s.path === '/studio/validation').length;
  ok(after > before, 'Measure again sent the evidence again (' + (after - before) + ' filing)');
  d = await api('GET', '/studio/get?id=' + pr.id); a = d.assets[0];
  ok(a.readiness.validation && a.readiness.technical === 'failed' && a.readiness.validation.blocking.some(b => b.code === 'imagery_missing'), 'the worker now holds a validation of this version, and it says why it fails: ' + JSON.stringify((a.readiness.validation || {}).blocking || []).slice(0, 160));
  const strip = await page.textContent(R + '.st-ready'); ok(/Technical validation\s*failed/.test(strip), 'the page shows the recorded verdict, not "not validated": ' + strip.replace(/\s+/g, ' ').slice(0, 120));
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
await T.t('a key typed into a layout-editor field edits the field: arrow keys do not nudge the layer, Ctrl+Z does not undo the layout', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Keys', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'k1' });
  await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Key tile', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.', cta: 'Sign' }, mode: 'composition' });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Keys") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-layer');
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  const posOf = async () => page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', el => el.style.top);
  const top0 = await posOf();
  // the Size field: ArrowUp steps the number, the layer stays where it is
  const size = page.locator(R + 'input[aria-label="Type size, per cent of the width"]'); await size.focus();
  const s0 = +(await size.inputValue()); await page.keyboard.press('ArrowUp'); await page.waitForTimeout(150);
  const s1 = +(await size.inputValue());
  ok(s1 > s0, 'ArrowUp in the Size field steps the number (' + s0 + ' -> ' + s1 + ')');
  eq(await posOf(), top0, 'the layer did not move');
  // Ctrl+Z inside the field is the field's own undo, not the layout history
  await page.keyboard.press('Control+z'); await page.waitForTimeout(150);
  eq(await posOf(), top0, 'Ctrl+Z in a field leaves the layout alone');
  // and outside a field the shortcuts still work: the layer nudges, then undoes
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150);
  const topMoved = await posOf(); ok(topMoved !== top0, 'ArrowDown on the canvas nudges the layer (' + top0 + ' -> ' + topMoved + ')');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(150);
  eq(await posOf(), top0, 'Ctrl+Z on the canvas undoes the nudge');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
await T.t('the editor\'s handles sit on what the renderer measured (the words\' ink, a mark\'s visible pixels), with the layer box drawn faintly behind when it differs', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Ink', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'ink1' });
  const a0 = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Ink tile', copy: { headline: 'Short', support: 'Not a subsidy.', cta: 'Sign' }, mode: 'composition' });
  const L = a0.asset.versions[0].layout; const hl = L.layers.find(l => l.role === 'headline');
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Ink") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"][data-ink="1"]', { timeout: 15000 });
  const on = await page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', el => ({ w: parseFloat(el.style.width), x: parseFloat(el.style.left) }));
  ok(on.w < hl.w * 0.8, 'a one-word headline\'s handle is the width of the word (' + on.w.toFixed(1) + '% of a ' + hl.w + '% box), not the box');
  ok(Math.abs(on.x - hl.x) < 1.5, 'left-aligned, it starts where the box starts (' + on.x.toFixed(1) + '% vs ' + hl.x + '%)');
  ok(await page.$(R + '.st-le-box'), 'the layer box is drawn faintly behind the ink');
  // a drag still moves the layer by the same distance, whatever the handle covers
  // the canvas sits lower in the S14 desk: bring the handle to the middle of the view first, as a person would scroll to it
  await page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(150);
  const h = await page.$(R + '.st-le-layer[aria-label="Layer headline"]'); const hb = await h.boundingBox();
  const box = await page.$eval(R + '.st-le', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x + hb.width / 2 + box.w * 0.1, hb.y + hb.height / 2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200);
  const xField = await page.inputValue(R + 'input[aria-label="X, per cent of the stage"]');
  ok(Math.abs(parseFloat(xField) - (hl.x + 10)) < 1.5, 'dragging the ink moved the layer 10% (x ' + hl.x + ' -> ' + xField + ')');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
await T.t('framing by dragging: the photograph is panned through the renderer\'s transform, one drag is one undo step, the wheel zooms, centre and reset return to the plain crop', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Frame', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'fr1' });
  // an asset with imagery on file (the fixture's gradient photograph)
  const { PHOTO } = await import('./studio-fixture.mjs');
  const key = 'studio/x/frame/photo.png'; fx.r2.set(key, { v: Buffer.from(PHOTO, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });
  const a0 = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Framed tile', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.', cta: 'Sign' }, image: { key, url: '/studio/file?key=' + encodeURIComponent(key), model: 'test', size: '1K' }, mode: 'composition' });
  ok(a0.asset, 'asset made');
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Frame") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-framing', { timeout: 15000 });
  await page.click(R + '.st-le-framing button:has-text("Frame by dragging")'); await page.waitForSelector(R + '.st-le-frame[data-ready="1"]', { timeout: 15000 });
  const across = () => page.inputValue(R + 'input[aria-label="Focal point across, per cent"]');
  eq(await across(), '50', 'the plain crop starts at focus 50');
  // the fixture photograph is square in a square box: no horizontal overflow at zoom 1, so zoom first, then drag
  const fr = await page.$(R + '.st-le-frame'); const fb = await fr.boundingBox();
  // a wheel event on the overlay (dispatched to the element: headless Chromium's synthetic wheel does not reliably reach a page listener)
  await page.dispatchEvent(R + '.st-le-frame', 'wheel', { deltaY: -100, bubbles: true, cancelable: true }); await page.waitForTimeout(700);
  const zoom = await page.inputValue(R + 'input[aria-label="Image zoom"]');
  ok(+zoom > 1, 'the wheel zooms the photograph (zoom ' + zoom + ')');
  const undos0 = await page.$eval(R + '.st-le-tools button:has-text("Undo")', el => !el.disabled); ok(undos0, 'the zoom gesture is one undo step');
  // the drag: the overlay's position is read again right before it (the page may have scrolled since), and the pointer stays on the overlay
  await page.locator(R + '.st-le-frame').scrollIntoViewIfNeeded(); const fb2 = await (await page.$(R + '.st-le-frame')).boundingBox();
  const cx = fb2.x + fb2.width / 2, cy = fb2.y + fb2.height / 2;
  eq(await page.evaluate(([x, y]) => (document.elementFromPoint(x, y) || {}).className, [cx, cy]), 'st-le-frame', 'the pointer starts on the framing overlay');
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - fb2.width * 0.2, cy, { steps: 5 }); await page.mouse.up(); await page.waitForTimeout(200);
  const x1 = +(await across()); ok(x1 > 50, 'dragging the photograph left moves the focus right (' + x1 + ')');
  await page.keyboard.press('Escape'); await page.click(R + '.st-le-tools button:has-text("Undo")'); await page.waitForTimeout(150);
  eq(await across(), '50', 'one undo takes back the whole drag');
  await page.click(R + '.st-le-tools button:has-text("Redo")'); await page.waitForTimeout(150); ok(+(await across()) === x1, 'redo restores it');
  await page.click(R + '.st-le-framing button:has-text("centre and reset")'); await page.waitForTimeout(150);
  eq([await across(), await page.inputValue(R + 'input[aria-label="Image zoom"]')], ['50', '1'], 'centre and reset returns to the plain crop at zoom 1');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
await T.t('locks hold in every canvas command: a locked layer is not reordered or grouped, a mark keeps its proportions when resized, a rule-held mark does not drag; unsaved layout edits are named and Cancel asks', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Locks', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'lk1' });
  const a0 = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Lock tile', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.', cta: 'Sign' }, mode: 'composition' });
  const L = JSON.parse(JSON.stringify(a0.asset.versions[0].layout)); L.layers.find(l => l.role === 'support').locked = true; const mk = L.layers.find(l => l.role === 'logo'); mk.rule = { corner: 'br', mandatory: true, note: 'approved placement' };
  await api('POST', '/studio/version', { asset: a0.asset.id, layout: L, kind: 'layout', note: 'lock the support, hold the mark' });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } }); page.on('dialog', d => d.dismiss());
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Locks") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-layer[aria-label="Layer support"]');
  const order = () => page.$$eval(R + '.st-le-list .st-le-item', els => els.map(e => e.textContent.trim().split(' ')[0]));
  const o0 = await order();
  await page.click(R + '.st-le-layer[aria-label="Layer support"]'); await page.click(R + '.st-le-tools button:has-text("To front")'); await page.waitForTimeout(100);
  eq(await order(), o0, 'a locked layer is not brought to the front');
  ok(await page.isDisabled(R + '.st-le-tools button:has-text("Group")'), 'nothing to group with one layer');
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]', { modifiers: ['Shift'] }); await page.click(R + '.st-le-tools button:has-text("Group")'); await page.waitForTimeout(100);
  const grouped = await page.$$eval(R + '.st-le-layer', els => els.filter(e => /grouped/.test(e.textContent)).map(e => e.getAttribute('aria-label')));
  ok(grouped.indexOf('Layer support') < 0, 'a locked layer is not grouped (' + grouped.join(', ') + ')');
  // the rule-held mark has no drag handle and says why
  const held = await page.$eval(R + '.st-le-layer[aria-label="Layer logo"]', el => ({ text: el.textContent, cls: el.className, handle: !!el.querySelector('.st-le-h') }));
  ok(/held/.test(held.text) && /held/.test(held.cls) && !held.handle, 'the rule-held mark is shown as held, with no resize handle (' + held.text.trim() + ')');
  // resizing the mark by the corner is not offered; its proportions are kept by the editor when its box is typed in
  await page.click(R + '.st-le-layer[aria-label="Layer logo"]');
  eq(await page.$(R + 'input[aria-label="Width, per cent of the stage"]'), null, 'a held mark has no position fields either');
  // unsaved edits: nudge the headline, the header names the unsaved layout, Cancel asks
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.keyboard.press('ArrowDown'); await page.waitForTimeout(150);
  ok(await page.$(R + '.st-le-dirty'), 'the editor says the layout has unsaved changes');
  const headTxt = await page.textContent(R + '.st-head'); ok(/Unsaved layout/.test(headTxt), 'the header says so too: ' + headTxt.replace(/\s+/g, ' ').slice(0, 120));
  await page.click(R + '.st-le-wrap .btn:has-text("Cancel")'); await page.waitForTimeout(150);
  ok(await page.$(R + '.st-le-wrap'), 'Cancel with unsaved changes asked, and the dismissed dialog kept the editor open');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
await T.t('Fix layout reports an outcome (complete, partial or blocked), offers an undo, and is bounded: a second press with nothing left to fix saves no version', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fixme', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'fx1' });
  const a0 = await api('POST', '/studio/asset', { project: pr.id, family: 'Set', channel: 'instagram', format: '1:1', title: 'Overflow tile', copy: { headline: 'A new tax on the people who grow our food and keep regional Australia moving', support: 'Not a subsidy.', cta: 'Sign' }, mode: 'composition' });
  const L = JSON.parse(JSON.stringify(a0.asset.versions[0].layout)); const hl = L.layers.find(l => l.role === 'headline'); hl.h = 4; L.noImagery = true; L.regions = [];
  await api('POST', '/studio/version', { asset: a0.asset.id, layout: L, kind: 'layout', note: 'a headline box too small for its words' });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Fixme") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.waitForSelector(R + '.st-readystrip .btn:has-text("Fix layout")', { timeout: 30000 });
  const n0 = (await api('GET', '/studio/get?id=' + pr.id)).assets[0].versions.length;
  await page.click(R + '.st-readystrip .btn:has-text("Fix layout")'); await page.waitForSelector(R + '.st-repair-note', { timeout: 30000 });
  const note = await page.textContent(R + '.st-repair-note'); ok(/^(Fixed|Partly fixed|Blocked)/.test(note.trim()), 'the outcome is named first: ' + note.replace(/\s+/g, ' ').slice(0, 160));
  ok(/\d+ blocking before/.test(note) && /after/.test(note), 'before and after counts are given: ' + note.replace(/\s+/g, ' ').slice(0, 200));
  const n1 = (await api('GET', '/studio/get?id=' + pr.id)).assets[0].versions.length; eq(n1, n0 + 1, 'one layout version was saved');
  ok(await page.$(R + '.st-repair-note button:has-text("Undo fix")'), 'the fix can be undone');
  // a second press when the layout no longer has a layout issue saves nothing
  await page.waitForFunction(() => !/measuring/.test((document.querySelector('#studio-root .st-readystrip') || {}).textContent || ''), null, { timeout: 30000 });
  const fixBtn = await page.$(R + '.st-readystrip .btn:has-text("Fix layout")');
  if (fixBtn) { await fixBtn.click(); await page.waitForTimeout(1500); }
  const n2 = (await api('GET', '/studio/get?id=' + pr.id)).assets[0].versions.length; eq(n2, n1, 'no second version: the repair is bounded');
  // Undo fix restores the layout before the repair as a new version that says so
  await page.click(R + '.st-repair-note button:has-text("Undo fix")'); await page.waitForTimeout(1200);
  const d = await api('GET', '/studio/get?id=' + pr.id); const vs = d.assets[0].versions; eq(vs.length, n1 + 1, 'the undo is its own version');
  ok(/undid the layout fix|restored/.test(vs[vs.length - 1].note), vs[vs.length - 1].note); eq(vs[vs.length - 1].layout.layers.find(l => l.role === 'headline').h, 4, 'the layout before the fix is back');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
