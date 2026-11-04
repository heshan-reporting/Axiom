/* S29: the fresh audit's interface findings (CREATIVE-STUDIO.md s.55), in real Chromium against the worker module in this
 * process with every provider MOCKED. Each case fails on main at efa309e and passes with its fix.
 *   FS1  a read key is told its role by the worker (GET /auth/me, /studio/status), with nothing injected by the harness: no
 *        write controls, and opening a composition files no measurement
 *   SEC-1 the page's request helper refuses an address that is not the worker's own path
 *   UX3  the header names the read-only state at every width (the chips come first; the names give way with an ellipsis)
 *   UX8  a locked step tells a read key that a teammate completes it, never to do it
 *   UX6  the library names each guided project's stage as the header does (Message, Direction, Copy), not the old status words
 *   UX4  "Compared with what Axiom knows" is a plain disclosure, not squeezed into the version-compare grid
 *   UX11 the context panel's progress list has the seven stages, Deliver included
 *   UX1  in the light appearance the colour picker, the Spacing box and the dock icons read (4.5:1 text, 3:1 icons)
 *   UX2  the floating selection toolbar shows every button inside itself and inside the stage, at 1024, 1280 and 1366
 *   UX5  art direction stays inside its card in the Images panel
 *   UX10 the format buttons draw a square for 1:1 and an upright rectangle for 4:5
 *   UX7  the client review page does not scroll sideways on a phone when the copy holds a long address
 * Run: node --experimental-sqlite tests/studio-s29-browser.mjs   (S29_PORT picks the static server's port, default 8885) */
import { makeStudio, runner, ok, eq, W } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.S29_PORT || 8885), inspect: false });
const T = runner('S29: the fresh audit in the browser (roles, header, library, light appearance, toolbar, panels, review page)');
await seedStages(fx, { prefix: 'S29', only: ['objectives', 'strategy', 'directions', 'copy', 'design'] });

const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
async function toDesign(page) {
  await openProject(page, 'S29 at design'); await sleep(700);
  await page.locator(R + '.st-step:has(.st-step-l:text-is("Create"))').first().click();
  await page.waitForSelector(R + '.st-canvasbar', { timeout: 20000 }); await sleep(1200);
}
async function selectHeadline(page) { await page.locator(R + '.st-le-layer[aria-label="Layer headline"]').first().click({ force: true }); await page.waitForSelector(R + '.st-fbar', { timeout: 10000 }); await sleep(400); }

