# Claude Code prompt: the activist monitoring desk - three collection layers, keyword discovery, and Anne's Den (after P52: worker p52, page `?v=r39`)

Paste everything below the line into Claude Code, opened at the root of the `Axiom` repository.

---

You are working in the AXIOM repository. Read `CLAUDE.md` first: it is the system map and its rules apply. For this work
the sections that matter are The Sentinel, The Source Registry and full text, Social and community capture, Signals
(the desktop bridge and `jobRoute()`), The Reddit signal (agent-reach), Sentiment, Narratives, The daily brief, Meta
direct, Campaign performance (the Supermetrics path), Access roles, Reliability and Automated model spend. Then read
`tools/reach-agent.py`, `tools/reach-x.py` and `tools/reach-reddit.py` whole, and `prompts/studio-engines-and-canvas.md`
for how a release is run here.

## The goal

The owner asked for this in two messages, in their words (spelling tidied):

"try this and let's try to get Facebook and Instagram collection more widen regarding her keywords and find new relevant
keywords as well.. once that is done, create a different page named Anne's Den and create a workspace for her
accordingly.. So her work can be easier. Add features and make the UI very production grade with options and make it bug
free and reliable."

"can we also use agent reach to scrape through or pull data from all the social media channels.. add as another layer to
collect data not only through social media channels but other gated and important news sources."

"Try this" refers to two builds already offered to the owner: (1) add the topics and sources her reports cover and AXIOM
does not, and (2) a per-client activist brief in her own format with every claim cited.

Read that as seven outcomes, in this order. Each is a release of its own.
1. **Coverage.** AXIOM collects what her reports are made of: the topics, the outlets, the official sources, the actors.
2. **Layer 1, official routes.** Facebook and Instagram public posts through the platforms' own programmes.
3. **Layer 2, the reach layer.** The Mac collector reads every social channel a person at the agency is signed in to:
   keyword search, public posts and the comments under them.
4. **Gated and important news.** Subscriber outlets read through the agency's own subscriptions, newsletters and
   monitoring exports imported, and the official sources that never reach a news feed.
5. **Keyword discovery.** AXIOM proposes new terms, hashtags, accounts and outlets with the evidence for each, and a
   person approves them. Nothing is added by a machine alone.
6. **Anne's Den.** One page where her day's evidence is already sorted into her sections, a cited draft is one stated
   call away, and the report leaves in the shape she files it.
7. **Reliability.** Every state designed, every failure named, every figure traceable to a row and to the layer that
   collected it.

## Who this is for, and what she does today

Anne is the agency's monitoring analyst. She files, by hand:
- a **daily** activist activity brief for Australian Energy Producers (`aep`), national and Victoria, each a 24-hour
  reporting window;
- a **weekly** brief for the Minerals Council (`mca`), national and Victoria;
- a **weekly** brief for the firearms clients (`guns`).

Each report has the same seven sections: Executive Summary; Key Narratives; Traditional Media Coverage; Social Media
Activity; Influencer and Political Activity; Bottom Line with a Recommended Posture; Source List. Social posts are cited
with their interaction counts at the time of reading, and upcoming protests and actions are noted when known.

What the last ten days of her AEP reports are built from (counted from their source lists): X 42 links, Facebook 21,
Instagram 14, ABC 12, The Point 11, AFR 8, RenewEconomy 5, The West 5, Guardian 4, Reddit 4, YouTube 4, then campaign
sites. About half of her evidence is social, Facebook and Instagram together are the second largest channel, and
several of the news outlets are behind a paywall.

What she has said about her tools: the media monitoring service returns irrelevant results (how-to reels, unrelated
topics) and she curates by hand; a client's feedback on the output was that it reads as generic and missed a critical
event (a campaign launch by independents) in the week it happened. The standard for this work is therefore **relevance
and nothing critical missed**, before volume.

What AXIOM does not yet do for her (found by reading the worker, not the live archive):
- The `aep` lexicon has `gas` and `energy` only. None of these appear anywhere in the worker: windfall tax, gas export
  tax, super-profits tax, PRRT, COP31, data centres, Scott Reef, Browse.
- The Point (`thepoint.com.au`) is not a source. The Australian Marine Conservation Society and several of the Greens
  senators and MPs she cites are not in the entity register.
- Facebook and Instagram public pages: `socialCoverage()` says `facebook_public` has no method. Instagram has none.
- The Mac collector offers `reddit`, `x` and `render` and nothing else. X keyword search runs only there; account
  timelines run in the worker for the MP register plus KV `x_watch`, which holds none of her actors.
- Full text is public routes only: `CLAUDE.md` says "No credentialed access anywhere", so subscriber articles are
  headlines without bodies. It also says of LinkedIn "There is no scraping path and none is wanted".
- `briefWrite()` is one cross-client brief in AXIOM's shape, not a per-client, per-region brief in hers.

## The three collection layers

Every row filed says which layer brought it (`meta.layer` 1, 2 or 3 and `meta.via`), and the Den shows it.

