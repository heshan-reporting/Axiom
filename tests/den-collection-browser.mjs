/* Anne's Den, the Collection tab as the one home of delivery problems (release r52, owner's item (a), 16 November 2026):
 * a channel that delivered nothing is said here, with why and the one action, and nowhere else. Same fixture as
 * tests/den-browser.mjs: docs/ served from disk, the worker module in this process, nothing contacted, nothing spent.
 *   the "Not delivering" panel (each gap, its reason, its action; all delivering; checking; a past day), Watch without a
 *   collector's error text, a read-only key, Collect now only where a channel has a route, the pipeline block when the
 *   worker sends it, setup details folded, and the Options "Saved." notice that stays.
 * Run: node --experimental-sqlite tests/den-collection-browser.mjs */
import { world, open, t, ok, eq, txt, all, tab, panel, finish, H, D, NOW, CARD } from './den-fixture.mjs';

console.log('den-collection-browser harness');
const w = await world();
const GAPS = '#den-tabpanel section.den-panel[aria-label="Not delivering"]';
const syd = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
/* a hook that answers a GET from the worker and lets the harness change the body first */
const rewrite = (rx, fn, gate) => async (route, r, path) => { if (r.method() !== 'GET' || !rx.test(path)) return false; if (gate) await gate;
  const res = await w.call('GET', path, null, r.headers()['x-axiom-key'] || null); let body = res.body; try { body = fn(JSON.parse(res.text)); } catch (e) { body = JSON.parse(res.text); }
  await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); return true; };
const noGaps = b => { const m = b.missed || b; if (m && Array.isArray(m.signals)) m.signals = m.signals.filter(s => s.sig !== 'gap'); if (m && m.counts) delete m.counts.gap; return b; };

await t('Collection opens on "Not delivering": each channel that delivered nothing, why, and the one action', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media')); await tab(p, 'collection'); await p.waitForSelector(GAPS + ' li');
  eq(await p.locator('#den-tabpanel section.den-panel:visible').first().getAttribute('aria-label'), 'Not delivering', 'it is the first panel on the tab');
  eq(await p.getAttribute(GAPS, 'data-tour'), 'gaps', 'the tour can find it');
  const fb = p.locator(GAPS + ' li', { hasText: 'Facebook' }); const t1 = (await fb.textContent()).replace(/\s+/g, ' ');
  ok(/Facebook delivered nothing in this window/.test(t1) && /not granted/.test(t1) && /No signed-in collector is connected/.test(t1), 'the gap, and why: ' + t1.slice(0, 300));
  ok(await fb.locator('details summary', { hasText: 'Setup details' }).count() === 1 && /Page Public Content Access/.test(await fb.locator('details').textContent()) && !(await fb.locator('details').evaluate(e => e.open)), 'the permission name is folded under Setup details');
  ok(!/\(Page Public Content Access\)/.test(await fb.locator('.den-why').textContent()), 'and not in the sentence that says why');
  const go = fb.getByRole('button', { name: /^Collect now/ }); ok(await go.isEnabled(), 'the one action is there'); eq(await fb.getByRole('button').count(), 1, 'one action a gap');
  await go.click(); await p.waitForSelector(GAPS + ' .sig-con', { timeout: 15000 }); await w.settle(); ok(p.served.some(s => /^POST \/den\/collect$/.test(s)), 'it started a collection job'); ok(/Facebook/.test(await txt(p, GAPS + ' .sig-conhead')), 'and its console opens under the gap');
  eq(await p.locator('#den-tabpanel section.den-panel[aria-label="Channels"] .sig-con').count(), 0, 'once, under the gap, not again in the table');
  eq(p.errors, []); await p.context().close();
});

await t('with every channel delivering, the panel says so; while the checks load it says Checking...', async () => {
  let release; const gate = new Promise(r => { release = r; });
  w.hooks = [rewrite(/^\/den\/(board|missed)\?/, noGaps, gate)];
  try {
    const p = await open(w); await tab(p, 'collection'); await p.waitForSelector(GAPS);
    ok(/Checking/.test(await txt(p, GAPS)), 'while the checks load: ' + (await txt(p, GAPS)).slice(0, 200)); eq(await p.locator(GAPS + ' li').count(), 0);
    release(); await p.waitForFunction(s => /delivered/.test(document.querySelector(s).textContent) && !/Checking/.test(document.querySelector(s).textContent), GAPS, { timeout: 15000 });
    const g = await txt(p, GAPS); ok(/Every channel this desk relies on delivered\./.test(g), g.slice(0, 200)); eq(await p.locator(GAPS + ' li').count(), 0); eq(await p.locator(GAPS + ' button').count(), 0, 'nothing to press');
    ok(!(await p.$('#den-tab-collection[data-attn]')), 'and the tab carries no mark');
    eq(p.errors, []); await p.context().close();
  } finally { w.hooks = []; }
});

