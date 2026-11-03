#!/usr/bin/env node
/* What tools/deploy-worker.sh uses to prove a deploy instead of believing it (3 November 2026: the deploy of acbbf51 said
 * "new code is live: /engine/status answered 200" while the build it printed, 2026-10-11.studio-p40, was the one before -
 * any answer from the old code passed, and the build id did not change between deploys).
 *
 * S26 (4 November 2026): the public / no longer names the build or the git revision (anyone could read which code served).
 * Each upload is stamped with a fresh random token, AXIOM_DEPLOY, which says nothing about the code; the public / answers it,
 * so the deploy is proven from outside with no key. The build and revision are stamped as before and read back from the
 * key-gated /engine/status when AXIOM_KEY is in the environment (never printed).
 *
 *   node tools/deploy-verify.mjs expect <worker source>                          prints {"build": ..., "rev": ...} (rev from git)
 *   node tools/deploy-verify.mjs token                                           prints a fresh deploy token
 *   node tools/deploy-verify.mjs stamp <worker source> <out file> <rev> <token>  writes a copy carrying the revision and token
 *   node tools/deploy-verify.mjs verify <worker url> <token> [--build B --rev R] [--tries N] [--interval MS]
 *        asks the public / until it answers with exactly that token; exit 0 when it does, 1 with the reason (old code still
 *        serving, another upload serving, no answer). With AXIOM_KEY set and --build/--rev given, /engine/status must also
 *        answer that build and revision.
 *
 * The file in the repository always says AXIOM_REV = 'dev' and AXIOM_DEPLOY = ''; only the uploaded copy carries them. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REV_RX = /^const AXIOM_REV = '[^']*';$/m;
const DEPLOY_RX = /^const AXIOM_DEPLOY = '[^']*';$/m;
const BUILD_RX = /^const AXIOM_BUILD = '([^']+)';$/m;
const TOKEN_RX = /^[a-f0-9]{16,64}$/;

export function readBuild(src) { const m = String(src).match(BUILD_RX); if (!m) throw new Error('no AXIOM_BUILD constant in the worker source'); return m[1]; }

/** A fresh deploy token: 64 random bits as hex. It is public once deployed and means nothing but "this upload". */
export function newToken() { return crypto.randomBytes(8).toString('hex'); }

export function stamp(src, rev, token) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(rev)) throw new Error('a revision is letters, digits, dot, dash or underscore: ' + JSON.stringify(rev));
  const count = rx => (String(src).match(new RegExp(rx.source, 'gm')) || []).length;
  if (count(REV_RX) !== 1) throw new Error('the worker source must hold exactly one AXIOM_REV line (found ' + count(REV_RX) + ')');
  let out = String(src).replace(REV_RX, "const AXIOM_REV = '" + rev + "';");
  if (token != null) {
    if (!TOKEN_RX.test(token)) throw new Error('a deploy token is 16 to 64 lower-case hex characters: ' + JSON.stringify(token));
    if (count(DEPLOY_RX) !== 1) throw new Error('the worker source must hold exactly one AXIOM_DEPLOY line (found ' + count(DEPLOY_RX) + ')');
    out = out.replace(DEPLOY_RX, "const AXIOM_DEPLOY = '" + token + "';");
  }
  return out;
}

