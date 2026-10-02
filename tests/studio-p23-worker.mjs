/* Build studio-p23: an adaptation into a format with a wider interface margin (a 9:16 story) maps the master's words,
 * panels and devices into the target's safe area, keeps full-bleed grounds full-bleed, places the mark in its corner
 * inside the area, and measures clean; a square-to-portrait adaptation keeps the master's geometry as before.
 * MOCKED providers (studio-fixture.mjs). Run: node --experimental-sqlite tests/studio-p23-worker.mjs */
import { makeStudio, runner, eq, ok } from './studio-fixture.mjs';
const fx = await makeStudio({ port: 8793, inspect: false }); const { api } = fx;
const T = runner('studio-p23-worker (adaptation into the target\'s safe area)');
async function step(id) { for (let i = 0; i < 20; i++) { const j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } }
async function job(project, stage, input) { const r = await api('POST', '/studio/job', { project, stage, input, idem: stage + ':' + Math.random() }); return step(r.job.id); }
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Adapt', brief: { channels: ['facebook'], deliverable: 'set', campaignConfirmed: true, objective: 'x', message: 'y' }, idem: 'p23' });
await job(pr.id, 'copy', { channels: ['facebook'], deliverable: 'set', acknowledge: true, instruction: 'write it' });
let g = await api('GET', '/studio/get?id=' + pr.id); for (const j of g.jobs.filter(j => j.stage === 'render')) await step(j.id);
g = await api('GET', '/studio/get?id=' + pr.id); const master = g.assets[0]; const mv = master.versions.find(v => v.id === master.current);
const adapt = async ins => { const r = await job(pr.id, 'revise', { target: 'asset', asset: master.id, instruction: ins }); const d = await api('GET', '/studio/get?id=' + pr.id); return d.assets.find(a => a.id === r.result.changed[0]); };
const cur = a => a.versions.find(v => v.id === a.current);
await T.t('a 1:1 master adapted to a 9:16 story: every word, panel and the mark inside the top 14% / bottom 20% interface and the 6% sides; the words and the photograph kept', async () => {
  const s = await adapt('Adapt this for an Instagram story 9:16'); const v = cur(s);
  eq([v.layout.stage.w, v.layout.stage.h], [1080, 1920]);
  for (const l of v.layout.layers.filter(l => l.type === 'text' || l.role === 'logo' || l.role === 'wordmark')) ok(l.y >= 14 - 0.05 && l.y + l.h <= 80 + 0.05 && l.x >= 6 - 0.05 && l.x + l.w <= 94 + 0.05, l.id + ' inside the safe area: ' + JSON.stringify([l.x, l.y, l.w, l.h]));
  const panel = v.layout.layers.find(l => l.role === 'panel'); ok(panel && panel.y >= 14 && panel.y + panel.h <= 80, 'the panel moved with its words');
  eq([v.copy.headline, v.copy.support, (v.image || {}).key], [mv.copy.headline, mv.copy.support, (mv.image || {}).key], 'same words and photograph');
  const logo = v.layout.layers.find(l => l.role === 'logo'); ok(logo && logo.x > 50 && logo.y > 50, 'the mark kept its bottom-right corner');
});
await T.t('a 1:1 master adapted to 16:9 keeps the master\'s geometry (the margins are the same), as before', async () => {
  const s = await adapt('Adapt this for X'); const v = cur(s);
  const a = mv.layout.layers.find(l => l.role === 'headline'), b = v.layout.layers.find(l => l.role === 'headline');
  eq([b.x, b.y, b.w, b.h], [a.x, a.y, a.w, a.h], 'per-cent geometry unchanged');
});
const res = T.done(); await fx.close(); process.exit(res.fail ? 1 : 0);
