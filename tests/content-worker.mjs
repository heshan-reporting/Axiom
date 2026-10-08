/* Content Desk route harness: drives axiomworkerv4.js through its fetch handler
 * with a fake D1 (a small SQL evaluator over in-memory tables), a fake KV, a
 * stub Claude that answers compose and revise calls with predictable JSON, and
 * stub Mind bindings. Run: node content-worker.mjs */
const WORKER = new URL('../axiomworkerv4.js', import.meta.url).href;

/* ---------- a fake D1 good enough for the statements the worker issues ---------- */
class FakeD1 {
  constructor() { this.t = {}; this.log = []; }
  table(n) { return (this.t[n] = this.t[n] || []); }
  prepare(sql) { return new Stmt(this, sql); }
  async batch(stmts) { const out = []; for (const s of stmts) out.push(await s.run()); return out; }
}
class Stmt {
  constructor(db, sql) { this.db = db; this.sql = sql.trim(); this.args = []; }
  bind(...a) { this.args = a; return this; }
  async run() { this.exec(); return { success: true }; }
  async first() { const r = this.exec(); return (r && r[0]) || null; }
  async all() { return { results: this.exec() || [] }; }
  exec() {
    const db = this.db; let sql = this.sql; db.log.push(sql.slice(0, 60));
    if (/^CREATE/i.test(sql)) return [];
    if (/^(PRAGMA|ALTER)\b/i.test(sql)) return [];   // schema migrations: columns appear as rows are written
    let i = 0; sql = sql.replace(/\?/g, () => '$' + (i++));
    let m;
    if ((m = sql.match(/^INSERT INTO (\w+)\s*\(([^)]*)\)\s*VALUES\s*\((.*)\)\s*$/is))) {
      const cols = m[2].split(',').map(s => s.trim()); const vals = splitTop(m[3]).map(v => this.lit(v.trim()));
      const row = {}; cols.forEach((c, k) => { row[c] = vals[k]; });
      const tbl = db.table(m[1]); const pk = tbl.findIndex(r => r.id !== undefined && r.id === row.id);
      if (pk >= 0) tbl[pk] = row; else tbl.push(row);
      return [];
    }
    if ((m = sql.match(/^UPDATE (\w+) SET (.+?) WHERE (.+)$/is))) {
      const rows = db.table(m[1]).filter(r => this.where(r, m[3]));
      const sets = splitTop(m[2]);
      rows.forEach(r => sets.forEach(s => { const mm = s.match(/^\s*(\w+)\s*=\s*(.+)$/s); const col = mm[1], v = mm[2].trim();
        const inc = v.match(/^(\w+)\s*\+\s*(\d+)$/); r[col] = inc ? (Number(r[inc[1]]) || 0) + Number(inc[2]) : this.lit(v); }));
      return [];
    }
    if ((m = sql.match(/^DELETE FROM (\w+)(?:\s+WHERE (.+))?$/is))) {
      if (m[2] && /SELECT/i.test(m[2])) return [];
      db.t[m[1]] = db.table(m[1]).filter(r => !(m[2] ? this.where(r, m[2]) : true));
      return [];
    }
    if ((m = sql.match(/^SELECT (.+?) FROM (\w+)(?:\s+WHERE (.+?))?(?:\s+GROUP BY (\w+))?(?:\s+ORDER BY (.+?))?(?:\s+LIMIT (\S+))?\s*$/is))) {
      let rows = db.table(m[2]).filter(r => !m[3] || this.where(r, m[3]));
      if (m[5]) { const [col, dir] = m[5].trim().split(/\s+/); rows = rows.slice().sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (/desc/i.test(dir || '') ? -1 : 1)); }
      if (m[6]) rows = rows.slice(0, Number(this.lit(m[6])));
      const cols = splitTop(m[1]).map(c => c.trim());
      if (cols.some(c => /^(COUNT|SUM)\(/i.test(c))) {
        const groups = m[4] ? Array.from(new Set(rows.map(r => r[m[4]]))).map(g => rows.filter(r => r[m[4]] === g)) : [rows];
        return groups.map(g => { const o = {}; cols.forEach(c => { let mm;
          if ((mm = c.match(/^COUNT\(\*\)\s*(\w+)?$/i))) o[mm[1] || 'count'] = g.length;
          else if ((mm = c.match(/^SUM\((\w+)\s*=\s*'([^']*)'\)\s*(\w+)?$/i))) o[mm[3] || 'sum'] = g.filter(r => String(r[mm[1]]) === mm[2]).length;
          else if ((mm = c.match(/^SUM\((\w+)\)\s*(\w+)?$/i))) o[mm[2] || 'sum'] = g.reduce((a, r) => a + (Number(r[mm[1]]) || 0), 0);
          else if ((mm = c.match(/^(\w+)$/))) o[mm[1]] = g[0] ? g[0][mm[1]] : null; }); return o; });
      }
      if (cols.length === 1 && cols[0] === '*') return rows.map(r => Object.assign({}, r));
      return rows.map(r => { const o = {}; cols.forEach(c => { o[c] = r[c]; }); return o; });
    }
    throw new Error('fake d1 cannot parse: ' + sql.slice(0, 120));
  }
  lit(v) {
    v = v.trim();
    if (/^\$\d+$/.test(v)) return this.args[Number(v.slice(1))];
    if (/^'.*'$/s.test(v)) return v.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  }
  where(row, expr) {
    const toks = expr.match(/\$\d+|'[^']*'|\w+|\(|\)|=|,/g) || [];
    let p = 0; const self = this;
    const peek = () => toks[p]; const next = () => toks[p++];
    const val = () => { const t = next(); if (/^\$\d+$/.test(t)) return self.args[Number(t.slice(1))]; if (/^'.*'$/.test(t)) return t.slice(1, -1); if (/^-?\d+$/.test(t)) return Number(t); return row[t]; };
    function primary() {
      if (peek() === '(') { next(); const v = orx(); next(); return v; }
      const left = val();
      if (peek() === '=') { next(); const r = val(); return String(left) === String(r); }
      if (/^NOT$/i.test(peek() || '') && /^IN$/i.test(toks[p + 1] || '')) { next(); next(); const list = inlist(); return list.indexOf(String(left)) < 0; }
      if (/^IN$/i.test(peek() || '')) { next(); const list = inlist(); return list.indexOf(String(left)) >= 0; }
      return !!left;
    }
    function inlist() { next(); const out = []; while (peek() !== ')') { if (peek() === ',') { next(); continue; } out.push(String(val())); } next(); return out; }
    function notx() { if (/^NOT$/i.test(peek() || '')) { next(); return !notx(); } return primary(); }
    function andx() { let l = notx(); while (/^AND$/i.test(peek() || '')) { next(); const r = notx(); l = l && r; } return l; }
    function orx() { let l = andx(); while (/^OR$/i.test(peek() || '')) { next(); const r = andx(); l = l || r; } return l; }
    return orx();
  }
}
function splitTop(s) { const out = []; let d = 0, q = false, cur = ''; for (const ch of s) { if (ch === "'" ) q = !q; if (!q) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur); cur = ''; continue; } } cur += ch; } if (cur.trim()) out.push(cur); return out; }

