/* A review that does the work, in real Chromium against the worker module in this process, every provider MOCKED (the 25 November
 * report: a review that named "three unapproved caption paragraphs in the lower band" as blocking, beside "Measured: passes", and
 * left the team to carry its correction out by hand).
 *   CR1 the review says where the piece stands in one line, lists what to fix row by row with the layer each row is about (said
 *       once, never "in the lower band on band"), and explains why the measurements pass while the reviewer names a blocker
 *   CR2 a finding about a layer that carries none of the approved words is hidden in one press: a layout version, no render and no
 *       model call; the review then says it judged the version before
 *   CR3 "Apply the correction and review the result" is one press: the correction lands as a new version, the result is reviewed
 *       by itself (one more call, stated on the button), and the two reviews are read before and after, with a compare
 *   CR4 the reviewer is never asked twice for one result, and nothing fails on the page
 * Run: node --experimental-sqlite tests/studio-cdreview-browser.mjs   (CDR_PORT picks the port, default 8896) */
import { makeStudio, runner, ok, eq, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';
import { pngGradientB64 } from './worker-png.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.CDR_PORT || 8896), inspect: false });
const { api } = fx;
const T = runner('studio-cdreview-browser (the review is a worklist: hide for free, fix and review again in one press, before and after)');
const FIRST = { fidelity: 4, hierarchy: 2, readability: 4, relevance: 4, identity: 4, reasons: { hierarchy: 'Three paragraphs crowd the lower band' }, words: { present: [], wrong: [], missing: [] },
  issues: [{ text: 'Three paragraphs of body copy crowd the tile in the lower band', severity: 'blocking', element: 'band' }, { text: 'The headline could be larger', severity: 'cosmetic', element: 'none' }], verdict: 'fix',
  fix: { kind: 'design', element: 'band', instruction: 'Remove the body copy in the lower band; keep the headline and support where they are.', keeps: 'the headline, the support and the photograph' }, note: 'One fix.' };
const AFTER = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 4, reasons: { hierarchy: 'The headline leads' }, words: { present: [], wrong: [], missing: [] }, issues: [], verdict: 'ship', note: 'Clean.' };
// the correction (a revise) changes the headline; a review of the tile that carries the new headline is the review of the result
fx.answerWith(/inspecting a rendered social tile/, (sys, user) => (/Not a subsidy\. Never was\./.test(user) ? AFTER : FIRST));
const seeded = await seedStages(fx, { only: ['design'], prefix: 'CDR' });
const P = seeded.design;
const g0 = await api('GET', '/studio/get?id=' + P);
const assets = g0.assets.filter(a => a.mode !== 'copy');
ok(assets.length >= 2, 'two visual pieces to work on (' + assets.length + ')');
const step = async id => { let j; for (let i = 0; i < 10; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
// each piece gets a caption layer drawn on the tile (the reported tile's "lower band") and one review naming it
for (const A of assets.slice(0, 2)) {
  const v = A.versions.find(x => x.id === A.current); const L = JSON.parse(JSON.stringify(v.layout));
  L.layers.push({ id: 'band', role: 'caption', type: 'text', text: 'Gas plants keep factories running. Ports load it. Towns depend on it.', x: 6, y: 80, w: 88, h: 10, size: 2.4, color: '#FFFFFF' });
  const r = await api('POST', '/studio/version', { asset: A.id, revision: A.revision, layout: L, kind: 'layout', note: 'a caption band added' }); ok(r.version, 'the band is on ' + A.title + ': ' + JSON.stringify(r).slice(0, 160));
  const j = await api('POST', '/studio/job', { project: P, asset: A.id, stage: 'inspect', input: { version: r.version.id }, idem: 'cdr:' + A.id });
  eq((await step(j.job.id)).state, 'done', 'the first review of ' + A.title + ' ran');
}
const inspectCalls = () => fx.calls.bySys.filter(s => /inspecting a rendered social tile/.test(s)).length;
const errors = [];
const open = async title => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true }); page.on('pageerror', e => errors.push(String(e.message)));
  page.on('dialog', d => { if (!d.studio) { errors.push('browser dialog: ' + d.message()); d.dismiss(); } });
  await openProject(page, 'CDR at design'); await sleep(600); await goStep(page, 'Design'); await sleep(1500);
  await page.locator(R + '.st-pagechip:has-text("' + title + '")').first().click(); await sleep(1200);
  await place(page, 'creative director'); await page.click(R + '.st-cd-tab:has-text("Review")'); await page.waitForSelector(R + '.st-cd-review .st-cd-verdict', { timeout: 15000 });
  return page;
};
const text = async (page, sel) => ((await page.textContent(R + sel)) || '').replace(/\s+/g, ' ');

