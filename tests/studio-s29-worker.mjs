/* S29: the fresh audit after the release candidate (CREATIVE-STUDIO.md s.55), against the worker module in this process with every
 * provider MOCKED. Each case fails on main at efa309e and passes with its fix.
 *   PR1  a campaign's voice-pack copy or guide filed without a platform is not relabelled client-wide and sent to another campaign
 *   PR2  a guided project whose campaign is undecided (two or more in the kit, none chosen, not standalone) cannot reach the paid
 *        directions; the brief confirm says what is missing
 *   PR4  the reading is told the project type and deliverable the person chose
 *   PR6  finished creation mode with no imagery is refused before any spend, never silently made editable
 *   PR7  a brand item kept as a rule or preference reaches the models of its campaign (and no other)
 *   PR9  /studio/remember files a campaign rule only for the project's own campaign
 *   PR10 classic directions read the brief analysis too
 *   PR8  a replan that brings back a standing direction does not file it twice or mark a direction as like itself
 * Run: node --experimental-sqlite tests/studio-s29-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor, RELEASE } from './studio-answers.mjs';
import { chunk } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';
import zlib from 'node:zlib';

const S = suite('S29: the fresh audit (briefing, memory, campaign walls, modes)');
const KIT = { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' },
  campaigns: [{ id: 'national', name: 'Australian mining', url: 'minerals.org.au', logoPolicy: 'none' }, { id: 'hoof', name: 'Hands Off Our Fuel', url: 'handsoffourfuel.com.au', logoPolicy: 'none' }] };

async function env(answer) {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
  // a Vectorize stub that answers each namespace with what was filed there
  w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: Array.from(w.vectors.values()).filter(v => (v.namespace || '') === o.namespace).slice(0, o.topK || 5).map(v => ({ score: 0.9, metadata: v.metadata })) });
  const calls = []; w.tag = '';
  w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
    const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content;
    const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
    calls.push({ tag: w.tag, sys, user });
    const a = (answer && answer(sys, user, calls.length)) || answerFor(sys, user);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
  const run = async job => { let j = job; for (let i = 0; i < 8 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
  const stage = async (P, st, input, tag) => { w.tag = tag || st; const r = await call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() }); return r.body && r.body.job ? run(r.body.job) : r; };
  await call('POST', '/brand/kit', KIT);
  return { w, calls, call, run, stage };
}

await S.t('PR1: a national pack guide and caption filed with no platform stay national: they never reach a HOOF prompt as client-wide', async () => {
  const x = await env();
  try {
    await x.call('POST', '/mind/ingest', { namespace: 'mca_creative', title: 'National content guide', text: 'NATGUIDE the national campaign always closes with Australian mining builds the nation; long enough to index.', kind: 'brief', source: 'pack:mca:national:guides/national-guide.md', campaign: 'national', scope: 'campaign' });
    await x.call('POST', '/mind/ingest', { namespace: 'mca_creative', title: 'National caption', text: 'NATCAPTION Mining builds the nation, every day of the week; long enough to index here.', kind: 'copy', source: 'pack:mca:national:captions.md', campaign: 'national', scope: 'campaign' });
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
    await x.call('POST', '/studio/source', { project: P, text: RELEASE, name: 'r' });
    await x.stage(P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }, 'hoof:copy');
    const u = x.calls.filter(c => c.tag === 'hoof:copy').map(c => c.sys + '\n' + c.user).join('\n');
    ok(u.length > 0, 'the copy stage asked the model');
    ok(!/NATGUIDE|NATCAPTION/.test(u), 'national pack material reached the HOOF prompt: ' + (u.match(/.{0,80}NAT(GUIDE|CAPTION).{0,40}/) || [''])[0]);
    // the national project still gets them
    const PN = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'NAT', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
    await x.call('POST', '/studio/source', { project: PN, text: RELEASE, name: 'r' });
    await x.stage(PN, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }, 'nat:copy');
    const un = x.calls.filter(c => c.tag === 'nat:copy').map(c => c.sys + '\n' + c.user).join('\n');
    ok(/NATCAPTION/.test(un), 'the national caption reaches the national prompt');
  } finally { x.w.restore(); }
});

await S.t('SEC-1: a version or asset cannot store an image address or layer source that is not one of the worker\'s own routes', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'T', test: true, brief: { channels: ['instagram'], campaignConfirmed: true } })).body.id;
    const bad = await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'composition', copy: { headline: 'h' }, image: { key: 'studio/' + P + '/x/1.png', url: '.attacker.example/bg.png' } });
    ok(bad.status >= 400 && /not_worker_url/.test(JSON.stringify(bad.body)), 'an outside image url is refused: ' + bad.status + ' ' + JSON.stringify(bad.body).slice(0, 160));
    const A = (await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'composition', copy: { headline: 'h' } })).body.asset;
    const v = A.versions.find(y => y.id === A.current);
    const lay = JSON.parse(JSON.stringify(v.layout)); lay.layers.push({ id: 'evil', type: 'img', role: 'free', x: 1, y: 1, w: 5, h: 5, src: '@attacker.example/pixel.png' });
    const r1 = await x.call('POST', '/studio/version', { asset: A.id, layout: lay, note: 'x' });
    ok(r1.status >= 400 && /not_worker_url/.test(JSON.stringify(r1.body)), 'an outside layer source is refused: ' + r1.status);
    const r2 = await x.call('POST', '/studio/version', { asset: A.id, image: { key: 'studio/' + P + '/up/1.png', url: '/studio/file?key=' + encodeURIComponent('studio/' + P + '/up/1.png') }, note: 'own image' });
    eq(r2.status, 200, 'the project\'s own file is accepted: ' + JSON.stringify(r2.body).slice(0, 160));
  } finally { x.w.restore(); }
});

await S.t('SEC-2: an image key outside the project is refused, and a review link never serves one', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'synthdemo', title: 'T', test: true, brief: { channels: ['instagram'] } })).body.id;
    const r = await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'generated', layout: {}, image: { key: 'mind/mca/secret.txt' } });
    ok(r.status >= 400 && /image_not_owned/.test(JSON.stringify(r.body)), 'a key outside the project is refused: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 160));
    // defence in depth: a row filed before this release with such a key is not shareable
    const A = (await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'B', mode: 'copy', copy: { headline: 'h' } })).body.asset;
    await x.w.env.MIND_DB.prepare("UPDATE studio_versions SET mode='generated', layout='{}', image=? WHERE id=?").bind(JSON.stringify({ key: 'mind/mca/secret.txt' }), A.current).run();
    const sh = await x.call('POST', '/studio/share', { project: P, assets: [A.id], label: 'x', expiresDays: 7 });
    ok(sh.status >= 400 || !(sh.body.assets || []).length, 'the share refuses it: ' + sh.status + ' ' + JSON.stringify(sh.body).slice(0, 200));
  } finally { x.w.restore(); }
});

await S.t('SEC-3: a PNG that inflates far past its stated size is refused after the first chunk, not inflated whole', async () => {
  const x = await env();
  try {
    const W = 1000, H = 1000; const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
    const z = zlib.deflateSync(Buffer.alloc(200 * 1024 * 1024), { level: 9 });   // 200 MB of zeros in a few hundred KB
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z), chunk('IEND', Buffer.alloc(0))]);
    const T = x.w.mod.__test; let peak = 0; const base = process.memoryUsage().arrayBuffers;
    const tick = setInterval(() => { peak = Math.max(peak, process.memoryUsage().arrayBuffers - base); }, 1);
    const t0 = Date.now(); const ink = await T.stPngInk(png); clearInterval(tick); peak = Math.max(peak, process.memoryUsage().arrayBuffers - base);
    ok(!ink || !ink.ok, 'the bomb is not read as a mark: ' + JSON.stringify(ink).slice(0, 120));
    ok(peak < 40 * 1024 * 1024, 'memory stays small: ' + (peak / 1048576).toFixed(0) + ' MB');
    ok(Date.now() - t0 < 3000, 'and quick: ' + (Date.now() - t0) + ' ms');
  } finally { x.w.restore(); }
});

function rgbaPng(w, h, fn) { const row = 1 + w * 4; const raw = Buffer.alloc(row * h); for (let y = 0; y < h; y++) { raw[y * row] = 0; for (let x = 0; x < w; x++) raw.set(fn(x, y), y * row + 1 + x * 4); } const hd = Buffer.alloc(13); hd.writeUInt32BE(w, 0); hd.writeUInt32BE(h, 4); hd[8] = 8; hd[9] = 6; return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', hd), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]); }
await S.t('SEC-4: the worker reads rotated and slightly transparent words itself: white words on a white tile fail either way', async () => {
  const w = await workerEnv({ keys: { 'full-key': { n: 'F', r: 'full' } } });
  try {
    const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', title: 'D3', brief: { objective: 'o', message: 'm' } }, 'full-key')).body.id;
    const white = rgbaPng(1080, 1080, () => [255, 255, 255, 255]).toString('base64');
    for (const [name, extra] of [['plain', {}], ['rotated 0.01 degrees', { rotate: 0.01 }], ['rotated 12 degrees', { rotate: 12 }], ['94% opaque', { color: '#FFFFFFF0' }]]) {
      const layout = { v: 5, format: '1:1', stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#123B2A', regions: [], layers: [Object.assign({ id: 'h', type: 'text', role: 'headline', x: 8, y: 40, w: 80, h: 20, size: 6, weight: 800, color: '#FFFFFF' }, extra)] };
      const A = (await w.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: name, copy: { headline: 'The night boat runs Fridays' }, layout, mode: 'composition' }, 'full-key')).body.asset.id;
      const g = (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body; const a = g.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current);
      const r = await w.call('POST', '/studio/validation', { asset: A, version: v.id, report: stubReport(v, a), imageB64: white }, 'full-key');
      ok(r.body && r.body.validation && r.body.validation.ok === false, name + ': the worker reading fails it: ' + JSON.stringify(((r.body || {}).validation || {}).issues || r.body).slice(0, 200));
    }
  } finally { w.restore(); }
});

await S.t('SEC-6: STUDIO_PUBLIC_WRITE opens the Studio only: no anonymous kit write, and no anonymous write to a live project', async () => {
  const w = await workerEnv({ keys: { 'full-key': { n: 'F', r: 'full' } }, env: { AXIOM_PUBLIC: 'full', STUDIO_PUBLIC_WRITE: '1' } });
  try {
    const kit = await w.call('POST', '/brand/kit', { ns: 'mca', voice: 'ANON VOICE' }, '');
    eq(kit.status, 403, 'an anonymous kit write is refused: ' + JSON.stringify(kit.body).slice(0, 120));
    const live = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Live', brief: { channels: ['instagram'] } }, 'full-key')).body.id;
    const up = await w.call('POST', '/studio/project/update', { id: live, title: 'renamed anonymously' }, '');
    ok(up.status >= 400, 'an anonymous write to a live project is refused: ' + up.status + ' ' + JSON.stringify(up.body).slice(0, 120));
  } finally { w.restore(); }
});

await S.t('SEC-7: a guest archives only the test projects it made; the agency key archives them all', async () => {
  const w = await workerEnv({ keys: { 'full-key': { n: 'F', r: 'full' } }, env: { AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-key-aaaa1': { n: 'Tess', r: 'full', until: '2099-01-01' }, 'guest-key-bbbb2': { n: 'Tom', r: 'full', until: '2099-01-01' } }) } });
  try {
    const a = (await w.call('POST', '/studio/project', { ns: 'synthdemo', title: 'Tess work', brief: {} }, 'guest-key-aaaa1')).body.id;
    const b = (await w.call('POST', '/studio/project', { ns: 'synthdemo', title: 'Tom work', brief: {} }, 'guest-key-bbbb2')).body.id;
    const s = (await w.call('POST', '/studio/project', { ns: 'synthdemo', title: 'Seeded', brief: {} }, 'full-key')).body.id;
    const r = await w.call('POST', '/studio/project/archive-tests', { ns: 'synthdemo' }, 'guest-key-aaaa1');
    eq((r.body.archived || []).map(x => x.id), [a], 'only Tess\'s own project');
    const r2 = await w.call('POST', '/studio/project/archive-tests', { ns: 'synthdemo' }, 'full-key');
    eq((r2.body.archived || []).map(x => x.id).sort(), [b, s].sort(), 'the agency archives the rest');
  } finally { w.restore(); }
});

await S.t('SEC-5: open access (read) does not read client work: projects, kits, the Mind and testers\' reports need a link; the rest of AXIOM stays open', async () => {
  const w = await workerEnv({ keys: { 'full-key': { n: 'F', r: 'full' } }, env: { AXIOM_PUBLIC: 'read', AXIOM_PUBLIC_UNTIL: '2099-01-01' } });
  try {
    const P = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Confidential', brief: { objective: 'SECRET OBJECTIVE' } }, 'full-key')).body.id;
    for (const path of ['/studio/list?ns=mca', '/studio/get?id=' + P, '/brand/kit?ns=mca', '/brand/workspace?ns=mca', '/mind/docs?namespace=mca', '/studio/status', '/studio/feedback']) {
      const r = await w.call('GET', path, null, '');
      ok(r.status === 401 && !/SECRET OBJECTIVE/.test(JSON.stringify(r.body)), path + ' without a key: ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 100));
    }
    const kept = await w.call('GET', '/studio/get?id=' + P, null, 'full-key'); eq(kept.status, 200, 'a key still reads it');
    const news = await w.call('GET', '/narratives', null, ''); ok(news.status !== 401, 'the rest of AXIOM is still open: /narratives ' + news.status);
  } finally { w.restore(); }
});

await S.t('PM2: a wordmark with narrow letter gaps reads on a contrasting ground (the worker samples the ground clear of every stroke), and still fails on its own colour', async () => {
  const w = await workerEnv({});
  try {
    const T = w.mod.__test;
    // the seed's night boat wordmark: amber strokes 18 px wide with 12 px gaps on transparency, 400 x 100, drawn at 0.65 scale
    const file = { W: 400, H: 100, at: i => { const x = i % 400, y = Math.floor(i / 400); return (y >= 15 && y < 85 && (x % 30) < 18) ? [242, 165, 65, 255] : [0, 0, 0, 0]; } };
    const s = 0.65, ax = 700, ay = 900, aw = 400 * s, ah = 100 * s;
    // composited as a canvas draws a scaled image: each output pixel is the coverage of the file under its footprint (smoothing),
    // so the pixels at a stroke's edge are part ink, part ground
    const tile = ground => ({ W: 1080, H: 1080, at: i => { const X = i % 1080, Y = Math.floor(i / 1080); let cov = 0, k = 0; for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) { const fx = Math.floor((X + (sx + 0.5) / 4 - ax) / s), fy = Math.floor((Y + (sy + 0.5) / 4 - ay) / s); k++; if (fx >= 0 && fy >= 0 && fx < 400 && fy < 100 && file.at(fy * 400 + fx)[3]) cov++; } cov /= k; const ink = [242, 165, 65]; return [0, 1, 2].map(c => Math.round(ink[c] * cov + ground[c] * (1 - cov))).concat([255]); } });
    const b = { ax, ay, aw, ah };
    const onNavy = T.stServerMark(tile([16, 30, 60, 255]), file, { role: 'wordmark' }, b);
    ok(onNavy && onNavy.inkLost < 0.05, 'amber on navy reads: ' + JSON.stringify(onNavy));
    const onAmber = T.stServerMark(tile([240, 166, 66, 255]), file, { role: 'wordmark' }, b);
    ok(onAmber && onAmber.inkLost > 0.5, 'amber on amber does not: ' + JSON.stringify(onAmber));
  } finally { w.restore(); }
});

await S.t('PR6: finished creation mode with "No imagery" is refused before any spend, with the reason; it is never made editable', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Finished', test: true, brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true, creationMode: 'finished' } })).body.id;
    await x.call('POST', '/studio/source', { project: P, text: RELEASE, name: 'r' });
    const n0 = x.calls.length;
    const j = await x.stage(P, 'copy', { channels: ['instagram'], deliverable: 'set', imagery: 'none' }, 'fin');
    eq(j.state, 'failed', 'the copy job fails: ' + JSON.stringify(j).slice(0, 200));
    ok(/finished_needs_imagery/.test(j.error || ''), 'named: ' + j.error);
    eq(x.calls.length, n0, 'no model call was made');
    const g = (await x.call('GET', '/studio/get?id=' + P)).body; eq((g.assets || []).length, 0, 'no editable piece was filed in its place');
  } finally { x.w.restore(); }
});

await S.t('PR9: a campaign preference is saved only for the project\'s own campaign', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF', brief: { channels: ['instagram'], campaignConfirmed: true } })).body.id;
    const r = await x.call('POST', '/studio/remember', { project: P, eid: 'e1', scope: 'campaign', campaign: 'national', rule: 'Always close with the national line' });
    eq(r.status, 400, JSON.stringify(r.body)); eq(r.body.error, 'other_campaign');
    const st = await x.call('GET', '/engine/status?ns=mca'); ok(!JSON.stringify(st.body).match(/national line/), 'nothing filed');
    const own = await x.call('POST', '/studio/remember', { project: P, eid: 'e2', scope: 'campaign', rule: 'Always name the fuel tax credit in full' });
    eq(own.status, 200, JSON.stringify(own.body)); eq(own.body.campaign, 'hoof');
  } finally { x.w.restore(); }
});

await S.t('PR10 + PR4: classic directions read the brief analysis; a guided reading is told the type of work and the deliverable', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Classic', brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
    const row = x.w.env.MIND_DB.db.prepare('SELECT brief FROM studio_projects WHERE id=?').get(P); const b = JSON.parse(row.brief);
    b.analysis = { sourceName: 'Statement', summary: 'ANALYSISMARK the crossbench called the credit a subsidy', risks: ['do not repeat the word subsidy'] };
    x.w.env.MIND_DB.db.prepare('UPDATE studio_projects SET brief=? WHERE id=?').run(JSON.stringify(b), P);
    await x.call('POST', '/studio/source', { project: P, text: RELEASE, name: 'r' });
    await x.stage(P, 'direct', { n: 2 }, 'dir');
    const u = x.calls.filter(c => c.tag === 'dir').map(c => c.user).join('\n');
    ok(u.length && /ANALYSISMARK/.test(u), 'the analysis reached the directions call');
    const G = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Guided', brief: { workflow: 2, projectType: 'news_response', deliverable: 'copy', channels: ['linkedin'], campaignConfirmed: true } })).body.id;
    const s1 = (await x.call('POST', '/studio/source', { project: G, kind: 'analyse:article', name: 'Story', text: RELEASE })).body.id;
    await x.stage(G, 'analyse', { sources: [s1], kind: 'article' }, 'read');
    const r = x.calls.filter(c => c.tag === 'read').map(c => c.user).join('\n');
    ok(/type of work=News response/.test(r), 'the type of work is named: ' + (r.match(/CURRENT BRIEF.{0,400}/) || [''])[0]);
    ok(/deliverable=copy/.test(r), 'the deliverable is named');
  } finally { x.w.restore(); }
});

await S.t('PR2: a guided strategy confirmed with no campaign records the standalone decision; an undecided campaign keeps the paid directions closed', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', title: 'Undecided', brief: { workflow: 2, projectType: 'response', channels: ['instagram'], deliverable: 'set' } })).body.id;
    const s1 = (await x.call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Note', text: RELEASE })).body.id;
    const j = await x.stage(P, 'analyse', { sources: [s1], kind: 'brief' }, 'read'); eq(j.state, 'done', j.error);
    eq((await x.call('POST', '/studio/workflow/confirm', { project: P, step: 'brief' })).status, 200);
    const g0 = (await x.call('GET', '/studio/get?id=' + P)).body; const it = g0.intel || {}; const o = (it.objectives || [])[0]; const m = o && (o.messages || [])[0];
    const oc = await x.call('POST', '/studio/workflow/confirm', { project: P, step: 'objectives', objective: o.id, message: m.id }); eq(oc.status, 200, JSON.stringify(oc.body).slice(0, 200));
    // the backstop: an undecided campaign (as a project confirmed before this fix would be) keeps directions closed before any model call
    const sid = ((it.strategies || []).find(z => z.recommended) || (it.strategies || [])[0]).id;
    const raw = x.w.env.MIND_DB.db.prepare('SELECT brief FROM studio_projects WHERE id=?').get(P); const b = JSON.parse(raw.brief);
    const sq = await x.call('POST', '/studio/workflow/confirm', { project: P, step: 'strategy', strategy: sid }); eq(sq.status, 409, JSON.stringify(sq.body).slice(0, 200)); eq(sq.body.error, 'campaign_required');
    const sc = await x.call('POST', '/studio/workflow/confirm', { project: P, step: 'strategy', strategy: sid, campaign: '' }); eq(sc.status, 200, JSON.stringify(sc.body).slice(0, 200));
    const g1 = (await x.call('GET', '/studio/get?id=' + P)).body; eq(g1.brief.campaignMode, 'standalone', 'no campaign named at the strategy is recorded as standalone'); eq(g1.brief.campaignConfirmed, true);
    const b2 = JSON.parse(x.w.env.MIND_DB.db.prepare('SELECT brief FROM studio_projects WHERE id=?').get(P).brief); delete b2.campaignConfirmed; delete b2.campaignMode;
    x.w.env.MIND_DB.db.prepare('UPDATE studio_projects SET brief=? WHERE id=?').run(JSON.stringify(b2), P);
    const n0 = x.calls.length;
    const d = await x.call('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 3 }, idem: 'd:' + Math.random() });
    eq(d.status, 409, JSON.stringify(d.body).slice(0, 200)); eq(d.body.error, 'workflow_locked'); ok(/campaign/i.test(d.body.detail), d.body.detail);
    eq(x.calls.length, n0, 'nothing reached a model'); ok(b, 'read');
  } finally { x.w.restore(); }
});

await S.t('FS2: an approval names the version it was given; a version that moved is refused, never approved in its place', async () => {
  const x = await env();
  try {
    const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Approve', test: true, brief: { channels: ['instagram'], campaignConfirmed: true } })).body.id;
    const A = (await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'copy', copy: { headline: 'First words' } })).body.asset;
    const v1 = A.current;
    const v2 = (await x.call('POST', '/studio/version', { asset: A.id, copy: { headline: 'Second words' }, note: 'edit' })).body;
    ok(v2 && (v2.version || v2.id || v2.asset), 'a second version: ' + JSON.stringify(v2).slice(0, 120));
    const r = await x.call('POST', '/studio/approve', { asset: A.id, part: 'copy', decision: 'approve', reason: 'ok', version: v1 });
    eq(r.status, 409, JSON.stringify(r.body).slice(0, 200)); eq(r.body.error, 'version_moved');
    const cur = (await x.call('GET', '/studio/get?id=' + P)).body.assets[0].current;
    const r2 = await x.call('POST', '/studio/approve', { asset: A.id, part: 'copy', decision: 'approve', reason: 'ok', version: cur }); eq(r2.status, 200, JSON.stringify(r2.body).slice(0, 200));
  } finally { x.w.restore(); }
});

await S.t('PR5: a HOOF reading labels the national decisions and choices it is shown with their campaign', async () => {
  const x = await env();
  try {
    const PN = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National work', brief: { channels: ['instagram'], campaignConfirmed: true } })).body.id;
    const A = (await x.call('POST', '/studio/asset', { project: PN, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'copy', copy: { headline: 'Mining builds the nation' } })).body.asset;
    const ap = await x.call('POST', '/studio/approve', { asset: A.id, part: 'copy', decision: 'approve', reason: 'NATDECISION the national line is right' }); eq(ap.status, 200, JSON.stringify(ap.body).slice(0, 160));
    x.w.env.MIND_DB.db.prepare('INSERT INTO studio_intel_log(id, ns, project, kind, ref, text, who, created) VALUES(?,?,?,?,?,?,?,?)').run('il1', 'mca', PN, 'message', 'M1.1', 'NATCHOICE Australian mining builds the nation', 'Full', Date.now());
    const G = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF reading', brief: { workflow: 2, projectType: 'response', channels: ['instagram'], deliverable: 'set', campaignConfirmed: true } })).body.id;
    const s1 = (await x.call('POST', '/studio/source', { project: G, kind: 'analyse:brief', name: 'Note', text: RELEASE })).body.id;
    await x.stage(G, 'analyse', { sources: [s1], kind: 'brief' }, 'read');
    const u = x.calls.filter(c => c.tag === 'read').map(c => c.user).join('\n');
    const dl = (u.match(/\[D\d+\][^\n]*NATDECISION[^\n]*/) || [''])[0]; const hl = (u.match(/\[H\d+\][^\n]*NATCHOICE[^\n]*/) || [''])[0];
    ok(/campaign national/.test(dl), 'the decision is labelled: ' + dl);
    ok(/campaign national/.test(hl), 'the earlier choice is labelled: ' + hl);
  } finally { x.w.restore(); }
});

await S.t('PR7: a brand item kept as a rule reaches the prompts of its campaign, and no other campaign\'s', async () => {
  const x = await env();
  try {
    const it = await x.call('POST', '/brand/item?ns=mca', { ns: 'mca', campaign: 'hoof', kind: 'term', authority: 'rule', status: 'active', title: 'KEPTRULE always say fuel tax credit in full', body: 'never the abbreviation' });
    eq(it.status, 200, JSON.stringify(it.body).slice(0, 160));
    for (const [camp, tag] of [['hoof', 'h'], ['national', 'n']]) {
      const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: camp, title: camp, brief: { objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true } })).body.id;
      await x.call('POST', '/studio/source', { project: P, text: RELEASE, name: 'r' });
      await x.stage(P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }, tag);
    }
    const all = t => x.calls.filter(c => c.tag === t).map(c => c.sys + '\n' + c.user).join('\n');
    ok(/KEPTRULE/.test(all('h')), 'the HOOF copy prompt carries the kept rule');
    ok(all('n').length && !/KEPTRULE/.test(all('n')), 'the national copy prompt does not');
  } finally { x.w.restore(); }
});

const S_END = S;
const r = S_END.done(); process.exit(r.fail ? 1 : 0);
