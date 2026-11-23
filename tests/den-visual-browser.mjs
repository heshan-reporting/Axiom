/* Anne's Den, the VISUAL lane's harness (den.css only): the token additions and retunes, grounds and objects, the neutral
 * rail, the Unsorted header and card diets, empty columns, the contract C3 classes, states, motion and its must-nots,
 * field boundaries, quiet chips, and axe on states the main harness does not open (a pill's findings, a drag in flight).
 * Computed styles only; it changes no Den behaviour. Nodes it adds (an icon, a class) are what the SHELL lane will emit.
 * Run from a worktree, sandbox off: node --experimental-sqlite <this file>   (REPO=<worktree> to point elsewhere) */
import fs from 'node:fs';
const REPO = process.env.REPO || new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { world, open, t, ok, eq, tab, finish, CARD, cards } = await import(REPO + '/tests/den-fixture.mjs');
const CSS = fs.readFileSync(REPO + '/docs/den.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
console.log('den-visual-browser harness');

/* a token resolved to the colour the page paints with it */
const rgb = (page, tok) => page.evaluate(n => { const e = document.createElement('i'); e.style.color = 'var(' + n + ')'; document.getElementById('den-root').appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; }, tok);
const cs = (page, sel, prop, pseudo) => page.$eval(sel, (e, a) => getComputedStyle(e, a[1] || null).getPropertyValue(a[0]).trim(), [prop, pseudo]);
const tok = (page, n) => page.evaluate(n => getComputedStyle(document.getElementById('den-root')).getPropertyValue(n).trim(), n);
const CLEAR = 'rgba(0, 0, 0, 0)';
/* a rule in den.css whose selector list holds sel and whose body holds text */
const ruleHas = (sel, text) => Array.from(CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)).some(m => m[1].split(',').map(x => x.trim()).indexOf(sel) >= 0 && m[2].indexOf(text) >= 0);

const w = await world(); await w.F('POST', '/den/brief', { desk: 'aep_au' });
const page = await open(w);
await page.waitForSelector(CARD('media'));

await t('V1 the additive tokens and the retunes are declared once, on #den-root', async () => {
  for (const n of ['--dn-ink-4', '--dn-line-3', '--dn-ring', '--dn-ring-warn', '--dn-lh-tight', '--dn-lh-body', '--dn-lh-read', '--dn-track-caps', '--dn-dur-3', '--dn-ease-out', '--dn-icon', '--dn-z-bar', '--dn-z-drawer', '--dn-z-menu', '--dn-z-pop', '--dn-z-dialog', '--dn-z-tour']) ok(await tok(page, n), n + ' is not declared');
  eq([await tok(page, '--dn-r-md'), await tok(page, '--dn-r-lg'), await tok(page, '--dn-col-w-c'), await tok(page, '--den-pad'), await tok(page, '--den-gap'), await tok(page, '--dn-icon'), await tok(page, '--dn-z-tour')], ['8px', '12px', '176px', '8px', '16px', '16px', '80'], 'the retuned values');
  eq([await tok(page, '--dn-outline-w'), await tok(page, '--dn-ev-w')], ['228px', '372px'], 'outline and evidence widths under 1600');
});

await t('V2 a ground has a line and no shadow, an object keeps its shadow', async () => {
  eq(await cs(page, '.den-col[data-sec]', 'box-shadow'), 'none', 'a section column'); eq(await cs(page, '.den-unsorted', 'box-shadow'), 'none', 'Unsorted');
  eq(await cs(page, '.den-col[data-sec]', 'background-color'), await rgb(page, '--dn-bg-1'), 'columns drop to bg-1');
  ok((await cs(page, CARD('media'), 'box-shadow')) !== 'none', 'a card is still raised');
  await tab(page, 'watch'); await page.waitForSelector('.den-page section.den-panel'); eq(await cs(page, '.den-page section.den-panel', 'box-shadow'), 'none', 'a panel'); await tab(page, 'today'); await page.waitForSelector(CARD('media'));
});

await t('V3 the rail is neutral: a pill with findings sits on the neutral ground, the colour is on its count; the heading is one line', async () => {
  const pill = '.den-strip li[data-sig="spike"] button.den-check.has';
  await page.waitForSelector(pill);
  eq(await cs(page, pill, 'background-color'), await rgb(page, '--dn-neutral-dim'), 'the spike pill is not filled red');
  eq(await cs(page, pill + ' b', 'color'), await rgb(page, '--dn-neg-ink'), 'its count carries the colour');
  eq(await cs(page, '.den-strip-h', 'text-transform'), 'none'); eq(await cs(page, '.den-strip-h', 'font-size'), '12px', 'the key number is not the smallest text');
  const h = await page.$eval('.den-strip-h', e => e.getBoundingClientRect().height); ok(h <= 20, 'one line, not two: ' + h);
});

