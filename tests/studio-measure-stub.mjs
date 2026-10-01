/* A measurement report for worker-only harnesses, which have no browser: text is wrapped by character counts with the
 * same factors as the worker's own estimate, every image layer that names a file counts as loaded, and nothing is
 * claimed about fonts beyond "fallback unknown". It stands in for docs/studio-render.js validate() + report(); the real
 * renderer is exercised by tests/studio-layout-browser.mjs. A report built here passes the worker's plausibility checks
 * only because it describes the version honestly at its output size. */
export function stubReport(version, asset, opts) {
  opts = opts || {}; const L = version.layout || {}; const st = L.stage || { w: 1080, h: 1080 }; const W = st.w, H = st.h;
  const copy = version.copy || {}; const baked = Array.isArray(L.baked) ? L.baked : [];
  const boxes = (L.layers || []).map((l, i) => {
    const id = String(l.id || ('layer' + i)); const b = { id, role: l.role || '', type: l.type, hidden: !!l.hidden, ax: l.x / 100 * W, ay: l.y / 100 * H, aw: l.w / 100 * W, ah: (l.h || 0) / 100 * H };
    b.x = b.ax; b.y = b.ay; b.w = b.aw; b.h = b.ah;
    if (l.hidden) return b;
    if (l.type === 'text') {
      const t = l.role && baked.indexOf(l.role) >= 0 ? '' : String((l.role && l.role !== 'free' && copy[l.role] != null ? copy[l.role] : l.text) || '');
      if (!t) return Object.assign(b, { empty: true });
      const px = l.size / 100 * W; const per = Math.max(4, Math.floor((b.aw - (l.bg ? px * 1.6 : 0)) / (px * (l.role === 'headline' ? 0.52 : 0.48))));
      let lines = 1, cur = 0; t.split(/\s+/).filter(Boolean).forEach(w => { if (cur && cur + 1 + w.length > per) { lines++; cur = w.length; } else cur = cur ? cur + 1 + w.length : w.length; });
      const contentH = lines * px * 1.12 + (l.bg ? px * 0.9 : 0);
      Object.assign(b, { lines, chars: t.length, px, contentH, h: Math.max(contentH, 1), overflowH: !!(b.ah && contentH > b.ah + 0.5), contrast: opts.contrast != null ? opts.contrast : 7 });
    } else if (l.type === 'img') { b.mark = l.role === 'logo' || l.role === 'wordmark'; b.asset = l.src ? 'loaded' : (b.mark ? 'missing' : 'sketch'); b.src = l.src || ''; if (b.mark) b.contrast = opts.markContrast != null ? opts.markContrast : 6; }
    return b;
  });
  return { renderer: 'stub', W, H, production: true, fonts: { roles: {}, fallback: [] }, boxes };
}
/** Measure the asset's current version (as a browser would) and file the report; returns the worker's answer. */
export async function validateAsset(req, project, assetId, opts) {
  const g = await req('GET', '/studio/get?id=' + project);
  const asset = g.d && g.d.assets ? g.d.assets.find(x => x.id === assetId) : null;
  if (!asset) throw new Error('validateAsset: asset ' + assetId + ' not found in project ' + project);
  const v = asset.versions.find(x => x.id === asset.current);
  return req('POST', '/studio/validation', { asset: assetId, version: v.id, report: stubReport(v, asset, opts), imageB64: opts && opts.png });
}
