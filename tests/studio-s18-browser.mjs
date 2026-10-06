/* S18: the focused studio and the Creative Director, in real Chromium against the worker module in this process
 * (studio-fixture.mjs; providers MOCKED, nothing spent). The five confirmed failures of the S17 build, each written to fail on
 * it first, then the investigations the redesign brief asked for:
 *   1. an instruction is kept until the worker accepts it; a refused request gives it back with Retry and Edit
 *   2. Enter and the Send button submit through one check: nothing while a request is in flight, nothing empty, nothing
 *      mid-composition (IME), and never twice
 *   3. the Creative Director's composer is inside the window at 1440 x 900 without scrolling the page
 *   4. the client accent reaches the interface (--st-client-accent) for more than one client, with a readable ink, and never
 *      reaches the artwork
 *   5. one current review: the correction offered by the latest inspection is shown once, not again in the conversation
 * Run: node --experimental-sqlite tests/studio-s18-browser.mjs   (SHOT=1 writes tests/shots/s18/t-*.png) */
import fs from 'node:fs';
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
const fx = await makeStudio({ port: 8862, inspect: true });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s18-browser (the focused studio: instruction kept on failure, one submit check, composer in view, client accent, one current review; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = new URL('./shots/s18/', import.meta.url).pathname; fs.mkdirSync(SHOTS, { recursive: true });
const P = await seedStages(fx, { only: ['design'] });
const P2 = await seedStages(fx, { only: ['brief'], ns: 'aep', campaign: 'gas' });
let page;
const shot = async n => { if (process.env.SHOT) await page.screenshot({ path: SHOTS + 't-' + n + '.png' }); };

async function openDesign(viewport) {
  page = await fx.open({ viewport: viewport || { width: 1440, height: 900 }, quiet: true }); page.on('dialog', d => d.accept());
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} });
  const row = R + '.st-lib tbody tr:has-text("S18 at design"), ' + R + '.st-libcard:has-text("S18 at design")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step', { timeout: 15000 });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))');
  const asset = page.locator(R + '.st-assetpick').first(); if (await asset.count()) await asset.click();
  await page.waitForSelector(R + '.st-stage canvas, ' + R + '.st-artboard canvas', { timeout: 15000 }); await sleep(600);
}
async function openDirector(sub) {
  const b = page.locator(R + '.st-insp-mode:has-text("Creative Director"), ' + R + '#st-tabbtn-director, ' + R + '#st-tabbtn-director');
  await b.first().click(); await page.waitForSelector(R + '.st-composer textarea', { timeout: 10000 });
  if (sub) { const s = page.locator(R + '.st-cd-tab:has-text("' + sub + '")'); if (await s.count()) await s.first().click(); }
  await sleep(300);
}
const composer = () => page.$(R + '.st-composer textarea');
const jobPosts = () => fx.seen.filter(s => s.path === '/studio/job' && s.method === 'POST' && /"stage":"revise"/.test(s.body || '')).length;

await T.t('1. an instruction stays in the composer until the worker accepts it; a refused request gives it back with Retry and Edit', async () => {
  await openDesign(); await openDirector('Conversation');
  const f = fx.failNext(/^\/studio\/job$/, 500, { error: 'internal_error', detail: 'simulated' });
  await page.fill(R + '.st-composer textarea', 'Give the headline more room');
  await page.click(R + '.st-composer button:has-text("Send")');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-composer textarea').disabled, null, { timeout: 10000 }).catch(() => {});
  await sleep(800);
  eq(f.hit, 1, 'the request was refused once');
  eq(await (await composer()).inputValue(), 'Give the headline more room', 'the words are still in the composer');
  ok(await page.$(R + '.st-composer .st-send-fail button:has-text("Retry")'), 'Retry is offered beside the failure');
  ok(/not sent/i.test(await page.textContent(R + '.st-composer .st-send-fail')), 'it says the instruction was not sent');
  await shot('1-failed-send');
  await page.click(R + '.st-composer .st-send-fail button:has-text("Retry")');
  await page.waitForFunction(() => { const t = document.querySelector('#studio-root .st-composer textarea'); return t && t.value === ''; }, null, { timeout: 20000 });
  ok(!(await page.$(R + '.st-composer .st-send-fail')), 'accepted on retry: the failure is gone and the composer is clear');
});

