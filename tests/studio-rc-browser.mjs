/* The release candidate's browser cases (CREATIVE-STUDIO.md s.54), in real Chromium against the worker module in this
 * process with every provider MOCKED. Each case fails on the base commit (062251f / d2ea1ba) and passes with its fix.
 *   R3/R4  the synthetic test client is listed under its own heading for every key; the test kit's seed parks projects
 *          whose Design tiles measure as passing and blocked when opened, with nothing to render or approve first
 *   R1     a worker older than the page is named in a banner
 *   U1-U3  the Design tool panel: one canvas bar row (48 px or less) from 1024 to 1920 with a selection and any panel open; the
 *          panel's title and close never covered; up to 1340 px it overlays the canvas, closes on Escape and gives the focus
 *          back; nothing under the canvas prints over anything else
 *   K2     "Produce N as variants" asks for the campaign when the kit has two and none is chosen; nothing is produced
 *   U10    a job the open tab steps in the background never disables the person's own actions; a click during it starts its job
 * Run: node --experimental-sqlite tests/studio-rc-browser.mjs   (RC_PORT picks the static server's port, default 8934) */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { makeStudio, runner, ok, eq } from './studio-fixture.mjs';
import { seedStages } from './studio-s18-seed.mjs';
import { openProject, goStep } from './studio-flow.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const R = '#studio-root ';
const fx = await makeStudio({ port: +(process.env.RC_PORT || 8934) });
const T = runner('RC: the release candidate in the browser');

