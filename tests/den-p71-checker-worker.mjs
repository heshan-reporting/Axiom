/* Anne's Den p71, the checker lane: the figure check on a draft and the dates the rows write as schedules, against the
 * worker module in this process. No provider is contacted: the model is a stub that cites what it is sent. Every outlet,
 * account, person, place and post here is invented. Each case fails on p70 (the base, a2222eb); CK9 on, the fixes after
 * the review of p71 (review ids in brackets), each fail on df42fb8; CK18 on, the fixes after the second review (problem
 * ids A1-A10 in brackets), each fail on 3b71160 but CK27, which fails when the Board's line sorts by date and cuts at forty;
 * CK28 on, the fixes after the third review (problem ids E1-E9 in brackets), each fail on 2ca1637; CK36 on, the fifth round
 * (problem ids P0-P5 in brackets), each fail on ecb2292; CK36's rows named S1-S6, the sixth round, each fail on 312cfb6 (but
 * the rows the problem says still hold); its rows named T1-T6, the seventh round, each fail on 9c48552.
 *   CK1 a figure keeps its sign: "+0.19" or "positive, at 0.19" against a line of -0.19 is flagged, "-0.19" and "minus
 *       0.19" pass, and a tone of "+1" is not the count in "1 comments held, tone -1"
 *   CK2 a count keeps its word: "9 negative and 2 positive" against "26 negative, 8 positive" is flagged, the right counts
 *       pass in any word order, swapped counts are flagged, and one digit before a count word is checked ("4 likes")
 *   CK3 a whole number only: "57" is not found in 13:57, 1957, 0.57 or 157; "12.5%", "12.5 per cent" and "12.5 percent"
 *       are one figure; currency is checked on its number ("$7million" is not "$6million")
 *   CK4 a year is a figure ("by 2041", "June 2028"), except the year of a day-month date; a date's day, a range of days
 *       and an ordinal are not figures
 *   CK5 a sentence with no citation is checked against every evidence line: a figure found nowhere is flagged, one some
 *       line carries passes, a span of time ("within 48 hours") is advice, and uncited still lists only the sentence
 *       whose ids were all invalid (DK7)
 *   CK6 a standing weekly schedule beside an action word gives one entry, at the next of the days it names, marked
 *       recurring with the schedule as written (which names them all); "soon", "regularly", "next week", "every other
 *       Tuesday", a one-off "on Tuesday" and Fridays for Future give no schedule; the vigil told again with no place is the
 *       one that names it; a date written out keeps its day
 *   CK7 the draft's evidence says it: one UPCOMING line saying RECURRING (every Tuesday and Friday), the card's label
 *       unchanged and its figures line saying recurring; a one-off date's line says nothing of the kind
 *   CK8 a flagged sentence is written as the page reads it (no space before the stop), so the page marks it in place
 *   CK9 one entry for each standing schedule [CK3]: eight towns' vigils are eight entries, not sixteen; one vigil told
 *       three ways is one; dated entries come first, so a vote is never pushed out of the Board's forty or the draft's
 *       fifteen; the UPCOMING header says posts and stories, never rows [EV5]
 *   CK10 a schedule's start and end [CK4]: one that ended, whose end has passed, or that is told of a past year gives
 *       nothing; a start still ahead gives no day before it; "Mondays to Fridays" is every day between
 *   CK11 a date's day is not a figure in more of its forms [CK9]: "Tuesday 17", "17, 20 and 24 November", "17/11"; a count
 *       after a weekday still is ("on Tuesday 12 posts")
 *   CK12 count words in a list are one set [CK6]: "41 stories and posts" is the line's "41 posts and stories"; a list that
 *       shares no word with the line's count is still flagged
 *   CK13 "30 of 41 were negative" [CK7]: the 41 is the whole and the tone the 30's; a count given the wrong tone is flagged
 *   CK14 magnitudes, currency and spans [CK8]: "5 million tonnes", "7 billion dollars", "$US9bn" and "9km" are checked;
 *       an uncited "12-year deal" that no line carries is flagged, advice ("within 48 hours") is not
 *   CK15 the lines with no id [CK2]: a figure from the desk line, a block's count or an outlier's line holds, cited or not;
 *       the draft stores those lines, and a section written again and a save are checked against them
 *   CK16 a flag on a sentence that cites nothing says bare [CK11]; a sentence marked uncited is not listed again for its
 *       figures, in a draft or after a save
 *   CK17 the momentum guide asks for a burst's figure in numerals as its line gives it [CK5], and that form passes
 *   CK18 a weekday never masks the figure after it [A1]: "On Saturday, 2,000 people", "On Tuesday 12 MPs", "On Saturday
 *       47%", "By Friday 3.5 million" are read whole, in the line and the sentence; a day led by its weekday still is not
 *   CK19 a line with no id clears a figure only on a count word or a unit it shares [A2]: the desk line's "24 hours" and
 *       the headers' bare counts clear no "24 comments" or "30 likes"; "450 interactions", "6 stories" and the year still do
 *   CK20 a span phrased as the desk's own window is not a claim [A3], cited or not, with no context stored (a brief drafted
 *       before p71's fix, saved); a 24-hour strike and any other span are still checked
 *   CK21 a count of the others is not a count of the whole [A4]: "7 other outlets" is not "(7 outlets in all)", nor "6
 *       outlets in all" the line's "6 other outlets"; "7 more posts in the last day" still holds
 *   CK22 one digit with its unit of time is read in a cited sentence ("over 9 years"), and a magnitude, a measure and a
 *       unit of time must be the line's ("6 billion tonnes" is not "6 million tonnes") [A5]
 *   CK23 "30 of its 41 were negative" (or their, these, those) is "30 of the 41": the 41 is the whole [A6]
 *   CK24 a running schedule runs on [A7]: since last year, a vow ("until the tax is scrapped", "until the final vote"),
 *       begun in a past year and going on, told in the present; "will ... until 30 June" is next June, "has been held ...
 *       from 4 March" runs now; one that ended or is told of a past year still gives nothing; the month is not a "march"
 *   CK25 one dated event told by many stories is one entry, and a standing schedule keeps a place among the fifteen [A8]
 *   CK26 a headline's sentence takes the names of the body's lead: Seaview's vigil is not folded into Pointville's [A9]
 *   CK27 the Board's forty end to end [A10]: forty-two standing vigils, a vote three weeks out and two recorded dates from
 *       a parliament's page give forty with both recorded dates and the vote, and the draft's fifteen carry all three
 *   CK28 a line with no id clears a figure with no count word only when it is a year [E1]: a header's bare "12" is not "12
 *       MPs", nor the desk line's "24 hours" a 24-hour strike or one held for 24 hours, nor the last bottom line's "$4bn"
 *       today's; the draft is given the board's window (denClean), so a window phrase holds with no desk line; end to end
 *       with twelve stories
 *   CK29 a passed day is read in its own clause [E2]: "began on 1 October and closes on 30 January" (or "closing on", "and
 *       wraps up on") keeps next January, as do "started last month, plans a rally on 10 January" and "has held rallies
 *       ... and plans a rally on 4 March"; a day told as begun, or a start told in the past ("held every Friday from 4
 *       March"), is still never next year's, and one told in the present or as set still is
 *   CK30 a schedule that ended gives nothing [E3]: an end in the past after until ("ended", "scrapped", "was held", "took
 *       place"), an end that passed read in its own clause (a "will" elsewhere moves nothing; "held ... until 4 March"),
 *       a habit of a past year told in the past ("would hold", "held"); a vow, an end still to come, a start that passed
 *       and a schedule told in the present or the future still run on
 *   CK31 a measure or a span the line writes another way holds [E4]: Mtpa, ML, MWh, yr and a number the line spells out
 *       ("a two-day strike"), either way round; another number or measure is still flagged, and MW is not MWh
 *   CK32 a cited span without an article is a claim [E5]: "within 24 hours", "lasted over 24 hours" and "Over 24 hours,"
 *       are checked in a cited sentence; the window phrased beyond doubt, or any window phrase in a sentence that cites
 *       nothing, is not
 *   CK33 one event or schedule told several ways is one entry, two different ones never are [E6, E7]: what an action is
 *       about ("a vote on the levy", "on the mine approval") or where it is tells two apart, and tellings that share
 *       nothing stay two; a telling that says less, or one body's vigil told with its place and with its cause, is one; a
 *       headline's own names place it, so one town's vigil under two headlines, and six headlines of one vote, are one,
 *       in either order; a headline naming no one is still placed by its body's lead, and two houses or towns stay two
 *   CK34 a day led by its weekday before a clause that opens with a name, and a month in capitals, are not figures [E8];
 *       a count after a weekday still is ("19 MPs will vote", "21 Labor senators", "13 Greens")
 *   CK35 the media and social headers give each count its word, and a sentence restating one holds [E9]
 *   CK36 one table of every sentence the reviewers have listed for the upcoming dates and the figure check, rounds one to
 *       five, each with its expected result; where the rounds gave different results, the row says which is kept and why
 *       (keep an event rather than drop it; keep two entries apart rather than fold two events into one) [P0]; the sixth
 *       round's rows: a one-off day after until told in the past is next year's unless the sentence tells a schedule [S1]; a
 *       begun verb governs its day across where, when or how and its own object [S2]; a dated entry is named by the action
 *       before its day in its clause, never what that action is to or of [S3]; an appositive or a which, who or that clause
 *       after until is not the until clause's own [S4]; two tellings that share a word but name two measures, or narrow one
 *       in two ways of the same kind (coal and gold), stay two [S5]; a bare window phrase is a claim in a sentence that
 *       restates another figure of its line, and "stretched over" or "unfolded over" is a duration [S6]; the seventh
 *       round's rows: a begun verb governs a later day only within its own stretch, never across a comma, an -ing word,
 *       "to" or "through to", nor a day that modifies a noun ("the 4 March forum") [T1]; a levy is a tax only when every
 *       other word of the two phrases matches [T2]; a hike, rise, increase or cut is no measure's head [T3]; after until,
 *       only a postponement verb gives the next such day, any other past or begun verb ends the event [T4]; an appositive
 *       closed by a second comma is dropped from the until clause [T5]; a bare window phrase in a cited sentence is a
 *       claim only when a line it cites gives a span, and in one that cites nothing it is the window [T6]
 *   CK37 a day is told as begun only by the verb that governs it: next year's hearing or rally beside "began", "started",
 *       "launched" or "kicked off" stands, named by the action nearest it; a day its own verb tells as begun, one after
 *       since and an end told in the past never are [P1]
 *   CK38 a past form that describes a noun in a vow's until clause ("announced in May", "approved last year", "who
 *       approved", "is approved or rejected") does not end it; an until clause whose own verb is past still does [P2]
 *   CK39 a headline whose only name is its first word ("Farmers", "Fishers", "Climate", "Mothers", "Families") is placed by
 *       a lead that says where or names that word again: two towns' events stay two, one town's vigil and one vote stay one [P3]
 *   CK40 what an action is about agrees when the tellings share a word that names it: one Senate vote told five ways is one
 *       entry in either order, and a standing vigil told by who and one told by where are one; what shares only a word any
 *       measure has, or nothing, and a day's rally told by place alone, stay two [P4]
 *   CK41 a bare window phrase in a cited sentence restates the window unless a line it cites carries a span so phrased; a
 *       deadline and "lasted over" are still claims [P5]
 * Run: node --experimental-sqlite tests/den-p71-checker-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('Anne\'s Den p71, checker lane: figures with their signs and words, and standing schedules');
const KEYS = { 'full-key': { n: 'Anne', r: 'full' }, 'read-key': { n: 'Reader', r: 'read' } };
const mk = async env => workerEnv({ env: Object.assign({ ANTHROPIC_API_KEY: 'test-anthropic' }, env || {}), keys: KEYS });
const F = (w, m, p, b, k) => w.call(m, p, b, k || 'full-key');
const H = 3600000, NOW = Date.now();
const figs = c => c.unverified.map(u => u.figures);
// the evidence lines, as denEvidence writes them (the worker's time stamp included)
const TONE = ['T:gas', { k: 'tone', label: 'Harbour gas', line: 'Harbour gas: 43 rows judged, mean tone -0.19, 26 negative, 8 positive' }];
const POST = ['S:5', { k: 'social', label: 'bluesky post', url: 'https://bsky.app/profile/harbour.example.com.au/post/5', line: 'bluesky | 16 nov 09:07 | The levy is a gift to the gas lobby | 3 likes, 1 reposts | 1 comments held, tone -1' }];
const NARR = ['N:harb1', { k: 'narrative', label: 'The levy is a gift to the gas lobby', line: '"The levy is a gift to the gas lobby" | claim: The levy protects producers | 62 rows, 6 in the last day, growing | toward AEP: unknown | taken up by: bluesky' }];

await S.t('CK1 a figure keeps its sign', async () => {
  const w = await mk(); const T = w.mod.__test; const ids = new Map([TONE, POST]);
  const c = T.denCleanText('Tone was mostly negative, at -0.19 across 43 rows [T:gas]. Tone was positive, at +0.19 [T:gas]. It read positive, at 0.19 [T:gas]. It read minus 0.19 [T:gas]. A comment sat at +1 [S:5]. A comment sat at -1 [S:5].', ids);
  eq(figs(c), [['+0.19'], ['0.19'], ['+1']], 'a sign the sentence gives, in a mark or in words, must be the line\'s; a signed tone is never the line\'s count');
  eq(c.unverified[0].sentence, 'Tone was positive, at +0.19.'); eq(c.uncited, []);
});

await S.t('CK2 a count keeps its word', async () => {
  const w = await mk(); const T = w.mod.__test; const ids = new Map([TONE, POST, NARR]);
  const c = T.denCleanText('Tone was positive, at +0.19 across 43 rows, with 9 negative and 2 positive [T:gas]. Of 43 judged rows, 26 were negative and 8 positive [T:gas]. Of them, 8 were negative and 26 positive [T:gas]. The post drew 3 likes and 1 repost [S:5]. The post drew 4 likes [S:5]. The narrative has 62 rows, with 6 rows in the last day [N:harb1]. It had 9 rows in the last day [N:harb1].', ids);
  eq(figs(c), [['+0.19', '9 negative', '2 positive'], ['8 were negative', '26 positive'], ['4 likes'], ['9 rows']], 'counts are read with their words, in either order, and one digit before a count word is checked');
  ok(!c.unverified.some(u => /judged rows, 26 were/.test(u.sentence)), '"43 judged rows" is the line\'s "43 rows judged"');
  ok(!c.unverified.some(u => /62 rows/.test(u.sentence)), 'and "6 rows in the last day" is the line\'s "62 rows, 6 in the last day"');
});

await S.t('CK3 a whole number only', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'stockline - A quarry study', url: 'https://stockline.example.com.au/1', line: 'stockline (sector) | 16 nov 13:57 | A study first drafted in 1957 | a return of 0.57 on 157 tonnes | worth A$2.35bn, with a $6million grant | royalties of 12.5 per cent' }]]);
  const c = T.denCleanText('The study forecast a return of 57% [M:1]. It put the worth at A$2.35bn, with a $6million grant [M:1]. The grant was $7million [M:1]. Royalties are 12.5% [M:1]. Royalties are 12.5 percent [M:1]. Royalties are 13 per cent [M:1].', ids);
  eq(figs(c), [['57%'], ['$7million'], ['13 per cent']], '57 is not a clock time, a year, a decimal or a longer number; a percentage is one figure however it is written; currency is read on its number');
  const fig = T.denFigs('57', true)[0]; ok(['16 nov 13:57', 'in 1957', 'IRR of 0.57', '157 tonnes'].every(l => !T.denFigFound(fig, T.denFigSrc([l]))) && T.denFigFound(fig, T.denFigSrc(['IRR of 57%'])), 'the 57 alone, never inside another number');
});

await S.t('CK4 a year is a figure; a date\'s day and year are not', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:2', { k: 'media', label: 'coastwire - Harbour plans', url: 'https://coastwire.example.com.au/2', line: 'coastwire (metro) | 15 nov 10:20 | Seaport to close its old wharf by 2040 | The first ferry is planned for June 2027 | A rowing club from 1946' }]]);
  const c = T.denCleanText('Seaport will close its old wharf by 2040 [M:2]. Seaport will close it by 2041 [M:2]. The first ferry is planned for June 2027 [M:2]. The first ferry is planned for June 2028 [M:2]. The club dates from 1946 [M:2]. On 18 November 2026 the story ran again [M:2]. Rallies follow on 21-22 November and on the 3rd [M:2]. The vote is on December 9 at 9:30am [M:2].', ids);
  eq(figs(c), [['2041'], ['2028']], 'a year outside a date is checked; the day and year of a day-month date, a range of days, an ordinal and a clock time are not figures');
});

await S.t('CK5 a sentence with no citation is checked against every line', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Point Post - A story', url: 'https://pointpost.example.com.au/1', line: 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | also carried by 6 other outlets | Facebook: 1204 reactions, 40 comments, 22 shares' }], ['S:9', { k: 'social', label: 'x post', url: 'https://x.com/i/web/status/9', line: 'x | 16 nov 09:00 | Sign the levy petition | 120 likes' }]]);
  const c = T.denCleanText('The levy story drew 1,204 reactions on Facebook. Another 9,999 people signed. A campaigner called Sam Private led it [X:404]. The client should respond within 48 hours. Analysis without a citation stays.\n\nA second paragraph [S:9].', ids);
  eq(c.unverified.map(u => [u.sentence, u.figures]), [['Another 9,999 people signed.', ['9,999']]], 'a figure no line carries is flagged, one a line carries passes, and a span of time is advice');
  eq(c.uncited, ['A campaigner called Sam Private led it.'], 'uncited still lists only the sentence whose ids were all invalid (DK7 keeps today\'s rule)'); eq(c.dropped, ['X:404']);
  ok(/Analysis without a citation stays\./.test(c.text) && /Another 9,999 people signed\./.test(c.text) && c.text.split('\n\n').length === 2, 'flagged, never dropped');
});

await S.t('CK6 a standing weekly schedule gives one entry, at the next of the days it names', async () => {
  const w = await mk(); const T = w.mod.__test; const now = Date.parse('2026-11-16T01:00:00Z');   // Monday 16 November 2026, noon in Sydney
  const r = (id, title, body) => ({ id, kind: 'news', title, body: body || '', url: 'https://harbourwire.example.com.au/' + id, meta: {} });
  const rows = [r(1, 'Harbour Watch holds a vigil every Tuesday and Friday at the Point office.'), r(2, 'Organisers promise a rally soon.'), r(3, 'Harbour Neighbours for Clean Air Tuesdays and Fridays in Pointville', 'The Point office, 12 Main St, Pointville. The standing weekly action meets at the gate.'),
    r(4, 'Rallies are held each Saturday outside the depot.'), r(5, 'A picket runs weekly on Thursdays at the gate.'), r(6, 'A twice-weekly vigil is held outside the office on Wednesdays and Saturdays.'), r(7, 'Protests are held regularly, and another is planned next week.'), r(8, 'A vigil every other Tuesday.'),
    r(9, 'A rally on Tuesday drew a crowd.'), r(10, 'Fridays for Future rally on 21 November.'), r(11, 'A vigil every Tuesday and Friday.', 'The vigil every Tuesday and Friday continues.'), r(12, 'A vigil on 17 November, and every Tuesday after.')];
  const up = T.denUpcoming(rows, now);
  // p71 fix (review CK3): one entry for each schedule, not one for each weekday; row 11 tells row 1's vigil again with no
  // place, so it is that vigil, not a second one
  eq(up.map(u => [u.date, u.item, u.event, u.recurring ? u.schedule : '']), [['2026-11-17', 1, 'vigil', 'every Tuesday and Friday'], ['2026-11-17', 3, 'action', 'Tuesdays and Fridays'], ['2026-11-17', 12, 'vigil', ''],
    ['2026-11-18', 6, 'vigil', 'on Wednesdays and Saturdays'], ['2026-11-19', 5, 'picket', 'weekly on Thursdays'], ['2026-11-21', 4, 'rallies', 'each Saturday'], ['2026-11-21', 10, 'rally', '']], 'the next of the days each schedule names, once; never a guess');
  const v = up.filter(u => u.item === 1); eq(v.map(u => [u.weekday, u.recurring, u.yearWritten]), [['Tuesday', true, false]]); ok(/Harbour Watch holds a vigil every Tuesday and Friday at the Point office/.test(v[0].what) && v[0].url === 'https://harbourwire.example.com.au/1');
  eq(T.denUpcoming([r(2, 'Organisers promise a rally soon.')], now), [], '"rally soon" gives nothing');
  eq(T.denUpcoming([rows[0]], Date.parse('2026-11-17T01:00:00Z')).map(u => u.date), ['2026-11-17'], 'on a Tuesday, today\'s vigil is the next');
  eq(T.denUpcoming([rows[0]], Date.parse('2026-11-18T01:00:00Z')).map(u => u.date), ['2026-11-20'], 'on a Wednesday, Friday\'s');
  ok(up.filter(u => !u.recurring).every(u => u.recurring === undefined && u.schedule === undefined), 'a one-off date is as it was');
});

await S.t('CK7 the draft\'s evidence says RECURRING with the schedule', async () => {
  const w = await mk(); const calls = []; const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content; const m = (ev.match(/\[M:\d+\]/) || ['[M:0]'])[0];
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: { summary: 'The levy debate continued ' + m + '.', bottom: 'Activity is steady ' + m + '.', posture: 'The client should continue monitoring.' }, ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  const day = new Date(NOW + 5 * 86400000 + 11 * H); const when = day.getUTCDate() + ' ' + M[day.getUTCMonth()];
  const news = (title, url) => ({ src: 'harbourwire', title, body: title, url, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'harbourwire', tier: 'regional', juris: 'au', reg: 1 } });
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [news('Harbour Watch holds a vigil every Tuesday and Friday at the Point office over the gas export tax', 'https://harbourwire.example.com.au/vigil'), news('Campaigners plan a rally on ' + when + ' against the gas export tax', 'https://harbourwire.example.com.au/rally')] }); eq(seed.status, 200, seed.text.slice(0, 200));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const ev = calls[0].messages[0].content;
  ok(/^UPCOMING \(.*RECURRING marks the next day of a standing weekly schedule, not a new event\)$/m.test(ev), 'the block says what RECURRING means');
  // p71 fix (review CK3): one line for the schedule, at the next of its days; the schedule in brackets names both
  const rec = ev.match(/^\[U:\d+\] (?:Tuesday|Friday) \d{4}-\d{2}-\d{2} \| RECURRING \(every Tuesday and Friday\) \| vigil \| Harbour Watch holds a vigil every Tuesday and Friday/gm) || []; eq(rec.length, 1, 'the schedule has one line: ' + ev.split('\n').filter(l => /^\[U:/.test(l)).join(' // '));
  ok(/^\[U:\d+\] \w+ \d{4}-\d{2}-\d{2} \| rally \| Campaigners plan a rally/m.test(ev), 'a one-off date\'s line says nothing of a schedule');
  const cards = Object.keys(r.body.brief.evidence).filter(k => /^U:/.test(k)).map(k => r.body.brief.evidence[k]).filter(e => e.label && / vigil$/.test(e.label));
  eq(cards.length, 1); ok(cards.every(e => /^\d{4}-\d{2}-\d{2} vigil$/.test(e.label) && /, vigil, recurring \(every Tuesday and Friday\)$/.test(e.sub)), 'the card keeps its label (the page finds its id by it) and its figures line says recurring: ' + JSON.stringify(cards));
  ok(cards.every(e => { const d = new Date(e.label.slice(0, 10) + 'T00:00:00Z'); return [2, 5].indexOf(d.getUTCDay()) >= 0 && d.getTime() - (NOW - 86400000) < 8 * 86400000; }), 'on a Tuesday or a Friday within the week ahead');
});

await S.t('CK8 a flagged sentence is written as the page reads it', async () => {
  const w = await mk(); const T = w.mod.__test; const ids = new Map([['M:1', { k: 'media', label: 'Point Post - A story', line: 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions' }]]);
  const c = T.denCleanText('It reached 9,999 people [M:1][Z:1]. It drew 1,204 reactions [M:1].', ids);
  eq(c.unverified, [{ sentence: 'It reached 9,999 people.', figures: ['9,999'] }], 'no space before the stop, as the page\'s own reading of the sentence has it');
});

// ---- p71 fixes after the review (review ids in the titles) ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON16 = Date.parse('2026-11-16T01:00:00Z');   // Monday 16 November 2026, noon in Sydney
const row = (id, title, body) => ({ id, kind: 'news', title, body: body || '', url: 'https://harbourwire.example.com.au/' + id, meta: {} });
const wire = (title, url) => ({ src: 'harbourwire', title, body: title, url, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: 'harbourwire', tier: 'regional', juris: 'au', reg: 1 } });
// the model: a stub that writes what make(evidence, first story id) says, and keeps every call
const stub = (w, make) => { const calls = []; w.answer(/api\.anthropic\.com/, (u, init) => { const b = JSON.parse(init.body); calls.push(b); const ev = b.messages[0].content; const m = (ev.match(/\[M:\d+\]/) || ['[M:0]'])[0];
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ sections: Object.assign({ summary: 'The levy debate continued ' + m + '.', bottom: 'Activity is steady ' + m + '.' }, make ? make(ev, m) : {}), ratings: {} }) }], stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 50 } }), { status: 200, headers: { 'Content-Type': 'application/json' } }); }); return calls; };
const NAMES = ['Abel', 'Bram', 'Cove', 'Dune', 'Esk', 'Fern', 'Glen', 'Holt', 'Isla', 'Jura', 'Kerr', 'Lune', 'Mere', 'Nook', 'Orme', 'Pell', 'Quay', 'Rill', 'Sark', 'Tarn', 'Usk'];

await S.t('CK9 one entry for each standing schedule, dated entries first (review CK3, EV5)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const towns = ['Pointville', 'Seaview', 'Gullhaven', 'Reefton', 'Coralbay', 'Tidewater', 'Kelpford', 'Shellcove'], vote = row(30, 'The Senate vote on the gas export tax is set for 3 December.');
  const up = T.denUpcoming(towns.map((t, i) => row(10 + i, t + ' residents hold a vigil every Tuesday and Friday over the gas export tax.')).concat([vote]), MON16);
  eq(up.map(u => [u.item, u.date, u.recurring ? u.schedule : u.event]), towns.map((t, i) => [10 + i, '2026-11-17', 'every Tuesday and Friday']).concat([[30, '2026-12-03', 'vote']]), 'each town\'s vigil once, at its next day, its schedule naming both days; then the vote');
  const one = T.denUpcoming([row(40, 'Harbour Watch holds a vigil every Tuesday and Friday at the Point office.'), row(41, 'A vigil every Tuesday and Friday is held by Harbour Watch outside the Point office.'), row(42, 'The vigil every Tuesday and Friday continues.'), row(43, 'Seaview Neighbours hold a vigil every Tuesday and Friday at the pier.')], MON16);
  eq(one.map(u => [u.item, u.date]), [[40, '2026-11-17'], [43, '2026-11-17']], 'one vigil told three ways is one entry; another body\'s vigil at another place is its own');
  const shared = 'The vigil is held every Tuesday and Friday outside the office.';
  eq(T.denUpcoming([row(50, 'Pointville residents keep up their protest', shared), row(51, 'Seaview residents keep up their protest', shared), row(52, 'Pointville protest goes on', shared)], MON16).map(u => [u.item, u.date]), [[50, '2026-11-17'], [51, '2026-11-17']], 'a sentence in the body is placed by its headline: two towns that share a sentence keep two vigils, a town told twice keeps one');
  const up40 = T.denUpcoming(NAMES.flatMap((n, i) => [row(100 + 2 * i, n + ' Hill residents hold a vigil every Tuesday and Friday.'), row(101 + 2 * i, n + ' Bay residents hold a vigil every Tuesday and Friday.')]).concat([vote]), MON16);
  eq([up40.length, up40.filter(u => u.recurring).length, up40[up40.length - 1].item], [40, 39, 30], 'forty at most: the vote is kept and a vigil left out for it, in date order');
  // end to end: sixteen towns' standing vigils and a vote three weeks out, on the Board and in the draft's evidence
  const calls = stub(w); const day = new Date(NOW + 20 * 86400000 + 11 * H); const when = day.getUTCDate() + ' ' + MONTHS[day.getUTCMonth()];
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: NAMES.slice(0, 8).flatMap((n, i) => [wire(n + ' Hill residents hold a vigil every Tuesday and Friday over the gas export tax', 'https://harbourwire.example.com.au/h' + i), wire(n + ' Bay residents hold a vigil every Tuesday and Friday over the gas export tax', 'https://harbourwire.example.com.au/b' + i)])
    .concat([wire('The Senate vote on the gas export tax is set for ' + when, 'https://harbourwire.example.com.au/vote')]) }); eq(seed.status, 200, seed.text.slice(0, 200));
  const board = (await F(w, 'GET', '/den/board?desk=aep_au', null, 'read-key')).body; eq([board.upcoming.length, board.upcoming.filter(u => u.recurring).length], [17, 16], 'the Board: each town\'s vigil once, and the vote');
  const br = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(br.status, 200, br.text.slice(0, 200)); const ev = calls[0].messages[0].content; const U = ev.split('\n').filter(l => /^\[U:/.test(l));
  ok(U.length === 15 && U.some(l => /\| vote \| The Senate vote on the gas export tax/.test(l)), 'the vote reaches the model past sixteen standing vigils: ' + U.join(' // '));
  ok(/^UPCOMING \(dates as written in the posts and stories;/m.test(ev) && !/^UPCOMING \([^\n]*\brows\b/m.test(ev), 'the header is written for the reader: ' + (ev.match(/^UPCOMING.*$/m) || [''])[0]);
});

await S.t('CK10 a schedule\'s start and end (review CK4)', async () => {
  const w = await mk(); const T = w.mod.__test; const wed = Date.parse('2026-11-18T01:00:00Z'), sat = Date.parse('2026-11-21T01:00:00Z');
  const on = (title, now) => T.denUpcoming([row(1, title)], now || MON16).map(u => [u.date, u.recurring ? u.schedule : u.event]);
  eq(on('Weekly vigils on Fridays, starting 4 December.'), [['2026-12-04', 'on Fridays']], 'a start still ahead: its first day, never a Friday before it');
  eq(on('A vigil every Friday from 4 December.'), [['2026-12-04', 'vigil']], 'the day it starts, written out, stands for it');
  eq(on('Vigils every Friday from 4 to 18 December.'), [['2026-12-04', 'every Friday']], 'a span of dates: its first Friday');
  eq(on('A vigil every Friday until 18 December.'), [['2026-11-20', 'every Friday'], ['2026-12-18', 'vigil']], 'an end still ahead keeps this week\'s day');
  eq([on('The vigil, held every Tuesday since March, ended last week.'), on('A vigil every Tuesday until 10 November.'), on('Locals held a vigil every Friday in 2024.'), on('The final weekly vigil on Fridays was held last month.')], [[], [], [], []], 'a schedule that ended, whose end has passed, or that is told of a past year gives nothing');
  eq(on('Harbour Watch has held a vigil every Friday since 2019, and it continues.'), [['2026-11-20', 'every Friday']], 'one running since a past year runs on');
  eq([on('A picket runs Mondays to Fridays at the Point gate.', wed), on('A picket every Monday to Friday at the Point gate.', wed), on('A picket runs Mondays to Fridays at the Point gate.', sat)], [[['2026-11-18', 'Mondays to Fridays']], [['2026-11-18', 'every Monday to Friday']], [['2026-11-23', 'Mondays to Fridays']]], 'a range of days is every day between: on a Wednesday, today; on a Saturday, Monday');
});

await S.t('CK11 a date\'s day is not a figure in more of its forms (review CK9)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['U:1', { k: 'upcoming', label: '2026-11-17 vigil', url: 'https://harbourwire.example.com.au/1', line: 'Tuesday 2026-11-17 | RECURRING (every Tuesday and Friday) | vigil | Harbour Watch holds a vigil every Tuesday and Friday at the Point office.' }]]);
  const c = T.denCleanText('The vigil is held on Tuesday 17 and Friday 20 November [U:1]. It is next held on 17, 20 and 24 November [U:1]. It was listed for 17/11 [U:1]. On Tuesday 12 posts named it [U:1]. On November 3, 41 posts named it [U:1]. It ran on 16-17 nov [U:1].', ids);
  eq(figs(c), [['12 posts'], ['41 posts']], 'a day led by its weekday, a list of days and a numeric date are not figures; a count after a weekday or after a date still is');
});

await S.t('CK12 count words in a list are one set (review CK6)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['C:gastax', { k: 'measure', label: 'Gas taxation: this window against the day before', line: 'Gas taxation: 41 posts and stories in this window, 12 in the day before; 9 comments and 3 likes' }],
    ['I:gastax', { k: 'measure', label: 'Gas taxation: above its usual volume', line: 'Gas taxation ran at 3.2 times its usual volume: 15 posts, stories and comments in this window against 4.7 usual for a window this long' }],
    ['N:n1', { k: 'narrative', label: 'The levy is a gift', line: '"The levy is a gift" | claim: The levy protects producers | first seen 15 November, building | 60 posts and stories in all, 7 in the last day' }]]);
  const c = T.denCleanText('Gas taxation drew 41 stories and posts, against 12 the day before [C:gastax]. It counted 15 stories and posts [I:gastax]. It counted 15 comments, stories and posts [I:gastax]. The narrative drew 60 stories and posts in all [N:n1]. It drew 41 comments and likes [C:gastax].', ids);
  eq(figs(c), [['41 comments']], 'a list is one set in any order, on the line and in the sentence; a list that shares no word with the line\'s count is still flagged');
});

await S.t('CK13 in "30 of 41 were negative" the tone is the 30\'s (review CK7)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['T:gas', { k: 'tone', label: 'Gas taxation', line: 'Gas taxation: mostly negative, across 41 stories with a tone reading (syndicated copies and repeated posts counted once): 30 negative, 6 positive, 5 neutral' }]]);
  const c = T.denCleanText('Of the coverage, 30 of 41 were negative [T:gas]. Overall 30 out of 41 were negative [T:gas]. Of them, 30 of the 41 stories were negative [T:gas]. By contrast 6 of 41 were negative [T:gas].', ids);
  eq(figs(c), [['6']], 'the 41 is the whole and the tone the 30\'s: the right counts pass, and a count given the wrong tone is flagged');
});

await S.t('CK14 magnitudes, currency and spans are checked (review CK8)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Harbourwire - The mine', url: 'https://harbourwire.example.com.au/mine', line: 'Harbourwire | 16 nov 08:10 | The mine will produce 6 million tonnes a year and the levy would raise 4 billion dollars, or $US3bn, over 8 years, under a 15-year supply deal' }]]);
  const c = T.denCleanText('The mine will produce 6 million tonnes a year [M:1]. It will produce 5 million tonnes [M:1]. The levy would raise 7 billion dollars [M:1]. It would raise $US3bn [M:1]. It would raise $US9bn [M:1]. The pit is 9km long [M:1]. AEP signed a 15-year supply deal. AEP signed a 12-year supply deal. The client should respond within 48 hours. Watch it over the next 72 hours.', ids);
  eq(c.unverified.map(u => [u.figures, !!u.bare]), [[['5 million'], false], [['7 billion'], false], [['$US9bn'], false], [['9km'], false], [['12'], true]], 'one digit with a magnitude or a measure, and $US, are read; an uncited span a row would carry is checked, advice is not');
});

await S.t('CK15 the lines with no id hold their figures (review CK2)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['P:14', { k: 'actor', label: 'Harbour Watch on x', url: 'https://x.com/i/web/status/14', line: 'Harbour Watch (org) on x | 16 nov 09:07 | The levy is a gift to the gas lobby | 400 likes, 50 replies' }], ['M:1', { k: 'media', label: 'Point Post - A story', url: 'https://pointpost.example.com.au/1', line: 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions' }]]);
  const context = ['DESK: AEP national (AEP). REPORTING WINDOW: 16-17 November 2026, 24 hours. ISSUES: Gas taxation.', 'TRADITIONAL MEDIA (6 stories, 4 after folding syndicated copies; 4 shown, the most relevant first)', 'SIGNALS NOT TO MISS (computed from the archive)', '- A post by Harbour Watch drew far more than that account\'s posts usually do: 450 interactions against a usual 6 ([P:14]).'];
  const text = 'Harbour Watch\'s post drew 450 interactions, against a usual 6 [P:14]. The press ran 6 stories on the gas export tax in the window. In November 2026, the levy divided the Senate [M:1]. The press ran 7 stories in the window.';
  eq(figs(T.denCleanText(text, ids, context)), [['7 stories']], 'a figure from a line with no id holds, cited or not; one in no line is still flagged');
  eq(T.denCtx(context.slice(2).concat(context.slice(3))), ['- A post by Harbour Watch drew far more than that account\'s posts usually do: 450 interactions against a usual 6.'], 'kept once, with figures, citation marks struck');
  // end to end: the model restates the media block's count and the desk line's year; the draft, a section written again and a save all hold them
  const calls = stub(w, (ev, m) => ({ summary: 'The press ran ' + (ev.match(/^TRADITIONAL MEDIA \((\d+) stor/m) || [])[1] + ' stories on the gas export tax in the window ' + m + '. In ' + (ev.match(/^DESK: .*REPORTING WINDOW: [^\n]*?(20\d\d),/m) || [])[1] + ' the levy divides the Senate ' + m + '.' }));
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [wire('Harbour levy divides the Senate over the gas export tax', 'https://harbourwire.example.com.au/s1'), wire('Producers answer the gas export tax in a letter to the Treasurer', 'https://harbourwire.example.com.au/s2'), wire('Campaigners welcome the gas export tax at the Point office', 'https://harbourwire.example.com.au/s3')] }); eq(seed.status, 200, seed.text.slice(0, 200));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const br = r.body.brief;
  ok(/^The press ran \d+ stories/.test(br.sections.summary.text) && /In 20\d\d the levy/.test(br.sections.summary.text), br.sections.summary.text); eq(br.sections.summary.unverified, [], 'the draft: the media count and the year hold');
  const stored = JSON.parse(w.env.MIND_DB.db.prepare('SELECT evidence FROM den_briefs WHERE id=?').get(br.id).evidence).context;
  ok(Array.isArray(stored) && stored.some(l => /^DESK: /.test(l)) && stored.some(l => /^TRADITIONAL MEDIA \(/.test(l)) && stored.every(l => !/\[[A-Z]:/.test(l) && /\d/.test(l)) && stored.length <= T.DEN_CTX_LINES, 'the brief stores the lines with no id: ' + JSON.stringify(stored));
  const sec = await F(w, 'POST', '/den/brief/section', { id: br.id, section: 'summary', revision: br.revision }); eq(sec.status, 200, sec.text.slice(0, 200)); eq([calls.length, sec.body.brief.sections.summary.unverified], [2, []], 'written again: checked against them');
  const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: sec.body.brief.revision, sections: { summary: sec.body.brief.sections.summary.text + ' Anne added a sentence.' } }); eq(sv.status, 200, sv.text.slice(0, 200)); eq(sv.body.brief.sections.summary.unverified, [], 'saved: read back from the brief');
  const sv2 = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: sv.body.brief.revision, sections: { summary: 'The press ran 97 stories on the gas export tax in the window.' } }); eq(sv2.body.brief.sections.summary.unverified.map(u => u.figures), [['97 stories']], 'a figure in no line is still flagged');
});

await S.t('CK16 a flag on a sentence that cites nothing says so, and nothing is listed twice (review CK11)', async () => {
  const w = await mk(); const T = w.mod.__test; const ids = new Map([['M:1', { k: 'media', label: 'Point Post - A story', url: 'https://pointpost.example.com.au/1', line: 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions' }]]);
  const c = T.denCleanText('The press ran 6 stories in the window. It reached 9,999 people [Z:1]. It drew 1,204 reactions [M:1]. It drew 1,500 reactions [M:1].', ids);
  eq(c.uncited, ['It reached 9,999 people.']); eq(c.unverified, [{ sentence: 'The press ran 6 stories in the window.', figures: ['6 stories'], bare: true }, { sentence: 'It drew 1,500 reactions.', figures: ['1,500 reactions'] }], 'bare on the sentence that cites nothing; the one marked uncited is not listed again; a cited one carries no bare');
  // a draft whose sentence rested on an invented id, saved after an edit elsewhere: still "needs a source", and only that
  stub(w, (ev, m) => ({ summary: 'The levy debate continued ' + m + '. It reached 9,999 people [M:424242].' }));
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [wire('Harbour levy divides the Senate over the gas export tax', 'https://harbourwire.example.com.au/s1')] }); eq(seed.status, 200, seed.text.slice(0, 200));
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; eq([br.sections.summary.uncited, br.sections.summary.unverified], [['It reached 9,999 people.'], []], 'the draft lists it once');
  const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: br.sections.summary.text + ' Anne added a sentence.' } }); eq(sv.status, 200, sv.text.slice(0, 200));
  eq([sv.body.brief.sections.summary.uncited, sv.body.brief.sections.summary.unverified], [['It reached 9,999 people.'], []], 'and so does the save');
});

await S.t('CK17 the momentum guide asks for a burst\'s figure as its line gives it (review CK5)', async () => {
  const w = await mk(); const T = w.mod.__test; const mo = T.DEN_KIND_GUIDE.momentum;
  ok(!/in words such as|four times/.test(mo) && /in numerals exactly as its line gives them/.test(mo), 'the guide no longer asks for the figure in words: ' + mo);
  const ex = (mo.match(/"([^"]*times its usual volume)"/) || [])[1]; ok(ex && T.denFigs(ex, true).length === 1, 'its example is a figure the check reads: ' + ex);
  const desk = await T.deskGet(w.env, 'aep_au'); ok(T.denSys(desk).indexOf(ex) > 0, 'and the prompt carries it');
  const ids = new Map([['I:gastax', { k: 'measure', label: 'Gas taxation: above its usual volume', line: 'Gas taxation ran at 21.4 times its usual volume: 15 posts, stories and comments in this window against 0.7 usual for a window this long' }]]);
  eq(figs(T.denCleanText('Gas taxation ran at 21.4 times its usual volume [I:gastax]. Gas taxation ran at 4 times its usual volume [I:gastax].', ids)), [['4 times']], 'written as the line gives it, the figure holds; another is flagged');
});

// ---- p71 fixes after the second review (problem ids in the titles) ----
const UP1 = ['U:1', { k: 'upcoming', label: '2026-11-17 vigil', url: 'https://harbourwire.example.com.au/1', line: 'Tuesday 2026-11-17 | RECURRING (every Tuesday and Friday) | vigil | Harbour Watch holds a vigil every Tuesday and Friday at the Point office.' }];

await S.t('CK18 a weekday never masks the figure after it (second review A1)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Harbourwire - The rally', url: 'https://harbourwire.example.com.au/rally', line: 'Harbourwire | 16 nov 08:10 | On Saturday, 2,000 people rallied at the pier; 12% of them were members; on Tuesday 12 MPs signed the letter; by Friday 3.5 million had watched' }]]);
  const c = T.denCleanText('On Saturday, 2,000 people rallied at the pier [M:1]. On Saturday, 9,000 people rallied [M:1]. On Tuesday 19 MPs signed [M:1]. On Saturday 47% of them were members [M:1]. By Friday 8.5 million had watched [M:1]. By Friday 3.5 million had watched, and on Tuesday 12 MPs signed [M:1].', ids);
  eq(figs(c), [['9,000'], ['19'], ['47%'], ['8.5 million']], 'a figure after a weekday is read whole, in the line and in the sentence');
  const one = new Map([['M:2', { k: 'media', label: 'Harbourwire - The rally', url: 'https://harbourwire.example.com.au/r2', line: 'Harbourwire | 16 nov 08:10 | About 2,000 people rallied at the pier on Saturday' }]]);
  eq(T.denCleanText('On Saturday, 2,000 people rallied [M:2]. On Saturday, 2,000 people rallied.', one).unverified, [], 'the right count holds, cited or not: no stray "000" is left');
  eq(T.denCleanText('The vigil is on Tuesday 17 [U:1]. It is on Tuesday 17, at the office [U:1]. It runs Tuesday 17 to Friday 20 November [U:1]. It is next held on Friday 20.', new Map([UP1])).unverified, [], 'a day led by its weekday is still not a figure');
});

await S.t('CK19 a line with no id clears a figure only on a word or a unit it shares (second review A2)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['C:gastax', { k: 'measure', label: 'Gas taxation: this window against the day before', line: 'Gas taxation: 3 posts and stories in this window, 0 in the day before' }], ['T:gastax', { k: 'tone', label: 'Gas taxation', line: 'Gas taxation: mostly negative, across 41 stories: 30 negative, 6 positive, 5 neutral' }],
    ['P:14', { k: 'actor', label: 'Harbour Watch on x', url: 'https://x.com/i/web/status/14', line: 'Harbour Watch (org) on x | 16 nov 09:07 | The levy is a gift to the gas lobby | 400 likes, 50 replies' }], ['M:1', { k: 'media', label: 'Point Post - A story', url: 'https://pointpost.example.com.au/1', line: 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions' }]]);
  const context = ['DESK: AEP national (AEP). REPORTING WINDOW: 16-17 November 2026, 24 hours. ISSUES: Gas taxation.', 'TRADITIONAL MEDIA (6 stories, 14 after folding syndicated copies; 10 shown of 14, the most relevant first)', 'SOCIAL (40 posts; 30 shown, the most relevant first)', '- A post by Harbour Watch drew far more than that account\'s posts usually do: 450 interactions against a usual 6.'];
  const c = T.denCleanText('Gas taxation drew 24 posts and stories in this window [C:gastax]. The lead story drew 24 comments [M:1]. Of them, 24 were negative [T:gastax]. It drew 30 likes [P:14]. It drew 40 replies [P:14]. It drew 14 comments [M:1]. The press ran 30 stories in the window. Gas taxation drew 24 in this window [C:gastax]. The levy would raise $24million [M:1].', ids, context);
  eq(figs(c), [['24 posts'], ['24 comments'], ['24 were negative'], ['30 likes'], ['40 replies'], ['14 comments'], ['30 stories'], ['24'], ['$24million']], 'the desk line\'s "24 hours" and the headers\' bare counts clear no figure of another kind');
  eq(T.denCleanText('Harbour Watch\'s post drew 450 interactions, against a usual 6 [P:14]. The press ran 6 stories on the gas export tax in the window. In November 2026, the levy divided the Senate [M:1]. Social media carried 40 posts [M:1].', ids, context).unverified, [], 'a count with the word its line gives it, and the year, still hold');
});

await S.t('CK20 a span phrased as the desk\'s own window is not a claim, with no context stored (second review A3)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Point Post - The strike', url: 'https://pointpost.example.com.au/strike', line: 'Point Post | 16 nov 08:10 | Unions called a 48-hour strike over the levy' }]]);
  const text = 'In the 24 hours to Monday, coverage held steady. Over 24 hours the story spread to six outlets. In the 24 hours to Monday, the strike led the coverage [M:1]. Unions called a 24-hour strike [M:1]. Over 36 hours the story spread.';
  eq([figs(T.denCleanText(text, ids, [], 24)), figs(T.denCleanText('In the 7 days to Sunday, the strike led [M:1]. In the 24 hours to Sunday, it peaked [M:1].', ids, [], 168))], [[['24'], ['36']], [['24']]], 'the window as the brief stores it: a span phrased as that window holds, cited or not; a 24-hour strike and any other span are still checked');
  // end to end: a brief drafted before its lines with no id were stored, saved after an edit
  stub(w); const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [wire('Harbour levy divides the Senate over the gas export tax', 'https://harbourwire.example.com.au/s1')] }); eq(seed.status, 200, seed.text.slice(0, 200));
  const br = (await F(w, 'POST', '/den/brief', { desk: 'aep_au' })).body.brief; const db = w.env.MIND_DB.db; const row0 = db.prepare('SELECT evidence, window_h FROM den_briefs WHERE id=?').get(br.id); eq(row0.window_h, 24);
  const ev = JSON.parse(row0.evidence); delete ev.context; db.prepare('UPDATE den_briefs SET evidence=? WHERE id=?').run(JSON.stringify(ev), br.id);
  const sv = await F(w, 'POST', '/den/brief/save', { id: br.id, revision: br.revision, sections: { summary: 'In the 24 hours to Monday, coverage held steady. Over 36 hours the story spread.' } }); eq(sv.status, 200, sv.text.slice(0, 200));
  eq(sv.body.brief.sections.summary.unverified.map(u => [u.figures, !!u.bare]), [[['36'], true]], 'saved with no stored context: the window\'s span holds, another span is flagged');
});

await S.t('CK21 a count of the others is not a count of the whole (second review A4)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Point Post - Harbour levy', url: 'https://pointpost.example.com.au/1', line: 'Point Post (metro) | 16 nov 08:10 | Harbour levy divides the Senate | also carried by 6 other outlets (7 outlets in all) | Facebook: 300 reactions, 40 comments, 22 shares (362 interactions in all)' }]]);
  const c = T.denCleanText('It was carried by 7 other outlets [M:1]. It was carried by 6 other outlets [M:1]. It was carried by 7 outlets [M:1]. It was carried by 6 outlets [M:1]. It ran in 6 outlets in all [M:1]. It ran in a total of 7 outlets [M:1]. It drew 362 interactions on Facebook [M:1].', ids);
  eq(figs(c), [['7 other outlets'], ['6 outlets']], 'the others are the line\'s others and the whole its whole; a count that says neither may be either, as before');
  const n = new Map([['N:n1', { k: 'narrative', label: 'The levy is a gift', line: '"The levy is a gift" | claim: The levy protects producers | first seen 15 November, building | 60 posts and stories in all, 7 in the last day' }]]);
  eq(figs(T.denCleanText('It drew 7 more posts in the last day [N:n1]. It drew 60 posts in all [N:n1]. It drew 60 other posts [N:n1].', n)), [['60 other posts']], '"more" is not "other": 7 more posts in the last day are the line\'s 7 in the last day');
});

await S.t('CK22 one digit with its unit of time is read, and a magnitude or a unit must be the line\'s (second review A5)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Harbourwire - The mine', url: 'https://harbourwire.example.com.au/mine', line: 'Harbourwire | 16 nov 08:10 | The mine will produce 6 million tonnes a year over 8 years under a 24-hour permit, worth $4.2bn, behind a 6m sea wall' }]]);
  const c = T.denCleanText('It runs over 9 years [M:1]. It runs over 8 years [M:1]. It runs over 8 months [M:1]. It will produce 6 billion tonnes a year [M:1]. It will produce 6 million tonnes a year [M:1]. It is worth $4.2 billion [M:1]. It is worth 4.2 million [M:1]. It holds a 24-day permit [M:1]. It sits behind a 6-metre sea wall [M:1]. AEP signed a 9-year deal. Over 3 days the story spread.', ids);
  eq(figs(c), [['9 years'], ['8 months'], ['6 billion'], ['4.2 million'], ['24']], 'a one-digit span in a cited sentence is read; a magnitude, a measure and a unit of time must be the line\'s ("m" may be metres); an uncited one-digit span is not read, as before');
});

await S.t('CK23 "30 of its 41 were negative" is "30 of the 41" (second review A6)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['T:gas', { k: 'tone', label: 'Gas taxation', line: 'Gas taxation: mostly negative, across 41 stories with a tone reading (syndicated copies and repeated posts counted once): 30 negative, 6 positive, 5 neutral' }]]);
  const c = T.denCleanText('Of the coverage, 30 of its 41 were negative [T:gas]. Overall, 30 of their 41 were negative [T:gas]. Of these, 30 of those 41 were negative [T:gas]. By contrast, 6 of its 41 were negative [T:gas].', ids);
  eq(figs(c), [['6']], 'the 41 is the whole however the determiner reads, and a count given the wrong tone is still flagged');
});

await S.t('CK24 a running schedule runs on (second review A7)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const on = title => T.denUpcoming([row(1, title)], MON16).map(u => [u.date, u.recurring ? u.schedule : u.event]);
  eq(['Residents have held a vigil every Friday since last year.', 'Residents hold a vigil every Friday until the gas export tax is scrapped.', 'They protest every Tuesday and Friday until the mine is stopped.', 'The vigil runs every Friday until the project is abandoned.', 'A rally is held every Saturday until the final Senate vote.', 'The vigil every Friday, which began in 2024, goes on.', 'Protesters arrested in 2025 hold a vigil every Tuesday outside the depot.'].map(on),
    [[['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-17', 'every Tuesday and Friday']], [['2026-11-20', 'every Friday']], [['2026-11-21', 'every Saturday']], [['2026-11-20', 'every Friday']], [['2026-11-17', 'every Tuesday']]], 'since last year, a vow, begun in a past year and going on, or told in the present: it runs on');
  eq([on('Residents will hold a vigil every Friday until 30 June.'), on('A vigil has been held every Friday from 4 March.')], [[['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']]], 'on 16 November, "will ... until 30 June" ends next June, and a start told as begun has passed: no entry next March');
  eq([on('Every Friday until it was scrapped in June, residents held a vigil.'), on('Locals held a vigil every Friday last year.'), on('In 2024 the group held a vigil every Friday.'), on('The vigil, held every Tuesday since March, ended last week.')], [[], [], [], []], 'one that ended, or is told of a past year in the past, still gives nothing');
  eq(on('The campaign, which started on 4 March, plans a rally on 21 November.'), [['2026-11-21', 'rally']], 'the month beside its day is not the action "march"');
});

await S.t('CK25 one dated event told by many stories is one entry, and a standing schedule keeps a place (second review A8)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const votes = Array.from({ length: 16 }, (_, i) => row(60 + i, 'The Senate vote on the gas export tax is set for 3 December, report ' + (i + 1) + ' says.'));
  const up = T.denUpcoming(votes.concat([row(90, 'Pointville residents hold a vigil every Tuesday and Friday.')]), MON16);
  eq([up.map(u => [u.date, u.event, !!u.recurring]), T.denUpPick(up, 15).length], [[['2026-11-17', 'vigil', true], ['2026-12-03', 'vote', false]], 2], 'one vote told by sixteen stories is one entry, beside the vigil');
  eq(T.denUpcoming([row(70, 'The Senate vote on the levy is set for 3 December.'), row(71, 'The Assembly vote on the levy is set for 3 December.'), row(72, 'A vote on the levy is set for 3 December.')], MON16).map(u => [u.item, u.event]), [[70, 'vote'], [71, 'vote']], 'two houses\' votes on one day stay two; a telling that names neither is the vote it does not contradict');
  const many = Array.from({ length: 20 }, (_, i) => ({ date: '2026-12-' + String(i + 1).padStart(2, '0'), event: 'vote', item: i + 1 })).concat([{ date: '2026-11-17', event: 'vigil', recurring: true, item: 99 }]);
  const p15 = T.denUpPick(many, 15); eq([p15.length, p15.filter(u => u.recurring).map(u => u.item), p15[p15.length - 1].item], [15, [99], 14], 'twenty dated events and a standing vigil: the vigil keeps a place, the latest dated ones give way');
});

await S.t('CK26 a headline\'s sentence takes the names of the body\'s lead (second review A9)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const sea = row(80, 'Weekly vigil every Tuesday and Friday', 'Seaview residents gather at the pier.'), pt = row(81, 'Pointville residents hold a vigil every Tuesday and Friday.');
  eq([T.denUpcoming([sea, pt], MON16).map(u => u.item).sort(), T.denUpcoming([pt, sea], MON16).map(u => u.item).sort()], [[80, 81], [80, 81]], 'Seaview\'s vigil is its own, in either order');
  eq(T.denUpcoming([pt, row(82, 'Weekly vigil every Tuesday and Friday', 'Residents gather at the gate.')], MON16).map(u => u.item), [81], 'a telling whose body names no place is the vigil it does not contradict');
});

await S.t('CK27 the Board\'s forty keeps dated and recorded entries, end to end (second review A10)', async () => {
  const w = await mk(); const at = n => new Date(NOW + n * 86400000 + 11 * H); const words = n => at(n).getUTCDate() + ' ' + MONTHS[at(n).getUTCMonth()];
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: NAMES.flatMap((n, i) => [wire(n + ' Hill residents hold a vigil every Tuesday and Friday over the gas export tax', 'https://harbourwire.example.com.au/h' + i), wire(n + ' Bay residents hold a vigil every Tuesday and Friday over the gas export tax', 'https://harbourwire.example.com.au/b' + i)])
    .concat([wire('The Senate vote on the gas export tax is set for ' + words(20), 'https://harbourwire.example.com.au/vote')]) }); eq(seed.status, 200, seed.text.slice(0, 200));
  eq((await F(w, 'GET', '/den/board?desk=aep_au', null, 'read-key')).status, 200);   // the first read makes the parliament calendar's table
  const put = w.env.MIND_DB.db.prepare('INSERT INTO den_process(id, type, title, stage, url, issues, next_date, next_what, seen, updated) VALUES(?,?,?,?,?,?,?,?,?,?)');
  put.run('proc_ck27a', 'inquiry', 'Gas Export Tax Bill 2026 inquiry', 'hearings', 'https://parliament.example.com.au/inquiry', '["gastax"]', at(9).toISOString().slice(0, 10), 'public hearing', NOW, NOW);
  put.run('proc_ck27b', 'bill', 'Gas Export Tax Bill 2026', 'second reading', 'https://parliament.example.com.au/bill', '["gastax"]', at(25).toISOString().slice(0, 10), 'second reading debate', NOW, NOW);
  const up = (await F(w, 'GET', '/den/board?desk=aep_au', null, 'read-key')).body.upcoming;
  eq([up.length, up.filter(u => u.recorded).map(u => u.event), up.filter(u => !u.recurring && !u.recorded).map(u => u.event), up.filter(u => u.recurring).length], [40, ['public hearing', 'second reading debate'], ['vote'], 37], 'forty: both recorded dates and the vote stand past forty-two standing vigils');
  ok(up.every((u, i) => !i || up[i - 1].date <= u.date), 'in date order');
  const calls = stub(w); const br = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(br.status, 200, br.text.slice(0, 200)); const U = calls[0].messages[0].content.split('\n').filter(l => /^\[U:/.test(l));
  eq([U.length, U.filter(l => /\| RECORDED \|/.test(l)).length, U.filter(l => /\| vote \| The Senate vote/.test(l)).length, U.filter(l => /\| RECURRING \(/.test(l)).length], [15, 2, 1, 12], 'the draft\'s fifteen from that Board: both recorded dates, the vote and twelve vigils: ' + U.join(' // '));
});

// ---- p71 fixes after the third review (problem ids in the titles) ----
const story = (src, title, url) => ({ src, title, body: title, url, ts: NOW - 2 * H, meta: { issues: ['gastax'], source: src, tier: 'regional', juris: 'au', reg: 1 } });

await S.t('CK28 a line with no id clears a figure with no count word only when it is a year, and the draft is given its window (third review E1)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:2', { k: 'media', label: 'Point Post - The strike', url: 'https://pointpost.example.com.au/strike2', line: 'Point Post | 16 nov 08:10 | Unions called a 48-hour strike over the levy, and MPs signed a letter' }]]);
  const context = ['DESK: AEP national (AEP). REPORTING WINDOW: 16-17 November 2026, 24 hours. ISSUES: Gas taxation.', 'TRADITIONAL MEDIA (12 stories, 12 after folding syndicated copies; 12 shown, the most relevant first)'];
  eq(figs(T.denCleanText('Some 12 MPs signed the letter [M:2]. Unions called a 24-hour strike [M:2]. The strike held for 24 hours [M:2]. In 2026 the levy divides the Senate [M:2]. The press ran 12 stories on the levy [M:2]. In the 24 hours to Monday, the strike led the coverage [M:2].', ids, context, 24)),
    [['12'], ['24'], ['24']], 'a header\'s bare count is not "12 MPs", nor the desk line\'s "24 hours" a 24-hour strike or one held for 24 hours; the year, a count with its word and the window still hold');
  eq(figs(T.denCleanText('The levy would raise $4bn [M:2]. By 2041 the levy ends [M:2].', ids, context.concat(['THE LAST FILED BRIEF\'S BOTTOM LINE (2026-11-16, for continuity; say what changed): The levy would raise $4bn by 2041.']), 24)), [['$4bn']], 'a measure with no count word is cleared by no line with no id; a year is');
  const desk = await T.deskGet(w.env, 'aep_au'); const d = T.denClean(desk, { sections: { summary: 'Over the past 24 hours, the strike led the coverage [M:2]. Unions called a 24-hour strike [M:2].' } }, ids, [], 24);
  eq(d.sections.summary.unverified.map(u => u.figures), [['24']], 'the draft is given the board\'s window, with no desk line to read it from: the window holds, the strike is checked');
  // end to end: twelve stories in the headers; the model writes "12 MPs" and a "24-hour strike" that its story does not carry
  stub(w, (ev, m) => ({ summary: 'Some 12 MPs signed the letter ' + m + '. Unions called a 24-hour strike ' + m + '. In the 24 hours to Monday, the levy led the coverage ' + m + '.' }));
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: NAMES.slice(0, 12).map((n, i) => wire(n + ' residents answer the gas export tax', 'https://harbourwire.example.com.au/e1/' + i)) }); eq(seed.status, 200, seed.text.slice(0, 200));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200));
  eq(r.body.brief.sections.summary.unverified.map(u => u.figures), [['12'], ['24']], 'the draft flags both; the window\'s own span holds');
});

await S.t('CK29 a passed day is read in its own clause, so next year\'s date beside one told as begun is kept (third review E2)', async () => {
  const w = await mk(); const T = w.mod.__test; const on = title => T.denUpcoming([row(1, title)], MON16).map(u => u.date);
  eq(['Consultation began on 1 October and closes on 30 January.', 'The inquiry began in September; submissions close on 15 January.', 'The campaign, which started last month, plans a rally on 10 January.', 'The group has held rallies since 2019 and plans a rally on 4 March.', 'Consultation began on 1 October, closing on 30 January.', 'Consultation began on 1 October and wraps up on 30 January.'].map(on),
    [['2027-01-30'], ['2027-01-15'], ['2027-01-10'], ['2027-03-04'], ['2027-01-30'], ['2027-01-30']], 'told on 16 November, next year\'s deadline or rally stands, though the sentence says began, started or has held');
  eq(['A vigil has been held every Friday from 4 March.', 'Consultation began on 1 October.', 'The rally, which began on 4 March, will be held again on 10 January.', 'Protests have continued since 4 March.', 'The vigil, held every Friday from 4 March, continues.'].map(on), [['2026-11-20'], [], ['2027-01-10'], [], ['2026-11-20']], 'a day its own clause tells as begun, or a start told in the past, is never next year\'s');
  eq(['The rally is held on 4 March.', 'The hearing is being held on 2 February.', 'The vote has been set for 4 March.'].map(on), [['2027-03-04'], ['2027-02-02'], ['2027-03-04']], 'a day told in the present or as set is next year\'s, as before');
});

await S.t('CK30 a schedule that has ended gives nothing (third review E3)', async () => {
  const w = await mk(); const T = w.mod.__test; const on = title => T.denUpcoming([row(1, title)], MON16).filter(u => u.recurring).map(u => [u.date, u.schedule]);
  eq(['Locals held a vigil every Friday until the campaign ended.', 'Residents held a vigil every Friday until the government scrapped the tax.', 'Rallies every Saturday until the final vote ended in March.', 'Rallies every Saturday until the final vote was held in March.', 'Residents held a vigil every Friday until the vote took place.', 'Residents held a vigil every Friday until the bill passed.'].map(on), [[], [], [], [], [], []], 'after until, an end told in the past, the simple past too: no entry');
  eq(['Protesters held a vigil every Friday until 10 November and say they will return.', 'Residents, who will meet the minister, held a vigil every Friday until 10 November.', 'Locals held a vigil every Friday until 4 March.', 'Residents hold a vigil every Friday until 10 November.'].map(on), [[], [], [], []], 'an end that passed, read in its own clause: a "will" elsewhere moves nothing, and an end told in the past has passed however far back');
  eq(['Every Friday in 2025, locals would hold a vigil.', 'Locals who hold the lease held a vigil every Friday in 2024.', 'Locals held a vigil every Friday in 2024 and say they will return.', 'Locals held a vigil every Friday in 2024, but the tax remains.'].map(on), [[], [], [], []], 'told of a past year, a habit told in the past has ended, whatever another clause says');
  eq(['Residents hold a vigil every Friday until the gas export tax is scrapped.', 'They will rally every Friday until the levy has been scrapped.', 'Residents hold a vigil every Friday until the final vote is held.', 'Residents hold a vigil every Friday until their demands are met.', 'Residents will hold a vigil every Friday, until 30 June.', 'Residents hold a vigil every Friday from 4 October.', 'Protesters arrested in 2025 hold a vigil every Tuesday outside the depot.', 'Residents, who held a rally in 2024, hold a vigil every Friday.', 'The group, formed in 2024, plans to hold a vigil every Friday.'].map(on),
    [[['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']], [['2026-11-17', 'every Tuesday']], [['2026-11-20', 'every Friday']], [['2026-11-20', 'every Friday']]], 'a vow, an end still to come, a start that passed and a schedule told in the present or the future run on');
});

await S.t('CK31 a measure or a span the line writes another way holds (third review E4)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:3', { k: 'media', label: 'Harbourwire - The mine', url: 'https://harbourwire.example.com.au/mine2', line: 'Harbourwire | 16 nov 08:10 | The 6Mtpa expansion would use 300 megalitres of water a year under a 10-yr deal, after a two-day strike and ten days of talks, beside a 40MWh battery' }]]);
  eq(figs(T.denCleanText('The 6 million tonne a year expansion was approved [M:3]. It would use 300ML of water [M:3]. It runs under a 10-year deal [M:3]. It follows a 2-day strike [M:3]. The talks took 10 days [M:3]. It sits beside a 40 megawatt hour battery [M:3].', ids)), [], 'Mtpa is millions of tonnes, ML megalitres, yr a year and MWh a megawatt hour, and a span the line spells out is its number');
  eq(figs(T.denCleanText('The 7 million tonne a year expansion was approved [M:3]. It would use 400ML of water [M:3]. It runs under a 12-year deal [M:3]. It follows a 3-day strike [M:3]. The talks took 11 days [M:3]. It would use 300 gigalitres [M:3]. It sits beside a 40MW battery [M:3].', ids)), [['7 million'], ['400ML'], ['12'], ['3-day'], ['11'], ['300 gigalitres'], ['40MW']], 'another number or another measure is still flagged, and a power is not an energy');
  const back = new Map([['M:4', { k: 'media', label: 'Harbourwire - The mine', url: 'https://harbourwire.example.com.au/mine3', line: 'Harbourwire | 16 nov 08:10 | The 6 million tonnes a year expansion would use 300ML under a 10-year deal' }]]);
  eq(figs(T.denCleanText('The 6Mtpa expansion was approved [M:4]. It would use 300 megalitres [M:4]. It runs under a 10-yr deal [M:4].', back)), [], 'and the other way round');
});

await S.t('CK32 a cited span without an article is a claim, not the window (third review E5)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:1', { k: 'media', label: 'Point Post - The blockade', url: 'https://pointpost.example.com.au/blockade', line: 'Point Post | 16 nov 08:10 | The minister promised a reply within 48 hours; the blockade lasted 12 hours' }]]);
  // p71 fx5 (P5): "Over 24 hours," opening a cited sentence restates the window when the line it cites carries no span so
  // phrased (this one has "within 48 hours" and "lasted 12 hours"), so only the 5,000 is flagged; the deadline and the
  // duration are still claims
  eq(figs(T.denCleanText('The minister promised a reply within 24 hours [M:1]. The blockade lasted over 24 hours [M:1]. Over 24 hours, the petition drew 5,000 names [M:1]. The blockade lasted over 24 hours.', ids, [], 24)), [['24'], ['24'], ['5,000'], ['24']], 'a deadline and a duration equal to the window are checked in a cited sentence; "over" after a span\'s verb is "more than", cited or not');
  eq(figs(T.denCleanText('In the 24 hours to Monday, the blockade led the coverage [M:1]. Over the past 24 hours the blockade led [M:1]. This 24-hour reporting window saw the blockade lead [M:1]. Over 24 hours the story spread to six outlets. The story spread to six outlets over 24 hours.', ids, [], 24)), [], 'the window phrased beyond doubt, or any window phrase in a sentence that cites nothing, is not a claim');
});

await S.t('CK33 one event or schedule told several ways is one entry, two different ones never are (third review E6, E7)', async () => {
  const w = await mk(); const T = w.mod.__test; const U = rows => T.denUpcoming(rows, MON16).map(u => [u.item, u.date, u.recurring ? u.schedule : u.event]);
  eq([U([row(1, 'A vote on the levy is set for 3 December.'), row(2, 'A vote on the mine approval is set for 3 December.')]), U([row(3, 'Farmers plan a rally on 21 November.'), row(4, 'A rally on 21 November will oppose the mine.')]), U([row(5, 'Residents hold a vigil every Friday over the levy.'), row(6, 'Residents hold a vigil every Friday over the mine.')]), U([row(13, 'Harbour Watch holds a vigil every Friday at the pier.'), row(14, 'Harbour Watch holds a vigil every Friday at the depot.')])],
    [[[1, '2026-12-03', 'vote'], [2, '2026-12-03', 'vote']], [[3, '2026-11-21', 'rally'], [4, '2026-11-21', 'rally']], [[5, '2026-11-20', 'every Friday'], [6, '2026-11-20', 'every Friday']], [[13, '2026-11-20', 'every Friday'], [14, '2026-11-20', 'every Friday']]], 'what an action is about, or where it is, tells two events apart, dated or standing; tellings that share nothing stay two');
  eq([U([row(7, 'The Senate vote on the levy is set for 3 December.'), row(8, 'A vote on the levy is set for 3 December.')]), U([row(10, 'A rally on 21 November will oppose the mine.'), row(9, 'Farmers plan a rally on 21 November against the mine.')]), U([row(15, 'Harbour Watch holds a vigil every Tuesday and Friday at the Point office.'), row(16, 'Harbour Watch holds a vigil every Tuesday and Friday over the levy.'), row(17, 'A vigil every Tuesday and Friday outside the office over the levy.')])],
    [[[7, '2026-12-03', 'vote']], [[9, '2026-11-21', 'rally']], [[15, '2026-11-17', 'every Tuesday and Friday']]], 'a telling that says less is the event it does not contradict, in either order, and one body\'s vigil told once with its place and once with its cause is one');
  const pv = [row(11, 'Pointville residents hold a vigil every Tuesday and Friday', 'Pointville Residents Association says the vigil goes on.'), row(12, 'Weekly Pointville vigil every Tuesday and Friday', 'Harbour Watch organises it at the pier.')];
  // p71 fx5 (P3): row 11's lead names its headline's one name again, so it says more and speaks for the vigil in either order
  eq([U(pv), U(pv.slice().reverse()), U([pv[0], row(18, 'Pointville vigil goes on every Tuesday and Friday', 'Harbour Watch organises it.')])], [[[11, '2026-11-17', 'every Tuesday and Friday']], [[11, '2026-11-17', 'every Tuesday and Friday']], [[11, '2026-11-17', 'every Tuesday and Friday']]], 'one town\'s vigil under two headlines whose bodies open with different names is one, in either order');
  const heads = [['Senate vote on the gas export tax set for 3 December', 'Harbour Watch welcomes the vote.'], ['Gas export tax goes to a Senate vote on 3 December', 'Point Post understands the numbers are close.'], ['Senate to vote on the gas export tax on 3 December', 'Treasurer Jo Example says the tax is fair.'], ['Senate vote on 3 December', 'Producers lobby the crossbench.'], ['The Senate vote on the tax is on 3 December', 'Coastwire has the numbers.'], ['Senate set for 3 December vote on gas export tax', 'Seaview Neighbours plan a picnic.']];
  eq([U(heads.map((h, i) => row(20 + i, h[0], h[1]))), U(heads.slice().reverse().map((h, i) => row(40 + i, h[0], h[1])))], [[[20, '2026-12-03', 'vote']], [[40, '2026-12-03', 'vote']]], 'six headlines of one vote, their bodies opening with different names, are one entry, in either order');
  eq([U([row(30, 'Weekly vigil every Tuesday and Friday', 'Seaview residents gather at the pier.'), row(31, 'Pointville residents hold a vigil every Tuesday and Friday.')]).map(u => u[0]), U([row(32, 'The Senate vote on the levy is set for 3 December.'), row(33, 'The Assembly vote on the levy is set for 3 December.'), row(34, 'Abel Hill residents hold a vigil every Friday.'), row(35, 'Abel Bay residents hold a vigil every Friday.')]).map(u => u[0]).sort((a, b) => a - b)], [[30, 31], [32, 33, 34, 35]], 'a headline that names no one is still placed by its body\'s lead (A9), and two houses or two towns stay two');
});

await S.t('CK34 a day led by its weekday before a clause that opens with a name, and a month in capitals, are not figures (third review E8)', async () => {
  const w = await mk(); const T = w.mod.__test;
  const ids = new Map([['M:4', { k: 'media', label: 'Harbourwire - The sitting', url: 'https://harbourwire.example.com.au/sitting', line: 'Harbourwire | 16 nov 08:10 | Parliament sits on Friday 20 November and the vote is on Tuesday 17 November; 12 MPs signed the letter, 18 Labor senators crossed the floor and 12 Greens voted no' }]]);
  eq(figs(T.denCleanText('On Friday 20 Parliament sits [M:4]. The vote is on Tuesday 17 NOVEMBER [M:4]. On Tuesday 17 AEP will speak [M:4]. On Monday 23 Harbour Watch said the vote was close [M:4]. On Tuesday 12 MPs signed the letter [M:4]. On Friday 18 Labor senators crossed the floor [M:4].', ids)), [], 'a day before a clause that opens with a name, and a month in capitals, are a date; the right counts hold');
  eq(figs(T.denCleanText('On Tuesday 19 MPs signed the letter [M:4]. On Tuesday 19 MPs will vote [M:4]. On Friday 21 Labor senators crossed the floor [M:4]. On Monday 13 Greens voted no [M:4].', ids)), [['19'], ['19'], ['21'], ['13']], 'a count after a weekday (a plural name, or a name with its noun) is still a figure');
});

await S.t('CK35 the media and social headers give each count its word, and a sentence restating one holds (third review E9)', async () => {
  const w = await mk(); const calls = stub(w, (ev, m) => ({ summary: 'After folding syndicated copies, ' + (ev.match(/^TRADITIONAL MEDIA \(\d+ stories, (\d+)/m) || [])[1] + ' stories remained ' + m + '.' }));
  const seed = await F(w, 'POST', '/archive/add', { kind: 'news', rows: [story('harbourwire', 'Harbour levy divides the Senate over the gas export tax', 'https://harbourwire.example.com.au/e9a'), story('coastwire', 'Harbour levy divides the Senate over the gas export tax', 'https://coastwire.example.com.au/e9a'), story('harbourwire', 'Producers answer the gas export tax in a letter', 'https://harbourwire.example.com.au/e9b'), story('harbourwire', 'Campaigners welcome the gas export tax at the Point office', 'https://harbourwire.example.com.au/e9c')] }); eq(seed.status, 200, seed.text.slice(0, 200));
  const r = await F(w, 'POST', '/den/brief', { desk: 'aep_au' }); eq(r.status, 200, r.text.slice(0, 200)); const ev = calls[0].messages[0].content; const br = r.body.brief;
  eq([(ev.match(/^TRADITIONAL MEDIA \([^\n]*$/m) || [''])[0], (ev.match(/^SOCIAL \([^\n]*$/m) || [''])[0]], ['TRADITIONAL MEDIA (4 stories, 3 stories after folding syndicated copies; 3 stories shown, the most relevant first)', 'SOCIAL (0 posts; 0 posts shown, the most relevant first; authors are not recorded and must not be guessed)'], 'every count with its word');
  ok(/^After folding syndicated copies, 3 stories remained/.test(br.sections.summary.text), br.sections.summary.text); eq(br.sections.summary.unverified, [], 'a restated count holds by the word it shares');
});

// ---- p71 fx5: the table every reviewer's sentence is held to, and the fifth round's problems (ids in the titles) ----
// The rounds: r1 is 3b71160 (round one merged), r2 2ca1637 (round two), r3 ecb2292 (round three), r5 312cfb6 (round five,
// which built this table; the rows named S1-S6 are the sixth round's, each failing on r5 but those the problem says hold),
// r6 9c48552 (round six; the rows named T1-T6 are the seventh round's, each failing on r6).
// Where they gave different results, the last column says which is kept and why. The upcoming dates follow two rules: keep an
// event rather than drop it
// (rule 1: a real event lost is worse than an ended one shown), and keep two entries apart rather than fold two events into
// one (rule 2: a split is milder than a wrong fold); a schedule told as ended beyond doubt, or a day told as begun, loses no
// real event, so neither rule keeps it. A figure: a correct restatement holds, and a figure its line does not carry is
// flagged. Every name is invented. Told on Monday 16 November 2026.
const UP_TOWNS = ['Pointville', 'Seaview', 'Gullhaven', 'Reefton', 'Coralbay', 'Tidewater', 'Kelpford', 'Shellcove'];
// [id, a sentence (one story) or stories [id, title, body], expected ("date what" or "story date what": a standing entry's
// schedule or a dated entry's event), why (where the rounds differ)]
const UPT = [
  ['CK3 towns', UP_TOWNS.map((t, i) => [10 + i, t + ' residents hold a vigil every Tuesday and Friday over the gas export tax.']).concat([[30, 'Senate vote on the gas export tax set for 3 December']]), UP_TOWNS.map((t, i) => (10 + i) + ' 2026-11-17 every Tuesday and Friday').concat(['30 2026-12-03 vote'])],
  ['CK4 start', 'Weekly vigils on Fridays, starting 4 December.', ['2026-12-04 on Fridays']],
  ['CK4 from', 'A vigil every Friday from 4 December.', ['2026-12-04 vigil']],
  ['CK4 ended', 'The vigil, held every Tuesday since March, ended last week.', []],
  ['CK4 until', 'A vigil every Tuesday until 10 November.', []],
  ['CK4 2024', 'Locals held a vigil every Friday in 2024.', []],
  ['CK4 range', 'A picket runs Mondays to Fridays.', ['2026-11-16 Mondays to Fridays']],
  ['CK4 range2', 'A picket every Monday to Friday.', ['2026-11-16 every Monday to Friday']],
  ['A7 since', 'Residents have held a vigil every Friday since last year.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: it runs on'],
  ['A7 vow', 'Residents hold a vigil every Friday until the gas export tax is scrapped.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: a vow runs on'],
  ['A7 vow2', 'They protest every Tuesday and Friday until the mine is stopped.', ['2026-11-17 every Tuesday and Friday'], 'r1 dropped it; rule 1: a vow runs on'],
  ['A7 vow3', 'The vigil runs every Friday until the project is abandoned.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: a vow runs on'],
  ['A7 vow4', 'A rally is held every Saturday until the final Senate vote.', ['2026-11-21 every Saturday'], 'r1 dropped it; rule 1: a vow runs on'],
  ['A7 goes on', 'The vigil every Friday, which began in 2024, goes on.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: it runs on'],
  ['A7 arrested', 'Protesters arrested in 2025 hold a vigil every Tuesday outside the depot.', ['2026-11-17 every Tuesday'], 'r1 dropped it; rule 1: told in the present'],
  ['A7 June', 'Residents will hold a vigil every Friday until 30 June.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: next June'],
  ['A7 March', 'A vigil has been held every Friday from 4 March.', ['2026-11-20 every Friday'], 'r1 started it next March; a start told as begun has passed, so it runs now'],
  ['A8', Array.from({ length: 16 }, (_, i) => [60 + i, 'The Senate vote on the gas export tax is set for 3 December.']).concat([[90, 'Pointville residents hold a vigil every Tuesday and Friday.']]), ['90 2026-11-17 every Tuesday and Friday', '60 2026-12-03 vote']],
  ['A9', [[30, 'Weekly vigil every Tuesday and Friday', 'Seaview residents gather at the pier.'], [31, 'Pointville residents hold a vigil every Tuesday and Friday.']], ['30 2026-11-17 every Tuesday and Friday', '31 2026-11-17 every Tuesday and Friday'], 'r1 folded Seaview into Pointville; rule 2'],
  ['A9 turned', [[31, 'Pointville residents hold a vigil every Tuesday and Friday.'], [30, 'Weekly vigil every Tuesday and Friday', 'Seaview residents gather at the pier.']], ['31 2026-11-17 every Tuesday and Friday', '30 2026-11-17 every Tuesday and Friday'], 'r1 folded them; rule 2'],
  ['E2 a', 'Consultation began on 1 October and closes on 30 January.', ['2027-01-30 consultation'], 'r2 dropped it; rule 1'],
  ['E2 b', 'The inquiry began in September; submissions close on 15 January.', ['2027-01-15 submissions'], 'r2 dropped it; rule 1 (P1: named by the action nearest its day)'],
  ['E2 c', 'The campaign, which started last month, plans a rally on 10 January.', ['2027-01-10 rally'], 'r2 dropped it; rule 1'],
  ['E2 d', 'The group has held rallies since 2019 and plans a rally on 4 March.', ['2027-03-04 rally'], 'r2 dropped it; rule 1 (P1: the action nearest its day)'],
  ['E2 due', 'The inquiry began in September and the final report is due on 15 January.', ['2027-01-15 inquiry'], 'r2 dropped it; rule 1'],
  ['E2 opened', 'Consultation opened on 1 October and will close on 30 January.', ['2027-01-30 consultation']],
  ['E2 planned', 'The campaign began in September with a rally planned for 10 January.', ['2027-01-10 rally']],
  ['E2 which', 'Submissions, which opened on 1 October, close on 30 January.', ['2027-01-30 submissions']],
  ['E2 begun', 'Consultation began on 1 October.', []],
  ['E2 since', 'Protests have continued since 4 March.', [], 'r1 and r2 gave next March; "since" dates a start that has passed: no real event is lost'],
  ['E2 is held', 'The rally is held on 4 March.', ['2027-03-04 rally']],
  ['E2 set', 'The vote has been set for 4 March.', ['2027-03-04 vote']],
  ['E2 again', 'The rally, which began on 4 March, will be held again on 10 January.', ['2027-01-10 rally'], 'r1 and r2 also gave next March; the rally began on 4 March'],
  ['E2 drew', 'The rally on 4 March drew 2,000 people.', ['2027-03-04 rally']],
  ['E2 was held', 'A rally was held on 4 March.', ['2027-03-04 rally']],
  ['E2 rallied', 'Protesters rallied on 4 March and will rally again on 10 January.', ['2027-01-10 rally', '2027-03-04 rally'], 'r1 named it "march" (the month); every round keeps the plain past (rule 1)'],
  ['E2 hears', 'The inquiry, which started on 3 March, hears evidence on 15 January.', ['2027-01-15 inquiry'], 'r1 also gave next March, r2 nothing; it started on 3 March; rule 1 for January'],
  ['E3 ended', 'Locals held a vigil every Friday until the campaign ended.', [], 'r2 ran it on; ended beyond doubt'],
  ['E3 scrapped', 'Residents held a vigil every Friday until the government scrapped the tax.', [], 'r2 ran it on; ended beyond doubt'],
  ['E3 vote ended', 'Rallies every Saturday until the final vote ended in March.', [], 'r2 ran it on; ended beyond doubt'],
  ['E3 will', 'Protesters held a vigil every Friday until 10 November and say they will return.', [], 'r2 ran it on; its end passed'],
  ['E3 who will', 'Residents, who will meet the minister, held a vigil every Friday until 10 November.', [], 'r2 ran it on; its end passed'],
  ['E3 would', 'Every Friday in 2025, locals would hold a vigil.', [], 'r2 ran it on; a habit of a past year told in the past'],
  ['E3 reversed', 'Residents hold a vigil every Friday until the decision is reversed.', ['2026-11-20 every Friday']],
  ['E3 reverses', 'Residents hold a vigil every Friday until the government reverses the decision.', ['2026-11-20 every Friday']],
  ['E3 backs down', 'Residents hold a vigil every Friday until the minister, who approved the mine, backs down.', ['2026-11-20 every Friday']],
  ['E3 passes', 'Residents hold a vigil every Friday until the bill passes.', ['2026-11-20 every Friday']],
  ['E3 introduced', 'Residents will hold a vigil every Friday until the levy introduced in July is repealed.', ['2026-11-20 every Friday']],
  ['E3 delayed', 'Residents hold a vigil every Friday until the vote, delayed twice, is held.', ['2026-11-20 every Friday']],
  ['E3 granted', 'Protesters hold a vigil every Friday until the approval granted in March is overturned.', ['2026-11-20 every Friday']],
  ['E3 from until', 'Residents hold a vigil every Friday from 4 October until 30 June.', ['2026-11-20 every Friday'], 'every round gave nothing; rule 1: an end before its own start, told in the present, is next June'],
  ['E3 since 2024', 'Since 2024, locals have held a vigil every Friday.', ['2026-11-20 every Friday']],
  ['E3 approved 2025', 'The council approved the mine in 2025, and locals hold a vigil every Friday.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: told in the present'],
  ['E3 rallied 2025', 'Locals have rallied every Saturday against the 2025 decision.', ['2026-11-21 every Saturday'], 'r1 dropped it; rule 1'],
  ['E3 will from', 'Residents will hold a vigil every Friday from 4 March.', ['2027-03-04 vigil', '2027-03-05 every Friday']],
  ['E3 until March', 'Residents hold a vigil every Friday until 4 March.', ['2026-11-20 every Friday', '2027-03-04 vigil']],
  ['E3 return', 'Residents, who held a vigil every Friday until 10 November, say they will return on 4 December.', ['2026-12-04 vigil'], 'r2 ran the old vigil on too; it ended on 10 November, and the return is kept'],
  ['E3 still', 'Locals held a vigil every Friday in 2024 and still do.', ['2026-11-20 every Friday']],
  ['E3 struck', 'Residents hold a vigil every Friday until the gas tax deal struck last week is scrapped.', ['2026-11-20 every Friday'], 'r1 dropped it; rule 1: a vow'],
  ['E3 backed down', 'Residents held a vigil every Friday until the minister backed down.', [], 'r1 and r2 ran it on; an end told in the past (E3)'],
  ['E3 withdrew', 'Residents held a vigil every Friday until the company withdrew its application.', [], 'r1 and r2 ran it on; an end told in the past (E3)'],
  ['E3 was held', 'The vigil was held every Friday until 4 March.', [], 'r1 and r2 ran it on and every round gave a vigil next March; an end told in the past has passed'],
  ['E3 rallied', 'Locals rallied every Saturday in 2025.', []],
  ['E3 vote in March', 'Residents held a vigil every Friday until the vote in March.', ['2026-11-20 every Friday']],
  ['E6 vote', [[1, 'A vote on the levy is set for 3 December.'], [2, 'A vote on the mine approval is set for 3 December.']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r2 folded them; rule 2'],
  ['E6 rally', [[3, 'Farmers plan a rally on 21 November.'], [4, 'A rally on 21 November will oppose the mine.']], ['3 2026-11-21 rally', '4 2026-11-21 rally'], 'r2 folded them; rule 2'],
  ['E6 bill', [[1, 'The Senate vote on the gas export tax is set for 3 December.'], [2, 'The Senate vote on the gas tax bill is set for 3 December.']], ['1 2026-12-03 vote'], 'r1 and r3 split one vote; they share what it is about and name nothing else (P4)'],
  ['E6 cause', [[1, 'Harbour Watch holds a vigil every Friday.'], [2, 'A vigil every Friday over the levy.']], ['1 2026-11-20 every Friday', '2 2026-11-20 every Friday'], 'r1 and r2 folded them; rule 2: who and why share nothing, as E6\'s rallies'],
  ['E6 cause2', [[1, 'Residents rally every Saturday against the mine.'], [2, 'Residents rally every Saturday against the levy.']], ['1 2026-11-21 every Saturday', '2 2026-11-21 every Saturday'], 'r1 and r2 folded them; rule 2'],
  ['E6 one town', [[1, 'Pointville residents rally every Saturday against the mine.'], [2, 'Pointville residents rally every Saturday outside the council.']], ['1 2026-11-21 every Saturday']],
  ['E7 Pointville', [[11, 'Pointville residents hold a vigil every Tuesday and Friday', 'Pointville Residents Association says the vigil goes on.'], [12, 'Weekly Pointville vigil every Tuesday and Friday', 'Harbour Watch organises it at the pier.']], ['11 2026-11-17 every Tuesday and Friday'], 'r2 split one town\'s vigil; nothing names another'],
  ['E7 six', [[20, 'Senate vote on the gas export tax set for 3 December', 'Harbour Watch welcomes the vote.'], [21, 'Gas export tax goes to a Senate vote on 3 December', 'Point Post understands the numbers are close.'], [22, 'Senate to vote on the gas export tax on 3 December', 'Treasurer Jo Example says the tax is fair.'], [23, 'Senate vote on 3 December', 'Producers lobby the crossbench.'], [24, 'The Senate vote on the tax is on 3 December', 'Coastwire has the numbers.'], [25, 'Senate set for 3 December vote on gas export tax', 'Seaview Neighbours plan a picnic.']], ['20 2026-12-03 vote'], 'r1 and r2 split one vote six ways; a lead that names who spoke of it places nothing'],
  ['E7 rallying', [[42, 'Unions rally every Saturday', 'Seaview unions meet at the wharf.'], [43, 'Unions keep rallying every Saturday', 'Pointville unions meet at the depot.']], ['42 2026-11-21 every Saturday']],   // "rallying" is no action word the reader knows: 43 gives no entry, nothing is folded
  ['E7 residents', [[1, 'Residents hold a vigil every Friday', 'Seaview residents gather at the wharf.'], [2, 'Residents keep a vigil every Friday', 'Pointville residents gather at the wharf.']], ['1 2026-11-20 every Friday', '2 2026-11-20 every Friday'], 'r1 folded two towns; rule 2'],
  ['P1 hearing', 'Consultation began on 1 October, with a final hearing on 2 February.', ['2027-02-02 hearing'], 'r2 and r3 dropped it; rule 1'],
  ['P1 petition', 'The group started a petition last month ahead of a rally on 10 January.', ['2027-01-10 rally'], 'r2 and r3 dropped it; rule 1'],
  ['P1 since 2019', 'Protesters have held rallies since 2019 ahead of the vote on 4 March.', ['2027-03-04 vote'], 'r2 and r3 dropped it; rule 1'],
  ['P1 resume', 'Hearings began on 3 March and resume on 2 February.', ['2027-02-02 hearings'], 'r2 and r3 dropped it (rule 1); r1 also gave next March, which began on 3 March'],
  ['P1 follows', 'The strike began last week and a rally follows on 10 January.', ['2027-01-10 rally'], 'r2 and r3 dropped it; rule 1; r1 named it a strike'],
  ['P1 launched', 'The group launched its campaign in October, with a rally on 10 January.', ['2027-01-10 rally'], 'r3 dropped it; rule 1'],
  ['P1 kicked off', 'The campaign kicked off in October and culminates in a rally on 10 January.', ['2027-01-10 rally'], 'r3 dropped it; rule 1'],
  ['P2 announced', 'Residents hold a vigil every Friday until the levy, announced in May, is scrapped.', ['2026-11-20 every Friday'], 'r1 and r3 ended a vow; rule 1'],
  ['P2 approved', 'Residents hold a vigil every Friday until the mine approved last year is stopped.', ['2026-11-20 every Friday'], 'r1 and r3 ended a vow; rule 1'],
  ['P2 signed', 'Residents hold a vigil every Friday until the deal signed in May is torn up.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 on Friday', 'Residents hold a vigil every Friday until the decision announced on Friday is reversed.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 passed', 'Residents hold a vigil every Friday until the tax passed in June is repealed.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 commas', 'Locals rally every Saturday until the mine, approved in March, is stopped.', ['2026-11-21 every Saturday'], 'r1 and r3 ended a vow; rule 1'],
  ['P2 who', 'Residents hold a vigil every Friday until the minister who approved the mine resigns.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 or', 'Residents hold a vigil every Friday until the mine is approved or rejected.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 or2', 'Residents hold a vigil every Friday until the tax is dropped or reversed.', ['2026-11-20 every Friday'], 'r3 ended a vow; rule 1'],
  ['P2 vow', 'Residents vow to hold a vigil every Friday until the project announced in the budget is cancelled.', ['2026-11-20 every Friday'], 'r1 and r3 ended a vow; rule 1'],
  ['P2 made', 'Residents hold a vigil every Friday until the council reverses a decision it made in March.', ['2026-11-20 every Friday']],
  ['P2 withdrawn', 'Residents hold a vigil every Friday until the levy is withdrawn.', ['2026-11-20 every Friday']],
  ['P2 demands', 'Residents hold a vigil every Friday until their demands are met or the mine is dropped.', ['2026-11-20 every Friday']],
  ['P3 farmers', [[40, 'Farmers hold a vigil every Friday', 'Seaview farmers gather at the pier.'], [41, 'Farmers keep up a vigil every Friday', 'Pointville farmers gather at the depot.']], ['40 2026-11-20 every Friday', '41 2026-11-20 every Friday'], 'r1 and r3 folded two towns; rule 2'],
  ['P3 fishers', [[1, 'Fishers hold a vigil every Friday', 'Seaview fishers gather at the wharf.'], [2, 'Fishers keep a vigil every Friday', 'Pointville fishers gather at the wharf.']], ['1 2026-11-20 every Friday', '2 2026-11-20 every Friday'], 'r1 and r3 folded two towns; rule 2'],
  ['P3 climate', [[1, 'Climate protesters hold a vigil every Friday', 'Seaview campaigners gather at the pier.'], [2, 'Climate vigil every Friday draws a crowd', 'Pointville campaigners gather at the depot.']], ['1 2026-11-20 every Friday', '2 2026-11-20 every Friday'], 'r1 and r3 folded two towns; rule 2'],
  ['P3 mothers', [[44, 'Mothers hold a vigil every Friday against the mine', 'The Seaview group meets at the pier.'], [45, 'Mothers keep a vigil every Friday against the mine', 'The Pointville group meets at the depot.']], ['44 2026-11-20 every Friday', '45 2026-11-20 every Friday'], 'r1 and r3 folded two towns; rule 2'],
  ['P3 families', [[1, 'Families rally on 21 November against the levy', 'Seaview families will meet at the pier.'], [2, 'Families to rally on 21 November against the levy', 'Pointville families will meet at the depot.']], ['1 2026-11-21 rally', '2 2026-11-21 rally'], 'r3 folded two towns; rule 2'],
  ['P3 farmers dated', [[46, 'Farmers rally on 21 November', 'Seaview farmers will meet at the pier.'], [47, 'Farmers to rally on 21 November', 'Pointville farmers will meet at the depot.']], ['46 2026-11-21 rally', '47 2026-11-21 rally'], 'r3 folded two towns; rule 2'],
  ['P4 six ways', [[1, 'The Senate will vote on the gas export tax on 3 December.'], [2, 'The Senate vote on the gas export tax is set for 3 December.'], [3, 'Senators vote on the export tax on 3 December.'], [4, 'The Senate votes on the gas tax on 3 December.'], [5, 'A Senate vote over the gas export levy is due on 3 December.'], [6, 'The Senate is set to vote on the tax bill on 3 December.']], ['1 2026-12-03 vote', '3 2026-12-03 vote'], 'r1 gave five, r3 four; one vote, though "Senators" stays apart from "the Senate" (rule 2), as r2 had it'],
  ['P4 turned', [[6, 'The Senate is set to vote on the tax bill on 3 December.'], [5, 'A Senate vote over the gas export levy is due on 3 December.'], [4, 'The Senate votes on the gas tax on 3 December.'], [3, 'Senators vote on the export tax on 3 December.'], [2, 'The Senate vote on the gas export tax is set for 3 December.'], [1, 'The Senate will vote on the gas export tax on 3 December.']], ['2 2026-12-03 vote', '3 2026-12-03 vote'], 'r1 gave five, r3 four; the same two in the other order, the fullest telling speaking (fx7, T2: the levy is the tax only beside a phrase whose other words all match, so 5, read before "the gas export tax", joins the vote when the entries merge and 2, as full, speaks, as in r5; r6 had 5 speak)'],
  ['P4 o1', [[1, 'A Senate vote on the tax is set for 3 December.'], [2, 'A Senate vote on the gas tax is set for 3 December.'], [3, 'A Senate vote on the export tax is set for 3 December.']], ['2 2026-12-03 vote'], 'r1 gave three, r3 two; one vote'],
  ['P4 o2', [[1, 'A Senate vote on the tax is set for 3 December.'], [3, 'A Senate vote on the export tax is set for 3 December.'], [2, 'A Senate vote on the gas tax is set for 3 December.']], ['3 2026-12-03 vote'], 'r1 gave three, r3 two; one vote'],
  ['P4 place', [[1, 'Harbour Watch holds a vigil every Friday.'], [2, 'A vigil every Friday at the pier.']], ['1 2026-11-20 every Friday'], 'r3 split it; a telling that says only where is the vigil of one that gives no place'],
  ['P4 place turned', [[2, 'A vigil every Friday at the pier.'], [1, 'Harbour Watch holds a vigil every Friday.']], ['1 2026-11-20 every Friday'], 'r3 split it; one vigil in either order'],
  // the sixth round (fx6): S1, a one-off day after until told in the past (postponed, extended) is still to come
  ['S1 delayed', 'The Senate vote on the gas export tax was delayed until 4 February.', ['2027-02-04 vote'], 'r5 dropped it (r1-r3 kept it); rule 1: a postponed event is still to come'],
  ['S1 adjourned', 'The hearing was adjourned until 3 February.', ['2027-02-03 hearing'], 'r5 dropped it; rule 1'],
  ['S1 extended', 'Consultation on the levy was extended until 4 March.', ['2027-03-04 consultation'], 'r5 dropped it; rule 1'],
  ['S1 were extended', 'Submissions to the inquiry were extended until 30 January.', ['2027-01-30 submissions'], 'r5 dropped it; rule 1'],
  ['S1 deferred', 'The decision was deferred until 10 February.', ['2027-02-10 decision'], 'r5 dropped it; rule 1'],
  ['S1 postponed', 'The debate was postponed until 2 February.', ['2027-02-02 debate'], 'r5 dropped it; rule 1'],
  ['S1 pushed back', 'The vote was pushed back until 9 February, the Senate said.', ['2027-02-09 vote'], 'r5 dropped it; rule 1'],
  ['S1 has been', 'The Senate vote has been delayed until 4 February.', ['2027-02-04 vote']],
  // S2, a begun verb governs its day across where, when or how and its own object: the day has passed
  ['S2 in', 'Hearings began in Pointville on 3 March.', [], 'r1 and r5 gave next March; begun on 3 March, no real event is lost'],
  ['S2 at', 'The strike started at the port on 4 March.', [], 'r1 and r5 gave next March; begun'],
  ['S2 which', 'The blockade, which began at the depot on 4 March, continues.', [], 'r1 and r5 gave next March; begun'],
  ['S2 again', 'Protests began again on 4 March.', [], 'r1 and r5 gave next March; begun'],
  ['S2 early', 'The blockade began early on 4 March.', [], 'r1 and r5 gave next March; begun'],
  ['S2 object', 'The inquiry opened public hearings in Seaview on 3 March.', [], 'r1 and r5 gave next March; the hearings are the verb\'s own object, begun'],
  ['S2 by', 'The petition was launched by Harbour Watch on 4 March.', [], 'r1 and r5 gave next March; begun'],
  // S3, a dated entry is named by the action before its day in its own clause
  ['S3 despite', 'Unions confirmed the strike will go ahead on 3 December despite a vote against it.', ['2026-12-03 strike'], 'r5 named it a vote, written after the day'],
  ['S3 despite2', 'The strike will go ahead on 3 December, despite a vote by members.', ['2026-12-03 strike'], 'r5 named it a vote'],
  ['S3 to the', 'Submissions to the inquiry close on 15 January.', ['2027-01-15 submissions'], 'r5 named it the inquiry, what the submissions are to'],
  // S4, an appositive or a which, who or that clause after until is not the until clause's own: an end told in the past
  ['S4 appositive', 'Locals held a vigil every Friday until the council approved the mine, a decision they say is unlawful.', [], 'r5 ran it on; ended beyond doubt'],
  ['S4 appositive2', 'Residents held a vigil every Friday until the tax was scrapped, a decision that is still contested.', [], 'r5 ran it on; ended beyond doubt'],
  ['S4 who is', 'Residents held a vigil every Friday until the minister who is responsible for the mine resigned.', [], 'r5 ran it on; ended beyond doubt'],
  ['S4 which is', 'Residents held a vigil every Friday until the mine was approved, which is why they are now going to court.', [], 'r5 ran it on; ended beyond doubt'],
  ['S4 that is', 'Locals held a vigil every Friday until the company that is building the mine withdrew.', [], 'r5 ran it on; ended beyond doubt'],
  // S5, two measures that share a word, or one narrowed two ways of the same kind, are two events
  ['S5 scheme', [[1, 'Senate to vote on gas export tax on 3 December'], [2, 'Senate to vote on gas reservation scheme on 3 December']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r5 folded them on "gas"; rule 2: a tax is not a reservation scheme'],
  ['S5 scheme turned', [[2, 'Senate to vote on gas reservation scheme on 3 December'], [1, 'Senate to vote on gas export tax on 3 December']], ['2 2026-12-03 vote', '1 2026-12-03 vote'], 'r5 folded them; rule 2, in either order'],
  ['S5 pipeline', [[1, 'Farmers rally against the gas pipeline on 21 November.'], [2, 'Residents rally against the gas tax on 21 November.']], ['1 2026-11-21 rally', '2 2026-11-21 rally'], 'r5 folded them on "gas"; rule 2'],
  ['S5 approval', [[1, 'A Senate vote on the mine levy is set for 3 December.'], [2, 'A Senate vote on the mine approval is set for 3 December.']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r5 folded them on "mine"; rule 2'],
  ['S5 reserve', [[1, 'A rally against the critical minerals reserve on 21 November.'], [2, 'A rally against the critical minerals tax on 21 November.']], ['1 2026-11-21 rally', '2 2026-11-21 rally'], 'r5 folded them on "critical minerals"; rule 2'],
  ['S5 coal gold', [[1, 'Residents rally every Saturday against the coal mine.'], [2, 'Residents rally every Saturday against the gold mine.']], ['1 2026-11-21 every Saturday', '2 2026-11-21 every Saturday'], 'r5 folded them on "mine"; rule 2: a coal mine is not a gold mine'],
  ['S5 coal gold turned', [[2, 'Residents rally every Saturday against the gold mine.'], [1, 'Residents rally every Saturday against the coal mine.']], ['2 2026-11-21 every Saturday', '1 2026-11-21 every Saturday'], 'r5 folded them; rule 2, in either order'],
  ['S5 carbon', [[1, 'A Senate vote on the gas tax is set for 3 December.'], [2, 'A Senate vote on the carbon tax is set for 3 December.']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r5 folded them on "tax" (the case its lane disclosed); rule 2'],
  // the seventh round (fx7): T1, a begun verb governs a later day only within its own stretch of words
  ['T1 resuming', 'Hearings began in Seaview last month, resuming in Pointville on 3 February.', ['2027-02-03 hearings'], 'r6 dropped it (r5 kept it); rule 1: a begun verb never governs past a comma or an -ing word'],
  ['T1 debate', 'Debate on the gas tax bill began on Tuesday, resuming on 3 February.', ['2027-02-03 debate'], 'r6 dropped it; rule 1'],
  ['T1 returning', 'The Senate inquiry began public hearings in Seaview on Monday, returning to Pointville on 3 February.', ['2027-02-03 hearings'], 'r6 dropped it; rule 1'],
  ['T1 reporting', 'The inquiry into the gas tax began last month, reporting to the Senate on 3 March.', ['2027-03-03 inquiry'], 'r6 dropped it; rule 1'],
  ['T1 forum', 'Registrations opened today for the 4 March forum on the gas tax.', ['2027-03-04 forum'], 'r6 dropped it; rule 1: a day that modifies a noun is never a begun verb\'s'],
  ['T1 through to', 'The committee opened submissions on Monday through to 4 March.', ['2027-03-04 submissions'], 'r6 dropped it; rule 1: "through to" ends the begun verb\'s stretch'],
  ['T1 to', 'Consultation on the gas reservation scheme opened on Monday, to 4 March.', ['2027-03-04 consultation'], 'r6 dropped it; rule 1'],
  ['T1 deadline', 'Harbour Watch launched a campaign on Monday for the 3 February deadline.', ['2027-02-03 deadline'], 'r6 dropped it; rule 1: a day that modifies a noun'],
  // T2, a levy is that tax only when every other word of the two phrases matches
  ['T2 mining', [[1, 'A Senate vote on the mining levy is set for 3 December.'], [2, 'A Senate vote on the gas tax is set for 3 December.']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r6 folded them (r5 kept them apart); rule 2: the mining levy is not the gas tax'],
  ['T2 mine', [[1, 'A rally against the mine levy on 21 November.'], [2, 'A rally against the gas tax on 21 November.']], ['1 2026-11-21 rally', '2 2026-11-21 rally'], 'r6 folded them; rule 2'],
  ['T2 emergency', [[1, 'A rally against the emergency services levy on 21 November.'], [2, 'A rally against the gas tax on 21 November.']], ['1 2026-11-21 rally', '2 2026-11-21 rally'], 'r6 folded them; rule 2'],
  ['T2 payroll', [[1, 'Parliament to vote on payroll tax changes on 3 December'], [2, 'Parliament to vote on gas levy on 3 December']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r6 folded them; rule 2'],
  ['T2 export', [[1, 'Senate to vote on export levy on 3 December'], [2, 'Senate to vote on carbon tax on 3 December']], ['1 2026-12-03 vote', '2 2026-12-03 vote'], 'r6 folded them; rule 2'],
  // T3, a hike, rise, increase or cut after the measure's noun is no measure's head
  ['T3 hike', [[1, 'A Senate vote on the gas tax hike is set for 3 December.'], [2, 'A Senate vote on the gas export tax is set for 3 December.']], ['1 2026-12-03 vote'], 'r6 split one vote (r5 folded it); a hike is a word any measure has'],
  ['T3 hike export', [[1, 'A Senate vote on the gas tax hike is set for 3 December.'], [2, 'A Senate vote on the export tax is set for 3 December.']], ['1 2026-12-03 vote'], 'r6 split one vote'],
  ['T3 rise', [[1, 'Miners rally against the royalty rise on 21 November.'], [2, 'Miners rally against the coal royalty on 21 November.']], ['1 2026-11-21 rally'], 'r6 split one rally'],
  // T4, after until only a postponement verb gives the next such day; any other past or begun verb ends the event
  ['T4 lasted', 'The blockade lasted until 4 March.', [], 'r6 gave next March (r5 nothing); an end told in the past has passed'],
  ['T4 ran', 'The blockade of the port ran from 20 February until 4 March.', [], 'r6 gave next March; ended'],
  ['T4 continued', 'The strike continued until 4 March.', [], 'r6 gave next March; ended'],
  ['T4 were held', 'Hearings were held in Seaview until 3 March.', [], 'r6 gave next March; ended'],
  ['T4 went on', 'The strike went on until 4 March, when the union accepted the offer.', [], 'r6 gave next March; ended'],
  ['T4 was open', 'Consultation on the levy was open until 4 March.', [], 'r6 gave next March; ended'],
  // T5, an appositive closed by a second comma is dropped from the until clause, as a who or which clause is
  ['T5 miner', 'Locals held a vigil every Friday until the minister, a former miner, resigned.', [], 'r6 ran it on (r5 ended it); ended beyond doubt'],
  ['T5 producer', 'Residents held a vigil every Friday until the company, the state\'s largest gas producer, withdrew its application.', [], 'r6 ran it on; ended beyond doubt'],
  ['T5 decade', 'Locals held a vigil every Friday until the approval, the first for a gas project in a decade, was overturned.', [], 'r6 ran it on; ended beyond doubt'],
  // the integration after the round-7 review: the other ways a vote or hearing is reported as moved (r7 lost each), and a vow
  // whose until clause has a present-tense verb before an aside left open (r7 ended each)
  ['U1 put off', 'The Senate vote on the gas tax was put off until 3 February.', ['2027-02-03 vote'], 'r7 dropped it (r6 kept it); rule 1: a postponed event is still to come'],
  ['U1 suspended', 'Debate on the gas tax bill was suspended until 3 February.', ['2027-02-03 debate'], 'r7 dropped it; rule 1'],
  ['U1 held over', 'The hearing was held over until 3 February.', ['2027-02-03 hearing'], 'r7 dropped it; rule 1'],
  ['U1 put back', 'The vote was put back until 3 February.', ['2027-02-03 vote'], 'r7 dropped it; rule 1'],
  ['U1 recessed', 'The hearing was recessed until 3 February.', ['2027-02-03 hearing'], 'r7 dropped it; rule 1'],
  ['U2 levy aside', 'Residents will hold a vigil every Friday until the government scraps the levy, a tax it announced in May.', ['2026-11-20 every Friday'], 'r7 ended it (r6 kept it); rule 1: the vow runs on'],
  ['U2 project aside', 'Locals will hold a vigil every Friday until the minister rejects the mine, a project the council approved in March.', ['2026-11-20 every Friday'], 'r7 ended it; rule 1'],
  ['U2 deal aside', 'Locals will picket the gate every Monday until the state cancels the gas deal, an agreement it signed in March.', ['2026-11-16 every Monday'], 'r7 ended it; rule 1'],
  ['U2 group decided', 'Farmers will rally every Saturday until the government scraps the levy, the group decided on Sunday.', ['2026-11-21 every Saturday'], 'r7 ended it; rule 1']
];
const FIGL = (id, line) => [id, { k: id[0] === 'U' ? 'upcoming' : 'media', label: id, url: 'https://pointpost.example.com.au/' + id.slice(2), line }];
const FIGM = {
  tone: [FIGL('T:gas', 'Gas taxation: mostly negative, across 41 stories with a tone reading (syndicated copies and repeated posts counted once): 30 negative, 6 positive, 5 neutral')],
  mine: [FIGL('M:1', 'Harbourwire | 16 nov 08:10 | The mine will produce 6 million tonnes a year and the levy would raise 4 billion dollars, or $US3bn, over 8 years')],
  days: [FIGL('U:1', 'Tuesday 2026-11-17 | RECURRING (every Tuesday and Friday) | vigil | Harbour Watch holds a vigil every Tuesday and Friday at the Point office.'), FIGL('U:2', 'Friday 2026-11-20 | RECURRING (every Tuesday and Friday) | vigil | Harbour Watch holds a vigil every Tuesday and Friday at the Point office.')],
  rally: [FIGL('M:1', 'Harbourwire | 16 nov 08:10 | On Saturday, 2,000 people rallied at the pier; 12% of them were members; on Tuesday 12 MPs signed the letter; by Friday 3.5 million had watched'), FIGL('M:2', 'Harbourwire | 16 nov 08:10 | About 2,000 people rallied at the pier on Saturday')],
  counts: [FIGL('C:gastax', 'Gas taxation: 3 posts and stories in this window, 0 in the day before'), FIGL('T:gastax', 'Gas taxation: mostly negative, across 41 stories: 30 negative, 6 positive, 5 neutral'), FIGL('P:14', 'Harbour Watch (org) on x | 16 nov 09:07 | The levy is a gift to the gas lobby | 400 likes, 50 replies'), FIGL('M:1', 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions')],
  outlets: [FIGL('M:1', 'Point Post (metro) | 16 nov 08:10 | Harbour levy divides the Senate | also carried by 6 other outlets (7 outlets in all) | Facebook: 300 reactions, 40 comments, 22 shares (362 interactions in all)')],
  years: [FIGL('M:1', 'Harbourwire | 16 nov 08:10 | The mine will produce 6 million tonnes a year over 8 years under a 24-hour permit, worth $4.2bn, behind a 6m sea wall')],
  strike: [FIGL('M:2', 'Point Post | 16 nov 08:10 | Unions called a 48-hour strike over the levy, and MPs signed a letter'), FIGL('C:gastax', 'Gas taxation: 59 posts and stories in this window, 206 in the day before')],
  water: [FIGL('M:3', 'Harbourwire | 16 nov 08:10 | The 6Mtpa expansion would use 300 megalitres of water a year under a 10-yr deal, after a two-day strike and ten days of talks, beside a 40MWh battery and a 40MW solar farm')],
  blockade: [FIGL('M:1', 'Point Post | 16 nov 08:10 | The minister promised a reply within 48 hours; the blockade lasted 12 hours'), FIGL('M:6', 'Point Post | 16 nov 09:10 | The petition drew 5,000 names in 48 hours')],
  sitting: [FIGL('M:4', 'Harbourwire | 16 nov 08:10 | Parliament sits on Friday 20 November; 12 MPs signed the letter; 2,000 people marched')],
  within48: [FIGL('M:7', 'Point Post | 16 nov 08:10 | The petition drew 5,000 names within 48 hours of opening')],
  first48: [FIGL('M:7', 'Point Post | 16 nov 08:10 | The petition drew 5,000 names in its first 48 hours')],
  twodays: [FIGL('M:7', 'Point Post | 16 nov 08:10 | The petition drew 5,000 names over two days')],
  lasted12: [FIGL('M:1', 'Point Post | 16 nov 08:10 | The blockade lasted 12 hours')],
  post450: [FIGL('S:5', 'bluesky | 16 nov 08:10 | The levy is a gift to the gas lobby | 450 interactions, 12 reposts | 10 comments read')],
  story1204: [FIGL('M:1', 'Point Post | 16 nov 08:10 | Harbour levy divides the Senate | 1204 reactions')],
  outlier: [FIGL('O:5', 'A post by Harbour Watch drew 450 interactions, against a usual 6 for that account\'s posts (the middle of its last 5)')],
  twelvesame: [FIGL('S:9', 'bluesky | 12 near-identical posts from 12 accounts, 16 nov 08:10 to 14:30, 300 interactions in all: Sign the harbour pledge')]
};
const FIG_DESK = 'DESK: AEP national (AEP). REPORTING WINDOW: 16-17 November 2026, 24 hours. ISSUES: Gas taxation.';
const FIGX = { none: [], heads: [FIG_DESK, 'TRADITIONAL MEDIA (6 stories, 14 after folding syndicated copies; 10 shown of 14, the most relevant first)', 'SOCIAL (40 posts; 30 shown, the most relevant first)', '- A post by Harbour Watch drew far more than that account\'s posts usually do: 450 interactions against a usual 6.'],
  twelve: [FIG_DESK, 'CHANNELS READ IN THIS WINDOW: news (12 stories), Bluesky (30 posts).', 'TRADITIONAL MEDIA (12 stories, 12 stories after folding syndicated copies; 12 stories shown, the most relevant first)'],
  bottom: [FIG_DESK, 'TRADITIONAL MEDIA (12 stories, 12 stories after folding syndicated copies; 12 stories shown, the most relevant first)', 'THE LAST FILED BRIEF\'S BOTTOM LINE (2026-11-16, for continuity; say what changed): The levy would raise $4bn by 2041, and 73 MPs back it.'] };
// [id, sentence, lines, lines with no id, the window's hours, expected flags ("bare" when it cites nothing), why]
const FIGT = [
  ['CK7 of', 'Of the coverage, 30 of 41 were negative [T:gas].', 'tone', 'none', 0, []],
  ['CK7 out of', 'Overall 30 out of 41 were negative [T:gas].', 'tone', 'none', 0, []],
  ['CK7 of the', 'Of the 41 stories, 30 were negative [T:gas].', 'tone', 'none', 0, []],
  ['CK7 the 41', 'Of them, 30 of the 41 stories were negative [T:gas].', 'tone', 'none', 0, []],
  ['A6 its', 'Of the coverage, 30 of its 41 were negative [T:gas].', 'tone', 'none', 0, [], 'r1 flagged a correct restatement'],
  ['CK8 million', 'The mine will produce 5 million tonnes a year [M:1].', 'mine', 'none', 0, ['5 million']],
  ['CK8 billion', 'The levy would raise 7 billion dollars [M:1].', 'mine', 'none', 0, ['7 billion']],
  ['CK8 $US', 'The levy would raise $US9bn [M:1].', 'mine', 'none', 0, ['$US9bn']],
  ['CK8 deal', 'Harbour Gas signed a 15-year supply deal.', 'mine', 'none', 0, ['bare 15']],
  ['CK9 weekdays', 'The vigil is held on Tuesday 17 and Friday 20 November [U:1][U:2].', 'days', 'none', 0, []],
  ['CK9 list', 'The vigil is next held on 17, 20 and 24 November [U:1][U:2].', 'days', 'none', 0, []],
  ['CK9 numeric', 'It was listed for 17/11 [U:1].', 'days', 'none', 0, []],
  ['A1 people', 'On Saturday, 9,000 people rallied [M:1].', 'rally', 'none', 0, ['9,000'], 'r1 let a wrong figure pass'],
  ['A1 MPs', 'On Tuesday 19 MPs signed [M:1].', 'rally', 'none', 0, ['19'], 'r1 let a wrong figure pass'],
  ['A1 per cent', 'On Saturday 47% of them were members [M:1].', 'rally', 'none', 0, ['47%'], 'r1 let a wrong figure pass'],
  ['A1 million', 'By Friday 8.5 million had watched [M:1].', 'rally', 'none', 0, ['8.5 million'], 'r1 let a wrong figure pass'],
  ['A1 right', 'On Saturday, 2,000 people rallied [M:2].', 'rally', 'none', 0, [], 'r1 flagged a stray "000"'],
  ['A1 uncited', 'On Saturday, 2,000 people rallied.', 'rally', 'none', 0, []],
  ['A2 posts', 'Gas taxation drew 24 posts and stories in this window [C:gastax].', 'counts', 'heads', 24, ['24 posts'], 'r1 let the desk line clear it'],
  ['A2 comments', 'The lead story drew 24 comments [M:1].', 'counts', 'heads', 24, ['24 comments'], 'r1 let the desk line clear it'],
  ['A2 negative', 'Of them, 24 were negative [T:gastax].', 'counts', 'heads', 24, ['24 were negative'], 'r1 let the desk line clear it'],
  ['A2 likes', 'It drew 30 likes [P:14].', 'counts', 'heads', 24, ['30 likes'], 'r1 let a header clear it'],
  ['A2 replies', 'It drew 40 replies [P:14].', 'counts', 'heads', 24, ['40 replies'], 'r1 let a header clear it'],
  ['A2 14', 'It drew 14 comments [M:1].', 'counts', 'heads', 24, ['14 comments'], 'r1 let a header clear it'],
  ['A2 press', 'The press ran 30 stories in the window.', 'counts', 'heads', 24, ['bare 30 stories'], 'r1 let a header clear it'],
  ['A2 outlier', 'Harbour Watch\'s post drew 450 interactions, against a usual 6 [P:14].', 'counts', 'heads', 24, []],
  ['A2 stories', 'The press ran 6 stories on the gas export tax in the window.', 'counts', 'heads', 24, []],
  ['A2 year', 'In November 2026, the levy divided the Senate [M:1].', 'counts', 'heads', 24, []],
  ['A3 to Monday', 'In the 24 hours to Monday, coverage held steady.', 'strike', 'none', 24, [], 'r1 flagged the window'],
  ['A3 over', 'Over 24 hours the story spread to six outlets.', 'strike', 'none', 24, [], 'r1 flagged the window'],
  ['A4 other', 'It was carried by 7 other outlets [M:1].', 'outlets', 'none', 0, ['7 other outlets'], 'r1 let a wrong count pass'],
  ['A4 outlets', 'It was carried by 6 outlets [M:1].', 'outlets', 'none', 0, []],
  ['A4 interactions', 'It drew 300 interactions on Facebook [M:1].', 'outlets', 'none', 0, ['300 interactions']],
  ['A5 years', 'It runs over 9 years [M:1].', 'years', 'none', 0, ['9 years'], 'r1 let a wrong span pass'],
  ['A5 billion', 'It will produce 6 billion tonnes a year [M:1].', 'years', 'none', 0, ['6 billion'], 'r1 let a wrong magnitude pass'],
  ['E1 MPs', 'Some 12 MPs signed the letter [M:2].', 'strike', 'twelve', 24, ['12'], 'r1 and r2 let a header clear it'],
  ['E1 strike', 'Unions called a 24-hour strike [M:2].', 'strike', 'twelve', 24, ['24'], 'r1 and r2 let the desk line clear it'],
  ['E1 held for', 'The strike was held for 24 hours [M:2].', 'strike', 'twelve', 24, ['24'], 'r1 and r2 let the desk line clear it'],
  ['E1 lasted', 'The strike lasted 24 hours.', 'strike', 'twelve', 24, ['bare 24'], 'r1 and r2 let the desk line clear it'],
  ['E1 MPs uncited', 'Some 12 MPs signed the letter.', 'strike', 'twelve', 24, ['bare 12'], 'r1 and r2 let a header clear it'],
  ['E1 year', 'In 2026 the levy divides the Senate [M:2].', 'strike', 'twelve', 24, []],
  ['E1 stories', 'The press ran 12 stories on the levy [M:2].', 'strike', 'twelve', 24, []],
  ['E1 channels', 'Bluesky carried 30 posts on the levy [M:2].', 'strike', 'twelve', 24, []],
  ['E1 window', 'In the 24 hours to Monday, the strike led the coverage [M:2].', 'strike', 'twelve', 24, []],
  ['E1 $4bn', 'The levy would raise $4bn [M:2].', 'strike', 'bottom', 24, ['$4bn'], 'r1 and r2 let the last bottom line clear it'],
  ['E1 2041', 'By 2041 the levy ends [M:2].', 'strike', 'bottom', 24, []],
  ['E1 73', 'Some 73 MPs back the levy.', 'strike', 'bottom', 24, ['bare 73'], 'r1 and r2 let the last bottom line clear it'],
  ['E1 C24', 'Gas taxation drew 24 posts and stories in this window [C:gastax].', 'strike', 'twelve', 24, ['24 posts'], 'r1 let the desk line clear it'],
  ['E4 Mtpa', 'The 6 million tonne a year expansion was approved [M:3].', 'water', 'none', 0, [], 'r2 flagged a correct restatement'],
  ['E4 ML', 'It would use 300ML of water [M:3].', 'water', 'none', 0, [], 'r2 flagged a correct restatement'],
  ['E4 yr', 'It runs under a 10-year deal [M:3].', 'water', 'none', 0, [], 'r2 flagged a correct restatement'],
  ['E4 two-day', 'It follows a 2-day strike [M:3].', 'water', 'none', 0, [], 'r2 flagged a correct restatement'],
  ['E4 Mt', 'The mine moves 6Mt a year [M:3].', 'water', 'none', 0, [], 'r2 flagged a correct restatement'],
  ['E4 billion', 'The 6 billion tonne expansion was approved [M:3].', 'water', 'none', 0, ['6 billion'], 'r1 let a wrong magnitude pass'],
  ['E4 GL', 'It would use 300GL of water [M:3].', 'water', 'none', 0, ['300GL'], 'r1 let a wrong measure pass'],
  ['E4 week', 'It runs under a 10-week deal [M:3].', 'water', 'none', 0, ['10'], 'r1 let a wrong unit pass'],
  ['E4 2-week', 'It follows a 2-week strike [M:3].', 'water', 'none', 0, ['2-week'], 'r1 let a wrong unit pass'],
  ['E4 hours', 'Talks took 10 hours [M:3].', 'water', 'none', 0, ['10'], 'r1 let a wrong unit pass'],
  ['E5 within', 'The minister promised a reply within 24 hours [M:1].', 'blockade', 'none', 24, ['24'], 'r2 took a deadline for the window'],
  ['E5 lasted over', 'The blockade lasted over 24 hours [M:1].', 'blockade', 'none', 24, ['24'], 'r2 took a duration for the window'],
  ['E5 within ctx', 'The minister promised a reply within 24 hours [M:1].', 'blockade', 'twelve', 24, ['24'], 'r1 and r2 let the desk line clear it'],
  ['E5 lasted ctx', 'The blockade lasted over 24 hours [M:1].', 'blockade', 'twelve', 24, ['24'], 'r1 and r2 let the desk line clear it'],
  ['E5 48', 'The minister promised a reply within 48 hours [M:1].', 'blockade', 'twelve', 24, []],
  ['E5 12', 'The blockade lasted 12 hours [M:1].', 'blockade', 'twelve', 24, []],
  ['E5 for over', 'The blockade went on for over 24 hours.', 'blockade', 'none', 24, ['bare 24'], 'r2 took a duration for the window'],
  ['E5 throughout', 'Throughout the 24 hours, the blockade led [M:1].', 'blockade', 'none', 24, [], 'r1 flagged the window'],
  ['E5 period', 'In this 24-hour period the blockade led [M:1].', 'blockade', 'none', 24, [], 'r1 flagged the window'],
  ['E5 over bare', 'Over 24 hours the blockade led the coverage [M:1].', 'blockade', 'none', 24, [], 'r1 and r3 flagged the window; its line carries no span so phrased (P5)'],
  ['E5 over uncited', 'Over 24 hours the blockade led the coverage.', 'blockade', 'none', 24, [], 'r1 flagged the window'],
  ['E5 in bare', 'The blockade led the coverage in 24 hours [M:1].', 'blockade', 'none', 24, [], 'r1 and r3 flagged the window; its line carries no span so phrased (P5)'],
  ['E5 petition', 'Over 24 hours, the petition drew 5,000 names [M:1].', 'blockade', 'none', 24, ['5,000'], 'r1 and r3 flagged the window too (P5); the 5,000 is not in the line'],
  ['E8 Parliament', 'On Friday 20 Parliament sits [M:4].', 'sitting', 'none', 0, [], 'r2 flagged a date'],
  ['E8 NOVEMBER', 'The vote is on Tuesday 17 NOVEMBER [M:4].', 'sitting', 'none', 0, [], 'r2 flagged a date'],
  ['E8 Harbour Watch', 'On Monday 23 Harbour Watch said the vote was close [M:4].', 'sitting', 'none', 0, [], 'r2 flagged a date'],
  ['E8 19 MPs', 'On Tuesday 19 MPs signed the letter [M:4].', 'sitting', 'none', 0, ['19'], 'r1 let a wrong count pass'],
  ['E8 12 MPs', 'On Tuesday 12 MPs signed the letter [M:4].', 'sitting', 'none', 0, []],
  ['E8 3,000', 'On Saturday, 3,000 people marched [M:4].', 'sitting', 'none', 0, ['3,000'], 'r1 flagged "000" only'],
  ['E8 2,000', 'On Saturday, 2,000 people marched [M:4].', 'sitting', 'none', 0, [], 'r1 flagged a stray "000"'],
  ['P5 in 24', 'Gas taxation drew 59 posts and stories in 24 hours [C:gastax].', 'strike', 'twelve', 24, [], 'r3 flagged the window restated'],
  ['P5 over 24', 'Over 24 hours, gas taxation drew 59 posts and stories [C:gastax].', 'strike', 'twelve', 24, [], 'r3 flagged the window restated'],
  ['P5 stayed', 'Coverage stayed high over 24 hours [M:1].', 'blockade', 'none', 24, [], 'r1 and r3 flagged the window restated'],
  ['P5 stayed ctx', 'Coverage stayed high over 24 hours [M:1].', 'blockade', 'twelve', 24, [], 'r3 flagged the window restated'],
  ['P5 the 24', 'In the 24 hours, gas taxation drew 59 posts and stories [C:gastax].', 'strike', 'twelve', 24, []],
  ['P5 line span', 'The petition drew 5,000 names in 24 hours [M:6].', 'blockade', 'none', 24, ['24'], 'r2 took it for the window; its line has "in 48 hours", so it is a claim'],
  ['P5 line right', 'The petition drew 5,000 names in 48 hours [M:6].', 'blockade', 'none', 24, []],
  // the sixth round (fx6, S6): a span equal to the window, in a sentence restating its line's 5,000 or telling how long the
  // blockade went on, is a claim, with or without stored context; "59 posts and stories in 24 hours" still holds (P5 in 24)
  ['S6 within', 'The petition drew 5,000 names in 24 hours [M:7].', 'within48', 'none', 24, ['24'], 'r5 let a wrong span pass (r1 and r3 flagged it); the 5,000 is the line\'s, so its span is the line\'s claim'],
  ['S6 within ctx', 'The petition drew 5,000 names in 24 hours [M:7].', 'within48', 'twelve', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 first', 'The petition drew 5,000 names in 24 hours [M:7].', 'first48', 'none', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 first ctx', 'The petition drew 5,000 names in 24 hours [M:7].', 'first48', 'twelve', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 two days', 'The petition drew 5,000 names in 24 hours [M:7].', 'twodays', 'none', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 two days ctx', 'The petition drew 5,000 names in 24 hours [M:7].', 'twodays', 'twelve', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 stretched', 'The blockade stretched over 24 hours [M:1].', 'lasted12', 'none', 24, ['24'], 'r5 let a wrong span pass; "stretched over" is how long it went on, as "lasted over" is'],
  ['S6 stretched ctx', 'The blockade stretched over 24 hours [M:1].', 'lasted12', 'twelve', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 unfolded', 'The blockade unfolded over 24 hours [M:1].', 'lasted12', 'none', 24, ['24'], 'r5 let a wrong span pass'],
  ['S6 unfolded ctx', 'The blockade unfolded over 24 hours [M:1].', 'lasted12', 'twelve', 24, ['24'], 'r5 let a wrong span pass'],
  // the seventh round (fx7, T6): a bare window phrase in a cited sentence is a claim only when a line it cites gives a span
  // (hours, days, within, first, over N days); beside a line that gives none it is the window, whatever figure it restates,
  // and in a sentence that cites nothing it is the window whatever verb comes before "over"
  ['T6 post', 'Over 24 hours, the Harbour Watch post drew 450 interactions [S:5].', 'post450', 'none', 24, [], 'r6 flagged the window restated (r5 did not); its line gives no span, so it cannot contradict the window'],
  ['T6 story', 'The Point Post story drew 1204 reactions in 24 hours [M:1].', 'story1204', 'none', 24, [], 'r6 flagged the window restated'],
  ['T6 outlier', 'Over 24 hours, a post by Harbour Watch drew 450 interactions against a usual 6 [O:5].', 'outlier', 'none', 24, [], 'r6 flagged the window restated'],
  ['T6 templated', 'Over 24 hours, 12 near-identical posts drew 300 interactions [S:9].', 'twelvesame', 'none', 24, [], 'r6 flagged the window restated'],
  ['T6 played out', 'Debate on the gas tax played out over 24 hours.', 'blockade', 'none', 24, [], 'r6 flagged it (bare 24); a window phrase in a sentence that cites nothing is the window'],
  ['T6 extended', 'Coverage of the levy extended over 24 hours.', 'blockade', 'none', 24, [], 'r6 flagged it (bare 24)']
];

await S.t('CK36 every sentence the reviewers listed has its expected result, rounds one to six (fx5 P0, fx6 S1-S6, fx7 T1-T6)', async () => {
  const w = await mk(); const T = w.mod.__test; const what = u => u.date + ' ' + (u.recurring ? u.schedule : u.event);
  const up = inp => typeof inp === 'string' ? T.denUpcoming([row(1, inp)], MON16).map(what) : T.denUpcoming(inp.map(x => row(x[0], x[1], x[2])), MON16).map(u => u.item + ' ' + what(u));
  const fig = r => T.denCleanText(r[1], new Map(FIGM[r[2]]), FIGX[r[3]], r[4]).unverified.map(u => (u.bare ? 'bare ' : '') + u.figures.join(' | '));
  const wrongUp = UPT.filter(r => JSON.stringify(up(r[1])) !== JSON.stringify(r[2])).map(r => r[0] + ' gave ' + JSON.stringify(up(r[1])));
  const wrongFig = FIGT.filter(r => JSON.stringify(fig(r)) !== JSON.stringify(r[5])).map(r => r[0] + ' gave ' + JSON.stringify(fig(r)));
  eq([wrongUp, wrongFig], [[], []], 'every row of the table holds');
  ok(UPT.length >= 100 && FIGT.length >= 80 && new Set(UPT.map(r => r[0]).concat(FIGT.map(r => r[0]))).size === UPT.length + FIGT.length, 'the table is whole, each row named once: ' + UPT.length + ' upcoming, ' + FIGT.length + ' figures');
});

await S.t('CK37 a day is told as begun only by the verb that governs it (fx5 P1)', async () => {
  const w = await mk(); const T = w.mod.__test; const on = s => T.denUpcoming([row(1, s)], MON16).map(u => u.date + ' ' + (u.recurring ? u.schedule : u.event));
  eq(['Consultation began on 1 October, with a final hearing on 2 February.', 'The group started a petition last month ahead of a rally on 10 January.', 'Protesters have held rallies since 2019 ahead of the vote on 4 March.', 'Hearings began on 3 March and resume on 2 February.', 'The strike began last week and a rally follows on 10 January.', 'The group launched its campaign in October, with a rally on 10 January.', 'The campaign kicked off in October and culminates in a rally on 10 January.'].map(on),
    [['2027-02-02 hearing'], ['2027-01-10 rally'], ['2027-03-04 vote'], ['2027-02-02 hearings'], ['2027-01-10 rally'], ['2027-01-10 rally'], ['2027-01-10 rally']], 'told on 16 November, next year\'s hearing, rally or vote stands beside a begun verb that governs another day or none, named by the action nearest it');
  eq(['Consultation began on 1 October.', 'Submissions opened on Tuesday 1 October.', 'Protests have continued since 4 March.', 'Protests have gone on every week since 4 March.', 'The vigil was held every Friday until 4 March.'].map(on), [[], [], [], [], []], 'a day its own verb tells as begun, one after since, and an end told in the past are never next year\'s');
  eq(on('Vigils began in March and resume every Friday until 2 February.'), ['2026-11-20 every Friday'], 'a schedule\'s end read by its own verb ("resume"), not a begun one before it, runs to next February; the month is no "march"');
});

await S.t('CK38 a past form describing a noun in a vow\'s until clause does not end it (fx5 P2)', async () => {
  const w = await mk(); const T = w.mod.__test; const on = s => T.denUpcoming([row(1, s)], MON16).filter(u => u.recurring).map(u => u.date + ' ' + u.schedule);
  eq(['Residents hold a vigil every Friday until the levy, announced in May, is scrapped.', 'Residents hold a vigil every Friday until the mine approved last year is stopped.', 'Residents hold a vigil every Friday until the deal signed in May is torn up.', 'Residents hold a vigil every Friday until the decision announced on Friday is reversed.', 'Residents hold a vigil every Friday until the tax passed in June is repealed.', 'Locals rally every Saturday until the mine, approved in March, is stopped.', 'Residents hold a vigil every Friday until the minister who approved the mine resigns.', 'Residents hold a vigil every Friday until the mine is approved or rejected.', 'Residents hold a vigil every Friday until the tax is dropped or reversed.', 'Residents vow to hold a vigil every Friday until the project announced in the budget is cancelled.'].map(on),
    [['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-21 every Saturday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday'], ['2026-11-20 every Friday']], 'a vow still to come runs on, whatever past form describes its noun');
  eq(['Locals held a vigil every Friday until the campaign ended.', 'Residents held a vigil every Friday until the government scrapped the tax.', 'Residents held a vigil every Friday until the minister who approved the mine resigned.', 'Residents held a vigil every Friday until the levy, which is now law, passed.', 'Residents held a vigil every Friday until the campaign ended, and the council is now silent.'].map(on), [[], [], [], [], []], 'an until clause whose own verb is past still ends it, whatever a who or which clause or the next clause says');
});

await S.t('CK39 a headline whose only name is its first word is placed by a lead that says where (fx5 P3)', async () => {
  const w = await mk(); const T = w.mod.__test; const U = rows => T.denUpcoming(rows.map(x => row(x[0], x[1], x[2])), MON16).map(u => u.item).sort((a, b) => a - b);
  eq([U([[40, 'Farmers hold a vigil every Friday', 'Seaview farmers gather at the pier.'], [41, 'Farmers keep up a vigil every Friday', 'Pointville farmers gather at the depot.']]), U([[1, 'Fishers hold a vigil every Friday', 'Seaview fishers gather at the wharf.'], [2, 'Fishers keep a vigil every Friday', 'Pointville fishers gather at the wharf.']]),
    U([[1, 'Climate protesters hold a vigil every Friday', 'Seaview campaigners gather at the pier.'], [2, 'Climate vigil every Friday draws a crowd', 'Pointville campaigners gather at the depot.']]), U([[44, 'Mothers hold a vigil every Friday against the mine', 'The Seaview group meets at the pier.'], [45, 'Mothers keep a vigil every Friday against the mine', 'The Pointville group meets at the depot.']]),
    U([[1, 'Families rally on 21 November against the levy', 'Seaview families will meet at the pier.'], [2, 'Families to rally on 21 November against the levy', 'Pointville families will meet at the depot.']]), U([[46, 'Farmers rally on 21 November', 'Seaview farmers will meet at the pier.'], [47, 'Farmers to rally on 21 November', 'Pointville farmers will meet at the depot.']])],
    [[40, 41], [1, 2], [1, 2], [44, 45], [1, 2], [46, 47]], 'two towns\' events under headlines that name only a group stay two, standing or dated');
  eq([U([[11, 'Pointville residents hold a vigil every Tuesday and Friday', 'Pointville Residents Association says the vigil goes on.'], [12, 'Weekly Pointville vigil every Tuesday and Friday', 'Harbour Watch organises it at the pier.']]), U([[20, 'Senate vote on the gas export tax set for 3 December', 'Harbour Watch welcomes the vote.'], [23, 'Senate vote on 3 December', 'Producers lobby the crossbench.'], [25, 'Senate set for 3 December vote on gas export tax', 'Seaview Neighbours plan a picnic.']])],
    [[11], [20]], 'one town\'s vigil stays one, and one vote whose leads name only who spoke of it stays one');
});

await S.t('CK40 one event told in other words is one entry, in either order (fx5 P4)', async () => {
  const w = await mk(); const T = w.mod.__test; const U = rows => T.denUpcoming(rows.map(x => row(x[0], x[1])), MON16).map(u => u.item).sort((a, b) => a - b);
  const six = [[1, 'The Senate will vote on the gas export tax on 3 December.'], [2, 'The Senate vote on the gas export tax is set for 3 December.'], [3, 'Senators vote on the export tax on 3 December.'], [4, 'The Senate votes on the gas tax on 3 December.'], [5, 'A Senate vote over the gas export levy is due on 3 December.'], [6, 'The Senate is set to vote on the tax bill on 3 December.']];
  const three = [[1, 'A Senate vote on the tax is set for 3 December.'], [2, 'A Senate vote on the gas tax is set for 3 December.'], [3, 'A Senate vote on the export tax is set for 3 December.']], place = [[1, 'Harbour Watch holds a vigil every Friday.'], [2, 'A vigil every Friday at the pier.']];
  // fx7 (T2): the levy is the tax only beside a phrase whose other words all match, so in the other order 5 ("the gas export
  // levy", read before "the gas export tax") joins the vote when the entries merge, and 2, as full, speaks (fx6 had 5 speak)
  eq([U(six), U(six.slice().reverse()), U(three), U([three[0], three[2], three[1]]), U(place), U(place.slice().reverse())], [[1, 3], [2, 3], [2], [3], [1], [1]], 'the Senate\'s vote told five ways is one (Senators apart), in either order; the vigil told by who and by where is one');
  eq([U([[1, 'A vote on the levy is set for 3 December.'], [2, 'A vote on the mine approval is set for 3 December.']]), U([[3, 'Farmers plan a rally on 21 November.'], [4, 'A rally on 21 November will oppose the mine.']]), U([[1, 'Harbour Watch holds a vigil every Friday.'], [2, 'A vigil every Friday over the levy.']]), U([[1, 'A rally on 21 November against the mine expansion.'], [2, 'A rally on 21 November against the port expansion.']]), U([[1, 'Farmers plan a rally on 21 November.'], [2, 'A rally on 21 November at the pier.']])],
    [[1, 2], [3, 4], [1, 2], [1, 2], [1, 2]], 'what shares no word, or only a word any measure has, stays two, and a day\'s rally told by place alone stays apart from one told by name');
});

await S.t('CK41 a bare window phrase in a cited sentence restates the window unless its line carries one (fx5 P5)', async () => {
  const w = await mk(); const T = w.mod.__test; const f = (t, m, x) => figs(T.denCleanText(t, new Map(FIGM[m]), FIGX[x], 24));
  eq([f('Gas taxation drew 59 posts and stories in 24 hours [C:gastax].', 'strike', 'twelve'), f('Over 24 hours, gas taxation drew 59 posts and stories [C:gastax].', 'strike', 'twelve'), f('Coverage stayed high over 24 hours [M:1].', 'blockade', 'none'), f('Coverage stayed high over 24 hours [M:1].', 'blockade', 'twelve')], [[], [], [], []], 'the window restated without an article holds, with or without context');
  eq([f('The minister promised a reply within 24 hours [M:1].', 'blockade', 'twelve'), f('The blockade lasted over 24 hours [M:1].', 'blockade', 'none'), f('The petition drew 5,000 names in 24 hours [M:6].', 'blockade', 'none'), f('The petition drew 5,000 names in 48 hours [M:6].', 'blockade', 'none')], [[['24']], [['24']], [['24']], []], 'a deadline, a duration and a span its line phrases so are still claims');
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
