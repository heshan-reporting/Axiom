/* The Creative Studio as its own tab, the browser's Back button, and the brief engine in the page (S15), in real Chromium
 * against the worker module in this process; providers MOCKED.
 * - The navigation has a Create group with a Creative Studio tab; every view change is a history entry, so Back returns
 *   to the previous view (and, inside the Studio, from a project to the library) instead of leaving the app.
 * - "A brief or article to analyse" at intake: the material is read against the client first; the page shows what was
 *   kept and set aside, the campaign with Use, the claims, the copy angles and the visual narratives with their route;
 *   producing a finished narrative sets the project to Finished creative first.
 * Run: node --experimental-sqlite tests/studio-s15-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8802 });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s15-browser (Creative Studio tab, Back history, the brief engine; providers MOCKED)');
const DAILY = ['# AXIOM daily brief - 6 October 2026',
  'Fuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy for miners, and regional radio picked it up.',
  'Gas reservation: the energy lobby is pushing for an east-coast reserve; AEP should watch the Senate inquiry.',
  'The MCA analysis showing mining paid $74 billion in company tax and royalties is being quoted by regional MPs.',
  'Housing approvals fell for the third month; the property council will respond tomorrow.'].join('\n\n');
const shown = sel => fx.page.evaluate(s => { const e = document.querySelector(s); return !!e && !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length); }, sel);

await T.t('the Creative Studio is a tab of its own in a Create group; Back returns to the view before it and Forward comes back, without leaving the app', async () => {
  const page = await fx.open({ go: false }); fx.page = page; page.on('dialog', d => d.accept());
  const tab = await page.$('.rgrp .rbtn[data-v="studio"]'); ok(tab, 'a Creative Studio tab in the navigation');
  eq(await tab.getAttribute('aria-label'), 'Creative Studio');
  ok(/Create/.test(await page.evaluate(() => document.querySelector('.rbtn[data-v="studio"]').closest('.rgrp').textContent)), 'in the Create group');
  const start = await page.evaluate(() => (history.state || {}).v); ok(start, 'the first view is a history entry: ' + start);
  await page.evaluate(() => go('narratives')); await page.waitForFunction(() => location.hash === '#v=narratives');
  await tab.click(); await page.waitForSelector(R + '.st-head'); ok(await shown('#v-studio'), 'the Studio is open');
  eq(await page.evaluate(() => location.hash), '#v=studio');
  await page.goBack(); await page.waitForFunction(() => location.hash === '#v=narratives');
  ok(await shown('#v-narratives') && !(await shown('#v-studio')), 'Back returned to Narratives');
  await page.goBack(); await page.waitForFunction(s => (history.state || {}).v === s, start);
  ok(/127\.0\.0\.1/.test(page.url()), 'still in the app after two Backs: ' + page.url());
  await page.goForward(); await page.waitForFunction(() => location.hash === '#v=narratives');
  await page.goForward(); await page.waitForSelector(R + '.st-head'); ok(await shown('#v-studio'), 'Forward returns to the Studio');
});

await T.t('inside the Studio, opening a project is a history entry: Back returns to the library, Forward to the project', async () => {
  const page = fx.page;
  await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'History project', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } });
  await page.evaluate(() => go('command')); await page.evaluate(() => go('studio'));
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("History project")', { timeout: 15000 });
  await page.click(R + '.st-lib tbody tr:has-text("History project") .ov-link');
  await page.waitForFunction(() => /History project/.test((document.querySelector('#studio-root .st-head') || {}).textContent || '') && !document.querySelector('#studio-root .st-lib'), null, { timeout: 15000 });
  await page.goBack(); await page.waitForSelector(R + '.st-lib tbody tr:has-text("History project")', { timeout: 15000 });
  ok(await shown('#v-studio'), 'still in the Studio, at the library');
  await page.goForward(); await page.waitForFunction(() => !document.querySelector('#studio-root .st-lib') && /History project/.test(document.querySelector('#studio-root .st-head').textContent), null, { timeout: 15000 });
});

await T.t('a pasted daily brief is analysed at intake: kept and set aside, the campaign offered, the claims, angles and narratives with their routes, and the next step', async () => {
  const page = fx.page;
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib');
  await page.click(R + 'button:has-text("New project")'); await page.waitForSelector(R + '.st-intake');
  await page.click(R + '.st-intake .st-segbtn:has-text("A brief or article to analyse")');
  await page.click(R + '.st-intake-an .st-segbtn:has-text("Today\'s daily brief")');
  await page.fill(R + '.st-intake textarea', DAILY);
  const sel = await page.$(R + '.st-intake select[aria-label="Campaign"]'); if (sel) await page.selectOption(R + '.st-intake select[aria-label="Campaign"]', '');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-analysis', { timeout: 30000 });
  const strip = (await page.textContent(R + '.st-an-strip')).replace(/\s+/g, ' ');
  ok(/2 kept/.test(strip) && /2 set aside/.test(strip) && /1 not placed/.test(strip), strip);
  ok(/1 claims match facts|0 claims match facts/.test(strip) && /1 conflict|unverified/.test(strip), strip);
  ok(/Next: Write the copy\./.test(await page.textContent(R + '.st-an-next')), 'the next step is named');
  ok(await page.$(R + '.st-an-card button:has-text("Use Hands Off Our Fuel")'), 'the matched campaign is offered');
  const angles = await page.$$eval(R + '.st-an-angles li', ls => ls.map(l => l.textContent));
  ok(/Not a subsidy\. A tax that never applied\./.test(angles[0]) && !/uses "subsidy"/.test(angles[0]), angles[0]);
  ok(/uses "subsidy"/.test(angles[1]), 'the plain use of a banned term is flagged: ' + angles[1]);
  const narrs = await page.$$eval(R + '.st-an-narr', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ')));
  eq(narrs.length, 2); ok(/editable layout/.test(narrs[0]) && /Produce as an editable layout/.test(narrs[0]), narrs[0]); ok(/Gemini finished/.test(narrs[1]) && /Produce as a finished creative/.test(narrs[1]), narrs[1]);
  await page.click(R + '.st-an-sec .st-tools-toggle'); await page.waitForSelector(R + '.st-an-paras');
  const rows = await page.$$eval(R + '.st-an-paras tbody tr', trs => trs.map(t => t.textContent.replace(/\s+/g, ' ')));
  ok(rows.some(r => /east-coast reserve/.test(r) && /set aside/.test(r)), 'the gas paragraph is set aside: ' + rows.join(' | '));
  ok(rows.some(r => /Senate crossbencher/.test(r) && /kept/.test(r)), 'the fuel paragraph is kept');
  // the proposal filled the empty brief fields, marked as the Studio's
  const P = (await api('GET', '/studio/list?ns=mca')).projects.find(p => /AXIOM daily brief/.test(p.title)).id; fx.P = P;
  const g = await api('GET', '/studio/get?id=' + P); eq(g.brief.objectiveSource, 'ai'); eq(g.brief.analysis.kind, 'daily');
  await page.click(R + '.st-an-card button:has-text("Use Hands Off Our Fuel")');
  await page.waitForFunction(() => /the project's campaign/.test(document.querySelector('#studio-root .st-an-card').textContent), null, { timeout: 15000 });
});

await T.t('producing the finished narrative sets the project to Finished creative before production; the Direction step shows each route', async () => {
  const page = fx.page;
  await page.click(R + '.st-an-narr:has-text("One striking poster") button:has-text("Produce as a finished creative")');
  let mode = ''; for (let i = 0; i < 40 && mode !== 'finished'; i++) { mode = ((await api('GET', '/studio/get?id=' + fx.P)).brief || {}).creationMode; if (mode !== 'finished') await new Promise(r => setTimeout(r, 250)); }
  eq(mode, 'finished', 'the route set the creation mode');
  let g; for (let i = 0; i < 40; i++) { g = await api('GET', '/studio/get?id=' + fx.P); if (g.directions.find(d => d.title === 'One striking poster').chosen) break; await new Promise(r => setTimeout(r, 250)); }
  ok(g.directions.find(d => d.title === 'One striking poster').chosen, 'the narrative is the chosen direction (after the mode was set)');
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#studio-root .st-step')).find(x => /Direction/.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector(R + '.st-dir-route', { timeout: 15000 });
  const routes = await page.$$eval(R + '.st-dir-route', ds => ds.map(d => d.textContent.replace(/\s+/g, ' ')));
  ok(routes.some(r => /Gemini finished creative/.test(r) && /from the brief analysis/.test(r)), routes.join(' | '));
  ok(routes.some(r => /editable composition/.test(r)), routes.join(' | '));
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
