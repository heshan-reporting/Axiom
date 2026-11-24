/* Anne's Den build p72, page lane P3: Today's report (UX-SPEC Part D; docs/den-today.js, den-today.css, den.js's rooms,
 * den-brief.js's one layout branch). On the fixture's invented harbour-levy world (The Point Post, The Tribune, Harbour Watch;
 * AEP national drafted by the stub model, AEP Victoria written by hand through POST /den/brief/save), the sixteen cases of
 * UX-SPEC s.15.1:
 *   T1  open: a fresh store opens Today on AEP national; with National sent, AEP Victoria; ax_den_tab = options opens the workbench
 *   T2  visit-only: More tools and Alt+1 from Today are visits (a reload opens Today); a tab chosen in the workbench's row sticks
 *   T3  Your reports: seeded with the client's desks; Other reports lists every desk; choosing one adds it
 *   T4  the document: header lines, heading order, ratings in words and source numbers equal the html export's
 *   T5  the fold: Copy and Mark as sent in view at 1366x650 and 1440x790 (top, middle, end); two items in view with one open;
 *       the bar at 1100x768 and 390x844; no sideways scroll at 320 px; no intro card over either button
 *   T6  check: Go to the first, each kind's fix through its route, the next item opens and takes the focus, Skip for now, Undo,
 *       a failing fix said and put back
 *   T7  one count: the switcher, the column's heading and the bar agree after every fix
 *   T8  copy: no DRAFT in the html or the text, unsaved words saved first, the desk named, the copy guard
 *   T9  mark as sent: things open (the box, Go to the first, Send anyway with acknowledge); D2 (left alerts acknowledged
 *       without a second ask, acknowledge 'left'); an alert the page had not shown joins the box; Next; all sent
 *   T10 every state of s.9 by hook, its words, and no Den word in the room
 *   T11 a view-only key; another day (sent, with a report, with none)
 *   T12 help: the introduction once, no write while it shows, its words follow the state
 *   T13 keyboard and focus: Alt+0, Alt+1 to 5, Esc in each layer with the focus back, DOM order, the focus rules
 *   T14 screen reader: one polite region and one alert region; no live region ticks
 *   T15 axe at the sizes and states of s.10.6
 *   T16 one state: an edit shows in both rooms; a conflict shows Keep mine / Use theirs on Today; switching rooms mid-edit
 * and the p72 review's page findings (review/FIX-PAGE.md), each case failing before its fix:
 *   T17 U1 the send block's words under 1200 px      T18 U3 the introduction under 1200 px     T19 U9 one focus move after the last fix
 *   T20 U2, U4 the Sources drawer                      T21 P1 a check left during a save         T22 P2 Write a sentence for it keeps the editor
 *   T23 P3 a p71 store opens Today, day one and two    T24 P4 a board answer without its alerts  T25 P5 Use here at the cursor
 *   T26 P6 a busy desks refresh keeps the day          T27 U5 the numbers follow what is shown   T28 U6 one primary at a time
 *   T29 U8 the report not loaded                      T30 P9 a source the report can't use
 *   T31 names blanked for a guest print no dangling "by"; and T14 counts the live regions in every state, the drawer included (U7)
 * Every sentence and name is invented. Run with the sandbox off: node --experimental-sqlite tests/den-today-browser.mjs */
import fs from 'node:fs';
import { world, open, t, ok, eq, finish, sec, vicBrief } from './den-fixture.mjs';

console.log('den-today-browser harness (Today\'s report: the room, its rules, its states)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const until = async (p, fn, what, arg) => { try { await p.waitForFunction(fn, arg === undefined ? null : arg, { timeout: 15000 }); } catch (e) { throw new Error('never happened: ' + what + ' (' + (await p.evaluate(() => ((document.querySelector('#den-app') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 300)).catch(() => '')) + ')'); } };
const ready = p => until(p, () => { const r = document.querySelector('.dt-room'); return !!r && r.dataset.state !== 'loading' && !document.querySelector('#dt-col .den-checks-alerts'); }, 'Today ready');
const go = async (w, o) => { o = Object.assign({ room: 'today', width: 1366, height: 768 }, o || {}); const p = await open(w, o.key || 'full-key', o);
  try { await p.waitForSelector(o.room === '' ? '#den-app' : '.dt-status h1', { timeout: 20000 }); } catch (e) { throw new Error('Today did not open: ' + JSON.stringify(p.errors) + ' ' + (await p.evaluate(() => ((document.querySelector('#den-root') || {}).innerText || '').replace(/\s+/g, ' ').slice(0, 300)))); } return p; };
const focusIs = (p, fn, what) => until(p, fn, what);
const toEnd = p => p.evaluate(() => { const ta = document.activeElement; ta.setSelectionRange(ta.value.length, ta.value.length); });
const reload = async p => { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function'); await p.evaluate(() => go('den')); await p.waitForSelector('#den-app', { timeout: 20000 }); };
const h1 = p => p.evaluate(() => (document.querySelector('.dt-status h1') || {}).textContent || '');
const lineTxt = p => p.evaluate(() => ((document.querySelector('.dt-status') || {}).innerText || '').replace(/\s+/g, ' '));
const chip = p => p.evaluate(() => { const c = document.querySelector('#dt-col .den-checks-head .den-chip'); return c ? +c.getAttribute('data-count') : -1; });
const live = p => p.evaluate(() => (document.querySelector('[data-dt-live="polite"]') || {}).textContent || '');
const act = p => p.evaluate(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.id, text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80), cls: a.className || '', act: a.getAttribute('data-act') || '', fx: a.getAttribute('data-fx') || '', item: (a.closest && a.closest('[data-fl-item]') || { getAttribute: () => '' }).getAttribute('data-fl-item') } : {}; });
const mine = p => p.$$eval('.dt-mine .dt-rep b', els => els.map(e => e.textContent));
const tabOn = (p, id) => until(p, i => { const x = document.getElementById('den-tab-' + i); return !!x && x.getAttribute('aria-selected') === 'true'; }, 'the ' + id + ' tab', id);
const more = async (p, name) => { await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: name }).first().click(); };
// the Den's own words, never on Today (s.6.2): over the room's words, leaving out her report's own text and what quotes it; the
// Sources drawer and the checks sheet are read too (p72 review U2: they were left out, and the drawer held "Sentinel" and "baseline")
const DEN_RX = /\b(evidence|rows?|cards?|pins?|pinned|strip|rail|file|filed|filing|brief|desks?|model|revision|cite|cited|citation|signals?|sentinel|baseline|computed|acknowledged|worker|flags?)\b/gi;
const wordsIn = (p, sel) => p.evaluate(([s, src]) => { const r = document.querySelector(s); if (!r) return ['nothing at ' + s]; const c = r.cloneNode(true);
  c.querySelectorAll('.den-docbody, .dt-doct, .den-fl-q, .dt-srcl, .dt-slot, [data-dt-live], select, .dt-cmp, q').forEach(n => n.remove()); const tx = c.textContent;
  return (tx.match(new RegExp(src, 'gi')) || []).concat(tx.match(/(?<!reporting )\bwindow\b/gi) || []); }, [sel, DEN_RX.source]);
const denWords = p => wordsIn(p, '#den-app');
// seen: drawn with a size, inside the window, not hidden; focusSeen: the focus is on such an element, matching sel
const seen = (p, sel) => p.evaluate(s => Array.from(document.querySelectorAll(s)).some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).visibility !== 'hidden'; }), sel);
const focusSeen = (p, sel, what) => until(p, s => { const a = document.activeElement; if (!a || a === document.body || !a.matches(s)) return false; const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; }, what, sel);
const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
// a GET's answer, changed on its way to the page
const reshape = (w, re, fn) => async (route, r, path) => { if (r.method() !== 'GET' || !re.test(path)) return false; const res = await w.call('GET', path, null, r.headers()['x-axiom-key']); const d = JSON.parse(res.text); fn(d); await json(route, res.status, d); return true; };
const sydDayOf = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const dayLong = day => { const p = {}; new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(new Date(day + 'T12:00:00Z')).forEach(x => { p[x.type] = x.value; }); return p.weekday + ' ' + p.day + ' ' + p.month; };
/* Every open thing on a report left as it is, with a reason, through the worker (the worker's flags, the empty sections and
   the alerts), so the report has nothing to check. */
async function clearAll(w, desk) {
  const b = (await w.F('GET', '/den/brief?desk=' + desk)).body.brief; const dk = (await w.F('GET', '/den/desks')).body.desks.find(d => d.id === desk); const ops = [];
  (b.flags || []).forEach(f => { if (!f.left) ops.push({ op: 'leave', key: f.key, kind: f.kind, sec: f.section || '', note: 'Fine as it is' }); });
  dk.sections.filter(s => s.kind !== 'sources' && (dk.options.hidden || []).indexOf(s.id) < 0 && !String(((b.sections || {})[s.id] || {}).text || '').trim()).forEach(s => ops.push({ op: 'leave', key: 'empty:' + s.id, kind: 'empty', sec: s.id, note: 'Not needed today' }));
  ((await w.F('GET', '/den/missed?desk=' + desk)).body.signals || []).filter(s => s.sig !== 'gap').forEach(s => ops.push({ op: 'leave', key: s.key, kind: 'check', note: 'Too small to report' }));
  const r = await w.F('POST', '/den/brief/review', { id: b.id, ops }); if (r.status !== 200) throw new Error('clearAll ' + r.text.slice(0, 200)); return b;
}
const mkWorld = async () => { const w = await world(); const d = await w.F('POST', '/den/brief', { desk: 'aep_au' }); if (d.status !== 200) throw new Error('draft ' + d.text.slice(0, 160)); await vicBrief(w); return w; };

