/**
 * +==========================================================================+
 * |  AXIOM v4 - CLOUDFLARE WORKER                                           |
 * |  Deploy: wrangler deploy                                                |
 * +==========================================================================+
 * |  wrangler.toml:                                                         |
 * |    name = "axiom-proxy"                                                 |
 * |    main = "axiom-worker-v3.js"                                          |
 * |    compatibility_date = "2024-01-01"                                    |
 * |    [vars]                                                               |
 * |    GUARDIAN_KEY = "your_guardian_api_key"                               |
 * |    [[kv_namespaces]]                                                    |
 * |    binding = "AXIOM_KV"                                                 |
 * |    id = "your_kv_namespace_id"                                          |
 * +==========================================================================+
 * |  EXISTING ROUTES (v2 - unchanged):                                      |
 * |  GET /reddit?q=&sr=           Reddit search proxy (CORS fix)            |
 * |  GET /reddit-comments?p=      Reddit post comments proxy                |
 * |  GET /guardian?q=             Guardian AU API                           |
 * |  GET /rss?feed=               Single AU feed from AU_FEEDS (KV 10min)    |
 * |  GET /allnews?q=&max=&hours=  Aggregate 50+ AU news feeds (news, finance,|
 * |                &debug=1       econ, think-tanks, topical sweeps) merged, |
 * |                               keyword-filtered, ISO dates + age(min),   |
 * |                               freshness window, wire-copy dedupe, party |
 * |                               + tone enrichment, feed circuit breaker,  |
 * |                               stale-while-revalidate (KV 4min).         |
 * |                               debug=1 -> per-feed {ok,status,count,ms}.  |
 * |  GET /history                 Accumulated pulse time series - hourly    |
 * |                               per-party share-of-voice + tone points,   |
 * |                               built by cron + lazy request-path snap-   |
 * |                               shots (KV, ~16 days of hourly points).    |
 * |  GET /analysis?hours=        Election & sentiment read - share-of-voice |
 * |                               x tone x momentum -> per-party leaderboard |
 * |                               + plain-English read (media-signal, not a |
 * |                               poll). Computed from /allnews + /history.  |
 * |  GET /census?region=         ABS 2021 Census indicators (national +     |
 * |                               states) for demographic grounding.        |
 * |  POST /clickup               Create a ClickUp task from a flagged story |
 * |                               (CLICKUP_TOKEN + CLICKUP_LIST_ID secrets).|
 * |  GET /newsq?q=&hours=&max=    Topical Google News AU search - covers    |
 * |                               every outlet Google indexes, when: window,|
 * |                               outlet extraction, enrichment (KV 5min).  |
 * |  GET /whirlpool?q=            Whirlpool forum scrape                    |
 * |  GET /bigfooty?q=             BigFooty AU Politics forum scrape         |
 * |  GET /hotcopper?q=            HotCopper Politics board scrape           |
 * |  GET /ozpolitic?q=            OzPolitic YaBB forum scrape               |
 * |  GET /ozpolitic-rss           OzPolitic RSS recent posts                |
 * +==========================================================================+
 * |  NEW ROUTES (v3):                                                       |
 * |  GET /forum?url=&q=&engine=   Universal forum scraper - auto-detects    |
 * |                               vBulletin, XenForo, phpBB, MyBB, Discourse|
 * |                               or pass engine= to force a specific one   |
 * |                                                                         |
 * |  GET /forum-thread?url=&q=    Scrape full thread posts from any forum   |
 * |                               engine (vBulletin / XenForo / phpBB etc.) |
 * |                                                                         |
 * |  GET /forum-detect?url=       Detect forum engine at a URL and return   |
 * |                                                                         |
 * |  V6 POLITICAL INTELLIGENCE ROUTES (all keyless except /tvfy):           |
 * |  GET /trends?geo=AU                Google Trends - trending searches    |
 * |  GET /social?tag=&net=             Social pulse: Mastodon + Reddit +    |
 * |                                    Bluesky merged (net=all|mastodon|    |
 * |                                    reddit|bsky), keyless, fail-soft     |
 * |  GET /forums?q=                    Forum pulse: OzPolitic + Whirlpool + |
 * |                                    BigFooty + HotCopper in one call     |
 * |  GET /gdelt?q=&mode=&timespan=     GDELT news volume/tone/articles      |
 * |  GET /wiki?article=&days=          Wikipedia pageview attention          |
 * |  GET /tvfy?q=                      TheyVoteForYou MP records            |
 * |                                    (secret: TVFY_KEY, free)             |
 * |                               metadata: engine, version, name, icon     |
 * |                                                                         |
 * |  Known AU vBulletin forums pre-registered (pass name= param):          |
 * |    aus-politics, productreview-politics, priceSpy,                      |
 * |    womensweekly, essentialbaby, globaloffensive-au,                     |
 * |    auspol-forum, aussiestock, ausforum                                  |
 * +==========================================================================+
 */

// ==============================================================================
// SHARED HELPERS
// ==============================================================================

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

// Standard headers that mimic a real browser - helps avoid 403s on forums
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

/** Strip HTML tags, decode entities, collapse whitespace.
    NOTE: &amp; must decode LAST or double-encoded input (&amp;lt;) decodes
    twice and re-introduces markup characters. */
