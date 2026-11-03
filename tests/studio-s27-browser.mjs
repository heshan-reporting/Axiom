/* S27 in real Chromium against the worker module, providers MOCKED (4 November 2026). Each case failed on 94210a3:
 *   P1 a job's progress never goes backwards in the page: a poll answered with an older snapshot (as a slow or reordered
 *      answer arrives) does not replace the newer count already shown;
 *   P2 the Studio's dialogs take the focus, keep Tab inside, close on Escape as Cancel does, and give the focus back
 *      (the direction-change dialog of a classic project);
 *   P3 a paid action asks in the Studio's own dialog, not the browser's, with the cost said as a chip; Escape cancels and
 *      nothing is queued;
 *   P4 a reason is asked in the Studio's own dialog and held to its minimum in view (setting a direction aside);
 *   P5 axe finds no serious or critical violation in Explore (the direction cards) and Copy (the activity panel);
 *   P6 no page error and no browser dialog across the cases.
 * Run: node --experimental-sqlite tests/studio-s27-browser.mjs */
import fs from 'node:fs';
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.S27_PORT) || 8863, inspect: false });
const { api, env } = fx;
const R = '#studio-root ';
const T = runner('studio-s27-browser (progress never goes backwards; dialogs hold the focus; the Studio asks its own questions; axe on Explore and Copy)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const seeded = await seedStages(fx, { only: ['directions', 'copy', 'design'], prefix: 'S27' });
const pageErrors = [];
async function open(title, o) {
  const page = await fx.open(Object.assign({ viewport: { width: 1440, height: 900 }, quiet: true }, o || {}));
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); return page;
}
const step = async id => { let j; for (let i = 0; i < 12; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };

await T.t('P1 a poll answered with an older snapshot does not move the count shown backwards', async () => {
  const P = seeded.copy; const now = Date.now();
  const r = await api('POST', '/studio/job', { project: P, stage: 'echo', input: { note: 'S27 progress' }, idem: 's27:progress' }); const id = r.job.id;
  const act = c => JSON.stringify({ activity: { phase: 'composing', label: 'composing the pieces', completed: c, total: 4, at: now - (4 - c) * 1000, startedAt: now - 60000 }, lines: [] });
  env.MIND_DB.db.prepare("UPDATE studio_jobs SET state='running', attempts=1, lease_until=?, progress=?, updated=? WHERE id=?").run(now + 600000, act(3), now - 1000, id);
  const page = await open('S27 at copy');
  const older = (await api('GET', '/studio/job?id=' + id)).job; older.progress.activity.completed = 1; older.progress.activity.at = now - 30000; older.updated = now - 30000;
  let answered = 0; await page.route(new RegExp('/studio/job\\?id=' + id), async route => { answered++; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, job: older }) }); });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await sleep(600);
  await page.click(R + 'button.st-activity'); await page.waitForSelector(R + '.st-work-card[data-job="' + id + '"]', { timeout: 10000 });
  const now0 = await page.getAttribute(R + '.st-work-card[data-job="' + id + '"] [role="progressbar"]', 'aria-valuenow');
  eq(now0, '75', 'the page shows the job at 3 of 4 from the project read');
  for (let i = 0; i < 40 && answered < 2; i++) await sleep(250);
  ok(answered >= 2, 'the poller answered with the older snapshot at least twice: ' + answered); await sleep(300);
  eq(await page.getAttribute(R + '.st-work-card[data-job="' + id + '"] [role="progressbar"]', 'aria-valuenow'), '75', 'and the count shown did not go back to 1 of 4');
  env.MIND_DB.db.prepare("UPDATE studio_jobs SET state='cancelled', updated=? WHERE id=?").run(Date.now(), id);
  await page.ctxB.close();
});

await T.t('P2 the direction-change dialog takes the focus, keeps Tab inside, closes on Escape as Cancel, and gives the focus back', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S27 classic', brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits refund a road tax', audience: 'Regional voters', action: 'Read the facts', channels: ['facebook'], deliverable: 'set', campaignConfirmed: true, imageryTiming: 'after_copy' } });
  const job = async (stage, input) => step((await api('POST', '/studio/job', { project: pr.id, stage, input, idem: stage + ':' + Math.random() })).job.id);
  eq((await job('direct', { n: 2 })).state, 'done'); let g = await api('GET', '/studio/get?id=' + pr.id);
  await api('POST', '/studio/direction/choose', { id: g.directions[0].id }); eq((await job('copy', { channels: ['facebook'], deliverable: 'set', formats: { facebook: '1:1' } })).state, 'done');
  g = await api('GET', '/studio/get?id=' + pr.id); const other = g.directions[1];
  const page = await open('S27 classic'); page.on('dialog', d => { pageErrors.push('unexpected dialog: ' + d.message().slice(0, 100)); d.dismiss(); });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Explore"))'); await sleep(600);
  const btn = page.locator(R + '.st-dir:has(.st-dir-title:has-text("' + other.title.replace(/"/g, '') + '")) button:has-text("Choose this direction")').first();
  await btn.focus(); await page.keyboard.press('Enter');
  await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 10000 });
  const inside = () => page.evaluate(() => { const d = document.querySelector('#studio-root .st-dialog'); return !!(d && d.contains(document.activeElement)); });
  ok(await inside(), 'the focus moved into the dialog');
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); ok(await inside(), 'Tab ' + (i + 1) + ' stays inside the dialog'); }
  await page.keyboard.press('Shift+Tab'); ok(await inside(), 'Shift+Tab stays inside the dialog');
  await page.keyboard.press('Escape'); await page.waitForSelector(R + '.st-impact', { state: 'detached', timeout: 5000 });
  eq((await api('GET', '/studio/get?id=' + pr.id)).directions.find(d => d.chosen).id, g.directions[0].id, 'Escape is Cancel: the choice is as it was');
  ok(await page.evaluate(() => /Choose this direction/.test((document.activeElement || {}).textContent || '')), 'the focus is back on the button that opened it');
  await page.ctxB.close();
});