/* ---------------------------------------------------------------------------------------------- T1 open */
await t('T1 open: a fresh store opens Today on AEP national; with National sent, AEP Victoria; ax_den_tab = options opens the workbench on Options', async () => {
  const w = await mkWorld(); let p = await go(w, { room: 'fresh' });
  ok(/^AEP national report · /.test(await h1(p)), await h1(p)); eq(await p.getAttribute('.dt-mine [data-desk="aep_au"]', 'aria-current'), 'page');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_p72'))), 1, 'the one-time flag is set'); eq(p.errors, []); await p.context().close();
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; const f = await w.F('POST', '/den/brief/file', { id: b.id, revision: b.revision, acknowledge: true }); eq(f.status, 200);
  p = await go(w, { room: 'fresh' }); ok(/^AEP Victoria report · /.test(await h1(p)), 'the first of hers not sent: ' + await h1(p)); eq(p.errors, []); await p.context().close();
  p = await go(w); await p.evaluate(() => localStorage.setItem('ax_den_tab', JSON.stringify('options'))); await reload(p); await tabOn(p, 'options'); eq(await p.locator('.dt-room').count(), 0, 'the workbench, not Today'); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T2 visit-only */
const W = await mkWorld();
await t('T2 visit-only: More tools and Alt+1 from Today do not move where the Den opens; a tab chosen in the workbench\'s row does', async () => {
  const p = await go(W); await ready(p);
  await more(p, 'Find a story the report missed'); await tabOn(p, 'today'); eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report', 'a visit writes nothing');
  await reload(p); await p.waitForSelector('.dt-room'); eq(await p.locator('.dt-room').count(), 1, 'Today again after the reload');
  await p.keyboard.press('Alt+1'); await tabOn(p, 'today'); await reload(p); await p.waitForSelector('.dt-room');
  await more(p, 'Sections and sources'); await tabOn(p, 'brief'); await p.click('#den-tab-today'); await tabOn(p, 'today');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'today', 'the tab row is a choice'); await reload(p); await tabOn(p, 'today'); eq(await p.locator('.dt-room').count(), 0);
  await p.click('#den-tab-report'); await p.waitForSelector('.dt-room'); eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report'); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T3 your reports */
await t('T3 Your reports: seeded with the client\'s desks; Other reports lists every desk; choosing one opens it and adds it', async () => {
  const p = await go(W, { room: 'fresh' }); await p.evaluate(() => { localStorage.removeItem('ax_den_mine'); localStorage.setItem('ax_den_desk', JSON.stringify('aep_au')); }); await reload(p); await p.waitForSelector('.dt-mine .dt-rep');
  eq(await mine(p), ['AEP national', 'AEP Victoria']); ok(/^aep_au|aep_vic$/.test(Object.keys(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_mine')))).join('|')), 'the seeded list is kept as hers');
  await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: 'Other reports' }).click(); const names = await p.$$eval('#dt-list-others .dt-mi[data-desk]', els => els.map(e => e.getAttribute('data-desk')));
  eq(names, (await W.F('GET', '/den/desks')).body.desks.map(d => d.id), 'every desk'); await p.click('#dt-list-others .dt-mi[data-desk="mca_au"]'); await until(p, () => /^MCA national report/.test((document.querySelector('.dt-status h1') || {}).textContent || ''), 'MCA national opened');
  await until(p, () => document.querySelectorAll('.dt-mine .dt-rep').length === 3, 'MCA national joined Your reports'); eq(await mine(p), ['AEP national', 'AEP Victoria', 'MCA national']); eq(await p.getAttribute('.dt-mine [data-desk="mca_au"]', 'aria-current'), 'page'); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T4 the document */
await t('T4 the document: every visible section in the desk\'s order; header lines, heading order, ratings and source numbers equal the html export\'s', async () => {
  const p = await go(W); await ready(p); const b = (await W.F('GET', '/den/brief?desk=aep_au')).body.brief; const ex = (await W.F('GET', '/den/brief?id=' + b.id + '&format=html&nodraft=1')).text;
  const un = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const dk = (await W.F('GET', '/den/desks')).body.desks.find(d => d.id === 'aep_au'); const vis = dk.sections.filter(s => s.kind !== 'sources' && (dk.options.hidden || []).indexOf(s.id) < 0).map(s => s.title);
  eq((await p.$$eval('.dt-doc .dt-sec:not(.dt-srcsec) h2', els => els.map(e => e.textContent))), vis, 'every visible section, the desk\'s order');
  eq(await p.$$eval('.dt-doc .dt-sec:not([data-empty]) h2', els => els.map(e => e.textContent)), Array.from(ex.matchAll(/<h2>([^<]*)<\/h2>/g)).map(m => un(m[1])), 'the heading order is the export\'s');
  const head = await p.evaluate(() => ['.dt-doct', '.dt-docc', '.dt-docl'].map(s => document.querySelector(s).textContent));
  eq(head, [un(/<h1>([^<]*)<\/h1>/.exec(ex)[1]), un(/<p class="client">([^<]*)<\/p>/.exec(ex)[1]), un(/<p class="sub">([^<]*)<\/p>/.exec(ex)[1])], 'the header lines are the export\'s');
  ok(/Momentum: Moderate, Stable/.test(await p.evaluate(() => document.querySelector('.dt-rate').textContent)) && /<strong>Momentum:<\/strong> Moderate, Stable/.test(ex), 'the rating in words, as the copy prints it');
  const exNums = {}; ex.split(/<h2>/).slice(1).forEach(part => { const t0 = un(part.slice(0, part.indexOf('</h2>'))); exNums[t0] = Array.from(part.matchAll(/<sup><a [^>]*>\[(\d+)\]<\/a><\/sup>/g)).map(m => m[1]); });
  const tNums = await p.$$eval('.dt-doc .dt-sec:not([data-empty]):not(.dt-srcsec)', els => els.map(e => [e.querySelector('h2').textContent, Array.from(e.querySelectorAll('sup.dt-src button')).map(x => x.textContent.replace(/[[\]]/g, ''))]));
  tNums.forEach(([title, nums]) => eq(nums, exNums[title] || [], 'source numbers in ' + title)); ok(tNums.some(x => x[1].length), 'some numbers were compared');
  const listN = await p.$$eval('.dt-srcl li', els => els.map(e => e.getAttribute('data-n'))); eq(listN, (b.sourceList || []).flatMap(g => g.items.map(i => String(i.n))), 'the Source List\'s numbers');
  eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T5 the fold */
await t('T5 the fold: the send buttons in view at 1366x650 and 1440x790 at the top, middle and end; two items in view with one open; the bar; 320 px; the intro cards', async () => {
  const inView = p => p.evaluate(sel => Array.from(document.querySelectorAll(sel)).filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth + 0.5; }).map(b => b.getAttribute('data-act')), '.dt-send [data-act="copy"], .dt-send [data-act="mark"], .dt-bar [data-act="copy"], .dt-bar [data-act="mark"]');
  for (const [wd, ht] of [[1366, 650], [1440, 790]]) { const p = await go(W, { width: wd, height: ht }); await ready(p);
    for (const where of ['top', 'middle', 'end']) { await p.evaluate(x => { const m = document.querySelector('.dt-main'); m.scrollTop = x === 'top' ? 0 : x === 'middle' ? (m.scrollHeight - m.clientHeight) / 2 : m.scrollHeight; }, where); await sleep(60); eq((await inView(p)).sort(), ['copy', 'mark'], wd + 'x' + ht + ' ' + where); }
    await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); await sleep(250);
    const n = await p.evaluate(() => { const reg = document.querySelector('#dt-col .den-checks-list'); const rr = reg.getBoundingClientRect(); return Array.from(reg.querySelectorAll(':scope > ol > li')).filter(li => { const r = li.getBoundingClientRect(); return r.top >= rr.top - 2 && r.top < Math.min(rr.bottom, innerHeight) - 16; }).length; });
    ok(n >= 2, wd + 'x' + ht + ': ' + n + ' items in view with one open'); eq((await inView(p)).sort(), ['copy', 'mark'], 'with one open'); eq(p.errors, []); await p.context().close(); }
  for (const [wd, ht] of [[1100, 768], [390, 844]]) { const p = await go(W, { width: wd, height: ht }); await ready(p); eq((await inView(p)).sort(), ['copy', 'mark'], wd + ': both in the bar');
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.dt-bar')).display !== 'none' && getComputedStyle(document.querySelector('#dt-col')).display === 'none'), 'the bottom bar, the column folded'); eq(p.errors, []); await p.context().close(); }
  { const p = await go(W, { width: 320, height: 640 }); await ready(p); const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth, document.querySelector('#den-app').scrollWidth, document.querySelector('.dt-main').scrollWidth - document.querySelector('.dt-main').clientWidth, document.querySelector('.dt-top').scrollWidth - document.querySelector('.dt-top').clientWidth]);
    ok(sw[0] <= sw[1] && sw[2] <= sw[1] && sw[3] <= 1 && sw[4] <= 1, 'no sideways scroll at 320 px: ' + JSON.stringify(sw)); eq(p.errors, []); await p.context().close(); }
  for (const [wd, ht] of [[1366, 768], [1366, 650]]) { const p = await go(W, { room: 'fresh', width: wd, height: ht }); await ready(p); await p.waitForSelector('.dt-card');
    for (let i = 1; i <= 3; i++) { const lap = await p.evaluate(() => { const c = document.querySelector('.dt-card').getBoundingClientRect(); return Array.from(document.querySelectorAll('.dt-send [data-act="copy"], .dt-send [data-act="mark"]')).some(b => { const r = b.getBoundingClientRect(); return !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom); }); });
      ok(!lap, 'intro card ' + i + ' covers no send button at ' + wd + 'x' + ht); eq((await inView(p)).sort(), ['copy', 'mark'], 'card ' + i + ': both in view'); if (i < 3) await p.locator('.dt-card button', { hasText: 'Next' }).click(); await sleep(80); }
    eq(p.errors, []); await p.context().close(); }
});

/* ---------------------------------------------------------------------------------------------- T6, T7 check, one count */
const W6 = await mkWorld(); const p6 = await go(W6); await ready(p6);
const oneCount = async p => { await sleep(120); const v = await p.evaluate(() => { const c = document.querySelector('#dt-col .den-checks-head .den-chip'); const s = (document.querySelector('.dt-mine [data-desk="aep_au"] .dt-rl') || {}).textContent || ''; const m = /(\d+) to check/.exec(s); const b = document.querySelector('.dt-bar .dt-barcount');
  return [c ? +c.getAttribute('data-count') : -1, m ? +m[1] : /nothing to check/.test(s) ? 0 : -2, b ? +b.getAttribute('data-count') : -3]; }); ok(v[0] === v[1] && v[1] === v[2] && v[0] >= 0, 'one count: heading, switcher, bar ' + JSON.stringify(v)); return v[0]; };
await t('T6 check: Go to the first, each kind\'s fix through its route, the next item opens with the focus; Skip for now; Undo; a failing fix said and put back', async () => {
  const p = p6; const n0 = await chip(p); ok(n0 > 4, 'things to check: ' + n0);
  await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); await sleep(200); let a = await act(p); ok(/\bgo\b/.test(a.cls) && a.fx === 'source', 'the first item\'s usual fix has the focus: ' + JSON.stringify(a));
  ok(/^1 of \d+: A sentence that lost its source/.test(await live(p)), 'said: ' + await live(p)); ok(await p.evaluate(() => !!document.querySelector('mark.dt-mark.den-fl-on, mark.dt-mark.lit')), 'its sentence is outlined in the report');
  // dropped: Choose a source opens the drawer; Use here saves; the next item opens
  let s0 = p.served.length; await p.keyboard.press('Enter'); await p.waitForSelector('.dt-drawer'); await focusIs(p, () => document.activeElement && document.activeElement.id === 'dt-drawer-h', 'the drawer\'s heading has the focus');
  await p.locator('.dt-drawer .den-evcard:not([disabled])').first().click(); await until(p, n => +((document.querySelector('#dt-col .den-checks-head .den-chip') || {}).getAttribute ? document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') : 99) < n, 'the count dropped', n0);
  ok(p.served.slice(s0).some(x => /^POST \/den\/brief\/save/.test(x)), 'through the save'); await until(p, () => !document.querySelector('.dt-drawer'), 'the drawer closed once the save answered (P9: it stays open until then)'); await sleep(250); a = await act(p); ok(/\bgo\b/.test(a.cls) && a.item, 'the next item opened with its usual fix focused: ' + JSON.stringify(a)); await oneCount(p);
  // empty: Write it myself opens the editor on the section; Esc saves; the next opens
  let it = await p.evaluate(() => document.querySelector('.den-fl.open').getAttribute('data-fl-item')); ok(/^empty:/.test(it), 'an empty section next: ' + it); const n1 = await chip(p); s0 = p.served.length;
  await p.keyboard.press('Enter'); await p.waitForSelector('.dt-ta'); a = await act(p); eq(a.tag, 'TEXTAREA'); await p.keyboard.type('Harbour Watch framed the levy as a fair share for coastal towns.'); await p.keyboard.press('Escape');
  await until(p, n => +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') < n, 'the empty section cleared', n1); ok(p.served.slice(s0).some(x => /^POST \/den\/brief\/save/.test(x)), 'through the save'); await sleep(250); a = await act(p); ok(/\bgo\b/.test(a.cls), 'the next has the focus: ' + JSON.stringify(a)); await oneCount(p);
  // Skip for now moves on and keeps the count
  const n2 = await chip(p); const was = await p.evaluate(() => document.querySelector('.den-fl.open').getAttribute('data-fl-item')); await p.locator('.den-fl.open .den-fl-skip').click(); await sleep(250);
  ok(await p.evaluate(w0 => { const o = document.querySelector('.den-fl.open'); return !!o && o.getAttribute('data-fl-item') !== w0; }, was), 'the next is open'); eq(await chip(p), n2, 'skipped stays counted');
  // an alert: Leave it out, a reason, through the review route; Undo puts it back
  const chk = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); }); ok(chk, 'an alert to check');
  await p.locator('.den-fl[data-fl-item="' + chk + '"] .den-fl-t').click(); await p.waitForSelector('.den-fl[data-fl-item="' + chk + '"].open'); ok(await p.evaluate(() => !!document.querySelector('.dt-slot')), 'the slot at the section\'s end');
  s0 = p.served.length; await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Too small to report' }).click();
  await until(p, n => +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') < n, 'left out', n2); ok(p.served.slice(s0).some(x => /^POST \/den\/brief\/review/.test(x)), 'through the review route'); const n3 = await oneCount(p);
  await p.locator('.den-checks-done .den-undo-fl').click(); await until(p, n => +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') === n + 1, 'Undo put it back', n3); await oneCount(p);
  // a word readers won't know: Edit the sentence selects the word; the save clears it
  const dw = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="denwords"]'); return x && x.getAttribute('data-fl-item'); }); ok(dw, 'a word to check');
  await p.locator('.den-fl[data-fl-item="' + dw + '"] .den-fl-t').click(); await focusIs(p, () => document.activeElement && document.activeElement.matches('.den-fl.open .den-fx.go'), 'its fix focused'); await p.keyboard.press('Enter'); await p.waitForSelector('.dt-ta'); await sleep(100);
  eq((await p.evaluate(() => { const ta = document.activeElement; return ta.value.slice(ta.selectionStart, ta.selectionEnd); })).toLowerCase(), 'the client', 'the word is selected'); const n4 = await chip(p);
  await p.keyboard.type('AEP'); await p.keyboard.press('Escape'); await until(p, n => +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') < n, 'the word cleared', n4); await oneCount(p);
  // a failing fix: shown under its item, said in the room's one alert region (U7: the item draws no alert of its own), and nothing changed
  W6.hooks = [async (route, r, path) => { if (r.method() === 'POST' && /^\/den\/brief\/review/.test(path)) { await json(route, 500, { error: 'busy', detail: 'The invented review store is busy.' }); return true; } return false; }];
  const n5 = await chip(p); const c2 = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
  await p.locator('.den-fl[data-fl-item="' + c2 + '"] .den-fl-t').click(); await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Not relevant to this report' }).click();
  await p.waitForSelector('.den-fl-err'); ok(/didn't go through/.test(await p.evaluate(() => document.querySelector('.den-fl-err').textContent)), 'shown'); eq(await p.locator('.den-fl-err[role]').count(), 0, 'no live region of its own');
  await until(p, () => /didn't go through/.test(document.querySelector('[data-dt-live="alert"]').textContent), 'said in the alert region'); eq(await chip(p), n5, 'put back: the count is as it was'); W6.hooks = [];
  eq(p.errors, []);
});
await t('T7 one count: the switcher entry, the column\'s heading and the bar agree after every fix (DenFlags.count)', async () => {
  const p = p6; const c0 = await oneCount(p); const k = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
  if (!(await p.locator('.den-fl.open[data-fl-item="' + k + '"]').count())) await p.locator('.den-fl[data-fl-item="' + k + '"] .den-fl-t').click(); await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Already covered in other words' }).click();
  await until(p, n => +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count') < n, 'one fewer', c0); const c1 = await oneCount(p); eq(c1, c0 - 1);
  // the count the room draws is the one DenFlags.count gives the list (the open items of the panel)
  eq(await p.evaluate(() => document.querySelectorAll('#dt-col .den-fl[data-fl-item]').length + Array.from(document.querySelectorAll('#dt-col .den-fl-group:not(:has(.den-fl-sub))')).reduce((n, g) => n + (+g.getAttribute('data-n') || 0), 0)), c1, 'the open items listed');
  eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T8 copy */
await t('T8 copy: no DRAFT in the html or the text; unsaved words saved first; the desk named; the copy guard (Copy again, Mark as sent anyway)', async () => {
  const w = await mkWorld(); await clearAll(w, 'aep_au'); const p = await go(w); await ready(p); eq(await chip(p), 0, 'nothing to check');
  ok(await p.evaluate(() => document.querySelector('.dt-send [data-act="copy"]').classList.contains('primary')), 'Copy is the primary when nothing is open');
  // unsaved words first: the editor open on the bottom line, words typed, Copy pressed
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' Invented closing words.');
  const s0 = p.served.length; await p.locator('.dt-send [data-act="copy"]').click(); await p.waitForSelector('.dt-copied');
  const seq = p.served.slice(s0); const iSave = seq.findIndex(x => /^POST \/den\/brief\/save/.test(x)), iGet = seq.findIndex(x => /format=html/.test(x)); ok(iSave >= 0 && iGet > iSave, 'saved, then read: ' + JSON.stringify(seq)); ok(/nodraft=1/.test(seq[iGet]), 'asked without DRAFT');
  const clip = await p.evaluate(async () => { const it = await navigator.clipboard.read(); const one = it[0]; return { html: await (await one.getType('text/html')).text(), text: await (await one.getType('text/plain')).text() }; });
  ok(!/class="draft"/.test(clip.html) && /<h2>Executive Summary<\/h2>/.test(clip.html) && /Invented closing words\./.test(clip.html), 'the html: no DRAFT, the headings, the saved words'); ok(!/^DRAFT$/m.test(clip.text) && /Executive Summary/.test(clip.text), 'the text: no DRAFT line');
  ok(/^Copied at \d\d:\d\d\. Paste it into today's tab of the AEP national report\.$/.test(await p.evaluate(() => document.querySelector('.dt-copied').textContent)), 'the desk named'); await focusIs(p, () => document.activeElement && document.activeElement.getAttribute('data-act') === 'mark', 'the focus on Mark as sent'); ok(/Copied\./.test(await live(p)), 'said');
  ok(await p.evaluate(() => document.querySelector('.dt-send [data-act="mark"]').classList.contains('primary')), 'Mark as sent is the primary once copied');
  // the copy guard: an edit after copying
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' One more.'); await p.keyboard.press('Escape'); await p.waitForSelector('.dt-copied.w');
  eq(await p.evaluate(() => [document.querySelector('.dt-send [data-act="copy"]').textContent, document.querySelector('.dt-send [data-act="copy"]').classList.contains('primary'), document.querySelector('.dt-send [data-act="mark"]').textContent, document.querySelector('.dt-send [data-act="mark"]').classList.contains('primary')]), ['Copy again', true, 'Mark as sent anyway', false]);
  ok(/You changed the report after copying\./.test(await p.evaluate(() => document.querySelector('.dt-copied.w').textContent)));
  eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T9 mark as sent */
await t('T9 mark as sent: an unseen alert joins the box; D2 (left alerts acknowledged without a second ask); Next; things open (the box, Send anyway); all sent', async () => {
  const w = await mkWorld(); await clearAll(w, 'aep_au'); const files = []; let late = true;
  w.hooks = [async (route, r, path) => { if (r.method() !== 'POST' || !/^\/den\/brief\/file/.test(path)) return false; const b = JSON.parse(r.postData() || '{}'); files.push(b);
    if (late && !b.reopen) { late = false; await json(route, 409, { ok: false, error: 'uncited_signals', detail: 'invented', signals: [{ sig: 'spike', key: 'A:late1', title: 'An invented late spike on harbour fees', detail: '' }], left: [] }); return true; } return false; }];
  const p = await go(w); await ready(p); eq(await chip(p), 0);
  await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); ok(/An invented late spike on harbour fees/.test(await p.evaluate(() => document.querySelector('.dt-box').textContent)), 'the unseen alert, by its title, in the box');
  await focusIs(p, () => document.activeElement && document.activeElement.getAttribute('data-act') === 'first', 'Go to the first has the focus'); let a; ok(await p.evaluate(() => document.activeElement.getAttribute('aria-describedby') === 'dt-box-t'), 'described by the box');
  await p.keyboard.press('Escape'); await until(p, () => !document.querySelector('.dt-box'), 'the box closed'); await focusIs(p, () => document.activeElement && document.activeElement.getAttribute('data-act') === 'mark', 'Esc: the focus back on Mark as sent (' + JSON.stringify(await act(p)) + ')');
  // nothing open now: one press; the worker's 409 names only the alerts she left out, and the page acknowledges them ('left')
  files.length = 0; await p.locator('.dt-send [data-act="mark"]').click(); await until(p, () => document.querySelector('.dt-room').dataset.state === 'sent', 'sent');
  eq(files.map(f => f.acknowledge), [false, 'left'], 'one press: the 409, then acknowledge left (D2)'); eq(await p.locator('.dt-box').count(), 0, 'no second ask');
  await focusIs(p, () => document.activeElement && document.activeElement.getAttribute('data-act') === 'next', 'Next has the focus'); a = await act(p); eq(a.text, 'Next: AEP Victoria'); ok(/Sent at \d\d:\d\d\./.test(await live(p)), 'said'); ok(/Sent \d\d:\d\d/.test(await p.evaluate(() => document.querySelector('.dt-mine [data-desk="aep_au"] .dt-rl').textContent)), 'the switcher says sent');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_sends'))), 1, 'the send counted'); eq(await p.locator('.dt-secbtn').count(), 0, 'read-only once sent: no section menus');
  // Next: Victoria, with things to check: the box, then Send anyway files with acknowledge
  await p.keyboard.press('Enter'); await until(p, () => /^AEP Victoria report/.test((document.querySelector('.dt-status h1') || {}).textContent || ''), 'Victoria opened'); await ready(p); await sleep(200); eq((await act(p)).tag, 'H1', 'switching report: the focus at the h1');
  ok(await chip(p) > 0, 'Victoria has things to check'); const kinds = await p.evaluate(() => { const n = +document.querySelector('#dt-col .den-checks-head .den-chip').getAttribute('data-count'); const a = document.querySelectorAll('#dt-col .den-fl[data-kind="check"]').length + Array.from(document.querySelectorAll('#dt-col .den-fl-group[data-group="check"]:not(:has(.den-fl-sub))')).reduce((x, g) => x + (+g.getAttribute('data-n') || 0), 0); return { n, a }; });
  await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); const boxT = await p.evaluate(() => document.querySelector('.dt-box').textContent);
  // U10: Send anyway records the alerts only, and the box says so
  ok(kinds.a === kinds.n ? /still to check\. Sending anyway notes that you saw them and left them out\./.test(boxT) : kinds.a ? new RegExp('still to check\\. Sending anyway notes the ' + kinds.a + ' alerts? you saw and left out\\. The other ' + (kinds.n - kinds.a) + ' (is|are) not recorded\\.').test(boxT) : /Sending anyway doesn't record them\./.test(boxT), 'the box says what is recorded: ' + JSON.stringify(kinds) + ' ' + boxT);
  files.length = 0; await p.locator('.dt-box [data-act="anyway"]').click(); await until(p, () => document.querySelector('.dt-room').dataset.state === 'sent', 'Victoria sent'); eq(files.map(f => f.acknowledge), [true], 'Send anyway: acknowledge');
  await p.waitForSelector('.dt-allsent'); await sleep(250); eq((await act(p)).text, 'All your reports are sent for today.', 'all sent: the message has the focus'); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T10 states */
const openDesk = async (w, desk, o) => { const p = await go(w, o); await p.evaluate(d => { localStorage.setItem('ax_den_desk', JSON.stringify(d)); localStorage.setItem('ax_den_mine', JSON.stringify({ [d]: Date.now() })); }, desk); await reload(p); await p.waitForSelector('.dt-status h1'); return p; };
await t('T10 every state by hook: its words, and no Den word in the room', async () => {
  const w = await world(); const bad = []; const check = async (p, name, re) => { await until(p, r => new RegExp(r).test(((document.querySelector('.dt-status') || {}).innerText || '').replace(/\s+/g, ' ')), name, re.source); const dw = await denWords(p); if (dw.length) bad.push(name + ': ' + dw.join(', ')); if (p.errors.length) bad.push(name + ' errors: ' + p.errors.join('; ')); };
  const day = sydDayOf(Date.now());
  let p;
  // 1 loading: the report's read hangs
  w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/brief\?/.test(path)) { await sleep(4000); return false; } return false; }];
  p = await go(w); ok(await p.locator('.dt-skeleton').count() === 1, 'a skeleton while loading'); eq(await denWords(p), []); await p.context().close(); w.hooks = [];
  // 4 not written, not set to write each morning
  p = await openDesk(w, 'aep_au'); await check(p, 'not written (not set)', /Not written yet\. This report isn't set to be written each morning yet; the Den's owner can switch that on\./); await p.context().close();
  // 2 or 3 the morning draft is on
  const dk = (await w.F('GET', '/den/desks')).body.desks.find(d => d.id === 'aep_au'); eq((await w.F('POST', '/den/desk/update', { id: 'aep_au', revision: dk.revision, patch: { auto_draft: true } })).status, 200, 'the morning draft on');
  p = await openDesk(w, 'aep_au'); await check(p, 'not written (morning)', /Not written yet\. (It is written at 7:00 each morning\.|The morning run hasn't written it today\.)/); await p.context().close();
  // 5 drafts used up
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.budget = { used: 20, cap: 20, left: 0 }; })]; p = await openDesk(w, 'aep_au'); await check(p, 'drafts used', /Today's 20 AI drafts are used; they come back at midnight \(Sydney\)\. You can still write it yourself\./); eq(await p.locator('.dt-status [data-act="write"]').count(), 0); await p.context().close();
  // 6 the board read has not answered: Write it now waits
  w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/board\?/.test(path)) { await sleep(6000); return false; } return false; }];
  p = await openDesk(w, 'aep_au'); await check(p, 'looking', /Looking at today's stories and posts/); ok(await p.locator('.dt-status [data-act="write"]').isDisabled(), 'Write it now waits'); await p.context().close();
  // 7 nothing collected
  p = await openDesk(w, 'mca_au'); await check(p, 'nothing collected', /Nothing was collected for this report in the reporting period, so there is nothing to write it from\./);
  eq(await p.locator('.dt-status [data-act="write"]').count(), 0, 'Write it now is not offered'); ok(/Nothing collected/.test(await p.evaluate(() => document.querySelector('.dt-mine [data-desk="mca_au"]').textContent)), 'the switcher'); await p.context().close(); w.hooks = [];
  // 9 being written elsewhere
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.desks.forEach(x => { if (x.id === 'mca_au') { x.drafting = { since: Date.now() - 60000, by: 'morning draft' }; } }); })]; p = await openDesk(w, 'mca_au'); await check(p, 'being written elsewhere', /Being written now \(started at \d\d:\d\d by morning draft\)/); await p.context().close(); w.hooks = [];
  // 10 the connection dropped while it was being written
  w.hooks = [async (route, r, path) => { if (r.method() === 'POST' && /^\/den\/brief$/.test(path.split('?')[0])) { await route.abort('connectionreset'); return true; } return false; }];
  p = await openDesk(w, 'aep_au'); await ready(p); await p.locator('.dt-status [data-act="write"]').click(); await check(p, 'dropped', /The connection dropped while it was being written\. It may still finish\./); await sleep(150); eq((await act(p)).act, 'check-again', 'the focus on Check again');
  ok(/Write it now comes back in 3 minutes/.test(await lineTxt(p))); await p.context().close();
  // 11 couldn't be written
  w.hooks = [async (route, r, path) => { if (r.method() === 'POST' && /^\/den\/brief$/.test(path.split('?')[0])) { await json(route, 502, { ok: false, error: 'model_failed', detail: 'The invented AI draft could not be read' }); return true; } return false; }];
  p = await openDesk(w, 'aep_au'); await ready(p); await p.locator('.dt-status [data-act="write"]').click(); await check(p, 'failed', /Couldn't be written: The invented AI draft could not be read\. Nothing was used, and nothing that was already here changed\./); await sleep(150); eq((await act(p)).act, 'try-again', 'the focus on Try again');
  ok(/Couldn't be written/.test(await p.evaluate(() => document.querySelector('[data-dt-live="alert"]').textContent)), 'the reason in the alert region'); ok(/Couldn't be written/.test(await p.evaluate(() => document.querySelector('.dt-mine [data-desk="aep_au"]').textContent)), 'the switcher'); await p.context().close(); w.hooks = [];
  // 8 being written by her press (the stub model slowed): said, the seconds hidden, then written
  w.slow = 2500; p = await openDesk(w, 'aep_au'); await ready(p); await p.locator('.dt-status [data-act="write"]').click(); await check(p, 'writing', /Being written, started at \d\d:\d\d/); ok(await p.evaluate(() => document.querySelector('.dt-elapsed').getAttribute('aria-hidden') === 'true'), 'the seconds are hidden from screen readers');
  await until(p, () => document.querySelector('[data-dt-live="polite"]').textContent === 'Being written.', 'said: Being written.'); await until(p, () => document.querySelector('.dt-room').dataset.state === 'written', 'written'); await until(p, () => /^Written at \d\d:\d\d from \d+ stories and posts\.$/.test(document.querySelector('[data-dt-live="polite"]').textContent), 'said: Written at ...'); await p.context().close(); w.slow = 0;
  // 13: written, things to check
  p = await go(w); await ready(p); await check(p, 'written', /Written at \d\d:\d\d by Anne from \d+ stories and posts\. Not sent yet\./); await p.context().close();
  // 20 the report couldn't be loaded
  w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/brief\?/.test(path)) { await json(route, 500, { ok: false, error: 'fixture', detail: 'The invented store is down.' }); return true; } return false; }];
  p = await go(w); await check(p, 'load failed', /The report couldn't be loaded: The invented store is down\./); await p.context().close(); w.hooks = [];
  // 23 unsaved words came back
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; p = await go(w); await p.evaluate(o => localStorage.setItem('ax_den_work_' + o.id, JSON.stringify({ revision: o.rev, sections: { bottom: 'Words kept on this computer.' }, at: Date.now() - 600000 })), { id: b.id, rev: b.revision }); await reload(p);
  await check(p, 'restored', /Your unsaved words from (just now|\d+ min ago) were kept on this computer and are back in the report\./); ok(/Words kept on this computer\./.test(await p.evaluate(() => document.querySelector('.dt-sec[data-section="bottom"]').textContent))); await p.evaluate(o => localStorage.removeItem('ax_den_work_' + o), b.id); await p.context().close();
  // 35 a worker older than p72: no review and flags
  w.hooks = [reshape(w, /^\/den\/brief\?/, d => { if (d.brief) { delete d.brief.review; delete d.brief.review_rev; delete d.brief.flags; delete d.brief.covers; } })];
  p = await go(w); await ready(p); await check(p, 'p71 view', /Written at/); ok(/Some checks need the Den's next update\./.test(await p.evaluate(() => document.querySelector('#dt-col').textContent)), 'said at the foot'); ok(await chip(p) > 0, 'p71\'s own items listed'); await p.context().close(); w.hooks = [];
  // 36 a worker without the day's fields: names only
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.desks.forEach(x => { delete x.today; delete x.head; delete x.drafting; delete x.morning; }); })]; p = await go(w); await ready(p); await check(p, 'no today fields', /Written at/); eq(await p.locator('.dt-mine .dt-rl').count(), 0, 'the switcher: names only'); await p.context().close(); w.hooks = [];
  // 34 a weekly report on a day it isn't due: the last one sent, or none yet (U13)
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.desks.forEach(x => { if (x.id === 'mca_au') { x.cadence = 'weekly'; x.morning = { on: false, due: false, state: null }; } }); })]; p = await openDesk(w, 'mca_au'); await check(p, 'weekly', /This is a weekly report, and today isn't its day\. None has been sent yet\./); await p.context().close(); w.hooks = [];
  // 19 the alerts couldn't be read: the reason and Try again (U13)
  w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/board\?/.test(path)) { await json(route, 500, { ok: false, error: 'fixture', detail: 'The invented board is down.' }); return true; } return false; }];
  p = await go(w); await until(p, () => /Alerts couldn't be checked: The invented board is down\. Try again\. You can still send: they are checked again when you mark it sent\./.test(((document.querySelector('#dt-col .den-checks-alerts') || {}).textContent || '')), 'alerts not read: the reason and Try again');
  w.hooks = []; await p.locator('#dt-col [data-act="alerts-again"]').click(); await ready(p); ok(await p.locator('#dt-col .den-fl[data-kind="check"]').count() > 0, 'Try again: the alerts are listed'); await p.context().close();
  // 37 no report set up
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.desks = []; })]; p = await open(w, 'full-key', { room: 'today', width: 1366, height: 768, view: 'den' }); await until(p, () => /No report is set up yet\. Ask the Den's owner to add one\./.test(document.querySelector('#den-shell') ? document.querySelector('#den-shell').textContent : ''), 'no report set up'); await p.context().close(); w.hooks = [];
  eq(bad, []);
});