function stripHtml(s = '') {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Australian news / politics RSS + Atom feed registry.
 * Shared by the /rss (single feed) and /allnews (aggregate) routes.
 * Feeds that 404 or block bots are skipped gracefully by /allnews.
 */
const AU_FEEDS = {
  // -- Public broadcasters --
  abc:           'https://www.abc.net.au/news/feed/51120/rss.xml',        // ABC Politics
  abc_top:       'https://www.abc.net.au/news/feed/2942460/rss.xml',      // ABC Top Stories
  sbs:           'https://www.sbs.com.au/news/feed',
  // -- Nine mastheads --
  smh:           'https://www.smh.com.au/rss/feed.xml',
  smh_pol:       'https://www.smh.com.au/rss/politics/federal.xml',
  theage:        'https://www.theage.com.au/rss/feed.xml',
  brisbanetimes: 'https://www.brisbanetimes.com.au/rss/feed.xml',
  watoday:       'https://www.watoday.com.au/rss/feed.xml',
  afr:           'https://www.afr.com/rss/feed.xml',
  // -- Guardian Australia --
  guardian:      'https://www.theguardian.com/australia-news/rss',
  guardian_pol:  'https://www.theguardian.com/australia-news/australian-politics/rss',
  // -- Independent / analysis --
  conversation:  'https://theconversation.com/au/articles.atom',
  crikey:        'https://www.crikey.com.au/feed/',
  newdaily:      'https://thenewdaily.com.au/feed/',
  michaelwest:   'https://michaelwest.com.au/feed/',
  independentau: 'https://independentaustralia.net/feed/',
  menadue:       'https://johnmenadue.com/feed/',
  saturdaypaper: 'https://www.thesaturdaypaper.com.au/feed',
  junkee:        'https://junkee.com/feed',
  // -- News Corp / wire --
  newscomau:     'https://www.news.com.au/content-feeds/latest-news-national/',
  aap:           'https://www.aap.com.au/feed/',
  // -- Regional --
  canberratimes: 'https://www.canberratimes.com.au/rss.xml',
  indaily:       'https://www.indaily.com.au/feed',
  // -- Politics-focused additions (v7) --
  pollbludger:   'https://www.pollbludger.net/feed/',                     // polling analysis
  mandarin:      'https://www.themandarin.com.au/feed/',                  // public sector / govt
  theshot:       'https://theshot.net.au/feed/',
  womensagenda:  'https://womensagenda.com.au/feed/',
  miragenews:    'https://www.miragenews.com/feed/',                      // AU newswire
  theklaxon:     'https://theklaxon.com.au/feed/',                        // investigative
  convo_pol:     'https://theconversation.com/au/politics/articles.atom',
  monthly:       'https://www.themonthly.com.au/rss.xml',
  // -- Finance / economy with a political nexus (v8) --
  macrobusiness: 'https://www.macrobusiness.com.au/feed/',                  // macro/econ/housing analysis
  convo_business:'https://theconversation.com/au/business/articles.atom',   // business & economy
  abc_business:  'https://www.abc.net.au/news/feed/51892/rss.xml',          // ABC Business
  guardian_biz:  'https://www.theguardian.com/business/australian-economy/rss', // Guardian AU economy
  smartcompany:  'https://www.smartcompany.com.au/feed/',                   // SME / business policy
  investordaily: 'https://www.investordaily.com.au/feed',                   // funds / super / regulation
  // -- Economic institutions & official releases --
  rba:           'https://www.rba.gov.au/rss/rss-cb-media-releases.xml',    // Reserve Bank media releases
  // -- Think-tanks & policy institutes --
  lowy:          'https://www.lowyinstitute.org/the-interpreter/rss.xml',   // foreign policy / Interpreter
  grattan:       'https://grattan.edu.au/feed/',                            // Grattan Institute
  ausinstitute:  'https://australiainstitute.org.au/feed/',                 // The Australia Institute
  insidestory:   'https://insidestory.org.au/feed/',                        // policy long-form
  // -- Google News AU topical sweeps - wide recall on politics-adjacent themes --
  gnews_auspol:  'https://news.google.com/rss/search?q=australian%20politics&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_parl:    'https://news.google.com/rss/search?q=federal%20parliament%20canberra&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_econ:    'https://news.google.com/rss/search?q=australia%20federal%20budget%20OR%20treasury%20OR%20economy%20politics&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_rates:   'https://news.google.com/rss/search?q=RBA%20interest%20rates%20OR%20inflation%20australia&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_jobs:    'https://news.google.com/rss/search?q=australia%20unemployment%20OR%20wages%20OR%20jobs%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_ir:      'https://news.google.com/rss/search?q=australia%20industrial%20relations%20OR%20union%20OR%20fair%20work&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_housing: 'https://news.google.com/rss/search?q=australia%20housing%20policy%20OR%20negative%20gearing%20OR%20rent&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_energy:  'https://news.google.com/rss/search?q=australia%20energy%20policy%20OR%20climate%20OR%20nuclear%20politics&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_immig:   'https://news.google.com/rss/search?q=australia%20immigration%20OR%20migration%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_states:  'https://news.google.com/rss/search?q=australia%20state%20politics%20premier%20OR%20state%20budget&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_election:'https://news.google.com/rss/search?q=australia%20election%20OR%20newspoll%20OR%20preferred%20prime%20minister&hl=en-AU&gl=AU&ceid=AU:en',
  // -- Regional dailies (ACM network) - the regional read the metro press misses (v9) --
  newcastleher:  'https://www.newcastleherald.com.au/rss.xml',
  illawarramerc: 'https://www.illawarramercury.com.au/rss.xml',
  examiner:      'https://www.examiner.com.au/rss.xml',                    // Launceston
  bordermail:    'https://www.bordermail.com.au/rss.xml',                  // Albury-Wodonga
  bendigoadv:    'https://www.bendigoadvertiser.com.au/rss.xml',
  // -- Official / primary sources --
  pmo:           'https://www.pm.gov.au/rss.xml',                          // PM media releases
  apo:           'https://apo.org.au/rss.xml',                             // Analysis & Policy Observatory
  // -- Topical sweeps (v9) - defence, health, indigenous affairs, regions,
  //    and the tax / resources themes AXIOM's clients live in --
  gnews_defence: 'https://news.google.com/rss/search?q=australia%20defence%20OR%20aukus%20OR%20adf%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_health:  'https://news.google.com/rss/search?q=australia%20medicare%20OR%20ndis%20OR%20health%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_indig:   'https://news.google.com/rss/search?q=australia%20indigenous%20OR%20closing%20the%20gap%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_regions: 'https://news.google.com/rss/search?q=regional%20australia%20OR%20agriculture%20OR%20drought%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_tax:     'https://news.google.com/rss/search?q=australia%20tax%20reform%20OR%20fuel%20tax%20credits%20OR%20superannuation%20tax&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_mining:  'https://news.google.com/rss/search?q=australia%20mining%20OR%20critical%20minerals%20OR%20resources%20policy&hl=en-AU&gl=AU&ceid=AU:en',
  // -- Commercial wire (v10) --
  ninenews:      'https://www.9news.com.au/rss',
  // -- Client-issue sweeps (v10) - narrow, high-signal queries on the exact
  //    fights AXIOM's clients are in; archived permanently by the D1 layer --
  gnews_fueltax: 'https://news.google.com/rss/search?q=%22fuel%20tax%20credit%22%20OR%20%22diesel%20rebate%22%20australia&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_minerals:'https://news.google.com/rss/search?q=%22critical%20minerals%22%20australia%20reserve%20OR%20agreement%20OR%20strategy&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_super:   'https://news.google.com/rss/search?q=australia%20superannuation%20policy%20OR%20%22payday%20super%22&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_col:     'https://news.google.com/rss/search?q=australia%20%22cost%20of%20living%22%20relief%20OR%20policy&hl=en-AU&gl=AU&ceid=AU:en',
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

/** -- Item enrichment: party tagging + naive headline tone --------------- */
const PARTY_RES = {
  alp: /\b(labor|albanese|alp|chalmers|plibersek|marles|wong)\b/i,
  lnp: /\b(coalition|liberal(s)?|nationals?|ley|littleproud|taylor|dutton|lnp)\b/i,
  grn: /\b(greens?|bandt|waters|hanson-young)\b/i,
  ind: /\b(teal(s)?|independents?|pocock|crossbench)\b/i,
  on:  /\b(one nation|hanson|pauline)\b/i,
};
const TONE_POS = /\b(win|wins|boost|surge|gain|deal|success|approve|backs?|support|relief|record high|breakthrough|praised?)\b/i;
const TONE_NEG = /\b(crisis|scandal|slam(s|med)?|fail(s|ure)?|blast(s|ed)?|anger|fury|chaos|resign|corrupt|attack(s|ed)?|warn(s|ing)?|cuts?|collapse|probe|leak)\b/i;
function enrichItem(it) {
  const hay = it.title + ' ' + (it.desc || '');
  const parties = [];
  for (const k in PARTY_RES) if (PARTY_RES[k].test(hay)) parties.push(k);
  if (parties.length) it.parties = parties;
  it.tone = TONE_NEG.test(hay) ? -1 : TONE_POS.test(hay) ? 1 : 0;
  return it;
}

/** Party display metadata for the /analysis election read. */
const PARTY_META = {
  alp: { name: 'Labor',              tag: 'Government'  },
  lnp: { name: 'Coalition',          tag: 'Opposition' },
  grn: { name: 'Greens',             tag: 'Minor'      },
  ind: { name: 'Independents/Teals', tag: 'Crossbench' },
  on:  { name: 'One Nation',         tag: 'Minor'      },
};

/**
 * -- ABS Census reference data (2021 Census of Population and Housing) ----
 * Latest published national census (next full count: 2026). Compact set of
 * politically-salient indicators per region, used to ground the Analyst and
 * the election read in real demographics. Source: Australian Bureau of
 * Statistics, 2021 Census QuickStats. Counts are point-in-time Census counts.
 */
const CENSUS = {
  au:  { name: 'Australia',                    population: 25422788, median_age: 38, median_hh_income_wk: 1746, median_rent_wk: 375, median_mortgage_mth: 1863, born_overseas_pct: 27.6, owned_outright_pct: 31.0, mortgage_pct: 35.0, rented_pct: 30.6, other_lang_home_pct: 22.8, no_religion_pct: 38.9, top_ancestry: 'English', seats_hor: 151 },
  nsw: { name: 'New South Wales',              population: 8072163,  median_age: 39, median_hh_income_wk: 1829, median_rent_wk: 420, median_mortgage_mth: 1986, born_overseas_pct: 29.3, owned_outright_pct: 32.2, mortgage_pct: 32.3, rented_pct: 31.6, other_lang_home_pct: 27.5, no_religion_pct: 32.8, top_ancestry: 'English', seats_hor: 47 },
  vic: { name: 'Victoria',                     population: 6503491,  median_age: 38, median_hh_income_wk: 1759, median_rent_wk: 400, median_mortgage_mth: 1897, born_overseas_pct: 29.9, owned_outright_pct: 30.4, mortgage_pct: 35.1, rented_pct: 30.4, other_lang_home_pct: 30.4, no_religion_pct: 39.1, top_ancestry: 'English', seats_hor: 39 },
  qld: { name: 'Queensland',                   population: 5156138,  median_age: 38, median_hh_income_wk: 1660, median_rent_wk: 380, median_mortgage_mth: 1758, born_overseas_pct: 22.6, owned_outright_pct: 29.4, mortgage_pct: 36.2, rented_pct: 32.0, other_lang_home_pct: 13.1, no_religion_pct: 41.2, top_ancestry: 'Australian', seats_hor: 30 },
  wa:  { name: 'Western Australia',            population: 2660026,  median_age: 38, median_hh_income_wk: 1815, median_rent_wk: 380, median_mortgage_mth: 2058, born_overseas_pct: 32.2, owned_outright_pct: 28.4, mortgage_pct: 39.1, rented_pct: 28.9, other_lang_home_pct: 18.0, no_religion_pct: 43.6, top_ancestry: 'English', seats_hor: 15 },
  sa:  { name: 'South Australia',              population: 1781516,  median_age: 40, median_hh_income_wk: 1548, median_rent_wk: 330, median_mortgage_mth: 1520, born_overseas_pct: 24.0, owned_outright_pct: 33.7, mortgage_pct: 33.5, rented_pct: 29.6, other_lang_home_pct: 16.8, no_religion_pct: 44.6, top_ancestry: 'Australian', seats_hor: 10 },
  tas: { name: 'Tasmania',                     population: 557571,   median_age: 42, median_hh_income_wk: 1388, median_rent_wk: 320, median_mortgage_mth: 1517, born_overseas_pct: 15.3, owned_outright_pct: 34.9, mortgage_pct: 32.3, rented_pct: 28.9, other_lang_home_pct: 8.9,  no_religion_pct: 46.9, top_ancestry: 'Australian', seats_hor: 5 },
  act: { name: 'Australian Capital Territory', population: 454499,   median_age: 35, median_hh_income_wk: 2373, median_rent_wk: 470, median_mortgage_mth: 2318, born_overseas_pct: 30.5, owned_outright_pct: 25.9, mortgage_pct: 39.5, rented_pct: 31.5, other_lang_home_pct: 22.7, no_religion_pct: 43.5, top_ancestry: 'English', seats_hor: 3 },
  nt:  { name: 'Northern Territory',           population: 232605,   median_age: 34, median_hh_income_wk: 2076, median_rent_wk: 410, median_mortgage_mth: 2044, born_overseas_pct: 21.0, owned_outright_pct: 20.6, mortgage_pct: 32.6, rented_pct: 42.9, other_lang_home_pct: 27.2, no_religion_pct: 39.9, top_ancestry: 'Australian', seats_hor: 2 },
};

/** -- Circuit breaker: skip feeds that keep failing (KV-persisted) ------- */
const CB_THRESHOLD = 4;              // consecutive failures before tripping
const CB_COOLDOWN  = 4 * 3600000;    // stay tripped for 4 hours
async function cbLoad(kv)  { try { return JSON.parse(await kvGet(kv, 'feed_cb') || '{}') || {}; } catch { return {}; } }
async function cbSave(kv, cb) { await kvPut(kv, 'feed_cb', JSON.stringify(cb), 86400); }

/**
 * Concurrency-limited map. Cloudflare Workers cap simultaneous outbound
 * connections (~6), so firing 50+ fetches at once leaves most queued while
 * their per-request timeout is already counting down - they abort before
 * ever connecting. Running a small pool means each task's timer only starts
 * when a connection slot is actually free. `fn` must never throw.
 */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
const FEED_POOL = 6;        // matches CF's simultaneous-connection ceiling
const FEED_TIMEOUT = 5000;  // per-feed abort; repeat offenders get circuit-broken

/**
 * Build the aggregated AU news payload. Shared by the /allnews route, the
 * stale-while-revalidate background refresh, and the cron pre-warm.
 * Returns the JSON string (and writes it to KV unless debug).
 */
async function buildAllNews(env, { q = '', max = 60, hours = 72, debug = false } = {}) {
  const qw  = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const cacheKey = `allnews2_${q || 'all'}_${max}_${hours}`;
  const now  = Date.now();
  const keys = Object.keys(AU_FEEDS);
  const cb   = await cbLoad(env.AXIOM_KV);
  const health = [];

  // Pooled fetch - respect CF's connection ceiling so timers stay honest.
  const results = await mapPool(keys, FEED_POOL, async (key) => {
    const trip = cb[key];
    if (!debug && trip && trip.n >= CB_THRESHOLD && now - trip.t < CB_COOLDOWN) {
      health.push({ src: key, ok: false, skipped: true, fails: trip.n, ms: 0 });
      return [];
    }
    const t0 = Date.now();
    try {
      const r = await fetch(AU_FEEDS[key], {
        headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*' },
        signal: AbortSignal.timeout ? AbortSignal.timeout(FEED_TIMEOUT) : undefined,
        cf: { cacheTtl: 120, cacheEverything: true },
      });
      if (!r.ok) { health.push({ src: key, ok: false, status: r.status, ms: Date.now() - t0 }); return []; }
      const xml   = await r.text();
      const items = parseFeedXml(xml).map(it => ({ src: key, ...it }));
      health.push({ src: key, ok: items.length > 0, status: r.status, count: items.length, ms: Date.now() - t0 });
      return items;
    } catch (e) {
      health.push({ src: key, ok: false, error: String(e && e.name || e).slice(0, 40), ms: Date.now() - t0 });
      return [];
    }
  });

  // Update circuit-breaker state: consecutive fails trip; any success resets.
  let cbChanged = false;
  health.forEach(h => {
    if (h.skipped) return;
    if (h.ok) { if (cb[h.src]) { delete cb[h.src]; cbChanged = true; } }
    else { cb[h.src] = { n: ((cb[h.src] || {}).n || 0) + 1, t: now }; cbChanged = true; }
  });
  if (cbChanged) await cbSave(env.AXIOM_KV, cb);

  let items = [];
  results.forEach((v) => { if (Array.isArray(v)) items.push(...v); });

  // Normalise dates -> ISO + age (minutes). Undated items keep '' and rank last.
  items.forEach(it => {
    const t = Date.parse(it.date || '');
    if (!isNaN(t)) { it.date = new Date(t).toISOString(); it.age = Math.max(0, Math.round((now - t) / 60000)); it._t = t; }
    else { it.date = ''; it.age = null; it._t = 0; }
  });

  // Freshness window: drop dated items older than `hours`; keep undated.
  const cutoff = now - hours * 3600000;
  items = items.filter(it => it._t === 0 || it._t >= cutoff);

  // keyword filter (any word matches title or description)
  if (qw.length) {
    items = items.filter(it => {
      const hay = (it.title + ' ' + (it.desc || '')).toLowerCase();
      return qw.some(w => hay.indexOf(w) !== -1);
    });
  }

  // Cross-outlet dedupe of syndicated wire copy (normalised-title key).
  const seenTitle = new Set();
  items = items.filter(it => {
    const k = it.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80);
    if (seenTitle.has(k)) return false;
    seenTitle.add(k); return true;
  });

  // Newest first (undated last), cap, enrich with parties + tone.
  items.sort((a, b) => b._t - a._t);
  items = items.slice(0, max);
  items.forEach(it => { delete it._t; enrichItem(it); });

  const sources = health.filter(h => h.ok).map(h => ({ src: h.src, count: h.count || 0 }));
  const payload = { items, sources, feeds: keys.length, generated: new Date(now).toISOString(), window_hours: hours };
  if (debug) payload.health = health.sort((a, b) => (b.ok ? 1 : 0) - (a.ok ? 1 : 0) || (b.count || 0) - (a.count || 0));
  const out = JSON.stringify(payload);
  if (!debug) await kvPut(env.AXIOM_KV, cacheKey, out, 240);
  return out;
}

/**
 * Pulse snapshot: append one time-series point (per-party share-of-voice +
 * headline tone) to KV. Self-throttles to one point per ~50 min, so it can
 * be called from cron AND lazily from request paths without duplication.
 * This is what turns AXIOM from single-window snapshots into real
 * historical trending (share-of-voice over time, tone shift, baselines).
 */
async function snapshotPulse(env) {
  let hist = [];
  try { hist = JSON.parse(await kvGet(env.AXIOM_KV, 'pulse_history') || '[]') || []; } catch {}
  const now = Date.now();
  if (hist.length && now - hist[hist.length - 1].t < 50 * 60000) return;

  const raw = await buildAllNews(env, { q: '', max: 120, hours: 24 });
  let items = [];
  try { items = JSON.parse(raw).items || []; } catch {}
  if (!items.length) return;

  const point = { t: now, tot: items.length, p: {}, tn: {} };
  ['alp', 'lnp', 'grn', 'ind', 'on'].forEach(k => {
    const its = items.filter(i => (i.parties || []).indexOf(k) !== -1);
    point.p[k]  = its.length;
    point.tn[k] = its.length ? +(its.reduce((a, b) => a + (b.tone || 0), 0) / its.length).toFixed(2) : 0;
  });
  point.tone = +(items.reduce((a, b) => a + (b.tone || 0), 0) / items.length).toFixed(2);

  hist.push(point);
  if (hist.length > 400) hist = hist.slice(-400); // ~16 days at hourly cadence
  await kvPut(env.AXIOM_KV, 'pulse_history', JSON.stringify(hist), 40 * 86400);
}

/**
 * -- Election & sentiment analysis (media-signal read) -------------------
 * Synthesises a compact, plain-English read from data AXIOM already has:
 * current AU news share-of-voice, headline tone, and pulse-history momentum.
 * Deliberately labelled a media-signal indicator, NOT a voting-intention
 * poll - it measures the shape of the coverage, not how people will vote.
 */
async function buildAnalysis(env, hours = 72) {
  const now  = Date.now();
  const keys = ['alp', 'lnp', 'grn', 'ind', 'on'];
  const raw  = await buildAllNews(env, { q: '', max: 120, hours });
  let items = []; try { items = JSON.parse(raw).items || []; } catch {}
  let hist  = []; try { hist  = JSON.parse(await kvGet(env.AXIOM_KV, 'pulse_history') || '[]') || []; } catch {}

  const tagged = items.filter(i => (i.parties || []).length).length || 1;
  const recent = hist.slice(-6), prior = hist.slice(-24, -6);
  const shareIn = (arr, k) => arr.length
    ? arr.reduce((a, p) => { const tot = keys.reduce((s, kk) => s + ((p.p || {})[kk] || 0), 0) || 1; return a + ((p.p || {})[k] || 0) / tot; }, 0) / arr.length
    : 0;

  const parties = keys.map(k => {
    const its = items.filter(i => (i.parties || []).indexOf(k) !== -1);
    const cov = its.length;
    const sov = +(100 * cov / tagged).toFixed(1);
    const sentiment = cov ? +(its.reduce((a, b) => a + (b.tone || 0), 0) / cov).toFixed(2) : 0;
    const momentum = (recent.length && prior.length)
      ? +(100 * (shareIn(recent, k) - shareIn(prior, k))).toFixed(1) : 0;
    const drivers = its.slice()
      .sort((a, b) => Math.abs(b.tone || 0) - Math.abs(a.tone || 0) || (b.age === null) - (a.age === null))
      .slice(0, 3)
      .map(i => ({ title: i.title, src: i.src, tone: i.tone || 0, link: i.link }));
    return { key: k, name: PARTY_META[k].name, tag: PARTY_META[k].tag, coverage: cov, sov, sentiment, momentum, drivers };
  });

  // Overall media sentiment + coverage-volume direction.
  const netTone = items.length ? +(items.reduce((a, b) => a + (b.tone || 0), 0) / items.length).toFixed(2) : 0;
  let volTrend = 0;
  if (recent.length && prior.length) {
    const r = recent.reduce((a, p) => a + (p.tot || 0), 0) / recent.length;
    const p = prior.reduce((a, p) => a + (p.tot || 0), 0) / prior.length;
    volTrend = p ? +(((r - p) / p) * 100).toFixed(0) : 0;
  }

  // Media-momentum leaderboard: share-of-voice tilted by tone + momentum.
  const scored = parties
    .map(p => ({ key: p.key, name: p.name, score: +(p.sov * (1 + 0.15 * p.sentiment) + 4 * p.momentum).toFixed(1) }))
    .sort((a, b) => b.score - a.score);
  const lead = scored[0], second = scored[1] || { name: '-', score: 0 };
  const gap  = +(lead.score - second.score).toFixed(1);
  const lp   = parties.find(p => p.key === lead.key) || parties[0];

  const toneWord = t => t > 0.12 ? 'favourable' : t < -0.12 ? 'hostile' : 'mixed';
  const read = lp
    ? `${lead.name} lead the media conversation on ${lp.sov}% share of political coverage with ${toneWord(lp.sentiment)} tone` +
      `${lp.momentum ? ` and ${lp.momentum > 0 ? 'rising' : 'falling'} momentum (${lp.momentum > 0 ? '+' : ''}${lp.momentum}pt)` : ''}, ` +
      `${gap < 3 ? 'narrowly ahead of' : 'clear of'} ${second.name}.`
    : 'Insufficient tagged coverage in window.';

  const payload = {
    generated: new Date(now).toISOString(),
    window_hours: hours,
    volume: { articles: items.length, tagged, trend_pct: volTrend },
    sentiment: { net: netTone, label: netTone > 0.12 ? 'net positive' : netTone < -0.12 ? 'net negative' : 'mixed/neutral' },
    parties: parties.sort((a, b) => b.sov - a.sov),
    leaderboard: scored,
    read,
    method: 'Share-of-voice x headline tone x short-run momentum over aggregated AU political news.',
    note: 'Media-signal indicator, not a voting-intention poll.',
  };
  const out = JSON.stringify(payload);
  await kvPut(env.AXIOM_KV, `analysis_${hours}`, out, 600);
  return out;
}

/** Safe fetch that never throws - returns { ok, html, status } */
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

/** Relevance filter - returns items matching any query word (len > 2) */
function relevanceFilter(items, q) {
  if (!q || items.length <= 3) return items;
  const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  if (!words.length) return items;
  const matched = items.filter(t =>
    words.some(w => (t.text || '').toLowerCase().includes(w))
  );
  return matched.length > 0 ? matched : items; // fallback to all if nothing matches
}


// ==============================================================================
// ENGINE DETECTION
// ==============================================================================

/**
 * Detects the forum engine from raw HTML.
 * Returns one of: 'vbulletin4', 'vbulletin5', 'xenforo1', 'xenforo2',
 *                 'phpbb', 'mybb', 'discourse', 'invision', 'yabb',
 *                 'smf', 'vanilla', 'unknown'
 */
function detectEngine(html) {
  const h = html.toLowerCase();

  // -- vBulletin 5 --
  // vB5 uses a React-like SPA shell with data-widget attributes
  if (h.includes('vbulletin 5') || h.includes('vb5') ||
      h.includes('data-widget="vb5') || h.includes('"vbulletin"') ||
      (h.includes('forum.showthread') && h.includes('postlist'))) {
    return 'vbulletin5';
  }

  // -- vBulletin 4 --
  // Classic vB4 has specific markers in the HTML
  if (h.includes('vbulletin') || h.includes('vb_postbit') ||
      h.includes('postcontainer') || h.includes('postbit_legacy') ||
      h.includes('threadbit') || h.includes('forumbit_post') ||
      h.includes('showthread.php') || h.includes('forumdisplay.php')) {
    return 'vbulletin4';
  }

  // -- XenForo 2 --
  if (h.includes('xenforo') || h.includes('xf-') ||
      h.includes('data-xf-') || h.includes('xenforo 2') ||
      h.includes('structitem') || h.includes('contentrow') ||
      h.includes('p-title') || h.includes('threadmarks')) {
    return 'xenforo2';
  }

  // -- XenForo 1 --
  if (h.includes('xenbase') || h.includes('xenforo 1') ||
      h.includes('.messagetext') || h.includes('messagelistitem') ||
      h.includes('primarycontent')) {
    return 'xenforo1';
  }

  // -- phpBB --
  if (h.includes('phpbb') || h.includes('viewtopic.php') ||
      h.includes('viewforum.php') || h.includes('postbody') ||
      h.includes('phpbb_') || h.includes('post-author')) {
    return 'phpbb';
  }

  // -- MyBB --
  if (h.includes('mybb') || h.includes('forumdisplay') ||
      h.includes('showthread') && h.includes('post_body') ||
      h.includes('thread_title') || h.includes('mybbuser')) {
    return 'mybb';
  }

  // -- Discourse --
  if (h.includes('discourse') || h.includes('ember-application') ||
      h.includes('d-header') || h.includes('topic-list') ||
      h.includes('data-topic-id')) {
    return 'discourse';
  }

  // -- Invision Power Board (IPB/IPS) --
  if (h.includes('ipsapp') || h.includes('ipb') ||
      h.includes('ips-forum') || h.includes('cPost') ||
      h.includes('data-ipb=') || h.includes('ipstype_')) {
    return 'invision';
  }

  // -- YaBB --
  if (h.includes('yabb') || h.includes('yabb.pl')) {
    return 'yabb';
  }

  // -- SMF (Simple Machines Forum) --
  if (h.includes('smf') || h.includes('simple machines') ||
      h.includes('smiley_holder') || h.includes('forumposts')) {
    return 'smf';
  }

  // -- Vanilla Forums --
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
  return stripHtml(m[1]).replace(/\s*[-|-]\s*.*$/, '').trim().slice(0, 80);
}


// ==============================================================================
// PER-ENGINE THREAD LIST EXTRACTORS
// Each returns an array of { text, url, author?, date?, replyCount?, views? }
// ==============================================================================

/**
 * vBulletin 4 - the engine used by:
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

  // -- 1. Thread list rows (#threads > li.threadbit) --
  const threadBitRe = /<li[^>]*class="[^"]*\bthreadbit\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of html.matchAll(threadBitRe)) {
    const block = m[1];

    // Title link - h3.threadtitle a.title  OR  a.title
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

  // -- 2. Search results (li.searchresult or div.searchresult) --
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

  // -- 3. Subforum links (forumtitle) --
  const sfRe = /<h2[^>]*class="[^"]*forumtitle[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(sfRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { type: 'subforum', engine: 'vbulletin4' });
  }

  // -- 4. Generic fallback - any showthread.php or forumdisplay.php link --
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
 * vBulletin 5 - newer SPA-style vBulletin.
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

  // -- 1. Article-based thread cards --
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

  // -- 2. .js-threadBit blocks --
  const jtRe = /<div[^>]+class="[^"]*js-threadBit[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const m of html.matchAll(jtRe)) {
    const inner = m[1];
    const linkM = inner.match(/<a[^>]+href="([^"]+)"[^>]*class="[^"]*js-title[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
               || inner.match(/<a[^>]+class="[^"]*title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'vbulletin5' });
  }

  // -- 3. JSON data island (vB5 often embeds thread data as JSON) --
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

  // -- 4. vB5 search results --
  const srRe = /<div[^>]+class="[^"]*(?:js-searchResult|searchResultItem)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  for (const m of html.matchAll(srRe)) {
    const inner = m[1];
    const linkM = inner.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'vbulletin5' });
  }

  // -- 5. Fallback to vB4 extractor (many vB5 sites still have vB4-style HTML) --
  if (threads.length < 3) {
    const vb4 = extractVB4Threads(html, baseUrl);
    vb4.forEach(t => addThread(threads, seen, t.text, t.url, { ...t, engine: 'vbulletin5' }));
  }

  return threads;
}

/**
 * XenForo 2 - used by BigFooty, many AU gaming/hobbyist forums.
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

  // -- 1. structItem thread rows --
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

    // Reply count - first dd in .pairs--justified
    const replyM = block.match(/class="[^"]*pairs[^"]*"[^>]*>[\s\S]*?<dt[^>]*>[^<]*[Rr]epli[^<]*<\/dt>\s*<dd[^>]*>([\d,]+)/i)
                || block.match(/<dl[^>]*>[\s\S]*?<dd[^>]*>([\d,]+)/i);
    const replyCount = replyM ? parseInt(replyM[1].replace(/,/g, ''), 10) || 0 : 0;

    // Date
    const dateM = block.match(/<time[^>]+datetime="([^"]+)"/i);
    const date   = dateM ? dateM[1] : '';

    addThread(threads, seen, text, url, { author, replyCount, date, engine: 'xenforo2' });
  }

  // -- 2. contentRow (search results & some listing pages) --
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

  // -- 3. Node (subforum) listings --
  const nodeRe = /<h[23][^>]+class="[^"]*node-title[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(nodeRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { type: 'subforum', engine: 'xenforo2' });
  }

  // -- 4. p-title links (XF2 thread page title breadcrumb) --
  if (threads.length < 3) {
    const ptRe = /<h1[^>]+class="[^"]*p-title-value[^"]*"[^>]*>([\s\S]*?)<\/h1>/gi;
    for (const m of html.matchAll(ptRe)) {
      addThread(threads, seen, m[1], baseUrl, { engine: 'xenforo2' });
    }
  }

  return threads;
}

/**
 * XenForo 1 - older XF1.x sites.
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

  // -- discussionListItem rows --
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

  // -- Fallback: any .title or PreviewTooltip link inside .messageList --
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
 * phpBB - one of the most common forum engines.
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

  // -- a.topictitle (works across phpBB2, 3, 3.1, 3.2, 3.3) --
  const ttRe = /<a[^>]+class="[^"]*topictitle[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(ttRe)) {
    // Extract reply count from surrounding row if possible
    // phpBB puts this in a nearby <dd> or <td>
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'phpbb' });
    if (threads.length >= 30) break;
  }

  // -- viewtopic / viewforum links (fallback) --
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
 * MyBB - used by various hobbyist and niche AU forums.
 *
 * Thread row:  tr.inline_row  inside  table#threadslist
 * Title:       strong > span.subject_bold a  OR  a.subject_bold
 * Author:      span.smalltext > a  in the "started by" column
 */
function extractMyBBThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // -- span.subject_bold a --
  const sbRe = /<span[^>]+class="[^"]*subject_bold[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(sbRe)) {
    addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'mybb' });
    if (threads.length >= 30) break;
  }

  // -- thread_title class (MyBB 1.8+) --
  if (threads.length < 3) {
    const ttRe = /<span[^>]+id="tid_\d+"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    for (const m of html.matchAll(ttRe)) {
      addThread(threads, seen, m[2], resolveUrl(m[1], baseUrl), { engine: 'mybb' });
      if (threads.length >= 20) break;
    }
  }

  // -- Fallback: showthread links --
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
 * Discourse - modern forum used by some AU councils, GovHack, tech communities.
 * Discourse is heavily JS-rendered but the topic-list is sometimes in the HTML,
 * and its JSON API (/latest.json, /search.json) is always available.
 */
