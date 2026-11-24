/* Anne's Den: the coverage report (docs/den-snapshot.js, den-snapshot.css; 24 November 2026). On the fixture's invented
 * harbour-levy world (every sentence and name invented, the model a stub that is never called here):
 *   CR1  Today's top bar opens it: a dialog, its heading focused, the report in a sandboxed frame; Escape closes it and the
 *        focus goes back to the button
 *   CR2  every headline figure is a count over the board the page reads: mentions, stories, outlets, posts, interactions,
 *        public voices; the channel mix lists only channels that delivered (no Facebook, Instagram, YouTube or Reddit here)
 *   CR3  the document is self-contained: no script, no stylesheet or image fetched, no event handler; every link is http(s)
 *        and opens apart; a headline carrying markup is shown as text, never as markup
 *   CR4  the window before is read for the changes; when that read fails the figures still draw and the tile says why
 *   CR5  a failing board read says what failed with Try again, and Try again draws the report
 *   CR6  More tools > Coverage report, and the workbench's own button, open the same report
 *   CR7  Download .html saves exactly the document shown
 *   CR8  a view-only key can open it (it is a read); no model call is made, no write is sent
 *   CR9  a desk with nothing in its window says so instead of drawing empty charts
 *   CR10 axe on the dialog at 1366 and 1440; no sideways scroll of the Den at 1024; the report itself none at 390
 * Run: node --experimental-sqlite tests/den-snapshot-browser.mjs */
import fs from 'node:fs';
import { world, open, tab, t, ok, eq, finish, browser } from './den-fixture.mjs';

console.log('den-snapshot-browser harness (the coverage report)');
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' });
// one headline that carries markup, to prove it is shown as text (CR3)
await w.push('news', [{ src: 'pointpost', title: 'Gas tax <img src=x onerror="window.__pwned=1"> row', body: 'A windfall tax on gas export revenue was debated.', url: 'https://pointpost.example.com.au/markup', ts: Date.now() - 60 * 60000, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }]);
const callsBefore = w.calls.length;

const go = async (o) => { o = Object.assign({ room: 'today', width: 1440, height: 900 }, o || {}); const p = await open(w, o.key || 'full-key', o); if (o.room === 'today') await p.waitForSelector('.dt-status h1', { timeout: 20000 }); return p; };
const ready = p => p.waitForSelector('#den-snap iframe.dsn-frame', { timeout: 20000 });
const doc = p => p.$eval('#den-snap iframe.dsn-frame', f => f.srcdoc);
const inFrame = (p, fn, arg) => p.evaluate(([src, a]) => { const d = document.querySelector('#den-snap iframe.dsn-frame').contentDocument; return (new Function('d', 'a', 'return (' + src + ')(d, a)'))(d, a); }, [fn.toString(), arg === undefined ? null : arg]);
const kpi = (p, name) => inFrame(p, (d, n) => { const k = Array.from(d.querySelectorAll('.kpi')).find(x => x.querySelector('.k').textContent === n); return k ? k.querySelector('.v').textContent : null; }, name);
const board = async () => (await w.F('GET', '/den/board?desk=aep_au')).body;

await t('CR1 the top bar opens it: a dialog, its heading focused, the report in a frame; Escape closes it and gives the focus back', async () => {
  const p = await go(); await p.click('#dt-btn-cov');
  await p.waitForSelector('#den-snap[role="dialog"][aria-modal="true"]');
  await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'den-snap-h', null, { timeout: 5000 });
  await ready(p);
  eq(await p.$eval('#den-snap iframe', f => f.getAttribute('sandbox')), 'allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox', 'the frame is sandboxed without scripts');
  ok(/Australian Energy Producers/.test(await inFrame(p, d => d.querySelector('h1').textContent)), 'the client is the report\'s title');
  ok(!(await p.$eval('[data-a="download"]', b => b.disabled)) && !(await p.$eval('[data-a="print"]', b => b.disabled)), 'Download and Print are offered once the report is drawn');
  await p.keyboard.press('Escape'); await p.waitForSelector('#den-snap', { state: 'detached' });
  eq(await p.evaluate(() => document.activeElement && document.activeElement.id), 'dt-btn-cov', 'the focus is back on the button');
  eq(p.errors, [], 'no page error'); await p.context().close();
});

