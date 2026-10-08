/* S23 slices G-I on the worker (providers MOCKED): what the redesigned workspace reads.
 *   G1 the library lists each recent project's lead composition (layout, words, imagery by the access-controlled file
 *      route) and its counts of visual and copy pieces; another client's projects never appear; the imagery route refuses a
 *      request without a key.
 * Run: node --experimental-sqlite tests/studio-s23g-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s23g-worker (library thumbnails and what the workspace reads)');
const png = byte => Buffer.from('89504e470d0a1a0a' + byte.repeat(100), 'hex').toString('base64');
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g', STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k === undefined ? 'full-key' : k);
w.answer(/generativelanguage/, async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ inlineData: { mimeType: 'image/png', data: png('00') } }] } }] }), { status: 200 }));
const LAYOUT = { v: 5, format: '4:5', stage: { w: 1080, h: 1350 }, medium: 'editorial', approach: 'editable', regions: [], layers: [{ id: 'hl', type: 'text', role: 'headline', x: 8, y: 60, w: 80, h: 14, size: 6, color: '#FFFFFF' }] };

await T.t('G1 the library carries each recent project\'s lead composition and counts; imagery only through the keyed file route; no other client', async () => {
  await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel' }] });
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Library lead', brief: { channels: ['instagram'] } })).body.id;
  await call('POST', '/studio/asset', { project: P, family: 'C', channel: 'x', format: '16:9', title: 'Copy only', copy: { headline: 'Words', caption: 'A post' }, mode: 'copy' });
  const A = (await call('POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '4:5', title: 'Portrait', copy: { headline: 'Not a subsidy' }, layout: LAYOUT, mode: 'composition' })).body.asset.id;
  const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'render', input: { prompt: 'a road', region: 'bg', aspect: '4:5' }, idem: 'g1' })).body.job;
  eq((await call('POST', '/studio/job/step', { id: j.id })).body.job.state, 'done');
  await call('POST', '/studio/project', { ns: 'aep', title: 'AEP project', brief: {} });
  const l = (await call('GET', '/studio/list?ns=mca', null, 'read-key')).body;
  const pr = l.projects.find(x => x.id === P); ok(pr && pr.lead, 'the lead composition is listed: ' + JSON.stringify(pr && Object.keys(pr)));
  eq([pr.lead.asset, pr.lead.format, pr.lead.mode, pr.lead.copy.headline], [A, '4:5', 'composition', 'Not a subsidy']);
  ok(pr.lead.layout && Array.isArray(pr.lead.layout.layers), 'with the layout the renderer draws');
  ok(pr.lead.image && /^\/studio\/file\?key=studio%2F/.test(pr.lead.image.url), 'imagery by the keyed file route: ' + JSON.stringify(pr.lead.image));
  eq(pr.pieces, { visual: 1, copy: 1 });
  ok(!l.projects.some(x => x.title === 'AEP project'), 'no other client\'s project');
  const key = decodeURIComponent(pr.lead.image.url.split('key=')[1]);
  eq((await call('GET', '/studio/file?key=' + encodeURIComponent(key), null, null)).status, 401, 'no key, no imagery');
  eq((await call('GET', '/studio/file?key=' + encodeURIComponent(key), null, 'read-key')).status, 200, 'a read key may see it');
});

T.done(); w.restore();
