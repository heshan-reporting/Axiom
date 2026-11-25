/* Five variations of a Full AI creative in the page (25 November 2026), real Chromium against the worker module, providers MOCKED.
 *   VB1 "Generate 5 variations" states its cost and paints five; the picker shows the five paintings of that one run
 *   VB2 picking one ("Use this one") marks THAT card in use, never none, and offers the others
 *   VB3 no page error and no browser dialog
 * Run: node --experimental-sqlite tests/studio-variations-browser.mjs   (VAR_PORT picks the port, default 8897) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { openProject, goStep } from './studio-flow.mjs';
const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.VAR_PORT || 8897), inspect: false });
const { api } = fx;
const T = runner('studio-variations-browser (five Full AI variations, one run, the one in use marked)');
const step = async id => { let j; for (let i = 0; i < 12; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
// a Full AI piece in the fixture's client (its logo on file), its first painting on file
const p = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'VAR finished', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, creationMode: 'finished' }, idem: 'var-p' });
const P = p.id;
const j0 = await api('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'visual', formats: { instagram: '4:5' }, instruction: 'One tile', acknowledge: true }, idem: 'var-copy' });
const jc = await step(j0.job.id); ok(jc && jc.state === 'done', 'copy written: ' + (jc && (jc.state + ' ' + (jc.error || ''))));
for (const id of (jc && jc.result && jc.result.renders) || []) await step(id);
const errors = [];
const page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true });
page.on('pageerror', e => errors.push(String(e.message)));
page.on('dialog', d => { if (!d.studio) { errors.push('browser dialog: ' + d.message()); d.dismiss(); } else d.accept(); });
const openPiece = async () => { await openProject(page, 'VAR finished'); await sleep(600); await goStep(page, 'Create'); await sleep(1200);
  const chip = page.locator(R + '.st-pagechip').first(); if (await chip.count()) { await chip.click(); await sleep(1200); } };

await T.t('VB1: Generate 5 variations states its cost, paints five, and the picker shows that run', async () => {
  await openPiece();
  const btn = page.locator(R + 'button[data-variations]'); ok(await btn.count(), 'the button is offered on a Full AI piece');
  ok(/5 renders/.test(await btn.textContent()), 'its cost is on it');
  await btn.click(); await sleep(1500);
  const g = await api('GET', '/studio/get?id=' + P);
  const jobs = (g.jobs || []).filter(j => j.stage === 'render' && j.state !== 'done' && j.state !== 'failed');
  for (const j of jobs) await step(j.id);
  // a reload reopens the project where it was (the Studio remembers its place), so only the piece is picked again
  await page.reload(); await page.waitForSelector(R + '.st-pagechip', { timeout: 20000 }); await page.locator(R + '.st-pagechip').first().click(); await page.waitForSelector(R + '.st-vars .st-var', { timeout: 15000 }); await sleep(600);
  const cards = await page.$$(R + '.st-vars .st-var'); eq(cards.length, 5, 'five paintings to choose from');
  eq((await page.$$(R + '.st-vars .st-var.on')).length, 1, 'one marked in use');
});

await T.t('VB2: picking another marks that one in use', async () => {
  const other = page.locator(R + '.st-vars .st-var:not(.on)').nth(1); const label = ((await other.textContent()).match(/Variation \d/) || [''])[0];
  await other.locator('button:has-text("Use this one")').click(); await sleep(2000);
  const on = await page.$$eval(R + '.st-vars .st-var.on', els => els.map(e => e.textContent));
  eq(on.length, 1, 'still exactly one in use'); ok(label && new RegExp(label).test(on[0] || ''), label + ' is now in use: ' + on[0]);
});

await T.t('VB3: no page error and no browser dialog', async () => { eq(errors, [], 'none'); });
const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
