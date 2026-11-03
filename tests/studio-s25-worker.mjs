/* S25 (3 November 2026): an upstream change never leaves downstream work stale in silence. In a guided project, choosing another
 * direction after copy was written from the first one used to happen without a word (the browser asked a yes/no question that
 * named nothing, and the worker recorded nothing). Now the worker names the pieces written from another direction and asks first
 * (409 affects_downstream, impact.kind 'direction'); the answer is sent with the choice: 'update' marks them for a rewrite from
 * the new direction in Copy (nothing regenerated, nothing deleted), 'keep' keeps them current under it; the Copy step says which
 * pieces they are, and the keep step clears them one by one. A variant family produced from several directions on purpose is
 * never "another direction". Providers MOCKED. Run: node --experimental-sqlite tests/studio-s25-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { answerFor } from './studio-answers.mjs';
import { pngB64 } from './png.mjs';
const T = suite('studio-s25-worker (a direction change names the pieces it leaves behind and asks: update, keep or cancel)');
const PNG = pngB64(16, 16, { fill: 0x11 });
const w = await workerEnv({ env: { ANTHROPIC_API_KEY: 'test', GEMINI_KEY: 'g' } });
const anth = [];
w.answer(/api\.anthropic\.com\/v1\/messages/, async (u, init) => {
  const body = JSON.parse(init.body); const sys = String(body.system || ''); const c0 = body.messages[0].content; const user = typeof c0 === 'string' ? c0 : c0.filter(x => x.type === 'text').map(x => x.text).join('');
  anth.push({ sys, user });
  return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(answerFor(sys, user)) }], stop_reason: 'end_turn', model: body.model }), { status: 200 });
});
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const run = async job => { let j = job; for (let i = 0; i < 6 && (j.state === 'queued' || j.state === 'running'); i++) j = (await call('POST', '/studio/job/step', { id: j.id })).body.job; return j; };
const stage = async (P, st, input) => { const r = await call('POST', '/studio/job', { project: P, stage: st, input, idem: st + ':' + Math.random() }); if (!r.body || !r.body.job) throw new Error('job not created: ' + JSON.stringify(r.body)); return run(r.body.job); };
const get = async P => (await call('GET', '/studio/get?id=' + P)).body;

await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain, factual, regional.',
  campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], logoB64: PNG, logoMime: 'image/png' });
const BRIEF = { workflow: 2, projectType: 'response', campaignMode: 'existing', channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, campaignConfirmed: true, creationMode: 'editable', imageryTiming: 'after_copy' };
async function guidedToCopy(title) {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title, brief: BRIEF })).body.id;
  const s1 = (await call('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Client note', text: 'Fuel tax credits are under attack: a crossbencher called the credit a subsidy for miners.\n\nPlease respond on social this week, regional focus.' })).body.id;
  eq((await stage(P, 'analyse', { sources: [s1], kind: 'brief' })).state, 'done');
  eq((await call('POST', '/studio/workflow/confirm', { project: P, step: 'brief' })).status, 200);
  eq((await call('POST', '/studio/workflow/confirm', { project: P, step: 'objectives', objective: 'O1', message: 'M1.1' })).status, 200);
  eq((await call('POST', '/studio/workflow/confirm', { project: P, step: 'strategy', strategy: 'S1', campaign: 'national' })).status, 200);
  eq((await stage(P, 'direct', { n: 3 })).state, 'done');
  const D = (await get(P)).directions.map(d => d.id);
  eq((await call('POST', '/studio/direction/choose', { id: D[0] })).status, 200, 'the first choice, with nothing written yet, asks nothing');
  eq((await stage(P, 'copy', { channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, size: '2K' })).state, 'done');
  return { P, D, A: (await get(P)).assets.map(a => a.id) };
}

await T.t('choosing another direction after copy was written from the first names the pieces and asks first; nothing changes until answered', async () => {
  const { P, D, A } = await guidedToCopy('Direction change: cancel');
  const r = await call('POST', '/studio/direction/choose', { id: D[1] });
  eq([r.status, r.body.error], [409, 'affects_downstream'], JSON.stringify(r.body).slice(0, 300));
  const im = r.body.impact; eq(im.kind, 'direction'); eq(im.assets, 2); ok(im.items.every(x => A.indexOf(x.id) >= 0 && x.title && x.from), JSON.stringify(im.items));
  ok(im.from && im.to && /rewrite .* or keep/.test(r.body.detail), r.body.detail);
  const g = await get(P); eq(g.directions.find(d => d.chosen).id, D[0], 'cancel is not answering: the first direction stays chosen');
  ok(!g.thread.some(e => e.kind === 'direction' && /Direction chosen/.test(e.text || '') && e.direction === D[1]), 'and no choice was recorded');
});

await T.t('update: the new direction is chosen and the pieces are marked in Copy for a rewrite from it - named, not regenerated, not deleted', async () => {
  const { P, D, A } = await guidedToCopy('Direction change: update');
  const before = await get(P); const vBefore = before.assets.map(a => a.current);
  const r = await call('POST', '/studio/direction/choose', { id: D[1], decision: 'update' }); eq(r.status, 200, JSON.stringify(r.body));
  const g = await get(P); eq(g.directions.find(d => d.chosen).id, D[1]);
  eq(g.assets.map(a => a.current), vBefore, 'no version was written: nothing regenerated');
  const c = g.workflow.steps.copy; eq([c.state, c.why], ['needs_review', 'other_direction'], JSON.stringify(c));
  eq(c.stale.slice().sort(), A.slice().sort()); ok(/written from a direction other than/.test(c.note), c.note);
  eq(g.workflow.earlier.otherDirection.slice().sort(), A.slice().sort());
  ok(g.thread.some(e => e.kind === 'direction' && /marked for a rewrite from this one/.test(e.text || '')), 'the thread says what happened to them');
  // the keep step, one piece at a time, clears exactly that piece
  const k = await call('POST', '/studio/workflow/confirm', { project: P, step: 'keep', assets: [A[0]] }); eq(k.status, 200, JSON.stringify(k.body));
  const g2 = await get(P); eq(g2.workflow.steps.copy.stale, [A[1]], 'only the piece kept is cleared');
});

await T.t('keep: the new direction is chosen and the written pieces stay current under it; the thread names them', async () => {
  const { P, D } = await guidedToCopy('Direction change: keep');
  const r = await call('POST', '/studio/direction/choose', { id: D[2], decision: 'keep' }); eq(r.status, 200, JSON.stringify(r.body));
  const g = await get(P); eq(g.directions.find(d => d.chosen).id, D[2]);
  ok(g.workflow.steps.copy.why !== 'other_direction' && !(g.workflow.earlier.otherDirection || []).length, JSON.stringify(g.workflow.steps.copy));
  ok(g.thread.some(e => e.kind === 'direction' && /kept as written/.test(e.text || '')), 'the thread records the decision');
  const back = await call('POST', '/studio/direction/choose', { id: D[0] }); eq(back.status, 200, 'going back to the direction they were written from asks nothing: ' + JSON.stringify(back.body).slice(0, 200));
});

await T.t('a variant family produced from several directions on purpose is never "another direction"', async () => {
  const { P, D } = await guidedToCopy('Direction change: variants');
  const v = await stage(P, 'copy', { direction: D[1], variant: true, channels: ['facebook'], deliverable: 'set', formats: { facebook: '1:1' }, size: '2K' });
  ok(v.state === 'done' || v.state === 'failed', 'the variant job ran: ' + v.state + ' ' + (v.error || ''));
  const g = await get(P); const fam = g.assets.filter(a => /^Narrative: /.test(a.family || ''));
  if (v.state === 'done') { ok(fam.length >= 1, 'the variant family exists'); ok(!(g.workflow.earlier.otherDirection || []).some(id => fam.some(a => a.id === id)), 'variant pieces are not flagged'); }
  const r = await call('POST', '/studio/direction/choose', { id: D[0] }); eq(r.status, 200, 'the chosen direction unchanged, nothing to ask');
});

/* The brief's suggestions are grounded in the selected client AND campaign. 3 November 2026: a HOOF project was offered the client's
 * earlier briefs from every campaign (MCA national objectives and messages, only sorted after HOOF's), the AI suggestion was given
 * every approved fact of the client, and a project with no campaign yet was offered every campaign's call to action, identity and
 * mark at once. MCA and HOOF share a client and both run myth-busting work; their facts, voice and marks must not mix. */
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, voice: 'Plain, factual, regional.',
  campaigns: [{ id: 'national', name: 'Australian mining', cta: 'Read the facts', identity: 'Australian mining national campaign', logoPolicy: 'logo' },
    { id: 'hoof', name: 'Hands Off Our Fuel', cta: 'Sign the petition', identity: 'HANDS OFF OUR FUEL - teal, defiant, regional', logoPolicy: 'wordmark' }],
  facts: [{ text: 'NATIONAL FACT: mining paid $74 billion in tax and royalties', status: 'approved', campaign: 'national' },
    { text: 'HOOF FACT: fuel tax credits refund a road tax on fuel used off-road', status: 'approved', campaign: 'hoof' },
    { text: 'CLIENT FACT: the minerals industry employs people in every state', status: 'approved' },
    { text: 'PENDING FACT: an unreviewed claim', status: 'pending', campaign: 'hoof' }] });