await t('V4 the Unsorted header is on a diet: 16px title, a one-line hint, one filter row, no disabled Undo', async () => {
  eq(await cs(page, '.den-unsorted .den-col-h h3', 'font-size'), '16px'); eq(Math.round(await page.$eval('.den-unsorted', e => e.getBoundingClientRect().width)) + 'px', await tok(page, '--dn-uns-w'), 'a one-line hint never widens the column');
  const sub = await page.$eval('.den-unsorted .den-colsub', e => ({ h: e.getBoundingClientRect().height, lh: parseFloat(getComputedStyle(e).lineHeight), text: e.textContent })); ok(sub.h <= sub.lh * 1.5, 'the hint is one line: ' + JSON.stringify(sub)); ok(/kept with the desk/.test(sub.text), 'and its words are all still there');
  const f = await page.$eval('.den-unsorted .den-filter', e => { const r = e.getBoundingClientRect(); return { h: r.height, out: Array.from(e.children).filter(b => { const x = b.getBoundingClientRect(); return x.right > r.right + 1 || x.left < r.left - 1; }).length }; });
  ok(f.h <= 68 && f.out === 0, 'the filter takes two rows at most and shows every kind: ' + JSON.stringify(f));
  await page.setViewportSize({ width: 1920, height: 1080 }); const f2 = await page.$eval('.den-unsorted .den-filter', e => e.getBoundingClientRect().height); ok(f2 <= 40, 'one row at 1920: ' + f2); await page.setViewportSize({ width: 1440, height: 900 });
  const u = await page.$('.den-undo:disabled'); if (u) eq(await cs(page, '.den-undo:disabled', 'display'), 'none', 'a disabled Undo is not drawn');
  const head = await page.evaluate(() => { const c = document.querySelector('.den-unsorted'), b = c.querySelector('.den-col-body'); let gap = 0; c.querySelectorAll('.den-gapline').forEach(g => { gap += g.getBoundingClientRect().height + 8; }); return b.getBoundingClientRect().top - c.getBoundingClientRect().top - gap; });
  ok(head <= 210, 'the header takes ' + Math.round(head) + 'px before the first card (321 before the diet)');
});

await t('V5 card actions are 28px ghosts, quiet until hover, never hidden, pressable without hovering', async () => {
  await page.mouse.move(2, 2); const c = cards(page, 'media').first();
  const st = await c.evaluate(e => { const a = e.querySelector('.den-card-act'), m = a.querySelector('.den-mini'), s = getComputedStyle(a), ms = getComputedStyle(m), l = a.querySelector('a.den-link');
    return { disp: s.display, vis: s.visibility, pe: s.pointerEvents, op: +s.opacity, bg: ms.backgroundColor, mh: m.getBoundingClientRect().height, link: l ? l.getBoundingClientRect().height : 28 }; });
  ok(st.disp !== 'none' && st.vis === 'visible' && st.pe !== 'none', 'the row is drawn and takes the pointer: ' + JSON.stringify(st));
  ok(st.op >= 0.6 && st.op <= 0.8, 'quiet at rest: ' + st.op); eq(st.bg, CLEAR, 'a ghost, not a boxed button'); ok(st.mh >= 28 && st.link >= 28, 'hit areas are 28px: ' + JSON.stringify(st));
  await c.hover(); await page.waitForTimeout(260); eq(+(await c.evaluate(e => getComputedStyle(e.querySelector('.den-card-act')).opacity)), 1, 'full on hover');
  await page.mouse.move(2, 2); await c.getByRole('button', { name: /^Must mention/ }).click({ trial: true, timeout: 3000 });
  const w3 = await c.evaluate(e => { e.classList.remove('w1', 'w2'); e.classList.add('w3'); const b = getComputedStyle(e.querySelector('.den-w')).backgroundColor; e.classList.remove('w3'); return b; });
  ok(w3 !== await rgb(page, '--dn-ink-0'), 'the top weight badge is no longer the loudest pixel on the Board');
});

