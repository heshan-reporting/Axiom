/* Client review in real browsers: docs/review.html as a client would open it from the agency's private link, and the
 * Studio's Client review view, both talking to the worker module in this process (SQLite behind the D1 API). The client
 * page shows only the shared assets (the validated export of each current version, or the copy), takes a name, a
 * comment pinned to a point on the tile, a request for changes and an approval of that exact version; the agency sees
 * the pins, marks a comment addressed by the version that changed it, and withdraws the link.
 * Run: node --experimental-sqlite tests/studio-review-browser.mjs   (SHOT=1 writes screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';
import { D1Lite } from './d1lite.mjs';
import { stubReport } from './studio-measure-stub.mjs';
process.on('warning', () => {});
const PORT = 8777, W = 'https://newsaus.heshan-998.workers.dev';
const kv = new Map(); const r2 = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => { const b = r2.get(k).v; return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }, text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }),
};
globalThis.fetch = async () => new Response('', { status: 404 });
const mod = await import(new URL('../axiomworkerv4.js', import.meta.url).href); const handler = mod.default; const ctx = { waitUntil() {} };
const api = async (method, path, body) => (await handler.fetch(new Request(W + path, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: body ? JSON.stringify(body) : undefined }), env, ctx)).json();
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

// a project with one validated composition (its export a real PNG the browser can decode) and one copy-only asset
const TILE = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'none' }] });
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fuel tax review', brief: { objective: 'o', message: 'm' } })).id;
const L = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#0E6A6E', regions: [], layers: [{ id: 'h', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 20, size: 6, weight: 800, color: '#fff' }] };
const A = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Myth tile', copy: { headline: 'Not a subsidy', support: 'A tax returned', cta: 'Sign' }, layout: L, mode: 'composition' })).asset.id;
const B = (await api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'linkedin', format: '1:1', title: 'LinkedIn caption', copy: { caption: 'Fuel tax credits return a road tax never meant for off-road fuel.' }, mode: 'copy' })).asset.id;
await api('POST', '/studio/note', { project: P, text: 'INTERNAL-NOTE: keep the client away from the teal debate' });
const validate = async () => { const g = await api('GET', '/studio/get?id=' + P); const a = g.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current); return api('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a), imageB64: TILE }); };
await validate();
await api('POST', '/studio/approve', { asset: A, part: 'copy', decision: 'approve', reason: 'agency ok' }); await api('POST', '/studio/approve', { asset: A, part: 'design', decision: 'approve', reason: 'agency ok' });
const share = await api('POST', '/studio/share', { project: P, assets: [A, B], label: 'HOOF round 1', expiresDays: 14, allowApprove: true });
const TOKEN = share.token;

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const browser = await chromium.launch();
const routeWorker = async page => page.route(/^https:\/\/(?!127\.0\.0\.1)[^/]+\//, async route => {
  const rq = route.request(); const u = rq.url(); if (!u.startsWith(W)) return route.abort();
  const body = rq.postDataBuffer(); const res = await handler.fetch(new Request(u, { method: rq.method(), headers: Object.assign({ 'CF-Connecting-IP': '10.2.2.2' }, rq.headers()), body: body && rq.method() !== 'GET' ? body : undefined }), env, ctx);
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); return route.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) });
});
const client = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
client.on('pageerror', e => console.log('  [pageerror client] ' + e.message));
client.on('dialog', d => d.accept());
const keySeen = []; client.on('request', r => { const h = r.headers(); if (h['x-axiom-key']) keySeen.push(r.url()); });
await routeWorker(client);
const reviewUrl = token => 'http://127.0.0.1:' + PORT + '/review.html#t=' + encodeURIComponent(token) + '&w=' + encodeURIComponent(W);
await client.goto(reviewUrl(TOKEN));
console.log('studio-review-browser harness (the client page and the Studio Client review view)');

await t('the client page opens from the private link: the client and project named, the shared tile drawn from its validated export and the copy-only asset as text - and nothing internal', async () => {
  await client.waitForSelector('section.card');
  eq(await client.textContent('#title'), 'Minerals Council of Australia: Fuel tax review');
  eq((await client.$$('section.card')).length, 2);
  await client.waitForFunction(() => { const i = document.querySelector('.stage img'); return i && i.naturalWidth > 0; });
  ok(/Fuel tax credits return a road tax/.test(await client.textContent('section.card:nth-of-type(2)')), 'the caption-only asset reads as copy');
  const htmlNow = await client.content(); ok(!/INTERNAL-NOTE|layers|exportKey|full-key/.test(htmlNow), 'nothing internal on the page');
  eq(keySeen.length, 0, 'the page never sends an AXIOM key');
  ok(/works until/.test(await client.textContent('#sub')), 'the expiry is stated');
});

await t('a comment needs the reviewer\'s name, can be pinned to a point on the tile, and lands with the agency as the client gave it', async () => {
  const card = 'section.card:nth-of-type(1)';
  await client.fill(card + ' textarea', 'Make the headline bigger');
  await client.click(card + ' button:has-text("Add comment")');
  await client.waitForFunction(() => /Add your name above/.test(document.querySelector('section.card [role=status]').textContent));
  await client.fill('#name', 'Tania');
  const box = await (await client.$(card + ' .stage')).boundingBox(); await client.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.2);
  await client.waitForSelector(card + ' .pin.pending');
  await client.fill(card + ' textarea', 'Make the headline bigger');
  await client.click(card + ' button:has-text("Add comment")');
  await client.waitForSelector(card + ' ol.comments li');
  ok(/Make the headline bigger/.test(await client.textContent(card + ' ol.comments')) && /Tania/.test(await client.textContent(card + ' ol.comments')));
  await client.waitForSelector(card + ' .pin:not(.pending)');
  const rows = (await api('GET', '/studio/review?project=' + P)).review; const c = rows.find(r => r.kind === 'comment');
  ok(c && Math.abs(c.pin.x - 30) < 2 && Math.abs(c.pin.y - 20) < 2 && c.author === 'Tania', JSON.stringify(c));
});

await t('the client approves that exact version (the agency approved it first); a request for changes needs words', async () => {
  const card = 'section.card:nth-of-type(1)';
  await client.fill(card + ' textarea', ''); await client.click(card + ' button:has-text("Request changes")');
  await client.waitForFunction(() => /Say what should change/.test(document.querySelector('section.card [role=status]').textContent));
  ok(!(await client.$eval(card + ' button:has-text("Approve version 1")', b => b.disabled)), 'approval is open: the agency approved');
  await client.click(card + ' button:has-text("Approve version 1")');
  await client.waitForFunction(() => /approved by Tania/.test(document.querySelector('section.card').textContent));
  const rows = (await api('GET', '/studio/review?project=' + P)).review; ok(rows.some(r => r.kind === 'approve' && r.author === 'Tania'));
  if (process.env.SHOT) await client.screenshot({ path: new URL('./shot-review-client.png', import.meta.url).pathname });
});

let studio;
await t('in the Studio the agency sees the link and the pinned comment, makes the change as a new version, and marks the comment addressed by it; the client then sees the new version and "addressed in version 2"', async () => {
  // the change: a new version, measured
  const g = await api('GET', '/studio/get?id=' + P); const a = g.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current);
  await api('POST', '/studio/version', { asset: A, copy: Object.assign({}, v.copy, { headline: 'Not a subsidy. Never was.' }), layout: Object.assign({}, v.layout, { layers: v.layout.layers.map(l => Object.assign({}, l, { size: 7 })) }), note: 'headline enlarged for the client' });
  await validate();
  studio = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  studio.on('pageerror', e => console.log('  [pageerror studio] ' + e.message));
  await studio.addInitScript(({ W }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', 'full-key'); }, { W });
  await routeWorker(studio);
  await studio.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await studio.waitForFunction(() => typeof go === 'function' && window.AXUI && window.STRender && typeof studioInit === 'function');
  await studio.evaluate(() => go('studio'));
  await studio.waitForSelector('#studio-root .st-lib tbody tr');
  await studio.click('#studio-root .st-lib tbody tr:has-text("Fuel tax review") .ov-link');
  await studio.click('#studio-root .st-step:has(.st-step-l:text-matches("^Review"))');
  await studio.waitForSelector('#studio-root .st-review');
  const tx = (await studio.textContent('#studio-root .st-review')).replace(/\s+/g, ' ');
  ok(/HOOF round 1/.test(tx) && /active/.test(tx) && /Make the headline bigger/.test(tx) && /Tania \(name as given\)/.test(tx) && /client approval/.test(tx) && /of an earlier version/.test(tx), tx.slice(0, 700));
  ok(await studio.$('#studio-root .st-review-thumb .st-pin'), 'the pin is drawn on the tile');
  await studio.fill('#studio-root .st-review-list input[aria-label="Resolution note"]', 'Headline enlarged');
  await studio.click('#studio-root .st-review-list button:has-text("Addressed in v2")');
  await studio.waitForFunction(() => /addressed in v2/.test(document.querySelector('#studio-root .st-review').textContent));
  if (process.env.SHOT) await studio.screenshot({ path: new URL('./shot-studio-review.png', import.meta.url).pathname });
  await client.reload(); await client.waitForSelector('section.card');
  const c1 = await client.textContent('section.card:nth-of-type(1)');
  ok(/version 2/.test(c1) && /addressed in version 2/.test(c1) && /Agency: Headline enlarged/.test(c1) && !/approved by Tania/.test(c1), 'the client sees the new version, the comment addressed, and no approval carried over: ' + c1.replace(/\s+/g, ' ').slice(0, 300));
});

await t('withdrawing the link in the Studio closes the client page; a made-up link opens nothing', async () => {
  await studio.click('#studio-root .st-review button:has-text("Withdraw")');
  await studio.waitForFunction(() => /revoked/.test(document.querySelector('#studio-root .st-review').textContent));
  await client.reload(); await client.waitForSelector('.msg.bad');
  ok(/withdrawn by the agency/.test(await client.textContent('.msg.bad')));
  const stranger = await browser.newPage(); await routeWorker(stranger); await stranger.goto(reviewUrl('x'.repeat(43)));
  await stranger.waitForSelector('.msg.bad'); ok(/not valid/.test(await stranger.textContent('.msg.bad')));
});

await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
