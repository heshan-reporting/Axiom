/* Knowledge ingestion indexes the whole document or says exactly how much it has indexed. A 200,000-character
 * document with its essential fact near the end must be findable; indexing that does not finish in one call is
 * recorded as partial with its coverage and resumes where it stopped; a failure mid-way is partial, not success;
 * every chunk keeps its position for citation; identical text is not indexed twice. Workers AI and Vectorize MOCKED.
 * Run: node --experimental-sqlite tests/ingest-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('ingest-worker (complete or honestly partial indexing; providers MOCKED)');
const filler = n => { let s = ''; let i = 0; while (s.length < n) s += 'Paragraph ' + (i++) + ' on fuel tax credits and the road user charge, with figures and context for the brief. '; return s.slice(0, n); };
const FACT = 'The decisive fact is ZEBRA-42: the credit returns a road tax never meant for off-road fuel.';
const doc = filler(199000) + ' ' + FACT + ' ' + filler(800);
const fresh = async env => workerEnv({ env: Object.assign({}, env || {}) });
const vecWith = (w, needle) => Array.from(w.vectors.values()).filter(v => String((v.metadata || {}).snippet || '').indexOf(needle) >= 0);

await T.t('a 200,000-character document is indexed to the end: the fact near the end is in a vector, coverage is complete and stated', async () => {
  const w = await fresh();
  const r = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Long brief', kind: 'brief', text: doc }, 'full-key');
  eq(r.status, 200, r.text.slice(0, 200));
  eq([r.body.status, r.body.indexed, r.body.chunks], ['complete', r.body.chunks, r.body.chunks]); ok(r.body.chunks > 120, 'more than the old 120-chunk cap: ' + r.body.chunks);
  eq(r.body.chars, doc.length, 'every character counted');
  ok(vecWith(w, 'ZEBRA-42').length >= 1, 'the fact near the end was embedded');
  const row = w.env.MIND_DB.db.prepare('SELECT status, chunks, indexed, chars, hash FROM mind_docs WHERE id=?').get(r.body.docId);
  eq([row.status, row.indexed, row.chars], ['complete', row.chunks, doc.length]); ok(/^[0-9a-f]{16,}$/.test(row.hash), 'content hash kept');
  const v = vecWith(w, 'ZEBRA-42')[0].metadata; ok(v.start >= 0 && v.end > v.start && doc.slice(v.start, v.end).indexOf('ZEBRA-42') >= 0, 'the chunk records where it sits in the stored text');
  w.restore();
});
await T.t('the Studio and tools path (mindIngestDoc) is the same implementation, with the same coverage', async () => {
  const w = await fresh(); const { mindIngestDoc } = w.mod.__test;
  const r = await mindIngestDoc(w.env, { ns: 'mca', title: 'Same', text: doc });
  eq([r.status, r.indexed === r.chunks], ['complete', true]); ok(vecWith(w, 'ZEBRA-42').length >= 1); w.restore();
});
await T.t('indexing that does not finish in one call is partial with its coverage, and resumes where it stopped without duplicating chunks', async () => {
  const w = await fresh({ MIND_INGEST_CHUNKS_PER_CALL: '60' });
  const r = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Long', text: doc }, 'full-key');
  eq([r.status, r.body.status, r.body.indexed], [200, 'partial', 60]); ok(r.body.coverage > 0 && r.body.coverage < 1, 'coverage ' + r.body.coverage);
  ok(!vecWith(w, 'ZEBRA-42').length, 'not yet indexed, and not claimed');
  let s = r.body; for (let i = 0; i < 10 && s.status !== 'complete'; i++) s = (await w.call('POST', '/mind/ingest/resume', { docId: r.body.docId }, 'full-key')).body;
  eq([s.status, s.indexed, s.chunks], ['complete', s.chunks, r.body.chunks]);
  eq(w.vectors.size, s.chunks, 'one vector per chunk, no duplicates'); ok(vecWith(w, 'ZEBRA-42').length >= 1); w.restore();
});
await T.t('a failure mid-way leaves the document partial with the error, never "ok"; resuming completes it', async () => {
  const w = await fresh(); let calls = 0; const real = w.env.AI.run;
  w.env.AI.run = async (m, o) => { if (++calls === 4) throw new Error('AI 503'); return real(m, o); };
  const r = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Fails', text: doc }, 'full-key');
  ok(r.body.status === 'partial' && /503/.test(r.body.error || ''), JSON.stringify(r.body).slice(0, 200)); ok(r.status === 207 || r.status === 200, 'answered ' + r.status);
  const row = w.env.MIND_DB.db.prepare('SELECT status, indexed, chunks, error FROM mind_docs WHERE id=?').get(r.body.docId); eq(row.status, 'partial'); ok(row.indexed < row.chunks);
  let s; for (let i = 0; i < 5; i++) { s = (await w.call('POST', '/mind/ingest/resume', { docId: r.body.docId }, 'full-key')).body; if (s.status === 'complete') break; }
  eq(s.status, 'complete'); ok(vecWith(w, 'ZEBRA-42').length >= 1); w.restore();
});
await T.t('the same text again is recognised by its hash and not indexed twice (unless forced)', async () => {
  const w = await fresh();
  const a = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Once', text: doc }, 'full-key'); const n = w.vectors.size;
  const b = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Once again', text: doc }, 'full-key');
  eq([b.body.existing, b.body.docId, w.vectors.size], [true, a.body.docId, n]);
  const c = await w.call('POST', '/mind/ingest', { namespace: 'aep', title: 'Other client', text: doc }, 'full-key'); ok(c.body.docId !== a.body.docId, 'another namespace is another document'); w.restore();
});
await T.t('a document past the hard limit is refused before anything is stored', async () => {
  const w = await fresh(); const r = await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Huge', text: 'x'.repeat(2100000) }, 'full-key');
  eq([r.status, r.body.error], [413, 'document_too_large']); eq(w.vectors.size, 0); eq(w.r2.size, 0); w.restore();
});
await T.t('the coverage report (read-only) flags documents indexed under the old cap and proposes a bounded backfill', async () => {
  const w = await fresh(); const db = w.env.MIND_DB.db;
  await w.call('POST', '/mind/ingest', { namespace: 'mca', title: 'Seed', text: 'short text' }, 'full-key');
  db.prepare("INSERT INTO mind_docs(id,ns,title,kind,source,dt,chunks,created) VALUES('mca_old1','mca','Old long doc','doc','','',120,1)").run();
  await w.env.MIND_DOCS.put('mind/mca/mca_old1.txt', doc);
  const r = await w.call('GET', '/mind/coverage?namespace=mca', null, 'full-key'); eq(r.status, 200, r.text.slice(0, 160));
  const f = r.body.docs.find(d => d.id === 'mca_old1'); ok(f && f.status === 'partial' && f.coverage < 1 && f.indexedChars < f.chars, JSON.stringify(f));
  ok(/resume|reindex/.test(r.body.backfill || ''), r.body.backfill); eq(w.vectors.size, 1, 'the report indexed nothing');
  w.restore();
});
const res = T.done(); process.exit(res.fail ? 1 : 0);
