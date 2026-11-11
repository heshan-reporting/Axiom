/* The fixture for Anne's Den in a browser: docs/ served by Python, the page's worker calls routed into the worker module in
 * this process (SQLite behind the D1 API), a day of invented rows on the AEP desk, and a stub model that writes from the
 * evidence it is sent. Nothing is contacted and nothing is spent. A harness may push hooks onto w.hooks to make a route
 * fail, hang or answer nonsense. */
import { spawn } from 'node:child_process';
import net from 'node:net'; import fs from 'node:fs';
import { chromium, DOCS } from './pw.mjs';
import { workerEnv } from './worker-env.mjs';

export const W = 'https://newsaus.heshan-998.workers.dev'; export const H = 3600000, D = 86400000, NOW = Date.now();
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'other-key': { n: 'Kai', r: 'full' } };
const freePort = () => new Promise(r => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => r(p)); }); });
const up = port => new Promise(r => { const tryIt = n => { const c = net.connect(port, '127.0.0.1'); c.on('connect', () => { c.destroy(); r(true); }); c.on('error', () => (n > 60 ? r(false) : setTimeout(() => tryIt(n + 1), 120))); }; tryIt(0); });
const PORT = await freePort(); const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', DOCS], { stdio: 'ignore' }); await up(PORT);
export const SHOT = process.env.SHOT === '1'; export const SHOTS = new URL('./shots/den/', import.meta.url).pathname; if (SHOT) fs.mkdirSync(SHOTS, { recursive: true });

