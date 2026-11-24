/* The Express build (23 November 2026). The team's complaint was the number of steps: a guided project asked for about a dozen
 * decisions across eight screens before a tile could be downloaded. A project now says how it is built - brief.build, 'express'
 * or 'detailed', asked first in the wizard. A detailed project is the seven steps exactly as they were. An express project
 * keeps the same record and the same seven worker steps, so every rule that reads them still holds, and asks for less:
 *   - one confirmation covers the reading, the objective with its key message, and the strategy (step 'plan'), with Axiom's
 *     recommendation taken where the person chose nothing, and nothing written when any part of it is refused;
 *   - the canvas and the imagery do not wait for a "ready for design" tick on the words;
 *   - Review opens on a piece that passes its checks; the words and the design are approved there, by a person, as before.
 * What does not change: the campaign is asked for when the kit has several, not responding is a decision with a reason, a paid
 * render is asked for by a person, and approval is a person's. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-express-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
import { pngB64 } from './png.mjs';
const T = suite('studio-express-worker (two ways to build: express asks once, detailed is the seven steps unchanged)');
const PNG = pngB64(16, 16, { fill: 0x11 });
const anth = { calls: [] };
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.calls.push({ sys, user });
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const queue = (P, st, input) => call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() });
const stage = async (P, st, input) => { const r = await queue(P, st, input); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const states = wf => wf.order.map(k => k + ':' + wf.steps[k].state).join(' ');

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain, factual, regional.',
  campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }],
  facts: [{ text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'MCA analysis', status: 'approved', campaign: 'national' }],
  banned: [{ term: 'subsidy', allowNegated: true }], logoB64: PNG, logoMime: 'image/png' });
const BRIEF = { workflow: 2, projectType: 'response', campaignMode: 'existing', channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, campaignConfirmed: true, creationMode: 'editable', imageryTiming: 'after_copy' };
const TEXT = 'Fuel tax credits are under attack: a crossbencher called the credit a subsidy for miners.\n\nPlease respond on social this week, regional focus.\n\nMining paid $74 billion in company tax and royalties, the regional radio story says.';
/** A project of one build with its brief analysed (one model call), at the point where a person first has to decide. */
async function analysed(build, extra) {
  const P = (await call('POST', '/studio/project', Object.assign({ ns: 'mca', campaign: 'national', title: 'Crossbencher response, ' + (build || 'unset') + ' ' + Math.random().toString(36).slice(2, 6), brief: Object.assign({}, BRIEF, build ? { build } : {}, (extra || {}).brief || {}) }, (extra || {}).project || {}))).body.id;
  const s = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Client note', text: TEXT })).body.id;
  const j = await stage(P, 'analyse', { sources: [s], kind: 'brief' }); if (j.state !== 'done') throw new Error('analysis: ' + j.error);
  return P;
}
/** From an analysed project to written copy, by the shortest road each build allows. */
async function written(build, extra) {
  const P = await analysed(build, extra);
  if (build === 'express') { const r = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan' }); if (r.status !== 200) throw new Error('plan: ' + JSON.stringify(r.body)); }
  else { for (const b of [{ step: 'brief' }, { step: 'objectives', objective: 'O1', message: 'M1.1' }, { step: 'strategy', strategy: 'S1' }]) { const r = await call('POST', '/studio/workflow/confirm', Object.assign({ project: P }, b)); if (r.status !== 200) throw new Error(b.step + ': ' + JSON.stringify(r.body)); } }
  const d = await stage(P, 'direct', { n: 3 }); if (d.state !== 'done') throw new Error('directions: ' + d.error);
  const g0 = await get(P); const ch = await call('POST', '/studio/direction/choose', { id: g0.directions[0].id }); if (ch.status !== 200) throw new Error('choose: ' + JSON.stringify(ch.body));
  const b = g0.brief; const c = await stage(P, 'copy', { channels: b.channels, deliverable: b.deliverable, formats: b.formats, size: '1K' }); if (c.state !== 'done') throw new Error('copy: ' + c.error);
  return P;
}

await T.t('X1 a project says how it is built: express or detailed, kept on the brief, on the workflow and in the library; anything else is detailed, and an older project says nothing', async () => {
  const mk = async brief => (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Build ' + JSON.stringify(brief.build), brief: Object.assign({}, BRIEF, brief) })).body.id;
  const px = await mk({ build: 'express' }); const pd = await mk({ build: 'detailed' }); const pw = await mk({ build: 'whatever' }); const p0 = await mk({});
  const gx = await get(px); eq(gx.brief.build, 'express'); eq(gx.workflow.build, 'express');
  const gd = await get(pd); eq(gd.brief.build, 'detailed'); eq(gd.workflow.build, 'detailed');
  eq((await get(pw)).brief.build, 'detailed', 'an unknown build is the seven steps, the route every rule was written for');
  const g0 = await get(p0); eq(g0.brief.build, undefined, 'a project made before the question keeps no answer'); eq(g0.workflow.build, 'detailed');
  const rows = (await call('GET', '/studio/list?ns=mca')).body.projects; const row = id => rows.find(r => r.id === id);
  eq(row(px).build, 'express'); eq(row(pd).build, 'detailed'); eq(row(p0).build, 'detailed');
  // a later brief save does not lose it
  const up = await call('POST', '/studio/project/update', { id: px, revision: gx.revision, patch: { brief: { objective: 'Correct the claim' } } }); eq(up.status, 200, JSON.stringify(up.body));
  eq((await get(px)).brief.build, 'express');
});

await T.t('X2 one confirmation: the reading, Axiom\'s recommended objective with its key message, and its recommended strategy are confirmed together, by a person, in one request', async () => {
  const P = await analysed('express'); const g0 = await get(P);
  eq(states(g0.workflow), 'brief:needs_review objectives:locked strategy:locked directions:locked copy:locked design:locked review:locked');
  eq(g0.workflow.steps.directions.need, 'Confirm the plan in the Brief to continue.', 'a locked step names what an express project does next, not a step it never walks');
  const rec = g0.intel.recommendation; ok(rec.objective && rec.strategy, 'the reading recommends an objective and a strategy: ' + JSON.stringify(rec));
  const ro = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan' }, 'read-key'); eq(ro.status, 403);
  const n0 = anth.calls.length;
  const r = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan' }); eq(r.status, 200, JSON.stringify(r.body));
  eq(anth.calls.length, n0, 'confirming spends nothing');
  eq(states(r.body.workflow), 'brief:complete objectives:complete strategy:complete directions:not_started copy:locked design:locked review:locked');
  const sel = r.body.brief.intel.selected; eq(sel.objective.id, rec.objective); eq(sel.strategy.id, rec.strategy);
  const obj = g0.intel.objectives.find(o => o.id === rec.objective); eq(sel.message.id, rec.message || obj.messages[0].id, 'the recommended message, or the first under the objective');
  eq(r.body.brief.objective, obj.title); eq(r.body.step, 'plan'); eq(r.body.confirmed, ['brief', 'objectives', 'strategy']);
  const conf = r.body.brief.intel.confirmed; eq(conf.objectives.by, 'Full'); eq(conf.strategy.by, 'Full'); eq(r.body.brief.intel.reviewed.by, 'Full', 'each part names the person who confirmed it');
  ok((await get(P)).thread.some(e => e.kind === 'workflow' && /one confirmation/i.test(e.text || '')), 'the thread says it was one confirmation');
  // the directions are now allowed, as after three confirmations
  const d = await queue(P, 'direct', { n: 3 }); eq(d.status, 200, JSON.stringify(d.body));
});

await T.t('X3 the person\'s own picks are taken over the recommendation, and a pick that cannot stand writes nothing at all', async () => {
  const P = await analysed('express'); const g0 = await get(P);
  const o2 = g0.intel.objectives.find(o => o.id !== g0.intel.recommendation.objective) || g0.intel.objectives[0];
  const bad1 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', objective: 'O9' }); eq(bad1.status, 400); eq(bad1.body.error, 'unknown_objective');
  const bad2 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', objective: 'O1', message: 'M2.1' }); eq(bad2.status, 400); eq(bad2.body.error, 'message_not_under_objective');
  const bad3 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', strategy: 'S9' }); eq(bad3.status, 400); eq(bad3.body.error, 'unknown_strategy');
  const none = g0.intel.strategies.find(s => s.kind === 'none'); if (none) { const bad4 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', strategy: none.id }); eq(bad4.body.error, 'use_decision'); }
  const bad5 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', campaign: 'nosuch' }); eq(bad5.status, 400); eq(bad5.body.error, 'unknown_campaign');
  const g1 = await get(P); eq(states(g1.workflow), states(g0.workflow), 'a refused plan confirms no part of it'); eq(g1.brief.intel.reviewed, undefined);
  const strat = g0.intel.strategies.filter(s => s.kind !== 'none').pop();
  const r = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', objective: o2.id, message: o2.messages[0].id, strategy: strat.id }); eq(r.status, 200, JSON.stringify(r.body));
  eq(r.body.brief.intel.selected.objective.id, o2.id); eq(r.body.brief.intel.selected.message.id, o2.messages[0].id); eq(r.body.brief.intel.selected.strategy.id, strat.id);
});

await T.t('X4 the campaign is still a person\'s decision: with two campaigns in the kit and none chosen the plan is refused whole, and is confirmed with the campaign (or standalone) named', async () => {
  await call('POST', '/brand/kit', { ns: 'twocamp', name: 'Two Campaigns Pty', palette: { primary: '#224466' }, campaigns: [{ id: 'alpha', name: 'Alpha' }, { id: 'beta', name: 'Beta' }] });
  const mk = async () => { const P = (await call('POST', '/studio/project', { ns: 'twocamp', title: 'Which campaign ' + Math.random().toString(36).slice(2, 6), brief: Object.assign({}, BRIEF, { build: 'express', campaignMode: 'detect', campaignConfirmed: false }) })).body.id; const s = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Note', text: TEXT })).body.id; const j = await stage(P, 'analyse', { sources: [s], kind: 'brief' }); eq(j.state, 'done', j.error); return P; };
  const P = await mk(); const g0 = await get(P);
  const r = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan' }); eq(r.status, 409, JSON.stringify(r.body)); eq(r.body.error, 'campaign_required');
  eq(states((await get(P)).workflow), states(g0.workflow), 'nothing was confirmed while the campaign was undecided');
  const ok1 = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', campaign: 'beta' }); eq(ok1.status, 200, JSON.stringify(ok1.body)); eq(ok1.body.campaign, 'beta');
  eq(ok1.body.workflow.steps.strategy.state, 'complete'); eq(ok1.body.workflow.steps.brief.state, 'complete', 'the reading stays reviewed under the campaign chosen with it');
  const P2 = await mk(); const alone = await call('POST', '/studio/workflow/confirm', { project: P2, step: 'plan', campaign: '' }); eq(alone.status, 200, JSON.stringify(alone.body)); eq(alone.body.campaign || '', ''); eq(alone.body.brief.campaignMode, 'standalone');
});

await T.t('X5 not responding is still a decision with a reason: the plan can stop at the objective, and the decision is recorded as it always was', async () => {
  const P = await analysed('express');
  const r = await call('POST', '/studio/workflow/confirm', { project: P, step: 'plan', upto: 'objectives' }); eq(r.status, 200, JSON.stringify(r.body));
  eq(states(r.body.workflow), 'brief:complete objectives:complete strategy:not_started directions:locked copy:locked design:locked review:locked'); eq(r.body.confirmed, ['brief', 'objectives']);
  const noWhy = await call('POST', '/studio/intel/decision', { project: P, kind: 'no_response' }); ok(noWhy.status >= 400, 'a decision not to respond needs its reason');
  const d = await call('POST', '/studio/intel/decision', { project: P, kind: 'no_response', reason: 'The claim has no reach yet; answering would spread it.' }); eq(d.status, 200, JSON.stringify(d.body));
  const g = await get(P); eq(g.workflow.steps.strategy.state, 'complete'); eq(g.workflow.steps.strategy.noResponse, true); eq(g.workflow.steps.directions.state, 'locked');
});

await T.t('X6 in an express project the canvas and the imagery do not wait for a "ready for design" tick; in a detailed project they still do', async () => {
  const PX = await written('express'); const PD = await written('detailed');
  const gx = await get(PX); const gd = await get(PD);
  eq(states(gd.workflow), 'brief:complete objectives:complete strategy:complete directions:complete copy:in_progress design:locked review:locked', 'detailed: unchanged');
  eq(gd.workflow.steps.design.need, 'Mark at least one piece of copy ready for design to continue.');
  eq(gx.workflow.steps.copy.state, 'complete'); ok(/written/.test(gx.workflow.steps.copy.note), gx.workflow.steps.copy.note);
  ok(gx.workflow.steps.design.state !== 'locked', 'express: the canvas is open as soon as the copy is written: ' + gx.workflow.steps.design.state);
  const imd = await call('POST', '/studio/imagery', { asset: gd.assets[0].id, size: '1K' }); eq(imd.status, 409); eq(imd.body.error, 'copy_not_ready');
  const imx = await call('POST', '/studio/imagery', { asset: gx.assets[0].id, size: '1K' }); eq(imx.status, 200, JSON.stringify(imx.body)); ok(imx.body.jobs.length >= 1, 'the imagery a person asked for is queued');
  const pd = await call('POST', '/studio/production', { project: PD, mode: 'editable' }); eq(pd.body.skipped.map(x => x.code), ['copy_not_ready', 'copy_not_ready']);
  const px = await call('POST', '/studio/production', { project: PX, mode: 'editable', assets: [gx.assets[1].id], size: '1K' }); eq(px.status, 200, JSON.stringify(px.body)); eq(px.body.done, [gx.assets[1].id]);
  // the words are still approved by a person, later: nothing here approved them
  eq((await get(PX)).assets.filter(a => a.approvals && a.approvals.copy).length, 0);
});

await T.t('X7 Review opens on a piece that passes its checks; the words and the design are approved there by a person, and nothing is approved for them', async () => {
  const PX = await written('express', { brief: { deliverable: 'copy' } }); const PD = await written('detailed', { brief: { deliverable: 'copy' } });
  const gx = await get(PX); const gd = await get(PD);
  eq(gd.workflow.steps.review.state, 'locked'); eq(gd.workflow.steps.review.need, 'Mark at least one piece of copy ready to continue.');
  eq(gx.workflow.steps.review.state, 'not_started', 'express: Review is open with nothing approved yet'); ok(/0 of 2 approved/.test(gx.workflow.steps.review.note), gx.workflow.steps.review.note);
  eq(gx.workflow.steps.design.state, 'skipped');
  for (const a of gx.assets) { const r = await call('POST', '/studio/approve', { asset: a.id, version: a.current, part: 'copy', decision: 'approve', reason: 'Reads right for the regional audience.' }); eq(r.status, 200, JSON.stringify(r.body)); }
  eq((await get(PX)).workflow.steps.review.state, 'complete');
});

await T.t('X8 the one-confirmation step is the guided workflow\'s: a project made before it answers as it always did, and a detailed project may use the step without becoming express', async () => {
  const classic = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Before the wizard', brief: { channels: ['facebook'], deliverable: 'copy' } })).body.id;
  const c = await call('POST', '/studio/workflow/confirm', { project: classic, step: 'plan' }); eq(c.status, 400); eq(c.body.error, 'not_guided');
  const PD = await analysed('detailed'); const r = await call('POST', '/studio/workflow/confirm', { project: PD, step: 'plan' }); eq(r.status, 200, JSON.stringify(r.body));
  eq(r.body.brief.build, 'detailed'); eq(r.body.workflow.steps.strategy.state, 'complete');
  const bad = await call('POST', '/studio/workflow/confirm', { project: PD, step: 'everything' }); eq(bad.status, 400); eq(bad.body.error, 'bad_step');
});

T.done();
