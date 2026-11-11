/* The monitoring desk, release 1 (prompts/annes-den.md Phase 1): the topics, outlets and actors the analyst's reports are made
 * of, against the worker module in this process. No provider is called. Each case fails on the P52 commit.
 *   LX1 gas taxation is an issue of its own: tagged, searched for and triggered apart from gas reservation
 *   LX2 gas projects named alone (a reef, a basin, a hub) are tagged without the word "gas"; a holiday park is not
 *   LX3 electrification and the gas phase-out; COP31 and data centres under energy; a data centre with no energy angle is not
 *   LX4 the firearms lexicon reaches ownership caps, the foundation and the party it missed
 *   LX5 the tight triggers: what must start the Sentinel's count and what must not (an American gas tax, a British windfall tax)
 *   LX6 the Australian gate: a search term does not vouch for a foreign thread; a term that names an Australian place does
 *   LX7 the lexicon is published with the new ids and their search terms
 *   LX8 the page's AX_ISSUES mirrors the worker's wide matchers, id for id
 *   EN1 a hyphenated surname is its own person: Hanson-Young is not Hanson; two senators Pocock are two entities
 *   EN2 the actors the reports name are in the register, on the right side for the right client
 *   SR1 the outlets, campaign sites and official sources the reports cite are in the Source Registry
 *   SR2 the Mac collector's fallback lexicon is the worker's (tools/lexicon-sync.mjs --check) and its gate carries the same markers
 * Run: node --experimental-sqlite tests/den-lexicon-worker.mjs */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 1: topics, outlets, actors');
const w = await workerEnv({});
const T = w.mod.__test;
const tag = t => T.issueTag(t);
const lex = (await w.call('GET', '/reddit/issues', null, 'read-key')).body.issues;
const rxOf = id => { const i = lex.find(x => x.id === id); if (!i) throw new Error('no issue ' + id); return new RegExp(i.rx, 'i'); };
const has = (t, id) => ok(tag(t).indexOf(id) >= 0, JSON.stringify(t) + ' should be tagged ' + id + ' (got ' + tag(t).join(',') + ')');
const hasNot = (t, id) => ok(tag(t).indexOf(id) < 0, JSON.stringify(t) + ' should NOT be tagged ' + id);
const fires = (t, id) => ok(rxOf(id).test(t), JSON.stringify(t) + ' should trigger ' + id);
const firesNot = (t, id) => ok(!rxOf(id).test(t), JSON.stringify(t) + ' should NOT trigger ' + id);
const AEP = ['gas', 'gastax', 'gasprojects', 'electrify', 'energy'];
const ents = async t => (await w.call('GET', '/entities/test?text=' + encodeURIComponent(t), null, 'read-key')).body.entities.map(e => e.id);

await S.t('LX1 gas taxation is its own issue', async () => {
  ['The Australia Institute renews its call for a windfall tax on gas companies', 'Sign the petition for a 25% gas export tax', 'Greens branch: Gas tax now! #gastax',
    '#taxthegas rally outside parliament', 'Senator says the PRRT is broken and gas exporters pay nothing', 'A super-profits tax on LNG exporters would fund public services',
    'Gas giants should pay their fair share, crossbench says', 'Reform of the petroleum resource rent tax is back on the table'].forEach(t => has(t, 'gastax'));
  const i = lex.find(x => x.id === 'gastax'); eq(i.ns, 'aep'); ok(i.q.length >= 4 && i.q.some(q => /export tax/.test(q)), 'search terms for the keyword pass');
  hasNot('Gas reservation scheme will keep 15 per cent of supply at home', 'gastax');
  hasNot('Senate committee reports on the Domestic Gas Reservation Bill', 'gastax');
});

