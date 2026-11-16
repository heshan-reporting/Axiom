/* Automatic narrative naming (Anne's Den release, build p67, 16 November 2026), against the worker module in this process.
 * No provider is contacted: Workers AI is a stub whose marker words pick a direction (as tests/narratives-worker.mjs), the
 * model is a stub that names clusters from their samples, and every request to the Anthropic API is counted. Every outlet,
 * account and post here is invented. Each case fails on p66, where a narrative nobody has named reads "A narrative not yet
 * named" on the Den's Board.
 * Layer A, the working title (no model call anywhere in it):
 *   AN1 a fresh narrative has a working title at birth, with zero Anthropic requests
 *   AN2 a two-row narrative (too small for the namer) has one, and the list says it is automatic
 *   AN3 the title is a cleaned member headline: outlet suffix and "Live:" stripped, at most fourteen words; never a
 *       comment's words; a post's own words are never the title (the template stands in)
 *   AN3b nobody unregistered is named: lower case, capitals, a lone name, initials, other scripts, headlines and call
 *       titles all fall back to the template, which prints only words the rows write in plain lower case
 *   AN4 the title does not change until the narrative has doubled
 *   AN5 a model's name wins over the working title (named: 'model')
 *   AN6 a person's name wins over both and survives a run
 *   AN7 a narrative row written without the new columns still has a title on the Board, marked as a working title in
 *       what the draft is given
 *   AN8 with no API key every listed narrative has a title; the stock written before p67 is back-filled by the run
 * Layer B0, the model upgrade inside the day's window (the cap and the window are unchanged):
 *   AN9  the drain names every waiting narrative, not only those that moved this tick, client-issue narratives first,
 *        and stops at the cap
 *   AN10 claim before the call: two drains started together never send the same narrative twice
 *   AN11 three strikes: a cluster the model cannot name is set aside for a day, then tried again
 *   AN12 the window's cron names a narrative that did not move in that tick
 *   AN14 the drain names only narratives active in the last seven days, and one window tick keeps to its share of calls
 * Run: node --experimental-sqlite tests/den-autoname-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Automatic narrative naming: a working title always, a model name in the window');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
function hashVec(text) {
  const v = new Array(64).fill(0); const t = String(text).toLowerCase();
  const axis = /rort|billionaire/.test(t) ? 0 : /regional towns/.test(t) ? 8 : /surplus/.test(t) ? 16 : /harbour levy/.test(t) ? 24 : 32 + (t.length % 20);
  v[axis] = 1; let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  for (let k = 0; k < 6; k++) { v[40 + ((h >> (k * 4)) % 24)] += 0.12; }
  return v;
}
const AI = { run: async (m, { text }) => ({ shape: [text.length, 64], data: (Array.isArray(text) ? text : [text]).map(hashVec) }) };
const H = 3600000, NOW = Date.now();
let seq = 0;
async function mk(env) {
  const w = await workerEnv({ env: Object.assign({ AI, ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
  w.anth = []; w.poison = /never-matches/;
  w.answer(/api\.anthropic\.com/, (u, init) => {
    const b = JSON.parse(init.body); const user = b.messages[0].content; w.anth.push(user);
    if (/monitoring analyst/.test(String(b.system))) { const n = (user.match(/\[N:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0]; return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'A narrative is moving ' + n + '.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 }); }
    if (w.poison.test(user)) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'I cannot answer that.' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }), { status: 200 });
    const clusters = Array.from(user.matchAll(/\[(\d+)\] shared terms: ([^\n]*)\n([\s\S]*?)(?=\n\[\d+\] |$)/g)).map(m => {
      const n = Number(m[1]); const s = m[3];
      const label = /rort|billionaire/i.test(s) ? 'Fuel tax credits are a subsidy for billionaire miners' : /queue (\w+)/i.test(s) ? 'Named queue ' + s.match(/queue (\w+)/i)[1] : 'A named cluster';
      return { n, label, summary: 'Said by posters and some outlets.', claim: 'A claim.', counter: '', proponents: 'posters', issues: ['ftc'], scope: 'client', relevance: 3, why: 'client issue' };
    });
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ clusters }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200 });
  });
  await w.call('GET', '/sentiment/status', null, 'read-key'); await w.call('GET', '/narratives/status', null, 'read-key');
  w.db = w.env.MIND_DB.db;
  w.put = (kind, src, title, body, meta, ago) => { const url = 'https://example.test/' + kind + '/' + (++seq); w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)").run(kind, src, title, body, url, JSON.stringify(meta || {}), NOW - ago, NOW); return w.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };
  w.place = async () => { const r = await w.call('POST', '/narratives/step', { what: 'place', scan: 200 }, 'full-key'); if (r.status !== 200) throw new Error('place: ' + r.text.slice(0, 200)); return r.body; };
  w.list = async q => (await w.call('GET', '/narratives?days=7' + (q || ''), null, 'read-key')).body.narratives;
  w.nOf = id => w.db.prepare('SELECT * FROM narratives WHERE id=?').get(id);
  w.of = itemId => (w.db.prepare('SELECT narrative FROM narrative_items WHERE item=?').get(itemId) || {}).narrative;
  // a narrative written straight into the table, as p66 wrote them (no working-title columns named), with its rows
  w.raw = (id, o) => {
    o = o || {};
    w.db.prepare("INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,issue_counts,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated) VALUES(?,?,'','','','',?,'{}','[]',?,'unknown',?,?,0,0,?,0,'news','pointpost',?,'{}','[]','[]','[]','{}','','steady',0,0,0,0,0,?,'',0,0,'',?,?)")
      .run(id, o.label || '', JSON.stringify(o.issues || ['ftc']), o.ns == null ? 'mca' : o.ns, o.n || 3, o.n24 == null ? 1 : o.n24, NOW - 30 * H, NOW - H, JSON.stringify(o.terms || {}), NOW - 30 * H, o.updated || NOW);
    (o.titles || []).forEach((t, i) => { const it = w.put('news', 'pointpost', t, t + '. More on this story.', { issues: ['ftc'] }, 20 * H - i * H); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','pointpost',0.9)").run(it, id, NOW - 20 * H + i * H); });
  };
  return w;
}
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const RORT = n => 'Fuel tax credit a rort for billionaire miners, critics say again ' + n;

await S.t('AN1 a fresh narrative has a working title at birth, with zero Anthropic requests', async () => {
  const w = await mk();
  const a = w.put('news', 'pointpost', 'Fuel tax credit a rort for billionaire miners, say critics - The Daily Example', 'The diesel rebate hands billions to big miners.', { issues: ['ftc', 'mining'], reg: 1 }, 5 * H);
  const r = await w.place(); eq(r.started, 1, 'one narrative started'); eq(r.namingDeferred, true);
  const n = w.nOf(w.of(a)); ok(n, 'the row seeded a narrative');
  eq(n.auto_label, 'Fuel tax credit a rort for billionaire miners, say critics', 'the headline, its outlet suffix stripped'); eq(n.auto_n, 1); eq(n.label, '', 'label stays the model\'s or a person\'s column');
  const row = (await w.list('&all=1')).find(x => x.id === n.id); eq(row.autoLabel, n.auto_label); eq(row.named, 'auto');
  eq(w.anth.length, 0, 'no model call');
});

await S.t('AN2 a two-row narrative has a title and the list says it is automatic', async () => {
  const w = await mk();
  const a = w.put('news', 'pointpost', RORT(1), 'The diesel rebate hands billions to big miners.', { issues: ['ftc'], reg: 1 }, 6 * H);
  const b = w.put('news', 'harbourtimes', 'Billionaire miners keep a fuel tax rort, Senate told', 'Senators said the rebate is a rort for billionaire miners.', { issues: ['ftc'], reg: 1 }, 4 * H);
  await w.place(); eq(w.of(a), w.of(b), 'the two rows tell one story');
  const n = w.nOf(w.of(a)); eq(n.n, 2); eq(n.label, '', 'two rows: the namer does not look at it (it needs three)');
  ok(n.auto_label && words(n.auto_label) >= 4 && words(n.auto_label) <= 14, 'a working title: ' + n.auto_label);
  const row = (await w.list()).find(x => x.id === n.id); ok(row, 'listed (two rows)'); eq(row.named, 'auto'); eq(row.autoLabel, n.auto_label); eq(row.label, '');
  const st = (await w.call('GET', '/narratives/status', null, 'read-key')).body; eq(st.named, 0, 'named still counts model and person names only'); ok(st.titled >= 1, 'titled counts working titles too: ' + st.titled);
  eq(w.anth.length, 0, 'no model call');
});

await S.t('AN3 the title is a cleaned member headline, at most fourteen words, never a comment, never an unregistered person', async () => {
  const w = await mk(); const G = w.mod.__test;
  eq(G.narrCleanTitle('LIVE: Senate votes on the fuel tax credit tonight | Example News'), 'Senate votes on the fuel tax credit tonight');
  eq(G.narrCleanTitle('Comment on: the fuel tax credit #auspol @someone https://t.co/x'), 'the fuel tax credit');
  eq(G.narrCleanTitle('‘Rort’ claims for “billionaire” miners grow'), "'Rort' claims for billionaire miners grow", 'curly quotes folded, double quotes dropped');
  const long = G.narrCleanTitle('One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen');
  ok(words(long) <= 14 && /fourteen\.\.\.$/.test(long), 'cut at fourteen words: ' + long);
  const terms = { rort: 3, billionaire: 3, miners: 3, fuel: 2, tax: 2, credit: 2 };
  const chosen = G.narrAutoLabel([
    { kind: 'reddit_comment', title: 'Comment on: fuel tax', body: 'Billionaire miners rort the fuel tax credit, a rort for billionaire miners' },
    { kind: 'news', title: 'Budget papers land on Tuesday - Example Post', body: '' },
    { kind: 'news', title: 'Fuel tax credit rort for billionaire miners questioned - Example Post', body: '' },
  ], terms, { issue: 'Fuel tax credits' });
  eq(chosen, 'Fuel tax credit rort for billionaire miners questioned', 'the headline carrying the most of the shared words, never the comment');
  const onlyComments = G.narrAutoLabel([{ kind: 'comments', title: 'Comment on: ad', body: 'A rort for billionaire miners and the fuel tax credit, honestly' }], terms, { issue: 'Fuel tax credits' });
  ok(!/honestly/.test(onlyComments) && /^Fuel tax credits: /.test(onlyComments), 'a comment is never the title; the template is: ' + onlyComments);
  const privatePost = G.narrAutoLabel([{ kind: 'sig_thread', title: 'x post', body: 'Shane Doolan from Ballarat says the fuel tax credit rort must end now.' }], terms, { issue: 'Fuel tax credits', known: ['Minerals Council of Australia'] });
  ok(!/Doolan|Shane/.test(privatePost), 'a post naming somebody not on the register is not used: ' + privatePost);
  const publicPost = G.narrAutoLabel([{ kind: 'sig_thread', title: 'x post', body: 'The fuel tax credit rort for billionaire miners has to end. Sign it.' }], terms, { issue: 'Fuel tax credits' });
  eq(publicPost, 'Fuel tax credits: rort, billionaire, miners, fuel', 'a post\'s own words are never the title (release review): the template stands in');
  const plain = [{ kind: 'sig_thread', title: 'x post', body: 'The rort for billionaire miners and the fuel tax credit goes on.' }];
  const tmpl = G.narrAutoLabel(plain, terms, { names: ['Minerals Council of Australia'], issue: 'Fuel tax credits' });
  ok(/^Minerals Council of Australia on Fuel tax credits: /.test(tmpl) && words(tmpl) <= 14, 'a template from register names, the issue and the shared words: ' + tmpl);
  eq(G.narrAutoLabel([], terms, { names: ['Minerals Council of Australia'], issue: 'Fuel tax credits' }), 'A narrative on Minerals Council of Australia on Fuel tax credits', 'with no rows to show the words are plain, no shared word is printed');
  ok(G.narrAutoLabel([], {}, {}).length > 0, 'never empty');
  // through the run: an outlet suffix is gone on the stored title
  const a = w.put('news', 'pointpost', 'Exclusive: Billionaire miners rort the fuel tax credit, documents show, in a long running scheme the Treasury knew about for years - Example Times', 'x', { issues: ['ftc'], reg: 1 }, 3 * H);
  await w.place(); const t = w.nOf(w.of(a)).auto_label; ok(!/Example Times|Exclusive/.test(t) && words(t) <= 14, 'stored: ' + t);
  eq(w.anth.length, 0, 'no model call');
});

await S.t('AN3b nobody unregistered is named: lower case, capitals, a lone name, initials, other scripts, headlines and transcripts', async () => {
  const w = await mk(); const G = w.mod.__test;
  const known = ['Minerals Council of Australia', 'Harbour Watch'];
  const terms = { fuel: 3, tax: 3, credit: 3, rort: 2, levy: 2, harbour: 2, protest: 2 };
  const ctx = { issue: 'Fuel tax credits', known };
  const NAMES = /shane|doolan|jane|citizen|zo|ngstr|albanese|karen|brien/i;
  const cases = [
    { kind: 'forum', title: 'shane doolan from ballarat is right about the fuel tax rort', body: '' },
    { kind: 'sig_thread', title: 'x post', body: 'SHANE DOOLAN says the fuel tax credit rort must end now.' },
    { kind: 'reddit_thread', title: 'Doolan says the fuel tax credit rort must end', body: '' },
    { kind: 'news', title: 'Doolan says the fuel tax credit rort must end - Example Post', body: '' },
    { kind: 'news', title: 'Zo\u00eb \u00c5ngstr\u00f6m says the fuel tax credit is a rort - Example Post', body: '' },
    { kind: 'transcript', title: 'Caller Shane Doolan on the fuel tax credit rort and his farm', body: '' },
    { kind: 'news', title: 'Shane from Ballarat on the fuel tax credit and the harbour levy', body: '' },
    { kind: 'news', title: 'My neighbour J. Doolan lost the farm to the fuel tax credit', body: '' },
    { kind: 'sig_thread', title: 'x post', body: 'jane citizen says the harbour levy protest is on.' },
    { kind: 'sig_thread', title: 'x post', body: 'Shane says the harbour levy protest is on Saturday.' },
    { kind: 'news', title: 'Mother of three Jane Citizen leads harbour levy protest - The Daily Example', body: '' },
    { kind: 'news', title: 'Harbour levy protest organiser Shane Doolan arrested - Example Post', body: '' },
    { kind: 'news', title: 'Dr Jane Citizen: the fuel tax credit has to go - Example Post', body: '' },
    { kind: 'news', title: 'Karen O\'Brien leads the fuel tax credit fight - Example Post', body: '' },
    { kind: 'sig_thread', title: 'x post', body: 'Albanese is a liar and a traitor on the fuel tax credit.' },
    { kind: 'news', title: 'FUEL TAX CREDIT ROW: DOOLAN SPEAKS OUT', body: '' },
  ];
  cases.forEach(r => { const t = G.narrAutoLabel([r], terms, ctx); ok(!NAMES.test(t), r.kind + ' "' + (r.title === 'x post' ? r.body : r.title) + '" gave: ' + t); });
  // the template never prints a surname that dominates the shared words, cased or not
  const surname = G.narrAutoLabel([
    { kind: 'sig_thread', title: 'x post', body: 'Petition from Shane Doolan in Ballarat on the fuel tax credit is growing.' },
    { kind: 'sig_thread', title: 'x post', body: 'shane doolan petition ballarat fuel tax' },
    { kind: 'comments', title: 'Comment on: x', body: 'Doolan is right, sign the Doolan petition' },
  ], { shane: 5, doolan: 5, petition: 4, ballarat: 3, fuel: 2 }, ctx);
  ok(!/shane|doolan|ballarat/i.test(surname) && /^Fuel tax credits/.test(surname), 'the template keeps only plainly written words: ' + surname);
  // a register name and an institution are fine in a headline
  eq(G.narrAutoLabel([{ kind: 'news', title: 'Minerals Council of Australia defends the fuel tax credit in the Senate - Example Post', body: '' }], terms, ctx),
    'Minerals Council of Australia defends the fuel tax credit in the Senate', 'register names and institutions pass');
});

await S.t('AN4 the title does not change until the narrative has doubled', async () => {
  const w = await mk();
  const a = w.put('news', 'pointpost', RORT(1), 'The diesel rebate is a rort for billionaire miners.', { issues: ['ftc'], reg: 1 }, 9 * H);
  w.put('news', 'harbourtimes', RORT(2), 'Another rort story about billionaire miners.', { issues: ['ftc'], reg: 1 }, 8 * H);
  await w.place(); const id = w.of(a); eq(w.nOf(id).n, 2); eq(w.nOf(id).auto_n, 2);
  w.db.prepare("UPDATE narratives SET auto_label='Held working title for the rort' WHERE id=?").run(id);
  w.put('news', 'eastcoast', 'Billionaire miners rort story three, the fuel tax credit again', 'rort billionaire miners', { issues: ['ftc'], reg: 1 }, 6 * H);
  await w.place(); eq(w.nOf(id).n, 3); eq(w.nOf(id).auto_label, 'Held working title for the rort', 'three rows is not double two: unchanged');
  w.put('news', 'westcoast', 'Billionaire miners rort story four, the fuel tax credit again', 'rort billionaire miners', { issues: ['ftc'], reg: 1 }, 5 * H);
  await w.place(); const n = w.nOf(id); eq(n.n, 4); ok(n.auto_label !== 'Held working title for the rort' && words(n.auto_label) >= 4, 'doubled: recomputed: ' + n.auto_label); eq(n.auto_n, 4);
  eq(w.anth.length, 0, 'no model call');
});

await S.t('AN5 a model\'s name wins over the working title', async () => {
  const w = await mk();
  const a = w.put('news', 'pointpost', RORT(1), 'The diesel rebate is a rort for billionaire miners.', { issues: ['ftc'], reg: 1 }, 9 * H);
  [2, 3].forEach(i => w.put('news', 'outlet' + i, RORT(i), 'Another rort story about billionaire miners.', { issues: ['ftc'], reg: 1 }, (9 - i) * H));
  await w.place(); const id = w.of(a); const auto = w.nOf(id).auto_label; ok(auto, 'titled first');
  const nm = await w.call('POST', '/narratives/step', { what: 'name' }, 'full-key'); eq(nm.status, 200, nm.text.slice(0, 200)); eq(nm.body.calls, 1);
  const row = (await w.list()).find(x => x.id === id);
  eq(row.label, 'Fuel tax credits are a subsidy for billionaire miners'); eq(row.named, 'model'); eq(row.autoLabel, auto, 'the working title is kept in its own column');
  eq(w.nOf(id).label_tries, 0, 'a success clears the strikes');
});

await S.t('AN6 a person\'s name wins over both and survives a run', async () => {
  const w = await mk();
  const a = w.put('news', 'pointpost', RORT(1), 'The diesel rebate is a rort for billionaire miners.', { issues: ['ftc'], reg: 1 }, 10 * H);
  [2, 3].forEach(i => w.put('news', 'outlet' + i, RORT(i), 'Another rort story about billionaire miners.', { issues: ['ftc'], reg: 1 }, (10 - i) * H));
  await w.place(); const id = w.of(a);
  await w.call('POST', '/narratives/step', { what: 'name' }, 'full-key');
  const u = await w.call('POST', '/narratives/update', { id, label: 'What Anne calls the rort story' }, 'full-key'); eq(u.body.narrative.named, 'person');
  [4, 5, 6, 7].forEach(i => w.put('news', 'outlet' + i, RORT(i), 'More rort for billionaire miners.', { issues: ['ftc'], reg: 1 }, (10 - i) * H));
  const before = w.anth.length; await w.place(); await w.call('POST', '/narratives/step', { what: 'name' }, 'full-key');
  const n = w.nOf(id); eq(n.n, 7); eq(n.label, 'What Anne calls the rort story', 'never overwritten'); eq(n.auto_n, 7, 'the working title was refreshed quietly in its own column');
  eq((await w.list()).find(x => x.id === id).named, 'person');
  ok(!w.anth.slice(before).some(u2 => /More rort for billionaire miners/.test(u2)), 'a person\'s narrative is never sent to the namer');
});

await S.t('AN7 a narrative row written without the new columns still has a title on the Board, marked as a working title for the draft', async () => {
  const w = await mk();
  const r = await w.call('POST', '/archive/add', { kind: 'news', rows: [{ src: 'pointpost', title: 'Crossbench renews call for a windfall tax on gas', body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://pointpost.example.com.au/an7', ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }] }, 'full-key'); eq(r.status, 200);
  w.db.prepare("INSERT INTO narratives(id,label,issues,n,n24,first_ts,last_ts,status,muted,side,spread) VALUES('nold1','',?,4,3,?,?,'growing',0,'unknown','[]')").run(JSON.stringify(['gastax']), NOW - 20 * H, NOW - H);
  w.db.prepare("INSERT INTO narratives(id,label,issues,n,n24,first_ts,last_ts,status,muted,side,spread,terms) VALUES('nold2','',?,3,2,?,?,'steady',0,'unknown','[]',?)").run(JSON.stringify(['gastax']), NOW - 20 * H, NOW - H, JSON.stringify({ levy: 5, export: 4, giants: 3 }));
  const b = (await w.call('GET', '/den/board?desk=aep_au', null, 'read-key')).body; ok(b.ok, JSON.stringify(b).slice(0, 200));
  ok(!/not yet named/.test(JSON.stringify(b)), 'the placeholder is gone');
  const n1 = b.narratives.find(n => n.id === 'nold1'), n2 = b.narratives.find(n => n.id === 'nold2');
  ok(n1 && n1.label && words(n1.label) <= 14, 'a title with no terms held: ' + (n1 && n1.label)); eq(n1.named, 'auto');
  ok(n2 && /Gas taxation/.test(n2.label) && !/levy|export|giants/.test(n2.label) && words(n2.label) <= 14, 'a title from the desk\'s issue; the stored shared words are not printed with no rows to show they are plain: ' + (n2 && n2.label)); eq(n2.named, 'auto');
  eq(w.anth.length, 0, 'the Board made no model call');
  const dr = await w.call('POST', '/den/brief', { desk: 'aep_au' }, 'full-key'); eq(dr.status, 200, dr.text.slice(0, 200));
  const sent = w.anth[w.anth.length - 1]; const line = (sent.match(/^\[N:nold2\][^\n]*$/m) || [''])[0];
  ok(/working title, not yet reviewed/.test(line), 'the draft is told it is a working title: ' + line);
});

await S.t('AN8 with no API key every listed narrative has a title, and the stock written before p67 is back-filled', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: '' }); delete w.env.ANTHROPIC_API_KEY;
  w.raw('nstock1', { n: 2, titles: ['Harbour levy row grows as councils push back - Example Times', 'Councils push back on the harbour levy again'] });
  w.raw('nstock2', { n: 2, titles: ['Fuel tax credit rort for billionaire miners questioned', 'Rort for billionaire miners, fuel tax credit row'], terms: { rort: 3, billionaire: 3, miners: 3 } });
  eq(w.nOf('nstock1').auto_label, '', 'written without a title, as before p67');
  w.put('news', 'pointpost', RORT(1), 'rort billionaire miners', { issues: ['ftc'], reg: 1 }, 4 * H); w.put('news', 'outlet2', RORT(2), 'rort billionaire miners', { issues: ['ftc'], reg: 1 }, 3 * H);
  w.put('news', 'outlet3', 'Treasurer says budget surplus on track for June', 'surplus', { issues: ['econ'], reg: 1 }, 3 * H);
  const r = await w.place(); ok(r.titled >= 1, 'the run says how many it titled: ' + r.titled);
  eq(w.nOf('nstock1').auto_label, 'Harbour levy row grows as councils push back', 'back-filled from its rows (nothing joined it)');
  ok(w.nOf('nstock2').auto_label, 'titled, by the back-fill or by the recount of the rows that joined it');
  const all = await w.list('&all=1'); ok(all.length >= 2, 'narratives listed: ' + all.length);
  all.forEach(n => ok((n.label || n.autoLabel) && n.named, 'titled: ' + JSON.stringify({ id: n.id, label: n.label, autoLabel: n.autoLabel, named: n.named })));
  eq(w.anth.length, 0, 'no model call');
});

await S.t('AN9 the window\'s drain names every waiting narrative, client-issue narratives first, and stops at the cap', async () => {
  const w = await mk(); const G = w.mod.__test;
  ['alpha', 'bravo', 'charlie', 'delta', 'echo'].forEach((k, i) => w.raw('nq' + k, { ns: 'mca', n: 3 + i, n24: 1, titles: ['Queue ' + k + ' story one on fuel tax', 'Queue ' + k + ' story two on fuel tax'] }));
  ['foxtrot', 'golf'].forEach((k, i) => w.raw('nq' + k, { ns: '', issues: [], n: 30 + i, n24: 9, titles: ['Queue ' + k + ' story one, unrelated', 'Queue ' + k + ' story two, unrelated'] }));
  const out = await G.narrLabelQueue(w.env, {}); eq(out.calls, 2, 'seven narratives, two calls'); eq(out.named, 7); eq(out.waiting, 0); eq(out.stopped, 'done');
  ok(/Queue alpha/.test(w.anth[0]) && /Queue echo/.test(w.anth[0]) && !/Queue foxtrot|Queue golf/.test(w.anth[0]), 'the client-issue narratives go first, though the others are bigger');
  eq(w.nOf('nqgolf').label, 'Named queue golf');
  const w2 = await mk({ NARRATIVE_DAILY_CALLS: '1' });
  ['hotel', 'india', 'juliet', 'kilo', 'lima', 'mike'].forEach(k => w2.raw('nq' + k, { titles: ['Queue ' + k + ' story one on fuel tax', 'Queue ' + k + ' story two on fuel tax'] }));
  const o2 = await w2.mod.__test.narrLabelQueue(w2.env, {}); eq(o2.calls, 1, 'the cap holds'); eq(o2.stopped, 'budget'); eq(o2.waiting, 1);
  const left = w2.db.prepare("SELECT id, label_tries, label_try_ts FROM narratives WHERE label=''").all(); eq(left.length, 1);
  eq(left[0].label_tries, 0, 'a narrative that was never sent keeps no strike'); eq(left[0].label_try_ts, 0, 'and no claim');
});

await S.t('AN10 claim before the call: two drains started together never send the same narrative twice', async () => {
  const w = await mk();
  ['november', 'oscar', 'papa'].forEach(k => w.raw('nq' + k, { titles: ['Queue ' + k + ' story one on fuel tax', 'Queue ' + k + ' story two on fuel tax'] }));
  const G = w.mod.__test; const [a, b] = await Promise.all([G.narrLabelQueue(w.env, {}), G.narrLabelQueue(w.env, {})]);
  eq(a.calls + b.calls, 1, 'one call between them'); eq(a.named + b.named, 3);
  ['november', 'oscar', 'papa'].forEach(k => eq(w.anth.filter(u => u.indexOf('Queue ' + k + ' story one') >= 0).length, 1, k + ' sent once'));
  const claimed = await G.narrClaim(w.env, ['nqnovember'], Date.now()); eq(claimed, ['nqnovember'], 'a named row is claimable again (its claim was cleared)');
  eq(await G.narrClaim(w.env, ['nqnovember'], Date.now()), [], 'a row claimed in the last two minutes is not claimed again');
});

await S.t('AN11 three strikes: a cluster the model cannot name is set aside for a day, then tried again', async () => {
  const w = await mk(); const G = w.mod.__test; w.poison = /Queue quebec/;
  w.raw('nqquebec', { titles: ['Queue quebec story one on fuel tax', 'Queue quebec story two on fuel tax'] });
  for (let i = 1; i <= 3; i++) {
    const o = await G.narrLabelQueue(w.env, {}); eq(o.named, 0); eq(o.calls, 1, 'strike ' + i + ' spends its call'); ok(o.errors.some(e => /valid JSON/.test(e)), JSON.stringify(o.errors));
    eq(w.nOf('nqquebec').label_tries, i);
    w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now() - 5 * 60000, 'nqquebec');   // the claim has lapsed
  }
  const before = w.anth.length; const held = await G.narrLabelQueue(w.env, {}); eq(held.calls, 0, 'three strikes in a day: set aside'); eq(w.anth.length, before);
  w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now() - 25 * H, 'nqquebec'); w.poison = /never-matches/;
  const again = await G.narrLabelQueue(w.env, {}); eq(again.named, 1, 'a day later it is tried again'); eq(w.nOf('nqquebec').label_tries, 0);
});

await S.t('AN12 the window\'s cron names a narrative that did not move in that tick', async () => {
  const w = await mk();
  w.raw('nqromeo', { n: 4, updated: Date.now(), titles: ['Queue romeo story one on fuel tax', 'Queue romeo story two on fuel tax', 'Queue romeo story three on fuel tax', 'Queue romeo story four on fuel tax'] });
  w.db.prepare("UPDATE narratives SET auto_label='Queue romeo story one on fuel tax', auto_n=4 WHERE id='nqromeo'").run();   // titled: not even the back-fill recounts it
  const out = await w.mod.__test.narrativesCron(w.env); ok(out && out.ok !== false, JSON.stringify(out).slice(0, 200));
  eq(w.nOf('nqromeo').label, 'Named queue romeo', 'named although nothing joined it and its recount was not due');
});

await S.t('AN13 B1 is off unless the owner sets NARRATIVE_AUTO=tick; then a held tick makes at most two calls, client issues only, on its own capped ledger', async () => {
  const w = await mk(); const G = w.mod.__test; const held = { mode: 'daily', run: false };
  ['sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray', 'yankee', 'zulu', 'amber', 'basil', 'cedar'].forEach(k => w.raw('nq' + k, { titles: ['Queue ' + k + ' story one on fuel tax', 'Queue ' + k + ' story two on fuel tax'] }));
  w.raw('nqoffdesk', { ns: '', issues: [], n24: 5, titles: ['Queue offdesk story one, unrelated', 'Queue offdesk story two, unrelated'] });
  w.raw('nqquiet', { n24: 0, titles: ['Queue quiet story one on fuel tax', 'Queue quiet story two on fuel tax'] });
  eq(G.narrAutoMode(w.env), 'window', 'the default keeps naming in the window');
  const off = await G.narrAutoTick(w.env, held); eq(off.skipped, true); eq(w.anth.length, 0, 'default: a held tick makes no call');
  w.env.NARRATIVE_AUTO = 'tick';
  eq((await G.narrAutoTick(w.env, { mode: 'off', run: false })).skipped, true, 'AI_AUTOMATION=off stops it too'); eq(w.anth.length, 0);
  eq((await G.narrAutoTick(w.env, { mode: 'daily', run: true })).skipped, true, 'inside the window the window\'s drain does the work');
  const on = await G.narrAutoTick(w.env, held); eq(on.calls, 2, 'two calls a tick'); eq(on.named, 10); eq(w.anth.length, 2);
  ok(!w.anth.some(u => /Queue offdesk|Queue quiet/.test(u)), 'only client-issue narratives that moved in the last day');
  const u = await G.aiUsage(w.env, 'narr_auto'); eq(u.reserved, 2, 'its own ledger'); eq((await G.aiUsage(w.env, 'narratives')).reserved, 0, 'the window\'s cap is untouched');
  const st = (await w.call('GET', '/narratives/status', null, 'read-key')).body;
  ok(st.budgetAuto && st.budgetAuto.mode === 'tick' && JSON.stringify(st.budgetAuto) !== JSON.stringify(Object.assign({ mode: 'tick' }, st.budget)), '/narratives/status reports the narr_auto ledger beside the window\'s: ' + JSON.stringify(st.budgetAuto) + ' vs ' + JSON.stringify(st.budget));
  w.env.NARRATIVE_AUTO_DAILY_CALLS = '3'; const capped = await G.narrAutoTick(w.env, held); eq(capped.calls, 1, 'the auto cap holds'); eq(capped.stopped, 'done', 'the last waiting one was named');
  w.raw('nqdelta2', { titles: ['Queue deltatwo story one on fuel tax', 'Queue deltatwo story two on fuel tax'] });
  const spent = await G.narrAutoTick(w.env, held); eq(spent.calls, 0); eq(spent.stopped, 'budget');
  delete w.env.NARRATIVE_AUTO; delete w.env.NARRATIVE_AUTO_DAILY_CALLS;
});

await S.t('AN14 the drain names only narratives active in the last seven days, and the window\'s cron keeps to its share', async () => {
  const w = await mk(); const G = w.mod.__test;
  w.raw('nqrecent', { titles: ['Queue recent story one on fuel tax', 'Queue recent story two on fuel tax'] });
  ['old30', 'old90'].forEach(k => w.raw('nq' + k, { titles: ['Queue ' + k + ' story one on fuel tax', 'Queue ' + k + ' story two on fuel tax'] }));
  w.db.prepare('UPDATE narratives SET last_ts=? WHERE id=?').run(NOW - 30 * 24 * H, 'nqold30');
  w.db.prepare('UPDATE narratives SET last_ts=? WHERE id=?').run(NOW - 90 * 24 * H, 'nqold90');
  const st0 = (await w.call('GET', '/narratives/status', null, 'read-key')).body; eq(st0.awaitingModel, 1, 'the status counts the same seven days the drain works through');
  const out = await G.narrLabelQueue(w.env, {}); eq(out.named, 1); eq(out.waiting, 0);
  eq(w.nOf('nqrecent').label, 'Named queue recent');
  eq(w.nOf('nqold30').label, '', 'a narrative last active thirty days ago is not sent'); eq(w.nOf('nqold90').label, '');
  ok(!w.anth.some(u => /Queue old30|Queue old90/.test(u)), 'no call carried history');
  // the window tick's drain stops at its share (NARR_WINDOW_CALLS), well under the day's cap
  const w2 = await mk(); const N = (G.NARR_WINDOW_CALLS || 20) * 5 + 10;
  for (let i = 0; i < N; i++) w2.raw('nqw' + i, { titles: ['Queue w' + i + ' story one on fuel tax', 'Queue w' + i + ' story two on fuel tax'] });
  await w2.mod.__test.narrativesCron(w2.env);
  ok(w2.anth.length > 0 && w2.anth.length <= (G.NARR_WINDOW_CALLS || 20), 'calls in one window tick: ' + w2.anth.length);
  ok(w2.db.prepare("SELECT COUNT(*) n FROM narratives WHERE label=''").get().n > 0, 'the rest wait for the next window with their working titles');
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
