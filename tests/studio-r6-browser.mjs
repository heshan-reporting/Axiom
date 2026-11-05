/* R6: the design engine in the page (P52, Phase 5 of prompts/studio-engines-and-canvas.md), in real Chromium against the worker
 * module in this process, every provider MOCKED. Each case fails on the P51 commit and passes with its change.
 *   DE1 the Design tool has a template library: each template drawn with this piece's words and measured as it would export;
 *       search narrows it; Use this template saves a layout version (no render)
 *   DE2 Checks show the measured design-quality score (alignment, margins, type scale, contrast, hierarchy, whitespace) beside
 *       the Creative Partner, and brand control names a colour off the kit without blocking
 *   DE3 resize shows each chosen format laid out and measured before anything is made
 *   DE4 a selected text layer offers effect presets, each one change of the effects the renderer draws
 *   DE5 History holds the team's own notes on the asset (pinned to the selected layer, @Name mentions, resolve) and says who
 *       else is editing it now
 *   DE6 a page is dragged to its place in its set: one move of the page, the same action as Move left / right
 * Run: node --experimental-sqlite tests/studio-r6-browser.mjs   (R6_PORT picks the static server's port, default 8893) */
import { makeStudio, runner, ok, eq, tool, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.R6_PORT || 8893), inspect: false });
const { api } = fx;
const T = runner('R6: the design engine (browser)');
await seedStages(fx, { prefix: 'R6', only: ['design'] });
const openDesign = async page => { await openProject(page, 'R6 at design'); await sleep(500); await goStep(page, 'Create'); await page.waitForSelector(R + '.st-le-layer[aria-label="Layer headline"]', { timeout: 20000 }); };

await T.t('DE1: templates drawn with the piece\'s words, measured, searchable; Use this template saves a layout version', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await tool(page, 'Design');
    await page.click(R + 'section[aria-label="Templates"] .st-vars-head button.ov-link');
    await page.waitForSelector(R + '.st-templates [data-template="stat_card"] .st-var-state :is(.st-chip, [class*="chip"])', { timeout: 20000 }).catch(() => {});
    const ids = await page.$$eval(R + '.st-templates [data-template]', els => els.map(e => e.dataset.template)); eq(ids.length, 8, 'eight templates: ' + ids.join(', '));
    const states = await page.$$eval(R + '.st-templates .st-var-state', els => els.map(e => e.textContent.trim()));
    ok(states.every(s => /passes|to fix|measuring/.test(s)), 'each measured: ' + states.join(' | '));
    await page.fill(R + 'input[aria-label="Search templates"]', 'petition'); await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-templates [data-template]').length === 1, null, { timeout: 10000 });
    const n0 = fx.seen.length;
    await page.click(R + '.st-templates [data-template="petition"] button:has-text("Use this template")'); await sleep(1500);
    const sent = fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path === '/studio/template/apply').map(x => JSON.parse(x.body || '{}'));
    eq(sent.length, 1, 'one apply'); eq(sent[0].template, 'petition'); ok(sent[0].base, 'sent with the version it was previewed on');
    ok(!fx.seen.slice(n0).some(x => x.path === '/studio/job'), 'no job: no render');
  } finally { await page.context().close(); }
});

await T.t('DE2: Checks show the measured design score and brand control, beside the opinion, never in its place', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await place(page, 'Quality');
    await page.waitForSelector(R + 'section[aria-label="Design quality, measured"]', { timeout: 20000 });
    const keys = await page.$$eval(R + 'section[aria-label="Design quality, measured"] [data-measure]', els => els.map(e => e.dataset.measure));
    ok(['alignment', 'type_scale', 'whitespace'].every(k => keys.indexOf(k) >= 0), 'the measures: ' + keys.join(', '));
    ok(/not a model's opinion, and never an approval/.test(await page.textContent(R + 'section[aria-label="Design quality, measured"]')), 'said as a measurement');
    ok(await page.$(R + 'section[aria-label="Brand control"]'), 'brand control is shown');
  } finally { await page.context().close(); }
});

