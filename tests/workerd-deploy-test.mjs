/* The deploy proof and the S26 routes in workerd, Cloudflare's own Workers runtime (4 November 2026). Every other harness runs
 * the worker module in Node behind a stand-in D1; this one stamps the module exactly as tools/deploy-worker.sh does (the git
 * revision and a fresh deploy token), serves it from workerd through Miniflare with local D1, KV and R2, and then:
 *   - runs `node tools/deploy-verify.mjs verify` against it over HTTP, with AXIOM_KEY so the gated build and revision are read too;
 *   - checks the public / names no build or revision and the status route refuses a request with no key;
 *   - drives the S26 routes on workerd's own D1 (SQLite in the runtime): a classic project, an asset, a dismissal kept and
 *     refused, Production > Needs attention, keeping a piece as written.
 * Nothing reaches Cloudflare or a model provider. Needs miniflare (it brings workerd); it is not a repository dependency, so
 * the harness says SKIP when it is missing - never a pass:
 *   npm install --no-save miniflare@4   (or MINIFLARE_DIR=<a folder whose node_modules holds miniflare>)
 * Run: node tests/workerd-deploy-test.mjs */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawn } from 'node:child_process'; import { createRequire } from 'node:module';
import { stamp, newToken, gitRev, readBuild } from '../tools/deploy-verify.mjs';
const ROOT = new URL('..', import.meta.url).pathname;
let Miniflare = null;
for (const dir of [process.env.MINIFLARE_DIR, ROOT].filter(Boolean)) { try { Miniflare = (await import(createRequire(path.join(dir, 'x.js')).resolve('miniflare'))).Miniflare; break; } catch (e) {} }
if (!Miniflare) { console.log('workerd-deploy-test\n  SKIP miniflare is not installed (npm install --no-save miniflare@4, or set MINIFLARE_DIR); nothing was checked'); process.exit(0); }
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).slice(0, 500)); } };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
console.log('workerd-deploy-test');

const SRC = fs.readFileSync(path.join(ROOT, 'axiomworkerv4.js'), 'utf8');
const REV = gitRev(path.join(ROOT, 'axiomworkerv4.js')); const TOKEN = newToken(); const BUILD = readBuild(SRC);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-')); const file = path.join(dir, 'index.js');
fs.writeFileSync(file, stamp(SRC, REV, TOKEN));
const KEY = 'wd-full-key-0001', READ = 'wd-read-key-0001';
const mf = new Miniflare({ modules: true, scriptPath: file, modulesRoot: dir, compatibilityDate: '2025-01-01', d1Databases: ['MIND_DB'], kvNamespaces: ['AXIOM_KV'], r2Buckets: ['MIND_DOCS'],
  bindings: { AXIOM_KEYS: JSON.stringify({ [KEY]: { n: 'Hesh', r: 'full' }, [READ]: { n: 'Steve', r: 'read' } }) }, port: 0 });
const url = String(await mf.ready).replace(/\/$/, '');
const call = async (m, p, b, k) => { const r = await mf.dispatchFetch(url + p, { method: m, headers: Object.assign({ 'Content-Type': 'application/json' }, k ? { 'X-Axiom-Key': k } : {}), body: b ? JSON.stringify(b) : undefined }); let j = null; try { j = await r.json(); } catch (e) {} return { status: r.status, body: j }; };

await t('the stamped module serves in workerd: / answers this upload\'s token and names no build or revision; /engine/status needs a key and answers both', async () => {
  const r = await call('GET', '/'); ok(r.status === 200 && r.body.deploy === TOKEN, JSON.stringify({ s: r.status, d: r.body && r.body.deploy }));
  ok(r.body.build === undefined && r.body.rev === undefined && !JSON.stringify(r.body).includes(REV), 'nothing public names the build or revision');
  ok((await call('GET', '/engine/status?ns=cmm')).status === 401, 'no key, no status');
  const s = await call('GET', '/engine/status?ns=cmm', null, READ); ok(s.status === 200 && s.body.build === BUILD && s.body.rev === REV && s.body.deploy === TOKEN, JSON.stringify(s.body).slice(0, 200));
});

await t('tools/deploy-verify.mjs verify passes against workerd over HTTP with the token, and with AXIOM_KEY checks the gated build and revision', async () => {
  const run = (args, env) => new Promise(res => { const c = spawn(process.execPath, [path.join(ROOT, 'tools/deploy-verify.mjs'), ...args], { env: Object.assign({}, process.env, env || {}) }); let so = '', se = ''; c.stdout.on('data', d => so += d); c.stderr.on('data', d => se += d); c.on('close', code => res({ code, so, se })); });
  const good = await run(['verify', url, TOKEN, '--build', BUILD, '--rev', REV, '--tries', '3', '--interval', '200'], { AXIOM_KEY: KEY });
  ok(good.code === 0 && /answers this upload's deploy token, and \/engine\/status answers build .*, revision /.test(good.so), JSON.stringify(good));
  const other = await run(['verify', url, newToken(), '--tries', '2', '--interval', '100'], { AXIOM_KEY: '' });
  ok(other.code === 1 && /another upload is serving/.test(other.se), 'a token from another upload is refused: ' + JSON.stringify(other));
  const wrongRev = await run(['verify', url, TOKEN, '--build', BUILD, '--rev', 'deadbeef0000', '--tries', '2', '--interval', '100'], { AXIOM_KEY: KEY });
  ok(wrongRev.code === 1 && /revision deadbeef0000|revision .* \(expected .*deadbeef0000\)/.test(wrongRev.se), JSON.stringify(wrongRev));
});

await t('S26 routes on workerd\'s D1: a dismissal is kept per version and refused for a read key; Needs attention and keep-as-written answer', async () => {
  await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] }, KEY);
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'workerd check', brief: { objective: 'o', message: 'm', channels: ['facebook'] } }, KEY)).body.id; ok(P, 'a project');
  const a = (await call('POST', '/studio/asset', { project: P, title: 'Facebook post', channel: 'facebook', format: '1:1', mode: 'copy', copy: { headline: 'A headline', support: 'A line' } }, KEY)).body.asset; ok(a && a.current, 'an asset with a version');
  const d1 = await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: a.current, key: 'design|Move the panel' }, KEY);
  ok(d1.status === 200 && d1.body.dismissed.length === 1 && d1.body.dismissed[0].who === 'Hesh', JSON.stringify(d1.body));
  ok((await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: a.current, key: 'design|Move the panel' }, READ)).status === 403, 'a read key cannot dismiss');
  const back = await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: a.current, key: 'design|Move the panel', dismissed: false }, KEY); ok(back.body.dismissed.length === 0, 'restored');
  const im = await call('GET', '/studio/impact?project=' + P, null, READ); ok(im.status === 200 && Array.isArray(im.body.assets), JSON.stringify(im.body).slice(0, 200));
  const k = await call('POST', '/studio/direction/keep', { project: P, assets: [a.id] }, KEY); ok(k.status === 200 && k.body.kept[0] === a.id, JSON.stringify(k.body));
  const g = await call('GET', '/studio/get?id=' + P, null, READ); ok((g.body.brief.keptDirection || []).indexOf(a.id) >= 0, 'kept in the brief: ' + JSON.stringify(g.body.brief.keptDirection));
});

await mf.dispose(); fs.rmSync(dir, { recursive: true, force: true });
console.log('\n' + pass + ' passed, ' + fail + ' failed (workerd via miniflare; revision ' + REV + ')'); process.exit(fail ? 1 : 0);
