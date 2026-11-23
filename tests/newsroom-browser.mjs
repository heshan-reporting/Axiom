/* Newsroom browser harness, from Kai's ClickUp tickets (23 October 2026):
 *   A. "Newsroom - Automatic updates": a search for "coal" was replaced by the general feed on the five-minute refresh
 *      while "coal" was still in the box. The refresh now re-runs the search quietly and keeps showing its results.
 *   B. "Newsroom - extract of specific text": a row's Read shows the article's text through /fulltext (public routes
 *      only), the paragraphs that mention the search words first and marked, and says which route carried it.
 *   C. A subscriber-only article says so, offers the archives (a second /fulltext without light) and the original.
 *   D. Clearing the box and searching again brings the general feed back.
 * And from Kai's ticket of 16 November 2026 ("Newsroom Irrelevant Result": a vacuum deal and a Matildas story on the MCA
 * Newsroom):
 *   E. With a client chosen in the Scope bar, the general feed shows only stories on that client's issues or naming its
 *      registered people and organisations; the count and the chips name the client; the deal source is not a chip.
 *   F. "All news" brings the whole feed back; the client's chip brings the narrowing back.
 *   G. Changing the client re-narrows to the new client; clearing the client shows everything and hides the chips.
 *   H. A search is never narrowed, and the general feed is narrowed again when the search is cleared.
 *   I. A client with nothing in the window gets an empty state that names the client and the way out.
 * Run: node tests/newsroom-browser.mjs */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';
const PORT = 8773, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' }); process.on('exit', () => { try { server.kill(); } catch (e) {} });   // a harness that stops early must not leave its server holding the port
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }
const NOW = Date.now(), H = 3600e3, iso = t => new Date(t).toISOString();
const general = [
  { title: 'Housing approvals fall for a third month', link: 'https://abc.test/housing', src: 'abc', date: iso(NOW - H), desc: 'Approvals fell again.' },
  { title: 'Chalmers on the surplus', link: 'https://afr.test/surplus', src: 'afr', date: iso(NOW - 2 * H), desc: '' },
  // the two stories from Kai's screenshots, and the two that belong on the MCA Newsroom (one by issue, one by a registered name)
  { title: 'Dyson V15 Detect Absolute $749 delivered', link: 'https://deals.test/vacuum', src: 'ozbargain deals', date: iso(NOW - H), desc: 'Cheapest ever for this stick vacuum.' },
  { title: 'Matildas name squad for the Asian Cup', link: 'https://abc.test/matildas', src: 'abc', date: iso(NOW - 2 * H), desc: 'Three debutants in the 23.' },
  { title: 'Miners press Treasury to keep fuel tax credits whole', link: 'https://afr.test/ftc', src: 'afr', date: iso(NOW - 3 * H), desc: 'The diesel rebate is back on the table.' },
  { title: 'Priya Nandakumar warns on approval delays', link: 'https://theaustralian.test/nandakumar', src: 'the australian', date: iso(NOW - 4 * H), desc: 'The industry body\'s chief says projects are stalling.' },
  { title: 'Gas supply shortfall looms for the east coast', link: 'https://smh.test/gas', src: 'smh', date: iso(NOW - 5 * H), desc: 'AEMO repeats its warning.' },
];
// the register: one person filed under the MCA client, one shared party (no client), one MCA entity switched off
const ENTS = [
  { id: 'priya_nandakumar', name: 'Priya Nandakumar', kind: 'person', ns: 'mca', aliases: ['Nandakumar'], active: true },
  { id: 'alp', name: 'Labor', kind: 'party', ns: '', aliases: ['ALP'], active: true },
  { id: 'old_chief', name: 'Chalmers', kind: 'person', ns: 'mca', aliases: [], active: false },
];
const coal = [
  { title: 'Coal exports slow as China demand eases', link: 'https://theaustralian.test/coal', src: 'the australian', date: iso(NOW - H), desc: 'Thermal coal shipments fell in September.' },
  { title: 'Hunter coal mine extension approved', link: 'https://smh.test/hunter', src: 'smh', date: iso(NOW - 3 * H), desc: 'The extension adds eight years.' },
];
const calls = [];
const ARTICLE = ['Australia\'s resources sector had a mixed September, according to figures released on Monday.',
  'Thermal coal exports fell 11 per cent as demand from China eased, the Office of the Chief Economist said.',
  'Iron ore held steady, and lithium prices recovered slightly from their August low across the month.',
  'Producers in the Hunter Valley said coal contracts for 2027 were still being negotiated with Japanese buyers.',
  'The minister said the government would publish its next resources outlook in December this year.'].join('\n\n');
