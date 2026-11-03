/* RC slice 1 (R3, R4): the synthetic test client is named by the worker for every key, and the test kit's seed parks free
 * projects where the journeys start. The real tools/studio-test-kit.py runs against the worker module in this process
 * (an HTTP bridge on 127.0.0.1); providers are MOCKED and no model or image call is allowed to happen.
 * Run: node --experimental-sqlite tests/studio-rc-seed-worker.mjs */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const S = suite('RC seed: the synthetic client and the parked test projects');
const w = await workerEnv({ keys: { 'full-key': { n: 'Lead', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'guest-key': { n: 'Guest', r: 'read' } } });
const srv = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await w.call(req.method, req.url, chunks.length ? Buffer.concat(chunks).toString() : null, req.headers['x-axiom-key']);
  res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(r.text);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + srv.address().port;
const kit = (...args) => new Promise(resolve => {
  const p = spawn('python3', [path.join(ROOT, 'tools', 'studio-test-kit.py'), ...args, '--worker', BASE, '--key', 'full-key'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; }); p.on('close', code => resolve({ code, out }));
});
const providerCalls = () => w.outbound.filter(o => /anthropic|generativelanguage/.test(o.url)).length;
const get = async q => (await w.call('GET', q, null, 'full-key')).body;
const byTitle = (list, re) => (list || []).find(p => re.test(p.title));

await S.t('the worker names its synthetic test clients on /studio/status, for a read key too', async () => {
  const s = (await w.call('GET', '/studio/status', null, 'read-key')).body;
  ok(Array.isArray(s.testNs), 'testNs is listed: ' + JSON.stringify(s.testNs));
  ok(s.testNs.some(t => t.ns === 'synthdemo'), 'synthdemo is a test client');
});

let first;
await S.t('seed --apply writes the kit and seven test projects, prints the build, and spends nothing', async () => {
  first = await kit('seed', '--apply');
  eq(first.code, 0, 'exit code; output: ' + first.out.slice(-600));
  ok(/worker build 2026-/.test(first.out), 'the build is printed: ' + first.out.slice(0, 200));
  ok(!/full-key/.test(first.out), 'the key is never printed');
  const l = await get('/studio/list?ns=synthdemo');
  const mine = (l.projects || []).filter(p => /^TEST - /.test(p.title));
  eq(mine.length, 7, 'seven test projects: ' + mine.map(p => p.title).join(' | '));
  ok(mine.every(p => p.test === true), 'every one is a test project');
  eq(providerCalls(), 0, 'no model or image provider was called');
});

await S.t('the status names the client by its kit after seeding', async () => {
  const s = await get('/studio/status');
  const t = s.testNs.find(x => x.ns === 'synthdemo');
  ok(/Harbourline/.test(t.name), 'named from the kit: ' + JSON.stringify(t));
});

await S.t('the kit holds uneven material and a mandatory wordmark rule on nightboat', async () => {
  const k = (await get('/brand/kit?ns=synthdemo')).kit;
  const hb = k.facts.filter(f => f.campaign === 'harbour' && f.status === 'approved').length;
  const nb = k.facts.filter(f => f.campaign === 'nightboat' && f.status === 'approved').length;
  ok(hb >= 3 * nb && nb >= 1, 'harbour holds much more than nightboat: ' + hb + ' vs ' + nb);
  ok(k.facts.some(f => f.status === 'pending' && /99/.test(f.text)), 'the pending 99 figure is there');
  const night = k.campaigns.find(c => c.id === 'nightboat');
  eq(night.logoPolicy, 'wordmark'); ok(night.markRule && night.markRule.mandatory === true && night.markRule.corner === 'br', 'rule: ' + JSON.stringify(night.markRule));
  ok(k.hasLogo, 'the logo is on file'); ok(night.hasWordmark, 'the wordmark is on file');
});

await S.t('projects are parked at Direction, Copy, Design and Review, with nothing approved', async () => {
  const l = await get('/studio/list?ns=synthdemo');
  const open = async re => get('/studio/get?id=' + byTitle(l.projects, re).id);
  const dir = await open(/parked at Direction/);
  eq(dir.directions.length, 3, 'three directions'); ok(!dir.directions.some(d => d.chosen), 'none chosen');
  eq(new Set(dir.directions.map(d => d.medium)).size, 3, 'three different media');
  const cp = await open(/parked at Copy/);
  ok(cp.directions.some(d => d.chosen), 'a direction is chosen'); eq(cp.assets.length, 2, 'two pieces');
  ok(cp.assets.every(a => { const v = a.versions.find(x => x.id === a.current); return v && v.copy && v.copy.headline; }), 'copy is written');
  const ds = await open(/parked at Design/);
  eq(ds.assets.length, 2, 'two tiles');
  const lay = a => (a.versions.find(x => x.id === a.current) || {}).layout || {};
  ok(ds.assets.every(a => lay(a).noImagery === true), 'laid out on a solid ground (nothing to render first)');
  const blk = ds.assets.map(lay).find(L => { const h = (L.layers || []).find(x => x.role === 'headline'); const s = (L.layers || []).find(x => x.role === 'support'); return h && s && h.y === s.y; });
  ok(blk, 'one tile has its supporting line over the headline (laid out to block)');
  ok((ds.references || []).some(r => r.campaign === 'harbour'), 'a harbour reference');
  const rv = await open(/parked at Review/);
  eq(rv.campaign, 'nightboat'); ok((rv.references || []).some(r => r.campaign === 'nightboat'), 'a nightboat reference');
  for (const g of [cp, ds, rv]) ok(g.assets.every(a => !a.approvals || (!a.approvals.copy && !a.approvals.design)), 'nothing approved in ' + g.title);
  const nc = await open(/no campaign chosen/);
  eq(nc.campaign || '', '', 'the no-campaign project has none');
});

await S.t('a re-seed restores the kit and adds nothing twice', async () => {
  await w.call('POST', '/brand/kit', { ns: 'synthdemo', banned: [] }, 'full-key');
  const again = await kit('seed', '--apply');
  eq(again.code, 0, again.out.slice(-400));
  ok(/already there/.test(again.out), 'the projects are reported as already there');
  const l = await get('/studio/list?ns=synthdemo');
  eq((l.projects || []).filter(p => /^TEST - /.test(p.title)).length, 7, 'still seven');
  const dir = await get('/studio/get?id=' + byTitle(l.projects, /parked at Direction/).id);
  eq(dir.directions.length, 3, 'no directions added twice');
  eq((await get('/brand/kit?ns=synthdemo')).kit.banned.length, 1, 'the banned term is back');
});

await S.t('--tester makes a set of that tester\'s own', async () => {
  const r = await kit('seed', '--apply', '--tester', 'Ana');
  eq(r.code, 0, r.out.slice(-400));
  const l = await get('/studio/list?ns=synthdemo');
  eq((l.projects || []).filter(p => /^TEST \(Ana\) - /.test(p.title)).length, 7, 'Ana has seven of her own');
  eq((l.projects || []).filter(p => /^TEST - /.test(p.title)).length, 7, 'the shared set is untouched');
});

await S.t('a live client is refused before anything is sent, and a dry run sends nothing', async () => {
  const before = w.outbound.length; const calls0 = (await get('/studio/list?ns=mca')).projects.length;
  const r = await kit('seed', '--apply', '--ns', 'mca');
  ok(r.code !== 0 && /live client/.test(r.out), r.out);
  const dry = await kit('seed');
  eq(dry.code, 0); ok(/Nothing was sent/.test(dry.out), dry.out.slice(-200));
  eq((await get('/studio/list?ns=mca')).projects.length, calls0, 'no project in mca');
  eq(w.outbound.length, before, 'nothing outbound');
});

await S.t('S29 (PM1): the smoke check after the seed keeps the seeded client: its kit step adds its own campaign, it does not replace the kit', async () => {
  const before = (await get('/brand/kit?ns=synthdemo')).kit;
  const code = "import importlib.util,sys; s=importlib.util.spec_from_file_location('demo', sys.argv[1]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)\ntry:\n  m.ensure_synth(sys.argv[2], 'full-key'); print('ok')\nexcept Exception as e:\n  print('ERR', repr(e)[:400]); sys.exit(1)";
  const out = await new Promise(resolve => { const p = spawn('python3', ['-c', code, path.join(ROOT, 'tools', 'studio-demo.py'), BASE], { stdio: ['ignore', 'pipe', 'pipe'] }); let o = ''; p.stdout.on('data', d => { o += d; }); p.stderr.on('data', d => { o += d; }); p.on('close', c => resolve({ c, o })); });
  eq(out.c, 0, 'ensure_synth ran: ' + out.o.slice(-900));
  const after = (await get('/brand/kit?ns=synthdemo')).kit;
  const ids = (after.campaigns || []).map(c => c.id);
  ok(ids.indexOf('harbour') >= 0 && ids.indexOf('nightboat') >= 0, 'the seeded campaigns stand: ' + ids.join(','));
  ok(ids.indexOf('latesail') >= 0, 'the smoke\'s own campaign is added');
  eq((after.facts || []).filter(f => f.campaign !== 'latesail').length, (before.facts || []).length, 'the seeded facts stand');
  eq(after.logoV, before.logoV, 'the seeded logo stands');
  const night = (after.campaigns || []).find(c => c.id === 'nightboat'); ok(night && night.markRule && night.markRule.mandatory, 'the night boat mark rule stands');
  const lst = (await get('/studio/list?ns=synthdemo')).projects || [];
  for (const pr of lst.filter(x => /^TEST/.test(x.title))) { const c = await get('/studio/brief/check?project=' + pr.id); ok(!(c.gaps || []).some(g => g.code === 'campaign_unknown'), pr.title + ': no unknown campaign'); }
});

srv.close(); w.restore();
const r = S.done(); process.exit(r.fail ? 1 : 0);
