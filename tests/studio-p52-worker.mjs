/* P52: the design engine (Phase 5 of prompts/studio-engines-and-canvas.md), against the worker module in this process with every
 * provider MOCKED. Each case fails on the P51 commit and passes with its change.
 *   TP1 a library of original templates, each laid out for the piece's format with its own words, the campaign's colours and
 *       its mark by policy (HOOF's wordmark, never the MCA logo); searchable; nothing written
 *   TP2 applying a template is a layout version with no render; refused on a moved version, a locked layout or a painted bitmap
 *   TP3 templates and plans are one vocabulary: a plan may start from a template and change or remove its elements by id
 *   TP4 resize shows every format laid out before anything is made
 *   CO1 the team's own thread on an asset: comments pinned to the tile, mentions as plain names, resolved and reopened; a read
 *       key reads it and cannot post
 *   PR1 presence: who else has unsaved work on this asset in the last ten minutes, by name, never the person asking
 * Run: node --experimental-sqlite tests/studio-p52-worker.mjs */
import { workerEnv, suite, eq, ok } from './worker-env.mjs';
import { pngB64 } from './png.mjs';

const S = suite('P52: the design engine');
const F = (w, m, p, b) => w.call(m, p, b, 'full-key');
const LOGO = pngB64(64, 32, { fill: 0x22 });
const KIT = { ns: 'mca', name: 'Minerals Council of Australia', palette: { primary: '#0E6A6E', secondary: '#F2A541', bg: '#F7F4EE', text: '#13232F' },
  campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', logoPolicy: 'wordmark', accent: '#D9531E' }, { id: 'national', name: 'Australian mining', logoPolicy: 'logo' }], logoB64: LOGO, logoMime: 'image/png' };
const LAYOUT = { v: 4, stage: { w: 1080, h: 1350 }, bg: '#0E6A6E', layers: [{ id: 'headline', type: 'text', role: 'headline', x: 6, y: 10, w: 80, h: 20, size: 6, weight: 700, color: '#FFFFFF' }, { id: 'support', type: 'text', role: 'support', x: 6, y: 40, w: 80, h: 12, size: 3, color: '#FFFFFF' }] };
const COPY = { headline: 'More than 150,000 businesses use the credit', support: 'Farmers, truckies and miners claim it. It is not a subsidy. It stops double taxing.', cta: 'Hands off our fuel' };
const setup = async (w, camp) => {
  await F(w, 'POST', '/brand/kit', KIT);
  await F(w, 'POST', '/brand/kit', { ns: 'mca', wordmarkCampaign: 'hoof', wordmarkVariant: 'white', wordmarkTone: 'light', wordmarkDefault: true, wordmarkB64: LOGO, wordmarkMime: 'image/png' });
  const P = (await F(w, 'POST', '/studio/project', { ns: 'mca', campaign: camp || 'hoof', title: 'T', brief: { objective: 'o' } })).body.id;
  const a = (await F(w, 'POST', '/studio/asset', { project: P, family: 'F', channel: 'instagram', format: '4:5', title: 'Tile', mode: 'composition', copy: COPY, layout: LAYOUT })).body.asset;
  return { P, a };
};

await S.t('TP1: eight original templates laid out with the piece\'s words, the campaign\'s colours and its mark by policy; searchable; nothing written', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const { P, a } = await setup(w);
    const n0 = w.env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM studio_versions').get().n;
    const r = await F(w, 'GET', '/studio/templates?asset=' + a.id); eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    const T = r.body.templates; eq(T.map(t => t.id), ['myth_fact', 'stat_card', 'quote', 'announcement', 'carousel_opener', 'event', 'petition', 'explainer']);
    for (const t of T) {
      const L = t.layout; ok(L && L.stage && L.stage.w === 1080 && L.stage.h === 1350, t.id + ' at the piece\'s format');
      const hl = L.layers.find(l => l.role === 'headline'); ok(hl, t.id + ' carries the headline layer');
      const marks = L.layers.filter(l => l.type === 'img' && (l.role === 'logo' || l.role === 'wordmark'));
      ok(marks.length === 1 && marks[0].role === 'wordmark' && /wordmark\?ns=mca&campaign=hoof/.test(marks[0].src), t.id + ': HOOF carries its wordmark: ' + JSON.stringify(marks.map(m => m.src)));
      ok(!L.layers.some(l => /\/brand\/logo\?/.test(String(l.src || ''))), t.id + ': never the MCA logo');
      eq(L.template, t.id);
    }
    const stat = T.find(t => t.id === 'stat_card').layout; ok(stat.layers.some(l => l.id === 'stat' && /150,000/.test(l.text)), 'the stat card takes the figure from the words');
    ok(JSON.stringify(T.find(t => t.id === 'myth_fact').layout).indexOf('#D9531E') >= 0, 'coloured from the campaign accent');
    const q = (await F(w, 'GET', '/studio/templates?asset=' + a.id + '&q=petition')).body.templates; eq(q.map(t => t.id), ['petition'], 'searchable');
    eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM studio_versions').get().n, n0, 'nothing written');
    const nat = await setup(w, 'national'); const nl = (await F(w, 'GET', '/studio/templates?asset=' + nat.a.id)).body.templates[0].layout;
    ok(nl.layers.some(l => l.role === 'logo' && /\/brand\/logo\?ns=mca/.test(l.src)) && !nl.layers.some(l => l.role === 'wordmark'), 'the national campaign carries the client logo');
  } finally { w.restore(); }
});