await T.t('FS1 + SEC-1 + UX3 + UX8: a read key learns its role from the worker, sees the read-only chip in the header, files nothing, and a locked step does not tell it to act', async () => {
  const before = fx.seen.length;
  const page = await fx.open({ role: 'read', quiet: true, viewport: { width: 1280, height: 800 } });
  try {
    await page.waitForFunction(() => window.AX_ROLE === 'read', null, { timeout: 15000 });
    await toDesign(page);
    const own = await page.evaluate(() => { const r = {}; for (const u of ['https://attacker.example/x', '//attacker.example/x', '/\\attacker.example/x', 'studio/file']) { try { window.AXUI.own(u); r[u] = 'allowed'; } catch (e) { r[u] = e.code || 'refused'; } } try { r.ownPath = window.AXUI.own('/studio/file?key=a'); } catch (e) { r.ownPath = 'refused'; } return r; });
    ok(Object.keys(own).filter(k => k !== 'ownPath').every(k => own[k] !== 'allowed'), 'outside addresses refused: ' + JSON.stringify(own));
    ok(/\/studio\/file\?key=a$/.test(own.ownPath), 'the worker path is allowed: ' + own.ownPath);
    for (const w of [1280, 1920]) {
      await page.setViewportSize({ width: w, height: 900 }); await sleep(400);
      const chip = await page.evaluate(() => { const sub = document.querySelector('#studio-root .st-psub'); const c = Array.from(sub ? sub.querySelectorAll('.st-chip') : []).find(x => /read-only/.test(x.textContent)); if (!c) return null; const r = c.getBoundingClientRect(), s = sub.getBoundingClientRect(); return { inside: r.left >= s.left - 1 && r.right <= s.right + 1 && r.right <= innerWidth, w: r.width }; });
      ok(chip && chip.inside && chip.w > 20, 'the read-only chip is shown in the header at ' + w + ': ' + JSON.stringify(chip));
    }
    await page.locator(R + '.st-step:has(.st-step-l:text-is("Review"))').first().click(); await sleep(900);
    const lock = await page.evaluate(() => { const l = document.querySelector('#studio-root .st-locked'); return l ? l.textContent : null; });
    if (lock) { ok(/read-only/.test(lock) && !/Go to /.test(lock), 'a locked step tells a read key who completes it: ' + lock); }
    const writes = fx.seen.slice(before).filter(x => x.method !== 'GET' && /^\/studio\//.test(x.path));
    eq(writes.map(x => x.path), [], 'a read key files nothing on opening a composition');
  } finally { await page.ctxB.close(); }
});

await T.t('UX6 + UX4 + UX11: the library names the stages as the header does; the comparison is a plain disclosure; the context panel lists seven stages', async () => {
  const page = await fx.open({ quiet: true, viewport: { width: 1280, height: 800 } });
  try {
    await page.waitForSelector(R + '.st-lib tbody tr:has-text("S29 at strategy")', { timeout: 20000 });
    const stage = t => page.evaluate(t => { const tr = Array.from(document.querySelectorAll('#studio-root .st-lib tbody tr')).find(x => x.textContent.indexOf(t) >= 0); const s = tr && tr.querySelector('.st-status'); return s ? s.textContent.trim() : null; }, t);
    eq(await stage('S29 at objectives'), 'Plan'); eq(await stage('S29 at strategy'), 'Plan'); eq(await stage('S29 at directions'), 'Direction'); eq(await stage('S29 at copy'), 'Copy');
    await openProject(page, 'S29 at objectives'); await sleep(900);
    await page.locator(R + '.st-step:has(.st-step-l:text-is("Brief"))').first().click(); await sleep(900);
    const d = await page.$(R + 'details.st-cmp');
    ok(d, 'the comparison is on the Brief');
    const cmp = await page.evaluate(() => { const d = document.querySelector('#studio-root details.st-cmp'); const s = d.querySelector('summary'); return { display: getComputedStyle(d).display, h: s.getBoundingClientRect().height }; });
    ok(cmp.display !== 'grid' && cmp.h <= 40, 'a plain disclosure with a one-line summary: ' + JSON.stringify(cmp));
    const steps = await page.$$eval(R + '.st-ctx-steps > li', l => l.map(x => x.querySelector('span').textContent));
    if (steps.length) eq(steps, ['Brief', 'Plan', 'Direction', 'Copy', 'Create', 'Review', 'Deliver']);
  } finally { await page.ctxB.close(); }
});

await T.t('UX1: in the light appearance the colour picker, the Spacing box and the dock icons read', async () => {
  const page = await fx.open({ quiet: true, viewport: { width: 1440, height: 900 }, store: { ax_studio_theme: 'light' } });
  try {
    await toDesign(page); await selectHeadline(page);
    const dock = await page.evaluate(() => Array.from(document.querySelectorAll('#studio-root .st-dock-btn:not(.add):not(:disabled)')).filter(b => b.getAttribute('aria-pressed') !== 'true').map(b => { let e = b, bg; while (e && (bg = getComputedStyle(e).backgroundColor) === 'rgba(0, 0, 0, 0)') e = e.parentElement; return { l: b.textContent.trim(), fg: getComputedStyle(b).color, bg }; }));
    ok(dock.length, 'dock buttons found');
    dock.forEach(x => ok(ratio(x.fg, x.bg) >= 3, 'dock icon ' + x.l + ' reads at 3:1: ' + ratio(x.fg, x.bg).toFixed(2)));
    const core = await page.evaluate(() => { const s = document.querySelector('#studio-root .st-sty-core span'); const c = document.querySelector('#studio-root .st-sty-core'); return s && { fg: getComputedStyle(s).color, bg: getComputedStyle(c).backgroundColor }; });
    if (core) ok(ratio(core.fg, core.bg) >= 4.5, 'the Spacing size reads: ' + ratio(core.fg, core.bg).toFixed(2));
    const cf = page.locator(R + '.st-sty-colour').first(); await cf.scrollIntoViewIfNeeded(); await cf.click(); await page.waitForSelector(R + '.st-pk', { timeout: 8000 }); await sleep(300);
    const texts = await page.evaluate(() => { const out = []; document.querySelectorAll('#studio-root .st-pk *').forEach(e => { if (!Array.from(e.childNodes).some(n => n.nodeType === 3 && n.textContent.trim())) return; let b = e, bg; while (b && (bg = getComputedStyle(b).backgroundColor) === 'rgba(0, 0, 0, 0)') b = b.parentElement; out.push({ t: e.textContent.trim().slice(0, 24), fg: getComputedStyle(e).color, bg }); }); document.querySelectorAll('#studio-root .st-pk input').forEach(e => out.push({ t: 'input ' + (e.getAttribute('aria-label') || ''), fg: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor })); return out; });
    ok(texts.length > 4, 'picker text found');
    const bad = texts.filter(x => !/^\s*$/.test(x.t) && x.bg !== 'rgba(0, 0, 0, 0)' && ratio(x.fg, x.bg) < 4.5 && !/^(AAA?|AA large|fails)$/i.test(x.t));
    eq(bad.map(x => x.t + ' ' + ratio(x.fg, x.bg).toFixed(2)), [], 'every picker text reads at 4.5:1');
  } finally { await page.ctxB.close(); }
});

await T.t('UX2 + UX10: the selection toolbar keeps every button inside itself and the stage; the format buttons have the right shapes', async () => {
  for (const [w, h] of [[1024, 768], [1280, 800], [1366, 768]]) {
    const page = await fx.open({ quiet: true, viewport: { width: w, height: h } });
    try {
      await toDesign(page); await selectHeadline(page);
      const m = await page.evaluate(() => { const fb = document.querySelector('#studio-root .st-fbar'); const par = fb.offsetParent; const fr = fb.getBoundingClientRect(), pr = par.getBoundingClientRect(); const cut = Array.from(fb.querySelectorAll('button')).filter(b => { const r = b.getBoundingClientRect(); return r.right > fr.right + 1 || r.left < fr.left - 1 || r.right > pr.right + 1 || r.bottom > fr.bottom + 1; }).map(b => b.getAttribute('aria-label') || b.textContent.trim()); return { cut, sw: fb.scrollWidth, cw: fb.clientWidth }; });
      eq(m.cut, [], 'no button cut off at ' + w + ' (' + m.cw + '/' + m.sw + ')');
      if (w === 1280) {
        const shapes = await page.$$eval(R + '.st-fmt', bs => bs.map(b => { const p = b.querySelector('path'); const r = p && p.getBBox(); return { t: b.getAttribute('title') || '', w: r && Math.round(r.width), h: r && Math.round(r.height) }; }));
        shapes.forEach(s => { if (/\(1:1\)/.test(s.t)) ok(Math.abs(s.w - s.h) <= 1, '1:1 is square: ' + JSON.stringify(s)); if (/\(4:5\)/.test(s.t)) ok(s.h > s.w && s.w / s.h > 0.7 && s.w / s.h < 0.85, '4:5 is upright: ' + JSON.stringify(s)); });
      }
    } finally { await page.ctxB.close(); }
  }
});

await T.t('UX5: art direction stays inside its card in the Images panel', async () => {
  const page = await fx.open({ quiet: true, viewport: { width: 1440, height: 900 } });
  try {
    await toDesign(page);
    const b = page.locator(R + '.st-dock-btn:has-text("Images")').first(); if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click();
    await page.waitForSelector(R + '.st-ad-ask', { timeout: 10000 }); await sleep(300);
    const out = await page.evaluate(() => { const card = document.querySelector('#studio-root .st-ad'); const cr = card.getBoundingClientRect(); const bad = []; document.querySelectorAll('#studio-root .st-ad-ask input, #studio-root .st-ad-ask button, #studio-root .st-ad-ask .st-size').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && (r.right > cr.right + 1 || r.left < cr.left - 1)) bad.push((e.textContent || e.getAttribute('placeholder') || e.tagName).trim().slice(0, 30) + ' ' + Math.round(r.right - cr.right)); }); const note = document.querySelector('#studio-root .st-ad-ask .st-size > .ov-dim'); return { bad, noteH: note ? note.getBoundingClientRect().height : 0 }; });
    eq(out.bad, [], 'nothing runs past the card');
    ok(out.noteH < 90, 'the resolution note is not a one-word column: ' + out.noteH);
  } finally { await page.ctxB.close(); }
});

