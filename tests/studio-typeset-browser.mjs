/* Typesetting the renderer measures and repairs (the 24 November report: a headline whose letters collide, a label tracked so
 * wide it ran to two lines in a box sized for one, a headline that started a little right of the words under it, and the
 * selection handles sitting on the words). In real Chromium with docs/studio-render.js; everything drawn is SYNTHETIC and no
 * model is called.
 *   TS1 tracking is judged against the type: a crushed headline blocks, a tight one warns, the house values pass
 *   TS2 wide tracking: mixed-case words fall apart sooner than capitals; a small-caps label at the house value passes
 *   TS3 Fix layout brings tracking back into range, says so, never touches a locked layer and never changes a word
 *   TS4 left edges that nearly line up are named, measured at the ink, and snapped to the column the others share
 *   TS5 a deliberate indent, a centred block and words in another column are not called ragged
 *   TS6 the RULES block is the same text in the renderer and the worker
 * Run: node --experimental-sqlite tests/studio-typeset-browser.mjs */
import fs from 'node:fs'; import path from 'node:path';
import { chromium, DOCS } from './pw.mjs';
process.on('warning', () => {});
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const section = s => console.log('\n' + s);
const RENDERER = fs.readFileSync(path.join(DOCS, 'studio-render.js'), 'utf8');
const WORKER = fs.readFileSync(path.join(DOCS, '..', 'axiomworkerv4.js'), 'utf8');
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
page.on('pageerror', e => console.log('  pageerror', e.message));
await page.route('http://studio.test/**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
await page.goto('http://studio.test/');
await page.addScriptTag({ content: RENDERER });

// the reported tile, reconstructed: a label over a headline over a support line and a sign-off, on a dark ground
const tile = (over) => {
  const L = { v: 5, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#1a1d1f', layers: [
    { id: 'machines', type: 'text', role: 'label', text: 'TRACTORS. BOATS. GENERATORS.', x: 5.5, y: 40, w: 69, h: 4, size: 2.6, weight: 600, font: 'mono', letterSpacing: 0.12, color: '#FFFFFF' },
    { id: 'headline', type: 'text', role: 'headline', x: 5.5, y: 47, w: 70, h: 20, size: 8, weight: 900, letterSpacing: -0.01, lineHeight: 1.05, color: '#FFFFFF' },
    { id: 'support', type: 'text', role: 'support', x: 5.5, y: 69, w: 70, h: 8, size: 3.2, weight: 400, color: '#FFFFFF' },
    { id: 'signoff', type: 'text', role: 'free', text: 'Hands Off Our Fuel.', x: 5.5, y: 79, w: 60, h: 4, size: 2.6, weight: 700, color: '#FFFFFF' }] };
  (over || []).forEach(([id, patch]) => Object.assign(L.layers.find(l => l.id === id), patch));
  return L;
};
const COPY = { headline: 'Fuel Tax Credits are not a subsidy.', support: 'The road tax is for roads. This paddock is not one.' };
const judge = (L, opts) => page.evaluate(({ L, C, opts }) => { const v = window.STRender.validate(L, C, {}, Object.assign({ format: '1:1', channel: 'instagram' }, opts || {}));
  return { issues: v.issues.map(i => ({ code: i.code, severity: i.severity, layers: i.layers, detail: i.detail })), boxes: v.boxes.filter(b => b.type === 'text').map(b => ({ id: b.id, x: b.x, inkL: b.inkL, ls: b.ls, caps: b.caps })) }; }, { L, C: COPY, opts });
const fix = (L, opts) => page.evaluate(({ L, C, opts }) => { const r = window.STRender.repair(L, C, {}, Object.assign({ format: '1:1', channel: 'instagram' }, opts || {}));
  return { layers: r.layout.layers, steps: r.steps, outcome: r.outcome, after: r.after.issues.map(i => i.code + '/' + i.severity + ':' + i.layers.join(',')) }; }, { L, C: COPY, opts });
