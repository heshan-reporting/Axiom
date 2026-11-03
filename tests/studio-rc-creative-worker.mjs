/* The release candidate's creative-engine case (CREATIVE-STUDIO.md s.54), against the worker module in this process with every
 * provider MOCKED. It fails on the base commit and passes with its fix.
 *   C1  three directions that would draw the same tile (a full photograph with the words in a panel at the foot) under different
 *       photographic labels are look-alikes: the set goes back once for replacements that differ in composition, and a
 *       look-alike still standing after that round is marked, never hidden
 * Run: node --experimental-sqlite tests/studio-rc-creative-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';

const S = suite('RC creative engine: directions that look alike');
const KEYS = { 'full-key': { n: 'Lead', r: 'full' } };
const SAME = { composition: 'a full-bleed photograph, the words in a panel at the foot', typography: 'standard sans', colour: 'navy and white' };
const ALIKE = [
  Object.assign({ title: 'Dawn crossing', idea: 'The first ferry at dawn', headline: 'Two more morning crossings', message: 'Earlier starts from Monday', medium: 'photo-documentary' }, SAME),
  Object.assign({ title: 'Commuter faces', idea: 'Riders waiting on the wharf', headline: 'Your morning, sooner', message: 'Riders asked for earlier', medium: 'photo-cinematic' }, SAME),
  Object.assign({ title: 'The harbour at six', idea: 'Light on the water before work', headline: 'Six-ten, Circular Wharf', message: 'The new times', medium: 'photograph' }, SAME),
];
const DIFFERENT = [
  { title: 'The timetable as the news', idea: 'Only the times, large', headline: '6.10. 6.40.', message: 'The new times', medium: 'typographic', composition: 'type only, the times huge in the middle', typography: 'huge condensed figures', colour: 'amber on navy' },
  { title: 'A map of the morning', idea: 'The route drawn as a line', headline: 'Two more ways across', message: 'Earlier crossings', medium: 'diagram', composition: 'a route diagram on the left, words on the right', typography: 'small labels', colour: 'teal and white' },
];

async function directWith(answers) {
  const w = await workerEnv({ keys: KEYS, env: { ANTHROPIC_API_KEY: 'x' } });
  const sent = [];
  w.answer(/api\.anthropic\.com/, async (u, init) => {
    const body = JSON.parse(init.body); const user = typeof body.messages[0].content === 'string' ? body.messages[0].content : body.messages[0].content.filter(x => x.type === 'text').map(x => x.text).join('');
    sent.push(user);
    const a = answers.length > 1 ? answers.shift() : answers[0];
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ directions: a }) }], stop_reason: 'end_turn', model: body.model, usage: { input_tokens: 1, output_tokens: 1 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  await w.call('POST', '/brand/kit', { ns: 'synthdemo', name: 'Harbourline Ferries - SYNTHETIC DEMO CLIENT', campaigns: [{ id: 'harbour', name: 'Harbour crossings' }] }, 'full-key');
  const P = (await w.call('POST', '/studio/project', { ns: 'synthdemo', campaign: 'harbour', title: 'C1', brief: { objective: 'Tell riders about the new crossings', message: 'Two more morning crossings', channels: ['instagram'], campaignConfirmed: true } }, 'full-key')).body.id;
  const j = (await w.call('POST', '/studio/job', { project: P, stage: 'direct', input: { n: 3 }, idem: 'c1:' + Math.random() }, 'full-key')).body.job;
  let job = j; for (let i = 0; i < 6 && (job.state === 'queued' || job.state === 'running'); i++) job = (await w.call('POST', '/studio/job/step', { id: j.id }, 'full-key')).body.job;
  const g = (await w.call('GET', '/studio/get?id=' + P, null, 'full-key')).body;
  return { w, job, g, sent };
}

await S.t('C1: three photographic directions laid out alike are one family: the set goes back once, a replacement in another medium stands, and what still looks alike is marked', async () => {
  const x = await directWith([ALIKE, DIFFERENT]);
  try {
    eq(x.job.state, 'done', JSON.stringify(x.job.error || ''));
    eq(x.sent.length, 2, 'one replanning round');
    ok(/REPLAN/.test(x.sent[1]) && (/look the same on the page/.test(x.sent[1]) || /Every direction you proposed is photographic \(photo-documentary, photo-cinematic/.test(x.sent[1])), 'the round names the look-alikes as one photographic family: ' + (x.sent[1] || '').slice(-400));
    const titles = x.g.directions.map(d => d.title);
    ok(titles.indexOf('The timetable as the news') >= 0, 'a replacement stands: ' + titles.join(', '));
    const cf = x.g.directions.find(d => d.title === 'Commuter faces');
    ok(!cf || cf.lookalike === 'Dawn crossing', 'a look-alike still standing after the one round is marked, never hidden: ' + JSON.stringify(x.g.directions.map(d => [d.title, d.lookalike])));
  } finally { x.w.restore(); }
});

await S.t('C1: when the round brings back look-alikes again, they stand marked, never hidden', async () => {
  const x = await directWith([ALIKE, ALIKE.slice(1)]);
  try {
    eq(x.job.state, 'done', JSON.stringify(x.job.error || ''));
    eq(x.sent.length, 2, 'still only one round');
    eq(x.g.directions.length, 3, 'three directions kept');
    ok(x.g.directions.some(d => d.lookalike), 'a look-alike is marked: ' + JSON.stringify(x.g.directions.map(d => [d.title, d.lookalike])));
  } finally { x.w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
