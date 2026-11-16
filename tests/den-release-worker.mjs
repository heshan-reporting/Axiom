/* Anne's Den release (build p67, 16 November 2026), the worker side, against the worker module in this process. No
 * provider is contacted: the model is a stub that writes from the evidence it is sent. Every outlet, account, person and
 * post here is invented. Each case fails on p66.
 *   DR1 the draft's prompt carries no collection fault: no "NOT READ" shout, no collector, sign-in or repair; one neutral
 *       line says which channels were read and which were not, and the rules say never to read an unread channel as quiet
 *   DR2 the brief's view carries what an evidence card needs: the row's own words (text) and one line of figures (sub);
 *       a social row is labelled by its channel only (never its words or an account; the Source List prints the label);
 *       a subscriber row's excerpt never leaves the worker
 *   DR3 a brief stored before p67 (no text, no sub) still views, and gains card words from its stored line
 *   DR4 the tone line counts only the rows a model judged, never the rows marked as mentioning nothing
 *   DR5 a brief started by hand can cite: it holds the window's evidence from the start, and a save that cites a row
 *       collected since merges it rather than dropping it
 *   DR6 a section written again refreshes the lines of the rows it was given, so a moved count is not a false flag
 * Run: node --experimental-sqlite tests/den-release-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den release p67: the engine');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, NOW = Date.now();
let seq = 0;
const push = async (w, kind, rows) => { const r = await F(w, 'POST', '/archive/add', { kind, rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
const news = o => Object.assign({ src: 'pointpost', title: 'Crossbench renews call for a windfall tax on gas ' + (++seq), body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://pointpost.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'pointpost', tier: 'regional', juris: 'au', reg: 1 } }, o);
const post = o => Object.assign({ src: 'x', title: 'x post', body: 'The windfall tax on gas is overdue, sign the petition.', url: 'https://x.com/i/web/status/19' + String(++seq).padStart(12, '0'), ts: NOW - 3 * H, author: 'Jo Citizen', meta: { platform: 'x', issues: ['gastax'], id: 'p' + seq, eng: { likes: 40, replies: 6, reposts: 9 }, eng_at: NOW - H, score: 49, comments: 6, layers: [2] } }, o);
const itemBy = (w, url) => w.env.MIND_DB.db.prepare('SELECT id FROM arc_items WHERE url=?').get(url).id;
const model = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content; const ids = k => (ev.match(new RegExp('\\[' + k + ':[A-Za-z0-9_.-]+\\]', 'g')) || []).map(x => x.slice(1, -1));
  const j = make ? make(ev, ids, b) : { sections: { summary: 'Coverage of the gas taxation debate continued [' + (ids('M')[0] || 'M:0') + ']. A post on X drew attention [' + (ids('S')[0] || 'S:0') + ']. Tone was mixed [' + (ids('T')[0] || 'T:none') + '].', bottom: 'Activity is steady [' + (ids('M')[0] || 'M:0') + '].' }, ratings: {} };
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(j) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const seedDay = async w => {
  await F(w, 'GET', '/sentiment/status');   // the tone tables exist before a row is judged
  await push(w, 'news', [news({ title: 'Harbour levy divides the Senate', url: 'https://pointpost.example.com.au/a', ts: NOW - 5 * H }), news({ title: 'Producers answer the windfall tax push', url: 'https://pointpost.example.com.au/b', ts: NOW - 2 * H, body: 'Behind the paywall the producers set out a long case against the levy.', meta: { issues: ['gastax'], source: 'afr', gated: 1, access: 'subscriber', ft: 'subscriber' } })]);
  await push(w, 'sig_thread', [post({ url: 'https://x.com/i/web/status/190000000000000001' })]);
};
const judge = (w, item, tone, modelName) => w.env.MIND_DB.db.prepare('INSERT INTO sent_items(item,kind,platform,src,ts,tone,issues,model) VALUES(?,?,?,?,?,?,?,?)').run(item, 'news', 'news', 'pointpost', NOW - 2 * H, tone, JSON.stringify(['gastax']), modelName);

await S.t('DR1 the prompt carries no collection fault, and one neutral channels line', async () => {
  const w = await mk(); await seedDay(w); const calls = model(w);
  await F(w, 'POST', '/den/watch/add', { ns: 'aep', kind: 'account', platform: 'facebook', value: 'harbourwatchpage', name: 'Harbour Watch' });
  const gap = (await F(w, 'GET', '/den/missed?desk=aep_au')).body.signals.find(s => s.key === 'G:facebook'); ok(gap && /collector/.test(gap.detail), 'the strip still says why, for the Collection tab');
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const sent = calls[0].messages[0].content, sys = calls[0].system;
  ok(!/NOT READ|SAY PLAINLY/.test(sent) && !/delivered nothing|collector|signed-in|sign in|verification|the Mac|Page Public Content|not granted/i.test(sent), 'no collection fault in the evidence: ' + (sent.match(/^.*(collector|delivered nothing|NOT READ|not granted).*$/im) || [''])[0]);
  const line = (sent.match(/^CHANNELS READ IN THIS WINDOW: [^\n]*$/m) || [''])[0]; ok(/News/.test(line) && /\bX\b/.test(line) && /not read: Facebook/.test(line), 'the channels line: ' + line);
  eq(sent.split('\n').filter(l => /^CHANNELS READ/.test(l)).length, 1, 'once');
  ok(!/say so plainly|say which channels were not read/i.test(sys), 'the old rule and the old social guide are gone');
  ok(/never describe a channel that was not read as quiet/i.test(sys) && /never write about collect/i.test(sys) && /sign-ins/.test(sys) && /repair/.test(sys), 'the new rule: ' + (sys.match(/^- Never describe[^\n]*/im) || [''])[0]);
  ok(/"social":"\.\.\."/.test(sys), 'the social section is still asked for');
});

