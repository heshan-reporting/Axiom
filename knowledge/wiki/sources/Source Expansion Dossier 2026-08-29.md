---
type: source
title: Source Expansion Dossier 2026-08-29
status: developing
created: 2026-08-29
updated: 2026-08-29
client: cmm
tags:
  - source
  - dossier
  - sources-research
---

# Source Expansion Dossier 2026-08-29

Bounded autoresearch (8 searches, direct URL fetches blocked by the session
sandbox). Method per [[How We Curate]] L2: every claim cited; feed URLs are
**pattern-corroborated, not fetch-verified** - verify each live with the
worker's `/rss?feed=<key>` route after deploy. Dead feeds fail soft (the
worker uses allSettled + a circuit breaker).

## Wired into the worker (v11)

- 7News politics feed at `https://7news.com.au/politics/feed` - 7News uses a
  `/[section]/feed` RSS pattern (e.g. sport, weather). Source:
  https://rss.feedspot.com/australian_news_rss_feeds/ [unreviewed]
- The Tally Room (Ben Raue, electorate-level election analysis) - WordPress
  site, feed at `/feed`. Source: https://www.tallyroom.com.au/ [unreviewed]
- Kevin Bonham (poll aggregation / psephology; useful corrective to the
  [contested] polling in [[Intelligence Digest 2026-08-29 - Macro and Politics]]) -
  Blogspot standard feed `feeds/posts/default?alt=rss`. Source:
  https://kevinbonham.blogspot.com/ [unreviewed]
- John Quiggin (economics commentary) - WordPress `/feed`. Source:
  https://johnquiggin.com/ [unreviewed]
- Tasmanian Times (independent, state coverage) - "offers RSS Feed" per its
  site; WordPress `/feed`. Source: https://tasmaniantimes.com/ [unreviewed]
- RBA speeches RSS - the RBA documents an RSS speeches feed at
  https://www.rba.gov.au/updates/rss-feeds.html ; our working media-releases
  feed uses the same `/rss/rss-cb-*.xml` convention. [unreviewed]
- OzBargain deals feed `https://www.ozbargain.com.au/deals/feed` - explicitly
  documented by the site and community threads; real-time retail behaviour as
  a cost-of-living signal. Source: https://www.ozbargain.com.au/node/83247 [corroborated]
- PropertyChat forum - XenForo 2 standard whole-forum RSS `community/index.rss`;
  housing sentiment from investors. Sources:
  https://xenforo.com/community/threads/rss-feeds.143764/ ,
  https://www.propertychat.com.au/community/ [unreviewed]
- Subreddits added to tag routing: r/australian (auspol/australia tags) and
  r/AusPropertyChat (housing tag). r/australia confirmed ~2.8M members.
  Source: https://gummysearch.com/r/australia/ [unreviewed]

## Candidates - found but NOT wired (URL unconfirmed)

- Sky News Australia: feeds exist (Feedspot lists politics et al) but the
  exact skynews.com.au feed path could not be confirmed; the UK pattern is
  feeds.skynews.com/feeds/rss/politics.xml. Source:
  https://rss.feedspot.com/skynewsaustralia_rss_feeds/
- Parliament of Australia: RSS program confirmed (bills, FlagPost library
  blog) at https://www.aph.gov.au/Help/Rss_feeds - exact feed URLs sit behind
  a page the sandbox could not fetch; there is also a community bills feed
  project https://github.com/richyvk/APH-rss .
- Treasury ministers (ministers.treasury.gov.au) and the whole-of-government
  RSS directory https://info.australia.gov.au/news-and-social-media/social-media/rss-feeds -
  a portfolio-by-portfolio directory worth mining in a browser session.
- Parliament of WA RSS: https://www.parliament.wa.gov.au/webcms/webcms.nsf/content/rss-feeds
- Aussie Stock Forums (XenForo `index.rss` likely) - base path unconfirmed.
- YouTube channel RSS (`youtube.com/feeds/videos.xml?channel_id=...`) for
  ABC News / Sky News AU - channel IDs not verified; collect from a browser.

## Risks / watch items

- ABC News RSS reportedly now only serves pages with `/topic/` in the URL
  (as of Aug 2026) - our numeric `/news/feed/<id>/rss.xml` feeds may be
  degrading. Check `/allnews?debug=1` per-feed counts after deploy. Source:
  https://james.cridland.net/blog/2025/abc-news-australia-rss-feeds/ [watch]

## Working read (synthetic, provisional)

The biggest gaps closed: psephology (Tally Room + Bonham vs single-poll
headlines), primary-source monetary signalling (RBA speeches), housing/
cost-of-living ground truth (PropertyChat + OzBargain), and a second
commercial broadcast wire (7News). Remaining gap: official parliamentary
feeds - resolvable in one browser session via the two directories above.
