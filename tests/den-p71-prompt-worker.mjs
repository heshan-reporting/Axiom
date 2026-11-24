/* Anne's Den p71, the prompt lane: what the model is told, and the desk options that shape it, against the worker module
 * in this process. No provider is contacted: the model is a stub, and every case reads the system prompt (and the output
 * limit) from the request the worker sent it. Every outlet, account, person and post here is invented. Each case fails on
 * p70 (a2222eb).
 *   PR1 aep_au's prompt: the reader rule names AEP (its communications team; never "rows", "evidence" or "the client";
 *       counts as plain quantities, tone in words); the platform rule (never which platform, never compared by volume,
 *       nothing about a channel the CHANNELS line lists as not read); the continuity rule (THE LAST FILED BRIEF'S
 *       BOTTOM LINE); the positions rule (never a position the evidence does not give AEP; "industry" names who); D1's
 *       naming rule (a person only when in a parliament or on their own registered account; organisations and outlets as
 *       the line names them); measure words; a "Special Report" as the company's own; the posture guide opens "AEP should
 *       continue monitoring"; no guide says "the client"; the p67 collection rule stands
 *   PR2 the guides: risks lists her eight types in her order, the last "Direct targeting of AEP", the rest left out rather
 *       than declared absent; summary leads with activists in order of risk to AEP; momentum gives a level, a trend and
 *       their figures; actors never remark that none posted; social has no "where"; sentiment names coverage only from the
 *       tone lines' ids; the bottom line compares only with the last filed one; every guide gives a length in words, and a
 *       brief in her format sums to her 3,300-5,000; the firearms format's guides name its client
 *   PR3 a section's own guide, set through POST /den/desk/update, reaches the prompt in place of its kind's (a draft and a
 *       section written again); a save of sections without guides keeps it; plain text of at most 400 characters; '' clears
 *   PR4 options.title and options.channels: validated (plain text of at most 80 characters; unique platform ids, never web
 *       or any, an unknown one dropped), both kept across a save that leaves them out and across a bad value, '' and []
 *       clear them, a read key sets nothing, and the prompt names the desk's own title (denTitle)
 *   PR5 the draft asks for up to 16,000 output tokens and a section written again for 4,000; a weekly desk's guides say
 *       "the week" and its summary guide names its title; a daily desk's say "the day"; no "activist-activity brief"
 *   The review fixes (draft lane, fails on df42fb8):
 *   PR6 (ST2) the one-draft hold lasts the whole allowance (the evidence, then both 400-second attempts), renewed when the
 *       call is sent: a second press six minutes into a long draft is refused and sends nothing; a draft whose day gained a
 *       brief meanwhile (a hold lost) is not saved and answers 409 brief_changed with the brief that is there, never 500 on
 *       the unique index; a redraft does not write over a person's edit made while it ran
 *   PR7 (ST3) the morning cron's deadline, from the tick's start: with less than four minutes before it no draft starts and
 *       the desks are kept for the day; a later tick (window false) drafts them and nothing else; the model call is given
 *       no longer than what is left of the tick
 *   PR8 (ST3) the desks' model calls overlap (their evidence one at a time); one desk's throw is its own and the next desk
 *       is still drafted; a draft the deadline cut off is tried once more by a later tick, and not a third time
 *   PR9 (ST3) the scheduled handler: a held tick of AI_AUTOMATION=daily, the window already run, drafts what the window's
 *       tick left over for lack of time, and with nothing left over makes no call
 *   The second review round (cron lane, each fails on 3b71160):
 *   PR10 (C1, C1b) a draft that throws before its model call (a busy read in its evidence, EV7) counts a try: the next desk
 *       is still drafted, the one that threw is tried once more by a later tick and never a third time; one busy read never
 *       loses the morning; a draft whose call's reservation met a busy database is kept for a later tick, not dropped
 *   PR11 (C1, C3) the Den's own once-a-day marker: a held tick of a day whose window tick never reached the Den drafts the
 *       morning (one tick, through the scheduled handler), logs every desk it did not draft by name with its error, and
 *       writes the marker; a later held tick finishes only what was left; the Den's daily calls still bound it; a busy
 *       read in the pass itself writes no marker, so the next held tick runs the morning again (C1b)
 *   PR12 (C2) the automation status says the Den may finish its morning drafts on later ticks the same day, at most two
 *       tries per desk (daily only); the status route carries it
 *   The third review round (cron lane, each fails on 2ca1637):
 *   PR13 (K2) a draft the deadline cut before its call was sent gives its try back (the try still counts while the draft is
 *       built, so a platform kill mid-build stays counted): two late ticks, or a busy read and a late tick, never close the
 *       morning with no call sent; the next tick with time drafts the desk
 *   PR14 (K5) busy is read from the failure's own source: an answer that is not JSON, or a refusal, whose words hold a busy
 *       phrase is dropped for the day after its own attempts (never kept and paid for again); the call's reservation meeting
 *       a busy database is still kept for a later tick
 * Run: node --experimental-sqlite tests/den-p71-prompt-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p71, the prompt: rules, guides and the desk options that shape them');
const KEYS = { 'full-key': { n: 'Analyst', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, NOW = Date.now();
let seq = 0;
// one day of invented rows: gas taxation on the AEP desks, fuel tax credits on the MCA desks
const seed = async (w, issue) => { const rows = [['Harbour levy divides the Senate', 'pointpost'], ['Crossbench renews its call for a windfall levy', 'tribune']].map(([title, src]) => { seq++;
  return { src, title: title + ' (' + seq + ')', body: 'Campaigners and producers set out their positions on the levy this week.', url: 'https://' + src + '.example.com.au/story/' + seq, ts: NOW - 2 * H, meta: { issues: [issue], source: src, tier: 'regional', juris: 'au', reg: 1 } }; });
  const r = await F(w, 'POST', '/archive/add', { kind: 'news', rows }); if (r.status !== 200) throw new Error('seed failed: ' + r.text.slice(0, 200)); };
// the stub model: a short brief citing the first story it was given; calls keeps every request body
const model = w => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const m = (String(b.messages[0].content).match(/\[M:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0];
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'Coverage of the levy continued ' + m + '.', bottom: 'Activity is steady ' + m + '.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  return calls; };
const desk = async (w, id, patch, key) => { const r = await F(w, 'POST', '/den/desk/update', { id, patch }, key); if (r.status !== 200) throw new Error('desk update failed: ' + r.text.slice(0, 200)); return r.body.desk; };
const draft = async (w, id) => { const r = await F(w, 'POST', '/den/brief', { desk: id }); if (r.status !== 200) throw new Error('draft failed: ' + r.text.slice(0, 200)); return r.body.brief; };
const stored = (w, id) => { const r = w.env.MIND_DB.db.prepare('SELECT sections, options FROM den_desks WHERE id=?').get(id); return { sections: JSON.parse(r.sections), options: JSON.parse(r.options) }; };
// one section's line in the prompt's SECTIONS block, after its title: the guide the model is given for it
const guideOf = (sys, id) => (String(sys).match(new RegExp('^- ' + id + ' \\("[^"\\n]*"\\): ([^\\n]*)$', 'm')) || [])[1] || '';
const block = sys => (String(sys).split('SECTIONS (use these ids as the keys)\n')[1] || '').split('\n\n')[0];
const RISKS = ['Reputational', 'Media', 'Political', 'Policy or regulatory', 'Social media', 'Campaign escalation or community campaign', 'Industry influence', 'Direct targeting of AEP'];

await S.t('PR1 the rules: the reader, platforms, continuity, positions, names as D1, measures, sponsored pieces, the posture', async () => {
  const w = await mk(); await seed(w, 'gastax'); const calls = model(w); await draft(w, 'aep_au'); const sys = String(calls[0].system);
  ok(/write for AEP's communications team and call the client AEP\b/.test(sys), 'the reader rule names AEP: ' + (sys.match(/^- The reader[^\n]*/m) || [''])[0]);
  ok(/Never write "rows", "ids", "evidence", "supplied", "held", "judged", "registered", "pinned", "working title" or "the client"/.test(sys) && /never describe what you were given/i.test(sys), 'never the Den\'s words, never what it was given');
  ok(/plain quantities \(posts, stories, comments\)/.test(sys) && /tone in words/.test(sys) && /never as a score/.test(sys) && /stance toward AEP is unknown, judge it from the claim or leave it out/.test(sys), 'counts, tone and an unknown stance');
  ok(/never say which platform the conversation was on/i.test(sys) && /never compare platforms by volume/i.test(sys) && /say what moved, what it says and how far it reached/.test(sys), 'the platform rule: ' + (sys.match(/^- Platforms[^\n]*/m) || [''])[0]);
  ok(/Write nothing about a channel the CHANNELS line lists as not read: not what was or was not posted there, not by whom/.test(sys), 'nothing about a channel not read');
  ok(/"remains", "still", "continues", "again" or "no longer" only when THE LAST FILED BRIEF'S BOTTOM LINE is in the evidence and supports the comparison/.test(sys) && /describe this window alone/.test(sys), 'the continuity rule: ' + (sys.match(/^- Continuity[^\n]*/m) || [''])[0]);
  ok(/never give AEP a position on a bill, a party, a policy or another organisation's issue that the evidence does not state as AEP's own/i.test(sys) && /never present another organisation's agenda as AEP's/.test(sys), 'the positions rule: ' + (sys.match(/^- Positions[^\n]*/m) || [''])[0]);
  ok(/"industry" where a reader could take it to mean AEP: name who/.test(sys) && /targets AEP only when it names AEP/.test(sys), '"industry" names who, and an attack on a company is not one on AEP');
  ok(/name a person only when the cited line names them and they sit in a parliament/i.test(sys) && /on their own account in the INFLUENCER AND POLITICAL lines/.test(sys), 'D1: a person only in a parliament or on their own registered account: ' + (sys.match(/^- Names[^\n]*/m) || [''])[0]);
  ok(/campaigner, a spokesperson, a commenter, a journalist[^.]*by role and organisation/.test(sys) && /never name a private individual/.test(sys) && /Organisations and outlets may be named when the cited line names them/.test(sys), 'everyone else by role; organisations as the line names them');
  ok(!/Name a person or an organisation only when the evidence line names them/.test(sys), 'the p67 rule, looser than D1, is gone');
  ok(/measure or trend word \(small, low, stable, growing, escalating, weightiest\) rests on a cited line that shows it/.test(sys), 'measure words rest on a cited line');
  ok(/"Special Report" is the company's own material/.test(sys) && /never count it as the outlet's reporting, in press tone or as favourable coverage/.test(sys), 'a Special Report is the company\'s own');
  ok(/^120 to 220 words in one paragraph opening "AEP should continue monitoring \.\.\."/.test(guideOf(sys, 'posture')) && /never a position the evidence does not give AEP/.test(guideOf(sys, 'posture')), 'the posture in her form: ' + guideOf(sys, 'posture'));
  ok(block(sys).split('\n').length === 10 && !/the client|\{[a-z]+\}/.test(block(sys)), 'ten guides, none saying "the client", none left unfilled: ' + block(sys));
  ok(/never describe a channel that was not read as quiet/i.test(sys) && /never write about collect/i.test(sys) && /sign-ins/.test(sys) && /Never invent an id/.test(sys) && /monitoring analyst/.test(sys) && /\(AEP national\)/.test(sys), 'the rules that still hold are kept');
});

