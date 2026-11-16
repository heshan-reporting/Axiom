/* Anne's Den, the Brief's section editor and evidence pane in a browser (release r52, 16 November 2026; the owner's
 * screenshot of a Write box of raw [S:123] codes stacked over a second "As it reads" copy, and of evidence cards headed by
 * raw ids with "not filed" under each). One page per section: it reads by default, a sentence or the Edit button opens the
 * same page as the editor, and leaving it saves once and reads again. An evidence card is headed by where the row came
 * from and what it says; the id stays in its accessible name and a small code. Filing never lists a collection gap.
 * Nothing is contacted and nothing is spent but the stub model's one draft per world.
 * Run: node --experimental-sqlite tests/den-editor-browser.mjs */
import fs from 'node:fs';
import { world, open, t, ok, eq, txt, all, tab, finish, sec } from './den-fixture.mjs';

console.log('den-editor-browser harness (the section page, the evidence card, filing without gaps)');
const S = '.den-sec[data-section="summary"]';
const saves = p => p.served.filter(x => x === 'POST /den/brief/save').length;
const mode = p => p.getAttribute(S, 'data-mode');
const brief = async (p) => { await tab(p, 'brief'); await p.waitForSelector(S + ' textarea'); return p; };
/* the first line of a sentence's box: a sentence can wrap, and its box's centre can then fall on a chip */
const sentenceAt = (p, rx) => p.evaluate(([sel, src]) => { const re = new RegExp(src); const sp = Array.from(document.querySelectorAll(sel + ' .den-cites [data-at]')).find(x => re.test(x.textContent)); if (!sp) return null; const r = sp.getClientRects()[0]; return { x: r.left + 6, y: r.top + r.height / 2, at: +sp.dataset.at }; }, [S, rx.source]);

const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' });
const page = await brief(await open(w));

await t('reading is the default: one text, no raw citation mark in sight, and the editing surface is not drawn twice', async () => {
  eq(await mode(page), 'read');
  const reads = await page.locator(S + ' .den-reads').innerText(); ok(!/\[[A-Z]:[A-Za-z0-9_.-]+\]/.test(reads), 'a raw mark in the reading view: ' + reads.slice(0, 200));
  ok(/\[M:\d+\]/.test(await page.inputValue(S + ' textarea')), 'the saved words still carry their marks');
  eq(await page.locator(S + ' textarea').evaluate(e => getComputedStyle(e).opacity), '0', 'the textarea is not drawn under the text');
  ok(!(await page.locator(S).innerText()).match(/citations are typed as|As it reads/), 'no Write label and no second copy heading');
  eq(await page.locator(S + ' input').count(), 0, 'no input in the section at rest');
  eq(await page.locator(S + ' .den-modes button').evaluateAll(b => b.map(x => x.textContent.trim() + ':' + x.getAttribute('aria-pressed'))), ['Read:true', 'Edit:false']);
  eq(await page.locator(S + ' .den-eyebrow .den-chip:not(.warn)').count(), 0, 'the eyebrow does not repeat the state the title carries; only a flag count is said there');
  ok(/1 flag/.test(await txt(page, S + ' .den-eyebrow')) && /drafted/.test(await txt(page, S + ' h4')), 'one state by the title, the flag count above it');
  const nums = await page.$$eval('.den-outline [data-goto]:not(.den-out-src) .den-outn', els => els.map(e => e.textContent.trim()));
  eq(nums, nums.map((x, i) => String(i + 1)), 'the outline numbers its sections 1 to n (a tenth reads 10, not a key cap 0)');
  eq(page.errors, []);
});

await t('a click on a sentence edits in place, with the cursor at the end of that sentence', async () => {
  const pt = await sentenceAt(page, /^Coverage of the gas taxation/); ok(pt, 'the first sentence carries where it ends');
  await page.mouse.click(pt.x, pt.y); await page.waitForSelector(S + '[data-mode="edit"]');
  await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA');
  const v = await page.inputValue(S + ' textarea'); const at = await page.locator(S + ' textarea').evaluate(e => e.selectionStart);
  eq(at, pt.at, 'the cursor is where the sentence ends'); ok(v.slice(0, at).endsWith('].') && v[at] === ' ', 'and that is after its citation and its full stop: ' + JSON.stringify(v.slice(at - 12, at + 3)));
  ok(await page.locator(S + ' .den-reads').isHidden(), 'the reading copy steps aside while the words are edited');
  eq(await page.locator(S + ' .den-modes button[aria-pressed="true"]').textContent(), 'Edit');
});