/* the test kit talks HTTP; a bridge on 127.0.0.1 hands its requests to the same worker the page uses */
const bridge = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await fx.handler.fetch(new Request('https://newsaus.heshan-998.workers.dev' + req.url, { method: req.method, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': req.headers['x-axiom-key'] || '' }, body: chunks.length ? Buffer.concat(chunks) : undefined }), fx.env, { waitUntil() {} });
  res.writeHead(r.status, { 'Content-Type': 'application/json' }); res.end(Buffer.from(await r.arrayBuffer()));
});
await new Promise(r => bridge.listen(0, '127.0.0.1', r));
const seedKit = (...args) => new Promise(resolve => {
  const p = spawn('python3', [path.join(ROOT, 'tools', 'studio-test-kit.py'), ...args, '--worker', 'http://127.0.0.1:' + bridge.address().port, '--key', 'full-key'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { out += d; }); p.on('close', code => resolve({ code, out }));
});

async function pickClient(page, label) {
  const sel = R + 'select.st-client';
  await page.waitForFunction(([s, l]) => { const e = document.querySelector(s); return e && Array.from(e.options).some(o => o.textContent.indexOf(l) >= 0); }, [sel, label], { timeout: 15000 });
  const val = await page.$eval(sel, (e, l) => Array.from(e.options).find(o => o.textContent.indexOf(l) >= 0).value, label);
  await page.selectOption(sel, val);
}

await T.t('R3/R4: the synthetic client is listed for a read key and a full key; the seeded Design tiles measure pass and block', async () => {
  const seeded = await seedKit('seed', '--apply');
  eq(seeded.code, 0, 'the seed ran: ' + seeded.out.slice(-400));
  const calls0 = fx.calls.anthropic + fx.calls.gemini;
  // a read key sees the synthetic client under its own heading, labelled
  const rp = await fx.open({ role: 'read' });
  try {
    await rp.waitForFunction(r => { const g = document.querySelector(r + 'select.st-client optgroup'); return g && /Synthetic test clients/.test(g.label) && g.querySelector('option[value="synthdemo"]'); }, R, { timeout: 15000 });
    const label = await rp.$eval(R + 'select.st-client option[value="synthdemo"]', o => o.textContent);
    ok(/Harbourline/.test(label) && /synthetic/i.test(label), 'labelled: ' + label);
  } finally { await rp.ctxB.close(); }
  const page = await fx.open();
  try {
    await pickClient(page, 'Harbourline');
    await page.waitForSelector(R + '.st-lib tbody tr:has-text("parked at Design")', { timeout: 15000 });
    const rows = await page.$$eval(R + '.st-lib tbody tr', t => t.map(r => r.textContent));
    ok(rows.filter(r => /TEST - /.test(r)).length >= 7, 'the seeded projects are listed: ' + rows.length);
    await openProject(page, 'parked at Design');
    await goStep(page, 'Design');
    // both tiles are measured when opened (nothing to render first); one passes and one blocks
    const states = [];
    for (let i = 0; i < 2; i++) {
      const chips = page.locator(R + '.st-pagechip');
      await chips.nth(i).click();
      await page.waitForFunction(r => { const q = document.querySelector(r + '.st-qstate'); return q && /passed|blocked/.test(q.className); }, R, { timeout: 30000 });
      states.push(await page.$eval(R + '.st-qstate', q => q.className.replace('st-qstate', '').trim()));
    }
    ok(states.indexOf('passed') >= 0 && states.indexOf('blocked') >= 0, 'one passes and one blocks: ' + states.join(', '));
    eq(fx.calls.anthropic + fx.calls.gemini, calls0, 'no model or image call');
  } finally { await page.ctxB.close(); }
});

await T.t('R1: a worker answering an older build is named in a banner; the matching build shows none', async () => {
  const orig = fx.handler.fetch;
  fx.handler.fetch = async (req, env, ctx) => {
    const res = await orig.call(fx.handler, req, env, ctx);
    if (!/\/studio\/status(\?|$)/.test(new URL(req.url).pathname + new URL(req.url).search)) return res;
    const d = await res.json(); d.build = '2026-10-30.studio-p38';
    return new Response(JSON.stringify(d), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };
  const page = await fx.open();
  try {
    await page.waitForSelector(R + '.st-buildwarn', { timeout: 15000 });
    const t = await page.textContent(R + '.st-buildwarn');
    ok(/studio-p38/.test(t) && /studio-p47 or later/.test(t), t);
  } finally { await page.ctxB.close(); fx.handler.fetch = orig; }
  const fresh = await fx.open();
  try { await fresh.waitForSelector(R + '.st-lib', { timeout: 15000 }); await fresh.waitForTimeout(800); eq(await fresh.$$eval(R + '.st-buildwarn', e => e.length), 0, 'no banner against this worker'); }
  finally { await fresh.ctxB.close(); }
});

await T.t('U1-U3: the canvas bar stays one row with a selection and any panel open; the panel is never covered, closes on Escape and returns focus; nothing overprints', async () => {
  await seedStages(fx, { only: ['design'], prefix: 'RCU' });
  const bad = [];
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768], [1280, 800], [1181, 800], [1024, 768], [834, 1112], [390, 844]]) {
    const page = await fx.open({ viewport: { width: w, height: h }, quiet: true });
    try {
      await openProject(page, 'RCU at design'); await goStep(page, 'Design');
      await page.waitForSelector(R + '.st-canvasbar', { timeout: 20000 }); await page.waitForTimeout(800);
      const hl = page.locator(R + '.st-le-layer[aria-label="Layer headline"]'); if (await hl.count()) { await hl.first().click({ force: true }); await page.waitForTimeout(250); }
      const n = await page.locator(R + '.st-dock-btn:not([disabled])').count();
      for (let i = 0; i < n; i++) {
        const btn = page.locator(R + '.st-dock-btn:not([disabled])').nth(i); const label = ((await btn.getAttribute('aria-label')) || (await btn.textContent()) || '').trim().slice(0, 20);
        await btn.click(); await page.waitForTimeout(300);
        const m = await page.evaluate(r => { const bar = document.querySelector(r + '.st-canvasbar'); const lib = document.querySelector(r + '.st-library'); const out = { bar: bar ? Math.round(bar.getBoundingClientRect().height) : 0, lib: !!lib };
          if (lib) { const head = lib.querySelector('.st-library-head button'); if (head) { const hr = head.getBoundingClientRect(); const el = document.elementFromPoint(hr.x + hr.width / 2, hr.y + hr.height / 2); out.closeCovered = !(el && lib.contains(el)); } }
          return out; }, R);
        if (!m.lib) { bad.push(w + ': ' + label + ' opened no panel'); continue; }
        if (w >= 1024 && m.bar > 48) bad.push(w + ': ' + label + ' bar ' + m.bar + ' px');
        if (m.closeCovered) bad.push(w + ': ' + label + ' panel close covered');
        if (w <= 1340) {
          const inPanel = await page.evaluate(r => { const lib = document.querySelector(r + '.st-library'); return !!(lib && lib.contains(document.activeElement)); }, R);
          if (!inPanel) bad.push(w + ': ' + label + ' focus did not enter the panel');
          await page.keyboard.press('Escape'); await page.waitForTimeout(250);
          const after = await page.evaluate(r => ({ open: !!document.querySelector(r + '.st-library'), dock: !!(document.activeElement && document.activeElement.closest && document.activeElement.closest(r.trim() + ' .st-dock')) }), R);
          if (after.open) bad.push(w + ': ' + label + ' Escape left the panel open');
          else if (!after.dock) bad.push(w + ': ' + label + ' focus did not return to the dock');
        } else { await btn.click(); await page.waitForTimeout(200); }
      }
      const ov = await page.evaluate(r => { const sel = ['.st-qstate', '.st-ready', '.st-comp-info', '.st-canvas-sub']; const boxes = []; sel.forEach(q => document.querySelectorAll(r + q).forEach(e => { const b = e.getBoundingClientRect(); if (b.width && b.height) boxes.push({ q, b }); }));
        const hits = []; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i].b, c = boxes[j].b; if (boxes[i].q === boxes[j].q) continue; const x = Math.min(a.right, c.right) - Math.max(a.left, c.left), y = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top); const inside = (a.left <= c.left + 1 && a.right >= c.right - 1 && a.top <= c.top + 1 && a.bottom >= c.bottom - 1) || (c.left <= a.left + 1 && c.right >= a.right - 1 && c.top <= a.top + 1 && c.bottom >= a.bottom - 1); if (x > 4 && y > 4 && !inside) hits.push(boxes[i].q + ' over ' + boxes[j].q); } return hits; }, R);
      if (ov.length) bad.push(w + ': ' + ov.join(', '));
    } finally { await page.ctxB.close(); }
  }
  ok(!bad.length, bad.join(' | '));
});