export function gitRev(file) {
  const dir = path.dirname(path.resolve(file));
  const head = execFileSync('git', ['-C', dir, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  // a worker file that differs from HEAD is not that commit: say so in the revision
  let dirty = false; try { execFileSync('git', ['-C', dir, 'diff', '--quiet', 'HEAD', '--', path.resolve(file)]); } catch (e) { dirty = true; }
  return head + (dirty ? '-dirty' : '');
}

/** Ask url + '/' until it answers with the deploy token; with o.key and o.build / o.rev, /engine/status must answer them too.
 *  o.fetch is injectable for the harness. */
export async function verify(url, token, o) {
  o = o || {}; const tries = o.tries || 12, interval = o.interval == null ? 5000 : o.interval, f = o.fetch || fetch;
  const base = url.replace(/\/+$/, '');
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise(r => setTimeout(r, interval));
    try {
      const r = await f(base + '/', { headers: { 'Cache-Control': 'no-cache' } });
      const j = await r.json().catch(() => null);
      last = { status: r.status, deploy: j && j.deploy, leaks: !!(j && (j.build || j.rev)) };
      if (r.status === 200 && j && j.deploy === token) {
        if (o.key && (o.build || o.rev)) {
          const s = await f(base + '/engine/status?ns=cmm', { headers: { 'X-Axiom-Key': o.key, 'Cache-Control': 'no-cache' } });
          const sj = await s.json().catch(() => null);
          last.gated = { status: s.status, build: sj && sj.build, rev: sj && sj.rev };
          if (s.status !== 200 || !sj || (o.build && sj.build !== o.build) || (o.rev && sj.rev !== o.rev)) continue;
          return { ok: true, tries: i + 1, token, build: sj.build, rev: sj.rev, gated: true };
        }
        return { ok: true, tries: i + 1, token, gated: false };
      }
    } catch (e) { last = { error: String(e && e.message || e) }; }
  }
  let why;
  if (!last || last.error) why = 'the worker did not answer (' + ((last && last.error) || 'nothing') + ')';
  else if (last.status !== 200) why = 'the worker answered HTTP ' + last.status;
  else if (last.gated) why = last.gated.status !== 200 ? 'the token answers, but /engine/status refused the key (HTTP ' + last.gated.status + ')' : 'the token answers, but /engine/status says build ' + last.gated.build + ', revision ' + last.gated.rev + ' (expected ' + (o.build || '-') + ', ' + (o.rev || '-') + ')';
  else if (!last.deploy) why = 'the worker answers without a deploy token: the old code is still serving' + (last.leaks ? ' (and its / still names the build)' : '');
  else why = 'the worker answers deploy token ' + last.deploy + ', not ' + token + ': another upload is serving';
  return { ok: false, why, last, tries };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, ...a] = process.argv.slice(2);
  const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  try {
    if (cmd === 'expect') { const src = fs.readFileSync(a[0], 'utf8'); console.log(JSON.stringify({ build: readBuild(src), rev: gitRev(a[0]) })); }
    else if (cmd === 'token') { console.log(newToken()); }
    else if (cmd === 'stamp') { const out = stamp(fs.readFileSync(a[0], 'utf8'), a[2], a[3]); if (/[^\x00-\x7F]/.test(out)) throw new Error('the stamped copy is not pure ASCII'); fs.writeFileSync(a[1], out); console.log('stamped ' + a[1] + ' with revision ' + a[2] + (a[3] ? ' and a fresh deploy token' : '')); }
    else if (cmd === 'verify') {
      const key = process.env.AXIOM_KEY || ''; const build = opt('--build'), rev = opt('--rev');
      const r = await verify(a[0], a[1], { tries: Number(opt('--tries')) || undefined, interval: opt('--interval') != null ? Number(opt('--interval')) : undefined, key, build, rev });
      if (r.ok) console.log('verified: the live worker answers this upload\'s deploy token' + (r.gated ? ', and /engine/status answers build ' + r.build + ', revision ' + r.rev : (build || rev) ? ' (set AXIOM_KEY to check the build and revision on /engine/status too)' : '') + ' (after ' + r.tries + ' read' + (r.tries === 1 ? '' : 's') + ')');
      else { console.error('NOT VERIFIED after ' + r.tries + ' reads: ' + r.why + '.'); process.exit(1); }
    } else { console.error('usage: deploy-verify.mjs expect <src> | token | stamp <src> <out> <rev> <token> | verify <url> <token> [--build B --rev R] [--tries N] [--interval MS]'); process.exit(2); }
  } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
}
