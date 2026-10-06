/* End-to-end verification of the S-series (S10), in real Chromium against the worker module in this process; providers
 * MOCKED (the "photograph" is a synthetic gradient; nothing is spent). One HOOF project goes through production, the
 * taught placement rule, the six actions, the context manifest, the inventory, the highlighting and the Art Director
 * panel; the composed tile is then read back from its pixels: with an OCR engine on the machine (tesseract.js and its
 * English data; OCR_DIR names the folder holding node_modules, default the session scratchpad) the recognised words are
 * compared with the approved copy per role, and without one an ink check (non-ground pixels inside every text box and
 * the mark box) stands in and is named as such - never called OCR. Screenshots of every stage go to tests/shots/s10-*.png
 * (ignored by git) and a report to tests/shots/s10-report.json; the figures are printed.
 * Run: node --experimental-sqlite tests/studio-s10-browser.mjs      (OCR_DIR=/path/with/node_modules for the OCR pass) */
import fs from 'node:fs'; import path from 'node:path';
import { makeStudio, runner, eq, ok, PHOTO } from './studio-fixture.mjs';
import { openTool } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8800 });
const { api, env } = fx;
const R = '#studio-root ';
const T = runner('studio-s10-browser (end-to-end verification of S2-S9 with a pixel read-back of the composed tile; providers MOCKED)');
const OUT = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const report = { at: new Date().toISOString(), ocr: null, steps: [], gaps: [] };
const note = (step, data) => { report.steps.push(Object.assign({ step }, data)); };
const step = async id => { let j; for (let i = 0; i < 8; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || j.state === 'done' || j.state === 'failed') return j; } return j; };
const itab = (pg, name) => pg.click(R + '.st-instab:has-text("' + name + '")');
const shot = (pg, name) => pg.screenshot({ path: OUT + 's10-' + name + '.png' });
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length >= 3);

// OCR, when the machine has it: tesseract.js with local English data (no network: the CDN is not reachable from the sandbox)
const OCR_DIR = process.env.OCR_DIR || path.join(process.env.CLAUDE_SCRATCHPAD || '/tmp/claude-0/-home-user-Axiom/d3422829-9acc-532d-a868-050365fd061c/scratchpad', 'ocr');
let ocrWorker = null;
async function ocrBox(pngBase64) {
  const idx = path.join(OCR_DIR, 'node_modules/tesseract.js/src/index.js'); const lang = path.join(OCR_DIR, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int');
  if (!ocrWorker) { const { createWorker } = await import(idx); ocrWorker = await createWorker('eng', 1, { langPath: lang, gzip: true, cachePath: OCR_DIR, logger: () => {} }); await ocrWorker.setParameters({ tessedit_pageseg_mode: '6' }); }
  const r = await ocrWorker.recognize(Buffer.from(pngBase64, 'base64')); return { text: r.data.text || '', confidence: Math.round(r.data.confidence || 0) };
}
async function ocrOf(pngBase64) {
  const idx = path.join(OCR_DIR, 'node_modules/tesseract.js/src/index.js'); const lang = path.join(OCR_DIR, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int');
  if (!fs.existsSync(idx) || !fs.existsSync(path.join(lang, 'eng.traineddata.gz'))) return { available: false, why: 'no OCR engine at ' + OCR_DIR + ' (install tesseract.js and @tesseract.js-data/eng there, or set OCR_DIR)' };
  try {
    const { createWorker } = await import(idx);
    const w = await createWorker('eng', 1, { langPath: lang, gzip: true, cachePath: OCR_DIR, logger: () => {} });
    const r = await w.recognize(Buffer.from(pngBase64, 'base64')); await w.terminate();
    return { available: true, engine: 'tesseract.js (local English data)', text: r.data.text, confidence: Math.round(r.data.confidence) };
  } catch (e) { return { available: false, why: 'OCR failed: ' + String(e && e.message || e).slice(0, 160) }; }
}

// the kit: HOOF carries its own wordmark (policy wordmark); an approved reference puts it bottom left
await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkB64: PHOTO, wordmarkMime: 'image/png' });
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S10 verification', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', audience: 'regional voters', channels: ['instagram'], deliverable: 'set', campaignConfirmed: true } })).id;
const RF = await api('POST', '/studio/reference', { project: P, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PHOTO, mime: 'image/png', campaign: 'hoof' });
env.MIND_DB.db.prepare('UPDATE studio_references SET analysis=? WHERE id=?').run(JSON.stringify({ summary: 'A teal tile, the wordmark bottom left.', logo: 'wordmark bottom left', mark: { present: true, kind: 'wordmark', corner: 'bl' }, text: [], takeaways: [], at: 1 }), RF.id);
let page, A, V;

