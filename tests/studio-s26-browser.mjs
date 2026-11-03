/* S26 in real Chromium against the worker module, providers MOCKED (4 November 2026):
 *   B1 a suggestion dismissed in one browser is dismissed for the whole team: a second browser with nothing stored sees it set
 *      aside, says who did it, and can restore it; a read-only key (which is shown no suggestions) has nothing to dismiss;
 *   B2 what a browser set aside before S26 (localStorage) is sent to the worker once and then forgotten locally;
 *   B3 a classic project (no wizard) asks in a dialog before a direction change leaves pieces written from another direction:
 *      no browser confirm, Cancel changes nothing, "rewrite later" chooses it and lists the pieces under Production > Needs
 *      attention, where Keep as written (free) clears one;
 *   B4 no page error and no browser dialog across the cases.
 * Run: node --experimental-sqlite tests/studio-s26-browser.mjs */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: Number(process.env.S26_PORT) || 8899, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s26-browser (dismissals are the team\'s; the classic direction dialog)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const seeded = await seedStages(fx, { only: ['design'], prefix: 'S26' });
const pageErrors = [];
async function openProject(title, o) {
  const page = await fx.open(Object.assign({ viewport: { width: 1440, height: 900 }, quiet: true }, o || {}));
  page.on('pageerror', e => pageErrors.push(String(e.message)));
  page.on('dialog', d => { pageErrors.push('unexpected browser dialog: ' + d.message().slice(0, 120)); d.dismiss(); });
  const row = R + '.st-lib tbody tr:has-text("' + title + '"), ' + R + '.st-libcard:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  return page;
}
async function toExplore(page) {
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  const asset = page.locator(R + '.st-assetpick, ' + R + '.st-pagechip').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"], ' + R + 'canvas', { timeout: 15000 }); await sleep(1500);   // a read-only key has the composition, not the editor
  // the inspector settles as the asset loads: open the Creative Director's Explore until its suggestions area is there
  for (let i = 0; i < 10; i++) {
    // a second click on an open tab folds it again: click only what is not open yet
    if (!(await page.locator(R + '.st-cd-tabs:visible').count())) { const tab = page.locator(R + '.st-instab:has-text("Creative Director"), ' + R + 'button:has-text("Creative Director")').first(); if (await tab.count()) await tab.click(); await sleep(300); }
    const ex = page.locator(R + '.st-cd-tabs:visible button:has-text("Explore")').first(); if (await ex.count() && (await ex.getAttribute('aria-selected')) !== 'true') await ex.click();
    if (await page.locator(R + 'button:has-text("Suggest for this version"), ' + R + '.st-sugg-item, ' + R + '.st-sugg-dismissed').count()) break; await sleep(700);
  }
  try { await page.waitForSelector(R + 'button:has-text("Suggest for this version"), ' + R + '.st-sugg-item, ' + R + '.st-sugg-dismissed', { timeout: 15000 }); }
  catch (e) { await page.screenshot({ path: 'tests/shots/s26-fail.png' }).catch(() => {}); throw new Error('no suggestions area: ' + ((await page.textContent(R + '.st-inspector').catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 500)); }
  const ask = page.locator(R + 'button:has-text("Suggest for this version")').first();
  if (await ask.count() && !(await page.locator(R + '.st-sugg-item, ' + R + '.st-sugg-dismissed').count())) await ask.click();
  await page.waitForSelector(R + '.st-sugg-item, ' + R + '.st-sugg-dismissed', { timeout: 15000 });
}

// the suggestions for the seeded tile, made once through the worker (the mocked model), so every browser reads the same cached set
const P = seeded.design; const g0 = await api('GET', '/studio/get?id=' + P); const A = g0.assets[0];
const made = await api('POST', '/studio/suggest', { project: P, asset: A.id }); ok(made.ok && made.design && made.design.length, 'suggestions made: ' + JSON.stringify(made).slice(0, 200));
// the island shows the first asset of the design step; find which one it opens and read its suggestions there
const peek = async id => api('GET', '/studio/suggest?asset=' + id);

await T.t('B1 a dismissal in one browser is the whole team\'s: a fresh browser sees it, with who; a read-only key has nothing to dismiss', async () => {
  const a = await openProject('S26 at design'); await toExplore(a);
  const first = (await a.textContent(R + '.st-sugg-item .st-sugg-text')).trim(); const n0 = await a.locator(R + '.st-sugg-item').count();
  await a.locator(R + '.st-sugg-item .st-sugg-dismiss').first().click();
  await a.waitForFunction(n => document.querySelectorAll('#studio-root .st-sugg-item').length === n - 1, n0, { timeout: 5000 });
  const shownAsset = await a.evaluate(() => { const r = document.querySelector('#studio-root'); return r && r.getAttribute('data-asset'); });
  await a.ctxB.close();
  // which asset carried it: the one whose cached suggestions now list a dismissal
  let hit = null; for (const x of g0.assets) { const pk = await peek(x.id); if ((pk.dismissed || []).length) hit = { asset: x.id, pk }; }
  ok(hit, 'the worker holds the dismissal' + (shownAsset ? ' (' + shownAsset + ')' : ''));
  eq(hit.pk.dismissed.length, 1); ok(hit.pk.dismissed[0].key.endsWith(first) && hit.pk.dismissed[0].who === 'Hesh', JSON.stringify(hit.pk.dismissed));
  // a second browser: nothing in its storage, the same answer
  const b = await openProject('S26 at design'); await toExplore(b);
  eq(await b.locator(R + '.st-sugg-item').count(), n0 - 1, 'the second browser shows it set aside too');
  ok(/1 dismissed for this version, for the whole team/.test(await b.textContent(R + '.st-sugg-dismissed')));
  await b.click(R + '.st-sugg-dismissed button');
  const row = b.locator(R + '.st-sugg-item:has-text("' + first.slice(0, 30).replace(/"/g, '') + '")').first();
  ok(/dismissed by Hesh/.test(await row.textContent()), 'it says who set it aside');
  await row.locator('.st-sugg-dismiss:has-text("Restore")').click(); await sleep(400);
  eq(((await peek(hit.asset)).dismissed || []).length, 0, 'restored for everyone');
  await b.locator(R + '.st-sugg-item .st-sugg-dismiss:has-text("Dismiss")').first().click(); await sleep(400);
  eq(((await peek(hit.asset)).dismissed || []).length, 1, 'and set aside again from this browser');
  await b.ctxB.close();
  // a read-only key is shown no suggestions (they need a full key), so there is nothing to dismiss or restore
  const c = await openProject('S26 at design', { role: 'read' });
  await c.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await c.waitForSelector(R + 'canvas', { timeout: 15000 }); await sleep(1200);
  if (!(await c.locator(R + '.st-cd-tabs:visible').count())) await c.locator(R + '.st-instab:has-text("Creative Director"), ' + R + 'button:has-text("Creative Director")').first().click();
  await c.locator(R + '.st-cd-tabs:visible button:has-text("Explore")').first().click(); await sleep(400);
  ok(/Suggestions need a full key/.test(await c.textContent(R + '.st-inspector')), 'the read-only key is told suggestions need a full key');
  eq(await c.locator(R + '.st-sugg-dismiss').count(), 0, 'and has no Dismiss or Restore');
  await c.ctxB.close();
});

await T.t('B2 a dismissal a browser kept before S26 is sent to the worker once and forgotten locally', async () => {
  // start clean: restore whatever B1 left
  for (const x of g0.assets) { const pk = await peek(x.id); for (const d of pk.dismissed || []) await api('POST', '/studio/suggest/dismiss', { asset: x.id, version: pk.version, key: d.key, dismissed: false }); }
  const store = {}; const want = {};
  for (const x of g0.assets) { const pk = await peek(x.id); if (pk.ok && pk.cached && (pk.design || []).length) { const k = 'design|' + pk.design[pk.design.length - 1].text; store['ax_studio_dismiss_' + x.id + '_' + pk.version] = JSON.stringify([k]); want[x.id] = k; } }
  ok(Object.keys(want).length, 'a cached suggestion to have dismissed locally');
  const a = await openProject('S26 at design', { store }); await toExplore(a); await sleep(800);
  const carried = []; for (const id of Object.keys(want)) { const pk = await peek(id); if ((pk.dismissed || []).some(d => d.key === want[id])) carried.push(id); }
  ok(carried.length >= 1, 'the shown asset\'s local dismissal reached the worker: ' + JSON.stringify(carried));
  const left = await a.evaluate(keys => keys.filter(k => localStorage.getItem(k) != null), carried.map(id => Object.keys(store).find(k => k.indexOf(id) >= 0)));
  eq(left, [], 'and the local copy is gone');
  await a.ctxB.close();
});

await T.t('B3 classic project: a dialog names the pieces before a direction change; Cancel changes nothing; rewrite later lists them, Keep as written clears one', async () => {
  const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S26 classic', brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits refund a road tax', audience: 'Regional voters', action: 'Read the facts', channels: ['facebook', 'instagram'], deliverable: 'set', campaignConfirmed: true, imageryTiming: 'after_copy' } });
  const Pc = pr.id; const step = async id => { let j; for (let i = 0; i < 12; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
  const job = async (stage, input) => { const r = await api('POST', '/studio/job', { project: Pc, stage, input, idem: stage + ':' + Math.random() }); return step(r.job.id); };
  eq((await job('direct', { n: 2 })).state, 'done');
  let g = await api('GET', '/studio/get?id=' + Pc); await api('POST', '/studio/direction/choose', { id: g.directions[0].id });
  const cj = await job('copy', { channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' } }); eq(cj.state, 'done', 'copy: ' + (cj.error || ''));
  g = await api('GET', '/studio/get?id=' + Pc); const other = g.directions[1]; const old = g.assets.map(a => a.id);
  const page = await openProject('S26 classic');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Direction"))'); await sleep(600);
  const card = page.locator(R + '.st-dir:has(.st-dir-title:has-text("' + other.title.replace(/"/g, '') + '"))').first();
  await card.locator('button:has-text("Choose this direction")').click();
  await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 10000 });
  const txt = (await page.textContent(R + '.st-impact[data-kind="direction"]')).replace(/\s+/g, ' ');
  ok(/2 pieces were written from/.test(txt) && g.assets.every(a => txt.indexOf(a.title) >= 0) && /Production > Needs attention/.test(txt) && /model calls/.test(txt), 'the classic dialog names the pieces, where they go and the cost: ' + txt.slice(0, 400));
  await page.click(R + '.st-impact button:has-text("Cancel")'); await sleep(300);
  eq((await api('GET', '/studio/get?id=' + Pc)).directions.find(d => d.chosen).id, g.directions[0].id, 'Cancel left the choice as it was');
  await card.locator('button:has-text("Choose this direction")').click();
  await page.waitForSelector(R + '.st-impact[data-kind="direction"]', { timeout: 10000 });
  await page.click(R + '.st-impact button:has-text("Choose it; rewrite later")');
  await page.waitForFunction(n => { const t = document.querySelector('#studio-root'); return t && /piece/.test(t.textContent); }, null, { timeout: 15000 });
  let g2; for (let i = 0; i < 40; i++) { g2 = await api('GET', '/studio/get?id=' + Pc); if (g2.directions.find(d => d.chosen).id === other.id && g2.assets.length > old.length) break; await sleep(250); }
  eq(g2.directions.find(d => d.chosen).id, other.id, 'the new direction is chosen'); ok(g2.assets.length > old.length, 'and produced as a new set');
  // Production > Needs attention lists the earlier pieces with the rewrite (paid) and Keep as written (free)
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await sleep(400);
  const rec = page.locator(R + '.st-designtabs button:has-text("Recipes"), ' + R + '.st-subtab:has-text("Recipes")').first(); await rec.click();
  await page.waitForSelector(R + '.st-prod table[aria-label="Impact"]', { timeout: 15000 });
  const rows = page.locator(R + '.st-prod table[aria-label="Impact"] tbody tr').filter({ hasText: 'the chosen direction is now' });
  eq(await rows.count(), 2, 'both earlier pieces are listed');
  ok(await rows.first().locator('button:has-text("Rewrite from the chosen direction")').count(), 'with the rewrite');
  await rows.first().locator('button.st-keepdir').click();
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-prod table[aria-label="Impact"] tbody tr').length >= 0 && Array.from(document.querySelectorAll('#studio-root .st-prod table[aria-label="Impact"] tbody tr')).filter(r => /the chosen direction is now/.test(r.textContent)).length === 1, null, { timeout: 10000 });
  const im = await api('GET', '/studio/impact?project=' + Pc);
  eq(im.assets.filter(x => x.reasons.some(r => r.code === 'direction_changed')).length, 1, 'one is kept, one still listed');
  await page.ctxB.close();
});

await T.t('B4 no page error and no browser dialog', async () => { eq(pageErrors, [], 'no page error and no browser dialog'); });
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
