/* RC (Q1): the accessibility gate, enforcing. axe-core (a pinned dev dependency) over the Studio as testers will see it, with
 * every provider MOCKED: the library and the seven stages for a full key and a read-only key at 390, 1024 and 1440 px; at 1440
 * also the light appearance, the Design workspace with a layer selected and each dock panel open (the Add item flyout among
 * them), the Style panel and its colour picker, a Studio question, the project wizard, the Help panel with Report a problem,
 * and the client's review page. Any serious or critical violation, a view that would not open, or a page error fails the
 * harness, which run.mjs and CI then report. tests/studio-s27-sweep.mjs remains the wider evidence tool (six widths).
 * Run: node --experimental-sqlite tests/studio-a11y-browser.mjs   (A11Y_PORT picks the port, default 8871) */
import fs from 'node:fs';
import { makeStudio, runner, ok } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject } from './studio-flow.mjs';

const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: Number(process.env.A11Y_PORT) || 8871, inspect: false });
const T = runner('studio-a11y-browser (axe serious and critical: none, across stages, roles, widths, appearances, panels, dialogs, the wizard and the review page; providers MOCKED)');
await seedStages(fx, { only: ['directions', 'copy', 'design'], prefix: 'A11Y' });
const EXPECTED_FAULTS = /\/trends|\/gdelt|\/brief\/daily|fonts\.g/;   // the sandbox has no egress; these answer 502/404 by design

async function open(role, w, h, o) {
  const page = await fx.open(Object.assign({ viewport: { width: w, height: h }, quiet: true, role }, o || {}));
  page.on('dialog', d => { if (!d.studio) d.dismiss(); });
  page.errs = []; page.on('pageerror', e => page.errs.push(String(e.message).slice(0, 160)));
  await page.addScriptTag({ content: AXE }); return page;
}
async function axe(page, where) {
  await sleep(350);
  const v = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector('#studio-root') || document, { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => ({ id: x.id, impact: x.impact, n: x.nodes.length, where: x.nodes.slice(0, 3).map(n => n.target.join(' ')) })); });
  return v.map(x => where + ': ' + x.id + ' (' + x.impact + ') x' + x.n + ' at ' + x.where.join(' | '));
}
async function stage(page, name) { const s = page.locator(R + '.st-step:has(.st-step-l:text-is("' + name + '"))').first(); if (!(await s.count())) return false; await s.click(); await sleep(800); return true; }
const STAGES = ['Brief', 'Plan', 'Direction', 'Copy', 'Create', 'Review', 'Deliver'];

for (const role of ['full', 'read']) {
  for (const [w, h] of [[390, 844], [1024, 768], [1440, 900]]) {
    await T.t(role + ' key at ' + w + ': the library and the seven stages', async () => {
      const page = await open(role === 'read' ? 'read' : undefined, w, h); const bad = [];
      try {
        bad.push(...await axe(page, 'library'));
        await openProject(page, 'A11Y at design');
        for (const s of STAGES) { if (await stage(page, s)) bad.push(...await axe(page, s)); else bad.push(s + ': the stage would not open'); }
        bad.push(...page.errs.map(e => 'page error: ' + e));
      } finally { await page.ctxB.close(); }
      ok(!bad.length, bad.join(' || '));
    });
  }
}

await T.t('1440, full key: the light appearance across the library and the seven stages', async () => {
  const page = await open(undefined, 1440, 900, { store: { ax_studio_theme: 'light' } }); const bad = [];
  try {
    const t = await page.evaluate(() => { try { return localStorage.getItem('ax_studio_theme'); } catch (e) { return ''; } }); ok(t === 'light', 'the light appearance is set: ' + t);
    bad.push(...await axe(page, 'light library'));
    await openProject(page, 'A11Y at design');
    for (const s of STAGES) { if (await stage(page, s)) bad.push(...await axe(page, 'light ' + s)); }
  } finally { await page.ctxB.close(); }
  ok(!bad.length, bad.join(' || '));
});

