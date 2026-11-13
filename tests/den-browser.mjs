/* Anne's Den in a real browser (prompts/annes-den.md Phase 6): the page served from docs/, its worker calls routed into
 * the worker module in this process (SQLite behind the D1 API), the model a stub that writes from the evidence it is
 * sent. Nothing is contacted and nothing is spent. Every outlet, account and post here is invented.
 *   the day's journey: open a desk, read the strip, pin and set aside, mute, collect now with the console, draft, edit,
 *   regenerate a section, see the uncited warning, a conflict with another person, mark as filed, copy and download;
 *   then the keyboard, the Watch tab, Options, a read-only key, the empty and error states, a paused platform, a dropped
 *   connection mid-draft, and a reload with unsaved edits.
 * Run: node --experimental-sqlite tests/den-browser.mjs   (SHOT=1 saves screenshots to tests/shots/den/) */
import fs from 'node:fs';
import { world, open, browser, t, ok, eq, txt, all, tab, toast, shot, panel, finish, H, D, NOW, CARD, cards, checks, sec, exportItem } from './den-fixture.mjs';

console.log('den-browser harness');
const w = await world(); let page = await open(w);

await t('the Den opens from the navigation on a desk, in Australian Eastern time, with nothing spent', async () => {
  ok(await page.$('.rbtn[data-v="den"][aria-current="page"]'), 'the navigation button is current'); eq(await page.title() !== '', true); ok(/Anne's Den/.test(await txt(page, '#vtitle')));
  eq(await all(page, '.den-head select[aria-label="Desk"] option'), ['AEP national', 'AEP Victoria', 'Firearms', 'MCA national', 'MCA Victoria']);
  ok(/daily, the last 24 hours - Australian Eastern time/.test(await txt(page, '.den-win'))); ok(/model calls today: 0 of 20/.test(await txt(page, '.den-head')) && !(await page.$('.den-head .den-chip.warn')));
  eq(await all(page, '.den-tabs[aria-label="Anne\'s Den"] .den-tab'), ['Board', 'Brief', 'Watch', 'Collection', 'Options']); eq(w.calls.length, 0);
});
await t('the strip says what should not be missed, gaps first, and opens the evidence', async () => {
  // the strip is the rail of six checks: a pill for each, the gaps first, and a pill opens its findings with the one action
  eq(await page.$$eval('.den-strip li', e => e.map(x => x.dataset.sig)), ['gap', 'spike', 'emerging', 'outlier', 'first_seen', 'burst'], 'six checks, gaps first');
  const lines = await checks(page); ok(/Not collected.*Facebook delivered nothing in this window/.test(lines[0]) && /not granted/.test(lines[0]) && /No signed-in collector is connected/.test(lines[0]), lines[0]);
  ok(lines.some(l => /Spike.*Sentinel spike: Gas taxation.*3\.1 times/.test(l)), lines.join(' | '));
  await page.click('.den-strip li:first-child button.den-check'); await page.waitForSelector('.den-pop'); ok(/computed, no model/.test(await txt(page, '.den-pop header'))); eq(await page.getAttribute('.den-strip li:first-child button.den-check', 'aria-expanded'), 'true');
  await page.click('.den-pop li:first-child button.den-link'); ok(await page.$('#den-tab-collection[aria-selected="true"]'), 'a gap opens Collection'); ok(!(await page.$('.den-pop')), 'and the popover closes'); await tab(page, 'today');
  ok(/4 to read/.test(await txt(page, '.den-strip-h')) && (await page.getAttribute('.den-strip li[data-sig="gap"] button', 'data-n')) === '1', 'closed, the rail still says how many and that a channel was not read');
  await page.waitForSelector('.den-gapline'); ok(/Facebook delivered nothing in this window\. ?Not a quiet day/.test(await txt(page, '.den-gapline')), 'and the gap is said on the Board itself, not behind a click');
  await page.locator('.den-strip li[data-sig="spike"] button').focus(); await page.keyboard.press('Enter'); await page.waitForSelector('.den-pop'); await page.keyboard.press('Escape'); await page.waitForSelector('.den-pop', { state: 'detached' }); eq(await page.evaluate(() => document.activeElement.closest('li').dataset.sig), 'spike', 'Escape closes a check and the focus goes back to its pill');
});
await t('the Board holds the window as cards: folded copies, the subscriber mark, reach, actors apart, a dated action, a column for each section', async () => {
  // the five tables are cards now (one .den-row[data-kind] each); what each row says is asserted as before
  await page.waitForSelector(CARD('media'));
  const media = await all(page, CARD('media')); ok(media.some(r => /pointpost ?regional.*Harbour levy divides the Senate ?also in The Tribune.*362 on Facebook ?2 outlets/.test(r)), media.join(' // '));
  ok(media.some(r => /Producers answer the windfall tax push.*subscriber/.test(r)), 'the subscriber mark: ' + media.join(' // ')); ok(/8 stories, 7 after folding copies/.test(await txt(page, '.den-unsorted')));
  const soc = await all(page, CARD('social')); eq(soc.length, 1); ok(/X ?L2.*55 interactions/.test(soc[0]), soc[0]);
  const act = await all(page, CARD('actors')); ok(act.length === 1 && /X.*Harbour Watch ?organisation ?Our position on the gas export tax, in full\..*90 interactions/.test(act[0]), act[0]);
  const upc = await all(page, CARD('upcoming')); ok(upc.length === 1 && /-12-28.*rally.*Parliament on 28 December/.test(upc[0]), upc[0]);
  ok(/Narratives: none\. No narrative on this desk's issues gained rows/.test(await txt(page, '.den-none [data-none="narratives"]')), 'a kind with no row says why');
  eq(await page.$$eval('.den-board .den-col', c => c.map(x => x.getAttribute('aria-label'))), ['Unsorted', 'Executive Summary', 'Key Narratives', 'Traditional Media Coverage', 'Social Media Activity', 'Influencer and Political Activity', 'Sentiment and Tone', 'Momentum Assessment', 'Risks and Implications', 'Bottom Line', 'Recommended Posture', 'Source List'], 'a column for each section of this desk, from its own sections');
  ok(/Weight \d+ of 99: .*362 on Facebook, 2 outlets/.test(await page.locator(CARD('media'), { hasText: 'Harbour levy' }).locator('.den-w').getAttribute('title')), 'a card says why it weighs what it does');
  ok(/Empty/.test(await txt(page, '.den-col[data-sec="summary"] .den-col-meta')) && /check uncovered/.test(await txt(page, '.den-board')), 'a column says its state and the checks it has not covered'); await shot(page, '01-today');
});
await t('pin a row, set rows aside with a reason, and confirm the mute that is offered after three', async () => {
  const row = cards(page, 'media').filter({ hasText: 'Producers answer' });
  await row.getByRole('button', { name: 'Pin' }).click(); await page.waitForSelector(CARD('media') + '.pinned');
  ok(/Producers answer/.test((await all(page, CARD()))[0]), 'the pinned story leads the Unsorted column'); eq(await page.locator('.den-row.pinned button[aria-pressed="true"]').count(), 1);
  for (let i = 1; i <= 3; i++) { const r = cards(page, 'media').filter({ hasText: 'Noisy outlet on the gas export tax ' + i }); await r.getByRole('button', { name: 'Set aside' }).click(); if (i === 2) await r.locator('select[aria-label="Why it is set aside"]').selectOption('duplicate'); await r.getByRole('button', { name: 'Set aside' }).click(); await page.waitForFunction(n => !Array.from(document.querySelectorAll('.den-row[data-kind="media"]')).some(x => x.textContent.indexOf('Noisy outlet on the gas export tax ' + n) >= 0), i); }
  await page.waitForSelector('.den-notice[role="alert"]'); ok(/You have set aside 3 rows from noisy\.example\.com on this desk\. Mute it here\?/.test(await txt(page, '.den-notice[role="alert"]')));
  ok(/3 set aside and not shown/.test(await txt(page, '#den-tabpanel')), 'set aside is counted');
  await page.getByRole('button', { name: /Show what was set aside/ }).click(); await page.waitForSelector('.den-aside-row'); eq((await all(page, '.den-aside-row')).map(r => /Noisy outlet.*(not relevant|duplicate) ?by Anne/.test(r)), [true, true, true]);
  ok((await all(page, CARD('media'))).some(r => /Noisy outlet on the gas export tax 4/.test(r)), 'the offer changed nothing: the fourth is still on the board');
  await page.getByRole('button', { name: 'Mute it on this desk' }).click(); await page.waitForFunction(() => /4 muted and not shown/.test(document.querySelector('#den-tabpanel').textContent));
  ok(!(await all(page, CARD('media'))).some(r => /Noisy/.test(r)), 'muted, the site\'s rows are gone from the board and counted');
});
await t('the keyboard: rows, pin, tabs, and the sheet that returns the focus', async () => {
  const at = () => page.evaluate(() => Array.from(document.querySelectorAll('.den-board .den-row')).indexOf(document.activeElement));
  await page.locator('#den-tabpanel').click({ position: { x: 5, y: 5 } }); await cards(page).first().focus(); await page.keyboard.press('j'); eq(await at(), 1, 'j moves to the next card');
  await cards(page, 'media').filter({ hasText: 'Harbour levy' }).focus(); const here = await at(); await page.keyboard.press('k'); eq(await at(), here - 1, 'k moves back'); await page.keyboard.press('j'); ok(/Harbour levy/.test(await page.evaluate(() => document.activeElement.textContent)), 'and j returns to the story');
  await page.keyboard.press('p'); await page.waitForFunction(() => document.querySelectorAll('.den-board .den-row.pinned').length === 2); await page.keyboard.press('k'); eq(await page.evaluate(() => Array.from(document.querySelectorAll('.den-board .den-row')).indexOf(document.activeElement)) >= 0, true, 'the focus stays on a card after the pin redraws the board');
  await page.keyboard.press('Alt+2'); ok(await page.$('#den-tab-brief[aria-selected="true"]'), 'Alt+2 opens Brief'); await page.keyboard.press('Alt+1'); ok(await page.$('#den-tab-today[aria-selected="true"]'));
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).focus(); await page.keyboard.press('Enter'); await page.waitForSelector('[role="dialog"][aria-label="Keyboard"]'); ok(/Pin the row to the report/.test(await txt(page, '[role="dialog"]')));
  await page.keyboard.press('Escape'); await page.waitForSelector('[role="dialog"]', { state: 'detached' }); eq(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Keyboard shortcuts', 'the focus goes back where it was');
});
await t('Collect now starts a job and shows it working; a platform switched off cannot be collected', async () => {
  await tab(page, 'collection'); await page.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); const rows = await all(page, 'section.den-panel[aria-label="Channels"] tr.den-row');
  ok(/^News and official sources \| .*\| from the worker \|/.test(rows[0]) && rows.some(r => /^X ?1 registered account \| .*\| from the worker only \|/.test(r)) && rows.some(r => /^Facebook ?1 registered account \| .*not granted.*Cannot reach: Comment text.*\| no collector \|/.test(r)), rows.slice(0, 3).join(' // ')); ok(/No Mac collector is connected/.test(await txt(page, '.den-notice')));
  await panel(page, 'Channels').locator('tr.den-row', { hasText: 'Bluesky' }).getByRole('button', { name: 'Collect now' }).click(); await page.waitForSelector('#den-root .sig-con', { timeout: 15000 }); await w.settle(); ok(/Bluesky/.test(await txt(page, '#den-root .sig-conhead')));
  ok(page.served.some(s => /^POST \/den\/collect/.test(s)) && page.served.some(s => /^GET \/bridge\/job\?id=/.test(s)), 'the console tails the job');
  const sw = panel(page, 'Signed-in collection').locator('tr', { hasText: 'Facebook' }); await sw.getByRole('button', { name: 'Switch off' }).click(); await page.waitForFunction(() => /off/.test(Array.from(document.querySelectorAll('section.den-panel[aria-label="Signed-in collection"] tr')).find(r => /Facebook/.test(r.textContent)).querySelector('.den-chip').textContent));
  const fb = panel(page, 'Channels').locator('tr.den-row', { hasText: 'Facebook' }); ok(/switched off/.test(await fb.textContent())); ok(await fb.getByRole('button', { name: 'Collect now' }).isDisabled(), 'no collecting while it is off');
  await sw.getByRole('button', { name: 'Switch on' }).click(); ok(/Not measured yet/.test(await txt(page, 'section.den-panel[aria-label="Recall against the reports"]')) && /den-backtest\.py/.test(await txt(page, 'section.den-panel[aria-label="Recall against the reports"]')));
  ok(/AFR|Australian Financial/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]')) && /headlines only/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]'))); await shot(page, '02-collection');
});
await t('a draft states its cost first, is one call, and comes back checked against its rows', async () => {
  await tab(page, 'brief'); await page.waitForSelector('#den-tabpanel .den-state'); const empty = await txt(page, '#den-tabpanel'); ok(/No brief has been started for this window/.test(empty) && /Draft the brief \(1 model call\)/.test(empty) && /One model call \(a second only if the first answer cannot be read\)\. 20 of 20 left today/.test(empty), empty.slice(0, 300));
  await page.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await page.waitForSelector('.den-sec[data-section="summary"] textarea'); eq(w.calls.length, 1);
  ok(/^Coverage of the gas taxation debate/.test(await page.inputValue('.den-sec[data-section="summary"] textarea'))); ok(/drafted/.test(await txt(page, '.den-sec[data-section="summary"] h4')));
  eq(await txt(page, '.den-sec[data-section="summary"] .den-flag'), 'No evidence behind: A campaigner named Sam Private is behind it.', 'the sentence that rested on an invented row is marked, at the sentence'); ok(/1 without evidence/.test(await txt(page, '.den-bar[role="status"]')));
  eq(await all(page, '.den-sec[data-section="summary"] .den-cites a'), ['pointpost', 'X post'], 'a citation reads as the outlet or the channel, not a bare id');
  ok((await page.inputValue('.den-sec[data-section="summary"] textarea')).indexOf('M:999999') < 0, 'and the invented citation is gone'); eq(await page.$$eval('.den-sec[data-section="summary"] .den-cites a', a => a.map(x => /^https:/.test(x.href))), [true, true]);
  const mo = await sec(page, 'momentum'); eq(await mo.locator('.den-bar select').first().inputValue(), 'Moderate', 'the rating sits in the section it rates'); eq(await page.inputValue('#den-tabpanel .den-bar select[aria-label="Momentum trend"]'), 'Stable'); await sec(page, 'summary'); ok(/Draft/.test(await txt(page, 'section.den-panel header .den-chip.warn')) && /revision 1/.test(await txt(page, 'section.den-panel header')));
  ok(/Traditional media.*pointpost - Harbour levy divides the Senate/.test(await txt(page, '.den-sec:has(h4:has-text("Source List"))')) && /built from the citations/.test(await txt(page, '.den-sec:has(h4:has-text("Source List"))')));
  await page.waitForFunction(() => /model calls today: 1 of 20/.test(document.querySelector('.den-head').textContent)); await shot(page, '03-brief-draft');
});
await t('an edit is kept on this computer at once, saved on leaving the field, and marked as a person\'s', async () => {
  const ta = (await sec(page, 'bottom')).locator('textarea'); await ta.fill('Anne\'s own bottom line.');   // the brief shows one section at a time: the outline opens it
  ok(/Unsaved changes \(kept on this computer\)/.test(await txt(page, '.den-bar[role="status"]')) && /not saved/.test(await txt(page, '.den-sec[data-section="bottom"] h4')));
  ok(await page.getByRole('button', { name: 'Mark as filed' }).isDisabled() && await page.getByRole('button', { name: /Draft again/ }).isDisabled(), 'no filing or redrafting over unsaved words');
  await sec(page, 'summary'); await page.waitForFunction(() => /Saved, revision 2/.test(document.querySelector('.den-bar[role="status"]').textContent));   // leaving the field for another section saves it
  ok(/edited by Anne/.test(await txt(page, '.den-sec[data-section="bottom"] h4'))); ok(/Edited/.test(await txt(page, '.den-outline [data-goto="bottom"]')), 'and the outline says so'); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.bottom.text, 'Anne\'s own bottom line.');
});
await t('words typed in another section while a save is in flight are not lost when it returns', async () => {
  let slow = true; w.hooks.push(async (route, r, path) => { if (slow && r.method() === 'POST' && path === '/den/brief/save') await new Promise(x => setTimeout(x, 900)); return false; });
  await (await sec(page, 'posture')).locator('textarea').fill('The client should hold its position.'); await sec(page, 'media');   // leaving the field starts the save
  await page.locator('.den-sec[data-section="media"] textarea').fill('Typed while the other section was saving.'); await page.waitForFunction(() => /edited by Anne/.test(document.querySelector('.den-sec[data-section="posture"] h4').textContent), null, { timeout: 15000 });
  eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed while the other section was saving.', 'the save that returned dropped what was typed meanwhile'); ok(/not saved/.test(await txt(page, '.den-sec[data-section="media"] h4')) && /Unsaved changes/.test(await txt(page, '.den-bar[role="status"]')));
  slow = false; w.hooks.length = 0; await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => /Saved, revision/.test(document.querySelector('.den-bar[role="status"]').textContent));
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; eq([b.sections.posture.text, b.sections.media.text], ['The client should hold its position.', 'Typed while the other section was saving.']);
  await page.locator('.den-sec[data-section="media"] textarea').fill('The story ran in three outlets and drew 300 reactions on Facebook [' + b.sections.summary.cites[0] + '].'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => !/Unsaved changes|Saving/.test(document.querySelector('.den-bar[role="status"]').textContent));
});
await t('regenerating one section is one stated call and never touches a person\'s edit unasked', async () => {
  const bl = await sec(page, 'bottom'); await bl.getByRole('button', { name: 'Regenerate this section' }).click(); ok(/This replaces Anne's edit\./.test(await bl.textContent()) && /Write it again \(1 model call\)/.test(await bl.textContent()));
  await bl.getByRole('button', { name: 'Cancel' }).click(); eq(w.calls.length, 1, 'asking costs nothing');
  await bl.getByRole('button', { name: 'Regenerate this section' }).click(); await bl.locator('input').fill('Shorter.'); await bl.getByRole('button', { name: 'Write it again (1 model call)' }).click();
  await page.waitForFunction(() => /^Written again, shorter/.test(document.querySelector('.den-sec[data-section="bottom"] textarea').value)); eq(w.calls.length, 2); ok(/THE ANALYST ASKS, FOR THIS SECTION: Shorter\./.test(w.calls[1].messages[0].content));
  ok(/^Coverage of the gas taxation debate/.test(await page.inputValue('.den-sec[data-section="summary"] textarea')), 'the other sections are as they were');
});
await t('unsaved words survive a reload and are offered back', async () => {
  await (await sec(page, 'media')).locator('textarea').fill('Typed and not yet saved.'); await page.waitForFunction(() => Object.keys(localStorage).some(k => /^ax_den_work_/.test(k)));
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof go === 'function'); await page.evaluate(() => go('den')); await page.waitForSelector('.den-sec[data-section="media"] textarea');
  eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed and not yet saved.'); ok(/Your unsaved words from .* were kept on this computer and are back in the editor/.test(await txt(page, '.den-notice[role="status"]')));
  ok(await page.$('#den-tab-brief[aria-selected="true"]'), 'and the tab is where it was'); ok(await page.locator('.den-sec[data-section="media"]').isVisible(), 'and so is the section that was open');
});
await t('someone else saved first: nothing is overwritten, and the choice is Keep mine or Take theirs', async () => {
  const cur = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; await w.F('POST', '/den/brief/save', { id: cur.id, revision: cur.revision, sections: { posture: 'Kai\'s posture line.' } }, 'other-key');
  await page.getByRole('button', { name: 'Save them' }).click(); await page.waitForSelector('.den-notice.bad[role="alert"]'); const n = await txt(page, '.den-notice.bad[role="alert"]'); ok(/Kai saved this brief after you opened it/.test(n) && /nothing was overwritten/.test(n), n);
  eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed and not yet saved.', 'my words are still in the editor'); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.posture.text, 'Kai\'s posture line.');
  await page.getByRole('button', { name: 'Keep mine' }).click(); await page.waitForFunction(() => document.querySelector('.den-sec[data-section="posture"] textarea').value === 'Kai\'s posture line.'); eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed and not yet saved.', 'mine in my section, theirs in theirs');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => /Saved, revision/.test(document.querySelector('.den-bar[role="status"]').textContent)); const after = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; eq([after.sections.media.text, after.sections.posture.text], ['Typed and not yet saved.', 'Kai\'s posture line.']);
  await w.F('POST', '/den/brief/save', { id: after.id, revision: after.revision, sections: { posture: 'Kai again.' } }, 'other-key'); await page.locator('.den-sec[data-section="media"] textarea').fill('Mine, to be dropped.'); await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForSelector('.den-notice.bad[role="alert"]'); await page.getByRole('button', { name: 'Take theirs' }).click(); await page.waitForFunction(() => document.querySelector('.den-sec[data-section="posture"] textarea').value === 'Kai again.'); eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed and not yet saved.', 'theirs is what they last saved');
});
await t('copy and download: the document, Markdown, HTML and the Slack summary', async () => {
  const [dl] = await Promise.all([page.waitForEvent('download'), (await exportItem(page, 'Download .md')).click()]); ok(/^aep_au-\d{4}-\d\d-\d\d-draft\.md$/.test(dl.suggestedFilename()), dl.suggestedFilename()); const md = fs.readFileSync(await dl.path(), 'utf8'); ok(/^# .* - AEP national/.test(md) && /## Executive Summary/.test(md) && /## Source List/.test(md) && /DRAFT/.test(md));
  const [dh] = await Promise.all([page.waitForEvent('download'), (await exportItem(page, 'Download .html')).click()]); ok(/-draft\.html$/.test(dh.suggestedFilename()) && /<h2>Executive Summary<\/h2>/.test(fs.readFileSync(await dh.path(), 'utf8')));
  const until = async (fn, what) => { for (let i = 0; i < 50; i++) { const v = await fn(); if (v) return v; await page.waitForTimeout(100); } throw new Error('never happened: ' + what); };
  await (await exportItem(page, 'Copy the Slack summary')).click(); const slack = await until(async () => { const s = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')); return /Bottom line/.test(s) ? s : ''; }, 'the Slack summary on the clipboard'); ok(/\(draft\)/.test(slack) && !/\[M:/.test(slack));
  await (await exportItem(page, 'Copy for the document')).click();
  const rich = await until(() => page.evaluate(async () => { try { const it = await navigator.clipboard.read(); const h = it.find(i => i.types.indexOf('text/html') >= 0); return h ? (await (await h.getType('text/html')).text()) : ''; } catch (e) { return ''; } }), 'formatted text on the clipboard'); ok(/<h2>Executive Summary<\/h2>/.test(rich) && /<a href="https:\/\/pointpost\.example\.com\.au\/a">/.test(rich), 'headings and links travel with it');
});
await t('filing: what the strip holds and the brief does not is listed once; filed is read-only until reopened', async () => {
  await page.getByRole('button', { name: 'Mark as filed' }).click(); await page.waitForSelector('[role="dialog"][aria-label="Before it is filed"]'); const d = await txt(page, '[role="dialog"]'); ok(/not in this brief/.test(d) && /Sentinel spike: Gas taxation/.test(d) && /Facebook delivered nothing/.test(d), d.slice(0, 300));
  await page.getByRole('button', { name: 'Go back and cover them' }).click(); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.status, 'draft');
  await page.getByRole('button', { name: 'Mark as filed' }).click(); await page.getByRole('button', { name: 'File anyway' }).click(); await page.waitForFunction(() => /Filed by Anne/.test(document.querySelector('#den-tabpanel section.den-panel header').textContent));
  ok(await page.$eval('.den-sec[data-section="summary"] textarea', e => e.readOnly) && !(await page.$('button:has-text("Regenerate this section")')) && !(await page.$('button:has-text("Save changes")')), 'a filed brief is not edited');
  const [dl] = await Promise.all([page.waitForEvent('download'), (await exportItem(page, 'Download .md')).click()]); ok(/^aep_au-\d{4}-\d\d-\d\d\.md$/.test(dl.suggestedFilename()) && !/DRAFT/.test(fs.readFileSync(await dl.path(), 'utf8')));
  await page.getByRole('button', { name: 'History' }).click(); await page.waitForSelector('section.den-panel[aria-label="History"] tbody tr'); const hist = await all(page, 'section.den-panel[aria-label="History"] tbody tr'); ok(/\| filed with \d signals? acknowledged as not covered \| Anne \|/.test(hist[0]) && hist.some(h => /\| edited: posture \| Kai \|/.test(h)) && /\| drafted from \d+ evidence rows \|/.test(hist[hist.length - 1]), hist.join(' // '));
  await page.getByRole('button', { name: 'Compare with the last filed brief' }).click(); await page.waitForSelector('section.den-panel[aria-label="Against the last filed brief"]'); ok(/No brief was filed on this desk before this one/.test(await txt(page, 'section.den-panel[aria-label="Against the last filed brief"]')));
  await shot(page, '04-brief-filed'); await page.getByRole('button', { name: 'Reopen' }).click(); await page.waitForFunction(() => /Draft/.test(document.querySelector('#den-tabpanel section.den-panel header .den-chip').textContent));
});
await t('Watch: find keywords for nothing, preview one, approve it under an issue, dismiss another with a reason', async () => {
  await w.push('news', Array.from({ length: 60 }, (_, i) => ({ src: 'o' + (i % 5), title: ['Ferntree', 'Kingsbay', 'Marlow', 'Dunmore'][i % 4] + ' residents weigh in on ' + ['library hours', 'the netball final', 'a bridge repair', 'school enrolments', 'the flower show'][i % 5], body: 'Locals gathered at a meeting chaired by a volunteer.', url: 'https://bg.example.com.au/' + i, ts: NOW - (i % 90) * H, meta: { issues: [] } })));
  await w.push('news', ['splits', 'joins the fight in', 'angers', 'has become the test for', 'would cost jobs in', 'reaches', 'lands in', 'still has friends in', 'explained for'].map((v, i) => ({ src: ['pp', 'tb', 'cw'][i % 3], title: 'A tide tariff ' + v + ' Kingsbay as the windfall tax on gas returns', body: 'The tide tariff is now the campaign\'s demand. ' + ['Economists are divided.', 'A vote is expected.', 'Mayors want a carve-out.'][i % 3], url: 'https://tt.example.com.au/' + i, ts: NOW - (30 + i) * H, meta: { issues: ['gastax'] } })));
  await tab(page, 'watch'); await page.waitForSelector('#den-tabpanel section.den-panel:visible'); ok(/Nothing is waiting/.test(await txt(page, 'section.den-panel[aria-label="Waiting for a person"]')));
  await w.F('POST', '/den/watch/propose', { ns: 'aep', source: 'reports', items: [{ kind: 'hashtag', value: 'notalink', reason: 'Named in 2 of 30 reports read.', evidence: [{ text: 'a row whose address is not a web address', url: 'javascript:alert(1)' }] }] });
  const before = w.calls.length; await page.getByRole('button', { name: 'Find new keywords now (free)' }).click(); await page.waitForSelector('section.den-panel[aria-label="Waiting for a person"] tr.den-row'); eq(w.calls.length, before, 'finding keywords asks no model');
  ok(/new proposals?; \d+ already decided or waiting/.test(await txt(page, 'section.den-panel[aria-label="Waiting for a person"] .den-notice')));
  ok((await all(page, 'section.den-panel[aria-label="Waiting for a person"] tr.den-row')).some(r => /#notalink/.test(r)) && (await page.$$eval('#den-root a[href]', a => a.every(x => /^https?:/.test(x.getAttribute('href'))))), 'only a web address is ever a link, whatever a proposal carries');
  const row = panel(page, 'Waiting for a person').locator('tr.den-row', { has: page.locator('.den-t', { hasText: /^tide tariff$/ }) }).first(); ok(/In 9 of \d+ rows on this desk in 14 days/.test(await row.textContent()), (await row.textContent()).slice(0, 200));
  await row.getByRole('button', { name: 'Preview' }).click(); await page.waitForFunction(() => /In the last 7 days:/.test(document.querySelector('section.den-panel[aria-label="Waiting for a person"]').textContent)); ok(/row[s]? carry it; \d+ already on this desk/.test(await row.textContent()));
  await row.getByRole('button', { name: 'Approve' }).click(); ok(/It never changes what counts as a spike/.test(await row.textContent())); await row.locator('select').selectOption('gastax'); await row.getByRole('button', { name: 'Approve' }).click();
  await page.waitForFunction(() => !Array.from(document.querySelectorAll('section.den-panel[aria-label="Waiting for a person"] tr.den-row .den-t')).some(e => e.textContent === 'tide tariff')); ok(w.mod.__test.issueTag('the tide tariff is back').indexOf('gastax') >= 0, 'approved, it tags');
  const other = panel(page, 'Waiting for a person').locator('tr.den-row').first(); const val = await other.locator('.den-t').first().textContent(); await other.getByRole('button', { name: 'Dismiss' }).click(); ok(await other.getByRole('button', { name: 'Dismiss' }).isDisabled(), 'a dismissal needs a reason');
  await other.locator('input').fill('A reporter\'s turn of phrase.'); await other.getByRole('button', { name: 'Dismiss' }).click(); await page.waitForFunction(v => !Array.from(document.querySelectorAll('section.den-panel[aria-label="Waiting for a person"] tr.den-row .den-t')).some(e => e.textContent === v), val);
  await page.getByRole('tab', { name: /^Dismissed/ }).click(); await page.waitForSelector('section.den-panel[aria-label="Dismissed"] tr.den-row'); const gone = await all(page, 'section.den-panel[aria-label="Dismissed"] tr.den-row'); ok(gone.some(r => r.indexOf(val) >= 0 && /A reporter's turn of phrase\. \| Anne/.test(r)), 'what was dismissed, why and by whom: ' + gone.join(' // '));
  await page.getByRole('tab', { name: /^Terms/ }).click(); await page.waitForSelector('section.den-panel[aria-label="Terms"] tr.den-row'); const terms = await all(page, 'section.den-panel[aria-label="Terms"] tr.den-row'); ok(terms.some(r => /^tide tariff.*\| .*\| active ?generic \|/.test(r)), terms.join(' // ')); eq(await page.inputValue('select[aria-label=\'The issue "tide tariff" files under\']'), 'gastax'); ok(/1 of 60 active terms/.test(await txt(page, 'section.den-panel[aria-label="Terms"] header')));
  await page.locator('section.den-panel[aria-label="Add to the register"] input').first().fill('harbour levy australia'); await page.getByRole('button', { name: 'Add', exact: true }).click(); await page.waitForFunction(() => Array.from(document.querySelectorAll('section.den-panel[aria-label="Terms"] tr.den-row')).some(r => /harbour levy australia/.test(r.textContent)));
  ok((await all(page, 'section.den-panel[aria-label="Terms"] tr.den-row')).some(r => /harbour levy australia ?Searched for, but files under no issue/.test(r)), 'a term with no issue says it tags nothing');
  await page.selectOption('select[aria-label=\'The issue "harbour levy australia" files under\']', 'gastax'); await page.waitForFunction(() => !/files under no issue/.test(document.querySelector('section.den-panel[aria-label="Terms"]').textContent)); ok(w.mod.__test.issueTag('a harbour levy australia story').indexOf('gastax') >= 0, 'given its issue where it is listed, it tags'); await shot(page, '05-watch');
});
await t('Options are the desk\'s own, saved with a revision, and the page follows them', async () => {
  await tab(page, 'options'); await page.waitForSelector('section.den-panel[aria-label="The desk"]'); ok(/noisy\.example\.com/.test(await txt(page, 'section.den-panel[aria-label="Mutes"]')) && await page.getByRole('button', { name: 'Save options' }).isDisabled());
  await page.locator('section.den-panel[aria-label="The desk"] input[type="number"]').fill('48'); await page.locator('section.den-panel[aria-label="The desk"] select').nth(2).selectOption('compact'); await page.getByRole('button', { name: 'Move Key Narratives down' }).click();
  ok(/Not saved/.test(await txt(page, '#den-tabpanel .den-optbar .den-save'))); await page.getByRole('button', { name: 'Save options' }).click(); await page.waitForFunction(() => /the last 48 hours/.test(document.querySelector('.den-win').textContent));
  eq(await page.getAttribute('#den-app', 'data-density'), 'compact'); const d = (await w.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_au'); eq([d.window_h, d.sections[1].id, d.sections[2].id], [48, 'media', 'narratives']);
  await w.F('POST', '/den/desk/update', { id: 'aep_au', revision: d.revision, patch: { window_h: 72 } }, 'other-key'); await page.locator('section.den-panel[aria-label="The desk"] input[type="number"]').fill('12'); await page.getByRole('button', { name: 'Save options' }).click();
  await page.waitForSelector('.den-notice.bad'); ok(/Someone else changed this desk's options/.test(await txt(page, '.den-notice.bad'))); await page.getByRole('button', { name: 'Load theirs' }).click(); await page.waitForFunction(() => /the last 72 hours/.test(document.querySelector('.den-win').textContent));
  await page.getByRole('button', { name: 'Remove the mute on noisy.example.com' }).click(); await page.waitForFunction(() => /Nothing is muted/.test(document.querySelector('section.den-panel[aria-label="Mutes"]').textContent));
  ok(await page.getByRole('button', { name: 'Add the desk' }).isDisabled(), 'a desk needs a name'); await page.fill('input[aria-label="The new desk\'s name"]', 'AEP Queensland'); await page.selectOption('select[aria-label="The new desk\'s region"]', 'qld'); await page.getByRole('button', { name: 'Add the desk' }).click();
  await page.waitForFunction(() => /AEP Queensland - daily.*QLD only/.test(document.querySelector('.den-win').textContent)); eq(await page.inputValue('.den-head select[aria-label="Desk"]'), 'aep_aep_queensland'); eq((await w.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_aep_queensland').sections[1].id, 'media', 'the new desk takes the sections of the desk it was made from');
  await page.selectOption('.den-head select[aria-label="Desk"]', 'aep_au'); await page.waitForFunction(() => /AEP national/.test(document.querySelector('.den-win').textContent));
});
await t('every control in the Den has a name, the tabs are tabs, and nothing overflows at 1366, 1440 and 1920', async () => {
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) { await tab(page, name); await page.waitForTimeout(250);
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll('#den-root button, #den-root input, #den-root select, #den-root textarea, #den-root a[href]')).filter(e => { const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || ''; return !lab.trim(); }).map(e => e.outerHTML.slice(0, 120)));
    eq(bad, [], 'unnamed controls on ' + name);
    for (const wdt of [1366, 1440, 1920]) { await page.setViewportSize({ width: wdt, height: 900 }); const over = await page.evaluate(() => { const r = document.getElementById('den-root'); return Array.from(r.querySelectorAll('section.den-panel, .den-strip, .den-head, .den-tabs, .den-rail, .den-board, .den-panes, .den-foot')).filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length + (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0); }); eq(over, 0, name + ' at ' + wdt + ' overflows'); } }
  await page.setViewportSize({ width: 1440, height: 900 }); eq(await page.$$eval('#den-root [role="tablist"] [role="tab"]', e => e.length >= 5), true); eq(page.errors, [], 'no page error through the whole journey');
});
await t('axe finds no serious or critical violation on any tab, in a dialog, or for a read-only key, at 1366, 1440 and 1920', async () => {
  const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');   // a pinned dev dependency (npm ci)
  const run = async (pg, where) => { await pg.waitForTimeout(300); const v = await pg.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' (' + x.impact + ') x' + x.nodes.length + ' at ' + x.nodes.slice(0, 14).map(n => n.target.join(' ').slice(-70) + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ' [' + n.any[0].data.contrastRatio + ' ' + n.any[0].data.fgColor + ' on ' + n.any[0].data.bgColor + ']' : '')).join(' | ')); }); return v.map(x => where + ': ' + x); };
  const bad = [];
  for (const [who, pg] of [['full key', page], ['read-only key', await open(w, 'read-key')]]) { await pg.addScriptTag({ content: AXE });
    for (const wdt of [1366, 1440, 1920]) { await pg.setViewportSize({ width: wdt, height: 900 }); for (const name of ['today', 'brief', 'watch', 'collection', 'options']) { await tab(pg, name); bad.push(...await run(pg, who + ' ' + name + ' at ' + wdt)); } }
    await pg.setViewportSize({ width: 1440, height: 900 }); await pg.getByRole('button', { name: 'Keyboard shortcuts' }).click(); await pg.waitForSelector('[role="dialog"]'); bad.push(...await run(pg, who + ' shortcuts sheet')); await pg.keyboard.press('Escape');
    if (pg !== page) await pg.context().close(); }
  eq(bad, [], 'accessibility');
});
await page.context().close();

await t('a read-only key sees everything and no control that writes', async () => {
  const p = await open(w, 'read-key'); await p.waitForFunction(() => window.AX_ROLE === 'read'); await p.waitForSelector('.den-head .den-chip.warn'); ok(/read-only key/.test(await txt(p, '.den-head')));
  await p.waitForSelector(CARD('media')); eq(await p.locator('#den-tabpanel button', { hasText: /^(Pin|Pinned|Set aside|File here|Unfile)$/ }).count(), 0); eq(await p.locator('.den-board select.den-file').count(), 0, 'no filing for a read-only key'); ok(await cards(p, 'media').locator('a.den-link').count() > 0, 'the sources still open');
  await tab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea'); ok(await p.$eval('.den-sec[data-section="summary"] textarea', e => e.readOnly)); eq(await p.locator('#den-tabpanel button', { hasText: /Draft again|Mark as filed|Save changes|Regenerate|Reopen/ }).count(), 0); ok(await (await exportItem(p, 'Download .md')).isVisible(), 'reading out is allowed'); await p.keyboard.press('Escape');
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); eq(await p.locator('#den-tabpanel button', { hasText: /Find new keywords|Group into themes|^Approve|^Dismiss$|Switch off|^Delete$|^Add$/ }).count(), 0, 'a control that writes is shown on Watch');   // the Dismissed tab is a tab, not a control that writes
  await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); eq(await p.locator('#den-tabpanel button', { hasText: /Collect now|Switch on|Switch off/ }).count(), 0); ok(/Your key is read-only/.test(await txt(p, '.den-notice')));
  await tab(p, 'options'); await p.waitForSelector('section.den-panel[aria-label="The desk"]'); ok(await p.locator('section.den-panel[aria-label="The desk"] input').first().isDisabled() && !(await p.$('button:has-text("Save options")')));
  eq(p.served.filter(s => /^POST \/den\//.test(s)), [], 'and it sent no write'); await p.context().close();
});
await t('a desk with nothing collected says so in every panel, with the one place to look', async () => {
  const p = await open(w); await p.selectOption('.den-head select[aria-label="Desk"]', 'guns_au'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent)); await p.waitForFunction(() => document.querySelectorAll('#den-tabpanel .den-col').length >= 5 && !/Loading/.test(document.querySelector('#den-tabpanel').textContent));
  const strip = (await checks(p)).join(' '); ok(/News delivered nothing in this window/.test(strip) && /before reading it as a quiet day/.test(strip), 'the checks do not read an empty desk as a quiet day'); ok(/News delivered nothing in this window\. ?Not a quiet day/.test(await txt(p, '.den-gapline')), 'and the Board says so where the cards would be');
  for (const [kind, why] of [['media', /No story on this desk's issues was filed in this window\. See what was collected, and why not/], ['social', /No post on this desk's terms or from its registered accounts was collected/], ['actors', /No registered organisation, official or MP posted/], ['upcoming', /No row in this window names a day and a month/]]) ok(why.test(await txt(p, '.den-none [data-none="' + kind + '"]')), kind);
  eq(await p.locator('.den-board .den-row').count(), 0); await p.locator('.den-none [data-none="social"] button.den-link').click(); ok(await p.$('#den-tab-collection[aria-selected="true"]')); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state');
  await p.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await p.waitForFunction(() => /Nothing on this desk was collected in the window/.test((document.querySelector('.toast, #toast') || {}).textContent || '')); ok(await p.getByRole('button', { name: 'Write it by hand' }).isEnabled());
  await p.getByRole('button', { name: 'Write it by hand' }).click(); await p.waitForSelector('.den-sec[data-section="judgement"] textarea', { state: 'attached' }); eq(await p.$$eval('.den-outline .den-out-t b', a => a.map(x => x.textContent.trim())), ['Executive Summary', 'Today\'s Key Judgement', 'Key Developments', 'News environment', 'Organisational and influencer activity', 'Assessment of Activist Momentum', 'Implications for the client', 'Bottom Line', 'Source List'], 'the outline is the desk\'s own sections'); eq(await p.$$eval('.den-sec h4', a => a.map(x => x.childNodes[0].textContent.trim())), ['Executive Summary', 'Today\'s Key Judgement', 'Key Developments', 'News environment', 'Organisational and influencer activity', 'Assessment of Activist Momentum', 'Implications for the client', 'Bottom Line', 'Source List']);
  // a rating sits in the section it rates when the desk has one of that name (Media risk, under News environment); the others stay in the bar
  eq((await p.$$eval('#den-tabpanel .den-bar .den-lab', a => a.map(x => x.childNodes[0].textContent.trim()))).sort(), ['Media risk', 'Overall activity level', 'Social risk', 'Trend'], 'the firearms desk rates three things'); eq(await p.$$eval('.den-sec[data-section="media"] .den-bar .den-lab', a => a.map(x => x.childNodes[0].textContent.trim())), ['Media risk']); ok(!/edited by/.test(await txt(p, '#den-tabpanel')), 'a brief started by hand has no section marked as edited'); await p.context().close();
});
await t('Today reads the window once: the board\'s answer carries the strip, and the strip asks for itself only elsewhere', async () => {
  const p = await open(w); await p.waitForSelector(CARD('media')); await p.waitForSelector('.den-strip li'); await p.waitForSelector('.den-briefhost .den-brief, .den-briefhost .den-state', { state: 'attached' });
  const today = p.served.filter(x => /^GET \/den\/(board|missed)/.test(x)); ok(today.length === 1 && /^GET \/den\/board\?.*missed=1/.test(today[0]), 'one request for the board and the strip together: ' + today.join(' | '));
  ok(/Sentinel spike: Gas taxation/.test((await checks(p)).join(' ')), 'and the strip is drawn from it');
  // the Brief tab shows the same evidence from what the Board read: opening it reads the window no further
  await tab(p, 'brief'); await p.waitForSelector('.den-evpane'); await p.locator('.den-pull .den-fold').click(); await p.waitForSelector('.den-pulllist li'); await tab(p, 'today'); await p.waitForSelector(CARD('media'));
  eq(p.served.filter(x => /^GET \/den\/board/.test(x)).length, 2, 'the Brief tab read no board: the second read is the Board opening again');
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); p.served.length = 0; await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click();
  await p.waitForFunction(() => true); for (let i = 0; i < 40 && !p.served.some(x => /^GET \/den\/missed/.test(x)); i++) await new Promise(r => setTimeout(r, 100));
  ok(p.served.some(x => /^GET \/den\/missed/.test(x)) && !p.served.some(x => /^GET \/den\/board/.test(x)), 'on another tab the strip asks for itself and the board is not read: ' + p.served.filter(x => /den\/(board|missed)/.test(x)).join(' | '));
  await p.waitForSelector('.den-strip li'); await p.context().close();
});
await t('a busy database: the page says so once and asks again by itself', async () => {
  let busy = 1; const asked = []; w.hooks.push(async (route, r, path) => { if (/^\/den\/board/.test(path)) { asked.push(Date.now()); if (busy > 0) { busy--; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'db_busy', retry: true, detail: 'The database is busy right now: too much is reading it at once. Nothing was changed. Try again in a few seconds.' }) }); return true; } } return false; });
  const p = await open(w, 'full-key', { view: 'command' }); await p.evaluate(() => go('den')); await p.waitForSelector('#den-app');
  await p.waitForFunction(() => /database is busy\. Trying again/i.test((document.querySelector('.toast, #toast') || {}).textContent || ''), null, { timeout: 8000 });
  ok(!(await p.$('#den-tabpanel .den-state.err')), 'no error is shown while it is asking again');
  await p.waitForSelector(CARD('media'), { timeout: 15000 }); ok(asked.length === 2 && asked[1] - asked[0] >= 2000, 'asked again a few seconds later, without a click: ' + asked.map(a => a - asked[0]).join(', '));
  await p.waitForSelector('.den-strip li'); await p.context().close(); w.hooks.length = 0;
  busy = 9; w.hooks.push(async (route, r, path) => { if (/^\/den\/(board|missed)/.test(path)) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'db_busy', retry: true, detail: 'The database is busy right now: too much is reading it at once. Nothing was changed. Try again in a few seconds.' }) }); return true; } return false; });
  const q2 = await open(w, 'full-key', { view: 'command' }); await q2.evaluate(() => go('den')); await q2.waitForSelector('#den-tabpanel .den-state.err', { timeout: 20000 });
  ok(/Today's evidence could not be loaded\. The database is busy right now/.test(await txt(q2, '#den-tabpanel .den-state.err')) && await q2.locator('#den-tabpanel .den-state.err button', { hasText: 'Try again' }).count(), 'after two more tries it says so in words, with Try again: ' + await txt(q2, '#den-tabpanel .den-state.err'));
  await q2.context().close(); w.hooks.length = 0;
});
await t('a failed read says what failed and tries again; a broken panel does not blank the page', async () => {
  let failBoard = 2; w.hooks.push(async (route, r, path) => { if (/^\/den\/board/.test(path) && failBoard > 0) { failBoard--; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; } return false; });
  const p = await open(w); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Today's evidence could not be loaded\. Something failed on the worker/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li'), 'the strip is still there');
  failBoard = 0; await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForSelector(CARD('media'));
  let breakIt = true; w.hooks.push(async (route, r, path) => { if (/^\/den\/collection/.test(path) && breakIt) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, channels: [null], reach: {} }) }); return true; } return false; });   // the right shape with something in it no panel can draw
  p.removeAllListeners('pageerror'); await tab(p, 'collection'); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Collection stopped working\. The rest of the page is unaffected/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li') && await p.$('.den-head select'), 'the header and the strip survive');
  breakIt = false; await tab(p, 'today'); await p.waitForSelector(CARD('media')); w.hooks.length = 0; await p.context().close();
});
await t('Collection lists the watched parliament pages and the campaign counters, and adds and removes one of each', async () => {
  const p = await open(w); await tab(p, 'collection'); const pages = panel(p, 'Watched parliament pages'); const ctr = panel(p, 'Campaign petition counters');
  await pages.locator('tr.den-row').first().waitFor(); ok(/Domestic Gas Reservation Bill 2026 inquiry/.test(await pages.textContent()) && /not read yet/.test(await pages.textContent()), 'a seeded page says it has not been read yet');
  ok(!/NSW Portfolio Committee/.test(await pages.textContent()), 'another client\'s page is not on this desk');
  await pages.getByLabel('Address of the page').fill('https://parliament.example.gov.au/committees/harbour-levy'); await pages.getByLabel('Its name, as the parliament writes it').fill('Harbour Levy Bill 2026 inquiry');
  await pages.getByRole('button', { name: 'Watch this page' }).click(); await pages.locator('tr.den-row', { hasText: 'Harbour Levy Bill 2026 inquiry' }).waitFor();
  await pages.locator('tr.den-row', { hasText: 'Harbour Levy Bill 2026 inquiry' }).getByRole('button', { name: 'Stop' }).click(); await pages.locator('tr.den-row', { hasText: 'Harbour Levy Bill 2026 inquiry' }).locator('.den-chip', { hasText: 'switched off' }).waitFor();
  await ctr.locator('tr.den-row').first().waitFor(); ok(/Tax the gas industry/.test(await ctr.textContent()) && !/Stop the Buyback/.test(await ctr.textContent()), 'this client\'s counters only'); ok(/Self-reported|own claim/i.test(await ctr.textContent()));
  await ctr.getByLabel('Address of the campaign page').fill('https://campaign.example.org/petition'); await ctr.getByLabel('The petition\'s name').fill('Keep the Night Boat');
  await ctr.getByRole('button', { name: 'Add counter' }).click(); const row = ctr.locator('tr.den-row', { hasText: 'Keep the Night Boat' }); await row.waitFor(); ok(/added by/.test(await row.textContent()));
  await row.getByRole('button', { name: 'Remove' }).click(); await row.waitFor({ state: 'detached' });
  eq(w.calls.length >= 0, true); await p.close();
});

