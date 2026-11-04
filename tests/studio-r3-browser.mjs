/* R3: the 4 November production-readiness audit of the page (prompts/studio-production-ready.md), in real Chromium against the
 * worker module in this process, every provider MOCKED. Each case fails on 0e1590f and passes with its fix.
 *   F1  Review's checks name the version they judged (the current one), not the number of versions
 *   F2  a banned term on the copy is a warning that a person decides on, not "blocking", and the copy approval dialog names it
 *   F3  the brief form keeps typed words when the person leaves the step and comes back, and after a reload
 *   F4  saving the brief lands when something else touched the project meanwhile (a job, a rename), and says who changed a field
 *       the person was also changing
 *   F5  the wizard's "One visual" can be a LinkedIn visual, and the recap names the deliverable and the channel
 * Run: node --experimental-sqlite tests/studio-r3-browser.mjs   (R3_PORT picks the static server's port, default 8889) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.R3_PORT || 8889), inspect: false });
const { api } = fx;
const T = runner('R3: version names, copy checks, the brief form kept and saved, one visual on any channel');
const S = await seedStages(fx, { prefix: 'R3', only: ['brief', 'copy', 'design'] });

await T.t('F1: the checks in Review name the current version, also when it is not the newest', async () => {
  const g = await api('GET', '/studio/get?id=' + S.design); const a = g.assets.find(x => (x.versions.find(v => v.id === x.current) || {}).mode !== 'copy');
  // a second version, then the asset's current pointer back on the first (a render branch leaves it so)
  const v1 = a.current; await api('POST', '/studio/version', { asset: a.id, project: S.design, copy: Object.assign({}, (a.versions.find(v => v.id === v1) || {}).copy, { alt: 'A later version' }), note: 'a later version' });
  fx.env.MIND_DB.db.prepare('UPDATE studio_assets SET current=? WHERE id=?').run(v1, a.id);
  const g2 = await api('GET', '/studio/get?id=' + S.design); const a2 = g2.assets.find(x => x.id === a.id); const cur = a2.versions.find(v => v.id === a2.current);
  ok(a2.versionsTotal > cur.n || a2.versions.length > cur.n, 'the current version is not the newest: ' + cur.n + ' of ' + (a2.versionsTotal || a2.versions.length));
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R3 at design'); await sleep(600); await goStep(page, 'Review'); await page.waitForSelector(R + '.st-issues');
    const labels = await page.$$eval(R + '.st-issue', (els, t) => els.filter(e => e.textContent.indexOf(t) >= 0).map(e => (e.querySelector('.st-issue-where') || {}).textContent || ''), a.title);
    ok(labels.length, 'the piece has issues listed');
    ok(labels.every(l => new RegExp('\\bv' + cur.n + '\\b').test(l)), 'each names v' + cur.n + ': ' + labels.join(' | '));
  } finally { await page.context().close(); }
});

await T.t('F2: a banned term is a warning a person decides on, and the copy approval dialog names it', async () => {
  await api('POST', '/brand/kit', { ns: 'mca', banned: [{ term: 'subsidy', why: 'the credit is not a subsidy', allowNegated: false }] });
  const g = await api('GET', '/studio/get?id=' + S.design); const a = g.assets[g.assets.length - 1]; const v = a.versions.find(x => x.id === a.current);
  await api('POST', '/studio/version', { asset: a.id, project: S.design, copy: Object.assign({}, v.copy, { headline: 'A subsidy for miners' }), note: 'a banned word' });
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R3 at design'); await sleep(600); await goStep(page, 'Review'); await page.waitForSelector(R + '.st-issues');
    const blocking = await page.textContent(R + '.st-issue-group[data-sev="blocking"]'); const warn = await page.textContent(R + '.st-issue-group[data-sev="warning"]');
    ok(!/banned term/.test(blocking), 'not under blocking: ' + blocking.replace(/\s+/g, ' ').slice(0, 200));
    ok(/banned term/.test(warn) && /person decides|you decide/i.test(warn), 'under warnings, a person decides: ' + warn.replace(/\s+/g, ' ').slice(0, 300));
    const btn = page.locator(R + 'button[aria-label="Approve copy of ' + a.title + '"]').first();
    if (await btn.count()) {
      await btn.click(); await page.waitForSelector('.st-dialog, .st-reason', { timeout: 8000 });
      const d = (await page.textContent('.st-dialog, .st-reason')).replace(/\s+/g, ' ');
      ok(/banned term/.test(d), 'the dialog names the check: ' + d.slice(0, 300));
    } else ok(false, 'no Approve copy button for ' + a.title);
  } finally { await page.context().close(); }
});

await T.t('F3: words typed in the brief form survive leaving the step and a reload', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R3 at the brief'); await sleep(600);
    await page.waitForSelector(R + '#bf-audience');
    await page.fill(R + '#bf-audience', 'Regional voters who drive for work');
    await sleep(500);
    await goStep(page, 'Plan'); await sleep(600); await goStep(page, 'Brief'); await page.waitForSelector(R + '#bf-audience');
    eq(await page.inputValue(R + '#bf-audience'), 'Regional voters who drive for work', 'kept across a step change');
    await page.reload(); await page.waitForSelector(R + '.st-step', { timeout: 20000 }); await goStep(page, 'Brief'); await page.waitForSelector(R + '#bf-audience');
    eq(await page.inputValue(R + '#bf-audience'), 'Regional voters who drive for work', 'kept across a reload');
    ok(/Unsaved brief/.test(await page.textContent(R + '.st-bf-head')), 'and still says it is unsaved');
  } finally { await page.context().close(); }
});

await T.t('F4: the brief saves when the project moved meanwhile; a field changed by someone else is named and the person\'s words kept', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'R3 at the brief'); await sleep(600); await page.waitForSelector(R + '#bf-action');
    await page.fill(R + '#bf-action', 'Share the fact sheet'); await sleep(300);
    // someone else renames the project (a different field): the save still lands
    const g = await api('GET', '/studio/get?id=' + S.brief); await api('POST', '/studio/project/update', { id: S.brief, revision: g.revision, patch: { title: 'R3 at the brief' } });
    await page.click(R + '.st-bf-save button'); await sleep(1500);
    const g2 = await api('GET', '/studio/get?id=' + S.brief); eq(g2.brief.action, 'Share the fact sheet', 'the save landed');
    // someone else changes the same field: the person is told, their words stay in the form, nothing of theirs is lost
    await page.fill(R + '#bf-action', 'Sign the petition'); await sleep(300);
    await api('POST', '/studio/project/update', { id: S.brief, revision: g2.revision, patch: { brief: { action: 'Call your MP' } } });
    await page.click(R + '.st-bf-save button'); await sleep(1500);
    const g3 = await api('GET', '/studio/get?id=' + S.brief); eq(g3.brief.action, 'Call your MP', 'the other person\'s change is not overwritten silently');
    eq(await page.inputValue(R + '#bf-action'), 'Sign the petition', 'the person\'s words are kept in the form');
    const t = (await page.textContent(R + '.st-bf')).replace(/\s+/g, ' ');
    ok(/Action/.test(t) && /changed by someone else|someone else changed/i.test(t), 'the field is named: ' + t.slice(0, 400));
  } finally { await page.context().close(); }
});

await T.t('F5: "One visual" can be a LinkedIn visual, and the recap names the deliverable and channel', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await page.waitForSelector(R + '.st-lib-head .btn'); await page.click(R + '.st-lib-head .btn:has-text("New project")');
    await page.waitForSelector(R + '.st-client-card'); await page.click(R + '.st-client-card:has-text("Minerals Council")');
    await page.fill(R + '.st-wiz textarea', 'One LinkedIn visual on the fuel tax credit for the regions this week.');
    await page.click(R + '.st-wiz-foot button:has-text("Next")'); await page.waitForSelector(R + '.st-cmodes');
    await page.click(R + '.st-cmodes button:has-text("Standalone")'); await page.click(R + '.st-wiz-foot button:has-text("Next")');
    await page.waitForSelector(R + '.st-wiz-meta');
    await page.click(R + '.st-wiz-meta button:has-text("One visual")');
    const pick = page.locator(R + '.st-wiz-meta [aria-label="Channel for the one visual"] button:has-text("LinkedIn")');
    ok(await pick.count(), 'one visual offers a channel'); await pick.first().click();
    const recap = (await page.textContent(R + '.st-wiz-recap')).replace(/\s+/g, ' ');
    ok(/one visual/i.test(recap) && /LinkedIn/.test(recap), 'the recap names it: ' + recap);
    await page.fill(R + '.st-wiz-meta input[aria-label="Project name"]', 'R3 one visual');
    await page.click(R + '.st-wiz-go button:has-text("Create without analysing")'); await page.waitForSelector(R + '.st-step', { timeout: 20000 }); await sleep(800);
    const L = await api('GET', '/studio/list?ns=mca'); const p = (L.projects || []).find(x => x.title === 'R3 one visual');
    ok(p, 'created'); const g = await api('GET', '/studio/get?id=' + p.id);
    eq(g.brief.channels, ['linkedin'], 'the brief carries the LinkedIn channel'); eq(g.brief.deliverable, 'visual', 'one visual');
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