await T.t('S6 + S7: the placement is taught from the evidence, then production carries the rule on the mark layer and records what informed it', async () => {
  const pv = await api('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile' } }); eq(pv.written, false, 'a preview writes nothing');
  const tw = await api('POST', '/brand/teach', { ns: 'mca', campaign: 'hoof', kind: 'placement', proposal: { corner: 'bl', mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile' }, confirm: true, reason: 'the approved tiles, confirmed for the verification' }); eq(tw.written, true, JSON.stringify(tw));
  const j = await step((await api('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'set', render: true, acknowledge: true }, idem: 's10-copy' })).job.id); eq(j.state, 'done', j.error);
  let g = await api('GET', '/studio/get?id=' + P); for (const rj of g.jobs.filter(x => x.stage === 'render' && x.state === 'queued')) await step(rj.id);
  for (const ij of (await api('GET', '/studio/get?id=' + P)).jobs.filter(x => x.stage === 'inspect' && x.state === 'queued')) await step(ij.id);
  g = await api('GET', '/studio/get?id=' + P); const a = g.assets[0]; A = a.id; V = a.versions.find(x => x.id === a.current);
  ok(V.image && V.image.key, 'the imagery landed (mocked)'); const wm = (V.layout.layers || []).find(l => l.role === 'wordmark'); ok(wm, 'a wordmark layer');
  eq(wm.rule, { mandatory: true, note: 'the wordmark sits bottom left on every HOOF tile', basis: 'rule', corner: 'bl' }, 'the rule on the layer, with its provenance'); ok(!(V.layout.layers || []).some(l => l.role === 'logo'), 'never the MCA logo on HOOF');
  const m = V.context.informed; ok(m && m.stage === 'copy' && m.placement && m.placement.basis === 'rule' && m.kit.policy === 'wordmark', 'the manifest records the rule and the policy: ' + JSON.stringify(m && m.placement));
  const used = await api('GET', '/studio/used?asset=' + A, null, 'read-key'); ok(used.informed && used.informed.stage === 'copy' && used.marks.some(x => x.role === 'wordmark'), JSON.stringify(used.marks));
  const inv = await api('GET', '/brand/inventory?ns=mca&campaign=hoof', null, 'read-key'); ok(inv.ok && inv.placement.basis === 'rule' && !inv.recommendations.some(r => r.code === 'teach_placement'), 'the inventory sees the rule');
  const acts = await api('GET', '/studio/actions?asset=' + A, null, 'read-key'); eq(acts.actions.filter(x => ['refine', 'explore', 'layouts', 'new', 'imagery', 'area'].indexOf(x.id) >= 0).length, 6); ok(acts.actions.every(x => x.cost && x.cost.text), 'every action costed');
  note('production', { asset: A, version: V.id, markRule: wm.rule, informedStage: m.stage, actions: acts.actions.map(x => [x.id, x.available, x.cost.text]), inventoryUsable: inv.counts.usable, notRetrieved: inv.counts.notRetrieved });
});
await T.t('the composed tile is drawn, measured and read back from its pixels: the approved words are found (OCR when available, else an ink check named as such), the mark sits where the rule holds it', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("S10 verification")'); await shot(page, 'library');
  await page.click(R + '.st-lib tbody tr:has-text("S10 verification") .ov-link'); await page.waitForSelector(R + '.st-railbtn.asset');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Brief"))'); await page.waitForSelector(R + '#brief-objective'); await shot(page, 'brief');
  // the brief is an early step with no assets rail since S17: the composition is reached through Design
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await page.waitForSelector(R + '.st-railbtn.asset'); await page.click(R + '.st-railbtn.asset'); await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => { const c = document.querySelector('#studio-root .st-stage canvas'); return c && c.width > 300; });
  await page.waitForTimeout(1500);
  const comp = await page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas'); return { png: c.toDataURL('image/png').split(',')[1], w: c.width, h: c.height }; });
  // the measurement the page files, and the layout as drawn
  const val = await page.evaluate(() => { const el = document.querySelector('#studio-root .st-readystrip'); return el ? el.textContent.replace(/\s+/g, ' ') : ''; });
  // ink per box: the share of pixels inside each text layer's box and the mark's box that differ from their surroundings
  const layout = V.layout; const text = (layout.layers || []).filter(l => l.type === 'text' && !l.hidden); const mark = (layout.layers || []).find(l => l.role === 'wordmark');
  // ink per box: the mean luminance difference between each box and the strip of ground just above it (type and marks are
  // drawn over the imagery; a box with nothing drawn in it looks like its neighbourhood)
  const inkOf = await page.evaluate(({ boxes }) => { const c = document.querySelector('#studio-root .st-stage canvas'); const ctx = c.getContext('2d'); const out = {};
    const lum = (x, y, w, h) => { const d = ctx.getImageData(x, y, w, h).data; let s = 0, n = 0, bright = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += l; n++; if (l > 200) bright++; } return { mean: s / n, bright: bright / n, n }; };
    for (const b of boxes) { const x = Math.max(0, Math.round(b.x / 100 * c.width)), y = Math.max(0, Math.round(b.y / 100 * c.height)), w = Math.max(1, Math.min(Math.round(b.w / 100 * c.width), c.width - x)), h = Math.max(1, Math.min(Math.round(b.h / 100 * c.height), c.height - y));
      const inside = lum(x, y, w, h); const ay = Math.max(0, y - h); const above = ay < y ? lum(x, ay, w, y - ay) : inside;
      // the spread of luminance inside the box: flat ground is low, type or a mark over it is high
      const d = ctx.getImageData(x, y, w, h).data; let sq = 0; for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; sq += (l - inside.mean) * (l - inside.mean); } const sd = Math.sqrt(sq / inside.n);
      out[b.id] = { bright: Math.round(inside.bright * 1000) / 10, diffAbove: Math.round(Math.abs(inside.mean - above.mean) * 10) / 10, spread: Math.round(sd * 10) / 10, px: inside.n }; }
    return out; }, { boxes: text.concat(mark ? [mark] : []).map(l => ({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h })) });
  // OCR per text box: the box is cropped from the drawn tile, scaled three times and binarised (light type on the imagery becomes
  // black on white), then read as one block (PSM 6); whole-tile OCR of small type on a photograph reads almost nothing
  const crops = await page.evaluate(({ boxes }) => { const c = document.querySelector('#studio-root .st-stage canvas'); const out = {};
    for (const b of boxes) { const x = Math.max(0, Math.round(b.x / 100 * c.width)), y = Math.max(0, Math.round(b.y / 100 * c.height)), w = Math.max(1, Math.min(Math.round(b.w / 100 * c.width), c.width - x)), h = Math.max(1, Math.min(Math.round(b.h / 100 * c.height), c.height - y));
      const o = document.createElement('canvas'); o.width = w * 3; o.height = h * 3; const g = o.getContext('2d'); g.imageSmoothingEnabled = true; g.drawImage(c, x, y, w, h, 0, 0, o.width, o.height);
      const d = g.getImageData(0, 0, o.width, o.height); const px = d.data; for (let i = 0; i < px.length; i += 4) { const l = 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]; const v = l > 170 ? 0 : 255; px[i] = px[i + 1] = px[i + 2] = v; px[i + 3] = 255; } g.putImageData(d, 0, 0);
      out[b.id] = o.toDataURL('image/png').split(',')[1]; } return out; }, { boxes: text.map(l => ({ id: l.id, x: l.x, y: l.y, w: l.w, h: l.h })) });
  const ocrAvail = await ocrOf(comp.png); report.ocr = { available: ocrAvail.available, engine: ocrAvail.engine, why: ocrAvail.why, wholeTile: ocrAvail.text ? ocrAvail.text.replace(/\s+/g, ' ').slice(0, 200) : '' };
  const found = {}; const read = {};
  if (ocrAvail.available) { for (const l of text) { const r = await ocrBox(crops[l.id]); read[l.role || l.id] = r.text; const want = words(V.copy[l.role] || l.text); const seen = new Set(words(r.text)); found[l.role || l.id] = { want: want.length, found: want.filter(w => seen.has(w)).length, confidence: r.confidence }; } }
  note('readback', { canvas: [comp.w, comp.h], readiness: val, ink: inkOf, ocr: ocrAvail.available ? { engine: ocrAvail.engine, perBox: found, read } : { available: false, why: ocrAvail.why }, markBox: mark ? { x: mark.x, y: mark.y, w: mark.w, h: mark.h } : null });
  await shot(page, 'refine');
  ok(mark && mark.x < 20 && mark.y > 60, 'the mark is drawn bottom left where the rule holds it: ' + JSON.stringify(mark && { x: mark.x, y: mark.y }));
  const hl = text.find(l => l.role === 'headline'); ok(hl && inkOf[hl.id] && inkOf[hl.id].spread > 12, 'the headline box carries ink on the drawn tile (luminance spread): ' + JSON.stringify(inkOf[hl.id]));
  ok(mark && inkOf[mark.id] && (inkOf[mark.id].spread > 6 || inkOf[mark.id].diffAbove > 6), 'the mark box carries ink (the wordmark file is drawn there): ' + JSON.stringify(inkOf[mark.id]));
  if (ocrAvail.available) {
    const h = found.headline; ok(h && h.want && h.found / h.want >= 0.6, 'OCR finds most of the headline words (' + (h && h.found) + ' of ' + (h && h.want) + '): read "' + (read.headline || '').replace(/\s+/g, ' ') + '"');
    console.log('  OCR (' + ocrAvail.engine + '): ' + Object.keys(found).map(k => k + ' ' + found[k].found + '/' + found[k].want + ' (conf ' + found[k].confidence + ')').join(', '));
  } else { report.gaps.push('OCR not available in this run (' + ocrAvail.why + '): the read-back is an ink check, not word recognition'); console.log('  no OCR: ' + ocrAvail.why); }
});
await T.t('S9 + S8 + S5 in the page: an issue outlines its layer, the action statements show, the held mark is named in the editor; Review and Export render; the Brand inventory and Teach panel show the taught rule', async () => {
  await page.waitForSelector(R + '.st-actions button', { timeout: 15000 }); await page.click(R + '.st-actions button:has-text("Show what each action")'); await page.waitForSelector(R + '.st-actions-table'); await shot(page, 'actions');
  await itab(page, 'Quality'); await page.waitForSelector(R + '.st-readydetail');
  const hasShow = await page.$(R + '.st-val li .st-val-show'); if (hasShow) { await page.click(R + '.st-val li .st-val-show'); await page.waitForSelector(R + '.st-stage .st-hl'); await shot(page, 'highlight'); } else report.gaps.push('no measured issue named a layer on this tile, so the highlighting had nothing to outline here (it is covered by tests/studio-s9-browser.mjs)');
  await itab(page, 'Art Director'); await page.waitForSelector(R + '.st-adreview'); const ad = (await page.textContent(R + '.st-adreview')).replace(/\s+/g, ' '); ok(/Advice, not approval|Not reviewed yet/.test(ad), ad.slice(0, 200)); await shot(page, 'art-director');
  await page.click(R + '.st-asset-acts .btn:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-layer'); const le = (await page.textContent(R + '.st-le-wrap')).replace(/\s+/g, ' ');
  ok(/held by the campaign rule/.test(le), 'the editor names the held mark: ' + le.slice(0, 300)); await shot(page, 'editor'); await page.click(R + '.st-le-wrap .btn:has-text("Cancel")').catch(() => {});
  await page.click(R + '.st-step:has(.st-step-l:text-is("Review"))'); await page.waitForSelector(R + '.st-approvals'); await shot(page, 'review');
  await page.click(R + '.st-subtab:has-text("Export")'); await page.waitForTimeout(500); await shot(page, 'export');
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))'); await openTool(page, 'Brand'); await page.waitForSelector(R + '.st-brand');
  await page.selectOption(R + 'select[aria-label="Campaign scope"]', 'hoof');
  await page.waitForFunction(() => { const el = document.querySelector('#studio-root section[aria-label="Knowledge inventory"]'); return el && !/Counting/.test(el.textContent); });
  const br = (await page.textContent(R + '.st-brand')).replace(/\s+/g, ' '); ok(/approved rule, held/.test(br) && /by the approved placement rule/.test(br), 'the Brand workspace shows the taught rule: ' + br.slice(0, 300)); await shot(page, 'brand');
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
fs.writeFileSync(OUT + 's10-report.json', JSON.stringify(report, null, 1));
console.log('\nreport: tests/shots/s10-report.json; screenshots tests/shots/s10-*.png' + (report.gaps.length ? '\ngaps: ' + report.gaps.join(' | ') : ''));
const res = T.done(); if (ocrWorker) await ocrWorker.terminate(); await fx.close(); process.exit(res.fail ? 1 : 0);