await T.t('1440, full key: Design with a layer selected, each dock panel, the Style panel and its colour picker', async () => {
  const page = await open(undefined, 1440, 900); const bad = [];
  try {
    await openProject(page, 'A11Y at design'); await stage(page, 'Create');
    await page.waitForSelector(R + '.st-canvasbar', { timeout: 20000 }); await sleep(800);
    const hl = page.locator(R + '.st-le-layer[aria-label="Layer headline"]'); if (await hl.count()) { await hl.first().click({ force: true }); await sleep(300); }
    bad.push(...await axe(page, 'Design, headline selected (Style panel)'));
    const pick = page.locator(R + '.st-sty-colour button, ' + R + 'button[aria-label^="Colour"], ' + R + '.st-colourfield button').first();
    if (await pick.count()) { await pick.click(); await sleep(400); bad.push(...await axe(page, 'colour picker')); await page.keyboard.press('Escape'); await sleep(200); }
    const n = await page.locator(R + '.st-dock-btn:not([disabled])').count();
    for (let i = 0; i < n; i++) { const b = page.locator(R + '.st-dock-btn:not([disabled])').nth(i); const l = ((await b.getAttribute('aria-label')) || (await b.textContent()) || '').trim().slice(0, 24); await b.click(); await sleep(450); bad.push(...await axe(page, 'panel ' + l)); await b.click(); await sleep(200); }
  } finally { await page.ctxB.close(); }
  ok(!bad.length, bad.join(' || '));
});

await T.t('1440, full key: a Studio question, the project wizard, and Help with Report a problem', async () => {
  const page = await open(undefined, 1440, 900); const bad = [];
  try {
    await page.waitForSelector(R + '.st-lib, ' + R + '.st-head', { timeout: 15000 });
    // the wizard
    const nw = page.locator(R + 'button:has-text("New project")').first(); if (await nw.count()) { await nw.click(); await page.waitForSelector(R + '.st-wiz', { timeout: 15000 }); bad.push(...await axe(page, 'wizard, step 1')); await page.keyboard.press('Escape'); await sleep(300); } else bad.push('wizard: no New project button');
    // Help, with Report a problem
    const help = page.locator(R + 'button[aria-controls="st-help"]').first(); if (await help.count()) { await help.click(); await sleep(500); bad.push(...await axe(page, 'Help and Report a problem')); await help.click().catch(() => {}); await sleep(200); } else bad.push('help: no Help button');
    // a Studio question (the Studio's own dialog), opened from the page's own helper
    const asked = await page.evaluate(() => { const k = window.STKit; if (!k || !k.ask) return false; k.ask({ title: 'A question for the sweep', text: 'Nothing happens on either answer.', ok: 'OK', cancel: 'Cancel' }); return true; });
    if (asked) { await page.waitForSelector(R + '[role="dialog"], [role="dialog"]', { timeout: 5000 }).catch(() => {}); await sleep(300); bad.push(...await axe(page, 'Studio question')); await page.keyboard.press('Escape'); }
    else bad.push('question: STKit.ask is not exposed');
    bad.push(...page.errs.map(e => 'page error: ' + e));
  } finally { await page.ctxB.close(); }
  ok(!bad.length, bad.join(' || '));
});

await T.t('the client review page (docs/review.html) on a phone and at 1440', async () => {
  const P = (await fx.api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'A11Y review', brief: { channels: ['instagram'], deliverable: 'copy', campaignConfirmed: true } })).id;
  const A = (await fx.api('POST', '/studio/asset', { project: P, family: 'Copy', channel: 'instagram', format: '4:5', title: 'Caption', mode: 'copy', copy: { headline: 'Hands off our fuel', caption: 'The fuel tax credit is a refund of road tax on fuel never used on a public road.' } })).asset;
  const sh = await fx.api('POST', '/studio/share', { project: P, assets: [A.id], label: 'A11Y', expiresDays: 7 });
  ok(sh.token, 'a review link was made: ' + JSON.stringify(sh).slice(0, 200));
  const bad = [];
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const page = await open(undefined, w, h, { go: false });
    try {
      await page.goto('http://127.0.0.1:' + fx.PORT + '/review.html#t=' + sh.token + '&w=' + encodeURIComponent('https://newsaus.heshan-998.workers.dev'), { waitUntil: 'domcontentloaded' });
      await page.addScriptTag({ content: AXE }); await sleep(1500);
      const v = await page.evaluate(async () => { const r = await window.axe.run(document, { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' (' + x.impact + ') x' + x.nodes.length + ' at ' + x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')); });
      bad.push(...v.map(x => 'review ' + w + ': ' + x));
      const txt = await page.textContent('body'); if (!/Hands off our fuel/.test(txt || '')) bad.push('review ' + w + ': the shared copy is not shown');
    } finally { await page.ctxB.close(); }
  }
  ok(!bad.length, bad.join(' || '));
});

await fx.close();
process.exit(T.done().fail ? 1 : 0);
