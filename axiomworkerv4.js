/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  AXIOM v4 — CLOUDFLARE WORKER                                           ║
 * ║  Deploy: wrangler deploy                                                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  wrangler.toml:                                                         ║
 * ║    name = "axiom-proxy"                                                 ║
 * ║    main = "axiom-worker-v3.js"                                          ║
 * ║    compatibility_date = "2024-01-01"                                    ║
 * ║    [vars]                                                               ║
 * ║    GUARDIAN_KEY = "your_guardian_api_key"                               ║
 * ║    [[kv_namespaces]]                                                    ║
 * ║    binding = "AXIOM_KV"                                                 ║
 * ║    id = "your_kv_namespace_id"                                          ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  EXISTING ROUTES (v2 — unchanged):                                      ║
 * ║  GET /reddit?q=&sr=           Reddit search proxy (CORS fix)            ║
 * ║  GET /reddit-comments?p=      Reddit post comments proxy                ║
 * ║  GET /guardian?q=             Guardian AU API                           ║
 * ║  GET /rss?feed=               Single AU feed from AU_FEEDS (KV 10min)    ║
 * ║  GET /allnews?q=&max=         Aggregate 20+ AU news feeds, merged +     ║
 * ║                               keyword-filtered, newest-first (KV 5min)  ║
 * ║  GET /whirlpool?q=            Whirlpool forum scrape                    ║
 * ║  GET /bigfooty?q=             BigFooty AU Politics forum scrape         ║
 * ║  GET /hotcopper?q=            HotCopper Politics board scrape           ║
 * ║  GET /ozpolitic?q=            OzPolitic YaBB forum scrape               ║
 * ║  GET /ozpolitic-rss           OzPolitic RSS recent posts                ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  NEW ROUTES (v3):                                                       ║
 * ║  GET /forum?url=&q=&engine=   Universal forum scraper — auto-detects    ║
 * ║                               vBulletin, XenForo, phpBB, MyBB, Discourse║
 * ║                               or pass engine= to force a specific one   ║
 * ║                                                                         ║
 * ║  GET /forum-thread?url=&q=    Scrape full thread posts from any forum   ║
 * ║                               engine (vBulletin / XenForo / phpBB etc.) ║
 * ║                                                                         ║
 * ║  GET /forum-detect?url=       Detect forum engine at a URL and return   ║
 * ║                                                                         ║
 * ║  V6 POLITICAL INTELLIGENCE ROUTES (all keyless except /tvfy):           ║
 * ║  GET /trends?geo=AU                Google Trends — trending searches    ║
 * ║  GET /social?tag=auspol            Mastodon #auspol public timelines    ║
 * ║  GET /gdelt?q=&mode=&timespan=     GDELT news volume/tone/articles      ║
 * ║  GET /wiki?article=&days=          Wikipedia pageview attention          ║
 * ║  GET /tvfy?q=                      TheyVoteForYou MP records            ║
 * ║                                    (secret: TVFY_KEY, free)             ║
 * ║                               metadata: engine, version, name, icon     ║
 * ║                                                                         ║
 * ║  Known AU vBulletin forums pre-registered (pass name= param):          ║
 * ║    aus-politics, productreview-politics, priceSpy,                      ║
 * ║    womensweekly, essentialbaby, globaloffensive-au,                     ║
 * ║    auspol-forum, aussiestock, ausforum                                  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

// ══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin':      '*',
  'Access-Control-Allow-Methods':     'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age':           '86400',
  'Content-Type':                     'application/json',
};

// Full CORS headers without Content-Type (for non-JSON responses)
const CORS_ONLY = {
  'Access-Control-Allow-Origin':      '*',
  'Access-Control-Allow-Methods':     'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age':           '86400',
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const MOBILE_UA  = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Standard headers that mimic a real browser — helps avoid 403s on forums
const FORUM_HEADERS = (referer = '') => ({
  'User-Agent':                BROWSER_UA,
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language':           'en-AU,en-GB;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding':           'gzip, deflate, br',
  'Cache-Control':             'no-cache',
  'Pragma':                    'no-cache',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            referer ? 'same-origin' : 'none',
  'Upgrade-Insecure-Requests': '1',
  ...(referer ? { 'Referer': referer } : {}),
});

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

/** Strip HTML tags, decode entities, collapse whitespace */
function stripHtml(s = '') {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Australian news / politics RSS + Atom feed registry.
 * Shared by the /rss (single feed) and /allnews (aggregate) routes.
 * Feeds that 404 or block bots are skipped gracefully by /allnews.
 */
const AU_FEEDS = {
  // ── Public broadcasters ──
  abc:           'https://www.abc.net.au/news/feed/51120/rss.xml',        // ABC Politics
  abc_top:       'https://www.abc.net.au/news/feed/2942460/rss.xml',      // ABC Top Stories
  sbs:           'https://www.sbs.com.au/news/feed',
  // ── Nine mastheads ──
  smh:           'https://www.smh.com.au/rss/feed.xml',
  smh_pol:       'https://www.smh.com.au/rss/politics/federal.xml',
  theage:        'https://www.theage.com.au/rss/feed.xml',
  brisbanetimes: 'https://www.brisbanetimes.com.au/rss/feed.xml',
  watoday:       'https://www.watoday.com.au/rss/feed.xml',
  afr:           'https://www.afr.com/rss/feed.xml',
  // ── Guardian Australia ──
  guardian:      'https://www.theguardian.com/australia-news/rss',
  guardian_pol:  'https://www.theguardian.com/australia-news/australian-politics/rss',
  // ── Independent / analysis ──
  conversation:  'https://theconversation.com/au/articles.atom',
  crikey:        'https://www.crikey.com.au/feed/',
  newdaily:      'https://thenewdaily.com.au/feed/',
  michaelwest:   'https://michaelwest.com.au/feed/',
  independentau: 'https://independentaustralia.net/feed/',
  menadue:       'https://johnmenadue.com/feed/',
  saturdaypaper: 'https://www.thesaturdaypaper.com.au/feed',
  junkee:        'https://junkee.com/feed',
  // ── News Corp / wire ──
  newscomau:     'https://www.news.com.au/content-feeds/latest-news-national/',
  aap:           'https://www.aap.com.au/feed/',
  // ── Regional ──
  canberratimes: 'https://www.canberratimes.com.au/rss.xml',
  indaily:       'https://www.indaily.com.au/feed',
};

/** Parse an RSS/Atom string into [{ title, link, date, desc }] */
function parseFeedXml(xml = '') {
  const blocks = [
    ...xml.matchAll(/<item>([\s\S]*?)<\/item>/g),
    ...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g),
  ];
  return blocks.map(m => {
    const b = m[1];
    const title = stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1] || ''));
    const link  = (b.match(/<link[^>]*href="([^"]+)"/) || b.match(/<link[^>]*>(https?[^<]+)<\/link>/) || [])[1]?.trim();
    const date  = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || b.match(/<published>([\s\S]*?)<\/published>/) || b.match(/<updated>([\s\S]*?)<\/updated>/) || [])[1]?.trim();
    const descRaw = (b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || b.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/) || [])[1] || '';
    return { title, link, date, desc: stripHtml(descRaw).slice(0, 240) };
  }).filter(i => i.title);
}

/** KV helpers with silent fail */
async function kvGet(kv, key) {
  try { return await kv?.get(key); } catch { return null; }
}
async function kvPut(kv, key, val, ttl = 300) {
  try { await kv?.put(key, val, { expirationTtl: ttl }); } catch {}
}

/** Safe fetch that never throws — returns { ok, html, status } */
async function safeFetch(url, opts = {}) {
  try {
    const r = await fetch(url, opts);
    if (!r.ok) return { ok: false, html: '', status: r.status };
    const html = await r.text();
    return { ok: true, html, status: r.status };
  } catch (e) {
    return { ok: false, html: '', status: 0, error: String(e) };
  }
}

/** Deduplicated push helper */
function addThread(arr, seen, text, url, extra = {}) {
  const clean = stripHtml(text).trim();
  if (!clean || clean.length < 5 || seen.has(clean)) return;
  // Skip obvious nav/UI labels
  if (/^(home|forum|thread|post|reply|quote|more|back|top|next|prev|page|\d+|new|hot|sticky|announcements|rules|off.?topic)$/i.test(clean)) return;
  seen.add(clean);
  arr.push({ text: clean, url: url || '', ...extra });
}

/** Relevance filter — returns items matching any query word (len > 2) */
function relevanceFilter(items, q) {
  if (!q || items.length <= 3) return items;
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return items;
  const matched = items.filter(t =>
    words.some(w => (t.text || '').toLowerCase().includes(w))
  );
  return matched.length > 0 ? matched : items; // fallback to all if nothing matches
}


// ══════════════════════════════════════════════════════════════════════════════
// ENGINE DETECTION
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Detects the forum engine from raw HTML.
 * Returns one of: 'vbulletin4', 'vbulletin5', 'xenforo1', 'xenforo2',
 *                 'phpbb', 'mybb', 'discourse', 'invision', 'yabb',
 *                 'smf', 'vanilla', 'unknown'
 */
function detectEngine(html) {
  const h = html.toLowerCase();

  // ── vBulletin 5 ──
  // vB5 uses a React-like SPA shell with data-widget attributes
  if (h.includes('vbulletin 5') || h.includes('vb5') ||
      h.includes('data-widget="vb5') || h.includes('"vbulletin"') ||
      (h.includes('forum.showthread') && h.includes('postlist'))) {
    return 'vbulletin5';
  }

  // ── vBulletin 4 ──
  // Classic vB4 has specific markers in the HTML
  if (h.includes('vbulletin') || h.includes('vb_postbit') ||
      h.includes('postcontainer') || h.includes('postbit_legacy') ||
      h.includes('threadbit') || h.includes('forumbit_post') ||
      h.includes('showthread.php') || h.includes('forumdisplay.php')) {
    return 'vbulletin4';
  }

  // ── XenForo 2 ──
  if (h.includes('xenforo') || h.includes('xf-') ||
      h.includes('data-xf-') || h.includes('xenforo 2') ||
      h.includes('structitem') || h.includes('contentrow') ||
      h.includes('p-title') || h.includes('threadmarks')) {
    return 'xenforo2';
  }

  // ── XenForo 1 ──
  if (h.includes('xenbase') || h.includes('xenforo 1') ||
      h.includes('.messagetext') || h.includes('messagelistitem') ||
      h.includes('primarycontent')) {
    return 'xenforo1';
  }

  // ── phpBB ──
  if (h.includes('phpbb') || h.includes('viewtopic.php') ||
      h.includes('viewforum.php') || h.includes('postbody') ||
      h.includes('phpbb_') || h.includes('post-author')) {
    return 'phpbb';
  }

  // ── MyBB ──
  if (h.includes('mybb') || h.includes('forumdisplay') ||
      h.includes('showthread') && h.includes('post_body') ||
      h.includes('thread_title') || h.includes('mybbuser')) {
    return 'mybb';
  }

  // ── Discourse ──
  if (h.includes('discourse') || h.includes('ember-application') ||
      h.includes('d-header') || h.includes('topic-list') ||
      h.includes('data-topic-id')) {
    return 'discourse';
  }

  // ── Invision Power Board (IPB/IPS) ──
  if (h.includes('ipsapp') || h.includes('ipb') ||
      h.includes('ips-forum') || h.includes('cPost') ||
      h.includes('data-ipb=') || h.includes('ipstype_')) {
    return 'invision';
  }

  // ── YaBB ──
  if (h.includes('yabb') || h.includes('yabb.pl')) {
    return 'yabb';
  }

  // ── SMF (Simple Machines Forum) ──
  if (h.includes('smf') || h.includes('simple machines') ||
      h.includes('smiley_holder') || h.includes('forumposts')) {
    return 'smf';
  }

  // ── Vanilla Forums ──
  if (h.includes('vanillaforums') || h.includes('vanilla-forum') ||
      h.includes('ItemDiscussion') || h.includes('vanilla_')) {
    return 'vanilla';
  }

  return 'unknown';
}

/** Extract forum name from HTML <title> tag */
function extractForumName(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!m) return '';
  return stripHtml(m[1]).replace(/\s*[-|–]\s*.*$/, '').trim().slice(0, 80);
}


// ══════════════════════════════════════════════════════════════════════════════
// PER-ENGINE THREAD LIST EXTRACTORS
// Each returns an array of { text, url, author?, date?, replyCount?, views? }
// ══════════════════════════════════════════════════════════════════════════════

/**
 * vBulletin 4 — the engine used by:
 *   Hexus.net, many older AU forums, ProductReview, PriceSpy AU
 *
 * Key selectors (from milesburton/vbulletin-forum-scraper):
 *   Thread list:  #threads > li.threadbit
 *   Title:        h3.threadtitle a.title
 *   Author:       .threadmeta .author span.label  (or .username)
 *   Date:         .threadmeta .stats dd:first-child  (or span.time)
 *   Reply count:  dd.replycount  or  span.threadstats
 *   Views:        dd.viewcount
 *
 * Subforum listing:
 *   ol#forums > li.forumbit_nopost > ol.childforum > li.forumbit_post h2.forumtitle > a
 *   OR  h2.forumtitle > a
 *
 * Search results page:
 *   #search_results .searchresult  /  li.searchresult h3 a
 */