await t('leaving without typing sends nothing; leaving after typing saves once and reads again', async () => {
  const before = saves(page);
  await page.keyboard.press('Escape'); await page.waitForSelector(S + '[data-mode="read"]'); await page.waitForTimeout(300);
  eq(saves(page), before, 'entering and leaving the editor without typing sends no save');
  await page.locator(S + ' .den-modes button', { hasText: 'Edit' }).click(); await page.waitForSelector(S + '[data-mode="edit"]');
  await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA');
  await page.locator(S + ' textarea').evaluate(e => e.setSelectionRange(e.value.length, e.value.length)); await page.keyboard.type(' Anne added this.');   // End would stop at the end of a wrapped line
  ok(/not saved/.test(await txt(page, S + ' h4')), 'the title says the words are not saved: ' + await txt(page, S + ' h4'));
  await page.locator('.den-outline-h').click(); await page.waitForSelector(S + '[data-mode="read"]');
  await page.waitForFunction(() => /Saved, revision 2/.test(document.querySelector('.den-bar[role="status"]').textContent));
  eq(saves(page), before + 1, 'one save, on leaving'); ok(/edited by Anne/.test(await txt(page, S + ' h4')), 'marked as a person\'s edit');
  ok(/Anne added this\./.test(await page.locator(S + ' .den-reads').innerText()), 'the reading view shows the saved words');
  const saved = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief.sections.summary.text; ok(/Anne added this\.$/.test(saved), 'the worker holds them: ' + saved.slice(-60));
});

await t('a card pressed while editing cites at the cursor, keeps the editor open, and the whole edit is one revision', async () => {
  const b0 = (await w.F('GET', '/den/brief?desk=aep_au')).body.brief; const before = saves(page);
  const ta = page.locator(S + ' textarea'); await ta.evaluate(e => { e.focus(); e.setSelectionRange(8, 8); }); await page.waitForSelector(S + '[data-mode="edit"]');
  const cardsHere = page.locator('.den-evpane .den-evlist .den-evcard:not([disabled])'); ok(await cardsHere.count() >= 2, 'the section has cards to cite');
  const ids = []; for (const i of [0, 1]) { const c = cardsHere.nth(i); ids.push((/^Cite ([A-Z]:[A-Za-z0-9_.-]+):/.exec(await c.getAttribute('aria-label')) || [])[1]); await c.click();
    eq(await mode(page), 'edit', 'the editor stays open after a card'); await page.waitForFunction(() => document.activeElement && document.activeElement.tagName === 'TEXTAREA'); }
  const v = await ta.inputValue(); ok(v.indexOf('[' + ids[0] + ']') >= 0 && v.indexOf('[' + ids[1] + ']') > v.indexOf('[' + ids[0] + ']'), 'both marks went in, in order: ' + v.slice(0, 80));
  eq(saves(page), before, 'no save per card'); ok(/Unsaved changes/.test(await txt(page, '.den-bar[role="status"]')));
  await page.keyboard.press('Escape'); await page.waitForSelector(S + '[data-mode="read"]');
  await page.waitForFunction(r => new RegExp('Saved, revision ' + r).test(document.querySelector('.den-bar[role="status"]').textContent), b0.revision + 1);
  eq(saves(page), before + 1, 'one save for the whole edit'); eq((await w.F('GET', '/den/brief?desk=aep_au')).body.brief.revision, b0.revision + 1, 'one revision, not one per card');
  eq(page.errors, []); await page.context().close();
});

/* A brief whose evidence holds rows the Board has not read (a post from another day's read, a tone figure, a Sentinel
   alert, a narrative), as a brief drafted under worker p67 (with text and sub) or p66 (label only) sends them. */
const EXTRA = {
  'S:777777': { k: 'social', label: 'mastodon post', url: 'https://mastodon.example/@a/1', gated: 0, item: 777777, text: 'The windfall tax on gas is overdue, sign the petition today.', sub: '55 interactions, 14 Nov' },
  'S:777778': { k: 'social', label: 'bluesky post', url: 'https://bsky.example/p/1', gated: 0, item: 777778 },
  'T:gastax': { k: 'tone', label: 'Gas taxation', url: '', gated: 0, item: 0, sub: '214 rows judged, mean tone -0.2' },
  'A:9': { k: 'alert', label: 'Sentinel spike: Gas taxation', url: '', gated: 0, item: 0 },
  'N:zz1': { k: 'narrative', label: 'Diesel rebate criticism grows among regional growers and their peak bodies', url: '', gated: 0, item: 0 },
  'M:888881': { k: 'media', label: 'pointpost - A second pointpost story on the levy', url: 'https://pointpost.example.com.au/z', gated: 0, item: 888881 },
};
const MORE = ' One post said it plainly [S:777777]. Another agreed [S:777778]. Tone held [T:gastax]. Sentinel saw it [A:9]. A story grew [N:zz1]. It ran again [M:888881].';
const w2 = await world(); await w2.F('POST', '/den/brief', { desk: 'aep_au' });
w2.hooks = [async (route, r, path) => { if (r.method() !== 'GET' || !/^\/den\/brief\?/.test(path)) return false;
  const res = await w2.call('GET', path, null, r.headers()['x-axiom-key'] || null); const d = JSON.parse(res.text);
  if (d.brief && d.brief.sections && d.brief.sections.summary) { d.brief.evidence = Object.assign({}, d.brief.evidence, EXTRA); d.brief.sections.summary.text += MORE; }
  await route.fulfill({ status: res.status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) }); return true; }];
