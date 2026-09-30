/* Content Desk browser harness: serves docs/ statically, stubs the worker with
 * page.route, opens the island and drives it - client header, campaign and
 * platform chips, Write, the pieces and their checks, the chat revise with a
 * remembered rule, Ask the Desk, Approve, the Voice profile and Learned panels,
 * and the read-only key. Run: node content-browser.mjs */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PORT = 8765, W = 'https://newsaus.heshan-998.workers.dev';
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:' + PORT + '/index.html'); if (r.ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }

const kit = { ns: 'mca', name: 'Minerals Council of Australia', voice: 'Plain, factual.', rules: 'ALWAYS: mining, not resources.', updated: Date.now() - 3600e3, by: 'Hesh', hasLogo: false,
  campaigns: [{ id: 'national', name: "That's the difference Australian mining makes (national tax and contribution)", signoff: "That's the difference Australian mining makes.", cta: 'Learn more: thatsmining.com.au', active: true }, { id: 'hoof', name: 'Hands Off Our Fuel (Fuel Tax Credit Alliance)', signoff: 'Hands Off Our Fuel.', active: true }, { id: 'vgo', name: "Victoria's Golden Opportunity (Victorian election 2026, bipartisan)", signoff: "Unlock Victoria's golden opportunity.", active: true }, { id: 'old', name: 'Retired', active: false }],
  facts: [{ id: 'tax74', text: 'The mining industry paid $74 billion in tax and royalties in one year.', source: 'ATO', status: 'approved', campaign: 'national' }, { id: 'tax30pc', text: 'Mining paid 30 per cent of all company taxes.', source: 'ATO', status: 'approved' }, { id: 'gdp276', text: 'Pending figure.', status: 'pending' }],
  banned: [{ term: 'subsidy', use: 'a refund of road tax', allowNegated: true }], platforms: {}, segments: [{ id: 's6', name: 'Segment 6 - No-Nonsense Talkback Conservatives', who: 'Older, regional', themes: 'Medicare' }], people: [] };
