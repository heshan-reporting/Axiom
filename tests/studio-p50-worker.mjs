/* P50: the engines release, against the worker module in this process with every provider MOCKED
 * (prompts/studio-engines-and-canvas.md). Each case fails on 4587190 and passes with its change.
 *   E1  every refusal says what it means: a refusal code the worker sends without words of its own is given them
 *       (AX_ERROR_DETAIL), so the page never shows a bare code
 *   Q1  opening a project costs a bounded number of D1 queries: 9 plus at most 10 an asset, independent of how many
 *       versions, notes and events the project holds
 *   D1  a direction edit says what each field held when it began; a field someone else changed since is refused (409), the
 *       rest of the record untouched
 *   K1  a brand-kit save from an editor that read the kit says when; a kit saved by someone else since is refused (409)
 *   W1  one writing core: the Studio's copy stage and the Content Desk put the same client block (voice, campaign facts and
 *       client-wide ones, banned terms, learned corrections) in front of the model for the same client, campaign and channel
 *   M1  channel craft and voice are measured on the current version of every asset (headline fit, reading grade, the feed
 *       fold, hashtags, the call to action against the brief, one message, the campaign sign-off and address; banned and
 *       preferred terms, sentence length, person, tense, exclamation marks, jargon), each with its source
 *   A1  alternatives say their approach, carry their measures, and an option that reads almost the same as another is named
 *   G1  the copy golden set runs through the Studio's copy stage on the mocked engine and tools/copy-eval.mjs scores it: a good
 *       draft passes, a draft with a banned term, a missing figure and no call to action fails with those named
 * Run: node --experimental-sqlite tests/studio-p50-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { scoreCase, loadGolden } from '../tools/copy-eval.mjs';

// a mocked Claude: records every request and answers by what the system prompt asks for
function claudeStub(w, answers) {
  const calls = [];
  w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
    const body = JSON.parse(init.body); const sys = typeof body.system === 'string' ? body.system : (body.system || []).map(x => x.text || '').join('\n'); const user = JSON.stringify(body.messages || []);
    calls.push({ sys, user });
    let out = {};
    for (const [re, fn] of answers) if (re.test(sys)) { out = fn(sys, user); break; }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }], usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  return calls;
}
const core = sys => { const m = String(sys).match(/=== CLIENT WRITING CORE[\s\S]*?=== END OF THE CLIENT WRITING CORE ===/); return m ? m[0] : ''; };
const runJob = async (w, j) => { for (let i = 0; i < 12 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await F(w, 'POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const KIT = { ns: 'mca', name: 'Minerals Council of Australia', voice: 'Plain, confident, sourced. No exclamation marks.', rules: 'No exclamation marks.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', url: 'handsoffourfuel.com.au', active: true }, { id: 'national', name: 'Australian mining', active: true }],
  facts: [{ id: 'hoof1', text: 'More than 150,000 businesses use the fuel tax credit.', source: 'ATO', status: 'approved', campaign: 'hoof' }, { id: 'nat74', text: 'Mining paid $74 billion in tax and royalties.', source: 'ATO', status: 'approved', campaign: 'national' }, { id: 'all30', text: 'Mining paid 30 per cent of all company tax.', source: 'ATO', status: 'approved' }],
  banned: [{ term: 'subsidy', use: 'tax credit', allowNegated: true }] };
const PIECE = c => ({ channel: c, headline: 'Not a subsidy. A tax that never applied.', support: 'More than 150,000 businesses use the credit.', cta: 'Get the facts', caption: 'Farmers and miners do not pay road tax on fuel used off-road. More than 150,000 businesses use the credit. Hands Off Our Fuel.', alt: 'A farmer beside a ute' });

const S = suite('P50: the engines release (worker)');
const env0 = { ANTHROPIC_API_KEY: 'test', STUDIO_INSPECT: '0' };
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const SRC = fs.readFileSync(new URL('../axiomworkerv4.js', import.meta.url), 'utf8');

await S.t('E1: every bare refusal code in the worker has words, and a refusal reaches the page with them', async () => {
  const codes = new Set(); const re = /jsonResp\(\{ (?:ok: false, )?error: '([a-z_0-9]+)'\s*\}, *4\d\d\)/g; let m; while ((m = re.exec(SRC))) codes.add(m[1]);
  const map = (SRC.match(/const AX_ERROR_DETAIL = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const missing = Array.from(codes).filter(c => !new RegExp('\\n  ' + c + ': ').test(map));
  eq(missing, [], 'codes with no words');
  ok(codes.size >= 40, 'the scan found the refusals: ' + codes.size);
  const w = await workerEnv({ env: env0 });
  try {
    const r = await F(w, 'GET', '/studio/get?id=p_nope');
    eq(r.status, 404); ok(/archived|another project|client this key/.test(r.body.detail || ''), 'with words: ' + JSON.stringify(r.body));
    const own = await F(w, 'POST', '/studio/approve', { asset: 'a_nope', part: 'copy', decision: 'approve', reason: 'x' });
    ok(own.body.detail, 'a refusal with words of its own keeps them: ' + JSON.stringify(own.body));
  } finally { w.restore(); }
});

await S.t('Q1: opening a project is 9 queries plus at most 10 an asset, the same with 1 version or 8, and with 150 notes', async () => {
  const counts = [];
  for (const [na, nv, ne] of [[2, 1, 0], [2, 8, 0], [8, 1, 0], [8, 8, 150]]) {
    const w = await workerEnv({ env: env0 });
    try {
      const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', title: 'Q', brief: { objective: 'o' } })).body.id;
      for (let i = 0; i < na; i++) { const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'T' + i, mode: 'composition', copy: { headline: 'H' + i }, layout: LAYOUT })).body.asset; for (let j = 1; j < nv; j++) await F(w, 'POST', '/studio/version', { asset: a.id, project: P, copy: { headline: 'H' + i + '.' + j }, note: 'n' }); }
      for (let k = 0; k < ne; k++) await F(w, 'POST', '/studio/note', { project: P, text: 'note ' + k });
      const n0 = w.env.MIND_DB.log.length; const r = await F(w, 'GET', '/studio/get?id=' + P); eq(r.status, 200);
      counts.push({ na, nv, ne, q: w.env.MIND_DB.log.length - n0 });
    } finally { w.restore(); }
  }
  const by = (na, nv, ne) => counts.find(c => c.na === na && c.nv === nv && c.ne === ne).q;
  eq(by(2, 8, 0), by(2, 1, 0), 'versions do not add queries ' + JSON.stringify(counts));
  eq(by(8, 8, 150), by(8, 1, 0), 'versions and notes do not add queries ' + JSON.stringify(counts));
  ok((by(8, 1, 0) - by(2, 1, 0)) / 6 <= 10 && by(2, 1, 0) - 2 * 10 <= 9, 'at most 9 + 10 an asset: ' + JSON.stringify(counts));
});

await S.t('D1: a direction field someone else changed since the editor opened it is not overwritten', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', title: 'Dirs', brief: { objective: 'o' } })).body.id;
    const id = 'd_test1'; w.env.MIND_DB.db.prepare('INSERT INTO studio_directions(id,project,data,chosen,who,created) VALUES(?,?,?,?,?,?)').run(id, P, JSON.stringify({ title: 'Plain ask', hook: 'Fuel is not a subsidy' }), 0, 'x', Date.now());
    eq((await F(w, 'POST', '/studio/direction/update', { id, patch: { hook: 'Theirs' }, base: { hook: 'Fuel is not a subsidy' } })).status, 200, 'the first edit lands');
    const r = await F(w, 'POST', '/studio/direction/update', { id, patch: { hook: 'Mine' }, base: { hook: 'Fuel is not a subsidy' } });
    eq(r.status, 409); eq(r.body.error, 'direction_changed'); eq(r.body.fields, ['hook']);
    const d = JSON.parse(w.env.MIND_DB.db.prepare('SELECT data FROM studio_directions WHERE id=?').get(id).data); eq(d.hook, 'Theirs', 'theirs stands');
    eq((await F(w, 'POST', '/studio/direction/update', { id, patch: { title: 'Plain ask, sharper' } })).status, 200, 'an edit without base still lands (older pages)');
  } finally { w.restore(); }
});

await S.t('K1: a brand-kit save that read the kit before someone else saved it is refused, and says by whom', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const k0 = (await F(w, 'POST', '/brand/kit', { ns: 'mca', voice: 'Plain and direct' })).body.kit;
    await new Promise(r => setTimeout(r, 5));
    eq((await F(w, 'POST', '/brand/kit', { ns: 'mca', ifUpdated: k0.updated, voice: 'Theirs' })).status, 200, 'saved by someone with the current kit');
    const r = await F(w, 'POST', '/brand/kit', { ns: 'mca', ifUpdated: k0.updated, voice: 'Mine' });
    eq(r.status, 409); eq(r.body.error, 'kit_changed'); ok(/after you opened it/.test(r.body.detail), r.body.detail);
    eq((await F(w, 'GET', '/brand/kit?ns=mca')).body.kit.voice, 'Theirs', 'theirs stands');
  } finally { w.restore(); }
});

await S.t('W1: the Studio copy stage and the Content Desk write from the same client core (and another campaign\'s fact is in neither)', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    const calls = claudeStub(w, [[/producing a coordinated set|coordinated set/, (sys, user) => ({ pieces: [PIECE('facebook')] })], [/senior copywriter/, () => ({ items: [{ platform: 'facebook', body: 'Fuel tax credits are not a subsidy.', cta: 'Get the facts', hashtags: [] }] })]]);
    await F(w, 'POST', '/brand/kit', KIT);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Core', brief: { objective: 'Answer the subsidy claim', message: 'The credit is not a subsidy', action: 'Get the facts', channels: ['facebook'], deliverable: 'copy', campaignConfirmed: true } })).body.id;
    const j = await runJob(w, (await F(w, 'POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['facebook'], deliverable: 'copy' }, idem: 'w1' })).body.job);
    eq(j.state, 'done', JSON.stringify(j.error || j).slice(0, 300));
    const studio = calls.filter(c => core(c.sys)).map(c => core(c.sys))[0] || '';
    await F(w, 'POST', '/content/generate', { ns: 'mca', campaign: 'hoof', platforms: ['facebook'], brief: 'Answer the subsidy claim', n: 1 }); await w.settle();
    const desk = calls.filter(c => /senior copywriter/.test(c.sys)).map(c => core(c.sys))[0] || '';
    ok(studio && desk, 'both prompts carry the marked core: studio ' + studio.length + ', desk ' + desk.length);
    eq(desk, studio, 'the same core, word for word');
    ok(/hoof1|150,000/.test(studio) && /all30|30 per cent/.test(studio) && !/nat74|\$74 billion/.test(studio), 'the campaign\'s and client-wide facts, never another campaign\'s');
    ok(/subsidy/.test(studio), 'the banned terms');
  } finally { w.restore(); }
});

await S.t('M1: the current version carries its channel craft and voice, measured, each with its source', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Craft', brief: { objective: 'o', action: 'Get the facts' } })).body.id;
    const long = 'Fuel tax credits are not a subsidy and never were one, whatever anyone says about it this week in parliament';
    const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '4:5', title: 'Tile', mode: 'composition', copy: { headline: long, support: 'Mining is world-class.', cta: 'Get the facts', caption: 'Farmers do not pay road tax on fuel used off-road! It leverages synergy. #one #two' }, layout: LAYOUT })).body.asset;
    const g = (await F(w, 'GET', '/studio/get?id=' + P)).body; const v = g.assets[0].versions.find(x => x.id === g.assets[0].current);
    const m = k => (v.craft || []).find(x => x.key === k) || {};
    eq(m('headline_fit').ok, false, 'a long headline is over the 4:5 fit'); ok(/format 4:5/.test(m('headline_fit').source), m('headline_fit').source);
    eq(m('hashtags').ok, false, 'two hashtags on Instagram are over the policy');
    eq(m('cta').ok, true, 'the call to action carries the brief\'s action'); ok(m('reading_grade').source && /formula/.test(m('reading_grade').source), 'the reading grade says it is a formula');
    eq(m('signoff').ok, false, 'the campaign sign-off is missing'); eq(m('address').ok, false, 'the campaign address is missing');
    const sig = k => ((v.voice || {}).signals || []).find(x => x.key === k) || {};
    eq(sig('exclamation').ok, false); ok(/kit rule/.test(sig('exclamation').source), sig('exclamation').source);
    eq(sig('jargon').ok, false); ok(/world-class|leverage|synergy/.test(sig('jargon').value), sig('jargon').value);
    ok(typeof v.voice.score === 'number' && v.voice.score < 100, 'a score, below 100 with those signals: ' + v.voice.score);
  } finally { w.restore(); }
});

await S.t('A1: three headline options say their approach and their measures, and a near-copy is named', async () => {
  const w = await workerEnv({ env: env0 });
  try {
    await F(w, 'POST', '/brand/kit', KIT);
    claudeStub(w, [[/.*/, () => ({ kind: 'alternatives', reply: 'Three headlines.', alternatives: { field: 'headline', options: [{ text: 'More than 150,000 businesses use the credit', approach: 'fact-led' }, { text: 'Who pays road tax on a farm track?', approach: 'question' }, { text: 'More than 150,000 businesses use this credit', approach: 'contrast' }] } })]]);
    const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Alts', brief: { objective: 'o' } })).body.id;
    const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '4:5', title: 'Tile', mode: 'composition', copy: { headline: 'Not a subsidy' }, layout: LAYOUT })).body.asset;
    const j = await runJob(w, (await F(w, 'POST', '/studio/job', { project: P, stage: 'revise', input: { target: 'asset', asset: a.id, instruction: 'Three headline options' }, idem: 'a1' })).body.job);
    eq(j.state, 'done', JSON.stringify(j.error || '').slice(0, 300));
    const ev = (await F(w, 'GET', '/studio/get?id=' + P)).body.thread.filter(e => e.kind === 'alternatives').slice(-1)[0];
    eq(ev.approaches, ['fact-led', 'question', 'contrast']);
    ok(ev.craft.every(c => c.some(m => m.key === 'headline_fit')), 'each option is measured: ' + JSON.stringify(ev.craft));
    eq(ev.similar, [2, -1, 0], 'options 1 and 3 read almost the same, and each names the other');
  } finally { w.restore(); }
});

