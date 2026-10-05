/* Genuinely different directions, and the six creative actions stated before they are taken (S8). Directions are
 * measured on the argument and on the medium: a set that argues the same thing twice, or draws every direction in one
 * medium, goes back to the model once (REPLAN) for replacements that differ in argument AND medium; the event records
 * what was replanned and why, and a replan can be declined. GET /studio/actions says for one composition, as it stands,
 * what each of the six actions - refine, explore variations, explore layouts, create a new design, generate or
 * re-render the imagery, edit an area - would change, preserve and cost, and whether it can run now with the reason
 * when it cannot (copy only, a finished bitmap, a locked layout, no imagery yet, a render in flight). Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s8-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor, RELEASE } from './studio-answers.mjs';
const T = suite('studio-s8-worker (different directions by argument and medium; the six actions with change / preserve / cost)');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
const PNG_LOGO = Buffer.from('89504e470d0a1a0a' + '11'.repeat(100), 'hex').toString('base64');
const DIR = (t, medium, idea, msg) => ({ title: t, message: msg, insight: 'i', headline: t, opening: 'o', visual: 'v', rationale: 'r', claims: ['c1'], uncertainty: 'u', idea, copyApproach: 'question then answer', medium, composition: 'words left', typography: 'caps', colour: 'teal', references: [], plan: ['set the type'], renders: medium === 'typographic' ? 0 : 1 });
const anth = { calls: [] }; let dirMode = 'distinct';
const w = await workerEnv({ env: { STUDIO_INSPECT: '1', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/generativelanguage/, async (u) => {
  if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 });
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: PNG } }] } }] }), { status: 200 });
});
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.calls.push({ sys, user });
  let a;
  if (/genuinely different directions/.test(sys)) {
    const replan = /\n\nREPLAN\./.test(user);
    if (dirMode === 'alike') a = replan ? { directions: [DIR('Who pays the bill', 'infographic', 'Follow the litre', 'Each litre carries road tax')] } : { directions: [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the fuel tax credit too'), DIR('Your tractor as well', 'photo-documentary', 'It is your tractor as well', 'Farmers use the fuel tax credit as well'), DIR('Road tax returned', 'typographic', 'A tax for roads, returned', 'The tax pays for roads')] };
    else if (dirMode === 'narrow') a = replan ? { directions: [DIR('Follow the litre', 'infographic', 'Follow the litre', 'Each litre carries a road tax it never used')] } : { directions: [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the credit'), DIR('The quiet road', 'photo-documentary', 'A road nobody drove', 'Off-road fuel pays no road tax'), DIR('The bowser at dawn', 'photo-documentary', 'Dawn at the bowser', 'Who fills up before the city wakes')] };
    else if (dirMode === 'stubborn') a = replan ? { directions: [DIR('Your tractor as ever', 'photo-documentary', 'It is your tractor as ever', 'Farmers use the fuel tax credit as ever')] } : { directions: [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the fuel tax credit too'), DIR('Your tractor as well', 'photo-documentary', 'It is your tractor as well', 'Farmers use the fuel tax credit as well'), DIR('Road tax returned', 'typographic', 'A tax for roads, returned', 'The tax pays for roads')] };
    else a = { directions: [DIR('Your tractor too', 'photo-documentary', 'It is your tractor too', 'Farmers use the credit'), DIR('Road tax returned', 'typographic', 'A tax for roads, returned', 'The tax pays for roads'), DIR('Who pays the bill', 'infographic', 'Follow the litre', 'Each litre carries road tax')] };
  } else a = answerFor(sys, user);
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 5 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input, asset) => { const r = await call('POST', '/studio/job', { project: P, asset, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const curOf = a => a.versions.find(v => v.id === a.current);
const dirCalls = () => anth.calls.filter(c => /genuinely different directions/.test(c.sys));
const actions = async (A, key) => (await call('GET', '/studio/actions?asset=' + A, null, key || 'read-key')).body;
const act = (d, id) => d.actions.find(x => x.id === id);

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], facts: [], logoB64: PNG_LOGO, logoMime: 'image/png' });
await call('GET', '/engine/status?ns=mca');
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Directions', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram'], campaignConfirmed: true } })).body.id;
await call('POST', '/studio/source', { project: P, text: RELEASE, name: 'release' });

await T.t('two directions that argue the same thing in different words go back once: the model is asked for a replacement that differs in argument and medium, the set is re-measured, the event says what was replanned and why', async () => {
  dirMode = 'alike'; anth.calls.length = 0;
  const j = await stage(P, 'direct', { n: 3 }); eq(j.state, 'done', j.error);
  eq(dirCalls().length, 2, 'one planning call and one replan'); ok(/REPLAN\. Of the directions you proposed, these argue the same thing/.test(dirCalls()[1].user) && /"Your tractor as well" resembles "Your tractor too"/.test(dirCalls()[1].user) && /differ from every standing one in the argument AND in the medium/.test(dirCalls()[1].user), dirCalls()[1].user.slice(-700));
  eq([j.result.replanned, j.result.replanWhy, j.result.similar], [1, 'alike', 0], JSON.stringify(j.result));
  eq(j.result.titles.sort(), ['Road tax returned', 'Who pays the bill', 'Your tractor too'].sort(), 'the look-alike was replaced, the others stand');
  eq(j.result.media.sort(), ['infographic', 'photo-documentary', 'typographic']);
  const ev = (await get(P)).thread.filter(e => e.kind === 'directions').pop(); eq([ev.replanned, ev.replanWhy], [1, 'alike']); ok(/replanned once because it read as another in different words/.test(ev.text), ev.text);
  ok(j.result.diversity > 0.6, 'the set is diverse after the replan: ' + j.result.diversity);
});
await T.t('three directions in one medium are a narrow set even when the arguments differ: one replan asks for a different medium; a replan can be declined (replan:false) and the narrowness is then recorded, not hidden', async () => {
  dirMode = 'narrow'; anth.calls.length = 0;
  const j = await stage(P, 'direct', { n: 3 }); eq(j.state, 'done', j.error);
  eq(dirCalls().length, 2); ok(/Every direction you proposed is photo-documentary/.test(dirCalls()[1].user) && /\(not photo-documentary\)/.test(dirCalls()[1].user), dirCalls()[1].user.slice(-500));
  eq([j.result.replanned, j.result.replanWhy, j.result.narrow], [1, 'one medium', false]); ok(j.result.media.indexOf('infographic') >= 0, JSON.stringify(j.result.media));
  anth.calls.length = 0;
  const j2 = await stage(P, 'direct', { n: 3, replan: false }); eq(j2.state, 'done', j2.error);
  eq(dirCalls().length, 1, 'no second call when declined'); eq([j2.result.replanned, j2.result.narrow, j2.result.media], [0, true, ['photo-documentary']]);
  const ev = (await get(P)).thread.filter(e => e.kind === 'directions').pop(); eq(ev.narrow, true);
});
await T.t('a replan that comes back alike again is marked, not hidden, and no third call is made; a distinct set makes one call only', async () => {
  dirMode = 'stubborn'; anth.calls.length = 0;
  const j = await stage(P, 'direct', { n: 3 }); eq(j.state, 'done', j.error);
  eq(dirCalls().length, 2); eq(j.result.replanned, 1); eq(j.result.similar, 1, 'still one look-alike after the one round');
  const g = await get(P); const last = g.directions.slice(-3); ok(last.some(d => d.similar && d.replanFailed), 'the look-alike is marked with replanFailed: ' + JSON.stringify(last.map(d => [d.title, d.similar, d.replanFailed])));
  dirMode = 'distinct'; anth.calls.length = 0;
  const j3 = await stage(P, 'direct', { n: 3 }); eq(dirCalls().length, 1); eq([j3.result.replanned, j3.result.similar, j3.result.narrow], [0, 0, false]);
});

let A = '';
await T.t('the six actions on a composition with imagery: each states what it changes, what it keeps and what it costs; layouts cost no render, the imagery costs one render plus an inspection, an area edit states its limit; a read key may ask', async () => {
  const j = await stage(P, 'copy', { channels: ['instagram'], deliverable: 'set', render: true, acknowledge: true }); eq(j.state, 'done', j.error);
  let g = await get(P); const a = g.assets.find(x => x.family !== 'Copy'); A = a.id;
  for (const rj of g.jobs.filter(x => x.stage === 'render' && x.state === 'queued')) await run(rj);
  g = await get(P); ok(curOf(g.assets.find(x => x.id === A)).image, 'the imagery landed');
  for (const ij of (await get(P)).jobs.filter(x => x.stage === 'inspect' && x.state === 'queued')) await run(ij);
  const d = await actions(A); eq(d.ok, true, JSON.stringify(d)); eq(d.actions.map(x => x.id), ['refine', 'explore', 'layouts', 'new', 'imagery', 'area']);
  ok(d.actions.every(x => x.changes.length && x.preserves.length && x.cost && x.cost.text && x.label && x.what), 'every action is stated');
  ok(d.actions.every(x => x.available), 'all six available: ' + JSON.stringify(d.actions.filter(x => !x.available).map(x => [x.id, x.why])));
  const lay = act(d, 'layouts'); ok(/no render, ever/.test(lay.cost.text) && lay.cost.renders === 0 && /photograph exactly/.test(lay.preserves.join(' ')), JSON.stringify(lay));
  const img = act(d, 'imagery'); eq(img.label, 'Re-render the imagery'); eq([img.cost.renders, img.cost.calls], [1, 1]); ok(/1 render at 2K plus 1 inspection call/.test(img.cost.text), img.cost.text); ok(/the layout/.test(img.preserves.join(' ')) && /campaign mark/.test(img.preserves.join(' ')), JSON.stringify(img.preserves));
  const ar = act(d, 'area'); ok(/nothing outside the area is guaranteed/.test(ar.cost.text) && /measured/.test(ar.preserves[0]), JSON.stringify(ar));
  const ex = act(d, 'explore'); ok(/1 model call/.test(ex.cost.text) && /look alike/.test(ex.cost.text) && /approved words/.test(ex.preserves.join(' ')), JSON.stringify(ex));
  ok(/campaign mark/.test(act(d, 'new').preserves.join(' ')) && /never inherited/.test(act(d, 'new').changes.join(' ')), JSON.stringify(act(d, 'new')));
  eq((await call('GET', '/studio/actions?asset=nope', null, 'read-key')).status, 404);
});
await T.t('the statements follow the state: a locked layout closes refine, explore and layouts and says so (a new design stays open); a render in flight closes the imagery actions; copy only closes everything; a finished bitmap offers Regenerate and Switch to Editable instead', async () => {
  await call('POST', '/studio/lock', { asset: A, element: 'layout', locked: true });
  let d = await actions(A); eq(['refine', 'explore', 'layouts'].map(id => act(d, id).available), [false, false, false]); ok(/locked/.test(act(d, 'refine').why), act(d, 'refine').why); eq(act(d, 'new').available, true, 'a new design does not touch the locked layout');
  await call('POST', '/studio/lock', { asset: A, element: 'layout', locked: false });
  const rj = await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road', aspect: '1:1' }, idem: 'inflight-' + Math.random() }); eq(rj.status, 200, JSON.stringify(rj.body));
  d = await actions(A); eq([act(d, 'imagery').available, act(d, 'area').available, act(d, 'layouts').available], [false, false, true]); ok(/a render is queued/.test(act(d, 'imagery').why), act(d, 'imagery').why);
  await run(rj.body.job);
  const PC = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Copy', brief: { objective: 'o', message: 'm', channels: ['linkedin'], campaignConfirmed: true } })).body.id;
  const jc = await stage(PC, 'copy', { channels: ['linkedin'], deliverable: 'copy', acknowledge: true }); eq(jc.state, 'done', jc.error);
  const dc = await actions((await get(PC)).assets[0].id); eq(dc.mode, 'copy'); ok(dc.actions.every(x => !x.available && /copy only/.test(x.why)), JSON.stringify(dc.actions.map(x => [x.id, x.why])));
  const PF = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'Finished', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true, creationMode: 'finished' } })).body.id;
  const jf = await stage(PF, 'copy', { channels: ['instagram'], deliverable: 'visual', acknowledge: true, render: true }); eq(jf.state, 'done', jf.error);
  const df = await actions((await get(PF)).assets[0].id); eq(df.mode, 'finished');
  ok(ST6(df).every(x => !x.available && /bitmap/.test(x.why)), JSON.stringify(ST6(df).map(x => [x.id, x.why])));
  const rg = act(df, 'regenerate'), dv = act(df, 'derive'); ok(rg && dv, 'the finished actions are offered');
  ok(/entire bitmap/.test(rg.changes.join(' ')) && /1 render/.test(rg.cost.text), JSON.stringify(rg)); eq([dv.available, dv.cost.renders, dv.cost.calls], [true, 0, 0]); ok(/free/.test(dv.cost.text) && /finished original/.test(dv.preserves.join(' ')), JSON.stringify(dv));
});
function ST6(d) { return d.actions.filter(x => ['refine', 'explore', 'layouts', 'new', 'imagery', 'area'].indexOf(x.id) >= 0); }

const res = T.done(); process.exit(res.fail ? 1 : 0);
