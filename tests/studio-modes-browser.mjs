/* The two creation modes in the page (S2), in real Chromium against the worker module in this process; providers MOCKED.
 * A project made in the Gemini Finished Creative mode produces one bitmap: the page labels it, shows nothing draggable or
 * retypable over it, offers Regenerate and Switch to Editable instead of the layout tools, keeps caption and alt text
 * editable, and the Review stage says design approval waits for the words and the mark to be read back. Switching to
 * Editable derives a new asset with live layers and leaves the finished original as it is.
 * Run: node --experimental-sqlite tests/studio-modes-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8795 });
const { api, env } = fx;
const R = '#studio-root ';
const T = runner('studio-modes-browser (Editable Studio and Gemini Finished Creative in the page; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const latest = async ns => env.MIND_DB.db.prepare('SELECT id, title FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns);
async function settle(pid, ms = 90000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle: ' + JSON.stringify((d.jobs || []).map(j => j.stage + ':' + j.state))); await sleep(300); } }

let page, pid, aid;
await T.t('the intake offers the creation mode before anything is generated, explains both, and the choice travels with the project', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await page.click(R + '.st-lib-head .btn:has-text("New project")'); await page.waitForSelector(R + '.st-intake');
  ok(await page.$(R + '.st-modes .st-segbtn.on:has-text("Editable Studio")'), 'editable is the default');
  const note0 = await page.textContent(R + '.st-mode-note'); ok(/live layers/.test(note0) && /never redrawn/.test(note0), note0);
  await page.click(R + '.st-modes .st-segbtn:has-text("Gemini Finished Creative")');
  const note1 = await page.textContent(R + '.st-mode-note'); ok(/paints the whole piece/.test(note1) && /nothing is composed over it/.test(note1) && /never guaranteed/.test(note1), note1);
  await page.click(R + '.st-segbtn:has-text("A brief or one line")'); await page.click(R + '.st-segbtn:has-text("Visual creative")');
  await page.fill(R + '.st-intake textarea', 'Write one Instagram tile on the $74 billion figure');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-head .st-chip:has-text("Finished creative")', { timeout: 30000 });
  const row = await latest('mca'); pid = row.id;
  const d = await settle(pid); eq(d.brief.creationMode, 'finished'); eq(d.assets.length, 1); aid = d.assets[0].id;
  const v = d.assets[0].versions[d.assets[0].versions.length - 1]; eq(v.mode, 'finished', 'the version is a finished bitmap'); eq(v.layout.layers, []); ok(v.image && v.image.key, 'the bitmap landed'); ok(v.layout.baked.indexOf('logo') >= 0, 'the MCA logo (the kit policy here) was painted from its file: ' + v.layout.baked.join(','));
  const rj = d.jobs.find(j => j.stage === 'render'); eq(rj.input.finished, true); eq(rj.input.marks.map(m => m.role), ['logo']);
});
await T.t('the asset view shows one bitmap labelled as such: no layout editor, no draggable layers, painted words read-only, caption editable, Regenerate and Switch to Editable offered', async () => {
  await page.click(R + '.st-railbtn.asset'); await page.waitForSelector(R + '.st-finnote');
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
await T.t('the Review stage says design approval waits for the painted words and the mark to be read back; Quality says the technical validation does not apply', async () => {
  await page.click(R + '.st-instab:has-text("Quality")');
  const q = await page.textContent(R + '#st-tab-quality'); ok(/technical validation does not apply/.test(q) && /not applicable/.test(q) && /not verified/.test(q), q.slice(0, 400));
  await page.click(R + '.st-step:has-text("Review")'); await page.waitForSelector(R + '.st-approvals');
  const row = await page.textContent(R + '.st-approvals tbody tr');
  ok(/finished creative/.test(row) && /not read back/.test(row), row);
  const t = await page.getAttribute(R + '.st-approvals .st-apcell button:has-text("Approve design")', 'title'); ok(/read the painted words and the mark back/.test(t || ''), t);
  ok(await page.isDisabled(R + '.st-approvals .st-apcell button:has-text("Approve design")'), 'design approval is blocked until the reading');
});
await T.t('Regenerate opens a form for the painted words and a direction, states the cost, and queues one finished render; Switch to Editable derives a live-layer asset and leaves the original', async () => {
  await page.click(R + '.st-step:has-text("Refine")'); await page.waitForSelector(R + '.st-finished');
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
  await page.waitForSelector(R + '.st-asset-acts .btn:has-text("Edit layout")', { timeout: 20000 });
  const d2 = await api('GET', '/studio/get?id=' + pid); eq(d2.assets.length, n0 + 1);
  const der = d2.assets.find(x => x.family === 'Editable from finished'); ok(der, 'the derived asset is in its own family'); const dv = der.versions[der.versions.length - 1];
  eq(dv.mode, 'composition'); ok(dv.layout.layers.some(l => l.type === 'text' && l.role === 'headline'), 'live type again'); ok(dv.layout.layers.some(l => l.role === 'logo'), 'the mark placed from its file'); eq(dv.image, null);
  eq(d2.assets.find(x => x.id === aid).versions.slice(-1)[0].mode, 'finished', 'the original is untouched');
  eq(await page.$(R + '.st-finnote'), null, 'the derived asset shows no finished note');
  const notice = await page.textContent(R + '.st-notice'); ok(/Derived an editable asset/.test(notice) && /not reused as the ground/.test(notice), notice);
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
