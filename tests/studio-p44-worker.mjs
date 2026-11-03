/* The p43 audit (3 November 2026), on the worker. Each case failed on c40397d.
 *  A1 a guest link (a tester's key, full role) reaches test work only: it cannot change a live client's memory by any route - the
 *     brand kit with the namespace in the address, every-client rules, a correction by id, outcomes, the Mind, Content Desk
 *     corrections, a campaign through the Studio - nor touch a live project (remember, approve, versions, a staff job, a text
 *     verdict, a reference observation, project update), nor import a live legacy item; it writes nothing else in AXIOM.
 *     Reading a live project still works, marked read-only. Its own test projects work as before.
 *  A1 a test project files nothing in a client's memory by any route (kit text verdicts too), changes no live rule through a
 *     reference observation, and the client-wide reads (brand workspace, inventory, earlier briefs) leave test projects out.
 *  A2 a measured export is a PNG by its structure: every chunk whole with a right CRC, IHDR first and legal, the image data
 *     decompressing to exactly the size it states with a legal filter on every row, IEND last, and exactly the stage's size.
 *  A3 a withdrawn decision is reported retracted only when its vectors are gone; until then the document is left out of
 *     retrieval, the retraction is pending, and the next tick finishes it.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-p44-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import { pngB64, broken } from './png.mjs';
const T = suite('studio-p44-worker (guest links reach test work only, test projects file nothing, measured PNGs decode, retraction is honest)');
const KEYS = { 'staff-key': { n: 'Jo', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const GUESTS = { 'guest-key-full': { n: 'Tester', r: 'full', until: '2099-01-01' } };
const w = await workerEnv({ keys: KEYS, env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS) } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const STAFF = 'staff-key', GUEST = 'guest-key-full';
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? STAFF : k);
const db = w.env.MIND_DB; const rows = async (sql, ...a) => ((await db.prepare(sql).bind(...a).all()).results || []);
const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
async function project(title, extra, key) { const r = await call('POST', '/studio/project', Object.assign({ ns: 'mca', title, brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits are not a subsidy' } }, extra || {}), key); if (r.status !== 200) throw new Error(JSON.stringify(r.body)); return r.body.project || r.body; }
async function asset(P, mode, key) { const r = await call('POST', '/studio/asset', Object.assign({ project: P, family: 'F', channel: 'facebook', format: '1:1', title: 'Piece ' + mode, copy: { headline: 'Not a subsidy. A tax that never applied.' }, mode }, mode === 'composition' ? { layout: LAYOUT } : {}), key); if (r.status !== 200) throw new Error(JSON.stringify(r.body)); return r.body.asset; }
const cur = async (P, A) => { const g = (await call('GET', '/studio/get?id=' + P)).body; const a = g.assets.find(x => x.id === A); return { a, v: a.versions.find(x => x.id === a.current), g }; };
const refused = (r, code, what) => { ok(r.status === 403 && r.body.error === code, what + ': ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 220)); };

// a live client's project, made by staff, with a composition, a copy piece, a text, a reference with an observation, a queued job
const LIVE = await project('Live MCA work'); const LA = await asset(LIVE.id, 'composition'); const LC = await asset(LIVE.id, 'copy');
const fixR = await call('POST', '/engine/fix', { ns: 'mca', task: 'copy', scope: 'client', wrong: 'subsidy', right: 'tax credit', why: 'Dee said so', rule: 'Never call it a subsidy.' });
const MCAFIX = fixR.body.fix.id;

await T.t('A1 the guard reads the namespace the handler writes: ?ns=mca with {ns:"synthdemo"} in the body does not reach the live kit', async () => {
  const before = JSON.stringify((await call('GET', '/brand/kit?ns=mca')).body);
  const r = await w.call('POST', '/brand/kit?ns=mca', { ns: 'synthdemo', voice: 'Written by a tester' }, GUEST);
  refused(r, 'guest_live_memory', 'kit by the address');
  eq(JSON.stringify((await call('GET', '/brand/kit?ns=mca')).body), before, 'the live kit is unchanged');
  refused(await w.call('POST', '/brand/teach?ns=mca', { ns: 'synthdemo', campaign: 'hoof', kind: 'banned', proposal: { term: 'handout' }, confirm: true, reason: 'tester' }, GUEST), 'guest_live_memory', 'teach by the address');
  eq((await call('POST', '/brand/kit', { ns: 'synthdemo', voice: 'Calm' }, GUEST)).status, 200, 'the synthetic client stays open to a guest');
});

await T.t('A1 a guest cannot make an every-client rule, nor change or delete a live correction by its id', async () => {
  refused(await call('POST', '/engine/fix', { ns: 'synthdemo', task: 'copy', scope: 'all', wrong: 'a', right: 'b', why: 'tester', rule: 'Always say hello.' }, GUEST), 'guest_live_memory', 'scope all');
  refused(await call('POST', '/engine/fix/update', { id: MCAFIX, ns: 'synthdemo', active: false, rule: 'changed by a tester' }, GUEST), 'guest_live_memory', 'update by id');
  refused(await call('POST', '/engine/fix/delete', { id: MCAFIX, ns: 'synthdemo' }, GUEST), 'guest_live_memory', 'delete by id');
  const f = (await rows('SELECT active, rule FROM engine_fixes WHERE id=?', MCAFIX))[0]; ok(f && f.active === 1 && f.rule === 'Never call it a subsidy.', JSON.stringify(f));
  eq((await call('POST', '/engine/fix', { ns: 'synthdemo', task: 'copy', scope: 'client', wrong: 'a', right: 'b', why: 'tester', rule: 'Say ferry.' }, GUEST)).status, 200, 'a synthetic client rule is fine');
});

await T.t('A1 a guest cannot write a live client\'s memory through the engine, the Mind, the Content Desk or the Studio\'s campaign route', async () => {
  const o0 = (await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ns='mca'"))[0].n;
  refused(await call('POST', '/engine/outcome', { ns: 'mca', surface: 'release', ref: 'x', verdict: 'approved', why: 'tester', headline: 'Fake win' }, GUEST), 'guest_live_memory', 'outcome');
  eq((await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ns='mca'"))[0].n, o0, 'no outcome filed');
  const nDocs = async () => { try { return (await rows("SELECT COUNT(*) n FROM mind_docs WHERE ns='mca'"))[0].n; } catch (e) { return 0; } };   // the table exists once something is filed
  const docs0 = await nDocs();
  const mi = await call('POST', '/mind/ingest', { namespace: 'mca', title: 'Planted', text: 'A tester planted this text in the client memory. '.repeat(20), kind: 'doc' }, GUEST);
  ok(mi.status === 403, 'mind ingest refused: ' + mi.status + ' ' + JSON.stringify(mi.body).slice(0, 160));
  eq(await nDocs(), docs0, 'nothing filed in the Mind');
  ok((await call('POST', '/content/revise', { id: 'cs_whatever', instruction: 'always say mate', remember: 'always' }, GUEST)).status === 403, 'Content Desk refused');
  const k0 = JSON.stringify(((await call('GET', '/brand/kit?ns=mca')).body.kit || {}).campaigns || []);
  refused(await call('POST', '/studio/campaign/create', { ns: 'mca', name: 'Tester campaign' }, GUEST), 'guest_live_memory', 'campaign create');
  eq(JSON.stringify(((await call('GET', '/brand/kit?ns=mca')).body.kit || {}).campaigns || []), k0, 'the kit\'s campaigns are unchanged');
  const q = await call('POST', '/mind/query', { namespace: 'mca', q: 'fuel tax credits', k: 3, creative: true }, GUEST);
  ok(q.status !== 403, 'the Mind can still be asked (a read): ' + q.status);
});

await T.t('A1 a guest writes nothing elsewhere in AXIOM: agency-wide stores and acting reads are refused, reads are not', async () => {
  for (const [m, p, b] of [['POST', '/narratives/reset', { all: true, confirm: 'reset' }], ['POST', '/sources/add', { name: 'x', urls: { rss: 'https://example.org/feed' } }], ['POST', '/entities/add', { name: 'Tester', kind: 'person' }], ['POST', '/archive/add', { rows: [] }], ['GET', '/collect', null]]) {
    const r = await call(m, p, b, GUEST); refused(r, 'guest_scope', m + ' ' + p);
  }
  eq((await call('GET', '/studio/list?ns=mca', null, GUEST)).status, 200, 'reads stay open');
});

await T.t('A1 a guest cannot touch a live project: remember, approve, versions, update, a staff job, a text verdict, a reference observation - and reading it says read-only', async () => {
  const fixes0 = (await rows("SELECT COUNT(*) n FROM engine_fixes WHERE ns='mca'"))[0].n; const out0 = (await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ns='mca'"))[0].n;
  refused(await call('POST', '/studio/remember', { project: LIVE.id, eid: 1, scope: 'client', rule: 'Always use exclamation marks!', task: 'copy' }, GUEST), 'guest_live_project', 'remember');
  refused(await call('POST', '/studio/approve', { asset: LC.id, part: 'copy', decision: 'approve', reason: 'Looks great to a tester' }, GUEST), 'guest_live_project', 'approve');
  const { v } = await cur(LIVE.id, LA.id);
  refused(await call('POST', '/studio/version', { asset: LA.id, base: v.id, copy: { headline: 'Changed by a tester' } }, GUEST), 'guest_live_project', 'version');
  refused(await call('POST', '/studio/project/update', { id: LIVE.id, title: 'Renamed by a tester' }, GUEST), 'guest_live_project', 'project update');
  refused(await call('POST', '/studio/lock', { asset: LA.id, element: 'headline', locked: true }, GUEST), 'guest_live_project', 'lock');
  const j = (await call('POST', '/studio/job', { project: LIVE.id, stage: 'echo', input: { say: 'hi' }, idem: 'staff-echo-1' })).body.job;
  refused(await call('POST', '/studio/job/step', { id: j.id }, GUEST), 'guest_live_project', 'job step');
  const js = (await rows('SELECT state, attempts FROM studio_jobs WHERE id=?', j.id))[0]; ok(js.state === 'queued' && !js.attempts, 'the staff job was not claimed: ' + JSON.stringify(js));
  refused(await call('POST', '/studio/job/cancel', { id: j.id }, GUEST), 'guest_live_project', 'job cancel');
  await db.prepare("INSERT INTO studio_texts(id,project,ns,kind,title,body,trace,checks,status,revision,job,who,created,updated) VALUES('tx_live1',?,'mca','talking_points','Talking points','Fuel tax credits are not a subsidy.','{}','[]','draft',0,'','Jo',1,1)").bind(LIVE.id).run();
  refused(await call('POST', '/studio/text/verdict', { id: 'tx_live1', verdict: 'approve', reason: 'tester likes it' }, GUEST), 'guest_live_project', 'text verdict');
  refused(await call('POST', '/studio/text/update', { id: 'tx_live1', project: 'p_not_this_one', body: 'Rewritten by a tester', revision: 0 }, GUEST), 'guest_live_project', 'text update (the row decides the project, not the body)');
  eq((await rows("SELECT COUNT(*) n FROM engine_fixes WHERE ns='mca'"))[0].n, fixes0, 'no rule added'); eq((await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ns='mca'"))[0].n, out0, 'no outcome filed');
  const g = await call('GET', '/studio/get?id=' + LIVE.id, null, GUEST); eq(g.status, 200);
  ok(g.body.readOnly === true && g.body.readOnlyWhy === 'guest_live', 'a guest reads a live project as read-only: ' + JSON.stringify([g.body.readOnly, g.body.readOnlyWhy]));
  ok((await call('GET', '/studio/get?id=' + LIVE.id)).body.readOnly === false, 'staff still edit it');
  eq((await call('POST', '/studio/feedback', { project: LIVE.id, note: 'The tile flickered when I opened it.', view: 'design' }, GUEST)).status, 200, 'a guest can still report a problem on what they saw');
});

await T.t('A1 a guest cannot import a live client\'s legacy work (the one import slot stays the agency\'s); its own test projects still work', async () => {
  await call('GET', '/content/list?ns=mca');
  await db.prepare("INSERT INTO content_sets(id,ns,campaign,segment,brief,source,platforms,items,status,job,who,history,created,updated) VALUES('cs_live1','mca','hoof','members','HOOF captions','null','[\"linkedin\"]','[{\"n\":0,\"platform\":\"linkedin\",\"body\":\"Fuel tax credits are not a subsidy.\"}]','done','','Dee','[]',1000,2000)").run();
  refused(await call('POST', '/studio/import', { legacy: 'cs:cs_live1' }, GUEST), 'guest_live_project', 'import');
  const i = await call('POST', '/studio/import', { legacy: 'cs:cs_live1' }); eq([i.status, i.body.existing], [200, false], 'the agency imports it afresh: ' + JSON.stringify(i.body).slice(0, 160));
  const mine = await project('Tester sandbox', {}, GUEST); eq(mine.test, true);
  const a = await asset(mine.id, 'copy', GUEST);
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Fine for the test' }, GUEST)).status, 200, 'approving in a test project works');
  eq((await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ref LIKE ?", a.id + '%'))[0].n, 0, 'and files nothing');
});

await T.t('A1 a test project files nothing by any route: a kit text verdict files no outcome; a reference observation changes no live rule', async () => {
  const P = await project('Staff test run', { test: true });
  await db.prepare("INSERT INTO studio_texts(id,project,ns,kind,title,body,trace,checks,status,revision,job,who,created,updated) VALUES('tx_test1',?,'mca','talking_points','Talking points','Words.','{}','[]','draft',0,'','Jo',1,1)").bind(P.id).run();
  eq((await call('POST', '/studio/text/verdict', { id: 'tx_test1', verdict: 'approve', reason: 'fine for the test' })).status, 200);
  eq((await rows("SELECT COUNT(*) n FROM engine_outcomes WHERE ref='tx_test1'"))[0].n, 0, 'no WIN filed from a test project');
  // a reference in the test project whose observation was promoted to a live rule: correcting it there must not supersede the rule
  const ref = await call('POST', '/studio/reference', { project: P.id, name: 'Approved tile', purpose: 'approved', imageB64: pngB64(64, 64), mime: 'image/png' }); eq(ref.status, 200, JSON.stringify(ref.body));
  const meta = { observations: [{ id: 'ob1', area: 'placement', text: 'logo bottom right', authority: 'observed', status: 'promoted', promoted: { fix: MCAFIX } }] };
  await db.prepare('UPDATE studio_references SET meta=? WHERE id=?').bind(JSON.stringify(meta), ref.body.id).run();
  await call('POST', '/studio/reference/observation', { id: ref.body.id, obs: 'ob1', action: 'retire', rule: 'retire', why: 'trying it out in a test' });
  eq((await rows('SELECT active FROM engine_fixes WHERE id=?', MCAFIX))[0].active, 1, 'the live rule stays in force');
  // the control: the same retirement on a live project, by staff, does switch its rule off (so the route is really exercised)
  const f2 = (await call('POST', '/engine/fix', { ns: 'mca', task: 'tiles', scope: 'client', wrong: 'logo top', right: 'logo bottom right', why: 'observed', rule: 'Logo bottom right.' })).body.fix.id;
  const ref2 = await call('POST', '/studio/reference', { project: LIVE.id, name: 'Approved live tile', purpose: 'approved', imageB64: pngB64(64, 64), mime: 'image/png' }); eq(ref2.status, 200);
  await db.prepare('UPDATE studio_references SET meta=? WHERE id=?').bind(JSON.stringify({ observations: [{ id: 'ob1', area: 'placement', text: 'logo bottom right', authority: 'observed', status: 'promoted', promoted: { fix: f2 } }] }), ref2.body.id).run();
  const rr = await call('POST', '/studio/reference/observation', { id: ref2.body.id, obs: 'ob1', action: 'retire', rule: 'retire', why: 'no longer the convention' }); eq(rr.status, 200, JSON.stringify(rr.body).slice(0, 200));
  eq((await rows('SELECT active FROM engine_fixes WHERE id=?', f2))[0].active, 0, 'on a live project the route retires the rule with its evidence');
});

await T.t('A1 the client-wide reads leave test projects out: the brand workspace and inventory list no test reference, brief suggestions use no test brief', async () => {
  const P = await project('Test project with a reference', { test: true, campaign: 'hoof' });
  const r = await call('POST', '/studio/reference', { project: P.id, name: 'TESTREF tile', purpose: 'approved', campaign: 'hoof', imageB64: pngB64(64, 64), mime: 'image/png' }); eq(r.status, 200);
  const ws = JSON.stringify((await call('GET', '/brand/workspace?ns=mca')).body); ok(!/TESTREF/.test(ws), 'the workspace lists no test reference');
  const inv = JSON.stringify((await call('GET', '/brand/inventory?ns=mca')).body); ok(!/TESTREF/.test(inv), 'the inventory lists no test reference');
  await project('Earlier test brief', { test: true, campaign: 'hoof', brief: { objective: 'TESTBRIEF objective nobody approved', message: 'TESTBRIEF message', audience: 'x' } });
  const live = await project('Live brief to suggest for', { campaign: 'hoof' });
  const s = JSON.stringify((await call('GET', '/studio/brief/suggest?project=' + live.id)).body); ok(!/TESTBRIEF/.test(s), 'no suggestion from a test brief: ' + s.slice(0, 200));
});

await T.t('A2 a measured export must be a PNG by its structure and exactly the stage\'s size: each malformed file is refused and nothing is stored', async () => {
  const { v, a } = await cur(LIVE.id, LA.id); const rep = stubReport(v, a);
  const keys0 = Array.from(w.r2.keys()).filter(k => /-export-/.test(k)).length;
  for (const kind of ['nosig', 'crc', 'truncated', 'noiend', 'trailing', 'zero', 'short', 'filter', 'baddeflate', 'idatgap']) {
    const r = await call('POST', '/studio/validation', { asset: LA.id, version: v.id, report: rep, imageB64: broken(kind).toString('base64') });
    ok(r.status === 422 && /^(bad_png|image_size)$/.test(r.body.error), kind + ' refused: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
  }
  const small = await call('POST', '/studio/validation', { asset: LA.id, version: v.id, report: rep, imageB64: pngB64(540, 540) }); eq([small.status, small.body.error], [422, 'image_size']);
  eq(Array.from(w.r2.keys()).filter(k => /-export-/.test(k)).length, keys0, 'no malformed file was stored');
  const good = await call('POST', '/studio/validation', { asset: LA.id, version: v.id, report: rep, imageB64: pngB64(1080, 1080) });
  eq(good.status, 200, JSON.stringify(good.body).slice(0, 200)); ok(good.body.validation.exportHash && good.body.validation.exportW === 1080, 'a real PNG at the stage size is recorded');
  eq((await call('POST', '/studio/validation', { asset: LA.id, version: v.id, report: rep, imageB64: pngB64(1080, 1080, { alpha: true, fill: 9 }) })).status, 200, 'RGBA is a PNG too');
});

await T.t('A2 the render save route holds a PNG to the same rule (a JPEG or WebP working image is never bound to a measurement)', async () => {
  const P = await project('Render save'); const A = await asset(P.id, 'composition'); const { v } = await cur(P.id, A.id);
  for (const kind of ['nosig', 'crc', 'short']) { const r = await call('POST', '/studio/render/save', { asset: A.id, version: v.id, imageB64: broken(kind).toString('base64'), mime: 'image/png' }); ok(r.status === 422 && /^(bad_png|image_size)$/.test(r.body.error), kind + ': ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160)); }
  eq((await call('POST', '/studio/render/save', { asset: A.id, version: v.id, imageB64: pngB64(1080, 1080, { fill: 3 }), mime: 'image/png' })).status, 200);
});

await T.t('A3 a withdrawal whose vector deletion fails is pending, not retracted: the document leaves retrieval at once, and the next tick finishes it', async () => {
  // the fixture's index answers nothing; here it answers what it holds, so retrieval is really tested
  const realQuery = w.env.MIND_VECTORS.query;
  w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: Array.from(w.vectors.values()).filter(v => v.namespace === o.namespace).map(v => ({ id: v.id, score: 0.9, metadata: v.metadata })) });
  const P = await project('Retraction'); const a = await asset(P.id, 'copy');
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Right for the campaign' })).status, 200);
  const o = (await rows("SELECT * FROM engine_outcomes WHERE surface='studio' AND ref LIKE ?", a.id + '%'))[0]; ok(o && o.doc, 'filed');
  const titles = async () => ((await call('POST', '/mind/query', { namespace: 'mca', q: 'Not a subsidy', topK: 12 })).body.hits || []).map(h => h.title);
  ok((await titles()).some(t => /^WIN: Not a subsidy/.test(t)), 'retrieval finds the WIN while it stands');
  const real = w.env.MIND_VECTORS.deleteByIds; let fail = true;
  w.env.MIND_VECTORS.deleteByIds = async ids => { if (fail) throw new Error('vectorize unavailable'); return real(ids); };
  try {
    const r = await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'withdraw' }); eq(r.status, 200, JSON.stringify(r.body));
    ok(r.body.learned === 'retraction_pending' && r.body.retract && r.body.retract.pending === 1 && r.body.retract.done === 0 && /retried on the next tick/.test(r.body.retract.detail), 'the answer says pending, not retracted: ' + JSON.stringify([r.body.learned, r.body.retract]));
    eq((await rows('SELECT status FROM mind_docs WHERE id=?', o.doc))[0].status, 'retracting', 'the document is marked, so retrieval leaves it out');
    ok(Array.from(w.vectors.keys()).some(k => k.indexOf(o.doc + '_') === 0), 'its vectors are still there (the deletion failed)');
    ok(!(await titles()).some(t => /^WIN: Not a subsidy/.test(t)), 'retrieval does not return a document being retracted');
    const oo = (await rows('SELECT withdrawn, retract, retract_err FROM engine_outcomes WHERE id=?', o.id))[0]; ok(oo.withdrawn > 0 && oo.retract === 'pending' && /vectorize unavailable/.test(oo.retract_err), JSON.stringify(oo));
    fail = false; { let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited; }
    eq((await rows('SELECT status FROM mind_docs WHERE id=?', o.doc))[0].status, 'retracted', 'the tick finished it');
    ok(!Array.from(w.vectors.keys()).some(k => k.indexOf(o.doc + '_') === 0), 'the vectors are gone');
    eq((await rows('SELECT retract FROM engine_outcomes WHERE id=?', o.id))[0].retract, 'done');
    // approving again files a fresh document; it does not revive the retracted one
    eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Right for the campaign' })).status, 200);
    const o2 = (await rows("SELECT doc FROM engine_outcomes WHERE surface='studio' AND ref LIKE ? AND COALESCE(withdrawn,0)=0", a.id + '%'))[0]; ok(o2 && o2.doc && o2.doc !== o.doc, 'a new document: ' + JSON.stringify([o2, o.doc]));
    eq((await rows('SELECT status FROM mind_docs WHERE id=?', o.doc))[0].status, 'retracted', 'the old one stays retracted');
  } finally { w.env.MIND_VECTORS.deleteByIds = real; w.env.MIND_VECTORS.query = realQuery; }
});

w.restore();
T.done();