await t('a past day: the panel says which day it is for, and that the channels below are as they stand now', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media')); const day = syd(NOW - 2 * D); await p.fill('.den-head input[aria-label="Day"]', day);
  await p.waitForFunction(() => /not today/.test(document.querySelector('.den-head').textContent)); await tab(p, 'collection'); await p.waitForSelector(GAPS + ' header .den-note');
  const dd = String(+day.slice(8, 10)); const mon = new Date(day + 'T12:00:00Z').toLocaleString('en-AU', { month: 'long', timeZone: 'UTC' });
  const note = await txt(p, GAPS + ' header .den-note'); ok(new RegExp('^For .*\\b' + dd + ' ' + mon).test(note), 'the day: ' + note);
  ok(/as (they stand|it stands) now/.test(await txt(p, GAPS)), 'and the table below is now: ' + (await txt(p, GAPS)).slice(0, 300));
  await p.getByRole('button', { name: 'Today' }).click(); await p.waitForFunction(s => /window/.test(document.querySelector(s + ' header .den-note').textContent), GAPS);
  ok(/In this desk.s window/.test(await txt(p, GAPS + ' header .den-note')), 'back on today it says the window');
  eq(p.errors, []); await p.context().close();
});

await t('Watch says when each account was last read, never a collector\'s error', async () => {
  w.hooks = [rewrite(/^\/den\/watch\?/, b => { (b.watch || []).forEach((r, i) => { if (r.kind === 'account') { r.last_error = 'HTTP 429: rate limited by the upstream host'; if (i % 2) { r.last_ok = NOW - 3 * H; r.last_layer = 2; } else r.last_ok = 0; } }); return b; })];
  try {
    const p = await open(w); await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); await p.getByRole('tab', { name: /^Accounts/ }).click(); await p.waitForSelector('section.den-panel[aria-label="Accounts"] tr.den-row');
    const rows = await all(p, 'section.den-panel[aria-label="Accounts"] tr.den-row'); ok(rows.length >= 2, rows.join(' // '));
    ok(!rows.some(r => /429|rate limited|upstream/.test(r)), 'no collector error on Watch: ' + rows.join(' // ')); eq(await p.locator('#den-tabpanel .den-neg').count(), 0, 'nothing in red');
    ok(rows.some(r => /not read yet/.test(r)), 'an account never read says so: ' + rows.join(' // ')); ok(rows.some(r => /3 h ago/.test(r)) && !rows.some(r => /layer/.test(r)), 'a read account says when, in plain words: ' + rows.join(' // '));
    eq(p.errors, []); await p.context().close();
  } finally { w.hooks = []; }
});

