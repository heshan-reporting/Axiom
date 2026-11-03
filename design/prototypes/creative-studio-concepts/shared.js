/* Shared sample for the three Creative Studio concepts: one synthetic client, one project, one set of copy and requirements,
 * and one tile renderer, so the concepts differ in structure only. Nothing here talks to AXIOM. */
(function () {
  const client = {
    name: 'Harbourline Ferries', tag: 'SYNTHETIC DEMO CLIENT', ns: 'synthdemo',
    palette: { primary: '#0B4F6C', secondary: '#F2A541', bg: '#F7F4EE', text: '#13232F' },
    voice: 'Plain, warm and local: a ferry operator talking to the people who ride it. Short sentences, real times and places.',
  };
  const project = {
    title: 'Two more morning crossings', campaign: 'Harbour crossings',
    objective: 'Tell daily riders the two extra morning crossings start on Monday 9 March.',
    audience: 'Weekday commuters between Pier 2 and Northbridge Wharf',
    message: 'Two more morning crossings from Monday.',
    action: 'Plan your crossing',
    deliverables: [
      { id: 'ig', label: 'Instagram feed', format: '4:5', px: '1080 x 1350' },
      { id: 'fb', label: 'Facebook feed', format: '1:1', px: '1080 x 1080' },
      { id: 'st', label: 'Instagram story', format: '9:16', px: '1080 x 1920' },
    ],
    source: 'Timetable notice TN-0326: from Monday 9 March, extra services leave Pier 2 at 6.40am and 7.10am for Northbridge Wharf, Monday to Friday.',
  };
  const requirements = [
    { id: 'R1', text: 'Name the wharf', from: 'Brand rule', kind: 'rule' },
    { id: 'R2', text: 'Only announced times, never a promise', from: 'Brand rule', kind: 'rule' },
    { id: 'R3', text: 'Harbourline logo bottom right, clear space half its height', from: 'Campaign rule (Harbour crossings)', kind: 'rule' },
    { id: 'R4', text: 'Only approved facts (42 crossings a day). The draft "99 crossings" is not approved', from: 'Approved facts', kind: 'fact' },
    { id: 'R5', text: 'Say "good value", never "cheap"', from: 'Banned term', kind: 'banned' },
    { id: 'R6', text: 'Story: words clear of the top 14% and bottom 20%', from: 'Instagram safe area', kind: 'platform' },
  ];
  const copy = {
    headline: 'Two more morning crossings from Monday.',
    support: 'The 6.40 and 7.10 now leave Pier 2 for Northbridge Wharf, weekdays.',
    cta: 'Plan your crossing',
    kicker: 'FROM 9 MARCH',
    caption: 'Two more ways to beat the bridge. From Monday 9 March the 6.40am and 7.10am leave Pier 2 for Northbridge Wharf, every weekday. Plan your crossing at the link in bio.',
    alt: 'A Harbourline ferry leaving Pier 2 at first light, with the words: Two more morning crossings from Monday.',
  };
  const references = [
    { id: 'F1', name: 'Easter timetable tile', purpose: 'approved', note: 'Approved 14 Oct 2026. Leads with the wharf name; gold band at the foot; logo bottom right.', look: 'band' },
    { id: 'F2', name: 'Wharf photography set', purpose: 'imagery', note: 'Pier 2 and Northbridge at first light. Real riders, no posed smiles.', look: 'photo' },
    { id: 'F3', name: 'Brand sheet', purpose: 'brand', note: 'Logo, clear space, colours, type.', look: 'brand' },
    { id: 'F4', name: 'Rival river service poster', purpose: 'inspiration', note: 'Bold timetable typography. Inspiration only: no layout or claims reused.', look: 'board' },
  ];
  /* four creative routes; `follows` maps requirement id -> 'yes' | 'watch' | 'no' with a reason */
  const directions = [
    { id: 'D1', name: 'First light, Pier 2', medium: 'Documentary photograph', idea: 'Show the crossing itself: the 6.40 pulling out of Pier 2 as the harbour turns gold.',
      rationale: 'Awareness first. A real place riders know makes the news feel close and true; the photograph carries the warmth the voice asks for.',
      mood: { words: ['early', 'calm', 'warm', 'local'], swatches: ['#F2A541', '#E9C79A', '#0B4F6C', '#1C3442'] },
      imagery: 'Full-bleed dawn photograph from the wharf set: the ferry leaving, a few riders on deck, natural light, nothing staged.',
      layout: 'Photograph full bleed; a gold band at the foot holds the headline and times; logo bottom right in the band.',
      copy: { headline: 'Two more morning crossings from Monday.', support: 'The 6.40 and 7.10 now leave Pier 2 for Northbridge Wharf.' },
      follows: { R1: ['yes', 'Pier 2 and Northbridge Wharf named'], R2: ['yes', 'Only the two announced times'], R3: ['yes', 'Logo in the band, bottom right'], R4: ['yes', 'No figures beyond the times'], R5: ['yes', 'No banned terms'], R6: ['watch', 'The band must rise above the bottom 20% in the story'] },
      refs: ['F1', 'F2'], cost: '1 image at 2K', partner: 'Recommended. It follows your approved Easter tile (wharf first, gold band, logo bottom right) and gives the news a real place. One image; the story moves the band up.', score: 3, spec: 'dawn' },
    { id: 'D2', name: 'The departure board', medium: 'Typographic, data-led', idea: 'The news is two times. Make the times the picture, set like a departure board with the new ones lit gold.',
      rationale: 'An announcement is read for the facts. Riders scan for "my time"; a board answers that in one glance and needs no image.',
      mood: { words: ['precise', 'useful', 'bright'], swatches: ['#0B4F6C', '#F2A541', '#F7F4EE', '#13232F'] },
      imagery: 'No photograph. The brand blue as ground, the board rows in white, the two new times in gold.',
      layout: 'Board fills the upper two thirds; headline beneath; logo bottom right on the blue.',
      copy: { headline: '6.40 and 7.10. New from Monday.', support: 'Two more morning crossings, Pier 2 to Northbridge Wharf.' },
      follows: { R1: ['yes', 'Both wharves on the board'], R2: ['watch', 'Reads like a timetable: the rows must match notice TN-0326 exactly'], R3: ['yes', 'Logo bottom right'], R4: ['yes', 'Only announced times'], R5: ['yes', 'No banned terms'], R6: ['yes', 'Board sits in the safe area'] },
      refs: ['F1', 'F3', 'F4'], cost: 'Layout only, no image', partner: 'Strong runner-up: the clearest facts and free to make, but it reads as a timetable. Combined with First light, the two times can sit in its band.', score: 2, spec: 'board' },
    { id: 'D3', name: 'Twenty more minutes', medium: 'Editorial illustration', idea: 'Turn the extra crossing into time back: breakfast at home instead of the bridge queue.',
      rationale: 'Benefit-led: speaks to why a rider would switch. Warm and human, but it leans on a claim we have not approved.',
      mood: { words: ['human', 'light', 'domestic'], swatches: ['#F7F4EE', '#F2A541', '#7FA7B8', '#13232F'] },
      imagery: 'Flat illustration of a kitchen table at dawn with the ferry in the window.',
      layout: 'Illustration top; headline and support set left beneath; logo bottom right.',
      copy: { headline: 'Twenty more minutes at home.', support: 'Two more morning crossings from Pier 2, from Monday.' },
      follows: { R1: ['yes', 'Pier 2 named'], R2: ['yes', 'No timetable promise'], R3: ['yes', 'Logo bottom right'], R4: ['no', '"Twenty more minutes" is not an approved fact'], R5: ['yes', 'No banned terms'], R6: ['yes', 'Words in the safe area'] },
      refs: ['F3'], cost: '1 image at 2K', partner: 'Set aside unless the time saving is approved. The idea is good; the claim is not ours to make yet.', score: 1, spec: 'paper' },
    { id: 'D4', name: 'Neighbours on the 6.40', medium: 'Portrait series', idea: 'Three regular riders, one line each, about the crossing they would take.',
      rationale: 'Community and trust. Builds the brand over a series, slower for a one-week announcement.',
      mood: { words: ['friendly', 'familiar', 'candid'], swatches: ['#1C3442', '#F2A541', '#C9D6DD', '#F7F4EE'] },
      imagery: 'Three candid portraits on deck. Needs casting and consent; renders are stand-ins until then.',
      layout: 'Portrait full bleed with a quote card; times in a small strip; logo bottom right.',
      copy: { headline: '"Now I can take the early one."', support: 'Two more morning crossings from Pier 2, from Monday 9 March.' },
      follows: { R1: ['yes', 'Pier 2 named'], R2: ['yes', 'Only announced times'], R3: ['yes', 'Logo bottom right'], R4: ['watch', 'Quotes must come from real riders, with consent'], R5: ['yes', 'No banned terms'], R6: ['watch', 'The quote card needs moving up in the story'] },
      refs: ['F2'], cost: '3 images at 2K', partner: 'Better as the follow-up series than the announcement.', score: 1, spec: 'night' },
  ];

  /* layouts in per cent of the stage; size in cqw (per cent of the stage width) so the tile scales with its box */
  function layout(format, spec) {
    const story = format === '9:16', square = format === '1:1';
    const foot = story ? 64 : square ? 58 : 62;
    if (spec === 'board') return { format, bg: 'board', layers: [
      { id: 'board', role: 'board', type: 'board', x: 7, y: story ? 16 : 9, w: 86, h: story ? 36 : square ? 44 : 42 },
      { id: 'headline', role: 'headline', type: 'text', x: 7, y: story ? 54 : square ? 55 : 56, w: 86, h: story ? 9.5 : square ? 17 : 14, size: 7.2, weight: 800, color: '#FFFFFF', text: '6.40 and 7.10. New from Monday.' },
      { id: 'support', role: 'support', type: 'text', x: 7, y: story ? 64.5 : square ? 72 : 70, w: 70, h: 8, size: 3.4, weight: 500, color: '#D7E4EA', text: 'Two more morning crossings, Pier 2 to Northbridge Wharf.' },
      { id: 'cta', role: 'cta', type: 'cta', x: 7, y: story ? 72 : square ? 84 : 82, w: 34, h: 6, size: 3, weight: 700, color: '#13232F', fill: '#F2A541', text: 'Plan your crossing' },
      { id: 'logo', role: 'logo', type: 'logo', x: 66, y: story ? 73 : square ? 86 : 85, w: 27, h: 6, tone: 'light' } ] };
    if (spec === 'paper') return { format, bg: 'paper', layers: [
      { id: 'headline', role: 'headline', type: 'text', x: 7, y: foot - 6, w: 80, h: square ? 15.8 : 13.5, size: 7, weight: 800, color: '#13232F', text: 'Twenty more minutes at home.' },
      { id: 'support', role: 'support', type: 'text', x: 7, y: foot + (square ? 10 : 8), w: 70, h: 8, size: 3.4, weight: 500, color: '#3A4A55', text: 'Two more morning crossings from Pier 2, from Monday.' },
      { id: 'logo', role: 'logo', type: 'logo', x: 66, y: story ? 73 : 86, w: 27, h: 6, tone: 'dark' } ] };
    return { format, bg: spec === 'night' ? 'night' : 'dawn', layers: [
      { id: 'band', role: 'band', type: 'shape', x: 0, y: story ? 55 : square ? 60 : 64, w: 100, h: story ? 25 : square ? 40 : 36, fill: spec === 'night' ? 'rgba(19,35,47,.86)' : '#F2A541' },
      { id: 'kicker', role: 'kicker', type: 'text', x: 7, y: story ? 57 : square ? 63 : 67, w: 50, h: 4, size: 2.6, weight: 800, color: '#13232F', text: 'FROM 9 MARCH', track: 0.12 },
      { id: 'headline', role: 'headline', type: 'text', x: 7, y: story ? 61 : square ? 68 : 71, w: 84, h: story ? 10 : square ? 15 : 12, size: 6.4, weight: 800, color: spec === 'night' ? '#FFFFFF' : '#13232F', text: copy.headline },
      { id: 'support', role: 'support', type: 'text', x: 7, y: story ? 72 : square ? 84 : 84, w: 56, h: story ? 6.5 : 8, size: 3.1, weight: 500, color: spec === 'night' ? '#D7E4EA' : '#13232F', text: copy.support },
      { id: 'logo', role: 'logo', type: 'logo', x: 66, y: story ? 73.5 : square ? 88 : 89, w: 27, h: 5, tone: 'dark' } ] };
  }

  function harbour(kind) {
    const night = kind === 'night';
    const sky = night ? ['#0E1C2A', '#1C3442', '#3B5568'] : ['#F6C88C', '#F2A541', '#E37A4E'];
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%">
      <defs><linearGradient id="sky${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset=".55" stop-color="${sky[1]}"/><stop offset="1" stop-color="${sky[2]}"/></linearGradient>
      <linearGradient id="sea${kind}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#22394A' : '#2C6A85'}"/><stop offset="1" stop-color="${night ? '#0B1621' : '#0B4F6C'}"/></linearGradient></defs>
      <rect width="100" height="56" fill="url(#sky${kind})"/>
      <circle cx="70" cy="46" r="${night ? 3 : 9}" fill="${night ? '#E9EEF2' : '#FFE2B0'}" opacity="${night ? .8 : .9}"/>
      <path d="M0 48 L14 44 L26 47 L40 42 L55 46 L68 43 L82 47 L100 44 L100 56 L0 56Z" fill="${night ? '#14283A' : '#B5654A'}" opacity=".55"/>
      <rect y="55" width="100" height="45" fill="url(#sea${kind})"/>
      ${Array.from({ length: 9 }, (_, i) => `<rect x="${(i * 13) % 80}" y="${60 + i * 4}" width="${14 + (i % 3) * 6}" height=".5" fill="${night ? '#5B7A90' : '#F6C88C'}" opacity=".5"/>`).join('')}
      <g transform="translate(24 47)"><path d="M0 8 L34 8 L30 12 L3 12Z" fill="#13232F"/><rect x="6" y="3" width="20" height="5" fill="#F7F4EE"/><rect x="9" y="0" width="10" height="3" fill="#F7F4EE"/>
      ${Array.from({ length: 5 }, (_, i) => `<rect x="${8 + i * 3.6}" y="4.4" width="2" height="1.6" fill="#0B4F6C"/>`).join('')}<rect x="17" y="-3" width="1.4" height="3" fill="#13232F"/></g>
      <g fill="#13232F" opacity=".85">${[4, 9, 14].map(x => `<rect x="${x}" y="50" width="1.4" height="14"/>`).join('')}<rect x="2" y="50" width="16" height="1.6"/></g></svg>`;
  }
  function paper() {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%">
      <rect width="100" height="100" fill="#F7F4EE"/><rect x="10" y="8" width="80" height="42" rx="2" fill="#7FA7B8"/><rect x="10" y="30" width="80" height="20" fill="#0B4F6C"/>
      <circle cx="68" cy="26" r="7" fill="#F2A541"/><g transform="translate(34 25)"><path d="M0 4 L20 4 L18 7 L2 7Z" fill="#13232F"/><rect x="4" y="1" width="11" height="3" fill="#F7F4EE"/></g>
      <rect x="10" y="50" width="80" height="3" fill="#13232F"/><rect x="24" y="40" width="14" height="10" rx="1" fill="#F7F4EE"/><rect x="27" y="36" width="8" height="5" rx="2" fill="#F2A541"/></svg>`;
  }
  function logoSvg(tone) {
    const c = tone === 'light' ? '#FFFFFF' : '#13232F';
    return `<svg viewBox="0 0 150 24" aria-label="Harbourline logo" role="img" style="width:100%;height:100%"><circle cx="12" cy="12" r="10" fill="none" stroke="${c}" stroke-width="2.4"/><path d="M5 14 Q8.5 10 12 14 T19 14" fill="none" stroke="${c}" stroke-width="2.4"/><text x="28" y="17" font-family="Manrope, 'DM Sans', system-ui, sans-serif" font-weight="800" font-size="13" letter-spacing="1.2" fill="${c}">HARBOURLINE</text></svg>`;
  }
  function boardHtml() {
    const rows = [['6.10', 'Northbridge Wharf', ''], ['6.40', 'Northbridge Wharf', 'NEW'], ['7.10', 'Northbridge Wharf', 'NEW'], ['7.30', 'Northbridge Wharf', '']];
    return `<div class="hl-board"><div class="hl-board-h"><span>PIER 2 DEPARTURES</span><span>WEEKDAYS</span></div>${rows.map(r => `<div class="hl-board-r${r[2] ? ' new' : ''}"><b>${r[0]}</b><span>${r[1]}</span><i>${r[2]}</i></div>`).join('')}</div>`;
  }
  const RATIO = { '4:5': 5 / 4, '1:1': 1, '9:16': 16 / 9 };
  /* renderTile(el, layout, {wire, selected}) draws the tile into el (a sized box; the stage keeps the format's ratio) */
  function renderTile(el, lay, o) {
    o = o || {};
    el.classList.add('hl-stage'); el.style.aspectRatio = '1 / ' + RATIO[lay.format];
    const bg = lay.bg === 'board' ? '<div style="position:absolute;inset:0;background:#0B4F6C"></div>' : lay.bg === 'paper' ? paper() : harbour(lay.bg);
    el.innerHTML = (o.wire ? '<div class="hl-wire-bg"></div>' : bg) + lay.layers.filter(l => !l.hidden).map(l => {
      const pos = `left:${l.x}%;top:${l.y}%;width:${l.w}%;height:${l.h}%;`;
      const cls = 'hl-layer' + (o.wire ? ' wire' : '') + (o.selected === l.id ? ' sel' : '');
      if (o.wire) return `<div class="${cls}" data-id="${l.id}" style="${pos}"><span>${l.role}</span></div>`;
      if (l.type === 'shape') return `<div class="${cls}" data-id="${l.id}" style="${pos}background:${l.fill}"></div>`;
      if (l.type === 'logo') return `<div class="${cls}" data-id="${l.id}" style="${pos}">${logoSvg(l.tone)}</div>`;
      if (l.type === 'board') return `<div class="${cls}" data-id="${l.id}" style="${pos}">${boardHtml()}</div>`;
      if (l.type === 'cta') return `<div class="${cls} hl-cta" data-id="${l.id}" style="${pos}background:${l.fill};color:${l.color};font-size:${l.size}cqw;font-weight:${l.weight}">${esc(l.text)}</div>`;
      return `<div class="${cls} hl-text" data-id="${l.id}" style="${pos}font-size:${l.size}cqw;font-weight:${l.weight};color:${l.color};letter-spacing:${l.track || 0}em;text-align:${l.align || 'left'}">${esc(l.text)}</div>`;
    }).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
  /* the checks a layout can be measured against here (a stand-in for the Studio's own measurement) */
  function checks(lay) {
    const out = []; const story = lay.format === '9:16';
    const words = lay.layers.filter(l => !l.hidden && (l.type === 'text' || l.type === 'cta'));
    const logo = lay.layers.find(l => l.type === 'logo');
    const off = words.filter(l => l.x < 0 || l.y < 0 || l.x + l.w > 100 || l.y + l.h > 100);
    out.push({ id: 'stage', label: 'Inside the stage', ok: !off.length, detail: off.length ? off.map(l => l.role).join(', ') + ' runs off the stage' : 'every word is on the stage' });
    if (story) { const bad = words.filter(l => l.y < 14 || l.y + l.h > 80); out.push({ id: 'R6', label: 'Story safe area', ok: !bad.length, detail: bad.length ? bad.map(l => l.role).join(', ') + ' sits under the story interface' : 'words clear of the top 14% and bottom 20%' }); }
    if (logo) { const br = logo.x + logo.w >= 85 && logo.y + logo.h >= (story ? 75 : 85); out.push({ id: 'R3', label: 'Logo bottom right', ok: br, detail: br ? 'held bottom right by the campaign rule' : 'the campaign rule holds the logo bottom right' }); }
    const hit = []; for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) { const a = words[i], b = words[j]; const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); if (ox > 0.5 && oy > 0.5) hit.push(a.role + ' / ' + b.role); }
    out.push({ id: 'overlap', label: 'Words clear of each other', ok: !hit.length, detail: hit.length ? hit.join(', ') + ' overlap' : 'no words overlap' });
    const all = words.map(l => l.text).join(' ');
    out.push({ id: 'R1', label: 'Wharf named', ok: /Pier 2|Wharf/.test(all), detail: /Pier 2|Wharf/.test(all) ? 'Pier 2 / Northbridge Wharf on the tile' : 'no wharf named' });
    out.push({ id: 'R5', label: 'No banned terms', ok: !/\bcheap\b/i.test(all), detail: /\bcheap\b/i.test(all) ? '"cheap": say "good value"' : 'clean' });
    out.push({ id: 'R4', label: 'Approved facts only', ok: !/\b99\b|twenty/i.test(all), detail: /\b99\b|twenty/i.test(all) ? 'a figure that is not approved' : 'only announced times' });
    const h = lay.layers.find(l => l.id === 'headline'); if (h) { const len = (h.text || '').length; const lines = Math.max(1, Math.floor((h.h * RATIO[lay.format]) / (h.size * 1.12))); const fits = len * h.size * 0.5 <= h.w * lines;   /* h is per cent of the height, size per cent of the width */ out.push({ id: 'fit', label: 'Headline fits its box', ok: fits, detail: fits ? 'fits at ' + h.size.toFixed(1) + ' (cqw)' : 'too long for the box at this size' }); }
    return out;
  }
  window.HL = { client, project, requirements, copy, references, directions, layout, renderTile, checks, harbour, logoSvg, esc, RATIO };
})();
