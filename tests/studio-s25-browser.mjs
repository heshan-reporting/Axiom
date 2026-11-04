/* S25 in real Chromium against the worker module, providers MOCKED (3 November 2026):
 *   R1 the Creative Partner's review keeps three judgements apart - Measured, AI advice, Person - and shows the five scores, the
 *      verdict, the round and composed / imagery only exactly as the inspection returned them (unusual values here, so nothing
 *      hard-coded can pass), and says a score is never an approval;
 *   R2 a suggestion can be dismissed for this version and restored (since S26 the worker keeps it: one POST, nothing else);
 *   R3 choosing another direction after copy was written names the pieces in a dialog (no browser confirm): Cancel changes
 *      nothing; "keep them as written" chooses it and Copy stays clear;
 *   R4 a brief field Axiom has nothing reliable for says so, with the reason;
 *   R5 the review's three-judgement line fits at desktop, tablet and phone sizes: no sideways scroll, nothing cut off;
 *   R6 no page error across the cases.
 * Run: node --experimental-sqlite tests/studio-s25-browser.mjs */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.S25_PORT) || 8898, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s25-browser (the review says measured, AI and person apart; dismiss; the direction-change dialog; empty brief fields; three sizes)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// an inspection with values no default could produce
fx.answerWith(/inspecting a rendered social tile/, () => ({ fidelity: 2, hierarchy: 5, readability: 1, relevance: 3, identity: 5,
  reasons: { fidelity: 'R25 the road is generic', hierarchy: 'R25 the headline leads clearly', readability: 'R25 grey on grey', relevance: 'R25 half the tile is about fuel', identity: 'R25 the teal is the campaign' },
  words: { present: [], wrong: [] }, issues: [{ text: 'R25 the support line does not read', severity: 'blocking', element: 'support' }], verdict: 'redo',
  fix: { kind: 'design', element: 'support', keeps: 'the words', instruction: 'Darken the panel behind the support line.' }, note: 'R25' }));
const seeded = await seedStages(fx, { only: ['copy', 'design'], prefix: 'S25' });
const pageErrors = [];
let page;
async function openProject(title, viewport) {
  page = await fx.open({ viewport: viewport || { width: 1440, height: 900 }, quiet: true }); page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('dialog', d => { pageErrors.push('unexpected browser dialog: ' + d.message().slice(0, 120)); d.dismiss(); });
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
}
async function toDirector() {
  await page.click(R + '.st-step:has(.st-step-l:text-is("Create"))');
  const asset = page.locator(R + '.st-assetpick, ' + R + '.st-pagechip').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 15000 }); await sleep(600);
  const tab = page.locator(R + '.st-instab:has-text("Creative Partner"), ' + R + 'button:has-text("Creative Partner")').first(); if (await tab.count()) await tab.click();
  const rv = page.locator(R + '.st-cd-tabs button:has-text("Review"), ' + R + '[role="tab"]:has-text("Review")').first(); if (await rv.count()) await rv.click();
  await page.waitForSelector(R + '.st-cd-sources', { timeout: 10000 });
}

