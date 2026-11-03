/* tools/deploy-verify.mjs: a deploy is proven by what the live worker answers, never by an answer alone (3 November 2026:
 * "new code is live: /engine/status answered 200" printed build 2026-10-11.studio-p40, the build before). Since S26 the public
 * / answers an opaque per-upload token and names no build or revision; those are read on the key-gated /engine/status.
 * The revision and the token are stamped into the uploaded copy only; the repository's file says 'dev' and ''. The live worker is a stub HTTP server
 * here that serves the old code, then the new. Nothing reaches Cloudflare. Run: node tests/deploy-verify-test.mjs */
import fs from 'node:fs'; import http from 'node:http'; import os from 'node:os'; import path from 'node:path'; import { spawn, spawnSync } from 'node:child_process';
import { stamp, readBuild, verify, newToken } from '../tools/deploy-verify.mjs';
let pass = 0, fail = 0;
const t = async (name, fn) => { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).slice(0, 400)); } };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const SRC = fs.readFileSync(new URL('../axiomworkerv4.js', import.meta.url), 'utf8');
console.log('deploy-verify-test');

const TOK = 'feedc0ffee123456';
await t('the repository\'s worker says AXIOM_REV = \'dev\', AXIOM_DEPLOY = \'\' and a build; the stamped copy carries both, once, pure ASCII', async () => {
  ok(/^const AXIOM_REV = 'dev';$/m.test(SRC) && /^const AXIOM_DEPLOY = '';$/m.test(SRC), 'the file in the repository is unstamped');
  const b = readBuild(SRC); ok(/^\d{4}-\d{2}-\d{2}\.studio-p\d+$/.test(b), 'a build id: ' + b);
  const out = stamp(SRC, 'abc123def456-dirty', TOK);
  ok(/^const AXIOM_REV = 'abc123def456-dirty';$/m.test(out) && /^const AXIOM_DEPLOY = 'feedc0ffee123456';$/m.test(out), 'stamped');
  ok(out.length - SRC.length === ('abc123def456-dirty'.length - 3) + TOK.length && !/[^\x00-\x7F]/.test(out), 'only those two lines changed; ASCII');
  let threw = ''; try { stamp(SRC, "x'; fetch('evil", TOK); } catch (e) { threw = e.message; } ok(/a revision is/.test(threw), 'a revision cannot carry code: ' + threw);
  threw = ''; try { stamp(SRC, 'abc', "x'; fetch('evil"); } catch (e) { threw = e.message; } ok(/a deploy token is/.test(threw), 'a token cannot carry code: ' + threw);
  threw = ''; try { stamp(SRC + "\nconst AXIOM_REV = 'dev';", 'abc', TOK); } catch (e) { threw = e.message; } ok(/exactly one AXIOM_REV/.test(threw), 'two AXIOM_REV lines are refused: ' + threw);
  const a = newToken(), b2 = newToken(); ok(/^[a-f0-9]{16}$/.test(a) && a !== b2, 'tokens are random hex: ' + a + ' ' + b2);
});

await t('the public / answers the deploy token and names no build or revision; the key-gated status routes do', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-')); const f = path.join(dir, 'w.mjs');
  fs.writeFileSync(f, stamp(SRC, 'abcdef123456', TOK));
  const mod = await import('file://' + f); const env = { AXIOM_KEYS: JSON.stringify({ 'full-key-0001': { n: 'H', r: 'full' } }) };
  const r = await mod.default.fetch(new Request('https://w.test/'), env, { waitUntil() {} }); const j = await r.json();
  ok(r.status === 200 && j.deploy === TOK, JSON.stringify({ status: r.status, deploy: j.deploy }));
  ok(j.build === undefined && j.rev === undefined && !JSON.stringify(j).includes('abcdef123456') && !JSON.stringify(j).includes(readBuild(SRC)), 'nothing public names the build or the revision');
  const s1 = await mod.default.fetch(new Request('https://w.test/engine/status?ns=cmm'), env, { waitUntil() {} }); ok(s1.status === 401, 'the status route needs a key: ' + s1.status);
  // the unstamped repository copy answers no token at all
  fs.writeFileSync(path.join(dir, 'p.mjs'), SRC); const plain = await import('file://' + path.join(dir, 'p.mjs'));
  const rp = await (await plain.default.fetch(new Request('https://w.test/'), env, { waitUntil() {} })).json(); ok(rp.deploy === undefined && rp.build === undefined, JSON.stringify(rp).slice(0, 120));
});

