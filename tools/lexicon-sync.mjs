#!/usr/bin/env node
/* The client lexicon has one source: CLIENT_ISSUES in the worker. Two files carry a copy of its WIDE matchers and
 * search terms so they can tag without asking the worker: the page (AX_ISSUES in docs/index.html) and the Mac
 * collector's fallback (ISSUES, ISSUE_NS, ISSUE_Q in tools/reach-reddit.py). This writes both copies from the worker.
 *
 *   node tools/lexicon-sync.mjs            rewrite the copies
 *   node tools/lexicon-sync.mjs --check    change nothing; exit 1 and say which copy has drifted
 *
 * The page keeps its own short client names, labels and single search term for issues it already lists; a new issue
 * takes the client name its namespace already uses on the page, the worker's label and the first search term.
 * The Australian gate (AU_RX, AU_QUERY_RX) is not generated: it is kept by hand in the worker and the collector. */
import fs from 'node:fs';
process.on('warning', () => {});
const root = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const { __test } = await import(new URL('axiomworkerv4.js', root).href);
const issues = __test.CLIENT_ISSUES.map(ci => ({ id: ci.id, ns: ci.ns, client: ci.client, label: ci.label, wide: (ci.wide || ci.rx).source, q: ci.q || [] }));
const drift = [];
const put = (rel, next, prev) => { if (next === prev) return; drift.push(rel); if (!check) fs.writeFileSync(new URL(rel, root), next); };

/* ---- the page ---- */
{
  const rel = 'docs/index.html'; const html = fs.readFileSync(new URL(rel, root), 'utf8');
  const a = html.indexOf('const AX_ISSUES=['); const b = html.indexOf('\n];', a);
  if (a < 0 || b < 0) throw new Error('AX_ISSUES not found in ' + rel);
  const old = new Function('return ' + html.slice(a + 'const AX_ISSUES='.length, b + 2))();
  const byId = Object.fromEntries(old.map(x => [x.id, x])); const clientOf = {}; old.forEach(x => { if (!clientOf[x.ns]) clientOf[x.ns] = x.client; });
  const js = v => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const lines = issues.map(i => { const o = byId[i.id] || {};
    return ' {id:' + js(i.id) + ',ns:' + js(i.ns) + ',client:' + js(o.client || clientOf[i.ns] || i.client) + ',label:' + js(o.label || i.label) + ',q:' + js(o.q || i.q[0] || i.label.toLowerCase()) + ',rx:/' + i.wide + '/i},'; });
  put(rel, html.slice(0, a) + 'const AX_ISSUES=[\n' + lines.join('\n') + html.slice(b), html);
}

/* ---- the Mac collector's fallback ---- */
{
  const rel = 'tools/reach-reddit.py'; const py = fs.readFileSync(new URL(rel, root), 'utf8');
  const raw = s => (s.indexOf("'") < 0 ? "r'" + s + "'" : s.indexOf('"') < 0 ? 'r"' + s + '"' : "r'''" + s + "'''");
  const str = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const block = (text, startRx, endLine, body) => { const m = startRx.exec(text); if (!m) throw new Error(startRx + ' not found in ' + rel); const e = text.indexOf('\n' + endLine + '\n', m.index); if (e < 0) throw new Error('end of ' + startRx + ' not found'); return text.slice(0, m.index) + body + text.slice(e + endLine.length + 1); };
  let out = py;
  out = block(out, /^ISSUES = \[$/m, ']', 'ISSUES = [\n' + issues.map(i => '    (' + str(i.id) + ', re.compile(' + raw(i.wide) + ', re.I)),').join('\n') + '\n]');
  { const m = /^ISSUE_NS = \{[^}]*\}$/m.exec(out); if (!m) throw new Error('ISSUE_NS not found in ' + rel);
    out = out.slice(0, m.index) + 'ISSUE_NS = {\n' + issues.map(i => '    ' + str(i.id) + ': ' + str(i.ns) + ',').join('\n') + '\n}' + out.slice(m.index + m[0].length); }
  out = block(out, /^ISSUE_Q = \{$/m, '}', 'ISSUE_Q = {\n' + issues.map(i => '    ' + str(i.id) + ': [' + i.q.map(str).join(', ') + '],').join('\n') + '\n}');
  put(rel, out, py);
}

if (check && drift.length) { console.error('lexicon copies have drifted from CLIENT_ISSUES in the worker: ' + drift.join(', ') + '\nRun: node tools/lexicon-sync.mjs'); process.exit(1); }
console.log(check ? 'lexicon copies match the worker (' + issues.length + ' issues)' : (drift.length ? 'rewrote ' + drift.join(', ') : 'nothing to change') + ' (' + issues.length + ' issues)');
process.exit(0);
