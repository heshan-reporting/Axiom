/* Screenshots of the Studio at three sizes on one seeded project (MOCKED providers; nothing is spent).
 * Run: node --experimental-sqlite tests/studio-shots.mjs <label>   -> tests/shots/<label>-<view>-<size>.png */
import fs from 'node:fs';
import { makeStudio, RELEASE } from './studio-fixture.mjs';
const label = process.argv[2] || 'after';
const OUT = new URL('./shots/', import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const fx = await makeStudio({ port: 8791 });
const { api } = fx;
async function step(id) { for (let i = 0; i < 20; i++) { const j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } }
async function job(project, stage, input, asset) { const r = await api('POST', '/studio/job', { project, stage, input, asset, idem: stage + ':' + Math.random() }); return step(r.job.id); }
// one project with a source, directions, a chosen direction, a produced set and its renders
const pr = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Fuel tax credits keep regional Australia moving', brief: { channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, campaignConfirmed: true, deliverables: 'Coordinated set for Facebook, Instagram' }, idem: 'shots' });
const src = await api('POST', '/studio/source', { project: pr.id, kind: 'release', name: 'Pasted release', text: RELEASE });
await job(pr.id, 'extract', { source: src.id });
await job(pr.id, 'direct', { n: 2 });
const g = await api('GET', '/studio/get?id=' + pr.id);
await api('POST', '/studio/direction/choose', { id: g.directions[0].id });
await job(pr.id, 'copy', { channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' } });
const g2 = await api('GET', '/studio/get?id=' + pr.id);
for (const j of g2.jobs.filter(j => j.stage === 'render' && j.state === 'queued')) await step(j.id);
const empty = await api('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Regional jobs explainer (new)', brief: { channels: ['linkedin'], deliverable: 'set', campaignConfirmed: true }, idem: 'shots-empty' });
const SIZES = [['1440', { width: 1440, height: 900 }], ['1920', { width: 1920, height: 1080 }], ['390', { width: 390, height: 844 }]];
const R = '#studio-root ';
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [sz, viewport] of SIZES) {
  const page = await fx.open({ viewport, quiet: true });
  await page.waitForSelector(R + '.st-lib tbody tr', { timeout: 15000 }).catch(() => {}); await wait(400);
  await page.screenshot({ path: OUT + label + '-library-' + sz + '.png' });
  await page.click(R + '.st-lib tbody tr:has-text("Fuel tax credits") button:has-text("open")').catch(() => {});
  await page.waitForSelector(R + '.st-stage canvas', { timeout: 15000 }).catch(() => {}); await wait(1800);
  await page.screenshot({ path: OUT + label + '-asset-' + sz + '.png' });
  if (sz !== '390') { await page.click(R + '#st-tabbtn-checks').catch(() => {}); await wait(300); await page.screenshot({ path: OUT + label + '-quality-' + sz + '.png' }); }
  await page.click(R + '.st-step:has(.st-step-l:text-is("Brief")), ' + R + 'button:has-text("Brief")').catch(() => {}); await wait(700);
  await page.screenshot({ path: OUT + label + '-brief-' + sz + '.png' });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Direction"))').catch(() => {}); await wait(700);
  await page.screenshot({ path: OUT + label + '-directions-' + sz + '.png' });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Copy"))').catch(() => {}); await wait(700);
  await page.screenshot({ path: OUT + label + '-copy-' + sz + '.png' });
  await page.click(R + '.st-step:has(.st-step-l:text-is("Design"))').catch(() => {}); await wait(400); await page.click(R + '.st-subtab:has-text("Board")').catch(() => {}); await wait(900);
  await page.screenshot({ path: OUT + label + '-board-' + sz + '.png' });
  if (sz !== '390' || label !== 'before') { await page.click(R + '.st-step:has(.st-step-l:text-matches("^Review"))').catch(() => {}); await wait(700); await page.screenshot({ path: OUT + label + '-review-' + sz + '.png' });
    await page.click(R + '.st-step:has(.st-step-l:text-is("Export"))').catch(() => {}); await wait(700); await page.screenshot({ path: OUT + label + '-export-' + sz + '.png' }); }
  if (page.errors.length) console.log('page errors at ' + sz + ': ' + page.errors.join(' | '));
  await page.ctxB.close();
}
console.log('shots in tests/shots/ for ' + label + '; project ' + pr.id + ', empty ' + empty.id);
await fx.close();