await t('a paused platform is said in the strip and in Collection, and nothing retries it', async () => {
  await w.kv.set('reach_challenges', JSON.stringify({ facebook: { at: NOW - 2 * H, agent: 'mac-1', error: 'facebook_challenge' } }));
  const p = await open(w); await p.waitForSelector('.den-strip li'); const said = await checks(p); ok(/Facebook delivered nothing.*stopped at a verification on \d{4}-\d\d-\d\d and is paused/.test(said.join(' ')), said[0]);
  await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); ok(/paused: verification/.test(await panel(p, 'Channels').locator('tr.den-row', { hasText: 'Facebook' }).textContent()) && /verification \d+ h ago/.test(await txt(p, 'section.den-panel[aria-label="Signed-in collection"]')));
  await w.kv.delete('reach_challenges'); await p.context().close();
});
await t('the connection drops mid-draft: the page says so, and the draft the worker finished is one press away', async () => {
  const w2 = await world(); let cut = true; w2.hooks = [async (route, r, path) => { if (r.method() === 'POST' && path === '/den/brief' && cut) { cut = false; await w2.call('POST', path, r.postData(), 'full-key'); await route.abort('connectionreset'); return true; } return false; }];
  const p = await open(w2); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state'); await p.getByRole('button', { name: 'Draft the brief (1 model call)' }).click();
  await p.waitForSelector('.den-notice.bad[role="alert"]'); ok(/The connection dropped while the worker was writing\. The worker may still finish and save it: nothing here was lost/.test(await txt(p, '.den-notice.bad')));
  await p.getByRole('button', { name: 'Check for the draft' }).click(); await p.waitForSelector('.den-sec[data-section="summary"] textarea'); ok(/^Coverage of the gas taxation debate/.test(await p.inputValue('.den-sec[data-section="summary"] textarea'))); eq(w2.calls.length, 1, 'and it was not drafted twice');
  await p.context().close();
});
await t('a slow draft says it is working and locks its own buttons, not the page', async () => {
  const w3 = await world(); w3.slow = 900; const p = await open(w3); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state'); await p.getByRole('button', { name: 'Draft the brief (1 model call)' }).click();
  await p.waitForFunction(() => /Drafting \(a minute or two\)\.\.\./.test(document.querySelector('#den-tabpanel').textContent)); ok(await p.getByRole('button', { name: /Drafting/ }).isDisabled()); ok(/Writing the brief from the evidence\. One model call, usually a minute or two; \d:\d\d so far/.test(await txt(p, '.den-progress')) && !/%/.test(await txt(p, '.den-progress')), 'a progress line with the time so far and no invented share'); await tab(p, 'today'); await p.waitForSelector(CARD('media')); ok(await cards(p, 'media').first().getByRole('button', { name: 'Pin' }).isEnabled(), 'the Board is not locked while it drafts');
  await tab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea', { timeout: 15000 }); eq(w3.calls.length, 1); await p.context().close();
});

