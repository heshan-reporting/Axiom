/* Anne's Den in a real browser (prompts/annes-den.md Phase 6): the page served from docs/, its worker calls routed into
 * the worker module in this process (SQLite behind the D1 API), the model a stub that writes from the evidence it is
 * sent. Nothing is contacted and nothing is spent. Every outlet, account and post here is invented.
 *   the day's journey: open a desk, read the strip, pin and set aside, mute, collect now with the console, draft, edit,
 *   regenerate a section, see the uncited warning, a conflict with another person, mark as filed, copy and download;
 *   then the keyboard, the Watch tab, Options, a read-only key, the empty and error states, a paused platform, a dropped
 *   connection mid-draft, and a reload with unsaved edits.
 *   The journey above is the table's: the fixture chooses Table for it, and it turns the desk's showGaps on, because it
 *   asserts gaps. The guided run (decision D10), which a fresh profile opens in, has eighteen cases after it, each in its
 *   own world; the last fifteen are D10 on the page with the option as it ships: nothing on screen says what was not
 *   collected, Collection's one disclosure, the Options switch, Write and File, and the three whole-page gates.
 * Run: node --experimental-sqlite tests/den-browser.mjs   (SHOT=1 saves screenshots to tests/shots/den/) */
import fs from 'node:fs';
import { world, open, browser, t, ok, eq, txt, all, tab, desk, toast, shot, panel, finish, H, D, NOW } from './den-fixture.mjs';

console.log('den-browser harness');
const w = await world();
// this journey asserts gaps (D10): by default a desk is not told which channels delivered nothing, so the main world turns the
// desk's showGaps on, before the page opens (an update bumps the desk's revision, which the page reads when it loads)
const gapsOn = async (wd, ids) => { for (const id of ids) { const r = await wd.F('POST', '/den/desk/update', { id, patch: { options: { showGaps: true } } }); if (r.status !== 200) throw new Error('showGaps was not saved for ' + id + ': ' + r.text.slice(0, 160)); } };
await gapsOn(w, ['aep_au', 'guns_au']);
let page = await open(w);

await t('the Den opens from the navigation on a desk, in Australian Eastern time, with nothing spent', async () => {
  ok(await page.$('.rbtn[data-v="den"][aria-current="page"]'), 'the navigation button is current'); eq(await page.title() !== '', true); ok(/Anne's Den/.test(await txt(page, '#vtitle')));
  eq(await all(page, '.den-deskitem b'), ['AEP national', 'AEP Victoria', 'Firearms', 'MCA national', 'MCA Victoria']);
  ok(/daily, the last 24 hours - Australian Eastern time/.test(await txt(page, '.den-win'))); ok(/model calls today: 0 of 20/.test(await txt(page, '.den-head')) && !(await page.$('.den-head .den-chip.warn')));
  eq(await all(page, '.den-tabs[aria-label="Anne\'s Den"] .den-tab'), ['Today', 'Brief', 'Watch', 'Collection', 'Options']); eq(w.calls.length, 0);
});
await t('the strip says what should not be missed, gaps first, and opens the evidence', async () => {
  const lines = await all(page, '.den-strip li'); ok(/Not collected.*Facebook delivered nothing in this window/.test(lines[0]) && /not granted/.test(lines[0]) && /No signed-in collector is connected/.test(lines[0]), lines[0]);
  ok(lines.some(l => /Spike.*Sentinel spike: Gas taxation.*3\.1 times/.test(l)), lines.join(' | ')); ok(/computed, no model/.test(await txt(page, '.den-strip header')));
  await page.click('.den-strip li:first-child button.den-link'); ok(await page.$('#den-tab-collection[aria-selected="true"]'), 'a gap opens Collection'); await tab(page, 'today');
  await page.getByRole('button', { name: 'Fold' }).click(); ok(!(await page.$('.den-strip li')) && /4 to read/.test(await txt(page, '.den-strip header')) && /1 not collected/.test(await txt(page, '.den-strip header')), 'folded, it still says how many and that a channel was not read'); await page.getByRole('button', { name: 'Show' }).click(); await page.waitForSelector('.den-strip li');
});
await t('Today sorts the window into the report\'s sections: folded copies, the subscriber mark, reach, actors apart, a dated action', async () => {
  await page.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row');
  const media = await all(page, 'section.den-panel[aria-label="Traditional media"] tr.den-row'); ok(media.some(r => /^Harbour levy divides the Senate ?also in The Tribune \| pointpost ?regional \| 2 \| 362 \|/.test(r)), media[0]);
  ok(media.some(r => /^Producers answer the windfall tax push ?subscriber \|/.test(r)), 'the subscriber mark: ' + media.join(' // ')); ok(/8 stories, 7 after folding copies/.test(await txt(page, 'section.den-panel[aria-label="Traditional media"] header')));
  const soc = await all(page, 'section.den-panel[aria-label="Social"] tr.den-row'); eq(soc.length, 1); ok(/\| X ?L2 \| 55 \|/.test(soc[0]), soc[0]);
  const act = await all(page, 'section.den-panel[aria-label="Influencer and political"] tr.den-row'); ok(act.length === 1 && /^Harbour Watch ?organisation \| Our position on the gas export tax, in full\. \| X \| 90 \|/.test(act[0]), act[0]);
  const upc = await all(page, 'section.den-panel[aria-label="Upcoming"] tr.den-row'); ok(upc.length === 1 && /-12-28.*\| rally \| .*Parliament on 28 December/.test(upc[0]), upc[0]);
  ok(/No narrative on this desk's issues gained rows/.test(await txt(page, 'section.den-panel[aria-label="Key narratives"]')), 'an empty section says why'); await shot(page, '01-today-gaps-on');
});
await t('pin a row, set rows aside with a reason, and confirm the mute that is offered after three', async () => {
  const m = panel(page, 'Traditional media'); const row = m.locator('tr.den-row', { hasText: 'Producers answer' });
  await row.getByRole('button', { name: 'Pin' }).click(); await page.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row.pinned');
  ok(/Producers answer/.test((await all(page, 'section.den-panel[aria-label="Traditional media"] tr.den-row'))[0]), 'the pinned story leads'); eq(await m.locator('tr.den-row.pinned button[aria-pressed="true"]').count(), 1);
  for (let i = 1; i <= 3; i++) { const r = m.locator('tr.den-row', { hasText: 'Noisy outlet on the gas export tax ' + i }); await r.getByRole('button', { name: 'Set aside' }).click(); if (i === 2) await r.locator('select[aria-label="Why it is set aside"]').selectOption('duplicate'); await r.getByRole('button', { name: 'Set aside' }).click(); await page.waitForFunction(n => !Array.from(document.querySelectorAll('section.den-panel[aria-label="Traditional media"] tr.den-row')).some(x => x.textContent.indexOf('Noisy outlet on the gas export tax ' + n) >= 0), i); }
  await page.waitForSelector('.den-notice[role="alert"]'); ok(/You have set aside 3 rows from noisy\.example\.com on this desk\. Mute it here\?/.test(await txt(page, '.den-notice[role="alert"]')));
  ok(/3 set aside and not shown/.test(await txt(page, '#den-tabpanel')), 'set aside is counted');
  await page.getByRole('button', { name: /Show what was set aside/ }).click(); await page.waitForSelector('section.den-panel[aria-label="Set aside"] tbody tr'); eq((await all(page, 'section.den-panel[aria-label="Set aside"] tbody tr')).map(r => /\| (not relevant|duplicate) \| Anne/.test(r)), [true, true, true]);
  ok((await all(page, 'section.den-panel[aria-label="Traditional media"] tr.den-row')).some(r => /Noisy outlet on the gas export tax 4/.test(r)), 'the offer changed nothing: the fourth is still on the board');
  await page.getByRole('button', { name: 'Mute it on this desk' }).click(); await page.waitForFunction(() => /4 muted and not shown/.test(document.querySelector('#den-tabpanel').textContent));
  ok(!(await all(page, 'section.den-panel[aria-label="Traditional media"] tr.den-row')).some(r => /Noisy/.test(r)), 'muted, the site\'s rows are gone from the board and counted');
});
await t('the keyboard: rows, pin, tabs, and the sheet that returns the focus', async () => {
  await page.locator('#den-tabpanel').click({ position: { x: 5, y: 5 } }); await page.locator('section.den-panel[aria-label="Traditional media"] tr.den-row').first().focus(); await page.keyboard.press('j');
  const second = await page.evaluate(() => document.activeElement.textContent); ok(/Harbour levy|Harbour Watch will hold/.test(second), 'j moves to the next row: ' + second.slice(0, 60));
  await page.keyboard.press('p'); await page.waitForFunction(() => document.querySelectorAll('section.den-panel[aria-label="Traditional media"] tr.den-row.pinned').length === 2); await page.keyboard.press('k');
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
  ok(/AFR|Australian Financial/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]')) && /headlines only/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]'))); await shot(page, '02-collection-gaps-on');
});
await t('a draft states its cost first, is one call, and comes back checked against its rows', async () => {
  await tab(page, 'brief'); await page.waitForSelector('#den-tabpanel .den-state'); const empty = await txt(page, '#den-tabpanel'); ok(/No brief has been started for this window/.test(empty) && /Draft the brief \(1 model call\)/.test(empty) && /One model call \(a second only if the first answer cannot be read\)\. 20 of 20 left today/.test(empty), empty.slice(0, 300));
  await page.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await page.waitForSelector('.den-sec[data-section="summary"] textarea'); eq(w.calls.length, 1);
  ok(/^Coverage of the gas taxation debate/.test(await page.inputValue('.den-sec[data-section="summary"] textarea'))); ok(/drafted/.test(await txt(page, '.den-sec[data-section="summary"] h4')));
  ok(/No evidence behind: A campaigner named Sam Private is behind it\./.test(await txt(page, '.den-sec[data-section="summary"] .den-flags')), 'the sentence that rested on an invented row is marked'); ok(/1 without evidence/.test(await txt(page, '.den-bar[role="status"]')));
  ok((await page.inputValue('.den-sec[data-section="summary"] textarea')).indexOf('M:999999') < 0, 'and the invented citation is gone'); eq(await page.$$eval('.den-sec[data-section="summary"] .den-cites a', a => a.map(x => /^https:/.test(x.href))), [true, true]);
  eq(await txt(page, '#den-tabpanel [role="radiogroup"] >> nth=0 >> [aria-checked="true"]'), 'Moderate'); eq(await txt(page, '#den-tabpanel [role="radiogroup"][aria-label="Momentum trend"] [aria-checked="true"]'), 'Stable'); ok(/Draft/.test(await txt(page, 'section.den-panel header .den-chip.warn')) && /revision 1/.test(await txt(page, 'section.den-panel header')));
  ok(/Traditional media.*pointpost - Harbour levy divides the Senate/.test(await txt(page, '.den-sec:has(h4:has-text("Source List"))')) && /built from the citations/.test(await txt(page, '.den-sec:has(h4:has-text("Source List"))')));
  await page.waitForFunction(() => /model calls today: 1 of 20/.test(document.querySelector('.den-head').textContent)); await shot(page, '03-brief-draft');
});
await t('an edit is kept on this computer at once, saved on leaving the field, and marked as a person\'s', async () => {
  const ta = page.locator('.den-sec[data-section="bottom"] textarea'); await ta.fill('Anne\'s own bottom line.');
  ok(/Unsaved changes \(kept on this computer\)/.test(await txt(page, '.den-bar[role="status"]')) && /not saved/.test(await txt(page, '.den-sec[data-section="bottom"] h4')));
  ok(await page.getByRole('button', { name: 'Mark as filed' }).isDisabled() && await page.getByRole('button', { name: /Draft again/ }).isDisabled(), 'no filing or redrafting over unsaved words');
  await page.locator('.den-sec[data-section="summary"] textarea').focus(); await page.waitForFunction(() => /Saved, revision 2/.test(document.querySelector('.den-bar[role="status"]').textContent));
  ok(/edited by Anne/.test(await txt(page, '.den-sec[data-section="bottom"] h4'))); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.bottom.text, 'Anne\'s own bottom line.');
});
await t('words typed in another section while a save is in flight are not lost when it returns', async () => {
  let slow = true; w.hooks.push(async (route, r, path) => { if (slow && r.method() === 'POST' && path === '/den/brief/save') await new Promise(x => setTimeout(x, 900)); return false; });
  await page.locator('.den-sec[data-section="posture"] textarea').fill('The client should hold its position.'); await page.locator('.den-sec[data-section="media"] textarea').focus();   // leaving the field starts the save
  await page.locator('.den-sec[data-section="media"] textarea').fill('Typed while the other section was saving.'); await page.waitForFunction(() => /edited by Anne/.test(document.querySelector('.den-sec[data-section="posture"] h4').textContent), null, { timeout: 15000 });
  eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed while the other section was saving.', 'the save that returned dropped what was typed meanwhile'); ok(/not saved/.test(await txt(page, '.den-sec[data-section="media"] h4')) && /Unsaved changes/.test(await txt(page, '.den-bar[role="status"]')));
  slow = false; w.hooks.length = 0; await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => /Saved, revision/.test(document.querySelector('.den-bar[role="status"]').textContent));
  const b = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; eq([b.sections.posture.text, b.sections.media.text], ['The client should hold its position.', 'Typed while the other section was saving.']);
  await page.locator('.den-sec[data-section="media"] textarea').fill('The story ran in three outlets and drew 300 reactions on Facebook [' + b.sections.summary.cites[0] + '].'); await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForFunction(() => !/Unsaved changes|Saving/.test(document.querySelector('.den-bar[role="status"]').textContent));
});
await t('regenerating one section is one stated call and never touches a person\'s edit unasked', async () => {
  const sec = page.locator('.den-sec[data-section="bottom"]'); await sec.getByRole('button', { name: 'Regenerate this section' }).click(); ok(/This replaces Anne's edit\./.test(await sec.textContent()) && /Write it again \(1 model call\)/.test(await sec.textContent()));
  await sec.getByRole('button', { name: 'Cancel' }).click(); eq(w.calls.length, 1, 'asking costs nothing');
  await sec.getByRole('button', { name: 'Regenerate this section' }).click(); await sec.locator('input').fill('Shorter.'); await sec.getByRole('button', { name: 'Write it again (1 model call)' }).click();
  await page.waitForFunction(() => /^Written again, shorter/.test(document.querySelector('.den-sec[data-section="bottom"] textarea').value)); eq(w.calls.length, 2); ok(/THE ANALYST ASKS, FOR THIS SECTION: Shorter\./.test(w.calls[1].messages[0].content));
  ok(/^Coverage of the gas taxation debate/.test(await page.inputValue('.den-sec[data-section="summary"] textarea')), 'the other sections are as they were');
});
await t('unsaved words survive a reload and are offered back', async () => {
  await page.locator('.den-sec[data-section="media"] textarea').fill('Typed and not yet saved.'); await page.waitForFunction(() => Object.keys(localStorage).some(k => /^ax_den_work_/.test(k)));
  page.removeAllListeners('dialog'); page.on('dialog', d => d.accept()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => typeof go === 'function'); await page.evaluate(() => go('den')); await page.waitForSelector('.den-sec[data-section="media"] textarea');
  eq(await page.inputValue('.den-sec[data-section="media"] textarea'), 'Typed and not yet saved.'); ok(/Your unsaved words from .* were kept on this computer and are back in the editor/.test(await txt(page, '.den-notice[role="status"]')));
  ok(await page.$('#den-tab-brief[aria-selected="true"]'), 'and the tab is where it was');
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
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .md' }).click()]); ok(/^aep_au-\d{4}-\d\d-\d\d-draft\.md$/.test(dl.suggestedFilename()), dl.suggestedFilename()); const md = fs.readFileSync(await dl.path(), 'utf8'); ok(/^# .* - AEP national/.test(md) && /## Executive Summary/.test(md) && /## Source List/.test(md) && /DRAFT/.test(md));
  const [dh] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .html' }).click()]); ok(/-draft\.html$/.test(dh.suggestedFilename()) && /<h2>Executive Summary<\/h2>/.test(fs.readFileSync(await dh.path(), 'utf8')));
  const until = async (fn, what) => { for (let i = 0; i < 50; i++) { const v = await fn(); if (v) return v; await page.waitForTimeout(100); } throw new Error('never happened: ' + what); };
  await page.getByRole('button', { name: 'Copy the Slack summary' }).click(); const slack = await until(async () => { const s = await page.evaluate(() => navigator.clipboard.readText().catch(() => '')); return /Bottom line/.test(s) ? s : ''; }, 'the Slack summary on the clipboard'); ok(/\(draft\)/.test(slack) && !/\[M:/.test(slack));
  await page.getByRole('button', { name: 'Copy for the document' }).click();
  const rich = await until(() => page.evaluate(async () => { try { const it = await navigator.clipboard.read(); const h = it.find(i => i.types.indexOf('text/html') >= 0); return h ? (await (await h.getType('text/html')).text()) : ''; } catch (e) { return ''; } }), 'formatted text on the clipboard'); ok(/<h2>Executive Summary<\/h2>/.test(rich) && /<a href="https:\/\/pointpost\.example\.com\.au\/a">/.test(rich), 'headings and links travel with it');
});
await t('filing: what the strip holds and the brief does not is listed once; filed is read-only until reopened', async () => {
  await page.getByRole('button', { name: 'Mark as filed' }).click(); await page.waitForSelector('[role="dialog"][aria-label="Before it is filed"]'); const d = await txt(page, '[role="dialog"]'); ok(/not in this brief/.test(d) && /Sentinel spike: Gas taxation/.test(d) && /Facebook delivered nothing/.test(d), d.slice(0, 300));
  await page.getByRole('button', { name: 'Go back and cover them' }).click(); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.status, 'draft');
  await page.getByRole('button', { name: 'Mark as filed' }).click(); await page.getByRole('button', { name: 'File anyway' }).click(); await page.waitForFunction(() => /Filed by Anne/.test(document.querySelector('#den-tabpanel section.den-panel header').textContent));
  ok(await page.$eval('.den-sec[data-section="summary"] textarea', e => e.readOnly) && !(await page.$('button:has-text("Regenerate this section")')) && !(await page.$('button:has-text("Save changes")')), 'a filed brief is not edited');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download .md' }).click()]); ok(/^aep_au-\d{4}-\d\d-\d\d\.md$/.test(dl.suggestedFilename()) && !/DRAFT/.test(fs.readFileSync(await dl.path(), 'utf8')));
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
  await page.waitForFunction(() => /AEP Queensland - daily.*QLD only/.test(document.querySelector('.den-win').textContent)); eq(await page.getAttribute('.den-deskitem[aria-checked="true"]', 'data-desk'), 'aep_aep_queensland'); eq((await w.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_aep_queensland').sections[1].id, 'media', 'the new desk takes the sections of the desk it was made from');
  await desk(page, 'aep_au'); await page.waitForFunction(() => /AEP national/.test(document.querySelector('.den-win').textContent));
});
await t('every control in the Den has a name, the tabs are tabs, and nothing overflows at 1366, 1440 and 1920', async () => {
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) { await tab(page, name); await page.waitForTimeout(250);
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll('#den-root button, #den-root input, #den-root select, #den-root textarea, #den-root a[href]')).filter(e => { const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || ''; return !lab.trim(); }).map(e => e.outerHTML.slice(0, 120)));
    eq(bad, [], 'unnamed controls on ' + name);
    for (const wdt of [1366, 1440, 1920]) { await page.setViewportSize({ width: wdt, height: 900 }); const over = await page.evaluate(() => { const r = document.getElementById('den-root'); return Array.from(r.querySelectorAll('section.den-panel, .den-strip, .den-head, .den-tabs')).filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length + (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? 1 : 0); }); eq(over, 0, name + ' at ' + wdt + ' overflows'); } }
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
  await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row'); eq(await p.locator('#den-tabpanel button', { hasText: /^(Pin|Pinned|Set aside)$/ }).count(), 0); ok(await p.locator('section.den-panel[aria-label="Traditional media"] a.den-link').count() > 0, 'the sources still open');
  await tab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea'); ok(await p.$eval('.den-sec[data-section="summary"] textarea', e => e.readOnly)); eq(await p.locator('#den-tabpanel button', { hasText: /Draft again|Mark as filed|Save changes|Regenerate|Reopen/ }).count(), 0); ok(await p.getByRole('button', { name: 'Download .md' }).isVisible(), 'reading out is allowed');
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); eq(await p.locator('#den-tabpanel button', { hasText: /Find new keywords|Group into themes|^Approve|^Dismiss$|Switch off|^Delete$|^Add$/ }).count(), 0, 'a control that writes is shown on Watch');   // the Dismissed tab is a tab, not a control that writes
  await tab(p, 'collection'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); eq(await p.locator('#den-tabpanel button', { hasText: /Collect now|Switch on|Switch off/ }).count(), 0); ok(/Your key is read-only/.test(await txt(p, '.den-notice')));
  await tab(p, 'options'); await p.waitForSelector('section.den-panel[aria-label="The desk"]'); ok(await p.locator('section.den-panel[aria-label="The desk"] input').first().isDisabled() && !(await p.$('button:has-text("Save options")')));
  eq(p.served.filter(s => /^POST \/den\//.test(s)), [], 'and it sent no write'); await p.context().close();
});
await t('a desk with nothing collected says so in every panel, with the one place to look', async () => {
  const p = await open(w); await desk(p, 'guns_au'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent)); await p.waitForFunction(() => document.querySelectorAll('#den-tabpanel section.den-panel').length >= 5 && !/Loading/.test(document.querySelector('#den-tabpanel').textContent));
  ok(/News delivered nothing in this window/.test(await txt(p, '.den-strip')) && /before reading it as a quiet day/.test(await txt(p, '.den-strip')), 'the strip does not read an empty desk as a quiet day');
  for (const [title, why] of [['Traditional media', /No story on this desk's issues was filed in this window\. See what was collected, and why not/], ['Social', /No post on this desk's terms or from its registered accounts was collected/], ['Influencer and political', /No registered organisation, official or MP posted/], ['Upcoming', /No row in this window names a day and a month/]]) ok(why.test(await txt(p, 'section.den-panel[aria-label="' + title + '"]')), title);
  await p.locator('section.den-panel[aria-label="Social"] button.den-link').click(); ok(await p.$('#den-tab-collection[aria-selected="true"]')); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state');
  await p.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await p.waitForFunction(() => /Nothing on this desk was collected in the window/.test((document.querySelector('.toast, #toast') || {}).textContent || '')); ok(await p.getByRole('button', { name: 'Write it by hand' }).isEnabled());
  await p.getByRole('button', { name: 'Write it by hand' }).click(); await p.waitForSelector('.den-sec[data-section="judgement"] textarea'); eq(await p.$$eval('.den-sec h4', a => a.map(x => x.childNodes[0].textContent.trim())), ['Executive Summary', 'Today\'s Key Judgement', 'Key Developments', 'News environment', 'Organisational and influencer activity', 'Assessment of Activist Momentum', 'Implications for the client', 'Bottom Line', 'Source List']);
  eq(await p.$$eval('#den-tabpanel .den-bar .den-lab', a => a.map(x => x.childNodes[0].textContent.trim())), ['Overall activity level', 'Trend', 'Media risk', 'Social risk'], 'the firearms desk rates three things'); ok(!/edited by/.test(await txt(p, '#den-tabpanel')), 'a brief started by hand has no section marked as edited'); await p.context().close();
});
await t('Today reads the window once: the board\'s answer carries the strip, and the strip asks for itself only elsewhere', async () => {
  const p = await open(w); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row'); await p.waitForSelector('.den-strip li');
  const today = p.served.filter(x => /^GET \/den\/(board|missed)/.test(x)); ok(today.length === 1 && /^GET \/den\/board\?.*missed=1/.test(today[0]), 'one request for the board and the strip together: ' + today.join(' | '));
  ok(/Sentinel spike: Gas taxation/.test(await txt(p, '.den-strip')), 'and the strip is drawn from it');
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
  await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row', { timeout: 15000 }); ok(asked.length === 2 && asked[1] - asked[0] >= 2000, 'asked again a few seconds later, without a click: ' + asked.map(a => a - asked[0]).join(', '));
  await p.waitForSelector('.den-strip li'); await p.context().close(); w.hooks.length = 0;
  busy = 9; w.hooks.push(async (route, r, path) => { if (/^\/den\/(board|missed)/.test(path)) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'db_busy', retry: true, detail: 'The database is busy right now: too much is reading it at once. Nothing was changed. Try again in a few seconds.' }) }); return true; } return false; });
  const q2 = await open(w, 'full-key', { view: 'command' }); await q2.evaluate(() => go('den')); await q2.waitForSelector('#den-tabpanel .den-state.err', { timeout: 20000 });
  ok(/Today's evidence could not be loaded\. The database is busy right now/.test(await txt(q2, '#den-tabpanel .den-state.err')) && await q2.locator('#den-tabpanel .den-state.err button', { hasText: 'Try again' }).count(), 'after two more tries it says so in words, with Try again: ' + await txt(q2, '#den-tabpanel .den-state.err'));
  await q2.context().close(); w.hooks.length = 0;
});
await t('a failed read says what failed and tries again; a broken panel does not blank the page', async () => {
  let failBoard = 2; w.hooks.push(async (route, r, path) => { if (/^\/den\/board/.test(path) && failBoard > 0) { failBoard--; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; } return false; });
  const p = await open(w); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Today's evidence could not be loaded\. Something failed on the worker/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li'), 'the strip is still there');
  failBoard = 0; await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row');
  let breakIt = true; w.hooks.push(async (route, r, path) => { if (/^\/den\/collection/.test(path) && breakIt) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, channels: [null], reach: {} }) }); return true; } return false; });   // the right shape with something in it no panel can draw
  p.removeAllListeners('pageerror'); await tab(p, 'collection'); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Collection stopped working\. The rest of the page is unaffected/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li') && await p.$('button.den-deskcard'), 'the header and the strip survive');
  breakIt = false; await tab(p, 'today'); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row'); w.hooks.length = 0; await p.context().close();
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
  const p = await open(w); await p.waitForSelector('.den-strip li'); ok(/Facebook delivered nothing.*stopped at a verification on \d{4}-\d\d-\d\d and is paused/.test((await all(p, '.den-strip li')).join(' ')), (await all(p, '.den-strip li'))[0]);
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
  await p.waitForFunction(() => /Drafting \(a minute or two\)\.\.\./.test(document.querySelector('#den-tabpanel').textContent)); ok(await p.getByRole('button', { name: /Drafting/ }).isDisabled()); await tab(p, 'today'); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row');
  await tab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea', { timeout: 15000 }); eq(w3.calls.length, 1); await p.context().close();
});