await t('V6 an empty section column is 176px with its title on its own row, never clipped', async () => {
  const cols = await page.$$eval('.den-col.empty', cs => cs.map(c => { const h = c.querySelector('.den-col-h h3'), k = c.querySelector('.den-col-h .den-kbd'); return { w: Math.round(c.getBoundingClientRect().width), clip: h.scrollWidth > h.clientWidth + 1 || h.scrollHeight > h.clientHeight + 1, below: !k || h.getBoundingClientRect().top >= k.getBoundingClientRect().bottom - 1, t: h.textContent }; }));
  ok(cols.length >= 3, 'empty columns: ' + cols.length);
  eq(cols.filter(c => c.w !== 176).map(c => c.t + ' ' + c.w), [], 'widths'); eq(cols.filter(c => c.clip).map(c => c.t), [], 'clipped titles'); eq(cols.filter(c => !c.below).map(c => c.t), [], 'titles beside the key cap');
});

await t('V7 the contract C3 classes are styled: .den-ic, .den-board.dragging, .den-tab[data-attn], .den-guide, .den-sr, .den-loading.board', async () => {
  const ic = await page.evaluate(() => { const b = document.querySelector('.den-unsorted .den-card-act .den-mini'); b.insertAdjacentHTML('afterbegin', '<svg class="den-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>'); const s = b.querySelector('svg.den-ic'), c = getComputedStyle(s), r = s.getBoundingClientRect(); const o = { w: r.width, h: r.height, fill: c.fill, stroke: c.stroke, color: c.color, flex: c.flexShrink }; s.remove(); return o; });
  eq([ic.w, ic.h, ic.fill, ic.flex], [16, 16, 'none', '0'], 'an icon is 16px, line-drawn, never squeezed'); eq(ic.stroke, ic.color, 'and drawn in the text colour');
  await page.evaluate(() => document.querySelector('.den-board').classList.add('dragging')); await page.waitForTimeout(250);
  eq(await cs(page, '.den-board.dragging .den-col.empty .den-drop', 'border-top-color'), await rgb(page, '--dn-accent'), 'every drop zone lights while a card is dragged');
  await page.evaluate(() => document.querySelector('.den-board').classList.remove('dragging'));
  ok(await page.$('#den-tab-collection[data-attn]'), 'the fixture has a channel not delivering, so the tab carries data-attn'); eq(await page.textContent('#den-tab-collection'), 'Collection', 'the tab text is exactly Collection');
  const dot = await page.$eval('#den-tab-collection', e => { const s = getComputedStyle(e, '::after'); return { c: s.content, bg: s.backgroundColor, w: parseFloat(s.width), h: parseFloat(s.height) }; });
  ok(dot.c && dot.c !== 'none' && dot.w > 0 && dot.w <= 8 && dot.h <= 8, 'a small dot: ' + JSON.stringify(dot)); eq(dot.bg, await rgb(page, '--dn-ink-3'), 'neutral, not a warn colour');
  await tab(page, 'collection'); const sel = await page.$eval('#den-tab-collection', e => ({ dot: getComputedStyle(e, '::after').backgroundColor, line: getComputedStyle(e).backgroundImage }));
  eq(sel.dot, await rgb(page, '--dn-ink-3'), 'the dot stays while the tab is open'); ok(/gradient/.test(sel.line), 'and so does the selected underline: ' + sel.line);
  await tab(page, 'today'); await page.waitForSelector(CARD('media'));
  await page.evaluate(() => { window.DenTour = window.DenTour || { open() {} }; }); await page.getByRole('button', { name: 'Refresh' }).click(); await page.waitForSelector('.den-guide');
  eq(await cs(page, '.den-guide', 'color'), await rgb(page, '--dn-accent-text'), 'the Guide button reads as the way in');
  eq(await cs(page, '.den-head .den-sr', 'position'), 'absolute'); eq(await cs(page, '.den-head .den-sr', 'width'), '1px');
  const lb = await page.evaluate(() => { const d = document.createElement('div'); d.className = 'den-state den-loading board'; d.innerHTML = '<span class="den-loadtxt">Loading...</span>' + '<span class="den-skel"></span>'.repeat(3) + '<span class="den-skelcols">' + [0, 1, 2, 3, 4].map(i => '<span class="den-skelcol' + (i ? '' : ' wide') + '"><i></i><i></i><i></i></span>').join('') + '</span>'; document.getElementById('den-tabpanel').prepend(d); const s = getComputedStyle(d), k = d.querySelectorAll('.den-skelcol'); const o = { dir: s.flexDirection, first: k[0].getBoundingClientRect().width, next: k[1].getBoundingClientRect().width, h: k[1].getBoundingClientRect().height }; d.remove(); return o; });
  eq(lb.dir, 'row', 'the Board skeleton is columns'); ok(lb.first > lb.next && lb.next >= 150 && lb.h > 200, 'one wide ghost, then narrow ones: ' + JSON.stringify(lb));
});

