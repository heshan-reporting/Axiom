/* Persisted structured data stays valid: no serialized JSON is ever cut mid-string. User instructions, briefs,
 * recipes and layouts that are too large are refused with the field named (nothing written); diagnostics and
 * advisory blobs are shrunk field by field into valid JSON marked _truncated; and a read-only integrity report
 * names any stored record that does not parse. Providers MOCKED.
 * Run: node --experimental-sqlite tests/integrity-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('integrity-worker (valid persisted JSON, field-aware limits, the integrity report)');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'a', GEMINI_KEY: 'g' } });
const db = w.env.MIND_DB.db;
const P = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Integrity', brief: { objective: 'o', message: 'm' }, idem: 'int-1' }, 'full-key')).body.id;
const invalid = (table, col) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} IS NOT NULL AND ${col} != '' AND json_valid(${col}) = 0`).get().n;

await T.t('a long job instruction is never stored as broken JSON that reads back as {}: a long one round-trips exactly, a too-long one is refused naming the field', async () => {
  const long = 'Make the headline sharper. '.repeat(400).trim();                    // ~10,800 characters
  const r = await w.call('POST', '/studio/job', { project: P, stage: 'echo', input: { instruction: long }, idem: 'long-1' }, 'full-key');
  eq(r.status, 200, r.text.slice(0, 200));
  const j = db.prepare('SELECT input FROM studio_jobs WHERE id=?').get(r.body.job.id);
  eq(JSON.parse(j.input).instruction, long, 'the instruction came back whole');
  const huge = 'x'.repeat(70000);
  const n0 = db.prepare('SELECT COUNT(*) AS n FROM studio_jobs').get().n;
  const r2 = await w.call('POST', '/studio/job', { project: P, stage: 'echo', input: { instruction: huge }, idem: 'long-2' }, 'full-key');
  eq([r2.status, r2.body.error], [413, 'input_too_large']); ok(/instruction/.test(r2.body.detail), r2.body.detail);
  eq(db.prepare('SELECT COUNT(*) AS n FROM studio_jobs').get().n, n0, 'nothing written');
  eq(invalid('studio_jobs', 'input'), 0, 'every stored job input parses');
});
await T.t('a recipe whose step input is large is saved whole, and one past the limit is refused, never a 500 parse error', async () => {
  const big = { instruction: 'Write it plainly. '.repeat(300) };                // ~5,400 characters
  const r = await w.call('POST', '/studio/recipe', { ns: 'mca', name: 'Big', steps: [{ stage: 'copy', input: big }] }, 'full-key');
  eq(r.status, 200, r.text.slice(0, 200)); eq(r.body.recipe.steps[0].input.instruction, big.instruction);
  const r2 = await w.call('POST', '/studio/recipe', { ns: 'mca', name: 'Too big', steps: [{ stage: 'copy', input: { instruction: 'y'.repeat(70000) } }] }, 'full-key');
  eq([r2.status, r2.body.error], [413, 'input_too_large']);
  eq(invalid('studio_recipes', 'steps'), 0);
});
await T.t('a brief past its limit is refused on create and update (nothing written); one within it round-trips', async () => {
  const r = await w.call('POST', '/studio/project', { ns: 'mca', title: 'Huge brief', brief: { objective: 'z'.repeat(90000) }, idem: 'int-huge' }, 'full-key');
  eq([r.status, r.body.error], [413, 'brief_too_large']);
  const g = (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body;
  const u = await w.call('POST', '/studio/project/update', { id: P, revision: g.revision, patch: { brief: Object.assign({}, g.brief, { message: 'q'.repeat(90000) }) } }, 'full-key');
  eq([u.status, u.body.error], [413, 'brief_too_large']);
  eq((await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body.brief.message, 'm', 'the brief is unchanged');
  eq(invalid('studio_projects', 'brief'), 0);
});
await T.t('diagnostic and advisory blobs that run long are shrunk field by field into valid JSON marked _truncated', async () => {
  const { jsonFit } = w.mod.__test || {};
  ok(typeof jsonFit === 'function', 'jsonFit is exported for tests');
  const v = { summary: 'ok', lines: Array.from({ length: 400 }, (_, i) => 'line ' + i + ' ' + 'detail '.repeat(20)), nested: { text: 'w'.repeat(9000) } };
  const s = jsonFit(v, 4000); ok(s.length <= 4000, 'within the limit: ' + s.length);
  const back = JSON.parse(s); eq(back.summary, 'ok', 'short fields kept'); eq(back._truncated, true); ok(Array.isArray(back.lines) && back.lines.length > 0, 'the array kept its head');
  eq(jsonFit({ a: 1 }, 4000), '{"a":1}', 'a small value is untouched');
  const arr = JSON.parse(jsonFit(Array.from({ length: 5000 }, (_, i) => ({ id: i, text: 'claim ' + i })), 3000)); ok(Array.isArray(arr) && arr.length > 0 && arr.length < 5000, 'an array stays an array');
  ok(JSON.parse(jsonFit('s'.repeat(10000), 100)).length <= 100, 'a long string stays a string');
});
await T.t('an archive row with a large meta keeps meta valid JSON, so json_extract still reads it', async () => {
  const meta = { source: 'x', issues: ['fuel'], note: 'n'.repeat(5000) };
  const r = await w.call('POST', '/archive/add', { rows: [{ kind: 'news', src: 'test', url: 'https://example.com/long-meta', title: 'Long meta', ts: Date.now(), meta }] }, 'full-key');
  ok(r.status === 200, r.text.slice(0, 200));
  const row = db.prepare("SELECT meta, json_valid(meta) AS ok, json_extract(meta, '$.source') AS src FROM arc_items WHERE url=?").get('https://example.com/long-meta');
  ok(row, 'the row was filed'); eq([row.ok, row.src], [1, 'x']);
});
await T.t('studio events with a long text stay valid JSON on the thread', async () => {
  const r = await w.call('POST', '/studio/note', { project: P, text: 'note '.repeat(3000), target: 'the set' }, 'full-key');
  ok(r.status === 200, r.text.slice(0, 200)); eq(invalid('studio_events', 'data'), 0);
});
await T.t('the integrity report is read-only, needs a full key, and names a record that does not parse with what to do', async () => {
  db.prepare("INSERT INTO studio_jobs(id,project,asset,stage,input,input_version,state,attempts,lease_until,idem,progress,cost,result,error,who,created,updated) VALUES('j_broken',?,'','echo','{\"instruction\":\"cut off mid','','failed',1,0,'broken-1','{}',0,NULL,'','t',1,1)").run(P);
  eq((await w.call('GET', '/integrity', null, 'read-key')).status, 403);
  const before = db.prepare("SELECT input FROM studio_jobs WHERE id='j_broken'").get().input;
  const r = await w.call('GET', '/integrity', null, 'full-key'); eq(r.status, 200, r.text.slice(0, 200));
  const hit = r.body.findings.find(f => f.table === 'studio_jobs' && f.column === 'input');
  ok(hit && hit.count >= 1 && hit.ids.indexOf('j_broken') >= 0, JSON.stringify(r.body.findings));
  ok(/re-?run|recreate|retype|not repaired automatically/i.test(hit.recovery), hit.recovery);
  eq(db.prepare("SELECT input FROM studio_jobs WHERE id='j_broken'").get().input, before, 'nothing was rewritten');
  ok(r.body.readOnly === true && r.body.checked.length >= 8, 'tables checked: ' + r.body.checked.length);
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