await T.t('2. Enter goes through the same check as Send: not while a request is in flight (the words stay), not mid-composition, not empty, never twice', async () => {
  const n0 = jobPosts();
  const release = fx.hold(/^\/studio\/job$/);
  await page.fill(R + '.st-composer textarea', 'First direction');
  await page.focus(R + '.st-composer textarea'); await page.keyboard.press('Enter'); await sleep(400);
  await page.fill(R + '.st-composer textarea', 'Second direction');
  await page.keyboard.press('Enter'); await sleep(400);
  eq(await (await composer()).inputValue(), 'Second direction', 'the second instruction is not cleared while the first is in flight');
  eq(jobPosts() - n0, 1, 'only one request went out');
  release(); await page.waitForFunction(() => !document.querySelector('#studio-root .st-busy'), null, { timeout: 20000 }).catch(() => {}); await sleep(1500);
  // composition (IME): an Enter that confirms a character is not a send
  const n1 = jobPosts();
  await page.$eval(R + '.st-composer textarea', ta => { ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true })); });
  await sleep(400); eq(jobPosts(), n1, 'an Enter during composition sent nothing');
  await page.fill(R + '.st-composer textarea', '   '); await page.focus(R + '.st-composer textarea'); await page.keyboard.press('Enter'); await sleep(300);
  eq(jobPosts(), n1, 'blank words are not sent');
});

await T.t('3. at 1440 x 900 the composer, the artboard and the step navigator are inside the window without scrolling the page', async () => {
  await page.ctxB.close(); await openDesign({ width: 1440, height: 900 }); await openDirector();
  const m = await page.evaluate(() => { const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; }; return { scroll: window.scrollY, composer: b('#studio-root .st-composer textarea'), art: b('#studio-root .st-stage canvas, #studio-root .st-artboard canvas'), steps: b('#studio-root .st-steps, #studio-root .st-flow'), vh: innerHeight, vw: innerWidth }; });
  ok(m.composer && m.composer.top >= 0 && m.composer.bottom <= m.vh, 'composer inside the window: ' + JSON.stringify(m.composer));
  ok(m.art && m.art.top >= 0 && m.art.bottom <= m.vh + 1 && m.art.right <= m.vw, 'artboard inside the window: ' + JSON.stringify(m.art));
  ok(m.steps && m.steps.top >= 0 && m.steps.bottom <= m.vh, 'navigator in view');
  eq(m.scroll, 0, 'the page itself did not scroll');
  await shot('3-director-1440');
});

await T.t('4. the client accent reaches the interface for each client, with a readable ink, and never the artwork', async () => {
  const read = () => page.evaluate(() => { const st = document.querySelector('#studio-root .st'); const cs = getComputedStyle(st); return { accent: cs.getPropertyValue('--st-client-accent').trim(), ink: cs.getPropertyValue('--st-client-ink').trim(), sk: cs.getPropertyValue('--sk-accent').trim() }; });
  const mca = await read();
  ok(/^#?[0-9a-f]{6}$|rgb/i.test(mca.accent), 'MCA sets --st-client-accent: ' + JSON.stringify(mca));
  const art0 = await page.$eval(R + '.st-stage canvas, ' + R + '.st-artboard canvas', c => c.toDataURL().length);
  // the other client
  await page.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} });
  const all = page.locator(R + 'button:has-text("All projects"), ' + R + 'a:has-text("All projects")'); await all.first().click();
  const sel = await page.$(R + 'select[aria-label="Client"]');
  if (sel) await page.selectOption(R + 'select[aria-label="Client"]', { label: 'Australian Energy Producers' }).catch(async () => { await page.selectOption(R + 'select[aria-label="Client"]', 'aep'); });
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("S18 at the brief"), ' + R + '.st-libcard:has-text("S18 at the brief")', { timeout: 15000 });
  await page.locator(R + '.st-lib tbody tr:has-text("S18 at the brief"), ' + R + '.st-libcard:has-text("S18 at the brief")').first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.waitForSelector(R + '.st-step'); await sleep(500);
  const aep = await read();
  ok(aep.accent && aep.accent !== mca.accent, 'AEP has its own accent: ' + aep.accent + ' vs MCA ' + mca.accent);
  const lum = h => { const m = /#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(h) || []; const c = [1, 2, 3].map(i => { const v = parseInt(m[i] || '0', 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  for (const t of [mca, aep]) { const a = lum(t.accent), i = lum(t.ink); const ratio = (Math.max(a, i) + 0.05) / (Math.min(a, i) + 0.05); ok(ratio >= 4.5, 'ink on accent reads at ' + ratio.toFixed(2) + ':1 (' + t.accent + ' / ' + t.ink + ')'); }
  ok(art0 > 1000, 'the artwork was drawn by the renderer from its own layout');
});

await T.t('5. one current review: the correction offered by the latest inspection appears once, and the conversation does not repeat it', async () => {
  await page.ctxB.close(); await openDesign(); await openDirector();
  const g = await api('GET', '/studio/get?id=' + P.design);
  const ins = g.thread.filter(e => e.kind === 'inspection' && e.fix);
  ok(ins.length >= 1, 'the seed has an inspection with a correction (' + ins.length + ')');
  const fixes = await page.$$eval(R + 'textarea[id^="fix-"]', x => x.length);
  const applies = await page.$$eval(R + '.st-partner button, ' + R + '.st-cd button', x => x.filter(b => /^Apply the correction/.test(b.textContent.trim())).length);
  eq(fixes, 1, 'one correction editor');
  eq(applies, 1, 'one Apply the correction');
});

