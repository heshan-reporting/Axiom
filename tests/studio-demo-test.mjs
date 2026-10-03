/* tools/studio-demo.py end to end against the worker module served over HTTP in this process, with stub models and the
 * real compose tool (headless Chromium, the app renderer): without --approve-calls it prints the estimate and creates
 * nothing; with a call budget and no renders it runs all six steps for HOOF, MCA national and the labelled synthetic
 * client - brief with knowledge and references, three directions, a refinement that is a layout version with no image,
 * the adapted set, a client comment answered in a new version and marked against it, agency then client approval of
 * that exact version and a bundle of only what both approved - checks that each case carries only its own marks, that
 * the isolation audit is clean, that no image was generated, and that the synthetic kit refuses to overwrite a real one.
 * Run: node --experimental-sqlite tests/studio-demo-test.mjs */
import http from 'node:http'; import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const kv = new Map(); const r2 = new Map();
const env = { MIND_DB: new D1Lite(), AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async () => ({ keys: [], list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) }, MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}), upsert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v: Buffer.from(v instanceof ArrayBuffer ? new Uint8Array(v) : v), o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => r2.get(k).v.buffer.slice(r2.get(k).v.byteOffset, r2.get(k).v.byteOffset + r2.get(k).v.byteLength), text: async () => r2.get(k).v.toString(), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' } }), ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' };
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const realFetch = globalThis.fetch; const seen = { gemini: 0, claude: 0 };
const T = (role, x, y, w, h, size) => ({ type: 'text', role, text: '', x, y, w, h, size, weight: 750, color: '#FFFFFF' });
const TYPO = { medium: 'typographic', approach: 'editable', story: 'the words carry it', mark: 'campaign', bg: '#0E3B5C', regions: [], elements: [T('headline', 6, 10, 88, 40, 7.5), T('support', 6, 54, 80, 14, 3.4), T('cta', 6, 74, 60, 8, 3.2)] };
const DIRS = { directions: [
  { title: 'Plain words', message: 'm1', insight: 'i', headline: 'Not a subsidy.', opening: 'o', visual: 'type only', rationale: 'r', claims: [], uncertainty: 'u', medium: 'typographic', idea: 'Say it plainly in big type', plan: 'type' },
  { title: 'The paddock', message: 'Farmers and tradies use the credit every day', insight: 'i2', headline: 'Ask a farmer.', opening: 'o2', visual: 'a paddock at dusk', rationale: 'r2', claims: [], uncertainty: 'u', medium: 'photo-documentary', idea: 'Documentary portrait of a user' },
  { title: 'Myth and fact', message: 'The myth, then the fact, side by side', insight: 'i3', headline: 'Myth: a handout. Fact: a tax refund.', opening: 'o3', visual: 'split myth/fact panels', rationale: 'r3', claims: [], uncertainty: 'u', medium: 'diagram', idea: 'A two-column myth and fact' }] };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { seen.gemini++; return new Response('{}', { status: 500 }); }
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    seen.claude++; const body = JSON.parse(init.body); const sys = String(body.system || ''); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    let a = {};
    if (/build a claim ledger/.test(sys)) a = { headline: 'h', claims: [], brief: {} };
    else if (/genuinely different directions/.test(sys)) a = DIRS;
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
console.log('studio-demo-test (tools/studio-demo.py: the six steps, three cases, separation, no paid image)');
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], facts: [{ text: 'The credit is used by more than 150,000 businesses', source: 'MCA', status: 'approved' }], logoB64: PNG, logoMime: 'image/png' });
await api('POST', '/brand/kit', { ns: 'mca', wordmarkB64: PNG, wordmarkMime: 'image/png', wordmarkCampaign: 'hoof' });
const runPy = (extra) => new Promise(res => { const out = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-')); const c = spawn('python3', [new URL('../tools/studio-demo.py', import.meta.url).pathname, '--key', 'full-key', '--worker', BASE, '--out', out, '--keep'].concat(extra), { env: Object.assign({}, process.env) }); let so = '', se = ''; c.stdout.on('data', x => { so += x; }); c.stderr.on('data', x => { se += x; }); c.on('close', code => res({ code, so, se, out })); });

const dry = await runPy([]);
ok(dry.code === 0 && /Estimate for 3 cases/.test(dry.so) && /Nothing was run/.test(dry.so), 'without approval: the estimate and nothing else - ' + (dry.so + dry.se).slice(-300));
ok(seen.claude === 0 && (await api('GET', '/studio/list?ns=mca')).projects.length === 0, 'no project, no model call');
const run = await runPy(['--approve-calls', '30']);
ok(run.code === 0, 'all three cases finished all six steps: ' + (run.so.slice(-1500) + run.se.slice(-800)));
const dj = JSON.parse(fs.readFileSync(path.join(run.out, 'demo.json'), 'utf8'));
for (const c of dj.cases) ok(c.steps.length === 6 && !c.stopped, c.case + ': six steps' + (c.stopped ? ' - stopped: ' + c.stopped : ''));
const hoof = dj.cases.find(c => c.case === 'hoof'), mca = dj.cases.find(c => c.case === 'mca'), syn = dj.cases.find(c => c.case === 'synth');
ok(/items on file for mca\/hoof/.test(hoof.steps[0].text) && /gaps? before spending/.test(hoof.steps[0].text), 'step 1 shows the knowledge and the gaps: ' + hoof.steps[0].text);
ok(hoof.steps[1].directions.length === 3 && new Set(hoof.steps[1].directions.map(d => d.medium)).size === 3, 'step 2: three directions in three media');
ok(/0 new image calls for the refinement/.test(hoof.steps[2].text) && /with no render/.test(hoof.steps[2].text), 'step 3: produced and refined with no image: ' + hoof.steps[2].text);
ok(hoof.steps[3].assets.length === 3, 'step 4: the master and two adaptations: ' + hoof.steps[3].text);
ok(/addressed in/.test(hoof.steps[4].text), 'step 5: the comment answered in a new version: ' + hoof.steps[4].text);
ok(hoof.steps[5].bundle.length >= 2 && hoof.steps[5].bundle.every(f => fs.existsSync(path.join(run.out, f))), 'step 6: the bundle downloaded: ' + JSON.stringify(hoof.steps[5].bundle));
const mf = hoof.steps[5].bundle.find(f => /\.json$/.test(f)); const man = mf ? JSON.parse(fs.readFileSync(path.join(run.out, mf), 'utf8')) : {};
ok(JSON.stringify(man).indexOf('Read the facts') >= 0 && /client/.test(JSON.stringify(man)), 'the bundle holds the version the client approved, with the client decision');
ok(dj.separation.length >= 7 && dj.separation.every(x => x.ok), 'every mark is the case\'s own: ' + JSON.stringify(dj.separation.filter(x => !x.ok)));
ok(Object.values(hoof.marks).every(ms => ms.length && ms.every(m => /wordmark\?ns=mca&campaign=hoof/.test(m))) && Object.values(mca.marks).every(ms => ms.every(m => /\/brand\/logo\?ns=mca/.test(m))), 'HOOF carries the HOOF wordmark only; MCA national the MCA logo only');
ok(Object.values(syn.marks).every(ms => ms.every(m => /ns=synthdemo/.test(m))) && syn.synthetic, 'the synthetic client carries its own placeholder logo and is labelled');
ok(dj.isolation.mca.clean && dj.isolation.synthdemo.clean, 'the isolation audit is clean for both namespaces');
ok(seen.gemini === 0 && dj.spend.renders === 0, 'no image was generated');
const idx = fs.readFileSync(path.join(run.out, 'index.html'), 'utf8');
ok(/SYNTHETIC CLIENT/.test(idx) && /Separation/.test(idx) && /whether the work is good/.test(idx) && /<img src="hoof\/tiles/.test(idx), 'the page labels the synthetic client, shows the tiles, and says what it does not show');
await api('POST', '/brand/kit', { ns: 'synthdemo', name: 'A real-looking client' });
const guard = await runPy(['--approve-calls', '10', '--cases', 'synth']);
ok(guard.code !== 0 && /not the synthetic demo kit; nothing was written/.test(guard.so), 'the synthetic kit never overwrites a kit that is not its own');
server.close(); console.log('\n' + pass + ' passed, ' + fail + ' failed'); process.exit(fail ? 1 : 0);
