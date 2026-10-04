/* The worker's side of the S1 defects: the placement inference reads negations, the reference text carries the words
 * and addresses the analysis extracted, and the worker's re-judging of a browser report carries the visibility and
 * occlusion evidence (so a composition the browser fails cannot pass on the server). Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s1-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s1-worker (placement negation, reference words, re-judged visibility and occlusion)');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
const { stMarkPlacement, stRefLine, stValidationJudge, layoutRules } = w.mod.__test;
const ref = (name, logo, purpose) => ({ id: 'r_' + name, name, purpose: purpose || 'approved', analysis: { summary: 's', logo } });

await T.t('placement inference: "No logo at bottom left. Wordmark sits top right." places the mark top right, not bottom left', async () => {
  const p = stMarkPlacement([ref('a', 'No logo at bottom left. Wordmark sits top right.')]);
  eq([p.corner, p.basis], ['tr', 'observed'], JSON.stringify(p));
  ok(!/bottom left/.test(p.text) || /others differ/.test(p.text) === false, 'the negated corner is not counted: ' + p.text);
});
await T.t('placement inference: other negations and contrasts read the same way', async () => {
  eq(stMarkPlacement([ref('b', 'Logo bottom right; not in the top-left corner')]).corner, 'br');
  eq(stMarkPlacement([ref('c', 'The wordmark is not in the bottom-left corner but top right, small')]).corner, 'tr');
  eq(stMarkPlacement([ref('d', 'Wordmark sits lower right rather than upper left')]).corner, 'br');
  eq(stMarkPlacement([ref('e', 'No logo visible')]).basis, 'default', 'no logo at all is no observation');
  eq(stMarkPlacement([ref('f', 'Small logo, top left')]).corner, 'tl');
  eq(stMarkPlacement([ref('g', 'Logo centred at the top, never bottom right')]).basis, 'default', 'a centred mark is no corner vote');
  const two = stMarkPlacement([ref('h', 'Logo bottom right'), ref('i', 'Wordmark top right'), ref('j', 'Logo bottom right')]);
  eq(two.corner, 'br'); ok(/others differ: top right/.test(two.text), two.text);
});
await T.t('the reference text the models receive carries the words the analysis extracted, addresses included', async () => {
  const line = stRefLine({ id: 'r1', name: 'HOOF approved tile', purpose: 'approved' }, { summary: 'A dark tile with a gold kicker.', typography: 'bold grotesque', colour: { palette: ['#0E6A6E'], relationships: 'teal ground' }, logo: 'wordmark bottom right', text: ['HANDS OFF OUR FUEL', 'Fuel tax credits are not a subsidy', 'handsoffourfuel.com.au'], takeaways: ['gold kicker'] });
  ok(/handsoffourfuel\.com\.au/.test(line) && /HANDS OFF OUR FUEL/.test(line), 'the words and the address are in the line: ' + line.slice(0, 400));
  ok(/Words on it|Text:/.test(line), 'they are labelled as the words on the reference');
  const none = stRefLine({ id: 'r2', name: 'Mood', purpose: 'mood' }, { summary: 'A field at dawn.', text: [] });
  ok(!/Words on it|Text:/.test(none), 'a reference with no words carries no empty label');
});
await T.t('the shared rules judge visibility and occlusion from the measured evidence', async () => {
  const base = { id: 'headline', role: 'headline', type: 'text', hidden: false, valid: true, overlaps: [], x: 100, y: 500, w: 800, h: 150, ax: 100, ay: 500, aw: 800, ah: 150, lines: 2, chars: 20, px: 70, contentH: 150, overflowH: false, overflowW: false, broken: false };
  const codes = bx => layoutRules(bx, { W: 1080, H: 1080, format: '1:1', channel: 'instagram', production: true }).filter(i => i.severity === 'blocking').map(i => i.code + ':' + i.layers.join(','));
  eq(codes([base]), [], 'the plain headline passes');
  ok(codes([Object.assign({}, base, { opacity: 0 })]).some(c => /^invisible:headline/.test(c)), 'opacity 0 is invisible');
  ok(codes([Object.assign({}, base, { occluded: 0.9, occludedBy: ['panel2'] })]).some(c => /^occluded:headline,panel2/.test(c)), 'a 90% covered headline is occluded, with the covering layer named');
  eq(codes([Object.assign({}, base, { occluded: 0.03 })]), [], 'a 3% overlap is not');
  eq(codes([Object.assign({}, base, { occluded: 0.9, overlaps: ['panel2'], occludedBy: ['panel2'] })]), [], 'an explicit overlaps exception on that pair allows it');
});
await T.t('a browser report that says the words are invisible or covered cannot pass the worker\'s re-judging', async () => {
  const P = (await w.call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Judge', brief: { objective: 'o', message: 'm' }, idem: 's1-j' }, 'full-key')).body.id;
  const A = (await w.call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'T', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.' }, mode: 'composition' }, 'full-key')).body.asset;
  const v = A.versions.find(x => x.id === A.current); const L = v.layout; const W = L.stage.w, H = L.stage.h;
  // an honest report of this version's geometry, then the same with the headline reported at opacity 0 / covered
  const box = l => { const b = { id: l.id, role: l.role, type: l.type, ax: l.x / 100 * W, ay: l.y / 100 * H, aw: l.w / 100 * W, ah: (l.h || 0) / 100 * H }; b.x = b.ax; b.y = b.ay; b.w = b.aw; b.h = b.ah; if (l.type === 'text') { const text = l.role === 'headline' ? v.copy.headline : l.role === 'support' ? v.copy.support : (l.text || ''); b.chars = text.length; b.px = l.size / 100 * W; b.lines = Math.max(1, Math.ceil(text.length * b.px * 0.5 / b.aw)); b.contentH = b.lines * b.px * 1.12; b.contrast = 12; } if (l.type === 'img') { b.asset = 'loaded'; b.src = l.src; b.mark = /logo|wordmark/.test(l.role); b.contrast = 8; } return b; };
  const rep = { renderer: 'test', W, H, production: true, fonts: { fallback: [], roles: {} }, boxes: L.layers.filter(l => !l.hidden).map(box) };
  const j0 = stValidationJudge(A, v, rep); eq(j0.problems, [], 'the honest report describes this version');
  const hl = rep.boxes.find(b => b.role === 'headline');
  const j1 = stValidationJudge(A, v, Object.assign({}, rep, { boxes: rep.boxes.map(b => b === hl ? Object.assign({}, b, { opacity: 0 }) : b) }));
  ok(j1.issues.some(i => i.code === 'invisible' && i.severity === 'blocking'), 'invisible words fail the re-judging: ' + j1.issues.map(i => i.code).join(', '));
  const j2 = stValidationJudge(A, v, Object.assign({}, rep, { boxes: rep.boxes.map(b => b === hl ? Object.assign({}, b, { occluded: 0.8, occludedBy: ['panel'] }) : b) }));
  ok(j2.issues.some(i => i.code === 'occluded' && i.severity === 'blocking'), 'covered words fail the re-judging: ' + j2.issues.map(i => i.code).join(', '));
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
