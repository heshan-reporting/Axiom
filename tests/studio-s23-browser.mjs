/* S23 in real Chromium against the worker module, providers MOCKED (nothing spent): the long operations, as a person sees them.
 *   F-B1 a long operation is acknowledged within 300 ms of the click and says what it is doing within 1 s;
 *   F-B2 while the model writes, the card shows a "Drafting" preview of what has finished arriving - read-only, never a button,
 *        gone when the answer is complete;
 *   F-B3 a step connection that drops shows "reconnecting" beside the job, then the job finishes without a second attempt;
 *   F-B4 desktop notices are opt-in: none without the toggle; with it, a job finishing while the tab is in the background says
 *        so, and the page does not move.
 * Run: node --experimental-sqlite tests/studio-s23-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
import { wizardCreate } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8873, inspect: false });
const R = '#studio-root ';
const T = runner('studio-s23-browser (long operations: acknowledged, described, drafting, reconnecting, notices)');
const MATERIAL = ['Fuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy for miners.', 'The MCA analysis showing mining paid $74 billion in company tax and royalties is being quoted by regional MPs.', 'Housing approvals fell for the third month.'].join('\n\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* records, in the page, when the analyse button was clicked, when the page first acknowledged it (the button disabled or a
   processing card shown) and when it first described the work (a card with a phase marked as current) */
const watchClicks = () => { window.__t = {}; document.addEventListener('click', e => { const b = e.target && e.target.closest && e.target.closest('button'); if (b && /Create and analyse/.test(b.textContent || '')) { window.__t.click = performance.now(); const btn = b;
  const check = () => { const now = performance.now(); if (!window.__t.ack && (btn.disabled || document.querySelector('#studio-root .st-proc') || document.querySelector('#studio-root [aria-busy="true"]'))) window.__t.ack = now; if (!window.__t.desc && document.querySelector('#studio-root .st-proc .st-proc-item.now, #studio-root .st-proc .st-proc-item.done')) window.__t.desc = now; if (!window.__t.desc) requestAnimationFrame(check); };
  requestAnimationFrame(check); } }, true); };

