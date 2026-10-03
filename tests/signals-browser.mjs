/* Signals view browser harness for the Phase 2 tabs: Bluesky, Mastodon, YouTube
 * and Substack read through the same routes, the Petitions tab, the Coverage
 * tab with its probe, the X "Read account timelines" button, and the read-only
 * key. Run: node signals-browser.mjs   (SHOT=1 saves screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';   // Playwright found portably (PLAYWRIGHT_MJS, the project, the global install)

const PORT = 8767, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }

const NOW = Date.now(), H = 3600e3;
const thread = (id, platform, title, extra) => Object.assign({ id, title, url: 'https://example.test/' + id, ts: NOW - 2 * H, tone: 0, channel: '', platform, score: 12, comments: 3, q: 'fuel tax credit', issues: ['ftc'], relevant: true, excerpt: title, held: { n: 3, hostile: 1, supportive: 1 } }, extra || {});
const threads = {
  bluesky: [thread('b1', 'bluesky', 'The fuel tax credit fight is on: the Minerals Council says it is not a subsidy'), thread('b2', 'bluesky', 'Albanese hedges on the diesel rebate in Perth today', { score: 38, comments: 1, held: null })],
  mastodon: [thread('m1', 'mastodon', 'Spring Street is a mess: the Allan government cannot land the budget', { channel: 'aus.social', issues: ['vicelection'], q: 'auspol' })],
  youtube: [thread('vid1', 'youtube', 'Fuel tax credit fight heats up as miners launch campaign', { channel: 'ABC News (Australia)', score: 12345, comments: 41, q: '' })],
  substack: [thread('s1', 'substack', 'Why the fuel tax credit matters', { channel: 'example.substack.com', q: '' })],
  x: [thread('1001', 'x', 'Today we announced a $1 billion critical minerals reserve.', { channel: 'AlboMP', issues: ['cm'], q: '', score: 1100, comments: 340 })],
  reddit: [],
};
const calls = [];
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = u.searchParams;
  calls.push({ p, method, body, q: Object.fromEntries(q.entries()) });
  if (p === '/signals/status') return { ok: true, byPlatform: { reddit: { threads: 0, comments: 0 }, bluesky: { threads: 2, comments: 2, hostile: 1, supportive: 1 }, mastodon: { threads: 1, comments: 1 }, youtube: { threads: 1, comments: 2, hostile: 1 }, substack: { threads: 1, comments: 2 }, x: { threads: 1, comments: 0 } }, configured: { linkedin: { ready: false, detail: 'Set LINKEDIN_TOKEN.' }, meta: { ready: false, detail: 'Set META_TOKEN.' }, x: { ready: true, desktopOnly: true, detail: 'X is collected from a logged-in desktop.' }, reddit: { ready: true, detail: 'anonymous' } }, agents: [] };
  if (p === '/signals/threads') { const pl = q.get('platform'); const t = threads[pl] || []; return { ok: true, platform: pl, days: 7, noise: 0, channels: t.filter(x => x.channel).map(x => ({ channel: x.channel, n: 1 })), threads: t, have: { total: t.length } }; }
  if (p === '/signals/comments') return { ok: true, comments: [{ body: 'Rubbish. It is a subsidy for billionaires.', tone: -1, ts: NOW - H, score: 5, issues: ['ftc'] }, { body: 'It refunds road tax on fuel used off road.', tone: 1, ts: NOW - H, score: 9, issues: [] }] };
  if (p === '/social/coverage') { const probe = q.get('probe') === '1'; return { ok: true, lastRun: NOW - 40 * 60e3, mac: false, platforms: [
    { id: 'bluesky', label: 'Bluesky', method: 'public AppView API', keys: 'none', configured: true, where: 'worker', reach: 'keyword search, threads, replies', unreachable: '', counts: { threads24: 14, threads7: 80, comments24: 30, comments7: 200, newest: NOW }, last: { at: NOW - 40 * 60e3, ok: true, threads: 14, comments: 30 }, probe: probe ? { ok: true, ms: 210, detail: '3 posts for auspol' } : undefined },
    { id: 'x', label: 'X', method: 'embed service from the worker; twitter-cli on the Mac', keys: 'none for timelines; a signed-in Mac for search', configured: true, where: 'both', reach: 'MP and watch-list timelines', unreachable: 'keyword search from the cloud', counts: { threads24: 9, threads7: 60, comments24: 0, comments7: 0, newest: NOW }, last: { at: NOW - 40 * 60e3, ok: false, detail: 'Nothing was read. gone_account: HTTP 404' }, probe: probe ? { ok: false, ms: 900, detail: 'the embed page carried no timeline' } : undefined },
    { id: 'facebook_public', label: 'Facebook public pages and groups', method: 'none available', keys: 'Page Public Content Access (Meta app review)', configured: false, where: 'none', reach: '', unreachable: 'the Graph API refuses other pages without PPCA', counts: { threads24: 0, threads7: 0, comments24: 0, comments7: 0, newest: 0 }, last: null },
    { id: 'youtube', label: 'YouTube', method: 'channel feeds; comments; captions', keys: 'YOUTUBE_KEY optional', configured: true, apiKey: false, where: 'worker', reach: 'videos, comments, captions', unreachable: 'keyword search without a key', counts: { threads24: 3, threads7: 20, comments24: 40, comments7: 300, newest: NOW }, last: { at: NOW - 40 * 60e3, ok: true, threads: 3, comments: 40 } },
  ], agents: [] }; }
  if (p === '/social/petitions') return { ok: true, days: 30, sites: [{ id: 'aph', name: 'Parliament of Australia e-petitions' }, { id: 'vic', name: 'Parliament of Victoria e-petitions' }], petitions: q.get('issue') === 'regional' ? [] : [
    { title: 'Reverse the changes to fuel tax credits for regional businesses', url: 'https://www.aph.gov.au/e-petitions/petition/EN7001', site: 'aph', juris: 'au', issues: ['ftc', 'mining'], signatures: 4212, closes: '12 November 2026', growth24: 412, growth7: null, excerpt: 'We the undersigned call on the House...' },
    { title: 'Ban duck hunting in Victoria', url: 'https://www.aph.gov.au/e-petitions/petition/EN7002', site: 'aph', juris: 'au', issues: ['regional'], signatures: 910, closes: '', growth24: null, growth7: null, excerpt: '' }] };
  if (p === '/social/sweep') return { ok: true, job: 'jx1', id: 'jx1', platform: body.platform, where: 'worker' };
  if (p === '/bridge/run') return { ok: true, id: 'jp1', source: body.source, where: 'worker' };
  if (p === '/bridge/job') { const id = q.get('id'); return { ok: true, id, source: id === 'jx1' ? 'x' : 'petitions', status: 'done', agent: '', success: true, cursor: 2, result: id === 'jx1' ? { ok: true, threads: 9, comments: 0, threadRows: 4, commentRows: 0 } : { ok: true, threads: 2, comments: 0, threadRows: 2, commentRows: 0, read: 2 }, lines: [{ id: 1, ts: NOW, kind: 'cmd', text: id === 'jx1' ? 'GET syndication.twitter.com/srv/timeline-profile/screen-name/AlboMP' : 'GET https://www.aph.gov.au/e-petitions' }, { id: 2, ts: NOW, kind: 'out', text: id === 'jx1' ? 'AlboMP: 20 posts in the timeline, 9 in the window' : '2 petitions listed' }] }; }
  return { ok: true };
};

const browser = await chromium.launch();
async function open(role) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + e.message.slice(0, 160)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); if (role) window.AX_ROLE = role; }, { W, role });
  await page.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(W + '/**', async route => { const r = route.request(); let body = null; try { body = r.postDataJSON(); } catch (e) {} await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(r.url(), r.method(), body)) }); });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof signalsInit === 'function', null, { timeout: 15000 });
  await page.evaluate(() => go('signals'));
  await page.waitForSelector('#signals-root .sig-tabs', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 2).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));

console.log('signals-browser harness (Phase 2 tabs)');
const page = await open('');
await t('the tab row carries every platform plus Petitions and Coverage, with counts on the platforms', async () => {
  const labels = await texts(page, '.sig-tabs .sig-tab');
  ok(['Reddit', 'X', 'LinkedIn', 'Meta', 'Bluesky', 'Mastodon', 'YouTube', 'Substack', 'Petitions', 'Coverage'].every(l => labels.some(x => x.startsWith(l))), labels.join(' | '));
  ok(labels.find(x => x.startsWith('Bluesky')).indexOf('2') > 0, 'Bluesky shows its count');
  ok(!/\d/.test(labels.find(x => x.startsWith('Coverage'))), 'Coverage has no count');
});
await t('the Bluesky tab lists posts through the same routes, with issues and the reply tone', async () => {
  await page.click('.sig-tab:has-text("Bluesky")');
  await page.waitForSelector('.rd-th');
  const titles = await texts(page, '.rd-th .t'); eq(titles.length, 2); ok(/Minerals Council/.test(titles[0]));
  ok((await texts(page, '.rd-th .rd-sub')).every(x => x === 'Bluesky'), 'no channel: the platform label shows');
  await page.click('.rd-th:first-child');
  await page.waitForSelector('.aud-c');
  eq((await texts(page, '.aud-c .tn')), ['hostile', 'supportive']);
  ok(/Open on Bluesky/.test(await page.textContent('.aud-src')));
  ok(calls.some(c => c.p === '/signals/threads' && c.q.platform === 'bluesky'));
});
await t('YouTube posts show their channel; Substack shows its publication', async () => {
  await page.click('.sig-tab:has-text("YouTube")'); await page.waitForSelector('.rd-th');
  eq(await texts(page, '.rd-th .rd-sub'), ['ABC News (Australia)']);
  ok(/Sweep YouTube/.test(await page.textContent('.rd-ctl')));
  await page.click('.sig-tab:has-text("Substack")'); await page.waitForSelector('.rd-th');
  eq(await texts(page, '.rd-th .rd-sub'), ['example.substack.com']);
});
await t('the X tab offers Read account timelines, which runs in the worker and is followed in the console', async () => {
  await page.click('.sig-tab:has-text("X")');
  await page.waitForSelector('.rd-ctl button:has-text("Read account timelines")');
  await page.click('.rd-ctl button:has-text("Read account timelines")');
  await page.waitForSelector('.sig-con .sig-line.cmd');
  ok(/timeline-profile\/screen-name\/AlboMP/.test(await page.textContent('.sig-line.cmd')));
  await page.waitForSelector('.rd-res.ok');
  ok(/4 new posts/.test(await page.textContent('.rd-res.ok')), await page.textContent('.rd-res.ok'));
  const c = calls.find(x => x.p === '/social/sweep'); eq(c.body.platform, 'x'); eq(c.body.params.days, 7);
});
await t('the Petitions tab ranks by growth, filters by issue, and reads the pages on demand', async () => {
  await page.click('.sig-tab:has-text("Petitions")');
  await page.waitForSelector('.pet-table');
  const rowsT = await texts(page, '.pet-table tbody tr');
  eq(rowsT.length, 2); ok(/4\.2K/.test(rowsT[0]) && /\+412/.test(rowsT[0]) && /12 November 2026/.test(rowsT[0]), rowsT[0]);
  ok(/Parliament of Australia e-petitions/.test(rowsT[0]));
  await page.selectOption('.rd-ctl select[aria-label="Issue"]', 'regional');
  await page.waitForSelector('.aud-notice:has-text("No petitions on file")');
  await page.selectOption('.rd-ctl select[aria-label="Issue"]', '');
  await page.waitForSelector('.pet-table');
  await page.click('button:has-text("Read the petition pages now")');
  await page.waitForFunction(() => /2 petitions listed/.test((document.querySelector('.sig-con') || {}).textContent || ''), null, { timeout: 15000 });
  ok(/2 petitions listed/.test(await page.textContent('.sig-con')), 'the console reports what was read');
  const c = calls.filter(x => x.p === '/bridge/run').pop(); eq(c.body.source, 'petitions');
});
await t('the Coverage tab shows every platform with method, needs, state, counts and last run, and probes on demand', async () => {
  await page.click('.sig-tab:has-text("Coverage")');
  await page.waitForSelector('.cov-table');
  const rowsT = await texts(page, '.cov-table tbody tr');
  eq(rowsT.length, 4);
  ok(/Bluesky/.test(rowsT[0]) && /public AppView/.test(rowsT[0]) && /14 \/ 30/.test(rowsT[0]) && /ok/.test(rowsT[0]), rowsT[0]);
  ok(/Facebook public/.test(rowsT[2]) && /not set up/.test(rowsT[2]) && /Cannot: the Graph API refuses/.test(rowsT[2]), rowsT[2]);
  ok(/on, no key/.test(rowsT[3]), 'YouTube says it runs without a key');
  ok(/Nothing was read\. gone_account/.test(rowsT[1]), 'the last failure is quoted');
  await page.waitForFunction(() => /No Mac collector connected/.test((document.querySelector('.rd-ctl') || {}).textContent || ''), null, { timeout: 15000 });   // the collector status is its own request
  await page.click('button:has-text("Probe every platform")');
  await page.waitForSelector('.cov-table td:has-text("reachable")');
  const after = await texts(page, '.cov-table tbody tr');
  ok(/reachable/.test(after[0]) && /3 posts for auspol/.test(after[0]));
  ok(/failed/.test(after[1]) && /no timeline/.test(after[1]));
  ok(calls.some(c => c.p === '/social/coverage' && c.q.probe === '1'));
});
if (process.env.SHOT) await page.screenshot({ path: 'shot-coverage.png' });
await page.close();
await t('a read-only key sees the tabs and the tables but no sweep, timeline or petition buttons', async () => {
  const p2 = await open('read');
  await p2.click('.sig-tab:has-text("X")'); await p2.waitForSelector('.rd-ctl');
  ok(!(await p2.$('button:has-text("Read account timelines")')) && !(await p2.$('button:has-text("Sweep X")')));
  await p2.click('.sig-tab:has-text("Petitions")'); await p2.waitForSelector('.pet-table');
  ok(!(await p2.$('button:has-text("Read the petition pages now")')));
  await p2.click('.sig-tab:has-text("Coverage")'); await p2.waitForSelector('.cov-table');
  ok(await p2.$('button:has-text("Probe every platform")'), 'probing is a read');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
