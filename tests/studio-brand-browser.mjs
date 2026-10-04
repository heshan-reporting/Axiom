/* Client knowledge in the page (S6), in real Chromium against the worker module in this process; providers MOCKED.
 * The Brand workspace shows the inventory (usable / stored but never sent / missing, with the recommendations and the
 * curated examples still wanted), the mark placement as per-reference evidence rather than one sentence, and Teach this
 * brand: a placement is previewed (nothing written), confirmed with a reason, and the view then shows the approved rule,
 * the kit history names it, and a read-only key sees no Teach controls.
 * Run: node --experimental-sqlite tests/studio-brand-browser.mjs */
import { makeStudio, runner, eq, ok, PHOTO } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8796 });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-brand-browser (inventory, placement evidence and Teach this brand in the page; providers MOCKED)');
const S = 'section[aria-label="Knowledge inventory"]';
const shot = async (page, name) => { if (process.env.SHOT) await page.screenshot({ path: new URL('./shot-' + name + '.png', import.meta.url).pathname, fullPage: false }); };

// a HOOF project with one approved reference whose analysis puts the mark bottom left, and one pending fact
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF refs' })).id;
const RF = await api('POST', '/studio/reference', { project: P, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PHOTO, mime: 'image/png', campaign: 'hoof' });
fx.env.MIND_DB.db.prepare('UPDATE studio_references SET analysis=? WHERE id=?').run(JSON.stringify({ summary: 'A teal tile.', logo: 'the wordmark sits bottom left', mark: { present: true, kind: 'logo', corner: 'bl', size: 'a fifth of the width' }, text: [], takeaways: [], at: 1 }), RF.id);
await api('POST', '/brand/kit', { ns: 'mca', facts: [{ text: 'Mining directly employs more than 300,000 Australians', source: 'ABS', status: 'approved' }, { text: 'Farmers claimed 1.2 billion litres', source: 'draft', status: 'pending', campaign: 'hoof' }] });

