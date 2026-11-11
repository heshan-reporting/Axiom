/* Anne's Den in a real browser (prompts/annes-den.md Phase 6): the page served from docs/, its worker calls routed into
 * the worker module in this process (SQLite behind the D1 API), the model a stub that writes from the evidence it is
 * sent. Nothing is contacted and nothing is spent. Every outlet, account and post here is invented.
 *   the day's journey: open a desk, read the strip, pin and set aside, mute, collect now with the console, draft, edit,
 *   regenerate a section, see the uncited warning, a conflict with another person, mark as filed, copy and download;
 *   then the keyboard, the Watch tab, Options, a read-only key, the empty and error states, a paused platform, a dropped
 *   connection mid-draft, and a reload with unsaved edits.
 * Run: node --experimental-sqlite tests/den-browser.mjs   (SHOT=1 saves screenshots to tests/shots/den/) */
import fs from 'node:fs';
import { world, open, browser, t, ok, eq, txt, all, tab, toast, shot, panel, finish, H, D, NOW } from './den-fixture.mjs';

console.log('den-browser harness');
const w = await world(); let page = await open(w);

await t('the Den opens from the navigation on a desk, in Australian Eastern time, with nothing spent', async () => {
  ok(await page.$('.rbtn[data-v="den"][aria-current="page"]'), 'the navigation button is current'); eq(await page.title() !== '', true); ok(/Anne's Den/.test(await txt(page, '#vtitle')));
  eq(await all(page, '.den-head select[aria-label="Desk"] option'), ['AEP national', 'AEP Victoria', 'Firearms', 'MCA national', 'MCA Victoria']);
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
  ok(/No narrative on this desk's issues gained rows/.test(await txt(page, 'section.den-panel[aria-label="Key narratives"]')), 'an empty section says why'); await shot(page, '01-today');
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
  ok(/AFR|Australian Financial/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]')) && /headlines only/.test(await txt(page, 'section.den-panel[aria-label="Subscriber outlets"]'))); await shot(page, '02-collection');
});
await t('a draft states its cost first, is one call, and comes back checked against its rows', async () => {
  await tab(page, 'brief'); await page.waitForSelector('#den-tabpanel .den-state'); const empty = await txt(page, '#den-tabpanel'); ok(/No brief has been started for this window/.test(empty) && /Draft the brief \(1 model call\)/.test(empty) && /One model call \(a second only if the first answer cannot be read\)\. 20 of 20 left today/.test(empty), empty.slice(0, 300));
  await page.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await page.waitForSelector('.den-sec[data-section="summary"] textarea'); eq(w.calls.length, 1);
  ok(/^Coverage of the gas taxation debate/.test(await page.inputValue('.den-sec[data-section="summary"] textarea'))); ok(/drafted/.test(await txt(page, '.den-sec[data-section="summary"] h4')));
  ok(/No evidence behind: A campaigner named Sam Private is behind it\./.test(await txt(page, '.den-sec[data-section="summary"] .den-flags')), 'the sentence that rested on an invented row is marked'); ok(/1 without evidence/.test(await txt(page, '.den-bar[role="status"]')));
  ok((await page.inputValue('.den-sec[data-section="summary"] textarea')).indexOf('M:999999') < 0, 'and the invented citation is gone'); eq(await page.$$eval('.den-sec[data-section="summary"] .den-cites a', a => a.map(x => /^https:/.test(x.href))), [true, true]);
  eq(await page.inputValue('#den-tabpanel .den-bar select >> nth=0'), 'Moderate'); eq(await page.inputValue('#den-tabpanel .den-bar select[aria-label="Momentum trend"]'), 'Stable'); ok(/Draft/.test(await txt(page, 'section.den-panel header .den-chip.warn')) && /revision 1/.test(await txt(page, 'section.den-panel header')));
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
  await page.waitForFunction(() => /AEP Queensland - daily.*QLD only/.test(document.querySelector('.den-win').textContent)); eq(await page.inputValue('.den-head select[aria-label="Desk"]'), 'aep_aep_queensland'); eq((await w.F('GET', '/den/desks')).body.desks.find(x => x.id === 'aep_aep_queensland').sections[1].id, 'media', 'the new desk takes the sections of the desk it was made from');
  await page.selectOption('.den-head select[aria-label="Desk"]', 'aep_au'); await page.waitForFunction(() => /AEP national/.test(document.querySelector('.den-win').textContent));
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
  const p = await open(w); await p.selectOption('.den-head select[aria-label="Desk"]', 'guns_au'); await p.waitForFunction(() => /Firearms/.test(document.querySelector('.den-win').textContent)); await p.waitForFunction(() => document.querySelectorAll('#den-tabpanel section.den-panel').length >= 5 && !/Loading/.test(document.querySelector('#den-tabpanel').textContent));
  ok(/News delivered nothing in this window/.test(await txt(p, '.den-strip')) && /before reading it as a quiet day/.test(await txt(p, '.den-strip')), 'the strip does not read an empty desk as a quiet day');
  for (const [title, why] of [['Traditional media', /No story on this desk's issues was filed in this window\. See what was collected, and why not/], ['Social', /No post on this desk's terms or from its registered accounts was collected/], ['Influencer and political', /No registered organisation, official or MP posted/], ['Upcoming', /No row in this window names a day and a month/]]) ok(why.test(await txt(p, 'section.den-panel[aria-label="' + title + '"]')), title);
  await p.locator('section.den-panel[aria-label="Social"] button.den-link').click(); ok(await p.$('#den-tab-collection[aria-selected="true"]')); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state');
  await p.getByRole('button', { name: 'Draft the brief (1 model call)' }).click(); await p.waitForFunction(() => /Nothing on this desk was collected in the window/.test((document.querySelector('.toast, #toast') || {}).textContent || '')); ok(await p.getByRole('button', { name: 'Write it by hand' }).isEnabled());
  await p.getByRole('button', { name: 'Write it by hand' }).click(); await p.waitForSelector('.den-sec[data-section="judgement"] textarea'); eq(await p.$$eval('.den-sec h4', a => a.map(x => x.childNodes[0].textContent.trim())), ['Executive Summary', 'Today\'s Key Judgement', 'Key Developments', 'News environment', 'Organisational and influencer activity', 'Assessment of Activist Momentum', 'Implications for the client', 'Bottom Line', 'Source List']);
  eq(await p.$$eval('#den-tabpanel .den-bar .den-lab', a => a.map(x => x.childNodes[0].textContent.trim())), ['Overall activity level', 'Trend', 'Media risk', 'Social risk'], 'the firearms desk rates three things'); ok(!/edited by/.test(await txt(p, '#den-tabpanel')), 'a brief started by hand has no section marked as edited'); await p.context().close();
});
await t('a failed read says what failed and tries again; a broken panel does not blank the page', async () => {
  let failBoard = 2; w.hooks.push(async (route, r, path) => { if (/^\/den\/board/.test(path) && failBoard > 0) { failBoard--; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'internal_error', detail: 'Something failed on the worker; nothing more was done.' }) }); return true; } return false; });
  const p = await open(w); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Today's evidence could not be loaded\. Something failed on the worker/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li'), 'the strip is still there');
  failBoard = 0; await p.getByRole('button', { name: 'Try again' }).click(); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row');
  let breakIt = true; w.hooks.push(async (route, r, path) => { if (/^\/den\/collection/.test(path) && breakIt) { await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, channels: [null], reach: {} }) }); return true; } return false; });   // the right shape with something in it no panel can draw
  p.removeAllListeners('pageerror'); await tab(p, 'collection'); await p.waitForSelector('#den-tabpanel .den-state.err'); ok(/Collection stopped working\. The rest of the page is unaffected/.test(await txt(p, '#den-tabpanel .den-state.err'))); ok(await p.$('.den-strip li') && await p.$('.den-head select'), 'the header and the strip survive');
  breakIt = false; await tab(p, 'today'); await p.waitForSelector('section.den-panel[aria-label="Traditional media"] tr.den-row'); w.hooks.length = 0; await p.context().close();
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

