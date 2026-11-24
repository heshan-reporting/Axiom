/* Fix layout in the Studio when no move inside the arrangement clears it (the 24 November report: "Fix automatically does not
 * work" - the repair stopped at "Nothing was saved" while 9 of the 9 layout variations of the tile passed). In real Chromium
 * against the worker module in this process, every provider MOCKED. The renderer's repair is made to answer "blocked" so the
 * fallback is exercised whatever the seed tile's geometry is.
 *   FI1 Fix layout uses the nearest passing arrangement of the same words: one new layout version that names it, no model call,
 *       and the panel says what it did, with Undo
 *   FI2 nothing passing: nothing is saved and the panel says so (no version written)
 * Run: node --experimental-sqlite tests/studio-fixlayout-island-browser.mjs   (FIX_PORT picks the port, default 8892) */
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.FIX_PORT || 8892), inspect: false });
const { api } = fx;
const T = runner('studio-fixlayout-island-browser (Fix layout falls back to the nearest passing arrangement)');
const seeded = await seedStages(fx, { only: ['design'], prefix: 'FIX' });
const P = seeded.design;
// the first visual piece gets a caption block drawn over its headline: a real collision, so the strip offers Fix layout
const A0 = (await api('GET', '/studio/get?id=' + P)).assets.find(a => a.mode !== 'copy');
{ const v = A0.versions.find(x => x.id === A0.current); const L = JSON.parse(JSON.stringify(v.layout)); const hl = L.layers.find(l => l.role === 'headline') || L.layers.find(l => l.type === 'text');
  L.layers.push({ id: 'band', role: 'caption', type: 'text', text: 'Gas plants keep factories running. Ports load it. Towns depend on it.', x: hl.x, y: hl.y, w: hl.w, h: Math.max(6, hl.h), size: 2.6, color: '#FFFFFF' });
  const r = await api('POST', '/studio/version', { asset: A0.id, revision: A0.revision, layout: L, kind: 'layout', note: 'a caption over the headline' }); ok(r.version, 'the collision is on the tile: ' + JSON.stringify(r).slice(0, 160)); }
const errors = [];
const open = async (mode) => {
  // the renderer's own repair reports that it could not clear a collision; the variations are left as they are (or, for FI2, fail).
  // Installed before the page loads, so the variations the page works out on opening are the stubbed ones too.
  const page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true, onPage: pg => pg.addInitScript(m => {
    let real; Object.defineProperty(window, 'STRender', { configurable: true, get: () => real, set: S => { real = S; const orig = S.repair;
      S.repair = (L, c, i, o) => { const r = orig(L, c, i, o); const ids = (L.layers || []).filter(l => l.type === 'text').slice(0, 2).map(l => l.id);
        return Object.assign({}, r, { layout: L, changed: false, ok: false, outcome: 'blocked', steps: [], conflict: 'Geometry alone cannot fit the words without going under the readable minimum (collision).', remaining: { blocking: [{ code: 'collision', severity: 'blocking', layers: ids, detail: 'stub' }], warnings: [], unresolved: [] } }); };
      if (m === 'none') { const ov = S.variants, ova = S.variantsAsync; const fail = list => (list || []).map(x => Object.assign({}, x, { ok: false })); S.variants = (...a) => fail(ov(...a)); if (ova) S.variantsAsync = async (...a) => fail(await ova(...a)); } } });
  }, mode || 'pass') }); page.on('pageerror', e => errors.push(String(e.message)));
  page.on('dialog', d => { if (!d.studio) { errors.push('browser dialog: ' + d.message()); d.dismiss(); } });
  await openProject(page, 'FIX at design'); await sleep(600); await goStep(page, 'Design'); await sleep(1500);
  await page.locator(R + '.st-pagechip:has-text("' + A0.title + '")').first().click(); await sleep(2500);
  await page.waitForSelector(R + 'button:has-text("Fix layout")', { timeout: 20000 });
  return page;
};
const cur = async () => { const g = await api('GET', '/studio/get?id=' + P); const A = g.assets.find(a => a.id === A0.id); return { A, v: A.versions.find(x => x.id === A.current) }; };

await T.t('FI1: no move clears it, so Fix layout uses the nearest passing arrangement: one layout version that names it, no model call', async () => {
  const page = await open('pass');
  try {
    const before = await cur(); const calls = fx.calls.anthropic;
    await page.locator(R + 'button:has-text("Fix layout")').first().click();
    await page.waitForFunction(() => /nearest arrangement of the same words that passes/.test(document.querySelector('#studio-root').textContent), null, { timeout: 30000 });
    const after = await cur();
    eq(after.A.versions.length, before.A.versions.length + 1, 'one new version');
    ok(after.v.kind === 'layout' && /^layout variation: .+, chosen by Fix layout/.test(after.v.note || ''), 'a layout version that names the arrangement: ' + after.v.kind + ' / ' + after.v.note);
    eq(JSON.stringify(after.v.copy), JSON.stringify(before.v.copy), 'the words did not change');
    eq(fx.calls.anthropic, calls, 'no model call');
    ok(await page.$(R + 'button:has-text("Undo fix")'), 'and the fix can be undone');
  } finally { await page.context().close(); }
});

await T.t('FI2: when no arrangement passes either, nothing is saved and the panel says why', async () => {
  const page = await open('none');
  try {
    const before = await cur();
    await page.locator(R + 'button:has-text("Fix layout")').first().click(); await sleep(4000);
    const after = await cur();
    eq(after.A.versions.length, before.A.versions.length, 'no version written');
    ok(/Nothing was saved/.test(await page.textContent(R)), 'the panel says nothing was saved');
  } finally { await page.context().close(); }
});

await T.t('FI3: no page error and no browser dialog', async () => { eq(errors, [], 'none'); });
const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
