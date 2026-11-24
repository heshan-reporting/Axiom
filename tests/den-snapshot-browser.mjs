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
 *   CR11 Tab keeps to the dialog and reaches every link of the report, Shift+Tab too; Escape inside the report closes it; no
 *        key reaches the Den behind it (? and Alt+1 do nothing there); leaving the Den's view takes the dialog with it
 *   CR12 the figures on hand-made windows: a past day's hours and a week's days fall in their own Sydney buckets, a cut list
 *        is "at least" with no change drawn, the worker's pick of dates keeps a recorded date, the stand-in outlet is not a
 *        masthead, an unreadable date draws nothing and throws nothing, a javascript: address is never a link and a quote in
 *        an address cannot leave its attribute, a window before with no counts draws no change for Interactions
 * (Review of 24 November 2026: CR11, CR12 and the sharper CR3, CR7 and CR8 each fail on the page as first committed.)
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
  eq(dl.suggestedFilename(), 'coverage-aep_au-' + (await board()).window.day + '.html', 'named by the desk and the window\'s own Sydney day');
  eq(fs.readFileSync(await dl.path(), 'utf8'), shown, 'the file is the document shown'); await p.context().close();
});

await t('CR8 a view-only key can open it; no model call is made and no write is sent', async () => {
  const p = await go({ key: 'read-key' }); await p.waitForTimeout(600); const n0 = p.served.length; await p.click('#dt-btn-cov'); await ready(p);
  ok(/Top stories/.test(await inFrame(p, d => d.body.textContent)), 'drawn for a read key');
  const mine = p.served.slice(n0); ok(mine.filter(s => /^GET \/den\/board\?/.test(s)).length === 2, 'two reads of the board: ' + mine.join(' | '));
  ok(!mine.some(s => /^POST /.test(s)), 'no write of any kind while the report is made: ' + mine.filter(s => /^POST /.test(s)).join(' | '));
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
  // at 320 and 340 as well as 390: CI's fonts made a table scroll at 390 where this machine's did not (scrollable-region-focusable)
  for (const wd of [390, 340, 320]) { const q = await browser.newContext({ viewport: { width: wd, height: 844 } }); const pg = await q.newPage(); await pg.setContent(h);
    eq(await pg.evaluate(w0 => document.documentElement.scrollWidth <= w0, wd), true, 'the report at ' + wd + ' has no sideways scroll');
    await pg.addScriptTag({ content: AXE }).catch(() => {});
    const r3 = await pg.evaluate(async () => window.axe ? (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })).violations.map(v => v.id + ': ' + v.nodes.map(n => n.target.join(' ')).slice(0, 2).join(', ')) : ['axe not loaded']);
    eq(r3, [], 'axe on the report document itself at ' + wd);
    ok(await pg.evaluate(() => Array.from(document.querySelectorAll('.tw')).every(x => x.tabIndex === 0 && x.getAttribute('role') === 'region' && /, table$/.test(x.getAttribute('aria-label') || ''))), 'every table box takes the keyboard and is named');
    await q.close(); }
});