function extractVB4Threads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── 1. Thread list rows (#threads > li.threadbit) ──
  const threadBitRe = /<li[^>]*class="[^"]*\bthreadbit\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(threadBitRe)) {
    const block = m[1];

    // Title link — h3.threadtitle a.title  OR  a.title
    const titleM = block.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
                || block.match(/href="(showthread\.php[^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleM) continue;

    const url    = resolveUrl(titleM[1], baseUrl);
    const text   = stripHtml(titleM[2]);

    // Author
    const authorM = block.match(/class="[^"]*\busername\b[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i)
                 || block.match(/<span[^>]+class="[^"]*author[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const author   = authorM ? stripHtml(authorM[1]) : '';

    // Reply count
    const replyM = block.match(/class="[^"]*replycount[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i)
                || block.match(/<dd[^>]*class="[^"]*reply[^"]*"[^>]*>([\d,]+)/i);
    const replyCount = replyM ? parseInt(replyM[1].replace(/,/g, ''), 10) || 0 : 0;

    // View count
    const viewM = block.match(/class="[^"]*viewcount[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i);
    const views  = viewM ? parseInt(stripHtml(viewM[1]).replace(/,/g, ''), 10) || 0 : 0;

    // Last post date
    const dateM = block.match(/<span[^>]+class="[^"]*\btime\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
               || block.match(/<span[^>]+class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const date   = dateM ? stripHtml(dateM[1]) : '';

    addThread(threads, seen, text, url, { author, replyCount, views, date, engine: 'vbulletin4' });
  }

  // ── 2. Search results (li.searchresult or div.searchresult) ──
  const srRe = /<(?:li|div)[^>]*class="[^"]*searchresult[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  for (const m of html.matchAll(srRe)) {
    const block  = m[1];
    const titleM = block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
                || block.match(/<a[^>]+href="([^"]*showthread[^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleM) continue;
    const snippet = block.match(/<div[^>]*class="[^"]*searchresult[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    addThread(threads, seen, titleM[2], resolveUrl(titleM[1], baseUrl), {
      snippet: snippet ? stripHtml(snippet[1]).slice(0, 200) : '',
      engine: 'vbulletin4',
    });
  }

  // ── 3. Subforum links (forumtitle) ──
  const sfRe = /<h2[^>]*class="[^"]*forumtitle[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(sfRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { type: 'subforum', engine: 'vbulletin4' });
  }

  // ── 4. Generic fallback — any showthread.php or forumdisplay.php link ──
  if (threads.length < 3) {
    const fbRe = /href="((?:showthread|forumdisplay)\.php[^"]*)"[^>]*>([\s\S]{5,120}?)<\/a>/gi;
    for (const m of html.matchAll(fbRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'vbulletin4' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * vBulletin 5 — newer SPA-style vBulletin.
 * v5 renders content via JavaScript but the initial HTML payload still
 * contains data islands and some plain markup.
 *
 * Markers:
 *   Thread cards: .js-threadList .js-threadBit  OR  article[data-node-id]
 *   Title: h3.node-title a  OR  .js-title
 *   Author: span[data-userid]  OR  .username
 *   JSON island: window.VBULLETIN_INIT or data-content-id
 *
 * Search: /forum/search?query=...
 *   .js-searchResult  OR  .searchResultItem  (varies by v5.x)
 */
function extractVB5Threads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── 1. Article-based thread cards ──
  const articleRe = /<article[^>]*data-node-id="([^"]*)"[^>]*>([\s\S]*?)<\/article>/gi;
  for (const m of html.matchAll(articleRe)) {
    const block  = m[1];
    const inner  = m[2];
    const titleM = inner.match(/<a[^>]+class="[^"]*(?:node-title|js-title)[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
                || inner.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    if (!titleM) continue;
    const text = titleM[2] ? stripHtml(titleM[2]) : stripHtml(titleM[1]);
    const href = titleM[2] ? resolveUrl(titleM[1], baseUrl) : baseUrl;
    const authorM = inner.match(/data-userid="[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i);
    addThread(threads, seen, text, href, { author: authorM ? stripHtml(authorM[1]) : '', engine: 'vbulletin5' });
  }

  // ── 2. .js-threadBit blocks ──
  const jtRe = /<div[^>]+class="[^"]*js-threadBit[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const m of html.matchAll(jtRe)) {
    const inner = m[1];
    const linkM = inner.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*js-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
               || inner.match(/<a[^>]+class="[^"]*title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'vbulletin5' });
  }

  // ── 3. JSON data island (vB5 often embeds thread data as JSON) ──
  const jsonRe = /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/;
  const jsonM  = html.match(jsonRe);
  if (jsonM) {
    try {
      const data = JSON.parse(jsonM[1]);
      const threadList = data?.forum?.threads || data?.threads || [];
      for (const t of threadList) {
        const text = t.title || t.subject || '';
        const href = t.url || (baseUrl + '/topic/' + (t.id || ''));
        addThread(threads, seen, text, href, { author: t.author || '', engine: 'vbulletin5' });
      }
    } catch {}
  }

  // ── 4. vB5 search results ──
  const srRe = /<div[^>]+class="[^"]*(?:js-searchResult|searchResultItem)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const m of html.matchAll(srRe)) {
    const inner = m[1];
    const linkM = inner.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'vbulletin5' });
  }

  // ── 5. Fallback to vB4 extractor (many vB5 sites still have vB4-style HTML) ──
  if (threads.length < 3) {
    const vb4 = extractVB4Threads(html, baseUrl);
    vb4.forEach(t => addThread(threads, seen, t.text, t.url, { ...t, engine: 'vbulletin5' }));
  }

  return threads;
}

/**
 * XenForo 2 — used by BigFooty, many AU gaming/hobbyist forums.
 *
 * Key classes:
 *   Thread row:    .structItem--thread  OR  li.discussionListItem
 *   Title:         .structItem-title > a  OR  h3.contentRow-title > a
 *   Author:        .username  OR  .structItem-cell--meta .username
 *   Reply count:   .pairs--justified dd  (first is replies)
 *   Last post:     .structItem-cell--latest time[datetime]
 *   Views:         .pairs--rows .pairs--justified dd (second value)
 *
 * Search:
 *   /search/?q=...&c[node]=NNN&o=date
 *   .contentRow-title > a  OR  h3.contentRow-title > a
 *
 * Subforum listing:
 *   .block-container .node--forum h3.node-title > a
 */
function extractXF2Threads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── 1. structItem thread rows ──
  const siRe = /<li[^>]+class="[^"]*\bstructItem\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(siRe)) {
    const block = m[1];

    // Title: .structItem-title a  OR  h3 a
    const linkM = block.match(/<div[^>]+class="[^"]*structItem-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
               || block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;

    const text = stripHtml(linkM[2]);
    const url  = resolveUrl(linkM[1], baseUrl);

    // Author
    const authorM = block.match(/<a[^>]+class="[^"]*\busername\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const author   = authorM ? stripHtml(authorM[1]) : '';

    // Reply count — first dd in .pairs--justified
    const replyM = block.match(/class="[^"]*pairs[^"]*"[^>]*>[\s\S]*?<dt[^>]*>[^<]*[Rr]epli[^<]*<\/dt>\s*<dd[^>]*>([\d,]+)/i)
                || block.match(/<dl[^>]*>[\s\S]*?<dd[^>]*>([\d,]+)/i);
    const replyCount = replyM ? parseInt(replyM[1].replace(/,/g, ''), 10) || 0 : 0;

    // Date
    const dateM = block.match(/<time[^>]+datetime="([^"]+)"/i);
    const date   = dateM ? dateM[1] : '';

    addThread(threads, seen, text, url, { author, replyCount, date, engine: 'xenforo2' });
  }

  // ── 2. contentRow (search results & some listing pages) ──
  const crRe = /<div[^>]+class="[^"]*contentRow[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(?:div|article)>/gi;
  for (const m of html.matchAll(crRe)) {
    const block = m[1];
    const linkM = block.match(/<h[123][^>]+class="[^"]*contentRow-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
               || block.match(/<a[^>]+class="[^"]*contentRow-title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const snippet = block.match(/<div[^>]+class="[^"]*contentRow-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), {
      snippet: snippet ? stripHtml(snippet[1]).slice(0, 200) : '',
      engine: 'xenforo2',
    });
  }

  // ── 3. Node (subforum) listings ──
  const nodeRe = /<h[23][^>]+class="[^"]*node-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(nodeRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { type: 'subforum', engine: 'xenforo2' });
  }

  // ── 4. p-title links (XF2 thread page title breadcrumb) ──
  if (threads.length < 3) {
    const ptRe = /<h1[^>]+class="[^"]*p-title-value[^"]*"[^>]*>([\s\S]*?)<\/h1>/gi;
    for (const m of html.matchAll(ptRe)) {
      addThread(threads, seen, m[1], baseUrl, { engine: 'xenforo2' });
    }
  }

  return threads;
}

/**
 * XenForo 1 — older XF1.x sites.
 * Very similar to XF2 but uses different class names.
 *
 * Thread row:  li.discussionListItem
 * Title:       h3.title a.PreviewTooltip  OR  a.title
 * Author:      span.username  OR  a.username
 * Reply count: dl.lastPostInfo dd:first-child  OR  .DiscussionStats a
 */
function extractXF1Threads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── discussionListItem rows ──
  const dliRe = /<li[^>]+class="[^"]*\bdiscussionListItem\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(dliRe)) {
    const block = m[1];
    const linkM = block.match(/<a[^>]+class="[^"]*\btitle\b[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
               || block.match(/<h3[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const authorM = block.match(/<a[^>]+class="[^"]*\busername\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const replyM  = block.match(/<dl[^>]*>[\s\S]*?<dd[^>]*class="[^"]*reply[^"]*"[^>]*>([\d,]+)/i);
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), {
      author:     authorM ? stripHtml(authorM[1]) : '',
      replyCount: replyM  ? parseInt(replyM[1].replace(/,/g, ''), 10) || 0 : 0,
      engine: 'xenforo1',
    });
  }

  // ── Fallback: any .title or PreviewTooltip link inside .messageList ──
  if (threads.length < 3) {
    const fbRe = /<a[^>]+class="[^"]*(?:PreviewTooltip|title)[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(fbRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'xenforo1' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * phpBB — one of the most common forum engines.
 * Used by many AU special-interest boards.
 *
 * Thread row:  tr.row1, tr.row2, tr.bg1, tr.bg2  inside  table.forumline
 * Title:       a.topictitle  OR  strong > a inside td.topictitle
 * Author:      span.name  OR  td.author a
 * Reply count: td.postcount  OR  specific column
 * Search results: ul.topics > li  with  a.topictitle
 */
function extractPhpBBThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── a.topictitle (works across phpBB2, 3, 3.1, 3.2, 3.3) ──
  const ttRe = /<a[^>]+class="[^"]*topictitle[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(ttRe)) {
    // Extract reply count from surrounding row if possible
    // phpBB puts this in a nearby <dd> or <td>
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'phpbb' });
    if (threads.length >= 30) break;
  }

  // ── viewtopic / viewforum links (fallback) ──
  if (threads.length < 3) {
    const fbRe = /href="(viewtopic\.php[^"]*)"[^>]*>([\s\S]{5,120}?)<\/a>/gi;
    for (const m of html.matchAll(fbRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'phpbb' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * MyBB — used by various hobbyist and niche AU forums.
 *
 * Thread row:  tr.inline_row  inside  table#threadslist
 * Title:       strong > span.subject_bold a  OR  a.subject_bold
 * Author:      span.smalltext > a  in the "started by" column
 */
function extractMyBBThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── span.subject_bold a ──
  const sbRe = /<span[^>]+class="[^"]*subject_bold[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(sbRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'mybb' });
    if (threads.length >= 30) break;
  }

  // ── thread_title class (MyBB 1.8+) ──
  if (threads.length < 3) {
    const ttRe = /<span[^>]+id="tid_\d+"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(ttRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'mybb' });
      if (threads.length >= 20) break;
    }
  }

  // ── Fallback: showthread links ──
  if (threads.length < 3) {
    const fbRe = /href="(showthread\.php\?tid=\d+[^"]*)"[^>]*>([\s\S]{5,120}?)<\/a>/gi;
    for (const m of html.matchAll(fbRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'mybb' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * Discourse — modern forum used by some AU councils, GovHack, tech communities.
 * Discourse is heavily JS-rendered but the topic-list is sometimes in the HTML,
 * and its JSON API (/latest.json, /search.json) is always available.
 */
function extractDiscourseThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── topic-list-item rows ──
  const liRe = /<tr[^>]+class="[^"]*topic-list-item[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const m of html.matchAll(liRe)) {
    const block = m[1];
    const linkM = block.match(/<a[^>]+class="[^"]*title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'discourse' });
  }

  // ── JSON data island ──
  const jsonRe = /window\.__PRELOADED_DISCOURSE_UI_JSON__\s*=\s*({[\s\S]*?});/;
  const jsonM  = html.match(jsonRe);
  if (jsonM) {
    try {
      const data   = JSON.parse(jsonM[1]);
      const topics = data?.topic_list?.topics || [];
      for (const t of topics) {
        addThread(threads, seen, t.title || t.fancy_title || '', baseUrl + '/t/' + (t.slug || t.id), {
          replyCount: t.posts_count || 0,
          views:      t.views || 0,
          engine: 'discourse',
        });
      }
    } catch {}
  }

  return threads;
}

