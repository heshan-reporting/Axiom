/* Dependable editing on the server (S5): a layout version that moves a layer the team locked, or a mark a campaign rule holds,
 * is refused with the element named (unless the lock is deliberately overridden), whatever client sent it. Providers MOCKED.
 * Run: node --experimental-sqlite tests/studio-s5-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
const T = suite('studio-s5-worker (locked layers and rule-held marks are refused on the server)');
const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
const call = (m, p, b, k) => w.call(m, p, b, k || 'full-key');
const PNG = Buffer.from('89504e470d0a1a0a' + '00'.repeat(100), 'hex').toString('base64');
await call('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E' }, campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel' }], logoB64: PNG, logoMime: 'image/png' });
await call('GET', '/engine/status?ns=mca');

let P, A, L0;
await T.t('a layer locked on the layout cannot be moved, resized, retyped or removed by a layout version; unlock:true overrides deliberately', async () => {
  P = (await call('POST', '/studio/project', { ns: 'mca', campaign: 'hoof', title: 'Locks', brief: { objective: 'o', message: 'm' }, idem: 's5-p' })).body.id;
  const a = (await call('POST', '/studio/asset', { project: P, family: 'Set', channel: 'instagram', format: '1:1', title: 'Tile', copy: { headline: 'Hands off our fuel', support: 'Not a subsidy.', cta: 'Sign' }, mode: 'composition' }, 'full-key')).body.asset;
  A = a.id; L0 = a.versions[0].layout; const hl = L0.layers.find(l => l.role === 'headline'); ok(hl, 'a headline layer');
  // the team locks the headline layer (a layout version that only sets the flag is allowed)
  const lockL = JSON.parse(JSON.stringify(L0)); lockL.layers.find(l => l.role === 'headline').locked = true;
  const r0 = await call('POST', '/studio/version', { asset: A, layout: lockL, kind: 'layout', note: 'lock the headline' }); eq(r0.status, 200, JSON.stringify(r0.body));
  // moving it is refused with the layer named
  const moved = JSON.parse(JSON.stringify(lockL)); moved.layers.find(l => l.role === 'headline').y += 10;
  const r1 = await call('POST', '/studio/version', { asset: A, layout: moved, kind: 'layout', note: 'move' }); eq(r1.status, 409, JSON.stringify(r1.body)); eq(r1.body.error, 'locked'); eq(r1.body.element, hl.id); ok(/locked/.test(r1.body.detail) && /headline/.test(r1.body.detail), r1.body.detail);
  // resizing the type, or removing the layer, is refused the same way
  const sized = JSON.parse(JSON.stringify(lockL)); sized.layers.find(l => l.role === 'headline').size += 1;
  eq((await call('POST', '/studio/version', { asset: A, layout: sized, kind: 'layout' })).status, 409);
  const gone = JSON.parse(JSON.stringify(lockL)); gone.layers = gone.layers.filter(l => l.role !== 'headline');
  const rg = await call('POST', '/studio/version', { asset: A, layout: gone, kind: 'layout' }); eq(rg.status, 409); ok(/removed/.test(rg.body.detail), rg.body.detail);
  // another layer may still move
  const other = JSON.parse(JSON.stringify(lockL)); const sp = other.layers.find(l => l.role === 'support'); sp.y = Math.min(90, sp.y + 2);
  eq((await call('POST', '/studio/version', { asset: A, layout: other, kind: 'layout', note: 'move the support' })).status, 200);
  // the override is explicit
  const r2 = await call('POST', '/studio/version', { asset: A, layout: Object.assign({}, moved, { layers: moved.layers.map(l => l.role === 'support' ? sp : l) }), kind: 'layout', unlock: true, note: 'moved deliberately' }); eq(r2.status, 200, JSON.stringify(r2.body));
  const cur = r2.body.version; ok(cur.layout.layers.find(l => l.role === 'headline').locked === true, 'the lock itself is kept on the layer');
});
await T.t('a mark held by a mandatory campaign rule is not moved by a layout version; a read key cannot write any of it', async () => {
  const a = (await call('GET', '/studio/get?id=' + P)).body.assets.find(x => x.id === A); const v = a.versions.find(x => x.id === a.current);
  const held = JSON.parse(JSON.stringify(v.layout)); const mk = held.layers.find(l => l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark')); ok(mk, 'a mark layer: ' + held.layers.map(l => l.role).join(','));
  mk.rule = { corner: 'br', mandatory: true, note: 'approved placement' };
  eq((await call('POST', '/studio/version', { asset: A, layout: held, kind: 'layout', note: 'record the rule' })).status, 200);
  const moved = JSON.parse(JSON.stringify(held)); const m2 = moved.layers.find(l => l.id === mk.id); m2.x -= 20;
  const r = await call('POST', '/studio/version', { asset: A, layout: moved, kind: 'layout', note: 'move the mark' }); eq(r.status, 409, JSON.stringify(r.body)); eq(r.body.error, 'mark_held'); ok(/campaign rule/.test(r.body.detail), r.body.detail);
  const r2 = await call('POST', '/studio/version', { asset: A, layout: moved, kind: 'layout', unlock: true, note: 'moved against the rule, deliberately' }); eq(r2.status, 200, JSON.stringify(r2.body)); ok(/against the rule|deliberately/.test(r2.body.version.note), r2.body.version.note);
  eq((await call('POST', '/studio/version', { asset: A, layout: held, kind: 'layout' }, 'read-key')).status, 403);
});
const res = T.done(); w.restore(); process.exit(res.fail ? 1 : 0);
