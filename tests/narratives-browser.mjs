/* Narratives view browser harness: the strip, the table (label, stance, rows,
 * pace, spread order, first seen, split, status), filters and search reaching
 * the worker, the empty state, the drawer (claim, counter-claim, the counter
 * narrative link, what changed, the spread timeline, the chart, channels,
 * loudest rows, terms, every row with the origin marked), operator edit /
 * pin / mute / merge, Place and name now with the console, and the read-only
 * key. Run: node narratives-browser.mjs   (SHOT=1 saves a screenshot) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';   // Playwright found portably (PLAYWRIGHT_MJS, the project, the global install)

const PORT = 8769, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }

const NOW = Date.now(), H = 3600e3, D = 86400e3;
const day = k => Math.floor((NOW - k * D) / D) * D;
const base = (id, o) => Object.assign({ id, label: '', summary: '', claim: '', counter_claim: '', proponents: '', issues: [], issueLabels: [], client: '', ns: '', side: 'unknown', n: 0, n24: 0, nprev: 0, velocity: 0, first_ts: NOW - 30 * H, first_platform: 'news', first_channel: '', last_ts: NOW - H, platforms: {}, spread: [], sentiment: { judged: 0, neg: 0, pos: 0, neu: 0, tone: null }, status: 'new', alerted: 0, alert_ts: 0, muted: false, pinned: false, edited: false, entities: [], counter: '' }, o);
let narrs = [
  base('n1a', { label: 'Fuel tax credits are a subsidy for billionaire miners', summary: 'Posters and some outlets say the diesel rebate is welfare for big miners. Reddit and Bluesky carry most of it.', claim: 'The fuel tax credit is a subsidy for mining companies.', counter_claim: 'The credit refunds a road tax on fuel used off public roads.', proponents: 'Reddit posters and climate groups', issues: ['ftc', 'mining'], issueLabels: ['Fuel tax credits', 'Mining and resources'], client: 'Minerals Council of Australia', ns: 'mca', side: 'hostile', n: 14, n24: 9, nprev: 3, velocity: 3, first_channel: 'smh', platforms: { news: 2, reddit: 6, bluesky: 3, meta: 2, youtube: 1 },
    spread: [{ platform: 'news', first: NOW - 30 * H, n: 2 }, { platform: 'reddit', first: NOW - 26 * H, n: 6 }, { platform: 'bluesky', first: NOW - 20 * H, n: 3 }, { platform: 'meta', first: NOW - 9 * H, n: 2 }, { platform: 'youtube', first: NOW - 3 * H, n: 1 }],
    sentiment: { judged: 12, neg: 9, pos: 1, neu: 2, tone: -0.55 }, status: 'growing', alerted: 1, alert_ts: NOW - 20 * H, entities: ['mca', 't_ftc', 'albanese'], counter: 'n2b' }),
  base('n3c', { label: 'Chalmers has the budget on track for a surplus', summary: 'Reporting and posts credit the Treasurer with a surplus path.', claim: 'The budget is on track.', proponents: 'Labor and business press', issues: ['econ'], issueLabels: ['Economy and tax'], client: 'Curious Minds', ns: 'cmm', n: 7, n24: 2, nprev: 0, velocity: 2, first_channel: 'afr', platforms: { news: 5, reddit: 2 }, spread: [{ platform: 'news', first: NOW - 30 * H, n: 5 }, { platform: 'reddit', first: NOW - 10 * H, n: 2 }], status: 'emerging', entities: ['chalmers'] }),
  base('n2b', { label: 'Fuel tax credits keep regional towns alive', summary: 'Industry and regional voices say the rebate underwrites regional jobs.', claim: 'Fuel tax credits sustain regional employment.', counter_claim: 'The money would do more in regional services.', proponents: 'mining industry and Coalition MPs', issues: ['ftc'], issueLabels: ['Fuel tax credits'], client: 'Minerals Council of Australia', ns: 'mca', side: 'supportive', n: 5, n24: 2, nprev: 2, velocity: 1, first_ts: NOW - 40 * H, first_channel: 'theaustralian', platforms: { news: 2, x: 2, reddit: 1 }, spread: [{ platform: 'news', first: NOW - 40 * H, n: 2 }, { platform: 'x', first: NOW - 30 * H, n: 2 }, { platform: 'reddit', first: NOW - 8 * H, n: 1 }], sentiment: { judged: 5, neg: 0, pos: 4, neu: 1, tone: 0.5 }, status: 'steady', entities: ['mca', 't_ftc'], counter: 'n1a' }),
  base('n4d', { n: 3, n24: 2, nprev: 0, velocity: 2, first_ts: NOW - 6 * H, first_platform: 'reddit', first_channel: 'r/australia', platforms: { reddit: 3 }, spread: [{ platform: 'reddit', first: NOW - 6 * H, n: 3 }], status: 'new', entities: ['albanese', 'greens'] }),
];
const items = [
  { id: 101, kind: 'news', platform: 'news', channel: 'smh', ts: NOW - 30 * H, title: 'Fuel tax credit a rort for billionaire miners, say critics', excerpt: 'The diesel rebate hands billions to big miners.', url: 'https://smh.test/a1', tone: -0.1, sim: 0.92 },
  { id: 102, kind: 'reddit_comment', platform: 'reddit', channel: 'r/australia', ts: NOW - 26 * H, title: '', excerpt: 'It is a rort. Billionaire miners pocket the fuel tax credit while we pay.', url: 'https://reddit.com/r/australia/comments/t1/c/a2', tone: -0.7, sim: 0.9 },
  { id: 103, kind: 'sig_thread', platform: 'bluesky', channel: 'bluesky', ts: NOW - 20 * H, title: 'the fuel tax credit rort', excerpt: 'the fuel tax credit rort for billionaire miners has to end', url: 'https://bsky.app/profile/did:plc:1/post/a3', tone: -0.7, sim: 0.88 },
  { id: 104, kind: 'reddit_comment', platform: 'reddit', channel: 'r/AusFinance', ts: NOW - 15 * H, title: '', excerpt: 'Another rort for the billionaire miners lobby, honestly.', url: '', tone: -0.6, sim: 0.85 },
  { id: 105, kind: 'comments', platform: 'meta', channel: 'MCA page', ts: NOW - 9 * H, title: '', excerpt: 'A rort. Billionaire miners do not need our fuel money.', url: '', tone: -0.8, sim: 0.83 },
  { id: 106, kind: 'reddit_comment', platform: 'reddit', channel: 'r/australia', ts: NOW - 7 * H, title: '', excerpt: 'Subsidy for billionaires, plain and simple.', url: '', tone: -0.5, sim: 0.81 },
  { id: 107, kind: 'sig_comment', platform: 'youtube', channel: 'ABC News (Australia)', ts: NOW - 3 * H, title: '', excerpt: 'billionaire miners and their rort, the fuel tax credit', url: 'https://www.youtube.com/watch?v=v1', tone: -0.6, sim: 0.8 },
  { id: 108, kind: 'sig_comment', platform: 'bluesky', channel: 'bluesky', ts: NOW - H, title: '', excerpt: 'Still waiting for anyone to defend the miners rort.', url: '', tone: null, sim: 0.79 },
];
const detail = id => {
  const n = narrs.find(x => x.id === id); if (!n) return null;
  const c = n.counter ? narrs.find(x => x.id === n.counter) : null;
  const its = id === 'n1a' ? items : [{ id: 900 + narrs.indexOf(n), kind: 'news', platform: n.first_platform, channel: n.first_channel, ts: n.first_ts, title: n.label || 'Untitled', excerpt: 'First row of ' + (n.label || n.id), url: 'https://example.test/' + n.id, tone: 0, sim: 0.9 }];
  return Object.assign({ ok: true }, n, {
    items: its.slice().sort((a, b) => b.ts - a.ts), origin: its.slice().sort((a, b) => a.ts - b.ts)[0],
    counterNarrative: c ? { id: c.id, label: c.label, n: c.n, side: c.side } : null,
    series: id === 'n1a' ? [{ t: day(2), n: 1, platforms: { news: 1 } }, { t: day(1), n: 5, platforms: { news: 1, reddit: 3, bluesky: 1 } }, { t: day(0), n: 8, platforms: { reddit: 3, bluesky: 2, meta: 2, youtube: 1 } }] : [{ t: day(0), n: n.n, platforms: n.platforms }],
    channels: Object.keys(n.platforms).map(p => ({ channel: p === 'reddit' ? 'r/australia' : p === 'news' ? n.first_channel || 'news' : p, platform: p, n: n.platforms[p] })),
    amplifiers: id === 'n1a' ? [{ item: 102, channel: 'r/australia', platform: 'reddit', title: 'It is a rort. Billionaire miners pocket the fuel tax credit while we pay.', url: 'https://reddit.com/r/australia/comments/t1/c/a2', ts: NOW - 26 * H, score: 120, comments: 0 }, { item: 103, channel: 'bluesky', platform: 'bluesky', title: 'the fuel tax credit rort', url: 'https://bsky.app/profile/did:plc:1/post/a3', ts: NOW - 20 * H, score: 40, comments: 9 }, { item: 104, channel: 'r/AusFinance', platform: 'reddit', title: 'Another rort for the billionaire miners lobby, honestly.', url: '', ts: NOW - 15 * H, score: 15, comments: 0 }] : [],
    termsTop: id === 'n1a' ? ['rort', 'billionaire', 'miners', 'fuel', 'credit', 'subsidy'] : [],
  });
};
const calls = []; let nameN = 0, placeN = 0;
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = u.searchParams;
  calls.push({ p, method, body, q: Object.fromEntries(q.entries()) });
  const g = k => q.get(k) || '';
  if (p === '/narratives/status') return { ok: true, live: narrs.length, named: narrs.filter(n => n.label).length, emerging: narrs.filter(n => n.status === 'emerging').length, growing: narrs.filter(n => n.status === 'growing').length, alerted: 1, backlog: 412, placed24: 133, windowHours: 72, alertMin: 6, embeddings: true, naming: true, budget: { used: 4, cap: 60, left: 56, model: 'claude-sonnet-4-6' }, last: { at: NOW - 25 * 60e3, placed: 133 } };
  if (p === '/narratives' && method === 'GET') {
    let l = narrs.filter(n => g('muted') === '1' ? n.muted : !n.muted);
    if (g('issue')) l = l.filter(n => n.issues.indexOf(g('issue')) >= 0);
    if (g('status')) l = l.filter(n => n.status === g('status'));
    if (g('side')) l = l.filter(n => n.side === g('side'));
    if (g('platform')) l = l.filter(n => n.platforms[g('platform')]);
    if (g('q')) l = l.filter(n => (n.label + ' ' + (detail(n.id).termsTop || []).join(' ')).toLowerCase().indexOf(g('q').toLowerCase()) >= 0);
    const s = g('sort') || 'velocity';
    l = l.slice().sort((a, b) => ((b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)) || (s === 'n' ? b.n - a.n : s === 'new' ? b.first_ts - a.first_ts : s === 'latest' ? b.last_ts - a.last_ts : b.velocity - a.velocity));
    return { ok: true, narratives: l, days: +g('days') };
  }
  if (p === '/narratives/one') return detail(g('id')) || { error: 'unknown_narrative' };
  if (p === '/narratives/update') { const n = narrs.find(x => x.id === body.id); ['label', 'summary', 'claim', 'counter_claim'].forEach(k => { if (body[k] != null) { n[k] = body[k]; n.edited = true; } }); if (Array.isArray(body.issues)) { n.issues = body.issues; n.issueLabels = body.issues.map(i => ({ ftc: 'Fuel tax credits', mining: 'Mining and resources', regional: 'Regional Victoria', econ: 'Economy and tax' })[i] || i); } if (body.muted != null) n.muted = !!body.muted; if (body.pinned != null) n.pinned = !!body.pinned; return { ok: true, narrative: n }; }
  if (p === '/narratives/merge') { const a = narrs.find(x => x.id === body.into), b = narrs.find(x => x.id === body.from); a.n += b.n; a.n24 += b.n24; narrs = narrs.filter(x => x.id !== body.from); narrs.forEach(x => { if (x.counter === body.from) x.counter = ''; }); return { ok: true, into: body.into, from: body.from, narrative: a }; }
  if (p === '/narratives/run') return { ok: true, job: 'jn1', id: 'jn1', where: 'worker' };
  if (p === '/narratives/step') { if (body.what === 'place') { placeN++; return { ok: true, what: 'place', scanned: placeN === 1 ? 100 : 12, placed: placeN === 1 ? 96 : 12, joined: 80, started: 16, unanchored: 4, remaining: placeN === 1 ? 12 : 0, namingDeferred: true, lines: [{ id: 1, ts: NOW, kind: 'info', text: (placeN === 1 ? 96 : 12) + ' rows placed (80 joined a live narrative, 16 started one), 4 set aside' }] }; } if (body.what === 'recount') return { ok: true, what: 'recount', recounted: 12, remaining: 0, lines: [{ id: 1, ts: NOW, kind: 'info', text: '12 narratives recounted, 0 still stale' }] }; nameN++; return { ok: true, what: 'name', named: nameN === 1 ? 5 : 3, calls: 1, alerts: 0, errors: [], remaining: nameN === 1 ? 3 : 0, budget: { used: nameN, cap: 120 }, lines: [{ id: 1, ts: NOW, kind: 'cmd', text: 'claude claude-opus-5-5 name 5 narratives (9 rows, 4 rows, 4 rows, 3 rows, 3 rows)' }, { id: 2, ts: NOW, kind: 'out', text: '"Fuel tax credits keep regional towns alive" [ftc]' }] }; }
  if (p === '/bridge/job') return { ok: true, id: 'jn1', source: 'narratives', status: 'done', agent: '', success: true, cursor: 4, result: { ok: true, scanned: 300, placed: 287, joined: 251, started: 36, named: 2, alerts: 1, summary: '287 rows placed (251 joined a live narrative, 36 started one), 13 set aside; 60 recounted; 2 named; 1 alert - 19.2s', touched: [{ id: 'n1a', added: 9, started: false }, { id: 'n9z', added: 1, started: true }], deferred: 12, namingDeferred: false, simStats: { started: 36, median: 0.79, p90: 0.85, atOldBar: 11, bar: 0.86, strict: 0.91 } }, lines: [
    { id: 1, ts: NOW, kind: 'info', text: '412 rows of the last 72h without a narrative; embedding 300 (Workers AI bge-base)' },
    { id: 2, ts: NOW, kind: 'info', text: '287 rows placed: 251 joined a live narrative, 36 started one; 13 too short' },
    { id: 3, ts: NOW, kind: 'cmd', text: 'claude claude-sonnet-4-6 name 2 narratives (14 rows, 7 rows)' },
    { id: 4, ts: NOW, kind: 'out', text: '"Fuel tax credits are a subsidy for billionaire miners" [ftc, mining]' }, { id: 5, ts: NOW, kind: 'done', text: 'finished: 287 rows placed (251 joined a live narrative, 36 started one), 13 set aside; 60 recounted; 2 named; 1 alert - 19.2s' }] };
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
  await page.waitForFunction(() => typeof go === 'function' && typeof narrativesInit === 'function', null, { timeout: 15000 });
  await page.evaluate(() => go('narratives'));
  await page.waitForSelector('#narratives-root .nr-table tbody tr', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));
const R = '#narratives-root ';
const rowsOf = page => texts(page, R + '.nr-table tbody tr td:first-child .lbl');

console.log('narratives-browser harness');
const page = await open('');
await t('the strip counts live, emerging, growing, alerted, waiting and the naming budget', async () => {
  const vals = await texts(page, R + '.src-stat .v'); eq(vals.slice(0, 5), ['4', '1', '1', '1', '412']); ok(/4/.test(vals[5]) && /60/.test(vals[5]), vals[5]);
  const subs = await texts(page, R + '.src-stat .s'); ok(/3 named, 133 rows placed today/.test(subs[0]), subs[0]); ok(/embeddings, claude-sonnet-4-6/.test(subs[5]), subs[5]); ok(/last 72h/.test(subs[4]));
  ok(await page.$(R + 'button:has-text("Place and name now")'), 'a full key can run the placement');
});
await t('the table lists by pace: label, stance, rows, pace, the order the channels took it up, first seen, split, status', async () => {
  eq(await rowsOf(page), ['Fuel tax credits are a subsidy for billionaire miners', 'Chalmers has the budget on track for a surplus', 'Unnamed: albanese, greens', 'Fuel tax credits keep regional towns alive']);
  const first = await page.textContent(R + '.nr-table tbody tr:first-child');
  ok(/hostile/.test(first) && /14/.test(first) && /3x/.test(first) && /Growing/.test(first) && /News smh/.test(first) && /Fuel tax credits, Mining and resources \/ Minerals Council of Australia \/ Reddit posters/.test(first), first);
  eq(await texts(page, R + '.nr-table tbody tr:first-child .nr-spread span'), ['News', 'Reddit', 'Bluesky', 'Facebook / Instagram', 'YouTube']);
  ok(/2 new/.test(await page.textContent(R + '.nr-table tbody tr:nth-child(2)')), 'no previous day reads as new rows');
  const un = await page.textContent(R + '.nr-table tbody tr:nth-child(3)'); ok(/unread/.test(un) && /New/.test(un) && /Reddit r\/australia/.test(un), un);
  const split = await page.getAttribute(R + '.nr-table tbody tr:first-child .nr-split', 'title'); eq(split, '9 hostile, 2 neutral, 1 warm of 12 rows judged');
  ok(/no rows judged yet/.test(await page.textContent(R + '.nr-table tbody tr:nth-child(2) td:nth-child(7)')));
});
await t('filters and search go to the worker and narrow the table; the empty state explains itself', async () => {
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*issue=ftc/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Client issue"]', 'ftc')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 2);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*issue=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Client issue"]', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*status=emerging/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Status"]', 'emerging')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  ok(/surplus/.test((await rowsOf(page))[0]));
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*status=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Status"]', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*side=supportive/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Stance"]', 'supportive')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  ok(/regional towns/.test((await rowsOf(page))[0]));
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*side=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Stance"]', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*platform=x/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Channel"]', 'x')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*platform=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Channel"]', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*scope=off/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Relevance"]', 'off')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*scope=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Relevance"]', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*sort=n/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Sort"]', 'n')]);
  await page.waitForFunction(() => /surplus/.test(document.querySelectorAll('#narratives-root .nr-table tbody tr')[1].textContent) && /regional towns/.test(document.querySelectorAll('#narratives-root .nr-table tbody tr')[2].textContent));
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*sort=velocity/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Sort"]', 'velocity')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*q=surplus/.test(r.url())), page.fill(R + '.src-q', 'surplus')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  ok(/1 narratives/.test(await page.textContent(R + '.src-count')));
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*q=&/.test(r.url())), page.fill(R + '.src-q', '')]);
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*status=fading/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Status"]', 'fading')]);
  await page.waitForSelector(R + '.empty:has-text("No narrative in this scope")');
  await Promise.all([page.waitForResponse(r => /\/narratives\?.*status=&/.test(r.url())), page.selectOption(R + '.sn-filters select[aria-label="Status"]', '')]);
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 4);
});
await t('a narrative opens the drawer: the claim and counter-claim, what changed, how it spread, the chart, who carries it, the loudest rows, the terms and every row with the origin marked', async () => {
  await page.click(R + '.nr-table tbody tr:has-text("billionaire miners")');
  await page.waitForSelector(R + '.sn-drawer .nr-ev');
  ok(/subsidy for billionaire miners/.test(await page.textContent(R + '.sn-drawertitle')), 'the title is the label');
  const head = await page.textContent(R + '.sn-drawerhead'); ok(/Fuel tax credits, Mining and resources \/ Minerals Council of Australia \/ carried by Reddit posters and climate groups/.test(head), head);
  const claims = await texts(page, R + '.sn-drawer .nr-claim'); ok(/Posters and some outlets/.test(claims[0]), 'the summary comes first: ' + claims.join(' | ')); ok(claims.some(c => /^The fuel tax credit is a subsidy for mining companies\.$/.test(c)), 'the claim: ' + claims.join(' | '));
  ok(/refunds a road tax/.test(await page.textContent(R + '.nr-claim.counter')), 'the counter-claim');
  eq(await page.textContent(R + '.nr-link'), 'Fuel tax credits keep regional towns alive');
  ok(/alerted/.test(await page.textContent(R + '.sn-drawer')), 'the alert is shown');
  const facts = await page.textContent(R + '.sn-facts'); ok(/Rows14/.test(facts) && /9 vs 3 \(3x\)/.test(facts) && /News smh/.test(facts) && /75% \/ 8%/.test(facts) && /Channels5/.test(facts), facts);
  eq(await page.$$eval(R + '.nr-timeline > div', els => els.map(e => e.lastElementChild.textContent.trim())), ['News - 2 rows', 'Reddit - 6 rows', 'Bluesky - 3 rows', 'Facebook / Instagram - 2 rows', 'YouTube - 1 row']);
  ok((await texts(page, R + '.nr-timeline > div > span:nth-child(2)')).every(s => /^\d{2} \w{3,4}, \d{2}:\d{2}$/.test(s)), 'each step carries its Australian Eastern time');
  eq((await page.$$(R + '.sn-chart rect')).length, 8, 'one bar segment per channel per day');
  eq((await texts(page, R + '.sn-mini tr td:first-child')), ['smh', 'r/australia', 'bluesky', 'meta', 'youtube']);
  eq((await page.$$(R + '.nr-ev')).length, 11, 'three loudest rows and eight rows');
  const loud = await page.textContent(R + '.nr-ev:first-of-type'); ok(/120 reactions/.test(loud) && /r\/australia/.test(loud) && /open/.test(loud), loud);
  eq(await texts(page, R + '.nr-terms span'), ['rort', 'billionaire', 'miners', 'fuel', 'credit', 'subsidy']);
  eq((await page.$$(R + '.nr-ev.origin')).length, 1);
  const origin = await page.textContent(R + '.nr-ev.origin'); ok(/origin/.test(origin) && /smh/.test(origin) && /rort for billionaire miners, say critics/.test(origin) && /fit 92%/.test(origin), origin);
  const evs = await texts(page, R + '.nr-ev'); ok(/Still waiting for anyone/.test(evs[3]) && /origin/.test(evs[evs.length - 1]), 'after the three loudest, the rows run newest first and end at the origin: ' + evs.map(e => e.slice(0, 30)).join(' | '));
  eq((await page.$$(R + '.sn-st.neg')).length, 6, 'hostile tone chips'); eq((await page.$$(R + '.sn-st')).length, 7, 'tone chips on the judged rows only, none on the unjudged one');
});
if (process.env.SHOT) { await page.screenshot({ path: 'shot-narratives.png' }); }
await t('the counter-narrative link opens the other side, which points back', async () => {
  await page.click(R + '.nr-link');
  await page.waitForSelector(R + '.sn-drawertitle:has-text("keep regional towns alive")');
  eq(await page.textContent(R + '.nr-link'), 'Fuel tax credits are a subsidy for billionaire miners');
  ok(/supportive/.test(await page.textContent(R + '.sn-drawer .nr-side')));
  ok((await page.$$(R + '.nr-table tbody tr.on')).length === 1 && /regional towns/.test(await page.textContent(R + '.nr-table tbody tr.on')), 'the table marks the open row');
});
await t('an operator edits the label and issues, pins (first in the table), mutes (hidden) and unmutes', async () => {
  await page.click(R + '.sn-drawer button:text-is("Edit")');
  await page.fill(R + '.sn-form label:has-text("Label") input', 'Regional towns depend on the fuel tax credit');
  await page.fill(R + '.sn-form label:has-text("Client issue ids") input', 'ftc, regional');
  await page.click(R + '.sn-form button:text-is("Save")');
  await page.waitForSelector(R + '.sn-drawertitle:has-text("Regional towns depend")');
  const upd = calls.filter(c => c.p === '/narratives/update').pop(); eq(upd.body.id, 'n2b'); eq(upd.body.label, 'Regional towns depend on the fuel tax credit'); eq(upd.body.issues, ['ftc', 'regional']); eq(upd.body.claim, 'Fuel tax credits sustain regional employment.');
  await page.waitForFunction(() => /Regional towns depend/.test(document.querySelector('#narratives-root .nr-table tbody').textContent));
  await page.click(R + '.sn-drawer button:text-is("Pin")');
  await page.waitForFunction(() => /Regional towns depend/.test(document.querySelector('#narratives-root .nr-table tbody tr:first-child').textContent));
  eq(calls.filter(c => c.p === '/narratives/update').pop().body, { id: 'n2b', pinned: true });
  await page.waitForSelector(R + '.sn-drawer button:text-is("Unpin")');
  await page.click(R + '.sn-drawer button:text-is("Mute")');
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 3);
  eq(calls.filter(c => c.p === '/narratives/update').pop().body, { id: 'n2b', muted: true });
  ok(/muted/.test(await page.textContent(R + '.sn-drawer')));
  await page.click(R + '.sn-drawer button:text-is("Unmute")');
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 4);
  await page.click(R + '.sn-drawer button:text-is("Unpin")');
  await page.waitForFunction(() => /billionaire miners/.test(document.querySelector('#narratives-root .nr-table tbody tr:first-child').textContent));
});
await t('merging folds an unnamed narrative into a named one and opens the result', async () => {
  await page.click(R + '.nr-table tbody tr:has-text("Unnamed: albanese")');
  await page.waitForSelector(R + '.sn-drawertitle:has-text("Unnamed narrative")');
  const opts = await texts(page, R + '.sn-drawer select option'); eq(opts.length, 4, 'merge targets are every other narrative'); ok(!opts.some(o => /Unnamed n4d/.test(o)));
  ok(await page.$(R + '.sn-drawer button:text-is("Merge")[disabled]'), 'Merge waits for a target');
  await page.selectOption(R + '.sn-drawer select', 'n3c');
  await page.click(R + '.sn-drawer button:text-is("Merge")');
  await page.waitForSelector(R + '.sn-drawertitle:has-text("budget on track for a surplus")');
  eq(calls.find(c => c.p === '/narratives/merge').body, { into: 'n3c', from: 'n4d' });
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 3);
  ok(/10/.test(await page.textContent(R + '.nr-table tbody tr:has-text("surplus") td.num')), 'the rows moved across');
  await page.click(R + '.sn-drawer button:text-is("Close")');
  await page.waitForFunction(() => !document.querySelector('#narratives-root .sn-drawer'));
});
await t('Finish all waiting places every waiting row, recounts, then names one call at a time until nothing waits', async () => {
  await page.click(R + 'button:has-text("Finish all waiting")');
  await page.waitForFunction(() => /finished/.test((document.querySelector('#narratives-root .sig-conhead') || {}).textContent || ''));
  const con = await page.textContent(R + '.sig-conbox');
  ok(/96 rows placed \(80 joined/.test(con) && /108 rows placed; nothing waits to be placed/.test(con) && /12 narratives recounted/.test(con) && /claude claude-opus-5-5 name 5 narratives/.test(con) && /nothing left waiting for a name/.test(con) && /8 narratives named in this pass/.test(con), con);
  eq(calls.filter(c => c.p === '/narratives/step' && c.body.what === 'place').length, 2, 'placed until nothing remained'); eq(calls.filter(c => c.p === '/narratives/step' && c.body.what === 'recount').length, 1); eq(calls.filter(c => c.p === '/narratives/step' && c.body.what === 'name').length, 2);
});
await t('Place and name now runs a job the console follows, then refreshes the strip and the table', async () => {
  const before = calls.filter(c => c.p === '/narratives/status').length;
  await page.click(R + 'button:has-text("Place and name now")');
  await page.waitForSelector(R + '.sig-con .sig-line.cmd');
  // the console streams: wait until the lines this case reads have arrived, rather than racing them
  await page.waitForFunction(r => { const t = (document.querySelector(r + '.sig-con') || {}).textContent || ''; return /name 2 narratives/.test(t) && /billionaire miners" \[ftc, mining\]/.test(t) && /287 rows placed: 251 joined/.test(t); }, R, { timeout: 15000 });
  eq(calls.find(c => c.p === '/narratives/run').body, {});
  ok(/claude claude-sonnet-4-6 name 2 narratives \(14 rows, 7 rows\)/.test(await page.textContent(R + '.sig-line.cmd')));
  ok(/billionaire miners" \[ftc, mining\]/.test(await page.textContent(R + '.sig-line.out')));
  ok(/287 rows placed: 251 joined/.test(await page.textContent(R + '.sig-con')));
  await page.waitForSelector(R + '.nr-result');
  const res = await page.textContent(R + '.nr-result');
  ok(/287 rows placed \(251 joined a live narrative, 36 started one\)/.test(res) && /2 narratives gained rows/.test(res) && /12 recounts wait for the half-hourly tick/.test(res) && /typically 0\.79/.test(res), res);
  eq(await texts(page, R + '.nr-result .nr-link'), ['Fuel tax credits are a subsidy for billionaire miners+9', 'new narrative+1 new']);
  ok(/finished: 287 rows placed/.test(await page.textContent(R + '.sig-line.done')), 'the finish line is a sentence, not JSON');
  eq(await page.textContent(R + '.nr-table tbody tr:has-text("billionaire miners") .nr-chip'), '+9');
  if (process.env.SHOT) await page.screenshot({ path: 'shot-narratives-run.png' });
  await page.click(R + '.nr-result .nr-only input');
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 1);
  await page.click(R + '.nr-result .nr-only input');
  await page.waitForFunction(() => document.querySelectorAll('#narratives-root .nr-table tbody tr').length === 3);
  await page.waitForFunction(b => window.__calls_status_after == null || true, before);
  await page.waitForSelector(R + 'button:has-text("Place and name now"):not([disabled])');
  ok(calls.filter(c => c.p === '/narratives/status').length > before, 'the strip was refreshed after the job');
});
await page.close();
await t('a read-only key sees everything and changes nothing', async () => {
  const p2 = await open('read');
  ok(!(await p2.$(R + 'button:has-text("Place and name now")')));
  await p2.click(R + '.nr-table tbody tr:has-text("billionaire miners")');
  await p2.waitForSelector(R + '.sn-drawer .nr-ev');
  ok(!(await p2.$(R + '.sn-drawer button:text-is("Edit")')) && !(await p2.$(R + '.sn-drawer button:text-is("Mute")')) && !(await p2.$(R + '.sn-drawer select')), 'no operator controls');
  ok(/refunds a road tax/.test(await p2.textContent(R + '.nr-claim.counter')) && (await p2.$$(R + '.nr-ev')).length === 11, 'the evidence is all there');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
