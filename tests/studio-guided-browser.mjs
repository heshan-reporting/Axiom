/* S13: the guided flow from the reviewed mockup - Brief, Direction, Copy, Design, Review, Export - in real Chromium against
 * the worker module (studio-fixture.mjs; MOCKED providers, nothing spent). What the mockup only imitated is checked here
 * against the record: the imagery held until the words are ready (no image call), "ready for design" as the agency's copy
 * approval of that exact version (and falling away when the words change), the copy partner's options applied as a text
 * version, the Design dock reaching the existing tools, imagery generated on request, and the Review preflight read from
 * the measurement and the checks. Run: node --experimental-sqlite tests/studio-guided-browser.mjs  (SHOT=1 writes shots) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8840, inspect: false });
const { api, calls, env } = fx;
const R = '#studio-root ';
const T = runner('studio-guided-browser (the six guided steps; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (pg, name) => { if (process.env.SHOT) await pg.screenshot({ path: SHOTS + 'guided-' + name + '.png' }); };
const latest = async ns => env.MIND_DB.db.prepare('SELECT id FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns);
async function settle(pid, ms = 90000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle'); await sleep(250); } }
const goStep = (pg, name) => pg.click(R + '.st-step:has-text("' + name + '")');
const cur = a => a.versions.find(v => v.id === a.current);
let page, pid;

await T.t('six steps in order; the intake asks when the imagery is made; with "after the copy" production lands on Copy and spends no image call', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.waitForSelector(R + '.st-lib-head .btn'); await page.click(R + '.st-lib-head .btn'); await page.waitForSelector(R + '.st-intake');
  await page.click(R + '.st-segbtn:has-text("A brief or one line")'); await page.click(R + '.st-segbtn:has-text("Visual creative")');
  ok(await page.$(R + '.st-timing-row .st-segbtn.on:has-text("With the copy")'), 'with the copy stays the default');
  await page.click(R + '.st-timing-row .st-segbtn:has-text("After the copy is ready")');
  ok(/no render is spent until the words are ready/.test(await page.textContent(R + '.st-timing-row')), 'the choice is explained');
  await page.fill(R + '.st-intake textarea', 'Write one Instagram tile on the $74 billion figure');
  const g0 = calls.gemini;
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-copystage .st-copy-edit', { timeout: 30000 });
  pid = (await latest('mca')).id; const d = await settle(pid);
  eq(await page.$$eval(R + '.st-step .st-step-l', x => x.map(e => e.textContent)), ['Brief', 'Direction', 'Copy', 'Design', 'Review', 'Export'], 'the six steps');
  ok(await page.$(R + '.st-step.on:has-text("Copy")'), 'production lands on Copy');
  eq(d.brief.imageryTiming, 'after_copy', 'the brief keeps the choice');
  eq(calls.gemini, g0, 'no image call'); eq(d.jobs.filter(j => j.stage === 'render').length, 0, 'no render queued');
  ok(/awaiting imagery/.test(await page.textContent(R + '.st-step:has-text("Design")')), 'the Design step says the imagery waits: ' + await page.textContent(R + '.st-step:has-text("Design")'));
  ok(/Get each channel/.test(await page.textContent(R + '.st-stagehead')) && /What happens next/.test(await page.textContent(R + '.st-stagehead')), 'the step states its purpose and what its actions run');
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
  ok(await page.$(R + '.st-step.done:has-text("Copy")'), 'Copy done');
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

await T.t('Design: the dock reaches the words, the brand, the layers and the Art Director; the mode is stated; the imagery is generated on request, one paid call, and lands on the composition', async () => {
  await goStep(page, 'Design'); await page.waitForSelector(R + '.st-dock');
  eq(await page.$$eval(R + '.st-dock .st-dock-btn', x => x.map(e => e.textContent.trim())), ['Design', 'Text', 'Images', 'Brand', 'Layers', 'Partner'], 'the six tools');
  await page.click(R + '.st-dock-btn:has-text("Brand")'); await page.waitForSelector(R + '#st-tabbtn-brand[aria-selected="true"]');
  await page.click(R + '.st-dock-btn:has-text("Text")'); await page.waitForSelector(R + '#st-tabbtn-copy[aria-selected="true"]');
  await page.click(R + '.st-dock-btn:has-text("Partner")'); await page.waitForSelector(R + '#st-tabbtn-partner[aria-selected="true"]');
  await page.click(R + '.st-dock-btn:has-text("Layers")'); await page.waitForSelector(R + '.st-dock-btn.on:has-text("Layers")');
  ok(await page.$(R + '.st-asset-acts .btn.on:has-text("Close layout editor")'), 'the layout editor is open');
  await page.click(R + '.st-asset-acts .btn:has-text("Close layout editor")');
  await shot(page, 'design-dock');
  ok(await page.$(R + '.st-modeseg .st-segbtn.on:has-text("Editable")'), 'Editable is the mode');
  ok(await page.isDisabled(R + '.st-modeseg .st-segbtn:has-text("AI finished")'), 'a finished creative is not made from an editable one');
  ok(/chosen when the project starts/.test(await page.getAttribute(R + '.st-modeseg .st-segbtn:has-text("AI finished")', 'title')), 'and says why');
  ok(await page.$(R + '.st-family, .st-famstrip, .st-comp-info + *'), 'the page strip sits under the canvas');
  // the board: what waits for imagery, and the one button that makes it
  await page.click(R + '.st-subtab:has-text("Board")'); await page.waitForSelector(R + '.st-imagery-wait');
  ok(/1 composition waiting for imagery/.test(await page.textContent(R + '.st-imagery-wait')) && /1 of them have their copy marked ready/.test(await page.textContent(R + '.st-imagery-wait')), await page.textContent(R + '.st-imagery-wait'));
  const g0 = calls.gemini; let asked = '';
  page.removeAllListeners('dialog'); page.on('dialog', dl => { asked = dl.message(); dl.accept(); });
  await page.click(R + '.st-stagehead button:has-text("Generate imagery (1)")');
  const d = await settle(pid);
  ok(/One paid image generation per planned region/.test(asked), 'the cost was stated first: ' + asked);
  eq(calls.gemini - g0, 1, 'one image call');
  ok(cur(d.assets[0]).image && cur(d.assets[0]).image.key, 'the imagery landed on the composition');
  ok(d.thread.some(e => /Imagery asked for/.test(e.text || '')), 'the thread records the request');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-imagery-wait'), null, { timeout: 15000 });
  await shot(page, 'design-board');
});

await T.t('Review: the preflight reads copy, design, brand and accessibility from the record; the copy approval made in Copy stands; a missing alt text is named', async () => {
  // measure the version that now has imagery, as the team would by opening it
  await goStep(page, 'Design'); await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /Technical validation\s*passed/.test((document.querySelector('#studio-root .st-ready') || {}).textContent || ''), null, { timeout: 30000 });
  await goStep(page, 'Review'); await page.waitForSelector(R + '.st-approvals');
  eq(await page.$$eval(R + '.st-approvals thead th', x => x.map(e => e.textContent)), ['Asset', 'Copy', 'Design', 'Brand', 'Accessibility', 'Approvals']);
  const cell = k => page.textContent(R + '.st-approvals tbody tr td[data-check="' + k + '"]');
  // passed, with any warning named rather than hidden (a photograph's likely subject under the words is a warning, not a pass)
  ok(/pass\s*validation passed/.test(await cell('design')) || /check\s*passed, \d+ warnings?: /.test(await cell('design')), await cell('design'));
  ok(/pass|check/.test(await cell('brand')), await cell('brand'));
  ok(/alt text present/.test(await cell('accessibility')), await cell('accessibility'));
  // the render made a new version with the same words: the copy approval given in Copy is carried, by its signature
  ok(/ready \/ approved/.test(await page.textContent(R + '.st-approvals tbody tr')) && /unchanged since/.test(await page.textContent(R + '.st-approvals tbody tr')), 'the copy approval made in Copy stands on the rendered version: ' + await page.textContent(R + '.st-approvals tbody tr'));
  ok(/clear the preflight/.test(await page.textContent(R + '.st-pf-sum')), 'a summary line');
  // the alt text removed in Copy: Accessibility names it
  await goStep(page, 'Copy'); await page.waitForSelector(R + '#st-cf-alt');
  await page.fill(R + '#st-cf-alt', ''); await page.press(R + '#st-cf-alt', 'Tab');
  for (let i = 0; i < 40; i++) { const x = await api('GET', '/studio/get?id=' + pid); if (!cur(x.assets[0]).copy.alt) break; await sleep(150); }
  await goStep(page, 'Review'); await page.waitForSelector(R + '.st-approvals');
  await page.waitForFunction(() => /no alt text/.test((document.querySelector('#studio-root .st-approvals td[data-check="accessibility"]') || {}).textContent || ''), null, { timeout: 15000 });
  await shot(page, 'review');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | '));
  await page.ctxB.close();
});

await T.t('a read-only key: Copy shows the words and the ready state, with nothing to tick, edit or ask', async () => {
  const p2 = await fx.open({ role: 'read', viewport: { width: 1440, height: 900 } });
  await p2.waitForSelector(R + '.st-lib tbody tr'); await p2.click(R + '.st-lib tbody tr .ov-link');
  await p2.waitForSelector(R + '.st-step'); await p2.click(R + '.st-step:has-text("Copy")'); await p2.waitForSelector(R + '.st-copy-edit');
  ok(await p2.isDisabled(R + '.st-ready-check input'), 'no tick'); ok(await p2.isDisabled(R + '#st-cf-headline'), 'no edit');
  eq(await p2.$(R + '.st-copy-asks'), null, 'no asks');
  await p2.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
