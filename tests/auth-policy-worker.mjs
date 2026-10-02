/* The access policy, as a matrix: every route that acts (sends a message, attaches to ClickUp, spends a model call,
 * collects, probes a live service, writes) against missing, invalid, read-only and full credentials, plus a roster
 * with an unrecognised role and a worker with no keys at all. A rejected request must never reach an outbound
 * provider: the recording fetch proves it. Providers are MOCKED.
 * Run: node --experimental-sqlite tests/auth-policy-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('auth-policy-worker (route and method permissions; providers MOCKED)');
let ipn = 1; const ip = () => ({ 'CF-Connecting-IP': '198.51.100.' + ((ipn++ % 250) + 1) });
const SECRETS = { WA_TOKEN: 'wa', WA_PHONE_ID: '123', CLICKUP_TOKEN: 'cu', GEMINI_KEY: 'g', ANTHROPIC_API_KEY: 'a', META_TOKEN: 'm', SIFA_TOKEN: 's' };
const w = await workerEnv({ env: SECRETS });
await w.call('GET', '/studio/status', null, 'full-key');
// every route here causes an outbound call, a model call, a message, a collection or a write when it is allowed
const ACTS = [
  ['POST', '/whatsapp', { to: '+61400000000', text: 'hello' }],
  ['POST', '/clickup-attach', { taskId: 't1', b64: 'aGk=' }],
  ['POST', '/clickup', { name: 'x', listId: '1' }],
  ['GET', '/collect?topics=housing'],
  ['GET', '/fetchurl?url=' + encodeURIComponent('https://example.com/article')],
  ['GET', '/sources/probe?id=abc'],
  ['GET', '/topics/probe'],
  ['GET', '/meta/status?probe=1'],
  ['GET', '/reddit/status?probe=1'],
  ['GET', '/social/coverage?probe=1'],
  ['GET', '/reddit/comments?thread=abc&live=1'],
  ['POST', '/studio/project', { ns: 'mca', title: 'x' }],
  ['POST', '/nano', { prompt: 'x' }],
  ['POST', '/chat', { messages: [] }],
];
const reach = async (cred, m, p, b) => { const n0 = w.outbound.length; const r = await w.call(m, p, b, cred, ip()); return { r, out: w.outbound.slice(n0) }; };

await T.t('no key: every acting route answers 401 and nothing reaches a provider', async () => {
  for (const [m, p, b] of ACTS) { const { r, out } = await reach(null, m, p, b); eq(r.status, 401, m + ' ' + p); eq(out.map(x => x.url), [], m + ' ' + p + ' reached a provider'); }
});
await T.t('a wrong key: 401 for every acting route, nothing outbound', async () => {
  for (const [m, p, b] of ACTS) { const { r, out } = await reach('not-a-key', m, p, b); eq(r.status, 401, m + ' ' + p); eq(out.length, 0, m + ' ' + p); }
});
await T.t('a read-only key: 403 read_only for every acting route (GETs that probe, collect or spend included), nothing outbound', async () => {
  for (const [m, p, b] of ACTS) { const { r, out } = await reach('read-key', m, p, b); eq([r.status, r.body && r.body.error], [403, 'read_only'], m + ' ' + p); eq(out.length, 0, m + ' ' + p); }
});
await T.t('a full key passes the gate on every acting route (the provider is reached where the route calls one)', async () => {
  for (const [m, p, b] of ACTS) { const { r } = await reach('full-key', m, p, b); ok(r.status !== 401 && r.status !== 403, m + ' ' + p + ' -> ' + r.status + ' ' + r.text.slice(0, 120)); }
  const { out } = await reach('full-key', 'POST', '/whatsapp', { to: '+61400000000', text: 'hello' }); ok(out.some(x => /graph\.facebook\.com/.test(x.url)), 'the message was handed to the provider');
});
await T.t('GETs that act stay full-only for read keys, as before: claiming a bridge job, Meta sync, the archive self-test, the Mind analyser, logs', async () => {
  for (const p of ['/bridge/next?caps=reddit', '/meta/sync', '/archive/selftest', '/mind/analyze', '/log/chat', '/sentinel/ack', '/research?q=x', '/session/save']) {
    const { r, out } = await reach('read-key', 'GET', p); eq([r.status, (r.body || {}).error], [403, 'read_only'], p); eq(out.length, 0, p);
  }
  for (const p of ['/bridge/job?id=x', '/bridge/status', '/mind/query?q=x', '/sentinel/alerts', '/meta/status']) { const { r } = await reach('read-key', 'GET', p); ok(r.status !== 403 && r.status !== 401, 'read ' + p + ' -> ' + r.status); }
});
await T.t('reads: no key is 401 on the news and data routes; a read key reads them', async () => {
  for (const p of ['/allnews', '/trends', '/analysis', '/history', '/census', '/wiki?article=Australia', '/collect-status', '/studio/list?ns=mca', '/mind/docs?ns=mca']) {
    const a = await reach(null, 'GET', p); eq(a.r.status, 401, 'no key ' + p); eq(a.out.length, 0, 'no key ' + p);
    const b = await reach('read-key', 'GET', p); ok(b.r.status !== 401 && b.r.status !== 403, 'read ' + p + ' -> ' + b.r.status);
  }
});
await T.t('public by design: /archive/stats and the health answer need no key; review and SIFA routes use their own tokens, not the AXIOM key', async () => {
  eq((await reach(null, 'GET', '/archive/stats')).r.status !== 401, true, '/archive/stats');
  eq((await reach(null, 'GET', '/')).r.status, 200, 'health');
  const rv = await reach(null, 'GET', '/review/get'); ok(rv.r.status !== 200 && (rv.r.body || {}).error !== 'unauthorized', 'the review route answers with its own token check: ' + rv.r.text.slice(0, 100));
  const sf = await reach('full-key', 'POST', '/sifa/keywords', { keywords: ['x'] }); ok(sf.r.status === 401 || sf.r.status === 503 || sf.r.status === 501, 'an AXIOM key is not a SIFA bearer: ' + sf.r.status);
});
await T.t('every write method needs a full key, whatever the path (including paths the policy has never heard of)', async () => {
  for (const m of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    eq((await reach('read-key', m, '/something/new', {})).r.status, 403, m + ' read');
    eq((await reach(null, m, '/something/new', {})).r.status, 401, m + ' none');
  }
});

/* configuration that must fail closed */
await T.t('an unrecognised role in the roster closes the worker (it no longer means full access)', async () => {
  const x = await workerEnv({ keys: { 'admin-key': { n: 'Typo', r: 'admin' }, 'ok-key': { n: 'Fine', r: 'full' } }, env: SECRETS });
  const r = await x.call('POST', '/studio/project', { ns: 'mca', title: 'x' }, 'admin-key', ip());
  eq([r.status, r.body.error], [401, 'auth_misconfigured']); ok(/role/.test(r.body.detail), r.body.detail);
  const r2 = await x.call('POST', '/whatsapp', { to: '+61400000000', text: 'x' }, 'ok-key', ip()); eq(r2.status, 401, 'a valid key does not open a misconfigured roster');
  ok(!x.outbound.some(o => /facebook/.test(o.url)), 'nothing sent'); x.restore();
});
await T.t('the single admin key (its own secret) still opens beside a broken roster, so the roster can be repaired', async () => {
  const x = await workerEnv({ keys: { 'admin-key': { r: 'admin' } }, env: { AXIOM_ACCESS_KEY: 'break-glass-key' } });
  ok((await x.call('POST', '/studio/project', { ns: 'mca', title: 'x' }, 'break-glass-key', ip())).status === 200, 'admin key works');
  eq((await x.call('GET', '/allnews', null, 'admin-key', ip())).body.error, 'auth_misconfigured', 'the roster keys stay closed'); x.restore();
});
await T.t('a role missing from a roster entry is invalid, not full', async () => {
  const x = await workerEnv({ keys: { 'k': { n: 'No role' } } });
  eq((await x.call('POST', '/studio/project', { ns: 'mca', title: 'x' }, 'k', ip())).body.error, 'auth_misconfigured'); x.restore();
});
await T.t('no keys configured: closed (503 auth_not_configured), not open', async () => {
  const x = await workerEnv({ keys: null, env: SECRETS });
  const r = await x.call('POST', '/whatsapp', { to: '+61400000000', text: 'x' }, null, ip()); eq([r.status, r.body.error], [503, 'auth_not_configured']); eq(x.outbound.length, 0);
  eq((await x.call('GET', '/allnews', null, null, ip())).status, 503, 'reads closed too');
  eq((await x.call('GET', '/archive/stats', null, null, ip())).status !== 503, true, 'public stays public'); x.restore();
});
await T.t('the development switch opens only a local origin: AXIOM_DEV_OPEN=1 on a workers.dev host stays closed', async () => {
  const x = await workerEnv({ keys: null, env: Object.assign({ AXIOM_DEV_OPEN: '1' }, SECRETS) });
  eq((await x.call('POST', '/studio/project', { ns: 'mca', title: 'x' }, null, ip())).status, 503, 'production host'); x.restore();
  const y = await workerEnv({ keys: null, origin: 'http://localhost:8787', env: Object.assign({ AXIOM_DEV_OPEN: '1' }, SECRETS) });
  const r = await y.call('POST', '/studio/project', { ns: 'mca', title: 'dev' }, null, ip()); ok(r.status === 200 || r.status === 201, 'local dev origin is open: ' + r.status + ' ' + r.text.slice(0, 100)); y.restore();
  const z = await workerEnv({ keys: null, origin: 'http://localhost:8787', env: SECRETS });
  eq((await z.call('POST', '/studio/project', { ns: 'mca', title: 'x' }, null, ip())).status, 503, 'local without the switch stays closed'); z.restore();
});
await T.t('a user-supplied URL to a private, local or credentialed address is refused before any fetch', async () => {
  for (const u of ['http://127.0.0.1/x', 'http://localhost:8080/', 'http://10.0.0.5/', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]/', 'https://user:pass@example.com/', 'http://192.168.1.1/', 'file:///etc/passwd', 'https://example.internal/']) {
    const n0 = w.outbound.length; const r = await w.call('GET', '/fetchurl?url=' + encodeURIComponent(u), null, 'full-key', ip());
    eq(r.status, 400, u + ' -> ' + r.text.slice(0, 80)); eq(w.outbound.length, n0, u + ' was fetched');
    const r2 = await w.call('GET', '/forum-detect?url=' + encodeURIComponent(u), null, 'full-key', ip()); eq(r2.status, 400, 'forum-detect ' + u); eq(w.outbound.length, n0, 'forum-detect fetched ' + u);
  }
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
