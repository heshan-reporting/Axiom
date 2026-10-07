/* S20: correctness first. Each case was written to fail on the S19 build (c51d813) before the fix.
 *   A  a suggestion applied for one asset was sent with whatever target the composer held ("the whole set"), and no asset
 *   B  editing while a save was pending: the late acknowledgement of A cleared the newer edit B from the canvas, the working
 *      store and the server draft, and the header said "Version saved"
 * Real Chromium against the worker module in this process (providers MOCKED; nothing spent).
 * Run: node --experimental-sqlite tests/studio-s20-browser.mjs */
import { makeStudio, runner, eq, ok, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: 8877, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s20-browser (scope-bound Director actions, saves bound to their snapshot; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PA = (await seedStages(fx, { only: ['design'], prefix: 'S20 A' })).design;
const PB = (await seedStages(fx, { only: ['design'], prefix: 'S20 B' })).design;
const PC = (await seedStages(fx, { only: ['design'], prefix: 'S20 C' })).design;
const PD = (await seedStages(fx, { only: ['design'], prefix: 'S20 D' })).design;
const PE = (await seedStages(fx, { only: ['design'], prefix: 'S20 E' })).design;
const assets = async P => (await api('GET', '/studio/get?id=' + P)).assets.filter(a => a.versions && a.versions.length);
const cur = a => a.versions.find(v => v.id === a.current) || a.versions[a.versions.length - 1];
let page;
async function openDesign(title) {
  page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true }); page.on('dialog', d => d.accept());
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  const asset = page.locator(R + '.st-assetpick').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(500);
}
const typeHeadline = async words => { await page.dblclick(R + '.st-le-layer[aria-label="Layer headline"]'); await page.waitForSelector(R + '.st-le-textedit'); await page.fill(R + '.st-le-textedit', words); await page.keyboard.press('Control+Enter'); await page.waitForSelector(R + '.st-le-textedit', { state: 'detached' }); };
const shownHeadline = () => page.evaluate(() => (document.querySelector('#studio-root .st-le-layer[aria-label="Layer headline"]') || {}).getAttribute ? document.querySelector('#studio-root .st-le-layer[aria-label="Layer headline"]').getAttribute('aria-description') || '' : '');
const jobsPosted = () => fx.seen.filter(x => x.method === 'POST' && x.path === '/studio/job').map(x => { try { return JSON.parse(x.body); } catch (e) { return {}; } });

await T.t('A. applying a suggestion made for this asset sends exactly that asset, whatever the composer target was set to', async () => {
  await openDesign('S20 A at design');
  const A = (await assets(PA))[0];
  await place(page, 'creative director');
  await page.selectOption(R + '.st-composer select[aria-label="Target of the direction"]', 'set'); await sleep(150);
  await page.click(R + '.st-cd-tab:has-text("Ideas"), ' + R + '.st-cd-tab:has-text("Explore")');
  const ask = page.locator(R + 'button:has-text("Suggest for this version")'); if (await ask.count()) await ask.first().click();
  await page.waitForSelector(R + '.st-sugg-item', { timeout: 15000 });
  const n0 = jobsPosted().length;
  await page.locator(R + '.st-sugg-item button:has-text("apply")').first().click();
  for (let i = 0; i < 40 && jobsPosted().length === n0; i++) await sleep(100);
  const j = jobsPosted().slice(n0).find(b => b.stage === 'revise'); ok(j, 'a revise job was posted');
  eq([j.input.target, j.input.asset], ['asset', A.id], 'the job names the asset the suggestion was for: ' + JSON.stringify(j.input));
  eq(j.input.version || j.input.baseVersion || j.input.base, A.current, 'and the version it was made against');
  // the composer's own target is left as the person set it
  eq(await page.inputValue(R + '.st-composer select[aria-label="Target of the direction"]'), 'set', 'the composer target is not silently changed');
});