await t('CR2 every headline figure is a count over the board; the channel mix lists only channels that delivered', async () => {
  const b = await board(); const p = await go(); await p.click('#dt-btn-cov'); await ready(p);
  const posts = b.social.concat(b.actors); const outlets = new Set(); b.media.forEach(m => (m.outlets.length ? m.outlets : [m.outlet]).forEach(o => outlets.add(o.toLowerCase())));
  eq(await kpi(p, 'Mentions'), String(b.counts.rows), 'mentions = every row in the window');
  eq(await kpi(p, 'Stories'), String(b.media.length), 'stories = folded stories');
  eq(await kpi(p, 'Outlets'), String(outlets.size), 'outlets = distinct mastheads');
  eq(await kpi(p, 'Social posts'), String(posts.length), 'posts = social and actors');
  eq(await kpi(p, 'Interactions'), String(posts.reduce((a, x) => a + (x.total || 0), 0)), 'interactions = the counts read');
  eq(await kpi(p, 'Public voices'), String(new Set(b.actors.map(a => a.who.toLowerCase())).size), 'public voices = distinct registered actors');
  const mix = await inFrame(p, d => { const c = Array.from(d.querySelectorAll('.card')).find(x => x.querySelector('h2').textContent === 'Channel mix'); return Array.from(c.querySelectorAll('.bars li')).map(li => li.querySelector('.l').textContent + '=' + li.querySelector('.n').textContent); });
  eq(mix, Object.keys(b.byChannel).filter(k => b.byChannel[k] > 0).map(k => ({ news: 'News', x: 'X' })[k] + '=' + b.byChannel[k]), 'the channel mix is byChannel, delivering channels only');
  const text = await inFrame(p, d => d.body.textContent);
  ok(!/Facebook \(|Instagram|YouTube|Reddit/.test(text), 'no channel that did not deliver is named: ' + (text.match(/Facebook \(|Instagram|YouTube|Reddit/) || [])[0]);
  ok(/Top stories/.test(text) && /Most engaged posts/.test(text) && /Public voices/.test(text) && /Coming up/.test(text), 'the tables are drawn');
  eq(await inFrame(p, d => d.querySelectorAll('.card table tbody tr').length > 0), true, 'rows in the tables');
  await p.context().close();
});

await t('CR3 the document is self-contained, its links open apart, and a headline carrying markup is shown as text', async () => {
  const p = await go(); await p.click('#dt-btn-cov'); await ready(p); const h = await doc(p);
  ok(!/<script/i.test(h), 'no script'); ok(!/<link\b/i.test(h) && !/@import/i.test(h), 'no stylesheet fetched'); ok(!/<img\b/i.test(h), 'no image');
  ok(await inFrame(p, d => Array.from(d.querySelectorAll('*')).every(el => Array.from(el.attributes).every(at => !/^on/i.test(at.name)))), 'no event handler attribute in the drawn document');
  const hrefs = (h.match(/href="([^"]*)"/g) || []).map(x => x.slice(6, -1)); ok(hrefs.length > 0, 'links are drawn');
  ok(hrefs.every(u => /^https?:\/\//.test(u)), 'every link is http(s): ' + hrefs.filter(u => !/^https?:/.test(u)).join(' '));
  ok(await inFrame(p, d => Array.from(d.querySelectorAll('a')).every(a => a.target === '_blank' && /noopener/.test(a.rel))), 'every link opens apart, noopener');
  ok(await inFrame(p, d => /Gas tax <img src=x onerror="window.__pwned=1"> row/.test(d.body.textContent)), 'the markup is shown as text');
  eq(await p.evaluate(() => window.__pwned || 0), 0, 'and never ran'); await p.context().close();
});

await t('CR4 the window before is read for the changes; when that read fails the figures still draw and say why', async () => {
  const p = await go(); await p.click('#dt-btn-cov'); await ready(p);
  const reads = p.served.filter(s => /^GET \/den\/board\?desk=aep_au&to=/.test(s)); ok(reads.length === 1 && /hours=24/.test(reads[0]), 'one read of the 24 hours before: ' + reads.join(' | '));
  ok(/vs \d|none before|in either window/.test(await inFrame(p, d => d.querySelector('.kpis').textContent)), 'the tiles carry the change');
  ok(/Changes compare with the 24 hours before/.test(await inFrame(p, d => d.querySelector('.kpis').textContent)), 'and say what they compare with');
  await p.keyboard.press('Escape');
  let n = 0; const hook = async (route, r, path) => { if (/^\/den\/board\?desk=aep_au&to=/.test(path)) { n++; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'db_busy', detail: 'The database is busy.' }) }); return true; } return false; };
  w.hooks.push(hook);
  try { await p.click('#dt-btn-cov'); await ready(p); ok(n >= 1, 'the window before was asked');
    eq(await kpi(p, 'Stories'), String((await board()).media.length), 'the figures still draw');
    ok(/the window before could not be read/.test(await inFrame(p, d => d.querySelector('.kpis').textContent)), 'the tile says why there is no change');
  } finally { w.hooks.splice(w.hooks.indexOf(hook), 1); }
  await p.context().close();
});