await S.t('DR2 the view carries text and sub for an evidence card', async () => {
  const w = await mk(); await seedDay(w); judge(w, itemBy(w, 'https://pointpost.example.com.au/a'), -1, 'claude'); model(w);
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const view = (await F(w, 'GET', '/den/brief?id=' + br.id, null, 'read-key')).body.brief;
  const sid = Object.keys(view.evidence).find(k => /^S:/.test(k)); const s = view.evidence[sid];
  ok(/windfall tax on gas is overdue/.test(s.text) && s.text.length <= 160, 'the post\'s own words: ' + JSON.stringify(s));
  ok(/likes|interactions|no counts held/.test(s.sub) && s.sub.length <= 120 && /\bX\b/.test(s.sub), 'one line of figures: ' + s.sub);
  eq(s.label, 'x post', 'a social row is labelled by its channel only: the label is printed in the Source List (release review)');
  const md = (await F(w, 'GET', '/den/brief?id=' + br.id + '&format=md', null, 'read-key')).text;
  const htm = (await F(w, 'GET', '/den/brief?id=' + br.id + '&format=html', null, 'read-key')).text;
  ok(/x post/.test(md) && !/windfall tax on gas is overdue|sign the petition/.test(md), 'the Markdown Source List never prints a post\'s words: ' + md.slice(md.indexOf('Social'), md.indexOf('Social') + 160));
  ok(!/windfall tax on gas is overdue|sign the petition/.test(htm), 'nor does the HTML document');
  ok(!view.sourceList.some(g => g.items.some(i => /overdue|petition/.test(i.label || ''))), 'nor the Source List the page shows');
  ok(!/Jo Citizen/.test(JSON.stringify(view)), 'never an author'); ok(!('line' in s), 'the line stays on the worker');
  const gid = Object.keys(view.evidence).find(k => /^M:/.test(k) && view.evidence[k].gated); const g = view.evidence[gid];
  ok(g && /Producers answer the windfall tax push/.test(g.text) && /afr|pointpost/.test(g.sub), 'a subscriber story is its headline and its outlet: ' + JSON.stringify(g));
  ok(!/SUBSCRIBER|Behind the paywall/.test(JSON.stringify(view.evidence)), 'a subscriber excerpt never leaves the worker');
  const t = view.evidence['T:gastax']; ok(t && /rows? judged/.test(t.sub), 'a tone row says how many were judged: ' + JSON.stringify(t));
  const mid = Object.keys(view.evidence).find(k => /^M:/.test(k) && !view.evidence[k].gated); ok(/Harbour levy divides the Senate/.test(view.evidence[mid].text) && /pointpost/.test(view.evidence[mid].sub));
});