await S.t('PR2 the guides: her eight risk types in her order, activists first, figures for momentum, a length for each', async () => {
  const w = await mk(); await seed(w, 'gastax'); const calls = model(w); await draft(w, 'aep_au'); const sys = String(calls[0].system);
  const risks = guideOf(sys, 'risks'); const order = ((risks.match(/in this order: ([^.]*)\./) || [])[1] || '').split('; ');
  eq(order, RISKS, 'her eight types, in her order (DEN.md s.0.2): ' + risks); ok(/short paragraph opening with its name/.test(risks) && /leave the others out rather than declaring them absent/.test(risks), 'the rest left out, never declared absent');
  ok(/what activists, NGOs, the Greens and aligned commentators did in the day and how far it travelled, in order of risk to AEP, with government and parliament as the context they react to/.test(guideOf(sys, 'summary')), 'summary: ' + guideOf(sys, 'summary'));
  const mo = guideOf(sys, 'momentum'); ok(/the level and the trend, then the one or two figures they rest on/.test(mo) && /above its own baseline, with its figures/.test(mo) && /the change from the window before/.test(mo) && /never a rating the evidence does not show/.test(mo), 'momentum: ' + mo);
  ok(/what organisations, officials, MPs and influencers said or did, on their own channels or as reported/.test(guideOf(sys, 'actors')) && /never remark that none posted/.test(guideOf(sys, 'actors')), 'actors: ' + guideOf(sys, 'actors'));
  ok(guideOf(sys, 'social') && !/\bwhere\b/i.test(guideOf(sys, 'social')), 'social: no "where": ' + guideOf(sys, 'social'));
  ok(/in words/.test(guideOf(sys, 'sentiment')) && /only from the ids the tone lines list/.test(guideOf(sys, 'sentiment')), 'sentiment: ' + guideOf(sys, 'sentiment'));
  ok(/compare with an earlier period only from THE LAST FILED BRIEF'S BOTTOM LINE/.test(guideOf(sys, 'bottom')), 'bottom: ' + guideOf(sys, 'bottom'));
  ok(/how it treats AEP/.test(guideOf(sys, 'narratives')) && /what was said/.test(guideOf(sys, 'media')), 'narratives and media name AEP');
  const lens = block(sys).split('\n').map(l => l.match(/: (\d[\d,]*) to (\d[\d,]*) words/)); ok(lens.every(Boolean), 'every guide gives a length in words: ' + block(sys));
  const lo = lens.reduce((a, m) => a + Number(m[1].replace(/,/g, '')), 0), hi = lens.reduce((a, m) => a + Number(m[2].replace(/,/g, '')), 0);
  ok(lo >= 3000 && lo <= 3500 && hi >= 4800 && hi <= 5400, 'her format sums to her 3,300-5,000 words: ' + lo + ' to ' + hi);
  ok(/never pad/.test(sys) && /as far as the evidence carries/.test(sys), 'as long as the evidence supports, never padded');
  // the firearms format: its own kinds, its client's short name, and a length for each
  const g = String(w.mod.__test.denSys(await w.mod.__test.deskGet(w.env, 'guns_au'))); const gb = block(g).split('\n').map(l => l.replace(/^- [a-z_]+ \("[^"]*"\): /, ''));
  ok(gb.length === 8 && gb.every(l => /^\d[\d,]* to \d[\d,]* words/.test(l)) && !gb.some(l => /the client|\{[a-z]+\}/.test(l)) && /SIFA and the Shooters Union/.test(guideOf(g, 'implications')) && /judgement today, and why/.test(guideOf(g, 'judgement')), 'the firearms guides: ' + block(g));
});

await S.t('PR3 a section\'s own guide: reaches the prompt, survives a save without guides, cleared by \'\'', async () => {
  const w = await mk(); await seed(w, 'gastax'); const calls = model(w);
  const d0 = (await F(w, 'GET', '/den/desks', null, 'read-key')).body.desks.find(d => d.id === 'aep_au'); const G = 'Open with the harbour levy campaign and its Senate vote; 200 to 300 words.';
  const d1 = await desk(w, 'aep_au', { sections: d0.sections.map(s => (s.id === 'summary' ? Object.assign({}, s, { guide: '  Open with the harbour levy campaign\n\nand its Senate vote;\t200 to 300 words.  ' }) : s)) });
  eq(d1.sections.find(s => s.id === 'summary').guide, G, 'plain text, as one line'); eq(stored(w, 'aep_au').sections.find(s => s.id === 'summary').guide, G, 'kept in the desk\'s sections in D1');
  ok(!d1.sections.some(s => s.id !== 'summary' && 'guide' in s), 'no other section gains a guide');
  await draft(w, 'aep_au'); let sys = String(calls[calls.length - 1].system);
  eq(guideOf(sys, 'summary'), G, 'the section\'s own guide is used in place of its kind\'s'); ok(RISKS.every(t => guideOf(sys, 'risks').indexOf(t) >= 0), 'the other sections keep their kinds\' guides');
  // the page sends sections as it read them; an older page, or a hand-built patch, sends them with no guide at all
  const d2 = await desk(w, 'aep_au', { sections: d1.sections.map(s => ({ id: s.id, kind: s.kind, title: s.id === 'media' ? 'Press Coverage' : s.title })) });
  eq([d2.sections.find(s => s.id === 'summary').guide, d2.sections.find(s => s.id === 'media').title], [G, 'Press Coverage'], 'a save of sections without guides keeps the stored guide');
  for (const bad of [42, null, {}, ['x'], true]) { const dx = await desk(w, 'aep_au', { sections: d2.sections.map(s => (s.id === 'summary' ? { id: s.id, kind: s.kind, title: s.title, guide: bad } : s)) }); eq(dx.sections.find(s => s.id === 'summary').guide, G, 'a guide that is not text is not one: ' + JSON.stringify(bad)); }
  const br = await draft(w, 'aep_au'); eq(guideOf(String(calls[calls.length - 1].system), 'summary'), G, 'and the next draft still uses it');
  const sec = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'summary', revision: br.revision }); eq(sec.status, 200, sec.text.slice(0, 200));
  eq(guideOf(String(calls[calls.length - 1].system), 'summary'), G, 'so does the section written again');
  const long = Array.from({ length: 90 }, (_, i) => 'point' + i).join(' '); const d3 = await desk(w, 'aep_au', { sections: d2.sections.map(s => (s.id === 'bottom' ? Object.assign({}, s, { guide: long }) : s)) });
  eq([d3.sections.find(s => s.id === 'bottom').guide.length, d3.sections.find(s => s.id === 'bottom').guide, d3.sections.find(s => s.id === 'summary').guide], [400, long.slice(0, 400).trim(), G], 'at most 400 characters; the other guide stands');
  const d4 = await desk(w, 'aep_au', { sections: d3.sections.map(s => (s.id === 'summary' ? Object.assign({}, s, { guide: '' }) : s)) });
  ok(!('guide' in d4.sections.find(s => s.id === 'summary')) && !('guide' in stored(w, 'aep_au').sections.find(s => s.id === 'summary')), '\'\' clears it'); ok(d4.sections.find(s => s.id === 'bottom').guide, 'and only that one');
  await draft(w, 'aep_au'); sys = String(calls[calls.length - 1].system); ok(/in order of risk to AEP/.test(guideOf(sys, 'summary')) && guideOf(sys, 'summary') !== G, 'the kind\'s guide is back: ' + guideOf(sys, 'summary'));
  ok(!stored(w, 'aep_vic').sections.some(s => 'guide' in s), 'another desk is untouched');
});

await S.t('PR4 options.title and options.channels: validated, kept across saves that omit them, cleared by \'\' and []', async () => {
  const w = await mk(); await seed(w, 'ftc'); const calls = model(w);
  const d1 = await desk(w, 'mca_au', { options: { title: '  Weekly\n Fuel Credit   Watch ', channels: ['x', 'facebook', 'myspace', 'web', 'any', 'x', 'Instagram', ' youtube ', 7, null, { p: 'x' }] } });
  eq([d1.options.title, d1.options.channels], ['Weekly Fuel Credit Watch', ['x', 'facebook', 'instagram', 'youtube']], 'plain text; unique platform ids, never web or any, an unknown one dropped');
  eq([stored(w, 'mca_au').options.title, stored(w, 'mca_au').options.channels], ['Weekly Fuel Credit Watch', ['x', 'facebook', 'instagram', 'youtube']], 'kept in the desk\'s options in D1');
  await draft(w, 'mca_au'); ok(/writing the Weekly Fuel Credit Watch for Minerals Council of Australia \(MCA national\)/.test(String(calls[0].system)), 'the prompt names the desk\'s own title (denTitle): ' + String(calls[0].system).slice(0, 220));
  // the Options editor's save sends hidden, minEng, fold and density; a weekday save sends only that
  const d2 = await desk(w, 'mca_au', { cadence: 'weekly', window_h: 168, options: { hidden: [], minEng: { x: 5 }, fold: false, density: 'compact' } });
  const d3 = await desk(w, 'mca_au', { options: { weekday: 2 } });
  eq([d2.options.title, d2.options.channels, d3.options.title, d3.options.channels, d3.options.density, d3.options.weekday], ['Weekly Fuel Credit Watch', ['x', 'facebook', 'instagram', 'youtube'], 'Weekly Fuel Credit Watch', ['x', 'facebook', 'instagram', 'youtube'], 'compact', 2], 'both survive saves that leave them out');
  for (const bad of [{ title: 42 }, { title: null }, { title: {} }, { channels: 'x' }, { channels: null }, { channels: { x: 1 } }, { channels: ['myspace', 'web'] }]) {
    const r = await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { options: bad } }); eq([r.status, r.body.desk.options.title, r.body.desk.options.channels], [200, 'Weekly Fuel Credit Watch', ['x', 'facebook', 'instagram', 'youtube']], 'a bad value is dropped and the saved one stands: ' + JSON.stringify(bad)); }
  const long = await desk(w, 'mca_au', { options: { title: 'A very long report name that runs on and on past the eighty characters a title may hold' } }); eq(long.options.title, 'A very long report name that runs on and on past the eighty characters a title m', 'at most 80 characters');
  eq(long.options.title.length, 80);
  const ro = await F(w, 'POST', '/den/desk/update', { id: 'mca_au', patch: { options: { title: 'Reader title', channels: ['reddit'] } } }, 'read-key'); eq([ro.status, stored(w, 'mca_au').options.channels], [403, ['x', 'facebook', 'instagram', 'youtube']], 'a read key sets nothing');
  const cl = await desk(w, 'mca_au', { options: { title: '', channels: [] } }); ok(!('title' in cl.options) && !('channels' in cl.options) && !('title' in stored(w, 'mca_au').options) && !('channels' in stored(w, 'mca_au').options), '\'\' and [] clear them: ' + JSON.stringify(cl.options));
  eq([cl.options.weekday, cl.options.density], [2, 'compact'], 'and nothing else');
  await draft(w, 'mca_au'); ok(/writing the Weekly Activist Activity Brief for/.test(String(calls[calls.length - 1].system)), 'cleared, the title falls back to the cadence\'s');
  ok(!('title' in stored(w, 'aep_au').options) && !('channels' in stored(w, 'aep_au').options), 'another desk is untouched');
});