await S.t('LX2 gas projects named alone', async () => {
  ['Greenpeace escalates its Save Scott Reef campaign', 'Protesters target the Browse Basin proposal', 'Traditional owners challenge the Burrup Hub expansion',
    'Bass Strait reserves are running down faster than forecast', 'Golden Beach gas storage project wins approval', 'NOPSEMA accepts the environment plan for Otway Basin drilling',
    '#savescottreef #stopwoodside', 'Amplitude Energy starts its offshore campaign', 'Seismic blasting off King Island opposed by fishers'].forEach(t => has(t, 'gasprojects'));
  eq(lex.find(x => x.id === 'gasprojects').ns, 'aep');
  ['Golden Beach holiday park wins a tourism award', 'Browse our catalogue of spring recipes', 'Scarborough beach closed after a shark sighting', 'Barossa vintage is the best in a decade']
    .forEach(t => AEP.forEach(id => hasNot(t, id)));
});

await S.t('LX3 electrification, COP31 and data centres', async () => {
  ['Victoria to ban new gas connections from 2027', 'Rewiring Australia says electrify everything', 'Households are getting off gas faster than the network planned',
    'Environment Victoria wants gas appliances phased out', 'Heat pumps and induction cooktops beat gas on running costs'].forEach(t => has(t, 'electrify'));
  ['Australia faces COP31 scrutiny over fossil fuel exports', 'AI data centres will drive gas demand in Western Australia, report finds', 'Farmers rally against the VNI West transmission line'].forEach(t => has(t, 'energy'));
  ['Microsoft opens a new data centre in Sydney', 'The data centre market is booming, analysts say'].forEach(t => AEP.forEach(id => hasNot(t, id)));
});

await S.t('LX4 the firearms lexicon', async () => {
  ['Alannah and Madeline Foundation backs tighter limits', 'Shooters, Fishers and Farmers MP attacks the buyback', 'Ownership caps would limit licensed owners to four firearms',
    'Junior shooting permits under review', 'They call it legislated theft: gun owners rally in Tamworth'].forEach(t => has(t, 'firearms'));
  ['Farmers sue over ownership caps on firearms', 'Gun Control Australia welcomes firearm ownership limits', 'The NSW Firearms Buyback Regulations were tabled today'].forEach(t => fires(t, 'firearms'));
});

await S.t('LX5 the tight triggers', async () => {
  ['Greens push a gas export tax in the Senate', 'Australia Institute: a windfall tax on gas exporters would raise $17 billion', 'PRRT changes fall short, economists say',
    'Chalmers rules out a super-profits tax on LNG', 'Crossbench unites behind "gas tax now"'].forEach(t => fires(t, 'gastax'));
  ['California lawmakers vote to raise the gas tax by 12 cents', 'UK extends its windfall tax on North Sea oil and gas producers to 2030', 'Gas prices fall as the gas market settles',
    'Biden weighs a federal gas tax holiday', 'Labor rules out a super-profits tax on iron ore miners'].forEach(t => firesNot(t, 'gastax'));
  ['Scott Reef drilling approved by the WA regulator', 'Woodside seeks approval for its Browse project', 'NOPSEMA approves Otway Basin seismic survey'].forEach(t => fires(t, 'gasprojects'));
  ['Golden Beach holiday park wins a tourism award', 'Browse the full list of winners'].forEach(t => firesNot(t, 'gasprojects'));
  ['Victoria bans gas connections in new homes', 'A plan to phase out gas appliances by 2035'].forEach(t => fires(t, 'electrify'));
  firesNot('Gas heater recall after a safety fault', 'electrify');
  fires('COP31: Australia under pressure on fossil fuel exports', 'energy');
});

await S.t('LX6 the Australian gate', async () => {
  const au = T.auRelevant;
  eq(au('politics', 'California raises the gas tax again and drivers are furious', 'gas tax'), false, 'an American gas tax');
  eq(au('ukpolitics', 'Windfall tax on North Sea oil and gas extended to 2030, Treasury confirms', 'windfall tax gas'), false, 'a British windfall tax');
  eq(au('technology', 'Data centres are straining the grid in Virginia', 'data centres gas demand'), false);
  eq(au('energy', 'The petroleum resource rent tax has collected almost nothing from LNG exporters', 'gas export tax'), true, 'the text itself is Australian');
  eq(au('environment', 'Greenpeace says the drilling must stop', 'scott reef'), true, 'the term names an Australian place');
  eq(au('guns', 'New limits on how many firearms a person may own', 'firearm ownership cap'), false);
  eq(au('guns', 'The Alannah and Madeline Foundation wants a national register', 'gun control'), true);
});

