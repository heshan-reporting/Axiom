/* S23 slice I in real Chromium against the worker module in this process (studio-fixture.mjs; providers MOCKED, nothing spent):
 *   I-B1 repair never makes a design pass by hiding what must show or shrinking words below the readable size: across seven
 *        failing layouts, every copy role and mark visible before is visible after, no words get smaller than 2.2% of the width
 *        (unless they started smaller, and then they do not shrink), locked layers and every word are untouched, and the outcome
 *        repair reports is exactly what a fresh validation of its result says;
 *   I-B2 the validator is not weakened: type under 1.8% of the width, words that overflow their box and words the colour of
 *        their ground still block;
 *   I-B3 a reference's record is written in the References view (a date that is not a date is stopped before it is sent), and
 *        its observations are corrected (the vision pass's wording shown beside), retired and restored; an inference is refused
 *        as a rule until a person confirms it, then taught with a preview and a reason, and marked as the rule it became;
 *   I-B4 the Brand workspace says which references would help (a 9:16 HOOF tile the compositions need) and names a reference
 *        whose campaign is only its project's;
 *   I-B5 the Board measures repetition on the drawn tiles: two pieces of different families drawn alike are named, a different
 *        arrangement is not, and the measure says what it does not judge;
 *   I-B6 imagery on file but under a solid panel is "mostly covered", never "drawn";
 *   I-B7 a finished creative whose reading did not find the mark says the identity is not shown to match and offers the
 *        editable copy first; the Full AI choice says the model may redraw the mark and that each painting is read back.
 * Run: node --experimental-sqlite tests/studio-s23i-browser.mjs */
import { makeStudio, runner, eq, ok, pngSolid, pngGradient } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8881, inspect: false });
const { api } = fx;
const R = '#studio-root ';
const T = runner('studio-s23i-browser (repair invariants, reference records and observations, wanted references, repetition on drawn tiles, obscured imagery, finished-creative fidelity; providers MOCKED)');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let page;
const fresh = async o => { if (page) await page.ctxB.close().catch(() => {}); page = await fx.open(Object.assign({ viewport: { width: 1440, height: 1000 } }, o || {})); return page; };
const goStep = (pg, name) => pg.click(R + '.st-step:has(.st-step-l:' + (name === 'Review' ? 'text-matches("^Review")' : 'text-is("' + name + '")') + ')');
const openProject = async (pg, title) => {
  await pg.evaluate(() => { try { localStorage.removeItem('ax_studio_v1'); } catch (e) {} go('studio'); });
  const all = pg.locator(R + 'button:has-text("All projects")'); if (await all.count()) await all.first().click().catch(() => {});
  await pg.waitForSelector(R + '.st-lib tbody tr:has-text("' + title + '")', { timeout: 20000 });
  await pg.locator(R + '.st-lib tbody tr:has-text("' + title + '") button.st-lib-open').first().click();
  await pg.waitForSelector(R + '.st-step', { timeout: 15000 }); await sleep(400);
};