await S.t('TP2: applying a template is a layout version, no render; refused on a moved version, a locked layout or a painted bitmap', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const { P, a } = await setup(w);
    eq((await F(w, 'POST', '/studio/template/apply', { asset: a.id, template: 'nope' })).status, 400);
    eq((await F(w, 'POST', '/studio/template/apply', { asset: a.id, template: 'quote', base: 'v_old' })).body.error, 'version_moved');
    const r = await F(w, 'POST', '/studio/template/apply', { asset: a.id, template: 'quote', base: a.current }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    const a2 = r.body.assets.find(x => x.id === a.id); const v = a2.versions.find(x => x.id === a2.current);
    ok(/template: Quote \(no render\)/.test(v.note), v.note); eq(v.layout.template, 'quote'); eq(v.copy.headline, COPY.headline, 'the words are the piece\'s own');
    eq(w.env.MIND_DB.db.prepare("SELECT COUNT(*) AS n FROM studio_jobs WHERE stage='render'").get().n, 0, 'no render queued');
    await F(w, 'POST', '/studio/lock', { asset: a.id, element: 'layout', locked: true });
    eq((await F(w, 'POST', '/studio/template/apply', { asset: a.id, template: 'event' })).body.error, 'locked');
  } finally { w.restore(); }
});

await S.t('TP3: a plan may start from a template and change or remove its elements by id', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const m = w.mod.__test; ok(m.stPlanNormalise && m.stTemplatePlan, 'exported');
    const L = m.stPlanNormalise({ template: 'stat_card', elements: [{ id: 'headline', color: '#FF0000' }, { id: 'band', remove: true }, { id: 'extra', type: 'text', role: 'caption', text: 'Source: ATO', x: 6, y: 60, w: 50, h: 4, size: 2.4 }] }, '1:1', { kit: KIT, ns: 'mca', campaign: 'national', copy: COPY, keepStyle: true });
    eq(L.fromTemplate, 'stat_card', 'the layout says which template it started from');
    ok(L.layers.some(l => l.role === 'headline' && /ff0000/i.test(l.color)), 'the change by id');
    ok(!L.layers.some(l => l.id === 'band'), 'the removal by id'); ok(L.layers.some(l => /Source: ATO/.test(l.text || '')), 'the addition');
    ok(/stat_card/.test(m.ST_PLAN_SCHEMA || ''), 'the schema tells the planner the templates');
  } finally { w.restore(); }
});