| Layer | What it is | Where it runs | What it adds | What it costs |
|---|---|---|---|---|
| 1 Official | The platforms' own programmes: the Graph API, the Supermetrics public-data connectors, the Ad Library | Worker, or a Claude Code session | Posts and interaction counts for named accounts and hashtags, with no account at risk | Permissions and limits; no comment text, no keyword search on Facebook |
| 2 Reach | The Mac collector with a person's signed-in sessions (agent-reach backends and a signed-in browser) | A Mac at the agency | Keyword search, public posts wherever they are, the comments under them, subscriber articles | Against several platforms' and publishers' terms; the account can be challenged or restricted; parsers break when pages change |
| 3 Keyless public | What the worker already reads without a login (Bluesky, Mastodon, YouTube feeds, petitions, the Source Registry) | Worker | Unchanged | - |

A job goes to the **lowest layer that can do it** (`jobRoute()`, by capability as now): layer 1 when configured, else
layer 2 when a live collector offers it, else it fails at once with the fix named. Both layers file the same row for the
same post (one canonical permalink per platform), so nothing is counted twice and the newest interaction count wins.

## Decisions the owner has to make (proceed on the default; list each in the report)

- **D1 Naming public actors.** Today no name is stored on a social row except a sitting MP on their own post
  (`meta.mp`). Her reports name organisations and officials, because who said it is the point. Default: extend the
  exception to **registered public actors on their own posts only** - an organisation's official account, or an elected
  official - as `meta.actor {id, name, kind}`, where `id` is a watch-register row. Individual campaigners, commenters,
  repliers and anyone not in the register stay anonymous on every layer. Write the rule into `CLAUDE.md`.
- **D2 Live reads through the Supermetrics connector.** Default: at most **eight** queries against public pages, to
  capture real response shapes for fixtures and to prove the path. No client account data. Each one named in the report.
- **D3 The scheduled route for layer 1.** Default: build the session pull fully, and the worker route behind
  configuration that is absent today, with a probe that says what to set. Do not ask for or handle any credential.
- **D4 Model spend.** Default: a brief draft is one model call per desk per window, started by a person, its cost stated
  on the button, counted in the `ai_usage` ledger under scope `den` against `DEN_DAILY_CALLS` (default 20). Drafting each
  morning without a person is a per-desk option, **off** by default, and held by `AI_AUTOMATION` like every other
  scheduled model call.
- **D5 Getting the report out.** Default: Copy as rich text (pastes into her Google Doc with headings and links),
  Download `.md` and `.html`, and Copy the Slack summary. Writing to Google Docs from the worker is not built.
- **D6 Who can use it.** Default: reading the Den is read role; drafting, approving a watch item and saving a brief are
  full, through `axRoutePolicy` as it stands. Her key is a roster entry the owner adds.
- **D7 Signed-in collection, platform by platform.** The owner has asked for it; it reverses the LinkedIn sentence in
  `CLAUDE.md` and widens what X and Reddit already do. Default: **build every channel, and switch none on.** A channel
  collects only after a person signs in to it on the Mac (`--login <platform>`), which is the owner's decision made per
  platform, on the day, with the warning below on screen. Record in `CLAUDE.md` which platforms the owner has switched
  on, by whom and when. State these plainly in the report and on the login screen:
  - automated reading with a signed-in account is against the terms of Facebook, Instagram, LinkedIn, TikTok and X, and
    the account used can be challenged, restricted or closed;
  - **never use a profile that administers client ad accounts, Pages or Business assets**: a restriction on it would
    lock the agency out of client work. The tool asks this question before a Facebook, Instagram or LinkedIn login and
    will not continue without an answer;
  - LinkedIn enforces hardest and its accounts are people's professional identities; it is built last and the report
    recommends for or against switching it on after Phase 0 shows how much of her evidence it would add.
- **D8 Subscriber news.** It reverses "No credentialed access anywhere". Default: a gated source is read only through
  **a subscription the agency holds, signed in by a person on the Mac**, and only once an operator has recorded on that
  source that the subscription or the agency's copyright licence covers monitoring use (`cleared_by`, `cleared_at`).
  Until then the source stays headlines only. Gated text is for internal reading and analysis (the storage rule below).
- **D9 The monitoring service's exports.** Default: build the importer; she decides whether to use it.

## Rules for this work

- **Test first.** Every defect gets a test that fails on the current commit and passes after the fix. Every capability
  gets acceptance tests: worker cases in `tests/den-worker.mjs` and `tests/den-collect-worker.mjs` (on
  `tests/worker-env.mjs`), browser cases in `tests/den-browser.mjs`, tool cases in `tests/den-tools-test.py` and
  `tests/reach-channels-test.py` (the pattern of `tests/reach-agent-test.py`: fake binaries, recorded-shape fixtures,
  and local synthetic HTML pages for the browser parsers).
- **Providers mocked only.** Make no paid Claude or Gemini call, contact no live worker, and run nothing in `tools/` that
  spends. D2 is the one stated exception. **Never sign in to any platform or publisher from this session, and never run
  a layer 2 collector against a live site from it**: that is a person's act on the Mac. Where a change needs the live
  archive, a real session or a real model to judge it, write the evaluation and leave the run to the owner.
