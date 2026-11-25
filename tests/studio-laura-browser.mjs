/* Laura's testing feedback of 18 November 2026 (eight ClickUp tasks in "Axiom Bug and Change Request Tracking"), in real
 * Chromium against the worker module in this process, every provider MOCKED. Each case failed before its fix.
 *   LF1 the client cards hold their campaign names: a long name is cut short inside its card, never drawn over the next one
 *       ("New Project - correct the formatting")
 *   LF2 fewer ways in, named for what they do: five starting points, Axiom's own material is "From Axiom's monitoring"
 *       ("Brief types")
 *   LF3 Add from Axiom's monitoring says it worked: the row reads Added, and the material added comes into view
 *       ("New project > Scrolling")
 *   LF4 the production modes say what happens in plain words, without naming the image model ("Production")
 *   LF5 the Board says the next step where you are: each piece names its next step, a finished creative is never "not
 *       validated", and the foot of the Board carries the action ("Create > Navigation")
 *   LF6 Review's lock sends you to what blocks it: a finished creative whose words were not read back is fixed in Create, not
 *       in Copy, and the lock offers the free editable copy ("Can't move on to finalise the tile")
 *   LF7 the Creative Partner says it is optional ("Creative Partner")
 *   LF8 no page error and no browser dialog
 * Run: node --experimental-sqlite tests/studio-laura-browser.mjs   (LAURA_PORT picks the port, default 8894) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.LAURA_PORT || 8894), inspect: false });
const { api } = fx;
const T = runner('studio-laura-browser (the testing feedback of 18 November)');
// the reported client card: campaign names long enough to run past the card
await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel (Fuel Tax Credit Alliance, national)' }, { id: 'tdam', name: 'That\'s the difference Australian mining makes (national tax and contribution)' }, { id: 'vgo', name: 'Victoria\'s Golden Opportunity (Victorian gold and critical minerals)' }] });
const seeded = await seedStages(fx, { only: ['design'], prefix: 'LF' });
const errors = [];
const open = async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true });
  page.on('pageerror', e => errors.push(String(e.message)));
  page.on('dialog', d => { if (!d.studio) { errors.push('browser dialog: ' + d.message()); d.dismiss(); } });
  return page;
};
const wizard = async page => {
  await page.locator(R + 'button:has-text("New project")').first().click();
  await page.waitForSelector(R + '.st-client-card');
};

await T.t('LF1: a long campaign name is cut short inside its client card, never drawn past it', async () => {
  const page = await open();
  try {
    await wizard(page);
    const card = page.locator(R + '.st-client-card:has-text("Minerals Council")').first();
    const over = await card.evaluate(c => { const b = c.getBoundingClientRect(); return Array.from(c.querySelectorAll('.st-client-camps .st-mini-chip')).map(x => { const r = x.getBoundingClientRect(); return { t: x.textContent, over: Math.round(r.right - b.right), full: x.getAttribute('title') }; }); });
    ok(over.length >= 2, 'the card shows the campaigns: ' + JSON.stringify(over));
    ok(over.every(x => x.over <= 0), 'every campaign chip ends inside its card: ' + JSON.stringify(over));
    ok(over.every(x => x.full && x.full.length >= x.t.length), 'and its full name is on hover');
  } finally { await page.context().close(); }
});

await T.t('LF2: five starting points, and Axiom\'s own material is "From Axiom\'s monitoring"', async () => {
  const page = await open();
  try {
    await wizard(page);
    const starts = await page.$$eval(R + '.st-starts .st-start', els => els.map(e => e.textContent.trim()));
    ok(starts.length <= 5, 'at most five ways in (' + starts.length + '): ' + JSON.stringify(starts));
    ok(starts.some(s => /From Axiom's monitoring/.test(s)), 'Axiom\'s monitoring is named for what it is');
    ok(!starts.some(s => /Start With Axiom/.test(s)), 'the old name is gone');
  } finally { await page.context().close(); }
});

await T.t('LF3: Add from Axiom\'s monitoring reads Added, and the material added comes into view', async () => {
  const page = await open();
  try {
    const rows = Array.from({ length: 12 }, (_, i) => ({ id: 'n' + i, label: 'Narrative number ' + i + ' about fuel tax credits', rows: 10 + i, status: 'growing' }));
    await page.route('**/studio/intake/feed**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, narratives: rows, alerts: [], news: [] }) }));
    await wizard(page);
    await page.click(R + '.st-client-card:has-text("Minerals Council")');
    await page.click(R + '.st-start:has-text("From Axiom")');
    await page.waitForSelector(R + '.st-feed-row');
    const row = page.locator(R + '.st-feed-row:has-text("Narrative number 9")');
    await row.locator('button').click();
    await sleep(900);
    const btn = await row.locator('button').first();
    ok(/Added/.test(await btn.textContent()) && await btn.isDisabled(), 'the row now reads Added: ' + await btn.textContent());
    const tray = page.locator(R + '.st-tray-item:has-text("Narrative number 9")');
    ok(await tray.count(), 'the material is in the tray');
    const inView = await tray.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    ok(inView, 'and the tray item is on screen');
    ok(/Added to the brief/.test(await page.textContent(R + '.st-compose')), 'and it is said in words');
  } finally { await page.context().close(); }
});