/* ---- the redesigned interface (DEN.md s.8) ---- */
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
  const w5 = await world(); const p = await open(w5); await p.selectOption('.den-head select[aria-label="Desk"]', 'mca_vic'); await p.waitForFunction(() => /MCA/.test(document.querySelector('.den-win').textContent)); await tab(p, 'today'); await p.waitForSelector('.den-kpis');
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
  const w7 = await world(); await w7.F('POST', '/den/brief', { desk: 'aep_au' }); const p = await open(w7, 'full-key', { width: 1366, height: 768 }); await tab(p, 'today'); await p.waitForSelector('.den-kpis');
  const bg = () => p.evaluate(() => getComputedStyle(document.querySelector('.den-main')).backgroundColor); const light = await bg();
  await p.getByRole('button', { name: 'Dark', exact: true }).click(); await p.waitForFunction(() => document.getElementById('den-root').dataset.theme === 'dark'); ok((await bg()) !== light, 'the workspace changed');
  await p.reload(); await p.waitForSelector('.den-kpis'); eq(await p.evaluate(() => document.getElementById('den-root').dataset.theme), 'dark');
  await p.evaluate(s => { const e = document.createElement('script'); e.textContent = s; document.head.appendChild(e); }, AXE_SRC); const bad = [];
  for (const name of ['today', 'brief', 'watch', 'collection', 'options']) { await tab(p, name); (await axeBad(p)).forEach(x => bad.push(name + ': ' + x)); }
  eq(bad, []); await p.getByRole('button', { name: 'Light', exact: true }).click(); eq(await bg(), light); await p.context().close();
});
await t('the side menu is a tablist a keyboard can use, and Collection shows every channel at a glance', async () => {
  const w8 = await world(); const p = await open(w8, 'full-key', { width: 1024, height: 768 }); await tab(p, 'collection'); await p.waitForSelector('.den-health .den-hc');
  eq(await p.locator('.den-health .den-hc').count(), await panel(p, 'Channels').locator('tr.den-row').count()); eq(await p.getByRole('button', { name: 'Collect now' }).count() > 0, true);
  eq(await p.getAttribute('.den-menu', 'aria-orientation'), 'vertical'); await p.focus('#den-tab-watch'); await p.keyboard.press('Enter'); await p.waitForSelector('#den-tab-watch[aria-selected="true"]');
  eq(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'no sideways scroll at 1024'); await p.context().close();
});

await finish();
