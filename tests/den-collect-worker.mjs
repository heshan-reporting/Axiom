/* The monitoring desk, release 2 (prompts/annes-den.md Phase 2): the ground every collector stands on, against the worker
 * module in this process. No provider is contacted: the Graph API is a recording stub. Every post, page and group here is
 * invented. Each case fails on the p53 commit.
 *   PL1 one post, one address: the shared cases in tests/fixtures/den/permalinks.json
 *   WR1 the watch register: what a person types is normalised; a duplicate, an unknown client and a bad value are refused in words
 *   WR2 proposals wait for a person; a dismissal needs a reason and is never proposed again; roles; one client's register only
 *   PN1 the day's plan: active rows inside the caps, stalest first, with the hashtag allowance
 *   IN1 a registered public actor's posts: on the desk's topics kept, the rest counted; the actor named, nobody else
 *   IN2 a post found by search: the Australian gate with the term struck out; never a name
 *   IN3 one post from two layers is one row with the newer count and both layers; one snapshot a day
 *   IN4 comments keep their words and tone under their thread, never their author
 *   IN5 how far a news story travelled on Facebook is written on the news row
 *   IN6 refusals: too many rows, no layer, an unknown client; a read key, no key and a guest key
 *   IN7 a register row of another client names nobody here
 *   IG1 Business Discovery: not configured says what to set; configured, the registered accounts' posts are filed
 *   IG2 the hashtag allowance: the thirty-first new hashtag in a week is refused and named; a hashtag inside the window is free
 *   FB1 Facebook pages: Meta's refusal is named as the missing permission, never an empty success
 *   PR1 the Meta probe lists what each public route still needs, as optional steps that never block the others
 *   CV1 the coverage table says how Facebook and Instagram are read, what is set and what cannot be reached
 *   AL1 the Ad Library searches the desks' approved terms beside the issue labels
 *   SG1 what was filed is read back through the Signals routes with its counts
 * Run: node --experimental-sqlite tests/den-collect-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Monitoring desk, release 2: the watch register and one way in');
const CASES = JSON.parse(fs.readFileSync(new URL('./fixtures/den/permalinks.json', import.meta.url), 'utf8')).cases;
const mk = async env => workerEnv({ env: Object.assign({}, env || {}), keys: { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } });
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const add = async (w, o) => { const r = await F(w, 'POST', '/den/watch/add', o); if (r.status !== 200) throw new Error('add failed: ' + JSON.stringify(r.body)); return r.body.watch; };
const rowsOf = (w, kind) => w.env.MIND_DB.db.prepare('SELECT * FROM arc_items WHERE kind=? ORDER BY id').all(kind).map(r => Object.assign(r, { meta: JSON.parse(r.meta || '{}') }));
const NAMES = /Jo Citizen|jo_citizen|Sam Private|sam\.private/;
const POST = (o) => Object.assign({ platform: 'facebook', url: 'https://www.facebook.com/108000000000001_990000000000002', text: 'Harbour Watch: the gas export tax petition has passed 40,000 signatures. Sign it.', ts: Date.now() - 3600000,
  eng: { likes: 120, comments: 14, shares: 9, reactions: { love: 20, angry: 3 } }, author: 'Jo Citizen', username: 'jo_citizen', from_name: 'Jo Citizen' }, o || {});

await S.t('PL1 one post, one address', async () => {
  const w = await mk(); const canon = w.mod.__test.canonPermalink;
  CASES.forEach(c => eq(canon(c.platform, c.in), c.out, c.platform + ' ' + c.in));
});

await S.t('WR1 the watch register', async () => {
  const w = await mk();
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'https://www.facebook.com/HarbourWatch/', name: 'Harbour Watch', actor_kind: 'org', reason: 'cited weekly' });
  eq([a.value, a.status, a.actor_kind, a.added_by, a.ns], ['harbourwatch', 'active', 'org', 'Anne', 'aep']);
  eq((await add(w, { ns: 'aep', kind: 'account', platform: 'x', value: '@HarbourWatch' })).value, 'harbourwatch');
  eq((await add(w, { ns: 'aep', kind: 'account', platform: 'instagram', value: 'https://instagram.com/harbour.watch/' })).value, 'harbour.watch');
  eq((await add(w, { ns: 'aep', kind: 'hashtag', platform: 'instagram', value: '#SaveTheFerry' })).value, 'savetheferry');
  const t = await add(w, { ns: 'aep', kind: 'term', value: '  Night   Boat  levy ' }); eq([t.value, t.platform], ['night boat levy', 'any']);
  eq((await add(w, { ns: 'aep', kind: 'source', value: 'https://www.Example.com.au/news/' })).value, 'example.com.au');
  eq((await add(w, { ns: 'aep', kind: 'group', value: 'https://www.facebook.com/groups/HarbourFriends/' })).value, 'harbourfriends');
  const dup = await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'facebook', value: 'HarbourWatch' });
  eq([dup.status, dup.body.error, dup.body.id], [409, 'watch_exists', a.id]); ok(/already in this register/.test(dup.body.detail));
  for (const [body, code] of [[{ ns: 'nobody', kind: 'term', value: 'x y' }, 'unknown_ns'], [{ ns: 'aep', kind: 'page', value: 'x' }, 'bad_kind'], [{ ns: 'aep', kind: 'account', value: 'harbourwatch' }, 'bad_platform'],
    [{ ns: 'aep', kind: 'account', platform: 'x', value: 'not a handle!' }, 'bad_value'], [{ ns: 'aep', kind: 'hashtag', platform: 'instagram', value: '#' }, 'bad_value'],
    [{ ns: 'aep', kind: 'term', value: 'ferry fares', actor_kind: 'org' }, 'bad_actor_kind'], [{ ns: 'aep', kind: 'account', platform: 'x', value: 'someone', actor_kind: 'person' }, 'bad_actor_kind']]) {
    const r = await F(w, 'POST', '/den/watch/add', body); eq([r.status, r.body.error], [400, code], JSON.stringify(body)); ok(r.body.detail && r.body.detail.length > 20, code + ' is said in words');
  }
  const list = (await w.call('GET', '/den/watch?ns=aep', null, 'read-key')).body; eq(list.watch.length, 7); eq(list.counts.account.active, 3);
  eq((await w.call('GET', '/den/watch?ns=aep&kind=account&platform=x', null, 'read-key')).body.watch.length, 1);
  const up = await F(w, 'POST', '/den/watch/update', { id: a.id, name: 'Harbour Watch Inc', issue: 'gastax', score: 12 }); eq([up.body.watch.name, up.body.watch.issue, up.body.watch.score], ['Harbour Watch Inc', 'gastax', 12]);
  eq((await F(w, 'POST', '/den/watch/delete', { id: t.id })).body.deleted, 1); eq((await F(w, 'POST', '/den/watch/delete', { id: t.id })).status, 404);
});

await S.t('WR2 proposals, decisions, roles and walls', async () => {
  const w = await mk();
  const p = await F(w, 'POST', '/den/watch/propose', { ns: 'aep', source: 'reports', items: [{ kind: 'term', value: 'ferry levy', evidence: [{ item: 1, snippet: 'the ferry levy is back' }], score: 4 },
    { kind: 'hashtag', platform: 'instagram', value: '#nightboat' }, { kind: 'account', platform: 'x', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' }, { kind: 'account', platform: 'x', value: 'bad handle' }] });
  eq([p.body.proposed, p.body.known, p.body.refused.length], [3, 0, 1]);
  let list = (await F(w, 'GET', '/den/watch?ns=aep&status=proposed')).body.watch; eq(list.length, 3); eq(list.find(x => x.kind === 'term').evidence[0].snippet, 'the ferry levy is back');
  eq((await F(w, 'GET', '/den/plan?ns=aep')).body.terms, [], 'a proposal is not read until a person approves it');
  const term = list.find(x => x.kind === 'term'), tag = list.find(x => x.kind === 'hashtag');
  const noWhy = await F(w, 'POST', '/den/watch/decide', { id: tag.id, decision: 'dismiss' }); eq([noWhy.status, noWhy.body.error], [400, 'reason_required']);
  eq((await F(w, 'POST', '/den/watch/decide', { id: tag.id, decision: 'dismiss', reason: 'a boating forum, not the campaign' })).body.watch.status, 'dismissed');
  const ap = await F(w, 'POST', '/den/watch/decide', { id: term.id, decision: 'approve' }); eq([ap.body.watch.status, ap.body.watch.decided_by], ['active', 'Anne']);
  eq((await F(w, 'GET', '/den/plan?ns=aep')).body.terms, ['ferry levy']);
  const again = await F(w, 'POST', '/den/watch/propose', { ns: 'aep', items: [{ kind: 'hashtag', platform: 'instagram', value: 'nightboat' }, { kind: 'term', value: 'ferry levy' }] });
  eq([again.body.proposed, again.body.known], [0, 2], 'a dismissed or known thing is not proposed again');
  eq((await F(w, 'GET', '/den/watch?ns=aep&status=dismissed')).body.watch.length, 1);
  eq((await F(w, 'POST', '/den/watch/decide', { id: term.id, decision: 'off' })).body.watch.status, 'off'); eq((await F(w, 'GET', '/den/plan?ns=aep')).body.terms, []);
  // roles
  eq((await w.call('POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'x y' }, 'read-key')).status, 403);
  eq((await w.call('POST', '/den/watch/decide', { id: term.id, decision: 'approve' }, 'read-key')).status, 403);
  eq((await w.call('GET', '/den/watch?ns=aep', null, null)).status, 401);
  // walls: another client's register is another list, and a register is never read without naming its client
  await add(w, { ns: 'mca', kind: 'term', value: 'haul road levy' });
  ok(!(await F(w, 'GET', '/den/watch?ns=aep')).body.watch.some(x => x.value === 'haul road levy'));
  eq((await F(w, 'GET', '/den/watch?ns=mca')).body.watch.length, 1);
  const none = await F(w, 'GET', '/den/watch'); eq([none.status, none.body.error], [400, 'unknown_ns']);
});

await S.t('PN1 the day\'s plan', async () => {
  const w = await mk();
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  const b = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'baykeepers' });
  await add(w, { ns: 'aep', kind: 'account', platform: 'instagram', value: 'harbour.watch' }); await add(w, { ns: 'aep', kind: 'hashtag', platform: 'instagram', value: 'savetheferry' });
  await add(w, { ns: 'aep', kind: 'term', value: 'ferry levy' }); await add(w, { ns: 'mca', kind: 'account', platform: 'facebook', value: 'someoneelse' });
  w.env.MIND_DB.db.prepare('UPDATE den_watch SET last_ok=? WHERE id=?').run(Date.now(), a.id);
  await F(w, 'POST', '/archive/add', { kind: 'news', rows: [{ src: 'test', title: 'Senate to vote on a gas export tax', url: 'https://example.com.au/gas-export-tax', ts: Date.now() - 3600000 }, { src: 'test', title: 'Ferry timetable changes', url: 'https://example.com.au/ferry', ts: Date.now() - 3600000 }] });
  const p = (await w.call('GET', '/den/plan?ns=aep', null, 'read-key')).body;
  eq(p.plan.facebook.accounts.map(x => x.value), ['baykeepers', 'harbourwatch'], 'the stalest account first, and only this client\'s');
  eq(p.plan.instagram.accounts.map(x => x.value), ['harbour.watch']); eq(p.plan.instagram.hashtags.map(x => x.value), ['savetheferry']);
  eq([p.plan.instagram.hashtagAllowance.used, p.plan.instagram.hashtagAllowance.left, p.plan.instagram.hashtagAllowance.limit], [0, 30, 30]);
  eq(p.terms, ['ferry levy']); ok(p.queries.indexOf('gas export tax') >= 0 && p.queries.indexOf('ferry levy') >= 0, 'the client\'s search terms and its approved terms');
  eq(p.urls, ['https://example.com.au/gas-export-tax'], 'only news on this client\'s issues');
  eq(Object.keys((await F(w, 'GET', '/den/plan?ns=aep&platform=instagram')).body.plan), ['instagram']);
  await add(w, { ns: 'synthdemo', kind: 'term', value: 'night boat levy' });
  eq((await F(w, 'GET', '/den/plan?ns=synthdemo')).body.queries, ['night boat levy'], 'a client with no lexicon of its own searches its own terms, never another client\'s');
  void b;
});

await S.t('IN1 a registered public actor', async () => {
  const w = await mk();
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  const plain = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'baykeepers' });
  await add(w, { ns: 'aep', kind: 'term', value: 'night boat levy' });
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'supermetrics', rows: [POST({ watch: a.id }),
    POST({ watch: a.id, url: 'https://www.facebook.com/108000000000001_990000000000003', text: 'Our bake sale is on Saturday. Bring a plate.' }),
    POST({ watch: a.id, url: 'https://www.facebook.com/108000000000001_990000000000004', text: 'The night boat levy is unfair on shift workers.' }),
    POST({ watch: plain.id, url: 'https://www.facebook.com/108000000000009_990000000000005', text: 'Windfall tax on gas companies now.' })] });
  eq([r.status, r.body.received, r.body.kept, r.body.inserted, r.body.skipped.off_topic], [200, 4, 3, 3, 1]);
  const rows = rowsOf(w, 'sig_thread'); eq(rows.length, 3);
  const one = rows.find(x => x.url === 'https://www.facebook.com/108000000000001/posts/990000000000002');
  ok(one, 'filed under the canonical address'); eq([one.src, one.author, one.meta.platform, one.meta.layer, one.meta.via, one.meta.ns], ['facebook', '', 'facebook', 1, 'supermetrics', 'aep']);
  eq(one.meta.actor, { id: a.id, name: 'Harbour Watch', kind: 'org' }); eq(one.meta.watch, a.id); ok(one.meta.issues.indexOf('gastax') >= 0);
  eq([one.meta.eng.likes, one.meta.eng.comments, one.meta.eng.shares, one.meta.eng.reactions.love, one.meta.eng.reactions.angry], [120, 14, 9, 20, 3]); ok(one.meta.eng_at > 0);
  eq(rows.find(x => /night boat/.test(x.body)).meta.term, 'night boat levy', 'an approved term keeps a post the lexicon does not tag');
  const un = rows.find(x => /Windfall tax/.test(x.body)); ok(un.meta.watch === plain.id && !un.meta.actor, 'a registered account that is not a named public actor is not named');
  ok(!NAMES.test(JSON.stringify(rows)), 'nothing the collector sent about a person is stored');
  const reg = (await F(w, 'GET', '/den/watch?ns=aep&kind=account')).body.watch.find(x => x.id === a.id); ok(reg.last_ok > 0 && reg.last_layer === 1, 'the register knows the account delivered, and by which layer');
});

await S.t('IN2 a post found by search', async () => {
  const w = await mk();
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [
    POST({ platform: 'x', url: 'https://x.com/sam_private/status/1850000000000000001', text: 'California raises the gas tax again and drivers are furious', q: 'gas tax' }),
    POST({ platform: 'x', url: 'https://x.com/jo_citizen/status/1850000000000000002', text: 'A gas export tax would pay for Medicare bulk billing in every Sydney suburb', q: 'gas export tax' }),
    POST({ platform: 'instagram', url: 'https://www.instagram.com/reel/DAbCdEfGhI1/', text: 'Stop the drilling #savescottreef', hashtag: '#SaveScottReef' }),
    POST({ platform: 'instagram', url: 'https://www.instagram.com/p/DAbCdEfGhI2/', text: 'Stop the drilling off Western Australia #savescottreef', hashtag: 'savescottreef' }),
    POST({ platform: 'x', url: 'https://x.com/jo_citizen', text: 'gas export tax now, Canberra' }), POST({ platform: 'myspace', url: 'https://myspace.com/x', text: 'gas export tax Canberra' }),
    POST({ platform: 'x', url: 'https://x.com/a/status/1850000000000000009', text: '  ' })] });
  eq([r.body.kept, r.body.skipped.foreign, r.body.skipped.bad_url, r.body.skipped.unknown_platform, r.body.skipped.empty], [2, 2, 1, 1, 1]);
  const rows = rowsOf(w, 'sig_thread'); eq(rows.map(x => x.url).sort(), ['https://www.instagram.com/p/DAbCdEfGhI2/', 'https://x.com/i/web/status/1850000000000000002']);
  rows.forEach(x => { ok(!x.meta.actor && !x.meta.watch && x.author === '' && x.meta.page === '', 'an account nobody registered is never named'); eq(x.meta.layer, 2); });
  ok(!NAMES.test(JSON.stringify(rows)) && JSON.stringify(rows).indexOf('jo_citizen') < 0, 'the handle in the address is gone too');
  eq(rows.find(x => x.src === 'instagram').meta.hashtag, 'savescottreef');
});

await S.t('IN3 one post from two layers', async () => {
  const w = await mk(); const t0 = Date.now() - 2 * 86400000, t1 = Date.now() - 3600000;
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  const first = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [POST({ url: 'https://m.facebook.com/story.php?story_fbid=990000000000002&id=108000000000001', q: 'gas export tax australia', eng: { likes: 100, comments: 10, shares: 5 }, eng_at: t0 })] });
  eq([first.body.inserted, first.body.updated, first.body.snapshots], [1, 0, 1]);
  const second = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [POST({ watch: a.id, eng: { likes: 180, comments: 31, shares: 12 }, eng_at: t1 })] });
  eq([second.body.inserted, second.body.updated, second.body.snapshots], [0, 1, 1]);
  let rows = rowsOf(w, 'sig_thread'); eq(rows.length, 1, 'one row');
  eq([rows[0].meta.eng.likes, rows[0].meta.eng.comments, rows[0].meta.layers, rows[0].meta.eng_at], [180, 31, [1, 2], t1]); eq(rows[0].meta.actor.name, 'Harbour Watch', 'the later read knew whose page it was');
  const stale = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [POST({ q: 'gas export tax australia', eng: { likes: 90 }, eng_at: t0 + 1000 })] });
  eq(stale.body.updated, 1); rows = rowsOf(w, 'sig_thread'); eq([rows[0].meta.eng.likes, rows[0].meta.eng_at], [180, t1], 'an older read never overwrites a newer count');
  const again = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [POST({ watch: a.id, eng: { likes: 200, comments: 33, shares: 12 }, eng_at: t1 + 60000 })] });
  eq(again.body.updated, 1);
  const snaps = rowsOf(w, 'sig_eng'); eq(snaps.length, 2, 'one snapshot a day: two days, two rows, the later read of a day replacing the earlier');
  eq(snaps.map(x => x.meta.eng.likes).sort((x, y) => x - y), [100, 200]); ok(snaps.every(x => x.meta.u === rows[0].url && /^x:eng:/.test(x.url)));
});

await S.t('IN4 comments', async () => {
  const w = await mk();
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'youtube', value: 'UCabcdefghijklmnopqrstuv', name: 'Harbour Watch', actor_kind: 'org' });
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [POST({ platform: 'youtube', url: 'https://youtu.be/dQw4w9WgXcQ', watch: a.id, text: 'Why a gas export tax would work' })],
    comments: [{ platform: 'youtube', thread_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', id: 'c1', text: 'This is a disgrace, they pay nothing', likes: 7, author: 'Sam Private', username: 'sam.private' },
      { platform: 'youtube', thread_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'c2', text: 'Great explainer, thank you', depth: 1 }, { platform: 'youtube', thread_url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa', id: 'c3', text: 'orphan' },
      { platform: 'youtube', thread_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', id: 'c4', text: '' }] });
  eq([r.body.comments, r.body.commentRows, r.body.skipped.no_thread, r.body.skipped.empty], [2, 2, 1, 1]);
  const cs = rowsOf(w, 'sig_comment'); eq(cs.length, 2); ok(cs.every(c => c.author === '' && c.meta.platform === 'youtube' && c.meta.issues.indexOf('gastax') >= 0 && c.meta.layer === 2));
  eq(cs.map(c => c.tone).sort(), [-1, 1]); ok(!NAMES.test(JSON.stringify(cs)), 'a commenter is never named');
  const later = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', comments: [{ platform: 'youtube', thread_url: 'https://youtu.be/dQw4w9WgXcQ', id: 'c5', text: 'Tax them properly' }, { platform: 'youtube', thread_url: 'https://youtu.be/dQw4w9WgXcQ', id: 'c1', text: 'This is a disgrace, they pay nothing' }] });
  eq([later.body.comments, later.body.commentRows], [2, 1], 'a comment on a thread already held is filed; one already held is not filed twice');
});

await S.t('IN5 Facebook reach of a news story', async () => {
  const w = await mk();
  await F(w, 'POST', '/archive/add', { kind: 'news', rows: [{ src: 'test', title: 'Senate to vote on a gas export tax', url: 'https://example.com.au/gas-export-tax/', ts: Date.now() - 3600000, meta: { reg: 1 } }] });
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'supermetrics', fb: [{ url: 'https://example.com.au/gas-export-tax?utm_source=x', reactions: 420, comments: 61, shares: 88 }, { url: 'https://example.com.au/unknown', shares: 3 }, { url: 'nonsense' }] });
  eq([r.body.fbUpdated, r.body.skipped.unknown_url, r.body.skipped.bad_url], [1, 1, 1]);
  const n = rowsOf(w, 'news')[0]; eq([n.meta.fb.reactions, n.meta.fb.comments, n.meta.fb.shares, n.meta.reg], [420, 61, 88, 1]); ok(n.meta.fb.at > 0);
});

await S.t('IN6 refusals', async () => {
  const w = await workerEnv({ env: { AXIOM_GUEST_KEYS: JSON.stringify({ 'guest-key-1234': { n: 'Tester', r: 'full' } }) }, keys: { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } } });
  const many = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, rows: Array.from({ length: 501 }, (_, i) => POST({ url: 'https://www.facebook.com/108000000000001_99000000000' + (1000 + i) })) });
  eq([many.status, many.body.error], [413, 'too_many_rows']);
  const noLayer = await F(w, 'POST', '/signals/ingest', { ns: 'aep', rows: [POST()] }); eq([noLayer.status, noLayer.body.error], [400, 'layer_required']);
  const noNs = await F(w, 'POST', '/signals/ingest', { ns: 'nobody', layer: 1, rows: [POST()] }); eq([noNs.status, noNs.body.error], [400, 'unknown_ns']);
  eq((await w.call('POST', '/signals/ingest', { ns: 'aep', layer: 1, rows: [POST()] }, 'read-key')).status, 403);
  eq((await w.call('POST', '/signals/ingest', { ns: 'aep', layer: 1, rows: [POST()] }, null)).status, 401);
  const g = await w.call('POST', '/signals/ingest', { ns: 'aep', layer: 1, rows: [POST()] }, 'guest-key-1234'); eq(g.status, 403, 'a guest link collects nothing: ' + JSON.stringify(g.body));
  eq((await w.call('POST', '/den/watch/add', { ns: 'aep', kind: 'term', value: 'x y' }, 'guest-key-1234')).status, 403);
  eq(rowsOf(w, 'sig_thread').length, 0, 'nothing was filed by any of them');
});

await S.t('IN7 another client\'s register row names nobody here', async () => {
  const w = await mk();
  const theirs = await add(w, { ns: 'mca', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  const r = await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 2, via: 'reach', rows: [POST({ watch: theirs.id, text: 'A gas export tax would pay for hospitals across Queensland' })] });
  eq(r.body.kept, 1); const row = rowsOf(w, 'sig_thread')[0]; ok(!row.meta.actor && !row.meta.watch && row.meta.ns === 'aep');
  eq((await F(w, 'GET', '/den/watch?ns=mca')).body.watch[0].last_ok, 0, 'and their register is not marked as having delivered');
});

const graph = (w, routes) => { const seen = []; w.answer(/graph\.facebook\.com/, (url) => { const u = decodeURIComponent(String(url)); seen.push(u); const J = v => new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } }); for (const [re, fn] of routes) if (re.test(u)) return J(fn(u)); return J({ error: { message: 'unexpected call ' + u.slice(0, 80) } }); }); return seen; };
const MEDIA = [{ id: '1', caption: 'A gas export tax would fund hospitals. Link in bio.', like_count: 900, comments_count: 40, media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/DAbCdEfGhI3/', timestamp: new Date(Date.now() - 7200000).toISOString() },
  { id: '2', caption: 'Thanks to everyone who came to the picnic.', like_count: 50, comments_count: 2, media_type: 'IMAGE', permalink: 'https://www.instagram.com/p/DAbCdEfGhI4/', timestamp: new Date().toISOString() }];

await S.t('IG1 Business Discovery', async () => {
  let w = await mk(); let r = await w.mod.__test.igDiscoverySweep(w.env, { ns: 'aep', pace: 0 });
  eq([r.ok, r.error], [false, 'ig_not_configured']); ok(/META_IG_USER/.test(r.detail));
  w = await mk({ META_TOKEN: 'tok', META_IG_USER: '17841400000000001' });
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'instagram', value: 'harbour.watch', name: 'Harbour Watch', actor_kind: 'org' });
  const bad = await add(w, { ns: 'aep', kind: 'account', platform: 'instagram', value: 'private.person' });
  const seen = graph(w, [[/business_discovery\.username\(harbour\.watch\)/, () => ({ business_discovery: { username: 'harbour.watch', media: { data: MEDIA } } })],
    [/business_discovery\.username\(private\.person\)/, () => ({ error: { message: 'Invalid user id: the account is not a business account' } })]]);
  r = await w.mod.__test.igDiscoverySweep(w.env, { ns: 'aep', pace: 0 });
  eq([r.ok, r.accounts, r.threads, r.threadRows, r.skipped, r.errors.length], [true, 2, 1, 1, 1, 1]); ok(/not a business account/.test(r.errors[0]));
  ok(seen.every(u => u.indexOf('17841400000000001') > 0) && seen.length === 2, 'one read an account, through the agency\'s own Instagram account');
  const row = rowsOf(w, 'sig_thread')[0]; eq([row.url, row.meta.layer, row.meta.via, row.meta.eng.likes, row.meta.actor.name], ['https://www.instagram.com/p/DAbCdEfGhI3/', 1, 'graph', 900, 'Harbour Watch']);
  const reg = (await F(w, 'GET', '/den/watch?ns=aep')).body.watch; ok(reg.find(x => x.id === a.id).last_ok > 0); ok(/not a business account/.test(reg.find(x => x.id === bad.id).last_error), 'the register says why an account did not deliver');
});

await S.t('IG2 the hashtag allowance', async () => {
  const w = await mk({ META_TOKEN: 'tok', META_IG_USER: '17841400000000001' });
  const used = {}; for (let i = 0; i < 29; i++) used['old' + i] = Date.now() - 86400000; used.expired = Date.now() - 8 * 86400000; used.savetheferry = Date.now() - 3600000;
  await w.env.AXIOM_KV.put('ig_hashtags', JSON.stringify(used));   // 30 inside the window (29 + savetheferry); one fallen out of it
  for (const [t, s] of [['savetheferry', 9], ['nightboat', 5], ['harbourlevy', 1]]) await add(w, { ns: 'aep', kind: 'hashtag', platform: 'instagram', value: t, score: s });
  const seen = graph(w, [[/ig_hashtag_search/, u => ({ data: [{ id: 'h_' + /q=(\w+)/.exec(u)[1] }] })], [/recent_media/, () => ({ data: [Object.assign({}, MEDIA[0], { caption: 'Gas export tax now, Canberra. #savetheferry' })] })]]);
  const r = await w.mod.__test.igHashtagSweep(w.env, { ns: 'aep', pace: 0 });
  eq([r.read, r.refused, r.allowance.used, r.allowance.left], [1, ['nightboat', 'harbourlevy'], 30, 0], 'a hashtag inside the window is free; new ones are refused once thirty are used');
  ok(/allowance of 30 is spent/.test(r.detail) && /#nightboat/.test(r.detail)); ok(!seen.some(u => /q=nightboat|q=harbourlevy/.test(u)), 'a refused hashtag reaches no provider');
  eq(rowsOf(w, 'sig_thread').length, 1); eq(rowsOf(w, 'sig_thread')[0].meta.hashtag, 'savetheferry');
  // a place frees up when a hashtag falls out of the window
  const led = JSON.parse(await w.env.AXIOM_KV.get('ig_hashtags')); delete led.old0; led.old1 = Date.now() - 8 * 86400000; await w.env.AXIOM_KV.put('ig_hashtags', JSON.stringify(led));
  const r2 = await w.mod.__test.igHashtagSweep(w.env, { ns: 'aep', pace: 0 });
  eq([r2.read, r2.refused, r2.allowance.used], [3, [], 30], 'two places freed, two new hashtags read');
  eq((await F(w, 'GET', '/den/plan?ns=aep&platform=instagram')).body.plan.instagram.hashtagAllowance.left, 0);
  // Meta's refusal of the feature is named
  const w2 = await mk({ META_TOKEN: 'tok', META_IG_USER: '17841400000000001' }); await add(w2, { ns: 'aep', kind: 'hashtag', platform: 'instagram', value: 'savetheferry' });
  graph(w2, [[/ig_hashtag_search/, () => ({ error: { message: '(#10) To use Instagram Public Content Access, your use of this endpoint must be reviewed and approved by Facebook' } })]]);
  const r3 = await w2.mod.__test.igHashtagSweep(w2.env, { ns: 'aep', pace: 0 }); eq([r3.ok, r3.error], [false, 'ig_hashtag_access_missing']); ok(/app review/.test(r3.detail));
});

await S.t('FB1 Facebook pages through the Graph API', async () => {
  let w = await mk({ META_TOKEN: 'tok' }); await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  graph(w, [[/harbourwatch\/posts/, () => ({ error: { message: '(#10) This endpoint requires the \'pages_read_engagement\' permission or the \'Page Public Content Access\' feature.' } })]]);
  let r = await w.mod.__test.fbPublicSweep(w.env, { ns: 'aep', pace: 0 });
  eq([r.ok, r.error, r.threads], [false, 'ppca_missing', 0]); ok(/Page Public Content Access/.test(r.detail) && /signed-in collector/.test(r.detail));
  w = await mk({ META_TOKEN: 'tok' }); await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  graph(w, [[/harbourwatch\/posts/, () => ({ data: [{ id: '108000000000001_990000000000002', message: 'Sign the gas export tax petition', created_time: new Date().toISOString(), permalink_url: 'https://www.facebook.com/harbourwatch/posts/pfbid0xyz',
    shares: { count: 12 }, reactions: { summary: { total_count: 340 } }, comments: { summary: { total_count: 25 } } }, { id: '108000000000001_990000000000003', message: 'Bake sale Saturday', created_time: new Date().toISOString() }] })]]);
  r = await w.mod.__test.fbPublicSweep(w.env, { ns: 'aep', pace: 0 });
  eq([r.ok, r.threads, r.threadRows, r.skipped], [true, 1, 1, 1]);
  const row = rowsOf(w, 'sig_thread')[0]; eq([row.url, row.meta.eng.likes, row.meta.eng.comments, row.meta.eng.shares], ['https://www.facebook.com/108000000000001/posts/990000000000002', 340, 25, 12], 'the numeric address, so a second layer finds the same row');
  const none = await (await mk()).mod.__test.fbPublicSweep((await mk()).env, { ns: 'aep' }); eq([none.ok, none.error], [false, 'meta_not_configured']);
});

await S.t('PR1 the probe names what each public route still needs', async () => {
  let w = await mk({ META_TOKEN: 'tok' });
  let st = (await F(w, 'GET', '/meta/status?probe=1')).body; let pub = st.probe.public;
  ok(pub.find(x => /META_IG_USER/.test(x.step) && !x.ok && /Set the text var META_IG_USER/.test(x.detail)), JSON.stringify(pub));
  ok(pub.find(x => /Facebook public pages/.test(x.step) && !x.ok && /No Facebook page is in a watch register/.test(x.detail)));
  w = await mk({ META_TOKEN: 'tok', META_IG_USER: '17841400000000001' }); await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch' });
  graph(w, [[/recently_searched_hashtags/, () => ({ data: [{ id: 'h1' }, { id: 'h2' }] })], [/business_discovery/, () => ({ business_discovery: { username: 'instagram' } })],
    [/17841400000000001\?fields=username/, () => ({ username: 'agency.account' })], [/harbourwatch\/posts/, () => ({ error: { message: '(#10) This endpoint requires the Page Public Content Access feature' } })]]);
  st = (await F(w, 'GET', '/meta/status?probe=1')).body; pub = st.probe.public;
  eq(pub.map(x => x.ok), [true, true, true, false], JSON.stringify(pub));
  ok(/@agency\.account/.test(pub[0].detail) && /2 of 30 hashtags used/.test(pub[2].detail) && /app review/.test(pub[3].detail) && /signed-in collector/.test(pub[3].detail));
  ok(!/Blocked at: (Instagram|Facebook public)/.test(st.probe.summary), 'an optional route never blocks the comment and reaction sweeps\' verdict');
  eq((await w.call('GET', '/meta/status?probe=1', null, 'read-key')).status, 403, 'a probe asks a provider, so it is a full-key act');
});

await S.t('CV1 the coverage table', async () => {
  let w = await mk(); let P = (await F(w, 'GET', '/social/coverage')).body.platforms; const by = id => P.find(p => p.id === id);
  ok(by('facebook') && by('instagram') && !by('facebook_public'));
  eq([by('facebook').configured, by('instagram').configured], [false, false]); ok(/Page Public Content Access/.test(by('facebook').keys) && /META_IG_USER/.test(by('instagram').keys));
  ok(/comment text/.test(by('facebook').unreachable) && /comment text/.test(by('instagram').unreachable), 'what cannot be reached is said');
  w = await mk({ META_TOKEN: 'tok', META_IG_USER: '17841400000000001', META_PUBLIC_PAGES: '1' });
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [POST({ watch: a.id })] });
  P = (await F(w, 'GET', '/social/coverage')).body.platforms;
  eq([by('facebook').configured, by('facebook').where, by('instagram').configured, by('facebook').counts.threads24], [true, 'worker', true, 1]);
  // the cron runs the Graph routes only when what they need is set
  const w3 = await mk(); const seen3 = graph(w3, []); await w3.mod.__test.socialCron(w3.env); eq(seen3.length, 0, 'with nothing set, the tick asks Meta nothing');
});

await S.t('AL1 the Ad Library searches the desks\' approved terms', async () => {
  const w = await mk({ META_USER_TOKEN: 'utok' });
  await add(w, { ns: 'aep', kind: 'term', value: 'gas export tax' }); const off = await add(w, { ns: 'aep', kind: 'term', value: 'ferry levy' }); await F(w, 'POST', '/den/watch/decide', { id: off.id, decision: 'off' });
  const seen = graph(w, [[/ads_archive/, () => ({ data: [] })]]);
  const r = await w.mod.__test.metaAdLibrary(w.env); ok(r.ok);
  const terms = seen.map(u => /search_terms=([^&]+)/.exec(u)[1]);
  ok(terms.indexOf('gas export tax') >= 0, 'an approved term is searched'); ok(terms.indexOf('ferry levy') < 0, 'a term switched off is not'); ok(terms.indexOf('Gas taxation') >= 0, 'beside the issue labels');
});

await S.t('SG1 read back through the Signals routes', async () => {
  const w = await mk();
  const a = await add(w, { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatch', name: 'Harbour Watch', actor_kind: 'org' });
  await F(w, 'POST', '/signals/ingest', { ns: 'aep', layer: 1, via: 'graph', rows: [POST({ watch: a.id }), POST({ platform: 'instagram', url: 'https://www.instagram.com/p/DAbCdEfGhI5/', text: 'Gas export tax now, Canberra', q: 'gas export tax' })] });
  const fbT = (await w.call('GET', '/signals/threads?platform=facebook&days=7', null, 'read-key')).body.threads; eq(fbT.length, 1);
  eq([fbT[0].platform, fbT[0].eng.likes, fbT[0].actor && fbT[0].actor.name, fbT[0].layers], ['facebook', 120, 'Harbour Watch', [1]]);
  const ig = (await w.call('GET', '/signals/threads?platform=instagram&days=7', null, 'read-key')).body.threads; eq(ig.length, 1); ok(!ig[0].actor);
  const st = (await w.call('GET', '/signals/status', null, 'read-key')).body; ok(JSON.stringify(st).indexOf('facebook') > 0 && JSON.stringify(st).indexOf('instagram') > 0);
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
