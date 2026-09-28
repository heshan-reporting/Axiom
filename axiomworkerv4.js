
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
 * |  GET  /perf/ads|social|comments?ns=&days=  Audience view aggregates  |
 * |                               from archive kinds campaign/engagement/  |
 * |                               adcreative/social_post/comments (read).  |
 * |  POST /perf/analyse {ns,days} Claude sentiment/theme analysis of the   |
 * |                               recent comments (full role).             |
 * |  GET  /meta/status            Meta direct: configured accounts + last  |
 * |  POST /meta/sync {since,until} sync. Campaign daily insights -> kind   |
 * |                               'campaign'; Ad Library AU political ads  |
 * |                               per client issue -> kind 'oppads'.       |
 * |  POST /research {q,ns?,hours?} Deep research agent - Claude plans      |
 * |                               queries, sweeps Google News, reads pages |
 * |                               live, cross-refs archive + Mind, returns |
 * |                               a cited dossier. Key-gated (full role).  |
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
  'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With, X-Axiom-Key',
  'Access-Control-Max-Age':           '86400',
  'Content-Type':                     'application/json',
};

// Full CORS headers without Content-Type (for non-JSON responses)
const CORS_ONLY = {
  'Access-Control-Allow-Origin':      '*',
  'Access-Control-Allow-Methods':     'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers':     'Content-Type, Authorization, X-Requested-With, X-Axiom-Key',
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
  // -- Source expansion (v11, research dossier 2026-08-29). URL patterns
  //    corroborated by search; verify live with /rss?feed=<key> after deploy.
  //    Dead feeds fail soft (allSettled + circuit breaker). --
  sevennews_pol: 'https://7news.com.au/politics/feed',                      // 7News politics (section/feed pattern)
  tallyroom:     'https://www.tallyroom.com.au/feed',                       // Ben Raue - electorate-level analysis
  kevinbonham:   'https://kevinbonham.blogspot.com/feeds/posts/default?alt=rss', // poll aggregation + psephology
  johnquiggin:   'https://johnquiggin.com/feed',                            // economics commentary
  tastimes:      'https://tasmaniantimes.com/feed',                         // Tasmanian independent
  rba_speeches:  'https://www.rba.gov.au/rss/rss-cb-speeches.xml',          // RBA speeches (documented RSS)
  ozbargain:     'https://www.ozbargain.com.au/deals/feed',                 // retail deal-hunting - cost-of-living ground truth
  // -- Government & official (v12) - primary sources straight from the source.
  //    health_gov URL is documented by the department; industry_gov follows the
  //    same govCMS /news/rss.xml pattern (the department runs an RSS program).
  //    The gnews_gov* sweeps ride Google News' index of the ministerial and
  //    agency domains - robust even where a site hides its own feed. --
  health_gov:    'https://www.health.gov.au/news/rss.xml',
  industry_gov:  'https://www.industry.gov.au/news/rss.xml',                // critical-minerals portfolio
  gnews_govfed:  'https://news.google.com/rss/search?q=site:ministers.treasury.gov.au%20OR%20site:pm.gov.au%20OR%20site:treasury.gov.au&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_govstate:'https://news.google.com/rss/search?q=site:statements.qld.gov.au%20OR%20site:mediastatements.wa.gov.au%20OR%20site:nsw.gov.au%2Fmedia-releases&hl=en-AU&gl=AU&ceid=AU:en',
  gnews_govagency:'https://news.google.com/rss/search?q=site:abs.gov.au%20OR%20site:accc.gov.au%20OR%20site:aec.gov.au&hl=en-AU&gl=AU&ceid=AU:en',
  // -- Government round 2 (operator-supplied ACT endpoints + parliamentary library) --
  act_ministers: 'https://www.cmtedd.act.gov.au/open_government/functions/functionality/media_release_rss_feeds/latest_minister_media_releases_rss',
  act_pettersson:'https://www.cmtedd.act.gov.au/open_government/functions/functionality/media_release_rss_feeds/michael-pettersson-mla-media-releases-rss',
  flagpost:      'https://parliamentflagpost.blogspot.com/feeds/posts/default?alt=rss', // Parliamentary Library FlagPost (Blogspot mirror)
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
    // podcast and some CMS feeds carry no <link>: fall back to a permalink guid, then the enclosure
    const link  = (b.match(/<link[^>]*href="([^"]+)"/) || b.match(/<link[^>]*>(https?[^<]+)<\/link>/) || b.match(/<guid[^>]*>\s*(https?[^<\s]+)\s*<\/guid>/) || b.match(/<enclosure[^>]*url="([^"]+)"/) || [])[1]?.trim();
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
async function buildAllNews(env, { q = '', max = 60, hours = 72, debug = false, onHealth = null } = {}) {
  const qw  = q.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3);
  const cacheKey = `allnews2_${q || 'all'}_${max}_${hours}`;
  const now  = Date.now();
  // core feeds the operator switched off in the Sources view stay off here too
  const off  = env.MIND_DB ? await sourcesCoreOff(env) : new Set();
  const keys = Object.keys(AU_FEEDS).filter(k => !off.has(k));
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
  // the cron passes a reporter so the Source Registry mirrors each core feed's health
  if (onHealth) { try { await onHealth(health); } catch (e) {} }

  let items = [];
  results.forEach((v) => { if (Array.isArray(v)) items.push(...v); });
  // The registry's sources (mastheads without a working feed, official offices,
  // sector press, podcasts...) are swept by the cron into the archive; merge
  // their recent rows here so /allnews is the whole estate, not just the core.
  let registry = 0;
  if (env.MIND_DB) {
    try {
      const since = now - Math.min(hours, 72) * 3600000;
      const rs = await env.MIND_DB.prepare("SELECT src,title,body,url,ts,meta FROM arc_items WHERE kind='news' AND ts>? AND json_extract(meta,'$.reg')=1 ORDER BY ts DESC LIMIT 400").bind(since).all();
      (rs.results || []).forEach(r => {
        let m = {}; try { m = JSON.parse(r.meta || '{}') || {}; } catch (e) { m = {}; }
        items.push({ src: r.src, title: r.title || '', link: r.url, date: r.ts ? new Date(r.ts).toISOString() : '', desc: String(r.body || '').slice(0, 240), reg: 1, tier: m.tier || '', method: m.method || '', issues: m.issues || [] });
        registry++;
      });
    } catch (e) {}
  }

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
  const payload = { items, sources, feeds: keys.length, registry, generated: new Date(now).toISOString(), window_hours: hours };
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
  // Verified live via rdt-cli field research 2026-08-31: AU politics
  // discussion now also runs through AusPol, OpenAussie and AusNewsWire.
  auspol:    'AustralianPolitics+australia+australian+AusPol+OpenAussie+AusNewsWire',
  australia: 'australia+AustralianPolitics+australian+OpenAussie',
  economy:   'AusFinance+AusEcon+AustralianPolitics',
  housing:   'AusProperty+AusPropertyChat+AusFinance+shitrentals',
  climate:   'AustralianPolitics+australia+OpenAussie',
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

/* Reddit's own political-ads transparency feed (r/RedditPoliticalAds): every
 * political ad Reddit runs is disclosed there as a post. Mostly US; the AU
 * filter keeps only what touches Australian politics. Archived as kind
 * 'oppads' (opposition/paid-political advertising) beside the Meta and
 * Google sweeps. */
const OPPADS_AU = /australia|australian|\bnsw\b|victoria|queensland|tasmania|canberra|\balp\b|\blabor\b|liberal party|the greens|one nation|teal|albanese|ley\b|littleproud|hanson|pocock|minerals council|fuel tax|gas industry|housing australia/i;
async function socialRedditPoliticalAds() {
  const out = [];
  try {
    const r = await fetch('https://api.reddit.com/r/RedditPoliticalAds/new?limit=100&raw_json=1',
      { headers: { 'User-Agent': 'axiom-au-intel/1.0 (AU political media dashboard)' }, signal: abortAfter(6000) });
    if (!r.ok) return out;
    const d = await r.json();
    ((d && d.data && d.data.children) || []).forEach((c) => {
      const p = c && c.data; if (!p) return;
      const text = (p.title || '') + (p.selftext ? ' - ' + p.selftext : '');
      if (!OPPADS_AU.test(text)) return;
      out.push({
        src: 'reddit_ads', title: stripHtml(p.title || '').slice(0, 300), body: stripHtml(p.selftext || '').slice(0, 2000),
        url: 'https://www.reddit.com' + (p.permalink || ''), author: p.author || '',
        ts: (p.created_utc || 0) * 1000, meta: { platform: 'reddit', disclosed: true },
      });
    });
  } catch (e) {}
  return out;
}

/* == META, DIRECT (no third party) ==========================================
 * Two independent feeds off Meta's Graph API:
 *   1. Own-account performance: META_TOKEN (a Business System User token
 *      with ads_read + read_insights) + META_AD_ACCOUNTS
 *      ("act_123:mca,act_456:aep" - account to client namespace). Campaign
 *      level, one row per campaign per day -> archive kind 'campaign'.
 *   2. Opposition watch: META_USER_TOKEN (an ID-verified user's token with
 *      ads_read) sweeps the Ad Library for AU political/issue ads matching
 *      each client issue -> archive kind 'oppads', src 'meta'.
 * Both are optional, both fail soft, both dedupe on url so re-runs are safe.
 * ========================================================================== */
const META_API = 'https://graph.facebook.com/v21.0';
function metaAccounts(env) {
  return String(env.META_AD_ACCOUNTS || '').split(/[,\s]+/).filter(Boolean).map(s => {
    const [acct, ns] = s.split(':');
    const clean = String(ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
    return { acct: /^act_/.test(acct) ? acct : 'act_' + acct, ns: clean || 'cmm' };
  });
}
async function metaGet(url) {
  const r = await fetch(url, { signal: abortAfter(20000) });
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(String(d.error.message || d.error.type || 'graph_error').slice(0, 160));
  return d;
}
function metaActions(list, type) {
  const a = (list || []).find(x => x.action_type === type);
  return a ? Number(a.value) || 0 : 0;
}
/** Pull campaign-level daily insights for every configured account. */
async function metaInsights(env, since, until) {
  if (!env.META_TOKEN) return { ok: false, error: 'meta_not_configured' };
  const accts = metaAccounts(env);
  if (!accts.length) return { ok: false, error: 'no_ad_accounts' };
  const fields = 'campaign_id,campaign_name,objective,spend,impressions,reach,clicks,cpc,cpm,ctr,frequency,actions,date_start,date_stop';
  const range = since ? '&time_range=' + encodeURIComponent(JSON.stringify({ since: since, until: until || since })) : '&date_preset=last_7d';
  const out = { ok: true, accounts: 0, rows: 0, errors: [] };
  for (const a of accts) {
    let url = META_API + '/' + a.acct + '/insights?level=campaign&time_increment=1&limit=500&fields=' + fields + range + '&access_token=' + encodeURIComponent(env.META_TOKEN);
    let rows = [];
    try {
      for (let page = 0; url && page < 20; page++) {
        const d = await metaGet(url);
        (d.data || []).forEach(x => {
          const spend = Number(x.spend) || 0, imp = Number(x.impressions) || 0, clicks = Number(x.clicks) || 0;
          const leads = metaActions(x.actions, 'lead') + metaActions(x.actions, 'onsite_conversion.lead_grouped');
          const lpv = metaActions(x.actions, 'landing_page_view');
          rows.push({
            src: 'meta', title: (x.campaign_name || x.campaign_id) + ' - ' + x.date_start,
            body: 'Spend $' + spend.toFixed(2) + ', ' + imp + ' impressions, reach ' + (x.reach || 0) + ', ' + clicks + ' clicks (CTR ' + (Number(x.ctr) || 0).toFixed(2) + '%, CPC $' + (Number(x.cpc) || 0).toFixed(2) + ', CPM $' + (Number(x.cpm) || 0).toFixed(2) + ')' + (leads ? ', ' + leads + ' leads (CPL $' + (spend / leads).toFixed(2) + ')' : '') + (lpv ? ', ' + lpv + ' landing views' : '') + '. Objective ' + (x.objective || '') + '.',
            url: 'x:campaign:meta:' + x.campaign_id + ':' + x.date_start, author: a.acct,
            ts: Date.parse(x.date_start + 'T12:00:00Z') || Date.now(),
            meta: { ns: a.ns, platform: 'meta', account: a.acct, campaign: x.campaign_name, campaign_id: x.campaign_id, day: x.date_start,
              spend: spend, impressions: imp, reach: Number(x.reach) || 0, clicks: clicks, ctr: Number(x.ctr) || 0, cpc: Number(x.cpc) || 0, cpm: Number(x.cpm) || 0, leads: leads, lpv: lpv, objective: x.objective || '' },
          });
        });
        url = d.paging && d.paging.next ? d.paging.next : null;
      }
      out.accounts++;
      // archive in slices (archiveItems caps a batch at 150)
      for (let i = 0; i < rows.length; i += 150) out.rows += await archiveItems(env, 'campaign', rows.slice(i, i + 150));
    } catch (e) { out.errors.push(a.acct + ': ' + String(e.message || e).slice(0, 120)); }
  }
  return out;
}
/** Sweep the Meta Ad Library for AU political/issue ads on each client issue. */
async function metaAdLibrary(env) {
  if (!env.META_USER_TOKEN) return { ok: false, error: 'meta_user_token_missing' };
  const terms = {};
  CLIENT_ISSUES.forEach(ci => { terms[ci.label] = ci.ns; });
  const out = { ok: true, terms: 0, rows: 0, errors: [] };
  for (const [label, ns] of Object.entries(terms)) {
    try {
      const url = META_API + '/ads_archive?ad_reached_countries=' + encodeURIComponent('["AU"]') + '&ad_type=POLITICAL_AND_ISSUE_ADS&ad_active_status=ALL&search_terms=' + encodeURIComponent(label)
        + '&fields=id,page_name,bylines,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,spend,impressions,currency,ad_snapshot_url,publisher_platforms&limit=100&access_token=' + encodeURIComponent(env.META_USER_TOKEN);
      const d = await metaGet(url);
      const rows = (d.data || []).map(x => ({
        src: 'meta', title: (x.page_name || 'unknown page') + ': ' + ((x.ad_creative_link_titles || [])[0] || (x.ad_creative_bodies || [''])[0] || 'ad').slice(0, 200),
        body: ((x.ad_creative_bodies || []).join(' | ')).slice(0, 2000) + '\nSpend ' + (x.spend ? x.spend.lower_bound + '-' + (x.spend.upper_bound || '') + ' ' + (x.currency || '') : '?') + ', impressions ' + (x.impressions ? x.impressions.lower_bound + '-' + (x.impressions.upper_bound || '') : '?') + '. Paid for by: ' + (x.bylines || '?') + '. Platforms: ' + ((x.publisher_platforms || []).join(', ')) + '. Running ' + (x.ad_delivery_start_time || '?') + ' to ' + (x.ad_delivery_stop_time || 'now') + '.',
        url: x.ad_snapshot_url || ('x:oppads:meta:' + x.id), author: x.page_name || '',
        ts: Date.parse(x.ad_delivery_start_time || '') || Date.now(),
        meta: { platform: 'meta', issue: label, ns: ns, page: x.page_name, funder: x.bylines || '', spend_lo: x.spend && x.spend.lower_bound, spend_hi: x.spend && x.spend.upper_bound, active: !x.ad_delivery_stop_time },
      }));
      out.terms++;
      for (let i = 0; i < rows.length; i += 150) out.rows += await archiveItems(env, 'oppads', rows.slice(i, i + 150));
    } catch (e) { out.errors.push(label + ': ' + String(e.message || e).slice(0, 120)); }
  }
  return out;
}
/* Comment sentiment for audience replies (colloquial, unlike the headline
 * lexicon in TONE_POS/TONE_NEG). -1 hostile, 1 supportive, 0 neutral. */
const CMT_POS = /\b(agree|well said|spot on|100 ?%|thank you|thanks|love (this|it)|great|good on (you|them|ya)|exactly|so true|support(ed|ing)?|keep (it )?up|finally|about time|legend|onya|well done|fair enough|makes sense)\b|\+1|<3/i;
const CMT_NEG = /\b(lies?|lying|liar|rubbish|garbage|\bbs\b|bullshit|scam|greedy?|greed|disgrace(ful)?|disgusting|joke|pathetic|propaganda|shame(ful)?|corrupt(ion)?|hypocri\w*|nonsense|rort|polluters?|wrong|nobody believes|sick of|fed up|rip ?off|dodgy|spin|misleading|shill|paid for|who funds|dishonest|disinformation|misinformation|lobby(ists?)?|at our expense|pay(ing)? (more|their|five|ten|double)|should be paying|billionaires?|pretend(ing)?|con job|another discount|tax the|rip(ping)? (us|off)|handouts?|subsid(y|ies|ised))\b/i;
function commentTone(t) { const s = String(t || ''); if (CMT_NEG.test(s)) return -1; if (CMT_POS.test(s)) return 1; return 0; }
/** Sweep comments on the posts behind each account's recent ads (needs a
 * token with pages_read_engagement + pages_read_user_content on the pages).
 * One row per comment, kind 'comments', deduped on comment id; the author's
 * name is deliberately not stored - the text and its tone are the signal. */
/** The distinct page posts behind an account's recent ads, each with the ad and
 *  campaign that carried it. Shared by the comment and reaction sweeps. */
async function metaAdPosts(env, acct) {
  const tok = '&access_token=' + encodeURIComponent(env.META_TOKEN);
  const filt = encodeURIComponent(JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]));
  const ads = await metaGet(META_API + '/' + acct + '/ads?fields=id,name,campaign{name},creative{effective_object_story_id}&filtering=' + filt + '&limit=200' + tok);
  const posts = new Map();
  (ads.data || []).forEach(ad => {
    const sid = ad.creative && ad.creative.effective_object_story_id;
    if (sid && !posts.has(sid)) posts.set(sid, { ad: ad.name || ad.id, id: ad.id || '', campaign: (ad.campaign && ad.campaign.name) || '' });
  });
  return posts;
}
async function metaComments(env, perAccount = 40) {
  if (!env.META_TOKEN) return { ok: false, error: 'meta_not_configured' };
  const accts = metaAccounts(env);
  if (!accts.length) return { ok: false, error: 'no_ad_accounts' };
  const out = { ok: true, posts: 0, rows: 0, errors: [] };
  const tok = '&access_token=' + encodeURIComponent(env.META_TOKEN);
  for (const a of accts) {
    try {
      const posts = await metaAdPosts(env, a.acct);
      let n = 0;
      for (const [sid, ctx] of posts) {
        if (n++ >= perAccount) break;
        try {
          const c = await metaGet(META_API + '/' + sid + '/comments?fields=id,message,created_time,like_count,comment_count&order=reverse_chronological&limit=100' + tok);
          const rows = (c.data || []).filter(x => x.message && x.message.trim()).map(x => ({
            src: 'meta', title: 'Comment on "' + String(ctx.ad).slice(0, 80) + '"', body: String(x.message).slice(0, 2000),
            url: 'x:comment:meta:' + x.id, author: '', tone: commentTone(x.message),
            ts: Date.parse(x.created_time || '') || Date.now(),
            meta: { ns: a.ns, platform: 'meta', account: a.acct, campaign: ctx.campaign, ad: ctx.ad, ad_id: ctx.id || '', post_id: sid,
              permalink: 'https://www.facebook.com/' + sid, likes: x.like_count || 0, replies: x.comment_count || 0, tone: commentTone(x.message),
              // which client issue the audience is arguing about, same lexicon as everywhere else
              issues: issueTag(String(ctx.ad || '') + ' ' + x.message), issue: issueTag(String(ctx.ad || '') + ' ' + x.message)[0] || '' },
          }));
          out.posts++;
          for (let i = 0; i < rows.length; i += 150) out.rows += await archiveItems(env, 'comments', rows.slice(i, i + 150));
        } catch (e) { out.errors.push(sid + ': ' + String(e.message || e).slice(0, 100)); if (out.errors.length > 20) break; }
      }
    } catch (e) { out.errors.push(a.acct + ': ' + String(e.message || e).slice(0, 120)); }
  }
  return out;
}
/* Reaction mix on the posts behind the ads. On political advertising LIKE,
 * LOVE and CARE read as agreement and ANGRY as hostility; HAHA is usually
 * mockery, so it counts against. WOW and SAD are genuinely ambiguous - they
 * are reported but kept out of the score. score = (like+love+care - angry -
 * haha) / total, so +1 is unanimous agreement and -1 unanimous hostility. */
const META_REACTIONS = ['LIKE', 'LOVE', 'CARE', 'WOW', 'HAHA', 'SAD', 'ANGRY'];
function metaSummaryCount(x) { return (x && x.summary && Number(x.summary.total_count)) || 0; }
/** One row per post per day, kind 'reactions', so the mix becomes a trend.
 *  Re-running inside a day is a no-op (url carries the date). */
async function metaReactions(env, perAccount = 40) {
  if (!env.META_TOKEN) return { ok: false, error: 'meta_not_configured' };
  const accts = metaAccounts(env);
  if (!accts.length) return { ok: false, error: 'no_ad_accounts' };
  const out = { ok: true, posts: 0, rows: 0, errors: [] };
  const tok = '&access_token=' + encodeURIComponent(env.META_TOKEN);
  const day = new Date().toISOString().slice(0, 10);
  const rfields = META_REACTIONS.map(t => 'reactions.type(' + t + ').limit(0).summary(1).as(' + t.toLowerCase() + ')').join(',');
  for (const a of accts) {
    try {
      const posts = await metaAdPosts(env, a.acct);
      const rows = [];
      let n = 0;
      for (const [sid, ctx] of posts) {
        if (n++ >= perAccount) break;
        try {
          const p = await metaGet(META_API + '/' + sid + '?fields=message,permalink_url,created_time,shares,comments.limit(0).summary(1).as(cmt),' + rfields + tok);
          const r = {}; let total = 0;
          META_REACTIONS.forEach(t => { const v = metaSummaryCount(p[t.toLowerCase()]); r[t.toLowerCase()] = v; total += v; });
          const comments = metaSummaryCount(p.cmt);
          const shares = (p.shares && Number(p.shares.count)) || 0;
          const agree = r.like + r.love + r.care, against = r.angry + r.haha;
          const score = total ? Math.round(((agree - against) / total) * 1000) / 1000 : 0;
          rows.push({
            src: 'meta', title: 'Reactions on "' + String(ctx.ad).slice(0, 80) + '"',
            body: total + ' reactions on ' + day + ': ' + r.like + ' like, ' + r.love + ' love, ' + r.care + ' care, ' + r.wow + ' wow, ' + r.haha + ' haha, ' + r.sad + ' sad, ' + r.angry + ' angry. '
              + comments + ' comments, ' + shares + ' shares. Score ' + score.toFixed(3) + '. Post: ' + String(p.message || '').replace(/\s+/g, ' ').slice(0, 400),
            url: 'x:reactions:meta:' + sid + ':' + day, author: '',
            tone: against > agree ? -1 : agree > against * 4 ? 1 : 0,
            ts: Date.now(),
            meta: { ns: a.ns, platform: 'meta', account: a.acct, campaign: ctx.campaign, ad: ctx.ad, post_id: sid, day: day,
              total: total, like: r.like, love: r.love, care: r.care, wow: r.wow, haha: r.haha, sad: r.sad, angry: r.angry,
              agree: agree, against: against, score: score, comments: comments, shares: shares, permalink: p.permalink_url || '' },
          });
          out.posts++;
        } catch (e) { out.errors.push(sid + ': ' + String(e.message || e).slice(0, 100)); if (out.errors.length > 20) break; }
      }
      for (let i = 0; i < rows.length; i += 150) out.rows += await archiveItems(env, 'reactions', rows.slice(i, i + 150));
    } catch (e) { out.errors.push(a.acct + ': ' + String(e.message || e).slice(0, 120)); }
  }
  return out;
}
/** Cron hook: every Meta feed, at most every 6 hours. */
async function metaCron(env) {
  if (!env.META_TOKEN && !env.META_USER_TOKEN) return;
  const last = Number(await kvGet(env.AXIOM_KV, 'meta_last_sync') || 0);
  if (Date.now() - last < 6 * 3600000) return;
  await kvPut(env.AXIOM_KV, 'meta_last_sync', String(Date.now()), 86400);
  const r = {};
  try { r.insights = await metaInsights(env); } catch (e) { r.insights = { error: String(e).slice(0, 100) }; }
  try { r.library = await metaAdLibrary(env); } catch (e) { r.library = { error: String(e).slice(0, 100) }; }
  try { r.comments = await metaComments(env); } catch (e) { r.comments = { error: String(e).slice(0, 100) }; }
  try { r.reactions = await metaReactions(env); } catch (e) { r.reactions = { error: String(e).slice(0, 100) }; }
  await kvPut(env.AXIOM_KV, 'meta_last_result', JSON.stringify(r).slice(0, 4000), 7 * 86400);
}

// ==============================================================================
// REDDIT SIGNAL - the Australian political subreddits, threads and comments.
// Threads land as kind 'reddit_thread' (url = permalink) and comments as kind
// 'reddit_comment' (url = x:rcmt:<id>), each tagged with the client issues it
// touches and a tone read from the colloquial lexicon. Usernames are never
// stored: the argument is the signal, not the person. All reads go through
// api.reddit.com with a descriptive UA, as Reddit asks of unauthenticated
// clients; www.reddit.com 403s generic cloud user agents.
// ==============================================================================
// Where the arguments our clients care about actually happen: national politics
// and economics, the state and city subs where planning, energy bills, mining
// towns and pharmacies come up, and the trade subs.
// (r/victoria is Victoria, British Columbia, and refuses us anyway; r/melbourne
// is where the state's argument happens.)
const REDDIT_POLITICS = ['AustralianPolitics', 'australia', 'AusPol', 'AusFinance', 'AusEcon', 'auscorp',
  'melbourne', 'perth', 'brisbane', 'sydney', 'AusPropertyChat', 'AusRenovation', 'ausjdocs'];
// The keyword pass searches all of Reddit, so a generic client term - 'interest
// rates', 'gas prices', 'question time' - also finds American and British
// threads, and the wide matchers tag them. A hit outside the watched subs is
// kept only when something on it says Australia: the sub, a place, an
// institution, a politician, a masthead, or one of our clients' own terms.
// tools/reach-reddit.py carries the same expression (AU_RX) for the desktop.
// Every marker must mean Australia and nothing else. Not "smh" (Reddit slang),
// "the age" (a phrase), Medicare, PBS or ABC News (American too), "rising tide"
// or "market forces" (idioms), Darwin (the naturalist), Victoria (also BC).
const AU_RX = new RegExp([
  // places
  'austral|aussie|straya|\\bauspol\\b|ausvotes|springst|nswpol|qldpol|wapol|\\bnsw\\b|\\bqld\\b|queensland|tasmania|canberra|adelaide|hobart|brisbane|sydney|melbourne',
  'geelong|gippsland|ballarat|bendigo|wollongong|townsville|cairns|toowoomba|launceston|northern territory|\\bperth\\b(?! and kinross)|pilbara|bowen basin|beetaloo|narrabri|north ?west shelf|latrobe valley|murray.darling|hunter valley (coal|mine|mining)',
  'regional victoria|victorian? (government|premier|parliament|election|budget|labor|liberals?|nationals|treasurer|opposition)|victoria police|premier of victoria',
  // people and parties
  'albanese|peter dutton|sussan ley|littleproud|jim chalmers|chris bowen|plibersek|penny wong|jacinta allan|brad battin|chris minns|crisafulli|malinauskas|pauline hanson|barnaby joyce|jacqui lambie|david pocock|bob katter|michele bullock|angus taylor',
  '\\balp\\b|federal labor|labor government|australian greens|greens (senator|mp)|the nationals|nationals (mp|senator|leader)|teal independent|senate estimates|coalition (frontbench|opposition)',
  // institutions and things only Australia has
  '\\brba\\b|reserve bank of australia|centrelink|medicare (levy|rebate|card)|bulk.bill|\\bpbs (script|medicine|listing|co-?payment)|\\baemo\\b|\\baccc\\b|\\bato\\b|\\bnbn\\b|\\bcfmeu\\b|fair work (commission|ombudsman|act)|\\bapra\\b|productivity commission',
  // AUD only as money (game traders and forex quote it bare, everywhere)
  'superannuation|negative gearing|\\bhecs\\b|\\banzac\\b|\\bafl\\b|\\bnrl\\b|state of origin|triple j|australian dollars?|\\baud\\s?[$\\d]|[$\\d]\\s?aud\\b|\\ba\\$\\d',
  // brands and mastheads
  'woolworths|\\bwoolies\\b|\\bcoles\\b|bunnings|\\bqantas\\b|\\btelstra\\b|\\boptus\\b|\\bwestpac\\b|commbank|commonwealth bank|\\bafr\\b|abc\\.net\\.au|abc news australia|sydney morning herald|news\\.com\\.au|sky news australia|the australian\\b|guardian australia|newspoll|crikey|9news\\.com\\.au|7news\\.com\\.au',
  // our clients and their opponents, by their own names
  'minerals council|pharmacy guild|master builders|lock the gate|rising tide (blockade|protest|activists?|newcastle)|market forces (campaign|report|activists?)|hands off our fuel|fuel tax credits?|60.day dispensing|safeguard mechanism|nature positive|\\bepbc\\b|same job,? same pay|chemist warehouse|v/line',
  // the vernacular
  '\\bservo\\b|\\barvo\\b|\\bmaccas\\b|\\bbogan\\b|\\btradies?\\b|\\butes?\\b|fair dinkum',
].join('|'), 'i');
const AU_SUB_RX = /^(aus|australi|straya|melb|sydney|perth|brisbane|adelaide|canberra|hobart|darwin|queensland|tasmania|nsw|qld|geelong|goldcoast|wollongong)/i;
// The search term that found a thread is NOT evidence on its own: most client
// terms ("fuel tax credit", "gas prices", "rising tide protest") are ordinary
// English elsewhere, and AU_RX contains those very terms, so folding the query
// into the checked text passed every American hit. A query vouches for a thread
// only when the query itself names Australia.
const AU_QUERY_RX = /austral|aussie|\bauspol\b|\bnsw\b|\bqld\b|queensland|victoria|tasmania|canberra|adelaide|hobart|brisbane|sydney|melbourne|\bperth\b|gippsland|pilbara|beetaloo|north ?west shelf|jacinta allan|\bcfmeu\b|newspoll|pharmacy guild|chemist warehouse|hands off our fuel|minerals council|master builders|lock the gate|v\/line|duck hunting/i;
/** Is this thread about Australia? Watched sub, Australian-looking sub, a marker
 *  in its own text, or a search term that itself names Australia. */
function auRelevant(sub, text, q) {
  const s = String(sub || '');
  if (s && REDDIT_POLITICS.some(w => w.toLowerCase() === s.toLowerCase())) return true;
  if (s && AU_SUB_RX.test(s)) return true;
  // the words of the search term are struck out before the text is checked:
  // "fuel tax credit" is in AU_RX because it is a client's fight, but a Texan
  // post found by that very term has to say something else Australian
  let t = String(text || '');
  if (q) { try { t = t.replace(new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi'), ' '); } catch (e) {} }
  if (AU_RX.test(t)) return true;
  return !!q && AU_QUERY_RX.test(String(q));
}
const REDDIT_UA = { 'User-Agent': 'axiom-au-intel/1.0 (AU political media dashboard)' };
// Public hosts tried in turn when no app credentials are set. Reddit allows
// unauthenticated clients about ten requests a minute and blocks many
// datacenter ranges outright, so the reliable path is a script app:
// secrets REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET turn on OAuth below.
const REDDIT_HOSTS = ['https://api.reddit.com', 'https://old.reddit.com', 'https://www.reddit.com'];
const rdSleep = ms => (ms > 0 ? new Promise(res => setTimeout(res, ms)) : Promise.resolve());
function redditAuthed(env) { return !!(env && env.REDDIT_CLIENT_ID && env.REDDIT_CLIENT_SECRET); }
/** Gap between requests: authenticated clients get 60/min, anonymous ~10/min. */
function redditPace(env) {
  if (env && env.REDDIT_PACE_MS != null && env.REDDIT_PACE_MS !== '') return Math.max(0, parseInt(env.REDDIT_PACE_MS, 10) || 0);
  return redditAuthed(env) ? 650 : 1100;
}
/** Application-only OAuth token for a script app, cached in KV until it expires. */
async function redditToken(env) {
  if (!redditAuthed(env)) return null;
  const cached = await kvGet(env.AXIOM_KV, 'reddit_token');
  if (cached) return cached;
  const r = await fetch('https://www.reddit.com/api/v1/access_token', { method: 'POST',
    headers: Object.assign({ 'Authorization': 'Basic ' + btoa(env.REDDIT_CLIENT_ID + ':' + env.REDDIT_CLIENT_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' }, REDDIT_UA),
    body: 'grant_type=client_credentials', signal: abortAfter(9000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.access_token) throw new Error('reddit_oauth_' + (r.status || 'failed') + (d.error ? ':' + String(d.error).slice(0, 40) : ''));
  await kvPut(env.AXIOM_KV, 'reddit_token', d.access_token, Math.max(300, (Number(d.expires_in) || 3600) - 120));
  return d.access_token;
}
async function redditGet(env, path, timeoutMs) {
  const q = path + (path.indexOf('?') < 0 ? '?' : '&') + 'raw_json=1';
  const tok = await redditToken(env);
  if (tok) {
    const r = await fetch('https://oauth.reddit.com' + q, { headers: Object.assign({ 'Authorization': 'Bearer ' + tok }, REDDIT_UA), signal: abortAfter(timeoutMs || 9000) });
    if (r.status === 401) { try { await env.AXIOM_KV.delete('reddit_token'); } catch (e) {} throw new Error('reddit_oauth_401'); }
    if (r.status === 429) throw new Error('reddit_rate_limited');
    if (!r.ok) throw new Error('reddit_' + r.status);
    return r.json();
  }
  let last = 'reddit_unreachable';
  for (const host of REDDIT_HOSTS) {
    try {
      // the reddit.com hosts want an explicit .json suffix; api.reddit.com does not
      const url = host + (host.indexOf('api.') > 0 ? q : q.replace('?', '.json?'));
      const r = await fetch(url, { headers: REDDIT_UA, signal: abortAfter(timeoutMs || 9000) });
      if (r.status === 429) { last = 'reddit_rate_limited'; break; }
      if (!r.ok) { last = 'reddit_' + r.status; continue; }
      return await r.json();
    } catch (e) { last = String((e && e.message) || e).slice(0, 60); }
  }
  throw new Error(last);
}
function redditSubClean(s) { return String(s || '').replace(/^r\//i, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40); }
// Collection tags with the wide matcher: the Sentinel's tight triggers decide
// what is a spike, not what is worth keeping.
function redditIssues(text) { return issueTag(text); }
/** One subreddit listing, normalised. Stickied and pinned posts are skipped. */
async function redditListing(env, sub, sort, limit) {
  const d = await redditGet(env, '/r/' + sub + '/' + (sort || 'hot') + '?limit=' + (limit || 25) + (sort === 'top' ? '&t=day' : ''));
  return ((d && d.data && d.data.children) || []).map(c => c && c.data).filter(p => p && !p.stickied && !p.pinned).map(p => ({
    id: String(p.id || ''), sub: p.subreddit || sub, title: String(p.title || '').slice(0, 400), body: String(p.selftext || '').slice(0, 4000),
    score: p.score || 0, ratio: p.upvote_ratio || 0, comments: p.num_comments || 0, flair: p.link_flair_text || '',
    permalink: 'https://www.reddit.com' + (p.permalink || ''), link: p.url_overridden_by_dest || p.url || '', domain: p.domain || '',
    created: (p.created_utc || 0) * 1000,
  }));
}
/** Reddit search, normalised to the same thread shape as a listing. This is how
 *  the client keywords find the argument outside the subs we watch. */
async function redditSearch(env, q, opts) {
  opts = opts || {};
  const sub = opts.sub ? redditSubClean(opts.sub) : '';
  const path = (sub ? '/r/' + sub + '/search' : '/search') + '?q=' + encodeURIComponent(q)
    + '&sort=' + (opts.sort || 'new') + '&t=' + (opts.time || 'week') + '&limit=' + (opts.limit || 25)
    + (sub ? '&restrict_sr=on' : '');
  const d = await redditGet(env, path);
  return ((d && d.data && d.data.children) || []).map(c => c && c.data).filter(p => p && !p.stickied).map(p => ({
    id: String(p.id || ''), sub: p.subreddit || '', title: String(p.title || '').slice(0, 400), body: String(p.selftext || '').slice(0, 4000),
    score: p.score || 0, ratio: p.upvote_ratio || 0, comments: p.num_comments || 0, flair: p.link_flair_text || '',
    permalink: 'https://www.reddit.com' + (p.permalink || ''), link: p.url_overridden_by_dest || p.url || '', domain: p.domain || '',
    created: (p.created_utc || 0) * 1000, found: q,
  }));
}
/** A thread's comment tree flattened to a depth-limited list. No usernames. */
async function redditThreadComments(env, sub, id, limit, depth) {
  const d = await redditGet(env, '/r/' + sub + '/comments/' + id + '?limit=' + (limit || 60) + '&depth=' + (depth || 3) + '&sort=top');
  const out = [];
  const walk = (kids, dep) => {
    (kids || []).forEach(c => {
      const x = c && c.data; if (!x || c.kind !== 't1' || !x.body || x.body === '[deleted]' || x.body === '[removed]') return;
      out.push({ id: String(x.id || ''), body: String(x.body).slice(0, 3000), score: x.score || 0, depth: dep, created: (x.created_utc || 0) * 1000 });
      if (x.replies && x.replies.data) walk(x.replies.data.children, dep + 1);
    });
  };
  walk(((d && d[1] && d[1].data && d[1].data.children) || []), 0);
  return out;
}
/** Sweep the politics subs: every thread on hot and top-of-day, then the
 *  comments on the most-discussed threads, issue-tagged threads first. */
async function redditSweep(env, opts) {
  opts = opts || {};
  // listings:false is a keyword research run: the search terms only, no sub listings
  const subs = opts.listings === false ? [] : ((Array.isArray(opts.subs) && opts.subs.length) ? opts.subs : REDDIT_POLITICS).map(redditSubClean).filter(Boolean).slice(0, 16);
  const topicId = String(opts.topic || '').replace(/[^\w.-]/g, '').slice(0, 60);
  const perSub = Math.min(Math.max(parseInt(opts.perSub, 10) || 25, 5), 100);
  const threadsForComments = Math.min(Math.max(parseInt(opts.threads, 10) || 20, 0), 60);
  const commentsPer = Math.min(Math.max(parseInt(opts.commentsPer, 10) || 40, 5), 200);
  // Keyword pass: 'auto' means every client issue's search terms. Anonymous
  // reads are rationed, so a caller can hand in the slice it wants instead.
  const log = opts.log || (async () => {});
  const only = opts.issue ? [String(opts.issue)] : null;
  const queries = (opts.queries === 'auto' ? issueQueries(only) : (Array.isArray(opts.queries) ? opts.queries : []))
    .map(s => String(s || '').slice(0, 80)).filter(Boolean).slice(0, 40);
  const qTime = String(opts.qTime || 'week'), qLimit = Math.min(Math.max(parseInt(opts.qLimit, 10) || 25, 5), 100);
  const out = { ok: true, subs: subs, queries: queries, authenticated: redditAuthed(env), threads: 0, comments: 0, threadRows: 0, commentRows: 0, errors: [] };
  const seen = new Map();
  const take = list => list.forEach(t => { if (t.id && !seen.has(t.id)) seen.set(t.id, t); });
  const pace = redditPace(env);
  for (const sort of ['hot', 'top']) {
    // one multi-subreddit listing per sort keeps anonymous traffic under Reddit's limit
    let combined = false;
    if (subs.length > 1) {
      await log('cmd', 'GET /r/' + subs.join('+') + '/' + sort + '?limit=' + Math.min(100, perSub * subs.length));
      try { take(await redditListing(env, subs.join('+'), sort, Math.min(100, perSub * subs.length))); combined = true; await log('out', seen.size + ' threads held after ' + sort); }
      catch (e) { const m = String(e.message || e).slice(0, 80); out.errors.push('r/' + subs.join('+') + '/' + sort + ': ' + m); await log('err', m); }
      await rdSleep(pace);
    }
    if (!combined) for (const sub of subs) {
      await log('cmd', 'GET /r/' + sub + '/' + sort + '?limit=' + perSub);
      try { take(await redditListing(env, sub, sort, perSub)); await log('out', 'r/' + sub + '/' + sort + ': ' + seen.size + ' held'); }
      catch (e) { const m = String(e.message || e).slice(0, 80); out.errors.push('r/' + sub + '/' + sort + ': ' + m); await log('err', 'r/' + sub + '/' + sort + ': ' + m); if (/rate_limited/.test(m)) break; }
      await rdSleep(pace);
    }
  }
  // The keyword pass: our clients' language, searched across Reddit rather than
  // waited for in the subs we watch.
  out.found = 0; out.dropped = 0;
  for (const q of queries) {
    await log('cmd', 'GET /search?q=' + q + '&sort=new&t=' + qTime);
    try {
      const hits = await redditSearch(env, q, { time: qTime, limit: qLimit });
      // a search runs across every subreddit on earth: keep the Australian ones
      const keep = hits.filter(h => auRelevant(h.sub, h.sub + ' ' + h.title + ' ' + h.body, q));
      out.found += keep.length; out.dropped += hits.length - keep.length; take(keep);
      await log('out', '"' + q + '": ' + hits.length + ' hits, ' + keep.length + ' Australian kept');
    }
    catch (e) { const m = String(e.message || e).slice(0, 80); out.errors.push('search "' + q + '": ' + m); await log('err', '"' + q + '": ' + m); if (/rate_limited/.test(m)) break; }
    await rdSleep(pace);
  }
  const threads = [...seen.values()];
  out.threads = threads.length;
  const trows = threads.map(t => {
    const issues = redditIssues(t.title + ' ' + t.body);
    return {
      src: 'reddit', title: t.title,
      body: (t.body || '').slice(0, 3000) + '\n' + t.score + ' points, ' + t.comments + ' comments, upvote ratio ' + t.ratio + (t.flair ? ', flair ' + t.flair : '') + (t.link && t.domain !== 'self.' + t.sub ? '\nLink: ' + t.link : ''),
      url: t.permalink, author: '', tone: commentTone(t.title + ' ' + t.body), ts: t.created || Date.now(),
      meta: Object.assign({ sub: t.sub, id: t.id, score: t.score, ratio: t.ratio, comments: t.comments, flair: t.flair, domain: t.domain, link: (t.link || '').slice(0, 300), issues: issues, issue: issues[0] || '', q: t.found || '' }, topicId ? { topic: topicId } : {}),
    };
  });
  for (let i = 0; i < trows.length; i += 150) out.threadRows += await archiveItems(env, 'reddit_thread', trows.slice(i, i + 150));
  await log('info', 'filed ' + out.threadRows + ' new threads of ' + trows.length + ' collected');
  // Read the comments where the client is actually being argued about: issue
  // tags first, then a keyword hit, then how busy the thread is.
  const weight = t => redditIssues(t.title + ' ' + t.body).length * 1000 + (t.found ? 500 : 0) + (t.comments || 0);
  // a thread with no comments has nothing to read: never spend a call on it
  const pick = threads.filter(t => (t.comments || 0) > 0).sort((a, b) => weight(b) - weight(a)).slice(0, threadsForComments);
  for (const t of pick) {
    try {
      await log('cmd', 'GET /r/' + t.sub + '/comments/' + t.id + '?limit=' + commentsPer);
      const cs = await redditThreadComments(env, t.sub, t.id, commentsPer, 3);
      await log('out', t.id + ': ' + cs.length + ' comments - ' + t.title.slice(0, 70));
      await rdSleep(pace);
      const tIssues = redditIssues(t.title + ' ' + t.body);
      const rows = cs.map(c => {
        // a comment inherits the thread's issues and adds its own: an argument
        // under a fuel tax credit thread is about fuel tax credits even when the
        // words it uses are 'farmers' and 'diesel'
        const all = issueMerge(redditIssues(c.body), tIssues);
        return {
          src: 'reddit', title: 'Comment on: ' + t.title.slice(0, 120), body: c.body, url: 'x:rcmt:' + c.id, author: '', tone: commentTone(c.body), ts: c.created || Date.now(),
          meta: Object.assign({ sub: t.sub, thread: t.id, thread_title: t.title.slice(0, 200), permalink: t.permalink, score: c.score, depth: c.depth, issues: all, issue: all[0] || '', tone: commentTone(c.body) }, topicId ? { topic: topicId } : {}),
        };
      });
      out.comments += rows.length;
      for (let i = 0; i < rows.length; i += 150) out.commentRows += await archiveItems(env, 'reddit_comment', rows.slice(i, i + 150));
    } catch (e) { const m = String(e.message || e).slice(0, 80); out.errors.push(t.id + ': ' + m); await log('err', t.id + ': ' + m); if (/rate_limited/.test(m)) break; }
  }
  await log('info', 'comments filed: ' + out.commentRows);
  return out;
}
/** Cron hook: a light sweep at most every 3 hours. */
async function redditCron(env) {
  if (!env.MIND_DB) return;
  const last = Number(await kvGet(env.AXIOM_KV, 'reddit_last_sweep') || 0);
  if (Date.now() - last < 3 * 3600000) return;
  await kvPut(env.AXIOM_KV, 'reddit_last_sweep', String(Date.now()), 86400);
  // Rotate through the client keywords a slice at a time: every term is swept
  // within a day without spending the whole request ration in one tick.
  const all = issueQueries();
  const slice = redditAuthed(env) ? 12 : 5;
  const cur = Number(await kvGet(env.AXIOM_KV, 'reddit_q_cursor') || 0) % Math.max(1, all.length);
  const queries = all.slice(cur, cur + slice).concat(cur + slice > all.length ? all.slice(0, cur + slice - all.length) : []);
  await kvPut(env.AXIOM_KV, 'reddit_q_cursor', String((cur + slice) % Math.max(1, all.length)), 7 * 86400);
  let r; try { r = await redditSweep(env, { threads: 15, commentsPer: 30, queries: queries }); } catch (e) { r = { error: String(e).slice(0, 120) }; }
  await kvPut(env.AXIOM_KV, 'reddit_last_result', JSON.stringify(r).slice(0, 4000), 7 * 86400);
}
/** File a document in the Mind from server-side code: the same chunking,
 *  embedding and bookkeeping /mind/ingest performs for an upload. */
async function mindIngestDoc(env, doc) {
  const missing = [];
  if (!env.MIND_VECTORS) missing.push('MIND_VECTORS'); if (!env.AI) missing.push('AI'); if (!env.MIND_DB) missing.push('MIND_DB'); if (!env.MIND_DOCS) missing.push('MIND_DOCS');
  if (missing.length) throw new Error('mind_not_configured: bind ' + missing.join(', '));
  const ns = String(doc.ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32) || 'cmm';
  const text = String(doc.text || '').slice(0, 200000);
  if (!text.trim()) throw new Error('empty_document');
  const docId = ns + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const title = String(doc.title || 'Untitled').slice(0, 200), kind = String(doc.kind || 'doc').slice(0, 40);
  const chunks = []; for (let i = 0; i < text.length && chunks.length < 120; i += 1050) chunks.push(text.slice(i, i + 1200));
  await env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mind_docs(id TEXT PRIMARY KEY, ns TEXT, title TEXT, kind TEXT, source TEXT, dt TEXT, chunks INTEGER, created INTEGER)').run();
  await env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mind_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, mode TEXT, q TEXT, created INTEGER)').run();
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20);
    const vecs = (await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: batch })).data;
    await env.MIND_VECTORS.insert(batch.map((c, j) => ({ id: docId + '_' + (i + j), values: vecs[j], namespace: ns,
      metadata: { docId, title, kind, source: String(doc.source || '').slice(0, 300), dt: String(doc.date || '').slice(0, 20), snippet: c.slice(0, 900) } })));
  }
  await env.MIND_DOCS.put('mind/' + ns + '/' + docId + '.txt', text);
  await env.MIND_DB.prepare('INSERT INTO mind_docs(id,ns,title,kind,source,dt,chunks,created) VALUES(?,?,?,?,?,?,?,?)').bind(docId, ns, title, kind, String(doc.source || ''), String(doc.date || ''), chunks.length, Date.now()).run();
  return { docId, chunks: chunks.length, ns };
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
// THE SIGNAL BRIDGE - the portal's Sweep button, run where the access actually
// is. A click in the app creates a JOB. The worker runs the sources it can
// reach itself (Meta and LinkedIn through their APIs, Reddit when Reddit lets
// it); the sources only a logged-in desktop can reach - X above all - are left
// queued for tools/reach-agent.py running on a Mac, which claims the job,
// executes it, and streams every command and its answer back here. Either way
// the app tails the same log, so the operator watches the collection happen.
// ==============================================================================
let BRIDGE_READY = false;
const BRIDGE_SOURCES = ['reddit', 'x', 'linkedin', 'meta', 'topic', 'sources', 'render', 'bluesky', 'mastodon', 'youtube', 'petitions', 'sentiment', 'narratives'];   // topic: keyword research; sources: a registry sweep; render: a page through a real browser
const BRIDGE_DESKTOP_ONLY = ['x'];      // no server-side path exists for these
const BRIDGE_LOG_KEEP = 400;            // lines kept per job
async function ensureBridge(env) {
  if (!env.MIND_DB) return false;
  if (BRIDGE_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS bridge_jobs(id TEXT PRIMARY KEY, source TEXT, params TEXT, status TEXT, agent TEXT, who TEXT, created INTEGER, claimed INTEGER, finished INTEGER, ok INTEGER, result TEXT)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS bridge_jobs_st ON bridge_jobs(status, created)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS bridge_log(id INTEGER PRIMARY KEY AUTOINCREMENT, job TEXT, ts INTEGER, kind TEXT, text TEXT)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS bridge_log_job ON bridge_log(job, id)'),
  ]);
  BRIDGE_READY = true;
  return true;
}
function sigSource(s) { const v = String(s || '').toLowerCase().replace(/[^a-z]/g, ''); return BRIDGE_SOURCES.indexOf(v) >= 0 ? v : ''; }
function jobId() { return 'j' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/** Append log lines. Kinds: cmd (a command being run), out (its answer),
 *  err (a failure, kept verbatim), info (narration), done (the summary). */
async function jobLog(env, id, lines) {
  if (!env.MIND_DB || !lines || !lines.length) return;
  const t = Date.now();
  await env.MIND_DB.batch(lines.slice(0, 40).map(l => env.MIND_DB
    .prepare('INSERT INTO bridge_log(job,ts,kind,text) VALUES(?,?,?,?)')
    .bind(id, t, String(l.k || 'info').slice(0, 8), String(l.t == null ? '' : l.t).slice(0, 1200))));
}
/** A buffered logger: collectors call log('cmd', 'twitter search ...') freely
 *  and lines reach D1 in small batches so a long sweep stays cheap. */
function mkJobLog(env, id) {
  let buf = [];
  const flush = async () => { if (!buf.length) return; const b = buf; buf = []; try { await jobLog(env, id, b); } catch (e) {} };
  const log = async (k, t) => { buf.push({ k, t }); if (buf.length >= 4) await flush(); };
  log.flush = flush;
  return log;
}
/** Where should this job run? A desktop collector that offers the source beats
 *  a worker path the platform will refuse: Reddit 403s Cloudflare's whole
 *  network, so when a Mac is connected the job belongs there. The worker keeps
 *  Reddit only when it holds app credentials (OAuth reads work from cloud). */
async function jobRoute(env, source, where) {
  if (where === 'desktop') return 'desktop';
  if (where === 'worker') return 'worker';
  if (BRIDGE_DESKTOP_ONLY.indexOf(source) >= 0) return 'desktop';
  // rendering needs a browser: the worker has one only through a configured
  // render back end; otherwise a Mac with Playwright takes the job
  if (source === 'render' && !renderConfigured(env)) return 'desktop';
  if (source === 'reddit' && !redditAuthed(env)) {
    const agents = await agentsSeen(env);
    if (agents.some(a => a.live && (a.sources || []).indexOf('reddit') >= 0)) return 'desktop';
  }
  return 'worker';
}
async function jobCreate(env, source, params, who) {
  await ensureBridge(env);
  const id = jobId();
  const where = String((params && params.where) || 'auto');
  const local = (await jobRoute(env, source, where)) === 'worker';
  await env.MIND_DB.prepare('INSERT INTO bridge_jobs(id,source,params,status,agent,who,created,claimed,finished,ok,result) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(id, source, JSON.stringify(params || {}).slice(0, 4000), local ? 'running' : 'queued', '', String(who || '').slice(0, 40), Date.now(), local ? Date.now() : 0, 0, 0, '').run();
  await jobLog(env, id, [{ k: 'info', t: 'job ' + id + ' created: ' + source + (local ? ' (running in the worker)' : ' (waiting for a desktop collector to claim it)') }]);
  return { id, local };
}
async function jobFinish(env, id, ok, result) {
  await env.MIND_DB.prepare('UPDATE bridge_jobs SET status=?, finished=?, ok=?, result=? WHERE id=?')
    .bind(ok ? 'done' : 'failed', Date.now(), ok ? 1 : 0, JSON.stringify(result || {}).slice(0, 4000), id).run();
  await jobLog(env, id, [{ k: 'done', t: (ok ? 'finished: ' : 'failed: ') + JSON.stringify(result || {}).slice(0, 600) }]);
  // keep the log readable: trim to the most recent lines
  try {
    await env.MIND_DB.prepare('DELETE FROM bridge_log WHERE job=? AND id NOT IN (SELECT id FROM bridge_log WHERE job=? ORDER BY id DESC LIMIT ?)').bind(id, id, BRIDGE_LOG_KEEP).run();
  } catch (e) {}
}
/** The desktop agent claims the oldest queued job it can handle. */
async function jobClaim(env, agent, sources) {
  await ensureBridge(env);
  const want = (sources || []).map(sigSource).filter(Boolean);
  const list = want.length ? want : BRIDGE_SOURCES;
  const marks = list.map(() => '?').join(',');
  const row = await env.MIND_DB.prepare('SELECT id,source,params FROM bridge_jobs WHERE status=? AND source IN (' + marks + ') ORDER BY created LIMIT 1')
    .bind('queued', ...list).first();
  if (!row) return null;
  await env.MIND_DB.prepare('UPDATE bridge_jobs SET status=?, agent=?, claimed=? WHERE id=?').bind('running', String(agent || 'agent').slice(0, 40), Date.now(), row.id).run();
  await jobLog(env, row.id, [{ k: 'info', t: 'claimed by ' + String(agent || 'agent').slice(0, 40) }]);
  let params = {}; try { params = JSON.parse(row.params || '{}'); } catch (e) {}
  return { id: row.id, source: row.source, params };
}
async function jobTail(env, id, after) {
  await ensureBridge(env);
  const job = await env.MIND_DB.prepare('SELECT id,source,status,agent,who,created,claimed,finished,ok,result FROM bridge_jobs WHERE id=?').bind(id).first();
  if (!job) return null;
  const rows = await env.MIND_DB.prepare('SELECT id,ts,kind,text FROM bridge_log WHERE job=? AND id>? ORDER BY id LIMIT 200').bind(id, Number(after) || 0).all();
  const lines = rows.results || [];
  let result = null; try { result = job.result ? JSON.parse(job.result) : null; } catch (e) {}
  return {
    ok: true, id: job.id, source: job.source, status: job.status, agent: job.agent || '', started: job.created,
    finished: job.finished || 0, success: !!job.ok, result: result,
    lines: lines.map(l => ({ id: l.id, ts: l.ts, kind: l.kind, text: l.text })),
    cursor: lines.length ? lines[lines.length - 1].id : (Number(after) || 0),
  };
}
/** Agents announce themselves on every poll; the app shows who is connected. */
async function agentBeat(env, agent, sources) {
  if (!env.AXIOM_KV || !agent) return;
  await kvPut(env.AXIOM_KV, 'bridge_agent_' + String(agent).replace(/[^\w-]/g, '').slice(0, 40),
    JSON.stringify({ ts: Date.now(), sources: (sources || []).slice(0, 8) }), 3 * 86400);
}
async function agentsSeen(env) {
  if (!env.AXIOM_KV || !env.AXIOM_KV.list) return [];
  try {
    const l = await env.AXIOM_KV.list({ prefix: 'bridge_agent_' });
    const out = [];
    for (const k of (l.keys || []).slice(0, 10)) {
      const v = await kvGet(env.AXIOM_KV, k.name);
      let d = {}; try { d = JSON.parse(v || '{}'); } catch (e) {}
      out.push({ agent: k.name.replace('bridge_agent_', ''), last: d.ts || 0, sources: d.sources || [], live: Date.now() - (d.ts || 0) < 5 * 60000 });
    }
    return out.sort((a, b) => b.last - a.last);
  } catch (e) { return []; }
}

// -- Signal rows: one shape for every platform, so the view and the Mind do not
//    care where a comment came from. Author names are never stored. ----------
function sigThreadRow(p) {
  const text = (p.title || '') + ' ' + (p.body || '');
  const issues = issueTag(text);
  return {
    src: p.platform, title: String(p.title || '').slice(0, 400),
    body: String(p.body || '').slice(0, 3000) + '\n' + (p.score || 0) + ' reactions, ' + (p.comments || 0) + ' comments' + (p.link ? '\nLink: ' + p.link : ''),
    url: p.url || ('x:sig:' + p.platform + ':' + p.id), author: '', tone: commentTone(text), ts: p.ts || Date.now(),
    meta: { platform: p.platform, id: String(p.id || ''), page: p.page || '', page_name: p.page_name || '', score: p.score || 0,
      comments: p.comments || 0, link: String(p.link || '').slice(0, 300), issues: issues, issue: issues[0] || '',
      q: p.q || '', ns: p.ns || '', via: p.via || 'worker' },
  };
}
function sigCommentRow(c, thread) {
  const all = issueMerge(issueTag(c.body), (thread && thread.issues) || []);
  return {
    src: c.platform, title: 'Comment on: ' + String((thread && thread.title) || '').slice(0, 120), body: String(c.body || '').slice(0, 3000),
    url: 'x:sigc:' + c.platform + ':' + c.id, author: '', tone: commentTone(c.body), ts: c.ts || Date.now(),
    meta: { platform: c.platform, thread: String((thread && thread.id) || ''), thread_title: String((thread && thread.title) || '').slice(0, 200),
      permalink: String((thread && thread.url) || '').slice(0, 300), score: c.score || 0, depth: c.depth || 0,
      issues: all, issue: all[0] || '', tone: commentTone(c.body), ns: c.ns || (thread && thread.ns) || '', via: c.via || 'worker' },
  };
}
async function sigFile(env, threads, comments) {
  let t = 0, cm = 0;
  for (let i = 0; i < threads.length; i += 150) t += await archiveItems(env, 'sig_thread', threads.slice(i, i + 150));
  for (let i = 0; i < comments.length; i += 150) cm += await archiveItems(env, 'sig_comment', comments.slice(i, i + 150));
  return { threadRows: t, commentRows: cm };
}

// -- LinkedIn: the client's own pages, through LinkedIn's own API. Needs the
//    secret LINKEDIN_TOKEN (a member token with r_organization_social) and the
//    text var LINKEDIN_ORGS ("urn:li:organization:123:mca,456:aep"). ---------
const LI_API = 'https://api.linkedin.com/rest';
function liOrgs(env) {
  return String(env.LINKEDIN_ORGS || '').split(/[,\s]+/).filter(Boolean).map(s => {
    const parts = String(s).split(':');
    const ns = (parts.length > 1 ? parts[parts.length - 1] : 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'cmm';
    const idPart = parts.length > 1 ? parts.slice(0, -1).join(':') : s;
    const id = /^urn:/.test(idPart) ? idPart : 'urn:li:organization:' + String(idPart).replace(/[^0-9]/g, '');
    return { urn: id, ns: ns };
  }).filter(o => /^urn:li:organization:\d+$/.test(o.urn));
}
async function liGet(env, path) {
  const r = await fetch(LI_API + path, { headers: {
    'Authorization': 'Bearer ' + env.LINKEDIN_TOKEN,
    'LinkedIn-Version': String(env.LINKEDIN_VERSION || '202409'),
    'X-Restli-Protocol-Version': '2.0.0',
  }, signal: abortAfter(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('linkedin_' + r.status + (d && d.message ? ': ' + String(d.message).slice(0, 120) : ''));
  return d;
}
async function linkedinSweep(env, opts) {
  opts = opts || {};
  const log = opts.log || (async () => {});
  if (!env.LINKEDIN_TOKEN) return { ok: false, error: 'linkedin_not_configured', detail: 'Set the worker secret LINKEDIN_TOKEN (a LinkedIn token with r_organization_social for the pages you administer) and the var LINKEDIN_ORGS, e.g. "urn:li:organization:123:mca,456:aep".' };
  const orgs = liOrgs(env);
  if (!orgs.length) return { ok: false, error: 'linkedin_no_orgs', detail: 'Set LINKEDIN_ORGS to your organisation URNs with their client namespace, e.g. "urn:li:organization:123:mca".' };
  const perOrg = Math.min(Math.max(parseInt(opts.posts, 10) || 20, 1), 50);
  const perPost = Math.min(Math.max(parseInt(opts.commentsPer, 10) || 50, 5), 100);
  const out = { ok: true, platform: 'linkedin', orgs: orgs.length, threads: 0, comments: 0, threadRows: 0, commentRows: 0, errors: [] };
  const trows = [], crows = [];
  for (const org of orgs) {
    const q = '/posts?author=' + encodeURIComponent(org.urn) + '&q=author&count=' + perOrg + '&sortBy=LAST_MODIFIED';
    await log('cmd', 'GET api.linkedin.com/rest' + q);
    let posts = [];
    try {
      const d = await liGet(env, q);
      posts = d.elements || [];
      await log('out', org.urn + ': ' + posts.length + ' posts');
    } catch (e) { const m = String(e.message || e).slice(0, 160); out.errors.push(org.urn + ': ' + m); await log('err', m); continue; }
    for (const p of posts) {
      const urn = String(p.id || '');
      const body = String((p.commentary != null ? p.commentary : (p.specificContent && JSON.stringify(p.specificContent))) || '').slice(0, 4000);
      const thread = { platform: 'linkedin', id: urn, title: body.split('\n')[0].slice(0, 200) || 'LinkedIn post',
        body: body, page: org.urn, page_name: '', score: 0, comments: 0, ns: org.ns,
        url: 'https://www.linkedin.com/feed/update/' + urn, ts: Number(p.createdAt || p.firstPublishedAt || 0) || Date.now() };
      thread.issues = issueTag(thread.title + ' ' + thread.body);
      trows.push(sigThreadRow(thread));
      out.threads++;
      const cq = '/socialActions/' + encodeURIComponent(urn) + '/comments?count=' + perPost;
      await log('cmd', 'GET api.linkedin.com/rest/socialActions/' + urn.slice(0, 40) + '/comments');
      try {
        const cd = await liGet(env, cq);
        const els = cd.elements || [];
        await log('out', els.length + ' comments on ' + urn.slice(-12));
        els.forEach(c => {
          const text = String((c.message && c.message.text) || '').trim();
          if (!text) return;
          crows.push(sigCommentRow({ platform: 'linkedin', id: String(c.id || c.$URN || Math.random().toString(36).slice(2)), body: text,
            score: (c.likesSummary && c.likesSummary.totalLikes) || 0, ts: (c.created && c.created.time) || Date.now(), ns: org.ns }, thread));
          out.comments++;
        });
      } catch (e) { const m = String(e.message || e).slice(0, 160); out.errors.push(urn + ': ' + m); await log('err', m); }
    }
  }
  const filed = await sigFile(env, trows, crows);
  out.threadRows = filed.threadRows; out.commentRows = filed.commentRows;
  await log('info', 'filed ' + out.threadRows + ' posts and ' + out.commentRows + ' comments');
  return out;
}

// -- Meta, organic: the client's own Facebook and Instagram pages. The ad-side
//    comment sweep (metaComments) is untouched; this reads the page's own
//    posts, which is where most of the argument happens. -----------------------
function metaPages(env) {
  return String(env.META_PAGES || '').split(/[,\s]+/).filter(Boolean).map(s => {
    const [id, ns] = String(s).split(':');
    return { id: String(id || '').replace(/[^0-9]/g, ''), ns: (ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'cmm' };
  }).filter(p => p.id);
}
async function metaOrganicSweep(env, opts) {
  opts = opts || {};
  const log = opts.log || (async () => {});
  if (!env.META_TOKEN) return { ok: false, error: 'meta_not_configured', detail: 'Set META_TOKEN (a System User token with pages_read_engagement and pages_read_user_content, with the pages assigned).' };
  const pages = metaPages(env);
  if (!pages.length) return { ok: false, error: 'meta_no_pages', detail: 'Set the text var META_PAGES to the page ids with their client namespace, e.g. "123456:mca,789012:aep". GET /meta/status?probe=1 checks the token.' };
  const perPage = Math.min(Math.max(parseInt(opts.posts, 10) || 25, 1), 100);
  const perPost = Math.min(Math.max(parseInt(opts.commentsPer, 10) || 50, 5), 100);
  const tok = '&access_token=' + encodeURIComponent(env.META_TOKEN);
  const out = { ok: true, platform: 'meta', pages: pages.length, threads: 0, comments: 0, threadRows: 0, commentRows: 0, errors: [] };
  const trows = [], crows = [];
  for (const pg of pages) {
    const url = META_API + '/' + pg.id + '/posts?fields=id,message,created_time,permalink_url,shares,comments.limit(' + perPost + '){id,message,created_time,like_count},reactions.summary(true).limit(0)&limit=' + perPage + tok;
    await log('cmd', 'GET graph.facebook.com/' + pg.id + '/posts?fields=message,comments{...}&limit=' + perPage);
    let posts = [];
    try { const d = await metaGet(url); posts = d.data || []; await log('out', 'page ' + pg.id + ': ' + posts.length + ' posts'); }
    catch (e) { const m = String(e.message || e).slice(0, 160); out.errors.push(pg.id + ': ' + m); await log('err', m); continue; }
    for (const p of posts) {
      const body = String(p.message || '').slice(0, 4000);
      const cs = ((p.comments || {}).data || []).filter(c => c.message && c.message.trim());
      const thread = { platform: 'meta', id: String(p.id || ''), title: body.split('\n')[0].slice(0, 200) || 'Facebook post', body: body,
        page: pg.id, ns: pg.ns, score: ((p.reactions || {}).summary || {}).total_count || 0, comments: cs.length,
        url: p.permalink_url || ('https://www.facebook.com/' + p.id), ts: Date.parse(p.created_time || '') || Date.now() };
      thread.issues = issueTag(thread.title + ' ' + thread.body);
      trows.push(sigThreadRow(thread)); out.threads++;
      cs.forEach(c => {
        crows.push(sigCommentRow({ platform: 'meta', id: String(c.id || ''), body: String(c.message), score: c.like_count || 0,
          ts: Date.parse(c.created_time || '') || Date.now(), ns: pg.ns }, thread));
        out.comments++;
      });
      await log('out', String(p.id).slice(-10) + ': ' + cs.length + ' comments');
    }
  }
  const filed = await sigFile(env, trows, crows);
  out.threadRows = filed.threadRows; out.commentRows = filed.commentRows;
  await log('info', 'filed ' + out.threadRows + ' posts and ' + out.commentRows + ' comments');
  return out;
}

/** Cron hook: the two platforms the worker can read on its own, at most
 *  6-hourly, and only when they are configured. */
// ==============================================================================
// TOPICS - keyword research on demand. SIFA (the partner system) hands us
// keywords and topics; for each one a research job gathers the news, the
// government and party statements, Hansard where a key exists, what the
// archive and the Mind already hold, then queues the MP-account sweep on X and
// the Reddit keyword pass for the collectors, and writes a cited brief. SIFA
// reads the results back through /sifa/*, gated by its own bearer key.
// MPs and senators are public officials speaking in office: their names and
// parties are kept on their own posts. Everyone else stays anonymous.
// ==============================================================================
const SIFA_URL_DEFAULT = 'https://sifa.wearecuriousminds.com/api/keywords';
const TOPIC_STATEMENT_SITES = ['pm.gov.au', 'ministers.treasury.gov.au', 'minister.gov.au', 'aph.gov.au', 'alp.org.au', 'liberal.org.au', 'nationals.org.au', 'greens.org.au'];
let TOPICS_READY = false;
async function ensureTopics(env) {
  if (TOPICS_READY) return true;
  if (!env.MIND_DB) return false;
  try {
    await env.MIND_DB.batch([
      env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS topics(id TEXT PRIMARY KEY, keyword TEXT, topic TEXT, ns TEXT, source TEXT, priority INTEGER, active INTEGER, created INTEGER, updated INTEGER, last_run INTEGER, last_job TEXT, hits INTEGER, extra TEXT)'),
      env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mps(id TEXT PRIMARY KEY, name TEXT, party TEXT, house TEXT, electorate TEXT, x TEXT, facebook TEXT, instagram TEXT, updated INTEGER)'),
    ]);
    TOPICS_READY = true; return true;
  } catch (e) { return false; }
}
function topicSlug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60); }
/** Whatever shape the keywords arrive in - a bare array of strings, an array of
 *  objects, or any of those under data/keywords/items/results/topics - out come
 *  {id, keyword, topic, ns, priority, extra}. Field names are read leniently. */
function topicNormalize(raw) {
  let list = raw;
  if (list && !Array.isArray(list) && typeof list === 'object') {
    list = list.data || list.keywords || list.items || list.results || list.topics || [];
    if (list && !Array.isArray(list) && typeof list === 'object') list = Object.values(list);
  }
  if (!Array.isArray(list)) return [];
  const out = []; const seen = new Set();
  list.forEach(it => {
    let kw = '', topic = '', ns = '', id = '', pri = 0, extra = null;
    if (typeof it === 'string') kw = it;
    else if (it && typeof it === 'object') {
      kw = it.keyword || it.term || it.name || it.title || it.q || it.text || it.value || '';
      topic = it.topic || it.category || it.group || it.theme || it.type || '';
      ns = it.client || it.ns || it.namespace || '';
      id = it.id || it.slug || it.key || '';
      pri = parseInt(it.priority || it.weight || it.rank || 0, 10) || 0;
      extra = it;
    }
    kw = String(kw || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!kw) return;
    const key = topicSlug(kw); if (!key || seen.has(key)) return; seen.add(key);
    out.push({ id: String(id || key).replace(/[^\w.-]/g, '').slice(0, 60) || key, keyword: kw, topic: String(topic || '').slice(0, 80),
      ns: String(ns || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24), priority: pri, extra: extra ? JSON.stringify(extra).slice(0, 1500) : '' });
  });
  return out;
}
/** GET the keywords from SIFA with the bearer token it issued. */
async function sifaPull(env) {
  if (!env.SIFA_TOKEN) return { ok: false, error: 'sifa_not_configured', detail: 'Set the worker secret SIFA_TOKEN (the bearer token SIFA issued) and, if the address differs, the var SIFA_URL.' };
  const url = env.SIFA_URL || SIFA_URL_DEFAULT;
  try {
    const r = await fetch(url, { headers: { 'Authorization': 'Bearer ' + env.SIFA_TOKEN, 'Accept': 'application/json', 'User-Agent': 'AXIOM/5.0 (topics)' }, signal: abortAfter(15000) });
    const text = await r.text();
    let raw = null; try { raw = JSON.parse(text); } catch (e) { raw = null; }
    if (!r.ok) return { ok: false, error: 'sifa_' + r.status, status: r.status, detail: 'SIFA answered HTTP ' + r.status + ': ' + text.slice(0, 200) };
    if (raw === null) return { ok: false, error: 'sifa_not_json', detail: 'SIFA did not return JSON: ' + text.slice(0, 200) };
    return { ok: true, url, keywords: topicNormalize(raw), sample: text.slice(0, 1200), status: r.status };
  } catch (e) { return { ok: false, error: 'sifa_unreachable', detail: String((e && e.message) || e).slice(0, 200) }; }
}
async function topicsUpsert(env, list, source) {
  if (!(await ensureTopics(env))) return { added: 0, updated: 0, total: 0 };
  const now = Date.now(); let added = 0, updated = 0;
  for (const k of list) {
    const ex = await env.MIND_DB.prepare('SELECT id FROM topics WHERE id=? OR keyword=?').bind(k.id, k.keyword).first();
    if (ex) {
      await env.MIND_DB.prepare("UPDATE topics SET keyword=?, topic=COALESCE(NULLIF(?,''),topic), ns=COALESCE(NULLIF(?,''),ns), source=?, priority=?, active=1, updated=?, extra=? WHERE id=?")
        .bind(k.keyword, k.topic || '', k.ns || '', source, k.priority || 0, now, k.extra || '', ex.id).run();
      updated++;
    } else {
      await env.MIND_DB.prepare("INSERT INTO topics(id,keyword,topic,ns,source,priority,active,created,updated,last_run,last_job,hits,extra) VALUES(?,?,?,?,?,?,1,?,?,0,'',0,?)")
        .bind(k.id, k.keyword, k.topic || '', k.ns || 'cmm', source, k.priority || 0, now, now, k.extra || '').run();
      added++;
    }
  }
  const tot = await env.MIND_DB.prepare('SELECT COUNT(*) c FROM topics WHERE active=1').first();
  return { added, updated, total: (tot && tot.c) || 0 };
}
async function topicsList(env) {
  if (!(await ensureTopics(env))) return [];
  return (await env.MIND_DB.prepare('SELECT id, keyword, topic, ns, source, priority, active, created, updated, last_run, last_job, hits FROM topics ORDER BY active DESC, priority DESC, updated DESC LIMIT 300').all()).results || [];
}
async function topicGet(env, idOrKeyword) {
  if (!idOrKeyword || !(await ensureTopics(env))) return null;
  const v = String(idOrKeyword).slice(0, 120);
  return (await env.MIND_DB.prepare('SELECT * FROM topics WHERE id=? OR keyword=? OR id=?').bind(v, v, topicSlug(v)).first()) || null;
}
// The MP register: every sitting member and senator, with the X, Facebook and
// Instagram accounts Wikidata records for them. Public data about public office.
const WD_MP_QUERY = 'SELECT ?p ?pLabel ?posLabel ?partyLabel ?electLabel ?x ?fb ?ig WHERE { VALUES ?pos { wd:Q18912794 wd:Q6814428 } ?p p:P39 ?st . ?st ps:P39 ?pos . FILTER NOT EXISTS { ?st pq:P582 ?end } OPTIONAL { ?p wdt:P102 ?party } OPTIONAL { ?st pq:P768 ?elect } OPTIONAL { ?p wdt:P2002 ?x } OPTIONAL { ?p wdt:P2013 ?fb } OPTIONAL { ?p wdt:P2003 ?ig } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }';
async function mpsSync(env) {
  if (!(await ensureTopics(env))) return { ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' };
  let d;
  try {
    const r = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(WD_MP_QUERY), {
      headers: { 'Accept': 'application/sparql-results+json', 'User-Agent': 'AXIOM/5.0 (Australian political intelligence; wearecuriousminds.com)' }, signal: abortAfter(25000) });
    if (!r.ok) return { ok: false, error: 'wikidata_' + r.status, detail: 'Wikidata answered HTTP ' + r.status };
    d = await r.json();
  } catch (e) { return { ok: false, error: 'wikidata_unreachable', detail: String((e && e.message) || e).slice(0, 160) }; }
  const by = {};
  (((d || {}).results || {}).bindings || []).forEach(b => {
    const v = k => (b[k] && b[k].value) || '';
    const id = v('p').split('/').pop(); if (!id) return;
    const row = by[id] || (by[id] = { id, name: v('pLabel'), party: '', house: '', electorate: '', x: '', facebook: '', instagram: '' });
    const pos = v('posLabel');
    if (/senate/i.test(pos)) row.house = 'senate'; else if (/representatives/i.test(pos)) row.house = 'representatives';
    if (v('partyLabel') && !row.party) row.party = v('partyLabel');
    if (v('electLabel') && !row.electorate) row.electorate = v('electLabel');
    if (v('x') && !row.x) row.x = v('x').replace(/^@/, '');
    if (v('fb') && !row.facebook) row.facebook = v('fb');
    if (v('ig') && !row.instagram) row.instagram = v('ig');
  });
  const rows = Object.values(by).filter(m => m.name && !/^Q\d+$/.test(m.name));
  if (!rows.length) return { ok: false, error: 'wikidata_empty', detail: 'Wikidata returned no sitting members.' };
  const now = Date.now();
  for (let i = 0; i < rows.length; i += 40) {
    await env.MIND_DB.batch(rows.slice(i, i + 40).map(m => env.MIND_DB.prepare(
      "INSERT INTO mps(id,name,party,house,electorate,x,facebook,instagram,updated) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, party=excluded.party, house=excluded.house, electorate=excluded.electorate, x=CASE WHEN excluded.x<>'' THEN excluded.x ELSE mps.x END, facebook=CASE WHEN excluded.facebook<>'' THEN excluded.facebook ELSE mps.facebook END, instagram=CASE WHEN excluded.instagram<>'' THEN excluded.instagram ELSE mps.instagram END, updated=excluded.updated")
      .bind(m.id, m.name, m.party, m.house, m.electorate, m.x, m.facebook, m.instagram, now)));
  }
  await kvPut(env.AXIOM_KV, 'mps_synced', String(now), 30 * 86400);
  return { ok: true, total: rows.length, withX: rows.filter(m => m.x).length, withFacebook: rows.filter(m => m.facebook).length,
    senate: rows.filter(m => m.house === 'senate').length, representatives: rows.filter(m => m.house === 'representatives').length };
}
async function mpsList(env, opts) {
  opts = opts || {};
  if (!(await ensureTopics(env))) return [];
  const w = []; const b = [];
  if (opts.q) { w.push('(LOWER(name) LIKE ? OR LOWER(electorate) LIKE ? OR LOWER(party) LIKE ?)'); const l = '%' + String(opts.q).toLowerCase().slice(0, 60) + '%'; b.push(l, l, l); }
  if (opts.house) { w.push('house=?'); b.push(String(opts.house)); }
  if (opts.withX) w.push("x<>''");
  return (await env.MIND_DB.prepare('SELECT id, name, party, house, electorate, x, facebook, instagram, updated FROM mps' + (w.length ? ' WHERE ' + w.join(' AND ') : '') + ' ORDER BY name LIMIT ' + (Math.min(parseInt(opts.limit, 10) || 400, 600))).bind(...b).all()).results || [];
}
/** What was said in parliament: OpenAustralia's Hansard search (free key). */
async function hansardSearch(env, kw, max) {
  if (!env.OPENAUSTRALIA_KEY) return { ok: false, items: [], detail: 'set OPENAUSTRALIA_KEY (free, openaustralia.org.au/api) to search Hansard' };
  try {
    const r = await fetch('https://www.openaustralia.org.au/api/getHansard?key=' + encodeURIComponent(env.OPENAUSTRALIA_KEY) + '&search=' + encodeURIComponent(kw) + '&num=' + (max || 20) + '&order=d&output=js',
      { headers: { 'User-Agent': 'AXIOM/5.0' }, signal: abortAfter(12000) });
    if (!r.ok) return { ok: false, items: [], detail: 'OpenAustralia HTTP ' + r.status };
    const d = await r.json();
    const rows = (d && d.rows) || [];
    return { ok: true, items: rows.map(x => ({
      speaker: (((x.speaker || {}).first_name || '') + ' ' + ((x.speaker || {}).last_name || '')).trim(), party: (x.speaker || {}).party || '',
      house: x.major === 1 ? 'representatives' : x.major === 101 ? 'senate' : '', date: x.hdate || '',
      text: stripHtml(x.body || x.extract || '').slice(0, 1500), url: x.listurl ? 'https://www.openaustralia.org.au' + x.listurl : '', id: String(x.gid || ''),
    })).filter(x => x.text) };
  } catch (e) { return { ok: false, items: [], detail: String((e && e.message) || e).slice(0, 120) }; }
}
/** SIFA sends generic nouns - "guns", "shooting", "weapon". Searched across all
 *  of Reddit or X those return American discussion almost exclusively, which the
 *  Australian gate then throws away: a wasted call per keyword. Ask for the
 *  Australian conversation instead, unless the keyword already names Australia.
 *  The MP account searches on X keep the bare keyword: those accounts are
 *  Australian by definition and the qualifier would only narrow them. */
function auQualify(kw) { return AU_QUERY_RX.test(String(kw)) ? String(kw) : String(kw) + ' australia'; }
/** One keyword research run: the job the Topics view and SIFA both wait on. */
async function topicRun(env, job, log) {
  const p = job.params || {};
  const t0 = Date.now();
  if (!(await ensureTopics(env))) return { ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' };
  let topic = await topicGet(env, p.id || p.keyword);
  const keyword = (topic && topic.keyword) || String(p.keyword || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!keyword) return { ok: false, error: 'missing_keyword', detail: 'Give a topic id or a keyword.' };
  if (!topic) { await topicsUpsert(env, topicNormalize([{ keyword, ns: p.ns || 'cmm', topic: p.topic || '' }]), 'manual'); topic = await topicGet(env, keyword); }
  const id = (topic && topic.id) || topicSlug(keyword);
  const ns = String(p.ns || (topic && topic.ns) || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm';
  const hours = Math.min(Math.max(parseInt(p.hours, 10) || 168, 24), 24 * 90);
  const days = Math.round(hours / 24);
  const win = hours <= 24 ? 'day' : hours <= 168 ? 'week' : 'month';
  const out = { ok: true, topic: id, keyword, ns, hours, counts: {}, children: {}, filed: 0 };
  await log('info', 'topic "' + keyword + '" (' + id + ') for ' + ns + ', last ' + days + ' days');
  // 1. news: the keyword, and the keyword in the mouths of MPs and ministers;
  //    statements: the same keyword on government and party sites
  const qNews = [keyword, keyword + ' (minister OR MP OR senator OR opposition)'];
  const qState = keyword + ' (' + TOPIC_STATEMENT_SITES.map(s => 'site:' + s).join(' OR ') + ')';
  await log('cmd', 'GET news.google.com/rss/search?q="' + keyword + '" when:' + days + 'd  (+ MP/minister angle, + government and party sites)');
  const [n1, n2, st, hz] = await Promise.all([gnewsSweep(qNews[0], hours, 30), gnewsSweep(qNews[1], hours, 20), gnewsSweep(qState, hours, 20), hansardSearch(env, keyword, 20)]);
  const key = n => n.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);
  const seen = new Set(); const news = [];
  [...n1, ...n2].forEach(n => { const k = key(n); if (!k || seen.has(k)) return; seen.add(k); news.push(n); });
  news.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  const seenS = new Set(); const statements = [];
  st.forEach(n => { const k = key(n); if (!k || seenS.has(k)) return; seenS.add(k); statements.push(n); });
  await log('out', news.length + ' news items, ' + statements.length + ' government and party statements' + (hz.ok ? ', ' + hz.items.length + ' Hansard speeches' : ' (Hansard: ' + hz.detail + ')'));
  out.counts.news = news.length; out.counts.statements = statements.length; out.counts.hansard = hz.items.length;
  // 2. what the archive already holds on it, across every kind
  let arch = []; const archBy = {};
  try {
    const words = keyword.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2).slice(0, 3);
    if (words.length && (await ensureArchive(env))) {
      const cond = words.map(() => "(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')").join(' AND ');
      const binds = [Date.now() - hours * 3600000]; words.forEach(w => { const l = arcLike(w); binds.push(l, l); });
      arch = (await env.MIND_DB.prepare("SELECT kind, src, title, body, url, ts, COALESCE(tone,0) tone FROM arc_items WHERE ts>? AND " + cond + " AND kind NOT IN ('topic_hit','topic_brief','research') ORDER BY ts DESC LIMIT 60").bind(...binds).all()).results || [];
      arch.forEach(a => { archBy[a.kind] = (archBy[a.kind] || 0) + 1; });
    }
  } catch (e) { /* archive optional */ }
  await log('out', 'archive: ' + arch.length + ' items already on file' + (arch.length ? ' (' + Object.keys(archBy).map(k => k + ' ' + archBy[k]).join(', ') + ')' : ''));
  out.counts.archive = arch.length; out.archiveByKind = archBy;
  // 3. the Mind: what this client already knows
  let mind = []; try { mind = await mindRetrieve(env, ns, keyword, 5); } catch (e) { mind = []; }
  // 4. MPs on X, from their own accounts - a desktop job; replies included
  const mps = p.mps === false ? [] : await mpsList(env, { withX: true, limit: 400 });
  if (mps.length) {
    const child = await jobCreate(env, 'x', { queries: [auQualify(keyword)], fromQueries: [keyword], from: mps.map(m => m.x), mps: mps.map(m => ({ x: m.x, name: m.name, party: m.party, house: m.house })), topic: id, ns, time: win, perQuery: 30, threads: 15, commentsPer: 40 }, 'topic:' + id);
    out.children.x = child.id;
    await log('info', 'queued X job ' + child.id + ' for the Mac collector: "' + keyword + '" across ' + mps.length + ' MP and senator accounts, replies included');
  } else await log('info', 'no MP register yet (Sync MPs builds it from Wikidata), so no MP account sweep this run');
  // 5. the Reddit keyword pass - the Mac collector when one is connected, the worker otherwise
  {
    const params = { queries: [auQualify(keyword)], listings: false, topic: id, time: win, threads: 20, commentsPer: 60 };
    const child = await jobCreate(env, 'reddit', params, 'topic:' + id);
    out.children.reddit = child.id;
    await log('info', 'queued Reddit job ' + child.id + (child.local ? ' (worker)' : ' (Mac collector)') + ': "' + auQualify(keyword) + '" across Reddit');
    if (child.local) out.childLocal = { id: child.id, params };
  }
  // 6. file the hits under the topic
  const rows = [];
  news.forEach(n => rows.push({ src: n.outlet || 'news', title: n.title, body: '', url: n.link, ts: Date.parse(n.date) || Date.now(), meta: { topic: id, keyword, ns, source: 'news', outlet: n.outlet || '' } }));
  statements.forEach(n => rows.push({ src: n.outlet || 'statement', title: n.title, body: '', url: n.link, ts: Date.parse(n.date) || Date.now(), meta: { topic: id, keyword, ns, source: 'statement', outlet: n.outlet || '' } }));
  hz.items.forEach(h => rows.push({ src: 'hansard', title: (h.speaker || 'Speech') + (h.party ? ' (' + h.party + ')' : '') + ': ' + h.text.slice(0, 120), body: h.text, url: h.url || ('x:hansard:' + h.id), ts: Date.parse(h.date) || Date.now(), tone: commentTone(h.text), meta: { topic: id, keyword, ns, source: 'hansard', mp: { name: h.speaker, party: h.party, house: h.house } } }));
  for (let i = 0; i < rows.length; i += 150) out.filed += await archiveItems(env, 'topic_hit', rows.slice(i, i + 150));
  await log('info', 'filed ' + out.filed + ' new items under topic ' + id);
  // 7. read the strongest pages, then the brief
  const picks = []; const outlets = new Set();
  for (const n of [...statements.slice(0, 2), ...news]) { const o = (n.outlet || '').toLowerCase(); if (o && outlets.has(o)) continue; outlets.add(o); picks.push(n); if (picks.length >= 4) break; }
  for (const pk of picks) await log('cmd', 'GET ' + String(pk.link || '').slice(0, 110));
  const pages = (await Promise.all(picks.map(pk => pageGrab(pk.link)))).filter(Boolean);
  await log('out', pages.length + ' pages read');
  const sources = []; const blocks = [];
  pages.forEach((pg, i) => { sources.push({ id: 'W' + (i + 1), title: pg.title || pg.url, url: pg.url, origin: 'live page' }); blocks.push('[W' + (i + 1) + '] PAGE: ' + (pg.title || pg.url) + '\n' + pg.text); });
  news.slice(0, 25).forEach((n, i) => { sources.push({ id: 'N' + (i + 1), title: n.title, url: n.link, origin: 'news: ' + (n.outlet || '') }); blocks.push('[N' + (i + 1) + '] (' + (n.outlet || 'news') + ', ' + (n.date || '').slice(0, 16) + ') ' + n.title); });
  statements.slice(0, 15).forEach((n, i) => { sources.push({ id: 'G' + (i + 1), title: n.title, url: n.link, origin: 'statement: ' + (n.outlet || '') }); blocks.push('[G' + (i + 1) + '] (' + (n.outlet || 'statement') + ', ' + (n.date || '').slice(0, 16) + ') ' + n.title); });
  hz.items.slice(0, 12).forEach((h, i) => { sources.push({ id: 'H' + (i + 1), title: h.speaker + ' in the ' + (h.house || 'parliament'), url: h.url, origin: 'Hansard ' + h.date }); blocks.push('[H' + (i + 1) + '] (Hansard ' + h.date + ', ' + h.speaker + (h.party ? ', ' + h.party : '') + ') ' + h.text.slice(0, 600)); });
  arch.slice(0, 20).forEach((a, i) => { sources.push({ id: 'A' + (i + 1), title: a.title, url: a.url && a.url.indexOf('x:') !== 0 ? a.url : '', origin: 'archive: ' + a.kind }); blocks.push('[A' + (i + 1) + '] (' + a.kind + '/' + (a.src || '') + ', ' + new Date(a.ts || 0).toISOString().slice(0, 10) + ') ' + a.title + (a.body ? ' - ' + String(a.body).slice(0, 160) : '')); });
  (mind || []).forEach((h, i) => { sources.push({ id: 'S' + (i + 1), title: (h.meta && h.meta.title) || 'doc', url: '', origin: h.ns === 'cmm' ? 'CMM shared' : 'client KB' }); blocks.push('[S' + (i + 1) + '] (' + ((h.meta && h.meta.kind) || 'doc') + ') ' + ((h.meta && h.meta.title) || '') + ': ' + String((h.meta && h.meta.snippet) || '').slice(0, 250)); });
  let brief = null;
  if (env.ANTHROPIC_API_KEY && sources.length) {
    const client = (CLIENT_ISSUES.find(ci => ci.ns === ns) || {}).client || 'Curious Minds';
    const sys = 'You are the research desk of an Australian political intelligence platform, briefing ' + client + '. Using ONLY the numbered sources, write a keyword brief as strict JSON and nothing else: '
      + '{"summary":"3-4 sentences on where this topic stands right now","volume":"one sentence on how much coverage there is and where",'
      + '"positions":[{"who":"name","role":"party and role","stance":"one line","evidence":"short verbatim or close paraphrase","source":"[N1]"}],'
      + '"coverage":[{"outlet":"","angle":"","source":"[N2]"}],"statements":[{"who":"","what":"","source":"[G1]"}],'
      + '"changes":["what is new, cited"],"risks":["for the client, cited"],"openings":["for the client, cited"],"watch":["2-3 concrete things to monitor"],"gaps":["what the sources do not cover"]}. '
      + 'Cite with the source ids given. Never invent names, numbers or quotes; a field with no support is an empty array. Australian English.';
    await log('cmd', 'claude: synthesise the brief from ' + sources.length + ' sources');
    try {
      const txt = await claudeMsg(env, sys, 'KEYWORD: ' + keyword + '\nCLIENT NAMESPACE: ' + ns + '\n\nSOURCES:\n' + blocks.join('\n\n').slice(0, 60000), 3000, 90000);
      const s2 = typeof txt === 'string' ? txt : (txt && (txt.text || JSON.stringify(txt))) || '';
      brief = JSON.parse((s2.match(/\{[\s\S]*\}/) || ['{}'])[0]);
      await log('out', 'brief: ' + (brief.positions || []).length + ' positions, ' + (brief.coverage || []).length + ' outlets, ' + (brief.risks || []).length + ' risks');
    } catch (e) { await log('err', 'brief failed: ' + String((e && e.message) || e).slice(0, 120)); brief = null; }
  } else await log('info', env.ANTHROPIC_API_KEY ? 'nothing found to brief on' : 'ANTHROPIC_API_KEY not set: hits filed, no brief written');
  // 8. remember the run: the full brief in KV, a pointer in the archive, the ledger
  const briefDoc = { topic: id, keyword, ns, at: t0, job: job.id, hours, counts: out.counts, archiveByKind: archBy, children: out.children, brief, sources };
  try { await kvPut(env.AXIOM_KV, 'topic_brief_' + id, JSON.stringify(briefDoc), 90 * 86400); } catch (e) {}
  await archiveItems(env, 'topic_brief', [{ src: 'axiom', title: keyword, body: String((brief && brief.summary) || '').slice(0, 2000), url: 'x:topic:' + id + ':' + t0, ts: t0, meta: { topic: id, keyword, ns, counts: out.counts, children: out.children, hasBrief: !!brief } }]);
  out.hasBrief = !!brief; out.sources = sources.length;
  try {
    await env.MIND_DB.prepare('UPDATE topics SET last_run=?, last_job=?, hits=COALESCE(hits,0)+? WHERE id=?').bind(t0, job.id, out.filed, id).run();
    await env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS mind_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, mode TEXT, q TEXT, created INTEGER)').run();
    await env.MIND_DB.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, 'topic', keyword.slice(0, 200), Date.now()).run();
  } catch (e) {}
  out.ms = Date.now() - t0;
  return out;
}
/** Everything on file for one topic, for the view and for SIFA. */
async function topicResults(env, idOrKeyword, days) {
  const topic = await topicGet(env, idOrKeyword);
  const id = (topic && topic.id) || topicSlug(idOrKeyword);
  if (!id) return null;
  const since = Date.now() - (Math.min(Math.max(parseInt(days, 10) || 30, 1), 365)) * 86400000;
  const db = env.MIND_DB;
  const pj = s => { try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } };
  const hits = (await db.prepare("SELECT src, title, body, url, ts, COALESCE(tone,0) tone, json_extract(meta,'$.source') source, json_extract(meta,'$.outlet') outlet, json_extract(meta,'$.mp') mp FROM arc_items WHERE kind='topic_hit' AND json_extract(meta,'$.topic')=? AND ts>? ORDER BY ts DESC LIMIT 300").bind(id, since).all()).results || [];
  const x = (await db.prepare("SELECT title, body, url, ts, COALESCE(tone,0) tone, json_extract(meta,'$.id') id, json_extract(meta,'$.score') score, json_extract(meta,'$.comments') comments, json_extract(meta,'$.mp') mp, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='x' AND json_extract(meta,'$.topic')=? AND ts>? ORDER BY ts DESC LIMIT 80").bind(id, since).all()).results || [];
  const reddit = (await db.prepare("SELECT title, body, url, ts, COALESCE(tone,0) tone, json_extract(meta,'$.id') id, json_extract(meta,'$.sub') sub, json_extract(meta,'$.score') score, json_extract(meta,'$.comments') comments, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='reddit_thread' AND json_extract(meta,'$.topic')=? AND ts>? ORDER BY ts DESC LIMIT 80").bind(id, since).all()).results || [];
  const cm = (await db.prepare("SELECT json_extract(meta,'$.platform') platform, COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind IN ('sig_comment','reddit_comment') AND json_extract(meta,'$.topic')=? AND ts>? GROUP BY platform").bind(id, since).all()).results || [];
  const jobs = (await db.prepare('SELECT id,source,status,agent,created,finished,ok FROM bridge_jobs WHERE who=? ORDER BY created DESC LIMIT 12').bind('topic:' + id).all()).results || [];
  let brief = null; try { brief = JSON.parse((await kvGet(env.AXIOM_KV, 'topic_brief_' + id)) || 'null'); } catch (e) { brief = null; }
  const strip = r => ({ title: r.title, url: r.url, ts: r.ts, tone: r.tone, source: r.source || '', outlet: r.outlet || r.src || '', mp: pj(r.mp), excerpt: String(r.body || '').split('\n')[0].slice(0, 400) });
  return {
    ok: true, topic: topic || { id, keyword: idOrKeyword }, days: Math.round((Date.now() - since) / 86400000), brief,
    news: hits.filter(h => h.source === 'news').map(strip), statements: hits.filter(h => h.source === 'statement').map(strip), hansard: hits.filter(h => h.source === 'hansard').map(strip),
    x: x.map(r => ({ title: r.title, url: r.url, ts: r.ts, tone: r.tone, id: r.id, score: r.score, comments: r.comments, mp: pj(r.mp), issues: pj(r.issues) || [], excerpt: String(r.body || '').split('\n')[0].slice(0, 400) })),
    reddit: reddit.map(r => ({ title: r.title, url: r.url, ts: r.ts, tone: r.tone, id: r.id, sub: r.sub || '', score: r.score, comments: r.comments, issues: pj(r.issues) || [], excerpt: String(r.body || '').split('\n')[0].slice(0, 400) })),
    comments: cm.map(c => ({ platform: c.platform || 'reddit', n: c.n || 0, hostile: c.hostile || 0, supportive: c.supportive || 0 })),
    jobs,
  };
}
/** Every tick: pull SIFA's list hourly, then run the two stalest active topics. */
async function topicsCron(env) {
  if (!env.MIND_DB || !(await ensureTopics(env))) return { ok: false };
  const now = Date.now();
  const out = { ok: true, synced: false, ran: [] };
  const last = Number((await kvGet(env.AXIOM_KV, 'topics_synced')) || 0);
  if (env.SIFA_TOKEN && now - last > 3600000) {
    const r = await sifaPull(env);
    let up = null;
    if (r.ok) up = await topicsUpsert(env, r.keywords, 'sifa');
    await kvPut(env.AXIOM_KV, 'topics_synced', String(now), 86400);
    await kvPut(env.AXIOM_KV, 'topics_sync_result', JSON.stringify({ at: now, ok: r.ok, n: (r.keywords || []).length, error: r.error || '', detail: r.detail || '', added: up ? up.added : 0, updated: up ? up.updated : 0 }), 7 * 86400);
    out.synced = r.ok;
  }
  const due = (await env.MIND_DB.prepare('SELECT id FROM topics WHERE active=1 AND COALESCE(last_run,0)<? ORDER BY priority DESC, COALESCE(last_run,0) ASC LIMIT 2').bind(now - 6 * 3600000).all()).results || [];
  for (const t of due) {
    const params = { id: t.id, hours: 168 };
    const job = await jobCreate(env, 'topic', params, 'cron');
    await jobRunLocal(env, { id: job.id, source: 'topic', params });
    out.ran.push(t.id);
  }
  return out;
}
/** SIFA's own bearer key on the inbound routes; never the AXIOM access key. */
function sifaInbound(req, env) {
  if (!env.SIFA_INBOUND_KEY) return { ok: false, status: 503, error: 'inbound_not_configured', detail: 'Set the worker secret SIFA_INBOUND_KEY and give that value to SIFA as its bearer token for AXIOM.' };
  const h = req.headers.get('Authorization') || '';
  const tok = /^Bearer\s+(.+)$/i.test(h) ? h.replace(/^Bearer\s+/i, '').trim() : '';
  if (!tok || !ctEq(tok, env.SIFA_INBOUND_KEY)) return { ok: false, status: 401, error: 'unauthorized', detail: 'Send Authorization: Bearer <the key AXIOM issued to SIFA>.' };
  return { ok: true };
}

async function signalsCron(env) {
  if (!env.MIND_DB) return;
  const last = Number(await kvGet(env.AXIOM_KV, 'signals_last_sweep') || 0);
  if (Date.now() - last < 6 * 3600000) return;
  await kvPut(env.AXIOM_KV, 'signals_last_sweep', String(Date.now()), 86400);
  const out = {};
  if (env.LINKEDIN_TOKEN && liOrgs(env).length) { try { out.linkedin = await linkedinSweep(env, {}); } catch (e) { out.linkedin = { error: String(e).slice(0, 120) }; } }
  if (env.META_TOKEN && metaPages(env).length) { try { out.meta = await metaOrganicSweep(env, {}); } catch (e) { out.meta = { error: String(e).slice(0, 120) }; } }
  await kvPut(env.AXIOM_KV, 'signals_last_result', JSON.stringify(out).slice(0, 4000), 7 * 86400);
}
/** Run a job here, in the worker, narrating every step into its log. */
/** Comment rows for one Reddit thread, in the sweep's exact shape: a comment
 *  carries its own issue tags and the thread's. No usernames. */
function redditCommentRowsFor(t, tid, cs) {
  let tIssues = [];
  try { tIssues = Array.isArray(t.issues) ? t.issues : JSON.parse(t.issues || '[]'); } catch (e) { tIssues = []; }
  if (!Array.isArray(tIssues)) tIssues = [];
  const title = String(t.title || '');
  return cs.map(c => {
    const all = issueMerge(redditIssues(c.body), tIssues);
    return {
      src: 'reddit', title: 'Comment on: ' + title.slice(0, 120), body: c.body, url: 'x:rcmt:' + c.id, author: '', tone: commentTone(c.body), ts: c.created || Date.now(),
      meta: { sub: t.sub || '', thread: tid, thread_title: title.slice(0, 200), permalink: t.url || '', score: c.score, depth: c.depth, issues: all, issue: all[0] || '', tone: commentTone(c.body) },
    };
  });
}
async function jobRunLocal(env, job) {
  const log = mkJobLog(env, job.id);
  let out = null, ok = false;
  try {
    if (job.source === 'reddit' && job.params && job.params.thread) {
      // One thread's comment tree - the Load live comments button. Same job
      // bus as a sweep, so it runs on the Mac whenever Reddit refuses us here.
      const tid = String(job.params.thread).replace(/[^a-z0-9_]/gi, '').slice(0, 20);
      const t = (await env.MIND_DB.prepare("SELECT title, url, json_extract(meta,'$.sub') sub, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='reddit_thread' AND json_extract(meta,'$.id')=?").bind(tid).first()) || {};
      const sub = String(t.sub || job.params.sub || '').replace(/[^\w]/g, '').slice(0, 40);
      const n = Math.min(Math.max(parseInt(job.params.commentsPer, 10) || 120, 5), 300);
      await log('info', 'reading one thread from the worker' + (redditAuthed(env) ? ' with your app credentials' : ' anonymously (Reddit often refuses cloud networks)'));
      await log('cmd', 'GET /r/' + sub + '/comments/' + tid + '?limit=' + n);
      try {
        const cs = await redditThreadComments(env, sub, tid, n, 4);
        await log('out', tid + ': ' + cs.length + ' comments');
        const rows = redditCommentRowsFor({ sub, title: t.title || job.params.title || '', url: t.url || job.params.permalink || '', issues: t.issues }, tid, cs);
        let added = 0; for (let i = 0; i < rows.length; i += 150) added += await archiveItems(env, 'reddit_comment', rows.slice(i, i + 150));
        await log('info', 'filed ' + added + ' new comments');
        out = { ok: true, platform: 'reddit', thread: tid, threads: 0, threadRows: 0, comments: cs.length, commentRows: added, hostile: rows.filter(r => r.tone < 0).length };
        ok = true;
      } catch (e) {
        const m = String((e && e.message) || e).slice(0, 80);
        const throttled = /rate_limited/.test(m);
        out = { ok: false, platform: 'reddit', thread: tid, error: throttled ? 'reddit_rate_limited' : 'reddit_blocked', comments: 0, commentRows: 0,
          detail: (throttled ? 'Reddit is throttling the worker (' + m + ').' : 'Reddit refused this network (' + m + ').') + ' Run the collector on your Mac - cd ~/Axiom && python3 tools/reach-agent.py --key $AXIOM_KEY - and press Load live comments again: the fetch will go there and show here.' };
        await log('err', m);
      }
    } else if (job.source === 'reddit') {
      await log('info', 'sweeping Reddit from the worker' + (redditAuthed(env) ? ' with your app credentials' : ' anonymously (Reddit often refuses cloud networks)'));
      // one probe before the full sweep: if Reddit refuses this network there is
      // no point spending three minutes proving it thirty more times
      await log('cmd', 'GET /r/AustralianPolitics/hot?limit=5  (reachability probe)');
      try {
        const probe = await redditListing(env, 'AustralianPolitics', 'hot', 5);
        await log('out', 'Reddit answered: ' + probe.length + ' threads');
      } catch (e) {
        const m = String((e && e.message) || e).slice(0, 80);
        await log('err', m);
        out = { ok: false, platform: 'reddit', error: 'reddit_blocked', threads: 0, comments: 0, threadRows: 0, commentRows: 0,
          detail: 'Reddit refused this network (' + m + '). It blocks Cloudflare IPs and closed self-service API registration in late 2025, so the worker cannot collect it. Run the collector on your Mac - cd ~/Axiom && python3 tools/reach-agent.py --key $AXIOM_KEY - and press Sweep again: the job will go there and this console will show it. If you hold Reddit app credentials, REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET as worker secrets also fix it.' };
        await log('err', out.detail);
        await log.flush();
        await jobFinish(env, job.id, false, out);
        return out;
      }
      out = await redditSweep(env, Object.assign({ queries: 'auto' }, job.params, { log: log }));
      // a sweep that collected nothing and hit errors is a failure, whatever
      // the shape of the return: the console should say so in red
      ok = !!(out && out.ok) && (out.threads > 0 || !(out.errors || []).length);
      if (!ok && out) out.detail = 'Nothing was collected. ' + ((out.errors || [])[0] || '') + ' Reddit refuses cloud networks; run tools/reach-agent.py on your Mac and press Sweep again.';
    } else if (job.source === 'topic') {
      out = await topicRun(env, job, log);
      ok = !!(out && out.ok);
      if (ok && out.childLocal) {
        // the Reddit keyword pass was routed to the worker: run it once this job is closed
        const child = out.childLocal; delete out.childLocal;
        await log('info', 'running Reddit job ' + child.id + ' in the worker next');
        await log.flush(); await jobFinish(env, job.id, ok, out);
        await jobRunLocal(env, { id: child.id, source: 'reddit', params: child.params });
        return out;
      }
    } else if (job.source === 'linkedin') {
      out = await linkedinSweep(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else if (job.source === 'meta') {
      out = await metaOrganicSweep(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else if (job.source === 'sources') {
      out = await sourceSweep(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else if (job.source === 'render') {
      out = await renderJob(env, job, log);
      ok = !!(out && out.ok);
    } else if (job.source === 'sentiment') {
      out = await sentimentRun(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else if (job.source === 'narratives') {
      out = await narrativesRun(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else if (SOCIAL_PLATFORMS.indexOf(job.source) >= 0) {
      out = await socialSweep(env, Object.assign({}, job.params, { platform: job.source }), log);
      ok = !!(out && out.ok);
    } else if (job.source === 'x') {
      // reached only when the job was sent here on purpose (where:'worker'):
      // the account timelines through X's embed service; search stays on the Mac
      out = await xSyndSweep(env, Object.assign({}, job.params, { log: log }));
      ok = !!(out && out.ok);
    } else {
      out = { ok: false, error: 'desktop_only', detail: job.source + ' can only be collected from a logged-in desktop. Run tools/reach-agent.py on your Mac and it will claim this job.' };
    }
    if (!ok && out && out.error) await log('err', out.error + (out.detail ? ': ' + out.detail : ''));
  } catch (e) {
    out = { ok: false, error: 'sweep_failed', detail: String((e && e.message) || e).slice(0, 300) };
    await log('err', out.detail);
  }
  await log.flush();
  await jobFinish(env, job.id, ok, out);
  return out;
}

// ==============================================================================
// THE RELEASE DESK - a media release in, a pack of social tiles out.
// Paste a release; the Desk extracts what it actually says (claims, numbers,
// quotes, who is speaking), composes a set of tiles in the client's voice
// using the playbook held in the Mind, then renders each one through the
// image engine with the client's stored brand kit. Every number on a tile is
// checked back against the release text, every pack is archived with its
// source and its author, and every render is logged to the job the app tails.
// Nothing here touches the Audience or Supermetrics paths.
// ==============================================================================
let RELEASE_READY = false;
const RELEASE_KINDS = ['lead', 'stat', 'people', 'proof', 'warning', 'quote', 'cta'];
const RELEASE_FORMATS = { square: '1:1', portrait: '4:5', story: '9:16', landscape: '16:9' };
async function ensureRelease(env) {
  if (!env.MIND_DB) return false;
  if (RELEASE_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS release_packs(id TEXT PRIMARY KEY, ns TEXT, title TEXT, source TEXT, extract TEXT, tiles TEXT, status TEXT, job TEXT, who TEXT, format TEXT, created INTEGER, updated INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS release_packs_ns ON release_packs(ns, created)'),
  ]);
  RELEASE_READY = true;
  return true;
}
function relNs(v) { return String(v || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm'; }
function relId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function relJson(txt) {
  const s2 = typeof txt === 'string' ? txt : (txt && (txt.text || JSON.stringify(txt))) || '';
  try { return JSON.parse((s2.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch (e) { return null; }
}

// -- Brand kit: one per client, set once, used by every render ----------------
async function brandKit(env, ns) {
  let kit = null;
  try { kit = JSON.parse(await kvGet(env.AXIOM_KV, 'brand_' + ns) || 'null'); } catch (e) { kit = null; }
  return kit && typeof kit === 'object' ? kit : null;
}
async function brandLogo(env, ns) {
  if (!env.MIND_DOCS) return null;
  try {
    const obj = await env.MIND_DOCS.get('brand/' + ns + '/logo');
    if (!obj) return null;
    const buf = await obj.arrayBuffer();
    return { bytes: buf, mime: (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/png' };
  } catch (e) { return null; }
}
function b64FromBuf(buf) {
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function bufFromB64(b64) {
  const bin = atob(String(b64 || '').replace(/^data:[^;]+;base64,/, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
async function brandSave(env, ns, body, who) {
  const cur = (await brandKit(env, ns)) || {};
  const pick = (v, n) => String(v == null ? '' : v).slice(0, n);
  const pal = Object.assign({}, cur.palette || {});
  if (body.palette && typeof body.palette === 'object') {
    ['primary', 'secondary', 'bg', 'text'].forEach(k => { const v = String(body.palette[k] || '').trim(); if (/^#[0-9a-fA-F]{3,8}$/.test(v)) pal[k] = v; else if (v === '') delete pal[k]; });
  }
  // the structured half - campaigns, facts, banned terms, platform notes,
  // segments, people - is what the Content Desk writes from; see kitStructured
  const kit = Object.assign({
    ns, name: pick(body.name != null ? body.name : cur.name, 80), palette: pal,
    fonts: { display: pick(body.fonts && body.fonts.display != null ? body.fonts.display : (cur.fonts || {}).display, 60), body: pick(body.fonts && body.fonts.body != null ? body.fonts.body : (cur.fonts || {}).body, 60) },
    voice: pick(body.voice != null ? body.voice : cur.voice, 4000),
    rules: pick(body.rules != null ? body.rules : cur.rules, 3000),
    logoMime: cur.logoMime || '', hasLogo: !!cur.hasLogo, updated: Date.now(), by: String(who || '').slice(0, 40),
  }, kitStructured(body, cur));
  if (body.logoB64) {
    if (!env.MIND_DOCS) throw new Error('mind_not_configured: bind MIND_DOCS (R2) to store a logo');
    const mime = String(body.logoMime || 'image/png');
    if (!/^image\/(png|jpeg|webp)$/.test(mime)) throw new Error('logo must be PNG, JPEG or WebP');
    const buf = bufFromB64(body.logoB64);
    if (buf.byteLength > 2 * 1024 * 1024) throw new Error('logo larger than 2 MB');
    if (buf.byteLength < 64) throw new Error('logo file is empty');
    await env.MIND_DOCS.put('brand/' + ns + '/logo', buf, { httpMetadata: { contentType: mime } });
    kit.logoMime = mime; kit.hasLogo = true;
  }
  if (body.removeLogo && env.MIND_DOCS) { try { await env.MIND_DOCS.delete('brand/' + ns + '/logo'); } catch (e) {} kit.hasLogo = false; kit.logoMime = ''; }
  await kvPut(env.AXIOM_KV, 'brand_' + ns, JSON.stringify(kit), 10 * 365 * 86400);
  return kit;
}

// -- Compose: the release, read properly, then the tiles -------------------------
async function releaseExtract(env, text, log) {
  const sys = 'You read Australian media releases for a political communications agency. Return strict JSON only, no prose: '
    + '{"headline":"","subhead":"","org":"","spokesperson":{"name":"","title":""},"date":"","topic":"","claims":["the release\'s own assertions, one per string, in its words"],'
    + '"numbers":[{"value":"exact figure as written","context":"what it measures"}],"quotes":[{"text":"verbatim sentence from the release","who":""}],'
    + '"asks":["what the release wants to happen"],"tone":"","risks":["how an opponent would attack this"]}. '
    + 'Copy figures and quotes exactly as written. Never add a number the release does not contain.';
  await log('cmd', 'claude: extract claims, numbers, quotes and speaker from the release (' + text.length + ' chars)');
  const raw = await claudeMsg(env, sys, 'MEDIA RELEASE:\n\n' + text.slice(0, 24000), 2200, 60000);
  const j = relJson(raw);
  if (!j) throw new Error('extract_unparseable');
  j.numbers = Array.isArray(j.numbers) ? j.numbers.slice(0, 20) : [];
  j.quotes = Array.isArray(j.quotes) ? j.quotes.slice(0, 12) : [];
  j.claims = Array.isArray(j.claims) ? j.claims.slice(0, 20) : [];
  await log('out', (j.headline || 'no headline') + ' - ' + j.claims.length + ' claims, ' + j.numbers.length + ' numbers, ' + j.quotes.length + ' quotes' + (j.spokesperson && j.spokesperson.name ? ', speaker ' + j.spokesperson.name : ''));
  return j;
}
/** Every digit-bearing token on a tile must appear in the release. */
function relNumberCheck(text, source) {
  const src = String(source || '').replace(/[\s,]/g, '').toLowerCase();
  const toks = String(text || '').match(/\d[\d.,%]*/g) || [];
  const missing = toks.map(t => t.replace(/[,]/g, '').replace(/[.%]+$/, '')).filter(t => t && src.indexOf(t.replace(/%/g, '')) < 0);
  return { ok: !missing.length, missing };
}
async function releaseCompose(env, pack, opts, log) {
  const ns = pack.ns;
  const kit = (await brandKit(env, ns)) || {};
  let playbook = '';
  try {
    const hits = await mindRetrieve(env, ns, 'brand voice tone wording style rules messaging pillars design guidelines policy positions ' + (pack.extract.topic || ''), 6);
    playbook = hits.slice(0, 8).map(h => '[' + String(h.meta.kind || 'doc').toUpperCase() + ' - ' + (h.meta.title || '') + '] ' + (h.meta.snippet || '')).join('\n').slice(0, 3500);
    await log('out', 'Mind: ' + hits.length + ' playbook notes for ' + ns);
  } catch (e) { await log('info', 'Mind retrieval skipped: ' + String(e.message || e).slice(0, 80)); }
  const n = Math.min(Math.max(parseInt(opts.tiles, 10) || 6, 3), 8);
  const client = (CLIENT_ISSUES.find(ci => ci.ns === ns) || {}).client || kit.name || 'the client';
  const ex = pack.extract;
  const sys = 'You are the creative director of an Australian political communications agency, turning a client media release into social media tiles. Client: ' + client + '.'
    + (kit.voice ? '\n\nCLIENT VOICE:\n' + kit.voice : '') + (opts.brief ? '\n\nCLIENT BRIEF:\n' + String(opts.brief).slice(0, 3000) : '')
    + (kit.rules ? '\n\nSTANDING RULES:\n' + kit.rules : '') + (playbook ? '\n\nPLAYBOOK (from the client knowledge base):\n' + playbook : '')
    + ((kit.banned || []).length ? '\n\nNEVER USE these words (and what to say instead):\n' + kit.banned.map(b => '- "' + b.term + '"' + (b.use ? ' -> ' + b.use : '') + (b.allowNegated ? ' (allowed only inside a denial)' : '')).join('\n') : '')
    + '\n\nRULES. Use only facts, figures and quotes that appear in the release - never invent a number or a quotation. Australian English. Plain, confident, human; no jargon, no exclamation marks, no hashtags in headlines.'
    + ' Each tile does one job. Headline max 60 characters, support line max 120, CTA max 28 or empty. A "stat" tile only if the release contains a real figure; its headline is the figure itself.'
    + ' A "quote" tile uses a verbatim sentence from the release with attribution. Captions: LinkedIn up to 600 chars (professional, one line break allowed), X up to 270, Facebook up to 400; captions may add one relevant hashtag at most.'
    + ' Return strict JSON only: {"tiles":[{"kind":"lead|stat|people|proof|warning|quote|cta","headline":"","support":"","cta":"","caption":{"linkedin":"","x":"","facebook":""},"alt":"<=140 chars image description for accessibility","visual":"<=200 chars art direction: subject, mood, composition; no text instructions"}]}.'
    + ' Produce exactly ' + n + ' tiles, ordered lead first, quote last if present, no duplicate kinds unless there are more tiles than kinds.';
  const user = 'RELEASE EXTRACT:\n' + JSON.stringify(ex).slice(0, 12000) + '\n\nFULL RELEASE TEXT:\n' + pack.source.slice(0, 16000);
  // what the team has taught the Engine, for this client and for everyone
  let learned = { text: '', count: 0 };
  try { learned = await engineRules(env, ns, 'tiles'); } catch (e) {}
  if (learned.count) await log('info', 'applying ' + learned.count + ' learned correction' + (learned.count === 1 ? '' : 's') + ' for ' + ns);
  await log('cmd', 'claude: compose ' + n + ' tiles in the ' + client + ' voice');
  const raw = await claudeMsg(env, sys + learned.text, user, 4000, 90000);
  const j = relJson(raw);
  if (!j || !Array.isArray(j.tiles) || !j.tiles.length) throw new Error('compose_unparseable');
  const tiles = j.tiles.slice(0, n).map((t, i) => {
    const kind = RELEASE_KINDS.indexOf(String(t.kind || '').toLowerCase()) >= 0 ? String(t.kind).toLowerCase() : 'lead';
    const headline = String(t.headline || '').trim().slice(0, 90), support = String(t.support || '').trim().slice(0, 180), cta = String(t.cta || '').trim().slice(0, 40);
    const chk = relNumberCheck(headline + ' ' + support + ' ' + cta, pack.source);
    const cap = t.caption && typeof t.caption === 'object' ? t.caption : {};
    return { n: i, kind, headline, support, cta,
      caption: { linkedin: String(cap.linkedin || '').slice(0, 700), x: String(cap.x || '').slice(0, 280), facebook: String(cap.facebook || '').slice(0, 500) },
      alt: String(t.alt || '').slice(0, 160), visual: String(t.visual || '').slice(0, 240),
      check: chk, image: null };
  });
  const warn = tiles.filter(t => !t.check.ok);
  await log('out', tiles.length + ' tiles: ' + tiles.map(t => t.kind).join(', ') + (warn.length ? ' - ' + warn.length + ' carry a figure not found in the release (flagged, not blocked)' : ' - every figure traced to the release'));
  return tiles;
}
/** The whole compose stage, run after POST /release/pack has answered. */
async function releaseBuild(env, packId, opts) {
  const log = mkJobLog(env, opts.job);
  let pack = await env.MIND_DB.prepare('SELECT id,ns,title,source,who,format FROM release_packs WHERE id=?').bind(packId).first();
  if (!pack) return;
  try {
    pack.extract = await releaseExtract(env, pack.source, log);
    const tiles = await releaseCompose(env, pack, opts, log);
    const title = String(pack.extract.headline || pack.title || 'Release').slice(0, 200);
    await env.MIND_DB.prepare('UPDATE release_packs SET title=?, extract=?, tiles=?, status=?, updated=? WHERE id=?')
      .bind(title, JSON.stringify(pack.extract).slice(0, 60000), JSON.stringify(tiles), 'composed', Date.now(), packId).run();
    // provenance: the release itself is archived with the pack it produced
    try {
      await archiveItems(env, 'release', [{ src: 'release', title, body: pack.source.slice(0, 20000), url: 'x:release:' + packId, author: '',
        meta: { ns: pack.ns, packId, who: pack.who, tiles: tiles.length, spokesperson: (pack.extract.spokesperson || {}).name || '', format: pack.format } }]);
    } catch (e) {}
    await log('info', 'pack ' + packId + ' composed: "' + title + '" - ' + tiles.length + ' tiles ready to render');
    await log.flush();
    await jobFinish(env, opts.job, true, { ok: true, packId, title, tiles: tiles.length, flagged: tiles.filter(t => !t.check.ok).length });
  } catch (e) {
    const m = String((e && e.message) || e).slice(0, 200);
    await log('err', m);
    await log.flush();
    await env.MIND_DB.prepare('UPDATE release_packs SET status=?, updated=? WHERE id=?').bind('failed', Date.now(), packId).run();
    await jobFinish(env, opts.job, false, { ok: false, error: 'compose_failed', detail: m });
  }
}
/** One tile, rendered in the brand, text baked, logo placed. */
function releasePrompt(tile, kit, client, format) {
  const pal = kit.palette || {};
  const dir = {
    lead: 'Bold, editorial lead tile. The headline dominates; the support line sits beneath it.',
    stat: 'A single large figure dominates the tile (the headline IS the figure); the support line explains it in smaller type.',
    people: 'Human scale: Australian workers in an industrial or regional setting, photographic, dignified, no faces in sharp focus.',
    proof: 'Substantial and credible: infrastructure, industry, the scale of what the sector does; confident composition.',
    warning: 'Urgent but composed: a sense of time and competition; darker palette, strong contrast.',
    quote: 'A pull-quote tile: large opening quotation mark, the quote as the headline, attribution as the support line.',
    cta: 'A clear action tile: the CTA is the most prominent element after the headline.',
  }[tile.kind] || 'Clean, confident social tile.';
  return 'Design a premium social media tile for ' + client + '. Format: ' + (RELEASE_FORMATS[format] ? format : 'square') + '.\n'
    + dir + (tile.visual ? '\nArt direction: ' + tile.visual : '') + '\n'
    + (pal.primary ? 'Brand palette: primary ' + pal.primary + (pal.secondary ? ', secondary ' + pal.secondary : '') + (pal.bg ? ', background ' + pal.bg : '') + (pal.text ? ', text ' + pal.text : '') + '. Use these colours faithfully.\n' : '')
    + (kit.fonts && (kit.fonts.display || kit.fonts.body) ? 'Typography: headlines in ' + (kit.fonts.display || 'a bold grotesque') + ', body in ' + (kit.fonts.body || 'a clean sans') + '.\n' : '')
    + '\nPlace THIS text on the tile, spelled EXACTLY as written, clearly legible with generous margins:\n- HEADLINE (dominant): ' + tile.headline
    + (tile.support ? '\n- SUPPORTING LINE: ' + tile.support : '') + (tile.cta ? '\n- CTA BUTTON: ' + tile.cta : '')
    + (kit.hasLogo ? '\n\nThe attached image is the client logo: reproduce it exactly, unaltered, small, in the bottom-right corner on a clear background area.' : '\n\nDo not draw a logo.')
    + '\n\nStrict: render ONLY the exact text above - no other words, letters, gibberish or watermarks. One finished graphic.';
}
async function releaseRender(env, packId, n, patch, who) {
  const row = await env.MIND_DB.prepare('SELECT id,ns,title,tiles,job,format FROM release_packs WHERE id=?').bind(packId).first();
  if (!row) return { ok: false, error: 'unknown_pack', status: 404 };
  let tiles = []; try { tiles = JSON.parse(row.tiles || '[]'); } catch (e) { tiles = []; }
  const tile = tiles[n];
  if (!tile) return { ok: false, error: 'unknown_tile', status: 404 };
  if (patch && typeof patch === 'object') {
    ['headline', 'support', 'cta'].forEach(k => { if (patch[k] != null) tile[k] = String(patch[k]).slice(0, k === 'headline' ? 90 : k === 'support' ? 180 : 40); });
    if (patch.visual != null) tile.visual = String(patch.visual).slice(0, 240);
    const src = (await env.MIND_DB.prepare('SELECT source FROM release_packs WHERE id=?').bind(packId).first()) || {};
    tile.check = relNumberCheck(tile.headline + ' ' + tile.support + ' ' + tile.cta, src.source || '');
  }
  const kit = (await brandKit(env, row.ns)) || {};
  const client = (CLIENT_ISSUES.find(ci => ci.ns === row.ns) || {}).client || kit.name || 'the client';
  const refs = [];
  if (kit.hasLogo) { const lg = await brandLogo(env, row.ns); if (lg) refs.push({ data: b64FromBuf(lg.bytes), mime: lg.mime }); }
  const log = mkJobLog(env, row.job);
  await log('cmd', 'gemini: render tile ' + (n + 1) + ' (' + tile.kind + ') - "' + tile.headline.slice(0, 60) + '"' + (refs.length ? ' with the brand logo' : ''));
  const out = await nanoRender(env, { prompt: releasePrompt(tile, kit, client, row.format), references: refs, aspect: RELEASE_FORMATS[row.format] || '1:1', size: '1K' });
  if (!out.ok) { await log('err', 'tile ' + (n + 1) + ': ' + out.error + (out.detail ? ' - ' + out.detail : '')); await log.flush(); return { ok: false, error: out.error, detail: out.detail, status: 502 }; }
  if (!env.MIND_DOCS) { await log.flush(); return { ok: false, error: 'mind_not_configured', detail: 'Bind MIND_DOCS (R2) to store rendered tiles.', status: 501 }; }
  const key = 'packs/' + packId + '/' + n + '.png';
  await env.MIND_DOCS.put(key, bufFromB64(out.imageB64), { httpMetadata: { contentType: out.mime || 'image/png' } });
  tile.image = { key, mime: out.mime || 'image/png', model: out.model, rendered: Date.now(), by: String(who || '').slice(0, 40), ver: ((tile.image && tile.image.ver) || 0) + 1 };
  tiles[n] = tile;
  const allDone = tiles.every(t => t.image);
  await env.MIND_DB.prepare('UPDATE release_packs SET tiles=?, status=?, updated=? WHERE id=?').bind(JSON.stringify(tiles), allDone ? 'rendered' : 'composed', Date.now(), packId).run();
  await log('out', 'tile ' + (n + 1) + ' rendered by ' + out.model + (allDone ? ' - pack complete' : ''));
  await log.flush();
  return { ok: true, n, tile, url: '/release/tile?id=' + packId + '&n=' + n + '&v=' + tile.image.ver, model: out.model, complete: allDone };
}
function relTileView(packId, t) {
  return Object.assign({}, t, { image: t.image ? { url: '/release/tile?id=' + packId + '&n=' + t.n + '&v=' + (t.image.ver || 1), model: t.image.model, rendered: t.image.rendered, ver: t.image.ver || 1 } : null });
}

// ==============================================================================
// THE ENGINE - the memory the model cannot work without, and the loop that
// makes it learn. Not a fine-tune: corrections the team teaches become rules
// that are in the prompt within the minute, scoped to a client or to everyone,
// switchable and deletable. Approved and killed outputs become exemplars.
// Past artwork is described by a vision model and remembered so "make it like
// the March creative" means something. Every piece carries who taught it and
// when. Namespaces stay walls: a client's corrections never reach another.
// ==============================================================================
let ENGINE_READY = false;
const ENGINE_TASKS = ['tiles', 'copy', 'analysis', 'any'];
async function ensureEngine(env) {
  if (!env.MIND_DB) return false;
  if (ENGINE_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS engine_fixes(id TEXT PRIMARY KEY, ns TEXT, task TEXT, scope TEXT, wrong TEXT, rightt TEXT, why TEXT, rule TEXT, exemplar TEXT, source TEXT, who TEXT, created INTEGER, active INTEGER, hits INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS engine_fixes_ns ON engine_fixes(ns, active, created)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS engine_outcomes(id TEXT PRIMARY KEY, ns TEXT, surface TEXT, ref TEXT, n INTEGER, verdict TEXT, why TEXT, headline TEXT, support TEXT, cta TEXT, who TEXT, created INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS engine_outcomes_ns ON engine_outcomes(ns, created)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS engine_art(id TEXT PRIMARY KEY, ns TEXT, title TEXT, key TEXT, mime TEXT, description TEXT, meta TEXT, docId TEXT, who TEXT, created INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS engine_art_ns ON engine_art(ns, created)'),
  ]);
  ENGINE_READY = true;
  return true;
}
function engTask(v) { const t = String(v || 'any').toLowerCase(); return ENGINE_TASKS.indexOf(t) >= 0 ? t : 'any'; }
function engId(pfx) { return pfx + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
/** Turn a correction into a rule the model can follow. Claude writes it when it
 *  can; a plain fallback keeps the loop working when it cannot. */
async function engineCompileFix(env, fix) {
  const fallback = {
    rule: (fix.wrong ? 'Do not write "' + fix.wrong.slice(0, 160) + '". ' : '') + (fix.right ? 'Write "' + fix.right.slice(0, 160) + '" instead.' : '') + (fix.why ? ' ' + fix.why.slice(0, 200) : ''),
    exemplar: fix.right ? fix.right.slice(0, 300) : '',
  };
  if (!env.ANTHROPIC_API_KEY) return fallback;
  try {
    const sys = 'You turn a single correction from a communications team into one standing rule for a copywriting model. Return strict JSON only: {"rule":"one imperative sentence, max 40 words, general enough to apply next time but no broader than the correction supports","exemplar":"the corrected wording verbatim, or empty"}. Never soften the correction. Never invent facts.';
    const user = 'WHAT THE MODEL WROTE:\n' + (fix.wrong || '(not given)') + '\n\nWHAT IT SHOULD HAVE BEEN:\n' + (fix.right || '(not given)') + '\n\nWHY:\n' + (fix.why || '(not given)') + '\n\nTASK: ' + fix.task + '. SCOPE: ' + (fix.scope === 'all' ? 'every client' : 'this client only') + '.';
    const raw = await claudeMsg(env, sys, user, 400, 30000);
    const j = relJson(raw);
    if (j && j.rule) return { rule: String(j.rule).slice(0, 400), exemplar: String(j.exemplar || '').slice(0, 300) };
  } catch (e) {}
  return fallback;
}
async function engineAddFix(env, body, who) {
  await ensureEngine(env);
  const ns = relNs(body.ns);
  const fix = { id: engId('f'), ns, task: engTask(body.task), scope: body.scope === 'all' ? 'all' : 'client',
    wrong: String(body.wrong || '').trim().slice(0, 1200), right: String(body.right || '').trim().slice(0, 1200), why: String(body.why || '').trim().slice(0, 600),
    source: String(body.source || '').slice(0, 120), who: String(who || '').slice(0, 40), created: Date.now() };
  if (!fix.wrong && !fix.right) throw new Error('a correction needs what was wrong or what it should be');
  const c = body.rule ? { rule: String(body.rule).slice(0, 400), exemplar: String(body.exemplar || fix.right).slice(0, 300) } : await engineCompileFix(env, fix);
  fix.rule = c.rule; fix.exemplar = c.exemplar;
  await env.MIND_DB.prepare('INSERT INTO engine_fixes(id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,0)')
    .bind(fix.id, fix.ns, fix.task, fix.scope, fix.wrong, fix.right, fix.why, fix.rule, fix.exemplar, fix.source, fix.who, fix.created).run();
  return fix;
}
async function engineFixes(env, ns, task, all) {
  await ensureEngine(env);
  const rows = (await env.MIND_DB.prepare("SELECT id,ns,task,scope,wrong,rightt,why,rule,exemplar,source,who,created,active,hits FROM engine_fixes WHERE (ns=? OR scope='all') " + (all ? '' : 'AND active=1 ') + 'ORDER BY created DESC LIMIT 200').bind(ns).all()).results || [];
  const t = engTask(task);
  return rows.filter(r => !task || t === 'any' || r.task === t || r.task === 'any').map(r => ({ id: r.id, ns: r.ns, task: r.task, scope: r.scope, wrong: r.wrong, right: r.rightt, why: r.why, rule: r.rule, exemplar: r.exemplar, source: r.source, who: r.who, created: r.created, active: !!r.active, hits: r.hits || 0 }));
}
/** The block that goes into a prompt: the team's standing corrections for this
 *  client and task, newest first, and a note of how many are in force. */
async function engineRules(env, ns, task, limit) {
  const fixes = (await engineFixes(env, ns, task, false)).slice(0, limit || 60);
  if (!fixes.length) return { text: '', count: 0, ids: [] };
  const lines = fixes.map(f => '- ' + f.rule + (f.exemplar && f.exemplar !== f.rule ? ' (e.g. "' + f.exemplar.slice(0, 140) + '")' : ''));
  const text = '\n\nLEARNED CORRECTIONS - taught by the team, ' + fixes.length + ' in force; these outrank taste and any generic guideline:\n' + lines.join('\n');
  try { await env.MIND_DB.batch(fixes.map(f => env.MIND_DB.prepare('UPDATE engine_fixes SET hits=hits+1 WHERE id=?').bind(f.id))); } catch (e) {}
  return { text, count: fixes.length, ids: fixes.map(f => f.id) };
}
async function engineOutcome(env, body, who) {
  await ensureEngine(env);
  const ns = relNs(body.ns);
  const verdict = body.verdict === 'killed' ? 'killed' : 'approved';
  const o = { id: engId('o'), ns, surface: String(body.surface || 'release').slice(0, 40), ref: String(body.ref || '').slice(0, 60), n: parseInt(body.n, 10) || 0, verdict,
    why: String(body.why || '').slice(0, 600), headline: String(body.headline || '').slice(0, 200), support: String(body.support || '').slice(0, 300), cta: String(body.cta || '').slice(0, 60),
    who: String(who || '').slice(0, 40), created: Date.now() };
  await env.MIND_DB.prepare('INSERT INTO engine_outcomes(id,ns,surface,ref,n,verdict,why,headline,support,cta,who,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(o.id, o.ns, o.surface, o.ref, o.n, o.verdict, o.why, o.headline, o.support, o.cta, o.who, o.created).run();
  // an exemplar in the Mind, so future briefs retrieve the wins and learn from the losses
  let docId = '';
  try {
    const text = 'VERDICT: ' + verdict.toUpperCase() + '\nSurface: ' + o.surface + (o.ref ? ' ' + o.ref + ' tile ' + (o.n + 1) : '') + '\nDate: ' + new Date().toISOString().slice(0, 10)
      + (o.headline ? '\nHeadline: ' + o.headline : '') + (o.support ? '\nSupport: ' + o.support : '') + (o.cta ? '\nCTA: ' + o.cta : '') + (o.why ? '\nWhy: ' + o.why : '');
    const r = await mindIngestDoc(env, { ns, title: (verdict === 'approved' ? 'WIN: ' : 'LOSS: ') + (o.headline || o.surface).slice(0, 120), text, kind: 'outcome', source: o.surface + ':' + o.ref, date: new Date().toISOString().slice(0, 10) });
    docId = r.docId;
  } catch (e) {}
  return Object.assign(o, { docId });
}
/** Describe a piece of artwork with a vision model so it can be remembered and
 *  retrieved. Text only comes back; the image itself goes to R2. */
async function engineDescribe(env, imageB64, mime, hint) {
  if (!env.GEMINI_KEY) return { ok: false, error: 'gemini_not_configured' };
  const prompt = 'You are a creative director cataloguing a political communications agency\'s past artwork so it can be found and reused. Describe this creative in 90-140 words for a colleague who cannot see it: format and layout, dominant colours as hex guesses, typography style, imagery and mood, every word of text that appears (verbatim), and what kind of message it carries. Then on a final line write TAGS: followed by 6-10 comma-separated tags (issue, tone, format, style).' + (hint ? '\n\nContext from the file: ' + String(hint).slice(0, 400) : '');
  const parts = [{ text: prompt }, { inline_data: { mime_type: mime || 'image/png', data: String(imageB64) } }];
  let last = '';
  for (const model of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
    try {
      const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(env.GEMINI_KEY), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }), signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined });
      const d = await r.json().catch(() => ({}));
      if (d.error) { last = String(d.error.message || '').slice(0, 160); continue; }
      const txt = (((d.candidates || [])[0] || {}).content || {}).parts;
      const out = (txt || []).filter(p => p.text).map(p => p.text).join('').trim();
      if (out) return { ok: true, description: out.slice(0, 2500), model };
      last = 'no description returned';
    } catch (e) { last = String((e && e.message) || e).slice(0, 80); }
  }
  return { ok: false, error: 'describe_failed', detail: last };
}
async function engineArtwork(env, body, who) {
  await ensureEngine(env);
  const ns = relNs(body.ns);
  if (!env.MIND_DOCS) throw new Error('mind_not_configured: bind MIND_DOCS (R2) to store artwork');
  const mime = String(body.mime || 'image/png');
  if (!/^image\/(png|jpeg|webp)$/.test(mime)) throw new Error('artwork must be PNG, JPEG or WebP');
  const buf = bufFromB64(body.imageB64);
  if (buf.byteLength > 6 * 1024 * 1024) throw new Error('artwork larger than 6 MB');
  if (buf.byteLength < 64) throw new Error('artwork file is empty');
  const id = engId('a');
  const title = String(body.title || 'Artwork').slice(0, 200);
  const meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
  const d = await engineDescribe(env, body.imageB64, mime, title + ' ' + JSON.stringify(meta).slice(0, 300));
  if (!d.ok) throw new Error(d.error + (d.detail ? ': ' + d.detail : ''));
  const key = 'art/' + ns + '/' + id;
  await env.MIND_DOCS.put(key, buf, { httpMetadata: { contentType: mime } });
  let docId = '';
  try {
    const text = '# Artwork: ' + title + '\n\n' + d.description + '\n\nSource: ' + (meta.path || meta.source || 'upload') + (meta.date ? '\nDate: ' + meta.date : '') + (meta.campaign ? '\nCampaign: ' + meta.campaign : '') + '\nImage: ' + key;
    const r = await mindIngestDoc(env, { ns, title: 'Artwork: ' + title, text, kind: 'artwork', source: String(meta.path || meta.source || 'upload').slice(0, 300), date: String(meta.date || '').slice(0, 20) });
    docId = r.docId;
  } catch (e) {}
  await env.MIND_DB.prepare('INSERT INTO engine_art(id,ns,title,key,mime,description,meta,docId,who,created) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(id, ns, title, key, mime, d.description, JSON.stringify(meta).slice(0, 2000), docId, String(who || '').slice(0, 40), Date.now()).run();
  return { id, ns, title, key, description: d.description, model: d.model, docId, url: '/engine/art?id=' + id };
}

// ==============================================================================
// THE CONTENT DESK - copy for each client and each platform, written in the
// client's own voice: the brand kit (voice, standing rules, campaigns with
// their sign-offs, approved facts with sources, banned terms, platform and
// audience notes), the approved examples filed in the Mind, and the
// corrections the team has taught the Engine. Every piece can be changed by
// instruction: a one-off change is applied to this set; a standing instruction
// ("always write per cent", "never call it a subsidy") becomes a rule that the
// next build obeys, for this client only. Every figure is checked back against
// the approved facts and the source material and flagged, never dropped.
// ==============================================================================
let CONTENT_READY = false;
const CONTENT_PLATFORMS = {
  facebook:  { label: 'Facebook', max: 900, ideal: [300, 650], hashtags: 0, register: 'The fullest caption: a hook line, the fact and what it funds or who it employs, the sign-off, the link line, the source line. Short paragraphs separated by blank lines.' },
  instagram: { label: 'Instagram', max: 700, ideal: [180, 480], hashtags: 1, register: 'Shorter and visual-first; the image carries the headline, the caption adds the meaning. One hashtag at most, none in paid.' },
  linkedin:  { label: 'LinkedIn', max: 900, ideal: [250, 550], hashtags: 0, register: 'Professional and evidence-first for members, executives, MPs and staffers; the source line is included; fewer words than Facebook. No election framing.' },
  x:         { label: 'X', max: 280, ideal: [120, 260], hashtags: 1, register: 'One fact, its source, a link. Measured, never combative. Under 260 characters.' },
  tiktok:    { label: 'TikTok', max: 300, ideal: [60, 220], hashtags: 1, register: 'One to three punchy lines in plain speech; the words on screen matter more than the caption. Myth vs fact, careers energy.' },
  reddit:    { label: 'Reddit', max: 2500, ideal: [400, 1500], hashtags: 0, title: true, register: 'A text post that makes an argument in native tone with sources linked; a real title; no marketing sign-off and no brand creative. Written to be replied to.' },
  youtube:   { label: 'YouTube', max: 1200, ideal: [200, 800], hashtags: 0, title: true, register: 'A video title and a description carrying the fact, the source and the link; a 15-second script when the brief asks for one.' },
  spotify:   { label: 'Spotify audio', max: 700, ideal: [380, 520], hashtags: 0, script: true, register: 'A 30-second audio script of 70-80 words, one voice, conversational, the URL spoken plainly without hyphens.' },
  email:     { label: 'Email', max: 1800, ideal: [500, 1200], hashtags: 0, title: true, register: 'A subject line and a short eDM body: one message, one link, one closing line.' },
};
async function ensureContent(env) {
  if (!env.MIND_DB) return false;
  if (CONTENT_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS content_sets(id TEXT PRIMARY KEY, ns TEXT, campaign TEXT, segment TEXT, brief TEXT, source TEXT, platforms TEXT, items TEXT, status TEXT, job TEXT, who TEXT, history TEXT, created INTEGER, updated INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS content_sets_ns ON content_sets(ns, created)'),
  ]);
  CONTENT_READY = true;
  return true;
}
function contentId() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function contentPlatform(v) { const p = String(v || '').toLowerCase().replace(/[^a-z]/g, ''); return CONTENT_PLATFORMS[p] ? p : ''; }
function kitSlug(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24); }
/** The structured half of the brand kit, sanitised: campaigns, facts, banned
 *  terms, platform notes, segments, people. Arrays given replace the stored
 *  array; arrays left out are kept. */
function kitStructured(body, cur) {
  const pick = (v, n) => String(v == null ? '' : v).slice(0, n);
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : null);
  const out = {};
  const camps = arr(body.campaigns, 12);
  out.campaigns = (camps || cur.campaigns || []).map(c => c && typeof c === 'object' ? ({ id: kitSlug(c.id) || kitSlug(c.name), name: pick(c.name, 90), url: pick(c.url, 120), signoff: pick(c.signoff, 160), cta: pick(c.cta, 160),
    sourceLine: pick(c.sourceLine, 260), tone: pick(c.tone, 700), structure: pick(c.structure, 700), notes: pick(c.notes, 1400), active: c.active !== false }) : null).filter(c => c && c.id);
  const facts = arr(body.facts, 80);
  out.facts = (facts || cur.facts || []).map(f => f && typeof f === 'object' ? ({ id: kitSlug(f.id) || arcHash(String(f.text || '')), text: pick(f.text, 280), source: pick(f.source, 220), status: f.status === 'pending' ? 'pending' : 'approved', campaign: kitSlug(f.campaign) }) : null).filter(f => f && f.text);
  const banned = arr(body.banned, 60);
  out.banned = (banned || cur.banned || []).map(b => typeof b === 'string' ? { term: pick(b, 80), use: '', why: '', allowNegated: false }
    : (b && typeof b === 'object' ? { term: pick(b.term, 80), use: pick(b.use, 160), why: pick(b.why, 240), allowNegated: !!b.allowNegated } : null)).filter(b => b && b.term);
  const plats = body.platforms && typeof body.platforms === 'object' ? body.platforms : null;
  out.platforms = {};
  Object.keys(CONTENT_PLATFORMS).forEach(k => {
    const src = plats ? plats[k] : (cur.platforms || {})[k];
    if (!src || typeof src !== 'object') return;
    const mx = parseInt(src.max, 10);
    out.platforms[k] = { notes: pick(src.notes, 700), max: mx >= 40 && mx <= 5000 ? mx : 0, hashtags: Math.min(Math.max(parseInt(src.hashtags, 10) || 0, 0), 5) };
  });
  const segs = arr(body.segments, 12);
  out.segments = (segs || cur.segments || []).map(s => s && typeof s === 'object' ? ({ id: kitSlug(s.id) || kitSlug(s.name), name: pick(s.name, 90), who: pick(s.who, 320), themes: pick(s.themes, 320), platforms: pick(s.platforms, 140) }) : null).filter(s => s && s.id);
  const ppl = arr(body.people, 12);
  out.people = (ppl || cur.people || []).map(p => p && typeof p === 'object' ? ({ name: pick(p.name, 80), title: pick(p.title, 120), role: pick(p.role, 220) }) : null).filter(p => p && p.name);
  out.approval = pick(body.approval != null ? body.approval : cur.approval, 500);
  return out;
}
/** Banned terms present in a text. A term marked allowNegated is fine inside a
 *  denial ("not a subsidy") - the campaign's own myth-busting line. */
function contentBannedCheck(text, banned) {
  const t = String(text || ''); const hits = [];
  (banned || []).forEach(b => {
    if (!b || !b.term) return;
    const rx = new RegExp('(^|[^a-z0-9])' + String(b.term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+') + '(?![a-z0-9])', 'gi');
    let m;
    while ((m = rx.exec(t))) {
      const before = t.slice(Math.max(0, m.index - 40), m.index + m[1].length);
      if (b.allowNegated && /\b(not|n't|never|no|isn't|aren't|wasn't)\b/i.test(before)) continue;
      if (hits.indexOf(b.term) < 0) hits.push(b.term);
      break;
    }
  });
  return hits;
}
/** Every figure on a piece must appear in the approved facts, the source
 *  material or the brief. Years and single digits are not figures. */
function contentNumberCheck(text, allowed) {
  const chk = relNumberCheck(text, allowed);
  const missing = chk.missing.filter(t => !/^(19|20)\d\d$/.test(t) && !/^\d$/.test(t));
  return { ok: !missing.length, missing };
}
function contentItemCheck(item, allowed, banned) {
  const spec = CONTENT_PLATFORMS[item.platform] || { max: 2000 };
  const text = [item.title, item.body, item.cta].filter(Boolean).join(' ');
  const num = contentNumberCheck(text, allowed);
  const bad = contentBannedCheck(text, banned);
  const chars = String(item.body || '').length;
  const flags = [];
  if (!num.ok) flags.push('unverified_figure');
  if (bad.length) flags.push('banned_term');
  if (chars > spec.max) flags.push('over_limit');
  if ((item.hashtags || []).length > (spec.hashtags || 0)) flags.push('too_many_hashtags');
  if (/!/.test(item.body || '') && item.platform !== 'reddit') flags.push('exclamation');
  return { ok: !flags.length, missing: num.missing, banned: bad, chars, max: spec.max, flags };
}
/** The client block of a compose or revise prompt: voice, rules, the chosen
 *  campaign, the audience, the facts that may be quoted, the words never used. */
function contentKitBlock(kit, campaignId, segmentId, platforms) {
  kit = kit || {};
  const camp = (kit.campaigns || []).find(c => c.id === campaignId) || null;
  const seg = (kit.segments || []).find(s => s.id === segmentId) || null;
  let facts = (kit.facts || []).filter(f => f.status !== 'pending');
  if (camp) { const own = facts.filter(f => f.campaign === camp.id); const rest = facts.filter(f => f.campaign !== camp.id); facts = own.concat(rest); }
  facts = facts.slice(0, 40);
  let s = '';
  if (kit.voice) s += '\n\nCLIENT VOICE:\n' + kit.voice;
  if (kit.rules) s += '\n\nSTANDING RULES:\n' + kit.rules;
  if (camp) {
    s += '\n\nCAMPAIGN - ' + camp.name + ':' + (camp.signoff ? '\nSign-off (close with it, spelled exactly): "' + camp.signoff + '"' : '') + (camp.cta ? '\nLink line / CTA: "' + camp.cta + '"' : '')
      + (camp.url ? '\nSite: ' + camp.url : '') + (camp.sourceLine ? '\nSource line to use for the campaign figure: "' + camp.sourceLine + '"' : '')
      + (camp.tone ? '\nTone: ' + camp.tone : '') + (camp.structure ? '\nStructure: ' + camp.structure : '') + (camp.notes ? '\nNotes: ' + camp.notes : '');
  }
  if (seg) s += '\n\nAUDIENCE - ' + seg.name + ': ' + seg.who + (seg.themes ? '\nThemes that land: ' + seg.themes : '');
  if (facts.length) s += '\n\nAPPROVED FACTS - the only figures you may use, apart from figures in the SOURCE MATERIAL; quote them exactly and cite the source:\n' + facts.map(f => '- [' + f.id + '] ' + f.text + (f.source ? ' (Source: ' + f.source + ')' : '')).join('\n');
  if ((kit.banned || []).length) s += '\n\nNEVER USE these words (and what to say instead):\n' + kit.banned.map(b => '- "' + b.term + '"' + (b.use ? ' -> ' + b.use : '') + (b.allowNegated ? ' (allowed only inside a denial such as "not a ' + b.term + '")' : '') + (b.why ? ' - ' + b.why : '')).join('\n');
  const pn = kit.platforms || {};
  (platforms || []).forEach(p => { if (pn[p] && pn[p].notes) s += '\n\nHOW THIS CLIENT USES ' + (CONTENT_PLATFORMS[p] || {}).label.toUpperCase() + ': ' + pn[p].notes; });
  if ((kit.people || []).length) s += '\n\nSPOKESPEOPLE: ' + kit.people.map(p => p.name + (p.title ? ' (' + p.title + ')' : '') + (p.role ? ' - ' + p.role : '')).join('; ');
  return { text: s, campaign: camp, segment: seg, facts, banned: kit.banned || [] };
}
/** Approved examples for this client from the Mind: copy filed by the voice
 *  pack, WIN outcomes the team approved, the content guide. */
async function contentExemplars(env, ns, camp, platforms, brief, log) {
  let hits = [];
  try {
    const q = [(camp && camp.name) || '', (platforms || []).join(' '), 'approved caption post copy example', String(brief || '').slice(0, 300)].join(' ');
    hits = await mindRetrieve(env, ns, q, 10);
  } catch (e) { await log('info', 'Mind retrieval skipped: ' + String(e.message || e).slice(0, 80)); return { text: '', count: 0 }; }
  const want = hits.filter(h => /^(copy|outcome|brief|release)$/.test(String(h.meta.kind || '')));
  const own = want.filter(h => camp && String(h.meta.source || '').indexOf(camp.id) >= 0);
  const picked = own.concat(want.filter(h => own.indexOf(h) < 0)).slice(0, 8);
  await log('out', 'Mind: ' + picked.length + ' approved example' + (picked.length === 1 ? '' : 's') + (camp ? ' (' + own.length + ' from ' + camp.id + ')' : '') + ' for ' + ns);
  if (!picked.length) return { text: '', count: 0 };
  const text = '\n\nAPPROVED EXAMPLES - match their shape, rhythm, sign-offs and source lines; do not copy them word for word:\n' + picked.map(h => '[' + String(h.meta.kind || 'doc').toUpperCase() + ' - ' + (h.meta.title || '') + ']\n' + String(h.meta.snippet || '').slice(0, 700)).join('\n\n').slice(0, 6000);
  return { text, count: picked.length };
}
function contentNorm(t, i, ns) {
  const platform = contentPlatform(t.platform) || 'facebook';
  const spec = CONTENT_PLATFORMS[platform];
  const hashtags = Array.isArray(t.hashtags) ? t.hashtags.map(h => String(h || '').replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40)).filter(Boolean).slice(0, 5) : [];
  return { n: i, platform, title: spec.title || spec.script ? String(t.title || '').trim().slice(0, 160) : '', body: String(t.body || '').replace(/\r/g, '').trim().slice(0, 4000),
    cta: String(t.cta || '').trim().slice(0, 160), link: String(t.link || '').trim().slice(0, 200), hashtags, alt: String(t.alt || '').slice(0, 160), visual: String(t.visual || '').slice(0, 200),
    factIds: Array.isArray(t.factIds) ? t.factIds.map(kitSlug).filter(Boolean).slice(0, 6) : [], note: String(t.note || '').slice(0, 120), segment: String(t.segment || '').slice(0, 24), verdict: '', revisions: 0 };
}
/** Compose: one Claude call writes n pieces per platform in the client voice. */
async function contentCompose(env, set, opts, log) {
  const ns = set.ns;
  const kit = (await brandKit(env, ns)) || {};
  const client = (CLIENT_ISSUES.find(ci => ci.ns === ns) || {}).client || kit.name || 'the client';
  const platforms = set.platforms;
  const block = contentKitBlock(kit, set.campaign, set.segment, platforms);
  await log('out', 'voice profile: ' + (block.campaign ? 'campaign "' + block.campaign.name + '", ' : 'no campaign, ') + block.facts.length + ' approved facts, ' + block.banned.length + ' banned terms' + (block.segment ? ', audience ' + block.segment.name : ''));
  const ex = await contentExemplars(env, ns, block.campaign, platforms, set.brief, log);
  let learned = { text: '', count: 0 };
  try { learned = await engineRules(env, ns, 'copy'); } catch (e) {}
  if (learned.count) await log('info', 'applying ' + learned.count + ' learned correction' + (learned.count === 1 ? '' : 's') + ' for ' + ns);
  const n = Math.min(Math.max(parseInt(opts.n, 10) || 2, 1), 4);
  const specLines = platforms.map(p => { const s = CONTENT_PLATFORMS[p]; const own = (kit.platforms || {})[p] || {}; const mx = own.max || s.max; return '- ' + p + ' (' + s.label + '): ' + s.register + ' Body up to ' + mx + ' characters' + (s.title ? ', with a title' : '') + (s.script ? ', written as a script' : '') + '; ' + ((own.hashtags != null ? own.hashtags : s.hashtags) ? 'at most ' + (own.hashtags != null ? own.hashtags : s.hashtags) + ' hashtag(s)' : 'no hashtags') + '.'; }).join('\n');
  const sys = 'You are the senior copywriter of an Australian political communications agency, writing social and digital copy for the client ' + client + '. You write exactly as the client has approved before: same shape, same sign-offs, same source lines, same restraint. Return strict JSON only, no prose.'
    + block.text + ex.text + learned.text
    + '\n\nPLATFORMS - write exactly ' + n + ' piece' + (n === 1 ? '' : 's') + ' for each, every piece a different angle:\n' + specLines
    + '\n\nRULES. Australian English, sentence case, no exclamation marks, no emojis, hashtags only where a platform allows them. Every figure comes from the APPROVED FACTS or the SOURCE MATERIAL, quoted exactly, with its source line where the campaign uses one; never invent, round or update a number. Use only claims the client has made or the source supports. Paragraphs are separated by a blank line (\\n\\n). Do not favour a political party. The link goes to the campaign site, never a third-party article.'
    + '\n\nOUTPUT: {"items":[{"platform":"facebook","title":"only for platforms that take one","body":"the caption or script","cta":"the closing line or call to action, or empty","link":"URL or empty","hashtags":[],"alt":"<=140 chars image description for accessibility","visual":"<=160 chars art direction for the tile: subject, mood, no text instructions","factIds":["ids of APPROVED FACTS used"],"note":"<=80 chars: the angle"}]}';
  const user = 'BRIEF:\n' + (set.brief || '(none - work from the source material)') + (set.source ? '\n\nSOURCE MATERIAL (the only other place figures may come from):\n' + String(set.source).slice(0, 16000) : '')
    + (opts.instructions ? '\n\nEXTRA INSTRUCTIONS FOR THIS SET:\n' + String(opts.instructions).slice(0, 1500) : '')
    + '\n\nWrite ' + n + ' piece' + (n === 1 ? '' : 's') + ' for each of: ' + platforms.join(', ') + '.';
  await log('cmd', 'claude: write ' + (n * platforms.length) + ' pieces for ' + client + ' (' + platforms.join(', ') + ')');
  const raw = await claudeMsg(env, sys, user, Math.min(8000, 1200 + n * platforms.length * 500), 120000);
  const j = relJson(raw);
  if (!j || !Array.isArray(j.items) || !j.items.length) throw new Error('compose_unparseable');
  const allowed = [set.brief, set.source, block.facts.map(f => f.text + ' ' + f.source).join(' '), (block.campaign ? [block.campaign.name, block.campaign.url, block.campaign.cta, block.campaign.sourceLine, block.campaign.notes].join(' ') : ''), kit.voice, kit.rules].join(' ');
  const items = j.items.slice(0, n * platforms.length + 2).map((t, i) => contentNorm(t, i, ns)).filter(t => t.body);
  items.forEach((it, i) => { it.n = i; it.check = contentItemCheck(it, allowed, block.banned); });
  const flagged = items.filter(it => !it.check.ok);
  await log('out', items.length + ' pieces: ' + platforms.map(p => p + ' x' + items.filter(it => it.platform === p).length).join(', ') + (flagged.length ? ' - ' + flagged.length + ' flagged (' + flagged.map(it => it.check.flags.join('/')).join(', ') + ')' : ' - every figure traced, no banned terms'));
  return { items, allowed, facts: block.facts.length, examples: ex.count, learned: learned.count, campaign: block.campaign ? block.campaign.id : '' };
}
/** The whole build, run after POST /content/generate has answered. */
async function contentBuild(env, setId, opts) {
  const log = mkJobLog(env, opts.job);
  const row = await env.MIND_DB.prepare('SELECT id,ns,campaign,segment,brief,source,platforms,who FROM content_sets WHERE id=?').bind(setId).first();
  if (!row) return;
  const set = Object.assign({}, row, { platforms: JSON.parse(row.platforms || '[]') });
  try {
    const r = await contentCompose(env, set, opts, log);
    await env.MIND_DB.prepare('UPDATE content_sets SET items=?, status=?, updated=? WHERE id=?').bind(JSON.stringify(r.items).slice(0, 200000), 'written', Date.now(), setId).run();
    await log('info', 'set ' + setId + ' written: ' + r.items.length + ' pieces in the ' + set.ns + ' voice (' + r.facts + ' facts, ' + r.examples + ' examples, ' + r.learned + ' corrections in play)');
    await log.flush();
    await jobFinish(env, opts.job, true, { ok: true, setId, pieces: r.items.length, flagged: r.items.filter(it => !it.check.ok).length, campaign: r.campaign });
  } catch (e) {
    const m = String((e && e.message) || e).slice(0, 200);
    await log('err', m);
    await log.flush();
    await env.MIND_DB.prepare('UPDATE content_sets SET status=?, updated=? WHERE id=?').bind('failed', Date.now(), setId).run();
    await jobFinish(env, opts.job, false, { ok: false, error: 'compose_failed', detail: m });
  }
}
async function contentLoad(env, id) {
  const row = await env.MIND_DB.prepare('SELECT id,ns,campaign,segment,brief,source,platforms,items,status,job,who,history,created,updated FROM content_sets WHERE id=?').bind(id).first();
  if (!row) return null;
  const j = (s, d) => { try { return JSON.parse(s || '') || d; } catch (e) { return d; } };
  return Object.assign({}, row, { platforms: j(row.platforms, []), items: j(row.items, []), history: j(row.history, []) });
}
function contentView(set) {
  if (!set) return null;
  return { id: set.id, ns: set.ns, campaign: set.campaign, segment: set.segment, brief: set.brief, source: set.source, platforms: set.platforms, items: set.items, status: set.status, job: set.job, who: set.who, history: set.history, created: set.created, updated: set.updated };
}
async function contentSave(env, set) {
  await env.MIND_DB.prepare('UPDATE content_sets SET items=?, history=?, updated=? WHERE id=?').bind(JSON.stringify(set.items).slice(0, 200000), JSON.stringify((set.history || []).slice(-60)).slice(0, 60000), Date.now(), set.id).run();
}
/** Revise by instruction. Claude edits the chosen piece (or all of them) and
 *  says whether the instruction is a standing preference; if it is, the Engine
 *  learns it as a rule for this client and every later build obeys it. */
async function contentRevise(env, id, body, who) {
  const set = await contentLoad(env, id);
  if (!set) return { ok: false, error: 'unknown_set', status: 404 };
  const instruction = String(body.instruction || '').trim().slice(0, 1200);
  if (instruction.length < 3) return { ok: false, error: 'missing_instruction', detail: 'Say what to change.', status: 400 };
  const n = body.n == null || body.n === '' || body.n === 'all' ? null : Math.max(0, parseInt(body.n, 10) || 0);
  const targets = n == null ? set.items : set.items.filter(it => it.n === n);
  if (!targets.length) return { ok: false, error: 'unknown_piece', status: 404 };
  const kit = (await brandKit(env, set.ns)) || {};
  const client = (CLIENT_ISSUES.find(ci => ci.ns === set.ns) || {}).client || kit.name || 'the client';
  const block = contentKitBlock(kit, set.campaign, set.segment, set.platforms);
  let learned = { text: '', count: 0 };
  try { learned = await engineRules(env, set.ns, 'copy'); } catch (e) {}
  const sys = 'You edit existing social and digital copy for the client ' + client + ' exactly as instructed by the team. Change only what the instruction asks; keep everything else - angle, facts, sign-off, source line - as it is unless the instruction touches it. Obey the client voice, the standing rules, the banned terms and the learned corrections. Return strict JSON only:'
    + '\n{"items":[{"n":0,"title":"","body":"","cta":"","link":"","hashtags":[]}],"note":"one line: what changed","memory":{"standing":true,"rule":"one imperative sentence, max 40 words, general enough to apply to future copy for this client but no broader than the instruction supports","why":"","confidence":0.0}}'
    + '\n"standing" is true when the instruction expresses a preference that should apply to future copy for this client - a wording, a term to avoid or prefer, a tone, a format, a length, a sign-off, an always or a never. It is false when the instruction concerns only these pieces - a specific figure, place, date, angle or one-off edit. When in doubt, false. Every figure in the edited copy must still come from the approved facts or the source material.'
    + block.text + learned.text;
  const user = 'INSTRUCTION FROM THE TEAM:\n' + instruction + '\n\nPIECES TO EDIT (return every one of them, edited):\n' + targets.map(it => '[' + it.n + '] ' + it.platform + ' (body up to ' + (((kit.platforms || {})[it.platform] || {}).max || CONTENT_PLATFORMS[it.platform].max) + ' chars)' + (it.title ? '\nTITLE: ' + it.title : '') + '\nBODY:\n' + it.body + (it.cta ? '\nCTA: ' + it.cta : '') + (it.link ? '\nLINK: ' + it.link : '') + (it.hashtags.length ? '\nHASHTAGS: ' + it.hashtags.join(', ') : '')).join('\n\n')
    + (set.brief ? '\n\nORIGINAL BRIEF:\n' + set.brief : '') + (set.source ? '\n\nSOURCE MATERIAL:\n' + String(set.source).slice(0, 8000) : '');
  const raw = await claudeMsg(env, sys, user, Math.min(6000, 800 + targets.length * 500), 90000);
  const j = relJson(raw);
  if (!j || !Array.isArray(j.items)) return { ok: false, error: 'revise_unparseable', status: 502 };
  const allowed = [set.brief, set.source, block.facts.map(f => f.text + ' ' + f.source).join(' '), (block.campaign ? [block.campaign.name, block.campaign.url, block.campaign.cta, block.campaign.sourceLine, block.campaign.notes].join(' ') : ''), kit.voice, kit.rules, instruction].join(' ');
  const changed = []; const before = {};
  j.items.forEach(e => {
    const k = parseInt(e.n, 10); const it = set.items.find(x => x.n === k);
    if (!it || targets.indexOf(it) < 0) return;
    before[k] = it.body;
    const spec = CONTENT_PLATFORMS[it.platform];
    if (e.body != null) it.body = String(e.body).replace(/\r/g, '').trim().slice(0, 4000);
    if (e.title != null && (spec.title || spec.script)) it.title = String(e.title).trim().slice(0, 160);
    if (e.cta != null) it.cta = String(e.cta).trim().slice(0, 160);
    if (e.link != null) it.link = String(e.link).trim().slice(0, 200);
    if (Array.isArray(e.hashtags)) it.hashtags = e.hashtags.map(h => String(h || '').replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40)).filter(Boolean).slice(0, 5);
    it.revisions = (it.revisions || 0) + 1;
    it.check = contentItemCheck(it, allowed, block.banned);
    changed.push(k);
  });
  // what the Engine remembers
  const mem = j.memory && typeof j.memory === 'object' ? j.memory : {};
  const mode = body.remember === 'always' ? 'always' : body.remember === 'never' ? 'never' : 'auto';
  const standing = mode === 'always' || (mode === 'auto' && !!mem.standing && (parseFloat(mem.confidence) || 0) >= 0.6);
  let fix = null;
  if (standing) {
    try {
      const k0 = changed[0]; const it0 = set.items.find(x => x.n === k0);
      fix = await engineAddFix(env, { ns: set.ns, task: 'copy', scope: 'client', wrong: k0 != null ? String(before[k0] || '').slice(0, 400) : '', right: it0 ? String(it0.body || '').slice(0, 400) : '',
        why: instruction, rule: String(mem.rule || instruction).slice(0, 400), exemplar: it0 ? String(it0.body || '').slice(0, 300) : '', source: 'content:' + set.id }, who);
    } catch (e) { fix = null; }
  }
  const note = String(j.note || (changed.length ? 'Changed ' + changed.length + ' piece' + (changed.length === 1 ? '' : 's') + '.' : 'Nothing changed.')).slice(0, 300);
  set.history = (set.history || []).concat([{ ts: Date.now(), who: String(who || '').slice(0, 40), n, instruction, note, changed, ruleId: fix ? fix.id : '', rule: fix ? fix.rule : '', standing: !!mem.standing, confidence: parseFloat(mem.confidence) || 0 }]);
  await contentSave(env, set);
  return { ok: true, set: contentView(set), changed, note, remembered: fix ? { id: fix.id, rule: fix.rule } : null, memory: { standing: !!mem.standing, confidence: parseFloat(mem.confidence) || 0, rule: String(mem.rule || '').slice(0, 400) } };
}
async function contentUpdate(env, id, n, patch) {
  const set = await contentLoad(env, id);
  if (!set) return { ok: false, error: 'unknown_set', status: 404 };
  const it = set.items.find(x => x.n === n);
  if (!it) return { ok: false, error: 'unknown_piece', status: 404 };
  patch = patch && typeof patch === 'object' ? patch : {};
  if (patch.body != null) it.body = String(patch.body).replace(/\r/g, '').trim().slice(0, 4000);
  if (patch.title != null) it.title = String(patch.title).trim().slice(0, 160);
  if (patch.cta != null) it.cta = String(patch.cta).trim().slice(0, 160);
  if (patch.link != null) it.link = String(patch.link).trim().slice(0, 200);
  if (Array.isArray(patch.hashtags)) it.hashtags = patch.hashtags.map(h => String(h || '').replace(/^#/, '').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40)).filter(Boolean).slice(0, 5);
  const kit = (await brandKit(env, set.ns)) || {};
  const block = contentKitBlock(kit, set.campaign, set.segment, set.platforms);
  const allowed = [set.brief, set.source, block.facts.map(f => f.text + ' ' + f.source).join(' '), kit.voice, kit.rules, it.body].join(' ');
  it.check = contentItemCheck(it, allowed, block.banned);
  it.check.missing = contentNumberCheck([it.title, it.body, it.cta].filter(Boolean).join(' '), [set.brief, set.source, block.facts.map(f => f.text + ' ' + f.source).join(' '), kit.voice, kit.rules].join(' ')).missing;
  it.check.flags = it.check.flags.filter(f => f !== 'unverified_figure').concat(it.check.missing.length ? ['unverified_figure'] : []);
  it.check.ok = !it.check.flags.length;
  it.edited = Date.now();
  await contentSave(env, set);
  return { ok: true, item: it };
}
async function contentVerdict(env, id, n, verdict, why, who) {
  const set = await contentLoad(env, id);
  if (!set) return { ok: false, error: 'unknown_set', status: 404 };
  const it = set.items.find(x => x.n === n);
  if (!it) return { ok: false, error: 'unknown_piece', status: 404 };
  const v = verdict === 'killed' ? 'killed' : 'approved';
  const o = await engineOutcome(env, { ns: set.ns, surface: 'content', ref: set.id, n, verdict: v, why: why || '', headline: (it.title || it.platform + ' - ' + (set.campaign || set.ns)).slice(0, 200), support: it.body.slice(0, 300), cta: it.cta }, who);
  it.verdict = v;
  await contentSave(env, set);
  return { ok: true, item: it, outcome: o };
}

// ==============================================================================
// FORUM PULSE - one-call aggregate of the AU political forum scrapers.
// Lean primary-strategy fetchers (the per-site routes keep their full
// multi-fallback versions); everything fails soft with per-source status.
// ==============================================================================

async function forumPropertyChat() {
  // XenForo 2 exposes a standard whole-forum RSS at /index.rss.
  const { ok, html } = await safeFetch('https://www.propertychat.com.au/community/index.rss',
    { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,text/xml,*/*' }, signal: abortAfter(6500) });
  if (!ok) return [];
  return parseFeedXml(html).slice(0, 12).map(it => ({
    text: it.title, url: it.link, date: it.date, source: 'PropertyChat',
  })).filter(t => t.text);
}
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
/** Insert up to 150 rows of one kind, deduped on (kind,url). Returns the number
    of rows D1 actually wrote (falls back to the attempted count when the driver
    reports no change counts). `strict` rethrows instead of swallowing errors so
    bulk loaders hear about failures instead of a silent 0. */
async function archiveItems(env, kind, rows, strict) {
  try {
    if (!rows || !rows.length) return 0;
    if (!(await ensureArchive(env))) { if (strict) throw new Error('archive_unavailable'); return 0; }
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
    const res = await env.MIND_DB.batch(batch);
    const counted = Array.isArray(res) && res.some(r => r && r.meta && typeof r.meta.changes === 'number');
    return counted ? res.reduce((a, r) => a + ((r && r.meta && r.meta.changes) || 0), 0) : batch.length;
  } catch (e) { if (strict) throw e; return 0; }
}
/** Archive an /allnews snapshot (the JSON string buildAllNews returns). */
async function arcNewsSnap(env, jsonStr) {
  try {
    const d = JSON.parse(jsonStr);
    // registry rows came out of the archive; only the core feeds' items go back in
    return archiveItems(env, 'news', (d.items || []).filter(it => !it.reg).map(it => ({
      src: it.src, title: it.title, body: it.desc, url: it.link, tone: it.tone,
      meta: it.parties && it.parties.length ? { parties: it.parties } : null,
      ts: Date.parse(it.date) || 0,
    })));
  } catch (e) { return 0; }
}
/** Escape LIKE wildcards in user queries. */
function arcLike(q) { return '%' + String(q).replace(/[%_\\]/g, c => '\\' + c) + '%'; }

// ==============================================================================
// THE SOURCE REGISTRY - every outlet, office, party, pollster, sector title and
// podcast AXIOM reads, held as data rather than code. Each source carries an
// ordered list of collection methods and the sweep tries them in turn - the
// feed, the WordPress API, a JSON feed, the news sitemap (found through
// robots.txt), the podcast directory, the listing page, Google News' index of
// the site, a rendered page - keeps what works, logs what failed, and records
// which method delivers. A source that fails six sweeps in a row is reported
// to Slack once. The feeds in AU_FEEDS stay the fast core (fetched by
// buildAllNews every tick); the registry mirrors their health so the Sources
// view is one table. Nothing is skipped silently: every attempt lands in
// source_health with the reason.
// ==============================================================================
let SOURCES_READY = false;
const SOURCE_TIERS = ['core', 'national', 'metro', 'regional', 'broadcaster', 'wire', 'independent', 'official', 'party', 'polling', 'thinktank', 'sector', 'podcast', 'video', 'newsletter', 'sweep'];
const SOURCE_JURIS = ['au', 'nsw', 'vic', 'qld', 'wa', 'sa', 'tas', 'act', 'nt'];
const SOURCE_METHODS = ['rss', 'wp', 'json', 'youtube', 'substack', 'sitemap', 'podcast', 'html', 'gnews', 'render'];
const SOURCES_PER_TICK = 50;        // registry sources swept per cron tick (the core is fetched separately)
const SOURCE_DEAD_FAILS = 6;        // consecutive failed sweeps before a source is reported dead
const SOURCE_WINDOW_H = 72;         // dated items older than this are not filed
const SOURCE_FETCH_MS = 7000;       // per-request abort
const SOURCE_HEALTH_KEEP = 4000;    // rows kept in source_health
const SOURCE_SCHED = { core: 30, wire: 30, broadcaster: 30, national: 45, metro: 45, regional: 90, independent: 90, sector: 90, official: 120, party: 120, polling: 180, thinktank: 180, podcast: 240, video: 120, newsletter: 180, sweep: 60 };
/* Names, tiers and jurisdictions for the AU_FEEDS core (keys not listed here
 * are Google News sweeps, named from their key). */
const CORE_META = {
  abc: ['ABC News', 'broadcaster'], abc_top: ['ABC Top Stories', 'broadcaster'], sbs: ['SBS News', 'broadcaster'], abc_business: ['ABC Business', 'broadcaster'],
  ninenews: ['9News', 'broadcaster'], sevennews_pol: ['7News Politics', 'broadcaster'],
  smh: ['Sydney Morning Herald', 'metro', 'nsw'], smh_pol: ['SMH Federal Politics', 'national'], theage: ['The Age', 'metro', 'vic'], brisbanetimes: ['Brisbane Times', 'metro', 'qld'],
  watoday: ['WAtoday', 'metro', 'wa'], afr: ['Australian Financial Review', 'national'], canberratimes: ['Canberra Times', 'metro', 'act'], indaily: ['InDaily', 'metro', 'sa'],
  guardian: ['Guardian Australia', 'national'], guardian_pol: ['Guardian Australia Politics', 'national'], guardian_biz: ['Guardian Australian Economy', 'national'],
  newscomau: ['news.com.au', 'national'], aap: ['AAP', 'wire'], miragenews: ['Mirage News', 'wire'],
  conversation: ['The Conversation', 'independent'], convo_pol: ['The Conversation Politics', 'independent'], convo_business: ['The Conversation Business', 'independent'],
  crikey: ['Crikey', 'independent'], newdaily: ['The New Daily', 'independent'], michaelwest: ['Michael West Media', 'independent'], independentau: ['Independent Australia', 'independent'],
  menadue: ['Pearls and Irritations', 'independent'], saturdaypaper: ['The Saturday Paper', 'independent'], junkee: ['Junkee', 'independent'], mandarin: ['The Mandarin', 'independent'],
  theshot: ['The Shot', 'independent'], womensagenda: ['Womens Agenda', 'independent'], theklaxon: ['The Klaxon', 'independent'], monthly: ['The Monthly', 'independent'],
  macrobusiness: ['MacroBusiness', 'independent'], johnquiggin: ['John Quiggin', 'independent'], tastimes: ['Tasmanian Times', 'independent', 'tas'], ozbargain: ['OzBargain deals', 'independent'],
  smartcompany: ['SmartCompany', 'sector'], investordaily: ['InvestorDaily', 'sector'],
  rba: ['RBA media releases', 'official'], rba_speeches: ['RBA speeches', 'official'], pmo: ['Prime Minister', 'official'], health_gov: ['Department of Health', 'official'],
  industry_gov: ['Department of Industry', 'official'], act_ministers: ['ACT ministers', 'official', 'act'], act_pettersson: ['Michael Pettersson MLA', 'official', 'act'], flagpost: ['Parliamentary Library FlagPost', 'official'],
  lowy: ['Lowy Institute Interpreter', 'thinktank'], grattan: ['Grattan Institute', 'thinktank'], ausinstitute: ['The Australia Institute', 'thinktank'], insidestory: ['Inside Story', 'thinktank'], apo: ['Analysis and Policy Observatory', 'thinktank'],
  pollbludger: ['Poll Bludger', 'polling'], tallyroom: ['The Tally Room', 'polling'], kevinbonham: ['Kevin Bonham', 'polling'],
  newcastleher: ['Newcastle Herald', 'regional', 'nsw'], illawarramerc: ['Illawarra Mercury', 'regional', 'nsw'], examiner: ['The Examiner', 'regional', 'tas'], bordermail: ['Border Mail', 'regional', 'vic'], bendigoadv: ['Bendigo Advertiser', 'regional', 'vic'],
};
const CORE_ISSUES = { gnews_fueltax: ['ftc'], gnews_minerals: ['cm'], gnews_mining: ['mining'], gnews_energy: ['energy'], gnews_housing: ['housing'], gnews_ir: ['construction'], gnews_col: ['col'], gnews_rates: ['col'],
  gnews_econ: ['econ'], gnews_tax: ['econ', 'ftc'], gnews_super: ['econ'], gnews_election: ['gov'], gnews_auspol: ['gov'], gnews_parl: ['gov'], gnews_states: ['vicelection'], gnews_health: ['pharmacy'], gnews_regions: ['regional'], gnews_jobs: ['econ'] };
/* The extension seed: [id, name, tier, juris, issues, urls, schedule?]. urls:
 * r feed, w WordPress site root, j JSON feed, m news sitemap, p podcast search
 * term, h listing page, s site for Google News (site:), g explicit Google News
 * query. Every masthead carries s so Google News is the guaranteed fallback;
 * the health table shows which method actually delivers. */
const SOURCE_SEED_EXT = [
  // -- national and metro mastheads (News Corp and Seven West) --
  ['theaustralian', 'The Australian', 'national', 'au', 'gov,econ', { r: 'https://www.theaustralian.com.au/feed', s: 'theaustralian.com.au', h: 'https://www.theaustralian.com.au/nation/politics' }],
  ['heraldsun', 'Herald Sun', 'metro', 'vic', 'vicelection,regional', { r: 'https://www.heraldsun.com.au/rss', s: 'heraldsun.com.au', h: 'https://www.heraldsun.com.au/news/victoria' }],
  ['dailytelegraph', 'The Daily Telegraph', 'metro', 'nsw', 'gov', { r: 'https://www.dailytelegraph.com.au/rss', s: 'dailytelegraph.com.au', h: 'https://www.dailytelegraph.com.au/news/nsw' }],
  ['couriermail', 'The Courier-Mail', 'metro', 'qld', '', { r: 'https://www.couriermail.com.au/rss', s: 'couriermail.com.au', h: 'https://www.couriermail.com.au/news/queensland' }],
  ['adelaidenow', 'The Advertiser', 'metro', 'sa', '', { r: 'https://www.adelaidenow.com.au/rss', s: 'adelaidenow.com.au', h: 'https://www.adelaidenow.com.au/news/south-australia' }],
  ['themercury', 'The Mercury', 'metro', 'tas', '', { r: 'https://www.themercury.com.au/rss', s: 'themercury.com.au', h: 'https://www.themercury.com.au/news/tasmania' }],
  ['ntnews', 'NT News', 'metro', 'nt', '', { r: 'https://www.ntnews.com.au/rss', s: 'ntnews.com.au', h: 'https://www.ntnews.com.au/news/northern-territory' }],
  ['thewest', 'The West Australian', 'metro', 'wa', 'mining,gas', { r: 'https://thewest.com.au/politics/feed', s: 'thewest.com.au', h: 'https://thewest.com.au/politics' }],
  ['perthnow', 'PerthNow', 'metro', 'wa', '', { r: 'https://www.perthnow.com.au/news/feed', s: 'perthnow.com.au' }],
  ['thenightly', 'The Nightly', 'national', 'au', 'gov', { r: 'https://thenightly.com.au/politics/feed', s: 'thenightly.com.au' }],
  ['skynews', 'Sky News Australia', 'broadcaster', 'au', 'gov', { r: 'https://www.skynews.com.au/feed', s: 'skynews.com.au', h: 'https://www.skynews.com.au/australia-news/politics' }],
  ['newscomau_fin', 'news.com.au Finance', 'national', 'au', 'col,econ', { r: 'https://www.news.com.au/content-feeds/latest-news-finance/', s: 'news.com.au/finance' }],
  ['dailymailau', 'Daily Mail Australia', 'national', 'au', '', { r: 'https://www.dailymail.co.uk/auhome/index.rss', s: 'dailymail.co.uk/auhome' }],
  ['capitalbrief', 'Capital Brief', 'national', 'au', 'gov,econ', { s: 'capitalbrief.com' }],
  ['geelongadv', 'Geelong Advertiser', 'regional', 'vic', 'regional', { r: 'https://www.geelongadvertiser.com.au/rss', s: 'geelongadvertiser.com.au' }],
  ['weeklytimes', 'The Weekly Times', 'regional', 'vic', 'regional', { r: 'https://www.weeklytimesnow.com.au/rss', s: 'weeklytimesnow.com.au' }],
  ['goldcoastbulletin', 'Gold Coast Bulletin', 'regional', 'qld', '', { r: 'https://www.goldcoastbulletin.com.au/rss', s: 'goldcoastbulletin.com.au' }],
  ['townsvillebulletin', 'Townsville Bulletin', 'regional', 'qld', 'mining', { r: 'https://www.townsvillebulletin.com.au/rss', s: 'townsvillebulletin.com.au' }],
  ['cairnspost', 'Cairns Post', 'regional', 'qld', '', { r: 'https://www.cairnspost.com.au/rss', s: 'cairnspost.com.au' }],
  ['thechronicle', 'The Chronicle (Toowoomba)', 'regional', 'qld', 'regional', { r: 'https://www.thechronicle.com.au/rss', s: 'thechronicle.com.au' }],
  // -- ABC by state and rural (listing pages plus Google News' index of each section) --
  ['abc_rural', 'ABC Rural', 'broadcaster', 'au', 'regional', { h: 'https://www.abc.net.au/news/rural', g: 'site:abc.net.au/news/rural' }],
  ['abc_nsw', 'ABC News NSW', 'broadcaster', 'nsw', '', { h: 'https://www.abc.net.au/news/nsw', g: 'site:abc.net.au nsw' }],
  ['abc_vic', 'ABC News Victoria', 'broadcaster', 'vic', 'vicelection,regional', { h: 'https://www.abc.net.au/news/vic', g: 'site:abc.net.au victoria' }],
  ['abc_qld', 'ABC News Queensland', 'broadcaster', 'qld', '', { h: 'https://www.abc.net.au/news/qld', g: 'site:abc.net.au queensland' }],
  ['abc_wa', 'ABC News WA', 'broadcaster', 'wa', 'mining,gas', { h: 'https://www.abc.net.au/news/wa', g: 'site:abc.net.au "western australia" OR perth' }],
  ['abc_sa', 'ABC News SA', 'broadcaster', 'sa', '', { h: 'https://www.abc.net.au/news/sa', g: 'site:abc.net.au "south australia" OR adelaide' }],
  ['abc_tas', 'ABC News Tasmania', 'broadcaster', 'tas', '', { h: 'https://www.abc.net.au/news/tas', g: 'site:abc.net.au tasmania' }],
  ['abc_nt', 'ABC News NT', 'broadcaster', 'nt', '', { h: 'https://www.abc.net.au/news/nt', g: 'site:abc.net.au "northern territory" OR darwin' }],
  ['abc_act', 'ABC News Canberra', 'broadcaster', 'act', '', { h: 'https://www.abc.net.au/news/act', g: 'site:abc.net.au canberra' }],
  // -- regional dailies: ACM titles publish /rss.xml; the others ride Google News --
  ['thecourier', 'The Courier (Ballarat)', 'regional', 'vic', 'regional', { r: 'https://www.thecourier.com.au/rss.xml', s: 'thecourier.com.au' }],
  ['standard', 'The Standard (Warrnambool)', 'regional', 'vic', 'regional', { r: 'https://www.standard.net.au/rss.xml', s: 'standard.net.au' }],
  ['latrobevalley', 'Latrobe Valley Express', 'regional', 'vic', 'regional,energy', { r: 'https://www.latrobevalleyexpress.com.au/rss.xml', s: 'latrobevalleyexpress.com.au' }],
  ['mailtimes', 'Wimmera Mail-Times', 'regional', 'vic', 'regional', { r: 'https://www.mailtimes.com.au/rss.xml', s: 'mailtimes.com.au' }],
  ['sheppnews', 'Shepparton News', 'regional', 'vic', 'regional', { s: 'sheppnews.com.au' }],
  ['sunraysiadaily', 'Sunraysia Daily', 'regional', 'vic', 'regional', { s: 'sunraysiadaily.com.au' }],
  ['wangarattachronicle', 'Wangaratta Chronicle', 'regional', 'vic', 'regional', { s: 'wangarattachronicle.com.au' }],
  ['gippslandtimes', 'Gippsland Times', 'regional', 'vic', 'regional', { s: 'gippslandtimes.com.au' }],
  ['dailyadvertiser', 'The Daily Advertiser (Wagga)', 'regional', 'nsw', 'regional', { r: 'https://www.dailyadvertiser.com.au/rss.xml', s: 'dailyadvertiser.com.au' }],
  ['westernadvocate', 'Western Advocate (Bathurst)', 'regional', 'nsw', 'regional', { r: 'https://www.westernadvocate.com.au/rss.xml', s: 'westernadvocate.com.au' }],
  ['centralwesterndaily', 'Central Western Daily (Orange)', 'regional', 'nsw', 'regional', { r: 'https://www.centralwesterndaily.com.au/rss.xml', s: 'centralwesterndaily.com.au' }],
  ['dailyliberal', 'Daily Liberal (Dubbo)', 'regional', 'nsw', 'regional', { r: 'https://www.dailyliberal.com.au/rss.xml', s: 'dailyliberal.com.au' }],
  ['northerndailyleader', 'Northern Daily Leader (Tamworth)', 'regional', 'nsw', 'regional', { r: 'https://www.northerndailyleader.com.au/rss.xml', s: 'northerndailyleader.com.au' }],
  ['maitlandmercury', 'Maitland Mercury', 'regional', 'nsw', 'mining', { r: 'https://www.maitlandmercury.com.au/rss.xml', s: 'maitlandmercury.com.au' }],
  ['portnews', 'Port Macquarie News', 'regional', 'nsw', 'regional', { r: 'https://www.portnews.com.au/rss.xml', s: 'portnews.com.au' }],
  ['theadvocate', 'The Advocate (Burnie)', 'regional', 'tas', 'regional', { r: 'https://www.theadvocate.com.au/rss.xml', s: 'theadvocate.com.au' }],
  ['mandurahmail', 'Mandurah Mail', 'regional', 'wa', '', { r: 'https://www.mandurahmail.com.au/rss.xml', s: 'mandurahmail.com.au' }],
  ['kalminer', 'Kalgoorlie Miner', 'regional', 'wa', 'mining,cm', { s: 'kalminer.com.au' }],
  ['northwesttelegraph', 'North West Telegraph (Pilbara)', 'regional', 'wa', 'mining,gas', { s: 'northwesttelegraph.com.au' }],
  // -- agricultural press --
  ['theland', 'The Land', 'sector', 'nsw', 'regional', { r: 'https://www.theland.com.au/rss.xml', s: 'theland.com.au' }],
  ['qcl', 'Queensland Country Life', 'sector', 'qld', 'regional', { r: 'https://www.queenslandcountrylife.com.au/rss.xml', s: 'queenslandcountrylife.com.au' }],
  ['stockandland', 'Stock and Land', 'sector', 'vic', 'regional', { r: 'https://www.stockandland.com.au/rss.xml', s: 'stockandland.com.au' }],
  ['farmweekly', 'Farm Weekly', 'sector', 'wa', 'regional', { r: 'https://www.farmweekly.com.au/rss.xml', s: 'farmweekly.com.au' }],
  ['stockjournal', 'Stock Journal', 'sector', 'sa', 'regional', { r: 'https://www.stockjournal.com.au/rss.xml', s: 'stockjournal.com.au' }],
  ['nqregister', 'North Queensland Register', 'sector', 'qld', 'regional', { r: 'https://www.northqueenslandregister.com.au/rss.xml', s: 'northqueenslandregister.com.au' }],
  ['farmonline', 'Farm Online', 'sector', 'au', 'regional', { r: 'https://www.farmonline.com.au/rss.xml', s: 'farmonline.com.au' }],
  ['beefcentral', 'Beef Central', 'sector', 'au', 'regional', { r: 'https://www.beefcentral.com/feed/', w: 'https://www.beefcentral.com', s: 'beefcentral.com' }],
  ['graincentral', 'Grain Central', 'sector', 'au', 'regional', { r: 'https://www.graincentral.com/feed/', w: 'https://www.graincentral.com', s: 'graincentral.com' }],
  ['sheepcentral', 'Sheep Central', 'sector', 'au', 'regional', { r: 'https://www.sheepcentral.com/feed/', w: 'https://www.sheepcentral.com', s: 'sheepcentral.com' }],
  ['nff', 'National Farmers Federation', 'sector', 'au', 'regional', { r: 'https://nff.org.au/feed/', w: 'https://nff.org.au', s: 'nff.org.au' }],
  ['vff', 'Victorian Farmers Federation', 'sector', 'vic', 'regional', { r: 'https://www.vff.org.au/feed/', w: 'https://www.vff.org.au', s: 'vff.org.au' }],
  // -- Commonwealth: parliament, ministers, agencies --
  ['aph_media', 'Parliament of Australia', 'official', 'au', 'gov', { h: 'https://www.aph.gov.au/News_and_Events/Media_Releases_and_Alerts', g: 'site:aph.gov.au' }],
  ['parlinfo_pressrel', 'ParlInfo press releases', 'official', 'au', 'gov', { h: 'https://parlinfo.aph.gov.au/parlInfo/search/summary/summary.w3p;orderBy=date-eLast;query=Dataset%3Apressrel', g: 'site:parlinfo.aph.gov.au' }],
  ['treasury', 'Treasury', 'official', 'au', 'econ', { r: 'https://treasury.gov.au/rss.xml', h: 'https://treasury.gov.au/media-releases', s: 'treasury.gov.au' }],
  ['treasurer', 'Treasurer and Treasury ministers', 'official', 'au', 'econ,col', { r: 'https://ministers.treasury.gov.au/rss.xml', h: 'https://ministers.treasury.gov.au/media-releases', s: 'ministers.treasury.gov.au' }],
  ['min_resources', 'Minister for Resources', 'official', 'au', 'mining,cm,gas', { h: 'https://www.minister.industry.gov.au/', s: 'minister.industry.gov.au' }],
  ['min_energy', 'Minister for Climate Change and Energy', 'official', 'au', 'energy,gas', { h: 'https://minister.dcceew.gov.au/', s: 'minister.dcceew.gov.au' }],
  ['min_health', 'Health ministers', 'official', 'au', 'pharmacy', { h: 'https://www.health.gov.au/ministers', g: 'site:health.gov.au/ministers' }],
  ['min_ir', 'Minister for Employment and Workplace Relations', 'official', 'au', 'construction', { h: 'https://ministers.dewr.gov.au/', s: 'ministers.dewr.gov.au' }],
  ['min_infrastructure', 'Infrastructure and Housing ministers', 'official', 'au', 'housing,construction', { h: 'https://minister.infrastructure.gov.au/', s: 'minister.infrastructure.gov.au' }],
  ['min_homeaffairs', 'Home Affairs ministers', 'official', 'au', 'gov', { s: 'minister.homeaffairs.gov.au' }],
  ['min_foreign', 'Foreign Minister', 'official', 'au', 'gov', { s: 'foreignminister.gov.au' }],
  ['min_defence', 'Defence ministers', 'official', 'au', 'gov', { s: 'minister.defence.gov.au' }],
  ['abs', 'Australian Bureau of Statistics', 'official', 'au', 'econ,col', { r: 'https://www.abs.gov.au/rss.xml', h: 'https://www.abs.gov.au/media-centre/media-releases', s: 'abs.gov.au' }],
  ['pc', 'Productivity Commission', 'official', 'au', 'econ', { r: 'https://www.pc.gov.au/rss', h: 'https://www.pc.gov.au/media-speeches', s: 'pc.gov.au' }],
  ['pbo', 'Parliamentary Budget Office', 'official', 'au', 'econ', { s: 'pbo.gov.au' }],
  ['anao', 'Australian National Audit Office', 'official', 'au', 'gov', { r: 'https://www.anao.gov.au/rss.xml', s: 'anao.gov.au' }],
  ['accc', 'ACCC', 'official', 'au', 'col', { r: 'https://www.accc.gov.au/rss/media-releases.xml', h: 'https://www.accc.gov.au/media', s: 'accc.gov.au' }],
  ['aec', 'Australian Electoral Commission', 'official', 'au', 'gov', { h: 'https://www.aec.gov.au/media/', s: 'aec.gov.au' }],
  ['ato', 'Australian Taxation Office', 'official', 'au', 'econ,ftc', { h: 'https://www.ato.gov.au/media-centre', s: 'ato.gov.au' }],
  ['asic', 'ASIC', 'official', 'au', 'econ', { s: 'asic.gov.au' }],
  ['fwc', 'Fair Work Commission', 'official', 'au', 'construction', { s: 'fwc.gov.au' }],
  ['fwo', 'Fair Work Ombudsman', 'official', 'au', 'construction', { h: 'https://www.fairwork.gov.au/newsroom/media-releases', s: 'fairwork.gov.au' }],
  ['aemo', 'AEMO', 'official', 'au', 'energy,gas', { h: 'https://aemo.com.au/newsroom', s: 'aemo.com.au' }],
  ['aer', 'Australian Energy Regulator', 'official', 'au', 'energy', { s: 'aer.gov.au' }],
  ['cer', 'Clean Energy Regulator', 'official', 'au', 'energy', { s: 'cleanenergyregulator.gov.au' }],
  ['dcceew', 'DCCEEW', 'official', 'au', 'energy', { r: 'https://www.dcceew.gov.au/about/news/rss.xml', s: 'dcceew.gov.au' }],
  ['tga', 'Therapeutic Goods Administration', 'official', 'au', 'pharmacy', { s: 'tga.gov.au' }],
  ['pbs', 'PBS', 'official', 'au', 'pharmacy', { s: 'pbs.gov.au' }],
  // -- state and territory governments, parliaments, electoral commissions --
  ['nsw_gov', 'NSW Government', 'official', 'nsw', '', { r: 'https://www.nsw.gov.au/media-releases/rss', h: 'https://www.nsw.gov.au/media-releases', g: 'site:nsw.gov.au/media-releases' }],
  ['vic_premier', 'Premier of Victoria', 'official', 'vic', 'vicelection,regional', { r: 'https://www.premier.vic.gov.au/rss.xml', h: 'https://www.premier.vic.gov.au/media-centre', s: 'premier.vic.gov.au' }],
  ['qld_statements', 'Queensland Government statements', 'official', 'qld', 'mining', { r: 'https://statements.qld.gov.au/rss', h: 'https://statements.qld.gov.au/statements', s: 'statements.qld.gov.au' }],
  ['wa_statements', 'WA Government media statements', 'official', 'wa', 'mining,gas', { h: 'https://www.wa.gov.au/government/media-statements', g: 'site:wa.gov.au/government/media-statements' }],
  ['sa_premier', 'Premier of South Australia', 'official', 'sa', '', { h: 'https://www.premier.sa.gov.au/media-releases', s: 'premier.sa.gov.au' }],
  ['tas_premier', 'Premier of Tasmania', 'official', 'tas', '', { h: 'https://www.premier.tas.gov.au/latest_news', s: 'premier.tas.gov.au' }],
  ['nt_newsroom', 'NT Government newsroom', 'official', 'nt', 'gas', { r: 'https://newsroom.nt.gov.au/rss', h: 'https://newsroom.nt.gov.au/', s: 'newsroom.nt.gov.au' }],
  ['vic_parliament', 'Parliament of Victoria', 'official', 'vic', 'vicelection', { s: 'parliament.vic.gov.au' }],
  ['vec', 'Victorian Electoral Commission', 'official', 'vic', 'vicelection', { s: 'vec.vic.gov.au' }],
  ['nswec', 'NSW Electoral Commission', 'official', 'nsw', 'gov', { s: 'elections.nsw.gov.au' }],
  ['ecq', 'Electoral Commission of Queensland', 'official', 'qld', 'gov', { s: 'ecq.qld.gov.au' }],
  // -- parties --
  ['alp', 'Australian Labor Party', 'party', 'au', 'gov', { r: 'https://www.alp.org.au/news.rss', h: 'https://www.alp.org.au/news', s: 'alp.org.au' }],
  ['liberal', 'Liberal Party of Australia', 'party', 'au', 'gov', { h: 'https://www.liberal.org.au/latest-news', s: 'liberal.org.au' }],
  ['nationals', 'The Nationals', 'party', 'au', 'regional,gov', { r: 'https://nationals.org.au/feed/', w: 'https://nationals.org.au', s: 'nationals.org.au' }],
  ['greens', 'Australian Greens', 'party', 'au', 'energy,activism,gov', { r: 'https://greens.org.au/rss.xml', h: 'https://greens.org.au/news', s: 'greens.org.au' }],
  ['onenation', 'One Nation', 'party', 'au', 'gov', { h: 'https://www.onenation.org.au/news', s: 'onenation.org.au' }],
  ['vicnats', 'The Nationals Victoria', 'party', 'vic', 'vicelection,regional', { r: 'https://vic.nationals.org.au/feed/', w: 'https://vic.nationals.org.au', s: 'vic.nationals.org.au' }],
  ['viclibs', 'Liberal Victoria', 'party', 'vic', 'vicelection', { h: 'https://vic.liberal.org.au/News', s: 'vic.liberal.org.au' }],
  ['viclabor', 'Victorian Labor', 'party', 'vic', 'vicelection', { h: 'https://www.viclabor.com.au/news/', s: 'viclabor.com.au' }],
  ['vicgreens', 'Victorian Greens', 'party', 'vic', 'vicelection', { g: 'site:greens.org.au/vic' }],
  ['climate200', 'Climate 200', 'party', 'au', 'gov', { s: 'climate200.com.au' }],
  // -- polling and psephology --
  ['essential', 'Essential Report', 'polling', 'au', 'gov', { r: 'https://essentialreport.com.au/feed', w: 'https://essentialreport.com.au', s: 'essentialreport.com.au' }],
  ['roymorgan', 'Roy Morgan', 'polling', 'au', 'gov,col', { r: 'https://www.roymorgan.com/feed', w: 'https://www.roymorgan.com', s: 'roymorgan.com' }],
  ['redbridge', 'RedBridge Group', 'polling', 'au', 'gov', { r: 'https://redbridgegroup.com.au/feed/', w: 'https://redbridgegroup.com.au', s: 'redbridgegroup.com.au' }],
  ['resolve', 'Resolve Political Monitor', 'polling', 'au', 'gov', { g: '"resolve political monitor"' }],
  ['newspoll', 'Newspoll', 'polling', 'au', 'gov', { g: 'newspoll' }],
  ['freshwater', 'Freshwater Strategy', 'polling', 'au', 'gov', { g: '"freshwater strategy" poll' }],
  ['yougov_au', 'YouGov Australia', 'polling', 'au', 'gov', { s: 'au.yougov.com' }],
  ['jws', 'JWS Research', 'polling', 'au', 'gov', { r: 'https://jwsresearch.com/feed/', w: 'https://jwsresearch.com', s: 'jwsresearch.com' }],
  ['antonygreen', 'Antony Green', 'polling', 'au', 'gov', { r: 'https://antonygreen.com.au/feed/', w: 'https://antonygreen.com.au', s: 'antonygreen.com.au' }],
  ['demosau', 'DemosAU', 'polling', 'au', 'gov', { r: 'https://demosau.com/feed/', s: 'demosau.com' }],
  // -- think tanks, peak bodies and the clients' own newsrooms --
  ['cis', 'Centre for Independent Studies', 'thinktank', 'au', 'econ', { r: 'https://www.cis.org.au/feed/', w: 'https://www.cis.org.au', s: 'cis.org.au' }],
  ['ipa', 'Institute of Public Affairs', 'thinktank', 'au', 'econ,energy', { r: 'https://ipa.org.au/feed', w: 'https://ipa.org.au', s: 'ipa.org.au' }],
  ['percapita', 'Per Capita', 'thinktank', 'au', 'econ,col', { r: 'https://percapita.org.au/feed/', w: 'https://percapita.org.au', s: 'percapita.org.au' }],
  ['mckell', 'McKell Institute', 'thinktank', 'au', 'econ,housing', { r: 'https://mckellinstitute.org.au/feed/', w: 'https://mckellinstitute.org.au', s: 'mckellinstitute.org.au' }],
  ['cpd', 'Centre for Policy Development', 'thinktank', 'au', 'econ', { r: 'https://cpd.org.au/feed/', w: 'https://cpd.org.au', s: 'cpd.org.au' }],
  ['chifley', 'Chifley Research Centre', 'thinktank', 'au', 'gov', { r: 'https://www.chifley.org.au/feed/', w: 'https://www.chifley.org.au', s: 'chifley.org.au' }],
  ['menzies_rc', 'Menzies Research Centre', 'thinktank', 'au', 'gov', { r: 'https://www.menziesrc.org/feed', w: 'https://www.menziesrc.org', s: 'menziesrc.org' }],
  ['climatecouncil', 'Climate Council', 'thinktank', 'au', 'energy,activism', { r: 'https://www.climatecouncil.org.au/feed/', w: 'https://www.climatecouncil.org.au', s: 'climatecouncil.org.au' }],
  ['acoss', 'ACOSS', 'thinktank', 'au', 'col', { r: 'https://www.acoss.org.au/feed/', w: 'https://www.acoss.org.au', s: 'acoss.org.au' }],
  ['bca', 'Business Council of Australia', 'thinktank', 'au', 'econ', { h: 'https://www.bca.com.au/media_releases', s: 'bca.com.au' }],
  ['acci', 'Australian Chamber of Commerce and Industry', 'thinktank', 'au', 'econ,construction', { r: 'https://www.australianchamber.com.au/feed/', w: 'https://www.australianchamber.com.au', s: 'australianchamber.com.au' }],
  ['aigroup', 'Ai Group', 'thinktank', 'au', 'construction,econ', { h: 'https://www.aigroup.com.au/news/', s: 'aigroup.com.au' }],
  ['actu', 'ACTU', 'thinktank', 'au', 'construction,col', { h: 'https://www.actu.org.au/media/media-releases', s: 'actu.org.au' }],
  ['e61', 'e61 Institute', 'thinktank', 'au', 'econ', { s: 'e61.in' }],
  ['ceda', 'CEDA', 'thinktank', 'au', 'econ', { s: 'ceda.com.au' }],
  ['mca_org', 'Minerals Council of Australia', 'sector', 'au', 'mining,ftc,cm', { r: 'https://minerals.org.au/feed/', w: 'https://minerals.org.au', s: 'minerals.org.au' }],
  ['aep_org', 'Australian Energy Producers', 'sector', 'au', 'gas,energy', { r: 'https://energyproducers.au/feed/', w: 'https://energyproducers.au', s: 'energyproducers.au' }],
  ['pca_org', 'Property Council of Australia', 'sector', 'au', 'housing', { r: 'https://www.propertycouncil.com.au/feed/', w: 'https://www.propertycouncil.com.au', s: 'propertycouncil.com.au' }],
  ['mba_org', 'Master Builders Australia', 'sector', 'au', 'construction', { r: 'https://masterbuilders.com.au/feed/', w: 'https://masterbuilders.com.au', s: 'masterbuilders.com.au' }],
  ['guild_org', 'Pharmacy Guild of Australia', 'sector', 'au', 'pharmacy', { h: 'https://www.guild.org.au/news-events/news', s: 'guild.org.au' }],
  ['qrc', 'Queensland Resources Council', 'sector', 'qld', 'mining', { r: 'https://www.qrc.org.au/feed/', w: 'https://www.qrc.org.au', s: 'qrc.org.au' }],
  ['cmewa', 'Chamber of Minerals and Energy WA', 'sector', 'wa', 'mining,gas', { s: 'cmewa.com.au' }],
  ['amec', 'Association of Mining and Exploration Companies', 'sector', 'au', 'mining,cm', { r: 'https://amec.org.au/feed/', w: 'https://amec.org.au', s: 'amec.org.au' }],
  ['cfmeu', 'CFMEU', 'sector', 'au', 'construction', { h: 'https://cfmeu.org/news/', s: 'cfmeu.org' }],
  ['hia', 'Housing Industry Association', 'sector', 'au', 'housing,construction', { s: 'hia.com.au' }],
  ['udia', 'Urban Development Institute of Australia', 'sector', 'au', 'housing', { r: 'https://udia.com.au/feed/', w: 'https://udia.com.au', s: 'udia.com.au' }],
  // -- activist and campaign groups (the other side of the clients' fights) --
  ['lockthegate', 'Lock the Gate', 'thinktank', 'au', 'activism,mining,gas', { r: 'https://www.lockthegate.org.au/news.rss', h: 'https://www.lockthegate.org.au/news', s: 'lockthegate.org.au' }],
  ['acf', 'Australian Conservation Foundation', 'thinktank', 'au', 'activism,energy', { r: 'https://www.acf.org.au/news.rss', h: 'https://www.acf.org.au/news', s: 'acf.org.au' }],
  ['marketforces', 'Market Forces', 'thinktank', 'au', 'activism,gas', { r: 'https://www.marketforces.org.au/feed/', w: 'https://www.marketforces.org.au', s: 'marketforces.org.au' }],
  ['risingtide', 'Rising Tide', 'thinktank', 'au', 'activism,mining', { h: 'https://www.risingtide.org.au/', s: 'risingtide.org.au' }],
  ['greenpeace_au', 'Greenpeace Australia Pacific', 'thinktank', 'au', 'activism,energy', { r: 'https://www.greenpeace.org.au/feed/', w: 'https://www.greenpeace.org.au', s: 'greenpeace.org.au' }],
  ['edo', 'Environmental Defenders Office', 'thinktank', 'au', 'activism,mining', { r: 'https://www.edo.org.au/feed/', w: 'https://www.edo.org.au', s: 'edo.org.au' }],
  ['getup', 'GetUp', 'thinktank', 'au', 'activism', { s: 'getup.org.au' }],
  ['environmentvic', 'Environment Victoria', 'thinktank', 'vic', 'activism,energy', { r: 'https://environmentvictoria.org.au/feed/', w: 'https://environmentvictoria.org.au', s: 'environmentvictoria.org.au' }],
  // -- sector press: resources and energy --
  ['australianmining', 'Australian Mining', 'sector', 'au', 'mining,cm', { r: 'https://www.australianmining.com.au/feed/', w: 'https://www.australianmining.com.au', s: 'australianmining.com.au' }],
  ['miningcomau', 'Mining.com.au', 'sector', 'au', 'mining,cm', { r: 'https://mining.com.au/feed/', w: 'https://mining.com.au', s: 'mining.com.au' }],
  ['stockhead', 'Stockhead', 'sector', 'au', 'mining,cm,energy', { r: 'https://stockhead.com.au/feed/', w: 'https://stockhead.com.au', s: 'stockhead.com.au' }],
  ['miningnews', 'MiningNews.net', 'sector', 'au', 'mining', { s: 'miningnews.net' }],
  ['ausresources', 'Australian Resources and Investment', 'sector', 'au', 'mining,cm', { r: 'https://www.australianresourcesandinvestment.com.au/feed/', w: 'https://www.australianresourcesandinvestment.com.au', s: 'australianresourcesandinvestment.com.au' }],
  ['energynewsbulletin', 'Energy News Bulletin', 'sector', 'au', 'gas', { s: 'energynewsbulletin.net' }],
  ['reneweconomy', 'RenewEconomy', 'sector', 'au', 'energy', { r: 'https://reneweconomy.com.au/feed/', w: 'https://reneweconomy.com.au', s: 'reneweconomy.com.au' }],
  ['pvmagazine', 'pv magazine Australia', 'sector', 'au', 'energy', { r: 'https://www.pv-magazine-australia.com/feed/', w: 'https://www.pv-magazine-australia.com', s: 'pv-magazine-australia.com' }],
  ['wattclarity', 'WattClarity', 'sector', 'au', 'energy', { r: 'https://wattclarity.com.au/feed/', w: 'https://wattclarity.com.au', s: 'wattclarity.com.au' }],
  ['energymag', 'Energy Magazine', 'sector', 'au', 'energy,gas', { r: 'https://www.energymagazine.com.au/feed/', w: 'https://www.energymagazine.com.au', s: 'energymagazine.com.au' }],
  ['ecogeneration', 'EcoGeneration', 'sector', 'au', 'energy', { r: 'https://www.ecogeneration.com.au/feed/', w: 'https://www.ecogeneration.com.au', s: 'ecogeneration.com.au' }],
  ['esdnews', 'Energy Source and Distribution', 'sector', 'au', 'energy', { r: 'https://esdnews.com.au/feed/', w: 'https://esdnews.com.au', s: 'esdnews.com.au' }],
  ['gastoday', 'Gas Today', 'sector', 'au', 'gas', { r: 'https://gastoday.com.au/feed/', w: 'https://gastoday.com.au', s: 'gastoday.com.au' }],
  ['cleanenergycouncil', 'Clean Energy Council', 'sector', 'au', 'energy', { s: 'cleanenergycouncil.org.au' }],
  // -- sector press: construction, property and IR --
  ['sourceable', 'Sourceable', 'sector', 'au', 'construction', { r: 'https://sourceable.net/feed/', w: 'https://sourceable.net', s: 'sourceable.net' }],
  ['insideconstruction', 'Inside Construction', 'sector', 'au', 'construction', { r: 'https://www.insideconstruction.com.au/feed/', w: 'https://www.insideconstruction.com.au', s: 'insideconstruction.com.au' }],
  ['buildaustralia', 'Build Australia', 'sector', 'au', 'construction', { r: 'https://www.buildaustralia.com.au/feed/', w: 'https://www.buildaustralia.com.au', s: 'buildaustralia.com.au' }],
  ['roadsonline', 'Roads and Infrastructure', 'sector', 'au', 'construction', { r: 'https://roadsonline.com.au/feed/', w: 'https://roadsonline.com.au', s: 'roadsonline.com.au' }],
  ['inframag', 'Infrastructure Magazine', 'sector', 'au', 'construction', { r: 'https://infrastructuremagazine.com.au/feed/', w: 'https://infrastructuremagazine.com.au', s: 'infrastructuremagazine.com.au' }],
  ['urbandeveloper', 'The Urban Developer', 'sector', 'au', 'housing,construction', { h: 'https://www.theurbandeveloper.com/', s: 'theurbandeveloper.com' }],
  ['workplaceexpress', 'Workplace Express', 'sector', 'au', 'construction', { s: 'workplaceexpress.com.au' }],
  ['domain_news', 'Domain News', 'sector', 'au', 'housing', { r: 'https://www.domain.com.au/news/feed/', w: 'https://www.domain.com.au/news', s: 'domain.com.au/news' }],
  ['rea_news', 'realestate.com.au News', 'sector', 'au', 'housing', { r: 'https://www.realestate.com.au/news/feed/', w: 'https://www.realestate.com.au/news', s: 'realestate.com.au/news' }],
  ['reb', 'Real Estate Business', 'sector', 'au', 'housing', { r: 'https://www.realestatebusiness.com.au/feed', s: 'realestatebusiness.com.au' }],
  ['corelogic', 'Cotality (CoreLogic)', 'sector', 'au', 'housing', { s: 'corelogic.com.au' }],
  ['apimag', 'Australian Property Investor', 'sector', 'au', 'housing', { r: 'https://www.apimagazine.com.au/feed/', w: 'https://www.apimagazine.com.au', s: 'apimagazine.com.au' }],
  // -- sector press: pharmacy and health --
  ['ajp', 'Australian Journal of Pharmacy', 'sector', 'au', 'pharmacy', { r: 'https://ajp.com.au/feed/', w: 'https://ajp.com.au', s: 'ajp.com.au' }],
  ['pharmacydaily', 'Pharmacy Daily', 'sector', 'au', 'pharmacy', { r: 'https://pharmacydaily.com.au/feed/', w: 'https://pharmacydaily.com.au', s: 'pharmacydaily.com.au' }],
  ['auspharmacist', 'Australian Pharmacist', 'sector', 'au', 'pharmacy', { r: 'https://www.australianpharmacist.com.au/feed/', w: 'https://www.australianpharmacist.com.au', s: 'australianpharmacist.com.au' }],
  ['psa', 'Pharmaceutical Society of Australia', 'sector', 'au', 'pharmacy', { r: 'https://www.psa.org.au/feed/', w: 'https://www.psa.org.au', s: 'psa.org.au' }],
  ['croakey', 'Croakey Health Media', 'sector', 'au', 'pharmacy', { r: 'https://www.croakey.org/feed/', w: 'https://www.croakey.org', s: 'croakey.org' }],
  ['medicalrepublic', 'The Medical Republic', 'sector', 'au', 'pharmacy', { r: 'https://www.medicalrepublic.com.au/feed', w: 'https://www.medicalrepublic.com.au', s: 'medicalrepublic.com.au' }],
  ['newsgp', 'newsGP (RACGP)', 'sector', 'au', 'pharmacy', { g: 'site:racgp.org.au/newsgp' }],
  ['ausdoc', 'Australian Doctor', 'sector', 'au', 'pharmacy', { s: 'ausdoc.com.au' }],
  ['ama', 'Australian Medical Association', 'sector', 'au', 'pharmacy', { r: 'https://www.ama.com.au/rss.xml', h: 'https://www.ama.com.au/media', s: 'ama.com.au' }],
  // -- sector press: education, firearms and sport, tax --
  ['campusmorningmail', 'Campus Morning Mail', 'sector', 'au', '', { r: 'https://campusmorningmail.com.au/feed/', w: 'https://campusmorningmail.com.au', s: 'campusmorningmail.com.au' }],
  ['educationhq', 'EducationHQ', 'sector', 'au', '', { s: 'educationhq.com' }],
  ['theeducator', 'The Educator', 'sector', 'au', '', { s: 'theeducatoronline.com' }],
  ['ssaa', 'Sporting Shooters Association of Australia', 'sector', 'au', '', { r: 'https://ssaa.org.au/feed/', w: 'https://ssaa.org.au', s: 'ssaa.org.au' }],
  ['sportingshooter', 'Sporting Shooter', 'sector', 'au', '', { r: 'https://sportingshooter.com.au/feed/', w: 'https://sportingshooter.com.au', s: 'sportingshooter.com.au' }],
  ['sifa_org', 'Shooting Industry Foundation Australia', 'sector', 'au', '', { h: 'https://www.sifa.net.au/', s: 'sifa.net.au' }],
  ['shootingaus', 'Shooting Australia', 'sector', 'au', '', { r: 'https://shootingaustralia.org/feed/', w: 'https://shootingaustralia.org', s: 'shootingaustralia.org' }],
  ['guncontrolau', 'Gun Control Australia', 'thinktank', 'au', 'activism', { s: 'guncontrol.org.au' }],
  ['accountantsdaily', 'Accountants Daily', 'sector', 'au', 'econ', { r: 'https://www.accountantsdaily.com.au/feed', s: 'accountantsdaily.com.au' }],
  ['taxinstitute', 'The Tax Institute', 'sector', 'au', 'econ', { s: 'taxinstitute.com.au' }],
  // -- YouTube channels (handles resolve to channel ids on the first sweep; videos file as Signals threads, then get comments and captions) --
  ['yt_abcnews', 'ABC News (Australia) on YouTube', 'video', 'au', 'gov', { y: '@abcnewsaustralia' }],
  ['yt_skynews', 'Sky News Australia on YouTube', 'video', 'au', 'gov', { y: '@SkyNewsAustralia' }],
  ['yt_7news', '7NEWS Australia on YouTube', 'video', 'au', '', { y: '@7NEWSAustralia' }],
  ['yt_9news', '9News Australia on YouTube', 'video', 'au', '', { y: '@9NewsAUS' }],
  ['yt_10news', '10 News First on YouTube', 'video', 'au', '', { y: '@10NewsFirst' }],
  ['yt_albanese', 'Anthony Albanese on YouTube', 'video', 'au', 'gov', { y: '@AlboMP' }],
  ['yt_labor', 'Australian Labor Party on YouTube', 'video', 'au', 'gov', { y: '@AustralianLabor' }],
  ['yt_liberal', 'Liberal Party of Australia on YouTube', 'video', 'au', 'gov', { y: '@LiberalAus' }],
  ['yt_greens', 'Australian Greens on YouTube', 'video', 'au', 'energy,gov', { y: '@AustralianGreens' }],
  ['yt_nationals', 'The Nationals on YouTube', 'video', 'au', 'regional,gov', { y: '@TheNationalsAU' }],
  ['yt_mca', 'Minerals Council of Australia on YouTube', 'video', 'au', 'mining,ftc,cm', { y: '@MineralsCouncilofAustralia' }],
  // -- podcasts (found through the Apple Podcasts directory, then read as feeds) --
  ['pod_partyroom', 'The Party Room (ABC)', 'podcast', 'au', 'gov', { p: 'The Party Room ABC' }],
  ['pod_guardian_pol', 'Australian Politics (Guardian)', 'podcast', 'au', 'gov', { r: 'https://www.theguardian.com/australia-news/series/australian-politics-live/podcast.xml', p: 'Australian Politics Guardian' }],
  ['pod_7am', '7am (Schwartz Media)', 'podcast', 'au', 'gov', { p: '7am Schwartz Media' }],
  ['pod_fullstory', 'Full Story (Guardian Australia)', 'podcast', 'au', '', { p: 'Full Story Guardian Australia' }],
  ['pod_abcnewsdaily', 'ABC News Daily', 'podcast', 'au', '', { p: 'ABC News Daily' }],
  ['pod_pleaseexplain', 'Please Explain (SMH and The Age)', 'podcast', 'au', 'gov', { p: 'Please Explain Sydney Morning Herald' }],
  ['pod_thefin', 'The Fin (AFR)', 'podcast', 'au', 'econ', { p: 'The Fin Australian Financial Review' }],
  ['pod_chanticleer', 'Chanticleer (AFR)', 'podcast', 'au', 'econ', { p: 'Chanticleer AFR' }],
  ['pod_democracysausage', 'Democracy Sausage', 'podcast', 'au', 'gov', { p: 'Democracy Sausage Mark Kenny' }],
  ['pod_followthemoney', 'Follow the Money (Australia Institute)', 'podcast', 'au', 'econ', { p: 'Follow the Money Australia Institute' }],
  ['pod_thebriefing', 'The Briefing (LiSTNR)', 'podcast', 'au', '', { p: 'The Briefing LiSTNR' }],
  // -- Google News sweeps by jurisdiction and client fight (recall where no single outlet covers it) --
  ['sweep_nsw', 'Sweep: NSW politics', 'sweep', 'nsw', 'gov', { g: '"nsw government" OR "nsw premier" OR "nsw parliament" OR macquarie street' }],
  ['sweep_vic', 'Sweep: Victorian politics', 'sweep', 'vic', 'vicelection', { g: '"victorian government" OR "victorian premier" OR "spring street" OR "victorian parliament"' }],
  ['sweep_regionalvic', 'Sweep: regional Victoria', 'sweep', 'vic', 'regional', { g: '"regional victoria" OR gippsland OR bendigo OR ballarat OR shepparton OR mildura' }],
  ['sweep_qld', 'Sweep: Queensland politics', 'sweep', 'qld', 'gov', { g: '"queensland government" OR "queensland premier" OR "queensland parliament"' }],
  ['sweep_wa', 'Sweep: WA politics', 'sweep', 'wa', 'gov,mining', { g: '"wa government" OR "western australian premier" OR "wa parliament" OR "wa budget"' }],
  ['sweep_sa', 'Sweep: SA politics', 'sweep', 'sa', 'gov', { g: '"south australian government" OR "sa premier" OR "sa parliament" OR "sa budget"' }],
  ['sweep_tas', 'Sweep: Tasmanian politics', 'sweep', 'tas', 'gov', { g: '"tasmanian government" OR "tasmanian premier" OR "tasmanian parliament"' }],
  ['sweep_nt', 'Sweep: NT politics', 'sweep', 'nt', 'gov,gas', { g: '"northern territory government" OR "nt chief minister" OR "nt parliament"' }],
  ['sweep_act', 'Sweep: ACT politics', 'sweep', 'act', 'gov', { g: '"act government" OR "act chief minister" OR "act legislative assembly"' }],
  ['sweep_pharmacy', 'Sweep: community pharmacy', 'sweep', 'au', 'pharmacy', { g: '"pharmacy guild" OR "community pharmacy" OR "60-day dispensing" OR pharmacist prescribing' }],
  ['sweep_construction', 'Sweep: construction and IR', 'sweep', 'au', 'construction', { g: 'australia cfmeu OR "master builders" OR "building approvals" OR "construction industry"' }],
  ['sweep_gas', 'Sweep: gas', 'sweep', 'au', 'gas', { g: 'australia "gas reservation" OR "gas supply" OR "gas shortfall" OR lng export' }],
  ['sweep_activism', 'Sweep: activist campaigns', 'sweep', 'au', 'activism', { g: 'australia "rising tide" OR "lock the gate" OR "market forces" OR "extinction rebellion" OR "blockade australia"' }],
  ['sweep_firearms', 'Sweep: firearms policy', 'sweep', 'au', '', { g: 'australia firearms OR "gun laws" OR "national firearms register" OR "gun buyback"' }],
  ['sweep_education', 'Sweep: education policy', 'sweep', 'au', '', { g: 'australia "education minister" OR "school funding" OR universities policy OR "early childhood education"' }],
];
function sourceMethods(urls, explicit) {
  urls = urls || {};
  if (Array.isArray(explicit) && explicit.length) { const e = explicit.map(String).filter(m => SOURCE_METHODS.indexOf(m) >= 0); if (e.length) return e; }
  const m = [];
  if (urls.rss) m.push('rss');
  if (urls.wp) m.push('wp');
  if (urls.json) m.push('json');
  if (urls.youtube) m.push('youtube');
  if (urls.substack) m.push('substack');
  if (urls.sitemap || urls.site) m.push('sitemap');
  if (urls.podcast) m.push('podcast');
  if (urls.home) m.push('html');
  if (urls.site || urls.gnews) m.push('gnews');
  if (urls.home) m.push('render');
  return m;
}
/** The whole seed: the AU_FEEDS core (fetched by buildAllNews, health mirrored
 *  here) plus the extension list above. */
function sourceSeed() {
  const out = [];
  Object.keys(AU_FEEDS).forEach(k => {
    const m = CORE_META[k] || [];
    const sweep = /^gnews_/.test(k);
    out.push({ id: k, name: m[0] || (sweep ? 'Sweep: ' + k.replace(/^gnews_/, '').replace(/_/g, ' ') : k), tier: m[1] || (sweep ? 'sweep' : 'core'), juris: m[2] || 'au',
      issues: CORE_ISSUES[k] || [], methods: ['rss'], urls: { rss: AU_FEEDS[k] }, schedule: SOURCE_SCHED.core, core: true });
  });
  SOURCE_SEED_EXT.forEach(r => {
    const u = r[5] || {}; const urls = {};
    if (u.r) urls.rss = u.r; if (u.w) urls.wp = u.w; if (u.j) urls.json = u.j; if (u.m) urls.sitemap = u.m;
    if (u.p) urls.podcast = u.p; if (u.h) urls.home = u.h; if (u.s) urls.site = u.s; if (u.g) urls.gnews = u.g;
    if (u.y) urls.youtube = u.y; if (u.n) urls.substack = u.n;
    out.push({ id: r[0], name: r[1], tier: r[2], juris: r[3], issues: String(r[4] || '').split(/[,\s]+/).filter(Boolean), methods: sourceMethods(urls, null), urls, schedule: r[6] || SOURCE_SCHED[r[2]] || 60, core: false });
  });
  return out;
}
async function ensureSources(env) {
  if (!env.MIND_DB) return false;
  if (SOURCES_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY, name TEXT, tier TEXT, juris TEXT, issues TEXT, methods TEXT, urls TEXT, schedule INTEGER, enabled INTEGER, core INTEGER, edited INTEGER, created INTEGER, updated INTEGER, last_try INTEGER, last_ok INTEGER, next_due INTEGER, fails INTEGER, method_ok TEXT, last_error TEXT, latest_ts INTEGER, note TEXT, alerted INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS sources_due ON sources(enabled, core, next_due)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS source_health(id INTEGER PRIMARY KEY AUTOINCREMENT, src TEXT, ts INTEGER, ok INTEGER, method TEXT, n INTEGER, ms INTEGER, detail TEXT)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS source_health_src ON source_health(src, id)'),
  ]);
  SOURCES_READY = true;
  try { await sourcesSeed(env); } catch (e) {}
  return true;
}
/** Seed once per seed version: insert what is missing, refresh the seed fields
 *  of rows the operator has never edited, never touch an edited row. */
async function sourcesSeed(env, force) {
  const seed = sourceSeed();
  const ver = arcHash(JSON.stringify(seed));
  const n = ((await env.MIND_DB.prepare('SELECT COUNT(*) n FROM sources').first()) || {}).n || 0;
  if (!force && n > 0 && (await kvGet(env.AXIOM_KV, 'sources_seed_v')) === ver) return { ok: true, unchanged: true, n };
  const now = Date.now();
  const ins = env.MIND_DB.prepare("INSERT INTO sources(id,name,tier,juris,issues,methods,urls,schedule,enabled,core,edited,created,updated,last_try,last_ok,next_due,fails,method_ok,last_error,latest_ts,note,alerted) VALUES(?,?,?,?,?,?,?,?,1,?,0,?,?,0,0,0,0,'','',0,'',0) ON CONFLICT(id) DO NOTHING");
  const upd = env.MIND_DB.prepare('UPDATE sources SET name=?, tier=?, juris=?, issues=?, methods=?, urls=?, schedule=?, core=?, updated=? WHERE id=? AND edited=0');
  const stmts = [];
  seed.forEach(s => {
    const j = [JSON.stringify(s.issues), JSON.stringify(s.methods), JSON.stringify(s.urls)];
    stmts.push(ins.bind(s.id, s.name, s.tier, s.juris, j[0], j[1], j[2], s.schedule, s.core ? 1 : 0, now, now));
    stmts.push(upd.bind(s.name, s.tier, s.juris, j[0], j[1], j[2], s.schedule, s.core ? 1 : 0, now, s.id));
  });
  for (let i = 0; i < stmts.length; i += 100) await env.MIND_DB.batch(stmts.slice(i, i + 100));
  await kvPut(env.AXIOM_KV, 'sources_seed_v', ver, 30 * 86400);
  return { ok: true, seeded: seed.length, had: n };
}
function pjs(v, d) { try { const x = JSON.parse(v || ''); return x == null ? d : x; } catch (e) { return d; } }
function sourceRow(r) {
  return { id: r.id, name: r.name || r.id, tier: r.tier || 'core', juris: r.juris || 'au', issues: pjs(r.issues, []), methods: pjs(r.methods, []), urls: pjs(r.urls, {}),
    schedule: Number(r.schedule) || 60, enabled: !!r.enabled, core: !!r.core, edited: !!r.edited, created: r.created || 0, updated: r.updated || 0,
    last_try: r.last_try || 0, last_ok: r.last_ok || 0, next_due: r.next_due || 0, fails: r.fails || 0, method_ok: r.method_ok || '', last_error: r.last_error || '',
    latest_ts: r.latest_ts || 0, note: r.note || '', alerted: r.alerted || 0 };
}
function sourceStatus(s, now) {
  if (!s.enabled) return 'off';
  if ((s.fails || 0) >= SOURCE_DEAD_FAILS) return 'dead';
  if (!s.last_try) return 'unverified';
  if ((s.fails || 0) > 0) return 'failing';
  if (s.last_ok && now - s.last_ok < 48 * 3600000) return 'ok';
  return 'stale';
}
function sourceIdClean(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); }
function siteHost(s) { return String(s || '').replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, ''); }
/** Operator input -> a clean source; `cur` is the stored row when editing. */
function sourceSanitize(b, cur) {
  b = b || {};
  const u = (b.urls && typeof b.urls === 'object') ? b.urls : null;
  let urls = cur ? Object.assign({}, cur.urls) : {};
  if (u) {
    urls = {};
    ['rss', 'wp', 'json', 'sitemap', 'home', 'substack'].forEach(k => { const v = String(u[k] || '').trim(); if (/^https?:\/\/\S+$/.test(v)) urls[k] = v.slice(0, 400); });
    if (u.youtube) { const y = String(u.youtube).trim(); const idm = y.match(/(UC[\w-]{22})/); if (idm) urls.youtube = idm[1]; else if (/^@?[\w.-]{2,60}$/.test(y.replace(/^https?:\/\/(www\.)?youtube\.com\//, ''))) urls.youtube = y.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/^@?/, '@').slice(0, 64); }
    if (u.site) urls.site = String(u.site).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '').slice(0, 120);
    if (u.gnews) urls.gnews = String(u.gnews).trim().slice(0, 200);
    if (u.podcast) urls.podcast = String(u.podcast).trim().slice(0, 120);
  }
  const name = String(b.name || (cur && cur.name) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const id = sourceIdClean(b.id || (cur && cur.id) || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  const tier = SOURCE_TIERS.indexOf(b.tier) >= 0 ? b.tier : ((cur && cur.tier) || 'independent');
  const juris = SOURCE_JURIS.indexOf(b.juris) >= 0 ? b.juris : ((cur && cur.juris) || 'au');
  const known = x => CLIENT_ISSUES.some(ci => ci.id === x);
  const issues = Array.isArray(b.issues) ? b.issues.map(String).filter(known).slice(0, 12)
    : typeof b.issues === 'string' ? b.issues.split(/[,\s]+/).filter(known).slice(0, 12) : ((cur && cur.issues) || []);
  const methods = sourceMethods(urls, Array.isArray(b.methods) ? b.methods : (!u && cur ? cur.methods : null));
  const schedule = Math.min(Math.max(parseInt(b.schedule, 10) || ((cur && cur.schedule) || SOURCE_SCHED[tier] || 60), 15), 1440);
  return { id, name, tier, juris, issues, urls, methods, schedule, note: String(b.note != null ? b.note : ((cur && cur.note) || '')).slice(0, 300),
    enabled: b.enabled == null ? (cur ? cur.enabled : true) : !!b.enabled };
}
async function sourceUpsert(env, s, now) {
  await env.MIND_DB.prepare("INSERT INTO sources(id,name,tier,juris,issues,methods,urls,schedule,enabled,core,edited,created,updated,last_try,last_ok,next_due,fails,method_ok,last_error,latest_ts,note,alerted) VALUES(?,?,?,?,?,?,?,?,?,0,1,?,?,0,0,0,0,'','',0,?,0) ON CONFLICT(id) DO UPDATE SET name=excluded.name, tier=excluded.tier, juris=excluded.juris, issues=excluded.issues, methods=excluded.methods, urls=excluded.urls, schedule=excluded.schedule, enabled=excluded.enabled, edited=1, updated=excluded.updated, note=excluded.note, next_due=0, method_ok=CASE WHEN sources.urls=excluded.urls THEN sources.method_ok ELSE '' END, fails=CASE WHEN sources.urls=excluded.urls THEN sources.fails ELSE 0 END")
    .bind(s.id, s.name, s.tier, s.juris, JSON.stringify(s.issues), JSON.stringify(s.methods), JSON.stringify(s.urls), s.schedule, s.enabled ? 1 : 0, now, now, s.note).run();
}
async function sourceGet(env, id) {
  const r = await env.MIND_DB.prepare('SELECT * FROM sources WHERE id=?').bind(id).first();
  return r ? sourceRow(r) : null;
}
/** Core feeds the operator switched off, so buildAllNews skips them. */
async function sourcesCoreOff(env) {
  try { const a = JSON.parse((await kvGet(env.AXIOM_KV, 'sources_core_off')) || '[]'); return new Set(Array.isArray(a) ? a : []); } catch (e) { return new Set(); }
}
async function sourcesCoreOffRefresh(env) {
  const rows = (await env.MIND_DB.prepare('SELECT id FROM sources WHERE core=1 AND enabled=0').all()).results || [];
  await kvPut(env.AXIOM_KV, 'sources_core_off', JSON.stringify(rows.map(r => r.id)), 90 * 86400);
}

// -- one fetch, never throws --------------------------------------------------
async function srcFetch(url, accept, ms) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept': accept || '*/*', 'Accept-Language': 'en-AU,en;q=0.8' },
      signal: abortAfter(ms || SOURCE_FETCH_MS), cf: { cacheTtl: 300, cacheEverything: true }, redirect: 'follow' });
    const text = r.ok ? (await r.text()).slice(0, 1500000) : '';
    return { ok: r.ok, status: r.status, text, ms: Date.now() - t0, ctype: (r.headers.get('content-type') || '').toLowerCase(), url: r.url || url };
  } catch (e) {
    const s = String((e && e.name) || '') + ' ' + String((e && e.message) || e);
    return { ok: false, status: 0, text: '', ms: Date.now() - t0, error: /timeout|abort/i.test(s) ? 'timed out after ' + Math.round((ms || SOURCE_FETCH_MS) / 1000) + 's' : s.trim().slice(0, 90) };
  }
}
function srcFail(f, what) { return { ok: false, items: [], status: f.status || 0, detail: f.error ? f.error : (f.status ? 'HTTP ' + f.status : (what || 'failed')) }; }
/** Article-shaped links on a listing page: same host, a slug or a dated path,
 *  anchor text long enough to be a headline. Undated - the sweep stamps the
 *  first sighting. */
function listingLinks(html, base) {
  const out = []; const seen = new Set();
  let host = ''; try { host = new URL(base).host.replace(/^www\./, ''); } catch (e) { return out; }
  const re = /<a\b[^>]*href=["']([^"'#?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 60) {
    const text = stripHtml(m[2]);
    if (!text || text.length < 28 || text.length > 220) continue;
    let u; try { u = new URL(m[1], base); } catch (e) { continue; }
    if (u.host.replace(/^www\./, '') !== host) continue;
    const path = u.pathname;
    const segs = path.split('/').filter(Boolean);
    const slug = segs[segs.length - 1] || '';
    const arty = slug.split('-').length >= 4 || /\d{4}\/\d{2}/.test(path) || /\/\d{5,}/.test(path)
      || /\/(news|story|stories|article|articles|politics|media-releases?|media_releases?|statements?|releases?|speech|speeches|opinion|analysis|latest_news|latest-news|newsroom)\//i.test(path + '/');
    if (!arty || segs.length < 2) continue;
    const key = u.origin + path;
    if (seen.has(key)) continue; seen.add(key);
    out.push({ title: text, link: key, date: '', desc: '' });
  }
  return out;
}
function slugTitle(u) {
  try {
    const p = new URL(u).pathname.split('/').filter(Boolean);
    let s = (p[p.length - 1] || '').replace(/\.(html?|php|aspx?)$/i, '').replace(/[-_]+/g, ' ').replace(/\b[a-f0-9]{8,}\b|\b\d{5,}\b/gi, '').replace(/\s+/g, ' ').trim();
    return s.length >= 12 ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  } catch (e) { return ''; }
}
function parseSitemap(xml) {
  const out = [];
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const b = m[1];
    const loc = (b.match(/<loc>\s*([^<\s]+)\s*<\/loc>/) || [])[1];
    if (!loc) continue;
    const title = stripHtml((b.match(/<news:title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/news:title>/) || [])[1] || '');
    const date = ((b.match(/<news:publication_date>([^<]+)<\/news:publication_date>/) || b.match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1] || '').trim();
    out.push({ title: title || slugTitle(loc), link: loc.trim(), date, desc: '' });
  }
  return out;
}

// -- the methods: each returns { ok, items:[{title,link,date,desc,text?}], status, detail } --
async function srcRss(env, src) {
  const f = await srcFetch(src.urls.rss, 'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*');
  if (!f.ok) return srcFail(f);
  const items = parseFeedXml(f.text);
  if (!items.length) return { ok: false, items: [], status: f.status, detail: /<html[\s>]/i.test(f.text.slice(0, 3000)) ? 'HTTP 200 but an HTML page, not a feed' : 'HTTP 200 but no items parsed' };
  return { ok: true, items, status: f.status };
}
async function srcWp(env, src) {
  const base = String(src.urls.wp).replace(/\/+$/, '');
  const f = await srcFetch(base + '/wp-json/wp/v2/posts?per_page=20&_fields=link,title,date_gmt,excerpt,content', 'application/json');
  if (!f.ok) return srcFail(f);
  let arr; try { arr = JSON.parse(f.text); } catch (e) { return { ok: false, items: [], status: f.status, detail: 'HTTP 200 but not JSON (REST API disabled?)' }; }
  if (!Array.isArray(arr)) return { ok: false, items: [], status: f.status, detail: arr && arr.message ? String(arr.message).slice(0, 100) : 'unexpected JSON shape' };
  const items = arr.map(p => ({ title: stripHtml((p.title && p.title.rendered) || ''), link: p.link || '',
    date: p.date_gmt ? String(p.date_gmt).replace(/Z?$/, 'Z') : (p.date || ''),
    desc: stripHtml((p.excerpt && p.excerpt.rendered) || '').slice(0, 240), text: stripHtml((p.content && p.content.rendered) || '').slice(0, 6000) })).filter(i => i.title && i.link);
  return items.length ? { ok: true, items, status: f.status, full: true } : { ok: false, items: [], status: f.status, detail: 'REST API answered with no posts' };
}
async function srcJson(env, src) {
  const f = await srcFetch(src.urls.json, 'application/feed+json,application/json,*/*');
  if (!f.ok) return srcFail(f);
  let d; try { d = JSON.parse(f.text); } catch (e) { return { ok: false, items: [], status: f.status, detail: 'HTTP 200 but not JSON' }; }
  const items = (Array.isArray(d.items) ? d.items : []).map(i => ({ title: stripHtml(i.title || ''), link: i.url || i.external_url || i.id || '', date: i.date_published || i.date_modified || '',
    desc: stripHtml(i.summary || i.content_text || i.content_html || '').slice(0, 240), text: stripHtml(i.content_text || i.content_html || '').slice(0, 6000) })).filter(i => i.title && /^https?:/.test(i.link));
  return items.length ? { ok: true, items, status: f.status, full: items.some(i => i.text.length > 600) } : { ok: false, items: [], status: f.status, detail: 'JSON feed with no items' };
}
async function srcSitemap(env, src) {
  let maps = [], status = 0, detail = '';
  if (src.urls.sitemap) maps = [src.urls.sitemap];
  else if (src.urls.site) {
    const rb = await srcFetch('https://' + siteHost(src.urls.site) + '/robots.txt', 'text/plain,*/*', 5000);
    if (!rb.ok) return srcFail(rb, 'no robots.txt');
    const all = Array.from(rb.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)).map(x => x[1]);
    if (!all.length) return { ok: false, items: [], status: rb.status, detail: 'robots.txt lists no sitemap' };
    const news = all.filter(u => /news|latest|recent|daily|article/i.test(u));
    maps = (news.length ? news : all).slice(0, 2);
  } else return { ok: false, items: [], skipped: true, detail: 'no sitemap or site given' };
  let items = [];
  for (const u of maps) {
    const f = await srcFetch(u, 'application/xml,text/xml,*/*');
    status = f.status;
    if (!f.ok) { detail = f.error || ('HTTP ' + f.status); continue; }
    let xml = f.text;
    if (/<sitemapindex/i.test(xml)) {
      const kids = Array.from(xml.matchAll(/<sitemap>[\s\S]*?<loc>\s*([^<\s]+)\s*<\/loc>[\s\S]*?<\/sitemap>/g)).map(x => x[1]);
      const pick = kids.filter(k => /news|latest|recent|article/i.test(k)).concat(kids).slice(0, 1);
      if (!pick.length) { detail = 'sitemap index with no children'; continue; }
      const g = await srcFetch(pick[0], 'application/xml,text/xml,*/*');
      if (!g.ok) { detail = g.error || ('HTTP ' + g.status); continue; }
      xml = g.text;
    }
    items = items.concat(parseSitemap(xml));
    if (items.length) break;
  }
  if (!items.length) return { ok: false, items: [], status, detail: detail || 'sitemap had no entries' };
  const cut = Date.now() - 48 * 3600000;
  const dated = items.filter(i => i.date && Date.parse(i.date) >= cut);
  const use = (dated.length ? dated : items.filter(i => !i.date).slice(0, 30)).filter(i => i.title);
  return use.length ? { ok: true, items: use.slice(0, 60), status } : { ok: false, items: [], status, detail: 'sitemap entries are all older than 48h or have no usable title' };
}
async function srcPodcast(env, src) {
  const term = String(src.urls.podcast || '').trim();
  if (!term) return { ok: false, items: [], skipped: true, detail: 'no podcast search term' };
  const ck = 'pod_feed_' + src.id;
  let feed = await kvGet(env.AXIOM_KV, ck);
  if (!feed) {
    const f = await srcFetch('https://itunes.apple.com/search?term=' + encodeURIComponent(term) + '&media=podcast&country=AU&limit=3', 'application/json,*/*');
    if (!f.ok) return srcFail(f, 'podcast directory');
    let d = {}; try { d = JSON.parse(f.text); } catch (e) { d = {}; }
    const hit = (d.results || []).find(x => x && x.feedUrl);
    if (!hit) return { ok: false, items: [], status: f.status, detail: 'no podcast matched "' + term.slice(0, 40) + '" in the Apple directory' };
    feed = String(hit.feedUrl); await kvPut(env.AXIOM_KV, ck, feed, 7 * 86400);
  }
  const r = await srcRss(env, { urls: { rss: feed } });
  if (r.ok) { r.feed = feed; r.items = r.items.map(i => Object.assign(i, { link: i.link || (feed + '#' + arcHash(i.title)) })); }
  else r.detail = 'feed ' + feed.slice(0, 70) + ': ' + r.detail;
  return r;
}
async function srcHtml(env, src) {
  const f = await srcFetch(src.urls.home, 'text/html,application/xhtml+xml,*/*');
  if (!f.ok) return srcFail(f);
  const items = listingLinks(f.text, f.url || src.urls.home);
  return items.length ? { ok: true, items, status: f.status, undated: true } : { ok: false, items: [], status: f.status, detail: 'page had no article-shaped links (built client-side? render would show)' };
}
async function srcGnews(env, src) {
  const q = src.urls.gnews || ('site:' + String(src.urls.site || '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, ''));
  const f = await srcFetch('https://news.google.com/rss/search?q=' + encodeURIComponent(q + ' when:2d') + '&hl=en-AU&gl=AU&ceid=AU:en', 'application/rss+xml,application/xml,text/xml,*/*', 8000);
  if (!f.ok) return srcFail(f);
  const items = parseFeedXml(f.text).map(it => {
    const m = it.title.match(/\s[-\u2013\u2014]\s([^-\u2013\u2014]{2,60})$/);
    return { title: m ? it.title.slice(0, m.index).trim() : it.title, link: it.link, date: it.date || '', desc: '', outlet: m ? m[1].trim() : '' };
  });
  return items.length ? { ok: true, items, status: f.status } : { ok: false, items: [], status: f.status, detail: 'Google News has nothing indexed for ' + q.slice(0, 60) + ' in 2 days' };
}
/** A rendered page, for sites built entirely in the browser. Two back ends:
 *  RENDER_URL (an HTTP service that takes {url} and answers {html} - the AWS
 *  or Mac Playwright service) or Cloudflare Browser Rendering (CF_ACCOUNT_ID
 *  + CF_BROWSER_TOKEN). Neither set: skipped, and the reason says what to set. */
function renderConfigured(env) { return !!(env && (env.RENDER_URL || (env.CF_ACCOUNT_ID && env.CF_BROWSER_TOKEN))); }
async function renderFetch(env, url, ms) {
  if (!renderConfigured(env)) return { ok: false, skipped: true, detail: 'render is not configured: set RENDER_URL (a Playwright render service) or CF_ACCOUNT_ID + CF_BROWSER_TOKEN (Cloudflare Browser Rendering), or probe from a Mac running tools/reach-agent.py' };
  const t0 = Date.now();
  try {
    let html = '';
    if (env.RENDER_URL) {
      const r = await fetch(env.RENDER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Axiom-Key': String(env.RENDER_KEY || '') }, body: JSON.stringify({ url, wait: 'networkidle' }), signal: abortAfter(ms || 35000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.html) return { ok: false, status: r.status, detail: String(d.error || ('render service HTTP ' + r.status)).slice(0, 120), ms: Date.now() - t0 };
      html = String(d.html);
    } else {
      const r = await fetch('https://api.cloudflare.com/client/v4/accounts/' + env.CF_ACCOUNT_ID + '/browser-rendering/content', { method: 'POST',
        headers: { 'Authorization': 'Bearer ' + env.CF_BROWSER_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, gotoOptions: { waitUntil: 'networkidle0', timeout: 20000 }, rejectResourceTypes: ['image', 'media', 'font'] }), signal: abortAfter(ms || 35000) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.success) return { ok: false, status: r.status, detail: String((((d.errors || [])[0] || {}).message) || ('Browser Rendering HTTP ' + r.status)).slice(0, 120), ms: Date.now() - t0 };
      html = String(d.result || '');
    }
    return { ok: true, html: html.slice(0, 1500000), ms: Date.now() - t0 };
  } catch (e) { return { ok: false, status: 0, detail: String((e && e.message) || e).slice(0, 100), ms: Date.now() - t0 }; }
}
async function srcRender(env, src) {
  const r = await renderFetch(env, src.urls.home);
  if (!r.ok) return { ok: false, items: [], skipped: !!r.skipped, status: r.status || 0, detail: r.detail };
  const items = listingLinks(r.html, src.urls.home);
  return items.length ? { ok: true, items, status: 200, undated: true } : { ok: false, items: [], status: 200, detail: 'rendered page had no article-shaped links' };
}
async function srcMethod(env, m, src) {
  const u = src.urls || {};
  if (m === 'rss') return u.rss ? srcRss(env, src) : { ok: false, items: [], skipped: true, detail: 'no feed url' };
  if (m === 'wp') return u.wp ? srcWp(env, src) : { ok: false, items: [], skipped: true, detail: 'no WordPress root' };
  if (m === 'json') return u.json ? srcJson(env, src) : { ok: false, items: [], skipped: true, detail: 'no JSON feed url' };
  if (m === 'youtube') return u.youtube ? srcYoutube(env, src) : { ok: false, items: [], skipped: true, detail: 'no YouTube channel' };
  if (m === 'substack') return u.substack ? srcSubstack(env, src) : { ok: false, items: [], skipped: true, detail: 'no Substack publication' };
  if (m === 'sitemap') return srcSitemap(env, src);
  if (m === 'podcast') return srcPodcast(env, src);
  if (m === 'html') return u.home ? srcHtml(env, src) : { ok: false, items: [], skipped: true, detail: 'no listing page' };
  if (m === 'gnews') return (u.gnews || u.site) ? srcGnews(env, src) : { ok: false, items: [], skipped: true, detail: 'no site or query for Google News' };
  if (m === 'render') return u.home ? srcRender(env, src) : { ok: false, items: [], skipped: true, detail: 'no page to render' };
  return { ok: false, items: [], skipped: true, detail: 'unknown method ' + m };
}
function srcTarget(src, m) {
  const u = src.urls || {};
  if (m === 'rss') return u.rss || ''; if (m === 'wp') return String(u.wp || '').replace(/\/+$/, '') + '/wp-json/wp/v2/posts'; if (m === 'json') return u.json || '';
  if (m === 'youtube') return 'youtube.com/feeds/videos.xml ' + (u.youtube || ''); if (m === 'substack') return String(u.substack || '').replace(/\/+$/, '') + '/feed';
  if (m === 'sitemap') return u.sitemap || ('https://' + siteHost(u.site) + '/robots.txt'); if (m === 'podcast') return 'itunes.apple.com/search "' + (u.podcast || '') + '"';
  if (m === 'html' || m === 'render') return u.home || ''; if (m === 'gnews') return 'news.google.com/rss/search ' + (u.gnews || ('site:' + siteHost(u.site)));
  return '';
}
/** Run one source through its method chain. Normally stops at the first method
 *  that delivers (the last one that worked is tried first); `all` runs every
 *  method and reports each - the Probe. */
async function sourceRun(env, src, opts) {
  opts = opts || {};
  const log = opts.log || (async () => {});
  const methods = (src.methods || []).filter(m => SOURCE_METHODS.indexOf(m) >= 0);
  const chain = opts.all ? methods : (src.method_ok && methods.indexOf(src.method_ok) >= 0 ? [src.method_ok].concat(methods.filter(m => m !== src.method_ok)) : methods);
  const tried = []; let hit = null;
  for (const m of chain) {
    const t0 = Date.now();
    await log('cmd', src.id + ': ' + m + ' ' + srcTarget(src, m));
    let r; try { r = await srcMethod(env, m, src); } catch (e) { r = { ok: false, items: [], detail: String((e && e.message) || e).slice(0, 120) }; }
    const n = (r.items || []).length, ok = !!(r.ok && n), ms = r.ms || (Date.now() - t0);
    const t = { method: m, ok, n, ms, status: r.status || 0, skipped: !!r.skipped, detail: ok ? '' : String(r.detail || 'failed').slice(0, 160) };
    if (ok && r.full) t.full = true;
    if (opts.all) t.sample = (r.items || []).slice(0, 3).map(i => ({ title: String(i.title || '').slice(0, 140), link: String(i.link || '').slice(0, 200), date: i.date || '' }));
    tried.push(t);
    if (ok) { await log('out', src.id + ': ' + n + ' items via ' + m + ' (' + ms + 'ms)'); if (!hit) { hit = r; hit.method = m; } if (!opts.all) break; }
    else if (!r.skipped) await log('err', src.id + ': ' + m + ' - ' + t.detail);
  }
  return { src, hit, tried, ok: !!hit, method: hit ? hit.method : '', items: hit ? hit.items : [] };
}
/** Items -> archive rows of kind news. Every row carries the source, its tier
 *  and jurisdiction, the method that found it, the client issues it speaks to
 *  and whether it arrived with a date. WordPress and JSON feeds bring the full
 *  article text; meta.ft records that so the full-text pass leaves them alone. */
function sourceRows(src, hit, now) {
  const cut = now - SOURCE_WINDOW_H * 3600000;
  const seen = new Set(); const rows = [];
  for (const it of (hit.items || [])) {
    const title = String(it.title || '').replace(/\s+/g, ' ').trim(); const link = String(it.link || '').trim();
    if (title.length < 8 || !/^https?:\/\//.test(link) || seen.has(link)) continue;
    seen.add(link);
    const t = Date.parse(it.date || '');
    const dated = !isNaN(t) && t > 0;
    if (dated && (t < cut || t > now + 86400000)) continue;
    const e = enrichItem({ title, desc: it.desc || '' });
    const text = String(it.text || '');
    const meta = { reg: 1, source: src.id, tier: src.tier, juris: src.juris, method: hit.method, issues: issueTag(title + ' ' + (it.desc || '') + ' ' + text.slice(0, 1500)), dated: dated ? 1 : 0 };
    if (e.parties) meta.parties = e.parties;
    if (it.outlet) meta.outlet = String(it.outlet).slice(0, 60);
    if (text.length > 600) { meta.full = 1; meta.ft = hit.method; }
    rows.push({ src: src.id, title: title.slice(0, 500), body: (text.length > (it.desc || '').length ? text : String(it.desc || '')).slice(0, 6000), url: link, tone: e.tone, meta, ts: dated ? t : now });
  }
  return rows;
}
function sourceStmts(env, run, added, now) {
  const s = run.src; const stmts = [];
  const next = now + Math.max(15, Number(s.schedule) || 60) * 60000;
  const short = run.tried.map(t => t.method + ':' + (t.ok ? t.n : (t.skipped ? 'skip' : 'x' + (t.status || '')))).join(' ');
  const detail = run.ok ? short : (short + ' | ' + run.tried.filter(t => !t.skipped).map(t => t.method + ' ' + t.detail).join('; ')).slice(0, 400);
  if (run.ok) {
    const latest = (run.items || []).reduce((a, i) => Math.max(a, Date.parse(i.date || '') || 0), 0);
    stmts.push(env.MIND_DB.prepare("UPDATE sources SET last_try=?, last_ok=?, next_due=?, fails=0, method_ok=?, last_error='', latest_ts=MAX(COALESCE(latest_ts,0),?), alerted=0, updated=? WHERE id=?").bind(now, now, next, run.method, latest, now, s.id));
  } else {
    stmts.push(env.MIND_DB.prepare('UPDATE sources SET last_try=?, next_due=?, fails=COALESCE(fails,0)+1, last_error=?, updated=? WHERE id=?').bind(now, next, detail.slice(0, 300), now, s.id));
  }
  stmts.push(env.MIND_DB.prepare('INSERT INTO source_health(src,ts,ok,method,n,ms,detail) VALUES(?,?,?,?,?,?,?)').bind(s.id, now, run.ok ? 1 : 0, run.method, added, run.tried.reduce((a, t) => a + (t.ms || 0), 0), detail));
  return stmts;
}
async function slackPost(env, ns, text) {
  let hooks = {};
  try { hooks = JSON.parse((await kvGet(env.AXIOM_KV, 'slack_webhooks')) || '{}'); } catch (e) { hooks = {}; }
  const url = hooks[ns] || hooks._default || env.SLACK_WEBHOOK_URL || '';
  if (!url) return false;
  try { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }), signal: abortAfter(10000) }); return r.ok; } catch (e) { return false; }
}
/** Sources that have failed SOURCE_DEAD_FAILS sweeps in a row and have not been
 *  reported: one Slack message, then alerted=1 (2 when no webhook is set, so
 *  it is not retried every tick). A later success resets it. */
async function sourcesAlertDead(env) {
  const rows = (await env.MIND_DB.prepare('SELECT id,name,tier,fails,last_error,last_ok FROM sources WHERE enabled=1 AND COALESCE(fails,0)>=? AND COALESCE(alerted,0)=0 ORDER BY fails DESC LIMIT 20').bind(SOURCE_DEAD_FAILS).all()).results || [];
  if (!rows.length) return [];
  const lines = [':no_entry: *' + rows.length + ' source' + (rows.length === 1 ? '' : 's') + ' stopped delivering* - ' + SOURCE_DEAD_FAILS + ' sweeps in a row failed'];
  rows.forEach(r => lines.push('- *' + String(r.name || r.id).replace(/[<>|*]/g, ' ') + '* (' + r.id + ', ' + r.tier + '): ' + String(r.last_error || '').replace(/[<>|*]/g, ' ').slice(0, 140)
    + (r.last_ok ? ' - last delivered ' + Math.round((Date.now() - r.last_ok) / 3600000) + 'h ago' : ' - never delivered')));
  lines.push('_AXIOM Sources - probe or switch them off in the Sources view._');
  const sent = await slackPost(env, '_default', lines.join('\n'));
  await env.MIND_DB.batch(rows.map(r => env.MIND_DB.prepare('UPDATE sources SET alerted=? WHERE id=?').bind(sent ? 1 : 2, r.id)));
  return rows.map(r => r.id);
}
/** The sweep. Default: the registry sources whose schedule has come round,
 *  oldest first, SOURCES_PER_TICK of them. `ids` runs exactly those; `all`
 *  runs every enabled registry source (a job). Core feeds are fetched by
 *  buildAllNews and only mirrored here, unless named in `ids`. */
async function sourceSweep(env, opts) {
  opts = opts || {};
  const log = opts.log || (async () => {});
  if (!(await ensureSources(env))) return { ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' };
  const now = Date.now();
  const ids = Array.isArray(opts.ids) ? opts.ids.map(sourceIdClean).filter(Boolean).slice(0, 150) : [];
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || (opts.all ? 150 : SOURCES_PER_TICK), 1), 150);
  let rows = [];
  if (ids.length) rows = (await env.MIND_DB.prepare('SELECT * FROM sources WHERE id IN (' + ids.map(() => '?').join(',') + ')').bind(...ids).all()).results || [];
  else if (opts.all) rows = (await env.MIND_DB.prepare('SELECT * FROM sources WHERE enabled=1 AND core=0 ORDER BY COALESCE(last_try,0) LIMIT ?').bind(limit).all()).results || [];
  else rows = (await env.MIND_DB.prepare('SELECT * FROM sources WHERE enabled=1 AND core=0 AND COALESCE(next_due,0)<=? ORDER BY COALESCE(next_due,0) LIMIT ?').bind(now, limit).all()).results || [];
  const srcs = rows.map(sourceRow).filter(s => s.methods.length);
  await log('info', 'sweeping ' + srcs.length + ' source' + (srcs.length === 1 ? '' : 's') + (ids.length ? '' : opts.all ? ' (every enabled registry source)' : ' (due now)'));
  const out = { ok: true, ran: srcs.length, succeeded: 0, failed: 0, items: 0, added: 0, dead: [], results: [] };
  const runs = await mapPool(srcs, 4, async (s) => {
    const run = await sourceRun(env, s, { log, all: !!opts.probe });
    let added = 0; run.rows = 0;
    if (run.ok) {
      // a method may hand back rows in another shape (videos and newsletter
      // posts file as Signals threads, with their comments beside them)
      const rws = run.hit.rows || sourceRows(s, run.hit, now);
      run.rows = rws.length;
      if (opts.file !== false) {
        for (let i = 0; i < rws.length; i += 150) added += await archiveItems(env, run.hit.kind || 'news', rws.slice(i, i + 150));
        for (const ex of (run.hit.extra || [])) for (let i = 0; i < ex.rows.length; i += 150) added += await archiveItems(env, ex.kind, ex.rows.slice(i, i + 150));
      }
    }
    run.added = added;
    return run;
  });
  const stmts = [];
  runs.forEach(run => {
    stmts.push(...sourceStmts(env, run, run.added, now));
    if (run.ok) { out.succeeded++; out.items += run.rows; out.added += run.added; } else out.failed++;
    const r = { id: run.src.id, name: run.src.name, ok: run.ok, method: run.method, items: run.rows, added: run.added };
    if (opts.detail) r.tried = run.tried; else if (!run.ok) r.error = (run.tried.filter(t => !t.skipped).map(t => t.method + ': ' + t.detail).join('; ')).slice(0, 200);
    out.results.push(r);
  });
  for (let i = 0; i < stmts.length; i += 100) { try { await env.MIND_DB.batch(stmts.slice(i, i + 100)); } catch (e) { await log('err', 'health write failed: ' + String((e && e.message) || e).slice(0, 100)); } }
  try { out.dead = await sourcesAlertDead(env); } catch (e) {}
  try { await env.MIND_DB.prepare('DELETE FROM source_health WHERE id NOT IN (SELECT id FROM source_health ORDER BY id DESC LIMIT ?)').bind(SOURCE_HEALTH_KEEP).run(); } catch (e) {}
  out.ms = Date.now() - now;
  await log('info', out.succeeded + ' of ' + out.ran + ' delivered, ' + out.items + ' items seen, ' + out.added + ' new in the archive' + (out.dead.length ? ', ' + out.dead.length + ' reported dead' : '') + ' (' + out.ms + 'ms)');
  if (!ids.length) await kvPut(env.AXIOM_KV, 'sources_last_sweep', JSON.stringify({ at: now, ran: out.ran, succeeded: out.succeeded, failed: out.failed, items: out.items, added: out.added, ms: out.ms, all: !!opts.all }), 7 * 86400);
  return out;
}
/** buildAllNews reports how each core feed fared; mirror that into the
 *  registry so one table shows the whole estate. Failures are logged; a
 *  success only updates the row (78 rows a tick would drown the log). */
async function sourcesCoreHealth(env, health) {
  if (!env.MIND_DB || !Array.isArray(health) || !health.length) return;
  if (!(await ensureSources(env))) return;
  const now = Date.now(); const stmts = [];
  health.forEach(h => {
    if (h.skipped) return;
    if (h.ok) stmts.push(env.MIND_DB.prepare("UPDATE sources SET last_try=?, last_ok=?, fails=0, method_ok='rss', last_error='', alerted=0, updated=? WHERE id=? AND core=1").bind(now, now, now, h.src));
    else {
      const d = h.error ? h.error : (h.status ? 'HTTP ' + h.status : 'HTTP 200 but no items parsed');
      stmts.push(env.MIND_DB.prepare('UPDATE sources SET last_try=?, fails=COALESCE(fails,0)+1, last_error=?, updated=? WHERE id=? AND core=1').bind(now, d, now, h.src));
      stmts.push(env.MIND_DB.prepare("INSERT INTO source_health(src,ts,ok,method,n,ms,detail) VALUES(?,?,0,'rss',0,?,?)").bind(h.src, now, h.ms || 0, d));
    }
  });
  for (let i = 0; i < stmts.length; i += 100) await env.MIND_DB.batch(stmts.slice(i, i + 100));
  try { await sourcesAlertDead(env); } catch (e) {}
}
async function sourcesList(env, filt) {
  filt = filt || {};
  const now = Date.now();
  const rows = ((await env.MIND_DB.prepare('SELECT * FROM sources ORDER BY tier, name').all()).results || []).map(sourceRow);
  const counts = {};
  try { (((await env.MIND_DB.prepare("SELECT COALESCE(json_extract(meta,'$.source'), src) s, COUNT(*) n, MAX(ts) latest FROM arc_items WHERE ts>? AND (kind='news' OR (kind='sig_thread' AND json_extract(meta,'$.reg')=1)) GROUP BY s").bind(now - 86400000).all()).results) || []).forEach(r => { counts[r.s] = { n: r.n || 0, latest: r.latest || 0 }; }); } catch (e) {}
  let last = null; try { last = JSON.parse((await kvGet(env.AXIOM_KV, 'sources_last_sweep')) || 'null'); } catch (e) { last = null; }
  const summary = { total: rows.length, enabled: 0, core: 0, ok: 0, failing: 0, dead: 0, stale: 0, unverified: 0, off: 0, items24: 0, byTier: {}, byMethod: {} };
  rows.forEach(s => {
    const c = counts[s.id] || { n: 0, latest: 0 };
    s.items24 = c.n; s.latest_ts = Math.max(s.latest_ts || 0, c.latest || 0); s.status = sourceStatus(s, now);
    summary[s.status] = (summary[s.status] || 0) + 1;
    if (s.enabled) summary.enabled++; if (s.core) summary.core++;
    summary.items24 += c.n; summary.byTier[s.tier] = (summary.byTier[s.tier] || 0) + 1;
    if (s.method_ok && s.enabled) summary.byMethod[s.method_ok] = (summary.byMethod[s.method_ok] || 0) + 1;
  });
  const q = String(filt.q || '').toLowerCase();
  const list = rows.filter(s => (!filt.tier || s.tier === filt.tier) && (!filt.juris || s.juris === filt.juris) && (!filt.status || s.status === filt.status)
    && (!filt.issue || s.issues.indexOf(filt.issue) >= 0) && (!q || (s.name + ' ' + s.id + ' ' + JSON.stringify(s.urls)).toLowerCase().indexOf(q) >= 0));
  return { ok: true, sources: list, summary, lastSweep: last, tiers: SOURCE_TIERS, juris: SOURCE_JURIS, methods: SOURCE_METHODS, deadAfter: SOURCE_DEAD_FAILS, perTick: SOURCES_PER_TICK, renderConfigured: renderConfigured(env) };
}

// ==============================================================================
// FULL TEXT - the article behind the headline, through every public route in
// turn: the page itself (JSON-LD articleBody, the <article> element, then the
// page's paragraphs), its AMP version (the amphtml link, amp. subdomain, /amp,
// ?outputType=amp), Google's AMP cache, the Wayback Machine (a snapshot, or
// one taken now when asked), archive.today, and finally a real browser. A
// Google News link is decoded to the article first. Every attempt is kept with
// its reason so a failure says why. Nothing here logs in anywhere: paywalled
// copy comes only from routes a publisher serves publicly, or not at all.
// ==============================================================================
const FT_MIN = 600;          // characters of body text before we call it the article
const FT_PER_TICK = 40;      // archive rows given full text per cron tick
function ldArticles(html) {
  const out = [];
  for (const m of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let d; try { d = JSON.parse(m[1].trim()); } catch (e) { continue; }
    const walk = (x, depth) => {
      if (!x || depth > 4) return;
      if (Array.isArray(x)) { x.forEach(y => walk(y, depth + 1)); return; }
      if (typeof x !== 'object') return;
      if (x['@graph']) walk(x['@graph'], depth + 1);
      const t = String(Array.isArray(x['@type']) ? x['@type'].join(' ') : (x['@type'] || ''));
      if (/Article|BlogPosting|Report/i.test(t)) out.push(x);
    };
    walk(d, 0);
  }
  return out;
}
function paragraphs(frag) {
  const ps = Array.from(String(frag).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)).map(m => stripHtml(m[1]))
    .filter(t => t.length >= 40 && !/^(share|read more|subscribe|advertisement|sign up|follow us|copyright|all rights reserved|loading)/i.test(t));
  return ps.join('\n\n').slice(0, 12000);
}
/** What a page says: title, body text and how it was found. `method` is empty
 *  when the body fell short of FT_MIN; `paywall` when the page says so. */
function extractArticle(html, url) {
  html = String(html || '');
  const res = { title: '', text: '', published: '', author: '', method: '', desc: '', paywall: false };
  res.title = stripHtml((html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) || [])[1] || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').slice(0, 300);
  res.desc = stripHtml((html.match(/<meta[^>]+(?:property=["']og:description["']|name=["']description["'])[^>]+content=["']([^"']+)/i) || [])[1] || '').slice(0, 400);
  res.published = (html.match(/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)/i) || [])[1] || '';
  if (/isAccessibleForFree["']?\s*:\s*["']?false|class=["'][^"']*paywall|subscribe to (read|continue)|subscriber[- ]only|piano\.io|tp\.push\(|meter-?wall/i.test(html)) res.paywall = true;
  for (const a of ldArticles(html)) {
    const body = typeof a.articleBody === 'string' ? stripHtml(a.articleBody) : '';
    if (!res.published && a.datePublished) res.published = String(a.datePublished).slice(0, 40);
    if (!res.author && a.author) { const au = Array.isArray(a.author) ? a.author[0] : a.author; res.author = String((au && au.name) || (typeof au === 'string' ? au : '')).slice(0, 120); }
    if (a.isAccessibleForFree === false || String(a.isAccessibleForFree).toLowerCase() === 'false') res.paywall = true;
    if (body.length >= FT_MIN) { res.text = body.slice(0, 12000); res.method = 'jsonld'; if (a.headline) res.title = stripHtml(String(a.headline)).slice(0, 300); return res; }
  }
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(nav|header|footer|aside|form|figure|figcaption|button|noscript|iframe|svg)\b[\s\S]*?<\/\1>/gi, ' ');
  const arts = Array.from(body.matchAll(/<article\b[\s\S]*?<\/article>/gi)).map(m => m[0]);
  const main = (body.match(/<main\b[\s\S]*?<\/main>/i) || [])[0] || '';
  let best = '', via = '';
  arts.forEach(c => { const t = paragraphs(c); if (t.length > best.length) { best = t; via = 'article'; } });
  if (best.length < FT_MIN && main) { const t = paragraphs(main); if (t.length > best.length) { best = t; via = 'main'; } }
  if (best.length < FT_MIN) { const t = paragraphs(body); if (t.length > best.length) { best = t; via = 'paragraphs'; } }
  res.text = best;
  res.method = best.length >= FT_MIN ? via : '';
  return res;
}
function ampVariants(url, html) {
  const out = [];
  let u; try { u = new URL(url); } catch (e) { return out; }
  const m = (html && html.match(/<link[^>]+rel=["']amphtml["'][^>]+href=["']([^"']+)/i)) || (html && html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']amphtml["']/i));
  if (m) { try { out.push(new URL(m[1], url).toString()); } catch (e) {} }
  out.push(u.protocol + '//amp.' + u.host.replace(/^www\./, '') + u.pathname);
  out.push(u.origin + u.pathname.replace(/\/$/, '') + '/amp' + u.search);
  out.push(u.origin + u.pathname + (u.search ? u.search + '&' : '?') + 'outputType=amp');
  return Array.from(new Set(out)).filter(v => v !== url).slice(0, 3);
}
function ampCacheUrl(url) {
  try { const u = new URL(url); const sub = u.host.replace(/-/g, '--').replace(/\./g, '-'); return 'https://' + sub + '.cdn.ampproject.org/c/s/' + u.host + u.pathname + u.search; } catch (e) { return ''; }
}
function gnewsIsLink(url) { return /^https?:\/\/news\.google\.com\/(rss\/)?articles\//.test(String(url || '')); }
/** Older Google News ids carry the article url in their base64; newer ones do
 *  not, and the interstitial has to be asked (batchexecute) with the signature
 *  and timestamp it embeds. */
function gnewsDecodeB64(url) {
  try {
    const id = (String(url).match(/articles\/([^/?#]+)/) || [])[1] || '';
    if (!id) return '';
    let b = id.replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const bin = atob(b);
    const m = bin.match(/https?:\/\/[\x21-\x7e]+/);
    if (!m) return '';
    const cand = m[0].replace(/[^\x21-\x7e].*$/, '');
    return /news\.google\.com/.test(cand) || cand.length < 12 ? '' : cand;
  } catch (e) { return ''; }
}
async function gnewsDecode(url) {
  const t0 = Date.now();
  const quick = gnewsDecodeB64(url);
  if (quick) return { ok: true, url: quick, via: 'base64', ms: Date.now() - t0 };
  const page = await srcFetch(url, 'text/html,*/*', 8000);
  if (!page.ok) return { ok: false, detail: page.error || ('HTTP ' + page.status), ms: Date.now() - t0 };
  const id = (String(url).match(/articles\/([^/?#]+)/) || [])[1] || '';
  const sg = (page.text.match(/data-n-a-sg="([^"]+)"/) || [])[1], ts = (page.text.match(/data-n-a-ts="([^"]+)"/) || [])[1];
  if (!sg || !ts) {
    const a = (page.text.match(/href="(https?:\/\/(?!news\.google\.com|www\.google\.com|accounts\.google|policies\.google|support\.google|play\.google)[^"]+)"/) || [])[1];
    return a ? { ok: true, url: a, via: 'interstitial', ms: Date.now() - t0 } : { ok: false, detail: 'the Google News page carried no signature and no target', ms: Date.now() - t0 };
  }
  try {
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, Number(ts), sg]);
    const body = 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]]));
    const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', 'User-Agent': BROWSER_UA }, body, signal: abortAfter(8000) });
    const txt = await r.text();
    const line = txt.split('\n').find(l => l.indexOf('wrb.fr') >= 0);
    if (!line) return { ok: false, detail: 'batchexecute answered without a result (HTTP ' + r.status + ')', ms: Date.now() - t0 };
    const payload = JSON.parse(JSON.parse(line)[0][2]);
    const target = payload && payload[1];
    return /^https?:\/\//.test(String(target)) ? { ok: true, url: String(target), via: 'batchexecute', ms: Date.now() - t0 } : { ok: false, detail: 'no url in the decoded payload', ms: Date.now() - t0 };
  } catch (e) { return { ok: false, detail: 'decode failed: ' + String((e && e.message) || e).slice(0, 80), ms: Date.now() - t0 }; }
}
async function waybackFind(url) {
  const f = await srcFetch('https://archive.org/wayback/available?url=' + encodeURIComponent(url), 'application/json,*/*', 8000);
  if (!f.ok) return { ok: false, detail: f.error || ('HTTP ' + f.status) };
  let d = {}; try { d = JSON.parse(f.text); } catch (e) { d = {}; }
  const c = d && d.archived_snapshots && d.archived_snapshots.closest;
  if (!c || !c.url) return { ok: false, detail: 'no snapshot in the Wayback Machine' };
  return { ok: true, url: String(c.url).replace(/^http:/, 'https:').replace(/\/web\/(\d+)\//, '/web/$1id_/'), ts: c.timestamp || '' };
}
async function waybackSave(url) {
  const f = await srcFetch('https://web.archive.org/save/' + url, 'text/html,*/*', 25000);
  return f.ok ? { ok: true, url: f.url } : { ok: false, detail: f.error || ('HTTP ' + f.status) };
}
/** The chain. opts.light skips archive.today and the browser (the cron's
 *  setting); opts.save asks the Wayback Machine for a fresh snapshot when it
 *  has none; opts.render forces the browser step. */
async function fullText(env, url, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const attempts = [];
  const out = { ok: false, url, final: url, title: '', desc: '', text: '', chars: 0, method: '', extract: '', attempts, paywall: false, published: '', author: '', ms: 0 };
  const done = () => { attempts.forEach(a => { delete a.html; }); out.chars = out.text.length; out.text = out.text.slice(0, 12000); out.ms = Date.now() - t0; return out; };
  const attempt = async (method, target, fetcher) => {
    const a0 = Date.now();
    const a = { method, target: String(target || '').slice(0, 220), ok: false, ms: 0, status: 0, chars: 0, detail: '' };
    try {
      const f = await (fetcher ? fetcher() : srcFetch(target, 'text/html,application/xhtml+xml,*/*', opts.ms || 8000));
      a.status = f.status || 0;
      if (!f.ok) { a.detail = f.error || (f.skipped ? String(f.detail || 'skipped') : ('HTTP ' + f.status)); if (f.skipped) a.skipped = true; }
      else {
        const html = f.text != null ? f.text : (f.html || '');
        const ex = extractArticle(html, f.url || target);
        a.chars = ex.text.length;
        if (ex.paywall) { out.paywall = true; a.paywall = true; }
        if (!out.title && ex.title) out.title = ex.title;
        if (!out.desc && ex.desc) out.desc = ex.desc;
        if (ex.text.length >= FT_MIN) {
          a.ok = true; out.ok = true; out.text = ex.text; out.method = method; out.extract = ex.method; out.final = f.url || target;
          if (ex.title) out.title = ex.title; out.published = ex.published || out.published; out.author = ex.author || out.author;
        } else a.detail = (ex.paywall ? 'paywall signalled; ' : '') + 'only ' + ex.text.length + ' chars of body text';
        a.html = html;
      }
    } catch (e) { a.detail = String((e && e.message) || e).slice(0, 100); }
    a.ms = Date.now() - a0;
    attempts.push(a);
    return a;
  };
  if (gnewsIsLink(url)) {
    const d = await gnewsDecode(url);
    attempts.push({ method: 'gnews', target: url.slice(0, 220), ok: d.ok, ms: d.ms || 0, status: 0, chars: 0, detail: d.ok ? 'decoded via ' + d.via : d.detail });
    if (!d.ok) { out.detail = 'could not resolve the Google News link to the article'; return done(); }
    url = d.url; out.final = url; out.decoded = url;
  }
  const direct = await attempt('direct', url);
  if (out.ok) return done();
  for (const v of ampVariants(url, direct.html || '')) { await attempt('amp', v); if (out.ok) return done(); }
  const cache = ampCacheUrl(url);
  if (cache) { await attempt('ampcache', cache); if (out.ok) return done(); }
  let wb = await waybackFind(url);
  if (!wb.ok && opts.save) {
    const sv = await waybackSave(url);
    attempts.push({ method: 'wayback-save', target: url.slice(0, 220), ok: sv.ok, ms: 0, status: 0, chars: 0, detail: sv.ok ? 'snapshot requested' : sv.detail });
    if (sv.ok) wb = await waybackFind(url);
  }
  if (wb.ok) { await attempt('wayback', wb.url); if (out.ok) return done(); }
  else attempts.push({ method: 'wayback', target: url.slice(0, 220), ok: false, ms: 0, status: 0, chars: 0, detail: wb.detail });
  if (!opts.light) { await attempt('archiveph', 'https://archive.ph/newest/' + url); if (out.ok) return done(); }
  if (!opts.light || opts.render) { await attempt('render', url, () => renderFetch(env, url, 35000)); if (out.ok) return done(); }
  out.detail = out.paywall ? 'paywalled: no public route carried the body text' : 'no route carried enough body text';
  return done();
}
function metaJson(meta) {
  let s = JSON.stringify(meta);
  if (s.length > 2000) { delete meta.ft_err; delete meta.outlet; delete meta.published; s = JSON.stringify(meta); }
  if (s.length > 2000 && Array.isArray(meta.issues)) { meta.issues = meta.issues.slice(0, 4); s = JSON.stringify(meta); }
  return s.slice(0, 2400);
}
/** Write body text back onto an archive row (by id or url). Used by the
 *  route, the cron, the render job and the desktop collector. */
async function fulltextSave(env, b) {
  b = b || {};
  if (!env.MIND_DB || !(await ensureArchive(env))) return { ok: false, error: 'mind_unbound' };
  const id = parseInt(b.id, 10) || 0; const url = String(b.url || '');
  const row = id ? await env.MIND_DB.prepare('SELECT id,meta FROM arc_items WHERE id=?').bind(id).first()
    : (url ? await env.MIND_DB.prepare("SELECT id,meta FROM arc_items WHERE kind='news' AND url=?").bind(url).first() : null);
  if (!row) return { ok: false, error: 'unknown_row', detail: 'No archive row with that id or url.' };
  const text = String(b.text || '').replace(/\s+\n/g, '\n').trim().slice(0, 6000);
  if (text.length < 200) return { ok: false, error: 'too_short', detail: 'Body text under 200 characters is not filed as the article.' };
  let meta = {}; try { meta = JSON.parse(row.meta || '{}') || {}; } catch (e) { meta = {}; }
  meta.ft = String(b.method || 'desktop').slice(0, 20); meta.ft_chars = text.length; delete meta.ft_try; delete meta.ft_err;
  if (b.link && /^https?:\/\//.test(String(b.link))) meta.link = String(b.link).slice(0, 300);
  if (b.published) meta.published = String(b.published).slice(0, 40);
  await env.MIND_DB.prepare('UPDATE arc_items SET body=?, meta=? WHERE id=?').bind(text, metaJson(meta), row.id).run();
  return { ok: true, id: row.id, chars: text.length, method: meta.ft };
}
/** Every tick: the news of the last two days that arrived as a headline and a
 *  blurb gets its body text. A row is tried twice, then marked so it is not
 *  tried again; what stopped it is kept on the row. */
async function fulltextCron(env, opts) {
  opts = opts || {};
  if (!env.MIND_DB || !(await ensureArchive(env))) return { ok: false, error: 'mind_unbound' };
  const now = Date.now();
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || FT_PER_TICK, 1), 100);
  const rows = (await env.MIND_DB.prepare("SELECT id,url,src,title,meta FROM arc_items WHERE kind='news' AND ts>? AND LENGTH(COALESCE(body,''))<? AND (meta IS NULL OR json_extract(meta,'$.ft') IS NULL OR (json_extract(meta,'$.ft')='retry' AND COALESCE(json_extract(meta,'$.ft_try'),0)<2)) ORDER BY ts DESC LIMIT ?")
    .bind(now - 48 * 3600000, FT_MIN, limit).all()).results || [];
  const out = { ok: true, tried: rows.length, got: 0, failed: 0, byMethod: {}, ms: 0 };
  const stmts = [];
  await mapPool(rows, 4, async (r) => {
    const ft = await fullText(env, r.url, { light: true, ms: 7000, render: !!env.FULLTEXT_RENDER });
    let meta = {}; try { meta = JSON.parse(r.meta || '{}') || {}; } catch (e) { meta = {}; }
    if (ft.decoded) meta.link = String(ft.decoded).slice(0, 300);
    if (ft.ok) {
      meta.ft = ft.method; meta.ft_chars = ft.chars; delete meta.ft_try; delete meta.ft_err;
      if (ft.published) meta.published = String(ft.published).slice(0, 40);
      stmts.push(env.MIND_DB.prepare('UPDATE arc_items SET body=?, meta=? WHERE id=?').bind(ft.text.slice(0, 6000), metaJson(meta), r.id));
      out.got++; out.byMethod[ft.method] = (out.byMethod[ft.method] || 0) + 1;
    } else {
      const n = (Number(meta.ft_try) || 0) + 1;
      meta.ft = n >= 2 ? 'none' : 'retry'; meta.ft_try = n; meta.ft_err = String(ft.detail || '').slice(0, 80);
      if (ft.paywall) meta.paywall = 1;
      stmts.push(env.MIND_DB.prepare('UPDATE arc_items SET meta=? WHERE id=?').bind(metaJson(meta), r.id));
      out.failed++;
    }
  });
  for (let i = 0; i < stmts.length; i += 100) { try { await env.MIND_DB.batch(stmts.slice(i, i + 100)); } catch (e) {} }
  out.ms = Date.now() - now;
  if (rows.length) await kvPut(env.AXIOM_KV, 'fulltext_last', JSON.stringify(Object.assign({ at: now }, out)), 7 * 86400);
  return out;
}
/** A render job in the worker: a listing page for a source (files what it
 *  finds and records the health), or one article (writes its text back). */
async function renderJob(env, job, log) {
  const p = job.params || {};
  if (!renderConfigured(env)) return { ok: false, error: 'render_not_configured', detail: 'Rendering runs where a browser is. Set RENDER_URL (a Playwright render service) or CF_ACCOUNT_ID + CF_BROWSER_TOKEN on the worker, or run tools/reach-agent.py on a Mac with Playwright (pip install playwright && playwright install chromium): the job will go there.' };
  const now = Date.now();
  if (p.source) {
    if (!(await ensureSources(env))) return { ok: false, error: 'mind_unbound' };
    const s = await sourceGet(env, sourceIdClean(p.source));
    if (!s) return { ok: false, error: 'unknown_source', detail: 'No source with id ' + p.source + '.' };
    const url = /^https?:\/\//.test(String(p.url || '')) ? String(p.url) : (s.urls.home || '');
    if (!url) return { ok: false, error: 'missing_url', detail: s.id + ' has no listing page to render.' };
    await log('cmd', 'render ' + url);
    const r = await renderFetch(env, url, 35000);
    if (!r.ok) { await log('err', r.detail); return { ok: false, error: 'render_failed', detail: r.detail }; }
    const items = listingLinks(r.html, url);
    await log('out', items.length + ' article-shaped links on the rendered page (' + r.ms + 'ms)');
    const rows = sourceRows(s, { items, method: 'render' }, now);
    let added = 0; for (let i = 0; i < rows.length; i += 150) added += await archiveItems(env, 'news', rows.slice(i, i + 150));
    const run = { src: s, ok: items.length > 0, method: 'render', items, tried: [{ method: 'render', ok: items.length > 0, n: items.length, ms: r.ms, status: 200, skipped: false, detail: items.length ? '' : 'rendered page had no article-shaped links' }] };
    try { await env.MIND_DB.batch(sourceStmts(env, run, added, now)); } catch (e) {}
    await log('info', 'filed ' + added + ' new rows for ' + s.id);
    return { ok: items.length > 0, source: s.id, url, items: items.length, added, method: 'render' };
  }
  const url = String(p.url || '');
  if (!/^https?:\/\//.test(url)) return { ok: false, error: 'missing_url', detail: 'Give a url, or a source id.' };
  await log('cmd', 'render ' + url);
  const r = await renderFetch(env, url, 35000);
  if (!r.ok) { await log('err', r.detail); return { ok: false, error: 'render_failed', detail: r.detail }; }
  const ex = extractArticle(r.html, url);
  await log('out', ex.text.length + ' chars of body text' + (ex.method ? ' via ' + ex.method : '') + ' (' + r.ms + 'ms)');
  let filed = null;
  if (p.id && ex.text.length >= FT_MIN) { filed = await fulltextSave(env, { id: p.id, text: ex.text, title: ex.title, method: 'render', published: ex.published }); if (filed.ok) await log('info', 'archive row ' + filed.id + ' now carries the article'); }
  return { ok: ex.text.length >= FT_MIN, url, title: ex.title, chars: ex.text.length, method: 'render', extract: ex.method, paywall: ex.paywall, filed: filed && filed.ok ? filed.id : 0, text: ex.text.slice(0, 2000) };
}

// ==============================================================================
// SOCIAL CAPTURE - the public conversation beyond Reddit and the clients' own
// pages, through routes that need no login: Bluesky's public AppView (search,
// threads, replies), Mastodon tag timelines and reply contexts on the
// Australian instances, X account timelines through X's own embed service (the
// MP register and a watch list; replies still need the Mac), YouTube channel
// feeds with comments (the Data API when a key is set, the site's own web
// endpoint otherwise) and captions, parliamentary e-petitions with daily
// signature snapshots, and Substack publications with their comment threads.
// Everything files in the Signals shape (sig_thread / sig_comment) with the
// engagement kept in meta.eng; names are never stored except sitting MPs on
// their own posts. What each platform needs, what it can and cannot reach and
// how it fared last time is one table: socialCoverage().
// ==============================================================================
const SOCIAL_PLATFORMS = ['bluesky', 'mastodon', 'youtube', 'petitions'];   // worker-side sweeps the Signals view can start as jobs
const BSKY_API = 'https://public.api.bsky.app/xrpc/';
const MASTO_INSTANCES = ['aus.social', 'mastodon.au', 'theblower.au', 'mastodon.social'];
const MASTO_TAGS = ['auspol', 'springst', 'nswpol', 'qldpol', 'wapol', 'sapol', 'taspol', 'ntpol', 'actpol', 'ausvotes', 'insiders', 'qanda'];
const X_TIMELINE = 'https://syndication.twitter.com/srv/timeline-profile/screen-name/';
const X_TWEET = 'https://cdn.syndication.twimg.com/tweet-result';
const YT_FEED = 'https://www.youtube.com/feeds/videos.xml?channel_id=';
const YT_WEB_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';   // the key YouTube's own web client sends with every request; public in every page, not a secret
const YT_CONSENT = 'CONSENT=YES+cb.20240101-00-p0.en+FX+000; SOCS=CAI';
const SOCIAL_PACE = 350;   // ms between calls to one service
async function socialJson(url, init, ms) {
  const t0 = Date.now();
  try {
    const opts = { headers: Object.assign({ 'User-Agent': BROWSER_UA, 'Accept': 'application/json,*/*', 'Accept-Language': 'en-AU,en;q=0.8' }, (init && init.headers) || {}), signal: abortAfter(ms || 9000) };
    if (init && init.method) { opts.method = init.method; opts.body = init.body; }
    const r = await fetch(url, opts);
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) { json = null; }
    const msg = json && (json.message || (json.error && (json.error.message || json.error))) ? ': ' + String(json.message || json.error.message || json.error).slice(0, 80) : '';
    return { ok: r.ok, status: r.status, json, text, ms: Date.now() - t0, error: r.ok ? '' : ('HTTP ' + r.status + msg) };
  } catch (e) {
    const s = String((e && e.name) || '') + ' ' + String((e && e.message) || e);
    return { ok: false, status: 0, json: null, text: '', ms: Date.now() - t0, error: /timeout|abort/i.test(s) ? 'timed out' : s.trim().slice(0, 90) };
  }
}
function engRow(row, e) { e = e || {}; row.meta.eng = { likes: e.likes || 0, reposts: e.reposts || 0, replies: e.replies || 0, quotes: e.quotes || 0, views: e.views || 0 }; return row; }

// -- Bluesky: the public AppView, no key ---------------------------------------
function bskyNorm(p, q) {
  const rec = p.record || {}; const text = stripHtml(String(rec.text || '')).trim();
  const rkey = String(p.uri || '').split('/').pop(); const did = (p.author || {}).did || '';
  return { platform: 'bluesky', id: 'b' + arcHash(String(p.uri || '')), uri: String(p.uri || ''), text, ts: Date.parse(rec.createdAt || p.indexedAt || '') || Date.now(),
    likes: p.likeCount || 0, reposts: p.repostCount || 0, replies: p.replyCount || 0, quotes: p.quoteCount || 0,
    url: did && rkey ? 'https://bsky.app/profile/' + did + '/post/' + rkey : 'x:sig:bluesky:' + rkey, q: q || '', reply: !!rec.reply, lang: (rec.langs || [])[0] || '' };
}
async function bskySearch(q, limit, sinceIso) {
  const r = await socialJson(BSKY_API + 'app.bsky.feed.searchPosts?q=' + encodeURIComponent(q) + '&limit=' + Math.min(Math.max(limit || 40, 1), 100) + '&sort=latest' + (sinceIso ? '&since=' + encodeURIComponent(sinceIso) : ''));
  if (!r.ok) return { ok: false, posts: [], detail: r.error };
  return { ok: true, posts: ((r.json || {}).posts || []).map(p => bskyNorm(p, q)) };
}
async function bskyThread(uri, depth) {
  const r = await socialJson(BSKY_API + 'app.bsky.feed.getPostThread?uri=' + encodeURIComponent(uri) + '&depth=' + (depth || 6) + '&parentHeight=0');
  if (!r.ok) return { ok: false, replies: [], detail: r.error };
  const out = [];
  const walk = (node, d) => { if (!node || d > 8 || out.length >= 300) return; (node.replies || []).forEach(ch => { if (ch && ch.post) { const n = bskyNorm(ch.post, ''); n.depth = d; out.push(n); walk(ch, d + 1); } }); };
  walk((r.json || {}).thread, 1);
  return { ok: true, replies: out };
}
async function bskySweep(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  const sel = opts.issue ? String(opts.issue).split(',').map(s => s.trim()).filter(Boolean) : [];
  const queries = Array.isArray(opts.queries) ? opts.queries.map(String).filter(Boolean) : issueQueries(sel.length ? sel : null);
  const perQuery = Math.min(Math.max(parseInt(opts.perQuery, 10) || 40, 5), 100);
  const maxThreads = Math.min(Math.max(parseInt(opts.threads, 10) || 25, 0), 100);
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 7, 1), 90);
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const out = { ok: true, platform: 'bluesky', queries: queries.length, found: 0, kept: 0, threads: 0, comments: 0, threadRows: 0, commentRows: 0, hostile: 0, errors: [] };
  const seen = new Map();
  await log('info', 'Bluesky: ' + queries.length + ' keywords on the public AppView, last ' + days + ' days');
  for (const q of queries) {
    await log('cmd', 'GET app.bsky.feed.searchPosts q="' + q + '" sort=latest');
    const r = await bskySearch(q, perQuery, since);
    if (!r.ok) { out.errors.push(q + ': ' + r.detail); await log('err', q + ': ' + r.detail); await rdSleep(SOCIAL_PACE); continue; }
    let kept = 0;
    r.posts.forEach(p => { out.found++; if (!p.text || seen.has(p.uri)) return; if (!auRelevant('', p.text, q)) return; seen.set(p.uri, p); kept++; });
    out.kept += kept;
    await log('out', r.posts.length + ' hits, ' + kept + ' Australian kept');
    await rdSleep(SOCIAL_PACE);
  }
  const posts = Array.from(seen.values());
  const threads = posts.map(p => { const t = { platform: 'bluesky', id: p.id, title: p.text.split('\n')[0].slice(0, 200) || 'Bluesky post', body: p.text, page: '', page_name: '', score: p.likes + p.reposts, comments: p.replies, url: p.url, ts: p.ts, q: p.q, via: 'worker' }; t.issues = issueTag(p.text); return t; });
  const trows = threads.map((t, i) => { const row = engRow(sigThreadRow(t), posts[i]); row.meta.uri = posts[i].uri; if (posts[i].lang) row.meta.lang = posts[i].lang; return row; });
  const crows = [];
  const busy = threads.map((t, i) => ({ t, p: posts[i] })).filter(x => x.p.replies >= 2).sort((a, b) => (b.t.issues.length - a.t.issues.length) || (b.p.replies - a.p.replies)).slice(0, maxThreads);
  for (const x of busy) {
    await log('cmd', 'GET app.bsky.feed.getPostThread ' + x.p.uri.split('/').pop() + ' depth=6');
    const th = await bskyThread(x.p.uri, 6);
    if (!th.ok) { out.errors.push(th.detail); await log('err', th.detail); await rdSleep(SOCIAL_PACE); continue; }
    th.replies.forEach(c => { if (!c.text) return; crows.push(engRow(sigCommentRow({ platform: 'bluesky', id: c.id, body: c.text, score: c.likes, depth: c.depth, ts: c.ts, via: 'worker' }, x.t), c)); });
    await log('out', th.replies.length + ' replies');
    await rdSleep(SOCIAL_PACE);
  }
  out.threads = trows.length; out.comments = crows.length; out.hostile = crows.filter(r => r.tone < 0).length;
  const f = await sigFile(env, trows, crows); out.threadRows = f.threadRows; out.commentRows = f.commentRows;
  await log('info', 'filed ' + f.threadRows + ' new posts and ' + f.commentRows + ' new replies');
  if (!out.threads && out.errors.length) { out.ok = false; out.detail = 'Nothing was collected. ' + out.errors[0]; }
  return out;
}

// -- Mastodon: tag timelines and reply contexts on the Australian instances ----
function mastoNorm(s, inst) {
  const text = stripHtml(String(s.content || '').replace(/<\/p>\s*<p>/gi, ' - ')).trim();
  return { platform: 'mastodon', id: 'm' + arcHash(String(s.url || s.uri || (inst + '/' + s.id))), sid: String(s.id || ''), inst, text, ts: Date.parse(s.created_at || '') || Date.now(),
    likes: s.favourites_count || 0, reposts: s.reblogs_count || 0, replies: s.replies_count || 0, url: String(s.url || s.uri || ''), tags: (s.tags || []).map(t => String(t.name || '').toLowerCase()), reply: !!s.in_reply_to_id, lang: s.language || '' };
}
async function mastoTag(inst, tag, limit) {
  const r = await socialJson('https://' + inst + '/api/v1/timelines/tag/' + encodeURIComponent(tag) + '?limit=' + Math.min(Math.max(limit || 40, 1), 40));
  if (!r.ok) return { ok: false, posts: [], detail: r.error };
  return { ok: true, posts: (Array.isArray(r.json) ? r.json : []).filter(s => s && !s.reblog).map(s => mastoNorm(s, inst)) };
}
async function mastoContext(inst, sid) {
  const r = await socialJson('https://' + inst + '/api/v1/statuses/' + encodeURIComponent(sid) + '/context');
  if (!r.ok) return { ok: false, replies: [], detail: r.error };
  return { ok: true, replies: (((r.json || {}).descendants) || []).map(s => mastoNorm(s, inst)) };
}
async function mastodonSweep(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  const tags = Array.isArray(opts.tags) && opts.tags.length ? opts.tags.map(String) : MASTO_TAGS;
  const instances = Array.isArray(opts.instances) && opts.instances.length ? opts.instances.map(String) : MASTO_INSTANCES;
  const maxThreads = Math.min(Math.max(parseInt(opts.threads, 10) || 30, 0), 100);
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 7, 1), 90);
  const since = Date.now() - days * 86400000;
  const out = { ok: true, platform: 'mastodon', instances: instances.length, tags: tags.length, found: 0, threads: 0, comments: 0, threadRows: 0, commentRows: 0, hostile: 0, errors: [] };
  const seen = new Map();
  await log('info', 'Mastodon: ' + tags.length + ' tags on ' + instances.join(', ') + ', last ' + days + ' days');
  for (const inst of instances) {
    let dead = false;
    for (const tag of tags) {
      await log('cmd', 'GET ' + inst + '/api/v1/timelines/tag/' + tag);
      const r = await mastoTag(inst, tag, 40);
      if (!r.ok) { out.errors.push(inst + ' #' + tag + ': ' + r.detail); await log('err', inst + ' #' + tag + ': ' + r.detail); if (/HTTP (0|5\d\d)|timed out/.test(r.detail)) { dead = true; break; } await rdSleep(SOCIAL_PACE); continue; }
      let kept = 0;
      r.posts.forEach(p => { out.found++; if (!p.text || p.ts < since || seen.has(p.url)) return; seen.set(p.url, p); kept++; });
      await log('out', r.posts.length + ' posts, ' + kept + ' new');
      await rdSleep(SOCIAL_PACE);
    }
    if (dead) await log('err', inst + ' is not answering; moving on');
  }
  const posts = Array.from(seen.values());
  const threads = posts.map(p => { const t = { platform: 'mastodon', id: p.id, title: p.text.split(' - ')[0].slice(0, 200) || 'Mastodon post', body: p.text, page: p.inst, page_name: p.inst, score: p.likes + p.reposts, comments: p.replies, url: p.url, ts: p.ts, q: p.tags.filter(x => tags.indexOf(x) >= 0)[0] || '', via: 'worker' }; t.issues = issueTag(p.text); return t; });
  const trows = threads.map((t, i) => { const row = engRow(sigThreadRow(t), posts[i]); row.meta.tags = posts[i].tags.slice(0, 8); return row; });
  const crows = [];
  const busy = threads.map((t, i) => ({ t, p: posts[i] })).filter(x => x.p.replies >= 1).sort((a, b) => (b.t.issues.length - a.t.issues.length) || (b.p.replies - a.p.replies)).slice(0, maxThreads);
  for (const x of busy) {
    await log('cmd', 'GET ' + x.p.inst + '/api/v1/statuses/' + x.p.sid + '/context');
    const c = await mastoContext(x.p.inst, x.p.sid);
    if (!c.ok) { out.errors.push(c.detail); await log('err', c.detail); await rdSleep(SOCIAL_PACE); continue; }
    c.replies.forEach(r => { if (!r.text) return; crows.push(engRow(sigCommentRow({ platform: 'mastodon', id: r.id, body: r.text, score: r.likes, depth: 1, ts: r.ts, via: 'worker' }, x.t), r)); });
    await log('out', c.replies.length + ' replies');
    await rdSleep(SOCIAL_PACE);
  }
  out.threads = trows.length; out.comments = crows.length; out.hostile = crows.filter(r => r.tone < 0).length;
  const f = await sigFile(env, trows, crows); out.threadRows = f.threadRows; out.commentRows = f.commentRows;
  await log('info', 'filed ' + f.threadRows + ' new posts and ' + f.commentRows + ' new replies');
  if (!out.threads && out.errors.length) { out.ok = false; out.detail = 'Nothing was collected. ' + out.errors[0]; }
  return out;
}

// -- X: account timelines through X's own embed service ------------------------
//    Search and replies still need a signed-in Mac (tools/reach-x.py). The
//    timelines of named accounts - the MP register, and the watch list in KV
//    x_watch - are public and served to embeds, so the worker reads them here.
function xTweetToken(id) { return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''); }
function xNorm(t) {
  const u = t.user || {};
  return { id: String(t.id_str || t.id || ''), text: String(t.full_text || t.text || '').trim(), ts: Date.parse(t.created_at || '') || Date.now(),
    likes: t.favorite_count || 0, reposts: t.retweet_count || 0, replies: t.reply_count || t.conversation_count || 0, quotes: t.quote_count || 0, views: 0,
    handle: String(u.screen_name || ''), replyTo: String(t.in_reply_to_status_id_str || ''), retweet: !!t.retweeted_status, quoted: t.quoted_status ? String(t.quoted_status.id_str || '') : '' };
}
async function xTimeline(handle) {
  const h = String(handle || '').replace(/^@/, '');
  const f = await srcFetch(X_TIMELINE + encodeURIComponent(h), 'text/html,*/*', 9000);
  if (!f.ok) return { ok: false, tweets: [], status: f.status, detail: f.error || ('HTTP ' + f.status + (f.status === 404 ? ' (no such account, or protected)' : f.status === 429 ? ' (rate limited)' : '')) };
  const m = f.text.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return { ok: false, tweets: [], status: f.status, detail: 'the embed page carried no timeline (X may be refusing this network)' };
  let d; try { d = JSON.parse(m[1]); } catch (e) { return { ok: false, tweets: [], status: f.status, detail: 'timeline payload is not JSON' }; }
  const pp = (((d || {}).props || {}).pageProps) || {};
  const entries = ((pp.timeline || {}).entries) || [];
  const tweets = entries.map(e => e && e.content && e.content.tweet).filter(Boolean).map(xNorm).filter(t => t.id);
  if (!tweets.length) return { ok: false, tweets: [], status: f.status, detail: pp.headerProps ? 'the account has no posts in the embed timeline' : 'no posts in the embed timeline (protected, suspended or renamed?)' };
  return { ok: true, tweets };
}
async function xTweet(id) {
  const r = await socialJson(X_TWEET + '?id=' + encodeURIComponent(id) + '&token=' + xTweetToken(id) + '&lang=en');
  if (!r.ok || !r.json) return { ok: false, detail: r.error || 'no payload' };
  if (r.json.tombstone || !r.json.text) return { ok: false, detail: 'post unavailable' };
  return { ok: true, tweet: xNorm(r.json) };
}
async function xWatchList(env) {
  let list = []; try { list = JSON.parse((await kvGet(env.AXIOM_KV, 'x_watch')) || '[]'); } catch (e) { list = []; }
  return (Array.isArray(list) ? list : []).map(w => ({ handle: String((w && (w.handle || w)) || '').replace(/^@/, '').trim().slice(0, 30), ns: String((w && w.ns) || '').slice(0, 24), name: String((w && w.name) || '').slice(0, 80) })).filter(w => /^[A-Za-z0-9_]{1,15}$/.test(w.handle));
}
async function xSyndSweep(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 7, 1), 90);
  const max = Math.min(Math.max(parseInt(opts.max, 10) || 30, 1), 200);
  const watch = await xWatchList(env);
  let mps = []; try { mps = opts.mps === false ? [] : await mpsList(env, { withX: true, limit: 600 }); } catch (e) { mps = []; }
  const all = watch.map(w => ({ handle: w.handle, name: w.name, ns: w.ns, mp: null }))
    .concat(mps.map(m => ({ handle: String(m.x || '').replace(/^@/, ''), name: m.name, ns: '', mp: { name: m.name, party: m.party || '', house: m.house || '' } })))
    .filter(a => /^[A-Za-z0-9_]{1,15}$/.test(a.handle));
  let accounts = all;
  if (Array.isArray(opts.handles) && opts.handles.length) {
    const want = opts.handles.map(h => String(h).replace(/^@/, '').toLowerCase()).filter(Boolean).slice(0, max);
    accounts = want.map(h => all.find(a => a.handle.toLowerCase() === h) || { handle: h, name: '', ns: '', mp: null });
  } else if (all.length > max) {
    const cur = Number(await kvGet(env.AXIOM_KV, 'x_synd_cursor') || 0) % all.length;
    accounts = all.slice(cur, cur + max).concat(cur + max > all.length ? all.slice(0, cur + max - all.length) : []);
    await kvPut(env.AXIOM_KV, 'x_synd_cursor', String((cur + max) % all.length), 7 * 86400);
  }
  const out = { ok: true, platform: 'x', mode: 'timelines', accounts: accounts.length, watched: watch.length, mps: mps.length, threads: 0, comments: 0, threadRows: 0, commentRows: 0, hostile: 0, errors: [] };
  const since = Date.now() - days * 86400000; const trows = [];
  await log('info', 'X: ' + accounts.length + ' account timelines through the embed service (' + watch.length + ' watched, ' + mps.length + ' MPs on file), last ' + days + ' days');
  for (const a of accounts) {
    await log('cmd', 'GET syndication.twitter.com/srv/timeline-profile/screen-name/' + a.handle);
    const r = await xTimeline(a.handle);
    if (!r.ok) { out.errors.push(a.handle + ': ' + r.detail); await log('err', a.handle + ': ' + r.detail); await rdSleep(r.status === 429 ? 2000 : SOCIAL_PACE); continue; }
    let n = 0;
    r.tweets.forEach(t => {
      if (t.ts < since || t.retweet || !t.text) return;
      const th = { platform: 'x', id: t.id, title: t.text.split('\n')[0].slice(0, 200) || 'Post', body: t.text, page: a.handle, page_name: a.name || a.handle, score: t.likes + t.reposts, comments: t.replies, url: 'https://x.com/i/web/status/' + t.id, ts: t.ts, ns: a.ns, via: 'worker' };
      const row = engRow(sigThreadRow(th), t); row.meta.synd = 1;
      if (a.mp) row.meta.mp = a.mp;
      if (t.replyTo) row.meta.reply_to = t.replyTo; if (t.quoted) row.meta.quoted = t.quoted;
      trows.push(row); n++;
    });
    await log('out', a.handle + ': ' + r.tweets.length + ' posts in the timeline, ' + n + ' in the window');
    await rdSleep(SOCIAL_PACE);
  }
  out.threads = trows.length;
  const f = await sigFile(env, trows, []); out.threadRows = f.threadRows;
  await log('info', 'filed ' + f.threadRows + ' new posts (replies are not in the embed service: the Mac collector reads those)');
  if (!out.threads && out.errors.length) { out.ok = false; out.detail = 'Nothing was read. ' + out.errors[0]; }
  return out;
}

// -- YouTube: channel feeds (a Source Registry method), comments and captions --
async function fetchYt(url, ms) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-AU,en;q=0.8', 'Cookie': YT_CONSENT }, signal: abortAfter(ms || 10000), redirect: 'follow' });
    const text = r.ok ? (await r.text()).slice(0, 3000000) : '';
    return { ok: r.ok, status: r.status, text, ms: Date.now() - t0, url: r.url || url };
  } catch (e) { const s = String((e && e.name) || '') + ' ' + String((e && e.message) || e); return { ok: false, status: 0, text: '', ms: Date.now() - t0, error: /timeout|abort/i.test(s) ? 'timed out' : s.trim().slice(0, 90) }; }
}
async function ytChannelId(env, ref) {
  ref = String(ref || '').trim();
  if (/^UC[\w-]{22}$/.test(ref)) return { ok: true, id: ref };
  const m0 = ref.match(/(UC[\w-]{22})/); if (m0) return { ok: true, id: m0[1] };
  const handle = ref.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/[/?#].*$/, '').replace(/^@?/, '@');
  if (!/^@[\w.-]{2,60}$/.test(handle)) return { ok: false, detail: 'give a channel id (UC...) or a handle (@name)' };
  const ck = 'yt_ch_' + handle.slice(1).toLowerCase();
  const c = await kvGet(env.AXIOM_KV, ck); if (c) return { ok: true, id: c, cached: true };
  const f = await fetchYt('https://www.youtube.com/' + handle);
  if (!f.ok) return { ok: false, detail: (f.error || ('HTTP ' + f.status)) + ' resolving ' + handle };
  const m = f.text.match(/"externalId":"(UC[\w-]{22})"/) || f.text.match(/"channelId":"(UC[\w-]{22})"/) || f.text.match(/channel_id=(UC[\w-]{22})/);
  if (!m) return { ok: false, detail: 'no channel id on the page for ' + handle + (/consent\.youtube\.com|before you continue/i.test(f.text) ? ' (consent wall)' : '') };
  await kvPut(env.AXIOM_KV, ck, m[1], 30 * 86400);
  return { ok: true, id: m[1] };
}
function ytFeedParse(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const b = m[1];
    const videoId = (b.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1] || '';
    if (!videoId) continue;
    out.push({ videoId, title: stripHtml((b.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || ''), link: 'https://www.youtube.com/watch?v=' + videoId,
      date: ((b.match(/<published>([^<]+)<\/published>/) || [])[1] || '').trim(), desc: stripHtml((b.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || ''),
      views: parseInt((b.match(/<media:statistics[^>]*views="(\d+)"/) || [])[1] || '0', 10) || 0, channel: stripHtml((b.match(/<author>[\s\S]*?<name>([^<]+)<\/name>/) || [])[1] || ''), channelId: (b.match(/<yt:channelId>([^<]+)<\/yt:channelId>/) || [])[1] || '' });
  }
  return out;
}
async function srcYoutube(env, src) {
  const ch = await ytChannelId(env, src.urls.youtube);
  if (!ch.ok) return { ok: false, items: [], detail: ch.detail };
  const f = await srcFetch(YT_FEED + ch.id, 'application/atom+xml,application/xml,text/xml,*/*');
  if (!f.ok) return srcFail(f);
  const vids = ytFeedParse(f.text);
  if (!vids.length) return { ok: false, items: [], status: f.status, detail: 'channel feed had no videos' };
  const now = Date.now(); const cut = now - SOURCE_WINDOW_H * 3600000;
  const rows = vids.filter(v => { const t = Date.parse(v.date || ''); return !t || t >= cut; }).map(v => {
    const th = { platform: 'youtube', id: v.videoId, title: v.title, body: v.desc.slice(0, 3000), page: ch.id, page_name: v.channel || src.name, score: v.views, comments: 0, url: v.link, ts: Date.parse(v.date || '') || now, via: 'worker' };
    const row = engRow(sigThreadRow(th), { views: v.views }); row.meta.video = v.videoId; row.meta.source = src.id; row.meta.reg = 1; return row;
  });
  return { ok: true, items: vids.map(v => ({ title: v.title, link: v.link, date: v.date, desc: v.desc.slice(0, 240) })), status: f.status, kind: 'sig_thread', rows, channel: ch.id };
}
async function ytCommentsApi(env, videoId, max) {
  const r = await socialJson('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=' + encodeURIComponent(videoId) + '&maxResults=' + Math.min(Math.max(max || 100, 1), 100) + '&order=relevance&textFormat=plainText&key=' + encodeURIComponent(env.YOUTUBE_KEY));
  if (!r.ok) { const reason = ((((r.json || {}).error || {}).errors) || [])[0] || {}; return { ok: false, comments: [], detail: reason.reason === 'commentsDisabled' ? 'comments are off for this video' : (reason.reason === 'quotaExceeded' ? 'YouTube Data API quota spent for today' : (r.error || 'Data API error')) }; }
  const out = [];
  (((r.json || {}).items) || []).forEach(it => {
    const c = ((it.snippet || {}).topLevelComment) || {}; const s = c.snippet || {};
    if (s.textDisplay) out.push({ id: String(c.id || ''), text: String(s.textDisplay), likes: s.likeCount || 0, ts: Date.parse(s.publishedAt || '') || Date.now(), depth: 0 });
    ((((it.replies || {}).comments)) || []).forEach(rc => { const rs = rc.snippet || {}; if (rs.textDisplay) out.push({ id: String(rc.id || ''), text: String(rs.textDisplay), likes: rs.likeCount || 0, ts: Date.parse(rs.publishedAt || '') || Date.now(), depth: 1 }); });
  });
  return { ok: true, comments: out, via: 'data api' };
}
function deepCollect(obj, key, out, limit) {
  if (!obj || typeof obj !== 'object' || out.length >= (limit || 500)) return;
  if (Array.isArray(obj)) { for (const x of obj) deepCollect(x, key, out, limit); return; }
  if (obj[key] !== undefined) out.push(obj[key]);
  for (const k in obj) if (k !== key && obj[k] && typeof obj[k] === 'object') deepCollect(obj[k], key, out, limit);
}
function relTime(s) {
  const m = String(s || '').match(/(\d+)\s*(second|minute|hour|day|week|month|year)/i);
  if (!m) return Date.now();
  const u = { second: 1e3, minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[m[2].toLowerCase()] || 864e5;
  return Date.now() - Number(m[1]) * u;
}
async function ytCommentsWeb(videoId, max) {
  const client = { hl: 'en', gl: 'AU', clientName: 'WEB', clientVersion: '2.20250101.00.00' };
  const post = body => socialJson('https://www.youtube.com/youtubei/v1/next?key=' + YT_WEB_KEY + '&prettyPrint=false', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': YT_CONSENT, 'Origin': 'https://www.youtube.com', 'X-Youtube-Client-Name': '1', 'X-Youtube-Client-Version': client.clientVersion }, body: JSON.stringify(Object.assign({ context: { client } }, body)) }, 12000);
  const first = await post({ videoId });
  if (!first.ok || !first.json) return { ok: false, comments: [], detail: first.error || 'no watch payload from the web endpoint' };
  let token = '';
  const secs = []; deepCollect(first.json, 'itemSectionRenderer', secs, 60);
  const cs = secs.find(s => s && s.sectionIdentifier === 'comment-item-section');
  if (cs) { const c0 = ((cs.contents || [])[0] || {}).continuationItemRenderer; token = ((((c0 || {}).continuationEndpoint || {}).continuationCommand) || {}).token || ''; }
  if (!token) { const conts = []; deepCollect(first.json, 'continuationItemRenderer', conts, 60); const c = conts.find(x => /comment/i.test(String(x.targetId || ''))); token = ((((c || {}).continuationEndpoint || {}).continuationCommand) || {}).token || ''; }
  if (!token) return { ok: false, comments: [], detail: 'no comments section (comments off, or the page shape changed)' };
  const second = await post({ continuation: token });
  if (!second.ok || !second.json) return { ok: false, comments: [], detail: second.error || 'no comments payload' };
  const out = [];
  const payloads = []; deepCollect(second.json, 'commentEntityPayload', payloads, 400);
  payloads.forEach(p => {
    const pr = p.properties || {}; const text = String(((pr.content || {}).content) || '').trim(); if (!text) return;
    const tb = p.toolbar || {}; const likes = parseInt(String(tb.likeCountNotliked || tb.likeCountLiked || '0').replace(/[^\d]/g, ''), 10) || 0;
    out.push({ id: String(pr.commentId || arcHash(text)), text, likes, ts: relTime(pr.publishedTime), depth: pr.replyLevel || 0 });
  });
  if (!out.length) {
    const rends = []; deepCollect(second.json, 'commentRenderer', rends, 400);
    rends.forEach(c => { const text = ((c.contentText || {}).runs || []).map(r => r.text).join('').trim(); if (!text) return; out.push({ id: String(c.commentId || arcHash(text)), text, likes: parseInt(String((c.voteCount || {}).simpleText || '0').replace(/[^\d]/g, ''), 10) || 0, ts: relTime((((c.publishedTimeText || {}).runs) || [{}])[0].text), depth: 0 }); });
  }
  return out.length ? { ok: true, comments: out.slice(0, Math.max(max || 100, 1)), via: 'web' } : { ok: false, comments: [], detail: 'the comments payload carried no comment text (shape changed?)' };
}
async function ytComments(env, videoId, max) {
  if (env.YOUTUBE_KEY) { const a = await ytCommentsApi(env, videoId, max); if (a.ok || /comments are off|quota/.test(a.detail)) return a; }
  return ytCommentsWeb(videoId, max);
}
function jsonAfter(text, marker) {
  const i = text.indexOf(marker); if (i < 0) return null;
  const j = text.indexOf('{', i); if (j < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let k = j; k < text.length && k < j + 3000000; k++) {
    const ch = text[k];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true; else if (ch === '{') depth++; else if (ch === '}') { depth--; if (!depth) { try { return JSON.parse(text.slice(j, k + 1)); } catch (e) { return null; } } }
  }
  return null;
}
async function ytPlayer(videoId) {
  const f = await fetchYt('https://www.youtube.com/watch?v=' + encodeURIComponent(videoId) + '&hl=en&gl=AU', 12000);
  const pr = f.ok ? jsonAfter(f.text, 'ytInitialPlayerResponse') : null;
  if (pr && pr.captions) return { ok: true, pr, via: 'watch page' };
  const r = await socialJson('https://www.youtube.com/youtubei/v1/player?key=' + YT_WEB_KEY + '&prettyPrint=false', { method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip', 'X-Youtube-Client-Name': '3', 'X-Youtube-Client-Version': '19.09.37' },
    body: JSON.stringify({ context: { client: { clientName: 'ANDROID', clientVersion: '19.09.37', androidSdkVersion: 30, hl: 'en', gl: 'AU' } }, videoId, contentCheckOk: true, racyCheckOk: true }) }, 12000);
  if (r.ok && r.json && r.json.captions) return { ok: true, pr: r.json, via: 'player endpoint' };
  const st = ((r.json || pr || {}).playabilityStatus) || {};
  return { ok: false, detail: st.reason ? String(st.reason).slice(0, 120) : (pr || (r.json && r.json.videoDetails) ? 'no captions on this video' : (f.error || r.error || 'no player response')) };
}
async function ytTranscript(videoId) {
  const p = await ytPlayer(videoId);
  if (!p.ok) return { ok: false, text: '', detail: p.detail };
  const tracks = ((((p.pr.captions || {}).playerCaptionsTracklistRenderer || {}).captionTracks) || []);
  if (!tracks.length) return { ok: false, text: '', detail: 'no captions on this video' };
  const en = tracks.filter(t => /^en/i.test(t.languageCode || ''));
  const track = en.find(t => t.kind !== 'asr') || en[0] || tracks[0];
  const f = await fetchYt(String(track.baseUrl) + '&fmt=json3', 12000);
  if (!f.ok) return { ok: false, text: '', detail: 'caption track ' + (f.error || ('HTTP ' + f.status)) };
  let text = '';
  try { const d = JSON.parse(f.text); text = (d.events || []).map(e => (e.segs || []).map(s => s.utf8 || '').join('')).join(' ').replace(/\s+/g, ' ').trim(); }
  catch (e) { text = stripHtml(f.text.replace(/<text[^>]*>/g, ' ')); }
  return text.length > 40 ? { ok: true, text: text.slice(0, 20000), lang: track.languageCode || '', asr: track.kind === 'asr', via: p.via } : { ok: false, text: '', detail: 'caption track was empty' };
}
/** Recent videos on file get their comments and captions: the ones that speak
 *  to a client issue first, a few a tick, each video once. */
async function youtubeEnrich(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  if (!(await ensureArchive(env))) return { ok: false, error: 'mind_unbound' };
  const max = Math.min(Math.max(parseInt(opts.max, 10) || 8, 1), 40);
  const now = Date.now();
  const vid = String(opts.video || '').replace(/[^\w-]/g, '').slice(0, 20);
  // from the Signals tab: refresh the listed channels first, then read comments and captions
  if (opts.sweepChannels && !vid) {
    try {
      await ensureSources(env);
      const chans = ((await env.MIND_DB.prepare("SELECT id FROM sources WHERE enabled=1 AND methods LIKE '%\"youtube\"%'").all()).results || []).map(r => r.id);
      if (chans.length) { await log('info', 'refreshing ' + chans.length + ' YouTube channel' + (chans.length === 1 ? '' : 's') + ' from the Source Registry first'); await sourceSweep(env, { ids: chans, log }); }
      else await log('info', 'no YouTube channels in the Source Registry yet - add one in Sources with a handle or channel id');
    } catch (e) { await log('err', 'channel refresh failed: ' + String((e && e.message) || e).slice(0, 120)); }
  }
  const rows = vid
    ? (await env.MIND_DB.prepare("SELECT id, title, url, meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='youtube' AND json_extract(meta,'$.video')=? LIMIT 1").bind(vid).all()).results || []
    : (await env.MIND_DB.prepare("SELECT id, title, url, meta FROM arc_items WHERE kind='sig_thread' AND json_extract(meta,'$.platform')='youtube' AND ts>? AND json_extract(meta,'$.enriched') IS NULL ORDER BY (json_array_length(json_extract(meta,'$.issues'))>0) DESC, ts DESC LIMIT ?").bind(now - 5 * 86400000, max).all()).results || [];
  const out = { ok: true, platform: 'youtube', videos: rows.length, threads: rows.length, comments: 0, threadRows: 0, commentRows: 0, transcripts: 0, hostile: 0, errors: [], via: env.YOUTUBE_KEY ? 'data api' : 'web' };
  if (!rows.length) { await log('info', vid ? 'no video ' + vid + ' on file - sweep its channel first' : 'no recent videos waiting for comments and captions'); if (vid) { out.ok = false; out.detail = 'That video is not on file yet.'; } return out; }
  await log('info', 'YouTube: comments and captions for ' + rows.length + ' video' + (rows.length === 1 ? '' : 's') + ' (' + out.via + ')');
  const stmts = [];
  for (const r of rows) {
    let meta = {}; try { meta = JSON.parse(r.meta || '{}') || {}; } catch (e) { meta = {}; }
    const v = String(meta.video || ''); if (!v) continue;
    const thread = { id: v, title: r.title, url: r.url, issues: Array.isArray(meta.issues) ? meta.issues : [] };
    await log('cmd', (env.YOUTUBE_KEY ? 'GET youtube/v3/commentThreads videoId=' : 'POST youtubei/v1/next videoId=') + v);
    const c = await ytComments(env, v, 100);
    let filed = 0;
    if (c.ok) {
      const crows = c.comments.filter(x => x.text).map(x => engRow(sigCommentRow({ platform: 'youtube', id: x.id, body: x.text, score: x.likes, depth: x.depth, ts: x.ts, via: 'worker' }, thread), x));
      out.comments += crows.length; out.hostile += crows.filter(x => x.tone < 0).length;
      for (let i = 0; i < crows.length; i += 150) filed += await archiveItems(env, 'sig_comment', crows.slice(i, i + 150));
      out.commentRows += filed;
      await log('out', c.comments.length + ' comments via ' + c.via + ', ' + filed + ' new');
    } else { out.errors.push(v + ': ' + c.detail); await log('err', v + ': ' + c.detail); }
    await log('cmd', 'captions ' + v);
    const t = await ytTranscript(v);
    let chars = 0;
    if (t.ok) {
      chars = t.text.length;
      await archiveItems(env, 'transcript', [{ src: 'youtube', title: 'Transcript: ' + String(r.title || '').slice(0, 200), body: t.text.slice(0, 6000), url: 'x:yt:tr:' + v, ts: now, meta: { platform: 'youtube', thread: v, video: v, lang: t.lang, asr: t.asr ? 1 : 0, chars, issues: issueTag(t.text.slice(0, 8000)), via: t.via } }]);
      out.transcripts++;
      await log('out', chars + ' chars of ' + (t.asr ? 'auto-generated' : 'published') + ' captions via ' + t.via);
    } else { await log('err', v + ': ' + t.detail); }
    stmts.push(env.MIND_DB.prepare("UPDATE arc_items SET meta=json_set(COALESCE(meta,'{}'),'$.enriched',1,'$.comments_held',?,'$.transcript',?,'$.comments',?) WHERE id=?").bind(filed, chars, c.ok ? c.comments.length : (meta.comments || 0), r.id));
    await rdSleep(SOCIAL_PACE);
  }
  for (let i = 0; i < stmts.length; i += 50) { try { await env.MIND_DB.batch(stmts.slice(i, i + 50)); } catch (e) {} }
  await log('info', out.commentRows + ' new comments and ' + out.transcripts + ' transcripts filed');
  if (!out.commentRows && !out.transcripts && out.errors.length) { out.ok = false; out.detail = 'Nothing was collected. ' + out.errors[0]; }
  return out;
}

// -- Petitions: the parliaments' e-petition pages, with daily signature counts --
const PETITION_SITES = [
  { id: 'aph', name: 'Parliament of Australia e-petitions', juris: 'au', list: 'https://www.aph.gov.au/e-petitions', link: /\/e-petitions\/petition\/EN\d+/i, base: 'https://www.aph.gov.au' },
  { id: 'vic', name: 'Parliament of Victoria e-petitions', juris: 'vic', list: 'https://www.parliament.vic.gov.au/get-involved/petitions/electronic-petitions', link: /\/get-involved\/petitions\/electronic-petitions\/[a-z0-9][a-z0-9-]+/i, base: 'https://www.parliament.vic.gov.au' },
  { id: 'qld', name: 'Queensland Parliament e-petitions', juris: 'qld', list: 'https://www.parliament.qld.gov.au/Work-of-the-Assembly/Petitions/Current-EPetitions', link: /\/Work-of-the-Assembly\/Petitions\/Petition-Details\?id=\d+/i, base: 'https://www.parliament.qld.gov.au' },
  { id: 'nsw', name: 'NSW Parliament e-petitions', juris: 'nsw', list: 'https://www.parliament.nsw.gov.au/la/Pages/ePetitions-List.aspx', link: /\/la\/Pages\/ePetition-details\.aspx\?q=[A-Za-z0-9%=_-]+/i, base: 'https://www.parliament.nsw.gov.au' },
];
function anchorsMatching(html, re, base) {
  const out = []; const seen = new Set();
  for (const m of String(html).matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]; if (!re.test(href)) continue;
    const title = stripHtml(m[2]); if (title.length < 8) continue;
    let url; try { url = new URL(href, base).toString(); } catch (e) { continue; }
    if (seen.has(url)) continue; seen.add(url);
    out.push({ url, title });
  }
  return out;
}
function petitionCount(html) {
  const s = stripHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi, ' '));
  const m = s.match(/(?:signatures?|signed|supporters?)[^0-9]{0,40}(\d[\d,\.]{0,9})/i) || s.match(/(\d[\d,\.]{0,9})\s*(?:signatures?|people have signed|supporters?)/i);
  return m ? (parseInt(m[1].replace(/[^\d]/g, ''), 10) || 0) : 0;
}
function petitionCloses(html) {
  const s = stripHtml(String(html));
  const m = s.match(/(?:clos(?:es|ing)(?: date)?|open until|until)[^0-9A-Za-z]{0,20}(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  return m ? m[1] : '';
}
async function petitionsSweep(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  if (!(await ensureArchive(env))) return { ok: false, error: 'mind_unbound' };
  const detailMax = Math.min(Math.max(parseInt(opts.detail, 10) || 12, 1), 40);
  const sites = PETITION_SITES.filter(s => !opts.site || s.id === opts.site);
  const day = new Date().toISOString().slice(0, 10); const now = Date.now();
  const out = { ok: true, platform: 'petitions', sites: sites.length, listed: 0, read: 0, threads: 0, comments: 0, threadRows: 0, commentRows: 0, rows: 0, snapshots: 0, errors: [] };
  const canon = [], snaps = [], upd = [];
  for (const site of sites) {
    await log('cmd', 'GET ' + site.list);
    const f = await srcFetch(site.list, 'text/html,*/*', 9000);
    if (!f.ok) { out.errors.push(site.id + ': ' + (f.error || ('HTTP ' + f.status))); await log('err', site.id + ': ' + (f.error || ('HTTP ' + f.status))); continue; }
    const links = anchorsMatching(f.text, site.link, site.base);
    out.listed += links.length;
    await log('out', links.length + ' petitions listed');
    if (!links.length) { out.errors.push(site.id + ': no petition links on the page (markup changed?)'); continue; }
    const ranked = links.map(l => Object.assign({ issues: issueTag(l.title) }, l)).sort((a, b) => b.issues.length - a.issues.length).slice(0, detailMax);
    for (const l of ranked) {
      const g = await srcFetch(l.url, 'text/html,*/*', 9000);
      if (!g.ok) { out.errors.push(l.url.slice(0, 80) + ': ' + (g.error || ('HTTP ' + g.status))); await rdSleep(SOCIAL_PACE); continue; }
      out.read++;
      const text = paragraphs(g.text.replace(/<(nav|header|footer|script|style)\b[\s\S]*?<\/\1>/gi, ' ')).slice(0, 3000);
      const sigs = petitionCount(g.text); const closes = petitionCloses(g.text);
      const issues = issueTag(l.title + ' ' + text);
      canon.push({ src: site.id, title: l.title.slice(0, 300), body: text, url: l.url, ts: now, tone: 0, meta: { platform: 'petitions', site: site.id, juris: site.juris, issues, signatures: sigs, closes, seen: now, day } });
      snaps.push({ src: site.id, title: l.title.slice(0, 300), body: '', url: 'x:pet:' + arcHash(l.url) + ':' + day, ts: now, meta: { platform: 'petitions', site: site.id, juris: site.juris, petition: l.url, signatures: sigs, issues, day } });
      upd.push(env.MIND_DB.prepare("UPDATE arc_items SET meta=json_set(COALESCE(meta,'{}'),'$.signatures',?,'$.seen',?,'$.closes',?) WHERE kind='petition' AND url=?").bind(sigs, now, closes, l.url));
      await log('out', (sigs ? sigs + ' signatures' : 'count not shown') + (issues.length ? ' [' + issues.join(', ') + ']' : '') + ' - ' + l.title.slice(0, 70));
      await rdSleep(SOCIAL_PACE);
    }
  }
  for (let i = 0; i < canon.length; i += 150) out.rows += await archiveItems(env, 'petition', canon.slice(i, i + 150));
  for (let i = 0; i < snaps.length; i += 150) out.snapshots += await archiveItems(env, 'petition', snaps.slice(i, i + 150));
  for (let i = 0; i < upd.length; i += 50) { try { await env.MIND_DB.batch(upd.slice(i, i + 50)); } catch (e) {} }
  out.threads = canon.length; out.threadRows = out.rows;
  await log('info', out.read + ' petitions read, ' + out.rows + ' new, ' + out.snapshots + ' signature snapshots for ' + day);
  if (!out.read && out.errors.length) { out.ok = false; out.detail = 'Nothing was read. ' + out.errors[0]; }
  return out;
}
async function petitionsList(env, opts) {
  opts = opts || {};
  if (!(await ensureArchive(env))) return { ok: false, error: 'mind_unbound' };
  const days = Math.min(Math.max(parseInt(opts.days, 10) || 30, 1), 365);
  const now = Date.now();
  const w = ["kind='petition'", "url NOT LIKE 'x:pet:%'", "COALESCE(json_extract(meta,'$.seen'), ts)>?"]; const b = [now - days * 86400000];
  if (opts.juris) { w.push("json_extract(meta,'$.juris')=?"); b.push(String(opts.juris).slice(0, 4)); }
  if (opts.issue) { w.push('meta LIKE ?'); b.push('%"' + String(opts.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
  const rows = (await env.MIND_DB.prepare('SELECT title, url, body, ts, meta FROM arc_items WHERE ' + w.join(' AND ') + ' ORDER BY ts DESC LIMIT 300').bind(...b).all()).results || [];
  const snaps = (await env.MIND_DB.prepare("SELECT json_extract(meta,'$.petition') p, json_extract(meta,'$.signatures') s, json_extract(meta,'$.day') d FROM arc_items WHERE kind='petition' AND url LIKE 'x:pet:%' AND ts>? ORDER BY ts").bind(now - 9 * 86400000).all()).results || [];
  const hist = {}; snaps.forEach(s => { if (!s.p) return; (hist[s.p] = hist[s.p] || []).push({ d: s.d, s: Number(s.s) || 0 }); });
  const dayKey = ago => new Date(now - ago * 86400000).toISOString().slice(0, 10);
  const at = (h, key) => { const x = (h || []).filter(e => e.d <= key).pop(); return x ? x.s : null; };
  const list = rows.map(r => {
    let m = {}; try { m = JSON.parse(r.meta || '{}') || {}; } catch (e) { m = {}; }
    const h = hist[r.url] || []; const sigs = Number(m.signatures) || 0;
    const y = at(h, dayKey(1)), wk = at(h, dayKey(7));
    return { title: r.title, url: r.url, site: m.site || '', juris: m.juris || '', issues: Array.isArray(m.issues) ? m.issues : [], signatures: sigs, closes: m.closes || '', seen: m.seen || r.ts, first: r.ts,
      growth24: y == null ? null : sigs - y, growth7: wk == null ? null : sigs - wk, excerpt: String(r.body || '').slice(0, 300), points: h.slice(-10) };
  }).sort((a, b) => ((b.growth24 || 0) - (a.growth24 || 0)) || (b.signatures - a.signatures));
  return { ok: true, days, petitions: list, sites: PETITION_SITES.map(s => ({ id: s.id, name: s.name, juris: s.juris, url: s.list })) };
}

// -- Substack: a publication's feed and comment threads (a Source Registry method) --
async function srcSubstack(env, src) {
  const base = String(src.urls.substack || '').replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return { ok: false, items: [], detail: 'substack needs the publication url, e.g. https://name.substack.com' };
  const f = await srcFetch(base + '/feed', 'application/rss+xml,application/xml,text/xml,*/*');
  if (!f.ok) return srcFail(f);
  const posts = parseFeedXml(f.text);
  if (!posts.length) return { ok: false, items: [], status: f.status, detail: 'the publication feed had no posts' };
  const now = Date.now(); const cut = now - SOURCE_WINDOW_H * 3600000;
  const recent = posts.filter(p => { const t = Date.parse(p.date || ''); return p.link && (!t || t >= cut); });
  const rows = recent.map(p => { const th = { platform: 'substack', id: 's' + arcHash(p.link), title: p.title, body: p.desc, page: base.replace(/^https?:\/\//, ''), page_name: src.name, score: 0, comments: 0, url: p.link, ts: Date.parse(p.date || '') || now, via: 'worker' }; const row = sigThreadRow(th); row.meta.source = src.id; row.meta.reg = 1; return row; });
  const extra = [];
  for (const p of recent.slice(0, 4)) {
    const slug = (String(p.link).match(/\/p\/([^/?#]+)/) || [])[1]; if (!slug) continue;
    const meta = await socialJson(base + '/api/v1/posts/' + encodeURIComponent(slug), null, 8000);
    const pid = meta.ok && meta.json ? meta.json.id : 0; if (!pid) { await rdSleep(SOCIAL_PACE); continue; }
    const cm = await socialJson(base + '/api/v1/post/' + pid + '/comments?token=&all_comments=true&sort=best_first', null, 9000);
    const flat = [];
    const walk = (arr, d) => (arr || []).forEach(c => { if (!c) return; if (c.body) flat.push({ id: String(c.id || ''), text: stripHtml(String(c.body)), likes: (c.reactions && c.reactions['\u2764']) || c.reaction_count || 0, ts: Date.parse(c.date || '') || now, depth: d }); walk(c.children, d + 1); });
    if (cm.ok && cm.json) walk(cm.json.comments || [], 0);
    const thread = { id: 's' + arcHash(p.link), title: p.title, url: p.link, issues: issueTag(p.title + ' ' + p.desc) };
    const crows = flat.filter(c => c.text).map(c => engRow(sigCommentRow({ platform: 'substack', id: c.id, body: c.text, score: c.likes, depth: c.depth, ts: c.ts, via: 'worker' }, thread), c));
    if (crows.length) extra.push({ kind: 'sig_comment', rows: crows });
    const row = rows.find(r => r.url === p.link); if (row) row.meta.comments = flat.length;
    await rdSleep(SOCIAL_PACE);
  }
  return { ok: true, items: recent.map(p => ({ title: p.title, link: p.link, date: p.date, desc: p.desc })), status: f.status, kind: 'sig_thread', rows, extra };
}
async function substackSearch(q) {
  const r = await socialJson('https://substack.com/api/v1/publication/search?query=' + encodeURIComponent(q) + '&page=0');
  if (!r.ok) return { ok: false, results: [], detail: r.error };
  const arr = (r.json && (r.json.results || r.json.publications)) || (Array.isArray(r.json) ? r.json : []);
  return { ok: true, results: arr.slice(0, 25).map(p => ({ name: String(p.name || '').slice(0, 120), url: p.custom_domain ? 'https://' + p.custom_domain : (p.subdomain ? 'https://' + p.subdomain + '.substack.com' : ''), description: String(p.hero_text || p.description || '').slice(0, 240), subscribers: p.subscriber_count_string || p.subscriber_count || '' })).filter(p => p.url) };
}
async function tiktokOembed(url) {
  if (!/^https?:\/\/(www\.|vm\.)?tiktok\.com\//.test(String(url || ''))) return { ok: false, detail: 'give a tiktok.com post url' };
  const r = await socialJson('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url));
  if (!r.ok || !r.json) return { ok: false, detail: r.error || 'no oEmbed payload' };
  return { ok: true, url, title: String(r.json.title || '').slice(0, 500), thumbnail: r.json.thumbnail_url || '', provider: 'tiktok' };
}

// -- one table: what each platform needs, what it reaches, how it fared --------
async function socialCoverage(env, probe) {
  const now = Date.now(); const db = env.MIND_DB;
  const counts = {};
  if (db) {
    try {
      await ensureArchive(env);
      const rows = (await db.prepare("SELECT COALESCE(json_extract(meta,'$.platform'), src) p, kind, SUM(ts>?) d1, COUNT(*) d7, MAX(ts) newest FROM arc_items WHERE ts>? AND kind IN ('sig_thread','sig_comment','petition','transcript','reddit_thread','reddit_comment','forum','oppads') GROUP BY p, kind").bind(now - 86400000, now - 7 * 86400000).all()).results || [];
      rows.forEach(r => {
        const p = /^reddit_/.test(r.kind) ? 'reddit' : r.kind === 'forum' ? 'forums' : r.kind === 'oppads' ? 'adlibrary' : (r.p || 'unknown');
        const c = counts[p] = counts[p] || { threads24: 0, threads7: 0, comments24: 0, comments7: 0, newest: 0 };
        const isC = /comment/.test(r.kind);
        if (isC) { c.comments24 += r.d1 || 0; c.comments7 += r.d7 || 0; } else { c.threads24 += r.d1 || 0; c.threads7 += r.d7 || 0; }
        c.newest = Math.max(c.newest, r.newest || 0);
      });
    } catch (e) {}
  }
  let last = {}; try { last = JSON.parse((await kvGet(env.AXIOM_KV, 'social_last')) || '{}'); } catch (e) { last = {}; }
  const agents = await agentsSeen(env);
  const mac = agents.some(a => a.live);
  const P = [
    { id: 'reddit', label: 'Reddit', method: 'JSON API with app credentials from the worker, or rdt on a signed-in Mac', keys: 'REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET (optional; registration is closed)', configured: redditAuthed(env) || mac, where: redditAuthed(env) ? 'worker' : 'mac', reach: 'watched subs, keyword search across Reddit, full comment trees, scores', unreachable: '' },
    { id: 'bluesky', label: 'Bluesky', method: 'public AppView API (searchPosts, getPostThread)', keys: 'none', configured: true, where: 'worker', reach: 'keyword search, threads, replies, likes/reposts/quotes; the Australian gate applies', unreachable: '' },
    { id: 'mastodon', label: 'Mastodon', method: 'tag timelines and reply contexts on ' + MASTO_INSTANCES.join(', '), keys: 'none', configured: true, where: 'worker', reach: 'the Australian political tags (' + MASTO_TAGS.slice(0, 5).join(', ') + '...), replies, favourites/boosts', unreachable: 'full-text search needs an instance token' },
    { id: 'x', label: 'X', method: 'account timelines through X\'s embed service from the worker; keyword search and replies through twitter-cli on a signed-in Mac', keys: 'none for timelines; a signed-in Mac for search', configured: true, where: 'both', reach: 'MP register and watch-list timelines with likes/reposts/replies counts; search and reply threads from the Mac', unreachable: 'keyword search and reply text from the cloud (X requires a session and a transaction id)' },
    { id: 'youtube', label: 'YouTube', method: 'channel feeds as Source Registry sources; comments through the Data API or YouTube\'s web endpoint; captions', keys: 'YOUTUBE_KEY optional (free, 10,000 units a day)', configured: true, apiKey: !!env.YOUTUBE_KEY, where: 'worker', reach: 'every video of a listed channel, its comments with likes, its captions as a transcript', unreachable: 'keyword search without YOUTUBE_KEY' },
    { id: 'linkedin', label: 'LinkedIn', method: 'the clients\' own pages through the Marketing API', keys: 'LINKEDIN_TOKEN + LINKEDIN_ORGS', configured: !!(env.LINKEDIN_TOKEN && liOrgs(env).length), where: 'worker', reach: 'own posts and comments', unreachable: 'other pages, search: no public route and none is wanted' },
    { id: 'meta', label: 'Facebook and Instagram, own pages', method: 'Graph API', keys: 'META_TOKEN (pages_read_engagement, pages_read_user_content) + META_PAGES', configured: !!(env.META_TOKEN && metaPages(env).length), where: 'worker', reach: 'own posts, comments and reaction mix', unreachable: '' },
    { id: 'adlibrary', label: 'Meta Ad Library', method: 'Graph API ads_archive', keys: 'META_USER_TOKEN (ID-verified user, ~60-day expiry)', configured: !!env.META_USER_TOKEN, where: 'worker', reach: 'political and issue ads by funder, spend band and creative', unreachable: '' },
    { id: 'facebook_public', label: 'Facebook public pages and groups (others\')', method: 'none available', keys: 'Page Public Content Access (Meta app review) or Meta Content Library (research application)', configured: false, where: 'none', reach: '', unreachable: 'the Graph API refuses other pages without PPCA; the web is login-walled from any server. Ask for PPCA on the Meta app, or apply for the Content Library.' },
    { id: 'threads', label: 'Threads', method: 'none available', keys: 'Threads API is for the account\'s own posts; keyword search needs the threads_keyword_search permission (app review)', configured: false, where: 'none', reach: '', unreachable: 'no public route to others\' posts; the web pages are built client-side behind a login prompt' },
    { id: 'tiktok', label: 'TikTok', method: 'oEmbed for a single post url', keys: 'none; the Research API needs approval', configured: true, where: 'worker', reach: 'title and thumbnail of a given post', unreachable: 'profiles, search and comments: signed requests from a browser session (a Mac render job could read a profile; the Research API is approval-gated)' },
    { id: 'forums', label: 'Forums', method: 'RSS, Discourse JSON and listing pages (AU_FORUMS)', keys: 'none', configured: true, where: 'worker', reach: 'new threads on Whirlpool, OzBargain, BigFooty, HotCopper, PropertyChat and Discourse boards', unreachable: 'reply text on most boards' },
    { id: 'petitions', label: 'Petitions', method: 'the parliaments\' e-petition pages, daily', keys: 'none', configured: true, where: 'worker', reach: PETITION_SITES.map(s => s.name).join(', ') + ': title, text, signatures a day, closing date', unreachable: 'change.org (bot-walled from servers; add a petition url as a source to try)' },
    { id: 'substack', label: 'Substack', method: 'publication feed plus the comments API, as Source Registry sources (urls.substack)', keys: 'none', configured: true, where: 'worker', reach: 'posts and comment threads of any listed publication; discovery through /social/substack/search', unreachable: '' },
  ];
  P.forEach(p => { p.counts = counts[p.id] || { threads24: 0, threads7: 0, comments24: 0, comments7: 0, newest: 0 }; p.last = last[p.id] || null; });
  if (probe) {
    const t = async (fn) => { const t0 = Date.now(); try { const r = await fn(); return Object.assign({ ms: Date.now() - t0 }, r); } catch (e) { return { ok: false, ms: Date.now() - t0, detail: String((e && e.message) || e).slice(0, 120) }; } };
    const probes = {
      bluesky: () => bskySearch('auspol', 3).then(r => ({ ok: r.ok, detail: r.ok ? r.posts.length + ' posts for auspol' : r.detail })),
      mastodon: () => mastoTag(MASTO_INSTANCES[0], 'auspol', 5).then(r => ({ ok: r.ok, detail: r.ok ? r.posts.length + ' posts on ' + MASTO_INSTANCES[0] : r.detail })),
      x: () => xTimeline('AlboMP').then(r => ({ ok: r.ok, detail: r.ok ? r.tweets.length + ' posts in the embed timeline of the PM\'s account' : r.detail })),
      youtube: () => ytChannelId(env, '@abcnewsaustralia').then(r => ({ ok: r.ok, detail: r.ok ? 'channel resolves to ' + r.id : r.detail })),
      petitions: () => srcFetch(PETITION_SITES[0].list, 'text/html,*/*', 9000).then(f => ({ ok: f.ok && anchorsMatching(f.text, PETITION_SITES[0].link, PETITION_SITES[0].base).length > 0, detail: f.ok ? anchorsMatching(f.text, PETITION_SITES[0].link, PETITION_SITES[0].base).length + ' petitions listed at aph.gov.au' : (f.error || ('HTTP ' + f.status)) })),
      substack: () => substackSearch('australian politics').then(r => ({ ok: r.ok, detail: r.ok ? r.results.length + ' publications match "australian politics"' : r.detail })),
    };
    for (const p of P) if (probes[p.id]) p.probe = await t(probes[p.id]);
  }
  return { ok: true, platforms: P, agents, lastRun: Number(await kvGet(env.AXIOM_KV, 'social_last_run') || 0), mac };
}
async function socialSweep(env, params, log) {
  const p = Object.assign({}, params || {}, { log });
  switch (String(p.platform || '')) {
    case 'bluesky': return bskySweep(env, p);
    case 'mastodon': return mastodonSweep(env, p);
    case 'youtube': return youtubeEnrich(env, p);
    case 'petitions': return petitionsSweep(env, p);
    case 'x': return xSyndSweep(env, p);
    default: return { ok: false, error: 'unknown_platform', detail: 'platform must be one of bluesky, mastodon, youtube, petitions, x.' };
  }
}
function socialSummary(r) {
  r = r || {};
  const s = { ok: !!r.ok, threads: r.threads || 0, comments: r.comments || 0, threadRows: r.threadRows || 0, commentRows: r.commentRows || 0, errors: (r.errors || []).length, detail: String(r.detail || (r.errors || [])[0] || '').slice(0, 160) };
  if (r.read != null) { s.listed = r.listed; s.read = r.read; s.snapshots = r.snapshots; }
  if (r.videos != null) { s.videos = r.videos; s.transcripts = r.transcripts; }
  if (r.accounts != null) { s.accounts = r.accounts; }
  return s;
}
/** Every tick, at most two-hourly: a slice of the client keywords on Bluesky,
 *  the Australian tags on Mastodon, thirty X account timelines, comments and
 *  captions for a few videos, and the petitions once a day. */
async function socialCron(env) {
  if (!env.MIND_DB) return { ok: false };
  const now = Date.now();
  const last = Number(await kvGet(env.AXIOM_KV, 'social_last_run') || 0);
  if (now - last < 2 * 3600000) return { ok: true, skipped: true };
  await kvPut(env.AXIOM_KV, 'social_last_run', String(now), 86400);
  let res = {}; try { res = JSON.parse((await kvGet(env.AXIOM_KV, 'social_last')) || '{}'); } catch (e) { res = {}; }
  const run = async (id, fn) => { try { res[id] = Object.assign({ at: now }, socialSummary(await fn())); } catch (e) { res[id] = { at: now, ok: false, detail: String((e && e.message) || e).slice(0, 160) }; } };
  const all = issueQueries(); const slice = 10;
  const cur = Number(await kvGet(env.AXIOM_KV, 'bsky_q_cursor') || 0) % Math.max(1, all.length);
  const qs = all.slice(cur, cur + slice).concat(cur + slice > all.length ? all.slice(0, cur + slice - all.length) : []);
  await kvPut(env.AXIOM_KV, 'bsky_q_cursor', String((cur + slice) % Math.max(1, all.length)), 7 * 86400);
  await run('bluesky', () => bskySweep(env, { queries: qs, threads: 15, days: 3 }));
  await run('mastodon', () => mastodonSweep(env, { threads: 15, days: 3 }));
  await run('x', () => xSyndSweep(env, { max: 30, days: 3 }));
  await run('youtube', () => youtubeEnrich(env, { max: 6 }));
  const pl = Number(await kvGet(env.AXIOM_KV, 'petitions_last') || 0);
  if (now - pl > 20 * 3600000) { await kvPut(env.AXIOM_KV, 'petitions_last', String(now), 7 * 86400); await run('petitions', () => petitionsSweep(env, { detail: 10 })); }
  await kvPut(env.AXIOM_KV, 'social_last', JSON.stringify(res).slice(0, 8000), 7 * 86400);
  return res;
}

// ==============================================================================
// SENTIMENT - who is being talked about, how, where and on which channel. An
// editable register of entities (parties, people, organisations, topics) with
// the aliases they go by; a cheap first pass that finds the rows mentioning
// one; then Claude, in batches, judging the author's stance toward each
// entity mentioned (critical / neutral / supportive, with intensity, sarcasm
// and the phrase that decided it) and the text's overall tone. Every score
// in the view is a sum over rows in sent_entities, and every row points at
// the archive item it came from. Spend is capped per day.
// ==============================================================================
let SENT_READY = false;
const SENT_KINDS = ['news', 'sig_thread', 'sig_comment', 'reddit_thread', 'reddit_comment', 'comments', 'forum', 'transcript'];
const SENT_PER_TICK = 80;      // rows classified per cron tick
const SENT_BATCH = 20;         // texts per Claude call
const SENT_SCAN = 400;         // newest unclassified rows looked at per run
const SENT_WINDOW_H = 72;      // rows older than this are left alone
const SENT_MODEL = 'claude-sonnet-4-6';   // the operator's choice: finer judgement; SENTIMENT_MODEL overrides (claude-haiku-4-5-20251001 is about a tenth of the price)
const SENT_DAILY_CALLS = 300;  // Claude calls a day unless SENTIMENT_DAILY_CALLS says otherwise
const ENTITY_KINDS = ['party', 'person', 'org', 'topic'];
const ENTITY_SIDES = ['client', 'opponent', 'neutral'];
/* [id, kind, name, aliases (pipe-separated, plain words; plurals are implied), party, role, side, client ns].
 * Roles are as at 2025 and are meant to be edited in the view. */
const ENTITY_SEED = [
  // parties
  ['alp', 'party', 'Australian Labor Party', 'Labor|ALP|Labor Party|Labor government|Albanese government|federal Labor', 'alp', 'Government', 'neutral', ''],
  ['lib', 'party', 'Liberal Party of Australia', 'Liberal Party|Liberals|the Libs|Liberal opposition', 'lib', 'Opposition (Coalition)', 'neutral', ''],
  ['nat', 'party', 'The Nationals', 'Nationals|National Party|the Nats|Nationals party', 'nat', 'Opposition (Coalition)', 'neutral', ''],
  ['coalition', 'party', 'The Coalition', 'the Coalition|Coalition opposition|federal opposition|Liberal-National Coalition', 'coalition', 'Opposition', 'neutral', ''],
  ['grn', 'party', 'Australian Greens', 'the Greens|Australian Greens|Greens party|Greens senator|Greens MP', 'grn', 'Crossbench', 'neutral', ''],
  ['on', 'party', 'One Nation', 'One Nation|PHON', 'on', 'Crossbench', 'neutral', ''],
  ['teal', 'party', 'Teal independents', 'teals|teal independents|teal MPs|Climate 200 independents|community independents', 'ind', 'Crossbench', 'neutral', ''],
  ['vicnats', 'party', 'The Nationals Victoria', 'Victorian Nationals|Nationals Victoria|Vic Nats|Victorian National Party', 'nat', 'Victorian opposition (Coalition)', 'client', 'vicnats'],
  ['viclib', 'party', 'Liberal Victoria', 'Victorian Liberals|Vic Libs|Victorian Liberal Party|Victorian opposition', 'lib', 'Victorian opposition', 'neutral', ''],
  ['viclabor', 'party', 'Victorian Labor', 'Victorian Labor|Allan government|Victorian government|Andrews government', 'alp', 'Victorian government', 'neutral', ''],
  // federal leaders and ministers
  ['albanese', 'person', 'Anthony Albanese', 'Albanese|Albo|Prime Minister Albanese|the Prime Minister|the PM', 'alp', 'Prime Minister', 'neutral', ''],
  ['chalmers', 'person', 'Jim Chalmers', 'Chalmers|the Treasurer|Treasurer Chalmers', 'alp', 'Treasurer', 'neutral', ''],
  ['ley', 'person', 'Sussan Ley', 'Sussan Ley|Ms Ley|the Opposition Leader|Opposition Leader Ley', 'lib', 'Leader of the Opposition', 'neutral', ''],
  ['littleproud', 'person', 'David Littleproud', 'Littleproud', 'nat', 'Leader of the Nationals', 'neutral', ''],
  ['waters', 'person', 'Larissa Waters', 'Larissa Waters|Senator Waters|Greens leader Waters', 'grn', 'Leader of the Greens', 'neutral', ''],
  ['hanson', 'person', 'Pauline Hanson', 'Pauline Hanson|Hanson|Senator Hanson', 'on', 'Leader of One Nation', 'neutral', ''],
  ['marles', 'person', 'Richard Marles', 'Marles|the Deputy Prime Minister|the Defence Minister', 'alp', 'Deputy Prime Minister, Defence', 'neutral', ''],
  ['wong', 'person', 'Penny Wong', 'Penny Wong|Senator Wong|the Foreign Minister', 'alp', 'Foreign Affairs', 'neutral', ''],
  ['gallagher', 'person', 'Katy Gallagher', 'Katy Gallagher|Senator Gallagher|the Finance Minister', 'alp', 'Finance', 'neutral', ''],
  ['bowen', 'person', 'Chris Bowen', 'Chris Bowen|Minister Bowen|the Energy Minister|the Climate Change Minister', 'alp', 'Climate Change and Energy', 'neutral', ''],
  ['king', 'person', 'Madeleine King', 'Madeleine King|Minister King|the Resources Minister', 'alp', 'Resources and Northern Australia', 'neutral', ''],
  ['butler', 'person', 'Mark Butler', 'Mark Butler|Minister Butler|the Health Minister', 'alp', 'Health and Ageing', 'neutral', ''],
  ['oneil', 'person', 'Clare O\'Neil', 'Clare O\'Neil|Minister O\'Neil|the Housing Minister', 'alp', 'Housing', 'neutral', ''],
  ['rishworth', 'person', 'Amanda Rishworth', 'Rishworth|the Workplace Relations Minister|the Employment Minister', 'alp', 'Employment and Workplace Relations', 'neutral', ''],
  ['watt', 'person', 'Murray Watt', 'Murray Watt|Minister Watt|the Environment Minister', 'alp', 'Environment and Water', 'neutral', ''],
  ['plibersek', 'person', 'Tanya Plibersek', 'Plibersek', 'alp', 'Social Services', 'neutral', ''],
  ['burke', 'person', 'Tony Burke', 'Tony Burke|the Home Affairs Minister', 'alp', 'Home Affairs', 'neutral', ''],
  ['obrien_ted', 'person', 'Ted O\'Brien', 'Ted O\'Brien|the Shadow Treasurer', 'lib', 'Deputy Liberal leader, Shadow Treasurer', 'neutral', ''],
  ['taylor', 'person', 'Angus Taylor', 'Angus Taylor', 'lib', 'Shadow Defence', 'neutral', ''],
  ['tehan', 'person', 'Dan Tehan', 'Dan Tehan|Tehan', 'lib', 'Shadow Energy', 'neutral', ''],
  ['mcdonald', 'person', 'Susan McDonald', 'Susan McDonald|Senator McDonald', 'nat', 'Shadow Resources', 'neutral', ''],
  ['bragg', 'person', 'Andrew Bragg', 'Andrew Bragg|Senator Bragg', 'lib', 'Shadow Housing', 'neutral', ''],
  ['ruston', 'person', 'Anne Ruston', 'Anne Ruston|Senator Ruston', 'lib', 'Shadow Health', 'neutral', ''],
  ['katter', 'person', 'Bob Katter', 'Bob Katter|Katter', 'ind', 'Member for Kennedy', 'neutral', ''],
  ['lambie', 'person', 'Jacqui Lambie', 'Jacqui Lambie|Lambie', 'ind', 'Senator for Tasmania', 'neutral', ''],
  ['pocock', 'person', 'David Pocock', 'David Pocock|Pocock|Senator Pocock', 'ind', 'Senator for the ACT', 'neutral', ''],
  // premiers, chief ministers, state leaders
  ['minns', 'person', 'Chris Minns', 'Minns|Premier Minns|the NSW Premier', 'alp', 'Premier of New South Wales', 'neutral', ''],
  ['allan', 'person', 'Jacinta Allan', 'Jacinta Allan|Premier Allan|the Victorian Premier', 'alp', 'Premier of Victoria', 'neutral', ''],
  ['crisafulli', 'person', 'David Crisafulli', 'Crisafulli|Premier Crisafulli|the Queensland Premier', 'lib', 'Premier of Queensland', 'neutral', ''],
  ['cook', 'person', 'Roger Cook', 'Roger Cook|Premier Cook|the WA Premier', 'alp', 'Premier of Western Australia', 'neutral', ''],
  ['malinauskas', 'person', 'Peter Malinauskas', 'Malinauskas|Premier Malinauskas|the SA Premier', 'alp', 'Premier of South Australia', 'neutral', ''],
  ['rockliff', 'person', 'Jeremy Rockliff', 'Rockliff|Premier Rockliff|the Tasmanian Premier', 'lib', 'Premier of Tasmania', 'neutral', ''],
  ['finocchiaro', 'person', 'Lia Finocchiaro', 'Finocchiaro|the NT Chief Minister', 'lib', 'Chief Minister of the Northern Territory', 'neutral', ''],
  ['barr', 'person', 'Andrew Barr', 'Andrew Barr|Chief Minister Barr|the ACT Chief Minister', 'alp', 'Chief Minister of the ACT', 'neutral', ''],
  ['battin', 'person', 'Brad Battin', 'Brad Battin|Battin', 'lib', 'Leader of the Victorian Opposition', 'neutral', ''],
  ['dobrien', 'person', 'Danny O\'Brien', 'Danny O\'Brien', 'nat', 'Leader of the Victorian Nationals', 'client', 'vicnats'],
  ['bullock', 'person', 'Michele Bullock', 'Michele Bullock|Governor Bullock|the RBA Governor|the Reserve Bank Governor', '', 'Governor of the Reserve Bank', 'neutral', ''],
  // the clients and their people
  ['mca', 'org', 'Minerals Council of Australia', 'Minerals Council|MCA', '', 'Peak body, mining', 'client', 'mca'],
  ['constable', 'person', 'Tania Constable', 'Tania Constable', '', 'CEO, Minerals Council of Australia', 'client', 'mca'],
  ['hoof', 'org', 'Hands Off Our Fuel', 'Hands Off Our Fuel|HOOF|Fuel Tax Credit Alliance', '', 'Campaign', 'client', 'mca'],
  ['aep', 'org', 'Australian Energy Producers', 'Australian Energy Producers|AEP|APPEA', '', 'Peak body, oil and gas', 'client', 'aep'],
  ['mcculloch', 'person', 'Samantha McCulloch', 'Samantha McCulloch', '', 'CEO, Australian Energy Producers', 'client', 'aep'],
  ['pca', 'org', 'Property Council of Australia', 'Property Council', '', 'Peak body, property', 'client', 'pca'],
  ['zorbas', 'person', 'Mike Zorbas', 'Mike Zorbas|Zorbas', '', 'CEO, Property Council of Australia', 'client', 'pca'],
  ['mba', 'org', 'Master Builders Australia', 'Master Builders', '', 'Peak body, building and construction', 'client', 'mba'],
  ['wawn', 'person', 'Denita Wawn', 'Denita Wawn|Wawn', '', 'CEO, Master Builders Australia', 'client', 'mba'],
  ['guild', 'org', 'Pharmacy Guild of Australia', 'Pharmacy Guild|the Guild', '', 'Peak body, community pharmacy', 'client', 'pharm'],
  ['twomey', 'person', 'Trent Twomey', 'Trent Twomey|Twomey', '', 'National President, Pharmacy Guild', 'client', 'pharm'],
  // the other side
  ['lockthegate', 'org', 'Lock the Gate Alliance', 'Lock the Gate', '', 'Anti-mining and anti-gas campaign', 'opponent', 'mca'],
  ['risingtide', 'org', 'Rising Tide', 'Rising Tide', '', 'Climate protest group (Newcastle coal port blockades)', 'opponent', 'mca'],
  ['marketforces', 'org', 'Market Forces', 'Market Forces', '', 'Divestment campaign', 'opponent', 'aep'],
  ['acf', 'org', 'Australian Conservation Foundation', 'Australian Conservation Foundation|ACF', '', 'Environment group', 'opponent', ''],
  ['climatecouncil', 'org', 'Climate Council', 'Climate Council', '', 'Climate advocacy', 'opponent', 'aep'],
  ['greenpeace', 'org', 'Greenpeace Australia Pacific', 'Greenpeace', '', 'Environment group', 'opponent', ''],
  ['getup', 'org', 'GetUp', 'GetUp', '', 'Campaign organisation', 'opponent', ''],
  ['tai', 'org', 'The Australia Institute', 'Australia Institute', '', 'Progressive think tank', 'opponent', ''],
  ['edo', 'org', 'Environmental Defenders Office', 'Environmental Defenders Office|EDO', '', 'Environmental law centre', 'opponent', ''],
  ['extinctionrebellion', 'org', 'Extinction Rebellion', 'Extinction Rebellion', '', 'Protest group', 'opponent', ''],
  ['blockade', 'org', 'Blockade Australia', 'Blockade Australia', '', 'Protest group', 'opponent', ''],
  ['cfmeu', 'org', 'CFMEU', 'CFMEU|construction union', '', 'Construction union', 'opponent', 'mba'],
  ['chemistwarehouse', 'org', 'Chemist Warehouse', 'Chemist Warehouse', '', 'Discount pharmacy chain', 'opponent', 'pharm'],
  // institutions and industry
  ['actu', 'org', 'ACTU', 'ACTU|Australian Council of Trade Unions', '', 'Union peak body', 'neutral', ''],
  ['bca', 'org', 'Business Council of Australia', 'Business Council|BCA', '', 'Business peak body', 'neutral', ''],
  ['grattan', 'org', 'Grattan Institute', 'Grattan Institute|Grattan', '', 'Think tank', 'neutral', ''],
  ['rba', 'org', 'Reserve Bank of Australia', 'Reserve Bank|RBA', '', 'Central bank', 'neutral', ''],
  ['accc', 'org', 'ACCC', 'ACCC|the competition watchdog', '', 'Regulator', 'neutral', ''],
  ['aemo', 'org', 'AEMO', 'AEMO|Australian Energy Market Operator', '', 'Energy market operator', 'neutral', ''],
  ['woodside', 'org', 'Woodside', 'Woodside|Woodside Energy', '', 'Gas producer', 'neutral', 'aep'],
  ['santos', 'org', 'Santos', 'Santos', '', 'Gas producer', 'neutral', 'aep'],
  ['bhp', 'org', 'BHP', 'BHP', '', 'Miner', 'neutral', 'mca'],
  ['riotinto', 'org', 'Rio Tinto', 'Rio Tinto', '', 'Miner', 'neutral', 'mca'],
  ['fortescue', 'org', 'Fortescue', 'Fortescue|FMG|Andrew Forrest|Twiggy Forrest', '', 'Miner', 'neutral', 'mca'],
  ['glencore', 'org', 'Glencore', 'Glencore', '', 'Miner', 'neutral', 'mca'],
  // topics: the stance is for or against the thing itself
  ['t_nuclear', 'topic', 'Nuclear power', 'nuclear power|nuclear energy|nuclear reactor|nuclear plant|small modular reactor|SMRs', '', 'Policy debate', 'neutral', ''],
  ['t_ftc', 'topic', 'Fuel tax credits', 'fuel tax credit|diesel rebate|diesel fuel rebate|fuel excise credit', '', 'Client fight', 'client', 'mca'],
  ['t_cm', 'topic', 'Critical minerals reserve', 'critical minerals reserve|critical mineral reserve|strategic reserve|critical minerals strategy', '', 'Client fight', 'client', 'mca'],
  ['t_gasres', 'topic', 'Gas reservation', 'gas reservation|domestic gas reservation|east coast gas reservation|gas export control', '', 'Client fight', 'client', 'aep'],
  ['t_neggear', 'topic', 'Negative gearing', 'negative gearing|capital gains tax discount|CGT discount', '', 'Policy debate', 'neutral', 'pca'],
  ['t_housingtarget', 'topic', 'Housing targets', 'housing target|1.2 million homes|National Housing Accord|housing accord', '', 'Policy debate', 'neutral', 'pca'],
  ['t_samejob', 'topic', 'Same job, same pay', 'same job, same pay|same job same pay|labour hire laws', '', 'IR debate', 'neutral', 'mba'],
  ['t_60day', 'topic', '60-day dispensing', '60-day dispensing|60 day dispensing|sixty-day dispensing|60-day prescription', '', 'Client fight', 'client', 'pharm'],
  ['t_scope', 'topic', 'Pharmacist prescribing', 'pharmacist prescribing|pharmacists prescribing|scope of practice', '', 'Client fight', 'client', 'pharm'],
  ['t_super', 'topic', 'Superannuation tax', 'superannuation tax|super tax|Division 296|$3 million super', '', 'Policy debate', 'neutral', ''],
  ['t_immig', 'topic', 'Immigration', 'immigration|migration intake|net overseas migration|migrant intake', '', 'Policy debate', 'neutral', ''],
  ['t_cost', 'topic', 'Cost of living', 'cost of living|cost-of-living', '', 'Public mood', 'neutral', ''],
  ['t_rates', 'topic', 'Interest rates', 'interest rate|rate cut|rate rise|rate hike|cash rate', '', 'Public mood', 'neutral', ''],
  ['t_ducks', 'topic', 'Duck hunting', 'duck hunting|duck season|duck shooting', '', 'Victorian debate', 'client', 'vicnats'],
  ['t_vline', 'topic', 'Regional rail', 'V/Line|regional rail|country trains', '', 'Victorian debate', 'client', 'vicnats'],
];
async function ensureSentiment(env) {
  if (!env.MIND_DB) return false;
  if (SENT_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS entities(id TEXT PRIMARY KEY, kind TEXT, name TEXT, aliases TEXT, party TEXT, role TEXT, side TEXT, ns TEXT, active INTEGER, edited INTEGER, source TEXT, note TEXT, created INTEGER, updated INTEGER)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS sent_items(item INTEGER PRIMARY KEY, kind TEXT, platform TEXT, src TEXT, ts INTEGER, tone REAL, texttype TEXT, region TEXT, issues TEXT, entities TEXT, model TEXT, created INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS sent_items_ts ON sent_items(ts)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS sent_entities(id INTEGER PRIMARY KEY AUTOINCREMENT, item INTEGER, entity TEXT, stance INTEGER, intensity INTEGER, sarcasm INTEGER, why TEXT, ts INTEGER, platform TEXT, region TEXT, kind TEXT)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS sent_entities_e ON sent_entities(entity, ts)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS sent_entities_i ON sent_entities(item)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS sent_entities_ts ON sent_entities(ts)'),
  ]);
  SENT_READY = true;
  try { await entitiesSeed(env); } catch (e) {}
  return true;
}
async function entitiesSeed(env, force) {
  const ver = arcHash(JSON.stringify(ENTITY_SEED));
  const n = ((await env.MIND_DB.prepare('SELECT COUNT(*) n FROM entities').first()) || {}).n || 0;
  if (!force && n > 0 && (await kvGet(env.AXIOM_KV, 'entities_seed_v')) === ver) return { ok: true, unchanged: true, n };
  const now = Date.now();
  const ins = env.MIND_DB.prepare("INSERT INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,?,?,?,?,?,?,?,1,0,'seed','',?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, name=excluded.name, aliases=excluded.aliases, party=excluded.party, role=excluded.role, side=excluded.side, ns=excluded.ns, updated=excluded.updated WHERE entities.edited=0");
  const stmts = ENTITY_SEED.map(r => ins.bind(r[0], r[1], r[2], JSON.stringify(String(r[3]).split('|').map(s => s.trim()).filter(Boolean)), r[4] || '', r[5] || '', r[6] || 'neutral', r[7] || '', now, now));
  for (let i = 0; i < stmts.length; i += 100) await env.MIND_DB.batch(stmts.slice(i, i + 100));
  await kvPut(env.AXIOM_KV, 'entities_seed_v', ver, 30 * 86400);
  ENTITY_CACHE = null;
  return { ok: true, seeded: ENTITY_SEED.length, had: n };
}
function entityRow(r) {
  return { id: r.id, kind: r.kind || 'org', name: r.name || r.id, aliases: pjs(r.aliases, []), party: r.party || '', role: r.role || '', side: r.side || 'neutral', ns: r.ns || '',
    active: !!r.active, edited: !!r.edited, source: r.source || '', note: r.note || '', created: r.created || 0, updated: r.updated || 0 };
}
function entityIdClean(v) { return String(v || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40); }
function entitySanitize(b, cur) {
  b = b || {};
  const name = String(b.name || (cur && cur.name) || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const id = entityIdClean(b.id || (cur && cur.id) || name.toLowerCase().replace(/[^a-z0-9]+/g, '_'));
  const kind = ENTITY_KINDS.indexOf(b.kind) >= 0 ? b.kind : ((cur && cur.kind) || 'org');
  let aliases = Array.isArray(b.aliases) ? b.aliases : (typeof b.aliases === 'string' ? b.aliases.split(/[|\n,]/) : ((cur && cur.aliases) || []));
  aliases = aliases.map(a => String(a).replace(/\s+/g, ' ').trim().slice(0, 80)).filter(a => a.length >= 2);
  if (!aliases.length && name) aliases = [name];
  const side = ENTITY_SIDES.indexOf(b.side) >= 0 ? b.side : ((cur && cur.side) || 'neutral');
  return { id, name, kind, aliases: Array.from(new Set(aliases)).slice(0, 30), party: String(b.party != null ? b.party : ((cur && cur.party) || '')).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20),
    role: String(b.role != null ? b.role : ((cur && cur.role) || '')).slice(0, 120), side, ns: String(b.ns != null ? b.ns : ((cur && cur.ns) || '')).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24),
    note: String(b.note != null ? b.note : ((cur && cur.note) || '')).slice(0, 300), active: b.active == null ? (cur ? cur.active : true) : !!b.active };
}
async function entityUpsert(env, s, now, source) {
  await env.MIND_DB.prepare("INSERT INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, name=excluded.name, aliases=excluded.aliases, party=excluded.party, role=excluded.role, side=excluded.side, ns=excluded.ns, active=excluded.active, edited=1, note=excluded.note, updated=excluded.updated")
    .bind(s.id, s.kind, s.name, JSON.stringify(s.aliases), s.party, s.role, s.side, s.ns, s.active ? 1 : 0, source || 'operator', s.note, now, now).run();
  ENTITY_CACHE = null;
}
async function entitiesList(env, opts) {
  opts = opts || {};
  const rows = ((await env.MIND_DB.prepare('SELECT * FROM entities ORDER BY kind, name').all()).results || []).map(entityRow);
  const q = String(opts.q || '').toLowerCase();
  return rows.filter(e => (!opts.kind || e.kind === opts.kind) && (opts.active == null || e.active === !!opts.active) && (!q || (e.name + ' ' + e.id + ' ' + e.aliases.join(' ') + ' ' + e.role).toLowerCase().indexOf(q) >= 0));
}
/** The first pass: one regular expression per active entity, built from its
 *  aliases (plain words, plural allowed, whole words only), cached for a
 *  few minutes. Returns the ids mentioned in a text. */
let ENTITY_CACHE = null;
async function entityMatcher(env) {
  if (ENTITY_CACHE && Date.now() - ENTITY_CACHE.at < 5 * 60000) return ENTITY_CACHE.m;
  const rows = await entitiesList(env, { active: true });
  const list = rows.map(e => {
    const parts = e.aliases.map(a => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+').replace(/'/g, "['\\u2019]")).filter(Boolean);
    if (!parts.length) return null;
    let rx = null; try { rx = new RegExp('(?<![A-Za-z0-9])(?:' + parts.join('|') + ')(?:s|es)?(?![A-Za-z0-9])', 'i'); } catch (e) { rx = null; }
    return rx ? { id: e.id, kind: e.kind, name: e.name, role: e.role, party: e.party, side: e.side, rx } : null;
  }).filter(Boolean);
  const m = {
    entities: list,
    byId: Object.fromEntries(list.map(e => [e.id, e])),
    match: text => { const t = String(text || '').replace(/[\u2018\u2019]/g, "'"); const out = []; for (const e of list) if (e.rx.test(t)) out.push(e.id); return out; },
  };
  ENTITY_CACHE = { at: Date.now(), m };
  return m;
}
/** Sitting members and senators become person entities (alias: their name),
 *  refreshed from the register but never over an operator's edit. */
async function entitiesSyncMps(env) {
  const mps = await mpsList(env, { limit: 600 });
  if (!mps.length) return { ok: false, error: 'no_mps', detail: 'The MP register is empty. Sync it first (POST /mps/sync).' };
  const partyOf = p => { const s = String(p || '').toLowerCase(); return /labor/.test(s) ? 'alp' : /liberal national/.test(s) ? 'lib' : /liberal/.test(s) ? 'lib' : /national/.test(s) ? 'nat' : /green/.test(s) ? 'grn' : /one nation/.test(s) ? 'on' : /jacqui lambie/.test(s) ? 'ind' : 'ind'; };
  const now = Date.now();
  const st = env.MIND_DB.prepare("INSERT INTO entities(id,kind,name,aliases,party,role,side,ns,active,edited,source,note,created,updated) VALUES(?,?,?,?,?,?,?,?,1,0,'mps','',?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, aliases=excluded.aliases, party=excluded.party, role=excluded.role, updated=excluded.updated WHERE entities.edited=0");
  const stmts = mps.filter(m => m.name).map(m => {
    const role = (m.house === 'senate' ? 'Senator for ' : 'Member for ') + (m.electorate || '') + (m.party ? ' (' + m.party + ')' : '');
    return st.bind('mp_' + String(m.id).toLowerCase().replace(/[^a-z0-9]/g, ''), 'person', m.name, JSON.stringify([m.name]), partyOf(m.party), role.slice(0, 120), 'neutral', '', now, now);
  });
  for (let i = 0; i < stmts.length; i += 100) await env.MIND_DB.batch(stmts.slice(i, i + 100));
  ENTITY_CACHE = null;
  return { ok: true, synced: stmts.length };
}
// -- where and on what ----------------------------------------------------------
const REGION_RX = [
  ['nsw', /new south wales|\bnsw\b|sydney|newcastle|wollongong|macquarie street|\bminns\b/i],
  ['vic', /victoria(?!\s*(?:bc|british columbia|falls|harbour|cross|secret))|victorian|melbourne|spring street|geelong|ballarat|bendigo|gippsland|jacinta allan/i],
  ['qld', /queensland|\bqld\b|brisbane|gold coast|townsville|cairns|toowoomba|crisafulli/i],
  ['wa', /western australia|\bperth\b|pilbara|kalgoorlie|\bwa (government|premier|budget|parliament)\b|roger cook/i],
  ['sa', /south australia|adelaide|malinauskas/i],
  ['tas', /tasmania|hobart|launceston|rockliff/i],
  ['nt', /northern territory|\bdarwin\b|finocchiaro/i],
  ['act', /\bact (government|budget|legislative assembly)\b|andrew barr/i],
];
const SUB_REGION = { melbourne: 'vic', perth: 'wa', brisbane: 'qld', sydney: 'nsw', adelaide: 'sa', hobart: 'tas', canberra: 'act', darwin: 'nt', tasmania: 'tas', queensland: 'qld' };
function regionOf(text, meta, sub) {
  if (meta && meta.juris && meta.juris !== 'au' && SOURCE_JURIS.indexOf(meta.juris) >= 0) return meta.juris;
  const s = String(sub || '').toLowerCase(); if (SUB_REGION[s]) return SUB_REGION[s];
  for (const [code, rx] of REGION_RX) if (rx.test(String(text || ''))) return code;
  return 'au';
}
function platformOf(kind, meta) {
  if (/^sig_/.test(kind)) return String((meta && meta.platform) || 'unknown');
  if (/^reddit_/.test(kind)) return 'reddit';
  if (kind === 'comments') return 'meta';
  if (kind === 'transcript') return String((meta && meta.platform) || 'youtube');
  if (kind === 'forum') return 'forum';
  return 'news';
}
function sentText(r) {
  const title = String(r.title || '').trim(), body = String(r.body || '').trim();
  if (r.kind === 'transcript') return (title + '. ' + body).slice(0, 1200);
  if (/comment/.test(r.kind)) return body.slice(0, 900) || title.slice(0, 300);
  return (title + (body && body !== title ? '. ' + body : '')).slice(0, 900);
}
function sentDay() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
async function sentBudget(env) {
  const cap = Math.max(0, parseInt(env.SENTIMENT_DAILY_CALLS, 10) || SENT_DAILY_CALLS);
  const used = Number(await kvGet(env.AXIOM_KV, 'sent_calls_' + sentDay()) || 0);
  return { used, cap, left: Math.max(0, cap - used), model: env.SENTIMENT_MODEL || SENT_MODEL };
}
async function sentSpend(env, n) { const k = 'sent_calls_' + sentDay(); const used = Number(await kvGet(env.AXIOM_KV, k) || 0) + n; await kvPut(env.AXIOM_KV, k, String(used), 2 * 86400); return used; }
const SENT_SYS = 'You read Australian political text and judge how its author regards the entities named under it. For each text and each entity listed, give stance: -1 when the text is critical, hostile, mocking, or blames the entity; 1 when it praises, supports, defends or credits it; 0 when it merely mentions or reports it without a view. Judge the author\'s view, not the events: a report of an attack on X is 0 unless the reporter\'s own framing takes a side. For a topic entity the stance is for or against the thing itself. Sarcasm inverts the literal words; mark it. intensity: 1 mild, 2 clear, 3 strong or abusive. Also give the text\'s overall tone from -1 (hostile, angry, despairing) to 1 (warm, approving) as a number with one decimal, and its type: news (reporting), opinion (a view, a comment) or question. Reply with strict JSON only, no prose: {"items":[{"n":1,"tone":-0.6,"type":"opinion","entities":[{"id":"alp","stance":-1,"intensity":2,"sarcasm":false,"why":"calls the policy a rort"}]}]}. why: at most twelve words, the phrase that decided it. Every text and every listed entity must appear.';
async function sentClassify(env, batch, matcher, log) {
  const ids = Array.from(new Set(batch.flatMap(b => b.entities)));
  const gloss = ids.map(id => { const e = matcher.byId[id]; return e ? id + ': ' + e.name + ' (' + e.kind + (e.role ? ', ' + e.role : '') + ')' : id; }).join('\n');
  const texts = batch.map((b, i) => '[' + (i + 1) + '] ' + b.kind.replace('_', ' ') + ', ' + b.platform + ', ' + new Date(b.ts).toISOString().slice(0, 10) + '; mentions: ' + b.entities.join(', ') + '\n' + b.text.replace(/\s+/g, ' ')).join('\n\n');
  const user = 'ENTITIES\n' + gloss + '\n\nTEXTS\n' + texts;
  let txt = '', parsed = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    txt = await claudeMsg(env, SENT_SYS + (attempt ? ' Your previous answer was not valid JSON; answer with the JSON object only.' : ''), user, 400 + batch.length * 140, 45000, env.SENTIMENT_MODEL || SENT_MODEL);
    parsed = relJson(txt);
    if (!parsed || !Array.isArray(parsed.items)) parsed = null;
  }
  if (!parsed) throw new Error('classifier answered without valid JSON');
  const out = [];
  parsed.items.forEach(it => {
    const n = parseInt(it.n, 10); const b = batch[n - 1]; if (!b) return;
    const tone = Math.max(-1, Math.min(1, Number(it.tone) || 0));
    const type = /^(news|opinion|question)$/.test(String(it.type || '')) ? String(it.type) : 'opinion';
    const ents = (Array.isArray(it.entities) ? it.entities : []).map(e => ({ id: String(e.id || ''), stance: Math.max(-1, Math.min(1, Math.round(Number(e.stance) || 0))), intensity: Math.max(1, Math.min(3, Math.round(Number(e.intensity) || 1))), sarcasm: !!e.sarcasm, why: String(e.why || '').slice(0, 160) })).filter(e => b.entities.indexOf(e.id) >= 0);
    b.entities.forEach(id => { if (!ents.some(e => e.id === id)) ents.push({ id, stance: 0, intensity: 1, sarcasm: false, why: 'not judged by the model' }); });
    out.push({ b, tone, type, ents });
  });
  return out;
}
/** One classification run: the newest unclassified rows, those that mention
 *  an entity, the important ones first (client issues, busy threads), in
 *  batches, within the day's budget. Rows mentioning nothing are marked so
 *  they are not looked at again. */
async function sentimentRun(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  if (!(await ensureSentiment(env)) || !(await ensureArchive(env))) return { ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' };
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'not_configured', detail: 'Set ANTHROPIC_API_KEY on the worker: the classifier is Claude.' };
  const now = Date.now();
  const limit = Math.min(Math.max(parseInt(opts.limit, 10) || SENT_PER_TICK, 1), 400);
  const scan = Math.min(Math.max(parseInt(opts.scan, 10) || SENT_SCAN, limit), 1500);
  const hours = Math.min(Math.max(parseInt(opts.hours, 10) || SENT_WINDOW_H, 1), 24 * 30);
  const budget = await sentBudget(env);
  const out = { ok: true, scanned: 0, matched: 0, classified: 0, mentions: 0, calls: 0, skipped: 0, budget, byStance: { neg: 0, neu: 0, pos: 0 }, errors: [], model: budget.model };
  const kinds = SENT_KINDS.map(() => '?').join(',');
  const w = ['s.item IS NULL', 'a.ts>?', 'a.kind IN (' + kinds + ')']; const b = [now - hours * 3600000].concat(SENT_KINDS);
  if (opts.platform) { w.push("(json_extract(a.meta,'$.platform')=? OR a.kind LIKE ?)"); b.push(String(opts.platform), String(opts.platform) + '%'); }
  const rows = (await env.MIND_DB.prepare('SELECT a.id, a.kind, a.src, a.title, a.body, a.url, a.ts, a.meta FROM arc_items a LEFT JOIN sent_items s ON s.item=a.id WHERE ' + w.join(' AND ') + ' ORDER BY a.ts DESC LIMIT ?').bind(...b, scan).all()).results || [];
  out.scanned = rows.length;
  const matcher = await entityMatcher(env);
  const cands = [], markers = [];
  rows.forEach(r => {
    let meta = {}; try { meta = JSON.parse(r.meta || '{}') || {}; } catch (e) { meta = {}; }
    const text = sentText(r);
    const ents = text.length < 12 ? [] : matcher.match(text);
    const platform = platformOf(r.kind, meta);
    const issues = Array.isArray(meta.issues) ? meta.issues : [];
    if (!ents.length) { markers.push(env.MIND_DB.prepare("INSERT OR REPLACE INTO sent_items(item,kind,platform,src,ts,tone,texttype,region,issues,entities,model,created) VALUES(?,?,?,?,?,NULL,'',?,?,'[]','none',?)").bind(r.id, r.kind, platform, String(r.src || ''), r.ts || now, regionOf(text, meta, meta.sub), JSON.stringify(issues), now)); return; }
    cands.push({ id: r.id, kind: r.kind, src: String(r.src || ''), ts: r.ts || now, text, entities: ents, platform, region: regionOf(text, meta, meta.sub), issues, weight: issues.length * 10 + Math.min(Number(meta.comments) || 0, 200) / 20 + Math.min(Number(meta.score) || 0, 500) / 100 + (ents.some(id => (matcher.byId[id] || {}).side === 'client') ? 15 : 0) });
  });
  out.matched = cands.length;
  for (let i = 0; i < markers.length; i += 100) { try { await env.MIND_DB.batch(markers.slice(i, i + 100)); out.skipped += Math.min(100, markers.length - i); } catch (e) {} }
  cands.sort((a, b2) => (b2.weight - a.weight) || (b2.ts - a.ts));
  const take = cands.slice(0, limit);
  const callsNeeded = Math.ceil(take.length / SENT_BATCH);
  await log('info', out.scanned + ' rows of the last ' + hours + 'h without a verdict; ' + out.matched + ' mention an entity; classifying ' + take.length + ' in ' + callsNeeded + ' call' + (callsNeeded === 1 ? '' : 's') + ' (' + budget.used + ' of ' + budget.cap + ' calls used today, ' + budget.model + ')');
  if (!take.length) { await kvPut(env.AXIOM_KV, 'sent_last', JSON.stringify(Object.assign({ at: now }, out)).slice(0, 4000), 7 * 86400); return out; }
  for (let i = 0; i < take.length; i += SENT_BATCH) {
    if (out.calls >= budget.left) { out.errors.push('daily budget of ' + budget.cap + ' Claude calls reached; ' + (take.length - i) + ' rows wait for tomorrow'); await log('err', out.errors[out.errors.length - 1]); break; }
    const batch = take.slice(i, i + SENT_BATCH);
    await log('cmd', 'claude ' + budget.model + ' batch ' + (i / SENT_BATCH + 1) + ': ' + batch.length + ' texts, ' + batch.reduce((a, x) => a + x.entities.length, 0) + ' entity mentions');
    let verdicts;
    try { verdicts = await sentClassify(env, batch, matcher, log); out.calls++; await sentSpend(env, 1); }
    catch (e) { out.calls++; await sentSpend(env, 1); const m = String((e && e.message) || e).slice(0, 160); out.errors.push(m); await log('err', m); continue; }
    const stmts = [];
    let neg = 0, neu = 0, pos = 0;
    verdicts.forEach(v => {
      const r = v.b;
      stmts.push(env.MIND_DB.prepare('INSERT OR REPLACE INTO sent_items(item,kind,platform,src,ts,tone,texttype,region,issues,entities,model,created) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(r.id, r.kind, r.platform, r.src, r.ts, v.tone, v.type, r.region, JSON.stringify(r.issues), JSON.stringify(v.ents.map(e => e.id)), budget.model, now));
      stmts.push(env.MIND_DB.prepare('DELETE FROM sent_entities WHERE item=?').bind(r.id));
      v.ents.forEach(e => { stmts.push(env.MIND_DB.prepare('INSERT INTO sent_entities(item,entity,stance,intensity,sarcasm,why,ts,platform,region,kind) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(r.id, e.id, e.stance, e.intensity, e.sarcasm ? 1 : 0, e.why, r.ts, r.platform, r.region, r.kind)); if (e.stance < 0) neg++; else if (e.stance > 0) pos++; else neu++; });
      // the model's tone replaces the lexicon's on the archive row, so every view that reads tone improves
      stmts.push(env.MIND_DB.prepare('UPDATE arc_items SET tone=? WHERE id=?').bind(v.tone <= -0.3 ? -1 : v.tone >= 0.3 ? 1 : 0, r.id));
      out.classified++; out.mentions += v.ents.length;
    });
    for (let j = 0; j < stmts.length; j += 100) { try { await env.MIND_DB.batch(stmts.slice(j, j + 100)); } catch (e) { out.errors.push('write failed: ' + String((e && e.message) || e).slice(0, 100)); } }
    out.byStance.neg += neg; out.byStance.neu += neu; out.byStance.pos += pos;
    const avg = verdicts.length ? (verdicts.reduce((a, v) => a + v.tone, 0) / verdicts.length).toFixed(2) : '0';
    await log('out', verdicts.length + ' verdicts: ' + neg + ' critical, ' + neu + ' neutral, ' + pos + ' supportive mentions; tone ' + avg + ' on average');
  }
  out.budget = await sentBudget(env);
  await log('info', out.classified + ' rows classified, ' + out.mentions + ' entity stances recorded, ' + out.skipped + ' rows marked as mentioning nothing');
  if (!out.classified && out.errors.length) { out.ok = false; out.detail = out.errors[0]; }
  await kvPut(env.AXIOM_KV, 'sent_last', JSON.stringify(Object.assign({ at: now }, out)).slice(0, 4000), 7 * 86400);
  return out;
}
async function sentimentCron(env) {
  if (!env.MIND_DB || !env.ANTHROPIC_API_KEY) return { ok: false, skipped: true };
  const b = await sentBudget(env);
  if (!b.left) return { ok: true, skipped: 'budget' };
  return sentimentRun(env, { limit: SENT_PER_TICK });
}
// -- the sums, always over rows that point back at the archive ------------------
function sentWhere(f, alias) {
  const a = alias || 'e'; const w = []; const b = [];
  if (f.platform) { w.push(a + '.platform=?'); b.push(String(f.platform)); }
  if (f.region) { w.push(a + '.region=?'); b.push(String(f.region)); }
  return { w, b };
}
async function sentimentEntities(env, f) {
  f = f || {};
  const days = Math.min(Math.max(parseInt(f.days, 10) || 7, 1), 365);
  const now = Date.now(), since = now - days * 86400000, prev = since - days * 86400000;
  const { w, b } = sentWhere(f);
  const issueJoin = f.issue ? ' JOIN sent_items s ON s.item=e.item' : '';
  const issueW = f.issue ? ' AND s.issues LIKE ?' : ''; const issueB = f.issue ? ['%"' + String(f.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'] : [];
  const cur = (await env.MIND_DB.prepare('SELECT e.entity, COUNT(*) n, AVG(e.stance) score, SUM(e.stance<0) neg, SUM(e.stance>0) pos, SUM(e.sarcasm) sarcasm, AVG(e.intensity) intensity, MAX(e.ts) latest FROM sent_entities e' + issueJoin + ' WHERE e.ts>?' + (w.length ? ' AND ' + w.join(' AND ') : '') + issueW + ' GROUP BY e.entity').bind(since, ...b, ...issueB).all()).results || [];
  const before = (await env.MIND_DB.prepare('SELECT e.entity, COUNT(*) n, AVG(e.stance) score FROM sent_entities e' + issueJoin + ' WHERE e.ts>? AND e.ts<=?' + (w.length ? ' AND ' + w.join(' AND ') : '') + issueW + ' GROUP BY e.entity').bind(prev, since, ...b, ...issueB).all()).results || [];
  const plats = (await env.MIND_DB.prepare('SELECT e.entity, e.platform, COUNT(*) n, AVG(e.stance) score FROM sent_entities e' + issueJoin + ' WHERE e.ts>?' + (w.length ? ' AND ' + w.join(' AND ') : '') + issueW + ' GROUP BY e.entity, e.platform').bind(since, ...b, ...issueB).all()).results || [];
  const bm = {}; before.forEach(r => { bm[r.entity] = r; });
  const regs = (await env.MIND_DB.prepare('SELECT e.entity, e.region, COUNT(*) n, AVG(e.stance) score FROM sent_entities e' + issueJoin + ' WHERE e.ts>?' + (w.length ? ' AND ' + w.join(' AND ') : '') + issueW + ' GROUP BY e.entity, e.region').bind(since, ...b, ...issueB).all()).results || [];
  const pm = {}; plats.forEach(r => { (pm[r.entity] = pm[r.entity] || []).push({ platform: r.platform, n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100 }); });
  const rm = {}; regs.forEach(r => { (rm[r.entity] = rm[r.entity] || []).push({ region: r.region || 'au', n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100 }); });
  const reg = {}; (await entitiesList(env, {})).forEach(e => { reg[e.id] = e; });
  const list = cur.map(r => { const e = reg[r.entity] || { name: r.entity, kind: 'org', party: '', side: 'neutral', role: '', ns: '' }; const p = bm[r.entity]; return {
    id: r.entity, name: e.name, kind: e.kind, party: e.party, side: e.side, role: e.role, ns: e.ns, active: e.active !== false,
    n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100, neg: r.neg || 0, pos: r.pos || 0, neu: (r.n || 0) - (r.neg || 0) - (r.pos || 0), sarcasm: r.sarcasm || 0, intensity: Math.round((Number(r.intensity) || 1) * 10) / 10, latest: r.latest || 0,
    prev: p ? { n: p.n, score: Math.round((Number(p.score) || 0) * 100) / 100 } : null, change: p ? Math.round(((Number(r.score) || 0) - (Number(p.score) || 0)) * 100) / 100 : null,
    platforms: (pm[r.entity] || []).sort((x, y) => y.n - x.n), regions: (rm[r.entity] || []).sort((x, y) => y.n - x.n) }; })
    .filter(x => !f.kind || x.kind === f.kind).sort((x, y) => y.n - x.n);
  return { ok: true, days, since, filters: { platform: f.platform || '', region: f.region || '', issue: f.issue || '', kind: f.kind || '' }, entities: list };
}
async function sentimentSeries(env, f) {
  f = f || {};
  const days = Math.min(Math.max(parseInt(f.days, 10) || 30, 1), 365);
  const bucket = f.bucket === 'hour' ? 3600000 : 86400000;
  const since = Date.now() - days * 86400000;
  const { w, b } = sentWhere(f);
  const entity = entityIdClean(f.entity);
  let rows;
  if (entity) rows = (await env.MIND_DB.prepare('SELECT CAST(e.ts/? AS INTEGER) b, COUNT(*) n, AVG(e.stance) score, SUM(e.stance<0) neg, SUM(e.stance>0) pos FROM sent_entities e WHERE e.entity=? AND e.ts>?' + (w.length ? ' AND ' + w.join(' AND ') : '') + ' GROUP BY b ORDER BY b').bind(bucket, entity, since, ...b).all()).results || [];
  else { const sw = sentWhere(f, 's'); rows = (await env.MIND_DB.prepare("SELECT CAST(s.ts/? AS INTEGER) b, COUNT(*) n, AVG(s.tone) score, SUM(s.tone<-0.2) neg, SUM(s.tone>0.2) pos FROM sent_items s WHERE s.model<>'none' AND s.ts>?" + (sw.w.length ? ' AND ' + sw.w.join(' AND ') : '') + (f.issue ? ' AND s.issues LIKE ?' : '') + ' GROUP BY b ORDER BY b').bind(bucket, since, ...sw.b, ...(f.issue ? ['%"' + String(f.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'] : [])).all()).results || []; }
  return { ok: true, entity, days, bucket: f.bucket === 'hour' ? 'hour' : 'day', points: rows.map(r => ({ t: r.b * bucket, n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100, neg: r.neg || 0, pos: r.pos || 0 })) };
}
async function sentimentTopics(env, f) {
  f = f || {};
  const days = Math.min(Math.max(parseInt(f.days, 10) || 7, 1), 365);
  const since = Date.now() - days * 86400000;
  const sw = sentWhere(f, 's');
  const rows = (await env.MIND_DB.prepare("SELECT j.value issue, COUNT(*) n, AVG(s.tone) tone, SUM(s.tone<-0.2) neg, SUM(s.tone>0.2) pos, SUM(s.texttype='news') news FROM sent_items s, json_each(s.issues) j WHERE s.model<>'none' AND s.ts>?" + (sw.w.length ? ' AND ' + sw.w.join(' AND ') : '') + ' GROUP BY j.value ORDER BY n DESC').bind(since, ...sw.b).all()).results || [];
  const ents = (await env.MIND_DB.prepare('SELECT j.value issue, e.entity, COUNT(*) n, AVG(e.stance) score FROM sent_items s JOIN sent_entities e ON e.item=s.item, json_each(s.issues) j WHERE s.ts>?' + (sw.w.length ? ' AND ' + sw.w.join(' AND ') : '') + ' GROUP BY j.value, e.entity ORDER BY n DESC').bind(since, ...sw.b).all()).results || [];
  const reg = {}; (await entitiesList(env, {})).forEach(e => { reg[e.id] = e; });
  const by = {}; ents.forEach(r => { (by[r.issue] = by[r.issue] || []).push({ id: r.entity, name: (reg[r.entity] || {}).name || r.entity, kind: (reg[r.entity] || {}).kind || '', n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100 }); });
  const label = id => { const ci = CLIENT_ISSUES.find(c => c.id === id); return ci ? { label: ci.label, client: ci.client, ns: ci.ns } : { label: id, client: '', ns: '' }; };
  return { ok: true, days, topics: rows.map(r => Object.assign({ id: r.issue, n: r.n, tone: Math.round((Number(r.tone) || 0) * 100) / 100, neg: r.neg || 0, pos: r.pos || 0, news: r.news || 0, entities: (by[r.issue] || []).slice(0, 5) }, label(r.issue))) };
}
async function sentimentItems(env, f) {
  f = f || {};
  const days = Math.min(Math.max(parseInt(f.days, 10) || 7, 1), 365);
  const since = Date.now() - days * 86400000;
  const limit = Math.min(Math.max(parseInt(f.limit, 10) || 60, 1), 300);
  const entity = entityIdClean(f.entity);
  const { w, b } = sentWhere(f);
  if (f.stance === '-1' || f.stance === '0' || f.stance === '1' || typeof f.stance === 'number') { w.push('e.stance=?'); b.push(Number(f.stance)); }
  if (f.issue) { w.push('s.issues LIKE ?'); b.push('%"' + String(f.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
  let rows;
  if (entity) rows = (await env.MIND_DB.prepare('SELECT e.entity, e.stance, e.intensity, e.sarcasm, e.why, e.platform, e.region, e.ts, a.id, a.kind, a.src, a.title, a.body, a.url, s.tone, s.texttype, s.issues FROM sent_entities e JOIN sent_items s ON s.item=e.item JOIN arc_items a ON a.id=e.item WHERE e.entity=? AND e.ts>?' + (w.length ? ' AND ' + w.join(' AND ') : '') + ' ORDER BY e.ts DESC LIMIT ?').bind(entity, since, ...b, limit).all()).results || [];
  else {
    const sw = sentWhere(f, 's'); const ww = sw.w.slice(); const bb = sw.b.slice();
    if (f.issue) { ww.push('s.issues LIKE ?'); bb.push('%"' + String(f.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
    if (f.stance === '-1') ww.push('s.tone<-0.2'); else if (f.stance === '1') ww.push('s.tone>0.2'); else if (f.stance === '0') ww.push('s.tone BETWEEN -0.2 AND 0.2');
    rows = (await env.MIND_DB.prepare("SELECT '' entity, NULL stance, NULL intensity, 0 sarcasm, '' why, s.platform, s.region, s.ts, a.id, a.kind, a.src, a.title, a.body, a.url, s.tone, s.texttype, s.issues FROM sent_items s JOIN arc_items a ON a.id=s.item WHERE s.model<>'none' AND s.ts>?" + (ww.length ? ' AND ' + ww.join(' AND ') : '') + ' ORDER BY s.ts DESC LIMIT ?').bind(since, ...bb, limit).all()).results || [];
  }
  return { ok: true, entity, days, items: rows.map(r => ({ id: r.id, kind: r.kind, src: r.src, platform: r.platform, region: r.region, ts: r.ts, title: String(r.title || '').slice(0, 300), excerpt: String(r.body || '').replace(/\s+/g, ' ').slice(0, 400), url: r.url,
    tone: r.tone == null ? null : Math.round(Number(r.tone) * 100) / 100, type: r.texttype || '', issues: pjs(r.issues, []), stance: r.stance == null ? null : r.stance, intensity: r.intensity, sarcasm: !!r.sarcasm, why: r.why || '' })) };
}
async function sentimentStatus(env) {
  const now = Date.now();
  const c = (await env.MIND_DB.prepare("SELECT SUM(model<>'none' AND ts>?) c24, SUM(model<>'none' AND ts>?) c7, SUM(model='none' AND created>?) skipped24, COUNT(*) total, MAX(created) last FROM sent_items").bind(now - 86400000, now - 7 * 86400000, now - 86400000).first()) || {};
  const m = (await env.MIND_DB.prepare('SELECT COUNT(*) n, SUM(stance<0) neg, SUM(stance>0) pos FROM sent_entities WHERE ts>?').bind(now - 7 * 86400000).first()) || {};
  const ents = (await env.MIND_DB.prepare('SELECT COUNT(*) n, SUM(active) active, SUM(kind=\'person\') people, SUM(kind=\'party\') parties, SUM(kind=\'org\') orgs, SUM(kind=\'topic\') topics FROM entities').first()) || {};
  // the backlog: of the newest unclassified rows, how many mention an entity
  const kinds = SENT_KINDS.map(() => '?').join(',');
  const rows = (await env.MIND_DB.prepare('SELECT a.kind, a.title, a.body FROM arc_items a LEFT JOIN sent_items s ON s.item=a.id WHERE s.item IS NULL AND a.ts>? AND a.kind IN (' + kinds + ') ORDER BY a.ts DESC LIMIT 400').bind(now - SENT_WINDOW_H * 3600000, ...SENT_KINDS).all()).results || [];
  const matcher = await entityMatcher(env);
  const backlog = rows.filter(r => matcher.match(sentText(r)).length).length;
  let last = null; try { last = JSON.parse((await kvGet(env.AXIOM_KV, 'sent_last')) || 'null'); } catch (e) { last = null; }
  return { ok: true, configured: !!env.ANTHROPIC_API_KEY, budget: await sentBudget(env), classified24: c.c24 || 0, classified7: c.c7 || 0, skipped24: c.skipped24 || 0, total: c.total || 0, mentions7: m.n || 0, neg7: m.neg || 0, pos7: m.pos || 0,
    entities: { total: ents.n || 0, active: ents.active || 0, people: ents.people || 0, parties: ents.parties || 0, orgs: ents.orgs || 0, topics: ents.topics || 0 }, backlog, unclassifiedScanned: rows.length, perTick: SENT_PER_TICK, batch: SENT_BATCH, windowHours: SENT_WINDOW_H, last, regions: SOURCE_JURIS };
}

// ==============================================================================
// NARRATIVES - the stories the conversation keeps telling. New rows are
// embedded (Workers AI, the Mind's own model; term vectors when it is unbound)
// and joined to a live narrative when they sit close to its centre and share
// an issue or an entity with it, or start a new one. Each narrative keeps its
// origin (the first row, where and when), the order the channels picked it up,
// who carries it most, its pace against the previous day, the sentiment split
// of its rows and where it stands toward the client. Claude names a narrative
// once it has three rows - the claim as its proponents would put it, the
// strongest counter-claim, who pushes it - within a daily budget. Narratives
// that share an issue and face opposite ways are paired as counter-narratives.
// One that is new, growing and touches a client issue is reported to Slack
// once. Every figure is a count over narrative_items, each pointing at a row.
// ==============================================================================
let NARR_READY = false;
const NARR_WINDOW_H = 72;       // rows this old are still placed
const NARR_LIVE_H = 96;         // a narrative with nothing newer is asleep: not matched against
const NARR_SCAN = 300;          // rows placed per run
const NARR_SIM = 0.80;          // cosine to join, with a shared issue or entity...
const NARR_SIM_STRICT = 0.88;   // ...or this close without one
const NARR_TOKEN_SIM = 0.32;    // the term-vector fallback
const NARR_LABEL_MIN = 3;       // rows before Claude names it
const NARR_ALERT_MIN = 6;       // rows within 48h of first sight before an emergence alert
const NARR_DAILY_CALLS = 60;    // naming calls a day unless NARRATIVE_DAILY_CALLS says otherwise
const NARR_EMBED = '@cf/baai/bge-base-en-v1.5';
const NARR_STOP = new Set(('the a an and or of to in on for with at by from as is are was were be been being it its this that these those i me my you your he him his she her we us our they them their who whom what which when where why how not no nor but so if then than too very can will would should could may might must just about into over under after before also more most less least such only own same other some any all each both few many much out up down off new old said says say one two three via amp rt https http com www').split(' '));
async function ensureNarratives(env) {
  if (!env.MIND_DB) return false;
  if (NARR_READY) return true;
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS narratives(id TEXT PRIMARY KEY, label TEXT, summary TEXT, claim TEXT, counter_claim TEXT, proponents TEXT, issues TEXT, entities TEXT, ns TEXT, side TEXT, n INTEGER, n24 INTEGER, nprev INTEGER, velocity REAL, first_ts INTEGER, first_item INTEGER, first_platform TEXT, first_channel TEXT, last_ts INTEGER, platforms TEXT, channels TEXT, spread TEXT, amplifiers TEXT, sentiment TEXT, counter TEXT, status TEXT, alerted INTEGER, alert_ts INTEGER, muted INTEGER, pinned INTEGER, edited INTEGER, terms TEXT, centroid TEXT, dim INTEGER, labelled_n INTEGER, model TEXT, created INTEGER, updated INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS narratives_last ON narratives(last_ts)'),
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS narrative_items(item INTEGER PRIMARY KEY, narrative TEXT, ts INTEGER, platform TEXT, channel TEXT, sim REAL)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS narrative_items_n ON narrative_items(narrative, ts)'),
  ]);
  NARR_READY = true;
  return true;
}
function narrText(r) {
  const title = String(r.title || '').replace(/^Comment on:\s*/i, '').trim();
  const body = String(r.body || '').replace(/https?:\/\/\S+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/comment/.test(r.kind)) return body.slice(0, 500);
  if (r.kind === 'transcript') return (title + '. ' + body).slice(0, 700);
  return (title + (body && body.indexOf(title.slice(0, 40)) < 0 ? '. ' + body : '')).slice(0, 600);
}
function narrTokens(text) {
  return String(text || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[^a-z0-9$%'\s-]/g, ' ').split(/\s+/).map(w => w.replace(/^['-]+|['-]+$/g, '')).filter(w => w.length > 2 && !NARR_STOP.has(w) && !/^\d+$/.test(w));
}
function tokenVec(tokens) { const m = {}; tokens.forEach(t => { m[t] = (m[t] || 0) + 1; }); let n = 0; for (const k in m) n += m[k] * m[k]; n = Math.sqrt(n) || 1; for (const k in m) m[k] /= n; return m; }
function tokenCos(a, b) { let s = 0; for (const k in a) if (b[k]) s += a[k] * b[k]; return s; }
function vecCos(a, b) { let s = 0, na = 0, nb = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { s += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return na && nb ? s / Math.sqrt(na * nb) : 0; }
function f32b64(arr) { const f = new Float32Array(arr); const b = new Uint8Array(f.buffer); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function b64f32(s) { try { if (!s) return null; const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return Array.from(new Float32Array(b.buffer)); } catch (e) { return null; } }
async function narrEmbed(env, texts) {
  if (!env.AI || !texts.length) return null;
  const out = [];
  try { for (let i = 0; i < texts.length; i += 50) { const r = await env.AI.run(NARR_EMBED, { text: texts.slice(i, i + 50).map(t => String(t).slice(0, 1500)) }); ((r && r.data) || []).forEach(v => out.push(Array.from(v))); } } catch (e) { return null; }
  return out.length === texts.length ? out : null;
}
function narrChannel(kind, meta, src) {
  if (/^reddit_/.test(kind)) return meta.sub ? 'r/' + meta.sub : 'reddit';
  if (/^sig_/.test(kind)) return String(meta.page_name || meta.page || meta.platform || 'post').slice(0, 80);
  if (kind === 'comments') return 'meta' + (meta.ns ? ':' + meta.ns : '');
  if (kind === 'transcript') return String(meta.page_name || 'youtube').slice(0, 80);
  return String(src || 'news').slice(0, 60);
}
function narrId() { return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function narrTopTerms(tok, k) { return Object.keys(tok).sort((a, b) => tok[b] - tok[a]).slice(0, k || 40); }
function narrRow(r) {
  return { id: r.id, label: r.label || '', summary: r.summary || '', claim: r.claim || '', counter_claim: r.counter_claim || '', proponents: r.proponents || '', issues: pjs(r.issues, []), entities: pjs(r.entities, []), ns: r.ns || '', side: r.side || 'unknown',
    n: r.n || 0, n24: r.n24 || 0, nprev: r.nprev || 0, velocity: Number(r.velocity) || 0, first_ts: r.first_ts || 0, first_item: r.first_item || 0, first_platform: r.first_platform || '', first_channel: r.first_channel || '', last_ts: r.last_ts || 0,
    platforms: pjs(r.platforms, {}), channels: pjs(r.channels, []), spread: pjs(r.spread, []), amplifiers: pjs(r.amplifiers, []), sentiment: pjs(r.sentiment, {}), counter: r.counter || '', status: r.status || 'new',
    alerted: !!r.alerted, alert_ts: r.alert_ts || 0, muted: !!r.muted, pinned: !!r.pinned, edited: !!r.edited, terms: pjs(r.terms, {}), labelled_n: r.labelled_n || 0, model: r.model || '', created: r.created || 0, updated: r.updated || 0 };
}
function narrDay() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
async function narrBudget(env) {
  const cap = Math.max(0, parseInt(env.NARRATIVE_DAILY_CALLS, 10) || NARR_DAILY_CALLS);
  const used = Number(await kvGet(env.AXIOM_KV, 'narr_calls_' + narrDay()) || 0);
  return { used, cap, left: Math.max(0, cap - used), model: env.NARRATIVE_MODEL || env.SENTIMENT_MODEL || SENT_MODEL };
}
/** Recount one narrative from its rows: size, pace, where it is, the order
 *  the channels took it up, who carries it, the sentiment split, and where it
 *  stands toward the client. */
async function narrRefresh(env, id, now) {
  const db = env.MIND_DB;
  const [tot, plats, chans, amps, sent, side, ents] = await db.batch([
    db.prepare('SELECT COUNT(*) n, SUM(ts>?) n24, SUM(ts>? AND ts<=?) nprev, MIN(ts) first_ts, MAX(ts) last_ts FROM narrative_items WHERE narrative=?').bind(now - 86400000, now - 2 * 86400000, now - 86400000, id),
    db.prepare('SELECT platform, COUNT(*) n, MIN(ts) first FROM narrative_items WHERE narrative=? GROUP BY platform ORDER BY first').bind(id),
    db.prepare('SELECT channel, platform, COUNT(*) n FROM narrative_items WHERE narrative=? GROUP BY channel ORDER BY n DESC LIMIT 8').bind(id),
    db.prepare("SELECT ni.channel, ni.platform, a.id, a.title, a.body, a.url, a.ts, COALESCE(json_extract(a.meta,'$.score'),0) score, COALESCE(json_extract(a.meta,'$.comments'),0) comments FROM narrative_items ni JOIN arc_items a ON a.id=ni.item WHERE ni.narrative=? ORDER BY COALESCE(json_extract(a.meta,'$.score'),0) + COALESCE(json_extract(a.meta,'$.comments'),0)*3 DESC, a.ts DESC LIMIT 6").bind(id),
    db.prepare("SELECT SUM(s.tone<-0.2) neg, SUM(s.tone>0.2) pos, COUNT(*) judged, AVG(s.tone) tone FROM narrative_items ni JOIN sent_items s ON s.item=ni.item WHERE ni.narrative=? AND s.model<>'none'").bind(id),
    db.prepare("SELECT AVG(e.stance) st, COUNT(*) k FROM narrative_items ni JOIN sent_entities e ON e.item=ni.item JOIN entities en ON en.id=e.entity WHERE ni.narrative=? AND en.side='client'").bind(id),
    db.prepare('SELECT e.entity, COUNT(*) k FROM narrative_items ni JOIN sent_entities e ON e.item=ni.item WHERE ni.narrative=? GROUP BY e.entity ORDER BY k DESC LIMIT 6').bind(id),
  ]);
  const t = (tot.results || [])[0] || {};
  if (!t.n) return null;
  const platforms = {}; const spread = []; (plats.results || []).forEach(p => { platforms[p.platform || 'unknown'] = p.n; spread.push({ platform: p.platform || 'unknown', first: p.first, n: p.n }); });
  const channels = (chans.results || []).map(c => ({ channel: c.channel || '', platform: c.platform || '', n: c.n }));
  const amplifiers = (amps.results || []).map(a => ({ channel: a.channel || '', platform: a.platform || '', title: String(a.title || a.body || '').replace(/^Comment on:\s*/i, '').slice(0, 160), url: a.url, ts: a.ts, score: Number(a.score) || 0, comments: Number(a.comments) || 0, item: a.id }));
  const s = (sent.results || [])[0] || {}; const sd = (side.results || [])[0] || {};
  const judged = s.judged || 0;
  const sentiment = { judged, neg: s.neg || 0, pos: s.pos || 0, neu: judged - (s.neg || 0) - (s.pos || 0), tone: judged ? Math.round((Number(s.tone) || 0) * 100) / 100 : null };
  const st = sd.k ? Number(sd.st) : null;
  const stand = st == null || sd.k < 2 ? 'unknown' : st <= -0.25 ? 'hostile' : st >= 0.25 ? 'supportive' : 'mixed';
  const entities = (ents.results || []).map(e => e.entity);
  const n24 = t.n24 || 0, nprev = t.nprev || 0;
  const velocity = nprev ? Math.round((n24 / nprev) * 100) / 100 : (n24 ? n24 : 0);
  const fresh = (t.first_ts || 0) > now - 48 * 3600000;
  const status = t.n < NARR_LABEL_MIN ? 'new' : (fresh && t.n >= NARR_ALERT_MIN) ? 'emerging' : (t.last_ts < now - 36 * 3600000 || (nprev && n24 < nprev / 2)) ? 'fading' : (n24 > nprev && n24 >= 3) ? 'growing' : 'steady';
  await db.prepare('UPDATE narratives SET n=?, n24=?, nprev=?, velocity=?, first_ts=?, last_ts=?, platforms=?, spread=?, channels=?, amplifiers=?, sentiment=?, side=?, entities=?, status=?, updated=? WHERE id=?')
    .bind(t.n, n24, nprev, velocity, t.first_ts, t.last_ts, JSON.stringify(platforms), JSON.stringify(spread), JSON.stringify(channels), JSON.stringify(amplifiers), JSON.stringify(sentiment), stand, JSON.stringify(entities), status, now, id).run();
  return { n: t.n, n24, nprev, velocity, status, side: stand, platforms, spread, sentiment, first_ts: t.first_ts, last_ts: t.last_ts };
}
const NARR_SYS = 'You name political narratives for an Australian intelligence platform. A narrative is a claim or story that people keep repeating in different words. For each numbered cluster of texts write: label - at most twelve words, the claim as its proponents would put it, no hashtags, no quotation marks; summary - two plain sentences: what is being said, and in general terms by whom (parties, groups, outlets, ordinary posters - never a private individual\'s name); claim - one sentence, the core assertion; counter - one sentence, the strongest opposing claim as its own proponents would put it, or an empty string when there is none; proponents - a short phrase for who tends to push it (e.g. "Greens and climate groups", "mining industry and Coalition MPs", "Reddit posters"); issues - the ids from the ISSUES list that the cluster is really about, at most three. Reply with strict JSON only: {"clusters":[{"n":1,"label":"...","summary":"...","claim":"...","counter":"...","proponents":"...","issues":["ftc"]}]}.';
async function narrLabelBatch(env, clusters, log) {
  const issuesList = CLIENT_ISSUES.map(ci => ci.id + ' = ' + ci.label).join('; ');
  const user = 'ISSUES: ' + issuesList + '\n\n' + clusters.map((c, i) => '[' + (i + 1) + '] shared terms: ' + c.terms.join(', ') + '; channels: ' + c.chan + '; ' + c.n + ' rows\n' + c.samples.map(s => '- ' + s.replace(/\s+/g, ' ').slice(0, 320)).join('\n')).join('\n\n');
  const model = (await narrBudget(env)).model;
  let parsed = null;
  for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
    const txt = await claudeMsg(env, NARR_SYS + (attempt ? ' Your previous answer was not valid JSON; answer with the JSON object only.' : ''), user, 300 + clusters.length * 260, 45000, model);
    parsed = relJson(txt); if (!parsed || !Array.isArray(parsed.clusters)) parsed = null;
  }
  if (!parsed) throw new Error('the naming model answered without valid JSON');
  const known = new Set(CLIENT_ISSUES.map(ci => ci.id));
  const out = [];
  parsed.clusters.forEach(cl => { const c = clusters[parseInt(cl.n, 10) - 1]; if (!c) return; out.push({ id: c.id, label: String(cl.label || '').replace(/^["']|["']$/g, '').slice(0, 140), summary: String(cl.summary || '').slice(0, 600), claim: String(cl.claim || '').slice(0, 300), counter: String(cl.counter || '').slice(0, 300), proponents: String(cl.proponents || '').slice(0, 120), issues: (Array.isArray(cl.issues) ? cl.issues : []).map(String).filter(x => known.has(x)).slice(0, 3), model }); });
  return out;
}
/** Name the narratives that have earned it (three rows, or doubled since
 *  their last naming), five to a call, within the day's budget. */
async function narrLabel(env, ids, log) {
  const db = env.MIND_DB; const now = Date.now();
  const marks = ids.map(() => '?').join(',');
  const rows = ids.length ? (await db.prepare('SELECT * FROM narratives WHERE id IN (' + marks + ') AND muted=0 AND edited=0 AND n>=? AND (label=\'\' OR labelled_n*2<=n)').bind(...ids, NARR_LABEL_MIN).all()).results || [] : [];
  const out = { named: 0, calls: 0, errors: [] };
  if (!rows.length) return out;
  const budget = await narrBudget(env);
  const clusters = [];
  for (const r of rows) {
    const items = (await db.prepare('SELECT a.kind, a.title, a.body, a.ts, ni.channel FROM narrative_items ni JOIN arc_items a ON a.id=ni.item WHERE ni.narrative=? ORDER BY ni.ts').bind(r.id).all()).results || [];
    if (!items.length) continue;
    const pick = []; const seen = new Set();
    const add = it => { if (!it) return; const t = narrText(it); if (t.length < 15 || seen.has(t.slice(0, 80))) return; seen.add(t.slice(0, 80)); pick.push(t); };
    add(items[0]); add(items[items.length - 1]);
    const step = Math.max(1, Math.floor(items.length / 4));
    for (let i = step; i < items.length && pick.length < 6; i += step) add(items[i]);
    const chan = pjs(r.channels, []).slice(0, 4).map(c => c.channel).join(', ') || pjs(r.spread, []).map(s => s.platform).join(', ');
    clusters.push({ id: r.id, n: r.n, terms: narrTopTerms(pjs(r.terms, {}), 8), chan, samples: pick });
  }
  for (let i = 0; i < clusters.length; i += 5) {
    if (out.calls >= budget.left) { out.errors.push('naming budget of ' + budget.cap + ' calls reached; ' + (clusters.length - i) + ' narratives stay unnamed until tomorrow'); await log('err', out.errors[out.errors.length - 1]); break; }
    const batch = clusters.slice(i, i + 5);
    await log('cmd', 'claude ' + budget.model + ' name ' + batch.length + ' narrative' + (batch.length === 1 ? '' : 's') + ' (' + batch.map(c => c.n + ' rows').join(', ') + ')');
    let named;
    try { named = await narrLabelBatch(env, batch, log); out.calls++; await kvPut(env.AXIOM_KV, 'narr_calls_' + narrDay(), String(budget.used + out.calls), 2 * 86400); }
    catch (e) { out.calls++; await kvPut(env.AXIOM_KV, 'narr_calls_' + narrDay(), String(budget.used + out.calls), 2 * 86400); const m = String((e && e.message) || e).slice(0, 160); out.errors.push(m); await log('err', m); continue; }
    const stmts = named.map(x => { const ns = (CLIENT_ISSUES.find(ci => ci.id === x.issues[0]) || {}).ns || ''; return db.prepare('UPDATE narratives SET label=?, summary=?, claim=?, counter_claim=?, proponents=?, issues=CASE WHEN ?<>\'[]\' THEN ? ELSE issues END, ns=CASE WHEN ?<>\'\' THEN ? ELSE ns END, labelled_n=n, model=?, updated=? WHERE id=?').bind(x.label, x.summary, x.claim, x.counter, x.proponents, JSON.stringify(x.issues), JSON.stringify(x.issues), ns, ns, x.model, now, x.id); });
    if (stmts.length) await db.batch(stmts);
    out.named += named.length;
    named.forEach(x => log('out', '"' + x.label + '"' + (x.issues.length ? ' [' + x.issues.join(', ') + ']' : '')));
  }
  return out;
}
/** Two narratives on the same issue facing opposite ways toward the client are each other's counter. */
async function narrCounters(env) {
  const db = env.MIND_DB;
  const rows = ((await db.prepare("SELECT id, issues, side, n FROM narratives WHERE label<>'' AND muted=0 AND n>=? AND last_ts>? AND side IN ('hostile','supportive')").bind(NARR_LABEL_MIN, Date.now() - 14 * 86400000).all()).results || []).map(r => ({ id: r.id, issue: (pjs(r.issues, []))[0] || '', side: r.side, n: r.n }));
  const stmts = [];
  rows.forEach(a => {
    if (!a.issue) return;
    const opp = rows.filter(b => b.id !== a.id && b.issue === a.issue && b.side !== a.side).sort((x, y) => y.n - x.n)[0];
    stmts.push(db.prepare('UPDATE narratives SET counter=? WHERE id=?').bind(opp ? opp.id : '', a.id));
  });
  for (let i = 0; i < stmts.length; i += 100) await db.batch(stmts.slice(i, i + 100));
  return stmts.length;
}
/** A named narrative that is new, has reached NARR_ALERT_MIN rows and touches a client issue is reported to that client's Slack once. */
async function narrAlerts(env, log) {
  const db = env.MIND_DB; const now = Date.now();
  const rows = (await db.prepare("SELECT * FROM narratives WHERE status='emerging' AND alerted=0 AND muted=0 AND label<>'' AND issues<>'[]'").all()).results || [];
  const sent = [];
  for (const r0 of rows) {
    const r = narrRow(r0);
    const ci = CLIENT_ISSUES.find(c => c.id === r.issues[0]) || {};
    const hostile = r.sentiment.judged ? Math.round(r.sentiment.neg / r.sentiment.judged * 100) : null;
    const lines = [
      ':rotating_light: *Emerging narrative* for *' + (ci.client || 'Curious Minds') + '* (' + (ci.label || r.issues[0]) + ')',
      '*' + r.label.replace(/[<>|*]/g, ' ') + '*',
      '`first seen ' + (r.first_platform || Object.keys(r.platforms)[0] || '?') + ' ' + Math.round((now - r.first_ts) / 3600000) + 'h ago - ' + r.n + ' rows across ' + Object.keys(r.platforms).length + ' channel' + (Object.keys(r.platforms).length === 1 ? '' : 's') + ' - ' + (r.nprev ? r.velocity + 'x yesterday\'s pace' : r.n24 + ' in 24h') + (hostile == null ? '' : ' - ' + hostile + '% hostile') + ' - ' + r.side + ' toward the client`',
    ];
    if (r.claim) lines.push('*Claim*  ' + r.claim);
    if (r.counter_claim) lines.push('*Counter*  ' + r.counter_claim);
    if (r.proponents) lines.push('*Carried by*  ' + r.proponents);
    const order = r.spread.map(s => s.platform).join(' > ');
    if (order) lines.push('*Spread*  ' + order + (r.channels.length ? ' - busiest: ' + r.channels.slice(0, 3).map(c => c.channel).join(', ') : ''));
    const ev = r.amplifiers.filter(a => /^https?:/.test(a.url || '')).slice(0, 3);
    if (ev.length) { lines.push('', '*Evidence*'); ev.forEach(a => lines.push('- <' + a.url + '|' + a.title.replace(/[<>|]/g, ' ').slice(0, 110) + '> _(' + (a.channel || a.platform) + ')_')); }
    lines.push('', '_AXIOM Narratives - open the Narratives view for every row._');
    const ok = await slackPost(env, ci.ns || '_default', lines.join('\n'));
    await db.prepare('UPDATE narratives SET alerted=?, alert_ts=? WHERE id=?').bind(ok ? 1 : 2, now, r.id).run();
    sent.push({ id: r.id, label: r.label, slack: ok });
    await log('info', (ok ? 'Slack told about ' : 'no Slack webhook for ') + '"' + r.label + '"');
  }
  return sent;
}
/** The run: place the newest rows, recount what changed, name what has
 *  earned a name, pair counters, raise alerts. */
async function narrativesRun(env, opts) {
  opts = opts || {}; const log = opts.log || (async () => {});
  if (!(await ensureNarratives(env)) || !(await ensureArchive(env)) || !(await ensureSentiment(env))) return { ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' };
  const db = env.MIND_DB; const now = Date.now();
  const hours = Math.min(Math.max(parseInt(opts.hours, 10) || NARR_WINDOW_H, 1), 24 * 14);
  const scan = Math.min(Math.max(parseInt(opts.scan, 10) || NARR_SCAN, 1), 1000);
  const kinds = SENT_KINDS.map(() => '?').join(',');
  const rows = (await db.prepare('SELECT a.id, a.kind, a.src, a.title, a.body, a.url, a.ts, a.meta FROM arc_items a LEFT JOIN narrative_items ni ON ni.item=a.id WHERE ni.item IS NULL AND a.ts>? AND a.kind IN (' + kinds + ') ORDER BY a.ts ASC LIMIT ?').bind(now - hours * 3600000, ...SENT_KINDS, scan).all()).results || [];
  const liveRows = (await db.prepare('SELECT id, issues, entities, n, first_ts, last_ts, terms, centroid, dim FROM narratives WHERE last_ts>? AND muted=0').bind(now - NARR_LIVE_H * 3600000).all()).results || [];
  const live = liveRows.map(r => ({ id: r.id, issues: new Set(pjs(r.issues, [])), ents: new Set(pjs(r.entities, [])), n: r.n || 0, vec: b64f32(r.centroid), tok: pjs(r.terms, {}), first_ts: r.first_ts || 0, last_ts: r.last_ts || 0, fresh: false, touched: false }));
  const out = { ok: true, scanned: rows.length, placed: 0, joined: 0, started: 0, skipped: 0, live: live.length, named: 0, calls: 0, alerts: 0, mode: env.AI ? 'embeddings' : 'terms', errors: [] };
  const texts = rows.map(narrText);
  const vecs = await narrEmbed(env, texts.map(t => t || ' '));
  if (!vecs && env.AI) { out.mode = 'terms (embedding failed)'; }
  const matcher = await entityMatcher(env);
  await log('info', out.scanned + ' rows of the last ' + hours + 'h not yet placed; ' + live.length + ' live narratives; matching by ' + out.mode);
  const itemStmts = []; const touched = new Set();
  rows.forEach((r, i) => {
    let meta = {}; try { meta = JSON.parse(r.meta || '{}') || {}; } catch (e) { meta = {}; }
    const text = texts[i];
    const platform = platformOf(r.kind, meta); const channel = narrChannel(r.kind, meta, r.src);
    if (text.length < 20) { itemStmts.push(db.prepare('INSERT OR REPLACE INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,?,?,0)').bind(r.id, '', r.ts || now, platform, channel)); out.skipped++; return; }
    const tokens = narrTokens(text); const tv = tokenVec(tokens);
    const issues = new Set(Array.isArray(meta.issues) ? meta.issues : issueTag(text));
    const ents = new Set(matcher.match(text));
    const v = vecs ? vecs[i] : null;
    let best = null, bestSim = 0;
    for (const c of live) {
      const sim = v && c.vec ? vecCos(v, c.vec) : tokenCos(tv, c.tok);
      const anchor = [...issues].some(x => c.issues.has(x)) || [...ents].some(x => c.ents.has(x));
      const thr = v && c.vec ? (anchor ? NARR_SIM : NARR_SIM_STRICT) : (anchor ? NARR_TOKEN_SIM : NARR_TOKEN_SIM + 0.15);
      if (sim >= thr && sim > bestSim) { best = c; bestSim = sim; }
    }
    if (best) {
      if (v && best.vec) { const k = best.n; best.vec = best.vec.map((x, j) => (x * k + v[j]) / (k + 1)); }
      for (const t in tv) best.tok[t] = (best.tok[t] || 0) + tv[t];
      issues.forEach(x => best.issues.add(x)); ents.forEach(x => best.ents.add(x));
      best.n++; best.last_ts = Math.max(best.last_ts, r.ts || now); best.first_ts = Math.min(best.first_ts || r.ts, r.ts || now); best.touched = true;
      itemStmts.push(db.prepare('INSERT OR REPLACE INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,?,?,?)').bind(r.id, best.id, r.ts || now, platform, channel, Math.round(bestSim * 1000) / 1000));
      touched.add(best.id); out.joined++;
    } else {
      const c = { id: narrId(), issues, ents, n: 1, vec: v, tok: tv, first_ts: r.ts || now, last_ts: r.ts || now, fresh: true, touched: true, first_item: r.id, first_platform: platform, first_channel: channel };
      live.push(c);
      itemStmts.push(db.prepare('INSERT OR REPLACE INTO narrative_items(item,narrative,ts,platform,channel,sim) VALUES(?,?,?,?,?,1)').bind(r.id, c.id, r.ts || now, platform, channel));
      touched.add(c.id); out.started++;
    }
    out.placed++;
  });
  // write placements and centres
  const nStmts = [];
  live.filter(c => c.touched).forEach(c => {
    const terms = {}; narrTopTerms(c.tok, 40).forEach(t => { terms[t] = Math.round(c.tok[t] * 1000) / 1000; });
    if (c.fresh) nStmts.push(db.prepare("INSERT INTO narratives(id,label,summary,claim,counter_claim,proponents,issues,entities,ns,side,n,n24,nprev,velocity,first_ts,first_item,first_platform,first_channel,last_ts,platforms,channels,spread,amplifiers,sentiment,counter,status,alerted,alert_ts,muted,pinned,edited,terms,centroid,dim,labelled_n,model,created,updated) VALUES(?,'','','','','',?,?,?,'unknown',?,0,0,0,?,?,?,?,?,'{}','[]','[]','[]','{}','','new',0,0,0,0,0,?,?,?,0,'',?,?) ON CONFLICT(id) DO NOTHING")
      .bind(c.id, JSON.stringify([...c.issues]), JSON.stringify([...c.ents].slice(0, 12)), (CLIENT_ISSUES.find(ci => c.issues.has(ci.id)) || {}).ns || '', c.n, c.first_ts, c.first_item, c.first_platform, c.first_channel, c.last_ts, JSON.stringify(terms), c.vec ? f32b64(c.vec) : '', c.vec ? c.vec.length : 0, now, now));
    else nStmts.push(db.prepare("UPDATE narratives SET issues=?, entities=?, ns=CASE WHEN ns='' THEN ? ELSE ns END, n=?, last_ts=?, first_ts=?, terms=?, centroid=?, dim=?, updated=? WHERE id=?")
      .bind(JSON.stringify([...c.issues]), JSON.stringify([...c.ents].slice(0, 12)), (CLIENT_ISSUES.find(ci => c.issues.has(ci.id)) || {}).ns || '', c.n, c.last_ts, c.first_ts, JSON.stringify(terms), c.vec ? f32b64(c.vec) : '', c.vec ? c.vec.length : 0, now, c.id));
  });
  for (let i = 0; i < itemStmts.length; i += 100) await db.batch(itemStmts.slice(i, i + 100));
  for (let i = 0; i < nStmts.length; i += 50) await db.batch(nStmts.slice(i, i + 50));
  await log('out', out.placed + ' rows placed: ' + out.joined + ' joined a live narrative, ' + out.started + ' started one; ' + out.skipped + ' too short to place');
  // recount what changed, plus narratives that need their pace re-read
  const stale = ((await db.prepare('SELECT id FROM narratives WHERE muted=0 AND last_ts>? AND updated<?').bind(now - 7 * 86400000, now - 6 * 3600000).all()).results || []).map(r => r.id);
  const ids = Array.from(new Set([...touched, ...stale])).slice(0, 250);
  let recounted = 0;
  for (const id of ids) { try { if (await narrRefresh(env, id, now)) recounted++; } catch (e) { out.errors.push('recount ' + id + ': ' + String((e && e.message) || e).slice(0, 80)); } }
  await log('info', recounted + ' narratives recounted (size, pace, spread, sentiment split, stance toward the client)');
  // names, counters, alerts
  if (env.ANTHROPIC_API_KEY) { try { const nm = await narrLabel(env, ids, log); out.named = nm.named; out.calls = nm.calls; out.errors.push(...nm.errors); } catch (e) { out.errors.push(String((e && e.message) || e).slice(0, 120)); } }
  else await log('info', 'ANTHROPIC_API_KEY is not set: narratives stay unnamed (their terms and rows are still here)');
  try { await narrCounters(env); } catch (e) { out.errors.push('counters: ' + String((e && e.message) || e).slice(0, 80)); }
  try { const al = await narrAlerts(env, log); out.alerts = al.length; } catch (e) { out.errors.push('alerts: ' + String((e && e.message) || e).slice(0, 80)); }
  // singletons that never grew are noise: gone after a week
  try { const old = ((await db.prepare('SELECT id FROM narratives WHERE n<2 AND last_ts<?').bind(now - 7 * 86400000).all()).results || []).map(r => r.id); for (let i = 0; i < old.length; i += 90) { const part = old.slice(i, i + 90); const m = part.map(() => '?').join(','); await db.batch([db.prepare('DELETE FROM narrative_items WHERE narrative IN (' + m + ')').bind(...part), db.prepare('DELETE FROM narratives WHERE id IN (' + m + ')').bind(...part)]); } out.pruned = old.length; } catch (e) {}
  out.ms = Date.now() - now;
  await log('info', out.named + ' named, ' + out.alerts + ' alert' + (out.alerts === 1 ? '' : 's') + ' raised (' + out.ms + 'ms)');
  if (out.errors.length && !out.placed && !out.named) { out.ok = false; out.detail = out.errors[0]; }
  await kvPut(env.AXIOM_KV, 'narr_last', JSON.stringify(Object.assign({ at: now }, out)).slice(0, 4000), 7 * 86400);
  return out;
}
async function narrativesCron(env) {
  if (!env.MIND_DB) return { ok: false, skipped: true };
  return narrativesRun(env, {});
}
async function narrativesList(env, f) {
  f = f || {};
  const days = Math.min(Math.max(parseInt(f.days, 10) || 7, 1), 90);
  const since = Date.now() - days * 86400000;
  const w = ['last_ts>?', 'muted=?']; const b = [since, f.muted ? 1 : 0];
  if (f.issue) { w.push('issues LIKE ?'); b.push('%"' + String(f.issue).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
  if (f.ns) { w.push('ns=?'); b.push(String(f.ns).slice(0, 24)); }
  if (f.status) { w.push('status=?'); b.push(String(f.status).slice(0, 12)); }
  if (f.platform) { w.push('platforms LIKE ?'); b.push('%"' + String(f.platform).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
  if (f.side) { w.push('side=?'); b.push(String(f.side).slice(0, 12)); }
  if (f.entity) { w.push('entities LIKE ?'); b.push('%"' + String(f.entity).replace(/[^a-z0-9_-]/gi, '') + '"%'); }
  if (f.q) { w.push("(label LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR terms LIKE ? ESCAPE '\\')"); const l = arcLike(String(f.q).slice(0, 80)); b.push(l, l, l); }
  if (!f.all) w.push('n>=?'), b.push(2);
  const sort = f.sort === 'n' ? 'n DESC' : f.sort === 'new' ? 'first_ts DESC' : f.sort === 'latest' ? 'last_ts DESC' : 'velocity DESC, n DESC';
  const limit = Math.min(Math.max(parseInt(f.limit, 10) || 80, 1), 300);
  const rows = (await env.MIND_DB.prepare('SELECT * FROM narratives WHERE ' + w.join(' AND ') + ' ORDER BY pinned DESC, ' + sort + ' LIMIT ?').bind(...b, limit).all()).results || [];
  const list = rows.map(narrRow).map(r => { delete r.terms; return Object.assign(r, { issueLabels: r.issues.map(id => (CLIENT_ISSUES.find(ci => ci.id === id) || { label: id }).label), client: (CLIENT_ISSUES.find(ci => ci.ns === r.ns) || {}).client || '' }); });
  return { ok: true, days, narratives: list, statuses: ['emerging', 'growing', 'steady', 'fading', 'new'], sides: ['hostile', 'supportive', 'mixed', 'unknown'] };
}
/** Milliseconds Sydney is ahead of UTC at the given instant (AEST 10h, AEDT
 *  11h), so day buckets follow Australian days rather than UTC ones. */
function auOffsetMs(at) {
  try {
    const parts = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at));
    const g = k => Number((parts.find(p => p.type === k) || {}).value || 0);
    const local = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
    return Math.round((local - Math.floor(at / 1000) * 1000) / 60000) * 60000;
  } catch (e) { return 10 * 3600000; }
}
async function narrativeOne(env, id) {
  const r0 = await env.MIND_DB.prepare('SELECT * FROM narratives WHERE id=?').bind(id).first();
  if (!r0) return null;
  const r = narrRow(r0);
  r.termsTop = narrTopTerms(r.terms, 12); delete r.terms;
  const items = (await env.MIND_DB.prepare("SELECT a.id, a.kind, a.src, a.title, a.body, a.url, a.ts, ni.platform, ni.channel, ni.sim, COALESCE(json_extract(a.meta,'$.score'),0) score, COALESCE(json_extract(a.meta,'$.comments'),0) comments, s.tone, json_extract(a.meta,'$.mp') mp FROM narrative_items ni JOIN arc_items a ON a.id=ni.item LEFT JOIN sent_items s ON s.item=a.id WHERE ni.narrative=? ORDER BY ni.ts DESC LIMIT 120").bind(id).all()).results || [];
  r.items = items.map(it => ({ id: it.id, kind: it.kind, src: it.src, platform: it.platform, channel: it.channel, ts: it.ts, title: String(it.title || '').replace(/^Comment on:\s*/i, '').slice(0, 300), excerpt: String(it.body || '').replace(/\s+/g, ' ').slice(0, 400), url: it.url, sim: it.sim, score: Number(it.score) || 0, comments: Number(it.comments) || 0, tone: it.tone == null ? null : Math.round(Number(it.tone) * 100) / 100, mp: pjs(it.mp, null) }));
  r.origin = r.items.length ? r.items[r.items.length - 1] : null;
  if (r.counter) { const c = await env.MIND_DB.prepare('SELECT id, label, side, n, velocity, status FROM narratives WHERE id=?').bind(r.counter).first(); r.counterNarrative = c ? { id: c.id, label: c.label, side: c.side, n: c.n, velocity: c.velocity, status: c.status } : null; }
  r.issueLabels = r.issues.map(x => (CLIENT_ISSUES.find(ci => ci.id === x) || { label: x }).label);
  r.client = (CLIENT_ISSUES.find(ci => ci.ns === r.ns) || {}).client || '';
  const off = auOffsetMs(Date.now());
  const series = (await env.MIND_DB.prepare('SELECT CAST((ts+?)/86400000 AS INTEGER) d, COUNT(*) n, platform FROM narrative_items WHERE narrative=? GROUP BY d, platform ORDER BY d').bind(off, id).all()).results || [];
  const byDay = {}; series.forEach(s => { const k = s.d * 86400000 - off; byDay[k] = byDay[k] || { t: k, n: 0, platforms: {} }; byDay[k].n += s.n; byDay[k].platforms[s.platform || 'unknown'] = s.n; });
  r.series = Object.values(byDay).sort((a, b) => a.t - b.t);
  return r;
}
async function narrativesStatus(env) {
  const now = Date.now();
  const c = (await env.MIND_DB.prepare("SELECT SUM(last_ts>? AND n>=2 AND muted=0) live, SUM(status='emerging' AND muted=0) emerging, SUM(status='growing' AND muted=0) growing, SUM(label<>'') named, SUM(alerted=1) alerted, COUNT(*) total FROM narratives").bind(now - NARR_LIVE_H * 3600000).first()) || {};
  const placed = (await env.MIND_DB.prepare('SELECT COUNT(*) n, SUM(ts>?) n24 FROM narrative_items WHERE narrative<>\'\'').bind(now - 86400000).first()) || {};
  const kinds = SENT_KINDS.map(() => '?').join(',');
  const backlog = (await env.MIND_DB.prepare('SELECT COUNT(*) n FROM arc_items a LEFT JOIN narrative_items ni ON ni.item=a.id WHERE ni.item IS NULL AND a.ts>? AND a.kind IN (' + kinds + ')').bind(now - NARR_WINDOW_H * 3600000, ...SENT_KINDS).first()) || {};
  let last = null; try { last = JSON.parse((await kvGet(env.AXIOM_KV, 'narr_last')) || 'null'); } catch (e) { last = null; }
  return { ok: true, live: c.live || 0, emerging: c.emerging || 0, growing: c.growing || 0, named: c.named || 0, alerted: c.alerted || 0, total: c.total || 0, placed: placed.n || 0, placed24: placed.n24 || 0, backlog: backlog.n || 0, embeddings: !!env.AI, naming: !!env.ANTHROPIC_API_KEY, budget: await narrBudget(env), last, perRun: NARR_SCAN, windowHours: NARR_WINDOW_H, alertMin: NARR_ALERT_MIN };
}

// ============================================================================
// THE OVERVIEW - the front page: what changed, why it matters, where the
// evidence is. Nothing here is computed fresh from raw text; it is the
// narratives, stances, alerts, sources and rows the other modules already
// keep, read together for one window and ranked by movement.
// ============================================================================
const OVERVIEW_KINDS = ['news', 'reddit_thread', 'sig_thread', 'reddit_comment', 'sig_comment', 'comments'];
const OVERVIEW_LATEST_KINDS = ['news', 'reddit_thread', 'sig_thread'];
/** Rows tagged with each client issue in the window against that issue's own
 *  average for the same window length over the rest of the last fourteen days. */
async function overviewIssues(env, now, hours) {
  const marks = OVERVIEW_KINDS.map(() => '?').join(',');
  const since14 = now - 14 * 86400000, sinceH = now - hours * 3600000;
  const rows = (await env.MIND_DB.prepare("SELECT je.value id, SUM(a.ts>?) recent, COUNT(*) n14, SUM(a.ts>? AND a.kind='news') news_recent FROM arc_items a, json_each(json_extract(a.meta,'$.issues')) je WHERE a.ts>? AND a.kind IN (" + marks + ') GROUP BY je.value').bind(sinceH, sinceH, since14, ...OVERVIEW_KINDS).all()).results || [];
  const byId = {}; rows.forEach(r => { byId[r.id] = r; });
  const windows = Math.max(1, (14 * 24 - hours) / hours);
  return CLIENT_ISSUES.map(ci => {
    const r = byId[ci.id] || {}; const recent = Number(r.recent) || 0; const n14 = Number(r.n14) || 0;
    const base = Math.round(((n14 - recent) / windows) * 10) / 10;
    const ratio = base > 0 ? Math.round((recent / base) * 10) / 10 : (recent ? null : 0);
    return { id: ci.id, label: ci.label, client: ci.client, ns: ci.ns, recent, news: Number(r.news_recent) || 0, base, ratio, n14 };
  }).sort((a, b) => ((b.recent - b.base) - (a.recent - a.base)) || (b.recent - a.recent));
}
/** The newest rows on any client issue: a headline, a thread, a post. */
async function overviewLatest(env, now, hours, limit) {
  const marks = OVERVIEW_LATEST_KINDS.map(() => '?').join(',');
  const rows = (await env.MIND_DB.prepare("SELECT id, kind, src, title, url, ts, tone, meta FROM arc_items WHERE ts>? AND kind IN (" + marks + ") AND json_array_length(COALESCE(json_extract(meta,'$.issues'),'[]'))>0 ORDER BY ts DESC LIMIT ?").bind(now - hours * 3600000, ...OVERVIEW_LATEST_KINDS, limit).all()).results || [];
  return rows.map(r => {
    const m = pjs(r.meta, {});
    return { id: r.id, kind: r.kind, platform: platformOf(r.kind, m), src: r.src || '', channel: m.sub ? 'r/' + m.sub : String(m.page_name || m.outlet || m.source || r.src || '').slice(0, 60), title: String(r.title || '').replace(/^Comment on:\s*/i, '').slice(0, 200), url: /^https?:/.test(r.url || '') ? r.url : '', ts: r.ts, tone: r.tone == null ? null : Number(r.tone), issues: (Array.isArray(m.issues) ? m.issues : []).slice(0, 3), score: Number(m.score) || 0, comments: Number(m.comments) || 0 };
  });
}
function overviewAlertRow(r) {
  return { id: r.id, ns: r.ns, client: r.client, issue: r.issue, label: r.label, severity: r.severity, hot: r.hot, baseline: r.baseline, ratio: r.ratio, srcs: r.srcs, tone: r.tone, detected: r.detected_ts, notified: r.notified_ts, acked: r.acked_ts, drafted: r.drafted_ts, open: !r.acked_ts, angle: r.angle ? (pjs(r.angle, null) || null) : null };
}
async function overview(env, opts) {
  opts = opts || {};
  const now = Date.now();
  const days = Math.min(Math.max(parseFloat(opts.days) || 1, 0.25), 7);
  const hours = Math.round(days * 24);
  const wholeDays = String(Math.max(1, Math.ceil(days)));
  await ensureArchive(env); await ensureSentiment(env); await ensureNarratives(env); await ensureSentinel(env); await ensureSources(env);
  const soft = async (fn, fallback) => { try { return await fn(); } catch (e) { return Object.assign({}, fallback || {}, { error: String((e && e.message) || e).slice(0, 160) }); } };
  const [narr, sent, sentSt, narrSt, alertRows, issues, latest, src, tot] = await Promise.all([
    soft(() => narrativesList(env, { days: String(Math.max(4, Math.ceil(days))), limit: 80 }), { narratives: [] }),
    soft(() => sentimentEntities(env, { days: wholeDays }), { entities: [] }),
    soft(() => sentimentStatus(env), {}),
    soft(() => narrativesStatus(env), {}),
    soft(async () => ({ rows: (await env.MIND_DB.prepare('SELECT * FROM arc_alerts WHERE detected_ts>? ORDER BY detected_ts DESC LIMIT 30').bind(now - 7 * 86400000).all()).results || [] }), { rows: [] }),
    soft(() => overviewIssues(env, now, hours), []),
    soft(() => overviewLatest(env, now, hours, 30), []),
    soft(() => sourcesList(env, {}), { summary: {} }),
    soft(async () => (await env.MIND_DB.prepare("SELECT COUNT(*) n, SUM(kind='news') news FROM arc_items WHERE ts>? AND kind IN (" + OVERVIEW_KINDS.map(() => '?').join(',') + ") AND json_array_length(COALESCE(json_extract(meta,'$.issues'),'[]'))>0").bind(now - hours * 3600000, ...OVERVIEW_KINDS).first()) || {}, {}),
  ]);
  const sinceH = now - hours * 3600000;
  const narrs = (narr.narratives || []).map(n => ({ id: n.id, label: n.label, client: n.client || '', issues: n.issues || [], issueLabels: n.issueLabels || [], ns: n.ns, side: n.side, n: n.n, n24: n.n24, nprev: n.nprev, velocity: n.velocity, status: n.status, first_ts: n.first_ts, first_platform: n.first_platform, first_channel: n.first_channel, last_ts: n.last_ts, platforms: Object.keys(n.platforms || {}), sentiment: n.sentiment || {}, alerted: !!n.alerted, counter: n.counter || '', proponents: n.proponents || '' }));
  const moving = narrs.filter(n => n.n24 > 0 && (n.status === 'emerging' || n.status === 'growing' || n.status === 'new' || n.first_ts > sinceH || (n.nprev && n.velocity >= 1.5))).sort((a, b) => (b.n24 - a.n24) || (b.velocity - a.velocity)).slice(0, 10);
  const fading = narrs.filter(n => n.status === 'fading' && n.n >= 5).slice(0, 4);
  const ents = (sent.entities || []).filter(e => e.n >= 3);
  const movers = ents.filter(e => e.change != null && e.prev && e.prev.n >= 3).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8);
  const loudest = ents.slice().sort((a, b) => b.n - a.n).slice(0, 6);
  const hostileTo = ents.filter(e => e.side === 'client' && e.n >= 5).sort((a, b) => a.score - b.score).slice(0, 4);
  const alerts = (alertRows.rows || []).map(overviewAlertRow);
  const open = alerts.filter(a => a.open);
  const s = src.summary || {};
  const totals = { rows: Number(tot.n) || 0, news: Number(tot.news) || 0, tagged: (issues || []).reduce((a, i) => a + (i.recent || 0), 0) };
  let social = {}; try { social = JSON.parse((await kvGet(env.AXIOM_KV, 'social_last')) || '{}'); } catch (e) { social = {}; }
  const socialRows = Object.keys(social || {}).filter(k => social[k] && typeof social[k] === 'object').map(k => { const v = social[k]; return { platform: k, ok: v.ok !== false && !v.error, filed: v.filed != null ? v.filed : v.added != null ? v.added : v.n != null ? v.n : null, at: v.at || v.ts || null, error: String(v.error || '').slice(0, 120) }; });
  return {
    ok: true, at: now, days, hours,
    alerts: { open, recent: alerts.slice(0, 10), openCount: open.length },
    narratives: { moving, fading, live: narrSt.live || 0, emerging: narrSt.emerging || 0, growing: narrSt.growing || 0, placed24: narrSt.placed24 || 0, backlog: narrSt.backlog || 0, error: narr.error || narrSt.error || '' },
    sentiment: { movers, loudest, hostileTo, judged24: sentSt.classified24 || 0, backlog: sentSt.backlog || 0, budget: sentSt.budget || null, configured: sentSt.configured !== false, error: sent.error || sentSt.error || '' },
    issues: Array.isArray(issues) ? issues : [], totals,
    latest: Array.isArray(latest) ? latest : [],
    collection: { sources: { total: s.total || 0, delivering: s.ok || 0, failing: s.failing || 0, dead: s.dead || 0, unverified: s.unverified || 0, items24: s.items24 || 0, lastSweep: src.lastSweep || null, error: src.error || '' }, social: socialRows },
    errors: [narr.error, sent.error, sentSt.error, narrSt.error, alertRows.error, issues.error, latest.error, src.error, tot.error].filter(Boolean),
  };
}

// ==============================================================================
// ACCESS CONTROL - per-person keys with roles, plus the legacy single key.
// ==============================================================================
/** Compare in time that does not depend on where the first difference falls,
 *  so a wrong key cannot be walked one character at a time. */
function ctEq(a, b) {
  a = String(a || ''); b = String(b || '');
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function axAuth(req, env) {
  const supplied = req.headers.get('X-Axiom-Key') || '';
  let roster = null;
  if (env.AXIOM_KEYS) { try { roster = JSON.parse(env.AXIOM_KEYS); } catch (e) { roster = null; } }
  const enforced = !!(env.AXIOM_ACCESS_KEY || (roster && Object.keys(roster).length));
  if (!enforced) return { enforced: false, ok: true, role: 'full', name: 'open' };
  if (env.AXIOM_ACCESS_KEY && ctEq(supplied, env.AXIOM_ACCESS_KEY)) {
    return { enforced: true, ok: true, role: 'full', name: 'admin' };
  }
  let who = null;
  if (roster) for (const k of Object.keys(roster)) { if (ctEq(supplied, k)) { who = roster[k]; break; } }
  if (who) {
    return { enforced: true, ok: true, role: (who.r === 'read' ? 'read' : 'full'), name: String(who.n || 'user').slice(0, 40) };
  }
  return { enforced: true, ok: false, role: null, name: '' };
}

// ==============================================================================
// THE SENTINEL - watches the wire for spikes on the issues our clients own,
// drafts an angle, and pushes it to the team within minutes. Every alert
// carries lifecycle timestamps so "speed to respond" is measured, not guessed.
// ==============================================================================
const SENTINEL = {
  HOT_HOURS: 6,          // the window we call "right now"
  BASE_DAYS: 14,         // history the baseline is drawn from
  MIN_HOT: 3,            // never alert on fewer than this many stories
  MIN_RATIO: 2.5,        // stories vs baseline before it counts as a spike
  COOLDOWN_H: 12,        // one alert per issue per this many hours...
  ESCALATE: 1.6,         // ...unless intensity grows by this factor
};
/* The issues AXIOM's clients actually own. ns must match the Mind namespace.
 * Each issue carries three things, and the difference matters:
 *   rx    - the tight trigger. What counts as a story about this issue when the
 *           Sentinel decides whether volume has spiked. Kept narrow on purpose:
 *           a loose trigger here means an alert every time someone says "gas".
 *   wide  - the broad matcher used when COLLECTING and tagging (Reddit threads
 *           and comments, Meta comments, the Command Center orbit). Sweeping
 *           wide costs nothing but disk; missing the conversation costs the
 *           client. Use issueTag() for this, never rx.
 *   q     - Reddit search terms. The keyword sweep runs these across all of
 *           Reddit, so we find the argument wherever it happens rather than
 *           only in the subs we happen to watch.
 */
const CLIENT_ISSUES = [
  { ns: 'mca', client: 'Minerals Council of Australia', id: 'ftc', label: 'Fuel tax credits', map: 'i_ftc',
    rx: /fuel tax credit|diesel rebate|diesel fuel rebate|fuel excise credit/i,
    wide: /fuel tax credits?|fuel tax|diesel (fuel )?rebate|fuel excise|excise credit|hands off our fuel|\bhoof\b|off-?road diesel|diesel (tax|price|cost|subsid)|fuel (levy|subsid)/i,
    q: ['fuel tax credit', 'diesel rebate', 'fuel excise', 'hands off our fuel'] },
  { ns: 'mca', client: 'Minerals Council of Australia', id: 'cm', label: 'Critical minerals', map: 'i_cm',
    rx: /critical minerals?|rare earths?|gallium|antimony|strategic reserve/i,
    wide: /critical minerals?|rare earths?|gallium|antimony|\blithium\b|\bnickel\b|\bcobalt\b|graphite|vanadium|\btungsten\b|strategic reserve|minerals? (strategy|processing|refinery|reserve|facility)|downstream processing|\blynas\b|\biluka\b|arafura|pilgangoora/i,
    q: ['critical minerals', 'rare earths', 'lithium mine', 'nickel industry', 'critical minerals strategic reserve'] },
  { ns: 'mca', client: 'Minerals Council of Australia', id: 'mining', label: 'Mining and resources',
    rx: /mining (tax|royalt|approval|jobs)|resources (sector|industry|policy)|royalties/i,
    wide: /\bmining\b|\bminers?\b|minerals council|iron ore|coal (mine|mining|export|industry|seam)|royalt(y|ies)|resources (sector|industry|policy|tax|minister|company|state)|\bbhp\b|rio tinto|fortescue|glencore|whitehaven|yancoal|\bpilbara\b|bowen basin|hunter valley (coal|mine)|super ?profits tax|minerals? tax|mine (approval|closure|rehabilitation|site|worker)|same job,? same pay|nature positive|\bepbc\b|uranium|\bfifo\b|smelter|alumina|refinery closure/i,
    q: ['mining royalties', 'iron ore', 'coal mine approval', 'minerals council', 'nature positive laws', 'same job same pay mining'] },
  { ns: 'aep', client: 'Australian Energy Producers', id: 'gas', label: 'Gas supply and reservation',
    rx: /gas (supply|reservation|shortfall|market|price)|domestic gas|\blng\b/i,
    wide: /\bgas\b|\blng\b|gas (supply|reservation|shortfall|market|price|field|project|export|import|ban|connection|network|plant)|domestic gas|east coast gas|\bsantos\b|woodside|beach energy|\bshell\b|petroleum|offshore (gas|drilling|exploration)|north ?west shelf|scarborough|barossa|narrabri|beetaloo|browse basin|\baemo\b|gas-?fired|fracking|coal seam gas|\bcsg\b/i,
    q: ['gas reservation', 'gas prices', 'north west shelf', 'offshore gas project', 'gas shortfall', 'fracking beetaloo'] },
  { ns: 'aep', client: 'Australian Energy Producers', id: 'energy', label: 'Energy and climate policy',
    rx: /energy (policy|prices|bills|transition|security)|electricity price|power bill/i,
    wide: /energy (policy|prices?|bills?|transition|security|market|minister|crisis|rebate)|electricity (price|bill|market|grid|supply)|power (bills?|prices?|grid|station|outage)|net zero|renewables?|\bsolar\b|wind farm|offshore wind|nuclear (power|energy|plant|reactor|option)|coal-?fired|transmission (line|project)|capacity investment|safeguard mechanism|emissions? (target|reduction|trading|cut)|climate (policy|target|bill|wars)|eraring|yallourn|loy yang|batteries? (rollout|scheme)|home battery/i,
    q: ['electricity prices', 'energy transition', 'nuclear power australia', 'renewable energy target', 'power bills', 'safeguard mechanism'] },
  { ns: 'vicnats', client: 'The Nationals Victoria', id: 'vicelection', label: 'Victorian election',
    rx: /victorian? (state )?election|victorian (government|premier|parliament)|spring street/i,
    wide: /victorian? (state )?election|victoria(n)? (government|premier|parliament|labor|liberals?|nationals|budget|opposition|treasurer|minister|debt|taxes?)|spring street|allan government|jacinta allan|brad battin|daniel andrews|premier of victoria|state election 2026|\bvic\b (politics|labor|libs|budget)|state of victoria|upper house region|preference deal/i,
    q: ['victorian election', 'jacinta allan', 'victorian budget', 'victorian government', 'victorian nationals'] },
  { ns: 'vicnats', client: 'The Nationals Victoria', id: 'regional', label: 'Regional Victoria',
    rx: /regional victoria|country victoria|regional (rail|road|health|hospital|service)/i,
    wide: /regional victoria|country victoria|regional (rail|road|health|hospital|service|town|jobs|communit|victorians?)|\bgippsland\b|\bmallee\b|\bwimmera\b|ballarat|bendigo|shepparton|mildura|wangaratta|warrnambool|latrobe valley|wodonga|horsham|v ?\/ ?line|country roads?|native timber|duck (hunting|season)|\bfarmers?\b|agricultur|\bdrought\b|\bvff\b|dairy (farm|industry|price)|irrigat|murray[- ]darling|ambulance ramping|\bcfa\b|country fire|regional (uni|tafe)|freight rail/i,
    q: ['regional victoria', 'gippsland', 'v/line regional rail', 'victorian farmers', 'native timber logging', 'duck hunting victoria'] },
  { ns: 'pca', client: 'Property Council of Australia', id: 'housing', label: 'Housing and planning',
    rx: /housing (policy|supply|crisis|target|approval)|planning reform|build-to-rent|negative gearing/i,
    wide: /\bhousing\b|home ?buyers?|first home|\brents?\b|\brental\b|planning (reform|law|scheme|minister|approval|system)|build-?to-?rent|negative gearing|capital gains (tax )?discount|property (market|prices|council|developer|investor)|apartments?|\bmortgages?\b|housing (accord|target|australia future fund)|social housing|affordable housing|stamp duty|developer contributions|\bnimby\b|granny flat|rezoning|density|homelessness|construction of homes/i,
    q: ['housing crisis', 'housing supply', 'negative gearing', 'planning reform', 'build to rent', 'rental crisis'] },
  { ns: 'mba', client: 'Master Builders', id: 'construction', label: 'Construction and IR',
    rx: /construction (industry|sector|union|cost)|\bcfmeu\b|building (industry|code|approvals)/i,
    wide: /construction (industry|sector|union|cost|worker|site|company|firm|jobs)|\bcfmeu\b|building (industry|code|approvals|commission|sector|costs?|company|site)|tradies?|master builders|industrial relations|enterprise agreement|same job,? same pay|wage theft|right of entry|apprentic|subcontractor|builder (collapse|insolvenc)|insolvenc|infrastructure (project|spend|pipeline|cost)|big build|cost overrun|\bcbus\b|\bawu\b|\betu\b|labour shortage|building materials?/i,
    q: ['cfmeu', 'construction costs', 'building approvals', 'tradies shortage', 'construction insolvency', 'master builders'] },
  { ns: 'pharm', client: 'Pharmacy Guild of Australia', id: 'pharmacy', label: 'Community pharmacy',
    rx: /pharmacy guild|community pharmac(y|ies)|60-?day dispensing|pharmacist prescrib|dispensing fee/i,
    wide: /pharmac(y|ies|ist|ists|eutical)|\bchemist\b|chemist warehouse|\bpbs\b|pharmaceutical benefits|60-?day dispensing|dispensing (fee|error|incentive)|scope of practice|prescription (cost|price|charge|fee)|co-?payment|medicine (shortage|price|cost)|vaccination (at|in) pharmac|pharmacy (owner|ownership|location rules|agreement)|community pharmacy agreement|\b[78]cpa\b|opioid dependence|repeat prescription|\bgp\b (visit|shortage|bulk billing)|bulk billing|urgent care clinic/i,
    q: ['pharmacy guild', '60 day dispensing', 'pharmacist prescribing', 'chemist warehouse', 'pbs co-payment', 'bulk billing'] },
  { ns: 'cmm', client: 'Curious Minds (shared)', id: 'col', label: 'Cost of living', map: 'i_col',
    rx: /cost of living|inflation|interest rates?|rba (decision|hold|cut|rise|board)/i,
    wide: /cost[- ]of[- ]living|inflation|interest rates?|\brba\b|reserve bank|rate (rise|cut|hold|hike)|cash rate|grocer(y|ies)|supermarkets?|\bcoles\b|woolworths|\bwages?\b|household budget|petrol price|\bcpi\b|price gouging|bill relief|insurance premium|childcare (cost|fee)/i,
    q: ['cost of living', 'interest rates', 'grocery prices', 'energy bill relief'] },
  { ns: 'cmm', client: 'Curious Minds (shared)', id: 'econ', label: 'Economy and tax',
    rx: /\bgdp\b|recession|unemployment rate|productivity (growth|commission)|tax reform|federal budget/i,
    wide: /\beconomy\b|economic (growth|outlook|data|policy|reform)|\bgdp\b|recession|unemployment|jobless|productivity|\bbudget\b|deficit|surplus|treasury|tax (reform|cuts?|hike|policy|system|break)|income tax|company tax|\bgst\b|superannuation|super (tax|cap|change)|tariffs?|trade (war|deal)|\basx\b|australian dollar|cost base|business (confidence|investment)/i,
    q: ['tax reform', 'productivity commission', 'federal budget', 'unemployment rate'] },
  { ns: 'cmm', client: 'Curious Minds (shared)', id: 'gov', label: 'Federal politics', map: 'i_gov',
    rx: /newspoll|primary vote|preferred prime minister|approval rating|by-?election|leadership spill/i,
    wide: /newspoll|resolve poll|essential poll|primary vote|two-?party|approval rating|preferred (pm|prime minister)|by-?election|leadership (spill|challenge)|question time|prime minister|albanese|sussan ley|\bdutton\b|treasurer|chalmers|\bcanberra\b|federal (government|election|budget|parliament|labor|minister|court)|\bcoalition\b|\bnationals\b|\bgreens\b|\bsenate\b|crossbench|\bteals?\b|one nation|\bhanson\b|preselection|lobby(ing|ist)|donations? disclosure/i,
    q: ['newspoll', 'federal election', 'question time', 'political donations'] },
  { ns: 'cmm', client: 'Curious Minds (shared)', id: 'activism', label: 'Activist campaigns',
    rx: /market forces|rising tide|lock the gate|extinction rebellion|blockade australia|stop adani|environmental defenders office/i,
    wide: /market forces|rising tide|lock the gate|extinction rebellion|blockade australia|\bgetup\b|sunrise project|environment victoria|environmental defenders office|australian conservation foundation|greenpeace|350\.org|climate ?200|\baycc\b|school strike|knitting nannas|move beyond coal|friends of the earth|bob brown foundation|wilderness society|tomorrow movement|shareholder resolution|divest(ed|ment|ing)?|greenwash|protest(er|ers|ing)?|blockad(e|ed|ing)|activists?|climate camp|direct action|chained (themselves|to)|court challenge|class action against|lock-?on|picket|rally (against|outside)|occupy(ing)? the/i,
    q: ['rising tide protest', 'market forces campaign', 'lock the gate', 'climate protest australia', 'environmental defenders office', 'coal port blockade'] },
];
/** Broad, collection-side tagging: every issue whose wide matcher fires. */
function issueTag(text) { const t = String(text || ''); return CLIENT_ISSUES.filter(ci => (ci.wide || ci.rx).test(t)).map(ci => ci.id); }
/** Thread tags plus the comment's own, deduped: both, never one or the other. */
function issueMerge(own, inherited) {
  const out = [];
  (own || []).concat(inherited || []).forEach(i => { if (i && out.indexOf(i) < 0) out.push(i); });
  return out;
}
/** The keyword sweep's search terms, optionally narrowed to some issue ids. */
function issueQueries(ids) {
  const want = (Array.isArray(ids) && ids.length) ? ids.map(s => String(s).toLowerCase()) : null;
  const out = [];
  CLIENT_ISSUES.forEach(ci => { if (!want || want.indexOf(ci.id) >= 0) (ci.q || []).forEach(q => { if (out.indexOf(q) < 0) out.push(q); }); });
  return out;
}
let SEN_READY = false;
async function ensureSentinel(env) {
  if (!env.MIND_DB) return false;
  if (SEN_READY) return true;
  await ensureArchive(env);
  await env.MIND_DB.batch([
    env.MIND_DB.prepare('CREATE TABLE IF NOT EXISTS arc_alerts(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, client TEXT, issue TEXT, label TEXT, mapnode TEXT, severity TEXT, hot INTEGER, baseline REAL, ratio REAL, srcs INTEGER, tone REAL, evidence TEXT, angle TEXT, detected_ts INTEGER, notified_ts INTEGER, acked_ts INTEGER, acked_by TEXT, drafted_ts INTEGER)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_alerts_ts ON arc_alerts(detected_ts)'),
    env.MIND_DB.prepare('CREATE INDEX IF NOT EXISTS arc_alerts_issue ON arc_alerts(ns, issue, detected_ts)'),
  ]);
  SEN_READY = true;
  return true;
}
/** Median of a numeric array, or null. */
function median(a) {
  const v = a.filter(x => typeof x === 'number' && isFinite(x)).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
/** Mind retrieval for background jobs (the /mind/* routes keep their own copy,
    which is request-scoped). Client namespace plus the shared cmm layer only. */
async function mindRetrieve(env, ns, q, topK = 5) {
  if (!env.MIND_VECTORS || !env.AI) return [];
  const out = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [String(q).slice(0, 1500)] });
  const vec = out.data[0];
  const hits = [];
  const one = async (space, k) => {
    try {
      const res = await env.MIND_VECTORS.query(vec, { topK: k, namespace: space, returnMetadata: 'all' });
      (res.matches || []).forEach(m => hits.push({ ns: space, score: m.score, meta: m.metadata || {} }));
    } catch (e) {}
  };
  await one(ns, topK);
  if (ns !== 'cmm') await one('cmm', 3);
  hits.sort((a, b) => b.score - a.score);
  return hits;
}

/* == THE RESEARCH AGENT ====================================================
 * POST /research runs a bounded agentic loop entirely inside the worker:
 * plan search queries with Claude, sweep Google News AU for each, read the
 * strongest pages live, cross-reference the permanent archive and the Mind,
 * then synthesise a fully cited dossier. Key-gated (full role) because it
 * spends API tokens. Every helper fails soft - a dead page or an unbound
 * Mind narrows the dossier, it never breaks the run.
 * ========================================================================== */
/** The image engine. Gemini image models, tried in a chain (requested or the
 *  Pro default, then the flash models) with per-model retries on transient
 *  errors. Returns {ok, imageB64, mime, model} or {ok:false, error, detail,
 *  model}. Used by POST /nano and by the Release Desk. */
async function nanoRender(env, opts) {
  opts = opts || {};
  const key = env.GEMINI_KEY;
  if (!key) return { ok: false, error: 'gemini_not_configured', detail: 'Set GEMINI_KEY as a Worker secret.', model: '' };
  const clean = m => String(m || '').replace(/^models\//, '').replace(/[^a-zA-Z0-9._-]/g, '');
  const chain = [];
  [clean(opts.model) || 'gemini-3-pro-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image']
    .forEach(m => { if (m && chain.indexOf(m) === -1) chain.push(m); });
  const parts = [{ text: String(opts.prompt || '').slice(0, 8000) }];
  (Array.isArray(opts.references) ? opts.references : []).slice(0, 6).forEach(rf => {
    if (rf && rf.data) parts.push({ inline_data: { mime_type: rf.mime || 'image/png', data: String(rf.data) } });
  });
  const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'];
  const SIZES = ['1K', '2K', '4K'];
  const genCfg = { responseModalities: ['TEXT', 'IMAGE'] };
  const imgCfg = {};
  if (ASPECTS.indexOf(opts.aspect) !== -1) imgCfg.aspectRatio = opts.aspect;
  if (SIZES.indexOf(opts.size) !== -1) imgCfg.imageSize = opts.size;
  let lastDetail = '', lastModel = chain[0];
  for (const model of chain) {
    lastModel = model;
    const cfg = (model.indexOf('gemini-2.5') === 0 || !Object.keys(imgCfg).length) ? genCfg : Object.assign({}, genCfg, { imageConfig: imgCfg });
    const payload = JSON.stringify({ contents: [{ parts }], generationConfig: cfg });
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt) await new Promise(res => setTimeout(res, 700 * attempt));
        const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
          signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined });
        const data = await r.json().catch(() => ({}));
        if (data.error) {
          lastDetail = String(data.error.message || '').slice(0, 200);
          const code = data.error.code || r.status;
          if (code === 500 || code === 503 || code === 429) continue;
          if (code === 404 || code === 400 || code === 403) break;
          return { ok: false, error: 'gemini_' + code, detail: lastDetail, model };
        }
        const cand = (data.candidates || [])[0] || {};
        const imgPart = ((cand.content && cand.content.parts) || []).find(p => p.inline_data || p.inlineData);
        const inl = imgPart && (imgPart.inline_data || imgPart.inlineData);
        if (inl && inl.data) return { ok: true, imageB64: inl.data, mime: inl.mime_type || inl.mimeType || 'image/png', model };
        lastDetail = String(cand.finishReason || 'model returned no image').slice(0, 120);
        if (cand.finishReason && cand.finishReason !== 'STOP') continue;
      } catch (e) { lastDetail = String((e && e.name) || e).slice(0, 60); }
    }
  }
  return { ok: false, error: 'no_image', detail: lastDetail || 'all image models failed', model: lastModel };
}
async function claudeMsg(env, system, user, maxTok, timeoutMs, model) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-4-6', max_tokens: maxTok, system: system, messages: [{ role: 'user', content: user }] }),
    signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (d.error) throw new Error(String(d.error.message || 'anthropic_error').slice(0, 160));
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
}
async function gnewsSweep(qq, hours, max) {
  try {
    const when = hours <= 24 ? ('when:' + hours + 'h') : ('when:' + Math.ceil(hours / 24) + 'd');
    const r = await fetch('https://news.google.com/rss/search?q=' + encodeURIComponent(qq + ' ' + when) + '&hl=en-AU&gl=AU&ceid=AU:en', {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/rss+xml,application/xml,text/xml,*/*' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
    });
    if (!r.ok) return [];
    return parseFeedXml(await r.text()).slice(0, max).map(it => {
      const m = it.title.match(/\s[-\u2013\u2014]\s([^-\u2013\u2014]{2,40})$/);
      const outlet = m ? m[1].trim() : '';
      return { title: m ? it.title.slice(0, m.index).trim() : it.title, link: it.link, date: it.date || '', outlet: outlet, q: qq };
    });
  } catch (e) { return []; }
}
async function pageGrab(url) {
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,application/xhtml+xml,*/*' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined,
      cf: { cacheTtl: 600 },
    });
    if (!r.ok) return null;
    const ctype = (r.headers.get('content-type') || '').toLowerCase();
    if (ctype && !/html|text\/plain|xml/.test(ctype)) return null;
    let html = await r.text();
    if (html.length > 500000) html = html.slice(0, 500000);
    const title = stripHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
    let body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(nav|header|footer|aside)[\s\S]*?<\/\1>/gi, ' ');
    const art = (body.match(/<article[\s\S]*?<\/article>/i) || [])[0] || (body.match(/<main[\s\S]*?<\/main>/i) || [])[0] || body;
    const text = stripHtml(art).slice(0, 3500);
    if (!text.trim()) return null;
    return { url: r.url || url, title: title, text: text };
  } catch (e) { return null; }
}
async function researchRun(env, ctx, q, ns, hours) {
  const t0 = Date.now();
  // 1. Plan: turn the question into targeted news-search queries.
  let queries = [q];
  try {
    const plan = await claudeMsg(env,
      'You plan news research for an Australian political intelligence platform. Reply with ONLY a JSON array of 3 or 4 short Google News search queries (3-6 words each, no operators) that together cover the question from different angles: the core story, the political/policy angle, and key actors or reactions.',
      'QUESTION: ' + q, 300, 20000);
    const arr = JSON.parse((plan.match(/\[[\s\S]*\]/) || ['[]'])[0]);
    if (Array.isArray(arr) && arr.length) queries = arr.slice(0, 4).map(x => String(x).slice(0, 80));
  } catch (e) { /* fall back to the raw question */ }

  // 2. Gather: news sweeps + archive + Mind, in parallel.
  const [sweeps, mindHits] = await Promise.all([
    Promise.all(queries.map(qq => gnewsSweep(qq, hours, 8))),
    mindRetrieve(env, ns || 'cmm', q, 5).catch(() => []),
  ]);
  let news = [];
  const seen = new Set();
  sweeps.flat().forEach(n => {
    const k = n.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 70);
    if (!k || seen.has(k)) return; seen.add(k); news.push(n);
  });
  news.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  news = news.slice(0, 14);
  let arch = [];
  try {
    if (env.MIND_DB && (await ensureArchive(env))) {
      const words = q.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3).slice(0, 3);
      if (words.length) {
        const cond = words.map(() => "(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')").join(' AND ');
        const binds = []; words.forEach(w => { const like = arcLike(w); binds.push(like, like); });
        const rs = await env.MIND_DB.prepare('SELECT kind,src,title,body,url,ts FROM arc_items WHERE ' + cond + ' ORDER BY ts DESC LIMIT 10').bind(...binds).all();
        arch = (rs.results || []);
      }
    }
  } catch (e) { /* archive optional */ }

  // 3. Read: fetch the strongest pages live (distinct outlets, max 3).
  const picks = []; const outletsSeen = new Set();
  for (const n of news) { const o = (n.outlet || '').toLowerCase(); if (o && outletsSeen.has(o)) continue; outletsSeen.add(o); picks.push(n); if (picks.length >= 3) break; }
  const pages = (await Promise.all(picks.map(p => pageGrab(p.link)))).filter(Boolean);

  // 4. Cite everything with stable ids.
  const sources = []; const blocks = [];
  pages.forEach((p, i) => { sources.push({ id: 'W' + (i + 1), title: p.title || 'page', url: p.url, origin: 'live page' }); blocks.push('[W' + (i + 1) + '] PAGE: ' + (p.title || p.url) + '\n' + p.text); });
  news.forEach((n, i) => { sources.push({ id: 'N' + (i + 1), title: n.title, url: n.link, origin: 'news' + (n.outlet ? ': ' + n.outlet : '') }); blocks.push('[N' + (i + 1) + '] (' + (n.outlet || 'news') + ', ' + (n.date || '').slice(0, 10) + ') ' + n.title); });
  arch.forEach((a, i) => { sources.push({ id: 'A' + (i + 1), title: a.title, url: a.url && a.url.indexOf('x:') !== 0 ? a.url : '', origin: 'archive: ' + a.kind }); blocks.push('[A' + (i + 1) + '] (archive ' + a.kind + '/' + (a.src || '') + ', ' + new Date(a.ts || 0).toISOString().slice(0, 10) + ') ' + a.title + (a.body ? ' - ' + String(a.body).slice(0, 160) : '')); });
  (mindHits || []).forEach((h, i) => { sources.push({ id: 'S' + (i + 1), title: h.meta.title || 'doc', url: '', origin: (h.ns === 'cmm' ? 'CMM shared' : 'client KB') + (h.meta.kind ? ' - ' + h.meta.kind : '') }); blocks.push('[S' + (i + 1) + '] (' + (h.ns === 'cmm' ? 'CMM' : 'CLIENT') + ' ' + (h.meta.kind || 'doc') + ') ' + (h.meta.title || '') + ': ' + String(h.meta.snippet || '').slice(0, 250)); });

  // 5. Synthesise the dossier.
  const sys = 'You are the research desk of an Australian political intelligence platform serving a communications agency. '
    + 'Write a research dossier answering the question below using ONLY the numbered sources provided. Never invent facts, numbers or quotes. '
    + 'After every claim cite its source inline like [W1], [N3], [A2] or [S1]. If the sources are thin on part of the question, say so plainly. '
    + 'Structure with #### headers: "The read" (3-4 sentence answer), "Key findings" (bulleted, each cited), "Implications" (what a campaign/comms team should take from it'
    + (ns ? ', for the client namespace ' + ns : '') + '), and "Watch next" (2-3 concrete things to monitor). Australian English. Plain prose, no preamble.';
  const report = await claudeMsg(env, sys,
    'QUESTION: ' + q + '\n\nSOURCES:\n' + (blocks.join('\n\n').slice(0, 42000) || '(no sources found - say so and stop)'), 2600, 60000);

  // 6. Remember the run: dossier into the archive, run into the ledger.
  if (ctx) ctx.waitUntil((async () => {
    try {
      await archiveItems(env, 'research', [{ src: 'axiom', title: q.slice(0, 300), body: report.slice(0, 6000), url: 'x:research:' + t0, meta: { ns: ns || '', queries: queries } }]);
      if (env.MIND_DB) await env.MIND_DB.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns || 'cmm', 'research', q.slice(0, 200), Date.now()).run();
    } catch (e) {}
  })());
  return { ok: true, q: q, ns: ns || '', queries: queries, report: report, sources: sources, ms: Date.now() - t0 };
}

/** Ask Claude for the angle. Returns a JSON string, or '' when unavailable. */
async function sentinelAngle(env, alert, items) {
  if (!env.ANTHROPIC_API_KEY) return '';
  let playbook = '';
  try {
    const hits = await mindRetrieve(env, alert.ns, alert.label + ' ' + ((items[0] && items[0].title) || ''), 5);
    playbook = hits.map(h => '- (' + (h.meta.kind || 'doc') + ') ' + (h.meta.title || '') + ': ' + (h.meta.snippet || '').slice(0, 300)).join('\n').slice(0, 2200);
  } catch (e) { /* Mind optional */ }
  const heads = items.slice(0, 6).map(it => '- ' + (it.src || '') + ': ' + (it.title || '')).join('\n');
  const sys = 'You are the senior political strategist at Curious Minds, an Australian marketing, advocacy and political campaign agency. '
    + 'A monitored issue for one of our clients has just spiked in the news. Give the account team what they need to respond within the hour. '
    + 'Reply with ONLY a JSON object: {"read":"2-3 sentences on what is actually happening and why it matters to this client",'
    + '"angle":"the single sharpest position this client should take right now, in one sentence",'
    + '"risk":"the main way this could backfire, in one sentence",'
    + '"drafts":[{"channel":"social","text":"a ready-to-post caption, under 220 characters"},'
    + '{"channel":"statement","text":"2-3 sentence media statement in the client voice"}]}. '
    + 'Ground everything in the headlines given. Never invent facts, numbers or quotes.';
  const user = 'CLIENT: ' + alert.client + ' (namespace ' + alert.ns + ')\nISSUE: ' + alert.label
    + '\nSPIKE: ' + alert.hot + ' stories in the last ' + SENTINEL.HOT_HOURS + 'h across ' + alert.srcs
    + ' outlets - ' + alert.ratio.toFixed(1) + 'x its 14-day baseline.\n\nHEADLINES:\n' + heads
    + (playbook ? '\n\nCLIENT KNOWLEDGE (standing rules, past positions and outcomes):\n' + playbook : '');
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, system: sys, messages: [{ role: 'user', content: user }] }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(45000) : undefined,
    });
    const d = await r.json().catch(() => ({}));
    const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    if (!txt) return '';
    const s = txt.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    JSON.parse(s); // validate before storing
    return s;
  } catch (e) { return ''; }
}
/** Post an alert to Slack. Webhooks live in KV key slack_webhooks: {ns:url,_default:url}. */
async function sentinelNotify(env, alert, items, angle) {
  let hooks = {};
  try { hooks = JSON.parse((await kvGet(env.AXIOM_KV, 'slack_webhooks')) || '{}'); } catch (e) { hooks = {}; }
  const url = hooks[alert.ns] || hooks._default || env.SLACK_WEBHOOK_URL || '';
  if (!url) return false;
  let a = null; try { a = angle ? JSON.parse(angle) : null; } catch (e) { a = null; }
  const sev = alert.severity === 'critical' ? ':rotating_light: CRITICAL' : alert.severity === 'high' ? ':warning: HIGH' : ':eyes: WATCH';
  const lines = [
    sev + '  *' + alert.label + '* is spiking for *' + alert.client + '*',
    '`' + alert.hot + ' stories / ' + SENTINEL.HOT_HOURS + 'h across ' + alert.srcs + ' outlets - ' + alert.ratio.toFixed(1) + 'x baseline`',
  ];
  if (a && a.read) lines.push('', '*What is happening*  ' + a.read);
  if (a && a.angle) lines.push('*Suggested angle*  ' + a.angle);
  if (a && a.risk) lines.push('*Risk*  ' + a.risk);
  const draft = a && Array.isArray(a.drafts) ? a.drafts.find(d => d.channel === 'social') : null;
  if (draft && draft.text) lines.push('', '*Draft post*  ' + draft.text);
  lines.push('', '*Headlines*');
  items.slice(0, 4).forEach(it => lines.push('- <' + (it.link || it.url || '') + '|' + String(it.title || '').replace(/[<>|]/g, ' ').slice(0, 120) + '> _(' + (it.src || '') + ')_'));
  lines.push('', '_AXIOM Sentinel - acknowledge in the app to log response time._');
  try {
    const r = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines.join('\n') }),
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });
    return r.ok;
  } catch (e) { return false; }
}
/** One detection pass. Returns {scanned, fired, alerts:[...]}. */
async function sentinelScan(env, opts = {}) {
  if (!(await ensureSentinel(env))) return { ok: false, error: 'mind_unbound' };
  const now = Date.now();
  const hotMs = SENTINEL.HOT_HOURS * 3600000;
  // Hot window comes off the live wire so detection works from the first minute.
  let items = [];
  try {
    const snap = await buildAllNews(env, { q: '', max: 120, hours: Math.max(SENTINEL.HOT_HOURS, 6) });
    items = (JSON.parse(snap).items || []).filter(it => (now - (Date.parse(it.date) || 0)) <= hotMs);
  } catch (e) { items = []; }
  const fired = [];
  for (const iss of CLIENT_ISSUES) {
    const hits = items.filter(it => iss.rx.test((it.title || '') + ' ' + (it.desc || '')));
    if (hits.length < (opts.minHot || SENTINEL.MIN_HOT)) continue;
    // Baseline: the same matcher across the permanent archive, per hot-window.
    let baseline = 0;
    try {
      const since = now - SENTINEL.BASE_DAYS * 86400000;
      const like = '%' + iss.label.split(' ')[0].toLowerCase() + '%';
      const row = await env.MIND_DB.prepare(
        "SELECT title, body FROM arc_items WHERE kind='news' AND ts>? AND ts<? LIMIT 4000").bind(since, now - hotMs).all();
      const past = (row.results || []).filter(r => iss.rx.test((r.title || '') + ' ' + (r.body || ''))).length;
      const windows = (SENTINEL.BASE_DAYS * 24) / SENTINEL.HOT_HOURS;
      baseline = past / windows;
      void like;
    } catch (e) { baseline = 0; }
    const base = Math.max(baseline, 0.5); // floor keeps a thin archive from screaming
    const ratio = hits.length / base;
    if (ratio < (opts.minRatio || SENTINEL.MIN_RATIO)) continue;
    // Cooldown, unless the story has materially escalated.
    let prev = null;
    try {
      const p = await env.MIND_DB.prepare(
        'SELECT id, ratio, detected_ts FROM arc_alerts WHERE ns=? AND issue=? ORDER BY detected_ts DESC LIMIT 1')
        .bind(iss.ns, iss.id).all();
      prev = (p.results || [])[0] || null;
    } catch (e) { prev = null; }
    if (prev && (now - prev.detected_ts) < SENTINEL.COOLDOWN_H * 3600000
        && ratio < (prev.ratio || 0) * SENTINEL.ESCALATE) continue;
    const srcs = new Set(hits.map(h => h.src)).size;
    const tones = hits.map(h => typeof h.tone === 'number' ? h.tone : null).filter(t => t !== null);
    const tone = tones.length ? tones.reduce((a, b) => a + b, 0) / tones.length : null;
    const severity = (ratio >= 5 && srcs >= 4) ? 'critical' : (ratio >= 3.5 || srcs >= 4) ? 'high' : 'watch';
    const alert = {
      ns: iss.ns, client: iss.client, issue: iss.id, label: iss.label, mapnode: iss.map || '',
      severity, hot: hits.length, baseline: +base.toFixed(3), ratio: +ratio.toFixed(2), srcs, tone,
    };
    const evidence = JSON.stringify(hits.slice(0, 6).map(h => ({ t: h.title, u: h.link, s: h.src, d: h.date })));
    const angle = opts.noAngle ? '' : await sentinelAngle(env, alert, hits);
    let notified = 0;
    if (!opts.noNotify && await sentinelNotify(env, alert, hits, angle)) notified = Date.now();
    const ins = await env.MIND_DB.prepare(
      'INSERT INTO arc_alerts(ns,client,issue,label,mapnode,severity,hot,baseline,ratio,srcs,tone,evidence,angle,detected_ts,notified_ts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(alert.ns, alert.client, alert.issue, alert.label, alert.mapnode, alert.severity, alert.hot,
            alert.baseline, alert.ratio, alert.srcs, alert.tone, evidence, angle, now, notified || null).run();
    alert.id = (ins.meta && ins.meta.last_row_id) || null;
    alert.notified = !!notified;
    fired.push(alert);
  }
  return { ok: true, scanned: CLIENT_ISSUES.length, wire: items.length, fired: fired.length, alerts: fired };
}

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

    // ---- access control ----------------------------------------------------
    // Two secrets, both optional:
    //   AXIOM_ACCESS_KEY  - a single full-access key (legacy, still honoured)
    //   AXIOM_KEYS        - JSON of per-person keys with roles, e.g.
    //                       {"k1":{"n":"Heshan","r":"full"},"k2":{"n":"Steve","r":"read"}}
    // Roles: "full" may write (ingest, log, save, ack); "read" may only read
    // (query, search, alerts, metrics). Everything stays open until at least
    // one secret exists, so nothing breaks before they are configured.
    // /archive/stats stays public by design: aggregate counts only, so the map
    // shows presence of knowledge without revealing any of it.
    const READ_ROUTES = ['/mind/query', '/mind/docs', '/archive/search', '/sentinel/alerts', '/sentinel/metrics', '/session/load', '/meta/status'];
    const isRead = READ_ROUTES.includes(path) || (path === '/session/img' && req.method === 'GET')
      || (path.startsWith('/perf/') && req.method === 'GET')
      || (path.startsWith('/reddit/') && req.method === 'GET' && !reqUrl.searchParams.get('live'))
      || (path.startsWith('/signals/') && req.method === 'GET')
      || ((path.startsWith('/release/') || path.startsWith('/brand/') || path.startsWith('/engine/') || path.startsWith('/content/') || path.startsWith('/topics') || path.startsWith('/mps') || path.startsWith('/sources') || path === '/fulltext' || path.startsWith('/social/') || path.startsWith('/entities') || path.startsWith('/sentiment/') || path.startsWith('/narratives') || path === '/overview') && req.method === 'GET')
      // the console must be readable by anyone who can see the view; claiming
      // and reporting jobs is a write and stays full-role
      || (path === '/bridge/job' || path === '/bridge/status');
    const gated = path.startsWith('/mind/') || path.startsWith('/session/') || path.startsWith('/log/')
      || path === '/archive/search' || path === '/archive/add' || path === '/archive/selftest' || path.startsWith('/sentinel/')
      || path === '/research' || path.startsWith('/meta/') || path.startsWith('/perf/') || path.startsWith('/reddit/')
      || path.startsWith('/signals/') || path.startsWith('/bridge/') || path.startsWith('/release/') || path.startsWith('/brand/') || path.startsWith('/engine/')
      || path.startsWith('/content/') || path.startsWith('/topics') || path.startsWith('/mps') || path.startsWith('/sources') || path.startsWith('/fulltext') || path.startsWith('/social/') || path.startsWith('/entities') || path.startsWith('/sentiment/') || path.startsWith('/narratives') || path === '/overview';
    const auth = axAuth(req, env);
    // A key is only as good as the number of guesses allowed against it: lock an
    // address out for ten minutes after a dozen failures.
    if (gated && auth.enforced && env.AXIOM_KV) {
      const fk = 'af_' + (req.headers.get('CF-Connecting-IP') || 'unknown').slice(0, 60);
      const fails = Number(await kvGet(env.AXIOM_KV, fk) || 0);
      if (fails >= 12) return jsonResp({ error: 'too_many_attempts', detail: 'Too many failed access-key attempts from this address. Wait ten minutes and try again.' }, 429);
      if (!auth.ok) { try { await kvPut(env.AXIOM_KV, fk, String(fails + 1), 600); } catch (e) {} }
      else if (fails) { try { await kvPut(env.AXIOM_KV, fk, '0', 60); } catch (e) {} }
    }
    if (gated && auth.enforced) {
      if (!auth.ok) return jsonResp({ error: 'unauthorized', detail: 'This route is protected. Add your access key in AXIOM Settings.' }, 401);
      if (auth.role === 'read' && !isRead) {
        return jsonResp({ error: 'read_only', detail: 'Your key is read-only. Ask an admin for a full-access key to make changes.' }, 403);
      }
    }

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
        ['OzPolitic',    forumOzRss()],
        ['Whirlpool',    fq ? forumWhirlpoolQ(fq) : forumWhirlpoolQ('politics')],
        ['BigFooty',     forumBigfootyLatest()],
        ['HotCopper',    forumHotcopperLatest()],
        ['PropertyChat', forumPropertyChat()],
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
      const staleKey = ('gs_' + cacheKey).slice(0, 240);
      const cached = await kvGet(env.AXIOM_KV, cacheKey);
      if (cached) return new Response(cached, { headers: CORS });
      const p = new URLSearchParams({ query: gq, mode, format: 'json', timespan });
      if (mode === 'artlist') { p.set('maxrecords', String(max)); p.set('sort', 'hybridrel'); }
      try {
        // GDELT allows one request every five seconds and answers a burst with
        // plain text, not JSON. Absorb that here: back off, retry, and fall back
        // to the last good answer rather than handing its notice to the user.
        let text = '', d = null, limited = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          const r = await fetch('https://api.gdeltproject.org/api/v2/doc/doc?' + p, { headers: { 'User-Agent': 'AXIOM/5.0' } });
          text = await r.text();
          try { d = JSON.parse(text); break; } catch (e) { d = null; }
          limited = r.status === 429 || /limit requests to one every|rate limit|too many requests/i.test(text);
          if (!limited) break;
          await new Promise(res => setTimeout(res, 1600 * (attempt + 1)));
        }
        if (!d) {
          const stale = await kvGet(env.AXIOM_KV, staleKey);
          if (stale) return new Response(stale, { headers: CORS });
          return limited
            ? jsonResp({ error: 'gdelt_rate_limited', detail: 'GDELT allows one query every five seconds and is throttling us right now. Wait a few seconds and try again - nothing is wrong with your tracker.' }, 429)
            : jsonResp({ error: 'gdelt_bad_response', detail: text.slice(0, 160) }, 502);
        }
        const out = mode === 'artlist'
          ? JSON.stringify({ articles: (d.articles || []).map(a => ({ title: a.title, url: a.url, domain: a.domain, date: a.seendate, country: a.sourcecountry })) })
          : JSON.stringify({ timeline: d.timeline || [] });
        await kvPut(env.AXIOM_KV, cacheKey, out, 600);
        await kvPut(env.AXIOM_KV, staleKey, out, 7 * 86400);   // last good answer, for a throttled retry
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
      if (!env.GEMINI_KEY) return jsonResp({ error: 'gemini_not_configured', detail: 'Set GEMINI_KEY as a Worker secret: wrangler secret put GEMINI_KEY' }, 501);
      let body = {};
      try { body = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      if (!body.prompt) return jsonResp({ error: 'no_prompt' }, 400);
      const refs = Array.isArray(body.references) ? body.references
        : (body.referenceB64 ? [{ data: body.referenceB64, mime: body.mime }] : []);
      const out = await nanoRender(env, { prompt: body.prompt, references: refs, aspect: body.aspect, size: body.size, model: body.model });
      if (!out.ok) return jsonResp({ error: out.error, detail: out.detail, model: out.model }, 502);
      return jsonResp({ ok: true, imageB64: out.imageB64, mime: out.mime, model: out.model });
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

    // ========================================================================
    // SENTINEL ROUTES - spike alerts, angles, and the speed-to-respond clock.
    // ========================================================================

    // GET /sentinel/alerts?days=7&ns=&status=open|all&limit=
    if (path === '/sentinel/alerts') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        await ensureSentinel(env);
        const days = Math.min(parseInt(reqUrl.searchParams.get('days') || '7', 10) || 7, 90);
        const ns = (reqUrl.searchParams.get('ns') || '').replace(/[^a-z0-9_-]/g, '').slice(0, 32);
        const status = reqUrl.searchParams.get('status') || 'all';
        const limit = Math.min(parseInt(reqUrl.searchParams.get('limit') || '40', 10) || 40, 100);
        const where = ['detected_ts>?']; const args = [Date.now() - days * 86400000];
        if (ns) { where.push('ns=?'); args.push(ns); }
        if (status === 'open') where.push('acked_ts IS NULL');
        const rows = await env.MIND_DB.prepare(
          'SELECT * FROM arc_alerts WHERE ' + where.join(' AND ') + ' ORDER BY detected_ts DESC LIMIT ' + limit).bind(...args).all();
        return jsonResp({ ok: true, role: auth.role, who: auth.name, alerts: (rows.results || []).map(r => ({
          id: r.id, ns: r.ns, client: r.client, issue: r.issue, label: r.label, mapnode: r.mapnode,
          severity: r.severity, hot: r.hot, baseline: r.baseline, ratio: r.ratio, srcs: r.srcs, tone: r.tone,
          evidence: r.evidence ? JSON.parse(r.evidence) : [], angle: r.angle ? JSON.parse(r.angle) : null,
          detected: r.detected_ts, notified: r.notified_ts, acked: r.acked_ts, ackedBy: r.acked_by, drafted: r.drafted_ts,
        })) });
      } catch (e) { return jsonResp({ ok: false, error: 'alerts_failed', detail: String(e).slice(0, 160) }, 500); }
    }

    // POST /sentinel/scan  {minRatio?, minHot?, noNotify?, noAngle?} - manual sweep
    if (path === '/sentinel/scan') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      let b = {}; try { b = await req.json(); } catch (e) { b = {}; }
      const res = await sentinelScan(env, b);
      return jsonResp(res);
    }

    // POST /sentinel/ack  {id, by?} - stamps the response clock
    if (path === '/sentinel/ack') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound' }, 501);
      try {
        const b = await req.json();
        const id = parseInt(b.id, 10);
        if (!id) return jsonResp({ error: 'missing_id' }, 400);
        const who = String(b.by || auth.name || 'team').slice(0, 40);
        const field = b.drafted ? 'drafted_ts' : 'acked_ts';
        await env.MIND_DB.prepare('UPDATE arc_alerts SET ' + field + '=COALESCE(' + field + ',?), acked_by=COALESCE(acked_by,?) WHERE id=?')
          .bind(Date.now(), who, id).run();
        return jsonResp({ ok: true, id, field, by: who });
      } catch (e) { return jsonResp({ ok: false, error: 'ack_failed', detail: String(e).slice(0, 140) }, 500); }
    }

    // GET /sentinel/metrics?days=30 - the 90-day success metric, measured
    if (path === '/sentinel/metrics') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound' }, 501);
      try {
        await ensureSentinel(env);
        const days = Math.min(parseInt(reqUrl.searchParams.get('days') || '30', 10) || 30, 365);
        const rows = await env.MIND_DB.prepare(
          'SELECT severity, detected_ts, notified_ts, acked_ts, drafted_ts FROM arc_alerts WHERE detected_ts>?')
          .bind(Date.now() - days * 86400000).all();
        const rs = rows.results || [];
        const mins = (a, b) => rs.filter(r => r[a] && r[b]).map(r => (r[b] - r[a]) / 60000);
        const ackTimes = mins('detected_ts', 'acked_ts');
        const draftTimes = mins('detected_ts', 'drafted_ts');
        return jsonResp({ ok: true, days, total: rs.length,
          open: rs.filter(r => !r.acked_ts).length,
          notified: rs.filter(r => r.notified_ts).length,
          acked: ackTimes.length, drafted: draftTimes.length,
          medianAckMin: median(ackTimes), medianDraftMin: median(draftTimes),
          fastestAckMin: ackTimes.length ? Math.min(...ackTimes) : null,
          bySeverity: rs.reduce((a, r) => { a[r.severity] = (a[r.severity] || 0) + 1; return a; }, {}) });
      } catch (e) { return jsonResp({ ok: false, error: 'metrics_failed', detail: String(e).slice(0, 140) }, 500); }
    }

    // POST /archive/add  { kind, rows:[{src,title,body,url,author,tone,meta,ts}] }
    // Bulk backfill for historical series (tools/backfill.py). Key-gated.
    if (path === '/archive/add') {
      if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        const b = await req.json();
        const kind = (String(b.kind || 'hist').replace(/[^\w]/g, '').slice(0, 24)) || 'hist';
        const rows = Array.isArray(b.rows) ? b.rows : [];
        const n = await archiveItems(env, kind, rows, true);
        // `added` is what D1 reports as written; `total` is the kind's row count
        // read back afterwards so a loader can prove its rows landed.
        const tot = await env.MIND_DB.prepare('SELECT COUNT(*) c FROM arc_items WHERE kind=?').bind(kind).first();
        return jsonResp({ ok: true, added: n, kind, total: (tot && tot.c) || 0 });
      } catch (e) { return jsonResp({ ok: false, error: 'add_failed', detail: String(e && e.message || e).slice(0, 200) }, 500); }
    }

    // POST /archive/selftest - prove writes persist in the database this worker
    // is actually bound to. Writes a canary row through the same helper the
    // loaders use, reads it straight back, and reports what the table holds.
    // Full-role only. Answers "did the rows land elsewhere, or not at all".
    if (path === '/archive/selftest') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      const out = { ok: true, at: new Date().toISOString() };
      try {
        await ensureArchive(env);
        const t = Date.now();
        const curl = 'x:selftest:' + t;
        out.canaryWritten = await archiveItems(env, 'selftest', [{ src: 'axiom', title: 'archive selftest', body: 'canary', url: curl, ts: t, meta: { ns: 'cmm' } }], true);
        const back = await env.MIND_DB.prepare("SELECT id, ts FROM arc_items WHERE kind='selftest' AND url=?").bind(curl).first();
        out.canaryReadBack = back ? { id: back.id, ts: back.ts } : null;
        out.writesPersist = !!back;
        // `seen` is insert time, so it dates the database itself: a table whose
        // first write is days old cannot be the one an older load landed in.
        const k = await env.MIND_DB.prepare('SELECT kind, COUNT(*) c, MIN(seen) firstSeen, MAX(seen) lastSeen FROM arc_items GROUP BY kind ORDER BY c DESC').all();
        out.byKind = {}; out.timeline = [];
        (k.results || []).forEach(r => {
          out.byKind[r.kind] = r.c;
          out.timeline.push({ kind: r.kind, rows: r.c, firstWritten: r.firstSeen ? new Date(r.firstSeen).toISOString() : null, lastWritten: r.lastSeen ? new Date(r.lastSeen).toISOString() : null });
        });
        out.table = await env.MIND_DB.prepare('SELECT COUNT(*) rows, MIN(id) minId, MAX(id) maxId, MIN(ts) oldest, MAX(ts) newest, MIN(seen) firstWrite, MAX(seen) lastWrite FROM arc_items').first();
        if (out.table && out.table.firstWrite) out.databaseFirstWrite = new Date(out.table.firstWrite).toISOString();
        try {
          const sq = await env.MIND_DB.prepare("SELECT seq FROM sqlite_sequence WHERE name='arc_items'").first();
          out.insertAttempts = sq ? sq.seq : null;
        } catch (e) { out.insertAttempts = null; }
        out.idNote = 'A deduped insert still consumes an id, so maxId counts insert attempts and is always far above the row count. Gaps are normal, not deletions.';
        out.audience = {};
        for (const kk of ['campaign', 'engagement', 'adcreative', 'social_post', 'comments']) {
          const c = await env.MIND_DB.prepare('SELECT COUNT(*) c, MAX(ts) newest FROM arc_items WHERE kind=?').bind(kk).first();
          out.audience[kk] = { rows: (c && c.c) || 0, newest: (c && c.newest) || null };
        }
        // tidy: canaries older than an hour have served their purpose
        await env.MIND_DB.prepare("DELETE FROM arc_items WHERE kind='selftest' AND ts<?").bind(t - 3600000).run();
        return jsonResp(out);
      } catch (e) {
        out.ok = false; out.error = 'selftest_failed'; out.detail = String((e && e.message) || e).slice(0, 300);
        return jsonResp(out, 500);
      }
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
    // -- Audience: ads / social / comments aggregates straight from the archive
    //    GET /perf/ads|social|comments?ns=&days=   POST /perf/analyse {ns,days}
    // -- Reddit signal: the AU political subreddits, threads and comments ----
    //    GET  /reddit/threads?sub=&days=&issue=&q=&limit=     archived threads + tone of held comments
    //    GET  /reddit/comments?thread=<id>[&live=1]          archived comments; live=1 fetches fresh (full role)
    //    GET  /reddit/status                                 last sweep, counts by sub
    //    GET  /reddit/issues                                 the client-issue lexicon (ids, matchers, search terms)
    //    POST /reddit/sweep {subs,perSub,threads,commentsPer,queries}  collect now (full role)
    //         queries: 'auto' sweeps every client keyword, or hand in the slice you want
    //    POST /reddit/analyse {threads:[ids]|sub, days, ns}   Claude reads the threads (full role)
    //    POST /reddit/mind {threads:[ids], ns, title}         file a digest in the Mind (full role)
    if (path.startsWith('/reddit/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      const rsub = redditSubClean(reqUrl.searchParams.get('sub') || '');
      const rdays = Math.min(parseInt(reqUrl.searchParams.get('days') || '7', 10) || 7, 365);
      const rsince = Date.now() - rdays * 86400000;
      const rissue = String(reqUrl.searchParams.get('issue') || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
      const rq = String(reqUrl.searchParams.get('q') || '').slice(0, 120);
      const pj = s => { if (Array.isArray(s)) return s; try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
      let rbody = {}; if (req.method === 'POST') { try { rbody = await req.json(); } catch (e) { rbody = {}; } }
      try {
        await ensureArchive(env);
        const db = env.MIND_DB;
        const threadRows = async (ids) => {
          if (!ids.length) return [];
          const ph = ids.map(() => '?').join(',');
          return (await db.prepare("SELECT title, body, url, ts, json_extract(meta,'$.sub') sub, json_extract(meta,'$.id') id, json_extract(meta,'$.score') score, json_extract(meta,'$.comments') comments, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='reddit_thread' AND json_extract(meta,'$.id') IN (" + ph + ')').bind(...ids).all()).results || [];
        };
        const commentRows = async (id, lim) => (await db.prepare("SELECT body, COALESCE(tone,0) tone, ts, json_extract(meta,'$.score') score, json_extract(meta,'$.depth') depth, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='reddit_comment' AND json_extract(meta,'$.thread')=? ORDER BY COALESCE(json_extract(meta,'$.score'),0) DESC LIMIT ?").bind(id, lim || 200).all()).results || [];
        if (path === '/reddit/status') {
          let last = {}; try { last = JSON.parse(await kvGet(env.AXIOM_KV, 'reddit_last_result') || '{}'); } catch (e) {}
          const c = await db.batch([
            db.prepare("SELECT json_extract(meta,'$.sub') sub, COUNT(*) n, MAX(ts) newest FROM arc_items WHERE kind='reddit_thread' GROUP BY sub ORDER BY n DESC"),
            db.prepare("SELECT COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive, MAX(ts) newest FROM arc_items WHERE kind='reddit_comment'"),
          ]);
          const st = { ok: true, subs: REDDIT_POLITICS, authenticated: redditAuthed(env), bySub: c[0].results || [], comments: (c[1].results || [])[0] || {}, last_sweep: Number(await kvGet(env.AXIOM_KV, 'reddit_last_sweep') || 0) || null, last_result: last };
          // ?probe=1 walks the chain live and names the first step that fails,
          // so "0 threads" never has to be guessed at.
          if (reqUrl.searchParams.get('probe')) {
            const steps = []; const authed = redditAuthed(env);
            steps.push({ step: 'Reddit app credentials', ok: true, detail: authed ? 'REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET are set: requests go through oauth.reddit.com at 60 a minute' : 'not set: reading anonymously through api.reddit.com, old.reddit.com and www.reddit.com in turn, about 10 a minute' });
            if (authed) { try { await redditToken(env); steps.push({ step: 'OAuth token', ok: true, detail: 'issued and cached' }); } catch (e) { steps.push({ step: 'OAuth token', ok: false, detail: String((e && e.message) || e).slice(0, 160) }); } }
            try { const l = await redditListing(env, 'AustralianPolitics', 'hot', 5); steps.push({ step: 'listing r/AustralianPolitics/hot', ok: true, detail: l.length + ' threads returned' + (l[0] ? ', top: ' + l[0].title.slice(0, 80) : '') }); }
            catch (e) { steps.push({ step: 'listing r/AustralianPolitics/hot', ok: false, detail: String((e && e.message) || e).slice(0, 160) }); }
            const bad = steps.filter(s => !s.ok);
            const fix = bad.length && !authed && /reddit_403|reddit_unreachable|reddit_rate|reddit_5\d\d/.test(bad[0].detail)
              ? ' Reddit refuses anonymous reads from cloud networks and closed self-service API registration in late 2025. Run the sweep from a machine that is logged in instead: on a Mac with agent-reach, python3 tools/reach-reddit.py --install-launchd files threads and comments here every three hours. If you already hold Reddit app credentials, REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET as worker secrets also work.'
              : bad.length && /reddit_oauth/.test(bad[0].detail) ? ' Reddit rejected the app credentials. Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET, and that the app type is script.' : '';
            st.probe = { steps, ready: !bad.length, authenticated: authed, summary: bad.length ? 'Blocked at: ' + bad[0].step + ' (' + bad[0].detail + ').' + fix : 'Reddit is reachable' + (authed ? ' with your app credentials.' : ' without credentials.') };
          }
          return jsonResp(st);
        }
        if (path === '/reddit/threads') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '60', 10) || 60, 200);
          const w = ["kind='reddit_thread'", 'ts>?']; const b = [rsince];
          if (rsub) { w.push("LOWER(json_extract(meta,'$.sub'))=?"); b.push(rsub.toLowerCase()); }
          if (rissue) { w.push('meta LIKE ?'); b.push('%"' + rissue + '"%'); }
          if (rq) { w.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); const l = arcLike(rq); b.push(l, l); }
          const rows = (await db.prepare("SELECT title, body, url, ts, COALESCE(tone,0) tone, json_extract(meta,'$.sub') sub, json_extract(meta,'$.id') id, json_extract(meta,'$.score') score, json_extract(meta,'$.ratio') ratio, json_extract(meta,'$.comments') comments, json_extract(meta,'$.flair') flair, json_extract(meta,'$.domain') domain, json_extract(meta,'$.link') link, json_extract(meta,'$.issues') issues FROM arc_items WHERE " + w.join(' AND ') + ' ORDER BY ts DESC LIMIT ' + lim).bind(...b).all()).results || [];
          const ids = rows.map(r => r.id).filter(Boolean).slice(0, 200);
          const held = {};
          if (ids.length) {
            const ph = ids.map(() => '?').join(',');
            ((await db.prepare("SELECT json_extract(meta,'$.thread') t, COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind='reddit_comment' AND json_extract(meta,'$.thread') IN (" + ph + ') GROUP BY t').bind(...ids).all()).results || []).forEach(x => { held[x.t] = { n: x.n || 0, hostile: x.hostile || 0, supportive: x.supportive || 0 }; });
          }
          const agg = await db.batch([
            db.prepare("SELECT json_extract(meta,'$.sub') sub, COUNT(*) n FROM arc_items WHERE kind='reddit_thread' AND ts>? GROUP BY sub ORDER BY n DESC").bind(rsince),
            db.prepare("SELECT COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind='reddit_comment' AND ts>?").bind(rsince),
            db.prepare("SELECT COUNT(*) total, MAX(ts) newest FROM arc_items WHERE kind='reddit_thread'"),
          ]);
          return jsonResp({ ok: true, days: rdays, sub: rsub, issue: rissue, q: rq,
            threads: rows.map(r => ({ title: r.title, url: r.url, ts: r.ts, tone: r.tone, sub: r.sub, id: r.id, score: r.score, ratio: r.ratio, comments: r.comments, flair: r.flair, domain: r.domain, link: r.link, issues: pj(r.issues), excerpt: String(r.body || '').split('\n')[0].slice(0, 500), held: held[r.id] || null })),
            bySub: agg[0].results || [], commentTone: (agg[1].results || [])[0] || {}, have: (agg[2].results || [])[0] || { total: 0 } });
        }
        if (path === '/reddit/comments') {
          const tid = String(reqUrl.searchParams.get('thread') || '').replace(/[^a-z0-9_]/gi, '').slice(0, 20);
          if (!tid) return jsonResp({ error: 'missing_thread' }, 400);
          if (reqUrl.searchParams.get('live')) {
            if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'A live fetch writes to the archive and needs a full-access key.' }, 403);
            const t = (await threadRows([tid]))[0];
            if (!t) return jsonResp({ error: 'unknown_thread', detail: 'Sweep first so the thread is on file.' }, 404);
            const cs = await redditThreadComments(env, t.sub, tid, 120, 4);
            const tIssues = pj(t.issues);
            const rows = cs.map(c => { const all = issueMerge(redditIssues(c.body), tIssues); return {
              src: 'reddit', title: 'Comment on: ' + String(t.title).slice(0, 120), body: c.body, url: 'x:rcmt:' + c.id, author: '', tone: commentTone(c.body), ts: c.created || Date.now(),
              meta: { sub: t.sub, thread: tid, thread_title: String(t.title).slice(0, 200), permalink: t.url, score: c.score, depth: c.depth, issues: all, issue: all[0] || '', tone: commentTone(c.body) } }; });
            let added = 0; for (let i = 0; i < rows.length; i += 150) added += await archiveItems(env, 'reddit_comment', rows.slice(i, i + 150));
            return jsonResp({ ok: true, thread: tid, live: true, fetched: cs.length, added, comments: rows.map(r => ({ body: r.body, tone: r.tone, ts: r.ts, score: r.meta.score, depth: r.meta.depth, issues: r.meta.issues })) });
          }
          const rows = await commentRows(tid, 200);
          return jsonResp({ ok: true, thread: tid, live: false, comments: rows.map(r => ({ body: r.body, tone: r.tone, ts: r.ts, score: r.score, depth: r.depth, issues: pj(r.issues) })) });
        }
        // The lexicon itself, so a collector on someone's desktop tags exactly
        // as the worker does instead of drifting from its own copy.
        if (path === '/reddit/issues') {
          return jsonResp({ ok: true, issues: CLIENT_ISSUES.map(ci => ({
            id: ci.id, ns: ci.ns, client: ci.client, label: ci.label,
            rx: ci.rx.source, wide: (ci.wide || ci.rx).source, q: ci.q || [],
          })), subs: REDDIT_POLITICS });
        }
        if (path === '/reddit/sweep' && req.method === 'POST') {
          const r = await redditSweep(env, rbody || {});
          await kvPut(env.AXIOM_KV, 'reddit_last_sweep', String(Date.now()), 86400);
          await kvPut(env.AXIOM_KV, 'reddit_last_result', JSON.stringify(r).slice(0, 4000), 7 * 86400);
          return jsonResp(r);
        }
        if (path === '/reddit/analyse' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          const ns = String(rbody.ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm';
          let ids = Array.isArray(rbody.threads) ? rbody.threads.map(x => String(x).replace(/[^a-z0-9_]/gi, '').slice(0, 20)).filter(Boolean).slice(0, 12) : [];
          if (!ids.length) {
            const w = ["kind='reddit_thread'", 'ts>?']; const b = [Date.now() - (Math.min(parseInt(rbody.days, 10) || rdays, 365)) * 86400000];
            const s2 = redditSubClean(rbody.sub || ''); if (s2) { w.push("LOWER(json_extract(meta,'$.sub'))=?"); b.push(s2.toLowerCase()); }
            const is2 = String(rbody.issue || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24); if (is2) { w.push('meta LIKE ?'); b.push('%"' + is2 + '"%'); }
            ids = ((await db.prepare("SELECT json_extract(meta,'$.id') id FROM arc_items WHERE " + w.join(' AND ') + " ORDER BY COALESCE(json_extract(meta,'$.comments'),0) DESC LIMIT 12").bind(...b).all()).results || []).map(r => r.id).filter(Boolean);
          }
          const threads = await threadRows(ids);
          if (!threads.length) return jsonResp({ ok: false, error: 'no_threads', detail: 'Nothing on file for that scope. Sweep first.' }, 404);
          let corpus = ''; let nC = 0;
          for (const t of threads) {
            const cs = await commentRows(t.id, 25); nC += cs.length;
            corpus += '\n## r/' + t.sub + ' - ' + String(t.title).slice(0, 200) + ' (' + (t.score || 0) + ' points, ' + (t.comments || 0) + ' comments)\n' + String(t.body || '').split('\n')[0].slice(0, 500) + '\n'
              + cs.map(c => '- [' + (c.tone < 0 ? 'hostile' : c.tone > 0 ? 'supportive' : 'neutral') + ', ' + (c.score || 0) + ' pts] ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 320)).join('\n') + '\n';
          }
          const client = (CLIENT_ISSUES.find(ci => ci.ns === ns) || {}).client || 'Curious Minds';
          const sys = 'You are a senior Australian political communications analyst working for ' + client + '. You are reading Reddit threads and comments from Australian political subreddits. Reddit skews young, progressive and hostile to industry, so read it as an early-warning channel for the arguments that will reach mainstream comment sections, not as a poll. Return strict JSON only, no prose outside it, with this shape: {"summary":"two or three sentences","themes":[{"theme":"","stance":"hostile|supportive|mixed|neutral","share":"approx %","quotes":["verbatim comment"],"read":"what it means for us"}],"attackLines":["the arguments used against our client, in the words used"],"supportLines":["arguments made in our favour"],"risks":["what could cross into mainstream media"],"openings":["where a well-placed fact or line would land"],"replies":[{"to":"theme","line":"a ready reply in plain Australian English, no jargon"}]}';
          const txt = await claudeMsg(env, sys, 'Threads and comments:\n' + corpus.slice(0, 60000), 2600, 75000);
          const s = typeof txt === 'string' ? txt : (txt && (txt.text || JSON.stringify(txt))) || '';
          let a = null; try { a = JSON.parse((s.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch (e) { a = null; }
          if (!a) return jsonResp({ ok: false, error: 'analysis_unparseable', detail: s.slice(0, 200) }, 502);
          try { await db.prepare('CREATE TABLE IF NOT EXISTS mind_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, mode TEXT, q TEXT, created INTEGER)').run(); await db.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, 'reddit', threads.length + ' threads / ' + nC + ' comments', Date.now()).run(); } catch (e) {}
          return jsonResp({ ok: true, ns, threads: threads.length, comments: nC, analysis: a });
        }
        if (path === '/reddit/mind' && req.method === 'POST') {
          const ns = String(rbody.ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm';
          const ids = (Array.isArray(rbody.threads) ? rbody.threads : []).map(x => String(x).replace(/[^a-z0-9_]/gi, '').slice(0, 20)).filter(Boolean).slice(0, 25);
          if (!ids.length) return jsonResp({ error: 'missing_threads', detail: 'Pick at least one thread.' }, 400);
          const threads = await threadRows(ids);
          if (!threads.length) return jsonResp({ ok: false, error: 'no_threads', detail: 'None of those threads are on file.' }, 404);
          const day = new Date().toISOString().slice(0, 10);
          let text = '# Reddit signal - ' + day + '\n\nSource: Australian political subreddits via AXIOM. Comment authors are not recorded.\n';
          let nC = 0; const subs = new Set();
          for (const t of threads) {
            subs.add(t.sub);
            const cs = await commentRows(t.id, 30); nC += cs.length;
            text += '\n## ' + String(t.title).slice(0, 200) + '\nr/' + t.sub + ' - ' + (t.score || 0) + ' points, ' + (t.comments || 0) + ' comments - ' + t.url + '\nIssues: ' + (pj(t.issues).join(', ') || 'none tagged') + '\n' + String(t.body || '').split('\n')[0].slice(0, 800) + '\n\n### Top comments\n'
              + cs.map(c => '- (' + (c.tone < 0 ? 'hostile' : c.tone > 0 ? 'supportive' : 'neutral') + ', ' + (c.score || 0) + ' pts) ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 600)).join('\n') + '\n';
          }
          const title = String(rbody.title || ('Reddit signal ' + day + ' - ' + [...subs].map(s => 'r/' + s).join(', '))).slice(0, 200);
          const r = await mindIngestDoc(env, { ns, title, text, kind: 'reddit', source: 'reddit:' + [...subs].join(','), date: day });
          try { await db.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, 'reddit_ingest', threads.length + ' threads / ' + nC + ' comments', Date.now()).run(); } catch (e) {}
          return jsonResp({ ok: true, ns, docId: r.docId, chunks: r.chunks, threads: threads.length, comments: nC, title });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) {
        const m = String((e && e.message) || e);
        if (/mind_not_configured/.test(m)) return jsonResp({ ok: false, error: 'mind_not_configured', detail: m.slice(0, 200) }, 501);
        if (/reddit_rate_limited/.test(m)) return jsonResp({ ok: false, error: 'reddit_rate_limited', detail: 'Reddit is throttling us. Wait a minute and try again.' }, 429);
        if (/reddit_oauth/.test(m)) return jsonResp({ ok: false, error: 'reddit_oauth_failed', detail: 'Reddit rejected the app credentials (' + m.slice(0, 60) + '). Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET.' }, 502);
        if (/reddit_403|reddit_unreachable/.test(m)) return jsonResp({ ok: false, error: 'reddit_blocked', detail: 'Reddit is refusing anonymous reads from this network (' + m.slice(0, 40) + '). Collect from a logged-in machine instead: tools/reach-reddit.py on a Mac with agent-reach. If you already hold Reddit app credentials, REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET as worker secrets also work.' }, 502);
        return jsonResp({ ok: false, error: 'reddit_failed', detail: m.slice(0, 200) }, 500);
      }
    }

    // -- The Signal Bridge: jobs the portal starts and the desktop finishes ----
    //    POST /bridge/run {source,params}  start a sweep; returns {id} to tail
    //    GET  /bridge/job?id=&after=       the live log (read role - this is what the console polls)
    //    GET  /bridge/status               connected collectors, queue, recent jobs
    //    GET  /bridge/next?agent=&sources= a desktop collector claims a job (full role)
    //    POST /bridge/log {job,lines}      the collector streams its commands and answers
    //    POST /bridge/done {job,ok,result} the collector reports the outcome
    if (path.startsWith('/bridge/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let bbody = {}; if (req.method === 'POST') { try { bbody = await req.json(); } catch (e) { bbody = {}; } }
      try {
        await ensureArchive(env); await ensureBridge(env);
        if (path === '/bridge/run' && req.method === 'POST') {
          const source = sigSource(bbody.source);
          if (!source) return jsonResp({ error: 'unknown_source', detail: 'source must be one of ' + BRIDGE_SOURCES.join(', ') + '.' }, 400);
          const params = (bbody.params && typeof bbody.params === 'object') ? bbody.params : {};
          const job = await jobCreate(env, source, Object.assign({}, params, { where: bbody.where || 'auto' }), auth.name);
          if (job.local) {
            // run it after the response so the console can start tailing at once
            ctx.waitUntil(jobRunLocal(env, { id: job.id, source, params }));
          }
          return jsonResp({ ok: true, id: job.id, source, where: job.local ? 'worker' : 'desktop',
            note: job.local ? 'Running in the worker. Tail /bridge/job?id=' + job.id : 'Queued for a desktop collector. Start it with: python3 tools/reach-agent.py --key $AXIOM_KEY' });
        }
        if (path === '/bridge/job') {
          const id = String(reqUrl.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const t = await jobTail(env, id, reqUrl.searchParams.get('after'));
          return t ? jsonResp(t) : jsonResp({ error: 'unknown_job' }, 404);
        }
        if (path === '/bridge/status') {
          const jobs = (await env.MIND_DB.prepare('SELECT id,source,status,agent,created,finished,ok FROM bridge_jobs ORDER BY created DESC LIMIT 12').all()).results || [];
          const q = (await env.MIND_DB.prepare("SELECT COUNT(*) n FROM bridge_jobs WHERE status='queued'").first()) || {};
          return jsonResp({ ok: true, agents: await agentsSeen(env), queued: q.n || 0, jobs,
            sources: BRIDGE_SOURCES.map(sc => ({ source: sc, desktopOnly: BRIDGE_DESKTOP_ONLY.indexOf(sc) >= 0,
              ready: sc === 'reddit' ? true : sc === 'meta' ? !!(env.META_TOKEN && metaPages(env).length) : sc === 'linkedin' ? !!(env.LINKEDIN_TOKEN && liOrgs(env).length) : sc === 'render' ? renderConfigured(env) : true })) });
        }
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Collector routes need a full-access key.' }, 403);
        if (path === '/bridge/next') {
          const agent = String(reqUrl.searchParams.get('agent') || 'agent').slice(0, 40);
          const sources = String(reqUrl.searchParams.get('sources') || '').split(',').map(x => x.trim()).filter(Boolean);
          await agentBeat(env, agent, sources.length ? sources : BRIDGE_SOURCES);
          const job = await jobClaim(env, agent, sources);
          return jsonResp({ ok: true, job: job, lexicon: job ? { issues: CLIENT_ISSUES.map(ci => ({ id: ci.id, ns: ci.ns, wide: (ci.wide || ci.rx).source, q: ci.q || [] })), subs: REDDIT_POLITICS } : null });
        }
        if (path === '/bridge/log' && req.method === 'POST') {
          const id = String(bbody.job || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const lines = (Array.isArray(bbody.lines) ? bbody.lines : []).map(l => ({ k: (l && (l.k || l.kind)) || 'info', t: (l && (l.t || l.text)) || '' }));
          if (!id || !lines.length) return jsonResp({ error: 'missing_job_or_lines' }, 400);
          await jobLog(env, id, lines);
          return jsonResp({ ok: true, wrote: Math.min(lines.length, 40) });
        }
        if (path === '/bridge/done' && req.method === 'POST') {
          const id = String(bbody.job || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          if (!id) return jsonResp({ error: 'missing_job' }, 400);
          await jobFinish(env, id, bbody.ok !== false, bbody.result || {});
          return jsonResp({ ok: true });
        }
        if (path === '/bridge/cancel' && req.method === 'POST') {
          const id = String(bbody.job || bbody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          if (!id) return jsonResp({ error: 'missing_job' }, 400);
          await env.MIND_DB.prepare("UPDATE bridge_jobs SET status='cancelled', finished=? WHERE id=? AND status IN ('queued','running')").bind(Date.now(), id).run();
          await jobLog(env, id, [{ k: 'info', t: 'cancelled by ' + (auth.name || 'user') }]);
          return jsonResp({ ok: true });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'bridge_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- The Release Desk ---------------------------------------------------------
    //    GET  /brand/kit?ns=                 the client's brand kit (palette, fonts, voice, rules, hasLogo)
    //    GET  /brand/logo?ns=                the logo bytes
    //    POST /brand/kit {ns,palette,fonts,voice,rules,logoB64,logoMime,removeLogo}   (full role)
    //    POST /release/pack {ns,text,tiles,format,brief}   paste a release; returns {id, job} to tail (full role)
    //    POST /release/render {id,n,patch}                  render one tile in the brand (full role)
    //    POST /release/update {id,n,patch}                  save edited copy without re-rendering (full role)
    //    GET  /release/pack?id=   GET /release/list?ns=   GET /release/tile?id=&n=
    if (path.startsWith('/brand/') || path.startsWith('/release/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let rbody2 = {}; if (req.method === 'POST') { try { rbody2 = await req.json(); } catch (e) { rbody2 = {}; } }
      const ns2 = relNs(reqUrl.searchParams.get('ns') || rbody2.ns);
      try {
        await ensureArchive(env); await ensureBridge(env); await ensureRelease(env);
        if (path === '/brand/kit' && req.method === 'GET') {
          const kit = await brandKit(env, ns2);
          return jsonResp({ ok: true, ns: ns2, kit: kit || null, hasLogo: !!(kit && kit.hasLogo), logoUrl: kit && kit.hasLogo ? '/brand/logo?ns=' + ns2 + '&v=' + (kit.updated || 0) : '' });
        }
        if (path === '/brand/logo') {
          const lg = await brandLogo(env, ns2);
          if (!lg) return jsonResp({ error: 'no_logo' }, 404);
          return new Response(lg.bytes, { headers: Object.assign({}, CORS, { 'Content-Type': lg.mime, 'Cache-Control': 'private, max-age=300' }) });
        }
        if (path === '/release/tile') {
          const id = String(reqUrl.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const n = Math.max(0, parseInt(reqUrl.searchParams.get('n') || '0', 10) || 0);
          if (!env.MIND_DOCS) return jsonResp({ error: 'mind_not_configured' }, 501);
          const obj = await env.MIND_DOCS.get('packs/' + id + '/' + n + '.png');
          if (!obj) return jsonResp({ error: 'not_rendered' }, 404);
          return new Response(obj.body, { headers: Object.assign({}, CORS, { 'Content-Type': (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/png', 'Cache-Control': 'private, max-age=3600' }) });
        }
        if (path === '/release/pack' && req.method === 'GET') {
          const id = String(reqUrl.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const row = await env.MIND_DB.prepare('SELECT id,ns,title,source,extract,tiles,status,job,who,format,created,updated FROM release_packs WHERE id=?').bind(id).first();
          if (!row) return jsonResp({ error: 'unknown_pack' }, 404);
          let tiles = [], extract = null; try { tiles = JSON.parse(row.tiles || '[]'); } catch (e) {} try { extract = JSON.parse(row.extract || 'null'); } catch (e) {}
          return jsonResp({ ok: true, pack: { id: row.id, ns: row.ns, title: row.title, status: row.status, job: row.job, who: row.who, format: row.format, created: row.created, updated: row.updated,
            source: row.source, extract, tiles: tiles.map(t => relTileView(row.id, t)) } });
        }
        if (path === '/release/list') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '20', 10) || 20, 100);
          const rows = (await env.MIND_DB.prepare('SELECT id,ns,title,status,who,format,created,updated,tiles FROM release_packs WHERE ns=? ORDER BY created DESC LIMIT ?').bind(ns2, lim).all()).results || [];
          return jsonResp({ ok: true, ns: ns2, packs: rows.map(r => { let t = []; try { t = JSON.parse(r.tiles || '[]'); } catch (e) {}
            return { id: r.id, title: r.title, status: r.status, who: r.who, format: r.format, created: r.created, updated: r.updated, tiles: t.length, rendered: t.filter(x => x.image).length,
              cover: (t.find(x => x.image) ? '/release/tile?id=' + r.id + '&n=' + t.find(x => x.image).n + '&v=' + (t.find(x => x.image).image.ver || 1) : '') }; }) });
        }
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Building packs, rendering tiles and editing the brand kit need a full-access key.' }, 403);
        if (path === '/brand/kit' && req.method === 'POST') {
          const kit = await brandSave(env, ns2, rbody2, auth.name);
          return jsonResp({ ok: true, ns: ns2, kit, hasLogo: !!kit.hasLogo, logoUrl: kit.hasLogo ? '/brand/logo?ns=' + ns2 + '&v=' + kit.updated : '' });
        }
        if (path === '/release/pack' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          const text = String(rbody2.text || '').replace(/\r/g, '').trim();
          if (text.length < 200) return jsonResp({ error: 'release_too_short', detail: 'Paste the whole release - at least a few paragraphs.' }, 400);
          if (text.length > 40000) return jsonResp({ error: 'release_too_long', detail: 'That is over 40,000 characters. Paste the release, not the attachments.' }, 400);
          const format = RELEASE_FORMATS[String(rbody2.format || '')] ? String(rbody2.format) : 'square';
          const id = relId();
          const job = await jobCreate(env, 'release', { packId: id, ns: ns2, where: 'worker' }, auth.name);
          await env.MIND_DB.prepare('INSERT INTO release_packs(id,ns,title,source,extract,tiles,status,job,who,format,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(id, ns2, String(rbody2.title || text.split('\n')[0]).slice(0, 200), text, '', '[]', 'composing', job.id, auth.name || '', format, Date.now(), Date.now()).run();
          ctx.waitUntil(releaseBuild(env, id, { job: job.id, tiles: rbody2.tiles, brief: rbody2.brief }));
          return jsonResp({ ok: true, id, job: job.id, ns: ns2, format });
        }
        if (path === '/release/render' && req.method === 'POST') {
          const id = String(rbody2.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const n = Math.max(0, parseInt(rbody2.n, 10) || 0);
          const r = await releaseRender(env, id, n, rbody2.patch, auth.name);
          return jsonResp(r, r.ok ? 200 : (r.status || 500));
        }
        if (path === '/release/update' && req.method === 'POST') {
          const id = String(rbody2.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const n = Math.max(0, parseInt(rbody2.n, 10) || 0);
          const row = await env.MIND_DB.prepare('SELECT tiles,source FROM release_packs WHERE id=?').bind(id).first();
          if (!row) return jsonResp({ error: 'unknown_pack' }, 404);
          let tiles = []; try { tiles = JSON.parse(row.tiles || '[]'); } catch (e) {}
          if (!tiles[n]) return jsonResp({ error: 'unknown_tile' }, 404);
          const patch = rbody2.patch && typeof rbody2.patch === 'object' ? rbody2.patch : {};
          ['headline', 'support', 'cta', 'alt', 'visual'].forEach(k => { if (patch[k] != null) tiles[n][k] = String(patch[k]).slice(0, k === 'headline' ? 90 : k === 'support' ? 180 : k === 'cta' ? 40 : 240); });
          if (patch.caption && typeof patch.caption === 'object') { tiles[n].caption = tiles[n].caption || {}; ['linkedin', 'x', 'facebook'].forEach(k => { if (patch.caption[k] != null) tiles[n].caption[k] = String(patch.caption[k]).slice(0, k === 'x' ? 280 : 700); }); }
          tiles[n].check = relNumberCheck(tiles[n].headline + ' ' + tiles[n].support + ' ' + tiles[n].cta, row.source || '');
          await env.MIND_DB.prepare('UPDATE release_packs SET tiles=?, updated=? WHERE id=?').bind(JSON.stringify(tiles), Date.now(), id).run();
          return jsonResp({ ok: true, tile: relTileView(id, tiles[n]) });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) {
        const m = String((e && e.message) || e);
        if (/mind_not_configured/.test(m)) return jsonResp({ ok: false, error: 'mind_not_configured', detail: m.slice(0, 200) }, 501);
        return jsonResp({ ok: false, error: 'release_failed', detail: m.slice(0, 200) }, /larger than|must be|empty|too/.test(m) ? 400 : 500);
      }
    }

    // -- The Engine: what the team teaches it, what it approved, what it remembers --
    //    POST /engine/fix {ns,task,scope,wrong,right,why,source}   teach a correction (full)
    //    GET  /engine/fixes?ns=&task=&all=1                         what is in force (read)
    //    POST /engine/fix/update {id,active,rule}   POST /engine/fix/delete {id}
    //    POST /engine/outcome {ns,surface,ref,n,verdict,why,headline,support,cta}   approve / kill (full)
    //    GET  /engine/outcomes?ns=
    //    POST /engine/artwork {ns,title,imageB64,mime,meta}         remember a piece of past artwork (full)
    //    GET  /engine/art?id=   GET /engine/artworks?ns=   GET /engine/status?ns=
    if (path.startsWith('/engine/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let ebody = {}; if (req.method === 'POST') { try { ebody = await req.json(); } catch (e) { ebody = {}; } }
      const ens = relNs(reqUrl.searchParams.get('ns') || ebody.ns);
      try {
        await ensureArchive(env); await ensureEngine(env);
        if (path === '/engine/fixes') {
          const fixes = await engineFixes(env, ens, reqUrl.searchParams.get('task') || '', !!reqUrl.searchParams.get('all'));
          return jsonResp({ ok: true, ns: ens, fixes, inForce: fixes.filter(f => f.active).length });
        }
        if (path === '/engine/outcomes') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '50', 10) || 50, 200);
          const rows = (await env.MIND_DB.prepare('SELECT id,ns,surface,ref,n,verdict,why,headline,support,cta,who,created FROM engine_outcomes WHERE ns=? ORDER BY created DESC LIMIT ?').bind(ens, lim).all()).results || [];
          return jsonResp({ ok: true, ns: ens, outcomes: rows, approved: rows.filter(r => r.verdict === 'approved').length, killed: rows.filter(r => r.verdict === 'killed').length });
        }
        if (path === '/engine/artworks') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '50', 10) || 50, 200);
          const rows = (await env.MIND_DB.prepare('SELECT id,ns,title,mime,description,meta,who,created FROM engine_art WHERE ns=? ORDER BY created DESC LIMIT ?').bind(ens, lim).all()).results || [];
          return jsonResp({ ok: true, ns: ens, artworks: rows.map(r => ({ id: r.id, title: r.title, mime: r.mime, description: r.description, meta: (() => { try { return JSON.parse(r.meta || '{}'); } catch (e) { return {}; } })(), who: r.who, created: r.created, url: '/engine/art?id=' + r.id })) });
        }
        if (path === '/engine/art') {
          const id = String(reqUrl.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const row = await env.MIND_DB.prepare('SELECT key,mime FROM engine_art WHERE id=?').bind(id).first();
          if (!row || !env.MIND_DOCS) return jsonResp({ error: 'unknown_artwork' }, 404);
          const obj = await env.MIND_DOCS.get(row.key);
          if (!obj) return jsonResp({ error: 'unknown_artwork' }, 404);
          return new Response(obj.body, { headers: Object.assign({}, CORS, { 'Content-Type': row.mime || 'image/png', 'Cache-Control': 'private, max-age=3600' }) });
        }
        if (path === '/engine/status') {
          const fx = (await env.MIND_DB.prepare("SELECT COUNT(*) n, SUM(active) live, SUM(hits) hits FROM engine_fixes WHERE ns=? OR scope='all'").bind(ens).first()) || {};
          const oc = (await env.MIND_DB.prepare("SELECT SUM(verdict='approved') approved, SUM(verdict='killed') killed FROM engine_outcomes WHERE ns=?").bind(ens).first()) || {};
          const ar = (await env.MIND_DB.prepare('SELECT COUNT(*) n FROM engine_art WHERE ns=?').bind(ens).first()) || {};
          let docs = [];
          try { docs = (await env.MIND_DB.prepare('SELECT kind, COUNT(*) n FROM mind_docs WHERE ns=? GROUP BY kind ORDER BY n DESC').bind(ens).all()).results || []; } catch (e) {}
          return jsonResp({ ok: true, ns: ens, fixes: { total: fx.n || 0, inForce: fx.live || 0, applied: fx.hits || 0 }, outcomes: { approved: oc.approved || 0, killed: oc.killed || 0 }, artworks: ar.n || 0, mind: docs });
        }
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Teaching the Engine, approving and filing artwork need a full-access key.' }, 403);
        if (path === '/engine/fix' && req.method === 'POST') {
          const fix = await engineAddFix(env, ebody, auth.name);
          return jsonResp({ ok: true, fix: Object.assign({}, fix, { active: true, hits: 0 }) });
        }
        if (path === '/engine/fix/update' && req.method === 'POST') {
          const id = String(ebody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          if (!id) return jsonResp({ error: 'missing_id' }, 400);
          if (ebody.active != null) await env.MIND_DB.prepare('UPDATE engine_fixes SET active=? WHERE id=?').bind(ebody.active ? 1 : 0, id).run();
          if (ebody.rule != null) await env.MIND_DB.prepare('UPDATE engine_fixes SET rule=? WHERE id=?').bind(String(ebody.rule).slice(0, 400), id).run();
          return jsonResp({ ok: true, id });
        }
        if (path === '/engine/fix/delete' && req.method === 'POST') {
          const id = String(ebody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          if (!id) return jsonResp({ error: 'missing_id' }, 400);
          await env.MIND_DB.prepare('DELETE FROM engine_fixes WHERE id=?').bind(id).run();
          return jsonResp({ ok: true, id });
        }
        if (path === '/engine/outcome' && req.method === 'POST') {
          const o = await engineOutcome(env, ebody, auth.name);
          return jsonResp({ ok: true, outcome: o });
        }
        if (path === '/engine/artwork' && req.method === 'POST') {
          const a = await engineArtwork(env, ebody, auth.name);
          return jsonResp({ ok: true, artwork: a });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) {
        const m = String((e && e.message) || e);
        if (/mind_not_configured/.test(m)) return jsonResp({ ok: false, error: 'mind_not_configured', detail: m.slice(0, 200) }, 501);
        if (/gemini_not_configured/.test(m)) return jsonResp({ ok: false, error: 'gemini_not_configured', detail: 'Set GEMINI_KEY to describe artwork.' }, 501);
        return jsonResp({ ok: false, error: 'engine_failed', detail: m.slice(0, 200) }, /larger than|must be|empty|needs what/.test(m) ? 400 : 500);
      }
    }

    // -- The overview: what changed, why it matters, where the evidence is (read) --
    //    GET /overview?days=   alerts open, narratives moving, entities that moved, issues against their baseline, the latest rows, collection health
    if (path === '/overview') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      if (req.method !== 'GET') return jsonResp({ error: 'not_found' }, 404);
      try { return jsonResp(await overview(env, { days: reqUrl.searchParams.get('days') })); }
      catch (e) { return jsonResp({ ok: false, error: 'overview_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- Narratives: the stories the conversation keeps telling, with origin, spread, pace, split and evidence --
    //    GET  /narratives?days=&issue=&ns=&platform=&status=&side=&q=&sort=velocity|n|new|latest&all=1&muted=1   (read)
    //    GET  /narratives/one?id=            the whole narrative: summary, claim, counter, spread, amplifiers, series, every row (read)
    //    GET  /narratives/status             live, emerging, named, alerts, backlog, budget (read)
    //    POST /narratives/run {hours,scan}   place, recount, name, pair, alert - as a job the console tails (full)
    //    POST /narratives/update {id,label,summary,claim,counter_claim,issues,muted,pinned}   an operator's edit (full)
    //    POST /narratives/merge {into,from}  fold one narrative into another (full)
    if (path === '/narratives' || path.startsWith('/narratives/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let nrb = {}; if (req.method === 'POST') { try { nrb = await req.json(); } catch (e) { nrb = {}; } }
      try {
        await ensureArchive(env); await ensureSentiment(env); await ensureNarratives(env);
        const qf = k => reqUrl.searchParams.get(k) || '';
        if (path === '/narratives' && req.method === 'GET') return jsonResp(await narrativesList(env, { days: qf('days'), issue: qf('issue'), ns: qf('ns'), platform: qf('platform'), status: qf('status'), side: qf('side'), entity: qf('entity'), q: qf('q'), sort: qf('sort'), all: qf('all') === '1', muted: qf('muted') === '1', limit: qf('limit') }));
        if (path === '/narratives/one' && req.method === 'GET') {
          const id = String(qf('id')).replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const r = id ? await narrativeOne(env, id) : null;
          return r ? jsonResp(Object.assign({ ok: true }, r)) : jsonResp({ error: 'unknown_narrative' }, 404);
        }
        if (path === '/narratives/status' && req.method === 'GET') return jsonResp(await narrativesStatus(env));
        if (req.method !== 'POST') return jsonResp({ error: 'not_found' }, 404);
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Running, editing and merging narratives need a full-access key.' }, 403);
        if (path === '/narratives/run') {
          const params = { hours: parseInt(nrb.hours, 10) || NARR_WINDOW_H, scan: parseInt(nrb.scan, 10) || NARR_SCAN, where: 'worker' };
          const job = await jobCreate(env, 'narratives', params, auth.name);
          ctx.waitUntil(jobRunLocal(env, { id: job.id, source: 'narratives', params }));
          return jsonResp({ ok: true, job: job.id, id: job.id, where: 'worker', note: 'Running in the worker. Tail /bridge/job?id=' + job.id });
        }
        if (path === '/narratives/update') {
          const id = String(nrb.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const cur = id ? await env.MIND_DB.prepare('SELECT * FROM narratives WHERE id=?').bind(id).first() : null;
          if (!cur) return jsonResp({ error: 'unknown_narrative' }, 404);
          const known = new Set(CLIENT_ISSUES.map(ci => ci.id));
          const issues = Array.isArray(nrb.issues) ? nrb.issues.map(String).filter(x => known.has(x)).slice(0, 3) : null;
          const textEdit = nrb.label != null || nrb.summary != null || nrb.claim != null || nrb.counter_claim != null || issues;
          await env.MIND_DB.prepare('UPDATE narratives SET label=?, summary=?, claim=?, counter_claim=?, issues=?, ns=?, muted=?, pinned=?, edited=CASE WHEN ? THEN 1 ELSE edited END, updated=? WHERE id=?')
            .bind(nrb.label != null ? String(nrb.label).slice(0, 140) : cur.label, nrb.summary != null ? String(nrb.summary).slice(0, 600) : cur.summary, nrb.claim != null ? String(nrb.claim).slice(0, 300) : cur.claim, nrb.counter_claim != null ? String(nrb.counter_claim).slice(0, 300) : cur.counter_claim,
              issues ? JSON.stringify(issues) : cur.issues, issues && issues.length ? ((CLIENT_ISSUES.find(ci => ci.id === issues[0]) || {}).ns || cur.ns) : cur.ns, nrb.muted == null ? cur.muted : (nrb.muted ? 1 : 0), nrb.pinned == null ? cur.pinned : (nrb.pinned ? 1 : 0), textEdit ? 1 : 0, Date.now(), id).run();
          return jsonResp({ ok: true, narrative: narrRow(await env.MIND_DB.prepare('SELECT * FROM narratives WHERE id=?').bind(id).first()) });
        }
        if (path === '/narratives/merge') {
          const into = String(nrb.into || '').replace(/[^a-z0-9]/gi, '').slice(0, 24), from = String(nrb.from || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          if (!into || !from || into === from) return jsonResp({ error: 'missing_ids', detail: 'Give into and from, two different narrative ids.' }, 400);
          const a = await env.MIND_DB.prepare('SELECT id, terms, centroid, n FROM narratives WHERE id=?').bind(into).first(); const b = await env.MIND_DB.prepare('SELECT id, terms, centroid, n FROM narratives WHERE id=?').bind(from).first();
          if (!a || !b) return jsonResp({ error: 'unknown_narrative' }, 404);
          const ta = pjs(a.terms, {}), tb = pjs(b.terms, {}); for (const k in tb) ta[k] = (ta[k] || 0) + tb[k];
          const va = b64f32(a.centroid), vb = b64f32(b.centroid);
          const merged = va && vb && va.length === vb.length ? va.map((x, i) => (x * (a.n || 1) + vb[i] * (b.n || 1)) / ((a.n || 1) + (b.n || 1))) : va || vb;
          await env.MIND_DB.batch([
            env.MIND_DB.prepare('UPDATE narrative_items SET narrative=? WHERE narrative=?').bind(into, from),
            env.MIND_DB.prepare('UPDATE narratives SET terms=?, centroid=?, dim=?, updated=? WHERE id=?').bind(JSON.stringify(Object.fromEntries(narrTopTerms(ta, 40).map(k => [k, Math.round(ta[k] * 1000) / 1000]))), merged ? f32b64(merged) : '', merged ? merged.length : 0, Date.now(), into),
            env.MIND_DB.prepare('DELETE FROM narratives WHERE id=?').bind(from),
            env.MIND_DB.prepare("UPDATE narratives SET counter='' WHERE counter=?").bind(from),
          ]);
          await narrRefresh(env, into, Date.now());
          return jsonResp({ ok: true, into, from, narrative: narrRow(await env.MIND_DB.prepare('SELECT * FROM narratives WHERE id=?').bind(into).first()) });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'narratives_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- Sentiment: who is talked about, how, where, on which channel; every number traces to rows --
    //    GET  /entities?kind=&q=&active=       the register with 7-day mention counts (read)
    //    GET  /entities/test?text=              which entities a text mentions (read)
    //    POST /entities/add|update|delete {id,...}   POST /entities/sync-mps   (full)
    //    GET  /sentiment/status                 classified, backlog, budget, model (read)
    //    GET  /sentiment/entities?days=&platform=&region=&issue=&kind=   the leaderboard with trend and platform mix (read)
    //    GET  /sentiment/series?entity=&days=&bucket=day|hour&platform=&region=   over time (read)
    //    GET  /sentiment/topics?days=&platform=&region=   tone by client issue with the entities inside (read)
    //    GET  /sentiment/items?entity=&stance=&issue=&platform=&region=&days=&limit=   the evidence rows (read)
    //    POST /sentiment/run {limit,hours,platform}   classify now, as a job the console tails (full)
    if (path.startsWith('/entities') || path.startsWith('/sentiment/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let nb = {}; if (req.method === 'POST') { try { nb = await req.json(); } catch (e) { nb = {}; } }
      try {
        await ensureArchive(env); await ensureSentiment(env);
        const qf = k => reqUrl.searchParams.get(k) || '';
        if (path === '/entities' && req.method === 'GET') {
          const list = await entitiesList(env, { kind: qf('kind'), q: qf('q'), active: qf('active') === '' ? null : qf('active') === '1' });
          const counts = {}; (((await env.MIND_DB.prepare('SELECT entity, COUNT(*) n, AVG(stance) score FROM sent_entities WHERE ts>? GROUP BY entity').bind(Date.now() - 7 * 86400000).all()).results) || []).forEach(r => { counts[r.entity] = { n: r.n, score: Math.round((Number(r.score) || 0) * 100) / 100 }; });
          return jsonResp({ ok: true, entities: list.map(e => Object.assign(e, { mentions7: (counts[e.id] || {}).n || 0, score7: (counts[e.id] || {}).score })), kinds: ENTITY_KINDS, sides: ENTITY_SIDES, total: list.length });
        }
        if (path === '/entities/test' && req.method === 'GET') {
          const text = String(qf('text') || '').slice(0, 5000);
          const m = await entityMatcher(env);
          return jsonResp({ ok: true, entities: m.match(text).map(id => ({ id, name: (m.byId[id] || {}).name || id, kind: (m.byId[id] || {}).kind || '' })), region: regionOf(text, {}, '') });
        }
        if (path === '/sentiment/status' && req.method === 'GET') return jsonResp(await sentimentStatus(env));
        if (path === '/sentiment/entities' && req.method === 'GET') return jsonResp(await sentimentEntities(env, { days: qf('days'), platform: qf('platform'), region: qf('region'), issue: qf('issue'), kind: qf('kind') }));
        if (path === '/sentiment/series' && req.method === 'GET') return jsonResp(await sentimentSeries(env, { entity: qf('entity'), days: qf('days'), bucket: qf('bucket'), platform: qf('platform'), region: qf('region'), issue: qf('issue') }));
        if (path === '/sentiment/topics' && req.method === 'GET') return jsonResp(await sentimentTopics(env, { days: qf('days'), platform: qf('platform'), region: qf('region') }));
        if (path === '/sentiment/items' && req.method === 'GET') return jsonResp(await sentimentItems(env, { entity: qf('entity'), stance: qf('stance'), issue: qf('issue'), platform: qf('platform'), region: qf('region'), days: qf('days'), limit: qf('limit') }));
        if (req.method !== 'POST') return jsonResp({ error: 'not_found' }, 404);
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Editing the register and running the classifier need a full-access key.' }, 403);
        if (path === '/entities/add') {
          const s = entitySanitize(nb, null);
          if (!s.id || !s.name) return jsonResp({ error: 'missing_name', detail: 'Give the entity a name.' }, 400);
          const had = await env.MIND_DB.prepare('SELECT id FROM entities WHERE id=?').bind(s.id).first();
          await entityUpsert(env, s, Date.now(), auth.name || 'operator');
          return jsonResp({ ok: true, added: !had, entity: entityRow(await env.MIND_DB.prepare('SELECT * FROM entities WHERE id=?').bind(s.id).first()) });
        }
        if (path === '/entities/update') {
          const id = entityIdClean(nb.id);
          const row = id ? await env.MIND_DB.prepare('SELECT * FROM entities WHERE id=?').bind(id).first() : null;
          if (!row) return jsonResp({ error: 'unknown_entity', detail: 'No entity with id ' + id + '.' }, 404);
          const s = entitySanitize(Object.assign({}, nb.patch && typeof nb.patch === 'object' ? nb.patch : nb, { id }), entityRow(row));
          await entityUpsert(env, s, Date.now(), row.source);
          return jsonResp({ ok: true, entity: entityRow(await env.MIND_DB.prepare('SELECT * FROM entities WHERE id=?').bind(id).first()) });
        }
        if (path === '/entities/delete') {
          const id = entityIdClean(nb.id);
          if (!id) return jsonResp({ error: 'missing_id' }, 400);
          await env.MIND_DB.prepare('DELETE FROM entities WHERE id=?').bind(id).run();
          ENTITY_CACHE = null;
          return jsonResp({ ok: true, deleted: id, note: 'Past verdicts for ' + id + ' stay in the sums until they age out.' });
        }
        if (path === '/entities/sync-mps') { const r = await entitiesSyncMps(env); return jsonResp(r, r.ok ? 200 : 400); }
        if (path === '/sentiment/run') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'not_configured', detail: 'Set ANTHROPIC_API_KEY on the worker: the classifier is Claude.' }, 501);
          const params = { limit: Math.min(Math.max(parseInt(nb.limit, 10) || SENT_PER_TICK, 1), 400), hours: parseInt(nb.hours, 10) || SENT_WINDOW_H, platform: String(nb.platform || '').slice(0, 20), where: 'worker' };
          const job = await jobCreate(env, 'sentiment', params, auth.name);
          ctx.waitUntil(jobRunLocal(env, { id: job.id, source: 'sentiment', params }));
          return jsonResp({ ok: true, job: job.id, id: job.id, where: 'worker', note: 'Classifying in the worker. Tail /bridge/job?id=' + job.id });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'sentiment_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- Social capture beyond Reddit and the clients' own pages --
    //    GET  /social/coverage?probe=1        every platform: method, keys, configured, what it reaches and cannot, counts, last run (read)
    //    GET  /social/petitions?issue=&juris=&days=   petitions with signatures and 24h / 7d growth (read)
    //    GET  /social/substack/search?q=      publications to add as sources (read)
    //    GET  /social/tiktok?url=             one TikTok post through oEmbed (read)
    //    GET  /social/youtube/transcript?v=   captions of one video, on demand (read; not filed)
    //    GET  /social/x/watch  POST /social/x/watch {handles:[{handle,ns,name}]}   the X accounts read beside the MP register
    //    POST /social/sweep {platform, params}   a worker-side sweep as a job the console tails (full)
    if (path.startsWith('/social/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let ob = {}; if (req.method === 'POST') { try { ob = await req.json(); } catch (e) { ob = {}; } }
      try {
        await ensureArchive(env);
        if (path === '/social/coverage' && req.method === 'GET') return jsonResp(await socialCoverage(env, reqUrl.searchParams.get('probe') === '1'));
        if (path === '/social/petitions' && req.method === 'GET') return jsonResp(await petitionsList(env, { issue: reqUrl.searchParams.get('issue') || '', juris: reqUrl.searchParams.get('juris') || '', days: reqUrl.searchParams.get('days') || 30 }));
        if (path === '/social/substack/search' && req.method === 'GET') {
          const q = String(reqUrl.searchParams.get('q') || '').trim().slice(0, 80);
          if (!q) return jsonResp({ error: 'missing_q', detail: 'Give q=, e.g. australian politics.' }, 400);
          return jsonResp(await substackSearch(q));
        }
        if (path === '/social/tiktok' && req.method === 'GET') return jsonResp(await tiktokOembed(String(reqUrl.searchParams.get('url') || '')));
        if (path === '/social/youtube/transcript' && req.method === 'GET') {
          const v = String(reqUrl.searchParams.get('v') || '').replace(/[^\w-]/g, '').slice(0, 20);
          if (!v) return jsonResp({ error: 'missing_video', detail: 'Give v=<video id>.' }, 400);
          const r = await ytTranscript(v);
          return jsonResp(Object.assign({ video: v }, r, { text: String(r.text || '').slice(0, 12000), chars: String(r.text || '').length }));
        }
        if (path === '/social/x/watch' && req.method === 'GET') {
          let mps = 0; try { mps = (await mpsList(env, { withX: true, limit: 600 })).length; } catch (e) { mps = 0; }
          return jsonResp({ ok: true, handles: await xWatchList(env), mps });
        }
        if (req.method !== 'POST') return jsonResp({ error: 'not_found' }, 404);
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Starting sweeps and editing the watch list need a full-access key.' }, 403);
        if (path === '/social/x/watch') {
          const list = (Array.isArray(ob.handles) ? ob.handles : []).slice(0, 200).map(w => (typeof w === 'string' ? { handle: w } : (w || {})));
          await kvPut(env.AXIOM_KV, 'x_watch', JSON.stringify(list), 365 * 86400);
          return jsonResp({ ok: true, handles: await xWatchList(env) });
        }
        if (path === '/social/sweep') {
          const platform = String(ob.platform || '').toLowerCase().replace(/[^a-z]/g, '');
          if (SOCIAL_PLATFORMS.indexOf(platform) < 0 && platform !== 'x') return jsonResp({ error: 'unknown_platform', detail: 'platform must be one of ' + SOCIAL_PLATFORMS.concat(['x']).join(', ') + '.' }, 400);
          const params = Object.assign({}, (ob.params && typeof ob.params === 'object') ? ob.params : {}, { where: 'worker' }, platform === 'x' ? { mode: 'timelines' } : {});
          const job = await jobCreate(env, platform, params, auth.name);
          ctx.waitUntil(jobRunLocal(env, { id: job.id, source: platform, params }));
          return jsonResp({ ok: true, job: job.id, id: job.id, platform, where: 'worker', note: 'Running in the worker. Tail /bridge/job?id=' + job.id });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'social_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- Full text: the article behind a headline, through every public route --
    //    GET  /fulltext?url=&save=1&light=1     (read) body text plus the attempt log; save=1 asks the Wayback Machine for a snapshot
    //    GET  /fulltext?id=<archive row>         (read) the same for an archive row; a full-access key also files the result on the row
    //    POST /fulltext/save {id|url, text, title?, method, link?, published?}   (full) a desktop collector writes back what it read
    if (path === '/fulltext' || path.startsWith('/fulltext/')) {
      if (path === '/fulltext/save') {
        if (req.method !== 'POST') return jsonResp({ error: 'post_required' }, 405);
        if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Filing text needs a full-access key.' }, 403);
        let fb = {}; try { fb = await req.json(); } catch (e) { fb = {}; }
        const sv = await fulltextSave(env, fb);
        return jsonResp(sv, sv.ok ? 200 : (sv.error === 'unknown_row' ? 404 : 400));
      }
      if (req.method !== 'GET') return jsonResp({ error: 'not_found' }, 404);
      let url = String(reqUrl.searchParams.get('url') || '').trim();
      const rowId = parseInt(reqUrl.searchParams.get('id') || '0', 10) || 0;
      let row = null;
      if (rowId) {
        if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound' }, 501);
        await ensureArchive(env);
        row = await env.MIND_DB.prepare('SELECT id,url,meta FROM arc_items WHERE id=?').bind(rowId).first();
        if (!row) return jsonResp({ error: 'unknown_row', detail: 'No archive row ' + rowId + '.' }, 404);
        url = row.url;
      }
      if (!/^https?:\/\//.test(url)) return jsonResp({ error: 'missing_url', detail: 'Give url=https://... or id=<archive row>.' }, 400);
      const ft = await fullText(env, url, { save: reqUrl.searchParams.get('save') === '1', light: reqUrl.searchParams.get('light') === '1', render: reqUrl.searchParams.get('light') !== '1' });
      if (row && ft.ok && (!auth.enforced || auth.role === 'full')) { const sv = await fulltextSave(env, { id: row.id, text: ft.text, title: ft.title, method: ft.method, link: ft.decoded, published: ft.published }); ft.filed = !!sv.ok; }
      ft.renderConfigured = renderConfigured(env);
      return jsonResp(ft);
    }

    // -- The Source Registry: every outlet, office, party, pollster, sector title and podcast, as data --
    //    GET  /sources?tier=&juris=&status=&issue=&q=      the table with health (read)
    //    GET  /sources/health?id=&limit=                   recent attempts, per source or all (read)
    //    GET  /sources/probe?id=                           run EVERY method live and report each (read; files nothing)
    //    GET  /sources/export                              the registry as JSON (read)
    //    POST /sources/add {id?,name,tier,juris,issues,urls:{rss,wp,json,sitemap,home,site,gnews,podcast},methods?,schedule?,note?}   (full)
    //    POST /sources/update {id, ...patch}  POST /sources/delete {id}  POST /sources/import {sources:[...]}   (full)
    //    POST /sources/sweep {ids?|all}                    a few ids run inline; more become a job the console tails (full)
    if (path === '/sources' || path.startsWith('/sources/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let sb = {}; if (req.method === 'POST') { try { sb = await req.json(); } catch (e) { sb = {}; } }
      try {
        await ensureArchive(env); await ensureSources(env);
        if (path === '/sources' && req.method === 'GET') {
          return jsonResp(await sourcesList(env, { tier: reqUrl.searchParams.get('tier') || '', juris: reqUrl.searchParams.get('juris') || '', status: reqUrl.searchParams.get('status') || '',
            issue: reqUrl.searchParams.get('issue') || '', q: reqUrl.searchParams.get('q') || '' }));
        }
        if (path === '/sources/health' && req.method === 'GET') {
          const id = sourceIdClean(reqUrl.searchParams.get('id'));
          const limit = Math.min(Math.max(parseInt(reqUrl.searchParams.get('limit') || '100', 10) || 100, 1), 500);
          const rows = id ? (await env.MIND_DB.prepare('SELECT id,src,ts,ok,method,n,ms,detail FROM source_health WHERE src=? ORDER BY id DESC LIMIT ?').bind(id, limit).all()).results
            : (await env.MIND_DB.prepare('SELECT id,src,ts,ok,method,n,ms,detail FROM source_health ORDER BY id DESC LIMIT ?').bind(limit).all()).results;
          const day = (await env.MIND_DB.prepare('SELECT COUNT(*) n, SUM(ok) ok FROM source_health WHERE ts>?' + (id ? ' AND src=?' : '')).bind(...(id ? [Date.now() - 86400000, id] : [Date.now() - 86400000])).first()) || {};
          return jsonResp({ ok: true, id, rows: rows || [], last24: { runs: day.n || 0, ok: day.ok || 0, failed: (day.n || 0) - (day.ok || 0) } });
        }
        if (path === '/sources/probe' && req.method === 'GET') {
          const id = sourceIdClean(reqUrl.searchParams.get('id'));
          const s = id ? await sourceGet(env, id) : null;
          if (!s) return jsonResp({ error: 'unknown_source', detail: 'No source with id ' + id + '.' }, 404);
          const run = await sourceRun(env, s, { all: true });
          try { await env.MIND_DB.batch(sourceStmts(env, run, 0, Date.now())); } catch (e) {}
          return jsonResp({ ok: true, id: s.id, name: s.name, methods: s.methods, best: run.method, delivering: run.tried.filter(t => t.ok).map(t => t.method), results: run.tried,
            items: run.ok ? (run.hit.rows || sourceRows(s, run.hit, Date.now())).length : 0, renderConfigured: renderConfigured(env) });
        }
        if (path === '/sources/export' && req.method === 'GET') {
          const rows = ((await env.MIND_DB.prepare('SELECT * FROM sources ORDER BY tier, name').all()).results || []).map(sourceRow);
          return jsonResp({ ok: true, exported: new Date().toISOString(), count: rows.length,
            sources: rows.map(s => ({ id: s.id, name: s.name, tier: s.tier, juris: s.juris, issues: s.issues, urls: s.urls, methods: s.methods, schedule: s.schedule, enabled: s.enabled, core: s.core, note: s.note, method_ok: s.method_ok })) });
        }
        if (req.method !== 'POST') return jsonResp({ error: 'not_found' }, 404);
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Changing the registry needs a full-access key.' }, 403);
        if (path === '/sources/add') {
          const s = sourceSanitize(sb, null);
          if (!s.id || !s.name) return jsonResp({ error: 'missing_name', detail: 'Give the source a name.' }, 400);
          if (!s.methods.length) return jsonResp({ error: 'missing_urls', detail: 'Give at least one way in: urls.rss, urls.wp, urls.json, urls.sitemap, urls.home, urls.site, urls.gnews or urls.podcast.' }, 400);
          const had = await sourceGet(env, s.id);
          if (had && had.core) return jsonResp({ error: 'core_source', detail: s.id + ' is a core feed; edit it with /sources/update.' }, 400);
          await sourceUpsert(env, s, Date.now());
          return jsonResp({ ok: true, added: !had, source: await sourceGet(env, s.id) });
        }
        if (path === '/sources/update') {
          const id = sourceIdClean(sb.id);
          const cur = id ? await sourceGet(env, id) : null;
          if (!cur) return jsonResp({ error: 'unknown_source', detail: 'No source with id ' + id + '.' }, 404);
          const patch = Object.assign({}, sb.patch && typeof sb.patch === 'object' ? sb.patch : sb, { id });
          if (cur.core) { delete patch.urls; delete patch.methods; }   // core feeds are fetched from AU_FEEDS; their urls are code
          const s = sourceSanitize(patch, cur);
          const now = Date.now();
          await env.MIND_DB.prepare("UPDATE sources SET name=?, tier=?, juris=?, issues=?, methods=?, urls=?, schedule=?, enabled=?, note=?, edited=1, updated=?, next_due=0, method_ok=CASE WHEN urls=? THEN method_ok ELSE '' END, fails=CASE WHEN urls=? THEN fails ELSE 0 END, alerted=CASE WHEN ?=1 THEN alerted ELSE 0 END WHERE id=?")
            .bind(s.name, s.tier, s.juris, JSON.stringify(s.issues), JSON.stringify(s.methods), JSON.stringify(s.urls), s.schedule, s.enabled ? 1 : 0, s.note, now, JSON.stringify(s.urls), JSON.stringify(s.urls), s.enabled ? 1 : 0, id).run();
          if (cur.core) await sourcesCoreOffRefresh(env);
          return jsonResp({ ok: true, source: await sourceGet(env, id) });
        }
        if (path === '/sources/delete') {
          const id = sourceIdClean(sb.id);
          const cur = id ? await sourceGet(env, id) : null;
          if (!cur) return jsonResp({ error: 'unknown_source' }, 404);
          if (cur.core) return jsonResp({ error: 'core_source', detail: 'Core feeds are switched off, not deleted: POST /sources/update {id, enabled:false}.' }, 400);
          await env.MIND_DB.batch([env.MIND_DB.prepare('DELETE FROM sources WHERE id=?').bind(id), env.MIND_DB.prepare('DELETE FROM source_health WHERE src=?').bind(id)]);
          return jsonResp({ ok: true, deleted: id });
        }
        if (path === '/sources/import') {
          const arr = (Array.isArray(sb.sources) ? sb.sources : (Array.isArray(sb) ? sb : [])).slice(0, 400);
          const out = { ok: true, added: 0, updated: 0, skipped: [] };
          const now = Date.now();
          for (const b of arr) {
            if (!b || typeof b !== 'object') { out.skipped.push({ reason: 'not an object' }); continue; }
            const cur = b.id ? await sourceGet(env, sourceIdClean(b.id)) : null;
            const s = sourceSanitize(b, cur);
            if (!s.id || !s.name) { out.skipped.push({ id: b.id || '', reason: 'no name' }); continue; }
            if (cur && cur.core) { out.skipped.push({ id: s.id, reason: 'core feed' }); continue; }
            if (!s.methods.length) { out.skipped.push({ id: s.id, reason: 'no urls' }); continue; }
            await sourceUpsert(env, s, now);
            if (cur) out.updated++; else out.added++;
          }
          return jsonResp(out);
        }
        if (path === '/sources/report') {
          // a desktop collector reports a probe it ran with a real browser
          const id = sourceIdClean(sb.id);
          const s = id ? await sourceGet(env, id) : null;
          if (!s) return jsonResp({ error: 'unknown_source' }, 404);
          const method = SOURCE_METHODS.indexOf(sb.method) >= 0 ? sb.method : 'render';
          const n = Math.max(0, parseInt(sb.n, 10) || 0);
          const run = { src: s, ok: !!sb.ok && n > 0, method, items: [], tried: [{ method, ok: !!sb.ok && n > 0, n, ms: parseInt(sb.ms, 10) || 0, status: 0, skipped: false, detail: String(sb.detail || '').slice(0, 160) }] };
          await env.MIND_DB.batch(sourceStmts(env, run, parseInt(sb.added, 10) || 0, Date.now()));
          return jsonResp({ ok: true, source: await sourceGet(env, id) });
        }
        if (path === '/sources/sweep') {
          const ids = (Array.isArray(sb.ids) ? sb.ids : (sb.id ? [sb.id] : [])).map(sourceIdClean).filter(Boolean);
          if (ids.length && ids.length <= 5) return jsonResp(await sourceSweep(env, { ids, detail: true }));
          const params = { ids, all: !!sb.all || !ids.length, where: 'worker' };
          const job = await jobCreate(env, 'sources', params, auth.name);
          ctx.waitUntil(jobRunLocal(env, { id: job.id, source: 'sources', params }));
          return jsonResp({ ok: true, job: job.id, note: 'Sweeping in the worker. Tail /bridge/job?id=' + job.id });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'sources_failed', detail: String((e && e.message) || e).slice(0, 200) }, 500); }
    }

    // -- The Content Desk: copy for each client and each platform, edited by instruction --
    //    GET  /content/platforms                          the platform specs (labels, limits, registers)
    //    GET  /content/set?id=   GET /content/list?ns=&limit=
    //    POST /content/generate {ns,campaign,segment,platforms[],brief,source:{kind:'text'|'release'|'topic',text,id},n,instructions}   (full) -> {id, job}
    //    POST /content/revise {id,n|null,instruction,remember:'auto'|'always'|'never'}   (full) edits by instruction; standing instructions become rules
    //    POST /content/update {id,n,patch}                  hand edits (full)
    //    POST /content/verdict {id,n,verdict,why}            approve / kill -> the Engine's outcomes (full)
    if (path.startsWith('/content/')) {
      if (path === '/content/platforms') return jsonResp({ ok: true, platforms: CONTENT_PLATFORMS });
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let cbody = {}; if (req.method === 'POST') { try { cbody = await req.json(); } catch (e) { cbody = {}; } }
      const cns = relNs(reqUrl.searchParams.get('ns') || cbody.ns);
      try {
        await ensureArchive(env); await ensureBridge(env); await ensureEngine(env); await ensureContent(env);
        if (path === '/content/set') {
          const id = String(reqUrl.searchParams.get('id') || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const set = await contentLoad(env, id);
          if (!set) return jsonResp({ error: 'unknown_set' }, 404);
          return jsonResp({ ok: true, set: contentView(set) });
        }
        if (path === '/content/list') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '20', 10) || 20, 100);
          const rows = (await env.MIND_DB.prepare('SELECT id,ns,campaign,segment,brief,platforms,items,status,who,created,updated FROM content_sets WHERE ns=? ORDER BY created DESC LIMIT ?').bind(cns, lim).all()).results || [];
          return jsonResp({ ok: true, ns: cns, sets: rows.map(r => { let it = [], pl = []; try { it = JSON.parse(r.items || '[]'); } catch (e) {} try { pl = JSON.parse(r.platforms || '[]'); } catch (e) {}
            return { id: r.id, campaign: r.campaign, segment: r.segment, brief: String(r.brief || '').slice(0, 140), platforms: pl, pieces: it.length, flagged: it.filter(x => x.check && !x.check.ok).length, approved: it.filter(x => x.verdict === 'approved').length, status: r.status, who: r.who, created: r.created, updated: r.updated }; }) });
        }
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Writing, revising and approving copy need a full-access key.' }, 403);
        if (path === '/content/generate' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          const platforms = []; (Array.isArray(cbody.platforms) ? cbody.platforms : [cbody.platforms]).forEach(p => { const v = contentPlatform(p); if (v && platforms.indexOf(v) < 0) platforms.push(v); });
          if (!platforms.length) return jsonResp({ error: 'missing_platforms', detail: 'Pick at least one platform: ' + Object.keys(CONTENT_PLATFORMS).join(', ') + '.' }, 400);
          if (platforms.length > 6) return jsonResp({ error: 'too_many_platforms', detail: 'Up to six platforms per set.' }, 400);
          const brief = String(cbody.brief || '').replace(/\r/g, '').trim().slice(0, 4000);
          let source = ''; const sk = cbody.source && typeof cbody.source === 'object' ? cbody.source : {};
          if (sk.kind === 'release' && sk.id) { const rp = await env.MIND_DB.prepare('SELECT source FROM release_packs WHERE id=?').bind(String(sk.id).replace(/[^a-z0-9]/gi, '').slice(0, 24)).first(); source = rp ? String(rp.source || '') : ''; if (!source) return jsonResp({ error: 'unknown_pack', detail: 'That release pack was not found.' }, 404); }
          else if (sk.kind === 'topic' && sk.id) { let tb = null; try { tb = JSON.parse(await kvGet(env.AXIOM_KV, 'topic_brief_' + String(sk.id).replace(/[^a-z0-9_-]/gi, '').slice(0, 40)) || 'null'); } catch (e) { tb = null; } if (!tb) return jsonResp({ error: 'unknown_topic', detail: 'No brief has been written for that topic yet.' }, 404); source = JSON.stringify(tb).slice(0, 16000); }
          else source = String(sk.text || cbody.source || '').replace(/\r/g, '').trim();
          source = source.slice(0, 16000);
          if (brief.length < 8 && source.length < 40) return jsonResp({ error: 'missing_brief', detail: 'Write a one-line brief or paste source material.' }, 400);
          const id = contentId();
          const job = await jobCreate(env, 'content', { setId: id, ns: cns, where: 'worker' }, auth.name);
          await env.MIND_DB.prepare('INSERT INTO content_sets(id,ns,campaign,segment,brief,source,platforms,items,status,job,who,history,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(id, cns, kitSlug(cbody.campaign), kitSlug(cbody.segment), brief, source, JSON.stringify(platforms), '[]', 'writing', job.id, auth.name || '', '[]', Date.now(), Date.now()).run();
          ctx.waitUntil(contentBuild(env, id, { job: job.id, n: cbody.n, instructions: cbody.instructions }));
          return jsonResp({ ok: true, id, job: job.id, ns: cns, platforms });
        }
        if (path === '/content/revise' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          const id = String(cbody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const r = await contentRevise(env, id, cbody, auth.name);
          return jsonResp(r, r.ok ? 200 : (r.status || 500));
        }
        if (path === '/content/update' && req.method === 'POST') {
          const id = String(cbody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const r = await contentUpdate(env, id, Math.max(0, parseInt(cbody.n, 10) || 0), cbody.patch);
          return jsonResp(r, r.ok ? 200 : (r.status || 500));
        }
        if (path === '/content/verdict' && req.method === 'POST') {
          const id = String(cbody.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
          const r = await contentVerdict(env, id, Math.max(0, parseInt(cbody.n, 10) || 0), cbody.verdict, cbody.why, auth.name);
          return jsonResp(r, r.ok ? 200 : (r.status || 500));
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) {
        const m = String((e && e.message) || e);
        if (/mind_not_configured/.test(m)) return jsonResp({ ok: false, error: 'mind_not_configured', detail: m.slice(0, 200) }, 501);
        return jsonResp({ ok: false, error: 'content_failed', detail: m.slice(0, 200) }, /needs what|missing|too/.test(m) ? 400 : 500);
      }
    }

    // -- Signals: what LinkedIn, Meta, X and Reddit are saying, one shape ------
    //    GET  /signals/threads?platform=&days=&issue=&q=&limit=
    //    GET  /signals/comments?thread=&platform=
    //    GET  /signals/status                   counts and tone per platform
    //    POST /signals/analyse {platform,threads|days,ns}   Claude reads them (full role)
    //    POST /signals/mind {platform,threads,ns,title}     file a digest in the Mind (full role)
    // ==========================================================================
    // TOPICS - keyword research for SIFA and for us
    //    GET  /topics                        the keyword list and status (read)
    //    GET  /topics/results?id=&days=      everything on file for a topic (read)
    //    GET  /topics/probe                  what SIFA answers right now (full)
    //    POST /topics/sync                   pull SIFA's list into the table (full)
    //    POST /topics/add {keyword,topic,ns} | /topics/update {id,active,ns,topic} | /topics/delete {id}
    //    POST /topics/run {id|keyword,ns,hours,mps}   start a research job (full)
    //    GET  /mps?q=&house=&x=1             the MP register (read); POST /mps/sync rebuilds it from Wikidata
    // SIFA's side, gated by its own bearer key (SIFA_INBOUND_KEY), never the AXIOM key:
    //    POST /sifa/keywords {keywords:[...]}   push keywords in
    //    GET  /sifa/topics                      the list with run status
    //    GET  /sifa/results?keyword=&days=      results and the brief
    //    POST /sifa/run {keyword,client,hours}  ask for a fresh run
    if (path.startsWith('/sifa/')) {
      const g = sifaInbound(req, env);
      if (!g.ok) return jsonResp({ error: g.error, detail: g.detail }, g.status);
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let b = {}; if (req.method === 'POST') { try { b = await req.json(); } catch (e) { b = {}; } }
      if (path === '/sifa/keywords' && req.method === 'POST') {
        const list = topicNormalize(b.keywords || b.data || b.items || b);
        if (!list.length) return jsonResp({ ok: false, error: 'no_keywords', detail: 'Send {"keywords":[{"keyword":"critical minerals","topic":"resources","client":"mca"}, ...]} or a plain array of strings.' }, 400);
        const r = await topicsUpsert(env, list, 'sifa-push');
        return jsonResp({ ok: true, received: list.length, added: r.added, updated: r.updated, active: r.total, keywords: list.map(k => ({ id: k.id, keyword: k.keyword, topic: k.topic, client: k.ns })) });
      }
      if (path === '/sifa/topics') {
        const list = await topicsList(env);
        return jsonResp({ ok: true, topics: list.map(t => ({ id: t.id, keyword: t.keyword, topic: t.topic, client: t.ns, active: !!t.active, lastRun: t.last_run || 0, hits: t.hits || 0, results: '/sifa/results?keyword=' + encodeURIComponent(t.keyword) })) });
      }
      if (path === '/sifa/results') {
        const kw = String(reqUrl.searchParams.get('keyword') || reqUrl.searchParams.get('id') || '').slice(0, 120);
        if (!kw) return jsonResp({ error: 'missing_keyword' }, 400);
        const r = await topicResults(env, kw, reqUrl.searchParams.get('days') || 30);
        if (!r) return jsonResp({ error: 'unknown_topic' }, 404);
        return jsonResp(r);
      }
      if (path === '/sifa/run' && req.method === 'POST') {
        const kw = String(b.keyword || b.id || '').slice(0, 120);
        if (!kw) return jsonResp({ error: 'missing_keyword' }, 400);
        const params = { keyword: kw, ns: String(b.client || b.ns || '').slice(0, 24), hours: parseInt(b.hours, 10) || 168 };
        const job = await jobCreate(env, 'topic', params, 'sifa');
        if (job.local) ctx.waitUntil(jobRunLocal(env, { id: job.id, source: 'topic', params }));
        return jsonResp({ ok: true, job: job.id, keyword: kw, poll: '/sifa/results?keyword=' + encodeURIComponent(kw) });
      }
      return jsonResp({ error: 'not_found' }, 404);
    }
    if (path.startsWith('/topics') || path.startsWith('/mps')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let tb = {}; if (req.method === 'POST') { try { tb = await req.json(); } catch (e) { tb = {}; } }
      await ensureTopics(env);
      if (path === '/topics' && req.method === 'GET') {
        const list = await topicsList(env);
        let sync = null; try { sync = JSON.parse((await kvGet(env.AXIOM_KV, 'topics_sync_result')) || 'null'); } catch (e) { sync = null; }
        const mpc = (await env.MIND_DB.prepare("SELECT COUNT(*) n, SUM(x<>'') withX FROM mps").first()) || {};
        return jsonResp({ ok: true, topics: list,
          sifa: { configured: !!env.SIFA_TOKEN, inbound: !!env.SIFA_INBOUND_KEY, url: env.SIFA_URL || SIFA_URL_DEFAULT, last: sync },
          mps: { total: mpc.n || 0, withX: mpc.withX || 0, synced: Number((await kvGet(env.AXIOM_KV, 'mps_synced')) || 0) },
          hansard: !!env.OPENAUSTRALIA_KEY, agents: await agentsSeen(env) });
      }
      if (path === '/topics/results') {
        const id = String(reqUrl.searchParams.get('id') || reqUrl.searchParams.get('keyword') || '').slice(0, 120);
        if (!id) return jsonResp({ error: 'missing_id' }, 400);
        const r = await topicResults(env, id, reqUrl.searchParams.get('days') || 30);
        if (!r) return jsonResp({ error: 'unknown_topic' }, 404);
        return jsonResp(r);
      }
      if (path === '/mps' && req.method === 'GET') {
        const list = await mpsList(env, { q: reqUrl.searchParams.get('q') || '', house: reqUrl.searchParams.get('house') || '', withX: reqUrl.searchParams.get('x') === '1', limit: reqUrl.searchParams.get('limit') || 400 });
        return jsonResp({ ok: true, mps: list, total: list.length, synced: Number((await kvGet(env.AXIOM_KV, 'mps_synced')) || 0) });
      }
      if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Syncing, adding and running topics need a full-access key.' }, 403);
      if (path === '/topics/probe') { const r = await sifaPull(env); return jsonResp(r, r.ok ? 200 : (r.error === 'sifa_not_configured' ? 501 : 502)); }
      if (path === '/topics/sync' && req.method === 'POST') {
        const r = await sifaPull(env);
        if (!r.ok) return jsonResp(r, r.error === 'sifa_not_configured' ? 501 : 502);
        const up = await topicsUpsert(env, r.keywords, 'sifa');
        await kvPut(env.AXIOM_KV, 'topics_synced', String(Date.now()), 86400);
        await kvPut(env.AXIOM_KV, 'topics_sync_result', JSON.stringify({ at: Date.now(), ok: true, n: r.keywords.length, added: up.added, updated: up.updated }), 7 * 86400);
        return jsonResp({ ok: true, received: r.keywords.length, added: up.added, updated: up.updated, active: up.total, url: r.url });
      }
      if (path === '/topics/add' && req.method === 'POST') {
        const list = topicNormalize([{ keyword: tb.keyword, topic: tb.topic, client: tb.ns || tb.client }]);
        if (!list.length) return jsonResp({ error: 'missing_keyword', detail: 'Give a keyword.' }, 400);
        const up = await topicsUpsert(env, list, 'manual');
        return jsonResp({ ok: true, topic: await topicGet(env, list[0].id), added: up.added, updated: up.updated });
      }
      if (path === '/topics/update' && req.method === 'POST') {
        const t = await topicGet(env, tb.id); if (!t) return jsonResp({ error: 'unknown_topic' }, 404);
        await env.MIND_DB.prepare("UPDATE topics SET active=?, ns=COALESCE(NULLIF(?,''),ns), topic=COALESCE(NULLIF(?,''),topic), updated=? WHERE id=?")
          .bind(tb.active === undefined ? t.active : (tb.active ? 1 : 0), String(tb.ns || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24), String(tb.topic || '').slice(0, 80), Date.now(), t.id).run();
        return jsonResp({ ok: true, topic: await topicGet(env, t.id) });
      }
      if (path === '/topics/delete' && req.method === 'POST') {
        const t = await topicGet(env, tb.id); if (!t) return jsonResp({ error: 'unknown_topic' }, 404);
        await env.MIND_DB.prepare('DELETE FROM topics WHERE id=?').bind(t.id).run();
        return jsonResp({ ok: true, deleted: t.id });
      }
      if (path === '/topics/run' && req.method === 'POST') {
        const params = { id: String(tb.id || '').slice(0, 60), keyword: String(tb.keyword || '').slice(0, 120), ns: String(tb.ns || '').slice(0, 24), hours: parseInt(tb.hours, 10) || 168, mps: tb.mps !== false };
        if (!params.id && !params.keyword) return jsonResp({ error: 'missing_keyword', detail: 'Give a topic id or a keyword.' }, 400);
        const job = await jobCreate(env, 'topic', params, auth.name);
        if (job.local) ctx.waitUntil(jobRunLocal(env, { id: job.id, source: 'topic', params }));
        return jsonResp({ ok: true, id: job.id, where: job.local ? 'worker' : 'desktop' });
      }
      if (path === '/mps/sync' && req.method === 'POST') { const r = await mpsSync(env); return jsonResp(r, r.ok ? 200 : 502); }
      return jsonResp({ error: 'not_found' }, 404);
    }
    if (path.startsWith('/signals/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      let sbody = {}; if (req.method === 'POST') { try { sbody = await req.json(); } catch (e) { sbody = {}; } }
      const db = env.MIND_DB;
      const pj = s2 => { if (Array.isArray(s2)) return s2; try { const v = JSON.parse(s2); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
      let plat = String(reqUrl.searchParams.get('platform') || sbody.platform || '').toLowerCase().replace(/[^a-z]/g, '');
      if (plat === 'all') plat = '';   // 'all' means every signal platform, not a platform called all
      const isReddit = plat === 'reddit';
      const tKind = isReddit ? 'reddit_thread' : 'sig_thread';
      const cKind = isReddit ? 'reddit_comment' : 'sig_comment';
      const days = Math.min(parseInt(reqUrl.searchParams.get('days') || sbody.days || '14', 10) || 14, 365);
      const since = Date.now() - days * 86400000;
      const issue = String(reqUrl.searchParams.get('issue') || sbody.issue || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 24);
      const qs = String(reqUrl.searchParams.get('q') || sbody.q || '').slice(0, 120);
      // reddit rows carry meta.sub, the others meta.page/page_name: one column either way
      const chan = isReddit ? "json_extract(meta,'$.sub')" : "COALESCE(json_extract(meta,'$.page_name'), json_extract(meta,'$.page'))";
      const platCol = isReddit ? "'reddit'" : "json_extract(meta,'$.platform')";
      try {
        await ensureArchive(env);
        const threadRows = async (ids) => {
          if (!ids.length) return [];
          const ph = ids.map(() => '?').join(',');
          return (await db.prepare("SELECT title, body, url, ts, COALESCE(tone,0) tone, " + chan + " channel, " + platCol + " platform, json_extract(meta,'$.id') id, json_extract(meta,'$.score') score, json_extract(meta,'$.comments') comments, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='" + tKind + "' AND json_extract(meta,'$.id') IN (" + ph + ')').bind(...ids).all()).results || [];
        };
        const commentRows = async (id, lim) => (await db.prepare("SELECT body, COALESCE(tone,0) tone, ts, json_extract(meta,'$.score') score, json_extract(meta,'$.issues') issues FROM arc_items WHERE kind='" + cKind + "' AND json_extract(meta,'$.thread')=? ORDER BY COALESCE(json_extract(meta,'$.score'),0) DESC LIMIT ?").bind(id, lim || 200).all()).results || [];
        if (path === '/signals/status') {
          const rows = (await db.prepare("SELECT json_extract(meta,'$.platform') platform, COUNT(*) n, MAX(ts) newest FROM arc_items WHERE kind='sig_thread' GROUP BY platform").all()).results || [];
          const cs = (await db.prepare("SELECT json_extract(meta,'$.platform') platform, COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind='sig_comment' GROUP BY platform").all()).results || [];
          const rd = (await db.batch([
            db.prepare("SELECT COUNT(*) n, MAX(ts) newest FROM arc_items WHERE kind='reddit_thread'"),
            db.prepare("SELECT COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind='reddit_comment'"),
          ]));
          const byPlatform = {};
          rows.forEach(r => { byPlatform[r.platform || 'unknown'] = { threads: r.n || 0, newest: r.newest || 0, comments: 0, hostile: 0, supportive: 0 }; });
          cs.forEach(c => { const k = c.platform || 'unknown'; byPlatform[k] = byPlatform[k] || { threads: 0, newest: 0 }; byPlatform[k].comments = c.n || 0; byPlatform[k].hostile = c.hostile || 0; byPlatform[k].supportive = c.supportive || 0; });
          const r0 = (rd[0].results || [])[0] || {}, r1 = (rd[1].results || [])[0] || {};
          byPlatform.reddit = { threads: r0.n || 0, newest: r0.newest || 0, comments: r1.n || 0, hostile: r1.hostile || 0, supportive: r1.supportive || 0 };
          return jsonResp({ ok: true, byPlatform, configured: {
            linkedin: { ready: !!(env.LINKEDIN_TOKEN && liOrgs(env).length), orgs: liOrgs(env).length,
              detail: env.LINKEDIN_TOKEN ? (liOrgs(env).length ? '' : 'Set LINKEDIN_ORGS, e.g. "urn:li:organization:123:mca".') : 'Set the worker secret LINKEDIN_TOKEN (r_organization_social on the pages you administer) and the var LINKEDIN_ORGS.' },
            meta: { ready: !!(env.META_TOKEN && metaPages(env).length), pages: metaPages(env).length,
              detail: env.META_TOKEN ? (metaPages(env).length ? '' : 'Set the var META_PAGES, e.g. "123456:mca,789012:aep".') : 'Set META_TOKEN with pages_read_engagement and pages_read_user_content.' },
            x: { ready: true, desktopOnly: true, detail: 'X is collected from a logged-in desktop: install twitter-cli, then run python3 tools/reach-agent.py --key $AXIOM_KEY on that machine.' },
            reddit: { ready: true, desktopOnly: false, detail: redditAuthed(env) ? '' : 'The worker reads Reddit anonymously and is often refused; the desktop collector is the reliable path.' },
          }, agents: await agentsSeen(env) });
        }
        // Candidates in the window, then relevance in JS. Reddit rows from the
        // keyword pass can be American or British threads found by a generic
        // term; here they are noise, hidden unless asked for. The other
        // platforms are our clients' own pages, so everything is relevant.
        const relevant = r => !isReddit || auRelevant(r.channel, (r.channel || '') + ' ' + (r.title || '') + ' ' + (r.body || ''), r.q || '');
        const candidates = async (extraW, extraB, lim) => {
          const w = ["kind='" + tKind + "'", 'ts>?'].concat(extraW || []); const b = [since].concat(extraB || []);
          if (!isReddit && plat) { w.push("json_extract(meta,'$.platform')=?"); b.push(plat); }
          if (issue) { w.push('meta LIKE ?'); b.push('%"' + issue + '"%'); }
          return (await db.prepare("SELECT title, body, url, ts, COALESCE(tone,0) tone, " + chan + " channel, " + platCol + " platform, json_extract(meta,'$.id') id, json_extract(meta,'$.score') score, json_extract(meta,'$.comments') comments, json_extract(meta,'$.q') q, json_extract(meta,'$.issues') issues FROM arc_items WHERE " + w.join(' AND ') + ' ORDER BY ts DESC LIMIT ' + lim).bind(...b).all()).results || [];
        };
        // comment tone held per thread, in chunks D1 accepts
        const heldFor = async (ids) => {
          const held = {};
          for (let i = 0; i < ids.length; i += 90) {
            const part = ids.slice(i, i + 90); const ph = part.map(() => '?').join(',');
            ((await db.prepare("SELECT json_extract(meta,'$.thread') t, COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive FROM arc_items WHERE kind='" + cKind + "' AND json_extract(meta,'$.thread') IN (" + ph + ') GROUP BY t').bind(...part).all()).results || []).forEach(x => { held[x.t] = { n: x.n || 0, hostile: x.hostile || 0, supportive: x.supportive || 0 }; });
          }
          return held;
        };
        if (path === '/signals/threads') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '60', 10) || 60, 200);
          const sort = reqUrl.searchParams.get('sort') === 'new' ? 'new' : 'relevance';
          const showAll = reqUrl.searchParams.get('all') === '1';
          const extraW = [], extraB = [];
          // one channel filter for all four: a subreddit on Reddit, a page elsewhere
          const chq = String(reqUrl.searchParams.get('channel') || '').slice(0, 80);
          if (chq) { extraW.push('LOWER(' + chan + ')=?'); extraB.push(chq.toLowerCase()); }
          if (qs) { extraW.push("(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"); const l = arcLike(qs); extraB.push(l, l); }
          const pool = await candidates(extraW, extraB, Math.max(lim * 5, 400));
          const held = await heldFor(pool.map(r => r.id).filter(Boolean));
          let rows = pool.map(r => Object.assign(r, { issuesArr: pj(r.issues), held: held[r.id] || null, rel: relevant(r) }));
          const noise = rows.filter(r => !r.rel).length;
          if (!showAll) rows = rows.filter(r => r.rel);
          if (sort === 'relevance') {
            // what the client is argued about first: issue breadth, then the
            // comments we hold, then how busy the thread is; ties by recency
            const watched = r => isReddit && REDDIT_POLITICS.some(w => w.toLowerCase() === String(r.channel || '').toLowerCase());
            const wt = r => (watched(r) ? 1500 : 0) + r.issuesArr.length * 1000 + (r.held ? r.held.n * 20 : 0) + Math.min(Number(r.comments) || 0, 500) + (r.rel ? 0 : -5000);
            rows.sort((a, b) => (wt(b) - wt(a)) || ((b.ts || 0) - (a.ts || 0)));
          }
          rows = rows.slice(0, lim);
          // the channels in scope, from the relevant set, so a noise sub never shows
          const chanPool = (chq || qs) ? await candidates([], [], 400) : pool;
          const cm = {}; chanPool.filter(relevant).forEach(r => { if (r.channel) cm[r.channel] = (cm[r.channel] || 0) + 1; });
          const chans = Object.keys(cm).map(c => ({ channel: c, n: cm[c] })).sort((a, b) => b.n - a.n).slice(0, 20);
          const have = (await db.prepare("SELECT COUNT(*) total, MAX(ts) newest FROM arc_items WHERE kind='" + tKind + "'" + (!isReddit && plat ? " AND json_extract(meta,'$.platform')='" + plat + "'" : '')).first()) || { total: 0 };
          return jsonResp({ ok: true, platform: plat || 'all', days, issue, q: qs, sort, all: showAll, noise, channels: chans,
            threads: rows.map(r => ({ title: r.title, url: r.url, ts: r.ts, tone: r.tone, channel: r.channel || '', platform: r.platform || plat, id: r.id, score: r.score, comments: r.comments, q: r.q || '', issues: r.issuesArr, relevant: r.rel, excerpt: String(r.body || '').split('\n')[0].slice(0, 500), held: r.held })),
            have });
        }
        if (path === '/signals/comments') {
          const tid = String(reqUrl.searchParams.get('thread') || '').slice(0, 60);
          if (!tid) return jsonResp({ error: 'missing_thread' }, 400);
          const rows = await commentRows(tid, 200);
          return jsonResp({ ok: true, thread: tid, platform: plat, comments: rows.map(r => ({ body: r.body, tone: r.tone, ts: r.ts, score: r.score, issues: pj(r.issues) })) });
        }
        if (auth.enforced && auth.role !== 'full') return jsonResp({ error: 'read_only', detail: 'Analysis and filing need a full-access key.' }, 403);
        // POST /signals/prune {platform:'reddit'} - delete the off-topic threads
        // the keyword pass filed before the Australian gate, and their comments.
        // Reddit only: the other platforms are the clients' own pages.
        if (path === '/signals/prune' && req.method === 'POST') {
          if (!isReddit) return jsonResp({ error: 'reddit_only', detail: 'Only the Reddit keyword pass collects off-topic threads; the other platforms read our own pages.' }, 400);
          const out = { ok: true, platform: 'reddit', scanned: 0, removedThreads: 0, removedComments: 0, more: false };
          const urls = [], tids = [];
          for (let off = 0; off < 10000; off += 500) {
            const page = (await db.prepare("SELECT url, title, body, json_extract(meta,'$.sub') sub, json_extract(meta,'$.id') tid, json_extract(meta,'$.q') q FROM arc_items WHERE kind='reddit_thread' ORDER BY ts DESC LIMIT 500 OFFSET ?").bind(off).all()).results || [];
            out.scanned += page.length;
            page.forEach(r => { if (!auRelevant(r.sub, (r.sub || '') + ' ' + (r.title || '') + ' ' + (r.body || ''), r.q || '')) { urls.push(r.url); if (r.tid) tids.push(r.tid); } });
            if (page.length < 500) break;
            if (off + 500 >= 10000) out.more = true;
          }
          const changes = r => (r && r.meta && typeof r.meta.changes === 'number') ? r.meta.changes : null;
          for (let i = 0; i < urls.length; i += 90) {
            const part = urls.slice(i, i + 90);
            const r = await db.prepare("DELETE FROM arc_items WHERE kind='reddit_thread' AND url IN (" + part.map(() => '?').join(',') + ')').bind(...part).run();
            out.removedThreads += changes(r) === null ? part.length : changes(r);
          }
          for (let i = 0; i < tids.length; i += 90) {
            const part = tids.slice(i, i + 90);
            const r = await db.prepare("DELETE FROM arc_items WHERE kind='reddit_comment' AND json_extract(meta,'$.thread') IN (" + part.map(() => '?').join(',') + ')').bind(...part).run();
            out.removedComments += changes(r) || 0;
          }
          return jsonResp(out);
        }
        if (path === '/signals/analyse' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          const ns = String(sbody.ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm';
          let ids = Array.isArray(sbody.threads) ? sbody.threads.map(x => String(x).slice(0, 60)).filter(Boolean).slice(0, 12) : [];
          if (!ids.length) {
            // the busiest relevant threads in scope: never an off-topic keyword hit
            const pool = await candidates([], [], 300);
            ids = pool.filter(relevant).sort((a, b) => (Number(b.comments) || 0) - (Number(a.comments) || 0)).slice(0, 12).map(r => r.id).filter(Boolean);
          }
          const threads = await threadRows(ids);
          if (!threads.length) return jsonResp({ ok: false, error: 'no_threads', detail: 'Nothing on file for that scope. Sweep first.' }, 404);
          let corpus = ''; let nC = 0;
          for (const t of threads) {
            const cs = await commentRows(t.id, 25); nC += cs.length;
            corpus += '\n## [' + (t.platform || plat) + (t.channel ? ' / ' + t.channel : '') + '] ' + String(t.title).slice(0, 200) + ' (' + (t.score || 0) + ' reactions, ' + (t.comments || 0) + ' comments)\n' + String(t.body || '').split('\n')[0].slice(0, 500) + '\n'
              + cs.map(c => '- [' + (c.tone < 0 ? 'hostile' : c.tone > 0 ? 'supportive' : 'neutral') + ', ' + (c.score || 0) + '] ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 320)).join('\n') + '\n';
          }
          const client = (CLIENT_ISSUES.find(ci => ci.ns === ns) || {}).client || 'Curious Minds';
          const where = plat === 'linkedin' ? 'LinkedIn, where the audience is professional, named and often industry-adjacent, so hostility is rarer and more consequential'
            : plat === 'meta' ? 'Facebook and Instagram, where the audience is the general public and comments are emotive and fast'
            : plat === 'x' ? 'X, where political argument is fastest and most adversarial and where journalists watch'
            : 'Reddit, which skews young and progressive and runs ahead of mainstream comment sections';
          const sys = 'You are a senior Australian political communications analyst working for ' + client + '. You are reading public posts and comments from ' + where + '. This is internal agency analysis: read it as an early-warning channel for the arguments that will reach the wider public, not as a poll. Never invent quotes. Return strict JSON only, no prose outside it: {"summary":"two or three sentences","themes":[{"theme":"","stance":"hostile|supportive|mixed|neutral","share":"approx %","quotes":["verbatim comment"],"read":"what it means for us"}],"attackLines":["the arguments used against our client, in the words used"],"supportLines":["arguments made in our favour"],"risks":["what could cross into mainstream media"],"openings":["where a well-placed fact or line would land"],"replies":[{"to":"theme","line":"a ready reply in plain Australian English, no jargon"}]}';
          const txt = await claudeMsg(env, sys, 'Posts and comments:\n' + corpus.slice(0, 60000), 2600, 75000);
          const s2 = typeof txt === 'string' ? txt : (txt && (txt.text || JSON.stringify(txt))) || '';
          let a = null; try { a = JSON.parse((s2.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch (e) { a = null; }
          if (!a) return jsonResp({ ok: false, error: 'analysis_unparseable', detail: s2.slice(0, 200) }, 502);
          try { await db.prepare('CREATE TABLE IF NOT EXISTS mind_runs(id INTEGER PRIMARY KEY AUTOINCREMENT, ns TEXT, mode TEXT, q TEXT, created INTEGER)').run(); await db.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, 'signals_' + (plat || 'all'), threads.length + ' threads / ' + nC + ' comments', Date.now()).run(); } catch (e) {}
          return jsonResp({ ok: true, ns, platform: plat || 'all', threads: threads.length, comments: nC, analysis: a });
        }
        if (path === '/signals/mind' && req.method === 'POST') {
          const ns = String(sbody.ns || 'cmm').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24) || 'cmm';
          const ids = (Array.isArray(sbody.threads) ? sbody.threads : []).map(x => String(x).slice(0, 60)).filter(Boolean).slice(0, 25);
          if (!ids.length) return jsonResp({ error: 'missing_threads', detail: 'Pick at least one post.' }, 400);
          const threads = await threadRows(ids);
          if (!threads.length) return jsonResp({ ok: false, error: 'no_threads', detail: 'None of those posts are on file.' }, 404);
          const day = new Date().toISOString().slice(0, 10);
          let text = '# ' + (plat ? plat.toUpperCase() : 'Social') + ' signal - ' + day + '\n\nSource: public posts and comments via AXIOM. Comment authors are not recorded.\n';
          let nC = 0; const chans = new Set();
          for (const t of threads) {
            if (t.channel) chans.add(t.channel);
            const cs = await commentRows(t.id, 30); nC += cs.length;
            text += '\n## ' + String(t.title).slice(0, 200) + '\n' + (t.platform || plat) + (t.channel ? ' / ' + t.channel : '') + ' - ' + (t.score || 0) + ' reactions, ' + (t.comments || 0) + ' comments - ' + t.url + '\nIssues: ' + (pj(t.issues).join(', ') || 'none tagged') + '\n' + String(t.body || '').split('\n')[0].slice(0, 800) + '\n\n### Top comments\n'
              + cs.map(c => '- (' + (c.tone < 0 ? 'hostile' : c.tone > 0 ? 'supportive' : 'neutral') + ', ' + (c.score || 0) + ') ' + String(c.body || '').replace(/\s+/g, ' ').slice(0, 600)).join('\n') + '\n';
          }
          const title = String(sbody.title || ((plat ? plat.toUpperCase() : 'Social') + ' signal ' + day + (chans.size ? ' - ' + [...chans].join(', ') : ''))).slice(0, 200);
          const r = await mindIngestDoc(env, { ns, title, text, kind: 'signal', source: (plat || 'social') + ':' + [...chans].join(','), date: day });
          try { await db.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ns, 'signals_ingest', threads.length + ' threads / ' + nC + ' comments', Date.now()).run(); } catch (e) {}
          return jsonResp({ ok: true, ns, platform: plat || 'all', docId: r.docId, chunks: r.chunks, threads: threads.length, comments: nC, title });
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) {
        const m = String((e && e.message) || e);
        if (/mind_not_configured/.test(m)) return jsonResp({ ok: false, error: 'mind_not_configured', detail: m.slice(0, 200) }, 501);
        return jsonResp({ ok: false, error: 'signals_failed', detail: m.slice(0, 200) }, 500);
      }
    }

    if (path.startsWith('/perf/')) {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Bind the D1 database as MIND_DB.' }, 501);
      const pns = (reqUrl.searchParams.get('ns') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
      const pdays = Math.min(parseInt(reqUrl.searchParams.get('days') || '90', 10) || 90, 730);
      const psince = Date.now() - pdays * 86400000;
      const nsW = pns ? " AND json_extract(meta,'$.ns')=?" : '';
      const nsB = pns ? [pns] : [];
      const M = (k) => "SUM(COALESCE(json_extract(meta,'$." + k + "'),0))";
      try {
        await ensureArchive(env);
        const db = env.MIND_DB;
        // `have` tells the UI what the archive holds for this kind regardless of
        // scope, so an empty panel can say "0 rows loaded" vs "none in range".
        const HAVE = (k) => db.prepare("SELECT COUNT(*) total, MIN(ts) oldest, MAX(ts) newest, COUNT(DISTINCT json_extract(meta,'$.ns')) clients FROM arc_items WHERE kind='" + k + "'");
        const have = (x) => Object.assign({ total: 0 }, ((x && x.results) || [])[0] || {});
        if (path === '/perf/ads') {
          const base = "FROM arc_items WHERE kind='campaign' AND ts>?" + nsW;
          const r = await db.batch([
            db.prepare('SELECT src platform, COUNT(*) days, ' + M('spend') + ' spend, ' + M('impressions') + ' impressions, ' + M('clicks') + ' clicks, ' + M('leads') + ' leads ' + base + ' GROUP BY src ORDER BY spend DESC').bind(psince, ...nsB),
            db.prepare("SELECT json_extract(meta,'$.day') d, " + M('spend') + ' spend, ' + M('impressions') + ' impressions, ' + M('leads') + ' leads, ' + M('clicks') + ' clicks ' + base + ' GROUP BY d ORDER BY d').bind(psince, ...nsB),
            db.prepare("SELECT json_extract(meta,'$.ns') ns, " + M('spend') + ' spend, ' + M('leads') + ' leads, ' + M('impressions') + ' impressions ' + base + ' GROUP BY ns ORDER BY spend DESC').bind(psince, ...nsB),
            db.prepare("SELECT json_extract(meta,'$.campaign') campaign, src platform, json_extract(meta,'$.ns') ns, COUNT(*) days, " + M('spend') + ' spend, ' + M('impressions') + ' impressions, ' + M('clicks') + ' clicks, ' + M('leads') + ' leads, MAX(ts) last ' + base + ' GROUP BY campaign, src ORDER BY spend DESC LIMIT 20').bind(psince, ...nsB),
            HAVE('campaign'),
          ]);
          return jsonResp({ ok: true, ns: pns, days: pdays, byPlatform: r[0].results || [], byDay: r[1].results || [], byClient: r[2].results || [], topCampaigns: r[3].results || [], have: have(r[4]) });
        }
        if (path === '/perf/social') {
          const eb = "FROM arc_items WHERE kind='engagement' AND ts>?" + nsW;
          const r = await db.batch([
            db.prepare("SELECT json_extract(meta,'$.day') d, " + M('reactions') + ' reactions, ' + M('comments') + ' comments, ' + M('shares') + ' shares, ' + M('saves') + ' saves, ' + M('impressions') + ' impressions, ' + M('video_views_3s') + ' video_views ' + eb + ' GROUP BY d ORDER BY d').bind(psince, ...nsB),
            db.prepare("SELECT title, url, src, ts, json_extract(meta,'$.reactions') reactions, json_extract(meta,'$.comments') comments, json_extract(meta,'$.shares') shares, json_extract(meta,'$.views') views, json_extract(meta,'$.ns') ns FROM arc_items WHERE kind='social_post' AND ts>?" + nsW + ' ORDER BY COALESCE(json_extract(meta,\'$.comments\'),0)+COALESCE(json_extract(meta,\'$.shares\'),0) DESC LIMIT 12').bind(psince, ...nsB),
            db.prepare("SELECT title, body, src, json_extract(meta,'$.engagement_rate') rate, json_extract(meta,'$.impressions') impressions, json_extract(meta,'$.reactions') reactions, json_extract(meta,'$.comments') comments, json_extract(meta,'$.shares') shares, json_extract(meta,'$.spend') spend, json_extract(meta,'$.ns') ns FROM arc_items WHERE kind='adcreative' AND COALESCE(json_extract(meta,'$.impressions'),0)>=20000" + nsW + ' ORDER BY rate DESC LIMIT 10').bind(...nsB),
            db.prepare("SELECT json_extract(meta,'$.campaign') campaign, json_extract(meta,'$.ns') ns, " + M('reactions') + ' reactions, ' + M('comments') + ' comments, ' + M('shares') + ' shares, ' + M('impressions') + ' impressions ' + eb + ' GROUP BY campaign ORDER BY comments DESC LIMIT 12').bind(psince, ...nsB),
            HAVE('engagement'),
          ]);
          return jsonResp({ ok: true, ns: pns, days: pdays, byDay: r[0].results || [], topPosts: r[1].results || [], topAds: r[2].results || [], topCampaigns: r[3].results || [], have: have(r[4]) });
        }
        if (path === '/perf/comments') {
          const lim = Math.min(parseInt(reqUrl.searchParams.get('limit') || '120', 10) || 120, 400);
          const cb = "FROM arc_items WHERE kind='comments' AND ts>?" + nsW;
          const rb = "FROM arc_items WHERE kind='reactions' AND ts>?" + nsW;
          const r = await db.batch([
            db.prepare('SELECT COALESCE(tone,0) tone, COUNT(*) c ' + cb + ' GROUP BY tone').bind(psince, ...nsB),
            db.prepare("SELECT date(ts/1000,'unixepoch') d, SUM(tone=-1) hostile, SUM(COALESCE(tone,0)=0) neutral, SUM(tone=1) supportive " + cb + ' GROUP BY d ORDER BY d').bind(psince, ...nsB),
            db.prepare("SELECT title, body, COALESCE(tone,0) tone, ts, src, json_extract(meta,'$.post_id') post_id, json_extract(meta,'$.campaign') campaign, json_extract(meta,'$.ad') ad, json_extract(meta,'$.permalink') permalink, json_extract(meta,'$.platform') platform, json_extract(meta,'$.ns') ns " + cb + ' ORDER BY ts DESC LIMIT ?').bind(psince, ...nsB, lim),
            db.prepare("SELECT MIN(title) title, json_extract(meta,'$.post_id') post_id, MAX(json_extract(meta,'$.permalink')) permalink, MAX(json_extract(meta,'$.platform')) platform, COUNT(*) n, SUM(tone=-1) hostile, SUM(tone=1) supportive, MAX(ts) last " + cb + ' GROUP BY post_id ORDER BY n DESC LIMIT 10').bind(psince, ...nsB),
            db.prepare('SELECT body ' + cb + ' AND tone=-1 ORDER BY ts DESC LIMIT 1500').bind(psince, ...nsB),
            HAVE('comments'),
            // reaction mix from the Meta sweep: one row per post per day
            db.prepare('SELECT ' + M('total') + ' total, ' + M('like') + ' likes, ' + M('love') + ' love, ' + M('care') + ' care, ' + M('wow') + ' wow, ' + M('haha') + ' haha, ' + M('sad') + ' sad, ' + M('angry') + ' angry, ' + M('shares') + ' shares, COUNT(*) rows ' + rb).bind(psince, ...nsB),
            db.prepare("SELECT json_extract(meta,'$.day') d, " + M('total') + ' total, ' + M('angry') + ' angry, ' + M('haha') + ' haha, ' + M('love') + ' love, ' + M('like') + ' likes ' + rb + ' GROUP BY d ORDER BY d').bind(psince, ...nsB),
            db.prepare("SELECT MIN(json_extract(meta,'$.ad')) ad, json_extract(meta,'$.post_id') post_id, MAX(json_extract(meta,'$.total')) total, MAX(json_extract(meta,'$.angry')) angry, MAX(json_extract(meta,'$.haha')) haha, MAX(json_extract(meta,'$.score')) score, MAX(json_extract(meta,'$.permalink')) permalink " + rb + " GROUP BY post_id ORDER BY MAX(COALESCE(json_extract(meta,'$.angry'),0)) DESC LIMIT 10").bind(psince, ...nsB),
          ]);
          const tones = { hostile: 0, neutral: 0, supportive: 0 };
          (r[0].results || []).forEach(x => { tones[x.tone < 0 ? 'hostile' : x.tone > 0 ? 'supportive' : 'neutral'] = x.c; });
          const LINES = [
            ['Subsidy / handout framing', /subsid|handout|freebie|welfare for/i],
            ['Mining lobby / dishonest', /lobby|dishonest|disinformation|misinformation|propaganda|spin\b/i],
            ['Pay more / at our expense', /at our expense|should be paying|pay more|pay their|billions|tax the/i],
            ['The $50m cap only hits big miners', /50 ?m|cap\b|turnover|big miners|only (the )?big/i],
            ['Not about farmers', /farmer.*(not|isn|aren|doesn)|not (about|affect) farmers|doesn.?t affect farmers/i],
            ['Climate / pollution', /climate|pollut|emission|fossil|renewable/i],
            ['Foreign owned / profits offshore', /foreign|offshore|overseas|multinational/i],
          ];
          const attack = LINES.map(([label, rx]) => ({ line: label, n: (r[4].results || []).filter(x => rx.test(x.body || '')).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
          const rx = ((r[6].results || [])[0]) || {};
          const rTot = Number(rx.total) || 0;
          const reactions = { totals: rx, rows: Number(rx.rows) || 0, byDay: r[7].results || [], byPost: r[8].results || [],
            score: rTot ? Math.round((((Number(rx.likes) || 0) + (Number(rx.love) || 0) + (Number(rx.care) || 0) - (Number(rx.angry) || 0) - (Number(rx.haha) || 0)) / rTot) * 1000) / 1000 : null };
          return jsonResp({ ok: true, ns: pns, days: pdays, tones, byDay: r[1].results || [], latest: r[2].results || [], byPost: r[3].results || [], attack, hostileSample: (r[4].results || []).length, have: have(r[5]), reactions });
        }
        if (path === '/perf/analyse' && req.method === 'POST') {
          if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'analysis_not_configured', detail: 'Set ANTHROPIC_API_KEY.' }, 501);
          let b = {}; try { b = await req.json(); } catch (e) {}
          const ans = String(b.ns || pns || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 24);
          const adays = Math.min(parseInt(b.days, 10) || pdays, 730);
          const rows = (await db.prepare("SELECT body, COALESCE(tone,0) tone, title, ts FROM arc_items WHERE kind='comments' AND ts>?" + (ans ? " AND json_extract(meta,'$.ns')=?" : '') + ' ORDER BY ts DESC LIMIT 300').bind(Date.now() - adays * 86400000, ...(ans ? [ans] : [])).all()).results || [];
          if (!rows.length) return jsonResp({ ok: false, error: 'no_comments', detail: 'No comments in range.' }, 404);
          const corpus = rows.map((x, i) => '[' + (i + 1) + '] (' + (x.tone < 0 ? 'hostile' : x.tone > 0 ? 'supportive' : 'neutral') + ', on: ' + String(x.title || '').replace(/^Comment on: ?/, '').slice(0, 60) + ') ' + String(x.body || '').replace(/\s+/g, ' ').slice(0, 280)).join('\n');
          const sys = 'You are the audience-insight analyst for an Australian communications agency running political and advocacy campaigns' + (ans ? ' (client namespace ' + ans + ')' : '') + '. '
            + 'You are given recent public comments left on the client\'s ads and page posts. Analyse them and reply with ONLY a JSON object: '
            + '{"summary":"3-4 sentences on the overall mood and what is driving it","themes":[{"theme":"short label","stance":"hostile|supportive|mixed|question","share":"rough % of comments","quotes":["verbatim short example","another"],"read":"one sentence on what this theme means for the campaign"}],'
            + '"risks":["specific risk, one sentence"],"opportunities":["specific opening, one sentence"],"responses":[{"to":"theme label","line":"a ready-to-use reply or rebuttal in the client voice, under 220 characters"}]}. '
            + '5-8 themes, ordered by share. Quote comments verbatim (trim, never invent). Australian English. No preamble.';
          try {
            const txt = await claudeMsg(env, sys, 'COMMENTS (' + rows.length + ', newest first):\n' + corpus.slice(0, 60000), 2600, 60000);
            let out = null; try { out = JSON.parse((txt.match(/\{[\s\S]*\}/) || ['{}'])[0]); } catch (e) {}
            if (!out || !out.summary) return jsonResp({ ok: false, error: 'analysis_unparsed', raw: txt.slice(0, 2000) }, 502);
            try { await env.MIND_DB.prepare('INSERT INTO mind_runs(ns,mode,q,created) VALUES(?,?,?,?)').bind(ans || 'cmm', 'sentiment', String(rows.length) + ' comments / ' + adays + 'd', Date.now()).run(); } catch (e) {}
            return jsonResp({ ok: true, ns: ans, days: adays, comments: rows.length, analysis: out });
          } catch (e) { return jsonResp({ ok: false, error: 'analysis_failed', detail: String(e && e.message || e).slice(0, 200) }, 502); }
        }
        return jsonResp({ error: 'not_found' }, 404);
      } catch (e) { return jsonResp({ ok: false, error: 'perf_failed', detail: String(e).slice(0, 200) }, 500); }
    }

    if (path === '/archive/stats') {
      if (!env.MIND_DB) return jsonResp({ ok: false, error: 'mind_unbound', detail: 'Create the D1 database and uncomment the MIND_DB binding in wrangler.toml.' }, 501);
      try {
        await ensureArchive(env);
        const wk = Date.now() - 7 * 86400000;
        // issue relevance: how much of the last 7 days speaks to the fights our clients are in
        const ISS = [
          ['ftc', '%fuel tax%', '%diesel rebate%'],
          ['cm', '%critical mineral%', '%rare earth%'],
          ['col', '%cost of living%', '%inflation%'],
          ['gov', '%newspoll%', '%primary vote%'],
        ];
        const stmts = [
          env.MIND_DB.prepare('SELECT kind, COUNT(*) c FROM arc_items GROUP BY kind'),
          env.MIND_DB.prepare('SELECT src, COUNT(*) c FROM arc_items WHERE ts>? GROUP BY src ORDER BY c DESC LIMIT 200').bind(wk),
          env.MIND_DB.prepare('SELECT COUNT(*) c, COUNT(DISTINCT sid) s FROM arc_convo'),
          env.MIND_DB.prepare("SELECT date(ts/1000,'unixepoch') d, COUNT(*) c FROM arc_items WHERE ts>? GROUP BY d ORDER BY d").bind(Date.now() - 14 * 86400000),
        ].concat(ISS.map(([, a, b]) =>
          env.MIND_DB.prepare('SELECT COUNT(*) c FROM arc_items WHERE ts>? AND (title LIKE ? OR title LIKE ?)').bind(wk, a, b)));
        const out2 = await env.MIND_DB.batch(stmts);
        const byKind = {}; (out2[0].results || []).forEach(r => { byKind[r.kind] = r.c; });
        const bySrc = {}; (out2[1].results || []).forEach(r => { bySrc[r.src] = r.c; });
        const cv = (out2[2].results || [])[0] || {};
        const byDay = (out2[3].results || []).map(r => ({ d: r.d, c: r.c }));
        const issues = {}; ISS.forEach(([k], i) => { issues[k] = ((out2[4 + i].results || [])[0] || {}).c || 0; });
        return jsonResp({ ok: true, byKind, bySrc7d: bySrc, byDay, issues, conversations: { turns: cv.c || 0, sessions: cv.s || 0 } });
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
    // Meta, direct. GET /meta/status shows what is configured and the last
    // sync; POST /meta/sync {since?, until?} backfills insights for a date
    // range (chunk long ranges by month) and re-sweeps the Ad Library.
    if (path === '/meta/status') {
      let last = {}; try { last = JSON.parse(await kvGet(env.AXIOM_KV, 'meta_last_result') || '{}'); } catch (e) {}
      const st = { ok: true, insights_configured: !!env.META_TOKEN, ad_library_configured: !!env.META_USER_TOKEN,
        accounts: metaAccounts(env).map(a => ({ account: a.acct, ns: a.ns })),
        last_sync: Number(await kvGet(env.AXIOM_KV, 'meta_last_sync') || 0) || null, last_result: last };
      // ?probe=1 walks the chain the sweeps need and names the first step that
      // fails, so setting the token up does not need a round of guessing.
      if (reqUrl.searchParams.get('probe') && env.META_TOKEN) {
        st.probe = { steps: [] };
        const step = async (name, fn) => {
          try { st.probe.steps.push({ step: name, ok: true, detail: await fn() }); return true; }
          catch (e) { st.probe.steps.push({ step: name, ok: false, detail: String((e && e.message) || e).slice(0, 200) }); return false; }
        };
        const tok = '&access_token=' + encodeURIComponent(env.META_TOKEN);
        const a = metaAccounts(env)[0];
        if (!a) { st.probe.steps.push({ step: 'ad accounts configured', ok: false, detail: 'Set META_AD_ACCOUNTS, e.g. act_123:mca,act_456:aep' }); }
        else if (await step('token is valid (reads the ad account)', async () => {
          const d = await metaGet(META_API + '/' + a.acct + '?fields=name,account_status' + tok);
          return (d.name || a.acct) + ' (status ' + (d.account_status != null ? d.account_status : '?') + ')';
        })) {
          let firstPost = null;
          if (await step('ads_read (lists ads and their posts)', async () => {
            const posts = await metaAdPosts(env, a.acct);
            firstPost = posts.keys().next().value || null;
            return posts.size + ' distinct posts behind active or paused ads';
          }) && firstPost) {
            await step('pages_read_engagement (reads reactions on a post)', async () => {
              const d = await metaGet(META_API + '/' + firstPost + '?fields=reactions.limit(0).summary(1).as(all)' + tok);
              return metaSummaryCount(d.all) + ' reactions on the newest ad post';
            });
            await step('pages_read_user_content (reads comment text)', async () => {
              const d = await metaGet(META_API + '/' + firstPost + '/comments?fields=id,message&limit=3' + tok);
              return (d.data || []).length + ' comments readable on that post';
            });
          }
        }
        const bad = st.probe.steps.filter(s => !s.ok);
        st.probe.ready = !bad.length;
        st.probe.summary = bad.length ? 'Blocked at: ' + bad[0].step : 'Every permission the comment and reaction sweeps need is in place.';
      }
      return jsonResp(st);
    }
    if (path === '/meta/sync' && req.method === 'POST') {
      let b = {}; try { b = await req.json(); } catch (e) {}
      const since = /^\d{4}-\d{2}-\d{2}$/.test(String(b.since || '')) ? b.since : '';
      const until = /^\d{4}-\d{2}-\d{2}$/.test(String(b.until || '')) ? b.until : '';
      const r = {};
      try { r.insights = await metaInsights(env, since, until); } catch (e) { r.insights = { error: String(e).slice(0, 120) }; }
      if (!b.insightsOnly) {
        try { r.library = await metaAdLibrary(env); } catch (e) { r.library = { error: String(e).slice(0, 120) }; }
        const per = Math.min(parseInt(b.postsPerAccount, 10) || 40, 200);
        try { r.comments = await metaComments(env, per); } catch (e) { r.comments = { error: String(e).slice(0, 120) }; }
        try { r.reactions = await metaReactions(env, per); } catch (e) { r.reactions = { error: String(e).slice(0, 120) }; }
      }
      await kvPut(env.AXIOM_KV, 'meta_last_sync', String(Date.now()), 86400);
      await kvPut(env.AXIOM_KV, 'meta_last_result', JSON.stringify(r).slice(0, 4000), 7 * 86400);
      return jsonResp({ ok: true, ...r });
    }

    // POST /research {q, ns?, hours?} - the in-worker deep research agent.
    if (path === '/research' && req.method === 'POST') {
      if (!env.ANTHROPIC_API_KEY) return jsonResp({ error: 'research_not_configured', detail: 'Set ANTHROPIC_API_KEY as a Worker secret.' }, 501);
      let b = {}; try { b = await req.json(); } catch { return jsonResp({ error: 'bad_json' }, 400); }
      const q = String(b.q || '').trim().slice(0, 400);
      if (!q) return jsonResp({ error: 'q_required', detail: 'Send {q:"your research question"}.' }, 400);
      const ns = String(b.ns || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 32);
      const hours = Math.min(parseInt(b.hours, 10) || 336, 720);
      try {
        const out = await researchRun(env, ctx, q, ns, hours);
        return jsonResp(out);
      } catch (e) {
        return jsonResp({ error: 'research_failed', detail: String(e && e.message || e).slice(0, 200) }, 502);
      }
    }

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
    // the reporter mirrors each core feed's result into the Source Registry
    const snap = await buildAllNews(env, { q: '', max: 120, hours: 24, onHealth: h => sourcesCoreHealth(env, h) });
    await arcNewsSnap(env, snap); // hourly permanent archive - runs with nobody watching
  } catch (e) {}
  try { await snapshotPulse(env); } catch (e) {}
  // The Source Registry: the sources beyond the core whose schedule has come
  // round - feed, WordPress API, sitemap, listing page, Google News, in turn.
  try { const sw = await sourceSweep(env); if (sw && sw.ran) console.log('Sources:', sw.succeeded, 'of', sw.ran, 'delivered,', sw.added, 'new rows'); } catch (e) { console.log('source sweep failed', String(e).slice(0, 120)); }
  // Full text for the news of the last two days that arrived as a headline and
  // a blurb: reader extraction, AMP, the archives, a rendered page.
  try { const ft = await fulltextCron(env); if (ft && ft.tried) console.log('Full text:', ft.got, 'of', ft.tried); } catch (e) { console.log('fulltext cron failed', String(e).slice(0, 120)); }
  // The Sentinel runs every tick: detect spikes on client issues, draft the
  // angle, push it to Slack. This is the loop that makes response time small.
  try {
    const s = await sentinelScan(env);
    if (s && s.fired) console.log('Sentinel fired', s.fired, 'alert(s)');
  } catch (e) { console.log('Sentinel scan failed', String(e).slice(0, 120)); }
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
  // Paid-political advertising disclosures (opposition watch). Reddit's own
  // transparency feed; Meta Ad Library and Google political-ads land here too.
  try { await archiveItems(env, 'oppads', await socialRedditPoliticalAds()); } catch (e) {}
  // Meta direct: own campaign performance + Ad Library opposition sweep (6-hourly).
  try { await metaCron(env); } catch (e) {}
  try { await redditCron(env); } catch (e) {}
  // Signals: the clients' own LinkedIn and Meta pages, 6-hourly, so the view is
  // never empty when someone opens it. X and Reddit come from the desktop agent.
  try { await signalsCron(env); } catch (e) {}
  // Social capture: Bluesky, Mastodon, X timelines, YouTube comments and captions, petitions (two-hourly).
  try { await socialCron(env); } catch (e) { console.log('social cron failed', String(e).slice(0, 120)); }
  // Sentiment: the newest rows that mention an entity get their verdicts, within the day's budget.
  try { const sn = await sentimentCron(env); if (sn && sn.classified) console.log('Sentiment:', sn.classified, 'rows,', sn.mentions, 'stances'); } catch (e) { console.log('sentiment cron failed', String(e).slice(0, 120)); }
  // Narratives: the newest rows join or start the stories the conversation is telling; new ones are named and, when they take off on a client issue, reported.
  try { const nr = await narrativesCron(env); if (nr && nr.placed) console.log('Narratives:', nr.placed, 'rows placed,', nr.started, 'started,', nr.named, 'named'); } catch (e) { console.log('narratives cron failed', String(e).slice(0, 120)); }
  // Topics: SIFA's keyword list hourly, then the two stalest topics researched.
  try { await topicsCron(env); } catch (e) { console.log('topics cron failed', String(e).slice(0, 120)); }
  try {
    const jf = await Promise.allSettled([forumOzRss(), forumWhirlpoolQ('politics'), forumBigfootyLatest(), forumHotcopperLatest(), forumPropertyChat()]);
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