/* ---------------------------------------------------------------------------------------------- T11 view only, another day */
await t('T11 a view-only key (items without fixes, Next, Copy, no Mark as sent, no section menus); another day: sent, with a report, with none', async () => {
  const w = await mkWorld(); let p = await go(w, { key: 'read-key' }); await ready(p);
  ok(/View only: you can read and copy this report\./.test(await lineTxt(p))); eq(await p.locator('.den-fl-first').textContent(), 'Next'); eq(await p.locator('#dt-col .den-fx').count(), 0, 'no fixes'); eq(await p.locator('.dt-secbtn').count(), 0, 'no section menus');
  eq(await p.locator('.dt-send [data-act="mark"]').count(), 0, 'no Mark as sent'); eq(await p.locator('.dt-send [data-act="copy"]').count(), 1, 'Copy'); ok(/Marking it sent needs an edit key\./.test(await p.evaluate(() => document.querySelector('.dt-send').textContent)));
  await p.locator('.den-fl-first').click(); await p.waitForSelector('.den-fl.open'); ok(await p.evaluate(() => !!document.querySelector('.den-fl.open .why, .den-fl.open .den-fl-whyb')), 'the why line, no fixes'); eq(await denWords(p), []); eq(p.errors, []); await p.context().close();
  // another day with no report
  const yday = sydDayOf(Date.now() - 86400000); p = await go(w); await ready(p); await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: 'Open another day' }).click(); await p.fill('#dt-list-day input[type="date"]', yday);
  await until(p, d => ((document.querySelector('.dt-line') || {}).textContent || '') === 'No report was written for ' + d + '. A report is written for today only.', 'yesterday, no report', dayLong(yday));
  await p.locator('.dt-status [data-act="today"]').click(); await until(p, () => document.querySelector('.dt-room').dataset.state === 'written', 'back to today'); eq(p.errors, []); await p.context().close();
  // another day with a report, then sent: a hand-written MCA report moved to yesterday
  const s0 = (await w.F('POST', '/den/brief/save', { desk: 'mca_au' })).body.brief; const s1 = (await w.F('POST', '/den/brief/save', { id: s0.id, revision: s0.revision, sections: { summary: 'An invented quiet day for the mining report, with two short regional stories on a quarry approval and nothing on the client. Nothing in it needs the client to act, and no new voice appeared in the reporting period at all.', media: 'Two regional outlets reported the quarry approval and a council meeting about trucks on the coast road, with quotes from residents and none from the industry.', bottom: 'A quiet day with nothing that needs an answer.' } })).body.brief;
  w.env.MIND_DB.db.prepare('UPDATE den_briefs SET day=? WHERE id=?').run(yday, s1.id);
  p = await openDesk(w, 'mca_au'); await ready(p); await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: 'Open another day' }).click(); await p.fill('#dt-list-day input[type="date"]', yday);
  await until(p, () => /^Not today\. Written at \d\d:\d\d/.test((document.querySelector('.dt-line') || {}).textContent || ''), 'not today, written'); ok(await p.locator('.dt-status [data-act="today"]').count() === 1, 'Back to today'); ok(await p.locator('.dt-secbtn').count() > 0, 'an unsent report of another day can still be changed');
  await p.context().close(); const s2 = (await w.F('GET', '/den/brief?desk=mca_au&day=' + yday)).body.brief; eq((await w.F('POST', '/den/brief/file', { id: s2.id, revision: s2.revision, acknowledge: true })).status, 200);
  p = await openDesk(w, 'mca_au'); await ready(p); await p.click('#dt-btn-more'); await p.locator('#dt-list-more .dt-mi', { hasText: 'Open another day' }).click(); await p.fill('#dt-list-day input[type="date"]', yday);
  await until(p, () => /^Not today\. .*Sent at \d\d:\d\d by Anne\./.test((document.querySelector('.dt-line') || {}).textContent || ''), 'not today, sent'); eq(await denWords(p), []); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T12 help */