await S.t('PR5 the output limits, and a cadence-aware prompt: "the week" and its title on a weekly desk, "the day" on a daily one', async () => {
  const w = await mk(); await seed(w, 'ftc'); await seed(w, 'gastax'); const calls = model(w);
  await desk(w, 'mca_au', { cadence: 'weekly', window_h: 168 }); const br = await draft(w, 'mca_au'); const wk = String(calls[0].system);
  eq(calls[0].max_tokens, 16000, 'a draft asks for up to 16,000 output tokens');
  ok(/the week/.test(guideOf(wk, 'summary')) && /Weekly Activist Activity Brief/.test(guideOf(wk, 'summary')), 'a weekly desk\'s summary guide says "the week" and names its title: ' + guideOf(wk, 'summary'));
  ok(!/\bthe day\b|\btoday\b/i.test(block(wk)) && /writing the Weekly Activist Activity Brief for/.test(wk) && !/activist-activity brief/i.test(wk), 'no "the day", and the report is named, not "the weekly activist-activity brief"');
  const sec = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'bottom', revision: br.revision }); eq(sec.status, 200, sec.text.slice(0, 200));
  eq([calls[1].max_tokens, /"bottom":"\.\.\."/.test(calls[1].system), /"summary"/.test(calls[1].system)], [4000, true, false], 'a section written again asks for up to 4,000');
  await desk(w, 'mca_au', { options: { title: 'Weekly Fuel Credit Watch' } }); await draft(w, 'mca_au');
  ok(/Weekly Fuel Credit Watch/.test(guideOf(String(calls[2].system), 'summary')), 'a title of its own is the one the summary guide names: ' + guideOf(String(calls[2].system), 'summary'));
  await draft(w, 'aep_au'); const dy = String(calls[3].system);
  ok(/the day/.test(guideOf(dy, 'summary')) && /Daily Activist Activity Brief/.test(guideOf(dy, 'summary')) && !/\bthe week\b/.test(block(dy)) && calls[3].max_tokens === 16000, 'a daily desk\'s say "the day": ' + guideOf(dy, 'summary'));
  // the firearms series is weekly (DEN.md s.0.1): its judgement and developments say "this week", never "today"
  await desk(w, 'guns_au', { cadence: 'weekly', window_h: 168 }); const gw = String(w.mod.__test.denSys(await w.mod.__test.deskGet(w.env, 'guns_au')));
  ok(/judgement this week, and why/.test(guideOf(gw, 'judgement')) && /matter this week/.test(guideOf(gw, 'developments')) && !block(gw).split('\n').some(l => /\btoday\b|\bthe day\b/i.test(l.replace(/^- [a-z_]+ \("[^"]*"\): /, ''))), 'a weekly firearms desk (its section titles are the desk\'s own): ' + block(gw));
});

// ---- the review fixes (draft lane): a clock that can be moved on, a model that answers only when let go, waits on real time
const realNow = Date.now.bind(Date);
const clock = { set(ms) { Date.now = () => realNow() + ms; }, reset() { Date.now = realNow; } };
const sleep = ms => new Promise(res => setTimeout(res, ms));
const waitFor = async (fn, ms) => { const t = realNow(); while (!fn()) { if (realNow() - t > (ms || 5000)) return false; await sleep(5); } return true; };
const within = (p, ms) => Promise.race([p, sleep(ms || 3000).then(() => null)]);
const syd = t => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
const answer = text => new Response(JSON.stringify({ content: [{ type: 'text', text }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const reply = (b, lead) => { const m = (String(b.messages[0].content).match(/\[M:[A-Za-z0-9_.-]+\]/) || ['[M:0]'])[0]; return answer(JSON.stringify({ sections: { summary: (lead || 'Coverage of the levy continued') + ' ' + m + '.', bottom: 'Activity is steady ' + m + '.' }, ratings: {} })); };
// each call waits until next() (the oldest) or all() lets it go; its summary opens "Draft <n>", n its place among the calls
const heldModel = w => { const calls = [], waiting = [];
  w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const n = calls.length; return new Promise(res => waiting.push(() => res(reply(b, 'Draft ' + n + ' on the levy')))); });
  return { calls, next: () => { const f = waiting.shift(); if (f) f(); }, all: () => waiting.splice(0).forEach(f => f()) }; };

await S.t('PR6 (ST2) the draft\'s hold lasts as long as the draft may, and its write never lands over a brief written meanwhile', async () => {
  const w = await mk({ DEN_HEARTBEAT_MS: '600000' }); await seed(w, 'gastax'); const m = heldModel(w); const T0 = Date.now(); const key = 'den_drafting_aep_au_' + syd(T0);
  const press = () => F(w, 'POST', '/den/brief', { desk: 'aep_au', to: T0 });   // one window end throughout, so the day (and the hold's key) cannot move
  try {
    // a long draft, still being written five and a half minutes on: a second press is refused and sends nothing
    const pa = press(); ok(await waitFor(() => m.calls.length === 1), 'the first draft reached the model');
    const hold = JSON.parse(w.kv.get(key) || 'null'); ok(hold && hold.until - Date.now() > 13 * 60000, 'the hold covers both attempts of the call (2 x 400 s and a minute), renewed as it was sent: ' + JSON.stringify(hold));
    clock.set(330000);
    const rb = await within(press()); ok(rb, 'the second press answers at once (on df42fb8 it passed the five-minute hold and waited on a second model call)');
    eq([rb.status, rb.body.error, m.calls.length], [409, 'draft_in_progress', 1], 'refused, and nothing was sent: ' + rb.text.slice(0, 240));
    ok(/started 3\d\d seconds ago by Analyst/.test(rb.body.detail) && /can be drafted again in \d+ minutes\.$/.test(rb.body.detail), rb.body.detail);
    m.all(); const ra = await pa; eq([ra.status, ra.body.brief.by], [200, 'Analyst'], ra.text.slice(0, 200)); ok(!w.kv.has(key), 'the hold is let go when the draft is written');
    eq(w.env.MIND_DB.db.prepare("SELECT reserved FROM ai_usage WHERE scope='den'").get().reserved, 1, 'one Den call, not two');
    clock.reset();
    // a hold lost (one from before p71 that lapsed, or not yet seen by another location): two drafts run; the second to finish is not saved
    w.env.MIND_DB.db.prepare("DELETE FROM den_briefs WHERE desk='aep_au'").run();
    const p1 = press(); ok(await waitFor(() => m.calls.length === 2)); w.kv.delete(key);
    const p2 = press(); ok(await waitFor(() => m.calls.length === 3), 'with no hold, a second draft starts');
    m.next(); const r1 = await p1; eq(r1.status, 200, r1.text.slice(0, 200)); ok(/^Draft 2 /.test(r1.body.brief.sections.summary.text), r1.body.brief.sections.summary.text);
    m.next(); const r2 = await p2; eq([r2.status, r2.body.error], [409, 'brief_changed'], 'not a 500 on the day\'s unique index: ' + r2.text.slice(0, 240));
    ok(/was not saved over it/.test(r2.body.detail) && r2.body.brief && r2.body.brief.id === r1.body.brief.id && /^Draft 2 /.test(r2.body.brief.sections.summary.text), 'the brief that is there comes back with it: ' + r2.body.detail);
    eq(w.env.MIND_DB.db.prepare("SELECT COUNT(*) n, MAX(revision) r FROM den_briefs WHERE desk='aep_au'").get(), { n: 1, r: 1 }, 'one brief, as the first draft wrote it');
    // a redraft while a person edits the brief: the person's words stand
    const br = r1.body.brief; const pc = press(); ok(await waitFor(() => m.calls.length === 4), 'a redraft of the unedited brief starts');
    const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: 'A person wrote this while the draft ran.' } }); eq(sv.status, 200, sv.text.slice(0, 200));
    m.next(); const rc = await pc; eq([rc.status, rc.body.error], [409, 'brief_changed'], 'the redraft is not saved over the edit: ' + rc.text.slice(0, 200));
    const now = (await F(w, 'GET', '/den/brief?id=' + br.id, null, 'read-key')).body.brief; eq([now.revision, now.sections.summary.text, now.sections.summary.edited], [2, 'A person wrote this while the draft ran.', true], 'the person\'s words stand');
  } finally { clock.reset(); m.all(); }
});

await S.t('PR7 (ST3) the morning cron keeps to the tick: no draft starts too late, a later tick finishes the morning, the call ends with the tick', async () => {
  const w = await mk(); await seed(w, 'gastax'); await seed(w, 'ftc'); const calls = model(w); const cron = w.mod.__test.denBriefCron; const LK = 'den_cron_left_' + syd(Date.now());
  await desk(w, 'aep_au', { auto_draft: true }); await desk(w, 'mca_au', { auto_draft: true });
  // the Den's turn comes ten minutes into the tick: three minutes before the drafts' deadline, too little to start one
  const r1 = await cron(w.env, { t0: Date.now() - 10 * 60000 }); eq([r1.drafted, r1.left, calls.length], [[], ['aep_au', 'mca_au'], 0], 'no draft started, both kept for the day: ' + JSON.stringify(r1));
  eq(JSON.parse(w.kv.get(LK) || 'null'), { aep_au: 0, mca_au: 0 }, 'kept, no call counted');
  // the next tick, held (the window has run), drafts what was left
  const r2 = await cron(w.env, { t0: Date.now(), window: false }); eq([r2.drafted, r2.left, calls.length], [['aep_au', 'mca_au'], [], 2], 'the later tick drafts both: ' + JSON.stringify(r2)); ok(!w.kv.has(LK), 'and the morning is done');
  eq((await F(w, 'GET', '/den/brief?desk=mca_au', null, 'read-key')).body.brief.by, 'morning draft');
  // a later tick with nothing left over drafts nothing, though a desk now has no brief
  w.env.MIND_DB.db.prepare("DELETE FROM den_briefs WHERE desk='aep_au'").run();
  const r3 = await cron(w.env, { t0: Date.now(), window: false }); eq([r3.drafted, calls.length], [[], 2], 'only the window\'s tick drafts the morning: ' + JSON.stringify(r3));
  // the call is given no longer than the tick has left: five minutes before the deadline, not the 400 seconds of a draft
  const seen = [], got = []; const realT = AbortSignal.timeout; AbortSignal.timeout = ms => { seen.push(ms); return realT.call(AbortSignal, ms); };
  w.answer(/api\.anthropic\.com/, (u, init) => { got.push(seen[seen.length - 1]); return reply(JSON.parse(init.body)); });
  try { const r4 = await cron(w.env, { t0: Date.now() - 8 * 60000 }); eq(r4.drafted, ['aep_au'], JSON.stringify(r4));
    ok(got.length === 1 && got[0] <= 5 * 60000 && got[0] > 4 * 60000, 'the model call\'s timeout is what is left of the tick: ' + JSON.stringify(got)); } finally { AbortSignal.timeout = realT; }
});

await S.t('PR8 (ST3) the drafts\' calls overlap, one desk\'s failure is its own, a draft the deadline cut off is tried once more and not twice', async () => {
  const w = await mk(); await seed(w, 'gastax'); await seed(w, 'ftc'); const cron = w.mod.__test.denBriefCron; const LK = 'den_cron_left_' + syd(Date.now());
  await desk(w, 'aep_au', { auto_draft: true }); await desk(w, 'mca_au', { auto_draft: true });
  // two desks: the second's call is sent while the first's is still out (each waits up to 1.5 seconds for the other)
  let out = 0, most = 0; w.answer(/api\.anthropic\.com/, async (u, init) => { out++; most = Math.max(most, out); const t = realNow(); while (out < 2 && realNow() - t < 1500) await sleep(10); const r = reply(JSON.parse(init.body)); out--; return r; });
  const r1 = await cron(w.env); eq([r1.drafted, most], [['aep_au', 'mca_au'], 2], 'both drafted, their model calls out at once: ' + JSON.stringify(r1));
  // one desk's draft throws: the next desk is still drafted, and the one that threw is kept for a later tick
  w.env.MIND_DB.db.prepare('DELETE FROM den_briefs').run(); w.answer(/api\.anthropic\.com/, (u, init) => reply(JSON.parse(init.body)));
  const db = w.env.MIND_DB; const prep = db.prepare.bind(db); let boom = 1;
  db.prepare = sql => { if (boom && sql === 'SELECT * FROM den_briefs WHERE desk=? AND day=?') { boom = 0; throw new Error('D1_ERROR: an invented failure on one desk'); } return prep(sql); };
  let r2 = null; try { r2 = await cron(w.env); } catch (e) { r2 = { threw: String((e && e.message) || e) }; } finally { db.prepare = prep; }
  ok(!r2.threw, 'one desk\'s throw does not end the morning: ' + (r2.threw || '')); eq(r2.drafted, ['mca_au'], 'the next desk is drafted: ' + JSON.stringify(r2));
  // p71 fix (C1): the try counts though no call was sent (a draft that threw before its call was built again on every tick)
  ok(r2.held.some(x => /^aep_au: D1_ERROR: an invented failure on one desk/.test(x)), 'the failure is named: ' + JSON.stringify(r2.held)); eq(JSON.parse(w.kv.get(LK) || 'null'), { aep_au: 1 }, 'kept, its try counted though it sent no call');
  eq((await cron(w.env, { window: false })).drafted, ['aep_au'], 'and drafted by a later tick');
  // the deadline cuts a call off: the desk is tried once more by a later tick, and not a third time
  w.env.MIND_DB.db.prepare('DELETE FROM den_briefs').run(); await desk(w, 'mca_au', { auto_draft: false }); let sent = 0;
  w.answer(/api\.anthropic\.com/, () => { sent++; throw new DOMException('The operation was aborted due to timeout', 'TimeoutError'); });
  const c1 = await cron(w.env, { t0: Date.now() - 8 * 60000 }); ok(c1.left.indexOf('aep_au') >= 0 && c1.held.some(x => /^aep_au: draft_failed \(the tick's time ran out\)$/.test(x)), 'cut off by the tick, and kept: ' + JSON.stringify(c1));
  eq([sent, JSON.parse(w.kv.get(LK) || '{}').aep_au], [1, 1], 'one call, counted, and no second attempt after the cut');
  const c2 = await cron(w.env, { t0: Date.now() - 8 * 60000, window: false }); eq([sent, JSON.parse(w.kv.get(LK) || '{}').aep_au], [2, 2], 'tried once more: ' + JSON.stringify(c2));
  const c3 = await cron(w.env, { window: false }); eq(sent, 2, 'not a third time'); ok(c3.held.some(x => /^aep_au: not drafted after 2 tries this morning$/.test(x)), JSON.stringify(c3)); ok(!w.kv.has(LK), 'and the morning is closed');
});

await S.t('PR9 (ST3) a held tick the same day drafts what the window\'s tick left over, and with nothing left over makes no call', async () => {
  const w = await mk({ AI_AUTOMATION: 'daily' }); await seed(w, 'gastax'); const calls = model(w); const day = syd(Date.now()); const den = () => calls.filter(c => /\(AEP national\)/.test(String(c.system))).length;
  await desk(w, 'aep_au', { auto_draft: true });
  // the window has run today, its Den pass with it (the Den's own marker, p71 fix C3), and the daily brief is written (it
  // keeps its own once-a-day guard)
  await w.env.AXIOM_KV.put('ai_cron_day', day); await w.env.AXIOM_KV.put('den_cron_day', day); await w.env.AXIOM_KV.put('brief_' + day, JSON.stringify({ day, at: Date.now(), brief: { headline: 'already written' } }));
  const tick = async () => { let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited; };
  await tick(); eq(den(), 0, 'nothing left over: the held tick drafts nothing');
  await w.env.AXIOM_KV.put('den_cron_left_' + day, JSON.stringify({ aep_au: 0 }));
  await tick(); eq(den(), 1, 'left over by the window\'s tick: drafted by the next one');
  eq((await F(w, 'GET', '/den/brief?desk=aep_au', null, 'read-key')).body.brief.by, 'morning draft'); ok(!w.kv.has('den_cron_left_' + day), 'and the morning is done');
});

// ---- the second review round (cron lane): a database that says it is busy, on one statement, as many times as asked
const BUSY = 'D1_ERROR: D1 DB is overloaded. Too many requests queued.';
const busyOn = (w, head) => { const db = w.env.MIND_DB, prep = db.prepare.bind(db); const s = { left: 0, seen: 0, restore: () => { db.prepare = prep; } };
  db.prepare = sql => { if (String(sql).indexOf(head) === 0) { s.seen++; if (s.left > 0) { s.left--; throw new Error(BUSY); } } return prep(sql); }; return s; };
const TONE = 'SELECT item, tone, issues FROM sent_items';   // the evidence's tone read, which rethrows a busy database (EV7)
const den = (calls, who) => calls.filter(c => new RegExp('\\(' + who + ' national\\)').test(String(c.system))).length;
const wasLogged = (logs, rx) => logs.some(l => rx.test(l));

await S.t('PR10 (C1, C1b) a draft that throws before its call counts a try: tried once more, never a third time, and one busy read never loses the morning', async () => {
  const w = await mk(); await seed(w, 'gastax'); await seed(w, 'ftc'); const calls = model(w); const cron = w.mod.__test.denBriefCron; const LK = 'den_cron_left_' + syd(Date.now());
  await desk(w, 'aep_au', { auto_draft: true }); await desk(w, 'mca_au', { auto_draft: true }); const tone = busyOn(w, TONE);
  try {
    // the window's tick: aep_au's evidence meets a busy database before its call; mca_au is drafted all the same
    tone.left = 1; const r1 = await cron(w.env);
    eq([r1.drafted, den(calls, 'AEP'), den(calls, 'MCA')], [['mca_au'], 0, 1], 'the next desk is drafted, and no call was sent for the one that threw: ' + JSON.stringify(r1));
    ok(r1.held.some(x => x.indexOf('aep_au: ' + BUSY) === 0), 'the failure is named: ' + JSON.stringify(r1.held));
    eq(JSON.parse(w.kv.get(LK) || 'null'), { aep_au: 1 }, 'kept for a later tick, its try counted though it sent no call (on 3b71160 it stayed at 0)');
    // a later tick tries it once more; busy again, it has had its two tries
    tone.left = 1; const r2 = await cron(w.env, { window: false }); ok(r2.held.some(x => x.indexOf('aep_au: ' + BUSY) === 0), JSON.stringify(r2));
    eq(JSON.parse(w.kv.get(LK) || 'null'), { aep_au: 2 }, 'the second try counted');
    const builds = tone.seen; const r3 = await cron(w.env, { window: false });
    ok(r3.held.indexOf('aep_au: not drafted after 2 tries this morning') >= 0 && !w.kv.has(LK), 'not a third time: the morning is closed for it, and said: ' + JSON.stringify(r3));
    for (let i = 0; i < 4; i++) await cron(w.env, { window: false });
    eq([tone.seen - builds, den(calls, 'AEP')], [0, 0], 'four more held ticks build its evidence no more (on 3b71160 each built it and threw again)');
  } finally { tone.restore(); }
  // one busy read never loses the morning: busy once at the window, drafted by the next tick with one call
  const w2 = await mk(); await seed(w2, 'gastax'); const c2 = model(w2); const cron2 = w2.mod.__test.denBriefCron; await desk(w2, 'aep_au', { auto_draft: true });
  const t2 = busyOn(w2, TONE); try { t2.left = 1; eq((await cron2(w2.env)).drafted, [], 'the window\'s tick: busy'); eq((await cron2(w2.env, { window: false })).drafted, ['aep_au'], 'the next tick drafts it'); eq(den(c2, 'AEP'), 1, 'with one call'); } finally { t2.restore(); }
  // the call's reservation meets a busy database (both attempts): nothing is sent, and the desk is kept for a later tick
  w2.env.MIND_DB.db.prepare('DELETE FROM den_briefs').run(); const rv = busyOn(w2, 'UPDATE ai_usage SET reserved=reserved+1');
  try { rv.left = 2; const r4 = await cron2(w2.env);
    ok(r4.held.some(x => /^aep_au: draft_failed \(the database was busy\)$/.test(x)), 'said, as a busy database: ' + JSON.stringify(r4)); eq([den(c2, 'AEP'), JSON.parse(w2.kv.get('den_cron_left_' + syd(Date.now())) || 'null')], [1, { aep_au: 1 }], 'no call sent, and kept with its try (on 3b71160 it was dropped for the day)');
    eq((await cron2(w2.env, { window: false })).drafted, ['aep_au'], 'and drafted by a later tick'); eq(den(c2, 'AEP'), 2); } finally { rv.restore(); }
});

await S.t('PR11 (C1, C3) a held tick drafts the morning when the window\'s tick never reached the Den, logs every desk it did not draft, and keeps to the Den\'s calls', async () => {
  const w = await mk({ AI_AUTOMATION: 'daily' }); await seed(w, 'gastax'); await seed(w, 'ftc'); const calls = model(w); const day = syd(Date.now()); const LK = 'den_cron_left_' + day; const cron = w.mod.__test.denBriefCron;
  await desk(w, 'aep_au', { auto_draft: true }); await desk(w, 'mca_au', { auto_draft: true });
  // today's window ran (ai_cron_day) but its tick was ended before the Den's turn: no marker of the Den's, nothing left over
  await w.env.AXIOM_KV.put('ai_cron_day', day); await w.env.AXIOM_KV.put('brief_' + day, JSON.stringify({ day, at: Date.now(), brief: { headline: 'already written' } }));
  const tone = busyOn(w, TONE); tone.left = 1; const logs = []; const realLog = console.log; console.log = (...a) => { logs.push(a.map(String).join(' ')); realLog(...a); };
  try { let waited = null; await w.mod.default.scheduled({}, w.env, { waitUntil: p => { waited = p; } }); await waited; } finally { console.log = realLog; tone.restore(); }
  eq([den(calls, 'AEP'), den(calls, 'MCA')], [0, 1], 'the held tick ran the morning: mca_au drafted, aep_au threw on a busy read (on 3b71160 the tick drafted nothing)');
  eq([w.kv.get('den_cron_day'), JSON.parse(w.kv.get(LK) || 'null')], [day, { aep_au: 1 }], 'the Den\'s marker is written; aep_au is kept with its try');
  ok(wasLogged(logs, /^Den morning drafts: mca_au$/), 'the draft is logged');
  ok(wasLogged(logs, new RegExp('^Den morning drafts not made: aep_au: ' + BUSY.replace(/\./g, '\\.'))), 'the desk not drafted is logged by name with its error: ' + JSON.stringify(logs.filter(l => /^Den /.test(l))));
  // a later held tick finishes what was left, and only that: the marker stands for the morning
  eq((await cron(w.env, { window: false })).drafted, ['aep_au'], 'aep_au, on its second try'); w.env.MIND_DB.db.prepare("DELETE FROM den_briefs WHERE desk='mca_au'").run();
  eq([(await cron(w.env, { window: false })).drafted, den(calls, 'MCA')], [[], 1], 'with nothing left over, no second morning');
  // the Den's daily calls bound the held tick's morning as they bind the window's
  const w2 = await mk({ AI_AUTOMATION: 'daily', DEN_DAILY_CALLS: '1' }); await seed(w2, 'gastax'); await seed(w2, 'ftc'); const c2 = model(w2); await desk(w2, 'aep_au', { auto_draft: true }); await desk(w2, 'mca_au', { auto_draft: true });
  const r2 = await w2.mod.__test.denBriefCron(w2.env, { window: false });
  eq([r2.drafted, c2.length], [['aep_au'], 1], 'one call, the day\'s one: ' + JSON.stringify(r2)); ok(r2.held.some(x => /^mca_au: budget_exhausted/.test(x)), 'the other desk is held by the budget: ' + JSON.stringify(r2.held));
  // C1b: a busy read in the morning pass itself, before its desks are kept, throws out of it with no marker written, so the
  // next held tick runs the morning again
  const w3 = await mk({ AI_AUTOMATION: 'daily' }); await seed(w3, 'gastax'); const c3 = model(w3); await desk(w3, 'aep_au', { auto_draft: true });
  const sel = busyOn(w3, 'SELECT 1 x FROM den_briefs WHERE desk=? AND day=?'); sel.left = 1; let threw = '';
  try { await w3.mod.__test.denBriefCron(w3.env); } catch (e) { threw = String((e && e.message) || e); } finally { sel.restore(); }
  ok(threw.indexOf(BUSY) === 0 && !w3.kv.has('den_cron_day') && !w3.kv.has('den_cron_left_' + syd(Date.now())), 'the pass threw before its desks were kept, and wrote no marker: ' + threw);
  eq([(await w3.mod.__test.denBriefCron(w3.env, { window: false })).drafted, den(c3, 'AEP')], [['aep_au'], 1], 'so the next held tick runs the morning (on 3b71160 it found nothing left over and drafted nothing)');
});

await S.t('PR12 (C2) the automation status says the Den may finish its morning drafts on later ticks, at most two tries per desk', async () => {
  const w = await mk({ AI_AUTOMATION: 'daily' }); const A = w.mod.__test.aiAutomationStatus; const SAYS = /The Den may finish its morning drafts on later ticks the same day, at most two tries per desk\./;
  const st = await A(w.env); ok(/^Automated model work runs once a day, the first tick at or after 07:00 Sydney \(not yet run\)\. /.test(st.text) && SAYS.test(st.text), st.text);
  await w.env.AXIOM_KV.put('ai_cron_day', syd(Date.now())); const ran = await A(w.env); ok(/\(ran today\)\./.test(ran.text) && SAYS.test(ran.text), ran.text);
  const r = await F(w, 'GET', '/studio/status', null, 'read-key'); ok(r.body.aiAutomation && SAYS.test(r.body.aiAutomation.text), 'the status route carries it: ' + JSON.stringify(r.body.aiAutomation));
  for (const m of ['always', 'off']) { const t = (await A(Object.assign({}, w.env, { AI_AUTOMATION: m }))).text; ok(!/The Den may/.test(t), m + ': ' + t); }
});

// ---- the third review round (cron lane): a tick's clock moved on while a draft's evidence is built, so the draft ends
// with too little of the tick left to send its call
const slowOn = (w, head, ms) => { const db = w.env.MIND_DB, prep = db.prepare.bind(db); const s = { on: false, at: [], peek: null, restore: () => { db.prepare = prep; clock.reset(); } };
  db.prepare = sql => { if (s.on && String(sql).indexOf(head) === 0) { s.on = false; clock.set(ms); if (s.peek) s.at.push(s.peek()); } return prep(sql); }; return s; };
const late = async (cron, env, s, o) => { s.on = true; try { return await cron(env, Object.assign({ t0: Date.now() - 8 * 60000 }, o || {})); } finally { s.on = false; clock.reset(); } };

await S.t('PR13 (K2) a draft the deadline cut before its call gives its try back: two late ticks never close the morning with no call sent', async () => {
  const w = await mk(); await seed(w, 'gastax'); const calls = model(w); const cron = w.mod.__test.denBriefCron; const LK = 'den_cron_left_' + syd(Date.now()); const kept = () => JSON.parse(w.kv.get(LK) || 'null');
  await desk(w, 'aep_au', { auto_draft: true });
  // the Den's turn comes eight minutes in: five minutes before the drafts' deadline, enough to start; the evidence then takes
  // three and a half, so the call would have under two minutes and is never sent
  const s = slowOn(w, TONE, 210000); s.peek = () => JSON.parse(w.kv.get(LK) || 'null');
  try {
    const r1 = await late(cron, w.env, s);
    eq([r1.drafted, den(calls, 'AEP'), s.at], [[], 0, [{ aep_au: 1 }]], 'no call sent; while its evidence was built the try stood counted, so a platform kill mid-build stays counted (C1): ' + JSON.stringify(r1));
    eq(kept(), { aep_au: 0 }, 'cut before its call, its try is given back (on 2ca1637 it stayed spent: {"aep_au":1})');
    ok(r1.left.indexOf('aep_au') >= 0 && r1.held.some(x => /^aep_au: draft_failed \(the tick's time ran out before its call was sent; no try counted\)$/.test(x)), 'kept, and said: ' + JSON.stringify(r1));
    const r2 = await late(cron, w.env, s, { window: false }); eq([r2.drafted, den(calls, 'AEP'), kept()], [[], 0, { aep_au: 0 }], 'a second late tick, the same: ' + JSON.stringify(r2));
    const r3 = await cron(w.env, { window: false }); eq([r3.drafted, den(calls, 'AEP')], [['aep_au'], 1], 'the next tick with time drafts it, with one call (on 2ca1637 the morning was closed after two tries and no call): ' + JSON.stringify(r3));
    ok(!w.kv.has(LK), 'and the morning is done');
  } finally { s.restore(); }
  // one busy read, then one tick that ran out before its call: one try is spent, and the desk is still drafted
  const w2 = await mk(); await seed(w2, 'gastax'); const c2 = model(w2); const cron2 = w2.mod.__test.denBriefCron; await desk(w2, 'aep_au', { auto_draft: true }); const k2 = () => JSON.parse(w2.kv.get(LK) || 'null');
  const b = busyOn(w2, TONE); try { b.left = 1; eq((await cron2(w2.env)).drafted, [], 'the window\'s tick: busy'); } finally { b.restore(); }
  eq(k2(), { aep_au: 1 }, 'the busy read spent a try');
  const s2 = slowOn(w2, TONE, 210000); try { await late(cron2, w2.env, s2, { window: false }); } finally { s2.restore(); }
  eq([k2(), den(c2, 'AEP')], [{ aep_au: 1 }, 0], 'the late tick sent no call and spent none (on 2ca1637: {"aep_au":2})');
  const r4 = await cron2(w2.env, { window: false }); eq([r4.drafted, den(c2, 'AEP')], [['aep_au'], 1], 'drafted on its second try: ' + JSON.stringify(r4));
});

await S.t('PR14 (K5) busy is read from where the failure came from, never from the model\'s words', async () => {
  const LK = 'den_cron_left_' + syd(Date.now());
  // the model answers without JSON, and its words happen to hold a database's busy phrase
  const w = await mk(); await seed(w, 'gastax'); const cron = w.mod.__test.denBriefCron; await desk(w, 'aep_au', { auto_draft: true }); let sent = 0;
  w.answer(/api\.anthropic\.com/, () => { sent++; return answer('database is locked, the clerk said, so here is the summary in prose rather than the object asked for.'); });
  const r1 = await cron(w.env); eq([sent, r1.held], [2, ['aep_au: draft_failed']], 'two attempts, then dropped for the day as a failed draft, not "the database was busy": ' + JSON.stringify(r1));
  ok(!w.kv.has(LK), 'nothing kept for a later tick'); await cron(w.env, { window: false }); eq(sent, 2, 'a later tick pays for nothing more (on 2ca1637 it was kept and asked twice more: 4 calls)');
  // the database's own busy refusal of the call's reservation is still kept for a later tick (C1), from the error itself
  w.answer(/api\.anthropic\.com/, (u, init) => { sent++; return reply(JSON.parse(init.body)); }); const rv = busyOn(w, 'UPDATE ai_usage SET reserved=reserved+1');
  try { rv.left = 2; const r3 = await cron(w.env); ok(r3.held.some(x => /^aep_au: draft_failed \(the database was busy\)$/.test(x)), 'kept, as a busy database: ' + JSON.stringify(r3)); eq([sent, JSON.parse(w.kv.get(LK) || 'null')], [2, { aep_au: 1 }], 'no call sent, kept with its try'); } finally { rv.restore(); }
  const r4 = await cron(w.env, { window: false }); eq([r4.drafted, sent], [['aep_au'], 3], 'and drafted by a later tick: ' + JSON.stringify(r4));
  // a refusal quotes the model too: the same (a world of its own, made after the first is done with: the stub model is the newest world's)
  const w2 = await mk(); await seed(w2, 'gastax'); const cron2 = w2.mod.__test.denBriefCron; await desk(w2, 'aep_au', { auto_draft: true }); let sent2 = 0;
  w2.answer(/api\.anthropic\.com/, () => { sent2++; return new Response(JSON.stringify({ content: [{ type: 'text', text: 'SQLITE_BUSY is all I can say about this.' }], stop_reason: 'refusal', usage: { input_tokens: 100, output_tokens: 5 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  const r2 = await cron2(w2.env); ok(sent2 === 2 && r2.held.length === 1 && /^aep_au: draft_failed$/.test(r2.held[0]) && !w2.kv.has(LK), 'a refusal that quotes a busy phrase is dropped: ' + JSON.stringify(r2));
  await cron2(w2.env, { window: false }); eq(sent2, 2, 'and is not asked again (on 2ca1637: 4 calls)');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