/* ---------- env ---------- */
const kv = new Map();
const docs = new Map();
const claude = { calls: [] };
const mindNs = [];
const env = {
  MIND_DB: new FakeD1(),
  AXIOM_KV: { get: async k => (kv.has(k) ? kv.get(k) : null), put: async (k, v) => { kv.set(k, String(v)); }, delete: async k => { kv.delete(k); } },
  AI: { run: async (m, { text }) => ({ data: text.map(() => Array(8).fill(0.1)) }) },
  MIND_VECTORS: { query: async (vec, opts) => (mindNs.push((opts || {}).namespace), (opts || {}).namespace !== 'mca' ? { matches: [] } : { matches: [{ score: 0.91, metadata: { docId: 'mca_1', title: 'Hands Off Our Fuel - approved captions', kind: 'copy', source: 'pack:mca:hoof:facebook:exemplars/copy-hoof.md', snippet: 'Fuel Tax Credits are not a subsidy. Hands Off Our Fuel.' } }, { score: 0.8, metadata: { docId: 'mca_2', title: 'Some news', kind: 'news', source: 'x', snippet: 'noise' } }] }), insert: async () => ({}) },
  MIND_DOCS: { put: async (k, v) => { docs.set(k, v); }, get: async k => (docs.has(k) ? { body: docs.get(k), arrayBuffer: async () => docs.get(k), httpMetadata: {} } : null), delete: async k => { docs.delete(k); } },
  ANTHROPIC_API_KEY: 'test-key',
  AXIOM_KEYS: JSON.stringify({ 'full-key': { n: 'Hesh', r: 'full' }, 'read-key': { n: 'Steve', r: 'read' } }),
};
const ctx = { waits: [], waitUntil(p) { this.waits.push(p); } };