await t('T12 help: the introduction once and never again by itself; nothing written while it shows; its words follow the state', async () => {
  const p = await go(W, { room: 'fresh' }); await ready(p); await p.waitForSelector('.dt-card'); const s0 = p.served.length; await sleep(150);
  eq(await p.getAttribute('.dt-card', 'aria-label'), 'Introduction, 1 of 3'); eq((await act(p)).cls, 'dt-card', 'the focus on the card'); ok(/It was written at \d\d:\d\d from \d+ stories and posts, in your sections and your order\./.test(await p.textContent('.dt-card')));
  ok(await p.evaluate(() => document.querySelector('#dt-report').classList.contains('dt-ring')), 'it rings the report'); await p.locator('.dt-card button', { hasText: 'Next' }).click(); await sleep(100);
  ok(/The Den found \d+ things to check/.test(await p.textContent('.dt-card')), 'card 2'); ok(/: a sentence that lost its source, sections with nothing written and /.test(await p.textContent('.dt-card')) && !/Nothing written under/.test(await p.textContent('.dt-card')), 'card 2 names the kinds mid-sentence, the empty sections as one (U12): ' + await p.textContent('.dt-card')); await p.locator('.dt-card button', { hasText: 'Next' }).click(); await sleep(100); ok(/Copy takes your header/.test(await p.textContent('.dt-card')), 'card 3');
  ok(await p.evaluate(() => document.querySelector('.dt-send [data-act="copy"]').classList.contains('dt-ring')), 'it rings Copy and Mark as sent'); await p.locator('.dt-card button', { hasText: 'Done' }).click(); await sleep(100);
  eq(p.served.slice(s0).filter(x => /^POST /.test(x)), [], 'no write while the introduction showed'); eq(await p.locator('.dt-card').count(), 0); ok(/That's the whole daily report\./.test(await lineTxt(p))); eq((await act(p)).tag, 'H1');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_intro'))), 'seen'); await reload(p); await ready(p); await sleep(300); eq(await p.locator('.dt-card').count(), 0, 'never again by itself');
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'Show me how' }).click(); await p.waitForSelector('.dt-card'); await p.locator('.dt-card button', { hasText: 'Close' }).click(); eq(await p.locator('.dt-card').count(), 0);
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'What the checks mean' }).click(); await p.waitForSelector('.dt-sheet'); eq((await act(p)).id, 'dt-sheet-h'); await p.keyboard.press('Escape'); await sleep(80); eq((await act(p)).id, 'dt-btn-help');
  // an unwritten report: card 1 says so
  const q = await openDesk(W, 'mca_au', { room: 'fresh' }); await ready(q); await q.evaluate(() => localStorage.removeItem('ax_den_intro')); await q.click('#dt-btn-help'); await q.locator('#dt-list-help .dt-mi', { hasText: 'Show me how' }).click(); await q.waitForSelector('.dt-card');
  ok(/Nothing was collected for it today, so there is nothing to write it from\. You can write it yourself\./.test(await q.textContent('.dt-card')), await q.textContent('.dt-card')); eq(q.errors, []); await q.context().close();
  eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T13 keyboard and focus */
