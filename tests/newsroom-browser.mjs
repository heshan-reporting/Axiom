/* Newsroom browser harness, from Kai's ClickUp tickets (23 October 2026):
 *   A. "Newsroom - Automatic updates": a search for "coal" was replaced by the general feed on the five-minute refresh
 *      while "coal" was still in the box. The refresh now re-runs the search quietly and keeps showing its results.
 *   B. "Newsroom - extract of specific text": a row's Read shows the article's text through /fulltext (public routes
 *      only), the paragraphs that mention the search words first and marked, and says which route carried it.
 *   C. A subscriber-only article says so, offers the archives (a second /fulltext without light) and the original.
 *   D. Clearing the box and searching again brings the general feed back.
 * Run: node tests/newsroom-browser.mjs */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';
const PORT = 8773, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }
const NOW = Date.now(), H = 3600e3, iso = t => new Date(t).toISOString();
const general = [
  { title: 'Housing approvals fall for a third month', link: 'https://abc.test/housing', src: 'abc', date: iso(NOW - H), desc: 'Approvals fell again.' },
  { title: 'Chalmers on the surplus', link: 'https://afr.test/surplus', src: 'afr', date: iso(NOW - 2 * H), desc: '' },
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
await t('no page errors', async () => { ok(!errors.length, errors.join(' | ')); });
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