await S.t('LX7 the lexicon is published', async () => {
  ['gastax', 'gasprojects', 'electrify'].forEach(id => { const i = lex.find(x => x.id === id); ok(i && i.ns === 'aep' && i.rx && i.wide && i.q.length >= 3, id); });
  ok(lex.find(x => x.id === 'energy').q.some(q => /cop31/i.test(q)), 'COP31 is searched for');
  ok(lex.find(x => x.id === 'firearms').q.some(q => /ownership/i.test(q)), 'ownership caps are searched for');
  eq(new Set(lex.map(x => x.id)).size, lex.length, 'issue ids are unique');
});

await S.t('LX8 the page mirrors the wide matchers', async () => {
  const html = fs.readFileSync(new URL('../docs/index.html', import.meta.url), 'utf8');
  const a = html.indexOf('const AX_ISSUES=['); ok(a > 0, 'AX_ISSUES in the page');
  const b = html.indexOf('\n];', a); const arr = new Function('return ' + html.slice(a + 'const AX_ISSUES='.length, b + 2))();
  eq(arr.map(x => x.id), lex.map(x => x.id), 'the same issues in the same order');
  lex.forEach(i => { const m = arr.find(x => x.id === i.id); eq(m.ns, i.ns, i.id + ' client'); eq(m.rx.source, i.wide, i.id + ' matcher'); ok(m.rx.flags.indexOf('i') >= 0); ok(m.label && m.q, i.id + ' label and search term'); });
});

await S.t('EN1 hyphenated and shared surnames', async () => {
  eq(await ents('Sarah Hanson-Young said the bill was a gift to the gas lobby.'), ['hansonyoung']);
  eq((await ents('Pauline Hanson and Sarah Hanson-Young clashed in the Senate.')).sort(), ['hanson', 'hansonyoung']);
  eq(await ents('Senator Hanson said no.'), ['hanson']);
  eq(await ents('Barbara Pocock questioned the consultants.'), ['bpocock']);
  eq(await ents('David Pocock spoke at the Press Club.'), ['pocock']);
  eq((await ents('David Pocock and Barbara Pocock voted together.')).sort(), ['bpocock', 'pocock']);
  eq((await ents('A Labor-Greens deal was struck with the Coalition-led committee.')).indexOf('alp') >= 0, true, 'a party before a hyphen is still the party');
});

await S.t('EN2 the actors the reports name', async () => {
  const list = (await w.call('GET', '/entities?active=1', null, 'read-key')).body.entities; const by = Object.fromEntries(list.map(e => [e.id, e]));
  const want = { shoebridge: 'David Shoebridge told the Press Club', hodginsmay: 'Steph Hodgins-May posted a video', mckim: 'Nick McKim on Instagram', steelejohn: 'Senator Jordon Steele-John',
    mryan: 'Monique Ryan MP', sandell: 'Ellen Sandell, Victorian Greens leader', vicgreens: 'the Victorian Greens', wagreens: 'the WA Greens oppose the data centres', envvic: 'Environment Victoria',
    foe: 'Friends of the Earth Melbourne', wilderness: 'The Wilderness Society', ccwa: 'the Conservation Council of WA', amcs: 'the Australian Marine Conservation Society', rewiring: 'Rewiring Australia',
    sec: 'the Smart Energy Council', beach: 'Beach Energy', amplitude: 'Amplitude Energy', origin: 'Origin Energy', amf: 'the Alannah & Madeline Foundation', sff: 'Shooters, Fishers and Farmers',
    shootingaus: 'Shooting Australia', nswfarmers: 'NSW Farmers', ajp: 'the Animal Justice Party', haines: 'Helen Haines', mckenzie: 'Bridget McKenzie', canavan: 'Matt Canavan', sloane: 'Kellie Sloane',
    catley: 'Yasmin Catley', t_gastax: 'a windfall tax on gas', t_scottreef: 'Scott Reef', t_gasres: 'the gas reservation scheme', t_cop31: 'COP31', t_owncaps: 'firearm ownership caps' };
  for (const id of Object.keys(want)) { ok(by[id], 'entity ' + id + ' is seeded'); ok((await ents(want[id] + ' today.')).indexOf(id) >= 0, id + ' is matched in ' + JSON.stringify(want[id])); }
  eq([by.amcs.side, by.amcs.ns], ['opponent', 'aep']); eq([by.envvic.side, by.envvic.ns], ['opponent', 'aep']); eq([by.amf.side, by.amf.ns], ['opponent', 'guns']); eq(by.sff.side, 'neutral');
  eq([by.t_gastax.kind, by.t_gastax.ns], ['topic', 'aep']);
  eq(await ents('The origin of the dispute is unclear and the beach was closed.'), [], 'common words are not companies');
});

