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
  has a vision model (`engineDescribe`: `GEMINI_MODEL` if set, else
  gemini-3.6-flash, then gemini-2.5-flash) catalogue a past
  creative - layout, palette, typography, every word on it, tags - stores the
  image in R2 `art/<ns>/<id>` (served by `GET /engine/art?id=`), files the
  description in the Mind as kind `artwork`, and records it in `engine_art`.
  `GET /engine/artworks?ns=` lists them. **The image is kept even when the
  describer fails** (quota, key, outage): the row's description starts
  `[not yet described]` with the reason, the answer carries a `warning`, and
  `POST /engine/artwork/describe {id}` (one) or `{ns, limit}` (the undescribed
  ones, newest first, with `remaining`) fills the descriptions in later.
  `mindNs` on the upload sends the Mind document to a shelf of the client
  namespace (`mca_creative`); the image itself stays under `art/<ns>/`.
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
  **Place and name now** runs the job with the console; **Finish all waiting
  (N)** loops `POST /narratives/step` (`{what:'place', scan}` is one
  synchronous placement pass of up to 200 rows with a 20-second budget and
  naming skipped, answering the `remaining` backlog; `{what:'recount'}`
  refreshes up to 60 stale narratives a step; `{what:'name'}` is one naming
  call of five, then counters and alerts; each answers `remaining`) until
  nothing waits, the budget or the account limit is hit, or Stop is pressed.
  The same three loops run from a Mac in `tools/daily-brief.py` (below).
  Harnesses in the session scratchpad: `narratives-worker.mjs` (18
  placement, naming, relevance, counter, alert, list, merge, fallback,
  budget, step and cron tests with a semantic stub embedding, a stub Claude
  and a Slack recorder), `narratives-browser.mjs` (10 browser tests).

## The daily brief (the day, written once, for the person presenting it)

`briefWrite(env, {days, mind, by, log})` reads what the modules keep for one
window - `overview()` (alerts, narratives moving, movers, issues against
their fourteen-day baseline, the newest headlines, collection), the largest
narratives with their claim, counter-claim and proponents, the stance
leaderboard and tone by issue - and renders it as evidence in which every
row carries an id (`[A:]` alert, `[N:]` narrative, `[E:]` entity, `[I:]`
issue, `[L:]` headline). Claude (`BRIEF_MODEL` || `NARRATIVE_MODEL` ||
`SENTIMENT_MODEL` || Opus 5.5; `BRIEF_SYS`; one retry on invalid JSON, none
on an account spend-limit answer) writes strict JSON: headline, summary,
`changed[]` (what, why, evidence), `clients[]` (ns, read, watch, risks,
openings, actions, evidence - every client namespace, most change first),
`narratives[]`, `sentiment[]`, risks, actions, gaps. `briefClean()` bounds
it and ties it back: narrative and entity ids the evidence never gave are
dropped, labels, counts and client names come from the data, never the
model. The record (`{day, at, hours, model, brief, stats, by, md}`) is
stored in KV `brief_<YYYY-MM-DD>` (Sydney days via `auDayKey()`, kept 120
days), `briefMarkdown()` renders it as a document, and it is filed in the
Mind as kind `brief_daily` under `cmm` unless `mind:false`. `briefCron()`
runs every tick and writes the day's brief once after 7am Sydney when none
exists; a rewrite on demand is the right move after the queues are drained.

Routes: `GET /brief/daily?day=&format=json|md` (the day's brief, the latest
when `day` is left out; `md` serves `text/markdown`), `GET /brief/list`
(days held) - read role; `POST /brief/daily {days, mind}` writes today's
inside the request, a minute or two - full role. In-app: the panel at the
top of the front page (`Brief` in `docs/overview.js`): headline, summary,
what changed with evidence chips that open the view holding the evidence,
by client (read, watch, risks, openings, actions), narratives to watch,
stances that moved, risks, actions, gaps; Copy, Download .md, Fold, and for
full keys **Write / Rewrite today's brief**.

**Closing the day from a Mac:** `python3 tools/daily-brief.py --key
$AXIOM_KEY` drains the sentiment queue (`/sentiment/step` until the backlog
is empty), places, recounts and names every waiting narrative
(`/narratives/step` place / recount / name), then writes today's brief and
saves it as `briefs/brief-<day>.md`, `.html` (a standalone page, print it
for a PDF) and `.json`. `--skip-queue` writes only, `--only sentiment|
narratives|brief` runs one part, `--days`, `--out`, `--no-mind`. Each loop
stops on its own when nothing waits, when the worker's daily Claude budget
is spent, or when the Anthropic account's spend limit answers, and says
which. The `briefs/` folder is gitignored: a brief is client intelligence.
Harnesses: the brief cases in `overview-worker.mjs` (8) and
`overview-browser.mjs` (12).

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

## The Creative Studio (one client-aware workspace; Phases 0-4 built)

The approved proposal (`CREATIVE-STUDIO.md`) consolidates the Release Desk,
the Content Desk and the Client Central Studio into one feature. Phase 0
was the clickable prototype; **Phase 1 is the durable ground** in the worker
behind `/studio/*` (`ensureStudio`, build id `AXIOM_BUILD`, also returned by
`/engine/status` so the deploy script proves the release); **Phase 2 is the
production journey on it**, and `docs/studio.js` now runs on the worker, not
on synthetic data. Phase 2, in short (details in `CREATIVE-STUDIO.md` s.9):

- **Models by role, checked not assumed.** `stModel(env, role)`:
  `CREATIVE_MODEL` (default `claude-opus-5-5`) for directions and copy,
  `EXTRACT_MODEL` (default `claude-sonnet-5-5`) for the ledger. `stClaude()`
  sends 5.x models `thinking: {type:'adaptive'}` and `output_config.effort`
  (`STUDIO_EFFORT`, default medium / low for extraction) and repeats the call
  plain on a 400 that names those fields. Every call counts against
  `STUDIO_DAILY_CALLS` (default 200; KV `studio_calls_<day>`, `stBudget`,
  `GET /studio/budget`, also on `/studio/status`); an exhausted budget, an
  account spend limit, a refusal or a missing key fail the stage with the
  reason and are not retried (`(not retried)` in the message stops
  `stTransient`). Live reachability is still `GET /studio/models`.