const stub = (url) => {
  const u = new URL(url); const p = u.pathname; const q = Object.fromEntries(u.searchParams.entries());
  calls.push({ p, q });
  if (p === '/allnews') return { ok: true, items: q.q ? coal.slice(0, 1) : general, feeds: 40, sources: [{}, {}], generated: iso(NOW) };
  if (p === '/newsq') return { ok: true, items: coal.slice(1).map(it => Object.assign({}, it, { outlet: it.src })) };
  if (p === '/entities') return { ok: true, entities: ENTS };
  if (p === '/fulltext') {
    if (/hunter/.test(q.url)) return { ok: false, url: q.url, text: '', paywall: true, method: '', attempts: [{ method: 'direct', ok: false }], detail: 'paywalled' };
    return { ok: true, url: q.url, final: q.url, text: ARTICLE, chars: ARTICLE.length, method: 'amp', title: 'Coal exports slow' };
  }
  return { ok: true, items: [], rows: [], threads: [], alerts: [], sources: [], entities: [], narratives: [], topics: [], history: [] };
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(W => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); }, W);
await page.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await page.route(W + '/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(route.request().url())) }));
await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof go === 'function' && typeof loadCore === 'function', null, { timeout: 15000 });
await page.evaluate(() => go('news'));
await page.waitForSelector('#news-list .wi:has-text("Housing approvals")', { timeout: 15000 });
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const titles = () => page.$$eval('#news-list .wi .wi-t', els => els.map(e => e.textContent));
console.log('newsroom-browser harness');