function extractDiscourseThreads(html, baseUrl) {
  const threads = [];
  const seen    = new Set();

  // -- topic-list-item rows --
  const liRe = /<tr[^>]+class="[^"]*topic-list-item[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const m of html.matchAll(liRe)) {
    const block = m[1];
    const linkM = block.match(/<a[^>]+class="[^"]*title[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    addThread(threads, seen, linkM[2], resolveUrl(linkM[1], baseUrl), { engine: 'discourse' });
  }

  // -- JSON data island --
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

  // -- ipsDataItem rows --
  const diRe = /<(?:li|div)[^>]+class="[^"]*ipsDataItem[^"]*"[^>]*>([\s\S]*?)<\/(?:li|div)>/gi;
  for (const m of html.matchAll(diRe)) {
    const block = m[1];
    const linkM = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkM) continue;
    const text = stripHtml(linkM[2]);
    if (text.length < 5) continue;
    addThread(threads, seen, text, resolveUrl(linkM[1], baseUrl), { engine: 'invision' });
  }

  // -- cPost / ipsComment blocks --
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
 * Generic fallback - catches any forum engine not specifically handled.
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


// ==============================================================================
// POST EXTRACTORS - for /forum-thread route
// Returns array of { author, text, date, postId, userUrl, avatar? }
// ==============================================================================

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

    // Post body - div[id^="post_message_"] blockquote.postcontent
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

/** Generic post extractor - last resort */
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


// ==============================================================================
// URL RESOLVER
// ==============================================================================

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


// ==============================================================================
// MASTER DISPATCHER - picks the right extractor based on detected engine
// ==============================================================================

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


// ==============================================================================
// KNOWN AUSTRALIAN FORUMS REGISTRY
// Pre-configured forum URLs, categories, and search patterns
// ==============================================================================

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


// ==============================================================================
// DISCOURSE JSON API helper
// When a Discourse forum is detected, use their open JSON API directly
// ==============================================================================

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


// ==============================================================================
// WORKER ENTRY
// ==============================================================================

// ==============================================================================
// SOCIAL PULSE - multi-network ingestion (Mastodon + Reddit + Bluesky, keyless)
// Every fetcher is independently timed out and fails soft: one dead network
// never blanks the pulse. All posts normalise to one schema:
//   { id, network, author, handle, text, ups, boosts, replies, url, date }
// ==============================================================================

function abortAfter(ms) {
  try { return AbortSignal.timeout(ms); } catch { return undefined; }
}

async function socialMastodon(tag) {
  const instances = ['aus.social', 'mastodon.social'];
  const posts = [];
  await Promise.all(instances.map(async (inst) => {
    try {
      const r = await fetch('https://' + inst + '/api/v1/timelines/tag/' + tag + '?limit=20',
        { headers: { 'User-Agent': 'AXIOM/6.0' }, signal: abortAfter(6000) });
      if (!r.ok) return;
      const arr = await r.json();
      (Array.isArray(arr) ? arr : []).forEach((s) => {
        const text = stripHtml(String(s.content || '').replace(/<\/p>\s*<p>/gi, ' - '));
        if (!text) return;
        posts.push({
          id: 'm_' + s.id, network: 'mastodon',
          author: (s.account && (s.account.display_name || s.account.username)) || 'unknown',
          handle: (s.account && s.account.acct) || inst,
          text: text.slice(0, 400),
          ups: s.favourites_count || 0, boosts: s.reblogs_count || 0, replies: s.replies_count || 0,
          url: s.url, date: s.created_at,
        });
      });
    } catch {}
  }));
  return posts;
}