await t('T13 keyboard and focus: Alt+0, Alt+1 to 5, Esc in each layer with the focus back, the DOM order, the focus rules', async () => {
  const p = await go(W); await ready(p);
  for (const [k, id] of [['1', 'today'], ['2', 'brief'], ['3', 'watch'], ['4', 'collection'], ['5', 'options']]) { await p.keyboard.press('Alt+' + k); await tabOn(p, id); await p.keyboard.press('Alt+0'); await p.waitForSelector('.dt-room'); }
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report', 'visits all'); await ready(p);
  eq(await p.evaluate(() => { const top = document.querySelector('.dt-top'), m = document.querySelector('main.dt-main'), as = document.querySelector('aside.dt-col'); return !!(top.compareDocumentPosition(m) & 4) && !!(m.compareDocumentPosition(as) & 4); }), true, 'header, then main, then the column');
  await p.evaluate(() => { document.activeElement && document.activeElement.blur(); document.body.focus(); }); await p.keyboard.press('Tab'); let a = await act(p); eq(a.text, 'Skip to the report'); await p.keyboard.press('Tab'); eq((await act(p)).text, 'Skip to Check before you send');
  await p.keyboard.press('Enter'); eq((await act(p)).id, 'den-checks-h-today', 'the skip link lands on the column\'s heading');
  for (const m of ['more', 'help']) { await p.click('#dt-btn-' + m); await p.waitForSelector('#dt-list-' + m); await p.keyboard.press('Escape'); await sleep(60); eq((await act(p)).id, 'dt-btn-' + m, m + ': Esc gives the focus back'); eq(await p.locator('#dt-list-' + m).count(), 0); }
  await p.locator('sup.dt-src button').first().focus(); await p.keyboard.press('Enter'); await p.waitForSelector('.dt-drawer'); await sleep(80); eq((await act(p)).id, 'dt-drawer-h'); await p.keyboard.press('Escape'); await sleep(80); eq(await p.locator('.dt-drawer').count(), 0); ok(/^\[\d+\]$/.test((await act(p)).text), 'the drawer: the focus back on its source number');
  await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); await p.keyboard.press('Escape'); await sleep(80); eq((await act(p)).act, 'mark', 'the send box');
  await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); await sleep(150); await p.keyboard.press('Escape'); await sleep(80); ok(/den-fl-t/.test((await act(p)).cls), 'an open item: the focus on its button');
  await p.locator('#dt-secbtn-summary').click(); await p.locator('#dt-secl-summary .dt-mi', { hasText: 'Edit this section' }).click(); await p.waitForSelector('.dt-ta'); await p.keyboard.press('Escape'); await sleep(120); eq((await act(p)).id, 'dt-secbtn-summary', 'the editor: Esc saves, the focus on its section menu');
  await p.locator('#dt-secbtn-summary').click(); await p.keyboard.press('Escape'); await sleep(60); eq((await act(p)).id, 'dt-secbtn-summary', 'the section menu');
  await p.click('.dt-mine [data-desk="aep_vic"]'); await until(p, () => /^AEP Victoria report/.test(document.querySelector('.dt-status h1').textContent), 'Victoria'); await ready(p); await sleep(200); eq((await act(p)).tag, 'H1', 'switching report: the h1');
  await p.click('#den-tab-report').catch(() => {}); await p.keyboard.press('Alt+2'); await tabOn(p, 'brief'); await p.keyboard.press('Alt+0'); await p.waitForSelector('.dt-room'); eq(p.errors, []); await p.context().close();
  const q = await go(W, { room: '' }); await tabOn(q, 'today'); await q.keyboard.press('Alt+0'); await q.waitForSelector('.dt-room'); eq(await q.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report', 'Alt+0 from the workbench chooses Today'); eq(q.errors, []); await q.context().close();
});

