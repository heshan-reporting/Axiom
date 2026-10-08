/* S22 in real Chromium against the worker module, providers MOCKED: the 8 October report - "Understanding your brief" sat
 * on "Checking campaign relevance, topics, issues, facts and risks ... 1 of 4" with only a clock moving ("one model call: no
 * share is shown until it answers"), and the person could not tell a long answer from a stuck one. The reading is one call
 * at high effort that can write for minutes; it now streams, and the page shows it:
 *   A. while the model writes, the card counts the steps finished (2 of 4, not 1 of 4) and the characters that have
 *      arrived, and the count grows; the understanding opens when the answer is complete;
 *   B. a connection that drops while the step runs (a proxy, a network change) does not end the job: the job lives in the
 *      worker, so the page reads it again, waits while the runner finishes, and opens the understanding - no "could not be
 *      stepped" and no second attempt.
 * The stub streams its answer as server-sent events, as the Messages API does. Run: node --experimental-sqlite tests/studio-s22-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { wizardCreate } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8846, inspect: false });
const R = '#studio-root ';
const T = runner('studio-s22-browser (a long reading shown as it is written; a dropped connection does not end it)');
const MATERIAL = ['Fuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy for miners.', 'The MCA analysis showing mining paid $74 billion in company tax and royalties is being quoted by regional MPs.', 'Housing approvals fell for the third month.'].join('\n\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

await T.t('A. while the model writes, the card counts 2 of 4 steps and the characters that have arrived, the count grows, and the understanding opens when the answer is complete', async () => {
  fx.setProvider('claude', 'stream'); fx.providers.streamMs = 14000;
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  const made = wizardCreate(page, { title: 'Streamed reading', text: MATERIAL });
  let done = false; made.then(() => { done = true; }, () => { done = true; });
  const seen = [];
  for (let i = 0; i < 120 && !done; i++) {
    const c = await page.$(R + '.st-proc');
    if (c) { const s = await page.$(R + '.st-proc-stream'); seen.push({ text: (await c.textContent()).replace(/\s+/g, ' '), written: s ? Number(await s.getAttribute('data-written')) : null, thinking: s ? Number(await s.getAttribute('data-thinking')) : null }); }
    await sleep(300);
  }
  await made;
  const streamed = seen.filter(x => x.written != null);
  ok(streamed.length, 'the card showed the answer as it arrived: ' + JSON.stringify(seen.slice(-3)));
  ok(streamed.some(x => /characters of (the answer written|reasoning so far)/.test(x.text)), 'in characters: ' + streamed[0].text.slice(0, 260));
  ok(streamed.every(x => /2 of 4/.test(x.text)), 'two of the four steps are counted finished while the model writes: ' + streamed[0].text.slice(0, 260));
  ok(!seen.some(x => /no share is shown until it answers/.test(x.text)), 'the card no longer says nothing can be shown');
  const values = streamed.map(x => x.written + x.thinking).filter((v, i, a) => a.indexOf(v) === i);
  ok(values.length >= 2 && values[values.length - 1] > values[0], 'the count grew while it ran: ' + JSON.stringify(values));
  ok(await page.$(R + '.st-under'), 'the understanding opened');
  const g = await fx.api('GET', '/studio/list?ns=mca'); const pr = (g.projects || []).find(x => x.title === 'Streamed reading'); ok(pr, 'the project exists');
  const full = await fx.api('GET', '/studio/get?id=' + pr.id); const job = (full.jobs || []).find(j => j.stage === 'analyse');
  eq([job.state, job.attempts], ['done', 1], 'one attempt, done');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

await T.t('B. a connection that drops while the step runs does not end the job: the page reads it again, waits for the runner, and opens the understanding without an error or a second attempt', async () => {
  fx.setProvider('claude', 'stream'); fx.providers.streamMs = 7000;
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  const f = fx.failNext(/^\/studio\/job\/step/, 0, null, { abort: true, detach: true });
  await wizardCreate(page, { title: 'Dropped step', text: MATERIAL });
  eq(f.hit, 1, 'the first step lost its connection while the worker carried on');
  await f.running;
  ok(!(await page.$(R + '.st-notice:has-text("could not be stepped")')) && !(await page.$(R + '.st-notice:has-text("Cannot reach the worker")')), 'no error for a connection the job survived');
  ok(await page.$(R + '.st-under'), 'the understanding opened');
  const g = await fx.api('GET', '/studio/list?ns=mca'); const pr = (g.projects || []).find(x => x.title === 'Dropped step');
  const full = await fx.api('GET', '/studio/get?id=' + pr.id); const jobs = (full.jobs || []).filter(j => j.stage === 'analyse');
  eq(jobs.map(j => [j.state, j.attempts]), [['done', 1]], 'one job, finished on its first attempt: the page waited instead of starting another');
  ok(full.brief && full.brief.analysis, 'the reading is filed');
  ok(!page.errors.length, 'no page errors: ' + page.errors.join(' | ')); await page.ctxB.close();
});

fx.setProvider('claude', 'ok');
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