/* ---------- Claude stub ---------- */
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.indexOf('api.anthropic.com') >= 0) {
    const body = JSON.parse(init.body); const sys = body.system; const user = body.messages[0].content;
    claude.calls.push({ sys, user });
    let out;
    if (/You edit existing/.test(sys)) {
      const instr = (user.match(/INSTRUCTION FROM THE TEAM:\n([\s\S]*?)\n\nPIECES/) || [])[1] || '';
      const ns = Array.from(user.matchAll(/^\[(\d+)\] (\w+)/gm)).map(x => Number(x[1]));
      const standing = /always|never|per cent/i.test(instr) && !/Bendigo/i.test(instr);
      out = { items: ns.map(n => ({ n, body: 'REVISED(' + n + '): ' + (standing ? 'Mining paid 30 per cent of all company taxes - more than any other industry. That\'s the difference Australian mining makes.' : 'Greater Bendigo benefits from mining: $96.2 million in salaries. That\'s the difference Australian mining makes.'), cta: 'Learn more: thatsmining.com.au', link: 'thatsmining.com.au', hashtags: [] })),
        note: 'Changed ' + ns.length + ' piece' + (ns.length === 1 ? '' : 's') + ': ' + instr.slice(0, 40), memory: { standing, rule: standing ? 'Write per cent in body copy, never the % sign.' : '', why: instr, confidence: standing ? 0.92 : 0.15 } };
    } else {
      if (claude.mode === 'refusal') return new Response(JSON.stringify({ content: [], stop_reason: 'refusal' }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (claude.mode === 'prose' || (claude.mode === 'prose-once' && !/Answer with the JSON object only/.test(user))) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'I need the approved facts for this campaign before I can write it. Could you share the figures you want used?' }], stop_reason: 'end_turn' }), { status: 200, headers: { 'content-type': 'application/json' } });
      const plats = ((user.match(/for each of: ([^.]+)\./) || [])[1] || 'facebook').split(',').map(s => s.trim());
      const n = Number((user.match(/Write (\d+) piece/) || [])[1] || 1);
      const items = [];
      plats.forEach(p => { for (let k = 0; k < n; k++) {
        const variant = (items.length) % 4;
        const body = variant === 0 ? 'Did you know the latest government data shows the mining industry paid $74 billion in tax and royalties in one year?\n\nThat\'s the difference Australian mining makes.'
          : variant === 1 ? 'Mining paid $99 billion last year - more than any other industry.\n\nThat\'s the difference Australian mining makes.'
          : variant === 2 ? 'Fuel Tax Credits are a subsidy that farmers rely on.\n\nHands Off Our Fuel.'
          : 'Fuel Tax Credits are not a subsidy. They stop businesses paying a road tax on fuel used off public roads.\n\nHands Off Our Fuel.';
        items.push({ platform: p, title: p === 'reddit' ? 'What the ATO data actually says about mining tax' : '', body, cta: 'Learn more: thatsmining.com.au', link: 'thatsmining.com.au', hashtags: p === 'instagram' ? ['Australia'] : [], alt: 'A haul truck at dawn', visual: 'Wide shot, warm light', factIds: variant === 0 ? ['tax74'] : [], note: 'angle ' + variant });
      } });
      out = { items };
    }
    return new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(out) }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 404 });
};

