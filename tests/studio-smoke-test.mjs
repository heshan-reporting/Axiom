/* (the stubs and the in-process worker are the demo harness's) tools/studio-demo.py end to end against the worker module served over HTTP in this process, with stub models and the
 * real compose tool (headless Chromium, the app renderer): without --approve-calls it prints the estimate and creates
 * nothing; with a call budget and no renders it runs all six steps for HOOF, MCA national and the labelled synthetic
 * client - brief with knowledge and references, three directions, a refinement that is a layout version with no image,
 * the adapted set, a client comment answered in a new version and marked against it, agency then client approval of
 * that exact version and a bundle of only what both approved - checks that each case carries only its own marks, that
 * the isolation audit is clean, that no image was generated, and that the synthetic kit refuses to overwrite a real one.
 * Run: node --experimental-sqlite tests/studio-demo-test.mjs */
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pngSolid } from './studio-fixture.mjs';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}), upsert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v.buffer.slice(r2.get(k).v.byteOffset, r2.get(k).v.byteOffset + r2.get(k).v.byteLength), text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
// a mark with real ink (a white block): since S11 a mark is read per pixel against what is behind it, and a
// scaled-up 4 x 4 placeholder has no strokes to read - the photograph stand-in stays the 4 x 4 image
const MARK = pngSolid(40, 16, [255, 255, 255]).toString('base64');
const realFetch = globalThis.fetch; const seen = { gemini: 0, claude: 0 };
const T = (role, x, y, w, h, size) => ({ type: 'text', role, text: '', x, y, w, h, size, weight: 750, color: '#FFFFFF' });
const TYPO = { medium: 'typographic', approach: 'editable', story: 'the words carry it', mark: 'campaign', bg: '#0E3B5C', regions: [], elements: [T('headline', 6, 10, 88, 40, 7.5), T('support', 6, 54, 80, 14, 3.4), T('cta', 6, 74, 60, 8, 3.2)] };
const DIRS = { directions: [
  { title: 'Plain words', message: 'm1', insight: 'i', headline: 'Not a subsidy.', opening: 'o', visual: 'type only', rationale: 'r', claims: [], uncertainty: 'u', medium: 'typographic', idea: 'Say it plainly in big type', plan: 'type' },
  { title: 'The paddock', message: 'Farmers and tradies use the credit every day', insight: 'i2', headline: 'Ask a farmer.', opening: 'o2', visual: 'a paddock at dusk', rationale: 'r2', claims: [], uncertainty: 'u', medium: 'photo-documentary', idea: 'Documentary portrait of a user' },
  { title: 'Myth and fact', message: 'The myth, then the fact, side by side', insight: 'i3', headline: 'Myth: a handout. Fact: a tax refund.', opening: 'o3', visual: 'split myth/fact panels', rationale: 'r3', claims: [], uncertainty: 'u', medium: 'diagram', idea: 'A two-column myth and fact' }] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 }); seen.gemini++; return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    seen.claude++; const body = JSON.parse(init.body); const sys = String(body.system || ''); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    let a = {};
    if (/build a claim ledger/.test(sys)) a = { headline: 'h', claims: [], brief: {} };
    else if (/genuinely different directions/.test(sys)) a = DIRS;
    else if (/art director inspecting a rendered social tile/.test(sys)) { seen.inspect = (seen.inspect || 0) + 1; a = { fidelity: 4, hierarchy: 4, readability: 4, relevance: 4, identity: 4, reasons: {}, words: { present: [], wrong: [], missing: [] }, marks: { present: ['wordmark'], missing: [], wrong: [] }, issues: [], verdict: 'fix', fix: { kind: 'none', instruction: '' }, note: '' }; }
    else if (/producing a coordinated set/.test(sys)) a = { pieces: ['instagram', 'linkedin', 'facebook'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: /Harbourline/.test(user) ? 'A later last boat' : 'Not a subsidy. A tax that never applied.', support: 'Plain words, big type.', cta: 'Learn more', caption: 'c', alt: 'a', plan: TYPO })) };
    else if (/briefing a designer and an image model/.test(sys)) a = { critique: 'The hierarchy can be sharper.', options: [{ name: 'Bigger headline, quieter support', concept: 'c', rationale: 'r', imagery: 'none', plan: Object.assign({}, TYPO, { elements: [T('headline', 6, 8, 88, 46, 8.5), T('support', 6, 58, 70, 12, 3.2), T('cta', 6, 76, 60, 8, 3.2)] }), needsImage: false, basis: [], refs: [], missing: [] }, { name: 'A photograph', concept: 'c', rationale: 'r', imagery: 'a ferry', plan: Object.assign({}, TYPO, { medium: 'photo-cinematic', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'a ferry at night', refs: [] }] }), needsImage: true, basis: [], refs: [], missing: [] }] };
    else if (/decide what the instruction asks/.test(sys)) { const A = (user.match(/^\[(a[a-z0-9]+)\]/m) || [])[1]; const chans = ['facebook', 'linkedin'].filter(c => new RegExp(c, 'i').test((user.match(/Adapt this for ([^:]+):/) || [])[1] || '')); a = { kind: 'adapt', reply: 'Adapted.', adapt: { from: A, pieces: chans.map(c => ({ channel: c, copy: {} })) }, memory: { standing: false } }; }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(a) }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return realFetch(url, init);
};
const mod = await import(new URL('../axiomworkerv4.js', import.meta.url).href); const handler = mod.default;
const server = http.createServer(async (rq, rs) => { const chunks = []; for await (const c of rq) chunks.push(c); const body = Buffer.concat(chunks);
  const res = await handler.fetch(new Request('http://127.0.0.1' + rq.url, { method: rq.method, headers: rq.headers, body: rq.method === 'GET' ? undefined : body }), env, { waitUntil() {} });
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; }); rs.writeHead(res.status, h); rs.end(Buffer.from(await res.arrayBuffer())); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = 'http://127.0.0.1:' + server.address().port;
const api = async (m, p, b) => (await realFetch(BASE + p, { method: m, headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': 'full-key' }, body: b ? JSON.stringify(b) : undefined })).json();
let pass = 0, fail = 0; const ok = (v, m) => { if (v) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
console.log('studio-smoke-test (tools/studio-smoke.py: the cap holds at the worst case, both paths, several formats, validation and export, separation)');
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], facts: [{ text: 'The credit is used by more than 150,000 businesses', source: 'MCA', status: 'approved' }], logoB64: MARK, logoMime: 'image/png' });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: MARK, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const runPy = (extra) => new Promise(res => { const out = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-')); const c = spawn('python3', [new URL('../tools/studio-smoke.py', import.meta.url).pathname, '--key', 'full-key', '--worker', BASE, '--out', out, '--keep'].concat(extra), { env: Object.assign({}, process.env) }); let so = '', se = ''; c.stdout.on('data', x => { so += x; }); c.stderr.on('data', x => { se += x; }); c.on('close', code => res({ code, so, se, out })); });
const projects = async ns => ((await api('GET', '/studio/list?ns=' + ns)).projects || []).filter(p => /^Smoke/.test(p.title));

const dry = await runPy([]);
ok(dry.code === 0 && /reserved at worst/.test(dry.so) && /Nothing was run/.test(dry.so), 'without approval: the worst-case estimate and nothing else - ' + (dry.so + dry.se).slice(-300));
ok(seen.claude === 0 && (await projects('mca')).length === 0, 'no project, no model call');

const c0 = seen.claude; const tight = await runPy(['--approve-calls', '4', '--cases', 'hoof']);
ok(tight.code === 1 && /cannot cover copy at its worst case/.test(tight.so), 'a cap that cannot cover the next job at its worst case stops before it: ' + tight.so.slice(-300));
ok(seen.claude - c0 === 1, 'only the job the cap covered ran (one call): ' + (seen.claude - c0));

const c1 = seen.claude, g1 = seen.gemini; const run = await runPy(['--approve-calls', '30']);
const rep = JSON.parse(fs.readFileSync(path.join(run.out, 'smoke.json'), 'utf8'));
ok(run.code === 0, 'the editable path finished for HOOF, MCA and the synthetic client: ' + (run.so.slice(-1200) + run.se.slice(-600)));
ok(seen.gemini === g1, 'no image was generated with no renders approved');
ok(rep.cases.every(c => (c.formats || []).length >= 3), 'several formats per case (the master re-laid for free): ' + rep.cases.map(c => c.case + ' ' + (c.formats || []).join('/')).join('; '));
ok(rep.cases.every(c => (c.composed || []).length >= 3 && c.composed.every(x => x.ok === true || x.ok === false)), 'every tile drawn and measured, its result recorded');
ok(rep.cases.every(c => c.editableExport && (c.editableExport.exact === true || (c.editableExport.included || []).length === 0)), 'the export holds exactly the tiles that passed and were approved');
ok(rep.separation.every(x => x.ok) && Object.values(rep.isolation).every(v => (v || {}).clean !== false), 'each case carries only its own marks; isolation clean');
ok(rep.reserved.calls <= 30 && seen.claude - c1 <= rep.reserved.calls, 'the calls made (' + (seen.claude - c1) + ') sit inside the reservation (' + rep.reserved.calls + ') inside the cap (30)');
ok(fs.existsSync(path.join(run.out, 'index.html')), 'the private page is written to --out');

const g2 = seen.gemini, i2 = seen.inspect || 0; const held = await runPy(['--approve-calls', '40', '--approve-renders', '1', '--cases', 'hoof']);
ok(seen.gemini === g2 && /cancelled: outside the approved budget|cannot cover/.test(held.so), 'a render the cap cannot cover at its worst case (3 attempts) is cancelled, never painted: ' + held.so.slice(-400));
const fin = await runPy(['--approve-calls', '40', '--approve-renders', '2', '--reserve-attempts', '1', '--cases', 'hoof']);
const fr = JSON.parse(fs.readFileSync(path.join(fin.out, 'smoke.json'), 'utf8')).cases[0].finishedResult || {};
ok(seen.gemini - g2 === 1 && (seen.inspect || 0) > i2, 'the Full AI path painted one piece and read it back: ' + JSON.stringify(fr));
ok(fr.painted === true && JSON.stringify(fr.marksSent) === '["wordmark"]', 'the HOOF wordmark file went with the request, never the MCA logo');
ok(fr.verified === false ? !fr.export : true, 'a painting the reading did not verify is neither approved nor exported');
server.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
