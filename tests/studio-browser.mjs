/* Creative Studio Phase 2 in a real browser, end to end: the page's worker calls are routed
 * into the worker module running in this process (SQLite behind the D1 API, stub Claude and
 * Gemini that answer by what the prompt asks), so the journey - release in, ledger, copy per
 * channel, compositions drawn by the one renderer, hand edits without a render, approvals,
 * export of the approved versions - runs against the real routes and the real page.
 * Run: node --experimental-sqlite tests/studio-browser.mjs   (SHOT=1 screenshots) */
import { spawn } from 'node:child_process';
import { chromium, DOCS } from './pw.mjs';
import { D1Lite } from './d1lite.mjs';
process.on('warning', () => {});
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;
const PORT = 8776, W = 'https://newsaus.heshan-998.workers.dev';
const kv = new Map(); const r2 = new Map(); const calls = { gemini: 0, anthropic: 0 };
const env = {
  MIND_DB: new D1Lite(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); }, list: async ({ prefix }) => ({ keys: Array.from(kv.keys()).filter(k => k.startsWith(prefix || '')).map(name => ({ name })), list_complete: true }) },
  AI: { run: async (m, { text }) => ({ data: text.map(() => new Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async () => ({ matches: [] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v, o) => { r2.set(k, { v, o }); }, get: async k => (r2.has(k) ? { body: r2.get(k).v, arrayBuffer: async () => (typeof r2.get(k).v === 'string' ? new TextEncoder().encode(r2.get(k).v).buffer : r2.get(k).v), httpMetadata: (r2.get(k).o || {}).httpMetadata } : null), delete: async k => { r2.delete(k); } },
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
  ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g',
};
// a real 4x4 PNG (teal) so the browser can decode the background and the logo
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAFklEQVR4nGNgWH2G4f9/BgYGhv//GRgAJJkFy2x6XLUAAAAASUVORK5CYII=';
const RELEASE = 'MEDIA RELEASE - 30 September 2026\n\nFuel tax credits keep regional Australia moving\n\nThe Minerals Council of Australia today released new analysis showing that mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry.\n\nMCA Chief Executive Officer Tania Constable said fuel tax credits were not a subsidy. "Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply," Ms Constable said.\n\nThe analysis found the credit is used by more than 150,000 businesses of all sizes, including farmers, tradies and tourism operators.\n\nENDS';
const STRATEGY = { problem: 'Voters hear subsidy and assume a handout.', audience: { who: 'Regional voters', now: 'It is a handout to miners', wanted: 'It is a road tax never meant for off-road fuel', insight: 'Farmers claim the same credit' }, idea: 'It is your tractor too', proposition: 'Not a subsidy: a road tax returned', proof: [], tone: 'plain, regional', avoid: ['the word subsidy unless denied'], risks: ['called a handout'], measures: ['regional comments turn'], questions: ['Lead with farmers or miners?'] };
const SEQ = { name: 'Your tractor too', arc: 'From the myth to the farmer to the ask', cadence: 'over five days', items: [
  { order: 1, role: 'opener', channel: 'instagram', format: '4:5', day: 0, purpose: 'name the myth', relation: 'sets up the idea', headline: 'Is it a subsidy?', support: 'Look at who uses it.', cta: 'See why', caption: 'A myth.', alt: 'a question', claims: [] },
  { order: 2, role: 'proof', channel: 'facebook', format: '1:1', day: 2, purpose: 'show who uses it', relation: 'the farmer as proof', headline: 'Farmers use it too', support: 'Fuel used off-road.', cta: 'Learn more', caption: 'Who uses it?', alt: 'a farmer', claims: [] },
  { order: 3, role: 'call-to-action', channel: 'facebook', format: '1:1', day: 4, purpose: 'ask for a signature', relation: 'closes the argument', headline: 'Hands off our fuel', support: 'Sign the petition.', cta: 'Sign', caption: 'Sign now.', alt: 'the ask', claims: [] }] };
const LEDGER = { headline: 'Fuel tax credits keep regional Australia moving', claims: [
  { text: 'mining paid $74 billion in company tax and royalties in 2023-24', value: 74, unit: 'billion', subject: 'tax and royalties', period: '2023-24', passage: 'p3' },
  { text: 'Businesses do not pay a road fuel tax on fuel used off-road. The credit simply returns a tax that was never meant to apply', quote: true, who: 'Tania Constable', passage: 'p4' },
  { text: 'the credit is used by more than 150,000 businesses of all sizes', value: 150000, unit: 'businesses', passage: 'p5' },
  { text: 'the credit is worth $9 billion a year', value: 9, unit: 'billion', passage: 'p5' }],
  brief: { objective: 'Answer the subsidy framing while the credit is in the news', audience: 'Members and MPs; the public on Instagram and Facebook', message: 'The credit is not a subsidy', deliverables: 'Organic posts' } };
const DIRS = { directions: [
  { title: 'The plain ask', message: 'The credit is not a subsidy; it returns a tax that never applied.', insight: 'Subsidy sounds like a handout.', headline: 'Not a subsidy. A tax that never applied.', opening: 'Fuel tax credits are not a subsidy.', visual: 'Restrained documentary photography', rationale: 'Plain language', claims: ['c1'], uncertainty: 'No figure for the credit itself' },
  { title: 'Who it really is', message: 'The credit is used by 150,000 businesses of all sizes.', insight: 'Naming tradies moves the frame.', headline: 'Farmers. Tradies. Tourism operators.', opening: 'Who uses the fuel tax credit?', visual: 'A tradie at a rural bowser', rationale: 'Approved usage wording', claims: ['c3'], uncertainty: 'Portraits need releases' }] };
const pieces = user => ({ pieces: ['linkedin', 'facebook', 'instagram', 'x'].filter(c => new RegExp('- ' + c + ' \\(').test(user)).map(c => ({ channel: c, headline: c === 'instagram' ? 'Who uses the fuel tax credit? Farmers, tradies and tourism operators across regional Australia do' : 'Not a subsidy. A tax that never applied.', support: 'Businesses do not pay a road fuel tax on fuel used off-road.', cta: 'Get the facts', caption: 'Mining paid $74 billion in company tax and royalties in 2023-24, more than any other industry. Hands Off Our Fuel.', alt: 'Teal fact panel over a harvester at dusk', visual: 'Harvester at dusk, restrained', claims: ['c1'], hashtags: [] })) });
const decide = user => { const ins = (user.match(/TEAM LEAD[^\n]*\):\n([^\n]+)/) || [])[1] || ''; const A = Array.from(user.matchAll(/^\[(a[a-z0-9]+)\]/gm)).map(m => m[1]);
  if (/move only the cta/i.test(ins)) { const id = (user.match(/\n\s+([\w-]+): text\/cta at/) || [])[1] || 'cta'; return { kind: 'layers', reply: 'Moved the call to action.', layers: { asset: A[0], ops: [{ id, x: 50 }], keeps: ['headline', 'photograph'] } }; }
  if (/alternative/i.test(ins)) return { kind: 'alternatives', reply: 'Three openings, each within the limit.', alternatives: { asset: A[0], field: 'caption', options: ['Who uses the fuel tax credit? Probably someone you know.', 'Mining paid $74 billion in company tax and royalties in 2023-24. Hands Off Our Fuel.', 'Fuel tax credits are not a subsidy. Here is what they are.'] }, memory: { standing: false } };
  if (/restrained/i.test(ins)) return { kind: 'render', reply: 'A quieter photograph reads better under the panel.', render: { assets: [A[0]], visual: 'A quiet regional road at dusk, no machinery', steps: ['Simplify the background', 'Keep the panel, headline and logo'] }, memory: { standing: true, rule: 'No haul trucks in Hands Off Our Fuel imagery.', scope: 'campaign', confidence: 0.9 } };
  return { kind: 'text', reply: 'Headline sharpened; layout and image kept.', changes: [{ asset: A[0], copy: { headline: 'Not a subsidy. Never was.' }, note: 'sharper' }], memory: { standing: false } }; };
const LT = (id, role, x, y, w, h, size, extra) => Object.assign({ id, type: 'text', role, x, y, w, h, size, color: '#FFFFFF' }, extra || {});
const LAYOUTS = { critique: 'The words sit on the subject.', options: [
  { name: 'Right column', concept: 'Words in the quiet right third', rationale: 'The eye lands on the subject first, then reads down the column', composition: 'right column', keeps: ['photograph', 'words'], changes: ['placement'], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [{ id: 'col', type: 'shape', role: 'panel', shape: 'rect', x: 58, y: 0, w: 42, h: 100, fill: '#0E6A6E', opacity: 0.8 }, LT('hl', 'headline', 61, 8, 36, 40, 5), LT('sp', 'support', 61, 52, 36, 20, 2.6), LT('cta', 'cta', 61, 80, 36, 6, 2.4)] } },
  { name: 'Bottom band', concept: 'A band across the foot', rationale: 'The photograph keeps the top two thirds; the message reads as a caption to it', composition: 'bottom band', keeps: ['photograph', 'words'], changes: ['panel'], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [{ id: 'band', type: 'shape', role: 'panel', shape: 'rect', x: 0, y: 66, w: 100, h: 34, fill: '#0E6A6E' }, LT('hl', 'headline', 4, 68, 92, 14, 4.6), LT('sp', 'support', 4, 83, 64, 8, 2.4), LT('cta', 'cta', 70, 86, 26, 6, 2.4)] } },
  { name: 'Centred statement', concept: 'One statement over a dark overlay', rationale: 'A single line at the centre carries the claim with nothing competing', composition: 'centre', keeps: ['photograph', 'words'], changes: ['hierarchy'], plan: { medium: 'photo-documentary', approach: 'editable', mark: 'campaign', regions: [{ id: 'bg', role: 'background', x: 0, y: 0, w: 100, h: 100, prompt: 'keep the current image' }], elements: [{ id: 'ov', type: 'shape', role: 'overlay', shape: 'rect', x: 0, y: 0, w: 100, h: 100, fill: 'rgba(0,0,0,0.45)' }, LT('hl', 'headline', 8, 30, 84, 24, 5.6, { align: 'center' }), LT('sp', 'support', 12, 56, 76, 10, 2.6, { align: 'center' }), LT('cta', 'cta', 30, 70, 40, 6, 2.4, { align: 'center' })] } }] };
