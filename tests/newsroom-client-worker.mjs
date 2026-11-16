/* The Newsroom by client (Kai's ClickUp ticket "Newsroom Irrelevant Result", 16 November 2026): with Minerals Council
 * chosen, the Newsroom showed an OzBargain vacuum-cleaner deal and a Matildas squad story, because /allnews returned every
 * core feed and every registry row with no relevance check, and the Newsroom did not read the client scope at all.
 *   NC1. /allnews?ns=mca keeps a story only when its headline or summary carries one of the client's issues (the same
 *        wide matchers issueTag uses everywhere) or names a register entry of that client (its people and organisations,
 *        opponents included); the deal and the football are left out; each kept story says why (`why`), and the answer
 *        names the client and how many stories it looked at.
 *   NC2. Another client's people do not make a story the client's.
 *   NC3. A registry row is judged on the words shown (headline and summary), never on tags stored from its page text.
 *   NC4. Without ns, /allnews is unchanged (the deal is there), and the filtered answer is cached apart from it.
 *   NC5. A client AXIOM has no issues for is refused in words.
 * Run: node --experimental-sqlite tests/newsroom-client-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const NOW = Date.now(), H = 3600e3;
const rfc = ago => new Date(NOW - ago).toUTCString();
const rss = items => '<?xml version="1.0"?><rss><channel><title>t</title>' + items.map(i => '<item><title><![CDATA[' + i.title + ']]></title><link>' + i.link + '</link><pubDate>' + rfc(i.ago || H) + '</pubDate><description><![CDATA[' + (i.desc || '') + ']]></description></item>').join('') + '</channel></rss>';
const XML = body => new Response(body, { status: 200, headers: { 'content-type': 'application/rss+xml' } });

const w = await workerEnv();
w.answer(/ozbargain\.com\.au\/deals\/feed/, () => XML(rss([
  { title: 'Roborock F25 ACE Pro Wet & Dry Vacuum. $389 @Bing Lee', link: 'https://www.ozbargain.com.au/node/1', desc: 'Friend Vincent at the casula store told me about this one. Ticket price was $1,299 now $389.' },
])));
w.answer(/smh\.com\.au\/rss\/feed\.xml/, () => XML(rss([
  { title: 'Fowler, Cooney-Cross return in near full-strength Matildas squad', link: 'https://www.smh.com.au/sport/matildas', desc: 'Matildas coach Joe Montemurro has been granted a rare opportunity to roll out all of his big guns.' },
  { title: 'Iron ore slides as Chinese steel output cools', link: 'https://www.smh.com.au/business/iron-ore', desc: 'The price fell for a third day.', ago: 2 * H },
  { title: 'Treasury flags changes to the fuel tax credit scheme', link: 'https://www.smh.com.au/politics/ftc', desc: 'The budget update is due next month.', ago: 2 * H },
])));
w.answer(/abc\.net\.au\/news\/feed\/51120\/rss\.xml/, () => XML(rss([
  { title: 'Tania Constable says the week in Canberra was a mixed one', link: 'https://www.abc.net.au/news/constable', desc: 'The chief executive spoke on breakfast radio.', ago: 3 * H },
  { title: 'Samantha McCulloch speaks at a Perth lunch', link: 'https://www.abc.net.au/news/mcculloch', desc: 'The chief executive spoke to business leaders.', ago: 4 * H },
  { title: 'Lock the Gate rallies outside the parliament', link: 'https://www.abc.net.au/news/ltg', desc: 'Hundreds gathered on the lawns.', ago: 5 * H },
])));

// two registry rows, as the cron files them: one whose stored tags came from its page text and whose headline and summary
// say nothing about mining, and one whose headline does
await w.env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS arc_items(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, src TEXT, title TEXT, body TEXT, url TEXT, author TEXT, tone REAL, meta TEXT, ts INTEGER, seen INTEGER)').run();
const ins = w.env.MIND_DB.prepare('INSERT INTO arc_items(kind,src,title,body,url,meta,ts) VALUES(?,?,?,?,?,?,?)');
await ins.bind('news', 'wn_gardening', 'Ten plants for a shady courtyard', 'Ferns and hostas do well out of direct sun.', 'https://garden.test/shade', JSON.stringify({ reg: 1, tier: 'sector', issues: ['mining'] }), NOW - H).run();
await ins.bind('news', 'wn_qldgov', 'Premier announces mining royalty review', 'The review reports next year.', 'https://qld.test/royalty', JSON.stringify({ reg: 1, tier: 'official', issues: ['mining'] }), NOW - 2 * H).run();

const s = suite('newsroom-client-worker harness');
const titles = r => (r.body.items || []).map(i => i.title);

await s.t('NC1. /allnews?ns=mca keeps the client\'s stories, leaves out the deal and the football, and says why each is there', async () => {
  const r = await w.call('GET', '/allnews?ns=mca&max=110', null, 'read-key');
  eq(r.status, 200, r.text.slice(0, 200));
  const t = titles(r);
  ok(t.some(x => /Iron ore slides/.test(x)), 'an iron ore story is on MCA\'s mining issue: ' + JSON.stringify(t));
  ok(t.some(x => /Tania Constable/.test(x)), 'a story naming MCA\'s chief executive is kept: ' + JSON.stringify(t));
  ok(t.some(x => /Lock the Gate/.test(x)), 'a story naming an organisation in MCA\'s register is kept: ' + JSON.stringify(t));
  ok(!t.some(x => /Roborock|Vacuum/.test(x)), 'the OzBargain deal is left out: ' + JSON.stringify(t));
  ok(!t.some(x => /Matildas/.test(x)), 'the football is left out: ' + JSON.stringify(t));
  const iron = r.body.items.find(i => /Iron ore/.test(i.title));
  eq(iron.why && iron.why.issues, ['Mining and resources'], 'the iron ore story names the issue');
  const tc = r.body.items.find(i => /Tania Constable/.test(i.title));
  ok(tc.why && (tc.why.names || []).indexOf('Tania Constable') >= 0, 'the Constable story names her: ' + JSON.stringify(tc.why));
  const ftc = r.body.items.find(i => /fuel tax credit/.test(i.title));
  eq(ftc && ftc.why, { issues: ['Fuel tax credits'], names: [] }, 'names are people and organisations: a register topic is not repeated as a name');
  ok(r.body.client && r.body.client.ns === 'mca' && r.body.client.name === 'Minerals Council of Australia', 'the answer names the client: ' + JSON.stringify(r.body.client));
  ok(r.body.client.considered >= 7 && r.body.client.kept === r.body.items.length && r.body.client.matched === r.body.items.length, 'and how many stories it looked at, matched and kept: ' + JSON.stringify(r.body.client));
  const cut = await w.call('GET', '/allnews?ns=mca&max=2', null, 'read-key');
  ok(cut.body.client.matched > cut.body.client.kept && cut.body.client.kept === 2, 'matched counts past the cut, kept is what was sent: ' + JSON.stringify(cut.body.client));
});

await s.t('NC2. another client\'s chief executive does not make a story MCA\'s', async () => {
  const r = await w.call('GET', '/allnews?ns=mca&max=110', null, 'read-key');
  ok(!titles(r).some(x => /McCulloch/.test(x)), JSON.stringify(titles(r)));
  const aep = await w.call('GET', '/allnews?ns=aep&max=110', null, 'read-key');
  ok(titles(aep).some(x => /McCulloch/.test(x)) && !titles(aep).some(x => /Tania Constable/.test(x)), 'and the other way round for AEP: ' + JSON.stringify(titles(aep)));
});

await s.t('NC3. a registry row is judged on its headline and summary, not on tags stored from its page', async () => {
  const r = await w.call('GET', '/allnews?ns=mca&max=110', null, 'read-key');
  ok(!titles(r).some(x => /shady courtyard/.test(x)), 'a gardening story with stored mining tags is left out: ' + JSON.stringify(titles(r)));
  ok(titles(r).some(x => /mining royalty review/.test(x)), 'a registry story whose headline is on the issue is kept: ' + JSON.stringify(titles(r)));
});

await s.t('NC4. without ns /allnews is unchanged, and the client\'s answer is cached apart from it', async () => {
  const r = await w.call('GET', '/allnews?max=110', null, 'read-key');
  eq(r.status, 200);
  ok(titles(r).some(x => /Roborock/.test(x)) && titles(r).some(x => /Matildas/.test(x)), 'every story, as before: ' + JSON.stringify(titles(r)));
  ok(!r.body.client, 'and no client is named');
  const again = await w.call('GET', '/allnews?ns=mca&max=110', null, 'read-key');
  ok(!titles(again).some(x => /Roborock/.test(x)), 'the client\'s cached answer is still its own');
});

await s.t('NC5. a client AXIOM holds no issues for is refused in words', async () => {
  const r = await w.call('GET', '/allnews?ns=bogus', null, 'read-key');
  eq(r.status, 400); eq(r.body.error, 'unknown_client');
  ok(r.body.detail && r.body.detail.length > 20, 'with a sentence: ' + JSON.stringify(r.body));
});

w.restore();
const res = s.done();
process.exit(res.fail ? 1 : 0);