- **Stages** (`stStageRun`, dispatched from `stJobRun`; each writes its log
  lines into the job's `progress.lines`): `extract {source}` builds the claim
  ledger on `studio_sources.claims` (`stExtractLocal` rule pass: every figure
  with unit and sentence, every quotation with speaker; the model pass is
  verified by `stLedgerVerify` against the passages and merged by
  `stLedgerMerge`; rows the source does not carry stay, marked
  `verified:false`; a brief is proposed into empty fields with the
  assumption recorded, `brief.proposed`); `direct {n, instruction}` records
  2-3 directions in `studio_directions` (unknown claim ids dropped,
  near-duplicates flagged `similar`, status -> `directions`); `copy
  {channels, formats, deliverable copy|visual|set, template, instruction,
  direction, render}` writes one piece per channel from the chosen direction,
  the brief, the ledger, the source excerpt and the client context, creates
  one asset per channel (mode `copy` or `composition` with `stLayout`), runs
  `stChecks`, and for a set queues one `render` job per asset (idem
  `render:<asset>:<version>`, prompt from `stArtPrompt`: no text, no logos,
  the panel area kept quiet); `export {assets}` takes exactly the versions
  whose approvals stand (copy for copy-only, copy and design otherwise),
  writes `studio/<project>/export/<id>.json` and `.txt` (the copy sheet) to
  R2, references the browser's PNG from `POST /studio/render/save {asset,
  version, imageB64}` (`studio/<p>/<a>/<v>-export.png`), and sends nothing.
- **The client context** (`stContext`): `contentKitBlock` + shelf examples
  (`contentExemplars`, creative shelf) + `engineRules` for `copy` and
  `tiles`, one client only; the snapshot (kit revision, rule ids, facts,
  examples, models) is stored in every version's `context`. `GET
  /studio/context?project=` (`stContextView`) itemises it for the view.
- **Checks** (`stChecks`, deterministic, advisory): per figure `matches`
  (ledger value and unit, with passage and period), `differs` (unit or value,
  with what the source says), `fact` (in the approved facts or brief, not a
  passage), `unsupported`; quotations verbatim or `unsupported`; `banned`
  (negation-aware); `over_limit`, `too_many_hashtags`, `exclamation`; and
  fit (`stFit` over the layout's text layers: `overflow`, `small_type`,
  `logo_size`). `stVersionChecks` recomputes them on every `/studio/version`
  and `/studio/asset` write. The label is never "verified".
- **Layouts** (`stLayout`): the Ad Lab layer model in per cent of the stage -
  a panel (`stTemplateFor`: teal for HOOF, gold for the national campaign,
  plain, or `kit` = the palette primary), headline, support, CTA, and the
  logo as an exact `img` layer `/brand/logo?ns=` when the kit has one;
  `layout.stage` is the format's pixel size, `layout.fonts` the kit fonts
  with the app fallbacks. **`docs/studio-render.js` is the one renderer**
  (`STRender.render/toBlob/zip`): the preview canvas and the export PNG are
  the same drawing at different widths.
- **In-app** (`docs/studio.js`): library from `/studio/list` with the build
  chip; intake (release + optional instruction, brief or one line, reference
  image; campaign from the kit; channels and deliverable stored on the
  brief); a clear instruction goes straight to `copy`, an open brief to
  `direct`; the browser steps every job (`runJob`) and pumps queued renders
  while the tab is open; brief, sources (ledger with passages and
  `unverified` chips, add and extract), references (upload), directions
  (choose -> production), client context, jobs (log lines, retry, run now,
  cancel); the asset view draws the composition, hand edits become versions
  (debounced, `no render`), headline smaller/larger is a layout version,
  Re-render is announced first, checks and approvals come from the server;
  export draws each approved composition at native size, saves it, runs the
  export stage and downloads a zip (`STRender.zip`); ClickUp is a separate
  confirmed dialog; the composer records a **note** (`POST /studio/note`) and
  records a team note when asked to. Harnesses:
  `tests/studio-p2-worker.mjs` (11), `tests/studio-browser.mjs` (the page
  against the worker module in-process).

**Phase 3, direction by instruction** (`stReviseStage`, stage `revise
{target asset|family|set, asset, instruction}`): one creative-model call
reads the direction against the assets in scope (their copy, locks, layout
and background note), the ledger and the client context, and decides what
it asks for - `text` (versions with the new fields, locked fields kept and
named, checks recomputed, no render), `layout` (headline size as a layout
version), `alternatives` (two to four options for one field, each with its
checks, offered on the thread and applied only when chosen through
`/studio/version`), `render` (a `proposal` event with the art direction and
steps; `POST /studio/proposal {project, eid, decision do|decline}` queues
one render job per asset by idempotent key `render:<eid>:<asset>` or
records the decline; a second answer is 409), `adapt` (new assets in the
family for the channels and formats named, the model's adapted copy,
`stLayout` per format, the source image reused, locks carried, no render)
or `question`. An ambiguous pronoun aimed at the whole set is asked about
before any model call. A standing preference (`memory.standing`, confidence
>= 0.6) rides on the event as `offer {rule, scope, campaign, task}` and is
never saved alone: `POST /studio/remember {project, eid, scope campaign|
client|none, rule, task}` writes an `engine_fixes` row through
`engineAddFix` with the model's wording (a campaign preference carries
`:campaign:<id>` in its `source`; `engineRules(env, ns, task, limit,
{campaign})` and `stContext` read such a rule only for that campaign, and
the Content Desk passes its set's campaign) or records `offer_declined`.
Every event carries `eid`, `instruction`, `model` and `job`. Approve and
reject on `/studio/approve` also file WIN / LOSS exemplars through
`engineOutcome` (surface `studio`). The Studio's checks now treat the kit's
approved facts as claims of their own (`opts.facts`), so a wrong unit
against a fact is `differs`, not `approved fact`. In-app, the creative
partner panel sends directions (target select), renders alternatives as
chips, proposals with Do this / Not that, offers with editable wording and
Campaign preference / Lasting client rule / Don't save, and "record as a
note instead" for plain notes. Harness: `tests/studio-p3-worker.mjs` (10).

**Phase 4, one island.** The Release Desk and the Content Desk nav buttons
and mobile tabs are gone; `go('release')` and `go('content')` open the
Studio's intake through `AXUI.goto('studio', {intake, deliverable, from})`
(release preset, or brief + copy-only), the Sentinel's **Draft in Studio**
does the same with the alert as the brief and the client set, and the
Client Central Creative Studio tab is the Studio view. The island adopts
these with `useGoto('studio')` (the intake remounts on each preset). The
**Client panel** (header link "client", the context view) opens the voice
profile editor - `content.js` exposes `window.AX_CONTENT = {VoicePanel,
LearnedPanel}` and the Studio reuses `VoicePanel` - and a Learned table of
every rule for the client with its scope (campaign, client, every client),
switch off and delete through `/engine/fix/update|delete`. The **layout
editor** (`LayoutEditor`, "Edit layout" on a composition whose layout is
not locked) overlays the layers on the same renderer: drag to move, the
corner to resize (text scales with its box), arrow keys nudge the focused
layer; Save writes a layout version, no render. **KV sessions** (Ad Lab
and the old Studio, `imgsess_<id>`) that recorded a client list as legacy
rows `ks:<id>` (`stSessions`), open read-only with each saved artwork as a
flattened `generated` asset (`stSessionGet`; `/session/img?raw=1` serves
the bytes) and import once with the images copied into R2 so the project
outlives the session's thirty days; a session without images answers
`no_images`. The mobile tab bar scrolls sideways instead of clipping.
`tools/studio-golden.py <folder> --key` re-runs a folder of golden cases
(client material, outside the repo) through the live Studio with renders
off and diffs copy, checks and context counts against the baseline
(`--accept` writes it; exit 1 on any difference). Harnesses: the browser
harness (14, entry points, layout editor, Client panel) and the session
case in `studio-p3-worker.mjs`. The Release Desk and Content Desk sections
and scripts stay in the page (their routes keep answering) but have no
entry point of their own.

**Art direction (the re-render area as an art director).** Stage `concepts
{asset, feedback, refine:{eid,index}}` (`stConceptsStage`): one
creative-model call sees the artwork itself - the background image goes to
the model as an image block when it is on file under 4.5 MB (`stClaude`
takes `images`) - with the words on it, the layout, the locks, the brief,
the campaign, the palette and fonts, the references, the ledger and the
client context, plus the team's feedback ("Come up with a better creative"
by default), and answers a critique and three or four distinct directions.
Each is normalised into a card: name, concept, rationale, imagery,
composition, typography, colour, text placement, keeps and changes,
`basis[]` tagged `rule` / `preference` / `inferred`, `missing[]`,
`needsImage` with a tailored photograph prompt, `cost` ("layout only, no
render" or "1 render at 2K plus a layout version"), and a full `layout`
document built deterministically by `stLayoutVariant` from the direction's
`layoutWant` (`style` same / large / compact / translucent / none (dark
overlay, no box) / gradient / split, `placement` top / middle / bottom,
`template`, `headline` larger / smaller) so the browser previews every card
on the current photograph with the same renderer; locked or hidden layers
of the current layout carry over by role. `stLayout` grew `opts.style /
placement / headlineDelta`, overlay layers (`role: 'overlay'`, `gradient`)
and `radius: 0` for the split field, and `layout.image {x,y,w,h}` for a
split (the photograph is cover-cropped into the field the panel leaves free
so its focal point stays in view); the renderer skips `hidden` layers, draws
gradient shapes and clips the photograph to `layout.image` when set. The
event `concepts {eid, asset, version, feedback, critique, options,
imageSeen, model}` is the record (`stEvent` gives concepts, alternatives,
proposal and applied events room beyond the 4000-char note cap); `POST
/studio/concept/apply {project, eid, index, render}` (`stConceptApply`)
appends a layout version (the direction's headline only when not locked)
and queues one render job (`render:<eid>:<i>:<asset>`) only when the
direction needs a photograph and `render` is true; a locked layout is 409;
the event `applied` names the version. `stArtPrompt` now grounds every
photograph in the words on the tile and forbids unrelated scenes (sport,
skate, leisure, lifestyle stock, crowds), which is what the skate-park tile
lacked. In-app the Background box is the **Art direction** area: the
feedback line, Propose directions, the critique, the cards (preview, basis
chips, cost chip, Apply layout only, Apply and render with the cost, Refine
which re-proposes from that card), a stale marker when the cards were
proposed against an earlier version, and the plain "re-render from a
description" link kept underneath. The layout editor lists every layer with
hide / show and lock / unlock (`layer.hidden`, `layer.locked`; a locked
layer does not drag and keeps its place through directions).
`tools/brand-logo.py <file> --ns mca --key` puts a client's logo into the
kit exactly as supplied. Harnesses: the art-direction case in
`studio-p3-worker.mjs` and in the browser harness.

**Design, not a template (build `studio-p6`; `CREATIVE-STUDIO.md` s.12).**
Every composition carries `layout.design`, a spec the models fill in and
`stLayoutFromSpec` draws: concept and objective; an image brief (`keep`, or
subject / setting / framing / lighting / mood / `focal`); `composition`
(`style` panel / translucent / none / gradient / split / typographic,
`zone` top / middle / bottom / left / right, `coverage` compact / standard /
large); `type` (`align`, a running headline `delta`); `panel` (`fill` teal /
gold / plain / kit / dark, `opacity`); `logo.corner` (br / bl / tr / tl /
panel); `cta.style` button / text. A gradient darkens from the zone edge
(`dir`), a split gives the photograph `layout.image` and the renderer crops
it there, a typography-led tile fills the stage with `layout.bg` and shows a
small photograph opposite the words; type scales with the column and steps
down until the stack fits, and boxes stay bounded by the zone so an
over-long headline is still flagged `overflow`. `stLayout` builds a spec
from its old arguments, so first production, adaptation and the variants
share the path; the copy stage accepts a `design` per piece. `stArtPrompt`
takes the spec and describes the photograph for its composition
(`stQuietZone`: the quiet third, the half beside the words, or its own
region for a split), never a fixed lower third.
References reach the models: `studio_references.analysis` is a vision pass
(`stRefAnalyse`, the extraction model) at upload or on `POST
/studio/reference/analyse {id}` - summary, typography, colour palette and
relationships, hierarchy, composition, image treatment, panels, spacing,
logo, verbatim words, takeaways; a failure is stored as `{error}` and shown
as "not analysed" with a retry. `stRefBundle` ranks by purpose, attaches
the strongest as images beside the artwork, and states the purpose
semantics (brand and approved are constraints; an approved layout is an
example unless the note says mandatory; inspiration lends nothing exact);
`stArtMemory` adds the client's catalogued artwork (`engine_art`, that
client only). Concepts, revise, copy, direct and suggestions all receive
them; events record `refsUsed` and `unanalysed`.
The concepts stage returns a `design` per option (`summary` =
`stDescribeSpec`), `refs` and basis kind `reference`; options must differ
in composition and at least one keeps the photograph. `POST
/studio/concept/apply {eid, index, render, imageFrom}` applies one card's
layout with another card's photograph. The revise stage gained kind
`design` (`{assets, spec, image|null, steps, refs}`): the composition is
applied now as a layout version on the current image; an `image` becomes a
`proposal` (`design:true`, `spec`) confirmed through `/studio/proposal`,
whose render prompt follows the applied composition. `POST /studio/suggest
{asset, refresh}` (full role; `stSuggest`, the extraction model, cached in
KV `studio_sugg_<asset>` on version + references + last event) answers
three `design` and three `image` suggestions with `why` and `refs`. In-app:
cards show the spec summary, "Draws on" and a **Photograph from** select;
**Suggested next directions** beside the Creative Partner fill the composer
as editable text; **Suggested photographs** inside the re-render controls
fill its description; the References view shows each analysis or its
limitation with **Analyse now**. Harnesses: `tests/studio-p6-worker.mjs`
(8), the suggestions case in the browser harness (16), and
`tests/studio-variations-demo.mjs`, which draws five compositions of one
message to `tests/shot-variations.png`.

**Design beyond the preset (build `studio-p7`; `CREATIVE-STUDIO.md` s.13).**
A concept decides the medium, not a template: layouts `v: 5` come from a
**plan** (`ST_PLAN_SCHEMA`, `stPlanNormalise`): `medium` (photo-cinematic /
photo-documentary / editorial / composite / cutout / collage / illustration /
diagram / infographic / typographic / carousel), `approach` (`editable`: the
image model makes each region's imagery and the renderer composes the
words, shapes and marks as live layers; `artwork`: the image model paints
the whole piece, words included, and the version is `mode: 'artwork'` with
`layout.baked` naming the roles that are now bitmap and not editable - the
app says so and disables those fields), `regions[]` (background / cutout /
inset, each with its own image `prompt` and `refs` with roles), free
`elements[]` (text roles headline / support / cta take the copy; kicker /
label / myth / fact / caption / free carry their own text; `emphasis`
highlight / underline / box / caps, `letterSpacing`, `rotate`; shapes rect /
pill / circle / rule, gradients with `dir`), a stage `bg` colour or
gradient, and `frames[]` for a carousel. Anything the renderer cannot draw
is recorded in `layout.unsupported` and shown as "cannot draw", never
reduced to a preset in silence. **Marks follow the campaign:** kit campaigns
carry `identity`, `logoPolicy` (logo / wordmark / both / none) and a
wordmark file (`POST /brand/kit {wordmarkB64, wordmarkMime,
wordmarkCampaign, logoPolicy?}` -> R2 `brand/<ns>/wordmark/<campaign>`,
served by `GET /brand/wordmark?ns=&campaign=`; `tools/brand-logo.py <file>
--campaign hoof --wordmark`, `--policy`); `stMarkLayers` places the client
logo, the campaign wordmark, both or none as exact image layers (HOOF
carries its wordmark and never the MCA logo), on preset and plan layouts
alike. The renderer draws gradient grounds, image regions (`fit` cover or
contain, keyed by layer id, sketched as dashed boxes until their image
lands), emphasis, rules and circles, rotation and a frame counter;
`useImages` loads every image layer from its own `src`.
**Three actions** on a composition: **Refine this design** (mode `refine`),
**Explore variations** (`explore`: three concepts that must differ in the
drawn result - `stPlanSignature` / `stPlanDistance` measure medium,
approach, image region and a 4x4 occupancy grid of words and images; a
look-alike is marked `similar`), **Create a new design** (`new`: a custom
instruction, chosen `refs`, `keep {imagery, copy, composition}`; the
panel and layout are never inherited; the result is a fresh asset in the
family "New designs" or one asset per frame for a carousel). The concepts
call runs the creative model at `effort: 'high'` with the artwork, the
chosen reference images, the campaign identity, the facts and the
preferences, and each option carries the full `plan`, `summary`, `renders`
and `cost`. `POST /studio/concept/apply {eid, index, render, imageFrom,
size}` applies (or creates) and, with `render`, queues the plan's image
work through `stPlanRenders`: one render per region that does not keep the
current image, or one full-artwork render.
**The image model gets the plan.** `stRenderJob` resolves `referenceIds`
to the reference images and passes them to Gemini with their roles
(`nanoRender` lists "REFERENCE IMAGES, attached in this order" with each
role and purpose); `stRegionPrompt` writes a concept-specific brief in the
medium's own terms (no universal "documentary realism"), with the exact
words when the approach is artwork and a reservation for the mark, which
is placed afterwards from its file. Multi-turn edits (`input.edit`) replay
the conversation the image came from - the model's parts and thought
signatures are kept in R2 `.../<version>-conv.json` (`image.conv`) and
`image.editOf` names the source. `image.requested`, `image.model`,
`image.fallback` and `image.size` record what actually ran (1K / 2K / 4K;
a fallback is named on the version note, the thread and the asset view).
A cutout or inset lands in its own layer (`context.regions`) without
touching the background.
**Inspection.** Every render queues stage `inspect` (unless
`STUDIO_INSPECT=0`): the creative model sees the rendered image and judges
fidelity, hierarchy, readability, relevance and identity 1-5, lists the
words it can read and any not in the approved copy, gives a verdict (ship
/ fix / redo) and one bounded `fix {kind design|render|edit|copy,
instruction}`; event `inspection`. `POST /studio/inspection/apply {eid,
instruction?}` runs it once (a direction for design / copy, a render
re-brief or an edit for the others), event `inspection_applied`
(`fixKind`); after two applied corrections on a line the next inspection
answers `stop`. In-app: the inspection card on the thread with scores,
issues, wording, an editable correction and **Apply the correction**.
**Showing it.** `tests/studio-plan-demo.mjs` draws the mechanics with
synthetic imagery to `tests/shot-plans.png` (not finished quality: the
sandbox cannot reach the models). `tools/studio-showcase.py --key --ref
<file:purpose:note>...` runs the three demonstrations on the live worker
with the real models - the MCA myth opener and fact-response carousel, the
HOOF myth / fact creative with its wordmark, and a fresh concept through
Create a new design - saving before and after PNGs, the inspections and
the facts (model, resolution, fallback, baked words, wording checks) to
`showcase/index.html`. Harnesses: `tests/studio-p7-worker.mjs` (6) and the
three-actions case in the browser harness (17).

**A production-quality, client-aware workflow (build `studio-p8`;
`CREATIVE-STUDIO.md` s.14).** First production (`stCopyStage`) plans each
channel with `ST_PLAN_SCHEMA` at high effort, lays it out with
`stPlanNormalise` and queues `stPlanRenders` (`forceAll`) at `input.size`;
no plan, or a plan without words, falls back to the house composition with
`context.how: 'house'` and a note. `context.planIn` is kept on the version
(and carried through hand edits on `/studio/version`) so adaptation
re-normalises the master's plan per format (`context.master`).
- **The brief.** `stBriefNorm` keeps objective, audience, message, action,
  deliverables, `<field>Source` and `requirements {mandatory, preferred,
  open}` (items `{text, source approved|preference|previous|reference|team|
  ai, from}`). `stBriefCheck` (`GET /studio/brief/check?project=`) returns
  gaps (`campaign_unconfirmed` mandatory with two or more campaigns,
  `objective/message_missing` mandatory only when there is also no source,
  direction or instruction, `mark_missing` level `blocking`), assumptions and
  the campaign's marks; the copy stage fails `brief_incomplete` (not retried)
  on a mandatory gap unless `acknowledge:true`. `stBriefSuggest` (`GET
  /studio/brief/suggest?project=|ns=&campaign=&ai=1`) answers sourced
  suggestions; `ai=1` is one extraction-model call and needs a full key.
- **Identity.** `stMarkLayers(kit, ns, campaign, format, want, pos,
  {placement})`: the campaign policy wins over `plan.mark` (noted,
  `markOverridden`); a missing mandatory mark adds `layout.incomplete[]`
  (`stChecks` state `mark_missing`); `/studio/approve` refuses design with
  409 `incomplete`; export leaves it out. `stMarkPlacement(refs)` reads corner
  words from approved and brand reference analyses (`basis observed`, else
  `default`). `GET /studio/identity?ns=` (`stIdentityAudit`, read) and
  `tools/studio-identity.py` report what is in R2 per campaign.
- **References.** `studio_references` gained `campaign` and `prep_key` (a
  browser-prepared copy under 4.5 MB; the original kept; upload up to 12 MB
  with `prepB64`). `stReferencePack(refs, {mode recommended|chosen|none,
  chosen, campaign})` groups the pack, excludes another campaign's references
  in recommended mode, and records `{attached, read, excluded, unavailable}`
  on the concepts and produced events (`refPack`).
- **Concepts.** `keep` binds only when sent (`keep.explicit`): kept imagery
  rewrites the plan's background to keep the current image, kept copy refuses
  the model's headline, kept composition keeps the current layers; apply
  honours the same. Look-alikes in explore get one `REPLAN.` call
  (`replanned`). `size` travels from `/studio/concept/apply` to the renders.
- **Render.** `nanoRender` replays history only when `historyModel` is the
  answering model (else `currentImage` is attached), picks the last non-thought
  image part, returns `ms`, `usage`, `historyReplayed`. `stRenderJob` merges a
  region render into the live current version (no branch), checks a cutout's
  PNG colour type for alpha (`opaque` on the layer), and stores `image.meta`
  `{references, model, requested, size, fallback, ms, usage, historyReplayed,
  alpha}`.
- **Inspection.** `stInspectStage` reads `studio/<p>/<a>/<v>-export.png` when
  saved (`composed:true`), else the imagery (`imageryOnly`); the prompt carries
  the full text inventory, the marks that should (and must not) appear and a
  carousel's sibling frames. `/studio/inspection/apply` answers 409 `stale`
  when the asset has moved past the inspected version (`force:true` applies it
  anyway); a ship verdict never approves. The island composes and saves the
  export before it runs an inspect job (`composeExport` in `pump`).
- **In-app.** Intake asks for the campaign when the kit has several; the brief
  view has `Combo` fields with source chips, the requirement bands, the check
  panel and a 1K draft / 2K / 4K final select; cards show states (queued,
  generating, generated, reviewed, approved, failed), retained, incomplete and
  the reference pack with thumbnails; Generate has a resolution select; the
  asset view has the family strip and the render record; suggestions are
  grouped (design, type, copy, concepts) with basis, changes, keeps and paid;
  the client context shows the identity audit.
- **Tools.** `tools/studio-compose.mjs` draws a project's tiles with
  `docs/studio-render.js` in headless Chromium and saves them as exports.
  `tools/studio-showcase.py` prints an estimate and runs nothing paid without
  `--approve-budget N`, holds renders past the cap, composes before inspecting
  and compares composed tiles. Harnesses: `tests/studio-p8-worker.mjs` (14),
  `tests/studio-compose-test.mjs` (5), `tests/studio-showcase-test.mjs` (10),
  the P8 case in the browser harness (18).

**Typography, validation and production readiness (build `studio-p9`;
`CREATIVE-STUDIO.md` s.15).** The renderer measures what it draws:
`layoutText()` gives each text layer its lines, size, padding and the space it
really occupies (emphasis and rotation included; explicit line breaks kept,
long words and addresses broken and reported); `measure()` reports every layer
at the output size; `layoutRules()` judges the boxes - overflow, collisions
between any words and marks (an `overlaps: [id]` exception covers that pair
only), off the stage, the Instagram 9:16 interface (top 14%, bottom 20%),
unreadable type and contrast, duplicate ids, impossible geometry, unloaded
marks and sketch imagery (blocking in production), font fallbacks. The same
function is in the worker between `/* RULES:BEGIN */` and `/* RULES:END */`
and must stay byte-identical (the layout harness checks it). `ensureFonts()`
waits for the faces and reports, per role and weight, the family that drew.
`validate()` is the whole check; `repair()` is the smallest geometric fix that
never changes a word (fit boxes, restack with gaps, lift clear of the safe area
and marks, refit panels, widen, move a mark only without an observed
placement, bounded type steps, the approved mark variant that measures best;
locked layers named, copy too long says by how much) and is saved as a layout
version with no render. **Evidence is the server's:** `POST /studio/validation
{asset, version, report, imageB64}` (full) re-judges the report against the
version (`stValidationJudge`: size, layers, geometry within 1.6 px, displayed
characters, type size, plausible lines, mark file; a mismatch is 422
`report_mismatch`) with the shared rules and stores it in D1
`studio_validations` under `stCompSig` (displayed words, layout, imagery, mark
files and versions, fonts, format, stage); the PNG becomes the export the
inspection reads. `GET /studio/readiness?asset=&version=` (read) keeps
technical (not_validated / stale / failed / passed), the art director's
assessment (none / stale / imagery_only / inconsistent / verdict), painted
words (artwork mode) and approval apart. Design approval is 409 without a
passing validation of exactly the current composition, without painted words
read back, or on an inconsistent inspection unless `acknowledgeInspection`
(which never overrides a technical blocker); export leaves out anything not
technically passed. A caption-only version carries the evidence; a displayed
word or a new mark file makes it stale (`stSig('design')` includes the
displayed words, so approvals made before p9 drop on deploy). The inspection
records severities and `assessment: inconsistent` for ship with problems.
`stChecks` reads every displayed layer, the campaign's approved facts only
(pending and other campaigns named), units (dollars are not cents, a dropped
unit differs) and periods. Wordmark variants: `POST /brand/kit
{wordmarkCampaign, wordmarkVariant, wordmarkTone light|dark|colour,
wordmarkDefault, wordmarkB64}` -> R2 `brand/<ns>/wordmark/<campaign>/<variant>/<v>`,
served by `/brand/wordmark?ns=&campaign=&variant=&v=`; the logo has immutable
`logo@<v>` copies (`/brand/logo?v=`); `tools/brand-logo.py --variant --tone
--default`. In-app: the Readiness panel (three states, Fix layout (no render),
Measure again, Download draft PNG), measured on opening and filed when there
is no evidence. Harnesses: `tests/studio-layout-browser.mjs` (64, real
Chromium; writes `tests/shot-layout-repair.png`, synthetic) and
`tests/studio-p9-worker.mjs` (14); `tests/fixtures/studio-layouts.mjs` holds the
labelled HOOF reconstruction and `tests/studio-measure-stub.mjs` a measurement
for worker-only harnesses.

**The Brand Workspace (build `studio-p10`; `CREATIVE-STUDIO.md` s.16, which
also holds the research notes, the audit and the phased plan).** `GET
/brand/workspace?ns=&campaign=` (read) assembles what the Studio knows for a
client or one campaign, every item with `authority` (rule = approved rule,
observation = reference observation, preference, decision = project decision,
inference = AI inference), `scope` (client / campaign), `status` (active,
proposed, retired, outdated) and `source`: the kit (voice, standing rules,
campaign wording, banned terms, facts - pending facts are unreviewed
inferences, another campaign's facts are left out and counted), the marks
actually in R2 (`brMarks`: the logo and its `logoVersions`, each named wordmark
variant with tone, version, default and per-variant `history`, the legacy
single slot labelled as such), references across the client's projects
(observations), learned corrections (preferences), engine outcomes (decisions),
catalogued artwork, and D1 `brand_items` (`POST /brand/item`,
`/brand/item/update`, `/brand/item/review {decision keep|dismiss, scope,
authority, reason}`, full; `GET /brand/items`, `/brand/item/history`). An
inference is always created as a proposal and cannot be made active as it
stands; every change is a `brand_item_revisions` row with its reason.
`brandSave` writes `brand_revisions` (a summary in words and the kit as saved;
`GET /brand/revisions[?id=]`) and now keeps `logoV` across saves that do not
upload a logo (it used to drop it). `brReadiness` reports blocking (a mark the
policy requires is not on file), gaps, conflicts (single slot beside variants,
a banned term inside approved knowledge, approved facts that disagree, a
preference about the client logo on a campaign that does not carry it) and
items to review; `/studio/brief/check` carries it as `brand`. An approval or
rejection with a reason of twelve characters or more proposes an `accepted` /
`rejected` item (`brPropose`, with project, asset and version) that nothing
applies until a person keeps it. `GET /studio/used?asset=&version=` (read,
`stUsed`) names the version that made the words and plan and the one that
rendered the imagery (walking back through hand edits), the reference pack
(attached, read, left out), the rules applied, facts and banned counts, the kit
revision in force, the marks with variant and version, models, size and pixels,
and the brief's assumptions. Renders now honour the requested size over the
var `IMAGE_SIZE` (a default only); `IMAGE_SIZE_MAX` caps and is disclosed, and
the pixels received are recorded. In-app: the **Brand** rail view (readiness,
proposals with Keep / Dismiss, identity with the variant library and an
uploader that names the variant and its tone, typography and colour,
references and placement, voice and claims, preferences and decisions, kit
history, item history) and **What the Studio used** on every asset.
Harnesses: `tests/studio-p10-worker.mjs` (9) and the P10 case in
`tests/studio-browser.mjs` (19).

**Client review (build `studio-p11`; `CREATIVE-STUDIO.md` s.17).** `POST
/studio/share {project, assets[], label, expiresDays 0-90, allowApprove}`
(full) creates a private link: a random 256-bit token returned once, stored
only as its SHA-256 (`studio_shares.token_hash`), scoped to the assets named;
an asset is refused unless it is copy-only or its current version passed the
technical validation (the client sees exactly the validated export). `GET
/studio/shares?project=`, `POST /studio/share/revoke`. The reviewer's page is
`docs/review.html#t=<token>&w=<worker>` (the token stays in the fragment and
travels as `X-Review-Token`); its routes are outside the AXIOM key gate:
`GET /review/get` (an allow-list: client and project names, each shared
asset's current version as `/review/file` or its copy, the reviewer's own
comments with "addressed in version N"; never the thread, notes, checks,
layouts, other assets or another client), `GET /review/file`, `POST
/review/comment {asset, version, text, pin:{x,y}, author}`, `POST
/review/decision {decision approve|changes}`. A comment or decision on a
superseded version is `stale_version` 409; an unvalidated current version
shows "in revision"; approval needs `allowApprove` and the agency's own copy
and design approval, and is of that exact version (it stops standing when a
new one is made). Wrong tokens lock an address out after twelve tries (KV
`rf_<ip>`, ten minutes); a revoked link is 403, an expired one 410; 300
comments per link per day. Rows live in `studio_review`; every comment and
decision is a `client_review` event on the thread with the name as the
reviewer gave it. `GET /studio/review?project=` (read) and `POST
/studio/review/resolve {id, version | decision:'wontfix', note}` (full; the
version must be of the same asset and not older than the comment). The export
manifest records each asset's `client` decision; `input.requireClient` leaves
out what the client has not approved in its current version. In-app: the
**Client review** rail view (create a link - shown once with Copy -, the
links with state, views and Withdraw, comments by asset with their pins on
the tile, "Addressed in vN" and "Answer without a change"). Harnesses:
`tests/studio-p11-worker.mjs` (8) and `tests/studio-review-browser.mjs` (5,
both pages in Chromium).