const has = (r, code, sev, id) => r.issues.some(i => i.code === code && (!sev || i.severity === sev) && (!id || i.layers.indexOf(id) >= 0));

section('TS1 tracking is judged against the type: a crushed headline blocks, a tight one warns, the house values pass');
{
  const crushed = await judge(tile([['headline', { letterSpacing: -0.09 }]]));
  ok(has(crushed, 'tracking_tight', 'blocking', 'headline'), 'a headline at -90/1000 em is blocked: ' + JSON.stringify(crushed.issues.filter(i => /tracking/.test(i.code))));
  const why = (crushed.issues.find(i => i.code === 'tracking_tight') || {}).detail || '';
  ok(/-90/.test(why) && /collide|run together/.test(why), 'and says what it measured and what it does to the words: ' + why);
  const tight = await judge(tile([['headline', { letterSpacing: -0.04 }]]));
  ok(has(tight, 'tracking_tight', 'warning', 'headline') && !has(tight, 'tracking_tight', 'blocking'), 'a headline at -40/1000 em is a warning, not a block');
  const house = await judge(tile());
  ok(!house.issues.some(i => /^tracking_/.test(i.code)), 'the house values (-10 on the headline, +120 on a capitals label) pass: ' + house.issues.map(i => i.code).join(', '));
  const b = house.boxes.find(x => x.id === 'headline'); ok(b && b.ls === -0.01 && b.caps === false, 'the measurement carries the tracking and the case it judged (' + JSON.stringify(b) + ')');
}

section('TS2 wide tracking: mixed-case words fall apart sooner than capitals');
{
  const reported = await judge(tile([['machines', { text: 'Tractors. Boats. Generators. Mining equipment.', letterSpacing: 0.3 }]]));
  ok(has(reported, 'tracking_loose', 'blocking', 'machines'), 'the reported label (mixed case at +300/1000 em) is blocked: ' + JSON.stringify(reported.issues.filter(i => /tracking/.test(i.code))));
  const capsWide = await judge(tile([['machines', { letterSpacing: 0.3 }]]));
  ok(has(capsWide, 'tracking_loose', 'warning', 'machines') && !has(capsWide, 'tracking_loose', 'blocking'), 'capitals at +300 are only a warning: spaced capitals are a convention, spaced lower case is not');
  const lower = await judge(tile([['support', { letterSpacing: 0.15 }]]));
  ok(has(lower, 'tracking_loose', 'warning', 'support'), 'a support line at +150 warns');
  const caseUpper = await judge(tile([['support', { letterSpacing: 0.3, case: 'upper' }]]));
  ok(caseUpper.boxes.find(x => x.id === 'support').caps === true && !has(caseUpper, 'tracking_loose', 'blocking'), 'words set in capitals by the layer\'s case count as capitals');
}

section('TS3 Fix layout brings tracking back into range, says so, and leaves a locked layer alone');
{
  const L = tile([['headline', { letterSpacing: -0.09 }], ['machines', { text: 'Tractors. Boats. Generators. Mining equipment.', letterSpacing: 0.3 }]]);
  const r = await fix(L, { fixContrast: true });
  const hl = r.layers.find(l => l.id === 'headline'), lb = r.layers.find(l => l.id === 'machines');
  ok(hl.letterSpacing >= -0.025 && hl.letterSpacing <= 0, 'the headline is set back to a tight but readable tracking (' + hl.letterSpacing + ')');
  ok(lb.letterSpacing > 0 && lb.letterSpacing <= 0.08, 'the mixed-case label is set back to an open but readable tracking (' + lb.letterSpacing + ')');
  ok(lb.text === 'Tractors. Boats. Generators. Mining equipment.', 'no word is changed');
  ok(r.steps.some(s => /tracking/.test(s) && /headline/.test(s)), 'the step names the change: ' + r.steps.join(' | '));
  ok(!r.after.some(c => /^tracking_/.test(c)), 'and nothing about tracking stands after it: ' + r.after.join(', '));
  const locked = await fix(tile([['headline', { letterSpacing: -0.09, locked: true }]]), { fixContrast: true });
  ok(locked.layers.find(l => l.id === 'headline').letterSpacing === -0.09 && locked.after.some(c => /^tracking_tight\/blocking:headline/.test(c)), 'a locked headline keeps its tracking and the finding still stands');
  const unasked = await fix(tile([['headline', { letterSpacing: -0.04 }]]));
  ok(unasked.layers.find(l => l.id === 'headline').letterSpacing === -0.04, 'a warning alone is not changed unless the person asked for the fix');
}