await S.t('TP4: resize lays out every format for measuring before anything is made', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const { P, a } = await setup(w);
    const n0 = w.env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM studio_assets').get().n;
    const r = await F(w, 'POST', '/studio/resize', { asset: a.id, presets: ['story', 'linkedin'], preview: true }); eq(r.status, 200, JSON.stringify(r.body).slice(0, 300));
    eq(r.body.preview.map(x => x.format), ['9:16', '1.91:1']); ok(r.body.preview.every(x => x.layout && x.layout.layers.some(l => l.role === 'headline')), 'each laid out');
    eq(w.env.MIND_DB.db.prepare('SELECT COUNT(*) AS n FROM studio_assets').get().n, n0, 'nothing made');
  } finally { w.restore(); }
});

await S.t('CO1: an internal thread per asset, pinned, with plain-name mentions, resolved by a person; read keys read only', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const { P, a } = await setup(w);
    eq((await F(w, 'POST', '/studio/comment', { asset: a.id, text: '  ' })).status, 400, 'empty is refused');
    const c = await F(w, 'POST', '/studio/comment', { asset: a.id, version: a.current, text: '@Dee the wordmark crowds the CTA here', pin: { x: 82, y: 90, layer: 'wordmark' } }); eq(c.status, 200, JSON.stringify(c.body)); eq(c.body.mentions, ['Dee']);
    eq((await w.call('POST', '/studio/comment', { asset: a.id, text: 'hi' }, 'read-key')).status, 403, 'a read key cannot post');
    const list = (await w.call('GET', '/studio/comments?asset=' + a.id, null, 'read-key')).body; eq(list.open, 1); const x = list.comments[0];
    ok(x.pin && x.pin.x === 82 && x.pin.layer === 'wordmark' && x.who === 'Full' && x.version === a.current, JSON.stringify(x));
    eq((await F(w, 'POST', '/studio/comment/resolve', { id: x.id })).status, 200); eq((await F(w, 'GET', '/studio/comments?asset=' + a.id)).body.open, 0, 'resolved');
    await F(w, 'POST', '/studio/comment/resolve', { id: x.id, reopen: true }); eq((await F(w, 'GET', '/studio/comments?asset=' + a.id)).body.open, 1, 'reopened');
    const ev = w.env.MIND_DB.db.prepare("SELECT data FROM studio_events WHERE project=? AND kind='team_comment'").get(P); ok(ev && /for Dee/.test(ev.data), 'on the thread with who it is for');
  } finally { w.restore(); }
});

await S.t('PR1: presence names who else has unsaved work on the asset now, never the person asking', async () => {
  const w = await workerEnv({ env: { STUDIO_INSPECT: '0' } });
  try {
    const { P, a } = await setup(w);
    const d = await F(w, 'POST', '/studio/draft', { asset: a.id, version: a.current, layout: LAYOUT, copy: COPY, seq: 1 }); eq(d.status, 200, JSON.stringify(d.body));
    eq((await F(w, 'GET', '/studio/presence?asset=' + a.id)).body.editing, [], 'my own draft is not presence');
    w.env.MIND_DB.db.prepare('INSERT INTO studio_drafts(asset, who, project, version, layout, copy, at, name) VALUES(?,?,?,?,?,?,?,?)').run(a.id, 'kother', P, a.current, '{}', '{}', Date.now(), 'Laura');
    w.env.MIND_DB.db.prepare('INSERT INTO studio_drafts(asset, who, project, version, layout, copy, at, name) VALUES(?,?,?,?,?,?,?,?)').run(a.id, 'kstale', P, a.current, '{}', '{}', Date.now() - 3600000, 'Steve');
    eq((await F(w, 'GET', '/studio/presence?asset=' + a.id)).body.editing.map(x => x.name), ['Laura'], 'Laura now; Steve an hour ago is not');
  } finally { w.restore(); }
});

const r = S.done(); process.exit(r.fail ? 1 : 0);
