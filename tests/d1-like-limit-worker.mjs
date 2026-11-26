/* "The regeneration did not start: D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR" (the owner, 26 November 2026,
 * pressing Generate 5 variations on a Full AI creative). D1 refuses a LIKE or GLOB pattern longer than 50 bytes; SQLite's own
 * limit is 50,000, so the harnesses never saw it. tests/d1lite.mjs now refuses what D1 refuses, which is what made
 * studio-variations-worker fail on p79 (VA1, VA2, VA4, VA5, VA8, VA9, VA10). Providers MOCKED.
 *   LL1 the fixture refuses a bound LIKE pattern over 50 bytes, as D1 does, and allows one of 50
 *   LL2 a long search (80 characters) on the archive's search routes answers, cut to what D1 allows
 * Run: node --experimental-sqlite tests/d1-like-limit-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { D1Lite } from './d1lite.mjs';
const T = suite('d1-like-limit-worker (no LIKE pattern past the 50 bytes D1 allows)');
await T.t('LL1 the fixture refuses a LIKE pattern over 50 bytes and allows 50', async () => {
  const d = new D1Lite(); await d.exec('CREATE TABLE t (s TEXT)');
  let err = ''; try { await d.prepare('SELECT * FROM t WHERE s LIKE ?').bind('%' + 'a'.repeat(50) + '%').all(); } catch (e) { err = String(e.message); }
  ok(/pattern too complex/.test(err), 'refused: ' + err);
  const r = await d.prepare('SELECT * FROM t WHERE s LIKE ?').bind('%' + 'a'.repeat(48) + '%').all(); ok(r.success, 'fifty bytes is allowed');
});
const w = await workerEnv({});
await T.t('LL2 an 80-character search answers', async () => {
  const q = encodeURIComponent('fuel tax credits for farmers and miners across regional Australia this year ok');
  for (const path of ['/narratives?q=' + q, '/sentiment/items?days=7&q=' + q, '/mps?q=' + q]) {
    const r = await w.call('GET', path, null, 'read-key'); ok(r.status < 500, path + ' answered ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
  }
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
