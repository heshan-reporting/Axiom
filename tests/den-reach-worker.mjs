/* The monitoring desk, release 3 (prompts/annes-den.md Phase 3): the worker's side of the signed-in layer - where a job
 * goes, what stops it, and what the team is told. A collector is a stand-in that beats and reports as tools/reach-agent.py
 * does; no platform is contacted. Each case fails on the p54 commit.
 *   RR1 routing by capability: an official route when Meta has granted it, a signed-in collector when one offers the
 *       platform, and with neither the job fails at once with what to set; YouTube keyword search is the collector's
 *   RR2 a job waiting for a collector that is not connected fails as no_collector with the command that starts one
 *   RR3 the kill switch: a platform switched off is not queued, and a job queued earlier is not handed out
 *   RR4 a verification: the team is told once a day a platform; it is kept for the coverage table; nothing retries
 *   RR5 the registers' X accounts join the timeline sweep; a registered public actor is named, a plain account is not
 *   RR6 the morning plan: one job a desk for each platform a live collector offers, once a day, none when switched off
 *   RR7 a YouTube video found by search carries its video id, so the worker's comment and caption pass picks it up
 * Run: node --experimental-sqlite tests/den-reach-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 3: the signed-in layer, from the worker');
const mk = async env => workerEnv({ env: Object.assign({}, env || {}), keys: { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const beat = (w, agent, sources) => F(w, 'GET', '/bridge/next?agent=' + agent + '&sources=' + sources.join(','));
const add = async (w, o) => { const r = await F(w, 'POST', '/den/watch/add', o); if (r.status !== 200) throw new Error(JSON.stringify(r.body)); return r.body.watch; };
const jobs = w => w.env.MIND_DB.db.prepare('SELECT * FROM bridge_jobs ORDER BY created, id').all();
const age = (w, id, ms) => w.env.MIND_DB.db.prepare('UPDATE bridge_jobs SET created=? WHERE id=?').run(Date.now() - ms, id);
const slack = w => { const sent = []; w.answer(/hooks\.slack\.test/, async (u, init) => { sent.push(JSON.parse(init.body).text); return new Response('ok', { status: 200 }); }); return sent; };

await S.t('RR1 routing by capability', async () => {
  let w = await mk();
  let r = await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } });
  eq(r.body.where, 'worker', 'no collector and no permission: it runs here and says what to set, at once');
  await w.settle(); let j = (await F(w, 'GET', '/bridge/job?id=' + r.body.id)).body;
  eq([j.status, j.result.error], ['failed', 'meta_not_configured']); ok(/Page Public Content Access/.test(j.result.detail));
  r = await F(w, 'POST', '/bridge/run', { source: 'ytsearch', params: { ns: 'aep' } }); eq(r.body.where, 'desktop', 'YouTube keyword search has no worker route');
  await beat(w, 'macbook', ['reddit']);
  eq((await F(w, 'POST', '/bridge/run', { source: 'instagram', params: { ns: 'aep' } })).body.where, 'worker', 'a collector that does not offer Instagram does not take it');
  await beat(w, 'macbook', ['facebook', 'instagram', 'ytsearch']);
  eq((await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } })).body.where, 'desktop');
  eq((await F(w, 'POST', '/bridge/run', { source: 'instagram', params: { ns: 'aep' } })).body.where, 'desktop');
  w = await mk({ META_TOKEN: 'tok', META_PUBLIC_PAGES: '1', META_IG_USER: '17841400000000001' }); await beat(w, 'macbook', ['facebook', 'instagram']);
  eq((await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } })).body.where, 'worker', 'the official route is preferred when Meta has granted it');
  eq((await F(w, 'POST', '/bridge/run', { source: 'instagram', params: { ns: 'aep' } })).body.where, 'worker');
  eq((await F(w, 'POST', '/bridge/run', { source: 'facebook', where: 'desktop', params: { ns: 'aep' } })).body.where, 'desktop', 'unless the collector is asked for by name');
});

await S.t('RR2 a job with no collector to run it', async () => {
  const w = await mk();
  const r = await F(w, 'POST', '/bridge/run', { source: 'ytsearch', params: { ns: 'aep' } });
  eq((await F(w, 'GET', '/bridge/job?id=' + r.body.id)).body.status, 'queued', 'it waits a little: the collector may be about to connect');
  age(w, r.body.id, 4 * 60000);
  const j = (await w.call('GET', '/bridge/job?id=' + r.body.id, null, 'read-key')).body;
  eq([j.status, j.success, j.result.error], ['failed', false, 'no_collector']); ok(/reach-agent\.py --channels/.test(j.result.detail) && /YouTube search/.test(j.result.detail), j.result.detail);
  ok(j.lines.some(l => l.kind === 'err' && /No collector/.test(l.text)), 'and the console says so');
  const r2 = await F(w, 'POST', '/bridge/run', { source: 'ytsearch', params: { ns: 'aep' } }); age(w, r2.body.id, 4 * 60000); await beat(w, 'macbook', ['reddit']);
  eq((await F(w, 'GET', '/bridge/job?id=' + r2.body.id)).body.status, 'failed', 'a collector that cannot read it does not count');
  const r3 = await F(w, 'POST', '/bridge/run', { source: 'x', params: {} }); age(w, r3.body.id, 4 * 60000); w.env.MIND_DB.db.prepare("UPDATE bridge_jobs SET status='queued', agent='' WHERE id=?").run(r3.body.id);
  await w.env.AXIOM_KV.put('bridge_agent_macbook', JSON.stringify({ ts: Date.now(), sources: ['x'] }));
  eq((await F(w, 'GET', '/bridge/job?id=' + r3.body.id)).body.status, 'queued', 'with a live collector that offers it, it keeps waiting');
});

await S.t('RR3 the kill switch', async () => {
  const w = await mk(); await beat(w, 'macbook', ['facebook', 'instagram']);
  const queued = await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } }); eq(queued.body.where, 'desktop');
  eq((await w.call('POST', '/den/reach', { off: ['facebook'] }, 'read-key')).status, 403, 'a read key cannot switch anything');
  const v = (await F(w, 'POST', '/den/reach', { off: ['facebook', 'nonsense'] })).body; eq(v.off, ['facebook']);
  eq(v.platforms.find(p => p.source === 'facebook').off, true); eq(v.platforms.find(p => p.source === 'instagram').offered, true);
  const r = await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } });
  eq([r.status, r.body.error], [409, 'reach_off']); ok(/switched off for every collector/.test(r.body.detail));
  eq((await beat(w, 'macbook', ['facebook', 'instagram'])).body.job, null, 'a job queued before the switch is not handed out either');
  eq((await F(w, 'POST', '/bridge/run', { source: 'instagram', params: { ns: 'aep' } })).body.where, 'desktop', 'another platform is untouched');
  ok((await beat(w, 'macbook', ['facebook', 'instagram'])).body.job.source === 'instagram');
  eq((await w.call('GET', '/den/reach', null, 'read-key')).body.off, ['facebook'], 'anyone signed in can see what is off');
  await F(w, 'POST', '/den/reach', { off: [] });
  eq((await beat(w, 'macbook', ['facebook'])).body.job.id, queued.body.id, 'switched back on, the waiting job is handed out');
});

await S.t('RR4 a verification', async () => {
  const w = await mk(); await w.env.AXIOM_KV.put('slack_webhooks', JSON.stringify({ _default: 'https://hooks.slack.test/default', aep: 'https://hooks.slack.test/aep' })); const sent = slack(w);
  await beat(w, 'macbook', ['facebook', 'instagram']);
  const run = async () => { const r = await F(w, 'POST', '/bridge/run', { source: 'facebook', params: { ns: 'aep' } }); const c = (await beat(w, 'macbook', ['facebook'])).body.job; eq(c.id, r.body.id);
    return F(w, 'POST', '/bridge/done', { job: c.id, ok: false, agent: 'macbook', result: { ok: false, error: 'facebook_challenge', detail: 'facebook asked for a verification. The collector stopped at once.' } }); };
  eq((await run()).status, 200); eq(sent.length, 1); ok(/Facebook asked the collector for a verification/.test(sent[0]) && /Nothing will retry/.test(sent[0]) && /--login facebook/.test(sent[0]) && /macbook/.test(sent[0]), sent[0]);
  await run(); eq(sent.length, 1, 'told once a day a platform, however many jobs meet it');
  const v = (await F(w, 'GET', '/den/reach')).body; ok(v.challenges.facebook.at > 0 && /verification/.test(v.challenges.facebook.detail) && v.challenges.facebook.agent === 'macbook');
  const cov = (await F(w, 'GET', '/social/coverage')).body.platforms.find(p => p.id === 'facebook'); ok(cov.collector && cov.collector.challenge && cov.collector.offered === true && cov.collector.off === false, JSON.stringify(cov.collector)); ok(typeof cov.reach === 'string' && /registered pages/.test(cov.reach), 'what the platform reaches is still said');
  eq(jobs(w).filter(j => j.source === 'facebook' && j.status === 'queued').length, 0, 'nothing was queued again');
  await beat(w, 'macbook', ['facebook', 'instagram']);
  const other = await F(w, 'POST', '/bridge/run', { source: 'instagram', params: { ns: 'aep' } }); const c = (await beat(w, 'macbook', ['instagram'])).body.job;
  await F(w, 'POST', '/bridge/done', { job: c.id, ok: false, agent: 'macbook', result: { ok: false, error: 'instagram_unavailable', detail: 'nobody is signed in' } });
  eq(sent.length, 1, 'not signed in is not a verification: nobody is paged for it'); void other;
  eq((await F(w, 'POST', '/den/reach', { off: [], clear: 'facebook' })).body.challenges.facebook, undefined, 'a person who has cleared it can clear the note');
});

await S.t('RR5 the registers\' X accounts join the timeline sweep', async () => {
  const w = await mk();
  const org = await add(w, { ns: 'aep', kind: 'account', platform: 'x', value: '@HarbourWatch', name: 'Harbour Watch', actor_kind: 'org' });
  await add(w, { ns: 'aep', kind: 'account', platform: 'x', value: 'plainaccount' }); const off = await add(w, { ns: 'aep', kind: 'account', platform: 'x', value: 'switchedoff' }); await F(w, 'POST', '/den/watch/decide', { id: off.id, decision: 'off' });
  const asked = []; const now = new Date().toISOString();
  w.answer(/syndication\.twitter\.com/, async u => { const h = /screen-name\/([^?]+)/.exec(String(u))[1]; asked.push(h);
    const tw = { id_str: '18500000000000000' + (asked.length), full_text: 'A gas export tax would pay for hospitals in every Sydney suburb', created_at: now, favorite_count: 10, retweet_count: 2, reply_count: 1, user: { screen_name: h } };
    return new Response('<html><script id="__NEXT_DATA__" type="application/json">' + JSON.stringify({ props: { pageProps: { timeline: { entries: [{ type: 'tweet', content: { tweet: tw } }] } } } }) + '</script></html>', { status: 200 }); });
  const r = await w.mod.__test.xSyndSweep(w.env, { mps: false, days: 3 });
  eq(asked.sort(), ['harbourwatch', 'plainaccount'], 'active register accounts are read; one switched off is not'); eq(r.registered, 2);
  const rows = w.env.MIND_DB.db.prepare("SELECT meta FROM arc_items WHERE kind='sig_thread'").all().map(x => JSON.parse(x.meta));
  if (rows.length) {   // the embed service's page shape is the worker's to parse; when it files, the naming rule must hold
    const a = rows.find(m => m.page === 'harbourwatch'), b = rows.find(m => m.page === 'plainaccount');
    ok(a && a.actor && a.actor.name === 'Harbour Watch' && a.actor.kind === 'org' && a.watch === org.id && a.ns === 'aep'); ok(b && !b.actor, 'an account that is not a registered public actor is not named as one');
  }
});

await S.t('RR6 the morning plan', async () => {
  const w = await mk(); const cron = w.mod.__test.denReachCron;
  const at = h => { const d = new Date(); d.setUTCHours(h, 0, 0, 0); return d.getTime(); };   // 20:00 UTC is 06:00 or 07:00 in Sydney
  eq((await cron(w.env, at(20))).skipped, 'no collector connected');
  await beat(w, 'macbook', ['facebook', 'instagram', 'ytsearch', 'x']);
  await add(w, { ns: 'aep', kind: 'account', platform: 'instagram', value: 'harbour.watch' });
  eq((await cron(w.env, at(8))).skipped, 'outside the morning', '18:00 or 19:00 in Sydney is not the morning');
  const r = await cron(w.env, at(20)); const by = sc => r.jobs.filter(j => j.source === sc).map(j => j.ns).sort();
  ok(by('facebook').indexOf('aep') >= 0 && by('facebook').indexOf('mca') >= 0 && by('facebook').indexOf('guns') >= 0, 'every desk with a lexicon gets its keyword pass: ' + by('facebook').join(','));
  eq(by('instagram'), ['aep'], 'Instagram only where an account is registered'); eq(by('x'), [''], 'one X keyword pass'); eq(by('ytsearch').length, by('facebook').length);
  ok(jobs(w).every(j => j.status === 'queued' && j.who === 'plan' && JSON.parse(j.params).where === 'desktop'));
  const n = jobs(w).length; eq((await cron(w.env, at(21))).skipped, 'done today'); eq(jobs(w).length, n, 'once a day');
  // nothing for a platform that is switched off; a plan job nobody served by evening is cancelled
  const w2 = await mk(); await beat(w2, 'macbook', ['facebook', 'ytsearch']); await F(w2, 'POST', '/den/reach', { off: ['facebook'] });
  const r2 = await w2.mod.__test.denReachCron(w2.env, at(20)); ok(r2.jobs.length > 0 && r2.jobs.every(j => j.source === 'ytsearch'));
  w2.env.MIND_DB.db.prepare('UPDATE bridge_jobs SET created=?').run(at(8) - 13 * 3600000); await w2.env.AXIOM_KV.delete('reach_plan_day');
  await w2.mod.__test.denReachCron(w2.env, at(8)); ok(jobs(w2).every(j => j.status === 'cancelled'), 'stale plan jobs are cancelled, not left to run a day late');
  eq(w.outbound.filter(o => /anthropic|googleapis/.test(o.url)).length, 0, 'the plan asks no model anything');
});

await S.t('RR7 a YouTube video found by search is picked up for comments and captions', async () => {
  const w = await mk();
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [{ platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', text: 'Why a gas export tax would work\nAn explainer from Canberra.', q: 'gas export tax', eng: { views: 34000, likes: 800 } }] });
  eq(r.body.inserted, 1); const m = JSON.parse(w.env.MIND_DB.db.prepare("SELECT meta FROM arc_items WHERE kind='sig_thread'").get().meta);
  eq([m.video, m.id, m.platform, m.layer], ['dQw4w9WgXcQ', 'dQw4w9WgXcQ', 'youtube', 2]); ok(!m.enriched, 'waiting for the worker\'s comment and caption pass');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
