#!/usr/bin/env node
/* What tools/deploy-worker.sh uses to prove a deploy instead of believing it (3 November 2026: the deploy of acbbf51 said
 * "new code is live: /engine/status answered 200" while the build it printed, 2026-10-11.studio-p40, was the one before -
 * any answer from the old code passed, and the build id did not change between deploys).
 *
 *   node tools/deploy-verify.mjs expect <worker source>                  prints {"build": ..., "rev": ...} (rev from git)
 *   node tools/deploy-verify.mjs stamp <worker source> <out file> <rev>  writes a copy with AXIOM_REV = '<rev>'
 *   node tools/deploy-verify.mjs verify <worker url> <build> <rev> [--tries N] [--interval MS]
 *        asks the public / until it answers with exactly that build and revision; exit 0 when it does, 1 with the reason
 *        (old code still serving, a different revision, no answer) when it never does.
 *
 * The file in the repository always says AXIOM_REV = 'dev'; only the uploaded copy carries the revision. */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const REV_RX = /^const AXIOM_REV = '[^']*';$/m;
const BUILD_RX = /^const AXIOM_BUILD = '([^']+)';$/m;

export function readBuild(src) { const m = String(src).match(BUILD_RX); if (!m) throw new Error('no AXIOM_BUILD constant in the worker source'); return m[1]; }

export function stamp(src, rev) {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(rev)) throw new Error('a revision is letters, digits, dot, dash or underscore: ' + JSON.stringify(rev));
  const n = (String(src).match(new RegExp(REV_RX.source, 'gm')) || []).length;
  if (n !== 1) throw new Error('the worker source must hold exactly one AXIOM_REV line (found ' + n + ')');
  return String(src).replace(REV_RX, "const AXIOM_REV = '" + rev + "';");
}

export function gitRev(file) {
  const dir = path.dirname(path.resolve(file));
  const head = execFileSync('git', ['-C', dir, 'rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  // a worker file that differs from HEAD is not that commit: say so in the revision
  let dirty = false; try { execFileSync('git', ['-C', dir, 'diff', '--quiet', 'HEAD', '--', path.resolve(file)]); } catch (e) { dirty = true; }
  return head + (dirty ? '-dirty' : '');
}

/** Ask url + '/' until it answers with build and rev. fetchImpl is injectable for the harness. */
export async function verify(url, build, rev, o) {
  o = o || {}; const tries = o.tries || 12, interval = o.interval == null ? 5000 : o.interval, f = o.fetch || fetch;
  let last = null;
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise(r => setTimeout(r, interval));
    try {
      const r = await f(url.replace(/\/+$/, '') + '/', { headers: { 'Cache-Control': 'no-cache' } });
      const j = await r.json().catch(() => null);
      last = { status: r.status, build: j && j.build, rev: j && j.rev };
      if (r.status === 200 && j && j.build === build && j.rev === rev) return { ok: true, tries: i + 1, build, rev };
    } catch (e) { last = { error: String(e && e.message || e) }; }
  }
  let why;
  if (!last || last.error) why = 'the worker did not answer (' + ((last && last.error) || 'nothing') + ')';
  else if (last.status !== 200) why = 'the worker answered HTTP ' + last.status;
  else if (!last.rev && !last.build) why = 'the worker answers without a build or revision: the old code is still serving';
  else if (last.build !== build) why = 'the worker answers build ' + last.build + ' (revision ' + last.rev + '), not ' + build + ': the old code is still serving';
  else why = 'the worker answers revision ' + last.rev + ', not ' + rev + ': another upload is serving';
  return { ok: false, why, last, tries };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const [cmd, ...a] = process.argv.slice(2);
  const opt = k => { const i = a.indexOf(k); return i >= 0 ? Number(a[i + 1]) : undefined; };
  try {
    if (cmd === 'expect') { const src = fs.readFileSync(a[0], 'utf8'); console.log(JSON.stringify({ build: readBuild(src), rev: gitRev(a[0]) })); }
    else if (cmd === 'stamp') { const out = stamp(fs.readFileSync(a[0], 'utf8'), a[2]); if (/[^\x00-\x7F]/.test(out)) throw new Error('the stamped copy is not pure ASCII'); fs.writeFileSync(a[1], out); console.log('stamped ' + a[1] + ' with revision ' + a[2]); }
    else if (cmd === 'verify') {
      const r = await verify(a[0], a[1], a[2], { tries: opt('--tries'), interval: opt('--interval') });
      if (r.ok) { console.log('verified: the live worker answers build ' + r.build + ', revision ' + r.rev + ' (after ' + r.tries + ' read' + (r.tries === 1 ? '' : 's') + ')'); }
      else { console.error('NOT VERIFIED after ' + r.tries + ' reads: ' + r.why + '. Expected build ' + a[1] + ', revision ' + a[2] + '.'); process.exit(1); }
    } else { console.error('usage: deploy-verify.mjs expect <src> | stamp <src> <out> <rev> | verify <url> <build> <rev> [--tries N] [--interval MS]'); process.exit(2); }
  } catch (e) { console.error(String(e && e.message || e)); process.exit(1); }
}
