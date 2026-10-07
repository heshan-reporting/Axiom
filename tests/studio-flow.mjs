/* Shared steps through the Studio as a person takes them since S17: the project wizard (type, client, campaign, brief),
 * Axiom's understanding confirmed, the objective and key message, the strategy, a direction selected, copy written and marked
 * ready, then the production mode in Design. Each step clicks what the page shows and waits for what it promises next, so a
 * suite that needs a project in Design gets there the way a person would, with the providers mocked by the fixture.
 * Projects made through the API without `brief.workflow: 2` keep the free order of the older Studio; these helpers are for
 * the guided path. */
const R = '#studio-root ';

/** The project tools (Brand, Client context, Jobs): in the left rail once there is work to show, in the context panel's
    links while the brief and the strategy are being written. */
export async function openTool(page, name) {
  const loc = page.locator(R + '.st-railbtn:has-text("' + name + '")').or(page.locator(R + '.st-ctx-links button:has-text("' + name + '")'));
  // S18: in Design the project tools are the stage's Jobs tab and the Brand tool's links
  if (!(await loc.count()) && await page.$(R + '.st-dock')) {
    if (name === 'Jobs') return page.click(R + '.st-subtab:has-text("Jobs")');
    const b = page.locator(R + '.st-dock-btn:has-text("Brand")').first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
    return page.click(R + '.st-library button:has-text("' + (name === 'Brand' ? 'Open the Brand workspace' : name) + '")');
  }
  await loc.first().waitFor({ state: 'visible', timeout: 15000 });
  await loc.first().click();
}

/** Open a project from the library by (part of) its title. */
export async function openProject(page, title) {
  const row = R + '.st-lib tbody tr:has-text("' + title + '")';
  await page.waitForSelector(row, { timeout: 15000 });
  const btn = page.locator(row + ' button.st-lib-open').or(page.locator(row + ' .ov-link'));
  await btn.first().click();
  await page.waitForSelector(R + '.st-steps, ' + R + '.st-step', { timeout: 15000 });
}

/** A step by its S17 name (Brief, Objectives, Strategy, Directions, Copy, Design, Review). S20: the navigator shows five phases -
    Brief (with Understanding, Objectives and Strategy as its steps, shown in the stage head), Explore (Directions), Copy, Design,
    Review & Deliver - so Objectives and Strategy are reached through Brief, and Directions is Explore. */
const SUBSTEP = { Objectives: 1, Strategy: 1 };
export async function goStep(page, label) {
  if (SUBSTEP[label]) {
    if (!(await page.$(R + '.st-substep:has-text("' + label + '")'))) { await page.click(step('Brief')); await page.waitForSelector(R + '.st-substep', { timeout: 15000 }); }
    await page.click(R + '.st-substep:has-text("' + label + '")');
  } else await page.click(step(label));
  await page.waitForSelector(step(label, true), { timeout: 15000 });
}
/** A navigator phase (or, for Objectives and Strategy, the Brief step) by its exact label (":has-text" would also match the Copy
    phase's "ready for design"). */
export function step(label, on) {
  if (SUBSTEP[label]) return R + '.st-substep' + (on ? '.on' : '') + ':has-text("' + label + '")';
  const l = label === 'Directions' || label === 'Direction' ? 'Explore' : label;
  const t = l === 'Review' ? 'text-matches("^Review")' : 'text-is("' + l + '")'; return R + '.st-step' + (on ? '.on' : '') + ':has(.st-step-l:' + t + ')';
}

/** The wizard, start to finish. o: { type (the card's words, default "Response Creative"), client (default "Minerals
    Council"), campaign ('standalone' | 'new' | a campaign name, default the first existing one), newCampaign, title,
    deliverable ('set' | 'visual' | 'copy'), channels (labels to switch ON beyond the type's own), text, analyse (default
    true) }. Resolves when the project is open: on the understanding when analysed, on the brief otherwise. */