/* ---------- runner ---------- */
const mod = await import(WORKER);
const handler = mod.default;
async function req(method, path, body, key = 'full-key') {
  const r = new Request('https://newsaus.test' + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, key ? { 'X-Axiom-Key': key } : {}), body: body ? JSON.stringify(body) : undefined });
  const res = await handler.fetch(r, env, ctx);
  let d = null; try { d = await res.json(); } catch (e) { d = null; }
  return { status: res.status, d };
}
async function drain() { const w = ctx.waits.splice(0); await Promise.all(w); }
let pass = 0, fail = 0;
async function t(name, fn) { try { await fn(); pass++; console.log('  ok   ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join('\n       ')); } }
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'expected') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };

console.log('content-worker harness');
await t('GET /content/platforms lists the specs without needing D1', async () => {
  const r = await req('GET', '/content/platforms', null, 'read-key');
  eq(r.status, 200); eq(r.d.platforms.facebook.max, 900); ok(r.d.platforms.reddit.title, 'reddit takes a title');
});
await t('POST /brand/kit stores the structured voice profile, sanitised', async () => {
  const r = await req('POST', '/brand/kit', { ns: 'mca', name: 'Minerals Council of Australia', voice: 'Plain, factual.', rules: 'ALWAYS say mining.',
    campaigns: [{ id: 'hoof', name: 'Hands Off Our Fuel', signoff: 'Hands Off Our Fuel.', cta: 'Sign the petition: handsoffourfuel.com.au', url: 'handsoffourfuel.com.au' }, { name: 'That\'s the difference (national)', signoff: 'That\'s the difference Australian mining makes.', sourceLine: 'Source: ATO (2025)' }, 'junk', { id: '' }],
    facts: [{ id: 'tax74', text: 'The mining industry paid $74 billion in tax and royalties in one year - more than any other industry.', source: 'ATO 2022-23; EY 2025', campaign: 'national' }, { id: 'tax30pc', text: 'Mining paid 30 per cent of all company taxes.', source: 'ATO', status: 'approved' }, { id: 'gdp276', text: 'Mining contributed $276 billion directly.', status: 'pending' }, { text: '' }],
    banned: [{ term: 'subsidy', use: 'a refund of road tax on fuel used off public roads', allowNegated: true }, 'resources sector', { term: '' }],
    platforms: { linkedin: { notes: 'Short, source line included.', max: 600, hashtags: 0 }, bogus: { notes: 'x' } },
    segments: [{ id: 's6', name: 'Segment 6', who: 'Older, regional', themes: 'Medicare, defence' }], people: [{ name: 'Tania Constable', title: 'CEO', role: 'Spokesperson' }] });
  eq(r.status, 200);
  const k = r.d.kit;
  eq(k.campaigns.map(c => c.id), ['hoof', 'thatsthedifferencenation'], 'campaign ids: given or slugged from the name, junk dropped');
  eq(k.facts.length, 3); eq(k.facts[2].status, 'pending'); eq(k.facts[0].campaign, 'national');
  eq(k.banned.length, 2); eq(k.banned[0].allowNegated, true); eq(k.banned[1].term, 'resources sector');
  ok(k.platforms.linkedin && k.platforms.linkedin.max === 600 && !k.platforms.bogus, 'only known platforms kept');
  eq(k.segments[0].id, 's6'); eq(k.people[0].name, 'Tania Constable');
});
await t('a later POST without arrays keeps them (palette-only edits do not wipe the profile)', async () => {
  const r = await req('POST', '/brand/kit', { ns: 'mca', palette: { primary: '#F0A64B' } });
  eq(r.d.kit.campaigns.length, 2); eq(r.d.kit.facts.length, 3); eq(r.d.kit.palette.primary, '#F0A64B');
  const g = await req('GET', '/brand/kit?ns=mca', null, 'read-key'); eq(g.status, 200); eq(g.d.kit.banned.length, 2);
});
await t('POST /content/generate rejects a set with no platforms and one with nothing to write from', async () => {
  const a = await req('POST', '/content/generate', { ns: 'mca', platforms: ['carrierpigeon'], brief: 'Something about mining' }); eq(a.status, 400); eq(a.d.error, 'missing_platforms');
  const b = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'hi' }); eq(b.status, 400); eq(b.d.error, 'missing_brief');
  const c = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'From the pack', source: { kind: 'release', id: 'nope' } }); eq(c.status, 404); eq(c.d.error, 'unknown_pack');
});
await t('a read-only key can list but not write', async () => {
  const a = await req('GET', '/content/list?ns=mca', null, 'read-key'); eq(a.status, 200); eq(a.d.sets, []);
  const b = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'Thank the petition signers' }, 'read-key'); eq(b.status, 403); eq(b.d.error, 'read_only');
  const c = await req('POST', '/content/revise', { id: 'x', instruction: 'shorter' }, 'read-key'); eq(c.status, 403);
});
let setId = '', jobId = '';
await t('POST /content/generate writes n pieces per platform in the campaign frame and checks every one', async () => {
  const r = await req('POST', '/content/generate', { ns: 'mca', campaign: 'hoof', segment: 's6', platforms: ['facebook', 'linkedin', 'instagram', 'facebook'], brief: 'The petition passed 20,000 signatures - thank the signers and ask for one more push.', n: 2 });
  eq(r.status, 200); ok(r.d.id && r.d.job, 'id and job'); eq(r.d.platforms, ['facebook', 'linkedin', 'instagram'], 'platforms deduped, order kept');
  setId = r.d.id; jobId = r.d.job;
  await drain();
  const s = await req('GET', '/content/set?id=' + setId, null, 'read-key');
  eq(s.status, 200); eq(s.d.set.status, 'written'); eq(s.d.set.items.length, 6); eq(s.d.set.campaign, 'hoof'); eq(s.d.set.segment, 's6');
  const it = s.d.set.items;
  eq(it.map(x => x.platform), ['facebook', 'facebook', 'linkedin', 'linkedin', 'instagram', 'instagram']);
  ok(it[0].check.ok, 'the $74 billion piece traces to the approved fact: ' + JSON.stringify(it[0].check));
  ok(it[1].check.flags.indexOf('unverified_figure') >= 0 && it[1].check.missing.indexOf('99') >= 0, '$99 billion is flagged as not in facts or source');
  ok(it[2].check.flags.indexOf('banned_term') >= 0 && it[2].check.banned[0] === 'subsidy', '"a subsidy" is a banned term');
  ok(it[3].check.ok, '"not a subsidy" is a denial and passes: ' + JSON.stringify(it[3].check));
  eq(it[4].hashtags, ['Australia']); ok(it[4].check.ok, 'one hashtag on instagram is within the limit');
  ok(it[5].check.flags.indexOf('unverified_figure') >= 0, 'second instagram piece repeats the $99 billion variant and is flagged');
  const sys = claude.calls[claude.calls.length - 1].sys;
  ok(/CAMPAIGN - Hands Off Our Fuel/.test(sys) && /Sign-off \(close with it, spelled exactly\): "Hands Off Our Fuel."/.test(sys), 'the campaign frame is in the prompt');
  ok(/AUDIENCE - Segment 6/.test(sys), 'the audience is in the prompt');
  ok(/\[tax74\]/.test(sys) && !/\$276 billion/.test(sys), 'approved facts are listed, pending ones held back');
  ok(/NEVER USE these words/.test(sys) && /"subsidy"/.test(sys), 'banned terms are in the prompt');
  ok(/APPROVED EXAMPLES/.test(sys) && /Hands Off Our Fuel - approved captions/.test(sys) && !/Some news/.test(sys), 'only copy/outcome/brief examples from the Mind are quoted');
  ok(/HOW THIS CLIENT USES LINKEDIN/.test(sys), 'platform notes from the kit are applied');
  ok(!/LEARNED CORRECTIONS/.test(sys), 'no corrections yet');
  const log = env.MIND_DB.table('bridge_log').filter(l => l.job === jobId).map(l => l.text);
  ok(log.some(l => /voice profile: campaign "Hands Off Our Fuel", 2 approved facts, 2 banned terms, audience Segment 6/.test(l)), 'console narrates the profile: ' + log.join(' | '));
  // S23: the narration says what each document is - approved to learn from, to avoid, background - and how it was classified
  ok(log.some(l => /Mind for mca \/ hoof: 1 approved example, 0 to avoid, 0 background, 1 classified by their voice-pack tag/.test(l)), 'console narrates the examples: ' + log.filter(l => /Mind/.test(l)).join(' | '));
  ok(log.some(l => /6 pieces: facebook x2, linkedin x2, instagram x2 - 3 flagged/.test(l)), 'console narrates the result: ' + log.join(' | '));
  const job = env.MIND_DB.table('bridge_jobs').find(j => j.id === jobId); eq(job.status, 'done'); eq(job.source, 'content');
});
await t('GET /content/list summarises the set', async () => {
  const r = await req('GET', '/content/list?ns=mca', null, 'read-key');
  eq(r.d.sets.length, 1); eq(r.d.sets[0].pieces, 6); eq(r.d.sets[0].flagged, 3); eq(r.d.sets[0].platforms, ['facebook', 'linkedin', 'instagram']); eq(r.d.sets[0].campaign, 'hoof');
  const other = await req('GET', '/content/list?ns=aep', null, 'read-key'); eq(other.d.sets, [], 'namespaces stay walls');
});
await t('POST /content/revise with a standing instruction edits all pieces and the Engine learns a rule for this client only', async () => {
  const r = await req('POST', '/content/revise', { id: setId, n: null, instruction: 'Always write per cent instead of the % sign' });
  eq(r.status, 200); eq(r.d.changed.length, 6); ok(r.d.remembered && /per cent/.test(r.d.remembered.rule), 'remembered: ' + JSON.stringify(r.d.remembered));
  ok(r.d.set.items.every(it => /^REVISED\(\d\)/.test(it.body) && it.revisions === 1), 'every piece revised once');
  ok(r.d.set.items.every(it => it.check.ok), 'the revised copy traces to the 30 per cent fact and carries no banned term');
  eq(r.d.set.history.length, 1); eq(r.d.set.history[0].n, null); ok(r.d.set.history[0].ruleId, 'history points at the rule');
  const fixes = env.MIND_DB.table('engine_fixes');
  eq(fixes.length, 1); eq(fixes[0].ns, 'mca'); eq(fixes[0].task, 'copy'); eq(fixes[0].scope, 'client'); eq(fixes[0].source, 'content:' + setId); eq(fixes[0].active, 1);
  ok(/per cent/.test(fixes[0].rule), 'rule text kept from the model');
  const sys = claude.calls[claude.calls.length - 1].sys;
  ok(/You edit existing/.test(sys) && /CAMPAIGN - Hands Off Our Fuel/.test(sys), 'the revise prompt carries the same voice profile');
});
await t('a one-off instruction on one piece changes only that piece and is not remembered', async () => {
  const r = await req('POST', '/content/revise', { id: setId, n: 1, instruction: 'Lead with the Bendigo figure' });
  eq(r.d.changed, [1]); eq(r.d.remembered, null); eq(r.d.memory.standing, false);
  eq(r.d.set.items[1].revisions, 2); eq(r.d.set.items[0].revisions, 1);
  ok(/Bendigo/.test(r.d.set.items[1].body) && r.d.set.items[1].check.flags.indexOf('unverified_figure') >= 0 && r.d.set.items[1].check.missing.indexOf('96.2') >= 0, 'a figure the model brought in that is in neither the facts nor the source is flagged, not dropped: ' + JSON.stringify(r.d.set.items[1].check));
  eq(env.MIND_DB.table('engine_fixes').length, 1, 'no new rule');
  eq(r.d.set.history.length, 2); eq(r.d.set.history[1].n, 1); eq(r.d.set.history[1].ruleId, '');
});
await t('remember:never suppresses a standing rule; remember:always forces one', async () => {
  const a = await req('POST', '/content/revise', { id: setId, n: 0, instruction: 'Never use exclamation marks', remember: 'never' });
  eq(a.d.remembered, null); eq(a.d.memory.standing, true); eq(env.MIND_DB.table('engine_fixes').length, 1);
  const b = await req('POST', '/content/revise', { id: setId, n: 2, instruction: 'Lead with the Bendigo figure here too', remember: 'always' });
  ok(b.d.remembered && b.d.remembered.rule === 'Lead with the Bendigo figure here too', 'forced rule falls back to the instruction text: ' + JSON.stringify(b.d.remembered));
  eq(env.MIND_DB.table('engine_fixes').length, 2);
});
await t('the next build applies the learned corrections', async () => {
  const r = await req('POST', '/content/generate', { ns: 'mca', campaign: 'hoof', platforms: ['x'], brief: 'One line for X on the petition milestone' });
  await drain();
  const sys = claude.calls[claude.calls.length - 1].sys;
  ok(/LEARNED CORRECTIONS - taught by the team, 2 in force/.test(sys), 'both rules in the prompt: ' + sys.slice(sys.indexOf('LEARNED') , sys.indexOf('LEARNED') + 80));
  const log = env.MIND_DB.table('bridge_log').filter(l => l.job === r.d.job).map(l => l.text);
  ok(log.some(l => /applying 2 learned corrections for mca/.test(l)), 'console says so');
  const s = await req('GET', '/content/set?id=' + r.d.id, null, 'read-key'); eq(s.d.set.items.length, 2, 'two per platform is the default'); eq(s.d.set.items[0].platform, 'x');
});
await t('another client does not see MCA rules or examples', async () => {
  const r = await req('POST', '/content/generate', { ns: 'aep', platforms: ['linkedin'], brief: 'Gas keeps the lights on this winter' });
  await drain();
  const sys = claude.calls[claude.calls.length - 1].sys;
  ok(!/LEARNED CORRECTIONS/.test(sys), 'no MCA rules for AEP');
  ok(!/Hands Off Our Fuel/.test(sys), 'no MCA campaign for AEP');
});
await t('POST /content/update saves a hand edit and re-checks it', async () => {
  const r = await req('POST', '/content/update', { id: setId, n: 0, patch: { body: 'Mining paid $12 billion. Hands Off Our Fuel.', cta: 'Sign the petition' } });
  eq(r.status, 200); eq(r.d.item.cta, 'Sign the petition'); ok(r.d.item.check.flags.indexOf('unverified_figure') >= 0 && r.d.item.check.missing.indexOf('12') >= 0, 'a made-up figure is flagged on save: ' + JSON.stringify(r.d.item.check));
  const s = await req('GET', '/content/set?id=' + setId, null, 'read-key'); eq(s.d.set.items[0].body, 'Mining paid $12 billion. Hands Off Our Fuel.');
});
await t('POST /content/verdict records approve/kill as Engine outcomes and WIN/LOSS exemplars', async () => {
  const a = await req('POST', '/content/verdict', { id: setId, n: 3, verdict: 'approved' });
  eq(a.status, 200); eq(a.d.item.verdict, 'approved');
  const b = await req('POST', '/content/verdict', { id: setId, n: 2, verdict: 'killed', why: 'too long' });
  eq(b.d.item.verdict, 'killed');
  const oc = env.MIND_DB.table('engine_outcomes'); eq(oc.length, 2); eq(oc[0].surface, 'content'); eq(oc[0].ref, setId); eq(oc[1].why, 'too long');
  const md = env.MIND_DB.table('mind_docs').filter(d => d.kind === 'outcome'); eq(md.length, 2); ok(/^WIN: /.test(md[0].title) && /^LOSS: /.test(md[1].title), 'exemplars titled WIN/LOSS');
  const l = await req('GET', '/content/list?ns=mca', null, 'read-key'); eq(l.d.sets.find(x => x.id === setId).approved, 1);
});
await t('unknown set and piece answer 404', async () => {
  eq((await req('GET', '/content/set?id=zzz', null, 'read-key')).status, 404);
  eq((await req('POST', '/content/revise', { id: setId, n: 99, instruction: 'shorter' })).status, 404);
  eq((await req('POST', '/content/update', { id: 'zzz', n: 0, patch: {} })).status, 404);
});
await t('a source pasted as text is the only other place figures may come from', async () => {
  const r = await req('POST', '/content/generate', { ns: 'mca', campaign: 'hoof', platforms: ['facebook'], brief: 'Use the release', source: { kind: 'text', text: 'Media release: the industry paid $99 billion in the year to June, the Council said today, in a statement of some length that runs past forty characters.' }, n: 2 });
  await drain();
  const s = await req('GET', '/content/set?id=' + r.d.id, null, 'read-key');
  ok(s.d.set.items[1].check.ok, 'the $99 billion piece now traces to the source: ' + JSON.stringify(s.d.set.items[1].check));
  const user = claude.calls[claude.calls.length - 1].user; ok(/SOURCE MATERIAL/.test(user) && /\$99 billion/.test(user), 'source in the user turn');
});
await t('the release desk composer also carries the banned terms', async () => {
  const sysBefore = claude.calls.length;
  await req('POST', '/release/pack', { ns: 'mca', text: 'MEDIA RELEASE. '.repeat(20) + 'The Minerals Council of Australia welcomed the Budget today. CEO Tania Constable said the settings were stable. Mining paid $74 billion in tax and royalties.' });
  await drain();
  const composeCall = claude.calls.slice(sysBefore).find(c => /creative director/.test(c.sys));
  ok(composeCall && /NEVER USE these words/.test(composeCall.sys) && /"subsidy"/.test(composeCall.sys), 'release compose prompt lists the banned terms');
});
await t('the creative shelf: the Content Desk reads <ns>_creative beside the namespace; /mind/query does so only when asked', async () => {
  ok(mindNs.includes('mca_creative'), 'a build asked the creative shelf: ' + JSON.stringify(Array.from(new Set(mindNs))));
  ok(mindNs.includes('mca') && mindNs.includes('cmm'), 'and the namespace and the shared layer');
  mindNs.length = 0;
  await req('POST', '/mind/query', { namespace: 'mca', q: 'fuel tax credit myth' }, 'full-key');
  ok(!mindNs.includes('mca_creative'), 'a plain query stays out of the shelf: ' + JSON.stringify(mindNs));
  mindNs.length = 0;
  await req('POST', '/mind/query', { namespace: 'mca', q: 'fuel tax credit myth', creative: true }, 'full-key');
  eq(mindNs.filter(n => n === 'mca_creative').length, 1, 'creative:true adds it: ' + JSON.stringify(mindNs));
  ok(!mindNs.includes('aep_creative'), 'never another client\'s');
});
await t('a prose answer is asked again for the JSON and the log quotes what the model said; prose twice fails with the excerpt; a refusal is named', async () => {
  const logOf = id => env.MIND_DB.table('bridge_log').filter(l => l.job === id).map(l => l.text);
  claude.mode = 'prose-once';
  const g = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'Create a Meta ad creative on mining fuel tax credit', n: 1 }); eq(g.status, 200); await drain();
  const s = await req('GET', '/content/set?id=' + g.d.id); eq(s.d.set.status, 'written'); eq(s.d.set.items.length, 1);
  ok(logOf(g.d.job).some(l => /did not answer with the JSON items: "I need the approved facts/.test(l) && /asked once more/.test(l)), logOf(g.d.job).join(' | '));
  ok(/Answer with the JSON object only/.test(claude.calls[claude.calls.length - 1].user), 'the second call carries the nudge');
  claude.mode = 'prose';
  const g2 = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'Create a Meta ad creative on mining fuel tax credit', n: 1 }); await drain();
  eq((await req('GET', '/content/set?id=' + g2.d.id)).d.set.status, 'failed');
  ok(logOf(g2.d.job).some(l => /compose_unparseable: the model answered in prose twice - "I need the approved facts/.test(l)), logOf(g2.d.job).join(' | '));
  claude.mode = 'refusal';
  const g3 = await req('POST', '/content/generate', { ns: 'mca', platforms: ['facebook'], brief: 'Create a Meta ad creative on mining fuel tax credit', n: 1 }); eq(g3.status, 200); await drain();
  ok(logOf(g3.d.job).some(l => /refusal: the model declined this request/.test(l)), logOf(g3.d.job).join(' | '));
  claude.mode = '';
});
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