/* ---- the Storyboard (13 November 2026): the focused window, the first screen, filing under a section, citing a card ---- */
await t('the Den is a focused window: the app\'s chrome steps aside, and Back to AXIOM brings it back', async () => {
  const p = await open(w); ok(await p.evaluate(() => document.body.classList.contains('in-den')), 'opening the Den sets body.in-den');
  for (const s of ['.shell nav.rail', '.shell header.top', '#scope-root', '#v-den > .note']) eq(await p.locator(s).first().isVisible(), false, s + ' is still shown');
  ok(/Anne's Den/.test(await txt(p, '#vtitle')) && await p.$('.rbtn[data-v="den"][aria-current="page"]'), 'the title and the navigation, though hidden, still say where this is');
  const box = await p.locator('#den-app').boundingBox(); const vp = p.viewportSize(); ok(box.x === 0 && box.y === 0 && Math.abs(box.width - vp.width) < 2 && Math.abs(box.height - vp.height) < 2, 'the Den takes the whole window: ' + JSON.stringify(box));
  await p.getByRole('button', { name: 'Back to AXIOM' }).click(); await p.waitForFunction(() => !document.body.classList.contains('in-den'));
  ok(await p.locator('.shell header.top').isVisible() && await p.locator('#v-command').isVisible() && !(await p.locator('#v-den').isVisible()), 'the app is back, on its front page');
  await p.evaluate(() => go('den')); await p.waitForFunction(() => document.body.classList.contains('in-den')); await p.waitForSelector(CARD('media')); await p.context().close();
});
await t('at 1366 x 768 the first evidence card is on the first screen, and the board scrolls inside itself', async () => {
  const p = await open(w, 'full-key', { width: 1366, height: 768 }); await p.waitForSelector(CARD());
  const b = await cards(p).first().boundingBox(); ok(b.y > 0 && b.y + 60 < 768, 'the first card starts ' + Math.round(b.y) + 'px down');
  const m = await p.evaluate(() => { const e = document.querySelector('.den-board'); return { doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, board: e.scrollWidth - e.clientWidth }; }); ok(m.doc <= 1 && m.board > 100, 'the document does not scroll sideways and the board does: ' + JSON.stringify(m)); await p.context().close();
});
const w5 = await world(); const p5 = await open(w5); let filedKey = '';
await t('a card is filed under a section by its number: pinned through the worker, the section kept on this computer, undone, and still there after a reload', async () => {
  const p = p5; await p.waitForSelector(CARD('media')); await p.waitForSelector('.den-strip li');
  eq(p.served.filter(x => /^GET \/den\/(board|missed)/.test(x)).length, 1, 'the Board still opens on one read of the window');
  const story = cards(p, 'media').filter({ hasText: 'Harbour levy' }); const key = filedKey = await story.getAttribute('data-key'); const item = +key.slice(2);
  await story.focus(); await p.keyboard.press('3');   // the third section of this desk: Traditional Media Coverage
  await p.waitForSelector('.den-col[data-sec="media"] .den-row[data-key="' + key + '"].pinned');
  ok(p.served.some(x => x === 'POST /den/pin'), 'filing pins the row through POST /den/pin, as the Pin button does'); eq((await w5.F('GET', '/den/board?desk=aep_au')).body.pinned, [item], 'so the worker holds the pin and a draft must cover it');
  const kept = () => p.evaluate(() => { const k = Object.keys(localStorage).find(x => /^ax_den_file_aep_au_\d{4}-\d\d-\d\d$/.test(x)); return k ? JSON.parse(localStorage.getItem(k)) : null; });
  eq(await kept(), { [key]: 'media' }, 'which section it sits under is this browser\'s note'); ok(/kept on this computer/.test(await txt(p, '.den-unsorted .den-colsub')), 'and the page says where that is kept');
  ok(await p.evaluate(() => !!(document.activeElement.closest && document.activeElement.closest('.den-unsorted .den-row'))), 'the focus moves on to the next unsorted card');
  eq(await txt(p, '.den-col[data-sec="media"] .den-col-h .den-count'), '1'); ok(/Has evidence/.test(await txt(p, '.den-col[data-sec="media"] .den-col-meta')));
  await cards(p, 'media').filter({ hasText: 'Producers answer' }).getByRole('button', { name: 'Pin' }).click(); await p.waitForSelector(CARD('media') + '.pinned'); ok(/Producers answer/.test(await txt(p, CARD('media') + '.pinned')), 'a row pinned and not filed stays in Unsorted, as pinned');
  const up = cards(p, 'upcoming').first(); const pins = p.served.filter(x => x === 'POST /den/pin').length; await up.focus(); await p.keyboard.press('1'); await p.waitForSelector('.den-col[data-sec="summary"] .den-row[data-kind="upcoming"]');
  eq(p.served.filter(x => x === 'POST /den/pin').length, pins, 'a date is not a row the worker pins: it is filed on this computer and nothing is sent'); eq(Object.keys(await kept()).length, 2);
  await p.getByRole('button', { name: /^Undo/ }).click(); await p.waitForSelector(CARD('upcoming')); eq(await kept(), { [key]: 'media' }, 'Undo puts the last card back');
  await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function'); await p.evaluate(() => go('den')); await p.waitForSelector('.den-col[data-sec="media"] .den-row[data-key="' + key + '"]'); eq(await cards(p, 'media').filter({ hasText: 'Harbour levy' }).count(), 0, 'after a reload the card is still under its section');
  await p.locator('.den-col[data-sec="media"] .den-row select.den-file').selectOption(''); await p.waitForSelector(CARD('media') + '[data-key="' + key + '"].pinned'); eq(await kept(), null, 'taken back to Unsorted, it is still pinned');
  await cards(p, 'media').filter({ hasText: 'Harbour levy' }).locator('select.den-file').selectOption('media'); await p.waitForSelector('.den-col[data-sec="media"] .den-row[data-key="' + key + '"]'); eq(await kept(), { [key]: 'media' }, 'the select files a card too, for a hand that does not drag');
  const post = cards(p, 'social').first(); const skey = await post.getAttribute('data-key'); await post.dragTo(p.locator('.den-col[data-sec="social"] .den-col-body')); await p.waitForSelector('.den-col[data-sec="social"] .den-row[data-key="' + skey + '"]'); eq((await kept())[skey], 'social', 'and a card dragged to a column is filed there');
  await p.locator('.den-col[data-sec="social"] .den-row select.den-file').selectOption(''); await p.waitForSelector(CARD('social'));
});
await t('the Write surface: a column opens its section with the filed card beside the words, and a card is pulled in from the window', async () => {
  const p = p5; await w5.F('POST', '/den/brief', { desk: 'aep_au' }); await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await p.waitForFunction(() => /Drafted/.test(document.querySelector('.den-col[data-sec="media"] .den-col-meta').textContent));
  ok(/The story ran in three outlets/.test(await txt(p, '.den-col[data-sec="media"] .den-excerpt')), 'the column shows what the section says'); ok(/Cited/.test(await txt(p, '.den-col[data-sec="media"] .den-row')), 'and the card says the brief cites it');
  await p.getByRole('button', { name: 'Write Traditional Media Coverage' }).click(); ok(await p.$('#den-tab-brief[aria-selected="true"]')); await p.waitForSelector('.den-sec[data-section="media"]', { state: 'visible' });
  eq(await p.locator('.den-outline [data-goto="media"]').getAttribute('aria-current'), 'true'); ok(new RegExp('^Cite ' + filedKey + ': Harbour levy').test(await p.locator('.den-evlist .den-evcard').first().getAttribute('aria-label')), 'the card filed on the Board is the evidence for this section');
  ok(/kept on this computer/.test(await txt(p, '.den-evhead')));
  const reads = p.served.filter(x => /^GET \/den\/board/.test(x)).length; await p.locator('.den-pull .den-fold').click(); await p.waitForSelector('.den-pulllist li'); eq(p.served.filter(x => /^GET \/den\/board/.test(x)).length, reads, 'the rest of the window is what the Board already read');
  const pins = p.served.filter(x => x === 'POST /den/pin').length; await p.locator('.den-pulllist li', { hasText: 'Our position on the gas export tax' }).getByRole('button', { name: /^File here/ }).click();
  await p.waitForFunction(() => document.querySelectorAll('.den-evlist .den-evcard').length === 2); eq(p.served.filter(x => x === 'POST /den/pin').length, pins + 1, 'pulled in, it is pinned like any filed row');
  ok(Object.values(await p.evaluate(() => JSON.parse(localStorage.getItem(Object.keys(localStorage).find(x => /^ax_den_file_aep_au_/.test(x)))))).every(v => v === 'media'));
});
await t('citing a card puts its mark where the cursor was, marks the card as cited, and the save keeps it', async () => {
  const p = p5; const ta = p.locator('.den-sec[data-section="media"] textarea'); const before = await ta.inputValue(); ok(/^The story ran in three outlets/.test(before), before);
  const card = p.locator('.den-evlist .den-evcard', { hasText: 'Our position on the gas export tax' }); const cid = (/^Cite ([A-Z]:\d+):/.exec(await card.getAttribute('aria-label')) || [])[1]; ok(cid && !/Cited/.test(await card.textContent()), 'the pulled card can be cited and is not yet: ' + cid);
  await ta.evaluate(e => { e.focus(); e.setSelectionRange(9, 9); }); await card.click();
  const now = before.slice(0, 9) + ' [' + cid + ']' + before.slice(9); eq(await ta.inputValue(), now, 'the mark went in after "The story", where the cursor was');
  await p.waitForFunction(() => document.activeElement.tagName === 'TEXTAREA'); eq(await ta.evaluate(e => e.selectionStart), 9 + cid.length + 3, 'and the cursor is back in the words, after the mark');
  ok(/Cited/.test(await card.textContent()) && /cited/.test(await card.getAttribute('class')), 'the card says it is cited'); ok(/Harbour Watch on X/.test(await txt(p, '.den-sec[data-section="media"] .den-cites')), 'and it reads as the actor, not the id');
  ok(/Unsaved changes \(kept on this computer\)/.test(await txt(p, '.den-bar[role="status"]')));
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForFunction(() => /Saved, revision/.test(document.querySelector('.den-bar[role="status"]').textContent));
  const b = (await w5.F('GET', '/den/brief?desk=aep_au')).body.brief; ok(b.sections.media.cites.indexOf(cid) >= 0 && b.sections.media.text === now, 'the worker kept the citation: ' + JSON.stringify(b.sections.media.cites));
  ok(b.sourceList.some(g => g.items.some(i => i.id === cid)), 'and the Source List, built from the citations, now carries it'); eq(p.errors, []); await p.context().close();
});

await finish();