let seq = 0;
const news = o => Object.assign({ src: 'pointpost', title: 'Crossbench renews call for a windfall tax on gas ' + (++seq), body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://pointpost.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }, o);
const post = o => Object.assign({ src: 'x', title: 'x post', body: 'The windfall tax on gas is overdue, sign the petition.', url: 'https://x.com/i/web/status/19' + String(++seq).padStart(12, '0'), ts: NOW - 3 * H, meta: { platform: 'x', issues: ['gastax'], id: 'p' + seq, eng: { likes: 40, replies: 6, reposts: 9 }, eng_at: NOW - H, score: 49, comments: 6, layers: [2] } }, o);
export async function world(env) {
  const w = await workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS }); const F = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
  const push = async (kind, rows) => { const r = await F('POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed ' + r.text.slice(0, 120)); };
  await push('news', [news({ title: 'Harbour levy divides the Senate', url: 'https://pointpost.example.com.au/a', ts: NOW - 5 * H }), news({ src: 'tribune', title: 'Harbour levy divides the Senate - Tribune', url: 'https://tribune.example.com.au/a', ts: NOW - 4 * H, meta: { issues: ['gastax'], source: 'tribune', outlet: 'The Tribune', fb: { reactions: 300, comments: 40, shares: 22 } } }),
    news({ title: 'Producers answer the windfall tax push', url: 'https://pointpost.example.com.au/b', meta: { issues: ['gastax'], source: 'afr', gated: 1, access: 'subscriber', ft: 'subscriber' } }), news({ title: 'Harbour Watch will hold a rally at Parliament on 28 December over the gas export tax', url: 'https://pointpost.example.com.au/r' })]
    .concat([1, 2, 3, 4].map(i => news({ src: 'noisy', title: 'Noisy outlet on the gas export tax ' + i, url: 'https://noisy.example.com/s' + i, ts: NOW - (6 + i) * H, meta: { issues: ['gastax'], source: 'noisy' } }))));
  const acct = (await F('POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'x', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' })).body.watch;
  await F('POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatchpage', name: 'Harbour Watch' });
  await push('sig_thread', [post({ url: 'https://x.com/i/web/status/190000000000000001' }), post({ url: 'https://x.com/i/web/status/190000000000000002', body: 'Our position on the gas export tax, in full.', meta: { platform: 'x', issues: ['gastax'], id: 'pa', watch: acct.id, actor: { id: acct.id, name: 'Harbour Watch', kind: 'org' }, eng: { likes: 90 }, score: 90, comments: 0 } })]);
  await F('GET', '/sentinel/alerts'); w.env.MIND_DB.db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,severity,hot,baseline,ratio,srcs,detected_ts) VALUES('aep','AEP','gastax','Gas taxation','high',9,2.9,3.1,5,?)").run(NOW - 2 * H);
  const calls = [];
  w.answer(/api\.anthropic\.com/, async (u, init) => { const b = JSON.parse(init.body); calls.push(b); if (w.slow) await new Promise(r => setTimeout(r, w.slow)); const ev = b.messages[0].content; const ids = k => (ev.match(new RegExp('\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'g')) || []).map(x => x.slice(1, -1));
    const one = /"bottom":"\.\.\."/.test(b.system) && !/"summary":"\.\.\."/.test(b.system);
    const j = one ? { sections: { bottom: 'Written again, shorter [' + ids('M')[0] + '].' } } : { sections: { summary: 'Coverage of the gas taxation debate continued through the window, led by regional outlets and carried by others [' + ids('M')[0] + ']. A campaigner named Sam Private is behind it [M:999999]. The conversation on X stayed small [' + ids('S')[0] + '].', media: 'The story ran in three outlets and drew 300 reactions on Facebook [' + ids('M')[0] + '].', bottom: 'Activity is steady and the client is not directly targeted [' + ids('M')[0] + '].', posture: 'The client should continue monitoring.' }, ratings: { momentum: { level: 'Moderate', trend: 'Stable' } } };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  return Object.assign(w, { F, push, calls });
}
export const browser = await chromium.launch();
export async function open(w, key, o) {
  o = o || {}; const ctx = await browser.newContext({ viewport: { width: o.width || 1440, height: o.height || 900 }, acceptDownloads: true }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  const page = await ctx.newPage(); page.errors = []; page.on('pageerror', e => { page.errors.push(e.message); console.log('  [pageerror] ' + e.message.slice(0, 200)); });
  await page.addInitScript(({ W, key }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', key); window.confirm = () => true; }, { W, key: key || 'full-key' });
  await page.route(/^https:\/\/(?!newsaus\.)[^/]+\//, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  w.hooks = w.hooks || []; page.served = [];
  await page.route(W + '/**', async route => { const r = route.request(); const u = new URL(r.url()); const path = u.pathname + u.search; page.served.push(r.method() + ' ' + path);
    for (const h of w.hooks) { const done = await h(route, r, path); if (done) return; }
    try { const res = await w.call(r.method(), path, r.postData() || null, r.headers()['x-axiom-key'] || null); const hd = {}; res.headers.forEach((v, k) => { if (/^(content-type|content-security-policy|x-request-id)$/i.test(k)) hd[k] = v; }); await route.fulfill({ status: res.status, headers: Object.assign({ 'access-control-allow-origin': '*', 'access-control-expose-headers': 'X-Request-Id' }, hd), body: res.text }); }
    catch (e) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'fixture_failed', detail: String(e.message) }) }); } });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html#v=' + (o.view || 'den'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function', null, { timeout: 20000 });
  if (!o.view) { await page.evaluate(() => go('den')); await page.waitForSelector('#den-app', { timeout: 20000 }); await page.waitForSelector('.den-strip ul, .den-strip .den-state', { timeout: 20000 }); }
  return page;
}
let pass = 0, fail = 0; const failures = [];
export async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; failures.push(name); console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).split('\n').slice(0, 3).join('\n       ')); } }
export const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
export const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
export const txt = (page, sel) => page.$eval(sel, e => e.textContent.replace(/\s+/g, ' ').trim());
export const all = (page, sel) => page.$$eval(sel, els => els.map(e => (e.tagName === 'TR' ? Array.from(e.children).map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' | ') : e.textContent.replace(/\s+/g, ' ').trim())));
export const tab = async (page, name) => { await page.click('#den-tab-' + name); await page.waitForFunction(n => document.querySelector('#den-tab-' + n).getAttribute('aria-selected') === 'true', name); };
export const desk = async (page, id) => { await page.click('.den-deskcard'); await page.click('.den-deskitem[data-desk="' + id + '"]'); };
export const toast = page => page.evaluate(() => (document.querySelector('.toast, #toast') || {}).textContent || '');
export const shot = async (page, n) => { if (SHOT) await page.screenshot({ path: SHOTS + n + '.png', fullPage: true, scale: 'css' }); };
export const panel = (page, title) => page.locator('section.den-panel[aria-label="' + title + '"]');

export async function finish() { await browser.close(); server.kill(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0); }
