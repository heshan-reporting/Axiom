/* Workflow and interface (S9), in real Chromium against the worker module in this process; providers MOCKED.
 * The context bar names the creation mode, the campaign and the content type (deliverable and channels) on every
 * project; an issue in the Quality tab outlines the layers it names on the tile itself ("show on the tile"), cleared
 * when the version moves; the Art Director panel says what the model saw (the composed tile or the imagery only), the
 * words it read against the approved copy, what it did not score, and that a review is one read and never approval;
 * and an accessibility audit of the library, the brief, Refine (Copy, Quality, Art Director), Brand, Review and Export
 * finds no unlabeled control, no image without a name and a sane heading order; Alt+1..5 moves between stages, and
 * live status is announced (aria-live).
 * Run: node --experimental-sqlite tests/studio-s9-browser.mjs */
import { makeStudio, runner, eq, ok, place, tool } from './studio-fixture.mjs';
import { openTool } from './studio-flow.mjs';
const fx = await makeStudio({ port: 8799 });
const { api, env } = fx;
const R = '#studio-root ';
const T = runner('studio-s9-browser (mode / campaign / content type visible, issue-to-element highlighting, an honest Art Director, accessibility; providers MOCKED)');
const step = async id => { let j; for (let i = 0; i < 5; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || j.state === 'done' || j.state === 'failed') return j; } return j; };
const itab = (pg, name) => place(pg, name);
const audit = page => page.evaluate(() => {
  const root = document.querySelector('#studio-root'); const out = { unlabeled: [], images: [], headings: [] };
  const name = el => (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title') || (el.id && root.querySelector('label[for="' + el.id + '"]') && root.querySelector('label[for="' + el.id + '"]').textContent) || (el.closest('label') && el.closest('label').textContent) || el.textContent || el.getAttribute('placeholder') || '').trim();
  root.querySelectorAll('button, input, select, textarea, [role=button]').forEach(el => { if (el.type === 'hidden' || el.closest('[hidden]')) return; if (!name(el)) out.unlabeled.push(el.outerHTML.slice(0, 160)); });
  root.querySelectorAll('img').forEach(im => { if (!im.hasAttribute('alt') && !im.closest('[aria-hidden=true]')) out.images.push(im.outerHTML.slice(0, 120)); });
  root.querySelectorAll('canvas').forEach(c => { const w = c.closest('[role=img]'); if (!w || !w.hasAttribute('aria-label')) { if (!c.closest('[aria-hidden=true]')) out.images.push('canvas without a role=img name'); } });
  root.querySelectorAll('h1,h2,h3,h4,h5').forEach(h => { if (!h.closest('[hidden]')) out.headings.push(+h.tagName[1]); });
  out.live = root.querySelectorAll('[aria-live], [role=status], [role=alert]').length;
  return out;
});
const clean = (a, where) => { ok(!a.unlabeled.length, where + ': unlabeled controls: ' + a.unlabeled.join(' | ')); ok(!a.images.length, where + ': unnamed images: ' + a.images.join(' | ')); for (let i = 1; i < a.headings.length; i++) ok(a.headings[i] - a.headings[i - 1] <= 1, where + ': heading order jumps: ' + a.headings.join(',')); };

// a HOOF project with one produced composition (no render); then a hand-made version that pushes the headline off the stage
const P = (await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'S9', brief: { objective: 'answer the subsidy framing', message: 'not a subsidy', channels: ['instagram', 'facebook'], deliverable: 'set', campaignConfirmed: true } })).id;
const j = await step((await api('POST', '/studio/job', { project: P, stage: 'copy', input: { channels: ['instagram'], deliverable: 'set', render: false, acknowledge: true }, idem: 's9-1' })).job.id);
if (j.state !== 'done') throw new Error('production failed: ' + j.error);
let g = await api('GET', '/studio/get?id=' + P); const a0 = g.assets[0]; const v0 = a0.versions.find(x => x.id === a0.current);
const off = JSON.parse(JSON.stringify(v0.layout)); const hl = off.layers.find(l => l.role === 'headline'); hl.x = 92; hl.w = 30;
const vr = await api('POST', '/studio/version', { asset: a0.id, copy: v0.copy, layout: off, note: 'headline pushed off the stage for the test' }); if (vr._status !== 200) throw new Error('version: ' + JSON.stringify(vr));
// a recorded inspection of the imagery only, with words read, one unscored dimension and a fix on offer
g = await api('GET', '/studio/get?id=' + P); const V1 = g.assets[0].current;
env.MIND_DB.db.prepare('INSERT INTO studio_events(project,kind,data,who,created) VALUES(?,?,?,?,?)').run(P, 'inspection', JSON.stringify({ eid: 'e-s9', asset: a0.id, version: V1, versionNumber: 2, round: 1, of: 2, scores: { fidelity: 4, hierarchy: 3, readability: null, relevance: 4, identity: 4 }, reasons: { fidelity: 'the road carries it', hierarchy: 'the support competes' }, unscored: ['readability'], words: { present: ['Farmers, tradies and tourism operators use it', 'Get the facts'], wrong: ['Subsidy'], missing: ['Businesses do not pay a road fuel tax on fuel used off-road.'] }, marks: { present: [], missing: [], wrong: [] }, issues: [{ text: 'The headline runs off the right edge', severity: 'blocking' }], verdict: 'fix', assessment: 'fix', composed: false, imageryOnly: true, fix: { kind: 'design', instruction: 'Bring the headline back inside the safe area.' }, model: 'claude-opus-5-5', text: 'Inspection of the tile (imagery only): fix.' }), 'studio', Date.now());