const withInfluence = (A, user) => { const ref = (user.match(/\[(r[a-z0-9]+)\] Editorial grid/) || [])[1]; return ref ? Object.assign({}, A, { options: A.options.map((o, i) => i === 0 ? Object.assign({}, o, { influence: [{ ref, component: 'typography' }, { ref, component: 'colour' }] }) : o) }) : A; };
const CONCEPTS = { critique: 'The photograph is generic; the panel holds.', options: [
  { name: 'No box, darker image', concept: 'Words over a darkened photograph', rationale: 'Editorial', imagery: 'keep the current photograph', composition: 'Top left', typography: 'Larger', colour: 'Dark overlay', textPlacement: 'top left', layout: { style: 'none', placement: 'top', template: 'same', headline: 'larger' }, keeps: ['photograph'], changes: ['panel removed'], needsImage: false, prompt: '', basis: [{ claim: 'White type on dark reads', kind: 'inferred' }], missing: [] },
  { name: 'Split field', concept: 'Message on a teal field below', rationale: 'Clean separation', imagery: 'keep the current photograph', composition: 'Split', typography: 'Same', colour: 'Teal', textPlacement: 'bottom band', layout: { style: 'split', placement: 'bottom', template: 'teal', headline: 'same' }, keeps: ['photograph'], changes: ['split'], needsImage: false, prompt: '', basis: [{ claim: 'Teal is the campaign colour', kind: 'rule' }], missing: [] },
  { name: 'Regional road at dawn', concept: 'A new photograph of a regional road', rationale: 'Where the credit is used', imagery: 'Regional road at dawn', composition: 'Low horizon', typography: 'Same', colour: 'Teal panel', textPlacement: 'lower left', layout: { style: 'same', placement: 'bottom', template: 'same', headline: 'same' }, keeps: ['panel', 'copy'], changes: ['photograph'], needsImage: true, prompt: 'A quiet regional road at dawn', basis: [{ claim: 'Restrained imagery preferred', kind: 'preference' }], missing: ['Whether machinery may appear'] }] };