await T.t('R1 the review keeps Measured, AI advice and Person apart, and shows the scores, verdict, round and composed status as returned', async () => {
  const P = seeded.design; const g = await api('GET', '/studio/get?id=' + P); const A = g.assets[0];
  const j = await api('POST', '/studio/job', { project: P, asset: A.id, stage: 'inspect', input: {}, idem: 'inspect:s25' });
  for (let i = 0; i < 6 && j.job && /queued|running/.test(j.job.state); i++) j.job = (await api('POST', '/studio/job/step', { id: j.job.id })).job;
  ok(j.job && j.job.state === 'done', 'the inspection ran: ' + JSON.stringify(j.job && { s: j.job.state, e: j.job.error }));
  await openProject('S25 at design'); await toDirector();
  const src = await page.$$eval(R + '.st-cd-sources > div', ds => ds.map(d => [d.getAttribute('data-k'), d.querySelector('dt').textContent, d.querySelector('dd').textContent]));
  eq(src.map(x => x[1]), ['Measured', 'AI advice', 'Person'], 'three judgements, in that order');
  ok(/verdict redo/.test(src[1][2]), 'the AI advice is the returned verdict: ' + src[1][2]);
  ok(/not approved|copy approved; design not yet/.test(src[2][2]), 'the person column is the approvals on record (copy marked ready, design not approved): ' + src[2][2]);
  ok(/never an approval/.test(await page.textContent(R + '.st-cd-sources-note')), 'and it says a score is never an approval');
  const scores = await page.$$eval(R + '.st-cd-scores li', ls => ls.map(l => l.textContent.replace(/\s+/g, ' ').trim()));
  eq(scores.length, 5, 'five dimensions');
  ok(/^fidelity 2 \/ 5 R25/.test(scores[0]) && /^hierarchy 5 \/ 5/.test(scores[1]) && /^readability 1 \/ 5 R25 grey on grey/.test(scores[2]) && /^relevance 3 \/ 5/.test(scores[3]) && /^identity 5 \/ 5/.test(scores[4]), 'the scores and reasons as returned: ' + JSON.stringify(scores));
  const head = (await page.textContent(R + '.st-cd-verdict')).replace(/\s+/g, ' ');
  ok(/verdict: redo/.test(head) && /round 1 of 2/.test(head) && /(composed tile|imagery only)/.test(head), 'verdict, round and what it saw: ' + head);
  await page.ctxB.close();
});

await T.t('R2 a suggestion is dismissed for this version and restored; the only write is the dismissal itself', async () => {
  await openProject('S25 at design'); await toDirector();
  const ex = page.locator(R + '.st-cd-tabs button:has-text("Suggestions"), ' + R + '[role="tab"]:has-text("Explore")').first(); if (await ex.count()) await ex.click();
  const ask = page.locator(R + 'button:has-text("Suggest for this version")').first();
  if (await ask.count()) { await ask.click(); }
  await page.waitForSelector(R + '.st-sugg-item', { timeout: 15000 });
  const n0 = await page.locator(R + '.st-sugg-item').count(); const first = (await page.textContent(R + '.st-sugg-item .st-sugg-text')).trim();
  const before = fx.seen.length;
  await page.locator(R + '.st-sugg-item .st-sugg-dismiss').first().click(); await sleep(200);
  eq(await page.locator(R + '.st-sugg-item').count(), n0 - 1, 'one fewer shown');
  ok(/1 dismissed for this version/.test(await page.textContent(R + '.st-sugg-dismissed')), 'and the count says so');
  const writes = fx.seen.slice(before).filter(x => x.method !== 'GET').map(x => x.method + ' ' + x.path);
  ok(writes.length === 1 && writes[0] === 'POST /studio/suggest/dismiss', 'one write, the dismissal (S26: the team\'s, not this browser\'s): ' + JSON.stringify(writes));
  await page.click(R + '.st-sugg-dismissed button'); await page.locator(R + '.st-sugg-item:has-text("' + first.slice(0, 30).replace(/"/g, '') + '") .st-sugg-dismiss:has-text("Restore")').first().click(); await sleep(200);
  eq(await page.locator(R + '.st-sugg-item').count(), n0, 'restored');
  await page.ctxB.close();
});

await T.t('R3 another direction after copy was written: a dialog names the pieces; Cancel changes nothing; keep chooses it and Copy stays clear', async () => {
  const P = seeded.copy; const g = await api('GET', '/studio/get?id=' + P); const other = g.directions.find(d => !d.chosen && !d.archived);
  await openProject('S25 at copy');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Direction"))'); await sleep(600);
  const card = page.locator(R + 'article.st-dcard:has(h4:text-is("' + other.title.replace(/"/g, '') + '"))').first();
  await card.locator('button:has-text("Select"), button:has-text("Choose"), button:has-text("Use this")').first().click();
  await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 10000 });
  const txt = (await page.textContent(R + '.st-impact[data-kind="direction"]')).replace(/\s+/g, ' ');
  ok(/2 pieces were written from/.test(txt) && g.assets.every(a => txt.indexOf(a.title) >= 0), 'the pieces are named: ' + txt.slice(0, 300));
  await page.click(R + '.st-impact button:has-text("Cancel")'); await sleep(300);
  eq((await api('GET', '/studio/get?id=' + P)).directions.find(d => d.chosen).id, g.directions.find(d => d.chosen).id, 'Cancel left the choice as it was');
  await card.locator('button:has-text("Select"), button:has-text("Choose"), button:has-text("Use this")').first().click();
  await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 10000 });
  await page.click(R + '.st-impact button:has-text("keep them as written")'); await sleep(800);
  const g2 = await api('GET', '/studio/get?id=' + P);
  eq(g2.directions.find(d => d.chosen).id, other.id, 'the new direction is chosen'); ok(g2.workflow.steps.copy.why !== 'other_direction', 'and the pieces are current under it');
  await page.ctxB.close();
});