const items = [
  { n: 0, platform: 'facebook', title: '', body: 'Did you know the latest government data shows the mining industry paid $74 billion in tax and royalties in one year?\n\nThat\'s the difference Australian mining makes.', cta: 'Learn more: thatsmining.com.au', link: 'thatsmining.com.au', hashtags: [], factIds: ['tax74'], note: 'the tax fact', verdict: '', revisions: 0, check: { ok: true, flags: [], missing: [], banned: [], chars: 140, max: 900 } },
  { n: 1, platform: 'facebook', title: '', body: 'Mining paid $99 billion last year.\n\nThat\'s the difference Australian mining makes.', cta: '', link: '', hashtags: [], factIds: [], note: 'the wrong fact', verdict: '', revisions: 0, check: { ok: false, flags: ['unverified_figure'], missing: ['99'], banned: [], chars: 80, max: 900 } },
  { n: 2, platform: 'linkedin', title: '', body: 'Fuel Tax Credits are a subsidy farmers rely on.', cta: '', link: '', hashtags: [], factIds: [], note: 'oops', verdict: '', revisions: 0, check: { ok: false, flags: ['banned_term'], missing: [], banned: ['subsidy'], chars: 47, max: 900 } },
];
let set = null; const fixes = [{ id: 'f1', ns: 'mca', task: 'copy', scope: 'client', rule: 'Write "Minerals Council" with the plural.', active: true, hits: 3, created: Date.now() - 86400e3, who: 'Hesh', source: 'voice-pack:fixes.json', why: 'Dee: Minerals not Mineral.' }];
const calls = [];
const stub = (url, method, body) => {
  const u = new URL(url); const p = u.pathname; const q = u.searchParams;
  calls.push({ p, method, body });
  if (p === '/brand/kit' && method === 'GET') return q.get('ns') === 'mca' ? { ok: true, ns: 'mca', kit, hasLogo: false, logoUrl: '' } : { ok: true, ns: q.get('ns'), kit: null, hasLogo: false, logoUrl: '' };
  if (p === '/engine/status') return { ok: true, ns: q.get('ns'), fixes: { total: 1, inForce: 1, applied: 3 }, outcomes: { approved: 0, killed: 0 }, artworks: 0, mind: q.get('ns') === 'mca' ? [{ kind: 'copy', n: 9 }, { kind: 'brief', n: 1 }, { kind: 'news', n: 400 }] : [] };
  if (p === '/engine/fixes') return { ok: true, fixes: q.get('ns') === 'mca' ? fixes : [], inForce: fixes.filter(f => f.active).length };
  if (p === '/engine/fix/update') { const f = fixes.find(x => x.id === body.id); if (f) f.active = !!body.active; return { ok: true }; }
  if (p === '/content/platforms') return { ok: true, platforms: { facebook: { label: 'Facebook', max: 900 }, instagram: { label: 'Instagram', max: 700 }, linkedin: { label: 'LinkedIn', max: 900 }, x: { label: 'X', max: 280 }, tiktok: { label: 'TikTok', max: 300 }, reddit: { label: 'Reddit', max: 2500, title: true }, youtube: { label: 'YouTube', max: 1200, title: true }, spotify: { label: 'Spotify audio', max: 700, script: true }, email: { label: 'Email', max: 1800, title: true } } };
  if (p === '/content/list') return { ok: true, sets: set ? [{ id: set.id, campaign: set.campaign, brief: set.brief, platforms: set.platforms, pieces: set.items.length, flagged: 2, approved: set.items.filter(i => i.verdict === 'approved').length, status: 'written', who: 'Hesh', created: set.created }] : [] };
  if (p === '/release/list') return { ok: true, packs: [{ id: 'p1', title: 'Migration plan gets resource skills priority right', status: 'rendered', tiles: 6, rendered: 6, created: Date.now() - 7200e3 }] };
  if (p === '/content/generate') { set = { id: 'c1', ns: 'mca', campaign: body.campaign, segment: body.segment, brief: body.brief, source: '', platforms: body.platforms, items: JSON.parse(JSON.stringify(items)), status: 'written', job: 'j1', who: 'Hesh', history: [], created: Date.now(), updated: Date.now() }; return { ok: true, id: 'c1', job: 'j1', ns: 'mca', platforms: body.platforms }; }
  if (p === '/bridge/job') return { status: 'done', success: true, source: 'content', agent: '', cursor: 3, result: { ok: true, pieces: 3 }, lines: [{ id: 1, ts: Date.now(), kind: 'info', text: 'job j1 created: content (running in the worker)' }, { id: 2, ts: Date.now(), kind: 'out', text: 'voice profile: campaign "Hands Off Our Fuel", 2 approved facts, 1 banned term' }, { id: 3, ts: Date.now(), kind: 'out', text: '3 pieces: facebook x2, linkedin x1 - 2 flagged' }] };
  if (p === '/content/set') return set ? { ok: true, set } : { error: 'unknown_set' };
  if (p === '/content/revise') {
    const targets = body.n == null ? set.items : set.items.filter(i => i.n === body.n);
    targets.forEach(i => { i.body = i.body.replace(/\$99 billion/, '30 per cent of all company taxes').replace(/a subsidy/, 'not a subsidy'); i.revisions++; i.check = { ok: true, flags: [], missing: [], banned: [], chars: i.body.length, max: 900 }; });
    const standing = /always|never|per cent/i.test(body.instruction);
    const fix = standing && body.remember !== 'never' ? { id: 'f2', rule: 'Write per cent in body copy, never the % sign.' } : null;
    if (fix) fixes.unshift({ id: 'f2', ns: 'mca', task: 'copy', scope: 'client', rule: fix.rule, active: true, hits: 0, created: Date.now(), who: 'Hesh', source: 'content:c1', why: body.instruction });
    set.history.push({ ts: Date.now(), who: 'Hesh', n: body.n, instruction: body.instruction, note: 'Changed ' + targets.length + ' piece' + (targets.length === 1 ? '' : 's') + '.', changed: targets.map(i => i.n), ruleId: fix ? fix.id : '', rule: fix ? fix.rule : '', standing, confidence: standing ? 0.9 : 0.1 });
    return { ok: true, set, changed: targets.map(i => i.n), note: 'ok', remembered: fix, memory: { standing, confidence: standing ? 0.9 : 0.1, rule: fix ? fix.rule : '' } };
  }
  if (p === '/content/update') { const i = set.items.find(x => x.n === body.n); Object.assign(i, body.patch); return { ok: true, item: i }; }
  if (p === '/content/verdict') { const i = set.items.find(x => x.n === body.n); i.verdict = body.verdict; return { ok: true, item: i }; }
  if (p === '/brand/kit' && method === 'POST') { Object.assign(kit, body, { updated: Date.now() }); return { ok: true, ns: 'mca', kit, hasLogo: false, logoUrl: '' }; }
  return { ok: true };
};