/* ---- the redesigned interface (DEN.md s.10) ---- */
const AXE_SRC = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const axeBad = async pg => { await pg.waitForTimeout(300); return pg.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' at ' + x.nodes.slice(0, 6).map(n => n.target.join(' ') + ' [' + ((n.any[0] || {}).data ? (n.any[0].data.contrastRatio + ' ' + n.any[0].data.fgColor + ' on ' + n.any[0].data.bgColor) : '') + ']').join('; ')); }); };
await t('the figures are counts of the rows on the board, each tile opens its table, and the chart adds up', async () => {
  const w4 = await world(); const p = await open(w4, 'full-key', { width: 1366, height: 768 }); await tab(p, 'today'); await p.waitForSelector('.den-kpis');
  const media = await panel(p, 'Traditional media').locator('tr.den-row').count(); const social = await panel(p, 'Social').locator('tr.den-row').count(); const actors = await panel(p, 'Influencer and political').locator('tr.den-row').count();
  const tiles = await p.$$eval('.den-kpi', els => els.map(e => [e.querySelector('.k').textContent.trim(), e.querySelector('.v').textContent.trim()]));
  eq(tiles.map(x => x[0]), ['Stories', 'Social posts', 'Interactions', 'Narratives moving', 'In the report']); eq(tiles[0][1], String(media)); eq(tiles[1][1], String(social));
  const cols = await p.$$eval('.den-col', els => els.map(e => e.getAttribute('aria-label'))); eq(cols.length, 12);
  const sum = cols.reduce((a, l) => a + (l.match(/(\d+) (?=[A-Z])/g) || []).reduce((x, n) => x + parseInt(n, 10), 0), 0); eq(sum, media + social + actors, 'the chart holds every story and post once');
  await p.locator('.den-kpi').nth(1).click(); ok(await p.evaluate(() => { const a = document.activeElement; return !!(a && a.closest('section.den-panel[aria-label="Social"]')); }), 'the Social tile lands on a row of the Social table');
  await p.locator('.den-col:has(.s)').first().focus(); await p.waitForSelector('.den-tip'); ok(/\d/.test(await txt(p, '.den-tip')), 'a focused column says its figures');
  eq(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll at 1366'); await p.context().close();
});
await t('a desk with nothing collected draws no chart and no zero that reads as a quiet day', async () => {
  const w5 = await world(); await gapsOn(w5, ['mca_vic']);   // this journey asserts gaps (D10)
  const p = await open(w5); await desk(p, 'mca_vic'); await p.waitForFunction(() => /MCA/.test(document.querySelector('.den-win').textContent)); await tab(p, 'today'); await p.waitForSelector('.den-kpis');
  eq(await p.locator('.den-col').count(), 0); ok(/not the same as a quiet day/.test(await txt(p, '.den-card[aria-label="Volume through the window"]'))); eq(await txt(p, '.den-kpi:nth-child(3) .v'), '-'); await p.context().close();
});
await t('cards and the table hold the same rows in the same order, with the same actions and keys; the choice is kept', async () => {
  const w6 = await world(); const p = await open(w6); await tab(p, 'today'); const sec = panel(p, 'Traditional media'); await sec.locator('tr.den-row').first().waitFor();
  const asTable = await sec.locator('tr.den-row .den-t').allTextContents();
  await p.getByRole('button', { name: 'Cards', exact: true }).click(); await sec.locator('article.den-row').first().waitFor(); eq(await sec.locator('tr.den-row').count(), 0);
  eq(await sec.locator('article.den-row .den-t').allTextContents(), asTable);
  await sec.locator('article.den-row').first().focus(); await p.keyboard.press('j'); eq(await p.evaluate(() => Array.from(document.querySelectorAll('section.den-panel[aria-label="Traditional media"] article.den-row')).indexOf(document.activeElement)), 1, 'j moves to the next card');
  await p.keyboard.press('p'); await sec.locator('article.den-row.pinned').waitFor(); eq(await sec.locator('article.den-row.pinned').count(), 1);
  await p.reload(); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] article.den-row'); ok(true, 'cards are still chosen after a reload');
  eq(await axeBad(await (async () => { await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); return p; })()), [], 'cards pass axe');
  await p.getByRole('button', { name: 'Table', exact: true }).click(); await sec.locator('tr.den-row').first().waitFor(); await p.context().close();
});
await t('the dark theme is this person\'s choice, survives a reload, and passes axe on every tab', async () => {
  const w7 = await world(); await gapsOn(w7, ['aep_au']);   // the dark pass is of the screen with gaps drawn (D10): the strip's gap line, and every Collection tile with its state
  await w7.F('POST', '/den/brief', { desk: 'aep_au' }); const p = await open(w7, 'full-key', { width: 1366, height: 768 }); await tab(p, 'today'); await p.waitForSelector('.den-kpis');
  const bg = () => p.evaluate(() => getComputedStyle(document.querySelector('.den-main')).backgroundColor); const light = await bg();
  await p.getByRole('button', { name: 'Dark', exact: true }).click(); await p.waitForFunction(() => document.getElementById('den-root').dataset.theme === 'dark'); ok((await bg()) !== light, 'the workspace changed');
  await p.reload(); await p.waitForSelector('.den-kpis'); eq(await p.evaluate(() => document.getElementById('den-root').dataset.theme), 'dark');
  await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); const bad = [];
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) { await tab(p, name); (await axeBad(p)).forEach(x => bad.push(name + ': ' + x)); }
  eq(bad, []); await p.getByRole('button', { name: 'Light', exact: true }).click(); eq(await bg(), light); await p.context().close();
});
await t('the side menu is a tablist a keyboard can use, and Collection shows every delivering channel at a glance', async () => {
  const w8 = await world(); const p = await open(w8, 'full-key', { width: 1024, height: 768 }); await tab(p, 'collection'); await p.waitForSelector('.den-health .den-hc');
  eq(await p.locator('.den-health .den-hc').count(), await panel(p, 'Channels').locator('tr.den-row').count()); eq(await p.getByRole('button', { name: 'Collect now' }).count() > 0, true);
  eq(await p.getAttribute('.den-menu', 'aria-orientation'), 'vertical'); await p.focus('#den-tab-watch'); await p.keyboard.press('Enter'); await p.waitForSelector('#den-tab-watch[aria-selected="true"]');
  eq(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll at 1024'); await p.context().close();
});

await t('the brief: evidence opens beside the page without covering its actions, ratings are one press, Escape closes', async () => {
  const w9 = await world(); await w9.F('POST', '/den/brief', { desk: 'aep_au' }); const p = await open(w9, 'full-key', { width: 1366, height: 768 }); await tab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea');
  await p.locator('.den-sec[data-section="summary"]').getByRole('button', { name: /Show the evidence/ }).click(); await p.waitForSelector('.den-sheet .den-evrow.on'); ok((await p.locator('.den-sheet .den-evrow').count()) > 1, 'every evidence row is listed');
  eq(await p.$$eval('.den-sheet .den-evrow a', a => a.every(x => /^https?:/.test(x.href))), true); await p.getByRole('button', { name: 'Mark as filed' }).click({ trial: true });
  await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); eq(await axeBad(p), [], 'the brief with a sheet open passes axe');
  await p.keyboard.press('Escape'); await p.waitForSelector('.den-sheet', { state: 'detached' });
  const g = p.locator('#den-tabpanel [role="radiogroup"]').first(); const off = g.locator('[role="radio"][aria-checked="false"]').first(); const word = (await off.textContent()).trim(); await off.click(); eq((await g.locator('[aria-checked="true"]').textContent()).trim(), word); ok(/Unsaved/.test(await txt(p, '.den-save')));
  await p.getByRole('button', { name: 'Save changes' }).click(); await p.waitForFunction(() => /Saved/.test(document.querySelector('.den-save').textContent)); eq((await w9.F('GET', '/den/brief?desk=aep_au')).body.brief.ratings[Object.keys((await w9.F('GET', '/den/brief?desk=aep_au')).body.brief.ratings)[0]].level, word, 'the rating reached the worker');
  await p.context().close();
});
await t('the desk menu works by keyboard, the console stays docked across areas, and options and proposals pass axe', async () => {
  const w10 = await world(); await w10.F('POST', '/den/discover', { ns: 'aep' }); const p = await open(w10); await p.waitForSelector('button.den-deskcard');
  await p.focus('button.den-deskcard'); await p.keyboard.press('Enter'); await p.waitForSelector('.den-deskmenu:not([hidden])'); await p.keyboard.press('Escape'); await p.waitForSelector('.den-deskmenu', { state: 'hidden' });
  await desk(p, 'aep_vic'); await p.waitForFunction(() => /AEP Victoria/.test(document.querySelector('.den-win').textContent)); eq(await p.getAttribute('.den-deskitem[aria-checked="true"]', 'data-desk'), 'aep_vic'); await desk(p, 'aep_au'); await p.waitForFunction(() => /AEP national/.test(document.querySelector('.den-win').textContent));
  await tab(p, 'collection'); await p.locator('details.den-more > summary').click();   // by default (D10) a channel with no rows for this desk is inside the one disclosure
  await p.locator('details.den-more tr.den-row', { hasText: 'Bluesky' }).getByRole('button', { name: 'Collect now' }).click(); await p.waitForSelector('.den-dock .sig-con', { timeout: 15000 }); await w10.settle();
  await tab(p, 'today'); ok(await p.$('.den-dock .sig-con'), 'the console is still there on Today'); await p.getByRole('button', { name: 'Hide the console' }).click(); eq(await p.locator('.den-dock').count(), 0);
  await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); const bad = [];
  for (const name of ['watch', 'options', 'collection']) { await tab(p, name); (await axeBad(p)).forEach(x => bad.push(name + ': ' + x)); } eq(bad, []);
  await tab(p, 'options'); await p.getByRole('button', { name: 'Mutes', exact: true }).click(); ok(await p.evaluate(() => !!document.activeElement.closest('#den-tabpanel')), 'the index moves into the page');
  await p.context().close();
});