await S.t('SR1 outlets, campaign sites and official sources', async () => {
  const rows = (await w.call('GET', '/sources', null, 'read-key')).body.sources; const by = Object.fromEntries(rows.map(r => [r.id, r]));
  const site = d => rows.some(r => JSON.stringify(r.urls || {}).toLowerCase().indexOf(d) >= 0);
  ['thepoint.com.au', 'nationaltribune.com.au', 'echo.net.au', 'citynews.com.au', 'region.com.au', 'theenergy.co', 'qnews.com.au', 'energymatters.com.au', 'tasmaniancountry.com',
    'pulsetasmania.com.au', 'regionriverina.com.au', 'aboutregional.com.au', 'melbournefoe.org.au', 'wilderness.org.au', 'ccwa.org.au', 'rewiringaustralia.org', 'smartenergy.org.au',
    '350.org.au', 'marineconservation.org.au', 'guncontrolaustralia.org', 'amf.org.au', 'shootersunion.com.au', 'nopsema.gov.au', 'aer.gov.au', 'epa.wa.gov.au'].forEach(d => ok(site(d), d + ' is a source'));
  eq([by.thepoint.tier, by.thepoint.juris], ['independent', 'au']); ok(by.thepoint.issues.indexOf('gastax') >= 0);
  ok(by.aph_senate_committees && by.aph_senate_committees.tier === 'official', 'Senate committees'); ok(by.nopsema.issues.indexOf('gasprojects') >= 0);
  ok(by.vic_energy_minister && by.vic_energy_minister.juris === 'vic', 'the Victorian energy minister');
  ok(by.gca_site.issues.indexOf('firearms') >= 0 && by.shootersunion_site.issues.indexOf('firearms') >= 0);
  const known = new Set(lex.map(x => x.id)); rows.forEach(r => (r.issues || []).forEach(i => ok(known.has(i), r.id + ' names an issue that exists: ' + i)));
  eq(new Set(rows.map(r => r.id)).size, rows.length, 'source ids are unique');
});

await S.t('SR2 the Mac collector carries the same gate markers', async () => {
  const sync = spawnSync(process.execPath, [fileURLToPath(new URL('../tools/lexicon-sync.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  eq(sync.status, 0, 'tools/lexicon-sync.mjs --check: ' + (sync.stderr || sync.stdout));
  const py = fs.readFileSync(new URL('../tools/reach-reddit.py', import.meta.url), 'utf8');
  ['scott reef', 'burrup', 'bass strait', 'petroleum resource rent', 'alannah', 'gun control australia'].forEach(m => {
    ok(py.toLowerCase().indexOf(m) >= 0, 'reach-reddit.py gate knows "' + m + '"');
  });
  ['scott reef', 'burrup', 'bass strait'].forEach(m => ok(/AU_QUERY_RX = re\.compile\(r'[^\n]*/.exec(py)[0].toLowerCase().indexOf(m) >= 0, 'a query naming "' + m + '" vouches in the collector too'));
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
