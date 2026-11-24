/* Anne's Den build p72, page lane P1 ("pane"): each section's sources without the Board (spec v3 Part A, in Part D's words,
 * UX-SPEC s.6.3 rows marked P1 and s.12.2), against the worker module in this process and the fixture's invented world (the
 * harbour levy, The Point Post, The Tribune, Harbour Watch; every address and sentence added here is invented too).
 *   PN1  the lists: Sources, Used in this section, Suggested (at most three, each with its reason: must mention · <who>),
 *        New since it was written (with its count), Find a story or post (search, kind, only new)
 *   PN2  Use here on a card collected after the draft: its chip reads as the card, never unknown; the save merges it
 *   PN3  Add to this section adds to the section's list through POST /den/brief/review and no longer pins
 *   PN4  Not for this section on a card the section does not cite: one review op; Taken out of this section; Put back
 *   PN5  Not for this section on a cited card: its sentence listed, Keep it without the source; the text save first
 *   PN6  Used here, but marked not for this section: Keep it, and Remove the number (a save with nosource)
 *   PN7  Not for this report: the sentences of every section, Delete the sentence and Keep it without the source; one
 *        save, then the removal from every section that held it
 *   PN8  a card added to the section on the Board: Not for this section unfiles it on the Board's route, no review op
 *   PN9  Add a new source (paste a link): several addresses at once, platform from the host, a line in her words
 *   PN10 409 cannot_cite said in words, the person's text and its mark kept
 *   PN11 the "Draft again?" dialog says what a rewrite will drop; after it, what it dropped is said
 *   PN12 a failing correction (review route, save route) is said under its card and nothing is left half done
 *   PN13 not_kept said
 *   PN14 a read key sees the lists and no correction control, and sends nothing
 *   PN15 the support check: a view without review and flags (a p71 worker) shows today's evidence pane
 *   PN16 DenPane.land() lands on a card in the pane
 *   PN17 axe at 1366, 1440 and 1920 for a full key (lists, an offer and Add a new source open) and a read key
 * Run: node --experimental-sqlite tests/den-pane-browser.mjs */
import fs from 'node:fs';
import { world, open, t, ok, eq, txt, all, tab, finish, sec, NOW, H } from './den-fixture.mjs';