**Strategy, exploration and sequence (build `studio-p12`; `CREATIVE-STUDIO.md`
s.18).** Stage `strategy {instruction}` (`stStrategyStage`, the creative model
at high effort) writes `brief.strategy`: problem, audience (who, now, wanted,
insight), idea, proposition, proof (ledger ids it holds only), tone, avoid,
risks, measures (qualitative signals, never forecasts), questions - status
`proposed`, source `ai`; the team edits and confirms it through
`/studio/project/update` (status `confirmed`, `confirmedBy`; `stBriefNorm`
bounds it), and `stBriefText` carries it (`stStrategyText`) into every later
stage. Stage `direct {n}` takes an exploration budget of 1-5 (default 3) and
each direction now carries idea, copyApproach, medium, composition,
typography, colour, references, plan and `renders`; `stDiversity` scores the
set (1 - mean pairwise overlap with a same-medium penalty; on the
`directions` event) and a look-alike is flagged. Stage `sequence {direction,
channels, count 2-8, deliverable, instruction}` (`stSequenceStage`) plans an
ordered sequence (role opener / explain / proof / response / voices /
call-to-action / reminder, channel, format, day, purpose, relation to the
idea, copy) and makes each item an editable house composition in the family
`Sequence: <name>` with `context.{sequence, order, of, role, day, purpose,
relation}`, no render; the plan is kept in `brief.sequences`. The brief is
stored up to 60,000 characters (it was cut at 12,000, which would have broken
its JSON). In-app: the intake's **Route** (Quick production / Guided campaign
development: strategy, then three directions), the **Creative strategy**
panel on the brief (edit, Confirm, Draft again), the exploration budget on
Directions with the new card lines and the set's diversity, and the
**Sequence** board. Harnesses: `tests/studio-p12-worker.mjs` (5) and the P12
case in `tests/studio-browser.mjs` (20).