await t('by default the strip runs five checks and says nothing about a channel (D10)', async () => {
  const w11 = await world(); const p = await open(w11); await p.waitForSelector('.den-strip li');
  const lines = await all(p, '.den-strip li'); ok(lines.some(l => /Sentinel spike: Gas taxation/.test(l)) && !lines.some(l => /delivered nothing|Not collected/.test(l)), 'the spike is there and no gap line: ' + lines.join(' | '));
  ok(!/not collected/.test(await txt(p, '.den-strip header')) && !/six checks/.test(await txt(p, '.den-strip')));
  await desk(p, 'mca_vic'); await p.waitForFunction(() => /MCA Victoria/.test(document.querySelector('.den-win').textContent)); await p.waitForFunction(() => /five checks, nothing found/.test((document.querySelector('.den-strip header') || {}).textContent || ''));
  const strip = await txt(p, '.den-strip'); ok(/None of the five checks found anything in this window: no spike, no emerging narrative, no first-seen actor, no issue above its baseline, and no post far above its account's usual\./.test(strip), strip);
  ok(!/every channel/.test(strip) && !/six checks/.test(strip) && !/delivered/.test(strip) && !(await p.$('.den-strip li')), 'and it does not say every channel delivered: ' + strip);
  eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});

/* ---- the guided run (decision D10, 12 November 2026): Today one row at a time. Every case is its own world, opened as a
 * fresh profile ({ guided: true }: no row view was ever chosen). Lookups are scoped to the card, the done state or the
 * tray and the names are exact, because the footer's "Show what was set aside" and the header's "Next: write the brief"
 * hold the same words. ---- */
const gCard = p => p.locator('#den-focus'); const gHead = p => p.locator('#den-focus .den-focus-t').textContent(); const gBtn = (p, name) => gCard(p).getByRole('button', { name, exact: true });
const gSent = p => { const sent = []; p.on('request', r => { if (r.method() === 'POST' && /\/den\//.test(r.url())) sent.push([new URL(r.url()).pathname, JSON.parse(r.postData() || '{}')]); }); return sent; };
const gPosts = p => p.served.filter(s => /^POST \/den\//.test(s));
// the decision is over: another row is on the card and it is not busy, or the done state has taken its place
const gMoved = (p, was) => p.waitForFunction(h => { if (document.querySelector('.den-guide .den-done')) return true; const e = document.querySelector('#den-focus'); return !!e && e.getAttribute('aria-busy') !== 'true' && e.querySelector('.den-focus-t').textContent !== h; }, was);
const gShows = (p, h) => p.waitForFunction(x => { const e = document.querySelector('#den-focus'); return !!e && e.getAttribute('aria-busy') !== 'true' && e.querySelector('.den-focus-t').textContent === x; }, h);
const gBring = async (p, h) => { if ((await gHead(p)) !== h) await p.locator('.den-nextb', { has: p.locator('.t', { hasText: new RegExp('^' + h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) }).click(); await gShows(p, h); };
const gRail = (p, step, label) => p.waitForFunction(([id, want]) => { const e = document.querySelector('#den-step-' + id); return !!e && e.getAttribute('aria-label') === want; }, [step, label]);
const gOnCard = p => p.waitForFunction(() => document.activeElement && document.activeElement.id === 'den-focus', null, { timeout: 5000 }).catch(() => { throw new Error('the focus is not on the card'); });
const gOnDone = (p, name) => p.waitForFunction(n => { const a = document.activeElement; return !!(a && a.closest('.den-done') && a.classList.contains('primary') && a.textContent === n); }, name, { timeout: 5000 }).catch(() => { throw new Error('the focus is not on the done state\'s "' + name + '"'); });
const gReads = p => p.served.filter(s => /^GET \/den\/board/.test(s)).length;
const gReread = async (p, since) => { for (let i = 0; i < 150 && gReads(p) <= since; i++) await p.waitForTimeout(100); ok(gReads(p) > since, 'the board was not read again'); await p.waitForTimeout(500); };
const gRefresh = async p => { const n = gReads(p); await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await gReread(p, n); };
const gQueue = p => p.evaluate(() => ['#den-focus', '.den-next', '.den-traybox'].map(s => Array.from(document.querySelectorAll(s)).map(e => e.textContent).join(' ')).join(' '));   // the card, what is next and the tray: not the line that says what was just decided
const gClean = async p => { eq(p.errors, [], 'an uncaught error reached the page'); ok(!(await p.$('#den-tabpanel .den-state.err')), 'an error state is on the page'); };
const gBoard = async (wd, id) => (await wd.F('GET', '/den/board?desk=' + (id || 'aep_au') + '&missed=1')).body; const gRows = b => b.media.concat(b.social, b.actors); const gRow = (b, h) => gRows(b).find(r => (r.title || r.text) === h);
const gAgain = async (p, sel) => { await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => typeof go === 'function' && typeof denInit === 'function'); await p.evaluate(() => go('den')); await p.waitForSelector(sel, { timeout: 20000 }); };
const LEVY = 'Harbour levy divides the Senate', NOISY = 'Noisy outlet on the gas export tax ';

await t('a fresh profile opens Today in Guided: one card, the rail, a one-line strip and the next step in the header', async () => {
  const wg = await world(); const p = await open(wg, 'full-key', { guided: true }); const b = await gBoard(wg); const N = gRows(b).length; eq([N > 0, b.progress], [true, { total: N, kept: 0, aside: 0, left: N }]);
  eq(await p.evaluate(() => localStorage.getItem('ax_den_view')), null, 'no row view was chosen for this profile');
  eq([await p.locator('.den-kpis').count(), await gCard(p).count(), await p.locator('#den-tabpanel section.den-panel').count()], [0, 1, 0], 'no figures and no tables: one card');
  eq(await p.getByRole('button', { name: 'Guided', exact: true }).getAttribute('aria-pressed'), 'true'); ok(new RegExp('^Next to decide, 1 of ' + N + ': ').test(await gCard(p).getAttribute('aria-label')), await gCard(p).getAttribute('aria-label'));
  ok(/Triage, one row at a time/.test(await txt(p, '.den-toolbar')) && new RegExp(N + ' left of ' + N).test(await txt(p, '.den-toolbar')), await txt(p, '.den-toolbar'));
  // the queue: the row a signal is about, then by reach
  eq([await gHead(p), await gCard(p).locator('.den-chip.acc', { hasText: 'Signal' }).count()], [b.actors[0].text, 1], 'the first-seen account\'s own post leads'); eq((await p.$$eval('.den-nextb .t', e => e.map(x => x.textContent))).slice(0, 2), [LEVY, b.social[0].text], 'then the story with the most reach, then the post');
  // the strip is its header line; the signals are listed with the card (beside it, and under it on a narrow screen)
  ok(await p.$('.den-strip.den-compact'), 'the strip is not compact'); eq([await p.locator('.den-strip li').count(), await p.locator('.den-strip button').count()], [0, 0]); ok(new RegExp(b.missed.signals.length + ' to read, listed with the card').test(await txt(p, '.den-strip header')), await txt(p, '.den-strip header'));
  eq(await p.$$eval('#den-tray-signals > li .den-t', e => e.map(x => x.textContent)), b.missed.signals.map(s => s.title));
  // the rail and the header
  await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided'); eq(await p.$$eval('.den-rail .den-stepb', e => e.map(x => [x.id, x.getAttribute('aria-label'), x.getAttribute('aria-current')])), [['den-step-triage', 'Step 1, Triage: 0 of ' + N + ' decided', 'step'], ['den-step-write', 'Step 2, Write: not started', null], ['den-step-file', 'Step 3, File: nothing to file yet', null]]);
  eq([await p.getAttribute('.den-rail', 'aria-label'), await p.evaluate(() => !!document.querySelector('.den-rail').closest('#den-tabpanel, [role="tablist"]'))], ['Today\'s run', false], 'the rail is its own landmark, outside the tabs and the panel');
  eq([await txt(p, '#den-next'), await p.$eval('#den-next', e => e.classList.contains('primary'))], ['Next: write the brief, ' + N + ' not decided', true]);
  ok(!(await p.evaluate(() => !!document.activeElement.closest('.den-guide'))), 'the focus was moved when the page opened');
  // the two status lines are in the page before they have anything to say, so that what is put into them is read out; empty, they take no room
  eq(await p.$$eval('.den-guide-main > [role="status"]', e => e.map(x => [x.className, x.textContent, getComputedStyle(x).display !== 'none', x.getBoundingClientRect().height])), [['den-last', '', true, 0], ['den-say', '', true, 0]]);
  eq(await p.evaluate(() => { const c = document.querySelector('#den-focus').getBoundingClientRect(), n = document.querySelector('.den-next').getBoundingClientRect(), u = document.querySelector('.den-under').getBoundingClientRect(); return Math.round(n.top - u.bottom); }), 10, 'an empty status line opens a gap in the column');
  // the card says which signal queued it first, in words a keyboard reaches
  const named = await gCard(p).locator('.den-focus-sig').textContent(); ok(b.missed.signals.some(s => s.sig === 'first_seen' && named === 'Signal: ' + s.title), named);
  // an Up next button is named by what it shows: where it is from, the headline, and its mark
  const nb = await p.$$eval('.den-nextb', e => e.map(x => [x.getAttribute('aria-label'), x.querySelector('.k').textContent, x.querySelector('.t').textContent, (x.querySelector('.den-chip') || {}).textContent || ''])); ok(nb.length > 2 && nb.every(x => x[0].indexOf('Bring forward: ') === 0 && x[0].indexOf(x[2]) > 0 && (!x[3] || x[0].slice(-x[3].length - 2) === ', ' + x[3].toLowerCase())), JSON.stringify(nb));
  eq(nb[0][0], 'Bring forward: story: ' + nb[0][1] + ', ' + LEVY + (nb[0][3] ? ', signal' : ''));
  const reads = p.served.filter(x => /^GET \/den\/(board|missed)/.test(x)); ok(reads.length === 1 && /missed=1/.test(reads[0]), 'one read of the window: ' + reads.join(' | ')); eq([wg.calls.length, gPosts(p)], [0, []]);
  await gClean(p); await p.context().close();
});
await t('Guided: keep, set aside, another reason, Undo and Take out are each one request to the table\'s own routes; a folded story is one decision', async () => {
  const wg = await world(); const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const b = await gBoard(wg); const N = b.progress.total; const last = () => sent[sent.length - 1];
  const dk = (await wg.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_au'); const levy = gRow(b, LEVY); eq(levy.copies.length, 2); const n1 = gRow(b, NOISY + 1), n2 = gRow(b, NOISY + 2);
  // keep: the card as it opens
  const h1 = await gHead(p); const r1 = gRow(b, h1); const sec = dk.sections.find(s => s.kind === (b.media.indexOf(r1) >= 0 ? 'media' : b.social.indexOf(r1) >= 0 ? 'social' : 'actors')).title;
  await gBtn(p, 'Keep for the report').click(); await gMoved(p, h1); eq(sent, [['/den/pin', { desk: 'aep_au', item: r1.id }]], 'a keep is one pin');
  await gRail(p, 'triage', 'Step 1, Triage: 1 of ' + N + ' decided'); eq(await txt(p, '#den-next'), 'Next: write the brief, ' + (N - 1) + ' not decided'); ok((await txt(p, '.den-last')).indexOf('Kept for the report: ' + h1.replace(/[.\s]+$/, '') + '.') === 0, await txt(p, '.den-last'));
  eq(await p.locator('.den-tray .den-trayg').evaluateAll(g => g.map(x => [x.querySelector('h4').textContent, Array.from(x.querySelectorAll('li .t')).map(y => y.textContent)])), [[sec, [h1]]], 'the kept row is under its section of the report');
  // a folded story kept, then taken out: the clear names every copy
  await gBring(p, LEVY); await gBtn(p, 'Keep for the report').click(); await gMoved(p, LEVY); eq([sent.length, last()], [2, ['/den/pin', { desk: 'aep_au', item: levy.id }]]);
  await p.locator('.den-tray').getByRole('button', { name: 'Take out of the report: ' + LEVY, exact: true }).click(); await p.waitForFunction(() => !/Harbour levy/.test(document.querySelector('.den-traybox').textContent));
  eq([sent.length, last()], [3, ['/den/pin', { desk: 'aep_au', item: levy.id, clear: true, copies: levy.copies }]], 'Take out clears the story, every copy named'); ok(/Taken out of the report, and back in the queue: Harbour levy divides the Senate\./.test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  eq([gRow(await gBoard(wg), LEVY).pinned, await p.getAttribute('#den-step-triage', 'aria-label')], [false, 'Step 1, Triage: 1 of ' + N + ' decided']);
  // ... and set aside: one request with its copies, and it does not come back as its next copy
  await gBring(p, LEVY); let n = gReads(p); await gBtn(p, 'Set aside').click(); await gMoved(p, LEVY);
  eq([sent.length, last()], [4, ['/den/aside', { desk: 'aep_au', item: levy.id, reason: 'not relevant', copies: levy.copies }]], 'a folded story is one set-aside that names its copies'); ok(/^Set aside \(not relevant\): Harbour levy divides the Senate\./.test(await txt(p, '.den-last')));
  await gReread(p, n); ok(!/Harbour levy/.test(await gQueue(p)), 'the story came back when the board was read again'); const b2 = await gBoard(wg); eq([b2.media.some(m => /Harbour levy/.test(m.title)), b2.progress], [false, { total: N, kept: 1, aside: 1, left: N - 2 }]);
  await gRail(p, 'triage', 'Step 1, Triage: 2 of ' + N + ' decided');
  // a plain set-aside is "not relevant", in one press
  await gBring(p, n1.title); await gBtn(p, 'Set aside').click(); await gMoved(p, n1.title); eq([sent.length, last()], [5, ['/den/aside', { desk: 'aep_au', item: n1.id, reason: 'not relevant', copies: [n1.id] }]]);
  // another reason: going through the list files nothing; Use this reason files the one chosen
  await gBring(p, n2.title); const sel = gCard(p).locator('select[aria-label="Another reason"]'); eq(await gBtn(p, 'Use this reason').count(), 0); await sel.focus(); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400);
  ok((await sel.inputValue()) !== '' && sent.length === 5 && (await gHead(p)) === n2.title, 'arrowing through the reasons filed one: ' + (await sel.inputValue()) + ', ' + sent.length + ' requests');
  await sel.selectOption('other'); ok(await gCard(p).locator('input[aria-label="Your reason"]').isVisible() && await gBtn(p, 'Use this reason').isDisabled(), 'a reason of your own needs three characters');
  await sel.selectOption('duplicate'); await p.waitForTimeout(300); eq([sent.length, await gHead(p), await gCard(p).locator('input[aria-label="Your reason"]').count()], [5, n2.title, 0]);
  await gBtn(p, 'Use this reason').click(); await gMoved(p, n2.title); eq([sent.length, last()], [6, ['/den/aside', { desk: 'aep_au', item: n2.id, reason: 'duplicate', copies: [n2.id] }]]); ok(/^Set aside \(duplicate\): Noisy outlet on the gas export tax 2\./.test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  eq(await gCard(p).locator('select[aria-label="Another reason"]').inputValue(), '', 'the reason is reset for the next card'); await gRail(p, 'triage', 'Step 1, Triage: 4 of ' + N + ' decided');
  // Undo: the last decision only, cleared on the route that made it
  n = gReads(p); await p.locator('.den-last').getByRole('button', { name: 'Undo', exact: true }).click(); await gShows(p, n2.title);
  eq([sent.length, last()], [7, ['/den/aside', { desk: 'aep_au', item: n2.id, clear: true, copies: [n2.id] }]]); ok(/Undone\. Back on the card: Noisy outlet on the gas export tax 2\./.test(await txt(p, '.den-last')) && !(await p.locator('.den-last button').count()), await txt(p, '.den-last'));
  await gRail(p, 'triage', 'Step 1, Triage: 3 of ' + N + ' decided'); await gReread(p, n); eq(await gHead(p), n2.title, 'the row left the card when the board was read again');
  const b3 = await gBoard(wg); eq([b3.progress, b3.media.some(m => m.id === n2.id), b3.media.some(m => m.id === n1.id)], [{ total: N, kept: 1, aside: 2, left: N - 3 }, true, false]);
  ok(new RegExp((N - 3) + ' left of ' + N).test(await txt(p, '.den-toolbar')), await txt(p, '.den-toolbar')); eq(await p.getAttribute('#den-step-triage', 'aria-label'), 'Step 1, Triage: 3 of ' + N + ' decided'); eq(wg.calls.length, 0);
  await gClean(p); await p.context().close();
});
/* Three stories of three copies each and a fourth story, all found by one search term: the term is what a mute is offered on. */
const gFerry = async wd => { const row = (o, title, n, ts) => ({ src: o, title, body: 'The Senate will debate a gas export tax this week, campaigners said.', url: 'https://' + o + '.example.com.au/' + n, ts, meta: { issues: ['gastax'], source: o, q: 'ferry toll' } });
  const story = (name, n) => ['pointpost', 'tribune', 'coastwire'].map((o, i) => row(o, name + (i === 1 ? ' - Tribune' : ''), n, NOW - (6 - i) * H));
  await wd.push('news', story('Ferry toll splits the crossbench', 'f1').concat(story('Ferry toll vote is delayed a week', 'f2'), story('Ferry toll talks resume on Monday', 'f3'), [row('pointpost', 'Ferry toll inquiry reports in March', 'f4', NOW - H)])); };
const FERRY = ['Ferry toll splits the crossbench', 'Ferry toll vote is delayed a week', 'Ferry toll talks resume on Monday', 'Ferry toll inquiry reports in March'];
const gAside = async (p, h) => { await gBring(p, h); const res = p.waitForResponse(r => r.request().method() === 'POST' && /\/den\/aside$/.test(r.url())); await gBtn(p, 'Set aside').click(); const body = await (await res).json(); await gMoved(p, h); return body; };
await t('Guided: the mute is offered on the third decision, not the third copy, as a status line; Not now is remembered; Mute it mutes', async () => {
  const wg = await world(); await gFerry(wg); const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const b = await gBoard(wg); eq(FERRY.map(h => gRow(b, h).copies.length), [3, 3, 3, 1]);
  const a1 = await gAside(p, FERRY[0]); eq([sent.length, sent[0][1].copies, a1.copies.length, 'offer' in a1], [1, gRow(b, FERRY[0]).copies, 2, false], 'three copies set aside are one request and one decision: nothing is offered'); eq([await p.locator('.den-offer').count(), await p.locator('.den-say[role="status"]').count()], [0, 1], 'no offer yet, and the line it will be said on is already there');
  const a2 = await gAside(p, FERRY[1]); eq(['offer' in a2, await p.locator('.den-offer').count()], [false, 0], 'nor on the second story');
  const a3 = await gAside(p, FERRY[2]); eq([a3.offer.kind, a3.offer.value, a3.offer.n], ['term', 'ferry toll', 3]); await p.waitForSelector('.den-offer');
  eq([await p.$eval('.den-offer', e => e.parentElement.className + ':' + e.parentElement.getAttribute('role') + ':' + e.getAttribute('role')), await p.locator('#den-root [role="alert"]').count(), await p.locator('.den-offer .primary').count()], ['den-say:status:null', 0, 0], 'the offer is put into a status line that was already there: never an alert, never the main button');
  ok(/You have set aside 3 rows from ferry toll on this desk\. Mute it here\? A mute hides its rows on this desk only, and can be removed in Options\./.test(await txt(p, '.den-offer')), await txt(p, '.den-offer')); ok(/Ferry toll inquiry/.test(await gQueue(p)), 'the offer itself changed nothing: the fourth story is still in the queue');
  await p.locator('.den-offer').getByRole('button', { name: 'Not now', exact: true }).click(); await p.waitForSelector('.den-offer', { state: 'detached' }); eq(await p.evaluate(() => JSON.parse(localStorage.getItem('ax_den_offer_no_aep_au'))), ['term:ferry toll']); await gOnCard(p);
  const a4 = await gAside(p, FERRY[3]); eq(a4.offer.n, 4, 'the worker offers it again'); await p.waitForTimeout(400); eq(await p.locator('.den-offer').count(), 0, 'and the page, told Not now, does not ask again');
  eq([sent.length, sent.filter(s => s[0] === '/den/mute').length], [4, 0]); await gClean(p); await p.context().close();
  // another world: the mute itself
  const wm = await world(); await gFerry(wm); const q = await open(wm, 'full-key', { guided: true }); const sq = gSent(q); for (const h of FERRY.slice(0, 3)) await gAside(q, h); await q.waitForSelector('.den-offer'); ok(/Ferry toll inquiry/.test(await gQueue(q)));
  await q.locator('.den-offer').getByRole('button', { name: 'Mute it on this desk', exact: true }).click(); await q.waitForFunction(() => /Muted on this desk/.test((document.querySelector('.toast, #toast') || {}).textContent || '')); await q.waitForSelector('.den-offer', { state: 'detached' });
  eq(sq[sq.length - 1], ['/den/mute', { desk: 'aep_au', kind: 'term', value: 'ferry toll' }]); await q.waitForFunction(() => !/Ferry toll/.test(['#den-focus', '.den-next'].map(s => (document.querySelector(s) || {}).textContent || '').join(' ')));
  ok((await wm.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_au').options.mutes.some(m => m.kind === 'term' && m.value === 'ferry toll'), 'the mute is in the desk\'s options'); ok(!gRows(await gBoard(wm)).some(r => /Ferry toll/.test(r.title || '')));
  await q.waitForFunction(() => /\d+ muted/.test(document.querySelector('#den-tabpanel').textContent)); await gOnCard(q); await gClean(q); await q.context().close();
});
await t('Guided by keyboard: P, X, J, K, U and O act from the card only, the focus stays on the card, and the last decision lands on Write the brief', async () => {
  const wg = await world(); const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const b = await gBoard(wg); const N = b.progress.total; const later = () => p.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), 'ax_den_later_aep_au_' + b.missed.run.day);
  // from the body nothing happens
  const h0 = await gHead(p); for (const k of ['p', 'x', 'j', 'k', 'u', 'o', '3']) await p.keyboard.press(k); await p.waitForTimeout(400);
  eq([sent.length, await gHead(p), await later(), p.context().pages().length, await p.evaluate(() => document.activeElement === document.body)], [0, h0, [], 1, true], 'a key typed outside the card did something');
  // on an Up next button P and X do nothing; Enter is the button's own, and the focus follows the row to the card
  const nb = p.locator('.den-nextb').nth(1); const hA = await nb.locator('.t').textContent(); const A = gRow(b, hA); await nb.focus(); await p.keyboard.press('p'); await p.keyboard.press('x'); await p.waitForTimeout(400); eq([sent.length, await gHead(p)], [0, h0], 'P or X on an Up next button decided a row');
  await p.keyboard.press('Enter'); await gShows(p, hA); await gOnCard(p);
  // P keeps
  await p.keyboard.press('p'); await gMoved(p, hA); await gOnCard(p); eq(sent, [['/den/pin', { desk: 'aep_au', item: A.id }]]);
  // X sets aside as not relevant, at once
  const hB = await gHead(p); const B = gRow(b, hB); await p.keyboard.press('x'); await gMoved(p, hB); await gOnCard(p); eq([sent.length, sent[1][0], sent[1][1].item, sent[1][1].reason], [2, '/den/aside', B.id, 'not relevant']);
  // J leaves the card for later and K brings it back: neither is sent
  const hC = await gHead(p); const C = gRow(b, hC); await p.keyboard.press('j'); await gMoved(p, hC); await gOnCard(p); eq([sent.length, await later()], [2, [C.id]]); ok(/Left for later: /.test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  await p.keyboard.press('k'); await gShows(p, hC); await gOnCard(p); eq([sent.length, await later()], [2, []]);
  // U undoes the last decision, which was the set-aside
  await p.keyboard.press('u'); await gShows(p, hB); await gOnCard(p); eq([sent.length, sent[2][0], sent[2][1].item, sent[2][1].clear], [3, '/den/aside', B.id, true]);
  // O opens the source in a new tab
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.keyboard.press('o')]); await pop.waitForLoadState('domcontentloaded').catch(() => {}); eq(pop.url(), B.url, 'O opened something other than the row\'s source'); await pop.close(); await gOnCard(p); eq([sent.length, await gHead(p)], [3, hB]);
  // the Undo button and Take out leave the focus on the card too
  await p.keyboard.press('p'); await gMoved(p, hB); await gOnCard(p); await p.locator('.den-last').getByRole('button', { name: 'Undo', exact: true }).click(); await gShows(p, hB); await gOnCard(p); eq([sent.length, sent[4]], [5, ['/den/pin', Object.assign({ desk: 'aep_au', item: B.id, clear: true }, B.copies ? { copies: B.copies } : {})]]);
  await p.locator('.den-tray').getByRole('button', { name: 'Take out of the report: ' + hA, exact: true }).click(); await p.waitForFunction(() => /Nothing is kept yet/.test(document.querySelector('.den-traybox').textContent)); await gOnCard(p); eq([sent.length, await gHead(p)], [6, hB]);
  // every row decided from the keyboard: the focus lands on the done state's button, and Enter opens Brief
  for (let i = 0; i < N + 2 && await gCard(p).count(); i++) { const h = await gHead(p); await gOnCard(p); await p.keyboard.press('p'); await gMoved(p, h); }
  await p.waitForSelector('.den-guide .den-done.is-done'); await gOnDone(p, 'Write the brief'); eq([await gCard(p).count(), sent.length], [0, 6 + N]); eq(await txt(p, '.den-done p'), 'Triage is done. ' + N + ' kept for the report, 0 set aside.');
  await p.keyboard.press('Enter'); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('#den-tabpanel .den-state'); ok(/No brief has been started for this window/.test(await txt(p, '#den-tabpanel'))); eq(wg.calls.length, 0, 'opening Brief asked a model');
  // the button that was pressed left the page with Today: the focus goes to the area that opened, not to nowhere
  const onPanel = () => p.waitForFunction(() => document.activeElement && document.activeElement.id === 'den-tabpanel', null, { timeout: 5000 }).catch(() => { throw new Error('the focus fell to nowhere when Brief opened'); }); await onPanel();
  // and the header's action, which is not drawn on Brief when there is no next step
  await tab(p, 'today'); await p.waitForSelector('.den-guide .den-done'); eq(await txt(p, '#den-next'), 'Next: write the brief'); await p.focus('#den-next'); await p.keyboard.press('Enter'); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('#den-next', { state: 'detached' }); await onPanel();
  await gClean(p); await p.context().close();
});
await t('Guided: Decide later sends nothing, is kept for this desk and day through a reload, and the rail and the header count it', async () => {
  const wg = await world(); await wg.push('news', [1, 2].map(i => ({ src: 'minewire', title: 'Critical minerals strategy lands, part ' + i, body: 'A critical minerals processing plan was released this week.', url: 'https://minewire.example.com.au/' + i, ts: NOW - (2 + i) * H, meta: { issues: ['cm'], source: 'minewire' } })));
  const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const b = await gBoard(wg); const N = b.progress.total; const day = b.missed.run.day; const aepKey = 'ax_den_later_aep_au_' + day, mcaKey = 'ax_den_later_mca_au_' + day;
  const stored = () => p.evaluate(() => Object.keys(localStorage).filter(k => /^ax_den_later_/.test(k)).sort().map(k => [k, JSON.parse(localStorage.getItem(k))]));
  const h1 = await gHead(p); const r1 = gRow(b, h1); await gBtn(p, 'Decide later').click(); await gMoved(p, h1); await gOnCard(p); eq([sent.length, await stored()], [0, [[aepKey, [r1.id]]]]); ok(/^Left for later: /.test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  const railLater = 'Step 1, Triage: 0 of ' + N + ' decided, 1 for later'; await gRail(p, 'triage', railLater); eq(await txt(p, '#den-next'), 'Next: write the brief, ' + (N - 1) + ' not decided');
  eq((await p.$$eval('.den-nextb', e => e.map(x => [x.querySelector('.t').textContent, /left for later/.test((x.querySelector('.den-chip') || {}).textContent || '')]))).pop(), [h1, true], 'the row left for later goes last, and is marked');
  // a reload
  await gAgain(p, '.den-guide #den-focus'); await gRail(p, 'triage', railLater); ok((await gHead(p)) !== h1, 'the row left for later is the card again'); eq([await stored(), await txt(p, '#den-next')], [[[aepKey, [r1.id]]], 'Next: write the brief, ' + (N - 1) + ' not decided']);
  // another desk keeps its own
  const bm = await gBoard(wg, 'mca_au'); eq(bm.progress.total, 2); await desk(p, 'mca_au'); await p.waitForFunction(() => /MCA national/.test(document.querySelector('.den-win').textContent)); await gRail(p, 'triage', 'Step 1, Triage: 0 of 2 decided');
  const hm = await gHead(p); ok(/Critical minerals/.test(hm), hm); await gBtn(p, 'Decide later').click(); await gMoved(p, hm); await gRail(p, 'triage', 'Step 1, Triage: 0 of 2 decided, 1 for later'); eq(await stored(), [[aepKey, [r1.id]], [mcaKey, [gRow(bm, hm).id]]]);
  await desk(p, 'aep_au'); await p.waitForFunction(() => /AEP national/.test(document.querySelector('.den-win').textContent)); await gRail(p, 'triage', railLater); await p.waitForSelector('#den-focus');
  // leave the others: the done state, and still nothing sent
  await p.locator('.den-under').getByRole('button', { name: 'Leave the other ' + (N - 1) + ' for later', exact: true }).click(); await p.waitForSelector('.den-guide .den-done'); await gOnDone(p, 'Write the brief');
  eq([await txt(p, '.den-done p'), await p.locator('.den-done.is-done').count()], [N + ' left for later. 0 kept, 0 set aside.', 0]); await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided, ' + N + ' for later'); eq(await txt(p, '#den-next'), 'Next: write the brief');
  eq([sent.length, gPosts(p), (await stored())[0][1].length], [0, [], N]);
  await p.locator('.den-done').getByRole('button', { name: 'Go through the ' + N + ' left for later', exact: true }).click(); await p.waitForSelector('#den-focus'); await gOnCard(p); eq((await stored()).map(x => x[0]), [mcaKey]); await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided');
  eq([sent.length, gPosts(p)], [0, []]); await gClean(p); await p.context().close();
});
await t('Guided: the three done states, and their button opens Brief without a model call', async () => {
  // every row decided
  const wa = await world(); const b = await gBoard(wa); const N = b.progress.total; for (const r of gRows(b)) await wa.F('POST', '/den/aside', Object.assign({ desk: 'aep_au', item: r.id, reason: 'not relevant' }, r.copies ? { copies: r.copies } : {}));
  const p = await open(wa, 'full-key', { guided: true }); const main = pg => pg.locator('.den-done').getByRole('button', { name: 'Write the brief', exact: true }); await p.waitForSelector('.den-guide .den-done.is-done'); eq(await gCard(p).count(), 0);
  eq(await txt(p, '.den-done p'), 'Triage is done. 0 kept for the report, ' + N + ' set aside. Nothing is kept: a draft will choose from the whole window.');
  await gRail(p, 'triage', 'Step 1, Triage: done: 0 kept, ' + N + ' set aside'); ok(await p.$('.den-rail .den-step.is-done #den-step-triage'), 'the step is not marked done'); eq(await txt(p, '#den-next'), 'Next: write the brief');
  await wa.F('POST', '/den/aside', { desk: 'aep_au', item: b.social[0].id, clear: true }); await wa.F('POST', '/den/pin', { desk: 'aep_au', item: b.social[0].id }); await gRefresh(p); await p.waitForFunction(() => /1 kept for the report/.test((document.querySelector('.den-done p') || {}).textContent || ''));
  eq([await txt(p, '.den-done p'), await p.locator('.den-done .den-mini.primary').count(), await p.locator('.den-done button').count()], ['Triage is done. 1 kept for the report, ' + (N - 1) + ' set aside.', 1, 1]);
  await main(p).click(); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('#den-tabpanel .den-state'); ok(/No brief has been started for this window/.test(await txt(p, '#den-tabpanel'))); eq([wa.calls.length, gPosts(p)], [0, []], 'the button spent or wrote something');
  // a desk with nothing in the window: it says so without naming a channel
  await tab(p, 'today'); await desk(p, 'mca_vic'); await p.waitForFunction(() => /MCA Victoria/.test(document.querySelector('.den-win').textContent)); await p.waitForFunction(() => /Nothing to decide yet/.test((document.querySelector('.den-guide .den-done') || {}).textContent || ''));
  eq([await txt(p, '.den-done p'), await p.locator('.den-done.is-done').count()], ['Nothing to decide yet. No story or post on this desk\'s issues is in this window. A brief can still be written by hand.', 0]);
  ok(!/Facebook|Instagram|YouTube|Reddit|Bluesky|not collected|delivered|not read/i.test(await txt(p, '.den-guide')), 'the empty desk names a channel: ' + await txt(p, '.den-guide')); await gRail(p, 'triage', 'Step 1, Triage: nothing to decide');
  await p.locator('.den-done').getByRole('button', { name: 'Open Collection', exact: true }).click(); await p.waitForSelector('#den-tab-collection[aria-selected="true"]'); await tab(p, 'today'); await p.waitForSelector('.den-guide .den-done');
  await main(p).click(); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); eq([wa.calls.length, gPosts(p)], [0, []]); await gClean(p); await p.context().close();
  // only rows left for later
  const wl = await world(); const q = await open(wl, 'full-key', { guided: true }); await q.locator('.den-under button').click(); await q.waitForSelector('.den-guide .den-done'); eq([await txt(q, '.den-done p'), await q.locator('.den-done.is-done').count()], [N + ' left for later. 0 kept, 0 set aside.', 0]);
  ok(await q.locator('.den-done').getByRole('button', { name: 'Go through the ' + N + ' left for later', exact: true }).isVisible()); await main(q).click(); await q.waitForSelector('#den-tab-brief[aria-selected="true"]'); await q.waitForSelector('#den-tabpanel .den-state');
  ok(/No brief has been started for this window/.test(await txt(q, '#den-tabpanel'))); eq([wl.calls.length, gPosts(q)], [0, []]); await gClean(q); await q.context().close();
});
await t('Guided: the tray follows the brief - in the brief, not in the brief, each signal as the filing check reads it, and filed', async () => {
  const wg = await world(); const b = await gBoard(wg); const levy = gRow(b, LEVY); await wg.F('POST', '/den/pin', { desk: 'aep_au', item: levy.id }); eq((await wg.F('POST', '/den/brief', { desk: 'aep_au' })).status, 200); eq(wg.calls.length, 1);
  const rb = (await gBoard(wg)).missed.run.brief; ok(rb && rb.status === 'draft' && rb.cited.indexOf(levy.id) >= 0 && rb.written >= 200 && rb.open.length > 0, 'the draft cites the kept story and leaves a signal open: ' + JSON.stringify(rb));
  const p = await open(wg, 'full-key', { guided: true }); const box = () => txt(p, '.den-traybox');
  eq([await txt(p, '#den-next'), await p.$$eval('.den-rail .den-stepb', e => e.slice(1).map(x => x.getAttribute('aria-label')))], ['Next: read the draft', ['Step 2, Write: draft', 'Step 3, File: not filed']]);
  ok(/Harbour levy divides the Senate ?in the brief/.test(await box()) && /1 kept, 0 set aside\. Every kept row is in the brief\./.test(await box()), await box());
  // each signal reads as the worker's own filing check does
  const sig = await p.$$eval('#den-tray-signals > li', li => li.map(x => [x.querySelector('.den-t').textContent, /Not in the brief yet/.test(x.textContent) ? 'open' : /In the brief/.test(x.textContent) ? 'in' : '?']));
  eq(sig, b.missed.signals.map(s => [s.title, rb.open.indexOf(s.key) >= 0 ? 'open' : 'in'])); ok(sig.some(s => /Sentinel spike/.test(s[0]) && s[1] === 'open'), JSON.stringify(sig)); eq(await p.locator('#den-tray-signals button', { hasText: 'Bring forward' }).count(), 0);
  // a row kept after the draft: the page knows only that the brief does not cite it, and says that
  await gBring(p, NOISY + 1); await gBtn(p, 'Keep for the report').click(); await gMoved(p, NOISY + 1);
  ok(/Noisy outlet on the gas export tax 1 ?not in the brief/.test(await box()) && /Harbour levy divides the Senate ?in the brief/.test(await box()), await box());
  ok(/1 kept row is not in the brief\. Draft again or regenerate a section there \(each is one model call, stated there\), or write them in\./.test(await box()), await box());
  await gRail(p, 'write', 'Step 2, Write: draft, 1 kept row not in it'); eq(await txt(p, '#den-next'), 'Next: read the draft');
  await p.locator('.den-tray').getByRole('button', { name: 'Open the brief', exact: true }).click(); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('.den-sec[data-section="summary"] textarea'); eq(wg.calls.length, 1, 'opening the brief asked a model');
  // filed, on the page: the header and the rail know at once, from the Brief panel's own word
  await p.getByRole('button', { name: 'Mark as filed', exact: true }).click(); await p.getByRole('button', { name: 'File anyway', exact: true }).click(); await p.waitForFunction(() => /Filed by Anne/.test((document.querySelector('#den-tabpanel section.den-panel:not([hidden]) header') || {}).textContent || ''));
  await p.waitForFunction(() => /Filed today/.test((document.querySelector('#den-next') || {}).textContent || '')); eq(await p.$eval('#den-next', e => e.classList.contains('primary')), false);
  ok(await p.$('.den-rail .den-step.is-done #den-step-write') && await p.$('.den-rail .den-step.is-done #den-step-file') && /^Step 3, File: filed by Anne, /.test(await p.getAttribute('#den-step-file', 'aria-label')), await p.getAttribute('#den-step-file', 'aria-label'));
  await tab(p, 'today'); await p.waitForSelector('#den-focus'); eq(await txt(p, '#den-next'), 'Filed today'); ok(/Today's brief is filed\. Reopen it there to change it\./.test(await box()), await box());
  await p.locator('.den-under button').click(); await p.waitForSelector('.den-guide .den-done'); eq(await p.locator('.den-done .den-mini.primary').textContent(), 'Open the filed brief');
  await p.locator('.den-done').getByRole('button', { name: 'Open the filed brief', exact: true }).click(); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); ok(await p.getByRole('button', { name: 'Reopen', exact: true }).isVisible(), 'the filed brief is not what opened');
  eq([wg.calls.length, gPosts(p).filter(x => !/brief\/file/.test(x))], [1, ['POST /den/pin']], 'one draft through the API, one keep on the page, and the filing'); await gClean(p); await p.context().close();
});
await t('Guided: a refresh never swaps the card under a person; a row decided elsewhere leaves it, and that is said', async () => {
  const wg = await world(); const p = await open(wg, 'full-key', { guided: true }); const b = await gBoard(wg); const N = b.progress.total; const row = gRow(b, NOISY + 3);
  await gBring(p, row.title); await gRefresh(p); eq(await gHead(p), row.title, 'a refresh put another row on the card');
  eq((await wg.F('POST', '/den/pin', { desk: 'aep_au', item: row.id }, 'other-key')).status, 200); eq(await gHead(p), row.title);   // kept by someone else: the page has not been told yet
  await gRefresh(p); await gMoved(p, row.title); ok(new RegExp('That row is already decided\\. ' + (N - 1) + ' left\\.').test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  ok(await p.evaluate(() => /Refresh/.test(document.activeElement.textContent || '')), 'the focus was on Refresh, and the new card took it');
  eq(await p.$$eval('.den-trayg li .t', e => e.map(x => x.textContent)), [row.title], 'the tray holds the row kept elsewhere'); ok((await p.$$eval('.den-nextb .t', e => e.map(x => x.textContent))).indexOf(row.title) < 0, 'and it is not in the queue');
  await gRail(p, 'triage', 'Step 1, Triage: 1 of ' + N + ' decided'); eq(gPosts(p), []);
  // the same while the focus is on the card (the read that follows a decision comes by itself): the card that takes its place is given the focus, so P, X and J still act
  const row2 = gRow(b, NOISY + 2); await gBring(p, row2.title); await gOnCard(p); eq((await wg.F('POST', '/den/pin', { desk: 'aep_au', item: row2.id }, 'other-key')).status, 200);
  const n2 = gReads(p); await p.evaluate(() => Array.from(document.querySelectorAll('#den-app .den-head button')).find(x => /Refresh/.test(x.textContent)).click()); await gReread(p, n2); await gMoved(p, row2.title); await gOnCard(p);
  eq(gPosts(p), []); await gClean(p); await p.context().close();
});
await t('Guided: two decisions made while a slow read of the board is in flight are not undone when it lands', async () => {
  // the board is read when it is asked, and that answer is held back until the case lets it go: it lands after both decisions and holds neither
  const wg = await world(); let hold = false, held = 0, release; const gate = new Promise(r => { release = r; });
  wg.hooks = [async (route, r, path) => { if (!hold || r.method() !== 'GET' || !/^\/den\/board/.test(path)) return false; hold = false; const res = await wg.call('GET', path, null, r.headers()['x-axiom-key'] || null); held = 1; await gate; await route.fulfill({ status: res.status, contentType: 'application/json', body: res.text }); held = 2; return true; }];
  const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const N = (await gBoard(wg)).progress.total; await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided'); const r0 = gReads(p);
  const state = () => p.evaluate(() => ({ card: (document.querySelector('#den-focus .den-focus-t') || {}).textContent || '', next: Array.from(document.querySelectorAll('.den-nextb .t')).map(e => e.textContent), tray: Array.from(document.querySelectorAll('.den-trayg li .t')).map(e => e.textContent), rail: document.querySelector('#den-step-triage').getAttribute('aria-label'), note: document.querySelector('.den-toolbar .den-note').textContent }));
  hold = true; await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); for (let i = 0; i < 100 && held < 1; i++) await p.waitForTimeout(50); eq(held, 1, 'a read made before either decision is in flight');
  const hA = await gHead(p); await gBtn(p, 'Keep for the report').click(); await gMoved(p, hA); const hB = await gHead(p); await gBtn(p, 'Set aside').click(); await gMoved(p, hB); eq([held, sent.length], [1, 2], 'both decisions were made inside the slow read');
  const check = s => { ok(s.card !== hA && s.card !== hB && s.next.indexOf(hA) < 0 && s.next.indexOf(hB) < 0, 'a decided row came back to the queue: ' + JSON.stringify(s)); eq([s.tray, s.rail, s.note], [[hA], 'Step 1, Triage: 2 of ' + N + ' decided', (N - 2) + ' left of ' + N], 'the tray or the count went back'); };
  check(await state()); release(); for (let i = 0; i < 100 && held < 2; i++) await p.waitForTimeout(20); eq(held, 2, 'the slow answer was not let go');
  const t0 = Date.now(); while (Date.now() - t0 < 4000) { check(await state()); await p.waitForTimeout(120); }   // the slow answer has landed or been dropped, and the page has read the board again
  ok(gReads(p) >= r0 + 2, 'the board was not read again after the decisions'); eq((await gBoard(wg)).progress, { total: N, kept: 1, aside: 1, left: N - 2 }); check(await state());
  wg.hooks = []; await gClean(p); await p.context().close();
});
await t('Guided: a keep that fails changes nothing on the page and is said; the next press works', async () => {
  const wg = await world(); let fail = true; wg.hooks = [async (route, r, path) => { if (fail && r.method() === 'POST' && /^\/den\/pin/.test(path)) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; } return false; }];
  const p = await open(wg, 'full-key', { guided: true }); const N = (await gBoard(wg)).progress.total; await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided');
  const state = async () => [await gHead(p), await txt(p, '.den-toolbar .den-note'), await p.getAttribute('#den-step-triage', 'aria-label'), await txt(p, '#den-next'), await txt(p, '.den-traybox'), (await p.$$eval('.den-nextb .t', e => e.map(x => x.textContent))).join(' | ')]; const before = await state(); eq(await txt(p, '.den-last'), '');
  await gBtn(p, 'Keep for the report').click(); await p.waitForFunction(() => /Something failed on the worker/.test((document.querySelector('.toast, #toast') || {}).textContent || '')); await p.waitForFunction(() => document.querySelector('#den-focus').getAttribute('aria-busy') === 'false');
  eq(await state(), before, 'the page moved though the keep was not saved'); ok(await gBtn(p, 'Keep for the report').isEnabled(), 'the card stayed locked'); await gOnCard(p); eq((await gBoard(wg)).progress.kept, 0);
  eq(await txt(p, '.den-last'), 'Not saved: Something failed on the worker; nothing more was done.', 'the status line, which is always there to be read out, does not say the keep failed');
  await p.waitForTimeout(1800); eq(await state(), before, 'nothing changed a moment later either');
  fail = false; await gBtn(p, 'Keep for the report').click(); await gMoved(p, before[0]); ok(!/Not saved/.test(await txt(p, '.den-last')), await txt(p, '.den-last'));
  // a decision that fails just after one that was saved: the read that confirms the saved one is still made
  const rN = gReads(p); const h2 = await gHead(p); fail = true; await gBtn(p, 'Keep for the report').click(); await p.waitForFunction(() => /Not saved: Something failed/.test(document.querySelector('.den-last').textContent)); eq(await gHead(p), h2);
  for (let i = 0; i < 60 && gReads(p) <= rN; i++) await p.waitForTimeout(100); ok(gReads(p) > rN, 'the failed decision cancelled the read that confirms the one before it, and it was never asked again');
  fail = false; await gRail(p, 'triage', 'Step 1, Triage: 1 of ' + N + ' decided'); eq((await gBoard(wg)).progress.kept, 1);
  wg.hooks = []; await gClean(p); await p.context().close();
});
await t('Guided with a read-only key: the card and its source, Next row through the queue, and no control or request that writes', async () => {
  const wg = await world(); const b = await gBoard(wg); const N = b.progress.total; const kept = gRow(b, 'Producers answer the windfall tax push'); await wg.F('POST', '/den/pin', { desk: 'aep_au', item: kept.id });
  const p = await open(wg, 'read-key', { guided: true }); await p.waitForFunction(() => window.AX_ROLE === 'read'); await p.waitForSelector('.den-head .den-chip.warn'); await p.waitForFunction(() => /Your key is read-only/.test((document.querySelector('#den-focus') || {}).textContent || ''));
  ok(/Your key is read-only: keeping and setting aside need a full key\./.test(await txt(p, '#den-focus')), await txt(p, '#den-focus'));
  eq([await p.locator('#den-root button', { hasText: /^(Keep for the report|Set aside|Take out|Decide later|Undo|Use this reason)$/ }).count(), await p.locator('#den-root button', { hasText: /Leave the other/ }).count(), await p.locator('#den-focus select, #den-focus input').count()], [0, 0, 0], 'a control that writes is shown');
  eq(await p.$$eval('.den-trayg li .t', e => e.map(x => x.textContent)), [kept.title], 'the kept row is listed, with no way to take it out'); ok(/^https:\/\//.test(await gCard(p).locator('a.den-focus-src').getAttribute('href')), 'the source still opens');
  // Next row goes through the queue in order and wraps, and leaves nothing for later
  const order = [await gHead(p)].concat(await p.$$eval('.den-nextb .t', e => e.map(x => x.textContent))); eq(order.length, N - 1); const seen = [order[0]];
  for (let i = 0; i < N - 1; i++) { await gBtn(p, 'Next row').click(); await p.waitForFunction(h => document.querySelector('#den-focus .den-focus-t').textContent !== h, seen[seen.length - 1]); seen.push(await gHead(p)); }
  eq(seen, order.concat([order[0]]), 'Next row left the order of the queue, or did not wrap'); await gCard(p).focus(); await p.keyboard.press('p'); await p.keyboard.press('x'); await p.waitForTimeout(400); eq(await gHead(p), order[0], 'P or X did something for a read-only key');
  eq(await p.evaluate(() => Object.keys(localStorage).filter(k => /^ax_den_later_/.test(k))), [], 'a row was left for later'); eq([await p.getAttribute('#den-step-triage', 'aria-label'), await txt(p, '#den-next')], ['Step 1, Triage: 1 of ' + N + ' decided', 'Open the brief']);
  // every row decided by someone with a full key: the done state's button and the header both open the brief
  for (const r of gRows(b)) if (r.id !== kept.id) await wg.F('POST', '/den/aside', Object.assign({ desk: 'aep_au', item: r.id, reason: 'not relevant' }, r.copies ? { copies: r.copies } : {}));
  await gRefresh(p); await p.waitForSelector('.den-guide .den-done.is-done'); eq([await p.locator('.den-done .den-mini.primary').textContent(), await txt(p, '#den-next'), await p.locator('.den-done button').count()], ['Open the brief', 'Open the brief', 1]);
  await p.locator('.den-done').getByRole('button', { name: 'Open the brief', exact: true }).click(); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); eq([gPosts(p), wg.calls.length], [[], 0], 'it sent a write, or asked a model'); await gClean(p); await p.context().close();
});
await t('the row view is this person\'s choice and is kept through a reload; in Table the header\'s Next: triage lands on a row still to decide', async () => {
  const wg = await world(); await wg.F('GET', '/narratives/status'); wg.env.MIND_DB.db.prepare("INSERT INTO narratives(id,label,issues,n,n24,first_ts,last_ts,status,muted,side,spread) VALUES('n1','Gas giants dodge the levy',?,8,7,?,?,'growing',0,'hostile','[]')").run(JSON.stringify(['gastax']), NOW - 20 * H, NOW - H);
  const b0 = await gBoard(wg); await wg.F('POST', '/den/pin', { desk: 'aep_au', item: b0.media[0].id }); const b = await gBoard(wg); const N = b.progress.total; eq([b.narratives.length, b.media[0].pinned, b.media[1].pinned], [1, true, false]);
  const p = await open(wg, 'full-key', { guided: true }); const view = () => p.evaluate(() => localStorage.getItem('ax_den_view')); const media = 'section.den-panel[aria-label="Traditional media"] tr.den-row';
  await p.getByRole('button', { name: 'Table', exact: true }).click(); await p.waitForSelector(media); eq([await p.locator('.den-guide').count(), await p.locator('.den-kpis').count(), await view()], [0, 1, '"table"']);
  await gAgain(p, media); eq([await p.locator('.den-guide').count(), await p.getByRole('button', { name: 'Table', exact: true }).getAttribute('aria-pressed')], [0, 'true'], 'Table was not kept through a reload');
  eq([await panel(p, 'Key narratives').locator('tr.den-row').count(), await panel(p, 'Traditional media').locator('tr.den-row.pinned').count()], [1, 1]);
  // from Watch, the header's next step is triage: it opens Today and puts the focus on the first row not yet decided
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); await p.waitForSelector('#den-next'); eq(await txt(p, '#den-next'), 'Next: triage, ' + (N - 1) + ' left');
  await p.click('#den-next'); await p.waitForSelector('#den-tab-today[aria-selected="true"]'); await p.waitForFunction(() => !!(document.activeElement && document.activeElement.closest('#den-tabpanel .den-row')), null, { timeout: 15000 });
  eq(await p.evaluate(() => { const a = document.activeElement; return [a.tagName, a.classList.contains('pinned'), a.closest('section.den-panel').getAttribute('aria-label'), a.querySelector('.den-t').textContent]; }), ['TR', false, 'Traditional media', b.media[1].title], 'the focus is not on the first story still to decide');
  // Guided again, and that is kept too
  await p.getByRole('button', { name: 'Guided', exact: true }).click(); await p.waitForSelector('.den-guide #den-focus'); eq([await view(), await p.locator('.den-kpis').count()], ['"guided"', 0]);
  await gAgain(p, '.den-guide #den-focus'); eq([await p.locator('.den-kpis').count(), await p.locator('#den-tabpanel section.den-panel').count(), await p.getByRole('button', { name: 'Guided', exact: true }).getAttribute('aria-pressed')], [0, 0, 'true'], 'Guided was not kept through a reload');
  await gClean(p); await p.context().close();
});
await t('the rail off Today has the day\'s figures without reading the board, and a change of tab or desk never blanks it or shows another desk\'s', async () => {
  const wg = await world(); const b = await gBoard(wg); const N = b.progress.total; await wg.F('POST', '/den/pin', { desk: 'aep_au', item: b.social[0].id }); const label = 'Step 1, Triage: 1 of ' + N + ' decided';
  const p = await open(wg, 'full-key', { guided: true }); await p.evaluate(() => localStorage.setItem('ax_den_tab', '"brief"')); p.served.length = 0; await gAgain(p, '#den-tab-brief[aria-selected="true"]'); await gRail(p, 'triage', label);
  eq(await p.$$eval('.den-rail .den-stepb', e => e.map(x => [x.getAttribute('aria-label'), x.getAttribute('aria-current')])), [[label, null], ['Step 2, Write: not started', 'step'], ['Step 3, File: nothing to file yet', null]]);
  ok(p.served.some(s => /^GET \/den\/missed/.test(s)) && !p.served.some(s => /^GET \/den\/board/.test(s)), 'the board was read though Today was never opened: ' + p.served.filter(s => /den\/(board|missed)/.test(s)).join(' | '));
  eq([await txt(p, '#den-next'), await p.$eval('#den-next', e => e.classList.contains('primary'))], ['Back to triage, ' + (N - 1) + ' left', false]);
  // every state the rail passes through from here on, with the desk it was drawn for
  await p.evaluate(() => { window.__rail = []; window.__fig = []; const add = (l, s) => { if (l[l.length - 1] !== s) l.push(s); };
    const rec = () => { const a = Array.from(document.querySelectorAll('.den-rail .den-stepb')); const who = ((document.querySelector('.den-win') || {}).textContent || '').split(' - ')[0]; const step = a[0] ? a[0].getAttribute('aria-label') : ''; add(window.__rail, who + ' | ' + a.length + ' | ' + step); add(window.__fig, who + ' | ' + step + ' | ' + ((document.querySelector('#den-next') || {}).textContent || '-')); };
    rec(); new MutationObserver(rec).observe(document.getElementById('den-root'), { subtree: true, childList: true, attributes: true, characterData: true }); });
  for (const name of ['watch', 'collection', 'options', 'today']) { await tab(p, name); await p.waitForTimeout(400); } await p.waitForSelector('.den-guide #den-focus'); await tab(p, 'brief'); await p.waitForTimeout(400);
  eq(await p.evaluate(() => window.__rail), ['AEP national | 3 | ' + label], 'the rail changed while only the tab did');
  await desk(p, 'mca_vic'); await gRail(p, 'triage', 'Step 1, Triage: nothing to decide'); await p.waitForTimeout(300); await desk(p, 'aep_au'); await gRail(p, 'triage', label); await p.waitForTimeout(300);
  const seen = await p.evaluate(() => window.__rail); ok(seen.length >= 3 && seen.every(s => /^(AEP national \| 3 \| Step 1, Triage: (reading|1 of \d+ decided)|MCA Victoria \| 3 \| Step 1, Triage: (reading|nothing to decide))$/.test(s)), 'the rail went blank, or showed one desk\'s figures under another: ' + seen.join(' // '));
  const fig = await p.evaluate(() => window.__fig); ok(fig.every(s => /^(AEP national \| Step 1, Triage: (reading \| -|1 of \d+ decided \| (Back to triage|Next: triage|Next: write the brief), \d+ (left|not decided))|MCA Victoria \| Step 1, Triage: (reading|nothing to decide) \| -)$/.test(s)), 'the header\'s next step was drawn from another desk\'s figures: ' + fig.join(' // '));
  await gClean(p);
  // the strip's read is where those figures come from. Opened on Brief with that read failing, the rail names its steps and says nothing
  // of them: it does not say "reading" for good under a strip that says the checks could not be loaded. One press recovers both
  let down = true; wg.hooks = [async (route, r, path) => { if (!down || r.method() !== 'GET' || !/^\/den\/missed/.test(path)) return false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; }];
  p.served.length = 0; await gAgain(p, '.den-strip .den-state.err'); ok(/The checks could not be loaded\./.test(await txt(p, '.den-strip')) && !p.served.some(s => /^GET \/den\/board/.test(s)), await txt(p, '.den-strip')); await p.waitForTimeout(400);
  eq([await p.$$eval('.den-rail .den-stepb', e => e.map(x => x.getAttribute('aria-label'))), await p.$$eval('.den-rail .den-stepb .s', e => e.length), await p.locator('#den-next').count()], [['Step 1, Triage', 'Step 2, Write', 'Step 3, File'], 0, 0], 'the rail says it is reading though the read has failed');
  down = false; await p.locator('.den-strip').getByRole('button', { name: 'Try again', exact: true }).click(); await gRail(p, 'triage', label); await p.waitForSelector('#den-next'); wg.hooks = []; eq(p.errors, []);
  await p.context().close();
});
await t('Guided with showGaps on: the strip stays whole above the card, gaps first, and a gap opens Collection', async () => {
  const wg = await world(); await gapsOn(wg, ['aep_au']);   // this case asserts gaps (D10)
  await wg.push('sig_thread', [{ src: 'x', title: 'x post', body: 'A quiet word on the windfall tax on gas.', url: 'https://x.com/i/web/status/190000000000000777', ts: NOW - 2 * H, meta: { platform: 'x', issues: ['gastax'], id: 'pq', layers: [2] } }]);
  const p = await open(wg, 'full-key', { guided: true }); await p.waitForSelector('.den-strip li'); eq([await p.locator('.den-strip.den-compact').count(), await gCard(p).count()], [0, 1], 'the strip is compact though a channel delivered nothing');
  const lines = await all(p, '.den-strip li'); ok(/Facebook delivered nothing/.test(lines[0]) && /not granted/.test(lines[0]), lines[0]); ok(await p.locator('.den-strip').getByRole('button', { name: 'Fold', exact: true }).isVisible());
  ok(await p.evaluate(() => !!(document.querySelector('.den-strip').compareDocumentPosition(document.querySelector('#den-focus')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'the strip is not above the card');
  // as cards, with the option on: a figure that is not held says so, as before the decision, and the cards pass axe
  await p.getByRole('button', { name: 'Cards', exact: true }).click(); const noFb = panel(p, 'Traditional media').locator('article.den-row', { hasText: 'Producers answer' }); await noFb.waitFor();
  ok(/no Facebook reach held/.test(await noFb.locator('.den-mc-f').textContent()), await noFb.locator('.den-mc-f').textContent()); ok(/no counts held/.test(await panel(p, 'Social').locator('article.den-row', { hasText: 'A quiet word' }).locator('.den-mc-f').textContent()), 'a post with no counts, as a card, with the option on');
  await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); eq(await axeBad(p), [], 'cards with showGaps on'); await p.getByRole('button', { name: 'Guided', exact: true }).click(); await p.waitForSelector('.den-guide #den-focus');
  await p.locator('.den-strip li').first().locator('button.den-link').click(); await p.waitForSelector('#den-tab-collection[aria-selected="true"]'); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row'); await gClean(p); await p.context().close();
});
await t('Guided passes axe, names every control and overflows nowhere at 1366, 1440 and 1920, light and dark, with the card and with a done state', async () => {
  const wg = await world(); const p = await open(wg, 'full-key', { guided: true }); await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); const bad = [];
  const look = async where => { for (const theme of ['Light', 'Dark']) { await p.getByRole('button', { name: theme, exact: true }).click(); await p.waitForFunction(v => document.getElementById('den-root').dataset.theme === v, theme.toLowerCase());
    for (const wdt of [1366, 1440, 1920]) { await p.setViewportSize({ width: wdt, height: 900 }); const at = where + ', ' + theme.toLowerCase() + ' at ' + wdt;
      const over = await p.evaluate(() => Array.from(document.querySelectorAll('#den-root .den-rail, #den-root .den-guide, #den-root .den-guide-main, #den-root .den-focus, #den-root .den-done, #den-root .den-next, #den-root .den-tray, #den-root .den-traybox, #den-root .den-strip, #den-root .den-head, #den-root .den-tabs')).filter(e => e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.className).concat(document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? ['the page'] : []));
      if (over.length) bad.push(at + ' overflows: ' + over.join(', '));
      const unnamed = await p.evaluate(() => Array.from(document.querySelectorAll('#den-root button, #den-root input, #den-root select, #den-root textarea, #den-root a[href]')).filter(e => { const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || ''; return !lab.trim(); }).map(e => e.outerHTML.slice(0, 120)));
      if (unnamed.length) bad.push(at + ' has unnamed controls: ' + unnamed.join(' '));
      (await axeBad(p)).forEach(x => bad.push(at + ': ' + x)); } } };
  // the card, with a row kept and a reason chosen: the tray, the last line with its Undo and the whole action row are drawn
  const h = await gHead(p); await gBtn(p, 'Keep for the report').click(); await gMoved(p, h); await gCard(p).locator('select[aria-label="Another reason"]').selectOption('other'); await gBtn(p, 'Use this reason').waitFor();
  eq([await p.locator('.den-rail .den-stepb').count(), await p.locator('.den-trayg li').count(), await p.locator('.den-last button').count(), await p.locator('.den-nextb').count() > 0], [3, 1, 1, true]); await look('the card');
  await p.locator('.den-under button').click(); await p.waitForSelector('.den-guide .den-done'); eq(await gCard(p).count(), 0); await look('a done state');
  eq(bad, [], 'Guided'); await p.setViewportSize({ width: 1440, height: 900 }); await gClean(p); await p.context().close();
});
// a request held back until the case lets it go: arm() holds the next one that matches; it is answered by the worker at once
// and handed to the page only on release()
const gHold = (wd, method, rx) => { const h = { on: false, held: 0, release: () => {} };
  wd.hooks = (wd.hooks || []).concat([async (route, r, path) => { if (!h.on || r.method() !== method || !rx.test(path)) return false; h.on = false; const res = await wd.call(method, path, r.postData() || null, r.headers()['x-axiom-key'] || null); await new Promise(go => { h.release = go; h.held = 1; }); await route.fulfill({ status: res.status, contentType: 'application/json', body: res.text }).catch(() => {}); h.held = 2; return true; }]);
  h.arm = () => { h.on = true; h.held = 0; }; h.wait = async p => { for (let i = 0; i < 240 && h.held < 1; i++) await p.waitForTimeout(25); eq(h.held, 1, 'the request was not held'); }; return h; };
const gOnDesk = (p, name) => p.waitForFunction(n => document.querySelector('.den-win').textContent.indexOf(n) === 0, name);
await t('Guided: a key held down decides one row, and a decision still in flight when the desk is changed puts nothing of the last desk on this one', async () => {
  const wg = await world(); const hold = gHold(wg, 'POST', /^\/den\/(pin|aside)/); const p = await open(wg, 'full-key', { guided: true }); const sent = gSent(p); const N = (await gBoard(wg)).progress.total; await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided');
  // X held down: the first keydown is the decision. Its repeats are not kept for the next card while it is in flight, and decide nothing once it shows
  const h1 = await gHead(p); await gCard(p).focus(); hold.arm(); await p.keyboard.down('x'); await hold.wait(p); await p.keyboard.down('x'); await p.keyboard.down('x'); hold.release(); await gMoved(p, h1); await gOnCard(p); const h2 = await gHead(p);
  await p.keyboard.down('x'); await p.keyboard.down('x'); await p.waitForTimeout(700); await p.keyboard.up('x'); eq([sent.length, await gHead(p)], [1, h2], 'a key held down decided more than one row');
  await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.keyboard.down('Enter'); await p.waitForTimeout(600); await p.keyboard.up('Enter'); const pops = p.context().pages().filter(x => x !== p); eq(pops.length, 1, 'Enter held on the card opened the source more than once'); await pops[0].close(); await gOnCard(p);
  await p.waitForTimeout(1900);   // the read that follows the set-aside has been made
  // Keep, and before it answers the desk is changed: the answer belongs to the desk that was left
  hold.arm(); await gBtn(p, 'Keep for the report').click(); await hold.wait(p); await desk(p, 'mca_vic'); await gOnDesk(p, 'MCA Victoria'); await p.waitForSelector('.den-guide .den-done'); await gRail(p, 'triage', 'Step 1, Triage: nothing to decide');
  p.served.length = 0; hold.release(); for (let i = 0; i < 100 && hold.held < 2; i++) await p.waitForTimeout(20); await p.waitForTimeout(2600);
  eq([await p.locator('.den-guide .den-done').count(), await p.locator('#den-tabpanel .den-load').count(), await p.getAttribute('#den-step-triage', 'aria-label'), p.served.filter(s => /^GET \/den\/(board|missed)\?desk=aep_au/.test(s))], [1, 0, 'Step 1, Triage: nothing to decide', []], 'the desk that was left was read again, and its board put on this one');
  ok(/five checks, nothing found/.test(await txt(p, '.den-strip header')), await txt(p, '.den-strip header'));
  // the decision itself was saved, and is there on the desk it was made on
  await desk(p, 'aep_au'); await gOnDesk(p, 'AEP national'); await gRail(p, 'triage', 'Step 1, Triage: 2 of ' + N + ' decided'); eq((await gBoard(wg)).progress, { total: N, kept: 1, aside: 1, left: N - 2 });
  wg.hooks = []; await gClean(p); await p.context().close();
});
await t('the rail keeps this desk\'s figures when Today is opened after the desk was changed elsewhere, and a focus asked for on a visit that was left is not carried into the next', async () => {
  const wg = await world(); const hold = gHold(wg, 'GET', /^\/den\/board/); const p = await open(wg, 'full-key', { guided: true }); const N = (await gBoard(wg)).progress.total; await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided');
  // on Watch the desk is changed, and Today is opened while its board is still being read
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); await desk(p, 'mca_vic'); await gOnDesk(p, 'MCA Victoria'); await gRail(p, 'triage', 'Step 1, Triage: nothing to decide'); await p.waitForSelector('#den-next');
  hold.arm(); await tab(p, 'today'); await hold.wait(p); await p.waitForTimeout(300);
  eq([await p.getAttribute('#den-step-triage', 'aria-label'), await p.locator('#den-next').count(), await p.locator('#den-tabpanel .den-load').count() > 0], ['Step 1, Triage: nothing to decide', 1, true], 'while this desk\'s board was being read, the rail took the answer handed over for the last desk');
  hold.release(); await p.waitForSelector('.den-guide .den-done'); await gRail(p, 'triage', 'Step 1, Triage: nothing to decide');
  // back on the AEP desk, from Watch: "Next: triage" asks for the focus, and the person leaves Today before the board has come
  await desk(p, 'aep_au'); await gOnDesk(p, 'AEP national'); await p.waitForSelector('.den-guide #den-focus'); await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); await p.waitForFunction(() => /^Next: triage, /.test((document.querySelector('#den-next') || {}).textContent || ''));
  hold.arm(); await p.click('#den-next'); await p.waitForSelector('#den-tab-today[aria-selected="true"]'); await hold.wait(p); await tab(p, 'brief'); hold.release(); await p.waitForSelector('#den-tabpanel .den-state'); await p.waitForTimeout(300);
  // Today again, by its tab: nothing asked for the focus on this visit, so it stays on the tab that was pressed
  await tab(p, 'today'); await p.waitForSelector('.den-guide #den-focus'); await p.waitForTimeout(600); eq(await p.evaluate(() => [document.activeElement.id, !!document.activeElement.closest('.den-guide')]), ['den-tab-today', false], 'the focus was pulled into the card by a request made on an earlier visit');
  // asked for and not left, it still lands on the card
  await tab(p, 'watch'); await p.waitForSelector('#den-tabpanel section.den-panel:visible'); await p.click('#den-next'); await p.waitForSelector('.den-guide #den-focus'); await gOnCard(p);
  wg.hooks = []; await gClean(p); await p.context().close();
});
await t('Guided: when the day turns with the page left open, yesterday\'s rows left for later are not carried into today', async () => {
  const wg = await world(); const b = await gBoard(wg); const N = b.progress.total; const day = b.missed.run.day; const yest = new Date(Date.parse(day + 'T00:00:00Z') - D).toISOString().slice(0, 10); let back = true;
  // the worker's answers say it is still yesterday, until the case lets the day turn
  wg.hooks = [async (route, r, path) => { if (!back || r.method() !== 'GET' || !/^\/den\/(board|missed)/.test(path)) return false; const res = await wg.call('GET', path, null, r.headers()['x-axiom-key'] || null); const d = JSON.parse(res.text); const run = d.missed ? d.missed.run : d.run; if (run) run.day = yest; await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(d) }); return true; }];
  const p = await open(wg, 'full-key', { guided: true }); const stored = () => p.evaluate(() => Object.keys(localStorage).filter(k => /^ax_den_later_/.test(k)).sort().map(k => [k, JSON.parse(localStorage.getItem(k))]));
  const h1 = await gHead(p); const r1 = gRow(b, h1); await gBtn(p, 'Decide later').click(); await gMoved(p, h1); eq(await stored(), [['ax_den_later_aep_au_' + yest, [r1.id]]]); await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided, 1 for later');
  back = false; await gRefresh(p); await p.waitForFunction(k => !localStorage.getItem(k), 'ax_den_later_aep_au_' + yest); eq(await stored(), [], 'yesterday\'s list was written again under today'); await gRail(p, 'triage', 'Step 1, Triage: 0 of ' + N + ' decided');
  ok(!(await p.$$eval('.den-nextb .den-chip', e => e.some(x => /left for later/.test(x.textContent)))), 'a row is still marked as left for later'); eq(await txt(p, '#den-next'), 'Next: write the brief, ' + N + ' not decided');
  // a row left today is kept under today
  const h2 = await gHead(p); await gBtn(p, 'Decide later').click(); await gMoved(p, h2); eq(await stored(), [['ax_den_later_aep_au_' + day, [gRow(b, h2).id]]]);
  wg.hooks = []; await gClean(p); await p.context().close();
});

/* ---- decision D10 on the page (12 November 2026; DEN.md s.11): by default the Den shows what is working and says nothing
 * of what is not. Every case is its own world with the option as it ships (showGaps off). What is hidden is one press
 * away, inside Collection's one disclosure, and is asserted there. ---- */
const D10 = /delivered nothing|not collected|not granted|not connected|No Mac collector|no collector|switched off|paused|not read|Cannot reach|refuses|collected by no layer|no Facebook reach|why not|nothing in the last day|no counts|was collected|not the same as a quiet day/i;
// what a person can see or be told of the Den: its text as drawn (a closed disclosure and a hidden panel are not drawn), and the title and aria-label of every element that is drawn
const dSeen = p => p.evaluate(() => { const v = document.querySelector('#v-den'); const drawn = e => !e.closest('[hidden]') && !e.closest('details:not([open]) > :not(summary)') && (typeof e.checkVisibility !== 'function' || e.checkVisibility());
  return { text: v.innerText, stance: Array.from(v.querySelectorAll('section.den-panel[aria-label="Key narratives"] tr.den-row .den-chip')).filter(e => drawn(e) && e.textContent === 'not read yet').length, said: Array.from(v.querySelectorAll('[title], [aria-label]')).filter(drawn).reduce((a, e) => a.concat([e.getAttribute('title'), e.getAttribute('aria-label')]), []).filter(Boolean) }; });
// "not read yet" on a narrative is a stance not judged yet, not a channel (plan 4.1): that chip is taken out, once for each one drawn, before
// the list is applied, so the same words anywhere else on the screen are still caught
const dSays = async (p, where) => { const s = await dSeen(p); let text = s.text; for (let i = 0; i < s.stance; i++) text = text.replace('not read yet', ''); s.text = text; const out = []; const m = D10.exec(s.text); if (m) out.push(where + ' says "' + s.text.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\s+/g, ' ') + '"'); s.said.forEach(a => { if (D10.test(a)) out.push(where + ' has the title or label "' + a.slice(0, 160) + '"'); }); return out; };
const dIdle = p => p.waitForFunction(() => !Array.from(document.querySelectorAll('#v-den .den-load')).some(e => !e.closest('[hidden]')));   // nothing that is drawn is still loading
const DTAB = { today: '.den-guide #den-focus, .den-guide .den-done, #den-tabpanel .den-kpis', brief: '#den-tabpanel .den-state, .den-sec textarea', watch: 'section.den-panel[aria-label="Waiting for a person"]', collection: 'section.den-panel[aria-label="Channels"]', options: 'section.den-panel[aria-label="The desk"]' };
const dTab = async (p, name) => { await tab(p, name); await p.waitForSelector(DTAB[name]); await dIdle(p); };
const dView = async (p, view) => { await p.getByRole('button', { name: view, exact: true }).click(); await p.waitForSelector(view === 'Guided' ? '.den-guide #den-focus, .den-guide .den-done' : '#den-tabpanel .den-kpis'); await dIdle(p); };
const dDesk = async (p, id, name) => { await desk(p, id); await p.waitForFunction(n => document.querySelector('.den-win').textContent.indexOf(n) === 0, name); await dIdle(p); };
// opened, the disclosure reads the register for "To finish setting up". The panel is new on every visit to the tab, and reads on its
// first opening: that read, of this visit, is waited for (it fails the case if it never comes) and then given a moment to be drawn
const dMore = async p => { const shut = !(await p.$('details.den-more[open]')); const first = shut && !(await p.evaluate(() => !!document.querySelector('details.den-more').__read));
  const read = first ? p.waitForResponse(x => /\/den\/watch\?ns=/.test(x.url()), { timeout: 20000 }) : null; if (read) read.catch(() => {});
  if (shut) await p.locator('details.den-more > summary').click(); await p.waitForSelector('details.den-more[open] section.den-panel[aria-label="Signed-in collection"]');
  if (read) { await read; await p.evaluate(() => { document.querySelector('details.den-more').__read = 1; }); } await dIdle(p); await p.waitForTimeout(250); };
const dShut = async p => { if (await p.$('details.den-more[open]')) await p.locator('details.den-more > summary').click(); await p.waitForSelector('details.den-more:not([open])'); };
const dTiles = p => p.$$eval('.den-health .den-hc', e => e.map(x => [x.querySelector('.k').textContent, x.className.replace('den-hc', '').trim()])); const dListed = p => p.$$eval('section.den-panel[aria-label="Channels"] tr.den-row .den-t', e => e.map(x => x.textContent));
const dIn = (p, sel) => p.evaluate(s => { const a = document.activeElement; return !!(a && a.closest(s)); }, sel);
const FB_GAP = /Facebook delivered nothing/;

await t('by default the strip draws no gap: listed, folded, read by itself on another tab, on an empty desk and in Guided (D10)', async () => {
  const wd = await world(); const ms = (await wd.F('GET', '/den/missed?desk=aep_au')).body; eq([ms.checks, ms.signals.filter(s => s.sig === 'gap').length, ms.signals.length > 0], [5, 0, true], 'the worker ran a sixth check, or found nothing at all');
  const p = await open(wd); await p.waitForSelector('.den-strip li'); const lines = await all(p, '.den-strip li'); eq(lines.length, ms.signals.length); ok(!lines.some(l => /delivered nothing|Not collected/.test(l)), lines.join(' | '));
  ok(new RegExp('^Nothing critical missed ?' + ms.signals.length + ' to read ?computed, no model').test(await txt(p, '.den-strip header')), await txt(p, '.den-strip header'));
  // folded, the header counts what is to read and has no "not collected" mark
  await p.locator('.den-strip').getByRole('button', { name: 'Fold', exact: true }).click(); await p.waitForFunction(() => !document.querySelector('.den-strip li')); eq([await p.locator('.den-strip header .den-chip').count(), /not collected/.test(await txt(p, '.den-strip header'))], [0, false]);
  await p.locator('.den-strip').getByRole('button', { name: 'Show', exact: true }).click(); await p.waitForSelector('.den-strip li');
  // on another tab the strip asks for itself: the same answer
  p.served.length = 0; await dTab(p, 'watch'); await p.waitForSelector('.den-strip li'); ok(p.served.some(s => /^GET \/den\/missed/.test(s)), 'the strip did not read for itself off Today'); ok(!(await all(p, '.den-strip li')).some(l => /delivered nothing|Not collected/.test(l)));
  // an empty desk: five checks, and no sentence about what every channel delivered
  await dTab(p, 'today'); await dDesk(p, 'mca_vic', 'MCA Victoria'); await p.waitForFunction(() => /five checks, nothing found/.test((document.querySelector('.den-strip header') || {}).textContent || ''));
  const strip = await txt(p, '.den-strip'); ok(/None of the five checks found anything in this window: no spike, no emerging narrative, no first-seen actor, no issue above its baseline, and no post far above its account's usual\.$/.test(strip), strip); ok(!/six checks|every channel|delivered/.test(strip), strip);
  await dView(p, 'Guided'); await p.waitForSelector('.den-strip.den-compact'); ok(/five checks, nothing found/.test(await txt(p, '.den-strip header')) && !(await p.$('.den-strip li')) && !(await p.$('.den-strip button')), await txt(p, '.den-strip header'));
  eq(await dSays(p, 'the empty desk in Guided'), []); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('filing by default: the dialog lists the spike the brief leaves out, and no channel (D10)', async () => {
  const wd = await world(); eq((await wd.F('POST', '/den/brief', { desk: 'aep_au' })).status, 200); const open0 = (await gBoard(wd)).missed.run.brief.open; ok(open0.length > 0 && !open0.some(k => /^G:/.test(k)), 'what the filing check holds open: ' + open0.join(', '));
  const p = await open(wd); await dTab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea');
  await p.getByRole('button', { name: 'Mark as filed', exact: true }).click(); await p.waitForSelector('[role="dialog"][aria-label="Before it is filed"]'); const d = await txt(p, '[role="dialog"]');
  ok(/not in this brief/.test(d) && /Sentinel spike: Gas taxation/.test(d), d.slice(0, 300)); eq(await p.locator('[role="dialog"] ul.den-ev > li').count(), open0.length, 'the dialog lists what the worker\'s own check holds open');
  ok(!/Facebook|Instagram|YouTube|Reddit|Bluesky/.test(d) && !D10.test(d), 'the dialog names a channel: ' + d);
  await p.getByRole('button', { name: 'File anyway', exact: true }).click(); await p.waitForFunction(() => /Filed by Anne/.test((document.querySelector('#den-tabpanel section.den-panel:not([hidden]) header') || {}).textContent || ''));
  eq((await wd.F('GET', '/den/brief?desk=aep_au')).body.brief.status, 'filed'); eq(await dSays(p, 'the filed brief'), []); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('nothing on screen says what was not collected, or why: every tab of a desk with rows and of an empty desk, in Guided, Table and Cards (D10)', async () => {
  const wd = await world(); const bad = [];
  // rows that each drew a reason before the decision: a post with no counts held, a story with no Facebook figure, a registered account whose read failed
  await wd.push('sig_thread', [{ src: 'x', title: 'x post', body: 'A quiet word on the windfall tax on gas.', url: 'https://x.com/i/web/status/190000000000000777', ts: NOW - 2 * H, meta: { platform: 'x', issues: ['gastax'], id: 'pq', layers: [2] } }]);
  eq(wd.env.MIND_DB.db.prepare("UPDATE den_watch SET last_error=? WHERE ns='aep' AND kind='account' AND platform='facebook'").run('ppca_missing: this app may not read public pages').changes, 1);
  // a registered public actor's post with no counts, and a narrative whose stance is not judged yet
  const acct = wd.env.MIND_DB.db.prepare("SELECT id FROM den_watch WHERE ns='aep' AND kind='account' AND platform='x'").get().id;
  await wd.push('sig_thread', [{ src: 'x', title: 'x post', body: 'Harbour Watch meets on Thursday about the gas export tax.', url: 'https://x.com/i/web/status/190000000000000778', ts: NOW - 2 * H, meta: { platform: 'x', issues: ['gastax'], id: 'pb', watch: acct, actor: { id: acct, name: 'Harbour Watch', kind: 'org' }, layers: [2] } }]);
  await wd.F('GET', '/narratives/status'); wd.env.MIND_DB.db.prepare("INSERT INTO narratives(id,label,issues,n,n24,first_ts,last_ts,status,muted,side,spread) VALUES('n1','Gas giants dodge the levy',?,8,7,?,?,'growing',0,'','[]')").run(JSON.stringify(['gastax']), NOW - 20 * H, NOW - H);
  const b = await gBoard(wd); const bare = b.social.find(s => /A quiet word/.test(s.text)); const mute = b.actors.find(a => /meets on Thursday/.test(a.text));
  ok(bare && !bare.total && mute && !mute.total && b.media.some(m => m.fb) && b.media.some(m => !m.fb) && b.narratives.length === 1 && !b.narratives[0].side, 'the world holds a post and an actor\'s post with no counts, a story with no Facebook figure and a narrative with no stance yet');
  const p = await open(wd, 'full-key', { guided: true });
  // every string the decision replaced, by name: none is drawn anywhere
  const OLD = ['no counts are held for these posts', 'Nothing on this desk was collected in this window', 'That is not the same as a quiet day', 'See what was collected, and why not', 'No channel delivered a row for this desk in this window', 'Comment text on Facebook and Instagram is collected by no layer', 'no Facebook reach held', 'no counts held', 'No Facebook reach is held for this story', 'No counts are held for this post', 'No read from yesterday to compare with', 'no read from yesterday to compare', 'No comment under this post is held', 'was collected in this window', 'No collector reads', 'ppca_missing', 'Collection says which channels read, and why not'];
  const look = async where => { await dIdle(p); (await dSays(p, where)).forEach(x => bad.push(x)); const s = await dSeen(p); const whole = s.text + '\n' + s.said.join('\n'); OLD.forEach(o => { if (whole.indexOf(o) >= 0) bad.push(where + ' still says "' + o + '"'); }); if (await p.$('#den-tabpanel .den-state.err')) bad.push(where + ' shows an error state'); };
  const cell = async td => [(await td.textContent()).trim(), await td.getAttribute('title'), await td.locator('[title]').count()];
  for (const [id, name] of [['aep_au', 'AEP national'], ['mca_vic', 'MCA Victoria']]) {
    if (id !== 'aep_au') { await dTab(p, 'today'); await dDesk(p, id, name); }
    for (const view of ['Guided', 'Table', 'Cards']) { await dTab(p, 'today'); await dView(p, view);
      for (const area of view === 'Cards' ? ['today'] : ['today', 'brief', 'watch', 'collection', 'options']) { await dTab(p, area); const at = name + ', ' + view + ', ' + area; await look(at);
        if (area === 'collection') { eq(await p.locator('.den-hc.bad, .den-hc.off').count(), 0, at + ': a tile is drawn as failing or off'); eq(await p.locator('details.den-more[open]').count(), 0, at + ': the disclosure is open'); }
        if (area === 'watch' && id === 'aep_au') { await p.getByRole('tab', { name: /^Accounts/ }).click(); await p.waitForSelector('section.den-panel[aria-label="Accounts"] tr.den-row'); const fb = panel(p, 'Accounts').locator('tr.den-row', { hasText: 'harbourwatchpage' });
          eq(await cell(fb.locator('td').nth(3)), ['-', null, 0], at + ': an account never read'); ok(!/not yet/.test(await txt(p, 'section.den-panel[aria-label="Accounts"]')), at + ': the register says "not yet"');
          const add = panel(p, 'Add to the register'); await add.locator('select').first().selectOption('account'); await add.locator('select').nth(1).selectOption('tiktok'); eq(await add.locator('p.den-mono').textContent(), 'An account on TikTok is kept as a note.'); await look(at + ', the register\'s accounts'); await add.locator('select').first().selectOption('term'); await p.getByRole('tab', { name: /^Proposals/ }).click(); }
        if (area === 'today' && id === 'aep_au' && view === 'Table') {
          const cols = await p.$$eval('.den-col', e => e.map(x => x.getAttribute('aria-label'))); ok(cols.length === 12 && cols.some(l => /: none$/.test(l)) && cols.some(l => /\d (News|X)/.test(l)) && !cols.some(l => /nothing collected/.test(l)), 'a step of the chart with nothing in it ends ": none": ' + cols.join(' | '));
          eq(await panel(p, 'Key narratives').locator('tr.den-row .den-chip').allTextContents(), ['not read yet', 'growing'], 'a narrative not judged yet says so: that is a stance, not a channel, and it stays');
          eq(await p.$eval('.den-kpi:nth-child(3)', e => [/^\d/.test(e.querySelector('.v').textContent), e.querySelector('.f').textContent, / read|compare/.test(e.getAttribute('aria-label'))]), [true, '-', false], 'posts with counts and none read yesterday: the Interactions tile says nothing of it');
          eq(await cell(panel(p, 'Influencer and political').locator('tr.den-row', { hasText: 'meets on Thursday' }).locator('td').nth(3)), ['-', null, 0], 'an actor\'s post with no counts');
          eq(await panel(p, 'Traditional media').locator('thead th').allTextContents(), ['Story', 'Outlet', 'Outlets', 'Facebook', 'When', '']); eq(await cell(panel(p, 'Traditional media').locator('tr.den-row', { hasText: 'Producers answer' }).locator('td').nth(3)), ['-', null, 0], 'a story with no Facebook figure');
          const q = panel(p, 'Social').locator('tr.den-row', { hasText: 'A quiet word' }).locator('td'); eq([await cell(q.nth(2)), await cell(q.nth(3)), await cell(q.nth(4))], [['-', null, 0], ['-', null, 0], ['-', null, 0]], 'a post with no counts, no read from yesterday and no comment held');
          eq(await txt(p, '.den-card[aria-label="Tone under the posts"] .den-body'), 'No comment under this window\'s posts is held, so there is no tone to show.'); }
        if (area === 'today' && id === 'aep_au' && view === 'Cards') {
          ok(/\d on Facebook/.test(await panel(p, 'Traditional media').locator('article.den-row', { hasText: LEVY }).locator('.den-mc-f').textContent()), 'a figure that is held is still drawn');
          eq(await panel(p, 'Traditional media').locator('article.den-row', { hasText: 'Producers answer' }).locator('.den-mc-f').textContent(), '1 outletsubscriber', 'a story with no Facebook figure, as a card');
          eq(await panel(p, 'Social').locator('article.den-row', { hasText: 'A quiet word' }).locator('.den-mc-f').textContent(), 'L2', 'a post with no counts, as a card');
          eq(await panel(p, 'Influencer and political').locator('article.den-row', { hasText: 'meets on Thursday' }).locator('.den-mc-f').textContent(), '', 'an actor\'s post with no counts, as a card'); }
        if (area === 'today' && id === 'mca_vic' && view === 'Table') {
          eq(await p.$eval('.den-kpi:nth-child(3)', e => [e.querySelector('.v').textContent, e.querySelector('.f').textContent, e.getAttribute('aria-label')]), ['-', '-', 'Interactions: -. Go to Social.']); eq(await p.locator('.den-col').count(), 0);
          eq(await txt(p, '.den-card[aria-label="Volume through the window"] .den-body'), 'No story or post is on this desk in this window yet, so there is nothing to chart. Open Collection');
          eq(await txt(p, '.den-card[aria-label="By channel"] .den-body'), 'No rows in this window yet.'); eq(await txt(p, '.den-card[aria-label="Tone under the posts"] .den-body'), 'No comment under this window\'s posts is held, so there is no tone to show.');
          eq(await panel(p, 'Key narratives').locator('button.den-link').textContent(), 'Open Collection');
          eq(await txt(p, 'section.den-panel[aria-label="Social"] .den-state'), 'No post on this desk\'s terms or from its registered accounts is in this window. Open Collection'); ok(/was filed in this window\. Open Collection$/.test(await txt(p, 'section.den-panel[aria-label="Traditional media"] .den-state'))); eq(await p.locator('.den-cover').count(), 0, 'no channel is in the window, so no coverage line'); }
      } } }
  // the note above the view folds, so it is read as text: it says what Collection shows now
  const note = await p.$eval('#v-den > .note', e => e.textContent); ok(/Collection shows the channels delivering for this desk and where to add one\./.test(note) && !/why not/.test(note), note);
  // and with a draft: the brief and the tray beside the card
  await dTab(p, 'today'); await dDesk(p, 'aep_au', 'AEP national'); await dView(p, 'Guided'); eq((await wd.F('POST', '/den/brief', { desk: 'aep_au' })).status, 200); await gRefresh(p); await dTab(p, 'brief'); await p.waitForSelector('.den-sec[data-section="summary"] textarea'); await look('AEP national, with a draft, brief'); await dTab(p, 'today'); await p.waitForSelector('.den-guide #den-focus'); await look('AEP national, with a draft, Guided');
  eq(bad, [], 'D10'); eq(p.errors, []); await p.context().close();
});
await t('Collection lists what delivers and nothing else; the rest, with its state and its reasons, is inside one closed disclosure (D10)', async () => {
  const wd = await world(); const chans = (await wd.F('GET', '/den/collection?desk=aep_au')).body.channels; const on = chans.filter(c => c.working).map(c => c.label), rest = chans.filter(c => !c.working).map(c => c.label); eq(on, ['News and official sources', 'X']); ok(rest.indexOf('Facebook') >= 0 && rest.length === chans.length - 2);
  const p = await open(wd); await dTab(p, 'collection'); const ch = panel(p, 'Channels'); const xRow = ch.locator('tr.den-row', { hasText: /^X/ });
  eq([await dTiles(p), await dListed(p)], [[['News and official sources', 'ok'], ['X', 'ok']], on], 'tiles and rows are the channels delivering for this desk');
  ok(/delivering - \d+ in 7 days/.test(await txt(p, '.den-health .den-hc:first-child .f')), await txt(p, '.den-health .den-hc:first-child'));
  eq([await ch.locator('tr.den-row').first().getByRole('button', { name: 'Collect now', exact: true }).count(), await ch.locator('tr.den-row').first().getByRole('button', { name: 'Switch off', exact: true }).count(), await xRow.getByRole('button', { name: 'Collect now', exact: true }).count(), await xRow.getByRole('button', { name: 'Switch off', exact: true }).count()], [1, 0, 1, 1], 'the kill switch sits beside the signed-in channel that is listed');
  ok(!/Cannot reach/.test(await ch.textContent()) && !/not granted|not set/.test(await ch.textContent()), 'how a listed channel is read names only routes that are set');
  // the one disclosure: there, closed, and nothing inside it is drawn or was asked for
  eq([await p.locator('details.den-more').count(), await p.locator('details.den-more[open]').count(), await txt(p, 'details.den-more > summary'), await p.locator('details.den-more section.den-panel').first().isVisible()], [1, 0, 'Add or switch on a channel', false]);
  ok(!p.served.some(s => /^GET \/den\/watch/.test(s)), 'the register was read before the disclosure was opened'); eq(await dSays(p, 'Collection, closed'), []);
  // Switch off on a listed channel takes it off the page and into the disclosure
  await xRow.getByRole('button', { name: 'Switch off', exact: true }).click(); await p.waitForFunction(() => document.querySelectorAll('section.den-panel[aria-label="Channels"] tr.den-row').length === 1); eq([await dTiles(p), await dListed(p)], [[['News and official sources', 'ok']], ['News and official sources']]);
  // the press is answered: where the channel went is said, and the focus is on the disclosure that now holds it (the pressed button left with its row)
  await p.waitForFunction(() => /^Switched off\. X is listed under Add or switch on a channel\.$/.test((document.querySelector('.toast, #toast') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => { throw new Error('nothing said where X went'); });
  ok(await p.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === 'SUMMARY' && a.parentElement.id === 'den-more'; }), 'the focus was dropped with the row that held the pressed button');
  eq((await wd.F('GET', '/den/reach')).body.off, ['x']); eq(await dSays(p, 'Collection, closed, X switched off'), []);
  await dMore(p); ok(p.served.some(s => /^GET \/den\/watch\?ns=aep/.test(s)), 'opening it reads the register'); ok((await dSays(p, 'opened')).some(x => /No Mac collector is connected/.test(x)) && (await dSays(p, 'opened')).some(x => /has the title or label/.test(x)), 'opened, the states and reasons are drawn, and the check above can see them'); const add = panel(p, 'Channels to add'); const sw = panel(p, 'Signed-in collection'); const chip = (pn, name) => pn.locator('tr', { hasText: name }).first().locator('.den-chip').first().textContent();
  eq(await add.locator('tr.den-row .den-t:first-child').allTextContents().then(a => a.filter(x => rest.concat(['X']).indexOf(x) >= 0).sort()), rest.concat(['X']).sort(), 'every other channel is inside it'); eq([await chip(add, /^X/), await chip(sw, /^X/)], ['switched off', 'off']);
  const fbAdd = add.locator('tr.den-row', { hasText: 'Facebook' }); ok(/Sign in to Facebook on the Mac collector and leave it running, then Collect now\./.test(await fbAdd.textContent()) && /not granted/.test(await fbAdd.textContent()) && /Cannot reach: Comment text/.test(await fbAdd.textContent()), 'inside it a channel says what switches it on, and its state and reason as before: ' + await fbAdd.textContent());
  ok(/No Mac collector is connected/.test(await txt(p, 'details.den-more .den-notice')) && /Off stops every collector at once/.test(await sw.textContent()) && /collected by no layer|not collected|TikTok/.test(await txt(p, 'details.den-more > .den-more-b > p.den-mono')), 'the collector sentence, the switches and what was not built are inside it');
  await panel(p, 'To finish setting up').locator('tr', { hasText: 'harbourwatchpage' }).waitFor(); ok(/harbourwatchpage ?An account on Facebook/.test(await txt(p, 'section.den-panel[aria-label="To finish setting up"]')) && /Not read yet\./.test(await txt(p, 'section.den-panel[aria-label="To finish setting up"]')), 'a registered account that has not read is listed with its reason: ' + await txt(p, 'section.den-panel[aria-label="To finish setting up"]'));
  // switched on again from inside, it is listed again
  await sw.locator('tr', { hasText: /^X/ }).getByRole('button', { name: 'Switch on', exact: true }).click(); await p.waitForFunction(() => document.querySelectorAll('section.den-panel[aria-label="Channels"] tr.den-row').length === 2); eq([await dListed(p), (await wd.F('GET', '/den/reach')).body.off], [on, []]);
  // listed again, with no collector offering its signed-in read: the default rows say nothing of that, and inside the disclosure it is said, with what starts it again
  await panel(p, 'Listed above, and where each stands now').locator('tbody tr').first().waitFor(); const wl = await all(p, 'section.den-panel[aria-label="Listed above, and where each stands now"] tbody tr');
  eq(wl.length, 1); ok(/^X \| from the worker only ?No Mac collector offers it now: .* \| Sign in to X on the Mac collector and leave it running, then Collect now\.$/.test(wl[0]), wl[0]);
  // Facebook, which is not listed, is switched off and on from inside it
  const fbSw = sw.locator('tr', { hasText: 'Facebook' }); eq(await chip(sw, 'Facebook'), 'allowed'); await fbSw.getByRole('button', { name: 'Switch off', exact: true }).click(); await p.waitForFunction(() => /off/.test(Array.from(document.querySelectorAll('section.den-panel[aria-label="Signed-in collection"] tr')).find(r => /Facebook/.test(r.textContent)).querySelector('.den-chip').textContent));
  ok(/switched off/.test(await fbAdd.textContent()) && await fbAdd.getByRole('button', { name: 'Collect now', exact: true }).isDisabled(), 'off, it cannot be collected'); eq((await wd.F('GET', '/den/reach')).body.off, ['facebook']);
  await fbSw.getByRole('button', { name: 'Switch on', exact: true }).click(); await p.waitForFunction(() => /allowed/.test(Array.from(document.querySelectorAll('section.den-panel[aria-label="Signed-in collection"] tr')).find(r => /Facebook/.test(r.textContent)).querySelector('.den-chip').textContent)); eq((await wd.F('GET', '/den/reach')).body.off, []);
  // a platform paused at a verification: said inside the disclosure, and nowhere while it is closed
  await wd.kv.set('reach_challenges', JSON.stringify({ facebook: { at: NOW - 2 * H, agent: 'mac-1', error: 'facebook_challenge' } })); await dShut(p); await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await p.waitForTimeout(600); await dIdle(p); await p.waitForSelector('section.den-panel[aria-label="Channels"] tr.den-row');
  await dShut(p); eq(await dSays(p, 'Collection, closed, with Facebook paused at a verification'), []); eq(await dListed(p), on);
  await dMore(p); ok(/paused: verification/.test(await panel(p, 'Channels to add').locator('tr.den-row', { hasText: 'Facebook' }).textContent()) && /verification \d+ h ago/.test(await panel(p, 'Signed-in collection').textContent()), 'opened, the verification is said');
  await wd.kv.delete('reach_challenges'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('a watched page whose read fails, or that is stopped, shows "-" by default and is listed with its reason inside the disclosure (D10)', async () => {
  const wd = await world(); const PAGE = 'Domestic Gas Reservation Bill 2026 inquiry', WHY = 'the site answered 403 to the reader'; ok((await wd.F('GET', '/den/process?desk=aep_au')).body.pages.some(x => x.name === PAGE), 'the seeded page is watched for this desk');
  eq(wd.env.MIND_DB.db.prepare('UPDATE sources SET last_error=?, fails=2, last_try=? WHERE name=?').run(WHY, NOW - H, PAGE).changes, 1); eq((await wd.F('GET', '/den/process?desk=aep_au')).body.pages.find(x => x.name === PAGE).error, WHY);
  eq(wd.env.MIND_DB.db.prepare("UPDATE den_watch SET last_error=? WHERE ns='aep' AND kind='account' AND platform='facebook'").run('ppca_missing: this app may not read public pages').changes, 1);
  const p = await open(wd); await dTab(p, 'collection'); const pages = panel(p, 'Watched parliament pages'); const row = pages.locator('tr.den-row', { hasText: PAGE }); await row.waitFor();
  eq([(await row.locator('td').nth(1).textContent()).trim(), (await row.locator('td').nth(3).textContent()).trim(), await row.locator('.den-chip').count()], ['-', '-', 0], 'a failed read is a dash, with no chip'); ok(!/403|failed|ppca_missing/.test(await dSeen(p).then(s => s.text + s.said.join(' '))), 'the failure is said on the default page'); eq(await dSays(p, 'Collection, closed, a page failing'), []);
  ok(/Submitters' names are never read\.\s/.test((await dSeen(p)).text + ' ') && !/refuses the reader|change\.org/.test((await dSeen(p)).text), 'the two closing notes still say what is refused');
  // a page added and then stopped: the answer to the press is said, and the row is a dash
  await pages.getByLabel('Address of the page').fill('https://parliament.example.gov.au/committees/harbour-levy'); await pages.getByLabel('Its name, as the parliament writes it').fill('Harbour Levy Bill 2026 inquiry'); await pages.getByRole('button', { name: 'Watch this page' }).click();
  const mine = pages.locator('tr.den-row', { hasText: 'Harbour Levy Bill 2026 inquiry' }); await mine.waitFor(); await mine.getByRole('button', { name: 'Stop', exact: true }).click(); await p.waitForFunction(() => /Stopped\. It is listed under Add or switch on a channel\./.test((document.querySelector('.toast, #toast') || {}).textContent || ''));
  await mine.getByRole('button', { name: 'Stop', exact: true }).waitFor({ state: 'detached' }); eq([(await mine.locator('td').nth(1).textContent()).trim(), await mine.locator('.den-chip').count()], ['-', 0]); eq(await dSays(p, 'Collection, closed, a page stopped'), []);
  // opened: each is listed with its reason and the place it is edited
  await dMore(p); const todo = panel(p, 'To finish setting up'); await todo.locator('tr', { hasText: PAGE }).waitFor(); const lines = await all(p, 'section.den-panel[aria-label="To finish setting up"] tbody tr');
  ok(lines.some(l => l.indexOf(PAGE) === 0 && l.indexOf('The last read failed: ' + WHY) > 0) && lines.some(l => /^Harbour Levy Bill 2026 inquiry ?A parliament page \| Stopped: /.test(l)) && lines.some(l => /^harbourwatchpage ?An account on Facebook \| ppca_missing/.test(l)), lines.join(' // '));
  await todo.getByRole('button', { name: 'Watched parliament pages, for ' + PAGE, exact: true }).click(); ok(await dIn(p, 'section.den-panel[aria-label="Watched parliament pages"]'), 'the link moves to where the page is edited');
  await todo.getByRole('button', { name: 'Open Watch, for harbourwatchpage', exact: true }).click(); await p.waitForSelector('#den-tab-watch[aria-selected="true"]'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('recall: the channels that held links stay on the page; one that held none, and the misses, are inside the disclosure (D10)', async () => {
  const wd = await world(); eq((await wd.F('POST', '/den/backtest', { desk: 'aep_au', result: { reports: 5, links: 100, held: 60, period: 'October 2026', byChannel: { news: { links: 60, held: 60 }, facebook: { links: 40, held: 0 } }, misses: [{ url: 'https://www.facebook.com/harbourwatchpage/posts/1', channel: 'facebook' }] } })).status, 200);
  const p = await open(wd); await dTab(p, 'collection'); const rec = 'section.den-panel[aria-label="Recall against the reports"]'; await p.waitForSelector(rec + ' tbody tr');
  ok(/60% - 60 of 100 links in 5 reports \(October 2026\)/.test(await txt(p, rec)), await txt(p, rec)); eq(await all(p, rec + ' tbody tr'), ['News | 60 | 60 | 100%'], 'only a channel that held a link is in the table');
  const seen = await dSeen(p); const panelText = await p.$eval('#den-tabpanel', e => e.innerText); ok(!/Facebook/.test(panelText) && !seen.said.some(a => /Facebook/.test(a)), 'the default Collection names Facebook'); eq(await dSays(p, 'Collection, closed, with a recall result'), []);
  await dMore(p); const by = 'section.den-panel[aria-label="Recall, by channel"]'; eq(await all(p, by + ' tbody tr'), ['Facebook | 40 | 0 | 0%']); ok(/1 of the links it did not hold/.test(await txt(p, by)) && /Facebook: https:\/\/www\.facebook\.com\/harbourwatchpage\/posts\/1/.test(await p.$eval(by, e => e.textContent)), await txt(p, by));
  ok(/Facebook/.test(await p.$eval('#den-tabpanel', e => e.innerText)), 'opened, it is there to read'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('Collection on a worker older than p65, and what else is on the default screen: a channel switched off is not listed, the listed switch only ever switches off, subscriber news has its stop, and a group not read yet is listed inside (D10)', async () => {
  const wd = await world(); await wd.push('sig_thread', [{ src: 'facebook', title: 'fb post', body: 'The windfall tax on gas, from the page.', url: 'https://www.facebook.com/harbourwatchpage/posts/100', ts: NOW - 30 * H, meta: { platform: 'facebook', issues: ['gastax'], id: 'fb100', layers: [2] } }]);
  eq((await wd.F('POST', '/den/reach', { off: ['facebook'] })).status, 200); await wd.F('GET', '/sources'); eq((await wd.F('POST', '/sources/access', { id: 'afr', access: 'subscriber', cleared: true, basis: 'The agency holds a corporate subscription.' })).status, 200);
  eq((await wd.F('POST', '/den/watch/add', { ns: 'aep', kind: 'group', value: 'https://www.facebook.com/groups/harbourlevy', name: 'Harbour levy group' })).status, 200);
  const c0 = (await wd.F('GET', '/den/collection?desk=aep_au')).body; const fb0 = c0.channels.find(x => x.id === 'facebook'); eq([fb0.delivered.d7 > 0, fb0.collector.off, fb0.working, c0.gated.some(g => g.cleared)], [true, true, false, true], 'Facebook delivered this week and is switched off; a subscriber outlet is cleared');
  // an older worker: the same answer without the three fields p65 added to a channel
  wd.hooks = [async (route, r, path) => { if (r.method() !== 'GET' || !/^\/den\/collection/.test(path)) return false; const res = await wd.call('GET', path, null, r.headers()['x-axiom-key'] || null); const d = JSON.parse(res.text); d.channels.forEach(x => { delete x.working; delete x.howOn; delete x.setup; }); await route.fulfill({ status: res.status, contentType: 'application/json', body: JSON.stringify(d) }); return true; }];
  // a read-only key first: the outlets are listed, and it has no stop
  const q = await open(wd, 'read-key'); await q.waitForFunction(() => window.AX_ROLE === 'read'); await dTab(q, 'collection'); await panel(q, 'Subscriber outlets').locator('tbody tr').first().waitFor(); eq([await dListed(q), await q.locator('#den-root button', { hasText: /Switch off|Switch on|Collect now/ }).count()], [['News and official sources', 'X'], 0]); await q.context().close();
  const p = await open(wd); const sent = gSent(p); await dTab(p, 'collection'); const ch = panel(p, 'Channels');
  eq([await dListed(p), await dTiles(p)], [['News and official sources', 'X'], [['News and official sources', 'ok'], ['X', 'ok']]], 'a channel that delivered this week and is switched off is listed, on an older worker'); eq(await dSays(p, 'Collection, closed, on an older worker'), []);
  eq(await ch.getByRole('button', { name: 'Switch off', exact: true }).count(), 1, 'a row of a channel that is off has a button named Switch off');
  // the listed switch adds to the off list, and takes nothing out of it
  await ch.locator('tr.den-row', { hasText: /^X/ }).getByRole('button', { name: 'Switch off', exact: true }).click(); await p.waitForFunction(() => document.querySelectorAll('section.den-panel[aria-label="Channels"] tr.den-row').length === 1);
  eq([sent[sent.length - 1], (await wd.F('GET', '/den/reach')).body.off], [['/den/reach', { off: ['facebook', 'x'] }], ['facebook', 'x']]);
  // subscriber news is read through a signed-in session too: while an outlet is cleared its stop is beside the outlets, and once pressed it is not drawn
  const stop = panel(p, 'Subscriber outlets').getByRole('button', { name: 'Switch off subscriber news', exact: true }); await stop.waitFor(); await p.waitForTimeout(3300); await stop.click(); await stop.waitFor({ state: 'detached' });
  await p.waitForFunction(() => /^Switched off\. Subscriber news is listed under Add or switch on a channel\.$/.test((document.querySelector('.toast, #toast') || {}).textContent || ''), null, { timeout: 3000 }).catch(() => { throw new Error('nothing said where subscriber news went'); });
  ok(await p.evaluate(() => { const a = document.activeElement; return !!a && a.tagName === 'SUMMARY' && a.parentElement.id === 'den-more'; }), 'the focus was dropped with the button that was pressed');
  eq([(await wd.F('GET', '/den/reach')).body.off, sent[sent.length - 1]], [['facebook', 'x', 'gated'], ['/den/reach', { off: ['facebook', 'x', 'gated'] }]]); eq(await dSays(p, 'Collection, closed, subscriber news stopped'), []);
  // inside the disclosure: the switch shows it off, and a registered public group that has not been read is listed with the rest
  await dMore(p); eq(await panel(p, 'Signed-in collection').locator('tr', { hasText: 'Subscriber news' }).locator('.den-chip').first().textContent(), 'off');
  await panel(p, 'To finish setting up').locator('tr', { hasText: 'harbourlevy' }).waitFor(); const lines = await all(p, 'section.den-panel[aria-label="To finish setting up"] tbody tr'); ok(lines.some(l => /^harbourlevy ?A public Facebook group \| Not read yet\. \| Open Watch$/.test(l)), lines.join(' // '));
  wd.hooks = []; eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
/* POST /den/reach replaces the whole off list, and the page's copy of that list is only as new as its last read of Collection.
   A switch therefore reads the list in force first and changes its own source only. The two cases below hold every later
   read of Collection, so the page knows what it read on opening and what each press was answered, and nothing else. */
const dHold = wd => { let go; const gate = new Promise(r => { go = r; }); const h = { n: 0, go: () => { wd.hooks = []; go(); } }; wd.hooks = [async (route, r, path) => { if (r.method() === 'GET' && /^\/den\/collection/.test(path)) { h.n++; await gate; } return false; }]; return h; };
const dReach = sent => sent.filter(s => s[0] === '/den/reach').map(s => s[1].off);
const dRows = (p, n) => p.waitForFunction(k => document.querySelectorAll('section.den-panel[aria-label="Channels"] tr.den-row').length === k, n);
await t('two listed switches pressed back to back, before Collection has been read again: the second keeps off what the first switched off (D10)', async () => {
  const wd = await world(); await wd.F('GET', '/sources'); eq((await wd.F('POST', '/sources/access', { id: 'afr', access: 'subscriber', cleared: true, basis: 'The agency holds a corporate subscription.' })).status, 200);
  const p = await open(wd); const sent = gSent(p); await dTab(p, 'collection'); const ch = panel(p, 'Channels'); eq(await dListed(p), ['News and official sources', 'X']);
  const stop = panel(p, 'Subscriber outlets').getByRole('button', { name: 'Switch off subscriber news', exact: true }); await stop.waitFor(); const hold = dHold(wd);
  await ch.locator('tr.den-row', { hasText: /^X/ }).getByRole('button', { name: 'Switch off', exact: true }).click();
  // the worker's answer to the press is on the page before any read of Collection: X has left the list, and the next switch can be pressed
  await dRows(p, 1); eq([await dListed(p), await dTiles(p)], [['News and official sources'], [['News and official sources', 'ok']]]); ok(hold.n >= 1, 'the read after the press was not held, so this case proves nothing');
  await stop.click(); await stop.waitFor({ state: 'detached' });
  eq([dReach(sent), (await wd.F('GET', '/den/reach')).body.off], [[['x'], ['x', 'gated']], ['x', 'gated']], 'the second press switched X back on');
  eq(p.served.filter(x => x === 'GET /den/reach').length, 2, 'each press reads the list in force before it sends one'); eq(await dSays(p, 'Collection, closed, two switches pressed'), []);
  // the held reads answer: nothing comes back
  const back = p.waitForResponse(x => /\/den\/collection\?/.test(x.url()), { timeout: 20000 }); hold.go(); await back; await p.waitForTimeout(400);
  eq([await dListed(p), await stop.count()], [['News and official sources'], 0]); await dMore(p); const sw = panel(p, 'Signed-in collection'); const chip = name => sw.locator('tr', { hasText: name }).first().locator('.den-chip').first().textContent();
  eq([await chip(/^X/), await chip('Subscriber news'), await chip('Facebook')], ['off', 'off', 'allowed']); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('a switch pressed on a page that has not seen a colleague\'s switch leaves the colleague\'s as it is: the listed switch, and the two ways of the one inside the disclosure (D10)', async () => {
  const wd = await world(); const p = await open(wd); const sent = gSent(p); await dTab(p, 'collection'); const ch = panel(p, 'Channels'); eq(await dListed(p), ['News and official sources', 'X']);
  const offNow = async () => (await wd.F('GET', '/den/reach')).body.off; const last = () => dReach(sent).pop(); const hold = dHold(wd);
  // a colleague switches Reddit off after this page read Collection; the page presses its listed switch
  eq((await wd.F('POST', '/den/reach', { off: ['reddit'] })).status, 200);
  await ch.locator('tr.den-row', { hasText: /^X/ }).getByRole('button', { name: 'Switch off', exact: true }).click(); await dRows(p, 1);
  eq([last(), await offNow()], [['reddit', 'x'], ['reddit', 'x']], 'the listed switch dropped a switch this page had not seen');
  // inside the disclosure the worker's answer has been drawn: the colleague's switch shows with this page's own
  await dMore(p); const sw = panel(p, 'Signed-in collection'); const chip = name => sw.locator('tr', { hasText: name }).first().locator('.den-chip').first().textContent();
  const chipIs = (name, want) => p.waitForFunction(([n, v]) => { const r = Array.from(document.querySelectorAll('section.den-panel[aria-label="Signed-in collection"] tbody tr')).find(x => x.children[0].textContent === n); return !!r && r.querySelector('.den-chip').textContent === v; }, [name, want]);
  eq([await chip('Reddit'), await chip(/^X/), await chip('Facebook'), await chip('Instagram')], ['off', 'off', 'allowed', 'allowed']);
  // the colleague switches Instagram off; this page, which has not seen it, switches Facebook off
  eq((await wd.F('POST', '/den/reach', { off: ['reddit', 'x', 'instagram'] })).status, 200);
  await sw.locator('tr', { hasText: 'Facebook' }).getByRole('button', { name: 'Switch off', exact: true }).click(); await chipIs('Facebook', 'off');
  eq([last(), await offNow(), await chip('Instagram')], [['reddit', 'x', 'instagram', 'facebook'], ['reddit', 'x', 'instagram', 'facebook'], 'off'], 'the switch inside dropped a switch this page had not seen');
  // the colleague switches Reddit back on; this page, which still shows Reddit off, switches X on: only X comes out of the list
  eq((await wd.F('POST', '/den/reach', { off: ['x', 'instagram', 'facebook'] })).status, 200);
  await sw.locator('tr', { hasText: /^X/ }).getByRole('button', { name: 'Switch on', exact: true }).click(); await chipIs('X', 'allowed'); await dRows(p, 2);
  eq([last(), await offNow()], [['instagram', 'facebook'], ['instagram', 'facebook']], 'switching one platform on switched another off again');
  eq([await chip('Reddit'), await chip('Instagram'), await chip('Facebook'), await dListed(p)], ['allowed', 'off', 'off', ['News and official sources', 'X']]); ok(hold.n >= 3, 'the reads of Collection were not held, so the page may have seen the colleague\'s switches');
  const back = p.waitForResponse(x => /\/den\/collection\?/.test(x.url()), { timeout: 20000 }); hold.go(); await back; await p.waitForTimeout(400);
  eq([await chip('Reddit'), await chip(/^X/), await chip('Instagram'), await chip('Facebook'), await dListed(p)], ['allowed', 'allowed', 'off', 'off', ['News and official sources', 'X']]); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('the Facebook column and figure are drawn only when a story on the board carries the figure (D10)', async () => {
  const wd = await world(); await wd.push('news', [1, 2].map(i => ({ src: 'minewire', title: 'Critical minerals strategy lands, part ' + i, body: 'A critical minerals processing plan was released this week.', url: 'https://minewire.example.com.au/' + i, ts: NOW - (2 + i) * H, meta: { issues: ['cm'], source: 'minewire' } })));
  const mb = await gBoard(wd, 'mca_au'); ok(mb.media.length === 2 && !mb.media.some(m => m.fb), 'the MCA desk holds two stories and no Facebook figure'); ok((await gBoard(wd)).media.some(m => m.fb));
  const p = await open(wd); const media = panel(p, 'Traditional media'); await media.locator('tr.den-row').first().waitFor(); eq(await media.locator('thead th').allTextContents(), ['Story', 'Outlet', 'Outlets', 'Facebook', 'When', ''], 'a story carries the figure, so the column is drawn');
  await dDesk(p, 'mca_au', 'MCA national'); await media.locator('tr.den-row', { hasText: 'Critical minerals strategy lands, part 1' }).waitFor(); eq(await media.locator('thead th').allTextContents(), ['Story', 'Outlet', 'Outlets', 'When', ''], 'no story carries it: no column');
  eq(await media.locator('tr.den-row').first().locator('td').count(), 5); ok(!/Facebook/.test(await media.textContent()));
  await dView(p, 'Cards'); await media.locator('article.den-row').first().waitFor(); ok(!/Facebook/.test(await media.textContent()), 'nor a figure on the cards'); eq(await dSays(p, 'the MCA desk as cards'), []);
  await dView(p, 'Table'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('the coverage line says which channels are in this window, and names no channel that is not (D10)', async () => {
  const wd = await world(); const b = await gBoard(wd); const want = Object.keys(b.byChannel).filter(k => b.byChannel[k] > 0).sort((x, y) => b.byChannel[y] - b.byChannel[x]).map(k => ({ news: 'News', x: 'X' }[k] || k) + ' ' + b.byChannel[k]); eq(want.map(x => x.split(' ')[0]), ['News', 'X']);
  const p = await open(wd, 'full-key', { guided: true }); const line = async () => [await p.getAttribute('.den-cover', 'role'), await p.getAttribute('.den-cover', 'aria-label'), await p.$$eval('.den-cover .den-chip', e => e.map(x => x.textContent)), /^In this window: /.test(await txt(p, '.den-cover')), /Facebook|Instagram/.test(await txt(p, '.den-cover'))];
  for (const view of ['Guided', 'Table', 'Cards']) { await dView(p, view); eq(await line(), ['group', 'Channels in this window', want, true, false], view); }
  ok(await p.evaluate(() => !!(document.querySelector('.den-toolbar').compareDocumentPosition(document.querySelector('.den-cover')) & Node.DOCUMENT_POSITION_FOLLOWING)), 'the line is under the toolbar');
  await dView(p, 'Guided'); await dDesk(p, 'mca_vic', 'MCA Victoria'); await p.waitForSelector('.den-guide .den-done'); eq(await p.locator('.den-cover').count(), 0, 'an empty window has no line'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
  // with the desk's showGaps on the line is the same: it says what is there
  const wo = await world(); await gapsOn(wo, ['aep_au']); const q = await open(wo); await q.waitForSelector('.den-cover'); eq(await q.$$eval('.den-cover .den-chip', e => e.map(x => x.textContent)), want); eq(q.errors, []); await q.context().close();
});
await t('Options: "Also show the channels with no rows" is saved on the desk, and the strip and Collection follow it at once, both ways (D10)', async () => {
  const wd = await world(); const p = await open(wd); await p.waitForSelector('.den-strip li'); await p.evaluate(() => { window.__same = 1; }); const opt = async () => (await wd.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_au').options.showGaps;
  const gap = () => p.$$eval('.den-strip li', li => li.some(x => /Facebook delivered nothing/.test(x.textContent))); const sw = p.locator('section.den-panel[aria-label="Channels on screen"] label.den-switch input[type="checkbox"]');
  await dTab(p, 'options'); await p.waitForSelector('.den-strip li'); eq([await sw.isChecked(), await gap(), await opt()], [false, false, false]); eq(await txt(p, 'section.den-panel[aria-label="Channels on screen"] label.den-switch'), 'Also show the channels with no rows');
  ok(/Off, the default: the Den shows only channels with rows for this desk\. On: it also lists the other channels this desk relies on, each with its state and the reason\./.test(await txt(p, 'section.den-panel[aria-label="Channels on screen"]'))); eq(await dSays(p, 'Options'), []);
  await p.getByRole('button', { name: 'Channels on screen', exact: true }).click(); ok(await dIn(p, 'section.den-panel[aria-label="Channels on screen"]'), 'the index does not reach the new panel');
  // on: saved, and the strip reads again by itself
  await sw.check(); ok(/Not saved/.test(await txt(p, '#den-tabpanel .den-optbar .den-save'))); await p.getByRole('button', { name: 'Save options', exact: true }).click(); await p.waitForFunction(() => Array.from(document.querySelectorAll('.den-strip li')).some(x => /Facebook delivered nothing/.test(x.textContent)), null, { timeout: 15000 });
  eq([await opt(), await sw.isChecked(), FB_GAP.test((await all(p, '.den-strip li'))[0])], [true, true, true], 'the gap leads the strip once the option is on');
  await dTab(p, 'collection'); eq([await p.locator('details.den-more').count(), (await dListed(p)).indexOf('Facebook') >= 0, await p.locator('.den-hc.bad').count() > 0], [0, true, true], 'on, Collection is as it was: every channel, its state, and no disclosure');
  // off again: the gap leaves, the disclosure is back
  await dTab(p, 'options'); await sw.uncheck(); await p.getByRole('button', { name: 'Save options', exact: true }).click(); await p.waitForFunction(() => document.querySelectorAll('.den-strip li').length > 0 && !Array.from(document.querySelectorAll('.den-strip li')).some(x => /delivered nothing/.test(x.textContent)), null, { timeout: 15000 });
  eq([await opt(), await sw.isChecked(), await gap()], [false, false, false]); await dTab(p, 'collection'); eq([await p.locator('details.den-more').count(), await dListed(p), await p.locator('.den-hc.bad, .den-hc.off').count()], [1, ['News and official sources', 'X'], 0]); eq(await dSays(p, 'Collection, the option off again'), []);
  eq([await p.evaluate(() => window.__same), p.served.filter(s => /index\.html/.test(s)).length], [1, 0], 'the page was loaded again'); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('File: step 3, the header\'s "Next: file the brief" and a goto with step file put the focus on Mark as filed; an empty brief moves nothing', async () => {
  const wd = await world(); eq((await wd.F('POST', '/den/brief', { desk: 'aep_au' })).status, 200); eq((await wd.F('POST', '/den/brief/save', { desk: 'mca_au' })).status, 200);
  const p = await open(wd); await gRail(p, 'file', 'Step 3, File: not filed'); const at = () => p.evaluate(() => { const a = document.activeElement; return [!!(a && a.closest('#den-file')), a ? a.textContent : '']; }); const onFile = () => p.waitForFunction(() => { const a = document.activeElement; return !!(a && a.closest('#den-file')); }, null, { timeout: 8000 }).catch(() => { throw new Error('the focus did not move into the File region'); });
  // the rail's third step, from Today
  await p.click('#den-step-file'); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await onFile(); eq(await at(), [true, 'Mark as filed']);
  eq(await p.$$eval('.den-rail .den-stepb', e => e.map(x => x.getAttribute('aria-current'))), [null, null, 'step'], 'the rail does not say the person is at File');
  eq([await p.getAttribute('#den-file', 'role'), await p.getAttribute('#den-file', 'aria-label'), await p.locator('#den-file .den-bar').count(), await p.$$eval('#den-tabpanel .den-stephead', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())), await p.$$eval('#den-tabpanel .den-stephead', e => e.every(x => x.getAttribute('aria-hidden') === 'true'))], ['group', 'File the brief', 2, ['2 Write', '3 File'], true]);
  ok(/^\d+ of \d+ sections written\./.test(await txt(p, '#den-file > p.den-mono')), await txt(p, '#den-file > p.den-mono'));
  // into a section again: "you are here" goes back to Write, where the person is
  await p.locator('.den-sec[data-section="summary"] textarea').focus(); await p.waitForFunction(() => document.querySelector('#den-step-write').getAttribute('aria-current') === 'step', null, { timeout: 5000 }).catch(() => { throw new Error('the rail still says File though the person is in a section'); }); eq(await p.getAttribute('#den-step-file', 'aria-current'), null);
  // the header, on Brief
  await p.click('#den-step-write'); await p.focus('#den-step-write'); eq([(await at())[0], await p.getAttribute('#den-step-write', 'aria-current'), await txt(p, '#den-next')], [false, 'step', 'Next: file the brief']); await p.click('#den-next'); await onFile(); eq(await at(), [true, 'Mark as filed']);
  // a goto from elsewhere in the app's own way
  await dTab(p, 'today'); eq(await txt(p, '#den-next'), 'Next: read the draft'); await p.evaluate(() => window.AXUI.goto('den', { tab: 'brief', step: 'file' })); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await onFile(); eq(await at(), [true, 'Mark as filed']); eq(gPosts(p), [], 'moving the focus wrote something');
  // a brief started by hand and still empty: there is nothing to file, and the focus stays where the person put it
  await dTab(p, 'today'); await dDesk(p, 'mca_au', 'MCA national'); await gRail(p, 'file', 'Step 3, File: nothing to file yet'); await gRail(p, 'write', 'Step 2, Write: draft');
  await p.click('#den-step-file'); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('.den-sec textarea'); await p.waitForSelector('#den-file'); await dIdle(p); await p.waitForTimeout(700);
  eq([(await at())[0], await p.evaluate(() => document.activeElement.id), await p.$$eval('.den-rail .den-stepb', e => e.map(x => x.getAttribute('aria-current'))), await p.locator('#den-next').count()], [false, 'den-step-file', [null, 'step', null], 0], 'an empty brief took the focus into the File region');
  await dTab(p, 'today'); await p.evaluate(() => window.AXUI.goto('den', { tab: 'brief', step: 'file' })); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForSelector('#den-file'); await p.waitForTimeout(700); eq((await at())[0], false, 'a goto took the focus into the File region of an empty brief');
  eq([wd.calls.length, gPosts(p)], [1, []]);
  // the brief then passes 200 characters (a colleague's save, read on Refresh): the File step was pressed when there was nothing to file and
  // moved nothing, so the person is still at Write and the rail says so
  const hb = (await wd.F('GET', '/den/brief?desk=mca_au')).body.brief; const sid = (await wd.F('GET', '/den/desks')).body.desks.find(x => x.id === 'mca_au').sections.find(s => s.kind !== 'sources').id;
  eq((await wd.F('POST', '/den/brief/save', { id: hb.id, revision: hb.revision, sections: { [sid]: 'The debate over critical minerals processing ran through the week. '.repeat(5) } }, 'other-key')).status, 200);
  await p.locator('#den-app .den-head button', { hasText: 'Refresh' }).click(); await gRail(p, 'file', 'Step 3, File: not filed'); await p.waitForTimeout(300);
  eq([await p.$$eval('.den-rail .den-stepb', e => e.map(x => x.getAttribute('aria-current'))), (await at())[0]], [[null, 'step', null], false], 'the rail moved to File by itself');
  eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('an older brief is not today\'s to file: the notice says whose day it is, step 3 lands on the notice, and Write it by hand starts today\'s', async () => {
  const wd = await world(); const made = (await wd.F('POST', '/den/brief/save', { desk: 'mca_au' })).body.brief; const today = made.day; const old = new Date(Date.parse(today + 'T00:00:00Z') - 2 * D).toISOString().slice(0, 10);
  eq(wd.env.MIND_DB.db.prepare('UPDATE den_briefs SET day=? WHERE id=?').run(old, made.id).changes, 1); eq([(await wd.F('GET', '/den/brief?desk=mca_au')).body.brief.day, (await gBoard(wd, 'mca_au')).missed.run.day, (await gBoard(wd, 'mca_au')).missed.run.brief], [old, today, null]);
  const p = await open(wd); await dDesk(p, 'mca_au', 'MCA national'); await gRail(p, 'write', 'Step 2, Write: not started'); await gRail(p, 'file', 'Step 3, File: nothing to file yet'); await dTab(p, 'brief'); await p.waitForSelector('#den-older');
  ok(new RegExp('^This is the brief for ' + old + '\\. Today\'s has not been started\\.').test(await txt(p, '#den-older')), await txt(p, '#den-older')); eq([await p.getAttribute('#den-older', 'role'), await p.locator('#den-older').getByRole('button', { name: 'Draft the brief (1 model call)', exact: true }).count(), await p.locator('#den-older').getByRole('button', { name: 'Write it by hand', exact: true }).count()], ['status', 1, 1]);
  ok(/One model call/.test(await txt(p, '#den-older')), 'the draft states its cost'); eq([await p.locator('#den-tabpanel .den-stephead').count(), await p.getAttribute('#den-file', 'aria-label')], [0, 'File the brief for ' + old], 'an older brief is not marked as today\'s Write and File');
  // step 3, and a goto: the notice takes the focus, never that brief's Mark as filed
  await p.focus('#den-tab-brief'); await p.click('#den-step-file'); await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'den-older', null, { timeout: 8000 }).catch(() => { throw new Error('step 3 did not put the focus on the older brief\'s notice'); });
  await dTab(p, 'today'); await p.evaluate(() => window.AXUI.goto('den', { tab: 'brief', step: 'file' })); await p.waitForSelector('#den-tab-brief[aria-selected="true"]'); await p.waitForFunction(() => document.activeElement && document.activeElement.id === 'den-older', null, { timeout: 8000 }).catch(() => { throw new Error('a goto did not put the focus on the older brief\'s notice'); });
  eq(await p.getAttribute('#den-step-file', 'aria-current'), null, 'the rail says the person is at File on a brief that is not today\'s');
  // Write it by hand starts today's
  await p.locator('#den-older').getByRole('button', { name: 'Write it by hand', exact: true }).click(); await p.waitForSelector('#den-older', { state: 'detached' });
  await p.waitForFunction(() => { const a = document.activeElement; return !!(a && a.tagName === 'TEXTAREA' && a.closest('#den-tabpanel .den-sec')); }, null, { timeout: 5000 }).catch(() => { throw new Error('the focus was dropped with the notice that held the pressed button'); }); await gRail(p, 'write', 'Step 2, Write: draft'); eq(await p.getAttribute('#den-file', 'aria-label'), 'File the brief');
  eq([(await wd.F('GET', '/den/brief?desk=mca_au')).body.brief.day, wd.env.MIND_DB.db.prepare("SELECT day FROM den_briefs WHERE desk='mca_au' ORDER BY day").all().map(r => r.day), wd.calls.length], [today, [old, today], 0], 'today\'s brief was started beside the older one, with no model call');
  eq(await p.$$eval('#den-tabpanel .den-stephead', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())), ['2 Write', '3 File']); eq(p.errors, []); ok(!(await p.$('#den-tabpanel .den-state.err'))); await p.context().close();
});
await t('the default screen, whole: a read-only key has no control that writes on any tab or inside the disclosure; every control is named, nothing overflows and axe passes at 1366, 1440 and 1920', async () => {
  const wd = await world(); const b = await gBoard(wd); await wd.F('POST', '/den/pin', { desk: 'aep_au', item: gRow(b, 'Producers answer the windfall tax push').id }); await wd.F('POST', '/den/aside', { desk: 'aep_au', item: gRow(b, NOISY + 4).id, reason: 'not relevant' }); const bad = [];
  // the states of the default screen: Today both ways, every other tab, and Collection with its disclosure opened
  const STATES = [['Today in Guided', async p => { await dTab(p, 'today'); await dView(p, 'Guided'); }, true], ['Today as a table', async p => { await dTab(p, 'today'); await dView(p, 'Table'); }, true], ['Brief', p => dTab(p, 'brief'), false], ['Watch', p => dTab(p, 'watch'), false],
    ['Collection, closed', async p => { await dTab(p, 'collection'); await dShut(p); }, true], ['Collection, opened', async p => { await dTab(p, 'collection'); await dMore(p); await p.waitForSelector('details.den-more[open] section.den-panel[aria-label="To finish setting up"] tbody tr'); }, true], ['Options', p => dTab(p, 'options'), true]];
  const WRITES = /Collect now|Switch on|Switch off|Keep for the report|Set aside|Take out/;
  for (const [who, key] of [['a full key', 'full-key'], ['a read-only key', 'read-key']]) { const p = await open(wd, key, { guided: true }); if (key === 'read-key') await p.waitForFunction(() => window.AX_ROLE === 'read');
    await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC);
    // nothing overflows and every control is named: every state at every width. axe: where the third argument says so
    const look = async (at, axe) => {
      const over = await p.evaluate(() => Array.from(document.querySelectorAll('#den-root section.den-panel, #den-root .den-strip, #den-root .den-head, #den-root .den-tabs, #den-root .den-rail, #den-root .den-guide, #den-root .den-cover, #den-root details.den-more')).filter(e => !e.closest('[hidden]') && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).map(e => e.getAttribute('aria-label') || e.className).concat(document.documentElement.scrollWidth > document.documentElement.clientWidth + 1 ? ['the page'] : []));
      if (over.length) bad.push(at + ' overflows: ' + over.join(', '));
      const unnamed = await p.evaluate(() => Array.from(document.querySelectorAll('#den-root button, #den-root input, #den-root select, #den-root textarea, #den-root a[href], #den-root summary')).filter(e => { const lab = e.getAttribute('aria-label') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('title') || ''; return !lab.trim(); }).map(e => e.outerHTML.slice(0, 120)));
      if (unnamed.length) bad.push(at + ' has unnamed controls: ' + unnamed.join(' '));
      if (axe) (await axeBad(p)).forEach(x => bad.push(at + ': ' + x)); };
    for (const wdt of [1366, 1440, 1920]) { await p.setViewportSize({ width: wdt, height: 900 });
      for (const [name, go, axeToo] of STATES) { await go(p); const at = who + ', ' + name + ' at ' + wdt; await look(at, axeToo || wdt === 1366);
        if (key === 'read-key') { const n = await p.locator('#den-root button', { hasText: WRITES }).count(); if (n) bad.push(at + ' shows ' + n + ' control' + (n === 1 ? '' : 's') + ' that write: ' + (await p.locator('#den-root button', { hasText: WRITES }).allTextContents()).join(', ')); } }
      // Collection opened and Options, in dark too
      await p.getByRole('button', { name: 'Dark', exact: true }).click(); await p.waitForFunction(() => document.getElementById('den-root').dataset.theme === 'dark'); for (const i of [5, 6]) { await STATES[i][1](p); await look(who + ', ' + STATES[i][0] + ', dark at ' + wdt, true); }
      await p.getByRole('button', { name: 'Light', exact: true }).click(); await p.waitForFunction(() => document.getElementById('den-root').dataset.theme === 'light'); }
    if (key === 'full-key') { await STATES[0][1](p); eq([await p.locator('.den-tray').getByRole('button', { name: /^Take out of the report/ }).count(), await gBtn(p, 'Keep for the report').count()], [1, 1], 'a full key has the controls the read-only key must not'); await STATES[5][1](p); ok(await p.locator('#den-root button', { hasText: WRITES }).count() >= 5, 'and Collection\'s, with the disclosure opened'); }
    else { eq(p.served.filter(s => /^POST \/den\//.test(s)), [], 'the read-only key sent a write'); await STATES[0][1](p); eq(await p.$$eval('.den-trayg li .t', e => e.map(x => x.textContent)), ['Producers answer the windfall tax push'], 'the read-only key still sees what is kept'); }
    eq(p.errors, [], who + ': an uncaught error reached the page'); await p.setViewportSize({ width: 1440, height: 900 }); await p.context().close(); }
  eq(bad, [], 'the default screen');
});

await finish();
