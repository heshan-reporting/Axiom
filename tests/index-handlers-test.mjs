/* S30 (SEC-04): the legacy views build inline handlers (onclick="f('...')") from data - a news outlet's name, a topic word, a
 * knowledge-map node. The browser decodes the attribute's entities before the JS engine reads it, so HTML escaping alone lets
 * an apostrophe end the string and the rest of the text run as code. Every such handler in docs/index.html must pass its data
 * through jsAttr(), and jsAttr() must hand the handler exactly the text it was given.
 * Node only. Run: node tests/index-handlers-test.mjs */
import fs from 'node:fs';
const H = fs.readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
console.log('index-handlers-test (inline handlers built from data are JS-string safe)');
const line = n => H.split('\n').find(l => l.startsWith(n));
const esc = eval(line('const esc=').slice(10).replace(/;\s*$/, ''));
const jsAttr = (function () { const src = line('const jsAttr='); return src ? eval('(function(esc){return ' + src.slice(13).replace(/;\s*$/, '') + '})')(esc) : null; })();
ok(typeof jsAttr === 'function', 'jsAttr() is defined beside esc()');
const dec = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
if (jsAttr) for (const t of ["Women's Agenda", "x');import('//ev.il/p')//", 'back\\slash', 'two\nlines', '"quoted" <b>']) {
  const handler = dec('filterSrc(\'' + jsAttr(t) + '\',this)'); let got = null, err = null;
  try { new Function('filterSrc', handler)(v => { got = v; }); } catch (e) { err = e.message; }
  ok(!err && got === t.replace(/\n/g, ' '), 'round trip of ' + JSON.stringify(t) + ' -> ' + (err || JSON.stringify(got)));
}
// every inline handler that opens a single-quoted string around a concatenation passes the value through jsAttr()
const bad = [];
H.split('\n').forEach((l, i) => {
  const re = /\son[a-z]+="[^"]*?\\''\+([^+]+?)\+'\\'/g; let m;
  while ((m = re.exec(l))) { const expr = m[1].trim(); if (!/^jsAttr\(/.test(expr)) bad.push((i + 1) + ': ' + expr); }
});
ok(!bad.length, 'every inline handler built from data uses jsAttr(): ' + (bad.length ? bad.slice(0, 12).join(' | ') : 'none left'));
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
