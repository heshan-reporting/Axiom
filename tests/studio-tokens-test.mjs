/* The Studio's design system holds (P52, Phase 6 of prompts/studio-engines-and-canvas.md). Node only, no browser.
 *   TK1 no Studio stylesheet carries a colour of its own: a hex colour appears only in the token files (studio-skin.css,
 *       studio-shell.css) or as the value of a token declaration (--name: ...), such as the light theme in studio-polish.css
 *   TK2 every corner is a radius token: no pixel border-radius outside the token files
 *   TK3 every text token reads on every surface token at WCAG AA (ink 4.5:1; the quiet inks 3:1 for large and secondary
 *       text), in the dark theme and the light one, and the status inks read on the panel
 *   TK4 motion stops under prefers-reduced-motion in every Studio stylesheet that animates
 * Run: node tests/studio-tokens-test.mjs */
import fs from 'node:fs';
const DOCS = new URL('../docs/', import.meta.url);
const read = f => fs.readFileSync(new URL(f, DOCS), 'utf8');
const files = fs.readdirSync(DOCS).filter(f => /^studio.*\.css$/.test(f));
const TOKEN_FILES = ['studio-skin.css', 'studio-shell.css'];
let pass = 0, fail = 0; const t = (name, fn) => { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const ok = (c, m) => { if (!c) throw new Error(m); };
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
console.log('studio-tokens-test (the design system: colours, radii, contrast, motion)');

t('TK1: no hex colour outside the token files or a token declaration', () => {
  const bad = [];
  files.filter(f => TOKEN_FILES.indexOf(f) < 0).forEach(f => strip(read(f)).split(/[;{}]/).forEach(decl => { const m = /^\s*([-a-zA-Z0-9]+)\s*:([\s\S]*)$/.exec(decl); if (!m) return; if (/^--/.test(m[1])) return; const h = m[2].match(/#[0-9a-fA-F]{3,8}\b/g); if (h) bad.push(f + ': ' + m[1] + ': ' + h.join(' ')); }));
  ok(!bad.length, bad.length + ' found:\n       ' + bad.slice(0, 20).join('\n       '));
});
t('TK2: no pixel border-radius outside the token files', () => {
  const bad = []; files.filter(f => TOKEN_FILES.indexOf(f) < 0).forEach(f => { (strip(read(f)).match(/border-radius\s*:[^;}]*\d+px/g) || []).forEach(x => bad.push(f + ': ' + x)); });
  ok(!bad.length, bad.length + ' found:\n       ' + bad.slice(0, 20).join('\n       '));
});

const lum = h => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const theme = (src, rx) => { const blk = (rx.exec(src) || [])[0] || ''; const o = {}; (blk.match(/--sk-[a-z0-9-]+:#[0-9a-fA-F]{3,8}/g) || []).forEach(d => { const [k, v] = d.split(':'); o[k] = v; }); return o; };
t('TK3: every text token reads on every surface token at AA, dark and light', () => {
  const dark = theme(read('studio-skin.css'), /--sk-bg:#[0-9a-fA-F]+[\s\S]*?--sk-bad:#[0-9a-fA-F]+/);
  const light = theme(read('studio-polish.css'), /--sk-bg:#[0-9a-fA-F]+[\s\S]*?--sk-bad:#[0-9a-fA-F]+/);
  const bad = [];
  for (const [name, T] of [['dark', dark], ['light', light]]) {
    ok(T['--sk-ink'] && T['--sk-panel'], name + ' theme tokens not found');
    for (const bg of ['--sk-bg', '--sk-panel', '--sk-raised', '--sk-hover', '--sk-canvas']) {
      if (!T[bg]) continue;
      [['--sk-ink', 4.5], ['--sk-ink-2', 4.5], ['--sk-sub', 4.5], ['--sk-quiet', 3]].forEach(([fg, min]) => { if (!T[fg]) return; const r = ratio(T[fg], T[bg]); if (r < min) bad.push(name + ' ' + fg + ' on ' + bg + ' ' + r.toFixed(2) + ':1 < ' + min); });
    }
    ['--sk-good', '--sk-warn', '--sk-bad'].forEach(fg => { if (T[fg]) { const r = ratio(T[fg], T['--sk-panel']); if (r < 4.5) bad.push(name + ' ' + fg + ' on --sk-panel ' + r.toFixed(2) + ':1 < 4.5'); } });
  }
  ok(!bad.length, bad.join('\n       '));
});
t('TK4: every Studio stylesheet that animates stops under prefers-reduced-motion', () => {
  const bad = files.filter(f => { const s = strip(read(f)); return /(animation\s*:|@keyframes)/.test(s) && !/prefers-reduced-motion/.test(s); });
  ok(!bad.length, 'animates with no reduced-motion rule: ' + bad.join(', '));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