await T.t('B. editing while a save is pending: the late acknowledgement of A keeps B on the canvas, in the working store and in the server draft, rebased onto the version A made', async () => {
  await page.ctxB.close(); await openDesign('S20 B at design');
  const A0 = (await assets(PB))[0]; const n0 = A0.versions.length;
  await typeHeadline('Words A');
  const release = fx.hold(/^\/studio\/version$/);
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")'); await sleep(400);
  await typeHeadline('Words B');
  // B's recovery draft reaches the server while A is still held
  for (let i = 0; i < 60; i++) { const d = (await api('GET', '/studio/draft?asset=' + A0.id)).draft; if (d && d.copy && d.copy.headline === 'Words B') break; await sleep(150); }
  release(); await sleep(2500);
  const A1 = (await assets(PB))[0];
  eq(A1.versions.length, n0 + 1, 'A was saved as one version'); eq(cur(A1).copy.headline, 'Words A', 'the version holds A');
  const shown = await page.evaluate(() => document.querySelector('#studio-root .st-le-layer[aria-label="Layer headline"]').getAttribute('aria-description') || '');
  ok(/Words B/.test(shown), 'B is still on the canvas: ' + shown);
  const work = await page.evaluate(id => { const w = window.STWork && window.STWork.get(id); return w ? { base: w.base, h: w.layout && w.layout._copy && w.layout._copy.headline } : null; }, A0.id);
  ok(work && work.h === 'Words B' && work.base === A1.current, 'the working store holds B on the new version: ' + JSON.stringify(work));
  const d = (await api('GET', '/studio/draft?asset=' + A0.id)).draft;
  ok(d && d.copy && d.copy.headline === 'Words B', 'the server draft still holds B: ' + JSON.stringify(d && d.copy));
  const word = await page.textContent(R + '.st-head .st-save');
  ok(!/^\s*Version saved\s*$/.test(word), 'the header does not claim everything is saved while B is not: ' + word);
});

await T.t('A2. the composer\'s own targets keep their scope: a family direction names the family\'s asset, the whole set names no asset; a repeated click sends once', async () => {
  await page.ctxB.close(); await openDesign('S20 A at design');
  const A = (await assets(PA))[0];
  await place(page, 'creative director');
  const n0 = jobsPosted().length;
  await page.fill(R + '.st-composer textarea', 'Make the support line plainer');
  const fam = await page.$$eval(R + '.st-composer select[aria-label="Target of the direction"] option', os => os.map(o => o.value));
  const tgt = fam.indexOf('family') >= 0 ? 'family' : 'set';
  await page.selectOption(R + '.st-composer select[aria-label="Target of the direction"]', tgt);
  await page.click(R + '.st-composer-acts .btn:has-text("Send")'); await page.click(R + '.st-composer-acts .btn').catch(() => {});
  for (let i = 0; i < 40 && jobsPosted().length === n0; i++) await sleep(100); await sleep(600);
  const sent = jobsPosted().slice(n0).filter(b => b.stage === 'revise'); eq(sent.length, 1, 'one job for one send, however many clicks');
  eq(sent[0].input.target, tgt); if (tgt === 'family') eq(sent[0].input.asset, A.id); else ok(!sent[0].input.asset, 'the whole set names no asset');
});

await T.t('A3. a suggestion made for an earlier version is not applied to newer artwork: it says why and sends nothing', async () => {
  const A = (await assets(PA))[0];
  await page.click(R + '.st-cd-tab:has-text("Ideas"), ' + R + '.st-cd-tab:has-text("Explore")');
  const ask = page.locator(R + 'button:has-text("Suggest for this version")'); if (await ask.count()) await ask.first().click();
  await page.waitForSelector(R + '.st-sugg-item', { timeout: 15000 });
  // the asset moves on (someone else's edit) while the suggestion is on screen
  const v = cur(A); await api('POST', '/studio/version', { asset: A.id, layout: v.layout, copy: Object.assign({}, v.copy, { caption: 'A newer caption from elsewhere' }), kind: 'text', note: 'elsewhere' });
  const n0 = jobsPosted().length;
  const apply = page.locator(R + '.st-sugg-item button:has-text("apply")');
  if (await apply.count()) { await apply.first().click(); await sleep(800); }
  const sent = jobsPosted().slice(n0).filter(b => b.stage === 'revise');
  eq(sent.length, 0, 'nothing is sent for the old version');
  ok(await page.locator(R + ':text("made for an earlier version")').count(), 'and it says why');
});