// the vision pass, answered here (the shared fixture leaves reference analysis unanswered)
const ANALYSIS = { summary: 'A bold yellow band over a dusk road with the wordmark bottom right.', typography: 'Condensed sans, heavy weight, all caps headline, light body', colour: { palette: ['#F2B705', '#0E3A44'], relationships: 'Yellow band on deep teal' }, hierarchy: 'Headline, then figure, then URL', composition: 'Band across the lower third, photograph above', imageTreatment: 'Documentary photograph, warm grade', panels: 'One solid band, square corners', spacing: 'Generous margins', logo: 'Wordmark bottom right', url: 'URL small, bottom left, white', mark: { present: true, kind: 'wordmark', corner: 'br', size: 'a fifth of the width', clearSpace: 'half its height' }, text: ['HANDS OFF OUR FUEL'], takeaways: ['Lead with the yellow band', 'Keep the URL small and white'] };
fx.answerWith(/describing one reference image/, () => ANALYSIS);
const PNG = pngGradient(64, 80).toString('base64');
await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', logoPolicy: 'wordmark' }, { id: 'national', name: 'Australian Mining', logoPolicy: 'logo' }] });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkDefault: true, wordmarkB64: pngSolid(240, 80, [255, 255, 255]).toString('base64'), wordmarkMime: 'image/png', logoPolicy: 'wordmark' });
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Memory check', brief: { channels: ['instagram'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'i-mem' });
const get = async () => api('GET', '/studio/get?id=' + pr.id);
const curOf = a => a.versions.find(v => v.id === a.current);
const COPY = { headline: 'Hands off our fuel', support: 'Fuel tax credits are not a subsidy.', cta: 'Sign the petition', caption: 'c', alt: 'a' };
const BAND = (fam) => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', bg: '#0E3A44', regions: [], noImagery: true, layers: [
  { id: 'panel', type: 'shape', role: 'device', name: 'Band', shape: 'rect', x: 0, y: 64, w: 100, h: 36, fill: fam === 'b' ? '#7A1F2B' : '#0E6A6E', opacity: 1 },
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 68, w: 84, h: 12, size: 6, weight: 800, color: '#FFFFFF', font: 'display' },
  { id: 'support', type: 'text', role: 'support', x: 8, y: 82, w: 70, h: 8, size: 3, weight: 500, color: '#FFFFFF', font: 'body' }] });
const TOP = () => ({ v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'typographic', approach: 'editable', bg: '#F2B705', regions: [], noImagery: true, layers: [
  { id: 'headline', type: 'text', role: 'headline', x: 8, y: 8, w: 50, h: 30, size: 8, weight: 900, color: '#111418', font: 'display' },
  { id: 'support', type: 'text', role: 'support', x: 60, y: 60, w: 32, h: 20, size: 3, weight: 500, color: '#111418', font: 'body' }] });

