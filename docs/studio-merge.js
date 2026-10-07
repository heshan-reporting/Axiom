/* The three-way merge of one canvas edit (S19): the layout and the words typed on the canvas are one logical edit, merged against
 * the version it was made on (base) and the version now current (theirs). Independent changes combine; the same field or the
 * same layer changed differently by both is a conflict that a person decides - nothing is overwritten or dropped in silence.
 * window.STMerge in the page, globalThis.STMerge in Node (tests/studio-merge-test.mjs). No dependencies. */
(function (root) {
  const J = x => JSON.stringify(x === undefined ? null : x);
  const same = (a, b) => J(a) === J(b);
  const layerName = l => l ? ((l.role || l.type || 'layer') + (l.id && l.id !== l.role ? ' ' + l.id : '')) : 'layer';
  const idOf = (l, i) => String((l && l.id) || ('layer' + i));
  const byId = L => { const m = {}; ((L && L.layers) || []).forEach((l, i) => { if (l) m[idOf(l, i)] = l; }); return m; };
  const ids = L => ((L && L.layers) || []).map(idOf);

  /** merge({base, mine, theirs}) where each is {layout, copy}; mine.copy may be a patch (the fields the edit changed).
      Returns {layout, copy, conflicts: [{id, kind 'copy'|'layer'|'layout', key, label, base, mine, theirs}], clean}. */
  function merge(o) {
    const baseL = (o.base && o.base.layout) || {}, mineL = (o.mine && o.mine.layout) || baseL, theirL = (o.theirs && o.theirs.layout) || baseL;
    const baseC = (o.base && o.base.copy) || {}, theirC = (o.theirs && o.theirs.copy) || {};
    const mineP = (o.mine && o.mine.copy) || {};
    const conflicts = [];
    // the words: a field I changed lands unless they changed it to something else as well
    const copy = Object.assign({}, theirC);
    Object.keys(mineP).forEach(k => {
      const b = baseC[k] == null ? '' : baseC[k], m = mineP[k] == null ? '' : mineP[k], t = theirC[k] == null ? '' : theirC[k];
      if (m === b) return;                        // not my change
      if (t === b || t === m) { copy[k] = m; return; }
      conflicts.push({ id: 'copy:' + k, kind: 'copy', key: k, label: 'the ' + k, base: b, mine: m, theirs: t });
    });
    // the layout's own fields (stage, image framing, ground ...) other than its layers
    const layout = {};
    const keys = Array.from(new Set(Object.keys(baseL).concat(Object.keys(mineL), Object.keys(theirL)))).filter(k => k !== 'layers' && k !== '_copy');
    keys.forEach(k => {
      const b = baseL[k], m = mineL[k], t = theirL[k];
      if (same(m, b)) { if (t !== undefined) layout[k] = t; return; }
      if (same(t, b) || same(t, m)) { if (m !== undefined) layout[k] = m; return; }
      conflicts.push({ id: 'layout:' + k, kind: 'layout', key: k, label: 'the composition\'s ' + k, base: b, mine: m, theirs: t });
      if (t !== undefined) layout[k] = t;          // provisional: theirs until a person chooses
    });
    // the layers, by id: whoever changed a layer wins it; both changing it differently is a conflict
    const B = byId(baseL), M = byId(mineL), T = byId(theirL);
    const chosen = {}; const all = Array.from(new Set(Object.keys(B).concat(Object.keys(M), Object.keys(T))));
    all.forEach(id => {
      const b = B[id], m = M[id], t = T[id];
      if (same(m, b)) { chosen[id] = t; return; }  // mine unchanged (or both absent): theirs, whatever it is
      if (same(t, b) || same(t, m)) { chosen[id] = m; return; }
      conflicts.push({ id: 'layer:' + id, kind: 'layer', key: id, label: 'the ' + layerName(m || t || b), base: b, mine: m, theirs: t });
      chosen[id] = t;                               // provisional
    });
    /* the stacking order is document state (S20). Over the layers all three share, each pair keeps the relation whoever changed
       it gave it (a pair both changed can only have changed the same way). If those relations still make one order, it is the
       merge; if they form a cycle - I put B over A while they put C over B and A stays over C - it is an order conflict a person
       decides. Additions keep their place beside the neighbour they were added next to; a deletion stands. */
    const bo = ids(baseL), mo = ids(mineL), to = ids(theirL);
    const common = bo.filter(id => mo.indexOf(id) >= 0 && to.indexOf(id) >= 0);
    const pos = a => { const m = {}; a.forEach((id, i) => { m[id] = i; }); return m; };
    const pb = pos(bo), pm = pos(mo), pt = pos(to);
    const before = {}; common.forEach(x => { before[x] = []; });
    common.forEach((x, i) => common.slice(i + 1).forEach(y => {
      const b = pb[x] < pb[y], m = pm[x] < pm[y], t = pt[x] < pt[y];
      const want = m !== b ? m : t;          // x below y?
      if (want) before[y].push(x); else before[x].push(y);
    }));
    // a topological order of the common layers under those relations, ties broken by their order
    let core = []; const left = common.slice().sort((x, y) => pt[x] - pt[y]); let cyclic = false;
    while (left.length) { const k = left.findIndex(id => before[id].every(z => core.indexOf(z) >= 0)); if (k < 0) { cyclic = true; break; } core.push(left.splice(k, 1)[0]); }
    const commonOf = a => a.filter(id => common.indexOf(id) >= 0);
    if (cyclic) {
      conflicts.push({ id: 'layout:order', kind: 'order', key: 'order', label: 'the stacking order', base: commonOf(bo), mine: commonOf(mo), theirs: commonOf(to) });
      core = commonOf(to);                    // provisional: theirs until a person chooses
    }
    // additions: placed just above the layer below them in their own side's order (or at the bottom)
    const addFrom = (src, mark) => src.forEach((id, i) => {
      if (bo.indexOf(id) >= 0 || core.indexOf(id) >= 0) return;
      let k = i - 1; while (k >= 0 && core.indexOf(src[k]) < 0) k--;
      core.splice(k >= 0 ? core.indexOf(src[k]) + 1 : 0, 0, id); if (mark) mark.push(id);
    });
    addFrom(mo); addFrom(to);
    // a layer one side deleted and the other only kept is gone; anything else still standing goes on top
    let order = core.concat(all.filter(id => core.indexOf(id) < 0 && bo.indexOf(id) < 0));
    order = order.concat(all.filter(id => order.indexOf(id) < 0));
    layout.layers = order.map(id => chosen[id]).filter(Boolean);
    return { layout, copy, conflicts, clean: !conflicts.length, order };
  }

  /** apply a person's choices ({conflictId: 'mine'|'theirs'}, or one word for all) to a merge result */
  function resolve(m, base, mine, theirs, choices) {
    const pick = c => (typeof choices === 'string' ? choices : (choices && choices[c.id])) || 'theirs';
    const layout = Object.assign({}, m.layout); const copy = Object.assign({}, m.copy);
    let layers = (layout.layers || []).slice();
    m.conflicts.forEach(c => {
      const w = pick(c);
      if (c.kind === 'order') { const want = w === 'mine' ? c.mine : c.theirs; const keep = layers.filter(l => want.indexOf(idOf(l, 0)) >= 0).sort((a, b) => want.indexOf(idOf(a, 0)) - want.indexOf(idOf(b, 0))); let k = 0; layers = layers.map(l => (want.indexOf(idOf(l, 0)) >= 0 ? keep[k++] : l)); return; }
      if (c.kind === 'copy') { copy[c.key] = w === 'mine' ? c.mine : c.theirs; return; }
      if (c.kind === 'layout') { const v = w === 'mine' ? c.mine : c.theirs; if (v === undefined) delete layout[c.key]; else layout[c.key] = v; return; }
      const v = w === 'mine' ? c.mine : c.theirs;
      const i = layers.findIndex((l, n) => idOf(l, n) === c.key);
      if (v === undefined) { if (i >= 0) layers.splice(i, 1); }
      else if (i >= 0) layers[i] = v;
      else { const at = (m.order || []).indexOf(c.key); layers.splice(at >= 0 ? Math.min(at, layers.length) : layers.length, 0, v); }
    });
    layout.layers = layers;
    return { layout, copy };
  }

  /** what a saved version must contain for an edit to count as saved: every layer and field the edit meant */
  function contains(saved, intended) {
    if (!saved) return false;
    if (intended.layout && !same(saved.layout, intended.layout)) return false;
    const c = intended.copy || {}; return Object.keys(c).every(k => (saved.copy || {})[k] === c[k]);
  }

  /** a short, stable signature of a working edit (FNV-1a over its JSON) - for telling one edit from another, never security */
  function sig(x) { const s = J(x); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(36) + ':' + s.length; }

  /** the lock contract (S20), the same as the worker's ST_LOCK_FREE: a locked layer may change only its name and its lock; every
      other property is what the artwork draws. Returns the protected properties a patch would change on a locked layer. */
  const LOCK_FREE = ['name', 'renamed', 'locked'];
  function lockedChanges(layer, patch) {
    if (!layer || !layer.locked || !patch) return [];
    if (patch.locked === false && Object.keys(patch).every(k => LOCK_FREE.indexOf(k) >= 0)) return [];
    return Object.keys(patch).filter(k => LOCK_FREE.indexOf(k) < 0 && !same(layer[k], patch[k]));
  }
  const api = { merge, resolve, contains, sig, same, LOCK_FREE, lockedChanges };
  root.STMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
