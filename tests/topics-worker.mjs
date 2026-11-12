/* Topic research and the X child job (the first live run of the Mac collector, 11 November 2026). Every topic run
 * queued an X job for the Mac whether or not anything could serve it, and nothing ever took an unserved one off the
 * queue, so the queue held one X job per keyword per run: when a collector finally connected it was handed the same
 * keywords twice over. Google News, Hansard and Claude are stand-ins (no key is set, so no model is asked); no platform
 * is contacted; every MP here is invented. Each case fails on the p58 commit.
 *   TW1 with no collector that can search X, the topic job queues no X job and says so once, in words
 *   TW2 with one, it queues one; a second run while that one still waits does not queue another
 *   TW3 a collector that reports X search as down is not a collector for X: nothing is queued, and the reason is its
 *   TW4 the worker's own timeline reader stands in for the MPs' accounts: an MP's post already held that carries the
 *       keyword is in the topic's results, marked as held; a post by anyone else is not
 * Run: node --experimental-sqlite tests/topics-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Topic research: the X child job');
const mk = async () => {
  const w = await workerEnv({ keys: { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } });
  w.answer(/news\.google\.com/, async () => new Response('<rss><channel></channel></rss>', { status: 200, headers: { 'Content-Type': 'application/xml' } }));
  return w;
};
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const beat = (w, agent, sources, down) => F(w, 'GET', '/bridge/next?agent=' + agent + '&sources=' + sources.join(',') + (down ? '&down=' + down : ''));
const jobs = (w, source) => w.env.MIND_DB.db.prepare('SELECT * FROM bridge_jobs WHERE source=? ORDER BY created, id').all(source);
const mps = async w => {
  await F(w, 'GET', '/mps');   // builds the tables
  const ins = w.env.MIND_DB.db.prepare('INSERT INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES(?,?,?,?,?,?,?,?,?)');
  ins.run('Q1', 'Alex Example', 'Independent', 'house', 'Testville', 'alexexample', '', '', Date.now());
  ins.run('Q2', 'Sam Sample', 'Independent', 'senate', '', 'samsample', '', '', Date.now());
};
const run = async (w, keyword) => {
  const r = await F(w, 'POST', '/bridge/run', { source: 'topic', params: { keyword, ns: 'guns' } }); eq(r.body.where, 'worker');
  await w.settle(); return (await F(w, 'GET', '/bridge/job?id=' + r.body.id)).body;
};

await S.t('TW1 no collector can search X: nothing is queued, and the job says so once', async () => {
  const w = await mk(); await mps(w);
  const j = await run(w, 'firearms');
  eq(j.status, 'done', JSON.stringify(j.result)); eq(jobs(w, 'x').length, 0, 'no X job is left in a queue nobody serves');
  const said = j.lines.filter(l => /X search/.test(l.text)); eq(said.length, 1, JSON.stringify(j.lines.map(l => l.text)));
  ok(/not queued/.test(said[0].text) && /reach-agent\.py/.test(said[0].text), said[0].text);
  ok(j.result.xSkipped && !j.result.children.x, JSON.stringify(j.result));
  await run(w, 'firearms'); eq(jobs(w, 'x').length, 0, 'and a second run does not queue one either');
});

await S.t('TW2 one X job a topic: a run does not queue a second while the first still waits', async () => {
  const w = await mk(); await mps(w); await beat(w, 'macbook', ['x']);
  const j = await run(w, 'firearms'); eq(jobs(w, 'x').length, 1); const first = jobs(w, 'x')[0];
  eq([first.status, first.who, j.result.children.x], ['queued', 'topic:firearms', first.id]);
  const p = JSON.parse(first.params); eq([p.from.sort(), p.fromQueries, p.queries], [['alexexample', 'samsample'], ['firearms'], ['firearms australia']]);
  await w.env.AXIOM_KV.put('bridge_agent_macbook', JSON.stringify({ ts: Date.now(), sources: ['x'] }));
  const j2 = await run(w, 'firearms'); eq(jobs(w, 'x').length, 1, 'the same keyword is not queued twice');
  eq(j2.result.children.x, first.id, 'the run points at the job already waiting'); ok(j2.lines.some(l => /already waiting/.test(l.text)), JSON.stringify(j2.lines.map(l => l.text)));
  await run(w, 'ammunition'); eq(jobs(w, 'x').map(x => x.who), ['topic:firearms', 'topic:ammunition'], 'another keyword gets its own');
  // once the first has been taken, the next run may queue again
  w.env.MIND_DB.db.prepare("UPDATE bridge_jobs SET status='done' WHERE id=?").run(first.id);
  await run(w, 'firearms'); eq(jobs(w, 'x').filter(x => x.who === 'topic:firearms').length, 2);
});

await S.t('TW3 a collector whose X search is down is not a collector for X', async () => {
  const w = await mk(); await mps(w); await beat(w, 'macbook', ['reddit'], 'x');
  const j = await run(w, 'firearms'); eq(jobs(w, 'x').length, 0);
  const said = j.lines.filter(l => /X search/.test(l.text)); eq(said.length, 1);
  ok(/uv tool upgrade twitter-cli/.test(said[0].text) && j.result.xSkipped === 'x_unavailable', said[0].text + ' ' + JSON.stringify(j.result.xSkipped));
});

await S.t('TW4 the timeline reader stands in for the MP accounts', async () => {
  const w = await mk(); await mps(w);
  const ing = (title, meta, url) => w.env.MIND_DB.db.prepare("INSERT INTO arc_items(kind,src,title,body,url,ts,tone,meta) VALUES('sig_thread','x',?,?,?,?,0,?)").run(title, title, url, Date.now() - 3600000, JSON.stringify(Object.assign({ platform: 'x' }, meta)));
  await F(w, 'GET', '/archive/stats');
  try { ing('New firearms laws pass the House today', { synd: 1, id: '1', mp: { name: 'Alex Example', party: 'Independent', house: 'house' } }, 'https://x.com/i/web/status/1'); }
  catch (e) { throw new Error('could not seed the archive: ' + e.message); }
  ing('Firearms owners should read this', { synd: 1, id: '2' }, 'https://x.com/i/web/status/2');                                            // a watched account, not an MP
  ing('Roads funding for Testville', { synd: 1, id: '3', mp: { name: 'Sam Sample', party: 'Independent', house: 'senate' } }, 'https://x.com/i/web/status/3');   // an MP, another subject
  const j = await run(w, 'firearms');
  ok(j.lines.some(l => /1 post/.test(l.text) && /timeline/.test(l.text)), 'the job says what the timeline reader already holds: ' + JSON.stringify(j.lines.map(l => l.text)));
  const res = (await w.call('GET', '/topics/results?id=firearms', null, 'read-key')).body;
  eq(res.x.map(p => p.url), ['https://x.com/i/web/status/1']); eq([res.x[0].mp.name, res.x[0].held], ['Alex Example', true]);
  ok(/timeline/.test(res.xNote || ''), 'and the results say where the X posts came from: ' + res.xNote);
  eq(w.outbound.filter(o => /twitter|x\.com|twimg/.test(o.url)).length, 0, 'the topic job itself fetched nothing from X');
  eq(w.outbound.filter(o => /anthropic/.test(o.url)).length, 0, 'and asked no model');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