/**
 * Invision Power Board (IPB / IPS Community Suite)
 * Used by some AU motorsport, gaming and trade forums.
 *
 * Thread row:  li[data-rowid]  OR  div.ipsDataItem
 * Title:       span.ipsDataItem_title a  OR  h4 > a
 */
function extractIPBThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // ── ipsDataItem rows ──
  const diRe = /<(?:li|div)[^>]+class="[^"]*ipsDataItem[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  for (const m of html.matchAll(diRe)) {
    const block = m[1];
    const linkM = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const text = stripHtml(linkM[2]);
    if (text.length < 5) continue;
    addThread(threads, seen, text, resolveUrl(linkM[1], baseUrl), { engine: 'invision' });
  }

  // ── cPost / ipsComment blocks ──
  if (threads.length < 3) {
    const cpRe = /<h[123][^>]*>[\s\S]*?<a[^>]+href="([^"]*topic[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(cpRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'invision' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * SMF (Simple Machines Forum)
 * Thread row:  #messageindex tbody tr  (td.subject a)
 */
function extractSMFThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  const subjectRe = /<td[^>]+class="[^"]*subject[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(subjectRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'smf' });
    if (threads.length >= 30) break;
  }

  // Fallback: topic links in URL
  if (threads.length < 3) {
    const fbRe = /href="(index\.php\?topic=[^"]+)"[^>]*>([\s\S]{5,120}?)<\/a>/gi;
    for (const m of html.matchAll(fbRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'smf' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}

/**
 * Generic fallback — catches any forum engine not specifically handled.
 * Uses broad patterns that work across most forum software.
 */
function extractGenericThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // Any heading-wrapped link that looks like a thread title
  const h3Re = /<h[2-4][^>]*>[\s\S]*?<a[^>]+href="([^"#?][^"]*)"[^>]*>([\s\S]{5,150}?)<\/a>/gi;
  for (const m of html.matchAll(h3Re)) {
    const text = stripHtml(m[2]);
    if (text.length > 8 && !/(sign in|register|log in|home|forum|category|back|privacy|terms|about|contact)/i.test(text)) {
      addThread(threads, seen, text, resolveUrl(m[1], baseUrl), { engine: 'generic' });
    }
    if (threads.length >= 30) break;
  }

  // td / li links that look like thread titles (common pattern across old boards)
  if (threads.length < 5) {
    const liRe = /<(?:td|li)[^>]*>[\s\S]{0,60}?<a[^>]+href="([^"#][^"]*(?:thread|topic|post|showthread|viewtopic)[^"]*)"[^>]*>([\s\S]{5,150}?)<\/a>/gi;
    for (const m of html.matchAll(liRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'generic' });
      if (threads.length >= 20) break;
    }
  }

  return threads;
}


// ══════════════════════════════════════════════════════════════════════════════
// POST EXTRACTORS — for /forum-thread route
// Returns array of { author, text, date, postId, userUrl, avatar? }
// ══════════════════════════════════════════════════════════════════════════════

function extractVB4Posts(html, baseUrl) {
  const posts = [];
  // vB4 posts: li.postcontainer  (from milesburton/vbulletin-forum-scraper)
  const pcRe = /<li[^>]+class="[^"]*\bpostcontainer\b[^"]*"[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(pcRe)) {
    const id    = m[1]; // e.g. "post_12345"
    const block = m[2];

    // Author
    const authorM = block.match(/<span[^>]+class="[^"]*\busername\b[^"]*"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i)
                 || block.match(/<a[^>]+class="[^"]*\busername\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const author  = authorM ? stripHtml(authorM[1]) : 'unknown';

    // User profile URL
    const userLinkM = block.match(/<a[^>]+class="[^"]*\busername\b[^"]*"[^>]+href="([^"]+)"[^>]*>/i);
    const userUrl    = userLinkM ? resolveUrl(userLinkM[1], baseUrl) : '';

    // Post body — div[id^="post_message_"] blockquote.postcontent
    const bodyM = block.match(/<div[^>]+id="post_message_\d+"[^>]*>[\s\S]*?<blockquote[^>]+class="[^"]*postcontent[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i)
               || block.match(/<blockquote[^>]+class="[^"]*postcontent[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i);
    const text  = bodyM ? stripHtml(bodyM[1]).slice(0, 1000) : '';

    // Date
    const dateM = block.match(/<span[^>]+class="[^"]*\bdate\b[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]+class="[^"]*\btime\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
               || block.match(/<span[^>]+class="[^"]*\bpostdate\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    const date  = dateM ? stripHtml((dateM[2] ? dateM[1] + ' ' + dateM[2] : dateM[1])) : '';

    if (author && text) {
      posts.push({ postId: id, author, text, date, userUrl, engine: 'vbulletin4' });
    }
  }
  return posts;
}

function extractVB5Posts(html, baseUrl) {
  const posts = [];
  // vB5 uses article[data-content-id] or .js-post
  const artRe = /<article[^>]+(?:data-content-id|class="[^"]*\bjs-post\b[^"]*")[^>]*>([\s\S]*?)<\/article>/gi;
  for (const m of html.matchAll(artRe)) {
    const block = m[1];
    const authorM = block.match(/<span[^>]+class="[^"]*\busername\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
                 || block.match(/data-userid="[^"]*"[^>]+data-username="([^"]+)"/i);
    const author  = authorM ? stripHtml(authorM[1]) : 'unknown';
    const bodyM   = block.match(/<div[^>]+class="[^"]*\bpostcontent\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                 || block.match(/<div[^>]+class="[^"]*\bjs-post-content\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const text    = bodyM ? stripHtml(bodyM[1]).slice(0, 1000) : '';
    const dateM   = block.match(/<time[^>]+datetime="([^"]+)"/i);
    if (author && text) {
      posts.push({ author, text, date: dateM ? dateM[1] : '', engine: 'vbulletin5' });
    }
  }
  // Fallback to vB4
  if (posts.length < 2) return extractVB4Posts(html, baseUrl);
  return posts;
}

function extractXF2Posts(html, baseUrl) {
  const posts = [];
  // XF2: article.message OR div.message
  const msgRe = /<(?:article|div)[^>]+class="[^"]*\bmessage\b[^"]*"[^>]*data-author="([^"]*)"[^>]*>([\s\S]*?)<\/(?:article|div)>/gi;
  for (const m of html.matchAll(msgRe)) {
    const author = stripHtml(m[1]) || 'unknown';
    const block  = m[2];
    const bodyM  = block.match(/<div[^>]+class="[^"]*\bmessage-body\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                || block.match(/<article[^>]+class="[^"]*\bmessage-body\b[^"]*"[^>]*>([\s\S]*?)<\/article>/i)
                || block.match(/<div[^>]+class="[^"]*\bbbox[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const text   = bodyM ? stripHtml(bodyM[1]).slice(0, 1000) : '';
    const dateM  = block.match(/<time[^>]+datetime="([^"]+)"/i);
    const userM  = block.match(/<a[^>]+class="[^"]*\busername\b[^"]*"[^>]+href="([^"]+)"/i);
    if (author && text) {
      posts.push({ author, text, date: dateM ? dateM[1] : '', userUrl: userM ? resolveUrl(userM[1], baseUrl) : '', engine: 'xenforo2' });
    }
  }
  return posts;
}

function extractXF1Posts(html, baseUrl) {
  const posts = [];
  // XF1: li.message
  const msgRe = /<li[^>]+class="[^"]*\bmessage\b[^"]*"[^>]*data-author="([^"]*)"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(msgRe)) {
    const author = stripHtml(m[1]);
    const block  = m[2];
    const bodyM  = block.match(/<div[^>]+class="[^"]*messageText[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                || block.match(/<blockquote[^>]+class="[^"]*messageText[^"]*"[^>]*>([\s\S]*?)<\/blockquote>/i);
    const text   = bodyM ? stripHtml(bodyM[1]).slice(0, 1000) : '';
    const dateM  = block.match(/<span[^>]+class="[^"]*DateTime[^"]*"[^>]+title="([^"]+)"/i)
                || block.match(/<abbr[^>]+class="[^"]*DateTime[^"]*"[^>]+title="([^"]+)"/i);
    if (author && text) {
      posts.push({ author, text, date: dateM ? dateM[1] : '', engine: 'xenforo1' });
    }
  }
  return posts;
}

function extractPhpBBPosts(html, baseUrl) {
  const posts = [];
  // phpBB3: div.postbody inside div.post  OR  table.forumline tr (phpBB2)
  const pbRe = /<div[^>]+class="[^"]*\bpostbody\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const m of html.matchAll(pbRe)) {
    const block   = m[1];
    const authorM = block.match(/<span[^>]+class="[^"]*\busername[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
                 || block.match(/<p[^>]+class="[^"]*\bauthor[^"]*"[^>]*>[\s\S]*?<strong>([\s\S]*?)<\/strong>/i);
    const bodyM   = block.match(/<div[^>]+class="[^"]*\bcontent\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
                 || block.match(/<div[^>]+class="[^"]*\bpostbody\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const dateM   = block.match(/<p[^>]+class="[^"]*\bauthor[^"]*"[^>]*>([^<]*<(?!\/p)[^>]*>)*([^<]*<abbr[^>]+title="([^"]+)")/i)
                 || block.match(/<time[^>]+datetime="([^"]+)"/i);
    if (authorM && bodyM) {
      posts.push({
        author: stripHtml(authorM[1]),
        text:   stripHtml(bodyM[1]).slice(0, 1000),
        date:   dateM ? (dateM[3] || dateM[1] || '') : '',
        engine: 'phpbb',
      });
    }
  }

  // phpBB2 fallback (table-based)
  if (posts.length < 2) {
    const tdRe = /<td[^>]+class="[^"]*\bpostbody\b[^"]*"[^>]*>([\s\S]*?)<\/td>/gi;
    for (const m of html.matchAll(tdRe)) {
      const text = stripHtml(m[1]).slice(0, 1000);
      if (text.length > 20) {
        posts.push({ author: 'unknown', text, engine: 'phpbb' });
      }
    }
  }
  return posts;
}

/** Generic post extractor — last resort */
function extractGenericPosts(html, baseUrl) {
  const posts = [];
  // Look for any element containing "post" in class with substantial text
  const pRe = /<(?:article|div|li|section)[^>]+class="[^"]*post[^"]*"[^>]*>([\s\S]*?)<\/(?:article|div|li|section)>/gi;
  for (const m of html.matchAll(pRe)) {
    const text = stripHtml(m[1]).slice(0, 1000);
    if (text.length > 30) {
      const authorM = m[1].match(/class="[^"]*(?:username|author|name)[^"]*"[^>]*>([\s\S]*?)<\/[a-z]+>/i);
      posts.push({
        author: authorM ? stripHtml(authorM[1]) : 'unknown',
        text,
        engine: 'generic',
      });
    }
    if (posts.length >= 50) break;
  }
  return posts;
}


// ══════════════════════════════════════════════════════════════════════════════
// URL RESOLVER
// ══════════════════════════════════════════════════════════════════════════════

function resolveUrl(href, baseUrl) {
  if (!href) return baseUrl;
  href = href.trim();
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  try {
    return new URL(href, baseUrl).href;
  } catch {
    // If baseUrl is not a valid base, extract origin manually
    const originM = baseUrl.match(/^(https?:\/\/[^/]+)/);
    if (originM) {
      return href.startsWith('/') ? originM[1] + href : originM[1] + '/' + href;
    }
    return href;
  }
}


// ══════════════════════════════════════════════════════════════════════════════
// MASTER DISPATCHER — picks the right extractor based on detected engine
// ══════════════════════════════════════════════════════════════════════════════

function extractThreads(html, baseUrl, forceEngine = '') {
  const engine = forceEngine || detectEngine(html);

  let threads = [];
  switch (engine) {
    case 'vbulletin4': threads = extractVB4Threads(html, baseUrl); break;
    case 'vbulletin5': threads = extractVB5Threads(html, baseUrl); break;
    case 'xenforo2':   threads = extractXF2Threads(html, baseUrl); break;
    case 'xenforo1':   threads = extractXF1Threads(html, baseUrl); break;
    case 'phpbb':      threads = extractPhpBBThreads(html, baseUrl); break;
    case 'mybb':       threads = extractMyBBThreads(html, baseUrl); break;
    case 'discourse':  threads = extractDiscourseThreads(html, baseUrl); break;
    case 'invision':   threads = extractIPBThreads(html, baseUrl); break;
    case 'smf':        threads = extractSMFThreads(html, baseUrl); break;
    default:           threads = extractGenericThreads(html, baseUrl); break;
  }

  // If primary extractor returned nothing, try generic as last resort
  if (threads.length === 0 && engine !== 'unknown') {
    threads = extractGenericThreads(html, baseUrl);
  }

  return { threads, detectedEngine: engine };
}

function extractPosts(html, baseUrl, engine = '') {
  const detectedEngine = engine || detectEngine(html);
  let posts = [];
  switch (detectedEngine) {
    case 'vbulletin4': posts = extractVB4Posts(html, baseUrl); break;
    case 'vbulletin5': posts = extractVB5Posts(html, baseUrl); break;
    case 'xenforo2':   posts = extractXF2Posts(html, baseUrl); break;
    case 'xenforo1':   posts = extractXF1Posts(html, baseUrl); break;
    case 'phpbb':      posts = extractPhpBBPosts(html, baseUrl); break;
    default:           posts = extractGenericPosts(html, baseUrl); break;
  }
  if (posts.length === 0 && detectedEngine !== 'unknown') {
    posts = extractGenericPosts(html, baseUrl);
  }
  return { posts, detectedEngine };
}


