/* R5: the client knowledge engine in the page (P51, Phase 3 of prompts/studio-engines-and-canvas.md), in real Chromium against
 * the worker module in this process, every provider MOCKED. Each case fails on the P50 commit and passes with its change.
 *   KV1 the Brand workspace shows what the Studio knows: every item with authority, scope, status, source, last confirmation
 *       and uses; possible duplicates are listed and merged only by a person, with a reason; an expired fact is confirmed by a
 *       person and comes back into production
 *   KV2 the guided Brief states what blocks or holds work before anything is spent, each with its one action
 *   KV3 the Brand workspace says what the Studio has learned: every rule with how often and when it was last applied, rules
 *       proposed for review kept by a person with a reason, contradictions, and the learning summary
 *   KV4 the reading's kept and set-aside paragraphs show their evidence (the matcher, entity, campaign term or client name)
 * Run: node --experimental-sqlite tests/studio-r5-browser.mjs   (R5_PORT picks the static server's port, default 8892) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, openTool } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.R5_PORT || 8892), inspect: false });
const { api } = fx;
const T = runner('R5: the client knowledge engine (browser)');
const past = new Date(Date.now() - 5 * 864e5).toISOString().slice(0, 10);
const kit0 = (await api('GET', '/brand/kit?ns=mca')).kit || {};
await api('POST', '/brand/kit', { ns: 'mca', facts: (kit0.facts || []).concat([
  { id: 'r5dup', text: 'More than 150,000 businesses use the fuel tax credit.', source: 'ATO 2023', status: 'approved', campaign: 'hoof' },
  { id: 'r5old', text: '12 per cent of diesel is used on farms.', source: 'ABS 2019', status: 'approved', reviewBy: past }]) });
await api('POST', '/brand/item', { ns: 'mca', campaign: 'hoof', kind: 'fact', authority: 'rule', title: 'More than 150,000 businesses use the fuel tax credit', body: 'ATO', reason: 'from the brief' });
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'R5 knowledge' })).id;
await seedStages(fx, { prefix: 'R5', only: ['brief', 'objectives'] });
fx.env.MIND_DB.db.exec("CREATE TABLE IF NOT EXISTS engine_fixes(id TEXT PRIMARY KEY, ns TEXT, task TEXT, scope TEXT, wrong TEXT, rightt TEXT, why TEXT, rule TEXT, exemplar TEXT, source TEXT, who TEXT, created INTEGER, active INTEGER DEFAULT 1, hits INTEGER DEFAULT 0)");
await api('GET', '/engine/status?ns=mca');
fx.env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('r5old','mca','copy','client','','','w','R5 OLD RULE: close with the nation','','teach','Dee',?,1,0)").run(Date.now() - 200 * 864e5);

await T.t('KV1: the Brand workspace lists the knowledge with its provenance, merges duplicates by a person, confirms an expired fact', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    page.on('dialog', d => { if (d.studio) d.accept(/Merge/.test(d.message()) ? 'the same figure; the kit fact is the approved wording' : 'checked against ABS 2024'); });
    await openProject(page, 'R5 knowledge'); await openTool(page, 'Brand'); await page.waitForSelector(R + '.st-brand');
    await page.selectOption(R + 'select[aria-label="Campaign scope"]', 'hoof');
    const S = 'section[aria-label="What the Studio knows"]';
    await page.waitForSelector(R + S + ' .st-know-table tbody tr', { timeout: 15000 });
    const head = await page.$$eval(R + S + ' .st-know-table thead th', els => els.map(e => e.textContent.trim()));
    eq(head, ['Knowledge', 'Authority', 'Scope', 'Status', 'Source', 'Confirmed', 'Used in'], 'the columns');
    const t = (await page.textContent(R + S)).replace(/\s+/g, ' ');
    ok(/1 expired/.test(t) && /possible duplicate/.test(t), 'the strip: ' + t.slice(0, 300));
    ok(await page.$(R + S + ' tr[data-id="r5old"]:has-text("expired")'), 'the expired fact is marked');
    ok(await page.$(R + S + ' [data-dup*="r5dup"]'), 'the duplicate pair is listed');
    // merge, by a person, with a reason
    await page.click(R + S + ' [data-dup*="r5dup"] button:has-text("Merge")');
    await page.waitForFunction(S => !document.querySelector('#studio-root ' + S + ' [data-dup*="r5dup"]'), S, { timeout: 15000 });
    ok(fx.seen.some(x => x.method === 'POST' && x.path === '/brand/knowledge/merge' && /approved wording/.test(x.body || '')), 'merged with the reason');
    // confirm the expired fact
    await page.click(R + S + ' tr[data-id="r5old"] button:has-text("confirm")');
    await page.waitForFunction(S => { const r = document.querySelector('#studio-root ' + S + ' tr[data-id="r5old"]'); return r && /active/.test(r.textContent); }, S, { timeout: 15000 });
    const f = ((await api('GET', '/brand/kit?ns=mca')).kit.facts || []).find(x => x.id === 'r5old'); ok(f && f.reviewBy > past && f.confirmedAt, JSON.stringify(f));
  } finally { await page.context().close(); }
});

await T.t('KV2: the guided Brief says what to settle before anything is spent, each with its action', async () => {
  await api('POST', '/brand/kit', { ns: 'mca', facts: ((await api('GET', '/brand/kit?ns=mca')).kit.facts || []).map(f => f.id === 'r5old' ? Object.assign({}, f, { reviewBy: past }) : f) });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R5 at the brief'); await page.waitForSelector(R + '.st-gaps', { timeout: 15000 });
    const t = (await page.textContent(R + '.st-gaps')).replace(/\s+/g, ' ');
    ok(/Before anything is spent/.test(t) && /past the review date/.test(t), t);
    ok(await page.$(R + '.st-gaps [data-gap="facts_expired"] button:has-text("Confirm in Brand")'), 'the expired facts carry their action');
    await page.click(R + '.st-gaps [data-gap="facts_expired"] button'); await page.waitForSelector(R + '.st-brand', { timeout: 15000 });
    ok(true, 'the action opens Brand');
  } finally { await page.context().close(); }
});

await T.t('KV3: the Brand workspace says what the Studio has learned; a rule proposed for review is kept by a person with a reason', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    page.on('dialog', d => { if (d.studio) d.accept('still the national sign-off'); });
    await openProject(page, 'R5 knowledge'); await openTool(page, 'Brand'); await page.waitForSelector(R + '.st-brand');
    const S = 'section[aria-label="What the Studio has learned"]';
    await page.waitForSelector(R + S + ' .st-mem-table tbody tr', { timeout: 15000 }).catch(async e => { throw new Error('memory section: ' + ((await page.textContent(R + S).catch(() => 'absent')) || '').slice(0, 300)); });
    const head = await page.$$eval(R + S + ' .st-mem-table thead th', els => els.map(e => e.textContent.trim()));
    eq(head, ['Rule', 'Scope', 'Applied', 'Last applied', 'Taught by', 'State'], 'the columns');
    ok(await page.$(R + S + ' [data-review="r5old"]'), 'the unused national rule is proposed for review');
    ok(/Learning summary/.test(await page.textContent(R + S)), 'the summary');
    await page.click(R + S + ' [data-review="r5old"] button:has-text("Keep")');
    await page.waitForFunction(S => !document.querySelector('#studio-root ' + S + ' [data-review="r5old"]'), S, { timeout: 15000 });
    ok(fx.seen.some(x => x.method === 'POST' && x.path === '/engine/fix/review' && /national sign-off/.test(x.body || '')), 'kept with the reason');
  } finally { await page.context().close(); }
});

await T.t('KV4: the reading\'s kept and set-aside paragraphs show their evidence', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R5 at objectives'); await sleep(500);
    await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#studio-root .st-step, #studio-root [role="tab"], #studio-root button')).find(x => /^\s*0?1\s*Brief|^Brief$/.test((x.textContent || '').trim())); if (b) b.click(); });
    const tog = R + 'button.st-tools-toggle:has-text("What was kept and what was set aside")';
    await page.waitForSelector(tog, { timeout: 15000 }); await page.click(tog);
    await page.waitForSelector(R + '.st-an-paras thead th:has-text("Evidence")', { timeout: 10000 });
    const cells = await page.$$eval(R + '.st-an-paras tbody tr td:last-child', els => els.map(e => e.textContent.trim()));
    ok(cells.length > 0 && cells.every(c => c.length > 0), 'every paragraph says its evidence or that it has none: ' + cells.join(' | '));
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
