/* Anne's Den concepts - the shared synthetic data and state machine.
 * INVENTED DATA ONLY: Harbourline Ferries is not a client, and no outlet, account, post or sentence here is real.
 * Loads nothing from the app, talks to no worker, model or key. Works from file://.
 * Every concept reads window.DEN and renders it; none keeps its own copy of the data.
 *
 *   DEN.state            the one mutable state (see below)
 *   DEN.on(fn)           subscribe; fn() is called after every change. Returns an unsubscribe.
 *   DEN.a.<action>()     every mutation goes through an action
 *   DEN.q.<query>()      derived reads (rows, weight, coverage, flags, hourly...)
 *
 * Demo states: add ?state=loading|empty|error|busy|dropped|readonly|filed|nogap to the address, or call
 * DEN.a.setMode(). ?desk=<id> opens a desk. */
(function () {
  'use strict';
  var NOW = new Date('2026-11-13T07:10:00+11:00').getTime();
  var H = 3600e3;

  var CLIENT = { id: 'harbourline', name: 'Harbourline Ferries', note: 'SYNTHETIC DEMO CLIENT' };
  var ISSUES = [
    { id: 'levy', label: 'Ferry levy' }, { id: 'dredging', label: 'Harbour dredging' },
    { id: 'fares', label: 'Fare cap' }, { id: 'safety', label: 'Vessel safety' }];
  var DESKS = [
    { id: 'hf_au', name: 'Harbourline national', region: 'National', cadence: 'daily', windowH: 24, brief: 'draft', gaps: 1, rows: 44 },
    { id: 'hf_east', name: 'Harbourline Eastport', region: 'Eastport', cadence: 'daily', windowH: 24, brief: 'none', gaps: 0, rows: 17 },
    { id: 'cfc_au', name: 'Coastal Freight Council national', region: 'National', cadence: 'weekly', windowH: 168, brief: 'filed', gaps: 0, rows: 61 },
    { id: 'cfc_east', name: 'Coastal Freight Council Eastport', region: 'Eastport', cadence: 'weekly', windowH: 168, brief: 'none', gaps: 2, rows: 23 },
    { id: 'pilots_au', name: 'Harbour Pilots national', region: 'National', cadence: 'weekly', windowH: 168, brief: 'draft', gaps: 0, rows: 29 }];

  /* Report format A. `source` is built from citations and is never editable. */
  var SECTIONS = [
    { id: 'summary', title: 'Executive Summary' }, { id: 'narratives', title: 'Key Narratives' },
    { id: 'media', title: 'Traditional Media Coverage' }, { id: 'social', title: 'Social Media Activity' },
    { id: 'actors', title: 'Influencer and Political Activity' }, { id: 'sentiment', title: 'Sentiment and Tone' },
    { id: 'momentum', title: 'Momentum Assessment', rating: 'momentum' }, { id: 'risks', title: 'Risks and Implications' },
    { id: 'bottom', title: 'Bottom Line' }, { id: 'posture', title: 'Recommended Posture' },
    { id: 'source', title: 'Source List', built: true }];
  var RATINGS = { levels: ['Low', 'Low to Moderate', 'Moderate', 'Moderate to High', 'High'], trends: ['Stable', 'Escalating'],
    items: [{ id: 'momentum', label: 'Momentum', trend: true }] };

  /* Evidence rows. kind: media | social | actor | narrative | upcoming. t = hours before NOW.
   * Evidence id prefixes follow the app: M media, S social, P actor, N narrative, U upcoming, A alert. */
  function M(n, t, title, outlet, tier, o) { return Object.assign({ id: 'M:' + n, kind: 'media', t: t, title: title, outlet: outlet, tier: tier, outlets: 1, fb: 0, issue: 'levy', also: [], layer: 3,
    text: title + '. The report sets out the proposal, the operator\'s response and what the harbour authority has said so far. It quotes the transport minister\'s office and a commuter group, and notes that a committee reports next month.' }, o || {}); }
  function S(n, t, text, ch, eng, o) { return Object.assign({ id: 'S:' + n, kind: 'social', t: t, title: text, channel: ch, eng: eng, growth: 0, comments: 0, tone: 0, layer: 3, issue: 'levy', foundBy: 'ferry levy', text: text }, o || {}); }
  function P(n, t, who, role, text, ch, eng, o) { return Object.assign({ id: 'P:' + n, kind: 'actor', t: t, who: who, role: role, title: text, text: text, channel: ch, eng: eng, issue: 'levy', layer: 3 }, o || {}); }
  var ROWS = [
    M(1, 2.1, 'Ferry levy splits the upper house as crossbench demands modelling', 'The Eastport Ledger', 'metro', { outlets: 6, fb: 1840, also: ['Coast Daily', 'The Quay', 'Harbour Mail', 'Northshore News', 'Bay Tribune'], full: true }),
    M(2, 3.4, 'Harbourline warns levy would end three off-peak routes', 'National Wire', 'wire', { outlets: 4, fb: 620, also: ['The Quay', 'Coast Daily', 'Bay Tribune'], full: true }),
    M(3, 5.0, 'Commuter group to rally at Parliament on 28 November over the ferry levy', 'Coast Daily', 'regional', { outlets: 2, fb: 410, also: ['Harbour Mail'] }),
    M(4, 6.2, 'Analysis: who pays when the harbour is dredged', 'The Financial Courier', 'national', { subscriber: true, issue: 'dredging', fb: 95 }),
    M(5, 7.5, 'Dredging approval delayed after seagrass survey', 'Harbour Mail', 'regional', { issue: 'dredging', outlets: 2, fb: 130, also: ['Coast Daily'] }),
    M(6, 8.0, 'Minister rules out fare cap changes before the budget', 'National Wire', 'wire', { issue: 'fares', outlets: 3, fb: 260, also: ['The Quay', 'Bay Tribune'] }),
    M(7, 9.3, 'Opinion: a levy on ferries is a tax on the suburbs', 'The Eastport Ledger', 'metro', { fb: 540, opinion: true }),
    M(8, 10.8, 'Union backs levy if revenue is tied to crew numbers', 'Workplace Report', 'sector', { fb: 44 }),
    M(9, 12.0, 'Regulator opens review of vessel inspection intervals', 'Maritime Bulletin', 'sector', { issue: 'safety', fb: 12 }),
    M(10, 13.5, 'Ferry levy: what the discussion paper actually says', 'Public Broadcaster', 'broadcaster', { outlets: 2, fb: 310, also: ['Northshore News'], full: true }),
    M(11, 15.0, 'Tourism operators say levy talk is already hurting bookings', 'Bay Tribune', 'regional', { fb: 88 }),
    M(12, 16.4, 'Harbour authority chair to face estimates next week', 'The Quay', 'metro', { issue: 'dredging', fb: 20 }),
    M(13, 17.9, 'Letters: readers on ferries, fares and fairness', 'Coast Daily', 'regional', { fb: 6 }),
    M(14, 19.0, 'Council votes to oppose levy "in its current form"', 'Northshore News', 'regional', { fb: 150 }),
    M(15, 20.5, 'Ferry timetable changes for the long weekend', 'Harbour Mail', 'regional', { issue: 'fares', fb: 3, low: true }),
    M(16, 21.0, 'Shipping round-up: arrivals and departures', 'Maritime Bulletin', 'sector', { issue: 'safety', fb: 0, low: true }),
    M(17, 21.6, 'Markets wrap: transport stocks steady', 'The Financial Courier', 'national', { subscriber: true, fb: 0, low: true }),
    M(18, 22.3, 'Quiz: how well do you know the harbour?', 'Maritime Bulletin', 'sector', { fb: 9, low: true }),
    S(1, 1.2, 'The ferry levy is overdue. Sign the petition and make the operators pay their share.', 'X', 2140, { growth: 1310, comments: 86, tone: -0.4, layer: 2 }),
    S(2, 2.6, 'Three routes cut if the levy passes? That is a threat, not an argument.', 'X', 980, { growth: 720, comments: 41, tone: -0.6, layer: 2 }),
    S(3, 3.9, 'Thread: the levy modelling nobody has published, and why it matters', 'Bluesky', 412, { growth: 260, comments: 19, tone: -0.1 }),
    S(4, 4.4, 'AMA: I work the Eastport run. Ask me what a levy does to rosters.', 'Reddit', 655, { growth: 300, comments: 212, tone: 0.2, foundBy: 'r/eastport' }),
    S(5, 6.8, 'Dredging the channel again while the seagrass report sits in a drawer', 'X', 340, { growth: 90, comments: 12, tone: -0.5, issue: 'dredging', foundBy: 'harbour dredging', layer: 2 }),
    S(6, 8.9, 'Video: what the fare cap saved one family this year', 'YouTube', 5200, { growth: 400, comments: 64, tone: 0.5, issue: 'fares', foundBy: 'fare cap' }),
    S(7, 11.2, 'Rally details: Parliament steps, 28 November, 12.30pm. Bring a ferry ticket.', 'Mastodon', 96, { growth: 60, comments: 4, tone: 0 }),
    S(8, 14.7, 'Unpopular opinion: the ferries are fine and the levy is fine', 'Reddit', 120, { growth: 10, comments: 58, tone: 0.1, foundBy: 'r/eastport' }),
    S(9, 18.2, 'Ferry was four minutes late again', 'X', 14, { growth: 0, comments: 1, tone: -0.2, issue: 'fares', low: true, layer: 2 }),
    S(10, 20.0, 'Nice sunset from the 5.40 to Northshore', 'Bluesky', 31, { growth: 2, comments: 0, tone: 0.6, issue: 'fares', low: true }),
    P(1, 1.8, 'Harbour Watch', 'organisation', 'Our position on the ferry levy, in full. The operators can afford it.', 'X', 1260, { firstSeen: true, layer: 2 }),
    P(2, 4.9, 'Sen. Imogen Vale', 'crossbench senator', 'I will not vote for a levy without the modelling. Publish it.', 'X', 3100, { mp: true, layer: 2 }),
    P(3, 7.1, 'Fair Fares Alliance', 'organisation', 'Join us on the Parliament steps on 28 November.', 'Bluesky', 280, {}),
    P(4, 9.9, 'Dale Okoro MP', 'shadow transport minister', 'A levy that cuts routes is a cut, whatever it is called.', 'X', 1890, { mp: true, layer: 2 }),
    P(5, 15.6, 'Seagrass Trust', 'organisation', 'The survey is clear. Dredging should wait.', 'Mastodon', 75, { issue: 'dredging' }),
    { id: 'N:1', kind: 'narrative', t: 2.0, title: 'Operators can afford the levy and are bluffing about route cuts', claim: 'Harbourline\'s profits make the route-cut warning a bluff', side: 'hostile', status: 'emerging', n: 23, n24: 17, spread: ['X', 'Bluesky', 'news'], issue: 'levy' },
    { id: 'N:2', kind: 'narrative', t: 6.0, title: 'No vote without the modelling', claim: 'The levy should not pass until Treasury modelling is public', side: 'mixed', status: 'growing', n: 14, n24: 9, spread: ['news', 'X'], issue: 'levy' },
    { id: 'N:3', kind: 'narrative', t: 9.0, title: 'Dredging before the seagrass report is reckless', claim: 'Approval should wait for the survey', side: 'hostile', status: 'steady', n: 8, n24: 3, spread: ['Mastodon', 'news'], issue: 'dredging' },
    { id: 'U:1', kind: 'upcoming', t: 5.0, date: '2026-11-28', what: 'rally', title: 'Commuter rally at Parliament, 12.30pm', asWritten: 'Commuter group to rally at Parliament on 28 November over the ferry levy', from: 'M:3', issue: 'levy' },
    { id: 'U:2', kind: 'upcoming', t: 16.4, date: '2026-11-19', what: 'hearing', title: 'Harbour authority chair at estimates', asWritten: 'Harbour authority chair to face estimates next week', from: 'M:12', recorded: true, issue: 'dredging' },
    { id: 'U:3', kind: 'upcoming', t: 13.5, date: '2026-12-11', what: 'report', title: 'Committee reports on the levy discussion paper', asWritten: 'a committee reports next month', from: 'M:10', recorded: true, issue: 'levy' }];

  /* The six model-free checks. Gaps lead. `item` is the row a signal is about (covered when the brief cites it). */
  var SIGNALS = [
    { key: 'gap:facebook', sig: 'gap', label: 'Not collected', title: 'Facebook delivered nothing in this window', detail: 'The official route is not granted (Page Public Content Access). No signed-in collector is connected: the Mac is off, or nobody has signed in to Facebook on it.', fix: 'Open Collection', channel: 'facebook', span: [0, 24] },
    { key: 'spike:levy', sig: 'spike', label: 'Spike', title: 'Sentinel spike: Ferry levy', detail: '9 stories in six hours, 3.1 times this issue\'s own baseline. Not yet acknowledged.', item: 'M:1', at: 2.1 },
    { key: 'emerging:N1', sig: 'emerging', label: 'Emerging', title: 'New narrative: operators are bluffing about route cuts', detail: '17 rows in the last day across X, Bluesky and news.', item: 'N:1', at: 2.0 },
    { key: 'first:P1', sig: 'first_seen', label: 'First seen', title: 'Harbour Watch posted on this desk for the first time in fourteen days', detail: '1 post in the window on X.', item: 'P:1', at: 1.8 },
    { key: 'outlier:P2', sig: 'outlier', label: 'Unusual reach', title: 'Sen. Imogen Vale\'s post drew four times her usual', detail: '3,100 interactions against a usual 740.', item: 'P:2', at: 4.9 },
    { key: 'burst:levy', sig: 'burst', label: 'Above baseline', title: 'Ferry levy is running above its baseline', detail: '31 rows in the window against 10 usual.', item: 'M:14', at: 19.0 }];
  var CHECKS = ['Sentinel spikes', 'Emerging narratives', 'First-seen actors and accounts', 'Issues above baseline', 'Outlier posts by registered accounts', 'Collection gaps'];

  var DRAFT = {
    summary: 'The ferry levy dominated the window, led by the Eastport Ledger and carried by five other outlets [M:1]. Harbourline\'s warning that three off-peak routes would end drew the sharpest response [M:2]. A campaigner named Sam Private is coordinating the petition. On X the petition post passed 2,100 interactions [S:1].',
    narratives: 'A new narrative holds that operators can afford the levy and are bluffing about route cuts [N:1]. A second, that no vote should happen without the modelling, is growing and is not hostile to the client [N:2].',
    media: 'Coverage ran in six outlets and drew 1,840 reactions on Facebook [M:1]. The public broadcaster\'s explainer was the most neutral treatment [M:10]. One opinion piece called the levy a tax on the suburbs [M:7].',
    social: 'The petition post is the loudest item of the window at 2,140 interactions, up 1,310 since yesterday [S:1]. A Reddit AMA by a crew member drew 212 comments, mostly sympathetic to staff [S:4].',
    actors: 'Senator Vale said she will not vote for a levy without the modelling; her post drew 3,100 interactions [P:2]. Harbour Watch posted on this desk for the first time in a fortnight [P:1].',
    sentiment: 'Tone under the petition post is hostile to the operators [S:1]. Tone under the crew AMA is mildly positive [S:4].',
    momentum: 'Activity is above baseline and a rally is called for 28 November [U:1]. Momentum is Moderate to High and escalating.',
    risks: 'The bluff narrative could harden before the committee reports on 11 December [U:3]. Facebook was not collected in this window, so reach there is unknown.',
    bottom: 'The levy debate is moving against the client on social channels while the crossbench keeps the outcome open [P:2].',
    posture: 'Publish the route-level figures behind the off-peak warning, and brief the crossbench before the estimates hearing.' };

  var PROPOSALS = [
    { id: 'w1', kind: 'term', value: 'route cuts', reason: 'In 11 of this desk\'s rows at 4.2 times its rate elsewhere', score: 92, evidence: ['M:2', 'S:2', 'P:4'], status: 'proposed', preview: { held: 14, add: 6, au: 6, sample: ['Harbourline warns levy would end three off-peak routes', 'A levy that cuts routes is a cut, whatever it is called.'] } },
    { id: 'w2', kind: 'term', value: 'publish the modelling', reason: 'Comment phrase under 3 of the desk\'s posts', score: 81, evidence: ['S:3', 'P:2'], status: 'proposed', preview: { held: 9, add: 2, au: 2, sample: ['Thread: the levy modelling nobody has published'] } },
    { id: 'w3', kind: 'hashtag', value: '#makeferriespay', reason: 'On 5 posts in the window', score: 77, evidence: ['S:1', 'S:2'], status: 'proposed' },
    { id: 'w4', kind: 'account', value: '@fairfares', name: 'Fair Fares Alliance', reason: 'Named in 3 registered accounts\' own posts', score: 70, evidence: ['P:3'], status: 'proposed' },
    { id: 'w5', kind: 'outlet', value: 'thequay.example', name: 'The Quay', reason: 'Linked 4 times; not in the Source Registry', score: 64, evidence: ['M:12'], status: 'proposed' },
    { id: 'w6', kind: 'term', value: 'seagrass survey', reason: 'In 5 rows at 3.6 times its rate elsewhere', score: 58, evidence: ['M:5', 'S:5', 'P:5'], status: 'proposed', preview: { held: 5, add: 3, au: 3, sample: ['Dredging approval delayed after seagrass survey'] } },
    { id: 'w7', kind: 'group', value: 'Eastport Commuters (public group)', reason: 'Linked from 2 registered accounts\' posts', score: 41, evidence: ['P:3'], status: 'proposed' }];
  var REGISTER = [
    { id: 'r1', kind: 'term', value: 'ferry levy', issue: 'levy', status: 'active', last: 0.4 }, { id: 'r2', kind: 'term', value: 'harbour dredging', issue: 'dredging', status: 'active', last: 0.4 },
    { id: 'r3', kind: 'term', value: 'fare cap', issue: 'fares', status: 'active', last: 0.4 }, { id: 'r4', kind: 'term', value: 'ferry tax', issue: 'levy', status: 'active', last: 0.4, review: true },
    { id: 'r5', kind: 'account', value: '@harbourwatch', name: 'Harbour Watch', platform: 'X', actor: 'org', status: 'active', last: 1.8 },
    { id: 'r6', kind: 'account', value: '@imogenvale', name: 'Sen. Imogen Vale', platform: 'X', actor: 'official', status: 'active', last: 4.9 },
    { id: 'r7', kind: 'account', value: 'harbourwatch', name: 'Harbour Watch', platform: 'Facebook', actor: 'org', status: 'active', last: null, error: 'not collected' },
    { id: 'r8', kind: 'hashtag', value: '#ferrylevy', status: 'active', last: 0.9 }, { id: 'r9', kind: 'outlet', value: 'coastdaily.example', name: 'Coast Daily', status: 'active', last: 0.6 },
    { id: 'r10', kind: 'term', value: 'boats', status: 'dismissed', reason: 'generic: does not name the harbour' }];
  var CHANNELS = [
    { id: 'news', label: 'News', how: 'Source Registry, 481 sources', by: 'worker', d1: 31, d7: 212, last: 0.3, state: 'ok' },
    { id: 'x', label: 'X', how: 'Signed-in search on the Mac; account timelines from the worker', by: 'mac', d1: 9, d7: 70, last: 1.2, state: 'ok' },
    { id: 'facebook', label: 'Facebook', how: 'Official route not granted; signed-in search on the Mac', by: 'mac', d1: 0, d7: 0, last: null, state: 'gap', why: 'No Mac collector is connected, and Page Public Content Access is not granted.', fix: 'Start the collector on the Mac, or sign in to Facebook on it.' },
    { id: 'instagram', label: 'Instagram', how: 'Registered accounts, signed-in on the Mac', by: 'mac', d1: 0, d7: 4, last: 52, state: 'paused', why: 'Paused 24 hours after a verification screen.', fix: 'Sign in again by hand tomorrow.' },
    { id: 'bluesky', label: 'Bluesky', how: 'Public search, keyless', by: 'worker', d1: 3, d7: 22, last: 0.8, state: 'ok' },
    { id: 'reddit', label: 'Reddit', how: 'Signed-in sweep on the Mac', by: 'mac', d1: 2, d7: 19, last: 3.1, state: 'ok' },
    { id: 'youtube', label: 'YouTube', how: 'Channel feeds; search not switched on', by: 'worker', d1: 1, d7: 6, last: 8.9, state: 'ok' },
    { id: 'mastodon', label: 'Mastodon', how: 'Tag timelines, keyless', by: 'worker', d1: 2, d7: 9, last: 2.2, state: 'ok' },
    { id: 'hansard', label: 'Hansard', how: 'Once a day', by: 'worker', d1: 0, d7: 3, last: 26, state: 'quiet', why: 'Parliament is not sitting this week.' }];
  var PAGES = [{ id: 'pg1', name: 'Ferry Levy Bill 2026', house: 'Upper house', stage: 'Second reading', next: '2026-11-26', read: 0.5 }, { id: 'pg2', name: 'Inquiry into harbour dredging approvals', house: 'Committee', stage: 'Submissions closed', next: '2026-12-11', read: 0.5 }];
  var PETITIONS = [{ id: 'pt1', name: 'Make the ferry operators pay their share', host: 'fairfares.example', count: 18420, d1: 2310 }, { id: 'pt2', name: 'Pause the dredging', host: 'seagrasstrust.example', count: 3120, d1: 40 }];
  var RECALL = { share: 0.83, reports: 12, by: [['News', 0.94], ['X', 0.81], ['Facebook', 0.22], ['Instagram', 0.4], ['Reddit', 0.9]] };
  var ASIDE_REASONS = ['Not relevant', 'Duplicate', 'Foreign', 'Old news', 'Other'];

  var qs = {}; try { new URLSearchParams(location.search).forEach(function (v, k) { qs[k] = v; }); } catch (e) {}
  var subs = [];
  var st = {
    now: NOW, desk: qs.desk || 'hf_au', role: qs.state === 'readonly' ? 'read' : 'full',
    mode: qs.state || 'normal', /* normal | loading | empty | error | busy | dropped | readonly | filed | nogap */
    pins: {}, aside: {}, assigned: {}, read: {}, mutes: [], undo: [],
    brief: { status: 'draft', revision: 3, day: '2026-11-13', sections: {}, ratings: { momentum: { level: 'Moderate to High', trend: 'Escalating' } }, save: 'saved', conflict: null, by: null, filedBy: null, drafting: null, history: [{ rev: 1, by: 'drafted', at: 1.1 }, { rev: 2, by: 'Anne', at: 0.7 }, { rev: 3, by: 'Anne', at: 0.3 }] },
    calls: { used: 1, cap: 20 }, proposals: PROPOSALS, register: REGISTER, channels: CHANNELS, job: null, toast: null,
    options: { density: 'regular', minInteractions: 10, fold: true, autoDraft: false }
  };
  SECTIONS.forEach(function (s) { if (!s.built) st.brief.sections[s.id] = { text: DRAFT[s.id] || '', by: 'drafted', edited: false, dirty: false }; });
  st.brief.sections.bottom.by = 'Anne'; st.brief.sections.bottom.edited = true;
  st.pins['M:1'] = 1; st.pins['S:1'] = 1; st.pins['P:2'] = 1; st.assigned['M:1'] = 'media'; st.assigned['S:1'] = 'social'; st.assigned['P:2'] = 'actors';
  if (st.mode === 'filed') { st.brief.status = 'filed'; st.brief.filedBy = 'Anne'; }
  if (st.mode === 'nogap') { /* handled in q.signals */ }
  if (st.mode === 'empty') { st.brief.status = 'none'; }

  function emit() { subs.slice().forEach(function (f) { try { f(); } catch (e) { console.error(e); } }); }
  function say(t, kind) { st.toast = { text: t, kind: kind || 'info', at: Date.now() }; emit(); }
  function ro() { if (st.role === 'read') { say('This key is read-only: nothing was changed.', 'warn'); return true; } return false; }
  function byId(id) { for (var i = 0; i < ROWS.length; i++) if (ROWS[i].id === id) return ROWS[i]; return null; }
  function cites(text) { return (String(text || '').match(/\[[A-Z]:\d+\]/g) || []).map(function (x) { return x.slice(1, -1); }); }
  function sentences(text) { return String(text || '').split(/(?<=[.!?])\s+(?=[A-Z"'])/).filter(function (x) { return x.trim(); }); }

  var q = {
    client: function () { return CLIENT; }, issues: function () { return ISSUES; }, desks: function () { return DESKS; },
    desk: function () { return DESKS.filter(function (d) { return d.id === st.desk; })[0] || DESKS[0]; },
    sections: function () { return SECTIONS; }, ratings: function () { return RATINGS; }, checks: function () { return CHECKS; },
    asideReasons: function () { return ASIDE_REASONS; }, row: byId, cites: cites, sentences: sentences,
    windowLabel: function () { var d = q.desk(); return d.cadence + ', the last ' + (d.windowH === 24 ? '24 hours' : '7 days') + ' - Australian Eastern time'; },
    /* rows({kind, issue, channel, pinned, aside, low, search}) - set-aside and muted rows are left out unless aside:true */
    rows: function (f) {
      f = f || {}; if (st.mode === 'empty') return [];
      return ROWS.filter(function (r) {
        if (f.kind && r.kind !== f.kind) return false;
        if (f.issue && r.issue !== f.issue) return false;
        if (f.channel && (r.channel || (r.kind === 'media' ? 'News' : '')) !== f.channel) return false;
        var gone = !!st.aside[r.id] || st.mutes.some(function (m) { return m.value === (r.outlet || r.who || r.channel); });
        if (f.aside ? !gone : gone) return false;
        if (f.pinned && !st.pins[r.id]) return false;
        if (f.low === false && r.low) return false;
        if (f.search && (r.title + ' ' + (r.outlet || '') + ' ' + (r.who || '')).toLowerCase().indexOf(f.search.toLowerCase()) < 0) return false;
        return true;
      });
    },
    /* weight 0-100, explainable: reach, spread, growth, a check that names it, recency */
    weight: function (r) {
      var reach = r.kind === 'media' ? (r.fb || 0) : (r.eng || r.n * 60 || 0), parts = [];
      var w = Math.min(40, Math.log10(1 + reach) * 11); if (reach) parts.push(q.fmt(reach) + (r.kind === 'media' ? ' Facebook reactions' : ' interactions'));
      if (r.outlets > 1) { w += Math.min(18, r.outlets * 3); parts.push(r.outlets + ' outlets'); }
      if (r.growth) { w += Math.min(14, Math.log10(1 + r.growth) * 4.5); parts.push('+' + q.fmt(r.growth) + ' since yesterday'); }
      var named = SIGNALS.filter(function (s) { return s.item === r.id; }); if (named.length) { w += 16; parts.push(named[0].label.toLowerCase()); }
      w += Math.max(0, 8 - r.t / 3); if (r.low) w = Math.min(w, 8);
      return { score: Math.round(Math.min(100, w)), why: parts };
    },
    signals: function () { var s = SIGNALS; if (st.mode === 'nogap') s = s.filter(function (x) { return x.sig !== 'gap'; }); if (st.mode === 'empty') s = s.filter(function (x) { return x.sig === 'gap'; });
      return s.map(function (x) { return Object.assign({}, x, { covered: x.sig === 'gap' ? q.briefNames(/facebook/i) : q.cited(x.item) }); }); },
    cited: function (id) { var S2 = st.brief.sections; return Object.keys(S2).some(function (k) { return cites(S2[k].text).indexOf(id) >= 0; }); },
    citedIn: function (id) { var S2 = st.brief.sections; return Object.keys(S2).filter(function (k) { return cites(S2[k].text).indexOf(id) >= 0; }); },
    briefNames: function (rx) { var S2 = st.brief.sections; return Object.keys(S2).some(function (k) { return rx.test(S2[k].text); }); },
    /* flags for one section: uncited sentences, unknown ids, figures the cited row does not carry */
    flags: function (sid) {
      var s = st.brief.sections[sid]; if (!s || !s.text) return []; var out = [];
      sentences(s.text).forEach(function (sen) {
        var c = cites(sen); if (!c.length && /\b(named|said|posted|drew|passed|reported|is coordinating)\b/i.test(sen) && sid !== 'posture' && sid !== 'bottom') out.push({ kind: 'uncited', text: 'No evidence behind', sentence: sen });
        c.forEach(function (id) { if (!byId(id)) out.push({ kind: 'unknown', text: 'Not in the evidence: ' + id, sentence: sen }); });
      });
      return out;
    },
    flagCount: function () { return Object.keys(st.brief.sections).reduce(function (n, k) { return n + q.flags(k).length; }, 0); },
    words: function (sid) { var S2 = st.brief.sections; var ks = sid ? [sid] : Object.keys(S2); return ks.reduce(function (n, k) { return n + (S2[k].text.trim() ? S2[k].text.trim().split(/\s+/).length : 0); }, 0); },
    sourceList: function () { var seen = {}, out = []; SECTIONS.forEach(function (s) { if (s.built) return; cites(st.brief.sections[s.id].text).forEach(function (id) { var r = byId(id); if (r && !seen[id]) { seen[id] = 1; out.push({ id: id, title: r.title, where: r.outlet || r.channel || r.kind, when: q.when(r.t) }); } }); }); return out; },
    /* hourly volume for the window: [{h: hoursAgo, News: n, X: n, ...}] */
    hourly: function () { var out = []; for (var h = 23; h >= 0; h--) out.push({ h: h, News: 0, X: 0, Bluesky: 0, Reddit: 0, YouTube: 0, Mastodon: 0, Facebook: 0 });
      ROWS.forEach(function (r) { if (r.kind === 'narrative' || r.kind === 'upcoming') return; var b = out[23 - Math.min(23, Math.floor(r.t))]; var ch = r.kind === 'media' ? 'News' : r.channel; if (b && ch in b) b[ch] += 1 + (r.outlets ? r.outlets - 1 : 0); }); return out; },
    yesterdayHourly: function () { return q.hourly().map(function (b, i) { return { h: b.h, total: [1, 0, 0, 1, 2, 1, 0, 1, 1, 2, 1, 0, 1, 2, 1, 1, 0, 1, 2, 1, 1, 0, 1, 1][i] }; }); },
    counts: function () { return { media: q.rows({ kind: 'media' }).length, social: q.rows({ kind: 'social' }).length, actors: q.rows({ kind: 'actor' }).length, narratives: q.rows({ kind: 'narrative' }).length, upcoming: q.rows({ kind: 'upcoming' }).length, pinned: Object.keys(st.pins).length, aside: Object.keys(st.aside).length, muted: st.mutes.length }; },
    when: function (t) { var d = new Date(NOW - t * H); return d.toLocaleString('en-AU', { timeZone: 'Australia/Sydney', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); },
    ago: function (t) { if (t == null) return 'never'; return t < 1 ? Math.round(t * 60) + ' min ago' : t < 48 ? Math.round(t) + ' h ago' : Math.round(t / 24) + ' d ago'; },
    fmt: function (n) { return Number(n || 0).toLocaleString('en-AU'); },
    pages: function () { return PAGES; }, petitions: function () { return PETITIONS; }, recall: function () { return RECALL; },
    exportAs: function (fmt) { var d = q.desk(), out = []; if (fmt === 'slack') return '*' + d.name + ' - ' + st.brief.day + '*\n' + st.brief.sections.summary.text + '\n_Momentum: ' + st.brief.ratings.momentum.level + ', ' + st.brief.ratings.momentum.trend + '_';
      out.push('# ' + CLIENT.name + ' - ' + d.name + ' - ' + st.brief.day); SECTIONS.forEach(function (s) { out.push('\n## ' + s.title + '\n'); if (s.built) q.sourceList().forEach(function (x) { out.push('- [' + x.id + '] ' + x.title + ' - ' + x.where + ', ' + x.when); }); else out.push(st.brief.sections[s.id].text); });
      return fmt === 'html' ? '<article>' + out.join('\n').replace(/</g, '&lt;').replace(/\n/g, '<br>') + '</article>' : out.join('\n'); }
  };

  var a = {
    setDesk: function (id) { st.desk = id; emit(); }, setRole: function (r) { st.role = r; emit(); }, setMode: function (m) { st.mode = m; if (m === 'readonly') st.role = 'read'; emit(); },
    retry: function () { st.mode = 'loading'; emit(); setTimeout(function () { st.mode = 'normal'; emit(); }, 900); },
    markRead: function (id) { if (!st.read[id]) { st.read[id] = 1; emit(); } },
    pin: function (id, section) { if (ro()) return; if (st.pins[id] && !section) { delete st.pins[id]; delete st.assigned[id]; st.undo.push({ what: 'unpin', id: id }); } else { st.pins[id] = 1; if (section) st.assigned[id] = section; st.undo.push({ what: 'pin', id: id }); } emit(); },
    assign: function (id, section) { a.pin(id, section); },
    /* third set-aside of one outlet/account answers offer:{kind,value} - the caller asks the person before muting */
    aside: function (id, reason) { if (ro()) return {}; st.aside[id] = reason || 'Not relevant'; delete st.pins[id]; delete st.assigned[id]; st.undo.push({ what: 'aside', id: id });
      var r = byId(id), key = r && (r.outlet || r.who), n = key ? ROWS.filter(function (x) { return st.aside[x.id] && (x.outlet || x.who) === key; }).length : 0; emit();
      return n >= 3 ? { offer: { kind: r.outlet ? 'outlet' : 'account', value: key } } : {}; },
    restore: function (id) { if (ro()) return; delete st.aside[id]; emit(); },
    mute: function (kind, value) { if (ro()) return; st.mutes.push({ kind: kind, value: value }); say(value + ' is muted on this desk.'); },
    unmute: function (value) { if (ro()) return; st.mutes = st.mutes.filter(function (m) { return m.value !== value; }); emit(); },
    undo: function () { var u = st.undo.pop(); if (!u) return; if (u.what === 'aside') delete st.aside[u.id]; if (u.what === 'pin') { delete st.pins[u.id]; delete st.assigned[u.id]; } if (u.what === 'unpin') st.pins[u.id] = 1; say('Undone.'); },
    /* draft: one model call, staged. In mode 'dropped' the connection drops mid-draft; 'busy' answers the database is busy. */
    draft: function (cb) { if (ro()) return; if (st.calls.used >= st.calls.cap) { say('Today\'s 20 model calls are used.', 'warn'); return; }
      var stages = ['Gathering the window\'s evidence', 'Writing ten sections', 'Checking every citation against its row'], i = 0, t0 = Date.now();
      st.brief.drafting = { stage: stages[0], n: 1, of: stages.length, t0: t0, evidence: q.rows({}).length, pinned: Object.keys(st.pins).length }; emit();
      var tick = setInterval(function () { i++;
        if (st.mode === 'dropped' && i === 2) { clearInterval(tick); st.brief.drafting = { dropped: true }; emit(); return; }
        if (i >= stages.length) { clearInterval(tick); st.brief.drafting = null; st.calls.used++; st.brief.status = 'draft'; st.brief.revision++; SECTIONS.forEach(function (s) { if (!s.built) st.brief.sections[s.id] = { text: DRAFT[s.id], by: 'drafted', edited: false, dirty: false }; }); st.brief.save = 'saved'; emit(); if (cb) cb(); return; }
        st.brief.drafting.stage = stages[i]; st.brief.drafting.n = i + 1; emit(); }, 1800); },
    checkDraft: function () { st.brief.drafting = null; st.mode = 'normal'; say('The draft finished on the worker and is loaded.'); },
    byHand: function () { if (ro()) return; st.brief.status = 'draft'; SECTIONS.forEach(function (s) { if (!s.built) st.brief.sections[s.id] = { text: '', by: 'Anne', edited: false, dirty: false }; }); emit(); },
    edit: function (sid, text) { if (ro() || st.brief.status === 'filed') return; var s = st.brief.sections[sid]; s.text = text; s.dirty = true; s.edited = true; s.by = 'Anne'; st.brief.save = 'unsaved'; emit(); },
    /* insert a citation mark for a row at a caret position (or at the end) */
    cite: function (sid, rowId, pos) { var s = st.brief.sections[sid]; if (!s) return; var t = s.text, mark = ' [' + rowId + ']'; if (pos == null || pos > t.length) pos = t.length; a.edit(sid, t.slice(0, pos).replace(/\s+$/, '') + mark + t.slice(pos)); if (!st.pins[rowId]) { st.pins[rowId] = 1; } st.assigned[rowId] = sid; emit(); },
    save: function () { if (ro()) return; if (st.mode === 'busy') { st.brief.save = 'failed'; say('The database is busy. Your words are kept on this computer. Trying again.', 'warn'); return; }
      st.brief.save = 'saving'; emit(); setTimeout(function () { Object.keys(st.brief.sections).forEach(function (k) { st.brief.sections[k].dirty = false; }); st.brief.revision++; st.brief.history.push({ rev: st.brief.revision, by: 'Anne', at: 0 }); st.brief.save = 'saved'; emit(); }, 500); },
    simulateConflict: function () { st.brief.conflict = { by: 'Kai', section: 'summary', theirs: 'Kai\'s version: the levy led the window and the crossbench remains undecided [M:1] [P:2].' }; emit(); },
    resolve: function (which) { var c = st.brief.conflict; if (!c) return; if (which === 'theirs') { st.brief.sections[c.section] = { text: c.theirs, by: c.by, edited: true, dirty: false }; st.brief.save = 'saved'; } st.brief.conflict = null; emit(); },
    regenerate: function (sid, instruction, cb) { if (ro()) return; st.brief.sections[sid].busy = true; emit(); setTimeout(function () { var s = st.brief.sections[sid]; s.busy = false; s.text = DRAFT[sid] + (instruction ? '' : ''); s.by = 'drafted'; s.edited = false; s.dirty = false; st.calls.used++; emit(); if (cb) cb(); }, 1600); },
    setRating: function (id, key, v) { if (ro() || st.brief.status === 'filed') return; st.brief.ratings[id][key] = v; st.brief.save = 'unsaved'; emit(); },
    /* file: answers {uncovered:[signals]} once unless acknowledge; a filed brief is final until reopened */
    file: function (o) { if (ro()) return {}; var un = q.signals().filter(function (s) { return !s.covered; }); if (un.length && !(o && o.acknowledge)) return { uncovered: un };
      st.brief.status = 'filed'; st.brief.filedBy = 'Anne'; st.brief.save = 'saved'; emit(); return { filed: true }; },
    reopen: function () { if (ro()) return; st.brief.status = 'draft'; st.brief.filedBy = null; emit(); },
    decide: function (id, decision, o) { if (ro()) return; st.proposals.forEach(function (p) { if (p.id === id) { p.status = decision === 'approve' ? 'active' : 'dismissed'; p.issue = o && o.issue; p.reason2 = o && o.reason; } }); emit(); },
    addRegister: function (o) { if (ro()) return; st.register.push({ id: 'r' + Date.now(), kind: o.kind || 'term', value: o.value, name: o.name, platform: o.platform, issue: o.issue, status: 'active', last: null }); say(o.value + ' was added to the register.'); },
    toggleRegister: function (id) { if (ro()) return; st.register.forEach(function (r) { if (r.id === id) r.status = r.status === 'active' ? 'off' : 'active'; }); emit(); },
    toggleChannel: function (id) { if (ro()) return; st.channels.forEach(function (c) { if (c.id === id) c.off = !c.off; }); emit(); },
    /* collect now: a job whose console lines arrive over time */
    collect: function (id) { if (ro()) return; var c = st.channels.filter(function (x) { return x.id === id; })[0]; var lines = c.state === 'gap' ? ['queued: ' + c.label, 'waiting for a collector that offers ' + c.id + '...', 'failed: no_collector - ' + c.fix] : ['queued: ' + c.label, '$ sweep ' + c.id + ' --desk ' + st.desk, '12 hits, 9 Australian kept', 'filed 3 new rows, 6 already held', 'done in 4.2 s'];
      st.job = { channel: id, lines: [], done: false, failed: false }; emit(); var i = 0; var tk = setInterval(function () { st.job.lines.push(lines[i++]); if (i >= lines.length) { clearInterval(tk); st.job.done = true; st.job.failed = c.state === 'gap'; } emit(); }, 650); },
    setOption: function (k, v) { if (ro()) return; st.options[k] = v; emit(); },
    say: say, clearToast: function () { st.toast = null; emit(); }
  };

  window.DEN = { state: st, q: q, a: a, on: function (f) { subs.push(f); return function () { subs = subs.filter(function (x) { return x !== f; }); }; } };
  if (st.mode === 'loading' && qs.hold !== '1') setTimeout(function () { st.mode = 'normal'; emit(); }, 1600);
})();