await T.t('CR1: one line says where the piece stands; each finding is a row with its layer, said once', async () => {
  const page = await open(assets[0].title);
  try {
    const st = await text(page, '.st-cd-status'); ok(/Needs work: 1 blocking, 1 cosmetic/.test(st), 'the status line: ' + st);
    eq(await page.$eval(R + '.st-cd-status', e => e.getAttribute('role')), 'status', 'and it is announced');
    const rows = await page.$$eval(R + '.st-cd-issues > li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
    eq(rows.length, 2, 'two findings, as rows'); ok(/^blocking/.test(rows[0]) && /cosmetic/.test(rows[1]), 'the most serious first: ' + JSON.stringify(rows));
    ok(/layer caption/.test(rows[0]) && !/lower band on band/.test(rows[0]), 'the row names its layer once: ' + rows[0]);
    const all = await text(page, '.st-cd-review'); ok(/measurements pass because they judge geometry|measurements also fail( \(\d+ blocking\))?: Fix layout in Checks/.test(all), 'the review says how it stands against the measurements: ' + all.slice(0, 300));
    ok(await page.$(R + '.st-cd-issues > li:first-child button:has-text("Hide it (free)")'), 'the caption layer can be hidden for free');
    ok(!(await page.$(R + '.st-cd-issues > li:nth-child(2) button:has-text("Hide it")')), 'a finding about no layer offers no hide');
  } finally { await page.context().close(); }
});

await T.t('CR2: Hide it (free) is a layout version with no render and no model call; the review then judged the version before', async () => {
  const page = await open(assets[0].title);
  try {
    const calls0 = fx.calls.anthropic; const g1 = await api('GET', '/studio/get?id=' + P); const A1 = g1.assets.find(a => a.id === assets[0].id); const n0 = A1.versions.length;
    await page.click(R + '.st-cd-issues > li:first-child button:has-text("Hide it (free)")');
    await page.waitForFunction(() => /you are on v/.test((document.querySelector('#studio-root .st-cd-status') || {}).textContent || ''), null, { timeout: 15000 });
    const g2 = await api('GET', '/studio/get?id=' + P); const A2 = g2.assets.find(a => a.id === assets[0].id); const v2 = A2.versions.find(x => x.id === A2.current);
    eq(A2.versions.length, n0 + 1, 'one new version'); ok(v2.layout.layers.find(l => l.id === 'band').hidden === true, 'the band is hidden on it');
    ok(v2.kind === 'layout' && /hid the caption on the review/.test(v2.note || ''), 'a layout version that says why: ' + v2.kind + ' / ' + v2.note);
    eq(fx.calls.anthropic, calls0, 'no model call was made');
    ok(/Review v\d+ \(1 model call\)/.test(await text(page, '.st-adreview-head')), 'and a review of the new version is one press');
  } finally { await page.context().close(); }
});

await T.t('CR3: Apply the correction and review the result is one press; the two reviews read before and after', async () => {
  const page = await open(assets[1].title);
  try {
    const before = inspectCalls();
    const btn = page.locator(R + '.st-cd-review button:has-text("Apply the correction and review the result")'); ok(await btn.count(), 'the one-press fix is offered');
    ok(/then one more call to review the result/.test(await text(page, '.st-cd-fixfacts')), 'its cost says both calls');
    await btn.click();
    await page.waitForSelector(R + '.st-cd-delta', { timeout: 40000 });
    const d = await text(page, '.st-cd-delta'); ok(/After the correction/.test(d) && /fix, 1 blocking, 1 cosmetic/.test(d) && /ship, no issue named/.test(d), 'before and after: ' + d);
    ok(await page.$(R + '.st-cd-delta button:has-text("Compare")'), 'with a compare of the two versions');
    const st = await text(page, '.st-cd-status'); ok(/Ready in the reviewer's opinion|The reviewer says ship, but the measurements fail/.test(st) && !/no issue named/.test(st), 'the status follows the new review, and a ship over a failing measurement says so: ' + st);
    eq(inspectCalls() - before, 1, 'the result was reviewed once, by itself');
    const g = await api('GET', '/studio/get?id=' + P); const A = g.assets.find(a => a.id === assets[1].id);
    const jid = ((g.jobs || []).filter(j => j.stage === 'revise').pop() || {}).id; const job = jid ? ((await api('GET', '/studio/job?id=' + jid)).job || {}) : {}; eq([(job.input || {}).asset, (job.input || {}).layers], [A.id, ['band']], 'the correction was scoped to the band layer');
    await page.click(R + '.st-cd-delta button:has-text("Compare")'); await sleep(500);
    ok(await page.$(R + '.st-vcmp'), 'Compare opens the two versions side by side');
  } finally { await page.context().close(); }
});

await T.t('CR4: no page error and no browser dialog across the cases', async () => { eq(errors, [], 'none'); });

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
