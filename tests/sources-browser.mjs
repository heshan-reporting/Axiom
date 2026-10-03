/* Sources view browser harness: serves docs/ statically, stubs the worker with
 * page.route, opens the island and drives it - the strip, the dead banner, the
 * table and its order, the filters, the drawer with probe and sweep, switching
 * a source off, editing, adding, the sweep job console, and the read-only key.
 * Run: node sources-browser.mjs   (SHOT=1 also saves screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';   // Playwright found portably (PLAYWRIGHT_MJS, the project, the global install)

const PORT = 8766, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }

const NOW = Date.now(), H = 3600e3;
const base = (o) => Object.assign({ issues: [], schedule: 60, enabled: true, core: false, edited: false, created: NOW - 30 * 86400e3, updated: NOW - H, last_try: NOW - H, last_ok: NOW - H, next_due: NOW + H, fails: 0, method_ok: 'rss', last_error: '', latest_ts: NOW - 2 * H, note: '', alerted: 0, items24: 3, status: 'ok' }, o);
let sources = [
  base({ id: 'theaustralian', name: 'The Australian', tier: 'national', juris: 'au', issues: ['gov', 'econ'], methods: ['rss', 'sitemap', 'html', 'gnews', 'render'], urls: { rss: 'https://www.theaustralian.com.au/feed', site: 'theaustralian.com.au', home: 'https://www.theaustralian.com.au/nation/politics' }, fails: 2, method_ok: '', last_ok: 0, latest_ts: 0, items24: 0, status: 'failing', last_error: 'rss:x404 sitemap:x403 html:x403 gnews:x200 | rss HTTP 404; sitemap HTTP 403; html HTTP 403; gnews Google News has nothing indexed for site:theaustralian.com.au in 2 days' }),
  base({ id: 'miningnews', name: 'MiningNews.net', tier: 'sector', juris: 'au', issues: ['mining'], methods: ['sitemap', 'gnews'], urls: { site: 'miningnews.net' }, fails: 7, alerted: 1, method_ok: '', last_ok: 0, latest_ts: 0, items24: 0, status: 'dead', last_error: 'sitemap:x403 gnews:x200 | sitemap HTTP 403; gnews Google News has nothing indexed for site:miningnews.net in 2 days' }),
  base({ id: 'nationals', name: 'The Nationals', tier: 'party', juris: 'au', issues: ['regional', 'gov'], methods: ['rss', 'wp', 'sitemap', 'gnews'], urls: { rss: 'https://nationals.org.au/feed/', wp: 'https://nationals.org.au', site: 'nationals.org.au' }, method_ok: 'wp', items24: 4, latest_ts: NOW - 0.5 * H, last_ok: NOW - 0.3 * H }),
  base({ id: 'smh', name: 'Sydney Morning Herald', tier: 'metro', juris: 'nsw', methods: ['rss'], urls: { rss: 'https://www.smh.com.au/rss/feed.xml' }, core: true, items24: 40, schedule: 30 }),
  base({ id: 'pod_7am', name: '7am (Schwartz Media)', tier: 'podcast', juris: 'au', issues: ['gov'], methods: ['podcast'], urls: { podcast: '7am Schwartz Media' }, method_ok: 'podcast', items24: 1, schedule: 240 }),
  base({ id: 'guild_org', name: 'Pharmacy Guild of Australia', tier: 'sector', juris: 'au', issues: ['pharmacy'], methods: ['html', 'gnews', 'render'], urls: { home: 'https://www.guild.org.au/news-events/news', site: 'guild.org.au' }, last_try: 0, last_ok: 0, latest_ts: 0, items24: 0, method_ok: '', status: 'unverified' }),
  base({ id: 'riverine_herald', name: 'Riverine Herald', tier: 'regional', juris: 'vic', issues: ['regional'], methods: ['rss'], urls: { rss: 'https://riverineherald.com.au/feed/' }, enabled: false, edited: true, status: 'off', note: 'paused' }),
  base({ id: 'vic_premier', name: 'Premier of Victoria', tier: 'official', juris: 'vic', issues: ['vicelection', 'regional'], methods: ['rss', 'sitemap', 'html', 'gnews', 'render'], urls: { rss: 'https://www.premier.vic.gov.au/rss.xml', home: 'https://www.premier.vic.gov.au/media-centre', site: 'premier.vic.gov.au' }, last_ok: NOW - 3 * 86400e3, latest_ts: NOW - 3 * 86400e3, items24: 0, status: 'stale', schedule: 120 }),
];
const summary = () => { const s = { total: sources.length, enabled: sources.filter(x => x.enabled).length, core: 1, ok: 0, failing: 0, dead: 0, stale: 0, unverified: 0, off: 0, items24: 0, byTier: {}, byMethod: {} }; sources.forEach(x => { s[x.status]++; s.items24 += x.items24; if (x.method_ok && x.enabled) s.byMethod[x.method_ok] = (s.byMethod[x.method_ok] || 0) + 1; }); return s; };
const calls = [];
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = u.searchParams;
  calls.push({ p, method, body, q: Object.fromEntries(q.entries()) });
  if (p === '/sources') return { ok: true, sources, summary: summary(), lastSweep: { at: NOW - 12 * 60e3, ran: 50, succeeded: 31, failed: 19, items: 412, added: 88, ms: 41000 }, tiers: ['core', 'national', 'metro', 'regional', 'broadcaster', 'wire', 'independent', 'official', 'party', 'polling', 'thinktank', 'sector', 'podcast', 'sweep'], juris: ['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'], methods: ['rss', 'wp', 'json', 'sitemap', 'podcast', 'html', 'gnews', 'render'], deadAfter: 6, perTick: 50, renderConfigured: false };
  if (p === '/sources/health') return { ok: true, id: q.get('id'), rows: [{ id: 9, src: q.get('id'), ts: NOW - H, ok: 1, method: 'wp', n: 2, ms: 640, detail: 'rss:x404 wp:2' }, { id: 8, src: q.get('id'), ts: NOW - 2 * H, ok: 0, method: '', n: 0, ms: 9000, detail: 'rss:x404 wp:x0 | rss HTTP 404; wp timed out after 7s' }], last24: { runs: 2, ok: 1, failed: 1 } };
  if (p === '/sources/probe') return { ok: true, id: q.get('id'), name: 'The Nationals', methods: ['rss', 'wp', 'sitemap', 'gnews'], best: 'wp', delivering: ['wp', 'gnews'], results: [
    { method: 'rss', ok: false, n: 0, ms: 210, status: 404, skipped: false, detail: 'HTTP 404' },
    { method: 'wp', ok: true, n: 2, ms: 480, status: 200, skipped: false, detail: '', full: true, sample: [{ title: 'Nationals unveil regional rail plan', link: 'https://nationals.org.au/news/regional-rail-plan/', date: '' }] },
    { method: 'sitemap', ok: false, n: 0, ms: 300, status: 200, skipped: false, detail: 'sitemap entries are all older than 48h or have no usable title' },
    { method: 'gnews', ok: true, n: 1, ms: 900, status: 200, skipped: false, detail: '', sample: [{ title: 'Nationals unveil regional rail plan', link: 'https://news.google.com/rss/articles/x', date: '' }] },
    { method: 'render', ok: false, n: 0, ms: 0, status: 0, skipped: true, detail: 'render is not configured' }], items: 2, renderConfigured: false };
  if (p === '/sources/sweep') { if (body && body.ids && body.ids.length) return { ok: true, ran: 1, succeeded: 1, failed: 0, items: 2, added: 1, dead: [], results: [{ id: body.ids[0], name: 'The Nationals', ok: true, method: 'wp', items: 2, added: 1, tried: [{ method: 'wp', ok: true, n: 2, ms: 500, status: 200, skipped: false, detail: '' }] }] }; return { ok: true, job: 'j77', note: 'Sweeping in the worker.' }; }
  if (p === '/bridge/job') return { ok: true, id: 'j77', source: 'sources', status: 'done', agent: '', success: true, cursor: 3, result: { ok: true, ran: 50, succeeded: 31 }, lines: [{ id: 1, ts: NOW, kind: 'info', text: 'sweeping 50 sources (due now)' }, { id: 2, ts: NOW, kind: 'cmd', text: 'nationals: wp https://nationals.org.au/wp-json/wp/v2/posts' }, { id: 3, ts: NOW, kind: 'out', text: 'nationals: 2 items via wp (480ms)' }] };
  if (p === '/sources/update') { const s = sources.find(x => x.id === body.id); Object.assign(s, body.patch || body); if (body.enabled === false) s.status = 'off'; if (body.enabled === true) s.status = 'ok'; return { ok: true, source: s }; }
  if (p === '/sources/add') { const s = base({ id: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), name: body.name, tier: body.tier, juris: body.juris, issues: body.issues, methods: Object.keys(body.urls).map(k => ({ rss: 'rss', wp: 'wp', home: 'html', site: 'gnews' })[k]).filter(Boolean), urls: body.urls, edited: true, last_try: 0, last_ok: 0, latest_ts: 0, items24: 0, method_ok: '', status: 'unverified' }); sources.push(s); return { ok: true, added: true, source: s }; }
  if (p === '/sources/export') return { ok: true, exported: new Date().toISOString(), count: sources.length, sources };
  if (p === '/bridge/run') return { ok: true, id: 'j78', source: body.source, where: 'desktop' };
  return { ok: true };
};

const browser = await chromium.launch();
async function open(role) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + e.message.slice(0, 160)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); if (role) window.AX_ROLE = role; window.confirm = () => true; }, { W, role });
  await page.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(W + '/**', async route => { const r = route.request(); let body = null; try { body = r.postDataJSON(); } catch (e) {} await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(r.url(), r.method(), body)) }); });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof sourcesInit === 'function', null, { timeout: 15000 });
  await page.evaluate(() => go('sources'));
  await page.waitForSelector('#sources-root .src-strip', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 2).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));

console.log('sources-browser harness');
const page = await open('');
await t('by default only the sources that deliver are listed, most productive first; the rest are counted, not shown', async () => {
  const names = await texts(page, '.src-table .src-name .n'); eq(names.length, 3, names.join(','));
  ok(names.every(n => !/MiningNews|The Australian|Pharmacy Guild|Riverine|Premier of Victoria/.test(n)), 'nothing failing, dead, stale, untried or off: ' + names.join(','));
  ok(/3 shown, 5 hidden/.test(await page.textContent('.src-count')));
  eq(await page.inputValue('.src-filters select[aria-label="Status"]'), 'ok');
  ok(!(await page.$('.src-banner-list')), 'the dead list is not spread across the top');
});
await t('the strip leads with what delivers; what does not is one quiet figure with a breakdown', async () => {
  const vals = await texts(page, '.src-stat .v'); eq(vals, ['3', '48', '8', '5']);
  const s = await texts(page, '.src-stat .s'); ok(/WordPress API 1/.test(s[0]) && /31 of 50 delivered/.test(s[1]) && /1 core feed/.test(s[2]) && /1 failing/.test(s[3]) && /1 dead/.test(s[3]) && /1 not yet tried/.test(s[3]) && /1 off/.test(s[3]), s.join(' | '));
  ok(await page.$('.src-actions button:has-text("Sweep what is due")'), 'the sweep buttons show for a full key');
  await page.click('.src-stat.quiet .src-link:has-text("not yet tried")');
  eq(await texts(page, '.src-table .src-name .n'), ['Pharmacy Guild of Australia'], 'a breakdown figure is a filter');
  await page.selectOption('.src-filters select[aria-label="Status"]', 'ok');
});
await t('the dead line is one sentence until asked; then the banner names the source', async () => {
  ok(/1 source has stopped delivering/.test(await page.textContent('.src-banner.quiet')));
  await page.click('.src-banner.quiet .src-link:has-text("Show them")');
  await page.waitForSelector('.src-banner-list');
  eq(await texts(page, '.src-banner-list .src-link'), ['MiningNews.net']);
  eq(await texts(page, '.src-table .src-name .n'), ['MiningNews.net']);
  await page.selectOption('.src-filters select[aria-label="Status"]', '');
  await page.selectOption('.src-filters select:last-of-type', 'status');
  await page.waitForFunction(() => document.querySelectorAll('.src-table tbody tr').length === 8);
});
await t('the table puts what needs attention first, and says which route delivers', async () => {
  const names = await texts(page, '.src-table .src-name .n');
  eq(names.slice(0, 4), ['MiningNews.net', 'The Australian', 'Premier of Victoria', 'Pharmacy Guild of Australia'], 'dead, failing, stale, untried, then delivering');
  eq(names[names.length - 1], 'Riverine Herald', 'switched-off last');
  const routes = await texts(page, '.src-table .src-route .src-chip');
  ok(routes.indexOf('WordPress API') >= 0 && routes.indexOf('podcast directory') >= 0 && routes.indexOf('nothing yet') >= 0 && routes.indexOf('-') >= 0, routes.join(','));
  const words = await texts(page, '.src-table .src-status'); eq(words[0], 'Dead'); eq(words[1], 'Failing');
  const latest = await page.getAttribute('.src-table tr:has-text("The Nationals") td.num', 'title'); ok(/AEST|AEDT|GMT\+1[01]/.test(latest || ''), 'AEST tooltip: ' + latest);
});
await t('filters narrow the table', async () => {
  await page.selectOption('.src-filters select:nth-of-type(1)', 'sector');
  eq(await texts(page, '.src-table .src-name .n'), ['MiningNews.net', 'Pharmacy Guild of Australia']);
  await page.selectOption('.src-filters select:nth-of-type(1)', '');
  await page.selectOption('.src-filters select:nth-of-type(2)', 'vic');
  eq((await texts(page, '.src-table .src-name .n')).sort(), ['Premier of Victoria', 'Riverine Herald']);
  await page.selectOption('.src-filters select:nth-of-type(2)', '');
  await page.selectOption('.src-filters select:nth-of-type(3)', 'ok');
  eq((await texts(page, '.src-table .src-name .n')).length, 3);
  await page.selectOption('.src-filters select:nth-of-type(3)', '');
  await page.fill('.src-q', 'nationals.org');
  eq(await texts(page, '.src-table .src-name .n'), ['The Nationals'], 'search covers urls');
  ok(/1 shown/.test(await page.textContent('.src-count')));
  await page.fill('.src-q', '');
});
await t('a row opens the drawer: facts, routes in order, urls, last failure', async () => {
  await page.click('.src-table tr:has-text("The Australian")');
  await page.waitForSelector('.src-drawer');
  ok(/The Australian/.test(await page.textContent('.src-drawertitle')));
  eq(await texts(page, '.src-routes .src-chip'), ['feed', 'news sitemap', 'listing page', 'Google News', 'rendered page']);
  ok(/rss HTTP 404; sitemap HTTP 403/.test(await page.textContent('.src-facts .err')));
  ok((await texts(page, '.src-urls .u')).indexOf('https://www.theaustralian.com.au/feed') >= 0);
  await page.waitForSelector('.src-probe'); ok(/Recent attempts/.test(await page.textContent('.src-drawer')), 'health history loads');
});
await t('Probe every route runs live and shows each answer', async () => {
  await page.click('.src-table tr:has-text("The Nationals")');
  await page.waitForSelector('.src-drawer:has-text("The Nationals")');
  await page.click('.src-drawer button:has-text("Probe every route")');
  await page.waitForSelector('.src-drawer .src-sub:has-text("Live probe")');
  ok(/delivering via WordPress API, Google News/.test(await page.textContent('.src-drawer .src-sub:has-text("Live probe")')));
  const rows = await page.$$eval('.src-drawer table.src-probe:first-of-type tbody tr', trs => trs.map(tr => tr.className + ':' + tr.children[1].textContent));
  eq(rows, ['bad:failed', 'ok:delivered (full text)', 'bad:failed', 'ok:delivered', 'skip:skipped']);
  ok(calls.some(c => c.p === '/sources/probe' && c.q.id === 'nationals'));
});
await t('Sweep now files the source and reports what it got', async () => {
  await page.click('.src-drawer button:has-text("Sweep now")');
  await page.waitForSelector('.toast');
  ok(/2 items via WordPress API, 1 new/.test(await page.textContent('.toast')), await page.textContent('.toast'));
  ok(calls.some(c => c.p === '/sources/sweep' && c.body && c.body.ids && c.body.ids[0] === 'nationals'));
  await page.waitForSelector('.src-drawer .src-sub:has-text("This sweep")');
});
await t('Switch off sends the update and the row goes to Off', async () => {
  await page.click('.src-drawer button:has-text("Switch off")');
  await page.waitForSelector('.src-table tr:has-text("The Nationals") .src-status:has-text("Off")');
  const c = calls.filter(x => x.p === '/sources/update').pop(); eq(c.body, { id: 'nationals', enabled: false });
  await page.click('.src-drawer button:has-text("Switch on")');
  await page.waitForSelector('.src-table tr:has-text("The Nationals") .src-status:has-text("Delivering")');
});
await t('Edit changes the name and the issues, then saves', async () => {
  await page.click('.src-drawer button:has-text("Edit")');
  await page.waitForSelector('.src-form');
  await page.fill('.src-form label:has-text("Name") input', 'The Nationals (federal)');
  await page.click('.src-form .src-chip.pick:has-text("Fuel tax credits")');
  await page.click('.src-form button:has-text("Save")');
  await page.waitForSelector('.src-drawertitle:has-text("The Nationals (federal)")');
  const c = calls.filter(x => x.p === '/sources/update').pop();
  eq(c.body.name, 'The Nationals (federal)'); ok(c.body.issues.indexOf('ftc') >= 0 && c.body.issues.indexOf('regional') >= 0); ok(c.body.urls && c.body.urls.wp, 'urls travel for a registry source');
});
await t('Probe with a browser queues a render job and says it waits for a Mac', async () => {
  await page.click('.src-table tr:has-text("Pharmacy Guild")');
  await page.waitForSelector('.src-drawer:has-text("Pharmacy Guild")');
  await page.click('.src-drawer button:has-text("Probe with a browser")');
  await page.waitForSelector('.sig-con');
  ok(/waiting for a Mac with Playwright/.test(await page.textContent('.sig-conhead')), await page.textContent('.sig-conhead'));
  const c = calls.filter(x => x.p === '/bridge/run').pop(); eq(c.body, { source: 'render', params: { source: 'guild_org' } });
});
await t('Add source needs a name and a way in, then opens the new source', async () => {
  await page.click('.src-toolbtns button:has-text("Add source")');
  await page.waitForSelector('.src-drawer:has-text("Add a source")');
  ok(await page.isDisabled('.src-form button:has-text("Add source")'), 'disabled until filled');
  await page.fill('.src-form label:has-text("Name") input', 'Colac Herald');
  await page.selectOption('.src-form label:has-text("Tier") select', 'regional');
  await page.selectOption('.src-form label:has-text("Jurisdiction") select', 'vic');
  await page.fill('.src-form label:has-text("Site for Google News") input', 'colacherald.com.au');
  await page.click('.src-form .src-chip.pick:has-text("Regional Victoria")');
  await page.click('.src-form button:has-text("Add source")');
  await page.waitForSelector('.src-drawertitle:has-text("Colac Herald")');
  const c = calls.filter(x => x.p === '/sources/add').pop(); eq(c.body.urls, { site: 'colacherald.com.au' }); eq(c.body.issues, ['regional']); eq(c.body.juris, 'vic');
  ok((await texts(page, '.src-table .src-name .n')).indexOf('Colac Herald') >= 0);
});
await t('Sweep what is due starts a job and the console tails it', async () => {
  await page.click('.src-actions button:has-text("Sweep what is due")');
  await page.waitForSelector('.sig-con:has-text("sweep what is due")');
  await page.waitForSelector('.sig-line.cmd');
  ok(/nationals: wp/.test(await page.textContent('.sig-line.cmd')));
  const c = calls.filter(x => x.p === '/sources/sweep').pop(); eq(c.body, { ids: [] });
});
if (process.env.SHOT) { await page.click('.src-table tr:has-text("The Australian")'); await page.waitForSelector('.src-drawer:has-text("The Australian")'); await page.screenshot({ path: 'shot-sources.png', fullPage: false }); }
await page.close();
await t('a read-only key sees the table and can probe, but nothing that changes the registry', async () => {
  const p2 = await open('read');
  ok(!(await p2.$('.src-actions')), 'no sweep buttons');
  ok(!(await p2.$('.src-toolbtns button:has-text("Add source")')) && !(await p2.$('.src-toolbtns button:has-text("Import")')));
  ok(await p2.$('.src-toolbtns button:has-text("Export")'), 'export stays');
  await p2.click('.src-table tr:has-text("The Nationals")');
  await p2.waitForSelector('.src-drawer');
  ok(await p2.$('.src-drawer button:has-text("Probe every route")'));
  ok(!(await p2.$('.src-drawer button:has-text("Sweep now")')) && !(await p2.$('.src-drawer button:has-text("Edit")')) && !(await p2.$('.src-drawer button:has-text("Switch off")')));
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
