/* The guided flow in real Chromium against the worker module (studio-fixture.mjs; MOCKED providers, nothing spent).
 * Since S17 a project is made in the wizard and walks seven steps - Brief, Objectives, Strategy, Directions, Copy, Design,
 * Review (Export is a view inside Review). What a mockup would only imitate is checked here against the record: the copy is
 * written before any imagery (no image call), "ready for design" is the agency's copy approval of that exact version and
 * falls away when the words change, the copy partner's options apply as a text version, the production mode is chosen once
 * the words are ready and its cost is stated before anything is queued, the Design dock reaches the existing tools, and the
 * Review preflight is read from the measurement and the checks.
 * Run: node --experimental-sqlite tests/studio-guided-browser.mjs  (SHOT=1 writes shots) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
import { wizardCreate, toDirections, selectDirection, generateCopy, step } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8840, inspect: false });
const { api, calls, env } = fx;
const R = '#studio-root ';
const T = runner('studio-guided-browser (the seven guided steps; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (pg, name) => { if (process.env.SHOT) await pg.screenshot({ path: SHOTS + 'guided-' + name + '.png' }); };
const latest = async ns => env.MIND_DB.db.prepare('SELECT id FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns);
async function settle(pid, ms = 90000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle'); await sleep(250); } }
const goStep = (pg, name) => pg.click(step(name));
const cur = a => a.versions.find(v => v.id === a.current);
let page, pid;

await T.t('seven steps in order: the wizard makes a guided project, the understanding, objective and strategy are confirmed, a direction selected, and the copy is written before any imagery - no image call, Design locked until the words are ready', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 900 } });
  const g0 = calls.gemini;
  await wizardCreate(page, { type: 'Social Content', deliverable: 'visual', text: 'Write one Instagram tile on the $74 billion figure: mining paid more company tax and royalties than any other industry in 2023-24.' });
  eq(await page.$$eval(R + '.st-step .st-step-l', x => x.map(e => e.textContent)), ['Brief', 'Explore', 'Copy', 'Design', 'Review & Deliver'], 'S20: five phases over the seven steps');
  await toDirections(page); await selectDirection(page, 0); await generateCopy(page);
  pid = (await latest('mca')).id; const d = await settle(pid);
  eq(d.brief.workflow, 2, 'a guided project');
  ok(await page.$(step('Copy', true)), 'the copy lands on Copy');
  eq(calls.gemini, g0, 'no image call'); eq(d.jobs.filter(j => j.stage === 'render').length, 0, 'no render queued');
  ok(/locked|blocked/.test(await page.getAttribute(step('Design'), 'data-state') || '') || /Locked/.test(await page.textContent(step('Design'))), 'Design waits for the words: ' + await page.textContent(step('Design')));
  ok(/Working on/.test(await page.textContent(R + '.st-stagehead')), 'the phase says what it is working on and what needs attention');
  await page.click(R + '.st-stagehead button[aria-label^="About the"]');
  ok(/Needs/.test(await page.textContent(R + '.st-stagehead')) && /Main action/.test(await page.textContent(R + '.st-stagehead')) && /What happens next/.test(await page.textContent(R + '.st-stagehead')), 'and, on asking, what it needs, what its main action does and what happens next');
  await shot(page, 'copy');
});

await T.t('Copy: one channel at a time with counts and help; an edit is a text version; "ready for design" is the copy approval of that version and falls away when the words change', async () => {
  let d = await api('GET', '/studio/get?id=' + pid); const A = d.assets[0]; const n0 = A.versions.length;
  for (const k of ['headline', 'support', 'cta', 'caption', 'alt']) ok(await page.$(R + '#st-cf-' + k), 'field ' + k);
  ok(/characters/.test(await page.textContent(R + '.st-copy-field')), 'a character count');
  await page.fill(R + '#st-cf-headline', 'Not a subsidy. Your ute uses it too.'); await page.press(R + '#st-cf-headline', 'Tab');
  for (let i = 0; i < 40; i++) { d = await api('GET', '/studio/get?id=' + pid); if (d.assets[0].versions.length > n0) break; await sleep(150); }
  const v1 = cur(d.assets[0]); eq([v1.copy.headline, v1.kind], ['Not a subsidy. Your ute uses it too.', 'text'], 'a text version');
  page.on('dialog', dl => dl.accept());
  await page.waitForSelector(R + '.st-ready-check input:not([disabled])'); await page.click(R + '.st-ready-check input');
  await page.waitForFunction(() => /Ready for design/.test(document.querySelector('#studio-root .st-copy-badge').textContent), null, { timeout: 15000 });
  d = await api('GET', '/studio/get?id=' + pid); const ap = d.assets[0].approvals.copy;
  ok(ap && ap.version === d.assets[0].current && ap.reason === 'copy ready', 'the copy approval of the current version: ' + JSON.stringify(ap));
  await page.waitForSelector(R + '.st-step.done:has(.st-step-l:text-is("Copy"))', { timeout: 15000 });
  // a word changes: a new version, and the mark no longer stands (it named the version before)
  await page.fill(R + '#st-cf-caption', 'Mining paid $74 billion in company tax and royalties in 2023-24.'); await page.press(R + '#st-cf-caption', 'Tab');
  await page.waitForFunction(() => /Working draft/.test(document.querySelector('#studio-root .st-copy-badge').textContent), null, { timeout: 15000 });
  ok(!(await page.isChecked(R + '.st-ready-check input')), 'unticked by the edit');
  await shot(page, 'copy-edited');
});

await T.t('the copy partner offers headlines as options, each one model call, and the chosen one becomes a text version; the brief sits beside it', async () => {
  const a0 = calls.anthropic; const before = (await api('GET', '/studio/get?id=' + pid)).assets[0].versions.length;
  ok(/From the brief/.test(await page.textContent(R + '.st-copy-partner')), 'the brief beside the words');
  await page.click(R + '.st-copy-asks button:has-text("Three headline options")');
  await page.waitForSelector(R + '.st-copy-alt', { timeout: 30000 });
  eq(calls.anthropic - a0, 1, 'one model call');
  eq((await page.$$(R + '.st-copy-alt')).length, 3, 'three options');
  await page.click(R + '.st-copy-alt:has-text("A road tax that never applied.") button:has-text("Use this headline")');
  let d; for (let i = 0; i < 40; i++) { d = await api('GET', '/studio/get?id=' + pid); if (d.assets[0].versions.length > before) break; await sleep(150); }
  eq(cur(d.assets[0]).copy.headline, 'A road tax that never applied.', 'applied as a version');
  await page.waitForFunction(() => /A road tax that never applied\./.test(document.querySelector('#studio-root #st-cf-headline').value), null, { timeout: 15000 });
  // ready again, on the version that now stands
  await page.waitForSelector(R + '.st-ready-check input:not([disabled])'); await page.click(R + '.st-ready-check input');
  await page.waitForFunction(() => /Ready for design/.test(document.querySelector('#studio-root .st-copy-badge').textContent), null, { timeout: 15000 });
});

await T.t('Design: the production mode is chosen once the words are ready, its cost stated before anything is queued; one paid image lands on the composition; the dock reaches the words, the brand, the layers and the Art Director', async () => {
  await page.click(R + '.st-stagehead button:has-text("Continue to Design")');
  await page.waitForSelector(R + '.st-pmodes', { timeout: 15000 });
  ok(/one render per planned image/.test(await page.textContent(R + '.st-pmode:has-text("Editable creative")')), 'each mode says what it spends');
  ok(await page.isDisabled(R + '.st-pmodes .st-stepbar button:has-text("Generate")'), 'nothing is generated until a mode is chosen');
  await page.click(R + '.st-pmode:has-text("Editable creative")');
  const g0 = calls.gemini; let asked = '';
  page.removeAllListeners('dialog'); page.on('dialog', dl => { asked = dl.message(); dl.accept(); });
  await page.click(R + '.st-pmodes .st-stepbar button:has-text("Generate 1 piece")');
  const d = await settle(pid);
  ok(/One paid render per planned image/.test(asked), 'the cost was stated first: ' + asked);
  eq(calls.gemini - g0, 1, 'one image call');
  ok(cur(d.assets[0]).image && cur(d.assets[0]).image.key, 'the imagery landed on the composition');
  eq((d.brief.production || {}).mode, 'editable', 'the mode is recorded on the project');
  // the canvas and its dock
  await goStep(page, 'Design'); await page.waitForSelector(R + '.st-dock', { timeout: 15000 });
  eq(await page.$$eval(R + '.st-dock .st-dock-btn', x => x.map(e => e.textContent.trim())), ['Design', 'Text', 'Images', 'Brand', 'Layers'], 'the five tools (the Creative Director is the right panel)');
  // S18: each tool opens its panel beside the canvas (the page does not scroll), and the canvas stays in view
  const y0 = await page.evaluate(() => document.querySelector('#studio-root .st-centre').scrollTop);
  for (const t of ['Brand', 'Text', 'Layers', 'Design', 'Images']) { await tool(page, t); ok(await page.isVisible(R + '.st-library[data-tool="' + t.toLowerCase() + '"]'), t + ' panel open'); }
  eq(await page.evaluate(() => document.querySelector('#studio-root .st-centre').scrollTop), y0, 'opening a tool never scrolled the workspace');
  await page.click(R + '.st-library-head button[aria-label^="Close"]'); await page.waitForSelector(R + '.st-library', { state: 'detached' });
  ok(await page.$(R + '.st-le-layer'), 'the canvas is the editor: layers are selectable without an edit mode');
  ok(/Editable/.test(await page.textContent(R + '.st-dock-mode')), 'Editable is the mode');
  eq(await page.$(R + '.st-dock-mode button'), null, 'a finished creative is not made from an editable one (no switch offered)');
  await page.click(R + '.st-subtab:has-text("Board")'); await page.waitForSelector(R + '.st-board-card, ' + R + '.st-board');
  eq(await page.$(R + '.st-imagery-wait'), null, 'nothing waits for imagery any more');
  await shot(page, 'design');
});

await T.t('Review: the preflight reads copy, design, brand and accessibility from the record; the copy approval made in Copy stands; a missing alt text is named', async () => {
  // measure the version that now has imagery, as the team would by opening it
  await goStep(page, 'Design'); await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  await goStep(page, 'Review'); await page.waitForSelector(R + '.st-approvals');
  eq(await page.$$eval(R + '.st-approvals thead th', x => x.map(e => e.textContent)), ['Asset', 'Copy', 'Design', 'Brand', 'Accessibility', 'Approvals']);
  const cell = k => page.textContent(R + '.st-approvals tbody tr td[data-check="' + k + '"]');
  ok(/pass\s*validation passed/.test(await cell('design')) || /check\s*passed, \d+ warnings?: /.test(await cell('design')), await cell('design'));
  ok(/pass|check/.test(await cell('brand')), await cell('brand'));
  ok(/alt text present/.test(await cell('accessibility')), await cell('accessibility'));
  ok(/ready \/ approved/.test(await page.textContent(R + '.st-approvals tbody tr')) && /unchanged since/.test(await page.textContent(R + '.st-approvals tbody tr')), 'the copy approval made in Copy stands on the rendered version: ' + await page.textContent(R + '.st-approvals tbody tr'));
  ok(/clear the preflight/.test(await page.textContent(R + '.st-pf-sum')), 'a summary line');
  // the alt text removed in Copy: Accessibility names it
  await goStep(page, 'Copy'); await page.waitForSelector(R + '#st-cf-alt');
  await page.fill(R + '#st-cf-alt', ''); await page.press(R + '#st-cf-alt', 'Tab');
  for (let i = 0; i < 40; i++) { const x = await api('GET', '/studio/get?id=' + pid); if (!cur(x.assets[0]).copy.alt) break; await sleep(150); }
  // an edit to the words drops the copy approval, and Review waits for ready copy (the gate holds on both sides)
  await page.waitForFunction(() => /locked|blocked/.test((document.querySelector('#studio-root .st-step[data-phase="deliver"]') || {}).getAttribute('data-state') || ''), null, { timeout: 15000 });
  const g1 = calls.gemini; const refused = await api('POST', '/studio/production', { project: pid, mode: 'editable', size: '1K' });
  ok(refused.skipped && refused.skipped.some(x => x.code === 'copy_not_ready') && !(refused.jobs || []).length && calls.gemini === g1, 'the worker holds the same gate: nothing is produced from copy that is not ready: ' + JSON.stringify(refused.skipped));
  await page.waitForSelector(R + '.st-ready-check input:not([disabled])'); await page.click(R + '.st-ready-check input');
  await page.waitForFunction(() => /Ready for design/.test(document.querySelector('#studio-root .st-copy-badge').textContent), null, { timeout: 15000 });
  await goStep(page, 'Review'); await page.waitForSelector(R + '.st-approvals');
  await page.waitForFunction(() => /no alt text/.test((document.querySelector('#studio-root .st-approvals td[data-check="accessibility"]') || {}).textContent || ''), null, { timeout: 15000 });
  await shot(page, 'review');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | '));
  await page.ctxB.close();
});

await T.t('a read-only key: Copy shows the words and the ready state, with nothing to tick, edit or ask', async () => {
  const p2 = await fx.open({ role: 'read', viewport: { width: 1440, height: 900 } });
  await p2.waitForSelector(R + '.st-lib tbody tr'); await p2.click(R + '.st-lib tbody tr .ov-link');
  await p2.waitForSelector(R + '.st-step'); await p2.click(step('Copy')); await p2.waitForSelector(R + '.st-copy-edit');
  ok(await p2.isDisabled(R + '.st-ready-check input'), 'no tick'); ok(await p2.isDisabled(R + '#st-cf-headline'), 'no edit');
  eq(await p2.$(R + '.st-copy-asks'), null, 'no asks');
  await p2.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