// ══════════════════════════════════════════════════════════════════════════════
// KNOWN AUSTRALIAN FORUMS REGISTRY
// Pre-configured forum URLs, categories, and search patterns
// ══════════════════════════════════════════════════════════════════════════════

const AU_FORUMS = {
  // vBulletin forums
  'auspolitics':       { url: 'https://www.auspolitics.com.au/forum/', engine: 'vbulletin4', name: 'AusPolitics Forum', category: 'politics' },
  'productreview':     { url: 'https://www.productreview.com.au/', engine: 'generic', name: 'ProductReview AU', category: 'consumer' },
  'ausforum':          { url: 'https://www.ausforum.com.au/', engine: 'vbulletin4', name: 'AusForum', category: 'general' },
  'ausstock':          { url: 'https://www.ausstock.com.au/forums/', engine: 'vbulletin4', name: 'AusStock Forums', category: 'finance' },
  'essentialbaby':     { url: 'https://www.essentialbaby.com.au/talk/', engine: 'vbulletin4', name: 'Essential Baby Forums', category: 'parenting' },
  'overclockers':      { url: 'https://forums.overclockers.com.au/', engine: 'vbulletin4', name: 'Overclockers Australia', category: 'tech' },
  'moneysaverhq':      { url: 'https://www.moneysaverhq.com.au/forums/', engine: 'vbulletin4', name: 'MoneySaverHQ', category: 'finance' },
  'dogz':              { url: 'https://www.dogzonline.com.au/forum/', engine: 'vbulletin4', name: 'DogzOnline', category: 'pets' },
  'boatpoint':         { url: 'https://www.boatpoint.com.au/forum/', engine: 'vbulletin4', name: 'BoatPoint Forums', category: 'marine' },
  'fishingworld':      { url: 'https://www.fishingworld.com.au/forums/', engine: 'vbulletin4', name: 'Fishing World AU', category: 'outdoors' },
  // XenForo forums
  'bigfooty':          { url: 'https://www.bigfooty.com/forum/forums/australian-politics.229/', engine: 'xenforo2', name: 'BigFooty AU Politics', category: 'politics', searchUrl: 'https://www.bigfooty.com/forum/search/?q={q}&c[node]=229&o=date' },
  'gumtreecommunity':  { url: 'https://community.gumtree.com.au/', engine: 'xenforo2', name: 'Gumtree Community', category: 'general' },
  'rpg':               { url: 'https://www.rpg.net/phpBB2/', engine: 'phpbb', name: 'RPG.net Forums', category: 'gaming' },
  // Other
  'whirlpool':         { url: 'https://forums.whirlpool.net.au/', engine: 'whirlpool', name: 'Whirlpool Forums', category: 'tech' },
  'hotcopper':         { url: 'https://hotcopper.com.au/discussions/politics/', engine: 'xenforo2', name: 'HotCopper Politics', category: 'finance' },
  'ozpolitic':         { url: 'https://www.ozpolitic.com/forum/YaBB.pl', engine: 'yabb', name: 'OzPolitic Forum', category: 'politics' },
};


// ══════════════════════════════════════════════════════════════════════════════
// DISCOURSE JSON API helper
// When a Discourse forum is detected, use their open JSON API directly
// ══════════════════════════════════════════════════════════════════════════════