export async function wizardCreate(page, o) {
  o = o || {};
  const nw = page.locator(R + 'button:has-text("New project")');
  if (!(await page.$(R + '.st-wiz'))) { await nw.first().click(); }
  await page.waitForSelector(R + '.st-wiz');
  await page.click(R + '.st-type:has-text("' + (o.type || 'Response Creative') + '")');
  await page.click(R + '.st-wiz-foot button:has-text("Next")');
  await page.waitForSelector(R + '.st-client-card');
  await page.click(R + '.st-client-card:has-text("' + (o.client || 'Minerals Council') + '")');
  await page.waitForSelector(R + '.st-knowprep-dot.ok', { timeout: 15000 }).catch(() => null);
  await page.click(R + '.st-wiz-foot button:has-text("Next")');
  await page.waitForSelector(R + '.st-cmodes');
  if (o.campaign === 'standalone') await page.click(R + '.st-cmodes .st-type:has-text("Standalone")');
  else if (o.campaign === 'new') {
    await page.click(R + '.st-cmodes .st-type:has-text("Create new campaign")');
    await page.fill(R + 'input[aria-label="Campaign name"]', (o.newCampaign && o.newCampaign.name) || 'A new campaign');
  } else {
    await page.click(R + '.st-cmodes .st-type:has-text("Select existing campaign")');
    const c = o.campaign ? page.locator(R + '.st-camp:has-text("' + o.campaign + '")') : page.locator(R + '.st-camp');
    await c.first().waitFor({ state: 'visible' }); await c.first().click();
  }
  await page.click(R + '.st-wiz-foot button:has-text("Next")');
  await page.waitForSelector(R + '.st-compose');
  if (o.title) await page.fill(R + 'input[aria-label="Project name"]', o.title);
  if (o.deliverable) await page.click(R + '.st-wiz-meta .st-segbtn:has-text("' + ({ set: 'Coordinated set', visual: 'One visual', copy: 'Copy only' })[o.deliverable] + '")');
  for (const ch of (o.channels || [])) {
    const b = page.locator(R + '.st-wiz-meta .st-segbtn:has-text("' + ch + '")').first();
    if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
  }
  for (const ch of (o.channelsOff || [])) {
    const b = page.locator(R + '.st-wiz-meta .st-segbtn:has-text("' + ch + '")').first();
    if ((await b.getAttribute('aria-pressed')) === 'true') await b.click();
  }
  if (o.text) await page.fill(R + '.st-compose-ta', o.text);
  if (o.analyse === false) {
    await page.click(R + '.st-wiz-foot button:has-text("Create without analysing")');
    await page.waitForSelector(R + '.st-step.on', { timeout: 20000 });
  } else {
    await page.click(R + '.st-wiz-foot button:has-text("Create and analyse")');
    await page.waitForSelector(R + '.st-under', { timeout: 40000 });
  }
}

/** Understanding -> Objectives -> Strategy -> directions generated and shown. */
export async function toDirections(page) {
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Objectives")');
  await page.waitForSelector(R + '.st-objectives', { timeout: 15000 });
  await page.click(R + '.st-stepbar button:has-text("Confirm and continue to Strategy")');
  await page.waitForSelector(R + '.st-strats', { timeout: 15000 });
  await page.click(R + '.st-stepbar button:has-text("Confirm and generate directions")');
  await page.waitForSelector(R + '.st-ready-card, ' + R + '.st-dcard', { timeout: 40000 });
  if (await page.$(R + '.st-ready-card button:has-text("View directions")')) await page.click(R + '.st-ready-card button:has-text("View directions")');
  await page.waitForSelector(R + '.st-dcard', { timeout: 15000 });
}

/** Select a direction (by index or by words on its card) and continue to Copy. */
export async function selectDirection(page, which) {
  const card = typeof which === 'string' ? page.locator(R + '.st-dcard:has-text("' + which + '")') : page.locator(R + '.st-dcard').nth(which || 0);
  await card.locator('button:has-text("Select")').first().click();
  await page.waitForSelector(R + '.st-stepbar button:has-text("Continue to Copy")', { timeout: 15000 });
  await page.click(R + '.st-stepbar button:has-text("Continue to Copy")');
  await page.waitForSelector(R + '.st-copystart', { timeout: 15000 });
}

/** Generate the copy (no imagery) and wait for the pieces. */
export async function generateCopy(page) {
  await page.click(R + '.st-copystart .st-stepbar button:has-text("Generate copy")');
  await page.waitForSelector(R + '.st-copy3', { timeout: 40000 });
  await page.waitForSelector(R + '.st-copy-pick', { timeout: 15000 });
}

/** Mark every piece's copy ready for design (the agency's copy approval of that version). */
export async function markCopyReady(page) {
  const n = (await page.$$(R + '.st-copy-pick')).length;
  for (let i = 0; i < n; i++) {
    await (await page.$$(R + '.st-copy-pick'))[i].click(); await page.waitForTimeout(250);
    const b = await page.$(R + 'label.st-ready-check input');
    if (b && !(await b.isChecked())) { await b.click(); await page.waitForFunction(() => { const x = document.querySelector('#studio-root label.st-ready-check input'); return x && x.checked; }, null, { timeout: 15000 }); }
  }
}

/** Continue to Design and choose how the pieces are produced: 'editable' (Editable creative) or 'finished' (the full AI
    route). Resolves when production has landed on the assets. */
export async function produce(page, mode) {
  await page.click(R + '.st-stagehead button:has-text("Continue to Design")');
  await page.waitForSelector(R + '.st-pmodes', { timeout: 15000 });
  const card = mode === 'finished' ? page.locator(R + '.st-pmode').filter({ hasNotText: 'Editable creative' }).first() : page.locator(R + '.st-pmode:has-text("Editable creative")').first();
  await card.click();
  // the cost is confirmed in a dialog before anything is queued: accepted here unless the suite listens itself
  if (!page.listenerCount('dialog')) page.once('dialog', d => d.accept());
  await page.click(R + '.st-pmodes .st-stepbar button:has-text("Generate")');
  await page.waitForSelector(R + '.st-pmodes', { state: 'detached', timeout: 40000 }).catch(() => null);
}

/** The whole guided path to Design with editable compositions. */
export async function guidedToDesign(page, o) {
  await wizardCreate(page, o);
  await toDirections(page);
  await selectDirection(page, (o && o.direction) || 0);
  await generateCopy(page);
  await markCopyReady(page);
  await produce(page, (o && o.mode) || 'editable');
}
