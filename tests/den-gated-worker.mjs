/* The monitoring desk, release 4 (prompts/annes-den.md Phase 4): subscriber news, newsletters and monitoring exports,
 * against the worker module in this process. No publisher is contacted; the article text is invented. Each case fails
 * on the p55 commit.
 *   GA1 a source says how it is read; a paid one is cleared only with the basis in words, by a full key, and can be uncleared
 *   GA2 the subscriber read is refused for a source that is not cleared, and for a row with no registry source
 *   GA3 subscriber text is kept apart: the archive row keeps its public summary, and the text is given only to a person
 *       signed in with their own key - never to public mode, a guest link, or anything that reads the archive row
 *   GA4 a page that still shows its paywall is recorded as that, never saved as the article
 *   GA5 one article on request: a job for the Mac that holds the publisher's profile; refused when not cleared, capped a day
 *   GA6 the tick queues only issue-tagged headlines of cleared sources, only when a collector with a profile is connected,
 *       once each, and asks no model anything
 *   GA7 a newsletter is filed under a cleared source with its text kept for the team; one that is not cleared is refused
 *   GA8 a monitoring export: what was new to AXIOM and what it already held are counted; nothing is filed twice
 *   GA9 a quotation from subscriber text is thirty words at most
 * Run: node --experimental-sqlite tests/den-gated-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 4: gated and important news');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({}, env || {}), keys: KEYS });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const ARTICLE = ('The Senate will vote on a gas export tax this week after the crossbench secured a debate. '.repeat(3) + 'Industry figures said the measure would deter investment in new supply. ').repeat(4) + 'ENDMARK-SUBSCRIBER-TEXT';
const news = async (w, o) => { const r = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [Object.assign({ src: 'afr', title: 'Senate to vote on a gas export tax', body: 'The Senate will vote this week.', url: 'https://www.afr.com/politics/gas-export-tax-20261110', ts: Date.now() - 3600000,
  meta: { reg: 1, source: 'afr', tier: 'national', issues: ['gastax', 'gas'] } }, o || {})] }); if (!r.body.ok) throw new Error(JSON.stringify(r.body)); return w.env.MIND_DB.db.prepare("SELECT * FROM arc_items WHERE kind='news' ORDER BY id DESC LIMIT 1").get(); };
const clear = (w, id, access) => F(w, 'POST', '/sources/access', { id, access: access || 'subscriber', cleared: true, basis: 'The agency holds a corporate subscription that permits internal monitoring.' });
const beat = (w, sources) => F(w, 'GET', '/bridge/next?agent=macbook&sources=' + sources.join(','));
const jobs = w => w.env.MIND_DB.db.prepare('SELECT * FROM bridge_jobs ORDER BY created, id').all();
const blobOf = async (w, key, paths) => { let s = ''; for (const p of paths) s += (await w.call('GET', p, null, key)).text; return s; };

await S.t('GA1 how a source is read, and who cleared it', async () => {
  const w = await mk(); const list = (await w.call('GET', '/sources?q=afr', null, 'read-key')).body.sources; const afr = list.find(s => s.id === 'afr');
  eq([afr.access, afr.cleared], ['subscriber', false], 'the seed knows the masthead charges; nobody has cleared it');
  eq((await w.call('GET', '/sources?q=nopsema', null, 'read-key')).body.sources.find(s => s.id === 'nopsema').access, 'official');
  eq((await w.call('GET', '/sources?q=thepoint', null, 'read-key')).body.sources.find(s => s.id === 'thepoint').access, 'open');
  const noBasis = await F(w, 'POST', '/sources/access', { id: 'afr', cleared: true }); eq([noBasis.status, noBasis.body.error], [400, 'basis_required']); ok(/subscription the agency holds/.test(noBasis.body.detail));
  eq((await w.call('POST', '/sources/access', { id: 'afr', cleared: true, basis: 'a long enough basis sentence' }, 'read-key')).status, 403);
  const open = await F(w, 'POST', '/sources/access', { id: 'thepoint', cleared: true, basis: 'a long enough basis sentence' }); eq(open.body.error, 'nothing_to_clear');
  const c = (await clear(w, 'afr')).body.source; eq([c.access, c.cleared, c.cleared_by], ['subscriber', true, 'Anne']); ok(c.cleared_at > 0 && /corporate subscription/.test(c.cleared_basis));
  ok((await w.call('GET', '/sources?q=afr', null, 'read-key')).body.sources.find(s => s.id === 'afr').cleared, 'and the Sources view shows it');
  eq((await F(w, 'POST', '/sources/access', { id: 'afr', cleared: false })).body.source.cleared, false);
  eq((await F(w, 'POST', '/sources/access', { id: 'thepoint', access: 'newsletter' })).body.source.access, 'newsletter');
  eq((await F(w, 'POST', '/sources/access', { id: 'afr', access: 'free-for-all' })).body.error, 'bad_access'); eq((await F(w, 'POST', '/sources/access', { id: 'nope' })).status, 404);
});

await S.t('GA2 refused until the source is cleared', async () => {
  const w = await mk(); const row = await news(w);
  const r = await F(w, 'POST', '/fulltext/save', { id: row.id, text: ARTICLE, gated: true, source: 'afr' });
  eq([r.status, r.body.error], [409, 'source_not_cleared']); ok(/headlines only/.test(r.body.detail));
  const orphan = await news(w, { src: 'somewhere', url: 'https://example.com.au/a', meta: { issues: ['gas'] } });
  eq((await F(w, 'POST', '/fulltext/save', { id: orphan.id, text: ARTICLE, gated: true })).body.error, 'source_unknown');
  eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) n FROM arc_gated').get().n, 0, 'nothing was kept');
  eq((await w.call('POST', '/fulltext/save', { id: row.id, text: ARTICLE, gated: true }, 'read-key')).status, 403);
});

await S.t('GA3 subscriber text is kept apart and given only to the team', async () => {
  const w = await workerEnv({ env: { SIFA_INBOUND_KEY: 'sifa-partner-key-123456', AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-key-1234': { n: 'Tester', r: 'full' } }) }, keys: KEYS });
  const row = await news(w); await clear(w, 'afr');
  const sv = await F(w, 'POST', '/fulltext/save', { id: row.id, text: ARTICLE, gated: true, source: 'afr' });
  eq([sv.status, sv.body.ok, sv.body.method, sv.body.gated], [200, true, 'subscriber', true]);
  const kept = w.env.MIND_DB.db.prepare('SELECT * FROM arc_items WHERE id=?').get(row.id); const meta = JSON.parse(kept.meta);
  eq(kept.body, 'The Senate will vote this week.', 'the archive row keeps its public summary'); eq([meta.ft, meta.gated, meta.layer, meta.access], ['subscriber', 1, 2, 'subscriber']);
  ok(w.env.MIND_DB.db.prepare('SELECT text, by FROM arc_gated WHERE item=?').get(row.id).text.indexOf('ENDMARK-SUBSCRIBER-TEXT') > 0);
  const mine = await w.call('GET', '/fulltext?id=' + row.id, null, 'read-key'); eq([mine.status, mine.body.gated, mine.body.method], [200, true, 'subscriber']); ok(mine.body.text.indexOf('ENDMARK') > 0 && /thirty|30 words/.test(mine.body.note));
  ok((await w.call('GET', '/fulltext?url=' + encodeURIComponent(row.url), null, 'full-key')).body.text.indexOf('ENDMARK') > 0, 'by address too');
  const guest = await w.call('GET', '/fulltext?id=' + row.id, null, 'guest-key-1234'); ok(guest.status === 403 && !/ENDMARK/.test(guest.text), 'a guest link is not given it: ' + guest.status);
  // everything else that reads the archive row - for anyone - never holds the text
  const paths = ['/allnews', '/archive/stats', '/overview?days=1', '/sources?q=afr', '/signals/status', '/sentiment/items?days=1', '/narratives?days=1', '/den/plan?ns=aep'];
  ok(!/ENDMARK-SUBSCRIBER-TEXT/.test(await blobOf(w, 'read-key', paths)), 'no list, feed or summary route returns subscriber text');
  // the partner system, which signs in with its own key: the topic's results name the article and never carry its text
  const tp = await F(w, 'POST', '/topics/add', { keyword: 'gas export tax', ns: 'aep' }); ok(tp.body.ok !== false, 'topic added: ' + tp.text.slice(0, 120));
  const sifa = await w.call('GET', '/sifa/results?keyword=' + encodeURIComponent('gas export tax') + '&days=7', null, null, { Authorization: 'Bearer sifa-partner-key-123456' });
  eq(sifa.status, 200, 'the partner route answers: ' + sifa.text.slice(0, 160)); ok(!/ENDMARK-SUBSCRIBER-TEXT/.test(sifa.text), 'the partner system is never sent subscriber text');
  // public mode: the keyless reader gets the reason, never the text
  const pub = await workerEnv({ env: { AXIOM_PUBLIC: 'read' }, keys: KEYS }); const prow = await news(pub); await clear(pub, 'afr');
  await F(pub, 'POST', '/fulltext/save', { id: prow.id, text: ARTICLE, gated: true, source: 'afr' });
  const anon = await pub.call('GET', '/fulltext?id=' + prow.id, null, null); eq([anon.status, anon.body.error], [403, 'gated_internal']); ok(!/ENDMARK/.test(anon.text) && /headline and the link/.test(anon.body.detail));
  ok(!/ENDMARK-SUBSCRIBER-TEXT/.test(await blobOf(pub, null, ['/allnews', '/archive/stats', '/overview?days=1'])), 'nor does any keyless route');
});

await S.t('GA4 a page that still shows its paywall', async () => {
  const w = await mk(); const row = await news(w); await clear(w, 'afr');
  const r = await F(w, 'POST', '/fulltext/save', { id: row.id, gated: true, wall: true, source: 'afr' });
  eq([r.status, r.body.error], [422, 'subscription_wall']); ok(/--login news:afr/.test(r.body.detail));
  const meta = JSON.parse(w.env.MIND_DB.db.prepare('SELECT meta FROM arc_items WHERE id=?').get(row.id).meta); eq([meta.ft_g, meta.gated], ['wall', undefined]);
  eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) n FROM arc_gated').get().n, 0);
  eq((await F(w, 'POST', '/fulltext/save', { id: row.id, gated: true, text: 'too short', source: 'afr' })).body.error, 'too_short');
});

await S.t('GA5 one article on request', async () => {
  const w = await mk({ GATED_PER_SOURCE: '2' }); const row = await news(w);
  let r = await F(w, 'POST', '/fulltext/gated', { id: row.id }); eq([r.status, r.body.error], [409, 'source_not_cleared']);
  await clear(w, 'afr'); eq((await w.call('POST', '/fulltext/gated', { id: row.id }, 'read-key')).status, 403);
  r = await F(w, 'POST', '/fulltext/gated', { id: row.id }); eq([r.status, r.body.ok, r.body.where, r.body.source], [200, true, 'desktop', 'afr']);
  const j = jobs(w)[0]; eq([j.source, j.status], ['gated', 'queued']); const p = JSON.parse(j.params); eq([p.id, p.url, p.profile], [row.id, row.url, 'afr']);
  eq((await beat(w, ['reddit', 'render'])).body.job, null, 'a collector without a publisher profile does not take it');
  eq((await beat(w, ['gated'])).body.job.id, j.id);
  await F(w, 'POST', '/fulltext/gated', { id: row.id }); r = await F(w, 'POST', '/fulltext/gated', { id: row.id }); eq([r.status, r.body.error], [429, 'gated_cap']); ok(/does not download the paper/.test(r.body.detail));
  await F(w, 'POST', '/den/reach', { off: ['gated'] }); eq((await F(w, 'POST', '/fulltext/gated', { id: row.id })).body.error, 'reach_off');
  eq((await F(w, 'POST', '/fulltext/gated', { id: 999999 })).status, 404);
});

await S.t('GA6 the tick', async () => {
  const w = await mk(); const cron = w.mod.__test.gatedCron;
  const tagged = await news(w); await news(w, { url: 'https://www.afr.com/markets/asx-closes-higher', title: 'ASX closes higher', meta: { reg: 1, source: 'afr', issues: [] } });
  await news(w, { src: 'thepoint', url: 'https://thepoint.com.au/gas-tax', meta: { reg: 1, source: 'thepoint', issues: ['gastax'] } });
  eq((await cron(w.env)).skipped, 'no collector with a publisher profile is connected');
  await beat(w, ['gated']); eq((await cron(w.env)).skipped, 'no source is cleared for the subscriber read'); eq(jobs(w).length, 0);
  await clear(w, 'afr');
  const r = await cron(w.env); eq(r.queued, 1, 'only the issue-tagged headline of the cleared source');
  eq(JSON.parse(jobs(w)[0].params).id, tagged.id); eq(jobs(w)[0].who, 'plan');
  eq((await cron(w.env)).queued, 0, 'once each'); eq(jobs(w).length, 1);
  eq(w.outbound.filter(o => /anthropic|googleapis|afr\.com/.test(o.url)).length, 0, 'the worker asks no model, and never the publisher');
});

await S.t('GA7 a newsletter', async () => {
  const w = await mk(); const items = [{ title: 'Morning briefing: the gas export tax vote', ts: Date.now() - 7200000, text: ARTICLE }, { title: 'Evening briefing', ts: Date.now() - 3600000, text: 'short' }, { title: 'x' }];
  let r = await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'newsletter', source: 'capitalbrief', items }); eq([r.status, r.body.error], [409, 'source_not_cleared']); ok(/subscriber content/.test(r.body.detail));
  eq((await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'newsletter', source: 'nope', items })).status, 404);
  await clear(w, 'capitalbrief');
  r = await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'newsletter', source: 'capitalbrief', items });
  eq([r.body.ok, r.body.added, r.body.gated, r.body.on_topic, r.body.skipped.empty], [true, 2, 1, 1, 1]);
  const rows = w.env.MIND_DB.db.prepare("SELECT * FROM arc_items WHERE kind='news' ORDER BY id").all(); eq(rows.length, 2);
  const m = JSON.parse(rows[0].meta); eq([rows[0].body, m.method, m.gated, m.source, m.ns], ['', 'newsletter', 1, 'capitalbrief', 'aep'], 'the row holds the headline; the words are subscriber text'); ok(m.issues.indexOf('gastax') >= 0);
  ok(w.env.MIND_DB.db.prepare('SELECT text FROM arc_gated WHERE item=?').get(rows[0].id).text.indexOf('ENDMARK') > 0);
  const again = await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'newsletter', source: 'capitalbrief', items }); eq([again.body.added, again.body.held], [0, 2], 'the same newsletter is not filed twice');
  eq((await w.call('POST', '/den/import', { ns: 'aep', kind: 'newsletter', source: 'capitalbrief', items }, 'read-key')).status, 403);
  eq((await F(w, 'POST', '/den/import', { ns: 'nobody', kind: 'monitor', items })).body.error, 'unknown_ns'); eq((await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'rss', items })).body.error, 'bad_kind');
});

await S.t('GA8 a monitoring export', async () => {
  const w = await mk(); await news(w, { src: 'abc', url: 'https://www.abc.net.au/news/2026-11-10/gas-export-tax/1', title: 'Gas export tax debate', meta: { reg: 1, source: 'abc', issues: ['gastax'] } });
  const items = [{ title: 'Gas export tax debate', url: 'https://www.abc.net.au/news/2026-11-10/gas-export-tax/1?utm_source=monitor', outlet: 'ABC News', ts: '2026-11-10T03:00:00Z', text: 'The debate over a gas export tax continued.' },
    { title: 'Greens renew call for windfall tax on gas', url: 'https://example-regional.com.au/story/windfall', outlet: 'Regional Daily', ts: '2026-11-10T04:00:00Z', text: 'A windfall tax on gas companies.' },
    { title: 'How to cook with gas: five recipes', url: 'https://example-food.com.au/recipes', outlet: 'Food Weekly', ts: '2026-11-10T05:00:00Z', text: 'Recipes.' }, { title: 'No link', url: 'not-a-link' }];
  const r = await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'monitor', items });
  eq([r.body.received, r.body.added, r.body.held, r.body.skipped.bad_url], [4, 2, 1, 1]); ok(/2 new to AXIOM, 1 already held/.test(r.body.summary));
  const row = w.env.MIND_DB.db.prepare("SELECT * FROM arc_items WHERE src='monitor' AND url LIKE '%windfall'").get(); const m = JSON.parse(row.meta);
  eq([m.via, m.outlet, m.ns], ['monitor', 'Regional Daily', 'aep']); ok(m.issues.indexOf('gastax') >= 0 && !m.gated, 'a monitoring excerpt is the service\'s own, not subscriber text');
  eq((await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'monitor', items })).body.added, 0);
  eq((await F(w, 'POST', '/den/import', { ns: 'aep', kind: 'monitor', items: Array.from({ length: 301 }, (_, i) => ({ title: 'Story ' + i, url: 'https://example.com.au/' + i })) })).status, 413);
});

await S.t('GA9 a quotation from subscriber text', async () => {
  const w = await mk(); const ex = w.mod.__test.gatedExcerpt;
  const long = Array.from({ length: 80 }, (_, i) => 'word' + i).join(' ');
  eq(ex(long).split(' ').length, 31, 'thirty words and the mark that more follows'); ok(/ \.\.\.$/.test(ex(long)) && ex('four short words here') === 'four short words here');
  const row = await news(w); await clear(w, 'afr'); await F(w, 'POST', '/fulltext/save', { id: row.id, text: ARTICLE, gated: true, source: 'afr' });
  const got = (await F(w, 'GET', '/fulltext?id=' + row.id)).body; ok(got.excerpt.split(' ').length <= 31 && got.excerpt.length < 260);
  const t = await w.mod.__test.gatedTexts(w.env, [row.id, 424242]); ok(t[row.id].indexOf('ENDMARK') > 0 && !t[424242], 'the team\'s own analysis reads it by row');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