/** Subreddit routing per pulse tag - falls back to the AU politics pair. */
const REDDIT_SUBS = {
  auspol:    'AustralianPolitics+australia',
  australia: 'australia+AustralianPolitics',
  economy:   'AusFinance+AusEcon+AustralianPolitics',
  housing:   'AusProperty+AusFinance+shitrentals',
  climate:   'AustralianPolitics+australia',
};
async function socialReddit(tag) {
  const subs = REDDIT_SUBS[tag] || REDDIT_SUBS.auspol;
  const posts = [];
  try {
    // api.reddit.com + descriptive UA: the www host 403s generic cloud UAs.
    const r = await fetch('https://api.reddit.com/r/' + subs + '/hot?limit=30&raw_json=1',
      { headers: { 'User-Agent': 'axiom-au-intel/1.0 (AU political media dashboard)' }, signal: abortAfter(6000) });
    if (!r.ok) return posts;
    const d = await r.json();
    const kids = (d && d.data && d.data.children) || [];
    const kw = REDDIT_SUBS[tag] ? null : tag.toLowerCase();
    kids.forEach((c) => {
      const p = c && c.data; if (!p || p.stickied || p.pinned) return;
      const text = (p.title || '') + (p.selftext ? ' - ' + p.selftext : '');
      if (kw && !text.toLowerCase().includes(kw)) return;
      posts.push({
        id: 'r_' + p.id, network: 'reddit',
        author: 'u/' + (p.author || 'unknown'), handle: 'r/' + (p.subreddit || ''),
        text: stripHtml(text).slice(0, 400),
        ups: p.score || 0, boosts: 0, replies: p.num_comments || 0,
        url: 'https://www.reddit.com' + (p.permalink || ''), date: new Date((p.created_utc || 0) * 1000).toISOString(),
      });
    });
  } catch {}
  return posts;
}

async function socialBsky(tag) {
  const posts = [];
  try {
    // Public AppView search - no auth required.
    const r = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=' +
      encodeURIComponent('#' + tag) + '&limit=25&sort=latest',
      { headers: { 'User-Agent': 'AXIOM/6.0' }, signal: abortAfter(6000) });
    if (!r.ok) return posts;
    const d = await r.json();
    ((d && d.posts) || []).forEach((p) => {
      const rec = p.record || {}, au = p.author || {};
      const rkey = String(p.uri || '').split('/').pop();
      if (!rec.text) return;
      posts.push({
        id: 'b_' + rkey, network: 'bsky',
        author: au.displayName || au.handle || 'unknown', handle: au.handle || '',
        text: stripHtml(String(rec.text)).slice(0, 400),
        ups: p.likeCount || 0, boosts: p.repostCount || 0, replies: p.replyCount || 0,
        url: au.handle && rkey ? 'https://bsky.app/profile/' + au.handle + '/post/' + rkey : '',
        date: rec.createdAt || p.indexedAt,
      });
    });
  } catch {}
  return posts;
}

// ==============================================================================
// FORUM PULSE - one-call aggregate of the AU political forum scrapers.
// Lean primary-strategy fetchers (the per-site routes keep their full
// multi-fallback versions); everything fails soft with per-source status.
// ==============================================================================

