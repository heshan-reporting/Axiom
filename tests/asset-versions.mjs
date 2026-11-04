/* S30 (AUD-1): every page asset docs/index.html loads with a release query (studio.js?v=r31, ax-ui.js?v=r3, ...) is cached by
 * browsers under that address, so a file whose bytes change while its query stays the same reaches nobody who has the old one.
 * tests/asset-versions.json records each asset's query and the hash of its bytes; the check fails when the bytes changed and the
 * query did not (bump the query in docs/index.html), or when the query changed and the record did not (run with --write).
 *   node tests/asset-versions.mjs           check (run by tests/run.mjs check)
 *   node tests/asset-versions.mjs --write   record the current queries and hashes after bumping */
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const REC = path.join(ROOT, 'tests', 'asset-versions.json');
export function assets() {
  const html = fs.readFileSync(path.join(ROOT, 'docs', 'index.html'), 'utf8'); const out = {};
  for (const m of html.matchAll(/(?:src|href)="([^"?:]+)\?v=([^"&]+)"/g)) {
    const f = m[1]; const p = path.join(ROOT, 'docs', f); if (!fs.existsSync(p)) continue;
    out[f] = { v: m[2], sha: crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 16) };
  }
  return out;
}
export function problems() {
  const now = assets(); const rec = fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : {}; const bad = [];
  for (const f of Object.keys(now)) {
    const r = rec[f];
    if (!r) { bad.push(f + ': not recorded (run node tests/asset-versions.mjs --write)'); continue; }
    if (r.sha !== now[f].sha && r.v === now[f].v) bad.push(f + ': its bytes changed but its query is still ?v=' + r.v + ' (bump it in docs/index.html, then --write)');
    else if (r.v !== now[f].v && r.sha !== now[f].sha) bad.push(f + ': bumped to ?v=' + now[f].v + ' but the record is not (run --write)');
    else if (r.v !== now[f].v) bad.push(f + ': query changed to ?v=' + now[f].v + ' with the same bytes; record it (--write)');
  }
  return bad;
}
if (process.argv[1] && process.argv[1].endsWith('asset-versions.mjs')) {
  if (process.argv.includes('--write')) { fs.writeFileSync(REC, JSON.stringify(assets(), null, 1) + '\n'); console.log('recorded ' + Object.keys(assets()).length + ' assets'); }
  else { const b = problems(); console.log(b.length ? b.join('\n') : 'every versioned asset matches its record'); process.exit(b.length ? 1 : 0); }
}
