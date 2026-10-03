/* Scope bar harness: the bar under the navigation narrows the front page,
 * Narratives, Sentiment, Signals and Sources together; a party or person
 * opens their stance drawer; the scope survives a reload; Clear resets.
 * Run: node scope-browser.mjs */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';   // Playwright found portably (PLAYWRIGHT_MJS, the project, the global install)
const PORT = 8774, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }
const NOW = Date.now(), H = 3600e3;
const narr = (id, label, ns, issues, ents) => ({ id, label, client: ns === 'mca' ? 'Minerals Council of Australia' : 'Curious Minds', issues, issueLabels: issues, ns, side: 'hostile', n: 6, n24: 4, nprev: 1, velocity: 4, status: 'growing', first_ts: NOW - 20 * H, first_platform: 'news', first_channel: 'smh', last_ts: NOW - H, platforms: { news: 2, reddit: 4 }, sentiment: { judged: 0 }, alerted: false, counter: '', proponents: '', entities: ents, muted: false, pinned: false, edited: false, spread: [], channels: [], amplifiers: [], termsTop: [], items: [], origin: null, series: [] });
const narrs = [narr('n1', 'Fuel tax credits are a subsidy', 'mca', ['ftc'], ['mca', 'albanese']), narr('n2', 'Chalmers has a surplus', 'cmm', ['econ'], ['chalmers'])];
const ents = [{ id: 'alp', kind: 'party', name: 'Australian Labor Party', party: 'alp', active: true }, { id: 'albanese', kind: 'person', name: 'Anthony Albanese', party: 'alp', active: true }, { id: 'chalmers', kind: 'person', name: 'Jim Chalmers', party: 'alp', active: true }, { id: 'mca', kind: 'org', name: 'Minerals Council of Australia', active: true }];
const board = [{ id: 'albanese', name: 'Anthony Albanese', kind: 'person', party: 'alp', side: 'neutral', role: 'Prime Minister', ns: '', n: 120, score: -0.42, neg: 66, pos: 15, neu: 39, sarcasm: 4, intensity: 1.4, latest: NOW - H, prev: { n: 90, score: -0.2 }, change: -0.21, platforms: [], regions: [] }, { id: 'chalmers', name: 'Jim Chalmers', kind: 'person', party: 'alp', side: 'neutral', role: 'Treasurer', ns: '', n: 40, score: 0.1, neg: 10, pos: 15, neu: 15, sarcasm: 0, intensity: 1, latest: NOW - H, prev: null, change: null, platforms: [], regions: [] }];
const overview = { ok: true, at: NOW, days: 1, hours: 24, errors: [], alerts: { openCount: 2, open: [{ id: 1, ns: 'mca', client: 'MCA', issue: 'ftc', label: 'Fuel tax credits', ratio: 3, hot: 6, srcs: 4, detected: NOW - H, open: true }, { id: 2, ns: 'cmm', client: 'CM', issue: 'econ', label: 'Economy', ratio: 2.5, hot: 5, srcs: 3, detected: NOW - 2 * H, open: true }], recent: [] },
  narratives: { moving: narrs.map(n => Object.assign({}, n, { platforms: ['news', 'reddit'] })), fading: [], live: 2, emerging: 0, growing: 2, placed24: 10, backlog: 0 }, sentiment: { movers: [], loudest: [], hostileTo: [], judged24: 0, backlog: 0, budget: null, configured: true },
  issues: [{ id: 'ftc', label: 'Fuel tax credits', client: 'Minerals Council of Australia', ns: 'mca', recent: 8, news: 5, base: 1, ratio: 8 }, { id: 'econ', label: 'Economy & tax', client: 'Curious Minds', ns: 'cmm', recent: 4, news: 4, base: 2.5, ratio: 1.6 }], totals: { rows: 12, news: 9 },
  latest: [{ id: 1, kind: 'news', platform: 'news', src: 'abc', channel: 'abc', title: 'Fuel story', url: '', ts: NOW - H, tone: 0, issues: ['ftc'], score: 0, comments: 0 }, { id: 2, kind: 'news', platform: 'news', src: 'afr', channel: 'afr', title: 'Surplus story', url: '', ts: NOW - 2 * H, tone: 0, issues: ['econ'], score: 0, comments: 0 }],
  collection: { sources: { total: 10, delivering: 8, failing: 0, dead: 0, unverified: 2, items24: 100, lastSweep: null }, social: [] } };