- **Public content only, on every layer.** What any signed-in member of the public could see: public pages, public
  groups, public posts, public comments, search results. Never a private or closed group, a private account, a
  friends-only post, a story from a private account, a direct message, or anything reachable only because of who the
  signed-in person knows. A parser that cannot tell whether a thing is public does not file it.
- **No evasion.** Layer 2 reads at a person's pace and stops when the platform objects. It never solves or outsources a
  captcha, never uses stealth or fingerprint-spoofing plugins, proxies, VPN rotation or more than one account per
  platform, never creates accounts, and never retries past a challenge. For news it never uses a paywall-bypass service,
  a borrowed or shared login, or a trick to reset a metered wall.
- **Credentials stay on the Mac.** A person signs in by hand in a browser the tool opens. The tool never asks for, reads,
  prints or stores a password; session cookies live in the profile folder on that Mac and are never sent to the worker,
  the job log or a file in the repository. A test streams a log containing a cookie-shaped string and proves it arrives
  struck out.
- **Names.** D1 and nothing wider, on every layer. A test per collector proves a commenter, a replier and an
  unregistered account are stored without a name, handle or profile link.
- **Gated text is internal.** A row with `meta.gated: 1` keeps its body in the archive for reading, tagging, sentiment
  and narratives. No route outside the key gate returns the body (`/sifa/*`, `/review/*`, `/archive/stats`, public
  mode), a brief quotes at most thirty words from it and always with the link, and exports carry the headline, the
  outlet, the date and the link. Tests prove each.
- **Her reports are client material.** They are read through the Drive connector in the session and never copied into
  the repository: not as fixtures, not as examples, not in a commit message. Derived **public** facts (a topic term, an
  organisation's name, an outlet's address) may enter the lexicon and the seeds. Fixtures use the synthetic client
  (`synthdemo`, Harbourline Ferries) with invented groups, posts and outlets.
- **Client walls.** A desk belongs to one client namespace. Its watch register, mutes, rules, briefs and retrieval never
  reach another desk's. An organisation watched for two clients is two rows.
- **The worker stays pure ASCII.** `docs/` is the public site: `docs/den.js` holds no client data, no key and no list of
  watched accounts. Those live in D1.
- **A draft is never a filed report.** A model writes a draft; a person edits and marks it filed. A score, a count or a
  model's posture is advice.
- **Desktop first** (1366 x 768 and up). Phone and tablet are out of scope: do not spend on them, do not make them worse.
- **Release markers.** On each release bump the page's `?v=`, run `node tests/asset-versions.mjs --write`, bump
  `AXIOM_BUILD` (continue the series: `p53` ...), and raise `PAGE_NEEDS_BUILD` only if the Studio needs the new worker.
- **Gate every slice.** `node tests/run.mjs all` passes before each commit. Commit to the session's `claude/...` branch
  and push. The owner merges and deploys the worker with `tools/deploy-worker.sh`. No pull request unless asked.

## Phase 0 - Baseline and evidence (no edits)

1. Run the gate and record the result. Record `AXIOM_BUILD` and the page version.
2. Find her reports in Drive by title (the AEP daily activist activity briefs, national and Victoria; the MCA weekly,
   national and Victoria; the firearms weekly) and read the most recent thirty days of each. If one cannot be read, say
   which and carry on.
3. Build, in the scratchpad and nowhere else, three tables per desk: **terms** (phrases that recur, with counts),
   **actors** (organisations and officials, with the platforms they are cited on) and **sources** (domains in the source
   lists, with counts). Read the fixed vocabulary of her Recommended Posture line and her section order from the reports
   themselves; do not invent them.
4. For each row of those tables, say whether AXIOM holds it today: a lexicon issue that tags it (`issueTag`), a source
   in the registry, an entity in the register, an account in `x_watch` or the `mps` register. This is the **gap list**
   the later phases close. Write it into `DEN.md` (repository root, not `docs/`) as counts and public names only.
5. **Classify every source in her lists by access**: open, metered, subscriber, newsletter only, or official (a
   parliament, a regulator, a minister). For each cited social link, say which layer could have collected it: layer 1,
   layer 2 only, or neither. The result is one table - channel, links cited, reachable by layer 1, by layer 2, by
   neither - and it decides the order of Phase 3 and the D7 recommendation for LinkedIn.
6. Read what the Supermetrics connector offers: `data_source_discovery` and `field_discovery` for `FBPD`, `IGPD2` and
   `MAL`. Known at the time of writing:
   - `FBPD` (Facebook Public Data, no sign-in needed): `PagePosts` for a page alias (message, permalink, created time,
     reactions by type, comment and share counts), `Page` (followers, category, verified), `UrlShares` (Facebook
     reactions, comments and shares for any URL). No keyword search and no comment text.
   - `IGPD2` (Instagram Public Data, signed in): `BusinessDiscoveryMedia` for a username (caption, permalink, likes,
     comments, reels views, timestamp), `BusinessDiscoveryAccount`, and `HashtagSearchMedia` (recent or top posts for a
     hashtag: caption, permalink, likes, comments). No comment text.
   - `MAL` (Meta Ad Library): not signed in. The worker's own `metaAdLibrary()` needs `META_USER_TOKEN`.
   Confirm each against the live discovery answer and record what differs.
