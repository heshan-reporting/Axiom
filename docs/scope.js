/* AXIOM - the scope bar. One row under the navigation that narrows every
 * view at once: client, client issue, party or person, channel, window and
 * region. The islands read it through AXUI.useScope; the bar only sets it.
 * Legacy views (Newsroom, Pulse, Radar, Audience) keep their own controls. */
(function () {
  'use strict';
  if (!window.AXUI) return;
  const { html, call, scope, setScope, useScope, scopeActive, SCOPE_DEF } = window.AXUI;
  const { useState, useEffect } = React;
  const PLATFORMS = [['news', 'News'], ['reddit', 'Reddit'], ['x', 'X'], ['bluesky', 'Bluesky'], ['mastodon', 'Mastodon'], ['youtube', 'YouTube'], ['substack', 'Substack'], ['linkedin', 'LinkedIn'], ['meta', 'Facebook / Instagram'], ['forum', 'Forums']];
  const REGIONS = [['au', 'National'], ['nsw', 'NSW'], ['vic', 'Victoria'], ['qld', 'Queensland'], ['wa', 'WA'], ['sa', 'SA'], ['tas', 'Tasmania'], ['act', 'ACT'], ['nt', 'NT']];
  const WINDOWS = [[1, '24 hours'], [3, '3 days'], [7, '7 days'], [30, '30 days']];
  const issues = () => (typeof AX_ISSUES !== 'undefined' && Array.isArray(AX_ISSUES) ? AX_ISSUES : []);
  const clients = () => { const seen = {}; return issues().filter(i => i.ns && !seen[i.ns] && (seen[i.ns] = 1)).map(i => ({ ns: i.ns, name: i.client || i.ns })); };

  function ScopeBar() {
    const [s, setS] = useState(scope());
    const [ents, setEnts] = useState(null);
    useScope(v => setS(Object.assign({}, v)));
    useEffect(() => { call('/entities?active=1').then(d => setEnts((d.entities || []).filter(e => e.kind === 'party' || e.kind === 'person').sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'party' ? -1 : 1)))).catch(() => setEnts([])); }, []);
    const set = (k, v) => setScope({ [k]: v });
    const n = scopeActive(s);
    const iss = issues().filter(i => !s.ns || i.ns === s.ns);
    const entName = id => { const e = (ents || []).find(x => x.id === id); return e ? e.name : id; };
    return html`<div class="scope-bar" role="group" aria-label="Scope">
      <span class="scope-lbl">Scope</span>
      <select class=${s.ns ? 'on' : ''} value=${s.ns} onChange=${e => { const ns = e.target.value; const keep = !ns || issues().some(i => i.id === s.issue && i.ns === ns); setScope({ ns, issue: keep ? s.issue : '' }); }} aria-label="Client"><option value="">Every client</option>${clients().map(c => html`<option key=${c.ns} value=${c.ns}>${c.name}</option>`)}</select>
      <select class=${s.issue ? 'on' : ''} value=${s.issue} onChange=${e => set('issue', e.target.value)} aria-label="Client issue"><option value="">Every issue</option>${iss.map(i => html`<option key=${i.id} value=${i.id}>${i.label || i.id}</option>`)}</select>
      <select class=${s.entity ? 'on' : ''} value=${s.entity} onChange=${e => set('entity', e.target.value)} aria-label="Party or person" disabled=${ents === null}>
        <option value="">${ents === null ? 'Loading the register...' : ents.length ? 'Any party or person' : 'Register not readable'}</option>
        ${s.entity && ents && !ents.some(e => e.id === s.entity) ? html`<option value=${s.entity}>${entName(s.entity)}</option>` : null}
        ${(ents || []).filter(e => e.kind === 'party').length ? html`<optgroup label="Parties">${(ents || []).filter(e => e.kind === 'party').map(e => html`<option key=${e.id} value=${e.id}>${e.name}</option>`)}</optgroup>` : null}
        ${(ents || []).filter(e => e.kind === 'person').length ? html`<optgroup label="People">${(ents || []).filter(e => e.kind === 'person').map(e => html`<option key=${e.id} value=${e.id}>${e.name}${e.party ? ' (' + String(e.party).toUpperCase() + ')' : ''}</option>`)}</optgroup>` : null}
      </select>
      <select class=${s.platform ? 'on' : ''} value=${s.platform} onChange=${e => set('platform', e.target.value)} aria-label="Channel"><option value="">Every channel</option>${PLATFORMS.map(p => html`<option key=${p[0]} value=${p[0]}>${p[1]}</option>`)}</select>
      <select class=${s.days ? 'on' : ''} value=${String(s.days || 0)} onChange=${e => set('days', +e.target.value)} aria-label="Window"><option value="0">Each view's window</option>${WINDOWS.map(w => html`<option key=${w[0]} value=${String(w[0])}>${w[1]}</option>`)}</select>
      <select class=${s.region ? 'on' : ''} value=${s.region} onChange=${e => set('region', e.target.value)} aria-label="Region"><option value="">Every region</option>${REGIONS.map(r => html`<option key=${r[0]} value=${r[0]}>${r[1]}</option>`)}</select>
      ${n ? html`<button class="scope-clear" onClick=${() => setScope(Object.assign({}, SCOPE_DEF))}>Clear ${n} filter${n === 1 ? '' : 's'}</button>` : html`<span class="scope-hint">Narrows Sentiment, Narratives, Signals, Sources and the front page together</span>`}
    </div>`;
  }
  let mounted = false;
  window.scopeInit = function () {
    const root = document.getElementById('scope-root');
    if (!root || mounted) return; mounted = true;
    ReactDOM.createRoot(root).render(html`<${ScopeBar} />`);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', window.scopeInit); else window.scopeInit();
})();
