---
type: source
title: Government Sources 2026-08-29
status: developing
created: 2026-08-29
updated: 2026-08-29
client: cmm
tags:
  - source
  - dossier
  - sources-research
  - government
---

# Government Sources 2026-08-29

Follow-up to [[Source Expansion Dossier 2026-08-29]]: primary-source
collection from Australian government websites (worker v12). Sandbox egress
still blocks direct fetches, so URLs are documentation- or
infrastructure-corroborated; verify live with `/rss?feed=<key>` after deploy.

## Wired (worker v12, feed group: gov)

- Department of Health news RSS at `https://www.health.gov.au/news/rss.xml` -
  the department documents this exact URL on its subscriptions page.
  Source: https://www.health.gov.au/using-our-websites/subscriptions/using-our-latest-news-rss-feed [corroborated]
- Department of Industry, Science and Resources news at
  `https://www.industry.gov.au/news/rss.xml` - same govCMS platform and the
  department runs an RSS program (industry.gov.au/contact-us/rss-feeds).
  Directly relevant to MCA: this is the critical-minerals portfolio.
  Source: https://www.industry.gov.au/contact-us/rss-feeds [pattern]
- Federal ministers sweep - Google News index restricted to
  ministers.treasury.gov.au, pm.gov.au, treasury.gov.au. Rides proven feed
  infrastructure instead of guessing each site's own feed path. [infrastructure]
- State statements sweep - statements.qld.gov.au (Qld ministerial
  statements portal) and mediastatements.wa.gov.au (WA) via the same index;
  both portals confirmed active. Sources: https://statements.qld.gov.au/ ,
  https://www.mediastatements.wa.gov.au/Pages/SearchMinister.aspx [infrastructure]
- Agencies sweep - abs.gov.au, accc.gov.au, aec.gov.au via the index. [infrastructure]

## Candidates still unwired

- The whole-of-government portfolio RSS directory:
  https://info.australia.gov.au/news-and-social-media/social-media/rss-feeds -
  worth one browser session to harvest exact per-portfolio feed URLs.
- Parliament of Australia feeds (bills, FlagPost): https://www.aph.gov.au/Help/Rss_feeds
- ACT media-release RSS directory:
  https://www.cmtedd.act.gov.au/open_government/inform/act_government_media_releases/all_media_release_rss_feeds
- treasury.gov.au/media-release listing (own feed path unconfirmed).

## Working read (synthetic, provisional)

Government releases are L0 primary sources: they carry the government's own
framing minutes before the press files. For MCA the Industry feed plus the
federal-ministers sweep effectively watch the fuel-tax-credit and
critical-minerals decision-makers directly.