await t('a read-only key sees the panel and its reasons, and no button', async () => {
  const p = await open(w, 'read-key'); await p.waitForFunction(() => window.AX_ROLE === 'read'); await p.waitForSelector(CARD('media')); await tab(p, 'collection'); await p.waitForSelector(GAPS + ' li');
  const g = await txt(p, GAPS); ok(/Facebook delivered nothing in this window/.test(g) && /not granted/.test(g), g.slice(0, 300)); eq(await p.locator(GAPS + ' button').count(), 0, 'no control that writes');
  eq(p.served.filter(s => /^POST \/den\//.test(s)), [], 'and it sent no write'); await p.context().close();
});

await t('Collect now is offered only where a channel has a collection route', async () => {
  const p = await open(w); await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row');
  for (const name of ['Parliamentary record', 'Hansard', 'Campaign petition counters']) { const b = panel(p, 'Channels').locator('tr.den-row', { hasText: name }).getByRole('button', { name: 'Collect now' });
    ok((await b.count()) === 0 || await b.isDisabled(), name + ' has no route, so it cannot be collected now'); if (await b.count()) ok(/no collection job|read on its own schedule/i.test(await b.getAttribute('title') || ''), 'and says why: ' + await b.getAttribute('title')); }
  ok(await panel(p, 'Channels').locator('tr.den-row', { hasText: 'Bluesky' }).getByRole('button', { name: 'Collect now' }).isEnabled(), 'a channel with a route still can');
  eq(p.errors, []); await p.context().close();
});

await t('the analysis pipeline, the last tick and the accounts that could not be read are said when the worker sends them, and absent when it does not', async () => {
  // a worker older than p67 sends neither field (worker p67 always sends pipeline, and tick once a tick has run)
  w.hooks = [rewrite(/^\/den\/collection\?/, b => { delete b.pipeline; delete b.tick; return b; })];
  let p = await open(w); await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); eq(await p.locator('#den-tabpanel [data-tour="pipeline"]').count(), 0, 'no placeholder when the worker sends nothing'); await p.context().close(); w.hooks = [];
  w.hooks = [rewrite(/^\/den\/collection\?/, b => Object.assign(b, { pipeline: { unplaced: 12, oldestUnplacedMin: 34, titled: 3, awaitingModel: 2 }, tick: { at: NOW - 5 * 60000, total: 41200, stages: [['core', 2100], ['registry', 30100]], ai: false }, accounts: [{ platform: 'x', value: 'harbourwatch', last_ok: NOW - 26 * H, last_error: 'rate limited' }] }))];
  try {
    p = await open(w); await tab(p, 'collection'); await p.waitForSelector('#den-tabpanel [data-tour="pipeline"]'); const s = await txt(p, '#den-tabpanel [data-tour="pipeline"]');
    ok(/12 items? waiting/.test(s) && /oldest 34 min/.test(s) && /3 narratives? carry a working title/.test(s) && /2 wait for a model name/.test(s), s); ok(/last tick took 41 s/i.test(s) && /5 min ago/.test(s), s);
    const g = await txt(p, GAPS); ok(/Accounts that could not be read/.test(g) && /harbourwatch on X/.test(g) && /rate limited/.test(g), 'an account that failed is said on Collection: ' + g.slice(-300));
    eq(p.errors, []); await p.context().close();
  } finally { w.hooks = []; }
});

await t('the script and secret names sit under Setup details, closed', async () => {
  const p = await open(w); await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row');
  const nb = p.locator('#den-tabpanel details.den-setup'); ok(await nb.count() >= 1, 'a Setup details fold'); ok(await nb.first().evaluate(e => !e.open), 'closed by default');
  eq(await p.locator('#den-tabpanel > .den-page > div > p.den-mono').count(), 0, 'the not-built paragraph is no longer loose on the tab');
  eq(p.errors, []); await p.context().close();
});

await t('a desk with nothing collected: News is said not to have delivered, and never as a quiet day', async () => {
  const p = await open(w); await p.selectOption('.den-head select[aria-label="Desk"]', 'guns_au'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent));
  await tab(p, 'collection'); await p.waitForFunction(s => { const e = document.querySelector(s); return e && /News delivered nothing/.test(e.textContent); }, GAPS, { timeout: 15000 });
  const g = await txt(p, GAPS); ok(/News delivered nothing in this window/.test(g) && /before reading it as a quiet day/.test(g), g.slice(0, 300));
  ok(await p.locator(GAPS + ' li', { hasText: 'News' }).getByRole('button', { name: /^Collect now/ }).isEnabled(), 'News has a route, so it can be collected now');
  await p.selectOption('.den-head select[aria-label="Desk"]', 'aep_au'); eq(p.errors, []); await p.context().close();
});

await t('Options says "Saved." after a save, and the notice stays', async () => {
  const p = await open(w); await tab(p, 'options'); await p.waitForSelector('section.den-panel[aria-label="The desk"]');
  await p.locator('section.den-panel[aria-label="The desk"] input[type="number"]').fill('30'); await p.getByRole('button', { name: 'Save options' }).click();
  await p.waitForFunction(() => /the last 30 hours/.test(document.querySelector('.den-win').textContent)); await p.waitForTimeout(600);
  ok(/Saved\./.test(await txt(p, '#den-tabpanel .den-notice.good')), 'the notice survives the desk coming back with its new revision');
  await p.locator('section.den-panel[aria-label="The desk"] input[type="number"]').fill('24'); await p.getByRole('button', { name: 'Save options' }).click(); await p.waitForFunction(() => /the last 24 hours/.test(document.querySelector('.den-win').textContent));
  eq(p.errors, []); await p.context().close();
});

await finish();
