# AXIOM — session guidance

AXIOM is an Australian political intelligence platform: a single-file frontend
(`docs/index.html`, served by GitHub Pages **from the /docs folder only** —
Settings -> Pages -> main //docs; this keeps `knowledge/`, the worker source
and tools off the public site) plus a Cloudflare Worker backend
(`axiomworkerv4.js`, deployed as `newsaus` — keep it pure ASCII). Design tokens
live in `docs/axiom-ds.css`; `docs/styleguide.html` documents them. Never move
non-public files into `docs/`.

## Knowledge vault (claude-obsidian)

This repo carries a source-cited Obsidian knowledge vault for research and
client intelligence, powered by the vendored
[claude-obsidian](https://github.com/AgriciDaniel/claude-obsidian) product
(MIT — see `tools/claude-obsidian/LICENSE` and `ATTRIBUTION.md`).

- Product root (code, read-only): `tools/claude-obsidian/`
  — CLI: `python3 tools/claude-obsidian/scripts/claude-obsidian.py`
- Vault (knowledge, mutable): `knowledge/` — selected automatically via the
  root `.claude-obsidian.json`; runtime state under `knowledge/.vault-meta/`
  is gitignored.
- Skills are registered project-scoped in `.claude/skills/` (wiki, wiki-ingest,
  wiki-query, wiki-retrieve, wiki-lint, wiki-fold, wiki-mode, save,
  autoresearch, canvas, defuddle, obsidian-bases, obsidian-markdown, think,
  wiki-cli). Their product-root references are pre-resolved to
  `/home/user/Axiom/tools/claude-obsidian`.
- Cloud containers are ephemeral: vault changes only survive if committed.
  After vault-mutating operations, commit and push `knowledge/`.

### The growth loop

Curation doctrine lives in the vault: `knowledge/wiki/concepts/How We Curate.md`
(the L0–L4 funnel — apply it before treating anything as knowledge).
Reviewed notes sync into the app's retrieval layer with
`python3 tools/vault2mind.py` (dry-run; add `--apply` to push; commit
`tools/mind-sync-state.json` afterwards). Client-specific notes declare
`client: <id>` frontmatter; the default namespace is `cmm`. In-app,
Ad Lab and Studio record approved/killed verdicts to the Mind as
`kind: outcome` — wins and losses that future briefs retrieve.

## The Sentinel (rapid response — the agency's flagship loop)

`CLIENT_ISSUES` in the worker is the one lexicon everything tags with: it maps
each client namespace to the issues they own (mca: fuel tax credits / critical
minerals / mining and resources; aep: gas / energy and climate; vicnats: VIC
election + regional Victoria; pca: housing; mba: construction and IR; pharm:
community pharmacy; cmm: cost of living / economy and tax / federal politics /
activist campaigns). Each issue carries three things and the difference
matters: `rx` is the **tight** Sentinel trigger (what counts as a spike),
`wide` is the **broad** collection matcher used by `issueTag()` everywhere
rows are tagged (Reddit threads and comments, Meta comments, the Command
Center orbit), and `q` is the list of Reddit search terms for the keyword
sweep. `GET /reddit/issues` publishes the lexicon (ids, matchers, terms) so a
desktop collector tags exactly as the worker does; `docs/index.html`'s
`AX_ISSUES` mirrors the wide matchers for the frontend. Every cron tick
`sentinelScan()`
counts matching stories in a 6h hot window against that issue's own 14-day
baseline from the archive; a spike (>=2.5x, >=3 stories, 12h cooldown unless
intensity grows 1.6x) fires an alert, drafts an angle with Claude grounded in
Mind retrieval, and pushes it to Slack (webhooks in KV `slack_webhooks`:
`{"mca":"https://hooks.slack…","_default":"…"}`). Rows live in `arc_alerts`
with the lifecycle stamps that measure speed to respond: detected ->
notified -> acked -> drafted. Routes: `/sentinel/alerts|scan|ack|metrics`.
In-app: the Sentinel view (nav badge counts what is unactioned) with
Acknowledge (stops the clock) and Draft in Ad Lab (seeds the brief).

## The research agent

POST `/research {q, ns?, hours?}` (key-gated, full role — it spends API
tokens): `researchRun()` plans 3-4 Google News queries with Claude, sweeps
each, reads up to 3 pages live (`pageGrab`), cross-references `arc_items`
(LIKE) and `mindRetrieve(ns||cmm)`, then synthesises a cited dossier
([W#] pages, [N#] news, [A#] archive, [S#] Mind). The run is archived as
kind `research` and logged to `mind_runs`. In-app: the Deep Research panel
on the Analyst view (query + client scope, staged progress, rendered
dossier, source list, Save to the Mind as kind `research`).

## Opposition ad monitoring (paid political persuasion)

Kinds `oppads*` in the archive hold disclosed political advertising.
`python3 tools/oppads.py all --key KEY` streams Google's political-ads
transparency bundle (public, daily), keeps the Australian rows and loads
`oppads_gadv` (advertiser lifetime AUD), `oppads_gweek` (weekly AUD spend)
and `oppads_gad` (creatives with targeting); re-runs are url-deduped. The
cron sweeps Reddit's own disclosure feed (r/RedditPoliticalAds, AU-filtered)
into kind `oppads` every tick. Map node: `x_oppads`.

## Campaign performance (the feedback loop)

Archive kind `campaign` holds one row per campaign per day across Meta,
LinkedIn, Google Ads, Reddit, Snapchat (and Pinterest/TikTok when pulled),
`meta.ns` tagging the owning client (account-name rules in
`tools/supermetrics2rows.py`). History is pulled through the Supermetrics
MCP in this session (query per platform, results saved as tool-result
files), converted with `tools/supermetrics2rows.py <platform>=<file> ...`
and loaded with `tools/archive-push.py rows.json --key KEY` (url-deduped,
re-runs safe). The worker's Meta sync (`metaInsights`) keeps Meta current
without a third party. Map node: `o_campaign`.

## Social engagement and audience comments

Beside `campaign` sit four more archive kinds: `engagement` (Meta campaign-
day reactions/comments/shares/saves/video views), `adcreative` (each ad's
copy plus lifetime engagement), `social_post` (organic Facebook/Instagram/
LinkedIn post performance) and `comments` (comment text with `tone` -1/0/1
from a colloquial lexicon; author names are never stored). Pull via the
Supermetrics MCP (Meta Ads for ads; Facebook Insights, Instagram Insights
and LinkedIn Pages for organic - those expose comment text as
`post_comment_text`, `media_comment_text`, `share_comment`), convert with
`tools/supermetrics2social.py <dataset>=<file> ...` and load with
`tools/archive-push.py`. The worker's `metaComments()` sweeps comments on
the posts behind each account's ads every 6h (needs pages_read_engagement
+ pages_read_user_content on the System User token) and tags each one with
`issueTag()`, so an audience comment is filed under the client issue it
argues about, the same ids the Reddit rows and the Sentinel use.

## The Audience view (Ads · Social · Comments & sentiment)

In-app view `v-audience` with three tabs, a client-scope select, a date
range, and a **Load data** button that pushes a prepared rows file
(`campaign-rows.json`, `social-rows.json`) straight into the archive from
the browser - same 150-row batches as the CLI, with progress and a verified
count, so loading never needs a terminal. Empty panels diagnose themselves
(what the archive holds, and a Run archive diagnostic button that calls
`/archive/selftest`). It reads aggregates the worker computes over the archive with
SQLite `json_extract`: GET `/perf/ads` (spend/impressions/clicks/leads by
platform, day, client; top campaigns with CPL), `/perf/social` (engagement
by day, most-discussed organic posts, ad copy ranked by engagement rate),
`/perf/comments` (tone totals and by day, latest comments, per-post heat,
attack-line counts over hostile comments) - all read-role. POST
`/perf/analyse {ns,days}` (full role) has Claude group the recent comments
into themes with verbatim quotes, risks, openings and ready replies;
results are logged to `mind_runs` as mode `sentiment`. Harness: `aud.js`.

## Signals: Reddit, X, LinkedIn and Meta (internal agency sentiment)

The `v-signals` view (React island, `docs/signals.js`) holds public conversation
about our clients in one shape across four platforms, with a **live console**
that shows the collection happening. Pressing **Sweep** does not fetch in the
browser: it creates a JOB (`POST /bridge/run {source,params}`). Sources the
worker can reach run there and narrate into the job log; sources that need a
logged-in machine are left queued for `tools/reach-agent.py` on a Mac, which
claims them (`GET /bridge/next`), runs the collector, and streams every command
and its answer back (`POST /bridge/log`) before reporting the outcome
(`POST /bridge/done`). The view tails `GET /bridge/job?id=&after=` either way,
so `$ twitter search "fuel tax credit" ...` and its answer appear as they run.
Tables `bridge_jobs` and `bridge_log` in D1; `GET /bridge/status` lists the
connected collectors (KV heartbeats) and which sources are configured.
`jobRoute()` decides where a job runs **by capability, not by category**: X
always goes to the desktop; Reddit goes there too whenever a live collector
offers it, because Reddit 403s Cloudflare's whole network - the worker keeps
Reddit only when `REDDIT_CLIENT_ID`/`SECRET` are set, since OAuth reads do work
from the cloud. A worker-side Reddit job probes one listing before sweeping and
fails immediately with the fix if that probe is refused, instead of spending
three minutes being refused thirty more times.

Per platform:
- **Reddit** - the sweep described below; worker-side where Reddit allows it,
  desktop-side reliably (`tools/reach-reddit.py`). Kinds `reddit_thread` /
  `reddit_comment`.
- **X** - desktop only. `tools/reach-x.py` drives `twitter` (public-clis/
  twitter-cli) with the client keywords, reads the replies under the posts that
  drew argument, and files kinds `sig_thread` / `sig_comment` with
  `meta.platform: x`. **Signed in is not the same as able to search:** X needs
  an `x-client-transaction-id` header on search and ignores it on `status`, so
  when twitter-cli's generator breaks upstream (`Failed to init
  ClientTransaction` on stderr) the session authenticates and every search 404s.
  `assert_searchable()` raises `XUnavailable` before a sweep that would return
  nothing and look successful; the agent reports it as `x_unavailable` so the
  job log names the platform rather than blaming the collector, and a 404 from
  any call carries the explanation. Handles and display names are never stored; permalinks use
  the `x.com/i/web/status/<id>` form, which carries no handle.
- **LinkedIn** - the clients' own pages through LinkedIn's own API:
  `linkedinSweep()` reads `/rest/posts?author=<org urn>` and
  `/rest/socialActions/<urn>/comments`. Needs the secret `LINKEDIN_TOKEN`
  (r_organization_social) and the var `LINKEDIN_ORGS`
  (`urn:li:organization:123:mca,456:aep`). There is no scraping path and none
  is wanted; without the token the view says exactly what to set.
- **Meta, organic** - `metaOrganicSweep()` reads each page's own posts and their
  comments through the Graph API (`META_PAGES` = `123456:mca,789012:aep`), which
  is where most of the argument happens. The ad-side sweep (`metaComments`) and
  the whole Supermetrics path are untouched - **ad comments and campaign
  performance stay in the Audience view**.

**The Australian gate.** The keyword pass searches all of Reddit (and X), so a
generic client term - "interest rates", "gas prices", "question time" - also
finds American and British threads, and the wide matchers tag them. A hit
outside the watched subs is kept only when something on it says Australia
(`AU_RX` in the worker, mirrored in `tools/reach-reddit.py`: sub name, place,
institution, politician, masthead, or one of our clients' own terms). **The
search term that found a thread is not evidence on its own** - most client terms
are ordinary English elsewhere and `AU_RX` contains those very terms, so folding
the query into the checked text passed every American hit; a query vouches for a
thread only when the query itself names Australia (`AU_QUERY_RX`), so
"nuclear power australia" and "v/line regional rail" hits stay while
"fuel tax credit" and "rising tide protest" hits must earn it. The console
logs "N hits, M Australian kept". Threads filed before the gate are hidden by
`/signals/threads` (default `sort=relevance`: issue breadth, comments held,
busyness; `sort=new` for time order; `all=1` shows the off-topic rows, `noise`
counts them) and deleted by `POST /signals/prune {platform:'reddit'}` (full
role) with their comments. In the view: an order select, an "N off-topic
hidden" toggle and a Prune button on the Reddit tab. The desktop collector reads
comment trees for the 60 highest-weight threads by default (`--threads`).
**Load live comments** on a Reddit thread is a job too: `POST /bridge/run
{source:'reddit', params:{thread,sub,title,permalink,commentsPer}}` - routed by
`jobRoute()` like a sweep, so it runs on the Mac collector (`job_reddit` with a
`thread` param runs `rdt read`) whenever Reddit refuses the worker, and the
Comments panel tails the job and shows where it ran. `/reddit/comments?live=1`
remains for a worker that holds Reddit app credentials.

Read routes (read role): `/signals/threads?platform=&days=&issue=&q=&sort=&all=`,
`/signals/comments?thread=&platform=`, `/signals/status` (counts and tone per
platform, what is configured, who is connected). Full role: `/signals/analyse`
(Claude reads the platform in its own register - LinkedIn is professional and
named, X is fast and adversarial, Meta is emotive, Reddit runs ahead of
mainstream) and `/signals/mind` (a digest into the Mind, kind `signal`).
Harnesses: `signals-worker.js` (33 route tests), `signals.js` (24 browser
tests), `reach-agent-test.py` (17 collector tests).

## Topics (keyword research for SIFA and for us)

SIFA, the partner system, hands AXIOM keywords and topics; AXIOM researches
each one across everything it can reach and hands the results back. Contract
for SIFA's developers: `SIFA-INTEGRATION.md` at the repo root.

- **Keywords in.** `sifaPull()` GETs `SIFA_URL` (default
  `https://sifa.wearecuriousminds.com/api/keywords`) with the secret
  `SIFA_TOKEN` as bearer; `topicNormalize()` reads any shape (array of strings,
  array of objects under data/keywords/items, fields keyword|term|name,
  topic|category, client|ns, priority) into D1 `topics`. SIFA may also push:
  `POST /sifa/keywords` gated by **its own** bearer, the secret
  `SIFA_INBOUND_KEY` (`sifaInbound()`, timing-safe), never the AXIOM key.
  `topicsCron()` pulls hourly and researches the two stalest active topics per
  tick; `POST /topics/sync`, `/topics/add|update|delete` and `GET /topics/probe`
  (raw SIFA answer) are the manual path.
- **The research job** (`topicRun`, bridge source `topic`, worker-side):
  Google News for the keyword, for the keyword with MP/minister/opposition, and
  for the keyword on government and party sites (`TOPIC_STATEMENT_SITES`);
  Hansard through OpenAustralia when `OPENAUSTRALIA_KEY` is set
  (`hansardSearch`); the archive across every kind; the Mind for the client
  namespace; then two child jobs - X restricted to the MPs' own accounts
  (`from:` handles from the register, replies included) and the Reddit keyword
  pass with `listings:false` - both stamped `meta.topic`. SIFA sends generic
  nouns ("guns", "shooting"), which searched worldwide return American
  discussion that the Australian gate then throws away, so `auQualify()`
  appends "australia" to the open search unless the keyword already names it;
  the X `from:` account searches keep the bare term (`fromQueries`), those
  accounts being Australian by definition. Hits are filed as
  kind `topic_hit` (`meta.source` news|statement|hansard), the full brief goes
  to KV `topic_brief_<id>` with a pointer row of kind `topic_brief`, and the
  brief is strict JSON from Claude: summary, volume, positions (who, role,
  stance, evidence, source), coverage, statements, changes, risks, openings,
  watch, gaps - every item cited by source id.
- **The MP register** (`mps`): every sitting member and senator from Wikidata
  (`mpsSync`, SPARQL on P39 without an end date; X P2002, Facebook P2013,
  Instagram P2003, party P102, electorate P768). `GET /mps`, `POST /mps/sync`.
  **MPs are public officials speaking in office: their name, party and house
  are kept on their own posts (`meta.mp`); replies and everyone else stay
  anonymous.** Meta pages of MPs cannot be read through the Graph API without
  Page Public Content Access, so Facebook stays a register field for now.
- **Results out.** `GET /topics/results?id=&days=` and, for SIFA,
  `GET /sifa/results?keyword=` / `GET /sifa/topics` / `POST /sifa/run` -
  brief, news, statements, hansard, MP posts on X, Reddit threads, comment
  tone, and the child job states.
- In-app: the Topics view (`docs/topics.js`): SIFA and register status chips,
  Sync from SIFA, Probe, Sync MPs, add a keyword with a client, the keyword
  list with client select, active toggle and Run (job console), and results by
  tab with the brief first. Harnesses: `topics-worker.js`, `topics.js`
  (browser), and the topic cases in `reach-agent-test.py`.

## The Engine (the memory the model cannot work without, and how it learns)

The Engine is not a fine-tune. Claude and Gemini stay the reasoning muscle;
the Engine is the memory around them, the watchers that feed it, the
corrections that shape it, and the record of what worked. Namespaces stay
walls: a client's corrections and exemplars never reach another client.

- **Corrections (Teach mode).** `POST /engine/fix {ns,task,scope,wrong,right,
  why,source}` turns one correction into a standing rule - Claude compiles it
  (`engineCompileFix`, plain fallback if Claude is down) - stored in D1
  `engine_fixes` with who taught it and when, `scope` client or all, `task`
  tiles / copy / analysis / any, switchable (`/engine/fix/update`) and
  deletable. `engineRules(env, ns, task)` builds the prompt block ("LEARNED
  CORRECTIONS - N in force; these outrank taste") and counts hits;
  `releaseCompose()` includes it on every build (the console logs "applying N
  learned corrections"), and Ad Lab / Studio append the `task=copy` rules to
  the client playbook via `ccPlaybook()`. In the Release Desk every tile has
  **Fix this** (what it wrote, prefilled; what it should have been; why; scope;
  reach) and the **N learned** panel lists, switches off and deletes rules.
- **Outcomes.** `POST /engine/outcome {ns,surface,ref,n,verdict,why,...}`
  records **Approve** / **Kill** on a tile in `engine_outcomes` and files a
  WIN/LOSS exemplar in the Mind (kind `outcome`) so future briefs retrieve the
  wins and learn from the losses. This is also the approved corpus a future
  per-client style adapter would train on.
- **Artwork memory.** `POST /engine/artwork {ns,title,imageB64,mime,meta}`
  has a vision model (`engineDescribe`, gemini-2.5-flash) catalogue a past
  creative - layout, palette, typography, every word on it, tags - stores the
  image in R2 `art/<ns>/<id>` (served by `GET /engine/art?id=`), files the
  description in the Mind as kind `artwork`, and records it in `engine_art`.
  `GET /engine/artworks?ns=` lists them.
- **Ingest.** `python3 tools/engine-ingest.py <folder> --ns mca --key
  $AXIOM_KEY` walks an export folder: .txt .md .html .csv .json .docx (native)
  .pdf (pdftotext) go to `/mind/ingest` with kind guessed from the path
  (release / brief / slack / copy / doc) and date from the filename; images go
  to `/engine/artwork` with the folder as campaign. A state file in the folder
  (content hashes) makes re-runs pick up only what is new or changed;
  `--dry-run`, `--kinds`, `--force`, `--max`.
- `GET /engine/status?ns=` sums what the Engine holds: fixes in force and
  applied, outcomes, artworks, Mind docs by kind. Roles: reading is read-role;
  teaching, approving and filing are full. Harnesses: `engine-worker.js` (29),
  `engine-ingest-test.py` (12), and the Teach / Approve / Learned cases in
  `release.js`.

Next slices, in order: the golden set (past releases and the tiles the team
approved, re-run on every prompt or model change and scored), the entity
graph (people, organisations, issues, opponents, journalists - a claims ledger
with sources), watchers writing to that graph, then per-client style adapters
once the approved corpus is large enough.

## The Source Registry and full text (Phase 1 of the intelligence expansion)

Everything AXIOM reads is data in D1 `sources`, not code: id, name, `tier`
(core / national / metro / regional / broadcaster / wire / independent /
official / party / polling / thinktank / sector / podcast / sweep), `juris`
(au or a state), the client `issues` it speaks to, ordered `methods`, `urls`
(`rss`, `wp` WordPress root, `json`, `sitemap`, `home` listing page, `site`
for Google News `site:`, `gnews` explicit query, `podcast` Apple-directory
search term), `schedule` minutes, `enabled`, and the health columns
(`last_try`, `last_ok`, `next_due`, `fails`, `method_ok`, `last_error`,
`latest_ts`, `alerted`). `SOURCE_SEED_EXT` in the worker (about 200 rows) plus
the `AU_FEEDS` core (mirrored as `core=1`, named by `CORE_META`) seed the
table through `ensureSources()`; the seed refreshes rows the operator has never
edited (`edited=0`) when its hash changes and never touches edited rows.
**Seed URLs are unverified until a sweep proves them** - that is the point of
the health table.

`sourceRun(env, src, {all})` walks the method chain - `srcRss`, `srcWp`
(`/wp-json/wp/v2/posts`, brings full text), `srcJson`, `srcSitemap`
(`robots.txt` -> news sitemap, follows one index level), `srcPodcast`
(iTunes search -> feedUrl cached in KV `pod_feed_<id>` -> feed; episodes
without a link file under their enclosure), `srcHtml` (`listingLinks()`:
article-shaped links on a listing page, undated, stamped at first sight),
`srcGnews` (`site:` or the query, `when:2d`, outlet suffix stripped to
`meta.outlet`), `srcRender` - and stops at the first that delivers, trying
`method_ok` first; the Probe (`all`) runs every method and reports each.
`sourceRows()` files kind `news` with `src` = source id and
`meta {reg:1, source, tier, juris, method, issues: issueTag(), dated, full, ft}`.
`sourceSweep(env, {ids|all|limit, log})` runs the due registry sources
(`next_due<=now`, oldest first, `SOURCES_PER_TICK` = 50) every cron tick,
writes one `source_health` row per attempt (kept to 4000) and updates the
source; `sourcesAlertDead()` posts once to Slack (`_default` webhook) when a
source reaches `SOURCE_DEAD_FAILS` = 6 consecutive failures (`alerted` 1, or 2
when no webhook is set); a later success resets it. Core feeds are fetched by
`buildAllNews` as before; the cron passes `onHealth` so `sourcesCoreHealth()`
mirrors their result, and a core feed switched off in the view is skipped
there too (KV `sources_core_off`). `/allnews` merges the registry's last-72h
archive rows (`json_extract(meta,'$.reg')=1`, marked `reg:1`) so the newsroom
shows the whole estate; `arcNewsSnap` does not re-file them.

Routes (read role for GETs, full for POSTs): `GET /sources?tier=&juris=&status=
&issue=&q=` (rows with `status` ok / failing / dead / stale / unverified / off,
`items24` and `latest_ts` from the archive, a `summary`, `lastSweep`),
`/sources/health?id=&limit=`, `/sources/probe?id=` (every method live; files
nothing), `/sources/export`; `POST /sources/add|update|delete|import|sweep|
report` (`sweep` with up to 5 ids runs inline with `tried` per source, more or
`all` becomes a bridge job `sources` the console tails; `report` is how the
Mac records a render probe; core feeds cannot be deleted or re-pointed, only
switched off).

**Full text.** `fullText(env, url, {light, save, render})` tries, in order:
Google News link decode (`gnewsDecode`: base64 id, else the interstitial's
`data-n-a-sg`/`data-n-a-ts` through `batchexecute`), the page itself
(`extractArticle`: JSON-LD `articleBody`, then `<article>` paragraphs, then
`<main>`, then the page's paragraphs; `FT_MIN` = 600 chars; paywall signals
noted), AMP (`<link rel=amphtml>`, `amp.<host>`, `/amp`, `?outputType=amp`),
Google's AMP cache (`cdn.ampproject.org/c/s/`), the Wayback Machine
(`wayback/available`, `id_` snapshot; `save=1` requests a snapshot first),
archive.today (`archive.ph/newest/`, fails soft), then a real browser. Every
attempt is returned with its reason. `GET /fulltext?url=|id=&save=&light=`
(read; a full key also files the result on the row), `POST /fulltext/save`
(the Mac writes back). `fulltextCron()` gives `FT_PER_TICK` = 40 news rows
under 48h with a body under 600 chars their text each tick (`light`: no
archive.today, no render unless `FULLTEXT_RENDER=1`), marks `meta.ft` with the
method, or `retry` then `none` after two failures with `meta.ft_err`. No
credentialed access anywhere: paywalled copy comes only from routes a
publisher serves publicly, or not at all.

**Rendering.** `renderConfigured(env)` is true with `RENDER_URL` (an HTTP
service taking `{url}` and answering `{html}` - a Playwright box on AWS or a
Mac; `RENDER_KEY` sent as `X-Axiom-Key`) or `CF_ACCOUNT_ID` +
`CF_BROWSER_TOKEN` (Cloudflare Browser Rendering `/content`). Bridge source
`render` (`{source}` renders a listing page and files it; `{url,id}` reads an
article and saves it) runs in the worker when configured, otherwise
`jobRoute()` sends it to a Mac: `tools/reach-agent.py` offers `render` when
Playwright imports (`pip install playwright && playwright install chromium`),
`job_render` drives headless Chromium with `listing_links` / `extract_article`
mirroring the worker's, files rows through `/archive/add` (`meta.via: reach`)
and reports through `/sources/report` or `/fulltext/save`.

In-app: the Sources view (`docs/sources.js`, `#v-sources`): the strip (sources,
delivering by method, failing, dead, untried, items 24h, last sweep), a dead
banner, filters (search, tier, jurisdiction, status, client issue, method,
sort), the table (source, tier, jurisdiction, delivers via + fallbacks, latest
item, 24h, fails, status), and a drawer per source (facts in Australian
Eastern time, routes in order, urls, Probe every route with a per-method table,
Sweep now, Probe with a browser, Switch off, Edit, Delete, recent attempts),
Add source, Import / Export JSON. Harnesses in the session scratchpad:
`sources-worker.mjs` (23 route tests over a real SQLite behind the D1 API,
`d1lite.mjs`), `sources-browser.mjs` (13 browser tests), `reach-render-test.py`
(16 agent tests). The sandbox has no egress, so live per-source results come
from the first deployed sweep: read them at `/sources` or in the view.

## Social and community capture (Phase 2 of the intelligence expansion)

Beyond Reddit and the clients' own pages, the worker reads the public
conversation through routes that need no login, and files it in the Signals
shape - `sig_thread` / `sig_comment` with `meta.platform`, `meta.eng`
`{likes, reposts, replies, quotes, views}`, `meta.issues` from `issueTag()`,
no names (sitting MPs on their own posts excepted, `meta.mp`). One table says
what each platform needs, reaches, cannot reach and how it fared:
`GET /social/coverage?probe=1` (`socialCoverage()`; `probe=1` asks each
keyless platform one small live question), the Coverage tab in Signals.

| Platform | How | Needs | Cannot |
|---|---|---|---|
| Bluesky | `bskySweep`: public AppView `searchPosts` per client term (the Australian gate applies, with the search term struck out of the text first), `getPostThread` for posts with replies | nothing | - |
| Mastodon | `mastodonSweep`: tag timelines for `MASTO_TAGS` on `MASTO_INSTANCES`, `statuses/:id/context` for replies | nothing | full-text search (needs an instance token) |
| X | `xSyndSweep`: account timelines through X's embed service (`syndication.twitter.com/srv/timeline-profile/screen-name/`) for the MP register plus KV `x_watch` (`GET/POST /social/x/watch`), 30 accounts a run by cursor; `xTweet()` reads one post through `cdn.syndication.twimg.com/tweet-result` | nothing for timelines; a signed-in Mac (twitter-cli) for search and replies | keyword search and reply text from the cloud |
| YouTube | Source Registry method `youtube` (`urls.youtube` = `@handle` or `UC...`; `ytChannelId` resolves handles, KV `yt_ch_*`; the channel feed files videos as `sig_thread` platform youtube); `youtubeEnrich` then reads comments (`ytCommentsApi` with `YOUTUBE_KEY`, else `ytCommentsWeb` through `youtubei/v1/next`) and captions (`ytTranscript`: watch page or the Android player endpoint, `fmt=json3`) into kind `transcript` (`x:yt:tr:<video>`), issue videos first, each video once (`meta.enriched`) | `YOUTUBE_KEY` optional | keyword search without a key |
| Petitions | `petitionsSweep`: `PETITION_SITES` (APH, Vic, QLD, NSW e-petitions) - list page anchors, then each petition's page for text, signatures and closing date; kind `petition`: one canonical row per petition (`meta.signatures` kept current with `json_set`) plus a daily snapshot `x:pet:<hash>:<day>`; `GET /social/petitions` ranks by 24h growth | nothing | change.org (bot-walled) |
| Substack | Source Registry method `substack` (`urls.substack`): `/feed` posts as `sig_thread` platform substack, `/api/v1/posts/<slug>` then `/api/v1/post/<id>/comments` for the threads; `GET /social/substack/search?q=` finds publications | nothing | - |
| TikTok | `GET /social/tiktok?url=` oEmbed for one post | nothing; Research API is approval-gated | profiles, search, comments (signed browser requests) |
| Threads, Facebook public pages and groups | none | Threads API is own-account only, keyword search needs `threads_keyword_search`; Facebook needs Page Public Content Access or the Meta Content Library | everything else - stated, not skipped |

`socialCron()` runs at most two-hourly from `handleScheduled`: ten Bluesky
terms by cursor (KV `bsky_q_cursor`), all Mastodon tags, thirty X timelines,
six videos' comments and captions, and the petitions once a day (KV
`petitions_last`); results in KV `social_last` feed the coverage table.
Sweeps are bridge jobs the console tails: sources `bluesky`, `mastodon`,
`youtube`, `petitions` run in the worker (`socialSweep()` dispatch in
`jobRunLocal`); an `x` job sent with `where:'worker'` (or `POST /social/sweep
{platform:'x'}`) runs the timelines there while the Mac keeps search. The
YouTube job with `sweepChannels` refreshes the listed channels first. Routes
under `/social/` are read-role for GETs, full for POSTs. The Signals view
grew Bluesky, Mastodon, YouTube and Substack tabs (same components), a
Petitions tab (growth table, Read now) and the Coverage tab (Probe), and the
X tab has **Read account timelines**. Harnesses in the session scratchpad:
`social-worker.mjs` (16 route and cron tests over the SQLite-backed D1),
`signals-browser.mjs` (7 browser tests).

## Sentiment by party, person, organisation and topic (Phase 3)

Every number is a sum over rows in D1 `sent_entities`, each pointing at the
archive item it came from; nothing is a model's impression of the whole.

- **The register.** D1 `entities(id, kind party|person|org|topic, name,
  aliases json, party, role, side client|opponent|neutral, ns, active,
  edited, source seed|mps|operator, note)`. `ENTITY_SEED` (98 rows: parties,
  federal leaders and ministers, shadow ministers, premiers and chief
  ministers, the clients and their spokespeople, their opponents,
  institutions and industry, and topics such as fuel tax credits, gas
  reservation, nuclear, 60-day dispensing) seeds it through
  `ensureSentiment()`; the seed refreshes rows with `edited=0` when its hash
  changes and never touches an edit. Aliases are plain words; plurals are
  implied and whole-word boundaries are enforced (`entityMatcher()`, cached
  five minutes). Bare surnames that are also words (Watt, Cook, Bowen, Ley,
  Constable, Waters, Taylor, Allan) are deliberately not aliases. `POST
  /entities/sync-mps` turns every sitting member and senator in `mps` into a
  person entity (`mp_<qid>`, alias their name, party from the register's
  label), updating only unedited rows. Routes: `GET /entities?kind=&q=&active=`
  (with 7-day mention counts), `GET /entities/test?text=` (which entities a
  sentence mentions, and its region), `POST /entities/add|update|delete`.
- **The first pass and the verdicts.** `sentimentRun(env, {limit, hours,
  platform, log})`: the newest unclassified rows of `SENT_KINDS` (news, the
  Signals threads and comments, Reddit, Meta comments, forums, transcripts)
  within `SENT_WINDOW_H` = 72h (`SENT_SCAN` = 400 looked at), matched with the
  register; rows mentioning nothing are marked in `sent_items` with model
  `none` so they are never looked at again; the rest are ordered by client
  issue tags, client mentions and engagement, and the top `SENT_PER_TICK` =
  80 go to Claude in batches of `SENT_BATCH` = 20 (`sentClassify`, model
  `SENTIMENT_MODEL` or Opus 5.5 (`claude-opus-5-5`) by the operator's choice, one retry on
  invalid JSON). For each text
  and each entity mentioned the model returns stance -1/0/1, intensity 1-3,
  sarcasm and a twelve-word `why`; for the text an overall tone -1..1 and a
  type news/opinion/question. Writes: `sent_items(item, kind, platform, src,
  ts, tone, texttype, region, issues, entities, model)`, `sent_entities(item,
  entity, stance, intensity, sarcasm, why, ts, platform, region, kind)`, and
  the archive row's `tone` is replaced by the model's (rounded), so every
  view that reads tone improves. `regionOf()` takes the source registry's
  `juris`, else the subreddit, else place names in the text; `platformOf()`
  maps kinds to channels. Spend: KV `sent_calls_<day>` against
  `SENTIMENT_DAILY_CALLS` (default 300); a run stops with a message when it
  is reached. `sentimentCron()` runs every tick within the budget; `POST
  /sentiment/run {limit,hours,platform}` is a bridge job (`sentiment`,
  worker-side) the console tails - but a job the worker runs after an HTTP
  response lives about 30 seconds and one Sonnet call on twenty texts can
  take longer, so **Classify now** in the app does not use it: it loops
  `POST /sentiment/step {limit<=20}` (one Claude call, synchronously, inside
  the request; returns the run's counts, its log lines and the remaining
  `backlog`) up to five times and stops when nothing waits; **Classify all
  waiting** loops it until the backlog is empty, the budget or the account
  limit is hit, or Stop is pressed. The tick still does the routine work.
- **The sums.** `GET /sentiment/entities?days=&platform=&region=&issue=&kind=`
  (per entity: mentions, net stance -1..1, critical and supportive counts,
  sarcasm, intensity, change against the previous window of the same length,
  by platform, by region), `/sentiment/series?entity=&days=&bucket=day|hour`
  (an entity's stance over time, or the whole conversation's tone, optionally
  by issue), `/sentiment/topics?days=` (tone by client issue through
  `json_each(issues)`, with the entities named inside), `/sentiment/items?
  entity=&stance=&issue=&platform=&region=&days=` (the evidence rows: the
  deciding phrase, the excerpt, the link), `/sentiment/status` (judged 24h
  and 7d, rows marked as mentioning nothing, the backlog of matched rows
  waiting, budget, model, register size). All read-role; writes full.
- **In-app.** The Sentiment view (`docs/sentiment.js`, `#v-sentiment`): the
  strip (stances this week, critical and supportive shares, judged 24h, the
  backlog, today's budget and model), filters (window, channel, region,
  client issue, kind), the leaderboard (net-stance bar, shares, change vs the
  previous window, channel mix; headers sort), the topic table, a drawer per
  entity (facts, a volume-and-stance chart, by channel and region, and the
  rows behind the numbers with stance chips and the deciding phrase), a
  drawer per topic, **Classify now** with the console, and the **Entity
  register** panel (add, edit aliases, switch off, delete, test a sentence,
  sync MPs). Australian Eastern time. Harnesses in the session scratchpad:
  `sentiment-worker.mjs` (15 route and cron tests with a stub Claude),
  `sentiment-browser.mjs` (9 browser tests).

## Narratives: the stories the conversation keeps telling (Phase 4)

A narrative is a cluster of rows, across every channel, that say the same
thing in different words. Everything known about one is a count over its
rows (D1 `narrative_items`, each pointing at the archive item), so origin,
spread, pace and split are all traceable to posts; only the name is Claude's.

- **Placement.** `narrativesRun(env, {hours, scan, log})`: the oldest
  unplaced rows of `SENT_KINDS` within `NARR_WINDOW_H` = 72h (`NARR_SCAN` =
  300 a run) are embedded with Workers AI (`NARR_EMBED`, bge-base, 768 dims).
  A row joins the live narrative whose centroid is closest when the cosine
  is >= `NARR_SIM` = 0.84 and they share a **leading** issue (one of the
  three its rows name most, `issue_counts`) or an entity, or >=
  `NARR_SIM_STRICT` = 0.91 regardless (bge-base scores the same story across
  outlets about 0.84-0.93 and unrelated political headlines 0.70-0.83; the vars
  `NARRATIVE_SIM` / `NARRATIVE_SIM_STRICT` override). Three guards stop a
  narrative drifting into "politics in general": the centroid freezes after
  `NARR_FREEZE` = 20 rows; past `NARR_BIG` = 60 rows the bar rises by 0.03;
  at `narrMax(env)` rows (var `NARRATIVE_MAX_ROWS`, default 600 - a huge
  story can legitimately run to hundreds of rows) it is a topic, not a
  narrative - status `broad`, takes no more rows, hidden from the list and
  never named. `POST
  /narratives/reset {broad:true}` (full; the **Dissolve broad clusters**
  button) frees such clusters' rows to be placed again; `{all:true,
  confirm:'reset'}` clears everything. The candidates are the narratives
  active within `NARR_LIVE_H` = 96h with two or more rows and under
  `NARR_MAX`, plus singletons started in the last day, at most 1500 (largest
  and latest first). The cron makes several passes while its eight minutes
  last, so a backlog clears in hours. A row
  that joins nothing **starts a narrative only if it is a story and carries
  an anchor** - a news item, thread or post that fires a client issue's
  **tight** Sentinel trigger (`CLIENT_ISSUES[].rx`, not the wide collection
  matcher) or names a register entity (a party, a politician, an
  organisation, a topic); a lone comment, or a row naming neither, is set
  aside (narrative `''`, counted as `unanchored`) rather than seeding noise.
  A wide-tag-only story may still join a narrative it resembles, but it
  cannot seed one, which is what keeps celebrity, crime, sport and weather
  news from becoming narratives of their own.
  Singletons that never grow are pruned after 48h and their rows freed.
  Without AI bound the run falls back to term vectors (`narrTokens`, stop
  list; thresholds 0.32 / 0.47). Rows under 20 characters are marked with
  narrative `''` so they are never looked at again. Every id list sent to D1
  is sliced under its 100-variable limit (naming, pruning). Centroids are stored as base64 Float32 (`f32b64`/`b64f32`), term
  counts in `terms`. `narrRefresh(env, id, now)` recounts a touched narrative
  in seven batched queries: n / n24 / nprev; the channels in the order they
  first carried it (`spread`); the channels by volume (subreddit, outlet,
  page, YouTube channel); the loudest rows (score + 3 x comments); the
  sentiment split from `sent_items`; where it stands toward the client (mean
  stance of `sent_entities` rows on entities with `side='client'`: <= -0.25
  hostile, >= 0.25 supportive, else mixed; unknown under two judgments); the
  entities named. Status: new (< 3 rows), emerging (>= `NARR_ALERT_MIN` = 6
  rows within 48h of first sight), growing, steady, fading; velocity is n24 /
  nprev. **The run has a time budget** (`budgetMs`): the cron tick gets
  eight minutes; a run started from the app gets 22 seconds, because a job
  the worker runs after an HTTP response lives about 30 seconds. Placement
  always completes; recounting stops when the budget is nearly spent, naming
  is skipped or cut short (`deferred`, `namingDeferred`) and the next tick
  finishes the rest. `jobTail` marks a worker-side job that has written
  nothing for three minutes as `failed` with `worker_stopped`, so the console
  says what happened instead of spinning.
- **Naming, counters, alerts.** `narrLabel()` sends narratives with >=
  `NARR_LABEL_MIN` = 3 rows that are unnamed or have doubled since their last
  naming to Claude five at a time (`narrLabelBatch`, strict JSON: a label of
  at most twelve words as its proponents would put it, summary, claim,
  counter-claim, proponents, up to three issue ids, and a **relevance
  judgment**: `scope` client / politics / off, `relevance` 0-3 and a
  six-word `why`) - model `NARRATIVE_MODEL` || `SENTIMENT_MODEL` || Opus 5.5,
  budget KV `narr_calls_<day>` against `NARRATIVE_DAILY_CALLS` (default 120),
  one retry on invalid JSON; edited or muted narratives are never renamed,
  and the first issue's client becomes `ns`. `off` is for celebrity, sport,
  entertainment, ordinary crime, weather and foreign news with no Australian
  political actor, policy or economic stake; a politician, a minister, a
  regulator or a company that matters to the economy makes a story
  `politics` even when the event itself is a kidnapping or a court case.
  `client` needs at least one client issue (`narrLabelBatch` demotes a client
  verdict without issues to politics). Stored in `scope`, `relevance`,
  `scope_why`; narratives named before the judgment existed
  (`COALESCE(scope,'')=''`) are re-judged by the next naming pass. Off-topic
  narratives are hidden from the list by default and are never alerted.
  `narrCounters()` makes two narratives on the same top issue facing
  opposite ways each other's `counter`. `narrAlerts()` posts each emerging,
  named narrative on a client issue once to that client's Slack (`slackPost`,
  the `slack_webhooks` map, `_default` otherwise): label, client, where it was
  first seen, rows across channels, stance, the spread order, the origin link
  (`alerted` 1 sent, 2 no webhook). `narrativesCron()` runs every tick after
  the sentiment pass. Day buckets follow Sydney days (`auOffsetMs`).
- **Routes.** `GET /narratives?days=&issue=&ns=&platform=&status=&side=&q=
  &entity=&scope=&sort=velocity|n|new|latest&all=1&muted=1` (pinned first;
  singletons, broad clusters and `scope='off'` hidden unless `all`; `scope=`
  `client` shows client-issue narratives only, `politics` client and
  politics, `off` the hidden off-topic ones), `/narratives/one?id=` (summary, claim, counter-claim, the
  counter-narrative, the spread timeline, rows a day by channel, channels,
  amplifiers, top terms, every row newest first with fit and tone, the
  origin), `/narratives/status` (live, emerging, growing, named, alerts, rows
  placed today, backlog, budget, what is bound) - read-role. `POST
  /narratives/run {hours, scan}` (a bridge job, source `narratives`,
  worker-side, tailed by the console), `/narratives/update {id, label,
  summary, claim, counter_claim, issues, muted, pinned}` (a text edit sets
  `edited=1`, which stops renaming), `/narratives/merge {into, from}` (rows,
  terms and the weighted centroid move across; the other row is deleted) -
  full role.
- **In-app.** The Narratives view (`docs/narratives.js`, `#v-narratives`):
  the strip (live, emerging, growing, alerts sent, waiting, naming budget),
  filters (window, client issue, channel, status, stance, relevance - client
  issues / include politics / off-topic only, sort, search), the
  table (label with issues, client and proponents, `politics` or `off-topic`
  tags where the namer judged so; stance toward the client;
  rows; pace; the order the channels took it up; first seen; the split bar;
  status) and a drawer per narrative: the claim and counter-claim with a link
  to the counter-narrative, what changed (24h vs before, first seen, hostile
  and warm shares, channels), how it spread in Australian Eastern time, rows a
  day by channel, who carries it, the loudest rows, shared terms, every row
  with the origin marked, and for full keys Edit / Pin / Mute / Merge into.
  **Place and name now** runs the job with the console; **Name all waiting**
  loops `POST /narratives/step` (`{what:'recount'}` refreshes up to 60 stale
  narratives a step; `{what:'name'}` is one naming call of five, then counters
  and alerts; each answers `remaining`) until nothing waits, the budget or the
  account limit is hit, or Stop is pressed. Harnesses in the
  session scratchpad: `narratives-worker.mjs` (17 placement, naming,
  relevance, counter, alert, list, merge, fallback, budget, step and cron
  tests with a semantic stub embedding, a stub Claude and a Slack recorder),
  `narratives-browser.mjs` (10 browser tests).

## The interface (Phase 5): restraint, the front page, the scope, drill-down

The rule for every screen is the same three questions - what changed, why it
matters (which client, which issue), where the evidence is (a row that opens
the view holding it) - answered in tables, not cards.

- **The shell.** A flat token ground (`--x-bg1`), a small masthead with a
  plain readout, and one line of text navigation grouped Today / Signals /
  Clients / System (`.rgrp`, `.rbtn`, underline on the current view); panels
  are flat 8px surfaces with no glass, glow, hover lift or entrance
  animation; the islands' status colours are the semantic tokens (`--x-pos`,
  `--x-neg`, `--x-warn`, `--x-ac-hi`), never hex. Figures sit in one hairline
  strip (`.sen-strip`, `.src-stats`, `.kpis` share the rule) rather than a
  row of tiles, and the long note at the top of each view folds behind
  "About this view" (`.note-toggle`, added at load). Body text is 13px,
  numbers tabular mono, section labels small uppercase mono.
- **The front page** (`docs/overview.js`, mounted into `#overview-root` at
  the top of the Command view; the old ticker, attention radar, gauge and
  insight cards stay in the page hidden so their loaders keep working).
  `GET /overview?days=` (read-role; `overview()` in the worker) reads for one
  window: Sentinel alerts awaiting a response; narratives that gained rows
  (`moving`: rows today against the day before, stance, split, origin,
  status; `fading`); entities whose net stance moved most (`movers`, needs
  three judged mentions in both windows), the loudest, and the client-side
  entities spoken of critically (`hostileTo`); every client issue against its
  own fourteen-day baseline for the same window length (`overviewIssues`,
  `json_each` over `meta.issues`, ratio and a bar); the newest rows tagged
  with an issue (`overviewLatest`); collection health (sources delivering /
  dead / failing / untried, rows judged and placed today, the social
  platforms from KV `social_last`). Every part fails soft and is named in
  `errors`. In the island each row carries the client and issue and a link
  that opens the evidence.
- **Drill-down.** `AXUI.goto(view, params)` opens a view and hands it
  params; an island adopts them with `AXUI.useGoto(view, apply)` (at mount
  through `consume`, later through the `ax:goto` event). Narratives take
  `{id, issue, status, side, platform}`, Sentiment `{id, issue, platform,
  region}`; the front page uses both, and `go('sentinel')` for alerts.
- **The scope bar** (`docs/scope.js`, `#scope-root` under the navigation).
  `AXUI.scope()` / `setScope(patch)` / `useScope(apply)` keep one set of
  filters per browser (localStorage `ax_scope`: `ns`, `issue`, `entity`,
  `platform`, `days` with 0 meaning each view's own window, `region`) and
  fire `ax:scope`. Narratives adopt client, issue, channel, window and
  entity (`GET /narratives` gained `entity=`, a LIKE on the `entities`
  column); Sentiment adopts issue, channel, region and window and opens the
  entity's drawer; Signals adopts issue and window and switches to a channel
  that is one of its tabs; Sources adopts issue and region; the front page
  narrows its alerts, narratives, issues and rows to the client and issue
  and follows the window. The bar only sets; each island keeps its own
  finer controls. Legacy views (Newsroom, Pulse, Radar, Audience, Briefing)
  keep their own controls and do not read the scope yet.
- **Sources** opens on the delivering sources, most productive first
  (`status: 'ok'`, sort `items`); failing, dead, stale, untried and off are
  one quiet figure with a breakdown that filters to them, and the dead line
  is a sentence until asked.
- Harnesses in the session scratchpad: `overview-worker.mjs` (4),
  `overview-browser.mjs` (11, including the drill-downs), `scope-browser.mjs`
  (6); the sources (14), narratives (9), sentiment (9) and signals (7)
  browser harnesses run against the new shell. Not rebuilt in this phase:
  the legacy inline views (Newsroom, Pulse, Radar, Analyst, Briefing,
  Audience, Knowledge, Clients) inherit the shell and panel rules only.

## The Content Desk (copy for each client and platform, changed by instruction)

The `v-content` view (React island, `docs/content.js`) writes social and
digital copy in a client's own voice and is corrected by telling it what to
change. It writes from three memories, all namespaced to the client:

- **The voice profile** - the brand kit (KV `brand_<ns>`, `GET/POST
  /brand/kit`) grew a structured half, sanitised by `kitStructured()`:
  `campaigns[]` (id, name, url, signoff, cta, sourceLine, tone, structure,
  notes, active), `facts[]` (text, source, status approved|pending, campaign -
  **the only figures the Desk may quote** besides the brief and pasted
  source), `banned[]` (term, use, why, `allowNegated` so "not a subsidy" is
  fine), `platforms{}` notes per platform, `segments[]`, `people[]`,
  `approval`. Arrays sent replace the stored array; arrays left out are kept,
  so a palette edit in the Release Desk never wipes the words. The palette,
  fonts and logo stay where they were. `contentKitBlock()` turns it into the
  prompt block; the Release Desk composer now also carries the banned terms.
- **Approved examples in the Mind** - kind `copy` (the client's approved
  captions), `outcome` (WIN/LOSS), `brief` (the content guide), retrieved by
  `contentExemplars()` through `mindRetrieve(ns)` and preferred when their
  `source` names the campaign (`pack:<ns>:<campaign>:<platform>:<file>`).
- **Learned corrections** - `engineRules(env, ns, 'copy')`, the same
  `engine_fixes` the Release Desk uses.

`POST /content/generate {ns,campaign,segment,platforms[],brief,source:{kind:
'text'|'release'|'topic',text,id},n,instructions}` (full role) creates a
bridge job (source `content`, worker-side) and runs `contentBuild()` after the
response: `contentCompose()` is one Claude call writing `n` pieces per platform
against `CONTENT_PLATFORMS` (label, max chars, hashtag policy, register, title
or script) and the client's own platform notes, strict JSON, then every piece
is normalised and checked - `contentItemCheck()` flags `unverified_figure`
(`contentNumberCheck`: digits not in the facts, brief or source; years and
single digits ignored), `banned_term` (`contentBannedCheck`, negation-aware),
`over_limit`, `too_many_hashtags`, `exclamation`. Flagged, never dropped. Rows
live in D1 `content_sets` (items, history). `GET /content/set?id=`,
`/content/list?ns=`, `/content/platforms` are read-role.

**Revise by instruction.** `POST /content/revise {id, n|null, instruction,
remember:'auto'|'always'|'never'}` has Claude edit the chosen piece (or all of
them) and classify the instruction: `memory.standing` is true for a preference
that should apply next time (a wording, a term, a tone, a format, an always or
a never), false for a one-off (this figure, this place). Standing instructions
(confidence >= 0.6 in `auto`, always in `always`, never in `never`) become an
`engine_fixes` row via `engineAddFix()` - task `copy`, scope `client`, source
`content:<id>`, rule pre-compiled from the model - so the next build obeys
them. The revision, its note and the rule id go into the set's `history`,
which is the chat thread the view shows. `POST /content/update` is a hand
edit (re-checked); `POST /content/verdict` records Approve/Kill through
`engineOutcome()` (surface `content`) and files WIN/LOSS exemplars.

In-app: a client header (logo, "Writing as", what the Desk knows - campaigns,
approved facts, corrections in force, examples in the Mind, or a warning when
no profile exists), campaign chips, platform chips, audience, pieces per
platform, a brief, optional pasted source or a release pack as the source,
the console, then the pieces grouped by platform (character meter, check
chips, Copy / Edit / Ask the Desk / Approve / Kill) beside the chat pane
(target: all pieces or one; remember mode; quick chips; each reply shows
"Remembered for <client>: <rule>" or "Applied to this set only"). The
**Voice profile** panel edits voice, rules, campaigns, facts and banned terms;
the **Learned** panel switches rules off. Harnesses in the session scratchpad:
`content-worker.mjs` (17 route tests through the handler with a fake D1 and a
stub Claude), `content-browser.mjs` (15 Playwright tests), `engine-ingest-
test.py` (16).

**Voice packs.** A client's profile is loaded in bulk with
`python3 tools/engine-ingest.py <pack> --ns <ns> --key $AXIOM_KEY`: the tool
now recognises `brand-kit.json` (-> `/brand/kit`, ns forced, logo fields
dropped), `fixes.json` (-> one `/engine/fix` each, skipping rules already in
force so re-runs only add), and `.md` files with a frontmatter block (`kind:`,
`title:`, `campaign:`, `platform:` -> `/mind/ingest` with that kind and a
`pack:` source tag). The kit goes first, then the rules, then the documents.
The MCA pack (distilled in September 2026 from the approved content calendars
in Drive - national, Phase 1.5, Victoria, Hands Off Our Fuel, myth busting -
the strategy documents, and the #minerals-council Slack threads where Dee,
Tania, Steve, Stef and Laura briefed the writers and designers) holds the
voice, 8 campaigns, 37 facts, 14 banned terms, 24 of Dee's corrections as
rules, 9 exemplar files and a content guide. **Voice packs are confidential
client material and never enter the repo**: they are handed over as files
and loaded straight into the Mind.

## The Release Desk (a media release in, a pack of social tiles out)

The `v-release` view (React island, `docs/release.js`, shared pieces in
`docs/ax-ui.js`) is the rapid-response desk clients like MCA will use daily:
paste a release, pick the client, press Build. `POST /release/pack
{ns,text,tiles,format,brief}` creates a bridge job and runs `releaseBuild()`
after the response - `releaseExtract()` (Claude: headline, spokesperson,
claims, numbers, quotes, asks, risks, strict JSON) then `releaseCompose()`
(Claude as creative director with the client voice from the brand kit, the
Client Central brief, and the playbook retrieved from the Mind) - narrating
every step into the job log the view tails with `AXUI.tailJob`. Tiles carry
`kind` (lead, stat, people, proof, warning, quote, cta), headline/support/cta,
captions for LinkedIn, X and Facebook, alt text and art direction. **Every
figure on a tile is checked back against the release text**
(`relNumberCheck`) and flagged amber if it is not there - flagged, never
silently dropped. The release itself is archived as kind `release` with the
pack id and the author (provenance).

Rendering is one tile per request - `POST /release/render {id,n,patch}` -
so each stays inside worker limits and the grid fills in as it goes; the view
auto-renders in order and can be stopped. `releasePrompt()` bakes the exact
copy, the brand palette and fonts, a kind-specific art direction, and places
the client logo (attached as a reference) bottom-right. Images live in R2
(`packs/<id>/<n>.png`, served by `GET /release/tile?id=&n=` behind the key -
the island fetches them with the key and shows blob URLs, never a bare
`<img src>`). `POST /release/update` edits copy and captions without
spending a render. `GET /release/pack?id=`, `GET /release/list?ns=`.

**Brand kit**, one per client, set once: `GET/POST /brand/kit?ns=` (name,
palette primary/secondary/bg/text, display and body fonts, voice, standing
rules) in KV `brand_<ns>`; the logo (PNG/JPEG/WebP, 2 MB cap) in R2
`brand/<ns>/logo`, served by `GET /brand/logo?ns=`. The panel prefills from
Client Central (accent colours, the client brief as the voice).

**Open in canvas** hands a rendered tile to Ad Lab: `alSeedFromDesk()` in
`index.html` switches client, sets the art as the canvas base, the copy as
editable layers (overlay mode) and the kit logo, then opens the canvas.
`nanoRender()` is the image engine factored out of `POST /nano` (unchanged for
Ad Lab and Studio). Roles: viewing packs and kits is read-role; building,
rendering and editing the kit are full. Harnesses: `release-worker.js` (34
route tests), `release.js` (26 browser tests).

## The Reddit signal (the first React island)

`REDDIT_POLITICS` in the worker names the subs we watch - national politics
and money (AustralianPolitics, australia, AusPol, AusFinance, AusEcon,
auscorp), the state and city subs where planning, power bills, mining towns
and pharmacies come up (melbourne, perth, brisbane, sydney - not r/victoria,
which is Victoria, British Columbia), and the
trades (AusPropertyChat, AusRenovation, ausjdocs). `redditSweep()` runs two
passes: every thread on hot and top-of-day (one multi-subreddit listing per
sort, paced), then a **keyword pass** - `redditSearch()` runs the client search
terms (`CLIENT_ISSUES[].q`, ~70 of them) across all of Reddit so the argument
is found wherever it happens, with `meta.q` recording the term that found the
thread. Threads are filed as kind `reddit_thread` (url = permalink) tagged
with `issueTag()`, then the comment trees of the threads that matter most
(issue breadth first, then a keyword hit, then comment count) are flattened
into kind `reddit_comment` (url `x:rcmt:<id>`) with tone from the colloquial
lexicon; a comment carries its own tags **and** the thread's.
**Usernames are never stored.** `redditCron()` runs it at most 3-hourly.
Access: with secrets `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (a Reddit
"script" app) `redditGet()` uses application-only OAuth on `oauth.reddit.com`
(token cached in KV, 60 req/min); without them it reads anonymously through
`api.reddit.com`, `old.reddit.com` and `www.reddit.com` in turn at ~10/min,
which Reddit often refuses from cloud networks. `GET /reddit/status?probe=1`
walks credentials, token and one listing live and names the failing step;
the in-app sweep result quotes Reddit's errors and offers the probe.

**The desktop bridge (agent-reach).** Reddit closed self-service API
registration in late 2025 and refuses anonymous reads from cloud networks, so
the reliable collector runs where a logged-in session exists:
`python3 tools/reach-reddit.py --key $AXIOM_KEY` on a Mac with agent-reach's
`rdt` (`rdt login`, or a cookie file) sweeps the same subs and runs the same
keyword pass through `rdt sub|search|read ... --json`, pulling the live
lexicon from `GET /reddit/issues` first so its tags can never drift, writes
rows in exactly the
worker's shape (kinds `reddit_thread` / `reddit_comment`, `meta.via: reach`,
no usernames) and pushes them through `/archive/add` with a before/after
count. `--out rows.json --dry-run` produces a file for the in-app Load data
button; `--issue pharmacy,activism` (issue ids or client namespaces) narrows
the keyword pass, `--queries off` skips it, `--time month` widens the search
window; `--install-launchd` schedules it 3-hourly via a LaunchAgent that runs
`zsh -lc` so `$AXIOM_KEY` comes from `~/.zshrc` and never touches the plist.
The same pattern now carries X as well: `tools/reach-agent.py` is the always-on
version - it claims Sweep jobs from the portal and runs whichever collector the
job names (`reach-reddit.py`, `reach-x.py`), streaming its commands and answers
into the Signals console. `--install-launchd` keeps it connected.
Routes under `/reddit/` (gated; GETs read-role unless `live=1`): `issues`,
`threads?sub=&days=&issue=&q=` (with tone of held comments per thread),
`comments?thread=<id>[&live=1]`, `status`, POST `sweep`, POST `analyse
{threads|sub|issue,days,ns}` (Claude: themes, attack and support lines, risks,
openings, ready replies; logged to `mind_runs` mode `reddit`) and POST `mind
{threads,ns,title}` which builds a digest of the chosen threads plus their top
comments and files it in the Mind through `mindIngestDoc()` - the module-level
twin of `/mind/ingest`, usable from any server-side code.

In-app: Reddit is the first tab of the Signals view, built with **React as an
island**: `docs/signals.js` mounts `SignalsApp` into `#signals-root` on first open, using
`htm` for JSX-shaped templates with no build step. React, ReactDOM and htm are
vendored under `docs/vendor/` (never a CDN). New sections should follow this
pattern - a component file under `docs/`, a `<section class="view">` shell in
`index.html`, `go()` title + init hook - rather than growing the inline script.
Components read `AX_ISSUES`, `CC_CLIENTS`, `csBase()`, `axHeaders()`,
`axScrub()` and `toast()` from the page. Harnesses: `signals.js` (browser) and
`reddit-worker.js` (routes driven through the handler with stubbed Reddit, D1,
KV, AI and Vectorize).

## Meta, direct (no third party)

Worker secrets `META_TOKEN` (Business System User token, ads_read +
read_insights) and text var `META_AD_ACCOUNTS` (`act_123:mca,act_456:aep`)
turn on `metaInsights()`: campaign-level daily rows (spend, reach, clicks,
CTR/CPC/CPM, leads, CPL) into archive kind `campaign`, src `meta`, deduped
per campaign-day. Optional `META_USER_TOKEN` (an ID-verified user's token,
~60-day expiry) turns on `metaAdLibrary()`: AU political/issue ads matching
each `CLIENT_ISSUES` label into kind `oppads`, src `meta`, with funder,
spend band and snapshot URL.

Audience sentiment, straight from Meta, needs `pages_read_engagement` +
`pages_read_user_content` on `META_TOKEN`. `metaAdPosts()` resolves the
distinct page posts behind each account's active/paused ads, then
`metaComments()` files each comment as kind `comments` (tone from the
colloquial lexicon; author names never stored) and `metaReactions()` files
one row per post per day as kind `reactions` with the full mix - like, love,
care, wow, haha, sad, angry - plus comments, shares and a score:
`(like+love+care - angry - haha) / total`, so +1 is unanimous agreement and
-1 unanimous hostility. Haha counts against because on political advertising
it reads as mockery; wow and sad are ambiguous and stay out of the score.
`/perf/comments` returns those aggregates under `reactions` and the Audience
Comments tab renders the mix and the posts drawing anger.

`metaCron()` runs all four at most 6-hourly; GET `/meta/status` (read) and
POST `/meta/sync {since,until,postsPerAccount}` (full) for inspection and
history backfill (chunk by month). `GET /meta/status?probe=1` walks the whole
chain live - token valid, ads_read, pages_read_engagement,
pages_read_user_content - and names the first step that fails, which is the
fastest way to debug a System User token.

## Access roles

Two optional worker secrets. `AXIOM_ACCESS_KEY` is a single full-access key.
`AXIOM_KEYS` is JSON of per-person keys:
`{"key1":{"n":"Heshan","r":"full"},"key2":{"n":"Steve","r":"read"}}`.
`read` may only hit read routes (`/mind/query`, `/mind/docs`,
`/archive/search`, `/sentinel/alerts`, `/sentinel/metrics`, `/session/load`);
writes return 403. The app hides mutating buttons for read-only keys.

## Security & org knowledge (Curious Minds = namespace `cmm`)

- Access control: the `AXIOM_ACCESS_KEY` worker secret gates /mind/*,
  /session/*, /log/*, /archive/search and /archive/add via the `X-Axiom-Key`
  header (open until the secret is set). `/archive/stats` stays public by
  design: aggregate counts only, so the map shows presence of knowledge
  without revealing content. The app sends the key from Settings -> Access key.
- Confidential material NEVER goes into the git vault (`knowledge/` is in the
  repo). It goes straight to the Mind (`/mind/ingest`, key-gated, R2/D1/
  Vectorize) under the owning client's namespace; the vault may hold only a
  provenance stub. Client namespaces are isolated: retrieval sees the client's
  own namespace plus `cmm`, never another client's.
- Org ingestion paths: Google Drive / Slack via this session's MCP connectors
  (operator names folders/channels; distill -> vault note or direct Mind
  ingest per confidentiality); file uploads via Ad Lab/Studio in-app; email
  as exports dropped into Drive.
- Historical series: `python3 tools/backfill.py gdelt|wiki|aec|polls|all`
  loads multi-year history (GDELT issue volume/tone, Wikipedia attention,
  AEC results CSVs, polling CSVs) into the archive as `hist_*` kinds via the
  key-gated `/archive/add`. Re-runs are safe (url-deduped).

## Working conventions

- Verify frontend changes with the Playwright harnesses in the session
  scratchpad when present; never break the Studio/Ad Lab conversation flows.
- Worker secrets (ANTHROPIC_API_KEY, GEMINI_KEY, CLICKUP_TOKEN, …) exist only
  in Cloudflare — never in the repo.
- Ship flow: commit on `claude/…` branch → push → fast-forward merge to
  `main` (GitHub Pages serves `main` **/docs**). The worker ships from the
  laptop with `tools/deploy-worker.sh` (checks syntax and ASCII, reads the
  live settings through the Workers API, uploads the module with
  `keep_bindings` for every binding type plus secrets and vars, proves the
  new code answers on `/engine/status`; auth from the `wrangler login`
  session or `CLOUDFLARE_API_TOKEN`). Never `wrangler deploy` from the repo
  root: `wrangler.toml` is a template whose Mind bindings are placeholders,
  so that would detach D1/Vectorize/AI/R2 from the live worker. Secrets:
  `npx wrangler secret put NAME --name newsaus`.
