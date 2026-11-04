/* S32: the UI debt left open since p45 (CREATIVE-STUDIO.md s.58), in real Chromium against the worker module in this process,
 * every provider MOCKED. Each case fails on 5dccf1c and passes with its fix.
 *   PM6  a finished job is read once: the project the job's last step loaded is the one the page shows, not read again
 *        straight after (the page read /studio/get twice back to back after every job)
 *   U6   with nothing selected the canvas shows the artwork: no resize handle and no dotted ink box on any layer, and hovering
 *        the artboard outlines only the layer under the pointer; a selected layer has its handles
 *   U7   at 1366 x 768 every stage head (Brief, Message, Direction, Copy, Review, Deliver) is at most 180 px tall (it was
 *        210-306), with the four status answers still there; the note that a change would leave earlier work behind, shown
 *        only when there is such work, is one line on top (at most 32 px)
 * Run: node --experimental-sqlite tests/studio-s32-browser.mjs   (S32_PORT picks the static server's port, default 8888) */
import { makeStudio, runner, ok, eq, place } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const R = '#studio-root ';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fx = await makeStudio({ port: +(process.env.S32_PORT || 8888), inspect: false });
const T = runner('S32: one read per finished job, a quiet canvas, short stage heads');
await seedStages(fx, { prefix: 'S32', only: ['strategy', 'directions', 'copy', 'design'] });

await T.t('PM6: a finished job is read once (the project its last step loaded), and the page shows what the job made', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'S32 at design'); await sleep(800); await goStep(page, 'Design'); await sleep(2500);
    await place(page, 'art director'); await page.click(R + '.st-cd-tab:has-text("Review")'); await sleep(600);
    const btn = page.locator(R + 'button:visible', { hasText: /^Review v\d/ }).first(); eq(await btn.count(), 1, 'the review button is there');
    const n0 = fx.seen.length; await btn.click();
    await page.waitForFunction(() => /fidelity|hierarchy|readab|Verdict|verdict/i.test((document.querySelector('#studio-root .st-cd') || {}).textContent || ''), null, { timeout: 20000 });
    await sleep(3000);
    const seq = fx.seen.slice(n0).map(x => x.method + ' ' + x.path.split('?')[0]);
    const lastStep = seq.lastIndexOf('POST /studio/job/step'); ok(lastStep >= 0, 'the job was stepped: ' + seq.join(', '));
    const after = seq.slice(lastStep + 1).filter(s => s === 'GET /studio/get').length;
    eq(after, 1, 'one read of the project after the job ended (' + seq.join(', ') + ')');
  } finally { await page.context().close(); }
});

await T.t('U6: with nothing selected no layer shows a handle or a dotted box; hovering the artboard outlines only the layer under the pointer; a selected layer has its handles', async () => {
  const page = await fx.open({ viewport: { width: 1440, height: 900 } });
  try {
    await openProject(page, 'S32 at design'); await sleep(800); await goStep(page, 'Design'); await sleep(2500);
    await page.waitForSelector(R + '.st-le-layer');
    const state = () => page.evaluate(() => {
      const vis = el => { const c = getComputedStyle(el); const r = el.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity > 0 && r.width > 0; };
      const shown = el => { const c = getComputedStyle(el); return ['Top', 'Right', 'Bottom', 'Left'].some(s => parseFloat(c['border' + s + 'Width']) > 0 && !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(c['border' + s + 'Color']) && c['border' + s + 'Style'] !== 'none'); };
      const L = [...document.querySelectorAll('#studio-root .st-le-layer')];
      return { layers: L.length, sel: L.filter(l => l.classList.contains('sel')).map(l => l.dataset.id),
        handles: L.filter(l => !l.classList.contains('sel')).filter(l => [...l.querySelectorAll('.st-le-h, .st-le-hh')].some(vis)).map(l => l.dataset.id),
        boxes: [...document.querySelectorAll('#studio-root .st-le-box')].filter(vis).length,
        outlined: L.filter(l => !l.classList.contains('sel') && !l.matches(':hover') && shown(l)).map(l => l.dataset.id) };
    });
    let s = await state(); ok(s.layers >= 3, 'layers on the canvas: ' + s.layers); eq(s.sel, [], 'nothing selected');
    eq(s.handles, [], 'no unselected layer shows a resize handle'); eq(s.boxes, 0, 'no dotted ink box');
    // the pointer over the artboard, on a layer: only that one is outlined
    const hb = await (await page.$(R + '.st-le-layer[aria-label="Layer headline"]')).boundingBox();
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await sleep(250);
    s = await state(); eq(s.outlined, [], 'hovering one layer outlines that layer only');
    await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await sleep(250);
    const selHandles = await page.$$eval(R + '.st-le-layer.sel .st-le-h, ' + R + '.st-le-layer.sel .st-le-hh', els => els.length);
    eq(selHandles, 8, 'the selected layer has its eight handles');
  } finally { await page.context().close(); }
});

await T.t('U7: at 1366 x 768 every stage head is at most 180 px tall, with its four answers kept', async () => {
  const page = await fx.open({ viewport: { width: 1366, height: 768 } });
  try {
    await openProject(page, 'S32 at design'); await sleep(800);
    const heights = {};
    for (const st of ['Brief', 'Plan', 'Direction', 'Copy', 'Review', 'Deliver']) {
      await page.click(R + '.st-step:has(.st-step-l:text-is("' + st + '"))'); await sleep(900);
      heights[st] = await page.evaluate(() => { const h = document.querySelector('#studio-root .st-stagehead'); if (!h) return null; const n = h.querySelector('.st-downstream'); const nh = n ? n.getBoundingClientRect().height : 0;
        return { head: Math.round(h.getBoundingClientRect().height - (n ? nh + 5 : 0)), note: Math.round(nh) }; });
    }
    const tall = Object.entries(heights).filter(([, h]) => h == null || h.head > 180 || h.note > 32);
    eq(tall, [], 'stage head heights ' + JSON.stringify(heights));
    await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))'); await sleep(900);
    const five = await page.$$eval(R + '.st-stagehead .st-five > div', d => d.map(x => x.querySelector('dt').textContent.trim()));
    eq(five, ['Missing', 'Accepted', 'Main action', 'Next'], 'the four answers are still in the head');
    const full = await page.$eval(R + '.st-stagehead .st-five-act dd', d => (d.getAttribute('title') || '') + ' | ' + d.textContent);
    ok(/one model call/i.test(full), 'the main action keeps its full words (in the cell and its title): ' + full.slice(0, 160));
  } finally { await page.context().close(); }
});

const r = T.done(); await fx.close(); process.exit(r.fail ? 1 : 0);
