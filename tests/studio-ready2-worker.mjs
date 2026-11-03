/* Studio test readiness (S28), the high and medium findings that live on the worker. Each case failed on d2a51b1.
 *  H4 a review link always ends (14 days unless asked, at most 30); a client's decision says it came through a link, under a name
 *     the visitor typed and nobody verified, on the thread and in the export manifest.
 *  M1 the status says how each provider last answered, not only whether a key is set.
 *  M2 a reference is what its bytes say; a prepared copy must be the same picture (the same shape).
 *  M3 the link reader checks every redirect: a public page that redirects to a private address is not read.
 *  M4 an outcome's date is the Sydney day.
 *  M5 test projects are left out of the outcome metrics unless asked for.
 *  M6 the library tells live work from test projects, and a client's test projects are archived in one go.
 * Providers MOCKED. Run: node --experimental-sqlite tests/studio-ready2-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
const T = suite('studio-ready2-worker (link lifetime and wording, provider status, reference bytes, link hops, Sydney days, metrics, test projects)');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
const db = w.env.MIND_DB; const rows = async (sql, ...a) => ((await db.prepare(sql).bind(...a).all()).results || []);
const png = (wd, ht, fill) => { const b = Buffer.alloc(200, fill || 1); Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex').copy(b, 0); b.writeUInt32BE(wd, 16); b.writeUInt32BE(ht, 20); b[24] = 8; b[25] = 6; return b.toString('base64'); };
async function project(title, extra) { const r = await call('POST', '/studio/project', Object.assign({ ns: 'mca', title, brief: { objective: 'Correct the subsidy myth', message: 'Fuel tax credits are not a subsidy', audience: 'Regional voters' } }, extra || {})); if (r.status !== 200) throw new Error(JSON.stringify(r.body)); return r.body.id; }
async function copyAsset(P) { return (await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'facebook', format: '1:1', title: 'Words', copy: { headline: 'Not a subsidy. A tax that never applied.' }, mode: 'copy' })).body.asset; }
const runJob = async (P, stage, input) => { const r = await call('POST', '/studio/job', { project: P, stage, input, idem: stage + ':' + Math.random() }); let j = r.body.job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };

await T.t('H4 a review link always ends: no expiry asked means 14 days, more than the maximum is held to 30, never "no expiry"', async () => {
  const P = await project('Link lifetime'); const a = await copyAsset(P);
  const s0 = await call('POST', '/studio/share', { project: P, assets: [a.id], label: 'Round 1', expiresDays: 0 }); eq(s0.status, 200, JSON.stringify(s0.body));
  const d0 = (s0.body.share.expires - Date.now()) / 86400000; ok(s0.body.share.expires > 0 && d0 > 13.9 && d0 < 14.1, 'about 14 days: ' + d0);
  const s1 = await call('POST', '/studio/share', { project: P, assets: [a.id], label: 'Round 2', expiresDays: 365 }); const d1 = (s1.body.share.expires - Date.now()) / 86400000; ok(d1 > 29.9 && d1 < 30.1, 'held to 30 days: ' + d1);
  ok(!(await rows("SELECT data FROM studio_events WHERE project=? AND kind='share'", P)).some(r => /no expiry/.test(r.data)), 'no event says "no expiry"');
});

await T.t('H4 a client approval says it came through a link, under a name the visitor typed and nobody verified: on the thread and in the export manifest', async () => {
  const P = await project('Link approval'); const a = await copyAsset(P);
  eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Words are right' })).status, 200);
  const sh = await call('POST', '/studio/share', { project: P, assets: [a.id], label: 'HOOF round 1', expiresDays: 7, allowApprove: true }); const token = sh.body.token;
  const g = await w.call('GET', '/review/get', null, null, { 'X-Review-Token': token }); eq(g.status, 200, JSON.stringify(g.body));
  const v = g.body.assets[0].version.id;
  const d = await w.call('POST', '/review/decision', { asset: a.id, version: v, decision: 'approve', author: 'The CEO' }, null, { 'X-Review-Token': token }); eq(d.status, 200, JSON.stringify(d.body));
  const ev = (await rows("SELECT data FROM studio_events WHERE project=? AND kind='client_review'", P)).map(r => JSON.parse(r.data).text);
  ok(ev.some(t => /through the review link "HOOF round 1"/.test(t) && /name as given, not verified: "The CEO"/.test(t)), JSON.stringify(ev));
  const ex = await runJob(P, 'export', {}); eq(ex.state, 'done', ex.error);
  const keys = Array.from(w.r2.keys()).filter(k => k.indexOf('studio/' + P + '/export/') === 0 && k.endsWith('.json')); const m = JSON.parse(w.r2.get(keys[0]).v.toString());
  const cl = m.assets[0].client; ok(cl && cl.via === 'review link "HOOF round 1"' && cl.nameVerified === false && cl.by === 'The CEO', JSON.stringify(cl));
});

await T.t('M1 the status says how each provider last answered, beside whether its key is set', async () => {
  const P = await project('Provider status'); const j = await runJob(P, 'strategy', { instruction: 'draft' }); eq(j.state, 'done', j.error);
  const st = (await call('GET', '/studio/status')).body; ok(st.keys && st.keys.claude, 'configured');
  ok(st.lastProvider && st.lastProvider.claude && st.lastProvider.claude.ok === true && st.lastProvider.claude.at > 0, JSON.stringify(st.lastProvider));
});

await T.t('M2 a reference is what its bytes say: text declared as a PNG is refused; a prepared copy of another shape is refused; the real thing is kept as its own type', async () => {
  const P = await project('References');
  const bad = await call('POST', '/studio/reference', { project: P, purpose: 'imagery', name: 'not an image', mime: 'image/png', imageB64: Buffer.from('<svg onload=alert(1)>' + 'x'.repeat(200)).toString('base64') });
  eq([bad.status, bad.body.error], [400, 'bad_type'], JSON.stringify(bad.body));
  const mis = await call('POST', '/studio/reference', { project: P, purpose: 'imagery', name: 'photo', mime: 'image/jpeg', imageB64: png(2000, 1000), prepB64: png(800, 800), prepMime: 'image/jpeg' });
  eq([mis.status, mis.body.error], [422, 'prep_mismatch'], JSON.stringify(mis.body));
  const good = await call('POST', '/studio/reference', { project: P, purpose: 'imagery', name: 'photo', mime: 'image/jpeg', imageB64: png(2000, 1000), prepB64: png(1000, 500), prepMime: 'image/jpeg' });
  eq(good.status, 200, JSON.stringify(good.body)); ok(/\.png$/.test(good.body.key), 'stored as the PNG it is, whatever was declared: ' + good.body.key);
  eq(w.r2.get(good.body.key).o.httpMetadata.contentType, 'image/png');
});

await T.t('M3 the link reader checks every redirect: a public page that redirects to a private address is not read and nothing reaches it', async () => {
  const P = await project('Link hops');
  // as a real fetch does: redirect 'follow' (the default) goes on to the Location by itself; only 'manual' hands the 302 back
  w.answer(/^https:\/\/news\.example\.org\/story/, async (u, init) => (init && init.redirect === 'manual') ? new Response('', { status: 302, headers: { Location: 'http://127.0.0.1:80/admin' } }) : globalThis.fetch('http://127.0.0.1:80/admin', init));
  w.answer(/^http:\/\/127\.0\.0\.1/, async () => new Response('<html><body><article>' + 'secret '.repeat(200) + '</article></body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }));
  const before = w.outbound.length;
  const r = await call('POST', '/studio/source/url', { project: P, url: 'https://news.example.org/story' });
  ok(r.status >= 400, 'not read: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200));
  ok(!w.outbound.slice(before).some(o => /127\.0\.0\.1/.test(o.url)), 'no request reached the private address: ' + JSON.stringify(w.outbound.slice(before).map(o => o.url)));
});

await T.t('M5 test projects are left out of the outcome metrics unless asked for', async () => {
  const live = await project('Metrics live'); await copyAsset(live);
  const tp = await project('Metrics test', { test: true }); await copyAsset(tp);
  const m = (await call('GET', '/studio/metrics?ns=mca&days=30')).body;
  ok(m.tests && m.tests.included === false && m.tests.projects >= 1, JSON.stringify(m.tests));
  const all = (await call('GET', '/studio/metrics?ns=mca&days=30&tests=1')).body;
  eq(all.current.projects - m.current.projects, m.tests.projects, 'the difference is exactly the test projects');
  ok(/not money/.test(m.costUnit || ''), 'the unit is said: ' + m.costUnit);
});

await T.t('M6 the library tells live work from test projects; a client\'s test projects are archived in one go, each named; live work is untouched', async () => {
  const live = await project('Keep me live'); const t1 = await project('Tester run 1', { test: true }); const t2 = await project('Tester run 2', { test: true });
  const only = (await call('GET', '/studio/list?ns=mca&tests=only')).body.projects; ok(only.length >= 2 && only.every(p => p.test), JSON.stringify(only.map(p => [p.title, p.test])));
  ok((await call('GET', '/studio/list?ns=mca&tests=hide')).body.projects.every(p => !p.test));
  eq((await call('POST', '/studio/project/archive-tests', { ns: 'mca' }, 'read-key')).status, 403);
  const r = await call('POST', '/studio/project/archive-tests', { ns: 'mca' }); eq(r.status, 200, JSON.stringify(r.body));
  ok([t1, t2].every(id => r.body.archived.some(x => x.id === id)), 'both named: ' + JSON.stringify(r.body.archived));
  ok(!r.body.archived.some(x => x.id === live), 'live work untouched');
  eq((await call('GET', '/studio/list?ns=mca&tests=only')).body.projects.length, 0);
});

// last: the clock is moved to an hour where the UTC day and the Sydney day differ
await T.t('M4 an outcome is dated by the Sydney day, not the UTC day', async () => {
  const RealDate = Date; const fixed = RealDate.UTC(2026, 10, 3, 20, 0, 0);   // 20:00 UTC on 3 November = 07:00 on 4 November in Sydney
  class FakeDate extends RealDate { constructor(...a) { if (a.length) super(...a); else super(fixed); } static now() { return fixed; } }
  globalThis.Date = FakeDate;
  try {
    const P = await project('Sydney day'); const a = await copyAsset(P);
    eq((await call('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'Words are right' })).status, 200);
    const o = (await rows("SELECT doc FROM engine_outcomes WHERE surface='studio' AND ref LIKE ?", a.id + '%'))[0]; ok(o && o.doc, 'filed');
    eq((await rows('SELECT dt FROM mind_docs WHERE id=?', o.doc))[0].dt, '2026-11-04', 'the Sydney day');
  } finally { globalThis.Date = RealDate; }
});

w.restore();
T.done();