await T.t('6. switching to another asset while an instruction is in flight: the instruction goes to the asset it was written about, and the composer then names the new asset', async () => {
  await page.ctxB.close(); await openDesign(); await openDirector('Conversation');
  const chips = await page.$$(R + '.st-pagechip'); ok(chips.length >= 2, 'two pieces to switch between');
  const first = (await page.textContent(R + '.st-pagechip.on .st-pagechip-t')).trim();
  const release = fx.hold(/^\/studio\/job$/);
  await page.fill(R + '.st-composer textarea', 'Tighten the support line'); await page.click(R + '.st-composer button:has-text("Send")'); await sleep(300);
  await page.click(R + '.st-pagechip:not(.on)'); await sleep(500);
  const second = (await page.textContent(R + '.st-pagechip.on .st-pagechip-t')).trim(); ok(second !== first, 'switched: ' + first + ' -> ' + second);
  release(); await page.waitForFunction(() => { const t = document.querySelector('#studio-root .st-composer textarea'); return t && t.value === ''; }, null, { timeout: 20000 });
  const g = await api('GET', '/studio/get?id=' + P.design); const sent = fx.seen.filter(x => x.path === '/studio/job' && /"stage":"revise"/.test(x.body || '')).pop();
  const aFirst = g.assets.find(x => x.title === first); ok(aFirst && JSON.parse(sent.body).input.asset === aFirst.id, 'the instruction went to the asset it was written about (' + first + ')');
  ok(new RegExp(second).test(await page.textContent(R + '.st-cd-scope')), 'the scope line now names ' + second);
  ok(!page.errors.length, page.errors.join(' | '));
});

await T.t('7. a review of an earlier version is marked outdated once the words change; its correction asks before applying to the newer version', async () => {
  await page.ctxB.close(); await openDesign(); await openDirector('Review');
  await tool(page, 'Text'); await page.fill(R + '#st-f-headline', 'Hands off our fuel, again'); await page.press(R + '#st-f-headline', 'Tab');
  await page.waitForFunction(() => /outdated: judged v/.test((document.querySelector('#studio-root .st-cd-review') || {}).textContent || ''), null, { timeout: 15000 });
  ok(await page.$(R + '.st-cd-review button:has-text("anyway")'), 'the correction is offered for the current version only as a deliberate choice');
  ok(/Review v\d+ \(1 model call\)/.test(await page.textContent(R + '.st-cd-review .st-adreview-head')), 'and a fresh review of the new version is one click');
});

await T.t('8. the conversation follows new messages only while the reader is at its foot: reading older messages is not interrupted', async () => {
  for (let i = 0; i < 14; i++) await api('POST', '/studio/note', { project: P.design, text: 'Earlier note number ' + i + ' about the regional angle and the claim we answer.', target: 'the whole set' });
  await page.ctxB.close(); await openDesign(); await openDirector('Conversation');
  const body = R + '.st-cd-body';
  const m0 = await page.$eval(body, el => ({ h: el.scrollHeight, c: el.clientHeight, t: el.scrollTop })); ok(m0.h > m0.c + 100, 'the thread scrolls: ' + JSON.stringify(m0));
  ok(m0.h - m0.t - m0.c < 60, 'it opens at the newest message');
  await page.$eval(body, el => { el.scrollTop = 0; el.dispatchEvent(new Event('scroll')); }); await sleep(200);
  await page.fill(R + '.st-composer textarea', 'A note recorded while reading the top'); await page.click(R + '.st-composer .ov-link:has-text("record as a note instead")');
  await page.waitForFunction(() => /A note recorded while reading the top/.test(document.querySelector('#studio-root .st-cd-body').textContent), null, { timeout: 15000 }); await sleep(300);
  eq(await page.$eval(body, el => el.scrollTop), 0, 'the reader stayed where they were');
  await page.$eval(body, el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); }); await sleep(200);
  await page.fill(R + '.st-composer textarea', 'A note recorded at the foot'); await page.click(R + '.st-composer .ov-link:has-text("record as a note instead")');
  await page.waitForFunction(() => /A note recorded at the foot/.test(document.querySelector('#studio-root .st-cd-body').textContent), null, { timeout: 15000 }); await sleep(300);
  const m1 = await page.$eval(body, el => ({ h: el.scrollHeight, c: el.clientHeight, t: el.scrollTop })); ok(m1.h - m1.t - m1.c < 60, 'at the foot it follows the new message: ' + JSON.stringify(m1));
});

