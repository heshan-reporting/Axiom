/* R4: the engines release, in real Chromium against the worker module in this process, every provider MOCKED
 * (prompts/studio-engines-and-canvas.md). Each case fails on 4587190 and passes with its change.
 *   C1  every button in the Studio that starts model or image work says what it costs, in its words or its title, in every
 *       step of the seeded projects (a person never spends without being told)
 *   S7  hostile words in the archive (a headline carrying markup and a script) never run in the legacy views the page draws
 *       with innerHTML (Command, Newsroom, Sentinel), and the Studio
 *   P2a the Copy step shows each piece's channel craft and voice adherence as measurements, each line with its source, and says
 *       none of it blocks approval
 *   P2b a text layer on the canvas offers Rewrite (Shorter, Plainer, More urgent, Fix to the facts, In the campaign's tone), each
 *       one model call, sent as a revise job scoped to that layer of the asset on screen
 * Run: node --experimental-sqlite tests/studio-r4-browser.mjs   (R4_PORT picks the static server's port, default 8890) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.R4_PORT || 8890), inspect: false });
const { api } = fx;
const T = runner('R4: the engines release (browser)');
const S = await seedStages(fx, { prefix: 'R4', only: ['brief', 'objectives', 'strategy', 'directions', 'copy', 'design'] });

// the verbs that start paid work, and the words that state a cost
const PAID = /^(produce|generate|write the|write copy|draft|analyse|create and analyse|propose|review v|re-?render|suggest for|suggest photographs|regenerate|apply and render|run the recipe|run recipe|make variations|explore|create a new design|refine|rewrite|plan the sequence|adapt for|three headline|shorter headline|plainer words|ask the)/i;
const COST = /model call|calls?\b|render|image call|no model|free|requests?\b/i;

await T.t('C1: every paid button, in every step, says what it costs', async () => {
  const bad = []; let page = null;
  try {
    const scan = async where => {
      const found = await page.$$eval(R + 'button', els => els.filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled; }).map(b => ({ t: (b.textContent || '').replace(/\s+/g, ' ').trim(), title: b.getAttribute('title') || '', aria: b.getAttribute('aria-label') || '' })));
      found.filter(b => PAID.test(b.t) || PAID.test(b.aria)).forEach(b => { if (!COST.test(b.t + ' ' + b.title + ' ' + b.aria)) bad.push(where + ': "' + b.t.slice(0, 60) + '"'); });
    };
    for (const [title, steps] of [['R4 at the brief', ['Brief']], ['R4 at objectives', ['Plan']], ['R4 at strategy', ['Plan']], ['R4 at directions', ['Direction']], ['R4 at copy', ['Copy']], ['R4 at design', ['Create', 'Review']]]) {
      page = await fx.open({ viewport: { width: 1440, height: 900 } });
      try { await openProject(page, title); await sleep(700);
        for (const st of steps) { await goStep(page, st); await sleep(900); await scan(title + ' / ' + st); } } finally { await page.context().close(); }
    }
  } finally {}
  eq(Array.from(new Set(bad)), [], 'paid buttons without a cost');
});

await T.t('S7: a headline carrying markup and a script never runs in the legacy views or the Studio', async () => {
  const evil = '<img src=x onerror="window.__xss=(window.__xss||0)+1"><script>window.__xss=(window.__xss||0)+1</script>"\'><svg onload="window.__xss=(window.__xss||0)+1">';
  const now = Date.now();
  const rows = ['news', 'reddit_thread', 'sig_thread'].map((kind, i) => ({ kind, src: 'test', title: 'Fuel tax credit ' + evil, body: 'Body ' + evil, url: 'https://example.com/a' + i + '?' + now, ts: now - i * 1000, meta: { issues: ['fuel_tax_credits'], platform: 'reddit' } }));
  await api('POST', '/archive/add', { rows });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    for (const v of ['command', 'newsroom', 'sentinel', 'signals', 'narratives', 'studio']) { await page.evaluate(v2 => { try { go(v2); } catch (e) {} }, v); await sleep(1500); }
    eq(await page.evaluate(() => window.__xss || 0), 0, 'no hostile script ran');
  } finally { await page.context().close(); }
});

await T.t('P2a: Copy shows the craft and voice of the piece as measurements, with their sources', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R4 at copy'); await sleep(600); await goStep(page, 'Copy'); await page.waitForSelector(R + '.st-craft', { timeout: 15000 });
    const t = (await page.textContent(R + '.st-craft')).replace(/\s+/g, ' ');
    ok(/Measured/.test(t) && /not a model's opinion/.test(t) && /blocks approval/.test(t), 'labelled as measurements: ' + t.slice(0, 200));
    const keys = await page.$$eval(R + '.st-craft [data-measure]', els => els.map(e => e.dataset.measure));
    ok(['headline_fit', 'one_message'].every(k => keys.indexOf(k) >= 0), 'the craft measures: ' + keys.join(', '));
    ok(/Voice adherence/.test(t) && /\d+ \/ 100/.test(t), 'the voice score: ' + t.slice(0, 400));
    const srcs = await page.$$eval(R + '.st-craft .st-craft-src', els => els.map(e => e.textContent.trim()));
    ok(srcs.length >= 4 && srcs.every(x => x.length > 2), 'every line names its source: ' + srcs.join(' | '));
  } finally { await page.context().close(); }
});

await T.t('P2b: Rewrite on a canvas text layer sends one revise job scoped to that layer, and says it costs one model call', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R4 at design'); await sleep(600); await goStep(page, 'Create'); await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 20000 });
    await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(300); const lid = await page.$eval(R + '.st-le-layer[aria-label="Layer headline"]', e => e.dataset.id);
    await page.click(R + '.st-fbar-rw'); await page.waitForSelector(R + '.st-rw-menu');
    const items = await page.$$eval(R + '.st-rw-item', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
    eq(items.length, 5, 'five rewrites: ' + items.join(' | ')); ok(items.every(x => /1 model call/.test(x)), 'each says its cost');
    const n0 = fx.seen.length;
    await page.click(R + '.st-rw-item[data-rewrite="shorter"]'); await sleep(1500);
    const jobs = fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path === '/studio/job').map(x => JSON.parse(x.body || '{}'));
    eq(jobs.length, 1, 'one job'); eq(jobs[0].stage, 'revise'); eq(jobs[0].input.layers, [lid], 'scoped to the layer'); ok(/shorter/i.test(jobs[0].input.instruction) && /Change only that layer/.test(jobs[0].input.instruction), jobs[0].input.instruction);
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