let page;
await T.t('the Brand workspace counts what the models can use and what is stored but never sent, names the recommendations with their actions, and lists the curated examples still wanted', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("HOOF refs")'); await page.click(R + '.st-lib tbody tr:has-text("HOOF refs") .ov-link'); await page.waitForSelector(R + '.st-railbtn:has-text("Brand")');
  await page.click(R + '.st-railbtn:has-text("Brand")'); await page.waitForSelector(R + '.st-brand');
  await page.selectOption(R + 'select[aria-label="Campaign scope"]', 'hoof');
  await page.waitForFunction(S => { const el = document.querySelector('#studio-root ' + S); return el && /usable/.test(el.textContent) && !/Counting/.test(el.textContent); }, S);
  const t = (await page.textContent(R + S)).replace(/\s+/g, ' ');
  ok(/What the Studio can use for Hands Off Our Fuel/.test(t), t.slice(0, 200));
  ok(/\d+ usable/.test(t) && /\d+ stored, not retrieved/.test(t), 'the strip counts: ' + t.slice(0, 300));
  ok(/marks/.test(t) && /facts/.test(t) && /references/.test(t) && /Reaches/.test(t), 'the usable table with what each reaches');
  ok(/fact pending/.test(t) && /never quotes it/.test(t), 'the pending fact is stored but never sent: ' + t.slice(0, 600));
  ok(/Recommended/.test(t) && /teach placement/.test(t) && /review fact/.test(t), 'recommendations: ' + t);
  ok(await page.$(R + S + ' .st-inv-rec-row:has-text("teach placement") button:has-text("Teach")'), 'the placement recommendation offers Teach');
  ok(/Curated examples still wanted/.test(t) && /typography/.test(t) && /imagery/.test(t) && !/approved \(/.test(t), 'examples wanted, approved not among them: ' + t.slice(-700));
  ok(/Nothing from another client/.test(t), 'the isolation note');
});
await T.t('mark placement is shown as evidence: the reference, its approval, the corner, how it was read and the confidence; the observation is marked as such and offers to become the rule', async () => {
  const pl = (await page.textContent(R + '.st-place')).replace(/\s+/g, ' ');
  ok(/reference observation, 100% agreement/.test(pl) && /bottom left as in 1 reference/.test(pl), pl);
  const row = await page.textContent(R + '.st-place-table tbody tr'); ok(/Approved HOOF tile/.test(row) && /approved/.test(row) && /bottom left/.test(row) && /mark reading/.test(row) && /85%/.test(row) && /logo, a fifth/.test(row), row);
  ok(await page.$(R + '.st-place button:has-text("make it the rule")'), 'the observation offers to become the rule');
});
await T.t('Teach this brand: inspect proposes the placement and the pending fact; a placement is previewed (nothing written), then confirmed with a reason; the view shows the approved rule, the kit history names it', async () => {
  await page.click(R + 'section[aria-label="Teach this brand"] button:has-text("Inspect: what could be taught")');
  await page.waitForSelector(R + '.st-teach-props');
  const pr = (await page.textContent(R + '.st-teach-props')).replace(/\s+/g, ' ');
  ok(/placement/.test(pr) && /Mark bottom left \(100% agreement, 1 reference\)/.test(pr) && /fact/.test(pr) && /1.2 billion litres/.test(pr), pr);
  await page.click(R + '.st-teach-props li:has-text("placement") button:has-text("use")');
  await page.waitForSelector(R + '.st-teach-form');
  eq(await page.inputValue(R + '.st-teach-form select[aria-label="Corner"]'), 'bl', 'the proposal filled the form');
  ok(await page.isDisabled(R + '.st-teach-form button:has-text("Confirm and teach")'), 'no confirm before a preview and a reason');
  const kitBefore = JSON.stringify((await api('GET', '/brand/kit?ns=mca')).kit.campaigns);
  await page.click(R + '.st-teach-form button:has-text("Preview")'); await page.waitForSelector(R + '.st-teach-preview');
  const pv = (await page.textContent(R + '.st-teach-preview')).replace(/\s+/g, ' ');
  ok(/bottom left, mandatory/.test(pv) && /Writes: the Hands Off Our Fuel campaign rule in the kit/.test(pv) && /existing composition/.test(pv), pv);
  eq(JSON.stringify((await api('GET', '/brand/kit?ns=mca')).kit.campaigns), kitBefore, 'the preview wrote nothing');
  ok(await page.isDisabled(R + '.st-teach-form button:has-text("Confirm and teach")'), 'still no confirm without a reason');
  await page.fill(R + '.st-teach-form input[aria-label="Teach reason"]', 'Dee confirmed the approved tiles');
  await page.click(R + '.st-teach-form button:has-text("Confirm and teach")');
  await page.waitForSelector(R + '.st-place .st-chip:has-text("approved rule, held")', { timeout: 15000 });
  const kit = (await api('GET', '/brand/kit?ns=mca')).kit; eq(kit.campaigns.find(c => c.id === 'hoof').markRule, { corner: 'bl', mandatory: true, note: 'the Hands Off Our Fuel mark sits bottom left, as the approved references show' });
  const pl = (await page.textContent(R + '.st-place')).replace(/\s+/g, ' '); ok(/by the approved placement rule/.test(pl) && /1 reference agrees/.test(pl), pl);
  ok(/hoof mark placement rule bottom left, mandatory/.test(await page.textContent(R + 'section[aria-label="Kit history"]')), 'the kit history names the rule');
  const items = (await page.textContent(R + 'section[aria-label="Preferences and decisions"]')).replace(/\s+/g, ' '); ok(/Mark placement: bottom left \(held\)/.test(items) && /approved rule/.test(items) && /Dee confirmed/.test(items), items.slice(0, 400));
  await page.waitForFunction(S => { const el = document.querySelector('#studio-root ' + S); return el && /usable/.test(el.textContent) && !/teach placement/.test(el.textContent); }, S);
  ok(!/placement_/.test(await page.textContent(R + 'section[aria-label="Brand readiness"]')), 'no placement gap once the rule stands');
  await shot(page, 'studio-brand-teach');
});
await T.t('a read-only key sees the inventory and the evidence but no Teach controls', async () => {
  const p2 = await fx.open({ role: 'read' });
  await p2.waitForSelector(R + '.st-lib tbody tr:has-text("HOOF refs")'); await p2.click(R + '.st-lib tbody tr:has-text("HOOF refs") .ov-link'); await p2.waitForSelector(R + '.st-railbtn:has-text("Brand")');
  await p2.click(R + '.st-railbtn:has-text("Brand")'); await p2.waitForSelector(R + '.st-brand');
  await p2.selectOption(R + 'select[aria-label="Campaign scope"]', 'hoof');
  await p2.waitForFunction(S => { const el = document.querySelector('#studio-root ' + S); return el && /usable/.test(el.textContent) && !/Counting/.test(el.textContent); }, S);
  ok(await p2.$(R + '.st-place-table'), 'the evidence table is shown');
  eq(await p2.$(R + 'section[aria-label="Teach this brand"]'), null, 'no Teach section');
  eq(await p2.$(R + S + ' button:has-text("Teach")'), null, 'no Teach buttons on the recommendations');
  await p2.close();
});
await fx.close(); const res = T.done(); process.exit(res.fail ? 1 : 0);