await T.t('UX7: the client review page does not scroll sideways on a phone with a long address in the copy', async () => {
  const P = (await fx.api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S29 review', test: true, brief: { channels: ['linkedin'], deliverable: 'copy', campaignConfirmed: true } })).id;
  const A = (await fx.api('POST', '/studio/asset', { project: P, family: 'Copy', channel: 'linkedin', format: '1:1', title: 'Post', mode: 'copy', copy: { headline: 'A tax for roads it never used', caption: 'Read it here https://example.org/a/very/long/link/that/does/not/break/anywhere/at/all/because/it/is/one/word' } })).asset;
  const sh = await fx.api('POST', '/studio/share', { project: P, assets: [A.id], label: 'S29', expiresDays: 7 });
  ok(sh.token, 'a link: ' + JSON.stringify(sh).slice(0, 120));
  const page = await fx.open({ quiet: true, go: false, viewport: { width: 390, height: 844 } });
  try {
    await page.goto('http://127.0.0.1:' + fx.PORT + '/review.html#t=' + sh.token + '&w=' + encodeURIComponent(W), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => /A tax for roads/.test(document.body.textContent), null, { timeout: 15000 });
    const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
    ok(m.sw <= m.iw, 'no sideways scroll: ' + JSON.stringify(m));
  } finally { await page.ctxB.close(); }
});

await T.t('QA-3: Fix layout brings words dragged half off the stage back inside it', async () => {
  const l = await fx.api('GET', '/studio/list?ns=mca'); const pr = l.projects.find(p => p.title === 'S29 at design');
  const g = await fx.api('GET', '/studio/get?id=' + pr.id); const a = g.assets.find(x => (x.versions.find(v => v.id === x.current).layout || {}).layers);
  const v = a.versions.find(x => x.id === a.current);
  const page = await fx.open({ quiet: true, go: false });
  try {
    const out = await page.evaluate(async ([layout, copy, format]) => {
      const L = JSON.parse(JSON.stringify(layout)); const h = L.layers.find(x => x.role === 'headline'); h.x = 70; h.w = 60; delete h.locked;
      await window.STRender.ensureFonts(L).catch(() => {});
      const before = window.STRender.validate(L, copy, {}, { width: 540, format });
      const r = window.STRender.repair(L, copy, {}, { width: 540, format });
      const off = rr => rr.issues.filter(i => (i.code === 'off_canvas' || i.code === 'safe_area') && i.layers.indexOf(h.id) >= 0).map(i => i.code);
      return { before: off(before), after: off(r.after), steps: r.steps, words: r.layout.layers.find(x => x.id === h.id).text || null, wordsBefore: h.text || null };
    }, [v.layout, v.copy, a.format]);
    ok(out.before.length, 'the headline starts off the stage: ' + JSON.stringify(out.before));
    eq(out.after, [], 'after Fix layout it is inside: ' + JSON.stringify(out.steps));
    eq(out.words, out.wordsBefore, 'the words are not changed');
  } finally { await page.ctxB.close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