await t('CR11 Tab keeps to the dialog and reaches every link; Escape inside the report closes it; no key reaches the Den; leaving the view closes it', async () => {
  const p = await go(); await p.click('#dt-btn-cov'); await ready(p); await p.waitForTimeout(300);
  const STOPS = 'a[href], [tabindex="0"]';   // the report's Tab stops: its links and its table boxes
  const where = () => p.evaluate(sel => { const a = document.activeElement; const box = document.getElementById('den-snap'); if (!box) return 'no dialog'; if (a && a.tagName === 'IFRAME') { const d = a.contentDocument.activeElement; const i = Array.from(a.contentDocument.querySelectorAll(sel)).indexOf(d); return 'frame:' + (i >= 0 ? i : (d && d.tagName)); } return box.contains(a) ? 'bar:' + (a.getAttribute('data-a') || a.id) : 'OUTSIDE:' + (a && (a.id || a.tagName)); }, STOPS);
  const nLinks = await inFrame(p, (d, sel) => d.querySelectorAll(sel).length, STOPS); ok(nLinks >= 3, 'the report has Tab stops: ' + nLinks);
  await p.focus('[data-a="close"]'); const seen = [];
  for (let i = 0; i < nLinks + 6; i++) { await p.keyboard.press('Tab'); seen.push(await where()); }
  ok(!seen.some(x => /^OUTSIDE|no dialog/.test(x)), 'Tab never leaves the dialog: ' + seen.join(' '));
  for (let k = 0; k < nLinks; k++) ok(seen.indexOf('frame:' + k) >= 0, 'Tab stop ' + k + ' is reached by Tab: ' + seen.join(' '));
  ok(seen.indexOf('bar:print') > seen.indexOf('frame:' + (nLinks - 1)), 'after the last link Tab comes back to the bar: ' + seen.join(' '));
  await p.focus('[data-a="print"]'); await p.keyboard.press('Shift+Tab'); eq(await where(), 'frame:' + (nLinks - 1), 'Shift+Tab from the first button goes to the report\'s last link');
  const back = []; for (let i = 0; i < 4; i++) { await p.keyboard.press('Shift+Tab'); back.push(await where()); } ok(!back.some(x => /^OUTSIDE/.test(x)), 'Shift+Tab stays inside: ' + back.join(' '));
  await p.focus('[data-a="close"]'); await p.keyboard.press('?'); await p.keyboard.press('Alt+1'); await p.waitForTimeout(400);
  eq(await p.$$eval('.den-dialog', x => x.length), 0, '? did not open the Den\'s keyboard sheet behind the dialog');
  ok(await p.$('.dt-room'), 'Alt+1 did not move the Den behind the dialog');
  await p.focus('[data-a="close"]'); await p.keyboard.press('Tab'); ok(/^frame:/.test(await where()), 'into the report');
  await p.keyboard.press('Escape'); await p.waitForSelector('#den-snap', { state: 'detached', timeout: 5000 });
  eq(await p.evaluate(() => document.activeElement && document.activeElement.id), 'dt-btn-cov', 'Escape inside the report closes it and the focus is back');
  await p.click('#dt-btn-cov'); await ready(p); await p.evaluate(() => go('sources')); await p.waitForSelector('#den-snap', { state: 'detached', timeout: 5000 });
  eq(await p.evaluate(() => document.documentElement.classList.contains('dsn-open')), false, 'leaving the Den closes the dialog and frees the page\'s scroll');
  eq(p.errors, [], 'no page error'); await p.context().close();
});