await t('V8 field boundaries read at 3:1 (--dn-line-3); neutral facts are quiet tags, states stay filled', async () => {
  const l3 = await rgb(page, '--dn-line-3');
  for (const s of ['.den-unsorted .den-search input', '.den-desk select', '.den-daypick input']) eq(await cs(page, s, 'border-top-color'), l3, s);
  const empty = await page.$$eval('.den-col.empty .den-col-meta .den-chip', cs => cs.filter(c => c.textContent.trim() === 'Empty').map(c => ({ bg: getComputedStyle(c).backgroundColor, col: getComputedStyle(c).color })));
  // p72 (lane P2): with a brief, an empty section is a thing to check, so its column's state is the one count ("1 to check", filled); "Empty" stays a quiet tag where it is drawn
  const tocheck = await page.$$eval('.den-col.empty .den-col-meta .den-chip', cs => cs.filter(c => /^\d+ to check$/.test(c.textContent.trim())).map(c => getComputedStyle(c).backgroundColor));
  ok(empty.length || tocheck.length, 'an Empty chip, or an empty section counted'); if (empty.length) { eq(empty[0].bg, CLEAR, '"Empty" is a quiet tag'); eq(empty[0].col, await rgb(page, '--dn-ink-3')); } else ok(tocheck[0] !== CLEAR, 'the count is a filled state');
  const drafted = await page.$$eval('.den-col-meta .den-chip.acc', cs => cs.map(c => getComputedStyle(c).backgroundColor)); ok(drafted.length && drafted[0] !== CLEAR, 'a state chip stays filled');
});

await t('V9 motion: popover, dialog and menu enter; columns and cards never animate width or size; reduced motion stops it', async () => {
  const bad = /\b(width|height|flex|flex-basis|min-width|max-width|all|padding|margin|transform)\b/;
  for (const s of ['.den-col[data-sec]', '.den-unsorted', CARD('media')]) { const tr = await page.$eval(s, e => { const c = getComputedStyle(e), p = c.transitionProperty.split(','), d = c.transitionDuration.split(','); return p.map((x, i) => [x.trim(), parseFloat(d[i % d.length]) || 0]).filter(x => x[1] > 0).map(x => x[0]); }); ok(!tr.some(x => bad.test(x)), s + ' transitions ' + tr.join(', ')); }
  await page.locator('.den-strip li button.den-check:not([data-n="0"])').first().click(); await page.waitForSelector('.den-pop');
  eq(await cs(page, '.den-pop', 'animation-name'), 'den-in', 'the popover enters'); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keyboard shortcuts' }).click(); await page.waitForSelector('.den-dialog');
  eq([await cs(page, '.den-dialog', 'animation-name'), await cs(page, '.den-dialog > div', 'animation-name')], ['den-fade', 'den-in'], 'the dialog fades, its card rises'); await page.keyboard.press('Escape');
  ok(ruleHas('.den-menu-list', 'animation:den-in '), 'the Export menu enters'); ok(ruleHas('.den-drawer', 'animation:den-in-x '), 'the drawer slides in from the right');
  const rm = await open(w, 'full-key', { reducedMotion: true }); await rm.waitForSelector('.den-strip li button.den-check:not([data-n="0"])');
  await rm.locator('.den-strip li button.den-check:not([data-n="0"])').first().click(); await rm.waitForSelector('.den-pop'); eq(await cs(rm, '.den-pop', 'animation-name'), 'none', 'no entrance under reduced motion'); await rm.context().close();
});

await t('V10 the type and shape rules hold in the file: no raw 10/10.5px, no 650 weight, one caps tracking, no hex outside tokens', async () => {
  eq(CSS.match(/font[^;{}]*\b10(\.5)?px/g) || [], [], 'raw sizes'); eq(CSS.match(/\b650\b/g) || [], [], 'weight 650');
  eq((CSS.match(/letter-spacing:\.0[5-8]em/g) || []), [], 'trackings other than var(--dn-track-caps)');
  const decls = CSS.split(/[;{}]/).filter(d => /:/.test(d) && !/^\s*--/.test(d) && /#[0-9a-fA-F]{3,8}\b/.test(d)); eq(decls, [], 'hex outside a token');
});

await t('V11 states: a failed Board read is a 640px notice on a neutral ground with a red left rule, its Try again kept', async () => {
  const w2 = await world(); w2.hooks = [async (route, r, path) => { if (/^\/den\/board/.test(path)) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'db_busy', detail: 'The archive was busy.' }) }); return true; } return false; }];
  const p = await open(w2); await p.waitForSelector('#den-tabpanel .den-state.err', { timeout: 15000 });
  const e = await p.$eval('#den-tabpanel .den-state.err', x => { const s = getComputedStyle(x); return { w: x.getBoundingClientRect().width, bg: s.backgroundColor, bl: s.borderLeftWidth, blc: s.borderLeftColor, btn: !!x.querySelector('button') }; });
  ok(e.w <= 641, 'not a full-width slab: ' + e.w); eq(e.bg, await rgb(p, '--dn-s1'), 'a neutral ground'); eq(e.bl, '3px'); eq(e.blc, await rgb(p, '--dn-neg'), 'a red left rule'); ok(e.btn, 'Try again is there');
  await p.context().close();
});