await S.t('G1: the copy golden set through the copy stage, scored: a good draft passes, a bad one fails with its reasons named', async () => {
  const G = loadGolden(); const cs = G.cases[0];
  const run = async pieceFor => {
    const w = await workerEnv({ env: env0 });
    try {
      await F(w, 'POST', '/brand/kit', Object.assign({ ns: G.ns }, G.kit));
      claudeStub(w, [[/coordinated set/, () => ({ pieces: cs.channels.map(pieceFor) })]]);
      const P = (await F(w, 'POST', '/studio/project', { ns: G.ns, campaign: cs.campaign, title: 'Golden ' + cs.id, brief: Object.assign({ channels: cs.channels, deliverable: 'copy', campaignConfirmed: true }, cs.brief) })).body.id;
      const j = await runJob(w, (await F(w, 'POST', '/studio/job', { project: P, stage: 'copy', input: { channels: cs.channels, deliverable: 'copy' }, idem: 'g1' })).body.job);
      eq(j.state, 'done', JSON.stringify(j.error || '').slice(0, 300));
      const g = (await F(w, 'GET', '/studio/get?id=' + P)).body;
      return scoreCase(cs, g.assets.map(x => ({ channel: x.channel, format: x.format, copy: (x.versions.find(y => y.id === x.current) || {}).copy || {} })));
    } finally { w.restore(); }
  };
  const good = await run(c => ({ channel: c, headline: 'Home in 12 minutes', support: 'The night ferry crosses the harbour in 12 minutes.', cta: 'Check the night timetable', caption: 'Finishing late? The night ferry crosses the harbour in 12 minutes. Check the night timetable. Home by the water.' }));
  ok(good.pass && good.score === 100, 'a good draft passes: ' + JSON.stringify(good.pieces.map(p => p.failed)));
  const bad = await run(c => ({ channel: c, headline: 'Cheap rides home!', support: 'Ride with us tonight.', cta: '', caption: 'Cheap rides home tonight!' }));
  ok(!bad.pass && bad.score < 60, 'a bad draft fails: ' + bad.score);
  const failed = bad.pieces[0].failed; ok(['fact:12', 'banned:cheap', 'cta', 'exclamation', 'signoff'].every(k => failed.indexOf(k) >= 0), 'each reason named: ' + failed.join(', '));
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