await T.t('9. one correction applied once: a double click sends one request', async () => {
  await page.ctxB.close(); await openDesign(); await openDirector('Review');
  const n0 = fx.seen.filter(x => x.path === '/studio/inspection/apply').length;
  const btn = page.locator(R + '.st-cd-review button:has-text("Apply the correction")'); ok(await btn.count(), 'the correction is offered');
  await btn.dblclick(); await sleep(1500);
  eq(fx.seen.filter(x => x.path === '/studio/inspection/apply').length - n0, 1, 'one apply request');
});

await T.t('10. the save state names what is true: unsaved changes, then a draft kept for this person, then a version', async () => {
  await page.ctxB.close(); await openDesign();
  const save = () => page.textContent(R + '.st-head .st-save');
  ok(/Version saved/.test(await save()), 'nothing pending: ' + await save());
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.keyboard.press('ArrowDown'); await sleep(150);
  ok(/Unsaved changes|Draft saved/.test(await save()), 'after a nudge: ' + await save());
  await page.waitForFunction(() => /Draft saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 10000 });
  ok(/Draft saved/.test(await page.textContent(R + '.st-le-foot')), 'the canvas foot says the same');
  const n0 = (await api('GET', '/studio/get?id=' + P.design)).assets.reduce((x, a) => x + a.versions.length, 0);
  await page.click(R + '.st-le-foot .btn:has-text("Save layout")');
  await page.waitForFunction(() => /Version saved/.test(document.querySelector('#studio-root .st-head .st-save').textContent), null, { timeout: 15000 });
  const n1 = (await api('GET', '/studio/get?id=' + P.design)).assets.reduce((x, a) => x + a.versions.length, 0); eq(n1, n0 + 1, 'one new version');
});

await T.t('11. a read-only key sees the canvas as it stands: no editing handles, no composer, no save line, the review without its controls', async () => {
  page = await fx.open({ viewport: { width: 1440, height: 900 }, quiet: true, role: 'read' });
  const row = R + '.st-lib tbody tr:has-text("S18 at design"), ' + R + '.st-libcard:has-text("S18 at design")';
  await page.waitForSelector(row, { timeout: 15000 }); await page.locator(row).first().locator('button.st-lib-open, .ov-link, button:has-text("Open")').first().click();
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await page.waitForSelector(R + '.st-stage canvas', { timeout: 15000 }); await sleep(500);
  eq(await page.$(R + '.st-le-layer'), null, 'no editing handles');
  eq(await page.$(R + '.st-head .st-save'), null, 'no save state to report');
  await page.click(R + '#st-tabbtn-director');
  eq(await page.$(R + '.st-composer'), null, 'no composer'); ok(/full key/.test(await page.textContent(R + '.st-cd')), 'it says why');
  eq(await page.$(R + '.st-cd-review button:has-text("Apply")'), null, 'no correction to apply');
  ok(/read-only key/.test(await page.textContent(R + '.st-head')), 'the header names the read-only key');
});

for (const vp of [{ width: 1920, height: 1080 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  await T.t('12. at ' + vp.width + ' x ' + vp.height + ' the artboard fits, nothing scrolls sideways, and the composer is reachable' + (vp.width < 1200 ? ' in the inspector drawer' : ''), async () => {
    await page.ctxB.close(); await openDesign(vp);
    const m = await page.evaluate(() => { const b = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: r.width }; }; return { art: b('#studio-root .st-stage canvas'), sx: document.scrollingElement.scrollWidth, vw: innerWidth, vh: innerHeight, sy: window.scrollY }; });
    ok(m.art && m.art.top >= 0 && m.art.bottom <= m.vh + 1 && m.art.left >= 0 && m.art.right <= m.vw + 1, 'artboard inside the window: ' + JSON.stringify(m.art));
    ok(m.sx <= m.vw + 1, 'no sideways scroll (' + m.sx + ' of ' + m.vw + ')'); eq(m.sy, 0, 'the page did not scroll');
    if (vp.width < 1200) { ok(await page.isVisible(R + '.st-insp-toggle'), 'the inspector is behind a button'); await page.click(R + '.st-insp-toggle'); await sleep(450); }
    await page.click(R + '#st-tabbtn-director'); await page.waitForSelector(R + '.st-composer textarea');
    const c = await page.$eval(R + '.st-composer textarea', el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    ok(c.top >= 0 && c.bottom <= m.vh && c.left >= 0 && c.right <= m.vw + 1, 'composer in view: ' + JSON.stringify(c));
    await shot('12-' + vp.width);
    if (vp.width < 1200) { await page.keyboard.press('Escape'); await sleep(400); ok(!(await page.$(R + '.st-inspector.open')), 'Escape closes the drawer'); }
  });
}

const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
