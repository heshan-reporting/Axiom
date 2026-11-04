#!/usr/bin/env node
/* tools/relevance-eval.mjs (P51, Phase 4): scores the brief engine's relevance against a labelled set
 * (tests/fixtures/relevance/synthdemo.json, synthetic client only). It reads the reading the worker filed, never a model:
 *   precision  of the paragraphs kept, the share a person would keep
 *   recall     of the paragraphs a person would keep, the share kept
 *   issues     of the labelled topics the reading judged, the share judged at the labelled relevance (high / potential / not)
 * scorePrepass() scores the deterministic pre-pass alone (anchored = kept), the floor the reading must beat.
 *
 * In CI: tests/studio-p51-worker.mjs (RL1, RL2) runs the analyse stage with the case's mocked reading and scores what it filed.
 * Live (the owner's decision, not part of any test run): it makes TEST projects in the synthetic namespace and runs the analyse
 * stage once per case, which spends one model call each, so it refuses without --approve-calls N:
 *   node tools/relevance-eval.mjs --worker https://newsaus.example.workers.dev --approve-calls 1   (AXIOM_KEY in the environment)
 */
import fs from 'node:fs';
import path from 'node:path';

const r2 = x => Math.round(x * 1000) / 1000;
/** Precision and recall of the kept paragraphs, and topic accuracy, of one filed reading against one labelled case. */
export function scoreRelevance(record, labels) {
  const kept = new Set(((record && record.relevant) || []).map(x => x.p)); const want = new Set((labels && labels.keep) || []);
  const tp = [...kept].filter(p => want.has(p)).length;
  const precision = kept.size ? tp / kept.size : (want.size ? 0 : 1); const recall = want.size ? tp / want.size : 1;
  const topics = ((record && record.topics) || []); const lt = (labels && labels.topics) || [];
  const judged = lt.map(l => { const t = topics.find(x => String(x.name || '').toLowerCase().indexOf(l.name.toLowerCase()) >= 0 || l.name.toLowerCase().indexOf(String(x.name || '').toLowerCase()) >= 0); return { name: l.name, want: l.relevance, got: t ? t.relevance : null, ok: !!t && t.relevance === l.relevance }; });
  const issues = judged.length ? judged.filter(x => x.ok).length / judged.length : null;
  return { precision: r2(precision), recall: r2(recall), f1: r2(precision + recall ? 2 * precision * recall / (precision + recall) : 0), issues: issues == null ? null : r2(issues), kept: [...kept], missed: [...want].filter(p => !kept.has(p)), extra: [...kept].filter(p => !want.has(p)), topics: judged };
}
/** The pre-pass alone: a paragraph is kept when it is anchored. */
export function scorePrepass(prepass, labels) {
  return scoreRelevance({ relevant: prepass.map((ev, i) => ev.anchored ? { p: 'P' + (i + 1) } : null).filter(Boolean), topics: [] }, { keep: labels.keep, topics: [] });
}
export function loadRelevance(file) { return JSON.parse(fs.readFileSync(file || new URL('../tests/fixtures/relevance/synthdemo.json', import.meta.url), 'utf8')); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const a = process.argv.slice(2); const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const worker = opt('--worker'); const approve = Number(opt('--approve-calls') || 0); const key = process.env.AXIOM_KEY || '';
  const G = loadRelevance(opt('--cases'));
  if (!worker) { console.log('relevance set: ' + G.cases.length + ' case(s) for ' + G.ns + ' (synthetic). Score live readings with --worker URL --approve-calls N (one model call per case; AXIOM_KEY in the environment).'); process.exit(0); }
  if (!key) { console.error('Set AXIOM_KEY.'); process.exit(2); }
  if (approve < G.cases.length) { console.error('This would make ' + G.cases.length + ' model call(s) (one reading per case, up to three requests each with retries). Nothing was run: pass --approve-calls ' + G.cases.length + ' to approve.'); process.exit(2); }
  const call = async (method, p, body) => { const r = await fetch(worker.replace(/\/+$/, '') + p, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p + ': ' + (j.detail || j.error || r.status)); return j; };
  const results = [];
  for (const cs of G.cases) {
    const pr = await call('POST', '/studio/project', { ns: G.ns, campaign: cs.campaign || '', title: 'Relevance eval ' + cs.id, test: true, brief: { campaignConfirmed: true } });
    const src = await call('POST', '/studio/source', { project: pr.id, kind: 'analyse:brief', name: cs.id, text: cs.paragraphs.join('\n\n') });
    let j = (await call('POST', '/studio/job', { project: pr.id, stage: 'analyse', input: { source: src.id, kind: 'brief' }, idem: 'relevance-eval:' + cs.id + ':' + Date.now() })).job;
    for (let i = 0; i < 40 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).job;
    const g = await call('GET', '/studio/intel?project=' + pr.id); const r = scoreRelevance(g.intel || {}, cs.labels); results.push(Object.assign({ id: cs.id }, r));
    console.log(cs.id + ': precision ' + r.precision + ', recall ' + r.recall + ', issues ' + r.issues + (r.extra.length ? '; kept but should not: ' + r.extra.join(', ') : '') + (r.missed.length ? '; missed: ' + r.missed.join(', ') : ''));
  }
  fs.writeFileSync('relevance-eval-results.json', JSON.stringify({ at: new Date().toISOString(), worker, results }, null, 2));
  console.log('written relevance-eval-results.json');
}