const p2 = await brief(await open(w2));

await t('an evidence card is headed by its source in words; a row the Board has not read shows its words when the worker sends them, and its label when it does not', async () => {
  const card = id => p2.locator('.den-evpane li[data-cite="' + id + '"]');
  const a = card('S:777777'); await a.waitFor();
  eq(await a.locator('.den-evsrc').innerText(), 'Mastodon post'); ok(/windfall tax on gas is overdue/.test(await a.locator('.den-t').innerText())); ok(/55 interactions/.test(await a.locator('.den-sub').innerText()));
  ok(/^Cite S:777777: /.test(await a.locator('.den-evcard').getAttribute('aria-label')), 'the id stays in the accessible name'); eq(await a.locator('.den-evcode').count(), 0, 'and nowhere on the card face (release review)'); ok(!/S:777777/.test(await a.innerText()), 'no raw id printed on the card');
  ok(!/^[A-Z]:\d+/.test((await a.locator('.den-evcard').innerText()).trim()), 'the card does not lead with an id');
  const b = card('S:777778'); eq(await b.locator('.den-evsrc').innerText(), 'Bluesky post'); ok(!/S:777778/.test(await b.locator('.den-evcard').innerText()), 'no raw id on the face of a label-only card');
  ok((await b.locator('.den-t').innerText()).length > 10, 'a label-only post still says something in words');
  // every card in the pane leads with words: the head is never a raw id
  const heads = await p2.$$eval('.den-evpane .den-evcard', els => els.map(e => e.innerText.trim().split('\n')[0])); ok(heads.length >= 6 && heads.every(h => !/^[A-Z]:[A-Za-z0-9_.-]+$/.test(h)), JSON.stringify(heads));
  // a board card cited here is headed by its outlet and says what it is
  const m = p2.locator('.den-evpane li[data-kind="media"]').first(); ok(/pointpost/.test(await m.locator('.den-evsrc').innerText()) && /Harbour levy/.test(await m.locator('.den-t').innerText()));
  ok(await m.locator('.den-evact a.den-link', { hasText: 'Open' }).count() === 1, 'Open is inside the card');
  eq(p2.errors, []);
});