let page;
await T.t('the context bar names the creation mode, the campaign and the content type with its channels on every project', async () => {
  page = await fx.open(); page.on('dialog', d => d.accept());
  await page.waitForSelector(R + '.st-lib tbody tr:has-text("S9")'); await page.click(R + '.st-lib tbody tr:has-text("S9") .ov-link'); await page.waitForSelector(R + '.st-assetpick');
  const head = (await page.textContent(R + '.st-head')).replace(/\s+/g, ' ');
  ok(/Hands Off Our Fuel/.test(head), 'campaign: ' + head); ok(/Editable/.test(head), 'mode: ' + head); ok(/Set - Instagram, Facebook/.test(head), 'content type and channels: ' + head);
  const title = await page.getAttribute(R + '.st-head .st-psub span:has-text("Set - Instagram")', 'title'); ok(/Content type: a coordinated set for Instagram, Facebook/.test(title || ''), title);
});
await T.t('an issue in the Quality tab outlines the layers it names on the tile; the outline toggles off, and a new version clears it', async () => {
  await page.click(R + '.st-assetpick'); await itab(page, 'Quality');
  await page.waitForSelector(R + '.st-val li .st-val-show', { timeout: 20000 });
  const items = await page.$$eval(R + '.st-val li', lis => lis.map(li => li.textContent.replace(/\s+/g, ' ')));
  ok(items.some(t => /off stage|overflow|safe/.test(t) && /show on the tile/.test(t)), 'an issue names its layers and offers to show them: ' + JSON.stringify(items));
  eq(await page.$$eval(R + '.st-stage .st-hl', els => els.length), 0, 'nothing outlined before asking');
  await page.click(R + '.st-val li:has-text("show on the tile") .st-val-show');
  await page.waitForSelector(R + '.st-stage .st-hl');
  const boxes = await page.$$eval(R + '.st-stage .st-hl', els => els.map(e => ({ id: e.getAttribute('data-layer'), left: e.style.left, label: e.textContent })));
  ok(boxes.length >= 1 && boxes.some(b => /92%/.test(b.left)) && boxes.every(b => /headline|support|cta|panel|logo|wordmark|region|rule|label|kicker/.test(b.label) || b.id), 'the named layer is outlined where it sits: ' + JSON.stringify(boxes));
  ok(/Outlined on the tile/.test(await page.textContent(R + '.st-hl-note')), 'the stage says what is outlined');
  eq(await page.getAttribute(R + '.st-val li.st-val-on .st-val-show', 'aria-pressed'), 'true');
  await page.click(R + '.st-val li.st-val-on .st-val-show');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-stage .st-hl'));
  await page.click(R + '.st-val li:has-text("show on the tile") .st-val-show'); await page.waitForSelector(R + '.st-stage .st-hl');
  // a new version (a caption edit) clears the outline: it belonged to the version it was measured on
  await itab(page, 'Copy'); await page.fill(R + '#st-f-caption', 'A caption written for the test.'); await page.press(R + '#st-f-caption', 'Tab');
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-stage .st-hl'), null, { timeout: 20000 });
});
await T.t('the Art Director panel is honest about what it saw, what it read and what it did not score, and that a review is one read and never an approval', async () => {
  await page.click(R + '#st-tabbtn-director'); await page.click(R + '.st-cd-tab:has-text("Review")'); await page.waitForSelector(R + '.st-adreview');
  const t = (await page.textContent(R + '.st-adreview')).replace(/\s+/g, ' ');
  ok(/readability not scored/.test(t), 'the missing score is said, never assumed: ' + t);
  ok(/Not scored: readability \(the model gave no score; nothing was assumed\)/.test(t), t);
  ok(/It saw the imagery only: the words and marks were not in the picture it judged/.test(t), t);
  ok(/Words it read: "Farmers, tradies and tourism operators use it", "Get the facts"/.test(t) && /not in the approved copy: "Subsidy"/.test(t) && /approved words it could not find: "Businesses do not pay/.test(t), t);
  ok(/One read by one model; the scores are its opinion, not a measurement/.test(t) && /Advice, not approval/.test(t), t);
  ok(/an earlier version; review again for this one/.test(t), 'the caption edit made a newer version, and the panel says the review is of the earlier one: ' + t);
});
await T.t('accessibility: every control is named, every image has a name, headings do not skip a level, live status is announced - in the library, the brief, Refine (Copy, Quality, Art Director), Brand, Review and Export; Alt+1..5 moves between stages', async () => {
  const where = [];
  const check = async label => { const a = await audit(page); clean(a, label); where.push(label + ' (' + a.live + ' live regions)'); return a; };
  await itab(page, 'Copy'); await check('Refine / Copy');
  await itab(page, 'Quality'); await check('Refine / Quality');
  await itab(page, 'Art Director'); const ad = await check('Refine / Art Director'); ok(ad.live >= 1, 'a live region exists on the page: ' + ad.live);
  await openTool(page, 'Brand'); await page.waitForSelector(R + '.st-brand'); await page.waitForFunction(() => { const el = document.querySelector('#studio-root section[aria-label="Knowledge inventory"]'); return el && !/Counting/.test(el.textContent); }); await check('Brand');
  await page.keyboard.press('Alt+1'); await page.waitForSelector(R + '.st-step.on:has(.st-step-l:text-is("Brief"))'); await check('Brief');
  // seven steps since S17: Brief, Objectives, Strategy, Directions, Copy, Design, Review; Export is a view inside Review
  await page.keyboard.press('Alt+5'); await page.waitForSelector(R + '.st-step.on:has(.st-step-l:text-matches("^Review"))'); await check('Review');
  await page.click(R + '.st-subtab:has-text("Delivery")'); await page.waitForSelector(R + '.st-subtab.on:has-text("Delivery")'); await check('Export');
  await page.keyboard.press('Alt+3'); await page.waitForSelector(R + '.st-step.on:has(.st-step-l:text-is("Copy"))'); await check('Copy (S13)');
  await page.keyboard.press('Alt+4'); await page.waitForSelector(R + '.st-step.on:has(.st-step-l:text-is("Design"))');
  // keyboard: from a stage button, Tab moves on to the next focusable control without a trap
  await page.focus(R + '.st-step.on'); await page.keyboard.press('Tab'); const active = await page.evaluate(() => { const el = document.activeElement; return el && el !== document.body ? (el.tagName + ' ' + (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 30)) : ''; }); ok(active, 'focus moved on: ' + active);
  await page.click(R + '.st-head .ov-link:has-text("All projects")'); await page.waitForSelector(R + '.st-lib'); await check('Library');
  ok(where.length === 9, where.join('; '));
  eq(page.errors.length, 0, 'no page errors: ' + page.errors.join(' | '));
});
await T.t('a read-only key: the same views audit clean and show no mutating controls on the tile', async () => {
  const p2 = await fx.open({ role: 'read' });
  await p2.waitForSelector(R + '.st-lib tbody tr:has-text("S9")'); await p2.click(R + '.st-lib tbody tr:has-text("S9") .ov-link'); await p2.waitForSelector(R + '.st-assetpick'); await p2.click(R + '.st-assetpick');
  await p2.waitForSelector(R + '.st-stage'); clean(await audit(p2), 'read-only Refine');
  eq(await p2.$(R + '.st-ad-actions'), null, 'no art-direction actions for a read key');
  await p2.close();
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
