/* Guided projects (brief.workflow = 2) parked at every step of the Studio, made through the worker's own routes with the
 * fixture's MOCKED providers, so the S18 screenshots and harnesses open the same states before and after a change:
 *   brief       material added, not analysed           objectives  understanding reviewed
 *   strategy    objective confirmed                     directions  strategy confirmed, three directions on the board
 *   copy        a direction chosen, copy written        design      copy ready, editable production, imagery rendered
 * Nothing here reaches a real provider. Used by tests/studio-s18-shots.mjs and tests/studio-s18-browser.mjs. */
export async function seedStages(fx, o) {
  o = o || {};
  const { api } = fx;
  const step = async id => { let j; for (let i = 0; i < 20; i++) { j = (await api('POST', '/studio/job/step', { id })).job; if (!j || /done|failed|cancelled/.test(j.state)) return j; } return j; };
  const job = async (project, stage, input, asset) => { const r = await api('POST', '/studio/job', { project, stage, input, asset, idem: stage + ':' + Math.random() }); if (!r.job) throw new Error(stage + ': ' + JSON.stringify(r)); return step(r.job.id); };
  const BRIEF = { workflow: 2, projectType: 'response', campaignMode: 'existing', channels: ['facebook', 'instagram'], deliverable: 'set', formats: { facebook: '1:1', instagram: '4:5' }, campaignConfirmed: true, creationMode: 'editable', imageryTiming: 'after_copy' };
  const TEXT = 'Fuel tax credits are under attack: a crossbencher called the credit a subsidy for miners.\n\nPlease respond on social this week, regional focus. Mining directly employs more than 300,000 Australians.';
  const make = async (title) => { const r = await api('POST', '/studio/project', { ns: o.ns || 'mca', campaign: o.campaign || 'hoof', title, brief: BRIEF, idem: 's18:' + title }); return r.id; };
  const addSource = async P => (await api('POST', '/studio/source', { project: P, kind: 'analyse:brief', name: 'Client note', text: TEXT })).id;
  const analysed = async P => { const s = await addSource(P); await job(P, 'analyse', { sources: [s], kind: 'mixed' }); return P; };
  const reviewed = async P => { await analysed(P); await api('POST', '/studio/workflow/confirm', { project: P, step: 'brief' }); return P; };
  const objectived = async P => { await reviewed(P); await api('POST', '/studio/workflow/confirm', { project: P, step: 'objectives', objective: 'O1', message: 'M1.1', topics: ['Fuel tax credits'] }); return P; };
  const strategised = async P => { await objectived(P); await api('POST', '/studio/workflow/confirm', { project: P, step: 'strategy', strategy: 'S1', campaign: o.campaign || 'hoof' }); return P; };
  const directed = async P => { await strategised(P); await job(P, 'direct', { n: 3 }); return P; };
  const copied = async P => {
    await directed(P); const g = await api('GET', '/studio/get?id=' + P);
    await api('POST', '/studio/direction/choose', { id: g.directions[0].id });
    await job(P, 'copy', { channels: BRIEF.channels, deliverable: 'set', formats: BRIEF.formats });
    return P;
  };
  const designed = async P => {
    await copied(P); const g = await api('GET', '/studio/get?id=' + P);
    for (const a of g.assets) await api('POST', '/studio/approve', { asset: a.id, part: 'copy', decision: 'approve', reason: 'copy ready' });
    await api('POST', '/studio/production', { project: P, mode: 'editable' });
    const g2 = await api('GET', '/studio/get?id=' + P);
    for (const j of g2.jobs.filter(j => j.stage === 'render' && (j.state === 'queued' || j.state === 'running'))) await step(j.id);
    return P;
  };
  const out = {};
  const want = o.only || ['brief', 'objectives', 'strategy', 'directions', 'copy', 'design'];
  if (want.includes('brief')) { out.brief = await make('S18 at the brief'); await addSource(out.brief); }
  if (want.includes('objectives')) out.objectives = await reviewed(await make('S18 at objectives'));
  if (want.includes('strategy')) out.strategy = await objectived(await make('S18 at strategy'));
  if (want.includes('directions')) out.directions = await directed(await make('S18 at directions'));
  if (want.includes('copy')) out.copy = await copied(await make('S18 at copy'));
  if (want.includes('design')) out.design = await designed(await make('S18 at design'));
  return out;
}