await t('a tone figure, a Sentinel alert and agency memory say nothing about filing; chips carry the narrative\'s name, "Tone: <issue>", and a number shared with the card', async () => {
  for (const k of ['tone', 'alert']) { const li = p2.locator('.den-evpane li[data-kind="' + k + '"]'); ok(await li.count() >= 1, k + ' card listed'); const tx = await li.first().textContent(); ok(!/not filed|filed under|File here|Unfile|Add to this section|Remove/.test(tx), k + ': ' + tx); eq(await li.first().getAttribute('data-filed'), 'na'); }
  { const nli = p2.locator('.den-evpane li[data-kind="narrative"]').first(); eq(await nli.getAttribute('data-filed'), 'none', 'a narrative can be filed, and is not'); ok(!/not filed/.test(await nli.textContent()), 'without the words "not filed" on the card (release review)'); }
  const chips = await all(p2, S + ' .den-cites button.den-cite'); ok(chips.indexOf('Tone: Gas taxation') >= 0 && chips.indexOf('Sentinel alert') >= 0, JSON.stringify(chips));
  ok(chips.some(c => /^Narrative: Diesel rebate criticism/.test(c) && c.length <= 'Narrative: '.length + 29), 'the narrative chip names it, shortened: ' + JSON.stringify(chips));
  ok(chips.indexOf('pointpost') >= 0 && chips.indexOf('pointpost 2') >= 0, 'two stories of one outlet read apart: ' + JSON.stringify(chips));
  const ns = await p2.$$eval(S + ' .den-cites .den-cite[data-n]', els => els.map(e => [e.getAttribute('data-n'), (/^\[?([A-Z]:[A-Za-z0-9_.-]+)/.exec(e.title) || [])[1]]));
  ok(ns.length >= 7 && ns.every((x, i, a) => +x[0] >= 1 && (i === 0 || +x[0] >= +a[i - 1][0])), 'chips are numbered in order: ' + JSON.stringify(ns));
  const [n, id] = ns.find(x => x[1] === 'S:777777'); eq((await p2.locator('.den-evpane li[data-cite="' + id + '"] .den-evnum').innerText()).trim(), n, 'the card carries the chip\'s number');
  ok(/Cited here, filed elsewhere/.test(await txt(p2, '.den-evpane')), 'the group still says what it is to a screen reader');
  eq(p2.errors, []); await p2.context().close();
});

await t('a read-only key reads only: no Edit, no hint, a textarea out of the tab order, a sentence click that does not edit, and cards that are not dimmed', async () => {
  const p = await brief(await open(w2, 'read-key'));
  eq(await mode(p), 'read'); eq(await p.locator(S + ' .den-modes').count(), 0, 'no Read / Edit control'); eq(await p.locator(S + ' textarea').getAttribute('tabindex'), '-1');
  ok(!/Click any sentence|Click a card/.test(await p.locator(S).innerText()), 'no editing hint');
  const pt = await sentenceAt(p, /^Coverage of the gas taxation/); await p.mouse.click(pt.x, pt.y); await p.waitForTimeout(300);
  eq(await mode(p), 'read', 'a click on a sentence does not open an editor'); ok(await p.evaluate(() => !document.activeElement || document.activeElement.tagName !== 'TEXTAREA'));
  eq(await p.locator('.den-evpane .den-evcard').first().evaluate(e => getComputedStyle(e).opacity), '1', 'a card is not dimmed for a reader');
  eq(await p.locator('#den-tabpanel button', { hasText: /^(File here|Unfile|Add to this section|Remove|Edit|Read)$/ }).count(), 0, 'nothing that files or edits');
  eq(p.served.filter(s => /^POST \/den\//.test(s)), [], 'and nothing was sent'); eq(p.errors, []); await p.context().close();
});

await t('axe finds no serious or critical violation on the Brief while reading and while editing, at 1366, 1440 and 1920', async () => {
  const AXE = fs.readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
  const p = await brief(await open(w)); await p.addScriptTag({ content: AXE }); const bad = [];
  const run = async where => { await p.waitForTimeout(250); const v = await p.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' at ' + x.nodes.slice(0, 6).map(n => n.target.join(' ').slice(-70)).join(' | ')); }); bad.push(...v.map(x => where + ': ' + x)); };
  for (const wdt of [1366, 1440, 1920]) { await p.setViewportSize({ width: wdt, height: 900 }); await run('read at ' + wdt);
    await p.locator(S + ' .den-modes button', { hasText: 'Edit' }).click(); await p.waitForSelector(S + '[data-mode="edit"]'); await run('edit at ' + wdt);
    await p.keyboard.press('Escape'); await p.waitForSelector(S + '[data-mode="read"]'); }
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(over <= 1, 'the page scrolls sideways by ' + over);
  eq(bad, [], 'accessibility'); eq(p.errors, []); await p.context().close();
});

/* Filing under worker p66: its list of what the brief does not cover still carries collection gaps. The page drops them;
   when nothing else was open it files at once, acknowledging them, with no dialog. */
const GAP = { sig: 'gap', key: 'G:facebook', title: 'Facebook delivered nothing in this window', detail: 'The official route is not granted. No signed-in collector is connected.' };
const SPIKE = { sig: 'spike', key: 'A:1', title: 'Sentinel spike: Gas taxation', detail: 'Three times the usual volume.' };
const fileWorld = async list => { const wf = await world(); await wf.F('POST', '/den/brief', { desk: 'aep_au' }); const sent = [];
  wf.hooks = [async (route, r, path) => { if (r.method() !== 'POST' || path !== '/den/brief/file') return false; const b = JSON.parse(r.postData() || '{}'); sent.push(b);
    if (b.acknowledge || b.reopen) return false;
    await route.fulfill({ status: 409, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ ok: false, error: 'uncited_signals', detail: list.length + ' things on the strip are not in this brief.', signals: list }) }); return true; }];
  return { wf, sent, p: await brief(await open(wf)) }; };

