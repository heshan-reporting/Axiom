/* Creative Studio Phase 2 in a real browser, end to end: the page's worker calls are routed
 * into the worker module running in this process (SQLite behind the D1 API, stub Claude and
 * Gemini that answer by what the prompt asks), so the journey - release in, ledger, copy per
 * channel, compositions drawn by the one renderer, hand edits without a render, approvals,
 * export of the approved versions - runs against the real routes and the real page.
 * Run: node --experimental-sqlite tests/studio-browser.mjs   (SHOT=1 screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
const PORT = 8776, W = 'https://newsaus.heshan-998.workers.dev';
const kv = new Map(); const r2 = new Map(); const calls = { gemini: 0, anthropic: 0 };
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => (typeof r2.get(k).v === 'string' ? new TextEncoder().encode(r2.get(k).v).buffer : r2.get(k).v), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
// a real 4x4 PNG (teal) so the browser can decode the background and the logo
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const RELEASE = 'MEDIA RELEASE - 30 September 2026\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.\n\nMCA Chief Executive Officer Tania Constable said fuel tax credits were not a subsidy. "Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.\n\nThe analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators.\n\nENDS';
const LEDGER = { headline: 'Fuel tax credits keep regional Australia moving', claims: [
  { text: 'mining paid $74 billion in company tax and royalties in 2023-24', value: 74, unit: 'billion', subject: 'tax and royalties', period: '2023-24', passage: 'p3' },
  { text: 'Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply', quote: true, who: 'Tania Constable', passage: 'p4' },
  { text: 'the credit is used by more than 150,000 businesses of all sizes', value: 150000, unit: 'businesses', passage: 'p5' },
  { text: 'the credit is worth $9 billion a year', value: 9, unit: 'billion', passage: 'p5' }],
  brief: { objective: 'Answer the subsidy framing while the credit is in the news', audience: 'Members and MPs; the public on Instagram and Facebook', message: 'The credit is not a subsidy', deliverables: 'Organic posts' } };
const DIRS = { directions: [
  { title: 'The plain ask', message: 'The credit is not a subsidy; it returns a tax that never applied.', insight: 'Subsidy sounds like a handout.', headline: 'Not a subsidy. A tax that never applied.', opening: 'Fuel tax credits are not a subsidy.', visual: 'Restrained documentary photography', rationale: 'Plain language', claims: ['c1'], uncertainty: 'No figure for the credit itself' },
  { title: 'Who it really is', message: 'The credit is used by 150,000 businesses of all sizes.', insight: 'Naming tradies moves the frame.', headline: 'Farmers. Tradies. Tourism operators.', opening: 'Who uses the fuel tax credit?', visual: 'A tradie at a rural bowser', rationale: 'Approved usage wording', claims: ['c3'], uncertainty: 'Portraits need releases' }] };
const pieces = user => ({ pieces: ['linkedin', 'facebook', 'instagram', 'x'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: c === 'instagram' ? 'Who uses the fuel tax credit? Farmers, tradies and tourism operators across regional Australia do' : 'Not a subsidy. A tax that never applied.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry. Hands Off Our Fuel.', alt: 'Teal fact panel over a harvester at dusk', visual: 'Harvester at dusk, restrained', claims: ['c1'], hashtags: [] })) });
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gemini++; if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/models') >= 0) return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    calls.anthropic++; const body = JSON.parse(init.body); const sys = String(body.system || ''), user = String(body.messages[0].content || '');
    const answer = /build a claim ledger/.test(sys) ? LEDGER : /genuinely different directions/.test(sys) ? DIRS : /producing a coordinated set/.test(sys) ? pieces(user) : {};
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function api(method, path, body, key = 'full-key') {
  const r = new Request(W + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); return res.json();
}
// seed: the MCA kit with a logo, one learned rule, one legacy release pack
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, rules: 'Label the answer Fact, never Busted.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }], facts: [{ text: 'Mining directly employs more than 300,000 Australians', source: 'ABS' }], banned: [{ term: 'subsidy', allowNegated: true, use: 'credit' }], logoB64: PNG, logoMime: 'image/png' });
await api('GET', '/engine/status?ns=mca'); await api('GET', '/studio/status');
env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f1','mca','copy','client','','','','Say more than any other industry, never more than all other industries combined','','pack','Dee',1000,1,0)").run();
await api('GET', '/release/list?ns=mca');
env.MIND_DB.db.prepare("INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES('rp1','mca','Critical minerals reserve','Release text here about a strategic reserve.','{\"headline\":\"Reserve\",\"claims\":[\"Australia holds the minerals\"],\"numbers\":[],\"quotes\":[]}','[{\"n\":0,\"kind\":\"lead\",\"headline\":\"Critical minerals need a reserve\",\"support\":\"x\",\"cta\":\"Learn more\",\"captions\":{\"linkedin\":\"A reserve.\"},\"alt\":\"tile\",\"image\":{\"ver\":1,\"model\":\"gemini-2.5-flash-image\"},\"verdict\":\"approved\"}]','rendered','','Dee','square',1000,2000)").run();
r2.set('packs/rp1/0.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const texts = async (page, sel) => (await page.$$eval(sel, els => els.map(e => e.textContent.trim())));
const browser = await chromium.launch();
async function open(role) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', role === 'read' ? 'read-key' : 'full-key'); if (role) window.AX_ROLE = role; }, { W, role });
  // the page's worker calls go to the module in this process; other hosts (fonts, charts) are dropped
  await page.route(/^https:\/\/(?!127\.0\.0\.1)[^/]+\//, async route => {
    const rq = route.request(); const u = rq.url();
    if (!u.startsWith(W)) return route.abort();
    const headers = rq.headers(); const body = rq.postDataBuffer();
    const res = await handler.fetch(new Request(u, { method: rq.method(), headers, body: body && rq.method() !== 'GET' ? body : undefined }), env, ctx);
    const h = {}; res.headers.forEach((v, k) => { h[k] = v; });
    return route.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && window.AXUI && window.STRender && typeof studioInit === 'function');
  await page.evaluate(() => go('studio'));
  await page.waitForSelector('#studio-root .st-head');
  return page;
}
const R = '#studio-root ';
const shot = async (page, name) => { if (process.env.SHOT) await page.screenshot({ path: new URL('./shot-' + name + '.png', import.meta.url).pathname, fullPage: false }); };
const canvasPng = page => page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas'); return c ? c.toDataURL('image/png') : ''; });
console.log('studio-browser harness (Phase 2, through the worker module)');
const page = await open();

await t('the library opens on the client from the worker: nothing yet for MCA except the legacy pack, the backend build named', async () => {
  await page.waitForSelector(R + '.st-lib tbody tr, ' + R + '.ov-empty');
  ok(/Creative Studio/.test(await page.textContent(R + '.st-head'))); eq(await page.inputValue(R + '.st-head select'), 'mca');
  await page.waitForFunction(() => /Backend build/.test(document.querySelector('#studio-root .st-lib').textContent));
  ok(/studio-p2/.test(await page.textContent(R + '.st-head')), 'the build chip');
  const rows = await texts(page, R + '.st-lib tbody tr'); eq(rows.length, 1); ok(/Critical minerals reserve/.test(rows[0]) && /legacy release pack, read-only/.test(rows[0]), rows[0]);
});
await t('a release with a clear instruction: the source is read into a ledger, no direction step, copy adapted per channel, compositions laid out, renders queued and run as jobs', async () => {
  const g0 = calls.gemini;
  await page.click(R + '.st-lib-head .btn');
  await page.waitForSelector(R + '.st-intake');
  eq(await page.inputValue(R + '.st-intake select'), 'hoof', 'the campaign comes from the kit');
  await page.fill(R + '.st-intake textarea', RELEASE);
  await page.fill(R + '.st-intake input.st-in', 'Three posts on the $74 billion figure');
  ok(/no direction step/.test(await page.textContent(R + '.st-intake-foot')));
  await page.click(R + '.st-segbtn:has-text("X 16:9")');   // four channels
  await shot(page, 'studio-intake');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-asset', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-railbtn.asset').length === 4, null, { timeout: 30000 });
  const th = await page.textContent(R + '.st-thread');
  ok(/Read Pasted release: 3 figures, 1 quotations/.test(th) && /marked unverified/.test(th) && /brief was proposed/.test(th), th.slice(0, 600));
  ok(/Produced 4 assets: LinkedIn 1:1, Instagram 4:5, Facebook 1:1, X 16:9/.test(th) && /editable teal fact panels with the kit logo placed exactly; 4 background renders queued/.test(th), th);
  ok(await page.$(R + '.st-step.skipped'), 'directions marked skipped');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-thread').textContent.match(/Render finished/g) || []).length === 4, null, { timeout: 60000 });
  eq(calls.gemini - g0, 4, 'four renders spent, one per asset');
  ok(/render spent/.test(await page.textContent(R + '.st-thread')));
  await shot(page, 'studio-produced');
});
await t('the sources view shows the ledger tied to passages, with what the source does not carry marked; the brief shows the proposed fields', async () => {
  await page.click(R + '.st-railbtn:has-text("Sources")');
  await page.waitForSelector(R + '.st-ledger');
  const rows = await texts(page, R + '.st-ledger tbody tr'); ok(rows.length >= 4, String(rows.length));
  ok(rows.some(r => /74 billion|74,000,000,000|74 billion/.test(r) && /2023-24/.test(r) && /p3/.test(r)), JSON.stringify(rows));
  ok(rows.some(r => /worth \$9 billion/.test(r) && /unverified/.test(r) && /not in the source text/.test(r)), 'the invented figure is marked');
  await page.click(R + '.st-ledger tbody tr:first-child summary');
  ok(/mining paid \$74 billion/.test(await page.textContent(R + '.st-passage')));
  await page.click(R + '.st-railbtn:has-text("Brief")');
  await page.waitForSelector(R + '.st-ul');
  ok(/proposed by the Studio/.test(await page.textContent(R + '.st-centre')) && /proposed from the source by the Studio/.test(await page.textContent(R + '.st-ul')));
  eq(await page.inputValue(R + '.st-field textarea'), 'Answer the subsidy framing while the credit is in the news');
});
await t('the asset preview is drawn by the one renderer; the checks read the ledger; a headline edit makes a text version that changes the preview with no image-model call and keeps the image', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")');
  await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /gemini-3-pro-image/.test(document.querySelector('#studio-root .st-comp-tag').textContent));
  ok(/editable composition, teal fact panel/.test(await page.textContent(R + '.st-comp-tag')));
  ok(/kit logo placed exactly/.test(await page.textContent(R + '.st-copy')), 'the layout line names the exact logo');
  const checks = (await page.textContent(R + '.st-checks')).replace(/\s+/g, ' '); ok(/matches source \$74 billion matches the source, p3, 2023-24/.test(checks), checks);
  await new Promise(r => setTimeout(r, 400));
  const before = await canvasPng(page); const g0 = calls.gemini; const head0 = await page.textContent(R + '.st-asset-head');
  ok(/v2 of 2/.test(head0), head0);
  await page.fill(R + '.st-field:nth-of-type(1) input', 'Fuel tax credits are not a subsidy.');
  await page.waitForFunction(() => /v3 of 3/.test(document.querySelector('#studio-root .st-asset-head').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => /Text change on Facebook post: hand edit: headline \(no render\)/.test(document.querySelector('#studio-root .st-thread').textContent));
  await new Promise(r => setTimeout(r, 400));
  const after = await canvasPng(page);
  ok(before && after && before !== after, 'the preview changed with the headline');
  eq(calls.gemini, g0, 'no image-model call for a text change');
  ok(/gemini-3-pro-image/.test(await page.textContent(R + '.st-comp-tag')), 'the background is still the rendered one');
  const c2 = (await page.textContent(R + '.st-checks')).replace(/\s+/g, ' '); ok(!/banned term subsidy/.test(c2), '"not a subsidy" is a negation, allowed: ' + c2);
  await shot(page, 'studio-asset');
});
await t('a layout change (headline smaller) is a layout version, no render; a long headline is flagged as overflow at 4:5 on the Instagram portrait', async () => {
  const g0 = calls.gemini;
  await page.click(R + '.ov-link:has-text("headline smaller")');
  await page.waitForFunction(() => /v4 of 4/.test(document.querySelector('#studio-root .st-asset-head').textContent), null, { timeout: 15000 });
  ok(/headline smaller/.test(await page.textContent(R + '.st-asset-head'))); eq(calls.gemini, g0);
  await page.click(R + '.st-railbtn.asset:has-text("Instagram portrait")');
  await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /overflow/.test(document.querySelector('#studio-root .st-checks').textContent));
  ok(/needs \d+ lines at this size/.test(await page.textContent(R + '.st-checks')));
});
await t('approvals per component with reasons; a copy edit drops the copy approval and leaves design; export includes only the fully approved asset, draws it with the renderer, records the export and downloads the bundle', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")');
  await page.waitForSelector(R + '.st-approve');
  await page.click(R + '.st-appr button:has-text("Approve copy")');
  await page.waitForSelector(R + '.st-dialog'); ok(/never as performance/.test(await page.textContent(R + '.st-dialog')));
  await page.fill(R + '.st-dialog textarea', 'client asked for the plain ask'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForFunction(() => /approved.*client asked for the plain ask/.test(document.querySelector('#studio-root .st-approve').textContent));
  await page.click(R + '.st-appr button:has-text("Approve design")');
  await page.fill(R + '.st-dialog textarea', 'fine as is'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-approve').textContent.match(/approved/g) || []).length === 2);
  await page.fill(R + '.st-field:nth-of-type(3) input', 'Learn more today');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-approve').textContent.match(/approved/g) || []).length === 1, null, { timeout: 15000 });
  ok(/design.*approved/.test(await page.textContent(R + '.st-approve')) && /unchanged since, so it stands/.test(await page.textContent(R + '.st-approve')), 'design carried, copy dropped');
  await page.click(R + '.st-appr button:has-text("Approve copy")');
  await page.fill(R + '.st-dialog textarea', 'ok after the CTA'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-approve').textContent.match(/approved/g) || []).length === 2);
  await page.click(R + '.st-head button:has-text("Export")');
  await page.waitForSelector(R + '.st-dialog');
  const rows = await texts(page, R + '.st-dialog tbody tr'); eq(rows.filter(r => /included/.test(r)).length, 1); ok(/Facebook post/.test(rows.find(r => /included/.test(r))));
  ok(/Export never creates a task or sends anything by itself/.test(await page.textContent(R + '.st-dialog')));
  await shot(page, 'studio-export');
  await page.click(R + '.st-dialog button:has-text("Download bundle")');
  await page.waitForFunction(() => window.__studioLastExport, null, { timeout: 30000 });
  const ex = await page.evaluate(() => window.__studioLastExport);
  ok(ex.files.some(f => /Facebook_post-v\d\.png/.test(f)) && ex.files.indexOf('copy-sheet.txt') >= 0 && ex.files.indexOf('manifest.json') >= 0, JSON.stringify(ex.files));
  ok(ex.manifest && ex.manifest.export && ex.manifest.included.length === 1 && ex.manifest.included[0].exportKey, 'the export stage recorded the browser-rendered PNG: ' + JSON.stringify(ex.manifest).slice(0, 300));
  ok(Array.from(r2.keys()).some(k => /-export\.png$/.test(k)), 'the composition PNG is in R2');
  ok(/Bundle downloaded/.test(await page.textContent(R + '.st-dialog')));
  await page.click(R + '.st-dialog button:has-text("Send to ClickUp")');
  await page.waitForSelector(R + '.st-dialog-box.narrow'); ok(/Create 1 task/.test(await page.textContent(R + '.st-dialog-box.narrow')));
  await page.click(R + '.st-dialog-box.narrow button:has-text("Cancel")');
  await page.waitForSelector(R + '.st-dialog', { state: 'detached' });
});
await t('the jobs view lists every job with its log; the client context lists the kit, the facts, the banned terms and the learned rule', async () => {
  await page.click(R + '.st-railbtn:has-text("Jobs")');
  await page.waitForSelector(R + '.st-centre table');
  const stages = await texts(page, R + '.st-centre tbody tr td:nth-child(2)'); const states = await texts(page, R + '.st-centre tbody tr td:nth-child(4) .st-status');
  ok(stages.length >= 7, String(stages.length)); eq(stages.filter(s => s === 'render').length, 4); ok(stages.indexOf('extract') >= 0 && stages.indexOf('copy') >= 0 && stages.indexOf('export') >= 0, JSON.stringify(stages)); ok(states.every(s => s === 'done'), JSON.stringify(states));
  for (const s of await page.$$(R + '.st-centre summary')) await s.click();
  ok(/claude claude-/.test((await texts(page, R + '.st-joblog')).join(' ')), 'the job logs name the model calls');
  await page.click(R + '.st-railbtn:has-text("Client context")');
  await page.waitForSelector(R + '.st-ctx');
  const c = await page.textContent(R + '.st-ctx');
  ok(/Label the answer Fact/.test(c) && /more than any other industry/.test(c) && /300,000 Australians/.test(c) && /"subsidy"/.test(c) && /logo on file/.test(c) && /claude-opus-5-5/.test(c), c.slice(0, 500));
  await shot(page, 'studio-context');
});
await t('an open brief, copy only: two distinct directions first, nothing produced until one is chosen; then copy-only assets with no render', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")');
  await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib-head .btn');
  await page.click(R + '.st-segbtn:has-text("A brief or one line")');
  await page.click(R + '.st-segbtn:has-text("Copy only")');
  await page.fill(R + '.st-intake textarea', 'Something for Victoria about regional jobs');
  ok(/open brief/.test(await page.textContent(R + '.st-intake-foot')));
  const g0 = calls.gemini;
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-dir', { timeout: 30000 });
  eq((await texts(page, R + '.st-dir')).length, 2); ok(!(await page.$(R + '.st-railbtn.asset')), 'no assets before a choice');
  ok(/nothing is produced until you do/.test(await page.textContent(R + '.st-thread')));
  await shot(page, 'studio-directions');
  await page.click(R + '.st-dir:first-child button:has-text("Choose this direction")');
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-railbtn.asset').length === 3, null, { timeout: 30000 });
  await page.waitForSelector(R + '.st-copycard');
  ok(/Copy only: no render spent/.test(await page.textContent(R + '.st-thread'))); eq(calls.gemini, g0, 'no render for copy-only work');
  eq(await texts(page, R + '.st-railbtn.asset'), ['LinkedIn copy 1:1v1', 'Instagram copy 4:5v1', 'Facebook copy 1:1v1']);
  ok(/from "The plain ask"/.test(await page.textContent(R + '.st-asset-head')));
});
await t('switching client shows only that client\'s work; coming back lists both MCA projects', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")');
  await page.selectOption(R + '.st-head select', 'aep');
  await page.waitForFunction(() => { const h = document.querySelector('#studio-root .st-lib-head'); const l = document.querySelector('#studio-root .st-lib'); return h && l && /Australian Energy Producers/.test(h.textContent) && /Nothing yet for this client/.test(l.textContent); });
  await page.selectOption(R + '.st-head select', 'mca');
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-lib tbody tr').length === 3);
});
await t('a legacy pack imports once into a project whose tile is flattened and marked not editable', async () => {
  await page.locator(R + 'tr.st-legacy').first().locator('.ov-link:has-text("import to Studio")').click();
  await page.waitForSelector(R + '.st-flatnote', { timeout: 15000 });
  ok(/flattened legacy tile: the text on the image is not editable/.test(await page.textContent(R + '.st-flatnote')));
  ok(/original is untouched/.test(await page.textContent(R + '.st-thread')));
  ok(await page.$(R + '.st-field:nth-of-type(1) input:disabled'), 'headline disabled on a flattened tile');
  ok(/imported from rp:rp1/.test(await page.textContent(R + '.st-head')));
});
await page.close();
await t('a read-only key reviews everything and changes nothing: no composer, locks, approvals or new project; export is offered', async () => {
  const p2 = await open('read');
  await p2.waitForSelector(R + '.st-lib tbody tr');
  ok(!(await p2.$(R + '.st-lib-head .btn')), 'no New project');
  await p2.click(R + '.st-lib tbody tr:first-child .ov-link');
  await p2.waitForSelector(R + '.st-asset', { timeout: 15000 });
  ok(!(await p2.$(R + '.st-composer')), 'no composer'); ok(/needs a full key/.test(await p2.textContent(R + '.st-partner')));
  ok(!(await p2.$(R + '.st-lock')), 'no locks'); ok(!(await p2.$(R + '.st-appr .btn')), 'no approve buttons');
  ok(await p2.$(R + '.st-head button:has-text("Export")'), 'export available');
  await p2.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