const browser = await chromium.launch();
async function openDesk(role) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + e.message.slice(0, 160)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'test-key'); localStorage.setItem('axiom_client_active', 'mca'); if (role) window.AX_ROLE = role; }, { W, role });
  // the catch-all for other hosts is registered first: later routes win, so the worker stub takes precedence
  await page.route(/^https:\/\/(?!newsaus\.)(?!127\.0\.0\.1)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route(W + '/**', async route => { const r = route.request(); let body = null; try { body = r.postDataJSON(); } catch (e) {} await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub(r.url(), r.method(), body)) }); });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof contentInit === 'function', null, { timeout: 15000 });
  await page.evaluate(() => go('content'));
  await page.waitForSelector('#content-root .cd-head', { timeout: 15000 });
  return page;
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 2).join('\n       ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };

console.log('content-browser harness');
const page = await openDesk('');
await t('the header says who we write as and what the Desk knows', async () => {
  const head = await page.textContent('.cd-head');
  ok(/Writing as\s*Minerals Council of Australia/.test(head.replace(/\s+/g, ' ')), head);
  ok(/3 campaigns/.test(head) && /2 approved facts/.test(head) && /1 correction in force/.test(head) && /9 examples in the Mind/.test(head), 'stats: ' + head.replace(/\s+/g, ' '));
  ok(!(await page.$('.cd-warn')), 'no warning when a profile exists');
});
await t('campaign chips come from the kit (active only) and the first is preselected', async () => {
  const chips = await page.$$eval('.cd-setup .cd-campaigns .cd-chip', els => els.map(e => [e.textContent, e.classList.contains('on')]));
  eq(chips.length, 4, 'General + 3 active campaigns'); eq(chips[0][0], 'General'); ok(/That's the difference/.test(chips[1][0]) && chips[1][1], 'national preselected: ' + JSON.stringify(chips));
  ok(!chips.some(c => /Retired/.test(c[0])), 'retired campaign hidden');
  await page.click('.cd-campaigns .cd-chip:has-text("Hands Off Our Fuel")');
  ok(await page.$eval('.cd-campaigns .cd-chip:has-text("Hands Off Our Fuel")', e => e.classList.contains('on')), 'HOOF selected');
});
await t('platform chips toggle, at least one stays on', async () => {
  const on = await page.$$eval('.cd-setup .cd-platforms .cd-chip.on', els => els.map(e => e.textContent));
  eq(on, ['Facebook', 'LinkedIn']);
  await page.click('.cd-platforms .cd-chip:has-text("Instagram")');
  await page.click('.cd-platforms .cd-chip:has-text("LinkedIn")');
  eq(await page.$$eval('.cd-setup .cd-platforms .cd-chip.on', els => els.map(e => e.textContent)), ['Facebook', 'Instagram']);
  await page.click('.cd-platforms .cd-chip:has-text("LinkedIn")');
  ok(/Write 6 pieces/.test(await page.textContent('.cd-setup .btn.sm:not(.ghost)')), 'button counts platforms x pieces');
});
await t('Write is disabled until there is a brief, then it runs the job and shows the pieces grouped by platform', async () => {
  ok(await page.$eval('.cd-setup .btn.sm:not(.ghost)', e => e.disabled), 'disabled with no brief');
  await page.fill('.cd-brief', 'The petition passed 20,000 signatures - thank the signers and ask for one more push.');
  ok(!(await page.$eval('.cd-setup .btn.sm:not(.ghost)', e => e.disabled)), 'enabled with a brief');
  await page.selectOption('select[aria-label="Audience"]', 's6');
  await page.click('.cd-setup .btn.sm:not(.ghost)');
  await page.waitForSelector('.cd-piece', { timeout: 15000 });
  const gen = calls.find(c => c.p === '/content/generate');
  eq(gen.body.campaign, 'hoof'); eq(gen.body.segment, 's6'); eq(gen.body.platforms, ['facebook', 'instagram', 'linkedin']); eq(gen.body.n, 2);
  eq(await page.$$eval('.cd-piece', els => els.length), 3);
  eq(await page.$$eval('.cd-grouphead b', els => els.map(e => e.textContent)), ['Facebook', 'LinkedIn']);
  ok(/voice profile: campaign "Hands Off Our Fuel"/.test(await page.textContent('.sig-conbox')), 'console shows the profile line');
  ok(/3 pieces written for MCA/.test(await page.textContent('.rd-res')), 'result line');
});
await t('checks show as chips: traced, unverified figure, banned term', async () => {
  const chips = await page.$$eval('.cd-piece', els => els.map(e => Array.from(e.querySelectorAll('.rel-chk')).map(c => c.textContent)));
  eq(chips[0], ['checks passed']); ok(/figure not in facts or source: 99/.test(chips[1][0]), chips[1][0]); ok(/banned term: subsidy/.test(chips[2][0]), chips[2][0]);
  ok(/2 flagged/.test(await page.textContent('.cd-pieces .phead')), 'set header counts flagged');
});
await t('the chat revises every piece and shows the remembered rule', async () => {
  if (process.env.SHOT) await page.screenshot({ path: 'shot-desk-written.png', fullPage: true });
  await page.fill('.cd-input', 'Always write per cent instead of the % sign');
  await page.press('.cd-input', 'Enter');
  await page.waitForSelector('.cd-remember', { timeout: 10000 });
  if (process.env.SHOT) { await page.screenshot({ path: 'shot-desk-remembered.png', fullPage: true }); await page.locator('.cd-main').screenshot({ path: 'shot-desk-main.png' }); }
  const rev = calls.filter(c => c.p === '/content/revise').pop();
  eq(rev.body.n, null); eq(rev.body.remember, 'auto'); eq(rev.body.instruction, 'Always write per cent instead of the % sign');
  ok(/Remembered for MCA: Write per cent in body copy/.test(await page.textContent('.cd-remember')), await page.textContent('.cd-remember'));
  eq(await page.$$eval('.cd-piece .rel-chk.warn', els => els.length), 0, 'no more flags after the revise');
  ok(/2 corrections in force/.test(await page.textContent('.cd-head')), 'header refreshed the count');
  ok(/1 edit/.test(await page.textContent('.cd-piece')), 'edit count chip');
});
await t('Ask the Desk targets one piece; a one-off instruction is marked as applied to this set only', async () => {
  await page.click('.cd-piece:nth-child(2) .btn:has-text("Ask the Desk")');
  eq(await page.inputValue('select[aria-label="Which pieces"]'), '1');
  ok(await page.$eval('.cd-piece:nth-child(2)', e => e.classList.contains('on')), 'piece highlighted');
  await page.fill('.cd-input', 'Lead with the Bendigo figure');
  await page.click('.cd-compose .btn.sm');
  await page.waitForFunction(() => document.querySelectorAll('.cd-msg.user').length === 2, null, { timeout: 10000 });
  const rev = calls.filter(c => c.p === '/content/revise').pop(); eq(rev.body.n, 1);
  const desk = await page.$$eval('.cd-msg.desk', els => els.map(e => e.textContent));
  ok(/Applied to this set only/.test(desk[desk.length - 1]), desk[desk.length - 1]);
});
await t('quick chips send an instruction; the remember select is honoured', async () => {
  await page.selectOption('select[aria-label="Remember"]', 'never');
  await page.click('.cd-qchip:has-text("Shorter")');
  await page.waitForFunction(() => document.querySelectorAll('.cd-msg.user').length === 3, null, { timeout: 10000 });
  const rev = calls.filter(c => c.p === '/content/revise').pop(); eq(rev.body.instruction, 'Shorter'); eq(rev.body.remember, 'never');
});
await t('Approve records a verdict and marks the card', async () => {
  await page.click('.cd-piece:nth-child(1) .btn:has-text("Approve")');
  await page.waitForSelector('.cd-piece.approved', { timeout: 5000 });
  const v = calls.filter(c => c.p === '/content/verdict').pop(); eq(v.body.n, 0); eq(v.body.verdict, 'approved');
  ok(/Approved/.test(await page.textContent('.cd-piece:nth-child(1) .cd-acts')), 'button reads Approved');
});
await t('Edit saves a hand edit through /content/update', async () => {
  await page.click('.cd-piece:nth-child(1) .btn:has-text("Edit")');
  await page.fill('.cd-piece:nth-child(1) textarea.cd-body', 'Hand-edited body. Hands Off Our Fuel.');
  await page.click('.cd-piece:nth-child(1) .btn:has-text("Save")');
  await page.waitForFunction(() => /Hand-edited body/.test(document.querySelector('.cd-piece .cd-text').textContent), null, { timeout: 5000 });
  const u = calls.filter(c => c.p === '/content/update').pop(); eq(u.body.n, 0); eq(u.body.patch.body, 'Hand-edited body. Hands Off Our Fuel.');
});
await t('the Voice profile panel shows campaigns, facts and banned terms and saves them', async () => {
  await page.click('.cd-head .btn:has-text("Voice profile")');
  await page.waitForSelector('.cd-voice');
  ok(/Voice profile - MCA/.test(await page.textContent('.cd-voice .ptitle')));
  await page.click('.cd-voice .tp-tab:has-text("Approved facts (3)")');
  eq(await page.$$eval('.cd-fact', els => els.length), 3);
  ok(/pending/.test(await page.textContent('.cd-fact:nth-child(4) .btn')), 'third fact shows pending: ' + await page.textContent('.cd-voice .cd-list'));
  await page.click('.cd-voice .tp-tab:has-text("Never say (1)")');
  eq(await page.inputValue('.cd-ban input[placeholder="Never say"]'), 'subsidy');
  await page.click('.cd-voice .tp-tab:has-text("Campaigns (4)")');
  await page.click('.cd-row:nth-child(2) .cd-rowhead');
  eq(await page.inputValue('.cd-row.open input[placeholder="Sign-off line"]'), 'Hands Off Our Fuel.');
  if (process.env.SHOT) await page.screenshot({ path: 'shot-desk-voice.png', clip: { x: 0, y: 0, width: 1400, height: 1000 } });
  await page.fill('.cd-row.open input[placeholder="Sign-off line"]', 'Hands Off Our Fuel. Sign the petition.');
  await page.click('.cd-voice .btn:has-text("Save voice profile")');
  await page.waitForFunction(() => document.querySelector('.toast') && /Voice profile saved/.test(document.querySelector('.toast').textContent), null, { timeout: 5000 });
  const k = calls.filter(c => c.p === '/brand/kit' && c.method === 'POST').pop();
  eq(k.body.campaigns.find(c => c.id === 'hoof').signoff, 'Hands Off Our Fuel. Sign the petition.'); eq(k.body.facts.length, 3); eq(k.body.banned.length, 1); ok(!('palette' in k.body), 'the words panel never touches the palette');
  await page.click('.cd-voice .btn:has-text("Close")');
});
await t('the Learned panel lists copy rules and can switch one off', async () => {
  await page.click('.cd-head .btn:has-text("learned")');
  await page.waitForSelector('.rel-fix');
  eq(await page.$$eval('.rel-fix', els => els.length), 2);
  await page.click('.rel-fix:nth-child(1) .btn:has-text("Switch off")');
  await page.waitForSelector('.rel-fix.off');
  const u = calls.filter(c => c.p === '/engine/fix/update').pop(); eq(u.body.active, false);
});
await t('recent sets list the set and reopen it with its thread', async () => {
  ok(/Recent sets - MCA/.test(await page.textContent('body')));
  await page.click('.rel-histrow');
  await page.waitForSelector('.cd-piece');
  eq(await page.$$eval('.cd-msg.user', els => els.length), 3, 'history restored from the set');
});
await t('switching client shows the empty profile warning', async () => {
  await page.selectOption('select[aria-label="Client"]', 'aep');
  await page.waitForSelector('.cd-warn', { timeout: 10000 });
  ok(/No voice profile for AEP yet/.test(await page.textContent('.cd-warn')));
  ok(/0 campaigns/.test(await page.textContent('.cd-head')));
});
await page.close();
await t('a read-only key can read but not write', async () => {
  const p2 = await openDesk('read');
  ok(/read-only key: you can read sets, not write them/.test(await p2.textContent('.cd-setup')), 'no Write button');
  await p2.click('.rel-histrow');
  await p2.waitForSelector('.cd-piece');
  ok(!(await p2.$('.cd-piece .btn:has-text("Approve")')), 'no approve');
  ok(/read-only key: you can read the thread/.test(await p2.textContent('.cd-chat')), 'chat is read-only');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
