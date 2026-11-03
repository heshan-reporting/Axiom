/* Studio test readiness (S28) in real Chromium against the worker module, providers MOCKED. The cases failed on d2a51b1.
 *   H1 the stage lines say the worst case a paid action can reach (re-plan and retries included), from the worker's own policy, and
 *      the Studio's paid question says that a failed request is retried and counted;
 *   H2 the Copy step, its checkbox and Review agree on what "ready for design" is;
 *   H3 the client review page refuses a link that points at another server;
 *   H5 Review measures the pieces that have no measurement itself (free, never an approval);
 *   M1 the header says configured, budget left and the last answer apart, not "Models ready";
 *   M6 the library tells test projects apart and archives them in one go, asking first;
 *   C2 Report a problem sends the codes and request ids and what the tester wrote, never the key;
 *   no page error and no browser dialog.
 * Run: node --experimental-sqlite tests/studio-ready-browser.mjs */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.READY_PORT) || 8871, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-ready-browser (stated ceilings, ready wording, review page origin, Review measures, provider chip, test projects, problem reports)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
await seedStages(fx, { only: ['directions', 'copy', 'design'], prefix: 'Ready' });
const pageErrors = [];
async function lib(o) {
  const page = await fx.open(Object.assign({ viewport: { width: 1440, height: 900 }, quiet: true }, o || {}));
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('dialog', d => { if (d.studio) return; pageErrors.push('unexpected browser dialog: ' + d.message().slice(0, 120)); d.dismiss(); });
  await page.waitForSelector(R + '.st-lib', { timeout: 15000 }); return page;
}
async function openProject(page, title) {
  const row = R + '.st-lib tbody tr:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(600);
}
const phase = async (page, name) => { await page.click(R + '.st-step:has(.st-step-l:text-matches("^' + name + '"))'); await sleep(900); };
const text = async page => ((await page.textContent(R)) || '').replace(/\s+/g, ' ');

await T.t('H1 the stage lines state the worst case from the worker\'s policy; the Studio\'s paid question says retries are counted', async () => {
  const page = await lib(); await openProject(page, 'Ready at directions'); await phase(page, 'Direction');
  ok(/At most 6 requests for one ask/.test(await text(page)), 'Explore names its ceiling: ' + (await text(page)).match(/AI.{0,200}/));
  await phase(page, 'Copy'); ok(/At most 6 requests \(a re-plan and retries included\)/.test(await text(page)), 'Copy names its ceiling');
  const pending = page.evaluate(() => window.STKit.ask({ title: 'Spend one call?', text: 'A test of the paid question.', cost: '1 model call', paid: true }));
  await page.waitForSelector(R + '.st-ask', { timeout: 5000 });
  ok(/retried \(at most 3 times\).*counts every request sent/.test(await page.textContent(R + '.st-ask')), 'the paid question states the rule');
  await page.click(R + '.st-ask .st-ask-cancel'); eq(await pending, false);
  await page.ctxB.close();
});

await T.t('H2 the Copy step and Review agree: ready for design is the agency\'s approval of the words, a hand-off that files nothing in the client\'s memory', async () => {
  const page = await lib(); await openProject(page, 'Ready at copy'); await phase(page, 'Copy');
  const t = await text(page); ok(!/Ready for design is not approval/.test(t), 'the contradiction is gone');
  ok(/Ready for design is the agency's approval of these words/.test(t) && /files nothing in the client's memory/.test(t), 'the Copy step says what the tick is');
  await page.ctxB.close();
});

await T.t('H3 the client review page refuses a link that points at another server, and asks it nothing', async () => {
  const ctxB = await (await import('./pw.mjs')).chromium.launch().then(b => b.newContext());
  const page = await ctxB.newPage(); const asked = [];
  page.on('request', r => { if (/example\.invalid/.test(r.url())) asked.push(r.url()); });
  await page.goto('http://127.0.0.1:' + fx.PORT + '/review.html#t=' + 'x'.repeat(40) + '&w=' + encodeURIComponent('https://evil.example.invalid'));
  await page.waitForSelector('[role="alert"]', { timeout: 10000 });
  ok(/points at another server/.test(await page.textContent('[role="alert"]')), await page.textContent('[role="alert"]'));
  eq(asked, [], 'no request to the other server'); await ctxB.browser().close();
});

