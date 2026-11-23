/* Core feeds off by default (build p73), from Kai's ClickUp ticket of 16 November 2026 ("Newsroom Irrelevant Result": a
 * vacuum deal from the OzBargain deals feed on the MCA Newsroom). The worker takes every post in a feed it reads, so the
 * deals feed is now switched off by default (CORE_OFF_DEFAULT) and stays in the registry for the operator to turn on:
 *   1. the seed marks ozbargain off and nothing else; the Sources view lists it as off
 *   2. /allnews never reads the feed, and no story from it reaches the wire
 *   3. the KV mirror of the off list expires (90-day TTL): it is rebuilt from the registry, the feed stays off
 *   4. the operator turns it on from the Sources view: it is read again, and a later reseed leaves that choice alone
 *   5. a registry that still has the feed on and never edited (the live registry before p73) is switched off by the seed
 *   6. with no registry at all, the feeds off by default stay off
 * Run: node --experimental-sqlite tests/newsroom-off-worker.mjs */
import { D1Lite } from './d1lite.mjs';
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
process.on('warning', () => {});

const kv = new Map();
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); },
    list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })) }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async () => {}, get: async () => null, delete: async () => {} },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
};
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };
async function drain() { for (let i = 0; i < 5 && ctx.waits.length; i++) { const w = ctx.waits.splice(0); await Promise.allSettled(w); } }

const mod = await import(WORKER);
const { AU_FEEDS, CORE_OFF_DEFAULT, buildAllNews, sourcesSeed } = mod.__test;
const handler = mod.default;
const byUrl = {}; Object.keys(AU_FEEDS).forEach(k => { byUrl[AU_FEEDS[k]] = k; });
const NOW = Date.now();
const rss = (key) => '<?xml version="1.0"?><rss><channel><title>' + key + '</title><item><title><![CDATA[' + (key === 'ozbargain' ? 'Dyson V15 Detect Absolute $749 delivered @ Amazon AU' : 'A story from ' + key) + ']]></title><link>https://' + key + '.test/story</link><pubDate>' + new Date(NOW - 3600e3).toUTCString() + '</pubDate><description>' + (key === 'ozbargain' ? 'Cheapest ever for this stick vacuum.' : 'Politics.') + '</description></item></channel></rss>';
const fetched = [];
globalThis.fetch = async (url) => {
  const u = String(url); const key = byUrl[u];
  if (key) { fetched.push(key); return new Response(rss(key), { status: 200, headers: { 'content-type': 'application/rss+xml' } }); }
  return new Response('', { status: 404 });
};
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx);
  let d = null; try { d = await res.json(); } catch (e) { d = null; }
  return { status: res.status, d };
}
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const db = env.MIND_DB.db;
const row = (sql, ...a) => db.prepare(sql).get(...a);
const srcRow = () => row('SELECT enabled, edited, core FROM sources WHERE id=?', 'ozbargain');
const allnews = async () => { fetched.length = 0; const r = await req('GET', '/allnews?debug=1&max=120', null, 'read-key'); await drain(); return r.d; };