7. Read what agent-reach offers **today** from its own repository and documentation (`agent-reach doctor` lists the
   channels on a machine): which platforms it has a backend for, how each signs in, and what each returns. Do not trust
   a list from memory, this prompt's included. Record per platform: backend, sign-in, search, posts, comments. Where it
   has no backend (Facebook, at the time of writing, as far as is known), the signed-in browser path below is the route.

## Phase 1 - Coverage: topics, outlets, official sources, actors (release 1)

1. **Lexicon.** Extend `CLIENT_ISSUES` from the gap list. For `aep`, at least: a gas taxation issue (windfall tax, gas
   export tax, super-profits tax, PRRT), COP31, data centres and gas demand, and the project names the `gas` issue lacks
   (Scott Reef, Browse, and the others the reports show). Do the same exercise for `mca` and `guns` from their reports.
   Each new issue has all three parts and they differ on purpose: `rx` is the tight Sentinel trigger, `wide` the
   collection matcher, `q` the search terms. Mirror `wide` in `AX_ISSUES` in `docs/index.html`.
2. **Generic terms.** Several of these are ordinary English elsewhere: "gas tax" is a petrol tax in the United States,
   "data centre" is worldwide. A term that is generic is searched with `auQualify()` and earns its tag only through the
   Australian gate; it never enters `AU_RX`. Write the negative cases first: an American gas-tax story, a British
   windfall-tax story and a data-centre story with no energy angle must not be tagged for `aep`.
3. **Sources.** Add the outlets and campaign sites from the gap list to `SOURCE_SEED_EXT` with tier, jurisdiction, the
   issues they speak to and an honest method chain. Seed addresses are unverified until a sweep proves them: say so in
   the report and list them for the owner's first sweep.
4. **Official sources that never reach a news feed** (tier `official`): the parliamentary committees running inquiries
   on the desks' issues (inquiry pages, submissions, hearing programmes), the regulators and market bodies the reports
   lean on, and the relevant ministers' and shadow ministers' media-release pages, federal and Victorian. Hansard stays
   with `hansardSearch`. A hearing date or a submissions deadline found here feeds the Den's Upcoming table.
5. **Entities.** Add the missing organisations and elected officials to `ENTITY_SEED` with `side` and `ns` set, aliases
   that are plain words, and no bare surname that is also a word.
6. **Tests.** A table of real-shaped sentences per new issue: must tag, must not tag, must trigger the Sentinel, must
   not. The mirror test proves `AX_ISSUES` matches the worker. `GET /reddit/issues` publishes the new ids.

## Phase 2 - Layer 1: Facebook and Instagram through official routes (release 2)

**The watch register** (D1 `den_watch`), used by every layer: `id, ns, kind account|hashtag|term|source|group, platform,
value, name, actor_kind org|official|media, issue, status proposed|active|off|dismissed, source operator|reports|
discovery|seed, evidence json, score, added_by, decided_by, decided_at, reason, last_ok, last_error, last_layer,
updated`. Unique on `(ns, kind, platform, value)`. Routes: `GET /den/watch?ns=&kind=&status=`, `POST /den/watch/add|
update|decide|delete`. Every decision records who and why. `GET /den/plan?ns=&platform=` (read) turns the active rows
into the day's collection plan within each platform's caps; both layers read it.

**Route A - the session pull (works on day one).** The pattern the Audience view already uses:
1. `tools/den-pull-plan.py --ns aep --key ...` prints the queries to run for the plan (page aliases, usernames,
   hashtags, the day's top news URLs). With no key it reads a register export file.
2. The queries run through the Supermetrics connector in a Claude Code session and their results are saved as files.
3. `tools/supermetrics2signals.py fbposts=<file> igposts=<file> ighash=<file> urlshares=<file> --ns aep` converts them
   to archive rows in the Signals shape: kind `sig_thread`, `meta.platform` `facebook` or `instagram`, `url` the
   canonical permalink, `meta.eng {likes, comments, shares, views, reactions:{love, wow, haha, sad, angry}}`,
   `meta.eng_at`, `meta.issues` from the live lexicon (`GET /reddit/issues`, as `reach-reddit.py` does), `meta.layer: 1`,
   `meta.via: supermetrics`, `meta.watch` the register id, and `meta.actor` under D1 only.
4. The rows load through `tools/archive-push.py` or the Den's **Load data** button (the same 150-row batches and
   verified count as the Audience view).