async function forumOzRss() {
  const { ok, html } = await safeFetch('https://www.ozpolitic.com/forum/YaBB.pl?action=RSSrecent',
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,text/xml,*/*' }, signal: abortAfter(6500) });
  if (!ok) return [];
  return [...html.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12).map(m => {
    const b = m[1];
    const title = stripHtml((b.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/) || [])[1] || '');
    const link = ((b.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || [])[1] || '').trim();
    const date = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    return { text: title, url: link, date, source: 'OzPolitic' };
  }).filter(t => t.text);
}

async function forumWhirlpoolQ(q) {
  const { ok, html } = await safeFetch('https://forums.whirlpool.net.au/search?q=' + encodeURIComponent(q) + '&forum=0',
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html' }, signal: abortAfter(6500) });
  if (!ok) return [];
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<a[^>]+href="(\/archive\/\d+\/[^"]+|\/thread\/[^"]+)"[^>]*>([^<]{8,})<\/a>/g)) {
    addThread(out, seen, m[2], 'https://forums.whirlpool.net.au' + m[1], { source: 'Whirlpool' });
    if (out.length >= 10) break;
  }
  return out;
}

async function forumBigfootyLatest() {
  const { ok, html } = await safeFetch('https://www.bigfooty.com/forum/forums/australian-politics.229/',
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Referer': 'https://www.bigfooty.com/' }, signal: abortAfter(6500) });
  if (!ok) return [];
  const out = [], seen = new Set();
  for (const m of html.matchAll(/<a[^>]+href="(https:\/\/www\.bigfooty\.com\/forum\/threads\/[^"?#]+|\/forum\/threads\/[^"?#]+)"[^>]*(?:data-tp-primary="on"[^>]*)?>([\s\S]{6,140}?)<\/a>/g)) {
    const href = m[1].startsWith('http') ? m[1] : 'https://www.bigfooty.com' + m[1];
    addThread(out, seen, m[2], href, { source: 'BigFooty' });
    if (out.length >= 10) break;
  }
  return out;
}

async function forumHotcopperLatest() {
  const { ok, html } = await safeFetch('https://hotcopper.com.au/discussions/politics/',
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html', 'Referer': 'https://hotcopper.com.au/' }, signal: abortAfter(6500) });
  if (!ok) return [];
  const out = [], seen = new Set();
  for (const m of html.matchAll(/href="(\/threads\/[^"?#]+)"[^>]*>([\s\S]{8,140}?)<\/a>/g)) {
    addThread(out, seen, m[2], 'https://hotcopper.com.au' + m[1], { source: 'HotCopper' });
    if (out.length >= 10) break;
  }
  return out;
}

// ==============================================================================
// PERMANENT ARCHIVE (D1) - nothing the wire sees is ever lost again.
// Reuses the MIND_DB binding (axiom-mind-db). Every news item, social post,
// forum thread, trend snapshot, fetched reference page and AI conversation
// turn is written here, deduplicated by (kind, url). All writers fail soft:
// with no D1 bound, AXIOM behaves exactly as before.
// ==============================================================================
let ARC_READY = false;
function arcHash(s) { let h = 5381; s = String(s || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
async function ensureArchive(env) {
  if (!env.MIND_DB) return false;
  if (ARC_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS arc_items(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, src TEXT, title TEXT, body TEXT, url TEXT, author TEXT, tone REAL, meta TEXT, ts INTEGER, seen INTEGER)'),
    env.MIND_DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS arc_items_kurl ON arc_items(kind, url)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_items_ts ON arc_items(ts)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_items_src ON arc_items(src)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS arc_convo(id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT, surface TEXT, client TEXT, role TEXT, body TEXT, ts INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_convo_sid ON arc_convo(sid)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_convo_ts ON arc_convo(ts)'),
  ]);
  ARC_READY = true;
  return true;
}
async function archiveItems(env, kind, rows) {
  try {
    if (!rows || !rows.length) return 0;
    if (!(await ensureArchive(env))) return 0;
    const now = Date.now();
    const stmt = env.MIND_DB.prepare(
      'INSERT INTO arc_items(kind,src,title,body,url,author,tone,meta,ts,seen) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(kind,url) DO NOTHING');
    const batch = rows.slice(0, 150).map(r => stmt.bind(
      kind,
      String(r.src || '').slice(0, 60),
      String(r.title || '').slice(0, 500),
      String(r.body || '').slice(0, 6000),
      String(r.url || ('x:' + kind + ':' + arcHash((r.src || '') + '|' + (r.title || '') + '|' + (r.body || '')))).slice(0, 700),
      String(r.author || '').slice(0, 140),
      typeof r.tone === 'number' ? r.tone : null,
      r.meta ? JSON.stringify(r.meta).slice(0, 1500) : null,
      r.ts || now,
      now));
    await env.MIND_DB.batch(batch);
    return batch.length;
  } catch (e) { return 0; }
}
/** Archive an /allnews snapshot (the JSON string buildAllNews returns). */
async function arcNewsSnap(env, jsonStr) {
  try {
    const d = JSON.parse(jsonStr);
    return archiveItems(env, 'news', (d.items || []).map(it => ({
      src: it.src, title: it.title, body: it.desc, url: it.link, tone: it.tone,
      meta: it.parties && it.parties.length ? { parties: it.parties } : null,
      ts: Date.parse(it.date) || 0,
    })));
  } catch (e) { return 0; }
}
/** Escape LIKE wildcards in user queries. */
function arcLike(q) { return '%' + String(q).replace(/[%_\\]/g, c => '\\' + c) + '%'; }

export default {
  async fetch(req, env, ctx) {
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

    // ==========================================================================
    // V5 ROUTES - POLITICAL INTELLIGENCE
    // ==========================================================================

    // Google Trends - what Australia is searching right now (free RSS, no key)
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
        if (ctx) {
          const day = new Date().toISOString().slice(0, 10); // one row per term per day
          ctx.waitUntil(archiveItems(env, 'trend', items.map(t => ({
            src: 'gtrends', title: t.term, body: t.newsTitle, url: 'trend:' + geo + ':' + day + ':' + t.term.toLowerCase(),
            meta: { traffic: t.traffic, newsUrl: t.newsUrl, newsSource: t.newsSource },
          }))).catch(() => {}));
        }
        return new Response(out, { headers: CORS });
      } catch (e) { return jsonResp({ error: 'trends_fetch_failed', detail: String(e) }, 502); }
    }

    // Social pulse - Mastodon + Reddit + Bluesky merged (all keyless).
    // ?net=all|mastodon|reddit|bsky filters networks; every fetcher fails soft.
    if (path === '/social') {
      const tag = (reqUrl.searchParams.get('tag') || 'auspol').replace(/[^\w]/g, '');
      const net = (reqUrl.searchParams.get('net') || 'all').replace(/[^\w]/g, '');
      const cacheKey = 'social2_' + tag + '_' + net;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const want = (n) => net === 'all' || net === n;
      const [ms, rd, bs] = await Promise.all([
        want('mastodon') ? socialMastodon(tag) : [],
        want('reddit')   ? socialReddit(tag)   : [],
        want('bsky')     ? socialBsky(tag)     : [],
      ]);
      const posts = [...ms, ...rd, ...bs];
      posts.sort((a, b) => new Date(b.date) - new Date(a.date));
      const seen = new Set(); const uniq = [];
      for (const p of posts) { const k = p.url || p.id; if (seen.has(k)) continue; seen.add(k); uniq.push(p); }
      // Legacy field aliases so older clients keep working (favs === ups).
      uniq.forEach(p => { p.favs = p.ups; });
      const out = JSON.stringify({
        posts: uniq.slice(0, 60), tag, net,
        networks: { mastodon: ms.length, reddit: rd.length, bsky: bs.length },
      });
      await kvPut(env.AXIOM_KV, cacheKey, out, 300);
      if (ctx) ctx.waitUntil(archiveItems(env, 'social', uniq.slice(0, 60).map(p => ({
        src: p.network, title: p.author || '', body: p.text, url: p.url, author: p.handle || p.author,
        ts: Date.parse(p.date) || 0, meta: { tag, ups: p.ups },
      }))).catch(() => {}));
      return new Response(out, { headers: CORS });
    }

    // Forum pulse - one call aggregating the AU political forum scrapers.
    // GET /forums?q=  (q optional: relevance-filters Whirlpool search + titles)
    if (path === '/forums') {
      const fq = q.slice(0, 80);
      const cacheKey = 'forums_' + (fq || 'latest').replace(/\W/g, '_').slice(0, 60);
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const jobs = [
        ['OzPolitic',  forumOzRss()],
        ['Whirlpool',  fq ? forumWhirlpoolQ(fq) : forumWhirlpoolQ('politics')],
        ['BigFooty',   forumBigfootyLatest()],
        ['HotCopper',  forumHotcopperLatest()],
      ];
      const settled = await Promise.allSettled(jobs.map(j => j[1]));
      const sources = {}; let threads = [];
      settled.forEach((s, i) => {
        const name = jobs[i][0];
        if (s.status === 'fulfilled') { sources[name] = s.value.length; threads.push(...s.value); }
        else sources[name] = 0;
      });
      if (fq) {
        const filtered = relevanceFilter(threads, fq);
        // Whirlpool results are already query-scoped; keep them even if the
        // title itself doesn't repeat the query words.
        const wp = threads.filter(t => t.source === 'Whirlpool');
        const merged = [...filtered];
        wp.forEach(t => { if (!merged.includes(t)) merged.push(t); });
        threads = merged;
      }
      const out = JSON.stringify({ threads: threads.slice(0, 30), q: fq, sources });
      await kvPut(env.AXIOM_KV, cacheKey, out, 480);
      if (ctx) ctx.waitUntil(archiveItems(env, 'forum', threads.slice(0, 30).map(t => ({
        src: t.source, title: t.text, url: t.url, ts: Date.parse(t.date) || 0,
        meta: fq ? { q: fq } : null,
      }))).catch(() => {}));
      return new Response(out, { headers: CORS });
    }

    // GDELT DOC 2.0 - free global news monitoring (AU-scoped unless overridden)
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

    // Wikipedia pageviews - free public-attention metric
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

    // TheyVoteForYou - Australian MP / senator voting records (free key)
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

    // ==========================================================================
    // V2 ROUTES - unchanged from axiom-worker.js v2
    // ==========================================================================

    if (path === '/reddit') {
      try {
        // api.reddit.com + a descriptive UA: the www host 403s generic cloud UAs.
        const r = await fetch(
          `https://api.reddit.com/r/${encodeURIComponent(sr)}/search` +
          `?q=${encodeURIComponent(q)}&sort=top&limit=10&restrict_sr=on&t=month&raw_json=1`,
          { headers: { 'User-Agent': 'axiom-au-intel/1.0 (AU political media dashboard)' }, signal: abortAfter(8000) }
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
          `https://api.reddit.com${permalink}.json?limit=6&depth=1&raw_json=1`,
          { headers: { 'User-Agent': 'axiom-au-intel/1.0 (AU political media dashboard)' }, signal: abortAfter(8000) }
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

    // -- Aggregate AU news across the whole feed registry (one request) --
    // GET /allnews?q=<keywords>&max=<n>&hours=<h>&debug=1
    //   Time-sensitive ISO dates + age, freshness window, wire-copy dedupe,
    //   party/tone enrichment, per-feed circuit breaker, and debug=1 health.
    //   Served stale-while-revalidate: cached snapshots return instantly and
    //   a background rebuild refreshes them once they pass half-life.
    if (path === '/allnews') {
      const q     = (reqUrl.searchParams.get('q') || '').toLowerCase();
      const max   = Math.min(parseInt(reqUrl.searchParams.get('max') || '60', 10) || 60, 120);
      const hours = Math.min(parseInt(reqUrl.searchParams.get('hours') || '72', 10) || 72, 720);
      const debug = reqUrl.searchParams.get('debug') === '1';
      const opts  = { q, max, hours, debug };

      // Lazy time-series accumulation (self-throttled to ~hourly in KV) -
      // history builds up even on deployments with no cron trigger.
      if (ctx && !debug) ctx.waitUntil(snapshotPulse(env).catch(() => {}));

      if (!debug) {
        const cached = await kvGet(env.AXIOM_KV, `allnews2_${q || 'all'}_${max}_${hours}`);
        if (cached) {
          // Serve instantly; refresh in the background once older than 2 min.
          try {
            const gen = Date.parse(JSON.parse(cached).generated || 0) || 0;
            if (ctx && Date.now() - gen > 120000) ctx.waitUntil(buildAllNews(env, opts).then(s => arcNewsSnap(env, s)).catch(() => {}));
          } catch (e) {}
          return new Response(cached, { headers: CORS });
        }
      }
      const out = await buildAllNews(env, opts);
      if (ctx) ctx.waitUntil(arcNewsSnap(env, out).catch(() => {}));
      return new Response(out, { headers: CORS });
    }

    // -- Accumulated pulse history: share-of-voice + tone time series -----
    // GET /history -> { points: [{t, tot, p:{alp..}, tn:{alp..}, tone}] }
    if (path === '/history') {
      const raw = await kvGet(env.AXIOM_KV, 'pulse_history');
      return new Response('{"points":' + (raw || '[]') + '}', { headers: CORS });
    }

    // -- Election & sentiment analysis: computed media-signal read --------
    // GET /analysis?hours=72 -> { volume, sentiment, parties[], leaderboard[],
    //   read, note }. Synthesised from share-of-voice + tone + momentum.
    if (path === '/analysis') {
      const hours = Math.min(parseInt(reqUrl.searchParams.get('hours') || '72', 10) || 72, 336);
      const cacheKey = `analysis_${hours}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) {
        try {
          const gen = Date.parse(JSON.parse(cached).generated || 0) || 0;
          if (ctx && Date.now() - gen > 300000) ctx.waitUntil(buildAnalysis(env, hours).catch(() => {}));
        } catch (e) {}
        return new Response(cached, { headers: CORS });
      }
      const out = await buildAnalysis(env, hours);
      return new Response(out, { headers: CORS });
    }

    // -- ABS Census demographic context (2021 Census) ---------------------
    // GET /census[?region=nsw] -> national + state indicators for grounding
    // electorate/demographic analysis. Source: ABS 2021 Census QuickStats.
    if (path === '/census') {
      const region = (reqUrl.searchParams.get('region') || '').toLowerCase().replace(/[^a-z]/g, '');
      const regions = (region && CENSUS[region]) ? { [region]: CENSUS[region] } : CENSUS;
      return jsonResp({
        source: 'ABS 2021 Census of Population and Housing (QuickStats)',
        year: 2021,
        note: 'Latest published national census; next full count 2026. Figures are point-in-time Census counts.',
        regions,
      });
    }

    // -- ClickUp: create a task from a flagged story ----------------------
    // POST /clickup  body: { name, description, listId?, priority?, tags?[] }
    // Token stays server-side as a Worker secret (CLICKUP_TOKEN); the list
    // defaults to CLICKUP_LIST_ID but can be overridden per request.
    if (path === '/clickup') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      const token = env.CLICKUP_TOKEN;
      if (!token) return jsonResp({ error: 'clickup_not_configured', detail: 'Set CLICKUP_TOKEN (and optionally CLICKUP_LIST_ID) as Worker secrets: wrangler secret put CLICKUP_TOKEN' }, 501);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      const listId = String(body.listId || env.CLICKUP_LIST_ID || '').trim();
      if (!listId) return jsonResp({ error: 'no_list', detail: 'Provide listId in the request or set CLICKUP_LIST_ID.' }, 400);
      if (!body.name) return jsonResp({ error: 'no_name' }, 400);
      const payload = {
        name: String(body.name).slice(0, 250),
        description: String(body.description || '').slice(0, 8000),
        priority: [1, 2, 3, 4].indexOf(body.priority) !== -1 ? body.priority : 2,
      };
      if (Array.isArray(body.tags) && body.tags.length) payload.tags = body.tags.slice(0, 10).map(String);
      try {
        const r = await fetch('https://api.clickup.com/api/v2/list/' + encodeURIComponent(listId) + '/task', {
          method: 'POST',
          headers: { 'Authorization': token, 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return jsonResp({ error: 'clickup_' + r.status, detail: (data && (data.err || data.ECODE)) || '' }, 502);
        return jsonResp({ ok: true, id: data.id, url: data.url, name: payload.name });
      } catch (e) {
        return jsonResp({ error: 'clickup_fetch_failed', detail: String(e && e.name || e).slice(0, 60) }, 502);
      }
    }

    // -- Nano Banana: generate/edit a visual from a brief + reference art ----
    // POST /nano  body: { prompt, references?[{data,mime}], referenceB64?, mime?,
    //                     model?, aspect?, size? }
    // Default model: gemini-3-pro-image (Nano Banana Pro - professional asset
    // production, strongest text rendering, multi-turn image editing). Falls
    // back through gemini-3.1-flash-image then gemini-2.5-flash-image if a
    // model is unavailable to this key. Uses the current imageConfig schema
    // (aspectRatio/imageSize). Key stays server-side as GEMINI_KEY.
    // Returns { imageB64, mime, model }.
    if (path === '/nano') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      const key = env.GEMINI_KEY;
      if (!key) return jsonResp({ error: 'gemini_not_configured', detail: 'Set GEMINI_KEY as a Worker secret: wrangler secret put GEMINI_KEY' }, 501);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      if (!body.prompt) return jsonResp({ error: 'no_prompt' }, 400);
      const clean = m => String(m || '').replace(/^models\//, '').replace(/[^a-zA-Z0-9._-]/g, '');
      // Model chain: requested (or Pro default) first, then fallbacks. Dedupe.
      const chain = [];
      [clean(body.model) || 'gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']
        .forEach(m => { if (m && chain.indexOf(m) === -1) chain.push(m); });
      const parts = [];
      // Prompt first, then the reference image(s) (matches Gemini image-edit ordering).
      parts.push({ text: String(body.prompt).slice(0, 8000) });
      const refs = Array.isArray(body.references) ? body.references
        : (body.referenceB64 ? [{ data: body.referenceB64, mime: body.mime }] : []);
      refs.slice(0, 6).forEach(rf => { if (rf && rf.data) parts.push({ inline_data: { mime_type: rf.mime || 'image/png', data: String(rf.data) } }); });
      // responseModalities is still required; imageConfig is the current way to
      // request exact aspect ratio / resolution (gemini-3 image models).
      const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
      const SIZES = ['1K', '2K', '4K'];
      const genCfg = { responseModalities: ['TEXT', 'IMAGE'] };
      const imgCfg = {};
      if (ASPECTS.indexOf(body.aspect) !== -1) imgCfg.aspectRatio = body.aspect;
      if (SIZES.indexOf(body.size) !== -1) imgCfg.imageSize = body.size;
      let lastDetail = '', lastModel = chain[0];
      for (const model of chain) {
        lastModel = model;
        // gemini-2.5-flash-image predates imageConfig - send it a bare config.
        const cfg = (model.indexOf('gemini-2.5') === 0 || !Object.keys(imgCfg).length)
          ? genCfg : Object.assign({}, genCfg, { imageConfig: imgCfg });
        const payload = JSON.stringify({ contents: [{ parts }], generationConfig: cfg });
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
        // 500s from the image models are frequently transient - retry per model.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            if (attempt) await new Promise(res => setTimeout(res, 700 * attempt));
            const r = await fetch(url, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: payload,
              signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined,
            });
            const data = await r.json().catch(() => ({}));
            if (data.error) {
              lastDetail = String(data.error.message || '').slice(0, 200);
              const code = data.error.code || r.status;
              if (code === 500 || code === 503 || code === 429) continue;      // transient - retry this model
              if (code === 404 || code === 400 || code === 403) break;         // model unavailable to this key - next model
              return jsonResp({ error: 'gemini_' + code, detail: lastDetail, model }, 502);
            }
            const cand = (data.candidates || [])[0] || {};
            const imgPart = ((cand.content && cand.content.parts) || []).find(p => p.inline_data || p.inlineData);
            const inl = imgPart && (imgPart.inline_data || imgPart.inlineData);
            if (inl && inl.data) return jsonResp({ ok: true, imageB64: inl.data, mime: inl.mime_type || inl.mimeType || 'image/png', model });
            lastDetail = String(cand.finishReason || 'model returned no image').slice(0, 120);
            if (cand.finishReason && cand.finishReason !== 'STOP') continue;   // blocked/transient - retry
          } catch (e) {
            lastDetail = String(e && e.name || e).slice(0, 60);
          }
        }
        // Fall through to the next model in the chain (unavailable OR exhausted
        // retries) - resilience beats strict model pinning; the response's
        // `model` field always reports which one actually produced the image.
      }
      return jsonResp({ error: 'no_image', detail: lastDetail || 'all image models failed', model: lastModel }, 502);
    }

    // -- Reference link reader: fetch a public URL for grounding copy --------
    // GET /fetchurl?url=  -> { ok, title, text, image, summarized }
    // Extracts the main article text (strips nav/ads/boilerplate), pulls the
    // lead og:image, and - when the page is long and GEMINI_KEY is set -
    // condenses it server-side with the Gemini text model so prompts stay
    // inside token limits. Clear failures for auth-gated pages, non-HTML
    // (e.g. PDFs), 404s and timeouts.
    if (path === '/fetchurl') {
      const target = reqUrl.searchParams.get('url') || '';
      if (!/^https?:\/\//i.test(target)) return jsonResp({ error: 'bad_url', detail: 'Provide a full http(s) URL.' }, 400);
      const ck = 'fetchurl2_' + target.slice(0, 300);
      const cached = await kvGet(env.AXIOM_KV, ck);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const r = await fetch(target, {
          headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(9000) : undefined,
          cf: { cacheTtl: 300 },
        });
        if (r.status === 401 || r.status === 403) return jsonResp({ error: 'fetch_' + r.status, detail: 'Access denied - the page is behind a login or paywall.' }, 502);
        if (r.status === 404) return jsonResp({ error: 'fetch_404', detail: 'Page not found (404).' }, 502);
        if (!r.ok) return jsonResp({ error: 'fetch_' + r.status, detail: 'The page did not return content.' }, 502);
        const ctype = (r.headers.get('content-type') || '').toLowerCase();
        if (ctype && !/html|text\/plain|xml/.test(ctype)) {
          const kind = /pdf/.test(ctype) ? 'a PDF' : /image\//.test(ctype) ? 'an image' : ('type ' + ctype.split(';')[0]);
          return jsonResp({ error: 'non_html', detail: 'The link is ' + kind + ', not a web page - paste the key text instead.' }, 415);
        }
        // Size cap: read at most ~600KB of markup.
        let html = await r.text();
        if (html.length > 600000) html = html.slice(0, 600000);
        const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
        const ogImg = (html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) || [])[1] || '';
        // Prefer article/main body; strip scripts/styles/nav, collapse to text.
        let bodyHtml = html
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ');
        const art = (bodyHtml.match(/<article[\s\S]*?<\/article>/i) || [])[0]
          || (bodyHtml.match(/<main[\s\S]*?<\/main>/i) || [])[0] || bodyHtml;
        let text = stripHtml(art).slice(0, 12000);
        if (!text.trim()) return jsonResp({ error: 'empty_page', detail: 'No readable text found (the page may render via a login or heavy scripting).' }, 502);
        // Long page + key available -> condense server-side so prompts stay small.
        let summarized = false;
        if (text.length > 4000 && env.GEMINI_KEY) {
          try {
            const sr = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=' + encodeURIComponent(env.GEMINI_KEY), {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text:
                'Condense this web page for a communications team. Keep: topic, key facts with any names/numbers/dates, overall tone/register, and what type of content it is (news article, press release, campaign page, opinion...). 150-200 words, plain prose, no preamble.\n\nTITLE: ' + title + '\n\nPAGE TEXT:\n' + text.slice(0, 11000) }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 500 } }),
              signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
            });
            const sd = await sr.json().catch(() => ({}));
            const sum = (((sd.candidates || [])[0] || {}).content || {}).parts;
            const stext = (sum || []).map(p => p.text || '').join('').trim();
            if (stext) { text = stext; summarized = true; }
          } catch (e) { /* fall through to truncation */ }
        }
        if (!summarized) text = text.slice(0, 4000);
        const out = JSON.stringify({ ok: true, title, text, image: ogImg, summarized });
        await kvPut(env.AXIOM_KV, ck, out, 1800);
        // Reference pages the team pulls into briefs are knowledge - keep them.
        if (ctx) ctx.waitUntil(archiveItems(env, 'ref', [{
          src: 'fetchurl', title, body: text, url: target, meta: { summarized },
        }]).catch(() => {}));
        return new Response(out, { headers: CORS });
      } catch (e) {
        const name = String(e && e.name || e);
        const detail = /Timeout|Abort/i.test(name) ? 'Timed out fetching the page.' : name.slice(0, 60);
        return jsonResp({ error: 'fetchurl_failed', detail }, 502);
      }
    }

    // ========================================================================
    // ARCHIVE ROUTES - the permanent D1 store behind the knowledge system.
    // All return a clear 501 until the MIND_DB binding exists.
    // ========================================================================

    // POST /log/chat  { sid, surface, client, role, text } or { sid, surface, client, turns:[{role,text}] }
    // Fire-and-forget conversation capture from Analyst / Studio / Ad Lab / Composer.
    if (path === '/log/chat') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        const b = await req.json();
        await ensureArchive(env);
        const sid = String(b.sid || '').slice(0, 60);
        const surface = String(b.surface || '').slice(0, 30);
        const client = String(b.client || '').slice(0, 40);
        const turns = Array.isArray(b.turns) ? b.turns : [{ role: b.role, text: b.text }];
        const now = Date.now();
        const stmt = env.MIND_DB.prepare('INSERT INTO arc_convo(sid,surface,client,role,body,ts) VALUES(?,?,?,?,?,?)');
        const batch = turns.slice(0, 20)
          .filter(t => t && t.text)
          .map(t => stmt.bind(sid, surface, client, String(t.role || 'user').slice(0, 12), String(t.text).slice(0, 8000), t.ts || now));
        if (batch.length) await env.MIND_DB.batch(batch);
        return jsonResp({ ok: true, logged: batch.length });
      } catch (e) { return jsonResp({ ok: false, error: 'log_failed', detail: String(e).slice(0, 120) }, 500); }
    }

    // POST /log/ref  { url, title, text, client } - reference material logged by the app
    if (path === '/log/ref') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        const b = await req.json();
        const n = await archiveItems(env, 'ref', [{
          src: String(b.client || 'app').slice(0, 40), title: b.title, body: b.text, url: b.url,
          meta: b.meta || null,
        }]);
        return jsonResp({ ok: true, logged: n });
      } catch (e) { return jsonResp({ ok: false, error: 'log_failed', detail: String(e).slice(0, 120) }, 500); }
    }

    // GET /archive/search?q=&kind=&src=&days=&limit=  - query the permanent store
    if (path === '/archive/search') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        await ensureArchive(env);
        const kind = (reqUrl.searchParams.get('kind') || '').replace(/[^\w]/g, '').slice(0, 20);
        const src = (reqUrl.searchParams.get('src') || '').slice(0, 60);
        const days = Math.min(parseInt(reqUrl.searchParams.get('days') || '0', 10) || 0, 3650);
        const limit = Math.min(parseInt(reqUrl.searchParams.get('limit') || '40', 10) || 40, 100);
        const terms = String(reqUrl.searchParams.get('q') || '').slice(0, 120);
        const where = []; const args = [];
        if (kind) { where.push('kind=?'); args.push(kind); }
        if (src) { where.push('src=?'); args.push(src); }
        if (days) { where.push('ts>?'); args.push(Date.now() - days * 86400000); }
        if (terms) { where.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); const l = arcLike(terms); args.push(l, l); }
        const sql = 'SELECT kind,src,title,body,url,author,tone,meta,ts FROM arc_items'
          + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ' ORDER BY ts DESC LIMIT ' + limit;
        const rows = await env.MIND_DB.prepare(sql).bind(...args).all();
        return jsonResp({ ok: true, items: (rows.results || []).map(r => ({
          kind: r.kind, src: r.src, title: r.title, body: (r.body || '').slice(0, 500), url: r.url,
          author: r.author, tone: r.tone, meta: r.meta ? JSON.parse(r.meta) : null, ts: r.ts,
        })) });
      } catch (e) { return jsonResp({ ok: false, error: 'search_failed', detail: String(e).slice(0, 160) }, 500); }
    }

    // GET /archive/stats - totals by kind + last-7-day counts by source (map fuel)
    if (path === '/archive/stats') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        await ensureArchive(env);
        const wk = Date.now() - 7 * 86400000;
        const [kinds, srcs, convo] = await env.MIND_DB.batch([
          env.MIND_DB.prepare('SELECT kind, COUNT(*) c FROM arc_items GROUP BY kind'),
          env.MIND_DB.prepare('SELECT src, COUNT(*) c FROM arc_items WHERE ts>? GROUP BY src ORDER BY c DESC LIMIT 200').bind(wk),
          env.MIND_DB.prepare('SELECT COUNT(*) c, COUNT(DISTINCT sid) s FROM arc_convo'),
        ]);
        const byKind = {}; (kinds.results || []).forEach(r => { byKind[r.kind] = r.c; });
        const bySrc = {}; (srcs.results || []).forEach(r => { bySrc[r.src] = r.c; });
        const cv = (convo.results || [])[0] || {};
        return jsonResp({ ok: true, byKind, bySrc7d: bySrc, conversations: { turns: cv.c || 0, sessions: cv.s || 0 } });
      } catch (e) { return jsonResp({ ok: false, error: 'stats_failed', detail: String(e).slice(0, 160) }, 500); }
    }

    // -- Claude proxy for the Creative Studio chat ---------------------------
    // POST /chat  body: { system?, messages, max_tokens? }
    // Keeps the Anthropic key server-side (secret ANTHROPIC_API_KEY). Returns
    // the raw Messages API response so the client can parse structured output.
    if (path === '/chat') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      const akey = env.ANTHROPIC_API_KEY;
      if (!akey) return jsonResp({ error: 'chat_not_configured', detail: 'Set ANTHROPIC_API_KEY as a Worker secret: wrangler secret put ANTHROPIC_API_KEY' }, 501);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      if (!Array.isArray(body.messages) || !body.messages.length) return jsonResp({ error: 'no_messages' }, 400);
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': akey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: String(body.model || 'claude-sonnet-4-6').replace(/[^a-zA-Z0-9._-]/g, ''),
            max_tokens: Math.min(parseInt(body.max_tokens, 10) || 1500, 4000),
            system: typeof body.system === 'string' ? body.system.slice(0, 30000) : undefined,
            messages: body.messages,
          }),
          signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined,
        });
        const data = await r.json().catch(() => ({}));
        if (data.error) return jsonResp({ error: 'anthropic_' + (data.error.type || r.status), detail: String(data.error.message || '').slice(0, 200) }, 502);
        return jsonResp(data);
      } catch (e) {
        return jsonResp({ error: 'chat_failed', detail: String(e && e.name || e).slice(0, 60) }, 502);
      }
    }

    // -- Creative Studio session store (KV) ----------------------------------
    // Sessions survive page refreshes. The small JSON doc (thread text, brief,
    // version metadata) and each image version live in separate KV entries so
    // no value approaches KV's 25MB cap. 30-day TTL, refreshed on write.
    // POST /session/save {id, doc} | GET /session/load?id=
    // POST /session/img  {id, ver, b64, mime} | GET /session/img?id=&ver=
    if ((path === '/session/save' || path === '/session/img') && req.method === 'POST') {
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      const sid = String(body.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (!sid) return jsonResp({ error: 'no_id' }, 400);
      if (path === '/session/save') {
        const doc = JSON.stringify(body.doc || {});
        if (doc.length > 400000) return jsonResp({ error: 'doc_too_large' }, 413);
        await kvPut(env.AXIOM_KV, 'imgsess_' + sid, doc, 30 * 86400);
        return jsonResp({ ok: true });
      }
      const ver = parseInt(body.ver, 10);
      if (!(ver >= 1) || !body.b64) return jsonResp({ error: 'missing_fields' }, 400);
      if (String(body.b64).length > 8000000) return jsonResp({ error: 'image_too_large' }, 413);
      await kvPut(env.AXIOM_KV, 'imgsess_' + sid + '_v' + ver,
        JSON.stringify({ b64: String(body.b64), mime: body.mime || 'image/png' }), 30 * 86400);
      return jsonResp({ ok: true });
    }
    if (path === '/session/load' || path === '/session/img') {
      const sid = String(reqUrl.searchParams.get('id') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
      if (!sid) return jsonResp({ error: 'no_id' }, 400);
      if (path === '/session/load') {
        const doc = await kvGet(env.AXIOM_KV, 'imgsess_' + sid);
        return doc ? new Response('{"ok":true,"doc":' + doc + '}', { headers: CORS })
          : jsonResp({ ok: false, error: 'not_found' }, 404);
      }
      const ver = parseInt(reqUrl.searchParams.get('ver'), 10);
      const img = await kvGet(env.AXIOM_KV, 'imgsess_' + sid + '_v' + ver);
      return img ? new Response('{"ok":true,"img":' + img + '}', { headers: CORS })
        : jsonResp({ ok: false, error: 'not_found' }, 404);
    }

    // ======================================================================
    // THE CURIOUS MIND - per-client intelligence layer
    // Architecture: Vectorize (semantic index, per-client namespaces + shared
    // 'cmm' org namespace) + Workers AI embeddings + D1 (doc/run metadata)
    // + R2 (raw documents). Bindings: MIND_VECTORS, AI, MIND_DB, MIND_DOCS.
    // Every route degrades with a clear 501 naming what to create if a
    // binding is missing. Strict isolation: queries only ever touch the
    // requested client namespace plus 'cmm' - never another client's.
    // ======================================================================
    if (path.indexOf('/mind/') === 0) {
      const missing = [];
      if (!env.MIND_VECTORS) missing.push('MIND_VECTORS (Vectorize index, 768 dims, cosine)');
      if (!env.AI) missing.push('AI (Workers AI binding, for @cf/baai/bge-base-en-v1.5 embeddings)');
      if (!env.MIND_DB) missing.push('MIND_DB (D1 database)');
      if (path !== '/mind/query' && !env.MIND_DOCS) missing.push('MIND_DOCS (R2 bucket)');
      if (missing.length) return jsonResp({ error: 'mind_not_configured', detail: 'Create + bind in the Cloudflare dashboard: ' + missing.join('; ') }, 501);
      const nsClean = s => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
      const embed = async texts => {
        const out = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: texts });
        return out.data;
      };
      const ensureSchema = async () => {
        await env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mind_docs(id TEXT PRIMARY KEY, ns TEXT, title TEXT, kind TEXT, source TEXT, dt TEXT, chunks INTEGER, created INTEGER)').run();
        await env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mind_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, mode TEXT, q TEXT, created INTEGER)').run();
      };
      // Retrieval shared by /mind/query and /mind/analyze: the client
      // namespace plus the shared 'cmm' layer, nothing else, ever.
      const retrieve = async (ns, q, kClient, kShared) => {
        const vec = (await embed([q.slice(0, 1500)]))[0];
        const hits = [];
        const one = async (space, topK) => {
          try {
            const res = await env.MIND_VECTORS.query(vec, { topK, namespace: space, returnMetadata: 'all' });
            (res.matches || []).forEach(m => hits.push({ ns: space, score: m.score, meta: m.metadata || {} }));
          } catch (e) {}
        };
        await one(ns, kClient);
        if (ns !== 'cmm') await one('cmm', kShared);
        hits.sort((a, b) => b.score - a.score);
        return hits;
      };

      // POST /mind/ingest {namespace, title, text, kind?, source?, date?}
      if (path === '/mind/ingest' && req.method === 'POST') {
        let b = {}; try { b = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
        const ns = nsClean(b.namespace);
        const text = String(b.text || '').slice(0, 200000);
        if (!ns || !text.trim()) return jsonResp({ error: 'missing_fields', detail: 'namespace and text are required' }, 400);
        const docId = ns + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const title = String(b.title || 'Untitled').slice(0, 200);
        const kind = String(b.kind || 'doc').slice(0, 40);
        // Chunk ~1200 chars with 150 overlap, embed in batches, insert.
        const chunks = [];
        for (let i = 0; i < text.length && chunks.length < 120; i += 1050) chunks.push(text.slice(i, i + 1200));
        try {
          await ensureSchema();
          for (let i = 0; i < chunks.length; i += 20) {
            const batch = chunks.slice(i, i + 20);
            const vecs = await embed(batch);
            await env.MIND_VECTORS.insert(batch.map((c, j) => ({
              id: docId + '_' + (i + j),
              values: vecs[j],
              namespace: ns,
              metadata: { docId, title, kind, source: String(b.source || '').slice(0, 300), dt: String(b.date || '').slice(0, 20), snippet: c.slice(0, 900) },
            })));
          }
          await env.MIND_DOCS.put('mind/' + ns + '/' + docId + '.txt', text);
          await env.MIND_DB.prepare('INSERT INTO mind_docs(id,ns,title,kind,source,dt,chunks,created) VALUES(?,?,?,?,?,?,?,?)')
            .bind(docId, ns, title, kind, String(b.source || ''), String(b.date || ''), chunks.length, Date.now()).run();
          return jsonResp({ ok: true, docId, chunks: chunks.length });
        } catch (e) {
          return jsonResp({ error: 'ingest_failed', detail: String(e && e.message || e).slice(0, 200) }, 502);
        }
      }

      // GET /mind/docs?namespace=  - what the KB holds (for the UI)
      if (path === '/mind/docs') {
        const ns = nsClean(reqUrl.searchParams.get('namespace'));
        if (!ns) return jsonResp({ error: 'no_namespace' }, 400);
        try {
          await ensureSchema();
          const rows = await env.MIND_DB.prepare('SELECT id,title,kind,source,dt,chunks,created FROM mind_docs WHERE ns=? ORDER BY created DESC LIMIT 50').bind(ns).all();
          return jsonResp({ ok: true, docs: rows.results || [] });
        } catch (e) { return jsonResp({ error: 'docs_failed', detail: String(e && e.message || e).slice(0, 120) }, 502); }
      }

      // POST /mind/query {namespace, q, topK?} - raw retrieval (debug/UI)
      // Optional b.kinds: ['style','voice','policy',...] filters hits by
      // metadata.kind - used by the client-playbook fetch so standing rules
      // load deterministically instead of only when semantically similar.
      if (path === '/mind/query' && req.method === 'POST') {
        let b = {}; try { b = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
        const ns = nsClean(b.namespace);
        if (!ns || !b.q) return jsonResp({ error: 'missing_fields' }, 400);
        const kinds = Array.isArray(b.kinds) ? b.kinds.map(k => String(k).slice(0, 40)) : null;
        try {
          const want = Math.min(parseInt(b.topK, 10) || 6, 12);
          // Over-fetch when filtering so a kind filter still fills topK.
          let hits = await retrieve(ns, String(b.q), kinds ? Math.min(want * 3, 24) : want, 3);
          if (kinds) hits = hits.filter(h => kinds.includes(h.meta.kind)).slice(0, want);
          return jsonResp({ ok: true, hits: hits.map(h => ({ ns: h.ns, score: +h.score.toFixed(3), title: h.meta.title, kind: h.meta.kind, snippet: (h.meta.snippet || '').slice(0, 400) })) });
        } catch (e) { return jsonResp({ error: 'query_failed', detail: String(e && e.message || e).slice(0, 120) }, 502); }
      }

      // POST /mind/analyze {namespace, mode, question?, objective?, keywords?[]}
      // modes: narrative | patterns | opposition | strategy | impact
      if (path === '/mind/analyze' && req.method === 'POST') {
        if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'chat_not_configured', detail: 'Set ANTHROPIC_API_KEY (wrangler secret put ANTHROPIC_API_KEY) - analysis is generated by Claude.' }, 501);
        let b = {}; try { b = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
        const ns = nsClean(b.namespace);
        const MODES = {
          narrative: 'Generate 2-3 NEW campaign narratives grounded in the client knowledge and current news. For each: a name, the core story in 2-3 sentences, why now (tie to a current signal), and the first content moves.',
          patterns: 'Detect patterns across the client knowledge and current news: recurring themes, sentiment shifts, emerging issues, and what is gaining or losing momentum over time. Be specific about the evidence.',
          opposition: 'Analyse activity working AGAINST this client\'s goals visible in the news and knowledge base: actors, tactics, messaging frames, momentum, and the strongest counter-positions available.',
          strategy: 'Recommend campaign and channel strategy tied to the client\'s stated objectives: 3-5 prioritised recommendations, each with rationale, channel, and a first step.',
          impact: 'Measure impact: compare campaign activity in the knowledge base against changes in coverage volume, tone and momentum in the news/time-series data. Say plainly what moved, what did not, and the most plausible attribution.',
        };
        const mode = String(b.mode || '');
        if (!MODES[mode]) return jsonResp({ error: 'bad_mode', detail: 'mode must be one of: ' + Object.keys(MODES).join(', ') }, 400);
        if (!ns) return jsonResp({ error: 'no_namespace' }, 400);
        try {
          const seed = (b.question || '') + ' ' + (b.objective || '') + ' ' + mode + ' campaign strategy narrative';
          const hits = await retrieve(ns, seed, 8, 4);
          // News arm: existing aggregator filtered by client keywords.
          let news = [];
          try {
            const kw = (Array.isArray(b.keywords) ? b.keywords : []).map(s => String(s).toLowerCase()).filter(Boolean).slice(0, 30);
            const raw = JSON.parse(await buildAllNews(env, { q: '', max: 120, hours: 168 }));
            news = (raw.items || []).filter(it => {
              if (!kw.length) return false;
              const hay = (it.title + ' ' + (it.desc || '')).toLowerCase();
              return kw.some(k => hay.indexOf(k) !== -1);
            }).slice(0, 12);
          } catch (e) {}
          // Time-series context for patterns/impact.
          let series = '';
          if (mode === 'patterns' || mode === 'impact') {
            try {
              const hist = JSON.parse(await kvGet(env.AXIOM_KV, 'pulse_history') || '[]') || [];
              const wk = hist.slice(-168), prev = hist.slice(-336, -168);
              const avg = (a, f) => a.length ? +(a.reduce((s, p) => s + f(p), 0) / a.length).toFixed(2) : 0;
              series = 'COVERAGE TIME-SERIES: last-7d avg volume ' + avg(wk, p => p.tot || 0) + ' (prior 7d ' + avg(prev, p => p.tot || 0) + '); last-7d avg tone ' + avg(wk, p => p.tone || 0) + ' (prior ' + avg(prev, p => p.tone || 0) + ').';
            } catch (e) {}
          }
          // Build numbered source register - the citation contract.
          const sources = [];
          const kb = hits.map((h, i) => { sources.push({ id: 'S' + (i + 1), title: h.meta.title || 'doc', origin: h.ns === 'cmm' ? 'CMM shared' : 'client KB', kind: h.meta.kind || '' }); return '[S' + (i + 1) + '] (' + (h.ns === 'cmm' ? 'CMM' : 'CLIENT') + ' ' + (h.meta.kind || 'doc') + ') ' + (h.meta.title || '') + ': ' + (h.meta.snippet || ''); });
          const nw = news.map((n, i) => { sources.push({ id: 'N' + (i + 1), title: n.title, origin: 'news: ' + (n.src || ''), kind: 'news' }); return '[N' + (i + 1) + '] (' + (n.src || 'news') + ', ' + (n.date || '').slice(0, 10) + ') ' + n.title + (n.desc ? ' - ' + n.desc.slice(0, 150) : ''); });
          const sys = 'You are The Curious Mind, the client-intelligence engine of a communications agency (CMM). You are analysing for ONE client only. Use ONLY the numbered sources provided; never invent facts, quotes or numbers.\n\nTASK: ' + MODES[mode] + (b.objective ? '\n\nCLIENT OBJECTIVES: ' + String(b.objective).slice(0, 600) : '') + (b.question ? '\n\nSPECIFIC QUESTION: ' + String(b.question).slice(0, 400) : '') +
            '\n\nCITATION RULES (mandatory): after every claim drawn from a source, cite it inline like [S2] or [N4]. If the sources are thin for part of the task, say so rather than padding. Use #### section headers. Australian English.' +
            '\n\nCLIENT KNOWLEDGE BASE + SHARED CMM CONTEXT:\n' + (kb.join('\n\n') || '(knowledge base is empty - note this in your answer)') +
            '\n\nCURRENT NEWS (client-relevant, last 7 days):\n' + (nw.join('\n') || '(no matching news items)') + (series ? '\n\n' + series : '');
          const r = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2200, system: sys, messages: [{ role: 'user', content: 'Run the analysis now.' }] }),
            signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined,
          });
          const data = await r.json().catch(() => ({}));
          if (data.error) return jsonResp({ error: 'anthropic_error', detail: String(data.error.message || '').slice(0, 200) }, 502);
          const text = (data.content || []).filter(x => x.type === 'text').map(x => x.text).join('').trim();
          try { await ensureSchema(); await env.MIND_DB.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, mode, String(b.question || '').slice(0, 200), Date.now()).run(); } catch (e) {}
          return jsonResp({ ok: true, mode, text, sources });
        } catch (e) {
          return jsonResp({ error: 'analyze_failed', detail: String(e && e.message || e).slice(0, 200) }, 502);
        }
      }
      return jsonResp({ error: 'unknown_mind_route' }, 404);
    }

    // -- ClickUp attachment: attach a generated image to an existing task ---
    // POST /clickup-attach  body: { taskId, filename?, b64, mime? }
    if (path === '/clickup-attach') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      const token = env.CLICKUP_TOKEN;
      if (!token) return jsonResp({ error: 'clickup_not_configured' }, 501);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      if (!body.taskId || !body.b64) return jsonResp({ error: 'missing_fields' }, 400);
      try {
        const bin = Uint8Array.from(atob(String(body.b64)), c => c.charCodeAt(0));
        const form = new FormData();
        form.append('attachment', new Blob([bin], { type: body.mime || 'image/png' }), String(body.filename || 'axiom-visual.png'));
        const r = await fetch('https://api.clickup.com/api/v2/task/' + encodeURIComponent(String(body.taskId)) + '/attachment', {
          method: 'POST', headers: { 'Authorization': token }, body: form,
          signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) return jsonResp({ error: 'attach_' + r.status, detail: (data && (data.err || data.ECODE)) || '' }, 502);
        return jsonResp({ ok: true, id: data.id, url: data.url });
      } catch (e) {
        return jsonResp({ error: 'attach_failed', detail: String(e && e.name || e).slice(0, 60) }, 502);
      }
    }

    // -- WhatsApp: push a news alert + brief to a number/group --------------
    // POST /whatsapp  body: { to, text }
    // Meta Cloud API (WA_TOKEN + WA_PHONE_ID) or Twilio (TWILIO_SID +
    // TWILIO_AUTH + TWILIO_WA_FROM). All secrets stay on the worker.
    if (path === '/whatsapp') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      const to = String(body.to || '').trim();
      const text = String(body.text || '').slice(0, 4000);
      if (!to || !text) return jsonResp({ error: 'missing_fields', detail: 'Provide to and text.' }, 400);
      try {
        if (env.WA_TOKEN && env.WA_PHONE_ID) {
          const r = await fetch('https://graph.facebook.com/v21.0/' + encodeURIComponent(env.WA_PHONE_ID) + '/messages', {
            method: 'POST', headers: { 'Authorization': 'Bearer ' + env.WA_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text } }),
            signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) return jsonResp({ error: 'whatsapp_' + r.status, detail: String((data.error && data.error.message) || '').slice(0, 200) }, 502);
          return jsonResp({ ok: true, provider: 'meta', id: (data.messages && data.messages[0] && data.messages[0].id) || null });
        }
        if (env.TWILIO_SID && env.TWILIO_AUTH && env.TWILIO_WA_FROM) {
          const params = new URLSearchParams();
          params.set('To', 'whatsapp:' + to);
          params.set('From', 'whatsapp:' + env.TWILIO_WA_FROM);
          params.set('Body', text);
          const r = await fetch('https://api.twilio.com/2010-04-01/Accounts/' + encodeURIComponent(env.TWILIO_SID) + '/Messages.json', {
            method: 'POST', headers: { 'Authorization': 'Basic ' + btoa(env.TWILIO_SID + ':' + env.TWILIO_AUTH), 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
            signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined,
          });
          const data = await r.json().catch(() => ({}));
          if (!r.ok) return jsonResp({ error: 'twilio_' + r.status, detail: String(data.message || '').slice(0, 200) }, 502);
          return jsonResp({ ok: true, provider: 'twilio', id: data.sid || null });
        }
        return jsonResp({ error: 'whatsapp_not_configured', detail: 'Set WA_TOKEN + WA_PHONE_ID (Meta) or TWILIO_SID + TWILIO_AUTH + TWILIO_WA_FROM as Worker secrets.' }, 501);
      } catch (e) {
        return jsonResp({ error: 'whatsapp_fetch_failed', detail: String(e && e.name || e).slice(0, 60) }, 502);
      }
    }

    // -- Topical time-sensitive search across Google News AU --------------
    // GET /newsq?q=<query>&hours=<h>&max=<n>
    //   Covers every outlet Google indexes (not just the registry) for
    //   arbitrary topics - ideal for grounding Analyst answers. Uses the
    //   Google News RSS search endpoint with an AU locale + when: window.
    if (path === '/newsq') {
      const qq    = (reqUrl.searchParams.get('q') || '').trim();
      if (!qq) return jsonResp({ error: 'q_required' }, 400);
      const hours = Math.min(parseInt(reqUrl.searchParams.get('hours') || '48', 10) || 48, 168);
      const max   = Math.min(parseInt(reqUrl.searchParams.get('max') || '30', 10) || 30, 60);
      const cacheKey = `newsq_${qq.toLowerCase()}_${hours}_${max}`;
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      try {
        const when = hours <= 24 ? `when:${hours}h` : `when:${Math.ceil(hours / 24)}d`;
        const gnUrl = 'https://news.google.com/rss/search?q=' +
          encodeURIComponent(qq + ' ' + when) + '&hl=en-AU&gl=AU&ceid=AU:en';
        const r = await fetch(gnUrl, {
          headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
          signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
        });
        if (!r.ok) return jsonResp({ error: `gnews_${r.status}` }, 502);
        const now = Date.now();
        let items = parseFeedXml(await r.text()).map(it => {
          const t = Date.parse(it.date || '');
          const out = { src: 'gnews', ...it };
          if (!isNaN(t)) { out.date = new Date(t).toISOString(); out.age = Math.max(0, Math.round((now - t) / 60000)); }
          else { out.date = ''; out.age = null; }
          // Google News titles end " - Outlet Name" - surface the outlet.
          const m = out.title.match(/\s[--]\s([^--]{2,40})$/);
          if (m) { out.outlet = m[1].trim(); out.title = out.title.slice(0, m.index).trim(); }
          return enrichItem(out);
        });
        items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
        items = items.slice(0, max);
        const out = JSON.stringify({ items, query: qq, window_hours: hours, generated: new Date(now).toISOString() });
        await kvPut(env.AXIOM_KV, cacheKey, out, 300);
        return new Response(out, { headers: CORS });
      } catch (e) {
        return jsonResp({ error: 'newsq_failed', detail: String(e).slice(0, 80) }, 502);
      }
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


    // ==========================================================================
    // V3 NEW ROUTE: /forum-detect?url=
    // Detects engine, returns metadata - useful for UI to show engine badge
    // ==========================================================================
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


    // ==========================================================================
    // V3 NEW ROUTE: /forum?url=&q=&engine=&page=
    // Universal forum thread-list scraper.
    //
    // Params:
    //   url    - full URL of forum board or search results page
    //   q      - optional search query (used for URL-based search + relevance filter)
    //   engine - optional: force engine (vbulletin4|vbulletin5|xenforo2|xenforo1|phpbb|mybb|discourse|invision|smf|generic)
    //   name   - optional: shortname from AU_FORUMS registry (e.g. 'bigfooty', 'overclockers')
    //   page   - optional: page number for pagination (default 1)
    //   ttl    - optional: cache TTL in seconds (default 300)
    // ==========================================================================
    // ==========================================================================
    // V3 NEW ROUTE: /forum?url=&q=&engine=&name=&page=&ttl=
    // Universal forum thread-list scraper - auto-detects vBulletin, XenForo, etc.
    // ==========================================================================
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

    // ==========================================================================
    // V3 NEW ROUTE: /forum-thread?url=&engine=&page=&q=
    // Scrapes full post content from any forum thread page.
    // ==========================================================================
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


    // ==========================================================================
    // v4.1 - AUTO-COLLECT JOB  GET /collect?topics=&notify=
    // 14 sources - per-source optimal fetch method - SSE progress via KV
    // ==========================================================================
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

      await saveProgress('running', `Job ${jobId} started - ${topics.length} topics`);

      // -- helper: push items + track source count --------------------------
      const push = (items, src) => {
        items.forEach(i => { i.src = i.src || src; allItems.push(i); });
        srcCounts[src] = (srcCounts[src] || 0) + items.length;
      };

      // -- FETCH HELPERS -----------------------------------------------------
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
          items.push({ src, text: title+(desc?' - '+desc:''), author: src, score:0, url:link, date, topic });
        }
        return items;
      };

      const delay = (ms) => new Promise(r=>setTimeout(r,ms));
      const jitter = () => delay(300 + Math.random()*500);

      // ======================================================================
      // SOURCE 1 - HackerNews  (METHOD: Algolia JSON API - best method, free)
      // ======================================================================
      await saveProgress('running', '* HackerNews - Algolia search API');
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
        await saveProgress('running', `  [ok] HackerNews: ${hnItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] HackerNews failed: ${e}`); }

      // ======================================================================
      // SOURCE 2 - Reddit  (METHOD: JSON API - append .json to any Reddit URL)
      // 6 AU political subreddits
      // ======================================================================
      await saveProgress('running', '* Reddit - .json API across 6 AU subreddits');
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
              src:'reddit', sr, text:p.data.title+(p.data.selftext?' - '+p.data.selftext.slice(0,200):''),
              author:p.data.author, score:p.data.score,
              url:'https://reddit.com'+p.data.permalink,
              date:new Date(p.data.created_utc*1000).toISOString(), topic,
            }));
            await delay(200);
          }
          await jitter();
        }
        push(rdItems, 'reddit');
        await saveProgress('running', `  [ok] Reddit: ${rdItems.length} items (6 subreddits)`);
      } catch(e) { await saveProgress('running', `  [x] Reddit failed: ${e}`); }

      // ======================================================================
      // SOURCE 3 - Guardian AU  (METHOD: Official Content API - JSON)
      // ======================================================================
      await saveProgress('running', '* Guardian AU - Content API (JSON)');
      if (env.GUARDIAN_KEY) {
        try {
          const guItems = [];
          for (const topic of topics.slice(0,5)) {
            const d = await getJSON(
              `https://content.guardianapis.com/search?q=${encodeURIComponent(topic)}`+
              `&tag=australia-news/australia-news&show-fields=trailText&page-size=5&api-key=${env.GUARDIAN_KEY}`
            );
            (d?.response?.results||[]).forEach(r => guItems.push({
              src:'guardian', text:r.webTitle+(r.fields?.trailText?' - '+stripHtml(r.fields.trailText).slice(0,200):''),
              author:'Guardian AU', score:0, url:r.webUrl, date:r.webPublicationDate, topic,
            }));
            await jitter();
          }
          push(guItems, 'guardian');
          await saveProgress('running', `  [ok] Guardian AU: ${guItems.length} items`);
        } catch(e) { await saveProgress('running', `  [x] Guardian failed: ${e}`); }
      } else {
        await saveProgress('running', '  (!) Guardian skipped - no GUARDIAN_KEY set');
      }

      // ======================================================================
      // SOURCE 4 - ABC News Politics  (METHOD: RSS feed - XML parse)
      // Politics-specific feed: feed/51120 + top stories: feed/2942460
      // ======================================================================
      await saveProgress('running', '* ABC News - RSS feeds (Politics + Top Stories)');
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
        await saveProgress('running', `  [ok] ABC News: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] ABC failed: ${e}`); }

      // ======================================================================
      // SOURCE 5 - SBS News  (METHOD: RSS feed - XML parse)
      // ======================================================================
      await saveProgress('running', '* SBS News - RSS feed');
      try {
        const sbsItems = [];
        const xml = await getXML('https://www.sbs.com.au/news/feed');
        for (const topic of topics) sbsItems.push(...parseRSS(xml||'', 'sbs', topic));
        const deduped = [...new Map(sbsItems.map(i=>[i.url,i])).values()];
        push(deduped, 'sbs');
        await saveProgress('running', `  [ok] SBS News: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] SBS failed: ${e}`); }

      // ======================================================================
      // SOURCE 6 - SMH / Sydney Morning Herald  (METHOD: RSS - XML parse)
      // ======================================================================
      await saveProgress('running', '* Sydney Morning Herald - RSS');
      try {
        const smhItems = [];
        const xml = await getXML('https://www.smh.com.au/rss/feed.xml');
        for (const topic of topics) smhItems.push(...parseRSS(xml||'', 'smh', topic));
        const deduped = [...new Map(smhItems.map(i=>[i.url,i])).values()];
        push(deduped, 'smh');
        await saveProgress('running', `  [ok] SMH: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] SMH failed: ${e}`); }

      // ======================================================================
      // SOURCE 7 - The Age  (METHOD: RSS - XML parse)
      // ======================================================================
      await saveProgress('running', '* The Age (Melbourne) - RSS');
      try {
        const ageItems = [];
        const xml = await getXML('https://www.theage.com.au/rss/feed.xml');
        for (const topic of topics) ageItems.push(...parseRSS(xml||'', 'theage', topic));
        const deduped = [...new Map(ageItems.map(i=>[i.url,i])).values()];
        push(deduped, 'theage');
        await saveProgress('running', `  [ok] The Age: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] The Age failed: ${e}`); }

      // ======================================================================
      // SOURCE 8 - The Conversation AU  (METHOD: RSS Atom feed - XML parse)
      // academic/expert analysis on AU politics
      // ======================================================================
      await saveProgress('running', '* The Conversation AU - Atom RSS feed');
      try {
        const convItems = [];
        const xml = await getXML('https://theconversation.com/au/topics/australian-politics-671/articles.atom');
        for (const topic of topics) convItems.push(...parseRSS(xml||'', 'conversation', topic));
        const deduped = [...new Map(convItems.map(i=>[i.url,i])).values()];
        push(deduped, 'conversation');
        await saveProgress('running', `  [ok] The Conversation: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] The Conversation failed: ${e}`); }

      // ======================================================================
      // SOURCE 9 - Crikey  (METHOD: RSS feed - XML parse)
      // Independent Australian political journalism
      // ======================================================================
      await saveProgress('running', '* Crikey - RSS feed');
      try {
        const crikeyItems = [];
        const xml = await getXML('https://www.crikey.com.au/feed/');
        for (const topic of topics) crikeyItems.push(...parseRSS(xml||'', 'crikey', topic));
        const deduped = [...new Map(crikeyItems.map(i=>[i.url,i])).values()];
        push(deduped, 'crikey');
        await saveProgress('running', `  [ok] Crikey: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] Crikey failed: ${e}`); }

      // ======================================================================
      // SOURCE 10 - Canberra Times  (METHOD: RSS - XML parse)
      // National politics focus from capital
      // ======================================================================
      await saveProgress('running', '* Canberra Times - RSS');
      try {
        const ctItems = [];
        const xml = await getXML('https://www.canberratimes.com.au/rss.xml');
        for (const topic of topics) ctItems.push(...parseRSS(xml||'', 'canberratimes', topic));
        const deduped = [...new Map(ctItems.map(i=>[i.url,i])).values()];
        push(deduped, 'canberratimes');
        await saveProgress('running', `  [ok] Canberra Times: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] Canberra Times failed: ${e}`); }

      // ======================================================================
      // SOURCE 10b - Extended AU newswire  (METHOD: shared AU_FEEDS registry)
      // Fans out across the rest of the registry not collected individually
      // above (Nine federal/regional, AFR, Guardian politics, independents,
      // news.com.au, AAP, InDaily...). Each feed: one fetch, parsed per topic.
      // ======================================================================
      await saveProgress('running', '* Extended AU newswire - registry feeds');
      try {
        const EXTRA_FEED_KEYS = [
          'smh_pol', 'brisbanetimes', 'watoday', 'afr', 'guardian_pol',
          'newdaily', 'michaelwest', 'independentau', 'menadue',
          'saturdaypaper', 'junkee', 'newscomau', 'aap', 'indaily',
          // finance / economy with political nexus (v8)
          'macrobusiness', 'convo_business',
          'abc_business', 'guardian_biz', 'smartcompany', 'investordaily',
          // economic institutions & think-tanks
          'rba', 'lowy', 'grattan', 'ausinstitute', 'insidestory',
          // topical Google News AU sweeps (economy, jobs, housing, energy...)
          'gnews_econ', 'gnews_rates', 'gnews_jobs', 'gnews_ir',
          'gnews_housing', 'gnews_energy', 'gnews_immig', 'gnews_states',
          'gnews_election',
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
        await saveProgress('running', `  [ok] Extended newswire: ${extraTotal} items across ${EXTRA_FEED_KEYS.length} feeds`);
      } catch(e) { await saveProgress('running', `  [x] Extended newswire failed: ${e}`); }

      // ======================================================================
      // SOURCE 11 - 9News Politics  (METHOD: HTML scrape - CSS selectors)
      // Nine Network news site - no RSS for politics, scrape required
      // ======================================================================
      await saveProgress('running', '* 9News - HTML scrape (article cards)');
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
        await saveProgress('running', `  [ok] 9News: ${nineItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] 9News failed: ${e}`); }

      // ======================================================================
      // SOURCE 12 - BigFooty Politics  (METHOD: XenForo2 HTML scrape)
      // XF2 structItem thread rows, node 229 = AU Politics
      // ======================================================================
      await saveProgress('running', '* BigFooty Politics - XenForo2 HTML scrape');
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
        await saveProgress('running', `  [ok] BigFooty: ${bfItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] BigFooty failed: ${e}`); }

      // ======================================================================
      // SOURCE 13 - Whirlpool Politics  (METHOD: Custom HTML scrape)
      // Whirlpool uses CFML - search results page with archive links
      // Note: "In the News" forum requires login, use search endpoint instead
      // ======================================================================
      await saveProgress('running', '* Whirlpool - search endpoint scrape');
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
        await saveProgress('running', `  [ok] Whirlpool: ${wpItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] Whirlpool failed: ${e}`); }

      // ======================================================================
      // SOURCE 14 - OzPolitic  (METHOD: RSS feed + YaBB HTML scrape fallback)
      // ======================================================================
      await saveProgress('running', '* OzPolitic - RSS feed + YaBB HTML fallback');
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
        await saveProgress('running', `  [ok] OzPolitic: ${deduped.length} items`);
      } catch(e) { await saveProgress('running', `  [x] OzPolitic failed: ${e}`); }

      // ======================================================================
      // SOURCE 15 - HotCopper Politics  (METHOD: XenForo HTML scrape)
      // Finance/politics crossover forum
      // ======================================================================
      await saveProgress('running', '* HotCopper Politics - XenForo HTML scrape');
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
        await saveProgress('running', `  [ok] HotCopper: ${hcItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] HotCopper failed: ${e}`); }

      // ======================================================================
      // INTERNATIONAL - BBC, Reuters, AP on AU politics
      // METHOD: RSS feeds filtered to Australia-relevant stories
      // ======================================================================
      await saveProgress('running', '* International - BBC/Reuters/AP (Australia filter)');
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
        await saveProgress('running', `  [ok] International (BBC/Reuters): ${intlItems.length} items`);
      } catch(e) { await saveProgress('running', `  [x] International feeds failed: ${e}`); }

      // ======================================================================
      // FINALISE
      // ======================================================================
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

    // ==========================================================================
    // v4 - GET /collect-status
    // Returns latest job result from KV - polled by AXIOM UI
    // ==========================================================================
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

    // ==========================================================================
    // v4 - GET /collect-history?limit=10
    // Returns a list of recent job IDs stored in KV
    // ==========================================================================
    if (path === '/collect-history') {
      const limit = parseInt(reqUrl.searchParams.get('limit') || '10', 10) || 10;
      try {
        const keys = await kvListJobs(env.AXIOM_KV, limit);
        return jsonResp({ jobs: keys });
      } catch {
        return jsonResp({ jobs: [] });
      }
    }

    // -- DEFAULT / health check -----------------------------------------------
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

  // Cron Trigger entry point - called by Cloudflare scheduler
  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleScheduled(env));
  },
};


