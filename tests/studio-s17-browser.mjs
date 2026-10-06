/* S17: the guided workflow in real Chromium against the worker module in this process (studio-fixture.mjs; providers
 * MOCKED, nothing spent). A project is made in the wizard and walks seven steps, each opened by the one before it:
 * Brief, Objectives, Strategy, Directions, Copy, Design, Review. Checked here against the page and the record:
 *   - the wizard asks four things in order and moves on only when each is answered (Back keeps the answers, Escape leaves);
 *   - a new project starts at the Brief; every later step is locked and says what opens it, and the worker refuses a job
 *     that would skip ahead (the gate holds on both sides);
 *   - the brief is read from several pieces at once, and the processing card names the step it is on, never a percentage;
 *   - objectives are ranked with their messages, the strategy is chosen with Axiom's recommendation, and the directions
 *     are generated without moving the page (a ready card offers them);
 *   - the Directions board: free previews, save for later, duplicate, compare, select - and still no auto-navigation;
 *   - changing an earlier choice asks first: Cancel writes nothing, Keep keeps the work current with no model call;
 *   - Copy starts from the chosen direction with no image; copy written on an earlier choice is said once and kept on
 *     request, nothing regenerated.
 * Run: node --experimental-sqlite tests/studio-s17-browser.mjs   (SHOT=1 writes tests/shots/s17-flow-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
import { wizardCreate, step } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8807, inspect: false });
const { api, calls, env } = fx;
const R = '#studio-root ';
const T = runner('studio-s17-browser (the guided workflow: wizard, gates, brief, processing, objectives, strategy, directions, impact, copy; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const shot = async name => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 's17-flow-' + name + '.png' }); };
const latest = ns => env.MIND_DB.db.prepare('SELECT id FROM studio_projects WHERE ns=? ORDER BY created DESC, rowid DESC LIMIT 1').get(ns).id;
async function settle(pid, ms = 60000) { const t0 = Date.now(); for (;;) { const d = await api('GET', '/studio/get?id=' + pid); if (!(d.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) return d; if (Date.now() - t0 > ms) throw new Error('jobs did not settle'); await sleep(200); } }
const BRIEF = 'A Senate crossbencher called the fuel tax credit a subsidy for miners on regional radio this morning and wants it scrapped. We need an answer on social this week, with a regional focus.';
let page, pid;
const stateOf = label => page.getAttribute(step(label), 'data-state');
const onStep = async label => !!(await page.$(step(label, true)));

await T.t('the wizard asks four things in order - the type of work, the client, the campaign context, the brief - and moves on only when each is answered; Back keeps the answers and Escape leaves', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'not this week for this client' : undefined));
  await page.click(R + 'button:has-text("New project")'); await page.waitForSelector(R + '.st-wiz');
  const steps = await page.$$eval(R + '.st-wiz-steps li', x => x.map(e => e.textContent.replace(/^\d+/, '').trim()));
  eq(steps, ['Project type', 'Client', 'Campaign', 'Brief'], 'four steps');
  ok(await page.isDisabled(R + '.st-wiz-foot button:has-text("Next")'), 'Next waits for the type of work');
  await page.click(R + '.st-type:has-text("Response Creative")'); ok(!(await page.isDisabled(R + '.st-wiz-foot button:has-text("Next")')));
  await page.click(R + '.st-wiz-foot button:has-text("Next")');
  await page.waitForSelector(R + '.st-client-card[aria-checked="true"]:has-text("Minerals Council")');
  await page.waitForFunction(() => /knowledge is ready/.test((document.querySelector('#studio-root .st-knowprep') || {}).textContent || ''), null, { timeout: 15000 });
  ok(/approved fact|banned term|campaign|mark/i.test(await page.textContent(R + '.st-knowprep')), 'the client\'s knowledge is counted before the brief: ' + await page.textContent(R + '.st-knowprep'));
  await page.click(R + '.st-wiz-foot button:has-text("Next")'); await page.waitForSelector(R + '.st-cmodes');
  ok(await page.isDisabled(R + '.st-wiz-foot button:has-text("Next")'), 'Next waits for a campaign context');
  await page.click(R + '.st-cmodes .st-type:has-text("Select existing campaign")');
  ok(await page.isDisabled(R + '.st-wiz-foot button:has-text("Next")'), 'and for the campaign itself');
  await page.click(R + '.st-camp:has-text("Hands Off Our Fuel")'); ok(!(await page.isDisabled(R + '.st-wiz-foot button:has-text("Next")')));
  // Back keeps what was chosen
  await page.click(R + '.st-wiz-foot button:has-text("Back")'); await page.waitForSelector(R + '.st-client-card[aria-checked="true"]');
  await page.click(R + '.st-wiz-foot button:has-text("Next")'); await page.waitForSelector(R + '.st-camp[aria-checked="true"]:has-text("Hands Off Our Fuel")');
  await page.click(R + '.st-wiz-foot button:has-text("Next")'); await page.waitForSelector(R + '.st-compose-ta');
  ok(await page.isDisabled(R + '.st-wiz-foot button:has-text("Create and analyse")'), 'nothing to analyse yet');
  await page.fill(R + '.st-compose-ta', 'Too short'); ok(await page.isDisabled(R + '.st-wiz-foot button:has-text("Create and analyse")'), 'a few words are not a brief');
  await shot('wizard');
  await page.keyboard.press('Escape'); await page.waitForSelector(R + '.st-lib');
  eq(env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_projects").get().n, 0, 'leaving the wizard made nothing');
});

await T.t('a new project starts at the Brief: every later step is locked and says what opens it; the worker refuses a job that would skip ahead', async () => {
  await wizardCreate(page, { type: 'Response Creative', campaign: 'Hands Off Our Fuel', title: 'Gate check', text: BRIEF, analyse: false });
  pid = latest('mca');
  ok(await onStep('Brief'), 'on the Brief');
  for (const l of ['Objectives', 'Strategy', 'Directions', 'Copy', 'Design', 'Review']) ok(/locked|blocked/.test(await stateOf(l) || ''), l + ' is locked: ' + await stateOf(l));
  await page.click(step('Directions')); await page.waitForSelector(R + '.st-locked');
  const lk = await page.textContent(R + '.st-locked'); ok(/Directions is locked/.test(lk) && /Go to/.test(lk), lk);
  eq(await page.$$eval(R + '.st-dcard', x => x.length), 0, 'a locked step shows what opens it, never the work');
  await page.click(R + '.st-locked button:has-text("Go to")'); await page.waitForSelector(step('Brief', true));
  for (const stage of ['direct', 'copy']) {
    const r = await api('POST', '/studio/job', { project: pid, stage, input: { n: 3, channels: ['facebook'] }, idem: 'skip:' + stage });
    eq([r._status, r.error], [409, 'workflow_locked'], 'the worker refuses a ' + stage + ' job before its step is open');
  }
  ok(await page.$(R + '.st-ctxaside'), 'the early steps keep the project context beside the work');
  await shot('locked');
});

await T.t('the brief is read from several pieces at once; the processing card names the step it is on and how long it has run, never an invented percentage; the understanding then asks to be confirmed', async () => {
  await page.waitForSelector(R + '.st-compose', { timeout: 15000 });
  await page.fill(R + '.st-compose-row input[aria-label="A note"]', 'Lead with the farmers who use the credit');
  await page.click(R + '.st-compose-row button:has-text("Note")');
  fx.providers.slowMs = 4000; fx.setProvider('claude', 'slow');
  await page.click(R + 'button:has-text("Analyse brief")');
  // read the card while the call is out: the step it is on and the time so far, and no share of a call that has not answered
  const proc = await (await page.waitForFunction(() => { const e = document.querySelector('#studio-root .st-proc'); return e && !e.classList.contains('done') && /so far|Queued/.test(e.textContent) ? e.textContent : false; }, null, { timeout: 15000 })).jsonValue();
  ok(!/\d+\s*%/.test(proc), 'no percentage while the model has not answered: ' + proc);
  ok((await page.$$(R + '.st-proc-item')).length >= 3 && /Reading the material/.test(proc), 'the steps of the reading are listed: ' + proc.slice(0, 200));
  await shot('processing');
  await page.waitForSelector(R + '.st-under', { timeout: 40000 }); fx.setProvider('claude', 'ok');
  const g = await api('GET', '/studio/get?id=' + pid);
  ok(g.sources.length >= 2, 'the brief and the note are both material: ' + g.sources.map(s => s.name).join(' | '));
  ok(/Does Axiom have this right\?/.test(await page.textContent(R + '.st-under')), 'the understanding asks to be confirmed');
  ok(/locked/.test(await stateOf('Objectives') || ''), 'Objectives stays locked until a person confirms');
});

await T.t('objectives are ranked with their messages, the strategy is chosen with Axiom\'s recommendation, and the directions are made without moving the page', async () => {
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Objectives")');
  await page.waitForSelector(R + '.st-objectives', { timeout: 15000 });
  const objs = await page.$$eval(R + '.st-choose-col[aria-label="Objectives"] .st-opt', x => x.map(e => e.textContent.replace(/\s+/g, ' ')));
  ok(/^1\. Correct the subsidy claim/.test(objs[0].trim()) && /recommended/.test(objs[0]), objs[0]);
  await page.click(R + '.st-choose-col[aria-label="Objectives"] .st-opt:has-text("Reinforce the national campaign") input');
  ok(/Hands off our fuel/.test(await page.textContent(R + '.st-choose-col[aria-label="Key messages"]')), 'the messages follow the objective');
  await page.click(R + '.st-choose-col[aria-label="Objectives"] .st-opt:has-text("Correct the subsidy claim") input');
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Strategy")');
  await page.waitForSelector(R + '.st-strats', { timeout: 15000 });
  ok(/Axiom recommends/.test(await page.textContent(R + '.st-strat.on')), 'the recommended strategy is preselected');
  await page.click(R + '.st-stepbar button:has-text("Confirm and generate directions")');
  await page.waitForSelector(R + '.st-ready-card', { timeout: 40000 });
  ok(await onStep('Strategy'), 'still on Strategy: the page did not move');
  ok(/Creative Directions ready/.test(await page.textContent(R + '.st-ready-card')));
  await page.click(R + '.st-ready-card button:has-text("View directions")'); await page.waitForSelector(step('Directions', true));
  await page.waitForSelector(R + '.st-dcard');
  await shot('directions');
});

await T.t('the Directions board: free previews, save for later, duplicate and compare at no model cost; selecting opens Copy without moving the page', async () => {
  const cards = await page.$$(R + '.st-dcard'); ok(cards.length >= 3, 'three directions: ' + cards.length);
  eq(await page.$$eval(R + '.st-dcard .st-dcard-note', x => x.every(e => /no image generated/.test(e.textContent))), true, 'each preview says no image was made');
  ok((await page.$$(R + '.st-dcard canvas')).length >= 3, 'each drawn by the renderer');
  const a0 = calls.anthropic, g0 = calls.gemini; const n0 = (await api('GET', '/studio/get?id=' + pid)).directions.length;
  await page.click(R + '.st-dcard:has-text("The road never driven") button[aria-label^="Save for later"]');
  await page.waitForFunction(() => /Saved for later \(1\)/.test(document.querySelector('#studio-root .st-dboard').textContent), null, { timeout: 15000 });
  await page.click(R + '.st-dcard:has-text("The plain ask") button[aria-label^="Duplicate"]');
  for (let i = 0; i < 40 && (await api('GET', '/studio/get?id=' + pid)).directions.length === n0; i++) await sleep(150);
  eq((await api('GET', '/studio/get?id=' + pid)).directions.length, n0 + 1, 'a duplicate is a new direction');
  await page.check(R + '.st-dcard:has-text("The plain ask") >> nth=0 >> input[aria-label^="Compare"]');
  await page.check(R + '.st-dcard:has-text("Who it really is") input[aria-label^="Compare"]');
  await page.waitForSelector(R + '.st-dcompare table'); ok(/Comparing 2 directions/.test(await page.textContent(R + '.st-dcompare')));
  eq([calls.anthropic, calls.gemini], [a0, g0], 'saving, duplicating and comparing spend nothing');
  await page.click(R + '.st-dcard:has-text("Who it really is") button:has-text("Select")');
  await page.waitForFunction(() => /Direction selected: Who it really is/.test(document.querySelector('#studio-root .st-dboard .st-stepbar').textContent), null, { timeout: 15000 });
  ok(await onStep('Directions'), 'still on Directions: selecting does not move the page');
  ok(await page.$(R + '.st-stepbar button:has-text("Continue to Copy")'), 'Copy is offered');
  ok(!/locked/.test(await stateOf('Copy') || ''), 'Copy is open now');
  await shot('selected');
});

await T.t('changing an earlier choice asks first: Cancel writes nothing; Keep keeps the directions current, with no model call', async () => {
  await page.click(step('Objectives')); await page.waitForSelector(R + '.st-objectives');
  await page.click(R + '.st-choose-col[aria-label="Objectives"] .st-opt:has-text("Reinforce the national campaign") input');
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Strategy")');
  await page.waitForSelector(R + '.st-impact', { timeout: 15000 });
  const q = await page.textContent(R + '.st-impact');
  ok(/may affect your current Creative Directions/.test(q) && /Nothing is deleted either way/.test(q) && /Update directions/.test(q) && /Keep existing directions/.test(q), q);
  await page.click(R + '.st-impact button:has-text("Cancel")'); await page.waitForSelector(R + '.st-impact', { state: 'detached' });
  let g = await api('GET', '/studio/get?id=' + pid); eq(g.brief.intel.selected.objective.id, 'O1', 'Cancel wrote nothing');
  const a0 = calls.anthropic;
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Strategy")');
  await page.waitForSelector(R + '.st-impact'); await page.click(R + '.st-impact button:has-text("Keep existing directions")');
  for (let i = 0; i < 40; i++) { g = await api('GET', '/studio/get?id=' + pid); if (g.brief.intel.selected.objective.id === 'O2') break; await sleep(150); }
  eq(g.brief.intel.selected.objective.id, 'O2', 'the new objective is recorded');
  ok(g.directions.find(d => d.chosen && d.title === 'Who it really is'), 'the selected direction is still selected');
  ok(g.workflow.steps.directions.why !== 'chosen_earlier', 'and still current under the new choice: ' + JSON.stringify(g.workflow.steps.directions));
  eq(calls.anthropic, a0, 'keeping regenerates nothing');
  await shot('impact');
});

await T.t('Copy starts from the chosen direction and writes words with no image; copy written on an earlier choice is said once and kept on request, nothing regenerated', async () => {
  await page.click(step('Copy')); await page.waitForSelector(R + '.st-copystart', { timeout: 15000 });
  ok(/Following the direction/.test(await page.textContent(R + '.st-copystart')) && /Who it really is/.test(await page.textContent(R + '.st-copystart-dir')), 'the copy follows the selected direction');
  ok(/No image is generated here/.test(await page.textContent(R + '.st-copystart-what')), 'and says no image is made');
  const g0 = calls.gemini;
  await page.click(R + '.st-copystart .st-stepbar button:has-text("Generate copy")');
  await page.waitForSelector(R + '.st-copy-pick', { timeout: 40000 }); let d = await settle(pid);
  ok(d.assets.length >= 2, 'one piece per channel'); eq(calls.gemini, g0, 'no image call');
  // the strategy changes with "update": the pieces were written on the earlier choice
  await page.click(step('Strategy')); await page.waitForSelector(R + '.st-strats');
  await page.click(R + '.st-strat:has-text("Indirect") input, ' + R + '.st-strat:not(.on) input');
  await page.click(R + '.st-stepbar button:has-text("Confirm only")');
  await page.waitForSelector(R + '.st-impact', { timeout: 15000 }); await page.click(R + '.st-impact button:has-text("Update directions")');
  await page.waitForSelector(R + '.st-impact', { state: 'detached' }); d = await settle(pid);
  ok(d.workflow.steps.copy.why === 'earlier_choice' && d.workflow.steps.copy.stale.length === d.assets.length, 'the pieces are on the earlier choice: ' + JSON.stringify(d.workflow.steps.copy));
  await page.click(step('Copy')); await page.waitForSelector(R + '.st-stalecopy', { timeout: 15000 });
  ok(/written on an earlier choice/.test(await page.textContent(R + '.st-stalecopy')) && /until you decide/.test(await page.textContent(R + '.st-stalecopy')), await page.textContent(R + '.st-stalecopy'));
  const a0 = calls.anthropic; const v0 = d.assets.map(a => a.versions.length);
  await page.click(R + '.st-stalecopy button:has-text("Keep them under the current choice")');
  await page.waitForSelector(R + '.st-stalecopy', { state: 'detached', timeout: 15000 });
  d = await api('GET', '/studio/get?id=' + pid);
  ok(d.assets.every(a => (d.brief.intel.keptItems || []).indexOf(a.id) >= 0), 'each piece is kept by name under the current choice');
  eq(d.assets.map(a => a.versions.length), v0, 'nothing rewritten'); eq(calls.anthropic, a0, 'no model call');
  ok(d.thread.some(e => /Kept \d+ pieces? built on an earlier choice/.test(e.text || '')), 'the thread records it');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | '));
  await shot('kept');
});

await T.t('a read-only key opens a guided project and sees where it stands, but cannot start a project or confirm a step', async () => {
  const p2 = await fx.open({ role: 'read', viewport: { width: 1440, height: 900 } });
  await p2.waitForSelector(R + '.st-lib tbody tr'); eq(await p2.$(R + 'button:has-text("New project")'), null, 'no New project');
  await p2.click(R + '.st-lib tbody tr:has-text("Gate check") button.st-lib-open'); await p2.waitForSelector(R + '.st-step');
  await p2.click(step('Objectives')); await p2.waitForSelector(R + '.st-objectives');
  eq(await p2.$(R + '.st-stepbar button:has-text("Confirm")'), null, 'no confirmation for a read-only key');
  await p2.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