await T.t('LF4: the production modes say what happens in plain words, without naming the image model', async () => {
  const page = await open();
  try {
    await page.waitForFunction(() => window.STFlow && window.React && window.ReactDOM);
    const txt = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'st'; document.querySelector('#studio-root').appendChild(d); const R = window.ReactDOM.createRoot(d); R.render(window.React.createElement(window.STFlow.ProductionModes, { p: { assets: [], brief: {}, ns: 'mca' }, prov: {}, onProduce: () => {} })); return new Promise(r => setTimeout(() => { const t = d.textContent; R.unmount(); d.remove(); r(t); }, 300)); });
    ok(/Editable creative/.test(txt) && /Full AI creative/.test(txt), 'both modes are offered');
    ok(!/Gemini/.test(txt), 'the image model is not named: ' + txt.slice(0, 200));
    ok(txt.length < 900, 'and it is short (' + txt.length + ' characters)');
  } finally { await page.context().close(); }
});

await T.t('LF5: the Board says each piece\'s next step and carries the action at its foot', async () => {
  const page = await open();
  try {
    await openProject(page, 'LF at design'); await sleep(600); await goStep(page, 'Create'); await sleep(1200);
    if (!(await page.$(R + '.st-board'))) { const b = page.locator(R + 'button:has-text("Board")'); if (await b.count()) await b.first().click(); await sleep(800); }
    await page.waitForSelector(R + '.st-board-card');
    const steps = await page.$$eval(R + '.st-board-card .st-board-step', els => els.map(e => e.textContent.trim()));
    const cards = await page.$$eval(R + '.st-board-card', els => els.length);
    eq(steps.length, cards, 'every piece names its next step: ' + JSON.stringify(steps));
    ok(steps.every(s => /^Next:/.test(s)), 'as "Next: ..."');
    ok(await page.$(R + '.st-board .st-board-next button'), 'the foot of the Board carries the action');
  } finally { await page.context().close(); }
});

await T.t('LF6: Review\'s lock sends you to Create for a finished creative not read back, and offers the editable copy', async () => {
  const page = await open();
  try {
    await page.waitForFunction(() => window.STFlow && window.React && window.ReactDOM);
    const r = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'st'; document.querySelector('#studio-root').appendChild(d); const RT = window.ReactDOM.createRoot(d); let went = '';
      const wf = { v: 2, order: ['brief', 'objectives', 'strategy', 'directions', 'copy', 'design', 'review'], steps: { brief: { state: 'complete' }, objectives: { state: 'complete' }, strategy: { state: 'complete' }, directions: { state: 'complete' }, copy: { state: 'in_progress', note: '1 of 7 ready for design' }, design: { state: 'in_progress', note: '0 of 7 validated' }, review: { state: 'locked', need: 'Have the Creative Director read the painted words and the mark back (Review in Design) for at least one finished creative, with its copy marked ready, to continue.' } } };
      RT.render(window.React.createElement(window.STFlow.LockedStage, { step: 'review', wf, onGo: s => { went = s; } }));
      return new Promise(res => setTimeout(() => { const b = d.querySelector('button'); const label = b ? b.textContent : ''; if (b) b.click(); setTimeout(() => { const t = d.textContent; RT.unmount(); d.remove(); res({ label, went, t }); }, 50); }, 300)); });
    eq(r.went, 'design', 'the lock goes to Create, where the reading is done: ' + r.label);
    ok(/editable copy/i.test(r.t), 'and says the free editable copy is the way to change the words: ' + r.t.slice(0, 300));
  } finally { await page.context().close(); }
});

await T.t('LF7: the Creative Partner says it is optional', async () => {
  const page = await open();
  try {
    await openProject(page, 'LF at design'); await sleep(600); await goStep(page, 'Create'); await sleep(1200);
    await page.locator(R + '.st-pagechip').first().click(); await sleep(1200);
    const { place } = await import('./studio-fixture.mjs'); await place(page, 'creative director');
    ok(/optional/i.test(await page.textContent(R + '.st-cd-intro')), 'its introduction says it is optional');
  } finally { await page.context().close(); }
});

await T.t('LF8: no page error and no browser dialog', async () => { eq(errors, [], 'none'); });
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
