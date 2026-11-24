/* Typesetting on the worker (the 24 November report): the tracking a planner may give a text element is bounded to what the
 * shared rules pass, and a filed measurement is judged by the worker for tracking and near-miss left edges with the same
 * rules the browser ran - tracking and case read from the version's own layout, never from the report; the ink edge read
 * from the report only inside the layer's reach. Providers MOCKED; nothing is spent.
 *   TW1 a plan asking for crushed or spaced type is held to the house range (capitals keep twice the room)
 *   TW2 the worker's judge blocks a crushed headline and warns on spaced capitals, whatever the report says
 *   TW3 a near-miss left edge reported at the ink is named; an edge reported outside the layer is not believed
 * Run: node --experimental-sqlite tests/studio-typeset-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { stubReport } from './studio-measure-stub.mjs';
const T = suite('studio-typeset-worker (tracking bounded; tracking and edges judged by the worker)');
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' } }, env: { STUDIO_INSPECT: '0' } });
const X = w.mod.__test;
const LAYOUT = (over) => {
  const L = { v: 5, stage: { w: 1080, h: 1080 }, noImagery: true, bg: '#1a1d1f', layers: [
    { id: 'machines', type: 'text', role: 'label', text: 'TRACTORS. BOATS.', x: 5.5, y: 40, w: 69, h: 4, size: 2.6, weight: 600, letterSpacing: 0.12, color: '#FFFFFF' },
    { id: 'headline', type: 'text', role: 'headline', x: 5.5, y: 47, w: 70, h: 20, size: 8, weight: 900, color: '#FFFFFF' },
    { id: 'support', type: 'text', role: 'support', x: 5.5, y: 69, w: 70, h: 8, size: 3.2, color: '#FFFFFF' }] };
  (over || []).forEach(([id, p]) => Object.assign(L.layers.find(l => l.id === id), p)); return L;
};
const COPY = { headline: 'Fuel Tax Credits are not a subsidy.', support: 'The road tax is for roads.' };
const judge = (L, tweak) => { const v = { layout: L, copy: COPY }; const rep = stubReport(v, { format: '1:1' }); if (tweak) tweak(rep); return X.stValidationJudge({ format: '1:1', channel: 'instagram' }, v, rep, null); };
const has = (r, code, sev, id) => (r.issues || []).some(i => i.code === code && (!sev || i.severity === sev) && (!id || i.layers.indexOf(id) >= 0));

await T.t('TW1: a plan asking for crushed or spaced type is held to the house range', async () => {
  eq(X.stTracking({ letterSpacing: -0.1, role: 'headline' }), -0.025, 'a crushed headline is opened to -25');
  eq(X.stTracking({ letterSpacing: 0.3, text: 'Tractors. Boats.' }), 0.1, 'spaced lower case is closed to +100');
  eq(X.stTracking({ letterSpacing: 0.3, text: 'TRACTORS. BOATS.' }), 0.2, 'capitals keep up to +200');
  eq(X.stTracking({ letterSpacing: 0.3, text: 'Tractors', case: 'upper' }), 0.2, 'words the layer sets in capitals count as capitals');
  eq(X.stTracking({ letterSpacing: 0 }), undefined, 'no tracking is no tracking');
  const L = X.stPlanNormalise({ medium: 'typographic', bg: '#0B1E33', elements: [
    { id: 'hl', type: 'text', role: 'headline', x: 6, y: 30, w: 80, h: 20, size: 8, letterSpacing: -0.09 },
    { id: 'lb', type: 'text', role: 'label', text: 'Tractors. Boats. Generators.', x: 6, y: 20, w: 80, h: 4, size: 2.6, letterSpacing: 0.3 }] }, '1:1', { kit: {}, ns: 'synthdemo' });
  eq(L.layers.find(l => l.id === 'hl').letterSpacing, -0.025, 'the normaliser applies it to a planned headline');
  eq(L.layers.find(l => l.id === 'lb').letterSpacing, 0.1, 'and to a planned label in lower case');
});

await T.t('TW2: the worker judges tracking from the layout, whatever the report says', async () => {
  const crushed = judge(LAYOUT([['headline', { letterSpacing: -0.09 }]]));
  ok(has(crushed, 'tracking_tight', 'blocking', 'headline'), 'a crushed headline blocks: ' + JSON.stringify((crushed.issues || []).map(i => i.code + '/' + i.severity)));
  const lie = judge(LAYOUT([['headline', { letterSpacing: -0.09 }]]), rep => rep.boxes.forEach(b => { b.ls = 0; }));
  ok(has(lie, 'tracking_tight', 'blocking', 'headline'), 'a report that claims no tracking does not hide it');
  const caps = judge(LAYOUT([['machines', { letterSpacing: 0.3 }]]));
  ok(has(caps, 'tracking_loose', 'warning', 'machines') && !has(caps, 'tracking_loose', 'blocking'), 'spaced capitals warn');
  const house = judge(LAYOUT());
  ok(!(house.issues || []).some(i => /^tracking_/.test(i.code)), 'the house values pass: ' + (house.issues || []).map(i => i.code).join(', '));
});

await T.t('TW3: a near-miss left edge reported at the ink is named; one reported outside the layer is not believed', async () => {
  const ink = (map) => rep => rep.boxes.forEach(b => { if (map[b.id] != null) b.inkL = map[b.id]; });
  const off = judge(LAYOUT([['headline', { x: 7.2 }]]), ink({ machines: 61, headline: 80, support: 61 }));
  ok(has(off, 'edges_ragged', 'warning', 'headline'), 'the headline 19 px right of the column is named: ' + JSON.stringify((off.issues || []).filter(i => i.code === 'edges_ragged')));
  const far = judge(LAYOUT(), ink({ machines: 61, headline: 400, support: 61 }));
  ok(!has(far, 'edges_ragged', null, 'headline'), 'an ink edge reported 340 px inside the box is not believed (the box edge is judged instead)');
});

const r = T.done(); w.restore(); process.exit(r.fail ? 1 : 0);