await T.t('I-B1 repair never hides what must show, never shrinks words under the readable size, never touches a locked layer or a word, and reports exactly what a fresh validation says', async () => {
  await fresh();
  await page.waitForFunction(() => window.STRender && window.STRender.repair);
  const res = await page.evaluate(async () => {
    const R = window.STRender; const base = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, approach: 'editable', regions: [], noImagery: true, bg: '#0E3A44' };
    const C = { headline: 'Hands off our fuel: the road tax is returned, not handed out', support: 'Fuel tax credits are not a subsidy. Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Sign the petition' };
    const L = layers => Object.assign({}, base, { layers });
    const cases = {
      overflow: L([{ id: 'headline', type: 'text', role: 'headline', x: 8, y: 60, w: 84, h: 8, size: 7, weight: 800, color: '#FFFFFF' }, { id: 'support', type: 'text', role: 'support', x: 8, y: 80, w: 84, h: 8, size: 3, color: '#FFFFFF' }]),
      collide: L([{ id: 'headline', type: 'text', role: 'headline', x: 8, y: 60, w: 84, h: 20, size: 5, weight: 800, color: '#FFFFFF' }, { id: 'support', type: 'text', role: 'support', x: 8, y: 66, w: 84, h: 12, size: 3, color: '#FFFFFF' }]),
      contrast: Object.assign(L([{ id: 'headline', type: 'text', role: 'headline', x: 8, y: 20, w: 84, h: 22, size: 6, weight: 800, color: '#FFFFFF' }]), { bg: '#FFFFFF' }),
      offstage: L([{ id: 'headline', type: 'text', role: 'headline', x: 70, y: 40, w: 60, h: 20, size: 5, weight: 800, color: '#FFFFFF' }]),
      tiny: L([{ id: 'support', type: 'text', role: 'support', x: 8, y: 40, w: 84, h: 20, size: 1.4, color: '#FFFFFF' }]),
      lockedOverflow: L([{ id: 'headline', type: 'text', role: 'headline', x: 8, y: 60, w: 84, h: 6, size: 7, weight: 800, color: '#FFFFFF', locked: true }, { id: 'support', type: 'text', role: 'support', x: 8, y: 80, w: 84, h: 10, size: 3, color: '#FFFFFF' }]),
      dupText: L([{ id: 'support', type: 'text', role: 'support', x: 8, y: 60, w: 84, h: 14, size: 3, color: '#FFFFFF' }, { id: 'label', type: 'text', role: 'free', text: '- Fuel tax credits are not a subsidy. Businesses do not pay a road fuel tax on fuel used off-road.', x: 8, y: 20, w: 84, h: 14, size: 3, color: '#FFFFFF' }]),
    };
    const out = {};
    for (const k of Object.keys(cases)) {
      const L0 = cases[k]; const W = 1080, H = 1350;
      const before = R.validate(L0, C, {}, { width: W }); const rp = R.repair(L0, C, {}, { width: W }); const after = R.validate(rp.layout, C, {}, { width: W });
      const m0 = R.measure(L0, C, {}, W, H), m1 = R.measure(rp.layout, C, {}, W, H);
      out[k] = { outcome: rp.outcome, reported: rp.counts && rp.counts.after, before: before.issues.filter(i => i.severity === 'blocking').map(i => i.code), after: after.issues.filter(i => i.severity === 'blocking').map(i => i.code), L0: L0.layers, L1: rp.layout.layers, px0: m0.filter(b => b.type === 'text').map(b => ({ id: b.id, px: b.px })), px1: m1.filter(b => b.type === 'text').map(b => ({ id: b.id, px: b.px })) };
    }
    return out;
  });
  const MUST = { headline: 1, support: 1, cta: 1, url: 1 };
  for (const [k, r] of Object.entries(res)) {
    ok(r.before.length > 0, k + ': the case fails to begin with (' + r.before.join(', ') + ')');
    eq(r.reported, r.after.length, k + ': repair reports what a fresh validation says (' + r.outcome + '; after: ' + r.after.join(', ') + ')');
    if (r.after.length) ok(r.outcome !== 'complete', k + ': blockers remain, so it is not called complete'); else ok(r.outcome === 'complete', k + ': nothing blocks, complete');
    r.L0.forEach(l0 => { const l1 = r.L1.find(x => x.id === l0.id); if (!l0.hidden && (MUST[l0.role] || l0.role === 'logo' || l0.role === 'wordmark')) ok(l1 && !l1.hidden, k + ': ' + l0.id + ' (a ' + l0.role + ') still shows');
      if (l0.locked) eq(JSON.stringify(l1), JSON.stringify(l0), k + ': the locked ' + l0.id + ' is untouched');
      if (l0.text != null) eq(l1 && l1.text, l0.text, k + ': the words of ' + l0.id + ' are not changed'); });
    r.px0.forEach(b0 => { const b1 = r.px1.find(x => x.id === b0.id); if (!b1 || b1.px == null || b0.px == null) return; if (b1.px < b0.px - 0.5) ok(b1.px >= 1080 * 0.022 - 0.5, k + ': ' + b0.id + ' got smaller (' + Math.round(b0.px) + ' to ' + Math.round(b1.px) + ' px) but not under 2.2% of the width'); });
  }
  ok(res.tiny.px1.find(b => b.id === 'support').px >= res.tiny.px0.find(b => b.id === 'support').px, 'tiny type is raised, never lowered');
  ok(res.dupText.L1.find(l => l.id === 'support').hidden !== true, 'with the same words twice, the support (a copy role) stays and only the free duplicate may go');
});