function server(answers, gated) {
  let i = 0, g = 0; const s = http.createServer((q, res) => {
    if (q.url.indexOf('/engine/status') === 0) { const a = (gated || [])[Math.min(g++, (gated || []).length - 1)] || { status: 401 }; if (q.headers['x-axiom-key'] !== 'k-full') { res.writeHead(401); res.end('{}'); return; } res.writeHead(a.status || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(a.body || {})); return; }
    const a = answers[Math.min(i++, answers.length - 1)]; res.writeHead(a.status || 200, { 'content-type': 'application/json' }); res.end(JSON.stringify(a.body || {})); });
  return new Promise(r => s.listen(0, '127.0.0.1', () => r({ s, url: 'http://127.0.0.1:' + s.address().port, hits: () => i })));
}
const B = '2026-11-04.studio-p42';
await t('the old code answering 200 is not proof: verify keeps asking and fails, naming what serves', async () => {
  const { s, url } = await server([{ body: { name: 'AXIOM Proxy v4', status: 'ok', build: '2026-11-03.studio-p41', rev: 'dev' } }]);
  const r = await verify(url, TOK, { tries: 3, interval: 10 }); s.close();
  ok(!r.ok && /without a deploy token: the old code is still serving \(and its \/ still names the build\)/.test(r.why), r.why);
});
await t('another upload\'s token is another upload serving: refused', async () => {
  const { s, url } = await server([{ body: { deploy: 'ffff000011112222' } }]);
  const r = await verify(url, TOK, { tries: 2, interval: 10 }); s.close();
  ok(!r.ok && /deploy token ffff000011112222, not feedc0ffee123456: another upload is serving/.test(r.why), r.why);
});
await t('propagation: stale twice, then this upload\'s token - verified on the third read; with a key the gated build and revision must match', async () => {
  const { s, url, hits } = await server([{ body: {} }, { status: 503 }, { body: { deploy: TOK } }]);
  const r = await verify(url, TOK, { tries: 5, interval: 10 }); s.close();
  ok(r.ok && r.tries === 3 && hits() === 3 && r.gated === false, JSON.stringify(r));
  const g1 = await server([{ body: { deploy: TOK } }], [{ body: { build: B, rev: 'abc123' } }]);
  const rg = await verify(g1.url, TOK, { tries: 2, interval: 10, key: 'k-full', build: B, rev: 'abc123' }); g1.s.close();
  ok(rg.ok && rg.gated && rg.build === B && rg.rev === 'abc123', JSON.stringify(rg));
  const g2 = await server([{ body: { deploy: TOK } }], [{ body: { build: B, rev: 'other999' } }]);
  const rb = await verify(g2.url, TOK, { tries: 2, interval: 10, key: 'k-full', build: B, rev: 'abc123' }); g2.s.close();
  ok(!rb.ok && /\/engine\/status says build .*, revision other999/.test(rb.why), rb.why);
  const g3 = await server([{ body: { deploy: TOK } }], [{ body: { build: B, rev: 'abc123' } }]);
  const rk = await verify(g3.url, TOK, { tries: 2, interval: 10, key: 'wrong', build: B, rev: 'abc123' }); g3.s.close();
  ok(!rk.ok && /refused the key \(HTTP 401\)/.test(rk.why), rk.why);
});
await t('the command line: exit 1 with NOT VERIFIED on a stale worker, exit 0 when it answers this upload\'s token', async () => {
  const { s, url } = await server([{ body: { build: '2026-11-03.studio-p41', rev: 'dev' } }]);
  // the stub server answers in this process, so the command runs as a child without blocking it
  const run = (...a) => new Promise(res => { const c = spawn(process.execPath, [new URL('../tools/deploy-verify.mjs', import.meta.url).pathname, ...a], { env: Object.assign({}, process.env, { AXIOM_KEY: '' }) }); let so = '', se = ''; c.stdout.on('data', d => so += d); c.stderr.on('data', d => se += d); c.on('close', code => res({ code, so, se })); });
  const bad = await run('verify', url, TOK, '--tries', '2', '--interval', '10'); s.close();
  ok(bad.code === 1 && /NOT VERIFIED after 2 reads: the worker answers without a deploy token/.test(bad.se), JSON.stringify(bad));
  const { s: s2, url: u2 } = await server([{ body: { deploy: TOK } }]);
  const good = await run('verify', u2, TOK, '--build', B, '--rev', 'abc123', '--tries', '2', '--interval', '10'); s2.close();
  ok(good.code === 0 && /verified: the live worker answers this upload's deploy token \(set AXIOM_KEY to check the build and revision/.test(good.so), JSON.stringify(good));
  const tk = await run('token'); ok(tk.code === 0 && /^[a-f0-9]{16}\n$/.test(tk.so), JSON.stringify(tk));
});

await t('deploy-worker.sh uploads the stamped copy with a fresh token and refuses to call a deploy live until that token answers', async () => {
  const sh = fs.readFileSync(new URL('../tools/deploy-worker.sh', import.meta.url), 'utf8');
  ok(/index\.js=@\$STAMPED;/.test(sh) && !/index\.js=@\$SRC;/.test(sh), 'the upload is the stamped copy');
  ok(/DEPLOY_ID="\$\(node "\$REPO\/tools\/deploy-verify\.mjs" token\)"/.test(sh) && /stamp "\$SRC" "\$STAMPED" "\$EXP_REV" "\$DEPLOY_ID"/.test(sh), 'a fresh token is stamped');
  ok(/deploy-verify\.mjs" verify "\$URL" "\$DEPLOY_ID" --build "\$EXP_BUILD" --rev "\$EXP_REV"/.test(sh) && /\|\| die "the upload was accepted but the live worker is not answering with it/.test(sh), 'verify runs on the token and a failure stops the script');
  ok(!/new code is live: \/engine\/status answered/.test(sh), 'an HTTP status alone is not called live');
  ok(spawnSync('bash', ['-n', new URL('../tools/deploy-worker.sh', import.meta.url).pathname]).status === 0, 'the script parses');
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
