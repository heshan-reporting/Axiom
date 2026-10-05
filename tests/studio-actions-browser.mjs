/* The six creative actions in the page (S8), in real Chromium against the worker module in this process; providers MOCKED.
 * The Art direction panel states, before anything is pressed, what each action changes, keeps and costs, and which cannot
 * run now with the reason; the action buttons carry the same statement and are disabled when the worker says not now.
 * Run: node --experimental-sqlite tests/studio-actions-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8797 });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-actions-browser (the six actions stated before they are taken; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || j.state === 'done' || j.state === 'failed') return j; } return j; };

// a produced composition (no render: the imagery is still to come)
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Actions', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'], campaignConfirmed: true } })).id;
const j = await step((await api('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'set', render: false, acknowledge: true }, idem: 'act-1' })).job.id);
if (j.state !== 'done') throw new Error('production failed: ' + j.error);
const A = (await api('GET', '/studio/get?id=' + P)).assets[0].id;
await api('POST', '/studio/lock', { asset: A, element: 'layout', locked: true });

let page;
await T.t('the Art direction panel shows the six actions with what each changes, keeps and costs; a locked layout closes refine, explore and layouts with the reason, and the buttons follow', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("Actions")'); await page.click(R + '.st-lib tbody tr:has-text("Actions") .ov-link');
  await page.waitForSelector(R + '.st-railbtn.asset'); await page.click(R + '.st-railbtn.asset'); await page.waitForSelector(R + '.st-ad-actions');
  await page.waitForSelector(R + '.st-actions button', { timeout: 15000 });
  await page.click(R + '.st-actions button:has-text("Show what each action")'); await page.waitForSelector(R + '.st-actions-table');
  const rows = await page.$$eval(R + '.st-actions-table tbody tr', trs => trs.map(tr => tr.textContent.replace(/\s+/g, ' ')));
  eq(rows.length, 6, 'six actions: ' + rows.length);
  ok(/Refine this design/.test(rows[0]) && /not now/.test(rows[0]) && /locked/.test(rows[0]), rows[0]);
  ok(/Explore layouts/.test(rows[2]) && /no render, ever/.test(rows[2]) && /photograph exactly/.test(rows[2]), rows[2]);
  ok(/Create a new design/.test(rows[3]) && /available/.test(rows[3]) && /never inherited/.test(rows[3]), rows[3]);
  ok(/Generate the imagery/.test(rows[4]) && /1 render at 2K/.test(rows[4]) && /the layout/.test(rows[4]), rows[4]);
  ok(/Edit an area/.test(rows[5]) && /not now/.test(rows[5]) && /no imagery/.test(rows[5]), rows[5]);
  ok(await page.isDisabled(R + '.st-ad-actions button:has-text("Refine this design")'), 'refine disabled while the layout is locked');
  ok(await page.isDisabled(R + '.st-ad-actions button:has-text("Explore variations")'), 'explore disabled');
  ok(!(await page.isDisabled(R + '.st-ad-actions button:has-text("Create a new design")')), 'a new design stays open');
  const title = await page.getAttribute(R + '.st-ad-actions button:has-text("Create a new design")', 'title'); ok(/Changes:/.test(title) && /Keeps:/.test(title) && /Cost:/.test(title), title);
  const off = await page.getAttribute(R + '.st-ad-actions button:has-text("Refine this design")', 'title'); ok(/^Not now: .*locked/.test(off), off);
});
await T.t('unlocking the layout reopens the actions once the project is reopened (the statements follow the locks)', async () => {
  await api('POST', '/studio/lock', { asset: A, element: 'layout', locked: false });
  // reopen the project: the island re-reads the asset and the statements follow its locks
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr:has-text("Actions")'); await page.click(R + '.st-lib tbody tr:has-text("Actions") .ov-link');
  await page.waitForSelector(R + '.st-railbtn.asset'); await page.click(R + '.st-railbtn.asset'); await page.waitForFunction(() => { const b = document.querySelector('#studio-root .st-ad-actions button'); return b && !b.disabled; }, null, { timeout: 20000 });
  ok(!(await page.isDisabled(R + '.st-ad-actions button:has-text("Refine this design")')), 'refine is open again');
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
