/* The Express build in the page (23 November 2026), in real Chromium against the worker module in this process, every provider
 * MOCKED. The team's complaint was the number of steps; the wizard now asks first how the project is built, and an express
 * project is three stages over the same seven worker steps.
 *   EB1  the wizard asks Express or Detailed before anything else: nothing is assumed for a first project (Next waits for the
 *        answer), the answer is remembered for the next one, and one click changes it
 *   EB2  an express project shows Brief, Make, Ship; the Brief holds the plan with Axiom's picks selected, and one press
 *        confirms the reading, the objective, the message and the strategy in ONE request and asks for the directions
 *   EB3  choosing a direction writes the copy from it and opens the canvas, with no "ready for design" tick and nothing approved
 *   EB4  Ship: one approval of exactly this version - the words and the design - by a person, with one reason; a piece that
 *        has not passed its checks cannot be approved, and says why
 *   EB5  a detailed project is the seven stages it was: the same wizard, the other answer
 * Run: node --experimental-sqlite tests/studio-express-browser.mjs   (EXPRESS_PORT picks the static server's port, default 8896) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { wizardCreate, openProject } from './studio-flow.mjs';
import { pngForVersion } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import fs from 'node:fs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.EXPRESS_PORT || 8896), inspect: false });
const { api } = fx;
const T = runner('Express build: asked first, three stages, one confirmation, one approval; detailed unchanged');
const TEXT = 'Fuel tax credits are under attack: a crossbencher called the credit a subsidy for miners.\n\nPlease respond on social this week, regional focus. Mining directly employs more than 300,000 Australians.';
const posts = (n0, path) => fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path.split('?')[0] === path).map(x => { try { return JSON.parse(x.body || '{}'); } catch (e) { return {}; } });
const stages = page => page.$$eval(R + '.st-flow .st-step .st-step-l', els => els.map(e => e.textContent.trim()));
const step = async id => { let j; for (let i = 0; i < 20; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
let PID = '';
// the accessibility gate's own check (axe-core, serious and critical) over the screens this release adds
const AXE = (() => { try { return fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8'); } catch (e) { return ''; } })();
async function axe(page, where) {
  if (!AXE) return ['axe-core is not installed (npm install): ' + where + ' was not checked'];
  await page.evaluate(AXE);
  const v = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector('#studio-root') || document, { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' (' + x.nodes.length + '): ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')); });
  return v.map(x => where + ': ' + x);
}

const page = await fx.open({ viewport: { width: 1440, height: 900 } });

await T.t('EB1 the wizard asks Express or Detailed first: nothing assumed for a first project, the answer remembered, one click to change it', async () => {
  await page.evaluate(() => localStorage.removeItem('ax_studio_build'));   // a person who has never been asked
  await page.locator(R + 'button:has-text("New project")').first().click();
  await page.waitForSelector(R + '.st-wiz .st-buildq');
  eq(await page.$$eval(R + '.st-build', els => els.map(e => [e.dataset.build, e.getAttribute('aria-checked')])), [['express', 'false'], ['detailed', 'false']], 'two options, neither chosen');
  ok(/How do you want to build this\?/.test(await page.textContent(R + '.st-buildq')), 'the question is asked in words');
  ok(await page.evaluate(() => { const q = document.querySelector('#studio-root .st-buildq'); const c = document.querySelector('#studio-root .st-cpick'); return q.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING; }), 'it comes before the client and the brief');
  await page.waitForSelector(R + '.st-client-card'); await page.click(R + '.st-client-card:has-text("Minerals Council")');
  const next = page.locator(R + '.st-wiz-foot button:has-text("Next")');
  ok(await next.isDisabled(), 'Next waits for the answer'); ok(/Choose Express or Detailed/.test(await page.textContent(R + '.st-wiz-foot')), 'and the foot says what is missing');
  await page.click(R + '.st-build[data-build="express"]');
  eq(await page.getAttribute(R + '.st-build[data-build="express"]', 'aria-checked'), 'true'); ok(!(await next.isDisabled()), 'Next opens');
  eq(await page.evaluate(() => localStorage.getItem('ax_studio_build')), 'express', 'remembered for the next project');
  await page.click(R + '.st-wiz-top button:has-text("Cancel")'); await page.waitForSelector(R + '.st-wiz', { state: 'detached' });
  await page.locator(R + 'button:has-text("New project")').first().click(); await page.waitForSelector(R + '.st-buildq');
  eq(await page.getAttribute(R + '.st-build[data-build="express"]', 'aria-checked'), 'true', 'the last answer is offered, already selected');
  await page.click(R + '.st-build[data-build="detailed"]'); eq(await page.getAttribute(R + '.st-build[data-build="express"]', 'aria-checked'), 'false', 'one click changes it');
  eq(await axe(page, 'the wizard\'s first question'), [], 'no serious or critical accessibility violation');
});

await T.t('EB2 an express project is Brief, Make, Ship; one press confirms the whole plan in one request and asks for the directions', async () => {
  await wizardCreate(page, { build: 'express', text: TEXT, title: 'Express crossbencher' });
  eq(await stages(page), ['Brief', 'Make', 'Ship'], 'three stages in the header');
  eq(await page.getAttribute(R + '.st-flow', 'data-build'), 'express');
  await page.waitForSelector(R + '.st-xplan[data-plan="open"]', { timeout: 15000 });
  eq(await page.$$eval(R + '.st-xplan select', els => els.map(e => e.getAttribute('aria-label'))), ['Objective', 'Key message', 'Response strategy', 'Campaign'], 'the whole plan on one page (the campaign chosen in the wizard can still be changed)');
  ok((await page.$$eval(R + '.st-xplan .st-xplan-row .st-lbl', els => els.map(e => e.textContent))).slice(0, 3).every(t => /Axiom's pick/.test(t)), 'each part starts as Axiom\'s recommendation, and says so');
  ok(/Hands Off Our Fuel/.test(await page.$eval(R + '.st-xplan select[aria-label="Campaign"]', s => s.options[s.selectedIndex].textContent)), 'the campaign is the one the person chose');
  ok(!(await page.$(R + 'button:has-text("Confirm and continue to Objectives")')), 'no separate confirmation of the reading');
  ok(!(await page.$(R + '.st-stagehead .st-phasesteps')), 'the Brief is one page: no steps to walk');
  ok(/1 model call/.test(await page.textContent(R + '.st-xplan-go')), 'the button states what it spends');
  eq(await axe(page, 'the plan'), [], 'no serious or critical accessibility violation on the plan');
  // Make is locked until the plan is confirmed, and the lock sends the person to the Brief, never to a step express does not walk
  await page.click(R + '.st-step:has(.st-step-l:text-is("Make"))'); await page.waitForSelector(R + '.st-locked', { timeout: 15000 });
  ok(/Confirm the plan in the Brief/.test(await page.textContent(R + '.st-locked')), 'the lock says what opens it');
  await page.click(R + '.st-locked button:has-text("Go to the Brief")'); await page.waitForSelector(R + '.st-xplan[data-plan="open"]', { timeout: 15000 });
  PID = await page.evaluate(() => (history.state && history.state.studio && history.state.studio.pid) || '');
  const n0 = fx.seen.length;
  await page.click(R + '.st-xplan-go');
  await page.waitForSelector(R + '.st-dcard', { timeout: 40000 });
  const conf = posts(n0, '/studio/workflow/confirm'); eq(conf.length, 1, 'one confirmation request'); eq(conf[0].step, 'plan');
  eq(posts(n0, '/studio/job').filter(b => b.stage === 'direct').length, 1, 'one directions job');
  if (!PID) PID = conf[0].project;
  const g = await api('GET', '/studio/get?id=' + PID); eq(g.brief.build, 'express');
  eq(['brief', 'objectives', 'strategy'].map(k => g.workflow.steps[k].state), ['complete', 'complete', 'complete']);
  eq(await page.$eval(R + '.st-flow .st-step.on .st-step-l', e => e.textContent.trim()), 'Make', 'the page is in Make, where the person sent it');
  eq(await page.$$eval(R + '.st-stagehead .st-phasesteps .st-substep', els => els.map(e => e.textContent.replace(/[0-9,]|not started|needs review|complete|locked|processing|in progress/gi, '').trim())), ['Direction', 'Words', 'Canvas'], 'Make holds three steps');
});

await T.t('EB3 choosing a direction writes the copy from it and opens the canvas: no "ready for design" tick, nothing approved', async () => {
  const use = page.locator(R + '.st-dcard-use').first();
  ok(/Use this and write the copy/.test(await use.textContent()) && /1 model call/.test(await use.textContent()), 'the button says what it does and spends');
  const n0 = fx.seen.length;
  await use.click();
  await page.waitForSelector(R + '.st-refine', { timeout: 60000 });
  eq(posts(n0, '/studio/direction/choose').length, 1); eq(posts(n0, '/studio/job').filter(b => b.stage === 'copy').length, 1, 'one copy job');
  eq(posts(n0, '/studio/approve').length, 0, 'nothing was approved for the person');
  eq(posts(n0, '/studio/job').filter(b => b.stage === 'render').length, 0, 'and no image was asked for');
  const g = await api('GET', '/studio/get?id=' + PID);
  ok(g.assets.length >= 2, 'a piece per channel: ' + g.assets.length); eq(g.workflow.steps.copy.state, 'complete'); ok(g.workflow.steps.design.state !== 'locked', 'the canvas is open: ' + g.workflow.steps.design.state);
  eq(await page.$eval(R + '.st-flow .st-step.on .st-step-l', e => e.textContent.trim()), 'Make');
  await page.waitForSelector(R + '.st-phasesteps-bar .st-substep.on', { timeout: 15000 });
  ok(/Canvas/.test(await page.textContent(R + '.st-phasesteps-bar .st-substep.on')), 'on the canvas, with the way back to the direction and the words beside it');
});

await T.t('EB4 Ship: one approval of the words and the design of exactly this version, by a person with one reason; an unchecked piece says why it waits', async () => {
  // the imagery a person would ask for on the canvas, and a passing measurement of one piece, filed as the canvas files it
  const pr = await api('POST', '/studio/production', { project: PID, mode: 'editable' }); eq((pr.skipped || []).map(x => x.code), [], 'express: no piece waits for a ready tick'); ok(pr.done.length >= 2, 'the imagery is queued for every piece: ' + pr.done.length);
  for (const j of (await api('GET', '/studio/get?id=' + PID)).jobs.filter(j => (j.stage === 'render' || j.stage === 'inspect') && (j.state === 'queued' || j.state === 'running'))) await step(j.id);
  let g = await api('GET', '/studio/get?id=' + PID); const a = g.assets[0]; const v = a.versions.find(x => x.id === a.current);
  const val = await api('POST', '/studio/validation', { asset: a.id, version: v.id, report: stubReport(v, a), imageB64: pngForVersion(v, { fill: 3 }) });
  eq(val.readiness && val.readiness.technical, 'passed', 'the measurement passes: ' + JSON.stringify(val).slice(0, 300));
  await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.AXUI && typeof studioInit === 'function'); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-flow', { timeout: 20000 }).catch(async () => { await openProject(page, 'Express crossbencher'); });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Ship"))');
  await page.waitForSelector(R + '.st-reviewstage .st-approvals', { timeout: 20000 });
  eq(await page.$$eval(R + '.st-stagehead .st-phasesteps .st-substep', els => els.map(e => e.textContent.replace(/[0-9,]|not started|needs review|complete|locked|processing|in progress/gi, '').trim())), ['Approve', 'Deliver'], 'Ship holds the approval and the package');
  const btn = page.locator(R + 'button[aria-label="Approve ' + a.title + '"]'); eq(await btn.count(), 1, 'one approval button for the piece');
  ok(/Approve words and design/.test(await btn.textContent())); ok(!(await btn.isDisabled()), 'open, because this version passed its checks');
  const other = page.locator(R + 'button[aria-label="Approve ' + g.assets[1].title + '"]'); ok(await other.isDisabled(), 'the piece with no passing measurement cannot be approved');
  ok(/passing validation of this exact version/.test(await page.textContent(R + '.st-approvals tbody tr:nth-child(2) .st-apboth')), 'and says why');
  const n0 = fx.seen.length;
  await btn.click(); await page.waitForSelector(R + '.st-dialog textarea');
  ok(/Approve the words and the design/.test(await page.textContent(R + '.st-dialog')), 'the dialog says it is both');
  await page.fill(R + '.st-dialog textarea', 'Agreed with the client on the Tuesday call.'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForSelector(R + '.st-dialog', { state: 'detached' }); await sleep(600);
  const ap = posts(n0, '/studio/approve'); eq(ap.map(b => b.part), ['copy', 'design'], 'the words, then the design');
  ok(ap.every(b => b.version === v.id && b.decision === 'approve'), 'both name the version the person saw');
  eq(ap[1].reason, 'Agreed with the client on the Tuesday call.', 'the person\'s reason is on the design');
  eq(await axe(page, 'Ship'), [], 'no serious or critical accessibility violation in Ship');
  g = await api('GET', '/studio/get?id=' + PID); const a2 = g.assets.find(x => x.id === a.id);
  ok(a2.approvals && a2.approvals.copy && a2.approvals.design, 'both approvals stand'); eq(a2.approvals.design.by, 'Hesh', 'in the person\'s name');
});

await T.t('EB6 "Confirm only" confirms the plan and spends nothing; the confirmed plan then offers the directions, and can be changed', async () => {
  const p3 = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await wizardCreate(p3, { build: 'express', text: TEXT, title: 'Express confirm only' });
    await p3.waitForSelector(R + '.st-xplan[data-plan="open"]', { timeout: 15000 });
    const n0 = fx.seen.length;
    await p3.click(R + '.st-xplan .st-stepbar button:has-text("Confirm only")');
    await p3.waitForSelector(R + '.st-xplan[data-plan="confirmed"]', { timeout: 15000 });
    eq(posts(n0, '/studio/workflow/confirm').map(b => b.step), ['plan']); eq(posts(n0, '/studio/job').length, 0, 'no model call was asked for');
    ok(/Plan confirmed/.test(await p3.textContent(R + '.st-xplan')), 'the page says the plan is confirmed');
    eq(await p3.$eval(R + '.st-flow .st-step.on .st-step-l', e => e.textContent.trim()), 'Brief', 'and stays where the person is');
    ok(/Propose directions/.test(await p3.textContent(R + '.st-xplan .st-xplan-go')) && /1 model call/.test(await p3.textContent(R + '.st-xplan .st-xplan-go')), 'the directions are one press away, with their cost');
    await p3.click(R + '.st-xplan button:has-text("Change the plan")'); await p3.waitForSelector(R + '.st-xplan[data-plan="editing"]');
    ok(/This is the confirmed plan/.test(await p3.textContent(R + '.st-xplan .st-stepbar')), 'the plan opens again, as confirmed, to be changed');
  } finally { await p3.context().close(); }
});

await T.t('EB5 a detailed project is the seven stages it was, through the same wizard and the other answer', async () => {
  const p2 = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await wizardCreate(p2, { build: 'detailed', text: TEXT, title: 'Detailed crossbencher' });
    eq(await stages(p2), ['Brief', 'Plan', 'Direction', 'Copy', 'Create', 'Review', 'Deliver'], 'seven stages');
    eq(await p2.getAttribute(R + '.st-flow', 'data-build'), 'detailed');
    ok(!(await p2.$(R + '.st-xplan')), 'no one-confirmation plan');
    ok(await p2.$(R + '.st-stepbar button:has-text("Confirm and continue to Objectives")'), 'the reading is confirmed on its own, as before');
    const rows = (await api('GET', '/studio/list?ns=mca')).projects;
    eq(rows.find(r => r.title === 'Detailed crossbencher').build, 'detailed'); eq(rows.find(r => r.title === 'Express crossbencher').build, 'express');
  } finally { await p2.context().close(); }
});

await page.context().close();
const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