await t('A. a search survives the five-minute refresh: the coal results stay and the refresh re-runs the search, not the general feed', async () => {
  await page.fill('#news-q', 'coal'); await page.press('#news-q', 'Enter');
  await page.waitForSelector('#news-list .wi:has-text("Coal exports slow")');
  ok(/"COAL"/.test(await page.textContent('#news-count')), 'the count names the search: ' + await page.textContent('#news-count'));
  const before = calls.filter(c => c.p === '/newsq').length;
  await page.evaluate(() => loadCore());   // what setInterval(refreshAll, 5 min) runs
  await page.waitForTimeout(600);
  const t2 = await titles();
  ok(t2.some(x => /Coal exports/.test(x)) && t2.some(x => /Hunter coal/.test(x)), 'the coal results are still shown: ' + JSON.stringify(t2));
  ok(!t2.some(x => /Housing approvals/.test(x)), 'the general feed did not replace them: ' + JSON.stringify(t2));
  ok(calls.filter(c => c.p === '/newsq').length > before, 'the refresh re-ran the search for new coal stories');
});
await t('B. Read shows the article here: the paragraphs that mention coal first, the word marked, and the route that carried it', async () => {
  const row = page.locator('#news-list .wi', { hasText: 'Coal exports slow' });
  await row.locator('.wi-read').click();
  await page.waitForSelector('#news-list .wi-ft p');
  const box = await page.textContent('#news-list .wi-ft');
  ok(/2 paragraphs mention "coal"/.test(box) && /read via the publisher's AMP page/.test(box), box.slice(0, 200));
  ok(/Thermal coal exports fell 11 per cent/.test(box) && /Hunter Valley/.test(box), 'the coal paragraphs: ' + box.slice(0, 300));
  ok(!/Iron ore held steady/.test(box), 'a paragraph without the word waits behind Show the whole article');
  ok((await page.$$('#news-list .wi-ft mark')).length >= 2, 'the word is marked');
  const fc = calls.filter(c => c.p === '/fulltext'); ok(fc.length === 1 && fc[0].q.light === '1' && /theaustralian\.test\/coal/.test(fc[0].q.url), JSON.stringify(fc));
  ok(page.url().indexOf('127.0.0.1') >= 0, 'Read did not follow the link');
  await page.click('#news-list .wi-ft button:has-text("Show the whole article")');
  ok(/Iron ore held steady/.test(await page.textContent('#news-list .wi-ft')), 'the whole article on request');
  await row.locator('.wi-read').click();   // a second Read folds it away
  await page.waitForFunction(() => !document.querySelector('#news-list .wi-ft'));
});
await t('C. a subscriber-only article says so plainly, offers the archives (a full /fulltext) and the original', async () => {
  const row = page.locator('#news-list .wi', { hasText: 'Hunter coal' });
  await row.locator('.wi-read').click();
  await page.waitForSelector('#news-list .wi-ft:has-text("Subscriber-only")');
  const box = await page.textContent('#news-list .wi-ft');
  ok(/never uses a subscription login/.test(box) && /The extension adds eight years/.test(box), box);
  ok(await page.$('#news-list .wi-ft a:has-text("Open the original")'), 'the original is a link');
  await page.click('#news-list .wi-ft button:has-text("Try the archives as well")');
  await page.waitForFunction(() => !document.querySelector('#news-list .wi-ft button'));
  const last = calls.filter(c => c.p === '/fulltext').pop(); ok(last.q.light === undefined, 'the archive try is the full reader: ' + JSON.stringify(last.q));
});
await t('D. clearing the box and searching again brings the general feed back, and the refresh then keeps it', async () => {
  await page.fill('#news-q', ''); await page.press('#news-q', 'Enter');
  await page.waitForSelector('#news-list .wi:has-text("Housing approvals")');
  ok(!/"/.test(await page.textContent('#news-count')));
  await page.evaluate(() => loadCore()); await page.waitForTimeout(300);
  ok((await titles()).some(x => /Housing approvals/.test(x)));
});
const scopeChips = () => page.$$eval('#news-scope .chip', els => els.map(e => (e.classList.contains('on') ? '*' : '') + e.textContent));
const srcChips = () => page.$$eval('#news-chips .chip', els => els.map(e => e.textContent));
await t('E. Minerals Council chosen in the Scope bar: only its stories, the count and chips name it, the deal source is no chip', async () => {
  await page.evaluate(() => AXUI.setScope({ ns: 'mca' }));
  await page.waitForSelector('#news-list .wi:has-text("Priya Nandakumar")', { timeout: 5000 });   // the register read landed and the named story is in
  const t1 = await titles();
  ok(t1.some(x => /fuel tax credits/.test(x)), 'the fuel tax story (an MCA issue) is shown: ' + JSON.stringify(t1));
  ok(t1.some(x => /Nandakumar/.test(x)), 'the story naming the registered person is shown');
  ok(!t1.some(x => /Dyson|Matildas|Housing approvals|Gas supply/.test(x)), 'the deal, the Matildas, housing and gas are not: ' + JSON.stringify(t1));
  ok(!t1.some(x => /Chalmers/.test(x)), 'a switched-off register entry does not pull a story in');
  const count = await page.textContent('#news-count');
  ok(/^MINERALS COUNCIL · /.test(count) && /2 STORIES/.test(count), 'the count names the client: ' + count);
  ok(!(await page.$eval('#news-scope', e => e.hidden)), 'the scope chips are shown');
  const sc = await scopeChips(); ok(sc[0] === '*Minerals Council only' && sc[1] === 'All news', JSON.stringify(sc));
  ok(/registered people and organisations/.test(await page.textContent('#news-scope')), 'the hint says what narrows');
  const srcs = await srcChips(); ok(!srcs.some(s => /ozbargain/.test(s)) && srcs.some(s => /^afr/.test(s)), 'source chips come from the narrowed feed: ' + JSON.stringify(srcs));
});
await t('F. All news brings the whole feed back; the client chip narrows it again', async () => {
  await page.click('#news-scope .chip:has-text("All news")');
  await page.waitForSelector('#news-list .wi:has-text("Dyson")');
  const t1 = await titles(); ok(t1.length === 7, 'every story: ' + JSON.stringify(t1));
  ok(!/MINERALS COUNCIL/.test(await page.textContent('#news-count')), 'the count no longer names the client');
  const sc = await scopeChips(); ok(sc[0] === 'Minerals Council only' && sc[1] === '*All news', JSON.stringify(sc));
  ok(/Every story from every source/.test(await page.textContent('#news-scope')));
  await page.click('#news-scope .chip:has-text("Minerals Council only")');
  await page.waitForFunction(() => { const t = [...document.querySelectorAll('#news-list .wi .wi-t')].map(e => e.textContent); return t.length === 2 && !t.some(x => /Dyson/.test(x)); });
  // the five-minute refresh keeps the narrowing
  await page.evaluate(() => loadCore()); await page.waitForTimeout(300);
  ok((await titles()).length === 2, 'narrowed after the refresh');
});
await t('G. another client re-narrows to its stories (All news is forgotten); no client shows everything and hides the chips', async () => {
  await page.click('#news-scope .chip:has-text("All news")');
  await page.waitForSelector('#news-list .wi:has-text("Dyson")');
  await page.evaluate(() => AXUI.setScope({ ns: 'aep' }));
  await page.waitForFunction(() => document.querySelectorAll('#news-list .wi').length === 1);
  const t1 = await titles(); ok(/Gas supply/.test(t1[0]), 'the gas story for Energy Producers: ' + JSON.stringify(t1));
  ok(/^ENERGY PRODUCERS · /.test(await page.textContent('#news-count')));
  ok((await scopeChips())[0] === '*Energy Producers only', JSON.stringify(await scopeChips()));
  await page.evaluate(() => AXUI.setScope({ ns: '' }));
  await page.waitForFunction(() => document.querySelectorAll('#news-list .wi').length === 7);
  ok(await page.$eval('#news-scope', e => e.hidden), 'the chips are hidden with no client');
  ok(!/ONLY|·  ·/.test(await page.textContent('#news-count')));
});
await t('H. a search is never narrowed; clearing it narrows the general feed again', async () => {
  await page.evaluate(() => AXUI.setScope({ ns: 'mca' }));
  await page.waitForFunction(() => document.querySelectorAll('#news-list .wi').length === 2);
  await page.fill('#news-q', 'coal'); await page.press('#news-q', 'Enter');
  await page.waitForSelector('#news-list .wi:has-text("Coal exports slow")');
  const t1 = await titles(); ok(t1.length === 2 && t1.every(x => /coal/i.test(x)), 'the coal results, all of them: ' + JSON.stringify(t1));
  ok(await page.$eval('#news-scope', e => e.hidden), 'no client chips while a search is shown');
  ok(/^"COAL" · /.test(await page.textContent('#news-count')), 'the count names the search, not the client');
  await page.fill('#news-q', ''); await page.press('#news-q', 'Enter');
  await page.waitForFunction(() => { const t = [...document.querySelectorAll('#news-list .wi .wi-t')].map(e => e.textContent); return t.length === 2 && t.some(x => /fuel tax/.test(x)); });
  ok(!(await page.$eval('#news-scope', e => e.hidden)), 'the chips are back');
});
await t('I. a client with nothing in the window: the empty state names the client and the way out', async () => {
  await page.evaluate(() => AXUI.setScope({ ns: 'pharm' }));
  await page.waitForSelector('#news-list .empty');
  const e = await page.textContent('#news-list .empty');
  ok(/Nothing on Pharmacy Guild's issues in the last 72 hours/.test(e) && /All news/.test(e), e);
  ok(/^PHARMACY GUILD · 0 SOURCES · 0 STORIES/.test(await page.textContent('#news-count')), await page.textContent('#news-count'));
  await page.evaluate(() => AXUI.setScope({ ns: '' }));
  await page.waitForFunction(() => document.querySelectorAll('#news-list .wi').length === 7);
});
await t('no page errors', async () => { ok(!errors.length, errors.join(' | ')); });
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
