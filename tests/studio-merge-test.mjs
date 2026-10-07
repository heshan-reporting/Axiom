/* S19: the three-way merge of a canvas edit (docs/studio-merge.js) in Node: independent changes combine, the same field or
 * layer changed by both is a conflict a person decides, the resolution writes exactly the choice, and "contains" is the test
 * that an edit really reached the saved version. Run: node tests/studio-merge-test.mjs */
import '../docs/studio-merge.js';
const M = globalThis.STMerge;
let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (c, m) => { if (!c) throw new Error(m || 'not ok'); };
console.log('studio-merge-test (the three-way merge of a canvas edit)');
const L = (layers, extra) => Object.assign({ stage: { w: 1080, h: 1080 }, layers }, extra || {});
const hl = (o) => Object.assign({ id: 'hl', role: 'headline', type: 'text', x: 8, y: 50, w: 80, h: 20, size: 7 }, o || {});
const sp = (o) => Object.assign({ id: 'sp', role: 'support', type: 'text', x: 8, y: 72, w: 80, h: 10, size: 3 }, o || {});
const logo = (o) => Object.assign({ id: 'logo', role: 'logo', type: 'img', x: 80, y: 88, w: 12, h: 6 }, o || {});
const base = { layout: L([hl(), sp(), logo()]), copy: { headline: 'Base headline', caption: 'Base caption' } };

t('my headline words and their caption are independent: both kept, no conflict', () => {
  const r = M.merge({ base, mine: { layout: base.layout, copy: { headline: 'My headline' } }, theirs: { layout: base.layout, copy: { headline: 'Base headline', caption: 'Their caption' } } });
  ok(r.clean, JSON.stringify(r.conflicts)); eq(r.copy.headline, 'My headline'); eq(r.copy.caption, 'Their caption');
});
t('the same field changed by both is a conflict with all three values; nothing is chosen in silence', () => {
  const r = M.merge({ base, mine: { layout: base.layout, copy: { headline: 'Mine' } }, theirs: { layout: base.layout, copy: { headline: 'Theirs', caption: 'Base caption' } } });
  eq(r.conflicts.length, 1); eq(r.conflicts[0].kind, 'copy'); eq([r.conflicts[0].base, r.conflicts[0].mine, r.conflicts[0].theirs], ['Base headline', 'Mine', 'Theirs']);
  eq(M.resolve(r, base, null, null, 'mine').copy.headline, 'Mine'); eq(M.resolve(r, base, null, null, 'theirs').copy.headline, 'Theirs');
});
t('both typing the same words is no conflict', () => {
  const r = M.merge({ base, mine: { layout: base.layout, copy: { headline: 'Same' } }, theirs: { layout: base.layout, copy: { headline: 'Same' } } });
  ok(r.clean); eq(r.copy.headline, 'Same');
});
t('I moved the headline, they moved the logo: both moves kept', () => {
  const r = M.merge({ base, mine: { layout: L([hl({ y: 40 }), sp(), logo()]), copy: {} }, theirs: { layout: L([hl(), sp(), logo({ x: 6 })]), copy: base.copy } });
  ok(r.clean); eq(r.layout.layers.find(l => l.id === 'hl').y, 40); eq(r.layout.layers.find(l => l.id === 'logo').x, 6);
});
t('both moved the headline differently: a layer conflict; resolving per item writes each choice', () => {
  const r = M.merge({ base, mine: { layout: L([hl({ y: 40 }), sp({ size: 4 }), logo()]), copy: { headline: 'Mine' } }, theirs: { layout: L([hl({ y: 60 }), sp(), logo()]), copy: { headline: 'Theirs', caption: 'Base caption' } } });
  eq(r.conflicts.map(c => c.id).sort(), ['copy:headline', 'layer:hl']);
  eq(r.layout.layers.find(l => l.id === 'sp').size, 4, 'my independent change to the support is kept');
  const x = M.resolve(r, base, null, null, { 'layer:hl': 'theirs', 'copy:headline': 'mine' });
  eq(x.layout.layers.find(l => l.id === 'hl').y, 60); eq(x.copy.headline, 'Mine');
});
t('a layer I added and a layer they removed both land; their removal of a layer I did not touch stands', () => {
  const r = M.merge({ base, mine: { layout: L([hl(), sp(), logo(), { id: 'lbl', role: 'label', type: 'text', x: 8, y: 8, w: 30, h: 5 }]), copy: {} }, theirs: { layout: L([hl(), logo()]), copy: base.copy } });
  ok(r.clean, JSON.stringify(r.conflicts)); eq(r.layout.layers.map(l => l.id), ['hl', 'logo', 'lbl']);
});
t('they removed a layer I changed: a conflict, never a silent loss of my change', () => {
  const r = M.merge({ base, mine: { layout: L([hl(), sp({ y: 70 }), logo()]), copy: {} }, theirs: { layout: L([hl(), logo()]), copy: base.copy } });
  eq(r.conflicts.map(c => c.id), ['layer:sp']); const x = M.resolve(r, base, null, null, 'mine'); ok(x.layout.layers.some(l => l.id === 'sp' && l.y === 70), 'mine restores my layer');
});
t('the composition framing changed by both is a layout conflict', () => {
  const r = M.merge({ base, mine: { layout: L([hl(), sp(), logo()], { imageFocus: { x: 30, y: 50, zoom: 1 } }), copy: {} }, theirs: { layout: L([hl(), sp(), logo()], { imageFocus: { x: 70, y: 50, zoom: 1 } }), copy: base.copy } });
  eq(r.conflicts.map(c => c.id), ['layout:imageFocus']);
});
t('contains: a saved version holds the edit only when the layout and every intended field are there', () => {
  ok(M.contains({ layout: base.layout, copy: { headline: 'X', caption: 'Y' } }, { layout: base.layout, copy: { headline: 'X' } }));
  ok(!M.contains({ layout: base.layout, copy: { headline: 'Base' } }, { layout: base.layout, copy: { headline: 'X' } }), 'the headline is missing');
  ok(!M.contains({ layout: L([hl({ y: 1 })]), copy: {} }, { layout: base.layout, copy: {} }), 'the layout differs');
});
t('sig is stable for equal edits and differs for different ones', () => {
  eq(M.sig({ a: 1 }), M.sig({ a: 1 })); ok(M.sig({ a: 1 }) !== M.sig({ a: 2 }));
});
console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
