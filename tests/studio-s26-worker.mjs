/* S26 (4 November 2026): what S25 left open, closed on the worker.
 *  - A classic project (made without the wizard) chose another direction in silence after pieces were written from the first;
 *    now it asks like a guided one (409 affects_downstream, impact.classic). Update leaves the pieces listed in GET /studio/impact
 *    as direction_changed (a paid rewrite from the chosen direction, and a free keep beside it); keep keeps them as written in
 *    brief.keptDirection, which a new brief analysis does not reset. A rewrite records the chosen direction on its versions.
 *  - Dismissed Creative Partner suggestions were kept in one browser; now they are the team's, per asset and version, with
 *    who and when (POST /studio/suggest/dismiss, `dismissed` on POST /studio/suggest).
 *  - The public / told anyone the build and the git revision. Now it answers an opaque token stamped per upload (AXIOM_DEPLOY);
 *    the build and revision stay on the key-gated status routes.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-s26-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
import { pngB64 } from './png.mjs';
const T = suite('studio-s26-worker (classic projects ask before a direction change; dismissals are the team\'s; the public / names no build)');
const PNG = pngB64(16, 16, { fill: 0x11 });
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input, asset) => { const r = await call('POST', '/studio/job', { project: P, asset, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const impact = async P => (await call('GET', '/studio/impact?project=' + P)).body;
const dirRows = (im) => (im.assets || []).filter(x => x.reasons.some(r => r.code === 'direction_changed'));

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain, factual, regional.',
  campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], logoB64: PNG, logoMime: 'image/png' });
async function classicWithCopy(title) {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title, brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits refund a road tax on fuel used off-road', audience: 'Regional voters', action: 'Read the facts', channels: ['facebook', 'instagram'], deliverable: 'set', campaignConfirmed: true, imageryTiming: 'after_copy' } })).body.id;
  eq((await stage(P, 'direct', { n: 2 })).state, 'done');
  const D = (await get(P)).directions.map(d => d.id); ok(D.length >= 2, 'two directions or more');
  eq((await call('POST', '/studio/direction/choose', { id: D[0] })).status, 200, 'the first choice, with nothing written yet, asks nothing');
  eq((await stage(P, 'copy', { channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, size: '2K' })).state, 'done');
  const g = await get(P); ok(!g.brief.workflow, 'a classic project'); return { P, D, A: g.assets.map(a => a.id) };
}

await T.t('classic: choosing another direction after copy was written names the pieces and asks; nothing changes until answered', async () => {
  const { P, D, A } = await classicWithCopy('Classic direction change: cancel');
  const r = await call('POST', '/studio/direction/choose', { id: D[1] });
  eq([r.status, r.body.error], [409, 'affects_downstream'], JSON.stringify(r.body).slice(0, 300));
  eq([r.body.impact.kind, r.body.impact.classic, r.body.impact.assets], ['direction', true, 2]);
  ok(r.body.impact.items.every(x => A.indexOf(x.id) >= 0 && x.from), JSON.stringify(r.body.impact.items));
  eq((await get(P)).directions.find(d => d.chosen).id, D[0], 'the first direction stays chosen');
  eq(dirRows(await impact(P)).length, 0, 'nothing is listed as stale while the first direction stands');
});

await T.t('classic update: the pieces are listed in Production > Needs attention with a paid rewrite and a free keep; the keep clears one', async () => {
  const { P, D, A } = await classicWithCopy('Classic direction change: update');
  const vBefore = (await get(P)).assets.map(a => a.current);
  const r = await call('POST', '/studio/direction/choose', { id: D[1], decision: 'update' }); eq(r.status, 200, JSON.stringify(r.body));
  const g = await get(P); eq(g.directions.find(d => d.chosen).id, D[1]); eq(g.assets.map(a => a.current), vBefore, 'nothing regenerated');
  ok(g.thread.some(e => e.kind === 'direction' && /under Production > Needs attention/.test(e.text || '')), 'the thread says where they are listed');
  const rows = dirRows(await impact(P)); eq(rows.map(x => x.asset).sort(), A.slice().sort());
  const rs = rows[0].reasons.find(x => x.code === 'direction_changed');
  eq([rs.remedy, rs.paid, rs.keep, rs.direction.id], ['redirect', true, true, D[1]]); ok(/^Written from ".+"; the chosen direction is now ".+"\.$/.test(rs.text), rs.text);
  // the free keep, one piece
  const k = await call('POST', '/studio/direction/keep', { project: P, assets: [A[0]] }); eq([k.status, k.body.kept], [200, [A[0]]]);
  eq(dirRows(await impact(P)).map(x => x.asset), [A[1]], 'only the piece kept is cleared');
  // a rewrite from the chosen direction records it on the version it writes, and the piece is no longer listed
  const j = await stage(P, 'revise', { target: 'asset', asset: A[1], direction: D[1], instruction: 'The chosen direction is now the second one. Rewrite this asset\'s words from it. Keep the locked fields.' }, A[1]);
  eq(j.state, 'done', j.error || '');
  const a1 = (await get(P)).assets.find(a => a.id === A[1]); const cur = a1.versions.find(v => v.id === a1.current);
  eq(cur.context.direction, D[1], 'the rewritten version records the chosen direction');
  eq(dirRows(await impact(P)).length, 0, 'nothing written from another direction is left');
});

await T.t('classic keep: the pieces stay current; a new brief analysis does not bring them back; the keep route refuses another project\'s asset', async () => {
  const { P, D, A } = await classicWithCopy('Classic direction change: keep');
  const r = await call('POST', '/studio/direction/choose', { id: D[1], decision: 'keep' }); eq(r.status, 200, JSON.stringify(r.body));
  let g = await get(P); eq(g.directions.find(d => d.chosen).id, D[1]); eq((g.brief.keptDirection || []).slice().sort(), A.slice().sort(), 'kept in the brief');
  eq(dirRows(await impact(P)).length, 0);
  ok(g.thread.some(e => e.kind === 'direction' && /kept as written/.test(e.text || '')), 'the thread records it');
  // a brief analysis replaces brief.intel; the classic keep list is not inside it
  const s1 = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Client note', text: 'Fuel tax credits are under attack again this week.\n\nRespond on social, regional focus.' })).body.id;
  const an = await stage(P, 'analyse', { sources: [s1], kind: 'brief' }); eq(an.state, 'done', an.error || '');
  g = await get(P); ok(g.brief.intel && g.brief.intel.id, 'the analysis wrote intel'); eq(dirRows(await impact(P)).length, 0, 'the kept pieces stay kept');
  const other = await classicWithCopy('Another project');
  const x = await call('POST', '/studio/direction/keep', { project: P, assets: [other.A[0]] }); eq([x.status, x.body.error], [403, 'cross_project']);
  const ro = await call('POST', '/studio/direction/keep', { project: P, assets: [A[0]] }, 'read-key'); eq(ro.status, 403, 'a read-only key cannot keep: ' + JSON.stringify(ro.body));
});

await T.t('dismissals: one version of one asset, the team\'s (who and when), restored for everyone; refused for a wrong version, key, project or a read key', async () => {
  const { P, A } = await classicWithCopy('Dismissals');
  const g = await get(P); const a = g.assets.find(x => x.id === A[0]); const v = a.current;
  // a composition to suggest for (the classic set is copy and layout; the mocked model answers the suggestions)
  const sg = await call('POST', '/studio/suggest', { project: P, asset: a.id }); ok(sg.body.ok && (sg.body.design || []).length, JSON.stringify(sg.body).slice(0, 200));
  eq(sg.body.dismissed, [], 'nothing dismissed yet');
  const key = 'design|' + sg.body.design[0].text;
  const d1 = await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: v, key }); eq(d1.status, 200, JSON.stringify(d1.body));
  eq(d1.body.dismissed.map(x => [x.key, x.who]), [[key, 'Full']]); ok(d1.body.dismissed[0].at > 0);
  const again = await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: v, key }); eq(again.body.dismissed.length, 1, 'dismissing twice keeps one record (the first)');
  const pk = (await call('GET', '/studio/suggest?asset=' + a.id, null, 'read-key')).body; eq(pk.dismissed.map(x => x.key), [key], 'the cached suggestions carry it, for any reader');
  // another version of the same asset starts clean
  const nv = await call('POST', '/studio/version', { asset: a.id, revision: a.revision, copy: { headline: 'A new headline for the next version' }, note: 'hand edit' }); eq(nv.status, 200, JSON.stringify(nv.body).slice(0, 200));
  const pk2 = (await call('GET', '/studio/suggest?asset=' + a.id)).body; eq([pk2.version, pk2.outdated, pk2.dismissed.length], [v, true, 1], 'the cached advice is the last version\'s, outdated, with its dismissal');
  const fresh = (await call('POST', '/studio/suggest', { project: P, asset: a.id, refresh: true })).body; ok(fresh.version && fresh.version !== v, 'advice for the new version'); eq(fresh.dismissed, [], 'which starts with nothing dismissed');
  // restore
  const r = await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: v, key, dismissed: false }); eq(r.body.dismissed, []);
  // refusals
  eq((await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: g.assets.find(x => x.id === A[1]).current, key })).body.error, 'unknown_version', 'a version of another asset');
  eq((await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: v, key: 'whatever' })).body.error, 'bad_key');
  const other = await classicWithCopy('Dismissals elsewhere');
  eq((await call('POST', '/studio/suggest/dismiss', { project: other.P, asset: a.id, version: v, key })).status, 403, 'a project that is not the asset\'s');
  eq((await call('POST', '/studio/suggest/dismiss', { asset: a.id, version: v, key }, 'read-key')).status, 403, 'a read key cannot dismiss');
});

const res = T.done(); process.exit(res.fail ? 1 : 0);