/* ---------------------------------------------------------------------------------------------- T14 screen reader */
await t('T14 screen reader: one polite region and one alert region on Today in every state (the drawer, a note in it, a fix that failed, the send box, sent, the report not loaded: U7); no live region holds a ticking number', async () => {
  const regions = p => p.evaluate(() => { const r = document.querySelector('#den-app'); const all = Array.from(r.querySelectorAll('[role="status"], [aria-live], [role="alert"], [role="log"]')); return { polite: all.filter(e => e.getAttribute('role') !== 'alert' && e.getAttribute('aria-live') !== 'assertive').length, alert: all.filter(e => e.getAttribute('role') === 'alert' || e.getAttribute('aria-live') === 'assertive').length }; });
  const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' }); let p = await go(w); await ready(p); eq(await regions(p), { polite: 1, alert: 1 }, 'written'); await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); eq(await regions(p), { polite: 1, alert: 1 }, 'an item open'); await p.context().close();
  w.slow = 3000; p = await openDesk(w, 'aep_vic'); await ready(p); if (!(await p.locator('.dt-status [data-act="write"]').count())) { await p.context().close(); const w2 = await world(); w2.slow = 3000; p = await go(w2); await ready(p); } await p.locator('.dt-status [data-act="write"]').click(); await p.waitForSelector('.dt-elapsed'); eq(await regions(p), { polite: 1, alert: 1 }, 'being written');
  const sample = () => p.evaluate(() => Array.from(document.querySelectorAll('#den-app [role="status"], #den-app [aria-live], #den-app [role="alert"]')).map(e => e.textContent).join('|'));
  await sleep(400); const a1 = await sample(); await sleep(1300); const a2 = await sample(); eq(a1, a2, 'nothing live changed while the seconds ran'); ok(!/\d+:\d\d/.test(a1 + a2), 'no clock in a live region: ' + a1);
  ok(await p.evaluate(() => { const e = document.querySelector('.dt-elapsed'); return e.getAttribute('aria-hidden') === 'true' && !e.closest('[role="status"], [aria-live], [role="alert"]'); }), 'the seconds are hidden and outside every live region');
  await until(p, () => document.querySelector('.dt-room').dataset.state === 'written', 'written'); w.slow = 0; eq(p.errors, []); await p.context().close();
  // p72 review U7: the drawer's pane and the items drew live regions of their own; on Today they speak through the room's two regions
  { const w = await mkWorld(); let p = await go(w); await ready(p);
    await p.locator('#dt-secbtn-summary').click(); await p.locator('#dt-secl-summary .dt-mi', { hasText: 'Sources for this section' }).click(); await p.waitForSelector('.dt-drawer'); await sleep(200); eq(await regions(p), { polite: 1, alert: 1 }, 'the drawer');
    await p.locator('.dt-drawer [data-tour="add-source"]').click(); await p.fill('.dt-drawer .den-addta', 'https://harbourwatch.example.org/an-invented-statement'); await p.locator('.dt-drawer .den-addbox button.primary').click();
    await until(p, () => /Added 1 source/.test(document.querySelector('.dt-drawer').textContent) || /Added 1 source/.test(document.querySelector('[data-dt-live="polite"]').textContent), 'the source added'); await sleep(100);
    eq(await regions(p), { polite: 1, alert: 1 }, 'a note in the drawer'); ok(/Added 1 source/.test(await live(p)), 'said in the one polite region'); await p.keyboard.press('Escape'); await sleep(100);
    w.hooks = [async (route, r, path) => { if (r.method() === 'POST' && /^\/den\/brief\/review/.test(path)) { await json(route, 500, { error: 'busy', detail: 'The invented review store is busy.' }); return true; } return false; }];
    const c2 = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
    await p.locator('.den-fl[data-fl-item="' + c2 + '"] .den-fl-t').click(); await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Not relevant to this report' }).click();
    await p.waitForSelector('.den-fl-err'); await sleep(100); eq(await regions(p), { polite: 1, alert: 1 }, 'a fix that failed'); await until(p, () => /didn't go through/.test(document.querySelector('[data-dt-live="alert"]').textContent), 'the failure in the one alert region'); w.hooks = [];
    await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); eq(await regions(p), { polite: 1, alert: 1 }, 'the send box'); await p.locator('.dt-box [data-act="anyway"]').click(); await until(p, () => document.querySelector('.dt-room').dataset.state === 'sent', 'sent'); eq(await regions(p), { polite: 1, alert: 1 }, 'sent'); await p.context().close();
    w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/brief\?/.test(path)) { await json(route, 500, { ok: false, error: 'fixture', detail: 'The invented store is down.' }); return true; } return false; }];
    p = await go(w); await until(p, () => document.querySelector('.dt-room').dataset.state === 'loadfail', 'load failed'); eq(await regions(p), { polite: 1, alert: 1 }, 'the report not loaded'); w.hooks = []; eq(p.errors, []); await p.context().close();
  }
});

/* ---------------------------------------------------------------------------------------------- T15 axe */
await t('T15 axe: no serious or critical violation on Today at six sizes for a full and a view-only key, with the drawer, the send box, each intro card and the editor; and the workbench\'s tab row', async () => {
  const bad = []; const run = async (p, where) => { await sleep(300); if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
    const v = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' at ' + x.nodes.slice(0, 4).map(n => n.target.join(' ').slice(-70) + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ' [' + n.any[0].data.contrastRatio + ']' : '')).join(' | ')); });
    bad.push(...v.map(x => where + ': ' + x)); };
  for (const [wd, ht] of [[1366, 768], [1366, 650], [1440, 900], [1920, 1080], [1100, 768], [390, 844]]) for (const key of ['full-key', 'read-key']) { const p = await go(W, { width: wd, height: ht, key }); await ready(p); await run(p, wd + 'x' + ht + ' ' + key); await p.context().close(); }
  const p = await go(W); await ready(p); await p.locator('sup.dt-src button').first().click(); await p.waitForSelector('.dt-drawer'); await run(p, 'drawer'); await p.keyboard.press('Escape');
  await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); await run(p, 'send box'); await p.keyboard.press('Escape');
  await p.locator('#dt-secbtn-summary').click(); await p.locator('#dt-secl-summary .dt-mi', { hasText: 'Edit this section' }).click(); await p.waitForSelector('.dt-ta'); await run(p, 'editor'); await p.keyboard.press('Escape');
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'Show me how' }).click(); for (let i = 1; i <= 3; i++) { await p.waitForSelector('.dt-card'); await run(p, 'intro card ' + i); if (i < 3) await p.locator('.dt-card button', { hasText: 'Next' }).click(); }
  await p.locator('.dt-card button', { hasText: 'Done' }).click(); await p.click('#dt-btn-more'); await run(p, 'More tools'); await p.keyboard.press('Escape');
  await more(p, 'Sections and sources'); await tabOn(p, 'brief'); await run(p, 'the workbench, with the Today\'s report tab'); eq(p.errors, []); await p.context().close();
  eq(bad, []);
});

/* ---------------------------------------------------------------------------------------------- T16 one state */
await t('T16 one state: an edit on Today shows on Sections and sources and the reverse; switching rooms mid-edit keeps the words; a conflict shows Keep mine / Use theirs on Today', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p);
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' Kept across the rooms.'); await p.keyboard.press('Escape');
  await until(p, () => /All changes saved/.test(document.querySelector('.dt-send').textContent), 'saved');
  await more(p, 'Sections and sources'); await tabOn(p, 'brief'); const s = await sec(p, 'bottom'); ok(/Kept across the rooms\.$/.test(await s.locator('textarea').inputValue()), 'Today\'s edit in the workbench');
  await s.locator('textarea').fill((await s.locator('textarea').inputValue()) + ' Typed in the workbench.'); await p.keyboard.press('Alt+0'); await p.waitForSelector('.dt-room');
  await until(p, () => /Typed in the workbench\./.test(document.querySelector('.dt-sec[data-section="bottom"]').textContent), 'the workbench\'s words on Today');
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; const other = await w.call('POST', '/den/brief/save', { id: b.id, revision: b.revision, sections: { posture: 'Kai wrote a different posture line for the invented harbour report.' } }, 'other-key'); eq(other.status, 200, 'a second writer saved');
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' And more.'); await p.keyboard.press('Escape');
  await until(p, () => /changed this report after you opened it\. Your words are still here\./.test(document.querySelector('.dt-status').textContent), 'the conflict on Today');
  ok(await p.locator('.dt-status [data-act="keep-mine"]').count() === 1 && await p.getByRole('button', { name: 'Use theirs' }).count() === 1, 'Keep mine and Use theirs'); ok(/Settle the change first/.test(await p.textContent('.dt-send')), 'Copy and Mark as sent wait');
  ok(/Kai changed this report/.test(await lineTxt(p)), 'named'); eq(p.errors, []); await p.context().close();
});