await T.t('R4 a brief field with nothing reliable on file says so, with the reason', async () => {
  // a classic (free-order) project shows the brief's fields with their suggestions; the field checked is one the worker says it
  // holds nothing for (the seeded HOOF projects give the others suggestions)
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S25 classic brief', brief: { channels: ['facebook'] } });
  const sg = await api('GET', '/studio/brief/suggest?project=' + pr.id); const k = ['audience', 'objective', 'deliverables', 'action', 'message'].find(f => sg.empty && sg.empty[f]);
  ok(k, 'the worker names at least one field it holds nothing reliable for: ' + JSON.stringify(sg.empty));
  await openProject('S25 classic brief');
  await page.waitForSelector('#brief-' + k, { timeout: 10000 }); await page.waitForSelector(R + '.st-brief-src', { timeout: 10000 });   // the suggestions have arrived
  await page.focus('#brief-' + k); await page.waitForSelector(R + '.st-combo-none', { timeout: 10000 });
  const t = await page.textContent(R + '.st-combo-none');
  eq(t.trim(), sg.empty[k], 'the note under the ' + k + ' field is the worker\'s reason');
  await page.ctxB.close();
});

await T.t('R5 the measured, AI and person line of the review fits at 1440 x 900, 834 x 1194 and 390 x 844', async () => {
  for (const vp of [{ width: 1440, height: 900 }, { width: 834, height: 1194 }, { width: 390, height: 844 }]) {
    await openProject('S25 at design', vp);
    await page.click(R + '.st-step:has(.st-step-l:text-is("Create"))');
    const asset = page.locator(R + '.st-assetpick, ' + R + '.st-pagechip').first(); if (await asset.count()) await asset.click(); await sleep(800);
    const drawer = page.locator(R + '.st-insp-toggle').first(); if (await drawer.count() && await drawer.isVisible()) { await drawer.click(); await sleep(300); }
    const tab = page.locator(R + '.st-instab:has-text("Creative Partner"), ' + R + 'button:has-text("Creative Partner")').first(); if (await tab.count() && await tab.isVisible()) await tab.click();
    await page.waitForSelector(R + '.st-cd-sources', { timeout: 10000 });
    const m = await page.evaluate(sel => { const el = document.querySelector(sel); const r = el.getBoundingClientRect(); const kids = Array.from(el.children).map(c => { const b = c.getBoundingClientRect(); return { w: b.width, clipped: c.scrollWidth > c.clientWidth + 1 }; }); return { side: document.documentElement.scrollWidth > window.innerWidth + 1, right: r.right, vw: window.innerWidth, kids }; }, R + '.st-cd-sources');
    ok(!m.side, vp.width + ': no sideways scroll'); ok(m.right <= m.vw + 1, vp.width + ': the line is inside the window (' + Math.round(m.right) + ' of ' + m.vw + ')');
    ok(m.kids.every(k => k.w > 40 && !k.clipped), vp.width + ': each judgement readable, none cut off: ' + JSON.stringify(m.kids));
    await page.ctxB.close();
  }
});

await T.t('R6 no page error across the cases', async () => {
  eq(pageErrors, [], 'no page error and no browser dialog');
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
