/* explain() in docs/studio.js - what a person reads when the worker refuses or fails - checked against every Studio error code
 * the worker can send (S27, 4 November 2026). It used to tell a step gate ("workflow_locked") to "unlock the field", call a
 * cross-project or a person-only refusal a read-only key, and show a bare code ("unknown_asset") as the explanation.
 * Node only: the function is read out of the page's source. Run: node tests/studio-explain-test.mjs */
import fs from 'node:fs';
const S = fs.readFileSync(new URL('../docs/studio.js', import.meta.url), 'utf8');
const W = fs.readFileSync(new URL('../axiomworkerv4.js', import.meta.url), 'utf8');
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
console.log('studio-explain-test (every Studio error code the worker sends, as the page explains it)');
const a = S.indexOf('  /** S27: refusals the worker explains'); const e0 = S.indexOf('  function explain(e, what) {');
ok(a > 0 && e0 > a, 'the helpers sit before explain() in docs/studio.js');
const explain = new Function(S.slice(a > 0 ? a : e0, S.indexOf('\n  }\n', e0) + 4) + '\nreturn explain;')();
// the codes and statuses of the Studio's own routes and stages: {..., error: 'code', ... status: N} or jsonResp({...error: 'code'...}, N)
const rows = new Map();
W.split('\n').forEach(l => {
  if (!/studio|brand|review|st[A-Z]/.test(l)) return;
  const re = /\{([^{}]*?)error:\s*'([a-z_0-9]+)'([^{}]*)\}\)?\s*(?:,\s*(\d{3}))?/g; let m;
  while ((m = re.exec(l))) { const inner = m[1] + m[3]; const sm = inner.match(/status:\s*(\d{3})/); const st = +(m[4] || (sm && sm[1]) || 0); if (!st) continue; const k = m[2] + '|' + st; const det = /detail/.test(inner); if (!rows.has(k)) rows.set(k, { code: m[2], status: st, detail: det }); else if (det) rows.get(k).detail = true; }
});
ok(rows.size >= 60, 'found the Studio\'s error codes in the worker: ' + rows.size);
const RAW = /\b[a-z]+_[a-z0-9]+(?:_[a-z0-9]+)*\b/;
const leaks = [], misread = [];
for (const r of rows.values()) {
  for (const msg of r.detail ? ['The worker said what happened.', r.code] : [r.code]) {
    const x = explain({ code: r.code, status: r.status, message: msg }, 'That did not work');
    if (RAW.test(x.title) || RAW.test(x.text)) leaks.push(r.code + '/' + r.status + ': ' + x.title + ' | ' + x.text.slice(0, 80));
    if (/can read but not change/.test(x.title) && r.code !== 'read_only') misread.push(r.code);
    if (/element is locked/.test(x.title) && r.code !== 'locked' && r.code !== 'layout_locked') misread.push(r.code);
  }
}
ok(!leaks.length, 'no explanation shows a bare code to the person' + (leaks.length ? ': ' + leaks.slice(0, 8).join(' || ') : ''));
ok(!misread.length, 'no refusal is explained as a read-only key or a locked element unless it is one' + (misread.length ? ': ' + misread.join(', ') : ''));
const gate = explain({ code: 'workflow_locked', status: 409, message: 'Confirm the strategy first.' });
ok(gate.title === 'This step is not open yet' && /Confirm the strategy first\./.test(gate.text) && !/[Uu]nlock/.test(gate.text), 'a step gate names what it needs and never says unlock: ' + gate.title + ' | ' + gate.text);
ok(/another project/.test(explain({ code: 'cross_project', status: 403, message: 'cross_project' }).title), 'cross_project says another project');
ok(/person/.test(explain({ code: 'human_only', status: 403, message: 'Approval is a person\'s decision; a model verdict never approves.' }).title), 'human_only says only a person approves');
ok(/can read but not change/.test(explain({ code: 'read_only', status: 403, message: 'read_only' }).title), 'read_only is still the read-only key');
ok(/That asset was not found/.test(explain({ code: 'unknown_asset', status: 404, message: 'unknown_asset' }).title), 'unknown_asset is said in words');
const lk = explain({ code: 'locked', status: 409, message: 'The headline is locked.' }); ok(/element is locked/.test(lk.title), 'an element lock is still an element lock');
ok(/Something failed on the worker/.test(explain({ code: 'internal_error', status: 500, message: 'internal_error', requestId: 'abc' }).title), 'an internal error keeps its request id path');
// S30 (QA9): the wrong-key lockout is named as what it is, never "the worker asked to slow down"
{ const x = explain({ code: 'too_many_attempts', status: 429, message: 'Too many failed access-key attempts from this address. Wait ten minutes and try again.' }, 'The project library did not load');
  ok(/Too many wrong access keys/.test(x.title) && !/slow down/.test(x.title + x.text) && /ten minutes/.test(x.text), 'the wrong-key lockout is named: ' + x.title); }
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
