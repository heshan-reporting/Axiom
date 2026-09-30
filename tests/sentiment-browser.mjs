/* Sentiment view browser harness: the strip, filters, leaderboard order and
 * bars, the topic table, the entity drawer with chart, channel/region tables
 * and evidence, the topic drawer, the register (add, edit, toggle, test,
 * sync MPs), Classify now with the console, and the read-only key.
 * Run: node sentiment-browser.mjs   (SHOT=1 saves screenshots) */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const DOCS = new URL('../docs', import.meta.url).pathname;

const PORT = 8768, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }

const NOW = Date.now(), H = 3600e3, D = 86400e3;
const ent = (id, name, kind, o) => Object.assign({ id, name, kind, party: '', side: 'neutral', role: '', ns: '', n: 10, score: 0, neg: 3, pos: 3, neu: 4, sarcasm: 0, intensity: 1.4, latest: NOW - H, prev: { n: 8, score: 0.1 }, change: -0.1, platforms: [{ platform: 'reddit', n: 6, score: -0.3 }, { platform: 'news', n: 4, score: 0.1 }], regions: [{ region: 'au', n: 7, score: -0.1 }, { region: 'vic', n: 3, score: -0.4 }] }, o || {});
let entities = [
  ent('albanese', 'Anthony Albanese', 'person', { party: 'alp', role: 'Prime Minister', n: 120, score: -0.42, neg: 66, pos: 15, neu: 39, sarcasm: 4, change: -0.21 }),
  ent('mca', 'Minerals Council of Australia', 'org', { side: 'client', ns: 'mca', role: 'Peak body, mining', n: 48, score: 0.12, neg: 14, pos: 20, neu: 14, change: null, prev: null }),
  ent('lockthegate', 'Lock the Gate Alliance', 'org', { side: 'opponent', ns: 'mca', n: 9, score: 0.33, neg: 2, pos: 5, neu: 2, change: 0.4 }),
  ent('t_ftc', 'Fuel tax credits', 'topic', { side: 'client', ns: 'mca', n: 70, score: -0.3, neg: 40, pos: 19, neu: 11, change: 0.05 }),
];
const topics = [{ id: 'ftc', label: 'Fuel tax credits', client: 'Minerals Council of Australia', ns: 'mca', n: 90, tone: -0.35, neg: 50, pos: 20, news: 30, entities: [{ id: 'mca', name: 'Minerals Council of Australia', n: 48, score: 0.12 }, { id: 'albanese', name: 'Anthony Albanese', n: 30, score: -0.5 }] }, { id: 'vicelection', label: 'Victorian election', client: 'The Nationals Victoria', ns: 'vicnats', n: 22, tone: -0.1, neg: 8, pos: 6, news: 15, entities: [] }];
const register = [
  { id: 'albanese', kind: 'person', name: 'Anthony Albanese', aliases: ['Albanese', 'Albo', 'the PM'], party: 'alp', role: 'Prime Minister', side: 'neutral', ns: '', active: true, edited: false, source: 'seed', note: '', mentions7: 120, score7: -0.42 },
  { id: 'chalmers', kind: 'person', name: 'Jim Chalmers', aliases: ['Chalmers', 'the Treasurer'], party: 'alp', role: 'Treasurer', side: 'neutral', ns: '', active: true, edited: false, source: 'seed', note: '', mentions7: 0 },
  { id: 'mca', kind: 'org', name: 'Minerals Council of Australia', aliases: ['Minerals Council', 'MCA'], party: '', role: 'Peak body, mining', side: 'client', ns: 'mca', active: true, edited: false, source: 'seed', note: '', mentions7: 48, score7: 0.12 },
  { id: 'mp_q2', kind: 'person', name: 'Barnaby Joyce', aliases: ['Barnaby Joyce'], party: 'nat', role: 'Member for New England', side: 'neutral', ns: '', active: false, edited: false, source: 'mps', note: '', mentions7: 0 },
];
const calls = []; let stepN = 0;
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = u.searchParams;
  calls.push({ p, method, body, q: Object.fromEntries(q.entries()) });
  if (p === '/sentiment/status') return { ok: true, configured: true, budget: { used: 12, cap: 300, left: 288, model: 'claude-sonnet-4-6' }, classified24: 340, classified7: 2100, skipped24: 900, total: 5000, mentions7: 3200, neg7: 1500, pos7: 700, entities: { total: 110, active: 104, people: 60, parties: 10, orgs: 28, topics: 16 }, backlog: 45, unclassifiedScanned: 400, perTick: 80, batch: 20, windowHours: 72, last: { at: NOW - 20 * 60e3 }, regions: ['au', 'nsw', 'vic'] };
  if (p === '/sentiment/entities') { let l = entities.slice(); if (q.get('kind')) l = l.filter(e => e.kind === q.get('kind')); if (q.get('platform') === 'news') l = l.map(e => Object.assign({}, e, { n: 4 })); return { ok: true, days: +q.get('days'), entities: l }; }
  if (p === '/sentiment/topics') return { ok: true, topics };
  if (p === '/sentiment/series') return { ok: true, points: Array.from({ length: 14 }, (_, i) => ({ t: NOW - (13 - i) * D, n: 5 + i, score: Math.sin(i / 3) * 0.6, neg: 2, pos: 1 })) };
  if (p === '/sentiment/items') { const st = q.get('stance'); const all = [
    { id: 1, kind: 'reddit_comment', src: 'reddit', platform: 'reddit', region: 'au', ts: NOW - 2 * H, title: '', excerpt: 'The fuel tax credit is a rort and Albanese is a sell-out.', url: 'https://reddit.com/x', tone: -0.7, type: 'opinion', issues: ['ftc'], stance: -1, intensity: 2, sarcasm: false, why: 'calls it a rort' },
    { id: 2, kind: 'news', src: 'smh', platform: 'news', region: 'nsw', ts: NOW - 5 * H, title: 'Albanese defends fuel tax credit', excerpt: 'The Prime Minister said the rebate stays.', url: 'https://smh.test/1', tone: -0.1, type: 'news', issues: ['ftc'], stance: 0, intensity: 1, sarcasm: false, why: 'reports it' },
    { id: 3, kind: 'sig_comment', src: 'bluesky', platform: 'bluesky', region: 'vic', ts: NOW - 8 * H, title: '', excerpt: 'Good on him for holding the line, credit where due.', url: 'https://bsky.app/x', tone: 0.6, type: 'opinion', issues: [], stance: 1, intensity: 1, sarcasm: false, why: 'says good on him' }];
    return { ok: true, items: st === '' || st == null ? all : all.filter(i => String(i.stance) === st || (q.get('issue') && (st === '-1' ? i.tone < -0.2 : st === '1' ? i.tone > 0.2 : Math.abs(i.tone) <= 0.2))) }; }
  if (p === '/entities' && method === 'GET') return { ok: true, entities: register, kinds: ['party', 'person', 'org', 'topic'], sides: ['client', 'opponent', 'neutral'], total: register.length };
  if (p === '/entities/test') return { ok: true, entities: [{ id: 'albanese', name: 'Anthony Albanese', kind: 'person' }, { id: 't_ftc', name: 'Fuel tax credits', kind: 'topic' }], region: 'wa' };
  if (p === '/entities/add') { const e = { id: body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), kind: body.kind, name: body.name, aliases: body.aliases, party: body.party || '', role: body.role || '', side: body.side, ns: body.ns || '', active: true, edited: true, source: 'operator', note: '', mentions7: 0 }; register.push(e); return { ok: true, added: true, entity: e }; }
  if (p === '/entities/update') { const e = register.find(x => x.id === body.id); Object.assign(e, body, { edited: true }); return { ok: true, entity: e }; }
  if (p === '/entities/delete') { register = register.filter(x => x.id !== body.id); return { ok: true, deleted: body.id }; }
  if (p === '/entities/sync-mps') return { ok: true, synced: 227 };
  if (p === '/sentiment/run') return { ok: true, job: 'js1', id: 'js1', where: 'worker' };
  if (p === '/sentiment/step') { stepN++; return { ok: true, classified: 20, mentions: 31, calls: 1, skipped: 0, errors: [], backlog: stepN === 1 ? 30 : 0, lines: [{ id: 1, ts: NOW, kind: 'info', text: '400 rows of the last 72h without a verdict; 130 mention an entity; classifying 20 in 1 call' }, { id: 2, ts: NOW, kind: 'cmd', text: 'claude claude-sonnet-4-6 batch 1: 20 texts, 31 entity mentions' }, { id: 3, ts: NOW, kind: 'out', text: '20 verdicts: 11 critical, 6 neutral, 3 supportive mentions; tone -0.31 on average' }] }; }
  if (p === '/bridge/job') return { ok: true, id: 'js1', source: 'sentiment', status: 'done', agent: '', success: true, cursor: 3, result: { ok: true, classified: 60, mentions: 95, calls: 3 }, lines: [{ id: 1, ts: NOW, kind: 'info', text: '400 rows of the last 72h without a verdict; 130 mention an entity; classifying 100 in 5 calls' }, { id: 2, ts: NOW, kind: 'cmd', text: 'claude claude-sonnet-4-6 batch 1: 20 texts, 31 entity mentions' }, { id: 3, ts: NOW, kind: 'out', text: '20 verdicts: 11 critical, 6 neutral, 3 supportive mentions; tone -0.31 on average' }] };
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
  await page.waitForFunction(() => typeof go === 'function' && typeof sentimentInit === 'function', null, { timeout: 15000 });
  await page.evaluate(() => go('sentiment'));
  await page.waitForSelector('#sentiment-root .sn-table', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const texts = (page, sel) => page.$$eval(sel, els => els.map(e => e.textContent.trim()));

console.log('sentiment-browser harness');
const page = await open('');
await t('the strip sums the week, the shares, the backlog and the budget', async () => {
  const vals = await texts(page, '.src-stat .v'); eq(vals.slice(0, 5), ['3.2K', '47%', '22%', '340', '45']); ok(/12/.test(vals[5]) && /300/.test(vals[5]));
  ok(/claude-sonnet/.test((await texts(page, '.src-stat .s'))[5]));
  ok(await page.$('#sentiment-root button:has-text("Classify now")'), 'a full key can classify');
});
await t('the leaderboard is by mentions, with bars, shares, change and channels; headers re-sort', async () => {
  const names = await texts(page, '.sn-table .sn-name .n'); eq(names.slice(0, 4).map(s => s.split(/\s{2,}|client|opponent|Person|Organisation|Topic/)[0].trim()), ['Anthony Albanese', 'Fuel tax credits', 'Minerals Council of Australia', 'Lock the Gate Alliance']);
  const first = await page.textContent('.sn-table tbody tr:first-child');
  ok(/120/.test(first) && /-0\.42/.test(first) && /55%/.test(first) && /-0\.21/.test(first) && /Reddit 6/.test(first), first);
  ok(/new/.test(await page.textContent('.sn-table tbody tr:has-text("Minerals Council")')), 'no previous window reads new');
  await page.click('.sn-table th:has-text("Net stance")');
  eq((await texts(page, '.sn-table .sn-name .n'))[0].indexOf('Anthony Albanese'), 0, 'most critical first when sorted by net stance');
  await page.click('.sn-table th:has-text("Mentions")');
});
await t('filters go to the worker and narrow the board', async () => {
  await page.selectOption('.sn-filters select[aria-label="Kind"]', 'topic');
  await page.waitForFunction(() => document.querySelector('.sn-tablewrap .sn-table tbody').children.length === 1);
  ok(calls.some(c => c.p === '/sentiment/entities' && c.q.kind === 'topic'));
  await page.selectOption('.sn-filters select[aria-label="Kind"]', '');
  await Promise.all([page.waitForResponse(r => /sentiment\/topics\?.*platform=news/.test(r.url())), page.selectOption('.sn-filters select[aria-label="Channel"]', 'news')]);
  ok(calls.some(c => c.p === '/sentiment/entities' && c.q.platform === 'news') && calls.some(c => c.p === '/sentiment/topics' && c.q.platform === 'news'), 'channel filter reached both routes');
  await page.selectOption('.sn-filters select[aria-label="Channel"]', '');
  await Promise.all([page.waitForResponse(r => /sentiment\/entities\?.*region=vic/.test(r.url())), page.selectOption('.sn-filters select[aria-label="Region"]', 'vic')]);
  ok(calls.some(c => c.p === '/sentiment/entities' && c.q.region === 'vic'), 'region filter reached the worker');
  await Promise.all([page.waitForResponse(r => /sentiment\/entities\?/.test(r.url())), page.selectOption('.sn-filters select[aria-label="Region"]', '')]);
});
await t('the topic table shows tone by client issue and who is named in it', async () => {
  const rows = await texts(page, '.sn-tablewrap:nth-of-type(2) .sn-table tbody tr, .sn-sub + .sn-tablewrap .sn-table tbody tr');
  ok(rows.length >= 2, 'topics: ' + rows.length);
  ok(/Fuel tax credits/.test(rows[0]) && /90/.test(rows[0]) && /-0\.35/.test(rows[0]) && /56%/.test(rows[0]) && /Minerals Council of Australia \+0\.12/.test(rows[0]), rows[0]);
});
await t('an entity opens the drawer: facts, the chart, channels and regions, and the rows behind the numbers', async () => {
  await page.click('.sn-table tbody tr:has-text("Anthony Albanese")');
  await page.waitForSelector('.sn-drawer');
  ok(/Anthony Albanese/.test(await page.textContent('.sn-drawertitle')));
  const facts = await page.textContent('.sn-facts'); ok(/120/.test(facts) && /-0\.42/.test(facts) && /-0\.21 vs previous 7d/.test(facts) && /55% \(66\)/.test(facts), facts);
  await page.waitForSelector('.sn-chart rect'); eq((await page.$$('.sn-chart rect')).length, 14);
  ok(/Reddit/.test(await page.textContent('.sn-mini')) && /VIC/.test(await page.textContent('.sn-drawer')));
  await page.waitForSelector('.sn-ev');
  eq((await page.$$('.sn-ev')).length, 3);
  const ev = await page.textContent('.sn-ev:first-child'); ok(/critical/.test(ev) && /"calls it a rort"/.test(ev) && /Reddit/.test(ev) && /open/.test(ev), ev);
  await page.click('.sn-chips .sn-chip:has-text("Supportive")');
  await page.waitForFunction(() => document.querySelectorAll('.sn-ev').length === 1);
  ok(/Good on him/.test(await page.textContent('.sn-ev')));
  const c = calls.filter(x => x.p === '/sentiment/items').pop(); eq(c.q.entity, 'albanese'); eq(c.q.stance, '1');
  await page.click('.sn-mini tr:has-text("Reddit")');
  const c2 = calls.filter(x => x.p === '/sentiment/items').pop(); eq(c2.q.platform, 'reddit', 'a channel row filters the evidence');
});
await t('a topic opens its own drawer with the rows and who is named', async () => {
  await page.click('.sn-row:has-text("Victorian election")');
  await page.waitForSelector('.sn-drawertitle:has-text("Victorian election")');
  ok(/client issue, The Nationals Victoria/.test(await page.textContent('.sn-drawer')));
  await page.waitForSelector('.sn-ev'); const c = calls.filter(x => x.p === '/sentiment/items').pop(); eq(c.q.issue, 'vicelection');
  await page.click('.sn-drawer button:has-text("Close")');
});
await t('Classify now runs in steps of one Claude call each and stops when nothing waits', async () => {
  await page.click('#sentiment-root button:has-text("Classify now")');
  await page.waitForSelector('.sig-con .sig-line.cmd');
  await page.waitForFunction(() => /finished/.test(document.querySelector('#sentiment-root .sig-conhead').textContent));
  ok(/claude claude-sonnet-4-6 batch 1/.test(await page.textContent('.sig-line.cmd')));
  ok(/11 critical, 6 neutral, 3 supportive/.test(await page.textContent('.sig-line.out')));
  ok(/nothing left waiting/.test(await page.textContent('.sig-conbox')));
  eq(calls.filter(c => c.p === '/sentiment/step').length, 2, 'a second step after the first reported a backlog, none after it reported zero');
  eq(calls.find(c => c.p === '/sentiment/step').body, { limit: 20 });
  ok(!calls.some(c => c.p === '/sentiment/run'), 'no job in the worker\'s shadow');
});
await t('Classify all waiting keeps stepping until the backlog is empty', async () => {
  ok(/Classify all waiting \(45\)/.test(await page.textContent('#sentiment-root .src-actions')), 'the button carries the backlog');
  const before = calls.filter(x => x.p === '/sentiment/step').length;
  await page.click('#sentiment-root button:has-text("Classify all waiting")');
  await page.waitForFunction(() => /finished/.test((document.querySelector('#sentiment-root .sig-conhead') || {}).textContent || ''));
  ok(/judging everything waiting/.test(await page.textContent('#sentiment-root .sig-conbox')));
  ok(calls.filter(x => x.p === '/sentiment/step').length > before, 'it stepped');
});
await t('the register lists entities with aliases, adds one, edits aliases, switches off, tests a sentence and syncs MPs', async () => {
  await page.click('#sentiment-root button:has-text("Entity register")');
  await page.waitForSelector('.sn-reg');
  ok((await texts(page, '.sn-reg tbody tr')).length === 4);
  ok(/Albanese \/ Albo \/ the PM/.test(await page.textContent('.sn-reg tbody tr:has-text("Anthony Albanese")')));
  ok(/from the MP register/.test(await page.textContent('.sn-reg tbody tr:has-text("Barnaby Joyce")')));
  await page.click('#sentiment-root button:has-text("Add entity")');
  await page.fill('.sn-form label:has-text("Name") input', 'Kos Samaras');
  await page.fill('.sn-form textarea', 'Kos Samaras, Samaras');
  await page.fill('.sn-form label:has-text("Role") input', 'RedBridge director');
  await page.click('.sn-form button:has-text("Save")');
  await page.waitForSelector('.sn-reg tbody tr:has-text("Kos Samaras")');
  const add = calls.find(c => c.p === '/entities/add'); eq(add.body.aliases, ['Kos Samaras', 'Samaras']); eq(add.body.kind, 'person');
  await page.click('.sn-reg tbody tr:has-text("Jim Chalmers") button:has-text("Edit")');
  await page.fill('.sn-form textarea', 'Chalmers\nthe Treasurer\nJim');
  await page.click('.sn-form button:has-text("Save")');
  await page.waitForSelector('.sn-reg tbody tr:has-text("Jim Chalmers"):has-text("Jim")');
  const upd = calls.filter(c => c.p === '/entities/update').pop(); eq(upd.body.id, 'chalmers'); eq(upd.body.aliases, ['Chalmers', 'the Treasurer', 'Jim']);
  await page.click('.sn-reg tbody tr:has-text("Anthony Albanese") button:has-text("Off")');
  await page.waitForFunction(() => { const tr = Array.from(document.querySelectorAll('.sn-reg tbody tr')).find(x => /Anthony Albanese/.test(x.textContent)); return tr && tr.textContent.indexOf('On') >= 0 && !/Off/.test(tr.querySelectorAll('button')[1].textContent); });
  await page.fill('input[placeholder^="Paste a sentence"]', 'Albo defends the fuel tax credit in Perth');
  await page.click('#sentiment-root button:has-text("Test")');
  await page.waitForSelector('.src-count:has-text("Anthony Albanese, Fuel tax credits")');
  ok(/region WA/.test(await page.textContent('.src-count:has-text("Anthony Albanese")')));
  await page.click('#sentiment-root button:has-text("Sync MPs")');
  await page.waitForSelector('.toast:has-text("members and senators")'); ok(/227 members and senators/.test(await page.textContent('.toast:has-text("members and senators")')), 'sync toast');
});
if (process.env.SHOT) { await page.click('#sentiment-root button:has-text("Back to the table")'); await page.waitForSelector('.sn-table'); await page.click('.sn-table tbody tr:has-text("Anthony Albanese")'); await page.waitForSelector('.sn-ev'); await page.screenshot({ path: 'shot-sentiment.png' }); }
await page.close();
await t('a read-only key sees the sums, the rows and the register, but nothing that changes them', async () => {
  const p2 = await open('read');
  ok(!(await p2.$('#sentiment-root button:has-text("Classify now")')));
  await p2.click('#sentiment-root button:has-text("Entity register")'); await p2.waitForSelector('.sn-reg');
  ok(!(await p2.$('#sentiment-root button:has-text("Add entity")')) && !(await p2.$('#sentiment-root button:has-text("Sync MPs")')) && !(await p2.$('.sn-reg button:has-text("Edit")')));
  ok(await p2.$('#sentiment-root button:has-text("Test")'), 'testing a sentence is a read');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