/* ---------------------------------------------------------------------------------------------- T17 to T29: the p72 review's page findings */
await t('T17 (U1) under 1200 px the send block\'s words are seen and take the focus: the box, the copy line, Next, the all-sent line (1100x768, 390x844)', async () => {
  for (const [wd, ht] of [[1100, 768], [390, 844]]) {
    const w = await mkWorld(); const p = await go(w, { width: wd, height: ht }); await ready(p);
    await p.locator('.dt-bar [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); ok(await seen(p, '.dt-box'), wd + ': the box is seen');
    ok(/still to check/.test(await p.evaluate(() => document.querySelector('.dt-box').textContent)), wd + ': its words');
    await focusSeen(p, '[data-act="first"]', wd + ': Go to the first, seen, has the focus');
    await p.keyboard.press('Escape'); await focusSeen(p, '[data-act="mark"]', wd + ': Esc: the Mark as sent that is seen');
    await p.locator('.dt-bar [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); await p.locator('.dt-box [data-act="first"]').click();
    await focusSeen(p, '.den-fl.open .den-fx.go', wd + ': the box\'s Go to the first: the first item\'s fix, seen, has the focus');
    await p.locator('.dt-bar [data-act="copy"]').click(); await p.waitForSelector('.dt-copied'); ok(await seen(p, '.dt-copied'), wd + ': the copy line is seen');
    ok(/^Copied at \d\d:\d\d\. Paste it into today's tab of the AEP national report\.$/.test(await p.evaluate(() => document.querySelector('.dt-copied').textContent)), 'the copy line\'s words');
    await focusSeen(p, '[data-act="mark"]', wd + ': after Copy, the Mark as sent that is seen'); eq(p.errors, []); await p.context().close();
    const w2 = await mkWorld(); await clearAll(w2, 'aep_au'); const q = await go(w2, { width: wd, height: ht }); await ready(q);
    await q.locator('.dt-bar [data-act="mark"]').click(); await until(q, () => document.querySelector('.dt-room').dataset.state === 'sent', 'sent');
    await focusSeen(q, '[data-act="next"]', wd + ': Next, seen, has the focus');
    await q.keyboard.press('Enter'); await until(q, () => /^AEP Victoria report/.test((document.querySelector('.dt-status h1') || {}).textContent || ''), 'Victoria'); await ready(q);
    await q.locator('.dt-bar [data-act="mark"]').click(); await q.waitForSelector('.dt-box'); await q.locator('.dt-box [data-act="anyway"]').click(); await until(q, () => document.querySelector('.dt-room').dataset.state === 'sent', 'Victoria sent');
    await q.waitForSelector('.dt-allsent'); ok(await seen(q, '.dt-allsent'), wd + ': the all-sent line is seen'); await focusSeen(q, '.dt-allsent', wd + ': the all-sent line has the focus'); eq(q.errors, []); await q.context().close();
  }
});

await t('T18 (U3) the introduction under 1200 px: each card is seen and takes the focus; card 3 rings the bar\'s Copy and Mark as sent (1100x768, 390x844)', async () => {
  const w = await mkWorld();
  for (const [wd, ht] of [[1100, 768], [390, 844]]) { const p = await go(w, { room: 'fresh', width: wd, height: ht }); await ready(p); await p.waitForSelector('.dt-card');
    for (let i = 1; i <= 3; i++) { await focusSeen(p, '.dt-card[aria-label="Introduction, ' + i + ' of 3"]', wd + ': card ' + i + ' seen with the focus');
      if (i === 3) ok(await p.evaluate(() => ['copy', 'mark'].every(k => { const b = document.querySelector('.dt-bar [data-act="' + k + '"]'); return b && b.classList.contains('dt-ring'); })), wd + ': card 3 rings the bar\'s buttons');
      await p.locator('.dt-card button', { hasText: i < 3 ? 'Next' : 'Done' }).click(); }
    await focusIs(p, () => document.activeElement && document.activeElement.tagName === 'H1', wd + ': Done: the h1'); eq(p.errors, []); await p.context().close(); }
});

await t('T19 (U9) after the last fix the focus moves once, to the Copy that is seen (1366x768, 1100x768)', async () => {
  for (const [wd, ht] of [[1366, 768], [1100, 768]]) {
    const w = await mkWorld(); const b = await clearAll(w, 'aep_au'); const sig = ((await w.F('GET', '/den/missed?desk=aep_au')).body.signals || []).find(s => s.sig !== 'gap');
    eq((await w.F('POST', '/den/brief/review', { id: b.id, ops: [{ op: 'unleave', key: sig.key }] })).status, 200);
    const p = await go(w, { width: wd, height: ht }); await ready(p);
    await p.locator(wd < 1200 ? '.dt-bar .dt-bargo' : '.den-fl-first').click(); await p.waitForSelector('.den-fl.open'); await sleep(200);
    await p.evaluate(() => { window.__fh = []; document.addEventListener('focusin', e => window.__fh.push((e.target.className || e.target.tagName) + '|' + (e.target.getAttribute('data-act') || ''))); });
    await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Too small to report' }).click();
    await focusSeen(p, '[data-act="copy"]', wd + ': Copy, seen, has the focus'); await sleep(300);
    const fh = await p.evaluate(() => window.__fh); ok(!fh.some(x => /den-checks-h/.test(x)), wd + ': the heading never took the focus: ' + JSON.stringify(fh)); eq((await act(p)).act, 'copy', wd + ': still on Copy');
    eq(p.errors, []); await p.context().close(); }
});

await t('T20 (U2, U4) the Sources drawer: stories, posts and links only; no word of s.6.2; a Use here button seen on each; the line on where it goes; no second heading', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p);
  const look = async (how, line) => { await p.waitForSelector('.dt-drawer'); await sleep(250);
    eq(await wordsIn(p, '.dt-drawer'), [], how + ': no word of s.6.2 in the drawer');
    const bad = await p.evaluate(() => Array.from(document.querySelectorAll('.dt-drawer li[data-cite]')).map(li => li.getAttribute('data-cite')).filter(id => !/^(M|S|P|E|H):/.test(id)));
    eq(bad, [], how + ': only stories, posts and links are offered');
    ok(!/Sentinel|Figure|baseline/.test(await p.evaluate(() => document.querySelector('.dt-drawer').textContent)), how + ': no alert and no figure');
    eq(await p.locator('.dt-drawer .den-evhead').count(), 0, how + ': the pane\'s own heading is not drawn in the drawer');
    const items = await p.evaluate(() => Array.from(document.querySelectorAll('.dt-drawer li.den-evitem')).map(li => { const b = Array.from(li.querySelectorAll('button')).find(x => /^Use here$/.test(x.textContent.trim())); const r = b ? b.getBoundingClientRect() : null; return !!(r && r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== 'hidden'); }));
    ok(items.length && items.every(Boolean), how + ': a Use here button seen on every entry ' + JSON.stringify(items));
    if (line) ok(line.test(await p.evaluate(() => document.querySelector('.dt-drawer').textContent)), how + ': the line ' + line);
    eq(await wordsIn(p, '#den-app'), [], how + ': the whole room'); };
  await p.locator('sup.dt-src button').first().click(); await look('a source number', /Use here puts its number at the end of the sentence and saves\./); await p.keyboard.press('Escape'); await sleep(100);
  await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); await sleep(150); await p.keyboard.press('Enter'); await look('Choose a source', /Use here puts its number at the end of the sentence and saves\./); await p.keyboard.press('Escape'); await sleep(100);
  await p.click('#dt-btn-help'); await p.locator('#dt-list-help .dt-mi', { hasText: 'What the checks mean' }).click(); await p.waitForSelector('.dt-sheet'); eq(await wordsIn(p, '#den-app'), [], 'with the checks sheet');
  eq(p.errors, []); await p.context().close();
});

await t('T21 (P1) leaving a check while a save is in flight: the newer words stay, and the next save meets no conflict', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p); let release; const gate = new Promise(r => { release = r; });
  w.hooks = [async (route, r, path) => { if (r.method() === 'POST' && /^\/den\/brief\/review/.test(path)) await gate; return false; }];
  const chk = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
  await p.locator('.den-fl[data-fl-item="' + chk + '"] .den-fl-t').click(); await p.locator('.den-fl.open [data-fx="out"]').click(); await p.locator('.den-fl.open .den-fl-reason', { hasText: 'Too small to report' }).click(); await sleep(100);
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' Saved while the mark waits.'); await p.keyboard.press('Escape');
  await until(p, () => /All changes saved/.test(document.querySelector('.dt-send').textContent), 'the edit saved'); release(); await sleep(700); w.hooks = [];
  ok(/Saved while the mark waits\./.test(await p.evaluate(() => document.querySelector('.dt-sec[data-section="bottom"]').textContent)), 'the newer words are still on screen');
  await p.locator('.dt-sec[data-section="bottom"] .den-docbody [data-at]').first().click(); await p.waitForSelector('.dt-ta'); await toEnd(p); await p.keyboard.type(' And again.'); await p.keyboard.press('Escape');
  await until(p, () => /All changes saved|Not saved|Someone else/.test(document.querySelector('.dt-send').textContent) && !/Saving/.test(document.querySelector('.dt-send').textContent), 'the next save answered');
  ok(!(await p.evaluate(() => /changed this report after you opened it/.test(document.querySelector('.dt-status').textContent))), 'no conflict');
  ok(/Saved while the mark waits\. And again\./.test((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.bottom.text), 'both edits are saved'); eq(p.errors, []); await p.context().close();
});

await t('T22 (P2) Write a sentence for it keeps the editor open, with the focus, beside the drawer', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p);
  const chk = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
  await p.locator('.den-fl[data-fl-item="' + chk + '"] .den-fl-t').click(); await focusIs(p, () => document.activeElement && document.activeElement.matches('.den-fl.open [data-fx="mention"]'), 'its usual fix focused'); await p.locator('.den-fl.open [data-fx="mention"]').click(); await p.waitForSelector('.dt-drawer'); await sleep(500);
  ok(await p.evaluate(() => !!document.querySelector('.dt-ta') && document.activeElement === document.querySelector('.dt-ta')), 'the editor is open and has the focus: ' + JSON.stringify(await act(p)));
  eq(p.errors, []); await p.context().close();
});

await t('T23 (P3) a p71 store (ax_den_tab = brief, no p72 key) opens Today on day one and on day two; the introduction\'s Done chooses Today', async () => {
  const w = await mkWorld(); const p = await go(w, { room: 'fresh' });
  await p.evaluate(() => { localStorage.removeItem('ax_den_p72'); localStorage.removeItem('ax_den_intro'); localStorage.setItem('ax_den_tab', JSON.stringify('brief')); }); await reload(p); await p.waitForSelector('.dt-room'); eq(await p.locator('.dt-room').count(), 1, 'day one: Today');
  await reload(p); await p.waitForSelector('#den-app'); await sleep(400); eq(await p.locator('.dt-room').count(), 1, 'day two: Today again');
  await p.waitForSelector('.dt-card'); await p.evaluate(() => localStorage.setItem('ax_den_tab', JSON.stringify('brief'))); for (let i = 0; i < 2; i++) await p.locator('.dt-card button', { hasText: 'Next' }).click(); await p.locator('.dt-card button', { hasText: 'Done' }).click();
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_tab'))), 'report', 'Done chooses Today'); await reload(p); await p.waitForSelector('#den-app'); await sleep(400); eq(await p.locator('.dt-room').count(), 1, 'after Done: Today'); eq(p.errors, []); await p.context().close();
});

await t('T24 (P4) a board answer without its alerts: Today asks for them itself, and they are listed', async () => {
  const w = await mkWorld(); w.hooks = [reshape(w, /^\/den\/board\?/, d => { delete d.missed; })];
  const p = await go(w); await ready(p); ok(await p.locator('#dt-col .den-fl[data-kind="check"]').count() > 0, 'the alerts are listed'); ok(p.served.some(x => /^GET \/den\/missed\?/.test(x)), 'asked for'); eq(p.errors, []); await p.context().close();
});

