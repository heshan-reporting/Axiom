/* One command for the checks and every harness: node tests/run.mjs check|backend|browser|all   (npm run check / test:backend / test:browser / test)
 *   check   - worker syntax, the worker is pure ASCII, the layout rules are byte-identical in worker and renderer,
 *             the page scripts parse, nothing private sits in docs/ (GitHub Pages serves it), package files are valid JSON
 *   backend - every worker and tool harness that needs no browser (the worker in-process over SQLite; providers MOCKED),
 *             plus the Python tool tests
 *   browser - the harnesses that drive Chromium through Playwright (npm ci && npx playwright install chromium)
 * Each harness is its own process; a failure anywhere makes the exit code non-zero and the summary names it. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs'; import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const T = p => path.join(ROOT, 'tests', p);
const mode = process.argv[2] || 'all';
const results = [];
const run = (name, cmd, args, timeoutMs) => {
  const t0 = Date.now(); const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', timeout: timeoutMs || 900000, maxBuffer: 64 * 1024 * 1024 });
  const out = (r.stdout || '') + (r.stderr || ''); const m = out.match(/(\d+) passed, (\d+) failed/g); const last = m ? m[m.length - 1] : '';
  const ok = r.status === 0 && !/[1-9]\d* failed/.test(last);
  results.push({ name, ok, summary: last || (r.error ? String(r.error.message) : 'exit ' + r.status), ms: Date.now() - t0 });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + '  ' + (last || 'exit ' + r.status) + '  (' + Math.round((Date.now() - t0) / 1000) + 's)');
  if (!ok) { const L = out.split('\n'); const keep = []; L.forEach((l, i) => { if (/FAIL|Error/.test(l)) for (let j = i; j < Math.min(L.length, i + 4); j++) if (keep.indexOf(j) < 0) keep.push(j); }); console.log(keep.slice(0, 40).map(j => '       ' + L[j].slice(0, 260)).join('\n')); }
};
const check = (name, fn) => { try { const r = fn(); const ok = r === true || r === undefined; results.push({ name, ok, summary: ok ? 'ok' : String(r) }); console.log((ok ? '  ok   ' : '  FAIL ') + name + (ok ? '' : '  ' + r)); } catch (e) { results.push({ name, ok: false, summary: e.message }); console.log('  FAIL ' + name + '  ' + e.message); } };

const BROWSER = /(-browser|compose-test|showcase-test|demo-test|studio-p23-worker)\.mjs$/;
const suites = fs.readdirSync(T('.')).filter(f => /(-worker|-test)\.mjs$/.test(f) || /-browser\.mjs$/.test(f)).sort();

if (mode === 'check' || mode === 'all') {
  console.log('checks');
  const W = fs.readFileSync(path.join(ROOT, 'axiomworkerv4.js'), 'utf8');
  check('worker syntax (node --check)', () => { const r = spawnSync(process.execPath, ['--check', 'axiomworkerv4.js'], { cwd: ROOT, encoding: 'utf8' }); return r.status === 0 || r.stderr.slice(0, 200); });
  check('worker is pure ASCII (deploy requirement)', () => { const i = W.search(/[^\x00-\x7F]/); return i < 0 || 'non-ASCII at offset ' + i + ': ' + JSON.stringify(W.slice(i - 20, i + 20)); });
  check('layout rules byte-identical in worker and renderer', () => { const R = fs.readFileSync(path.join(ROOT, 'docs/studio-render.js'), 'utf8'); const cut = s => { const x = (s.split('/* RULES:BEGIN */')[1] || '').split('/* RULES:END */')[0].split('\n').map(l => l.trim()).filter(Boolean).join('\n'); return x.length > 1000 ? x : null; }; const a = cut(W), b = cut(R); return (a && a === b) || 'the RULES blocks differ or are missing'; });
  for (const f of ['studio.js', 'studio-guided.js', 'studio-editor.js', 'studio-canvas.js', 'studio-brandmem.js', 'studio-render.js', 'studio-progress.js', 'studio-merge.js', 'ax-ui.js', 'content.js', 'signals.js', 'sources.js', 'sentiment.js', 'narratives.js', 'overview.js', 'scope.js', 'topics.js', 'release.js']) {
    const p = path.join(ROOT, 'docs', f); if (!fs.existsSync(p)) continue;
    check('docs/' + f + ' parses', () => { new Function(fs.readFileSync(p, 'utf8')); return true; });
  }
  check('nothing private in docs/ (GitHub Pages serves it)', () => { const bad = []; const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(py|sh|env|pem|key|sqlite|db)$/i.test(e.name) || /axiomworker|wrangler|^\.dev\.vars/i.test(e.name) || /knowledge|voice-pack|briefs?\//i.test(path.relative(ROOT, p))) bad.push(path.relative(ROOT, p)); }); walk(path.join(ROOT, 'docs')); return !bad.length || bad.join(', '); });
  check('no harness or tool tied to one machine\'s Playwright path (tests/pw.mjs finds it)', () => { const bad = []; for (const d of ['tests', 'tools']) for (const f of fs.readdirSync(path.join(ROOT, d))) { if (!/\.(mjs|js|py)$/.test(f)) continue; const t = fs.readFileSync(path.join(ROOT, d, f), 'utf8'); if (/\/opt\/node\d+\/lib\/node_modules\/playwright/.test(t)) bad.push(d + '/' + f); } return !bad.length || bad.join(', '); });
  check('package.json and package-lock.json are valid JSON', () => { JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')); JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8')); return true; });
}
if (mode === 'backend' || mode === 'all') {
  console.log('backend harnesses (providers MOCKED)');
  for (const f of suites.filter(f => !BROWSER.test(f))) run(f, process.execPath, ['--experimental-sqlite', T(f)]);
  for (const f of fs.readdirSync(T('.')).filter(f => /-test\.py$/.test(f)).sort()) run(f, 'python3', [T(f)]);
}
if (mode === 'browser' || mode === 'all') {
  console.log('browser harnesses (Chromium through Playwright; providers MOCKED)');
  for (const f of suites.filter(f => BROWSER.test(f))) run(f, process.execPath, ['--experimental-sqlite', T(f)], 1500000);
}
const bad = results.filter(r => !r.ok);
console.log('\n' + (results.length - bad.length) + ' of ' + results.length + ' passed' + (bad.length ? '; failing: ' + bad.map(r => r.name).join(', ') : ''));
process.exit(bad.length ? 1 : 0);