await T.t('H5 Review measures the pieces with no measurement itself, free, and never approves anything', async () => {
  const page = await lib(); await openProject(page, 'Ready at design'); await phase(page, 'Review');
  await page.waitForSelector(R + '.st-measure-all button', { timeout: 15000 });
  const before = await api('GET', '/studio/get?id=' + (await api('GET', '/studio/list?ns=mca')).projects.find(p => p.title === 'Ready at design').id);
  const unmeasured = before.assets.filter(a => a.readiness && /not_validated|stale/.test(a.readiness.technical)).length; ok(unmeasured >= 1, 'something to measure: ' + unmeasured);
  const approvalsBefore = before.assets.map(a => JSON.stringify(a.approvals || {}));
  await page.click(R + '.st-measure-all button');
  await page.waitForSelector(R + '.st-measure-all:has-text("Measured")', { timeout: 30000 });
  const after = await api('GET', '/studio/get?id=' + before.id);
  eq(after.assets.filter(a => a.readiness && /not_validated|stale/.test(a.readiness.technical)).length, 0, 'every piece now has a current measurement');
  eq(after.assets.map(a => JSON.stringify(a.approvals || {})), approvalsBefore, 'no approval was made');
  await page.ctxB.close();
});

await T.t('M1 the header says what is configured, how much budget is left and how the providers last answered', async () => {
  const page = await lib(); await openProject(page, 'Ready at copy');
  const chip = page.locator(R + '.st-prov').first(); await chip.waitFor({ timeout: 10000 });
  const t = await chip.textContent(); ok(!/Models ready/.test(t) && /left today/.test(t), 'no blanket "ready": ' + t);
  const title = await chip.getAttribute('title'); ok(/(Budget )?[Ll]eft today/.test(title) && /Last answer: Claude/.test(title) && /Configured is not the same as working/.test(title), title);
  await page.ctxB.close();
});

await T.t('M6 the library marks test projects, filters them, and archives them in one go after asking; live work stays', async () => {
  await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Tester sandbox A', test: true, brief: { objective: 'x', message: 'y' } });
  await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Tester sandbox B', test: true, brief: { objective: 'x', message: 'y' } });
  const page = await lib();
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("Tester sandbox A") .st-test-chip', { timeout: 15000 });
  await page.selectOption(R + 'select[aria-label="Live work or test projects"]', 'test'); await sleep(300);
  ok(!(await page.locator(R + '.st-lib tbody tr:has-text("Ready at copy")').count()), 'live work filtered out');
  await page.click(R + 'button:has-text("Archive all test projects")');
  await page.waitForSelector(R + '.st-ask', { timeout: 5000 }); ok(/not deleted/.test(await page.textContent(R + '.st-ask')), 'the question says archived, not deleted');
  await page.click(R + '.st-ask .st-ask-ok'); await sleep(1500);
  const left = (await api('GET', '/studio/list?ns=mca&tests=only')).projects; eq(left.length, 0, 'no test project left: ' + left.map(p => p.title));
  ok((await api('GET', '/studio/list?ns=mca')).projects.some(p => p.title === 'Ready at copy'), 'live work stays');
  await page.ctxB.close();
});

await T.t('C2 Report a problem sends what happened with the last codes and request ids, never the key', async () => {
  const page = await lib(); await openProject(page, 'Ready at copy');
  await page.click(R + 'button[aria-controls="st-help"]'); await page.waitForSelector(R + '.st-report', { timeout: 5000 });
  await page.fill(R + '.st-report textarea', 'The copy tab flickered after I pressed Ready.');
  await page.click(R + '.st-report button:has-text("Send to the team")');
  await page.waitForSelector(R + '.st-report [role="status"]:has-text("Sent to the team")', { timeout: 10000 });
  const fb = (await api('GET', '/studio/feedback')).reports[0];
  ok(fb && /flickered/.test(fb.note) && fb.project && fb.view && fb.browser && fb.window, JSON.stringify(fb));
  ok(!/full-key/.test(JSON.stringify(fb)), 'the key never travels in a report');
  await page.ctxB.close();
});

await T.t('no page error and no browser dialog', async () => { eq(pageErrors, [], 'no page error and no browser dialog'); });
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
