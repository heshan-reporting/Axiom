/* The Creative Studio workspace, journey by journey, in real Chromium against the worker module in this process
 * (SQLite behind the D1 API; stub Claude and Gemini that can be switched to fail; see studio-fixture.mjs).
 * MOCKED PROVIDERS: these journeys prove the page, its wiring and the worker agree - not what a live model answers.
 *   1. create -> client -> brief -> direction -> produce -> refine -> review -> export (the zip unpacked, each PNG checked)
 *   2. save, reload and resume (the project, the stage, the asset, and unsaved brief edits)
 *   3. switch clients with no carried-over context (and a slow answer for the old client dropped)
 *   4. a no-imagery composition: complete, validated, nothing rendered
 *   5. adapt across formats without overflow or clipping
 *   6. provider failure and retry without losing work or duplicating a job; a missing key stated honestly
 *   7. a rapid edit while an earlier save is still running
 *   8. the essential workflow by keyboard
 *   9. imagery remedies, measured layout variations, and an Art Director review on request
 * Run: node --experimental-sqlite tests/studio-journey-browser.mjs     (SHOT=1 writes tests/shots/journey-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, pngSize, unzipStored } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8792 });
const { api, calls, env } = fx;
const R = '#studio-root ';
const T = runner('studio-journey-browser (the workspace, end to end; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 'journey-' + name + '.png' }); };
const goStep = (pg, name) => pg.click(R + '.st-step:has-text("' + name + '")');
const itab = (pg, name) => pg.click(R + '.st-instab:has-text("' + name + '")');
const latest = async ns => env.MIND_DB.db.prepare('SELECT id, title FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns);
/* wait until the project has nothing queued or running (the page steps its jobs while it is open) */
async function settle(pid, ms = 90000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle: ' + JSON.stringify((d.jobs || []).map(j => j.stage + ':' + j.state))); await sleep(300); } }
/* open one asset in Refine and wait for its measurement to be filed and passing */
async function validated(page, title) {
  await page.click(R + '.st-railbtn.asset:has-text("' + title + '")');
  await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
}
async function approveAll(page) {
  await goStep(page, 'Review'); await page.waitForSelector(R + '.st-approvals');
  for (;;) {
    const btn = await page.$(R + '.st-approvals button:has-text("Approve"):not([disabled])'); if (!btn) break;
    await btn.click(); await page.waitForSelector(R + '.st-dialog textarea'); await page.fill(R + '.st-dialog textarea', 'Agreed with the client on the call');
    await page.click(R + '.st-dialog button:has-text("Record")'); await page.waitForSelector(R + '.st-dialog', { state: 'detached' }); await sleep(250);
  }
}
let J1 = null;

/* ---------------------------------------------------------------------------------------------------- 1 */
await T.t('1. create, choose the client, brief, choose a direction, produce, refine, review and export: the bundle holds exactly the approved versions at their native size', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-first');
  ok(/No projects yet for Minerals Council of Australia/.test(await page.textContent(R + '.st-first')), 'the first-use state explains a project and offers three starts');
  eq(await page.inputValue(R + '.st-head select'), 'mca', 'the client is chosen in the context bar');
  await shot(page, 'first-use');
  await page.click(R + '.st-first-btn:has-text("A brief or one line")');
  await page.waitForSelector(R + '.st-intake'); ok(await page.$(R + '.st-segbtn.on:has-text("A brief or one line")'), 'the start chosen on the empty state carries into the intake');
  eq(await page.inputValue(R + '.st-intake select'), 'hoof', 'the campaign comes from the client kit');
  await page.fill(R + '.st-intake textarea', 'Something for regional voters about fuel tax credits');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-dir', { timeout: 30000 });
  ok(/Fuel|regional/.test(await page.textContent(R + '.st-head .st-ptitle')) && /Hands Off Our Fuel/.test(await page.textContent(R + '.st-head')), 'project and campaign in the context bar');
  ok(await page.$(R + '.st-step.on:has-text("Directions")'), 'the navigator is on Directions');
  eq(await page.$$eval(R + '.st-railbtn.asset', x => x.length), 0, 'nothing produced before a choice');
  // the brief: an edit is unsaved until saved, and the state says so
  await goStep(page, 'Brief'); await page.waitForSelector(R + '#brief-audience');
  await page.fill(R + '#brief-audience', 'Regional voters, farmers and tradies');
  await page.waitForSelector(R + '.st-dirty'); ok(/Unsaved changes/.test(await page.textContent(R + '.st-stagehead')));
  await page.click(R + '.st-stagehead .btn:has-text("Save brief")'); await page.waitForFunction(() => !document.querySelector('#studio-root .st-dirty'));
  const pr = await latest('mca'); J1 = pr.id;
  eq((await api('GET', '/studio/get?id=' + pr.id)).brief.audience, 'Regional voters, farmers and tradies', 'the brief edit reached this project');
  await shot(page, 'brief');
  // the direction decides what production makes
  await goStep(page, 'Directions'); await page.waitForSelector(R + '.st-dir');
  const g0 = calls.gemini;
  await page.click(R + '.st-dir:nth-child(2) button:has-text("Choose this direction")');
  await page.waitForSelector(R + '.st-asset', { timeout: 30000 });
  let d = await settle(pr.id);
  eq(d.assets.length, 3, 'one asset per channel in the brief');
  ok(d.assets.every(a => /from "Who it really is"/.test(a.versions[0].note)), 'every asset was made from the chosen direction: ' + d.assets.map(a => a.versions[0].note).join(' | '));
  ok(calls.gemini - g0 >= 3, 'the background renders ran as jobs');
  ok(await page.$(R + '.st-step.on:has-text("Refine")'), 'production lands on Refine');
  // refine: a headline edit on the selected asset becomes a text version of that asset only, and is measured again
  const first = d.assets[0]; await page.click(R + '.st-railbtn.asset:has-text("' + first.title + '")'); await page.waitForSelector(R + '#st-f-headline');
  const n0 = d.assets.map(a => a.versions.length);
  await page.fill(R + '#st-f-headline', 'Not a subsidy. Your tractor uses it too.');
  await page.waitForFunction(() => /All changes saved/.test(document.querySelector('#studio-root .st-save').textContent), null, { timeout: 15000 });
  d = await api('GET', '/studio/get?id=' + pr.id);
  eq(d.assets.map(a => a.versions.length), n0.map((n, i) => i === 0 ? n + 1 : n), 'one new version, on the selected asset only');
  const cur0 = d.assets[0].versions.find(v => v.id === d.assets[0].current);
  eq([cur0.copy.headline, cur0.kind], ['Not a subsidy. Your tractor uses it too.', 'text']);
  for (const a of d.assets) await validated(page, a.title);
  await shot(page, 'refine');
  // review: approvals name the exact version
  await approveAll(page);
  d = await api('GET', '/studio/get?id=' + pr.id);
  ok(d.assets.every(a => a.approvals.copy && a.approvals.design && a.approvals.copy.version === a.current && a.approvals.design.version === a.current), 'both approvals stand on each current version');
  ok(await page.$(R + '.st-step.done:has-text("Review")'), 'the navigator marks Review done');
  await shot(page, 'review');
  // export: the download is unpacked and every PNG checked against its version's stage size
  await goStep(page, 'Export'); await page.waitForSelector(R + '.st-exportstage');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(R + '.st-exportstage .st-stagehead button:has-text("Prepare bundle")')]);
  const zip = fs.readFileSync(await dl.path()); const files = unzipStored(zip);
  const pngs = files.filter(f => /\.png$/.test(f.name)); eq(pngs.length, 3, 'one PNG per approved asset');
  ok(files.every(f => f.method === 0) && files.some(f => f.name === 'manifest.json') && files.some(f => f.name === 'copy-sheet.txt'), 'manifest and copy sheet in the bundle');
  const man = JSON.parse(files.find(f => f.name === 'manifest.json').data.toString('utf8'));
  for (const m of man.assets) {
    const a = d.assets.find(x => x.id === m.asset); const v = a.versions.find(x => x.id === a.current);
    eq(m.version, a.current, 'the manifest names the current, approved version of ' + a.title);
    const f = pngs.find(x => x.name.indexOf(a.title.replace(/[^a-z0-9-]+/gi, '_') + '-v' + a.versions.length) === 0); ok(f, 'a PNG for ' + a.title);
    const sz = pngSize(f.data); ok(sz.ok, 'a real PNG'); eq([sz.w, sz.h], [v.layout.stage.w, v.layout.stage.h], a.title + ' at its native size');
  }
  ok(/Not a subsidy\. Your tractor uses it too\./.test(files.find(f => f.name === 'copy-sheet.txt').data.toString('utf8')), 'the copy sheet carries the edited words');
  ok(/Every image is at its native size/.test(await page.textContent(R + '.st-export-msg')), 'the page says the sizes were checked');
  ok(man.export && man.export.id, 'the export was recorded on the project');
  await shot(page, 'export');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | '));
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 2 */
await T.t('2. save, reload and resume: the project reopens at the same stage and asset, and unsaved brief edits come back to be saved or discarded', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr button.st-lib-open');
  await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  const d = await api('GET', '/studio/get?id=' + J1);
  const second = d.assets[1]; await page.click(R + '.st-railbtn.asset:has-text("' + second.title + '")'); await page.waitForSelector(R + '.st-stage canvas');
  await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.STRender); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-notice.info', { timeout: 15000 });
  ok(/Resumed where you left off/.test(await page.textContent(R + '.st-notice')), 'the resume is said');
  ok(/Refine/.test(await page.textContent(R + '.st-notice')) && new RegExp(second.title).test(await page.textContent(R + '.st-notice')), await page.textContent(R + '.st-notice'));
  ok(await page.$(R + '.st-railbtn.asset.on:has-text("' + second.title + '")'), 'the same asset is open');
  // an unsaved brief edit survives a reload in this browser, and is offered back, not silently applied
  await goStep(page, 'Brief'); await page.waitForSelector(R + '#brief-message');
  await page.fill(R + '#brief-message', 'Fuel tax credits return a road tax that never applied');
  await page.waitForSelector(R + '.st-dirty');
  await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.STRender); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-notice.info'); await goStep(page, 'Brief');
  await page.waitForFunction(() => /Unsaved brief edits restored/.test(document.querySelector('#studio-root .st-centre').textContent), null, { timeout: 10000 });
  eq(await page.inputValue(R + '#brief-message'), 'Fuel tax credits return a road tax that never applied', 'the words came back');
  ok((await api('GET', '/studio/get?id=' + J1)).brief.message !== 'Fuel tax credits return a road tax that never applied', 'nothing was saved behind the team\'s back');
  await page.click(R + '.st-centre .st-notice button:has-text("Save them")');
  await page.waitForFunction(() => !/Unsaved brief edits restored/.test(document.querySelector('#studio-root .st-centre').textContent));
  eq((await api('GET', '/studio/get?id=' + J1)).brief.message, 'Fuel tax credits return a road tax that never applied', 'saved when asked');
  // a brief saved elsewhere meanwhile is merged field by field, never overwritten
  await page.fill(R + '#brief-action', 'Read the facts at the campaign site');
  const p0 = await api('GET', '/studio/get?id=' + J1);
  await api('POST', '/studio/project/update', { id: J1, revision: p0.revision, patch: { brief: Object.assign({}, p0.brief, { audience: 'Changed by a teammate' }) } });
  await page.click(R + '.st-stagehead .btn:has-text("Save brief")');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-dirty'), null, { timeout: 15000 });
  const b = (await api('GET', '/studio/get?id=' + J1)).brief; eq([b.action, b.audience], ['Read the facts at the campaign site', 'Changed by a teammate'], 'both changes kept');
  ok(!page.errors.length, page.errors.join(' | '));
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 3 */
await T.t('3. switching clients leaves nothing of the other client on screen, and a slow answer for the old client is dropped', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  const mcaTitle = await page.textContent(R + '.st-head .st-ptitle');
  await page.selectOption(R + '.st-head select', 'aep');
  await page.waitForFunction(() => /No projects yet for Australian Energy Producers/.test((document.querySelector('#studio-root .st-lib') || {}).textContent || ''));
  const all = await page.textContent('#studio-root');
  ok(all.indexOf(mcaTitle) < 0 && !/Hands Off Our Fuel/.test(all), 'no MCA project, campaign or work on screen');
  ok(!(await page.$(R + '.st-rail')) && !(await page.$(R + '.st-inspector')), 'no rail, inspector or thread from the other client');
  await page.click(R + '.st-first-btn:has-text("A brief or one line")'); await page.waitForSelector(R + '.st-intake');
  const opts = await page.$$eval(R + '.st-intake select option', o => o.map(x => x.textContent)); ok(opts.some(x => /Gas for the transition/.test(x)) && !opts.some(x => /Hands Off Our Fuel/.test(x)), 'only AEP\'s campaigns: ' + opts.join(', '));
  await page.click(R + '.st-intake-foot .btn:has-text("Cancel")');
  // a slow AEP library answer arriving after the switch back to MCA is not shown
  const release = fx.hold(/^\/studio\/list\?ns=aep/);
  await page.selectOption(R + '.st-head select', 'mca'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.selectOption(R + '.st-head select', 'aep'); await sleep(200);
  await page.selectOption(R + '.st-head select', 'mca'); await page.waitForFunction(() => /Projects for Minerals Council of Australia/.test((document.querySelector('#studio-root .st-lib-head') || {}).textContent || ''));
  release(); await sleep(800);
  ok(/Projects for Minerals Council of Australia/.test(await page.textContent(R + '.st-lib-head')) && (await page.$$(R + '.st-lib tbody tr')).length >= 1, 'still MCA after the stale answer arrived');
  eq(await page.inputValue(R + '.st-head select'), 'mca');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 4 */
await T.t('4. no imagery: production makes complete typographic compositions with no empty image region, nothing rendered, each validated', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib-head .btn'); await page.click(R + '.st-lib-head .btn');
  await page.click(R + '.st-segbtn:has-text("A brief or one line")');
  await page.fill(R + '.st-intake textarea', 'An open brief on the employment figure');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")'); await page.waitForSelector(R + '.st-dir', { timeout: 30000 });
  const pr = await latest('mca');
  await goStep(page, 'Brief'); await page.waitForSelector(R + '.st-produce');
  await page.selectOption(R + '.st-produce select[aria-label="Imagery resolution"]', 'none');
  ok(/No image will be generated/.test(await page.textContent(R + '.st-produce')), 'the choice is explained before anything runs');
  const g0 = calls.gemini;
  await page.click(R + '.st-produce button:has-text("Produce now")');
  await page.waitForSelector(R + '.st-asset', { timeout: 30000 });
  const d = await settle(pr.id);
  eq(calls.gemini, g0, 'no image call'); eq(d.jobs.filter(j => j.stage === 'render').length, 0, 'no render queued');
  for (const a of d.assets) {
    const v = a.versions.find(x => x.id === a.current);
    eq((v.context || {}).imagery, 'none'); ok(!(v.layout.regions || []).length && !v.layout.layers.some(l => l.type === 'img' && !/logo|wordmark/.test(l.role)), 'no image region in ' + a.title);
    ok(v.layout.layers.filter(l => l.type === 'text').length >= 3, 'the words are all there');
    await validated(page, a.title);
    ok(/No imagery by choice/.test(await page.textContent(R + '.st-stage')) && !/No imagery yet/.test(await page.textContent(R + '.st-stage')), 'said as a choice, not a gap');
    const blank = await page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas'); const g = c.getContext('2d'); const px = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < px.length; i += 400) if (px[i + 3] === 0) n++; return n; });
    eq(blank, 0, 'no transparent hole where an image would have been');
  }
  await shot(page, 'no-imagery');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 5 */
await T.t('5. adapting a master to another format keeps its words and image, and the adaptation measures clean: no overflow, no clipping', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr:has-text("Something for regional voters") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  const d0 = await api('GET', '/studio/get?id=' + J1); const master = d0.assets.find(a => a.channel === 'facebook');
  await page.click(R + '.st-railbtn.asset:has-text("' + master.title + '")'); await page.waitForSelector(R + '.st-stage canvas');
  await itab(page, 'Art Director');
  await page.fill(R + '.st-composer textarea', 'Adapt this for an Instagram story 9:16'); await page.click(R + '.st-composer .btn:has-text("Send")');
  await page.waitForFunction(n => document.querySelectorAll('#studio-root .st-railbtn.asset').length === n + 1, d0.assets.length, { timeout: 30000 });
  const d = await api('GET', '/studio/get?id=' + J1); const story = d.assets.find(a => a.format === '9:16'); ok(story, 'a 9:16 asset');
  const sv = story.versions.find(v => v.id === story.current); const mv = master.versions.find(v => v.id === master.current);
  eq([sv.copy.headline, sv.copy.support, (sv.image || {}).key], [mv.copy.headline, mv.copy.support, (mv.image || {}).key], 'same words on the tile and the same photograph');
  eq([sv.layout.stage.w, sv.layout.stage.h], [1080, 1920]);
  await validated(page, story.title);
  const issues = await page.evaluate(() => { const t = document.querySelector('#studio-root .st-readystrip').textContent; return t; });
  ok(!/blocking/.test(issues), 'no blocking issue: ' + issues);
  const r = await page.evaluate(async (L) => { const imgs = {}; const v = window.STRender.validate(L.layout, L.copy, imgs, { channel: 'instagram', format: '9:16' }); return v.issues.filter(i => /overflow|off_canvas|clip|text_too_wide/.test(i.code)).map(i => i.code + ' ' + i.layers.join(',')); }, { layout: sv.layout, copy: sv.copy });
  eq(r, [], 'the renderer measures no overflow or clipping in the adaptation');
  await shot(page, 'adapted');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 6 */
await T.t('6. a provider outage: the set is kept, the failure is explained with a Retry, a double Retry runs one job, and the image lands; a missing key is stated before anything is spent', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib-head .btn'); await page.click(R + '.st-lib-head .btn');
  await page.click(R + '.st-segbtn:has-text("A brief or one line")');
  await page.click(R + '.st-segbtn:has-text("Instagram 4:5")'); await page.click(R + '.st-segbtn:has-text("Facebook 1:1")');   // LinkedIn only
  await page.fill(R + '.st-intake textarea', 'Write one LinkedIn post on the $74 billion figure');
  fx.setProvider('gemini', 'down');
  const copy0 = env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_jobs WHERE stage='copy'").get().n;
  // a double click on Create runs one production
  await page.dblclick(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-notice', { timeout: 60000 });
  await page.waitForFunction(() => /provider is busy/.test((document.querySelector('#studio-root .st-notice') || {}).textContent || ''), null, { timeout: 60000 });
  const pr = await latest('mca'); let d = await settle(pr.id);
  eq(env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_jobs WHERE stage='copy'").get().n - copy0, 1, 'one production job for a double click');
  eq(d.assets.length, 1, 'the composition was made and kept'); const rj = d.jobs.find(j => j.stage === 'render'); eq([rj.state, rj.attempts], ['failed', 3], 'three attempts, then failed');
  ok(/Your work is kept/.test(await page.textContent(R + '.st-notice')) && await page.$(R + '.st-notice button:has-text("Retry render")'), 'the notice explains and offers Retry');
  ok(/failed/.test(await page.textContent(R + '.st-workspace-activity')), 'the failed job is visible beside the work (the activity panel)');
  await shot(page, 'provider-down');
  fx.setProvider('gemini', 'ok'); const g0 = calls.gemini;
  // two retries pressed together: one retry job
  await page.evaluate(() => { const b = [...document.querySelectorAll('#studio-root .st-notice button')].find(x => /Retry render/.test(x.textContent)); const c = [...document.querySelectorAll('#studio-root .st-work-card button')].find(x => /Retry/.test(x.textContent)); b.click(); b.click(); if (c) c.click(); });
  await page.waitForFunction(() => /ran on retry/.test((document.querySelector('#studio-root .st-notice') || {}).textContent || ''), null, { timeout: 60000 });
  d = await settle(pr.id);
  const retries = d.jobs.filter(j => /^retry:/.test(j.idem)); eq(retries.length, 1, 'one retry job'); eq(retries[0].state, 'done');
  const v = d.assets[0].versions.find(x => x.id === d.assets[0].current); ok(v.image && v.image.key, 'the image landed on the asset'); eq(calls.gemini - g0, 1, 'one image call for the retry');
  // a missing key: said in the context bar and on the action, nothing spent
  fx.setProvider('claude', 'missing');
  await page.click(R + '.st-head .ov-link:has-text("All projects")'); await page.waitForSelector(R + '.st-lib-head .btn');
  await page.waitForFunction(() => /Claude not configured/.test(document.querySelector('#studio-root .st-head').textContent));
  await page.click(R + '.st-lib-head .btn'); await page.click(R + '.st-segbtn:has-text("A brief or one line")'); await page.fill(R + '.st-intake textarea', 'An open brief about regional jobs');
  const a0 = calls.anthropic;
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForFunction(() => /Claude is not configured on the worker/.test((document.querySelector('#studio-root .st-notice') || {}).textContent || ''), null, { timeout: 30000 });
  eq(calls.anthropic, a0, 'no model call was attempted');
  ok(/Nothing was spent/.test(await page.textContent(R + '.st-notice')), 'the notice says nothing was spent');
  await goStep(page, 'Brief'); await page.waitForSelector(R + '.st-produce');
  ok(await page.isDisabled(R + '.st-produce button:has-text("Produce now")'), 'Produce is disabled with the reason');
  ok(/not configured/.test(await page.getAttribute(R + '.st-produce button:has-text("Produce now")', 'title')));
  await shot(page, 'missing-key');
  fx.setProvider('claude', 'ok');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 7 */
await T.t('7. a second edit while the first save is still in flight waits its turn: two versions in order, no conflict, nothing lost', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("Something for regional voters") button.st-lib-open'); await page.waitForSelector(R + '#st-f-headline', { timeout: 15000 });
  const d0 = await api('GET', '/studio/get?id=' + J1); const a = d0.assets[0];
  ok(await page.$(R + '.st-railbtn.asset.on:has-text("' + a.title + '")'), 'the first asset is open');
  const vBefore = a.versions.length; const seen0 = fx.seen.length;
  const release = fx.hold(/^\/studio\/version$/);
  await page.fill(R + '#st-f-headline', 'First edit while the network is slow');
  await sleep(1100);   // the debounce has fired; the save is held in flight
  ok(fx.seen.slice(seen0).some(s => s.path === '/studio/version'), 'the first save was sent');
  await page.fill(R + '#st-f-headline', 'Second edit, typed before the first came back');
  await sleep(1100);
  ok(/Saving/.test(await page.textContent(R + '.st-save')), 'the context bar says it is saving');
  eq(await page.inputValue(R + '#st-f-headline'), 'Second edit, typed before the first came back', 'the field keeps what was typed');
  release();
  await page.waitForFunction(() => /All changes saved/.test(document.querySelector('#studio-root .st-save').textContent), null, { timeout: 15000 });
  const d = await api('GET', '/studio/get?id=' + J1); const a2 = d.assets.find(x => x.id === a.id);
  eq(a2.versions.length, vBefore + 2, 'two versions, one per save');
  eq(a2.versions.find(v => v.id === a2.current).copy.headline, 'Second edit, typed before the first came back', 'the last words typed are the current version');
  ok(!(await page.$(R + '.st-notice:not(.info)')), 'no conflict or error notice');
  eq(await page.inputValue(R + '#st-f-headline'), 'Second edit, typed before the first came back');
  // an edit made elsewhere to the same field meanwhile is not overwritten: the conflict is shown with both ways out
  const d1 = await api('GET', '/studio/get?id=' + J1); const a3 = d1.assets.find(x => x.id === a.id);
  const rel2 = fx.hold(/^\/studio\/version$/);
  await page.fill(R + '#st-f-headline', 'Mine, typed here'); await sleep(1100);
  // a teammate saves the same field while this save is in flight; then the held request arrives on a stale revision
  const t = await api('POST', '/studio/version', { asset: a.id, revision: a3.revision, copy: { headline: 'Theirs, saved elsewhere' }, note: 'teammate' }); ok(t.ok, 'the teammate saved first: ' + JSON.stringify(t).slice(0, 200));
  rel2();
  await page.waitForSelector(R + '.st-copy .st-notice', { timeout: 15000 });
  ok(/Changed elsewhere while you typed: headline/.test(await page.textContent(R + '.st-copy .st-notice')) && /Keep mine/.test(await page.textContent(R + '.st-copy .st-notice')), 'the conflict is shown with both ways out');
  const d2 = await api('GET', '/studio/get?id=' + J1); const a4 = d2.assets.find(x => x.id === a.id);
  eq(a4.versions.find(v => v.id === a4.current).copy.headline, 'Theirs, saved elsewhere', 'the teammate\'s words were not overwritten');
  eq(await page.inputValue(R + '#st-f-headline'), 'Mine, typed here', 'and mine are still in the field');
  await page.click(R + '.st-copy .st-notice button:has-text("Keep mine")'); await page.waitForFunction(() => !document.querySelector('#studio-root .st-copy .st-notice'));
  await page.waitForFunction(() => /All changes saved|Saved/.test(document.querySelector('#studio-root .st-save').textContent));
  await sleep(500); const d3 = await api('GET', '/studio/get?id=' + J1); const a5 = d3.assets.find(x => x.id === a.id); eq(a5.versions.find(v => v.id === a5.current).copy.headline, 'Mine, typed here', 'kept on purpose');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 8 */
await T.t('8. the essential workflow by keyboard: start a project, move between stages, use the inspector tabs, approve with a reason; focus is always visible', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib-head .btn');
  const focused = () => page.evaluate(() => { const e = document.activeElement; return { tag: e.tagName, text: (e.textContent || '').trim().slice(0, 60), label: e.getAttribute('aria-label') || '', outline: getComputedStyle(e).outlineStyle, role: e.getAttribute('role') || '' }; });
  async function tabTo(pred, max = 120, back) { for (let i = 0; i < max; i++) { await page.keyboard.press(back ? 'Shift+Tab' : 'Tab'); const f = await focused(); if (pred(f)) return f; } throw new Error('not reached by Tab'); }
  await page.focus(R + '.st-head select');
  const nb = await tabTo(f => /New project/.test(f.text)); ok(nb.outline !== 'none', 'focus is visible on New project');
  await page.keyboard.press('Enter'); await page.waitForSelector(R + '.st-intake');
  await tabTo(f => /A brief or one line/.test(f.text)); await page.keyboard.press('Enter');
  await tabTo(f => f.tag === 'TEXTAREA'); await page.keyboard.type('Write one LinkedIn post on the $74 billion figure');
  await tabTo(f => /^Instagram/.test(f.text)); await page.keyboard.press('Enter');
  await tabTo(f => /^Facebook/.test(f.text)); await page.keyboard.press('Enter');
  const cb = await tabTo(f => /Create project/.test(f.text)); ok(cb.outline !== 'none', 'focus is visible on Create project');
  await page.keyboard.press('Enter');
  await page.waitForSelector(R + '.st-asset', { timeout: 30000 });
  const pr = await latest('mca'); await settle(pr.id);
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  // stages by keyboard: Alt+1 to Alt+6, focus lands on the stage heading
  await page.focus('#studio-root .st-head select'); await page.keyboard.press('Escape');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('Alt+1'); await page.waitForFunction(() => /Brief/.test(document.activeElement.textContent) && document.activeElement.tagName === 'H2');
  await page.keyboard.press('Alt+5'); await page.waitForFunction(() => /^Review$/.test(document.activeElement.textContent.trim()) && document.activeElement.tagName === 'H2');
  // the navigator itself by Tab and Enter
  const st = await tabTo(f => f.tag === 'BUTTON' && /Refine/.test(f.text) && !/Continue/.test(f.text), 120, true); ok(st.outline !== 'none', 'focus visible on the navigator');
  await page.keyboard.press('Enter'); await page.waitForSelector(R + '.st-instabs');
  // inspector tabs with the arrow keys
  await page.focus(R + '#st-tabbtn-copy'); await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.activeElement.id === 'st-tabbtn-quality' && document.activeElement.getAttribute('aria-selected') === 'true');
  ok(await page.isVisible(R + '#st-tab-quality') && !(await page.isVisible(R + '#st-tab-copy')), 'the panel follows the tab');
  // approve with a reason, by keyboard only
  await page.keyboard.press('Alt+5'); await page.waitForSelector(R + '.st-approvals');
  await tabTo(f => /Approve copy/.test(f.label || f.text)); await page.keyboard.press('Enter');
  await page.waitForSelector(R + '.st-dialog textarea'); eq((await focused()).tag, 'TEXTAREA', 'the reason field takes focus');
  await page.keyboard.type('Read out and agreed with the client');
  await tabTo(f => /Record/.test(f.text), 5); await page.keyboard.press('Enter');
  await page.waitForSelector(R + '.st-dialog', { state: 'detached' });
  const d = await api('GET', '/studio/get?id=' + pr.id); ok(d.assets[0].approvals.copy && /Read out and agreed/.test(d.assets[0].approvals.copy.reason), 'approved by keyboard');
  await shot(page, 'keyboard');
  await page.ctxB.close();
});

/* ---------------------------------------------------------------------------------------------------- 9 */
await T.t('9. a tile with no imagery says why no layout can pass it and offers the two real remedies; a solid ground is a free layout version that then validates; the layout variations are each measured, and one becomes a version with the same words and photograph; the Art Director reviews the composed tile on request with one model call and approves nothing', async () => {
  // a production whose render failed: the composition exists, the photograph does not
  fx.setProvider('gemini', 'down');
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'No photograph yet', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'j9' });
  const stepTo = async id => { for (let i = 0; i < 20; i++) { const j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } };
  await stepTo((await api('POST', '/studio/job', { project: pr.id, stage: 'copy', input: { channels: ['instagram'], deliverable: 'set', acknowledge: true, instruction: 'write it' }, idem: 'j9copy' })).job.id);
  let d = await api('GET', '/studio/get?id=' + pr.id); for (const j of d.jobs.filter(j => j.stage === 'render')) await stepTo(j.id);
  fx.setProvider('gemini', 'ok');
  d = await api('GET', '/studio/get?id=' + pr.id); const a = d.assets[0]; ok(!a.versions.find(v => v.id === a.current).image, 'no photograph on the asset');
  ok(d.jobs.some(j => j.stage === 'render' && j.state === 'failed'), 'the render failed');
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib tbody tr'); await page.click(R + '.st-lib tbody tr:has-text("No photograph yet") button.st-lib-open'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.waitForSelector(R + '.st-remedy', { timeout: 30000 });
  const rem = await page.textContent(R + '.st-remedy');
  ok(/No imagery yet/.test(rem) && /Moving the words does not change that/.test(rem) && /last render failed/.test(rem), 'the gap is named, with the failed render: ' + rem);
  ok(await page.$(R + '.st-remedy button:has-text("Retry the render (1 render)")') && await page.$(R + '.st-remedy button:has-text("Use a solid ground instead (no render)")'), 'the two remedies, each with its cost');
  await page.waitForSelector(R + '.st-vars .st-var', { timeout: 30000 });
  ok(await page.$(R + '.st-var[data-variant="col-left"] .st-chip:has-text("needs imagery")') && /8 of them still need the imagery made/.test(await page.textContent(R + '.st-vars-head')), 'variations that still need the photograph say so, card by card and in the count');
  await page.$eval(R + '.st-remedy', e => e.scrollIntoView({ block: 'center' })); await shot(page, 'remedy');
  const g0 = calls.gemini, a0 = calls.anthropic, n0 = a.versions.length;
  await page.click(R + '.st-remedy button:has-text("Use a solid ground instead")');
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  d = await api('GET', '/studio/get?id=' + pr.id); const a1 = d.assets[0]; const v1 = a1.versions.find(v => v.id === a1.current); const v0 = a.versions.find(v => v.id === a.current);
  eq(a1.versions.length, n0 + 1, 'one new version'); eq(v1.kind, 'layout');
  ok(/layout variation: Type only, no photograph \(no render\)/.test(v1.note), v1.note);
  ok(v1.layout.noImagery && !(v1.layout.regions || []).length && !v1.layout.layers.some(l => l.type === 'img' && !/logo|wordmark/.test(l.role)), 'no image region left to fill');
  eq(v1.copy, v0.copy, 'the words unchanged'); eq([calls.gemini, calls.anthropic], [g0, a0], 'no model or image call');
  eq(a1.readiness.technical, 'passed', 'the worker holds a passing validation of exactly this composition');
  ok(!(await page.$(R + '.st-remedy')), 'nothing left to remedy');
  await page.ctxB.close();

  // the variations of a tile with its photograph: each measured, one taken as a layout version
  const p2 = await fx.open({ viewport: { width: 1440, height: 900 } });
  await p2.waitForSelector(R + '.st-lib tbody tr'); await p2.click(R + '.st-lib tbody tr:has-text("Something for regional voters") button.st-lib-open'); await p2.waitForSelector(R + '.st-asset', { timeout: 15000 });
  const dj = await api('GET', '/studio/get?id=' + J1); const as = dj.assets.find(x => x.channel === 'instagram') || dj.assets[0]; const before = as.versions.find(v => v.id === as.current);
  await p2.click(R + '.st-railbtn.asset:has-text("' + as.title + '")'); await p2.waitForSelector(R + '.st-stage canvas');
  await p2.waitForFunction(() => document.querySelectorAll('#studio-root .st-vars .st-var').length >= 8, null, { timeout: 30000 });
  const cards = await p2.$$eval(R + '.st-vars .st-var', els => els.map(e => ({ id: e.dataset.variant, bad: e.classList.contains('bad'), text: e.textContent })));
  ok(cards.length >= 8 && cards.every(c => !c.bad && /passes/.test(c.text)), 'every arrangement offered passes the measurement: ' + cards.map(c => c.id + (c.bad ? ' BAD' : '')).join(', '));
  ok(cards.some(c => c.id === 'type-only' && /no photograph/.test(c.text)), 'the type-only arrangement is labelled');
  ok(/Free: no model call, no render/.test(await p2.textContent(R + '.st-vars-head')) && !/still need the imagery/.test(await p2.textContent(R + '.st-vars-head')), 'the cost is stated');
  await p2.$eval(R + '.st-vars', e => e.scrollIntoView({ block: 'start' })); await shot(p2, 'variations');
  const pick = cards.find(c => c.id !== 'type-only'); const g1 = calls.gemini, a1c = calls.anthropic;
  await p2.click(R + '.st-var[data-variant="' + pick.id + '"] button:has-text("Use this layout")');
  await p2.waitForFunction(n => /v(\d+) of (\d+)/.test(document.querySelector('#studio-root .st-asset-title').textContent) && +document.querySelector('#studio-root .st-asset-title').textContent.match(/of (\d+)/)[1] === n, as.versions.length + 1, { timeout: 15000 });
  await p2.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  const dj2 = await api('GET', '/studio/get?id=' + J1); const as2 = dj2.assets.find(x => x.id === as.id); const after = as2.versions.find(v => v.id === as2.current);
  ok(/^layout variation: .+ \(no render\)$/.test(after.note) && after.kind === 'layout', after.note);
  eq([after.copy, (after.image || {}).key], [before.copy, (before.image || {}).key], 'the same words and photograph');
  ok(JSON.stringify(after.layout) !== JSON.stringify(before.layout), 'the arrangement changed');
  eq([calls.gemini, calls.anthropic], [g1, a1c], 'no model or image call'); eq(as2.readiness.technical, 'passed');

  // the Art Director: a review on request reads the composed tile of this version with one call, and approves nothing
  await itab(p2, 'Art Director'); await p2.waitForSelector(R + '.st-adreview');
  const appr0 = JSON.stringify(as2.approvals || {}); const a2 = calls.anthropic, g2 = calls.gemini;
  await p2.click(R + '.st-adreview button:has-text("1 model call")');
  await p2.waitForFunction(v => { const t = (document.querySelector('#studio-root .st-adreview') || {}).textContent || ''; return /verdict: fix/.test(t) && new RegExp('on v' + v + ', the current version').test(t); }, as2.versions.length, { timeout: 30000 });
  const rv = await p2.textContent(R + '.st-adreview');
  ok(/hierarchy\s*3/.test(rv) && /the composed tile/.test(rv) && /spacing|support line/i.test(rv) && /Advice, not approval/.test(rv), rv);
  eq([calls.anthropic - a2, calls.gemini - g2], [1, 0], 'one model call, no image call');
  const dj3 = await api('GET', '/studio/get?id=' + J1); const ins = dj3.thread.filter(e => e.kind === 'inspection' && e.asset === as.id).pop();
  eq([ins.version, ins.composed], [as2.current, true], 'the review judged this version as it exports');
  eq(JSON.stringify(dj3.assets.find(x => x.id === as.id).approvals || {}), appr0, 'no approval changed');
  ok(await p2.$(R + '.st-instab.on:has-text("Art Director")'), 'the tab is named for the role');
  await shot(p2, 'art-director');
  ok(!p2.errors.length, p2.errors.join(' | '));
  await p2.ctxB.close();
});

const res = T.done();
fs.writeFileSync(SHOTS + 'journey-results.json', JSON.stringify(res, null, 1));
await fx.close();
process.exit(res.fail ? 1 : 0);
