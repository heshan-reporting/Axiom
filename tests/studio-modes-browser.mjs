/* The two creation modes in the page (S2), in real Chromium against the worker module in this process; providers MOCKED.
 * Since S17 the mode is chosen in Design once the words are ready (Editable creative or Full AI creative). A piece produced
 * as Full AI creative is one bitmap: the page labels it, shows nothing draggable or
 * retypable over it, offers Regenerate and Switch to Editable instead of the layout tools, keeps caption and alt text
 * editable, and the Review stage says design approval waits for the words and the mark to be read back. Switching to
 * Editable derives a new asset with live layers and leaves the finished original as it is.
 * Run: node --experimental-sqlite tests/studio-modes-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { wizardCreate, toDirections, selectDirection, generateCopy, markCopyReady } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8795 });
const { api, env } = fx;
const R = '#studio-root ';
const T = runner('studio-modes-browser (Editable Studio and Gemini Finished Creative in the page; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const latest = async ns => env.MIND_DB.db.prepare('SELECT id, title FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns);
async function settle(pid, ms = 90000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle: ' + JSON.stringify((d.jobs || []).map(j => j.stage + ':' + j.state))); await sleep(300); } }

let page, pid, aid;
await T.t('the production mode is chosen in Design once the words are ready: both explained before anything runs; Full AI creative paints one bitmap with the mark from its file, and the header names the mode', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await wizardCreate(page, { type: 'Social Content', deliverable: 'visual', text: 'Write one Instagram tile on the $74 billion figure: mining paid more company tax and royalties than any other industry in 2023-24.' });
  ok(/mode: chosen in Design/.test(await page.textContent(R + '.st-head')), 'the header says the mode is not decided yet');
  await toDirections(page); await selectDirection(page, 0); await generateCopy(page); await markCopyReady(page);
  await page.click(R + '.st-stagehead button:has-text("Continue to Design")'); await page.waitForSelector(R + '.st-pmodes');
  const ed = await page.textContent(R + '.st-pmode:has-text("Editable creative")'); ok(/live layers/.test(ed) && /editable/.test(ed), ed);
  const fa = await page.textContent(R + '.st-pmode:has-text("Full AI creative")'); ok(/paints the whole piece/.test(fa) && /not editable as layers/.test(fa), fa);
  await page.click(R + '.st-pmode:has-text("Full AI creative")');
  await page.click(R + '.st-pmodes .st-stepbar button:has-text("Generate 1 piece")');
  const row = await latest('mca'); pid = row.id;
  await page.waitForSelector(R + '.st-head .st-chip:has-text("Finished creative")', { timeout: 30000 });
  const d = await settle(pid); eq((d.brief.production || {}).mode, 'finished'); eq(d.assets.length, 1); aid = d.assets[0].id;
  const v = d.assets[0].versions[d.assets[0].versions.length - 1]; eq(v.mode, 'finished', 'the version is a finished bitmap'); eq(v.layout.layers, []); ok(v.image && v.image.key, 'the bitmap landed'); ok(v.layout.baked.indexOf('logo') >= 0, 'the MCA logo (the kit policy here) was painted from its file: ' + v.layout.baked.join(','));
  const rj = d.jobs.find(j => j.stage === 'render'); eq(rj.input.finished, true); eq(rj.input.marks.map(m => m.role), ['logo']);
});
await T.t('the asset view shows one bitmap labelled as such: no layout editor, no draggable layers, painted words read-only, caption editable, Regenerate and Switch to Editable offered', async () => {
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await page.click(R + '.st-railbtn.asset'); await page.waitForSelector(R + '.st-finnote');
  const note = await page.textContent(R + '.st-finnote'); ok(/Gemini Finished Creative/.test(note) && /one bitmap/.test(note) && /Nothing is composed over it/.test(note), note);
  eq(await page.$(R + '.st-asset-acts .btn:has-text("Edit layout")'), null, 'no layout editor on a bitmap');
  const tag = await page.textContent(R + '.st-comp-tag'); ok(/finished creative: one bitmap/.test(tag) && /nothing composed over it/.test(tag), tag);
  eq(await page.$(R + '.st-readystrip'), null, 'no technical validation strip: there is nothing to measure');
  eq(await page.$(R + '.st-ad'), null, 'no art direction concepts on a bitmap (they would propose layouts)');
  ok(await page.isDisabled(R + '#st-f-headline'), 'the headline field is read-only'); ok(await page.$(R + '.st-field:has(#st-f-headline) .st-chip:has-text("in the artwork")'), 'and says why');
  ok(!(await page.isDisabled(R + '#st-f-caption')), 'the caption stays editable');
  const fin = await page.textContent(R + '.st-finished'); ok(/Finished creative/.test(fin) && /not read back yet/.test(fin) && /Technical validation does not apply/.test(fin), fin);
  ok(await page.$(R + '.st-finished .btn:has-text("Regenerate (1 render)")'), 'Regenerate offered'); ok(await page.$(R + '.st-finished .btn:has-text("Switch to Editable (free)")'), 'Switch to Editable offered');
  // a caption edit is a version of the same bitmap
  const before = (await api('GET', '/studio/get?id=' + pid)).assets[0].versions.length;
  await page.fill(R + '#st-f-caption', 'A caption written beside the finished tile.'); await page.press(R + '#st-f-caption', 'Tab');
  for (let i = 0; i < 30; i++) { const a = (await api('GET', '/studio/get?id=' + pid)).assets[0]; if (a.versions.length > before) break; await sleep(200); }
  const a = (await api('GET', '/studio/get?id=' + pid)).assets[0]; const v = a.versions[a.versions.length - 1];
  eq([a.versions.length, v.mode, v.copy.caption], [before + 1, 'finished', 'A caption written beside the finished tile.']); eq(v.image.key, a.versions[before - 1].image.key, 'the same bitmap');
});
await T.t('Review waits for the painted words and the mark to be read back, and says so; the worker refuses the design approval until then; Quality says the technical validation does not apply', async () => {
  await page.click(R + '.st-instab:has-text("Quality")');
  const q = await page.textContent(R + '#st-tab-quality'); ok(/technical validation does not apply/.test(q) && /not applicable/.test(q) && /not verified/.test(q), q.slice(0, 400));
  // the caption edit was a copy change: mark the words ready again
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await page.waitForSelector(R + '.st-ready-check input:not([disabled])');
  if (!(await page.isChecked(R + '.st-ready-check input'))) { await page.click(R + '.st-ready-check input'); await page.waitForFunction(() => /Ready for design/.test(document.querySelector('#studio-root .st-copy-badge').textContent), null, { timeout: 15000 }); }
  const d = await api('GET', '/studio/get?id=' + pid);
  ok(d.assets[0].readiness && d.assets[0].readiness.baked && !d.assets[0].readiness.baked.verified, 'the painted words have not been read back');
  eq(d.workflow.steps.review.state, 'locked'); ok(/read the painted words and the mark back/.test(d.workflow.steps.review.need || ''), 'the lock names the read-back: ' + d.workflow.steps.review.need);
  await page.click(R + '.st-step:has(.st-step-l:text-is("Review"))'); await page.waitForSelector(R + '.st-locked, ' + R + '.st-lockedstage, ' + R + '[data-locked]', { timeout: 15000 }).catch(() => null);
  ok(/read the painted words and the mark back/.test(await page.textContent(R + '.st-centre')), 'the page says what unlocks Review');
  const ap = await api('POST', '/studio/approve', { asset: aid, part: 'design', decision: 'approve', reason: 'looks right to us' });
  eq(ap._status, 409); ok(/baked_text_unverified/.test(ap.error || ''), 'the worker refuses the design approval: ' + JSON.stringify(ap).slice(0, 200));
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
});
await T.t('Regenerate opens a form for the painted words and a direction, states the cost, and queues one finished render; Switch to Editable derives a live-layer asset and leaves the original', async () => {
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await page.waitForSelector(R + '.st-finished');
  await page.click(R + '.st-finished .btn:has-text("Regenerate (1 render)")'); await page.waitForSelector(R + '.st-regen');
  ok(await page.$(R + '.st-regen #st-rg-headline'), 'the painted headline is offered for regeneration');
  await page.fill(R + '.st-regen #st-rg-ins', 'warmer light');
  const g0 = fx.calls.gemini;
  await page.click(R + '.st-regen .btn:has-text("Regenerate now")');
  const d = await settle(pid); ok(fx.calls.gemini > g0, 'one image generation ran'); const a = d.assets.find(x => x.id === aid); const v = a.versions[a.versions.length - 1];
  eq(v.mode, 'finished'); eq(v.layout.layers, []); ok(/regenerated/.test(v.note), v.note);
  ok(d.thread.some(e => e.kind === 'regenerate' && /Regenerating/.test(e.text)), 'the thread records the regeneration');
  // switch to editable
  await page.waitForSelector(R + '.st-finished .btn:has-text("Switch to Editable (free)")');
  const n0 = d.assets.length;
  await page.click(R + '.st-finished .btn:has-text("Switch to Editable (free)")');
  // nothing moves the team: the notice offers the derived asset
  await page.waitForSelector(R + '.st-notice button:has-text("Open the editable copy")', { timeout: 20000 });
  const notice = await page.textContent(R + '.st-notice'); ok(/Derived an editable asset/.test(notice) && /not reused as the ground/.test(notice), notice);
  await page.click(R + '.st-notice button:has-text("Open the editable copy")');
  await page.waitForSelector(R + '.st-asset-acts .btn:has-text("Edit layout")', { timeout: 20000 });
  const d2 = await api('GET', '/studio/get?id=' + pid); eq(d2.assets.length, n0 + 1);
  const der = d2.assets.find(x => x.family === 'Editable from finished'); ok(der, 'the derived asset is in its own family'); const dv = der.versions[der.versions.length - 1];
  eq(dv.mode, 'composition'); ok(dv.layout.layers.some(l => l.type === 'text' && l.role === 'headline'), 'live type again'); ok(dv.layout.layers.some(l => l.role === 'logo'), 'the mark placed from its file'); eq(dv.image, null);
  eq(d2.assets.find(x => x.id === aid).versions.slice(-1)[0].mode, 'finished', 'the original is untouched');
  eq(await page.$(R + '.st-finnote'), null, 'the derived asset shows no finished note');
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
