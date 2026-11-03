/* S22 in real Chromium against the worker module, providers MOCKED: the 8 October report - "Understanding your brief" sat
 * on "Checking campaign relevance, topics, issues, facts and risks ... 1 of 4" with only a clock moving ("one model call: no
 * share is shown until it answers"), and the person could not tell a long answer from a stuck one. The reading is one call
 * at high effort that can write for minutes; it now streams, and the page shows it:
 *   A. while the model writes, the card counts the steps finished (2 of 4, not 1 of 4) and the characters that have
 *      arrived, and the count grows; the understanding opens when the answer is complete;
 *   C. the intermittent failure of A (47.7) reproduced: its sampler read two renders; A now takes one snapshot per sample;
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
    // one snapshot of one card per sample (3 November 2026): the text and the streamed counts are read in the same task, from
    // the same card; reading them in two awaits could pair the text of one render with the counts of the next (case C)
    const snap = await page.evaluate(sel => { const c = document.querySelector(sel + '.st-proc'); if (!c) return null; const s = c.querySelector('.st-proc-stream'); return { text: c.textContent.replace(/\s+/g, ' '), written: s ? Number(s.getAttribute('data-written')) : null, thinking: s ? Number(s.getAttribute('data-thinking')) : null }; }, R);
    if (snap) seen.push(snap);
    await sleep(300);
  }
  await made;
  const streamed = seen.filter(x => x.written != null);
  ok(streamed.length, 'the card showed the answer as it arrived: ' + JSON.stringify(seen.slice(-3)));
  ok(streamed.some(x => /characters of (the answer written|reasoning so far)/.test(x.text)), 'in characters: ' + streamed[0].text.slice(0, 260));
  const uncounted = streamed.filter(x => !/2 of 4/.test(x.text));
  ok(!uncounted.length, 'two of the four steps are counted finished while the model writes (' + uncounted.length + ' of ' + streamed.length + ' samples without; first at ' + streamed.indexOf(uncounted[0]) + '): ' + (uncounted[0] ? JSON.stringify(uncounted[0]).slice(0, 700) : ''));
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
/* C. The intermittent failure of case A (CREATIVE-STUDIO.md 47.7: 3 of about 30 runs, always on the first streamed sample)
 * reproduced deterministically. The worker writes the count with every progress record (2 of 4 while the model streams), and
 * the card renders it with the streamed figures; but the old sampler read the card's text and then, in a second await, the
 * stream figures from anywhere on the page. When the card moved from "Matching client knowledge (1 of 4)" to the model step
 * between those two reads, the sample paired the earlier text with the new figures: no "2 of 4", thinking 118 - the recorded
 * signature. Here the card is rendered in the two states with a render between the reads; the old sampler produces that
 * sample every time, and the snapshot sampler (one read of one card per sample, used by case A now) never does. */
await T.t('C. the case-A failure reproduced: two reads around a render pair the old text with the new counts; one snapshot never does', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.evaluate(() => {
    const host = document.createElement('div'); host.id = 't-card'; host.setAttribute('data-test', 'case-c'); document.body.appendChild(host);
    const root = ReactDOM.createRoot(host); const H = window.STKit.html, Card = window.STFlow.ProcessingCard;
    const job = phase => ({ id: 'jc', stage: 'analyse', state: 'running', attempts: 1, created: Date.now() - 6000, progress: { activity: phase === 'knowledge'
      ? { phase: 'knowledge', step: 'knowledge', label: 'Matching client knowledge', completed: 1, total: 4, startedAt: Date.now() - 6000, at: Date.now() }
      : { phase: 'model', step: 'model', label: 'thinking: 118 characters of reasoning so far', completed: 2, total: 4, thinking: 118, written: 0, streamAt: Date.now(), startedAt: Date.now() - 6000, at: Date.now() } } });
    window.__caseC = phase => ReactDOM.flushSync(() => root.render(H`<${Card} job=${job(phase)} kind="analyse" now=${Date.now()} />`));
    window.__caseC('knowledge');
  });
  // the old sampler: the card's text, then (a render lands) the stream figures, in two reads
  const text = (await page.textContent('#t-card .st-proc')).replace(/\s+/g, ' ');
  await page.evaluate(() => window.__caseC('model'));
  const sp = await page.$('#t-card .st-proc-stream'); const old = { text, thinking: sp ? Number(await sp.getAttribute('data-thinking')) : null };
  ok(!/2 of 4/.test(old.text) && /1 of 4/.test(old.text) && old.thinking === 118, 'two reads around one render give the recorded failure, every time: ' + JSON.stringify(old).slice(0, 300));
  // the snapshot sampler, for both renders: each sample is one card in one state
  const snapAt = () => page.evaluate(() => { const c = document.querySelector('#t-card .st-proc'); const s = c.querySelector('.st-proc-stream'); return { text: c.textContent.replace(/\s+/g, ' '), thinking: s ? Number(s.getAttribute('data-thinking')) : null }; });
  await page.evaluate(() => window.__caseC('knowledge')); const a = await snapAt();
  await page.evaluate(() => window.__caseC('model')); const b = await snapAt();
  ok(a.thinking === null && /1 of 4/.test(a.text), 'before the model streams: 1 of 4, no stream figures - ' + a.text.slice(0, 160));
  ok(b.thinking === 118 && /2 of 4/.test(b.text) && /118 characters of reasoning/.test(b.text), 'while it streams: 2 of 4 with the figures, in the same render - ' + b.text.slice(0, 200));
  await page.ctxB.close();
});

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
