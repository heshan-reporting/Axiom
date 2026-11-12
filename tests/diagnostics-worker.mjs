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
await T.t('a busy database is 503 db_busy in words on any route, and a database error says it is the database', async () => {
  // the Mac collector's poll answered a bare 500 on the live worker (12 November 2026): outside Anne's Den a database
  // that would not answer was reported as "something failed", with no way for the collector or its owner to tell why
  const w3 = await workerEnv({ keys: { 'full-key': { n: 'Heshan', r: 'full' } } }); await w3.call('GET', '/bridge/status', null, 'full-key');
  const db = w3.env.MIND_DB.db; const orig = db.prepare.bind(db); let boom = null;
  db.prepare = sql => { if (boom && /bridge_jobs/.test(String(sql))) throw new Error(boom); return orig(sql); };
  let busy, bad; try {
    boom = 'D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window. Try again';
    busy = await w3.call('GET', '/bridge/next?agent=macbook&sources=reddit,render,facebook,ytsearch', null, 'full-key');
    boom = 'D1_ERROR: no such column: claimed: SQLITE_ERROR';
    bad = await w3.call('GET', '/bridge/next?agent=macbook&sources=reddit', null, 'full-key');
  } finally { db.prepare = orig; }
  eq([busy.status, busy.body.error, busy.body.retry, busy.body.was], [503, 'db_busy', true, 'bridge_failed'], busy.text.slice(0, 200)); ok(/database is busy/i.test(busy.body.detail) && busy.headers.get('X-Request-Id'), busy.text.slice(0, 200));
  eq([bad.status, bad.body.error], [500, 'bridge_failed'], bad.text.slice(0, 200)); ok(/no such column: claimed/.test(bad.body.detail), 'any other database error keeps the area\'s code and the database\'s own words, for the collector to print: ' + bad.text.slice(0, 240));
  const fine = await w3.call('GET', '/bridge/next?agent=macbook&sources=reddit', null, 'full-key'); eq([fine.status, fine.body.ok], [200, true], 'and the route answers again when the database does');
  // a busy database nothing caught on the way up is the same answer, with the id
  const w4 = await workerEnv(); const realLog2 = console.log; console.log = () => {};
  Object.defineProperty(w4.env, 'AXIOM_KEYS', { configurable: true, get() { throw new Error('D1_ERROR: D1 DB is overloaded. Too many resources consumed within a 10 second window. Try again'); } });
  let up; try { up = await w4.call('GET', '/studio/status', null, 'full-key'); } finally { console.log = realLog2; w4.restore(); }
  eq([up.status, up.body.error, up.body.retry], [503, 'db_busy', true]); eq(up.body.requestId, up.headers.get('X-Request-Id'));
});
await T.t('redaction strikes keys from URLs, bearer tokens, provider key shapes and key headers, and leaves the rest', async () => {
  const { axRedact } = w.mod.__test;
  const out = axRedact('GET ' + SECRET_URL + ' ' + SECRET_AUTH + ' X-Axiom-Key: k_live_12345678 token=abc123&q=fuel EAAGm0PX4ZCpsBAFAKEFAKEFAKEFAKEFAKE');
  ok(!/AIzaSyFAKEFAKE|abcdefghijklmnopqrstuvwxyz|k_live_12345678|abc123|EAAGm0PX4ZCpsBAFAKEFAKE/.test(out), out);
  ok(/q=fuel/.test(out) && /generativelanguage\.googleapis\.com/.test(out) && /alt=json/.test(out), 'ordinary text is kept: ' + out);
  eq(axRedact('Mining employs 300,000 Australians'), 'Mining employs 300,000 Australians');
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
