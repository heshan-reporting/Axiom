/* Duplicate narratives (build p69, DEN.md s.10.11), against the worker module in this process. Written first, from a census of
 * the live narratives on 16 November 2026: one story became several narratives because a row in another text form (a bare
 * headline, a forum page) scores just under the join bar, because late rows and the 48h prune re-placed rows into singletons
 * that were never candidates, because the recount wiped the entity anchor, and because nothing ever compared two narratives.
 * Every outlet, person, place and story here is invented, and the stories are neutral ones (a water authority's meter fault,
 * a pipeline, a by-election, two pledges, a forum, a riverbank sit-in), none of them a live story. No provider is contacted:
 * Workers AI is a stub with the geometry below, the Anthropic API is a counted stub, Slack answers the default stub.
 *
 * Stub embedding (100 dims). Story W's world: a story axis (weight^2 0.128), W's shared context (0.653), a text-form axis
 * (0.099: a headline-only row under 140 characters, or a body) and per-text noise (0.12, random signs on 8 of 40 dims) that
 * averages out in a centroid. So a W body row against W's frozen body centroid is about 0.93, a W headline row about 0.83
 * (a near miss under the 0.84 bar), a cluster of six W headlines against the body centroid about 0.87 (centroid cosines run
 * above row cosines), a same-actor sibling row (pipeline, by-election) about 0.80, a sibling cluster about 0.84. Probe rows
 * (a town name) sit at 0.81 to a candidate on that town's axis; the third story's two variants at 0.868 (P3); the noise
 * split's two angles at 0.80 with neutral rows at 0.89. Narratives written straight into the table carry explicit centroids,
 * so a pair's c is what the case sets.
 *
 * Cases marked (F) failed on 5fd5573 (live p68); the tests commit records the full list. Cases marked (F, review), and the
 * review's additions to P1h, M13 and A3, failed on 90078e3 (the first p69 build) for the defect each names.
 *   Prevention   P1a-P1k near-miss join on headline evidence (shadow by default, on by KV, recorded, undoable; a row past a
 *                cap waits unplaced; the evidence takes recent titles and the label), P2a-P2e a late singleton's two
 *                clocks, the window-edge set-aside, no candidacy for a would-join's singleton, one alert a story, P3a-P3b
 *                entities kept while unjudged, P4a acronym aliases take no plural, P5a-P5d the placement lease, a lease
 *                left behind, the alias sweep, the orphan repair
 *   Merge pass   M1-M19 proposals, the hard-negative shapes (and the live-blog pair at fewer rows, one MP's two press
 *                releases), an automatic merge, guards, caps, complete link across ticks, per-component decisions, the
 *                frozen centroid, the noise split, clause variants, strict, a change between scan and apply, the pairs cap
 *                over 600 narratives, look-alikes of the census shapes, a chain through an unnamed narrative, the counter
 *                pair in the compare-and-set, keep-aparts past 2,000, the stored list's true count, the list's order
 *   Undo         U1-U10, U7b, U7c column-for-column restore, rows that joined since, a person's later edit, double undo,
 *                chains, alerts, two merges in either order (a later carry of a name or pin, a survivor past 20 rows), a
 *                model rename, keep-apart, the undo breaker
 *   Routes       R1-R13 dry, pairs, apply, undo and log, the old merge route, aliases on /one and /update, reset, modes,
 *                the near log, Studio's narrative source, person_ts, a stale near undo, the day undo in chunks
 *   Den          D1-D3 a person's merge covers at filing, an automatic one is named for the person, /den/board aliases
 *   Automation   A1-A5 mode off, the default, a held tick (no model call), a busy lease, the cron path
 * Run: node --experimental-sqlite tests/narr-merge-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Duplicate narratives: prevented at placement, proposed, merged with an undo (p69)');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' }, 'kai-full-key': { n: 'Kai', r: 'full' } };
const H = 3600000, DIM = 100;

// ---------------------------------------------------------------- the stub embedding
function hsh(t) { let h = 7; for (let i = 0; i < t.length; i++) h = (Math.imul(h, 31) + t.charCodeAt(i)) >>> 0; return h; }
function noise(v, t, e2) { let h = hsh(t); const used = new Set(); const w = Math.sqrt(e2 / 8); while (used.size < 8) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const d = 60 + ((h >>> 9) % 40); if (used.has(d)) continue; used.add(d); v[d] += ((h >>> 4) & 1) ? w : -w; } }
const TOWNS = ['ashgrove', 'belmont', 'carrow', 'dunlea', 'elmira', 'fenwick', 'glenrock', 'harwood', 'ivanhoe', 'jarrah', 'kelso', 'lorne', 'mirboo', 'narre'];
function unit(v) { const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1; return v.map(x => x / n); }
function vec(text) {
  const raw = String(text), t = raw.toLowerCase(), v = new Array(DIM).fill(0);
  const w = /\bmeters?\b/.test(t) ? 0 : /pipeline/.test(t) ? 1 : /by-election/.test(t) ? 2 : /scholarship/.test(t) ? 3 : -1;
  if (w >= 0) { v[w] = Math.sqrt(0.128); v[10] = Math.sqrt(0.653); v[raw.length < 140 ? 12 : 11] = Math.sqrt(0.099); noise(v, t, 0.12); return unit(v); }
  const k = TOWNS.findIndex(x => t.indexOf(x) >= 0);
  if (k >= 0) { v[40 + k] = 0.81; v[39] = Math.sqrt(1 - 0.81 * 0.81); return v; }
  if (/glasshouse/.test(t)) { v[9] = 1; v[/variant 2/.test(t) ? 30 : 29] = 0.39; return unit(v); }
  if (/quarry/.test(t)) { v[13] = 1; const m = t.match(/angle (\d)/); if (m && m[1] !== '0') v[30 + Number(m[1])] = 0.5; return unit(v); }
  noise(v, t, 1); return unit(v);   // anything else: a direction of its own
}
const AI = { run: async (m, { text }) => ({ shape: [text.length, DIM], data: (Array.isArray(text) ? text : [text]).map(vec) }) };
const V = o => { const v = new Array(DIM).fill(0); for (const k in o) v[Number(k)] = o[k]; return unit(v); };
const b64 = v => Buffer.from(new Float32Array(v).buffer).toString('base64');
const unb64 = s => { if (!s) return null; const b = Buffer.from(s, 'base64'); return Array.from(new Float32Array(b.buffer, b.byteOffset, b.length / 4)); };
const cosv = (a, b) => { let s = 0, na = 0, nb = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? s / Math.sqrt(na * nb) : 0; };

// the worker's own tokeniser and term arithmetic, replicated for narratives written straight into the table
const STOP = new Set(('the a an and or of to in on for with at by from as is are was were be been being it its this that these those i me my you your he him his she her we us our they them their who whom what which when where why how not no nor but so if then than too very can will would should could may might must just about into over under after before also more most less least such only own same other some any all each both few many much out up down off new old said says say one two three via amp rt https http com www').split(' '));
const toks = s => String(s || '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9$%'\s-]/g, ' ').split(/\s+/).map(x => x.replace(/^['-]+|['-]+$/g, '')).filter(x => x.length > 2 && !STOP.has(x) && !/^\d+$/.test(x));
const ntext = (t, b) => (t + (b && b.indexOf(t.slice(0, 40)) < 0 ? '. ' + b : '')).slice(0, 600);
function tmap(texts) { const m = {}; texts.forEach(x => { const tv = {}; toks(x).forEach(k => { tv[k] = (tv[k] || 0) + 1; }); let n = 0; for (const k in tv) n += tv[k] * tv[k]; n = Math.sqrt(n) || 1; for (const k in tv) m[k] = (m[k] || 0) + tv[k] / n; }); const o = {}; Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 40).forEach(k => { o[k] = Math.round(m[k] * 1000) / 1000; }); return o; }
function meanv(vs) { const o = new Array(DIM).fill(0); vs.forEach(v => v.forEach((x, i) => { o[i] += x / vs.length; })); return o; }

// ---------------------------------------------------------------- story W: Corvale Water's meter fault (invented)
const LEDES = [
  ['Corvale Water chair Delia Venn apologises after meter fault overcharged 18,000 households', 'Corvale Water chair Delia Venn has apologised to 18,000 households in regional Victoria after a fault in new digital meters inflated their quarterly charges, some by more than double. Ms Venn told reporters in Marrick on Monday that the authority had let its customers down and that every overcharged account would be refunded in full. The fault was traced to a software update installed by the contractor Lumetric in August. Water Minister Tom Ashby said he expected the refunds to be paid before Christmas.'],
  ['Meter software fault: Corvale Water to refund overcharged Marrick customers', 'Corvale Water will refund customers in Marrick and surrounding towns in regional Victoria after admitting a meter software fault overcharged thousands of homes. The authority said readings from its new digital meters had been multiplied by a faulty conversion factor since August. Chair Delia Venn said a dedicated hotline would open on Tuesday and that no customer would be chased for unpaid amounts while the refunds were processed. Consumer advocates said the authority should also pay interest on the money it took.'],
  ['Ombudsman opens inquiry into Corvale Water meter readings', 'The state ombudsman has opened an inquiry into Corvale Water after a meter reading fault left 18,000 households in regional Victoria with inflated accounts. Ombudsman Priya Halden said her office had received more than 600 complaints in a week, many from pensioners and families who had paid the higher amounts without question. The inquiry will examine why the authority did not catch the error and whether customers were given accurate information when they called the hotline.'],
  ['Corvale Water admits faulty meter upgrade doubled some household charges', 'Corvale Water has admitted that a faulty upgrade to its digital meters doubled the charges of some households in regional Victoria, after weeks of insisting the readings were accurate. In a statement the authority said a conversion error in the meter software had affected accounts issued since August. Chair Delia Venn said the authority was wrong to dismiss early complaints. Opposition water spokesman Sam Reiter said the admission had come too late for families who had already paid.'],
  ['Marrick families hit with inflated water charges after meter glitch', 'Families in Marrick say they were stunned to receive water accounts two and three times higher than usual after a meter glitch at Corvale Water. Local mother of three Jess Okafor said her account jumped from $290 to $810 with no explanation. Corvale Water, which supplies towns across regional Victoria, has since admitted the fault and promised refunds. Residents said they wanted to know how long the authority had known about the problem before it told customers.'],
  ['Delia Venn: we got the meter readings wrong and we are sorry', 'Corvale Water chair Delia Venn has fronted a packed community meeting in Marrick to apologise for the meter fault that overcharged households across regional Victoria. Ms Venn told about 300 residents that the authority got the readings wrong and was sorry. She said refunds would be credited automatically and that customers who had paid by direct debit would be repaid first. Several residents called for her resignation, and the meeting ended with questions about the contractor that installed the meters.'],
  ['Corvale Water refunds to take three months, chair says', 'Refunds for households overcharged by faulty Corvale Water meters will take up to three months to process, chair Delia Venn has said. The authority, which serves Marrick and other towns in regional Victoria, has identified 18,000 affected accounts. Ms Venn said staff were checking each account by hand because the meter data could not be trusted. Water Minister Tom Ashby said three months was too long and asked the board to find a faster way to repay customers.'],
  ['Customers queue at Marrick office as meter fault refunds begin', 'Dozens of customers queued outside the Corvale Water office in Marrick on Wednesday as the authority began paying refunds to households overcharged by a meter fault. Retiree Alan Briggs said he had waited two hours to get back the $420 he overpaid. The authority, which supplies water across regional Victoria, said most refunds would be paid automatically and urged customers not to travel to the office. Chair Delia Venn said extra staff had been brought in from other towns.'],
  ['Corvale Water board under pressure over meter contractor', 'The board of Corvale Water is under pressure to explain why it awarded the contract for its new digital meters to Lumetric, the firm whose software update caused thousands of households in regional Victoria to be overcharged. Documents show the board approved the contract despite a consultant warning about testing. Chair Delia Venn said the board had acted on advice. Water Minister Tom Ashby said he would wait for the ombudsman findings before deciding whether to intervene.'],
  ['Pensioners among hardest hit by Corvale Water meter overcharging', 'Pensioners in regional Victoria are among the hardest hit by the Corvale Water meter overcharging, welfare groups say, with some paying inflated accounts from their savings. The Marrick community centre said it had helped more than 80 older residents dispute their accounts. Corvale Water chair Delia Venn said pensioners would be first in line for refunds. Advocates said the authority should waive the next quarter of charges for anyone on a concession card.'],
  ['Corvale Water meter fault traced to botched software update', 'A botched software update to the Corvale Water digital meters has been identified as the cause of the overcharging that hit 18,000 households in regional Victoria. An internal review found the update, installed by the contractor Lumetric in August, applied the wrong conversion factor to every reading. Chair Delia Venn said the authority had suspended further work by the contractor. Lumetric said in a statement that it was cooperating with the review and regretted the error.'],
  ['Venn rules out resigning over Corvale Water meter bungle', 'Corvale Water chair Delia Venn has ruled out resigning over the meter bungle that overcharged thousands of households in regional Victoria, saying her job was to fix the problem. Ms Venn said she had the support of the board and of Water Minister Tom Ashby. Opposition water spokesman Sam Reiter said the chair should go and that the minister was protecting her. The ombudsman inquiry into the overcharging is expected to report early next year.'],
];
// headline-only rows of W, as an overseas outlet writes them (no names) and as a local one does (named)
const GEN = [
  'Water authority apologises after faulty meters overcharged households in regional Victoria',
  'Faulty water meters overcharged thousands of households in regional Victoria',
  'Regional Victoria water authority to refund customers after meter software fault',
  'Regional Victoria households overcharged after water meter fault, authority admits',
  'Ombudsman inquiry into water meter overcharging in regional Victoria',
  'Water meter glitch: refunds promised to overcharged households in regional Victoria',
];
const GEN_WEAK = 'Thousands affected as regional Victoria utility error emerges at the meters';
const NAMED = [
  'Corvale Water sorry for meter fault that overcharged Marrick households',
  'Marrick customers overcharged as Corvale Water meters fail in regional Victoria',
  'Delia Venn promises Corvale Water meter refunds to overcharged Marrick households',
  'Delia Venn apologises for Corvale Water meter overcharging',
];
// same-actor siblings: other stories naming W's chair, minister, authority or town
const SIB_PIPE = [
  ['Corvale Water Brenmoor pipeline cost blows out to $90 million', 'The cost of the Corvale Water pipeline from the Brenmoor reservoir has blown out to $90 million, almost double the original estimate, documents released to parliament show. The pipeline, which will carry water to Marrick and nearby towns in regional Victoria, is two years behind schedule. Chair Delia Venn said higher steel prices and wet weather had delayed construction. Water Minister Tom Ashby said the government remained committed to finishing the pipeline by 2028.'],
  ['Brenmoor pipeline delays: Venn blames steel prices and wet weather', 'Corvale Water chair Delia Venn has blamed steel prices and a wet winter for delays to the Brenmoor pipeline, which is now expected to cost $90 million. Farmers along the route in regional Victoria said contractors had left trenches open for months. Opposition water spokesman Sam Reiter said the pipeline had become a symbol of waste and called for an independent review of the budget and timeline of the project.'],
  ['Opposition demands review of Corvale Water pipeline budget', 'The opposition has demanded an independent review of the Brenmoor pipeline after its cost blew out to $90 million. Opposition water spokesman Sam Reiter said Corvale Water and Water Minister Tom Ashby had misled communities in regional Victoria about the price. The authority said the pipeline would secure supply for Marrick for fifty years and that the extra cost reflected changes to the route through farmland.'],
];
const SIB_BY = [
  ['Delia Venn to run as an independent in the Marrick by-election', 'Corvale Water chair Delia Venn will run as an independent candidate in the Marrick by-election next month, she announced on Friday. Ms Venn said she would step down from the authority board if elected and that she wanted to give the town a stronger voice in parliament. The by-election was called after the sitting member retired. Both major parties have preselected local candidates, and a farmers group is expected to announce its own next week.'],
  ['Marrick by-election: Venn candidacy shakes up the race', 'The decision by Corvale Water chair Delia Venn to stand in the Marrick by-election has shaken up a race the major parties expected to be close. Local business owners in regional Victoria said Ms Venn was well known in the town. Water Minister Tom Ashby said the chair would need to resign from the board before the campaign started. Polling day is set for the second Saturday of next month.'],
];
const SIB_HEAD = ['Venn enters Marrick by-election as independent candidate', 'Tom Ashby announces scholarship for regional Victoria engineering students'];

// background narratives: their own vocabularies and centroids, so the IDF has a population
const BGN = [
  ['housing', 'pca', ['Brightwater approves 400 apartments beside the station', 'Station apartments plan wins approval in Brightwater', 'Brightwater residents split over station apartments']],
  ['construction', 'mba', ['Tunnel boring machine Matilda reaches halfway mark', 'Matilda tunnel borer passes halfway under the river', 'River tunnel halfway: Matilda borer on schedule']],
  ['pharmacy', 'pharm', ['Chemists warn of antibiotic shortage before winter', 'Antibiotic shortage hits country chemists', 'Winter antibiotic shortage worries chemists']],
  ['firearms', 'guns', ['Clay target club wins grant for new range', 'Grant for clay target range divides neighbours', 'Clay target range grant approved by shire']],
  ['col', 'cmm', ['Grocery prices rise again as dairy costs climb', 'Dairy costs push grocery prices higher', 'Shoppers face higher dairy prices at the checkout']],
  ['econ', 'cmm', ['Export figures show wool shipments recovering', 'Wool exports recover after slow year', 'Wool shipments rebound as buyers return']],
  ['energy', 'aep', ['Solar farm near Kerang switched on', 'Kerang solar farm begins feeding the grid', 'New solar farm at Kerang opens to visitors']],
  ['activism', 'cmm', ['Climate group stages sit-down outside bank headquarters', 'Bank headquarters sit-down ends peacefully', 'Protesters leave bank lobby after sit-down']],
];

// twin stories: a pair of narratives on one invented story each, for the guards and the caps
const TWIN = [
  ['Glenmore', 'ferry terminal', 'fire'], ['Kilbride', 'footbridge', 'collapse'], ['Ardmore', 'level crossing', 'smash'], ['Tallis', 'aquatic centre', 'roof leak'],
  ['Penrose', 'grain silo', 'explosion'], ['Rosebank', 'rail tunnel', 'flooding'], ['Wexcombe', 'hospital ward', 'outbreak'], ['Larchfield', 'bus depot', 'blaze'],
  ['Moorvale', 'dam spillway', 'crack'], ['Quenby', 'jetty', 'storm damage'], ['Ulverton', 'school gym', 'asbestos scare'], ['Yarrowby', 'water tower', 'contamination'],
  ['Oakhurst', 'courthouse', 'evacuation'], ['Ingleby', 'ski lift', 'stoppage'],
];
const twinTitles = (k, n, off) => { const [p, o, e] = TWIN[k]; const T = [p + ' ' + o + ' ' + e + ' forces closure', e + ' at the ' + p + ' ' + o + ' forces closure', p + ' ' + o + ' closed after ' + e, p + ' ' + o + ' ' + e + ': repairs to take weeks', p + ' ' + o + ' to reopen after ' + e + ' repairs', p + ' ' + o + ' ' + e + ' inquiry ordered']; return Array.from({ length: n }, (_, i) => T[(i + (off || 0)) % T.length]); };

let seq = 0;
const reply = obj => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(obj) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
async function mk(env) {
  const w = await workerEnv({ env: Object.assign({ AI, ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
  w.anth = 0; w.namer = null;
  w.answer(/api\.anthropic\.com/, (u, init) => { w.anth++; const b = JSON.parse(init.body); const user = b.messages[0].content; const ns = Array.from(user.matchAll(/\[(\d+)\] shared terms/g)).map(m => Number(m[1]));
    return reply(w.namer ? w.namer(ns, user) : { clusters: ns.map(n => ({ n, label: 'A narrative the model named ' + n, summary: 'Said by some outlets.', claim: '', counter: '', proponents: 'outlets', issues: [], scope: 'politics', relevance: 2, why: 'stub' })) }); });
  await w.call('GET', '/sentiment/status', null, 'read-key'); await w.call('GET', '/narratives/status', null, 'read-key');
  w.db = w.env.MIND_DB.db; w.G = w.mod.__test;
  // the invented world's people are on the register, so P1 and the term cosine drop their names from the evidence
  for (const e of [{ id: 'venn', name: 'Delia Venn', aliases: ['Delia Venn', 'Ms Venn', 'Venn'] }, { id: 'ashby', name: 'Tom Ashby', aliases: ['Tom Ashby', 'Mr Ashby', 'Ashby'] }, { id: 'reiter', name: 'Sam Reiter', aliases: ['Sam Reiter', 'Mr Reiter', 'Reiter'] }])
    await w.call('POST', '/entities/add', Object.assign({ kind: 'person', side: 'neutral' }, e), 'full-key');
  w.put = (title, body, agoH, o) => { o = o || {}; const url = 'https://example.test/r/' + (++seq); w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)").run(o.kind || 'news', o.src || 'valleypost', title, body || '', url, JSON.stringify(o.meta || { issues: ['regional'] }), Date.now() - agoH * H, Date.now()); return w.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };
  w.place = async scan => { const r = await w.call('POST', '/narratives/step', { what: 'place', scan: scan || 200 }, 'full-key'); if (r.status !== 200) throw new Error('place: ' + r.text.slice(0, 300)); return r.body; };
  w.recount = async () => { const r = await w.call('POST', '/narratives/step', { what: 'recount', limit: 100 }, 'full-key'); if (r.status !== 200) throw new Error('recount: ' + r.text.slice(0, 200)); return r.body; };
  w.run = async () => { const r = await w.call('POST', '/narratives/run', {}, 'full-key'); if (r.status !== 200) throw new Error('run: ' + r.text.slice(0, 200)); await w.settle(); await w.settle(); return (await w.call('GET', '/bridge/job?id=' + r.body.job, null, 'read-key')).body; };
  w.pass = async o => w.G.narrMergePass(w.env, Object.assign({ now: Date.now() }, o || {}));
  w.of = item => { const r = w.db.prepare('SELECT narrative FROM narrative_items WHERE item=?').get(item); return r ? r.narrative : undefined; };
  w.nOf = id => w.db.prepare('SELECT * FROM narratives WHERE id=?').get(id);
  w.items = id => w.db.prepare('SELECT item FROM narrative_items WHERE narrative=? ORDER BY item').all(id).map(r => r.item);
  w.kvj = k => { const v = w.kv.get(k); return v ? JSON.parse(v) : null; };
  w.mode = (merge, clause) => w.kv.set('narr_merge_mode', JSON.stringify(Object.assign({ mode: merge }, clause ? { clause } : {})));
  w.near = mode => w.kv.set('narr_near_mode', JSON.stringify({ mode }));
  w.dry = async q => { const r = await w.call('GET', '/narratives/merges?dry=1' + (q || ''), null, 'full-key'); if (r.status !== 200) throw new Error('dry: ' + r.status + ' ' + r.text.slice(0, 300)); return r.body; };
  w.post = async (body, key) => w.call('POST', '/narratives/merges', body, key || 'full-key');
  w.merges = () => w.db.prepare('SELECT * FROM narrative_merges ORDER BY at, id').all();
  w.pairOf = (d, a, b) => (d.proposals || []).find(p => (p.into.id === a && p.from.id === b) || (p.into.id === b && p.from.id === a));
  // a narrative written straight into the table, as placement and the namer leave one; the recount step fills the rest
  w.mkN = o => {
    const now = Date.now(); const issues = o.issues || ['regional']; const rows = o.rows; const items = [];
    rows.forEach(r => items.push(w.put(r[0], r[1] || '', r[2], { kind: r[3] || 'news', src: r[4] || 'valleypost', meta: Object.assign({ issues }, r[5] || {}) })));
    const texts = rows.map(r => ntext(r[0], r[1] || '')); const ts = rows.map(r => now - r[2] * H); const first = Math.min(...ts), last = Math.max(...ts);
    const ic = o.issueCounts || Object.fromEntries(issues.map((x, i) => [x, rows.length - i]));
    const cen = o.vec || unit(meanv(texts.slice(0, 20).map(vec)));
    w.db.prepare("INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,issue_counts,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated,scope,relevance,scope_why,auto_label,auto_n,label_tries,label_try_ts) VALUES(?,?,?,?,?,?,?,?,?,?,'unknown',?,0,0,0,?,?,'news',?,?,'{}','[]','[]','[]','{}','','new',?,?,0,?,?,?,?,?,?,?,?,0,?,?,'',?,0,0,0)")
      .run(o.id, o.label || '', o.summary || '', o.claim || '', o.counter || '', o.proponents || '', JSON.stringify(issues), JSON.stringify(ic), JSON.stringify(o.entities || []), o.ns == null ? 'vicnats' : o.ns, rows.length, first, items[ts.indexOf(first)], rows[ts.indexOf(first)][4] || 'valleypost', last,
        o.alerted || 0, o.alertTs || 0, o.pinned ? 1 : 0, o.edited ? 1 : 0, JSON.stringify(o.terms || tmap(texts)), b64(cen), DIM, o.label ? rows.length : 0, o.label ? 'claude-opus-5-5' : '', o.created || now - 2 * H, o.scope || '', o.label ? 3 : -1, o.autoLabel || '');
    const ins = w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news',?,0.9)");
    items.forEach((it, i) => ins.run(it, o.id, ts[i], rows[i][4] || 'valleypost'));
    return { id: o.id, items };
  };
  w.bg = () => BGN.forEach(([issue, ns, titles], k) => w.mkN({ id: 'nbg' + k, issues: [issue], ns, vec: V({ [14 + k]: 1 }), label: titles[0], rows: titles.map((t, i) => [t, t + '. More on this from the local paper, with figures from the council and comment from residents.', 6 + i]) }));
  // a twin pair: A (na rows) and B (nb rows) on twin story k, B's centroid at cosine cb to A's
  w.twins = (k, o) => { o = o || {}; const cb = o.cb || 0.96; const a = 'ntw' + k + 'a', b = 'ntw' + k + 'b';
    w.mkN(Object.assign({ id: a, vec: V({ [40 + k]: 1 }), rows: twinTitles(k, o.na || 5, 0).map((t, i) => [t, '', 10 - i]) }, o.A || {}));
    w.mkN(Object.assign({ id: b, vec: V({ [40 + k]: cb, [23 + (k % 6)]: Math.sqrt(1 - cb * cb) }), rows: twinTitles(k, o.nb || 3, 2).map((t, i) => [t, '', 9 - i]) }, o.B || {}));
    return [a, b]; };
  return w;
}
// story W placed: 30 body rows of the 12 ledes (narrative A, past NARR_FREEZE), the six with the most comments carrying its headlines
async function worldA(w) {
  const ids = [];
  for (let i = 0; i < 30; i++) { const [t, b] = LEDES[i % 12]; ids.push(w.put(t, b, 20 - i * 0.5, { meta: { issues: ['regional'], comments: [0, 1, 3, 4, 9, 10].indexOf(i) >= 0 ? 40 - i : 0 } })); }
  const r = await w.place(200); const A = w.of(ids[0]);
  if (!A || ids.some(x => w.of(x) !== A)) throw new Error('fixture: the 30 body rows did not form one narrative: ' + JSON.stringify(r).slice(0, 300));
  return A;
}
const named = (w, id, label, claim, counter) => w.db.prepare("UPDATE narratives SET label=?, claim=?, counter_claim=?, summary='Said by outlets.', proponents='outlets', labelled_n=n, model='claude-opus-5-5', scope=CASE WHEN COALESCE(scope,'')='' THEN 'client' ELSE scope END WHERE id=?").run(label, claim || '', counter || '', id);

// ================================================================ Prevention
await S.t('P1a (F) default shadow: headline rows of W start their own narrative as today; each near miss that qualifies is recorded', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
  const heads = GEN.concat(NAMED).map((t, i) => w.put(t, '', 30 - i * 0.4));   // a late batch, 30-26h old
  const r = await w.place(200);
  ok(r.near && r.near.mode === 'shadow', 'the near mode is reported: ' + JSON.stringify(r.near));
  ok(heads.every(h => w.of(h) !== A), 'no headline row joined A');
  const B = w.of(heads[0]); ok(B && B !== A, 'the headlines started their own narrative');
  const rec = w.db.prepare("SELECT * FROM narrative_near WHERE mode='shadow'").all();
  ok(rec.length >= 1, 'at least the first headline was a recorded would-join'); eq(r.near.would, rec.length, 'out.near.would counts them');
  rec.forEach(x => { eq(x.narrative, A); ok(x.sim >= 0.79 && x.sim < 0.84, 'a near miss: ' + x.sim); ok(x.lex >= 0.45 && x.lean < 0.10, JSON.stringify(x)); ok(x.at > 0); });
  eq(w.db.prepare('SELECT COUNT(*) n FROM narrative_items WHERE narrative=?').get(A).n, 30, 'A is as it was');
});

await S.t('P1b (F) near mode on (KV): the named rows and the generic rows that clear the bar join A at their true cosine; the weak one does not', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w); w.near('on');
  const all = NAMED.concat(GEN); const heads = []; let joined = 0;
  for (let i = 0; i < all.length; i += 3) { all.slice(i, i + 3).forEach((t, j) => heads.push(w.put(t, '', 30 - (i + j) * 0.4))); const r = await w.place(200); eq(r.near.mode, 'on'); joined += r.near.joined; }
  const weak = w.put(GEN_WEAK, '', 24); await w.place(200);
  const inA = heads.filter(h => w.of(h) === A); const on = w.db.prepare("SELECT item, sim, narrative FROM narrative_near WHERE mode='on'").all(); const onSet = new Set(on.map(x => x.item));
  eq(joined, on.length, 'out.near.joined counts the near joins'); ok(on.length >= 6, 'near joins: ' + on.length);
  on.forEach(x => { eq(x.narrative, A); eq(w.of(x.item), A); const s = w.db.prepare('SELECT sim FROM narrative_items WHERE item=?').get(x.item).sim; ok(s >= 0.79 && s < 0.84, 'a near join stores its true cosine, below the bar: ' + s); });
  inA.filter(h => !onSet.has(h)).forEach(h => ok(w.db.prepare('SELECT sim FROM narrative_items WHERE item=?').get(h).sim >= 0.84, 'any other headline in A cleared the bar by itself'));
  ok(heads.slice(0, NAMED.length).every(h => w.of(h) === A), 'every named headline joined A'); eq(inA.length, heads.length, 'and every generic one that clears the bar (all six here)');
  ok(w.of(weak) !== A, 'a headline sharing too little with A stays out'); eq(w.db.prepare('SELECT mode FROM narrative_near WHERE item=?').get(weak).mode, 'miss');
});

await S.t('P1c near mode on: same-actor sibling headlines and bodies start their own narrative', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w); w.near('on');
  const rows = SIB_PIPE.map(([t, b], i) => w.put(t, b, 8 - i)).concat(SIB_BY.map(([t, b], i) => w.put(t, b, 6 - i))).concat(SIB_HEAD.map((t, i) => w.put(t, '', 4 - i)));
  const r = await w.place(200);
  ok(rows.every(x => w.of(x) !== A), 'no sibling joined A'); ok(r.near, 'the near mode ran');
  eq(w.db.prepare("SELECT COUNT(*) n FROM narrative_near WHERE mode='on' AND narrative=?").get(A).n, 0, 'no near join into A (a sibling row may near-join its own story)');
});

// candidates on a town's axis, written straight into the table (frozen past 20 rows unless o.n says otherwise)
function townCand(w, k, o) {
  o = o || {}; const n = o.n || 20; const t = TOWNS[k]; const heads = o.heads || [t + ' swimming pool reopens after repairs', 'Repairs finished at the ' + t + ' swimming pool'];
  return w.mkN(Object.assign({ id: 'ntown' + k, vec: V({ [40 + k]: 1 }), issues: ['regional'], rows: Array.from({ length: n }, (_, i) => [heads[i % heads.length], '', (o.ago || 6) + i * 0.1, 'news', 'valleypost', { comments: 30 - i }]) }, o.N || {})).id;
}
await S.t('P1d near mode on: forum boilerplate and handles are no evidence; nor are three shared register names', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const X = townCand(w, 0, { heads: ['Ashgrove pool thread - reactions comments img', 'Ashgrove pool thread: reactions, comments, img'] });
  const Y = townCand(w, 1, { heads: ['Venn, Ashby and Reiter open the Belmont footbridge', 'Belmont footbridge opened by Venn, Ashby and Reiter'] });
  await w.recount();
  const r1 = w.put('Ashgrove thread: reactions comments img @kel99 @mattgr', 'reactions comments img thread posted @kel99 @mattgr share', 2, { kind: 'forum', src: 'valleytalk' });
  const r2 = w.put('Venn, Ashby and Reiter clash over Belmont rates rise', '', 2);
  const r = await w.place(200);
  ok(w.of(r1) !== X && w.of(r2) !== Y, 'neither joined: ' + w.of(r1) + ' ' + w.of(r2)); eq((r.near && r.near.joined) || 0, 0);
});

await S.t('P1e near mode on: no anchor, or a candidate with no row in the 48h before, means no near join', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const Z = townCand(w, 2, { heads: ['Carrow swimming pool reopens after repairs', 'Repairs finished at the Carrow swimming pool'] });
  const Q = townCand(w, 3, { n: 3, ago: 60, heads: ['Dunlea swimming pool reopens after repairs', 'Repairs finished at the Dunlea swimming pool'] });
  await w.recount();
  const r1 = w.put('Carrow swimming pool reopens after repairs, council says', '', 2, { meta: { issues: [] } });
  const r2 = w.put('Dunlea swimming pool reopens after repairs, council says', '', 2);
  const r = await w.place(200);
  ok(w.of(r1) !== Z, 'no anchor: no near join'); ok(w.of(r2) !== Q, 'the candidate last had a row 60h ago: no near join'); eq((r.near && r.near.joined) || 0, 0);
});

await S.t('P1f near mode on: a comment never near-joins; term mode places exactly as before', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const E = townCand(w, 4, { heads: ['Elmira swimming pool reopens after repairs', 'Repairs finished at the Elmira swimming pool'] }); await w.recount();
  const c = w.put('Comment on: pool', 'Elmira swimming pool reopens after repairs, finally', 2, { kind: 'reddit_comment', src: 'reddit', meta: { issues: ['regional'], sub: 'australia', thread: 't1' } });
  await w.place(200); ok(w.of(c) !== E, 'a comment never near-joins');
  const placeTerms = async near => { const x = await mk({ AI: undefined }); delete x.env.AI; if (near) x.near('on'); [0, 1, 2].forEach(i => x.put(LEDES[i][0], LEDES[i][1], 10 - i)); GEN.slice(0, 3).forEach((t, i) => x.put(t, '', 9 - i)); const r = await x.place(200); return [r.mode, r.joined, r.started, r.unanchored, (r.near && r.near.joined) || 0]; };
  eq(await placeTerms(true), await placeTerms(false), 'term mode: the same placement with the near mode on or off');
});

await S.t('P1g near mode on: a row that leans to the candidate\'s counter-claim does not near-join, and its lean is recorded', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const C = townCand(w, 4, { heads: ['Elmira dam upgrade to protect the town from floods', 'Elmira dam upgrade will protect homes from floods'], N: { label: 'The Elmira dam upgrade will protect the town from floods', claim: 'The Elmira dam upgrade will protect the town from floods.', counter: 'The Elmira dam upgrade wastes money and will not stop floods.' } });
  await w.recount();
  const r1 = w.put('Elmira dam upgrade wastes money and will not stop floods, critics say', '', 2);
  await w.place(200);
  ok(w.of(r1) !== C, 'not joined'); const rec = w.db.prepare('SELECT * FROM narrative_near WHERE item=?').get(r1);
  ok(rec && rec.narrative === C && rec.mode !== 'on' && rec.lean >= 0.10, 'recorded with its lean: ' + JSON.stringify(rec));
});

await S.t('P1h near mode on: three near joins into one narrative a run; member headlines as the run began; twelve candidates read a run', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const F = townCand(w, 5, { heads: ['Fenwick swimming pool reopens after repairs', 'Repairs finished at the Fenwick swimming pool'] }); await w.recount();
  const rows = [0, 1, 2, 3, 4].map(i => w.put('Fenwick swimming pool reopens after repairs, council says ' + ['', 'today', 'again', 'at last', 'finally'][i], '', 3 - i * 0.1));
  const r = await w.place(200);
  eq(r.near.joined, 3, 'three near joins'); eq(rows.filter(x => w.of(x) === F).length, 3, 'three rows joined F, the rest did not');
  // (F, review) the fourth and fifth qualify but F's three a run are spent: they wait unplaced (no narrative of their own, not set
  // aside), recorded 'capped', and the next run near-joins them
  const rest = rows.filter(x => w.of(x) !== F);
  eq(rest.map(x => w.of(x)), [undefined, undefined], 'the fourth and fifth wait in the backlog, never a new narrative or set aside');
  eq(rest.map(x => (w.db.prepare('SELECT mode FROM narrative_near WHERE item=?').get(x) || {}).mode), ['capped', 'capped'], 'recorded capped'); eq(r.near.spent, 2, 'counted apart from the read cap');
  // a row whose headline matches only a row near-joined in the same run (not F's stored headlines) is a miss
  const G = townCand(w, 6, { heads: ['Glenrock swimming pool reopens after repairs', 'Repairs finished at the Glenrock swimming pool'] }); await w.recount();
  const g1 = w.put('Glenrock swimming pool reopens after repairs, council says', '', 3);
  const g2 = w.put('Glenrock lifeguards strike over rosters and overtime', '', 2.9);
  await w.place(200); eq(w.of(g1), G, 'the first joins'); ok(w.of(g2) !== G, 'the next is read against the headlines F had when the run began, not the rows it took');
  ok(rest.every(x => w.of(x) === F), 'the two that waited near-join F on the next run: ' + JSON.stringify(rest.map(x => w.of(x))));
  // thirteen candidates, each with one near row: twelve read, the thirteenth capped
  const x = await mk(); x.bg(); x.near('on');
  const C = TOWNS.slice(0, 13).map((t, k) => townCand(x, k, { n: 2 })); await x.recount();
  const r13 = TOWNS.slice(0, 13).map((t, k) => x.put(t + ' swimming pool reopens after repairs, council says', '', 3 - k * 0.1));
  const rr = await x.place(200); eq(rr.near.capped, 1, 'the thirteenth candidate is capped'); eq(rr.near.joined, 12); ok(x.of(r13[12]) !== C[12], 'no near join past the cap');
  eq(x.of(r13[12]), undefined, '(F, review) the thirteenth waits unplaced'); await x.place(200); eq(x.of(r13[12]), C[12], 'and near-joins on the next run');
});

await S.t('P1k (F, review) near mode on: the member evidence is the candidate\'s recent titles and its label, not only its six most-engaged headlines', async () => {
  const w = await mk(); w.bg(); w.near('on');
  const pool = ['Harwood swimming pool reopens after repairs', 'Repairs finished at the Harwood swimming pool'], lib = ['Harwood library extension opens its doors to readers', 'Readers return as the Harwood library extension opens'];
  // K: the six most-engaged rows are the pool story, the other fourteen the library story; L: short titles, a model label
  const K = w.mkN({ id: 'nharwood', vec: V({ 47: 1 }), rows: Array.from({ length: 20 }, (_, i) => [i < 6 ? pool[i % 2] : lib[i % 2], '', 6 + i * 0.1, 'news', 'valleypost', { comments: i < 6 ? 50 - i : 0 }]) }).id;
  const L = w.mkN({ id: 'nkelso', vec: V({ 50: 1 }), label: 'Kelso council approves the new skate park after a long campaign', rows: Array.from({ length: 6 }, (_, i) => ['Kelso skate park', '', 6 + i * 0.1]) }).id;
  await w.recount();
  const r1 = w.put('Harwood library extension opens to readers, council says', '', 2), r2 = w.put('Kelso council approves new skate park after campaign', '', 2);
  await w.place(200);
  eq([w.of(r1), w.of(r2)], [K, L], 'both near-join on their member evidence: ' + JSON.stringify(w.db.prepare('SELECT item, narrative, mode, lex, shared FROM narrative_near').all()));
});

await S.t('P1i a new narrative stores born_near, born_sim and born_bar; the pass reports nearBorn', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
  const heads = GEN.map((t, i) => w.put(t, '', 30 - i * 0.4)); await w.place(200); const B = w.of(heads[0]);
  const b = w.nOf(B); eq(b.born_near, A); ok(b.born_sim >= 0.79 && b.born_sim < 0.84, 'born_sim ' + b.born_sim); eq(b.born_bar, 0.84);
  const d = await w.dry(); ok(d.nearBorn >= 1, 'nearBorn ' + d.nearBorn); const p = w.pairOf(d, A, B); ok(p && p.born && p.born.near === A, JSON.stringify(p && p.born));
});

await S.t('P1j (F) POST /narratives/near {undo} moves a near-joined row back to the backlog for good; {undo: day} the rest; an old row is set aside', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w); w.near('on');
  const heads = NAMED.slice(0, 3).map((t, i) => w.put(t, '', 30 - i * 0.4)); await w.place(200);
  const on = heads.filter(h => w.of(h) === A); ok(on.length >= 2, 'near joins to undo: ' + on.length);
  const termsBefore = JSON.parse(w.nOf(A).terms);
  const u = await w.call('POST', '/narratives/near', { undo: on[0] }, 'full-key'); eq(u.status, 200, u.text); eq(u.body.undone, 1); eq(u.body.backlog, 1);
  eq(w.of(on[0]), undefined, 'back in the backlog'); ok(w.db.prepare('SELECT undone_at FROM narrative_near WHERE item=?').get(on[0]).undone_at > 0);
  const t1 = JSON.parse(w.nOf(A).terms); ok(JSON.stringify(t1) !== JSON.stringify(termsBefore), 'A lost the row from its terms');
  eq(w.db.prepare('SELECT COUNT(*) n FROM narrative_items WHERE narrative=?').get(A).n, 30 + on.length - 1, 'recounted');
  await w.place(200); ok(w.of(on[0]) !== A, 'never near-joined again');
  w.db.prepare('UPDATE narrative_items SET ts=? WHERE item=?').run(Date.now() - 80 * H, on[1]);
  const day = (await w.call('GET', '/narratives/near', null, 'full-key')).body.day;
  const u2 = await w.call('POST', '/narratives/near', { undo: 'day', day }, 'full-key'); eq(u2.status, 200, u2.text); ok(u2.body.undone >= 1 && u2.body.setAside >= 1, JSON.stringify(u2.body));
  eq(w.of(on[1]), '', 'a row outside the window is set aside');
  eq((await w.call('POST', '/narratives/near', { undo: on[0] }, 'read-key')).status, 403);
});

await S.t('P2a (F) a 30h-old anchored row starts a singleton; a related row placed by the next run joins it', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const a = w.put(LEDES[0][0], LEDES[0][1], 30); await w.place(200); const X = w.of(a); ok(X, 'a singleton');
  const b = w.put(LEDES[1][0], LEDES[1][1], 2); await w.place(200); eq(w.of(b), X, 'it joined the late singleton');
});

await S.t('P2b (F) a singleton whose row is 49h old but placed 23h ago is kept; at 25h it is pruned and its row set aside', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const s = w.mkN({ id: 'nsingle49', rows: [[LEDES[2][0], LEDES[2][1], 49]], created: Date.now() - 23 * H });
  await w.place(200); ok(w.nOf('nsingle49'), 'kept: placed 23h ago');
  w.db.prepare('UPDATE narratives SET created=? WHERE id=?').run(Date.now() - 25 * H, 'nsingle49');
  await w.place(200); eq(w.nOf('nsingle49'), undefined, 'pruned');
  const r = await w.place(200); eq(r.aged, 1, 'its row is too old to stand alone'); eq(w.of(s.items[0]), '', 'set aside');
});

await S.t('P2c (F) a singleton placed when its row was 47h old: at the prune its row (past 71.5h) is set aside, not freed', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const s = w.mkN({ id: 'nedge', rows: [[LEDES[3][0], LEDES[3][1], 71.7]], created: Date.now() - 24.7 * H });
  const r = await w.place(200); eq(w.nOf('nedge'), undefined, 'pruned'); eq(w.of(s.items[0]), '', 'set aside, not back in the backlog'); eq(r.prunedAside, 1);
});

await S.t('P2d (F, review) defaults: late headline rows of W, one a run, never grow a duplicate of A; each is a recorded would-join', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
  const rows = []; for (let k = 0; k < 6; k++) { rows.push(w.put(GEN[k], '', 30)); await w.place(200); }
  const owners = Array.from(new Set(rows.map(x => w.of(x)))).filter(id => id && id !== A);
  eq(owners.filter(id => w.nOf(id) && w.nOf(id).n >= 2), [], 'no near-born duplicate grew across runs: ' + JSON.stringify(owners.map(id => w.nOf(id) && [w.nOf(id).n, w.nOf(id).born_near === A])));
  eq(w.db.prepare("SELECT COUNT(*) n FROM narrative_near WHERE mode='shadow' AND narrative=?").get(A).n, 6, 'each a recorded would-join of A');
  // a late row of a story no live narrative tells still finds the late singleton (P2)
  const a = w.put('Tom Ashby backs the quarry expansion at the council hearing', 'Water Minister Tom Ashby told the council hearing he backs the quarry expansion in regional Victoria.', 30);
  await w.place(200); const X = w.of(a); ok(X && X !== A && w.nOf(X).n === 1, 'a singleton');
  const b = w.put('Quarry expansion hearing hears from Tom Ashby', 'The council hearing on the quarry expansion in regional Victoria heard from Tom Ashby on Tuesday.', 2);
  await w.place(200); eq(w.of(b), X, 'a late singleton that no live narrative would take is still a candidate');
});

await S.t('P2e (F, review) a duplicate born of a would-join of an alerted narrative raises no second alert; status counts the standing near-born', async () => {
  const build = async alertedA => {
    const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
    const rows = [1, 2, 3, 4, 5, 6, 7].map(i => w.put(GEN[1] + ' - wire ' + i, '', 30 - i * 0.01, { src: 'wire' + i }));   // a syndicated batch in one run
    await w.place(200); const B = w.of(rows[0]);
    named(w, A, 'Corvale Water overcharged households through a faulty meter upgrade', 'Corvale Water overcharged households through faulty meters.', 'The authority is refunding every customer.');
    if (alertedA) w.db.prepare('UPDATE narratives SET alerted=1, alert_ts=? WHERE id=?').run(Date.now() - H, A);
    return { w, A, B }; };
  const { w, A, B } = await build(true); const b0 = w.nOf(B);
  ok(B && B !== A && b0.n === 7 && b0.status === 'emerging' && b0.born_near === A, JSON.stringify(b0 && { n: b0.n, status: b0.status, born: [b0.born_near, b0.born_sim, b0.born_bar] }));
  eq((w.db.prepare('SELECT mode, narrative FROM narrative_near WHERE item=?').get(b0.first_item) || {}).narrative, A, 'its first row is a recorded would-join of A');
  const st = (await w.call('GET', '/narratives/status', null, 'read-key')).body.merge;
  ok(st.nearBorn && st.nearBorn.standing >= 1 && st.nearBorn.wouldJoin >= 1 && st.nearBorn.sample.some(x => x.id === B && x.bornNear === A), JSON.stringify(st.nearBorn));
  // the namer has named B (as the day's window would); the next run's alert pass
  named(w, B, 'Faulty water meters overcharged households in regional Victoria', 'A water authority overcharged households through faulty meters.', '');
  const r = await w.place(200); eq([r.alerts, w.nOf(B).alerted], [0, 0], 'A alerted for the story: B raises none');
  const x = await build(false); named(x.w, x.B, 'Faulty water meters overcharged households in regional Victoria', 'A water authority overcharged households through faulty meters.', '');
  const r2 = await x.w.place(200);
  eq([r2.alerts, x.w.nOf(x.A).alerted > 0, x.w.nOf(x.B).alerted], [1, true, 0], 'one alert for the story when neither had alerted: A\'s');
});

await S.t('P3a (F) a narrative born from a row naming a register entity keeps it after the recount; the next run\'s row sharing only it joins at 0.84', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const a = w.put('Delia Venn opens the community glasshouse, variant 1, at the old school', 'Delia Venn opened the community glasshouse at the old school grounds on Saturday morning with local gardeners.', 3, { meta: { issues: [] } });
  await w.place(200); const X = w.of(a); ok(X, 'started'); eq(JSON.parse(w.nOf(X).entities), ['venn'], 'the entity survives the recount while no row is judged');
  const b = w.put('Delia Venn tours the community glasshouse, variant 2, with students', 'Delia Venn toured the community glasshouse with students from the primary school on Monday.', 1, { meta: { issues: [] } });
  await w.place(200); eq(w.of(b), X, 'joined on the shared entity at the 0.84 bar');
});

await S.t('P3b once a row is judged, the recount writes the sentiment entities', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const a = w.put('Delia Venn opens the community glasshouse, variant 1, at the old school', 'Delia Venn opened the community glasshouse at the old school grounds on Saturday morning.', 3, { meta: { issues: [] } });
  await w.place(200); const X = w.of(a);
  w.db.prepare("INSERT INTO sent_items(item,kind,platform,src,ts,tone,texttype,region,issues,entities,model,created) VALUES(?,'news','news','valleypost',?,0.2,'news','vic','[]','[]','m',?)").run(a, Date.now() - 3 * H, Date.now());
  w.db.prepare("INSERT INTO sent_entities(item,entity,stance,intensity,sarcasm,why,ts,platform,region,kind) VALUES(?, 'ashby', 1, 1, 0, '', ?, 'news', 'vic', 'news')").run(a, Date.now() - 3 * H);
  w.db.prepare('UPDATE narratives SET updated=0 WHERE id=?').run(X); await w.recount();
  eq(JSON.parse(w.nOf(X).entities), ['ashby'], 'judged rows decide');
});

await S.t('P4a (F) an all-capitals alias takes no plural: "phones" is not One Nation, "PHON" is, "Liberals" still matches', async () => {
  const w = await mk(); const t = async s => (await w.call('GET', '/entities/test?text=' + encodeURIComponent(s), null, 'read-key')).body.entities.map(e => e.id);
  ok((await t('Delegates were told to switch off their phones before the session')).indexOf('on') < 0, 'phones');
  ok((await t('PHON candidates were announced today')).indexOf('on') >= 0, 'PHON');
  ok((await t('The Liberals announced a candidate')).indexOf('lib') >= 0, 'Liberals');
});

await S.t('P5a (F) two place steps started together place every row once and leave no ghost', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const ids = [0, 1, 2, 3].map(i => w.put(LEDES[i][0], LEDES[i][1], 5 - i));
  w.slowReads(10); const [x, y] = await Promise.all([w.place(200), w.place(200)]); w.slowReads(0);
  const owners = new Set(ids.map(i => w.of(i))); eq(owners.size, 1, 'one narrative holds the four');
  const ghosts = w.db.prepare("SELECT id, n FROM narratives n WHERE n>0 AND id NOT LIKE 'nbg%' AND (SELECT COUNT(*) FROM narrative_items WHERE narrative=n.id)=0").all(); eq(ghosts, [], 'no ghost');
  eq(x.placed + y.placed, 4, 'placed once: ' + x.placed + ' + ' + y.placed);
});

await S.t('P5b a lease left by a holder that never released blocks placement until it expires', async () => {
  const w = await mk(); w.bg(); await w.recount(); w.env.__narrLeaseSleep = async () => {};
  w.db.prepare("INSERT INTO narr_lease(name,holder,until) VALUES('place','a-stopped-run',?)").run(Date.now() + 60000);
  const a = w.put(LEDES[0][0], LEDES[0][1], 2);
  const r = await w.place(200); eq(r.busy, true); eq(r.placed, 0); eq(w.of(a), undefined, 'still waiting');
  w.db.prepare("UPDATE narr_lease SET until=? WHERE name='place'").run(Date.now() - 1);
  const r2 = await w.place(200); ok(!r2.busy && r2.placed === 1, JSON.stringify(r2).slice(0, 200)); ok(w.of(a));
});

await S.t('P5c rows left on a merged-away id are moved to the survivor by the next placement and counted there', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  eq((await w.call('POST', '/narratives/merge', { into: A, from: B }, 'full-key')).status, 200);
  const late = w.put(twinTitles(0, 1, 4)[0], '', 1); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','valleypost',0.9)").run(late, B, Date.now() - H);
  await w.place(200); eq(w.of(late), A, 'moved to the survivor'); eq(w.nOf(A).n, 9, 'and counted there');
});

await S.t('P5d (F) rows on a missing narrative with no merge chain: inside the window back to the backlog, older ones set aside', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const young = w.put('A story about the gallery opening night in Wexley', 'More on the gallery.', 10, { meta: { issues: [] } }); const old = w.put('An old story about the gallery in Wexley', 'More on the gallery.', 80, { meta: { issues: [] } });
  const ins = w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,'nghost',?,'news','valleypost',0.9)"); ins.run(young, Date.now() - 10 * H); ins.run(old, Date.now() - 80 * H);
  const r = await w.place(200); ok(r.repaired && r.repaired.backlog === 1 && r.repaired.setAside === 1, JSON.stringify(r.repaired));
  eq(w.of(old), '', 'set aside'); ok(w.of(young) !== 'nghost', 'back in the backlog and placed again');
});

// ================================================================ Merge pass
await S.t('M1 (F) default propose: the form split is proposed in KV narr_merge_last with its scores; nothing merges', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
  const heads = GEN.map((t, i) => w.put(t, '', 30 - i * 0.4)); await w.place(200); const B = w.of(heads[0]); ok(B !== A);
  const j = await w.run(); eq(j.status, 'done', JSON.stringify(j).slice(0, 300));
  const last = w.kvj('narr_merge_last'); ok(last && last.mode === 'propose', JSON.stringify(last).slice(0, 300));
  const p = last.proposals.find(x => x.into.id === A && x.from.id === B); ok(p, 'B -> A proposed: ' + JSON.stringify(last.proposals.map(x => [x.into.id, x.from.id])));
  ok([p.c, p.t, p.s, p.sAuto].every(x => typeof x === 'number') && p.anchor.length && p.rule && p.autoIf && typeof p.autoIf.formS === 'boolean', JSON.stringify(p));
  eq(w.merges().length, 0, 'nothing merged'); ok(w.nOf(B));
});

// the four hard-negative shapes, written straight into the table with their centroids
function hardNegatives(w) {
  const A = w.mkN({ id: 'nwbody', vec: V({ 0: Math.sqrt(0.128), 10: Math.sqrt(0.653), 11: Math.sqrt(0.099) }), label: 'Corvale Water overcharged households through a faulty meter upgrade', claim: 'Corvale Water overcharged households through faulty meters and was slow to admit it.', counter: 'The authority found the fault and is refunding every customer.', rows: LEDES.map(([t, b], i) => [t, b, 20 - i]) }).id;
  const C = w.mkN({ id: 'nsibpipe', vec: V({ 1: Math.sqrt(0.128), 10: Math.sqrt(0.653), 11: Math.sqrt(0.099), 61: 0.18 }), rows: SIB_PIPE.map(([t, b], i) => [t, b, 12 - i]).concat([['Corvale Water pipeline cost doubles to $90 million', '', 9]]) }).id;
  const court = w.mkN({ id: 'ncourt', issues: ['activism'], ns: 'cmm', vec: V({ 50: 1 }), label: 'Court lets the Fenmoor weir sit-in go ahead', claim: 'The court ruling lets protesters hold the Fenmoor weir sit-in lawfully.', counter: 'The shire was right to ban the Fenmoor weir sit-in for safety.', rows: ['Court clears the way for the Fenmoor weir sit-in', 'Fenmoor weir sit-in can go ahead, court rules', 'Protesters win court fight over Fenmoor weir sit-in', 'Judge rejects bid to stop Fenmoor weir sit-in', 'Fenmoor weir sit-in protesters celebrate court ruling'].map((t, i) => [t, '', 10 - i]) }).id;
  const ban = w.mkN({ id: 'nban', issues: ['activism'], ns: 'cmm', vec: V({ 50: 0.95, 51: Math.sqrt(1 - 0.9025) }), label: 'Shire bans the Fenmoor weir sit-in for safety', claim: 'The shire was right to ban the Fenmoor weir sit-in for safety.', counter: 'The court ruling lets protesters hold the Fenmoor weir sit-in lawfully.', rows: ['Shire bans Fenmoor weir sit-in over safety fears', 'Fenmoor shire votes to ban weir sit-in', 'Safety fears behind shire ban on Fenmoor weir sit-in'].map((t, i) => [t, '', 9 - i]) }).id;
  const boiler = ' reactions comments img posted share thread';
  const f1 = w.mkN({ id: 'nforum1', issues: ['gov'], ns: 'cmm', vec: V({ 52: Math.sqrt(0.30), 54: Math.sqrt(0.46), 11: Math.sqrt(0.24) }), rows: ['Valley Talk: tollway tolls going up again' + boiler, 'Valley Talk: tollway toll rise is a rort' + boiler, 'Valley Talk: who uses the tollway now' + boiler].map((t, i) => [t, '@roadie @kel99 thoughts' + boiler, 8 - i, 'forum', 'valleytalk']) }).id;
  const f2 = w.mkN({ id: 'nforum2', issues: ['gov'], ns: 'cmm', vec: V({ 53: Math.sqrt(0.30), 54: Math.sqrt(0.46), 11: Math.sqrt(0.24) }), rows: ['Valley Talk: fluoride in the town supply' + boiler, 'Valley Talk: council fluoride vote' + boiler, 'Valley Talk: fluoride petition numbers' + boiler].map((t, i) => [t, '@roadie @kel99 thoughts' + boiler, 8 - i, 'forum', 'valleytalk']) }).id;
  const live = 'Live: Thornbury pledges new clinics as Ashdown promises school buses';
  const q1 = w.mkN({ id: 'npledge1', issues: ['vicelection'], ns: 'vicnats', vec: V({ 55: Math.sqrt(0.12), 57: Math.sqrt(0.76), 11: Math.sqrt(0.12) }), rows: [[live, '', 9.5, 'news', 'valleypost', { comments: 90 }], ['Thornbury pledges three new clinics for the outer suburbs', '', 9], ['New clinics pledge: Thornbury promises shorter waits', '', 8.5], ['Thornbury clinics pledge costed at $120 million', '', 8], ['Doctors welcome Thornbury plan for outer suburb clinics', '', 7.5]] }).id;
  const q2 = w.mkN({ id: 'npledge2', issues: ['vicelection'], ns: 'vicnats', vec: V({ 56: Math.sqrt(0.12), 57: Math.sqrt(0.76), 11: Math.sqrt(0.12) }), rows: [[live, '', 9.4, 'news', 'northernstar', { comments: 80 }], ['Ashdown promises free school buses for country students', '', 9], ['Free school buses pledge: Ashdown targets country families', '', 8.5], ['Country families react to Ashdown school buses plan', '', 8]] }).id;
  return { A, C, court, ban, f1, f2, q1, q2 };
}

await S.t('M2 none of the hard-negative shapes is automatic under any default clause', async () => {
  const w = await mk(); w.bg(); const h = hardNegatives(w); await w.recount(); w.mode('auto');
  const pairs = [[h.A, h.C], [h.court, h.ban], [h.f1, h.f2], [h.q1, h.q2]];
  const d = await w.dry('&pairs=' + pairs.map(p => p.join(':')).join(','));
  eq(d.pairs.length, 4); d.pairs.forEach(p => { ok(p.found, JSON.stringify(p)); eq(p.auto, false, p.a + ':' + p.b + ' ' + JSON.stringify(p.features)); ok(!(p.autoIf.centroid || p.autoIf.formS) || p.holds.length, 'a default clause passes only where a hold stands: ' + JSON.stringify(p)); });
  const opp = d.pairs[1]; ok(opp.features.opposite.fires && opp.holds.indexOf('opposite') >= 0, 'the opposite claims veto: ' + JSON.stringify(opp));
  const lb = d.pairs[3]; ok(lb.features.sAuto < lb.features.s, 'one syndicated live-blog row cannot carry an automatic decision: ' + JSON.stringify(lb.features));
  const r = await w.pass(); eq((r.applied || []).length, 0); eq(w.merges().length, 0);
});

await S.t('M2b (F, review) the live-blog pair with fewer rows of its own, and two press releases from one MP in one namespace, are never automatic', async () => {
  const live = 'Live: Thornbury pledges new clinics as Ashdown promises school buses';
  const own1 = [['Thornbury pledges three new clinics for the outer suburbs', '', 9], ['New clinics pledge: Thornbury promises shorter waits', '', 8.5], ['Thornbury clinics pledge costed at $120 million', '', 8]];
  const own2 = [['Ashdown promises free school buses for country students', '', 9], ['Free school buses pledge: Ashdown targets country families', '', 8.5]];
  for (const [k1, k2] of [[2, 1], [2, 2], [3, 2]]) {   // n 3/2, 3/3, 4/3: the one shared live-blog row weighs more the smaller they are
    const w = await mk(); w.bg();
    const q1 = w.mkN({ id: 'npledge1', issues: ['vicelection'], ns: 'vicnats', vec: V({ 55: Math.sqrt(0.12), 57: Math.sqrt(0.76), 11: Math.sqrt(0.12) }), rows: [[live, '', 9.5, 'news', 'valleypost', { comments: 90 }]].concat(own1.slice(0, k1)) }).id;
    const q2 = w.mkN({ id: 'npledge2', issues: ['vicelection'], ns: 'vicnats', vec: V({ 56: Math.sqrt(0.12), 57: Math.sqrt(0.76), 11: Math.sqrt(0.12) }), rows: [[live, '', 9.4, 'news', 'northernstar', { comments: 80 }]].concat(own2.slice(0, k2)) }).id;
    await w.recount(); w.mode('auto');
    const p = (await w.dry('&pairs=' + q1 + ':' + q2)).pairs[0];
    eq(p.auto, false, 'n ' + (k1 + 1) + '/' + (k2 + 1) + ': ' + JSON.stringify(p.features)); ok(!(p.autoIf.centroid || p.autoIf.formS) || p.holds.length, 'no default clause passes: ' + JSON.stringify(p.features));
    eq((await w.pass()).applied.length, 0);
  }
  // the same MP's two press releases, two copies each, one namespace, centroid cosine 0.87: they share the MP's and the party's
  // names and nothing of what happened
  const w = await mk(); w.bg();
  for (const e of [{ id: 'brandt', kind: 'person', name: 'Ilse Brandt', aliases: ['Ilse Brandt', 'Ms Brandt', 'Brandt'] }, { id: 'harbourparty', kind: 'party', name: 'Harbour Party', aliases: ['Harbour Party'] }])
    await w.call('POST', '/entities/add', Object.assign({ side: 'neutral' }, e), 'full-key');
  const r1 = 'Ilse Brandt MP - Harbour Party to fund new Tarrow aged care beds', r2 = 'Ilse Brandt MP - Harbour Party backs Tarrow fishers with jetty repairs';
  const P1 = w.mkN({ id: 'nrelease1', issues: ['gov'], ns: 'cmm', vec: V({ 58: 1 }), rows: [[r1, '', 6], [r1, '', 5.9, 'news', 'northernstar']] }).id;
  const P2 = w.mkN({ id: 'nrelease2', issues: ['gov'], ns: 'cmm', vec: V({ 58: 0.87, 59: Math.sqrt(1 - 0.87 * 0.87) }), rows: [[r2, '', 5], [r2, '', 4.9, 'news', 'northernstar']] }).id;
  await w.recount(); w.mode('auto');
  const p = (await w.dry('&pairs=' + P1 + ':' + P2)).pairs[0];
  ok(p.found && p.prefilter.anchor, JSON.stringify(p)); eq(p.auto, false, 'names alone carry no automatic merge: ' + JSON.stringify(p.features));
  ok(!(p.autoIf.centroid || p.autoIf.formS), 'no clause passes on the names: ' + JSON.stringify(p.features)); eq((await w.pass()).applied.length, 0);
});

await S.t('M3 (F) mode auto: B merges into A by itself, recorded and complete', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w);
  const heads = GEN.map((t, i) => w.put(t, '', 30 - i * 0.4)); await w.place(200); const B = w.of(heads[0]); ok(B !== A);
  named(w, A, 'Corvale Water overcharged households through a faulty meter upgrade', 'Corvale Water overcharged 18,000 households through faulty meters and was slow to admit it.', 'The authority found the fault, apologised and is refunding every customer.');
  w.db.prepare('UPDATE narratives SET alerted=1, alert_ts=? WHERE id=?').run(Date.now() - 20 * H, B);
  const a0 = w.nOf(A), b0 = w.nOf(B), bItems = w.items(B); w.mode('auto');
  const j = await w.run(); const m = w.merges(); eq(m.length, 1, 'one merge: ' + JSON.stringify(j.result && j.result.merge));
  eq([m[0].into_id, m[0].from_id, m[0].how, m[0].who], [A, B, 'auto', 'auto']);
  eq(w.db.prepare('SELECT item FROM narrative_merge_items WHERE merge=? ORDER BY item').all(m[0].id).map(r => r.item), bItems, 'the moved items are recorded');
  eq(w.nOf(B), undefined, 'B is gone'); eq(w.items(A).length, 30 + bItems.length, 'A has every row');
  const a1 = w.nOf(A); eq(a1.label, a0.label, 'A keeps its model label'); eq(a1.auto_label, a0.auto_label, 'and its working title');
  const ic0 = JSON.parse(a0.issue_counts), icb = JSON.parse(b0.issue_counts), ic1 = JSON.parse(a1.issue_counts); eq(ic1.regional, ic0.regional + icb.regional, 'issue counts summed');
  eq(a1.alerted, 1, 'a sent alert is inherited (no second post)'); eq(a1.first_item, b0.first_item, 'first_* from the older side');
  ok(new RegExp('merge ' + m[0].id).test(j.result.summary), 'the run summary names the merge: ' + j.result.summary);
});

await S.t('M4 guards under auto: person, muted, broad, counter, opposite, clients, scope, size, naming, kept', async () => {
  const w = await mk(); w.bg();
  const P = {}; const set = (k, o) => { P[k] = w.twins(Object.keys(P).length, o); };
  set('control'); set('edited', { A: { edited: true, label: 'A person named this' } }); set('pinned', { B: { pinned: true } }); set('muted'); set('broad'); set('counter');
  set('opposite', { A: { label: 'The Penrose silo is safe', claim: 'The Penrose grain silo is safe to reopen after the explosion.', counter: 'The Penrose grain silo must stay shut after the explosion.' }, B: { label: 'The Penrose silo must stay shut', claim: 'The Penrose grain silo must stay shut after the explosion.', counter: 'The Penrose grain silo is safe to reopen after the explosion.' } });
  set('clients', { B: { ns: 'cmm' } }); set('scopeoff', { A: { scope: '' }, B: { scope: 'off' } }); set('politicsClient', { A: { scope: 'politics' }, B: { scope: 'client' } }); set('clientPolitics', { A: { scope: 'client' }, B: { scope: 'politics' } });
  set('naming', { B: {} }); set('kept'); set('size', { na: 52, nb: 5 });
  const sz3 = w.mkN({ id: 'ntw13c', vec: V({ [40 + 13]: 0.95, 28: Math.sqrt(1 - 0.9025) }), rows: twinTitles(13, 5, 3).map((t, i) => [t, '', 8 - i]) }).id;
  await w.recount();
  w.db.prepare('UPDATE narratives SET muted=1 WHERE id=?').run(P.muted[0]); w.db.prepare("UPDATE narratives SET status='broad' WHERE id=?").run(P.broad[0]);
  w.db.prepare('UPDATE narratives SET counter=? WHERE id=?').run(P.counter[1], P.counter[0]); w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now(), P.naming[1]);
  eq((await w.post({ keep: [{ a: P.kept[0], b: P.kept[1], note: 'two stories' }] })).status, 200);
  w.mode('auto'); const d = await w.dry(); const g = k => w.pairOf(d, P[k][0], P[k][1]);
  eq(g('control').auto, true, 'the control pair is automatic: ' + JSON.stringify(g('control')));
  for (const [k, hold] of [['edited', 'person'], ['pinned', 'person'], ['opposite', 'opposite'], ['clients', 'clients'], ['scopeoff', 'scope'], ['politicsClient', 'scope'], ['naming', 'naming'], ['kept', 'kept']]) { const p = g(k); ok(p && p.auto === false && p.hold.indexOf(hold) >= 0, k + ': ' + JSON.stringify(p && { hold: p.hold, auto: p.auto })); }
  for (const k of ['muted', 'broad', 'counter']) ok(!g(k), k + ' is not proposed');
  eq(g('clientPolitics').auto, true, 'a client survivor may absorb a politics narrative');
  ok(g('size').auto === true && w.pairOf(d, P.size[0], sz3).hold.indexOf('size') >= 0, 'the size hold is a running total over the survivor\'s absorptions');
  // with crossNs 'issue', the clients pair is automatic: the absorbed's leading issue is in the survivor's top three
  w.mode('auto', { crossNs: 'issue' }); eq(w.pairOf(await w.dry(), P.clients[0], P.clients[1]).auto, true, 'crossNs issue');
  w.mode('auto'); await w.pass(); ok(w.nOf(P.naming[1]), 'in a naming claim: skipped this tick');
  w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now() - 3 * 60000, P.naming[1]); await w.pass(); eq(w.nOf(P.naming[1]), undefined, 'merged by the first tick after the claim lapsed');
});

await S.t('M5 caps: five a tick, forty a day, three a survivor a day', async () => {
  const w = await mk(); w.bg(); const pairs = [0, 1, 2, 3, 4, 5, 6].map(k => w.twins(k)); await w.recount(); w.mode('auto');
  const r1 = await w.pass(); eq(r1.applied.length, 5, 'five this tick'); const r2 = await w.pass(); eq(r2.applied.length, 2, 'two the next'); eq(w.merges().length, 7);
  const x = await mk(); x.bg(); const S1 = x.mkN({ id: 'nsurv', vec: V({ 45: 1 }), rows: twinTitles(5, 8, 0).map((t, i) => [t, '', 12 - i * 0.5]) }).id;
  const small = [0, 1, 2, 3].map(i => x.mkN({ id: 'nsmall' + i, vec: V({ 45: 0.97, [23 + i]: Math.sqrt(1 - 0.9409) }), rows: twinTitles(5, 2, i + 1).map((t, j) => [t, '', 10 - i - j * 0.3]) }).id); await x.recount(); x.mode('auto');
  const r3 = await x.pass(); eq(r3.applied.length, 3, 'three absorptions into one survivor a day'); const d = await x.dry(); ok(d.proposals.some(p => p.into.id === S1 && p.hold.indexOf('cap') >= 0), 'the fourth waits: ' + JSON.stringify(d.proposals.map(p => [p.into.id, p.from.id, p.hold])));
  const y = await mk(); y.bg(); y.twins(7); await y.recount(); y.mode('auto');
  const ins = y.db.prepare("INSERT INTO narrative_merges(id,into_id,from_id,how,who,rule,clause,score,at,from_row,into_before) VALUES(?,?,?,'auto','auto','','','{}',?,'{}','{}')"); for (let i = 0; i < 40; i++) ins.run('mfake' + i, 'nx' + i, 'ny' + i, Date.now() - 60000);
  const r4 = await y.pass(); eq(r4.applied.length, 0, 'forty automatic merges today: none more'); eq(y.merges().length, 40);
});

await S.t('M6 (F) complete link across ticks: C is never merged through the survivor\'s drift', async () => {
  // lexical drift: A and C share no words, B shares A's and C's; after B joins A, C reads like the merged A but not like A before
  const w = await mk(); w.bg();
  const aw = ['Harwick lighthouse restoration starts', 'Harwick lighthouse restoration crews arrive', 'Harwick lighthouse restoration scaffold goes up', 'Harwick lighthouse restoration budget approved', 'Harwick lighthouse restoration timeline set', 'Harwick lighthouse restoration volunteers sought'];
  const bw = ['Harwick lighthouse restoration uncovers shipwreck timbers', 'Shipwreck timbers found under Harwick lighthouse restoration', 'Harwick lighthouse restoration pauses for shipwreck timbers'];
  const cw = ['Shipwreck timbers sent to maritime museum lab', 'Maritime museum lab dates the shipwreck timbers', 'Shipwreck timbers go on show at maritime museum'];
  const A = w.mkN({ id: 'nlhA', vec: V({ 47: 1 }), rows: aw.map((t, i) => [t, '', 12 - i]) }).id; const B = w.mkN({ id: 'nlhB', vec: V({ 47: 0.99, 24: Math.sqrt(1 - 0.9801) }), rows: bw.map((t, i) => [t, '', 9 - i]) }).id;
  const C = w.mkN({ id: 'nlhC', vec: V({ 47: 0.99, 25: Math.sqrt(1 - 0.9801) }), rows: cw.map((t, i) => [t, '', 8 - i]) }).id; await w.recount(); w.mode('auto');
  const r1 = await w.pass(); eq(r1.applied.map(x => x.from), [B], 'B joins A; C has no edge to A');
  const pre = await w.dry('&pairs=' + A + ':' + C); ok(pre.pairs[0].autoIf.centroid || pre.pairs[0].autoIf.formS, 'C against the merged A now passes: ' + JSON.stringify(pre.pairs[0].features));
  const r2 = await w.pass(); eq(r2.applied.length, 0, 'not on the next tick either'); ok(w.nOf(C)); const d = await w.dry(); const p = w.pairOf(d, A, C); ok(p && p.hold.indexOf('member') >= 0, 'held by the member check: ' + JSON.stringify(p && p.hold));
  // variant: C passes against A before the merge but fails against B's logged row
  const x = await mk(); x.bg(); const t = ['Fernvale orchard frost damage', 'Fernvale orchard frost losses mount', 'Frost damage at Fernvale orchard', 'Fernvale orchard growers count frost cost', 'Fernvale orchard frost relief sought', 'Fernvale orchard frost insurance claims', 'Fernvale orchard frost hits apricots', 'Fernvale orchard frost: growers meet'];
  const A2 = x.mkN({ id: 'nfvA', vec: V({ 48: 1 }), rows: t.map((s, i) => [s, '', 12 - i * 0.5]) }).id; const B2 = x.mkN({ id: 'nfvB', vec: V({ 48: 0.96, 26: 0.28 }), rows: t.slice(0, 2).map((s, i) => [s, '', 7 - i]) }).id; await x.recount(); x.mode('auto');
  eq((await x.pass()).applied.length, 1);
  const C2 = x.mkN({ id: 'nfvC', vec: V({ 48: 0.96, 26: -0.28 }), rows: t.slice(2, 5).map((s, i) => [s, '', 6 - i]) }).id; await x.recount();
  const dd = await x.dry('&pairs=' + A2 + ':' + C2); ok(dd.pairs[0].autoIf.centroid, 'C against the merged A passes: ' + JSON.stringify(dd.pairs[0].features));
  eq((await x.pass()).applied.length, 0, 'C fails against B\'s logged row: not merged'); ok(x.nOf(C2));
});

await S.t('M7 (F) components: a big A and small B and C, B~C the strongest pair, both join A', async () => {
  const w = await mk(); w.bg(); const t = twinTitles(8, 6, 0);
  const A = w.mkN({ id: 'ncompA', vec: V({ 48: 1 }), rows: t.concat(t.slice(0, 4)).map((s, i) => [s, '', 12 - i * 0.5]) }).id;
  const B = w.mkN({ id: 'ncompB', vec: V({ 48: 0.95, 27: Math.sqrt(1 - 0.9025) }), rows: t.slice(0, 3).map((s, i) => [s, '', 8 - i]) }).id;
  const C = w.mkN({ id: 'ncompC', vec: V({ 48: 0.95, 27: Math.sqrt(1 - 0.9025) - 0.01, 28: 0.1 }), rows: t.slice(3, 6).map((s, i) => [s, '', 7 - i]) }).id; await w.recount(); w.mode('auto');
  const r = await w.pass(); eq(r.applied.map(x => x.into), [A, A], 'both into A: ' + JSON.stringify(r.applied)); eq(w.nOf(B), undefined); eq(w.nOf(C), undefined);
});

await S.t('M8 a survivor of 20+ rows keeps its centroid byte for byte; a young survivor\'s moves by min(rows, 20) weights, logged', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0, { na: 22, nb: 3 }); const [C, D] = w.twins(1, { na: 5, nb: 3 }); await w.recount();
  const a0 = w.nOf(A).centroid, c0 = unb64(w.nOf(C).centroid), d0 = unb64(w.nOf(D).centroid);
  w.mode('auto'); const r = await w.pass(); eq(r.applied.length, 2);
  eq(w.nOf(A).centroid, a0, 'frozen survivor: unchanged'); const mA = w.merges().find(m => m.into_id === A); eq(mA.weights, '', 'no weights when it did not move');
  const mC = w.merges().find(m => m.into_id === C); eq(JSON.parse(mC.weights), { into: 5, from: 3 }); const c1 = unb64(w.nOf(C).centroid); const exp = c0.map((x, i) => (x * 5 + d0[i] * 3) / 8);
  ok(cosv(c1, exp) > 0.99999, 'moved by the weights');
});

await S.t('M9 the noise split is proposed; auto is what its own features give', async () => {
  const w = await mk(); w.bg(); await w.recount();
  const r1 = w.put('Quarry expansion angle 1: trucks on the school road worry parents', 'Quarry expansion plans in regional Victoria mean more trucks on the school road, parents say, angle 1.', 10);
  const r2 = w.put('Quarry expansion angle 2: dust from the pit worries farmers', 'Quarry expansion plans in regional Victoria mean more dust from the pit, farmers say, angle 2.', 9.9);
  const r1b = w.put('Quarry expansion angle 1: school road trucks petition', 'Parents in regional Victoria petition over quarry trucks on the school road, angle 1.', 9.8); const r2b = w.put('Quarry expansion angle 2: farmers fear pit dust', 'Farmers in regional Victoria fear quarry pit dust will damage crops, angle 2.', 9.7);
  await w.place(200); const X = w.of(r1), Y = w.of(r2); ok(X && Y && X !== Y, 'two halves');
  for (let i = 0; i < 4; i++) { w.put('Quarry expansion angle 0: council hearing ' + i, 'The council heard submissions on the quarry expansion in regional Victoria, angle 0, item ' + i + '.', 8 - i); await w.place(200); }
  const d = await w.dry(); const p = w.pairOf(d, X, Y); ok(p, 'proposed: ' + JSON.stringify(d.proposals.map(q => [q.into.id, q.from.id, q.c])));
  const b = d.bars; const exp = !p.hold.length && p.anchor.length > 0 && p.gapH <= 24 && ((p.c >= b.cHi && p.sAuto >= b.sCorr) || (b.form === 's' && p.c >= b.cForm && p.sAuto >= b.formS));
  eq(p.auto, exp, 'auto from its own features: ' + JSON.stringify(p));
});

await S.t('M10 clause variants: form s, form t, off', async () => {
  const w = await mk(); w.bg(); [0, 1, 2, 3].forEach(k => w.twins(k, { cb: [0.97, 0.88, 0.87, 0.80][k] })); await w.recount();
  const check = async (clause, fn) => { w.mode('auto', clause); const d = await w.dry(); for (let k = 0; k < 4; k++) { const p = w.pairOf(d, 'ntw' + k + 'a', 'ntw' + k + 'b'); if (!p) continue; eq(p.auto, !p.hold.length && fn(p, d.bars), JSON.stringify(clause) + ' pair ' + k + ': ' + JSON.stringify(p)); } return d; };
  await check({ form: 's' }, (p, b) => (p.c >= b.cHi && p.sAuto >= b.sCorr) || (p.c >= b.cForm && p.sAuto >= b.formS));
  await check({ form: 't' }, (p, b) => (p.c >= b.cHi && p.sAuto >= b.sCorr) || (p.c >= b.cForm && p.t >= b.formT && p.sAuto >= b.formS));
  const off = await check({ form: 'off' }, (p, b) => p.c >= b.cHi && p.sAuto >= b.sCorr); eq(off.bars.form, 'off');
});

await S.t('M11 an anchor-less pair at c >= simS is proposed (strict) and never automatic', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0, { cb: 0.915, A: { issues: ['housing'], ns: 'pca' }, B: { issues: ['firearms'], ns: 'pca' } }); await w.recount(); w.mode('auto');
  const p = w.pairOf(await w.dry(), A, B); ok(p && p.rule === 'strict' && p.auto === false && !p.anchor.length, JSON.stringify(p));
});

await S.t('M12 a change between the scan and the apply is caught: skipped with its reason', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); w.mode('auto');
  w.env.__narrMergeHook = async () => { w.db.prepare("UPDATE narratives SET edited=1, label='Edited meanwhile', updated=? WHERE id=?").run(Date.now(), B); };
  const r = await w.pass(); delete w.env.__narrMergeHook; eq(r.applied.length, 0); ok((r.skipped || []).some(s => s.from === B && /person|edited/.test(s.why)), JSON.stringify(r.skipped)); ok(w.nOf(B));
});

await S.t('M13 (F, review) the scan is bounded by pairs scored, not a clock (a Worker\'s clock stands still in a loop): on one issue the tick stops at its cap, recorded; the dry route scores every pair', async () => {
  const build = async oneIssue => {
    const w = await mk(); const now = Date.now(); let rnd = 12345; const R = () => { rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0; return rnd / 4294967296; };
    const words = Array.from({ length: 900 }, (_, i) => 'w' + i.toString(36) + 'x'); const issues = ['regional', 'housing', 'gov', 'energy', 'col', 'econ', 'construction', 'pharmacy', 'firearms', 'activism'];
    const ins = w.db.prepare("INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,issue_counts,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated,scope) VALUES(?,?,'',?,?,'',?,?,'[]','cmm','unknown',?,0,0,0,?,0,'news','x',?,'{}','[]','[]',?,'{}','','steady',0,0,0,0,0,?,?,768,0,'',?,?,'')");
    // the 300 largest are the 300 least recent, so the recency read (400) and the size read (300) together take all 600
    for (let i = 0; i < 600; i++) { const v = Array.from({ length: 768 }, () => R() - 0.5); const iss = [oneIssue ? 'regional' : issues[Math.floor(R() * 10)]]; const pick = k => Array.from({ length: k }, () => words[Math.floor(R() * words.length)]); const terms = {}; pick(40).forEach((x, j) => { terms[x] = Math.round((2 - j * 0.03) * 1000) / 1000; });
      const big = i < 300; const amps = Array.from({ length: 6 }, () => ({ title: pick(8).join(' '), channel: 'x', platform: 'news' }));
      ins.run('nsyn' + i, pick(6).join(' '), pick(10).join(' '), pick(10).join(' '), JSON.stringify(iss), JSON.stringify({ [iss[0]]: 3 }), big ? 30 + (i % 25) : 2 + Math.floor(R() * 20), now - (60 + R() * 60) * H, big ? now - (24 + R() * 20) * H : now - R() * 20 * H, JSON.stringify(amps), JSON.stringify(terms), b64(v), now, now); }
    return { w, now };
  };
  const { w, now } = await build(false);
  const t0 = Date.now(); const sc = await w.G.narrMergeScan(w.env, { now, left: () => 1e9 }); const ms = Date.now() - t0;
  console.log('       M13: ten issues: ' + sc.considered + ' narratives, ' + sc.scored + ' pairs scored in ' + ms + ' ms (this machine, no cap reached)');
  eq(sc.considered, 600); eq(sc.partial, false, 'the tick scores every eligible pair of ten issues'); ok(sc.scored < 80000, 'scored ' + sc.scored);
  const x = (await build(true)).w; const t1 = Date.now(); const r = await x.pass(); const ms1 = Date.now() - t1; const last = x.kvj('narr_merge_last');
  console.log('       M13: one issue: the tick scored ' + r.scored + ' of 179700 pairs (cap ' + r.pairCap + ') in ' + ms1 + ' ms');
  eq([r.partial, r.scored, r.pairCap], [true, 80000, 80000], 'the tick stops at its cap'); eq([last.partial, last.scored, last.pairCap], [true, 80000, 80000], 'recorded in narr_merge_last');
  const st = (await x.call('GET', '/narratives/status', null, 'read-key')).body.merge; eq([st.partial, st.scored, st.pairCap], [true, 80000, 80000], 'and in status');
  const d = await x.dry(); eq([d.partial, d.scored], [false, 179700], 'the dry route scores every pair');
  x.env.NARRATIVE_MERGE_PAIRS = '20000'; eq((await x.pass()).scored, 20000, 'NARRATIVE_MERGE_PAIRS moves the cap');
});

await S.t('M14 look-alikes of the census shapes: the default clause\'s outcome, pinned', async () => {
  const w = await mk(); w.bg();
  const base = { 0: Math.sqrt(0.128), 10: Math.sqrt(0.653) };
  const A = w.mkN({ id: 'nlaBody', vec: V(Object.assign({ 11: Math.sqrt(0.099) }, base)), label: 'Corvale Water overcharged households through a faulty meter upgrade', claim: 'Corvale Water overcharged 18,000 households through faulty meters.', counter: 'The authority is refunding every customer.', rows: Array.from({ length: 30 }, (_, i) => [LEDES[i % 12][0], LEDES[i % 12][1], 20 - i * 0.5, 'news', 'valleypost', { comments: [0, 1, 3, 4, 9, 10].indexOf(i) >= 0 ? 40 - i : 0 }]) }).id;
  const G = w.mkN({ id: 'nlaGen', vec: V(Object.assign({ 12: Math.sqrt(0.06), 70: 0.05 }, base)), rows: GEN.map((t, i) => [t, '', 30 - i * 0.4]) }).id;
  const N = w.mkN({ id: 'nlaNamed', vec: V(Object.assign({ 12: Math.sqrt(0.06), 71: 0.05 }, base)), entities: ['venn'], rows: NAMED.map((t, i) => [t, '', 27 - i * 0.4]) }).id;
  const Fo = w.mkN({ id: 'nlaForum', scope: 'politics', vec: V({ 0: Math.sqrt(0.10), 10: Math.sqrt(0.40), 54: Math.sqrt(0.40) }), rows: ['Valley Talk: the water meter thing was planned all along reactions comments img', 'Valley Talk: Corvale meters a stunt? reactions comments img', 'Valley Talk: meters stunt theory reactions comments img'].map((t, i) => [t, '@kel99 posted thread share', 10 - i, 'forum', 'valleytalk']) }).id;
  const X = w.mkN({ id: 'nlaCopy', ns: 'cmm', vec: V(Object.assign({ 11: Math.sqrt(0.099), 72: 0.05 }, base)), rows: LEDES.slice(0, 4).map(([t, b], i) => [t, b, 18 - i]) }).id;
  await w.recount(); w.mode('auto');
  const d = await w.dry(); const g = id => w.pairOf(d, A, id);
  eq([!!(g(G) && g(G).auto), !!(g(N) && g(N).auto)], [true, true], 'the generic and the named headline clusters merge by themselves: ' + JSON.stringify([g(G), g(N)].map(p => p && { c: p.c, sAuto: p.sAuto, hold: p.hold })));
  ok(!g(Fo) || g(Fo).auto === false, 'the forum cluster of politics scope is never automatic (a person\'s call)');
  ok(g(X) && g(X).auto === false && g(X).hold.indexOf('clients') >= 0, 'the cross-client copy is held (Q1 unanswered)');
  const r = await w.pass(); eq(r.applied.map(x => x.from).sort(), [G, N].sort());
});

await S.t('M15 (F, review) a chain never puts a narrative where its direct pair could not go: a client story an unnamed one absorbed stays out of a politics narrative', async () => {
  const w = await mk(); w.bg(); const t = twinTitles(2, 6, 0); const rows = (n, base, age) => Array.from({ length: n }, (_, i) => [t[(i + base) % 6], '', age - i * 0.3]);
  const T = w.mkN({ id: 'nchainT', vec: V({ 42: 1 }), label: 'Ardmore level crossing smash, as politics tells it', scope: 'politics', rows: rows(12, 0, 12) }).id;
  const S1 = w.mkN({ id: 'nchainS', vec: V({ 42: 0.97, 25: Math.sqrt(1 - 0.9409) }), rows: rows(5, 2, 10) }).id;
  const X = w.mkN({ id: 'nchainX', vec: V({ 42: 0.97, 26: Math.sqrt(1 - 0.9409) }), label: 'Ardmore level crossing smash, as the client tells it', scope: 'client', rows: rows(3, 4, 9) }).id;
  await w.recount(); const xItems = w.items(X); w.mode('auto');
  ok(w.pairOf(await w.dry(), T, X).hold.indexOf('scope') >= 0, 'the direct pair is held on scope');
  w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now(), T);   // a naming claim holds T this tick
  const r1 = await w.pass(); eq(r1.applied.map(a => a.from + '>' + a.into), [X + '>' + S1], 'X joins the unnamed S');
  w.db.prepare('UPDATE narratives SET label_try_ts=0 WHERE id=?').run(T);
  const r2 = await w.pass(); eq(r2.applied.length, 0, 'S, holding X\'s client rows, does not join the politics T: ' + JSON.stringify(r2.applied));
  const p = w.pairOf(await w.dry(), T, S1); ok(p && p.hold.indexOf('member') >= 0 && /scope/.test(p.memberWhy || ''), JSON.stringify(p && { hold: p.hold, why: p.memberWhy }));
  ok(xItems.every(i => w.of(i) !== T), 'no client row in the politics narrative');
});

await S.t('M16 (F, review) a counter pair written between the apply\'s read and its batch stops the merge', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); w.mode('auto');
  const db = w.env.MIND_DB; const real = db.batch.bind(db); let fired = false;
  db.batch = async stmts => { if (!fired && stmts[0] && /^INSERT INTO narrative_merges/.test(stmts[0].sql)) { fired = true; w.db.prepare('UPDATE narratives SET counter=? WHERE id=?').run(B, A); w.db.prepare('UPDATE narratives SET counter=? WHERE id=?').run(A, B); } return real(stmts); };
  const r = await w.pass(); db.batch = real;
  ok(fired, 'the interleaving happened'); eq(r.applied.length, 0, JSON.stringify(r.applied)); eq(w.merges().length, 0); eq([w.nOf(A).counter, w.nOf(B).counter], [B, A], 'the pointers stand');
});

await S.t('M17 (F, review) a keep-apart is never dropped by a cap: past 2,000 newer keep rows the oldest still holds; keeps on narratives gone for good are retired', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  w.db.prepare("INSERT INTO narrative_keep(id,a,b,why,merge,who,note,at) VALUES('koldest',?,?,'person','','Anne','two stories',?)").run(A, B, Date.now() - 30 * 86400000);
  const ins = w.db.prepare("INSERT INTO narrative_keep(id,a,b,why,merge,who,note,at) VALUES(?,?,?,'person','','Anne','',?)");
  for (let i = 0; i < 2000; i++) ins.run('kdead' + i, 'ngone' + i, 'ngone' + i + 'x', Date.now() - 86400000 + i);
  w.mode('auto'); const p = w.pairOf(await w.dry(), A, B); ok(p && p.hold.indexOf('kept') >= 0, JSON.stringify(p && p.hold));
  eq((await w.pass()).applied.length, 0, 'not merged'); eq(w.merges().length, 0);
  await w.place(200); eq(w.db.prepare('SELECT COUNT(*) n FROM narrative_keep WHERE undone_at=0').get().n, 1, 'the 2,000 on narratives that are gone for good are retired; the live one stays');
  eq(w.db.prepare("SELECT undone_by FROM narrative_keep WHERE id='kdead7'").get().undone_by, 'retired');
});

await S.t('M18 (F, review) narr_merge_last keeps the true count and a slim list that fits, never the 30-item fallback; holds are counted by kind', async () => {
  const w = await mk(); w.bg();
  // fourteen narratives on one twin story: every pair is proposed by the centroid rule (91 pairs)
  for (let i = 0; i < 14; i++) w.mkN({ id: 'nfam' + String(i).padStart(2, '0'), vec: V({ 40: 0.97, [60 + i]: Math.sqrt(1 - 0.9409) }), rows: twinTitles(0, 3, i).map((t, j) => [t, '', 10 - j * 0.3 - i * 0.01]) });
  await w.recount(); const r = await w.pass(); const last = w.kvj('narr_merge_last');
  ok(r.proposals >= 80, 'proposals ' + r.proposals); eq(last.proposalsN, r.proposals, 'the true count');
  ok(!last._truncated && last.proposals.length >= Math.min(r.proposals, 80), 'a slim list that fits: ' + last.proposals.length + ' kept, ' + JSON.stringify(last).length + ' chars');
  const q = last.proposals[0]; ok(q.into.id && q.from.id && typeof q.c === 'number' && 'h2' in q && q.rule && Array.isArray(q.hold), JSON.stringify(q));
  eq((await w.call('GET', '/narratives/status', null, 'read-key')).body.merge.proposals, r.proposals, 'status says the true count');
  ok(last.held && typeof last.held === 'object', 'holds by kind: ' + JSON.stringify(last.held));
});

await S.t('M19 (F, review) the owner\'s list puts a words-only proposal that one shared row carries (H2 under 0.1) after the rest', async () => {
  const w = await mk(); w.bg();
  const live = 'Live: Thornbury pledges new clinics as Ashdown promises school buses';
  w.mkN({ id: 'nrank1', issues: ['vicelection'], ns: 'vicnats', vec: V({ 57: Math.sqrt(0.8), 55: Math.sqrt(0.2) }), rows: [[live, '', 9.5, 'news', 'valleypost', { comments: 90 }], ['Thornbury pledges three new clinics for the outer suburbs', '', 9], ['New clinics pledge: Thornbury promises shorter waits', '', 8.5], ['Thornbury clinics pledge costed at $120 million', '', 8]] });
  w.mkN({ id: 'nrank2', issues: ['vicelection'], ns: 'vicnats', vec: V({ 57: Math.sqrt(0.8), 56: Math.sqrt(0.2) }), rows: [[live, '', 9.4, 'news', 'northernstar', { comments: 80 }], ['Ashdown promises free school buses for country students', '', 9], ['Free school buses pledge: Ashdown targets country families', '', 8.5]] });
  const [A, B] = w.twins(3, { cb: 0.7 }); await w.recount();
  const d = await w.dry(); const ix = (a, b) => d.proposals.findIndex(p => [p.into.id, p.from.id].sort().join() === [a, b].sort().join());
  const weak = d.proposals[ix('nrank1', 'nrank2')], strong = d.proposals[ix(A, B)];
  ok(weak && strong && weak.rule === 'words' && strong.rule === 'words' && weak.parts.h2 < 0.1 && strong.parts.h2 >= 0.1 && weak.c > strong.c, JSON.stringify([weak, strong].map(p => p && { rule: p.rule, c: p.c, s: p.s, h2: p.parts.h2 })));
  ok(ix(A, B) < ix('nrank1', 'nrank2'), 'the twins (c ' + strong.c + ') are listed before the live-blog pair (c ' + weak.c + ')');
});

// ================================================================ Undo
const snapRow = r => { const o = Object.assign({}, r); delete o.updated; delete o.label_try_ts; return o; };
await S.t('U1 (F) undo restores the absorbed row column for column and the survivor\'s figures', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0, { B: { alerted: 2, alertTs: Date.now() - 5 * H } }); await w.recount();
  w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now() - 10 * 60000, B);
  const a0 = w.nOf(A), b0 = w.nOf(B), bItems = w.items(B);
  const ap = await w.post({ apply: [{ into: A, from: B }] }); eq(ap.status, 200, ap.text); const m = ap.body.results[0].merge; ok(m);
  const u = await w.post({ undo: m }); eq(u.status, 200, u.text); eq(u.body.restored.id, B);
  const b1 = w.nOf(B); eq(snapRow(b1), Object.assign(snapRow(b0), { alerted: 2, alert_ts: b0.alert_ts }), 'column for column'); eq(b1.label_try_ts, 0);
  eq(w.items(B), bItems, 'exactly its rows'); const a1 = w.nOf(A);
  for (const k of ['n', 'first_ts', 'terms', 'issue_counts', 'centroid', 'entities', 'label', 'auto_label']) eq(a1[k], a0[k], 'survivor ' + k);
});

await S.t('U2 a row that joined the survivor after the merge stays; joinedSince counts it', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  const m = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge;
  const late = w.put(twinTitles(0, 1, 5)[0], '', 1); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','valleypost',0.9)").run(late, A, Date.now() - H);
  const u = await w.post({ undo: m }); eq(u.body.joinedSince, 1); eq(w.of(late), A); ok(/joined/.test(u.body.note), u.body.note);
});

await S.t('U3 (F) a person\'s carry and a later edit: undo keeps the person\'s group; without the edit it returns the pre-merge group', async () => {
  const build = async () => { const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); named(w, A, 'The model named the Glenmore fire', 'A claim by the model.', 'A counter by the model.');
    eq((await w.call('POST', '/narratives/update', { id: B, label: 'A person named the Glenmore fire', summary: 'A person wrote this.', claim: 'A person claim.', counter_claim: 'A person counter.', issues: ['gov'], pinned: true }, 'kai-full-key')).status, 200); return { w, A, B }; };
  const { w, A, B } = await build(); const a0 = w.nOf(A);
  const ap = await w.post({ apply: [{ into: A, from: B }] }); const m = ap.body.results[0].merge; const a1 = w.nOf(A);
  eq([a1.label, a1.claim, a1.edited, a1.pinned, JSON.parse(a1.issues), a1.ns, a1.person_by], ['A person named the Glenmore fire', 'A person claim.', 1, 1, ['gov'], 'cmm', 'Anne'], 'the person\'s text is carried');
  await w.call('POST', '/narratives/update', { id: A, label: 'Edited after the merge' }, 'full-key');
  await w.post({ undo: m }); const a2 = w.nOf(A);
  eq([a2.label, a2.summary, a2.claim, a2.counter_claim, a2.edited, a2.pinned, JSON.parse(a2.issues)], ['Edited after the merge', 'A person wrote this.', 'A person claim.', 'A person counter.', 1, 1, ['gov']], 'the person\'s group stands');
  w.mode('auto'); await w.pass(); eq(w.merges().filter(x => !x.undone_at).length, 0, 'the next auto tick leaves it alone'); ok(w.pairOf(await w.dry(), A, B).hold.indexOf('person') >= 0);
  const x = await build(); const b0 = x.w.nOf(x.A); const m2 = (await x.w.post({ apply: [{ into: x.A, from: x.B }] })).body.results[0].merge; await x.w.post({ undo: m2 }); const b2 = x.w.nOf(x.A);
  for (const k of ['label', 'summary', 'claim', 'counter_claim', 'proponents', 'issues', 'ns', 'edited', 'pinned', 'scope']) eq(b2[k], b0[k], 'back to the pre-merge ' + k);
  ok(a0.label === 'The model named the Glenmore fire');
});

await S.t('U4 a second undo answers 409 already_undone; two undos sent together change things once', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  const m = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge;
  w.slowReads(10); const [x, y] = await Promise.all([w.post({ undo: m }), w.post({ undo: m })]); w.slowReads(0);
  eq([x.status, y.status].sort(), [200, 409]); eq((x.status === 409 ? x : y).body.error, 'already_undone');
  eq(w.db.prepare("SELECT COUNT(*) n FROM narrative_keep WHERE merge=?").get(m).n, 1, 'one keep-apart'); eq(w.items(B).length, 3);
  eq((await w.post({ undo: m })).body.error, 'already_undone');
});

await S.t('U5 undo of a merge whose survivor was absorbed later answers 409 naming that merge; undo it, then the first undoes', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); const C = w.mkN({ id: 'nbigger', vec: V({ 40: 0.97, 28: Math.sqrt(1 - 0.9409) }), rows: twinTitles(0, 12, 1).map((t, i) => [t, '', 11 - i * 0.5]) }).id; await w.recount();
  const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; const m2 = (await w.post({ apply: [{ into: C, from: A }] })).body.results[0].merge;
  const u = await w.post({ undo: m1 }); eq([u.status, u.body.error], [409, 'survivor_merged']); ok(u.body.detail.indexOf(m2) >= 0, u.body.detail);
  eq((await w.post({ undo: m2 })).status, 200); eq((await w.post({ undo: m1 })).status, 200); ok(w.nOf(A) && w.nOf(B) && w.nOf(C));
});

await S.t('U6 (F) undo returns an inherited alert to the survivor\'s own and keeps an alert sent after the merge', async () => {
  const w = await mk(); w.bg(); const t1 = Date.now() - 6 * H; const [A, B] = w.twins(0, { B: { alerted: 1, alertTs: t1 } }); await w.recount();
  const m = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; eq([w.nOf(A).alerted, w.nOf(A).alert_ts], [1, t1], 'inherited');
  await w.post({ undo: m }); eq([w.nOf(A).alerted, w.nOf(A).alert_ts], [0, 0], 'back to its own'); eq([w.nOf(B).alerted, w.nOf(B).alert_ts], [1, t1], 'the restored one keeps its own');
  const x = await mk(); x.bg(); const [C, D] = x.twins(1, { B: { alerted: 1, alertTs: t1 } }); await x.recount();
  const m2 = (await x.post({ apply: [{ into: C, from: D }] })).body.results[0].merge; const t2 = Date.now() - H; x.db.prepare('UPDATE narratives SET alerted=1, alert_ts=? WHERE id=?').run(t2, C);
  await x.post({ undo: m2 }); eq([x.nOf(C).alerted, x.nOf(C).alert_ts], [1, t2], 'a post after the merge stays');
});

await S.t('U7 two merges into one young survivor undone in either order', async () => {
  const run = async (order, cAlert) => { const w = await mk(); w.bg(); const t = twinTitles(2, 6, 0);
    const A = w.mkN({ id: 'nyA', vec: V({ 42: 1 }), rows: t.slice(0, 4).map((s, i) => [s, '', 12 - i]) }).id; const B = w.mkN({ id: 'nyB', vec: V({ 42: 0.96, 24: 0.28 }), rows: t.slice(2, 5).map((s, i) => [s, '', 9 - i]) }).id;
    const C = w.mkN({ id: 'nyC', vec: V({ 42: 0.95, 25: Math.sqrt(1 - 0.9025) }), alerted: cAlert ? 1 : 0, alertTs: cAlert ? Date.now() - 4 * H : 0, rows: t.slice(4, 6).map((s, i) => [s, '', 13 + i]) }).id; await w.recount();
    const a0 = w.nOf(A), rows0 = w.items(A);
    const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; const m2 = (await w.post({ apply: [{ into: A, from: C }] })).body.results[0].merge;
    if (order === 'latest') { await w.post({ undo: m2 }); await w.post({ undo: m1 }); }
    else { eq((await w.post({ undo: m1 })).status, 200); const r2 = w.db.prepare('SELECT into_after FROM narrative_merges WHERE id=?').get(m2); const ia = JSON.parse(r2.into_after); ok(!('terms' in ia) && (!('centroid' in ia) || ia.centroid === w.nOf(A).centroid), 'the later record is rebased (review: a centroid rebuilt from the weights is the survivor\'s own now)'); if (cAlert) eq(w.nOf(A).alerted, 1, 'C\'s alert survives the earlier undo'); eq((await w.post({ undo: m2 })).status, 200); }
    const a1 = w.nOf(A); eq(w.items(A), rows0); for (const k of ['n', 'issue_counts', 'alerted', 'alert_ts', 'first_item', 'first_platform', 'first_channel', 'label', 'edited', 'pinned']) eq(a1[k], a0[k], order + ' ' + k);
    ok(cosv(unb64(a1.centroid), unb64(a0.centroid)) >= 0.9999, 'centroid'); const top = x => Object.keys(JSON.parse(x)).slice(0, 10).sort();
    if (order === 'latest') eq(a1.terms, a0.terms, 'terms exact'); else eq(top(a1.terms), top(a0.terms), 'terms agree on the top 10'); };
  await run('latest'); await run('earliest'); await run('earliest', true);
});

await S.t('U7b (F, review) two person merges into one survivor that carry a name and a pin, undone earliest first: each undo replays the later carry, both leave it as it was', async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const variant of ['name, then pin', 'pin, then name']) {
    const w = await mk(); w.bg(); const t = twinTitles(0, 6, 0);
    const A = w.mkN({ id: 'nucA', vec: V({ 40: 1 }), label: 'The model named A', scope: 'client', rows: [[t[0], '', 10], [t[1], '', 9.5], [t[2], '', 9]] }).id;
    const B = w.mkN({ id: 'nucB', vec: V({ 40: 0.96, 23: 0.28 }), rows: [[t[3], '', 8], [t[4], '', 7.5]] }).id;
    const C = w.mkN({ id: 'nucC', vec: V({ 40: 0.95, 24: 0.31 }), rows: [[t[5], '', 7], [t[0], '', 6.5]] }).id;
    await w.recount();
    const nameB = variant === 'name, then pin';
    await w.call('POST', '/narratives/update', Object.assign({ id: nameB ? B : C }, { label: 'A person named it', summary: 'A person wrote this.', claim: 'A person claim.' }), 'kai-full-key');
    await w.call('POST', '/narratives/update', { id: nameB ? C : B, pinned: true }, 'kai-full-key');
    const a0 = w.nOf(A); const ks = ['label', 'summary', 'claim', 'counter_claim', 'proponents', 'edited', 'pinned', 'person_ts', 'person_by', 'issues', 'ns', 'scope', 'labelled_n', 'model'];
    const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; await sleep(3);
    const m2 = (await w.post({ apply: [{ into: A, from: C }] })).body.results[0].merge;
    const mid0 = w.nOf(A); eq([mid0.label, mid0.edited, mid0.pinned], ['A person named it', 1, 1], variant + ': both carried');
    const u1 = await w.post({ undo: m1 }); eq(u1.status, 200, u1.text); ok(!/a person edited/.test(u1.body.note), 'no person edited A: ' + u1.body.note);
    const mid = w.nOf(A);
    if (nameB) eq([mid.label, mid.edited, mid.pinned], [a0.label, 0, 1], 'B\'s name goes back with B; C\'s pin stays');
    else eq([mid.label, mid.edited, mid.pinned], ['A person named it', 1, 0], 'B\'s pin goes back with B; C\'s name stays');
    eq(w.nOf(B).label, nameB ? 'A person named it' : '', 'B is restored as it was');
    eq((await w.post({ undo: m2 })).status, 200); const a1 = w.nOf(A);
    for (const k of ks) eq(a1[k], a0[k], variant + ' ' + k);
  }
});

await S.t('U7c (F, review) two merges that take a young survivor past 20 rows, undone earliest first: rebuilt exactly from the logged weights; when a row moved it between them, both undos leave it and say so', async () => {
  const run = async moved => {
    const w = await mk(); w.bg(); const t = twinTitles(1, 6, 0); const rows = (n, base) => Array.from({ length: n }, (_, i) => [t[(i + base) % 6], '', 10 - i * 0.2]);
    const A = w.mkN({ id: 'nfzA', vec: V({ 41: 1 }), rows: rows(10, 0) }).id; const B = w.mkN({ id: 'nfzB', vec: V({ 41: 0, 23: 1 }), rows: rows(5, 2) }).id; const C = w.mkN({ id: 'nfzC', vec: V({ 41: 0, 24: 1 }), rows: rows(8, 4) }).id;
    await w.recount(); const a0 = unb64(w.nOf(A).centroid);
    const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge;
    if (moved) { const c = unb64(w.nOf(A).centroid).map((x, i) => x + (i === 30 ? 0.05 : 0)); w.db.prepare('UPDATE narratives SET centroid=?, updated=? WHERE id=?').run(b64(c), Date.now(), A); }   // as a placed row moves it
    const m2 = (await w.post({ apply: [{ into: A, from: C }] })).body.results[0].merge;
    const mixed = unb64(w.nOf(A).centroid); eq(w.items(A).length, 23);
    const u1 = await w.post({ undo: m1 }); eq(u1.status, 200, u1.text); const u2 = await w.post({ undo: m2 }); eq(u2.status, 200, u2.text); eq(w.items(A).length, 10);
    return { u1: u1.body.note, u2: u2.body.note, final: unb64(w.nOf(A).centroid), a0, mixed }; };
  const x = await run(false); ok(/rebuilt from the logged weights/.test(x.u1), x.u1); ok(cosv(x.final, x.a0) > 0.9999, 'exact: back to its own centroid (' + cosv(x.final, x.a0) + ')');
  const y = await run(true); ok(/centroid left/.test(y.u1), y.u1);
  ok(/centroid left/.test(y.u2) && !/un-mixed/.test(y.u2), 'never un-mixed by counts after a step that left it: ' + y.u2); ok(cosv(y.final, y.mixed) > 0.99999, 'left as it stood');
});

await S.t('U8 (F) merge, a model rename of the survivor (doubling), undo: the name is back to its pre-merge values', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0, { na: 4, nb: 4 }); await w.recount(); named(w, A, 'Glenmore ferry terminal fire forces closure', 'A claim.', '');
  w.db.prepare("UPDATE narratives SET scope='client', relevance=3 WHERE id=?").run(A); const a0 = w.nOf(A);
  const m = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge;
  w.namer = ns => ({ clusters: ns.map(n => ({ n, label: 'A blended name after the merge', summary: 's', claim: 'c', counter: '', proponents: 'p', issues: ['gov'], scope: 'politics', relevance: 2, why: 'w' })) });
  const nm = await w.call('POST', '/narratives/step', { what: 'name' }, 'full-key'); eq(nm.status, 200); eq(w.nOf(A).label, 'A blended name after the merge');
  await w.post({ undo: m }); const a1 = w.nOf(A);
  for (const k of ['label', 'scope', 'issues', 'labelled_n', 'relevance', 'claim']) eq(a1[k], a0[k], k);
});

await S.t('U9 (F) an undone pair stays apart: auto ticks merge nothing new; a person\'s keep likewise; unkeep lifts it', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); const [C, D] = w.twins(1); await w.recount();
  eq((await w.post({ keep: [{ a: C, b: D, note: 'different stories' }] })).status, 200);
  w.mode('auto'); const r1 = await w.pass(); eq(r1.applied.map(x => x.from), [B]); await w.post({ undo: r1.applied[0].merge });
  await w.pass(); await w.pass(); eq(w.merges().length, 1, 'no new merge row');
  const d = await w.dry(); ok(w.pairOf(d, A, B).hold.indexOf('undone') >= 0); ok(w.pairOf(d, C, D).hold.indexOf('kept') >= 0);
  const keep = w.db.prepare("SELECT id FROM narrative_keep WHERE why='person'").get().id; eq((await w.post({ unkeep: keep })).status, 200);
  const r2 = await w.pass(); eq(r2.applied.map(x => x.from), [D], 'the next tick merges');
});

await S.t('U10 three automatic merges undone within 24h pause automatic applies; a person\'s mode post resumes them', async () => {
  const w = await mk(); w.bg(); [0, 1, 2, 3].forEach(k => w.twins(k)); await w.recount(); w.mode('auto');
  w.db.prepare("UPDATE narratives SET label_try_ts=? WHERE id='ntw3b'").run(Date.now());   // the fourth waits out this tick
  const r1 = await w.pass(); eq(r1.applied.length, 3); for (const a of r1.applied) eq((await w.post({ undo: a.merge })).status, 200);
  w.db.prepare("UPDATE narratives SET label_try_ts=0 WHERE id='ntw3b'").run();
  const r2 = await w.pass(); ok(r2.paused, 'paused'); eq(r2.applied.length, 0); const st = (await w.call('GET', '/narratives/status', null, 'read-key')).body; ok(st.merge.paused && st.merge.paused.merges >= 3, JSON.stringify(st.merge));
  const j = await w.run(); ok(/paused/.test(j.result.summary), j.result.summary);
  eq((await w.post({ mode: { merge: 'auto' } })).status, 200); const r3 = await w.pass(); eq(r3.applied.map(x => x.from), ['ntw3b'], 'resumed');
});

// ================================================================ Routes and aliases
await S.t('R1 (F) GET /narratives/merges?dry=1 answers proposals with scores, autoIf and holds and writes nothing; a read key gets 403', async () => {
  const w = await mk(); w.bg(); w.twins(0); w.twins(1, { A: { edited: true, label: 'A person named it' } }); await w.recount();
  const count = () => ['narratives', 'narrative_items'].map(t => w.db.prepare('SELECT COUNT(*) n FROM ' + t).get().n).concat([w.db.prepare('SELECT group_concat(updated) u FROM narratives').get().u, Array.from(w.kv.keys()).sort().join(',')]);
  const before = count(); const d = await w.dry(); eq(count(), before, 'nothing written');
  ok(d.ok && d.proposals.length >= 2 && d.bars && typeof d.bars.cHi === 'number', JSON.stringify(d).slice(0, 300));
  const p = w.pairOf(d, 'ntw0a', 'ntw0b'); ok(p && p.parts && 'u' in p.parts && p.autoIf && p.opposite && Array.isArray(p.hold), JSON.stringify(p));
  ok(w.pairOf(d, 'ntw1a', 'ntw1b').hold.indexOf('person') >= 0);
  eq((await w.call('GET', '/narratives/merges?dry=1', null, 'read-key')).status, 403);
});

await S.t('R2 ?dry=1&pairs= answers features, the pre-filter and verdicts for each listed pair; unknown ids found: false', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  const d = await w.dry('&pairs=' + A + ':' + B + ',' + A + ':nnope'); eq(d.pairs.length, 2);
  const p = d.pairs[0]; ok(p.found && p.prefilter && 'anchor' in p.prefilter && 'gap96' in p.prefilter && p.features && typeof p.features.c === 'number' && 'proposed' in p && 'auto' in p, JSON.stringify(p)); eq(d.pairs[1].found, false);
});

await S.t('R3 POST {apply} applies exactly the listed pairs, refuses with words, carries an edited from, notes what a person overrode', async () => {
  const w = await mk(); w.bg(); const P = [0, 1, 2, 3, 4, 5].map(k => w.twins(k)); await w.recount();
  w.db.prepare('UPDATE narratives SET muted=1 WHERE id=?').run(P[1][1]); w.db.prepare('UPDATE narratives SET counter=? WHERE id=?').run(P[2][1], P[2][0]);
  await w.call('POST', '/narratives/update', { id: P[3][1], label: 'Kai named this', issues: ['gov'] }, 'kai-full-key');
  w.db.prepare("UPDATE narratives SET ns='cmm', scope='off' WHERE id=?").run(P[4][1]);
  const r = await w.post({ apply: [{ into: P[0][0], from: P[0][1] }, { into: P[1][0], from: P[1][1] }, { into: P[2][0], from: P[2][1] }, { into: P[0][0], from: 'nnope' }, { into: P[0][1], from: P[5][1] }, { into: P[3][0], from: P[3][1] }, { into: P[4][0], from: P[4][1] }] });
  eq(r.status, 200, r.text); const res = r.body.results;
  eq(res.map(x => x.ok ? 'ok' : x.status + ' ' + x.error), ['ok', '409 muted', '409 counter', '404 unknown_narrative', '409 merged', 'ok', 'ok']);
  const c = w.nOf(P[3][0]); eq([c.label, JSON.parse(c.issues), c.ns, c.edited], ['Kai named this', ['gov'], 'cmm', 1], 'an edited from carries its label, issues and ns');
  ok(res[5].notes.some(n => /Kai/.test(n)), 'a different editor is noted: ' + JSON.stringify(res[5].notes)); ok(res[6].notes.some(n => /client/.test(n)) && res[6].notes.some(n => /scope|hidden/.test(n)), JSON.stringify(res[6].notes));
  eq((await w.post({ apply: [] })).status, 400); eq((await w.post({ apply: [{ into: 'a', from: 'b' }] }, 'read-key')).status, 403);
});

await S.t('R4 {undo} answers the keep; ?log=1 lists newest first with the undone state, undoable and active keeps', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); const [C, D] = w.twins(1); await w.recount();
  const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; const m2 = (await w.post({ apply: [{ into: C, from: D }] })).body.results[0].merge;
  const u = await w.post({ undo: m1 }); ok(u.body.keep && u.body.keep.id && /unkeep/.test(u.body.note), JSON.stringify(u.body));
  const log = (await w.call('GET', '/narratives/merges?log=1', null, 'full-key')).body; eq(log.merges.map(x => x.merge), [m2, m1]);
  eq([log.merges[0].undoable, log.merges[1].undoable, !!log.merges[1].undoneAt], [true, false, true]); eq(log.keeps.map(k => k.why), ['undone']);
});

await S.t('R5 (F) POST /narratives/merge {into, from} answers as before and now writes an undoable record', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount();
  const r = await w.call('POST', '/narratives/merge', { into: A, from: B }, 'full-key'); eq(r.status, 200); eq([r.body.ok, r.body.into, r.body.from, r.body.narrative.n], [true, A, B, 8]); ok(r.body.merge);
  const m = w.merges(); eq(m.length, 1); eq([m[0].how, m[0].who], ['person', 'Anne']); eq((await w.post({ undo: r.body.merge })).status, 200); ok(w.nOf(B));
  eq((await w.call('POST', '/narratives/merge', { into: A, from: A }, 'full-key')).status, 400);
});

await S.t('R6 (F) /narratives/one on an absorbed id answers the survivor through a chain; after an undo the restored one; /update answers 409 merged', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); const C = w.mkN({ id: 'nchainC', vec: V({ 40: 0.97, 28: Math.sqrt(1 - 0.9409) }), rows: twinTitles(0, 12, 1).map((t, i) => [t, '', 11 - i * 0.5]) }).id; await w.recount();
  const m1 = (await w.post({ apply: [{ into: A, from: B }] })).body.results[0].merge; await w.post({ apply: [{ into: C, from: A }] });
  const one = await w.call('GET', '/narratives/one?id=' + B, null, 'read-key'); eq(one.status, 200); eq(one.body.id, C); eq(one.body.mergedFrom.id, B); eq(one.body.mergedFrom.chain.length, 2); eq(one.body.mergedFrom.merge, m1);
  const up = await w.call('POST', '/narratives/update', { id: B, label: 'x' }, 'full-key'); eq([up.status, up.body.error, up.body.into], [409, 'merged', C]);
  const m2 = w.merges().find(m => m.from_id === A).id; await w.post({ undo: m2 }); await w.post({ undo: m1 });
  const back = await w.call('GET', '/narratives/one?id=' + B, null, 'read-key'); eq(back.status, 200); eq(back.body.id, B); ok(!back.body.mergedFrom);
});

await S.t('R7 the survivor\'s /one lists its merges; after a full reset an absorbed id answers 404 merged_then_dissolved', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); await w.post({ apply: [{ into: A, from: B }] });
  const one = (await w.call('GET', '/narratives/one?id=' + A, null, 'read-key')).body; eq(one.merges.map(m => m.from), [B]);
  eq((await w.call('POST', '/narratives/reset', { all: true, confirm: 'reset' }, 'full-key')).status, 200);
  const gone = await w.call('GET', '/narratives/one?id=' + B, null, 'read-key'); eq([gone.status, gone.body.error], [404, 'merged_then_dissolved']); ok(gone.body.detail.length > 20);
  eq(w.merges().length, 1, 'the merge record outlives the reset');
});

await S.t('R8 (F) POST {mode} writes KV and narr_mode_log; status shows the source; env removes the override; a clause out of range is a 400', async () => {
  const w = await mk(); const st = async () => (await w.call('GET', '/narratives/status', null, 'read-key')).body.merge;
  let s = await st(); eq([s.mode, s.source, s.near.mode, s.near.source], ['propose', 'default', 'shadow', 'default']);
  const r = await w.post({ mode: { merge: 'auto', clause: { cHi: 0.94, form: 't' }, near: 'on', nearLex: 0.5 } }); eq(r.status, 200, r.text);
  s = await st(); eq([s.mode, s.source, s.clause.cHi, s.clause.form, s.near.mode, s.near.source, s.near.lex], ['auto', 'kv', 0.94, 't', 'on', 'kv', 0.5]);
  const log = (await w.call('GET', '/narratives/merges?log=1&modes=1', null, 'full-key')).body.modes; ok(log.some(x => x.what === 'merge mode' && x.who === 'Anne' && /auto/.test(x.after) && x.before === 'null') && log.some(x => x.what === 'near mode' && /"on"/.test(x.after)), JSON.stringify(log));
  eq((await w.post({ mode: { merge: 'env', near: 'env' } })).status, 200); s = await st(); eq([s.mode, s.source, s.near.source], ['propose', 'default', 'default']);
  const bad = await w.post({ mode: { clause: { cHi: 0.5 } } }); eq(bad.status, 400); ok(/0\.85/.test(bad.body.detail), bad.body.detail);
  eq((await w.post({ mode: { merge: 'sometimes' } })).status, 400); eq((await w.post({ mode: { merge: 'auto' } }, 'read-key')).status, 403);
});

await S.t('R9 GET /narratives/near lists the day\'s records with titles and counts', async () => {
  const w = await mk(); w.bg(); await w.recount(); const A = await worldA(w); w.near('on'); NAMED.slice(0, 2).forEach((t, i) => w.put(t, '', 30 - i)); await w.place(200);
  const r = (await w.call('GET', '/narratives/near', null, 'full-key')).body; ok(r.ok && r.counts.joined >= 1 && r.rows.length >= 1, JSON.stringify(r).slice(0, 300));
  ok(r.rows[0].rowTitle && r.rows[0].narrativeTitle && r.rows[0].narrative === A, JSON.stringify(r.rows[0])); eq(r.mode, 'on');
});

await S.t('R10 (F) Studio\'s narrative source resolves an absorbed id to its survivor', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); named(w, A, 'Glenmore ferry terminal fire forces closure', 'A claim.', ''); await w.post({ apply: [{ into: A, from: B }] });
  await w.call('POST', '/brand/kit', { ns: 'vicnats', name: 'Nats', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'state', name: 's', logoPolicy: 'none' }] }, 'full-key');
  const P = (await w.call('POST', '/studio/project', { ns: 'vicnats', campaign: 'state', title: 'Ferry', brief: { objective: 'o', message: 'm', channels: ['instagram'], deliverable: 'copy', campaignConfirmed: true }, idem: 'nm-r10' }, 'full-key')).body.id; ok(P);
  const r = await w.call('POST', '/studio/source/item', { project: P, type: 'narrative', id: B }, 'full-key'); eq(r.status, 200, r.text);
  const src = w.db.prepare('SELECT provenance FROM studio_sources WHERE id=?').get(r.body.id); eq(src.provenance, 'narrative ' + A + ' (merged from ' + B + ')');
  eq((await w.call('POST', '/studio/source/item', { project: P, type: 'narrative', id: 'nnothing' }, 'full-key')).status, 404);
});

await S.t('R11 /narratives/update writes person_ts and person_by', async () => {
  const w = await mk(); w.bg(); const [A] = w.twins(0); await w.recount(); const t0 = Date.now();
  await w.call('POST', '/narratives/update', { id: A, label: 'Kai wrote this' }, 'kai-full-key'); const a = w.nOf(A); ok(a.person_ts >= t0); eq(a.person_by, 'Kai');
});

await S.t('R12 (F, review) a near undo moves a row only while it is still that near join; a reset retires P1\'s records', async () => {
  const w = await mk(); w.bg(); const t = twinTitles(0, 6, 0);
  // what P1 leaves after a near join in mode on: row R joined nnB (the columns narrativesRun writes)
  w.mkN({ id: 'nnB', vec: V({ 40: 1 }), rows: [[t[0], '', 69], [t[1], '', 69.5]] });
  const R = w.put(t[2], '', 70); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,'nnB',?,'news','valleypost',0.81)").run(R, Date.now() - 70 * H);
  const rec = w.db.prepare("INSERT INTO narrative_near(item,narrative,mode,sim,lex,shared,lean,at,undone_at,undone_by) VALUES(?,?,'on',0.81,0.6,'glenmore ferry',0,?,0,'')");
  rec.run(R, 'nnB', Date.now() - 60 * H);
  eq((await w.call('POST', '/narratives/reset', { all: true, confirm: 'reset' }, 'full-key')).status, 200);
  eq(w.db.prepare('SELECT mode, undone_at FROM narrative_near WHERE item=?').get(R), { mode: 'reset', undone_at: 0 }, 'retired by the reset (and the row stays open to a near join)');
  // the row is placed again by the bar into Q; a near undo of R now has nothing in force
  const Q = w.mkN({ id: 'nnQ', vec: V({ 40: 1 }), rows: [[t[3], '', 68], [t[4], '', 68.5]] }).id; w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','valleypost',0.9)").run(R, Q, Date.now() - 70 * H);
  const q0 = w.nOf(Q).terms; eq((await w.call('POST', '/narratives/near', { undo: R }, 'full-key')).status, 404, 'no near join of R in force');
  // a record still in force whose row a merge or another run moved elsewhere: the undo marks it and leaves the row
  const R2 = w.put(t[5], '', 5); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','valleypost',0.9)").run(R2, Q, Date.now() - 5 * H); rec.run(R2, 'nnGone', Date.now() - 4 * H);
  const u = await w.call('POST', '/narratives/near', { undo: R2 }, 'full-key'); eq(u.status, 200, u.text);
  eq([u.body.undone, u.body.stale, w.of(R2), w.nOf(Q).terms], [0, 1, Q, q0], 'the row stays where it is and Q keeps its words');
  ok(w.db.prepare('SELECT undone_at FROM narrative_near WHERE item=?').get(R2).undone_at > 0, 'the record is closed');
});

await S.t('R13 (F, review) {undo: day} takes at most 100 near joins a call, each chunk in one batch with its words, and says how many remain', async () => {
  const w = await mk(); w.bg(); const N = w.mkN({ id: 'nnear', vec: V({ 40: 1 }), rows: twinTitles(0, 4, 0).map((s, i) => [s, '', 8 - i]) }).id; await w.recount();
  const rec = w.db.prepare("INSERT INTO narrative_near(item,narrative,mode,sim,lex,shared,lean,at,undone_at,undone_by) VALUES(?,?,'on',0.81,0.6,'',0,?,0,'')");
  const ins = w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','valleypost',0.81)");
  const joined = Array.from({ length: 150 }, (_, i) => { const it = w.put('Glenmore ferry terminal fire report number ' + i + ' from the wharf', '', 3); ins.run(it, N, Date.now() - 3 * H); rec.run(it, N, Date.now() - 1000); return it; });   // recorded this Sydney day
  // the terms as the 150 near joins left them: each row's words at 1/sqrt(7) (glenmore ferry terminal fire report number wharf)
  const tv = 150 / Math.sqrt(7); w.db.prepare('UPDATE narratives SET terms=? WHERE id=?').run(JSON.stringify(Object.assign(JSON.parse(w.nOf(N).terms), { wharf: tv, report: tv, number: tv })), N);
  const day = (await w.call('GET', '/narratives/near', null, 'full-key')).body.day;
  const u1 = await w.call('POST', '/narratives/near', { undo: 'day', day }, 'full-key'); eq(u1.status, 200, u1.text); eq([u1.body.undone, u1.body.more], [100, true]);
  const t1 = JSON.parse(w.nOf(N).terms); ok(Math.abs(t1.wharf - 50 / Math.sqrt(7)) < 0.01, 'the chunk\'s words left with its rows: ' + t1.wharf);
  const u2 = await w.call('POST', '/narratives/near', { undo: 'day', day }, 'full-key'); eq([u2.body.undone, u2.body.more], [50, false]);
  ok(!('wharf' in JSON.parse(w.nOf(N).terms)), 'and the rest with theirs');
  eq(joined.filter(x => w.of(x) !== undefined).length, 0, 'all 150 back in the backlog'); eq(w.items(N).length, 4);
});

// ================================================================ Den
async function denWorld(w) {
  const t = ['Export tax on gas debate returns to the Senate', 'Senate debate on a gas export tax resumes', 'Crossbench pushes gas export tax again', 'Gas export tax push returns, crossbench says', 'Senators revive gas export tax debate', 'Gas export tax: Senate to vote next week'];
  const A = w.mkN({ id: 'ndenA', issues: ['gastax'], ns: 'aep', vec: V({ 49: 1 }), rows: t.map((s, i) => [s, '', 18 - i * 2]) }).id;
  const B = w.mkN({ id: 'ndenB', issues: ['gastax'], ns: 'aep', vec: V({ 49: 0.97, 27: Math.sqrt(1 - 0.9409) }), rows: t.slice(0, 2).map((s, i) => [s, '', 5 - i]) }).id;
  await w.recount(); return { A, B };
}
async function denBrief(w, B) {
  const br = (await w.call('POST', '/den/brief/save', { desk: 'aep_au' }, 'full-key')).body.brief;
  const text = 'The Senate returned to the gas export tax this week, with the crossbench pressing the case again and senators reviving the debate ahead of a vote next week [N:' + B + ']. The conversation stayed in the parliament and the press, and the client was not named directly in what was collected.';
  const s = await w.call('POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: text, bottom: 'Activity on the gas export tax is steady and parliamentary [N:' + B + '].' } }, 'full-key'); eq(s.status, 200, s.text);
  ok(s.body.brief.sections.summary.cites.indexOf('N:' + B) >= 0, 'the draft cites B'); return s.body.brief;
}
await S.t('D1 (F) after a person\'s merge of B into A, a draft citing B files without A\'s emerging signal being asked about', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: 'test-anthropic' }); const { A, B } = await denWorld(w); const br = await denBrief(w, B);
  eq((await w.call('POST', '/narratives/merge', { into: A, from: B }, 'full-key')).status, 200);
  const strip = (await w.call('GET', '/den/missed?desk=aep_au', null, 'full-key')).body; ok(strip.signals.some(s => s.key === 'N:' + A), 'A\'s emerging signal is on the strip: ' + JSON.stringify(strip.signals.map(s => s.key)));
  const f = await w.call('POST', '/den/brief/file', { id: br.id, revision: br.revision }, 'full-key');
  ok(f.status === 200 || !(f.body.signals || []).some(s => s.key === 'N:' + A), 'A is covered by the cite of B: ' + f.text.slice(0, 400));
});

await S.t('D2 (F) after an automatic merge, the same draft gets the 409 with A\'s signal and the merge named; acknowledge files it', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: 'test-anthropic' }); const { A, B } = await denWorld(w); const br = await denBrief(w, B);
  w.mode('auto'); const r = await w.pass(); eq(r.applied.map(x => x.from), [B]); const m = r.applied[0].merge;
  const f = await w.call('POST', '/den/brief/file', { id: br.id, revision: br.revision }, 'full-key'); eq([f.status, f.body.error], [409, 'uncited_signals']);
  const sig = f.body.signals.find(s => s.key === 'N:' + A); ok(sig && sig.detail.indexOf(m) >= 0 && /automatically/.test(sig.detail), JSON.stringify(sig));
  const g = await w.call('POST', '/den/brief/file', { id: br.id, revision: br.revision, acknowledge: true }, 'full-key'); eq([g.status, g.body.brief.status], [200, 'filed']);
});

await S.t('D3 /den/board answers aliases {absorbed: survivor}, bounded', async () => {
  const w = await mk(); const { A, B } = await denWorld(w); await w.call('POST', '/narratives/merge', { into: A, from: B }, 'full-key');
  const b = (await w.call('GET', '/den/board?desk=aep_au', null, 'full-key')).body; eq(b.aliases, { [B]: A });
});

// ================================================================ Automation and spend
await S.t('A1 merge mode off: the tick writes no narr_merge_last; the dry route still answers', async () => {
  const w = await mk(); w.bg(); w.twins(0); await w.recount(); w.mode('off');
  const j = await w.run(); eq(j.status, 'done'); eq(w.kvj('narr_merge_last'), null); ok((await w.dry()).ok);
});

await S.t('A2 default: the tick writes narr_merge_last; the run summary carries the merge clause', async () => {
  const w = await mk(); w.bg(); w.twins(0); await w.recount();
  const j = await w.run(); ok(w.kvj('narr_merge_last'), 'written'); ok(/merge pass: \d+ proposals?/.test(j.result.summary), j.result.summary); eq(w.merges().length, 0);
});

await S.t('A3 (F) a held tick with merge auto and near on makes no model call and applies the automatic merge', async () => {
  const w = await mk({ AI_AUTOMATION: 'daily' }); w.bg(); const [A, B] = w.twins(0); await w.recount(); w.mode('auto'); w.near('on');
  const today = new Date(Date.now() + 10 * H).toISOString().slice(0, 10), t11 = new Date(Date.now() + 11 * H).toISOString().slice(0, 10);
  for (const d of [today, t11]) { await w.env.AXIOM_KV.put('ai_cron_day', d); await w.env.AXIOM_KV.put('brief_' + d, JSON.stringify({ day: d, at: Date.now(), brief: { headline: 'already written' } })); }
  const before = w.anth; let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited;
  eq(w.anth - before, 0, 'no model call in a held tick'); const m = w.merges(); eq(m.map(x => [x.into_id, x.from_id, x.how]), [[A, B, 'auto']]);
  const tick = w.kvj('tick_last'); ok(tick && tick.stages.some(s => s[0] === 'narr merge'), JSON.stringify(tick && tick.stages));
  const sg = tick.stages.find(s => s[0] === 'narr merge'); ok(sg[2] && typeof sg[2].scored === 'number' && sg[2].cap === 80000 && sg[2].partial === false, '(review) the stage says the work done, not only the clock: ' + JSON.stringify(sg));
});

await S.t('A4 with the lease held by another holder the pass applies nothing and records busy', async () => {
  const w = await mk(); w.bg(); w.twins(0); await w.recount(); w.mode('auto');
  w.db.prepare("INSERT INTO narr_lease(name,holder,until) VALUES('place','another-run',?)").run(Date.now() + 60000);
  const r = await w.pass(); eq(r.busy, true); eq(r.applied.length, 0); eq(w.merges().length, 0); eq(w.kvj('narr_merge_last').busy, true);
});

await S.t('A5 (F) the cron path: narrativesCron\'s result carries the merges with their undo ids; status lists them', async () => {
  const w = await mk(); w.bg(); const [A, B] = w.twins(0); await w.recount(); w.mode('auto');
  const out = await w.G.narrativesCron(w.env); ok(out.merge && out.merge.applied.length === 1 && out.merge.applied[0].merge, JSON.stringify(out.merge));
  const st = (await w.call('GET', '/narratives/status', null, 'read-key')).body.merge; eq(st.applied24.map(x => [x.merge, x.into, x.from]), [[out.merge.applied[0].merge, A, B]]);
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