await T.t('I-B2 the validator is not weakened: unreadable type, overflow and words the colour of their ground still block', async () => {
  const codes = await page.evaluate(() => { const R = window.STRender; const b = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, approach: 'editable', regions: [], noImagery: true, bg: '#0E3A44' };
    const v = (layers, bg) => R.validate(Object.assign({}, b, { layers }, bg ? { bg } : {}), { headline: 'Hands off our fuel and the road tax returned to those who earned it', support: 'x' }, {}, { width: 1080 }).issues.filter(i => i.severity === 'blocking').map(i => i.code);
    return { tiny: v([{ id: 'h', type: 'text', role: 'headline', x: 8, y: 8, w: 84, h: 30, size: 1.6, color: '#FFFFFF' }]), over: v([{ id: 'h', type: 'text', role: 'headline', x: 8, y: 8, w: 30, h: 4, size: 7, color: '#FFFFFF' }]), same: v([{ id: 'h', type: 'text', role: 'headline', x: 8, y: 8, w: 84, h: 30, size: 6, color: '#0E3A44' }]) }; });
  ok(codes.tiny.indexOf('unreadable_type') >= 0, 'type at 1.6% blocks: ' + codes.tiny.join(', '));
  ok(codes.over.indexOf('text_overflow') >= 0, 'overflow blocks: ' + codes.over.join(', '));
  ok(codes.same.indexOf('unreadable_contrast') >= 0, 'words the colour of their ground block: ' + codes.same.join(', '));
});