const calls = [];
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = Object.fromEntries(u.searchParams.entries());
  calls.push({ p, method, body, q });
  if (p === '/overview') return Object.assign({}, overview, { days: +q.days || 1, hours: Math.round((+q.days || 1) * 24) });
  if (p === '/entities') return { ok: true, entities: ents, kinds: ['party', 'person', 'org', 'topic'], sides: ['client', 'opponent', 'neutral'], total: ents.length };
  if (p === '/narratives/status') return { ok: true, live: 2, named: 2, emerging: 0, growing: 2, alerted: 0, backlog: 0, placed24: 10, windowHours: 72, alertMin: 6, embeddings: true, naming: true, budget: { used: 0, cap: 60, model: 'm' } };
  if (p === '/narratives') return { ok: true, narratives: narrs.filter(n => (!q.issue || n.issues.indexOf(q.issue) >= 0) && (!q.ns || n.ns === q.ns) && (!q.entity || n.entities.indexOf(q.entity) >= 0)) };
  if (p === '/narratives/one') return Object.assign({}, narrs.find(n => n.id === q.id) || narrs[0], { counterNarrative: null });
  if (p === '/sentiment/status') return { ok: true, configured: true, budget: { used: 0, cap: 300, model: 'm' }, classified24: 0, classified7: 0, skipped24: 0, mentions7: 160, neg7: 76, pos7: 30, entities: { total: 4, active: 4 }, backlog: 0, windowHours: 72, regions: ['au', 'vic'] };
  if (p === '/sentiment/entities') return { ok: true, entities: board };
  if (p === '/sentiment/topics') return { ok: true, topics: [] };
  if (p === '/sentiment/series') return { ok: true, points: [] };
  if (p === '/sentiment/items') return { ok: true, items: [] };
  if (p === '/signals/status') return { ok: true, platforms: {}, configured: {}, collectors: [] };
  if (p === '/signals/threads') return { ok: true, threads: [], noise: 0 };
  if (p === '/bridge/status') return { ok: true, collectors: [], sources: {} };
  if (p === '/sources') return { ok: true, sources: [{ id: 'abc', name: 'ABC News', tier: 'core', juris: 'au', issues: ['ftc', 'gov'], methods: ['rss'], urls: {}, schedule: 60, enabled: true, core: true, edited: false, fails: 0, method_ok: 'rss', last_error: '', latest_ts: NOW - H, items24: 30, status: 'ok', last_try: NOW - H, last_ok: NOW - H, next_due: NOW + H, alerted: 0, note: '' }, { id: 'afr', name: 'AFR', tier: 'national', juris: 'au', issues: ['econ'], methods: ['rss'], urls: {}, schedule: 60, enabled: true, core: false, edited: false, fails: 0, method_ok: 'rss', last_error: '', latest_ts: NOW - H, items24: 12, status: 'ok', last_try: NOW - H, last_ok: NOW - H, next_due: NOW + H, alerted: 0, note: '' }, { id: 'theage', name: 'The Age', tier: 'metro', juris: 'vic', issues: ['vicelection'], methods: ['rss'], urls: {}, schedule: 60, enabled: true, core: false, edited: false, fails: 0, method_ok: 'rss', last_error: '', latest_ts: NOW - H, items24: 9, status: 'ok', last_try: NOW - H, last_ok: NOW - H, next_due: NOW + H, alerted: 0, note: '' }], summary: { total: 3, enabled: 3, core: 1, ok: 3, failing: 0, dead: 0, stale: 0, unverified: 0, off: 0, items24: 51, byMethod: { rss: 3 } }, lastSweep: null, tiers: ['core', 'national', 'metro'], juris: ['au', 'vic'], methods: ['rss'], deadAfter: 6, perTick: 50, renderConfigured: false };
  return { ok: true, items: [], rows: [], threads: [], alerts: [], sources: [], entities: [], narratives: [], topics: [], history: [] };
};
const browser = await chromium.launch();
const ctxb = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await ctxb.addInitScript(({ W }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); }, { W });
await ctxb.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
await ctxb.route(W + '/**', async route => { const r = route.request(); let body = null; try { body = r.postDataJSON(); } catch (e) {} await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(r.url(), r.method(), body)) }); });
async function open() {
  const page = await ctxb.newPage();
  page.on('pageerror', e => console.log('  [pageerror] ' + e.message.slice(0, 160)));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof scopeInit === 'function', null, { timeout: 15000 });
  await page.waitForSelector('#scope-root .scope-bar select[aria-label="Party or person"]:not([disabled])', { timeout: 15000 });
  await page.waitForSelector('#overview-root .ov-sec', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const until = async (fn, m, ms = 10000) => { const t0 = Date.now(); while (!fn()) { if (Date.now() - t0 > ms) throw new Error((m || 'timed out') + ' (not seen within ' + ms + 'ms)'); await new Promise(r => setTimeout(r, 100)); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));
const S = '#scope-root .scope-bar ';
const sel = (page, label, value) => page.selectOption(S + 'select[aria-label="' + label + '"]', value);

console.log('scope-browser harness');
let page = await open();
await t('the bar sits under the navigation with six controls and a hint; the register fills the party or person list', async () => {
  eq(await page.$$eval(S + 'select', els => els.map(e => e.getAttribute('aria-label'))), ['Client', 'Client issue', 'Party or person', 'Channel', 'Window', 'Region']);
  ok(/Narrows Sentiment, Narratives, Signals, Sources and the front page/.test(await page.textContent(S + '.scope-hint')));
  const opts = await texts(page, S + 'select[aria-label="Party or person"] option'); ok(opts.indexOf('Australian Labor Party') >= 0 && opts.indexOf('Anthony Albanese (ALP)') >= 0 && !opts.some(o => /Minerals Council/.test(o)), 'parties and people, not organisations: ' + opts.join(','));
  ok((await texts(page, S + 'select[aria-label="Client"] option')).indexOf('Minerals Council') >= 0);
});
await t('a client narrows the front page to that client\'s alerts, narratives, issues and rows, and the issue list to their issues', async () => {
  await sel(page, 'Client', 'mca');
  await page.waitForFunction(() => document.querySelectorAll('#overview-root .ov-sec:nth-of-type(1) tbody tr').length === 1);
  eq((await texts(page, '#overview-root .ov-sec:nth-of-type(2) tbody tr')).length, 1);
  ok(/Fuel tax credits are a subsidy/.test(await page.textContent('#overview-root .ov-sec:nth-of-type(2) tbody')));
  eq((await texts(page, '#overview-root .ov-issues tbody tr')).length, 1);
  eq((await texts(page, '#overview-root .ov-row')).length, 1);
  ok(/scoped to Minerals Council of Australia/.test(await page.textContent('#overview-root .ov-head')));
  const iss = await texts(page, S + 'select[aria-label="Client issue"] option'); ok(iss.length >= 2 && iss.every(o => /Every issue|Fuel tax|Critical minerals|Mining/i.test(o)), iss.join(','));
  ok(/Clear 1 filter/.test(await page.textContent(S + '.scope-clear')));
  ok(await page.$(S + 'select[aria-label="Client"].on'), 'an active control is marked');
});
await t('an issue and a window reach Narratives, Sentiment, Signals and Sources as their own filters', async () => {
  await sel(page, 'Client issue', 'ftc');
  await Promise.all([page.waitForResponse(r => /\/overview\?days=3/.test(r.url())), sel(page, 'Window', '3')]);
  await page.evaluate(() => go('narratives'));
  await page.waitForFunction(() => { const s = document.querySelector('#narratives-root .sn-filters select[aria-label="Client issue"]'); return s && s.value === 'ftc'; });
  eq(await page.inputValue('#narratives-root .sn-filters select[aria-label="Window"]'), '3');
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  await until(() => calls.some(c => c.p === '/narratives' && c.q.issue === 'ftc' && c.q.ns === 'mca' && c.q.days === '3'), 'the narratives call carries client, issue and window');
  await page.evaluate(() => go('sentiment'));
  await page.waitForFunction(() => { const s = document.querySelector('#sentiment-root .sn-filters select[aria-label="Client issue"]'); return s && s.value === 'ftc'; });
  await until(() => calls.some(c => c.p === '/sentiment/entities' && c.q.issue === 'ftc' && c.q.days === '3'), 'the sentiment call carries issue and window');
  await page.evaluate(() => go('signals'));
  await page.waitForFunction(() => Array.from(document.querySelectorAll('#signals-root select')).some(s => s.value === 'ftc'));
  await until(() => calls.some(c => c.p === '/signals/threads' && c.q.issue === 'ftc' && c.q.days === '3'), 'the signals call carries issue and window');
  await page.evaluate(() => go('sources'));
  await page.waitForFunction(() => document.querySelectorAll('#sources-root .src-table tbody tr').length === 1);
  ok(/ABC News/.test(await page.textContent('#sources-root .src-table tbody')), 'only the source that speaks to the issue');
});
await t('a party or person opens their stance drawer on Sentiment and narrows Narratives to the narratives naming them', async () => {
  await sel(page, 'Client issue', '');
  await sel(page, 'Party or person', 'albanese');
  await page.evaluate(() => go('sentiment'));
  await page.waitForSelector('#sentiment-root .sn-drawertitle:has-text("Anthony Albanese")', { timeout: 15000 });
  await page.evaluate(() => go('narratives'));
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1 && /subsidy/.test(document.querySelector('#narratives-root .nr-table tbody').textContent));
  await until(() => calls.some(c => c.p === '/narratives' && c.q.entity === 'albanese'), 'the entity reached the worker');
});
await t('a channel switches the Signals tab and narrows Narratives and Sentiment to that channel; a region reaches Sentiment and Sources', async () => {
  await sel(page, 'Channel', 'bluesky');
  await page.evaluate(() => go('signals'));
  await page.waitForFunction(() => /bluesky/i.test((document.querySelector('#signals-root .sig-tab.on, #signals-root [class*="tab"].on') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => {});
  await until(() => calls.some(c => c.p === '/signals/threads' && c.q.platform === 'bluesky'), 'signals asked for the bluesky threads');
  await until(() => calls.some(c => c.p === '/narratives' && c.q.platform === 'bluesky'), 'narratives narrowed to the channel');
  await sel(page, 'Region', 'vic');
  await page.evaluate(() => go('sentiment'));
  await page.waitForFunction(() => { const s = document.querySelector('#sentiment-root .sn-filters select[aria-label="Region"]'); return s && s.value === 'vic'; });
  await page.evaluate(() => go('sources'));
  await page.waitForFunction(() => document.querySelectorAll('#sources-root .src-table tbody tr').length === 1 && /The Age/.test(document.querySelector('#sources-root .src-table tbody').textContent));
});
await t('the scope survives a reload and Clear resets every view', async () => {
  await page.close(); page = await open();
  eq(await page.inputValue(S + 'select[aria-label="Client"]'), 'mca'); eq(await page.inputValue(S + 'select[aria-label="Party or person"]'), 'albanese'); eq(await page.inputValue(S + 'select[aria-label="Region"]'), 'vic'); eq(await page.inputValue(S + 'select[aria-label="Window"]'), '3');
  ok(/Clear 5 filters/.test(await page.textContent(S + '.scope-clear')));
  await page.click(S + '.scope-clear');
  await page.waitForSelector(S + '.scope-hint');
  eq(await page.inputValue(S + 'select[aria-label="Client"]'), '');
  await page.waitForFunction(() => document.querySelectorAll('#overview-root .ov-sec:nth-of-type(1) tbody tr').length === 2);
  eq(JSON.parse(await page.evaluate(() => localStorage.getItem('ax_scope'))).days, 0);
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
