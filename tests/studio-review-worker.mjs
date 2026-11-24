/* A review that does the work, on the worker (the 25 November report: a review of an Instagram portrait named "three unapproved
 * caption paragraphs in the lower band" as blocking while the measurement passed, and its correction was a sentence for the team
 * to carry out). Providers MOCKED; nothing is spent.
 *   RV1 the reviewer is told what is ON the tile layer by layer, with each layer's id, and the post caption apart from a caption
 *       layer drawn on the tile, so an issue names the layer it is about and the two are never confused
 *   RV2 applying a correction that names a layer sends that layer to the revise stage as the scope: the fix changes it and leaves
 *       the rest, as an edit made with the layer selected does
 *   RV3 the apply answers which asset and version the correction started from, so the page can tell whether it changed the tile
 * Run: node --experimental-sqlite tests/studio-review-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
import { pngGradientB64 } from './worker-png.mjs';
const T = suite('studio-review-worker (the reviewer reads the tile by layer; a correction is scoped to its layer)');
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' } }, env: { STUDIO_INSPECT: '0', ANTHROPIC_API_KEY: 'a', GEMINI_KEY: 'g' } });
const call = (m, p, b) => w.call(m, p, b, 'full-key');
const seen = { inspect: [], revise: [] };
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  let ans;
  if (/^You are the art director inspecting/.test(sys)) { seen.inspect.push(user);
    ans = { fidelity: 4, hierarchy: 2, readability: 4, relevance: 4, identity: 4, reasons: { hierarchy: 'body copy crowds the lower band' }, words: { present: ['Gas keeps the lights on'], wrong: [], missing: [] },
      issues: [{ text: 'Three paragraphs of body copy crowd the lower band', severity: 'blocking', element: 'band' }], verdict: 'fix',
      fix: { kind: 'design', element: 'band', instruction: 'Remove the body copy in the lower band; keep the headline and support where they are.', keeps: 'the headline, the support and the photograph' } };
  } else { if (/INSTRUCTION FROM THE TEAM LEAD/.test(user)) seen.revise.push(user); ans = answerFor(sys, user); }
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(ans) }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }), { status: 200 });
});
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;
const step = async j => { let jj = j; for (let i = 0; i < 8 && !/done|failed|cancelled/.test(jj.state); i++) jj = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return jj; };
await call('POST', '/brand/kit', { ns: 'aep', name: 'Australian Energy Producers', palette: { primary: '#0B3D5C' }, campaigns: [{ id: 'gas', name: 'Gas', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'aep', campaign: 'gas', title: 'Review', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
const lay = { v: 5, stage: { w: 1080, h: 1350 }, layers: [
  { id: 'hl', role: 'headline', type: 'text', x: 8, y: 10, w: 80, h: 14, size: 7 },
  { id: 'sp', role: 'support', type: 'text', x: 8, y: 26, w: 80, h: 8, size: 3 },
  { id: 'band', role: 'caption', type: 'text', text: 'Gas plants keep factories running. Ports load it. Towns depend on it.', x: 8, y: 70, w: 84, h: 18, size: 2.6 },
  { id: 'shape1', type: 'shape', shape: 'rect', x: 0, y: 66, w: 100, h: 34, fill: '#0B3D5C' }] };
await w.env.MIND_DOCS.put('studio/fx/rv.png', Buffer.from(pngGradientB64(32, 40), 'base64'), { httpMetadata: { contentType: 'image/png' } });
const A = (await call('POST', '/studio/asset', { project: P, channel: 'instagram', format: '4:5', title: 'Instagram portrait', copy: { headline: 'Gas keeps the lights on', support: 'From the plant to the port to the main street.', caption: 'The post caption: read more at the link.' }, layout: lay, mode: 'composition', image: { key: 'studio/fx/rv.png', url: '/studio/file?key=studio/fx/rv.png', model: 'test', size: '1K' } })).body.asset;
let ins = null;

await T.t('RV1: the reviewer is told what is on the tile layer by layer, with ids, and the post caption apart', async () => {
  const j = (await call('POST', '/studio/job', { project: P, asset: A.id, stage: 'inspect', input: { version: A.current }, idem: 'rv-1' })).body.job;
  const jj = await step(j); eq(jj.state, 'done', JSON.stringify(jj.error || '').slice(0, 300));
  const u = seen.inspect.pop() || '';
  ok(/layer hl\b/.test(u) && /layer sp\b/.test(u) && /layer band\b/.test(u), 'every text on the tile is named with its layer id: ' + (u.match(/APPROVED WORDS[^\n]*/) || [''])[0].slice(0, 400));
  ok(/ON THE TILE/.test(u) && /Gas plants keep factories running/.test(u), 'the caption layer drawn on the tile is listed as on the tile');
  ok(/POST CAPTION[^\n]*not on the tile/i.test(u) && /The post caption: read more/.test(u), 'and the post caption is listed apart, as posted beside the tile');
  ok(!/The caption is posted beside the tile, not on it\./.test(u), 'the old line that made a caption layer on the tile read as a mistake is gone');
  ok(/layer id[^\n]*element|element[^\n]*layer id/i.test(u), 'the reviewer is asked to name the layer id an issue is about');
  ins = (await get(P)).thread.filter(e => e.kind === 'inspection' && e.asset === A.id).pop();
  eq([ins.issues[0].element, ins.issues[0].layers, ins.fix.layers], ['band', ['band'], ['band']], 'the finding and its correction name the band layer');
});

await T.t('RV2: applying a correction that names a layer scopes the revise to that layer', async () => {
  const r = await call('POST', '/studio/inspection/apply', { project: P, eid: ins.eid }); eq(r.status, 200, r.text);
  const job = (await call('GET', '/studio/job?id=' + r.body.job)).body.job; ok(job, 'the fix is a job');
  eq((job.input || {}).layers, ['band'], 'the job carries the layer the review named');
  const jj = await step(job); ok(/done|failed/.test(jj.state), 'the revise ran: ' + jj.state);
  const u = seen.revise.pop() || ''; ok(/SELECTED IN THE EDITOR: band/.test(u), 'the revise is told the correction is about the band layer: ' + u.slice(0, 200));
});

await T.t('RV3: the apply says which asset and version the correction started from', async () => {
  const B = (await call('POST', '/studio/asset', { project: P, channel: 'facebook', format: '1:1', title: 'Facebook square', copy: { headline: 'Gas keeps the lights on' }, layout: lay, mode: 'composition', image: { key: 'studio/fx/rv.png', url: '/studio/file?key=studio/fx/rv.png', model: 'test', size: '1K' } })).body.asset;
  const j = (await call('POST', '/studio/job', { project: P, asset: B.id, stage: 'inspect', input: { version: B.current }, idem: 'rv-3' })).body.job; await step(j);
  const i2 = (await get(P)).thread.filter(e => e.kind === 'inspection' && e.asset === B.id).pop();
  const r = await call('POST', '/studio/inspection/apply', { project: P, eid: i2.eid }); eq(r.status, 200, r.text);
  eq([r.body.asset, r.body.from], [B.id, B.current], 'the asset and the version it started from');
});

const r = T.done(); w.restore(); process.exit(r.fail ? 1 : 0);