await S.t('DR3 a brief stored before p67 still views', async () => {
  const w = await mk(); await F(w, 'GET', '/den/desks');
  const ids = { 'S:11': { k: 'social', label: 'x post', url: 'https://x.com/i/web/status/11', gated: 0, item: 11, line: 'x | 14 nov 09:10 | The levy is a con, say the posters | 12 likes, 3 replies' },
    'M:12': { k: 'media', label: 'afr - Producers push back', url: 'https://afr.example.com/12', gated: 1, item: 12, line: 'afr | 14 nov 08:00 | Producers push back | SUBSCRIBER TEXT, QUOTE AT MOST THIRTY WORDS: secret words from behind the wall' },
    'T:gastax': { k: 'tone', label: 'Gas taxation', url: '', gated: 0, item: 0, line: 'Gas taxation: 9 rows judged, mean tone -0.2, 5 negative, 2 positive' } };
  w.env.MIND_DB.db.prepare("INSERT INTO den_briefs(id,desk,day,window_h,from_ts,to_ts,status,revision,sections,ratings,evidence,model,by,created,updated) VALUES('bold1','aep_au','2026-11-14',24,?,?,'draft',3,?,'{}',?,'claude','Anne',?,?)")
    .run(NOW - 50 * H, NOW - 26 * H, JSON.stringify({ summary: { text: 'The levy drew fire [S:11][M:12].', cites: ['S:11', 'M:12'] } }), JSON.stringify({ ids, label: '13-14 November 2026', missed: [] }), NOW - 26 * H, NOW - 26 * H);
  const r = await F(w, 'GET', '/den/brief?id=bold1', null, 'read-key'); eq(r.status, 200, r.text.slice(0, 200)); const e = r.body.brief.evidence;
  eq([e['S:11'].label, e['S:11'].url, e['M:12'].gated], ['x post', 'https://x.com/i/web/status/11', 1], 'what p66 sent is still sent');
  ok(/The levy is a con/.test(e['S:11'].text) && /12 likes/.test(e['S:11'].sub), 'a social card gains its words from the stored line: ' + JSON.stringify(e['S:11']));
  ok(/rows judged/.test(e['T:gastax'].sub), 'and a tone card its count');
  ok(!/secret words|SUBSCRIBER/.test(JSON.stringify(e)), 'a stored subscriber line is never read for a card');
  ok(/\[\[1\]\(https:\/\/x\.com/.test((await F(w, 'GET', '/den/brief?id=bold1&format=md')).text), 'and it still exports');
});

await S.t('DR4 the tone line counts only judged rows', async () => {
  const w = await mk(); await seedDay(w); const calls = model(w);
  const a = itemBy(w, 'https://pointpost.example.com.au/a'), b = itemBy(w, 'https://pointpost.example.com.au/b'), x = itemBy(w, 'https://x.com/i/web/status/190000000000000001');
  judge(w, a, -1, 'claude'); judge(w, b, 1, 'claude'); [x, a + 1000, a + 1001].forEach(i => judge(w, i, null, 'none'));
  await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); const line = (calls[0].messages[0].content.match(/^\[T:gastax\][^\n]*/m) || [''])[0];
  ok(/: 2 rows judged, mean tone 0, 1 negative, 1 positive$/.test(line), 'the rows marked as mentioning nothing are not judged rows: ' + line);
  const w2 = await mk(); await seedDay(w2); const c2 = model(w2); judge(w2, itemBy(w2, 'https://x.com/i/web/status/190000000000000001'), null, 'none');
  await F(w2, 'POST', '/den/brief', { desk: 'aep_au' }); ok(!/\[T:gastax\]/.test(c2[0].messages[0].content) && !/^TONE/m.test(c2[0].messages[0].content), 'markers alone make no tone line');
});

await S.t('DR5 a brief started by hand can cite', async () => {
  const w = await mk({ ANTHROPIC_API_KEY: '' }); await seedDay(w); const before = w.outbound.filter(o => /anthropic/.test(o.url)).length;
  const h = (await F(w, 'POST', '/den/brief/save', { desk: 'aep_au' })).body.brief; eq([h.status, Object.keys(h.sections), h.revision], ['draft', [], 1], 'started by hand: empty');
  const mid = Object.keys(h.evidence).find(k => /^M:/.test(k)), sid = Object.keys(h.evidence).find(k => /^S:/.test(k)); ok(mid && sid, 'the window\'s evidence is held from the start: ' + Object.keys(h.evidence).join(','));
  const s1 = (await F(w, 'POST', '/den/brief/save', { id: h.id, revision: 1, sections: { summary: 'Written by hand about the levy [' + mid + '][' + sid + '].' } })).body.brief; eq([s1.sections.summary.cites.sort(), s1.sections.summary.uncited], [[mid, sid].sort(), []], 'cited, not dropped');
  await push(w, 'news', [news({ title: 'A late story on the windfall tax', url: 'https://pointpost.example.com.au/late', ts: NOW - 0.5 * H })]); const late = 'M:' + itemBy(w, 'https://pointpost.example.com.au/late');
  const s2 = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: 2, sections: { bottom: 'A later story added to it [' + late + '].' } }); eq([s2.status, s2.body.brief.sections.bottom.cites], [200, [late]], 'a row collected since the start is merged on save: ' + s2.text.slice(0, 200));
  ok(s2.body.brief.evidence[late] && /A late story/.test(s2.body.brief.evidence[late].text));
  const s3 = await F(w, 'POST', '/den/brief/save', { id: h.id, revision: 3, sections: { posture: 'An invented one [M:31337].' } }); eq(s3.body.brief.sections.posture.cites, [], 'an id no board holds is still taken out');
  eq(w.outbound.filter(o => /anthropic/.test(o.url)).length, before, 'no model call');
});

await S.t('DR6 a section written again refreshes the lines it was given', async () => {
  const w = await mk(); await seedDay(w); const calls = model(w);
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const sid = Object.keys(br.evidence).find(k => /^S:/.test(k)); ok(/40 likes/.test(br.evidence[sid].sub), br.evidence[sid].sub);
  w.env.MIND_DB.db.prepare('UPDATE arc_items SET meta=? WHERE id=?').run(JSON.stringify({ platform: 'x', issues: ['gastax'], id: 'pz', eng: { likes: 900, replies: 6, reposts: 9 }, eng_at: NOW, score: 909, comments: 6, layers: [2] }), Number(sid.slice(2)));
  model(w, (ev, ids) => ({ sections: { bottom: 'One post drew 900 likes [' + sid + '].' } }));
  const r = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: br.revision }); eq(r.status, 200, r.text.slice(0, 200));
  eq(r.body.brief.sections.bottom.unverified, [], 'the figure is in the fresh line'); ok(/900 likes/.test(r.body.brief.evidence[sid].sub), 'and the card says so: ' + r.body.brief.evidence[sid].sub);
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