const natP = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National brief', brief: { objective: 'NATIONAL OBJECTIVE: show the tax mining pays', message: 'NATIONAL MESSAGE' } })).body.id;
const hoofP = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF brief', brief: { objective: 'HOOF OBJECTIVE: correct the subsidy myth', message: 'HOOF MESSAGE' } })).body.id;
const sug = async (pid, ai) => (await call('GET', '/studio/brief/suggest?project=' + pid + (ai ? '&ai=1' : ''))).body;
const texts = (o, k) => (o.fields[k] || []).map(x => x.text).join(' | ');

await T.t('a HOOF project is offered HOOF\'s and client-wide records only: never MCA national\'s facts, call to action, earlier briefs or mark', async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF myth response', brief: {} })).body.id;
  const o = await sug(P);
  ok(/Sign the petition/.test(texts(o, 'action')) && !/Read the facts/.test(texts(o, 'action')), 'action: ' + texts(o, 'action'));
  ok(/HOOF FACT/.test(texts(o, 'message')) && /CLIENT FACT/.test(texts(o, 'message')) && !/NATIONAL FACT|PENDING FACT/.test(texts(o, 'message')), 'message: ' + texts(o, 'message'));
  ok(/HOOF OBJECTIVE/.test(texts(o, 'objective')) && !/NATIONAL OBJECTIVE/.test(texts(o, 'objective')), 'objective (earlier briefs): ' + texts(o, 'objective'));
  ok(/wordmark, never the client logo/.test(texts(o, 'requirements')) && !/Australian mining national/.test(texts(o, 'requirements')), 'requirements: ' + texts(o, 'requirements'));
  const msg = (o.fields.message || []).find(x => /HOOF FACT/.test(x.text)); ok(msg && msg.source === 'approved' && /Hands Off Our Fuel/.test(msg.from), 'each suggestion names what supports it: ' + JSON.stringify(msg));
});
await T.t('an MCA national project is offered the national records and the MCA logo, never HOOF\'s', async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'National myth response', brief: {} })).body.id;
  const o = await sug(P);
  ok(/Read the facts/.test(texts(o, 'action')) && !/Sign the petition/.test(texts(o, 'action')), texts(o, 'action'));
  ok(/NATIONAL FACT/.test(texts(o, 'message')) && !/HOOF FACT/.test(texts(o, 'message')), texts(o, 'message'));
  ok(/NATIONAL OBJECTIVE/.test(texts(o, 'objective')) && !/HOOF OBJECTIVE/.test(texts(o, 'objective')), texts(o, 'objective'));
  ok(!/HANDS OFF OUR FUEL|wordmark, never/.test(texts(o, 'requirements')), texts(o, 'requirements'));
});
await T.t('with no campaign chosen nothing campaign-specific is offered, and the brief says to choose the campaign first', async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', title: 'Campaign not chosen', brief: {} })).body.id;
  const o = await sug(P);
  ok(!/Read the facts|Sign the petition/.test(texts(o, 'action')) && !/NATIONAL FACT|HOOF FACT/.test(texts(o, 'message')) && /CLIENT FACT/.test(texts(o, 'message')), JSON.stringify(o.fields).slice(0, 400));
  ok(!/wordmark|client logo/.test(texts(o, 'requirements')), 'no mark is offered before the campaign: ' + texts(o, 'requirements'));
  ok(/Choose the campaign first/.test(o.campaignNeeded || '') && /Hands Off Our Fuel/.test(o.campaignNeeded), o.campaignNeeded);
});
await T.t('a field with nothing reliable on file says so, with the reason, instead of an empty list', async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF nothing on audience', brief: {} })).body.id;
  const o = await sug(P);
  ok(!(o.fields.audience || []).length && /Axiom holds nothing reliable for this yet: the kit has no audience segment/.test(o.empty.audience || ''), JSON.stringify(o.empty));
  ok(!o.empty.message, 'a field with suggestions has no empty note');
});
await T.t('the AI suggestion for a HOOF project is given HOOF\'s and client-wide facts only, and its answers are marked inferred', async () => {
  const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'HOOF ask the model', brief: {} })).body.id;
  const n0 = anth.length; const o = await sug(P, true);
  const c = anth.slice(n0).find(x => /filling gaps in a creative brief/.test(x.sys)); ok(c, 'one model call was made');
  const facts = (c.user.match(/APPROVED FACTS: ([^\n]*)/) || [])[1] || '';
  ok(/HOOF FACT/.test(facts) && /CLIENT FACT/.test(facts) && !/NATIONAL FACT|PENDING FACT/.test(facts), 'the facts given to the model: ' + facts);
  ok(Object.values(o.fields).every(list => list.every(x => x.source !== 'ai' || x.from)), 'an AI suggestion names the model that inferred it');
  void natP; void hoofP;
});

const res = T.done(); process.exit(res.fail ? 1 : 0);