await T.t('P3 a paid action asks in the Studio\'s own dialog with its cost; Escape cancels and nothing is queued', async () => {
  // a listener that leaves the Studio's own question to the test and counts any browser dialog
  const page = await open('S27 at design'); let browserDialogs = 0; page.on('dialog', d => { if (!d.studio) { browserDialogs++; d.dismiss(); } });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); const chip = page.locator(R + '.st-pagechip').first(); if (await chip.count()) await chip.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(800);
  const P = seeded.design; const jobs0 = (await api('GET', '/studio/get?id=' + P)).jobs.length;
  // a recipe that renders (built in: Release to a coordinated set) states its images and calls before anything runs
  await page.click(R + '.st-designtabs button:has-text("Recipes"), ' + R + '.st-subtab:has-text("Recipes")');
  await page.waitForSelector(R + '.st-prod table[aria-label="Recipes"]', { timeout: 15000 });
  const gen = page.locator(R + '.st-prod table[aria-label="Recipes"] tbody tr').filter({ hasText: 'Release to a coordinated set' }).locator('button:has-text("Run")');
  {
    await gen.click(); await page.waitForSelector(R + '.st-ask', { timeout: 10000 });
    ok(await page.evaluate(() => document.querySelector('#studio-root .st-ask').contains(document.activeElement)), 'the question has the focus');
    ok(/about \d+ images? and \d+ calls?/.test(await page.textContent(R + '.st-ask .st-ask-cost')), 'the cost is said as a chip: ' + await page.textContent(R + '.st-ask .st-ask-cost'));
    eq(await page.getAttribute(R + '.st-ask', 'role'), 'alertdialog', 'a question is an alertdialog');
    await page.keyboard.press('Escape'); await page.waitForSelector(R + '.st-ask', { state: 'detached', timeout: 5000 }); await sleep(400);
    eq((await api('GET', '/studio/get?id=' + P)).jobs.length, jobs0, 'Escape cancelled: nothing was queued');
    eq(env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_jobs WHERE project=? AND recipe='builtin:release-set'").get(P).n, 0, 'and no recipe step exists');
  }
  eq(browserDialogs, 0, 'the browser\'s own dialog never opened');
  await page.ctxB.close();
});

await T.t('P4 setting a direction aside asks for the reason in the Studio\'s dialog and holds it to four characters', async () => {
  const P = seeded.directions; const g = await api('GET', '/studio/get?id=' + P); const d0 = g.directions.find(d => !d.archived && !d.chosen) || g.directions[0];
  // a listener that leaves the Studio's own questions to the test (the fixture hands them to listeners; with none it dismisses)
  const page = await open('S27 at directions'); page.removeAllListeners('dialog'); page.on('dialog', d => { if (!d.studio) { pageErrors.push('browser dialog: ' + d.message().slice(0, 80)); d.dismiss(); } });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Explore"))'); await sleep(700);
  const card = page.locator(R + 'article.st-dcard[aria-label="Direction ' + d0.title.replace(/"/g, '') + '"]').first();
  await card.locator('button[aria-label="Set aside ' + d0.title.replace(/"/g, '') + '"]').first().click();
  await page.waitForSelector(R + '.st-ask[data-kind="prompt"]', { timeout: 5000 });
  ok(await page.evaluate(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA'), 'the reason field has the focus');
  await page.keyboard.type('no'); ok(await page.isDisabled(R + '.st-ask .st-ask-ok'), 'two characters: the button waits');
  ok(/At least 4 characters/.test(await page.textContent(R + '.st-ask .st-ask-min')), 'and the minimum is said in view');
  await page.keyboard.type('t for this week'); ok(!(await page.isDisabled(R + '.st-ask .st-ask-ok')), 'a real reason: the button is ready');
  await page.click(R + '.st-ask .st-ask-ok'); await page.waitForSelector(R + '.st-ask', { state: 'detached', timeout: 5000 });
  let arch = false; for (let i = 0; i < 20 && !arch; i++) { await sleep(250); arch = !!((await api('GET', '/studio/get?id=' + P)).directions.find(d => d.id === d0.id) || {}).archived; }
  ok(arch, 'the direction is set aside with the reason');
  await page.ctxB.close();
});

await T.t('P5 axe: no serious or critical violation in Explore (direction cards) or Copy (with a job in the activity panel)', async () => {
  const page = await open('S27 at design'); await page.addScriptTag({ content: AXE });
  const run = async label => { await sleep(700); const v = await page.evaluate(async () => (await window.axe.run(document.querySelector('#studio-root'), { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' ' + x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(', '))); eq(v, [], label); };
  await page.click(R + '.st-step:has(.st-step-l:text-is("Explore"))'); await run('Explore');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await run('Copy');
  await page.ctxB.close();
});

await T.t('P6 no page error and no unexpected dialog', async () => { eq(pageErrors, [], 'none'); });
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