await t('a filing whose only open item is a collection gap files in one press, with no dialog, and records it as acknowledged', async () => {
  const { wf, sent, p } = await fileWorld([GAP]);
  await p.getByRole('button', { name: 'Mark as filed' }).click(); await p.waitForFunction(() => /Filed by Anne/.test(document.querySelector('#den-tabpanel section.den-panel header').textContent));
  eq(await p.locator('[role="dialog"]').count(), 0, 'no dialog for a collection gap'); eq(sent.map(b => !!b.acknowledge), [false, true], 'asked once, then filed acknowledging');
  eq((await wf.F('GET', '/den/brief?desk=aep_au')).body.brief.status, 'filed'); ok(!/delivered nothing/.test(await p.locator('#den-tabpanel').innerText()), 'and the Brief never said it');
  eq(p.errors, []); await p.context().close();
});

await t('a filing with a gap and a check lists the check only; the gap is never in the dialog', async () => {
  const { sent, p } = await fileWorld([GAP, SPIKE]);
  await p.getByRole('button', { name: 'Mark as filed' }).click(); await p.waitForSelector('[role="dialog"][aria-label="Before it is filed"]');
  const d = await txt(p, '[role="dialog"]'); ok(/Sentinel spike: Gas taxation/.test(d) && !/Facebook delivered nothing/.test(d) && /^One thing|One thing/.test(d), d.slice(0, 200));
  await p.getByRole('button', { name: 'Go back and cover them' }).click(); eq(sent.length, 1, 'going back sends nothing more');
  await p.getByRole('button', { name: 'Mark as filed' }).click(); await p.getByRole('button', { name: 'File anyway' }).click(); await p.waitForFunction(() => /Filed by Anne/.test(document.querySelector('#den-tabpanel section.den-panel header').textContent));
  eq(sent.map(b => !!b.acknowledge), [false, false, true]);
  // a filed brief reads: no editor, no add to this section, the pull list's button is there and cannot be pressed
  eq(await mode(p), 'read'); eq(await p.locator(S + ' .den-modes').count(), 0); eq(await p.locator(S + ' textarea').getAttribute('tabindex'), '-1');
  await p.locator('.den-pull .den-fold').click(); const fh = p.locator('.den-pulllist li button', { hasText: 'Add to this section' }); if (await fh.count()) ok(await fh.first().isDisabled(), 'Add to this section cannot be pressed on a filed brief');
  eq(p.errors, []); await p.context().close();
});

await t('a brief started by hand says plainly whether its cards can be cited, and offers no paid redraft as the only way on', async () => {
  const wh = await world(); const p = await open(wh); await tab(p, 'brief'); await p.waitForSelector('#den-tabpanel .den-state'); await p.getByRole('button', { name: 'Write it by hand' }).click();
  await p.waitForSelector(S + ' textarea', { state: 'attached' }); eq(wh.calls.length, 0, 'nothing was spent');
  eq(await mode(p), 'edit', 'an empty section opens as the editor: the placeholder is the invitation'); ok(/Click a card on the right to cite it/.test(await p.getAttribute(S + ' textarea', 'placeholder')));
  // under worker p66 a hand-started brief holds no evidence and the pane says so; from p67 the worker fills the window's
  // rows at the start (no model call), and the pane then invites a cite and its cards under More from this window cite
  const got = await wh.F('GET', '/den/brief?desk=aep_au'); const held = Object.keys(((got.body || {}).brief || {}).evidence || {}).length; const head = await txt(p, '.den-evhead');
  if (!held) ok(/started by hand/.test(head), 'with nothing citable the pane says why: ' + head);
  else {
    ok(!/started by hand/.test(head) && /Click a card to cite it/.test(head), 'evidence is held, so the pane invites a cite: ' + head);
    const pull = p.locator('.den-evpane [data-tour="pull"]'); if (await pull.count() && (await pull.getAttribute('aria-expanded')) !== 'true') await pull.click();
    await p.waitForSelector('.den-evpane [data-tour="pull-file"]'); ok(await p.locator('.den-evpane [data-tour="pull-file"]').count() > 0, 'the window\'s rows are there to file here and cite');
  }
  eq(p.errors, []); await p.context().close();
});

await t('the page holds the kill switch and its stylesheet holds to the tokens', async () => {
  const js = fs.readFileSync(new URL('../docs/den-brief.js', import.meta.url), 'utf8'); ok(/const DEN_EDITOR_STACK = (true|false);/.test(js), 'DEN_EDITOR_STACK is one constant');
  const css = fs.readFileSync(new URL('../docs/den-brief.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/#[0-9a-fA-F]{3,8}\b/.test(css), 'no hex colour in den-brief.css'); ok(!/border-radius\s*:\s*\d+px/.test(css), 'no pixel radius'); ok(!/font-family\s*:/.test(css.replace(/var\(--dn-[a-z]+\)/g, '')), 'no new font');
  ok(css.length > 2000, 'the stylesheet exists');
});

await finish();