async function fetchDiscourseJSON(baseUrl, query) {
  const threads = [];
  const seen    = new Set();

  // Try search endpoint
  if (query) {
    const { ok, html } = await safeFetch(
      `${baseUrl}/search.json?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } }
    );
    if (ok) {
      try {
        const data = JSON.parse(html);
        for (const t of (data?.topics || [])) {
          addThread(threads, seen, t.title || t.fancy_title, `${baseUrl}/t/${t.slug}/${t.id}`, {
            replyCount: t.posts_count,
            views: t.views,
            engine: 'discourse',
          });
        }
      } catch {}
    }
  }

  // Latest topics
  if (threads.length < 5) {
    const { ok, html } = await safeFetch(
      `${baseUrl}/latest.json`,
      { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } }
    );
    if (ok) {
      try {
        const data = JSON.parse(html);
        for (const t of (data?.topic_list?.topics || []).slice(0, 20)) {
          addThread(threads, seen, t.title || t.fancy_title, `${baseUrl}/t/${t.slug || t.id}`, {
            replyCount: t.posts_count,
            views: t.views,
            engine: 'discourse',
          });
        }
      } catch {}
    }
  }

  return threads;
}


// ══════════════════════════════════════════════════════════════════════════════
// WORKER ENTRY
// ══════════════════════════════════════════════════════════════════════════════

export default {
  async fetch(req, env) {
    // Always add CORS to every response including errors
    const addCORS = (resp) => {
      const r = new Response(resp.body, resp);
      Object.entries(CORS_ONLY).forEach(([k,v]) => r.headers.set(k,v));
      return r;
    };

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_ONLY,
      });
    }

    const reqUrl  = new URL(req.url);
    const path    = reqUrl.pathname;
    const q       = reqUrl.searchParams.get('q') || '';
    const sr      = reqUrl.searchParams.get('sr') || 'australia';

    // ══════════════════════════════════════════════════════════════════════════
    // V5 ROUTES — POLITICAL INTELLIGENCE
    // ══════════════════════════════════════════════════════════════════════════

    // Google Trends — what Australia is searching right now (free RSS, no key)
    if (path === '/trends') {
      const geo = (reqUrl.searchParams.get('geo') || 'AU').replace(/[^A-Za-z-]/g, '');
      const cacheKey = 'trends_' + geo;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const r = await fetch('https://trends.google.com/trending/rss?geo=' + geo, {
          headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
        });
        if (!r.ok) return jsonResp({ error: 'trends_' + r.status }, 502);
        const xml = await r.text();
        const items = [];
        const blocks = xml.split('<item>').slice(1);
        for (const b of blocks.slice(0, 20)) {
          const g = (tag) => {
            const m = b.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)</' + tag + '>'));
            return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
          };
          const term = g('title');
          if (!term) continue;
          items.push({
            term,
            traffic: g('ht:approx_traffic'),
            started: g('pubDate'),
            newsTitle: g('ht:news_item_title'),
            newsUrl: g('ht:news_item_url'),
            newsSource: g('ht:news_item_source'),
          });
        }
        const out = JSON.stringify({ trends: items, geo });
        await kvPut(env.AXIOM_KV, cacheKey, out, 900);
        return new Response(out, { headers: CORS });
      } catch (e) { return jsonResp({ error: 'trends_fetch_failed', detail: String(e) }, 502); }
    }

    // Mastodon — live public political chatter from AU + global instances (no key)
    if (path === '/social') {
      const tag = (reqUrl.searchParams.get('tag') || 'auspol').replace(/[^\w]/g, '');
      const cacheKey = 'social_' + tag;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const instances = ['aus.social', 'mastodon.social'];
      const posts = [];
      await Promise.all(instances.map(async (inst) => {
        try {
          const r = await fetch('https://' + inst + '/api/v1/timelines/tag/' + tag + '?limit=20', {
            headers: { 'User-Agent': 'AXIOM/6.0' },
          });
          if (!r.ok) return;
          const arr = await r.json();
          (Array.isArray(arr) ? arr : []).forEach((s) => {
            const text = String(s.content || '')
              .replace(/<br\s*\/?>/gi, ' ')
              .replace(/<\/p>\s*<p>/gi, ' — ')
              .replace(/<[^>]+>/g, '')
              .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
              .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
            if (!text) return;
            posts.push({
              id: s.id, instance: inst,
              author: (s.account && (s.account.display_name || s.account.username)) || 'unknown',
              handle: s.account && s.account.acct,
              text: text.slice(0, 400),
              boosts: s.reblogs_count || 0, favs: s.favourites_count || 0, replies: s.replies_count || 0,
              url: s.url, date: s.created_at,
            });
          });
        } catch {}
      }));
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      const seen = new Set(); const uniq = [];
      for (const p of posts) { const k = p.url || p.id; if (seen.has(k)) continue; seen.add(k); uniq.push(p); }
      const out = JSON.stringify({ posts: uniq.slice(0, 40), tag });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      return new Response(out, { headers: CORS });
    }

    // GDELT DOC 2.0 — free global news monitoring (AU-scoped unless overridden)
    if (path === '/gdelt') {
      const mode     = reqUrl.searchParams.get('mode') || 'artlist';
      const timespan = reqUrl.searchParams.get('timespan') || '7d';
      const max      = Math.min(parseInt(reqUrl.searchParams.get('max') || '25', 10) || 25, 75);
      const gq = /sourcecountry:/.test(q) ? q : (q + ' sourcecountry:AS'); // AS = Australia (FIPS)
      const cacheKey = ('gdelt_' + mode + '_' + timespan + '_' + gq).slice(0, 240);
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const p = new URLSearchParams({ query: gq, mode, format: 'json', timespan });
      if (mode === 'artlist') { p.set('maxrecords', String(max)); p.set('sort', 'hybridrel'); }
      try {
        const r = await fetch('https://api.gdeltproject.org/api/v2/doc/doc?' + p, { headers: { 'User-Agent': 'AXIOM/5.0' } });
        const text = await r.text();
        let d; try { d = JSON.parse(text); } catch { return jsonResp({ error: 'gdelt_bad_response', detail: text.slice(0, 160) }, 502); }
        const out = mode === 'artlist'
          ? JSON.stringify({ articles: (d.articles || []).map(a => ({ title: a.title, url: a.url, domain: a.domain, date: a.seendate, country: a.sourcecountry })) })
          : JSON.stringify({ timeline: d.timeline || [] });
        await kvPut(env.AXIOM_KV, cacheKey, out, 600);
        return new Response(out, { headers: CORS });
      } catch (e) { return jsonResp({ error: 'gdelt_fetch_failed', detail: String(e) }, 502); }
    }

    // Wikipedia pageviews — free public-attention metric
    if (path === '/wiki') {
      const article = (reqUrl.searchParams.get('article') || '').trim().replace(/ /g, '_');
      const days    = Math.min(parseInt(reqUrl.searchParams.get('days') || '90', 10) || 90, 365);
      if (!article) return jsonResp({ error: 'article_required' }, 400);
      const end = new Date(); end.setDate(end.getDate() - 1); // today is always incomplete
      const start = new Date(end); start.setDate(start.getDate() - days);
      const fmt = (dt) => dt.toISOString().slice(0, 10).replace(/-/g, '');
      const cacheKey = 'wiki_' + article + '_' + days;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const r = await fetch(
          'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/' +
          encodeURIComponent(article) + '/daily/' + fmt(start) + '/' + fmt(end),
          { headers: { 'User-Agent': 'AXIOM/5.0 (AU political attention dashboard)' } });
        const d = await r.json();
        if (!r.ok) return jsonResp({ error: 'wiki_not_found', detail: (d && d.title) || 'Check the exact Wikipedia article title' }, 404);
        const out = JSON.stringify({ article: article.replace(/_/g, ' '), views: (d.items || []).map(i => ({ d: i.timestamp.slice(0, 8), v: i.views })) });
        await kvPut(env.AXIOM_KV, cacheKey, out, 3600);
        return new Response(out, { headers: CORS });
      } catch (e) { return jsonResp({ error: 'wiki_fetch_failed', detail: String(e) }, 502); }
    }

    // TheyVoteForYou — Australian MP / senator voting records (free key)
    if (path === '/tvfy') {
      if (!env.TVFY_KEY) return jsonResp({ error: 'no_tvfy_key', hint: 'Get a free key at theyvoteforyou.org.au/api and set the TVFY_KEY secret.' }, 500);
      const cached = await kvGet(env.AXIOM_KV, 'tvfy_people');
      let ppl;
      try {
        if (cached) { ppl = JSON.parse(cached); }
        else {
          const r = await fetch('https://theyvoteforyou.org.au/api/v1/people.json?key=' + env.TVFY_KEY, { headers: { 'User-Agent': 'AXIOM/5.0' } });
          const d = await r.json();
          ppl = (Array.isArray(d) ? d : []).map(x => ({
            id: x.id,
            name: (((x.latest_member || {}).name || {}).first || '') + ' ' + (((x.latest_member || {}).name || {}).last || ''),
            party: (x.latest_member || {}).party,
            house: (x.latest_member || {}).house,
            electorate: (x.latest_member || {}).electorate,
          }));
          await kvPut(env.AXIOM_KV, 'tvfy_people', JSON.stringify(ppl), 86400);
        }
        const filtered = q ? ppl.filter(x => (x.name || '').toLowerCase().includes(q.toLowerCase())) : ppl;
        return jsonResp({ people: filtered.slice(0, 30), total: filtered.length });
      } catch (e) { return jsonResp({ error: 'tvfy_fetch_failed', detail: String(e) }, 502); }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // V2 ROUTES — unchanged from axiom-worker.js v2
    // ══════════════════════════════════════════════════════════════════════════

    if (path === '/reddit') {
      try {
        const r = await fetch(
          `https://www.reddit.com/r/${encodeURIComponent(sr)}/search.json` +
          `?q=${encodeURIComponent(q)}&sort=top&limit=10&restrict_sr=on&t=month`,
          { headers: { 'User-Agent': 'AXIOM-Worker/3.0 (cloudflare)' } }
        );
        if (!r.ok) return jsonResp({ error: `reddit_${r.status}` }, 502);
        return jsonResp(await r.json());
      } catch (e) {
        return jsonResp({ error: 'reddit_fetch_failed', detail: String(e) }, 502);
      }
    }

    if (path === '/reddit-comments') {
      const permalink = reqUrl.searchParams.get('p') || '';
      try {
        const r = await fetch(
          `https://www.reddit.com${permalink}.json?limit=6&depth=1`,
          { headers: { 'User-Agent': 'AXIOM-Worker/3.0 (cloudflare)' } }
        );
        if (!r.ok) return jsonResp({ error: `reddit_comments_${r.status}` }, 502);
        return jsonResp(await r.json());
      } catch {
        return jsonResp({ error: 'reddit_comments_failed' }, 502);
      }
    }

    if (path === '/guardian') {
      if (!env.GUARDIAN_KEY) return jsonResp({ error: 'no_guardian_key' }, 500);
      try {
        const r = await fetch(
          `https://content.guardianapis.com/search` +
          `?q=${encodeURIComponent(q)}` +
          `&tag=world%2Faustralia,australia-news%2Faustralia-news` +
          `&show-fields=bodyText,commentCount` +
          `&order-by=relevance&page-size=10` +
          `&api-key=${env.GUARDIAN_KEY}`
        );
        return jsonResp(await r.json());
      } catch {
        return jsonResp({ error: 'guardian_fetch_failed' }, 502);
      }
    }

    if (path === '/rss') {
      const feed = reqUrl.searchParams.get('feed') || '';
      const rssUrl = AU_FEEDS[feed];
      if (!rssUrl) return new Response('{}', { headers: CORS });
      const cacheKey = `rss_${feed}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const r   = await fetch(rssUrl, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*' } });
        const xml = await r.text();
        const items = parseFeedXml(xml);
        const out = JSON.stringify({ items });
        await kvPut(env.AXIOM_KV, cacheKey, out, 600);
        return new Response(out, { headers: CORS });
      } catch {
        return jsonResp({ error: 'rss_fetch_failed' }, 502);
      }
    }

    // ── Aggregate AU news across the whole feed registry (one request) ──
    // GET /allnews?q=<keywords>&max=<n>   — server-side parallel fetch + merge
    if (path === '/allnews') {
      const q   = (reqUrl.searchParams.get('q') || '').toLowerCase();
      const max = Math.min(parseInt(reqUrl.searchParams.get('max') || '60', 10) || 60, 120);
      const qw  = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
      const cacheKey = `allnews_${q || 'all'}_${max}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });

      const keys = Object.keys(AU_FEEDS);
      const results = await Promise.allSettled(keys.map(async (key) => {
        const r = await fetch(AU_FEEDS[key], {
          headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(7000) : undefined,
        });
        if (!r.ok) throw new Error(`${key}_${r.status}`);
        const xml = await r.text();
        return parseFeedXml(xml).map(it => ({ src: key, ...it }));
      }));

      let items = [];
      const sources = [];
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          sources.push({ src: keys[i], count: res.value.length });
          items.push(...res.value);
        }
      });

      // keyword filter (any word matches title or description)
      if (qw.length) {
        items = items.filter(it => {
          const hay = (it.title + ' ' + (it.desc || '')).toLowerCase();
          return qw.some(w => hay.indexOf(w) !== -1);
        });
      }

      // newest first where dates parse, then cap
      items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
      items = items.slice(0, max);

      const out = JSON.stringify({ items, sources, feeds: keys.length });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      return new Response(out, { headers: CORS });
    }

    if (path === '/whirlpool') {
      try {
        const r = await fetch(
          `https://forums.whirlpool.net.au/search?q=${encodeURIComponent(q)}&forum=0`,
          { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' } }
        );
        const html    = await r.text();
        const threads = [];
        const seen    = new Set();
        const patterns = [
          /<div[^>]+class="[^"]*search-result[^"]*"[^>]*>[\s\S]*?<a[^>]+href="(\/archive\/[^"]+)"[^>]*>([^<]{8,})<\/a>/g,
          /<a[^>]+href="(\/archive\/\d+\/[^"]+)"[^>]*>([^<]{8,})<\/a>/g,
          /<h[23][^>]*>\s*<a[^>]+href="([^"]+whirlpool[^"]*)"[^>]*>([^<]{8,})<\/a>/g,
        ];
        for (const re of patterns) {
          for (const m of html.matchAll(re)) {
            const text = stripHtml(m[2]);
            if (text && !seen.has(text) && text.length > 6) {
              seen.add(text);
              threads.push({ text, url: 'https://forums.whirlpool.net.au' + m[1] });
            }
            if (threads.length >= 10) break;
          }
          if (threads.length >= 5) break;
        }
        return jsonResp({ threads, source: 'whirlpool' });
      } catch (e) {
        return jsonResp({ threads: [], error: 'whirlpool_fetch_failed', detail: String(e) });
      }
    }

    if (path === '/bigfooty') {
      const cacheKey = `bf_${q.slice(0, 40).replace(/\W/g,'_')}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const hdrs = { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-AU,en;q=0.9', 'Accept-Encoding': 'gzip, deflate, br', 'Referer': 'https://www.bigfooty.com/' };
      const threads = [];
      const seen    = new Set();
      try {
        const searchUrl = q ? `https://www.bigfooty.com/forum/search/?q=${encodeURIComponent(q)}&t=post&c[node]=229&o=date` : `https://www.bigfooty.com/forum/forums/australian-politics.229/`;
        const r = await fetch(searchUrl, { headers: hdrs });
        const html = await r.text();
        const titleRe = /<h[123][^>]*class="[^"]*(?:contentRow-title|thread-title|structItem-title)[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
        for (const m of html.matchAll(titleRe)) {
          const text = stripHtml(m[2]);
          if (text && text.length > 5 && !seen.has(text)) { seen.add(text); const href = m[1].startsWith('http') ? m[1] : 'https://www.bigfooty.com' + m[1]; threads.push({ text, url: href }); }
          if (threads.length >= 12) break;
        }
        if (threads.length === 0) {
          const structRe = /<div[^>]+class="[^"]*structItem[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]*threads[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
          for (const m of html.matchAll(structRe)) { const text = stripHtml(m[2]); if (text && text.length > 5 && !seen.has(text)) { seen.add(text); threads.push({ text, url: m[1].startsWith('http') ? m[1] : 'https://www.bigfooty.com' + m[1] }); } if (threads.length >= 12) break; }
        }
      } catch {}
      if (threads.length < 3) {
        try {
          const r = await fetch('https://www.bigfooty.com/forum/forums/australian-politics.229/', { headers: hdrs });
          const html = await r.text();
          const re = /<a[^>]+href="(https:\/\/www\.bigfooty\.com\/forum\/threads\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/g;
          for (const m of html.matchAll(re)) { const text = stripHtml(m[2]); if (text && text.length > 5 && !seen.has(text)) { seen.add(text); threads.push({ text, url: m[1] }); } if (threads.length >= 12) break; }
        } catch {}
      }
      const result = q ? threads.filter(t => q.toLowerCase().split(' ').some(w => w.length > 2 && t.text.toLowerCase().includes(w))) : threads;
      const out = JSON.stringify({ threads: result.slice(0, 10), source: 'bigfooty' });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      return new Response(out, { headers: CORS });
    }

    if (path === '/hotcopper') {
      const cacheKey = `hc_${q.slice(0, 40).replace(/\W/g,'_')}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const hdrs = { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-AU,en;q=0.9', 'Referer': 'https://hotcopper.com.au/', 'Cache-Control': 'no-cache' };
      const threads = [];
      const seen    = new Set();
      try {
        const r = await fetch('https://hotcopper.com.au/discussions/politics/', { headers: hdrs });
        const html = await r.text();
        const patterns = [/<a[^>]+href="(\/threads\/[^"?#]+)"[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/a>/g, /<a[^>]+class="[^"]*(?:title|thread-link|subject)[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, /href="(\/(?:threads|topics|discussions)\/[^"?#]{10,})"[^>]*>([\s\S]{8,80}?)<\/a>/g];
        for (const re of patterns) { for (const m of html.matchAll(re)) { const text = stripHtml(m[2]); if (text && text.length > 6 && !seen.has(text)) { seen.add(text); const href = m[1].startsWith('http') ? m[1] : 'https://hotcopper.com.au' + m[1]; threads.push({ text, url: href }); } if (threads.length >= 15) break; } if (threads.length >= 5) break; }
      } catch {}
      if (threads.length < 3 && q) {
        try {
          const r = await fetch(`https://hotcopper.com.au/search/?q=${encodeURIComponent(q)}&type=post&prefixid=politics`, { headers: hdrs });
          const html = await r.text();
          const re = /href="(\/threads\/[^"?#]+)"[^>]*>([\s\S]{6,120}?)<\/a>/g;
          for (const m of html.matchAll(re)) { const text = stripHtml(m[2]); if (text && text.length > 5 && !seen.has(text)) { seen.add(text); threads.push({ text, url: 'https://hotcopper.com.au' + m[1] }); } if (threads.length >= 12) break; }
        } catch {}
      }
      const result = q && threads.length > 3 ? threads.filter(t => q.toLowerCase().split(' ').some(w => w.length > 2 && t.text.toLowerCase().includes(w))) : threads;
      const final = result.length > 0 ? result : threads;
      const out = JSON.stringify({ threads: final.slice(0, 10), source: 'hotcopper' });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      return new Response(out, { headers: CORS });
    }

    if (path === '/ozpolitic') {
      const cacheKey = `oz_${q.slice(0, 40).replace(/\W/g,'_')}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const hdrs = { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'en-AU,en;q=0.9', 'Referer': 'https://www.ozpolitic.com/' };
      const threads = [];
      const seen    = new Set();
      const topicRe = /href="(YaBB\.pl\?num=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/g;
      const addFromHtml = (html) => { for (const m of html.matchAll(topicRe)) { const text = stripHtml(m[2]); if (!text || text.length < 5 || /^(reply|quote|more|back|top|next|prev|\d+)$/i.test(text)) continue; if (!seen.has(text)) { seen.add(text); threads.push({ text, url: 'https://www.ozpolitic.com/forum/' + m[1] }); } if (threads.length >= 15) break; } };
      if (q) { try { const r = await fetch(`https://www.ozpolitic.com/forum/YaBB.pl?action=search2;search=${encodeURIComponent(q)};searchtype=1;maxresults=15`, { headers: hdrs }); if (r.ok) addFromHtml(await r.text()); } catch {} }
      if (threads.length < 3) { try { const r = await fetch('https://www.ozpolitic.com/forum/YaBB.pl?action=recent', { headers: hdrs }); if (r.ok) addFromHtml(await r.text()); } catch {} }
      if (threads.length < 3) { try { const r = await fetch('https://www.ozpolitic.com/forum/YaBB.pl', { headers: hdrs }); if (r.ok) addFromHtml(await r.text()); } catch {} }
      const result = q && threads.length > 3 ? threads.filter(t => q.toLowerCase().split(' ').some(w => w.length > 2 && t.text.toLowerCase().includes(w))) : threads;
      const final = result.length > 0 ? result : threads;
      const out = JSON.stringify({ threads: final.slice(0, 10), source: 'ozpolitic' });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      return new Response(out, { headers: CORS });
    }

    if (path === '/ozpolitic-rss') {
      const cacheKey = 'ozpolitic_rss';
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const r = await fetch('https://www.ozpolitic.com/forum/YaBB.pl?action=RSSrecent', { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,text/xml,application/xml,*/*' } });
        if (!r.ok) return jsonResp({ items: [], error: `ozpolitic_rss_${r.status}` });
        const xml = await r.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => {
          const b = m[1];
          const title = stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '');
          const link = ((b.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '').trim();
          const desc = stripHtml((b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/) || [])[1] || '').slice(0, 300);
          const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1]?.trim() || '';
          const author = stripHtml((b.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/) || b.match(/<author[^>]*>([\s\S]*?)<\/author>/) || [])[1] || '') || 'OzPolitic user';
          return { title, link, description: desc, date, author };
        }).filter(i => i.title);
        const out = JSON.stringify({ items, source: 'ozpolitic_rss' });
        await kvPut(env.AXIOM_KV, cacheKey, out, 600);
        return new Response(out, { headers: CORS });
      } catch (e) {
        return jsonResp({ items: [], error: 'ozpolitic_rss_failed', detail: String(e) });
      }
    }


    // ══════════════════════════════════════════════════════════════════════════
    // V3 NEW ROUTE: /forum-detect?url=
    // Detects engine, returns metadata — useful for UI to show engine badge
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/forum-detect') {
      const targetUrl = reqUrl.searchParams.get('url') || '';
      if (!targetUrl) return jsonResp({ error: 'url_required' }, 400);

      const { ok, html, status } = await safeFetch(targetUrl, { headers: FORUM_HEADERS(targetUrl) });
      if (!ok) return jsonResp({ error: 'fetch_failed', status }, 502);

      const engine    = detectEngine(html);
      const forumName = extractForumName(html);

      // Engine-to-human-readable mapping
      const ENGINE_LABELS = {
        vbulletin4: 'vBulletin 4',
        vbulletin5: 'vBulletin 5',
        xenforo2:   'XenForo 2',
        xenforo1:   'XenForo 1',
        phpbb:      'phpBB',
        mybb:       'MyBB',
        discourse:  'Discourse',
        invision:   'Invision Power Board',
        yabb:       'YaBB',
        smf:        'Simple Machines Forum',
        vanilla:    'Vanilla Forums',
        unknown:    'Unknown',
      };

      return jsonResp({
        engine,
        label:    ENGINE_LABELS[engine] || engine,
        name:     forumName,
        url:      targetUrl,
        detected: true,
      });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // V3 NEW ROUTE: /forum?url=&q=&engine=&page=
    // Universal forum thread-list scraper.
    //
    // Params:
    //   url    — full URL of forum board or search results page
    //   q      — optional search query (used for URL-based search + relevance filter)
    //   engine — optional: force engine (vbulletin4|vbulletin5|xenforo2|xenforo1|phpbb|mybb|discourse|invision|smf|generic)
    //   name   — optional: shortname from AU_FORUMS registry (e.g. 'bigfooty', 'overclockers')
    //   page   — optional: page number for pagination (default 1)
    //   ttl    — optional: cache TTL in seconds (default 300)
    // ══════════════════════════════════════════════════════════════════════════
    // ══════════════════════════════════════════════════════════════════════════
    // V3 NEW ROUTE: /forum?url=&q=&engine=&name=&page=&ttl=
    // Universal forum thread-list scraper — auto-detects vBulletin, XenForo, etc.
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/forum') {
      const forumNameParam = reqUrl.searchParams.get('name') || '';
      const forceEng       = reqUrl.searchParams.get('engine') || '';
      const page           = parseInt(reqUrl.searchParams.get('page') || '1', 10) || 1;
      const ttl            = parseInt(reqUrl.searchParams.get('ttl') || '300', 10) || 300;

      let targetUrl      = reqUrl.searchParams.get('url') || '';
      let registryEntry  = null;

      if (forumNameParam && AU_FORUMS[forumNameParam]) {
        registryEntry = AU_FORUMS[forumNameParam];
        targetUrl     = registryEntry.url;
      }
      if (!targetUrl) return jsonResp({ error: 'url_or_name_required' }, 400);

      // Build search URL if query provided
      let fetchUrl = targetUrl;
      if (q) {
        if (registryEntry?.searchUrl) {
          fetchUrl = registryEntry.searchUrl.replace('{q}', encodeURIComponent(q));
        } else {
          const eng = forceEng || registryEntry?.engine || '';
          const base = targetUrl.replace(/\/forums?\/.*$/, '').replace(/\/[^/]+\.php.*$/, '').replace(/\/$/, '');
          if (eng === 'vbulletin4' || eng === 'vbulletin5') {
            fetchUrl = `${base}/search.php?do=process&query=${encodeURIComponent(q)}&titleonly=0&childforums=1&order=descending`;
          } else if (eng === 'xenforo2' || eng === 'xenforo1') {
            fetchUrl = `${base}/search/?q=${encodeURIComponent(q)}&o=date`;
          } else if (eng === 'phpbb') {
            fetchUrl = `${base}/search.php?keywords=${encodeURIComponent(q)}&terms=all&sf=titlepost&sr=topics&sk=t&sd=d`;
          } else if (eng === 'mybb') {
            fetchUrl = `${base}/search.php?action=do_search&keywords=${encodeURIComponent(q)}&postthread=1`;
          } else if (eng === 'discourse') {
            const discThreads = await fetchDiscourseJSON(base, q);
            return jsonResp({ threads: relevanceFilter(discThreads, q).slice(0, 20), engine: 'discourse', source: targetUrl, total: discThreads.length });
          }
        }
      }

      // Handle pagination
      if (page > 1) {
        const eng = forceEng || registryEntry?.engine || '';
        if (eng === 'vbulletin4' || eng === 'vbulletin5') {
          fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&page=${page}` : `${fetchUrl}?page=${page}`;
        } else if (eng === 'xenforo2' || eng === 'xenforo1') {
          fetchUrl = fetchUrl.replace(/\/?$/, '') + `/page-${page}`;
        } else if (eng === 'phpbb') {
          const start = (page - 1) * 25;
          fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&start=${start}` : `${fetchUrl}?start=${start}`;
        } else {
          fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&page=${page}` : `${fetchUrl}?page=${page}`;
        }
      }

      const cacheKey = `forum_${btoa(fetchUrl.slice(0, 80)).replace(/[^a-z0-9]/gi,'').slice(0,32)}_p${page}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });

      const { ok, html, status } = await safeFetch(fetchUrl, { headers: FORUM_HEADERS(targetUrl) });
      if (!ok) {
        const fallback = await safeFetch(targetUrl, { headers: FORUM_HEADERS() });
        if (!fallback.ok) return jsonResp({ error: 'fetch_failed', url: fetchUrl, status }, 502);
        const { threads: ft, detectedEngine: de } = extractThreads(fallback.html, targetUrl, forceEng);
        return jsonResp({ threads: relevanceFilter(ft, q).slice(0, 20), engine: de, source: targetUrl, page, total: ft.length });
      }

      const { threads, detectedEngine } = extractThreads(html, fetchUrl, forceEng || registryEntry?.engine || '');
      const filtered = relevanceFilter(threads, q);
      const result   = filtered.slice(0, 20);

      const nextM       = html.match(/<a[^>]+rel="next"[^>]+href="([^"]+)"/i);
      const nextPageUrl = nextM ? resolveUrl(nextM[1], fetchUrl) : '';

      const out = JSON.stringify({
        threads:    result,
        engine:     detectedEngine,
        source:     fetchUrl,
        name:       registryEntry?.name || extractForumName(html),
        category:   registryEntry?.category || '',
        page,
        total:      filtered.length,
        hasMore:    !!nextPageUrl || filtered.length >= 20,
        nextPageUrl,
      });
      await kvPut(env.AXIOM_KV, cacheKey, out, ttl);
      return new Response(out, { headers: CORS });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // V3 NEW ROUTE: /forum-thread?url=&engine=&page=&q=
    // Scrapes full post content from any forum thread page.
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/forum-thread') {
      const targetUrl = reqUrl.searchParams.get('url') || '';
      const forceEng  = reqUrl.searchParams.get('engine') || '';
      const page      = parseInt(reqUrl.searchParams.get('page') || '1', 10) || 1;

      if (!targetUrl) return jsonResp({ error: 'url_required' }, 400);

      const cacheKey = `thread_${btoa(targetUrl.slice(0, 80)).replace(/[^a-z0-9]/gi,'').slice(0,32)}_p${page}`;
      const cached   = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });

      // Build paginated URL
      let fetchUrl = targetUrl;
      if (page > 1) {
        if (forceEng === 'vbulletin4' || forceEng === 'vbulletin5') {
          fetchUrl = targetUrl.includes('?') ? `${targetUrl}&page=${page}` : `${targetUrl}?page=${page}`;
        } else if (forceEng === 'xenforo2' || forceEng === 'xenforo1') {
          fetchUrl = targetUrl.replace(/\/?$/, '') + `/page-${page}`;
        } else if (forceEng === 'phpbb') {
          fetchUrl = targetUrl.includes('?') ? `${targetUrl}&start=${(page-1)*25}` : `${targetUrl}?start=${(page-1)*25}`;
        } else {
          fetchUrl = targetUrl.includes('?') ? `${targetUrl}&page=${page}` : `${targetUrl}?page=${page}`;
        }
      }

      const { ok, html, status } = await safeFetch(fetchUrl, { headers: FORUM_HEADERS(targetUrl) });
      if (!ok) return jsonResp({ error: 'fetch_failed', url: fetchUrl, status }, 502);

      const { posts, detectedEngine } = extractPosts(html, fetchUrl, forceEng);

      // Thread title
      const titleM = html.match(/<h1[^>]*class="[^"]*(?:p-title-value|thread-title|threadtitle|entry-title|pagetitle)[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
                  || html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title   = titleM ? stripHtml(titleM[1]).replace(/\s*[-|]\s*.*$/, '').trim() : '';

      // Next page
      const nextM       = html.match(/<a[^>]+rel="next"[^>]+href="([^"]+)"/i);
      const nextPageUrl = nextM ? resolveUrl(nextM[1], fetchUrl) : '';
      const pageCountM  = html.match(/page\s+\d+\s+of\s+(\d+)/i);
      const totalPages  = pageCountM ? parseInt(pageCountM[1], 10) || 1 : 1;

      // Optional query filter
      let filteredPosts = posts;
      if (q) {
        const words   = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = posts.filter(p => words.some(w => (p.text || '').toLowerCase().includes(w)));
        if (matched.length > 0) filteredPosts = matched;
      }

      const out = JSON.stringify({
        title,
        posts:       filteredPosts.slice(0, 100),
        totalPosts:  posts.length,
        engine:      detectedEngine,
        source:      fetchUrl,
        page,
        totalPages,
        hasMore:     !!nextPageUrl || page < totalPages,
        nextPageUrl,
      });
      await kvPut(env.AXIOM_KV, cacheKey, out, 180);
      return new Response(out, { headers: CORS });
    }


    // ══════════════════════════════════════════════════════════════════════════
    // v4.1 — AUTO-COLLECT JOB  GET /collect?topics=&notify=
    // 14 sources · per-source optimal fetch method · SSE progress via KV
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/collect') {
      const topicsParam = reqUrl.searchParams.get('topics') || '';
      const topics = topicsParam
        ? topicsParam.split(',').map(t=>t.trim()).filter(Boolean)
        : ['housing crisis','cost of living','Albanese','Dutton LNP',
           'Greens climate','Medicare','AUKUS','immigration',
           'nuclear energy','RBA interest rates'];

      const jobId  = 'job_' + Date.now();
      const started = new Date().toISOString();
      const allItems = [];
      const log = [];           // live progress log entries
      const srcCounts = {};     // { source: count }

      const saveProgress = async (status, msg, extra = {}) => {
        log.push({ ts: new Date().toISOString(), msg });
        await kvPut(env.AXIOM_KV, 'auto_job_latest', JSON.stringify({
          jobId, status, started, log, topics,
          totalItems: allItems.length, srcCounts, ...extra,
        }), 86400);
      };

      await saveProgress('running', `Job ${jobId} started — ${topics.length} topics`);

      // ── helper: push items + track source count ──────────────────────────
      const push = (items, src) => {
        items.forEach(i => { i.src = i.src || src; allItems.push(i); });
        srcCounts[src] = (srcCounts[src] || 0) + items.length;
      };

      // ── FETCH HELPERS ─────────────────────────────────────────────────────
      const get = async (url, hdrs={}) => {
        try {
          const r = await fetch(url, {
            headers: { 'User-Agent': BROWSER_UA, ...hdrs },
            cf: { cacheTtl: 60 },
          });
          if (!r.ok) return null;
          return r;
        } catch { return null; }
      };

      const getJSON = async (url, hdrs={}) => {
        const r = await get(url, hdrs);
        if (!r) return null;
        try { return await r.json(); } catch { return null; }
      };

      const getXML = async (url) => {
        const r = await get(url, { 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' });
        if (!r) return null;
        return r.text();
      };

      const parseRSS = (xml, src, topic) => {
        if (!xml) return [];
        const items = [];
        const blocks = [
          ...xml.matchAll(/<item>([\s\S]*?)<\/item>/g),
          ...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g),
        ];
        const qw = topic.toLowerCase().split(' ').filter(w=>w.length>3);
        for (const m of blocks) {
          const b = m[1];
          const title = stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]||''));
          if (!title) continue;
          const link  = (b.match(/<link[^>]*href="([^"]+)"/)??b.match(/<link[^>]*>(https?[^<]+)<\/link>/)??[])[1]?.trim()||'#';
          const date  = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)??b.match(/<published>([\s\S]*?)<\/published>/)??[])[1]?.trim()||'';
          const desc  = stripHtml((b.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]||'')).slice(0,200);
          const combined = (title+' '+desc).toLowerCase();
          if (qw.length && !qw.some(w=>combined.includes(w))) continue;
          items.push({ src, text: title+(desc?' — '+desc:''), author: src, score:0, url:link, date, topic });
        }
        return items;
      };

      const delay = (ms) => new Promise(r=>setTimeout(r,ms));
      const jitter = () => delay(300 + Math.random()*500);

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 1 — HackerNews  (METHOD: Algolia JSON API — best method, free)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ HackerNews — Algolia search API');
      try {
        const hnItems = [];
        for (const topic of topics) {
          const d = await getJSON(
            `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic+' australia')}&tags=(story,comment)&hitsPerPage=6`
          );
          (d?.hits||[]).forEach(h => hnItems.push({
            src:'hn', text:(h.title||h.comment_text||'').slice(0,300),
            author:h.author||'anon', score:h.points||0,
            url:h.url||`https://news.ycombinator.com/item?id=${h.objectID}`,
            date:h.created_at, topic,
          }));
          await jitter();
        }
        push(hnItems, 'hn');
        await saveProgress('running', `  ✓ HackerNews: ${hnItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ HackerNews failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 2 — Reddit  (METHOD: JSON API — append .json to any Reddit URL)
      // 6 AU political subreddits
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Reddit — .json API across 6 AU subreddits');
      const SUBREDDITS = ['AustralianPolitics','australia','AusFinance','Labor','melbourne','sydney'];
      try {
        const rdItems = [];
        for (const sr of SUBREDDITS) {
          for (const topic of topics.slice(0,4)) { // top 4 topics per subreddit
            const d = await getJSON(
              `https://www.reddit.com/r/${sr}/search.json?q=${encodeURIComponent(topic)}&sort=top&limit=4&restrict_sr=on&t=week`,
              { 'User-Agent': 'AXIOM-Worker/4.1 (cloudflare; heshan@wearecuriousminds.com)' }
            );
            (d?.data?.children||[]).forEach(p => rdItems.push({
              src:'reddit', sr, text:p.data.title+(p.data.selftext?' — '+p.data.selftext.slice(0,200):''),
              author:p.data.author, score:p.data.score,
              url:'https://reddit.com'+p.data.permalink,
              date:new Date(p.data.created_utc*1000).toISOString(), topic,
            }));
            await delay(200);
          }
          await jitter();
        }
        push(rdItems, 'reddit');
        await saveProgress('running', `  ✓ Reddit: ${rdItems.length} items (6 subreddits)`);
      } catch(e) { await saveProgress('running', `  ✗ Reddit failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 3 — Guardian AU  (METHOD: Official Content API — JSON)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Guardian AU — Content API (JSON)');
      if (env.GUARDIAN_KEY) {
        try {
          const guItems = [];
          for (const topic of topics.slice(0,5)) {
            const d = await getJSON(
              `https://content.guardianapis.com/search?q=${encodeURIComponent(topic)}`+
              `&tag=australia-news/australia-news&show-fields=trailText&page-size=5&api-key=${env.GUARDIAN_KEY}`
            );
            (d?.response?.results||[]).forEach(r => guItems.push({
              src:'guardian', text:r.webTitle+(r.fields?.trailText?' — '+stripHtml(r.fields.trailText).slice(0,200):''),
              author:'Guardian AU', score:0, url:r.webUrl, date:r.webPublicationDate, topic,
            }));
            await jitter();
          }
          push(guItems, 'guardian');
          await saveProgress('running', `  ✓ Guardian AU: ${guItems.length} items`);
        } catch(e) { await saveProgress('running', `  ✗ Guardian failed: ${e}`); }
      } else {
        await saveProgress('running', '  ⚠ Guardian skipped — no GUARDIAN_KEY set');
      }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 4 — ABC News Politics  (METHOD: RSS feed — XML parse)
      // Politics-specific feed: feed/51120 + top stories: feed/2942460
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ ABC News — RSS feeds (Politics + Top Stories)');
      try {
        const abcItems = [];
        const abcFeeds = [
          'https://www.abc.net.au/news/feed/51120/rss.xml',   // Politics
          'https://www.abc.net.au/news/feed/2942460/rss.xml', // Top Stories
        ];
        for (const feedUrl of abcFeeds) {
          const xml = await getXML(feedUrl);
          for (const topic of topics) abcItems.push(...parseRSS(xml||'', 'abc', topic));
          await jitter();
        }
        const deduped = [...new Map(abcItems.map(i=>[i.url,i])).values()];
        push(deduped, 'abc');
        await saveProgress('running', `  ✓ ABC News: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ ABC failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 5 — SBS News  (METHOD: RSS feed — XML parse)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ SBS News — RSS feed');
      try {
        const sbsItems = [];
        const xml = await getXML('https://www.sbs.com.au/news/feed');
        for (const topic of topics) sbsItems.push(...parseRSS(xml||'', 'sbs', topic));
        const deduped = [...new Map(sbsItems.map(i=>[i.url,i])).values()];
        push(deduped, 'sbs');
        await saveProgress('running', `  ✓ SBS News: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ SBS failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 6 — SMH / Sydney Morning Herald  (METHOD: RSS — XML parse)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Sydney Morning Herald — RSS');
      try {
        const smhItems = [];
        const xml = await getXML('https://www.smh.com.au/rss/feed.xml');
        for (const topic of topics) smhItems.push(...parseRSS(xml||'', 'smh', topic));
        const deduped = [...new Map(smhItems.map(i=>[i.url,i])).values()];
        push(deduped, 'smh');
        await saveProgress('running', `  ✓ SMH: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ SMH failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 7 — The Age  (METHOD: RSS — XML parse)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ The Age (Melbourne) — RSS');
      try {
        const ageItems = [];
        const xml = await getXML('https://www.theage.com.au/rss/feed.xml');
        for (const topic of topics) ageItems.push(...parseRSS(xml||'', 'theage', topic));
        const deduped = [...new Map(ageItems.map(i=>[i.url,i])).values()];
        push(deduped, 'theage');
        await saveProgress('running', `  ✓ The Age: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ The Age failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 8 — The Conversation AU  (METHOD: RSS Atom feed — XML parse)
      // academic/expert analysis on AU politics
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ The Conversation AU — Atom RSS feed');
      try {
        const convItems = [];
        const xml = await getXML('https://theconversation.com/au/topics/australian-politics-671/articles.atom');
        for (const topic of topics) convItems.push(...parseRSS(xml||'', 'conversation', topic));
        const deduped = [...new Map(convItems.map(i=>[i.url,i])).values()];
        push(deduped, 'conversation');
        await saveProgress('running', `  ✓ The Conversation: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ The Conversation failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 9 — Crikey  (METHOD: RSS feed — XML parse)
      // Independent Australian political journalism
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Crikey — RSS feed');
      try {
        const crikeyItems = [];
        const xml = await getXML('https://www.crikey.com.au/feed/');
        for (const topic of topics) crikeyItems.push(...parseRSS(xml||'', 'crikey', topic));
        const deduped = [...new Map(crikeyItems.map(i=>[i.url,i])).values()];
        push(deduped, 'crikey');
        await saveProgress('running', `  ✓ Crikey: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ Crikey failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 10 — Canberra Times  (METHOD: RSS — XML parse)
      // National politics focus from capital
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Canberra Times — RSS');
      try {
        const ctItems = [];
        const xml = await getXML('https://www.canberratimes.com.au/rss.xml');
        for (const topic of topics) ctItems.push(...parseRSS(xml||'', 'canberratimes', topic));
        const deduped = [...new Map(ctItems.map(i=>[i.url,i])).values()];
        push(deduped, 'canberratimes');
        await saveProgress('running', `  ✓ Canberra Times: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ Canberra Times failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 10b — Extended AU newswire  (METHOD: shared AU_FEEDS registry)
      // Fans out across the rest of the registry not collected individually
      // above (Nine federal/regional, AFR, Guardian politics, independents,
      // news.com.au, AAP, InDaily…). Each feed: one fetch, parsed per topic.
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Extended AU newswire — registry feeds');
      try {
        const EXTRA_FEED_KEYS = [
          'smh_pol', 'brisbanetimes', 'watoday', 'afr', 'guardian_pol',
          'newdaily', 'michaelwest', 'independentau', 'menadue',
          'saturdaypaper', 'junkee', 'newscomau', 'aap', 'indaily',
        ];
        let extraTotal = 0;
        for (const key of EXTRA_FEED_KEYS) {
          const feedUrl = AU_FEEDS[key];
          if (!feedUrl) continue;
          try {
            const xml = await getXML(feedUrl);
            const fitems = [];
            for (const topic of topics) fitems.push(...parseRSS(xml || '', key, topic));
            const deduped = [...new Map(fitems.map(i => [i.url, i])).values()];
            if (deduped.length) { push(deduped, key); extraTotal += deduped.length; }
          } catch (e) {}
          await jitter();
        }
        await saveProgress('running', `  ✓ Extended newswire: ${extraTotal} items across ${EXTRA_FEED_KEYS.length} feeds`);
      } catch(e) { await saveProgress('running', `  ✗ Extended newswire failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 11 — 9News Politics  (METHOD: HTML scrape — CSS selectors)
      // Nine Network news site — no RSS for politics, scrape required
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ 9News — HTML scrape (article cards)');
      try {
        const nineItems = [];
        const r = await get('https://www.9news.com.au/politics', { 'Accept':'text/html' });
        if (r) {
          const html = await r.text();
          // 9News uses article cards with class "story-block" or "card" + h3/h2 headlines
          const re = /<(?:h[23]|a)[^>]*class="[^"]*(?:story|card|headline|title)[^"]*"[^>]*>[\s\S]*?<a[^>]+href="(https?:\/\/www\.9news\.com\.au[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          const seen = new Set();
          for (const m of html.matchAll(re)) {
            const text = stripHtml(m[2]).trim();
            const url  = m[1];
            if (!text || text.length < 10 || seen.has(url)) continue;
            seen.add(url);
            const qw = topics.flatMap(t=>t.toLowerCase().split(' ').filter(w=>w.length>3));
            if (!qw.some(w=>text.toLowerCase().includes(w))) continue;
            const matchedTopic = topics.find(t=>t.toLowerCase().split(' ').filter(w=>w.length>3).some(w=>text.toLowerCase().includes(w)))||topics[0];
            nineItems.push({ src:'9news', text, author:'9News', score:0, url, date:new Date().toISOString(), topic:matchedTopic });
            if(nineItems.length>=20) break;
          }
        }
        push(nineItems, '9news');
        await saveProgress('running', `  ✓ 9News: ${nineItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ 9News failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 12 — BigFooty Politics  (METHOD: XenForo2 HTML scrape)
      // XF2 structItem thread rows, node 229 = AU Politics
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ BigFooty Politics — XenForo2 HTML scrape');
      try {
        const bfItems = [];
        const seen = new Set();
        for (const topic of topics.slice(0,4)) {
          const url = `https://www.bigfooty.com/forum/search/?q=${encodeURIComponent(topic)}&t=post&c[node]=229&o=date`;
          const r = await get(url, { 'Accept':'text/html', 'Referer':'https://www.bigfooty.com/' });
          if (!r) continue;
          const html = await r.text();
          // XF2 selector: h3 contentRow-title or structItem-title
          const re = /class="[^"]*(?:contentRow-title|structItem-title)[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
          for (const m of html.matchAll(re)) {
            const text = stripHtml(m[2]).trim();
            const href = m[1].startsWith('http') ? m[1] : 'https://www.bigfooty.com'+m[1];
            if (!text||text.length<5||seen.has(text)) continue;
            seen.add(text);
            bfItems.push({ src:'bigfooty', text, author:'BigFooty user', score:0, url:href, date:new Date().toISOString(), topic });
            if(bfItems.length>=20) break;
          }
          await jitter();
        }
        push(bfItems, 'bigfooty');
        await saveProgress('running', `  ✓ BigFooty: ${bfItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ BigFooty failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 13 — Whirlpool Politics  (METHOD: Custom HTML scrape)
      // Whirlpool uses CFML — search results page with archive links
      // Note: "In the News" forum requires login, use search endpoint instead
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ Whirlpool — search endpoint scrape');
      try {
        const wpItems = [];
        const seen = new Set();
        for (const topic of topics.slice(0,3)) {
          const r = await get(
            `https://forums.whirlpool.net.au/search?q=${encodeURIComponent(topic)}&forum=0`,
            { 'Accept':'text/html', 'Referer':'https://forums.whirlpool.net.au/' }
          );
          if (!r) continue;
          const html = await r.text();
          // Whirlpool search results: links to /archive/NNNNNNN
          const re = /href="(\/archive\/\d+\/[^"]+)"[^>]*>([^<]{8,120})</gi;
          for (const m of html.matchAll(re)) {
            const text = stripHtml(m[2]).trim();
            const href = 'https://forums.whirlpool.net.au' + m[1];
            if (!text||seen.has(href)) continue;
            seen.add(href);
            wpItems.push({ src:'whirlpool', text, author:'Whirlpool user', score:0, url:href, date:new Date().toISOString(), topic });
            if(wpItems.length>=15) break;
          }
          await jitter();
        }
        push(wpItems, 'whirlpool');
        await saveProgress('running', `  ✓ Whirlpool: ${wpItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ Whirlpool failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 14 — OzPolitic  (METHOD: RSS feed + YaBB HTML scrape fallback)
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ OzPolitic — RSS feed + YaBB HTML fallback');
      try {
        const ozItems = [];
        // Try RSS first
        const xml = await getXML('https://www.ozpolitic.com/forum/YaBB.pl?action=RSSrecent');
        if (xml) {
          for (const topic of topics) ozItems.push(...parseRSS(xml, 'ozpolitic', topic));
        }
        // HTML fallback for recent posts
        if (ozItems.length < 5) {
          const r = await get('https://www.ozpolitic.com/forum/YaBB.pl?action=recent',
            { 'Accept':'text/html' });
          if (r) {
            const html = await r.text();
            const re = /href="(YaBB\.pl\?num=\d+[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
            for (const m of html.matchAll(re)) {
              const text = stripHtml(m[2]).trim();
              if (!text||text.length<5||/^(reply|quote|\d+)$/i.test(text)) continue;
              ozItems.push({ src:'ozpolitic', text, author:'OzPolitic user', score:0,
                url:'https://www.ozpolitic.com/forum/'+m[1], date:new Date().toISOString(), topic:topics[0] });
              if(ozItems.length>=15) break;
            }
          }
        }
        const deduped = [...new Map(ozItems.map(i=>[i.url,i])).values()].slice(0,20);
        push(deduped, 'ozpolitic');
        await saveProgress('running', `  ✓ OzPolitic: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ OzPolitic failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // SOURCE 15 — HotCopper Politics  (METHOD: XenForo HTML scrape)
      // Finance/politics crossover forum
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ HotCopper Politics — XenForo HTML scrape');
      try {
        const hcItems = [];
        const seen = new Set();
        const r = await get('https://hotcopper.com.au/discussions/politics/',
          { 'Accept':'text/html', 'Referer':'https://hotcopper.com.au/' });
        if (r) {
          const html = await r.text();
          const re = /href="(\/threads\/[^"?#]+)"[^>]*>([\s\S]{6,120}?)<\/a>/gi;
          for (const m of html.matchAll(re)) {
            const text = stripHtml(m[2]).trim();
            const href = 'https://hotcopper.com.au' + m[1];
            if (!text||text.length<6||seen.has(href)) continue;
            seen.add(href);
            const qw = topics.flatMap(t=>t.split(' ').filter(w=>w.length>3));
            const matchedTopic = topics.find(t=>t.split(' ').filter(w=>w.length>3).some(w=>text.toLowerCase().includes(w.toLowerCase())))||topics[0];
            hcItems.push({ src:'hotcopper', text, author:'HotCopper user', score:0, url:href, date:new Date().toISOString(), topic:matchedTopic });
            if(hcItems.length>=15) break;
          }
        }
        push(hcItems, 'hotcopper');
        await saveProgress('running', `  ✓ HotCopper: ${hcItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ HotCopper failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // INTERNATIONAL — BBC, Reuters, AP on AU politics
      // METHOD: RSS feeds filtered to Australia-relevant stories
      // ══════════════════════════════════════════════════════════════════════
      await saveProgress('running', '⬤ International — BBC/Reuters/AP (Australia filter)');
      try {
        const intlItems = [];
        const intlFeeds = [
          { url:'https://feeds.bbci.co.uk/news/world/australia/rss.xml', src:'bbc' },
          { url:'https://feeds.reuters.com/Reuters/worldNews', src:'reuters' },
        ];
        for (const { url:feedUrl, src } of intlFeeds) {
          const xml = await getXML(feedUrl);
          if (!xml) continue;
          const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
          for (const m of blocks) {
            const b = m[1];
            const title = stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]||''));
            if (!title) continue;
            const link = (b.match(/<link[^>]*>(https?[^<]+)<\/link>/)??[])[1]?.trim()||'#';
            const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)??[])[1]?.trim()||'';
            const tl   = title.toLowerCase();
            // Only keep Australia-related stories
            if (!tl.includes('austral') && !tl.includes('albanese') && !tl.includes('dutton') && !tl.includes('canberra')) continue;
            const matchedTopic = topics.find(t=>t.split(' ').filter(w=>w.length>3).some(w=>tl.includes(w.toLowerCase())))||'Australia';
            intlItems.push({ src, text:title, author:src.toUpperCase(), score:0, url:link, date, topic:matchedTopic });
          }
          await jitter();
        }
        push(intlItems, 'intl');
        await saveProgress('running', `  ✓ International (BBC/Reuters): ${intlItems.length} items`);
      } catch(e) { await saveProgress('running', `  ✗ International feeds failed: ${e}`); }

      // ══════════════════════════════════════════════════════════════════════
      // FINALISE
      // ══════════════════════════════════════════════════════════════════════
      const topicSummary = {};
      for (const topic of topics) {
        const tItems = allItems.filter(i=>i.topic===topic);
        const c = { pos:0,neg:0,neu:0 };
        tItems.forEach(i=>{ const s=quickSentiment(i.text); c[s]=(c[s]||0)+1; });
        topicSummary[topic] = {
          count: tItems.length,
          sentiment: c,
          dominant: Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||'neu',
        };
      }

      const jobResult = {
        jobId, status:'complete', started,
        finished: new Date().toISOString(),
        topics, totalItems:allItems.length,
        topicSummary, srcCounts,
        log,
        items: allItems.slice(0,600),
      };

      await kvPut(env.AXIOM_KV, 'auto_job_latest',  JSON.stringify(jobResult), 86400);
      await kvPut(env.AXIOM_KV, 'auto_job_'+jobId,  JSON.stringify(jobResult), 604800);
      await kvPut(env.AXIOM_KV, 'auto_last_run_ts', started, 86400);

      // Refresh RSS KV caches for instant access next time
      for (const [key, feedUrl] of Object.entries({
        abc:          'https://www.abc.net.au/news/feed/51120/rss.xml',
        guardian:     'https://www.theguardian.com/australia-news/rss',
        sbs:          'https://www.sbs.com.au/news/feed',
        crikey:       'https://www.crikey.com.au/feed/',
        conversation: 'https://theconversation.com/au/topics/australian-politics-671/articles.atom',
      })) {
        try {
          const xml = await getXML(feedUrl);
          if (xml) {
            const blocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g),...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
            const items = blocks.map(m=>{
              const b=m[1];
              const title=stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]||''));
              const link=(b.match(/<link[^>]*href="([^"]+)"/)??b.match(/<link[^>]*>(https?[^<]+)<\/link>/)??[])[1]?.trim();
              const date=(b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)??b.match(/<published>([\s\S]*?)<\/published>/)??[])[1]?.trim();
              return {title,link,date};
            }).filter(i=>i.title);
            await kvPut(env.AXIOM_KV, 'rss_'+key, JSON.stringify({items}), 3600);
          }
        } catch {}
      }

      return jsonResp({
        status:'complete', jobId, totalItems:allItems.length,
        srcCounts, topicSummary, log, started, finished:jobResult.finished,
      });
    }

    // ══════════════════════════════════════════════════════════════════════════
    // v4 — GET /collect-status
    // Returns latest job result from KV — polled by AXIOM UI
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/collect-status') {
      const latest = await kvGet(env.AXIOM_KV, 'auto_job_latest');
      const lastTs = await kvGet(env.AXIOM_KV, 'auto_last_run_ts');
      if (!latest) return jsonResp({ status: 'never_run', lastRun: null, items: [] });
      try {
        const job = JSON.parse(latest);
        return jsonResp({
          status:       job.status,
          jobId:        job.jobId,
          lastRun:      job.finished || job.started,
          topics:       job.topics,
          totalItems:   job.totalItems,
          topicSummary: job.topicSummary,
          // Return just the items for immediate use
          items: job.items || [],
        });
      } catch {
        return jsonResp({ status: 'error', lastRun: lastTs });
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // v4 — GET /collect-history?limit=10
    // Returns a list of recent job IDs stored in KV
    // ══════════════════════════════════════════════════════════════════════════
    if (path === '/collect-history') {
      const limit = parseInt(reqUrl.searchParams.get('limit') || '10', 10) || 10;
      try {
        const keys = await kvListJobs(env.AXIOM_KV, limit);
        return jsonResp({ jobs: keys });
      } catch {
        return jsonResp({ jobs: [] });
      }
    }

    // ── DEFAULT / health check ───────────────────────────────────────────────
    return jsonResp({
      name:    'AXIOM Proxy v4',
      status:  'ok',
      version: '4.0.0',
      engines: ['vbulletin4', 'vbulletin5', 'xenforo2', 'xenforo1', 'phpbb', 'mybb', 'discourse', 'invision', 'smf', 'yabb', 'generic'],
      routes: [
        'GET /reddit?q=&sr=',
        'GET /reddit-comments?p=',
        'GET /guardian?q=',
        'GET /rss?feed=abc|smh|guardian|sbs|crikey|conversation',
        'GET /whirlpool?q=',
        'GET /bigfooty?q=',
        'GET /hotcopper?q=',
        'GET /ozpolitic?q=',
        'GET /ozpolitic-rss',
        'GET /forum-detect?url=',
        'GET /forum?url=&q=&engine=&name=&page=&ttl=',
        'GET /forum-thread?url=&q=&engine=&page=',
      ],
      knownForums: Object.keys(AU_FORUMS),
      automation: {
        cronSchedule: '0 21 * * *',
        cronDescription: 'Daily at 7am AEST',
        manualTrigger: 'GET /collect?topics=housing,Albanese,...',
        statusCheck:   'GET /collect-status',
        historyCheck:  'GET /collect-history?limit=10',
      },
    });
  },

  // Cron Trigger entry point — called by Cloudflare scheduler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};


// ══════════════════════════════════════════════════════════════════════════════
// CRON TRIGGER HANDLER
// Runs automatically on the schedule defined in wrangler.toml:
//   [triggers]
//   crons = ["0 */6 * * *"]   ← every 6 hours
//   crons = ["0 21 * * *"]    ← daily at 7am AEST (21:00 UTC)
// ══════════════════════════════════════════════════════════════════════════════
async function handleScheduled(env) {
  console.log('AXIOM Auto-Collect triggered at', new Date().toISOString());

  // Default watchlist topics — overridable via KV
  const savedTopics = await kvGet(env.AXIOM_KV, 'auto_watchlist');
  const topics = savedTopics
    ? JSON.parse(savedTopics)
    : ['housing crisis','cost of living','Albanese','Dutton','Greens climate','Medicare','AUKUS','immigration','nuclear energy','RBA rates'];

  // Build a fake request to re-use the /collect handler
  const fakeReq = new Request(
    `https://axiom-worker/collect?topics=${encodeURIComponent(topics.join(','))}`,
    { method: 'GET' }
  );

  // Re-run the collect route
  const fakeEnv = env;
  const url  = new URL(fakeReq.url);
  const path = url.pathname;
  const q    = url.searchParams.get('q') || '';

  // Inline the collect logic (can't call the full fetch handler recursively in CF)
  const topicsArr = url.searchParams.get('topics')
    ? url.searchParams.get('topics').split(',').map(t => t.trim()).filter(Boolean)
    : topics;

  const jobId    = 'job_' + Date.now();
  const started  = new Date().toISOString();
  const results  = {};
  let   totalItems = 0;

  await kvPut(env.AXIOM_KV, 'auto_job_latest', JSON.stringify({
    jobId, status: 'running', started, topics: topicsArr, totalItems: 0,
  }), 86400);

  for (const topic of topicsArr.slice(0, 8)) {
    const items = [];
    const encoded = encodeURIComponent(topic);

    // HackerNews
    try {
      const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encoded}+australia&tags=story&hitsPerPage=5`,
        { headers: { 'User-Agent': 'AXIOM-Cron/4.0' } });
      if (r.ok) { const d = await r.json(); (d.hits||[]).forEach(h => items.push({ src:'hn', text:h.title, author:h.author, score:h.points||0, url:`https://news.ycombinator.com/item?id=${h.objectID}`, date:h.created_at, topic })); }
    } catch {}

    // Reddit
    for (const sr of ['AustralianPolitics','australia','AusFinance']) {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sr}/search.json?q=${encoded}&sort=top&limit=5&restrict_sr=on&t=week`,
          { headers: { 'User-Agent': 'AXIOM-Cron/4.0' } });
        if (r.ok) { const d = await r.json(); (d?.data?.children||[]).forEach(p => items.push({ src:'reddit', sr, text:p.data.title+(p.data.selftext?' — '+p.data.selftext.slice(0,200):''), author:p.data.author, score:p.data.score, url:'https://reddit.com'+p.data.permalink, date:new Date(p.data.created_utc*1000).toISOString(), topic })); }
      } catch {}
    }

    // Guardian
    if (env.GUARDIAN_KEY) {
      try {
        const r = await fetch(`https://content.guardianapis.com/search?q=${encoded}&tag=australia-news%2Faustralia-news&page-size=5&api-key=${env.GUARDIAN_KEY}`);
        if (r.ok) { const d = await r.json(); (d?.response?.results||[]).forEach(a => items.push({ src:'guardian', text:a.webTitle, author:'Guardian AU', score:0, url:a.webUrl, date:a.webPublicationDate, topic })); }
      } catch {}
    }

    results[topic] = items;
    totalItems += items.length;
    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
  }

  // Sentiment summary
  const topicSummary = {};
  for (const [topic, items] of Object.entries(results)) {
    const c = { pos:0, neg:0, neu:0 };
    items.forEach(i => { const s = quickSentiment(i.text); c[s] = (c[s]||0)+1; });
    topicSummary[topic] = { count: items.length, sentiment: c, dominant: Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||'neu' };
  }

  const jobResult = {
    jobId, status:'complete', started, finished:new Date().toISOString(),
    topics:topicsArr, totalItems, topicSummary,
    items: Object.values(results).flat().slice(0, 500),
  };

  await kvPut(env.AXIOM_KV, 'auto_job_latest',   JSON.stringify(jobResult), 86400);
  await kvPut(env.AXIOM_KV, 'auto_job_'+jobId,   JSON.stringify(jobResult), 604800);
  await kvPut(env.AXIOM_KV, 'auto_last_run_ts',  started,                   86400);

  // Refresh RSS caches
  for (const [key, url] of Object.entries({ abc:'https://www.abc.net.au/news/feed/51120/rss.xml', guardian:'https://www.theguardian.com/australia-news/rss', sbs:'https://www.sbs.com.au/news/feed' })) {
    try { const r=await fetch(url,{headers:{'User-Agent':'AXIOM-Cron/4.0'}});if(r.ok){const xml=await r.text();const items=[...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m=>{const b=m[1];return{title:stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]||'')),link:(b.match(/<link[^>]*href="([^"]+)"/)??b.match(/<link[^>]*>(https?[^<]+)<\/link>/)??[])[1]?.trim(),date:(b.match(/<pubDate>([\s\S]*?)<\/pubDate>/)??[])[1]?.trim()};}).filter(i=>i.title);await kvPut(env.AXIOM_KV,'rss_'+key,JSON.stringify({items}),3600);} } catch {}
  }

  console.log(`AXIOM Cron complete: ${totalItems} items across ${topicsArr.length} topics`);
}


