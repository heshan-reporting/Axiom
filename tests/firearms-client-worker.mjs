/* The firearms client (Kai, 20 October 2026: "add SIFA as a client, OR Gun Clients to be all-encapsulating for SIFA and
 * Shooters Union"): namespace `guns`, two issues in the lexicon everything tags with, and the people and organisations in
 * the sentiment register. The matchers must catch Australian firearms and hunting stories and leave ordinary English
 * alone ("top gun", "job hunting", a share buyback), and the Australian gate must keep an NSW buyback story while an
 * American gun thread still has to earn its place.  Run: node --experimental-sqlite tests/firearms-client-worker.mjs */
import { execFileSync } from 'node:child_process';
import { workerEnv } from './worker-env.mjs';
const T = { pass: 0, fail: 0 };
async function t(name, fn) { try { await fn(); T.pass++; console.log('  ok   ' + name); } catch (e) { T.fail++; console.log('  FAIL ' + name + '\n       ' + String(e && e.message || e).slice(0, 600)); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
console.log('firearms-client-worker harness');
const w = await workerEnv();
const lex = (await w.call('GET', '/reddit/issues', null, 'read-key')).body;
const issue = id => (lex.issues || []).find(i => i.id === id);
const wide = id => new RegExp(issue(id).wide, 'i'), tight = id => new RegExp(issue(id).rx, 'i');

await t('the lexicon carries the firearms client: two issues under namespace guns, with search terms the Australian gate accepts', async () => {
  for (const id of ['firearms', 'hunting']) { const i = issue(id); ok(i && i.ns === 'guns' && /SIFA/.test(i.client) && /Shooters Union/.test(i.client), id + ': ' + JSON.stringify(i)); ok(i.q.length >= 4, id + ' has search terms'); }
});
await t('firearms: Australian gun-law stories are tagged, and the tight trigger fires on policy, not on any mention of a gun', async () => {
  const yes = ['NSW Premier Chris Minns says he is willing to take a political hit over the gun buyback', 'Shooters Union warns the firearms registry will cost licensed gun owners', 'Calls to update the National Firearms Agreement after Port Arthur anniversary', 'Semi-automatic rifles ban proposed for Queensland', 'SIFA says the shooting industry supports clear rules'];
  yes.forEach(s => ok(wide('firearms').test(s), 'wide misses: ' + s));
  ['gun buyback', 'firearms registry', 'gun laws', 'Shooters Union'].forEach(s => ok(tight('firearms').test(s), 'tight misses: ' + s));
  ['Top Gun sequel tops the box office', 'The big guns of the AFL return this weekend', 'Woolworths announces a $1bn share buyback', 'Coach rifled through the playbook'].forEach(s => ok(!wide('firearms').test(s), 'wide catches: ' + s));
});
await t('hunting: feral animal culls and recreational hunting are tagged; job and house hunting are not', async () => {
  ['Feral deer cull expanded across Victoria', 'Duck season opens despite protests', 'Aerial culling of brumbies resumes in Kosciuszko', 'Recreational hunting licence changes in NSW'].forEach(s => ok(wide('hunting').test(s), 'misses: ' + s));
  ['House hunting in Sydney is brutal this spring', 'Job hunting tips for graduates', 'Bargain hunters flock to Bunnings'].forEach(s => ok(!wide('hunting').test(s), 'catches: ' + s));
});
await t('the sentiment register knows SIFA, Shooters Union, the SSAA, Gun Control Australia and the buyback, on the right sides', async () => {
  const r = (await w.call('GET', '/entities/test?text=' + encodeURIComponent('Shooters Union and SIFA attacked Gun Control Australia over the gun buyback; the SSAA stayed quiet'), null, 'read-key')).body;
  const ids = (r.entities || []).map(e => e.id);
  ['shooters_union', 'sifa_org', 'gca', 't_buyback', 'ssaa'].forEach(id => ok(ids.indexOf(id) >= 0, id + ' not matched: ' + JSON.stringify(ids)));
  const all = (await w.call('GET', '/entities?q=', null, 'read-key')).body.entities || [];
  const side = id => (all.find(e => e.id === id) || {}).side;
  ok(side('sifa_org') === 'client' && side('shooters_union') === 'client' && side('gca') === 'opponent', JSON.stringify(['sifa_org', 'shooters_union', 'gca'].map(side)));
});
await t('the Australian gate (the Mac collector\'s mirror) keeps an NSW buyback thread and a Shooters Union post, and still makes an American gun thread earn its place', async () => {
  const py = "import importlib.util,json,sys\nspec=importlib.util.spec_from_file_location('rr',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nfor s in json.loads(sys.argv[2]): print(1 if m.AU_RX.search(s) else 0)";
  const cases = ['Shooters Union rally against the registry', 'National Firearms Agreement review announced', 'Brumby cull begins next month', 'Texas gun shop owners react to new rule', 'Second Amendment rally in Ohio'];
  const out = execFileSync('python3', ['-I', '-c', py, new URL('../tools/reach-reddit.py', import.meta.url).pathname, JSON.stringify(cases)]).toString().trim().split('\n');
  ok(out.join('') === '11100', 'expected 11100, got ' + out.join(''));
});
w.restore();
console.log('\n' + T.pass + ' passed, ' + T.fail + ' failed');
process.exit(T.fail ? 1 : 0);
