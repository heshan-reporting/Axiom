/* The worker's side of the one scene representation (S3): the safe-area table the worker places marks by is the renderer's,
 * and the re-judging of a browser report carries the local contrast, the marks' visible bounds and the unresolved analyses,
 * so a report that could not read its pixels never passes on the server. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s3-worker.mjs */
import fs from 'node:fs';
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s3-worker (safe areas shared, re-judged local contrast, visible mark bounds, unresolved pixels)');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
const { safeAreaOf, stSafeInset, stValidationJudge, layoutRules } = w.mod.__test;

await T.t('the worker places marks by the renderer\'s safe-area table (one source, a placement margin on top)', async () => {
  eq(safeAreaOf('9:16', 'instagram'), { top: 0.14, bottom: 0.2, side: 0.06, hard: true }); eq(safeAreaOf('1:1'), { top: 0.03, bottom: 0.03, side: 0.03, hard: false });
  const story = stSafeInset('9:16'), feed = stSafeInset('1:1');
  ok(story.top >= 14 && story.bottom >= 20 && story.side >= 6, 'a story mark sits clear of the interface: ' + JSON.stringify(story));
  ok(feed.top >= 3 && feed.side >= 3 && feed.top <= 5 && feed.side <= 6, 'a feed mark sits just inside the margin: ' + JSON.stringify(feed));
  const R = fs.readFileSync(new URL('../docs/studio-render.js', import.meta.url), 'utf8');
  ok(/function safeAreaOf\(format, channel\)/.test(R), 'the renderer carries the same function inside the RULES block');
});
await T.t('the shared rules read local contrast, visible mark bounds and the unresolved analyses', async () => {
  const base = { id: 'headline', role: 'headline', type: 'text', hidden: false, valid: true, overlaps: [], x: 100, y: 500, w: 800, h: 150, ax: 100, ay: 500, aw: 800, ah: 150, lines: 2, chars: 20, px: 70, contentH: 150, overflowH: false, overflowW: false, broken: false, contrast: 7 };
  const codes = (bx, o) => layoutRules(bx, Object.assign({ W: 1080, H: 1080, format: '1:1', channel: 'instagram', production: true }, o || {})).map(i => i.code + '/' + i.severity + ':' + i.layers.join(','));
  ok(!codes([base]).length, 'the plain headline passes');
  ok(codes([Object.assign({}, base, { contrastMin: 1.2 })]).some(c => /^patchy_contrast\/blocking:headline/.test(c)), 'a bright patch under the words is blocking');
  ok(codes([Object.assign({}, base, { contrastMin: 2.0 })]).some(c => /^patchy_contrast\/warning:headline/.test(c)), 'a weaker patch is a warning');
  const mark = { id: 'wordmark', role: 'wordmark', type: 'img', mark: true, asset: 'loaded', hidden: false, valid: true, overlaps: [], x: 760, y: 900, w: 60, h: 40, ax: 700, ay: 880, aw: 300, ah: 80, vx: 760, vy: 900, vw: 60, vh: 40, markFill: 0.1, contrast: 6 };
  const mc = codes([base, mark]); ok(mc.some(c => /^mark_padding\/warning:wordmark/.test(c)) && mc.some(c => /^mark_small\/warning:wordmark/.test(c)), 'padding and a small mark are reported from the visible bounds: ' + mc.join(', '));
  ok(codes([], { unresolved: ['contrast', 'occlusion'] }).some(c => /^pixels_unmeasured\/blocking/.test(c)), 'unresolved pixel analysis blocks');
});
await T.t('a report whose pixels could not be read, or whose mark bounds are outside its box, cannot pass the re-judging', async () => {
  const P = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Judge', brief: { objective: 'o', message: 'm' }, idem: 's3-j' }, 'full-key')).body.id;
  const A = (await w.call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'T', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.' }, mode: 'composition' }, 'full-key')).body.asset;
  const v = A.versions.find(x => x.id === A.current); const L = v.layout; const W = L.stage.w, H = L.stage.h;
  const box = l => { const b = { id: l.id, role: l.role, type: l.type, ax: l.x / 100 * W, ay: l.y / 100 * H, aw: l.w / 100 * W, ah: (l.h || 0) / 100 * H }; b.x = b.ax; b.y = b.ay; b.w = b.aw; b.h = b.ah; if (l.type === 'text') { const text = l.role === 'headline' ? v.copy.headline : l.role === 'support' ? v.copy.support : (l.text || ''); b.chars = text.length; b.px = l.size / 100 * W; b.lines = Math.max(1, Math.ceil(text.length * b.px * 0.5 / b.aw)); b.contentH = b.lines * b.px * 1.12; b.contrast = 12; b.contrastMin = 9; } if (l.type === 'img') { b.asset = 'loaded'; b.src = l.src; b.mark = /logo|wordmark/.test(l.role); b.contrast = 8; } return b; };
  const rep = { renderer: 'test', W, H, production: true, fonts: { fallback: [], roles: {} }, boxes: L.layers.filter(l => !l.hidden).map(box) };
  const j0 = stValidationJudge(A, v, rep); eq(j0.problems, [], 'the honest report describes this version'); ok(!j0.issues.some(i => i.severity === 'blocking' && i.code !== 'imagery_missing'), 'and nothing but the missing imagery blocks: ' + j0.issues.map(i => i.code).join(', '));
  const hl = rep.boxes.find(b => b.role === 'headline');
  const j1 = stValidationJudge(A, v, Object.assign({}, rep, { boxes: rep.boxes.map(b => b === hl ? Object.assign({}, b, { contrastMin: 1.1 }) : b) }));
  ok(!j1.ok && j1.issues.some(i => i.code === 'patchy_contrast' && i.severity === 'blocking'), 'a patchy headline fails the re-judging');
  const j2 = stValidationJudge(A, v, Object.assign({}, rep, { unresolved: ['contrast'] }));
  ok(!j2.ok && j2.issues.some(i => i.code === 'pixels_unmeasured'), 'a report that says its pixels were not read is not a pass: ' + j2.issues.map(i => i.code).join(', '));
  const j3 = stValidationJudge(A, v, Object.assign({}, rep, { boxes: rep.boxes.map(b => b === hl ? Object.assign({}, b, { contrast: undefined, contrastMin: undefined }) : b) }));
  ok(!j3.ok && j3.issues.some(i => i.code === 'pixels_unmeasured'), 'a text box reported with no contrast at all is unmeasured, not clean: ' + j3.issues.map(i => i.code).join(', '));
  const mk = rep.boxes.find(b => b.mark);
  if (mk) {
    const j4 = stValidationJudge(A, v, Object.assign({}, rep, { boxes: rep.boxes.map(b => b === mk ? Object.assign({}, b, { vx: mk.ax - 400, vy: mk.ay, vw: 50, vh: 20, markFill: 0.2 }) : b) }));
    ok(j4.problems.some(p => /visible bounds/.test(p)), 'visible bounds outside the mark\'s box are refused as a report of another layout: ' + j4.problems.join(' | '));
  }
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