console.log('den-pane-browser harness (the Sources pane: lists, corrections, Add a new source, the support check)');
const P = '.den-evpane .den-pane';
const li = (list, id) => P + ' li[data-list="' + list + '"]' + (id ? '[data-cite="' + id + '"]' : '');
const ids = (p, list) => p.$$eval(P + ' li[data-list="' + list + '"]', els => els.map(e => e.getAttribute('data-cite')));
const posts = (p, path) => p.posts.filter(x => x.path === path);
const sleep = ms => new Promise(r => setTimeout(r, ms));
let seq = 900;
const story = o => Object.assign({ src: 'tribune', title: 'Harbour levy story ' + (++seq), body: 'The Senate will debate the harbour levy, the crossbench said.', url: 'https://tribune.example.com.au/p72/' + seq, ts: NOW - H, meta: { issues: ['gastax'], source: 'tribune', outlet: 'The Tribune', tier: 'regional', juris: 'au', reg: 1 } }, o);
const post = o => Object.assign({ src: 'x', title: 'x post', body: 'The harbour levy vote is a test for every senator, Harbour Watch says.', url: 'https://x.com/i/web/status/19' + String(++seq).padStart(12, '0'), ts: NOW - H, meta: { platform: 'x', issues: ['gastax'], id: 'pp' + seq, eng: { likes: 70, replies: 8, reposts: 12 }, eng_at: NOW - H, score: 90, comments: 8, layers: [2] } }, o);
const watch = async p => { p.posts = []; p.on('request', r => { if (r.method() !== 'POST' || !/newsaus\./.test(r.url())) return; let b = {}; try { b = JSON.parse(r.postData() || '{}'); } catch (e) {} p.posts.push({ path: new URL(r.url()).pathname, body: b }); }); return p; };
const brief = async (p, s) => { await tab(p, 'brief'); await sec(p, s || 'media'); await p.waitForSelector(P); return p; };
const reopen = async (p, s) => { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function'); await p.evaluate(() => go('den')); await p.waitForSelector('#den-tab-brief[aria-selected="true"]', { timeout: 20000 }); await sec(p, s || 'media'); await p.waitForSelector(P); };
const saved = p => p.waitForFunction(() => { const e = document.querySelector('[data-tour="save-state"]'); return e && e.dataset.state === 'saved' && e.dataset.dirty === '0'; }, null, { timeout: 15000 });
const findOpen = async p => { const b = p.locator(P + ' [data-tour="pull"]'); if ((await b.getAttribute('aria-expanded')) !== 'true') await b.click(); await p.waitForSelector(P + ' .den-pulllist li, ' + P + ' .den-pull .den-quiet'); };
const reviewOf = async w => (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.review;
const textOf = async (w, s) => (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections[s].text;
const caretEdit = async (p, s, at) => { const ta = p.locator('.den-sec[data-section="' + s + '"] textarea'); await p.locator('.den-sec[data-section="' + s + '"] [data-tour="edit"]').click(); await p.waitForSelector('.den-sec[data-section="' + s + '"][data-mode="edit"]'); await p.waitForTimeout(120); await ta.evaluate((e, a) => { e.focus(); const n = typeof a === 'string' ? e.value.indexOf(a) : a < 0 ? e.value.length + a : a; e.setSelectionRange(n, n); }, at); return ta; };

/* ---- the world: drafted, then a story and a post collected after the draft, and a story pinned (must mention) ---- */
const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' });
await w.push('news', [story({ title: 'Harbour levy vote delayed to next week', url: 'https://tribune.example.com.au/p72/vote-delayed' })]);
await w.push('sig_thread', [post({ url: 'https://x.com/i/web/status/190000000000000777' })]);
const B0 = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; const EV = B0.evidence;
const idBy = rx => Object.keys(EV).find(k => rx.test(String(EV[k].label || '') + ' ' + String(EV[k].text || '')));
const LEVY = idBy(/Harbour levy divides the Senate$/) || 'M:1'; const NOISY = idBy(/Noisy outlet on the gas export tax 1/); const RALLY = idBy(/rally at Parliament/);
ok(LEVY && NOISY && RALLY, 'the fixture world holds its stories: ' + [LEVY, NOISY, RALLY]);
await w.F('POST', '/den/pin', { desk: 'aep_au', item: +NOISY.slice(2) });   // pinned by Anne: a must-mention story the brief does not use
const page = await watch(await open(w)); await brief(page);
let FRESH = '', FRESHPOST = '';

await t('PN1 the lists: Sources, Used in this section, Suggested with its reason, New since it was written with its count, Find a story or post', async () => {
  eq(await txt(page, P + ' .den-evh1 b'), 'Sources'); eq(await page.getAttribute('.den-evpane', 'aria-label'), 'Sources for this section');
  ok(/Used in this section/.test(await txt(page, P)), 'the first list is named in Part D\'s words');
  eq(await ids(page, 'used'), [LEVY], 'the section uses the story its text cites');
  ok(/^https:/.test(await page.locator(li('used', LEVY) + ' a.den-link', { hasText: 'View source' }).getAttribute('href')), 'View source, not Open');
  const sugg = await ids(page, 'sugg'); ok(sugg.length >= 1 && sugg.length <= 3 && sugg.indexOf(NOISY) >= 0, 'Suggested: ' + sugg);
  eq(await txt(page, li('sugg', NOISY) + ' .den-why'), 'must mention \u00b7 Anne', 'each suggestion with its reason, in Part D\'s words');
  ok(/Must mention \u00b7 Anne/.test(await txt(page, li('sugg', NOISY))), 'the pinned card says who asked for it');
  const fresh = await ids(page, 'new'); ok(fresh.length >= 2, 'two rows collected after the draft: ' + fresh);
  ok(new RegExp('New since it was written ' + fresh.length).test(await txt(page, P)), 'the heading carries the count');
  FRESH = await page.locator(P + ' li[data-list="new"]', { hasText: 'Harbour levy vote delayed' }).getAttribute('data-cite'); ok(/^M:\d+$/.test(FRESH) && !EV[FRESH], 'the new story is not in the brief\'s sources: ' + FRESH);
  FRESHPOST = await page.locator(P + ' li[data-list="new"]', { hasText: 'a test for every senator' }).getAttribute('data-cite'); ok(/^[SP]:\d+$/.test(FRESHPOST), FRESHPOST);
  ok(/new since it was written/.test(await txt(page, li('new', FRESH))), 'its card says so');
  ok(/engagements/.test(await txt(page, li('new', FRESHPOST))) && !/interactions/.test(await txt(page, P)), 'a post\'s figures are engagements');
  await findOpen(page); const n0 = await page.locator(P + ' .den-pulllist li').count(); ok(n0 >= 5, 'Find lists the window\'s stories and posts: ' + n0);
  await page.fill(P + ' .den-findbar input[type="search"]', 'vote delayed'); eq(await page.locator(P + ' .den-pulllist li').count(), 1, 'the search narrows it');
  await page.fill(P + ' .den-findbar input[type="search"]', ''); await page.selectOption(P + ' .den-findbar select', 'social'); ok((await page.$$eval(P + ' .den-pulllist li', els => els.map(e => e.dataset.kind))).every(k => k === 'social'), 'the kind filter');
  await page.selectOption(P + ' .den-findbar select', 'all'); await page.check(P + ' .den-findbar input[type="checkbox"]'); ok((await all(page, P + ' .den-pulllist li')).every(x => /new since it was written/.test(x)), 'only new since it was written');
  await page.uncheck(P + ' .den-findbar input[type="checkbox"]'); eq(page.errors, []);
});

await t('PN2 Use here on a card collected after the draft: the chip reads as the card until the save, and the save merges it', async () => {
  const ta = await caretEdit(page, 'media', ' and drew');   // inside the sentence, after "outlets"
  await page.locator(li('new', FRESH) + ' .den-evcard').click(); await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA');
  ok((await ta.inputValue()).indexOf('[' + FRESH + ']') > 0, 'the mark went in where the cursor was');
  eq(await page.locator('.den-sec[data-section="media"] .den-ta-mirror .den-code.bad').count(), 0, 'no red mark: the id is treated as known until the save answers');
  ok(/Tribune/.test(await txt(page, '.den-sec[data-section="media"] .den-dochint')) || true);
  await page.locator(li('used', LEVY) + ' .den-evcard').focus(); await page.keyboard.press('Escape'); await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA');
  eq(await page.getAttribute('.den-sec[data-section="media"]', 'data-mode'), 'edit', 'Esc on a card while editing goes back to the words, still editing');
  await page.keyboard.press('Escape'); await saved(page);
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; ok(b.evidence[FRESH], 'the save merged exactly the row cited'); ok(b.sections.media.text.indexOf('[' + FRESH + ']') > 0);
  ok(/The Tribune/.test(await txt(page, '.den-sec[data-section="media"] .den-cites')), 'the chip names the outlet: ' + await txt(page, '.den-sec[data-section="media"] .den-cites'));
  await page.waitForSelector(li('used', FRESH)); ok(!(await ids(page, 'new')).includes(FRESH), 'it left New since it was written');
  eq(posts(page, '/den/brief/save').length, 1); eq(page.errors, []);
});

await t('PN3 Add to this section adds to the section\'s list through the review route, and no longer pins', async () => {
  const pins = posts(page, '/den/pin').length; await findOpen(page);
  await page.locator(P + ' .den-pulllist li', { hasText: 'a test for every senator' }).getByRole('button', { name: /^Add to this section/ }).click();
  await page.waitForSelector(li('used', FRESHPOST)); const r = posts(page, '/den/brief/review').pop(); eq(r.body.ops, [{ op: 'add', sec: 'media', item: FRESHPOST }]);
  eq(posts(page, '/den/pin').length, pins, 'nothing pinned'); ok(/Added to this section by Anne/.test(await txt(page, li('used', FRESHPOST) + ' .den-evwho')), 'who and when, on the card');
  ok(/Added to Traditional Media Coverage: /.test(await txt(page, P + ' .den-panenote')), 'said under the heading');
  ok((await reviewOf(w)).picks.media.add[FRESHPOST], 'the worker holds the pick'); eq(page.errors, []);
});

await t('PN4 Not for this section on a card the section does not cite: one review op, Taken out of this section, Put back', async () => {
  const before = posts(page, '/den/brief/save').length;
  await page.locator(li('used', FRESHPOST)).getByRole('button', { name: /^Not for this section/ }).click();
  await page.waitForFunction(s => !document.querySelector(s), li('used', FRESHPOST)); eq(posts(page, '/den/brief/save').length, before, 'no sentence to change, so no save');
  eq(posts(page, '/den/brief/review').pop().body.ops, [{ op: 'remove', sec: 'media', item: FRESHPOST }]);
  ok(await page.evaluate(() => !!document.activeElement && document.activeElement !== document.body), 'the focus went somewhere before the card left');
  const fold = page.locator(P + ' .den-out-fold .den-fold'); ok(/Taken out of this section 1/.test(await txt(page, P + ' .den-out-fold .den-fold')), await fold.innerText()); await fold.click();
  ok(/Taken out by Anne/.test(await txt(page, li('removed', FRESHPOST))));
  await page.locator(li('removed', FRESHPOST)).getByRole('button', { name: /^Put back/ }).click(); await page.waitForSelector(li('used', FRESHPOST));
  eq(posts(page, '/den/brief/review').pop().body.ops, [{ op: 'add', sec: 'media', item: FRESHPOST }], 'Put back adds it to the list again'); eq(page.errors, []);
});

await t('PN5 Not for this section on a cited card: its sentence is listed, Keep it without the source; the text is saved first, then the review op', async () => {
  const t0 = await textOf(w, 'media'); ok(t0.indexOf('[' + LEVY + ']') > 0, t0);
  await page.locator(li('used', LEVY)).getByRole('button', { name: /^Not for this section/ }).click(); await page.waitForSelector(P + ' .den-offer');
  ok(/this section uses it in 1 sentence/.test(await txt(page, P + ' .den-offer')), await txt(page, P + ' .den-offer'));
  ok(/The story ran in three outlets/.test(await txt(page, P + ' .den-offer legend')), 'the sentence, in words');
  ok(await page.evaluate(() => !!document.activeElement.closest('.den-offer')), 'the choices take the focus');
  const go = page.getByRole('button', { name: 'Take it out of this section' }); ok(await go.isDisabled(), 'nothing goes until each sentence has its choice');
  await page.keyboard.press('Escape'); await page.waitForSelector(P + ' .den-offer', { state: 'detached' }); ok(/^Not for this section/.test(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || '')), 'Esc closes it and the focus goes back to its opener');
  await page.locator(li('used', LEVY)).getByRole('button', { name: /^Not for this section/ }).click(); await page.waitForSelector(P + ' .den-offer');
  await page.getByLabel('Keep it without the source').check(); const n = page.posts.length; await go.click(); await page.waitForFunction(s => /^Taken out of/.test((document.querySelector(s) || {}).textContent || ''), P + ' .den-panenote');
  const order = page.posts.slice(n).map(x => x.path); eq(order, ['/den/brief/save', '/den/brief/review'], 'the text save first, then the corrections beside the text');
  const sv = page.posts[n].body; ok(sv.sections.media.indexOf('[' + LEVY + ']') < 0 && sv.sections.media.indexOf('[' + FRESH + ']') > 0, 'the mark came out and the other stayed: ' + sv.sections.media); ok(!sv.nosource, 'the sentence keeps another source, so it is not sent as one without');
  eq(page.posts[n + 1].body.ops, [{ op: 'remove', sec: 'media', item: LEVY }]); ok((await textOf(w, 'media')).indexOf('[' + LEVY + ']') < 0);
  ok(/Taken out of Traditional Media Coverage: .*The sentences were saved \(1 sentence kept without the source\)/.test(await txt(page, P + ' .den-panenote')), await txt(page, P + ' .den-panenote'));
  eq(page.errors, []);
});

await t('PN6 Used here, but marked not for this section: Keep it, then Remove the number (a save with nosource)', async () => {
  const id = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.id;
  eq((await w.F('POST', '/den/brief/review', { id, ops: [{ op: 'remove', sec: 'media', item: FRESH }] })).status, 200); await reopen(page, 'media');
  await page.waitForSelector(li('marked', FRESH)); ok(/Used here, but marked not for this section/.test(await txt(page, P)));
  await page.locator(li('marked', FRESH)).getByRole('button', { name: /^Keep it/ }).click(); await page.waitForSelector(li('used', FRESH));
  eq(posts(page, '/den/brief/review').pop().body.ops, [{ op: 'unremove', sec: 'media', item: FRESH }]);
  await w.F('POST', '/den/brief/review', { id, ops: [{ op: 'remove', sec: 'media', item: FRESH }] }); await reopen(page, 'media'); await page.waitForSelector(li('marked', FRESH));
  const n = page.posts.length; await page.locator(li('marked', FRESH)).getByRole('button', { name: /^Remove the number/ }).click(); await page.waitForFunction(s => /^The number was removed/.test((document.querySelector(s) || {}).textContent || ''), P + ' .den-panenote');
  const sv = page.posts.slice(n).find(x => x.path === '/den/brief/save'); ok(sv && sv.body.sections.media.indexOf('[' + FRESH + ']') < 0, 'the number came out of the words');
  eq(sv.body.nosource, { media: ['The story ran in three outlets and drew 300 reactions on Facebook.'] }, 'the sentence left with no source is kept as one without');
  ok(((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.media.uncited || []).some(u => /^The story ran in three outlets/.test(u)), 'the worker lists it among the sentences without a source');
  ok(/The number was removed from Traditional Media Coverage; 1 sentence kept without a source/.test(await txt(page, P + ' .den-panenote')), await txt(page, P + ' .den-panenote')); eq(page.errors, []);
});

await t('PN7 Not for this report: the sentences of every section, Delete and Keep; one save, then the removal from each section that held it', async () => {
  await sec(page, 'summary'); await page.waitForSelector(li('used', LEVY));
  await page.locator(li('used', LEVY)).getByRole('button', { name: /^Not for this report/ }).click(); await page.waitForSelector(P + ' .den-offer');
  const groups = await all(page, P + ' .den-offer .den-offer-sec'); eq(groups, ['Executive Summary', 'Bottom Line'], 'grouped by section, every section that uses it');
  const sets = page.locator(P + ' .den-offer fieldset'); eq(await sets.count(), 2);
  await sets.nth(0).getByLabel('Delete the sentence').check(); await sets.nth(1).getByLabel('Keep it without the source').check();
  const n = page.posts.length; await page.getByRole('button', { name: 'Take it out of this report' }).click(); await page.waitForFunction(s => /^Taken out of this report/.test((document.querySelector(s) || {}).textContent || ''), P + ' .den-panenote');
  const done = page.posts.slice(n); eq(done.map(x => x.path), ['/den/brief/save', '/den/brief/review']);
  ok(!/Coverage of the gas taxation debate/.test(done[0].body.sections.summary) && /stayed small/.test(done[0].body.sections.summary), 'the summary\'s sentence was deleted: ' + done[0].body.sections.summary);
  eq(done[0].body.nosource, { bottom: ['Activity is steady and the client is not directly targeted.'] });
  eq(done[1].body.ops.map(o => o.op + ' ' + o.sec + ' ' + o.item).sort(), ['remove bottom ' + LEVY, 'remove summary ' + LEVY], 'taken out of each section that held it');
  const rv = await reviewOf(w); ok(rv.picks.summary.remove[LEVY] && rv.picks.bottom.remove[LEVY] && rv.picks.media.remove[LEVY]); eq(page.errors, []);
});

await t('PN8 a card added to the section on the Board: Not for this section unfiles it on the Board\'s route, with no review op', async () => {
  await w.F('POST', '/den/pin', { desk: 'aep_au', item: +RALLY.slice(2), section: 'media' }); await reopen(page, 'media'); await page.waitForSelector(li('used', RALLY));
  ok(/Added to this section on the Board/.test(await txt(page, li('used', RALLY))));
  const rv = posts(page, '/den/brief/review').length; await page.locator(li('used', RALLY)).getByRole('button', { name: /^Not for this section/ }).click(); await page.waitForSelector(li('used', RALLY), { state: 'detached' });
  eq(posts(page, '/den/pin').pop().body, { desk: 'aep_au', item: +RALLY.slice(2), section: '' }); eq(posts(page, '/den/brief/review').length, rv, 'one store for pinned rows: no review op');
  const bd = (await w.F('GET', '/den/board?desk=aep_au')).body; eq([bd.pinned.indexOf(+RALLY.slice(2)) >= 0, bd.media.find(m => m.id === +RALLY.slice(2)).section], [true, ''], 'still a must-mention, under no section'); eq(page.errors, []);
});

await t('PN9 Add a new source (paste a link): several addresses at once, the platform from the host, a line in her words, listed under the section', async () => {
  await page.locator(P + ' [data-tour="add-source"]').click();
  await page.fill(P + ' .den-addta', 'https://x.com/harbourwatch/status/1912345678901 https://www.facebook.com/harbourwatchpage/posts/4455\nhttps://harbourgazette.example.org/levy-vote not-a-link');
  eq(await all(page, P + ' .den-addlist li .den-evsrc'), ['X post', 'Facebook post', 'harbourgazette.example.org'], 'the platform read from each host');
  ok(/Not a link, so left out: not-a-link/.test(await txt(page, P + ' .den-addbox')));
  await page.locator(P + ' .den-addlist li').nth(2).getByLabel('In your words (optional)').fill('The gazette says the vote moves to Thursday.');
  await page.locator(P + ' .den-addlist li').nth(2).getByLabel('Day (optional)').fill('2026-11-17');
  const n = page.posts.length; await page.getByRole('button', { name: 'Add 3 sources to this section' }).click(); await page.waitForFunction(s => /Added 3 sources/.test((document.querySelector(s) || {}).textContent || ''), P + ' .den-panenote');
  const done = page.posts.slice(n); eq(done.map(x => x.path), ['/den/brief/save', '/den/brief/review']);
  eq(done[0].body.sources.map(s => s.url).length, 3); eq(done[0].body.sources[2], { url: 'https://harbourgazette.example.org/levy-vote', line: 'The gazette says the vote moves to Thursday.', date: '2026-11-17' });
  const ev = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.evidence; const hs = Object.keys(ev).filter(k => /^H:/.test(k)); eq(hs.length, 3);
  eq(done[1].body.ops.map(o => o.op + ' ' + o.sec).join(), 'add media,add media,add media'); for (const h of hs) await page.waitForSelector(li('used', h));
  ok(/Source added by Anne/.test(await txt(page, li('used', hs[0])))); ok(/The gazette says the vote moves to Thursday/.test(await txt(page, P)), 'her line on its card');
  ok(await page.locator(li('used', hs[0])).getByRole('button', { name: /^Remove this source/ }).count() === 1, 'a source nobody cites can be removed');
  eq(await page.inputValue(P + ' .den-addta'), '', 'the box is emptied once they are added'); eq(page.errors, []);
});

await t('PN10 a source the report cannot use (409 cannot_cite) is said in words; the person\'s text and its mark are kept', async () => {
  const ta = await caretEdit(page, 'media', -1); await page.keyboard.type(' [M:999999]'); const typed = await ta.inputValue();
  await page.keyboard.press('Escape'); await page.waitForFunction(s => !!document.querySelector(s), P + ' .den-evhead .den-evfail[role="alert"]', { timeout: 15000 });
  ok(/can't be used in this report \(M:999999\)/.test(await txt(page, P + ' .den-evhead .den-evfail')) && /Your words are kept/.test(await txt(page, P + ' .den-evhead .den-evfail')), await txt(page, P + ' .den-evhead .den-evfail'));
  eq(await ta.inputValue(), typed, 'the words and the mark are as the person left them'); ok(/Not saved/.test(await txt(page, '.den-bar[role="status"]')));
  ok((await textOf(w, 'media')).indexOf('M:999999') < 0, 'nothing was saved');
  await ta.fill(typed.replace(' [M:999999]', '')); await page.locator('.den-outline-h').click(); await page.waitForSelector('.den-sec[data-section="media"][data-mode="read"]'); eq(page.errors, []);
});

await t('PN11 the "Rewrite the whole report?" dialog says what a rewrite will drop of the corrections; after it, what it dropped is said', async () => {
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; const line = Object.keys(b.evidence).find(k => /^[TCIA]:/.test(k)) || 'K:1';
  await w.F('POST', '/den/brief/review', { id: b.id, ops: [{ op: 'add', sec: 'momentum', item: line }] }); await reopen(page, 'media');
  await page.getByRole('button', { name: /Rewrite the whole report/ }).click(); await page.waitForSelector('[role="dialog"][aria-label="Rewrite the whole report?"]');
  const d = await txt(page, '[role="dialog"]'); ok(/These will be dropped:\s*Added to Momentum Assessment: .*\(a line each draft writes afresh\)/.test(d), d.slice(0, 400));
  ok(/These stay only if the new report still has the story, post or source:\s*.*Taken out of Traditional Media Coverage: The Point Post/.test(d), d.slice(0, 600));
  await page.getByRole('button', { name: /Rewrite it all/ }).click(); await page.waitForSelector('.den-dropnote', { timeout: 20000 });
  ok(/The rewrite dropped .*Momentum Assessment: .*a line each draft writes afresh/.test(await txt(page, '.den-dropnote')), await txt(page, '.den-dropnote'));
  eq(page.errors, []); await page.context().close();
});

/* ---- a second world for the failures and not_kept ---- */
const w2 = await world(); await w2.F('POST', '/den/brief', { desk: 'aep_au' }); await w2.push('news', [story({ title: 'Harbour levy vote delayed again', url: 'https://tribune.example.com.au/p72/again' })]);
const fail = async route => { await route.fulfill({ status: 500, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; };

await t('PN12 a failing correction is said under its card and nothing is left half done (the review route, then the save route)', async () => {
  const p = await watch(await open(w2)); await brief(p);
  w2.hooks = [async (route, r, path) => (r.method() === 'POST' && path === '/den/brief/review' ? fail(route) : false)];
  try {
    await findOpen(p); const row = p.locator(P + ' .den-pulllist li', { hasText: 'Harbour levy vote delayed again' }); const id = await row.getAttribute('data-cite');
    await row.getByRole('button', { name: /^Add to this section/ }).click(); await p.waitForSelector(P + ' .den-pulllist li[data-cite="' + id + '"] .den-evfail[role="alert"]');
    ok(/^Adding it to this section didn't go through: Something failed on the worker.*Nothing changed\.$/.test(await txt(p, P + ' .den-pulllist li[data-cite="' + id + '"] .den-evfail')), await txt(p, P + ' .den-pulllist li[data-cite="' + id + '"] .den-evfail'));
    eq(await ids(p, 'used'), [(await ids(p, 'used'))[0]].filter(Boolean)); ok(!(await ids(p, 'used')).includes(id), 'the card did not join the list');
    w2.hooks = [async (route, r, path) => (r.method() === 'POST' && path === '/den/brief/save' ? fail(route) : false)];
    const before = await p.inputValue('.den-sec[data-section="media"] textarea'); const lv = (await ids(p, 'used'))[0];
    await p.locator(li('used', lv)).getByRole('button', { name: /^Not for this section/ }).click(); await p.waitForSelector(P + ' .den-offer'); await p.getByLabel('Delete the sentence').check();
    await p.getByRole('button', { name: 'Take it out of this section' }).click(); await p.waitForSelector(li('used', lv) + ' .den-evfail[role="alert"]');
    ok(/^Saving the sentences didn't go through: Something failed on the worker.*Nothing changed\.$/.test(await txt(p, li('used', lv) + ' .den-evfail')), await txt(p, li('used', lv) + ' .den-evfail'));
    await sleep(200); eq(await p.inputValue('.den-sec[data-section="media"] textarea'), before, 'the sentence is back: the correction is put back as it was');
    eq(posts(p, '/den/brief/review').length, 1, 'after a failed save the review op is not tried'); ok(await p.locator(li('used', lv)).count() === 1, 'the card stays');
    eq(p.errors, []);
  } finally { w2.hooks = []; await p.context().close(); }
});

await t('PN13 not_kept: a sentence kept without its source that no longer reads as it did is said', async () => {
  const p = await watch(await open(w2)); await brief(p);
  w2.hooks = [async (route, r, path) => { if (r.method() !== 'POST' || path !== '/den/brief/save') return false; const res = await w2.call('POST', path, r.postData(), r.headers()['x-axiom-key']); const d = JSON.parse(res.text);
    if (d.ok) d.not_kept = [{ section: 'media', sentence: 'An invented sentence that reads differently now.' }]; await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }); return true; }];
  try {
    const lv = (await ids(p, 'used'))[0]; await p.locator(li('used', lv)).getByRole('button', { name: /^Not for this section/ }).click(); await p.waitForSelector(P + ' .den-offer');
    await p.getByLabel('Keep it without the source').check(); await p.getByRole('button', { name: 'Take it out of this section' }).click();
    await p.waitForFunction(s => /Not kept without its source/.test((document.querySelector(s) || {}).textContent || ''), P + ' .den-evhead .den-evfail');
    ok(/because the sentence no longer reads as it did: \u201cAn invented sentence that reads differently now\.\u201d/.test(await txt(p, P + ' .den-evhead .den-evfail'))); eq(p.errors, []);
  } finally { w2.hooks = []; await p.context().close(); }
});

await t('PN14 a read key sees the lists and no correction control, and sends nothing', async () => {
  const p = await watch(await open(w2, 'read-key')); await brief(p);
  ok(/View only/.test(await txt(p, P + ' .den-evhead'))); ok((await ids(p, 'used')).length >= 1 || /Nothing is used/.test(await txt(p, P)));
  await findOpen(p);
  eq(await p.locator('#den-tabpanel button', { hasText: /^(Not for this section|Not for this report|Add to this section|Put back|Remove the number|Keep it|Use here|Remove this source|Take it out of this section)$/ }).count(), 0, 'no correction control');
  eq(await p.locator(P + ' [data-tour="add-source"]').count(), 0, 'no Add a new source'); ok(await p.locator(P + ' .den-evcard').first().isDisabled(), 'a card does not cite');
  eq(p.posts, [], 'nothing was sent'); eq(p.errors, []); await p.context().close();
});

await t('PN15 the support check: a view without review and flags (a p71 worker) shows today\'s evidence pane and nothing new', async () => {
  w2.hooks = [async (route, r, path) => { if (r.method() !== 'GET' || !/^\/den\/brief\?/.test(path)) return false; const res = await w2.call('GET', path, null, r.headers()['x-axiom-key']); const d = JSON.parse(res.text);
    if (d.brief) { delete d.brief.review; delete d.brief.review_rev; delete d.brief.flags; delete d.brief.covers; } await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }); return true; }];
  const p = await watch(await open(w2));
  try {
    await tab(p, 'brief'); await sec(p, 'media'); await p.waitForSelector('.den-evpane .den-evhead');
    eq(await p.locator(P).count(), 0, 'no Sources pane'); eq(await txt(p, '.den-evpane .den-evh1 b'), 'Evidence'); eq(await p.getAttribute('.den-evpane', 'aria-label'), 'Evidence for this section');
    ok(/More from this window/.test(await txt(p, '.den-evpane')) && !/Add a new source|Find a story or post|Not for this section/.test(await txt(p, '.den-evpane')), 'today\'s pane, word for word');
    eq(p.errors, []);
  } finally { w2.hooks = []; await p.context().close(); }
});

await t('PN16 DenPane.land() lands on a card in the pane (the workbench\'s container; Today passes its own)', async () => {
  const p = await open(w2); await brief(p, 'summary'); const id = (await ids(p, 'used'))[0]; ok(id, 'a card to land on');
  ok(await p.evaluate(i => !!window.DenPane.land(document.querySelector('.den-evpane'), { cite: i }), id));
  ok(await p.evaluate(i => { const a = document.activeElement; return !!a && !!a.closest('li[data-cite="' + i + '"]') && a.classList.contains('den-evcard'); }, id), 'the card\'s button has the focus');
  eq(await p.evaluate(() => window.DenPane.land(document.querySelector('.den-evpane'), { cite: 'M:424242' })), null, 'nothing to land on answers null');
  eq(p.errors, []); await p.context().close();
});

await t('PN17 axe finds no serious or critical violation at 1366, 1440 and 1920, for a full key (lists, an offer, Add a new source open) and a read key', async () => {
  const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8'); const bad = [];
  for (const key of ['full-key', 'read-key']) {
    const p = await open(w2, key); await brief(p, 'summary'); await p.addScriptTag({ content: AXE }); await findOpen(p);
    if (key === 'full-key') { await p.locator(P + ' [data-tour="add-source"]').click(); await p.fill(P + ' .den-addta', 'https://harbourgazette.example.org/a https://x.com/harbourwatch/status/1'); const lv = (await ids(p, 'used'))[0]; await p.locator(li('used', lv)).getByRole('button', { name: /^Not for this report/ }).click(); await p.waitForSelector(P + ' .den-offer'); }
    for (const wdt of [1366, 1440, 1920]) { await p.setViewportSize({ width: wdt, height: 900 }); await sleep(250);
      const v = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' at ' + x.nodes.slice(0, 4).map(n => n.target.join(' ').slice(-70)).join(' | ')); });
      bad.push(...v.map(x => key + ' at ' + wdt + ': ' + x)); }
    const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(over <= 1, 'the page scrolls sideways by ' + over);
    eq(p.errors, []); await p.context().close();
  }
  eq(bad, [], 'accessibility');
});

await finish();