let REF = null;
await T.t('I-B3 the References view: the record written and checked, observations corrected, retired and restored, an inference refused as a rule until confirmed, then taught with a preview and a reason', async () => {
  REF = (await api('POST', '/studio/reference', { project: pr.id, name: 'Approved HOOF tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: 'hoof' })).id;
  const ref0 = (await get()).references.find(r => r.id === REF); ok(((ref0.meta || {}).observations || []).length >= 6, 'the vision pass seeded observations');
  await fresh(); page.on('dialog', d => d.accept(/Who confirmed/.test(d.message()) ? 'Dee confirmed it on the call' : /Why is it set aside/.test(d.message()) ? 'a one-off for this execution' : undefined));
  await openProject(page, 'Memory check'); await goStep(page, 'Brief'); await page.click(R + '.st-subtab:has-text("References")');
  const card = R + '.st-ref:has-text("Approved HOOF tile") ';
  await page.waitForSelector(card + '.st-ref-rec');
  ok(/No record yet/.test(await page.textContent(card + '.st-ref-rec')), 'an empty record says so');
  await page.click(card + 'button:has-text("edit the record")');
  await page.selectOption(card + 'select[id$="-ctx"]', 'paid'); await page.selectOption(card + 'select[id$="-fmt"]', '4:5');
  await page.selectOption(card + 'select[id$="-st"]', 'approved'); await page.fill(card + 'input[id$="-dt"]', '30/09/2026');
  ok(await page.$(card + '.st-ref-recedit .st-err'), 'a date that is not YYYY-MM-DD is stopped here'); ok(await page.$eval(card + 'button:has-text("Save the record")', b => b.disabled), 'and Save waits');
  await page.fill(card + 'input[id$="-dt"]', '2026-09-30'); await page.fill(card + 'input[id$="-by"]', 'Dee');
  await page.fill(card + 'textarea[id$="-dl"]', 'The URL too small to read | client feedback, round 2');
  await page.click(card + 'button:has-text("Save the record")');
  await page.waitForFunction(sel => /approved 2026-09-30 by Dee/.test((document.querySelector(sel) || {}).textContent || ''), '#studio-root .st-ref .st-ref-rec', { timeout: 8000 });
  const rec = (await get()).references.find(r => r.id === REF).meta; eq([rec.context, rec.format, rec.approval.state, rec.approval.date, rec.dislikes[0].evidence], ['paid', '4:5', 'approved', '2026-09-30', 'client feedback, round 2']);
  // correct the typography reading: the vision pass's words stay beside it
  const row = area => card + '.st-obs:has(.st-obs-area:text-is("' + area + '"))';
  await page.click(row('Typography') + ' button:has-text("correct")');
  await page.fill(row('Typography') + ' input[aria-label^="Correct"]', 'Condensed sans, extra bold, all caps'); await page.fill(row('Typography') + ' input[aria-label="Why it is corrected"]', 'Dee: the body is regular');
  await page.click(row('Typography') + ' button:has-text("save")');
  await page.waitForSelector(row('Typography') + ' .st-obs-was', { timeout: 8000 });
  ok(/the vision pass said: Condensed sans, heavy weight/.test(await page.textContent(row('Typography'))), 'the correction shows the original beside it');
  // retire and restore the composition reading
  await page.click(row('Composition') + ' button:has-text("retire")'); await page.waitForSelector(card + 'button:has-text("Set aside (1)")');
  eq((((await get()).references.find(r => r.id === REF).meta.observations.find(o => o.area === 'composition')) || {}).status, 'retired', 'retired on the worker, with the reason asked for');
  await page.click(card + 'button:has-text("Set aside (1)")'); await page.click(card + '.st-obs-retired button:has-text("restore")');
  await page.waitForSelector(card + 'button:has-text("Set aside (1)")', { state: 'detached', timeout: 8000 });
  ok(!(await page.$(card + '.st-obs-retired')), 'restored: nothing set aside');
  // an inference is refused as a rule; confirmed, it is taught with a preview and a reason
  const take = card + '.st-obs:has-text("Lead with the yellow band")';
  ok(/inferred/.test(await page.textContent(take + ' .st-obs-meta')), 'the lesson is marked inferred');
  await page.click(take + ' button:has-text("make it a rule")'); await page.waitForSelector(card + '.st-obs-teach .st-err');
  ok(/inference/.test(await page.textContent(card + '.st-obs-teach')), 'refused as an inference: ' + await page.textContent(card + '.st-obs-teach'));
  await page.click(card + '.st-obs-teach button:has-text("close")');
  await page.click(take + ' button:has-text("confirm")'); await page.waitForSelector(take + ' .st-obs-meta:has-text("observed")', { timeout: 8000 });
  await page.click(take + ' button:has-text("make it a rule")'); await page.waitForSelector(card + '.st-obs-prev');
  ok(/retrieval memory/.test(await page.textContent(card + '.st-obs-teach')), 'the preview says it is retrieval memory, not training');
  await page.fill(card + '.st-obs-teach input[aria-label="Why it is taught"]', 'Dee confirmed the band leads on HOOF'); await page.click(card + '.st-obs-teach button:has-text("Teach the rule")');
  await page.waitForSelector(card + '.st-obs:has-text("became a Hands Off Our Fuel rule")', { timeout: 8000 });
  const fixes = await api('GET', '/engine/fixes?ns=mca', null, 'read-key'); ok((fixes.fixes || []).some(f => /teach:brand:campaign:hoof/.test(f.source) && /Lead with the yellow band/.test(f.rule)), 'the rule is in force for HOOF with its provenance');
  ok(!page.errors.length, page.errors.join(' | '));
});

await T.t('I-B4 the Brand workspace: the references that would help, and a reference whose campaign is only its project\'s', async () => {
  await api('POST', '/studio/asset', { project: pr.id, family: 'Stories', channel: 'instagram', format: '9:16', title: 'Story', copy: COPY, layout: Object.assign(TOP(), { format: '9:16', stage: { w: 1080, h: 1920 } }), mode: 'composition' });
  await api('POST', '/studio/reference', { project: pr.id, name: 'Loose tile', purpose: 'approved', imageB64: PNG, mime: 'image/png', campaign: '', analyse: false });
  const ws = await api('GET', '/brand/workspace?ns=mca&campaign=hoof', null, 'read-key');
  ok((ws.readiness.wanted || []).some(x => /9:16/.test(x.text)), 'the worker asks for a 9:16 tile');
  await fresh(); await openProject(page, 'Memory check'); await goStep(page, 'Brief');
  await page.click(R + '.st-ctx-links button:has-text("Brand")');
  await page.waitForSelector(R + '.st-wanted', { timeout: 15000 });
  ok(/Hands Off Our Fuel tile in 9:16/.test(await page.textContent(R + '.st-wanted')), 'the Brand view names the 9:16 tile wanted: ' + (await page.textContent(R + '.st-wanted')).slice(0, 200));
  ok(/no model is trained/.test(await page.textContent(R + '.st-wanted')), 'and says no model is trained on references');
  ok(/Loose tile.*carries no campaign of its own/.test(await page.textContent(R + '.st-brand')), 'the loose reference is named as scope uncertain');
});

await T.t('I-B5 the Board measures repetition on the drawn tiles: two families drawn alike are named, a different arrangement is not', async () => {
  for (const [fam, t, L] of [['Narrative: Band', 'Band tile', BAND('a')], ['Narrative: Band too', 'Band again', BAND('b')], ['Narrative: Type', 'Type tile', TOP()]]) await api('POST', '/studio/asset', { project: pr.id, family: fam, channel: 'instagram', format: '4:5', title: t, copy: COPY, layout: L, mode: 'composition' });
  await fresh(); await openProject(page, 'Memory check'); await goStep(page, 'Design'); await page.click(R + '.st-subtab:has-text("Board")');
  await page.waitForFunction(() => { const el = document.querySelector('#studio-root .st-board-rep'); return el && !/Measuring/.test(el.textContent); }, null, { timeout: 15000 });
  const txt = await page.textContent(R + '.st-board-rep');
  ok(/Band tile.*Band again.*the same arrangement|Band again.*Band tile.*the same arrangement/.test(txt), 'the two band tiles are named as one arrangement: ' + txt.slice(0, 300));
  ok(!/Type tile and <?b?>?Band|Band tile and Type tile|Band again and Type tile/.test(txt) && !/(Band tile|Band again)[^;]*Type tile[^;]*arrangement/.test(txt.split('\n').join(' ').replace(/<[^>]+>/g, '')), 'the typographic tile is not paired with a band tile');
  // the 9:16 story drawn from the same typographic plan IS the same arrangement as the type tile: the measure says so
  ok(/Story/.test(txt) && /Type tile/.test(txt), 'the story made from the same typographic plan is named with the type tile');
  ok(/Neither judges whether the ideas differ/.test(txt), 'the measure says what it does not judge');
});

await T.t('I-B6 imagery on file under a solid panel is "mostly covered", never "drawn"', async () => {
  const A = (await api('POST', '/studio/asset', { project: pr.id, family: 'Covered', channel: 'instagram', format: '4:5', title: 'Covered tile', copy: COPY, layout: Object.assign(BAND('a'), { noImagery: false, regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, fit: 'cover', prompt: 'a road at dusk' }] }), mode: 'composition' })).asset.id;
  const q = await api('POST', '/studio/imagery', { asset: A, size: '1K' }); ok(q.jobs && q.jobs.length, 'imagery queued: ' + JSON.stringify(q).slice(0, 200));
  for (const j of q.jobs) { for (let i = 0; i < 6; i++) { const s = await api('POST', '/studio/job/step', { id: j.id || j }); if (!s.job || s.job.state === 'done' || s.job.state === 'failed') break; } }
  let a = (await get()).assets.find(x => x.id === A); let v = curOf(a); ok(v.image && v.image.url, 'imagery on file');
  const L = JSON.parse(JSON.stringify(v.layout)); L.layers.unshift({ id: 'cover', type: 'shape', role: 'device', name: 'Cover', shape: 'rect', x: 0, y: 0, w: 100, h: 100, fill: '#0E3A44', opacity: 1 });
  const r = await api('POST', '/studio/version', { asset: A, project: pr.id, layout: L, note: 'a solid ground over the photograph' }); eq(r._status, 200, JSON.stringify(r).slice(0, 200));
  await fresh(); await openProject(page, 'Memory check'); await goStep(page, 'Design'); await page.click(R + '.st-assetpick:has-text("Covered tile")'); await page.waitForSelector(R + '.st-stage canvas'); await sleep(1500);
  const chip = await page.textContent(R + '.st-imgstate'); ok(/mostly covered/.test(chip), 'the imagery state says covered: ' + chip); ok(!/Imagery drawn/.test(chip), 'never "drawn"');
});

await T.t('I-B7 a finished creative whose reading did not find the mark offers the editable copy first; the Full AI choice states what it cannot promise', async () => {
  // a painted bitmap on file, as a finished render leaves it
  const key = 'studio/' + pr.id + '/painted.png'; await fx.env.MIND_DOCS.put(key, pngGradient(108, 135), { httpMetadata: { contentType: 'image/png' } });
  const A = (await api('POST', '/studio/asset', { project: pr.id, family: 'Finished', channel: 'instagram', format: '4:5', title: 'Painted tile', copy: COPY, layout: { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, finished: true, layers: [], baked: ['headline', 'support', 'cta', 'wordmark'] }, mode: 'finished', image: { key, url: '/studio/file?key=' + encodeURIComponent(key), model: 'gemini-test', size: '1K', meta: { finished: true, marksSent: ['wordmark'] } } })).asset;
  ok(A && A.id, 'a finished creative on file');
  const v = curOf((await get()).assets.find(x => x.id === A.id));
  // the reading of this exact image: every word read, the wordmark not found
  await fx.env.MIND_DB.prepare("INSERT INTO studio_events(project,kind,data,who,created) VALUES(?,?,?,?,?)").bind(pr.id, 'inspection', JSON.stringify({ asset: A.id, version: v.id, verdict: 'fix', composed: true, baked: { verified: true, missing: [] }, words: { present: [COPY.headline], wrong: [], missing: [] }, marks: { present: [], missing: ['wordmark'], wrong: [] }, text: 'inspection' }), 'test', Date.now()).run();
  await fresh(); await openProject(page, 'Memory check'); await goStep(page, 'Design'); await page.click(R + '.st-assetpick:has-text("Painted tile")'); await sleep(1200);
  await page.waitForSelector(R + '.st-finished', { timeout: 15000 });
  const f = await page.textContent(R + '.st-finished'); ok(/identity not shown to match/.test(f) && /did not find the wordmark/.test(f), 'the identity problem is said: ' + f.slice(0, 300));
  ok(await page.$eval(R + '.st-finished button:has-text("Switch to Editable")', b => !b.classList.contains('ghost')), 'the editable copy is the main action now');
  const g = await api('GET', '/studio/readiness?asset=' + A.id, null, 'read-key'); eq((g.baked || {}).markProblem, { missing: ['wordmark'], wrong: [] });
  // the choice of production mode, as it is drawn: what the Full AI path cannot promise is said before anything is painted
  const modes = await page.evaluate(async () => { const el = document.createElement('div'); document.body.appendChild(el); const root = ReactDOM.createRoot(el); root.render(React.createElement(window.STFlow.ProductionModes, { p: { id: 'x', ns: 'mca', assets: [], brief: {}, readOnly: false }, busy: '', prov: {}, onProduce: () => {} })); await new Promise(r => setTimeout(r, 200)); const t = el.textContent; root.unmount(); el.remove(); return t; });
  ok(/redraws what it is shown/.test(modes) && /misspell or alter/.test(modes), 'the Full AI card says the mark may be redrawn: ' + modes.slice(0, 300));
  ok(/read back against the approved words and the mark/.test(modes) && /editable copy/.test(modes), 'and that each painting is read back, with the editable copy as the way out');
  ok(/exact words, the mark from its file/.test(modes), 'the Editable card says the words and the mark are exact');
});

T.done(); await fx.close();
