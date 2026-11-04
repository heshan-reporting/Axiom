#!/usr/bin/env node
/* tools/copy-eval.mjs (P50, Phase 2): a deterministic scorer for first drafts against the copy golden set
 * (tests/fixtures/copy-golden/cases.json, synthetic client only). It reads words, never a model: for each piece it checks
 *   facts      every figure the case names appears
 *   banned     no banned term appears (a negated use, "not cheap", still counts: the kit decides what is allowed)
 *   cta        a call to action exists and carries one of the brief's action words
 *   limits     the caption is within the platform's limit and the headline within the format's fit
 *   signoff    the campaign's sign-off is there, when the case names one
 *   exclamation none, when the case asks for none
 * and reports a score per piece (the share of its checks passed) and per case.
 *
 * In CI: tests/copy-eval-test.mjs runs the mocked engine through the Studio's copy stage and scores what it filed.
 * Live (the owner's decision, not part of any test run): it creates TEST projects in the synthetic namespace on a worker and
 * runs the copy stage once per case, which spends model calls, so it refuses without --approve-calls N (one call per case):
 *   node tools/copy-eval.mjs --worker https://newsaus.example.workers.dev --approve-calls 2      (AXIOM_KEY in the environment)
 */
import fs from 'node:fs';
import path from 'node:path';

const LIMITS = { facebook: 900, instagram: 700, linkedin: 900, x: 280, tiktok: 300 };
const FIT = { '1:1': 64, '4:5': 56, '9:16': 44, '16:9': 60, '1.91:1': 56, '6:5': 58 };
const words = t => (String(t || '').toLowerCase().match(/[a-z]{3,}/g) || []);

/** Score one piece ({channel, format, copy}) against a case's expectations. */
export function scorePiece(piece, expect) {
  const c = piece.copy || {}; const all = ['headline', 'support', 'cta', 'caption', 'body'].map(k => c[k]).filter(Boolean).join(' \n ');
  const low = all.toLowerCase(); const out = [];
  const add = (key, ok, note) => out.push({ key, ok: !!ok, note });
  (expect.figures || []).forEach(f => add('fact:' + f, new RegExp('(^|[^0-9])' + String(f).replace(/[.]/g, '\\.') + '([^0-9]|$)').test(all), 'the figure ' + f + ' from the approved facts'));
  (expect.banned || []).forEach(b => add('banned:' + b, !new RegExp('\\b' + b + '\\b', 'i').test(all), 'no "' + b + '"'));
  if (expect.actionWords) { const cw = words(c.cta + ' ' + (c.caption || '')); add('cta', !!String(c.cta || '').trim() && expect.actionWords.some(w => cw.some(x => x.indexOf(w) === 0)), 'a call to action carrying: ' + expect.actionWords.join(' or ')); }
  const cap = String(c.caption || c.body || ''); const lim = LIMITS[piece.channel];
  if (lim) add('limit:caption', cap.length <= lim, 'caption ' + cap.length + ' of ' + lim + ' characters');
  const fit = FIT[piece.format]; if (fit && c.headline) add('limit:headline', String(c.headline).length <= fit, 'headline ' + String(c.headline).length + ' of ' + fit + ' for ' + piece.format);
  if (expect.signoff) add('signoff', low.indexOf(String(expect.signoff).toLowerCase()) >= 0, 'the sign-off "' + expect.signoff + '"');
  if (expect.noExclamation) add('exclamation', !/!/.test(all), 'no exclamation marks');
  const passed = out.filter(x => x.ok).length;
  return { channel: piece.channel, format: piece.format, checks: out, score: out.length ? Math.round(passed / out.length * 100) : null, failed: out.filter(x => !x.ok).map(x => x.key) };
}
/** Score a case: every piece, and the case's mean. */
export function scoreCase(cs, pieces) {
  const ps = pieces.map(p => scorePiece(p, cs.expect || {}));
  const scored = ps.filter(p => p.score != null);
  return { id: cs.id, pieces: ps, score: scored.length ? Math.round(scored.reduce((n, p) => n + p.score, 0) / scored.length) : null, pass: scored.length > 0 && scored.every(p => !p.failed.length) };
}
export function loadGolden(file) { return JSON.parse(fs.readFileSync(file || new URL('../tests/fixtures/copy-golden/cases.json', import.meta.url), 'utf8')); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const a = process.argv.slice(2); const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const worker = opt('--worker'); const approve = Number(opt('--approve-calls') || 0); const key = process.env.AXIOM_KEY || '';
  const G = loadGolden(opt('--cases'));
  if (!worker) { console.log('copy golden set: ' + G.cases.length + ' cases for ' + G.ns + ' (synthetic). Score drafts with --worker URL --approve-calls N (one model call per case; AXIOM_KEY in the environment).'); process.exit(0); }
  if (!key) { console.error('Set AXIOM_KEY.'); process.exit(2); }
  if (approve < G.cases.length) { console.error('This would make ' + G.cases.length + ' model calls (one per case, up to three requests each with retries). Nothing was run: pass --approve-calls ' + G.cases.length + ' to approve.'); process.exit(2); }
  const call = async (method, p, body) => { const r = await fetch(worker.replace(/\/+$/, '') + p, { method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': key }, body: body ? JSON.stringify(body) : undefined }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(p + ': ' + (j.detail || j.error || r.status)); return j; };
  const results = [];
  for (const cs of G.cases) {
    const pr = await call('POST', '/studio/project', { ns: G.ns, campaign: cs.campaign || '', title: 'Copy eval ' + cs.id, test: true, brief: Object.assign({ channels: cs.channels, deliverable: 'copy', campaignConfirmed: true }, cs.brief) });
    let j = (await call('POST', '/studio/job', { project: pr.id, stage: 'copy', input: { channels: cs.channels, deliverable: 'copy' }, idem: 'copy-eval:' + cs.id + ':' + Date.now() })).job;
    for (let i = 0; i < 40 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).job;
    const g = await call('GET', '/studio/get?id=' + pr.id);
    const pieces = g.assets.map(x => { const v = x.versions.find(y => y.id === x.current) || {}; return { channel: x.channel, format: x.format, copy: v.copy || {} }; });
    const r = scoreCase(cs, pieces); results.push(r);
    console.log(cs.id + ': ' + (r.score == null ? 'no pieces' : r.score + '/100') + (r.pass ? '' : ' - failed: ' + r.pieces.map(p => p.channel + ' ' + p.failed.join(', ')).filter(x => / /.test(x)).join('; ')));
  }
  fs.writeFileSync('copy-eval-results.json', JSON.stringify({ at: new Date().toISOString(), worker, results }, null, 2));
  console.log('written copy-eval-results.json');
}