**Route B - the worker (built, configured later).**
- `igDiscoverySweep()`: Instagram Business Discovery through the Graph API on `META_TOKEN` with a new var
  `META_IG_USER` (the agency's Instagram business account id), for active `account` rows on Instagram.
- `igHashtagSweep()`: hashtag search for active `hashtag` rows, only when the probe finds the permission. Meta limits an
  account to thirty unique hashtags in any seven days: keep the ledger in KV, spend it on the highest-scored hashtags,
  and show the remaining allowance in the Den. Verify the limit against Meta's current documentation and cite it in
  `DEN.md`.
- Facebook public pages need Page Public Content Access on the agency's own app. Build `fbPublicSweep()` behind the
  probe.
- `metaAdLibrary()` searches the active terms of every desk as well as the issue labels.
- `GET /meta/status?probe=1` grows the three new steps and names the first that fails.
- Cron: inside `socialCron()`'s cadence, by cursor, never more than the per-run cap. No model call.

**For every layer.**
- **One post, one row.** `canonPermalink(platform, url)` in the worker, mirrored in Python and proven on a shared table
  of cases (tracking parameters, mobile hosts, story and reel forms, numeric and vanity forms), so a post found by
  layer 1 and again by layer 2 is one row with the newer count and both layers recorded.
- **Counts move.** A post read again updates `meta.eng` in place (`json_set`) and appends one daily snapshot row, as
  petitions do, so the Den can show growth and a report can quote the count with the time it was read.
- **Relevance.** A post from a registered account is kept only if `issueTag()` finds one of the desk's issues or an
  active term in it; the rest are counted, not filed. A search or hashtag hit passes the Australian gate with the search
  term struck out of the text first, as `bskySweep` does.
- **Facebook reach of the news.** `UrlShares` for the day's top issue-tagged news rows writes `meta.fb {reactions,
  comments, shares, at}` on the news row, so she can see which stories are travelling on Facebook.
- **Signals** gains Facebook, Instagram, TikTok and Threads tabs built from the existing components.
- **Tests.** The converter on recorded-shape fixtures (synthetic content); dedupe on re-run and across layers; the
  count update and snapshot; the relevance filter; the hashtag ledger refusing the thirty-first; names proven absent for
  unregistered accounts; the probe naming each missing setting; a refused or malformed provider answer filed as a
  failure, never as an empty success.

## Phase 3 - Layer 2: the reach layer for every social channel (release 3)

Today `tools/reach-agent.py` claims a job (`GET /bridge/next`), runs the collector the job names, streams every command
and its answer into the job log (`POST /bridge/log`) and reports the outcome (`POST /bridge/done`); `collectors()`
advertises what the machine can do and `jobRoute()` sends work there by capability. This phase adds channels to that
machine. It does not build a second collector.

**One module per channel**, on the pattern of `tools/reach-x.py`: `tools/reach-instagram.py`, `reach-facebook.py`,
`reach-youtube.py`, `reach-tiktok.py`, `reach-threads.py`, `reach-linkedin.py` (last; D7). Each has:
- `status()` - installed, signed in, **and able to do each thing** it claims (search, posts, comments), probed with one
  small read, because signed in is not the same as able to search;
- `assert_ready()` raising `<Platform>Unavailable` with the fix in words, so a sweep that would return nothing never
  looks like a success, and the agent reports `<platform>_unavailable`;
- `sweep(plan, caps, pace, log)` for the three reads: an account's recent public posts; keyword or hashtag search; the
  public comments under the posts that drew argument (highest interaction first, capped);
- row builders in the Signals shape: `sig_thread` and `sig_comment`, `meta.platform`, `meta.eng`, `meta.eng_at`,
  `meta.issues` from the live lexicon, tone from the colloquial lexicon on comments, `meta.layer: 2`,
  `meta.via: reach`, the canonical permalink, `meta.actor` under D1 only, and nothing else that names a person;
- `--dry-run --out rows.json` for the in-app Load data button, and a `main()` usable without the agent.

**Two kinds of backend, in this order of preference.**
1. An agent-reach backend where Phase 0 found one for the platform (as `rdt` and `twitter` are today). YouTube keyword
   search and comments belong here, which closes the "keyword search without a key" gap in the coverage table.
2. Otherwise the **signed-in browser**: `reach-agent.py`'s Playwright path with a persistent profile per platform under
   `~/.axiom-reach/profiles/<platform>` (mode 700, outside the repository). `python3 tools/reach-agent.py --login
   <platform>` opens a visible browser at the platform's own sign-in page, shows the D7 warning and question first, and
   waits for the person to finish, two-factor and all. `--logout <platform>` deletes the profile. The collector then
   reads the pages a signed-in person sees - a page's or public group's posts, a public post's comments, search and
   hashtag results - and parses them. Facebook is expected to be this kind.

**Parsers fail loudly.** Pages change. Each browser parser is tested against synthetic fixture pages, checks that the
fields it needs are present, and on a page it cannot read reports `parse_failed` with what was missing and files
nothing. Three parse failures in a row on a platform pause it and say so. A sweep that files zero rows from pages that
had content is a failure, not a quiet day.

**Pace, caps and stopping.** Settings live in `~/.axiom-reach/reach.json` on the Mac, with conservative defaults the
owner can lower or raise: seconds between page loads with jitter, reads per run and per day per platform, comment
threads per run, one session at a time per platform. A login wall, a checkpoint, a captcha, a "suspicious activity"
notice or a rate-limit page is a **challenge**: the collector stops that platform at once, pauses it for twenty-four
hours in a state file, reports `<platform>_challenge` into the job, and the worker posts once to Slack (`_default`). A
person clears a challenge by hand in `--login`; the tool never tries.

**Routing and switches.**
- Bridge sources `instagram`, `facebook`, `tiktok`, `threads`, `linkedin`, `youtube_search`; `collectors()` offers a
  channel only when its backend is installed and its session exists. `jobRoute()` prefers layer 1 where configured.
- A queued desktop job with no live collector offering its source fails after a short wait with `no_collector` and the
  command that starts one, instead of waiting for ever.
- Kill switches on both sides: KV `reach_off` (a list of platforms the worker will not queue for the desktop, set from
  the Den by a full key) and `--sources` on the Mac.
- The launchd agent asks for the day's plan before her morning and runs it within the caps; the Den's **Collect now**
  creates the same job with the console.
- `socialCoverage()` and `GET /bridge/status` report per platform: the layer that last delivered, session state, today's
  reads against the cap, the last challenge or parse failure, and what stays out of reach.

**What stays out of reach on every layer,** stated in the table and in the Den: private and closed groups, private
accounts, direct messages, and anything behind a challenge.

**Tests** (`tests/reach-channels-test.py` and the worker harness): each module's `status()` and `assert_ready()` against
a fake backend that is signed out, signed in but unable to search, and healthy; row shapes; names absent; the public-
only rule on a fixture marked private; `parse_failed` on a changed page; the pause after a challenge and after three
parse failures; caps honoured across two runs; the cookie strike-out; cross-layer dedupe; `no_collector`; `reach_off`.

## Phase 4 - Gated and important news (release 4)

1. **Access on the source.** `sources` gains `access` (`open|metered|subscriber|newsletter|official`), `cleared_by` and
   `cleared_at`; the Sources view shows and edits them (full key). A new method `reach` in the method chain means "the
   Mac reads this with the agency's subscription". `sourceRun()` never attempts it in the worker.
2. **Discovery stays open.** Headlines come as now from the source's feed, sitemap, listing page or Google News. Only
   rows that `issueTag()` files under a desk's issue, or that a person asks for, go on to the subscriber read. The
   collector does not download the paper.
3. **The subscriber read.** Bridge job `render` with `{url, id, profile}` on the Mac, using a persistent profile per
   publisher (`--login news:<source id>`). `extract_article` as now; the result is saved through `POST /fulltext/save`
   with `meta.ft: 'subscriber'`, `meta.gated: 1`, `meta.layer: 2`. A page that still shows a paywall after sign-in is
   reported as `subscription_wall` with the source named, never saved as a body. Caps per source per day in
   `reach.json`. A source without `cleared_by` is refused with the reason (D8). `fulltextCron()` queues these jobs only
   for cleared sources and only when a live collector offers `render` with that profile.
4. **Newsletters.** Subscriber briefings that arrive by email are imported from exported messages:
   `tools/den-import.py eml=<folder> --source <id> --ns aep` files each item as kind `news` with
   `meta.method: 'newsletter'`, `meta.gated: 1`, the links inside followed only to open pages.
5. **Monitoring exports** (D9): `tools/den-import.py monitor=<csv> --ns aep` maps the service's export columns to rows
   (url-deduped, issue-tagged, `meta.via: 'monitor'`), prints what it would file, and files nothing without `--apply`.
   What it brings that AXIOM did not already hold is counted, which is itself a coverage measure.
6. **The storage rule** from Rules, enforced in code: one function decides what leaves the gate
   (`gatedView(row, auth)`), and every route that returns a body goes through it.
7. **Tests.** The refusal for an uncleared source; `subscription_wall`; the cap; the storage rule on `/sifa/results`,
   a review link, public mode and the Den's exports; the thirty-word limit in `denClean`; both importers' dry runs.

## Phase 5 - Keyword discovery: proposed with evidence, approved by a person (release 5)

`denDiscover(env, ns, {days})` is deterministic and makes no model call. It proposes register rows with status
`proposed`, each with evidence (up to five archive items and the phrase in context) and a score:
1. **Terms**: phrases of one to three words that are over-represented in rows tagged with the desk's issues against the
   same desk's fourteen-day background (a lift measure with a minimum count; stop words and the existing lexicon out).
2. **Hashtags** on registered accounts' posts and on issue-tagged posts.
3. **Accounts and public groups** that registered accounts repeatedly mention, repost or link to, and the accounts
   whose posts recur in search results for the desk's terms.
4. **Outlets**: domains linked from issue-tagged rows that are not in the Source Registry.
5. **From narratives**: the top terms of live narratives on the desk's issues that the lexicon does not match.
6. **From the comments**: phrases that recur in comments under the desk's posts and nowhere in its lexicon - the words
   the audience uses, which are often not the words the campaign uses.
7. **From her reports**: `tools/den-mine-reports.py <folder outside the repository>` reads exported reports, extracts
   terms, handles and domains, and posts them to `POST /den/watch/propose` with source `reports`. It prints what it
   would send and sends nothing without `--apply`.

Before a decision, **Preview** shows what a term would have caught: the last seven days of archive rows it matches that
no current issue tags, with a sample of twenty and a count by channel - a query on what is already held, free. A term
whose sample is mostly foreign or off-topic is visibly so before anyone approves it.

An approved term widens **collection and tagging only**: it joins the desk's search terms and its wide matcher through
one function (`deskLexicon(env, ns)`, cached, merged into what `GET /reddit/issues` publishes so no collector on any
layer can drift). It never changes a tight `rx`; the Sentinel's triggers stay hand-written. Guards: a cap of active
terms per desk, a generic-word warning from the Australian gate, an off switch per term, and a 30-day review line for
terms that have matched nothing.

One optional model step, behind a button with its cost: group the proposals into themes and say in a line why each
might matter to this client. It changes no status.

Tests: each proposer on seeded rows; the preview query; an approved term changing the published lexicon and the tagging
of a new row; a dismissed term never proposed again; another desk's proposals never visible; the tool's dry run sending
nothing.

## Phase 6 - Anne's Den (release 6)

A new island: `docs/den.js` with `docs/den.css`, a `<section class="view" id="v-den">` shell, a nav button named
**Anne's Den** in the Today group, the `go()` title and init hook, and `AXUI.goto('den', {...})` adoption. Tokens only:
the Phase 5 shell rules (flat panels, tables not cards, hairline strips, tabular mono figures) and the semantic status
tokens. `tests/studio-tokens-test.mjs` is extended to cover `den.css`.

**Desks.** D1 `den_desks`: `id, ns, name, region au|vic|..., cadence daily|weekly, window_h, sections json, posture
json, options json, auto_draft, revision, updated`. Seeded from what Phase 0 found: AEP national, AEP Victoria, MCA
national, MCA Victoria, Firearms. A desk is the unit of everything below. The page is named for Anne; nothing in the
data model is hers alone, so a second analyst can be given a desk.

**Today (the evidence board).** For the desk's window, the rows already sorted into her sections, each a table:
- **Key narratives**: live narratives on the desk's issues - label, claim, pace, stance toward the client, the order
  the channels took it up - opening the Narratives drawer.
- **Traditional media**: issue-tagged news in the desk's region, syndicated copies folded into one row with a count of
  outlets, Facebook reach where held, a `subscriber` mark on gated rows, full text on demand.
- **Social**: posts from the register and on the terms, by channel, with interaction counts, the time they were read,
  growth since the last read, the tone of the comments held, and a small mark for the layer that collected it.
- **Influencer and political**: registered officials and organisations, and MPs from the register, on their own posts.
- **Upcoming**: dated actions (protests, hearings, launches, submission deadlines, petitions closing) found by a
  deterministic date-and-verb pass over the window's rows and the official sources, each with its source row; never a
  guess presented as a date.
Each row can be **pinned** to the report, **set aside** with a reason (not relevant, duplicate, foreign), or opened at
its evidence. Set-asides are per desk and feed mutes: after three set-asides of the same account, domain or term the
Den offers a mute, which a person confirms.

**Nothing critical missed.** A strip above the board, computed without a model: Sentinel spikes on the desk's issues;
narratives that became `emerging` in the window; **first-seen actors** (a register entity or a new account with its
first issue-tagged post in fourteen days); terms bursting against their own baseline; a registered account whose
engagement on one post is several times its median; and **collection gaps** - a channel the desk relies on that
delivered nothing in the window, with the reason, so an empty table is never mistaken for a quiet day. Each line opens
its evidence. Before a brief is marked filed, the Den lists the items on this strip that the brief does not cite, and
asks once.

**The brief.** `POST /den/brief {desk, window, pins}` (full) writes a draft in her seven sections from the evidence,
in which every row carries an id. Strict JSON; one retry on invalid JSON, none on a budget or account refusal. A
`denClean()` like `briefClean()` ties it back: an id the evidence never gave is dropped with its sentence marked
`uncited`, counts and names come from the data and never from the model, the Source List is built from the cited rows
in her format, the posture is one of the desk's own vocabulary, and the gated-text limit holds. The call must survive
its own length: a job the worker runs after a response lives about thirty seconds, so use the in-request heartbeat or a
stepped job, and say which and why. The system prompt ends with `AX_UNTRUSTED_RULE`.
Briefs are D1 `den_briefs` (`desk, day, window, status draft|filed, revision, sections json, evidence json, model,
by, filed_by, filed_at`), with every save a row in `den_brief_revisions`. In the page: an editor per section with the
citations as chips that open the row; **Regenerate this section** (one call, stated) that never touches a section a
person has edited unless they ask; hand edits autosaved for this person (the Studio's working-copy pattern, never a
silent overwrite: a stale revision is a 409 with Keep mine / Take theirs); **Mark as filed**; history with a
word-level difference against yesterday's filed brief; and D5's exports. Retrieval for the draft is the desk's
namespace and `cmm` only.

**Watch.** The register and Phase 5's proposals: tabs for terms, hashtags, accounts, groups and outlets; the proposal
queue with evidence, Preview, Approve and Dismiss with a reason; health per row (last read, by which layer, last
error); the hashtag allowance; mutes.

**Collection.** For this desk: each channel with the layer that reads it, the session state on the Mac, today's reads
against the cap, when it last delivered, the last challenge or parse failure in words, and what cannot be reached;
**Collect now** per channel with the live console; the platform kill switches (full key); the gated sources with their
clearance. Then **recall against her own sources**: of the links in her filed reports for a period, the share AXIOM
held at the time, by channel and by layer, with the misses listed. The measuring tool is `tools/den-backtest.py
<reports folder> --key ...` (read role, dry by nature); the Den shows its last result. This is the number that says
whether the work succeeded, and the owner runs it.

**Options** (per desk, saved with a revision): reporting window and cadence, region, section order and which sections
show, the posture vocabulary, minimum engagement per channel, how syndicated copies fold, mutes, the automatic morning
draft (D4), and the table density. Australian Eastern time throughout.

**Quality of the interface.** Loading, empty, error, partial and read-only states are designed for every panel, and an
empty panel says why (nothing collected, nothing matched, not configured, collector offline, platform paused) with the
one action that fixes it. Every paid button states its cost. Keyboard: move between sections, pin, set aside, open, and
a shortcuts sheet. Every control named for a screen reader; the view joins `tests/studio-a11y-browser.mjs`'s gate at
1366, 1440 and 1920. A read-only key sees everything and no control that writes. A failure in one panel never blanks
the page.

**Routes** (GET read, POST full; every refusal has words in `AX_ERROR_DETAIL`): `GET /den/desks`, `/den/board?desk=
&window=`, `/den/missed?desk=`, `/den/brief?desk=&day=`, `/den/briefs?desk=`, `/den/collection?desk=`; `POST
/den/desk/update`, `/den/pin`, `/den/aside`, `/den/mute`, `/den/collect`, `/den/brief`, `/den/brief/section`,
`/den/brief/save`, `/den/brief/file`. Lists sent to D1 stay under its hundred-variable limit; stored JSON goes through
`jsonFit` or is refused past its limit with the field named; writes are compare-and-swap on `revision`.

**Tests.** Worker: the board's sorting and folding; region and window edges across a Sydney midnight and a daylight
saving change; the missed strip's six signals; `denClean` dropping an invented id and rebuilding the Source List; a
subverted model answer leaving names, counts and walls intact; one desk never reading another's pins, mutes, briefs or
register; the 409 on a stale save; a budget refusal reaching no provider; the route policy for no key, a wrong key, a
read key and a full key. Browser: the whole day's journey - open a desk, read the strip, pin and set aside, collect
now with the console, draft, edit, regenerate one section, see the uncited warning, mark filed, copy and download -
plus read-only, each empty and error state, a paused platform, a dropped connection mid-draft, and reload with unsaved
edits.

## Phase 7 - Proof and hand-over

1. The full gate, twice from a clean checkout if a harness was flaky. Fix the harness or the code; never mark a
   failure as known.
2. An error-injection pass on the Den: every route failing, slow, and answering malformed, one at a time.
3. Screenshots of each Den tab at 1366 x 768 and 1920 x 1080 into the ignored `tests/shots/den/`, and look at them.
4. Documents: sections in `CLAUDE.md` for the three layers, the reach channels and their rules (public only, no
   evasion, credentials on the Mac), the gated-text rule, the Den and the watch register; the two reversed sentences
   rewritten with the decision, the date and who made it; `DEN.md` with the design, the gap list, the platform limits
   with their sources and the decisions taken; `ATTRIBUTION.md` for anything open-licensed that was added.
5. A one-page guide for Anne (a Claude Doc, not a repository file): what each tab is for, her morning in six steps,
   what a citation chip and a layer mark mean, what the Den cannot see and where she still has to look.
6. The owner's steps, as exact commands: deploy; the first source sweep and which seeds to check; the first Route A
   pull; installing the reach backends on the Mac and `--login` per platform, with the D7 warning repeated; recording
   clearance on each gated source and `--login news:<id>`; `tools/den-mine-reports.py` and `tools/den-backtest.py` with
   their flags; the settings Route B needs (`META_IG_USER`, the Meta permissions by name); the roster entry for her key.

## The report at the end of each release

Say plainly: what was built and where; the test counts and the gate result; each decision D1 to D9 and what was done;
every Supermetrics query made under D2; what was **not** verified in this sandbox (the live archive, real provider
answers, the seed addresses, the Meta permissions, every layer 2 channel against its live site, every subscriber read,
recall against her reports) and the command that verifies each; and anything asked for here that was not built, with
the reason. Do not describe a mocked result as a real one, and do not describe a parser tested on synthetic pages as
working on the live platform.