**The canvas, Board and Copy deck (build `studio-p13`; `CREATIVE-STUDIO.md`
s.19).** `LayoutEditor` is now a canvas with a history (every finished
gesture or command is one step; Undo / Redo buttons and Ctrl or Cmd+Z,
Shift+Z, Y), multi-select (Shift-click), align left / centre / right / top /
middle / bottom (to the selection's bounds, or to the stage's 3% margin for
one layer), distribute across and down, paint order (To front / Forward /
Backward / To back for the whole selection, keeping its order), Group /
Ungroup (`layer.group`; grouped layers move together), a typography panel
for the text layer last clicked (size, weight, alignment, tracking, colour,
emphasis), safe-area guides (the 3% margin, and the Instagram 9:16 story
interface hatched), keyboard nudging of the selection (Shift for 2%), and the
renderer's `validate()` on the working layout at the output size as it
changes (blocking layers outlined). Saving is still one layout version, no
render. The rail has **Board** (every asset by family, drawn by the renderer,
with its validation and approvals) and **Copy deck** (every asset's
headline, support, CTA and caption in one table, edited in place as text
versions with the checks beside them). Harness: the P13 case in
`tests/studio-browser.mjs` (21).

**Recipes, impact and usage (build `studio-p14`; `CREATIVE-STUDIO.md`
s.20).** A recipe is a saved order of stages, not a node graph: D1
`studio_recipes` (ns, optional campaign, name, `steps [{stage, input,
label}]` from extract / strategy / direct / sequence / copy / export, note)
plus four built in (`ST_BUILTIN_RECIPES`: guided, release-set, sequence,
deliver). Inputs may say `$latestSource` or `$briefChannels`
(`stRecipeResolve`). `GET /studio/recipe/estimate?project=&recipe=`
(`stStepEstimate`: model calls with one inspection per image, renders at the
brief's size, `missing` inputs) comes before anything runs; `POST
/studio/recipe/run {project, recipe, confirm}` answers 409 `confirm_spend`
when the estimate renders and `confirm` is absent, 409 `other_campaign` for
another campaign's recipe, and otherwise queues one job per step with
`studio_jobs.after` naming the step before and `recipe` the recipe.
`stJobClaim` will not claim a job whose upstream is unfinished (the step
answers "waiting for the step before it"); `stJobGate` fails it with
`upstream_failed ... (not retried)` when the upstream failed or was
cancelled. `GET /studio/impact?project=` (`stImpact`) lists per asset what an
upstream change made stale - `kit_changed` (facts, banned terms, rules or
voice revised in `brand_revisions` after the words were written; remedy
`recheck`, free), `strategy_changed` (revise, paid), `master_changed`
(adaptations record `masterVersion`; readapt, paid), `measurement_stale`
(measure, free), `client_approved_earlier` (share, free) - with the asset's
locks; `POST /studio/recheck {asset}` recomputes the checks against today's
kit with no model call. `GET /studio/usage?project=` counts what actually ran
(calls by stage, images by size, failed, waiting, free versions against
rendered ones). In-app: the **Production** rail view (recipes with estimate
and Run, a confirm naming images and calls before a recipe that renders,
Save a recipe for the client or its campaign; Needs attention with the
remedy and a free / paid chip; usage). The browser's pump leaves a step
whose upstream is still queued for its next round. Harnesses:
`tests/studio-p14-worker.mjs` (4) and the P14 case in the browser harness
(22).

**Outcome metrics (build `studio-p15`; `CREATIVE-STUDIO.md` s.21).** `GET
/studio/metrics?ns=&days=` (read role; `stMetrics`) counts recorded rows for
one client and window, never estimates: per project the time from creation
to its first version (`timeToFirstDraft`), its first passing technical
validation (`timeToFirstValidated`) and its first agency approval
(`timeToFirstApproval`), each `{n, median, mean}`; versions up to the
standing approval of each fully approved asset (`versionsPerApproved`);
finished model calls and images divided by fully approved assets
(`costPerApproved`, null with `costNote` when none); constraint adherence
(current versions with no `differs`, `unsupported`, `banned` or
`mark_missing` check, `ST_ADHERENCE_BAD`); validation pass rate; agency
rejections; client changes asked and approvals. Legacy imports and archived
projects are left out. Baselines: `baseline.earlier` (the same client's
previous window of the same length) and `baseline.legacy` / `legacyAll`
(release packs and content sets: first Approve from `engine_outcomes`,
revisions per set, flagged pieces, approved and killed, and `notRecorded`
naming what the desks never measured). `isolation` (`stIsolationAudit`)
reads every rule id, reference id and mark layer on the client's current
versions and lists any belonging to another client, a recommended reference
of another campaign, or another campaign's wordmark. `definitions` says what
each figure counts. In-app: **Outcome metrics** under the project library
(7 / 30 / 90 days; measure, this window, the window before, the desks;
"none yet" with n, "not recorded" for the desks; the isolation line).
`firstPass` counts compositions whose first measurement passed before any
repair, and approved assets approved as first drafted. Harnesses: `tests/studio-p15-worker.mjs` (7), the P15 case in the browser
harness (23).

**The demonstration (`tools/studio-demo.py`, P16; `CREATIVE-STUDIO.md`
s.22).** The six steps the request named, run on the live worker per case
and written to `<out>/index.html` + `demo.json` + each case's delivery
bundle: (1) the brief with the workspace's knowledge counts, the mark policy,
references and the gaps before spending; (2) three directions with medium and
diversity; (3) production from the chosen direction, then a refine concept
applied as a layout version on the same imagery (no image call); (4) the set
adapted for the other channels (`revise` kind adapt); (5) a private review
link, a client comment answered by a text edit and resolved against the new
version; (6) agency approval of copy and design, client approval of that
exact version, and an export with `requireClient`. Cases `hoof`, `mca`
(national) and `synth` - "Harbourline Ferries - SYNTHETIC DEMO CLIENT" in
namespace `synthdemo`, whose invented kit is written only into an empty
namespace or over itself. Afterwards it checks every composed asset's marks
against its case and reads `/studio/metrics` isolation for each namespace.
Nothing runs without `--approve-calls N`; images need `--approve-renders N`
(default 0: typographic directions, nothing generated). Composition and
validation use `tools/studio-compose.mjs` (Node + Playwright). Output folders
`demo/` and `showcase/` are gitignored. Harness: `tests/studio-demo-test.mjs`
(20).

**Editing the imagery by area (build `studio-p17`; `CREATIVE-STUDIO.md`
s.23).** Gemini edits by described area (semantic masking), never a pixel
mask, so a render job with `edit: true, editKind: 'area'|'background'|
'restyle', area {x,y,w,h} (per cent), instruction` gets its prompt from
`stAreaPrompt` (the area in words and numbers via `stAreaWords`, "everything
outside it must stay exactly as it is", no text or logos; a background swap
keeps the subject; a restyle keeps every element), the current image is
attached, and `image.meta.edit {kind, area, instruction, of, preservation,
limits}` records it (kept through `stImage`). No image, or no instruction,
fails before any call. The words and marks are layers and are untouched.
The browser then measures both images at 160 px (`measurePreservation`:
mean change outside and inside the area, share of outside pixels moved by
more than 10%) and files `POST /studio/preservation {asset, version,
against, outside, inside, changedOutside}` (full role; `stPreservation`):
the baseline must be the version the edit came from; an area edit is
`held` (outside <= 2% and moved <= 3%), `drifted` (<= 6% / 15%) or
`changed`, with a warning when almost nothing changed inside; a background
swap or restyle is `measured`, for a person to judge. Event `preservation`
(field `editKind`, since `kind` would clobber the thread's). In-app: **Edit
an area of the imagery** under Art direction (drag a box or type it in per
cent, three kinds, resolution, the limit stated before spending) and the
preservation card on the asset with a compare link. Harnesses:
`tests/studio-p17-worker.mjs` (5), the P17 case in the browser harness (24).

**No imagery, and repair outside the tab (build `studio-p18`).** The copy
and concepts stages take `imagery: 'none'` (the demonstration sends it when
no render is approved): the planner is told (`ST_NO_IMAGERY_LINE`) and
`stPlanNoImagery` holds the plan to it - every image region dropped (an
empty image box is a sketch that never passes validation), a photographic
medium made typographic, artwork made editable, the ground the kit colour -
and the version records `context.imagery: 'none'`, which a later
refinement of an imageless version honours. `tools/studio-compose.mjs
--repair` (with `--save`) gives a failing tile the app's "Fix layout (no
render)" first - the bounded `repair()` that never changes a word, saved as
a layout version, then measured and filed; `tools/studio-demo.py` composes
with it. `package.json` lists Playwright for these tools (`npm install &&
npx playwright install chromium`; `node_modules/` is ignored). Harnesses:
`tests/studio-p18-worker.mjs` (3), the repair cases in
`tests/studio-compose-test.mjs` (11).

**Freeform everywhere (build `studio-p19`; `CREATIVE-STUDIO.md` s.26).**
Every path after first production keeps the composition a plan, not the
house panel. The revise stage's kind `layers` edits named layers by stable
id (`stLayerList` in the prompt, `stApplyLayerOps`): locked layers, the
words of a copy role, removing a role or a mark, and moving a mark held by
a campaign `markRule {corner, mandatory, note}` are refused and named; the
event lists changed and unchanged layers, no render. Kind `design` answers
with a plan that keeps the current photograph unless an image is asked for
and carries locked layers (`stCarryLocked`). Adaptation starts from the
master as it stands (`stLayoutToPlan`, `stPlanForFormat` rescales type and
mark). Sequence items carry their own plans. Production asks once (REPLAN)
before a house layout, which is then labelled "not a bespoke design" with
the reason. `markPlace` places the mark unless a mandatory rule holds it.
Split headlines (`part`) must reproduce the approved words or collapse to
one block (`stPartsReconcile`). `stArtMemory` takes only the campaign's
own and client-wide artwork. Harness: `tests/studio-p19-worker.mjs` (10).

**Layouts from the same photograph and words (build `studio-p20`; s.27).**
Concepts mode `layouts` ("Explore layouts (same image and copy)") binds the
imagery and the approved copy, keeps only the background region
(`stPlanLayoutsOnly` sets aside new regions, painted lettering and words
the version does not carry, and names them), measures each option against
the current layout too and replans a look-alike once; every option is
layout only. Framing: `layout.imageFocus` and region `focus` `{x, y,
zoom}` (`stFocus`) move the cover crop in the renderer, preview and export
alike, and survive adaptation. The editor resizes a text box without its
type (toggle "resize scales type"), takes X/Y/W/H, line height, panel
opacity and fill, and framing; all layout versions, no render. The thread
shows focused edits as changed / left / refused. Harnesses:
`tests/studio-p20-worker.mjs` (5), the P20 browser case, section 9 of
`tests/studio-layout-browser.mjs`.

**Recipes, compiled instructions, capabilities (build `studio-p21`;
s.28).** `studio_references.recipe` (`POST /studio/reference/recipe`, full;
`ST_REF_COMPONENTS`; an exclusion beats a borrow; excluding from a brand or
approved reference is a recorded conflict) rides on the reference's prompt
line; concepts name `influence` (reference x component) and one outside the
recipe is marked. Every model call of a job is filed at
`studio/<project>/compiled/<job>.json` (`stClaude` pushes onto
`log.compiled`; `nanoRender` returns `sent`; `stCompiledSave`): system and
user text, images by name, model asked and answered, effort, plain retry;
for images the prompt, reference roles, image config, history replay and
`masks: false`. Never a key. `GET /studio/compiled?job=` (read); "What the
Studio used" lists the jobs behind a version. `GET /studio/capabilities`
(read) says per operation what it takes and cannot do (no pixel masks) and
claims no verified real output. Harness: `tests/studio-p21-worker.mjs` (6).

**Inspection reasons and brand requests (build `studio-p22`; s.29-30).**
Each inspection score carries the model's reason; a missing score is null
("not scored"), never 3; the event records `version`, `versionNumber`,
`sig`, `round` of 2; readiness reports an inspection of an earlier version
as `stale` (with `inspected`). `tools/studio-brand-gaps.py --ns --key
[--out requests/] [--analyse --approve-calls N]` turns the workspace's
readiness into a request for approved material (NEEDED BEFORE PRODUCTION,
PLEASE CONFIRM) and analyses unanalysed references only within the
approved call budget; `requests/` is gitignored. Harnesses:
`tests/studio-p22-worker.mjs` (4), `tests/studio-brand-gaps-test.mjs` (10).
From the first live HOOF render (a blue wordmark at 1.28:1 on an orange
road, a pale label on the sky): the asset view now takes the approved mark
variant that reads (`STRender.markVariants`, measured against what is
behind the mark) by itself when a measurement finds `mark_unreadable` or
`mark_low_contrast` - a layout version noted "mark variant chosen for
contrast", no render, never a locked mark or layout; `repair()` makes words
read by colour (white or near-black) and only then a backing plate, words,
place and size untouched - always for `unreadable_contrast`, for
`low_contrast` only with `fixContrast` (the Fix button), so a deliberate
brand colour is not changed on its own; the Fix button now shows for every
contrast finding; `tools/studio-compose.mjs --repair` passes the variants.
Section 10 of `tests/studio-layout-browser.mjs`.

**One workspace (build `studio-p23`; `CREATIVE-STUDIO.md` s.31).** The island is
one frame: a sticky context bar (client, All projects, project, campaign, asset and
version, save state, live jobs, whether the models are configured), a sticky
navigator of six stages - Brief, Directions, Produce, Refine, Review, Export - whose
states come from the project (`flowOf`: done, in progress, to do, running, skipped,
blocked with the reason), a stage heading with the purpose, the main action and the
views inside the stage as tabs, the assets rail (renderer thumbnails, approval and
validation state) with Brand, Client context and Jobs, the workspace, and an
inspector: in Refine the tabs Copy, Quality (validation, the art director's scores,
human approval kept apart), Partner and Versions, rendered through a portal from
`AssetView`; elsewhere the creative partner, which can be hidden. Review is one
approvals table plus the client review; Export lists every file with its pixels
against the version's stage. Wiring: copy edits go through one queue per asset on the
latest revision (`flushCopy`; a clash with someone else's change to the same field
is shown with Keep mine / Take theirs), the brief keeps its working copy in
localStorage (`ax_studio_brief_<pid>`) and merges field by field on a 409, layout
saves re-send only when the layout did not change elsewhere (`putLayout`), library
loads are sequence-guarded per client, every paid action is guarded against a second
start (`guard`) and retries use `retry:<job>:<n>`, errors are explained in a notice
with a real Retry (`explain`: missing keys, budget, account limit, brief gaps,
unreadable answers, provider busy, conflicts, locks, roles, network), and the place
(`ax_studio_v1`: client, project, stage, asset) reopens on reload. Alt+1..6 jump to a
stage. The worker's `stPlanForFormat` now maps an adaptation into the target's safe
area when it is wider (a 9:16 story). Harnesses: `tests/studio-journey-browser.mjs`
(8 journeys on `tests/studio-fixture.mjs`, providers mocked), `tests/studio-p23-worker.mjs`
(2), `tests/studio-shots.mjs` (before/after screenshots into the ignored `tests/shots/`).

**Layout variations, imagery remedies, the Art Director (page p24; `CREATIVE-STUDIO.md` s.32).**
`STRender.variants(layout, copy, images, opts)` lays the same words, marks and imagery out nine ways
(bands foot / top, columns left / right, cards low / high, a centred statement over a shade, a fade
from the foot, type only with `layout.noImagery`), each by measurement inside the format's safe area,
then validates (and repairs) it at the output size; the result names what blocks and what is pending
(`imagery_missing`, `mark_unloaded`). Free, no model call; the words never change. The Refine workspace
shows them as cards; **Use this layout** is a layout version "layout variation: <name> (no render)".
Under the artwork, **Remedies** names what no layout can fix: no imagery yet (Generate the imagery, 1
render, confirmed; or Retry the failed render; or Use a solid ground, the type-only arrangement, no
render) and a mark that did not load. Fix layout's note now names the remaining non-layout blockers. The
creative partner is the **Art Director**: the latest review pinned above the thread (scores with
reasons, verdict, version judged, top issue, correction with Apply) and **Review vN (1 model call)**,
which composes the tile as it exports and runs `inspect` on that version; advice, never approval.
Suggestions are fetched only on **Suggest for this version (1 model call)**, no longer on every new
version. Studio scripts load with a release query (`?v=r1` now) so a browser cannot keep a stale
renderer: bump it on each page release. Harnesses: section 11 of `tests/studio-layout-browser.mjs`, journey 9 of
`tests/studio-journey-browser.mjs`.

**Two creation modes (S2; page `?v=r2`).** The brief carries `creationMode`
(`stBriefNorm`: `editable` by default, `finished` only when chosen; anything
else falls to editable), chosen at intake before anything is generated and
shown as a header chip. **Editable Studio** is everything above: Gemini makes
imagery, the Studio composes words, exact mark files, URL and shapes as live
layers. **Gemini Finished Creative** (`stCopyStage` with the brief in finished
mode): the plan is forced to `approach: 'artwork'` with `layout.finished`, the
version is `mode: 'finished'`, and `stPlanRenders` queues one render job
`{finished:true, marks:[{role,key,...}], baked, bakedText, copy?, edit?}` whose
prompt (`stFinishedPrompt`) sets the exact words, the URL and the mark
"exactly as attached"; `stMarkImages` reads the campaign policy's logo and/or
wordmark from R2 and `stRenderJob` attaches them to Gemini as image inputs with
the role "exact: reproduce as attached" (HOOF: the wordmark, never the MCA
logo, and the prompt says the client logo must not appear). A mark not on file
fails the copy stage before any spend (`mark_missing`, not retried). The filed
version has `layout.layers = []`, `layout.baked` = text roles plus the mark
roles, `image.meta.finished` and `marksSent`; `stReadiness` reports
`technical: 'not_applicable'`, `finished: true` and a `baked` block whose
`verified` needs an inspection that read every word and every mark back
(`ST_INSPECT_SYS` now asks for `marks {present, missing, wrong}`;
`stInspectStage` attaches the mark files beside the bitmap for comparison);
design approval gates on it (`baked_text_unverified`). `POST /studio/version`
refuses painted words, layout, image or mode changes with 409
`finished_bitmap` (caption, alt text and restore stay); `POST
/studio/finished/regenerate {asset, copy?, instruction?, size?}` is the only
revision (a new bitmap; direction-only continues the image conversation);
`POST /studio/derive {asset, to:'editable', regenerate?}` makes a derived asset
in the family "Editable from finished" from the plan the bitmap was briefed
from (words as live type, mark placed from its file, no imagery until asked,
`context.derivedFrom` with the reconstruction note) and leaves the original.
Export takes the bitmap itself (`exportKey` = the image key, `finished: true`).
The older `artwork` mode is labelled the hybrid it is (`readiness.hybrid`);
`GET /studio/capabilities` has op `finished` (cannot guarantee spelling or the
mark; fallback: Switch to Editable) and `modes`. In-app: the intake's Creation
mode segment with the explanation, the header chip, the finished note under the
bitmap (no layout editor, variations, art direction or area edit; painted
fields read-only with "in the artwork"), the **Finished creative** panel
(Regenerate with the painted words, a direction and the resolution, 1 render,
confirmed; Switch to Editable, free), Review and Export reading "words and mark
read back" in place of the technical validation. Harnesses:
`tests/studio-s2-worker.mjs` (8), `tests/studio-modes-browser.mjs` (4).

**One scene representation (S3).** What the renderer draws is what it
measures, hit-tests, judges and exports. `measure()` gives a mark the box of
its visible pixels (`vx vy vw vh`, from `markStats` bounds inside the
contained image; `markFill`) and turns a rotated image or mark into the
axis-aligned bounds of its turned rectangle, so collisions, safe areas and
clear space are judged by ink, not by boxes; `regionStats` returns the darkest
and brightest tenth of the ground (`p10`, `p90`) and `contrastOf` records
`contrastMin`, the worst local contrast under the words. The RULES block
(byte-identical in the worker) gained `safeAreaOf(format, channel)` - the one
safe-area table: the Instagram story interface (14 / 20 / 6%, hard) and the
3% feed margin - which the rules, `repair()`, `variants()`, the editor's
guides and align, and the worker's `stSafeInset` (placement = the table plus a
margin) all read; `patchy_contrast` (blocking under 1.6:1 on the worst
patch, a warning under three quarters of the wanted ratio); `mark_padding`
(ink under a quarter of the box) and `mark_small` (ink under 6% of the stage
width); and `pixels_unmeasured` (blocking in production) when
`validate()` reports `unresolved: ['contrast'|'occlusion']` because
`getImageData` failed - an unresolved state, never a pass. `repair()` treats a
blocking patchy finding as a contrast fix (colour, then a 72% plate, then a
92% plate; the words untouched). `report()` carries `contrastMin`, the
visible bounds and `unresolved`; `stValidationJudge` adopts the bounds only
inside the layer's box (refused otherwise), reads `contrastMin`, and marks a
live text box reported with no contrast as unresolved. The layout editor's
handles sit on the measured ink (`data-ink`, the layer box drawn faintly
behind when it differs) and its guides come from `STRender.safeArea`.
Harnesses: `tests/studio-scene-browser.mjs` (20), `tests/studio-s3-worker.mjs`
(3), the ink-handle case in `tests/studio-editor-browser.mjs` (3).

**Background positioning (S4).** One documented transform in the renderer,
`coverTransform(iw, ih, box, focus)`: scale `max(boxW/iw, boxH/ih) * zoom`,
origin `boxX - (w - boxW) * fx/100` (and y alike), so the image point at
(fx%, fy%) sits at (fx%, fy%) of the box - focus 50/50 is the plain centred
crop, 0 and 100 pin the edges, zoom is 1-3, and because fx/fy are clamped the
box is always covered (no pan shows an empty edge). The same focus therefore
keeps the subject at the same relative place in 1:1, 4:5, 9:16 and 16:9.
`imageToCanvas` / `canvasToImage` map points, `panFocus(iw, ih, box, focus,
dx, dy)` inverts a drag, and `cover()` draws through the same function, so
preview, export, hit-testing and the subject check agree. **Subject
awareness is evidence, not detection:** `subjects(img)` is colour-and-edge
saliency on a 48x48 grid (regions with a score, `confidence` capped at 0.6,
`method` naming what it is not; a flat image returns none);
`subjectCoverage()` maps the regions through the transform and measures what
words, panels (opacity >= 0.5) and marks cover and what the crop cuts off;
the RULES block gained `subject_covered` and `subject_cropped` (warnings
that carry the confidence; the worker's judge reads `rep.subjects`);
`frameSuggest()` searches a 5x5 grid of focus points at zoom 1 and 1.25 and
offers the framing that keeps the subjects clearest without cropping more
than half of one away - offered, never applied. `validate()` returns
`subjects`, `report()` carries them. In the layout editor the Framing panel
has **Frame by dragging** (a stage overlay: drag pans the photograph or the
selected region's image through `panFocus`, the wheel zooms; one drag or one
zoom gesture is one undo step), zoom - / +, **centre and reset**, the likely
subjects marked on the stage with their confidence, and **Keep the subject
clear (measured)** applying the suggestion as a layout change (no render).
Harnesses: `tests/studio-framing-browser.mjs` (17), the framing case in
`tests/studio-editor-browser.mjs` (4).

**Dependable editing and repair (S5).** Locks hold everywhere: in the layout
editor a locked layer is left out of every command (move, resize, nudge,
align, distribute, paint order, group), a mark held by a mandatory campaign
rule (`layer.rule.mandatory`) is shown as held, has no handle and no position
fields, and an exact image layer (logo, wordmark) keeps its proportions when
its corner is dragged; on the server `POST /studio/version` refuses a layout
that moves, resizes, retypes, recolours or removes a layer with
`locked: true` (409 `locked`, `element` and `changed` named) or moves a
rule-held mark (409 `mark_held`), unless `unlock: true`, in which case the
version's note records that a held mark moved against the rule. Dirty is
distinct from saved: the editor shows an "unsaved layout changes" chip, the
header shows "Unsaved layout", Cancel asks before discarding, and leaving the
page asks while a draft or an unsaved layout exists. **Fix layout** returns
one of four outcomes - `complete`, `partial`, `blocked`, `nothing` - with the
blocking count before and after, the steps taken, what still stands and why
(and that it is not a layout matter where it is not), an **Undo fix** (a
restore of the version before the fix, as its own version), and a bound:
three saved fixes per asset in a session, and a stop when a fix would return
to an arrangement an earlier fix already left (oscillation). **Measure again**
reloads the images and fonts first (`nonce`), then files the measurement for
the current version; the signature is recorded only when the worker accepted
it (S1). Harnesses: `tests/studio-s5-worker.mjs` (2), the two S5 cases in
`tests/studio-editor-browser.mjs` (6).

**Client knowledge (S6).** `GET /brand/inventory?ns=&campaign=` (read;
`brInventory`) says, for a client or one campaign, what the models can
actually use (`usable[]`: marks on file under the campaign's policy, approved
facts, banned terms, voice and wording, analysed references, corrections in
force, active items, described artwork - each with what it reaches), what is
stored but never reaches a model (`notRetrieved[]`: a pending fact, another
campaign's facts and references, switched-off corrections, undescribed
artwork, proposals waiting), what is not analysed, what is missing or
conflicting (the readiness lists), `recommendations[]` each with an action
(`/brand/teach` bodies, `/studio/reference/analyse` ids, `/engine/artwork/
describe`, marked `paid` where a model call is spent) and the curated
`examples[]` still wanted (one per reference purpose the scope has none of).
**Placement is evidence, not a vote**: `stPlacementEvidence(rows, kit,
campaign)` gives one row per approved or brand reference that shows a mark
(`corner`, `basis` structured | text, `confidence` 0.85 / 0.55 / 0.3, kind,
size, clear space, approval, link), weighs them (approved x1.2), names the
agreement and every disagreeing reference as an `exception`, and puts the
rule layer above: a campaign `markRule` makes the basis `rule`; nothing is
the house default. `stMarkPlacement` keeps its shape (`corner`, `basis`,
`text`, `refs`) and carries the evidence. The vision pass (`ST_REF_SYS`) now
answers a `mark` object (present, kind, corner, size, clearSpace), sanitised
by `stRefMark`; `brReadiness` reports `placement_contested` when the
references disagree and no rule stands. **Teach this brand**: `GET
/brand/teach/inspect?ns=&campaign=` proposes from the evidence and the gaps
(a placement rule with its confidence, evidence and exceptions; pending
facts; waiting items) and writes nothing; `POST /brand/teach {ns, campaign,
kind placement|fact|banned|rule|item, proposal, confirm, reason}` (full)
answers a `preview` (what would be written, the evidence, the exceptions,
how many compositions the rule will hold) without `confirm`, and with
`confirm:true` and a `reason` writes the campaign `markRule` through
`brandSave` (a `brand_revisions` entry names it) plus a brand item of
authority rule with the evidence, or approves a pending fact in place /
adds a fact with its source, adds a banned term, adds a learned correction
(`engine_fixes`, source `teach:brand[:campaign:<id>]`), or a knowledge item.
**The rule holds in production**: `stMarkLayers` stamps `layer.rule` on the
mark layers when the campaign rule is mandatory, and the house layout
(`stLayoutFromSpec`) honours it like the plan path does, so the S5 gates
(`mark_held`, the editor's held state) now fire from real compositions. In
the Brand workspace: the **inventory** section (strip, usable table, stored
but never sent with show / hide, recommendations with Teach / Analyse /
Describe buttons that name the paid calls, examples wanted), the **mark
placement evidence** table (reference, approval, corner, read as,
confidence, exceptions; "make it the rule" / "teach it"), and **Teach this
brand** (Inspect, a form per kind, Preview, Confirm with a reason; hidden
from read-only keys). Harnesses: `tests/studio-s6-worker.mjs` (7),
`tests/studio-brand-browser.mjs` (4).

**One context compiler (S7).** Every stage that asks a model for words, a
plan or a judgement - strategy, directions, production, sequence, revise,
concepts, suggestions - gets its context from `stCompileContext(env, p,
{channels, stage, refs: {images, mode, chosen, attachChosen} | null, art})`:
the client context (`stContext`: kit block, exemplars, learned corrections),
the references and their pack (`stRefBundle` + `stReferencePack`, the chosen
references attached as images when asked), the artwork memory, the placement
evidence (`stPlacementEvidence` on the pack) and one `identityText`
(CAMPAIGN IDENTITY, PALETTE, the placement rule or observation) that now
reaches every path alike - the directions and the revise stage used to see
no identity line at all. It returns a **manifest** of what informed the
call: the facts by id with source, the banned terms, voice and standing
rules, identity and mark policy, the corrections by id with their rule, the
examples count, the references attached / read / excluded / unavailable, the
artwork memory counts, the placement (basis, corner, confidence, mandatory),
the marks on file, the prompt sections with their sizes, the models, and
`omitted[]` - what was held but left out, each with its reason (a pending
fact, another campaign's fact, an excluded or unanalysed reference, another
campaign's artwork). Stages store it as `informed` on the versions and
events they write (production and sequence versions, the revise versions and
event, the strategy / directions / concepts events, the suggestions answer),
and `GET /studio/used` answers `informed` from the generating version
through later hand edits (or from the concept event that made the words).
The Studio's kit block is now campaign-scoped (`contentKitBlock(...,
{campaignOnly: true})`: the campaign's own facts and the client-wide ones;
other campaigns' facts counted in `excludedFacts`), because the figure
checks already judge against the campaign's facts only; the Content Desk
keeps every approved fact, the campaign's first. In-app: **What informed this
creative?** inside "What the Studio used" on every asset, and the client
context view names the other campaigns' facts it leaves out. Harness:
`tests/studio-s7-worker.mjs` (5).

**Genuinely different directions, and the six actions stated first (S8).**
Directions are measured on the argument (headline and message) and on the
medium: two that argue the same thing in different words, or share a medium
with a near idea, are look-alikes; three or more in one medium are a
`narrow` set even when the arguments differ. Either sends the set back to
the model once (`REPLAN.`, like the concepts stage) for replacements that
differ from every standing direction in the argument AND in the medium;
the result is re-measured, a replacement that still reads alike is marked
`replanFailed` and never hidden, and `replan:false` declines the round.
The `directions` event and the job result record `media`, `replanned`,
`replanWhy` (`alike` | `one medium`) and `narrow`. `GET /studio/actions?
asset=&version=` (read; `stActions`) states, for one composition as it
stands, the six creative actions - `refine`, `explore`, `layouts`, `new`,
`imagery` (Generate or Re-render), `area` - each with `what`, `changes[]`,
`preserves[]`, `cost {calls, renders, size, text}` (an inspection counted
when `STUDIO_INSPECT` is on), `available` and `why`: copy only and a
finished bitmap close all six (a finished creative is offered `regenerate`
and the free `derive` instead), a locked layout closes refine, explore and
layouts (a new design stays open), hybrid artwork closes layouts and area,
no imagery closes layouts and area (typographic by choice closes imagery and
area), a render or inspection in flight closes imagery and area. Nothing in
the registry runs anything. In-app the Art direction panel has "Show what
each action changes, keeps and costs" (a table with the reasons), and the
action buttons carry the statement as their title and are disabled when the
worker says not now. Harnesses: `tests/studio-s8-worker.mjs` (5),
`tests/studio-actions-browser.mjs` (2).

Phase 1, the ground:

- **Projects own everything.** D1 `studio_projects` (ns, campaign, title,
  brief, status, owner, `revision`, `legacy_kind/legacy_id`, `idem`,
  archived) with `studio_sources` (text and passages; the claim ledger is
  Phase 2), `studio_references` (purpose brand / composition / mood /
  imagery / typography / inspiration / approved; image in R2
  `studio/<project>/refs/`), `studio_directions`, `studio_assets` (family,
  channel, format, `current`, `locks`, `revision`), `studio_versions`
  (**immutable**: a change appends and moves `current`; `restoreFrom`
  appends a version with `restored_from`; a render's image lives in R2
  `studio/<project>/<asset>/<version>.png`, served by `GET /studio/file?
  key=`), `studio_approvals`, `studio_events` (the project thread),
  `studio_jobs`. The namespace a request supplies is never trusted: every
  child row is authorised through its project (`stAsset` returns the pair;
  a `project` that disagrees is `cross_project` 403). Roles are agency-wide
  full and read, as decided.
- **Concurrency.** Writes may carry `revision`; a stale one is refused with
  `conflict` 409 and the current revision, nothing written. `POST
  /studio/lock {asset, element, locked}`; a version write that changes a
  locked element is `locked` 409 unless `unlock:true`.
- **Approvals name their content.** `POST /studio/approve {asset, part
  copy|design, decision approve|reject|withdraw, reason}` stores the
  signature of the copy (or of image key, layout and mode); `stStanding()`
  reports an approval only while the current version still matches, so a
  copy edit drops the copy approval and leaves design standing
  (`carried:true`). A reason is required; the thread records it as client
  acceptance or feedback, never performance.
- **Durable jobs.** `POST /studio/job {project, asset, stage, input, idem}`
  (stages `echo`, `render`; Phase 2 adds extract, direct, copy, export) is
  idempotent on `idem`. `POST /studio/job/step {id}` claims the job with an
  atomic lease (`stJobClaim`: queued, or running past `ST_LEASE_MS` = 2 min,
  `attempts < 3`) and runs one stage synchronously; `studioCron()` does the
  same from the tick for anything queued or abandoned. Transient failures
  (5xx, 429, timeouts, no image) requeue up to three attempts, invalid input
  fails at once; `cancel` stops a queued job and notes that an in-flight
  provider call may still complete and cost, and a cancelled job's result
  is never filed. **Stale guard:** a render whose asset has moved past
  `input_version` is filed as a branch off the version it was asked for and
  `current` is left alone.
- **Legacy access.** `GET /studio/list?ns=` returns the client's projects
  plus its release packs and content sets as read-only legacy rows
  (`rp:<id>`, `cs:<id>`); `GET /studio/get?id=rp:<id>` builds a project
  view on the fly (tiles as `generated`, pieces as `copy`, fields never
  recorded marked `notRecorded`). `POST /studio/import {legacy}` creates a
  project once (unique `legacy_id`; a repeat returns the same project),
  references tile images by their existing R2 key, and never writes the
  original. `GET /studio/inventory` counts packs, sets and projects per
  client and samples KV `imgsess_*` sessions for a recorded client;
  `tools/studio-inventory.py` does the same from a Mac through the read
  routes. `GET /studio/models` asks Anthropic and Google which of the
  candidate identifiers the worker's keys can list (true / false / null),
  a statement about reachability only. `GET /studio/status` is the build,
  counts and bindings; the prototype's library shows it when deployed.
- **Auth hardening.** `/chat`, `/nano` and `/clickup` are gated (writes,
  full role) with the rest of the creative routes; `axAuth` fails closed
  when `AXIOM_KEYS` is set but is not a JSON object (`auth_misconfigured`
  401 for every key) unless `AXIOM_ACCESS_KEY` also exists.
- **Tests live in the repo now:** `tests/` holds every harness on relative
  paths (`tests/README.md`), including `studio-worker.mjs` with a case per
  Phase 1 acceptance line. Run `node --experimental-sqlite
  tests/studio-worker.mjs`.

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

**The creative shelf.** Client creative memory - campaign identities and
their visual conventions, the client's explicit creative feedback, exact
approved copy, approval status, open conflicts - is filed in the Mind under
`<ns>_creative` (`tools/engine-ingest.py <pack> --ns mca --mind-ns
mca_creative`), and `mindRetrieve(env, ns, q, k, {creative:true})` reads it
**only for the creative surfaces**: `contentExemplars()` (Content Desk),
`releaseCompose()` (Release Desk), and `POST /mind/query {creative:true}`
(Studio, Ad Lab and `ccPlaybook()`). The Sentinel, the research agent,
topic research, narratives, sentiment and the daily brief retrieve `ns` and
`cmm` only and never see it. Rules that come with such a pack are task
`copy` or `tiles`, the two tasks those surfaces read. The MCA creative
memory (the 30 September 2026 handoff: Australian mining / 1.5, Hands Off
Our Fuel and Victoria's Golden Opportunity kept as three identities; explicit
requirements, observed conventions, conditional proposals and approval
snapshots kept distinct; the evidence appendices whole, not split by
campaign) is loaded this way as the `mca-creative-memory` pack; a
content-free provenance stub sits in `knowledge/wiki/sources/`.

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

Two worker secrets, at least one required. `AXIOM_ACCESS_KEY` is a single
full-access key (it also opens beside a broken roster, so the roster can be
repaired). `AXIOM_KEYS` is JSON of per-person keys:
`{"key1":{"n":"Heshan","r":"full"},"key2":{"n":"Steve","r":"read"}}` - every
entry must say `"r":"read"` or `"r":"full"`; anything else closes the roster
(`401 auth_misconfigured`), never full access. With neither secret the worker
is **closed** (`503 auth_not_configured`); `AXIOM_DEV_OPEN=1` opens only a
localhost origin. `axRoutePolicy(path, method, query)` decides every request,
deny by default: `/` and `/archive/stats` are public; `/review/*` and `/sifa/*`
use their own tokens; every non-GET is full; GETs that act (`/collect`,
`/fetchurl`, `/integrity`, probes `?probe=1`, live reads `?live=1`, bridge
claims, Meta sync, the self-test, `/fulltext?save=1`, `/studio/brief/suggest?
ai=1`) are full; other GETs are read. Writes and acting GETs with a read key
return `403 read_only`. The app hides mutating buttons for read-only keys.
URLs a person supplies (`/fetchurl`, the forum readers) are fetched only when
`axUrlProblem` finds a public http(s) address (no private, local, credentialed
or non-default-port host; redirects rechecked by hand).

## Security & org knowledge (Curious Minds = namespace `cmm`)

- Access control: the keys above gate every route through the `X-Axiom-Key`
  header (closed until a key is set; see Access roles). `/archive/stats` stays
  public by design: aggregate counts only, so the map shows presence of
  knowledge without revealing content. The app sends the key from Settings ->
  Access key.
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

## Reliability (release r1; `RELIABILITY.md` holds the system map, the defect list and the evidence)

Patterns every change keeps to, each with its harness (`npm test` runs them all;
CI runs the same on every push with providers MOCKED and no secrets):

- **Access** - deny by default through `axRoutePolicy`; a new route that acts
  must be full (non-GET, or listed in `AX_GET_FULL`). `auth-policy-worker.mjs`
  tries every acting route with no key, a wrong key, a read key and a full key,
  and proves through the recording `fetch` that a refusal reached no provider.
- **Persisted JSON** - never `JSON.stringify(x).slice(...)`. Diagnostics use
  `jsonFit(v, max)` (valid, shrunk field by field, `_truncated`); anything that
  drives work is refused past its limit with the field named (`jsonLimitProblem`,
  413: input 60,000, field 20,000, brief 60,000, layout 250,000). A job whose
  stored input does not parse fails `input_corrupt`. `GET /integrity` (full,
  read-only) lists unparseable records per `AX_JSON_COLUMNS` with the recovery.
  `integrity-worker.mjs`.
- **Concurrent writes** - compare-and-swap on `revision` with affected rows
  checked (projects, assets, locks); `stAppendVersion` inserts and moves
  `current` in one guarded batch; stages write the brief through
  `stBriefPatch`; approvals only for the version still current (`409
  version_moved`). `concurrency-worker.mjs` (`slowReads` interleaves requests).
- **Jobs** - bridge claims and finishes are conditional (`409 job_ended` for a
  late report); Studio attempts are fenced by attempt number (`job.fence`), the
  lease is extended before each provider call (`job.lease`), cancel is terminal.
  `jobs-lifecycle-worker.mjs`.
- **Versions** - the asset view carries the newest 60 plus the current version,
  numbered by `(created, rowid)`; `versionsTotal`; `GET /studio/versions?asset=
  &before=&limit=` pages the rest; the page never falls back to another version
  as current. `versions-worker.mjs`.
- **Knowledge** - `mindIngestDoc` is the one path: whole text up to 2,000,000
  characters (413 beyond), every chunk indexed in checkpointed batches of
  `MIND_INGEST_CHUNKS_PER_CALL` (400), `mind_docs.status` indexing / complete /
  partial with `chars`, `hash`, `indexed`, `error`; vectors carry `seq`,
  `start`, `end`; `POST /mind/ingest/resume {docId}`; `GET /mind/coverage?
  namespace=` (read-only) measures documents filed under the old 120-chunk cap
  and proposes the backfill - nothing reindexes itself. `ingest-worker.mjs`.
- **AI accounting** - one D1 ledger `ai_usage(day, scope)` for studio,
  sentiment and narratives: `aiReserve` (conditional, before the call; refusal
  is `budget_exhausted`), `aiSettle` (confirmed with tokens, or failed; retries
  counted). `claudeMsg(env, system, user, maxTok, timeoutMs, model, acct)` takes
  `{scope, retry}`. `/studio/budget` reports reserved, confirmed, failed,
  retries, in flight and tokens. `usage-worker.mjs`.
- **AI boundaries** - every system prompt ends with `AX_UNTRUSTED_RULE` (source
  material is data, never instructions); the deterministic guards (mark policy,
  figure checks, namespace walls, approval gates) must hold when an answer is
  subverted. `ai-boundaries-worker.mjs`. A figure written inside an injected
  source still "matches the source": the check is provenance, not truth.
- **Diagnostics** - every answer carries `X-Request-Id` (exposed to the
  browser); an unhandled failure answers `500 internal_error` with
  `requestId`; log lines strike keys out with `axRedact`. `diagnostics-worker.mjs`.
- **Tests** - `tests/run.mjs check|backend|browser|all` (`npm run check`,
  `test:backend`, `test:browser`, `test`); Playwright pinned by the committed
  `package-lock.json` and found by `tests/pw.mjs` (`PLAYWRIGHT_MJS`, the
  project, then the global install); `tests/worker-env.mjs` is the backend
  fixture. Backups of the earlier states: branches
  `backup/2026-10-02-main-p23` and `backup/2026-10-02-studio-p24`.

## Working conventions

- Verify changes with the harnesses in `tests/` (`npm test`; a new defect
  gets a test that fails before the fix); never break the Studio/Ad Lab
  conversation flows.
- Worker secrets (ANTHROPIC_API_KEY, GEMINI_KEY, CLICKUP_TOKEN, …) exist only
  in Cloudflare — never in the repo.
- Ship flow: commit on `claude/…` branch → push → fast-forward merge to
  `main` (GitHub Pages serves `main` **/docs**). The worker ships from the
  laptop with `tools/deploy-worker.sh` (checks syntax and ASCII, reads the
  live settings through the Workers API, uploads the module with
  `keep_bindings` for every binding type plus secrets and vars, proves the
  new code answers on `/engine/status`; it refuses to deploy onto a worker
  with no access key, since the worker is closed without one; auth from the `wrangler login`
  session or `CLOUDFLARE_API_TOKEN`). Never `wrangler deploy` from the repo
  root: `wrangler.toml` is a template whose Mind bindings are placeholders,
  so that would detach D1/Vectorize/AI/R2 from the live worker. Secrets:
  `npx wrangler secret put NAME --name newsaus`.