await t('V14 no brief yet: the panel is centred at 640px, Draft is the widest control, and the cost sits under it', async () => {
  const w3 = await world(); const p = await open(w3); await tab(p, 'brief'); await p.waitForSelector('[data-tour="brief-empty"] button.primary');
  const g = await p.evaluate(() => { const panel = document.querySelector('[data-tour="brief-empty"]').closest('section.den-panel'), r = panel.getBoundingClientRect(), vw = document.getElementById('den-tabpanel').getBoundingClientRect(); const pr = document.querySelector('[data-tour="brief-empty"] button.primary').getBoundingClientRect(), hb = document.querySelector('[data-tour="by-hand"]').getBoundingClientRect(), sub = document.querySelector('[data-tour="brief-empty"] .den-sub').getBoundingClientRect();
    return { w: r.width, l: r.left - vw.left, rr: vw.right - r.right, top: r.top - vw.top, pw: pr.width, hw: hb.width, subBelow: sub.top >= pr.bottom - 1 }; });
  ok(g.w <= 641 && Math.abs(g.l - g.rr) <= 2 && g.top > 60, 'centred: ' + JSON.stringify(g)); ok(g.pw > g.hw && g.subBelow, 'Draft leads and the cost is under it: ' + JSON.stringify(g)); await p.context().close();
});
await t('V12 Options: the save bar is docked and lines up with the panels (should)', async () => {
  await tab(page, 'options'); await page.waitForSelector('.den-optbar');
  const a = await page.evaluate(() => { const b = document.querySelector('.den-optbar').getBoundingClientRect(), p = Array.from(document.querySelectorAll('#den-tabpanel section.den-panel')).map(x => x.getBoundingClientRect()).find(r => r.width > 0); return { bl: b.left, pl: p.left, br: b.right, pr: p.right }; });
  ok(Math.abs(a.bl - a.pl) <= 1 && Math.abs(a.br - a.pr) <= 1, 'aligned: ' + JSON.stringify(a)); eq(await cs(page, '.den-table th', 'font-size').catch(() => '11px'), '11px', 'table headings on the label size');
  await tab(page, 'today'); await page.waitForSelector(CARD('media'));
});

await t('V13 axe: no serious or critical violation on the Board with a pill open, while dragging, and with a card hovered, at 1366, 1440 and 1920', async () => {
  const AXE = fs.readFileSync(REPO + '/node_modules/axe-core/axe.min.js', 'utf8'); await page.addScriptTag({ content: AXE }); const bad = [];
  const run = async where => { await page.waitForTimeout(350); const v = await page.evaluate(async () => { const r = await window.axe.run(document.querySelector('#v-den'), { resultTypes: ['violations'] }); return r.violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => x.id + ' x' + x.nodes.length + ' at ' + x.nodes.slice(0, 6).map(n => n.target.join(' ').slice(-60) + (n.any[0] && n.any[0].data && n.any[0].data.contrastRatio ? ' [' + n.any[0].data.contrastRatio + ' ' + n.any[0].data.fgColor + ' on ' + n.any[0].data.bgColor + ']' : '')).join(' | ')); }); bad.push(...v.map(x => where + ': ' + x)); };
  for (const wd of [1366, 1440, 1920]) { await page.setViewportSize({ width: wd, height: 900 });
    await page.locator('.den-strip li button.den-check:not([data-n="0"])').first().click(); await page.waitForSelector('.den-pop'); await run('pop at ' + wd); await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('.den-board').classList.add('dragging')); await run('dragging at ' + wd); await page.evaluate(() => document.querySelector('.den-board').classList.remove('dragging'));
    await cards(page, 'media').first().hover(); await run('hover at ' + wd); await page.mouse.move(2, 2); }
  await page.setViewportSize({ width: 1440, height: 900 }); eq(bad, [], 'accessibility'); eq(page.errors, [], 'no page error');
});

await page.context().close();
await finish();