const REFAN = { summary: 'A restrained editorial tile: large headline top left, photograph bleeding right, logo small bottom left.', typography: 'Bold grotesque headline, light body', colour: { palette: ['#0E6A6E', '#F4F1EA'], relationships: 'Teal ground, cream type' }, hierarchy: 'Headline first', composition: 'Words left, photograph right', imageTreatment: 'Documentary, warm', panels: 'None', spacing: 'Airy', logo: 'Bottom left, small', text: ['Hands Off Our Fuel'], takeaways: ['Flat colour field', 'Headline far larger than body'] };
const SUGGEST = { design: [{ text: 'Keep the harvester visible. Replace the large teal panel with a compact translucent panel in the upper left and move the CTA below the headline.', why: 'The subject is covered', refs: [] }, { text: 'Use the flat colour field and the large headline from the approved tile, adapted to this square format.', why: 'Matches the approved reference', refs: [] }, { text: 'Set the words on a split teal field to the left and let the photograph fill the right half.', why: 'Clean separation', refs: [] }], image: [{ text: 'A wider documentary photograph with the harvester on the right and open paddock on the left for the headline.', why: 'Room for the words' }, { text: 'The same paddock at dusk, closer on the header, sky quiet above.', why: 'Human scale' }] };
const INSPECT = { fidelity: 4, hierarchy: 3, readability: 4, relevance: 4, reasons: { fidelity: 'The harvester carries the regional idea', hierarchy: 'Support sits too close and competes with the headline', readability: 'White on the dark field reads', relevance: 'Farm work is the credit in use' }, words: { present: [], wrong: [] }, issues: ['The support line sits too close to the headline'], verdict: 'fix', fix: { kind: 'design', instruction: 'Add a line of space between the headline and the support line; keep everything else.' }, note: 'Close; one spacing fix.' };
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('generativelanguage') >= 0) { calls.gemini++; if (/\/models\?/.test(u)) return new Response(JSON.stringify({ models: [{ name: 'models/gemini-3-pro-image' }] }), { status: 200 }); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inline_data: { mime_type: 'image/png', data: PNG } }] } }] }), { status: 200 }); }
  if (u.indexOf('api.anthropic.com/v1/models') >= 0) return new Response(JSON.stringify({ data: [{ id: 'claude-opus-5-5' }, { id: 'claude-sonnet-5-5' }] }), { status: 200 });
  if (u.indexOf('api.anthropic.com/v1/messages') >= 0) {
    calls.anthropic++; const body = JSON.parse(init.body); const sys = String(body.system || ''), user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    const answer = /EXPLORE DIFFERENT LAYOUTS/.test(user) ? withInfluence(LAYOUTS, user) : /creative strategist/.test(sys) ? STRATEGY : /planning a campaign sequence/.test(sys) ? SEQ : /build a claim ledger/.test(sys) ? LEDGER : /genuinely different directions/.test(sys) ? DIRS : /producing a coordinated set/.test(sys) ? pieces(user) : /decide what the instruction asks/.test(sys) ? decide(user) : /describing one reference image/.test(sys) ? REFAN : /suggesting the next things the team might ask for/.test(sys) ? SUGGEST : /art director inspecting a rendered social tile/.test(sys) ? INSPECT : /art director of an Australian political communications agency/.test(sys) ? CONCEPTS : {};
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answer) }], stop_reason: 'end_turn' }), { status: 200 });
  }
  return new Response('', { status: 404 });
};
const mod = await import(WORKER); const handler = mod.default; const ctx = { waitUntil() {} };
async function api(method, path, body, key = 'full-key') {
  const r = new Request(W + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx); return res.json();
}
// seed: the MCA kit with a logo, one learned rule, one legacy release pack
await api('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, rules: 'Label the answer Fact, never Busted.', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.' }], facts: [{ text: 'Mining directly employs more than 300,000 Australians', source: 'ABS' }], banned: [{ term: 'subsidy', allowNegated: true, use: 'credit' }], logoB64: PNG, logoMime: 'image/png' });
await api('GET', '/engine/status?ns=mca'); await api('GET', '/studio/status');
env.MIND_DB.db.prepare("INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES('f1','mca','copy','client','','','','Say more than any other industry, never more than all other industries combined','','pack','Dee',1000,1,0)").run();
await api('GET', '/release/list?ns=mca');
env.MIND_DB.db.prepare("INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES('rp1','mca','Critical minerals reserve','Release text here about a strategic reserve.','{\"headline\":\"Reserve\",\"claims\":[\"Australia holds the minerals\"],\"numbers\":[],\"quotes\":[]}','[{\"n\":0,\"kind\":\"lead\",\"headline\":\"Critical minerals need a reserve\",\"support\":\"x\",\"cta\":\"Learn more\",\"captions\":{\"linkedin\":\"A reserve.\"},\"alt\":\"tile\",\"image\":{\"ver\":1,\"model\":\"gemini-2.5-flash-image\"},\"verdict\":\"approved\"}]','rendered','','Dee','square',1000,2000)").run();
r2.set('packs/rp1/0.png', { v: Buffer.from(PNG, 'base64'), o: { httpMetadata: { contentType: 'image/png' } } });

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', DOCS], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const texts = async (page, sel) => (await page.$$eval(sel, els => els.map(e => e.textContent.trim())));
const browser = await chromium.launch();
async function open(role) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  page.on('pageerror', e => console.log('  [pageerror] ' + String(e.stack || e.message).split('\n').slice(0, 3).join(' | ').slice(0, 400)));
  await page.addInitScript(({ W, role }) => { localStorage.setItem('axiom_worker_url', W); localStorage.setItem('axiom_access_key', role === 'read' ? 'read-key' : 'full-key'); if (role) window.AX_ROLE = role; }, { W, role });
  // the page's worker calls go to the module in this process; other hosts (fonts, charts) are dropped
  await page.route(/^https:\/\/(?!127\.0\.0\.1)[^/]+\//, async route => {
    const rq = route.request(); const u = rq.url();
    if (!u.startsWith(W)) return route.abort();
    const headers = rq.headers(); const body = rq.postDataBuffer();
    const res = await handler.fetch(new Request(u, { method: rq.method(), headers, body: body && rq.method() !== 'GET' ? body : undefined }), env, ctx);
    const h = {}; res.headers.forEach((v, k) => { h[k] = v; });
    return route.fulfill({ status: res.status, headers: h, body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof go === 'function' && window.AXUI && window.STRender && typeof studioInit === 'function');
  await page.evaluate(() => go('studio'));
  await page.waitForSelector('#studio-root .st-head');
  return page;
}
const R = '#studio-root ';
/* the Studio's navigation: six stages in the navigator, views inside a stage as tabs, the inspector's tabs beside the artwork */
const VIEW_STAGE = { Sources: 'Brief', References: 'Brief', Board: 'Produce', Sequence: 'Produce', 'Recipes and usage': 'Produce', 'Copy deck': 'Refine' };
const goStep = (pg, name) => pg.click(R + '.st-step:has-text("' + name + '")');
const goView = async (pg, name) => { await goStep(pg, VIEW_STAGE[name]); await pg.click(R + '.st-subtab:has-text("' + name + '")'); };
const itab = (pg, name) => pg.click(R + '.st-instab:has-text("' + name + '")');
const shot = async (page, name) => { if (process.env.SHOT) await page.screenshot({ path: new URL('./shot-' + name + '.png', import.meta.url).pathname, fullPage: false }); };
const canvasPng = page => page.evaluate(() => { const c = document.querySelector('#studio-root .st-stage canvas'); return c ? c.toDataURL('image/png') : ''; });
console.log('studio-browser harness (Phase 2, through the worker module)');
const page = await open();

await t('the library opens on the client from the worker: nothing yet for MCA except the legacy pack, the backend build named', async () => {
  await page.waitForSelector(R + '.st-lib tbody tr, ' + R + '.ov-empty');
  ok(/Creative Studio/.test(await page.textContent(R + '.st-head'))); eq(await page.inputValue(R + '.st-head select'), 'mca');
  await page.waitForFunction(() => /Backend build/.test(document.querySelector('#studio-root .st-lib').textContent));
  ok(/studio-p\d/.test(await page.textContent(R + '.st-head')), 'the build chip');
  const rows = await texts(page, R + '.st-lib tbody tr'); eq(rows.length, 1); ok(/Critical minerals reserve/.test(rows[0]) && /legacy release pack, read-only/.test(rows[0]), rows[0]);
});
await t('a release with a clear instruction: the source is read into a ledger, no direction step, copy adapted per channel, compositions laid out, renders queued and run as jobs', async () => {
  const g0 = calls.gemini;
  await page.click(R + '.st-lib-head .btn');
  await page.waitForSelector(R + '.st-intake');
  eq(await page.inputValue(R + '.st-intake select'), 'hoof', 'the campaign comes from the kit');
  await page.fill(R + '.st-intake textarea', RELEASE);
  await page.fill(R + '.st-intake input.st-in', 'Three posts on the $74 billion figure');
  ok(/no direction step/.test(await page.textContent(R + '.st-intake-foot')));
  await page.click(R + '.st-segbtn:has-text("X 16:9")');   // four channels
  await shot(page, 'studio-intake');
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-asset', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-railbtn.asset').length === 4, null, { timeout: 30000 });
  const th = await page.textContent(R + '.st-thread');
  ok(/Read Pasted release: 3 figures, 1 quotations/.test(th) && /marked unverified/.test(th) && /brief was proposed/.test(th), th.slice(0, 600));
  ok(/Produced 4 assets: LinkedIn 1:1, Instagram 4:5, Facebook 1:1, X 16:9/.test(th) && /editable teal fact panels with the kit logo placed exactly; 4 background renders queued/.test(th), th);
  ok(await page.$(R + '.st-step.skipped'), 'directions marked skipped');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-thread').textContent.match(/Render finished/g) || []).length === 4, null, { timeout: 60000 });
  eq(calls.gemini - g0, 4, 'four renders spent, one per asset');
  ok(/render spent/.test(await page.textContent(R + '.st-thread')));
  await shot(page, 'studio-produced');
});
await t('the sources view shows the ledger tied to passages, with what the source does not carry marked; the brief shows the proposed fields', async () => {
  await goView(page, 'Sources');
  await page.waitForSelector(R + '.st-ledger');
  const rows = await texts(page, R + '.st-ledger tbody tr'); ok(rows.length >= 4, String(rows.length));
  ok(rows.some(r => /74 billion|74,000,000,000|74 billion/.test(r) && /2023-24/.test(r) && /p3/.test(r)), JSON.stringify(rows));
  ok(rows.some(r => /worth \$9 billion/.test(r) && /unverified/.test(r) && /not in the source text/.test(r)), 'the invented figure is marked');
  await page.click(R + '.st-ledger tbody tr:first-child summary');
  ok(/mining paid \$74 billion/.test(await page.textContent(R + '.st-passage')));
  await goStep(page, 'Brief');
  await page.waitForSelector(R + '.st-ul');
  ok(/proposed by the Studio/.test(await page.textContent(R + '.st-centre')) && /proposed from the source by the Studio/.test(await page.textContent(R + '.st-centre')));
  eq(await page.inputValue(R + '.st-field textarea'), 'Answer the subsidy framing while the credit is in the news');
});
await t('the asset preview is drawn by the one renderer; the checks read the ledger; a headline edit makes a text version that changes the preview with no image-model call and keeps the image', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")');
  await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /gemini-3-pro-image/.test(document.querySelector('#studio-root .st-comp-tag').textContent));
  ok(/editable composition, teal fact panel/.test(await page.textContent(R + '.st-comp-tag')));
  ok(/kit logo placed exactly/.test(await page.textContent(R + '.st-copy')), 'the layout line names the exact logo');
  const checks = (await page.textContent(R + '.st-checks')).replace(/\s+/g, ' '); ok(/matches source \$74 billion matches the source, p3, 2023-24/.test(checks), checks);
  await new Promise(r => setTimeout(r, 400));
  const before = await canvasPng(page); const g0 = calls.gemini; const head0 = await page.textContent(R + '.st-asset-head');
  ok(/v2 of 2/.test(head0), head0);
  await page.fill(R + '.st-field:nth-of-type(1) input', 'Fuel tax credits are not a subsidy.');
  await page.waitForFunction(() => /v3 of 3/.test(document.querySelector('#studio-root .st-asset-head').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => /Text change on Facebook post: hand edit: headline \(no render\)/.test(document.querySelector('#studio-root .st-thread').textContent));
  await new Promise(r => setTimeout(r, 400));
  const after = await canvasPng(page);
  ok(before && after && before !== after, 'the preview changed with the headline');
  eq(calls.gemini, g0, 'no image-model call for a text change');
  ok(/gemini-3-pro-image/.test(await page.textContent(R + '.st-comp-tag')), 'the background is still the rendered one');
  const c2 = (await page.textContent(R + '.st-checks')).replace(/\s+/g, ' '); ok(!/banned term subsidy/.test(c2), '"not a subsidy" is a negation, allowed: ' + c2);
  await shot(page, 'studio-asset');
});
await t('a layout change (headline smaller) is a layout version, no render; a long headline is flagged as overflow at 4:5 on the Instagram portrait', async () => {
  const g0 = calls.gemini;
  await page.click(R + '.ov-link:has-text("headline smaller")');
  await page.waitForFunction(() => /v4 of 4/.test(document.querySelector('#studio-root .st-asset-head').textContent), null, { timeout: 15000 });
  ok(/headline smaller/.test(await page.textContent(R + '.st-asset-head'))); eq(calls.gemini, g0);
  await page.click(R + '.st-railbtn.asset:has-text("Instagram portrait")');
  await page.waitForSelector(R + '.st-stage canvas');
  await page.waitForFunction(() => /overflow/.test(document.querySelector('#studio-root .st-checks').textContent));
  ok(/needs \d+ lines at this size/.test(await page.textContent(R + '.st-checks')));
});
await t('approvals per component with reasons; a copy edit drops the copy approval and leaves design; export includes only the fully approved asset, draws it with the renderer, records the export and downloads the bundle', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")');
  await itab(page, 'Quality'); await page.waitForSelector(R + '.st-approve');
  await page.click(R + '.st-appr button:has-text("Approve copy")');
  await page.waitForSelector(R + '.st-dialog'); ok(/never as performance/.test(await page.textContent(R + '.st-dialog')));
  await page.fill(R + '.st-dialog textarea', 'client asked for the plain ask'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForFunction(() => /approved.*client asked for the plain ask/.test(document.querySelector('#studio-root .st-approve').textContent));
  await page.click(R + '.st-appr button:has-text("Approve design")');
  await page.fill(R + '.st-dialog textarea', 'fine as is'); await page.click(R + '.st-dialog button:has-text("Record")');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-approve').textContent.match(/approved/g) || []).length === 2);
  // a caption is posted beside the tile: editing it drops the copy approval, and the design (the same tile) carries with its evidence
  await itab(page, 'Copy'); await page.fill(R + '.st-field:nth-of-type(4) textarea', 'Not a subsidy. A road tax returned.');
  await page.waitForFunction(() => (document.querySelector('#studio-root .st-approve').textContent.match(/approved/g) || []).length === 1, null, { timeout: 15000 });
  ok(/design.*approved/.test(await page.textContent(R + '.st-approve')) && /unchanged since, so it stands/.test(await page.textContent(R + '.st-approve')), 'design carried, copy dropped');
  ok(/Technical validation\s*passed/.test(await page.textContent(R + '.st-ready')), 'the measurement carries to a caption-only version');
  // P9: words on the tile are the design too - a CTA edit drops both approvals and the composition is measured again before design approval
  await page.fill(R + '.st-field:nth-of-type(3) input', 'Learn more today');
  await page.waitForFunction(() => !/approved/.test(document.querySelector('#studio-root .st-approve').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('#studio-root .st-appr:nth-child(2) button').disabled && /Technical validation\s*passed/.test(document.querySelector('#studio-root .st-ready').textContent), null, { timeout: 15000 });
  await itab(page, 'Quality');
  for (const [part, why] of [['copy', 'ok after the CTA'], ['design', 'measured again after the CTA']]) {
    await page.click(R + '.st-appr button:has-text("Approve ' + part + '")'); await page.fill(R + '.st-dialog textarea', why); await page.click(R + '.st-dialog button:has-text("Record")');
    await page.waitForFunction(p => new RegExp(p + '\\s*approved').test(document.querySelector('#studio-root .st-approve').textContent), part);
  }
  await goStep(page, 'Export');
  await page.waitForSelector(R + '.st-exportstage');
  const rows = await texts(page, R + '.st-exportstage tbody tr'); eq(rows.filter(r => /included/.test(r)).length, 1); ok(/Facebook post/.test(rows.find(r => /included/.test(r))));
  ok(/Export sends nothing anywhere; a hand-off is its own step/.test(await page.textContent(R + '.st-exportstage')));
  await shot(page, 'studio-export');
  await page.click(R + '.st-exportstage button:has-text("Prepare bundle")');
  await page.waitForFunction(() => window.__studioLastExport, null, { timeout: 30000 });
  const ex = await page.evaluate(() => window.__studioLastExport);
  ok(ex.files.some(f => /Facebook_post-v\d\.png/.test(f)) && ex.files.indexOf('copy-sheet.txt') >= 0 && ex.files.indexOf('manifest.json') >= 0, JSON.stringify(ex.files));
  ok(ex.manifest && ex.manifest.export && ex.manifest.included.length === 1 && ex.manifest.included[0].exportKey, 'the export stage recorded the browser-rendered PNG: ' + JSON.stringify(ex.manifest).slice(0, 300));
  ok(Array.from(r2.keys()).some(k => /-export\.png$/.test(k)), 'the composition PNG is in R2');
  ok(/Bundle ready/.test(await page.textContent(R + '.st-exportstage')) && await page.$(R + '.st-exportstage a[download]'), 'the download link is shown');
  ok(/1080 x 1080/.test(await page.textContent(R + '.st-export-files')) && /native size/.test(await page.textContent(R + '.st-export-files')), 'the exported PNG is at the native size');
  await page.click(R + '.st-exportstage button:has-text("Send to ClickUp")');
  await page.waitForSelector(R + '.st-dialog-box.narrow'); ok(/Create 1 task/.test(await page.textContent(R + '.st-dialog-box.narrow')));
  await page.click(R + '.st-dialog-box.narrow button:has-text("Cancel")');
  await page.waitForSelector(R + '.st-dialog', { state: 'detached' });
});
await t('directing the team: a text direction lands as a version with no render; alternatives arrive as chips and one becomes the caption; a visual direction is proposed, confirmed, and runs a render; the standing preference is offered and saved for the campaign', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("LinkedIn post")'); await page.waitForSelector(R + '.st-asset');
  const head0 = await page.textContent(R + '.st-asset-head'); const v0 = +(head0.match(/v(\d+) of/) || [])[1];
  await itab(page, 'Art Director');
  const g0 = calls.gemini;
  await page.fill(R + '.st-composer textarea', 'Keep this layout but make the headline sharper'); await page.press(R + '.st-composer textarea', 'Enter');
  await page.waitForFunction(() => /Text change only: 1 asset at a new version, image kept, no render spent/.test(document.querySelector('#studio-root .st-thread').textContent), null, { timeout: 30000 });
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), v0, { timeout: 15000 });
  eq(await page.inputValue(R + '.st-field:nth-of-type(1) input'), 'Not a subsidy. Never was.'); eq(calls.gemini, g0);
  ok(/Direction: Keep this layout/.test(await page.textContent(R + '.st-thread')), 'the direction is quoted');
  await page.fill(R + '.st-composer textarea', 'Give me three alternative opening lines'); await page.press(R + '.st-composer textarea', 'Enter');
  await page.waitForSelector(R + '.st-alts', { timeout: 30000 });
  eq((await texts(page, R + '.st-alt')).length, 3);
  await page.click(R + '.st-alt:nth-child(1)');
  await page.waitForFunction(() => /^Who uses the fuel tax credit\?/.test(document.querySelector('#studio-root .st-field:nth-of-type(4) textarea').value), null, { timeout: 15000 });
  await page.fill(R + '.st-composer textarea', 'Make the visual more restrained, no trucks'); await page.press(R + '.st-composer textarea', 'Enter');
  await page.waitForSelector(R + '.st-proposal', { timeout: 30000 });
  ok(/needs a new image, not a text change/.test(await page.textContent(R + '.st-thread')) && /Simplify the background/.test(await page.textContent(R + '.st-proposal')));
  eq(calls.gemini, g0, 'nothing spent before confirmation');
  await page.click(R + '.st-offer .ov-link:has-text("show wording")');
  await page.waitForSelector(R + '.st-offer-box'); eq(await page.inputValue(R + 'textarea[id^="offer-"]'), 'No haul trucks in Hands Off Our Fuel imagery.');
  await page.click(R + '.st-offer-box button:has-text("Campaign preference (hoof)")');
  await page.waitForFunction(() => /Saved as a campaign preference for hoof/.test(document.querySelector('#studio-root .st-thread').textContent), null, { timeout: 15000 });
  eq(env.MIND_DB.db.prepare("SELECT source FROM engine_fixes WHERE rule LIKE '%haul trucks%'").get().source.split(':campaign:')[1], 'hoof');
  await page.click(R + '.st-proposal button:has-text("Do this")');
  await page.waitForFunction(() => /Render finished/.test(document.querySelector('#studio-root .st-thread').textContent.split('Confirmed: 1 render queued')[1] || ''), null, { timeout: 60000 });
  eq(calls.gemini, g0 + 1, 'one render, after confirmation');
  ok(/confirmed, 1 render/.test(await page.textContent(R + '.st-proposal')));
  await shot(page, 'studio-partner');
});
await t('art direction: "Come up with a better creative" proposes distinct cards previewed on the current photograph with basis and cost; applying a layout-only card makes a layout version with no render; the render card shows its cost', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await page.waitForSelector(R + '.st-ad');
  const g0 = calls.gemini; const vBefore = +((await page.textContent(R + '.st-asset-head')).match(/v(\d+) of/) || [])[1];
  eq(await page.inputValue(R + '.st-ad-ask input'), '', 'the feedback line is optional');
  ok(await page.$(R + '.st-ad-actions button:has-text("Refine this design")') && await page.$(R + '.st-ad-actions button:has-text("Create a new design")'), 'the three actions are visible');
  await page.click(R + '.st-ad-actions button:has-text("Explore variations")');
  await page.waitForSelector(R + '.st-ad-card', { timeout: 30000 });
  const cards = await texts(page, R + '.st-ad-card'); eq(cards.length, 3);
  ok(/No box, darker image/.test(cards[0]) && /layout only, no render/.test(cards[0]) && /inferred: White type/.test(cards[0]), cards[0]);
  ok(/Regional road at dawn/.test(cards[2]) && /1 render at 2K/.test(cards[2]) && /Missing: Whether machinery/.test(cards[2]) && /preference: Restrained/.test(cards[2]), cards[2]);
  ok(/rule: Teal is the campaign colour/.test(cards[1]));
  ok(/Critique/.test(await page.textContent(R + '.st-ad-crit')) && /photograph is generic/.test(await page.textContent(R + '.st-ad-crit')));
  eq((await page.$$(R + '.st-ad-card canvas')).length, 3, 'each card previews on the current photograph');
  ok(await page.$(R + '.st-ad-card:nth-child(3) button:has-text("Generate (1 render at 2K)")'), 'the render card names its cost');
  eq(calls.gemini, g0, 'proposing spends no render');
  await page.$eval(R + '.st-ad', el => el.scrollIntoView({ block: 'start' })); await shot(page, 'studio-artdirection-cards');
  await page.click(R + '.st-ad-card:nth-child(2) button:has-text("Apply layout only")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), vBefore, { timeout: 15000 });
  ok(/art direction: Split field/.test(await page.textContent(R + '.st-asset-head'))); eq(calls.gemini, g0, 'no render for a layout-only direction');
  await page.waitForFunction(() => /applied/.test(document.querySelectorAll('#studio-root .st-ad-card')[1].textContent));
  ok(/applied as version/.test((await texts(page, R + '.st-ad-card'))[1]));
  ok(/proposed against an earlier version/.test(await page.textContent(R + '.st-ad-crit')), 'the cards say they were proposed against the version before');
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-list');
  const items = await texts(page, R + '.st-le-item'); ok(items.some(x => /panel/.test(x)) && items.some(x => /headline/.test(x)) && items.every(x => /hide|show/.test(x) && /lock/.test(x)), JSON.stringify(items));
  await page.click(R + '.st-asset-acts button:has-text("Close layout editor")');
  await shot(page, 'studio-artdirection');
  // the resolution select governs what is paid for: the card costs follow it, and a re-render is queued at it
  await page.selectOption(R + '.st-size select', '4K'); await page.waitForFunction(() => /1 render at 4K/.test(document.querySelector('#studio-root .st-ad-card:nth-child(3) .st-ad-cost').textContent));
  await page.click(R + '.st-ad-quick .ov-link'); await page.click(R + '.st-ad-quick button:has-text("Do this (one render at 4K)")');
  await page.waitForFunction(() => /Rendering new imagery/.test(document.querySelector('#studio-root').textContent) || true);
  let rj = null; for (let i = 0; i < 40 && !rj; i++) { await new Promise(r => setTimeout(r, 250)); const pid = (await api('GET', '/studio/list?ns=mca')).projects.map(x => x.id); for (const id of pid) { const js = (await api('GET', '/studio/jobs?project=' + id)).jobs || []; rj = js.find(j => j.stage === 'render' && /imagery as directed/.test(JSON.stringify(j.input))) || rj; } }
  eq(rj && rj.input.size, '4K', 'the re-render is queued at the chosen 4K, not the previous size');
  await page.selectOption(R + '.st-size select', '2K');
});
await t('suggested next directions: design suggestions sit beside the creative partner and fill the composer as an editable instruction; photograph suggestions sit inside the re-render controls and fill its description; the proposed cards each draw differently; the export is the preview drawn at native size', async () => {
  await itab(page, 'Art Director'); await page.waitForSelector(R + '.st-partner .st-sugg.design button:has-text("Suggest for this version (1 model call)")', { timeout: 20000 });
  ok(!(await page.$(R + '.st-partner .st-sugg.design .st-sugg-item')), 'nothing is suggested, and nothing spent, until the team asks');
  await page.click(R + '.st-partner .st-sugg.design button:has-text("Suggest for this version")'); await page.waitForSelector(R + '.st-partner .st-sugg.design .st-sugg-item', { timeout: 20000 });
  const items = await texts(page, R + '.st-partner .st-sugg.design .st-sugg-item'); eq(items.length, 3); ok(/compact translucent panel in the upper left/.test(items[0]), items[0]); ok(/the artwork seen/.test(await page.textContent(R + '.st-partner .st-sugg-head')), 'the head says the model saw the artwork');
  const useBtns = await page.$$(R + '.st-partner .st-sugg.design .st-sugg-item .ov-link'); await useBtns[1].click();
  eq(await page.inputValue(R + '.st-composer textarea'), SUGGEST.design[1].text, 'the suggestion is in the composer, editable, not sent');
  await page.fill(R + '.st-composer textarea', '');
  ok(/2 photograph suggestions inside/.test(await page.textContent(R + '.st-ad-quick')), await page.textContent(R + '.st-ad-quick'));
  await page.click(R + '.st-ad-quick > .ov-link'); await page.waitForSelector(R + '.st-ad-quick .st-sugg.image .st-sugg-item');
  const img = await page.$$(R + '.st-ad-quick .st-sugg.image .st-sugg-item .ov-link'); eq(img.length, 2); await img[0].click();
  eq(await page.inputValue(R + '[aria-label="Photograph description"]'), SUGGEST.image[0].text);
  await page.click(R + '.st-ad-quick button:has-text("Not now")');
  const urls = await page.$$eval(R + '.st-ad-card canvas', cs => cs.map(c => c.toDataURL('image/png'))); eq(urls.length, 3); eq(new Set(urls).size, 3, 'three visibly different compositions');
  // the export draws the same document with the same function at the stage's native size; a preview at that width is the same PNG
  const check = await page.evaluate(async (L) => {
    const layout = L.layout, copy = L.copy; const r1 = window.STRender.render(layout, copy, {}, null).canvas.toDataURL('image/png');
    const blob = await window.STRender.toBlob(layout, copy, {}); const u = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
    return { w: window.STRender.render(layout, copy, {}, null).w, equal: r1 === u };
  }, await (async () => { const d = await api('GET', '/studio/list?ns=mca'); const pr = d.projects.find(x => /Fuel tax credits keep regional Australia moving/.test(x.title)); const full = await api('GET', '/studio/get?id=' + pr.id); const a = full.assets.find(x => x.channel === 'facebook'); const v = a.versions[a.versions.length - 1]; return { layout: v.layout, copy: v.copy }; })());
  eq(check.w, 1080); eq(check.equal, true, 'the export PNG and the preview at native width are the same drawing');
  await shot(page, 'studio-suggestions');
});
await t('three visible actions: Create a new design opens a form that names what is retained and the references, proposes, and creates a new asset that inherits no panel; the art director\'s inspection of a render sits on the thread with an editable, bounded correction that applies once', async () => {
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await page.waitForSelector(R + '.st-ad-actions');
  const n0 = (await page.$$(R + '.st-railbtn.asset')).length;
  await page.click(R + '.st-ad-actions button:has-text("Create a new design")'); await page.waitForSelector(R + '.st-newdesign');
  ok(/Mandatory campaign requirements/.test(await page.textContent(R + '.st-newdesign')), 'the form says what always carries forward');
  const checks = await texts(page, R + '.st-newdesign .st-check'); ok(checks.some(c => /the current imagery/.test(c)) && checks.some(c => /the current copy/.test(c)) && checks.some(c => /the current composition/.test(c)), JSON.stringify(checks));
  await page.fill(R + '.st-newdesign textarea', 'Typography-led: the figure does the work, no photograph');
  await page.click(R + '.st-newdesign button:has-text("Propose the new design")');
  await page.waitForFunction(() => /New design/.test((document.querySelector('#studio-root .st-ad-crit') || {}).textContent || ''), null, { timeout: 30000 });
  const cards = await texts(page, R + '.st-ad-card'); ok(cards.length >= 1); ok(/Create \(layout only\)|Create as a sketch/.test(cards[0]), 'a fresh concept creates rather than applies: ' + cards[0].slice(0, 200));
  await page.click(R + '.st-ad-card:nth-child(1) button:has-text("Create")');
  await page.waitForFunction(n => document.querySelectorAll('#studio-root .st-railbtn.asset').length === n + 1, n0, { timeout: 15000 });
  ok(/New designs/.test(await page.textContent(R + '.st-rail')), 'the new asset sits in its own family');
  ok(/Created ".+" as a new design/.test(await page.textContent(R + '.st-thread')));
  // the inspection a render queued earlier reached the thread with its scores and one correction
  await itab(page, 'Art Director'); await page.waitForSelector(R + '.st-insp', { timeout: 20000 });
  const insp = await page.textContent(R + '.st-insp'); ok(/fidelity/.test(insp) && /readability/.test(insp) && /round 1 of 2/.test(insp), insp.slice(0, 200));
  ok(/verdict: fix/.test(insp) && /identity not scored/.test(insp) && /hierarchy 3 Support sits too close and competes with the headline/.test(insp) && /of v\d+/.test(insp) && /(composed tile|imagery only)/.test(insp), 'each score with its reason, the unscored one said, the verdict, the version and what was seen: ' + insp.slice(0, 500));
  ok(/support line sits too close/.test(await page.textContent(R + '.st-insp')), 'the issue is named');
  const fixBox = await page.$(R + 'textarea[id^="fix-"]'); ok(fixBox, 'the correction is editable before it is applied'); eq(await fixBox.inputValue(), 'Add a line of space between the headline and the support line; keep everything else.');
  // the inspection judged the render's version; the asset has moved on since (a concept was applied), so the card says so and applying is a confirmed choice
  ok(/inspected an earlier version/.test(await page.textContent(R + '.st-insp')), 'a stale inspection is marked');
  page.once('dialog', d => d.accept());
  await page.click(R + '.st-insp button:has-text("Apply the correction")');
  await page.waitForFunction(() => /correction applied/.test(document.querySelector('#studio-root .st-thread').textContent), null, { timeout: 30000 });
  ok((await page.$$(R + '.st-insp button:has-text("Apply the correction")')).length < (await page.$$(R + '.st-insp')).length, 'an applied correction offers no second button');
  await shot(page, 'studio-newdesign');
});
await t('the jobs view lists every job with its log; the client context lists the kit, the facts, the banned terms and the learned rule', async () => {
  await page.click(R + '.st-railbtn:has-text("Jobs")');
  await page.waitForSelector(R + '.st-centre table');
  const stages = await texts(page, R + '.st-centre tbody tr td:nth-child(2)'); const states = await texts(page, R + '.st-centre tbody tr td:nth-child(4) .st-status');
  ok(stages.length >= 7, String(stages.length)); eq(stages.filter(s => s === 'render').length, 6); ok(stages.indexOf('extract') >= 0 && stages.indexOf('copy') >= 0 && stages.indexOf('export') >= 0, JSON.stringify(stages)); ok(states.every(s => s === 'done'), JSON.stringify(states));
  for (const s of await page.$$(R + '.st-centre summary')) await s.click();
  ok(/claude claude-/.test((await texts(page, R + '.st-joblog')).join(' ')), 'the job logs name the model calls');
  await page.click(R + '.st-railbtn:has-text("Client context")');
  await page.waitForSelector(R + '.st-ctx');
  const c = await page.textContent(R + '.st-ctx');
  ok(/Label the answer Fact/.test(c) && /more than any other industry/.test(c) && /300,000 Australians/.test(c) && /"subsidy"/.test(c) && /logo on file/.test(c) && /claude-opus-5-5/.test(c) && /No haul trucks/.test(c) && /campaign/.test(c), c.slice(0, 500));
  await shot(page, 'studio-context');
});
await t('P10: the Brand workspace names what the Studio knows with its authority and scope, holds the reasons given on approvals as proposals until a person keeps one, takes a named wordmark variant through the page, and the asset says what the Studio used', async () => {
  await page.click(R + '.st-railbtn:has-text("Brand")'); await page.waitForSelector(R + '.st-brand');
  const t0 = (await page.textContent(R + '.st-brand')).replace(/\s+/g, ' ');
  ok(/Brand workspace: Minerals Council of Australia/.test(t0) && /approved rule/.test(t0) && /Label the answer Fact/.test(t0) && /Readiness for Hands Off Our Fuel/.test(t0) && /whole client/.test(t0), t0.slice(0, 400));
  ok(/Proposed memory updates \(\d+\) - none applies until a person keeps it/.test(t0) && /client asked for the plain ask/.test(t0), 'the approval reasons wait as proposals');
  const nProp = +(t0.match(/Proposed memory updates \((\d+)\)/) || [])[1];
  await page.click(R + 'section[aria-label="Proposed memory updates"] .st-know-acts button:has-text("Keep")');
  await page.waitForFunction(n => { const el = document.querySelector('#studio-root .st-brand'); if (!el) return false; const m = el.textContent.match(/Proposed memory updates \((\d+)\)/); return !m ? n === 1 : +m[1] === n - 1; }, nProp);
  ok(/preference/.test(await page.textContent(R + 'section[aria-label="Preferences and decisions"]')), 'the kept proposal is a preference now');
  await page.selectOption(R + 'select[aria-label="Campaign scope"]', 'hoof'); await page.waitForSelector(R + '.st-upload');
  ok(/Hands Off Our Fuel/.test(await page.textContent(R + 'section[aria-label="Identity"]')));
  await page.setInputFiles(R + '.st-upload input[type=file]', { name: 'hoof-wordmark-white.png', mimeType: 'image/png', buffer: Buffer.from(PNG, 'base64') });
  await page.fill(R + '.st-upload input[aria-label="Variant name"]', 'white'); await page.selectOption(R + '.st-upload select[aria-label="Tone"]', 'light');
  await page.click(R + '.st-upload button:has-text("Save variant")');
  await page.waitForSelector(R + '.st-markcard:has-text("wordmark: white")', { timeout: 15000 });
  const kit = (await api('GET', '/brand/kit?ns=mca')).kit; const hoof = kit.campaigns.find(c => c.id === 'hoof');
  eq(hoof.wordmarks.map(w => [w.variant, w.tone]), [['white', 'light']], 'stored as a named, toned variant');
  ok(/light \(for dark grounds\)|light/.test(await page.textContent(R + '.st-markcard:has-text("wordmark: white")')) && await page.$(R + '.st-markcard:has-text("wordmark: white") .st-mark-grounds img'), 'shown on a light and a dark ground');
  ok(/Kit history/.test(await page.textContent(R + '.st-brand')) && /hoof wordmark variant white \(light, version/.test(await page.textContent(R + 'section[aria-label="Kit history"]')), 'the upload is in the kit history');
  await shot(page, 'studio-brand');
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await itab(page, 'Versions'); await page.waitForSelector(R + '.st-used');
  await page.click(R + '.st-used summary'); await page.waitForFunction(() => /Rules applied/.test(document.querySelector('#studio-root .st-used').textContent));
  const used = (await page.textContent(R + '.st-used')).replace(/\s+/g, ' ');
  ok(/Say more than any other industry/.test(used) && /Words and plan made as version/.test(used) && /Imagery rendered as version/.test(used) && /Nothing from another client/.test(used), used.slice(0, 600));
});
await t('an open brief, copy only: two distinct directions first, nothing produced until one is chosen; then copy-only assets with no render', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")');
  await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib-head .btn');
  await page.click(R + '.st-segbtn:has-text("A brief or one line")');
  await page.click(R + '.st-segbtn:has-text("Copy only")');
  await page.fill(R + '.st-intake textarea', 'Something for Victoria about regional jobs');
  ok(/open brief/.test(await page.textContent(R + '.st-intake-foot')));
  const g0 = calls.gemini;
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-dir', { timeout: 30000 });
  eq((await texts(page, R + '.st-dir')).length, 2); ok(!(await page.$(R + '.st-railbtn.asset')), 'no assets before a choice');
  ok(/nothing is produced until you do/.test(await page.textContent(R + '.st-thread')));
  await shot(page, 'studio-directions');
  await page.click(R + '.st-dir:first-child button:has-text("Choose this direction")');
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-railbtn.asset').length === 3, null, { timeout: 30000 });
  await page.waitForSelector(R + '.st-copycard');
  ok(/Copy only: no render spent/.test(await page.textContent(R + '.st-thread'))); eq(calls.gemini, g0, 'no render for copy-only work');
  eq(await texts(page, R + '.st-railbtn.asset'), ['LinkedIn copy 1:1v1', 'Instagram copy 4:5v1', 'Facebook copy 1:1v1']);
  ok(/from "The plain ask"/.test(await page.textContent(R + '.st-asset-head')));
});
await t('P12: the guided route drafts a creative strategy the team confirms, then directions with their medium, plan and diversity, then a campaign sequence planned in order and made with no image', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib-head .btn');
  await page.click(R + '.st-segbtn:has-text("Guided campaign development")'); await page.click(R + '.st-segbtn:has-text("A brief or one line")');
  await page.fill(R + '.st-intake textarea', 'Answer the subsidy framing for regional voters');
  ok(/Guided: a creative strategy to confirm, then three directions/.test(await page.textContent(R + '.st-intake-foot')));
  const g0 = calls.gemini;
  await page.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await page.waitForSelector(R + '.st-dir', { timeout: 30000 });
  await goStep(page, 'Brief'); await page.waitForSelector(R + '.st-strategy');
  const st = await page.textContent(R + '.st-strategy'); ok(/proposed - not yet confirmed/.test(st), st.slice(0, 200));
  eq(await page.inputValue(R + '.st-strategy label:has-text("Campaign idea") input'), 'It is your tractor too');
  await page.fill(R + '.st-strategy label:has-text("Campaign idea") input', 'It is your tractor too, and your truck');
  await page.click(R + '.st-strategy button:has-text("Confirm the strategy")');
  await page.waitForFunction(() => /confirmed/.test(document.querySelector('#studio-root .st-strategy .st-chip').textContent));
  eq(await page.inputValue(R + '.st-strategy label:has-text("Campaign idea") input'), 'It is your tractor too, and your truck');
  await goStep(page, 'Directions'); await page.waitForSelector(R + '.st-dir');
  ok(await page.$(R + 'select[aria-label="Exploration budget"]') && await page.$(R + 'button:has-text("Explore further")'), 'the exploration budget');
  await goView(page, 'Sequence'); await page.waitForSelector(R + '.st-seq');
  await page.selectOption(R + 'select[aria-label="Number of assets"]', '3');
  await page.click(R + '.st-seq button:has-text("Plan the sequence")');
  await page.waitForSelector(R + '.st-seq-card', { timeout: 30000 });
  const cards = await texts(page, R + '.st-seq-card'); eq(cards.length, 3);
  ok(/1\./.test(cards[0]) && /opener/.test(cards[0]) && /day 0/.test(cards[0]) && /name the myth/.test(cards[0]) && /call to action/.test(cards[2]), cards.join(' | ').slice(0, 400));
  eq((await page.$$(R + '.st-seq-card canvas')).length, 3, 'each drawn as an editable composition');
  eq(calls.gemini, g0, 'no image generated');
  await shot(page, 'studio-sequence');
});
await t('switching client shows only that client\'s work; coming back lists all three MCA projects', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")');
  await page.selectOption(R + '.st-head select', 'aep');
  await page.waitForFunction(() => { const h = document.querySelector('#studio-root .st-lib-head'); const l = document.querySelector('#studio-root .st-lib'); return h && l && /Australian Energy Producers/.test(h.textContent) && /No projects yet for Australian Energy Producers/.test(l.textContent); });
  await page.selectOption(R + '.st-head select', 'mca');
  await page.waitForFunction(() => document.querySelectorAll('#studio-root .st-lib tbody tr').length === 4);   // three projects and the legacy pack
});
await t('a legacy pack imports once into a project whose tile is flattened and marked not editable', async () => {
  await page.locator(R + 'tr.st-legacy').first().locator('.ov-link:has-text("import to Studio")').click();
  await page.waitForSelector(R + '.st-flatnote', { timeout: 15000 });
  ok(/flattened legacy tile: the text on the image is not editable/.test(await page.textContent(R + '.st-flatnote')));
  ok(/original is untouched/.test(await page.textContent(R + '.st-thread')));
  ok(await page.$(R + '.st-field:nth-of-type(1) input:disabled'), 'headline disabled on a flattened tile');
  ok(/imported from rp:rp1/.test(await page.textContent(R + '.st-head')));
});
await t('the Release Desk and Content Desk entry points open the Studio intake with the right preset; the Sentinel hook does too; their nav buttons are gone and the mobile tab bar scrolls', async () => {
  eq(await page.$$eval('#studio-root ~ *, .rbtn[data-v="release"], .rbtn[data-v="content"], .tab[data-v="release"], .tab[data-v="content"]', els => els.filter(e => e.matches('.rbtn,.tab')).length), 0, 'no Release Desk or Content Desk buttons');
  await page.evaluate(() => go('release'));
  await page.waitForSelector(R + '.st-intake', { timeout: 10000 });
  ok(/The Release Desk is this intake now/.test(await page.textContent(R + '.st-intake')));
  ok(await page.$(R + '.st-segbtn.on:has-text("A release or source document")'), 'release preset');
  await page.evaluate(() => go('content'));
  await page.waitForFunction(() => /The Content Desk is this intake now/.test(document.querySelector('#studio-root .st-intake').textContent));
  ok(await page.$(R + '.st-segbtn.on:has-text("Copy only")'), 'copy preset');
  await page.evaluate(() => AXUI.goto('studio', { ns: 'mca', intake: 'brief', deliverable: 'set', text: 'BREAKING - fuel tax credits spiking', from: 'sentinel' }));
  await page.waitForFunction(() => /Drafted from a Sentinel alert/.test((document.querySelector('#studio-root .st-intake') || {}).textContent || ''));
  eq(await page.inputValue(R + '.st-intake textarea'), 'BREAKING - fuel tax credits spiking');
  eq(await page.$eval('.tabs-in', el => getComputedStyle(el).overflowX), 'auto', 'the mobile tab bar scrolls sideways');
  await page.click(R + '.st-intake-foot .btn:has-text("Cancel")');
});
await t('the layout editor moves a layer by drag and saves a layout version with no render; the Client panel opens the voice profile editor and the learned rules', async () => {
  await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits keep regional Australia moving") .ov-link');
  await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-railbtn.asset:has-text("LinkedIn post")'); await page.waitForSelector(R + '.st-stage canvas');
  const vBefore = +((await page.textContent(R + '.st-asset-head')).match(/v(\d+) of/) || [])[1]; const g0 = calls.gemini;
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")');
  await page.waitForSelector(R + '.st-le-layer');
  const hl = await page.$(R + '.st-le-layer[aria-label="Layer headline"]'); const bb = await hl.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + bb.width / 2 + 60, bb.y + bb.height / 2 - 40, { steps: 6 }); await page.mouse.up();
  await page.click(R + '.st-le-wrap .btn:has-text("Save layout")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), vBefore, { timeout: 15000 });
  ok(/layout edited by hand/.test(await page.textContent(R + '.st-asset-head'))); eq(calls.gemini, g0, 'no render for a layout edit');
  const proj = await page.evaluate(() => document.querySelector('#studio-root .st-head b').textContent);
  const row = env.MIND_DB.db.prepare("SELECT v.layout FROM studio_versions v JOIN studio_assets a ON a.id=v.asset WHERE a.title='LinkedIn post' ORDER BY v.created DESC LIMIT 1").get();
  const hlL = JSON.parse(row.layout).layers.find(l => l.role === 'headline'); ok(hlL.x > 9.5 && hlL.y < 55, 'the headline moved right and up: ' + JSON.stringify([hlL.x, hlL.y]));
  await page.click(R + '.st-railbtn:has-text("Client context")');
  await page.waitForSelector(R + '.st-ctx');
  await page.click(R + 'button:has-text("Edit voice profile")');
  await page.waitForSelector(R + '.cd-voice', { timeout: 10000 });
  ok(/Voice profile - MCA/.test(await page.textContent(R + '.cd-voice')));
  await page.click(R + '.cd-voice button:has-text("Close")');
  await page.click(R + 'button:has-text("Learned rules")');
  await page.waitForSelector(R + '.st-panel-dialog table');
  const rows = await texts(page, R + '.st-panel-dialog tbody tr'); ok(rows.some(r => /haul trucks/.test(r) && /campaign hoof/.test(r)) && rows.some(r => /more than any other industry/.test(r)), JSON.stringify(rows));
  await page.click(R + '.st-panel-dialog tbody tr:first-child .ov-link:has-text("switch off")');
  await page.waitForFunction(() => /switch on/.test(document.querySelector('#studio-root .st-panel-dialog tbody tr:first-child').textContent), null, { timeout: 10000 });
  await page.click(R + '.st-panel-dialog button:has-text("Close")');
  await shot(page, 'studio-client');
});
await t('P13: the canvas undoes and redoes, aligns, reorders, groups and moves a group, edits the type of one layer, shows safe-area guides and measures as it goes; Board and the Copy deck show the whole project', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits keep regional Australia moving") .ov-link'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-railbtn.asset:has-text("LinkedIn post")'); await page.waitForSelector(R + '.st-stage canvas');
  const vBefore = +((await page.textContent(R + '.st-asset-head')).match(/v(\d+) of/) || [])[1]; const g0 = calls.gemini;
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-tools');
  const layerOf = async role => (await page.$eval(R + '.st-le-layer[aria-label="Layer ' + role + '"]', el => ({ left: el.style.left, top: el.style.top })));
  const h0 = await layerOf('headline');
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  await page.click(R + '.st-le-tools button:has-text("Align left")');
  const h1 = await layerOf('headline'); eq(h1.left, '3%', 'one layer aligns to the stage margin');
  await page.click(R + '.st-le-tools button:has-text("Undo")'); eq((await layerOf('headline')).left, h0.left, 'undo restores it');
  await page.click(R + '.st-le-tools button:has-text("Redo")'); eq((await layerOf('headline')).left, '3%', 'redo applies it again');
  await page.focus(R + '.st-le-layer[aria-label="Layer headline"]'); await page.keyboard.press('Control+z'); eq((await layerOf('headline')).left, h0.left, 'Ctrl+Z undoes from the keyboard');
  // select headline and support together (Shift-click), group them, then move the group with the keyboard
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.click(R + '.st-le-layer[aria-label="Layer support"]', { modifiers: ['Shift'] });
  await page.click(R + '.st-le-tools button:has-text("Group")');
  const s0 = await layerOf('support'); const hA = await layerOf('headline');
  await page.click(R + '.st-le-layer[aria-label="Layer support"]'); await page.keyboard.press('Shift+ArrowUp');
  const s1 = await layerOf('support'), hB = await layerOf('headline');
  ok(parseFloat(s1.top) === Math.round((parseFloat(s0.top) - 2) * 10) / 10 && parseFloat(hB.top) === Math.round((parseFloat(hA.top) - 2) * 10) / 10, 'the grouped layers moved together: ' + JSON.stringify([s0, s1, hA, hB]));
  // reorder: the list runs front to back
  const order0 = await texts(page, R + '.st-le-item'); await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.click(R + '.st-le-tools button:has-text("To back")');
  const order1 = await texts(page, R + '.st-le-item'); ok(/headline|support/.test(order1[order1.length - 1]) && /headline|support/.test(order1[order1.length - 2]) && JSON.stringify(order0) !== JSON.stringify(order1), 'the headline and its group are now at the back: ' + order1.join(' | '));
  await page.click(R + '.st-le-tools button:has-text("To front")');
  // typography of one text layer
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]'); await page.waitForSelector(R + '.st-le-type');
  await page.fill(R + '.st-le-type input[aria-label="Type size, per cent of the width"]', '5.2'); await page.press(R + '.st-le-type input[aria-label="Type size, per cent of the width"]', 'Enter');
  await page.selectOption(R + '.st-le-type select[aria-label="Text alignment"]', 'center');
  ok(await page.$(R + '.st-le-guide'), 'the 3% guide is drawn');
  await page.waitForSelector(R + '.st-le-val'); ok(/Measured at 1080x1080/.test(await page.textContent(R + '.st-le-val')), 'measured at the output size while editing');
  await page.click(R + '.st-le-wrap .btn:has-text("Save layout")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), vBefore, { timeout: 15000 });
  eq(calls.gemini, g0, 'no render for any of it');
  const row = env.MIND_DB.db.prepare("SELECT v.layout FROM studio_versions v JOIN studio_assets a ON a.id=v.asset WHERE a.title='LinkedIn post' ORDER BY v.created DESC LIMIT 1").get();
  const L = JSON.parse(row.layout); const hl = L.layers.find(l => l.role === 'headline'), sp = L.layers.find(l => l.role === 'support');
  ok(hl.size === 5.2 && hl.align === 'center' && hl.group && hl.group === sp.group, 'type, alignment and the group saved: ' + JSON.stringify([hl.size, hl.align, hl.group, sp.group]));
  await goView(page, 'Board'); await page.waitForSelector(R + '.st-board-card');
  ok((await texts(page, R + '.st-board-card')).some(x => /LinkedIn post/.test(x) && /(validated|not validated|stale|failing)/.test(x)), 'the board shows each asset and where it stands');
  await goView(page, 'Copy deck'); await page.waitForSelector(R + '.st-copydeck table');
  const cap = R + '.st-copydeck textarea[aria-label="caption of LinkedIn post"]'; const v0 = +((await texts(page, R + '.st-copydeck tbody tr')).find(x => /LinkedIn post/.test(x)).match(/v(\d+)/) || [])[1];
  await page.fill(cap, 'Fuel tax credits return a road tax. That is all.'); await page.click(R + '.st-copydeck .ov-title');
  await page.waitForFunction(v => [...document.querySelectorAll('#studio-root .st-copydeck tbody tr')].some(r => /LinkedIn post/.test(r.textContent) && new RegExp(', v' + (v + 1) + '(?!\\d)').test(r.textContent)), v0, { timeout: 15000 });
  await shot(page, 'studio-canvas');
});
await t('P14: Production lists what a kit change made stale with a free re-check, estimates recipes before they run, asks before a recipe that renders, runs a chained recipe step after step and counts what the project actually spent', async () => {
  await api('POST', '/brand/kit', { ns: 'mca', banned: [{ term: 'subsidy', use: 'credit', why: 'it is not one', allowNegated: true }, { term: 'handout', use: 'credit', why: 'house style' }] });
  await goView(page, 'Recipes and usage'); await page.waitForSelector(R + '.st-prod table[aria-label="Recipes"]');
  const impact = await texts(page, R + '.st-prod table[aria-label="Impact"] tbody tr'); ok(impact.some(x => /kit changed since the words were written/.test(x) && /banned terms/.test(x) && /free/.test(x)), JSON.stringify(impact).slice(0, 400));
  const a0 = calls.anthropic, g0 = calls.gemini;
  await page.locator(R + '.st-prod table[aria-label="Impact"] tbody tr').filter({ hasText: 'kit changed' }).first().locator('button:has-text("Re-check")').click();
  await page.waitForSelector(R + '.st-prod-done'); ok(/Re-checked/.test(await page.textContent(R + '.st-prod-done')));
  eq([calls.anthropic, calls.gemini], [a0, g0], 'the re-check made no model call');
  // a recipe that renders is announced first; dismissing it starts nothing
  let asked = ''; page.once('dialog', d => { asked = d.message(); d.dismiss(); });
  const rel = page.locator(R + '.st-prod table[aria-label="Recipes"] tbody tr').filter({ hasText: 'Release to a coordinated set' });
  await rel.locator('button:has-text("Run")').click(); await page.waitForFunction(() => !/Starting/.test(document.querySelector('#studio-root .st-prod table[aria-label="Recipes"]').textContent));
  ok(/would generate about \d+ image/.test(asked), 'asked first: ' + asked); ok(/\d+ calls?, \d+ images?/.test(await rel.textContent()), 'the estimate is shown');
  eq(env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_jobs WHERE recipe='builtin:release-set'").get().n, 0, 'nothing started');
  // a recipe with no image runs without a prompt, each step after the one before
  const seq = page.locator(R + '.st-prod table[aria-label="Recipes"] tbody tr').filter({ hasText: 'four-asset sequence' });
  await seq.locator('button:has-text("estimate")').click(); await page.waitForFunction(() => /2 calls, 0 images/.test([...document.querySelectorAll('#studio-root .st-prod table[aria-label="Recipes"] tbody tr')].find(r => /four-asset sequence/.test(r.textContent)).textContent));
  const g1 = calls.gemini; await seq.locator('button:has-text("Run")').click();
  for (let i = 0; i < 80; i++) { const rows = env.MIND_DB.db.prepare("SELECT state FROM studio_jobs WHERE recipe='builtin:sequence'").all(); if (rows.length === 2 && rows.every(r => r.state === 'done')) break; await new Promise(r => setTimeout(r, 250)); }
  const jobs = env.MIND_DB.db.prepare("SELECT id, stage, state, after FROM studio_jobs WHERE recipe='builtin:sequence' ORDER BY created").all();
  eq(jobs.map(j => j.stage + ':' + j.state), ['strategy:done', 'sequence:done']); eq(jobs[1].after, jobs[0].id, 'the sequence waited for the strategy'); eq(calls.gemini, g1, 'no image for this recipe');
  await page.waitForFunction(() => /model calls?/.test((document.querySelector('#studio-root .st-prod-use') || {}).textContent || ''));
  const use = await page.textContent(R + '.st-prod-use'); ok(/\d+ model calls?/.test(use) && /free versions/.test(use), use);
  ok(/Recipe "Strategy, then a four-asset sequence/.test(await page.textContent(R + '.st-thread')), 'the run is on the thread');
  await shot(page, 'studio-production');
});
await t('P15: the library shows outcome metrics for the client against the previous window and the desks, with the isolation audit, at no model cost', async () => {
  const a0 = calls.anthropic, g0 = calls.gemini;
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-metrics .ov-link:has-text("Outcome metrics")'); await page.waitForSelector(R + 'table[aria-label="Outcome metrics"]');
  const rows = await texts(page, R + 'table[aria-label="Outcome metrics"] tbody tr');
  ok(rows.some(r => /Work started/.test(r) && /projects?/.test(r)) && rows.some(r => /Time to first draft/.test(r) && /\(n \d+\)/.test(r)) && rows.some(r => /Spend per approved asset/.test(r) && /not recorded/.test(r)), JSON.stringify(rows).slice(0, 600));
  ok(/Isolation: clean/.test(await page.textContent(R + '.st-iso')), await page.textContent(R + '.st-iso'));
  ok(/The desks never recorded/.test(await page.textContent(R + '.st-metrics')));
  eq([calls.anthropic, calls.gemini], [a0, g0], 'metrics cost nothing');
  await shot(page, 'studio-metrics');
});
await t('P17: an area of the imagery is marked by typing it, edited with one image call that leaves the words alone, and the change outside the area is measured in the browser and shown against the version it came from', async () => {
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits keep regional Australia moving") .ov-link'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await page.waitForSelector(R + '.st-stage canvas');
  const vBefore = +((await page.textContent(R + '.st-asset-head')).match(/v(\d+) of/) || [])[1]; const g0 = calls.gemini;
  await page.click(R + '.st-ad-quick .ov-link:has-text("Edit an area of the imagery")'); await page.waitForSelector(R + '.st-areaedit');
  ok(/not a pixel mask/.test(await page.textContent(R + '.st-areaedit')), 'the limit is said before anything is spent');
  ok(await page.isDisabled(R + '.st-areaedit .btn:has-text("Edit (1 image")'), 'nothing to edit until the area and the instruction are given');
  for (const [k, val] of [['from left', '55'], ['from top', '5'], ['width', '40'], ['height', '30']]) await page.fill(R + '.st-areaedit input[aria-label="Area ' + k + ', per cent"]', val);
  ok(await page.$(R + '.st-area-box'), 'the area is drawn on the image');
  await page.fill(R + '.st-areaedit textarea', 'remove the sign on the fence'); await page.selectOption(R + '.st-areaedit select', '1K');
  await page.click(R + '.st-areaedit .btn:has-text("Edit (1 image at 1K)")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), vBefore, { timeout: 20000 });
  eq(calls.gemini - g0, 1, 'one image call');
  await page.waitForFunction(() => /mean change outside the marked area/.test((document.querySelector('#studio-root .st-preserve') || {}).textContent || ''), null, { timeout: 15000 });
  const card = await page.textContent(R + '.st-preserve'); ok(/Area edit/.test(card) && /remove the sign on the fence/.test(card) && /(held|drifted|changed)/.test(card) && /compare v\d+ and this version/.test(card), card);
  const row = env.MIND_DB.db.prepare("SELECT v.copy, v.image FROM studio_versions v JOIN studio_assets a ON a.id=v.asset WHERE a.title='Facebook post' ORDER BY v.created DESC LIMIT 2").all();
  eq(row[0].copy, row[1].copy, 'the words were not touched'); ok(JSON.parse(row[0].image).meta.edit.area.x === 55, 'the area travelled to the worker');
  await page.click(R + '.st-preserve .ov-link:has-text("compare")'); await page.waitForSelector(R + '.st-compare, ' + R + '.st-cmp', { timeout: 5000 }).catch(() => {});
  await shot(page, 'studio-area-edit');
});
await t('P20: the canvas resizes a text box without changing its type, sets line height, panel opacity and the framing of the photograph with no render; Explore layouts proposes arrangements of the same photograph and words; a focused Partner edit names what moved and what was left', async () => {
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits keep regional Australia moving") .ov-link'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await page.waitForSelector(R + '.st-stage canvas');
  const head = async () => +((await page.textContent(R + '.st-asset-head')).match(/v(\d+) of/) || [])[1];
  const v0 = await head(); const g0 = calls.gemini;
  const latest = () => JSON.parse(env.MIND_DB.db.prepare("SELECT v.layout FROM studio_versions v JOIN studio_assets a ON a.id=v.asset WHERE a.title='Facebook post' ORDER BY v.created DESC LIMIT 1").get().layout);
  const L0 = latest(); const hl0 = L0.layers.find(l => l.role === 'headline');
  await page.click(R + '.st-asset-acts button:has-text("Edit layout")'); await page.waitForSelector(R + '.st-le-tools');
  ok(!(await page.isChecked(R + '.st-le-tools input[aria-label="Resize scales type"]')), 'resizing the box leaves the type alone by default');
  await page.click(R + '.st-le-layer[aria-label="Layer headline"]');
  const hb = await page.$(R + '.st-le-layer[aria-label="Layer headline"] .st-le-h'); const bb = await hb.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x - 60, bb.y + 30, { steps: 4 }); await page.mouse.up();
  await page.waitForSelector(R + '.st-le-type[aria-label="Position and size"]');
  const wNow = +(await page.inputValue(R + '.st-le-type input[aria-label="Width, per cent of the stage"]'));
  ok(wNow < hl0.w, 'the box is narrower: ' + wNow + ' < ' + hl0.w); eq(+(await page.inputValue(R + '.st-le-type input[aria-label="Type size, per cent of the width"]')), hl0.size, 'the type kept its size');
  await page.fill(R + '.st-le-type input[aria-label="Line height, times the type size"]', '1.3'); await page.press(R + '.st-le-type input[aria-label="Line height, times the type size"]', 'Enter');
  await page.fill(R + '.st-le-type input[aria-label="X, per cent of the stage"]', '9'); await page.press(R + '.st-le-type input[aria-label="X, per cent of the stage"]', 'Enter');
  const shapeRole = (L0.layers.find(l => l.type === 'shape' && !l.locked && !l.hidden) || {}).role;
  if (shapeRole) { await page.click(R + '.st-le-item .ov-link:text-is("' + shapeRole + '")'); await page.fill(R + '.st-le-type input[aria-label="Panel opacity"]', '0.6'); await page.press(R + '.st-le-type input[aria-label="Panel opacity"]', 'Enter'); }
  await page.waitForSelector(R + '.st-le-type[aria-label="Image framing"]');
  await page.fill(R + '.st-le-type input[aria-label="Image zoom"]', '1.5'); await page.press(R + '.st-le-type input[aria-label="Image zoom"]', 'Enter');
  ok(/no render/.test(await page.textContent(R + '.st-le-type[aria-label="Image framing"]')), 'reframing says it spends nothing');
  await page.click(R + '.st-le-wrap .btn:has-text("Save layout")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), v0, { timeout: 15000 });
  const L1 = latest(); const hl1 = L1.layers.find(l => l.role === 'headline');
  eq([hl1.size, hl1.lineHeight, hl1.x, L1.imageFocus && L1.imageFocus.zoom], [hl0.size, 1.3, 9, 1.5]); ok(hl1.w < hl0.w, 'the narrower box saved');
  if (shapeRole) eq(L1.layers.find(l => l.role === shapeRole).opacity, 0.6);
  // Explore layouts: the same photograph and words, three arrangements, layout only
  const v1 = await head();
  await page.click(R + '.st-ad-actions button:has-text("Explore layouts")');
  await page.waitForFunction(() => /Layouts/.test((document.querySelector('#studio-root .st-ad-crit') || {}).textContent || ''), null, { timeout: 20000 });
  ok(/Same photograph and approved words in each/.test(await page.textContent(R + '.st-ad-crit')), 'the card set says what is held');
  const cards = await texts(page, R + '.st-ad-card'); eq(cards.length, 3); ok(cards.every(c => /layout only, no render/.test(c) && /% from current/.test(c)), cards.join(' || '));
  await page.click(R + '.st-ad-card:has-text("Bottom band") .btn:has-text("Apply layout only")');
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), v1, { timeout: 15000 });
  const rows = env.MIND_DB.db.prepare("SELECT v.copy, v.image, v.kind FROM studio_versions v JOIN studio_assets a ON a.id=v.asset WHERE a.title='Facebook post' ORDER BY v.created DESC LIMIT 2").all();
  eq([rows[0].kind, rows[0].copy, JSON.parse(rows[0].image).key], ['layout', rows[1].copy, JSON.parse(rows[1].image).key], 'same words and photograph');
  // a focused Partner edit: only the CTA moves, and the thread says what moved, what was left and that nothing rendered
  const v2 = await head();
  await itab(page, 'Art Director'); await page.fill(R + '.st-composer textarea', 'Move only the CTA to the right'); await page.click(R + '.st-composer .btn:has-text("Send")');
  await page.waitForSelector(R + '.st-focused', { timeout: 20000 });
  const fx = await page.textContent(R + '.st-focused'); ok(/Changed/.test(fx) && /x/.test(fx) && /Left as they were: .*headline|Left as they were/.test(fx) && /no render/.test(fx), fx);
  await page.waitForFunction(v => new RegExp('v' + (v + 1) + ' of').test(document.querySelector('#studio-root .st-asset-head').textContent), v2, { timeout: 15000 });
  eq(calls.gemini, g0, 'no image call for any of it');
  await shot(page, 'studio-p20');
});
await t('P21: a reference recipe is set in the References view and reaches the concepts, whose cards name each influence and mark one outside the recipe; the asset lists the compiled instructions behind it and opens one; Production states what each operation cannot do', async () => {
  const pid = env.MIND_DB.db.prepare("SELECT id FROM studio_projects WHERE title LIKE 'Fuel tax credits keep regional Australia moving%' ORDER BY created LIMIT 1").get().id;
  await api('POST', '/studio/reference', { project: pid, name: 'Editorial grid', purpose: 'typography', imageB64: PNG, mime: 'image/png' });
  await page.click(R + '.st-head .ov-link:has-text("projects")'); await page.waitForSelector(R + '.st-lib tbody tr');
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits keep regional Australia moving") .ov-link'); await page.waitForSelector(R + '.st-asset', { timeout: 15000 });
  await goView(page, 'References'); await page.waitForSelector(R + '.st-ref:has-text("Editorial grid")');
  await page.click(R + '.st-ref:has-text("Editorial grid") .ov-link:has-text("set a recipe")'); await page.waitForSelector(R + '.st-recipe');
  await page.selectOption(R + '.st-recipe select[aria-label="typography from Editorial grid"]', 'borrow');
  await page.selectOption(R + '.st-recipe select[aria-label="colour from Editorial grid"]', 'exclude');
  await page.click(R + '.st-recipe .btn:has-text("Save recipe")');
  await page.waitForFunction(() => /borrow typography; do not take colour/.test((document.querySelector('#studio-root .st-ref-recipe') ? [...document.querySelectorAll('#studio-root .st-ref')].map(x => x.textContent).join(' ') : '')), null, { timeout: 15000 });
  await page.click(R + '.st-railbtn.asset:has-text("Facebook post")'); await page.waitForSelector(R + '.st-stage canvas');
  await page.click(R + '.st-ad-actions button:has-text("Explore layouts")');
  await page.waitForSelector(R + '.st-influence', { timeout: 20000 });
  const inf = await page.textContent(R + '.st-influence'); ok(/typography from Editorial grid/.test(inf) && /colour from Editorial grid \(outside the recipe\)/.test(inf), inf);
  const cj = env.MIND_DB.db.prepare("SELECT id FROM studio_jobs WHERE stage='concepts' ORDER BY created DESC LIMIT 1").get().id;
  const rec = await api('GET', '/studio/compiled?job=' + cj); ok(/Editorial grid \(typography\) BORROW ONLY: typography\. DO NOT TAKE: colour\./.test(rec.calls[0].user), 'the recipe was in the prompt the model received');
  await page.click(R + '.st-ad-card:has-text("Right column") .btn:has-text("Apply layout only")');
  await page.waitForFunction(() => /applied as version/.test((document.querySelector('#studio-root .st-ad-card') || {}).textContent || '') || [...document.querySelectorAll('#studio-root .st-ad-card')].some(c => /applied as version/.test(c.textContent)), null, { timeout: 15000 });
  await itab(page, 'Versions'); await page.click(R + '.st-used summary'); await page.waitForSelector(R + '.st-compiled', { timeout: 15000 });
  const cl = await page.textContent(R + '.st-compiled'); ok(/Compiled instructions/.test(cl) && /the concept \(concepts, \d+ calls?\)/.test(cl), cl);
  await page.click(R + '.st-compiled .ov-link:has-text("the concept")'); await page.waitForSelector(R + '.st-compiled-call');
  const one = await page.textContent(R + '.st-compiled-call'); ok(/Language model/.test(one) && /effort high/.test(one) && /system \(\d+ characters\)/.test(one), one);
  ok((await page.textContent(R + '.st-used')).includes('Reference influence'), 'the used panel names the influences');
  await goView(page, 'Recipes and usage'); await page.waitForSelector(R + '.st-caps table', { timeout: 15000 });
  const caps = await page.textContent(R + '.st-caps'); ok(/Pixel masks: not supported/.test(caps) && /render/.test(caps) && /real output not reviewed/.test(caps), caps.slice(0, 300));
  await shot(page, 'studio-p21');
});
await page.close();
await t('a read-only key reviews everything and changes nothing: no composer, locks, approvals or new project; export is offered', async () => {
  const p2 = await open('read');
  await p2.waitForSelector(R + '.st-lib tbody tr');
  ok(!(await p2.$(R + '.st-lib-head .btn')), 'no New project');
  await p2.click(R + '.st-lib tbody tr:first-child .ov-link');
  await p2.waitForSelector(R + '.st-asset', { timeout: 15000 });
  ok(!(await p2.$(R + '.st-composer')), 'no composer'); ok(/needs a full key/.test(await p2.textContent(R + '.st-partner')));
  ok(!(await p2.$(R + '.st-lock')), 'no locks'); ok(!(await p2.$(R + '.st-appr .btn')), 'no approve buttons');
  ok(await p2.$(R + '.st-step:has-text("Export")'), 'export available');
  await p2.close();
});
await t('P8: with two campaigns the intake chooses none until the team does; the brief offers sourced suggestions in editable fields, design requirements in three bands and the check before anything is spent; the art director inspected the composed tile, not the imagery alone', async () => {
  await api('POST', '/brand/kit', { ns: 'mca', campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', cta: 'handsoffourfuel.com.au' }, { id: 'national', name: 'Australian mining' }] });
  const pg = await open();
  await pg.selectOption(R + '.st-head select', 'aep'); await pg.waitForFunction(() => /Australian Energy Producers/.test((document.querySelector('#studio-root .st-lib-head') || {}).textContent || ''));
  await pg.selectOption(R + '.st-head select', 'mca'); await pg.waitForSelector(R + '.st-lib tbody tr');
  await pg.click(R + '.st-lib-head .btn'); await pg.waitForSelector(R + '.st-intake');
  eq(await pg.inputValue(R + '.st-intake select'), '__', 'no campaign is assumed'); ok(/the first is not assumed/.test(await pg.textContent(R + '.st-intake')));
  await pg.click(R + '.st-segbtn:has-text("A brief or one line")'); await pg.fill(R + '.st-intake textarea', 'Something about the subsidy framing');
  ok(await pg.isDisabled(R + '.st-intake-foot .btn:has-text("Create project")'), 'create waits for the campaign');
  await pg.selectOption(R + '.st-intake select', 'hoof'); ok(!(await pg.isDisabled(R + '.st-intake-foot .btn:has-text("Create project")')));
  await pg.click(R + '.st-intake-foot .btn:has-text("Create project")');
  await pg.waitForSelector(R + '.st-dir', { timeout: 30000 });
  await goStep(pg, 'Brief'); await pg.waitForSelector(R + '.st-combo');
  await pg.waitForFunction(() => /Suggestions come from/.test(document.querySelector('#studio-root .st-centre').textContent));
  const actionOpts = await texts(pg, R + '.st-field:has(#brief-action) .st-combo-opt'); ok(actionOpts.some(o => /approved/.test(o) && /handsoffourfuel\.com\.au/.test(o)), JSON.stringify(actionOpts));
  await pg.locator(R + '.st-field:has(#brief-action) .st-combo-opt').filter({ hasText: 'handsoffourfuel.com.au' }).first().click();
  eq(await pg.inputValue(R + '#brief-action'), 'handsoffourfuel.com.au'); ok(/approved/.test(await pg.textContent(R + '.st-field:has(#brief-action) .st-lbl')), 'the source travels with the value');
  ok(/mandatory/.test(await pg.textContent(R + '.st-reqs')) && /preferred/.test(await pg.textContent(R + '.st-reqs')) && /open/.test(await pg.textContent(R + '.st-reqs')), 'three bands');
  await pg.fill(R + '#req-mandatory', 'Red MYTH label'); await pg.click(R + '.st-req-band.mandatory .ov-link:has-text("add as written")');
  ok(/Red MYTH label/.test(await pg.textContent(R + '.st-req-band.mandatory')));
  await pg.click(R + '.st-stagehead .btn:has-text("Save brief")'); await pg.waitForFunction(() => !document.querySelector('#studio-root .st-dirty'));
  const pj = env.MIND_DB.db.prepare("SELECT brief FROM studio_projects ORDER BY created DESC LIMIT 1").get(); const b = JSON.parse(pj.brief);
  eq([b.action, b.actionSource, b.requirements.mandatory[0].text, b.requirements.mandatory[0].source], ['handsoffourfuel.com.au', 'approved', 'Red MYTH label', 'team']);
  await pg.waitForFunction(() => /Before anything is spent/.test(document.querySelector('#studio-root .st-check-panel').textContent) && !/Checking the brief/.test(document.querySelector('#studio-root .st-check-panel').textContent));
  ok(/Campaign Hands Off Our Fuel: mark policy/.test(await pg.textContent(R + '.st-check-panel')), await pg.textContent(R + '.st-check-panel'));
  eq(await pg.inputValue(R + '.st-produce select'), '2K'); await pg.selectOption(R + '.st-produce select', '1K');
  // the inspections that ran in this session saw the composed tile the browser saved before they ran
  const ins = env.MIND_DB.db.prepare("SELECT data FROM studio_events WHERE kind='inspection'").all().map(r => JSON.parse(r.data)).filter(d => d.scores);
  ok(ins.length && ins.every(d => d.composed === true), 'every inspection read the composed export: ' + JSON.stringify(ins.map(d => d.composed)));
  ok(Array.from(r2.keys()).some(k => /-export\.png$/.test(k)), 'the composed PNG was saved');
  await shot(pg, 'studio-brief'); await pg.close();
});
await browser.close(); server.kill();
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