await T.t('B2. a save that fails while newer edits exist keeps both: the newer edit stays on the canvas and in the draft, and the header says the save failed', async () => {
  await page.ctxB.close(); await openDesign('S20 C at design');
  const A0 = (await assets(PC))[0]; const n0 = A0.versions.length;
  await typeHeadline('Words A');
  const release = fx.hold(/^\/studio\/version$/); const f = fx.failNext(/^\/studio\/version$/, 500, { error: 'internal_error', detail: 'simulated' });
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")'); await sleep(400);
  await typeHeadline('Words B'); release(); await sleep(2500);
  eq(f.hit, 1); eq((await assets(PC))[0].versions.length, n0, 'nothing written');
  ok(/Words B/.test(await shownHeadline()), 'B is on the canvas');
  for (let i = 0; i < 30; i++) { const d = (await api('GET', '/studio/draft?asset=' + A0.id)).draft; if (d && d.copy && d.copy.headline === 'Words B') break; await sleep(200); }
  eq(((await api('GET', '/studio/draft?asset=' + A0.id)).draft || { copy: {} }).copy.headline, 'Words B', 'the draft holds B');
  ok(/Save failed|Not saved/.test(await page.textContent(R + '.st-head .st-save')), 'the header says the save failed');
});

await T.t('B3. reloading the page while a save is out: once the version lands, the newer edit made during the save comes back on top of it', async () => {
  await page.ctxB.close(); await openDesign('S20 D at design');
  const A0 = (await assets(PD))[0];
  await typeHeadline('Words A');
  const release = fx.hold(/^\/studio\/version$/);
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")'); await sleep(400);
  await typeHeadline('Words B'); await sleep(400);
  await page.evaluate(() => { try { window.dispatchEvent(new Event('pagehide')); } catch (e) {} });
  const dbg = async l => console.log('       ' + l + ' ' + JSON.stringify(await page.evaluate(id => { const w = window.STWork && window.STWork.get(id); return w ? { base: w.base, h: w.layout && w.layout._copy && w.layout._copy.headline, pending: !!w.pending, ps: w.pending && w.pending.snap && w.pending.snap.copy && w.pending.snap.copy.headline } : null; }, A0.id)));
  await dbg('before reload');
  await page.reload({ waitUntil: 'domcontentloaded' }); await sleep(1500); await dbg('after reload');
  const w = await page.evaluate(id => { const w = window.STWork && window.STWork.get(id); return w && w.pending && w.pending.snap && w.pending.snap.copy.headline; }, A0.id);
  eq(w, 'Words A', 'a save cut off by the reload keeps its snapshot named (its outcome is unknown)');
  release(); await sleep(1500);
  await page.waitForFunction(() => typeof go === 'function' && typeof studioInit === 'function'); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  if (!(await page.$(R + '.st-step.on:has(.st-step-l:text-is("Design"))'))) await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(1000);
  const A1 = (await assets(PD))[0]; eq(cur(A1).copy.headline, 'Words A', 'A was saved');
  ok(/Words B/.test(await shownHeadline()), 'B is back on the canvas after the reload: ' + await shownHeadline());
});

await T.t('B4. switching to another asset while a save is out: the save lands on the first asset only, the edit made before switching comes back on top of it, the other asset is untouched', async () => {
  await page.ctxB.close(); await openDesign('S20 E at design');
  const [A0, O0] = await assets(PE); const oN = O0.versions.length;
  // the editor opened on the first page chip; find which asset that is from the chip order
  await typeHeadline('Words A');
  const release = fx.hold(/^\/studio\/version$/);
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")'); await sleep(400);
  await typeHeadline('Words B'); await sleep(400);
  const chips = page.locator(R + '.st-pagechip'); ok(await chips.count() >= 2, 'two pages to switch between');
  await chips.nth(1).click(); await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(300);
  release(); await sleep(2000);
  const after = await assets(PE); const first = after.find(x => cur(x).copy.headline === 'Words A'); ok(first, 'A was saved on one asset');
  const other = after.find(x => x.id !== first.id); eq(other.versions.length, other.id === O0.id ? oN : A0.versions.length, 'the other asset has no new version');
  await chips.nth(0).click(); await sleep(1200);
  ok(/Words B/.test(await shownHeadline()), 'B is on the canvas of the first asset, on top of A: ' + await shownHeadline());
  const work = await page.evaluate(id => { const w = window.STWork && window.STWork.get(id); return w ? { base: w.base, h: w.layout && w.layout._copy && w.layout._copy.headline } : null; }, first.id);
  ok(work && work.base === first.current && work.h === 'Words B', 'the working store holds B on the saved version: ' + JSON.stringify(work));
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
