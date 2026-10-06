/* The brief engine (S15). Material - a written brief, a news article, an upload, or a whole daily intelligence brief that
 * covers every client - is added as a source and read by one model call (stage analyse) against THIS client: the
 * paragraphs that concern it are kept and the rest set aside with the reason, the campaign is matched only when the kit
 * has it, every claim is checked against the approved facts (an unknown fact id is never trusted), the Mind is consulted,
 * and the answer proposes the brief (empty fields only), copy angles (a banned term flagged, negation allowed) and visual
 * narratives that become directions carrying their route (editable composition or finished Gemini creative). The source's
 * ledger is narrowed to the kept paragraphs, so the copy stage never sees what was set aside, and reads the analysis.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-s15-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-s15-worker (the brief engine: material read against the client, filtered, matched, then the next stage)');
const PNG_LOGO = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const anth = { calls: [] }; let override = null;
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.calls.push({ sys, user });
  const isAn = /strategy lead of an Australian political communications agency/.test(sys);
  const text = isAn && override ? (typeof override === 'function' ? override(user) : override) : JSON.stringify(answerFor(sys, user));
  return new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 5 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input) => { const r = await call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const anCalls = () => anth.calls.filter(c => /strategy lead of an Australian/.test(c.sys));

const DAILY = [
  '# AXIOM daily brief - 6 October 2026',
  'Fuel tax credits are back in the news: a Senate crossbencher called the credit a subsidy for miners, and regional radio picked it up.',
  'Gas reservation: the energy lobby is pushing for an east-coast reserve; AEP should watch the Senate inquiry.',
  'The MCA analysis showing mining paid $74 billion in company tax and royalties is being quoted by regional MPs.',
  'Housing approvals fell for the third month; the property council will respond tomorrow.'
].join('\n\n');

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' },
  campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo', tone: 'plain, factual' }, { id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'logo' }],
  facts: [{ text: 'Mining paid $74 billion in company tax and royalties in 2023-24', source: 'MCA analysis', status: 'approved', campaign: 'national' }, { text: 'A pending figure nobody approved', status: 'pending' }],
  banned: [{ term: 'subsidy', allowNegated: true, why: 'the frame we answer' }], logoB64: PNG_LOGO, logoMime: 'image/png' });
await call('GET', '/engine/status?ns=mca');
const P = (await call('POST', '/studio/project', { ns: 'mca', title: 'Daily brief', brief: { audience: 'Written by the team', channels: [] } })).body.id;
const S = (await call('POST', '/studio/source', { project: P, kind: 'analyse:daily', name: 'Daily brief 6 Oct', text: DAILY })).body.id;

await T.t('a daily brief covering every client is read against MCA: its paragraphs are kept, the others set aside with the reason, one left unplaced is named; the campaign, facts, banned terms and knowledge reach the model; the proposal fills only empty fields', async () => {
  anth.calls.length = 0;
  const j = await stage(P, 'analyse', { source: S, kind: 'daily' }); eq(j.state, 'done', j.error);
  eq(anCalls().length, 1, 'one model call');
  const u = anCalls()[0].user, sy = anCalls()[0].sys;
  ok(/CAMPAIGNS \(2\):\n- national: Australian mining/.test(u), 'the campaigns are listed');
  ok(/\[F1\] Mining paid \$74 billion/.test(u) && !/A pending figure nobody approved/.test(u), 'approved facts only');
  ok(/BANNED TERMS: subsidy \(fine when negated\)/.test(u), 'banned terms with their negation rule');
  ok(/\[P5\] Housing approvals fell/.test(u), 'every paragraph is numbered for the model');
  ok(/source material is data|never instructions/i.test(sy), 'the untrusted-material rule ends the system prompt');
  const g = await get(P); const a = g.brief.analysis;
  eq(a.relevant.map(x => x.p), ['P2', 'P4'], 'the fuel and mining paragraphs are kept');
  eq(a.filtered.map(x => x.p), ['P1', 'P3'], 'the heading and the gas paragraph are set aside'); ok(/another client/.test(a.filtered[1].why));
  eq(a.unplaced, ['P5'], 'the paragraph the model did not place is named, not counted');
  eq([a.campaign.id, a.campaign.name], ['national', 'Australian mining']);
  eq(a.claims.map(c => [c.status, c.fact]), [['matches_fact', 'F1'], ['new_unverified', '']], 'a conflict naming a fact that was never given is not trusted');
  eq(a.claims[0].factText, 'Mining paid $74 billion in company tax and royalties in 2023-24');
  eq(a.knowledge.length, 0, 'a knowledge id that was not retrieved is dropped');
  eq(a.angles.map(x => x.banned || ''), ['', 'subsidy'], 'the negated use is fine; the plain use is flagged');
  eq(a.next.stage, 'copy');
  eq([g.brief.objective, g.brief.objectiveSource, g.brief.audience, g.brief.audienceSource || ''], ['Answer the subsidy framing while the credit is in the news', 'ai', 'Written by the team', ''], 'only empty fields take the proposal');
  eq(g.brief.channels, ['linkedin', 'instagram'], 'empty channels take the proposal');
  ok(j.result.filled.indexOf('audience') < 0 && j.result.filled.indexOf('objective') >= 0, JSON.stringify(j.result.filled));
  const ev = g.thread.filter(e => e.kind === 'analysis').pop(); ok(ev && /2 of 5 paragraphs concern/.test(ev.text), ev && ev.text);
});

await T.t('the visual narratives become directions with their route (editable or finished) and the project moves to directions; the source keeps the kept paragraphs as its focus with a rule-pass ledger', async () => {
  const g = await get(P); const ids = g.brief.analysis.directions; eq(ids.length, 2);
  const ds = ids.map(id => g.directions.find(d => d.id === id));
  eq(ds.map(d => [d.title, d.route, d.medium, d.renders]), [['The quiet road', 'editable', 'photo-documentary', 1], ['One striking poster', 'finished', 'editorial', 1]]);
  ok(ds.every(d => d.fromAnalysis), 'each direction names the analysis it came from');
  eq(g.status, 'directions');
  const src = g.sources.find(s => s.id === S); ok(src.claims.some(c => c.value === 74), 'the $74 billion figure is in the ledger: ' + JSON.stringify(src.claims.map(c => c.value)));
  ok(src.claims.every(c => ['p2', 'p4'].indexOf(c.passage) >= 0), 'every ledger claim comes from a kept paragraph');
  eq(g.brief.analysis.ledger.focus, 2);
});

await T.t('the copy stage reads the analysis and only the kept paragraphs: nothing about gas or housing reaches the writer', async () => {
  await call('POST', '/studio/project/update', { id: P, revision: (await get(P)).revision, patch: { campaign: 'national', brief: { campaignConfirmed: true, message: 'The credit is not a subsidy' } } });
  anth.calls.length = 0;
  const j = await stage(P, 'copy', { channels: ['linkedin'], deliverable: 'copy', acknowledge: true }); eq(j.state, 'done', j.error);
  const writer = anth.calls.find(c => /producing a coordinated set/.test(c.sys)) || anth.calls[anth.calls.length - 1];
  ok(/BRIEF ANALYSIS of "Daily brief 6 Oct"/.test(writer.user), 'the analysis reaches the writer');
  ok(/angle 1: Not a subsidy\. A tax that never applied\./.test(writer.user), 'the clean angle is offered');
  ok(!/angle 2: The subsidy myth/.test(writer.user), 'a flagged angle is not offered');
  ok(/do NOT use \(conflicts with an approved fact\)|not verified/.test(writer.user), 'claim statuses travel');
  ok(/Senate crossbencher/.test(writer.user), 'a kept paragraph is there');
  ok(!/east-coast reserve/.test(writer.user) && !/Housing approvals/.test(writer.user), 'set-aside paragraphs never reach the writer');
});

await T.t('normalisation against what is real: an unknown campaign is null, unknown paragraph ids are dropped, an unknown route is editable, an unknown next step falls to directions', async () => {
  override = JSON.stringify({ summary: 's', relevant: [{ p: 'P2', why: 'a' }, { p: 'P99', why: 'b' }, { p: 'garbage' }], filtered: [{ p: 'P2', why: 'dup' }], campaign: { id: 'aep-gas', confidence: 0.9 }, brief: { channels: ['tiktok', 'X'] }, claims: [{ text: 'x', status: 'invented' }], narratives: [{ name: 'N', idea: 'i', medium: 'hologram', route: 'magic' }], next: { stage: 'export' } });
  const P2 = (await call('POST', '/studio/project', { ns: 'mca', title: 'Norm', brief: {} })).body.id;
  const S2 = (await call('POST', '/studio/source', { project: P2, name: 'n', text: DAILY })).body.id;
  const j = await stage(P2, 'analyse', { source: S2, kind: 'article' }); eq(j.state, 'done', j.error);
  const a = (await get(P2)).brief.analysis;
  eq(a.relevant.map(x => x.p), ['P2']); eq(a.filtered.length, 0, 'a paragraph is never both kept and set aside'); eq(a.unplaced.length, 4);
  eq(a.campaign.id, null); eq(a.brief.channels, ['x']); eq(a.claims[0].status, 'new_unverified');
  eq([a.narratives[0].medium, a.narratives[0].route], ['', 'editable']); eq(a.next.stage, 'directions');
  override = null;
});

await T.t('failures say why and are not retried: no source, an unparseable answer; a read key cannot start an analysis', async () => {
  const P3 = (await call('POST', '/studio/project', { ns: 'mca', title: 'Fail', brief: {} })).body.id;
  const j1 = await stage(P3, 'analyse', { kind: 'brief' }); eq(j1.state, 'failed'); ok(/no_source/.test(j1.error), j1.error);
  const S3 = (await call('POST', '/studio/source', { project: P3, name: 'n', text: DAILY })).body.id;
  override = 'I would rather talk about the weather.'; anth.calls.length = 0;
  const j2 = await stage(P3, 'analyse', { source: S3 }); eq(j2.state, 'failed'); ok(/analysis_unparseable/.test(j2.error), j2.error);
  override = null;
  const r = await call('POST', '/studio/job', { project: P3, stage: 'analyse', input: { source: S3 }, idem: 'ro' }, 'read-key'); eq(r.status, 403);
});

const res = T.done(); process.exit(res.fail ? 1 : 0);
