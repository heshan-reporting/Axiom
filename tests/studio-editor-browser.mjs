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
  const box = await page.$eval(R + '.st-le', el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  const h = await page.$(R + '.st-le-layer[aria-label="Layer headline"]'); const hb = await h.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down(); await page.mouse.move(hb.x + hb.width / 2 + box.w * 0.1, hb.y + hb.height / 2, { steps: 4 }); await page.mouse.up(); await page.waitForTimeout(200);
  const xField = await page.inputValue(R + 'input[aria-label="X, per cent of the stage"]');
  ok(Math.abs(parseFloat(xField) - (hl.x + 10)) < 1.5, 'dragging the ink moved the layer 10% (x ' + hl.x + ' -> ' + xField + ')');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
