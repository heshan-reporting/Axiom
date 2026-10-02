/* Diagnostics: every answer carries a request id the browser may read, an unhandled failure answers 500 with that id
 * (and nothing of the failure's text), and the log line it writes has the id and no secret - provider keys travel in
 * URLs and headers, so they are struck out first. Run: node --experimental-sqlite tests/diagnostics-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('diagnostics-worker (request ids, redacted logs, a safe answer for an unhandled failure)');
const w = await workerEnv();
const SECRET_URL = 'https://generativelanguage.googleapis.com/v1/models?key=AIzaSyFAKEFAKEFAKEFAKEFAKEFAKE12345&alt=json';
const SECRET_AUTH = 'Bearer sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789';

await T.t('every answer carries a 16-character request id, a different one each time, exposed to the browser', async () => {
  const a = await w.call('GET', '/archive/stats'); const b = await w.call('GET', '/studio/status', null, 'full-key');
  const ra = a.headers.get('X-Request-Id'), rb = b.headers.get('X-Request-Id');
  ok(/^[0-9a-z]{16}$/.test(ra || '') && /^[0-9a-z]{16}$/.test(rb || ''), ra + ' / ' + rb); ok(ra !== rb, 'distinct ids');
  ok(/X-Request-Id/i.test(a.headers.get('Access-Control-Expose-Headers') || ''), 'CORS exposes the id');
  const denied = await w.call('GET', '/studio/status'); ok(denied.status === 401 && denied.headers.get('X-Request-Id'), 'refusals carry one too');
});
await T.t('an unhandled failure answers 500 internal_error with the request id, never the failure text', async () => {
  const w2 = await workerEnv(); const logs = []; const realLog = console.log; console.log = (...a) => logs.push(a.join(' '));
  Object.defineProperty(w2.env, 'AXIOM_KEYS', { configurable: true, get() { throw new Error('upstream refused ' + SECRET_URL + ' with ' + SECRET_AUTH); } });
  let r; try { r = await w2.call('GET', '/studio/status', null, 'full-key'); } finally { console.log = realLog; w2.restore(); }
  eq([r.status, r.body.error], [500, 'internal_error']);
  eq(r.body.requestId, r.headers.get('X-Request-Id'), 'the body and the header name the same id');
  ok(!/AIza|sk-ant|generativelanguage/.test(r.text), 'the answer carries nothing of the failure: ' + r.text.slice(0, 160));
  const line = logs.find(l => l.indexOf(r.body.requestId) >= 0); ok(line, 'a log line names the id: ' + logs.join(' | ').slice(0, 200));
  ok(/"level":"error"/.test(line) && /\/studio\/status/.test(line), line);
  ok(!/AIzaSyFAKEFAKEFAKE|abcdefghijklmnopqrstuvwxyz0123456789/.test(logs.join('\n')), 'no secret in any log line: ' + line);
});
await T.t('redaction strikes keys from URLs, bearer tokens, provider key shapes and key headers, and leaves the rest', async () => {
  const { axRedact } = w.mod.__test;
  const out = axRedact('GET ' + SECRET_URL + ' ' + SECRET_AUTH + ' X-Axiom-Key: k_live_12345678 token=abc123&q=fuel EAAGm0PX4ZCpsBAFAKEFAKEFAKEFAKEFAKE');
  ok(!/AIzaSyFAKEFAKE|abcdefghijklmnopqrstuvwxyz|k_live_12345678|abc123|EAAGm0PX4ZCpsBAFAKEFAKE/.test(out), out);
  ok(/q=fuel/.test(out) && /generativelanguage\.googleapis\.com/.test(out) && /alt=json/.test(out), 'ordinary text is kept: ' + out);
  eq(axRedact('Mining employs 300,000 Australians'), 'Mining employs 300,000 Australians');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