// ==============================================================================
// CRON TRIGGER HANDLER
// Runs automatically on the schedule defined in wrangler.toml:
//   [triggers]
//   crons = ["0 */6 * * *"]   <- every 6 hours
//   crons = ["0 21 * * *"]    <- daily at 7am AEST (21:00 UTC)
// ==============================================================================
async function handleScheduled(env) {
  console.log('AXIOM Auto-Collect triggered at', new Date().toISOString());

  // Pre-warm the default /allnews snapshot so dashboard loads are instant,
  // and append a pulse-history point (share-of-voice + tone time series).
  try {
    const snap = await buildAllNews(env, { q: '', max: 120, hours: 24 });
    await arcNewsSnap(env, snap); // hourly permanent archive - runs with nobody watching
  } catch (e) {}
  try { await snapshotPulse(env); } catch (e) {}
  try {
    const [ms, rd, bs] = await Promise.all([
      socialMastodon('auspol').catch(() => []),
      socialReddit('auspol').catch(() => []),
      socialBsky('auspol').catch(() => []),
    ]);
    await archiveItems(env, 'social', [...ms, ...rd, ...bs].map(p => ({
      src: p.network, title: p.author || '', body: p.text, url: p.url, author: p.handle || p.author,
      ts: Date.parse(p.date) || 0, meta: { tag: 'auspol', ups: p.ups },
    })));
  } catch (e) {}
  try {
    const jf = await Promise.allSettled([forumOzRss(), forumWhirlpoolQ('politics'), forumBigfootyLatest(), forumHotcopperLatest()]);
    const th = jf.flatMap(s => (s.status === 'fulfilled' ? s.value : []));
    await archiveItems(env, 'forum', th.map(t => ({
      src: t.source, title: t.text, url: t.url, ts: Date.parse(t.date) || 0,
    })));
  } catch (e) {}

  // Default watchlist topics - overridable via KV
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
        if (r.ok) { const d = await r.json(); (d?.data?.children||[]).forEach(p => items.push({ src:'reddit', sr, text:p.data.title+(p.data.selftext?' - '+p.data.selftext.slice(0,200):''), author:p.data.author, score:p.data.score, url:'https://reddit.com'+p.data.permalink, date:new Date(p.data.created_utc*1000).toISOString(), topic })); }
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