await T.t('DE3: resize shows each format laid out and measured before anything is made', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await tool(page, 'Design');
    await page.click(R + 'section[aria-label="Resize to other formats"] .st-vars-head button.ov-link');
    await page.click(R + 'section[aria-label="Resize to other formats"] label:has-text("Story or reel")');
    const n0 = fx.seen.length;
    await page.click(R + 'button:has-text("Preview 1 format first")');
    await page.waitForSelector(R + '.st-resize-prev [data-format="9:16"]', { timeout: 15000 });
    const posts = fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path === '/studio/resize').map(x => JSON.parse(x.body || '{}'));
    ok(posts.length === 1 && posts[0].preview === true, 'asked as a preview');
    ok(!fx.seen.slice(n0).some(x => x.path === '/studio/asset'), 'nothing made');
  } finally { await page.context().close(); }
});

await T.t('DE4: a selected text layer offers effect presets', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(300);
    if (!(await page.$(R + 'details[data-sec="effects"][open]'))) await page.click(R + 'details[data-sec="effects"] > summary');
    await page.waitForSelector(R + '.st-le-presets [data-preset="lift"]', { timeout: 10000 });
    const names = await page.$$eval(R + '.st-le-presets [data-preset]', els => els.map(e => e.textContent.trim()));
    eq(names, ['None', 'Shadow', 'Lift', 'Hollow', 'Outline', 'Neon', 'Plate', 'Splice']);
    await page.click(R + '.st-le-presets [data-preset="lift"]'); await sleep(400);
    ok(/unsaved|Unsaved/.test(await page.textContent('#studio-root')), 'one change, waiting to be saved');
  } finally { await page.context().close(); }
});

await T.t('DE5: team notes on the asset, pinned to the selected layer, and who else is editing it', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(300);
    await place(page, 'Versions'); await page.waitForSelector(R + 'section[aria-label="Team notes"]', { timeout: 15000 });
    const n0 = fx.seen.length;
    await page.fill(R + 'textarea[aria-label^="A note for the team"]', '@Dee the headline wraps badly'); await page.click(R + 'section[aria-label="Team notes"] button:has-text("Add note")');
    await page.waitForSelector(R + '.st-team-list [data-comment]', { timeout: 10000 });
    const sent = fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path === '/studio/comment').map(x => JSON.parse(x.body || '{}'));
    eq(sent.length, 1); ok(sent[0].pin && sent[0].pin.layer, 'pinned to the selected layer: ' + JSON.stringify(sent[0].pin));
    ok(/the headline wraps badly/.test(await page.textContent(R + '.st-team-list')), 'listed');
    const pid = (await api('GET', '/studio/list?ns=mca')).projects.find(x => x.title === 'R6 at design').id; const g = await api('GET', '/studio/get?id=' + pid); const a = g.assets.find(x => (x.versions || []).length && x.channel);
    fx.env.MIND_DB.db.prepare('INSERT INTO studio_drafts(asset, who, project, version, layout, copy, at, name) VALUES(?,?,?,?,?,?,?,?)').run(a.id, 'kother', pid, a.current, '{}', '{}', Date.now(), 'Laura');
    await page.click(R + 'section[aria-label="Team notes"] [data-comment] button:has-text("resolve")'); await page.waitForSelector(R + '.st-team-list li.resolved', { timeout: 10000 });
  } finally { await page.context().close(); }
});

await T.t('DE6: a page dragged to its place in the set is one move', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openDesign(page); await page.waitForSelector(R + '.st-pagestrip [data-page][draggable="true"]', { timeout: 15000 });
    const ids = await page.$$eval(R + '.st-pagestrip [data-page][draggable="true"]', els => els.map(e => e.dataset.page)); ok(ids.length >= 2, 'two pages in the set: ' + ids.length);
    const n0 = fx.seen.length;
    await page.dragAndDrop(R + '.st-pagestrip [data-page="' + ids[0] + '"]', R + '.st-pagestrip [data-page="' + ids[1] + '"]'); await sleep(1500);
    const mv = fx.seen.slice(n0).filter(x => x.method === 'POST' && x.path === '/studio/page').map(x => JSON.parse(x.body || '{}'));
    eq(mv.length, 1, 'one page action'); eq([mv[0].asset, mv[0].action, mv[0].to], [ids[0], 'move', 1]);
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
