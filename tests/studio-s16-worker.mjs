/* The Brief Intelligence and Creative Response Engine (S16). Material arrives as text, a link, an uploaded image or PDF,
 * or something Axiom already holds (a news row, a Sentinel alert, a narrative, the daily brief); one model call reads it
 * against the client in a fixed order - input type, understanding (each field stated, inferred or from knowledge),
 * situation and whether to respond, paragraphs kept and set aside with a class, topics and issues judged for this client,
 * a comparison with what Axiom knows (relevance-retrieved: Mind, live narratives, alerts, recorded decisions, the team's
 * earlier choices, sentiment), ranked objectives with key messages, response strategies (one recommended, not responding
 * among them), and creative directions with visual narratives and a production route - every cited id checked. The team's
 * choices fill the brief and are logged, so the next analysis for the client reads them; directions carry a trace that
 * production copies onto every version; a message kit is written from one direction and checked. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s16-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-s16-worker (the intelligence engine: understand, situate, compare, propose, choose, trace, learn)');
const PNG = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const anth = { calls: [] };
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.calls.push({ sys, user, blocks: Array.isArray(c0) ? c0.map(x => x.type) : ['text'], effort: body.output_config ? body.output_config.effort : '' });
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const ARTICLE = 'Fuel tax credits are back in the news after a Senate crossbencher called the credit a subsidy for miners and said it should be scrapped in the next budget. '.repeat(6);
w.answer(/news\.example\.com\/story/, async () => new Response('<html><head><title>Crossbencher targets fuel tax credit</title><script type="application/ld+json">' + JSON.stringify({ '@type': 'NewsArticle', headline: 'Crossbencher targets fuel tax credit', articleBody: ARTICLE }) + '</script></head><body><article><p>' + ARTICLE + '</p></article></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 5 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input) => { const r = await call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const anCalls = () => anth.calls.filter(c => /strategy lead of an Australian/.test(c.sys));
const db = w.env.MIND_DB.db;

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' },
  campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }],
  facts: [{ text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'MCA analysis', status: 'approved', campaign: 'national' }],
  banned: [{ term: 'subsidy', allowNegated: true }], logoB64: PNG, logoMime: 'image/png' });
// what Axiom already holds: a live narrative on the client's issue, a Sentinel alert, a news row on the issue, the daily brief
await call('GET', '/narratives'); await call('GET', '/sentinel/alerts'); await call('GET', '/archive/stats'); await call('GET', '/engine/status?ns=mca');
const now = Date.now();
db.prepare("INSERT INTO narratives(id,label,claim,counter_claim,issues,ns,side,status,n,last_ts,first_ts,scope,muted) VALUES('nar1','Miners get a free ride on diesel','The credit is a handout','It returns a road tax','[\"ftc\"]','mca','hostile','growing',14,?,?,'client',0)").run(now - 3600e3, now - 86400e3);
db.prepare("INSERT INTO narratives(id,label,claim,issues,ns,status,n,last_ts,first_ts,scope,muted) VALUES('nar2','Gas prices bite','Gas is too dear','[\"gasres\"]','aep','growing',9,?,?,'client',0)").run(now - 3600e3, now - 86400e3);
db.prepare("INSERT INTO arc_alerts(ns,client,issue,label,ratio,hot,baseline,angle,evidence,detected_ts) VALUES('mca','Minerals Council of Australia','ftc','Fuel tax credits',3.4,9,2.6,'Answer with the tax-paid figure','[]',?)").run(now - 7200e3);
db.prepare("INSERT INTO arc_items(kind,src,title,body,url,meta,ts) VALUES('news','abc','Crossbencher calls fuel tax credit a subsidy','The credit is under attack in the Senate.','https://abc.example/1',?,?)").run(JSON.stringify({ issues: ['ftc'], outlet: 'ABC' }), now - 3600e3);
db.prepare("INSERT INTO arc_items(kind,src,title,body,url,meta,ts) VALUES('news','abc','Gas reservation inquiry opens','Unrelated to MCA.','https://abc.example/2',?,?)").run(JSON.stringify({ issues: ['gasres'] }), now - 3600e3);
await w.env.AXIOM_KV.put('brief_' + new Date(now + 10 * 3600e3).toISOString().slice(0, 10), JSON.stringify({ day: new Date(now + 10 * 3600e3).toISOString().slice(0, 10), brief: { headline: 'A busy day for fuel' }, md: '# Daily brief\n\nFuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy.\n\nGas reservation: AEP should watch the inquiry.' }));
await w.env.AXIOM_KV.put('brief_days', JSON.stringify([new Date(now + 10 * 3600e3).toISOString().slice(0, 10)]));

const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Crossbencher', brief: { audience: 'Written by the team', channels: ['facebook'], campaignConfirmed: true } })).body.id;
let S = '';

await T.t('the intake feed offers what Axiom holds for this client only: its alert, its narrative, today\'s news on its issues; another client\'s narrative and news are left out', async () => {
  const f = (await call('GET', '/studio/intake/feed?ns=mca', null, 'read-key')).body;
  eq(f.alerts.map(a => a.label), ['Fuel tax credits']); eq(f.narratives.map(n => n.id), ['nar1']); eq(f.news.map(n => n.title), ['Crossbencher calls fuel tax credit a subsidy']);
});

await T.t('a link becomes a source through the full-text reader; a private address is refused before any fetch; an Axiom item (news, alert, narrative, the daily brief) becomes a source with its provenance', async () => {
  const bad = await call('POST', '/studio/source/url', { project: P, url: 'http://169.254.169.254/latest' }); eq(bad.status, 400); ok(/not read/.test(bad.body.detail), bad.body.detail);
  ok(!w.outbound.some(o => /169\.254/.test(o.url)), 'the private address was never fetched');
  const r = await call('POST', '/studio/source/url', { project: P, url: 'https://news.example.com/story' }); eq(r.status, 200, JSON.stringify(r.body)); S = r.body.id;
  ok(/Crossbencher targets fuel tax credit/.test(r.body.name), r.body.name);
  const it = await call('POST', '/studio/source/item', { project: P, type: 'alert', id: 1 }); eq(it.status, 200, JSON.stringify(it.body)); ok(/^Sentinel: Fuel tax credits/.test(it.body.name));
  const nr = await call('POST', '/studio/source/item', { project: P, type: 'narrative', id: 'nar1' }); eq(nr.status, 200); eq(nr.body.kind, 'situation');
  const br = await call('POST', '/studio/source/item', { project: P, type: 'brief' }); eq(br.status, 200, JSON.stringify(br.body)); eq(br.body.kind, 'daily');
  const g = await get(P); const src = g.sources.find(s => s.id === S); eq(src.provenance, 'https://news.example.com/story'); ok(src.kind === 'analyse:url');
});

let A = null;
await T.t('the analysis reads in order and is checked against what it was given: input type, understanding with its basis, the situation and whether to respond, topics judged for this client (an unknown issue id dropped), a comparison whose citations are real, ranked objectives with key messages (an evidence id never given dropped), strategies with one recommended, directions with visual narratives and a trace', async () => {
  anth.calls.length = 0;
  const j = await stage(P, 'analyse', { source: S, kind: 'url' }); eq(j.state, 'done', j.error);
  const c = anCalls()[0]; ok(c, 'one analysis call'); eq(c.effort, 'high');
  ok(/LIVE NARRATIVES ON THE CLIENT'S ISSUES \(1\):\n\[N1\] Miners get a free ride on diesel/.test(c.user), 'the client\'s live narrative is retrieved; another client\'s is not');
  ok(!/Gas prices bite/.test(c.user)); ok(/SENTINEL ALERTS \(14 days\) \(1\):\n\[A1\] Fuel tax credits x3.4/.test(c.user), 'the alert is retrieved');
  ok(/CLIENT ISSUE LEXICON: ftc=Fuel tax credits/.test(c.user)); ok(/from https:\/\/news\.example\.com\/story/.test(c.user), 'the provenance travels');
  const g = await get(P); A = g.intel; ok(A && A.v === 2, 'the whole reading is on the project');
  eq(A.input.type, 'news'); eq(A.understanding.situation.basis, 'stated'); eq(A.understanding.client.v, 'Minerals Council of Australia'); eq(A.understanding.urgency.v, 'high');
  eq([A.situation.respond, A.situation.kinds], ['yes', ['misinformation', 'campaign']]);
  eq(A.topics.map(t => [t.name, t.relevance, t.issue]), [['Fuel tax credits', 'high', 'ftc'], ['Senate crossbench', 'potential', ''], ['Gas reservation', 'not', '']]);
  eq(A.comparison.cites, ['F1'], 'a cited id never given (K1 with no Mind passages, Z9) is dropped');
  eq([A.comparison.narrative.state, A.comparison.narrative.ref, A.comparison.narrative.narrative], ['existing', 'N1', 'nar1']);
  eq(A.objectives.map(o => [o.id, o.kind, o.messages.map(m => m.id)]), [['O1', 'correct', ['M1.1', 'M1.2']], ['O2', 'reinforce', ['M2.1']]]);
  eq(A.objectives[0].messages[0].evidence, ['F1', 'P2'], 'Q7 was never given');
  eq(A.strategies.map(s => [s.id, s.kind, s.recommended]), [['S1', 'evidence', true], ['S2', 'indirect', false], ['S3', 'none', false]]);
  eq(A.recommendation, { strategy: 'S1', objective: 'O1', message: 'M1.1', direction: 1, why: A.recommendation.why });
  eq(A.directions.map(d => [d.name, d.approach, d.format, d.route, d.objective, d.message, d.strategy]), [['The quiet road', 'data', 'myth_fact', 'editable', 'O1', 'M1.1', 'S1'], ['One striking poster', 'campaign_continuation', 'headline_artwork', 'finished', 'O2', 'M2.1', 'S2']]);
  eq(A.directions[0].visual.textPlacement, 'top third'); eq(A.next.stage, 'copy');
  const d0 = g.directions.find(d => d.title === 'The quiet road'); eq([d0.trace.objective, d0.trace.message, d0.trace.strategy, d0.trace.strategyKind, d0.trace.source], ['O1', 'M1.1', 'S1', 'evidence', S]);
  eq(d0.visualNarrative.lighting, 'low gold sun'); eq(g.brief.analysis.v, 2); eq(g.brief.analysis.intel, A.id); eq(g.brief.intel.id, A.id);
  eq(g.brief.audience, 'Written by the team', 'a field the team wrote is never replaced');
});

await T.t('choosing an objective, a key message and a strategy writes the brief from them and records each choice; a message under another objective is refused; a read key cannot choose', async () => {
  const bad = await call('POST', '/studio/intel/select', { project: P, objective: 'O2', message: 'M1.1' }); eq(bad.status, 400); eq(bad.body.error, 'message_not_under_objective');
  eq((await call('POST', '/studio/intel/select', { project: P, objective: 'O1' }, 'read-key')).status, 403);
  const r = await call('POST', '/studio/intel/select', { project: P, objective: 'O1', message: 'M1.1', strategy: 'S1' }); eq(r.status, 200, JSON.stringify(r.body));
  eq(r.body.brief.objective, 'Correct the subsidy claim before it settles in the regions'); ok(/^The fuel tax credit is not a subsidy/.test(r.body.brief.message)); eq(r.body.brief.action, 'Read the facts');
  eq([r.body.brief.intel.selected.objective.id, r.body.brief.intel.selected.message.id, r.body.brief.intel.selected.strategy.kind], ['O1', 'M1.1', 'evidence']);
  const log = db.prepare("SELECT kind,ref FROM studio_intel_log WHERE ns='mca' ORDER BY created").all(); eq(log.map(x => x.kind + ':' + x.ref), ['objective:O1', 'message:M1.1', 'strategy:S1']);
});

await T.t('producing a narrative as a variant keeps its own route and family, and every version carries the trace back to the source; the writer sees the chosen objective, message and strategy and the direction\'s visual narrative', async () => {
  const g0 = await get(P); const d0 = g0.directions.find(d => d.title === 'The quiet road');
  anth.calls.length = 0;
  const j = await stage(P, 'copy', { channels: ['facebook'], deliverable: 'set', direction: d0.id, variant: true, creationMode: 'editable', render: false, acknowledge: true }); eq(j.state, 'done', j.error);
  const writer = anth.calls.find(c => /producing a coordinated set/.test(c.sys)); ok(writer, 'the writer was called');
  ok(/CHOSEN OBJECTIVE \(O1\): Correct the subsidy claim/.test(writer.user) && /CHOSEN KEY MESSAGE \(M1\.1\)/.test(writer.user) && /CHOSEN RESPONSE STRATEGY \(S1\): evidence/.test(writer.user), 'the choices travel');
  ok(/Approach: data/.test(writer.user) && /Visual format: myth fact/.test(writer.user) && /Visual narrative: scene: an empty regional road at dawn/.test(writer.user), 'the direction travels whole');
  const g = await get(P); const a = g.assets.find(x => x.family === 'Narrative: The quiet road'); ok(a, 'the variant has its own family: ' + g.assets.map(x => x.family).join(','));
  const v = a.versions.find(x => x.id === a.current); eq([v.context.trace.objective, v.context.trace.message, v.context.trace.strategy, v.context.trace.direction, v.context.trace.source], ['O1', 'M1.1', 'S1', d0.id, S]);
  ok(v.mode !== 'finished', 'editable by its own route');
});

await T.t('the message kit is written from one direction: each piece is traced (an evidence id never given dropped) and checked - a figure not in the facts or the kept source is flagged; an edit re-checks; a verdict needs a reason and is learned', async () => {
  const g0 = await get(P); const d0 = g0.directions.find(d => d.title === 'The quiet road');
  const j = await stage(P, 'kit', { direction: d0.id, kinds: ['statement', 'talking_points', 'not_a_kind'] }); eq(j.state, 'done', j.error);
  const t = (await call('GET', '/studio/texts?project=' + P, null, 'read-key')).body.texts; eq(t.length, 2);
  const st = t.find(x => x.kind === 'statement'), tp = t.find(x => x.kind === 'talking_points');
  eq(st.checks, [], 'the statement uses the approved $74 billion figure'); eq(tp.checks.map(c => c.state), ['unsupported'], 'the invented $99 billion is flagged');
  eq([st.trace.objective, st.trace.message, st.trace.direction, st.trace.evidence], ['O1', 'M1.1', d0.id, ['F1', 'P2']]);
  const up = await call('POST', '/studio/text/update', { id: tp.id, body: '1. It is not a subsidy.\n2. It returns a road tax.', revision: tp.revision }); eq(up.status, 200); eq(up.body.text.checks, []);
  const stale = await call('POST', '/studio/text/update', { id: tp.id, body: 'x x x', revision: tp.revision }); eq(stale.status, 409);
  eq((await call('POST', '/studio/text/verdict', { id: st.id, verdict: 'approve' })).status, 400);
  const v = await call('POST', '/studio/text/verdict', { id: st.id, verdict: 'approve', reason: 'leads with the fact' }); eq(v.body.text.status, 'approved');
  ok(db.prepare("SELECT COUNT(*) AS n FROM engine_outcomes WHERE ns='mca' AND surface='studio_kit'").get().n === 1, 'an engine outcome');
  ok(db.prepare("SELECT COUNT(*) AS n FROM studio_intel_log WHERE kind='approved' AND ref='statement'").get().n === 1);
});

await T.t('the learning loop: a decision not to respond needs a reason and is logged; the next analysis for this client reads the team\'s earlier choices and recorded decisions; a recommendation not to respond makes the next step "decide"', async () => {
  eq((await call('POST', '/studio/intel/decision', { project: P, kind: 'no_response', reason: '' })).status, 400);
  const d = await call('POST', '/studio/intel/decision', { project: P, kind: 'reject_direction', ref: '2', reason: 'painted posters read as old-fashioned' }); eq(d.status, 200, JSON.stringify(d.body));
  const P2 = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Second', brief: {} })).body.id;
  const s2 = (await call('POST', '/studio/source', { project: P2, name: 'post', text: 'DO NOT RESPOND test: a crossbencher repeated the subsidy line on fuel tax credits.\n\nNothing new was said.' })).body.id;
  anth.calls.length = 0;
  const j = await stage(P2, 'analyse', { source: s2, kind: 'social' }); eq(j.state, 'done', j.error);
  const u = anCalls()[0].user;
  ok(/THE TEAM'S EARLIER CHOICES IN THIS ENGINE \(\d+\):[\s\S]*reject_direction: One striking poster - because: painted posters read as old-fashioned/.test(u), 'the earlier choice is read');
  ok(/\[H\d+\] objective: correct: Correct the subsidy claim/.test(u)); ok(/RECORDED DECISIONS[^\n]*\(\d+\):\n\[D1\] approved/.test(u), 'the approval is a recorded decision');
  const g = await get(P2); eq([g.intel.situation.respond, g.intel.next.stage], ['no', 'decide']);
  const n = await call('POST', '/studio/intel/decision', { project: P2, kind: 'no_response', reason: 'it would amplify the claim' }); eq(n.status, 200); eq(n.body.brief.intel.noResponse.reason, 'it would amplify the claim');
});

await T.t('an uploaded screenshot is kept as it came, read into paragraphs by the extraction model (the image attached), then analysed with the image in view; a PDF goes to the model as a document; other files are refused', async () => {
  const P3 = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Screenshot', brief: {} })).body.id;
  eq((await call('POST', '/studio/source', { project: P3, name: 'x.zip', fileB64: PNG, mime: 'application/zip' })).status, 400);
  const r = await call('POST', '/studio/source', { project: P3, name: 'post.png', fileB64: PNG, mime: 'image/png' }); eq(r.status, 200, JSON.stringify(r.body)); eq(r.body.file, true);
  ok(Array.from(w.r2.keys()).some(k => k.indexOf('studio/' + P3 + '/sources/') === 0), 'the file is stored as it came');
  anth.calls.length = 0;
  const j = await stage(P3, 'analyse', { source: r.body.id, kind: 'image' }); eq(j.state, 'done', j.error);
  const tr = anth.calls.find(c => /You read an uploaded/.test(c.sys)); ok(tr && tr.blocks[0] === 'image', 'the transcription saw the image');
  ok(anCalls()[0].blocks.indexOf('image') >= 0 && /\[P1\] The fuel tax credit is a subsidy for miners/.test(anCalls()[0].user), 'the analysis read the transcribed paragraphs with the image in view');
  const g = await get(P3); eq(g.sources[0].name, 'Crossbencher post'); ok(Object.keys(g.sources[0].passages).length === 3);
  const pdf = await call('POST', '/studio/source', { project: P3, name: 'report.pdf', fileB64: Buffer.from('%PDF-1.4 test').toString('base64'), mime: 'application/pdf' }); eq(pdf.status, 200);
  anth.calls.length = 0; const j2 = await stage(P3, 'analyse', { source: pdf.body.id, kind: 'pdf' }); eq(j2.state, 'done', j2.error);
  eq(anth.calls.find(c => /You read an uploaded/.test(c.sys)).blocks[0], 'document');
});

const res = T.done(); process.exit(res.fail ? 1 : 0);
