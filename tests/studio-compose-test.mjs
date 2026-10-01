/* tools/studio-compose.mjs against the worker module served over HTTP in this process: a HOOF composition with the exact
 * wordmark and a cutout region is drawn by the one renderer in headless Chromium, written to disk and saved as the
 * version's export; the inspection then reads that composed tile.
 * Run: node --experimental-sqlite tests/studio-compose-test.mjs */
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v.buffer.slice(r2.get(k).v.byteOffset, r2.get(k).v.byteOffset + r2.get(k).v.byteLength), text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }) };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const realFetch = globalThis.fetch;
const mod = await import(new URL('../axiomworkerv4.js', import.meta.url).href); const handler = mod.default;
const server = http.createServer(async (rq, rs) => { const chunks = []; for await (const c of rq) chunks.push(c); const body = Buffer.concat(chunks);
  const res = await handler.fetch(new Request('http://127.0.0.1' + rq.url, { method: rq.method, headers: rq.headers, body: rq.method === 'GET' ? undefined : body }), env, { waitUntil() {} });
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); rs.writeHead(res.status, h); rs.end(Buffer.from(await res.arrayBuffer())); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
const api = async (m, p, b) => (await realFetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: b ? JSON.stringify(b) : undefined })).json();
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
await api('POST', '/brand/kit', { ns: 'mca', name: 'MCA', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const p = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Compose', brief: { objective: 'o', message: 'm' } });
const layout = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, bg: '#C8102E', regions: [], palette: { primary: '#0E6A6E' }, fonts: { display: 'Bricolage Grotesque', body: 'Instrument Sans' }, layers: [
  { id: 'k', type: 'text', role: 'kicker', text: 'MYTH', x: 6, y: 8, w: 30, h: 6, size: 3.2, weight: 800, color: '#FFFFFF', emphasis: 'caps' },
  { id: 'h', type: 'text', role: 'headline', x: 6, y: 18, w: 80, h: 30, size: 8, weight: 750, color: '#FFFFFF' },
  { id: 'wordmark', type: 'img', role: 'wordmark', x: 71, y: 88, w: 24, h: 8, src: '/brand/wordmark?ns=mca&campaign=hoof', exact: true }] };
const a = await api('POST', '/studio/asset', { project: p.id, family: 'F', channel: 'instagram', format: '1:1', title: 'Myth tile', copy: { headline: 'Fuel tax credits are not a subsidy' }, layout, mode: 'composition' });
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'compose-'));
// the tool runs as a child process (async: this process serves its requests meanwhile)
const r = await new Promise(res => { const c = spawn(process.execPath, [new URL('../tools/studio-compose.mjs', import.meta.url).pathname, '--key', 'full-key', '--project', p.id, '--out', out, '--save', '--worker', BASE], { env: Object.assign({}, process.env, { PLAYWRIGHT_MJS: process.env.PLAYWRIGHT_MJS || '/opt/node22/lib/node_modules/playwright/index.mjs' }) }); let so = '', se = ''; c.stdout.on('data', x => { so += x; }); c.stderr.on('data', x => { se += x; }); const to = setTimeout(() => c.kill(), 120000); c.on('close', () => { clearTimeout(to); res({ stdout: so, stderr: se }); }); });
let d = null; try { d = JSON.parse(String(r.stdout).trim().split('\n').pop()); } catch (e) { console.log(r.stdout, r.stderr); }
ok(d && d.ok && d.composed.length === 1, 'one composition drawn: ' + JSON.stringify(d && (d.composed || d)));
const row = d && d.composed[0];
ok(row && fs.existsSync(row.file) && fs.statSync(row.file).size > 1000, 'written to disk at native size');
ok(row && row.saved === 'studio/' + p.id + '/' + a.asset.id + '/' + a.asset.current + '-export.png' && r2.has(row.saved), 'saved as the version\'s export: ' + JSON.stringify(row && (row.saveError || row.validation)));
ok(row && row.validation && row.validation.technical, 'the measurement was filed and re-judged by the worker: ' + JSON.stringify(row && row.validation));
ok(row && row.fonts && Array.isArray(row.fonts.fallback), 'the fonts used are reported, fallback included: ' + JSON.stringify(row && row.fonts));
ok(row && !row.missing, 'the wordmark image was fetched and drawn');
const png = row && row.file ? fs.readFileSync(row.file) : Buffer.alloc(32); ok(png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1080, 'native 1080 x 1080');
// --repair: an overflowing headline gets the app's "Fix layout (no render)" before it is measured and filed
const tight = JSON.parse(JSON.stringify(layout)); tight.layers[1].h = 9;
const b = await api('POST', '/studio/asset', { project: p.id, family: 'F', channel: 'instagram', format: '1:1', title: 'Tight tile', copy: { headline: 'Fuel tax credits are not a subsidy and never were, whatever the campaign says' }, layout: tight, mode: 'composition' });
const run2 = async extra => new Promise(res => { const c = spawn(process.execPath, [new URL('../tools/studio-compose.mjs', import.meta.url).pathname, '--key', 'full-key', '--project', p.id, '--asset', b.asset.id, '--save', '--worker', BASE].concat(extra), { env: Object.assign({}, process.env, { PLAYWRIGHT_MJS: process.env.PLAYWRIGHT_MJS || '/opt/node22/lib/node_modules/playwright/index.mjs' }) }); let so = '', se = ''; c.stdout.on('data', x => { so += x; }); c.stderr.on('data', x => { se += x; }); c.on('close', () => { try { res(JSON.parse(so.trim().split('\n').pop()).composed[0]); } catch (e) { console.log(so, se); res(null); } }); });
const plain = await run2([]); ok(plain && plain.validation && plain.validation.ok === false && plain.validation.blocking.indexOf('text_overflow') >= 0 && !plain.repaired, 'without --repair the overflow is measured and filed as failing: ' + JSON.stringify(plain && plain.validation));
const fixedRow = await run2(['--repair']); const g2 = await api('GET', '/studio/get?id=' + p.id); const bb = g2.assets.find(x => x.id === b.asset.id); const cur = bb.versions.find(x => x.id === bb.current);
ok(fixedRow && fixedRow.repaired && fixedRow.repaired.steps.length && fixedRow.version === bb.current && bb.versions.length === 2, 'with --repair the fix is saved as the next version and that version is measured: ' + JSON.stringify(fixedRow && fixedRow.repaired));
ok(cur.kind === 'layout' && /layout repaired/.test(cur.note) && cur.copy.headline === 'Fuel tax credits are not a subsidy and never were, whatever the campaign says', 'a layout version, the words unchanged: ' + cur.note);
ok(fixedRow && fixedRow.validation && fixedRow.validation.ok === true, 'the repaired tile passes: ' + JSON.stringify(fixedRow && fixedRow.validation));
server.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
