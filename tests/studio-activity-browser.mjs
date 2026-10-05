/* The Studio's activity panel (S12b) in real Chromium against the worker module, providers MOCKED: while a slow image
 * generation runs, the panel is live and says what the worker is doing ("the image model is making the background image
 * at 1K"), the card's bar is indeterminate (no share invented from the clock), the header chip says 1 running; when it
 * finishes the card is done at 100; a render the provider refuses shows as failed with the explanation and a Retry; the
 * run counter counts finished steps. Run: node --experimental-sqlite tests/studio-activity-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8830, inspect: false });
const { api } = fx; const R = '#studio-root ';
const T = runner('studio-activity-browser (every running process visible: phase while a call is in flight, counts not clocks, failures with a Retry)');
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Activity', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'set', campaignConfirmed: true } })).id;
const L = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a road', refs: [] }], palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' },
  layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 60, w: 88, h: 14, size: 6, weight: 800, color: '#FFFFFF', align: 'left', font: 'display' }] };
const A = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '4:5', title: 'Tile', copy: { headline: 'Not a subsidy' }, layout: L, mode: 'composition' })).asset.id;
const openProject = async (page) => { await page.waitForSelector(R + '.st-lib tbody tr:has-text("Activity")', { timeout: 20000 }); await page.click(R + '.st-lib tbody tr:has-text("Activity") button.st-lib-open'); await page.waitForSelector(R + '.st-railbtn.asset:has-text("Tile")', { timeout: 20000 }); await page.click(R + '.st-railbtn.asset:has-text("Tile")'); await page.waitForSelector(R + '.st-stage canvas', { timeout: 20000 }); };
let page;

await T.t('a slow image generation is visible while it runs: the panel is live, the summary carries the worker\'s phase, the card\'s bar is indeterminate with the elapsed time and the note that a model call shows no share, and the header chip says 1 running', async () => {
  fx.setProvider('gemini', 'slow'); fx.providers.slowMs = 9000;
  await api('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road at dusk', size: '1K' }, idem: 'act-r1' });
  page = await fx.open({ viewport: { width: 1366, height: 768 } });
  await openProject(page);   // the island steps the queued render as it opens; the step takes nine seconds
  await page.waitForSelector(R + '.st-workspace-activity.live', { timeout: 20000 });
  await page.waitForFunction(() => /image model is making the background image at 1K/.test((document.querySelector('#studio-root .st-work-now') || {}).textContent || ''), null, { timeout: 15000 });
  const now = await page.textContent(R + '.st-work-now'); ok(/image model is making/.test(now) && /\d+ s/.test(now), 'the summary says what runs and for how long: ' + now);
  ok(/1 running/.test(await page.textContent(R + '.st-activity.on')), 'the header chip counts it');
  await page.click(R + '.st-work-toggle'); await page.waitForSelector(R + '.st-work-card[data-stage="render"]', { timeout: 5000 });
  eq(await page.$eval(R + '.st-work-card[data-stage="render"]', el => el.dataset.phase), 'generating', 'the card carries the worker\'s phase');
  ok(await page.$(R + '.st-work-card[data-stage="render"] .st-progress-track.indeterminate.active'), 'the bar is indeterminate: no share is invented for a model call');
  eq(await page.$eval(R + '.st-work-card[data-stage="render"] .st-progress-track', el => el.getAttribute('aria-valuenow')), null, 'and it claims no value');
  ok(/one image model call; no share until it answers/.test(await page.textContent(R + '.st-work-card[data-stage="render"] .st-work-meta')), 'the meta says why');
  ok(await page.$(R + '.st-work-card[data-stage="render"] button:has-text("Cancel")'), 'a running job can be cancelled from the card');
});

await T.t('when it finishes the card is done with a full bar, the panel says just finished, and the typical duration is read from the worker\'s history on the next run', async () => {
  await page.waitForSelector(R + '.st-work-card.done[data-stage="render"]', { timeout: 30000 });
  eq(await page.$eval(R + '.st-work-card.done[data-stage="render"] .st-progress-track > span', el => el.style.width), '100%', 'done is a full bar');
  ok(/Just finished/i.test(await page.textContent(R + '.st-work-eyebrow')), 'the eyebrow says just finished');
  const st = await api('GET', '/studio/status'); ok(st.durations && st.durations.render && st.durations.render.n >= 1, 'the worker holds the render duration: ' + JSON.stringify(st.durations));
  const g = await api('GET', '/studio/get?id=' + P); const a = g.assets.find(x => x.id === A); ok(a.versions.some(v => v.kind === 'render'), 'the render landed as a version');
});

await T.t('a render the provider refuses is failed in the panel with the explanation and a Retry, the header chip says needs attention, and the run counter counts finished steps only', async () => {
  fx.setProvider('gemini', 'down');
  await api('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'again', size: '1K' }, idem: 'act-r2' });
  const p2 = await fx.open({ viewport: { width: 1366, height: 768 }, quiet: true }); await openProject(p2);
  await p2.waitForSelector(R + '.st-workspace-activity.failed', { timeout: 60000 });
  await p2.click(R + '.st-work-toggle'); await p2.waitForSelector(R + '.st-work-card.failed', { timeout: 5000 });
  const err = await p2.textContent(R + '.st-work-card.failed .st-work-error'); ok(err.trim().length > 8, 'the failure is explained: ' + err.slice(0, 120));
  ok(await p2.$(R + '.st-work-card.failed button:has-text("Retry")'), 'Retry is offered');
  ok(/needs attention/.test(await p2.textContent(R + '.st-activity.bad')), 'the header chip says needs attention');
  const run = await p2.$(R + '.st-work-run'); if (run) { const t = await run.textContent(); ok(/1 of 2/.test(t), 'one of the two steps in this run finished: ' + t); }
  ok(!p2.errors.length, 'no page errors: ' + p2.errors.join(' | ')); await p2.ctxB.close();
  fx.setProvider('gemini', 'ok');
});

ok(!page.errors.length, 'no page errors on the first page: ' + page.errors.join(' | '));
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
