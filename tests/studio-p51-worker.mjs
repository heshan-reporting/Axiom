/* P51: the client knowledge engine (Phase 3 of prompts/studio-engines-and-canvas.md), against the worker module in this process
 * with every provider MOCKED. Each case fails on the P50 commit and passes with its change.
 *   KN1 one knowledge view per client and campaign: every fact, banned term, rule, preference, learned correction, campaign
 *       wording and mark, each with its authority, scope, status, source, last confirmation and use count (how many versions it
 *       informed); another campaign's facts are in the client view, never in this campaign's
 *   KN2 duplicates across the kit, brand items and corrections are found and shown; a person merges them (with a reason),
 *       never the engine alone
 *   KN3 a fact past its review date is "expired": left out of production (the writing core) and judged unsupported by the copy
 *       checks until a person confirms it; confirming puts it back with a new date
 *   KN4 saving the kit and teaching the brand answer a receipt: what was added, what was proposed for review, what was refused
 *       and why
 *   KN5 the brief check names facts past their review date before anything is spent, and only this campaign's or client-wide ones
 *   RL1 relevance you can audit: a deterministic pre-pass names, per paragraph, the client issue matcher that fired, the entity,
 *       the campaign term or the client name; the reading sees it; a paragraph with none of them kept without a stated reason
 *       is set aside, with the reason said; every kept and set-aside paragraph and every judged issue carries its evidence
 *   RL2 the labelled set (tests/fixtures/relevance/synthdemo.json) scored by tools/relevance-eval.mjs on the mocked engine:
 *       precision and recall of kept paragraphs and topic accuracy, against the pre-pass alone and the raw reading
 *   MR1 retrieval ranks for the task: a busier campaign's passages, however many and however close, never outrank the current
 *       campaign's; approved work before background; rejected work last and marked AVOID; decisions this campaign first, newest
 *       first
 *   ME1 memory that stays true: every rule says how often and when it was last applied; a rule not applied or reviewed for 90 days
 *       is proposed for review and a person keeps it or switches it off (never deleted); contradictions between rules are named
 *   ME2 a learning summary per client from the recorded verdicts and their reasons (withdrawn verdicts left out)
 *   ME3 What informed this creative names every memory item that shaped the words by id: the examples followed, the work marked
 *       avoid, the corrections and the kept brand items
 *   ME4 retraction stays exact: a withdrawn approval never reaches a prompt as a recorded decision
 *   IS1 isolation across clients and campaigns: production for two campaigns of one client and for another client audits clean,
 *       and a fact, correction or example of another campaign recorded on a version is reported as a leak
 * Run: node --experimental-sqlite tests/studio-p51-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { scoreRelevance, scorePrepass, loadRelevance } from '../tools/relevance-eval.mjs';
import { answerFor } from './studio-answers.mjs';

const S = suite('P51: the client knowledge engine');
const env0 = { ANTHROPIC_API_KEY: 'test', STUDIO_INSPECT: '0' };
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const day = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);
const KIT = { ns: 'mca', name: 'Minerals Council of Australia', voice: 'Plain and sourced.', rules: 'No exclamation marks.',
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', active: true }, { id: 'national', name: 'Australian mining', active: true }],
  facts: [{ id: 'hoof150', text: 'More than 150,000 businesses use the fuel tax credit.', source: 'ATO 2023', status: 'approved', campaign: 'hoof' },
    { id: 'nat74', text: 'Mining paid $74 billion in tax and royalties.', source: 'ATO', status: 'approved', campaign: 'national' },
    { id: 'old12', text: '12 per cent of diesel is used on farms.', source: 'ABS 2019', status: 'approved', reviewBy: day(-10) },
    { id: 'pend9', text: 'Nine in ten farmers rely on the credit.', source: 'survey', status: 'pending' }],
  banned: [{ term: 'subsidy', use: 'tax credit', allowNegated: true }] };
const find = (items, kind, id) => items.find(x => x.kind === kind && x.id === id);

await S.t('KN1: the knowledge view lists every kind with authority, scope, status, source, confirmation and uses; campaign walls hold', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    w.env.MIND_DB.db.exec("CREATE TABLE IF NOT EXISTS engine_fixes(id TEXT PRIMARY KEY, ns TEXT, task TEXT, scope TEXT, wrong TEXT, rightt TEXT, why TEXT, rule TEXT, exemplar TEXT, source TEXT, who TEXT, created INTEGER, active INTEGER DEFAULT 1, hits INTEGER DEFAULT 0)");
    await F(w, 'GET', '/engine/status?ns=mca');
    w.env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('fx1','mca','copy','client','more than all other industries combined','more than any other industry','the ATO wording','Say more than any other industry','','teach','Dee',?,1,3)").run(Date.now());
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'K', brief: { objective: 'o' } })).body.id;
    // a version informed by the HOOF fact and the correction
    const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'T', mode: 'composition', copy: { headline: 'H' }, layout: LAYOUT })).body.asset;
    w.env.MIND_DB.db.prepare('UPDATE studio_versions SET context=? WHERE id=?').run(JSON.stringify({ informed: { kit: { facts: [{ id: 'hoof150' }] }, corrections: [{ id: 'fx1' }] } }), a.current);
    const c = (await F(w, 'GET', '/brand/knowledge?ns=mca&campaign=hoof')).body;
    ok(c && Array.isArray(c.items), JSON.stringify(c).slice(0, 200));
    const f = find(c.items, 'fact', 'hoof150'); ok(f, 'the campaign fact');
    ok(f.authority === 'rule' && f.scope === 'campaign:hoof' && f.status === 'active' && /ATO 2023/.test(f.source) && f.uses === 1, JSON.stringify(f));
    ok(!find(c.items, 'fact', 'nat74'), 'another campaign\'s fact is not in this campaign\'s view');
    eq((find(c.items, 'fact', 'pend9') || {}).status, 'pending'); eq((find(c.items, 'fact', 'old12') || {}).status, 'expired');
    const fx = find(c.items, 'correction', 'fx1'); ok(fx && fx.authority === 'preference' && fx.uses === 1 && fx.status === 'active', JSON.stringify(fx));
    ok(find(c.items, 'banned', 'subsidy'), 'the banned term'); ok(c.items.some(x => x.kind === 'voice'), 'the voice');
    ok(c.items.every(x => x.authority && x.scope && x.status && 'source' in x && 'uses' in x), 'every item says all five');
    const all = (await F(w, 'GET', '/brand/knowledge?ns=mca')).body; ok(find(all.items, 'fact', 'nat74'), 'the client view holds every campaign\'s facts');
    eq((await F(w, 'GET', '/brand/knowledge?ns=aep')).body.items.filter(x => x.kind === 'fact').length, 0, 'another client\'s knowledge is not here');
  } finally { w.restore(); }
});

await S.t('KN2: duplicates across the kit, brand items and corrections are found; a person merges them with a reason, the engine never alone', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    const it = (await F(w, 'POST', '/brand/item', { ns: 'mca', campaign: 'hoof', kind: 'fact', authority: 'rule', title: 'More than 150,000 businesses use the fuel tax credit', body: 'ATO', reason: 'from the brief' })).body;
    const itemId = (it.item || it).id; ok(itemId, JSON.stringify(it).slice(0, 200));
    const c = (await F(w, 'GET', '/brand/knowledge?ns=mca&campaign=hoof')).body;
    const d = (c.duplicates || []).find(x => [x.a.id, x.b.id].indexOf('hoof150') >= 0 && [x.a.id, x.b.id].indexOf(itemId) >= 0);
    ok(d && d.similarity >= 0.75, 'the duplicate is found: ' + JSON.stringify(c.duplicates));
    // nothing merged on its own
    ok((await F(w, 'GET', '/brand/knowledge?ns=mca&campaign=hoof')).body.items.some(x => x.id === itemId && x.status === 'active'), 'both still stand until a person merges');
    eq((await F(w, 'POST', '/brand/knowledge/merge', { ns: 'mca', keep: { kind: 'fact', id: 'hoof150' }, drop: { kind: 'item', id: itemId } })).status, 400, 'a reason is required');
    const m = await F(w, 'POST', '/brand/knowledge/merge', { ns: 'mca', keep: { kind: 'fact', id: 'hoof150' }, drop: { kind: 'item', id: itemId }, reason: 'the same figure, the kit fact is the approved wording' });
    eq(m.status, 200, JSON.stringify(m.body));
    const after = (await F(w, 'GET', '/brand/knowledge?ns=mca&campaign=hoof')).body;
    eq((after.items.find(x => x.id === itemId) || {}).status, 'retired', 'the dropped item is retired, not deleted');
    ok(!(after.duplicates || []).some(x => [x.a.id, x.b.id].indexOf(itemId) >= 0), 'and no longer a duplicate');
  } finally { w.restore(); }
});

await S.t('KN3: an expired fact is held out of production and judged unsupported until a person confirms it', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'X', brief: { objective: 'o' } })).body.id;
    const ctx = (await F(w, 'GET', '/studio/context?project=' + P)).body;
    ok(!(ctx.facts || []).some(f => f.id === 'old12'), 'not in the context: ' + JSON.stringify((ctx.facts || []).map(f => f.id)));
    const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'T', mode: 'composition', copy: { headline: 'Twelve per cent', caption: 'Twelve per cent of diesel, 12 per cent, is used on farms.' }, layout: LAYOUT })).body.asset;
    const ck = (a.versions.find(v => v.id === a.current) || {}).checks || [];
    const c12 = ck.find(c => /12/.test(c.text)); ok(c12 && c12.state === 'unsupported' && /expired|review/.test(c12.note), 'the figure of an expired fact is unsupported: ' + JSON.stringify(c12));
    eq((await F(w, 'POST', '/brand/knowledge/confirm', { ns: 'mca', id: 'old12' })).status, 400, 'confirming needs a new review date or a reason');
    const r = await F(w, 'POST', '/brand/knowledge/confirm', { ns: 'mca', id: 'old12', reviewBy: day(180), reason: 'checked against ABS 2024' }); eq(r.status, 200, JSON.stringify(r.body));
    ok(((await F(w, 'GET', '/studio/context?project=' + P)).body.facts || []).some(f => f.id === 'old12'), 'confirmed, it is in production again');
    const k = (await F(w, 'GET', '/brand/knowledge?ns=mca&campaign=hoof')).body; const f = find(k.items, 'fact', 'old12');
    ok(f.status === 'active' && f.lastConfirmed && f.reviewBy === day(180), JSON.stringify(f));
  } finally { w.restore(); }
});

await S.t('KN4: saving the kit and teaching the brand answer a receipt of what was added, proposed and refused', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    const r = (await F(w, 'POST', '/brand/kit', { ns: 'mca', facts: KIT.facts.concat([{ id: 'new1', text: 'A new figure: 3 million litres.', source: 'ABS', status: 'approved' }, { id: 'new2', text: 'A pending one.', status: 'pending' }]), banned: KIT.banned.concat([{ term: 'handout' }]) })).body;
    ok(r.receipt, 'a receipt: ' + JSON.stringify(r).slice(0, 200));
    ok(r.receipt.added.some(x => /new1|3 million/.test(x)) && r.receipt.added.some(x => /handout/.test(x)), 'added: ' + JSON.stringify(r.receipt.added));
    ok(r.receipt.proposed.some(x => /new2|pending/.test(x)), 'proposed for review: ' + JSON.stringify(r.receipt.proposed));
    const t = (await F(w, 'POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'banned', proposal: { term: 'handout' }, confirm: true, reason: 'the client asked' })).body;
    ok(t.receipt && (t.receipt.refused.some(x => /already/.test(x.why)) || t.receipt.added.length === 0), 'a term already held is refused, and says why: ' + JSON.stringify(t.receipt || t).slice(0, 300));
    const t2 = (await F(w, 'POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'banned', proposal: { term: 'freebie' }, confirm: true, reason: 'the client asked' })).body;
    ok(t2.receipt && t2.receipt.added.some(x => /freebie/.test(x)), 'a new one is added: ' + JSON.stringify(t2.receipt || t2).slice(0, 300));
  } finally { w.restore(); }
});

await S.t('KN5: the brief check names the expired facts in scope before anything is spent', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', Object.assign({}, KIT, { facts: KIT.facts.concat([{ id: 'natold', text: 'National figure now stale.', status: 'approved', campaign: 'national', reviewBy: day(-3) }]) }));
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'G', brief: { objective: 'o' } })).body.id;
    const c = (await F(w, 'GET', '/studio/brief/check?project=' + P)).body;
    const g = (c.gaps || []).find(x => x.code === 'facts_expired'); ok(g, 'the gap: ' + JSON.stringify(c.gaps.map(x => x.code)));
    ok(/^1 approved fact is/.test(g.text) && /12 per cent/.test(g.text) && !/National figure/.test(g.text), 'only the client-wide one, not another campaign\'s: ' + g.text);
  } finally { w.restore(); }
});

const REL = loadRelevance();
const relRun = async (w, cs, ans) => {
  const seen = [];
  w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => { const body = JSON.parse(init.body); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join(''); seen.push({ sys: String(body.system || ''), user });
    const text = /strategy lead of an Australian/.test(String(body.system || '')) ? JSON.stringify(ans) : '{}';
    if (body.stream) { const ev = [{ type: 'message_start', message: { model: body.model, usage: { input_tokens: 1 } } }, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }, { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } }, { type: 'message_stop' }];
      return new Response(ev.map(e => 'event: ' + e.type + '\ndata: ' + JSON.stringify(e) + '\n\n').join(''), { status: 200, headers: { 'content-type': 'text/event-stream' } }); }
    return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: body.model }), { status: 200 }); });
  await F(w, 'POST', '/brand/kit', Object.assign({ ns: REL.ns }, REL.kit));
  const P = (await F(w, 'POST', '/studio/project', { ns: REL.ns, campaign: cs.campaign, title: 'Relevance ' + cs.id, test: true, brief: { campaignConfirmed: true } })).body.id;
  const S = (await F(w, 'POST', '/studio/source', { project: P, kind: 'analyse:brief', name: cs.id, text: cs.paragraphs.join('\n\n') })).body.id;
  let j = (await F(w, 'POST', '/studio/job', { project: P, stage: 'analyse', input: { source: S, kind: 'brief' }, idem: 'rel:' + Math.random() })).body.job;
  for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await F(w, 'POST', '/studio/job/step', { id: j.id })).body.job;
  eq(j.state, 'done', JSON.stringify(j.error || '')); const it = (await F(w, 'GET', '/studio/intel?project=' + P)).body.intel;
  return { it, seen: seen.filter(x => /strategy lead of an Australian/.test(x.sys)), P };
};

await S.t('RL1: the pre-pass names the evidence per paragraph; an unanchored paragraph kept without a reason is set aside; issues carry their evidence', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const cs = REL.cases[0]; const { it, seen } = await relRun(w, cs, cs.answer);
    eq(seen.length, 1, 'one reading'); const u = seen[0].user;
    ok(/PRE-PASS EVIDENCE/.test(u) && /P1: [^\n]*client Harbourline/.test(u) && /P2: campaign harbour "Point Lane"/.test(u) && /P3: campaign nightboat "Night boat"/.test(u) && /P5: NO ANCHOR/.test(u), 'the reading sees the evidence: ' + (u.match(/PRE-PASS EVIDENCE[\s\S]{0,700}/) || [''])[0]);
    ok(/NO ANCHOR may be kept only with a stated reason/.test(seen[0].sys), 'and the rule');
    eq(it.relevant.map(x => x.p), ['P1', 'P2', 'P3', 'P7', 'P8'], 'kept: the anchored ones and the two with reasons');
    const p5 = it.filtered.find(x => x.p === 'P5'); ok(p5 && p5.demoted && /no reason to keep it/.test(p5.why) && /"context"/.test(p5.why), 'P5 set aside with the reason said: ' + JSON.stringify(p5));
    eq(it.relevant.find(x => x.p === 'P7').keptBy, 'reason'); eq(it.relevant.find(x => x.p === 'P2').keptBy, 'evidence');
    ok(it.relevant.every(x => x.evidence && 'anchored' in x.evidence) && it.filtered.every(x => x.evidence), 'every paragraph carries its evidence');
    eq(it.relevant.find(x => x.p === 'P2').evidence.campaign, [{ id: 'harbour', term: 'Point Lane' }]);
    eq(it.relevance, { anchored: 3, unanchored: 5, demoted: 1, keptByReason: 2 }, 'the counts');
    ok(it.topics.every(t => t.evidence && t.evidence.by), 'every topic carries its evidence');
  } finally { w.restore(); }
  // an MCA paragraph is anchored by its CLIENT_ISSUES matcher, and the topic on that issue cites the paragraph
  const w2 = await workerEnv({ env: env0 });
  try {
    const m = w2.mod.__test; ok(m && m.stRelevancePrepass, 'exported');
    const pp = m.stRelevancePrepass(['A crossbencher called the fuel tax credit a subsidy.', 'Weekend rain is forecast.'], { ns: 'mca', kit: KIT });
    eq(pp[0].issues.map(i => [i.id, i.by]), [['ftc', 'trigger']]); eq(pp[1].anchored, false);
    const tp = m.stTopicEvidence([{ name: 'Fuel tax credits', relevance: 'high', issue: 'ftc' }, { name: 'Gas', relevance: 'high', issue: 'gas' }], pp, ['P1', 'P2']);
    eq(tp[0].evidence, { paragraphs: ['P1'], by: 'trigger', unsupported: false }); eq(tp[1].evidence.unsupported, true, 'judged high with no paragraph firing its matcher is said');
  } finally { w2.restore(); }
});

await S.t('RL2: the labelled set scores the reading on the mocked engine above the pre-pass alone and above the raw reading', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const cs = REL.cases[0]; const { it } = await relRun(w, cs, cs.answer);
    const sc = scoreRelevance(it, cs.labels); const raw = scoreRelevance({ relevant: cs.answer.relevant, topics: cs.answer.topics }, cs.labels);
    const pre = scorePrepass(w.mod.__test.stRelevancePrepass(cs.paragraphs, { ns: REL.ns, kit: REL.kit }), cs.labels);
    eq([sc.precision, sc.recall], [1, 1], 'the audited reading: ' + JSON.stringify(sc));
    ok(raw.precision < 1 && raw.extra.indexOf('P5') >= 0, 'the raw reading kept P5: ' + JSON.stringify(raw));
    eq([pre.precision, pre.recall], [1, 0.6], 'the pre-pass alone keeps only what it can anchor');
    eq(sc.issues, 0.75, 'three of four labelled topics judged right (interest rates is labelled not, read as potential)');
  } finally { w.restore(); }
});

await S.t('MR1: a busier campaign never outranks the current one; approved before background; rejected work is AVOID', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const score = t => /BUSY/.test(t) ? 0.97 : /REJ/.test(t) ? 0.99 : /BG/.test(t) ? 0.9 : 0.7;
    w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: Array.from(w.vectors.values()).filter(v => (v.namespace || '') === o.namespace).map(v => ({ score: score(String((v.metadata || {}).title || '')), metadata: v.metadata })).sort((a, b) => b.score - a.score).slice(0, o.topK || 5) });
    await F(w, 'POST', '/brand/kit', KIT);
    for (let i = 0; i < 6; i++) await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'BUSY national caption ' + i, text: 'National mining builds the nation, caption number ' + i + ', long enough to index.', kind: 'copy', campaign: 'national', approval: 'approved', scope: 'campaign' });
    await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'HOOF BG research note', text: 'Background research on diesel use by farmers, long enough to index here.', kind: 'research', campaign: 'hoof', approval: 'background', scope: 'campaign' });
    await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'HOOF approved caption', text: 'Hands off our fuel: the credit is not a subsidy, long enough to index here.', kind: 'copy', campaign: 'hoof', approval: 'approved', scope: 'campaign' });
    await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'HOOF REJ tile', text: 'A rejected HOOF tile that shouted, long enough to index here as well.', kind: 'outcome', campaign: 'hoof', approval: 'rejected', scope: 'campaign' });
    const cs = REL.cases[0];
    const users = [];
    w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => { const body = JSON.parse(init.body); const c0 = body.messages[0].content; users.push(typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join(''));
      return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(cs.answer) }], stop_reason: 'end_turn', model: body.model }), { status: 200 }); });
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Rank', brief: { campaignConfirmed: true } })).body.id;
    const Sx = (await F(w, 'POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'b', text: 'The fuel tax credit is in the news again.\n\nFarmers rely on it.' })).body.id;
    let j = (await F(w, 'POST', '/studio/job', { project: P, stage: 'analyse', input: { source: Sx, kind: 'brief' }, idem: 'rk:' + Math.random() })).body.job;
    for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await F(w, 'POST', '/studio/job/step', { id: j.id })).body.job;
    eq(j.state, 'done', JSON.stringify(j.error || ''));
    const blk = (users.join('\n').match(/KNOWLEDGE IN THE MIND[^\n]*\n([\s\S]*?)\n\n/) || [])[1] || '';
    const lines = blk.split('\n').filter(l => /^\[K\d/.test(l));
    ok(lines.length >= 4, 'passages: ' + blk.slice(0, 600));
    ok(/^\[K1\] HOOF approved caption \[campaign hoof; approved/.test(lines[0]), 'K1 is the campaign\'s approved work, not the busier campaign\'s closer match: ' + lines[0]);
    ok(/^\[K2\] HOOF BG research note \[campaign hoof/.test(lines[1]), 'K2 the campaign\'s background: ' + lines[1]);
    ok(/^\[K3\] AVOID - HOOF REJ tile \[campaign hoof/.test(lines[2]), 'K3 the rejected work, marked: ' + lines[2]);
    ok(lines.slice(3).every(l => /campaign national/.test(l)), 'the national passages only after: ' + lines.slice(3).join(' | '));
    const m = w.mod.__test;
    const d = m.stRankDecisions([{ kind: 'approved', campaign: 'national', at: 9 }, { kind: 'rejected', campaign: 'hoof', at: 1 }, { kind: 'approved', campaign: 'hoof', at: 5 }, { kind: 'approved', campaign: '', at: 7 }], 'hoof');
    eq(d.map(x => [x.campaign, x.at, !!x.avoid]), [['hoof', 5, false], ['hoof', 1, true], ['', 7, false], ['national', 9, false]], 'decisions: this campaign first, newest first, a rejection is avoid');
  } finally { w.restore(); }
});

const ENGINE_DDL = "CREATE TABLE IF NOT EXISTS engine_fixes(id TEXT PRIMARY KEY, ns TEXT, task TEXT, scope TEXT, wrong TEXT, rightt TEXT, why TEXT, rule TEXT, exemplar TEXT, source TEXT, who TEXT, created INTEGER, active INTEGER DEFAULT 1, hits INTEGER DEFAULT 0)";
const fix = (w, id, o) => w.env.MIND_DB.db.prepare('INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,0)').run(id, o.ns || 'mca', o.task || 'copy', 'client', o.wrong || '', o.right || '', 'why', o.rule, '', o.source || 'teach', 'Dee', o.created || Date.now());
const stub = (w, anth) => w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => { const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join(''); if (anth) anth.push({ sys, user });
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200 }); });
const stage = async (w, P, st, input) => { let j = (await F(w, 'POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() })).body.job; for (let i = 0; i < 8 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await F(w, 'POST', '/studio/job/step', { id: j.id })).body.job; return j; };

await S.t('ME1: rules say how often and when they were applied; unused for 90 days is proposed for review, kept or switched off by a person; contradictions are named', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT); w.env.MIND_DB.db.exec(ENGINE_DDL); await F(w, 'GET', '/engine/status?ns=mca');
    fix(w, 'fxnow', { rule: 'Say tax credit, not subsidy', wrong: 'subsidy', right: 'tax credit' });
    fix(w, 'fxtwo', { rule: 'Say rebate, not subsidy', wrong: 'subsidy', right: 'rebate' });
    fix(w, 'fxold', { rule: 'National tiles close with Mining builds the nation', source: 'teach:campaign:national', created: Date.now() - 200 * 864e5 });
    stub(w);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'M', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
    await F(w, 'POST', '/studio/source', { project: P, text: 'Source text for the HOOF tile.', name: 'r' });
    eq((await stage(w, P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false })).state, 'done');   // production for HOOF: the client-wide rules are written into its prompt
    const m = (await F(w, 'GET', '/engine/memory?ns=mca')).body; const r = id => m.rules.find(x => x.id === id);
    ok(r('fxnow').hits >= 1 && r('fxnow').lastApplied > Date.now() - 60000, 'applied, with when: ' + JSON.stringify(r('fxnow')));
    ok(!r('fxold').lastApplied && r('fxold').review && /never applied since it was taught/.test(r('fxold').reviewWhy), 'the national rule, unused for 200 days, is proposed for review: ' + JSON.stringify(r('fxold')));
    ok(!r('fxnow').review, 'a rule in use is not');
    const c = m.conflicts.find(x => x.code === 'rule_contradiction'); ok(c && c.rules.map(x => x.id).sort().join() === 'fxnow,fxtwo' && /corrected two ways/.test(c.text), 'the contradiction: ' + JSON.stringify(m.conflicts));
    ok(r('fxnow').conflict && r('fxtwo').conflict, 'both marked');
    eq((await w.call('POST', '/engine/fix/review', { id: 'fxold', decision: 'keep', reason: 'still the national sign-off' }, 'read-key')).status, 403, 'a read key cannot');
    eq((await F(w, 'POST', '/engine/fix/review', { id: 'fxold', decision: 'keep' })).status, 400, 'a reason is required');
    eq((await F(w, 'POST', '/engine/fix/review', { id: 'fxold', decision: 'keep', reason: 'still the national sign-off' })).status, 200);
    const m2 = (await F(w, 'GET', '/engine/memory?ns=mca')).body; ok(!m2.rules.find(x => x.id === 'fxold').review && /Full: still the national/.test(m2.rules.find(x => x.id === 'fxold').reviewedBy), 'kept, stamped with who and why');
    await F(w, 'POST', '/engine/fix/review', { id: 'fxtwo', decision: 'off', reason: 'the team says tax credit' });
    const t2 = (await F(w, 'GET', '/engine/memory?ns=mca')).body.rules.find(x => x.id === 'fxtwo'); ok(t2 && t2.active === false, 'switched off, not deleted');
    eq((await F(w, 'GET', '/engine/memory?ns=mca&campaign=hoof')).body.rules.some(x => x.id === 'fxold'), false, 'a HOOF view leaves out the national rule');
  } finally { w.restore(); }
});

await S.t('ME2: a learning summary from the recorded verdicts and their reasons; withdrawn verdicts are left out', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    await F(w, 'POST', '/engine/outcome', { ns: 'mca', surface: 'content', ref: 'a1', verdict: 'approved', why: 'plain figures, sourced to the ATO', headline: 'H1' });
    await F(w, 'POST', '/engine/outcome', { ns: 'mca', surface: 'content', ref: 'a2', verdict: 'approved', why: 'sourced figure in plain words', headline: 'H2' });
    await F(w, 'POST', '/engine/outcome', { ns: 'mca', surface: 'release', ref: 'a3', verdict: 'killed', why: 'too shouty, exclamation marks', headline: 'H3' });
    await F(w, 'POST', '/engine/outcome', { ns: 'mca', surface: 'release', ref: 'a4', verdict: 'killed', why: 'WITHDRAWN-REASON shouty again', headline: 'H4' });
    w.env.MIND_DB.db.prepare("UPDATE engine_outcomes SET withdrawn=? WHERE ref='a4'").run(Date.now());
    const sm = (await F(w, 'GET', '/engine/memory?ns=mca')).body.summary;
    eq([sm.approved, sm.killed], [2, 1], 'the withdrawn one is left out');
    ok(sm.by.some(b => b.surface === 'content' && b.approved === 2) && sm.by.some(b => b.surface === 'release' && b.killed === 1), JSON.stringify(sm.by));
    ok(sm.approvedWords.some(x => x.word === 'plain' && x.n === 2) && sm.approvedWords.some(x => /^sourc/.test(x.word)), 'the words the reasons share: ' + JSON.stringify(sm.approvedWords));
    ok(!JSON.stringify(sm).includes('WITHDRAWN-REASON'), 'nothing of the withdrawn verdict');
    ok(/not a rule until someone teaches it/.test(sm.note), 'said as a reading, not a rule');
  } finally { w.restore(); }
});

await S.t('ME3: What informed this creative names every memory item by id: examples followed, work to avoid, corrections, kept items', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: Array.from(w.vectors.values()).filter(v => (v.namespace || '') === o.namespace).slice(0, o.topK || 5).map(v => ({ score: 0.9, metadata: v.metadata })) });
    stub(w); await F(w, 'POST', '/brand/kit', KIT); w.env.MIND_DB.db.exec(ENGINE_DDL); await F(w, 'GET', '/engine/status?ns=mca');
    fix(w, 'fxc', { rule: 'Say tax credit, not subsidy' });
    const okDoc = (await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'HOOF approved caption', text: 'Hands off our fuel: the credit is not a subsidy; long enough to index this.', kind: 'copy', campaign: 'hoof', approval: 'approved', scope: 'campaign' })).body;
    const badDoc = (await F(w, 'POST', '/mind/ingest', { namespace: 'mca_creative', title: 'HOOF rejected caption', text: 'A shouty HOOF caption the team killed, long enough to index this here.', kind: 'copy', campaign: 'hoof', approval: 'rejected', scope: 'campaign' })).body;
    await F(w, 'POST', '/brand/item', { ns: 'mca', campaign: 'hoof', kind: 'rule', authority: 'preference', title: 'Lead with the farmer, not the miner', body: 'from the October brief', reason: 'Dee asked' });
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Informed', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
    await F(w, 'POST', '/studio/source', { project: P, text: 'More than 150,000 businesses use the fuel tax credit.', name: 'r' });
    const j = await stage(w, P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }); eq(j.state, 'done', JSON.stringify(j.error || ''));
    const a = (await F(w, 'GET', '/studio/get?id=' + P)).body.assets[0];
    const u = (await F(w, 'GET', '/studio/used?asset=' + a.id)).body; const mem = ((u.informed || {}).memory) || {};
    const ex = mem.examples || [];
    ok(ex.some(e => e.id === okDoc.docId && e.use === 'example') && ex.some(e => e.id === badDoc.docId && e.use === 'avoid'), 'the example and the work to avoid, by id: ' + JSON.stringify(ex));
    ok((mem.kept || []).some(k => /Lead with the farmer/.test(k.title) && k.authority === 'preference'), 'the kept item: ' + JSON.stringify(mem.kept));
    ok((u.informed.corrections || []).some(c => c.id === 'fxc'), 'the correction');
  } finally { w.restore(); }
});

await S.t('ME4: a withdrawn approval never reaches a prompt as a recorded decision', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const anth = []; stub(w, anth); await F(w, 'POST', '/brand/kit', KIT);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Withdrawn', brief: { objective: 'o' } })).body.id;
    const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'T', mode: 'copy', copy: { headline: 'H', caption: 'c' } })).body.asset;
    const ap = await F(w, 'POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', version: a.current, reason: 'KEEPSAKE-REASON the farmer framing landed with the client' }); eq(ap.status, 200, JSON.stringify(ap.body));
    const P2 = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Reader', brief: { campaignConfirmed: true } })).body.id;
    const S2 = (await F(w, 'POST', '/studio/source', { project: P2, kind: 'analyse:brief', name: 'b', text: 'The fuel tax credit is in the news.' })).body.id;
    let j = await stage(w, P2, 'analyse', { source: S2, kind: 'brief' }); eq(j.state, 'done');
    ok(anth.some(x => /KEEPSAKE-REASON/.test(x.user)), 'standing, the approval is a recorded decision');
    eq((await F(w, 'POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'withdraw', version: a.current, reason: 'the client took it back' })).status, 200);
    anth.length = 0; j = await stage(w, P2, 'analyse', { source: S2, kind: 'brief' }); eq(j.state, 'done');
    const u = anth.filter(x => /strategy lead/.test(x.sys)).map(x => x.user).join('\n'); ok(u.length > 0, 'a reading ran');
    ok(!/KEEPSAKE-REASON/.test(u), 'withdrawn, it never reaches the prompt: ' + (u.match(/.{0,300}KEEPSAKE.{0,100}/) || [''])[0]);
  } finally { w.restore(); }
});

await S.t('IS1: production for two campaigns and another client audits clean; another campaign\'s fact, correction or example on a version is a leak', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    stub(w); await F(w, 'POST', '/brand/kit', KIT); w.env.MIND_DB.db.exec(ENGINE_DDL); await F(w, 'GET', '/engine/status?ns=mca');
    fix(w, 'fxh', { rule: 'HOOF: say the credit is not a subsidy', source: 'teach:campaign:hoof' }); fix(w, 'fxn', { rule: 'National: close with the nation', source: 'teach:campaign:national' });
    await F(w, 'POST', '/brand/kit', { ns: 'synthdemo', name: 'Harbourline Ferries - SYNTHETIC', campaigns: REL.kit.campaigns, facts: REL.kit.facts });
    const made = {};
    for (const [ns, camp] of [['mca', 'hoof'], ['mca', 'national'], ['synthdemo', 'harbour']]) {
      const P = (await F(w, 'POST', '/studio/project', { ns, campaign: camp, title: ns + ' ' + camp, brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
      await F(w, 'POST', '/studio/source', { project: P, text: 'Some source text about the work for ' + camp + '.', name: 'r' });
      const j = await stage(w, P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }); eq(j.state, 'done', ns + '/' + camp + ': ' + JSON.stringify(j.error || '')); made[camp] = P;
    }
    for (const ns of ['mca', 'synthdemo']) { const iso = (await F(w, 'GET', '/studio/metrics?ns=' + ns)).body.isolation; ok(iso && iso.clean && iso.versions >= 1, ns + ' audits clean: ' + JSON.stringify(iso)); }
    // a leak recorded on a HOOF version is caught
    const a = (await F(w, 'GET', '/studio/get?id=' + made.hoof)).body.assets[0];
    const row = w.env.MIND_DB.db.prepare('SELECT context FROM studio_versions WHERE id=?').get(a.current); const ctx = JSON.parse(row.context);
    ctx.informed.kit.facts.push({ id: 'nat74', text: 'Mining paid $74 billion', campaign: 'national' }); ctx.informed.corrections.push({ id: 'fxn', campaign: 'national' }); ctx.informed.memory = { examples: [{ id: 'd9', use: 'example', campaign: 'national' }], kept: [] };
    w.env.MIND_DB.db.prepare('UPDATE studio_versions SET context=? WHERE id=?').run(JSON.stringify(ctx), a.current);
    const iso = (await F(w, 'GET', '/studio/metrics?ns=mca')).body.isolation;
    ok(!iso.clean && ['fact', 'rule', 'example'].every(k => iso.violations.some(v => v.kind === k && /national/.test(v.owner))), 'the leaks are named: ' + JSON.stringify(iso.violations));
  } finally { w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
