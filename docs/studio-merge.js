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
    // the order: mine if they did not reorder, theirs if I did not, else theirs with my additions kept
    const bo = ids(baseL), mo = ids(mineL), to = ids(theirL);
    const common = a => a.filter(id => bo.indexOf(id) >= 0);
    let order;
    if (same(common(to), common(bo))) order = mo.concat(to.filter(id => mo.indexOf(id) < 0 && bo.indexOf(id) < 0));
    else if (same(common(mo), common(bo))) order = to.concat(mo.filter(id => to.indexOf(id) < 0 && bo.indexOf(id) < 0));
    else order = to.concat(mo.filter(id => to.indexOf(id) < 0));
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

  const api = { merge, resolve, contains, sig, same };
  root.STMerge = api;
})(typeof window !== 'undefined' ? window : globalThis);
