/* S30: the p46 audit's browser findings (CREATIVE-STUDIO.md s.56), in real Chromium against the worker module in this process
 * with every provider MOCKED. Each case fails on 263f043 and passes with its fix.
 *   QA1  Copy: words typed over a headline that a teammate then saved are not saved over theirs after a reload - the stage
 *        says the saved words changed and asks (Keep mine / Take theirs); two tabs editing one field ask the same way
 *   QA2  Deliver: the package is made from the project as the worker holds it when the button is pressed; a piece that moved
 *        to a newer version since the list was drawn stops it with the piece named, and no file is downloaded
 *   QA3  Generate imagery after a failed render queues a new attempt (it used to answer with the failed job and queue nothing)
 *   QA7  a strategy confirm naming a campaign the kit no longer has is refused before anything is confirmed
 *   QA8  Full AI production on a brief that says "No imagery" is refused before anything changes
 * Run: node --experimental-sqlite tests/studio-s30-browser.mjs   (S30_PORT picks the static server's port, default 8886) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.S30_PORT || 8886), inspect: false });
const { api } = fx;
const T = runner('S30: the p46 audit in the browser (copy conflicts, delivery from the current record)');
const s = await seedStages(fx, { prefix: 'S30', only: ['strategy', 'directions', 'copy'] });
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const getA = async (P, i) => (await api('GET', '/studio/get?id=' + P)).assets[i || 0];
const curCopy = a => a.versions.find(v => v.id === a.current).copy;
async function toCopy(page) {
  await openProject(page, 'S30 at copy'); await sleep(500);
  await page.locator(R + '.st-step:has(.st-step-l:text-is("Copy"))').first().click();
  await page.waitForSelector(R + '#st-cf-headline', { timeout: 15000 }); await sleep(400);
}
const notice = page => page.evaluate(() => Array.from(document.querySelectorAll('#studio-root .st-copy-edit [role="alert"]')).map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' || '));

await T.t('QA1: a draft typed over a headline a teammate then saved is not saved over theirs after a reload; Keep mine saves it on purpose', async () => {
  const page = await fx.open({ quiet: true });
  try {
    await toCopy(page);
    const ta = page.locator(R + '#st-cf-headline'); await ta.click(); await ta.press('End'); await ta.type(' DRAFTA');
    const a1 = await getA(s.copy, 0); const t = await api('POST', '/studio/version', { asset: a1.id, revision: a1.revision, copy: { headline: 'TEAMMATE WORDS' }, note: 'teammate' });
    ok(t && !t.error, 'the teammate saved: ' + JSON.stringify(t).slice(0, 120));
    await page.reload(); await page.waitForFunction(() => typeof go === 'function' && window.STRender); await sleep(1200);
    if (!(await page.$(R + '#st-cf-headline'))) await toCopy(page);
    ok(/DRAFTA/.test(await page.inputValue(R + '#st-cf-headline')), 'the draft came back after the reload');
    await page.locator(R + '#st-cf-headline').click(); await page.locator(R + '#st-cf-support').click(); await sleep(1500);
    eq(curCopy(await getA(s.copy, 0)).headline, 'TEAMMATE WORDS', 'leaving the field did not save over the teammate\'s words');
    const n = await notice(page); ok(/changed after you started typing/.test(n) && /TEAMMATE WORDS/.test(n), 'the stage says so and shows what is saved: ' + n);
    eq((await page.textContent(R + '.st-copy-badge')).trim(), 'Changed elsewhere');
    await page.click(R + '.st-copy-edit button:has-text("Keep mine")');
    for (let i = 0; i < 40 && !/DRAFTA/.test(curCopy(await getA(s.copy, 0)).headline); i++) await sleep(150);
    ok(/DRAFTA/.test(curCopy(await getA(s.copy, 0)).headline), 'Keep mine saved the draft on purpose');
    await sleep(600); eq(await notice(page), '', 'the question is gone once answered');
  } finally { await page.ctxB.close(); }
});

await T.t('QA1: two tabs editing one field - the second asks instead of saving over the first; Take theirs puts the saved words back', async () => {
  const pA = await fx.open({ quiet: true }); const pB = await fx.open({ quiet: true });
  try {
    await toCopy(pA); await toCopy(pB);
    for (const [pg, w] of [[pA, ' TABA'], [pB, ' TABB']]) { const ta = pg.locator(R + '#st-cf-support'); await ta.click(); await ta.press('End'); await ta.type(w); }
    await pA.locator(R + '#st-cf-cta').click();
    for (let i = 0; i < 40 && !/TABA/.test(curCopy(await getA(s.copy, 0)).support || ''); i++) await sleep(150);
    ok(/TABA$/.test(curCopy(await getA(s.copy, 0)).support), 'tab A saved');
    await pB.locator(R + '#st-cf-cta').click(); await sleep(2000);
    ok(/TABA$/.test(curCopy(await getA(s.copy, 0)).support), 'tab B did not save over tab A');
    const n = await notice(pB); ok(/Changed elsewhere while you typed|changed after you started typing/.test(n), 'tab B is asked: ' + n);
    await pB.click(R + '.st-copy-edit button:has-text("Take theirs")'); await sleep(1200);
    ok(/TABA$/.test(await pB.inputValue(R + '#st-cf-support')), 'Take theirs shows the saved words: ' + await pB.inputValue(R + '#st-cf-support'));
  } finally { await pA.ctxB.close(); await pB.ctxB.close(); }
});

await T.t('QA2: a piece that moved to a newer version after the Deliver list was drawn stops the package with its name; nothing is downloaded', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S30 deliver', brief: { objective: 'o', message: 'm', channels: ['facebook'], deliverable: 'copy', campaignConfirmed: true } });
  const P = (pr.project || pr).id;
  const as = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'Words only', mode: 'copy', copy: { headline: 'Mining builds the nation', caption: 'A plain caption.' } })).asset;
  const ap = await api('POST', '/studio/approve', { asset: as.id, version: as.current, part: 'copy', decision: 'approve', reason: 'copy ready for delivery' });
  ok(ap && !ap.error, 'approved: ' + JSON.stringify(ap).slice(0, 160));
  const page = await fx.open({ quiet: true });
  try {
    let downloads = 0; page.on('download', () => { downloads++; });
    await openProject(page, 'S30 deliver'); await sleep(600);
    await goStep(page, 'Deliver'); await page.waitForSelector(R + '.st-exportstage .st-stagehead button:has-text("Prepare the package")', { timeout: 15000 });
    // a teammate edits the words: a new version, and the approval no longer stands on it
    const a1 = (await api('GET', '/studio/get?id=' + P)).assets[0];
    await api('POST', '/studio/version', { asset: a1.id, revision: a1.revision, copy: { headline: 'Mining builds the nation, every day' }, note: 'teammate' });
    await page.click(R + '.st-exportstage .st-stagehead button:has-text("Prepare the package")');
    let msg = ''; for (let i = 0; i < 60; i++) { msg = await page.evaluate(() => document.querySelector('#studio-root .st-exportstage').textContent.replace(/\s+/g, ' ')); if (/No bundle was made/.test(msg)) break; await sleep(150); }
    ok(/Words only/.test(msg) && /moved to version 2/.test(msg) && /No bundle was made/.test(msg), 'the stop names the piece and its version: ' + msg.slice(0, 400));
    await sleep(800); eq(downloads, 0, 'nothing was downloaded');
  } finally { await page.ctxB.close(); }
});

await T.t('QA3: after a failed render, Generate imagery queues a new attempt for the same version', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S30 imagery', brief: { objective: 'o', message: 'm', channels: ['facebook'], campaignConfirmed: true } });
  const P = (pr.project || pr).id;
  const as = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'Tile', mode: 'composition', copy: { headline: 'Mining builds the nation' }, layout: LAYOUT })).asset;
  fx.setProvider('gemini', 'down'); let q1;
  try {
    q1 = await api('POST', '/studio/imagery', { asset: as.id }); ok(q1.ok && q1.jobs.length === 1, 'first ask queued: ' + JSON.stringify(q1).slice(0, 200));
    let j = null; for (let i = 0; i < 6; i++) { j = (await api('POST', '/studio/job/step', { id: q1.jobs[0] })).job; if (j && (j.state === 'failed' || j.state === 'done')) break; }
    eq(j.state, 'failed', 'the render failed with the provider down');
  } finally { fx.setProvider('gemini', 'ok'); }
  const q2 = await api('POST', '/studio/imagery', { asset: as.id }); ok(q2.ok && q2.jobs.length === 1, 'asking again queued: ' + JSON.stringify(q2).slice(0, 200));
  ok(q2.jobs[0] !== q1.jobs[0], 'a new job, not the failed one');
  const g = await api('GET', '/studio/job?id=' + q2.jobs[0]); eq((g.job || g).state, 'queued');
});

await T.t('QA7: a strategy confirm naming a campaign the kit does not have is refused and confirms nothing', async () => {
  await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel' }, { id: 'national', name: 'Australian mining' }] });
  const s7 = await seedStages(fx, { prefix: 'S30q7', only: ['strategy'], campaign: '' });
  let g = await api('GET', '/studio/get?id=' + s7.strategy); const sid = ((g.intel || {}).strategies || [])[0].id;
  const r = await api('POST', '/studio/workflow/confirm', { project: s7.strategy, step: 'strategy', strategy: sid, campaign: 'gone' });
  eq(r.error, 'unknown_campaign');
  g = await api('GET', '/studio/get?id=' + s7.strategy);
  ok(!(((g.brief.intel || {}).confirmed || {}).strategy), 'the strategy was not confirmed: ' + JSON.stringify(((g.brief.intel || {}).confirmed || {})).slice(0, 160));
  ok(!(g.thread || []).some(e => e.kind === 'workflow' && /Confirmed the .* response strategy/.test(e.text || '')), 'no confirmation on the thread');
});

await T.t('QA8: Full AI production on a brief that says "No imagery" is refused, and nothing changes', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S30 no imagery', brief: { objective: 'o', message: 'm', channels: ['facebook'], imagery: 'none', campaignConfirmed: true } });
  const P = (pr.project || pr).id;
  const as = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'facebook', format: '1:1', title: 'Tile', mode: 'composition', copy: { headline: 'Mining builds the nation' }, layout: LAYOUT })).asset;
  const r = await api('POST', '/studio/production', { project: P, mode: 'finished' });
  eq(r.error, 'finished_needs_imagery', JSON.stringify(r).slice(0, 200));
  const g = await api('GET', '/studio/get?id=' + P); eq(g.assets[0].versions.length, 1, 'no version was written'); eq((g.jobs || []).filter(j => j.stage === 'render').length, 0, 'no render queued');
  ok(as, 'asset');
});

const r = await T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