await T.t('K2: with two campaigns in the kit and none chosen, "Produce 2 as variants" asks for the campaign and produces nothing', async () => {
  await fx.api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }, { id: 'national', name: 'Australian mining' }] });
  const P = (await fx.api('POST', '/studio/project', { ns: 'mca', campaign: '', title: 'K2 no campaign', brief: { channels: ['facebook', 'instagram'], deliverable: 'set', imageryTiming: 'after_copy' } })).id;
  const src = (await fx.api('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Client note', text: 'Fuel tax credits are back in the news after a Senate crossbencher called the credit a subsidy for miners. '.repeat(4) })).id;
  const j = (await fx.api('POST', '/studio/job', { project: P, stage: 'analyse', input: { sources: [src], kind: 'brief' }, idem: 'k2:analyse' })).job;
  for (let i = 0; i < 20; i++) { const r = (await fx.api('POST', '/studio/job/step', { id: j.id })).job; if (!r || /done|failed|cancelled/.test(r.state)) break; }
  const page = await fx.open();
  try {
    await openProject(page, 'K2 no campaign');
    await goStep(page, 'Brief');   // the reading's narratives sit in the Brief analysis panel
    await page.waitForSelector(R + '.st-an-narr', { timeout: 20000 });
    const boxes = page.locator(R + '.st-an-narr .st-check input'); await boxes.nth(0).check(); await boxes.nth(1).check();
    const before = fx.seen.filter(x => x.path === '/studio/job' && /"stage":"copy"/.test(x.body || '')).length;
    await page.click(R + '.st-compare button:has-text("Produce 2 as variants")');
    await page.waitForSelector(R + '.st-notice:has-text("Choose the campaign")', { timeout: 15000 });
    await page.waitForTimeout(600);
    const after = fx.seen.filter(x => x.path === '/studio/job' && /"stage":"copy"/.test(x.body || '')).length;
    eq(after, before, 'no copy job was asked for');
    eq((await fx.api('GET', '/studio/get?id=' + P)).assets.length, 0, 'nothing produced');
  } finally { await page.ctxB.close(); }
});

await T.t('U10: a job the open tab steps in the background (a render) never disables the person\'s own actions: "Explore variations" stays enabled while the render runs, and a click on it starts its job', async () => {
  // found by the release gate (studio-browser, about one run in three): each background step set the shared busy label, which
  // disabled every Art direction button for the length of the step, so a click landing then did nothing and said nothing
  const P = (await fx.api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'RC background', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'o', message: 'm' } })).id;
  const A = (await fx.api('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Background tile', mode: 'composition', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.', cta: 'Sign' } })).asset;
  fx.providers.slowMs = 6000; fx.setProvider('gemini', 'slow');
  const q = await fx.api('POST', '/studio/imagery', { asset: A.id, size: '1K' }); ok(q && !q.error, 'the imagery is queued: ' + JSON.stringify(q).slice(0, 200));
  const page = await fx.open({ viewport: { width: 1600, height: 1000 } });
  const jobsOf = async stage => ((await fx.api('GET', '/studio/get?id=' + P)).jobs || []).filter(j => j.stage === stage);
  try {
    await openProject(page, 'RC background');
    await page.waitForSelector(R + '.st-canvasbar', { timeout: 20000 });
    const dock = page.locator(R + '.st-dock-btn:has-text("Images")').first(); if ((await dock.getAttribute('aria-pressed')) !== 'true') await dock.click();
    await page.waitForSelector(R + '.st-ad-actions', { timeout: 15000 });
    let running = false; for (let i = 0; i < 60 && !running; i++) { running = (await jobsOf('render')).some(j => j.state === 'running'); if (!running) await new Promise(r => setTimeout(r, 150)); }
    ok(running, 'the tab is stepping the render');
    await new Promise(r => setTimeout(r, 400));
    const btn = page.locator(R + '.st-ad-actions button:has-text("Explore variations")');
    eq(await btn.isDisabled(), false, 'the person\'s action stays enabled while a background render is stepped');
    await btn.click({ timeout: 3000 });
    let made = 0; for (let i = 0; i < 40 && !made; i++) { made = (await jobsOf('concepts')).length; if (!made) await new Promise(r => setTimeout(r, 150)); }
    ok(made, 'the click started its own job while the render was still running');
  } finally { fx.setProvider('gemini', 'ok'); fx.providers.slowMs = 1500; await page.ctxB.close(); }
});

bridge.close(); await fx.close();
process.exit(T.done().fail ? 1 : 0);