await t('CR5 a failing board read says what failed with Try again, and Try again draws the report', async () => {
  const p = await go(); let fail = true;
  const hook = async (route, r, path) => { if (fail && /^\/den\/board\?desk=aep_au$/.test(path)) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'den_failed', detail: 'The board could not be read: test failure.' }) }); return true; } return false; };
  w.hooks.push(hook);
  try { await p.click('#dt-btn-cov'); await p.waitForSelector('#den-snap .dsn-err', { timeout: 15000 });
    const tx = await p.$eval('#den-snap .dsn-err', e => e.textContent); ok(/could not be made/.test(tx) && /test failure/.test(tx), 'the reason is said: ' + tx);
    eq(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-a')), 'retry', 'Try again has the focus');
    ok(await p.$eval('[data-a="download"]', b => b.disabled), 'nothing to download'); eq(await p.$$eval('#den-snap iframe', f => f.length), 0, 'no empty report');
    fail = false; await p.click('[data-a="retry"]'); await ready(p); ok(/Top stories/.test(await inFrame(p, d => d.body.textContent)), 'Try again draws it');
  } finally { w.hooks.splice(w.hooks.indexOf(hook), 1); }
  await p.context().close();
});

await t('CR6 More tools > Coverage report and the workbench\'s button open the same report', async () => {
  const p = await go(); await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: 'Coverage report' }).click(); await ready(p);
  const a = await inFrame(p, d => d.querySelector('.kpis .v').textContent); await p.click('[data-a="close"]'); await p.waitForSelector('#den-snap', { state: 'detached' });
  eq(await p.evaluate(() => document.activeElement && document.activeElement.id), 'dt-btn-more', 'the focus goes back to More tools');
  await p.context().close();
  const q = await go({ room: '' }); await tab(q, 'today'); await q.click('.den-cov'); await ready(q);
  eq(await inFrame(q, d => d.querySelector('.kpis .v').textContent), a, 'the workbench opens the same figures'); await q.context().close();
});

await t('CR7 Download .html saves exactly the document shown', async () => {
  const p = await go(); await p.click('#dt-btn-cov'); await ready(p); const shown = await doc(p);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-a="download"]')]);
  ok(/^coverage-aep_au-\d{4}-\d\d-\d\d\.html$/.test(dl.suggestedFilename()), 'named by desk and day: ' + dl.suggestedFilename());
  eq(fs.readFileSync(await dl.path(), 'utf8'), shown, 'the file is the document shown'); await p.context().close();
});

await t('CR8 a view-only key can open it; no model call is made and no write is sent', async () => {
  const p = await go({ key: 'read-key' }); await p.click('#dt-btn-cov'); await ready(p);
  ok(/Top stories/.test(await inFrame(p, d => d.body.textContent)), 'drawn for a read key');
  ok(!p.served.some(s => /^POST /.test(s) && /\/den\/board|snapshot/.test(s)), 'no write');
  eq(w.calls.length, callsBefore, 'no model call across the harness'); await p.context().close();
});

await t('CR9 a desk with nothing in its window says so instead of drawing empty charts', async () => {
  const p = await open(w, 'full-key', { room: '', width: 1440, height: 900 });
  await p.evaluate(() => window.DenSnapshot.open({ desk: { id: 'mca_vic', name: 'MCA Victoria' } })); await ready(p);
  const tx = await inFrame(p, d => d.body.textContent);
  ok(/Nothing in this window yet/.test(tx), 'says so'); ok(!/Mentions over the window/.test(tx), 'no empty chart');
  eq(await inFrame(p, d => d.querySelector('.kpis .v').textContent), '0', 'the figures are zero, not blank'); await p.context().close();
});

await t('CR10 axe on the dialog at 1366 and 1440; no sideways scroll of the Den at 1024; the report none at 390', async () => {
  for (const [wd, ht] of [[1366, 768], [1440, 900]]) {
    const p = await go({ width: wd, height: ht }); await p.click('#dt-btn-cov'); await ready(p); await p.addScriptTag({ content: AXE });
    const r = await p.evaluate(async () => (await window.axe.run(document.getElementById('den-snap'), { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).slice(0, 2).join(', ')));
    eq(r, [], 'axe at ' + wd);
    await p.context().close();
  }
  const p = await go({ width: 1024, height: 768 }); eq(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll at 1024');
  await p.click('#dt-btn-cov'); await ready(p); const h = await doc(p); await p.context().close();
  const q = await browser.newContext({ viewport: { width: 390, height: 844 } }); const pg = await q.newPage(); await pg.setContent(h);
  eq(await pg.evaluate(() => document.documentElement.scrollWidth <= 390), true, 'the report at 390 has no sideways scroll');
  await pg.addScriptTag({ content: AXE }).catch(() => {});
  const r3 = await pg.evaluate(async () => window.axe ? (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).slice(0, 2).join(', ')) : ['axe not loaded']);
  eq(r3, [], 'axe on the report document itself'); await q.close();
});

finish();
