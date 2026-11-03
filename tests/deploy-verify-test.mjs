/* tools/deploy-verify.mjs: a deploy is proven by the build and revision the live worker answers with, never by an answer alone
 * (3 November 2026: "new code is live: /engine/status answered 200" printed build 2026-10-11.studio-p40, the build before).
 * The revision is stamped into the uploaded copy only; the repository's file says 'dev'. The live worker is a stub HTTP server
 * here that serves the old code, then the new. Nothing reaches Cloudflare. Run: node tests/deploy-verify-test.mjs */
import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { spawn, spawnSync } from 'node:child_process';
import { stamp, readBuild, verify } from '../tools/deploy-verify.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).slice(0, 400)); } };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const SRC = fs.readFileSync(new URL('../axiomworkerv4.js', import.meta.url), 'utf8');
console.log('deploy-verify-test');

await t('the repository\'s worker says AXIOM_REV = \'dev\' and a build; the stamped copy says the revision, once, and stays pure ASCII', async () => {
  ok(/^const AXIOM_REV = 'dev';$/m.test(SRC), 'the file in the repository is unstamped');
  const b = readBuild(SRC); ok(/^\d{4}-\d{2}-\d{2}\.studio-p\d+$/.test(b), 'a build id: ' + b);
  const out = stamp(SRC, 'abc123def456-dirty');
  ok(/^const AXIOM_REV = 'abc123def456-dirty';$/m.test(out) && !/^const AXIOM_REV = 'dev';$/m.test(out), 'stamped');
  ok(out.length - SRC.length === 'abc123def456-dirty'.length - 3 && !/[^\x00-\x7F]/.test(out), 'only that line changed; ASCII');
  let threw = ''; try { stamp(SRC, "x'; fetch('evil"); } catch (e) { threw = e.message; } ok(/a revision is/.test(threw), 'a revision cannot carry code: ' + threw);
  threw = ''; try { stamp(SRC + "\nconst AXIOM_REV = 'dev';", 'abc'); } catch (e) { threw = e.message; } ok(/exactly one/.test(threw), 'two AXIOM_REV lines are refused: ' + threw);
});

await t('the stamped worker answers its build and revision on the public / (and the unstamped one answers dev)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-')); const f = path.join(dir, 'w.mjs');
  fs.writeFileSync(f, stamp(SRC, 'feedc0ffee12'));
  const mod = await import('file://' + f); const env = { AXIOM_KEYS: JSON.stringify({ 'full-key-0001': { n: 'H', r: 'full' } }) };
  const r = await mod.default.fetch(new Request('https://w.test/'), env, { waitUntil() {} }); const j = await r.json();
  ok(r.status === 200 && j.build === readBuild(SRC) && j.rev === 'feedc0ffee12', JSON.stringify({ status: r.status, build: j.build, rev: j.rev }));
});

function server(answers) {
  let i = 0; const s = http.createServer((q, res) => { const a = answers[Math.min(i++, answers.length - 1)]; res.writeHead(a.status || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(a.body || {})); });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ s, url: 'http://127.0.0.1:' + s.address().port, hits: () => i })));
}
const B = '2026-11-03.studio-p41';
await t('the old code answering 200 is not proof: verify keeps asking and fails, naming the build that serves', async () => {
  const { s, url } = await server([{ body: { name: 'AXIOM Proxy v4', status: 'ok' } }]);
  const r = await verify(url, B, 'abc123', { tries: 3, interval: 10 }); s.close();
  ok(!r.ok && /without a build or revision: the old code is still serving/.test(r.why), r.why);
  const { s: s2, url: u2 } = await server([{ body: { build: '2026-10-11.studio-p40', rev: 'dev' } }]);
  const r2 = await verify(u2, B, 'abc123', { tries: 2, interval: 10 }); s2.close();
  ok(!r2.ok && /answers build 2026-10-11\.studio-p40/.test(r2.why), r2.why);
});
await t('a different revision of the same build is another upload serving: refused', async () => {
  const { s, url } = await server([{ body: { build: B, rev: 'ffff00001111' } }]);
  const r = await verify(url, B, 'abc123', { tries: 2, interval: 10 }); s.close();
  ok(!r.ok && /revision ffff00001111, not abc123/.test(r.why), r.why);
});
await t('propagation: stale twice, then the uploaded build and revision - verified on the third read', async () => {
  const { s, url, hits } = await server([{ body: { build: '2026-10-11.studio-p40', rev: 'dev' } }, { status: 503 }, { body: { build: B, rev: 'abc123' } }]);
  const r = await verify(url, B, 'abc123', { tries: 5, interval: 10 }); s.close();
  ok(r.ok && r.tries === 3 && hits() === 3, JSON.stringify(r));
});
await t('the command line: exit 1 with NOT VERIFIED on a stale worker, exit 0 when it answers with the upload', async () => {
  const { s, url } = await server([{ body: { build: '2026-10-11.studio-p40', rev: 'dev' } }]);
  // the stub server answers in this process, so the command runs as a child without blocking it
  const run = (...a) => new Promise(res => { const c = spawn(process.execPath, [new URL('../tools/deploy-verify.mjs', import.meta.url).pathname, ...a]); let so = '', se = ''; c.stdout.on('data', d => so += d); c.stderr.on('data', d => se += d); c.on('close', code => res({ code, so, se })); });
  const bad = await run('verify', url, B, 'abc123', '--tries', '2', '--interval', '10'); s.close();
  ok(bad.code === 1 && /NOT VERIFIED after 2 reads: the worker answers build 2026-10-11\.studio-p40/.test(bad.se), JSON.stringify(bad));
  const { s: s2, url: u2 } = await server([{ body: { build: B, rev: 'abc123' } }]);
  const good = await run('verify', u2, B, 'abc123', '--tries', '2', '--interval', '10'); s2.close();
  ok(good.code === 0 && /verified: the live worker answers build/.test(good.so), JSON.stringify(good));
});

await t('deploy-worker.sh uploads the stamped copy and refuses to call a deploy live without the revision answering', async () => {
  const sh = fs.readFileSync(new URL('../tools/deploy-worker.sh', import.meta.url), 'utf8');
  ok(/index\.js=@\$STAMPED;/.test(sh) && !/index\.js=@\$SRC;/.test(sh), 'the upload is the stamped copy');
  ok(/deploy-verify\.mjs" verify "\$URL" "\$EXP_BUILD" "\$EXP_REV"/.test(sh) && /\|\| die "the upload was accepted but the live worker is not answering with it/.test(sh), 'verify runs and a failure stops the script');
  ok(!/new code is live: \/engine\/status answered/.test(sh), 'an HTTP status alone is no longer called live');
  ok(spawnSync('bash', ['-n', new URL('../tools/deploy-worker.sh', import.meta.url).pathname]).status === 0, 'the script parses');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