section('TS4 left edges that nearly line up are named, measured at the ink, and snapped to the column the others share');
{
  const L = tile([['headline', { x: 7.2 }]]);
  const r = await judge(L);
  ok(has(r, 'edges_ragged', 'warning', 'headline'), 'a headline 1.7% right of three blocks on one edge is named: ' + JSON.stringify(r.issues.filter(i => i.code === 'edges_ragged')));
  ok(!(r.issues.find(i => i.code === 'edges_ragged') || { layers: [] }).layers.includes('support'), 'the blocks that share the edge are not the ones named');
  const b = r.boxes.find(x => x.id === 'headline'); ok(typeof b.inkL === 'number' && b.inkL >= 7.2 / 100 * 1080 - 1, 'the left edge is measured where the ink starts (' + Math.round(b.inkL) + ' px, box at ' + Math.round(7.2 / 100 * 1080) + ')');
  const f = await fix(L, { fixContrast: true });
  const after = await judge({ v: 5, stage: L.stage, noImagery: true, bg: L.bg, layers: f.layers });
  const inks = after.boxes.filter(x => x.id !== 'machines' || true).map(x => x.inkL);
  ok(Math.max.apply(null, inks) - Math.min.apply(null, inks) <= 0.004 * 1080 + 1, 'after Fix layout the four ink edges agree within 0.4% (' + inks.map(Math.round).join(', ') + ' px)');
  ok(!after.issues.some(i => i.code === 'edges_ragged'), 'and nothing is called ragged');
  ok(f.steps.some(s => /left edge|lined up/.test(s)), 'the step says it: ' + f.steps.join(' | '));
}

section('TS5 a deliberate indent, a centred block and a second column are not called ragged');
{
  const indent = await judge(tile([['support', { x: 12 }]]));
  ok(!has(indent, 'edges_ragged'), 'an indent of 6.5% is a decision, not a near miss');
  const centred = await judge(tile([['headline', { x: 7.2, align: 'center' }]]));
  ok(!has(centred, 'edges_ragged', null, 'headline'), 'a centred headline is not judged by its left edge');
  const button = await judge(tile([['signoff', { bg: '#E8B23A', color: '#141414' }]]));
  ok(!has(button, 'edges_ragged', null, 'signoff'), 'a button on the column edge is judged by its plate, not by the letters inside its padding: ' + JSON.stringify(button.issues.filter(i => i.code === 'edges_ragged')));
  const apart = await judge(tile([['signoff', { x: 6.8, y: 92, h: 3 }]]));
  ok(!has(apart, 'edges_ragged', null, 'signoff'), 'a block far below the column (a footer) is not part of it');
}

section('TS6 the RULES block is the same text in the renderer and the worker');
{
  const cut = s => { const a = s.indexOf('/* RULES:BEGIN */'), b = s.indexOf('/* RULES:END */'); return a >= 0 && b > a ? s.slice(a, b) : null; };
  const norm = s => s.split('\n').map(x => x.trim()).join('\n');
  ok(cut(RENDERER) && norm(cut(RENDERER)) === norm(cut(WORKER)), 'byte-identical apart from indentation');
}

await browser.close();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
