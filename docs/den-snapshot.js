/* Anne's Den: the coverage report (24 November 2026; page den-snapshot.js?v=r1, den-snapshot.css?v=r1; no worker change).
 * A one-page media monitoring report in the manner of a monitoring service's daily coverage report: headline figures with
 * the change against the window before, mentions over the window by channel, share of voice by the desk's issues, the
 * channel mix, the outlets that carried the most, tone where it was rated, the top stories, the most engaged posts, the
 * public voices, the narratives in play and the dates coming up. Every figure is a count over what /den/board already
 * answers for the desk (the same read the Board makes), so it needs no new route, makes no model call and spends nothing.
 * The rules it keeps: nobody is named but a registered public actor or an MP on their own post (the board already applies
 * D1, and blanks names for a guest); only an http(s) address is a link; every text is escaped; a channel is listed only
 * when it delivered in the window; a failed read says so with Try again, never an empty report.
 * The report is one self-contained HTML document (inline styles and SVG, no script, no outside request): the preview in
 * the Den is that document in a sandboxed frame, so what is seen, what is downloaded and what is printed to PDF are the
 * same bytes. window.DenSnapshot = { model(board, prev), build(model), open({desk, to, opener}) }. */
(function () {
  'use strict';
  const S = window.DenSnapshot = window.DenSnapshot || {};
  const TZ = 'Australia/Sydney';
  const H = 3600000;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const web = u => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');
  const nf = new Intl.NumberFormat('en-AU');
  const num = n => nf.format(Math.round(Number(n) || 0));
  const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; };
  const fmt = o => new Intl.DateTimeFormat('en-AU', Object.assign({ timeZone: TZ }, o));
  const fTime = fmt({ hour: 'numeric', minute: '2-digit', hour12: true }), fHour = fmt({ hour: 'numeric', hour12: true });
  const fDay = fmt({ weekday: 'short', day: 'numeric', month: 'short' }), fLong = fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const fStamp = fmt({ day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
  const tm = ts => (ts ? fTime.format(new Date(+ts)).replace(/\s/g, ' ').toLowerCase() : '');
  const stamp = ts => (ts ? fStamp.format(new Date(+ts)).replace(/ (am|pm)$/i, (m, x) => ' ' + x.toLowerCase()) : '');

  /* channels in a fixed order, so a colour always means the same channel (the dataviz palette, validated for contrast) */
  const CH = [['news', 'News'], ['x', 'X'], ['facebook', 'Facebook'], ['instagram', 'Instagram'], ['youtube', 'YouTube'], ['reddit', 'Reddit'], ['bluesky', 'Bluesky']];
  const CH_NAME = { news: 'News', x: 'X', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube', reddit: 'Reddit', bluesky: 'Bluesky', mastodon: 'Mastodon', substack: 'Substack', petitions: 'Petitions', forum: 'Forums', linkedin: 'LinkedIn', tiktok: 'TikTok', threads: 'Threads', lemmy: 'Lemmy', hn: 'Hacker News', web: 'Web comments', meta: 'Facebook / Instagram' };
  const COL = ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#008300', '#6250D6']; const OTHER = '#8A94A6';
  const chIdx = c => CH.findIndex(x => x[0] === c);
  const chCol = c => { const i = chIdx(c); return i >= 0 ? COL[i] : OTHER; };
  const chName = c => CH_NAME[c] || (c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Other');
  const ROLE = { org: 'Organisation', official: 'Official', media: 'Media', mp: 'MP' };
  const SIDE = { hostile: 'Hostile to the client', supportive: 'Supportive', mixed: 'Mixed', unknown: 'Not yet judged' };
  const STATUS = { new: 'New', emerging: 'Emerging', growing: 'Growing', steady: 'Steady', fading: 'Fading' };

  const fbTotal = fb => (fb ? (Number(fb.reactions) || 0) + (Number(fb.comments) || 0) + (Number(fb.shares) || 0) : 0);
  const engOf = p => { const e = p.eng || {}; return ['likes', 'replies', 'reposts', 'quotes', 'comments', 'shares', 'views'].some(k => e[k] != null); };

  /* ---- the figures: pure, from one board answer (and the window before, when it was read) ---- */
  S.model = function (b, prev) {
    b = b || {}; const desk = b.desk || {}; const win = b.window || {}; const media = b.media || [], social = b.social || [], actors = b.actors || [];
    const posts = social.concat(actors); const from = Number(win.from) || 0, to = Number(win.to) || Date.now(); const hours = Number(win.hours) || Math.round((to - from) / H) || 24;
    const figures = bb => { bb = bb || {}; const m = bb.media || [], p = (bb.social || []).concat(bb.actors || []); const outs = new Set();
      m.forEach(x => (x.outlets && x.outlets.length ? x.outlets : [x.outlet]).forEach(o => { if (o) outs.add(String(o).toLowerCase()); }));
      const withEng = p.filter(engOf);
      return { mentions: (bb.counts && bb.counts.rows) || m.reduce((a, x) => a + ((x.copies && x.copies.length) || 1), 0) + p.length, stories: m.length, outlets: outs.size,
        posts: p.length, interactions: withEng.reduce((a, x) => a + (Number(x.total) || 0), 0), engRead: withEng.length, fb: m.reduce((a, x) => a + fbTotal(x.fb), 0),
        voices: new Set((bb.actors || []).map(a => String(a.who || '').toLowerCase()).filter(Boolean)).size }; };
    const now = figures(b), before = prev ? figures(prev) : null;
    // mentions over the window: hourly for a day or two, daily beyond; each story once at its first sight, each post once
    const size = hours <= 48 ? H : 24 * H; const nb = Math.max(1, Math.min(60, Math.ceil((to - from) / size)));
    const chans = []; const add = c => { if (chans.indexOf(c) < 0) chans.push(c); };
    const items = media.map(x => ({ ch: 'news', ts: x.ts, issues: x.issues || [] })).concat(posts.map(x => ({ ch: x.platform || 'other', ts: x.ts, issues: x.issues || [] })));
    items.forEach(i => add(i.ch)); chans.sort((a, c) => ((chIdx(a) < 0 ? 99 : chIdx(a)) - (chIdx(c) < 0 ? 99 : chIdx(c))) || a.localeCompare(c));
    const buckets = Array.from({ length: nb }, (_, i) => ({ at: from + i * size, n: {} }));
    items.forEach(i => { const k = Math.min(nb - 1, Math.max(0, Math.floor(((Number(i.ts) || to) - from) / size))); buckets[k].n[i.ch] = (buckets[k].n[i.ch] || 0) + 1; });
    // share of voice by the desk's own issues: a story or post counts for each issue it carries
    const total = items.length; const issues = (desk.issues || []).map(is => { const n = items.filter(i => i.issues.indexOf(is.id) >= 0).length; return { id: is.id, label: is.label || is.id, n, share: total ? n / total : 0 }; });
    const sov = issues.filter(i => i.n > 0).sort((a, c) => c.n - a.n), quiet = issues.filter(i => !i.n).map(i => i.label);
    // the channel mix as the window holds it (every syndicated copy counted), only channels that delivered
    const by = b.byChannel || {}; const mix = Object.keys(by).filter(k => by[k] > 0).map(k => ({ ch: k, n: by[k] })).sort((a, c) => ((chIdx(a.ch) < 0 ? 99 : chIdx(a.ch)) - (chIdx(c.ch) < 0 ? 99 : chIdx(c.ch))));
    // the outlets that carried the most stories (each story once a masthead)
    const oc = new Map(); media.forEach(x => (x.outlets && x.outlets.length ? x.outlets : [x.outlet]).filter(Boolean).forEach(o => { const k = String(o).toLowerCase(); const e = oc.get(k) || { name: o, n: 0 }; e.n++; oc.set(k, e); }));
    const outlets = Array.from(oc.values()).filter(o => !/^an outlet found/i.test(o.name)).sort((a, c) => c.n - a.n || a.name.localeCompare(c.name)).slice(0, 8);
    // tone, only where it was rated: a story's own tone, and a post's comments when three or more carried one
    const band = t => (t <= -0.15 ? 'neg' : t >= 0.15 ? 'pos' : 'neu');
    const tone = { stories: { neg: 0, neu: 0, pos: 0, rated: 0, of: media.length }, posts: { neg: 0, neu: 0, pos: 0, rated: 0, of: posts.length } };
    media.forEach(x => { if (typeof x.tone === 'number' && isFinite(x.tone)) { tone.stories[band(x.tone)]++; tone.stories.rated++; } });
    posts.forEach(x => { const t = x.held && x.held.tone; if (typeof t === 'number' && isFinite(t)) { tone.posts[band(t)]++; tone.posts.rated++; } });
    const top = media.slice(0, 10);
    const engaged = posts.filter(engOf).slice().sort((a, c) => (Number(c.total) || 0) - (Number(a.total) || 0) || (c.ts - a.ts)).slice(0, 8);
    const vm = new Map(); actors.forEach(a => { const k = String(a.who || '').toLowerCase(); if (!k) return; const e = vm.get(k) || { who: a.who, role: a.role, party: a.party, posts: 0, interactions: 0, platforms: new Set() }; e.posts++; e.interactions += engOf(a) ? Number(a.total) || 0 : 0; e.platforms.add(a.platform); vm.set(k, e); });
    const voices = Array.from(vm.values()).sort((a, c) => c.posts - a.posts || c.interactions - a.interactions).slice(0, 10);
    const narratives = (b.narratives || []).slice().sort((a, c) => (c.n24 || 0) - (a.n24 || 0) || (c.n || 0) - (a.n || 0)).slice(0, 8);
    const upcoming = (b.upcoming || []).slice().sort((a, c) => String(a.date).localeCompare(String(c.date))).slice(0, 8);
    return { desk, win: { from, to, hours, label: win.label || '' }, now, before, buckets, size, chans, sov, quiet, mix, outlets, tone, top, engaged, voices, narratives, upcoming, capped: !!b.capped, total };
  };

  /* ---- the document ---- */
  const CSS = [
    '*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    'body{margin:0;background:#F3F5F8;color:#101828;font:14px/1.5 "DM Sans","Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}',
    '.pg{max-width:1080px;margin:0 auto;padding:28px 28px 40px}',
    'a{color:#1D4ED8;text-decoration:none}a:hover{text-decoration:underline}',
    '.hd{background:#0E1B2C;color:#fff;border-radius:14px;padding:26px 28px 22px;display:flex;gap:24px;align-items:flex-end;justify-content:space-between;flex-wrap:wrap}',
    '.eyebrow{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#9DB2CF;font-weight:600;margin:0 0 6px}',
    'h1{font-size:26px;line-height:1.2;margin:0;font-weight:700;letter-spacing:-.01em}',
    '.hd .sub{margin:6px 0 0;color:#C9D6E8;font-size:14px}.hd .meta{text-align:right;color:#9DB2CF;font-size:12px;line-height:1.6}.hd .meta b{color:#fff;font-weight:600}',
    '.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin:16px 0}',
    '.kpi{background:#fff;border:1px solid #E3E8EF;border-radius:12px;padding:14px 16px 12px;min-width:0}',
    '.kpi .k{font-size:12px;color:#475467;font-weight:600;margin:0}.kpi .v{font-size:28px;font-weight:700;line-height:1.15;margin:6px 0 2px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}',
    '.kpi .d{font-size:12px;color:#475467;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kpis .note{grid-column:1/-1;margin:-4px 2px 0;font-size:12px;color:#667085}.up{color:#0B6E4F;font-weight:600}.dn{color:#B42318;font-weight:600}.eq{color:#475467;font-weight:600}',
    '.card{background:#fff;border:1px solid #E3E8EF;border-radius:12px;padding:18px 20px;margin:0 0 16px;break-inside:avoid}',
    '.card h2{font-size:15px;margin:0;font-weight:700}.card .lede{margin:2px 0 12px;color:#475467;font-size:12.5px}',
    '.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}.two .card{margin:0 0 16px}',
    '.legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin:8px 0 0;padding:0;list-style:none;font-size:12px;color:#344054}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}',
    '.bars{margin:0;padding:0;list-style:none}.bars li{display:grid;grid-template-columns:minmax(0,38%) minmax(0,1fr) 56px;gap:10px;align-items:center;padding:5px 0;font-size:13px}',
    '.bars .l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#101828}.bars .t{height:10px;background:#EEF1F5;border-radius:6px;overflow:hidden}.bars .t i{display:block;height:100%;border-radius:6px}',
    '.bars .n{text-align:right;font-variant-numeric:tabular-nums;color:#344054;font-weight:600}.bars .n small{display:block;font-weight:400;color:#667085;font-size:11px}',
    '.quiet{color:#667085;font-size:12px;margin:10px 0 0}',
    '.tone{display:flex;height:14px;border-radius:7px;overflow:hidden;background:#EEF1F5;margin:6px 0 4px}.tone i{display:block;height:100%}',
    '.tk{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:#344054;margin:0 0 12px}.tk b{font-variant-numeric:tabular-nums}',
    'table{width:100%;border-collapse:collapse;font-size:13px}th{text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#667085;font-weight:600;padding:8px 10px;border-bottom:1px solid #E3E8EF;white-space:nowrap}',
    'th.num{text-align:right}.tw{overflow-x:auto;-webkit-overflow-scrolling:touch}',
    'td{padding:10px;border-bottom:1px solid #EEF1F5;vertical-align:top}tr:last-child td{border-bottom:0}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}td.when{white-space:nowrap;color:#475467}',
    '.ttl{font-weight:600;color:#101828;display:block}.ttl a{color:#101828}.ttl a:hover{color:#1D4ED8}.sum{color:#475467;font-size:12.5px;margin:2px 0 0}',
    '.rk{width:28px;color:#98A2B3;font-variant-numeric:tabular-nums;font-weight:600}',
    '.chip{display:inline-block;font-size:11px;line-height:18px;padding:0 8px;border-radius:9px;background:#EEF4FF;color:#1D3F8F;margin:4px 4px 0 0;white-space:nowrap}',
    '.pf{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.pf i{width:8px;height:8px;border-radius:50%;display:inline-block}',
    '.st{display:inline-block;font-size:11px;font-weight:600;padding:0 8px;line-height:18px;border-radius:9px;background:#F2F4F7;color:#344054}.st.emerging,.st.growing{background:#FFF4E5;color:#93370D}.st.hostile{background:#FEE4E2;color:#912018}.st.supportive{background:#DCFAE6;color:#085D3A}',
    '.ft{color:#667085;font-size:12px;line-height:1.6;margin:18px 4px 0}.ft p{margin:0 0 6px}',
    'svg text{font-family:inherit}',
    '@media (max-width:900px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.two{grid-template-columns:minmax(0,1fr)}.hd .meta{text-align:left}}',
    '@media (max-width:520px){.pg{padding:16px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:22px}.bars li{grid-template-columns:minmax(0,42%) minmax(0,1fr) 48px}th.hm,td.hm{display:none}.card{padding:14px}td,th{padding:8px 6px}.hd .meta{font-size:11px}}',
    '@media print{@page{size:A4;margin:12mm}body{background:#fff;font-size:12px}.pg{padding:0;max-width:none}.card,.kpi{border-color:#D0D5DD}.hd{border-radius:10px}a{color:#101828}.kpis{grid-template-columns:repeat(6,minmax(0,1fr))}.two{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}tr{break-inside:avoid}}'
  ].join('\n');

  // the change against the window before, short enough for a tile: "\u25b2 25% vs 8", "no change vs 8", "new, none before"
  const delta = (a, b) => { if (b == null) return ''; if (!b && !a) return '<span class="eq">none</span> in either window';
    if (!b) return '<span class="up">new</span>, none before'; const p = Math.round((a - b) / b * 100);
    return (p === 0 ? '<span class="eq">no change</span>' : '<span class="' + (p > 0 ? 'up' : 'dn') + '">' + (p > 0 ? '\u25b2 ' : '\u25bc ') + Math.abs(p) + '%</span>') + ' vs ' + num(b); };

  function volume(m) {
    const W = 1000, Hh = 230, L = 40, R = 8, T = 12, B = 34; const iw = W - L - R, ih = Hh - T - B; const n = m.buckets.length;
    const tot = m.buckets.map(bk => Object.keys(bk.n).reduce((a, k) => a + bk.n[k], 0)); const max = Math.max(1, ...tot);
    const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10; const top = Math.ceil(max / step) * step;
    const bw = iw / n, gap = Math.min(6, bw * 0.25); let g = '';
    for (let v = 0; v <= top; v += step) { const y = T + ih - v / top * ih; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#EEF1F5"/><text x="' + (L - 8) + '" y="' + (y + 4).toFixed(1) + '" font-size="11" fill="#667085" text-anchor="end">' + v + '</text>'; }
    const every = n <= 8 ? 1 : n <= 16 ? 2 : n <= 30 ? 4 : 6;
    m.buckets.forEach((bk, i) => { let y = T + ih; const x = L + i * bw + gap / 2; const w = Math.max(1, bw - gap);
      m.chans.forEach(c => { const v = bk.n[c] || 0; if (!v) return; const h = v / top * ih; y -= h; g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" fill="' + chCol(c) + '"><title>' + esc(chName(c) + ': ' + v) + '</title></rect>'; });
      if (i % every === 0) g += '<text x="' + (x + w / 2).toFixed(1) + '" y="' + (Hh - 12) + '" font-size="11" fill="#667085" text-anchor="middle">' + esc(m.size === H ? fHour.format(new Date(bk.at)).replace(/\s/g, '').toLowerCase() : fDay.format(new Date(bk.at))) + '</text>'; });
    const words = m.buckets.map((bk, i) => tot[i] ? (m.size === H ? fHour.format(new Date(bk.at)) : fDay.format(new Date(bk.at))) + ' ' + tot[i] : '').filter(Boolean).join(', ');
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="100%" role="img" aria-label="' + esc('Stories and posts by ' + (m.size === H ? 'hour' : 'day') + ': ' + (words || 'none')) + '">' + g + '</svg>' +
      '<ul class="legend">' + m.chans.map(c => '<li><i style="background:' + chCol(c) + '"></i>' + esc(chName(c)) + '</li>').join('') + '</ul>';
  }
  const bars = (rows, col) => { const max = Math.max(1, ...rows.map(r => r.n)); return '<ul class="bars">' + rows.map(r => '<li><span class="l" title="' + esc(r.label) + '">' + esc(r.label) + '</span><span class="t"><i style="width:' + Math.max(2, Math.round(r.n / max * 100)) + '%;background:' + (r.col || col) + '"></i></span><span class="n">' + num(r.n) + (r.sub ? '<small>' + esc(r.sub) + '</small>' : '') + '</span></li>').join('') + '</ul>'; };
  const toneBar = (t, label) => { const r = t.rated; if (!r) return ''; const pc = k => (t[k] / r * 100).toFixed(1);
    return '<p class="k" style="margin:10px 0 0;font-size:12px;color:#344054;font-weight:600">' + esc(label) + ' <span style="font-weight:400;color:#667085">(' + num(r) + ' of ' + num(t.of) + ' rated)</span></p>' +
      '<div class="tone" role="img" aria-label="' + esc(label + ': ' + t.neg + ' negative, ' + t.neu + ' neutral, ' + t.pos + ' positive') + '"><i style="width:' + pc('neg') + '%;background:#D92D20"></i><i style="width:' + pc('neu') + '%;background:#98A2B3"></i><i style="width:' + pc('pos') + '%;background:#079455"></i></div>' +
      '<div class="tk"><span><b>' + t.neg + '</b> negative</span><span><b>' + t.neu + '</b> neutral</span><span><b>' + t.pos + '</b> positive</span></div>'; };
  const link = (u, text) => { const h = web(u); return h ? '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + text + '</a>' : text; };
  const issueName = (m, id) => ((m.desk.issues || []).find(i => i.id === id) || {}).label || id;

  S.build = function (m, opt) {
    opt = opt || {}; const d = m.desk || {}; const client = d.client || d.name || 'Coverage'; const N = m.now, P = m.before;
    const period = m.win.hours % 24 === 0 && m.win.hours > 24 ? 'the last ' + (m.win.hours / 24) + ' days' : 'the last ' + m.win.hours + ' hours';
    const kpi = (k, v, dl, note) => '<div class="kpi"><p class="k">' + esc(k) + '</p><p class="v">' + v + '</p><p class="d">' + (dl || esc(note || ' ')) + '</p></div>';
    const prevNote = P ? '' : (opt.prevFailed ? 'the window before could not be read' : '');
    const parts = [];
    parts.push('<header class="hd"><div><p class="eyebrow">Media and social coverage report</p><h1>' + esc(client) + '</h1><p class="sub">' + esc(d.name || '') + ' · ' + esc(period) + ' to ' + esc(tm(m.win.to)) + ', ' + esc(fLong.format(new Date(m.win.to))) + '</p></div>' +
      '<div class="meta">Window <b>' + esc(stamp(m.win.from)) + ' – ' + esc(stamp(m.win.to)) + '</b><br>Australian Eastern time<br>Prepared ' + esc(stamp(opt.at || Date.now())) + '</div></header>');
    parts.push('<section class="kpis" aria-label="Headline figures">' +
      kpi('Mentions', num(N.mentions), P && delta(N.mentions, P.mentions), prevNote || 'every story copy and post') +
      kpi('Stories', num(N.stories), P && delta(N.stories, P.stories), prevNote || 'syndicated copies counted once') +
      kpi('Outlets', num(N.outlets), P && delta(N.outlets, P.outlets), prevNote || 'mastheads that carried a story') +
      kpi('Social posts', num(N.posts), P && delta(N.posts, P.posts), prevNote || 'posts on the desk’s issues') +
      kpi('Interactions', N.engRead ? num(N.interactions) : '–', P && N.engRead ? delta(N.interactions, P.interactions) : '', N.engRead ? 'on ' + N.engRead + ' post' + (N.engRead === 1 ? '' : 's') + ' with counts' : 'no counts were read') +
      kpi('Public voices', num(N.voices), P && delta(N.voices, P.voices), prevNote || 'organisations, officials and MPs') +
      (P ? '<p class="note">Changes compare with the ' + esc(m.win.hours) + ' hours before, ' + esc(stamp(m.win.from - m.win.hours * H)) + ' \u2013 ' + esc(stamp(m.win.from)) + '.</p>' : '') + '</section>');
    if (m.total) parts.push('<section class="card"><h2>Mentions over the window</h2><p class="lede">Stories and posts by ' + (m.size === H ? 'hour' : 'day') + ', each story counted once when first seen.</p>' + volume(m) + '</section>');
    const sov = m.sov.length ? bars(m.sov.map((r, i) => ({ label: r.label, n: r.n, sub: Math.round(r.share * 100) + '%', col: COL[i % COL.length] }))) + (m.quiet.length ? '<p class="quiet">Nothing in this window on ' + esc(m.quiet.join(', ')) + '.</p>' : '') : '<p class="quiet">No story or post in this window carried one of the desk’s issues.</p>';
    const mix = m.mix.length ? bars(m.mix.map(r => ({ label: chName(r.ch), n: r.n, col: chCol(r.ch) }))) : '<p class="quiet">Nothing was collected in this window.</p>';
    parts.push('<div class="two"><section class="card"><h2>Share of voice by issue</h2><p class="lede">Stories and posts that carry each of the desk’s issues.</p>' + sov + '</section>' +
      '<section class="card"><h2>Channel mix</h2><p class="lede">Every story copy and post collected, by channel.</p>' + mix + '</section></div>');
    const outl = m.outlets.length ? bars(m.outlets.map(o => ({ label: o.name, n: o.n })), '#2A78D6') : '<p class="quiet">No outlet carried a story in this window.</p>';
    const tn = toneBar(m.tone.stories, 'Stories') + toneBar(m.tone.posts, 'Comments under posts');
    parts.push('<div class="two"><section class="card"><h2>Top outlets</h2><p class="lede">Stories each masthead carried.</p>' + outl + '</section>' +
      '<section class="card"><h2>Tone</h2><p class="lede">Only where it was rated; a post’s comments are rated when three or more carry a tone.</p>' + (tn || '<p class="quiet">Tone was not rated for this window’s stories or comments.</p>') + '</section></div>');
    if (m.top.length) parts.push('<section class="card"><h2>Top stories</h2><p class="lede">In the order the desk ranks them: relevance to its issues first, then reach.</p><div class=\"tw\"><table><thead><tr><th class="rk">#</th><th>Story</th><th>Outlet</th><th class="hm">Carried by</th><th class="hm">Facebook</th><th>Published</th></tr></thead><tbody>' +
      m.top.map((s, i) => '<tr><td class="rk">' + (i + 1) + '</td><td><span class="ttl">' + link(s.url, esc(cut(s.title, 160))) + '</span>' + (s.summary ? '<p class="sum">' + esc(cut(s.summary, 180)) + '</p>' : '') + (s.issues || []).slice(0, 3).map(id => '<span class="chip">' + esc(issueName(m, id)) + '</span>').join('') + '</td>' +
        '<td>' + esc(s.outlet || '') + '</td><td class="num hm">' + (s.n > 1 ? num(s.n) + ' outlets' : '1 outlet') + '</td><td class="num hm">' + (s.fb ? num(fbTotal(s.fb)) : '–') + '</td><td class="when">' + esc(stamp(s.ts)) + '</td></tr>').join('') + '</tbody></table></div></section>');
    if (m.engaged.length) parts.push('<section class="card"><h2>Most engaged posts</h2><p class="lede">Interactions as the platform gave them when the post was read.</p><div class=\"tw\"><table><thead><tr><th class="rk">#</th><th>Post</th><th>Channel</th><th class="num">Interactions</th><th class="hm">Since yesterday</th><th>Posted</th></tr></thead><tbody>' +
      m.engaged.map((p, i) => { const e = p.eng || {}; const det = [['likes', 'likes'], ['replies', 'replies'], ['reposts', 'reposts'], ['comments', 'comments'], ['shares', 'shares']].filter(k => e[k[0]] != null).map(k => num(e[k[0]]) + ' ' + k[1]).join(', ');
        return '<tr><td class="rk">' + (i + 1) + '</td><td><span class="ttl">' + link(p.url, esc(cut(p.text, 170) || chName(p.platform) + ' post')) + '</span>' + (p.who ? '<p class="sum">' + esc(p.who) + (ROLE[p.role] ? ' · ' + ROLE[p.role] : '') + (p.party ? ' · ' + esc(p.party) : '') + '</p>' : '') + (det ? '<p class="sum">' + esc(det) + '</p>' : '') + '</td>' +
          '<td><span class="pf"><i style="background:' + chCol(p.platform) + '"></i>' + esc(chName(p.platform)) + '</span></td><td class="num"><b>' + num(p.total) + '</b></td><td class="num hm">' + (p.growth == null ? '–' : (p.growth > 0 ? '+' : '') + num(p.growth)) + '</td><td class="when">' + esc(stamp(p.ts)) + '</td></tr>'; }).join('') + '</tbody></table></div></section>');
    if (m.voices.length) parts.push('<section class="card"><h2>Public voices</h2><p class="lede">Registered organisations, officials and MPs posting on their own channels.</p><div class=\"tw\"><table><thead><tr><th>Who</th><th>Kind</th><th class="num">Posts</th><th class="num">Interactions</th><th class="hm">Channels</th></tr></thead><tbody>' +
      m.voices.map(v => '<tr><td><span class="ttl">' + esc(v.who) + '</span></td><td>' + esc((ROLE[v.role] || 'Public actor') + (v.party ? ' · ' + v.party : '')) + '</td><td class="num">' + num(v.posts) + '</td><td class="num">' + (v.interactions ? num(v.interactions) : '–') + '</td><td class="hm">' + esc(Array.from(v.platforms).map(chName).join(', ')) + '</td></tr>').join('') + '</tbody></table></div></section>');
    if (m.narratives.length) parts.push('<section class="card"><h2>Narratives in play</h2><p class="lede">Stories the conversation keeps telling on the desk’s issues, counted across channels.</p><div class=\"tw\"><table><thead><tr><th>Narrative</th><th class="num">Last 24h</th><th class="num hm">In all</th><th>Status</th><th class="hm">Stance</th></tr></thead><tbody>' +
      m.narratives.map(n => '<tr><td><span class="ttl">' + esc(cut(n.label, 140)) + '</span>' + (n.claim ? '<p class="sum">' + esc(cut(n.claim, 180)) + '</p>' : '') + '</td><td class="num">' + num(n.n24) + '</td><td class="num hm">' + num(n.n) + '</td><td><span class="st ' + esc(n.status) + '">' + esc(STATUS[n.status] || n.status || '–') + '</span></td><td class="hm">' + (n.side ? '<span class="st ' + esc(n.side) + '">' + esc(SIDE[n.side] || n.side) + '</span>' : '–') + '</td></tr>').join('') + '</tbody></table></div></section>');
    if (m.upcoming.length) parts.push('<section class="card"><h2>Coming up</h2><p class="lede">Dates written in the window’s stories and posts, and dates recorded from a parliament’s own pages.</p><div class=\"tw\"><table><thead><tr><th>Date</th><th>What</th></tr></thead><tbody>' +
      m.upcoming.map(u => { const dt = /^\d{4}-\d\d-\d\d$/.test(String(u.date)) ? fDay.format(new Date(u.date + 'T12:00:00+10:00')) : String(u.date || ''); return '<tr><td class="when"><b>' + esc(dt) + '</b>' + (u.recurring ? '<p class="sum">recurring</p>' : '') + '</td><td>' + link(u.url, esc(cut(u.what || u.event || '', 220))) + '</td></tr>'; }).join('') + '</tbody></table></div></section>');
    if (!m.total) parts.push('<section class="card"><h2>Nothing in this window yet</h2><p class="lede">No story or post on the desk’s issues was collected between ' + esc(stamp(m.win.from)) + ' and ' + esc(stamp(m.win.to)) + '.</p></section>');
    const read = m.mix.map(r => chName(r.ch) + ' (' + num(r.n) + ')').join(', ');
    parts.push('<footer class="ft"><p><b>How this was counted.</b> Every figure is a count of the stories and posts collected for ' + esc(d.name || client) + ' in this window, on the desk’s issues and its watched accounts, after anything set aside or muted. Syndicated copies of one story count as one story; Mentions counts every copy. Interactions are the counts each platform gave when the post was read. No AI was used to make this page.</p>' +
      (read ? '<p>Channels in this report: ' + esc(read) + '.</p>' : '') + (m.capped ? '<p>The window held more than the desk reads at once, so these figures are for its newest rows.</p>' : '') + '<p>Prepared with AXIOM.</p></footer>');
    return '<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(client + ' - coverage report - ' + fLong.format(new Date(m.win.to))) + '</title><style>' + CSS + '</style></head><body><main class="pg">' + parts.join('') + '</main></body></html>';
  };

  /* ---- the dialog in the Den: loading, error with Try again, the report in a sandboxed frame, Download and Print ---- */
  const call = p => window.AXUI.call(p);
  const qs = o => Object.keys(o).filter(k => o[k] != null && o[k] !== '').map(k => encodeURIComponent(k) + '=' + encodeURIComponent(o[k])).join('&');
  const say = e => { const m = String((e && (e.detail || e.message)) || e || ''); return !m || /Failed to fetch|NetworkError|Load failed/i.test(m) ? 'The connection to AXIOM dropped before an answer came back.' : m; };
  let live = null;
  S.close = function () { if (live) live.close(); };
  S.open = function (o) {
    o = o || {}; const desk = o.desk || {}; if (!desk.id) return; if (live) live.close();
    const root = document.getElementById('den-root') || document.body; const back = o.opener || document.activeElement;
    const box = document.createElement('div'); box.id = 'den-snap'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'den-snap-h');
    box.innerHTML = '<div class="dsn-panel"><div class="dsn-bar"><div class="dsn-title"><h2 id="den-snap-h" tabindex="-1">Coverage report</h2><span class="dsn-sub"></span></div><span class="dsn-sp"></span>' +
      '<button type="button" class="dsn-btn" data-a="print" disabled>Print or save as PDF</button><button type="button" class="dsn-btn" data-a="download" disabled>Download .html</button><button type="button" class="dsn-btn dsn-x" data-a="close" aria-label="Close the coverage report">Close</button></div>' +
      '<div class="dsn-body"><div class="dsn-state" role="status" aria-live="polite"></div></div></div>';
    root.appendChild(box); document.documentElement.classList.add('dsn-open');
    const $ = s => box.querySelector(s); const state = $('.dsn-state'); const body = $('.dsn-body'); $('.dsn-sub').textContent = desk.name || '';
    let doc = '', closed = false, frame = null;
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Tab') { const f = Array.from(box.querySelectorAll('button:not([disabled]), iframe, [tabindex="-1"]')).filter(x => x.offsetParent !== null || x.tagName === 'IFRAME'); if (!f.length) return; const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } } };
    function close() { if (closed) return; closed = true; document.removeEventListener('keydown', onKey, true); box.remove(); document.documentElement.classList.remove('dsn-open'); live = null; try { if (back && back.isConnected) back.focus(); } catch (e) {} }
    live = { close };
    document.addEventListener('keydown', onKey, true);
    box.addEventListener('mousedown', e => { if (e.target === box) close(); });
    $('[data-a="close"]').addEventListener('click', close);
    $('[data-a="download"]').addEventListener('click', () => { if (!doc) return; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = 'coverage-' + desk.id + '-' + new Date(o.at || Date.now()).toISOString().slice(0, 10) + '.html'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); });
    $('[data-a="print"]').addEventListener('click', () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { state.textContent = 'This browser would not print the frame. Download the .html and print it from there.'; } });
    const load = async () => {
      state.innerHTML = '<p class="dsn-wait"><span class="dsn-spin" aria-hidden="true"></span>Counting this window’s stories and posts…</p>'; state.hidden = false; if (frame) { frame.remove(); frame = null; }
      $('[data-a="print"]').disabled = true; $('[data-a="download"]').disabled = true;
      let b; try { b = await call('/den/board?' + qs({ desk: desk.id, to: o.to || '' })); if (!b || b.ok !== true || !Array.isArray(b.media) || !b.window) { const e = new Error('AXIOM sent something this page can’t read. Nothing was changed.'); throw e; } }
      catch (e) { if (closed) return; state.innerHTML = '<div class="dsn-err"><p><b>The coverage report could not be made.</b></p><p class="dsn-why"></p><button type="button" class="dsn-btn primary" data-a="retry">Try again</button></div>'; state.querySelector('.dsn-why').textContent = say(e); state.querySelector('[data-a="retry"]').addEventListener('click', load); state.querySelector('[data-a="retry"]').focus(); return; }
      if (closed) return;
      // the window before, of the same length, for the changes; its failure costs the comparison only, and says so
      let prev = null, prevFailed = false; const h = Number(b.window.hours) || 24;
      try { const p = await call('/den/board?' + qs({ desk: desk.id, to: b.window.from, hours: h })); if (p && p.ok === true && Array.isArray(p.media)) prev = p; else prevFailed = true; } catch (e) { prevFailed = true; }
      if (closed) return;
      doc = S.build(S.model(b, prev), { prevFailed, at: Date.now() });
      frame = document.createElement('iframe'); frame.className = 'dsn-frame'; frame.title = 'Coverage report for ' + (desk.name || 'this desk');
      frame.setAttribute('sandbox', 'allow-same-origin allow-modals allow-popups allow-popups-to-escape-sandbox'); frame.srcdoc = doc;
      frame.addEventListener('load', () => { try { frame.contentDocument.addEventListener('keydown', onKey, true); } catch (e) {} });
      state.hidden = true; body.appendChild(frame);
      $('[data-a="print"]').disabled = false; $('[data-a="download"]').disabled = false;
      const live2 = document.querySelector('[data-dt-live="polite"]'); if (live2) live2.textContent = 'The coverage report is ready.';
    };
    setTimeout(() => { const h = $('#den-snap-h'); if (h) h.focus(); }, 0);
    load();
  };
})();
