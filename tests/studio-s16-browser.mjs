/* The intelligence engine in the page (S16), in real Chromium against the worker module in this process; providers MOCKED.
 * - Bring in material four ways: paste, a link, a file or screenshot, or something Axiom holds for the client (its
 *   Sentinel alert, its narrative, today's news on its issues, the daily brief).
 * - Axiom Understanding: what happened, why it matters to the client, whether to respond; the understanding with its
 *   basis; topics judged high / potential / not; the comparison with what Axiom knows; objectives ranked, key messages,
 *   response strategies; the choice fills the brief.
 * - Creative directions with visual narratives: compare two, produce both as variants (each in its own family by its own
 *   route), write the message kit from one, approve a piece with a reason; the trace follows the work into Copy.
 * Run: node --experimental-sqlite tests/studio-s16-browser.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8806 });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s16-browser (Axiom Understanding: material in, choices, directions compared, variants, message kit, trace; providers MOCKED)');
const ARTICLE = 'Fuel tax credits are back in the news after a Senate crossbencher called the credit a subsidy for miners and said it should be scrapped in the next budget. '.repeat(6);
const db = fx.env.MIND_DB.db;
let page, P;

await T.t('From Axiom lists what Axiom holds for this client; a Sentinel alert becomes the material and Axiom Understanding answers what happened, why it matters, whether to respond, with topics judged for the client', async () => {
  await api('GET', '/sentinel/alerts');
  db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,ratio,hot,baseline,angle,evidence,detected_ts) VALUES('mca','Minerals Council of Australia','ftc','Fuel tax credits',3.4,9,2.6,'','[]',?)").run(Date.now() - 3600e3);
  P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Situation room', brief: { channels: ['facebook', 'instagram'], deliverable: 'set', imageryTiming: 'after_copy', campaignConfirmed: true } })).id;
  page = await fx.open(); page.on('dialog', d => d.accept(d.type() === 'prompt' ? 'leads with the tax-paid fact' : undefined));
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("Situation room")'); await page.click(R + '.st-lib tbody tr:has-text("Situation room") .ov-link');
  await page.waitForSelector(R + '.st-analyse-open button, ' + R + '.st-analyse', { timeout: 15000 });
  if (await page.$(R + '.st-analyse-open button')) await page.click(R + '.st-analyse-open button');
  await page.click(R + '.st-via .st-segbtn:has-text("From Axiom")');
  await page.waitForSelector(R + '.st-feed-row:has-text("Fuel tax credits")', { timeout: 15000 });
  await page.click(R + '.st-feed-row:has-text("Fuel tax credits") button:has-text("Analyse")');
  await page.waitForSelector(R + '.st-intel', { timeout: 30000 });
  const sit = (await page.$eval(R + '.st-sit', e => e.innerText)).replace(/\s+/g, ' ');
  ok(/What happened A Senate crossbencher/i.test(sit) && /Why it matters to Minerals Council of Australia/i.test(sit) && /Should Minerals Council of Australia respond\? Yes\./i.test(sit), sit);
  ok(/Creative Intelligence Summary/i.test(await page.textContent(R + '.st-intel-sum')));
  const hi = await page.textContent(R + '.st-topic-col.high'); ok(/Fuel tax credits/.test(hi), hi); ok(/Gas reservation/.test(await page.textContent(R + '.st-topic-col.not')));
  await page.click(R + '.st-und summary'); ok(/stated/.test(await page.textContent(R + '.st-und-table')) && /inferred/.test(await page.textContent(R + '.st-und-table')), 'each field says where it came from');
  const g = await api('GET', '/studio/get?id=' + P); ok(/^Sentinel: Fuel tax credits/.test(g.sources[0].name), g.sources[0].name); eq(g.intel.input.type, 'news');
});

await T.t('objectives are ranked, key messages follow the chosen objective, strategies say which Axiom recommends; using the choices writes the brief and records them', async () => {
  const objs = await page.$$eval(R + '.st-choose-col:first-child .st-opt', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ')));
  ok(/^1\. Correct the subsidy claim/.test(objs[0].trim()) && /recommended/.test(objs[0]), objs[0]);
  await page.click(R + '.st-choose-col:first-child .st-opt:has-text("Reinforce the national campaign") input');
  ok(/Hands off our fuel/.test(await page.textContent(R + '.st-choose-col:nth-child(2)')), 'the messages follow the objective');
  await page.click(R + '.st-choose-col:first-child .st-opt:has-text("Correct the subsidy claim") input');
  await page.click(R + '.st-choose-col:nth-child(2) .st-opt:has-text("Mining pays its way") input');
  ok(/Axiom recommends/.test(await page.textContent(R + '.st-choose-col:nth-child(3) .st-opt:has-text("Evidence-led")')));
  await page.click(R + '.st-choose-col:nth-child(3) .st-opt:has-text("Evidence-led") input');
  await page.click(R + '.st-choose-acts button:has-text("Use these choices in the brief")');
  await page.waitForFunction(() => /These choices are in the brief/.test(document.querySelector('#studio-root .st-choose-acts').textContent), null, { timeout: 15000 });
  const g = await api('GET', '/studio/get?id=' + P);
  eq([g.brief.intel.selected.objective.id, g.brief.intel.selected.message.id, g.brief.intel.selected.strategy.kind], ['O1', 'M1.2', 'evidence']);
  eq(g.brief.objective, 'Correct the subsidy claim before it settles in the regions'); ok(/^Mining pays its way/.test(g.brief.message));
  eq(db.prepare("SELECT COUNT(*) AS n FROM studio_intel_log WHERE project=?").get(P).n, 3);
});

await T.t('two directions compared side by side, then produced as variants: each in its own family, the editable one editable and the finished one finished, with the trace in Copy', async () => {
  await page.click(R + '.st-an-narr:has-text("The quiet road") button:has-text("Show the visual narrative")');
  ok(/Lighting\s*low gold sun/.test(await page.textContent(R + '.st-an-narr:has-text("The quiet road") .st-vis')));
  await page.check(R + '.st-an-narr:has-text("The quiet road") .st-check input'); await page.check(R + '.st-an-narr:has-text("One striking poster") .st-check input');
  const rows = await page.$$eval(R + '.st-compare tbody tr', trs => trs.map(t => Array.from(t.children).map(c => c.innerText.trim()).join(' ')));
  ok(rows.some(r => /^Route editable layout Gemini finished/i.test(r.trim())), rows.join(' | ')); ok(rows.some(r => /^Approach data campaign continuation/i.test(r.trim())), rows.join(' | '));
  await page.click(R + '.st-compare button:has-text("Produce 2 as variants")');
  // the page stays on the Brief while the variants are made (the assets rail belongs to the later steps)
  let g = null; for (let i = 0; i < 240; i++) { g = await api('GET', '/studio/get?id=' + P); if (g.assets.length >= 4 && !(g.jobs || []).some(j => j.state === 'queued' || j.state === 'running')) break; await new Promise(r => setTimeout(r, 250)); }
  ok(g.assets.length >= 4, 'both variants produced: ' + g.assets.length);
  const fams = Array.from(new Set(g.assets.map(a => a.family))).sort(); eq(fams, ['Narrative: One striking poster', 'Narrative: The quiet road']);
  const cur = a => a.versions.find(v => v.id === a.current);
  ok(g.assets.filter(a => a.family === 'Narrative: The quiet road').every(a => cur(a).mode !== 'finished'), 'the editable direction is editable');
  ok(g.assets.filter(a => a.family === 'Narrative: One striking poster').every(a => cur(a).mode === 'finished'), 'the finished direction is finished');
  const q = g.assets.find(a => a.family === 'Narrative: The quiet road'); eq([cur(q).context.trace.objective, cur(q).context.trace.message], ['O1', 'M1.1']);
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#studio-root .st-step')).find(x => /Copy/.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector(R + '.st-copy-pick', { timeout: 15000 });
  await page.click(R + '.st-copy-pick:has-text("Facebook")');
  await page.waitForSelector(R + '.st-trace', { timeout: 15000 });
  const tr = (await page.$eval(R + '.st-trace', e => e.innerText)).replace(/\s+/g, ' ');
  ok(/Traceable to/i.test(tr) && /Source: Sentinel: Fuel tax credits/.test(tr) && /O1 Correct the subsidy claim/.test(tr) && /S1 evidence/.test(tr) && /Direction "/.test(tr), tr);
});

await T.t('the message kit is written from one direction, each piece traced and checked, and approved with a reason the engine records', async () => {
  await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#studio-root .st-step')).find(x => /Brief/.test(x.textContent)); if (b) b.click(); });
  await page.waitForSelector(R + '.st-an-narr:has-text("The quiet road")', { timeout: 15000 });
  for (const label of ['LinkedIn', 'Statement']) { const on = await page.getAttribute(R + '.st-kitpick .st-segbtn:has-text("' + label + '")', 'aria-pressed'); if (on === 'true' && label === 'LinkedIn') await page.click(R + '.st-kitpick .st-segbtn:has-text("LinkedIn")'); }
  // the kit is written from exactly one direction: tick that one (the comparison was left on the Brief before production)
  await page.uncheck(R + '.st-an-narr:has-text("One striking poster") .st-check input'); await page.check(R + '.st-an-narr:has-text("The quiet road") .st-check input');
  await page.click(R + '.st-kitpick button:has-text("Write the message kit")');
  // the kit is written as a job; the page stays on the Brief and the kit is read in Copy's Message kit tab
  for (let i = 0; i < 160 && !(((await api('GET', '/studio/texts?project=' + P)).texts || []).length); i++) await new Promise(r => setTimeout(r, 250));
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await page.click(R + '.st-subtab:has-text("Message kit")');
  await page.waitForSelector(R + '.st-kit-item', { timeout: 30000 });
  const items = await page.$$eval(R + '.st-kit-item h3', hs => hs.map(h => h.textContent)); ok(items.indexOf('Talking points') >= 0 && items.indexOf('Statement') >= 0, items.join(','));
  ok(/unsupported/.test(await page.textContent(R + '.st-kit-item:has(h3:text-is("Talking points"))')), 'the invented figure is flagged');
  ok(/Direction "The quiet road"/.test(await page.textContent(R + '.st-kit-item:has(h3:text-is("Statement")) .st-trace')));
  await page.click(R + '.st-kit-item:has(h3:text-is("Statement")) button:has-text("Approve")');
  await page.waitForFunction(() => /approved/.test(Array.from(document.querySelectorAll('#studio-root .st-kit-item')).find(x => /Statement/.test(x.querySelector('h3').textContent)).textContent), null, { timeout: 15000 });
  eq(db.prepare("SELECT COUNT(*) AS n FROM studio_intel_log WHERE project=? AND kind='approved'").get(P).n, 1);
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
