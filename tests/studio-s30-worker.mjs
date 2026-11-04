/* S30: the fixes after the p46 audit (CREATIVE-STUDIO.md s.56), against the worker module in this process with every provider
 * MOCKED. Each case fails on 263f043 and passes with its fix.
 *   RM-1  a Content Desk standing rule taught on a HOOF set is a HOOF rule: it never reaches a national or standalone prompt
 *   RM-2  legacy voice-pack documents (pack:<ns>[:<campaign>][:<platform>]:<file>, no campaign field) stay in their campaign
 *   RM-3  standalone work reads client-wide background only, never one campaign's guide
 *   SEC-01 a job key is the project's own: a guest cannot take the key a staff action on a live project will use
 *   SEC-02 the per-person daily cap holds for model calls made outside a job (brief suggestions, reference analysis)
 *   SEC-03 only a key that matched the roster clears the wrong-key count (never open access, never an ended key)
 *   SEC-05 a guest archives or renames only the test projects it made
 *   SEC-06 a logo, wordmark or artwork whose bytes are not an image is refused, whatever type the request declared
 *   RM-5 a truthful measurement of words with combining marks (Arabic harakat) is not refused as "too few lines"
 *   RM-6 an ordinary picture layer is never the client logo, another client's logo or another project's file in disguise
 * Run: node --experimental-sqlite tests/studio-s30-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor, RELEASE } from './studio-answers.mjs';
import { pngB64, pngForVersion } from './png.mjs';
import { stubReport } from './studio-measure-stub.mjs';

const LAYOUT = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 30, size: 6, weight: 700, color: '#FFFFFF' }] };
const S = suite('S30: the p46 audit fixed (campaign walls, guests and spend, delivery, dead ends, measurement)');
const KIT = { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain.',
  campaigns: [{ id: 'national', name: 'Australian mining', url: 'minerals.org.au', logoPolicy: 'none' }, { id: 'hoof', name: 'Hands Off Our Fuel', url: 'handsoffourfuel.com.au', logoPolicy: 'none' }],
  facts: [{ text: 'Mining paid 74 billion dollars in tax and royalties', source: 'MCA', status: 'approved' }] };

export async function s30env(opts) {
  opts = opts || {};
  const w = await workerEnv(Object.assign({ env: Object.assign({ STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' }, opts.env || {}) }, opts.keys ? { keys: opts.keys } : {}));
  w.env.MIND_VECTORS.query = async (vec, o) => ({ matches: Array.from(w.vectors.values()).filter(v => (v.namespace || '') === o.namespace).slice(0, o.topK || 5).map(v => ({ score: 0.9, metadata: v.metadata })) });
  const calls = []; w.tag = '';
  w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
    const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content;
    const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
    calls.push({ tag: w.tag, sys, user });
    let a;
    if (/You edit existing/.test(sys)) { const ns = Array.from(user.matchAll(/^\[(\d+)\] (\w+)/gm)).map(x => Number(x[1])); a = { items: ns.map(n => ({ n, body: 'Revised body ' + n, cta: '', link: '', hashtags: [] })), note: 'ok', memory: { standing: true, confidence: 0.9, rule: 'CDHOOFRULE always close HOOF posts with Hands Off Our Fuel and handsoffourfuel.com.au' } }; }
    else if (/senior copywriter of an Australian political communications agency, writing social/.test(sys)) a = { items: [{ platform: 'facebook', body: 'A post about the fuel tax credit.', cta: '', link: '', hashtags: [], alt: 'a', visual: 'v', factIds: [], note: 'n' }] };
    else a = (opts.answer && opts.answer(sys, user)) || answerFor(sys, user);
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
  const run = async (job, k) => { let j = job; for (let i = 0; i < 8 && j && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id }, k)).body.job; return j; };
  const stage = async (P, st, input, tag, k) => { w.tag = tag || st; const r = await call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() }, k); return r.body && r.body.job ? run(r.body.job, k) : r; };
  if (opts.kit !== false) await call('POST', '/brand/kit', KIT);
  const prompt = tag => calls.filter(c => c.tag === tag).map(c => c.sys + '\n' + c.user).join('\n');
  const project = async (campaign, title, extra) => (await call('POST', '/studio/project', Object.assign({ ns: 'mca', campaign, title, brief: Object.assign({ objective: 'o', message: 'm', channels: ['instagram'], campaignConfirmed: true }, campaign ? {} : { campaignMode: 'standalone' }) }, extra || {}))).body.id;
  const copyPrompt = async (campaign, tag) => { const P = await project(campaign, tag); await call('POST', '/studio/source', { project: P, text: RELEASE, name: 'r' }); await stage(P, 'copy', { channels: ['instagram'], deliverable: 'copy', render: false }, tag); return prompt(tag); };
  return { w, calls, call, run, stage, prompt, project, copyPrompt };
}

const main = process.argv[1] && process.argv[1].endsWith('studio-s30-worker.mjs');
if (main) {
  await S.t('RM-1: a standing rule taught on a HOOF Content Desk set is a HOOF rule; national and standalone prompts never carry it', async () => {
    const x = await s30env();
    try {
      await x.call('POST', '/content/generate', { ns: 'mca', campaign: 'hoof', platforms: ['facebook'], brief: 'Thank the petition signers', n: 1 });
      await x.w.settle();
      const sid = ((x.w.env.MIND_DB.db.prepare('SELECT id FROM content_sets ORDER BY created DESC LIMIT 1').get()) || {}).id;
      ok(sid, 'a content set was made');
      const rv = await x.call('POST', '/content/revise', { id: sid, n: null, instruction: 'From now on always close HOOF posts with Hands Off Our Fuel', remember: 'always' });
      eq(rv.status, 200, JSON.stringify(rv.body).slice(0, 200)); ok(rv.body.remembered, 'the rule was remembered'); eq(rv.body.remembered.campaign, 'hoof');
      ok(/CDHOOFRULE/.test(await x.copyPrompt('hoof', 'h')), 'the HOOF prompt carries it');
      ok(!/CDHOOFRULE/.test(await x.copyPrompt('national', 'n')), 'the national prompt does not');
      ok(!/CDHOOFRULE/.test(await x.copyPrompt('', 's')), 'a standalone prompt does not');
    } finally { x.w.restore(); }
  });

  await S.t('RM-1 (existing rules): a rule the Content Desk saved before this fix is scoped to its set\'s campaign when the worker starts; a set with no campaign keeps its rule client-wide', async () => {
    const x = await s30env();
    try {
      await x.call('POST', '/content/generate', { ns: 'mca', campaign: 'hoof', platforms: ['facebook'], brief: 'Thank the petition signers', n: 1 });
      await x.call('POST', '/content/generate', { ns: 'mca', campaign: '', platforms: ['facebook'], brief: 'A plain post about mining jobs', n: 1 });
      await x.w.settle();
      const sets = x.w.env.MIND_DB.db.prepare('SELECT id, campaign FROM content_sets').all();
      const hoofSet = sets.find(r => r.campaign === 'hoof'), plain = sets.find(r => !r.campaign); ok(hoofSet && plain, JSON.stringify(sets));
      const ins = x.w.env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id, ns, task, scope, rule, source, active, created) VALUES(?,?,?,?,?,?,1,?)");
      ins.run('fxold1', 'mca', 'copy', 'client', 'OLDHOOFRULE close with the HOOF line', 'content:' + hoofSet.id, Date.now());
      ins.run('fxold2', 'mca', 'copy', 'client', 'OLDPLAINRULE plain words', 'content:' + plain.id, Date.now());
      // a fresh worker instance (a new isolate after the deploy) runs the engine schema once
      const mod2 = await import(new URL('../axiomworkerv4.js', import.meta.url).href + '?s30=' + Math.random());
      await mod2.default.fetch(new Request('https://newsaus.example.workers.dev/engine/status?ns=mca', { headers: { 'X-Axiom-Key': 'full-key', 'CF-Connecting-IP': '203.0.113.9' } }), x.w.env, x.w.ctx);
      const src = id => x.w.env.MIND_DB.db.prepare('SELECT source FROM engine_fixes WHERE id=?').get(id).source;
      eq(src('fxold1'), 'content:' + hoofSet.id + ':campaign:hoof'); eq(src('fxold2'), 'content:' + plain.id, 'a set with no campaign keeps its rule client-wide');
      await mod2.default.fetch(new Request('https://newsaus.example.workers.dev/engine/status?ns=mca', { headers: { 'X-Axiom-Key': 'full-key', 'CF-Connecting-IP': '203.0.113.9' } }), x.w.env, x.w.ctx);
      eq(src('fxold1'), 'content:' + hoofSet.id + ':campaign:hoof', 'idempotent');
    } finally { x.w.restore(); }
  });

  await S.t('RM-2: legacy pack documents with no campaign field: the tag\'s campaign segment scopes them; a platform tag is client-wide; an unknown campaign is used nowhere', async () => {
    const x = await s30env();
    try {
      const ing = (title, text, kind, source) => x.call('POST', '/mind/ingest', { namespace: 'mca_creative', title, text: text + ' long enough to index here in the Mind.', kind, source });
      await ing('National captions', 'LEGACYNATCOPY Mining builds the nation every day', 'copy', 'pack:mca:national:captions.md');
      await ing('National guide', 'LEGACYNATGUIDE the national line closes every post', 'brief', 'pack:mca:national:guides/national-guide.md');
      await ing('Facebook captions', 'LEGACYFBCOPY plain words for every campaign', 'copy', 'pack:mca:facebook:fb.md');
      await ing('Retired campaign', 'LEGACYRETIRED an old campaign nobody runs now', 'copy', 'pack:mca:victoria:old.md');
      const h = await x.copyPrompt('hoof', 'h'); const n = await x.copyPrompt('national', 'n');
      ok(!/LEGACYNATCOPY|LEGACYNATGUIDE/.test(h), 'national pack copy and guide stay out of HOOF: ' + (h.match(/.{0,90}LEGACYNAT\w+/) || [''])[0]);
      ok(/LEGACYNATCOPY/.test(n), 'the national prompt has its own pack copy');
      ok(/LEGACYFBCOPY/.test(h) && /LEGACYFBCOPY/.test(n), 'platform-tagged pack copy is client-wide');
      ok(!/LEGACYRETIRED/.test(h) && !/LEGACYRETIRED/.test(n), 'a campaign the kit does not hold is used nowhere');
    } finally { x.w.restore(); }
  });

  await S.t('RM-3: standalone work reads client-wide background, never one campaign\'s guide', async () => {
    const x = await s30env();
    try {
      await x.call('POST', '/mind/ingest', { namespace: 'mca_creative', title: 'National guide', text: 'NATGUIDE quote 290,000 jobs in every national post; long enough to index.', kind: 'brief', source: 'pack:mca:national:guide.md', campaign: 'national', scope: 'campaign' });
      await x.call('POST', '/mind/ingest', { namespace: 'mca_creative', title: 'Client guide', text: 'CWGUIDE plain, factual, regional in every campaign; long enough to index.', kind: 'brief', source: 'ingest:guide.md', scope: 'client' });
      const s = await x.copyPrompt('', 's');
      ok(!/NATGUIDE/.test(s), 'the national guide is not in standalone work');
      ok(/CWGUIDE/.test(s), 'the client-wide guide is');
      ok(/NATGUIDE/.test(await x.copyPrompt('national', 'n')), 'the national project still reads its guide');
    } finally { x.w.restore(); }
  });

  const GUESTS = { 'guest-key-full': { n: 'Tester', r: 'full', until: '2099-01-01' }, 'guest-b-key1': { n: 'Tester B', r: 'full', until: '2099-01-01' } };

  await S.t('SEC-01: a guest who takes a live project\'s job keys in its own test project does not stop the staff action on the live one', async () => {
    const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: { ANTHROPIC_API_KEY: 'test', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS) } });
    try {
      const St = (m, p, b) => w.call(m, p, b, 'staff-key'), G = (m, p, b) => w.call(m, p, b, 'guest-key-full');
      const mkP = async (k, title) => { const r = await w.call('POST', '/studio/project', { ns: 'mca', title, brief: { objective: 'o' } }, k); return (r.body.project || r.body).id; };
      const LIVE = await mkP('staff-key', 'Live MCA'); const TEST = await mkP('guest-key-full', 'Guest test');
      const LA = (await St('POST', '/studio/asset', { project: LIVE, family: 'F', channel: 'facebook', format: '1:1', title: 'Live tile', copy: { headline: 'Hello' }, mode: 'composition', layout: LAYOUT })).body.asset;
      const TA = (await G('POST', '/studio/asset', { project: TEST, family: 'F', channel: 'facebook', format: '1:1', title: 'Guest tile', copy: { headline: 'Hi' }, mode: 'composition', layout: LAYOUT })).body.asset;
      w.env.MIND_DB.db.prepare("INSERT INTO studio_events(project,kind,data,who,created) VALUES(?,?,?,?,?)").run(LIVE, 'inspection', JSON.stringify({ eid: 'evinsp1', asset: LA.id, version: LA.current, round: 1, fix: { kind: 'copy', instruction: 'Shorten the headline' } }), 'studio', Date.now());
      const sq1 = await G('POST', '/studio/job', { project: TEST, asset: TA.id, stage: 'suggest', input: {}, idem: 'suggest:' + LA.id + ':' + LA.current });
      const sq2 = await G('POST', '/studio/job', { project: TEST, asset: TA.id, stage: 'echo', input: {}, idem: 'fix:evinsp1' });
      ok(sq1.status === 200 && sq2.status === 200, 'the guest\'s own jobs are made: ' + sq1.status + ' ' + sq2.status);
      const s1 = await St('POST', '/studio/suggest', { asset: LA.id, job: true });
      ok(s1.body.job, 'staff Suggest made a job: ' + JSON.stringify(s1.body).slice(0, 160)); eq(s1.body.job.project, LIVE, 'the staff job is in the live project');
      const s2 = await St('POST', '/studio/inspection/apply', { project: LIVE, eid: 'evinsp1' });
      eq(s2.status, 200, JSON.stringify(s2.body).slice(0, 200));
      const live = w.env.MIND_DB.db.prepare("SELECT stage FROM studio_jobs WHERE project=?").all(LIVE).map(r => r.stage);
      ok(live.indexOf('revise') >= 0, 'the correction was queued in the live project: ' + live.join(','));
      const again = await St('POST', '/studio/suggest', { asset: LA.id, job: true }); eq(again.body.job.id, s1.body.job.id, 'a repeat in the same project is still the same job');
      eq(again.body.job.idem, 'suggest:' + LA.id + ':' + LA.current, 'the key reads back as it was sent');
    } finally { w.restore(); }
  });

  await S.t('SEC-02: the per-person daily cap holds for model calls made outside a job, and they are counted in the person\'s usage', async () => {
    const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', AXIOM_GUEST_KEYS: JSON.stringify(GUESTS), STUDIO_GUEST_DAILY_CALLS: '2' } });
    try {
      let calls = 0;
      w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => { calls++; const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join(''); return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 }); });
      const G = (m, p, b) => w.call(m, p, b, 'guest-key-full');
      const pr = (await G('POST', '/studio/project', { ns: 'mca', title: 'Guest test', brief: { objective: 'o' } })).body; const PID = (pr.project || pr).id;
      const st = []; for (let i = 0; i < 4; i++) { const r = await G('GET', '/studio/brief/suggest?project=' + PID + '&ai=1'); st.push(r.status + ':' + JSON.stringify(r.body).slice(0, 400)); }
      ok(calls <= 2, 'at most two model calls under a cap of two (made ' + calls + ')');
      ok(/person_budget_exhausted/.test(st.slice(2).join(' ')), 'the third ask is refused with the person\'s cap: ' + st.slice(2).join(' | ').slice(0, 300));
      const ref = (await G('POST', '/studio/reference', { project: PID, name: 'R', purpose: 'mood', imageB64: pngB64(64, 64), analyse: false })).body;
      const before = calls; await G('POST', '/studio/reference/analyse', { id: ref.id });
      eq(calls, before, 'reference analysis past the cap makes no call');
      const you = (await G('GET', '/studio/budget')).body.you; ok(you && you.calls && you.calls.used >= 2, 'the person\'s usage counts the calls: ' + JSON.stringify(you));
      // staff are not held by the guest's cap
      const sp = (await w.call('POST', '/studio/project', { ns: 'mca', title: 'Live', brief: { objective: 'o' } }, 'staff-key')).body; const SP = (sp.project || sp).id;
      const b2 = calls; await w.call('GET', '/studio/brief/suggest?project=' + SP + '&ai=1', null, 'staff-key'); ok(calls > b2, 'staff still ask');
    } finally { w.restore(); }
  });

  await S.t('SEC-03: open access that has ended and an ended guest key never clear the wrong-key count; a matched key does', async () => {
    const w = await workerEnv({ env: { AXIOM_PUBLIC: 'read', AXIOM_PUBLIC_UNTIL: '2020-01-01', AXIOM_GUEST_KEYS: JSON.stringify({ 'old-guest-key-123': { n: 'Old', r: 'read', until: '2020-01-01' } }) } });
    try {
      let locked = 0;
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 6; i++) { const r = await w.call('GET', '/studio/list?ns=mca', null, 'guess-' + round + '-' + i + 'xxxxxx'); if (r.status === 429) locked++; }
        await w.call('GET', '/studio/list?ns=mca', null, null);
        await w.call('GET', '/studio/list?ns=mca', null, 'old-guest-key-123');
      }
      ok(locked > 0, 'eighteen wrong guesses lock the address out despite the keyless and ended-key requests between them (429s: ' + locked + ')');
      const v = await workerEnv({});
      try {
        for (let i = 0; i < 6; i++) await v.call('GET', '/studio/list?ns=mca', null, 'guess-' + i + 'xxxxxx');
        await v.call('GET', '/studio/list?ns=mca', null, 'full-key');
        eq(String(v.kv.get('af_203.0.113.9') || '0'), '0', 'a matched key clears the count');
      } finally { v.restore(); }
    } finally { w.restore(); }
  });

  await S.t('SEC-05: a guest archives or renames only the test projects it made; it can still work in the seeded ones', async () => {
    const w = await workerEnv({ keys: { 'staff-key': { n: 'Jo', r: 'full' } }, env: { AXIOM_GUEST_KEYS: JSON.stringify(GUESTS) } });
    try {
      const mk = async (key, title) => { const r = await w.call('POST', '/studio/project', { ns: 'synthdemo', title, brief: { objective: 'o' } }, key); return (r.body.project || r.body).id; };
      const seeded = await mk('staff-key', 'Seeded Design (agency)'); const bOwn = await mk('guest-b-key1', 'Tester B work'); const aOwn = await mk('guest-key-full', 'Tester A work');
      for (const id of [seeded, bOwn]) {
        const r = await w.call('POST', '/studio/project/archive', { id }, 'guest-key-full'); eq(r.status, 403, 'archive ' + JSON.stringify(r.body).slice(0, 120)); eq(r.body.error, 'not_your_project');
        const u = await w.call('POST', '/studio/project/update', { id, patch: { title: 'Renamed by A' } }, 'guest-key-full'); eq(u.status, 403, 'rename');
        const b = await w.call('POST', '/studio/project/update', { id, patch: { brief: { objective: 'worked on by A' } } }, 'guest-key-full'); eq(b.status, 200, 'a brief edit is work in the project: ' + JSON.stringify(b.body).slice(0, 160));
        const row = w.env.MIND_DB.db.prepare('SELECT archived, title FROM studio_projects WHERE id=?').get(id); eq(row.archived, 0); ok(!/Renamed/.test(row.title));
      }
      eq((await w.call('POST', '/studio/project/archive', { id: aOwn }, 'guest-key-full')).status, 200, 'its own project archives');
      eq((await w.call('POST', '/studio/project/archive', { id: bOwn }, 'staff-key')).status, 200, 'the agency archives any');
    } finally { w.restore(); }
  });

  await S.t('RM-6: a free picture layer cannot carry the client logo, another client\'s logo or another project\'s file; a mark layer still goes through the mark policy', async () => {
    const x = await s30env({ kit: false });
    try {
      await x.call('POST', '/brand/kit', { ns: 'mca', name: 'MCA', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark' }] });
      await x.call('POST', '/brand/kit', { ns: 'aep', name: 'AEP', campaigns: [{ id: 'gas', name: 'Gas' }] });
      const PA = (await x.call('POST', '/studio/project', { ns: 'aep', campaign: 'gas', title: 'AEP', brief: { campaignConfirmed: true } })).body.id;
      const P = (await x.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF', brief: { campaignConfirmed: true } })).body.id;
      const A = (await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'A', mode: 'composition', copy: { headline: 'h' }, layout: LAYOUT })).body.asset;
      const v = A.versions.find(y => y.id === A.current);
      const tryLayer = async l => { const L = JSON.parse(JSON.stringify(v.layout)); L.layers.push(l); return x.call('POST', '/studio/version', { asset: A.id, layout: L, note: 't' }); };
      eq((await tryLayer({ id: 'lg', type: 'img', role: 'logo', x: 80, y: 85, w: 12, h: 8, src: '/brand/logo?ns=mca' })).body.error, 'mark_policy', 'HOOF never carries the MCA logo as a mark');
      eq((await tryLayer({ id: 'im1', type: 'img', role: 'free', x: 80, y: 85, w: 12, h: 8, src: '/brand/logo?ns=mca' })).body.error, 'brand_mark_as_image', 'nor as a picture');
      eq((await tryLayer({ id: 'im2', type: 'img', role: 'free', x: 80, y: 85, w: 12, h: 8, src: '/brand/logo?ns=aep' })).body.error, 'brand_mark_as_image', 'nor another client\'s logo');
      eq((await tryLayer({ id: 'im3', type: 'img', role: 'free', x: 10, y: 10, w: 30, h: 30, src: '/studio/file?key=' + encodeURIComponent('studio/' + PA + '/a/v.png') })).body.error, 'image_not_owned', 'nor another project\'s file');
      const own = await tryLayer({ id: 'im4', type: 'img', role: 'free', x: 10, y: 10, w: 30, h: 30, src: '/studio/file?key=' + encodeURIComponent('studio/' + P + '/uploads/u.png') }); eq(own.status, 200, 'its own upload is fine: ' + JSON.stringify(own.body).slice(0, 160));
    } finally { x.w.restore(); }
  });

  await S.t('RM-5: a truthful two-line measurement of a headline with Arabic harakat is accepted (combining marks take no width)', async () => {
    const x = await s30env();
    try {
      const P = await x.project('national', 'Arabic');
      const hl = 'الْمَعَادِنُ تَبْنِي الْأُمَّةَ كُلَّ يَوْمٍ'; const hl2 = hl + ' ' + hl;   // 89 code units, 51 of them letters: the old count asked for three lines
      const L = { v: 4, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 8, y: 30, w: 84, h: 40, size: 8, weight: 700, color: '#FFFFFF' }] };
      const A = (await x.call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '1:1', title: 'Ar', mode: 'composition', copy: { headline: hl2 }, layout: L })).body.asset;
      const v = A.versions.find(y => y.id === A.current);
      const rep = stubReport(v, A); const b = rep.boxes.find(y => y.id === 'headline'); b.lines = 2; b.contentH = 2 * b.px * 1.12; b.h = b.contentH; b.overflowH = false;
      const r = await x.call('POST', '/studio/validation', { asset: A.id, version: v.id, report: rep, imageB64: pngForVersion(v, { fill: 3 }) });
      eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    } finally { x.w.restore(); }
  });

  await S.t('SEC-06: a logo, a wordmark or an artwork whose bytes are not an image is refused whatever type is declared; a real PNG is stored as PNG', async () => {
    const x = await s30env();
    try {
      const page = Buffer.from('<!doctype html><script>alert(document.domain)</script>' + ' '.repeat(80)).toString('base64');
      const lg = await x.call('POST', '/brand/kit', { ns: 'mca', logoB64: page, logoMime: 'image/png' }); ok(lg.status >= 400 && /bad_image/.test(JSON.stringify(lg.body)), 'logo: ' + JSON.stringify(lg.body).slice(0, 160));
      const wm = await x.call('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkB64: page, wordmarkMime: 'image/png' }); ok(wm.status >= 400 && /bad_image/.test(JSON.stringify(wm.body)), 'wordmark: ' + JSON.stringify(wm.body).slice(0, 160));
      const ar = await x.call('POST', '/engine/artwork', { ns: 'mca', title: 't', imageB64: page, mime: 'image/png' }); ok(ar.status >= 400 && /bad_image/.test(JSON.stringify(ar.body)), 'artwork: ' + JSON.stringify(ar.body).slice(0, 160));
      eq(Array.from(x.w.r2 ? x.w.r2.keys() : []).filter(k => /^brand\/mca\/(logo|wordmark)/.test(k)).length, 0, 'nothing stored');
      const good = await x.call('POST', '/brand/kit', { ns: 'mca', logoB64: pngB64(64, 64), logoMime: 'image/webp' }); eq(good.status, 200, JSON.stringify(good.body).slice(0, 160));
      const kit = (await x.call('GET', '/brand/kit?ns=mca')).body; eq((kit.kit || kit).logoMime, 'image/png', 'the type the bytes say');
    } finally { x.w.restore(); }
  });

  const r = S.done(); process.exit(r.fail ? 1 : 0);
}