console.log('newsroom-off-worker harness (build p73: core feeds off by default)');
let core = 0;
await t('1. the seed marks ozbargain off and nothing else; the Sources view lists it as off', async () => {
  eq([...CORE_OFF_DEFAULT], ['ozbargain']);
  ok(AU_FEEDS.ozbargain, 'the feed stays in AU_FEEDS so it can be turned back on');
  const r = await req('GET', '/sources', null, 'read-key'); eq(r.status, 200);
  core = r.d.summary.core; ok(core > 50, 'core feeds: ' + core);
  const oz = r.d.sources.find(s => s.id === 'ozbargain'); ok(oz, 'the row exists');
  eq(oz.enabled, false); eq(oz.core, true); eq(oz.edited, false, 'off by the seed, not by an edit');
  eq(r.d.sources.filter(s => s.core && s.enabled === false).map(s => s.id), ['ozbargain'], 'no other core feed is off');
  const off = await req('GET', '/sources?status=off', null, 'read-key'); ok(off.d.sources.some(s => s.id === 'ozbargain'));
  eq(JSON.parse(kv.get('sources_core_off')), ['ozbargain'], 'the KV mirror buildAllNews reads');
});
await t('2. /allnews never reads the feed; no deal reaches the wire; every other core feed is read', async () => {
  const d = await allnews();
  eq(fetched.indexOf('ozbargain'), -1, 'not fetched');
  eq(d.feeds, core - 1, 'feeds read: ' + d.feeds);
  ok(d.items.length > 0 && !d.items.some(i => i.src === 'ozbargain' || /Dyson/.test(i.title)), 'no deal on the wire');
  ok(fetched.indexOf('abc') >= 0 && fetched.length === core - 1, 'the others were read: ' + fetched.length);
});
await t('3. the KV mirror expires: rebuilt from the registry, the feed stays off', async () => {
  kv.delete('sources_core_off');
  const d = await allnews();
  eq(fetched.indexOf('ozbargain'), -1, 'still not fetched after the mirror expired'); eq(d.feeds, core - 1);
  eq(JSON.parse(kv.get('sources_core_off')), ['ozbargain'], 'the mirror is back');
});
await t('4. the operator turns it on from the Sources view: read again; a later reseed leaves the choice alone', async () => {
  const r = await req('POST', '/sources/update', { id: 'ozbargain', enabled: true }); eq(r.status, 200);
  eq(r.d.source.enabled, true); eq(r.d.source.edited, true);
  eq(JSON.parse(kv.get('sources_core_off')), []);
  const d = await allnews();
  ok(fetched.indexOf('ozbargain') >= 0, 'fetched once switched on'); eq(d.feeds, core);
  ok(d.items.some(i => i.src === 'ozbargain' && /Dyson/.test(i.title)), 'its post is on the wire, as the operator asked');
  const s = await sourcesSeed(env, true); ok(s.ok);
  eq(srcRow().enabled, 1, 'the reseed does not switch an edited row off');
  eq(JSON.parse(kv.get('sources_core_off')), []);
  const d2 = await allnews(); ok(fetched.indexOf('ozbargain') >= 0); eq(d2.feeds, core);
});
await t('5. a registry that still has the feed on and never edited (live before p73) is switched off by the seed', async () => {
  db.prepare('UPDATE sources SET enabled=1, edited=0 WHERE id=?').run('ozbargain');
  kv.set('sources_core_off', '[]');
  const s = await sourcesSeed(env, true); ok(s.ok);
  const r = srcRow(); eq(r.enabled, 0); eq(r.edited, 0, 'the seed is not an edit');
  eq(JSON.parse(kv.get('sources_core_off')), ['ozbargain'], 'the mirror follows at once');
  const d = await allnews(); eq(fetched.indexOf('ozbargain'), -1); eq(d.feeds, core - 1);
  const list = await req('GET', '/sources?status=off', null, 'read-key'); ok(list.d.sources.some(x => x.id === 'ozbargain'), 'shown as off in the Sources view');
});
await t('6. with no registry at all, the feeds off by default stay off', async () => {
  const kv2 = new Map();
  const env2 = Object.assign({}, env, { MIND_DB: null, AXIOM_KV: { get: async k => (kv2.has(k) ? kv2.get(k) : null), put: async (k, v) => { kv2.set(k, String(v)); }, delete: async k => { kv2.delete(k); }, list: async () => ({ keys: [] }) } });
  fetched.length = 0;
  const out = JSON.parse(await buildAllNews(env2, { max: 120, debug: true }));
  eq(fetched.indexOf('ozbargain'), -1, 'not fetched without a registry'); eq(out.feeds, Object.keys(AU_FEEDS).length - 1);
  ok(!out.items.some(i => i.src === 'ozbargain'));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
