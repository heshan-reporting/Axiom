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