await T.t('F-B1 + F-B2 the reading is acknowledged within 300 ms, described within 1 s, and shows a read-only Drafting preview while the model writes', async () => {
  fx.setProvider('claude', 'stream'); fx.providers.streamMs = 9000;
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  await page.evaluate(watchClicks);
  const made = wizardCreate(page, { title: 'S23 drafting', text: MATERIAL }); let done = false; made.then(() => { done = true; }, () => { done = true; });
  const drafts = [];
  for (let i = 0; i < 200 && !done; i++) {
    const d = await page.$(R + '.st-proc .st-drafting');
    if (d) drafts.push({ text: (await d.textContent()).replace(/\s+/g, ' ').slice(0, 300), buttons: (await d.$$('button')).length, tag: !!(await d.$('.st-drafting-tag')) });
    await sleep(150);
  }
  await made;
  const t = await page.evaluate(() => window.__t);
  ok(t.click, 'the click was seen');
  ok(t.ack - t.click <= 300, 'acknowledged within 300 ms: ' + Math.round(t.ack - t.click) + ' ms');
  ok(t.desc - t.click <= 1000, 'described within 1 s: ' + Math.round(t.desc - t.click) + ' ms');
  ok(drafts.length, 'a Drafting preview was shown while the model wrote');
  ok(drafts.every(d => d.tag && /Drafting/.test(d.text)), 'it is labelled Drafting: ' + drafts[0].text);
  ok(drafts.every(d => d.buttons === 0), 'it offers nothing to act on');
  ok(!(await page.$(R + '.st-drafting')), 'the preview is gone once the answer is complete');
  ok(!page.errors.length, page.errors.join(' | ')); await page.ctxB.close();
  console.log('       timings: acknowledged ' + Math.round(t.ack - t.click) + ' ms, described ' + Math.round(t.desc - t.click) + ' ms; drafting samples ' + drafts.length);
});
await T.t('F-B3 a dropped step connection shows "reconnecting" beside the job, and the job finishes on its first attempt', async () => {
  fx.setProvider('claude', 'stream'); fx.providers.streamMs = 6000;
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  const f = fx.failNext(/^\/studio\/job\/step/, 0, null, { abort: true, detach: true });
  const made = wizardCreate(page, { title: 'S23 reconnect', text: MATERIAL }); let done = false; made.then(() => { done = true; }, () => { done = true; });
  let seen = false;
  for (let i = 0; i < 300 && !done; i++) { if (await page.$(R + '[data-state="reconnecting"]')) { seen = true; break; } await sleep(100); }
  await made; await f.running;
  ok(seen, 'the page said it was reconnecting');
  ok(!(await page.$(R + '[data-state="reconnecting"]')), 'and stopped saying so once the job was read again');
  const g = await fx.api('GET', '/studio/list?ns=mca'); const pr = (g.projects || []).find(x => x.title === 'S23 reconnect');
  const full = await fx.api('GET', '/studio/get?id=' + pr.id); eq(full.jobs.filter(j => j.stage === 'analyse').map(j => [j.state, j.attempts]), [['done', 1]]);
  ok(!page.errors.length, page.errors.join(' | ')); await page.ctxB.close();
});
await T.t('F-B4 desktop notices are opt-in: none without the toggle; with it a job finishing in the background says so and the page stays where it is', async () => {
  fx.setProvider('claude', 'ok');
  const init = () => { window.__notes = []; class N { constructor(t, o) { window.__notes.push({ t, body: (o || {}).body }); } close() {} static requestPermission() { return Promise.resolve('granted'); } } N.permission = 'granted'; window.Notification = N; let hidden = false; Object.defineProperty(document, 'hidden', { get: () => hidden, configurable: true }); window.__hide = v => { hidden = v; }; };
  const page = await fx.open({ viewport: { width: 1440, height: 900 }, init });
  await wizardCreate(page, { title: 'S23 notices', text: MATERIAL });
  const g = await fx.api('GET', '/studio/list?ns=mca'); const pr = (g.projects || []).find(x => x.title === 'S23 notices');
  const where = () => page.evaluate(() => location.hash + '|' + ((document.querySelector('#studio-root .st-step.on') || {}).textContent || ''));
  /* one scenario, run twice: a job this page knows is live (its own step held, as a long provider call would be), the tab goes
     to the background, the job finishes; the page reads it on its poll */
  const backgroundJob = async n => {
    const releaseSteps = fx.hold(/^\/studio\/job\/step$/);
    const j = await fx.api('POST', '/studio/job', { project: pr.id, stage: 'echo', input: { n }, idem: 'bg' + n });
    await page.reload(); await page.waitForFunction(() => typeof go === 'function'); await page.evaluate(() => go('studio')); await page.waitForSelector(R + '.st-head'); await sleep(1500);
    const before = await where(); await page.evaluate(() => window.__hide(true));
    await fx.api('POST', '/studio/job/step', { id: j.job.id }); await sleep(4000); releaseSteps(); await sleep(500);
    const after = await where(); await page.evaluate(() => window.__hide(false));
    eq(after, before, 'the page did not move (' + n + ')');
  };
  await backgroundJob(1);
  eq(await page.evaluate(() => window.__notes.length), 0, 'no notice without the opt-in');
  // turn notices on from the activity panel's details
  const det = page.locator(R + '.st-work-toggle, ' + R + '.st-work-line .ov-link:has-text("details")'); if (await det.count()) await det.first().click().catch(() => {});
  const toggle = page.locator(R + 'button:has-text("Notify me when a job finishes")');
  if (await toggle.count()) { await toggle.first().click(); await page.waitForSelector(R + 'button[aria-pressed="true"]:has-text("Desktop notices: on")'); }
  else await page.evaluate(() => { localStorage.setItem('ax_studio_notify', '1'); });   // the panel is closed when nothing runs: the same setting
  await backgroundJob(2);
  const notes = await page.evaluate(() => window.__notes);
  ok(notes.length >= 1 && /AXIOM Studio/.test(notes[0].t), 'a notice when the background job finished: ' + JSON.stringify(notes));
  ok(!page.errors.length, page.errors.join(' | ')); await page.ctxB.close();
});

fx.setProvider('claude', 'ok');
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
