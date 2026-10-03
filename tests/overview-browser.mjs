/* Front page browser harness: the window line, the six sections as tables,
 * the window select reaching the worker, and drill-down: a narrative row opens
 * the Narratives drawer, an entity opens the Sentiment drawer, an issue sets
 * the Narratives filter. Run: node overview-browser.mjs   (SHOT=1 screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';   // Playwright found portably (PLAYWRIGHT_MJS, the project, the global install)
const PORT = 8772, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }
const NOW = Date.now(), H = 3600e3;
const narrA = { id: 'n1a', label: 'Fuel tax credits are a subsidy for billionaire miners', client: 'Minerals Council of Australia', issues: ['ftc', 'mining'], issueLabels: ['Fuel tax credits', 'Mining and resources'], ns: 'mca', side: 'hostile', n: 14, n24: 9, nprev: 3, velocity: 3, status: 'growing', first_ts: NOW - 30 * H, first_platform: 'news', first_channel: 'smh', last_ts: NOW - H, platforms: ['news', 'reddit', 'bluesky'], sentiment: { judged: 12, neg: 9, pos: 1, neu: 2, tone: -0.55 }, alerted: true, counter: '', proponents: 'Reddit posters and climate groups', summary: 'Posters say the rebate is welfare for miners.', claim: 'The fuel tax credit is a subsidy.', counter_claim: 'It refunds a road tax.', spread: [{ platform: 'news', first: NOW - 30 * H, n: 2 }, { platform: 'reddit', first: NOW - 20 * H, n: 9 }, { platform: 'bluesky', first: NOW - 5 * H, n: 3 }], channels: [], amplifiers: [], termsTop: ['rort'], items: [{ id: 1, title: 'Fuel tax credit a rort', excerpt: 'x', platform: 'news', channel: 'smh', ts: NOW - 30 * H, tone: -0.1, sim: 0.9, url: 'https://smh.test/a1' }], origin: { id: 1, url: 'https://smh.test/a1' }, series: [{ t: NOW - 86400e3, n: 5, platforms: { news: 2, reddit: 3 } }], muted: false, pinned: false, edited: false, entities: ['mca'], platformsMap: {} };
const narrD = { id: 'n4d', label: '', client: '', issues: [], issueLabels: [], ns: '', side: 'unknown', n: 3, n24: 3, nprev: 0, velocity: 3, status: 'new', first_ts: NOW - 5 * H, first_platform: 'reddit', first_channel: 'r/australia', last_ts: NOW - H, platforms: ['reddit'], sentiment: { judged: 0 }, alerted: false, counter: '', proponents: '' };
const overview = {
  ok: true, at: NOW, days: 1, hours: 24, errors: [],
  alerts: { openCount: 1, open: [{ id: 7, ns: 'mca', client: 'Minerals Council', issue: 'ftc', label: 'Fuel tax credits', ratio: 3.4, hot: 9, srcs: 5, detected: NOW - 2 * H, open: true }], recent: [] },
  narratives: { moving: [narrA, narrD], fading: [{ id: 'n3c', label: 'Chalmers has the budget on track for a surplus', n: 7 }], live: 4, emerging: 1, growing: 1, placed24: 133, backlog: 412 },
  sentiment: { movers: [{ id: 'albanese', name: 'Anthony Albanese', kind: 'person', party: 'alp', side: 'neutral', n: 120, score: -0.42, change: -0.21, prev: { n: 90 }, neg: 66, pos: 15 }, { id: 'lockthegate', name: 'Lock the Gate Alliance', kind: 'org', side: 'opponent', n: 9, score: 0.33, change: 0.4, prev: { n: 5 }, neg: 2, pos: 5 }], loudest: [], hostileTo: [{ id: 'mca', name: 'Minerals Council of Australia', kind: 'org', side: 'client', n: 48, score: -0.3, neg: 30, pos: 8 }], judged24: 340, backlog: 45, budget: { used: 12, cap: 300 }, configured: true },
  issues: [{ id: 'ftc', label: 'Fuel tax credits', client: 'Minerals Council of Australia', ns: 'mca', recent: 8, news: 5, base: 1, ratio: 8, n14: 21 }, { id: 'econ', label: 'Economy & tax', client: 'Curious Minds', ns: 'cmm', recent: 4, news: 4, base: 2.5, ratio: 1.6, n14: 40 }, { id: 'housing', label: 'Housing', client: 'Property Council', ns: 'pca', recent: 0, news: 0, base: 1.2, ratio: 0, n14: 16 }],
  totals: { rows: 12, news: 9 },
  latest: [{ id: 1, kind: 'news', platform: 'news', src: 'abc', channel: 'abc', title: 'Fuel tax credit fight heads to Senate', url: 'https://abc.test/1', ts: NOW - 40 * 60e3, tone: -0.4, issues: ['ftc'], score: 0, comments: 0 }, { id: 2, kind: 'reddit_thread', platform: 'reddit', src: 'reddit', channel: 'r/australia', title: 'Is the diesel rebate a rort?', url: 'https://reddit.com/r/australia/comments/t1', ts: NOW - 4 * H, tone: -0.5, issues: ['ftc'], score: 300, comments: 88 }, { id: 3, kind: 'news', platform: 'news', src: 'afr', channel: 'afr', title: 'Chalmers on the surplus', url: 'https://afr.test/2', ts: NOW - 6 * H, tone: 0, issues: ['econ'], score: 0, comments: 0 }],
  collection: { sources: { total: 236, delivering: 142, failing: 6, dead: 2, unverified: 80, items24: 1830, lastSweep: { at: NOW - 20 * 60e3, ran: 50, succeeded: 41 } }, social: [{ platform: 'bluesky', ok: true, filed: 41 }, { platform: 'mastodon', ok: false, filed: null, error: 'aus.social 502' }] },
};
const calls = [];
let briefN = 0;
const brief = { ok: true, day: new Date(NOW + 10 * H).toISOString().slice(0, 10), at: NOW - 2 * H, days: 1, hours: 24, model: 'claude-opus-5-5', by: 'cron', mind: 'cmm_abc', isToday: true, md: '# AXIOM daily brief - test\n\n## Fuel tax credit attack line spikes', stats: { alertsOpen: 1, narrativesLive: 4, moving: 1, judged24: 340, sentimentBacklog: 45, narrativeBacklog: 412, rows: 12, sourcesDelivering: 142 },
  brief: { headline: 'Fuel tax credit attack line spikes; Albanese turns critical', summary: 'Coverage of fuel tax credits ran eight times its usual today and a hostile narrative gained nine rows.', changed: [{ what: 'Fuel tax credits spiked to 8x baseline.', why: 'The Minerals Council owns the issue and the alert is unanswered.', evidence: ['A:7', 'I:ftc', 'N:n1a'] }], clients: [{ ns: 'mca', client: 'Minerals Council of Australia', read: 'A hostile narrative on the credit is emerging across Reddit and Bluesky.', watch: ['the subsidy framing'], risks: ['it reaches the metro press'], openings: ['regional jobs counter-narrative'], actions: ['acknowledge the alert and draft the angle'], evidence: ['N:n1a', 'E:mca'] }], narratives: [{ id: 'n1a', label: 'Fuel tax credits are a subsidy for billionaire miners', client: 'Minerals Council of Australia', n: 14, n24: 9, status: 'growing', stance: 'hostile', why: 'Nine rows in a day, all hostile.' }], sentiment: [{ id: 'albanese', name: 'Anthony Albanese', kind: 'person', n: 120, score: -0.42, change: -0.21, direction: 'more critical', why: 'most mentions today were critical.' }], risks: ['the attack line reaches television'], actions: ['brief the MCA by midday'], gaps: ['no X search coverage today'] } };
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = Object.fromEntries(u.searchParams.entries());
  calls.push({ p, method, body, q });
  if (p === '/overview') return Object.assign({}, overview, { days: +q.days || 1, hours: Math.round((+q.days || 1) * 24) });
  if (p === '/brief/daily') { briefN += method === 'POST' ? 1 : 0; return Object.assign({}, brief, method === 'POST' ? { by: 'Hesh', at: NOW, brief: Object.assign({}, brief.brief, { headline: 'Rewritten after the queues were drained' }) } : {}); }
  if (p === '/narratives/status') return { ok: true, live: 4, named: 3, emerging: 1, growing: 1, alerted: 1, backlog: 412, placed24: 133, windowHours: 72, alertMin: 6, embeddings: true, naming: true, budget: { used: 4, cap: 60, model: 'claude-sonnet-4-6' } };
  if (p === '/narratives') return { ok: true, narratives: [Object.assign({}, narrA, { platforms: { news: 2, reddit: 9, bluesky: 3 } })].filter(n => !q.issue || n.issues.indexOf(q.issue) >= 0) };
  if (p === '/narratives/one') return Object.assign({}, narrA, { platforms: { news: 2, reddit: 9, bluesky: 3 }, counterNarrative: null });
  if (p === '/sentiment/status') return { ok: true, configured: true, budget: { used: 12, cap: 300, model: 'claude-sonnet-4-6' }, classified24: 340, classified7: 2100, skipped24: 900, mentions7: 3200, neg7: 1500, pos7: 700, entities: { total: 110, active: 104 }, backlog: 45, windowHours: 72, regions: ['au', 'vic'] };
  if (p === '/sentiment/entities') return { ok: true, entities: [{ id: 'albanese', name: 'Anthony Albanese', kind: 'person', party: 'alp', side: 'neutral', role: 'Prime Minister', ns: '', n: 120, score: -0.42, neg: 66, pos: 15, neu: 39, sarcasm: 4, intensity: 1.4, latest: NOW - H, prev: { n: 90, score: -0.2 }, change: -0.21, platforms: [{ platform: 'reddit', n: 80, score: -0.5 }], regions: [{ region: 'au', n: 120, score: -0.4 }] }] };
  if (p === '/sentiment/topics') return { ok: true, topics: [] };
  if (p === '/sentiment/series') return { ok: true, points: [] };
  if (p === '/sentiment/items') return { ok: true, items: [] };
  if (p === '/entities') return { ok: true, entities: [], kinds: [], sides: [], total: 0 };
  return { ok: true, items: [], rows: [], threads: [], alerts: [], sources: [], entities: [], narratives: [], topics: [], history: [] };
};
const browser = await chromium.launch();
async function open(role) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + e.message.slice(0, 160)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); if (role) window.AX_ROLE = role; }, { W, role });
  await page.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(W + '/**', async route => { const r = route.request(); let body = null; try { body = r.postDataJSON(); } catch (e) {} await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(r.url(), r.method(), body)) }); });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof overviewInit === 'function', null, { timeout: 15000 });
  await page.waitForSelector('#overview-root .ov-sec', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));
const R = '#overview-root ';

console.log('overview-browser harness');
const page = await open('');
await t('the front page opens on the command view without go(): the window line names the last 24 hours in AEST', async () => {
  ok(/What changed in the last/.test(await page.textContent(R + '.ov-head')) && /AEST/.test(await page.textContent(R + '.ov-head')));
  eq(await page.inputValue(R + '.ov-head select'), '1');
  ok(!(await page.$('#v-command .ticker:visible')), 'the ticker is gone from view');
  ok(!(await page.$('#v-command .gstage:visible')), 'the gauge is gone from view');
  eq(await texts(page, R + '.ov-title'), ['Today\'s brief', 'Needs a response', 'Narratives moving', 'Who moved', 'Our issues against their own baseline', 'Latest on our issues', 'Collection']);
});
await t('needs a response: the open alert with ratio, stories, outlets and the clock', async () => {
  const row = await page.textContent(R + '.ov-sec:nth-of-type(1) tr.hot');
  ok(/Fuel tax credits/.test(row) && /3\.4x/.test(row) && /9 stories, 5 outlets/.test(row) && /2h ago/.test(row) && /awaiting acknowledgement/.test(row), row);
  eq(await page.textContent(R + '.ov-sec:nth-of-type(1) .ov-count'), '1');
});
await t('narratives moving: rows today against the day before, stance, split, first seen, status; fading listed underneath', async () => {
  const rows = await texts(page, R + '.ov-sec:nth-of-type(2) tbody tr');
  eq(rows.length, 2);
  ok(/subsidy for billionaire miners/.test(rows[0]) && /Minerals Council of Australia/.test(rows[0]) && /9 vs 3/.test(rows[0]) && /3x/.test(rows[0]) && /hostile/.test(rows[0]) && /News smh, 1d ago/.test(rows[0]) && /growing/.test(rows[0]), rows[0]);
  ok(/unnamed, 3 rows/.test(rows[1]) && /new/.test(rows[1]), rows[1]);
  ok(/Fading: .*budget on track for a surplus.* \(7\)/.test(await page.textContent(R + '.ov-sec:nth-of-type(2) .ov-foot')));
  ok(/4 live, 1 emerging, 1 growing; 133 rows placed today/.test(await page.textContent(R + '.ov-sec:nth-of-type(2) .ov-why')));
});
await t('who moved: entities by change, and the clients spoken of critically', async () => {
  const cols = await page.$$(R + '.ov-sec:nth-of-type(3) .ov-table'); eq(cols.length, 2);
  const r1 = await page.textContent(R + '.ov-sec:nth-of-type(3) .ov-table:nth-of-type(1) tbody tr:first-child');
  ok(/Anthony Albanese/.test(r1) && /person, ALP/.test(r1) && /120/.test(r1) && /-0\.42/.test(r1) && /-0\.21/.test(r1), r1);
  const r2 = await page.textContent(R + '.ov-sec:nth-of-type(3) .ov-table:nth-of-type(2) tbody tr:first-child');
  ok(/Minerals Council of Australia/.test(r2) && /48/.test(r2) && /-0\.30/.test(r2) && /63%/.test(r2), r2);
});
await t('our issues against their own baseline: rows, usual, a bar with the usual marked, the ratio; a spike row is hot', async () => {
  const rows = await texts(page, R + '.ov-issues tbody tr'); eq(rows.length, 3);
  ok(/Fuel tax credits/.test(rows[0]) && /8 \(5 news\)/.test(rows[0]) && /8x/.test(rows[0]), rows[0]);
  ok(await page.$(R + '.ov-issues tr.hot:has-text("Fuel tax credits")'), 'eight times usual on eight rows is hot');
  ok(!(await page.$(R + '.ov-issues tr.hot:has-text("Economy")')));
  eq(await page.getAttribute(R + '.ov-issues tr:first-child .ov-bar i', 'style'), 'width: 100%;');
  ok(/12 rows on client issues in 24h, 9 of them news/.test(await page.textContent(R + '.ov-sec:nth-of-type(4) .ov-why')));
});
await t('latest on our issues: time, channel, title as a link, issue tags, tone and comments', async () => {
  const rows = await texts(page, R + '.ov-row'); eq(rows.length, 3);
  ok(/40m/.test(rows[0]) && /News/.test(rows[0]) && /Fuel tax credit fight heads to Senate/.test(rows[0]) && /FUEL TAX CREDITS|Fuel tax credits/i.test(rows[0]) && /hostile/.test(rows[0]), rows[0]);
  ok(/r\/australia/.test(rows[1]) && /88 comments/.test(rows[1]), rows[1]);
  eq(await page.getAttribute(R + '.ov-row:first-child .ov-tx a', 'href'), 'https://abc.test/1');
});
await t('collection: sources, judged rows, placed rows and the social platforms, each a link', async () => {
  const lines = await texts(page, R + '.ov-lines > div'); eq(lines.length, 4);
  ok(/142 sources delivering, 1.8K items in 24h, 2 dead, 6 failing, 80 not yet tried - last sweep 20m ago, 41 of 50 delivered/.test(lines[0]), lines[0]);
  ok(/340 rows judged today, 12 of 300 calls spent, 45 waiting/.test(lines[1]), lines[1]);
  ok(/133 rows placed into narratives today, 4 live, 412 waiting/.test(lines[2]), lines[2]);
  ok(/Bluesky 41, Mastodon \(aus.social 502\)/.test(lines[3]), lines[3]);
});
await t('the window select asks the worker for another window', async () => {
  await Promise.all([page.waitForResponse(r => /\/overview\?days=7/.test(r.url())), page.selectOption(R + '.ov-head select', '7')]);
  await page.waitForFunction(() => /last 7 days|7 days/.test(document.querySelector('#overview-root .ov-head').textContent) || document.querySelector('#overview-root .ov-head select').value === '7');
  ok(calls.some(c => c.p === '/overview' && c.q.days === '7'));
  await Promise.all([page.waitForResponse(r => /\/overview\?days=1$/.test(r.url())), page.selectOption(R + '.ov-head select', '1')]);
});
if (process.env.SHOT) await page.screenshot({ path: 'shot-overview.png' });
await t('drill-down: a narrative row opens the Narratives view on that narrative', async () => {
  await page.click(R + '.ov-sec:nth-of-type(2) tbody tr:first-child .ov-link');
  await page.waitForSelector('#v-narratives.on');
  await page.waitForSelector('#narratives-root .sn-drawertitle:has-text("billionaire miners")', { timeout: 15000 });
  ok(calls.some(c => c.p === '/narratives/one' && c.q.id === 'n1a'));
  await page.evaluate(() => go('command'));
});
await t('drill-down: an issue sets the Narratives filter; an entity opens the Sentiment drawer', async () => {
  await page.click(R + '.ov-issues tr:first-child .ov-link:has-text("narratives")');
  await page.waitForSelector('#v-narratives.on');
  try {
    await page.waitForFunction(() => document.querySelector('#narratives-root .sn-filters select[aria-label="Client issue"]').value === 'ftc');
    // the select takes the value first and the view asks the worker on its next render: wait for the request, do not race it
    for (let i = 0; i < 50 && !calls.some(c => c.p === '/narratives' && c.q.issue === 'ftc'); i++) await new Promise(r => setTimeout(r, 100));
    ok(calls.some(c => c.p === '/narratives' && c.q.issue === 'ftc'), 'the filter reached the worker');
    await page.evaluate(() => go('command'));
    await page.click(R + '.ov-sec:nth-of-type(3) .ov-table:nth-of-type(1) tbody tr:first-child .ov-link');
    await page.waitForSelector('#v-sentiment.on');
    await page.waitForSelector('#sentiment-root .sn-drawertitle:has-text("Anthony Albanese")', { timeout: 15000 });
  } finally { await page.evaluate(() => go('command')); }   // a failure here must not leave the next case on another view
});
await t('the daily brief sits at the top: headline, summary, what changed with evidence links, by client, narratives and stances; Rewrite posts and shows the new one', async () => {
  await page.waitForSelector(R + '.ov-brief-h');
  const head = await page.textContent(R + '.ov-brief .ov-sechead');
  ok(/Today's brief/.test(head) && /written 2h ago by the morning run, claude-opus-5-5, filed in the Mind/.test(head), head);
  eq(await page.textContent(R + '.ov-brief-h'), 'Fuel tax credit attack line spikes; Albanese turns critical');
  const ch = await page.textContent(R + '.ov-changed'); ok(/Fuel tax credits spiked to 8x baseline\./.test(ch) && /A:7/.test(ch) && /N:n1a/.test(ch), ch);
  const cl = await page.textContent(R + '.ov-clients'); ok(/Minerals Council of Australia/.test(cl) && /Watch/.test(cl) && /the subsidy framing/.test(cl) && /Actions/.test(cl) && /acknowledge the alert/.test(cl), cl);
  const body = await page.textContent(R + '.ov-brief-body'); ok(/Narratives to watch/.test(body) && /14 \(9 today\)/.test(body) && /Stances that moved/.test(body) && /-0\.42/.test(body) && /Gaps in the evidence/.test(body) && /no X search coverage today/.test(body), body);
  await page.click(R + '.ov-changed .ov-evid:has-text("N:n1a")');
  await page.waitForSelector('#v-narratives.on');
  await page.evaluate(() => go('command'));
  await Promise.all([page.waitForResponse(r => /\/brief\/daily$/.test(r.url()) && r.request().method() === 'POST'), page.click(R + 'button:has-text("Rewrite today\'s brief")')]);
  await page.waitForSelector(R + '.ov-brief-h:has-text("Rewritten after the queues were drained")');
  eq(briefN, 1); const c = calls.filter(x => x.p === '/brief/daily' && x.method === 'POST'); eq(c[0].body, { days: 1 });
  ok(/written .* by Hesh/.test(await page.textContent(R + '.ov-brief .ov-sechead')));
  await page.click(R + '.ov-brief button:has-text("Fold")'); await page.waitForFunction(() => !document.querySelector('#overview-root .ov-brief-body'));
  await page.click(R + '.ov-brief button:has-text("Unfold")'); await page.waitForSelector(R + '.ov-brief-body');
});
await page.close();
await t('a read-only key reads the same page', async () => {
  const p2 = await open('read');
  eq((await texts(p2, R + '.ov-title')).length, 7);
  ok(!(await p2.$(R + '.ov-brief button:has-text("brief")')), 'a read key cannot write the brief'); ok(await p2.$(R + '.ov-brief button:has-text("Download .md")'), 'but can save it');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
