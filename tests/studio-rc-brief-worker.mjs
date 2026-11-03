/* The release candidate's briefing and campaign cases (CREATIVE-STUDIO.md s.54), against the worker module in this process
 * with every provider MOCKED (worker-env.mjs). Each case fails on the base commit and passes with its fix.
 *   K3  "Standalone" is a person's explicit choice: with two campaigns in the kit it satisfies the campaign gate, and the work
 *       is scoped to client-wide records only - the same at production (the context the models get) and on every recheck
 *   K1  the reading proposes campaign candidates with confidence and evidence; when the top two are close or the top is weak it
 *       is ambiguous and asks, never picking the campaign with more material; the knowledge it reads carries campaign and approval
 * Run: node --experimental-sqlite tests/studio-rc-brief-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('RC briefing: standalone work and campaign scope');
const KEYS = { 'full-key': { n: 'Lead', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const KIT = { ns: 'synthdemo', name: 'Harbourline Ferries - SYNTHETIC DEMO CLIENT', campaigns: [{ id: 'harbour', name: 'Harbour crossings' }, { id: 'nightboat', name: 'Night boat', logoPolicy: 'none' }],
  facts: [{ text: 'Harbourline carried 1.2 million riders last year', source: 'annual report', status: 'approved', campaign: 'harbour' }, { text: 'The night boat leaves Pier 3 at 9.40pm', source: 'timetable', status: 'approved', campaign: 'nightboat' }, { text: 'Harbourline has served the harbour for 80 years', source: 'history', status: 'approved' }] };

await S.t('K3: an explicit Standalone choice satisfies the campaign gate when the kit has two campaigns; no choice at all still does not', async () => {
  const w = await workerEnv({ keys: KEYS });
  try {
    await w.call('POST', '/brand/kit', KIT, 'full-key');
    const alone = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: '', title: 'Standalone', brief: { campaignMode: 'standalone', objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'copy' } }, 'full-key')).body.id;
    const none = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: '', title: 'Undecided', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'copy' } }, 'full-key')).body.id;
    const ca = (await w.call('GET', '/studio/brief/check?project=' + alone, null, 'full-key')).body;
    ok(!(ca.gaps || []).some(g => g.code === 'campaign_unconfirmed' && g.level === 'mandatory'), 'standalone is a decision, not a gap: ' + JSON.stringify(ca.gaps));
    ok((ca.assumptions || []).some(a => /standalone|no campaign/i.test(a.text || a)), 'the scope is said: ' + JSON.stringify(ca.assumptions));
    const cn = (await w.call('GET', '/studio/brief/check?project=' + none, null, 'full-key')).body;
    ok((cn.gaps || []).some(g => g.code === 'campaign_unconfirmed' && g.level === 'mandatory'), 'no choice still asks: ' + JSON.stringify(cn.gaps));
  } finally { w.restore(); }
});

await S.t('K3: standalone work sees the client-wide facts only, at production and on a recheck alike', async () => {
  const w = await workerEnv({ keys: KEYS });
  try {
    await w.call('POST', '/brand/kit', KIT, 'full-key');
    const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: '', title: 'Standalone', brief: { campaignMode: 'standalone', objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'copy' } }, 'full-key')).body.id;
    const ctx = (await w.call('GET', '/studio/context?project=' + P, null, 'full-key')).body;
    const facts = (ctx.facts || []).map(f => f.text);
    ok(facts.some(t => /80 years/.test(t)), 'the client-wide fact reaches the models: ' + JSON.stringify(facts));
    ok(!facts.some(t => /1\.2 million|9\.40pm/.test(t)), 'no campaign\'s own fact does: ' + JSON.stringify(facts));
    // the recheck judges a piece citing a campaign's figure the same way production would: not an approved fact of this work
    const A = (await w.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '4:5', title: 'Copy', mode: 'copy', copy: { headline: 'Harbourline carried 1.2 million riders last year' } }, 'full-key')).body.asset;
    const v = A.versions.find(x => x.id === A.current);
    const c42 = (v.checks || []).find(c => /1\.2/.test(c.text || ''));
    ok(c42 && c42.state !== 'fact' && c42.state !== 'matches', 'a campaign\'s figure is not an approved fact of standalone work: ' + JSON.stringify(v.checks));
  } finally { w.restore(); }
});

/* the analysis stage with a scripted reading: the campaign part of the answer is given; everything else is minimal */
async function readWith(campaignAnswer) {
  const w = await workerEnv({ keys: KEYS, env: { ANTHROPIC_API_KEY: 'x' } });
  const seen = [];
  w.answer(/api\.anthropic\.com/, async (u, init) => {
    const body = JSON.parse(init.body); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    seen.push({ sys: String(body.system || ''), user });
    const ans = { input: { type: 'client_request', why: 'a note' }, understanding: {}, situation: { what: 'Timetable news', whyItMatters: 'riders', kinds: ['communication'], respond: 'yes', why: 'news' },
      relevant: [{ p: 'P1', class: 'client', why: 'the news' }, { p: 'P2', class: 'client', why: 'the news' }], filtered: [], topics: [], campaign: campaignAnswer, claims: [], comparison: {}, objectives: [], strategies: [], directions: [], recommendation: {}, next: { stage: 'brief', why: '' } };
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ans) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  await w.call('POST', '/brand/kit', KIT, 'full-key');
  const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: '', title: 'Ambiguous', brief: { channels: ['instagram'] } }, 'full-key')).body.id;
  const src = (await w.call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Note', text: 'Harbourline will run a late ferry on Friday nights from Pier 3.\n\nTwo more morning crossings start from Circular Wharf on Monday.' }, 'full-key')).body.id;
  const j = (await w.call('POST', '/studio/job', { project: P, stage: 'analyse', input: { sources: [src], kind: 'brief' }, idem: 'k1:' + Math.random() }, 'full-key')).body.job;
  let job = j; for (let i = 0; i < 6 && (job.state === 'queued' || job.state === 'running'); i++) job = (await w.call('POST', '/studio/job/step', { id: j.id }, 'full-key')).body.job;
  const g = (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body;
  return { w, job, g, seen };
}

await S.t('K1: two close candidates are ambiguous: nothing is detected, the question names both, and the larger campaign does not win', async () => {
  const x = await readWith({ candidates: [{ id: 'harbour', confidence: 0.55, evidence: ['P2'], why: 'morning crossings' }, { id: 'nightboat', confidence: 0.5, evidence: ['P1', 'P9'], why: 'the late ferry' }], why: '' });
  try {
    eq(x.job.state, 'done', 'the reading finished: ' + JSON.stringify(x.job.error || ''));
    const c = x.g.brief.analysis.campaign;
    eq(c.id, null, 'nothing detected'); eq(c.ambiguous, true, 'ambiguous');
    eq(c.candidates.map(k => k.id), ['harbour', 'nightboat']);
    eq(c.candidates[1].evidence, ['P1'], 'evidence keeps only paragraphs that exist');
    ok(/Harbour crossings/.test(c.question) && /Night boat/.test(c.question) && /standalone/.test(c.question), c.question);
    eq(x.g.campaign || '', '', 'the project\'s campaign is unchanged');
  } finally { x.w.restore(); }
});

await S.t('K1: a clear candidate is detected (proposed, not applied); a weak one is not', async () => {
  const clear = await readWith({ candidates: [{ id: 'nightboat', confidence: 0.85, evidence: ['P1'], why: 'the late ferry' }, { id: 'harbour', confidence: 0.3, why: 'mentioned' }] });
  try { const c = clear.g.brief.analysis.campaign; eq(c.id, 'nightboat'); eq(c.ambiguous, false); eq(clear.g.campaign || '', '', 'proposed, never applied by the reading'); } finally { clear.w.restore(); }
  const weak = await readWith({ candidates: [{ id: 'harbour', confidence: 0.45, why: 'perhaps' }] });
  try { const c = weak.g.brief.analysis.campaign; eq(c.id, null, 'a weak top candidate is not a detection'); eq(c.ambiguous, true); } finally { weak.w.restore(); }
});

await S.t('K1: the facts the reading sees carry their campaign or client-wide, and say they are approved', async () => {
  const x = await readWith({ candidates: [] });
  try {
    const u = (x.seen.find(s => /CAMPAIGN/.test(s.user)) || {}).user || '';
    ok(/\[campaign harbour\]/.test(u) && /\[client-wide\]/.test(u), 'facts labelled: ' + (u.match(/APPROVED FACTS[\s\S]{0,400}/) || [''])[0]);
    ok(/APPROVED FACTS \(approved by the team\)/.test(u), 'approval stated');
  } finally { x.w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
