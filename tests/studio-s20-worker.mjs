/* S20 on the worker. Defect D: a locked layer is protected in every visual property, not a short geometry list - its family,
 * leading, tracking, effects, image treatment and the words it shows are refused unless the change is an explicit unlock, which
 * the version's note records; a rename stays free. Providers MOCKED. Run: node --experimental-sqlite tests/studio-s20-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s20-worker (the lock contract on /studio/version)');
const w = await workerEnv({ keys: { 'full-key': { n: 'Hesh', r: 'full' } }, env: { STUDIO_INSPECT: '0' } });
const call = (m, p, b) => w.call(m, p, b, 'full-key');
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', campaigns: [{ id: 'national', name: 'Australian mining', logoPolicy: 'none' }] });
const P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'national', title: 'S20 locks', brief: { objective: 'o', message: 'm', channels: ['instagram'] } })).body.id;
const HL = { id: 'hl', role: 'headline', type: 'text', x: 8, y: 40, w: 80, h: 20, size: 7, family: 'Inter', leading: 1.1, tracking: 0, weight: 800, color: '#FFFFFF', locked: true };
const L = hl => ({ stage: { w: 1080, h: 1080 }, layers: [Object.assign({}, HL, hl || {}), { id: 'sp', role: 'support', type: 'text', x: 8, y: 64, w: 80, h: 10, size: 3 }] });
const A = (await call('POST', '/studio/asset', { project: P, channel: 'instagram', format: '1:1', title: 'Locked', copy: { headline: 'Locked words', support: 'S' }, layout: L(), mode: 'composition' })).body.asset.id;
const fresh = async () => (await call('GET', '/studio/get?id=' + P)).body.assets.find(a => a.id === A);
const put = async (patch, extra) => { const a = await fresh(); return call('POST', '/studio/version', Object.assign({ asset: A, revision: a.revision, layout: L(patch), kind: 'layout', note: 'edit' }, extra || {})); };

for (const [k, v] of [['family', 'Georgia'], ['leading', 1.6], ['tracking', 0.2], ['italic', true], ['shadow', { x: 2, y: 2, blur: 4, color: '#000' }], ['outline', { w: 2, color: '#000' }], ['blend', 'multiply'], ['effects', { glow: 1 }], ['lineHeight', 1.5], ['caps', true], ['transform', 'uppercase']]) {
  await T.t('D: a locked text layer refuses a change of ' + k, async () => {
    const r = await put({ [k]: v }); eq([r.status, r.body.error], [409, 'locked'], k + ': ' + r.status + ' ' + (r.body.error || '')); ok((r.body.changed || []).indexOf(k) >= 0, 'names ' + k + ': ' + JSON.stringify(r.body.changed));
  });
}
await T.t('D: the words a locked copy-role layer shows are protected too (the copy field it displays)', async () => {
  const a = await fresh(); const r = await call('POST', '/studio/version', { asset: A, revision: a.revision, copy: { headline: 'Changed words', support: 'S' }, kind: 'text' });
  eq([r.status, r.body.error], [409, 'locked'], r.text);
});
await T.t('D: renaming a locked layer is free (a name is not what the artwork shows)', async () => {
  const r = await put({ name: 'Main line', renamed: true }); eq(r.status, 200, r.text);
});
await T.t('D: unlocking alone is allowed and recorded; an unlock that also changes the layer needs unlock:true, and the note records what moved', async () => {
  const r1 = await put({ name: 'Main line', renamed: true, locked: false, family: 'Georgia' }); eq([r1.status, r1.body.error], [409, 'locked'], 'unlock plus a change in one go is refused without unlock:true');
  const r2 = await put({ name: 'Main line', renamed: true, family: 'Georgia' }, { unlock: true }); eq(r2.status, 200, r2.text);
  ok(/locked/.test(r2.body.version.note) && /family/.test(r2.body.version.note), 'the note records the deliberate change: ' + r2.body.version.note);
  const r3 = await put({ name: 'Main line', renamed: true, family: 'Georgia', locked: false }); eq(r3.status, 200, 'a plain unlock: ' + r3.text);
  ok(/unlocked/.test(r3.body.version.note), 'and it is recorded: ' + r3.body.version.note);
});

await T.t('D: resizing to another format keeps a locked layer locked with every property but its format geometry (box and type size) as it was', async () => {
  const hl = { id: 'hl', role: 'headline', type: 'text', x: 8, y: 40, w: 80, h: 20, size: 7, family: 'Georgia', fontFamily: 'Georgia', leading: 1.4, lineHeight: 1.4, letterSpacing: 0.05, italic: true, shadow: { x: 2, y: 2, blur: 4, color: '#000000' }, weight: 700, color: '#FFEECC', locked: true };
  const B = (await call('POST', '/studio/asset', { project: P, channel: 'instagram', format: '1:1', title: 'Locked type', copy: { headline: 'Locked words', support: 'S' }, layout: { stage: { w: 1080, h: 1080 }, layers: [hl, { id: 'sp', role: 'support', type: 'text', x: 8, y: 64, w: 80, h: 10, size: 3 }] }, mode: 'composition' })).body.asset.id;
  const r = await call('POST', '/studio/resize', { asset: B, formats: ['9:16'] }); eq(r.status, 200, r.text);
  const made = (await call('GET', '/studio/get?id=' + P)).body.assets.find(a => a.id === r.body.made[0].asset);
  const v = made.versions.find(x => x.id === made.current); const l = v.layout.layers.find(x => x.id === 'hl');
  ok(l && l.locked, 'still locked'); const keep = ['family', 'fontFamily', 'leading', 'lineHeight', 'letterSpacing', 'italic', 'shadow', 'weight', 'color'];
  eq(keep.map(k => JSON.stringify(l[k])), keep.map(k => JSON.stringify(hl[k])), 'every locked property kept');
  ok(/locked/.test(v.note), 'the note says what the lock kept: ' + v.note);
});

// B on the worker: drafts are ordered by the browser's sequence, and a discard removes only the snapshot that was saved
await T.t('B: an older draft write arriving after a newer one is ignored (stale), never replacing it', async () => {
  const a = await fresh();
  const w1 = await call('POST', '/studio/draft', { asset: A, version: a.current, layout: L(), copy: { headline: 'Newer' }, rev: 'r-new', seq: 2000 }); eq(w1.status, 200);
  const w0 = await call('POST', '/studio/draft', { asset: A, version: a.current, layout: L(), copy: { headline: 'Older' }, rev: 'r-old', seq: 1000 }); eq(w0.status, 200); eq(w0.body.stale, true, 'the late older write says it did not land');
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft.copy.headline, 'Newer');
});
await T.t('B: a discard naming the saved snapshot (rev) keeps a draft of any other snapshot', async () => {
  const d0 = await call('POST', '/studio/draft/discard', { asset: A, rev: 'r-old' }); eq(d0.body.discarded, false);
  ok((await call('GET', '/studio/draft?asset=' + A)).body.draft, 'the newer draft survives a late acknowledgement of the older snapshot');
  const d1 = await call('POST', '/studio/draft/discard', { asset: A, rev: 'r-new' }); eq(d1.body.discarded, true);
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft, null);
});
await T.t('B: a discard after a save names the moment its snapshot was taken (upto): drafts written before it go, a draft written after it stays', async () => {
  const a = await fresh();
  await call('POST', '/studio/draft', { asset: A, version: a.current, layout: L(), copy: { headline: 'Before the save' }, rev: 'r-a', seq: 3000 });
  const d0 = await call('POST', '/studio/draft/discard', { asset: A, upto: 2500 }); eq(d0.body.discarded, false, 'a draft written after the snapshot is newer work');
  const d1 = await call('POST', '/studio/draft/discard', { asset: A, upto: 3500 }); eq(d1.body.discarded, true, 'an older draft, whatever its snapshot, is held or superseded by the saved version');
  eq((await call('GET', '/studio/draft?asset=' + A)).body.draft, null);
});
// A on the worker: a direction bound to a version is not applied to newer artwork it never saw
await T.t('A: a revise job made for an earlier version fails stale_version (not retried) and changes nothing', async () => {
  const a0 = await fresh(); const old = a0.versions[0].id; const n0 = a0.versions.length;
  const j = (await call('POST', '/studio/job', { project: P, asset: A, stage: 'revise', input: { target: 'asset', asset: A, version: old, instruction: 'Make the headline shorter' }, idem: 's20-stale' })).body.job;
  let jj = j; for (let i = 0; i < 4 && !/done|failed/.test(jj.state); i++) jj = (await call('POST', '/studio/job/step', { id: j.id })).body.job;
  eq(jj.state, 'failed'); ok(/stale_version/.test(jj.error || ''), jj.error); eq((await fresh()).versions.length, n0, 'no version written');
});
const res = T.done(); process.exit(res.fail ? 1 : 0);