await t('CR12 the figures on hand-made windows', async () => {
  const p = await open(w, 'full-key', { room: '', width: 1440, height: 900 });
  const r = await p.evaluate(() => {
    const S = window.DenSnapshot; const out = {}; const D = { id: 'x', name: 'Desk', client: 'Client', issues: [{ id: 'gas', label: 'Gas' }] };
    const syd = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 11, mi || 0);   // November is daylight time in Sydney: UTC+11
    // a past day: the window runs from the last millisecond of 19 November to the last of 20 November (Sydney)
    const to = syd(2026, 11, 21, 0) - 1, from = syd(2026, 11, 20, 0) - 1;
    const m1 = S.model({ desk: D, window: { from, to, hours: 24, day: '2026-11-20' }, media: [{ id: 1, title: 'a', outlets: ['O'], ts: syd(2026, 11, 20, 0, 30), issues: ['gas'] }], social: [{ id: 2, platform: 'x', text: 'b', ts: syd(2026, 11, 20, 9, 30), eng: { likes: 1 }, total: 1, issues: ['gas'] }], actors: [], byChannel: { news: 1, x: 1 }, counts: { rows: 2 } });
    const lab = ts => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: 'numeric', hour12: true }).format(new Date(ts)).replace(/\s/g, '').toLowerCase();
    out.pastFirst = lab(m1.buckets[0].at); out.pastNews = lab(m1.buckets.find(b => b.n.news).at); out.pastX = lab(m1.buckets.find(b => b.n.x).at); out.pastN = m1.buckets.length;
    // a week to the end of Saturday 21 November: a story on Friday 20 November falls under that Friday
    const wto = syd(2026, 11, 22, 0) - 1, wfrom = wto - 168 * 3600000;
    const m2 = S.model({ desk: D, window: { from: wfrom, to: wto, hours: 168 }, media: [{ id: 1, title: 'a', outlets: ['O'], ts: syd(2026, 11, 20, 14), issues: ['gas'] }], social: [], actors: [], byChannel: { news: 1 } });
    const dl = ts => new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: 'numeric' }).format(new Date(ts));
    out.weekN = m2.buckets.length; out.weekFirst = dl(m2.buckets[0].at); out.weekNews = dl(m2.buckets.find(b => b.n.news).at);
    // a cut list: 150 stories is "at least", and no change is drawn against a window before
    const many = Array.from({ length: 150 }, (_, i) => ({ id: i, title: 't' + i, outlets: ['O' + (i % 7)], ts: to - i * 60000, issues: ['gas'] }));
    const wnd = { from, to, hours: 24 }; const h3 = S.build(S.model({ desk: D, window: wnd, media: many, social: [], actors: [], byChannel: { news: 150 } }, { desk: D, window: wnd, media: many.slice(0, 120), social: [], actors: [], byChannel: { news: 120 } }));
    const dd = new DOMParser().parseFromString(h3, 'text/html'); const k = n => Array.from(dd.querySelectorAll('.kpi')).find(x => x.querySelector('.k').textContent === n);
    out.cutV = k('Stories').querySelector('.v').textContent; out.cutD = k('Stories').querySelector('.d').textContent;
    // the worker's pick of dates: nine weekly vigils and one recorded vote, the vote is kept
    const ups = Array.from({ length: 9 }, (_, i) => ({ date: '2026-11-' + String(25 + (i % 5)).padStart(2, '0'), what: 'vigil ' + i, recurring: true })).concat([{ date: '2026-12-15', what: 'Senate vote', recorded: true }]);
    out.ups = S.model({ desk: D, window: wnd, media: [], social: [], actors: [], upcoming: ups }).upcoming.map(u => u.what);
    // the stand-in for an unnamed outlet is no masthead
    out.standIn = S.model({ desk: D, window: wnd, media: [{ id: 1, title: 'a', outlet: 'an outlet found by Google News', outlets: ['an outlet found by Google News'], ts: to - 1000, issues: [] }], social: [], actors: [] }).now.outlets;
    // a date that cannot be read draws nothing and throws nothing
    try { S.build(S.model({ desk: D, window: wnd, media: [{ id: 1, title: 'a', outlets: ['O'], ts: 'bad', issues: [] }], social: [{ id: 2, platform: 'x', text: 'b', ts: NaN, eng: { likes: 1 }, total: 1, issues: [] }], actors: [], upcoming: [{ date: 'soon', what: 'x' }] })); out.badDate = 'ok'; } catch (e) { out.badDate = String(e.message); }
    // addresses: javascript: is never a link; a quote cannot leave its attribute
    const h4 = S.build(S.model({ desk: D, window: wnd, media: [{ id: 1, title: 'js', url: 'javascript:alert(1)', outlets: ['O'], ts: to - 1000, issues: [] }, { id: 2, title: 'q', url: 'https://e.example/a"onmouseover="x', outlets: ['O'], ts: to - 2000, issues: [] }], social: [], actors: [] }));
    const d4 = new DOMParser().parseFromString(h4, 'text/html'); out.jsLink = Array.from(d4.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(x => /^javascript/i.test(x)).length;
    out.quoteAttr = Array.from(d4.querySelectorAll('*')).some(el => el.hasAttribute('onmouseover')); out.quoteHref = (Array.from(d4.querySelectorAll('a')).find(a => /e\.example/.test(a.href)) || {}).getAttribute ? d4.querySelector('a[href*="e.example"]').getAttribute('href') : '';
    // Interactions: a window before that read no counts draws no change
    const post = { id: 9, platform: 'x', text: 'p', ts: to - 1000, eng: { likes: 5 }, total: 5, issues: [] };
    const h5 = S.build(S.model({ desk: D, window: wnd, media: [], social: [post], actors: [] }, { desk: D, window: wnd, media: [], social: [{ id: 8, platform: 'x', text: 'q', ts: from - 1000, issues: [] }], actors: [] }));
    const d5 = new DOMParser().parseFromString(h5, 'text/html'); out.intD = Array.from(d5.querySelectorAll('.kpi')).find(x => x.querySelector('.k').textContent === 'Interactions').querySelector('.d').textContent;
    return out; });
  eq([r.pastFirst, r.pastNews, r.pastX, r.pastN], ['12am', '12am', '9am', 24], 'a past day: hourly buckets from Sydney midnight, 00:30 under 12am, 09:30 under 9am');
  eq([r.weekN, r.weekFirst, r.weekNews], [7, 'Sun 15', 'Fri 20'], 'a week: seven Sydney days from Sunday 15 to Saturday 21, Friday\'s story under Friday');
  eq(r.cutV, '150+', 'a cut list is "at least"'); ok(/at least/.test(r.cutD) && !/vs/.test(r.cutD), 'with no change drawn: ' + r.cutD);
  ok(r.ups.indexOf('Senate vote') >= 0, 'the recorded vote is kept: ' + r.ups.join(', ')); eq(r.ups.length, 8, 'eight dates');
  eq(r.standIn, 0, 'the stand-in outlet is not counted'); eq(r.badDate, 'ok', 'an unreadable date throws nothing');
  eq(r.jsLink, 0, 'no javascript: link'); eq(r.quoteAttr, false, 'no attribute escaped its quote'); eq(r.quoteHref, 'https://e.example/a"onmouseover="x', 'the address is kept whole inside its attribute');
  ok(!/vs|new/.test(r.intD), 'no change for Interactions against a window with no counts: ' + r.intD);
  await p.context().close();
});

finish();
