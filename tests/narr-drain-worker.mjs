/* Draining the narrative queues (build p68, 16 November 2026), against the worker module in this process. Written first, from
 * what the owner's drain of 16 November 2026 did on the live worker (p67); every case here fails on p67. No provider is
 * contacted: Workers AI is a stub whose marker words pick a direction, the Anthropic API is a stub (w.answer) that each case
 * shapes, and every request to it is counted. Every outlet, post and narrative here is invented.
 * A - placement never loops. On p67 a row 48-72h old that joined nothing started a singleton that the same run pruned (a
 *     singleton under two rows with nothing newer than 48h), freeing the row to be selected again by the next run, oldest
 *     first: "100 scanned, 100 placed (100 started)" for 400 steps while "remaining" never fell.
 *   A1 a 50h-old row that matches nothing is set aside, not started, and is not selected again
 *   A2 a 10h-old row that matches nothing still starts a singleton
 *   A3 a 50h-old row that matches a live narrative still joins it
 *   A4 two consecutive place steps on a backlog of only old unmatched rows end with remaining 0 and no narrative created
 *   A5 the prune still removes a three-day-old singleton that never grew (and keeps one that grew)
 *   A6 the tick makes progress through the same backlog (more rows than one pass scans)
 * B - naming survives a long answer. On p67 five clusters had 300 + 5 x 260 = 1600 output tokens, the answer and its retry
 *     (same limit) did not parse, and all five failed with "the naming model answered without valid JSON" and no reason.
 *   B1 the output budget is sized for what is asked: five full records that need about 2,000 tokens are named in one call
 *   B2 an answer cut off for five clusters is asked again in halves: all five named; calls = stub requests = the ledger
 *   B3 an answer in prose once, then JSON: all five named; calls = stub requests = the ledger
 *   B4 a narrative that fails even alone takes its strike and the other four are named; the error says why, with the
 *      answer's first words
 *   B5 a split never passes the remaining budget (the ledger cap) or the run's own share of calls
 *   B6 a declined answer is split like one in prose; a provider error (529) is not asked again smaller
 * C - one failing batch never blocks the queue. On p67 the name step took the five largest eligible narratives with no regard
 *     to claims or strikes; after a failed batch they were claimed for two minutes, so the next step claimed nothing, made no
 *     call, and tools/daily-brief.py stopped ("nothing was named this step").
 *   C1 after a failed batch the next step names the next five; remaining counts what can be named now, claimed the rest
 *   C2 three failures set a narrative aside (setAside) and the queue moves on without sending it
 * Run: node --experimental-sqlite tests/narr-drain-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Draining the narrative queues: placement never loops, naming survives a long answer, one batch never blocks the queue');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const DIM = 512;
// a direction per marker: "lone123" is its own axis (matches nothing else), "story-a" .. "story-e" are shared axes
function vec(text) {
  const v = new Array(DIM).fill(0); const t = String(text).toLowerCase();
  const lone = t.match(/lone(\d+)/); const story = t.match(/story-([a-e])/);
  const axis = lone ? 10 + (Number(lone[1]) % 400) : story ? story[1].charCodeAt(0) - 97 : 9;
  v[axis] = 1; let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
  v[DIM - 1 - (h % 40)] += 0.05;   // a little text-dependent noise, far from every marker axis
  return v;
}
const AI = { run: async (m, { text }) => ({ shape: [text.length, DIM], data: (Array.isArray(text) ? text : [text]).map(vec) }) };
const H = 3600000;
let seq = 0;
const clustersOf = user => Array.from(user.matchAll(/\[(\d+)\] shared terms: ([^\n]*)\n([\s\S]*?)(?=\n\[\d+\] |$)/g)).map(m => ({ n: Number(m[1]), text: m[3], key: ((m[3].match(/Queue (\w+)/) || [])[1] || 'x') }));
const record = (c, long) => ({ n: c.n, label: 'Named queue ' + c.key, summary: long ? ('Posters and some outlets keep saying the fuel tax credit is a rort for the largest miners and that the money should go elsewhere. ' + 'It is carried mostly by Reddit threads, a few regional papers and the crossbench, with industry pushing back in the business press. ').repeat(6) : 'Said by posters and some outlets.', claim: 'A claim.', counter: '', proponents: 'posters', issues: ['ftc'], scope: 'client', relevance: 3, why: 'client issue' });
const reply = (text, stop, outTok) => new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: stop || 'end_turn', usage: { input_tokens: 100, output_tokens: outTok || 50 } }), { status: 200 });
async function mk(env) {
  const w = await workerEnv({ env: Object.assign({ AI, ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
  w.anth = []; w.maxTok = [];
  // the default model: names every cluster it is sent; a case replaces w.model to truncate, wander into prose or refuse one
  w.model = (cs, body) => reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); const user = b.messages[0].content; w.anth.push(user); w.maxTok.push(b.max_tokens); return w.model(clustersOf(user), b); });
  await w.call('GET', '/sentiment/status', null, 'read-key'); await w.call('GET', '/narratives/status', null, 'read-key');
  w.db = w.env.MIND_DB.db; w.G = w.mod.__test;
  w.put = (title, ago, o) => { o = o || {}; const url = 'https://example.test/n/' + (++seq); w.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,'',0,?,?,?)").run(o.kind || 'news', o.src || 'pointpost', title, o.body || (title + '. More on this story.'), url, JSON.stringify(o.meta || { issues: ['ftc'], reg: 1 }), Date.now() - ago, Date.now()); return w.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id; };
  w.place = async scan => { const r = await w.call('POST', '/narratives/step', { what: 'place', scan: scan || 100 }, 'full-key'); if (r.status !== 200) throw new Error('place: ' + r.text.slice(0, 200)); return r.body; };
  w.name = async () => { const r = await w.call('POST', '/narratives/step', { what: 'name' }, 'full-key'); if (r.status !== 200) throw new Error('name: ' + r.text.slice(0, 200)); return r.body; };
  w.nOf = id => w.db.prepare('SELECT * FROM narratives WHERE id=?').get(id);
  w.of = itemId => (w.db.prepare('SELECT narrative FROM narrative_items WHERE item=?').get(itemId) || {}).narrative;
  w.count = () => w.db.prepare('SELECT COUNT(*) n FROM narratives').get().n;
  w.ledger = async scope => w.G.aiUsage(w.env, scope || 'narratives');
  // a narrative waiting for a model name, written straight into the table with two rows of its own
  w.raw = (id, o) => {
    o = o || {}; const now = Date.now();
    w.db.prepare("INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,issue_counts,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated) VALUES(?,'','','','','',?,'{}','[]',?,'unknown',?,?,0,0,?,0,'news','pointpost',?,'{}','[]','[]','[]','{}','','steady',0,0,0,0,0,'{}','',0,0,'',?,?)")
      .run(id, JSON.stringify(['ftc']), o.ns == null ? 'mca' : o.ns, o.n || 3, o.n24 == null ? 1 : o.n24, now - 30 * H, now - H, now - 30 * H, now);
    const k = id.replace(/^nq/, '');
    [1, 2].forEach(i => { const it = w.put('Queue ' + k + ' story ' + i + ' on fuel tax', 20 * H - i * H); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','pointpost',0.9)").run(it, id, now - 20 * H + i * H); });
  };
  return w;
}
const NATO = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet', 'kilo', 'lima'];

// ---------------------------------------------------------------- A: placement never loops
await S.t('A1 a 50h-old row that matches nothing is set aside, not started, and is not selected again', async () => {
  const w = await mk();
  const a = w.put('Fuel tax credit row lone1 in a regional paper', 50 * H);
  const r = await w.place(); eq(r.scanned, 1); eq(r.started, 0, 'too old to seed a narrative the same run would prune'); eq(r.unanchored, 1, 'counted as set aside');
  eq(w.of(a), '', 'set aside (narrative_items with no narrative)'); eq(w.count(), 0, 'no narrative was created'); eq(r.remaining, 0);
  const r2 = await w.place(); eq(r2.scanned, 0, 'not selected again'); eq(r2.remaining, 0);
});

await S.t('A2 a 10h-old row that matches nothing still starts a singleton', async () => {
  const w = await mk();
  const a = w.put('Fuel tax credit row lone2 in a regional paper', 10 * H);
  const r = await w.place(); eq(r.started, 1); eq(r.unanchored, 0);
  const id = w.of(a); ok(id, 'it seeded a narrative'); eq(w.nOf(id).n, 1); eq(r.pruned || 0, 0, 'young enough to keep');
  eq((await w.place()).scanned, 0);
});

await S.t('A3 a 50h-old row that matches a live narrative still joins it', async () => {
  const w = await mk();
  const a = w.put('Fuel tax credit story-a for billionaire miners', 6 * H); w.put('Another fuel tax credit story-a for billionaire miners', 5 * H);
  await w.place(); const id = w.of(a); ok(id, 'a live narrative of two'); eq(w.nOf(id).n, 2);
  const old = w.put('Old fuel tax credit story-a for billionaire miners', 50 * H);
  const r = await w.place(); eq(r.joined, 1); eq(r.unanchored, 0); eq(w.of(old), id, 'joined the live narrative'); eq(w.nOf(id).n, 3);
});

await S.t('A4 two consecutive place steps on a backlog of only old unmatched rows end with remaining 0 and no narrative created', async () => {
  const w = await mk();
  for (let i = 0; i < 150; i++) w.put('Fuel tax credit row lone' + (100 + i) + ' in a regional paper', (49 + (i % 20)) * H);
  const r1 = await w.place(100); eq(r1.scanned, 100); eq(r1.started, 0); eq(r1.unanchored, 100); eq(r1.remaining, 50, 'the backlog fell by the hundred scanned');
  const r2 = await w.place(100); eq(r2.scanned, 50); eq(r2.remaining, 0, 'remaining falls to 0 on a quiet backlog');
  eq(w.count(), 0, 'no narrative created'); eq(w.db.prepare("SELECT COUNT(*) n FROM narrative_items WHERE narrative=''").get().n, 150);
});

await S.t('A5 the prune still removes a three-day-old singleton that never grew, and keeps one that grew', async () => {
  const w = await mk(); const now = Date.now();
  const ins = (id, n, ago) => { w.db.prepare("INSERT INTO narratives(id,label,issues,n,n24,first_ts,last_ts,status,muted,side,spread,created,updated) VALUES(?,'','[\"ftc\"]',?,0,?,?,'new',0,'unknown','[]',?,?)").run(id, n, now - ago, now - ago, now - ago, now);
    for (let i = 0; i < n; i++) { const it = w.put('Fuel tax credit row lone' + (300 + seq) + ' kept', ago); w.db.prepare("INSERT INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,'news','pointpost',1)").run(it, id, now - ago); } };
  ins('nsingle3d', 1, 73 * H); ins('ngrew3d', 2, 73 * H);
  const r = await w.place(); ok(r.pruned >= 1, 'pruned: ' + r.pruned);
  eq(w.nOf('nsingle3d'), undefined, 'the singleton that never grew is gone'); ok(w.nOf('ngrew3d'), 'the narrative that grew stays');
});

await S.t('A6 the tick makes progress through the same backlog (more rows than one pass scans)', async () => {
  const w = await mk();
  for (let i = 0; i < 320; i++) w.put('Fuel tax credit row lone' + i + ' in a regional paper', (49 + (i % 20)) * H);
  const out = await w.G.narrativesCron(w.env); ok(out && out.ok !== false, JSON.stringify(out).slice(0, 200));
  eq(out.started, 0); eq(out.unanchored, 320, 'every row looked at once and set aside');
  eq((await w.call('GET', '/narratives/status', null, 'read-key')).body.backlog, 0); eq(w.count(), 0);
});

// ---------------------------------------------------------------- B: naming survives a long answer
// the provider's arithmetic, roughly: four characters a token; past max_tokens the answer stops where it is
const tokenModel = long => (cs, body) => { const text = JSON.stringify({ clusters: cs.map(c => record(c, long)) }); const need = Math.ceil(text.length / 4);
  return need <= body.max_tokens ? reply(text, 'end_turn', need) : reply(text.slice(0, body.max_tokens * 4), 'max_tokens', body.max_tokens); };
const five = w => NATO.slice(0, 5).forEach((k, i) => w.raw('nq' + k, { n: 3 + i }));
const calls3 = async (w, out, label) => { const u = await w.ledger(); eq(out.calls, w.anth.length, label + ': the calls the run reports are the requests sent'); eq(u.confirmed + u.failed, w.anth.length, label + ': the ledger settled every one'); eq(u.reserved, w.anth.length, label + ': and reserved every one'); };

await S.t('B1 the output budget is sized for what is asked: five full records of about 2,000 tokens are named in one call', async () => {
  const w = await mk(); five(w); w.model = tokenModel(true);
  const need = Math.ceil(JSON.stringify({ clusters: NATO.slice(0, 5).map((k, i) => record({ n: i + 1, key: k }, true)) }).length / 4);
  ok(need > 1600 && need < 2850, 'the fixture needs more than p67 gave five clusters and less than p68 gives: ' + need);
  const out = await w.G.narrLabelQueue(w.env, {}); eq(out.named, 5, JSON.stringify(out.errors)); eq(out.calls, 1);
  ok(w.maxTok[0] >= 600 + 450 * 5 && w.maxTok[0] <= 8192, 'max_tokens for five clusters: ' + w.maxTok[0]);
  await calls3(w, out, 'B1');
});

await S.t('B2 an answer cut off for five clusters is asked again in halves: all five named, every call on the ledger', async () => {
  const w = await mk(); five(w); const lines = [];
  w.model = (cs, body) => cs.length >= 5 ? reply(JSON.stringify({ clusters: cs.map(c => record(c)) }).slice(0, 180), 'max_tokens', body.max_tokens) : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  const out = await w.G.narrLabelQueue(w.env, { log: async (k, t) => lines.push(k + ' ' + t) });
  eq(out.named, 5, JSON.stringify(out.errors)); eq(out.errors, [], 'a recovered batch is not an error');
  eq(w.anth.length, 3, 'five, then three and two'); NATO.slice(0, 5).forEach(k => eq(w.nOf('nq' + k).label, 'Named queue ' + k));
  ok(lines.some(l => /cut off/.test(l) && /max_tokens/.test(l)), 'the console says the answer was cut off: ' + lines.join(' | '));
  await calls3(w, out, 'B2');
});

await S.t('B3 an answer in prose once, then JSON: all five named, every call on the ledger', async () => {
  const w = await mk(); five(w); let first = true;
  w.model = cs => { if (first) { first = false; return reply('Here are the five narratives, taken one at a time, with my notes on each.'); } return reply(JSON.stringify({ clusters: cs.map(c => record(c)) })); };
  const out = await w.G.narrLabelQueue(w.env, {}); eq(out.named, 5, JSON.stringify(out.errors));
  NATO.slice(0, 5).forEach(k => { eq(w.nOf('nq' + k).label, 'Named queue ' + k); eq(w.nOf('nq' + k).label_tries, 0); });
  await calls3(w, out, 'B3');
});

await S.t('B4 a narrative that fails even alone takes its strike, the other four are named, and the error says why', async () => {
  const w = await mk(); five(w);
  w.model = cs => cs.some(c => c.key === 'charlie') ? reply('I cannot answer that.') : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  const out = await w.G.narrLabelQueue(w.env, {}); eq(out.named, 4);
  ['alpha', 'bravo', 'delta', 'echo'].forEach(k => { eq(w.nOf('nq' + k).label, 'Named queue ' + k); eq(w.nOf('nq' + k).label_tries, 0, k + ': a name clears the strike'); });
  eq(w.nOf('nqcharlie').label, ''); eq(w.nOf('nqcharlie').label_tries, 1, 'charlie keeps its strike');
  eq(out.errors.length, 1, JSON.stringify(out.errors)); const e = out.errors[0];
  ok(/valid JSON/.test(e) && /nqcharlie/.test(e) && /not JSON/.test(e) && /I cannot answer that\./.test(e), 'the error names the narrative, the reason and the answer\'s first words: ' + e);
  ok(!w.anth.some(u => /Queue charlie/.test(u) && /Queue alpha/.test(u) && clustersOf(u).length === 1), 'sanity');
  await calls3(w, out, 'B4');
});

await S.t('B5 a split never passes the remaining budget (the ledger cap) or the run\'s own share of calls', async () => {
  const cut = (cs, body) => cs.length >= 5 ? reply('{"clusters":[{"n":1,"label":"cut', 'max_tokens', body.max_tokens) : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  const w = await mk({ NARRATIVE_DAILY_CALLS: '2' }); five(w); w.model = cut;
  const out = await w.G.narrLabelQueue(w.env, {}); eq(out.stopped, 'budget'); eq(out.calls, 2); eq(w.anth.length, 2, 'the cap holds inside a split');
  eq(out.named, 3, 'the first half was named'); eq((await w.ledger()).reserved, 2);
  const unasked = w.db.prepare("SELECT id, label_tries, label_try_ts FROM narratives WHERE label=''").all(); eq(unasked.length, 2);
  unasked.forEach(r => { eq(r.label_try_ts, 0, r.id + ': its claim is released for tomorrow'); });
  ok(out.errors.some(e => /budget/.test(e)), JSON.stringify(out.errors));
  const w2 = await mk(); five(w2); w2.model = cut;
  const o2 = await w2.G.narrLabelQueue(w2.env, { maxCalls: 2 }); eq(o2.calls, 2); eq(w2.anth.length, 2, 'the run\'s share (maxCalls) holds inside a split too'); eq(o2.stopped, 'calls');
  await calls3(w2, o2, 'B5');
});

await S.t('B6 a declined answer is split like one in prose; a provider error is not asked again smaller', async () => {
  const w = await mk(); five(w);
  w.model = cs => cs.some(c => c.key === 'charlie') ? new Response(JSON.stringify({ content: [], stop_reason: 'refusal', usage: { input_tokens: 100, output_tokens: 0 } }), { status: 200 }) : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  const out = await w.G.narrLabelQueue(w.env, {}); eq(out.named, 4, JSON.stringify(out.errors)); eq(w.nOf('nqcharlie').label_tries, 1);
  ok(out.errors.length === 1 && /nqcharlie/.test(out.errors[0]) && /declined/.test(out.errors[0]), JSON.stringify(out.errors));
  await calls3(w, out, 'B6 declined');
  const w2 = await mk(); five(w2);
  w2.model = () => new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 });
  const o2 = await w2.G.narrLabelQueue(w2.env, {}); eq(o2.named, 0); eq(o2.calls, 1, 'one call: an overloaded provider is not asked four more times'); eq(w2.anth.length, 1);
  ok(o2.errors.some(e => /Overloaded/.test(e) && /nqalpha/.test(e)), JSON.stringify(o2.errors));
  const u = await w2.ledger(); eq(u.failed, 1, 'settled as failed'); eq(u.reserved, 1);
});

// ---------------------------------------------------------------- C: one failing batch never blocks the queue
await S.t('C1 after a failed batch the next step names the next five; remaining counts what can be named now', async () => {
  const w = await mk();
  NATO.slice(0, 5).forEach((k, i) => w.raw('nq' + k, { n: 40 + i, n24: 5 }));   // the five a p67 step always took (largest)
  NATO.slice(5, 10).forEach(k => w.raw('nq' + k, { n: 3, n24: 1 }));
  const bad = new Set(NATO.slice(0, 5));
  w.model = cs => cs.some(c => bad.has(c.key)) ? reply('These clusters are hard to name; here is what I can say about them.') : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  const s1 = await w.name(); eq(s1.named, 0); ok(s1.calls >= 1 && s1.calls === w.anth.length, 'the failed batch spent its calls: ' + s1.calls);
  eq(s1.remaining, 5, 'five can be named now'); eq(s1.claimed, 5, 'five are in the failed batch\'s two-minute claim'); eq(s1.setAside, 0);
  ok(s1.errors.length >= 1 && /valid JSON/.test(s1.errors[0]), JSON.stringify(s1.errors));
  eq(s1.calls, 5, 'a batch the model cannot name at all costs five calls (five, three, two, then two singles), not eight');
  ok(s1.errors.some(e => /not asked alone/.test(e) && /nqcharlie/.test(e)), 'the rest are not asked alone, and the error says so: ' + JSON.stringify(s1.errors));
  const before = w.anth.length; const s2 = await w.name();
  eq(s2.named, 5, 'the next step names the next five'); eq(s2.calls, 1); eq(s2.remaining, 0);
  ok(!w.anth.slice(before).some(u => /Queue (alpha|bravo|charlie|delta|echo)/.test(u)), 'the claimed five are not sent again inside their claim');
  NATO.slice(5, 10).forEach(k => eq(w.nOf('nq' + k).label, 'Named queue ' + k));
});

await S.t('C2 three failures set a narrative aside and the queue moves on without sending it', async () => {
  const w = await mk();
  w.raw('nqpapa', { n: 50, n24: 9 });
  w.model = cs => cs.some(c => c.key === 'papa') ? reply('I cannot name this one.') : reply(JSON.stringify({ clusters: cs.map(c => record(c)) }));
  for (let i = 1; i <= 3; i++) {
    const s = await w.name(); eq(s.named, 0); ok(s.calls >= 1, 'strike ' + i + ' spent its call'); eq(w.nOf('nqpapa').label_tries, i);
    w.db.prepare('UPDATE narratives SET label_try_ts=? WHERE id=?').run(Date.now() - 5 * 60000, 'nqpapa');   // the claim has lapsed
  }
  w.raw('nqromeo', { n: 3, n24: 1 });
  const before = w.anth.length; const s4 = await w.name();
  eq(s4.named, 1, 'the queue moved on'); eq(w.nOf('nqromeo').label, 'Named queue romeo');
  ok(!w.anth.slice(before).some(u => /Queue papa/.test(u)), 'three strikes today: papa is not sent');
  eq(s4.setAside, 1, 'the response says one is set aside'); eq(s4.remaining, 0, 'nothing else can be named now');
});

const res = S.done(); process.exit(res.fail ? 1 : 0);