await t('T25 (P5) Use here puts the number at the cursor in the open editor; with no cursor, at the end of the sentence the drawer was opened for', async () => {
  const w = await mkWorld(); let p = await go(w); await ready(p);
  const chk = await p.evaluate(() => { const x = document.querySelector('.den-fl[data-kind="check"]'); return x && x.getAttribute('data-fl-item'); });
  await p.locator('.den-fl[data-fl-item="' + chk + '"] .den-fl-t').click(); await focusIs(p, () => document.activeElement && document.activeElement.matches('.den-fl.open [data-fx="mention"]'), 'its usual fix focused'); await p.locator('.den-fl.open [data-fx="mention"]').click(); await p.waitForSelector('.dt-drawer'); await sleep(400);
  ok(await p.evaluate(() => document.activeElement && document.activeElement.classList.contains('dt-ta')), 'in the editor');
  await p.keyboard.type(' Two accounts posted about it twice.'); const L0 = await p.evaluate(() => document.activeElement.value.length); for (let i = 0; i < L0 - 8; i++) await p.keyboard.press('ArrowLeft'); eq(await p.evaluate(() => document.activeElement.selectionStart), 8, 'the cursor moved');
  const card = p.locator('.dt-drawer li.den-evitem .den-evcard:not([disabled])').first(); const id = await card.evaluate(b => b.closest('li').getAttribute('data-cite')); await card.click(); await sleep(200);
  const v = await p.evaluate(() => { const ta = document.querySelector('.dt-ta'); return ta ? ta.value : null; }); ok(v != null, 'the editor stays open');
  ok(v.indexOf('[' + id + ']') >= 8 && v.indexOf('[' + id + ']') <= 9, 'the number at the cursor: ' + JSON.stringify(v.slice(0, 40))); eq(p.errors, []); await p.context().close();
  p = await go(w); await ready(p);
  const btn = p.locator('.dt-sec[data-section="summary"] sup.dt-src button').first(); const first = await btn.evaluate(b => b.closest('[data-at]').textContent); await btn.click(); await p.waitForSelector('.dt-drawer'); await sleep(300);
  const id2 = await p.evaluate(() => { const li = Array.from(document.querySelectorAll('.dt-drawer li.den-evitem')).find(x => x.getAttribute('data-list') !== 'used' && x.querySelector('.den-evcard:not([disabled])')); return li && li.getAttribute('data-cite'); }); ok(id2, 'a source to use');
  await p.locator('.dt-drawer li.den-evitem[data-cite="' + id2 + '"] .den-evcard').click(); await until(p, () => !document.querySelector('.dt-drawer'), 'the drawer closed');
  let txt = ''; for (let i = 0; i < 40 && txt.indexOf('[' + id2 + ']') < 0; i++) { await sleep(100); txt = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.summary.text; }
  const at = txt.indexOf('[' + id2 + ']'); const end1 = txt.indexOf(first.replace(/\s*\[\d+\]\s*/g, ' ').trim().split(' ').slice(-2).join(' ').replace(/\.$/, ''));
  ok(at > 0 && at < txt.indexOf('A campaigner'), 'the number in the sentence the drawer was opened for: ' + JSON.stringify(txt.slice(0, 260)) + ' ' + end1); eq(p.errors, []); await p.context().close();
});

await t('T26 (P6) a busy database\'s plain desk list on a refresh keeps the day\'s fields: the switcher\'s states and the report\'s header', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p); const doc0 = await p.evaluate(() => document.querySelector('.dt-doct').textContent); ok(await p.locator('.dt-mine .dt-rl').count() > 0, 'the switcher has states');
  w.hooks = [reshape(w, /^\/den\/desks/, d => { d.desks.forEach(x => { delete x.today; delete x.head; delete x.drafting; delete x.morning; }); })];
  await p.locator('#dt-secbtn-bottom').click(); await p.locator('#dt-secl-bottom .dt-mi', { hasText: 'Rewrite this section' }).click(); await p.locator('.dt-regen button', { hasText: 'Rewrite (uses 1 AI draft)' }).click();
  await until(p, () => /Section rewritten\./.test(document.querySelector('[data-dt-live="polite"]').textContent), 'rewritten'); await sleep(600);
  ok(p.served.filter(x => /^GET \/den\/desks/.test(x)).length >= 2, 'the desks were read again'); ok(await p.locator('.dt-mine .dt-rl').count() > 0, 'the switcher keeps its states');
  eq(await p.evaluate(() => document.querySelector('.dt-doct').textContent), doc0, 'the header kept'); w.hooks = []; eq(p.errors, []); await p.context().close();
});

await t('T27 (U5) the numbers follow what is shown: 1, 2, 3 in order, a group says its count in words, the report\'s numbers match', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p);
  ok(await p.locator('#dt-col .den-fl-group').count() > 0, 'a group of one kind'); eq(await p.locator('#dt-col .den-fl-group > .den-fl-gt .den-fl-n').count(), 0, 'no number circle on a group');
  ok(/^\d+ /.test(await p.evaluate(() => document.querySelector('#dt-col .den-fl-group .den-fl-tt b').textContent)), 'its count in words');
  for (const g of await p.locator('#dt-col .den-fl-group > .den-fl-gt[aria-expanded="false"]').all()) await g.click();
  const nums = await p.evaluate(() => Array.from(document.querySelectorAll('#dt-col .den-fl[data-fl-item] > .den-fl-t .den-fl-n')).map(e => +e.textContent)); eq(nums, nums.map((x, i) => i + 1), 'in order');
  const pills = await p.evaluate(() => Array.from(document.querySelectorAll('#dt-col .den-fl[data-fl-item]')).map(li => { const k = li.getAttribute('data-fl-item'); const m = Array.from(document.querySelectorAll('mark.dt-mark')).find(x => (x.getAttribute('data-flag-keys') || '').split(' ').indexOf(k) >= 0); return m ? [+li.querySelector('.den-fl-n').textContent, +m.querySelector('.dt-pill').textContent] : null; }).filter(Boolean));
  ok(pills.length && pills.every(x => x[0] === x[1]), 'the report\'s numbers match: ' + JSON.stringify(pills)); eq(p.errors, []); await p.context().close();
});

await t('T28 (U6) one primary at a time: an item open and the send box; under 1200 px the bar\'s Go to the first while an item is open', async () => {
  const w = await mkWorld(); const prim = p => p.evaluate(() => Array.from(document.querySelectorAll('.dt-room .primary')).filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(b => b.textContent.trim()));
  let p = await go(w); await ready(p); await p.click('.den-fl-first'); await p.waitForSelector('.den-fl.open'); await p.locator('.dt-send [data-act="mark"]').click(); await p.waitForSelector('.dt-box'); await sleep(150);
  eq(await prim(p), ['Go to the first'], '1366: the box\'s Go to the first only'); await p.context().close();
  p = await go(w, { width: 1100, height: 768 }); await ready(p); await p.locator('.dt-bar .dt-bargo').click(); await p.waitForSelector('.den-fl.open'); await sleep(200);
  eq((await prim(p)).length, 1, '1100: one primary with an item open: ' + JSON.stringify(await prim(p))); eq(p.errors, []); await p.context().close();
});

await t('T29 (U8) the report could not be loaded: said in the alert region with its reference, and Try again takes the focus', async () => {
  const w = await mkWorld(); w.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/brief\?/.test(path)) { await json(route, 500, { ok: false, error: 'fixture', detail: 'The invented store is down.', requestId: 'inv-ref-42' }); return true; } return false; }];
  const p = await go(w); await until(p, () => document.querySelector('.dt-room').dataset.state === 'loadfail', 'load failed');
  await until(p, () => /The report couldn't be loaded: The invented store is down \(reference inv-ref-42\)\./.test(document.querySelector('[data-dt-live="alert"]').textContent), 'said with its reference');
  await focusIs(p, () => document.activeElement && document.activeElement.getAttribute('data-act') === 'try-again', 'Try again has the focus'); w.hooks = []; eq(p.errors, []); await p.context().close();
});

await t('T30 (P9) a source the report can\'t use (409 cannot_cite): the drawer stays open and says so, the send block names the section, Take the mark out saves again', async () => {
  const w = await mkWorld(); const p = await go(w); await ready(p); let want = '';
  w.hooks = [async (route, r, path) => { if (want && r.method() === 'POST' && /^\/den\/brief\/save/.test(path) && String(r.postData() || '').indexOf('[' + want + ']') >= 0) { await json(route, 409, { ok: false, error: 'cannot_cite', detail: 'The invented store cannot use that source.', ids: [want] }); return true; } return false; }];
  await p.locator('.dt-sec[data-section="summary"] sup.dt-src button').first().click(); await p.waitForSelector('.dt-drawer'); await sleep(300);
  const id = await p.evaluate(() => { const li = Array.from(document.querySelectorAll('.dt-drawer li.den-evitem')).find(x => x.getAttribute('data-list') !== 'used' && x.querySelector('[data-use]')); return li && li.getAttribute('data-cite'); }); ok(id, 'a source to use'); want = id;
  await p.locator('.dt-drawer li.den-evitem[data-cite="' + id + '"] [data-use]').click();
  await until(p, () => /can't be used in this report/.test(document.querySelector('.dt-drawer') ? document.querySelector('.dt-drawer').textContent : ''), 'the drawer stays open and says why');
  await until(p, () => /can't be used/.test(document.querySelector('[data-dt-live="alert"]').textContent), 'said in the alert region');
  ok(/Not saved: a source in Executive Summary can't be used in this report\./.test(await p.evaluate(() => document.querySelector('.dt-send [data-refused]').textContent)), 'the send block names the section');
  await p.keyboard.press('Escape'); await sleep(100); ok(/a source this report can't use/.test(await p.evaluate(() => document.querySelector('.dt-sec[data-section="summary"]').textContent)), 'the reading view shows the mark it can\'t use');
  await p.locator('.dt-send [data-act="unmark"]').click();
  await until(p, () => /All changes saved/.test(document.querySelector('.dt-send').textContent), 'saved again'); ok(((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.summary.text || '').indexOf('[' + id + ']') < 0, 'the mark is out');
  w.hooks = []; eq(p.errors, []); await p.context().close();
});

await t('T31 (coordinator, guest names) the worker sends by and filed_by as \'\' to a guest: the workbench prints no dangling "by"', async () => {
  const w = await mkWorld(); const b0 = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief;
  const b1 = (await w.F('POST', '/den/brief/save', { id: b0.id, revision: b0.revision, sections: { bottom: 'An invented closing line written by a person.' } })).body.brief;
  eq((await w.F('POST', '/den/brief/file', { id: b1.id, revision: b1.revision, acknowledge: true })).status, 200);
  w.hooks = [reshape(w, /^\/den\/brief\?/, d => { if (d.brief) { d.brief.by = ''; d.brief.filed_by = ''; Object.keys(d.brief.sections || {}).forEach(k => { d.brief.sections[k].by = ''; }); } })];
  const p = await go(w, { room: '' }); await p.click('#den-tab-brief'); await tabOn(p, 'brief'); const s = await sec(p, 'bottom');
  const words = [await s.locator('h4').textContent(), await p.textContent('[data-tour="status"]'), await p.textContent('.den-filedband')].map(x => x.replace(/\s+/g, ' '));
  ok(/edited$/.test(words[0].trim()) && !/\bby\b/.test(words[0]), 'the section: ' + words[0]); ok(/^Sent, \d\d:\d\d$/.test(words[1].trim()), 'the chip: ' + words[1]); ok(/Sent at \d\d:\d\d\. /.test(words[2]) && !/ by \./.test(words[2]), 'the band: ' + words[2]);
  w.hooks = []; eq(p.errors, []); await p.context().close();
});

await finish();
